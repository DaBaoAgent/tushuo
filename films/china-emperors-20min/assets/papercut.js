/* jianying · 纸雕剪影舞台
 * 1080×1920，层叠纸片 + 剪影 + 纸纹。所有几何都是确定性的，便于 seek 渲染。
 */
(function (global) {
  "use strict";

  const W = 1920, H = 1080;
  const C = {
    paper: "#efe6d2",
    paper2: "#e2d4b8",
    shade: "#d9c9a8",
    ink: "#24211c",
    ink2: "#3a352d",
    red: "#b33a2b",
    red2: "#8e2b20",
    ochre: "#9a6b3f",
    teal: "#2f4b57",
    teal2: "#223841",
    gold: "#c9a24a",
    white: "#f7f0df",
  };

  let uid = 0;
  const nid = (p) => p + "-" + (++uid);
  const n = (v, d) => (typeof v === "number" ? v : d);

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  /* ---------- 基础剪影：带纸片投影 ---------- */
  function cut(body, fill, opts) {
    opts = opts || {};
    const dark = opts.shadow === false ? "" :
      `<g transform="translate(${n(opts.sx, 7)} ${n(opts.sy, 12)})" opacity="${n(opts.so, 0.18)}">${body.replace(/fill="[^"]*"/g, `fill="${C.ink}"`)}</g>`;
    // 纸边受光：极细的浅色切线，让纸片有“厚度”而不改变形状
    const edge = opts.edge === false || body.indexOf("<text") >= 0 ? "" :
      ` stroke="${opts.edge || C.white}" stroke-opacity="${n(opts.eo, 0.16)}" stroke-width="${n(opts.ew, 1.7)}"`;
    return `<g class="pc-cut${opts.cls ? " " + opts.cls : ""}">${dark}<g fill="${fill}"${edge}>${body}</g></g>`;
  }

  function poly(pts, fill, opts) {
    const body = `<polygon points="${pts.map((p) => Array.isArray(p) ? p.join(",") : p).join(" ")}"/>`;
    return cut(body, fill, opts);
  }

  function path(d, fill, opts) {
    return cut(`<path d="${d}"/>`, fill, opts);
  }

  function rect(x, y, w, h, fill, opts) {
    return cut(`<rect x="${x}" y="${y}" width="${w}" height="${h}"${opts && opts.rx ? ` rx="${opts.rx}"` : ""}/>`, fill, opts);
  }

  function circle(cx, cy, r, fill, opts) {
    return cut(`<circle cx="${cx}" cy="${cy}" r="${r}"/>`, fill, opts);
  }

  function text(x, y, s, size, fill, opts) {
    opts = opts || {};
    return `<text x="${x}" y="${y}" font-family="${opts.font || "PaperKai,serif"}" font-size="${size}" fill="${fill}" text-anchor="${opts.anchor || "middle"}" letter-spacing="${n(opts.ls, 2)}"${opts.weight ? ` font-weight="${opts.weight}"` : ""}>${esc(s)}</text>`;
  }

  /* ---------- 纸雕零件 ---------- */
  const P = {};

  P.mountain = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .78) * H, w = n(o.w, 1.2) * W, h = n(o.h, .34) * H;
    const left = x - w / 2, right = x + w / 2;
    const nPk = n(o.peaks, 5), seed = n(o.seed, 7);
    const steps = nPk * 2;
    const pts = [[left, y]];
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const env = .58 + .42 * Math.pow(Math.sin(Math.PI * t), .45);
      const jag = (((i * 37 + seed * 13) % 11) / 11);
      const jag2 = (((i * 71 + seed * 29) % 7) / 7);
      const drift = .5 + .5 * Math.cos(i * 1.7 + seed);
      const hh = i % 2
        ? h * env * (.5 + .5 * jag) * (.74 + .3 * jag2)
        : h * env * (.09 + .26 * jag2) * (.78 + .34 * drift);
      pts.push([left + w * t, y - hh]);
    }
    pts.push([right, y]);
    let body = `<polygon points="${pts.map((p) => p.join(",")).join(" ")}"/>`;
    const slope = (from, to, col, op) => `<path d="M ${from[0]} ${from[1]} L ${to[0]} ${to[1]} L ${to[0]} ${y} L ${from[0]} ${y} Z" fill="${col}" opacity="${op}"/>`;
    if (o.facet) {
      for (let i = 1; i < pts.length - 1; i += 2) {
        body += slope(pts[i], pts[i + 1], o.facet, .55);
      }
    }
    if (o.snow) {
      const sc = o.snow === true ? C.white : o.snow;
      for (let i = 1; i < pts.length - 1; i += 2) {
        const p = pts[i], cap = h * .085, ww = w * .045;
        body += `<path d="M ${p[0] - ww} ${p[1] + cap * 1.3} L ${p[0]} ${p[1]} L ${p[0] + ww} ${p[1] + cap} L ${p[0] + ww * .6} ${p[1] + cap * 2} L ${p[0] + ww * .2} ${p[1] + cap * 1.2} L ${p[0] - ww * .25} ${p[1] + cap * 2.2} L ${p[0] - ww * .6} ${p[1] + cap * 1.1} Z" fill="${sc}"/>`;
      }
    }
    if (o.light !== false) {
      for (let i = 1; i < pts.length - 2; i += 2) {
        const p = pts[i], q = pts[i + 1];
        body += `<path d="M ${p[0]} ${p[1]} L ${q[0]} ${q[1]} L ${q[0]} ${p[1] + h * .22} L ${p[0] + (q[0] - p[0]) * .45} ${p[1] + h * .16} Z" fill="${o.light || C.white}" opacity=".14"/>`;
      }
    }
    if (o.lines) {
      let ln = "";
      for (let i = 0; i < 5; i++) {
        const t0 = .12 + i * .17;
        const p0 = pts[Math.max(1, Math.round(t0 * (pts.length - 1)))];
        ln += `<path d="M ${p0[0]} ${p0[1] + h * .1} Q ${p0[0] + w * .06} ${p0[1] + h * .34} ${p0[0] + w * .02} ${y}"/>`;
      }
      body += `<g fill="none" stroke="${C.ink}" stroke-width="4" stroke-linecap="round" opacity=".18">${ln}</g>`;
    }
    return cut(body, o.color || C.ochre, { sx: 8, sy: 14, so: .16 });
  };

  P.ridge = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .82) * H, w = n(o.w, 1.4) * W, h = n(o.h, .13) * H;
    const pts = [[x - w / 2, y], [x - w * .38, y - h * .42], [x - w * .3, y - h * .7], [x - w * .2, y - h * .48],
      [x - w * .1, y - h * .9], [x - w * .02, y - h * .62], [x + w * .08, y - h * .5],
      [x + w * .18, y - h * .78], [x + w * .3, y - h * .96], [x + w * .4, y - h * .54], [x + w / 2, y]];
    return poly(pts, o.color || C.teal2, { sx: 6, sy: 10, so: .14 });
  };

  P.rays = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .18) * H;
    const count = n(o.count, 7), spread = n(o.spread, 1.1) * W;
    const len = n(o.len, 1.0) * H, w0 = n(o.w0, 22), w1 = n(o.w1, 130);
    const ang = n(o.ang, 0) * Math.PI / 180;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const X = (px, py) => x + px * ca - py * sa;
    const Y = (px, py) => y + px * sa + py * ca;
    let body = "";
    for (let i = 0; i < count; i++) {
      const k = count === 1 ? 0 : (i / (count - 1) - .5);
      const tx = k * spread, tw = w1 * (.55 + (i % 2) * .5);
      body += `<path d="M ${X(-w0 / 2, 0)} ${Y(-w0 / 2, 0)} L ${X(w0 / 2, 0)} ${Y(w0 / 2, 0)} L ${X(tx + tw / 2, len)} ${Y(tx + tw / 2, len)} L ${X(tx - tw / 2, len)} ${Y(tx - tw / 2, len)} Z"/>`;
    }
    return `<g class="pc-rays" opacity="${n(o.opacity, .18)}">${cut(body, o.color || C.gold, { shadow: false })}</g>`;
  };

  P.skygrad = (o) => {
    o = o || {};
    const id = nid("sg"), gid = nid("gl");
    const glow = o.glow ? `<defs><radialGradient id="${gid}" cx="50%" cy="50%" r="50%">
        <stop offset="0" stop-color="${o.glow}" stop-opacity="${n(o.glowO, .6)}"/>
        <stop offset="1" stop-color="${o.glow}" stop-opacity="0"/>
      </radialGradient></defs>
      <ellipse cx="${n(o.glowX, .5) * W}" cy="${n(o.glowY, .5) * H}" rx="${n(o.glowW, 1.0) * W}" ry="${n(o.glowH, .32) * H}" fill="url(#${gid})"/>` : "";
    return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${o.from || C.paper}"/>
      <stop offset=".58" stop-color="${o.mid || o.to || C.paper2}"/>
      <stop offset="1" stop-color="${o.to || C.shade}"/>
    </linearGradient></defs><rect width="${W}" height="${H}" fill="url(#${id})"/>${glow}`;
  };

  P.cloud = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .2) * H, s = n(o.s, 1);
    const body = `<g transform="translate(${x} ${y}) scale(${s})"><circle cx="-120" cy="20" r="44"/><circle cx="-70" cy="-6" r="56"/><circle cx="0" cy="-18" r="66"/><circle cx="70" cy="-4" r="52"/><circle cx="126" cy="22" r="40"/><rect x="-130" y="18" width="262" height="38" rx="19"/></g>`;
    const under = `<g transform="translate(${x + 10 * s} ${y + 26 * s}) scale(${s * 1.04})"><circle cx="-118" cy="18" r="38"/><circle cx="-66" cy="-4" r="50"/><circle cx="2" cy="-14" r="58"/><circle cx="72" cy="-2" r="46"/><circle cx="124" cy="20" r="36"/><rect x="-128" y="16" width="258" height="30" rx="15"/></g>`;
    return `<g class="pc-cloud">` + cut(under, C.ink, { shadow: false, so: 0, edge: false }).replace("fill=\"" + C.ink + "\"", "fill=\"" + C.ink + "\" opacity=\".07\"") +
      cut(body, o.color || C.white, { so: .10, sy: 8 }) + `</g>`;
  };

  P.sun = (o) => {
    o = o || {};
    const x = n(o.x, .78) * W, y = n(o.y, .18) * H, r = n(o.r, 92);
    const col = o.color || C.red;
    let rays = "";
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI + (i * Math.PI) / 10;
      const sp = .07 + (i % 2) * .03;
      const r0 = r * 1.08, r1 = r * (1.22 + (i % 2) * .12);
      rays += `<path d="M ${x + Math.cos(a) * r0} ${y + Math.sin(a) * r0} L ${x + Math.cos(a - sp) * r1} ${y + Math.sin(a - sp) * r1} L ${x + Math.cos(a + sp) * r1} ${y + Math.sin(a + sp) * r1} Z"/>`;
    }
    return `<g opacity=".5">${cut(rays, col, { shadow: false })}</g>` +
      `<circle cx="${x}" cy="${y}" r="${r * 2.1}" fill="${col}" opacity=".07"/>` +
      circle(x, y, r, col, { so: .12, sy: 10 }) +
      `<circle cx="${x}" cy="${y}" r="${r * .72}" fill="${C.gold}" opacity=".28"/>` +
      `<circle cx="${x}" cy="${y}" r="${r * .88}" fill="none" stroke="${C.gold}" stroke-width="${Math.max(3, r * .05)}" opacity=".7"/>`;
  };

  P.moon = (o) => {
    o = o || {};
    const x = n(o.x, .8) * W, y = n(o.y, .16) * H, r = n(o.r, 80);
    const dx = r * .44, r2 = r * .94;
    const d = `M ${x - r} ${y} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0 Z
      M ${x + dx - r2} ${y} a ${r2} ${r2} 0 1 0 ${2 * r2} 0 a ${r2} ${r2} 0 1 0 ${-2 * r2} 0 Z`;
    return cut(`<path fill-rule="evenodd" d="${d}"/>`, o.color || C.white, { so: .12 });
  };

  P.palace = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .82) * H, w = n(o.w, .85) * W, h = n(o.h, .34) * H;
    const left = x - w / 2, right = x + w / 2;
    const roofY = y - h * .56, baseY = y;
    const body = `
      <rect x="${left + w * .08}" y="${roofY + h * .1}" width="${w * .84}" height="${baseY - roofY - h * .1}"/>
      <path d="M ${left - w * .06} ${roofY} Q ${x} ${roofY - h * .28} ${right + w * .06} ${roofY} L ${right - w * .02} ${roofY + h * .12} Q ${x} ${roofY - h * .08} ${left + w * .02} ${roofY + h * .12} Z"/>
      <rect x="${left + w * .02}" y="${roofY - h * .04}" width="${w * .96}" height="${h * .045}"/>
      ${[-.3, -.1, .1, .3].map((k) => `<rect x="${x + w * k - 11}" y="${roofY + h * .12}" width="22" height="${baseY - roofY - h * .14}"/>`).join("")}
      <rect x="${left}" y="${baseY - h * .06}" width="${w}" height="${h * .06}"/>
    `;
    return cut(body, o.color || C.ink, { sx: 8, sy: 14, so: .18 });
  };

  P.hall = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .84) * H, w = n(o.w, .78) * W;
    const top = y - n(o.h, .5) * H;
    const body = `
      <rect x="${x - w / 2}" y="${top}" width="${w}" height="${y - top}"/>
      <path d="M ${x - w * .58} ${top + 34} Q ${x} ${top - 60} ${x + w * .58} ${top + 34} L ${x + w * .5} ${top + 88} Q ${x} ${top + 20} ${x - w * .5} ${top + 88} Z" fill="${C.red2}"/>
      ${[-.34, -.17, 0, .17, .34].map((k) => `<rect x="${x + w * k - 14}" y="${top + 40}" width="28" height="${y - top - 40}" opacity=".92"/>`).join("")}
      <rect x="${x - w * .3}" y="${top + (y - top) * .42}" width="${w * .6}" height="${(y - top) * .22}" fill="${C.red}"/>
    `;
    return cut(body, o.color || C.teal2, { so: .2, sx: 8, sy: 14 });
  };

  P.gate = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .82) * H, w = n(o.w, .82) * W, h = n(o.h, .4) * H;
    const door = o.door || C.paper;
    const dl = x - w * .18, dr = x + w * .18, dt = y - h * .62;
    const planks = `<g stroke="${C.ink}" stroke-width="3" opacity=".2" fill="none">
      ${[-.12, -.06, .06, .12].map((k) => `<path d="M ${x + w * k} ${dt + h * .06} L ${x + w * k} ${y - 2}"/>`).join("")}
      <path d="M ${dl + 4} ${dt + h * .22} L ${dr - 4} ${dt + h * .22}"/>
      <path d="M ${dl + 4} ${dt + h * .46} L ${dr - 4} ${dt + h * .46}"/>
    </g>
    <g fill="${C.gold}" opacity=".55">
      ${[[-.1, .14], [.1, .14], [-.1, .32], [.1, .32]].map(([kx, ky]) => `<circle cx="${x + w * kx}" cy="${dt + h * ky}" r="4.5"/>`).join("")}
    </g>`;
    const body = `
      <rect x="${x - w / 2}" y="${y - h}" width="${w}" height="${h}"/>
      <rect x="${dl}" y="${dt}" width="${w * .36}" height="${h * .62}" fill="${door}"/>
      <path d="M ${dl} ${dt} A ${w * .18} ${h * .2} 0 0 1 ${dr} ${dt}" fill="${door}"/>
      ${planks}
      <path d="M ${x - w * .56} ${y - h} Q ${x} ${y - h - 70} ${x + w * .56} ${y - h} L ${x + w * .5} ${y - h + 40} Q ${x} ${y - h - 30} ${x - w * .5} ${y - h + 40} Z" fill="${C.red2}"/>
      ${[-.42, -.28, .28, .42].map((k) => `<rect x="${x + w * k - 8}" y="${y - h - 24}" width="16" height="34"/>`).join("")}
    `;
    return cut(body, o.color || C.ink2, { sx: 8, sy: 14, so: .18 });
  };

  P.greatwall = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .7) * H, w = n(o.w, 1.3) * W;
    const left = x - w / 2;
    const pts = [[left, y]];
    for (let i = 1; i <= 6; i++) pts.push([left + w * i / 6, y - Math.sin(i * 1.2) * 60 - 40]);
    pts.push([x + w / 2, y + 40], [x + w / 2, y + 90], [left, y + 90]);
    let body = `<polygon points="${pts.map((p) => p.join(",")).join(" ")}"/>`;
    for (let i = 0; i < 7; i++) {
      const tx = left + w * (i / 6), ty = y - Math.sin(i * 1.2) * 60 - 40;
      body += `<rect x="${tx - 26}" y="${ty - 62}" width="52" height="64"/><rect x="${tx - 34}" y="${ty - 78}" width="68" height="18"/>`;
    }
    return cut(body, o.color || C.ink2, { sx: 10, sy: 16, so: .2 });
  };

  P.city = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .82) * H, w = n(o.w, 1.2) * W, s = n(o.s, 1);
    let body = `<rect x="${x - w / 2}" y="${y - 170}" width="${w}" height="170"/>`;
    for (let i = 0; i < 9; i++) {
      const tx = x - w / 2 + w * (i + .5) / 9;
      body += `<rect x="${tx - 26}" y="${y - 230 - (i % 3) * 10}" width="52" height="70"/>`;
      body += `<path d="M ${tx - 40} ${y - 230 - (i % 3) * 10} L ${tx} ${y - 278 - (i % 3) * 10} L ${tx + 40} ${y - 230 - (i % 3) * 10} Z"/>`;
    }
    if (s !== 1) body = `<g transform="translate(${x} ${y}) scale(${s}) translate(${-x} ${-y})">${body}</g>`;
    return cut(body, o.color || C.ink2, { sx: 8, sy: 14, so: .2 });
  };

  P.glow = (o) => {
    o = o || {};
    const id = nid("gw");
    return `<defs><radialGradient id="${id}" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="${o.color || C.gold}" stop-opacity="${n(o.opacity, .4)}"/>
      <stop offset="1" stop-color="${o.color || C.gold}" stop-opacity="0"/>
    </radialGradient></defs>
    <ellipse cx="${n(o.x, .5) * W}" cy="${n(o.y, .5) * H}" rx="${n(o.w, .4) * W}" ry="${n(o.h, .34) * H}" fill="url(#${id})"/>`;
  };

  P.pagoda = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .82) * H, s = n(o.s, 1);
    let body = "";
    for (let i = 0; i < 5; i++) {
      const yy = y - i * 86 * s, ww = (250 - i * 34) * s;
      body += `<path d="M ${x - ww / 2} ${yy} L ${x} ${yy - 56 * s} L ${x + ww / 2} ${yy} L ${x + ww * .42} ${yy + 20 * s} L ${x - ww * .42} ${yy + 20 * s} Z"/>`;
      body += `<rect x="${x - ww * .3}" y="${yy + 18 * s}" width="${ww * .6}" height="${58 * s}"/>`;
    }
    return cut(body, o.color || C.ochre, { sx: 8, sy: 14, so: .18 });
  };

  P.tree = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .85) * H, s = n(o.s, 1);
    const body = `<rect x="${x - 9 * s}" y="${y - 190 * s}" width="${18 * s}" height="${190 * s}"/>
      <circle cx="${x}" cy="${y - 245 * s}" r="${78 * s}"/><circle cx="${x - 55 * s}" cy="${y - 205 * s}" r="${52 * s}"/>
      <circle cx="${x + 58 * s}" cy="${y - 210 * s}" r="${56 * s}"/><circle cx="${x}" cy="${y - 300 * s}" r="${48 * s}"/>`;
    return cut(body, o.color || C.ochre, { so: .16 });
  };

  P.pine = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .86) * H, s = n(o.s, 1);
    let body = `<rect x="${x - 7 * s}" y="${y - 170 * s}" width="${14 * s}" height="${170 * s}"/>`;
    for (let i = 0; i < 4; i++) {
      const yy = y - 90 * s - i * 52 * s, ww = (150 - i * 26) * s;
      body += `<path d="M ${x - ww / 2} ${yy} L ${x} ${yy - 110 * s} L ${x + ww / 2} ${yy} Z"/>`;
    }
    return cut(body, o.color || C.teal2, { so: .16 });
  };

  P.banner = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .8) * H, s = n(o.s, 1), flip = o.flip ? -1 : 1;
    const body = `<rect x="${x - 5 * s}" y="${y - 330 * s}" width="${10 * s}" height="${330 * s}"/>
      <path d="M ${x + 5 * s} ${y - 320 * s} L ${x + flip * 150 * s} ${y - 300 * s} L ${x + flip * 120 * s} ${y - 250 * s} L ${x + flip * 150 * s} ${y - 200 * s} L ${x + 5 * s} ${y - 220 * s} Z"/>`;
    return cut(body, o.color || C.red, { so: .18, cls: "pc-banner" });
  };

  P.soldier = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .82) * H, s = n(o.s, 1), f = o.facing === "left" ? -1 : 1;
    const body = `<g transform="translate(${x} ${y}) scale(${f} ${1})">
      <circle cx="0" cy="${-150 * s}" r="${20 * s}"/>
      <path d="M ${-22 * s} ${-128 * s} L ${22 * s} ${-128 * s} L ${30 * s} ${-58 * s} L ${10 * s} ${-46 * s} L ${-10 * s} ${-46 * s} L ${-30 * s} ${-58 * s} Z"/>
      <rect x="${-16 * s}" y="${-48 * s}" width="${13 * s}" height="${48 * s}"/>
      <rect x="${3 * s}" y="${-48 * s}" width="${13 * s}" height="${48 * s}"/>
      <rect x="${20 * s}" y="${-190 * s}" width="${5 * s}" height="${170 * s}" transform="rotate(8 ${20 * s} ${-190 * s})"/>
      <path d="M ${-24 * s} ${-126 * s} L ${-38 * s} ${-90 * s} L ${-30 * s} ${-84 * s} L ${-16 * s} ${-112 * s} Z"/>
    </g>`;
    return cut(body, o.color || C.ink, { so: .12, sy: 8 });
  };

  P.army = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .84) * H, cols = n(o.cols, 11), rows = n(o.rows, 4), s = n(o.s, .55);
    let body = "";
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const px = x + (c - cols / 2) * 54 * s + (r % 2) * 14 * s;
        const py = y - r * 46 * s;
        body += `<g transform="translate(${px} ${py}) scale(${s})"><circle cx="0" cy="-118" r="15"/><path d="M -17 -100 L 17 -100 L 22 -46 L 9 -38 L -9 -38 L -22 -46 Z"/><rect x="22" y="-150" width="4" height="120"/></g>`;
      }
    }
    return cut(body, o.color || C.ink, { so: .12, sy: 8, cls: "pc-army" });
  };

  P.horse = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .84) * H, s = n(o.s, 1), f = o.facing === "left" ? -1 : 1;
    const body = `<g transform="translate(${x} ${y}) scale(${f * s} ${s})">
      <path d="M 60 -116 L 54 -8 L 68 -8 L 72 -114 L 34 -112 L 32 -8 L 18 -8 L 20 -112 L -38 -112 L -44 -8 L -58 -8 L -58 -112 L -96 -122 Q -120 -146 -104 -164 L -86 -158 L -78 -126 L -6 -132 L 42 -136 L 52 -172 L 62 -200 L 88 -210 L 112 -202 L 128 -186 L 112 -178 L 90 -182 L 80 -168 L 72 -194 L 58 -190 L 56 -152 Z"/>
      <path d="M 80 -208 L 86 -230 L 96 -210 Z"/>
      <path d="M -96 -158 Q -128 -148 -134 -96 Q -116 -126 -92 -136 Z"/>
      <path d="M 44 -138 L 50 -160 L 40 -150 L 36 -170 L 28 -150 Z" opacity=".85"/>
    </g>`;
    return cut(body, o.color || C.ink, { so: .14, sy: 10 });
  };

  P.cavalry = (o) => {
    o = o || {};
    return `<g class="pc-cavalry">` + P.horse(Object.assign({}, o, { y: n(o.y, .84) })) +
      P.soldier({ x: n(o.x, .5) + (o.facing === "left" ? -.03 : .03), y: n(o.y, .84) - .055, s: n(o.s, .9) * .62, color: o.color, facing: o.facing }) + `</g>`;
  };

  P.chariot = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .86) * H, s = n(o.s, 1), f = o.facing === "left" ? -1 : 1;
    const body = `<g transform="translate(${x} ${y}) scale(${f * s} ${s})">
      <circle cx="-70" cy="-35" r="42" fill="none" stroke="${o.color || C.ink}" stroke-width="12"/>
      <circle cx="55" cy="-35" r="42" fill="none" stroke="${o.color || C.ink}" stroke-width="12"/>
      <path d="M -110 -70 L 90 -70 L 90 -120 L -80 -120 L -110 -95 Z"/>
      <rect x="-40" y="-190" width="6" height="80"/>
      <path d="M -34 -186 L 40 -170 L -34 -150 Z"/>
      <path d="M 90 -90 L 150 -100 L 150 -82 L 90 -72 Z"/>
    </g>`;
    return cut(body, o.color || C.ink, { so: .14, sy: 10 });
  };

  P.boat = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .82) * H, s = n(o.s, 1), f = o.facing === "left" ? -1 : 1;
    const tf = `transform="translate(${x} ${y}) scale(${f * s} ${s})"`;
    const hull = `<g ${tf}>
      <path d="M -150 -40 Q 0 30 150 -40 L 120 30 Q 0 82 -120 30 Z"/>
      <rect x="-120" y="-48" width="240" height="12"/>
    </g>`;
    const rig = `<g ${tf}>
      <rect x="-4" y="-230" width="8" height="200"/>
      <path d="M 4 -225 L 120 -120 L 4 -70 Z"/>
      <path d="M -4 -215 L -100 -130 L -4 -90 Z" opacity=".9"/>
    </g>`;
    return cut(hull, o.color || C.ink2, { so: .22, sy: 14 }) +
      cut(rig, o.sail || C.paper, { so: .18, sy: 10 });
  };

  P.fleet = (o) => {
    o = o || {};
    let out = "";
    const base = o.boats || 5;
    for (let i = 0; i < base; i++) {
      const k = i - (base - 1) / 2;
      out += P.boat({ x: n(o.x, .5) + k * .13, y: n(o.y, .84) - Math.abs(k) * .015, s: n(o.s, .72) * (1 - Math.abs(k) * .08), color: o.color, facing: o.facing });
    }
    return out;
  };

  P.river = (o) => {
    o = o || {};
    const y = n(o.y, .82) * H, w = n(o.w, 1.4) * W, x = n(o.x, .5) * W;
    const hh = n(o.h, 1);
    const body = `<path d="M ${x - w / 2} ${y} Q ${x - w * .26} ${y - 24} ${x - w * .02} ${y} T ${x + w * .24} ${y} T ${x + w / 2} ${y - 6} L ${x + w / 2} ${y + H * hh} L ${x - w / 2} ${y + H * hh} Z"/>`;
    const glint = [[-.34, .22], [-.06, .33], [.28, .27], [.1, .46], [-.22, .5]].map(([kx, ky], i) =>
      `<path d="M ${x + w * kx} ${y + H * hh * ky} Q ${x + w * (kx + .05)} ${y + H * hh * ky - 16} ${x + w * (kx + .1)} ${y + H * hh * ky}" opacity="${.42 - i * .05}"/>`).join("");
    return cut(body, o.color || C.teal, { so: .12, sy: 8 }) +
      `<g fill="none" stroke="${C.white}" stroke-width="5" stroke-linecap="round">${glint}</g>`;
  };

  P.plate = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .8) * H, w = n(o.w, 2.6) * W, h = n(o.h, .2) * H;
    const left = x - w / 2, right = x + w / 2;
    const d = `M ${left} ${y + 8} Q ${left + w * .16} ${y - 12} ${left + w * .32} ${y + 2} T ${x + w * .02} ${y - 4} T ${x + w * .34} ${y + 6} T ${right} ${y - 2} L ${right} ${y + h} L ${left} ${y + h} Z`;
    const fill = o.color || "#a8926f";
    const tc = o.texColor || C.ink;
    const cracks = `<g fill="none" stroke="${tc}" stroke-width="2.6" stroke-linecap="round" opacity=".16">
        <path d="M ${left + w * .14} ${y + h * .34} L ${left + w * .2} ${y + h * .6} L ${left + w * .17} ${y + h * .86}"/>
        <path d="M ${left + w * .2} ${y + h * .6} L ${left + w * .3} ${y + h * .64}"/>
        <path d="M ${left + w * .58} ${y + h * .22} L ${left + w * .54} ${y + h * .52} L ${left + w * .6} ${y + h * .8}"/>
        <path d="M ${left + w * .83} ${y + h * .3} L ${left + w * .88} ${y + h * .56}"/>
      </g>`;
    const bevel = `<path d="M ${left + 6} ${y + 6} Q ${left + w * .16} ${y - 10} ${left + w * .32} ${y + 2} T ${x + w * .02} ${y - 4} T ${x + w * .34} ${y + 6} T ${right - 6} ${y - 2}"
        fill="none" stroke="${C.white}" stroke-width="3" stroke-opacity=".22"/>`;
    return cut(`<path d="${d}"/>`, fill, { so: .22, sy: 12, sx: 7 }) + cracks + bevel;
  };

  P.grass = (o) => {
    o = o || {};
    const x0 = n(o.x0, 0) * W, x1 = n(o.x1, 1) * W;
    const y0 = n(o.y0, .86) * H, y1 = n(o.y1, .95) * H;
    const count = n(o.count, 24), s = n(o.s, 1);
    let body = "";
    for (let i = 0; i < count; i++) {
      const t = (i + .5) / count;
      const px = x0 + (x1 - x0) * ((i * 61) % 100) / 100;
      const py = y0 + (y1 - y0) * ((i * 37) % 100) / 100;
      const len = (26 + (i % 5) * 12) * s;
      const lean = (((i * 29) % 13) / 13 - .5) * .9;
      for (let k = -1; k <= 1; k++) {
        const bake = lean + k * .38;
        body += `<path d="M ${px} ${py} Q ${px + bake * len * .5} ${py - len * .7} ${px + bake * len} ${py - len * (1 - Math.abs(k) * .22)}" fill="none" stroke-width="${4 * s}"/>`;
      }
    }
    return `<g class="pc-grass" stroke="${o.color || C.ink}" stroke-linecap="round" opacity="${n(o.opacity, .5)}">${body}</g>`;
  };

  P.bridge = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .8) * H, w = n(o.w, .6) * W;
    const body = `<path d="M ${x - w / 2} ${y} Q ${x} ${y - 150} ${x + w / 2} ${y} L ${x + w / 2} ${y + 26} Q ${x} ${y - 120} ${x - w / 2} ${y + 26} Z"/>
      ${[-.3, 0, .3].map((k) => `<rect x="${x + w * k - 8}" y="${y - 120}" width="16" height="120"/>`).join("")}`;
    return cut(body, o.color || C.ochre, { so: .14 });
  };

  P.scroll = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .55) * H, w = n(o.w, .7) * W, h = n(o.h, .42) * H;
    const body = `<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" fill="${o.paper || C.white}"/>
      <rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" fill="none" stroke="${C.ochre}" stroke-width="6"/>
      <rect x="${x - w / 2 - 22}" y="${y - h / 2 - 18}" width="22" height="${h + 36}" rx="11" fill="${C.ochre}"/>
      <rect x="${x + w / 2}" y="${y - h / 2 - 18}" width="22" height="${h + 36}" rx="11" fill="${C.ochre}"/>`;
    return cut(body, o.color || C.white, { so: .18, sx: 8, sy: 14 });
  };

  P.book = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .56) * H, w = n(o.w, .72) * W, h = n(o.h, .36) * H;
    const body = `<path d="M ${x - w / 2} ${y - h / 2} L ${x} ${y - h / 2 + 18} L ${x + w / 2} ${y - h / 2} L ${x + w / 2} ${y + h / 2} L ${x} ${y + h / 2 + 18} L ${x - w / 2} ${y + h / 2} Z" fill="${C.white}"/>
      <path d="M ${x} ${y - h / 2 + 18} L ${x} ${y + h / 2 + 18}" stroke="${C.shade}" stroke-width="5"/>
      ${Array.from({ length: 6 }).map((_, i) => `<line x1="${x - w * .42}" y1="${y - h * .28 + i * h * .1}" x2="${x - w * .08}" y2="${y - h * .28 + i * h * .1}" stroke="${C.ochre}" stroke-width="3" opacity=".55"/><line x1="${x + w * .08}" y1="${y - h * .28 + i * h * .1}" x2="${x + w * .42}" y2="${y - h * .28 + i * h * .1}" stroke="${C.ochre}" stroke-width="3" opacity=".55"/>`).join("")}`;
    return cut(body, C.white, { so: .18, sx: 8, sy: 14 });
  };

  P.seal = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .5) * H, s = n(o.s, 1);
    const ch = o.text || "史";
    return `<g transform="translate(${x} ${y}) scale(${s}) rotate(${n(o.rot, -6)})">
      <rect x="-110" y="-110" width="220" height="220" rx="10" fill="${C.red}" opacity=".92"/>
      <rect x="-92" y="-92" width="184" height="184" rx="6" fill="none" stroke="${C.white}" stroke-width="7" opacity=".85"/>
      <text x="0" y="46" font-family="PaperKai,serif" font-size="128" font-weight="700" fill="${C.white}" text-anchor="middle">${esc(ch)}</text>
    </g>`;
  };

  P.crown = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .45) * H, s = n(o.s, 1);
    const body = `<g transform="translate(${x} ${y}) scale(${s})">
      <rect x="-130" y="-30" width="260" height="34" rx="8"/>
      <rect x="-96" y="-62" width="192" height="34" rx="6"/>
      ${Array.from({ length: 7 }).map((_, i) => `<line x1="${-96 + i * 32}" y1="4" x2="${-96 + i * 32}" y2="52" stroke="${C.gold}" stroke-width="5"/><circle cx="${-96 + i * 32}" cy="60" r="7" fill="${C.gold}"/>`).join("")}
      <path d="M -130 -30 L -150 -60 L -110 -44 Z"/><path d="M 130 -30 L 150 -60 L 110 -44 Z"/>
    </g>`;
    return cut(body, o.color || C.ink, { so: .18 });
  };

  P.throne = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .8) * H, s = n(o.s, 1);
    const body = `<g transform="translate(${x} ${y}) scale(${s})">
      <path d="M -150 0 L -150 -240 L -110 -240 L -110 -40 L 110 -40 L 110 -240 L 150 -240 L 150 0 Z"/>
      <rect x="-170" y="-30" width="340" height="40" rx="6"/>
      <rect x="-120" y="-210" width="240" height="30" rx="6"/>
      <circle cx="-120" cy="-250" r="14"/><circle cx="0" cy="-260" r="16"/><circle cx="120" cy="-250" r="14"/>
    </g>`;
    return cut(body, o.color || C.gold, { so: .2, sx: 8, sy: 14 });
  };

  P.coin = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .5) * H, s = n(o.s, 1);
    return `<g transform="translate(${x} ${y}) scale(${s})">
      <circle r="120" fill="${C.gold}"/><circle r="120" fill="none" stroke="${C.ochre}" stroke-width="8"/>
      <rect x="-40" y="-40" width="80" height="80" fill="${C.paper}"/>
      <circle r="120" fill="none" stroke="${C.ochre}" stroke-width="3" stroke-dasharray="10 8" opacity=".6"/>
    </g>`;
  };

  P.sword = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .5) * H, s = n(o.s, 1), r = n(o.rot, -28);
    return `<g transform="translate(${x} ${y}) rotate(${r}) scale(${s})">
      <path d="M -10 -300 L 10 -300 L 14 60 L -14 60 Z" fill="${C.white}" stroke="${C.ink}" stroke-width="3"/>
      <rect x="-46" y="60" width="92" height="18" rx="6" fill="${C.gold}"/>
      <rect x="-10" y="78" width="20" height="90" rx="8" fill="${C.red}"/>
      <circle cx="0" cy="184" r="16" fill="${C.gold}"/>
    </g>`;
  };

  P.lantern = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .3) * H, s = n(o.s, 1);
    return `<g transform="translate(${x} ${y}) scale(${s})">
      <line x1="0" y1="-220" x2="0" y2="-90" stroke="${C.ink}" stroke-width="5"/>
      <ellipse cx="0" cy="0" rx="58" ry="78" fill="${C.red}"/>
      <rect x="-28" y="-86" width="56" height="14" rx="4" fill="${C.gold}"/>
      <rect x="-28" y="74" width="56" height="14" rx="4" fill="${C.gold}"/>
      <line x1="0" y1="88" x2="0" y2="130" stroke="${C.gold}" stroke-width="5"/>
    </g>`;
  };

  P.fire = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .82) * H, s = n(o.s, 1);
    let body = "";
    for (let i = 0; i < 5; i++) {
      const dx = (i - 2) * 46 * s, hh = (90 + (i % 3) * 46) * s;
      body += `<path d="M ${x + dx} ${y} Q ${x + dx - 28 * s} ${y - hh * .55} ${x + dx} ${y - hh} Q ${x + dx + 28 * s} ${y - hh * .55} ${x + dx} ${y} Z"/>`;
    }
    return `<g class="pc-fire" opacity=".92">${cut(body, o.color || C.red, { so: .16, sy: 8 })}</g>`;
  };

  P.smoke = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .72) * H, s = n(o.s, 1);
    const col = o.color || C.shade;
    const puff = (px, py, r, op) => `<g opacity="${op}" transform="translate(${px} ${py})">${cut(
      `<circle cx="0" cy="0" r="${r}"/><circle cx="${-r * .78}" cy="${r * .3}" r="${r * .66}"/><circle cx="${r * .76}" cy="${r * .26}" r="${r * .6}"/><rect x="${-r * 1.12}" y="${r * .28}" width="${r * 2.24}" height="${r * .62}" rx="${r * .3}"/>`,
      col, { sy: 7, so: .13 })}</g>`;
    return `<g class="pc-smoke">${[
      [0, 0, 58], [26, -74, 70], [-16, -150, 60], [18, -222, 48],
    ].map(([dx, dy, r], i) => puff(x + dx * s, y + dy * s, r * s, .96 - i * .08)).join("")}</g>`;
  };

  P.snow = (o) => {
    o = o || {};
    let body = "";
    for (let i = 0; i < 34; i++) {
      const x = (i * 137.5) % W, y = (i * 211.7) % H;
      body += `<circle cx="${x}" cy="${y}" r="${2 + (i % 4)}"/>`;
    }
    return `<g class="pc-snow" opacity=".7">${cut(body, o.color || C.white, { shadow: false })}</g>`;
  };

  P.rain = (o) => {
    o = o || {};
    let body = "";
    for (let i = 0; i < 40; i++) {
      const x = (i * 97.3) % W, y = (i * 173.9) % H;
      body += `<line x1="${x}" y1="${y}" x2="${x - 18}" y2="${y + 54}" stroke-width="3"/>`;
    }
    return `<g class="pc-rain" opacity=".45">${cut(body, o.color || C.white, { shadow: false })}</g>`;
  };

  P.crowd = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .86) * H, s = n(o.s, 1);
    let body = "";
    for (let r = 0; r < 3; r++) {
      for (let i = 0; i < 13; i++) {
        const px = x + (i - 6) * 56 * s + (r % 2) * 20 * s;
        const py = y - r * 24 * s;
        body += `<circle cx="${px}" cy="${py - 92 * s}" r="${16 * s}"/><path d="M ${px - 24 * s} ${py} Q ${px} ${py - 78 * s} ${px + 24 * s} ${py} Z"/>`;
      }
    }
    return cut(body, o.color || C.ink, { so: .12, sy: 8, cls: "pc-crowd" });
  };

  P.tomb = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .82) * H, s = n(o.s, 1);
    const body = `<g transform="translate(${x} ${y}) scale(${s})">
      <path d="M -300 0 Q 0 -235 300 0 Z"/>
      <rect x="-168" y="-58" width="336" height="34" rx="5" fill="${C.ink2}"/>
      <rect x="-132" y="-30" width="264" height="32" rx="4" fill="${C.ink2}"/>
      <rect x="-58" y="-306" width="116" height="252" rx="12" fill="${C.ink2}"/>
      <path d="M -78 -300 Q 0 -326 78 -300" fill="none" stroke="${C.ink2}" stroke-width="12"/>
      <rect x="-45" y="-288" width="90" height="212" rx="4" fill="${C.paper}"/>
      <text x="0" y="-186" font-family="PaperKai,serif" font-size="52" fill="${C.ink}" text-anchor="middle">${esc(o.text || "陵")}</text>
      <rect x="-236" y="-136" width="30" height="136" rx="8" fill="${C.ink2}"/>
      <rect x="206" y="-136" width="30" height="136" rx="8" fill="${C.ink2}"/>
      <path d="M -236 -136 L -221 -168 L -206 -136 Z" fill="${C.ink2}"/>
      <path d="M 206 -136 L 221 -168 L 236 -136 Z" fill="${C.ink2}"/>
    </g>`;
    return cut(body, o.color || C.ochre, { so: .2, sy: 14 });
  };

  P.temple = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .82) * H, w = n(o.w, .62) * W, h = n(o.h, .3) * H;
    const body = `<rect x="${x - w * .3}" y="${y - h * .7}" width="${w * .6}" height="${h * .7}"/>
      <path d="M ${x - w * .5} ${y - h * .62} Q ${x} ${y - h} ${x + w * .5} ${y - h * .62} L ${x + w * .38} ${y - h * .48} Q ${x} ${y - h * .74} ${x - w * .38} ${y - h * .48} Z" fill="${C.red}"/>
      ${[-.22, -.07, .07, .22].map((k) => `<rect x="${x + w * k - 8}" y="${y - h * .68}" width="16" height="${h * .62}"/>`).join("")}`;
    return cut(body, o.color || C.teal2, { so: .18 });
  };

  P.yurt = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .82) * H, s = n(o.s, 1);
    const body = `<g transform="translate(${x} ${y}) scale(${s})"><path d="M -110 0 L -110 -90 Q 0 -190 110 -90 L 110 0 Z"/><rect x="-20" y="-60" width="40" height="60" fill="${C.ink}"/><line x1="0" y1="-150" x2="0" y2="-200" stroke="${C.ink}" stroke-width="6"/></g>`;
    return cut(body, o.color || C.white, { so: .16 });
  };

  P.steppe = (o) => {
    o = o || {};
    const y = n(o.y, .8) * H;
    let body = `<path d="M 0 ${y + 120} Q ${W * .25} ${y - 40} ${W * .5} ${y + 30} T ${W} ${y - 10} L ${W} ${H} L 0 ${H} Z"/>`;
    return cut(body, o.color || C.ochre, { so: .12, sy: 8 });
  };

  P.map = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .52) * H, w = n(o.w, .86) * W, h = n(o.h, .52) * H;
    const L_ = x - w / 2, T_ = y - h / 2;
    const base = o.color || "#b28f5c";
    const ink = o.line || C.ink;
    const px = (k) => L_ + w * k, py = (k) => T_ + h * k;
    let body = `<rect x="${L_}" y="${T_}" width="${w}" height="${h}" rx="10" fill="${base}" stroke="${ink}" stroke-width="12"/>`;
    body += `<rect x="${L_ + 15}" y="${T_ + 15}" width="${w - 30}" height="${h - 30}" rx="5" fill="none" stroke="${C.ochre}" stroke-width="3" opacity=".8"/>`;
    // 陆块：两块高地，压深一档把纸面和天空分开
    body += `<path d="M ${px(.08)} ${py(.42)} Q ${px(.2)} ${py(.2)} ${px(.4)} ${py(.28)} Q ${px(.52)} ${py(.32)} ${px(.6)} ${py(.5)} Q ${px(.5)} ${py(.72)} ${px(.3)} ${py(.74)} Q ${px(.12)} ${py(.68)} ${px(.08)} ${py(.42)} Z" fill="#93743f" stroke="#4d361d" stroke-width="4" opacity=".96"/>`;
    body += `<path d="M ${px(.64)} ${py(.36)} Q ${px(.76)} ${py(.24)} ${px(.9)} ${py(.34)} Q ${px(.94)} ${py(.52)} ${px(.86)} ${py(.66)} Q ${px(.72)} ${py(.7)} ${px(.66)} ${py(.58)} Z" fill="#93743f" stroke="#4d361d" stroke-width="4" opacity=".92"/>`;
    // 山脉符号
    const mts = [[.18, .38, .09], [.3, .31, .07], [.72, .32, .08], [.82, .42, .09], [.42, .63, .08], [.24, .68, .07], [.7, .62, .07]];
    body += mts.map(([kx, ky, r]) =>
      `<path d="M ${px(kx - r)} ${py(ky)} L ${px(kx)} ${py(ky - .12)} L ${px(kx + r)} ${py(ky)} Z" fill="none" stroke="${ink}" stroke-width="5" stroke-linejoin="round" opacity=".72"/>`).join("");
    // 河流
    body += `<path d="M ${px(.05)} ${py(.18)} Q ${px(.28)} ${py(.3)} ${px(.4)} ${py(.46)} T ${px(.62)} ${py(.62)} Q ${px(.72)} ${py(.7)} ${px(.9)} ${py(.74)}" fill="none" stroke="#3d6470" stroke-width="8" stroke-linecap="round" opacity=".9"/>`;
    body += `<path d="M ${px(.15)} ${py(.9)} Q ${px(.34)} ${py(.78)} ${px(.52)} ${py(.82)} Q ${px(.7)} ${py(.86)} ${px(.9)} ${py(.8)}" fill="none" stroke="#3d6470" stroke-width="6" stroke-linecap="round" opacity=".62"/>`;
    // 郡界（红虚线）
    body += `<path d="M ${px(.46)} ${py(.12)} L ${px(.5)} ${py(.36)} L ${px(.44)} ${py(.6)} L ${px(.5)} ${py(.88)}" fill="none" stroke="${C.red2}" stroke-width="4" stroke-dasharray="12 10" opacity=".72"/>`;
    // 城点与行军线
    const towns = [[.2, .58], [.34, .47], [.46, .66], [.6, .46], [.74, .6], [.62, .74]];
    body += towns.map(([kx, ky]) => `<circle cx="${px(kx)}" cy="${py(ky)}" r="8" fill="${C.red}" stroke="${ink}" stroke-width="2"/>`).join("");
    body += `<path d="M ${px(.2)} ${py(.58)} L ${px(.34)} ${py(.47)} L ${px(.46)} ${py(.66)} L ${px(.6)} ${py(.46)}" fill="none" stroke="${C.red2}" stroke-width="5" stroke-dasharray="18 12" stroke-linecap="round"/>`;
    body += `<path d="M ${px(.6)} ${py(.46)} L ${px(.63)} ${py(.4)} M ${px(.6)} ${py(.46)} L ${px(.55)} ${py(.43)}" fill="none" stroke="${C.red2}" stroke-width="5" stroke-linecap="round"/>`;
    // 罗盘
    const cx0 = px(.88), cy0 = py(.16), rr = Math.min(w, h) * .055;
    body += `<g fill="none" stroke="${ink}" stroke-width="3" opacity=".7">
      <circle cx="${cx0}" cy="${cy0}" r="${rr}"/>
      <path d="M ${cx0} ${cy0 - rr} L ${cx0 + rr * .3} ${cy0} L ${cx0} ${cy0 + rr} L ${cx0 - rr * .3} ${cy0} Z"/>
      <path d="M ${cx0 - rr * .7} ${cy0} L ${cx0 + rr * .7} ${cy0}"/>
    </g>`;
    // 右下角朱印
    const sx0 = px(.85), sy0 = py(.86), sr = Math.min(w, h) * .052;
    body += `<rect x="${sx0 - sr}" y="${sy0 - sr}" width="${sr * 2}" height="${sr * 2}" rx="5" fill="${C.red2}"/>`;
    body += `<rect x="${sx0 - sr * .78}" y="${sy0 - sr * .78}" width="${sr * 1.56}" height="${sr * 1.56}" fill="none" stroke="${C.paper}" stroke-width="2.5" opacity=".85"/>`;
    body += `<text x="${sx0}" y="${sy0 + sr * .4}" font-family="PaperKai,serif" font-size="${(sr * 1.05).toFixed(1)}" fill="${C.paper}" text-anchor="middle">舆</text>`;
    // 纸面做旧折痕
    body += `<g fill="none" stroke="${ink}" stroke-width="2" opacity=".1">
      <path d="M ${px(.5)} ${T_ + 15} L ${px(.5)} ${T_ + h - 15}"/>
      <path d="M ${L_ + 15} ${py(.5)} L ${L_ + w - 15} ${py(.5)}"/>
    </g>`;
    return cut(body, base, { so: .3, sx: 13, sy: 20 });
  };

  P.dragon = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .45) * H, s = n(o.s, 1), f = o.facing === "left" ? -1 : 1;
    let body = `<g transform="translate(${x} ${y}) scale(${f * s} ${s})">
      <path d="M -300 60 Q -180 -80 -40 0 T 220 -30 Q 300 -50 330 10 L 300 44 Q 220 10 160 30 T 0 46 T -180 0 T -300 96 Z"/>
      <path d="M 300 -40 Q 360 -90 400 -50 L 380 -10 L 340 0 Z"/>
      <circle cx="345" cy="-44" r="9" fill="${C.paper}"/>
      <path d="M 360 -86 L 390 -130 L 396 -92 Z"/>
    </g>`;
    return cut(body, o.color || C.red, { so: .18, sy: 12 });
  };

  P.phoenix = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .42) * H, s = n(o.s, 1), f = o.facing === "left" ? -1 : 1;
    const body = `<g transform="translate(${x} ${y}) scale(${f * s} ${s})">
      <path d="M -150 80 Q -40 20 20 40 Q 100 60 140 -10 Q 160 -50 130 -80 Q 110 -30 70 -20 Q 20 -10 -20 20 Q -100 -40 -160 -140 Q -120 -40 -150 20 Z"/>
      <path d="M -160 -100 Q -260 -180 -330 -140 Q -240 -120 -190 -70 Z"/>
      <path d="M 120 -70 Q 180 -120 190 -190 Q 150 -120 100 -90 Z"/>
      <circle cx="140" cy="-70" r="7" fill="${C.paper}"/>
    </g>`;
    return cut(body, o.color || C.gold, { so: .18 });
  };

  P.umbrella = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .5) * H, s = n(o.s, 1);
    const body = `<g transform="translate(${x} ${y}) scale(${s})"><line x1="0" y1="0" x2="0" y2="220" stroke="${C.ochre}" stroke-width="10"/><path d="M -170 0 Q 0 -150 170 0 Q 0 -40 -170 0 Z" fill="${C.red}"/><path d="M -170 0 Q 0 -80 170 0" fill="none" stroke="${C.gold}" stroke-width="6"/></g>`;
    return cut(body, C.red, { so: .18 });
  };

  /* ---------- 审核分镜专用零件 ---------- */
  P.night = (o) => {
    o = o || {};
    return `<rect x="0" y="0" width="${W}" height="${H}" fill="${o.color || C.teal2}" opacity="${n(o.opacity, .84)}"/>`;
  };

  P.pillar = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .9) * H, h = n(o.h, .56) * H, w = n(o.w, 76);
    const body = `<rect x="${x - w / 2}" y="${y - h}" width="${w}" height="${h}"/>
      <rect x="${x - w / 2 - 20}" y="${y - h}" width="${w + 40}" height="36"/>
      <rect x="${x - w / 2 - 24}" y="${y - 36}" width="${w + 48}" height="36"/>
      ${Array.from({ length: 5 }).map((_, i) => `<rect x="${x - w / 2 + 9}" y="${y - h + 76 + i * 92}" width="${w - 18}" height="10" opacity=".5"/>`).join("")}`;
    return cut(body, o.color || C.red2, { so: .2, sx: 8, sy: 14 });
  };

  P.dagger = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .5) * H, s = n(o.s, 1), rot = n(o.rot, -28);
    const body = `<g transform="translate(${x} ${y}) scale(${s}) rotate(${rot})">
      <path d="M -9 0 L 0 -156 L 9 0 Z"/>
      <rect x="-34" y="0" width="68" height="14" rx="4"/>
      <rect x="-10" y="14" width="20" height="58" rx="9"/>
      <circle cx="0" cy="80" r="13"/>
    </g>`;
    return cut(body, o.color || C.white, { so: .2, sx: 8, sy: 12 }) +
      `<g transform="translate(${x} ${y}) scale(${s}) rotate(${rot})"><path d="M -4 -148 L 0 -176 L 4 -148 Z" fill="${C.gold}"/></g>`;
  };

  P.cauldron = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .84) * H, s = n(o.s, 1);
    const body = `<g transform="translate(${x} ${y}) scale(${s}) rotate(${n(o.rot, -8)})">
      <path d="M -112 0 Q -132 104 0 116 Q 132 104 112 0 Z"/>
      <rect x="-124" y="-14" width="248" height="26" rx="10"/>
      <rect x="-86" y="104" width="22" height="62"/><rect x="64" y="104" width="22" height="62"/>
      <path d="M 26 18 L 72 64 L 48 92 L 4 46 Z" fill="${C.ink}" opacity=".82"/>
      <path d="M -30 -12 Q 0 34 34 8" fill="none" stroke="${C.ink}" stroke-width="7" opacity=".65"/>
    </g>`;
    return cut(body, o.color || C.ink2, { so: .18, sx: 8, sy: 12 });
  };

  P.snowfield = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .82) * H, w = n(o.w, 1.6) * W;
    let body = "";
    for (let i = 0; i < 4; i++) {
      body += `<path d="M ${x - w / 2} ${y + i * 30} Q ${x - w * .2} ${y + i * 30 - 26} ${x} ${y + i * 30} T ${x + w / 2} ${y + i * 30} L ${x + w / 2} ${y + i * 30 + 34} L ${x - w / 2} ${y + i * 30 + 34} Z"/>`;
    }
    return cut(body, o.color || C.white, { so: .12, sy: 8 });
  };

  P.altar = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .78) * H, s = n(o.s, 1);
    const body = `<g transform="translate(${x} ${y}) scale(${s})">
      <path d="M -176 0 L 176 0 L 142 -58 L -142 -58 Z"/>
      <path d="M -142 -58 L 142 -58 L 112 -112 L -112 -112 Z"/>
      <path d="M -112 -112 L 112 -112 L 88 -158 L -88 -158 Z"/>
      <rect x="-14" y="-260" width="28" height="110"/>
      <path d="M -70 -250 L 70 -250 L 52 -222 L -52 -222 Z"/>
    </g>`;
    return cut(body, o.color || C.ochre, { so: .2, sx: 8, sy: 14 });
  };

  P.arrows = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .5) * H, s = n(o.s, 1), count = n(o.count, 9), ang = n(o.ang, 24);
    let body = `<g transform="translate(${x} ${y}) scale(${s}) rotate(${ang})">`;
    for (let i = 0; i < count; i++) {
      const ox = (i - (count - 1) / 2) * 64;
      const len = 360 + (i % 3) * 70;
      body += `<g transform="translate(${ox} ${(i % 4) * 42 - 60})">
        <rect x="-3" y="${-len}" width="6" height="${len}"/>
        <path d="M -16 ${-len} L 0 ${-len - 34} L 16 ${-len} Z"/>
        <path d="M -12 ${-len + 40} L 0 ${-len + 18} L 12 ${-len + 40} Z" opacity=".8"/>
      </g>`;
    }
    body += "</g>";
    return cut(body, o.color || C.ink2, { so: .14, sx: 6, sy: 10, cls: "pc-arrow" });
  };

  P.wave = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .8) * H, w = n(o.w, 1.7) * W;
    const rows = n(o.rows, 3);
    const left = x - w / 2;
    let body = "", crest = "";
    for (let r = 0; r < rows; r++) {
      const yy = y + r * 58;
      const base = 60 - r * 8;
      let cx = left - base * 2.4, top = "", k = 0;
      while (cx < left + w + base * 2) {
        const rad = base * (.82 + ((k * 37 + r * 11) % 9) / 24);
        const ry = rad * (.72 + ((k * 53) % 7) / 24);
        top += `A ${rad.toFixed(1)} ${ry.toFixed(1)} 0 0 1 ${(cx + rad * 2).toFixed(1)} ${yy + 34} `;
        cx += rad * 2;
        k++;
      }
      body += `<path d="M ${(left - base * 2.4).toFixed(1)} ${yy + 34} ${top} L ${cx.toFixed(1)} ${yy + 96} L ${(left - base * 2.4).toFixed(1)} ${yy + 96} Z"/>`;
      crest += `<path d="M ${(left - base * 2.4).toFixed(1)} ${yy + 34} ${top}" fill="none" stroke="${C.white}" stroke-width="${Math.max(3, 6 - r)}" stroke-linecap="round" opacity="${(.42 - r * .1).toFixed(2)}"/>`;
    }
    return cut(body, o.color || C.teal, { so: .12, sy: 8, cls: "pc-wave" }) + crest;
  };

  P.warship = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .8) * H, s = n(o.s, 1), f = o.facing === "left" ? -1 : 1;
    const body = `<g transform="translate(${x} ${y}) scale(${f * s} ${s})">
      <path d="M -230 -54 L 230 -54 L 184 54 L -184 54 Z"/>
      <rect x="-190" y="-70" width="380" height="22" rx="6"/>
      <rect x="-128" y="-152" width="36" height="98"/>
      <rect x="52" y="-166" width="30" height="112"/>
      <rect x="-134" y="-158" width="48" height="14"/>
      <rect x="46" y="-172" width="42" height="14"/>
      <rect x="-22" y="-318" width="7" height="264"/>
      <path d="M 4 -306 L 150 -218 L 4 -174 Z" opacity=".94"/>
      <path d="M -10 -300 L -150 -214 L -10 -176 Z" opacity=".8"/>
      ${[-150, -90, -30, 30, 90, 150].map((k) => `<circle cx="${k}" cy="-20" r="11" fill="${C.ink}"/>`).join("")}
      <path d="M -18 -314 L -88 -295 L -18 -271 Z" fill="${C.red}"/>
      <ellipse cx="-118" cy="-168" rx="34" ry="22" fill="${C.shade}" opacity=".7"/>
      <ellipse cx="66" cy="-184" rx="28" ry="18" fill="${C.shade}" opacity=".62"/>
    </g>`;
    return cut(body, o.color || C.ink2, { so: .22, sx: 10, sy: 16, cls: "pc-warship" });
  };

  P.fort = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .84) * H, w = n(o.w, .7) * W, s = n(o.s, 1);
    let body = `<rect x="${x - w / 2}" y="${y - 150 * s}" width="${w}" height="${150 * s}"/>`;
    for (let i = 0; i < 7; i++) {
      const bx = x - w / 2 + i * w / 7;
      body += `<rect x="${bx}" y="${y - 196 * s}" width="${w / 7 - 8}" height="${50 * s}"/>`;
    }
    for (let i = 0; i < 4; i++) {
      body += `<rect x="${x - w * .3 + i * w * .2}" y="${y - 116 * s}" width="${w * .09}" height="${w * .09}" fill="${C.ink}"/>`;
    }
    body += `<rect x="${x - 120 * s}" y="${y - 240 * s}" width="7" height="110" fill="${C.ochre}"/>
      <path d="M ${x - 116 * s} ${y - 238 * s} L ${x - 38 * s} ${y - 216 * s} L ${x - 116 * s} ${y - 194 * s} Z" fill="${C.ochre}"/>`;
    return cut(body, o.color || C.shade, { so: .2, sx: 8, sy: 14 });
  };

  P.cannon = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .84) * H, s = n(o.s, 1), f = o.facing === "left" ? -1 : 1;
    const body = `<g transform="translate(${x} ${y}) scale(${f * s} ${s})">
      <circle cx="-30" cy="-18" r="34" fill="none" stroke="${C.ink}" stroke-width="11"/>
      <rect x="-52" y="-92" width="150" height="36" rx="12"/>
      <rect x="86" y="-104" width="44" height="60" rx="8"/>
      <path d="M -70 -74 L 10 -52 L 10 -16 L -70 -38 Z"/>
    </g>`;
    return cut(body, o.color || C.ink2, { so: .18, sx: 8, sy: 12 }) +
      `<g transform="translate(${x + f * 126 * s} ${y - 74 * s}) scale(${f * s} ${s})">
        <path d="M 0 0 L 58 -26 L 82 0 L 58 26 Z" fill="${C.gold}"/>
        <circle cx="30" cy="0" r="34" fill="${C.red}" opacity=".75"/>
      </g>`;
  };

  P.rubble = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .92) * H, s = n(o.s, 1);
    let body = "";
    for (let i = 0; i < 9; i++) {
      const px = x + (i - 4) * 62 * s;
      const ph = (26 + (i % 4) * 18) * s;
      body += `<path d="M ${px - 34 * s} ${y} L ${px - 18 * s} ${y - ph} L ${px + 20 * s} ${y - ph * .8} L ${px + 36 * s} ${y} Z"/>`;
    }
    return cut(body, o.color || C.ink2, { so: .16, sx: 6, sy: 10 });
  };

  P.birds = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .3) * H, s = n(o.s, 1), count = n(o.count, 5);
    let body = "";
    for (let i = 0; i < count; i++) {
      const dx = (i - (count - 1) / 2) * 92 * s + (i % 2) * 26 * s;
      const dy = (i % 3) * 34 * s - Math.abs(i - (count - 1) / 2) * 12 * s;
      const sc = s * (.8 + (i % 3) * .14);
      body += `<g transform="translate(${x + dx} ${y + dy}) scale(${sc})"><path d="M -30 0 Q -16 -20 -2 -4 L 0 0 L 2 -4 Q 16 -20 30 0 Q 16 -8 2 4 L 0 7 L -2 4 Q -16 -8 -30 0 Z"/></g>`;
    }
    return `<g class="pc-birds">` + cut(body, o.color || C.ink2, { so: .12, sy: 8 }) + `</g>`;
  };

  P.mist = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .55) * H, w = n(o.w, 1.8) * W, h = n(o.h, .03) * H;
    let body = "";
    for (let i = 0; i < 3; i++) {
      const yy = y + i * h * .9;
      body += `<path d="M ${x - w / 2} ${yy} Q ${x - w * .22} ${yy - h * .7} ${x} ${yy} T ${x + w * .22} ${yy} T ${x + w / 2} ${yy} L ${x + w / 2} ${yy + h * .7} Q ${x} ${yy + h * 1.4} ${x - w / 2} ${yy + h * .7} Z"/>`;
    }
    return cut(body, o.color || C.paper2, { so: .1, sy: 6, cls: "pc-mist" });
  };

  /* ---------- 场景细节零件 ---------- */
  P.halo = (o) => {
    o = o || {};
    const x = n(o.x, .8) * W, y = n(o.y, .2) * H, r = n(o.r, 110), col = o.color || C.gold;
    let body = "";
    for (let i = 0; i < n(o.rings, 3); i++) {
      body += `<circle cx="${x}" cy="${y}" r="${(r * (1.12 + i * .24)).toFixed(1)}" fill="none" stroke="${col}" stroke-width="${Math.max(2, 7 - i * 2)}" opacity="${(.5 - i * .13).toFixed(2)}"/>`;
    }
    return `<g class="pc-halo">${body}</g>`;
  };

  P.stars = (o) => {
    o = o || {};
    let body = "";
    for (let i = 0; i < 46; i++) {
      const x = (i * 173.3) % W, y = (i * 97.7) % (H * .62);
      body += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(1.4 + (i % 4) * .8).toFixed(1)}"/>`;
    }
    return `<g class="pc-stars" opacity="${n(o.opacity, .72)}">${cut(body, o.color || C.white, { shadow: false })}</g>`;
  };

  P.embers = (o) => {
    o = o || {};
    let body = "";
    for (let i = 0; i < 30; i++) {
      const x = (i * 151.7) % W;
      const y = H * .42 + ((i * 211.3) % (H * .5));
      const r = 2 + (i % 4) * 1.6;
      const col = i % 3 ? C.gold : C.red;
      body += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${col}"/>`;
    }
    return `<g class="pc-embers" opacity=".9">${body}</g>`;
  };

  P.dust = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .9) * H, w = n(o.w, 1.4) * W;
    let body = "";
    for (let i = 0; i < 7; i++) {
      const px = x + (i - 3) * w * .16;
      body += `<ellipse cx="${px}" cy="${y + (i % 3) * 16}" rx="${w * (.16 + (i % 3) * .04)}" ry="${18 + (i % 2) * 12}"/>`;
    }
    return `<g class="pc-dust" opacity="${n(o.opacity, .5)}">${cut(body, o.color || C.shade, { shadow: false })}</g>`;
  };

  P.reeds = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .96) * H, s = n(o.s, 1), count = n(o.count, 12);
    let body = "";
    for (let i = 0; i < count; i++) {
      const px = x + (i - (count - 1) / 2) * 34 * s;
      const hh = (120 + (i % 5) * 46) * s;
      const bend = ((i % 3) - 1) * 34 * s;
      body += `<path d="M ${px - 5 * s} ${y} Q ${px + bend * .4} ${y - hh * .55} ${px + bend} ${y - hh} L ${px + bend + 9 * s} ${y - hh + 6} Q ${px + bend * .5 + 8 * s} ${y - hh * .5} ${px + 7 * s} ${y} Z"/>`;
    }
    return cut(body, o.color || C.ink2, { so: .12, sy: 8, cls: "pc-reeds" });
  };

  P.rocks = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .98) * H, s = n(o.s, 1);
    let body = "";
    for (let i = 0; i < 5; i++) {
      const px = x + (i - 2) * 120 * s;
      const hh = (70 + (i % 3) * 60) * s;
      body += `<path d="M ${px - 90 * s} ${y} L ${px - 54 * s} ${y - hh * .72} L ${px - 8 * s} ${y - hh} L ${px + 44 * s} ${y - hh * .66} L ${px + 88 * s} ${y} Z"/>`;
    }
    return cut(body, o.color || C.ink2, { so: .18, sx: 8, sy: 14 });
  };

  P.pennant = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .86) * H, s = n(o.s, 1), flip = o.flip ? -1 : 1;
    const ch = o.text || "";
    const body = `<rect x="${x - 5 * s}" y="${y - 420 * s}" width="${10 * s}" height="${420 * s}"/>
      <path d="M ${x + 5 * s} ${y - 410 * s} L ${x + flip * 176 * s} ${y - 396 * s} L ${x + flip * 176 * s} ${y - 250 * s} L ${x + 5 * s} ${y - 236 * s} Z"/>`;
    const txt = ch ? `<text x="${x + flip * 92 * s}" y="${y - 300 * s}" font-family="PaperKai,serif" font-size="${86 * s}" font-weight="700" fill="${C.paper}" text-anchor="middle">${esc(ch)}</text>` : "";
    return `<g class="pc-pennant">` + cut(body, o.color || C.red, { so: .2, sx: 8, sy: 14 }) + txt + `</g>`;
  };

  P.drape = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, len = n(o.len, .34) * H, w = n(o.w, .17) * W, top = n(o.y0, -20);
    const body = `<path d="M ${x - w / 2} ${top} L ${x + w / 2} ${top} L ${x + w * .56} ${top + len} Q ${x + w * .3} ${top + len + 44} ${x + w * .1} ${top + len - 12} Q ${x} ${top + len - 34} ${x - w * .12} ${top + len - 6} Q ${x - w * .34} ${top + len + 40} ${x - w * .56} ${top + len} Z"/>
      <rect x="${x - w * .5}" y="${top + len - 60}" width="${w * .16}" height="60" opacity=".16"/>`;
    return cut(body, o.color || C.red2, { so: .18, sx: 8, sy: 12 });
  };

  P.palaceWall = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, 1.02) * H, w = n(o.w, 1.26) * W, h = n(o.h, .82) * H;
    const left = x - w / 2, base = y, wallTop = y - h * .54, roofBot = wallTop - h * .02, roofTop = wallTop - h * .26;
    const eaveD = (yy, ww, hh) => `M ${x - ww / 2 - 54} ${yy} Q ${x - ww * .3} ${yy - hh * .25} ${x} ${yy - hh} Q ${x + ww * .3} ${yy - hh * .25} ${x + ww / 2 + 54} ${yy} L ${x + ww / 2} ${yy + hh * .3} Q ${x} ${yy - hh * .06} ${x - ww / 2} ${yy + hh * .3} Z`;
    let body = `<rect x="${left}" y="${wallTop}" width="${w}" height="${base - wallTop}"/>`;
    body += `<path d="${eaveD(roofBot - h * .1, w * 1.02, h * .12)}" fill="${C.ink2}" opacity=".92"/>`;
    body += `<path d="${eaveD(roofBot, w * .88, h * .1)}"/>`;
    body += `<path d="${eaveD(roofTop - h * .06, w * .64, h * .1)}" fill="${C.ink2}" opacity=".92"/>`;
    body += `<path d="${eaveD(roofTop - h * .12, w * .54, h * .09)}"/>`;
    body += `<rect x="${x - w * .45}" y="${roofTop - h * .005}" width="${w * .9}" height="${10}" fill="${C.gold}" opacity=".8"/>`;
    const bays = 6, bw = w * .88 / bays, bx0 = x - w * .44;
    for (let i = 0; i <= bays; i++) {
      const px = bx0 + i * bw;
      body += `<rect x="${px - 9}" y="${wallTop + 6}" width="18" height="${base - wallTop - 6}"/>`;
      body += `<rect x="${px - 17}" y="${wallTop + 4}" width="34" height="12" fill="${C.gold}" opacity=".85"/>`;
      body += `<rect x="${px - 16}" y="${roofBot + h * .14}" width="32" height="12" fill="${C.gold}" opacity=".75"/>`;
    }
    for (let i = 0; i < bays; i++) {
      const px = bx0 + i * bw + 14, pw = bw - 28;
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 3; c++) {
          body += `<rect x="${px + c * pw / 3 + 4}" y="${wallTop + h * .06 + r * h * .075}" width="${pw / 3 - 8}" height="${h * .055}" fill="${C.paper}" opacity=".22"/>`;
        }
      }
    }
    body += `<path d="M ${x - w * .09} ${base} L ${x - w * .09} ${base - h * .2} Q ${x} ${base - h * .27} ${x + w * .09} ${base - h * .2} L ${x + w * .09} ${base} Z" fill="${C.red2}"/>
      <rect x="${x - w * .012}" y="${base - h * .2}" width="${w * .024}" height="${h * .2}" fill="${C.ink}" opacity=".8"/>`;
    body += `<rect x="${x - w * .26}" y="${base - h * .03}" width="${w * .52}" height="${h * .03}" fill="${C.ink2}" opacity=".65"/>`;
    return cut(body, o.color || C.teal2, { so: .22, sx: 10, sy: 16 });
  };

  P.screen = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .92) * H, w = n(o.w, .62) * W, h = n(o.h, .4) * H;
    const np = n(o.panels, 5), pw = w / np, top = y - h;
    let body = "", art = "";
    for (let i = 0; i < np; i++) {
      const px = x - w / 2 + i * pw, mx = px + pw / 2, mw = pw - 46;
      body += `<rect x="${px + 6}" y="${top}" width="${pw - 12}" height="${h}" rx="3"/>`;
      art += `<rect x="${px + 17}" y="${top + 18}" width="${pw - 34}" height="${h - 58}" fill="${C.paper2}" opacity=".95"/>`;
      art += `<path d="M ${mx - mw / 2} ${top + h * .62} Q ${mx - mw * .22} ${top + h * .3} ${mx - mw * .04} ${top + h * .46} Q ${mx + mw * .1} ${top + h * .24} ${mx + mw / 2} ${top + h * .58} L ${mx + mw / 2} ${top + h - 44} L ${mx - mw / 2} ${top + h - 44} Z" fill="${C.ink2}" opacity=".3"/>`;
      art += `<path d="M ${mx - mw * .34} ${top + h * .5} Q ${mx - mw * .2} ${top + h * .4} ${mx - mw * .08} ${top + h * .52}" fill="none" stroke="${C.ink}" stroke-width="3" opacity=".22"/>`;
      if (i === Math.floor((np - 1) / 2)) {
        art += `<circle cx="${mx + pw * .16}" cy="${top + h * .2}" r="${Math.max(10, pw * .075)}" fill="${C.red}" opacity=".55"/>`;
      }
    }
    for (let i = 0; i <= np; i++) {
      body += `<rect x="${x - w / 2 + i * pw - 4}" y="${top - 8}" width="8" height="${h + 16}" fill="${C.gold}"/>`;
    }
    body += `<rect x="${x - w / 2 - 12}" y="${top - 16}" width="${w + 24}" height="12" fill="${C.gold}"/>`;
    return cut(body, o.color || C.red2, { so: .18, sx: 8, sy: 12 }) + art;
  };

  P.dais = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .95) * H, w = n(o.w, .5) * W, s = n(o.s, 1);
    let body = "";
    for (let i = 0; i < 3; i++) {
      const ww = w * (1 - i * .14) * s, hh = 34 * s;
      body += `<rect x="${x - ww / 2}" y="${y - (i + 1) * hh}" width="${ww}" height="${hh}" rx="3"/>`;
    }
    body += `<rect x="${x - w * .2 * s}" y="${y - 3 * 34 * s}" width="${w * .4 * s}" height="${3 * 34 * s}" fill="${C.red2}" opacity=".9"/>`;
    return cut(body, o.color || C.ochre, { so: .18, sx: 8, sy: 12 });
  };

  P.candelabra = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .95) * H, s = n(o.s, 1);
    let body = `<rect x="${x - 7 * s}" y="${y - 250 * s}" width="${14 * s}" height="${250 * s}"/>
      <path d="M ${x - 110 * s} ${y - 210 * s} L ${x + 110 * s} ${y - 210 * s}" stroke="${C.ochre}" stroke-width="${10 * s}"/>`;
    for (let i = -1; i <= 1; i++) {
      const px = x + i * 110 * s;
      body += `<rect x="${px - 14 * s}" y="${y - 218 * s}" width="${28 * s}" height="${26 * s}" rx="4"/>
        <rect x="${px - 5 * s}" y="${y - 258 * s}" width="${10 * s}" height="${40 * s}" fill="${C.white}"/>`;
    }
    const flames = [-1, 0, 1].map((i) => {
      const px = x + i * 110 * s;
      return `<path d="M ${px} ${y - 262 * s} Q ${px - 16 * s} ${y - 292 * s} ${px} ${y - 324 * s} Q ${px + 16 * s} ${y - 292 * s} ${px} ${y - 262 * s} Z" fill="${C.gold}"/>`;
    }).join("");
    return cut(body, o.color || C.ochre, { so: .18, sx: 8, sy: 12 }) + flames;
  };

  P.incense = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .95) * H, s = n(o.s, 1);
    const body = `<g transform="translate(${x} ${y}) scale(${s})">
      <path d="M -62 -120 Q -78 -10 0 0 Q 78 -10 62 -120 Z"/>
      <rect x="-78" y="-134" width="156" height="22" rx="8"/>
      <rect x="-52" y="-196" width="104" height="62" rx="8"/>
      <path d="M -60 -134 Q -30 -104 0 -134 T 60 -134" fill="none" stroke="${C.gold}" stroke-width="6" opacity=".8"/>
      <rect x="-46" y="0" width="16" height="46"/><rect x="30" y="0" width="16" height="46"/>
    </g>`;
    const puffs = [[0, -210, 20], [14, -258, 24], [-6, -306, 18]].map(([dx, dy, r], i) =>
      `<circle cx="${x + dx * s}" cy="${y + dy * s}" r="${r * s}" fill="${C.paper}" opacity="${.4 - i * .08}"/>`).join("");
    return cut(body, o.color || C.ochre, { so: .16, sx: 6, sy: 10 }) + `<g class="pc-smoke">${puffs}</g>`;
  };

  P.slips = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .9) * H, s = n(o.s, 1);
    let body = "";
    for (let i = 0; i < 17; i++) {
      const px = x + (i - 8) * 26 * s + ((i * 37) % 40) * s;
      const py = y - ((i * 53) % 90) * s;
      const rot = (i * 47) % 90 - 45;
      body += `<g transform="translate(${px} ${py}) rotate(${rot})"><rect x="-9" y="-64" width="18" height="128" rx="2"/></g>`;
    }
    return cut(body, o.color || C.ochre, { so: .14, sx: 6, sy: 10 });
  };

  P.tents = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .88) * H, s = n(o.s, 1);
    let body = "";
    for (let i = -1; i <= 1; i++) {
      const px = x + i * 150 * s, py = y - (i === 0 ? 26 * s : 0);
      body += `<path d="M ${px - 95 * s} ${py} L ${px} ${py - 120 * s} L ${px + 95 * s} ${py} Z"/>`;
      body += `<path d="M ${px - 22 * s} ${py} L ${px} ${py - 66 * s} L ${px + 22 * s} ${py} Z" fill="${C.ink}" opacity=".7"/>`;
      body += `<rect x="${px - 2 * s}" y="${py - 176 * s}" width="${4 * s}" height="${56 * s}"/>`;
      body += `<path d="M ${px + 2 * s} ${py - 174 * s} L ${px + 52 * s} ${py - 164 * s} L ${px + 2 * s} ${py - 150 * s} Z" fill="${C.red}"/>`;
    }
    body += `<path d="M ${x - 40 * s} ${y} Q ${x} ${y - 54 * s} ${x + 40 * s} ${y} Z" fill="${C.gold}" opacity=".85"/>`;
    return cut(body, o.color || C.paper2, { so: .16, sx: 8, sy: 12 });
  };

  P.spears = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .98) * H, s = n(o.s, 1), count = n(o.count, 7);
    let body = "";
    for (let i = 0; i < count; i++) {
      const px = x + (i - (count - 1) / 2) * 40 * s;
      const lean = ((i % 4) - 1.5) * 8;
      body += `<g transform="translate(${px} ${y}) rotate(${lean})">
        <rect x="-3" y="${-330 * s}" width="6" height="${330 * s}"/>
        <path d="M -12 ${-330 * s} L 0 ${-374 * s} L 12 ${-330 * s} Z"/>
      </g>`;
    }
    return cut(body, o.color || C.ink, { so: .14, sx: 6, sy: 10, cls: "pc-spears" });
  };

  P.sandbags = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .95) * H, w = n(o.w, .5) * W, s = n(o.s, 1);
    let body = "";
    for (let r = 0; r < 3; r++) {
      for (let i = 0; i < 6 - r; i++) {
        const bw = 74 * s, px = x - w / 2 + (r * bw) / 2 + i * bw, py = y - r * 40 * s;
        body += `<rect x="${px}" y="${py - 38 * s}" width="${bw - 6}" height="${38 * s}" rx="${16 * s}"/>`;
      }
    }
    return cut(body, o.color || C.paper2, { so: .16, sx: 6, sy: 10 });
  };

  P.muzzle = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .5) * H, r = n(o.r, 60);
    let rays = "";
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      const r0 = r * .5, r1 = r * (1 + (i % 2) * .5);
      const sp = .16;
      rays += `<path d="M ${x + Math.cos(a) * r0} ${y + Math.sin(a) * r0} L ${x + Math.cos(a - sp) * r1} ${y + Math.sin(a - sp) * r1} L ${x + Math.cos(a + sp) * r1} ${y + Math.sin(a + sp) * r1} Z"/>`;
    }
    return `<g class="pc-muzzle">${cut(rays, o.color || C.gold, { shadow: false })}${cut(`<circle cx="${x}" cy="${y}" r="${r * .44}"/>`, C.white, { shadow: false })}</g>`;
  };

  P.junk = (o) => {
    o = o || {};
    const x = n(o.x, .5) * W, y = n(o.y, .82) * H, s = n(o.s, 1), f = o.facing === "left" ? -1 : 1;
    const rot = n(o.rot, 0);
    const g = (inner) => `<g transform="translate(${x} ${y}) scale(${f * s} ${s}) rotate(${rot})">${inner}</g>`;
    let hull = `<path d="M -216 -26 Q -132 50 36 52 L 218 52 L 198 -24 Z"/>
      <path d="M 112 -24 L 138 -112 L 190 -112 L 200 -24 Z"/>
      <rect x="-190" y="-34" width="360" height="16" rx="6"/>
      <rect x="-112" y="-94" width="126" height="60" rx="5"/>
      <rect x="-108" y="-102" width="118" height="12" rx="4"/>
      <path d="M -222 -32 Q -238 -60 -266 -54 L -254 -30 Z"/>`;
    let sails = "";
    [[-104, 214, 108], [0, 288, 146], [104, 240, 112]].forEach(([mx, mh, sw]) => {
      const top = -40 - mh, bot = -52;
      hull += `<rect x="${mx - 4}" y="${top}" width="8" height="${mh - 10}"/>`;
      sails += `<path d="M ${mx - 26} ${bot} L ${mx - sw * .58} ${top + 26} L ${mx + sw * .54} ${top + 14} L ${mx + sw * .46} ${bot} Z"/>`;
      for (let k = 1; k <= 4; k++) {
        const yy = bot - ((bot - top - 22) * k) / 5;
        sails += `<line x1="${mx - sw * .5}" y1="${yy}" x2="${mx + sw * .46}" y2="${yy - 4}" stroke="${C.ink}" stroke-width="4" opacity=".28"/>`;
      }
    });
    const rig = `<path d="M 4 -344 L 96 -318 L 4 -292 Z" fill="${C.red}"/>
      <line x1="4" y1="-344" x2="4" y2="-336" stroke="${C.ink}" stroke-width="4"/>
      <line x1="0" y1="-338" x2="-104" y2="-254" stroke="${C.ink}" stroke-width="3" opacity=".45"/>
      <line x1="0" y1="-338" x2="104" y2="-280" stroke="${C.ink}" stroke-width="3" opacity=".45"/>`;
    return `<g class="pc-junk">` + cut(g(hull), o.color || C.ink2, { so: .22, sx: 10, sy: 16 }) +
      cut(g(sails), o.sailColor || C.paper2, { so: .16, sx: 8, sy: 12 }) +
      g(rig) + `</g>`;
  };

  const ROLE = {
    emperor: { robe: C.ink, hat: "crown", w: 1.0 },
    official: { robe: C.teal2, hat: "official", w: .95 },
    general: { robe: C.ink2, hat: "helmet", w: 1.05 },
    soldier: { robe: C.ink, hat: "helmet", w: .9 },
    scholar: { robe: C.ochre, hat: "scholar", w: .95 },
    woman: { robe: C.red2, hat: "bun", w: .92 },
    monk: { robe: C.ochre, hat: "bald", w: .95 },
    nomad: { robe: C.ochre, hat: "fur", w: 1.0 },
  };

  const POSE = {
    stand: { lean: 0, aL: 0, aR: 0, w: 0, legL: 0, legR: 0 },
    walk: { lean: -4, aL: 16, aR: -22, w: 12, legL: 12, legR: -12 },
    run: { lean: -12, aL: 34, aR: -52, w: 18, legL: 26, legR: -26 },
    lunge: { lean: -18, aL: 24, aR: -72, w: 42, legL: 32, legR: -20 },
    raise: { lean: -4, aL: 12, aR: -128, w: 0, legL: 8, legR: -8 },
    aim: { lean: -6, aL: -74, aR: -80, w: 90, legL: 14, legR: -14 },
    brace: { lean: -14, aL: -20, aR: -64, w: 90, legL: 26, legR: -26 },
  };
  const WEAPON = {
    sword: `<rect x="-5" y="-170" width="10" height="152" rx="3"/><rect x="-26" y="-24" width="52" height="9" rx="3"/><rect x="-6" y="-20" width="12" height="40" rx="3"/>`,
    spear: `<rect x="-4" y="-196" width="8" height="248"/><path d="M -16 -196 L 0 -250 L 16 -196 Z"/><path d="M -4 -140 L 4 -140 L 4 -120 L -4 -120 Z" fill="${C.red}"/>`,
    dagger: `<rect x="-4" y="-58" width="8" height="52" rx="2"/><rect x="-15" y="-12" width="30" height="7" rx="3"/>`,
    hammer: `<rect x="-4" y="-124" width="8" height="136"/><rect x="-32" y="-152" width="64" height="36" rx="6"/>`,
    bow: `<path d="M 0 -112 Q 58 -44 0 26" fill="none" stroke="${C.ink}" stroke-width="8"/><line x1="0" y1="-112" x2="0" y2="26" stroke="${C.ink}" stroke-width="3"/>`,
    shield: `<path d="M -42 -62 L 42 -62 L 42 10 Q 0 54 -42 10 Z"/>`,
  };

  function person(o) {
    o = o || {};
    const role = ROLE[o.role] ? o.role : "official";
    const R = ROLE[role];
    const x = n(o.x, .5) * W, y = n(o.y, .82) * H, s = n(o.s, 1) * R.w, f = o.facing === "left" ? -1 : 1;
    const fill = o.color || R.robe;
    const Q = POSE[o.pose] || POSE.stand;
    const wepSVG = WEAPON[o.weapon] || "";
    const flare = Q.lean <= -12
      ? `<path class="pc-cape pc-cape-l" d="M -30 -120 Q -98 -62 -68 8 L -32 -10 Z" opacity=".62"/><path class="pc-cape pc-cape-r" d="M 28 -116 Q 94 -70 72 4 L 38 -12 Z" opacity=".48"/>`
      : "";
    let hat = "";
    if (R.hat === "crown") hat = `<rect x="-4" y="-206" width="8" height="16"/><rect x="-52" y="-200" width="104" height="12" rx="3"/><path d="M -40 -188 L 40 -188 L 34 -160 L -34 -160 Z"/><rect x="-46" y="-188" width="3" height="42"/><rect x="43" y="-188" width="3" height="42"/><circle cx="-44" cy="-144" r="5"/><circle cx="45" cy="-144" r="5"/>`;
    if (R.hat === "official") hat = `<path d="M -34 -176 L 34 -176 L 26 -156 L -26 -156 Z"/><rect x="-46" y="-168" width="92" height="8" rx="3"/>`;
    if (R.hat === "helmet") hat = `<path d="M -34 -178 Q 0 -214 34 -178 L 30 -160 L -30 -160 Z"/><rect x="-4" y="-218" width="8" height="38"/>`;
    if (R.hat === "scholar") hat = `<path d="M -30 -176 L 30 -176 L 24 -160 L -24 -160 Z"/>`;
    if (R.hat === "bun") hat = `<circle cx="0" cy="-184" r="18"/><path d="M -28 -170 Q 0 -190 28 -170 L 24 -158 L -24 -158 Z"/>`;
    if (R.hat === "fur") hat = `<path d="M -38 -176 Q 0 -206 38 -176 L 32 -156 L -32 -156 Z"/>`;
    const body = `<g class="pc-person pc-${role}" transform="translate(${x} ${y}) scale(${f * s} ${s})">
      <g class="pc-breathe">
        <g class="pc-torso" transform="rotate(${Q.lean}, 0, -44)">
          <g class="pc-arm pc-arm-l" transform="rotate(${Q.aL}, -19, -130)">
            <path d="M -19 -134 C -44 -128 -60 -102 -66 -78 L -46 -68 C -42 -92 -28 -112 -9 -120 Z"/>
          </g>
          <g class="pc-arm pc-arm-r" transform="rotate(${Q.aR}, 19, -130)">
            <path d="M 19 -134 C 46 -126 62 -100 68 -76 L 48 -66 C 44 -90 30 -110 9 -120 Z"/>
            ${wepSVG ? `<g transform="translate(66 -74) rotate(${Q.w})">${wepSVG}</g>` : ""}</g>
          <path class="pc-robe" d="M -27 -138 L 27 -138 L 36 -102 L 25 -62 L 52 -8 L 27 -2 L 14 -18 L 0 -8 L -14 -18 L -27 -2 L -52 -8 L -25 -62 L -36 -102 Z"/>
          ${flare}
          <path d="M -12 -100 L -17 -16 M 10 -100 L 15 -20" fill="none" stroke="${C.ink}" stroke-width="4" opacity=".2"/>
          ${role === "emperor" ? `<path d="M -27 -138 L 0 -108 L 27 -138 Z" fill="${C.gold}"/><rect x="-42" y="-86" width="84" height="10" rx="4" fill="${C.gold}"/><path d="M -52 -8 L -27 -2 L -23 -16 Z" fill="${C.gold}" opacity=".75"/><path d="M 52 -8 L 27 -2 L 23 -16 Z" fill="${C.gold}" opacity=".75"/>` : ""}
          ${role === "general" || role === "soldier" ? `<path d="M -31 -97 L 31 -97 L 28 -78 L -28 -78 Z" fill="${C.ochre}"/><path d="M -25 -76 L 25 -76 L 22 -61 L -22 -61 Z" fill="${C.ochre}" opacity=".72"/>` : ""}
          ${role === "official" ? `<path d="M -27 -138 L 0 -108 L 27 -138 Z" fill="${C.paper2}"/><rect x="-36" y="-82" width="72" height="8" rx="3" fill="${C.gold}" opacity=".8"/>` : ""}
          ${role === "general" && !wepSVG ? `<path d="M 40 -120 L 74 -34 L 60 -28 L 30 -110 Z" fill="${C.ink}" opacity=".9"/>` : ""}
          ${role === "soldier" && !wepSVG ? `<rect x="46" y="-282" width="7" height="252" fill="${C.ink}"/><path d="M 49 -300 L 64 -270 L 34 -270 Z" fill="${C.ink}"/>` : ""}
          <rect class="pc-neck" x="-7" y="-144" width="14" height="14"/>
          <circle class="pc-head" cx="0" cy="-157" r="24"/>
          <g class="pc-hat" transform="translate(0 -157) scale(.86) translate(0 157)">${hat}</g>
        </g>
        <g class="pc-leg pc-leg-l" transform="rotate(${Q.legL}, -14, -44)"><rect x="-25" y="-50" width="15" height="48"/><path d="M -25 0 L -6 0 L -4 9 L -29 9 Z"/></g>
        <g class="pc-leg pc-leg-r" transform="rotate(${Q.legR}, 14, -44)"><rect x="5" y="-50" width="15" height="48"/><path d="M 5 0 L 24 0 L 28 9 L 3 9 Z"/></g>
      </g>
    </g>`;
    return cut(body, fill, { so: .16, sy: 10, cls: "pc-person-wrap", eo: 0.1, ew: 1.3 });
  }

  /* ---------- 场景模板 ---------- */
  function defaultLayers(shot) {
    const t = shot.type || "tableau";
    const L = [];
    const sky = { kind: "sky", props: [] };
    if (t === "battle") {
      L.push(sky,
        { kind: "far", props: [{ shape: "sun", x: .82, y: .2, r: 86, color: C.red }, { shape: "cloud", x: .25, y: .18, s: .9 }, { shape: "mountain", x: .5, y: .72, w: 1.4, h: .34, color: C.ochre }] },
        { kind: "mid", props: [{ shape: "ridge", x: .5, y: .8, w: 1.5, h: .12, color: C.teal2 }, { shape: "fire", x: .72, y: .76, s: 1.1 }, { shape: "smoke", x: .72, y: .68, s: 1.0 }] },
        { kind: "action", props: [{ shape: "army", x: .35, y: .88, cols: 9, rows: 3, s: .6, facing: "right" }, { shape: "army", x: .7, y: .9, cols: 8, rows: 3, s: .62, facing: "left", color: C.teal2 }] },
        { kind: "fore", props: [{ shape: "banner", x: .12, y: .9, s: 1.05 }, { shape: "banner", x: .9, y: .92, s: .95, flip: true, color: C.teal }] });
    } else if (t === "court") {
      L.push(sky,
        { kind: "far", props: [{ shape: "hall", x: .5, y: .9, w: .95, h: .62 }] },
        { kind: "mid", props: [{ shape: "throne", x: .5, y: .8, s: 1.15 }, { shape: "lantern", x: .18, y: .22, s: .8 }, { shape: "lantern", x: .82, y: .22, s: .8 }] },
        { kind: "action", props: [{ shape: "crowd", x: .5, y: .9, s: .9, color: C.ink2 }] },
        { kind: "fore", props: [{ shape: "banner", x: .08, y: .95, s: 1.2, color: C.red }, { shape: "banner", x: .92, y: .95, s: 1.2, color: C.red, flip: true }] });
    } else if (t === "map") {
      L.push(sky,
        { kind: "far", props: [{ shape: "mountain", x: .2, y: .8, w: .8, h: .2, color: C.shade }] },
        { kind: "mid", props: [{ shape: "map", x: .5, y: .55, w: .92, h: .56 }] },
        { kind: "action", props: [{ shape: "banner", x: .28, y: .52, s: .5 }, { shape: "banner", x: .72, y: .56, s: .5, color: C.teal, flip: true }] },
        { kind: "fore", props: [{ shape: "coin", x: .14, y: .86, s: .35 }, { shape: "scroll", x: .86, y: .88, w: .2, h: .12 }] });
    } else if (t === "object") {
      L.push(sky,
        { kind: "far", props: [{ shape: "cloud", x: .25, y: .2, s: 1.2 }, { shape: "cloud", x: .78, y: .16, s: .9 }] },
        { kind: "mid", props: [{ shape: "scroll", x: .5, y: .56, w: .78, h: .44 }] },
        { kind: "action", props: [{ shape: "seal", x: .5, y: .52, s: 1.1, text: shot.seal || "史" }] },
        { kind: "fore", props: [{ shape: "lantern", x: .12, y: .3, s: .5 }, { shape: "lantern", x: .88, y: .3, s: .5 }] });
    } else if (t === "wall") {
      L.push(sky,
        { kind: "far", props: [{ shape: "sun", x: .2, y: .16, r: 64, color: C.red }, { shape: "cloud", x: .68, y: .14, s: 1.1 }, { shape: "mountain", x: .5, y: .68, w: 1.5, h: .36, color: C.ochre }] },
        { kind: "mid", props: [{ shape: "greatwall", x: .5, y: .7, w: 1.4 }] },
        { kind: "action", props: [{ shape: "soldier", x: .25, y: .78, s: 1.1, facing: "right" }, { shape: "soldier", x: .32, y: .79, s: 1.0, facing: "right" }] },
        { kind: "fore", props: [{ shape: "snow", x: .5, y: .5 }, { shape: "pine", x: .06, y: .92, s: 1.2 }] });
    } else if (t === "river") {
      L.push(sky,
        { kind: "far", props: [{ shape: "mountain", x: .5, y: .62, w: 1.5, h: .28, color: C.teal2 }, { shape: "cloud", x: .3, y: .18, s: 1.0 }] },
        { kind: "mid", props: [{ shape: "river", x: .5, y: .78, w: 1.5 }] },
        { kind: "action", props: [{ shape: "fleet", x: .5, y: .82, s: .8 }] },
        { kind: "fore", props: [{ shape: "tree", x: .06, y: .92, s: 1.0 }, { shape: "bridge", x: .88, y: .88, w: .34 }] });
    } else if (t === "tomb") {
      L.push(sky,
        { kind: "far", props: [{ shape: "moon", x: .78, y: .16, r: 72 }, { shape: "mountain", x: .5, y: .72, w: 1.5, h: .3, color: C.teal2 }] },
        { kind: "mid", props: [{ shape: "tomb", x: .5, y: .8, s: 1.1, text: shot.seal || "陵" }] },
        { kind: "action", props: [{ shape: "pine", x: .18, y: .86, s: 1.1 }, { shape: "pine", x: .84, y: .88, s: .9 }] },
        { kind: "fore", props: [{ shape: "smoke", x: .5, y: .55, s: .6 }] });
    } else if (t === "steppe") {
      L.push(sky,
        { kind: "far", props: [{ shape: "cloud", x: .3, y: .16, s: 1.2 }, { shape: "cloud", x: .75, y: .2, s: .9 }, { shape: "mountain", x: .5, y: .6, w: 1.6, h: .22, color: C.shade }] },
        { kind: "mid", props: [{ shape: "steppe", x: .5, y: .8 }] },
        { kind: "action", props: [{ shape: "yurt", x: .28, y: .82, s: .8 }, { shape: "yurt", x: .42, y: .84, s: .65 }, { shape: "cavalry", x: .7, y: .88, s: .9, facing: "left" }] },
        { kind: "fore", props: [{ shape: "banner", x: .1, y: .92, s: 1.0, color: C.ochre }] });
    } else if (t === "crowd") {
      L.push(sky,
        { kind: "far", props: [{ shape: "city", x: .5, y: .7, w: 1.3 }, { shape: "sun", x: .8, y: .18, r: 62, color: C.red }] },
        { kind: "mid", props: [{ shape: "gate", x: .5, y: .8, w: .9, h: .42 }] },
        { kind: "action", props: [{ shape: "crowd", x: .5, y: .92, s: 1.05 }] },
        { kind: "fore", props: [{ shape: "banner", x: .08, y: .98, s: 1.2 }, { shape: "banner", x: .92, y: .98, s: 1.2, flip: true }] });
    } else if (t === "title") {
      L.push(sky,
        { kind: "far", props: [{ shape: "dragon", x: .5, y: .38, s: 1.1 }, { shape: "cloud", x: .2, y: .2, s: .9 }, { shape: "cloud", x: .8, y: .24, s: .8 }] },
        { kind: "mid", props: [{ shape: "palace", x: .5, y: .88, w: 1.0, h: .3 }] },
        { kind: "action", props: [] },
        { kind: "fore", props: [{ shape: "lantern", x: .14, y: .3, s: .7 }, { shape: "lantern", x: .86, y: .3, s: .7 }] });
    } else {
      L.push(sky,
        { kind: "far", props: [{ shape: "mountain", x: .5, y: .72, w: 1.4, h: .3, color: C.ochre }] },
        { kind: "mid", props: [{ shape: "palace", x: .5, y: .84, w: .9, h: .36 }] },
        { kind: "action", props: [] },
        { kind: "fore", props: [{ shape: "banner", x: .08, y: .94, s: 1.1 }, { shape: "banner", x: .92, y: .94, s: 1.1, flip: true }] });
    }
    return L;
  }

  function layerSVG(layer, i) {
    const props = (layer.props || []).map((p) => {
      const fn = P[p.shape] || P.mountain;
      const h = fn(p);
      return p.opacity != null ? `<g opacity="${p.opacity}">${h}</g>` : h;
    }).join("");
    const bg = layer.kind === "sky"
      ? `<rect width="${W}" height="${H}" fill="${C.paper}"/><rect width="${W}" height="${H}" fill="url(#pc-sky-${i})" opacity=".9"/>`
      : "";
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="pc-sky-${i}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${C.paper}"/><stop offset=".55" stop-color="${C.paper2}"/><stop offset="1" stop-color="${C.shade}"/>
      </linearGradient></defs>${bg}${props}</svg>`;
  }

  function buildShot(shot, index) {
    const layers = (shot.layers && shot.layers.length ? shot.layers : defaultLayers(shot));
    const layerHTML = layers.map((l, i) => {
      const depth = l.depth != null ? l.depth : [0.35, 0.55, 0.75, 1.0, 1.25][Math.min(i, 4)];
      return `<div class="pc-layer pc-${l.kind || "mid"}" data-depth="${depth}">${layerSVG(l, index + "-" + i)}</div>`;
    }).join("");
    const chars = (shot.chars || []).map((c) => person(c)).join("");
    const charsSVG = chars
      ? `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">${chars}</svg>`
      : "";
    const title = shot.title || "";
    const sub = shot.subtitle || "";
    const kicker = shot.kicker || "";
    return `<div class="shot" data-shot="${esc(shot.id || "s" + index)}" data-t0="${n(shot.t0, 0)}" data-t1="${n(shot.t1, 0)}">
      <div class="shot-world">${layerHTML}${chars ? `<div class="pc-chars">${charsSVG}</div>` : ""}</div>
      ${title || sub || kicker ? `<div class="shot-title">${kicker ? `<div class="tc-kicker">${esc(kicker)}</div>` : ""}${title ? `<div class="tc-title">${esc(title)}</div>` : ""}${sub ? `<div class="tc-sub">${esc(sub)}</div>` : ""}</div>` : ""}
      <div class="shot-vignette"></div>
    </div>`;
  }

  function buildStage(shots) {
    return shots.map((s, i) => buildShot(s, i)).join("");
  }

  global.PaperCut = { W, H, C, P, person, buildShot, buildStage, defaultLayers };
})(window);
