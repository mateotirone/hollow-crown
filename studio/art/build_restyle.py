"""Restyle pass for textures that are tied to 3D shapes (3D vanilla armour, guard armour tiers, worn guard
armour, quartermaster, barding). Keeps every shape and UV exactly, but repaints in the shared style:
  1. each pixel is assigned to a palette ramp (its material),
  2. its tone comes from a noise-free reading of the old shading,
  3. edges of each material patch get the top-left highlight / bottom-right shadow bevel.
Sources are the originals in art/placeholder-backup/, so this is safe to re-run.
Armour-layer rule kept: alpha 255 = tintable grey cloth, alpha 1 = keeps its own colour.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from palette import M, fixed, ramp
SRC = '/mnt/project-files/siege-nights/art/placeholder-backup/'; DST = '/mnt/project-files/siege-nights/Siege_Nights_RP/textures/'
RAMPS = {k: M[k] for k in ['steel', 'blacksteel', 'gold', 'diamond', 'netherite', 'ruby', 'leather', 'blood_red', 'purple', 'skin', 'dark_oak', 'coal']}
RAMPS['linen'] = fixed('#6a5e48', '#8e826a', '#b0a488', '#cdc2a6', '#e2d9c0', '#f2ecda')
RAMPS['brick'] = ramp('#84342a', 0.12, 0.60)
RAMPS['plate'] = fixed('#2c3a44', '#4c626e', '#7892a0', '#a4bcc8', '#cfe0e6', '#f0f8fa')   # diamond-tier knight's plate

def lum(c): return 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]
def dist(a, b): return 2 * (a[0] - b[0]) ** 2 + 4 * (a[1] - b[1]) ** 2 + 3 * (a[2] - b[2]) ** 2
def classify(c, ramps):
    best = None
    for name, r in ramps.items():
        for i, t in enumerate(r):
            d = dist(c, t)
            if best is None or d < best[0]: best = (d, name, i)
    return best[1], best[2]

def restyle(rel, armor_layer=False, bevel=True, ramps=RAMPS):
    im = Image.open(SRC + rel).convert('RGBA'); src = im.copy().load(); px = im.load(); W, H = im.size
    mat = {}; cache = {}
    for y in range(H):
        for x in range(W):
            p = src[x, y]
            if p[3] == 0: continue
            if armor_layer and p[3] == 255: mat[x, y] = ('cloth', None); continue
            if p[:3] not in cache: cache[p[:3]] = classify(p, ramps)
            mat[x, y] = cache[p[:3]]
    for (x, y), (name, tone) in mat.items():
        p = src[x, y]; r = M['cloth'] if name == 'cloth' else ramps[name]
        # noise-free tone: average with same-material neighbours that are within noise range of this pixel
        ls = [lum(p)]
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = (x + dx, y + dy)
            if q in mat and mat[q][0] == name and abs(lum(src[q]) - lum(p)) < 22: ls.append(lum(src[q]))
        L = sum(ls) / len(ls)
        i = min(range(len(r)), key=lambda k: abs(lum(r[k]) - L))
        if bevel:
            same = lambda dx, dy: (x + dx, y + dy) in mat and mat[x + dx, y + dy][0] == name
            if not same(0, -1) or not same(-1, 0): i += 1
            elif not same(0, 1) or not same(1, 0): i -= 1
        i = max(0, min(len(r) - 1, i))
        px[x, y] = r[i] + (p[3],)
    im.save(DST + rel); return im

def pick(*names): return {n: RAMPS[n] for n in names}
JOBS = [
    ('models/siege_armor/chainmail.png', pick('steel', 'linen', 'leather'), False),
    ('models/siege_armor/iron.png', pick('steel', 'linen', 'blood_red', 'leather'), False),
    ('models/siege_armor/diamond.png', pick('plate', 'gold', 'blood_red', 'dark_oak', 'coal'), False),
    ('models/siege_armor/netherite.png', pick('netherite', 'gold', 'purple', 'ruby'), False),
    ('models/siege_guard_armor/tier1.png', pick('steel', 'leather', 'linen'), False),
    ('models/siege_guard_armor/tier2.png', pick('steel', 'brick', 'gold', 'leather'), False),
    ('models/siege_guard_armor/tier3.png', pick('steel', 'leather', 'gold'), False),
    ('models/siege_guard_armor/tier4.png', pick('steel', 'gold', 'linen', 'leather'), False),
    ('models/armor/guard_layer_1.png', pick('steel', 'gold', 'leather'), True),
    ('models/armor/guard_layer_2.png', pick('steel', 'gold', 'leather'), True),
    ('entity/horse2/armor/horse_armor_iron.png', pick('steel', 'blood_red', 'gold', 'leather'), False),
]
if __name__ == '__main__':
    for rel, ramps, layer in JOBS: restyle(rel, layer, ramps=ramps)

    print('restyle done')
