# -*- coding: utf-8 -*-
"""jianying 管线 · 长音频分段转写（可断点续跑）

把 1–3 小时的源音频按 --chunk-seconds 切段，用 faster-whisper 逐段转写，
每段落一个 JSON；全部完成后合并成：

  <out>.segments.json   段级 [{start,end,text}]
  <out>.txt             带时间码的可读全文
  <out>.plain.txt       纯文本（无时间码）

用法：
  python tools/jianying/transcribe_long.py --audio output/<slug>/source-16k.mp3 \
    --out output/<slug>/源文全量转写 --chunk-seconds 600 --model small

断点：已存在且未标记 done 的段会重跑；done 段直接复用。
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
FFMPEG = ROOT / "vendor" / "gpt-sovits" / "runtime" / "ffmpeg.exe"
LOCAL_MODELS = {"small": ROOT / "vendor" / "faster-whisper-small"}


def decode_pcm16k(path: Path, start: float, duration: float | None):
    import numpy as np

    cmd = [str(FFMPEG), "-hide_banner", "-loglevel", "error",
           "-ss", "%.3f" % start]
    if duration is not None:
        cmd += ["-t", "%.3f" % duration]
    cmd += ["-i", str(path), "-f", "f32le", "-ac", "1", "-ar", "16000", "pipe:1"]
    proc = subprocess.run(cmd, capture_output=True)
    if proc.returncode != 0:
        raise SystemExit("ffmpeg 解码失败：" + proc.stderr.decode("utf-8", "replace")[:400])
    return np.frombuffer(proc.stdout, dtype=np.float32)


def audio_duration(path: Path) -> float:
    proc = subprocess.run(
        [str(ROOT / "vendor" / "gpt-sovits" / "runtime" / "ffprobe.exe"),
         "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
        capture_output=True, text=True,
    )
    return float(proc.stdout.strip())


def fmt(sec: float) -> str:
    sec = int(round(sec))
    return "%02d:%02d:%02d" % (sec // 3600, (sec % 3600) // 60, sec % 60)


def main() -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except AttributeError:
        pass

    ap = argparse.ArgumentParser()
    ap.add_argument("--audio", "-a", type=Path, required=True)
    ap.add_argument("--out", "-o", type=Path, required=True, help="输出前缀，不含扩展名")
    ap.add_argument("--chunk-seconds", type=float, default=600)
    ap.add_argument("--model", default="small")
    ap.add_argument("--language", default="zh")
    ap.add_argument("--initial-prompt", default="以下是中国历史讲解，涉及历代皇帝、朝代、年号、战役与地名。")
    ap.add_argument("--beam-size", type=int, default=5)
    ap.add_argument("--no-vad", action="store_true")
    ap.add_argument("--threads", type=int, default=0, help="CPU 线程数（0=自动 min(8,核数)）")
    ap.add_argument("--offset", type=float, default=0.0, help="给所有时间戳加固定偏移（秒）")
    args = ap.parse_args()

    audio = args.audio.resolve()
    if not audio.exists():
        raise SystemExit("音频不存在：%s" % audio)
    total = audio_duration(audio)
    out = args.out
    out.parent.mkdir(parents=True, exist_ok=True)
    parts_dir = out.parent / (out.name + "-chunks")
    parts_dir.mkdir(parents=True, exist_ok=True)

    from faster_whisper import WhisperModel

    model_arg = LOCAL_MODELS.get(args.model, args.model)
    model = WhisperModel(
        str(model_arg), device="cpu", compute_type="int8",
        cpu_threads=args.threads or min(8, os.cpu_count() or 4),
    )

    n = max(1, int((total + args.chunk_seconds - 1) // args.chunk_seconds))
    all_segments: list[dict] = []
    for i in range(n):
        local = i * args.chunk_seconds
        start = args.offset + local
        dur = min(args.chunk_seconds, total - local)
        part = parts_dir / ("%03d.json" % i)
        if part.exists():
            data = json.loads(part.read_text(encoding="utf-8"))
            if data.get("done"):
                all_segments.extend(data["segments"])
                print("[skip] %03d %.0f-%.0f s, %d segs" % (i, start, start + dur, len(data["segments"])))
                continue
        print("[asr ] %03d %.0f-%.0f s" % (i, start, start + dur), flush=True)
        pcm = decode_pcm16k(audio, local, dur)
        segments, info = model.transcribe(
            pcm, language=args.language, beam_size=args.beam_size,
            word_timestamps=False, vad_filter=not args.no_vad,
            condition_on_previous_text=False,
            initial_prompt=args.initial_prompt or None,
        )
        segs = []
        for s in segments:
            text = (s.text or "").strip()
            if not text:
                continue
            segs.append({
                "start": round(start + float(s.start), 3),
                "end": round(start + float(s.end), 3),
                "text": text,
            })
        part.write_text(json.dumps({"done": True, "segments": segs}, ensure_ascii=False, indent=1),
                        encoding="utf-8")
        all_segments.extend(segs)
        print("      -> %d segs, last %s" % (len(segs), fmt(segs[-1]["end"]) if segs else "-"), flush=True)

    all_segments.sort(key=lambda x: x["start"])
    (out.parent / (out.name + ".segments.json")).write_text(
        json.dumps(all_segments, ensure_ascii=False, indent=1), encoding="utf-8")
    lines = ["[%s - %s] %s" % (fmt(s["start"]), fmt(s["end"]), s["text"]) for s in all_segments]
    (out.parent / (out.name + ".txt")).write_text("\n".join(lines) + "\n", encoding="utf-8")
    (out.parent / (out.name + ".plain.txt")).write_text(
        "\n".join(s["text"] for s in all_segments) + "\n", encoding="utf-8")
    print("done: %d segments, audio %.1f s -> %s" % (len(all_segments), total, out))


if __name__ == "__main__":
    main()
