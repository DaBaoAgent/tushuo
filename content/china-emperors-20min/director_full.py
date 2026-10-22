# -*- coding: utf-8 -*-
"""china-emperors-20min · 全片分镜导演表

370 句口播 -> 370 个 3-5 秒分镜。场景由 papercut.js 的纸雕零件拼成，
每镜给出：场景层（sky/far/mid/action/fore）、人物、运镜、擦除转场。
时间轴不在这里写死：build_full_film.py 读 narration-smooth.json 按句对时。

场景命名沿用 papelcut 的零件语言；所有颜色取纸雕调色板，保证同一部片的气质一致。
"""

C = dict(
    paper="#efe6d2", paper2="#e2d4b8", shade="#d9c9a8",
    ink="#24211c", ink2="#3a352d", red="#b33a2b", red2="#8e2b20",
    ochre="#9a6b3f", teal="#2f4b57", teal2="#223841", gold="#c9a24a",
    white="#f7f0df", night="#0d1418", dark="#1b1712",
)

# 调色板：s0/s1/s2 = 天空渐变；sun/mount/far/accent/ink 为远景与点缀
PAL = {
    "day": dict(s0="#f6ebcd", s1="#e9d3aa", s2="#b99a71", sun="#b33a2b",
                mount="#9a6b3f", far="#cdb992", accent="#b33a2b", ink="#2b2620"),
    "gold": dict(s0="#f8e6b8", s1="#eec580", s2="#b97c47", sun="#c9563a",
                 mount="#a5743f", far="#d9b47c", accent="#c9a24a", ink="#2b2218"),
    "dusk": dict(s0="#f0d09e", s1="#d99a60", s2="#7f4a30", sun="#a83426",
                 mount="#7a4c33", far="#b98455", accent="#b33a2b", ink="#221812"),
    "night": dict(s0="#34464f", s1="#24333b", s2="#111a1f", sun="#c9a24a",
                  mount="#1b2a31", far="#2a3b44", accent="#c9a24a", ink="#0e1518"),
    "fire": dict(s0="#5e2718", s1="#9c3f1f", s2="#cf7a35", sun="#ffb05a",
                 mount="#4a2418", far="#6b3320", accent="#e08a3a", ink="#1c0f0a"),
    "snow": dict(s0="#eef2ec", s1="#dbe2da", s2="#b4c0b9", sun="#d8a85d",
                 mount="#8d9a94", far="#c3cdc7", accent="#8e2b20", ink="#2b3438"),
    "rain": dict(s0="#ccd2cb", s1="#a6b1aa", s2="#65736e", sun="#b33a2b",
                 mount="#66766f", far="#98a49d", accent="#8e2b20", ink="#202623"),
    "gloom": dict(s0="#d4cbb2", s1="#a89a80", s2="#645b4b", sun="#9a6b3f",
                  mount="#726551", far="#9a8b71", accent="#8e2b20", ink="#231f1a"),
    "imperial": dict(s0="#4a1d18", s1="#7c2c1f", s2="#b4582f", sun="#e0b562",
                     mount="#3a1a14", far="#5a2a1c", accent="#c9a24a", ink="#180c09"),
    "steppe": dict(s0="#efdcb3", s1="#d9bd8a", s2="#9c7c4e", sun="#b33a2b",
                   mount="#a8895c", far="#cbb180", accent="#9a6b3f", ink="#2c2418"),
    "autumn": dict(s0="#eedcb4", s1="#d8b077", s2="#8f6238", sun="#b33a2b",
                   mount="#8a5f36", far="#c3a070", accent="#8e2b20", ink="#2a1d13"),
    "jade": dict(s0="#e9efe3", s1="#cbd8c5", s2="#8fa292", sun="#c9a24a",
                 mount="#7d9184", far="#b3c2b5", accent="#2f4b57", ink="#232b26"),
    "brown": dict(s0="#e6d6b4", s1="#c9a878", s2="#7f5d3c", sun="#b33a2b",
                  mount="#7a5332", far="#b08d5f", accent="#8e2b20", ink="#241a10"),
}


def L(kind, depth, *props):
    return {"kind": kind, "depth": depth, "props": [p for p in props if p]}


def sh(name, **kw):
    d = {"shape": name}
    d.update(kw)
    return d


def sky(P, rays=None, glow=None, night=None):
    sk = sh("skygrad", **{"from": P["s0"], "mid": P["s1"], "to": P["s2"]})
    if glow:
        sk.update(glow)
    props = [sk]
    if rays:
        props.append(sh("rays", **rays))
    if night is not None:
        props.append(sh("night", color=C["night"], opacity=night))
    return L("sky", 0.16, *props)


def _banner_pair(P, y=0.99, s=1.2):
    return [sh("banner", x=0.055, y=y, s=s, color=P["accent"]),
            sh("banner", x=0.945, y=y, s=s, flip=True, color=P["accent"])]


# ---------------------------------------------------------------- 场景库

def sc_hook():
    """开场重击：龙椅与皇冠悬在深色大殿，左右两尊帝王剪影压在下缘。"""
    return [
        L("sky", 0.16,
          sh("skygrad", **{"from": "#241611", "mid": "#77331f", "to": "#e3aa5f"},
             glow="#ffd98a", glowO=.85, glowX=.5, glowY=.6, glowW=.52, glowH=.32),
          sh("rays", x=.5, y=.16, count=11, spread=1.9, len=1.1, w0=28, w1=250,
             color="#ffd07e", opacity=.2)),
        L("far", 0.3,
          sh("sun", x=.5, y=.56, r=205, color="#a83426"),
          sh("halo", x=.5, y=.56, r=215, rings=3, color="#e0b562"),
          sh("dragon", x=.5, y=.17, s=1.3, color="#5a2a1c"),
          sh("cloud", x=.1, y=.15, s=.85, color="#66351f", opacity=.42),
          sh("cloud", x=.9, y=.17, s=.75, color="#66351f", opacity=.36),
          sh("mountain", x=.5, y=.83, w=1.8, h=.28, color="#4a281b"),
          sh("mountain", x=.16, y=.86, w=.7, h=.2, color="#381d14"),
          sh("mountain", x=.84, y=.87, w=.8, h=.22, color="#381d14")),
        L("mid", 0.55,
          sh("hall", x=.5, y=.99, w=1.3, h=.66, color="#2b1c14"),
          sh("pillar", x=.09, y=1.0, h=.62, w=120, color="#3a2419"),
          sh("pillar", x=.91, y=1.0, h=.62, w=120, color="#3a2419"),
          sh("throne", x=.5, y=.95, s=1.5, color="#c9a24a"),
          sh("crown", x=.5, y=.5, s=.8, color="#c9a24a"),
          sh("lantern", x=.18, y=.3, s=.8),
          sh("lantern", x=.82, y=.3, s=.8)),
        L("action", 0.88,
          sh("glow", x=.5, y=.6, w=.5, h=.4, color="#e0b562", opacity=.28),
          sh("plate", x=.5, y=.96, w=2.6, h=.12)),
        L("fore", 1.14,
          sh("dust", x=.5, y=.99, w=1.9, opacity=.32),
          sh("embers")),
    ]


def sc_court(pal="imperial", variant="throne", crowd=True, night_op=None, lanterns=True):
    P = PAL[pal]
    far = [
        sh("hall", x=.5, y=.99, w=1.24, h=.64, color=P["ink"]),
        sh("pillar", x=.07, y=1.0, h=.6, w=110, color=C["red2"]),
        sh("pillar", x=.93, y=1.0, h=.6, w=110, color=C["red2"]),
        sh("drape", x=.2, y0=-10, len=.34, w=.09, color=C["red2"]),
        sh("drape", x=.8, y0=-10, len=.34, w=.09, color=C["red2"]),
    ]
    mid = [sh("throne", x=.5, y=.8, s=1.15, color=C["gold"])]
    if lanterns:
        mid += [sh("lantern", x=.15, y=.3, s=.65), sh("lantern", x=.85, y=.3, s=.65)]
    if variant == "audience":
        mid += [sh("screen", x=.5, y=.84, w=.66, h=.4)]
    action = [sh("plate", x=.5, y=.94, w=2.6, h=.1),
              sh("glow", x=.5, y=.62, w=.42, h=.32, color=C["gold"], opacity=.22)]
    if crowd:
        action.append(sh("crowd", x=.5, y=.99, s=.72, color=P["ink"]))
    action += [sh("candelabra", x=.11, y=.99, s=.7, color=C["ochre"]),
               sh("candelabra", x=.89, y=.99, s=.7, color=C["ochre"])]
    fore = _banner_pair(P, .99, 1.15) + [sh("dust", x=.5, y=.99, w=1.8, opacity=.26)]
    return [sky(P, glow=dict(glow="#ffd98e", glowO=.34, glowX=.5, glowY=.58, glowW=.6, glowH=.4), night=night_op),
            L("far", 0.32, *far), L("mid", 0.58, *mid), L("action", 0.86, *action),
            L("fore", 1.12, *fore)]


def sc_palace(pal="gold", crowd=False, night_op=None, gate=False):
    P = PAL[pal]
    far = [sh("sun" if pal not in ("night", "imperial") else "moon", x=.8, y=.18, r=72, color=P["sun"]),
           sh("cloud", x=.2, y=.14, s=1.0, color=C["white"], opacity=.3),
           sh("cloud", x=.72, y=.2, s=.8, color=C["white"], opacity=.24),
           sh("mountain", x=.5, y=.7, w=1.5, h=.3, color=P["mount"]),
           sh("palace", x=.5, y=.88, w=1.05, h=.36, color=P["ink"])]
    mid = [sh("lantern", x=.18, y=.28, s=.6), sh("lantern", x=.82, y=.28, s=.6)]
    if gate:
        mid.append(sh("gate", x=.5, y=.94, w=.62, h=.34, color=P["ink"], door=C["ochre"]))
    act = [sh("plate", x=.5, y=.96, w=2.6, h=.12)]
    if crowd:
        act.append(sh("crowd", x=.5, y=.99, s=.85, color=P["ink"]))
    fore = _banner_pair(P, 1.0, 1.2) + [sh("dust", x=.5, y=.99, w=1.8, opacity=.28)]
    return [sky(P, rays=dict(x=.8, y=.0, count=7, spread=1.4, len=1.0, w0=18, w1=150,
                             color="#ffe8b0", opacity=.12) if pal in ("gold", "day") else None,
                glow=dict(glow="#ffd98e", glowO=.3, glowX=.7, glowY=.24, glowW=.5, glowH=.32), night=night_op),
            L("far", 0.3, *far), L("mid", 0.56, *mid), L("action", 0.86, *act),
            L("fore", 1.12, *fore)]


def sc_city(pal="day", crowd=True, fire=False, surrender=False):
    P = PAL[pal]
    far = [sh("sun", x=.8, y=.18, r=64, color=P["sun"]),
           sh("cloud", x=.22, y=.15, s=.9, color=C["white"], opacity=.26),
           sh("city", x=.5, y=.72, w=1.55, color=P["ink"])]
    if fire:
        far += [sh("smoke", x=.72, y=.6, s=1.0), sh("fire", x=.72, y=.7, s=1.2)]
    mid = [sh("gate", x=.5, y=.93, w=.56, h=.3, color=P["ink"],
              door=C["paper"] if surrender else C["ochre"])]
    act = [sh("plate", x=.5, y=.93, w=2.6, h=.14)]
    if crowd:
        act.append(sh("crowd", x=.5, y=.985, s=.9, color=P["ink"]))
    if surrender:
        act.append(sh("banner", x=.5, y=.99, s=.9, color=C["white"]))
    if fire:
        act += [sh("smoke", x=.3, y=.82, s=.8), sh("smoke", x=.7, y=.84, s=.9)]
    fore = _banner_pair(P, .99, 1.15) + [sh("dust", x=.5, y=.99, w=1.8, opacity=.4)]
    return [sky(P, night=.3 if pal == "night" else None), L("far", 0.3, *far),
            L("mid", 0.58, *mid), L("action", 0.88, *act), L("fore", 1.14, *fore)]


