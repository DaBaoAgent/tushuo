# -*- coding: utf-8 -*-
"""统一生成主帅卡源图：按人脸框归一化到 480x480，脸高=0.45 直径、脸心居中。
用法：
  python tools/unify_commander_cards.py --preview   # 出候选总览（不改资产）
  python tools/unify_commander_cards.py --apply     # 写入 assets/commanders/*.jpg
"""
import argparse, json, os, shutil
import cv2, numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(ROOT, '三国人物')
OUT_DIR = os.path.join(ROOT, 'assets', 'commanders')
QA_DIR = os.path.join(ROOT, 'output', '_qa', 'unified-candidates')

SIZE = 480
FACE_H = 200          # 脸高统一 200px（约 0.42 直径），留出冠/盔空间
FACE_CX, FACE_CY = SIZE // 2, 250
# 高冠/高盔人物单独下移，避免头顶被圆切掉
FACE_CY_OVERRIDE = {'handang': 294, 'zhoutai': 280, 'caoren': 274,
                    'fengji': 272, 'jiaxu': 266}

# key -> 源文件名（不含 .png）；None 表示未选用
CHARS = {
    'zhouyu':   '周瑜',
    'sunquan':  '孙权_2',
    'cao':      '曹操',
    'liu':      '刘备',
    'caoren':   '曹仁',
    'chengpu':  '程普',
    'handang':  '韩当',
    'zhoutai':  '周泰',
    'ganning':  '甘宁',
    'taishici': '太史慈',
    'lingtong': '凌统',
    'lvmeng':   '吕蒙',
    'liuxun':   '刘勋',
    'huanggai': '黄盖',
    'yuan':     '袁绍',   # 官渡：袁绍
    'zhanghe':  '张郃',   # 官渡偏将
    'xunyu':    '荀彧',
    'xunyou':   '荀攸',
    'xuhuang':  '徐晃',
    'tianfeng': '田丰',   # 邺城留守
    'shenpei':  '审配',   # 邺城留守
    'fengji':   '逢纪',   # 邺城留守
    'guotu':    '郭图',   # 随袁绍在官渡
    'jiaxu':    '贾诩',   # 官渡随军
    'yanliang': '颜良',   # 白马
    'wenchou':  '文丑',   # 延津
    'guojia':   '郭嘉',   # 官渡随军
    'zhangliao':'张辽',   # 官渡随军
    'yujin':    '于禁',   # 官渡随军
    'lejin':    '乐进',   # 官渡随军
    'xuchu':    '许褚',   # 官渡宿卫
    'caohong':  '曹洪',   # 官渡守营
    'xiahouyuan':'夏侯渊', # 官渡督军
}
# 候选：同一 key 可试多版
CANDIDATES = dict(CHARS)
CANDIDATES['sunquan'] = '孙权_2'
CANDIDATES['sunquan_b'] = '孙权'
CANDIDATES['lingtong'] = '凌统'
CANDIDATES['lingtong_b'] = '凌统_2'

# 目标资产文件名（按场景 assets 映射）
TARGET_FILE = {
    'zhouyu': 'zhouyu-v2.jpg',
    'cao': 'cao-v2.jpg',
}

face_cv = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')


def detect_face(im):
    arr = np.array(im)[:, :, ::-1].copy()
    g = cv2.cvtColor(arr, cv2.COLOR_BGR2GRAY)
    g = cv2.equalizeHist(g)
    h, w = g.shape
    sc = 900 / w if w > 900 else 1
    g2 = cv2.resize(g, (int(w * sc), int(h * sc))) if sc != 1 else g
    faces = face_cv.detectMultiScale(g2, 1.07, 5, minSize=(50, 50))
    if len(faces) == 0:
        raise RuntimeError('人脸检测失败')
    faces = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)
    x, y, fw, fh = [int(v / sc) for v in faces[0]]
    return x, y, fw, fh


