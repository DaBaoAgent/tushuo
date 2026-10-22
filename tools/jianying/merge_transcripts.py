# -*- coding: utf-8 -*-
"""jianying 管线 · 合并多个 transcribe_long 分段结果

各部分用 --offset 写入绝对时间戳，这里只做排序、去重叠、输出统一三种文件。

用法：
  python tools/jianying/merge_transcripts.py --out output/<slug>/transcript \
    output/<slug>/transcript-p1.segments.json output/<slug>/transcript-p2.segments.json
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def fmt(sec: float) -> str:
    sec = int(round(sec))
    return "%02d:%02d:%02d" % (sec // 3600, (sec % 3600) // 60, sec % 60)


def main() -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except AttributeError:
        pass
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, required=True, help="输出前缀，不含扩展名")
    ap.add_argument("parts", nargs="+", type=Path)
    args = ap.parse_args()

    segs: list[dict] = []
    for p in args.parts:
        segs.extend(json.loads(p.read_text(encoding="utf-8")))
    segs.sort(key=lambda x: (x["start"], x["end"]))

    # 去掉边界处互相重叠的重复句子（同一句被前后两段各转一次）
    merged: list[dict] = []
    for s in segs:
        if merged:
            prev = merged[-1]
            same = s["text"].strip() == prev["text"].strip()
            if same and abs(s["start"] - prev["start"]) < 1.5:
                continue
            if s["start"] < prev["start"] - 1e-6:
                continue
        merged.append(s)

    out = args.out
    out.parent.mkdir(parents=True, exist_ok=True)
    (out.parent / (out.name + ".segments.json")).write_text(
        json.dumps(merged, ensure_ascii=False, indent=1), encoding="utf-8")
    (out.parent / (out.name + ".txt")).write_text(
        "\n".join("[%s - %s] %s" % (fmt(s["start"]), fmt(s["end"]), s["text"]) for s in merged) + "\n",
        encoding="utf-8")
    (out.parent / (out.name + ".plain.txt")).write_text(
        "\n".join(s["text"] for s in merged) + "\n", encoding="utf-8")
    print("merged %d parts -> %d segments, %s" % (len(args.parts), len(merged), out))


if __name__ == "__main__":
    main()
