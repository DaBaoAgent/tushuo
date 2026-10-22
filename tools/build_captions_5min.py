# -*- coding: utf-8 -*-
"""把 5 分钟口播拆成 <=15 字单行字幕，并按 TTS 分段时码回写。

优先读 narration.json（dabao_batch_tts.py 产出，含每段 start/end）；
没有时按 5.55 字/秒估算。字幕文字去标点，与原稿逐字一致。

用法：
  python tools/build_captions_5min.py --slug mongol-west-1-5min \
      --composition films/mongol-west-1-5min/index.html
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUNCT = "，。！？；：、"
SENT = "。！？；"

# 硬切时不要把专名或常用词劈成两半
PROTECT = [
    "成吉思汗", "术赤", "察合台", "窝阔台", "拖雷", "讹答剌", "亦纳勒术",
    "花剌子模", "摩诃末", "布哈拉", "撒马尔罕", "札兰丁", "八鲁湾", "印度河",
    "哲别", "速不台", "蒙古", "草原", "骑兵", "使者", "商队", "苏丹", "工匠",
    "战象", "锡尔河", "阿姆河", "帕米尔", "里海", "阿富汗",
]


def clean(text: str) -> str:
    return "".join(ch for ch in text if ch not in PUNCT and ch not in "“”\"'（）()《》——…")


def split_sentence(sentence: str, max_chars: int = 15) -> list[str]:
    """先按逗号等切，再按字数均衡切，保证每条 <= max_chars 且不留单字尾巴。"""
    pieces: list[str] = []
    for part in re.findall(r"[^，、：]*[，、：]?", sentence):
        part = part.strip()
        if not part:
            continue
        total = len(clean(part))
        if total > max_chars:
            # 先决定切几刀，再按均分长度切，避免出现「15 字 + 1 字」
            count_parts = (total + max_chars - 1) // max_chars
            size = (total + count_parts - 1) // count_parts
            while len(clean(part)) > max_chars:
                idx = [i for i, ch in enumerate(part) if ch not in PUNCT]
                cs = "".join(part[i] for i in idx)
                forbidden: set[int] = set()
                for term in PROTECT:
                    start = 0
                    while True:
                        k = cs.find(term, start)
                        if k < 0:
                            break
                        forbidden.update(range(k + 1, k + len(term)))
                        start = k + 1
                cut = min(size, len(cs))
                while cut > 1 and cut in forbidden:
                    cut -= 1
                if cut < 1:
                    cut = min(size, len(cs))
                cut_o = idx[cut - 1] + 1
                while cut_o < len(part) and part[cut_o] in PUNCT:
                    cut_o += 1
                pieces.append(part[:cut_o])
                part = part[cut_o:].lstrip("，、：")
        if clean(part):
            pieces.append(part)
    return pieces


def split_chunk(text: str, max_chars: int = 15) -> list[str]:
    out: list[str] = []
    for sentence in re.findall(r"[^。！？；]*[。！？；]?", text):
        if not clean(sentence):
            continue
        out.extend(split_sentence(sentence, max_chars))
    return out


def main() -> None:
    import sys
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except AttributeError:
        pass

    parser = argparse.ArgumentParser()
    parser.add_argument("--slug", default="mongol-west-1-5min")
    parser.add_argument("--composition", type=Path, required=True)
    parser.add_argument("--max-chars", type=int, default=15)
    parser.add_argument("--json-out", type=Path)
    args = parser.parse_args()

    content_dir = ROOT / "content" / args.slug
    out_dir = ROOT / "output" / args.slug
    narration_json = out_dir / "narration.json"
    raw = (content_dir / "口播稿.txt").read_text(encoding="utf-8-sig")

    if narration_json.exists():
        data = json.loads(narration_json.read_text(encoding="utf-8-sig"))
        chunks = data["chunks"]
    else:
        chunks = []
        t = 0.0
        for line in raw.splitlines():
            line = line.strip()
            if not line:
                continue
            for sentence in re.findall(r"[^。！？；]*[。！？；]?", line):
                if not clean(sentence):
                    continue
                dur = len(clean(sentence)) / 5.55
                chunks.append({"text": sentence, "start": t, "end": t + dur})
                t += dur + 0.08
        print("没有 narration.json，按时长估算")

    caps: list[dict] = []
    for chunk_index, chunk in enumerate(chunks, 1):
        text = chunk["text"]
        start = float(chunk["start"])
        dur = max(0.2, float(chunk["end"]) - start)
        total = max(1, len(clean(text)))
        cursor = 0
        for piece in split_chunk(text, args.max_chars):
            shown = clean(piece)
            if not shown:
                continue
            # 在原文里定位这一条（按字符顺序消费，忽略标点）
            consumed = 0
            pos = cursor
            while pos < len(text) and consumed < len(shown):
                if text[pos] not in PUNCT:
                    consumed += 1
                pos += 1
            # 把尾部标点并入本条时间
            while pos < len(text) and text[pos] in PUNCT:
                pos += 1
            c0 = sum(1 for ch in text[:cursor] if ch not in PUNCT)
            c1 = sum(1 for ch in text[:pos] if ch not in PUNCT)
            t0 = start + dur * c0 / total
            t1 = start + dur * c1 / total
            if caps and t0 < caps[-1]["end"]:
                t0 = caps[-1]["end"]
            caps.append({
                "t": round(t0, 3),
                "end": round(max(t0 + 0.3, t1), 3),
                "text": shown,
                "chunk": chunk_index,
            })
            cursor = pos

    # 防止相邻条重叠
    for i in range(len(caps) - 1):
        if caps[i]["end"] > caps[i + 1]["t"]:
            caps[i]["end"] = caps[i + 1]["t"]

    json_out = args.json_out or (out_dir / "captions.json")
    json_out.parent.mkdir(parents=True, exist_ok=True)
    json_out.write_text(json.dumps(caps, ensure_ascii=False, indent=2), encoding="utf-8")

    lines = []
    for cap in caps:
        text = cap["text"].replace("\\", "\\\\").replace('"', '\\"')
        lines.append('  { t: %s, end: %s, text: "%s" },' % (cap["t"], cap["end"], text))
    block = "\n".join(lines)

    comp = args.composition
    html = comp.read_text(encoding="utf-8")
    begin = "const CAPS = ["
    end = "];"
    i = html.find(begin)
    if i < 0:
        raise SystemExit("composition 里找不到 const CAPS = [")
    j = html.find(end, i)
    if j < 0:
        raise SystemExit("composition 里找不到 CAPS 结束标记 ];")
    html = html[:i] + begin + "\n" + block + "\n" + html[j:]
    comp.write_text(html, encoding="utf-8")

    print("字幕 %d 条，写入 %s 与 %s" % (len(caps), json_out, comp))
    longest = max(len(c["text"]) for c in caps)
    print("最长 %d 字；末条结束 %.2fs" % (longest, caps[-1]["end"]))


if __name__ == "__main__":
    main()