def sc_market(pal="day", crowd=True, fire=False):
    P = PAL[pal]
    far = [sh("sun", x=.2, y=.18, r=56, color=P["sun"]),
           sh("cloud", x=.7, y=.14, s=.9, color=C["white"], opacity=.26),
           sh("city", x=.5, y=.7, w=1.5, color=P["ink"])]
    mid = [sh("tents", x=.3, y=.88, s=.9, color=C["paper2"]),
           sh("tents", x=.72, y=.9, s=.8, color=C["paper2"]),
           sh("umbrella", x=.5, y=.55, s=.7),
           sh("lantern", x=.14, y=.36, s=.5), sh("lantern", x=.86, y=.36, s=.5)]
    if fire:
        mid += [sh("fire", x=.6, y=.8, s=1.0), sh("smoke", x=.6, y=.68, s=.9)]
    act = [sh("plate", x=.5, y=.93, w=2.8, h=.14),
           sh("coin", x=.14, y=.9, s=.32), sh("coin", x=.84, y=.91, s=.28),
           sh("scroll", x=.78, y=.9, w=.16, h=.09)]
    if crowd:
        act.append(sh("crowd", x=.5, y=.99, s=.8, color=P["ink"]))
    fore = _banner_pair(P, 1.0, 1.0) + [sh("dust", x=.5, y=.99, w=1.7, opacity=.3)]
    return [sky(P, glow=dict(glow="#ffe0a0", glowO=.3, glowX=.3, glowY=.3, glowW=.5, glowH=.3)),
            L("far", 0.3, *far), L("mid", 0.56, *mid), L("action", 0.88, *act),
            L("fore", 1.14, *fore)]


def sc_battle(pal="dusk", kinds=None, snow=False, rain=False, arrows=False, embers=False):
    """两军对垒。kinds 决定远景/中景的天气与火势。"""
    P = PAL[pal]
    far = [sh("sun" if pal not in ("night", "fire") else "moon", x=.82, y=.2, r=80, color=P["sun"]),
           sh("cloud", x=.25, y=.18, s=.9, color=C["white"], opacity=.24),
           sh("cloud", x=.7, y=.12, s=.75, color=C["white"], opacity=.2),
           sh("mountain", x=.5, y=.7, w=1.5, h=.34, color=P["mount"])]
    mid = [sh("ridge", x=.5, y=.8, w=1.5, h=.12, color=P["ink"])]
    if kinds != "plain":
        mid += [sh("fire", x=.72, y=.76, s=1.1), sh("smoke", x=.72, y=.66, s=1.0)]
    act = [sh("army", x=.32, y=.9, cols=9, rows=3, s=.6, facing="right", color=P["ink"]),
           sh("army", x=.7, y=.92, cols=8, rows=3, s=.62, facing="left", color=C["teal2"]),
           sh("spears", x=.22, y=1.02, count=8, s=.8, color=P["ink"]),
           sh("spears", x=.8, y=1.03, count=7, s=.75, color=P["ink"])]
    if arrows:
        act.append(sh("arrows", x=.5, y=.5, count=9, s=.9, ang=22))
    if embers:
        act.append(sh("embers"))
    fore = [sh("banner", x=.08, y=.98, s=1.1, color=P["accent"]),
            sh("banner", x=.92, y=1.0, s=1.0, flip=True, color=C["teal"]),
            sh("dust", x=.5, y=.99, w=1.8, opacity=.5)]
    if snow:
        fore.append(sh("snow"))
    if rain:
        fore.append(sh("rain"))
    return [sky(P, rays=dict(x=.8, y=.0, count=5, spread=1.4, len=1.0, w0=20, w1=140,
                             color="#ffe0a0", opacity=.1) if pal in ("dusk", "gold", "fire") else None,
                night=.45 if pal == "night" else None),
            L("far", 0.3, *far), L("mid", 0.54, *mid), L("action", 0.86, *act),
            L("fore", 1.16, *fore)]


def sc_cavalry(pal="steppe", n=3, snow=False):
    P = PAL[pal]
    far = [sh("sun", x=.78, y=.2, r=68, color=P["sun"]),
           sh("cloud", x=.24, y=.14, s=1.0, color=C["white"], opacity=.3),
           sh("cloud", x=.66, y=.2, s=.8, color=C["white"], opacity=.22),
           sh("mountain", x=.5, y=.62, w=1.7, h=.24, color=P["mount"])]
    mid = [sh("steppe", x=.5, y=.8, color=P["far"])]
    horses = []
    for i in range(n):
        x = .3 + i * (.4 / max(1, n - 1)) if n > 1 else .5
        horses.append(sh("cavalry", x=x, y=.9 - (i % 2) * .01, s=.85 + (i % 2) * .06,
                         facing="left" if i % 2 else "right", color=P["ink"]))
    act = horses + [sh("dust", x=.5, y=.95, w=1.6)]
    fore = [sh("pennant", x=.1, y=.98, s=.8, color=P["accent"]),
            sh("grass", x0=0, x1=1, y0=.9, y1=.99, count=18, opacity=.35, color=P["ink"])]
    if snow:
        fore.append(sh("snow"))
    return [sky(P), L("far", 0.3, *far), L("mid", 0.54, *mid), L("action", 0.86, *act),
            L("fore", 1.14, *fore)]


def sc_wall(pal="snow", snow=True, soldiers=True):
    P = PAL[pal]
    far = [sh("sun", x=.2, y=.16, r=64, color=P["sun"]),
           sh("cloud", x=.68, y=.14, s=1.0, color=C["white"], opacity=.3),
           sh("mountain", x=.5, y=.66, w=1.6, h=.36, color=P["mount"])]
    mid = [sh("greatwall", x=.5, y=.7, w=1.45, color=P["ink"])]
    act = [sh("plate", x=.5, y=.92, w=2.8, h=.14)]
    if soldiers:
        act += [sh("soldier", x=.24, y=.8, s=1.0, facing="right"),
                sh("soldier", x=.31, y=.81, s=.95, facing="right"),
                sh("spears", x=.66, y=1.02, count=5, s=.7)]
    fore = [sh("pine", x=.06, y=.94, s=1.1), sh("pine", x=.94, y=.96, s=.85),
            sh("dust", x=.5, y=.99, w=1.6, opacity=.25)]
    if snow:
        fore.append(sh("snow"))
    return [sky(P, night=.25 if pal == "night" else None), L("far", 0.3, *far),
            L("mid", 0.55, *mid), L("action", 0.86, *act), L("fore", 1.12, *fore)]


def sc_river(pal="jade", fleet=4, battle=False, mist=True, snow=False):
    P = PAL[pal]
    far = [sh("sun" if pal != "night" else "moon", x=.78, y=.18, r=62, color=P["sun"]),
           sh("cloud", x=.3, y=.16, s=1.0, color=C["white"], opacity=.28),
           sh("mountain", x=.5, y=.6, w=1.6, h=.28, color=P["mount"])]
    mid = [sh("river", x=.5, y=.76, w=1.5, color=C["teal"])]
    if battle:
        mid += [sh("fire", x=.3, y=.74, s=1.0), sh("fire", x=.7, y=.75, s=1.1),
                sh("smoke", x=.3, y=.64, s=.9), sh("smoke", x=.7, y=.62, s=1.0)]
    act = [sh("wave", x=.5, y=.82, w=1.7, rows=3, color=C["teal"])]
    if fleet:
        act.append(sh("fleet", x=.5, y=.83, boats=fleet, s=.7))
    if battle:
        act += [sh("warship", x=.28, y=.8, s=.8, facing="right"),
                sh("warship", x=.74, y=.81, s=.85, facing="left"),
                sh("arrows", x=.5, y=.5, count=7, s=.8, ang=18)]
    fore = [sh("tree", x=.06, y=.96, s=1.0), sh("reeds", x=.92, y=1.0, s=.9),
            sh("embers") if battle else None]
    if mist:
        far.append(sh("mist", x=.5, y=.64, w=1.9, h=.03))
    if snow:
        fore.append(sh("snow"))
    return [sky(P, night=.4 if pal == "night" else None), L("far", 0.3, *far),
            L("mid", 0.52, *mid), L("action", 0.84, *act), L("fore", 1.14, *[p for p in fore if p])]


def sc_sea(pal="night", battle=False, junks=2):
    P = PAL[pal]
    far = [sh("moon" if pal in ("night", "rain") else "sun", x=.78, y=.18, r=70, color=P["sun"]),
           sh("cloud", x=.28, y=.16, s=.9, color=C["white"], opacity=.22),
           sh("mountain", x=.24, y=.52, w=.6, h=.16, color=P["mount"]),
           sh("mountain", x=.82, y=.55, w=.5, h=.12, color=P["mount"])]
    mid = [sh("wave", x=.5, y=.66, w=1.9, rows=3, color=C["teal2"])]
    act = [sh("wave", x=.5, y=.8, w=1.8, rows=2, color=C["teal"])]
    if junks:
        act.append(sh("fleet", x=.45, y=.84, boats=junks, s=.75))
    if battle:
        act += [sh("warship", x=.3, y=.8, s=.85, facing="right"),
                sh("warship", x=.72, y=.82, s=.9, facing="left"),
                sh("fire", x=.5, y=.78, s=1.2), sh("smoke", x=.5, y=.64, s=1.1),
                sh("embers"), sh("arrows", x=.5, y=.48, count=8, s=.85, ang=16)]
    fore = [sh("reeds", x=.06, y=1.02, s=1.0), sh("birds", x=.8, y=.3, s=.6, count=4)]
    return [sky(P, night=.5 if pal == "night" else None), L("far", 0.28, *far),
            L("mid", 0.52, *mid), L("action", 0.84, *act), L("fore", 1.14, *fore)]


def sc_map(pal="day", banners=2, extra=None, arrows=False):
    P = PAL[pal]
    far = [sh("mountain", x=.18, y=.8, w=.8, h=.2, color=P["far"]),
           sh("mountain", x=.86, y=.78, w=.7, h=.18, color=P["far"])]
    mid = [sh("map", x=.5, y=.56, w=.9, h=.54)]
    act = [sh("plate", x=.5, y=.96, w=2.6, h=.12),
           sh("candelabra", x=.08, y=.99, s=.6, color=C["ochre"]),
           sh("candelabra", x=.92, y=.99, s=.6, color=C["ochre"])]
    for i in range(banners):
        x = .3 + i * (.4 / max(1, banners - 1)) if banners > 1 else .5
        act.append(sh("banner", x=x, y=.9, s=.45, color=P["accent"] if i % 2 == 0 else C["teal"]))
    if arrows:
        act.append(sh("arrows", x=.5, y=.4, count=5, s=.7, ang=-16))
    if extra:
        act += extra
    fore = [sh("coin", x=.1, y=.97, s=.24), sh("scroll", x=.9, y=.99, w=.14, h=.08),
            sh("dust", x=.5, y=.99, w=1.6, opacity=.2)]
    return [sky(P, glow=dict(glow="#ffe0a0", glowO=.24, glowX=.5, glowY=.5, glowW=.6, glowH=.4)),
            L("far", 0.3, *far), L("mid", 0.54, *mid), L("action", 0.88, *act),
            L("fore", 1.12, *fore)]


