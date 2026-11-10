"""Pretender boss skins (mobs thread's pull request #30) and the Claimant's Seal icon.
Painted from each box-UV geo, so rerun after a model change:   python3 build_pretenders.py [repo root]
Blade: dark plate, half a home-made crown, a Hollow vein up the breastplate. Seer: hooded robe, hanging shards, staff.
Brute: grey hide, horns, veined stone on the shoulders, axe. Sheet: art/pretenders.png
"""
import json, os, sys, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
import skinlib
from geoskin import faces
ROOT = (sys.argv[1] if len(sys.argv) > 1 else '/mnt/project-files/siege-nights').rstrip('/') + '/'
RP = ROOT + 'Siege_Nights_RP/'
VEIN = (232, 88, 204); VEIN_D = (150, 40, 140); VEIN_H = (255, 190, 240); BLUE = (170, 204, 244); DARK = (12, 8, 16)
def P_(c, style='plain'): return {'c': c, 'style': style}
BASE = dict(hstone=P_((58, 40, 82), 'stone'), hvein=P_(VEIN, 'glow'), hgem=P_(BLUE, 'glow'), trim=P_((92, 62, 120), 'metal'),
            steel=P_((158, 148, 186), 'metal'), eye=(240, 90, 210))

def put(im, rect, x, y, c):
    x0, y0, w, h = rect
    if 0 <= x < w and 0 <= y < h and 0 <= x0 + x < im.width and 0 <= y0 + y < im.height: im.putpixel((x0 + x, y0 + y), tuple(c) + (255,))
def shade(im, rect, x, y, k):
    x0, y0, w, h = rect
    if 0 <= x < w and 0 <= y < h:
        r, g, b, a = im.getpixel((x0 + x, y0 + y)); im.putpixel((x0 + x, y0 + y), (min(255, int(r * k)), min(255, int(g * k)), min(255, int(b * k)), a))
