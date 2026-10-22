# -*- coding: utf-8 -*-
"""修复 manifest captions 重叠 v2：迭代合并 + clamp，直到零重叠。"""
import json, os

ROOT = "output/china-history-20min/parts"
for i in range(2, 27):
    pid = f"p{i:02d}"
    path = os.path.join(ROOT, pid, "manifest.json")
    m = json.load(open(path, encoding="utf-8"))
    caps = sorted(m["captions"], key=lambda c: c["start"])

    rounds = 0
    while True:
        rounds += 1
        fixed = False
        merged = []
        for c in caps:
            if merged and c["start"] < merged[-1]["end"] - 0.01:
                prev = merged[-1]
                if c["start"] - prev["start"] < 1.2:
                    # 挤在一起拆不开 → 合并
                    if c["text"] not in prev["text"]:
                        prev["text"] += c["text"]
                    prev["end"] = max(prev["end"], c["end"])
                    fixed = True
                else:
                    prev["end"] = max(c["start"] - 0.05, prev["start"] + 0.5)
                    merged.append(c)
            else:
                merged.append(c)
        caps = merged
        if not fixed:
            break
        if rounds > 10:
            break

    # 最后保证 end >= start+0.8（末条不 clamp）
    for j, c in enumerate(caps[:-1]):
        c["end"] = min(c["end"], caps[j + 1]["start"] - 0.05)
        c["end"] = max(c["end"], c["start"] + 0.5)

    m["captions"] = caps
    json.dump(m, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(pid, len(caps), "caps")

# 终验
bad = 0
for i in range(2, 27):
    p = f"p{i:02d}"
    m = json.load(open(os.path.join(ROOT, p, "manifest.json"), encoding="utf-8"))
    for a, b in zip(m["captions"], m["captions"][1:]):
        if b["start"] < a["end"] - 0.01:
            bad += 1
            print("STILL", p, a["text"][:10])
print("remaining overlaps:", bad)
