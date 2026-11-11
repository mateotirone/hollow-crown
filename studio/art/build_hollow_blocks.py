"""Hollow texture pass (2026-11-10, asked by the Hollow world thread after Mateo's "go ahead and create it all").
Repaints Veinstone (4 variants), Choir Ore, Latticewood + Core, Veilmoss; adds Hollow Brick (+cracked), Pale Ash,
Glow Crystal cluster. Run: python3 build_hollow_blocks.py   (re-run safe). Sheet: art/hollow-blocks-pass.png
"""
import os, sys, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from palette import REGIONS, fixed
from texlib import *
ROOT = '/mnt/project-files/siege-nights/'
RP = ROOT + 'Siege_Nights_RP/textures/blocks/'
U = REGIONS['undertow']; ST, DK, WD, BLUE, PINK, FOL = U['stone'], U['mortar'], U['wood'], U['accent'], U['glow_pink'], U['foliage']
VIOLET = fixed('#2a1250', '#4a1e88', '#7234c4', '#a05cf0', '#c896ff', '#ecd8ff')
MAGENTA = fixed('#3a0c38', '#6a1660', '#a0248c', '#d040b4', '#f078d4', '#ffc0ee')
ASH = fixed('#5c5468', '#6e6679', '#807889', '#928a9a', '#a59dab', '#bab3be')
CORE = fixed('#7a2a3a', '#b84a50', '#e8785e', '#ff9e7a', '#ffc4a4', '#ffe8d4')
OUT = {}
def save(t, n): t.save(RP + 'siege_' + n + '.png'); OUT[n] = t.im.copy()

def basalt(ramp_, seed, lo=1, hi=2, cols=(3, 2, 4, 3, 2, 2), soft=False):
    t = Tex(); r = random.Random(seed); x = 0
    for w in cols:
        tone = r.randrange(lo, hi + 1); joint = r.randrange(16)
        for dx in range(w):
            for y in range(16):
                v = tone
                if not soft: v += (1 if dx == 0 and w > 1 else 0)
                if dx == w - 1: v -= 1
                if (y - joint) % 9 == 0: v = tone - 1
                t.set(x + dx, y, R(ramp_, v))
        x += w
    return t

# ---- 1. Veinstone: NOTE superseded by build_veinstone.py (2026-11-11); re-running this file overwrites the new art.
# ---- 1. Veinstone: quiet base, veins only on some variants and never corner to corner
def vein(t, path, bright=()):
    for a, b in zip(path, path[1:]):
        for (x, y) in line(a, b): t.set(x % 16, y % 16, R(VIOLET, 2))
    for (x, y) in bright: t.set(x, y, R(VIOLET, 4))
save(basalt(ST, 31, soft=True), 'veinstone')
t = basalt(ST, 31, soft=True); vein(t, [(3, 9), (5, 10), (6, 13), (8, 14)], [(5, 10)]); save(t, 'veinstone_1')
t = basalt(ST, 31, soft=True); vein(t, [(11, 2), (10, 4), (11, 6)], [(10, 4)]); vein(t, [(10, 4), (8, 5)]); save(t, 'veinstone_2')
t = basalt(ST, 31, soft=True); vein(t, [(6, 6), (8, 7), (11, 7), (12, 9)], [(11, 7)]); t.set(4, 12, R(VIOLET, 1)); save(t, 'veinstone_3')

# ---- 2. Choir Ore: calm dark base, big bright crystals
t = basalt(DK, 71, 2, 3, soft=True, cols=(4, 3, 5, 4))
def crystal(t, x, y, h, lean=0):
    """Upright shard: 3 wide, light on the left facet, dark outline at the foot."""
    for i in range(h):
        cx = x + (lean * i) // max(1, h - 1)
        yy = y - i
        if i == h - 1: t.set(cx + 1, yy, R(VIOLET, 5)); continue
        t.set(cx, yy, R(VIOLET, 4)); t.set(cx + 1, yy, R(VIOLET, 3)); t.set(cx + 2, yy, R(VIOLET, 2))
    for dx in (0, 1, 2): t.set(x + dx, y + 1, R(DK, 0))
    t.set(x, y - h + 2, R(VIOLET, 5))
for (x, y, h, l) in ((1, 6, 5, 0), (4, 7, 4, 1), (10, 5, 4, -1), (11, 13, 5, 1), (7, 14, 4, 0), (3, 14, 3, -1)): crystal(t, x, y, h, l)
for (x, y) in ((14, 3), (0, 11), (14, 9)): t.set(x, y, R(VIOLET, 3))
save(t, 'choir_ore')

# ---- 3. Latticewood: organic honeycomb, uneven cells (toroidal Voronoi so it tiles)
SEEDS = [(2.5, 2.0), (9.0, 1.5), (14.0, 5.0), (5.5, 7.0), (10.5, 8.5), (1.5, 11.5), (7.0, 13.0), (13.0, 13.0)]
def cell(x, y):
    d = []
    for i, (sx, sy) in enumerate(SEEDS):
        dx = min(abs(x - sx), 16 - abs(x - sx)); dy = min(abs(y - sy), 16 - abs(y - sy))
        d.append((math.hypot(dx, dy * 1.15), i))
    d.sort(); return d[0][0], d[1][0] - d[0][0], d[0][1]
def hole(x, y):
    d0, gap, i = cell(x % 16 + 0.5, y % 16 + 0.5)
    return gap > 1.7 and d0 < 2.6 + (i % 3) * 0.5
