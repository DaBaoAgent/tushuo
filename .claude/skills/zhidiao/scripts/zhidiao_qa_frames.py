# -*- coding: utf-8 -*-
"""渲染后抽帧质检：对审计发现过问题的每个 part，在问题场景起始后 2s/4s 抽帧。"""
import re, io, os, json, subprocess

ROOT = "films/china-history-20min"
OUT = "output/china-history-20min/qa-fix2"
os.makedirs(OUT, exist_ok=True)

# 审计发现的问题行（来自 audit_tweens2.py + fix 记录）：part -> [lineno]
FLAGS = {
 "p02":[536,547,548,584,591,595,598], "p03":[281,296,300,311], "p04":[211,215,216,223,228],
 "p05":[326,327,335,345,349,351,355], "p06":[205,206,212,216,217,218,224], "p07":[133,140,147],
 "p08":[253,257,263,264,268,275,280], "p09":[226,228,232,238], "p10":[240,250,272],
 "p11":[211,217,224], "p12":[218,219,223,234,247], "p13":[251,263,265,269,274,275,282],
 "p14":[244,254,259,264,266], "p15":[186,192,209], "p16":[213,215,222,226,235,236,241,247],
 "p17":[199,203,209,220,225], "p18":[188,190,194,205,209], "p19":[167,172,174,180,183,187],
 "p20":[184], "p21":[195,204,206,210,213,220,224,227], "p22":[173,195,202], "p23":[188,194,202],
 "p24":[165,174,182], "p25":[212,219,224,225,230,231,232,233,234,239,240,242,243], "p26":[138,145,146,153,154],
}

for part, linenos in FLAGS.items():
    src = io.open(os.path.join(ROOT, "parts-src", f"{part}-scenes.html"), encoding="utf-8").read()
    lines = src.split("\n")
    # 建立 S序号 -> 行号 映射（找 /* S 注释）
    s_lines = []
    for i, ln in enumerate(lines):
        m = re.search(r"/\* S(\d+)", ln)
        if m: s_lines.append((int(m.group(1)), i))
    def scene_of(lineno):
        idx = 0
        for (s, l) in s_lines:
            if l < lineno - 1: idx = s - 1
        return idx
    man = json.load(open(f"output/china-history-20min/parts/{part}/manifest.json", encoding="utf-8"))
    starts = [s["start"] for s in man["scenes"]]
    durs = [man["duration"]]
    times = set()
    for ln in linenos:
        si = scene_of(ln)
        if si >= len(starts): continue
        t0 = starts[si]
        nxt = starts[si + 1] if si + 1 < len(starts) else t0 + 5
        times.add(round(t0 + (nxt - t0) * 0.35, 1))
        times.add(round(min(t0 + (nxt - t0) * 0.7, nxt - 0.3), 1))
    mp4 = f"renders/china-history-20min-{part}.mp4"
    if not os.path.exists(mp4):
        print(f"{part}: MISSING {mp4}"); continue
    n = 0
    for t in sorted(times):
        subprocess.run(["ffmpeg","-y","-v","error","-ss",str(t),"-i",mp4,"-frames:v","1",
                        "-vf","scale=854:-1",f"{OUT}/{part}-t{t}.png"], capture_output=True)
        n += 1
    print(f"{part}: {n} frames -> {sorted(times)}")
