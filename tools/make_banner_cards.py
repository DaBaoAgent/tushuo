# -*- coding: utf-8 -*-
"""官渡逐人旗帜卡：沿用 参考视频和logo/曹操阵营旗帜.png / 袁绍阵营旗帜.png 的
竖向破风旗形、浅色包边、中央旗杆与阵营双色调，把归一化人物头像压进旗面。

输出 assets/banner-cards/<key>.png（480x720 RGBA）与 meta.json。
缺人物原图的人物生成剪影占位卡，并在姓名牌上标「缺图」。
"""
import json
import os
import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CMD_DIR = os.path.join(ROOT, 'assets', 'commanders')
OUT_DIR = os.path.join(ROOT, 'assets', 'banner-cards')
SHEET = os.path.join(OUT_DIR, '00-cards.jpg')

CW, CH = 480, 720
POLE_X = 240
ANCHOR_Y = 700 / CH

# 参考图提取的旗面轮廓（按 1296x1728 归一化后换到 480x720）
CLOTH = [
    (245, 31), (237, 84), (121, 110), (137, 114), (145, 569), (240, 531),
    (248, 682), (252, 528), (336, 518), (346, 107), (365, 74), (252, 83),
]

PALETTES = {
    'cao': {  # 曹操阵营旗帜.png：暗绛红
        'dark': (42, 10, 12), 'mid': (90, 24, 32), 'light': (141, 48, 59),
        'hi': (176, 92, 99), 'trim': (233, 227, 220), 'edge': (24, 12, 10),
        'gold': (240, 207, 150),
    },
    'yuan': {  # 袁绍阵营旗帜.png：深藏青
        'dark': (10, 17, 28), 'mid': (24, 36, 56), 'light': (47, 60, 85),
        'hi': (98, 116, 145), 'trim': (229, 228, 228), 'edge': (9, 14, 22),
        'gold': (224, 197, 148),
    },
    'grey': {  # 田丰下狱：去色
        'dark': (26, 26, 26), 'mid': (58, 58, 58), 'light': (106, 102, 97),
        'hi': (143, 138, 130), 'trim': (200, 197, 192), 'edge': (14, 14, 14),
        'gold': (201, 192, 178),
    },
}

# key, 姓名, 阵营, 身份, 旗高（底图像素）, 人物图 key（None=缺图）
ROSTER = [
    ('yuan',       '袁绍',   'yuan', '主帅', 320, 'yuan'),
    ('zhanghe',    '张郃',   'yuan', '偏将', 230, 'zhanghe'),
    ('gaolan',     '高览',   'yuan', '偏将', 230, None),
    ('yuantan',    '袁谭',   'yuan', '偏将', 230, None),
    ('jushou',     '沮授',   'yuan', '谋士', 230, 'jushou'),
    ('guotu',      '郭图',   'yuan', '谋士', 230, 'guotu'),
    ('xuyou',      '许攸',   'yuan', '谋士', 230, None),
    ('cao',        '曹操',   'cao',  '主帅', 320, 'cao'),
    ('caohong',    '曹洪',   'cao',  '偏将', 230, 'caohong'),
    ('xuhuang',    '徐晃',   'cao',  '偏将', 230, 'xuhuang'),
    ('shihuan',    '史涣',   'cao',  '偏将', 230, None),
    ('zhangliao',  '张辽',   'cao',  '偏将', 230, 'zhangliao'),
    ('yujin',      '于禁',   'cao',  '偏将', 230, 'yujin'),
    ('lejin',      '乐进',   'cao',  '偏将', 230, 'lejin'),
    ('xuchu',      '许褚',   'cao',  '偏将', 230, 'xuchu'),
    ('xiahouyuan', '夏侯渊', 'cao',  '偏将', 230, 'xiahouyuan'),
    ('caoren',     '曹仁',   'cao',  '偏将', 230, 'caoren'),
    ('xunyou',     '荀攸',   'cao',  '谋士', 230, 'xunyou'),
    ('guojia',     '郭嘉',   'cao',  '谋士', 230, 'guojia'),
    ('jiaxu',      '贾诩',   'cao',  '谋士', 230, 'jiaxu'),
    ('shenpei',    '审配',   'yuan', '留守', 270, 'shenpei'),
    ('fengji',     '逢纪',   'yuan', '谋士', 230, 'fengji'),
    ('tianfeng',   '田丰',   'grey', '谋士 · 下狱', 230, 'tianfeng'),
    ('xunyu',      '荀彧',   'cao',  '守尚书令', 270, 'xunyu'),
    ('yanliang',   '颜良',   'yuan', '围白马', 230, 'yanliang'),
    ('wenchou',    '文丑',   'yuan', '延津', 230, 'wenchou'),
    ('liu',        '刘备',   'yuan', '客将', 230, 'liu'),
    ('chunyuqiong','淳于琼', 'yuan', '护粮', 230, None),
]

