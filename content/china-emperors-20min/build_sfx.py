# -*- coding: utf-8 -*-
"""按分镜类型给全片铺场景音效，并生成 ditu 口径混音配置。

规则：每类场景一个音效池，同类冷却时间控制密度；幕标题卡单独上号角；
开场三下（重击 / 鼓点 / 钟声）与 30 秒审核片一致。

输出：
  output/china-emperors-20min/audio/sfx/*.wav     预处理后的音效片段（48k 立体声）
  output/china-emperors-20min/audio/sfx-plan.json 全部锚点
  output/china-emperors-20min/audio/mix-full.json ditu mix_audio.py 配置

用法：
  python content/china-emperors-20min/build_sfx.py --total 1406.411
"""
import argparse
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(r"D:/@kaifa/tushuo")
SLUG = "china-emperors-20min"
CONTENT = ROOT / "content" / SLUG
OUT = ROOT / "output" / SLUG
LIB = ROOT / "音效"

# 类别：候选素材、冷却秒数、时长、峰值目标、淡出
CATS = {
    "battle": dict(files=["两军厮杀声", "古代战场厮杀的声音", "战场厮杀", "千军万马打仗的声音",
                          "冷兵器打斗", "战场冲锋陷阵嘶喊声", "战场厮杀声音", "两军厮杀声1"],
                   cool=10.0, dur=2.8, peak=-9, fade_in=.1, fade_out=.5),
    "fire": dict(files=["大火燃烧", "熊熊烈火", "火持续燃烧", "燃烧"],
                 cool=12.0, dur=2.6, peak=-10, fade_in=.12, fade_out=.5),
    "water": dict(files=["海浪", "水拍浪", "水中划桨", "划水声", "海边浪声"],
                  cool=12.0, dur=2.8, peak=-11, fade_in=.3, fade_out=.6),
    "wind": dict(files=["风声", "大风", "寒风", "强烈的风声", "大风1"],
                 cool=18.0, dur=3.0, peak=-13, fade_in=.5, fade_out=.8),
    "horse": dict(files=["战马嘶吼", "马车行进", "马叫"],
                  cool=13.0, dur=2.4, peak=-11, fade_in=.1, fade_out=.5),
    "gong": dict(files=["上朝当啷一声", "古代排钟", "钟声"],
                 cool=32.0, dur=2.6, peak=-12, fade_in=.05, fade_out=.8),
    "gate": dict(files=["古代木门推开的声音", "旗帜声"],
                 cool=22.0, dur=1.8, peak=-13, fade_in=.05, fade_out=.4),
    "market": dict(files=["古代集市", "古代吃饭的声音"],
                   cool=24.0, dur=2.4, peak=-14, fade_in=.3, fade_out=.5),
    "blade": dict(files=["挥刀", "金属兵器碰撞", "刀剑出鞘"],
                  cool=16.0, dur=1.6, peak=-11, fade_in=.03, fade_out=.35),
    "horn": dict(files=["号角", "进攻号角", "牛号角"],
                 cool=26.0, dur=2.6, peak=-9, fade_in=.1, fade_out=.6),
}

TYPE_CAT = {
    "battle": "battle", "burning": "fire", "execution": "blade",
    "sea": "water", "harbor": "water", "river": "water",
    "wall": "wind", "plain": "wind", "steppe": "wind", "snow": "wind",
    "tomb": "wind", "pass": "wind",
    "cavalry": "horse",
    "camp": "horn",
    "court": "gong", "palace": "gong", "feast": "gong", "twothrones": "gong",
    "temple": "gong",
    "city": "gate", "market": "market",
}


def run(cmd):
    p = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if p.returncode:
        raise RuntimeError("cmd failed: %s\n%s" % (" ".join(map(str, cmd)), (p.stderr or "")[-1500:]))
    return p.stderr


def find_file(stem):
    hits = sorted(LIB.glob(stem + ".mp3"))
    if not hits:
        raise FileNotFoundError("音效库缺 %s.mp3" % stem)
    return hits[0]


def peak_db(path):
    err = run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path),
               "-af", "volumedetect", "-f", "null", "-"])
    m = re.search(r"max_volume:\s*(-?[0-9.]+) dB", err)
    if not m:
        raise RuntimeError("volumedetect 失败: %s" % path)
    return float(m.group(1))


def prep(src, dst, dur, peak, fade_in, fade_out):
    if dst.exists():
        return
    g = max(-18.0, min(18.0, peak - peak_db(src)))
    af = ("silenceremove=start_periods=1:start_threshold=-45dB:start_duration=0.02,"
          "atrim=0:%.2f,asetpts=N/SR/TB,"
          "afade=t=in:st=0:d=%.2f,"
          "afade=t=out:st=%.2f:d=%.2f,"
          "volume=%.1fdB,aresample=48000" % (dur, fade_in, max(0.0, dur - fade_out), fade_out, g))
    run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(src),
         "-af", af, "-ac", "2", "-c:a", "pcm_s24le", str(dst)])


