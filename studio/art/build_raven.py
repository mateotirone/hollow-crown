"""Omen Raven skin (mobs thread's pull request #46): black with a blue-grey sheen, heavy dark beak, grey eye.
Painted from the box-UV geo:   python3 build_raven.py [repo root]      Sheet: art/omen-raven.png"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from geoskin import faces
ROOT = (sys.argv[1] if len(sys.argv) > 1 else '/mnt/project-files/siege-nights').rstrip('/') + '/'
RP = ROOT + 'Siege_Nights_RP/'
F = [(8, 8, 12), (14, 15, 21), (22, 24, 33), (34, 40, 54), (52, 64, 84), (84, 102, 128)]     # feather ramp: black to blue-grey sheen
BEAK = [(14, 13, 15), (26, 25, 28), (42, 40, 44), (62, 60, 64)]
LEG = [(20, 19, 22), (36, 34, 38), (54, 52, 56)]
EYE = (154, 158, 168)
g = json.load(open(RP + 'models/entity/bestiary/omen_raven.geo.json'))['minecraft:geometry'][0]
W, H = g['description']['texture_width'], g['description']['texture_height']
im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
def put(r, x, y, c):
    if 0 <= x < r[2] and 0 <= y < r[3] and r[0] + x < W and r[1] + y < H: im.putpixel((r[0] + x, r[1] + y), tuple(c) + (255,))
def fill(r, fn):
    for y in range(r[3]):
        for x in range(r[2]): put(r, x, y, fn(x, y, r[2], r[3]))
for b in g['bones']:
    for i, c in enumerate(b.get('cubes', [])):
        fr = faces(c); nm = b['name']
        for f, r in fr.items():
            top, side = f == 'up', f in ('east', 'west')
            if nm == 'root': fill(r, lambda x, y, w, h: LEG[2 if y == 0 else 1 if y < h - 1 else 0])                 # legs
            elif nm == 'body' and i == 0:                                                                          # breast and back
                fill(r, lambda x, y, w, h: F[(3 if top else 2 if f == 'north' else 1) - (1 if y == h - 1 and not top else 0) + (1 if (x + y) % 3 == 0 and f == 'north' and y < 2 else 0)])
            elif nm == 'body' and i in (1, 2):                                                                     # folded wings: rows of feathers, sheen along the top
                def wing(x, y, w, h):
                    if top: return F[4 if x == 0 else 3]
                    if side: return F[4] if y == 0 and x < w - 1 else F[1] if (x + y) % 2 == 0 and y > 0 else F[2 if y < h - 1 else 0]
                    return F[1]
                fill(r, wing)
                if side:
                    put(r, 1, 0, F[5])                                                                             # one bright glint
            elif nm == 'body': fill(r, lambda x, y, w, h: F[2 if top and y % 2 == 0 else 1 if top else 0])           # tail
            elif nm == 'head' and i == 0:
                fill(r, lambda x, y, w, h: F[3 if top else 2 if y == 0 else 1])
                if top: put(r, 0, 0, F[4]); put(r, 1, 1, F[4])
                if side: put(r, 1 if f == 'east' else r[2] - 2, 1, EYE); put(r, 1 if f == 'east' else r[2] - 2, 2, F[0])
                if f == 'north':
                    put(r, 1, 1, BEAK[1]); put(r, 1, 2, F[0])
            elif nm == 'head' and i == 1: fill(r, lambda x, y, w, h: BEAK[3 if top and y == 0 else 2 if top else 1 if f != 'down' else 0])   # heavy beak
            else: fill(r, lambda x, y, w, h: BEAK[1] if f != 'down' else BEAK[0])                                    # hooked tip
out = RP + 'textures/entity/siege/bestiary/omen_raven.png'; im.save(out)
bb = im.getbbox(); cr = im.crop(bb); sh = Image.new('RGBA', (cr.width * 10 + 16, cr.height * 10 + 16), (150, 150, 158, 255))
sh.alpha_composite(cr.resize((cr.width * 10, cr.height * 10), Image.NEAREST), (8, 8)); sh.save(ROOT + 'art/omen-raven.png'); print('ok', bb)