def vein(im, rect, seed, n=2, up=True, col=VEIN, glow=True):
    """Root-like veins climbing a face, with a bright node and a dim halo so they read as lit from inside."""
    x0, y0, w, h = rect; r = random.Random(seed)
    for _ in range(n):
        x = r.randrange(1, max(2, w - 1)); y = h - 1 if up else 0; L = r.randrange(max(2, h // 2), max(3, h - 1)); pts = []
        for _ in range(L):
            pts.append((x, y)); y += -1 if up else 1; x += r.choice((-1, 0, 0, 1))
        for (px, py) in pts:
            if glow:
                for dx in (-1, 1): shade(im, rect, px + dx, py, 0.8)
        for (px, py) in pts: put(im, rect, px, py, col)
        if pts: put(im, rect, *pts[len(pts) // 2], VEIN_H)
def tatter(im, rect, seed, depth=3):
    x0, y0, w, h = rect; r = random.Random(seed)
    for x in range(w):
        for k in range(r.randrange(0, depth + 1)):
            if 0 <= y0 + h - 1 - k < im.height: im.putpixel((x0 + x, y0 + h - 1 - k), (0, 0, 0, 0))

def paint(name, pal, mats, extra):
    g = json.load(open(RP + f'models/entity/bestiary/{name}.geo.json'))['minecraft:geometry'][0]
    W, H = g['description']['texture_width'], g['description']['texture_height']
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); todo = []
    for b in g['bones']:
        for i, c in enumerate(b.get('cubes', [])):
            m = mats.get((b['name'], i), mats.get(b['name'], 'main')); face = None
            if isinstance(m, tuple): m, face = m
            fr = faces(c)
            for f, (x0, y0, w, h) in fr.items():
                for y in range(h):
                    for x in range(w):
                        if 0 <= x0 + x < W and 0 <= y0 + y < H: im.putpixel((x0 + x, y0 + y), skinlib.paint(None, pal, m, face, f, x, y, w, h))
            todo.append((b['name'], i, fr))
    for nm, i, fr in todo: extra(im, nm, i, fr)
    im.save(RP + f'textures/entity/siege/bestiary/{name}.png'); return im

def blade():
    pal = dict(BASE, main=P_((62, 54, 82), 'metal'), under=P_((34, 28, 46), 'cloth'), cape=P_((74, 30, 100), 'cloth'), grip=P_((40, 28, 36), 'cloth'))
    mats = {('body', 1): 'under', ('body', 4): 'trim', ('body', 5): 'hvein', ('head', 1): 'hstone', ('head', 2): 'hstone', ('head', 3): 'hstone',
            ('head', 4): 'hstone', ('head', 5): 'hstone', ('head', 6): 'hvein', 'cloak': 'cape', 'blade': 'steel', ('blade', 0): 'grip',
            ('blade', 1): 'trim', ('blade', 2): 'trim', ('blade', 3): 'trim', ('blade', 4): 'trim', ('arm_r', 1): 'trim', ('arm_l', 1): 'trim'}
    def extra(im, nm, i, fr):
        if nm == 'head' and i == 0:                                   # closed helm: a T-shaped slit with one lit eye
            f = fr['north']
            for x in range(1, 7): put(im, f, x, 3, DARK)
            for y in range(4, 7): put(im, f, 3, y, DARK); put(im, f, 4, y, DARK)
            put(im, f, 5, 3, pal['eye']); put(im, f, 2, 3, VEIN_D)
            for x in range(8): shade(im, f, x, 2, 1.25)
            for s in ('east', 'west'):
                for y in (5, 6): put(im, fr[s], 2, y, DARK); put(im, fr[s], 4, y, DARK)   # breaths
        if nm == 'head' and i == 1:
            for s in ('north', 'east'): vein(im, fr[s], 5, 1)
            f = fr['south']
            for x in range(f[2] // 2, f[2]): shade(im, f, x, 0, 0.55)                     # the unfinished half
        if nm == 'body' and i == 0:
            f = fr['north']
            for y in range(1, 6): shade(im, f, 0, y, 1.2); shade(im, f, f[2] - 1, y, 0.75)
            for x in range(1, f[2] - 1): shade(im, f, x, 6, 0.7)                           # under the breastplate
            vein(im, f, 71, 3); vein(im, fr['south'], 72, 1)
            for (x, y) in ((1, 9), (7, 10), (2, 12)): shade(im, f, x, y, 0.6)             # dents
        if nm == 'body' and i in (2, 3): vein(im, fr['north'], 80 + i, 1)
        if nm.startswith('arm') and i == 3: vein(im, fr['up'], 90 + len(nm) + (1 if nm == 'arm_l' else 0), 1, glow=False); vein(im, fr['north'], 93, 1)
        if nm.startswith('leg'):
            f = fr['north']
            for x in range(f[2]): shade(im, f, x, 5, 1.3); shade(im, f, x, 6, 0.7)        # knee plate
            if nm == 'leg_l': vein(im, f, 97, 1)
        if nm == 'cloak' and i < 3:
            for s in ('north', 'south'):
                f = fr[s]
                for x in range(f[2]):
                    put(im, f, x, 0, (120, 70, 150)) if i == 0 else None
                if i == 2: tatter(im, f, 40 + len(s))
        if nm == 'blade' and i == 5:
            for s in ('east', 'west', 'up'):
                f = fr[s]; w, h = f[2], f[3]
                for k in range(max(w, h)):
                    if w > h: put(im, f, k, h // 2, (96, 84, 124)) if k % 7 != 3 else put(im, f, k, h // 2, VEIN)   # fuller with vein flecks
                    else: put(im, f, w // 2, k, (96, 84, 124)) if k % 7 != 3 else put(im, f, w // 2, k, VEIN)
    return paint('pretender_blade', pal, mats, extra)

def seer():
    pal = dict(BASE, main=P_((50, 38, 74), 'cloth'), skin=P_((196, 190, 206)), hood=P_((36, 26, 56), 'cloth'), inner=P_((16, 10, 24)), eye=(150, 200, 255))
    mats = {('body', 1): 'skin', ('body', 4): 'trim', ('body', 6): 'hvein', ('head', 0): ('skin', 'eyes'), ('head', 1): 'skin', ('head', 2): 'hood',
            ('head', 3): 'hood', ('head', 4): 'hood', 'cloak': 'hood', 'shards': 'hgem', 'blade': 'trim', ('blade', 2): 'hvein', ('blade', 3): 'hgem', ('blade', 4): 'hgem'}
    def extra(im, nm, i, fr):
        if nm == 'head' and i == 0:                                   # face lost in the hood's shadow, eyes still lit
            f = fr['north']
            for y in range(8):
                for x in range(8):
                    c = im.getpixel((f[0] + x, f[1] + y))
                    if c[:3] != tuple(pal['eye']): shade(im, f, x, y, 0.45 if y < 3 else 0.7)
            for x in (2, 5): put(im, f, x, 6, (120, 112, 136))                              # thin mouth
            for s in ('east', 'west', 'south', 'up'):
                g = fr[s]
                for y in range(g[3]):
                    for x in range(g[2]): shade(im, g, x, y, 0.5)
        if nm == 'head' and i == 2:
            f = fr['north']
            for y in range(2, f[3]):
                for x in range(1, f[2] - 1): put(im, f, x, y, (14, 9, 22))                  # open front of the hood
            for s in ('east', 'west', 'south'):
                for x in range(fr[s][2]): put(im, fr[s], x, fr[s][3] - 1, (86, 62, 120))    # hem stitching
        if nm == 'body' and i in (0, 5):
            for s in ('north', 'south'):
                f = fr[s]
                for y in range(f[3]): shade(im, f, f[2] // 2, y, 0.7)                        # robe opening
                if i == 5:
                    tatter(im, f, 60 + len(s), 2)
                    for x in range(0, f[2], 2): put(im, f, x, f[3] - 4, (86, 62, 120))       # embroidered band
            if i == 0: vein(im, fr['north'], 55, 2, col=(120, 150, 230))
        if nm.startswith('arm') and i == 3:
            for s in ('north', 'south', 'east', 'west'):
                for x in range(fr[s][2]): put(im, fr[s], x, fr[s][3] - 1, (86, 62, 120))    # sleeve cuff
        if nm == 'cloak' and i == 2:
            for s in ('north', 'south'): tatter(im, fr[s], 30 + len(s))
        if nm == 'shards':
            for s in ('north', 'south', 'east', 'west'): put(im, fr[s], 0, 0, (244, 250, 255)); put(im, fr[s], 0, 2, (96, 120, 190))
        if nm == 'blade' and i == 0:
            for s in ('north', 'south', 'east', 'west'):
                for y in range(4, 30, 6): put(im, fr[s], 0, y, (60, 40, 84))                 # bindings on the staff
    return paint('pretender_seer', pal, mats, extra)

def brute():
    pal = dict(BASE, main=P_((70, 56, 66), 'fur'), skin=P_((132, 126, 136)), horn=P_((66, 50, 86), 'bone'), haft=P_((48, 34, 40), 'wood'), eye=(240, 90, 210))
    mats = {('body', 1): 'skin', ('body', 4): 'trim', ('body', 5): 'trim', ('head', 0): ('skin', 'low'), ('head', 1): 'skin', ('head', 8): 'hstone', ('head', 9): 'hvein',
            'arm_r': 'skin', 'arm_l': 'skin', ('arm_r', 3): 'hstone', ('arm_l', 3): 'hstone', ('arm_r', 1): 'trim', ('arm_l', 1): 'trim',
            'blade': 'steel', ('blade', 0): 'haft'}
    for k in (2, 3, 4, 5, 6, 7): mats[('head', k)] = 'horn'
    def extra(im, nm, i, fr):
        if nm == 'head' and i == 0:
            f = fr['north']
            for x in range(8): shade(im, f, x, 2, 0.6)                                       # heavy brow
            for x in range(1, 7): put(im, f, x, 7, (70, 62, 76))
            for x in (1, 6): put(im, f, x, 6, (226, 220, 210))                               # tusks
            for (x, y) in ((6, 1), (5, 2), (5, 3)): put(im, f, x, y, VEIN_D)                 # a crack where the stone has got in
        if nm == 'head' and i in (3, 6):
            for s in ('north', 'south', 'east', 'west'):
                for y in range(1, fr[s][3], 2): shade(im, fr[s], 0, y, 0.7); shade(im, fr[s], 1, y, 0.7)   # horn rings
        if nm == 'body' and i == 0:
            f = fr['north']
            for (a, b) in (((3, 3), (8, 9)), ((9, 2), (11, 6))):                             # old scars across the chest
                n = max(abs(b[0] - a[0]), abs(b[1] - a[1]))
                for k in range(n + 1): put(im, f, a[0] + (b[0] - a[0]) * k // n, a[1] + (b[1] - a[1]) * k // n, (150, 120, 130))
            vein(im, f, 41, 2); vein(im, fr['south'], 42, 2)
        if nm.startswith('arm') and i == 3:
            for s in ('up', 'north', 'south', 'east', 'west'): vein(im, fr[s], 20 + len(s) + (7 if nm == 'arm_l' else 0), 2, up=(s != 'up'))
        if nm.startswith('arm') and i == 0:
            f = fr['north']
            vein(im, f, 33 + (1 if nm == 'arm_l' else 0), 1, up=False, col=VEIN_D, glow=False)  # the stone creeping down the arm
            for x in range(f[2]): shade(im, f, x, f[3] - 3, 0.75)                             # knuckles
        if nm.startswith('leg'):
            for s in ('north', 'south', 'east', 'west'): tatter(im, fr[s], 50 + len(s) + len(nm), 0)
            f = fr['north']
            for x in range(1, f[2] - 1, 2): put(im, f, x, 0, (104, 86, 96))                   # ragged top of the hide wraps
        if nm == 'blade' and i == 1:
            for s in ('east', 'west'):
                f = fr[s]
                for y in range(f[3]): put(im, f, f[2] - 1, y, (220, 214, 236))               # ground edge
                put(im, f, 1, 1, VEIN)
    return paint('pretender_brute', pal, mats, extra)

def seal():
    wax = [(44, 14, 60), (80, 26, 104), (122, 44, 150), (160, 70, 190), (196, 112, 220), (230, 170, 244)]
    rows = ["................", ".....oooooo.....", "...ooMLLLLMoo...", "..oMLLLHHLLLMo..", ".oMLL......LLMo.", ".oML.D.DD.D.LMo.", "oMLL.DDDDDDD.LDo", "oMLL.DMMMMMD.MDo",
            "oMML.DDDDDDD.MDo", "oMML.........MDo", ".oMML.......MDo.", ".oDMMMLLLMMMDDo.", "..oDDMMMMMDDDo..", "...ooDDDDDDoo...", ".....oooooo..o..", "............oMo."]
    key = {'o': 0, 'D': 1, 'M': 3, 'L': 4, 'H': 5, '.': None}
    im = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if 4 <= y <= 9 and 4 <= x <= 12 and ch == '.': im.putpixel((x, y), wax[2] + (255,))   # pressed field
            elif key[ch] is not None: im.putpixel((x, y), wax[key[ch]] + (255,))
    im.putpixel((9, 5), wax[2] + (255,)); im.putpixel((10, 4), wax[1] + (255,))                   # the crown's fourth point leans: crooked
    os.makedirs(RP + 'textures/items/bestiary', exist_ok=True); im.save(RP + 'textures/items/bestiary/pretender_seal.png'); return im

if __name__ == '__main__':
    ims = [blade(), seer(), brute()]; s = seal()
    sh = Image.new('RGBA', (3 * 392 + 8, 392 + 112), (38, 34, 46, 255))
    for i, im in enumerate(ims): sh.alpha_composite(im.resize((384, 384), Image.NEAREST), (8 + i * 392, 8))
    sh.alpha_composite(s.resize((96, 96), Image.NEAREST), (8, 400)); sh.save(ROOT + 'art/pretenders.png'); print('ok')
