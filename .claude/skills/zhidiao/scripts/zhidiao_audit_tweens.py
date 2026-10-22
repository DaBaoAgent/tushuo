# -*- coding: utf-8 -*-
"""完整审计 v2：解析 #id > g 子元素 transform，覆盖全部 fromTo x/y 覆盖问题。"""
import re, io, os

ROOT = "films/china-history-20min"

def block_of(html, gid):
    """取 id=gid 的 <g> 元素内部 HTML（按标签配对）"""
    m = re.search(r'<g\b[^>]*\bid="' + re.escape(gid) + r'"[^>]*>', html)
    if not m: return None
    i = m.end(); depth = 1
    while i < len(html) and depth > 0:
        nxt_open = html.find("<g", i); nxt_close = html.find("</g>", i)
        if nxt_close == -1: break
        if nxt_open != -1 and nxt_open < nxt_close:
            depth += 1; i = nxt_open + 2
        else:
            depth -= 1; i = nxt_close + 4
    return html[m.end():i] if depth == 0 else None

def child_translates(html, gid):
    """父 g 内直接子 <g transform=translate> 列表"""
    blk = block_of(html, gid)
    if blk is None: return []
    out = []
    depth = 0
    for mm in re.finditer(r'<g\b[^>]*>|</g>', blk):
        t = mm.group(0)
        if t.startswith("</"):
            depth -= 1
        else:
            if depth == 0:
                trm = re.search(r'transform="translate\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)', t)
                out.append((float(trm.group(1)), float(trm.group(2))) if trm else None)
            depth += 1
    return [o for o in out if o]

def parse_targets(html):
    """id -> [(x,y),...]（元素自身 + > g 子元素）"""
    tr = {}
    for tag in re.finditer(r"<g\b[^>]*>", html):
        t = tag.group(0)
        idm = re.search(r'id="([^"]+)"', t)
        trm = re.search(r'transform="translate\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)', t)
        if idm and trm:
            tr.setdefault(idm.group(1), []).append((float(trm.group(1)), float(trm.group(2))))
    return tr

def main():
    targets = [("p01-ch01", os.path.join(ROOT, "ch01", "index.html"))]
    for p in range(2, 27):
        f = os.path.join(ROOT, "parts-src", f"p{p:02d}-scenes.html")
        if os.path.exists(f): targets.append((f"p{p:02d}", f))
    total = 0
    for name, path in targets:
        html = io.open(path, encoding="utf-8").read()
        lines = html.split("\n")
        flags = []
        for mm in re.finditer(r'tl\.fromTo\(\s*"([^"]+)"\s*,\s*\{', html):
            lineno = html[:mm.start()].count("\n") + 1
            sel = mm.group(1)
            seg = html[mm.end()-1:]; objs = []; depth = 0; cur = ""
            for ch in seg:
                if ch == "{":
                    depth += 1
                    if depth == 1: cur = ""; continue
                if ch == "}":
                    depth -= 1
                    if depth == 0:
                        objs.append(cur)
                        if len(objs) == 2: break
                        continue
                if depth >= 1: cur += ch
            if len(objs) < 2: continue
            fxy = {}; txy = {}
            for key in ("x", "y"):
                m1 = re.search(r'\b' + key + r':\s*(-?[\d.]+)', objs[0])
                m2 = re.search(r'\b' + key + r':\s*(-?[\d.]+)', objs[1])
                if m1: fxy[key] = float(m1.group(1))
                if m2: txy[key] = float(m2.group(1))
            if not fxy and not txy: continue
            # 目标元素基位
            bases = []
            if " > " in sel:
                parent = sel.split(" > ")[0].lstrip("#")
                for b in child_translates(html, parent): bases.append(b)
            else:
                eid = sel.lstrip("#")
                bases = child_translates(html, eid) or []
                if not bases and eid in parse_targets(html):
                    pass
                # 元素自身带 attr 的情况
                tagm = re.search(r'<g\b[^>]*\bid="' + re.escape(eid) + r'"[^>]*>', html)
                if tagm:
                    trm = re.search(r'transform="translate\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)', tagm.group(0))
                    if trm: bases = [(float(trm.group(1)), float(trm.group(2)))] + bases
            if not bases: continue
            kind = "from覆盖" if fxy else "to绝对值"
            desc = (fxy or txy)
            flags.append((lineno, sel, kind, desc, bases[0]))
        if flags:
            print(f"===== {name} ({len(flags)}) =====")
            for lineno, sel, kind, desc, base in flags:
                d = ",".join(f"{k}:{v}" for k, v in desc.items())
                print(f"  L{lineno:<5} {sel:<24} {kind}({d}) base={base}")
            total += len(flags)
    print(f"\nTOTAL: {total}")

main()
