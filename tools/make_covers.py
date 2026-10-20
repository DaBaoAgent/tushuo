#!/usr/bin/env python3
"""成片封面生成：把 16:9 战场静帧裁成 4:3 / 3:4，压顶部暗渐变，叠两行毛笔标题。

用法（尺寸与文案按发布平台定，标题只放两行）：
  python tools/make_covers.py --src output/<slug>/stills-cover/t188.png \
    --out output/<slug>/封面-4比3.jpg --size 2048x1536 \
    --main 火烧赤壁真相 --sub 曹操八十万是假的 --focus 0.53

  python tools/make_covers.py --src output/<slug>/stills-cover/t166.png \
    --out output/<slug>/封面-3比4.jpg --size 1536x2048 \
    --main 火烧赤壁真相 --sub 曹操八十万是假的 --focus 0.586

规则：主标题 6 字金色行楷，副标题 8 字白色粗黑，两行封顶；文字只用系统字体
（STXINGKA 行楷 + 微软雅黑粗体），不依赖联网生图。--src-out 可另存一张无字裁切底图。
"""
import argparse
import os
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

MAIN_FONT = r'C:\Windows\Fonts\STXINGKA.TTF'
SUB_FONT = r'C:\Windows\Fonts\msyhbd.ttc'


def parse_size(text):
    w, h = text.lower().split('x')
    return int(w), int(h)


def crop_to(src, w, h, fx, fy):
    sw, sh = src.size
    target = w / h
    if sw / sh > target:                       # 太宽，裁左右
        cw, ch = round(sh * target), sh
    else:                                      # 太高，裁上下
        cw, ch = sw, round(sw / target)
    x0 = round((sw - cw) * fx)
    y0 = round((sh - ch) * fy)
    return src.crop((x0, y0, x0 + cw, y0 + ch)).resize((w, h), Image.LANCZOS)


def fit_font(path, index, text, target_w, lo=10, hi=1200):
    while lo < hi:
        mid = (lo + hi + 1) // 2
        font = ImageFont.truetype(path, mid, index=index)
        if font.getlength(text) <= target_w:
            lo = mid
        else:
            hi = mid - 1
    return ImageFont.truetype(path, lo, index=index)


def vertical_gradient(size, stops):
    """在 (w,h) 上生成竖直渐变；stops = [(pos, (r,g,b)), ...]，pos 0..1。"""
    w, h = size
    grad = Image.new('RGB', (1, h))
    px = grad.load()
    for y in range(h):
        p = y / max(1, h - 1)
        for i in range(len(stops) - 1):
            p0, c0 = stops[i]
            p1, c1 = stops[i + 1]
            if p0 <= p <= p1:
                k = (p - p0) / max(1e-6, p1 - p0)
                px[0, y] = tuple(round(a + (b - a) * k) for a, b in zip(c0, c1))
                break
        else:
            px[0, y] = stops[-1][1]
    return grad.resize(size, Image.BILINEAR)


def top_scrim(size, strength, reach):
    """顶部暗渐变（遮罩用 L 图）：顶部不透明度 strength，到 reach 高度降为 0。"""
    w, h = size
    scrim = Image.new('L', (1, h))
    px = scrim.load()
    end = max(1, round(h * reach))
    for y in range(h):
        if y >= end:
            px[0, y] = 0
        else:
            k = 1 - y / end
            px[0, y] = round(255 * strength * (k * k * (3 - 2 * k)))   # smoothstep
    return scrim.resize((w, h), Image.BILINEAR)