def sc_object(pal="day", obj="scroll", seal=None, glow=True, extra=None):
    P = PAL[pal]
    far = [sh("cloud", x=.25, y=.18, s=1.1, color=C["white"], opacity=.3),
           sh("cloud", x=.78, y=.15, s=.85, color=C["white"], opacity=.24)]
    mid = []
    if glow:
        mid.append(sh("glow", x=.5, y=.54, w=.55, h=.45, color=C["gold"], opacity=.34))
    if obj == "scroll":
        mid.append(sh("scroll", x=.5, y=.56, w=.72, h=.4))
    elif obj == "book":
        mid.append(sh("book", x=.5, y=.58, w=.68, h=.36))
    elif obj == "map":
        mid.append(sh("map", x=.5, y=.56, w=.8, h=.5))
    elif obj == "crown":
        mid.append(sh("crown", x=.5, y=.52, s=1.25, color=C["gold"]))
    elif obj == "sword":
        mid.append(sh("sword", x=.5, y=.42, s=.85))
    elif obj == "dagger":
        mid.append(sh("dagger", x=.5, y=.46, s=1.1))
    elif obj == "coin":
        mid.append(sh("coin", x=.5, y=.52, s=.85))
    elif obj == "cauldron":
        mid.append(sh("cauldron", x=.5, y=.72, s=1.1))
    elif obj == "slips":
        mid.append(sh("slips", x=.5, y=.7, s=1.0))
    elif obj == "crown_throne":
        mid += [sh("throne", x=.5, y=.78, s=1.1), sh("crown", x=.5, y=.42, s=.8, color=C["gold"])]
    if seal:
        mid.append(sh("seal", x=.5, y=.52, s=.85, text=seal))
    act = [sh("plate", x=.5, y=.94, w=2.4, h=.12),
           sh("lantern", x=.12, y=.32, s=.55), sh("lantern", x=.88, y=.32, s=.55)]
    if extra:
        act += extra
    fore = [sh("dust", x=.5, y=.99, w=1.4, opacity=.2)]
    return [sky(P, glow=dict(glow="#ffe0a0", glowO=.3, glowX=.5, glowY=.5, glowW=.5, glowH=.4)),
            L("far", 0.3, *far), L("mid", 0.56, *mid), L("action", 0.88, *act),
            L("fore", 1.12, *fore)]


def sc_tomb(pal="night", text="陵", candle=False):
    P = PAL[pal]
    far = [sh("moon" if pal in ("night", "snow") else "sun", x=.78, y=.16, r=70, color=P["sun"]),
           sh("stars", opacity=.6) if pal == "night" else None,
           sh("mountain", x=.5, y=.72, w=1.6, h=.32, color=P["mount"])]
    mid = [sh("tomb", x=.5, y=.82, s=1.05, text=text),
           sh("pine", x=.16, y=.86, s=1.0), sh("pine", x=.85, y=.88, s=.85),
           sh("mist", x=.5, y=.66, w=1.9, h=.03)]
    act = [sh("plate", x=.5, y=.95, w=2.6, h=.12)]
    if candle:
        act += [sh("candelabra", x=.24, y=.98, s=.55), sh("candelabra", x=.76, y=.98, s=.55)]
    act.append(sh("smoke", x=.5, y=.55, s=.55))
    return [sky(P, night=.55 if pal == "night" else None), L("far", 0.28, *[p for p in far if p]),
            L("mid", 0.56, *mid), L("action", 0.86, *act),
            L("fore", 1.12, sh("dust", x=.5, y=.99, w=1.5, opacity=.24))]


def sc_steppe(pal="steppe", yurts=2, cavalry=1):
    P = PAL[pal]
    far = [sh("cloud", x=.3, y=.16, s=1.1, color=C["white"], opacity=.32),
           sh("cloud", x=.74, y=.2, s=.85, color=C["white"], opacity=.26),
           sh("mountain", x=.5, y=.58, w=1.7, h=.22, color=P["mount"])]
    mid = [sh("steppe", x=.5, y=.8, color=P["far"])]
    act = []
    for i in range(yurts):
        act.append(sh("yurt", x=.24 + i * .16, y=.84 - i * .01, s=.75 - i * .08))
    if cavalry:
        act.append(sh("cavalry", x=.72, y=.9, s=.9, facing="left", color=P["ink"]))
    act.append(sh("dust", x=.5, y=.95, w=1.4))
    fore = [sh("grass", x0=0, x1=1, y0=.9, y1=.99, count=20, opacity=.3, color=P["ink"]),
            sh("banner", x=.08, y=.99, s=.95, color=P["accent"])]
    return [sky(P), L("far", 0.3, *far), L("mid", 0.54, *mid), L("action", 0.86, *act),
            L("fore", 1.12, *fore)]


def sc_temple(pal="jade", pagoda=False, rain=False):
    P = PAL[pal]
    far = [sh("cloud", x=.25, y=.16, s=1.1, color=C["white"], opacity=.3),
           sh("mountain", x=.5, y=.62, w=1.5, h=.24, color=P["mount"]),
           sh("pagoda", x=.82, y=.72, s=.75) if pagoda else None]
    mid = [sh("temple", x=.5, y=.86, w=.7, h=.34),
           sh("incense", x=.3, y=.94, s=.8), sh("incense", x=.7, y=.95, s=.75),
           sh("lantern", x=.14, y=.32, s=.55), sh("lantern", x=.86, y=.32, s=.55)]
    act = [sh("plate", x=.5, y=.95, w=2.5, h=.12),
           sh("mist", x=.5, y=.68, w=1.9, h=.03)]
    fore = [sh("pine", x=.06, y=.98, s=1.0), sh("pine", x=.94, y=1.0, s=.85)]
    if rain:
        fore.append(sh("rain"))
    return [sky(P, night=.3 if pal == "night" else None), L("far", 0.3, *[p for p in far if p]),
            L("mid", 0.56, *mid), L("action", 0.86, *act), L("fore", 1.12, *fore)]


def sc_snow(pal="snow", army=False):
    P = PAL[pal]
    far = [sh("sun", x=.74, y=.18, r=60, color=P["sun"]),
           sh("mountain", x=.5, y=.62, w=1.7, h=.3, color=P["mount"])]
    mid = [sh("snowfield", x=.5, y=.8, w=1.8)]
    act = [sh("plate", x=.5, y=.93, w=2.6, h=.12)]
    if army:
        act += [sh("army", x=.3, y=.9, cols=7, rows=2, s=.55, facing="right", color=P["ink"]),
                sh("army", x=.7, y=.92, cols=6, rows=2, s=.55, facing="left", color=C["teal2"]),
                sh("spears", x=.22, y=1.02, count=6, s=.7)]
    fore = [sh("pine", x=.06, y=.98, s=1.1), sh("snow"), sh("snow")]
    return [sky(P), L("far", 0.3, *far), L("mid", 0.54, *mid), L("action", 0.86, *act),
            L("fore", 1.12, *fore)]


def sc_study(pal="autumn", obj="scroll", papers=True):
    P = PAL[pal]
    far = [sh("screen", x=.5, y=.88, w=.66, h=.4),
           sh("lantern", x=.14, y=.32, s=.55), sh("lantern", x=.86, y=.32, s=.55)]
    mid = [sh("candelabra", x=.78, y=.92, s=.75)]
    if obj == "scroll":
        mid.append(sh("scroll", x=.42, y=.86, w=.2, h=.1))
    elif obj == "book":
        mid.append(sh("book", x=.42, y=.84, w=.24, h=.12))
    act = [sh("plate", x=.5, y=.94, w=2.6, h=.12)]
    if papers:
        act.append(sh("slips", x=.6, y=.9, s=.75))
    fore = [sh("dust", x=.5, y=.99, w=1.5, opacity=.2)]
    return [sky(P, glow=dict(glow="#ffd98e", glowO=.3, glowX=.5, glowY=.5, glowW=.5, glowH=.4),
                night=.35 if pal == "night" else None),
            L("far", 0.3, *far), L("mid", 0.56, *mid), L("action", 0.88, *act),
            L("fore", 1.12, *fore)]


def sc_execution(pal="gloom", crowd=True):
    P = PAL[pal]
    far = [sh("city", x=.5, y=.7, w=1.5, color=P["ink"]),
           sh("cloud", x=.3, y=.14, s=.9, color=C["white"], opacity=.2)]
    mid = [sh("gate", x=.5, y=.9, w=.58, h=.3, color=P["ink"]),
           sh("spears", x=.2, y=1.0, count=5, s=.9),
           sh("spears", x=.8, y=1.0, count=5, s=.9)]
    act = [sh("plate", x=.5, y=.93, w=2.6, h=.14)]
    if crowd:
        act.append(sh("crowd", x=.5, y=.99, s=.9, color=P["ink"]))
    fore = [sh("dust", x=.5, y=.99, w=1.8, opacity=.55),
            sh("banner", x=.08, y=1.0, s=1.0, color=P["accent"]),
            sh("banner", x=.92, y=1.0, s=1.0, flip=True, color=P["accent"])]
    return [sky(P), L("far", 0.3, *far), L("mid", 0.56, *mid), L("action", 0.88, *act),
            L("fore", 1.14, *fore)]


def sc_feast(pal="gold"):
    P = PAL[pal]
    far = [sh("hall", x=.5, y=.99, w=1.3, h=.64, color=P["ink"]),
           sh("drape", x=.18, y0=-10, len=.3, w=.08, color=C["red2"]),
           sh("drape", x=.82, y0=-10, len=.3, w=.08, color=C["red2"])]
    mid = [sh("cauldron", x=.5, y=.8, s=.9),
           sh("lantern", x=.16, y=.3, s=.6), sh("lantern", x=.84, y=.3, s=.6),
           sh("candelabra", x=.07, y=.99, s=.7), sh("candelabra", x=.93, y=.99, s=.7)]
    act = [sh("plate", x=.5, y=.93, w=2.8, h=.13),
           sh("crowd", x=.5, y=.99, s=.8, color=P["ink"]),
           sh("coin", x=.22, y=.9, s=.24), sh("coin", x=.78, y=.91, s=.22)]
    fore = _banner_pair(P, 1.0, 1.1) + [sh("dust", x=.5, y=.99, w=1.6, opacity=.2)]
    return [sky(P, glow=dict(glow="#ffd98e", glowO=.4, glowX=.5, glowY=.58, glowW=.6, glowH=.4)),
            L("far", 0.32, *far), L("mid", 0.58, *mid), L("action", 0.88, *act),
            L("fore", 1.12, *fore)]


def sc_camp(pal="dusk", fire=True):
    P = PAL[pal]
    far = [sh("moon" if pal == "night" else "sun", x=.78, y=.18, r=60, color=P["sun"]),
           sh("mountain", x=.5, y=.6, w=1.6, h=.24, color=P["mount"]),
           sh("cloud", x=.3, y=.16, s=.9, color=C["white"], opacity=.22)]
    mid = [sh("tents", x=.3, y=.86, s=.9, color=C["paper2"]),
           sh("tents", x=.7, y=.88, s=.8, color=C["paper2"])]
    if fire:
        mid += [sh("fire", x=.5, y=.86, s=1.0), sh("smoke", x=.5, y=.74, s=.9)]
    act = [sh("plate", x=.5, y=.94, w=2.6, h=.12),
           sh("army", x=.5, y=.94, cols=8, rows=2, s=.45, color=P["ink"]),
           sh("spears", x=.2, y=1.02, count=6, s=.8)]
    fore = [sh("pennant", x=.1, y=1.0, s=.8, color=P["accent"]),
            sh("dust", x=.5, y=.99, w=1.7, opacity=.35)]
    return [sky(P, night=.45 if pal == "night" else None), L("far", 0.3, *far),
            L("mid", 0.56, *mid), L("action", 0.86, *act), L("fore", 1.12, *fore)]


