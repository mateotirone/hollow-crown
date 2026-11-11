"""Choirsteel gear (mobs thread's pull request #23): nine item icons and two worn armour sheets.
Pale violet forged metal matching the Choirsteel Ingot, with a pale blue (Gloamquill blue) gem or band on each piece.
Armour pieces are re-toned from the Castle Guard art so the shapes match the vanilla armour layout.
Run: python3 build_choirsteel.py   (re-run safe). Sheet: art/choirsteel-gear.png
"""
import os, sys, colorsys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from palette import REGIONS, fixed
from texlib import *
ROOT = '/mnt/project-files/siege-nights/'; T = ROOT + 'Siege_Nights_RP/textures/'
CHOIR = fixed('#120a22', '#22123f', '#3a1f6a', '#552f94', '#7446b8', '#9a72d6')  # darker since 2026-11-11 (Mateo)
BLUE = REGIONS['undertow']['accent']
GRIP = fixed('#0c080f', '#1a1222', '#2a1e36', '#3c2c4c', '#524066', '#6c5a82')

def retone(src, dst, band=False):
    """Luminance to the Choirsteel ramp; gold trim becomes the blue band, leather becomes dark grip."""
    im = Image.open(T + src).convert('RGBA'); px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if not a: continue
            h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
            if s > 0.35 and 0.09 < h < 0.19: rp, k = BLUE, 1.25          # gold
            elif s > 0.2 and h < 0.09: rp, k = (BLUE, 1.2) if band else (GRIP, 1.6)   # leather
            else: rp, k = CHOIR, 1.15
            i = max(0, min(5, int(l * k * 6)))
            px[x, y] = rp[i] + (a,)
    if band == 'top':                                                    # a blue band under the top edge of each piece
        for x in range(im.width):
            ys = [y for y in range(im.height) if px[x, y][3]]
            if len(ys) > 3 and px[x, ys[1]][:3] != CHOIR[0]: px[x, ys[1]] = BLUE[4] + (255,)
    im.save(T + dst); return im

def tool(name, head, gem, handle=range(2, 11), grip_to=None):
    t = Tex(); H = set(head)
    for i in handle:
        x, y = i, 15 - i
        if (x, y) in H: continue
        t.set(x, y, R(GRIP, 4)); t.set(x + 1, y, R(GRIP, 2))
    for (x, y) in H:
        v = 3
        if (x - 1, y) not in H or (x, y - 1) not in H: v = 4
        if (x - 1, y) not in H and (x, y - 1) not in H: v = 5
        if (x + 1, y) not in H or (x, y + 1) not in H: v = min(v, 2) if v == 3 else v - 1
        t.set(x, y, R(CHOIR, v))
    outline_alpha(t, R(CHOIR, 0))
    for (x, y) in gem: t.set(x, y, R(BLUE, 4))
    t.set(gem[0][0], gem[0][1], R(BLUE, 5))
    t.save(T + 'items/siege_choirsteel_' + name + '.png'); return t.im

def rows(spec): return [(x, y) for y, (a, b) in spec.items() for x in range(a, b + 1)]
OUT = []
# sword: broad blade on the diagonal, blue gem in the guard
blade = [(i, 15 - i) for i in range(5, 14)] + [(i - 1, 15 - i) for i in range(6, 14)] + [(i, 16 - i) for i in range(6, 14)] + [(14, 1)]
t = Tex()
for (x, y) in blade:
    d = (x + y) - 15; t.set(x, y, R(CHOIR, 5 if d < 0 else 4 if d == 0 else 2))
t.set(14, 1, R(CHOIR, 5))
for k in range(-2, 3): t.set(4 + k, 11 + k, R(CHOIR, 3 if k else 2))
t.set(2, 13, R(GRIP, 4)); t.set(3, 12, R(GRIP, 3)); t.set(3, 13, R(GRIP, 2)); t.set(1, 14, R(CHOIR, 4)); t.set(2, 14, R(CHOIR, 2))
outline_alpha(t, R(CHOIR, 0)); t.set(4, 11, R(BLUE, 5)); t.set(9, 6, R(BLUE, 3))
t.save(T + 'items/siege_choirsteel_sword.png'); OUT.append(('sword', t.im))
OUT.append(('pickaxe', tool('pickaxe', [(5, 2), (6, 2), (7, 2), (8, 2), (9, 2), (10, 3), (11, 3), (12, 4), (12, 5), (13, 6), (13, 7), (13, 8), (13, 9), (13, 10),
                                        (6, 3), (7, 3), (8, 3), (9, 3), (10, 4), (11, 4), (11, 5), (12, 6), (12, 7), (12, 8), (12, 9)], [(11, 4)], handle=range(2, 12))))
OUT.append(('axe', tool('axe', rows({1: (8, 10), 2: (7, 11), 3: (6, 12), 4: (6, 12), 5: (7, 12), 6: (8, 12), 7: (10, 12), 8: (11, 12)}), [(10, 4)], handle=range(2, 11))))
OUT.append(('shovel', tool('shovel', rows({1: (11, 13), 2: (10, 14), 3: (9, 14), 4: (9, 14), 5: (9, 13), 6: (10, 12)}), [(11, 4)], handle=range(2, 10))))
OUT.append(('hoe', tool('hoe', rows({2: (6, 11), 3: (6, 12), 4: (11, 12)}) + [(6, 4), (7, 4)], [(11, 3)], handle=range(2, 12))))
for p in ('helmet', 'chestplate', 'leggings', 'boots'):
    OUT.append((p, retone(f'items/siege_guard_{p}.png', f'items/siege_choirsteel_{p}.png', band='top' if p in ('leggings', 'boots') else True)))
