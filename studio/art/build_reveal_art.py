"""Hand detail for the reveal scene (boy, king, the one at the desk) and the Standing Rank, on top of the mobs thread's
generated skins (pull request #70, geometry final). Every mark is a fixed colour, so the script is safe to re-run.
    python3 build_reveal_art.py [repo root]
Boy: freckles, a fringe, an ink-stained right hand. King: a lined brow, a beard going grey, gold hem on the robe, ink on the
right hand. The one at the desk: the same face gone cold, a violet splinter in the dead right palm, writing long faded, cold flame.
Standing Rank: empty eye slits, rime on the plate edges, faint seams of light. Same desk props for all three: written pages,
candle drips, wood grain. Sheet: art/reveal-scene.png
"""
import json, os, sys, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from geoskin import faces
ROOT = (sys.argv[1] if len(sys.argv) > 1 else '/mnt/project-files/siege-nights').rstrip('/') + '/'
RP = ROOT + 'Siege_Nights_RP/'
INK = (92, 80, 92); INK_FADED = (176, 166, 140); INK_HAND = (40, 34, 46); WAX = (236, 228, 204); WAX_D = (196, 184, 156)
SPLINTER = (196, 120, 255); SPLINTER_D = (120, 60, 170)


def load(name):
    g = json.load(open(RP + f'models/entity/bestiary/{name}.geo.json'))['minecraft:geometry'][0]
    im = Image.open(RP + f'textures/entity/siege/bestiary/{name}.png').convert('RGBA')
    cubes = {}
    for b in g['bones']:
        for i, c in enumerate(b.get('cubes', [])): cubes[(b['name'], i)] = faces(c)
    return im, cubes


def put(im, f, x, y, c, keep_alpha=False):
    x0, y0, w, h = f
    if 0 <= x < w and 0 <= y < h:
        a = im.getpixel((x0 + x, y0 + y))[3] if keep_alpha else 255
        if keep_alpha and a == 0: return
        im.putpixel((x0 + x, y0 + y), tuple(c[:3]) + (a,))


