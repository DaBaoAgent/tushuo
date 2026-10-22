# -*- coding: utf-8 -*-
"""ditu 管线 · 定稿混音器

口播 + BGM 床 + 场景音效 -> 48 kHz 立体声 soundtrack.wav / .mp3

配置见 output/<slug>/audio/mix-v3.json 之类的文件：
  narration / bgm / sfx_dir / total / output
  narration_target_lufs（默认 -16.0）/ bgm_target_lufs（默认 -34.0）
  sfx: [{t, file}, ...]

所有电平闭合校准：口播迭代到目标 LUFS，BGM 按实测积分响度反推增益，
总混音过限幅器，不靠猜。
"""
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path


def run(cmd, capture=True):
    p = subprocess.run(cmd, capture_output=capture, text=True, encoding="utf-8", errors="replace")
    if p.returncode:
        raise RuntimeError("cmd failed: %s\n%s" % (" ".join(map(str, cmd)), (p.stderr or "")[-2000:]))
    return p


def loudness(path):
    err = run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path),
               "-af", "ebur128=peak=true", "-f", "null", "-"]).stderr
    tail = err[err.rfind("Summary:"):] if "Summary:" in err else err
    out = {}
    for line in tail.splitlines():
        s = line.strip()
        if s.startswith("I:"):
            out["I"] = float(s.split()[1])
        elif s.startswith("LRA:"):
            out["LRA"] = float(s.split()[1])
        elif s.startswith("Peak:") and "dBFS" in s:
            out["TP"] = float(s.split()[1])
    if "I" not in out:
        raise RuntimeError("ebur128 解析失败: %s" % tail[-400:])
    return out


def render_voice(narr, gain, limit, dst):
    chain = ("aresample=48000,pan=stereo|c0=c0|c1=c0,"
             "volume=%.2fdB,alimiter=limit=%s:level=false" % (gain, limit))
    run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(narr),
         "-af", chain, "-c:a", "pcm_s24le", str(dst)])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", required=True)
    args = ap.parse_args()
    cfg = json.loads(Path(args.config).read_text(encoding="utf-8-sig"))

    narr = Path(cfg["narration"])
    bgm = Path(cfg["bgm"])
    sfx_dir = Path(cfg["sfx_dir"])
    total = float(cfg["total"])
    output = Path(cfg["output"])
    nar_target = float(cfg.get("narration_target_lufs", -16.0))
    bgm_target = float(cfg.get("bgm_target_lufs", -34.0))
    nar_limit = cfg.get("voice_peak_limit", 0.8414)
    mix_limit = cfg.get("mix_peak_limit", 0.8414)
    anchors = cfg["sfx"]
    output.parent.mkdir(parents=True, exist_ok=True)
    voice_chain = output.parent / "voice_chain.wav"

    for p in (narr, bgm):
        if not p.exists():
            raise FileNotFoundError(p)
    for a in anchors:
        f = sfx_dir / a["file"]
        if not f.exists():
            raise FileNotFoundError(f)
        if float(a["t"]) >= total:
            raise ValueError("音效锚点超出片长: %s @ %.2fs" % (a["file"], a["t"]))

    nar = loudness(narr)
    bgm_l = loudness(bgm)
    # 单声道复制双声道会带来约 +3 dB，先扣掉再闭环校准
    nar_gain = nar_target - (nar["I"] + 3.0)
    voice_now = None
    for _ in range(5):
        render_voice(narr, nar_gain, nar_limit, voice_chain)
        voice_now = loudness(voice_chain)
        if abs(voice_now["I"] - nar_target) <= 0.15:
            break
        nar_gain += nar_target - voice_now["I"]
    bgm_gain = bgm_target - bgm_l["I"]

    parts = [
        "[0:a]aresample=48000,pan=stereo|c0=c0|c1=c0,"
        "volume=%.2fdB,alimiter=limit=%s:level=false[nar]" % (nar_gain, nar_limit),
        "[1:a]volume=%.2fdB[bgm]" % bgm_gain,
    ]
    labels = "[nar][bgm]"
    for i, a in enumerate(anchors):
        ms = int(round(float(a["t"]) * 1000))
        parts.append("[%d:a]adelay=%d|%d[s%d]" % (i + 2, ms, ms, i + 1))
        labels += "[s%d]" % (i + 1)
    parts.append(
        "%samix=inputs=%d:duration=longest:normalize=0,"
        "atrim=0:%.3f,asetpts=N/SR/TB,"
        "alimiter=limit=%s:level=false[out]"
        % (labels, len(anchors) + 2, total, mix_limit))

    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
           "-i", str(narr), "-i", str(bgm)]
    for a in anchors:
        cmd += ["-i", str(sfx_dir / a["file"])]
    cmd += ["-filter_complex", ";".join(parts), "-map", "[out]",
            "-ar", "48000", "-ac", "2", "-c:a", "pcm_s24le", str(output)]
    run(cmd)

    mp3 = output.with_suffix(".mp3")
    run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(output),
         "-c:a", "libmp3lame", "-b:a", "320k", str(mp3)])

    final = loudness(output)
    probe = json.loads(run(["ffprobe", "-v", "error", "-show_entries",
                           "format=duration:stream=sample_rate,channels,codec_name",
                           "-of", "json", str(output)]).stdout)
    dur = float(probe["format"]["duration"])

    report = [
        "# ditu 混音报告",
        "",
        "- 口播：%s" % narr,
        "- 口播原始：I %.1f LUFS / TP %.1f dBFS / LRA %.1f LU" % (nar["I"], nar["TP"], nar["LRA"]),
        "- 口播增益：%+.2f dB → 立体声链 I %.1f LUFS / TP %.1f dBFS（目标 %.1f）"
        % (nar_gain, voice_now["I"], voice_now["TP"], nar_target),
        "- BGM：%s" % bgm,
        "- BGM 原始：I %.1f LUFS / TP %.1f dBFS / LRA %.1f LU" % (bgm_l["I"], bgm_l["TP"], bgm_l["LRA"]),
        "- BGM 增益：%+.2f dB → 目标 %.1f LUFS" % (bgm_gain, bgm_target),
        "- 音效：%d 个锚点" % len(anchors),
        "- 输出：%s（%.3f s，%s Hz %s ch）"
        % (output.name, dur, probe["streams"][0]["sample_rate"], probe["streams"][0]["channels"]),
        "- 成品：I %.1f LUFS / TP %.1f dBFS / LRA %.1f LU"
        % (final["I"], final["TP"], final["LRA"]),
        "",
        "## 锚点",
        "",
    ]
    for i, a in enumerate(anchors, 1):
        report.append("%02d  %7.2fs  %s" % (i, float(a["t"]), Path(a["file"]).stem[3:]))
    (output.parent / "mix-report.md").write_text("\n".join(report), encoding="utf-8")
    print("\n".join(report[:12]))


if __name__ == "__main__":
    sys.exit(main())
