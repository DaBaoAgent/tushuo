"""Use the copied GPT-SoVITS 26E voice to narrate a local script.

Runs the project-local server only when a chunk still needs synthesizing.
No alannew path or cloud API is required. Raw chunks are cached by text hash;
the assembly step then removes sentence-gap breath/silence so the delivery
reads as one continuous take. Audio is cached by script content + assembly.

The assembled mp3 is written, and each chunk's *tightened* audio is saved next
to it so align_narration.py can time subtitles against the audio that actually
went into the mix (the raw cached chunks keep their original pauses).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time

import requests
import numpy as np


ROOT = Path(__file__).resolve().parent.parent
GSV = ROOT / "vendor" / "gpt-sovits"
FFMPEG = GSV / "runtime" / "ffmpeg.exe"
FFPROBE = GSV / "runtime" / "ffprobe.exe"
SR = 44100
SPEAK_FIX_VERSION = "sfx1"   # 接入 production-defaults 的 speakFixes 后指纹换代，勿回退


def load_speak_fixes() -> list[tuple[str, str]]:
    """读取 tools/production-defaults.json 的配音读数修正（与 alannew 管线同源）。

    返回 [(from, to), ...] 平铺列表：global + 各 act 的场景修正对 narrate 的
    纯文本 chunk 一律按全局替换应用（短语足够独特，不会误伤；跨战役的
    如「冀、青、幽、并」在本稿不存在，天然空转）。字幕与对时仍用定稿文本，
    只有送去合成的 spoken 文本被改写。"""
    path = ROOT / "tools" / "production-defaults.json"
    if not path.exists():
        return []
    fixes = json.loads(path.read_text(encoding="utf-8")).get("narration", {}).get("speakFixes") or {}
    pairs: list[tuple[str, str]] = [tuple(p) for p in fixes.get("global", [])]
    for act_fixes in (fixes.get("acts") or {}).values():
        pairs.extend(tuple(p) for p in act_fixes)
    # 长短语优先，避免短模式先把长短语拆坏
    pairs.sort(key=lambda p: len(p[0]), reverse=True)
    return pairs


def speak_text(text: str, fixes: list[tuple[str, str]]) -> str:
    for src, dst in fixes:
        text = text.replace(src, dst)
    return text


def mp3_seconds(path: Path) -> float:
    proc = subprocess.run(
        [str(FFPROBE), '-v', 'error', '-show_entries', 'format=duration',
         '-of', 'default=noprint_wrappers=1:nokey=1', str(path)],
        capture_output=True, text=True,
    )
    try:
        return float(proc.stdout.strip())
    except ValueError:
        return 0.0


# 26E 正常语速约 4–6 字/秒；超过此值多为服务端把尾句截断（2026-10-19 官渡
# 第 49/57 段实测：尾句整句丢失、时长远短于同字数段落）。命中即丢弃重配。
MAX_CHARS_PER_SECOND = 6.2

# 拼接参数：把超过 MIN_GAP_MS 的句间静音压到 KEEP_GAP_MS（只缩短，不加长）
MIN_GAP_MS = 240           # 短于此的停顿视作自然语气，不动
KEEP_GAP_MS = 185          # 超过门限的停顿压到这个长度
SILENCE_DB = -40.0         # 绝对门限：低于此视为句间静音/换气
GATE_DB = -33.0            # 呼吸声压制门限（绝对分贝）
GATE_FLOOR = 0.3           # 门限以下的保留增益（压掉约 10 dB）


def get_health(session: requests.Session, base_url: str) -> dict | None:
    try:
        response = session.get(base_url + "/healthz", timeout=2)
        if response.ok:
            return response.json()
    except requests.RequestException:
        pass
    return None


def split_script(script: str, maximum: int = 78) -> list[str]:
    sentences = [s for s in re.split(r"(?<=[。！？])", script) if s.strip()]
    groups: list[str] = []
    current = ""
    for sentence in sentences:
        if current and len(current + sentence) > maximum:
            groups.append(current)
            current = ""
        current += sentence
    if current:
        groups.append(current)
    return groups


def frame_rms(x: np.ndarray, hop: int) -> np.ndarray:
    n = len(x)
    if n < hop:
        return np.zeros(0, np.float64)
    c = np.concatenate(([0.0], np.cumsum(np.asarray(x, dtype=np.float64) ** 2)))
    starts = np.arange(0, n - hop + 1, hop)
    return np.sqrt(np.maximum((c[starts + hop] - c[starts]) / hop, 1e-12))


def speech_spans(x: np.ndarray, hop: int, thr_db: float) -> list[tuple[int, int]]:
    rms = frame_rms(x, hop)
    if rms.size == 0:
        return []
    loud = 20 * np.log10(rms + 1e-12) > thr_db
    spans: list[tuple[int, int]] = []
    start = None
    for i, on in enumerate(loud):
        if on and start is None:
            start = i
        elif not on and start is not None:
            spans.append((start * hop, i * hop))
            start = None
    if start is not None:
        spans.append((start * hop, len(x)))
    return spans


def tighten(x: np.ndarray) -> np.ndarray:
    """把段内超过 MIN_GAP_MS 的静音/换气压到 KEEP_GAP_MS；只缩短，不加长。

    段落（语音）原样保留，只从每段静音中间剪掉多余部分，接缝做短淡入淡出。
    """
    x = np.asarray(x, dtype=np.float32)
    if x.size == 0:
        return x
    hop = SR // 100
    rms = frame_rms(x, hop)
    if rms.size == 0:
        return x
    silent = 20 * np.log10(rms + 1e-12) <= SILENCE_DB
    keep = int(SR * KEEP_GAP_MS / 1000)
    min_gap = int(SR * MIN_GAP_MS / 1000)
    fade = int(SR * 0.006)
    out: list[np.ndarray] = []
    cut_from = 0
    i = 0
    n = len(silent)
    while i < n:
        if not silent[i]:
            i += 1
            continue
        j = i
        while j < n and silent[j]:
            j += 1
        start = i * hop
        end = min(len(x), j * hop)
        length = end - start
        out.append(x[cut_from:start])
        half = keep // 2
        if length > min_gap:                       # 静音过长 → 只留 KEEP_GAP 的一半贴住语音
            if i == 0:
                out.append(x[end - half:end])      # 段首：留贴住语音的一半
            elif j == n:
                out.append(x[start:start + half])  # 段尾：留贴住语音的一半
            else:
                out.append(x[start:start + half])
                out.append(x[end - half:end])
        else:
            out.append(x[start:end])
        cut_from = end
        i = j
    out.append(x[cut_from:])
    y = np.concatenate(out).astype(np.float32)
    if fade > 1 and len(y) > 2 * fade:            # 全局首尾淡入淡出
        y[:fade] *= np.linspace(0.0, 1.0, fade, dtype=np.float32)
        y[-fade:] *= np.linspace(1.0, 0.0, fade, dtype=np.float32)
    return y


def soft_gate(x: np.ndarray) -> np.ndarray:
    """轻噪声门：门限以下（多半是换气/底噪）压低，语音基本不动。"""
    x = np.asarray(x, dtype=np.float32)
    if x.size == 0:
        return x
    thr = GATE_DB
    ramp = 8.0
    hop = SR // 100
    rms = frame_rms(x, hop)
    if rms.size == 0:
        return x
    db = 20 * np.log10(rms + 1e-12)
    gain = np.clip((db - (thr - ramp)) / ramp, 0.0, 1.0)
    gain = GATE_FLOOR + (1.0 - GATE_FLOOR) * gain
    gain = np.convolve(gain, np.ones(7) / 7, mode="same")
    xs = np.arange(len(gain)) * hop + hop / 2
    gi = np.interp(np.arange(len(x)), xs, gain).astype(np.float32)
    return (x * gi).astype(np.float32)


def decode(path: Path) -> np.ndarray:
    raw = subprocess.check_output([
        str(FFMPEG), '-v', 'error', '-i', str(path),
        '-ar', str(SR), '-ac', '1', '-f', 'f32le', 'pipe:1'])
    return np.frombuffer(raw, dtype='<f4').copy()


def write_wav(pcm: np.ndarray, path: Path) -> None:
    proc = subprocess.run([
        str(FFMPEG), '-y', '-v', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '1',
        '-i', 'pipe:0', '-c:a', 'pcm_s16le', str(path)],
        input=np.asarray(pcm, dtype='<f4').tobytes(), capture_output=True)
    if proc.returncode:
        raise RuntimeError(proc.stderr.decode('utf-8', errors='replace'))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--text-file", type=Path, default=ROOT / "content/chibi-full/口播稿.txt")
    parser.add_argument("--out", type=Path, default=ROOT / "output/chibi-full/narration.mp3")
    parser.add_argument("--port", type=int, default=9880)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    # 允许稿子按段换行：换行只作排版，合成前并回一行
    script = re.sub(r"\s*\n\s*", "", args.text_file.read_text(encoding="utf-8-sig")).strip()
    if not script:
        raise SystemExit("口播稿为空")
    args.out.parent.mkdir(parents=True, exist_ok=True)
    metadata_path = args.out.with_suffix(".json")
    _fixes = load_speak_fixes()
    _fixes_hash = hashlib.sha256(json.dumps(_fixes, ensure_ascii=False).encode("utf-8")).hexdigest()[:10]
    fingerprint = hashlib.sha256(
        (script + f"|26E|cut1|speed1|chunk78-v2|{SPEAK_FIX_VERSION}-{_fixes_hash}|tight{MIN_GAP_MS}-{KEEP_GAP_MS}-{SILENCE_DB}-{GATE_DB}-{GATE_FLOOR}").encode("utf-8")
    ).hexdigest()
    if (not args.force and args.out.exists() and metadata_path.exists()
            and json.loads(metadata_path.read_text(encoding="utf-8")).get("fingerprint") == fingerprint):
        print(f"已有匹配配音：{args.out}")
        return

    groups = split_script(script)
    speak_fixes = load_speak_fixes()
    changed = [(i, c) for i, c in enumerate(groups, 1) if speak_text(c, speak_fixes) != c]
    if speak_fixes:
        print(f"读数修正 {len(speak_fixes)} 条；影响 {len(changed)} 段：{[i for i, _ in changed]}", flush=True)
    chunks_dir = args.out.parent / "narration-chunks"
    chunks_dir.mkdir(parents=True, exist_ok=True)
    raw_parts = []
    for index, chunk_text in enumerate(groups, 1):
        # 缓存键用「合成输入」的哈希：speakFixes 变更后旧缓存不会被误复用
        spoken = speak_text(chunk_text, speak_fixes)
        hash8 = hashlib.sha256(spoken.encode('utf-8')).hexdigest()[:10]
        raw_parts.append((index, chunk_text, spoken, chunks_dir / f"{index:02d}-{hash8}.mp3"))

    base_url = f"http://127.0.0.1:{args.port}"
    session = requests.Session()
    session.trust_env = False
    process = None
    try:
        missing = [p for _, _, _, p in raw_parts if not p.exists()]
        if missing:
            health = get_health(session, base_url)
            if health is None:
                flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
                process = subprocess.Popen(
                    [sys.executable, str(GSV / "tts_server.py"), str(args.port)],
                    cwd=GSV, creationflags=flags,
                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                )
                for _ in range(180):
                    if process.poll() is not None:
                        raise RuntimeError(f"GPT-SoVITS 服务提前退出，状态码 {process.returncode}；详见 {GSV / 'tts_server.log'}")
                    health = get_health(session, base_url)
                    if health is not None:
                        break
                    time.sleep(1)
                else:
                    raise TimeoutError("GPT-SoVITS 加载超过 180 秒")
            if health.get("voice") != "gpt-sovits-26E":
                raise RuntimeError(f"端口 {args.port} 上不是预期的 26E 音色服务")
            for index, chunk_text, spoken, part in raw_parts:
                if part.exists():
                    continue
                clean_chars = len(re.sub(r"[^\w\u3400-\u9fff]", "", spoken))
                for attempt in range(3):
                    response = session.post(
                        base_url + "/v1/audio/speech",
                        json={"model": "gpt-sovits-v2", "input": spoken,
                              "voice": "dabao", "response_format": "mp3", "speed": 1.0,
                              "text_split_method": "cut1"},
                        timeout=(10, 1800),
                    )
                    response.raise_for_status()
                    if len(response.content) < 1000 or response.headers.get("Content-Type") != "audio/mpeg":
                        raise RuntimeError(f"第 {index} 段未返回有效 MP3")
                    partial = part.with_suffix('.tmp')
                    partial.write_bytes(response.content)
                    partial.replace(part)
                    seconds = mp3_seconds(part)
                    if seconds <= 0 or clean_chars / seconds <= MAX_CHARS_PER_SECOND:
                        break
                    print(f"第 {index} 段疑似截断（{clean_chars} 字 / {seconds:.2f}s），第 {attempt+1} 次重配",
                          flush=True)
                    part.unlink(missing_ok=True)
                    time.sleep(0.8)
                else:
                    raise RuntimeError(
                        f"第 {index} 段连续 3 次截断：{clean_chars} 字 / {seconds:.2f}s")
                print(f"合成第 {index} 段 {len(chunk_text)} 字", flush=True)

        pieces: list[np.ndarray] = []
        chunks_meta = []
        timeline = 0.0
        gap = np.zeros(int(SR * 0.02), np.float32)
        for index, chunk_text, spoken, part in raw_parts:
            raw = decode(part)
            tight = tighten(raw)
            tight_path = part.with_suffix('.tight.wav')
            write_wav(tight, tight_path)
            tight_duration = len(tight) / SR
            chunks_meta.append({'index': index, 'text': chunk_text, 'file': str(tight_path),
                                'start': round(timeline, 4), 'duration': round(tight_duration, 4),
                                'raw_duration': round(len(raw) / SR, 4),
                                'raw_file': str(part)})
            pieces.append(tight)
            timeline += tight_duration
            if index < len(raw_parts):
                pieces.append(gap)
                timeline += len(gap) / SR
            print(f"第 {index} 段 {len(chunk_text)} 字 / 原 {len(raw)/SR:.2f}s → 紧 {tight_duration:.2f}s", flush=True)

        pcm_all = soft_gate(np.concatenate(pieces).astype(np.float32))
        encoder = subprocess.run([
            str(FFMPEG), '-y', '-v', 'error',
            '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', 'pipe:0',
            '-c:a', 'libmp3lame', '-b:a', '192k', str(args.out.with_suffix('.tmp.mp3'))],
            input=pcm_all.astype('<f4').tobytes(), capture_output=True)
        if encoder.returncode:
            raise RuntimeError(encoder.stderr.decode('utf-8', errors='replace'))
        args.out.with_suffix('.tmp.mp3').replace(args.out)
        probe = subprocess.check_output([
            str(FFPROBE), "-v", "error", "-show_entries", "format=duration",
            "-of", "json", str(args.out)], text=True)
        duration = float(json.loads(probe)["format"]["duration"])
        metadata_path.write_text(json.dumps({"fingerprint": fingerprint, "voice": "gpt-sovits-26E",
                                             "split": "cut1", "duration": duration,
                                             "speakFixes": [list(p) for p in speak_fixes],
                                             "tighten": {"minGapMs": MIN_GAP_MS, "keepGapMs": KEEP_GAP_MS,
                                                         "silenceDb": SILENCE_DB, "gateDb": GATE_DB,
                                                         "gateFloor": GATE_FLOOR},
                                             "script": str(args.text_file),
                                             "chunks": chunks_meta}, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"生成 {args.out}，{duration:.2f} 秒，{len(script)} 字")
    finally:
        if process is not None:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
        session.close()


if __name__ == "__main__":
    main()
