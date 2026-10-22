# -*- coding: utf-8 -*-
"""用当前 shots-full.json 生成一个无声 QA composition，供 hyperframes snapshot 抽静帧。"""
import json
import re
import shutil
from pathlib import Path

ROOT = Path(r"D:/@kaifa/tushuo")
SLUG = "china-emperors-20min"
SRC = ROOT / "films" / SLUG
DST = ROOT / "films" / "china-emperors-qa"
OUT = ROOT / "output" / SLUG


def replace_block(html, name, body):
    start = html.index("const %s = " % name)
    tail = "\n];" if name != "CUE" else "\n};"
    end = html.index(";\n", html.index(tail, start))
    return html[:start] + "const %s = %s" % (name, body) + html[end:]


html = (SRC / "index.html").read_text(encoding="utf-8")
shots = json.loads((ROOT / "content" / SLUG / "shots-full.json").read_text(encoding="utf-8"))
caps = json.loads((OUT / "build" / "captions-full.json").read_text(encoding="utf-8"))
film_end = round(shots[-1]["t1"], 3)

html = replace_block(html, "SHOTS", json.dumps(shots, ensure_ascii=False, indent=1))
cap_body = "[\n" + ",\n".join(
    "  { t: %s, end: %s, text: %s }" % (c["t"], c["end"], json.dumps(c["text"], ensure_ascii=False))
    for c in caps) + "\n]"
html = replace_block(html, "CAPS", cap_body)
html = replace_block(html, "CUE", json.dumps({"total": round(film_end - 5.4, 3), "filmEnd": film_end}))
html = re.sub(r'id="root"[^>]*data-duration="[0-9.]+"',
              'id="root" data-duration="%.3f"' % film_end, html, count=1)
html = re.sub(r'\s*<audio id="vo"[^>]*></audio>', "", html, count=1)

DST.mkdir(parents=True, exist_ok=True)
(DST / "assets").mkdir(exist_ok=True)
(DST / "vendor").mkdir(exist_ok=True)
shutil.copy2(SRC / "assets/papercut.js", DST / "assets/papercut.js")
shutil.copy2(SRC / "vendor/gsap.min.js", DST / "vendor/gsap.min.js")
(DST / "index.html").write_text(html, encoding="utf-8")
print("qa composition:", DST / "index.html", len(html), "bytes, filmEnd", film_end)

# 抽样时刻：每条分镜中点，按幕均匀挑
picks = [1, 3, 6, 9, 12, 16, 21, 24, 30, 34, 41, 44, 50, 52, 57, 61, 65, 70, 80, 86,
         93, 100, 108, 115, 121, 124, 128, 129, 136, 141, 147, 153, 156, 163, 168, 173,
         177, 184, 190, 192, 194, 203, 208, 211, 219, 222, 229, 236, 242, 244, 250, 256,
         262, 266, 269, 274, 280, 283, 288, 295, 299, 304, 308, 314, 319, 325, 330, 335,
         340, 343, 347, 352, 355, 358, 362, 366, 370]
times = []
for i in picks:
    s = shots[i - 1]
    times.append(round((s["t0"] + s["t1"]) * 0.5, 2))
(OUT / "build" / "qa-times.txt").write_text(",".join(str(t) for t in times), encoding="utf-8")
print("snapshot times:", len(times))
print(",".join(str(t) for t in times))
