# -*- coding: utf-8 -*-
"""jianying 管线 · 把 shots.json 注入 HyperFrames composition

用法：
  python tools/jianying/splice_shots.py --html films/<slug>/index.html \
    --shots content/<slug>/shots.json --backup-dir output/<slug>/_backup-shots

规则：
- `const SHOTS = [` 到 `\n];\n` 整块替换；
- 可选 `--duration` 更新根节点 data-duration；不传则取最后一个 shot 的 t1 + 5.4。
- 注入前做最小 schema 校验：id/t0/t1/type 必填，t1 > t0，shots 按 t0 递增。
"""
import argparse
import json
import re
import shutil
from pathlib import Path


def validate(shots):
    if not isinstance(shots, list) or not shots:
        raise SystemExit("shots.json 必须是非空数组")
    prev = -1
    ids = set()
    for i, s in enumerate(shots):
        if not isinstance(s, dict):
            raise SystemExit("shot[%d] 不是对象" % i)
        for k in ("id", "t0", "t1", "type"):
            if k not in s:
                raise SystemExit("shot[%d] 缺字段 %s" % (i, k))
        if s["id"] in ids:
            raise SystemExit("shot id 重复：%s" % s["id"])
        ids.add(s["id"])
        t0, t1 = float(s["t0"]), float(s["t1"])
        if t1 <= t0:
            raise SystemExit("shot %s 的 t1 <= t0" % s["id"])
        if t0 < prev - 1e-6:
            raise SystemExit("shot 未按 t0 递增：%s" % s["id"])
        prev = t0
        if "camera" in s:
            c = s["camera"]
            for edge in ("from", "to"):
                if edge in c and not isinstance(c[edge], dict):
                    raise SystemExit("shot %s camera.%s 必须是对象" % (s["id"], edge))
    return shots


def replace_block(html, start_marker, end_marker, new, label):
    start = html.find(start_marker)
    if start < 0:
        raise SystemExit("%s 起点未找到：%s" % (label, start_marker))
    end = html.find(end_marker, start + len(start_marker))
    if end < 0:
        raise SystemExit("%s 终点未找到：%s" % (label, end_marker))
    end += len(end_marker)
    return html[:start] + new.rstrip("\n") + "\n" + html[end:]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--html", required=True)
    ap.add_argument("--shots", required=True)
    ap.add_argument("--backup-dir", default=None)
    ap.add_argument("--duration", type=float, default=None)
    args = ap.parse_args()

    html_path = Path(args.html)
    html = html_path.read_text(encoding="utf-8")
    shots = validate(json.loads(Path(args.shots).read_text(encoding="utf-8-sig")))

    if args.backup_dir:
        bdir = Path(args.backup_dir)
        bdir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(html_path, bdir / html_path.name)

    block = "const SHOTS = " + json.dumps(shots, ensure_ascii=False, indent=1) + ";"
    html = replace_block(html, "const SHOTS = [", "\n];\n", block, "SHOTS")

    duration = args.duration if args.duration is not None else float(shots[-1]["t1"]) + 5.4
    html, n = re.subn(r'(<div id="root"[^>]*data-duration=")[0-9.]+(")',
                      lambda m: m.group(1) + ("%.3f" % duration) + m.group(2), html)
    if n != 1:
        raise SystemExit("root data-duration 锚点应恰好 1 处，实际 %d" % n)

    html_path.write_text(html, encoding="utf-8")
    print("spliced %d shots -> %s (filmEnd %.3f)" % (len(shots), html_path, duration))


if __name__ == "__main__":
    main()
