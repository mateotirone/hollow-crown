"""Final-style block textures for Siege Nights (Vale palette is the default look).

Run:  python3 build_blocks.py            -> writes Siege_Nights_RP/textures/blocks/*.png
Every wall-type block goes through texlib.damage_set, the shared damage model (stages 0/1/2).
Regional Castle Stone sets go to textures/blocks/regional/ for when regional builds are wired up.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from palette import M, REGIONS, dye_ramp, ramp, fixed
from texlib import *

RP = '/mnt/project-files/siege-nights/Siege_Nights_RP/'
TB = RP + 'textures/blocks/'
OLD = {}   # alpha masks we keep from the previous textures
for n in ['siege_castle_gate_open', 'siege_portcullis_open', 'siege_banner_red']:
    OLD[n] = Image.open(TB + n + '.png').convert('RGBA')

V = REGIONS['vale']
IRON, STEEL, BS, GOLD, DIA, NETH = M['iron'], M['steel'], M['blacksteel'], M['gold'], M['diamond'], M['netherite']
SLATE = ramp('#4e5466', 0.08, 0.62, cool=0.06, warm=0.04)
PLASTER = fixed('#8a806c', '#b0a68e', '#cfc6ae', '#e2dac4', '#efe9d8', '#f8f4ea')

def save(t, name, sub=''):
    im = t.im if isinstance(t, Tex) else t
    os.makedirs(TB + sub, exist_ok=True); im.save(TB + sub + name + '.png')

# ---------------- castle stone and reinforcement tiers ----------------
def castle_stone(rg, seed=3):
    t = Tex(seed=seed); bricks(t, rg['stone'], rg['mortar'], seed=seed, base=rg.get('base', (2, 3))); return t

def tier_iron(t):
    band(t, IRON, 2, rivets=(2, 7, 12)); band(t, IRON, 11, rivets=(4, 9, 14)); return t

def tier_diamond(t):
    # the same banded wall as the iron tier, in brighter steel with diamond studs: one family, clearly a step up
    band(t, STEEL, 2, rivets=()); band(t, STEEL, 11, rivets=())
    for y, xs in ((2, (2, 7, 12)), (11, (4, 9, 14))):
        for x in xs:
            t.set(x, y, R(DIA, 5)); t.set(x + 1, y, R(DIA, 3)); t.set(x, y + 1, R(DIA, 3)); t.set(x + 1, y + 1, R(DIA, 1))
    return t

def tier_netherite(t):
    for y in range(16):
        row = y // 4; off = 4 if row % 2 else 0
        for x in range(16):
            u = (x + off) % 8; v = y % 4
            if v == 3 or u == 7: t.set(x, y, R(NETH, 0)); continue
            k = 4 if (v == 0 or u == 0) else 1 if (v == 2 or u == 6) else 2
            if (x * 7 + y * 3) % 11 == 0 and k == 2: k = 3
            t.set(x, y, R(NETH, k))
    for x, y in [(3, 1), (11, 1), (7, 5), (15, 5), (3, 9), (11, 9), (7, 13), (15, 13)]:   # gold studs, one per brick; no loud bands
        t.set(x, y, R(GOLD, 4)); t.set(x, y + 1, R(GOLD, 1))
    return t

TIERS = {'stone': lambda t: t, 'iron': tier_iron, 'diamond': tier_diamond, 'netherite': tier_netherite}

def wall_set(rg, prefix, sub=''):
    base = castle_stone(rg)
    save(base, prefix, sub)
    crack = R(rg['stone'], 0)
    for tn, fn in TIERS.items():
        for c, im in enumerate(damage_set(fn(base.copy()).im, crack)): save(im, f'{prefix}_{tn}_{c}', sub)
    return base

base = wall_set(V, 'siege_castle_stone')
for rk, rg in REGIONS.items():
    if rk != 'vale': wall_set(rg, f'siege_castle_stone_{rk}', 'regional/')

# Mossy: moss creeps down from the top and settles in the mortar lines
def mossy(base, rg, seed=5):
    t = base.copy(); r = random.Random(seed); F = rg['foliage']
    for x in range(16):
        d = r.choice((1, 2, 2, 3, 4))
        for y in range(d): t.set(x, y, R(F, 3 if y == 0 else 2 if y < d - 1 else 1))
    for y in range(16):
        for x in range(16):
            p = t.get(x, y)
            if p[:3] in (R(rg['mortar'], 1), R(rg['mortar'], 2)) and r.random() < 0.45: t.set(x, y, R(F, r.choice((1, 2))))
    for _ in range(3):   # a hanging tendril
        x = r.randrange(16)
        for y in range(r.randrange(3, 6)): t.set(x, y, R(F, 2 if y % 2 else 3))
    return t
save(mossy(base, V), 'siege_mossy_castle_stone')
for rk, rg in REGIONS.items():
    if rk != 'vale': save(mossy(castle_stone(rg), rg), f'siege_mossy_castle_stone_{rk}', 'regional/')

# Cracked (decorative block, not a damage stage): its own fracture pattern and a missing brick corner
def cracked(base, rg):
    t = Tex.from_image(damage(base.im, 1, R(rg['stone'], 0)))
    for p in line((15, 2), (11, 5)) + line((11, 5), (9, 11)) + line((9, 11), (12, 15)):
        t.set(*p, R(rg['stone'], 0))
    for (x, y) in [(1, 9), (2, 9), (1, 10), (2, 10), (3, 10)]: t.set(x, y, R(rg['mortar'], 0))
    return t
save(cracked(base, V), 'siege_cracked_castle_stone')
for rk, rg in REGIONS.items():
    if rk != 'vale': save(cracked(castle_stone(rg), rg), f'siege_cracked_castle_stone_{rk}', 'regional/')

# ---------------- gates ----------------
def gate_wood(seed=4):
    t = Tex(seed=seed); planks(t, M['dark_oak'], True, (4, 4, 4, 4), seed=seed); return t

GATE_METAL = {'': (BS, BS), 'iron': (IRON, IRON), 'diamond': (IRON, DIA), 'netherite': (NETH, GOLD)}
def castle_gate(tier):
    t = gate_wood(); metal, stud = GATE_METAL[tier]
    for y in (2, 12):
        for x in range(16):
            t.set(x, y - 1, R(metal, 0)); t.set(x, y, R(metal, 3)); t.set(x, y + 1, R(metal, 2)); t.set(x, y + 2, R(metal, 0))
        for x in (1, 5, 9, 13): t.set(x, y, R(stud, 5)); t.set(x, y + 1, R(stud, 3))
    # ring pull
    for (x, y) in [(7, 7), (8, 7), (6, 8), (9, 8), (7, 9), (8, 9)]: t.set(x, y, R(metal, 3))
    t.set(7, 8, R(metal, 1)); t.set(8, 8, R(metal, 1))
    if tier == 'diamond':
        for x in range(16): t.set(x, 0, R(DIA, 3)); t.set(x, 15, R(DIA, 1))
    if tier == 'netherite':
        for y in range(16):
            for x in range(16):
                p = t.get(x, y)
                if p[:3] in M['dark_oak']: t.set(x, y, brighten(p, 0.7))
    return t
for tier in GATE_METAL:
    save(castle_gate(tier), 'siege_castle_gate' + ('_' + tier if tier else ''))

def from_mask(mask_im, paint):
    t = Tex(); mp = mask_im.load()
    for y in range(16):
        for x in range(16):
            if mp[x, y][3]: paint(t, x, y, mp[x, y])
    return t
def open_gate(t, x, y, p):
    grey = abs(p[0] - p[1]) < 20 and abs(p[1] - p[2]) < 20 and p[0] > 50
    t.set(x, y, R(BS, 3) if grey else R(M['dark_oak'], 3 if x in (0, 14) else 1))
save(from_mask(OLD['siege_castle_gate_open'], open_gate), 'siege_castle_gate_open')

PORT_METAL = {'': BS, 'iron': IRON, 'diamond': fixed('#1e4048', '#3e6a74', '#6c9aa4', '#96c4cc', '#c4e8ec', '#eafcfc'), 'netherite': NETH}
PORT_STUD = {'': BS, 'iron': IRON, 'diamond': DIA, 'netherite': GOLD}
def portcullis(tier):
    t = Tex(); m = PORT_METAL[tier]; s = PORT_STUD[tier]
    cols = [1, 5, 9, 13]; rows = [2, 9]
    for x0 in cols:
        for y in range(16):
            if y >= 14 and y - 13 > 1: continue
            t.set(x0, y, R(m, 4 if y < 14 else 3)); t.set(x0 + 1, y, R(m, 2 if y < 14 else 1))
        t.set(x0, 15, R(m, 3)); t.set(x0 + 1, 15, T if False else R(m, 1))
        t.set(x0, 15, R(m, 2)); t.im.putpixel((x0 + 1, 15), (0, 0, 0, 0))   # spike tip
    for y0 in rows:
        for x in range(16): t.set(x, y0, R(m, 4)); t.set(x, y0 + 1, R(m, 1))
        for x0 in cols: t.set(x0, y0, R(s, 5)); t.set(x0 + 1, y0 + 1, R(s, 2))
    return t
for tier in PORT_METAL:
    save(portcullis(tier), 'siege_portcullis' + ('_' + tier if tier else ''))
save(from_mask(OLD['siege_portcullis_open'], lambda t, x, y, p: t.set(x, y, R(BS, 4 if y == 0 else 2 if y == 1 else 1))), 'siege_portcullis_open')

# ---------------- roof, timber ----------------
def shingles(sl, seed=7):
    t = Tex(); r = random.Random(seed)
    for row in range(4):
        y0 = row * 4; off = 2 if row % 2 else 0
        for k in range(4):
            x0 = (k * 4 + off) % 16; tone = r.choice((2, 3, 3))
            for dy in range(4):
                for dx in range(4):
                    x = (x0 + dx) % 16; y = y0 + dy
                    v = tone + (1 if dy == 0 else 0) - (1 if dx == 3 else 0) - (1 if dy == 3 else 0)
                    if dy == 3 and dx in (0, 3): v = 0           # rounded bottom corners show the row below
                    t.set(x, y, R(sl, v))
            t.set((x0 + 1) % 16, y0 + 3, R(sl, 1))
    return t
save(shingles(SLATE), 'siege_roof_shingles')

def timber(cross):
    t = Tex(seed=9); r = random.Random(9); W = M['dark_oak']
    for y in range(16):
        for x in range(16): t.set(x, y, R(PLASTER, r.choice((2, 3, 3, 3, 4))))
    frame(t, W, 0, 2)
    if cross:
        for i in range(2, 14):
            for d in (0, 1):
                t.set(i, i + d - 0 if i + d < 14 else 13, R(W, 2 if d else 3)); t.set(15 - i, i + d if i + d < 14 else 13, R(W, 2 if d else 3))
    else:
        for y in range(2, 14): t.set(7, y, R(W, 3)); t.set(8, y, R(W, 1))
    return t
save(timber(False), 'siege_timber_frame'); save(timber(True), 'siege_timber_frame_cross')

# ---------------- brazier ----------------
def hammered(m, seed=2):
    t = Tex(); r = random.Random(seed)
    for y in range(16):
        for x in range(16): t.set(x, y, R(m, 2))
    for k in range(10):   # hammer dents: lit top-left, dark bottom-right
        x, y = r.randrange(16), r.randrange(16)
        t.set(x, y, R(m, 3)); t.set(x + 1, y + 1, R(m, 1))
    for x in range(16): t.set(x, 0, R(m, 4)); t.set(x, 15, R(m, 0))
    for x in (3, 12):
        for y in range(1, 15): t.set(x, y, R(m, 1))
        t.set(x, 4, R(m, 4)); t.set(x, 11, R(m, 4))
    return t
save(hammered(BS), 'siege_brazier_iron')

def coals(seed=6):
    t = Tex(); r = random.Random(seed); C, E = M['coal'], M['ember']
    for y in range(16):
        for x in range(16): t.set(x, y, R(C, 2))
    for _ in range(30):   # lumps
        x, y = r.randrange(16), r.randrange(16); k = r.choice((3, 4, 4, 5))
        for (dx, dy, d) in ((0, 0, 0), (1, 0, -1), (0, 1, -1), (1, 1, -2)): t.set((x + dx) % 16, (y + dy) % 16, R(C, k + d))
    for _ in range(9):   # glowing seams between lumps
        x, y = r.randrange(16), r.randrange(16)
        for i in range(r.randrange(2, 5)): t.set((x + i) % 16, (y + (i // 2)) % 16, R(E, 3 + (i == 1)))
    for _ in range(4): t.set(r.randrange(16), r.randrange(16), R(E, 5))
    return t
save(coals(), 'siege_brazier_coals')

def fire():
    t = Tex(); F = M['flame']
    hts = [3, 5, 7, 6, 9, 12, 10, 8, 11, 14, 11, 8, 9, 7, 5, 4]
    for x, h in enumerate(hts):
        for i in range(h):
            y = 15 - i; f = i / max(1, h - 1)
            k = 5 if (f < 0.35 and 4 < x < 12) else 4 if f < 0.5 else 3 if f < 0.75 else 2
            if i == h - 1: k = 2 if h > 8 else 1
            t.set(x, y, R(F, k))
    for x, y in [(5, 2), (9, 0), (12, 4)]: t.set(x, y, R(F, 3))   # loose sparks
    return t
save(fire(), 'siege_brazier_fire')

# ---------------- keep banner ----------------
def pole():
    t = Tex(seed=10); planks(t, M['dark_oak'], True, (4, 4, 4, 4), seed=10, nails=False); return t
save(pole(), 'siege_banner_pole')

BMASK = OLD['siege_banner_red'].load()
TOWER = ["X.XX.X", "XXXXXX", ".XXXX.", ".XXXX.", ".XDDX.", ".XDDX.", "XXXXXX"]
def banner(color):
    D = dye_ramp(color); t = Tex()
    for y in range(16):
        for x in range(16):
            if BMASK[x, y][3]:
                v = 3 - (1 if x in (2, 13) else 0) - (1 if y >= 11 else 0) + (1 if y == 1 else 0)
                if x in (6, 9) and 2 < y < 11: v -= 1 if (y % 3) else 0   # soft folds
                t.set(x, y, R(D, v))
    for x in range(1, 15): t.set(x, 0, R(D, 1))            # edge strips the 3D model shows on the cloth's sides
    for y in range(0, 13): t.set(0, y, R(D, 1)); t.set(1, y, R(D, 1))
    emb = GOLD if color not in ('yellow', 'orange') else M['blacksteel']
    for j, row in enumerate(TOWER):
        for i, ch in enumerate(row):
            x, y = 5 + i, 3 + j
            if ch == 'X': t.set(x, y, R(emb, 4 if (j <= 1 or i <= 1) else 2 if i >= 4 else 3))
            if ch == 'D': t.set(x, y, R(emb, 0))
    return t
for c in ["white", "orange", "magenta", "light_blue", "yellow", "lime", "pink", "gray", "light_gray", "cyan", "purple", "blue", "brown", "green", "red", "black"]:
    save(banner(c), f'siege_banner_{c}')

# ---------------- work blocks ----------------
OAK, DOAK = M['oak'], M['dark_oak']
def framed_planks(seed, vertical=True, wood=OAK, rim=DOAK):
    t = Tex(seed=seed); planks(t, wood, vertical, (4, 4, 4, 4), seed=seed); frame(t, rim, 0, 1); return t

def barracks_side():
    t = framed_planks(11)
    A = M['blood_red']
    shield = ["XXXXXX", "XXXXXX", "XXXXXX", "XXXXXX", "XXXXXX", ".XXXX.", "..XX.."]
    for j, row in enumerate(shield):
        for i, ch in enumerate(row):
            if ch == 'X': t.set(5 + i, 4 + j, R(A, 4 if (i == 0 or j == 0) else 2 if i == 5 else 3))
    for i in range(6): t.set(5 + i, 3, R(IRON, 4));
    for j in range(5): t.set(4, 4 + j, R(IRON, 3)); t.set(11, 4 + j, R(IRON, 1))
    for (x, y) in line((3, 3), (12, 12)) + line((12, 3), (3, 12)):   # crossed spears behind
        if t.get(x, y)[:3] not in A: t.set(x, y, R(OAK, 5))
    for (x, y) in [(2, 2), (13, 2)]: t.set(x, y, R(IRON, 5))
    return t
save(barracks_side(), 'siege_barracks_side')

def barracks_top():
    t = Tex(seed=12); planks(t, OAK, False, (4, 4, 4, 4), seed=12)
    W = M['cloth']; A = M['blood_red']
    t.rect(2, 2, 13, 13, R(A, 2)); t.rect(3, 3, 12, 12, R(A, 3))       # bedroll
    t.rect(3, 3, 12, 5, R(PLASTER, 4)); t.rect(3, 5, 12, 5, R(PLASTER, 2))   # pillow
    for x in range(2, 14): t.set(x, 13, R(A, 1))
    return t
save(barracks_top(), 'siege_barracks_top')

def workshop_side():
    t = Tex(seed=13); bricks(t, V['stone'], V['mortar'], seed=13)
    t.rect(0, 0, 15, 3, R(OAK, 3));
    for x in range(16): t.set(x, 0, R(OAK, 4)); t.set(x, 3, R(OAK, 1)); t.set(x, 4, R(V['mortar'], 0))
    # hanging tools: hammer, saw
    for y in range(5, 13): t.set(4, y, R(OAK, 4 if y % 2 else 3))
    t.rect(2, 5, 6, 6, R(IRON, 4)); t.rect(2, 7, 6, 7, R(IRON, 1))
    for x in range(9, 14):
        for y in range(6, 12 - (x - 9) // 2): t.set(x, y, R(IRON, 4 if x == 9 else 3))
        t.set(x, 12 - (x - 9) // 2, R(IRON, 1) if x % 2 else R(IRON, 2))
    t.rect(9, 4, 10, 5, R(OAK, 2))
    return t
save(workshop_side(), 'siege_workshop_side')

def workshop_top():
    t = framed_planks(14, False)
    P = M['parchment']; B = M['royal_blue']
    t.rect(3, 3, 12, 12, R(P, 3));
    for i in range(3, 13): t.set(i, 3, R(P, 4)); t.set(3, i, R(P, 4)); t.set(i, 12, R(P, 1)); t.set(12, i, R(P, 2))
    for p in line((4, 11), (11, 11)) + line((5, 11), (8, 7)) + line((11, 11), (8, 7)) + line((4, 5), (11, 9)) + line((4, 5), (4, 7)):
        t.set(*p, R(B, 2))
    t.rect(10, 9, 11, 10, R(B, 3)); t.set(8, 7, R(B, 4))
    for (x, y) in [(2, 2), (13, 2), (2, 13), (13, 13)]: t.set(x, y, R(IRON, 4))
    return t
save(workshop_top(), 'siege_workshop_top')

def desk_side():
    t = framed_planks(15, False)
    t.rect(4, 6, 11, 10, R(DOAK, 1)); t.rect(5, 7, 10, 9, R(OAK, 2))
    for x in range(5, 11): t.set(x, 7, R(OAK, 3))
    t.rect(7, 8, 8, 8, R(GOLD, 4)); t.set(8, 8, R(GOLD, 2))
    return t
save(desk_side(), 'siege_desk_side')

def desk_top():
    t = framed_planks(16, False)
    P = M['parchment']; E = M['emerald']
    t.rect(2, 3, 9, 12, R(P, 3)); t.rect(5, 3, 6, 12, R(P, 1))       # open ledger
    for y in (5, 7, 9, 11):
        for x in (3, 4, 7, 8): t.set(x, y, R(M['coal'], 3))
    for (x, y) in [(11, 4), (12, 5), (11, 9), (13, 10), (12, 12)]: t.set(x, y, R(E, 4)); t.set(x + 1, y + 1, R(E, 2))
    t.rect(11, 6, 13, 7, R(GOLD, 4)); t.set(13, 7, R(GOLD, 2))       # coin stack
    for (x, y) in line((9, 13), (13, 3)): pass
    return t
save(desk_top(), 'siege_desk_top')

def desk_bottom():
    t = Tex(seed=17); planks(t, DOAK, False, (4, 4, 4, 4), seed=17); return t
save(desk_bottom(), 'siege_desk_bottom')

def charge_side():
    t = Tex(seed=18); planks(t, M['oak'], True, (3, 3, 4, 3, 3), seed=18, nails=False)
    band(t, BS, 2, rivets=(3, 12)); band(t, BS, 12, rivets=(3, 12))
    A = M['blood_red']
    t.rect(4, 6, 11, 9, R(A, 3));
    for x in range(4, 12): t.set(x, 6, R(A, 4)); t.set(x, 9, R(A, 1))
    for (x, y) in [(6, 7), (7, 8), (8, 7), (9, 8)]: t.set(x, y, R(PLASTER, 5))   # skull-ish warning marks
    return t
save(charge_side(), 'siege_charge_side')

def charge_top():
    t = Tex(seed=19); planks(t, M['oak'], False, (4, 4, 4, 4), seed=19)
    for i in range(16):   # round lid rim
        for (x, y) in [(i, 1), (i, 14), (1, i), (14, i)]:
            if 2 <= i <= 13: t.set(x, y, R(BS, 3 if x < 8 and y < 8 else 1))
    for (x, y) in line((8, 8), (11, 3)): t.set(x, y, R(M['rope'], 4))
    t.set(11, 3, R(M['flame'], 4)); t.set(12, 2, R(M['flame'], 5))
    t.rect(7, 7, 8, 8, R(BS, 1))
    return t
save(charge_top(), 'siege_charge_top')
print('blocks done')
