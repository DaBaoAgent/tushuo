# -*- coding: utf-8 -*-
"""ditu 管线 · 把字幕/场景时码/时间线拼进 HyperFrames composition

用法：
  python tools/ditu/splice_film.py --html films/<slug>/index.html \
    --caps-js output/<slug>/review/_v1-caps.js \
    --cue-js output/<slug>/review/_v1-cue.js \
    --cue-json output/<slug>/review/cue-v1.json \
    --timeline-js output/<slug>/review/_v1-timeline.js \
    --voice-src output/<slug>/narration-v1.mp3 \
    --voice-dest films/<slug>/assets/voice/narration.mp3 \
    --backup-dir output/<slug>/_backup-v1

规则：
- `const CAPS = [...]` 整块替换；
- `const CUE = {...}` 整块替换（不存在时插在 CAPS 之后）；
- `function buildTimeline() {` 到 `buildCaptions();` 之间整块替换（可选）；
- 根节点与 `<audio id="vo">` 的 data-duration 按 cue.json 的 filmEnd / total 更新。
"""
import argparse
import json
import re
import shutil
from pathlib import Path


def replace_block(html, start_marker, end_marker, new, label):
    start = html.find(start_marker)
    if start < 0:
        raise SystemExit("%s 起点未找到：%s" % (label, start_marker))
    end = html.find(end_marker, start + len(start_marker))
    if end < 0:
        raise SystemExit("%s 终点未找到：%s" % (label, end_marker))
    end += len(end_marker)
    return html[:start] + new.rstrip("\n") + "\n" + html[end:]


def set_attr(html, pattern, value, label):
    rx = re.compile(pattern % r'[^"]*')
    matches = rx.findall(html)
    if len(matches) != 1:
        raise SystemExit("%s 锚点应恰好 1 处，实际 %d" % (label, len(matches)))
    return rx.sub(lambda m: m.group(1) + value + m.group(3), html)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--html", required=True)
    ap.add_argument("--caps-js", required=True)
    ap.add_argument("--cue-js", required=True)
    ap.add_argument("--cue-json", required=True)
    ap.add_argument("--timeline-js", default=None)
    ap.add_argument("--voice-src", default=None)
    ap.add_argument("--voice-dest", default=None)
    ap.add_argument("--backup-dir", default=None)
    ap.add_argument("--output", default=None, help="默认原文件就地更新")
    args = ap.parse_args()

    html_path = Path(args.html)
    html = html_path.read_text(encoding="utf-8")
    cue = json.loads(Path(args.cue_json).read_text(encoding="utf-8-sig"))
    caps_js = Path(args.caps_js).read_text(encoding="utf-8")
    cue_js = Path(args.cue_js).read_text(encoding="utf-8")

    html = replace_block(html, "const CAPS = [", "\n];\n", caps_js, "CAPS")
    if "const CUE = {" in html:
        html = replace_block(html, "const CUE = {", "\n};\n", cue_js, "CUE")
    else:
        pos = html.find(caps_js.rstrip("\n"))
        if pos < 0:
            raise SystemExit("插入 CUE 失败：CAPS 未写入")
        pos += len(caps_js.rstrip("\n")) + 1
        html = html[:pos] + cue_js.rstrip("\n") + "\n" + html[pos:]

    if args.timeline_js:
        timeline = Path(args.timeline_js).read_text(encoding="utf-8")
        start = html.find("function buildTimeline() {")
        end = html.find("\nbuildCaptions();", start)
        if start < 0 or end < 0:
            raise SystemExit("buildTimeline 锚点未找到")
        html = html[:start] + timeline.rstrip("\n") + "\n\nbuildCaptions();" + html[end + len("\nbuildCaptions();"):]

    html = set_attr(html, r'(<div id="root"[^>]*data-duration=")(%s)(")', "%s" % cue["filmEnd"],
                    "根节点 data-duration")
    html = set_attr(html, r'(<audio id="vo"[^>]*data-duration=")(%s)(")', "%s" % cue["total"],
                    "音频 data-duration")

    out_path = Path(args.output) if args.output else html_path
    if args.backup_dir and out_path == html_path:
        backup = Path(args.backup_dir)
        backup.mkdir(parents=True, exist_ok=True)
        shutil.copy2(html_path, backup / "index-before-splice.html")
    out_path.write_text(html, encoding="utf-8")

    if args.voice_src:
        if not args.voice_dest:
            raise SystemExit("指定 --voice-src 时必须同时给 --voice-dest")
        shutil.copy2(args.voice_src, args.voice_dest)

    print("spliced -> %s (root %s, audio %s)" % (out_path, cue["filmEnd"], cue["total"]))
    print("CAPS entries:", html.count("{ t:"))
    if args.voice_src:
        print("voice -> %s" % args.voice_dest)


if __name__ == "__main__":
    main()
