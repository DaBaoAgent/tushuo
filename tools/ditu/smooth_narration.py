# -*- coding: utf-8 -*-
"""ditu 管线 · 旁白停顿压紧

把 TTS 原始分段的段内长停顿压紧（默认 0.75x、上限 0.35 s、下限 0.10 s），
并重新拼接成一条 wav + mp3，同时回写段级时间码。

用法：
  python tools/ditu/smooth_narration.py \
    --raw-json output/<slug>/narration-v1.json \
    --chunks-dir output/<slug>/narration-chunks \
    --out output/<slug>/narration-v1-smooth

输出：
  <out>.json  平滑后的段级元数据（chunks 的 start/end/duration 已更新）
  <out>-raw.json  原始元数据备份（若不存在则写入）
  <out>.wav / <out>.mp3
"""
import argparse
import array
import json
import shutil
import subprocess
from pathlib import Path

SR = 44100
THR = 220


def decode(ffmpeg, path, sr):
    raw = subprocess.run([ffmpeg, "-hide_banner", "-loglevel", "error", "-i", str(path),
                          "-f", "s16le", "-ac", "1", "-ar", str(sr), "pipe:1"],
                         capture_output=True, check=True).stdout
    a = array.array("h")
    a.frombytes(raw)
    return a


def trim(a, sr, thr, pad_ms):
    step = max(1, sr // 1000)
    first = last = None
    for i in range(0, len(a), step):
        if abs(a[i]) > thr:
            first = i
            break
    for i in range(len(a) - 1, -1, -step):
        if abs(a[i]) > thr:
            last = i
            break
    if first is None or last is None or last <= first:
        return a
    pad = int(sr * pad_ms / 1000)
    return a[max(0, first - pad):min(len(a), last + pad)]


def compress_pauses(a, sr, thr, pause_min, pause_cap, pause_scale):
    runs = []
    start = None
    for i, v in enumerate(a):
        if abs(v) <= thr:
            if start is None:
                start = i
        else:
            if start is not None:
                runs.append((start, i))
                start = None
    if start is not None:
        runs.append((start, len(a)))
    min_len = int(sr * 0.12)
    out = array.array("h")
    pos = 0
    changed = 0
    saved = 0
    for s, e in runs:
        n = e - s
        if n < min_len:
            continue
        out.extend(a[pos:s])
        target = int(min(n, sr * pause_cap, max(sr * pause_min, n * pause_scale)))
        if target < n:
            changed += 1
            saved += n - target
        out.extend(a[s:s + target])
        pos = e
    out.extend(a[pos:])
    return out, changed, saved / sr


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw-json", required=True)
    ap.add_argument("--chunks-dir", required=True)
    ap.add_argument("--out", required=True, help="输出前缀，不含扩展名")
    ap.add_argument("--ffmpeg", default="ffmpeg")
    ap.add_argument("--sample-rate", type=int, default=SR)
    ap.add_argument("--thr", type=int, default=THR)
    ap.add_argument("--pad-ms", type=int, default=30)
    ap.add_argument("--gap-ms", type=int, default=12)
    ap.add_argument("--lead-ms", type=int, default=18)
    ap.add_argument("--pause-min", type=float, default=0.10)
    ap.add_argument("--pause-cap", type=float, default=0.35)
    ap.add_argument("--pause-scale", type=float, default=0.75)
    ap.add_argument("--mp3-bitrate", default="192k")
    args = ap.parse_args()

    sr = args.sample_rate
    raw_json = Path(args.raw_json)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out_json = out.with_suffix(".json")
    raw_backup = out.parent / (out.name + "-raw.json")
    chunks_dir = Path(args.chunks_dir)
    wav = out.with_suffix(".wav")
    mp3 = out.with_suffix(".mp3")

    data = json.loads(raw_json.read_text(encoding="utf-8-sig"))
    chunks = data["chunks"]
    raw_total = data.get("duration_s")
    if not raw_backup.exists():
        shutil.copy2(raw_json, raw_backup)

    gap = array.array("h", [0]) * int(sr * args.gap_ms / 1000)
    lead = array.array("h", [0]) * int(sr * args.lead_ms / 1000)
    parts = []
    t = 0.0
    total_changed = 0
    total_saved = 0.0
    for i, c in enumerate(chunks):
        pcm = trim(decode(args.ffmpeg, chunks_dir / c["file"], sr), sr, args.thr, args.pad_ms)
        pcm, changed, saved = compress_pauses(
            pcm, sr, args.thr, args.pause_min, args.pause_cap, args.pause_scale)
        total_changed += changed
        total_saved += saved
        if i:
            parts.append(gap)
            t += args.gap_ms / 1000
        parts.append(lead)
        t += args.lead_ms / 1000
        dur = len(pcm) / sr
        c["duration"] = round(dur, 3)
        c["start"] = round(t, 3)
        c["end"] = round(t + dur, 3)
        c["chars_per_sec"] = round(len(c["text"]) / dur, 2) if dur else 0
        t += dur
        parts.append(pcm)

    raw = array.array("h")
    for p in parts:
        raw.extend(p)
    total = len(raw) / sr

    subprocess.run([args.ffmpeg, "-y", "-hide_banner", "-loglevel", "error", "-f", "s16le",
                    "-ar", str(sr), "-ac", "1", "-i", "pipe:0", "-c:a", "pcm_s16le",
                    str(wav)], input=raw.tobytes(), check=True)
    subprocess.run([args.ffmpeg, "-y", "-hide_banner", "-loglevel", "error", "-i", str(wav),
                    "-codec:a", "libmp3lame", "-b:a", args.mp3_bitrate, "-ar", str(sr),
                    "-ac", "1", str(mp3)], check=True)

    data["audio"] = str(mp3).replace("\\", "/")
    data["duration_s"] = round(total, 3)
    out_json.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    print("raw %ss -> smoothed %.3fs (saved %.1fs)" % (raw_total, total, (raw_total or 0) - total))
    print("pause runs compressed: %d, silence saved: %.1fs" % (total_changed, total_saved))
    print("chunks:", len(chunks), "gap", args.gap_ms, "ms, lead", args.lead_ms, "ms")
    print("wrote", out_json.name, wav.name, mp3.name)


if __name__ == "__main__":
    main()