def has_shape(shot, names):
    for layer in shot.get("layers") or []:
        for p in layer.get("props") or []:
            if p.get("shape") in names:
                return True
    return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--total", type=float, default=None, help="成片时长；默认取末镜 t1 + 5.4（片尾卡）")
    args = ap.parse_args()

    shots = json.loads((CONTENT / "shots-full.json").read_text(encoding="utf-8"))
    total = args.total or round(shots[-1]["t1"] + 5.4, 3)
    sfx_dir = OUT / "audio" / "sfx"
    sfx_dir.mkdir(parents=True, exist_ok=True)

    last = {}
    last_any = -99.0
    anchors = []
    seq = 0
    used = {}

    def add(cat, t, text):
        nonlocal seq, last_any
        c = CATS[cat]
        pool = [f for f in c["files"] if (LIB / (f + ".mp3")).exists()]
        if not pool:
            return
        idx = used.get(cat, 0) % len(pool)
        used[cat] = used.get(cat, 0) + 1
        src = find_file(pool[idx])
        seq += 1
        name = "s%03d-%s.wav" % (seq, cat)
        prep(src, sfx_dir / name, c["dur"], c["peak"], c["fade_in"], c["fade_out"])
        anchors.append({"t": round(t, 3), "file": name, "cat": cat, "text": text})
        last[cat] = t
        last_any = t

    for s in shots:
        t0 = float(s["t0"])
        if s.get("hook"):
            prep(find_file("开场音效-咚"), sfx_dir / "hook-boom.wav", 1.2, -3, .01, .5)
            pool = [f for f in CATS["battle"]["files"] if (LIB / (f + ".mp3")).exists()]
            prep(find_file(pool[0]), sfx_dir / "hook-drums.wav", 1.4, -10, .01, .30)
            prep(find_file("钟声"), sfx_dir / "hook-bell.wav", 2.2, -10, .01, 1.6)
            anchors += [
                {"t": 0.0, "file": "hook-boom.wav", "cat": "horn", "text": "开场重击"},
                {"t": 0.12, "file": "hook-drums.wav", "cat": "battle", "text": "开场鼓点"},
                {"t": 1.0, "file": "hook-bell.wav", "cat": "gong", "text": "开场钟声"},
            ]
            last["battle"] = 0.12
            last["gong"] = 1.0
            last_any = 1.0
            continue

        if s.get("title"):
            if t0 - last.get("horn", -99) >= CATS["horn"]["cool"] and t0 - last_any >= 1.0:
                add("horn", t0 + 0.2, "幕标题：" + str(s.get("title")))
            continue

        cat = TYPE_CAT.get(s["type"])
        if has_shape(s, ("fire", "embers")):
            cat = "fire" if cat not in ("battle", "water") else cat
        if not cat:
            continue
        if t0 - last.get(cat, -99) < CATS[cat]["cool"]:
            continue
        if t0 - last_any < 1.2:
            continue
        add(cat, t0 + 0.18, "%s %s" % (s["id"], s["type"]))

        # 骑兵 / 海战再叠一条
        if s["type"] == "cavalry" and t0 - last.get("horse", -99) >= CATS["horse"]["cool"]:
            last["horse"] = -99
            add("horse", t0 + 0.9, s["id"] + " 骑兵")
        if s["type"] == "sea" and has_shape(s, ("warship",)) and \
                t0 - last.get("battle", -99) >= CATS["battle"]["cool"]:
            add("battle", t0 + 0.5, s["id"] + " 海战")

    anchors.sort(key=lambda a: a["t"])
    plan = {"total": total, "count": len(anchors),
            "by_cat": {k: sum(1 for a in anchors if a["cat"] == k) for k in CATS},
            "anchors": anchors}
    (OUT / "audio" / "sfx-plan.json").write_text(
        json.dumps(plan, ensure_ascii=False, indent=1), encoding="utf-8")

    mix = {
        "narration": str(OUT / "narration-smooth.mp3"),
        "bgm": str(OUT / "audio" / "bgm_bed.wav"),
        "sfx_dir": str(sfx_dir),
        "total": total,
        "narration_target_lufs": -16.0,
        "bgm_target_lufs": -34.0,
        "output": str(OUT / "audio" / "soundtrack.wav"),
        "sfx": [{"t": a["t"], "file": a["file"]} for a in anchors],
    }
    (OUT / "audio" / "mix-full.json").write_text(
        json.dumps(mix, ensure_ascii=False, indent=1), encoding="utf-8")
    print("anchors %d  total %.3f" % (len(anchors), total))
    print("by cat:", plan["by_cat"])


if __name__ == "__main__":
    main()
