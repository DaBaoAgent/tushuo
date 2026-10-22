# -*- coding: utf-8 -*-
"""组装分部 composition：fragment(pXX-scenes.html) + manifest -> films/china-history-20min/pXX/index.html

fragment 约定：
  - 若干 <section id="sN" class="scene" data-scene="N"> ... </section>（N 从 1 起）
  - 尾部 <script> 设置 window.PART_CHAPTER / PART_TOP / PART_TAG（每幕顶栏颜色）/
    PART_TIMELINE = function(tl, T, DUR) {...}
模板自动处理：场景 z-index/初始 opacity、叠化转场、chrome 淡入与逐幕换色、字幕循环。
"""
import json, os, re, shutil, sys

sys.stdout.reconfigure(encoding="utf-8")

BASE = r"D:/@kaifa/tushuo"
MANI_DIR = BASE + r"/output/china-history-20min/parts"
SRC_DIR = BASE + r"/films/china-history-20min/parts-src"
FILMS = BASE + r"/films/china-history-20min"

TEMPLATE = """<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=1920, height=1080">
<title>{title}</title>
<link rel="stylesheet" href="../lib/common.css">
<style>
{extra_css}
</style>
</head>
<body>
<div id="root" data-composition-id="{cid}" data-start="0" data-width="1920" data-height="1080" data-duration="{dur}">
{sections}
  <div id="grain" data-layout-ignore></div>
  <div id="vignette" data-layout-ignore></div>
  <div id="caption-wrap"></div>
  <div id="topline"><i></i>图说历史 · 徐艾伦</div>
  <div id="chapter-tag">{chapter}</div>
  <audio id="vo" src="assets/narration.mp3" data-start="0" data-duration="{audiodur}"></audio>
</div>
<script src="../vendor/gsap.min.js"></script>
<script src="../lib/fx.js"></script>
<script>
const T = {t};
const DUR = {dur};
const CAPS = {caps};

/* captions */
const capWrap = document.getElementById("caption-wrap");
CAPS.forEach((s, i) => {{
  const el = document.createElement("div");
  el.className = "cap";
  el.id = "cap-" + i;
  el.textContent = s.text;
  capWrap.appendChild(el);
}});

function buildTimeline() {{
  const tl = gsap.timeline({{ paused: true, defaults: {{ ease: "power2.out" }} }});

  /* 场景初始态 */
  document.querySelectorAll(".scene").forEach((sec, i) => {{
    if (i > 0) gsap.set(sec, {{ opacity: 0 }});
  }});

  /* chrome */
  tl.to("#topline", {{ opacity: 1, duration: 0.8 }}, 0.6);
  tl.to("#chapter-tag", {{ opacity: 1, duration: 0.8 }}, 0.9);
  for (let i = 1; i < T.length; i++) {{
    if (PART_TOP[i] && PART_TOP[i] !== PART_TOP[i - 1])
      tl.to("#topline", {{ color: PART_TOP[i], duration: 0.3 }}, T[i] - 0.1);
    if (PART_TAG[i] && PART_TAG[i] !== PART_TAG[i - 1])
      tl.to("#chapter-tag", {{ color: PART_TAG[i], duration: 0.3 }}, T[i] - 0.1);
  }}

  /* 叠化转场（无墨幕） */
  for (let i = 1; i < T.length; i++) {{
    const top = "#s" + (i + 1), bottom = "#s" + i;
    tl.to(top, {{ opacity: 1, duration: 0.3, ease: "none" }}, T[i] - 0.15);
    tl.set(bottom, {{ opacity: 0 }}, T[i] + 0.16);
  }}

  /* captions（nextStart 填充句间） */
  CAPS.forEach((s, i) => {{
    const el = document.getElementById("cap-" + i);
    const nextStart = i + 1 < CAPS.length ? CAPS[i + 1].t : s.end + 1.0;
    const effEnd = Math.min(nextStart - 0.06, s.end + 3.0);
    tl.fromTo(el, {{ opacity: 0 }}, {{ opacity: 1, duration: 0.01, ease: "none" }}, s.t);
    tl.to(el, {{ opacity: 0, duration: 0.01, ease: "none" }}, effEnd);
  }});

  PART_TIMELINE(tl, T, DUR);

  window.__timelines["{cid}"] = tl;
}}

{part_js}

buildTimeline();
</script>
</body>
</html>
"""