def draw_title(canvas, text, font, center, kind):
    """在 canvas 上画一行带黑描边/投影的标题；kind = gold | white。"""
    w, h = canvas.size
    cx, cy = center
    sw = max(2, round(font.size * (0.045 if kind == 'gold' else 0.038)))
    length = font.getlength(text)
    left = cx - length / 2
    asc, desc = font.getmetrics()
    top = cy - (asc + desc) / 2
    bbox = (round(left - sw), round(top - sw), round(left + length + sw), round(top + asc + desc + sw))

    # 投影：单独一层，模糊后偏移压到字下方
    shadow = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).text((left, top), text, font=font, fill=(0, 0, 0, 205),
                                stroke_width=sw, stroke_fill=(0, 0, 0, 205))
    shadow = shadow.filter(ImageFilter.GaussianBlur(max(2, round(font.size * 0.055))))
    canvas.alpha_composite(shadow, (0, round(font.size * 0.035)))

    # 黑色描边层
    outline = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(outline).text((left, top), text, font=font, fill=(0, 0, 0, 255),
                                 stroke_width=sw, stroke_fill=(0, 0, 0, 255))
    canvas.alpha_composite(outline)

    # 字形遮罩（不含描边），用来填金色渐变或白色
    mask = Image.new('L', (w, h), 0)
    ImageDraw.Draw(mask).text((left, top), text, font=font, fill=255)
    bw, bh = bbox[2] - bbox[0], bbox[3] - bbox[1]

    if kind == 'gold':
        grad = vertical_gradient((bw, bh), [
            (0.00, (255, 246, 205)),
            (0.22, (255, 219, 120)),
            (0.52, (232, 166, 55)),
            (0.78, (190, 118, 30)),
            (1.00, (150, 85, 20)),
        ]).convert('RGBA')
        fill = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        fill.paste(grad, (bbox[0], bbox[1]))
        fill.putalpha(mask)
        canvas.alpha_composite(fill)
        # 高光：上半部再叠一层淡白，模拟笔锋反光
        hi = Image.new('L', (w, h), 0)
        ImageDraw.Draw(hi).text((left, top - font.size * 0.015), text, font=font, fill=70)
        glow = Image.new('RGBA', (w, h), (255, 250, 225, 0))
        glow.putalpha(hi)
        canvas.alpha_composite(glow)
    else:
        fill = Image.new('RGBA', (w, h), (255, 255, 255, 255))
        fill.putalpha(mask)
        canvas.alpha_composite(fill)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--size', default='2048x1536')
    ap.add_argument('--main', required=True)
    ap.add_argument('--sub', default='')
    ap.add_argument('--focus', type=float, default=0.5, help='横向裁切重心 0..1')
    ap.add_argument('--focus-y', type=float, default=0.5)
    ap.add_argument('--main-cy', type=float, default=0.185, help='主标题中心 y（占画面高比例）')
    ap.add_argument('--scrim', type=float, default=0.62)
    ap.add_argument('--scrim-reach', type=float, default=0.52)
    ap.add_argument('--enhance', type=float, default=1.0, help='饱和度增益，1=不变')
    ap.add_argument('--src-out', default='', help='另存无字裁切底图的路径（PNG）')
    args = ap.parse_args()

    w, h = parse_size(args.size)
    img = crop_to(Image.open(args.src).convert('RGB'), w, h, args.focus, args.focus_y)
    if abs(args.enhance - 1.0) > 1e-3:
        img = ImageEnhance.Color(img).enhance(args.enhance)
        img = ImageEnhance.Contrast(img).enhance(1.05)
    if args.src_out:
        os.makedirs(os.path.dirname(os.path.abspath(args.src_out)), exist_ok=True)
        img.save(args.src_out)

    ss = 2                                        # 文字层 2 倍超采样
    W, H = w * ss, h * ss
    canvas = img.resize((W, H), Image.LANCZOS).convert('RGBA')

    scrim = top_scrim((W, H), args.scrim, args.scrim_reach)
    shade = Image.new('RGBA', (W, H), (12, 8, 5, 255))
    shade.putalpha(scrim)
    canvas.alpha_composite(shade)

    main_font = fit_font(MAIN_FONT, 0, args.main, W * 0.86)
    main_cy = H * args.main_cy
    draw_title(canvas, args.main, main_font, (W / 2, main_cy), 'gold')

    if args.sub:
        sub_font = fit_font(SUB_FONT, 0, args.sub, W * 0.66)
        sub_cy = main_cy + main_font.size * 0.52 + sub_font.size * 0.58 + H * 0.012
        draw_title(canvas, args.sub, sub_font, (W / 2, sub_cy), 'white')

    canvas = canvas.resize((w, h), Image.LANCZOS).convert('RGB')
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    canvas.save(args.out, quality=92, subsampling=1, optimize=True)
    print(f'{args.out}  {w}x{h}  main={main_font.size / ss:.1f}px sub={sub_font.size / ss if args.sub else 0:.1f}px')


if __name__ == '__main__':
    main()
