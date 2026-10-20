"""把 GPT-SoVITS 配音接入 HyperFrames 的 audio_meta.json。

faceless-explainer / product-launch 的音频步骤原本自己跑 TTS；本项目改用
tools/gpt_sovits_tts.py 生成旁白后，用本脚本把旁白和词级转写登记进
audio_meta.json，后续 sync-durations / captions / assemble 直接消费。

用法：
  npx hyperframes transcribe narration.wav --model small --language zh --dir films/guandu
  python tools/hf_audio_meta.py --hyperframes films/guandu \
      --audio assets/voice/narration.wav --words transcript.json --frame-id 1
"""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path
import subprocess
import sys


def probe_duration(path: Path) -> float:
    proc = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
        capture_output=True, text=True,
    )
    try:
        return float(proc.stdout.strip())
    except ValueError:
        raise SystemExit(f"ffprobe 读不到时长：{path}")


def normalize_words(raw: list[dict]) -> list[dict]:
    words = []
    for index, word in enumerate(raw, 1):
        if not isinstance(word, dict):
            raise SystemExit(f"第 {index} 个词不是对象")
        text = str(word.get("text", "")).strip()
        try:
            start = float(word.get("start", 0))
            end = float(word.get("end", 0))
        except (TypeError, ValueError):
            raise SystemExit(f"第 {index} 个词的时间戳不是数字")
        if not text:
            raise SystemExit(f"第 {index} 个词文本为空")
        if not 0 <= start < end:
            raise SystemExit(f"第 {index} 个词时间区间无效：{start}-{end}")
        words.append({
            "id": word.get("id") or f"w{index - 1}",
            "text": text,
            "start": start,
            "end": end,
        })
    return words


def main() -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except AttributeError:
        pass

    parser = argparse.ArgumentParser()
    parser.add_argument("--hyperframes", type=Path, default=Path.cwd(),
                        help="HyperFrames composition 根目录（audio_meta.json 所在处）")
    parser.add_argument("--audio", type=Path, required=True, help="旁白音频")
    parser.add_argument("--words", type=Path, help="hyperframes transcribe 输出的词级 JSON")
    parser.add_argument("--frame-id", type=int, default=1, help="对应分镜编号（整数），默认 1")
    parser.add_argument("--out", type=Path, help="默认 <hyperframes>/audio_meta.json")
    args = parser.parse_args()

    root = args.hyperframes.resolve()
    audio = args.audio.resolve()
    out = args.out or root / "audio_meta.json"
    if not audio.exists():
        raise SystemExit(f"旁白音频不存在：{audio}")

    words: list[dict] = []
    if args.words:
        if not args.words.exists():
            raise SystemExit(f"词级转写文件不存在：{args.words}")
        data = json.loads(args.words.read_text(encoding="utf-8-sig"))
        if isinstance(data, dict):
            if "chunks" in data:
                raise SystemExit(
                    "--words 需要 hyperframes transcribe 生成的 transcript.json（扁平词表），"
                    "不能传 GPT-SoVITS 的分段元数据（含 chunks 的 narration.json）。"
                )
            data = data.get("words") or data.get("segments")
            if data is None:
                raise SystemExit("--words JSON 里找不到 words/segments 数组")
        if not isinstance(data, list):
            raise SystemExit("--words JSON 必须是扁平词表数组")
        words = normalize_words(data)
        if not words:
            raise SystemExit("--words 文件里没有词级时间戳，检查 transcribe 是否成功")
    else:
        print("未提供 --words：audio_meta.json 的 words 为空，字幕对时将不可用。")

    meta = {"voices": [], "bgm": None, "sfx": []}
    if out.exists():
        meta = json.loads(out.read_text(encoding="utf-8-sig"))
        meta.setdefault("voices", [])
        meta.setdefault("bgm", None)
        meta.setdefault("sfx", [])

    try:
        rel = audio.relative_to(root).as_posix()
    except ValueError:
        dest_dir = root / "assets" / "voice"
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest = dest_dir / audio.name
        if dest.resolve() != audio:
            shutil.copy2(audio, dest)
        rel = dest.relative_to(root).as_posix()
        print(f"旁白不在 composition 内，已复制到 {dest}")

    def frame_of(entry: dict) -> int | None:
        for key in ("frame", "id"):
            try:
                return int(entry.get(key))
            except (TypeError, ValueError):
                continue
        return None

    voice = {
        "id": f"{args.frame_id:02d}",
        "frame": args.frame_id,
        "path": rel,
        "duration_s": round(probe_duration(audio), 3),
        "words": words,
    }
    voices = [v for v in meta["voices"] if frame_of(v) != args.frame_id]
    voices.append(voice)
    meta["voices"] = sorted(voices, key=lambda v: frame_of(v) if frame_of(v) is not None else 10**9)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"写入 {out}：frame {args.frame_id}，{voice['duration_s']} 秒，{len(words)} 个词")


if __name__ == "__main__":
    main()
