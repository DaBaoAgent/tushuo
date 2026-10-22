# -*- coding: utf-8 -*-
"""读音审计：把口播稿按配音管线（SPEAK_FIXES → GPT-SoVITS 中文前端）过一遍，
逐字列出模型实际会念出的拼音，标出所有多音字与专名，供人工复核。

和 tts_server 走同一条 G2PW 推理路径（不是用 pypinyin 猜），
所以报告里的「实读」就是送进声码器的音节。

用法：
  vendor/gpt-sovits/.venv/Scripts/python.exe tools/audit_pronunciation.py \
      --slug <slug> [--out <path>]
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GSV = ROOT / "vendor" / "gpt-sovits"
sys.path.insert(0, str(GSV / "GPT_SoVITS"))
sys.path.insert(0, str(GSV))
sys.path.insert(0, str(ROOT / "tools"))
os.chdir(GSV)
os.environ.setdefault("bert_path", "GPT_SoVITS/pretrained_models/chinese-roberta-wwm-ext-large")

from pypinyin import pinyin, Style  # noqa: E402

from text import chinese2  # noqa: E402
from text.symbols import punctuation  # noqa: E402
from dabao_batch_tts import speak_text, split_chunks  # noqa: E402


def readings_of(ch: str) -> list[str]:
    if not ("\u4e00" <= ch <= "\u9fff"):
        return []
    try:
        vals = pinyin(ch, style=Style.TONE3, heteronym=True, neutral_tone_with_five=True)
    except Exception:
        return []
    return sorted(set(vals[0])) if vals else []


def seg_pinyins(seg: str) -> list[str]:
    """复刻 chinese2._g2p 的取音路径：G2PW 整句推理 + 词典纠音。"""
    pinyins = chinese2.g2pw._g2pw([seg])[0]
    seg_cut = chinese2.psg.lcut(seg)
    seg_cut = chinese2.tone_modifier.pre_merge_for_modify(seg_cut)
    pre = 0
    out: list[str] = []
    for word, _pos in seg_cut:
        n = len(word)
        wp = pinyins[pre:pre + n]
        wp = chinese2.correct_pronunciation(word, wp)
        out.extend(wp)
        pre += n
    return out


def chunk_pinyins(text: str) -> list[tuple[str, str]]:
    """返回 [(汉字或标点, 拼音)]，按字符顺序。"""
    norm = chinese2.replace_punctuation(text)
    pattern = r"(?<=[{0}])\s*".format("".join(punctuation))
    segments = [s for s in re.split(pattern, norm) if s.strip()]
    result: list[tuple[str, str]] = []
    for seg in segments:
        pys = seg_pinyins(seg)
        if len(pys) != len(seg):
            result.append((seg, "<对不齐>"))
            continue
        result.extend(zip(seg, pys))
    return result


def main() -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except AttributeError:
        pass

    ap = argparse.ArgumentParser()
    ap.add_argument("--slug")
    ap.add_argument("--text-file", type=Path)
    ap.add_argument("--out", type=Path)
    ap.add_argument("--max-chars", type=int, default=78)
    args = ap.parse_args()

    if args.slug:
        text_file = ROOT / "content" / args.slug / "口播稿.txt"
        out = args.out or (ROOT / "output" / args.slug / "读音审计.txt")
    elif args.text_file:
        text_file = args.text_file
        out = args.out or (args.text_file.parent / "读音审计.txt")
    else:
        ap.error("需要 --slug 或 --text-file")

    raw = text_file.read_text(encoding="utf-8-sig")
    chunks = split_chunks(raw, args.max_chars)

    lines: list[str] = []
    poly_rows: list[str] = []
    word_rows: dict[str, list[str]] = {}
    odd_rows: list[str] = []
    total_poly = 0

    lines.append("读音审计：%s" % text_file)
    lines.append("音素 = tools/dabao_batch_tts.py SPEAK_FIXES + GPT-SoVITS chinese2/G2PW（与 TTS 同一路径）")
    lines.append("")

    for idx, text in enumerate(chunks, 1):
        spoken = speak_text(text)
        pairs = chunk_pinyins(spoken)
        disp_py = []
        for ch, py in pairs:
            r = readings_of(ch)
            is_poly = len(r) > 1
            if is_poly:
                total_poly += 1
                poly_rows.append("%03d\t%s\t%s\t%s\t%s" % (idx, ch, py, "/".join(r), spoken))
                disp_py.append("%s%s" % (ch, py))
            else:
                disp_py.append("%s%s" % (ch, py))
            if r and py not in r:
                odd_rows.append("%03d\t%s\t%s\t%s\t%s" % (idx, ch, py, "/".join(r), spoken))
        lines.append("[%03d] %s" % (idx, spoken))
        lines.append("      " + " ".join(disp_py))
        lines.append("")

        # 按词聚合（与 G2PW 相同的 jieba 分词）
        norm = chinese2.replace_punctuation(spoken)
        cur = 0
        for word in chinese2.psg.lcut(norm):
            wchars = list(word)
            if cur + len(wchars) > len(pairs):
                break
            wpy = [pairs[cur + k][1] for k in range(len(wchars))]
            has_poly = any(len(readings_of(c)) > 1 for c in wchars)
            cur += len(wchars)
            if has_poly:
                disp = "%s（%s）" % (word, " ".join(wpy))
                word_rows.setdefault(disp, []).append(str(idx))

    lines.append("")
    lines.append("=" * 60)
    lines.append("一、读音不在字典里的硬异常：%d 处" % len(odd_rows))
    lines.append("段\t字\t实读\t字典读法\t上下文")
    lines.extend(odd_rows)

    lines.append("")
    lines.append("二、多音字所在词（去重，按首现顺序）：%d 个" % len(word_rows))
    for disp, idxs in word_rows.items():
        lines.append("%s  ×%d  段%s" % (disp, len(idxs), ",".join(idxs[:8])))

    lines.append("")
    lines.append("三、多音字逐处清单（%d 处）" % total_poly)
    lines.append("段\t字\t实读\t全部读法\t上下文")
    lines.extend(poly_rows)

    out.write_text("\n".join(lines), encoding="utf-8")
    print("已写：%s（%d 段，多音字 %d 处，硬异常 %d 处）" % (out, len(chunks), total_poly, len(odd_rows)))


if __name__ == "__main__":
    main()
