# -*- coding: utf-8 -*-
"""jianying 管线 · 行号驱动字幕与场景时码

规则：
- 每行口播 = 一个 chunk；字幕按标点切句，每句 <= --max-chars 字，去掉标点。
- 硬校验：所有字幕拼接后必须与原文去标点后逐字一致。
- CUE 由 cue-map.json 的行号声明推出，不再依赖关键词匹配。

用法：
  python tools/jianying/build_captions.py --script content/<slug>/口播稿.txt \
    --narration-json output/<slug>/narration-v1.json --out-dir output/<slug>/review \
    --variation v1 --cue-map content/<slug>/cue-map.json

cue-map.json：
  {
    "_filmEndOffset": 5.4,
    "hookEnd": {"line": 7, "edge": "end"},
    "p1": {"line": 9}
  }
  `line` 从 1 开始；默认取该行起点，`edge` 为 `end` 时取该行终点。
  以 `_` 开头的键是配置，不写进 CUE。
"""
import argparse
import io
import json
import re
from pathlib import Path

PUNCT = "。！？；，、："
SPLIT = "。！？；，："


def split_long(cl, max_chars):
    """超长分句按自然停顿切成两半，优先落在「了 / 的」之后。"""
    target = len(cl) / 2
    cands = [i + 1 for i, ch in enumerate(cl) if ch in "了的"]
    cands = [i for i in cands if 4 <= i <= len(cl) - 4]
    cut = min(cands, key=lambda i: abs(i - target)) if cands else max_chars
    return cl[:cut], cl[cut:]


def split_caption(line, max_chars):
    clauses = [c.strip() for c in re.split("[%s]" % re.escape(SPLIT), line) if c.strip()]
    pieces = []
    for cl in clauses:
        cl = "".join(ch for ch in cl if ch not in PUNCT)
        while len(cl) > max_chars:
            a, b = split_long(cl, max_chars)
            pieces.append(a)
            cl = b
        if cl:
            pieces.append(cl)
    return pieces


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--script", required=True)
    ap.add_argument("--narration-json", required=True)
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--variation", default="v1")
    ap.add_argument("--max-chars", type=int, default=14)
    ap.add_argument("--cue-map", default=None)
    ap.add_argument("--film-end-offset", type=float, default=5.4)
    ap.add_argument("--js-prefix", default=None, help="另存 CAPS/CUE JS 片段的前缀路径")
    args = ap.parse_args()

    script = Path(args.script)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    lines = [l.strip() for l in io.open(script, encoding="utf-8-sig") if l.strip()]
    data = json.loads(Path(args.narration_json).read_text(encoding="utf-8-sig"))
    chunks = data["chunks"]
    if len(lines) != len(chunks):
        raise SystemExit("行数 %d != chunk 数 %d" % (len(lines), len(chunks)))
    for i, (line, c) in enumerate(zip(lines, chunks)):
        if line != c["text"].strip():
            raise SystemExit("第 %d 行不一致：\n  原文 %s\n  chunk %s" % (i + 1, line, c["text"]))

    caps = []
    for line, c in zip(lines, chunks):
        clean = "".join(ch for ch in line if ch not in PUNCT)
        pieces = split_caption(line, args.max_chars)
        if "".join(pieces) != clean:
            raise SystemExit("拼接不一致：%s -> %s" % (line, pieces))
        total_chars = sum(len(p) for p in pieces)
        t = c["start"]
        span = c["end"] - c["start"]
        for p in pieces:
            d = span * len(p) / total_chars
            caps.append({"t": round(t, 3), "end": round(t + d, 3), "text": p})
            t += d

    total = round(chunks[-1]["end"], 3)
    cue = {"total": total, "filmEnd": round(total + args.film_end_offset, 3)}
    if args.cue_map:
        spec = json.loads(Path(args.cue_map).read_text(encoding="utf-8-sig"))
        offset = spec.pop("_filmEndOffset", args.film_end_offset)
        cue["filmEnd"] = round(total + offset, 3)
        for key, item in spec.items():
            if key.startswith("_"):
                continue
            n = int(item["line"])
            if not 1 <= n <= len(chunks):
                raise SystemExit("cue %s 行号越界：%d" % (key, n))
            cue[key] = chunks[n - 1]["end" if item.get("edge") == "end" else "start"]
        cue = {k: round(v, 3) for k, v in cue.items()}

    caps_path = out_dir / ("captions-%s.json" % args.variation)
    cue_path = out_dir / ("cue-%s.json" % args.variation)
    caps_path.write_text(json.dumps(caps, ensure_ascii=False, indent=1), encoding="utf-8")
    cue_path.write_text(json.dumps(cue, ensure_ascii=False, indent=2), encoding="utf-8")

    if args.js_prefix:
        prefix = Path(args.js_prefix)
        prefix.parent.mkdir(parents=True, exist_ok=True)
        cap_js = "const CAPS = [\n" + "".join(
            '  { t: %s, end: %s, text: "%s" },\n' % (c["t"], c["end"], c["text"]) for c in caps
        ) + "];\n"
        prefix.with_name(prefix.name + "-caps.js").write_text(cap_js, encoding="utf-8")
        cue_lines = ["const CUE = {"]
        items = list(cue.items())
        for i, (k, v) in enumerate(items):
            cue_lines.append("  %s: %s%s" % (k, v, "," if i < len(items) - 1 else ""))
        cue_lines.append("};")
        prefix.with_name(prefix.name + "-cue.js").write_text("\n".join(cue_lines) + "\n",
                                                            encoding="utf-8")

    print("lines %d, captions %d, last cap end %.3f" % (len(lines), len(caps), caps[-1]["end"]))
    print("narration total %.3f, filmEnd %.3f" % (total, cue["filmEnd"]))
    print("max caption chars %d" % max(len(c["text"]) for c in caps))
    print("wrote", caps_path.name, cue_path.name)


if __name__ == "__main__":
    main()