def normalize(path, key=None):
    im = Image.open(path).convert('RGB')
    W, H = im.size
    fx, fy, fw, fh = detect_face(im)
    f = FACE_H / fh
    cx, cy = fx + fw / 2, fy + fh / 2
    face_cy = FACE_CY_OVERRIDE.get(key, FACE_CY)
    sw, sh = max(1, round(W * f)), max(1, round(H * f))
    fg = im.resize((sw, sh), Image.LANCZOS)
    ox, oy = round(FACE_CX - cx * f), round(face_cy - cy * f)
    # 前景不足 480 时用边缘像素延伸补满，避免出现模糊色带
    arr = np.array(fg)
    pl, pt = max(0, ox), max(0, oy)
    pr, pb = max(0, SIZE - (ox + sw)), max(0, SIZE - (oy + sh))
    if pl or pt or pr or pb:
        arr = np.pad(arr, ((pt, pb), (pl, pr), (0, 0)), mode='edge')
    fg = Image.fromarray(arr)
    bg = Image.new('RGB', (SIZE, SIZE), (10, 12, 14))
    bg.paste(fg, (ox - pl, oy - pt))
    meta = dict(src=os.path.basename(path), face=[fx, fy, fw, fh], scale=round(f, 4),
                offset=[ox, oy], face_h=FACE_H, face_cy=face_cy, canvas=SIZE)
    return bg, meta


def ring_color(key):
    if key in ('cao', 'caoren'):
        return '#d98067'
    if key in ('liu',):
        return '#c9a94a'
    return '#67d9b3'


def card_sheet(items, out_path, cols=8, radius=96):
    """items: [(label, image), ...] 画成最终圆形卡样式（含标签条）。"""
    pad, head, label_h = 18, 8, 34
    cell = radius * 2 + pad
    rows = (len(items) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * cell + pad, rows * (cell + head + label_h) + pad), (16, 20, 22))
    dr = ImageDraw.Draw(sheet)
    label_font = ImageFont.truetype('C:/Windows/Fonts/msyhbd.ttc', 22)
    for i, (label, im) in enumerate(items):
        c, r = i % cols, i // cols
        x = pad + c * cell + pad // 2
        y = pad + r * (cell + head + label_h) + head
        big = im.resize((radius * 2, radius * 2), Image.LANCZOS)
        mask = Image.new('L', (radius * 2, radius * 2), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, radius * 2 - 1, radius * 2 - 1), fill=255)
        sheet.paste(big, (x, y), mask)
        dr.ellipse((x, y, x + radius * 2 - 1, y + radius * 2 - 1), outline=ring_color(label), width=4)
        dr.rounded_rectangle((x - 10, y + radius * 2 - 2, x + radius * 2 + 10, y + radius * 2 + 25),
                             radius=5, fill=(8, 26, 31))
        tw = dr.textlength(label, font=label_font)
        dr.text((x + radius - tw / 2, y + radius * 2 + 1), label, font=label_font, fill=(247, 237, 218))
    sheet.save(out_path, quality=90)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--preview', action='store_true')
    ap.add_argument('--apply', action='store_true')
    args = ap.parse_args()
    os.makedirs(QA_DIR, exist_ok=True)
    results, metas = {}, {}
    for key, name in CANDIDATES.items():
        path = os.path.join(SRC_DIR, name + '.png')
        im, meta = normalize(path, key)
        results[key] = im
        metas[key] = meta
        im.save(os.path.join(QA_DIR, f'{key}-{name}.jpg'), quality=92)
    items = [(name, results[k]) for k, name in CANDIDATES.items()]
    card_sheet(items, os.path.join(QA_DIR, '00-unified-candidates.jpg'))
    with open(os.path.join(QA_DIR, 'meta.json'), 'w', encoding='utf-8') as fp:
        json.dump(metas, fp, ensure_ascii=False, indent=1)
    print('preview ->', QA_DIR)
    if not args.apply:
        return
    backup = os.path.join(OUT_DIR, '_backup-pre-unified')
    os.makedirs(backup, exist_ok=True)
    fields = {}
    for key, name in CHARS.items():
        target = TARGET_FILE.get(key, key + '.jpg')
        dst = os.path.join(OUT_DIR, target)
        if os.path.exists(dst) and not os.path.exists(os.path.join(backup, target)):
            shutil.copy2(dst, os.path.join(backup, target))
        im = Image.open(os.path.join(QA_DIR, f'{key}-{name}.jpg')).convert('RGB')
        im.save(dst, quality=92)
        fields[key] = [0, 0, SIZE]
        print('write', target)
    crops_path = os.path.join(OUT_DIR, 'crops.json')
    old = {}
    if os.path.exists(crops_path):
        with open(crops_path, encoding='utf-8') as fp:
            old = json.load(fp)
    if not os.path.exists(os.path.join(backup, 'crops.json')):
        with open(os.path.join(backup, 'crops.json'), 'w', encoding='utf-8') as fp:
            json.dump(old, fp, ensure_ascii=False, indent=1)
    with open(crops_path, 'w', encoding='utf-8') as fp:
        json.dump(fields, fp, ensure_ascii=False, indent=1)
    print('crops.json updated (all [0,0,480])')


if __name__ == '__main__':
    main()