def sc_pass(pal="rain", soldiers=True):
    P = PAL[pal]
    far = [sh("cloud", x=.3, y=.12, s=1.1, color=C["white"], opacity=.3),
           sh("mountain", x=.24, y=.6, w=.8, h=.34, color=P["mount"]),
           sh("mountain", x=.78, y=.56, w=.9, h=.4, color=P["mount"]),
           sh("birds", x=.6, y=.24, s=.6, count=4)]
    mid = [sh("mist", x=.5, y=.6, w=1.9, h=.04),
           sh("rocks", x=.2, y=1.0, s=.7), sh("rocks", x=.82, y=.98, s=.6),
           sh("pine", x=.9, y=.96, s=.8)]
    act = [sh("plate", x=.5, y=.94, w=2.6, h=.12)]
    if soldiers:
        act += [sh("soldier", x=.26, y=.86, s=.8, facing="right"),
                sh("soldier", x=.34, y=.87, s=.78, facing="right"),
                sh("spears", x=.7, y=1.0, count=4, s=.7)]
    fore = [sh("rain") if pal == "rain" else None, sh("dust", x=.5, y=.99, w=1.5, opacity=.3)]
    return [sky(P, night=.3 if pal == "night" else None), L("far", 0.28, *far),
            L("mid", 0.54, *mid), L("action", 0.86, *act),
            L("fore", 1.12, *[p for p in fore if p])]


def sc_harbor(pal="day", junks=2, city=True):
    P = PAL[pal]
    far = [sh("sun", x=.18, y=.16, r=56, color=P["sun"]),
           sh("cloud", x=.7, y=.14, s=.9, color=C["white"], opacity=.28),
           sh("city", x=.7, y=.62, w=.7, color=P["ink"]) if city else None,
           sh("mountain", x=.3, y=.56, w=.7, h=.16, color=P["mount"])]
    mid = [sh("wave", x=.5, y=.7, w=1.9, rows=3, color=C["teal"])]
    act = [sh("wave", x=.5, y=.84, w=1.8, rows=2, color=C["teal2"]),
           sh("fleet", x=.45, y=.86, boats=junks, s=.7),
           sh("birds", x=.82, y=.3, s=.55, count=4)]
    fore = [sh("reeds", x=.06, y=1.02, s=.9), sh("rocks", x=.9, y=1.02, s=.5)]
    return [sky(P), L("far", 0.3, *[p for p in far if p]), L("mid", 0.54, *mid),
            L("action", 0.86, *act), L("fore", 1.12, *fore)]


def sc_burning(pal="fire", city=True):
    P = PAL[pal]
    far = [sh("skygrad" if False else "mountain", x=.5, y=.7, w=1.7, h=.3, color=P["mount"]),
           sh("city", x=.5, y=.7, w=1.5, color=P["ink"]) if city else None,
           sh("smoke", x=.3, y=.56, s=1.2), sh("smoke", x=.72, y=.52, s=1.3)]
    mid = [sh("fire", x=.24, y=.8, s=1.2), sh("fire", x=.5, y=.82, s=1.4),
           sh("fire", x=.78, y=.8, s=1.1)]
    act = [sh("plate", x=.5, y=.94, w=2.8, h=.14),
           sh("rubble", x=.5, y=1.0, s=1.1), sh("embers")]
    fore = [sh("smoke", x=.5, y=.95, s=.9), sh("dust", x=.5, y=.99, w=1.8, opacity=.5)]
    return [sky(P, glow=dict(glow="#ff9c42", glowO=.6, glowX=.5, glowY=.55, glowW=.7, glowH=.45)),
            L("far", 0.28, *[p for p in far if p]), L("mid", 0.54, *mid),
            L("action", 0.86, *act), L("fore", 1.14, *fore)]


def sc_portrait(pal="gold", back="sun", prop=None):
    P = PAL[pal]
    far = []
    if back == "sun":
        far += [sh("sun", x=.5, y=.5, r=180, color=P["sun"]),
                sh("halo", x=.5, y=.5, r=200, rings=3, color=C["gold"])]
    elif back == "moon":
        far += [sh("moon", x=.5, y=.34, r=120), sh("stars", opacity=.5)]
    else:
        far += [sh("glow", x=.5, y=.5, w=.5, h=.4, color=C["gold"], opacity=.4)]
    far += [sh("cloud", x=.16, y=.18, s=.9, color=C["white"], opacity=.24),
            sh("cloud", x=.84, y=.2, s=.8, color=C["white"], opacity=.2),
            sh("mountain", x=.5, y=.8, w=1.8, h=.24, color=P["mount"])]
    mid = [sh("glow", x=.5, y=.58, w=.4, h=.34, color=C["gold"], opacity=.3),
           sh("lantern", x=.1, y=.32, s=.55), sh("lantern", x=.9, y=.32, s=.55)]
    if prop:
        mid.append(sh(prop, x=.82, y=.7, s=.6) if prop in ("crown", "coin", "seal", "scroll") else sh(prop, x=.82, y=.78, s=.55))
    act = [sh("plate", x=.5, y=.95, w=2.6, h=.12)]
    fore = [sh("dust", x=.5, y=.99, w=1.5, opacity=.25)]
    return [sky(P, rays=dict(x=.5, y=.0, count=9, spread=2.0, len=1.2, w0=26, w1=220,
                             color="#ffe0a0", opacity=.16)),
            L("far", 0.28, *far), L("mid", 0.56, *mid), L("action", 0.86, *act),
            L("fore", 1.12, *fore)]


def sc_plain(pal="steppe", tree=True, army=False):
    P = PAL[pal]
    far = [sh("sun", x=.8, y=.18, r=64, color=P["sun"]),
           sh("cloud", x=.26, y=.14, s=1.0, color=C["white"], opacity=.3),
           sh("mountain", x=.5, y=.62, w=1.7, h=.22, color=P["mount"])]
    mid = [sh("steppe", x=.5, y=.82, color=P["far"])]
    act = [sh("grass", x0=0, x1=1, y0=.86, y1=.98, count=22, opacity=.3, color=P["ink"])]
    if tree:
        act += [sh("tree", x=.16, y=.9, s=.9), sh("pine", x=.86, y=.92, s=.8)]
    if army:
        act.append(sh("army", x=.5, y=.94, cols=8, rows=2, s=.5, color=P["ink"]))
    fore = [sh("reeds", x=.5, y=1.02, s=1.0)]
    return [sky(P), L("far", 0.3, *far), L("mid", 0.54, *mid), L("action", 0.86, *act),
            L("fore", 1.12, *fore)]


def sc_twothrones(pal="imperial"):
    P = PAL[pal]
    far = [sh("hall", x=.5, y=.99, w=1.3, h=.66, color=P["ink"]),
           sh("pillar", x=.08, y=1.0, h=.6, w=100, color=C["red2"]),
           sh("pillar", x=.92, y=1.0, h=.6, w=100, color=C["red2"])]
    mid = [sh("throne", x=.3, y=.82, s=.95, color=C["gold"]),
           sh("throne", x=.7, y=.82, s=.95, color=C["gold"]),
           sh("lantern", x=.16, y=.3, s=.6), sh("lantern", x=.84, y=.3, s=.6)]
    act = [sh("plate", x=.5, y=.94, w=2.8, h=.12),
           sh("glow", x=.5, y=.6, w=.6, h=.4, color=C["gold"], opacity=.2)]
    return [sky(P, glow=dict(glow="#ffd98e", glowO=.36, glowX=.5, glowY=.58, glowW=.7, glowH=.45)),
            L("far", 0.32, *far), L("mid", 0.58, *mid), L("action", 0.86, *act),
            L("fore", 1.12, sh("dust", x=.5, y=.99, w=1.8, opacity=.3))]


def sc_finale(pal="gold", book=True, map_=True, slips=True, wall=True):
    P = PAL[pal]
    far = [sh("sun", x=.5, y=.46, r=150, color=P["sun"]),
           sh("halo", x=.5, y=.46, r=175, rings=3, color=C["gold"]),
           sh("cloud", x=.16, y=.16, s=1.0, color=C["white"], opacity=.3),
           sh("cloud", x=.84, y=.18, s=.9, color=C["white"], opacity=.26),
           sh("mountain", x=.5, y=.72, w=1.9, h=.26, color=P["mount"])]
    mid = []
    if wall:
        mid.append(sh("greatwall", x=.5, y=.7, w=1.4, color=P["ink"]))
    if book:
        mid.append(sh("book", x=.4, y=.66, w=.44, h=.24))
    if map_:
        mid.append(sh("map", x=.66, y=.7, w=.4, h=.26))
    if slips:
        mid.append(sh("slips", x=.52, y=.84, s=.7))
    mid.append(sh("seal", x=.5, y=.5, s=.6, text="史"))
    act = [sh("plate", x=.5, y=.96, w=2.8, h=.12)]
    fore = [sh("dust", x=.5, y=.99, w=1.6, opacity=.24)]
    return [sky(P, rays=dict(x=.5, y=.0, count=7, spread=1.6, len=1.0, w0=18, w1=150,
                             color="#ffe8b0", opacity=.12)),
            L("far", 0.3, *far), L("mid", 0.56, *mid), L("action", 0.88, *act),
            L("fore", 1.12, *fore)]


# ---------------------------------------------------------------- 运镜

CAM = {
    "push":    (dict(x=0, y=6, scale=1.04, rot=-.3), dict(x=0, y=-6, scale=1.16, rot=.3)),
    "pushL":   (dict(x=44, y=8, scale=1.05, rot=.5), dict(x=-30, y=-8, scale=1.17, rot=-.4)),
    "pushR":   (dict(x=-44, y=8, scale=1.05, rot=-.5), dict(x=30, y=-8, scale=1.17, rot=.4)),
    "pull":    (dict(x=0, y=-6, scale=1.19, rot=.3), dict(x=0, y=6, scale=1.04, rot=-.2)),
    "panL":    (dict(x=74, y=4, scale=1.10, rot=.2), dict(x=-74, y=-4, scale=1.12, rot=-.2)),
    "panR":    (dict(x=-74, y=4, scale=1.10, rot=-.2), dict(x=74, y=-4, scale=1.12, rot=.2)),
    "tiltUp":  (dict(x=0, y=30, scale=1.10, rot=0), dict(x=0, y=-18, scale=1.15, rot=0)),
    "tiltDn":  (dict(x=0, y=-24, scale=1.12, rot=0), dict(x=0, y=22, scale=1.17, rot=0)),
    "orbitL":  (dict(x=50, y=10, scale=1.06, rot=.8), dict(x=-38, y=-8, scale=1.19, rot=-.6)),
    "orbitR":  (dict(x=-50, y=10, scale=1.06, rot=-.8), dict(x=38, y=-8, scale=1.19, rot=.6)),
    "slow":    (dict(x=-10, y=4, scale=1.05, rot=.1), dict(x=12, y=-4, scale=1.12, rot=-.1)),
    "hard":    (dict(x=0, y=12, scale=1.02, rot=.4), dict(x=0, y=-12, scale=1.26, rot=-.4)),
    "wide":    (dict(x=0, y=-6, scale=1.24, rot=-.2), dict(x=0, y=6, scale=1.02, rot=.2)),
    "driftL":  (dict(x=-40, y=2, scale=1.12, rot=0), dict(x=44, y=-6, scale=1.16, rot=.1)),
    "driftR":  (dict(x=40, y=2, scale=1.12, rot=0), dict(x=-44, y=-6, scale=1.16, rot=-.1)),
}


