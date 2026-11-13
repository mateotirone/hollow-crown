"""Final-style textures for Hollow Crown assets other threads have added (Undertow blocks and items, Plot Stone).
Run: python3 build_hollowcrown.py     (re-run safe; alpha levels come from art/placeholder-backup-undertow/)
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from palette import M, REGIONS, fixed, ramp
from texlib import *
RP = '/mnt/project-files/siege-nights/Siege_Nights_RP/textures/'
BK = '/mnt/project-files/siege-nights/art/placeholder-backup-undertow/'
U = REGIONS['undertow']; ST, DK, WD, BLUE, PINK, FOL = U['stone'], U['mortar'], U['wood'], U['accent'], U['glow_pink'], U['foliage']
VIOLET = fixed('#2a1250', '#4a1e88', '#7234c4', '#a05cf0', '#c896ff', '#ecd8ff')
TEAL = fixed('#061c20', '#0c2e34', '#14444a', '#1e5c62', '#2e7a7e', '#4a9a9a')
def blk(t, n): t.save(RP + 'blocks/siege_' + n + '.png')
def old_alpha(n): return Image.open(BK + f'siege_{n}.png').convert('RGBA').load()

def basalt(ramp_, seed, lo=1, hi=3, cols=(3, 2, 4, 3, 2, 2)):
    """Columnar basalt: vertical columns of slightly different tone, with broken horizontal joints."""
    t = Tex(); r = random.Random(seed); x = 0
    for w in cols:
        tone = r.randrange(lo, hi + 1); joint = r.randrange(16)
        for dx in range(w):
            for y in range(16):
                v = tone + (1 if dx == 0 and w > 1 else 0) - (1 if dx == w - 1 else 0)
                if (y - joint) % 9 == 0: v = tone - 1
                if (y - joint) % 9 == 1 and dx < w - 1: v = tone + 1
                t.set(x + dx, y, R(ramp_, v))
        x += w
    return t

# Veinstone: basalt with thin glowing veins
t = basalt(ST, 31, 1, 2)
for path in ([(0, 4), (3, 5), (5, 8), (9, 9), (12, 12), (15, 12)], [(5, 8), (6, 12), (8, 15)], [(8, 0), (9, 2), (12, 3)]):
    for a, b in zip(path, path[1:]):
        for (x, y) in line(a, b): t.set(x, y, R(VIOLET, 3)); 
for (x, y) in [(5, 8), (12, 12), (9, 2)]: t.set(x, y, R(VIOLET, 5))
t.set(15, 4, R(VIOLET, 2)); t.set(8, 15, R(VIOLET, 3)); t.set(8, 0, R(VIOLET, 3))
blk(t, 'veinstone')

# Undertow Moss: a web of pale strands over dark purple growth
t = Tex(); r = random.Random(32)
for y in range(16):
    for x in range(16): t.set(x, y, R(FOL, r.choice((0, 1, 1, 2))))
for y in range(16):
    for x in range(16):
        a = (x + y) % 8; b = (x - y) % 8
        if a == 0 or b == 0: t.set(x, y, R(FOL, 4 if (a == 0 and b == 0) else 3))
        elif a == 1 or b == 7: t.set(x, y, R(FOL, 1)) if r.random() < 0.6 else None
for _ in range(5): t.set(r.randrange(16), r.randrange(16), R(PINK, 4))
blk(t, 'undertow_moss')

blk(basalt(DK, 33, 1, 2, (4, 3, 5, 4)), 'veil_rock')

# Hollowwood: honeycomb lattice. Holes come from the placeholder mask so the block JSON keeps working.
om = old_alpha('hollowwood_lattice')
def lattice(fill=None):
    t = Tex()
    hole = lambda x, y: om[x % 16, y % 16][3] == 0
    for y in range(16):
        for x in range(16):
            if hole(x, y):
                if fill:
                    edge = sum(1 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if not hole(x + dx, y + dy))
                    t.set(x, y, R(fill, 5 if edge == 0 else 4 if edge == 1 else 3))
                continue
            v = 3
            if hole(x, y + 1) or hole(x + 1, y): v = 4            # rim catching light above/left of a hole
            if hole(x, y - 1) or hole(x - 1, y): v = 1            # rim in shadow below/right of a hole
            if hole(x + 1, y + 1) and v == 3: v = 4
            if (x * 3 + y * 5) % 11 == 0 and v == 3: v = 2        # grain flecks
            t.set(x, y, R(WD, v))
    return t
blk(lattice(), 'hollowwood_lattice')
blk(lattice(fixed('#7a2a3a', '#b84a50', '#e8785e', '#ff9e7a', '#ffc4a4', '#ffe8d4')), 'hollowwood_core')

# plants (cross models, transparent background)
def from_grid(rows, legend):
    t = Tex()
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in legend: t.set(x, y, legend[ch])
    return t
PL = {'o': R(PINK, 0), 'a': R(PINK, 5), 'b': R(PINK, 4), 'c': R(PINK, 3), 'd': R(PINK, 2), 'e': R(PINK, 1), 's': R(BLUE, 5), 'S': R(BLUE, 3), 'g': R(FOL, 2)}
blk(from_grid(["................",
               "................",
               ".....obbbbo.....",
               "...obbaaaabbo...",
               "..obaaabbbbbco..",
               ".obaabbbbbcccdo.",
               ".obbbbccccccddo.",
               ".oedcdcdcdcdceo.",
               "..oo.oesSeo.oo..",
               "......osSo......",
               "......osSo......",
               "......osSo......",
               "......osSo......",
               ".....oosSo......",
               "...g.osSSog.g...",
               "..gggosSSoggg..."], PL), 'veilcap')
GL = {'o': R(BLUE, 0), 'a': R(BLUE, 5), 'b': R(BLUE, 4), 'c': R(BLUE, 2), 't': R(BLUE, 1), 'T': R(ST, 4), 'g': R(FOL, 2)}
blk(from_grid(["................",
               ".........oo.....",
               "........oabo....",
               "........obco....",
               ".........to.....",
               "..oo.....T......",
               ".oabo....T..oo..",
               ".obco....T.oabo.",
               "..to.....T.obco.",
               "..T......T..to..",
               "..T......T..T...",
               "..T......T..T...",
               "..T......T..T...",
               "..T..g...T..T...",
               ".gTg.g..gT.gTg..",
               ".gTggg.ggTggTg.."], GL), 'glimbulb')

# Glimmerflow: ribbons of pale light (alpha kept from the placeholder so "blend" still works)
om = old_alpha('glimmerflow'); t = Tex()
for y in range(16):
    for x in range(16):
        import math
        w = math.sin((x + 3 * math.sin(y * math.pi / 8)) * math.pi / 4) + 0.6 * math.sin((x * 2 + y) * math.pi / 8)
        k = 5 if w > 0.6 else 4 if w > -0.4 else 3
        t.set(x, y, R(BLUE, k), om[x, y][3])
blk(t, 'glimmerflow')

# Strange Seam: ordinary dark cave rock with a hairline violet crack
t = Tex(); bricks(t, M['blacksteel'], M['coal'], rows=((0, 9), (5, 13), (2, 10), (7, 15)), seed=34)
for path in ([(8, 0), (7, 3), (8, 6), (7, 9), (9, 12), (8, 15)],):
    for a, b in zip(path, path[1:]):
        for (x, y) in line(a, b): t.set(x, y, R(VIOLET, 3)); t.set(x - 1, y, R(M['coal'], 0))
for (x, y) in [(7, 3), (9, 12)]: t.set(x, y, R(VIOLET, 5))
blk(t, 'rift_seam')

# Rift Edge: torn rock with light pouring through the tears
t = basalt(ST, 35, 1, 2)
for path in ([(0, 2), (3, 4), (4, 7), (7, 8), (9, 12), (12, 13), (15, 15)], [(6, 0), (8, 2), (11, 3), (13, 6), (15, 7)], [(0, 10), (2, 12), (3, 15)]):
    for a, b in zip(path, path[1:]):
        for (x, y) in line(a, b):
            t.set(x, y, R(VIOLET, 5)); t.set(x, y + 1, R(VIOLET, 3)) if y < 15 else None; t.set(x, y - 1, R(VIOLET, 2)) if y > 0 else None
blk(t, 'rift_edge')

om = old_alpha('rift_veil'); t = Tex()
for y in range(16):
    for x in range(16):
        w = math.sin((x - 7.5) * (y - 7.5) / 9.0) + math.sin((x + y) * math.pi / 8)
        c = R(BLUE, 5) if w > 1.5 else R(VIOLET, 5) if w > 0.9 else R(VIOLET, 4) if w > 0.2 else R(VIOLET, 3) if w > -0.6 else R(VIOLET, 2)
        t.set(x, y, c, om[x, y][3])
blk(t, 'rift_veil')

# Waystone: dressed Undertow stone with a glowing rune
t = Tex(); bricks(t, ST, DK, rows=((0,), (8,), (0,), (8,)), seed=36, tidy=True, base=(2, 2))
frame(t, ST, 0, 1)
RUNE = ["..XX..", ".X..X.", ".X..X.", "..XX..", "..X...", ".XXXX.", "..X...", "..X..."]
for j, row in enumerate(RUNE):
    for i, ch in enumerate(row):
        if ch == 'X':
            t.set(5 + i, 4 + j, R(BLUE, 4)); 
for j, row in enumerate(RUNE):       # soft glow around the rune
    for i, ch in enumerate(row):
        if ch != 'X' and any(0 <= j + dy < 8 and 0 <= i + dx < 6 and RUNE[j + dy][i + dx] == 'X' for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            t.set(5 + i, 4 + j, R(BLUE, 0))
t.set(7, 4, R(BLUE, 5)); t.set(8, 9, R(BLUE, 5))
blk(t, 'waystone')

# Court Seal: four dark teal slabs locked by a round seal
t = Tex()
for y in range(16):
    for x in range(16):
        qx, qy = x % 8, y % 8
        v = 2 + (1 if qx == 0 or qy == 0 else 0) - (1 if qx == 7 or qy == 7 else 0)
        if (x * 5 + y * 3) % 13 == 0 and v == 2: v = 1
        t.set(x, y, R(TEAL, v))
for y in range(16):
    for x in range(16):
        d = ((x - 7.5) ** 2 + (y - 7.5) ** 2) ** 0.5
        if 3.2 <= d < 4.4: t.set(x, y, R(TEAL, 5 if (x + y) < 15 else 4))
        elif d < 3.2: t.set(x, y, R(TEAL, 0 if d > 1.2 else 4))
t.set(7, 7, R(BLUE, 4)); t.set(8, 8, R(BLUE, 3))
blk(t, 'court_seal')

# ---------------- Plot Stone (Plots thread) ----------------
V = REGIONS['vale']; G = M['gold']
def slab(seed):
    t = Tex(); bricks(t, V['stone'], V['mortar'], rows=((0,), (0,), (0,), (0,)), rh=4, seed=seed, tidy=True, base=(2, 3))
    for y in range(16):
        for x in range(16): t.set(x, y, R(V['stone'], 2 if (x * 7 + y * 5) % 9 else 3))
    frame(t, V['stone'], 0, 1); return t
t = slab(41)   # top: a surveyor's compass star with a red marker pin
for i in range(3, 13): t.set(i, 7, R(G, 3)); t.set(7, i, R(G, 3)); t.set(i, 8, R(G, 1)); t.set(8, i, R(G, 1))
for d in range(1, 4):
    for sx, sy in ((1, 1), (-1, 1), (1, -1), (-1, -1)): t.set(7 + (d if sx > 0 else -d + 1) + (0 if sx > 0 else 0), 7 + (d if sy > 0 else -d + 1), R(G, 2))
t.rect(7, 7, 8, 8, R(G, 5)); t.set(7, 2, R(M['blood_red'], 4)); t.set(8, 2, R(M['blood_red'], 2)); t.set(7, 3, R(G, 5))
blk(t, 'plot_stone_top')
t = slab(42)   # side: a gold claim band with surveyor's marks
for x in range(1, 15): t.set(x, 5, R(G, 4)); t.set(x, 10, R(G, 1))
for y in range(6, 10):
    for x in range(1, 15): t.set(x, y, R(V['stone'], 1))
MARKS = ["X.X.XX.X.X.X", "XX..X..XX.XX", "X.X.XX.X..X.", "X...X..X..X."]
for j, row in enumerate(MARKS):
    for i, ch in enumerate(row):
        if ch == 'X': t.set(2 + i, 6 + j, R(G, 4 if j < 2 else 3))
blk(t, 'plot_stone_side')
blk(slab(43), 'plot_stone_bottom')

# ---------------- items ----------------
S = M['steel']
t = Tex()
for i in range(1, 8): t.set(i, 15 - i, R(M['dark_oak'], 3)); t.set(i + 1, 15 - i, R(M['dark_oak'], 1))      # handle
for i in range(8, 10): t.set(i, 15 - i, R(S, 3))
for i in range(0, 5):                                                                                     # two tines
    t.set(9 + i, 4 - i + 0, R(S, 5)) if 4 - i >= 0 else None
    t.set(11 + i, 6 - i, R(S, 3)) if 11 + i < 16 else None
t.set(9, 5, R(S, 4)); t.set(10, 6, R(S, 4)); t.set(10, 5, R(S, 2))
for (x, y) in [(15, 0), (12, 0), (15, 3)]: t.set(x, y, R(BLUE, 4))                                         # ringing shimmer
outline_alpha(t, R(S, 0)); t.set(15, 0, R(BLUE, 4)); t.set(12, 0, R(BLUE, 4)); t.set(15, 3, R(BLUE, 4))
# t.save(RP + 'items/siege_tuning_fork.png')  # the Tuning Fork is now painted by build_tuning_fork.py (made of the five shards)
CL = {'o': R(VIOLET, 0), 'a': R(VIOLET, 5), 'b': R(VIOLET, 4), 'c': R(VIOLET, 3), 'd': R(VIOLET, 2), 'e': R(VIOLET, 1)}
from_grid(["................",
           ".........oo.....",
           "........oabo....",
           ".......oabco....",
           ".......oabcdo...",
           "......oabccdo...",
           "......oabcddo...",
           ".....oabccdeo...",
           ".....oabcddeo...",
           "....oabccdeo....",
           "....oabcddeo....",
           "....obccdeo.....",
           "....obcdeo......",
           ".....ocdeo......",
           ".....odeo.......",
           "......oo........"], CL).save(RP + 'items/siege_choir_shard.png')
print('hollow crown done')

# ---- Choir Ore: veinstone with humming violet crystals
def _choir_ore():
    from PIL import Image
    im = Image.open(RP + 'blocks/siege_veinstone.png').convert('RGBA'); px = im.load()
    V = ['#2a1250', '#4a1e88', '#7234c4', '#a05cf0', '#c896ff', '#ecd8ff']
    h = lambda s: tuple(int(s[i:i + 2], 16) for i in (1, 3, 5)) + (255,)
    for cx, cy in ((3, 3), (10, 2), (6, 8), (12, 9), (3, 12), (9, 13)):
        for dx, dy, i in ((0, 0, 4), (1, 0, 3), (0, 1, 3), (1, 1, 2), (-1, 1, 1), (0, 2, 1), (1, -1, 5), (2, 1, 0), (1, 2, 0)):
            x, y = cx + dx, cy + dy
            if 0 <= x < 16 and 0 <= y < 16: px[x, y] = h(V[i])
    im.save(RP + 'blocks/siege_choir_ore.png')
_choir_ore()

# The 2026-11-10 Hollow pass repaints Veinstone, Choir Ore, Latticewood and Veilmoss: keep it last.
import build_hollow_blocks  # noqa
