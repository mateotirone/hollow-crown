"""Keep Banner, made tall (Mateo 2026-11-11: "this needs to be taller. Right now, it's just a one-block thing").

A war banner on a pole, nearly two blocks high: dark oak pole with an iron finial, a crossbar with end caps, and a
long cloth (12 x 22 pixels) with a gold-trimmed edge, soft vertical folds that darken towards the foot, a bigger
gold castle-tower emblem and a swallowtail hem. Selection box stays one block (the game allows no more).

    python3 studio/art/build_keep_banner.py [repo root]

Writes models/blocks/keep_banner.geo.json (texture 16x32), textures/blocks/siege_banner_pole.png (16x32) and
siege_banner_<colour>.png for all 16 dye colours (16x32), and art/keep-banner.png. Replaces the banner part of
build_blocks.py (its 16x16 versions would no longer fit this model).
"""
import json, os, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from palette import M, dye_ramp
from texlib import Tex, R, planks

ROOT = (sys.argv[1].rstrip('/') + '/') if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) + '/'
RP = ROOT + 'Siege_Nights_RP/'
GOLD, IRON = M['gold'], M['iron']
COLORS = ["white", "orange", "magenta", "light_blue", "yellow", "lime", "pink", "gray", "light_gray", "cyan", "purple",
          "blue", "brown", "green", "red", "black"]

# ---- texture layout (16 x 32). Cloth sheet: face x2-13 y2-23, side strip x0 y2-23, top strip x2-13 y0.
# Pole sheet: wood grain everywhere, iron at y28-31 for the finial and caps.
CX, CY, CW, CH = 2, 2, 12, 22
TOWER = ["X.X.X.X.", "XXXXXXXX", ".XXXXXX.", ".XX..XX.", ".XXXXXX.", ".XXXXXX.", ".XXDDXX.", ".XDDDDX.", ".XDDDDX.", "XXXXXXXX"]


def cloth(color):
    D = dye_ramp(color)
    emb = GOLD if color not in ('yellow', 'orange') else M['blacksteel']
    t = Tex(16, 32)
    for y in range(CH):
        for x in range(CW):
            # swallowtail: a V cut up into the last 5 rows
            tail = y - (CH - 5)
            if tail >= 0 and abs(x - 5.5) < tail + 0.5: continue
            v = 3
            if x in (0, CW - 1) or y == CH - 1 or (tail >= 0 and abs(x - 5.5) < tail + 1.5):
                c = R(emb, 3 if x == 0 or y == 0 else 2); t.set(CX + x, CY + y, c); continue   # gold edging
            if y <= 1:                                                     # sleeve over the crossbar
                v = 2 if y == 0 else 4
            else:
                v += (1 if x in (1, 5, 6) else 0) - (1 if x in (3, 4, 9, 10) else 0)   # folds: lit ridge, shadow trough
                if y > CH * 0.6: v -= 1                                     # the foot hangs in shadow
                if x == CW - 2: v -= 1
            t.set(CX + x, CY + y, R(D, v))
    for j, row in enumerate(TOWER):                                         # the emblem
        for i, ch in enumerate(row):
            x, y = CX + 2 + i, CY + 4 + j
            if ch == 'X': t.set(x, y, R(emb, 5 if j <= 1 else 4 if i <= 2 else 2 if i >= 6 else 3))
            elif ch == 'D': t.set(x, y, R(emb, 0) if j > 6 else R(D, 1))
    for y in range(CH): t.set(0, CY + y, R(D, 1))                           # cloth edge seen from the side
    for x in range(CW): t.set(CX + x, 0, R(D, 2))                           # top edge
    return t


def pole():
    t = Tex(16, 32, seed=10)
    top = Tex(seed=10); planks(top, M['dark_oak'], True, (4, 4, 4, 4), seed=10, nails=False)
    bot = Tex(seed=11); planks(bot, M['dark_oak'], True, (4, 4, 4, 4), seed=11, nails=False)
    t.im.paste(top.im, (0, 0)); t.im.paste(bot.im, (0, 16))
    for y in range(28, 32):
        for x in range(16): t.set(x, y, R(IRON, 4 if y == 28 else 3 if x % 4 else 2))
    return t


def fu(u, v, w, h, mat=None):
    d = {"uv": [u, v], "uv_size": [w, h]}
    if mat: d["material_instance"] = mat
    return d
def box(o, s, faces): return {"origin": o, "size": s, "uv": faces}
def all6(u, v, w, h, top=None):
    return {f: fu(u, v, w, h) for f in ("north", "south", "east", "west")} | {f: fu(*(top or (u, v, w, w))) for f in ("up", "down")}

cubes = [
    box([-1, 0, -1], [2, 27, 2], all6(7, 0, 2, 27, (7, 7, 2, 2))),                                # pole
    box([-1.5, 27, -1.5], [3, 1, 3], all6(6, 28, 3, 1, (6, 28, 3, 3))),                           # iron collar
    box([-0.5, 28, -0.5], [1, 1.5, 1], all6(7, 29, 1, 1, (7, 29, 1, 1))),                         # finial spike
    box([-7, 25, -2], [14, 1, 1], {"north": fu(1, 4, 14, 1), "south": fu(1, 4, 14, 1), "east": fu(6, 4, 1, 1),
                                   "west": fu(6, 4, 1, 1), "up": fu(1, 6, 14, 1), "down": fu(1, 6, 14, 1)}),  # crossbar
    box([-8, 24.5, -2.5], [1, 2, 2], all6(2, 29, 1, 2, (2, 29, 1, 2))),                           # iron end caps
    box([7, 24.5, -2.5], [1, 2, 2], all6(2, 29, 1, 2, (2, 29, 1, 2))),
    box([-6, 3, -2.75], [12, 22, 0.5], {"north": fu(CX, CY, CW, CH, "cloth"), "south": fu(CX, CY, CW, CH, "cloth"),
                                        "east": fu(0, CY, 1, CH, "cloth"), "west": fu(0, CY, 1, CH, "cloth"),
                                        "up": fu(CX, 0, CW, 1, "cloth"), "down": fu(CX, 0, CW, 1, "cloth")}),  # cloth
]
geo = {"format_version": "1.12.0", "minecraft:geometry": [{"description": {"identifier": "geometry.siege_keep_banner",
       "texture_width": 16, "texture_height": 32, "visible_bounds_width": 2, "visible_bounds_height": 3,
       "visible_bounds_offset": [0, 1, 0]}, "bones": [{"name": "block", "pivot": [0, 0, 0], "cubes": cubes}]}]}
with open(RP + 'models/blocks/keep_banner.geo.json', 'w') as f: json.dump(geo, f, indent=1); f.write('\n')

B = RP + 'textures/blocks/'
pole().save(B + 'siege_banner_pole.png')
imgs = {}
for c in COLORS:
    imgs[c] = cloth(c).im; imgs[c].save(B + f'siege_banner_{c}.png')
sheet = Image.new('RGBA', (8 * 100 + 10, 2 * 200 + 10), (40, 40, 46, 255))
for i, c in enumerate(COLORS):
    sheet.alpha_composite(imgs[c].resize((96, 192), Image.NEAREST), (10 + (i % 8) * 100, 10 + (i // 8) * 200))
sheet.save(ROOT + 'art/keep-banner.png')
print('ok')
