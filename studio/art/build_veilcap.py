"""Giant Veilcap and hanging Veilmoss (Hollow world thread's pull request #53).
python3 build_veilcap.py [repo root]      Sheet: art/veilcap-giant.png
Cap: the small Veilcap's pink with paler spots, softly glowing, tiles across a dome. Stem: pale lilac-white, faint ribs,
tiles upward. Strands: magenta moss hanging from the top edge in uneven lengths, cross plant, stacks downward."""
import os, sys, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from palette import REGIONS, fixed
from texlib import *
ROOT = (sys.argv[1] if len(sys.argv) > 1 else '/mnt/project-files/siege-nights').rstrip('/') + '/'
RP = ROOT + 'Siege_Nights_RP/textures/blocks/'
PINK = REGIONS['undertow']['glow_pink']; FOL = REGIONS['undertow']['foliage']
STEM = fixed('#6a5a84', '#9486ac', '#b8accc', '#d4cae2', '#e8e0f0', '#f8f4fc')
MOSS = fixed('#3a0c38', '#6a1660', '#a0248c', '#d040b4', '#f078d4', '#ffc0ee')
OUT = {}
def save(t, n): t.save(RP + 'siege_' + n + '.png'); OUT[n] = t.im.copy()
def tor(a, b): d = abs(a - b); return min(d, 16 - d)

# cap: soft mottled pink, a few pale round spots with a bright heart; no hard edges so a dome reads as one skin
SPOTS = [(4.0, 4.0, 2.3), (12.0, 11.0, 1.6)]
t = Tex(); r = random.Random(7)
for y in range(16):
    for x in range(16):
        k = math.sin((x + y * 0.6) * math.pi / 8) + math.sin((y - x * 0.4) * math.pi / 8)
        v = 3 if k > -0.9 else 2
        if r.random() < 0.04: v = 2
        for sx, sy, rad in SPOTS:
            d = math.hypot(tor(x + 0.5, sx), tor(y + 0.5, sy))
            if d < rad * 0.45: v = 5
            elif d < rad: v = 4
        t.set(x, y, R(PINK, v))
save(t, 'veilcap_cap')

# stem: pale, faint vertical ribs of uneven width, a few short fibres; tiles upward and around
t = Tex(); r = random.Random(11); x = 0
for w in (3, 2, 4, 3, 2, 2):
    for dx in range(w):
        for y in range(16):
            v = 4 if dx == 0 else 3
            if dx == w - 1: v = 2
            if v == 3 and r.random() < 0.08: v = 4
            t.set(x + dx, y, R(STEM, v))
    x += w
for (fx, fy, n) in ((1, 3, 3), (6, 10, 4), (10, 1, 3), (13, 8, 3)):
    for k in range(n): t.set(fx, (fy + k) % 16, R(STEM, 5))
t.set(5, 6, R(PINK, 3)); t.set(12, 13, R(PINK, 3))                    # a blush of the cap's colour
save(t, 'veilcap_stem')

# strands: every strand starts at the top edge; a few run the full height so a tile below continues them
t = Tex(); r = random.Random(23)
for (x, L) in ((1, 9), (3, 16), (4, 6), (6, 12), (8, 16), (9, 5), (11, 13), (12, 16), (14, 8)):
    for y in range(L):
        v = 3 if y % 5 else 4
        if y == L - 1 and L < 16: v = 5                                # a lit drop at the tip
        elif y >= L - 3 and L < 16: v = 4
        t.set(x, y, R(MOSS, v))
        if y % 4 == 2 and L - y > 2 and r.random() < 0.6: t.set(x + r.choice((-1, 1)), y, R(MOSS, 2))   # side tufts
save(t, 'veilmoss_strands')

S = 6; sh = Image.new('RGBA', (3 * (16 * S + 8) + 8 + 200, 16 * S + 16 + 16 * 3 * 3 + 8), (38, 34, 46, 255))
for i, n in enumerate(OUT):
    x = 8 + i * (16 * S + 8); sh.alpha_composite(OUT[n].resize((96, 96), Image.NEAREST), (x, 8))
    til = Image.new('RGBA', (48, 48))
    for a in range(3):
        for b in range(3): til.alpha_composite(OUT[n], (a * 16, b * 16))
    sh.alpha_composite(til.resize((144, 144), Image.NEAREST), (x - 24 if i else x, 112) if False else (x, 112))
# a little mushroom tree, side on: 7-wide cap, 5 stem blocks, strands under the rim
tree = Image.new('RGBA', (16 * 7, 16 * 8))
for cx in range(7):
    for cy in range(2):
        if cy == 0 and cx in (0, 6): continue
        tree.alpha_composite(OUT['veilcap_cap'], (cx * 16, cy * 16))
for cy in range(2, 8): tree.alpha_composite(OUT['veilcap_stem'], (48, cy * 16))
for cx, n in ((0, 2), (1, 1), (5, 1), (6, 3)):
    for k in range(n): tree.alpha_composite(OUT['veilmoss_strands'], (cx * 16, (2 + k) * 16))
sh.alpha_composite(tree.resize((tree.width * 2, tree.height * 2), Image.NEAREST), (3 * (16 * S + 8) + 8, 8))
sh.save(ROOT + 'art/veilcap-giant.png'); print('ok')