def desk(im, F, ink, flame, wood_d, quill=True):
    """Pages, candle and desk top, shared by the three ages. Cube order is the same in all three models."""
    page = F[('desk', 6)]['up']; r = random.Random(3)
    for y in range(1, page[3] - 1, 2):                                # thin lines of writing, a gutter down the middle
        for x in range(1, page[2] - 1):
            if x != page[2] // 2 and r.random() < 0.75: put(im, page, x, y, ink)
    for s in ('north', 'east', 'west', 'south'): put(im, F[('desk', 6)][s], 0, 0, (210, 198, 170))
    cand = F[('desk', 7)]
    for s, xs in (('north', (0,)), ('east', (1,)), ('west', (0,)), ('south', (1,))):
        for x in xs: put(im, cand[s], x, 0, WAX); put(im, cand[s], x, 1, WAX_D)   # a drip down each side
    put(im, cand['up'], 0, 0, (60, 50, 40))                                           # the wick
    for f in F[('desk', 8)].values(): put(im, f, 0, 0, flame)
    top = F[('desk', 1)]['up']
    for y in range(top[3]):                                           # wood grain along the desk top
        for x in range(top[2]):
            if (y * 5 + x // 4) % 7 == 0: put(im, top, x, y, wood_d)
    if quill:
        q = F[('desk', 9)]
        for s in ('up', 'east', 'west'):
            f = q[s]
            for k in range(max(f[2], f[3])): put(im, f, k if f[2] > f[3] else 0, 0 if f[2] > f[3] else k, (250, 250, 246) if k else INK)


def boy():
    im, F = load('reveal_boy')
    fc = F[('head', 0)]['north']                                          # 7x7 face
    for (x, y) in ((1, 4), (2, 5), (5, 4), (4, 5)): put(im, fc, x, y, (196, 140, 110))   # freckles
    for x in range(7):
        if x not in (2, 4): put(im, fc, x, 0, (96, 70, 44))               # a ragged fringe
    put(im, fc, 1, 1, (96, 70, 44)); put(im, fc, 5, 1, (80, 58, 36))
    put(im, fc, 3, 6, (170, 110, 96))                                     # mouth, open a little in concentration
    hand = F[('arm_r', 0)]
    put(im, hand['down'], 0, 0, INK_HAND); put(im, hand['north'], 0, 7, INK_HAND)   # ink on the writing hand
    desk(im, F, INK, (255, 196, 96), (96, 62, 36))
    return im, 'reveal_boy'


def king():
    im, F = load('reveal_king')
    fc = F[('head', 0)]['north']                                          # 8x8 face
    for x in (2, 5): put(im, fc, x, 2, (178, 132, 108))                   # lined brow
    put(im, fc, 1, 5, (182, 136, 112)); put(im, fc, 6, 5, (182, 136, 112))    # creases beside the mouth
    beard = F[('head', 11)]['north']
    for y in range(beard[3]):
        for x in range(beard[2]):
            put(im, beard, x, y, (196, 192, 186) if (x + y * 2) % 3 == 0 else (150, 146, 140) if y < 2 else (120, 116, 112))
    for k in (0, 4):                                                      # gold hem on the robe and cloak
        for s in ('north', 'south', 'east', 'west'):
            f = F[('body', k)][s] if ('body', k) in F else None
            if f: [put(im, f, x, f[3] - 1, (232, 184, 58) if x % 2 else (196, 138, 34)) for x in range(f[2])]
    for k in range(3):
        f = F[('cloak', k)]['south']
        for x in range(f[2]): put(im, f, x, f[3] - 1, (196, 138, 34) if x % 3 else (232, 184, 58))
    hand = F[('arm_r', 0)]
    put(im, hand['down'], 1, 1, INK_HAND); put(im, hand['north'], 1, 11, INK_HAND)
    desk(im, F, INK, (255, 196, 96), (96, 62, 36))
    return im, 'reveal_king'


def morvane():
    im, F = load('reveal_morvane')
    fc = F[('head', 0)]['north']
    for x in (2, 5): put(im, fc, x, 2, (110, 128, 130))                   # the same brow, gone cold
    for (x, y) in ((1, 5), (6, 5), (1, 6), (6, 6)): put(im, fc, x, y, (104, 122, 124))   # hollow cheeks
    hand = F[('arm_r', 0)]                                                # the right hand that took the splinter
    put(im, hand['down'], 1, 1, SPLINTER); put(im, hand['down'], 2, 2, SPLINTER_D)
    put(im, hand['north'], 1, 12, SPLINTER_D); put(im, hand['west'], 2, 12, SPLINTER_D)
    desk(im, F, INK_FADED, (150, 200, 255), (40, 36, 42), quill=False)    # the writing has long faded; the candle burns cold
    sw = F[('desk', 9)]                                                   # the sword where the pen lay
    for s in ('up', 'north'):
        f = sw[s]
        for x in range(f[2]): put(im, f, x, 0, (200, 230, 240) if x % 5 else (150, 190, 200))
        put(im, f, 0, 0, (96, 92, 110)); put(im, f, 1, 0, (96, 92, 110))
    return im, 'reveal_morvane'


def rank():
    im, F = load('oswin_reflection')
    helm = F[('head', 0)]['north']                                        # nobody inside: the eye slits are empty
    for x in range(1, 7):
        put(im, helm, x, 3, (20, 40, 56), keep_alpha=True)
    for x in (2, 5): put(im, helm, x, 3, (4, 10, 16), keep_alpha=True)
    for key in [k for k in F if k[0] in ('body', 'arm_r', 'arm_l', 'leg_r', 'leg_l')]:
        for s in ('north', 'south', 'east', 'west'):
            f = F[key][s]
            for x in range(f[2]): put(im, f, x, 0, (226, 244, 252), keep_alpha=True)         # rime on the top edge
    r = random.Random(11)
    for key in (('body', 0), ('body', 5), ('leg_r', 0), ('leg_l', 0)):    # faint seams of light where the plates meet
        f = F[key]['north']; x = r.randrange(1, f[2] - 1)
        for y in range(2, f[3] - 2):
            put(im, f, x, y, (236, 252, 255), keep_alpha=True)
            if r.random() < 0.3: x = max(1, min(f[2] - 2, x + r.choice((-1, 1))))
    return im, 'oswin_reflection'


out = []
for fn in (boy, king, morvane, rank):
    im, name = fn(); im.save(RP + f'textures/entity/siege/bestiary/{name}.png'); out.append(im)
sheet = Image.new('RGBA', (sum(min(256, i.width) * 2 for i in out) + 8 * (len(out) + 1), 520), (38, 34, 46, 255)); x = 8
for im in out:
    v = im.crop((0, 0, min(256, im.width), min(256, im.height))) if im.width > 128 else im
    k = 512 // max(v.width, v.height) if v.width <= 128 else 2
    v = v.resize((v.width * k // (1 if v.width <= 128 else 1), v.height * k), Image.NEAREST) if v.width <= 128 else v.resize((v.width * 2, v.height * 2), Image.NEAREST)
    sheet.alpha_composite(v.crop((0, 0, min(v.width, 512), min(v.height, 512))), (x, 4)); x += min(v.width, 512) + 8
os.makedirs(ROOT + 'art', exist_ok=True)
sheet.crop((0, 0, x, 520)).save(ROOT + 'art/reveal-scene.png'); print('ok')
