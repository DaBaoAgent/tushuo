# -*- coding: utf-8 -*-
"""用项目内 dabao 26E 音色服务批量合成旁白。

服务：vendor/gpt-sovits/tts_server.py（127.0.0.1:9880，参数已锁定，
参考音频 vendor/gpt-sovits/ref_dabao3-1.wav）。
按标点切成 <=78 字的段，逐段 POST，带缓存；拼接时每段前留 30ms、段间 20ms。
输出 mp3 192k / 44.1k 单声道，并写 narration.json（段级元数据）供校对。

用法：
  python tools/dabao_batch_tts.py --text-file content/<slug>/口播稿.txt \
      --out output/<slug>/narration.mp3
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FFMPEG = ROOT / "vendor" / "gpt-sovits" / "runtime" / "ffmpeg.exe"
FFPROBE = ROOT / "vendor" / "gpt-sovits" / "runtime" / "ffprobe.exe"

# 只改送合成文本，字幕仍用原文。词组级替换，禁止单字全局替换。
SPEAK_FIXES = [
    ("成吉思汗", "成吉思韩"),
    ("大汗", "大韩"),
    ("可汗", "克寒"),
    ("术赤", "竹赤"),
    ("亦纳勒术", "亦纳勒束"),
    ("讹答剌", "讹答腊"),
    ("花剌子模", "花腊子模"),
    ("长子", "掌子"),
    ("千户长", "千户掌"),
    ("看中", "看重"),
    ("他没降", "他没投降"),
    ("投降", "投祥"),
    ("降军", "祥军"),
    ("调来", "吊来"),
    ("1206年", "一二零六年"),
    ("1218年", "一二一八年"),
    ("1219年", "一二一九年"),
    # jianying · 中国历代帝王稿读音修正
    ("单于", "禅于"),
    ("阏氏", "烟支"),
    ("尉迟", "玉迟"),
    ("瓦剌", "瓦辣"),
    ("噶尔丹", "嘎尔丹"),
    ("高丽", "高离"),
    ("出降", "出祥"),
    ("一石", "一担"),
    ("乐不思蜀", "勒不思蜀"),
    ("长乐老", "常乐老"),
    ("将领", "匠领"),
    ("骑兵", "奇兵"),
    ("许都", "许督"),
    ("大都", "大督"),
    ("东都", "东督"),
    ("成都", "成督"),
    ("江都", "江督"),
    ("定都", "定督"),
    ("迁都", "迁督"),
    ("邯郸", "寒丹"),
    ("涿郡", "捉郡"),
    ("燕云", "烟云"),
    ("燕王", "烟王"),
    ("燕然", "烟然"),
    ("燕太子", "烟太子"),
    ("土木堡", "土木补"),
    ("萨尔浒", "萨尔虎"),
    ("溥仪", "普仪"),
    ("李存勖", "李存续"),
    ("孟昶", "孟场"),
    ("澶渊", "婵渊"),
    ("朱棣", "朱弟"),
    # 「嫪」读 lào，但换成「涝」后在「平定涝矮叛乱」里会被 G2PW 判成 liáo；
    # 「烙」在两处真实句子里都稳定读 lao4（2026-10-22 实测）。
    ("嫪毐", "烙矮"),
    ("督亢", "督抗"),
    ("蒙恬", "蒙田"),
    ("垓下", "该下"),
    ("狼居胥", "狼居须"),
    ("张骞", "张千"),
    ("钩弋", "钩义"),
    ("陈蕃", "陈凡"),
    ("刘禅", "刘善"),
    ("祖逖", "祖替"),
    ("萧衍", "萧演"),
    ("玄奘", "玄葬"),
    ("西藏", "西葬"),
    # 投降义读 xiáng（长词组优先，禁止裸「而降」「降于」全局替换）
    ("不战而降", "不战而祥"),
    ("望风而降", "望风而祥"),
    ("闻风而降", "闻风而祥"),
    ("束手而降", "束手而祥"),
    ("开城而降", "开城而祥"),
    ("举城而降", "举城而祥"),
    ("率众而降", "率众而祥"),
    ("弃城而降", "弃城而祥"),
    ("兵败而降", "兵败而祥"),
    ("势穷而降", "势穷而祥"),
    ("献城而降", "献城而祥"),
    ("降于魏", "祥于魏"),
    ("降于吴", "祥于吴"),
    ("降于汉", "祥于汉"),
    ("降于曹", "祥于曹"),
    ("诈降", "诈祥"),
    ("纳降", "纳祥"),
    ("受降", "受祥"),
    ("归降", "归祥"),
    ("请降", "请祥"),
    ("乞降", "乞祥"),
    ("劝降", "劝祥"),
    ("招降", "招祥"),
    ("降将", "祥匠"),
    ("降卒", "祥族"),
    ("降兵", "祥兵"),
    ("降者", "祥者"),
    ("降表", "祥表"),
    ("降书", "祥书"),
    ("降魏", "祥魏"),
    ("降吴", "祥吴"),
    ("降汉", "祥汉"),
    ("降曹", "祥曹"),
    ("降刘", "祥刘"),
    ("降袁", "祥袁"),
    ("降孙", "祥孙"),
    ("降晋", "祥晋"),
    # 古地名与帝王稿实测误读
    ("月氏", "月支"),
    ("龟兹", "秋慈"),
    ("大宛", "大渊"),
    ("身毒", "元毒"),
    ("并州", "冰州"),
    ("兖州", "演州"),
    ("邺城", "夜城"),
    ("犍为", "前为"),
    ("涪城", "扶城"),
    ("葭萌", "家萌"),
    ("猇亭", "消亭"),
    ("濡须", "如须"),
    ("长坂坡", "常坂坡"),
    ("六安", "路安"),
    ("亳州", "博州"),
    ("夏侯惇", "夏侯蹲"),
    ("许褚", "许楚"),
    ("沮授", "举授"),
    ("审配", "沈配"),
    ("淳于琼", "纯于琼"),
    ("麴义", "屈义"),
    ("蹋顿", "踏顿"),
    ("荀彧", "荀玉"),
    ("张郃", "张合"),
    ("乐进", "岳进"),
    ("赵都", "赵督"),
    ("应天", "硬天"),
    ("圈禁", "娟禁"),
    ("一斗", "一抖"),
    ("在位最长", "在位最常"),
    ("还定", "环定"),
    ("入藏", "入葬"),
    # 2026-10-22 全稿读音审计（tools/audit_pronunciation.py）实测修正
    ("张角", "张绞"),
    ("重文抑武", "众文抑武"),
    ("秦赵燕", "秦赵烟"),
    ("攻燕", "攻烟"),
    ("燕齐", "烟齐"),
    ("轻徭薄赋", "轻徭博赋"),
    ("羯、氐、羌", "羯、低、羌"),
    ("都得了善终", "都得到善终"),
    ("统一只维持", "统一止维持"),
    ("皇帝没了", "皇帝梅了"),
    ("强干弱枝", "强幹弱枝"),
    ("靖难", "靖婻"),
]

PUNCT = "。！？；，、："


def speak_text(text: str) -> str:
    for src, dst in SPEAK_FIXES:
        text = text.replace(src, dst)
    return text


def split_units(line: str) -> list[str]:
    units, buf = [], ""
    for ch in line:
        buf += ch
        if ch in PUNCT:
            units.append(buf)
            buf = ""
    if buf.strip():
        units.append(buf)
    return units


def split_chunks(text: str, max_chars: int = 78) -> list[str]:
    chunks: list[str] = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        cur = ""
        for unit in split_units(line):
            if len(cur) + len(unit) <= max_chars:
                cur += unit
            else:
                if cur:
                    chunks.append(cur)
                while len(unit) > max_chars:
                    cut = unit.rfind("，", 0, max_chars)
                    if cut <= 0:
                        cut = max_chars
                    else:
                        cut += 1
                    chunks.append(unit[:cut])
                    unit = unit[cut:]
                cur = unit
        if cur:
            chunks.append(cur)
    return chunks


def post_tts(server: str, text: str, retries: int = 3) -> bytes:
    payload = json.dumps({"input": text, "speed": 1.0}, ensure_ascii=False).encode("utf-8")
    last = None
    for attempt in range(1, retries + 1):
        req = urllib.request.Request(
            server.rstrip("/") + "/v1/audio/speech",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=600) as resp:
                data = resp.read()
            if len(data) < 2000:
                raise RuntimeError("返回音频过短：%d bytes" % len(data))
            return data
        except Exception as exc:  # noqa: BLE001
            last = exc
            print("  第 %d 次失败：%s" % (attempt, exc), flush=True)
            time.sleep(2 * attempt)
    raise RuntimeError("TTS 请求失败：%s" % last)


def decode_mp3(path: Path, sr: int = 44100) -> bytes:
    proc = subprocess.run(
        [str(FFMPEG), "-hide_banner", "-loglevel", "error", "-i", str(path),
         "-f", "s16le", "-ac", "1", "-ar", str(sr), "pipe:1"],
        capture_output=True,
    )
    if proc.returncode != 0:
        raise RuntimeError("ffmpeg 解码失败：%s" % proc.stderr.decode("utf-8", "replace")[:400])
    return proc.stdout


def trim_silence(pcm: bytes, threshold: int = 220, pad_ms: int = 30, sr: int = 44100) -> bytes:
    import array
    samples = array.array("h")
    samples.frombytes(pcm)
    if not samples:
        return pcm
    step = max(1, sr // 1000)
    first = last = None
    for i in range(0, len(samples), step):
        if abs(samples[i]) > threshold:
            first = i
            break
    for i in range(len(samples) - 1, -1, -step):
        if abs(samples[i]) > threshold:
            last = i
            break
    if first is None or last is None or last <= first:
        return pcm
    pad = int(sr * pad_ms / 1000)
    first = max(0, first - pad)
    last = min(len(samples), last + pad)
    return samples[first:last].tobytes()


def probe_duration(path: Path) -> float:
    proc = subprocess.run(
        [str(FFPROBE), "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
        capture_output=True, text=True,
    )
    return float(proc.stdout.strip())


def main() -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except AttributeError:
        pass

    parser = argparse.ArgumentParser()
    parser.add_argument("--slug", help="用 content/<slug>/<text-name>.txt，避免中文路径被 Windows 命令行转码")
    parser.add_argument("--text-name", default="口播稿", help="配合 --slug，默认「口播稿」")
    parser.add_argument("--text-file", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--server", default="http://127.0.0.1:9880")
    parser.add_argument("--max-chars", type=int, default=78)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--only", type=int, default=0, help="只合成第 N 段（1 起），调试用")
    args = parser.parse_args()

    if args.slug:
        text_file = ROOT / "content" / args.slug / (args.text_name + ".txt")
    elif args.text_file:
        text_file = args.text_file
    else:
        parser.error("需要 --slug 或 --text-file")

    raw = text_file.read_text(encoding="utf-8-sig")
    chunks = split_chunks(raw, args.max_chars)
    if not chunks:
        raise SystemExit("文本为空")

    out = args.out.resolve()
    chunk_dir = out.parent / "narration-chunks"
    chunk_dir.mkdir(parents=True, exist_ok=True)
    sr = 44100

    if args.only:
        chunks = [chunks[args.only - 1]]
        start_index = args.only
    else:
        start_index = 1

    pcm_parts: list[bytes] = []
    meta: list[dict] = []
    gap = b"\x00\x00" * int(sr * 0.02)
    lead = b"\x00\x00" * int(sr * 0.03)
    t = 0.0

    for offset, text in enumerate(chunks):
        index = start_index + offset
        speak = speak_text(text)
        digest = hashlib.sha1(speak.encode("utf-8")).hexdigest()[:12]
        mp3_path = chunk_dir / ("chunk-%03d-%s.mp3" % (index, digest))
        print("[%d/%d] %d字 %s" % (index, start_index + len(chunks) - 1, len(text), text[:24]), flush=True)
        if args.force or not mp3_path.exists():
            data = post_tts(args.server, speak)
            mp3_path.write_bytes(data)
        pcm = trim_silence(decode_mp3(mp3_path, sr), sr=sr)
        if offset > 0:
            pcm_parts.append(gap)
            t += 0.02
        pcm_parts.append(lead)
        t += 0.03
        dur = len(pcm) / 2 / sr
        meta.append({
            "index": index,
            "text": text,
            "speak": speak,
            "chars": len(text),
            "duration": round(dur, 3),
            "start": round(t, 3),
            "end": round(t + dur, 3),
            "chars_per_sec": round(len(text) / dur, 2) if dur else 0,
            "file": mp3_path.name,
        })
        t += dur
        pcm_parts.append(pcm)
        print("       %.2fs  %.2f 字/秒" % (dur, meta[-1]["chars_per_sec"]), flush=True)

    if args.only:
        print("--only 模式不写整条旁白")
        return

    wav_path = out.with_suffix(".wav")
    raw_pcm = b"".join(pcm_parts)
    proc = subprocess.run(
        [str(FFMPEG), "-hide_banner", "-loglevel", "error", "-y",
         "-f", "s16le", "-ar", str(sr), "-ac", "1", "-i", "pipe:0",
         "-c:a", "pcm_s16le", str(wav_path)],
        input=raw_pcm, capture_output=True,
    )
    if proc.returncode != 0:
        raise SystemExit("写 wav 失败：" + proc.stderr.decode("utf-8", "replace")[:400])

    out.parent.mkdir(parents=True, exist_ok=True)
    proc = subprocess.run(
        [str(FFMPEG), "-hide_banner", "-loglevel", "error", "-y",
         "-i", str(wav_path), "-codec:a", "libmp3lame", "-b:a", "192k",
         "-ar", str(sr), "-ac", "1", str(out)],
        capture_output=True,
    )
    if proc.returncode != 0:
        raise SystemExit("写 mp3 失败：" + proc.stderr.decode("utf-8", "replace")[:400])

    total = probe_duration(out)
    result = {
        "audio": str(out),
        "duration_s": round(total, 3),
        "sample_rate": sr,
        "chunks": meta,
        "total_chars": sum(m["chars"] for m in meta),
    }
    json_path = out.with_suffix(".json")
    json_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print("完成：%s，%.2f 秒，%d 段，%d 字" % (out, total, len(meta), result["total_chars"]))
    print("段级元数据：%s" % json_path)


if __name__ == "__main__":
    main()
