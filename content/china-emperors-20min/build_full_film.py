# -*- coding: utf-8 -*-
"""把 director_full.py 的 370 条分镜 + 旁白对时，组装成全片 composition。

用法：
  python build_full_film.py --timing output/china-emperors-20min/narration-smooth.json
  python build_full_film.py --estimate          # 配音未完成时用估时先出画面
  python build_full_film.py --timing <json> --compose

输出：
  content/china-emperors-20min/shots-full.json
  output/china-emperors-20min/build/captions-full.json
  --compose 时重写 films/china-emperors-20min/index.html 的 SHOTS/CAPS/CUE/时长
"""
from __future__ import annotations

import argparse
import importlib.util
import io
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(r"D:/@kaifa/tushuo")
SLUG = "china-emperors-20min"
CONTENT = ROOT / "content" / SLUG
OUT = ROOT / "output" / SLUG
FILM = ROOT / "films" / SLUG
PY = Path(r"D:/@kaifa/openviking/.venv/Scripts/python.exe")

TAIL = 6.0  # 最后一句之后留给片尾卡的时间（endcard 5.4s + 0.6s 呼吸）


def load_director():
    spec = importlib.util.spec_from_file_location("director_full", CONTENT / "director_full.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def script_lines() -> list[str]:
    return [l.strip() for l in io.open(CONTENT / "口播稿.txt", encoding="utf-8-sig") if l.strip()]


def estimate_chunks(lines: list[str]) -> dict:
    chunks = []
    t = 0.0
    for i, line in enumerate(lines):
        if i:
            t += 0.03
        t += 0.018
        dur = max(1.2, len(line) / 5.4)
        chunks.append({"index": i + 1, "text": line, "start": round(t, 3),
                       "end": round(t + dur, 3), "duration": round(dur, 3)})
        t += dur
    return {"chunks": chunks, "duration_s": round(t, 3), "estimated": True}


def resolve_scene(mod, scene):
    name, opts = scene if isinstance(scene, tuple) else (scene, {})
    fn = getattr(mod, "sc_" + name)
    return fn(**opts)


def build_shots(mod, chunks: list[dict]) -> tuple[list[dict], float]:
    beats = mod.BEATS
    if len(chunks) != 370:
        raise SystemExit("chunk 数不是 370：%d" % len(chunks))
    shots = []
    for i, c in enumerate(chunks):
        idx = i + 1
        b = beats.get(idx)
        if not b:
            raise SystemExit("缺第 %d 条分镜" % idx)
        t0 = max(0.0, c["start"] - 0.02) if i else 0.0
        t1 = (chunks[i + 1]["start"] - 0.01) if i + 1 < len(chunks) else c["end"] + TAIL
        name = b["scene"][0] if isinstance(b["scene"], tuple) else b["scene"]
        shot = {
            "id": "s%03d" % idx,
            "t0": round(t0, 3),
            "t1": round(t1, 3),
            "type": name,
            "camera": mod.camera(b["cam"]),
            "layers": resolve_scene(mod, b["scene"]),
            "chars": b["chars"],
        }
        if b.get("title"):
            shot["title"] = b["title"]
        if b.get("kicker"):
            shot["kicker"] = b["kicker"]
        if b.get("sub"):
            shot["subtitle"] = b["sub"]
        if b.get("hook"):
            shot["hook"] = True
        if b.get("wipe"):
            shot["wipe"] = True
        shots.append(shot)
    total = chunks[-1]["end"]
    film_end = round(total + TAIL, 3)
    return shots, film_end


def build_captions(chunks: list[dict]) -> list[dict]:
    tmp = OUT / "build"
    tmp.mkdir(parents=True, exist_ok=True)
    nj = tmp / "narration-build.json"
    nj.write_text(json.dumps({"chunks": chunks, "duration_s": chunks[-1]["end"]},
                             ensure_ascii=False, indent=1), encoding="utf-8")
    subprocess.run([str(PY), str(ROOT / "tools/ditu/build_captions.py"),
                    "--script", str(CONTENT / "口播稿.txt"),
                    "--narration-json", str(nj),
                    "--out-dir", str(tmp), "--variation", "full",
                    "--max-chars", "16"], check=True)
    return json.loads((tmp / "captions-full.json").read_text(encoding="utf-8"))


def replace_block(html: str, name: str, body: str) -> str:
    start = html.index("const %s = " % name)
    tail = "\n];" if name != "CUE" else "\n};"
    end = html.index(";\n", html.index(tail, start))
    return html[:start] + "const %s = %s" % (name, body) + html[end:]


def compose(shots: list[dict], caps: list[dict], film_end: float, narration: Path,
            narration_dur: float) -> None:
    html = (FILM / "index.html").read_text(encoding="utf-8")
    html = replace_block(html, "SHOTS", json.dumps(shots, ensure_ascii=False, indent=1))
    cap_body = "[\n" + ",\n".join(
        "  { t: %s, end: %s, text: %s }" % (
            c["t"], c["end"], json.dumps(c["text"], ensure_ascii=False)) for c in caps) + "\n]"
    html = replace_block(html, "CAPS", cap_body)
    html = replace_block(html, "CUE", json.dumps(
        {"total": round(film_end - 5.4, 3), "filmEnd": film_end}, ensure_ascii=False))
    html = re.sub(r'id="root"[^>]*data-duration="[0-9.]+"',
                  'id="root" data-duration="%.3f"' % film_end, html, count=1)
    html = re.sub(r'(<audio id="vo"[^>]*data-duration=")[0-9.]+(")',
                  r"\g<1>%.3f\g<2>" % narration_dur, html, count=1)
    (FILM / "index.html").write_text(html, encoding="utf-8")

    dst = FILM / "assets/voice/narration.mp3"
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(narration, dst)
    print("composed:", FILM / "index.html", len(html), "bytes")
    print("filmEnd %.3f, narration %.3f" % (film_end, narration_dur))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--timing", default=None)
    ap.add_argument("--estimate", action="store_true")
    ap.add_argument("--compose", action="store_true")
    args = ap.parse_args()

    lines = script_lines()
    if args.estimate:
        data = estimate_chunks(lines)
        narration = None
    else:
        tj = Path(args.timing) if args.timing else OUT / "narration-smooth.json"
        data = json.loads(tj.read_text(encoding="utf-8-sig"))
        narration = Path(data.get("audio") or OUT / "narration-smooth.mp3")
        if not narration.is_absolute():
            narration = (ROOT / narration).resolve()

    chunks = data["chunks"]
    if len(chunks) != len(lines):
        raise SystemExit("行数 %d != chunk 数 %d" % (len(lines), len(chunks)))
    for i, (line, c) in enumerate(zip(lines, chunks)):
        if line != c["text"].strip():
            raise SystemExit("第 %d 行不一致：\n  %s\n  %s" % (i + 1, line, c["text"]))

    mod = load_director()
    shots, film_end = build_shots(mod, chunks)
    (CONTENT / "shots-full.json").write_text(
        json.dumps(shots, ensure_ascii=False, indent=1), encoding="utf-8")
    caps = build_captions(chunks)
    print("shots %d, caps %d, captions max %d 字, filmEnd %.3f" % (
        len(shots), len(caps), max(len(c["text"]) for c in caps), film_end))
    print("duration %.2f min" % (film_end / 60))

    if args.compose:
        if args.estimate or narration is None:
            raise SystemExit("--estimate 只能出 JSON，不能 compose（没有配音）")
        compose(shots, caps, film_end, narration,
                float(data.get("duration_s") or chunks[-1]["end"]))


if __name__ == "__main__":
    main()
