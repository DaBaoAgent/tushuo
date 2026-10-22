# -*- coding: utf-8 -*-
"""ditu 管线 · 交付打包器

交付目录顶层只放 4 个文件 + 源文件/：
  tushuo-<slug>.mp4 / 封面-4比3.jpg / 封面-3比4.jpg / 发布信息.txt

用法：
  python tools/ditu/package_delivery.py --job output/<slug>/delivery.json

job 结构：
{
  "out_dir": "D:/@kaifa/tushuo/out/1 蒙古第一次西征",
  "film": {"src": "...", "name": "tushuo-mongol-west-1-5min.mp4"},
  "covers": {"4x3": "...", "3x4": "..."},
  "release_info": "...",
  "sources": [{"src": "...", "name": "..."}, ...]
}
"""
import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path


def run(cmd):
    p = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if p.returncode:
        raise RuntimeError("cmd failed: %s\n%s" % (" ".join(map(str, cmd)), p.stderr[-1000:]))
    return p


def dims(path):
    out = run(["ffprobe", "-v", "error", "-select_streams", "v:0",
               "-show_entries", "stream=width,height", "-of", "csv=p=0", str(path)]).stdout.strip()
    w, h = out.split(",")
    return int(w), int(h)


def validate_release_info(path):
    lines = [l.rstrip("\r") for l in Path(path).read_text(encoding="utf-8-sig").splitlines()]
    lines = [l for l in lines if l.strip()]
    if len(lines) != 2:
        raise ValueError("发布信息.txt 必须恰好两行（标题 + 4 个话题），实际 %d 行" % len(lines))
    tags = lines[1].split()
    if len(tags) != 4 or any(not t.startswith("#") for t in tags):
        raise ValueError("发布信息.txt 第二行必须恰好 4 个 #话题，实际：%r" % lines[1])
    title = lines[0]
    if len(title) > 25:
        raise ValueError("发布信息.txt 标题必须不超过 25 个字（含标点），实际 %d 字：%r"
                         % (len(title), title))
    parts = re.split(r"[：:？?！!]", title, maxsplit=1)
    if len(parts) != 2 or not parts[0].strip() or not parts[1].strip():
        raise ValueError("发布信息.txt 标题必须两段式，用问号、冒号或感叹号分隔：%r" % title)
    if not re.search(r"[0-9]", title):
        raise ValueError("发布信息.txt 标题里的兵力/数量请用阿拉伯数字：%r" % title)
    return lines


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--job", required=True)
    args = ap.parse_args()
    job = json.loads(Path(args.job).read_text(encoding="utf-8-sig"))

    out = Path(job["out_dir"])
    out.mkdir(parents=True, exist_ok=True)
    src_dir = out / "源文件"
    src_dir.mkdir(exist_ok=True)

    film = Path(job["film"]["src"])
    film_name = job["film"].get("name", film.name)
    if not film.exists():
        raise FileNotFoundError(film)
    shutil.copy2(film, out / film_name)

    c43, c34 = Path(job["covers"]["4x3"]), Path(job["covers"]["3x4"])
    if dims(c43) != (2048, 1536):
        raise ValueError("4:3 封面必须 2048x1536，实际 %s" % (dims(c43),))
    if dims(c34) != (1536, 2048):
        raise ValueError("3:4 封面必须 1536x2048，实际 %s" % (dims(c34),))
    shutil.copy2(c43, out / "封面-4比3.jpg")
    shutil.copy2(c34, out / "封面-3比4.jpg")

    lines = validate_release_info(job["release_info"])
    shutil.copy2(job["release_info"], out / "发布信息.txt")

    for item in job.get("sources", []):
        s = Path(item["src"])
        if not s.exists():
            raise FileNotFoundError(s)
        shutil.copy2(s, src_dir / item.get("name", s.name))

    print("delivered -> %s" % out)
    print("  %s" % film_name)
    print("  封面-4比3.jpg / 封面-3比4.jpg / 发布信息.txt")
    print("  源文件/ %d 个" % len(job.get("sources", [])))
    print("  标题：%s" % lines[0])
    print("  话题：%s" % lines[1])


if __name__ == "__main__":
    sys.exit(main())