def camera(preset):
    f, t = CAM[preset]
    return {"from": f, "to": t, "ease": "power1.inOut"}


# ---------------------------------------------------------------- 人物

HEAD_Y = 540.0
HEAD_R = 24.0


def E(role, x, s=1.55, facing="right", pose="stand", color=None, weapon=None, y=None, ground=None):
    """人物。默认把头顶放在画面中线 y≈540（构图口径），脚底锚点由 s 反推。"""
    if y is None:
        y = (HEAD_Y + (157.0 + HEAD_R) * s) / 1080.0
    c = {"role": role, "x": x, "y": round(y, 3), "s": s, "facing": facing, "pose": pose}
    if color:
        c["color"] = color
    if weapon:
        c["weapon"] = weapon
    if ground is not None:
        c["y"] = ground
    return c


def S(name, **kw):
    """场景引用：(名字, 参数)。名字对应 SCENES 表里 sc_<名字>。"""
    return (name, kw)


def BEAT(scene, chars=None, cam="push", wipe=False, title=None, kicker=None, sub=None,
         hook=False, seal=None, **kw):
    """一个分镜。scene 为场景名、S(名字, 参数) 或直接给定的层列表。"""
    d = {"scene": scene, "chars": chars or [], "cam": cam, "wipe": wipe,
         "title": title, "kicker": kicker, "sub": sub, "hook": hook, "seal": seal}
    if kw:
        d["opts"] = kw
    return d


BEATS = {}
def add(start, beats):
    for i, b in enumerate(beats):
        BEATS[start + i] = b


__all__ = ["BEATS", "add", "BEAT", "E", "PAL", "C"]
# __BEATS_BELOW__

EM, OF, GE, SD, SC, WO, MO, NM = ("emperor", "official", "general", "soldier",
                                  "scholar", "woman", "monk", "nomad")


# ======================================================== 开场 + 秦（1-56）
add(1, [
    BEAT(S("hook"),
         [E(EM, .20, 1.65, ground=.995), E(EM, .80, 1.65, ground=.995, facing="left")],
         cam="hard", hook=True,
         title="四百二十二把椅子", kicker="公元前221年 — 1912年",
         sub="两千年 · 四百二十二人"),
    BEAT(S("twothrones"),
         [E(EM, .34, 1.95, ground=.86), E(EM, .66, 1.95, ground=.86, facing="left")],
         cam="slow"),
    BEAT(S("city", pal="gold"),
         [E(EM, .26, 1.85, ground=.88), E(EM, .44, 1.9, ground=.885),
          E(EM, .62, 1.85, ground=.88), E(WO, .80, .92, ground=.93)],
         cam="panL"),
    BEAT(S("object", pal="dusk", obj="coin"), cam="push"),
])

add(5, [
    BEAT(S("portrait", pal="gold"), [E(EM, .5, 1.6)], cam="push", wipe=True,
         title="秦始皇", kicker="秦 · 前259 — 前210"),
    BEAT(S("city", pal="autumn"),
         [E(WO, .44, 1.8, ground=.88), E(WO, .58, .9, ground=.92)], cam="slow"),
    BEAT(S("city", pal="gloom"),
         [E(OF, .40, 1.8, ground=.88), E(WO, .55, 1.75, ground=.885),
          E(WO, .66, .9, ground=.92)], cam="pushL"),
    BEAT(S("city", pal="rain"),
         [E(WO, .42, 1.8, ground=.88), E(WO, .54, .9, ground=.92),
          E(SD, .70, 1.82, ground=.89, weapon="spear"),
          E(SD, .80, 1.8, ground=.89, weapon="spear")], cam="panR"),
    BEAT(S("market", pal="gold"),
         [E(SC, .38, 1.75, ground=.88), E(OF, .62, 1.78, ground=.88)], cam="pushR"),
    BEAT(S("feast", pal="gold"),
         [E(SC, .30, 1.7, ground=.87), E(WO, .50, 1.75, ground=.88),
          E(OF, .70, 1.7, ground=.87)], cam="slow"),
    BEAT(S("pass", pal="day"),
         [E(WO, .44, 1.7, ground=.87), E(SD, .64, 1.75, ground=.88, weapon="spear")],
         cam="push"),
    BEAT(S("court", pal="imperial"),
         [E(EM, .50, 1.6), E(OF, .72, 1.5, facing="left")], cam="tiltUp"),
    BEAT(S("court", pal="night"),
         [E(OF, .34, 1.6, facing="right"), E(WO, .55, 1.62, facing="left"),
          E(OF, .74, 1.55, facing="left", weapon="dagger")], cam="slow"),
    BEAT(S("battle", pal="dusk"),
         [E(EM, .52, 1.6, pose="raise", weapon="sword")], cam="hard"),
    BEAT(S("court", pal="imperial"),
         [E(EM, .52, 1.6), E(OF, .80, 1.45, facing="left")], cam="pushL"),
    BEAT(S("map", pal="day", banners=6), cam="wide"),
    BEAT(S("battle", pal="dusk", embers=True), cam="panL"),
    BEAT(S("map", pal="dusk", banners=4), cam="panR"),
    BEAT(S("city", pal="gold", surrender=True), cam="pull"),
    BEAT(S("court", pal="imperial", variant="audience", crowd=False),
         [E(SC, .40, 1.62, weapon="dagger"), E(EM, .64, 1.6, pose="brace")],
         cam="hard", wipe=True),
    BEAT(S("court", pal="gold", variant="audience", crowd=False),
         [E(SC, .44, 1.62, pose="lunge", weapon="dagger"), E(EM, .66, 1.6, pose="brace")],
         cam="orbitR"),
    BEAT(S("battle", pal="dusk", embers=True), cam="pushR"),
    BEAT(S("portrait", pal="gold"), [E(EM, .5, 1.62)], cam="tiltUp"),
    BEAT(S("object", pal="gold", obj="seal", seal="皇"), cam="push"),
    BEAT(S("court", pal="imperial"), [E(EM, .5, 1.58)], cam="pull"),
    BEAT(S("map", pal="day", banners=6), cam="wide"),
    BEAT(S("court", pal="imperial", crowd=True), cam="slow"),
    BEAT(S("study", pal="autumn", obj="slips"),
         [E(SC, .40, 1.72), E(SC, .60, 1.68, facing="left")], cam="pushL"),
    BEAT(S("wall", pal="snow"), cam="pull"),
    BEAT(S("plain", pal="day"), cam="driftR"),
    BEAT(S("study", pal="night", obj="scroll"), [E(EM, .44, 1.6)], cam="slow"),
    BEAT(S("execution", pal="gloom", crowd=True),
         [E(SD, .26, 1.7, weapon="spear"), E(SD, .74, 1.7, weapon="spear", facing="left")],
         cam="tiltDn"),
    BEAT(S("portrait", pal="gloom"), [E(EM, .5, 1.58)], cam="slow"),
    BEAT(S("burning", pal="fire"), cam="hard", wipe=True),
    BEAT(S("sea", pal="night", junks=3),
         [E(SC, .34, 1.7), E(WO, .52, .92, ground=.8), E(WO, .62, .9, ground=.8)],
         cam="panR"),
    BEAT(S("sea", pal="night", junks=1), cam="pull"),
    BEAT(S("tomb", pal="night", text="陵"), cam="tiltDn"),
    BEAT(S("pass", pal="dusk"),
         [E(EM, .48, 1.6), E(OF, .68, 1.5, facing="left"),
          E(SD, .26, 1.65, weapon="spear")], cam="push"),
    BEAT(S("study", pal="night", obj="scroll"),
         [E(EM, .40, 1.6), E(OF, .64, 1.5, facing="left")], cam="slow"),
    BEAT(S("study", pal="night", obj="scroll"),
         [E(OF, .50, 1.62, weapon="dagger")], cam="pushR"),
    BEAT(S("court", pal="night"),
         [E(OF, .32, 1.55), E(OF, .50, 1.6), E(OF, .68, 1.55, facing="left")],
         cam="orbitL"),
    BEAT(S("court", pal="imperial"),
         [E(OF, .40, 1.62, pose="raise"), E(EM, .66, 1.5, facing="left")], cam="panL"),
    BEAT(S("camp", pal="rain", fire=True),
         [E(SD, .42, 1.7, pose="raise", weapon="spear"),
          E(SD, .56, 1.72, pose="raise", weapon="sword")], cam="hard", wipe=True),
    BEAT(S("battle", pal="dusk", embers=True),
         [E(GE, .44, 1.62, pose="raise", weapon="sword")], cam="pushR"),
    BEAT(S("map", pal="dusk", banners=3), cam="wide"),
    BEAT(S("city", pal="gold", surrender=True),
         [E(EM, .46, 1.7, ground=.88), E(OF, .64, 1.6, ground=.87, facing="left")],
         cam="pull"),
    BEAT(S("object", pal="gloom", obj="coin"), cam="slow"),
])

add(48, [
    BEAT(S("burning", pal="gloom"), cam="slow", wipe=True),
    BEAT(S("wall", pal="snow"), cam="panL"),
    BEAT(S("tomb", pal="day", text="陵"), cam="tiltDn"),
    BEAT(S("camp", pal="night", fire=False), cam="push"),
    BEAT(S("wall", pal="snow"), cam="driftL"),
    BEAT(S("wall", pal="snow"), cam="pull"),
    BEAT(S("court", pal="imperial"), cam="slow"),
    BEAT(S("court", pal="night", crowd=True), cam="orbitR"),
    BEAT(S("object", pal="gold", obj="book"), cam="pull"),
])


# ======================================================== 汉（57-131）
add(57, [
    BEAT(S("portrait", pal="gold"), [E(EM, .5, 1.6)], cam="push", wipe=True,
         title="汉高祖", kicker="汉 · 前202 — 前195"),
    BEAT(S("market", pal="day"), [E(OF, .48, 1.7, ground=.88)], cam="slow"),
    BEAT(S("battle", pal="dusk"), [E(GE, .46, 1.6, pose="raise", weapon="sword")],
         cam="hard"),
    BEAT(S("city", pal="day"), [E(OF, .46, 1.78, ground=.88)], cam="slow"),
    BEAT(S("feast", pal="gold"),
         [E(GE, .30, 1.72, ground=.87, weapon="sword"),
          E(OF, .50, 1.72, ground=.87),
          E(GE, .72, 1.7, ground=.87, facing="left")], cam="orbitL", wipe=True),
    BEAT(S("map", pal="day", banners=2), cam="panR"),
    BEAT(S("pass", pal="night"),
         [E(GE, .38, 1.68, ground=.87, pose="run"),
          E(OF, .62, 1.66, ground=.87, pose="run")], cam="pushR"),
    BEAT(S("object", pal="gold", obj="none",
           extra=[sh("altar", x=.5, y=.72, s=1.2)]),
         [E(EM, .40, 1.62), E(GE, .62, 1.62, facing="left")], cam="tiltUp"),
    BEAT(S("battle", pal="dusk", embers=True),
         [E(GE, .46, 1.62, pose="lunge", weapon="sword")], cam="hard"),
    BEAT(S("portrait", pal="gold", prop="crown"), [E(EM, .5, 1.6)], cam="pull"),
    BEAT(S("court", pal="imperial"), cam="orbitR"),
    BEAT(S("execution", pal="gloom", crowd=True),
         [E(GE, .30, 1.7, weapon="sword"), E(GE, .50, 1.7, weapon="sword"),
          E(GE, .70, 1.7, weapon="sword", facing="left")], cam="tiltDn"),
    BEAT(S("snow", pal="snow", army=True), [E(EM, .5, 1.6)], cam="pull"),
    BEAT(S("steppe", pal="night", yurts=1, cavalry=0),
         [E(OF, .40, 1.65, ground=.87), E(WO, .62, 1.68, ground=.88, facing="left")],
         cam="slow"),
    BEAT(S("steppe", pal="dusk", yurts=2, cavalry=0),
         [E(WO, .54, 1.7, ground=.88)], cam="pushL"),
    BEAT(S("feast", pal="gold"), [E(EM, .46, 1.62, pose="raise")], cam="slow"),
    BEAT(S("court", pal="imperial"),
         [E(WO, .5, 1.62), E(OF, .30, 1.55, facing="right"),
          E(OF, .72, 1.55, facing="left")], cam="pushR"),
    BEAT(S("court", pal="night"),
         [E(OF, .38, 1.6), E(OF, .62, 1.6, facing="left")], cam="hard"),
    BEAT(S("plain", pal="day"), cam="driftR"),
    BEAT(S("market", pal="gold"), cam="slow"),
    BEAT(S("study", pal="day", obj="scroll"), [E(EM, .46, 1.62)], cam="push"),
    BEAT(S("court", pal="day"),
         [E(WO, .42, 1.66), E(OF, .62, 1.6, facing="left")], cam="slow"),
    BEAT(S("battle", pal="dusk"), cam="hard"),
])

