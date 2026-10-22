# -*- coding: utf-8 -*-
"""ditu 管线 · 成片质检门禁

检查：容器/流规格、时长、帧数、全片解码、黑帧、积分响度与真峰值、封面尺寸。
用法：
  python tools/ditu/qa_film.py --film "out/1 蒙古第一次西征/tushuo-xxx.mp4" \
    --duration 305.955 --cover-4x3 "out/.../封面-4比3.jpg" --cover-3x4 "out/.../封面-3比4.jpg"
"""
import argparse
import json
import re
import subprocess
import sys


def run(cmd, check=True):
    p = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if check and p.returncode:
        raise RuntimeError("cmd failed: %s\n%s" % (" ".join(map(str, cmd)), (p.stderr or "")[-2000:]))
    return p


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--film", required=True)
    ap.add_argument("--duration", type=float, required=True)
    ap.add_argument("--cover-4x3")
    ap.add_argument("--cover-3x4")
    ap.add_argument("--fps", type=float, default=30.0)
    ap.add_argument("--width", type=int, default=1920)
    ap.add_argument("--height", type=int, default=1080)
    args = ap.parse_args()
    ok = True
    report = ["# ditu 成片质检", "", "## 规格", ""]

    probe = json.loads(run(["ffprobe", "-v", "error", "-show_streams", "-show_format",
                            "-of", "json", args.film]).stdout)
    v = next(s for s in probe["streams"] if s["codec_type"] == "video")
    a = next(s for s in probe["streams"] if s["codec_type"] == "audio")
    dur = float(probe["format"]["duration"])
    frames = int(v.get("nb_frames", "0") or 0)
    expected_frames = int(round(args.duration * args.fps))
    checks = [
        ("视频编码", v.get("codec_name") in ("h264", "hevc"), v.get("codec_name")),
        ("分辨率", (v.get("width"), v.get("height")) == (args.width, args.height),
         "%sx%s" % (v.get("width"), v.get("height"))),
        ("帧率", v.get("avg_frame_rate") in ("30/1", "30/1"), v.get("avg_frame_rate")),
        ("时长", abs(dur - args.duration) <= 0.05, "%.3f s（目标 %.3f）" % (dur, args.duration)),
        ("帧数", abs(frames - expected_frames) <= 1, "%d（目标 %d）" % (frames, expected_frames)),
        ("音频编码", a.get("codec_name") == "aac", a.get("codec_name")),
        ("采样率/声道", (a.get("sample_rate"), a.get("channels")) == ("48000", 2),
         "%s Hz / %s ch" % (a.get("sample_rate"), a.get("channels"))),
    ]
    for name, passed, detail in checks:
        ok = ok and passed
        report.append("- [%s] %s：%s" % ("PASS" if passed else "FAIL", name, detail))

    p = run(["ffmpeg", "-v", "error", "-xerror", "-i", args.film, "-f", "null", "-"], check=False)
    passed = p.returncode == 0
    ok = ok and passed
    report += ["", "## 解码与画面", "", "- [%s] 全片解码" % ("PASS" if passed else "FAIL")]
    if not passed:
        report.append("```\n%s\n```" % (p.stderr or "")[-1000:])

    p = run(["ffmpeg", "-hide_banner", "-nostats", "-i", args.film, "-vf",
             "blackdetect=d=0.1:pix_th=0.10", "-an", "-f", "null", "-"], check=False)
    passed = "black_start" not in (p.stderr or "")
    ok = ok and passed
    report.append("- [%s] 无黑帧（blackdetect d=0.1 pix_th=0.10）"
                  % ("PASS" if passed else "FAIL"))

    err = run(["ffmpeg", "-hide_banner", "-nostats", "-i", args.film,
               "-af", "ebur128=peak=true", "-f", "null", "-"], check=False).stderr
    tail = err[err.rfind("Summary:"):] if "Summary:" in err else err
    m_i = re.search(r"I:\s*(-?[0-9.]+) LUFS", tail)
    m_tp = re.search(r"Peak:\s*(-?[0-9.]+) dBFS", tail)
    lufs = float(m_i.group(1)) if m_i else float("nan")
    tp = float(m_tp.group(1)) if m_tp else float("nan")
    passed = (-17.5 <= lufs <= -15.0) and (-3.0 <= tp <= -0.3)
    ok = ok and passed
    report += ["", "## 电平", "",
               "- [%s] 积分响度 %.1f LUFS（门禁 -17.5～-15.0）" % ("PASS" if -17.5 <= lufs <= -15.0 else "FAIL", lufs),
               "- [%s] 真峰值 %.1f dBFS（门禁 -3.0～-0.3）" % ("PASS" if -3.0 <= tp <= -0.3 else "FAIL", tp)]

    for label, path, size in (("封面 4:3", args.cover_4x3, (2048, 1536)),
                              ("封面 3:4", args.cover_3x4, (1536, 2048))):
        if not path:
            continue
        p = run(["ffprobe", "-v", "error", "-select_streams", "v:0",
                 "-show_entries", "stream=width,height", "-of", "csv=p=0", path], check=False)
        dims = (p.stdout or "").strip()
        passed = dims == "%d,%d" % size
        ok = ok and passed
        report.append("- [%s] %s：%s（目标 %dx%d）" % ("PASS" if passed else "FAIL", label, dims, *size))

    report += ["", "## 结论", "", "**%s**" % ("PASS" if ok else "FAIL")]
    print("\n".join(report))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
