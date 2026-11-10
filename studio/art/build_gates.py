"""Castle Gate and Portcullis per region (Mateo, 2026-11-10: "Same with the castle gate texture").
Same shapes as build_blocks.py's gate and portcullis; the region swaps the plank wood, and the portcullis picks up a
faint tint of the region's stone so it sits in that wall. Metal tiers stay vanilla (blacksteel, iron, diamond, netherite).
Files: textures/blocks/regional/siege_castle_gate_<region>[_tier].png, siege_portcullis_<region>[_tier].png,
plus _open versions. Run: python3 build_gates.py"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from palette import M, REGIONS, fixed
from texlib import *
TB = '/mnt/project-files/siege-nights/Siege_Nights_RP/textures/blocks/'
GATE_REGIONS = ('vale', 'frostmarch', 'saltreach', 'emberwaste', 'blackfen')
IRON, BS, GOLD, DIA, NETH = M['iron'], M['blacksteel'], M['gold'], M['diamond'], M['netherite']
GATE_METAL = {'': (BS, BS), 'iron': (IRON, IRON), 'diamond': (IRON, DIA), 'netherite': (NETH, GOLD)}
PORT_METAL = {'': BS, 'iron': IRON, 'diamond': fixed('#1e4048', '#3e6a74', '#6c9aa4', '#96c4cc', '#c4e8ec', '#eafcfc'), 'netherite': NETH}
PORT_STUD = {'': BS, 'iron': IRON, 'diamond': DIA, 'netherite': GOLD}

def mix(a, b, k):
    return tuple(int(a[i] * (1 - k) + b[i] * k) for i in range(3)) + ((a[3],) if len(a) > 3 else ())
def tint_ramp(metal, stone, k=0.14):
    return [mix(m, s, k) for m, s in zip(metal, stone)]

def castle_gate(rk, tier):
    rg = REGIONS[rk]; wood = rg['wood']
    t = Tex(seed=4); planks(t, wood, True, (4, 4, 4, 4), seed=4 + GATE_REGIONS.index(rk))
    metal, stud = GATE_METAL[tier]
    for y in (2, 12):
        for x in range(16):
            t.set(x, y - 1, R(metal, 0)); t.set(x, y, R(metal, 3)); t.set(x, y + 1, R(metal, 2)); t.set(x, y + 2, R(metal, 0))
        for x in (1, 5, 9, 13): t.set(x, y, R(stud, 5)); t.set(x, y + 1, R(stud, 3))
    for (x, y) in [(7, 7), (8, 7), (6, 8), (9, 8), (7, 9), (8, 9)]: t.set(x, y, R(metal, 3))
    t.set(7, 8, R(metal, 1)); t.set(8, 8, R(metal, 1))
    if tier == 'diamond':
        for x in range(16): t.set(x, 0, R(DIA, 3)); t.set(x, 15, R(DIA, 1))
    if tier == 'netherite':
        wc = set(c[:3] for c in wood)
        for y in range(16):
            for x in range(16):
                p = t.get(x, y)
                if p[:3] in wc: t.set(x, y, brighten(p, 0.7))
    return t

def portcullis(rk, tier):
    st = REGIONS[rk]['stone']
    t = Tex(); m = tint_ramp(PORT_METAL[tier], st); s = PORT_STUD[tier]
    cols = [1, 5, 9, 13]; rows = [2, 9]
    for x0 in cols:
        for y in range(15):
            t.set(x0, y, R(m, 4 if y < 14 else 3)); t.set(x0 + 1, y, R(m, 2 if y < 14 else 1))
        t.set(x0, 15, R(m, 2))                                           # spike tip
    for y0 in rows:
        for x in range(16): t.set(x, y0, R(m, 4)); t.set(x, y0 + 1, R(m, 1))
        for x0 in cols: t.set(x0, y0, R(s, 5)); t.set(x0 + 1, y0 + 1, R(s, 2))
    return t

def from_mask(mask_im, paint):
    t = Tex(); mp = mask_im.load()
    for y in range(16):
        for x in range(16):
            if mp[x, y][3]: paint(t, x, y, mp[x, y])
    return t

def build():
    os.makedirs(TB + 'regional/', exist_ok=True)
    og = Image.open(TB + 'siege_castle_gate_open.png').convert('RGBA'); op = Image.open(TB + 'siege_portcullis_open.png').convert('RGBA')
    bsc = set(c[:3] for c in BS); n = 0
    for rk in GATE_REGIONS:
        wood = REGIONS[rk]['wood']; m = tint_ramp(BS, REGIONS[rk]['stone'])
        for tier in GATE_METAL:
            suf = f'_{rk}' + ('_' + tier if tier else '')
            castle_gate(rk, tier).im.save(TB + f'regional/siege_castle_gate{suf}.png')
            portcullis(rk, tier).im.save(TB + f'regional/siege_portcullis{suf}.png'); n += 2
        def open_gate(t, x, y, p):
            t.set(x, y, R(BS, 3) if p[:3] in bsc else R(wood, 3 if x in (0, 14) else 1))
        from_mask(og, open_gate).im.save(TB + f'regional/siege_castle_gate_{rk}_open.png')
        from_mask(op, lambda t, x, y, p: t.set(x, y, R(m, 4 if y == 0 else 2 if y == 1 else 1))).im.save(TB + f'regional/siege_portcullis_{rk}_open.png'); n += 2
    print(n, 'gate textures')

def sheet(path='/mnt/project-files/siege-nights/art/castle-gates-regional.png', S=6):
    tiers = list(GATE_METAL); W = len(tiers) * 2 * 18 + 2; H = len(GATE_REGIONS) * 18 + 2
    im = Image.new('RGBA', (W, H), (30, 28, 34, 255))
    for j, rk in enumerate(GATE_REGIONS):
        for i, tier in enumerate(tiers):
            suf = f'_{rk}' + ('_' + tier if tier else '')
            for k, nm in enumerate(('castle_gate', 'portcullis')):
                a = Image.open(TB + f'regional/siege_{nm}{suf}.png').convert('RGBA')
                x = 2 + (k * len(tiers) + i) * 18; y = 2 + j * 18
                if k: im.paste(Image.new('RGBA', (16, 16), tuple(REGIONS[rk]['stone'][1][:3]) + (255,)), (x, y))
                im.alpha_composite(a, (x, y))
    im.resize((W * S, H * S), Image.NEAREST).save(path)

if __name__ == '__main__':
    build(); sheet()
