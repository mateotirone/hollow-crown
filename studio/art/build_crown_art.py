"""The Hollow Crown, from Mateo's reference (art/reference/hollow-crown-reference.png): dark violet cracked stone,
jagged spikes, glowing magenta veins, pale blue diamond gems, an amethyst shard in the tall centre spike and a small
blue crystal floating in its opening. Writes the item icon, the worn model + texture, and is imported by the pack icon.
Run: python3 build_crown_art.py   (run AFTER build_hc_items.py, which no longer paints the crown icon)"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from palette import fixed
RP = '/mnt/project-files/siege-nights/Siege_Nights_RP/'
STONE = fixed('#150c1e', '#2a1838', '#402654', '#583670', '#744c90', '#9670b2')
AMETH = fixed('#2a1250', '#4a1e88', '#7234c4', '#a05cf0', '#c896ff', '#ecd8ff')
ICE = fixed('#2c5c84', '#5a94c0', '#8cc4e6', '#b8e2f8', '#dcf4ff', '#ffffff')
VEIN, VEIN_DIM = (255, 96, 204, 255), (190, 50, 146, 255)
c = lambda r, i: tuple(r[i][:3]) + (255,)

# ---- item icon
ICON = ["................", ".......oo.......", "......oHLo......", "..o...oLMo...o..", ".olo..oMDo..olo.", ".omo.ollmdo.omo.", ".omdoom..mdoodo.", ".omdolm.5.mdodo.",
        ".olmdlv.4.vddso.", ".olmmmlv.vmddso.", ".ohlvmmlvmdvdso.", ".o5lmvmm5mvdd5o.", ".olmmmvmvmmddso.", ".osddddsssdddso.", "..oooooooooooo..", "................"]
def icon():
    im = Image.new('RGBA', (16, 16), (0, 0, 0, 0)); m1 = dict(zip('osdmlh', range(6))); m2 = dict(zip('OSDMLH', range(6)))
    for y, row in enumerate(ICON):
        assert len(row) == 16
        for x, ch in enumerate(row):
            if ch in m1: im.putpixel((x, y), c(STONE, m1[ch]))
            elif ch in m2: im.putpixel((x, y), c(AMETH, m2[ch]))
            elif ch.isdigit(): im.putpixel((x, y), c(ICE, int(ch)))
            elif ch == 'v': im.putpixel((x, y), VEIN)
    im.save(RP + 'textures/items/siege_hollow_crown.png')

# ---- worn model: a hollow ring with eight points; the front one is a tall open arch
UV = {'slabF': (0, 0), 'slabS': (0, 4), 'pillar': (24, 0), 'cap': (30, 0), 'cap2': (30, 3), 'ameth': (42, 0), 'atip': (42, 5),
      'crystal': (48, 0), 'spike3': (24, 6), 'tip2': (30, 6), 'tip1': (36, 6)}
SIZE = {'slabF': (10, 2, 1), 'slabS': (1, 2, 8), 'pillar': (1, 4, 1), 'cap': (4, 1, 1), 'cap2': (2, 1, 1), 'ameth': (1, 3, 1), 'atip': (1, 1, 1),
        'crystal': (1, 2, 1), 'spike3': (1, 3, 1), 'tip2': (1, 2, 1), 'tip1': (1, 1, 1)}
def cube(kind, o, inflate=0, rot=None, pivot=None):
    d = {"origin": list(o), "size": list(SIZE[kind]), "uv": {f: {"uv": [x, y], "uv_size": [w, h]} for f, (x, y, w, h) in faces(kind).items()}}
    if inflate: d["inflate"] = inflate
    if rot: d["rotation"] = rot; d["pivot"] = pivot
    return d
def geo():
    cs = [cube('slabF', (-5, 31, -5)), cube('slabF', (-5, 31, 4)), cube('slabS', (-5, 31, -4)), cube('slabS', (4, 31, -4)),
          cube('pillar', (-2, 33, -5)), cube('pillar', (1, 33, -5)), cube('cap', (-2, 37, -5)), cube('cap2', (-1, 38, -5)),
          cube('ameth', (-0.5, 39, -5)), cube('atip', (-0.5, 42, -5), -0.2), cube('crystal', (-0.5, 34.25, -5), -0.15)]
    for sx in (-1, 1):
        for sz in (-1, 1):                                     # corner spikes lean outward
            x = -5 if sx < 0 else 4; z = -5 if sz < 0 else 4; piv = [x + 0.5, 33, z + 0.5]; rot = [10 * sz, 0, 10 * sx]
            cs += [cube('pillar', (x, 33, z), 0, rot, piv), cube('tip2', (x, 37, z), -0.2, rot, piv)]
        x = -5 if sx < 0 else 4; piv = [x + 0.5, 33, 0]
        cs += [cube('spike3', (x, 33, -0.5), 0, [0, 0, 8 * sx], piv), cube('tip1', (x, 36, -0.5), -0.2, [0, 0, 8 * sx], piv)]
    cs += [cube('spike3', (-0.5, 33, 4), 0, [8, 0, 0], [0, 33, 4.5]), cube('tip2', (-0.5, 36, 4), -0.2, [8, 0, 0], [0, 33, 4.5])]
    g = {"format_version": "1.12.0", "minecraft:geometry": [{"description": {"identifier": "geometry.siege_hollow_crown", "texture_width": 128, "texture_height": 64,
         "visible_bounds_width": 3, "visible_bounds_height": 3, "visible_bounds_offset": [0, 1.5, 0]},
         "bones": [{"name": "head", "pivot": [0, 24, 0], "cubes": cs}]}]}
    json.dump(g, open(RP + 'models/entity/hollow_crown.geo.json', 'w'), indent=1)

def _h(x, y): n = (x * 374761393 + y * 668265263) & 0xffffffff; n = ((n ^ (n >> 13)) * 1274126177) & 0xffffffff; return ((n ^ (n >> 16)) & 0xffff) / 65535
def faces(kind):
    (u, v), (w, h, d) = UV[kind], SIZE[kind]
    r = {'up': (u + d, v, w, d), 'down': (u + d + w, v, w, d), 'east': (u, v + d, d, h), 'north': (u + d, v + d, w, h), 'west': (u + d + w, v + d, d, h), 'south': (u + d + w + d, v + d, w, h)}
    return {k: tuple(2 * n for n in q) for k, q in r.items()}
def worn():
    im = Image.new('RGBA', (128, 64), (0, 0, 0, 0))
    def fill(kind, ramp, base=3):
        for f, (x0, y0, w, h) in faces(kind).items():
            for y in range(h):
                for x in range(w):
                    t = base + (1 if f == 'up' else -2 if f == 'down' else -1 if f in ('west', 'south') else 0)
                    if f not in ('up', 'down') and y == 0: t += 1
                    if f not in ('up', 'down') and y == h - 1 and h > 2: t -= 1
                    if _h((x0 + x) // 2, (y0 + y) // 3) < 0.3: t -= 1
                    im.putpixel((x0 + x, y0 + y), c(ramp, max(0, min(5, t))))
    for k in ('slabF', 'slabS', 'pillar', 'cap', 'cap2', 'spike3', 'tip2', 'tip1'): fill(k, STONE)
    fill('ameth', AMETH, 3); fill('atip', AMETH, 4); fill('crystal', ICE, 3)
    def dots(kind, f, pts, col):
        x0, y0, w, h = faces(kind)[f]
        for x, y in pts:
            if 0 <= x < w and 0 <= y < h: im.putpixel((x0 + x, y0 + y), col)
    def gem(kind, f, x, hi=3): dots(kind, f, [(x, 1)], c(ICE, hi + 1)); dots(kind, f, [(x, 2)], c(ICE, hi - 1))
    for f in ('north', 'south'):                                # band: thin veins branching up to the points, diamond gems
        V = VEIN if f == 'north' else VEIN_DIM
        dots('slabF', f, [(9, 3), (8, 2), (7, 2), (6, 1), (5, 0), (10, 3), (11, 2), (12, 2), (13, 1), (14, 0), (2, 3), (1, 2), (0, 1), (17, 3), (18, 2), (19, 1)], V)
        gem('slabF', f, 3); gem('slabF', f, 16); gem('slabF', f, 9, 4); gem('slabF', f, 10, 4)
    for f in ('east', 'west'):
        dots('slabS', f, [(0, 1), (1, 2), (2, 3), (5, 3), (6, 2), (7, 1), (8, 0), (9, 1), (10, 2), (11, 3), (14, 2), (15, 1)], VEIN_DIM)
        gem('slabS', f, 3); gem('slabS', f, 12)
    for f in ('north', 'south', 'east', 'west'):
        V = VEIN if f == 'north' else VEIN_DIM
        dots('pillar', f, [(0, 7), (0, 6), (1, 5), (1, 4), (0, 3)], V); dots('spike3', f, [(0, 5), (0, 4), (1, 3)], V)
        dots('ameth', f, [(0, 0), (0, 1), (0, 2)], c(AMETH, 5)); dots('ameth', f, [(1, 5)], c(AMETH, 1))
        dots('crystal', f, [(0, 0), (0, 1)], c(ICE, 5)); dots('crystal', f, [(1, 3)], c(ICE, 1))
    dots('cap', 'north', [(0, 1), (1, 0), (6, 0), (7, 1)], VEIN)
    im.save(RP + 'textures/models/armor/siege_hollow_crown.png')
# geo() and worn() are superseded by build_crown3d.py (2026-11-11); only the icon is still made here.
if __name__ == '__main__': icon(); print('crown icon done')