add(80, [
    BEAT(S("portrait", pal="gold"), [E(EM, .5, 1.62)], cam="push", wipe=True,
         title="汉武帝", kicker="汉 · 前141 — 前87"),
    BEAT(S("battle", pal="dusk", embers=True), cam="pull"),
    BEAT(S("map", pal="day", banners=8), cam="wide"),
    BEAT(S("market", pal="gold"), [E(OF, .46, 1.62, ground=.87)], cam="pushL"),
    BEAT(S("study", pal="autumn", obj="book"),
         [E(SC, .38, 1.66), E(SC, .58, 1.64, facing="left")], cam="slow"),
    BEAT(S("cavalry", pal="steppe", n=3), cam="panR"),
    BEAT(S("battle", pal="steppe", embers=True), cam="hard"),
    BEAT(S("steppe", pal="steppe", yurts=0, cavalry=1),
         [E(GE, .40, 1.6, weapon="sword")], cam="tiltUp"),
    BEAT(S("steppe", pal="dusk", yurts=1, cavalry=0),
         [E(OF, .40, 1.62, ground=.87), E(NM, .64, 1.66, ground=.88, facing="left")],
         cam="pull"),
    BEAT(S("map", pal="dusk", banners=4, arrows=True), cam="driftL"),
    BEAT(S("plain", pal="gloom"), cam="slow"),
    BEAT(S("execution", pal="rain", crowd=True), cam="panL"),
    BEAT(S("court", pal="night"),
         [E(EM, .36, 1.58), E(EM, .56, 1.6, facing="left"),
          E(WO, .74, 1.6, facing="left")], cam="orbitL"),
    BEAT(S("court", pal="night"),
         [E(EM, .38, 1.58), E(WO, .56, 1.62), E(WO, .68, .9, ground=.9)],
         cam="pushR"),
    BEAT(S("study", pal="night", obj="scroll"), [E(EM, .48, 1.58)], cam="slow"),
])

add(95, [
    BEAT(S("court", pal="gold"), [E(OF, .5, 1.62)], cam="push", wipe=True),
    BEAT(S("court", pal="day"), [E(EM, .44, 1.5), E(OF, .64, 1.58)], cam="slow"),
    BEAT(S("court", pal="night"),
         [E(OF, .40, 1.6), E(EM, .64, 1.52, facing="left")], cam="tiltDn"),
    BEAT(S("market", pal="day"),
         [E(EM, .42, 1.7, ground=.88), E(OF, .62, 1.66, ground=.87, facing="left")],
         cam="pushL"),
    BEAT(S("court", pal="gloom"),
         [E(EM, .28, 1.55), E(EM, .5, 1.55), E(EM, .72, 1.55)], cam="pull"),
    BEAT(S("court", pal="gold"), [E(SC, .5, 1.62)], cam="slow"),
    BEAT(S("court", pal="imperial"), [E(OF, .48, 1.6, pose="raise")], cam="hard",
         wipe=True),
    BEAT(S("study", pal="autumn", obj="slips"),
         [E(SC, .44, 1.64), E(SC, .62, 1.6, facing="left")], cam="panR"),
    BEAT(S("object", pal="gold", obj="seal", seal="印"), cam="push"),
    BEAT(S("battle", pal="fire", embers=True), cam="hard"),
])

add(105, [
    BEAT(S("portrait", pal="gold"), [E(EM, .5, 1.6)], cam="push", wipe=True,
         title="光武帝", kicker="东汉 · 25 — 57"),
    BEAT(S("plain", pal="day"), [E(OF, .5, 1.7, ground=.88)], cam="slow"),
    BEAT(S("plain", pal="day"),
         [E(OF, .46, 1.68, ground=.88), E(GE, .64, 1.66, ground=.88, facing="left")],
         cam="pushR"),
    BEAT(S("battle", pal="dusk"), [E(EM, .5, 1.62, pose="raise")], cam="hard"),
    BEAT(S("city", pal="day"), cam="pull"),
    BEAT(S("court", pal="gold", crowd=True), cam="panL"),
    BEAT(S("court", pal="day"), cam="slow"),
    BEAT(S("pass", pal="dusk"), [E(GE, .48, 1.6, pose="raise")], cam="tiltUp",
         wipe=True),
    BEAT(S("study", pal="autumn", obj="slips"), [E(SC, .5, 1.64)], cam="push"),
    BEAT(S("court", pal="day"), [E(EM, .42, 1.45), E(EM, .62, 1.42)], cam="pull"),
    BEAT(S("court", pal="imperial"),
         [E(EM, .30, 1.42), E(EM, .5, 1.45), E(EM, .70, 1.4)], cam="slow"),
    BEAT(S("tomb", pal="night", text="陵"), cam="tiltDn"),
    BEAT(S("court", pal="imperial"),
         [E(EM, .44, 1.42), E(WO, .62, 1.58)], cam="push"),
    BEAT(S("court", pal="night"),
         [E(OF, .40, 1.58), E(MO, .62, 1.6, facing="left")], cam="orbitR"),
    BEAT(S("court", pal="gloom"), cam="panR"),
    BEAT(S("study", pal="autumn"),
         [E(SC, .38, 1.64), E(SC, .56, 1.62), E(SC, .72, 1.6, facing="left")],
         cam="pushL"),
    BEAT(S("execution", pal="gloom", crowd=True),
         [E(SC, .40, 1.66), E(SD, .66, 1.66, weapon="spear", facing="left")],
         cam="tiltDn"),
    BEAT(S("court", pal="night"),
         [E(GE, .46, 1.6, pose="raise"), E(OF, .70, 1.56, facing="left")], cam="hard"),
    BEAT(S("market", pal="gold"), [E(OF, .46, 1.64, ground=.87)], cam="panR"),
    BEAT(S("battle", pal="fire", embers=True),
         [E(SD, .44, 1.66, pose="raise", weapon="spear")], cam="hard", wipe=True),
    BEAT(S("camp", pal="dusk"),
         [E(GE, .42, 1.6), E(SD, .64, 1.6, weapon="spear")], cam="pull"),
    BEAT(S("city", pal="fire", fire=True), cam="push"),
    BEAT(S("court", pal="night"),
         [E(GE, .40, 1.6), E(EM, .64, 1.46, facing="left")], cam="slow"),
    BEAT(S("battle", pal="fire", embers=True), cam="hard", wipe=True),
    BEAT(S("river", pal="dusk", fleet=5, battle=True), cam="pushR"),
    BEAT(S("court", pal="gold"),
         [E(GE, .30, 1.6), E(GE, .5, 1.62), E(GE, .70, 1.58, facing="left")],
         cam="slow"),
    BEAT(S("court", pal="imperial"),
         [E(EM, .42, 1.52), E(OF, .64, 1.58, facing="left")], cam="pull"),
])


# ======================================================== 三国 · 晋 · 南北朝（132-177）
add(132, [
    BEAT(S("portrait", pal="gold"), [E(EM, .5, 1.6)], cam="push", wipe=True,
         title="三国", kicker="220 — 280"),
    BEAT(S("battle", pal="fire", embers=True),
         [E(GE, .46, 1.62, pose="raise", weapon="sword")], cam="hard"),
    BEAT(S("court", pal="imperial"),
         [E(EM, .28, 1.5), E(EM, .5, 1.55), E(EM, .72, 1.5)], cam="pull"),
    BEAT(S("court", pal="gold"), [E(OF, .5, 1.6)], cam="slow"),
    BEAT(S("court", pal="night"), [E(OF, .48, 1.6)], cam="slow"),
    BEAT(S("court", pal="night"),
         [E(OF, .42, 1.6, pose="brace"), E(EM, .68, 1.48, facing="left")],
         cam="hard", wipe=True),
    BEAT(S("city", pal="gold", surrender=True),
         [E(EM, .44, 1.7, ground=.88), E(OF, .64, 1.58, ground=.87, facing="left")],
         cam="push"),
    BEAT(S("portrait", pal="gloom"), [E(GE, .5, 1.6)], cam="slow"),
])

add(140, [
    BEAT(S("court", pal="imperial"), [E(EM, .5, 1.6)], cam="push", wipe=True),
    BEAT(S("map", pal="day", banners=5), cam="wide"),
    BEAT(S("object", pal="dusk", obj="coin"), cam="slow"),
    BEAT(S("court", pal="imperial", crowd=True), cam="panL"),
    BEAT(S("palace", pal="gold"),
         [E(WO, .34, 1.62, ground=.88), E(WO, .5, 1.6, ground=.88),
          E(EM, .68, 1.55, ground=.87, facing="left")], cam="driftR"),
    BEAT(S("feast", pal="gold"), [E(OF, .42, 1.6), E(OF, .64, 1.6, facing="left")],
         cam="panR"),
    BEAT(S("battle", pal="dusk"), cam="hard"),
    BEAT(S("city", pal="fire", fire=True), cam="pushR", wipe=True),
    BEAT(S("battle", pal="steppe", embers=True), cam="pull"),
    BEAT(S("city", pal="fire", fire=True), cam="tiltDn"),
    BEAT(S("court", pal="jade"), [E(EM, .5, 1.58)], cam="push"),
    BEAT(S("pass", pal="rain"),
         [E(OF, .30, 1.66), E(WO, .44, 1.64), E(OF, .58, 1.66),
          E(OF, .74, 1.62, facing="left")], cam="driftL"),
    BEAT(S("court", pal="jade"),
         [E(OF, .40, 1.6), E(EM, .62, 1.55, facing="left")], cam="slow"),
    BEAT(S("river", pal="jade"), [E(GE, .46, 1.62, pose="raise")], cam="pushR"),
    BEAT(S("court", pal="gloom"), cam="pull"),
    BEAT(S("battle", pal="gloom"), cam="wide", wipe=True),
    BEAT(S("river", pal="dusk", fleet=4, battle=True), cam="hard"),
    BEAT(S("map", pal="dusk", banners=6), cam="pull"),
    BEAT(S("battle", pal="steppe"), cam="panR"),
    BEAT(S("river", pal="jade"), cam="tiltUp"),
    BEAT(S("court", pal="imperial"), [E(GE, .5, 1.6)], cam="push", wipe=True),
    BEAT(S("map", pal="jade", banners=4), cam="wide"),
    BEAT(S("plain", pal="day"), [E(GE, .5, 1.68, ground=.88)], cam="pushL"),
    BEAT(S("river", pal="jade"), cam="driftR"),
    BEAT(S("battle", pal="rain"), cam="hard"),
    BEAT(S("city", pal="autumn"), cam="panL"),
    BEAT(S("court", pal="gold"),
         [E(EM, .42, 1.56), E(OF, .62, 1.58), E(OF, .78, 1.54, facing="left")],
         cam="slow"),
    BEAT(S("pass", pal="rain", soldiers=True),
         [E(OF, .40, 1.66, ground=.87), E(OF, .56, 1.64, ground=.87)],
         cam="push"),
    BEAT(S("execution", pal="gloom", crowd=True), cam="hard", wipe=True),
    BEAT(S("map", pal="gloom", banners=4), cam="pull"),
    BEAT(S("court", pal="night"), cam="panR"),
    BEAT(S("temple", pal="jade", pagoda=True),
         [E(MO, .48, 1.6, ground=.87), E(EM, .66, 1.55, ground=.87, facing="left")],
         cam="slow"),
    BEAT(S("temple", pal="gold", pagoda=True), [E(MO, .44, 1.62, ground=.87)],
         cam="pushL"),
    BEAT(S("city", pal="fire", fire=True), cam="hard", wipe=True),
    BEAT(S("tomb", pal="night", text="梁"), cam="tiltDn"),
    BEAT(S("temple", pal="rain", pagoda=True), cam="pull"),
    BEAT(S("river", pal="night", fleet=3, mist=True), cam="pushR"),
    BEAT(S("city", pal="night"),
         [E(EM, .40, 1.6, ground=.87), E(WO, .56, 1.62, ground=.88),
          E(SD, .72, 1.66, ground=.88, weapon="spear", facing="left")], cam="slow"),
])