CMD_FILE = {'cao': 'cao-v2'}

FONT_NAME = 'C:/Windows/Fonts/STKAITI.TTF'
FONT_ROLE = 'C:/Windows/Fonts/msyh.ttc'
FONT_ROLE_BD = 'C:/Windows/Fonts/msyhbd.ttc'


def lerp(a, b, u):
    return tuple(int(round(a[i] + (b[i] - a[i]) * u)) for i in range(3))


def ramp_lut(pal):
    """0-255 灰度 → 四段阵营双色调 LUT。"""
    stops = [(0.0, pal['dark']), (0.34, pal['mid']), (0.70, pal['light']), (1.0, pal['hi'])]
    lut = []
    for i in range(256):
        u = i / 255
        for s in range(len(stops) - 1):
            a, b = stops[s], stops[s + 1]
            if u <= b[0]:
                k = (u - a[0]) / max(1e-6, b[0] - a[0])
                lut.append(lerp(a[1], b[1], k))
                break
        else:
            lut.append(stops[-1][1])
    return np.array(lut, dtype=np.uint8)


def duotone(img, pal):
    """归一化 480x480 人物 → 双色调。脸部对比略提亮。"""
    g = np.array(img.convert('L'), dtype=np.float32)
    lo, hi = np.percentile(g, 2), np.percentile(g, 98)
    g = np.clip((g - lo) / max(1e-6, hi - lo), 0, 1)
    # 轻微 S 曲线，压暗背景、保住面部层次
    g = np.clip(g ** 0.92, 0, 1)
    rgb = ramp_lut(pal)[(g * 255).astype(np.uint8)]
    return Image.fromarray(rgb, 'RGB')


def cloth_mask(feather=0):
    m = Image.new('L', (CW, CH), 0)
    ImageDraw.Draw(m).polygon(CLOTH, fill=255)
    if feather:
        m = m.filter(ImageFilter.GaussianBlur(feather))
    return m


def cloth_base(pal):
    """旗布底色：上亮下暗的纵向渐变。"""
    arr = np.zeros((CH, CW, 3), dtype=np.uint8)
    for y in range(CH):
        u = y / CH
        c = lerp(pal['dark'], pal['mid'], min(1, u * 1.25))
        c = lerp(c, pal['light'], max(0, (0.28 - u) * 2.0) if u < 0.28 else 0)
        arr[y, :, :] = c
    return Image.fromarray(arr, 'RGB')


