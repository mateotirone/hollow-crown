"""The Castle Stone family (Mateo, 2026-11-10): besides Castle Stone itself every region gets Tiles, Bricks, Cobbled and
Smooth, same shapes everywhere, only the region's stone and mortar ramps change. Each block also gets the shared
crack stages (texlib.damage_set): <name>_stone_0..2. The Hollow is left out on purpose.
Files: Vale in textures/blocks/siege_castle_<kind>.png, other regions in textures/blocks/regional/siege_castle_<kind>_<region>.png
Run: python3 build_stone_family.py"""
import os, sys, random, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from palette import REGIONS
from texlib import *
TB = '/mnt/project-files/siege-nights/Siege_Nights_RP/textures/blocks/'
KINDS = ('tiles', 'bricks', 'cobbled', 'smooth')
FAMILY_REGIONS = ('vale', 'frostmarch', 'saltreach', 'emberwaste', 'blackfen')

def tiles(rg, seed):
    """Four square paving tiles with a bevel; opposite corners a shade apart so floors read as a checker up close."""
    t = Tex(); st, mo = rg['stone'], rg['mortar']; r = random.Random(seed)
    for ty in range(2):
        for tx in range(2):
            tone = 3 if (tx + ty) % 2 == 0 else 2
            for y in range(8):
                for x in range(8):
                    X, Y = tx * 8 + x, ty * 8 + y
                    if x == 7 or y == 7: t.set(X, Y, R(mo, 1 if y == 7 else 2)); continue
                    v = tone + (1 if (y == 0 or x == 0) else 0) - (1 if (y == 6 or x == 6) and not (y == 0 or x == 0) else 0)
                    t.set(X, Y, R(st, v))
            fx, fy = tx * 8 + r.randrange(2, 5), ty * 8 + r.randrange(2, 5)          # one soft worn patch per tile
            t.set(fx, fy, R(st, tone - 1)); t.set(fx + 1, fy, R(st, tone - 1))
    return t

def small_bricks(rg, seed):
    t = Tex(seed=seed); bricks(t, rg['stone'], rg['mortar'], rows=((0, 4, 8, 12), (2, 6, 10, 14), (0, 4, 8, 12), (2, 6, 10, 14)), seed=seed, tidy=True)
    r = random.Random(seed)
    for _ in range(5):                                                               # a few darker bricks so walls do not look printed
        bx, by = r.randrange(4), r.randrange(4); x0 = (bx * 4 + (2 if by % 2 else 0)) % 16; y0 = by * 4
        for y in range(y0, y0 + 3):
            for x in range(x0, x0 + 3):
                c = t.get(x % 16, y); t.set(x % 16, y, brighten(c, 0.88))
    return t

def cobbled(rg, seed):
    """Rounded field stones packed in dark mortar: nearest-seed cells on a wrapping grid, so it tiles."""
    t = Tex(); st, mo = rg['stone'], rg['mortar']; r = random.Random(seed)
    pts = [((gx * 4 + r.uniform(0.6, 3.4)) % 16, (gy * 4 + r.uniform(0.6, 3.4) + (2 if gx % 2 else 0)) % 16, r.choice((2, 2, 3, 3, 4))) for gx in range(4) for gy in range(4)]
    def near(x, y):
        ds = sorted((min(abs(x - px), 16 - abs(x - px)) ** 2 + min(abs(y - py), 16 - abs(y - py)) ** 2, i) for i, (px, py, _) in enumerate(pts))
        return ds[0][1], math.sqrt(ds[1][0]) - math.sqrt(ds[0][0])
    cell = [[near(x + 0.5, y + 0.5) for x in range(16)] for y in range(16)]
    for y in range(16):
        for x in range(16):
            i, gap = cell[y][x]
            if gap < 0.9: t.set(x, y, R(mo, 1 if gap < 0.45 else 2)); continue
            tone = pts[i][2]
            up = cell[(y - 1) % 16][x]; left = cell[y][(x - 1) % 16]; down = cell[(y + 1) % 16][x]; right = cell[y][(x + 1) % 16]
            lit = up[0] != i or up[1] < 0.9 or left[0] != i or left[1] < 0.9
            shade = down[0] != i or down[1] < 0.9 or right[0] != i or right[1] < 0.9
            t.set(x, y, R(st, tone + (1 if lit and not shade else 0) - (1 if shade and not lit else 0)))
    return t

def smooth(rg, seed):
    """One dressed slab: a fine bevel and broad, quiet tone patches."""
    t = Tex(); st = rg['stone']; r = random.Random(seed)
    for y in range(16):
        for x in range(16):
            v = 3
            if y == 0 or x == 0: v = 4
            if y == 15 or x == 15: v = 1 if (y == 15 and x == 15) else 2
            t.set(x, y, R(st, v))
    for _ in range(3):                                                               # faint tool marks, never a shape
        x0, y0, w = r.randrange(2, 9), r.randrange(3, 13), r.randrange(3, 6)
        for x in range(x0, min(14, x0 + w)): t.set(x, y0, R(st, 2))
    for _ in range(2): t.set(r.randrange(3, 13), r.randrange(3, 13), R(st, 4))
    return t

PAINT = {'tiles': tiles, 'bricks': small_bricks, 'cobbled': cobbled, 'smooth': smooth}
def build():
    n = 0
    for rk in FAMILY_REGIONS:
        rg = REGIONS[rk]; sub = '' if rk == 'vale' else 'regional/'; suf = '' if rk == 'vale' else '_' + rk
        os.makedirs(TB + sub, exist_ok=True)
        for ki, kind in enumerate(KINDS):
            base = PAINT[kind](rg, 200 + ki)                 # same seed for every region: same shapes, different ramps
            name = f'siege_castle_{kind}{suf}'
            base.im.save(TB + sub + name + '.png'); n += 1
            for c, im in enumerate(damage_set(base.im, R(rg['stone'], 0))): im.save(TB + sub + f'{name}_stone_{c}.png'); n += 1
    print('stone family done:', n, 'textures')
if __name__ == '__main__': build()