# ---- worn sheets, vanilla 64x32 armour layout, painted from scratch
def faces(u, v, w, h, d):
    return dict(top=(u + d, v, w, d), bottom=(u + d + w, v, w, d), right=(u, v + d, d, h), front=(u + d, v + d, w, h),
                left=(u + d + w, v + d, d, h), back=(u + 2 * d + w, v + d, w, h))
def plate(px, f, keep=lambda x, y, w, h: True, band=None, tone=3):
    x0, y0, w, h = f
    for y in range(h):
        for x in range(w):
            if not keep(x, y, w, h): continue
            v = tone + (1 if y == 0 or x == 0 else 0) - (1 if x == w - 1 else 0)
            below = y + 1 >= h or not keep(x, y + 1, w, h)
            if below: v = tone - 2
            if (x + y * 3) % 7 == 0 and v == tone: v = tone + 1 if y < h // 2 else tone - 1
            px[x0 + x, y0 + y] = (BLUE[4 if x % 3 else 5] if band is not None and y == band else CHOIR[max(0, min(5, v))]) + (255,)
def gem(px, f, x, y):
    for dx, dy, i in ((0, 0, 5), (1, 0, 4), (0, 1, 4), (1, 1, 3)): px[f[0] + x + dx, f[1] + y + dy] = BLUE[i] + (255,)
L1 = Image.new('RGBA', (64, 32)); p = L1.load()
hd = faces(0, 0, 8, 8, 8)
plate(p, hd['top'], tone=4)
plate(p, hd['front'], lambda x, y, w, h: y < 3 or (x in (0, 7) and y < 6) or (x in (3, 4) and y < 5), band=2); gem(p, hd['front'], 3, 0)
for k in ('right', 'left'): plate(p, hd[k], lambda x, y, w, h: y < 5 or (y < 7 and 2 <= x <= 5), band=2)
plate(p, hd['back'], lambda x, y, w, h: y < 6, band=2)
bd = faces(16, 16, 8, 12, 4)
for k in ('front', 'back'): plate(p, bd[k], lambda x, y, w, h: y < 10 and not (y == 9 and x in (0, 7)), band=0)
for k in ('right', 'left'): plate(p, bd[k], lambda x, y, w, h: 2 <= y < 9)
plate(p, bd['top'], tone=4); gem(p, bd['front'], 3, 3)
fx, fy = bd['front'][0], bd['front'][1]
for y in range(6, 9):
    for x in (2, 5): p[fx + x, fy + y] = CHOIR[2] + (255,)                     # fluting on the cuirass
ar = faces(40, 16, 4, 12, 4)
plate(p, ar['top'], tone=5)
for k in ('front', 'back', 'right', 'left'): plate(p, ar[k], lambda x, y, w, h: y < 4 or (y == 4 and 0 < x < w - 1), band=3)
for k in ('front', 'back', 'right', 'left'):                                    # vambrace and cuff below the pauldron
    f = ar[k]; plate(p, (f[0], f[1] + 5, f[2], 7), tone=2, band=5)
plate(p, ar['bottom'], tone=1)
lg = faces(0, 16, 4, 12, 4)
for k in ('front', 'back', 'right', 'left'):
    f = lg[k]; plate(p, (f[0], f[1] + 7, f[2], 5), band=0)
plate(p, lg['bottom'], tone=1)
L1.save(T + 'models/armor/choirsteel_layer_1.png')
L2 = Image.new('RGBA', (64, 32)); p = L2.load()
bd = faces(16, 16, 8, 12, 4)
for k in ('front', 'back', 'right', 'left'):
    f = bd[k]; plate(p, (f[0], f[1] + 7, f[2], 5), band=1)
gem(p, (bd['front'][0], bd['front'][1] + 7, 8, 5), 3, 0)
lg = faces(0, 16, 4, 12, 4)
for k in ('front', 'back', 'right', 'left'): plate(p, lg[k], lambda x, y, w, h: y < 9)
f = lg['front']
for x in (1, 2): p[f[0] + x, f[1] + 5] = CHOIR[5] + (255,); p[f[0] + x, f[1] + 6] = BLUE[4] + (255,)   # knee plate
L2.save(T + 'models/armor/choirsteel_layer_2.png')
sh = Image.new('RGBA', (9 * 104 + 8, 104 + 8 + 32 * 5 + 16), (38, 34, 46, 255))
for i, (n, im) in enumerate(OUT): sh.alpha_composite(im.resize((96, 96), Image.NEAREST), (8 + i * 104, 8))
for n in (1, 2): sh.alpha_composite(Image.open(T + f'models/armor/choirsteel_layer_{n}.png').convert('RGBA').resize((320, 160), Image.NEAREST), (8 + (n - 1) * 336, 112))
sh.save(ROOT + 'art/choirsteel-gear.png'); print('ok')