# ======================================================== 隋（178-191）
add(178, [
    BEAT(S("object", pal="gloom", obj="coin"), cam="slow", wipe=True,
         title="隋", kicker="581 — 618"),
    BEAT(S("court", pal="imperial"), [E(EM, .5, 1.6)], cam="push"),
    BEAT(S("study", pal="autumn", obj="slips"),
         [E(SC, .40, 1.64), E(SC, .60, 1.6, facing="left")], cam="pushL"),
    BEAT(S("market", pal="gold"), cam="panR"),
    BEAT(S("river", pal="jade", fleet=4), cam="driftR"),
    BEAT(S("court", pal="night"),
         [E(EM, .38, 1.58), E(OF, .60, 1.56, facing="left"),
          E(OF, .76, 1.54, facing="left")], cam="slow"),
    BEAT(S("court", pal="imperial"), [E(EM, .5, 1.6)], cam="push", wipe=True),
    BEAT(S("river", pal="gold", fleet=5), cam="wide"),
    BEAT(S("study", pal="day", obj="book"), [E(SC, .5, 1.62)], cam="slow"),
    BEAT(S("battle", pal="dusk", arrows=True), cam="wide"),
    BEAT(S("battle", pal="snow", snow=True), cam="pull"),
    BEAT(S("burning", pal="gloom"), cam="hard"),
    BEAT(S("city", pal="night"),
         [E(EM, .42, 1.6, ground=.87), E(GE, .64, 1.62, ground=.88, facing="left")],
         cam="tiltDn"),
    BEAT(S("study", pal="night", obj="scroll"), [E(EM, .5, 1.6)], cam="slow"),
])

# ======================================================== 唐（192-229）
add(192, [
    BEAT(S("portrait", pal="gold"), [E(EM, .5, 1.6)], cam="push", wipe=True,
         title="唐", kicker="618 — 907"),
    BEAT(S("city", pal="night", crowd=False),
         [E(EM, .42, 1.62, ground=.87), E(GE, .64, 1.62, ground=.88, facing="left",
                                          weapon="sword")], cam="hard", wipe=True),
    BEAT(S("battle", pal="night", arrows=True), cam="pushR"),
    BEAT(S("court", pal="gold"), [E(EM, .5, 1.6)], cam="pull"),
    BEAT(S("court", pal="gold"),
         [E(EM, .40, 1.6), E(OF, .62, 1.58, facing="left")], cam="slow"),
    BEAT(S("city", pal="gold"), cam="driftR"),
    BEAT(S("execution", pal="day", crowd=False), cam="slow"),
    BEAT(S("steppe", pal="dusk", yurts=2, cavalry=1),
         [E(MO, .36, 1.6, ground=.87), E(WO, .62, 1.62, ground=.88, facing="left")],
         cam="panL"),
    BEAT(S("court", pal="gold"), [E(EM, .44, 1.52), E(OF, .66, 1.58)], cam="push"),
    BEAT(S("portrait", pal="imperial"), [E(WO, .5, 1.6)], cam="hard", wipe=True),
    BEAT(S("portrait", pal="gold"), [E(WO, .5, 1.6)], cam="push"),
    BEAT(S("palace", pal="gold"),
         [E(WO, .44, 1.6, ground=.88), E(EM, .64, 1.55, ground=.87, facing="left")],
         cam="slow"),
    BEAT(S("execution", pal="gloom", crowd=True), cam="panR"),
    BEAT(S("study", pal="autumn"), [E(SC, .44, 1.62), E(SC, .62, 1.6, facing="left")],
         cam="pushL"),
    BEAT(S("court", pal="imperial"),
         [E(WO, .42, 1.6), E(OF, .64, 1.58, facing="left")], cam="slow"),
    BEAT(S("court", pal="night"), [E(WO, .46, 1.58), E(OF, .68, 1.56)], cam="hard"),
    BEAT(S("tomb", pal="snow", text="唐"), cam="tiltUp"),
    BEAT(S("court", pal="night"),
         [E(WO, .36, 1.58), E(WO, .54, 1.6), E(GE, .72, 1.56, facing="left")],
         cam="panL"),
    BEAT(S("city", pal="gold", crowd=True), cam="wide", wipe=True),
    BEAT(S("market", pal="gold"), cam="panR"),
    BEAT(S("study", pal="autumn"),
         [E(SC, .36, 1.62), E(SC, .54, 1.6), E(SC, .70, 1.58, facing="left")],
         cam="slow"),
    BEAT(S("market", pal="day"), cam="driftL"),
    BEAT(S("object", pal="gloom", obj="coin"), cam="slow"),
    BEAT(S("camp", pal="dusk"), [E(SD, .46, 1.62, weapon="spear")], cam="push"),
    BEAT(S("map", pal="dusk", banners=10), cam="wide"),
    BEAT(S("camp", pal="night", fire=True), [E(GE, .48, 1.62)], cam="pushR"),
    BEAT(S("battle", pal="fire", embers=True), [E(GE, .44, 1.6, pose="raise")],
         cam="hard", wipe=True),
    BEAT(S("city", pal="fire", fire=True), cam="panL"),
    BEAT(S("pass", pal="dusk"),
         [E(EM, .38, 1.58), E(WO, .56, 1.6), E(SD, .74, 1.64, weapon="spear",
                                                 facing="left")], cam="tiltDn"),
    BEAT(S("camp", pal="dusk"),
         [E(EM, .42, 1.56), E(GE, .64, 1.6, facing="left")], cam="slow"),
    BEAT(S("court", pal="night"),
         [E(GE, .42, 1.6, weapon="dagger"), E(GE, .64, 1.6, facing="left")],
         cam="push"),
    BEAT(S("tomb", pal="dusk", text="唐"), cam="pull"),
    BEAT(S("plain", pal="gloom"), cam="slow"),
    BEAT(S("camp", pal="night"),
         [E(OF, .40, 1.58), E(GE, .62, 1.58, facing="left")], cam="panL"),
    BEAT(S("court", pal="night"),
         [E(OF, .44, 1.6, pose="raise"), E(EM, .68, 1.5, facing="left")], cam="hard"),
    BEAT(S("execution", pal="night", crowd=True), cam="tiltDn"),
    BEAT(S("battle", pal="fire", embers=True), cam="hard"),
    BEAT(S("city", pal="night"), [E(EM, .48, 1.56, ground=.87)], cam="pull"),
])


# ======================================================== 五代十国（230-242）
add(230, [
    BEAT(S("map", pal="gloom", banners=5), cam="wide", wipe=True,
         title="五代十国", kicker="907 — 960"),
    BEAT(S("camp", pal="dusk"),
         [E(GE, .30, 1.6), E(GE, .50, 1.62), E(GE, .70, 1.6, facing="left")],
         cam="panR"),
    BEAT(S("court", pal="gloom"), [E(OF, .5, 1.6)], cam="slow"),
    BEAT(S("battle", pal="night", embers=True), cam="hard"),
    BEAT(S("map", pal="gloom", banners=3), cam="pull"),
    BEAT(S("pass", pal="gloom"), cam="tiltDn"),
    BEAT(S("camp", pal="dusk"), [E(EM, .48, 1.6)], cam="push"),
    BEAT(S("cavalry", pal="steppe", n=3), cam="pushR"),
    BEAT(S("study", pal="gold", obj="scroll"), [E(EM, .5, 1.6)], cam="slow"),
    BEAT(S("tomb", pal="dusk", text="周"), cam="pull"),
    BEAT(S("study", pal="autumn", obj="book"), [E(SC, .46, 1.62)], cam="driftL"),
    BEAT(S("court", pal="imperial"), [E(EM, .42, 1.45), E(OF, .64, 1.56)], cam="slow"),
    BEAT(S("camp", pal="night", fire=True),
         [E(GE, .48, 1.62, pose="raise")], cam="hard", wipe=True),
])

# ======================================================== 宋（243-270）
add(243, [
    BEAT(S("portrait", pal="gold"), [E(EM, .5, 1.6)], cam="push",
         title="宋", kicker="960 — 1279"),
    BEAT(S("feast", pal="gold"),
         [E(EM, .36, 1.58), E(GE, .58, 1.6), E(GE, .76, 1.56, facing="left")],
         cam="slow"),
    BEAT(S("court", pal="gold"),
         [E(SC, .42, 1.6), E(GE, .64, 1.6, facing="left")], cam="pushL"),
    BEAT(S("court", pal="jade"), [E(OF, .40, 1.6), E(OF, .62, 1.6, facing="left")],
         cam="panL"),
    BEAT(S("camp", pal="dusk"), cam="pull"),
    BEAT(S("study", pal="autumn"), [E(SC, .48, 1.62)], cam="driftR"),
    BEAT(S("market", pal="gold"), cam="push"),
    BEAT(S("market", pal="gold"), cam="panR"),
    BEAT(S("market", pal="night"), cam="driftL"),
    BEAT(S("camp", pal="dusk"), cam="wide"),
    BEAT(S("battle", pal="gloom"), cam="pull"),
    BEAT(S("court", pal="jade"), cam="slow"),
    BEAT(S("city", pal="dusk"), cam="push", wipe=True),
    BEAT(S("wall", pal="snow"),
         [E(EM, .40, 1.6), E(OF, .62, 1.58, facing="left")], cam="pushR"),
    BEAT(S("object", pal="gloom", obj="coin"), cam="slow"),
    BEAT(S("study", pal="day", obj="book"), [E(SC, .48, 1.62)], cam="push"),
    BEAT(S("court", pal="gold"),
         [E(SC, .36, 1.58), E(OF, .64, 1.58, facing="left")], cam="panL"),
    BEAT(S("court", pal="night"), cam="pull"),
    BEAT(S("city", pal="fire", fire=True), cam="hard", wipe=True),
    BEAT(S("snow", pal="snow"),
         [E(EM, .40, 1.58, ground=.87), E(OF, .56, 1.54, ground=.87),
          E(WO, .70, 1.56, ground=.87, facing="left")], cam="tiltDn"),
    BEAT(S("market", pal="fire", fire=True), cam="pull"),
    BEAT(S("court", pal="jade"), [E(EM, .5, 1.58)], cam="push"),
    BEAT(S("city", pal="jade"), cam="driftR"),
    BEAT(S("court", pal="jade"), cam="slow"),
    BEAT(S("execution", pal="gloom", crowd=True),
         [E(GE, .46, 1.64, weapon="sword")], cam="hard"),
    BEAT(S("execution", pal="night", crowd=False),
         [E(GE, .50, 1.62)], cam="tiltUp"),
    BEAT(S("sea", pal="night", battle=True, junks=3),
         [E(OF, .40, 1.6), E(WO, .56, .9, ground=.8)], cam="pushR"),
    BEAT(S("sea", pal="night", junks=1), cam="pull"),
])

