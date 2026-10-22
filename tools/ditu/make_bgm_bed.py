# -*- coding: utf-8 -*-
"""ditu 管线 · BGM 床生成器

把一条短 BGM 用 4 秒交叉淡化拼到成片长度，加轻压缩，首尾淡入淡出。
电平不在这里归一：交给 mix_audio.py 按 bgm_target_lufs 统一校准。

用法：
  python tools/ditu/make_bgm_bed.py \
    --source "assets/bgm/二战 BGM_documentary.mp3" \
    --output output/<slug>/audio/bgm_bed.wav --duration 305.955
"""
import argparse
import subprocess
from pathlib import Path


def run(cmd):
    p = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if p.returncode:
        raise RuntimeError("cmd failed: %s\n%s" % (" ".join(map(str, cmd)), (p.stderr or "")[-2000:]))
    return p


def probe_duration(path):
    out = run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
               "-of", "csv=p=0", str(path)]).stdout.strip()
    return float(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", required=True)
    ap.add_argument("--output", required=True)
    ap.add_argument("--duration", required=True, type=float)
    ap.add_argument("--crossfade", type=float, default=4.0)
    ap.add_argument("--second-start", type=float, default=5.0,
                    help="第 2 段起的起点（秒），避开原曲开头的淡入")
    ap.add_argument("--compressor", default="threshold=-20dB:ratio=2:attack=25:release=500")
    ap.add_argument("--fade-in", type=float, default=2.0)
    ap.add_argument("--fade-out", type=float, default=3.5)
    args = ap.parse_args()

    src = Path(args.source)
    dst = Path(args.output)
    if not src.exists():
        raise FileNotFoundError(src)
    dst.parent.mkdir(parents=True, exist_ok=True)

    src_dur = probe_duration(src)
    step = src_dur - args.second_start
    if step <= args.crossfade:
        raise ValueError("原曲太短或 --second-start 太大，无法交叉淡化循环")
    n = 1
    while src_dur + (n - 1) * step < args.duration:
        n += 1

    parts = [f"[0:a]atrim=0:{src_dur:.3f},asetpts=PTS-STARTPTS[s1]"]
    for i in range(2, n + 1):
        parts.append(f"[0:a]atrim={args.second_start:.3f}:{src_dur:.3f},asetpts=PTS-STARTPTS[s{i}]")
    last = "s1"
    for i in range(2, n + 1):
        tag = f"t{i - 1}"
        parts.append(f"[{last}][s{i}]acrossfade=d={args.crossfade}:c1=tri:c2=tri[{tag}]")
        last = tag
    trim_len = min(args.duration, src_dur + (n - 1) * step - (n - 1) * args.crossfade)
    fade_out_st = max(0.0, args.duration - args.fade_out)
    parts.append(
        f"[{last}]atrim=0:{trim_len:.3f},asetpts=PTS-STARTPTS,"
        f"acompressor={args.compressor},"
        f"afade=t=in:st=0:d={args.fade_in},"
        f"afade=t=out:st={fade_out_st:.3f}:d={args.fade_out},"
        f"apad=whole_dur={args.duration:.3f},"
        f"aformat=sample_rates=48000:channel_layouts=stereo[out]")

    run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(src),
         "-filter_complex", ";".join(parts), "-map", "[out]",
         "-ar", "48000", "-ac", "2", "-c:a", "pcm_s24le", str(dst)])
    print("wrote %s (%.3f s, %d segments, src %.3f s)" % (dst, probe_duration(dst), n, src_dur))


if __name__ == "__main__":
    main()