def build(pid):
    mani = json.load(open(os.path.join(MANI_DIR, pid, "manifest.json"), encoding="utf-8"))
    src_path = os.path.join(SRC_DIR, pid + "-scenes.html")
    src = open(src_path, encoding="utf-8").read()

    # 分离 sections 与 script
    m = re.search(r"<script>(.*)</script>\s*$", src, re.S)
    if not m:
        raise SystemExit(f"{src_path} 缺少 <script> 块")
    part_js = m.group(1)
    body = src[:m.start()]

    # 移除 script 中可能的 section 残留（只留 window.PART_* 与函数）
    scenes_html = body.strip()

    # 场景 z-index / 初始 opacity
    idx = {"n": 0}
    def sect_repl(mm):
        idx["n"] += 1
        z = 10 + idx["n"] - 1
        op = "" if idx["n"] == 1 else " opacity:0;"
        return f'<section id="s{idx["n"]}" class="scene" style="z-index:{z};{op}">'
    scenes_html = re.sub(r'<section id="s\d+" class="scene"[^>]*>', sect_repl, scenes_html)

    # 场景时间
    starts = [float(sc["start"]) for sc in mani["scenes"]]
    dur = float(mani["duration"]) + 0.15
    t_arr = starts + [round(dur, 3)]

    # 字幕 -> {t, end, text}
    caps = [{"t": c["start"], "end": c["end"], "text": c["text"]} for c in mani["captions"]]

    cid = f"china-history-20min-{pid}"
    title_m = re.search(r'window\.PART_TITLE\s*=\s*"([^"]+)"', part_js)
    chapter_m = re.search(r'window\.PART_CHAPTER\s*=\s*"([^"]+)"', part_js)
    title = title_m.group(1) if title_m else cid
    chapter = chapter_m.group(1) if chapter_m else ""

    # extra_css：fragment 中 <style> 块
    css_m = re.search(r"<style>(.*?)</style>", scenes_html, re.S)
    extra_css = css_m.group(1) if css_m else ""
    if css_m:
        scenes_html = (scenes_html[:css_m.start()] + scenes_html[css_m.end():])

    html = TEMPLATE.format(
        title=title, cid=cid, dur=f"{dur:.2f}", audiodur=f"{float(mani['duration']):.2f}",
        sections=scenes_html, chapter=chapter, t=json.dumps(t_arr), caps=json.dumps(caps, ensure_ascii=False),
        part_js=part_js, extra_css=extra_css,
    )

    out_dir = os.path.join(FILMS, pid)
    os.makedirs(os.path.join(out_dir, "assets"), exist_ok=True)
    open(os.path.join(out_dir, "index.html"), "w", encoding="utf-8").write(html)
    shutil.copy(os.path.join(MANI_DIR, pid, "narration.mp3"),
                os.path.join(out_dir, "assets", "narration.mp3"))
    print(f"[{pid}] built -> films/{pid}/index.html  ({len(mani['scenes'])} 幕 / {len(caps)} 字幕 / {dur:.1f}s)")


if __name__ == "__main__":
    ids = sys.argv[1:] or [p for p in sorted(os.listdir(SRC_DIR)) if p.endswith("-scenes.html")]
    for f in ids:
        pid = f.replace("-scenes.html", "") if f.endswith("-scenes.html") else f
        try:
            build(pid)
        except FileNotFoundError as e:
            print(f"[{pid}] 跳过：{e}")