# ======================================================== 元（271-282）
add(271, [
    BEAT(S("portrait", pal="steppe"), [E(EM, .5, 1.6)], cam="push", wipe=True,
         title="元", kicker="1271 — 1368"),
    BEAT(S("map", pal="steppe", banners=4), cam="wide"),
    BEAT(S("cavalry", pal="steppe", n=4), cam="panR"),
    BEAT(S("court", pal="gold"), [E(EM, .5, 1.6)], cam="slow"),
    BEAT(S("city", pal="autumn"), cam="pull"),
    BEAT(S("court", pal="imperial", crowd=True), cam="slow"),
    BEAT(S("map", pal="autumn", banners=6), cam="wide"),
    BEAT(S("market", pal="gold"),
         [E(SC, .42, 1.6, ground=.87), E(SC, .60, 1.58, ground=.87, facing="left")],
         cam="slow"),
    BEAT(S("court", pal="gloom"), cam="panL"),
    BEAT(S("river", pal="gloom", battle=True, fleet=3), cam="hard"),
    BEAT(S("city", pal="fire", fire=True), cam="push"),
    BEAT(S("steppe", pal="dusk", yurts=2, cavalry=2), cam="pull"),
])


# ======================================================== 明（283-315）
add(283, [
    BEAT(S("portrait", pal="gold"), [E(EM, .5, 1.6)], cam="push", wipe=True,
         title="明", kicker="1368 — 1644"),
    BEAT(S("city", pal="day"),
         [E(WO, .34, .92, ground=.92), E(MO, .50, 1.5, ground=.89),
          E(OF, .66, 1.5, ground=.89, facing="left")], cam="slow"),
    BEAT(S("camp", pal="dusk"),
         [E(GE, .46, 1.6), E(SD, .66, 1.62, weapon="spear", facing="left")],
         cam="pull"),
    BEAT(S("court", pal="imperial"), [E(EM, .5, 1.6)], cam="push"),
    BEAT(S("palace", pal="gold"),
         [E(OF, .40, 1.58, ground=.88), E(OF, .62, 1.58, ground=.88, facing="left")],
         cam="slow"),
    BEAT(S("execution", pal="gloom", crowd=True), cam="tiltDn"),
    BEAT(S("execution", pal="night", crowd=True), cam="hard"),
    BEAT(S("study", pal="day", obj="scroll"), [E(EM, .5, 1.6)], cam="slow"),
    BEAT(S("court", pal="gold"), cam="pull"),
    BEAT(S("battle", pal="dusk", embers=True), cam="pushR", wipe=True),
    BEAT(S("city", pal="fire", fire=True), cam="push"),
    BEAT(S("harbor", pal="day", junks=4), cam="panR"),
    BEAT(S("sea", pal="day", junks=4), cam="wide"),
    BEAT(S("map", pal="day", banners=3, arrows=True), cam="driftR"),
    BEAT(S("harbor", pal="gloom", junks=1), cam="pull"),
    BEAT(S("market", pal="gold"), cam="pushL"),
    BEAT(S("battle", pal="snow", snow=True), cam="hard", wipe=True),
    BEAT(S("wall", pal="snow"), [E(OF, .46, 1.6)], cam="push"),
    BEAT(S("execution", pal="gloom"), [E(OF, .5, 1.62)], cam="tiltDn"),
    BEAT(S("court", pal="gold"),
         [E(EM, .40, 1.58), E(OF, .64, 1.58, facing="left")], cam="panL"),
    BEAT(S("palace", pal="gloom"), cam="slow"),
    BEAT(S("court", pal="night"),
         [E(EM, .42, 1.58), E(WO, .62, 1.6, facing="left")], cam="hard"),
    BEAT(S("court", pal="gold"), [E(EM, .40, 1.45), E(OF, .64, 1.58)], cam="push"),
    BEAT(S("market", pal="gold"), cam="slow"),
    BEAT(S("palace", pal="night"), cam="pull"),
    BEAT(S("battle", pal="snow", snow=True), cam="hard", wipe=True),
    BEAT(S("court", pal="night"),
         [E(OF, .44, 1.6), E(EM, .68, 1.46, facing="left")], cam="pushR"),
    BEAT(S("court", pal="gloom"), [E(EM, .5, 1.58)], cam="panL"),
    BEAT(S("execution", pal="gloom", crowd=True), cam="tiltDn"),
    BEAT(S("study", pal="night", obj="scroll"), [E(EM, .5, 1.56)], cam="slow"),
    BEAT(S("plain", pal="snow"), cam="pull"),
    BEAT(S("city", pal="fire", fire=True), cam="hard"),
    BEAT(S("tomb", pal="dusk", text="明"), cam="pull"),
])

# ======================================================== 清（316-354）
add(316, [
    BEAT(S("pass", pal="gloom"), cam="push", wipe=True,
         title="清", kicker="1644 — 1912"),
    BEAT(S("pass", pal="dusk", soldiers=True),
         [E(GE, .40, 1.62, ground=.87), E(SD, .62, 1.64, ground=.88, weapon="spear")],
         cam="pushR"),
    BEAT(S("court", pal="gold"),
         [E(EM, .42, 1.56), E(WO, .62, 1.6, facing="left")], cam="slow"),
    BEAT(S("court", pal="imperial"), [E(EM, .46, 1.45), E(OF, .66, 1.56)], cam="push"),
    BEAT(S("battle", pal="dusk"), [E(EM, .5, 1.56, pose="raise")], cam="hard"),
    BEAT(S("study", pal="gold", obj="map"), [E(EM, .42, 1.58)], cam="slow"),
    BEAT(S("cavalry", pal="steppe", n=4), cam="pushR"),
    BEAT(S("study", pal="day", obj="book"),
         [E(EM, .42, 1.56), E(SC, .64, 1.6, facing="left")], cam="slow"),
    BEAT(S("map", pal="gold", banners=6), cam="wide"),
    BEAT(S("portrait", pal="gold"), [E(EM, .5, 1.6)], cam="pull"),
    BEAT(S("court", pal="imperial"), [E(EM, .5, 1.6)], cam="push", wipe=True),
    BEAT(S("court", pal="night"),
         [E(EM, .44, 1.58), E(EM, .30, 1.5, facing="right"),
          E(EM, .76, 1.5, facing="left")], cam="orbitL"),
    BEAT(S("study", pal="night", obj="scroll"), [E(EM, .48, 1.58)], cam="pushL"),
    BEAT(S("study", pal="night", obj="slips"), [E(EM, .5, 1.56)], cam="slow"),
    BEAT(S("court", pal="gold"), [E(EM, .5, 1.6)], cam="push"),
    BEAT(S("map", pal="gold", banners=8), cam="panR"),
    BEAT(S("map", pal="gold", banners=8), cam="pull"),
    BEAT(S("court", pal="gold"),
         [E(EM, .28, 1.5), E(EM, .5, 1.55), E(EM, .72, 1.5)], cam="slow"),
    BEAT(S("harbor", pal="day", junks=2), cam="driftL"),
    BEAT(S("execution", pal="gloom"), [E(SC, .5, 1.62)], cam="hard"),
    BEAT(S("harbor", pal="gloom", junks=1), cam="slow"),
    BEAT(S("court", pal="gold"), [E(EM, .44, 1.55)], cam="pull"),
    BEAT(S("battle", pal="dusk"), cam="pull"),
    BEAT(S("court", pal="gloom"), [E(EM, .5, 1.58)], cam="slow"),
    BEAT(S("sea", pal="rain", battle=True, junks=3), cam="hard", wipe=True),
    BEAT(S("object", pal="gloom", obj="scroll"), cam="push"),
    BEAT(S("battle", pal="fire", embers=True), cam="wide"),
    BEAT(S("burning", pal="fire"), cam="hard", wipe=True),
    BEAT(S("court", pal="night"),
         [E(WO, .44, 1.6), E(OF, .30, 1.54, facing="right"),
          E(OF, .70, 1.54, facing="left")], cam="pushR"),
    BEAT(S("court", pal="imperial"), [E(WO, .5, 1.6)], cam="slow"),
    BEAT(S("harbor", pal="dusk", junks=4), cam="panR"),
    BEAT(S("sea", pal="rain", battle=True, junks=3), cam="hard"),
    BEAT(S("palace", pal="night"),
         [E(EM, .42, 1.56), E(SC, .62, 1.58, facing="left")], cam="tiltDn"),
    BEAT(S("burning", pal="fire"), cam="push"),
    BEAT(S("study", pal="day", obj="slips"), cam="pull"),
    BEAT(S("city", pal="gold", crowd=True), cam="wide"),
    BEAT(S("court", pal="imperial"), [E(EM, .46, 1.45), E(WO, .64, 1.58)],
         cam="pull"),
    BEAT(S("tomb", pal="dusk", text="清"), cam="slow"),
    BEAT(S("object", pal="gloom", obj="crown"), cam="tiltDn"),
])

# ======================================================== 终章（355-370）
add(355, [
    BEAT(S("finale", pal="gold"), cam="pull", wipe=True,
         title="两千年", kicker="前221 — 1912"),
    BEAT(S("court", pal="imperial", crowd=True), cam="slow"),
    BEAT(S("twothrones"), [E(EM, .34, 1.85, ground=.86), E(EM, .66, 1.85, ground=.86,
                                                         facing="left")], cam="push"),
    BEAT(S("tomb", pal="night", text="史"),
         [E(EM, .28, 1.6, ground=.87), E(EM, .5, 1.62, ground=.87),
          E(EM, .72, 1.6, ground=.87, facing="left")], cam="panL"),
    BEAT(S("court", pal="imperial"), cam="slow"),
    BEAT(S("study", pal="gold", obj="book"), cam="push"),
    BEAT(S("study", pal="gold", obj="slips"), cam="pushR"),
    BEAT(S("map", pal="gold", banners=4, arrows=True), cam="panR"),
    BEAT(S("court", pal="gold"), [E(EM, .40, 1.55), E(EM, .62, 1.55)], cam="panL"),
    BEAT(S("finale", pal="gold", book=False, map_=False), cam="pull"),
    BEAT(S("finale", pal="dusk", wall=False), cam="slow"),
    BEAT(S("finale", pal="gold"), cam="pull"),
    BEAT(S("map", pal="gold", banners=6), cam="slow"),
    BEAT(S("object", pal="gold", obj="book"), cam="push"),
    BEAT(S("object", pal="gold", obj="book"), cam="pull"),
    BEAT(S("finale", pal="gold"), cam="pull"),
])