def portrait_layer(cmd_img, pal):
    """裁掉 480 方图两侧，做成 244x400 竖幅半身，保留脸高约 167px。"""
    crop = cmd_img.convert('RGB').crop((94, 0, 94 + 293, 480))
    crop = crop.resize((244, 400), Image.LANCZOS)
    tone = duotone(crop, pal)
    layer = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
    layer.paste(tone, (118, 92))
    # 底部 70px 融进旗布，避免硬边
    fade = Image.new('L', (244, 400), 255)
    fd = ImageDraw.Draw(fade)
    for i in range(70):
        fd.line([(0, 400 - 70 + i), (244, 400 - 70 + i)], fill=int(255 * (1 - i / 69)))
    layer.putalpha(Image.composite(layer.getchannel('A'), Image.new('L', (CW, CH), 0),
                                   fade.transform((CW, CH), Image.AFFINE, (1, 0, -118, 0, 1, -92))))
    # 面部柔光（screen 混合，不压暗画面）
    glow = Image.new('RGB', (CW, CH), (0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((150, 185, 330, 400), fill=lerp(pal['mid'], pal['hi'], .30))
    glow = glow.filter(ImageFilter.GaussianBlur(46))
    alpha = layer.getchannel('A')
    lit = ImageChops.screen(layer.convert('RGB'), glow).convert('RGBA')
    lit.putalpha(alpha)
    return lit


def placeholder_layer(pal):
    """缺人物图：剪影 + 缺图提示。"""
    sil = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
    d = ImageDraw.Draw(sil)
    dark = lerp(pal['dark'], pal['mid'], .55)
    light = lerp(pal['mid'], pal['light'], .72)
    d.ellipse((188, 175, 292, 310), fill=light, outline=lerp(pal['hi'], pal['trim'], .25), width=2)
    d.polygon([(146, 500), (166, 362), (196, 320), (284, 320), (314, 362), (334, 500)],
              fill=dark, outline=lerp(pal['light'], pal['trim'], .12))
    # 头肩之间的暗部
    d.polygon([(188, 310), (292, 310), (284, 340), (196, 340)], fill=lerp(dark, light, .18))
    return sil


def folds(pal):
    """布褶：几条半透明斜向明暗线，模糊后叠在旗面上。"""
    lay = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    streaks = [
        (150, 120, 128, 540, (0, 0, 0, 48), 16),
        (196, 100, 176, 520, (255, 245, 225, 20), 9),
        (286, 110, 300, 540, (0, 0, 0, 44), 13),
        (330, 110, 350, 500, (255, 245, 225, 22), 8),
        (244, 90, 246, 520, (0, 0, 0, 30), 6),
    ]
    for x1, y1, x2, y2, c, w in streaks:
        d.line([(x1, y1), (x2, y2)], fill=c, width=w)
    return lay.filter(ImageFilter.GaussianBlur(10))


def name_plaque(card, name, role, pal, missing, leader, warden):
    d = ImageDraw.Draw(card)
    if leader:
        w, h, y0 = 286, 102, 578
    elif warden:
        w, h, y0 = 262, 94, 584
    else:
        w, h, y0 = 248, 92, 586
    x0, x1 = POLE_X - w // 2, POLE_X + w // 2
    # 挂绳：从旗布下缘垂到牌顶
    d.line([(190, 548), (POLE_X - 58, y0)], fill=(198, 172, 126, 190), width=3)
    d.line([(292, 524), (POLE_X + 58, y0)], fill=(198, 172, 126, 190), width=3)
    d.rounded_rectangle((x0, y0, x1, y0 + h), radius=13, fill=(18, 14, 11, 246),
                        outline=(213, 178, 112, 225), width=3)
    d.rounded_rectangle((x0 + 6, y0 + 6, x1 - 6, y0 + h - 6), radius=9,
                        outline=(213, 178, 112, 80), width=1)
    nfs = 50 if leader else (46 if warden else 44)
    fn = ImageFont.truetype(FONT_NAME, nfs)
    fr = ImageFont.truetype(FONT_ROLE, 22 if not leader else 23)
    # 姓名
    tw = d.textlength(name, font=fn)
    d.text(((CW - tw) / 2, y0 + (16 if leader else 13)), name, font=fn,
           fill=pal['gold'] if not missing else (216, 176, 152))
    # 身份
    rtxt = role + (' · 缺图' if missing else '')
    rcolor = (226, 148, 124) if missing else (198, 188, 168)
    rw = d.textlength(rtxt, font=fr)
    d.text(((CW - rw) / 2, y0 + h - 30), rtxt, font=fr, fill=rcolor)
    if missing:
        # 右上角小印
        d.rounded_rectangle((x1 - 42, y0 - 12, x1 - 6, y0 + 24), radius=5,
                            fill=(118, 34, 30, 235), outline=(238, 198, 150, 200), width=2)
        fs = ImageFont.truetype(FONT_ROLE_BD, 20)
        d.text((x1 - 35, y0 - 8), '缺', font=fs, fill=(248, 223, 190))


def build(key, name, side, role, h, cmd_key):
    pal = PALETTES[side]
    missing = cmd_key is None
    card = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
    mask = cloth_mask()

    # 1) 旗布底
    base = cloth_base(pal).convert('RGBA')
    card.paste(base, (0, 0), mask)

    # 2) 人像 / 剪影
    if missing:
        por = placeholder_layer(pal)
    else:
        cmd = Image.open(os.path.join(CMD_DIR, CMD_FILE.get(cmd_key, cmd_key) + '.jpg')).convert('RGB')
        por = portrait_layer(cmd, pal)
    por.putalpha(Image.composite(por.getchannel('A'), Image.new('L', (CW, CH), 0), mask))
    card = Image.alpha_composite(card, por)

    # 3) 布褶 + 内阴影
    fold = folds(pal)
    fold.putalpha(Image.composite(fold.getchannel('A'), Image.new('L', (CW, CH), 0), mask))
    card = Image.alpha_composite(card, fold)
    shade = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shade)
    sd.ellipse((-90, 40, 210, 700), fill=(0, 0, 0, 58))
    sd.ellipse((270, 40, 570, 700), fill=(0, 0, 0, 58))
    sd.rectangle((0, 520, CW, CH), fill=(0, 0, 0, 62))
    shade = shade.filter(ImageFilter.GaussianBlur(34))
    shade.putalpha(Image.composite(shade.getchannel('A'), Image.new('L', (CW, CH), 0), mask))
    card = Image.alpha_composite(card, shade)

    # 4) 浅色包边（参考图 #ebe5e3 的描边）
    border = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
    bd = ImageDraw.Draw(border)
    bd.line(CLOTH + [CLOTH[0]], fill=pal['edge'] + (120,), width=15, joint='curve')
    bd.line(CLOTH + [CLOTH[0]], fill=pal['trim'] + (255,), width=9, joint='curve')
    bd.line(CLOTH + [CLOTH[0]], fill=(255, 255, 255, 90), width=2, joint='curve')
    card = Image.alpha_composite(card, border)

    # 5) 旗杆、杆头
    po = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
    pd = ImageDraw.Draw(po)
    pd.line([(POLE_X + 2, 18), (POLE_X + 2, 704)], fill=(0, 0, 0, 130), width=12)
    pd.line([(POLE_X, 16), (POLE_X, 700)], fill=(46, 34, 24, 255), width=9)
    pd.line([(POLE_X - 3, 18), (POLE_X - 3, 698)], fill=(176, 148, 106, 130), width=2)
    pd.polygon([(POLE_X, 2), (POLE_X + 9, 17), (POLE_X, 30), (POLE_X - 9, 17)],
               fill=(215, 195, 158, 255), outline=(74, 54, 34, 255))
    card = Image.alpha_composite(card, po)

    # 6) 姓名牌
    name_plaque(card, name, role, pal, missing, h >= 300, role == '留守')
    return card


def card_sheet(items):
    cols, cw, chh = 5, 210, 315
    pad, label_h = 16, 34
    rows = (len(items) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * (cw + pad) + pad, rows * (chh + label_h + pad) + pad), (18, 20, 24))
    dr = ImageDraw.Draw(sheet)
    f = ImageFont.truetype(FONT_ROLE, 19)
    for i, (name, side, role, im, missing) in enumerate(items):
        c, r = i % cols, i // cols
        x = pad + c * (cw + pad)
        y = pad + r * (chh + label_h + pad)
        th = chh
        tw = round(im.width * th / im.height)
        sheet.paste(im.resize((tw, th), Image.LANCZOS), (x + (cw - tw) // 2, y), im.resize((tw, th), Image.LANCZOS))
        lab = f'{name} · {role}' + ('（缺图）' if missing else '')
        dr.text((x, y + th + 5), lab, font=f, fill=(230, 220, 200) if not missing else (238, 166, 142))
    sheet.save(SHEET, quality=88)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    meta = {}
    items = []
    for key, name, side, role, h, cmd_key in ROSTER:
        im = build(key, name, side, role, h, cmd_key)
        im.save(os.path.join(OUT_DIR, key + '.png'), optimize=True)
        meta[key] = dict(name=name, side=side, role=role, height=h,
                         missing=cmd_key is None, file=key + '.png',
                         anchor=[.5, round(ANCHOR_Y, 4)])
        items.append((name, side, role, im, cmd_key is None))
        print('card', key, name, side, role, h, 'missing' if cmd_key is None else cmd_key)
    with open(os.path.join(OUT_DIR, 'meta.json'), 'w', encoding='utf-8') as fp:
        json.dump(meta, fp, ensure_ascii=False, indent=1)
    card_sheet(items)
    print('->', OUT_DIR)


if __name__ == '__main__':
    main()