def lattice(fill=None):
    t = Tex()
    for y in range(16):
        for x in range(16):
            if hole(x, y):
                if fill:
                    edge = sum(1 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if not hole(x + dx, y + dy))
                    t.set(x, y, R(fill, 5 if edge == 0 else 4 if edge == 1 else 3))
                continue
            v = 3
            if hole(x, y + 1) or hole(x + 1, y): v = 4
            if hole(x, y - 1) or hole(x - 1, y): v = 1
            if v == 3 and (x * 3 + y * 5) % 7 == 0: v = 2
            t.set(x, y, R(WD, v))
    return t
save(lattice(), 'hollowwood_lattice'); save(lattice(CORE), 'hollowwood_core')

# ---- 4. Veilmoss: soft, larger clumps
MS = [(3, 3), (11, 2), (7, 8), (14, 9), (2, 12), (10, 14)]
t = Tex(); r = random.Random(81)
for y in range(16):
    for x in range(16):
        d = sorted(math.hypot(min(abs(x - sx), 16 - abs(x - sx)), min(abs(y - sy), 16 - abs(y - sy))) for sx, sy in MS)
        v = 2 if d[0] < 1.6 else 1 if d[1] - d[0] > 1.2 else 0
        if v == 1 and r.random() < 0.12: v = 2
        t.set(x, y, R(FOL, v))
for (sx, sy) in MS[::2]: t.set(sx, sy, R(FOL, 3))
t.set(7, 8, R(PINK, 3))
save(t, 'undertow_moss')

# ---- 5. Hollow Brick (+ cracked): dark violet cracked stone bricks, a few magenta root veins
def brick(seed):
    t = Tex(); bricks(t, ST, DK, seed=seed, base=(1, 2, 2)); return t
def roots(t, paths):
    for path in paths:
        for a, b in zip(path, path[1:]):
            for (x, y) in line(a, b): t.set(x % 16, y % 16, R(MAGENTA, 2))
        x, y = path[len(path) // 2]; t.set(x, y, R(MAGENTA, 4))
t = brick(5); roots(t, [[(2, 15), (3, 12), (5, 10), (5, 8)], [(5, 10), (7, 10)]]); save(t, 'veinstone_bricks')
t = brick(5)
for path, hot in (([(12, 0), (12, 3), (10, 5), (10, 8), (8, 10)], (10, 5)), ([(12, 3), (14, 4)], None), ([(3, 9), (4, 12), (3, 15)], (4, 12)), ([(10, 8), (12, 10)], None)):
    for a, b in zip(path, path[1:]):
        for (x, y) in line(a, b): t.set(x, y, R(VIOLET, 3))
    if hot: t.set(hot[0], hot[1], R(VIOLET, 5))
for (x, y) in ((0, 0), (15, 7), (6, 4), (7, 4)): t.set(x, y, R(DK, 0))        # chipped corners
save(t, 'cracked_veinstone_bricks')

# ---- 6. Pale Ash: soft grey-lilac dust with faint drifts
t = Tex(); r = random.Random(90)
for y in range(16):
    for x in range(16):
        drift = math.sin((x + y * 0.5) * math.pi / 8) + math.sin((y - x * 0.25) * math.pi / 4) * 0.5
        v = 3 + (1 if drift > 0.8 else -1 if drift < -0.9 else 0)
        if r.random() < 0.10: v += r.choice((-1, 1))
        t.set(x, y, R(ASH, v))
for _ in range(3): t.set(r.randrange(16), r.randrange(16), R(ASH, 0))
save(t, 'pale_ash')

# ---- 7. Glow Crystal: pale blue cluster, cross-plant, transparent background
G = ["................",
     "................",
     ".......6........",
     "......564.......",
     "......553.......",
     "..6...553....6..",
     ".564..553...564.",
     ".553..5532..553.",
     ".553.65432..553.",
     ".5532554326.553.",
     "..532554325643..",
     "..5325543255432.",
     "..53255432554321",
     ".153255432554321",
     ".1221d221d2221d.",
     "..dddddddddddd.."]
t = Tex()
for y, row in enumerate(G):
    for x, ch in enumerate(row):
        if ch == 'd': t.set(x, y, R(ST, 1))
        elif ch != '.': t.set(x, y, R(BLUE, int(ch) - 1))
save(t, 'glint_cluster')

# ---- sheet: each texture alone and tiled 3x3
names = list(OUT)
S = 6; W = len(names) * (16 * S + 8) + 8
sh = Image.new('RGBA', (W, 16 * S + 8 + 48 * 3 + 16), (38, 34, 46, 255))
for i, n in enumerate(names):
    x = 8 + i * (16 * S + 8)
    sh.alpha_composite(OUT[n].resize((16 * S, 16 * S), Image.NEAREST), (x, 8))
    til = Image.new('RGBA', (48, 48))
    for a in range(3):
        for b in range(3): til.alpha_composite(OUT[n], (a * 16, b * 16))
    sh.alpha_composite(til.resize((96, 96), Image.NEAREST), (x, 16 * S + 16))
os.makedirs(ROOT + 'art', exist_ok=True); sh.save(ROOT + 'art/hollow-blocks-pass.png')
# terrain as the game would mix it: veinstone variants (weights 5,2,2,1), moss, ore
r = random.Random(3); T = Image.new('RGBA', (16 * 24, 16 * 12))
for gy in range(12):
    for gx in range(24):
        k = r.random()
        n = 'undertow_moss' if (gx * 7 + gy * 3) % 11 < 2 else 'choir_ore' if k < 0.03 else r.choices(['veinstone', 'veinstone_1', 'veinstone_2', 'veinstone_3'], (5, 2, 2, 1))[0]
        T.alpha_composite(OUT[n], (gx * 16, gy * 16))
T.resize((16 * 24 * 3, 16 * 12 * 3), Image.NEAREST).save(ROOT + 'art/hollow-blocks-pass-terrain.png')
print('ok', names)
