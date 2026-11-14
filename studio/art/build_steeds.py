"""Steed coats in the vanilla horse2 layout (64x64, geometry.horse.v2 from studio/vmobs/geo_horse_v2.json):
five regional breeds, the crossbred piebald, the Glimstrider, two overlay layers (Knight Warhorse barding, caparison),
and the five regional starter cobs every new rider is given (plain working coats under a saddle blanket in the region's cloth).
python3 build_steeds.py [repo root]      Sheet: art/steeds.png
Not wired: the horses thread adds the paths to entity/steed.entity.json."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from skinlib import _h, ramp_of
ROOT = (sys.argv[1] if len(sys.argv) > 1 else '/mnt/project-files/siege-nights').rstrip('/') + '/'
OUT = ROOT + 'Siege_Nights_RP/textures/entity/siege/'
GEO = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'vmobs', 'geo_horse_v2.json')))['geometry.horse.v2']
ORDER = ['Body', 'TailA', 'Leg1A', 'Neck', 'Head', 'UMouth', 'Ear1', 'Mane']
def faces(c):
    (u, v), (w, h, d) = [int(x) for x in c['uv']], [int(x) for x in c['size']]
    return {'up': (u + d, v, w, d), 'down': (u + d + w, v, w, d), 'east': (u, v + d, d, h), 'north': (u + d, v + d, w, h),
            'west': (u + d + w, v + d, d, h), 'south': (u + 2 * d + w, v + d, w, h)}
BONES = {b['name']: faces(b['cubes'][0]) for b in GEO['bones'] if b['name'] in ORDER}

def coat(name, base, mane, sock=None, blaze=False, dapple=None, patches=None, feather=False, shaggy=False, hoof=(40, 34, 30), alpha=255, eye=(24, 18, 16), blanket=None):
    R = ramp_of(base); M = ramp_of(mane); S = ramp_of(sock) if sock else None; D = ramp_of(dapple) if dapple else None; Pt = ramp_of(patches) if patches else None
    im = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    def put(r, x, y, c, a=None):
        if 0 <= x < r[2] and 0 <= y < r[3] and r[0] + x < 64 and r[1] + y < 64: im.putpixel((r[0] + x, r[1] + y), tuple(c[:3]) + (alpha if a is None else a,))
    for bn in ORDER:
        for f, r in BONES[bn].items():
            x0, y0, w, h = r; side = f not in ('up', 'down')
            for y in range(h):
                for x in range(w):
                    t = 4 if f == 'up' else 2 if f == 'down' else 3
                    if side and y == 0: t += 1
                    if side and y >= h - 2 and bn == 'Body': t -= 1                       # belly shadow
                    k = _h(x // 2, y // 2, len(name) * 13 + len(bn))
                    if shaggy: t += -1 if _h(x, y // 3, 5) < 0.3 else 0
                    elif k < 0.10: t -= 1
                    rp = R
                    if bn in ('TailA', 'Mane'):
                        rp = M; t = 3 + (1 if x == 0 else 0) - (1 if (y + x) % 4 == 3 else 0)
                    elif Pt and bn in ('Body', 'Neck', 'Head') and _h((x0 + x) // 5, (y0 + y) // 5, 91) < 0.42: rp = Pt     # piebald patches
                    elif D and bn in ('Body', 'Neck') and side and ((x + (y // 2) * 2) % 5 == 2 and y % 3 == 1): rp = D; t += 1   # dapples
                    if bn == 'Leg1A' and side:
                        if S and y >= (4 if feather else 6): rp = S                         # socks or feathered legs
                        if feather and y >= 7 and x in (0, w - 1): t += 1
                        if y >= h - 2: rp = ramp_of(hoof); t = 2 if y == h - 1 else 3
                    if bn == 'Leg1A' and f == 'down': rp = ramp_of(hoof); t = 1
                    c = rp[max(0, min(5, t))]
                    if blanket and bn == 'Body' and f != 'down':
                        b = blanket_px(blanket, f, x, y, w, h)
                        if b: c = b
                    put(r, x, y, c)
    Hd, Mu, Er = BONES['Head'], BONES['UMouth'], BONES['Ear1']
    for f in ('east', 'west'):                                                            # eyes on the sides of the head
        r = Hd[f]; ex = 2 if f == 'west' else r[2] - 3
        put(r, ex, 1, eye); put(r, ex + (1 if f == 'east' else -1), 1, tuple(min(255, v + 60) for v in R[1]))
    for x in (0, 3): put(Mu['north'], x, 1, R[0])                                         # nostrils
    for x in range(4): put(Mu['north'], x, 4, R[1])
    for f in ('north', 'south'):
        for y in range(1, 3): put(Er[f], 0 if f == 'north' else 1, y, tuple(max(0, v - 50) for v in R[2]))   # inner ear
    if blaze:
        W = (240, 236, 226)
        for y in range(5): put(Hd['north'], 2, y, W); put(Hd['north'], 3, y, W)
        for y in range(3): put(Mu['north'], 1, y, W); put(Mu['north'], 2, y, W)
        for z in range(2, 7): put(Hd['up'], 2, z, W); put(Hd['up'], 3, z, W)
    os.makedirs(OUT, exist_ok=True); im.save(OUT + f'steed_{name}.png'); return im

def blanket_px(spec, f, x, y, w, h):
    """A working saddle blanket over the middle of the back: spec = (cloth, second colour, pattern)."""
    cloth, second, pattern = spec
    if f == 'up': u, v, inside = x, y, 6 <= y <= 15                       # across the back (10 wide, 22 long)
    elif f in ('east', 'west'): u, v, inside = x, y, 6 <= x <= 15 and y <= 6   # hanging down each flank
    else: return None
    if not inside: return None
    edge = (f == 'up' and y in (6, 15)) or (f != 'up' and (x in (6, 15) or y == 6))
    if edge: return tuple(max(0, c - 40) for c in cloth)                   # bound edge
    k = v if f != 'up' else u
    if pattern == 'check': pick = second if ((u // 2) + (v // 2)) % 2 else cloth
    elif pattern == 'stripe': pick = second if k % 4 == 1 else cloth
    elif pattern == 'zigzag': pick = second if (v + abs((u % 4) - 2)) % 4 == 0 else cloth
    else: pick = second if _h(u, v, 17) < 0.25 else cloth                  # sacking: a rough weave
    return tuple(pick)

def overlay(name, rules):
    """rules: {bone: fn(face, x, y, w, h) -> colour or None}"""
    im = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    for bn in ORDER:
        fn = rules.get(bn)
        if not fn: continue
        for f, r in BONES[bn].items():
            for y in range(r[3]):
                for x in range(r[2]):
                    c = fn(f, x, y, r[2], r[3])
                    if c and r[0] + x < 64 and r[1] + y < 64: im.putpixel((r[0] + x, r[1] + y), tuple(c) + (255,))
    im.save(OUT + f'steed_{name}.png'); return im

ims = [
 ('Vale Courser', coat('vale', (164, 84, 40), (60, 34, 22), sock=(236, 230, 218), blaze=True)),
 ('Frostmarch Destrier', coat('frostmarch', (206, 208, 214), (150, 152, 162), sock=(244, 244, 248), feather=True, hoof=(70, 68, 72))),
 ('Saltreach Runner', coat('saltreach', (150, 156, 166), (222, 226, 222), dapple=(196, 202, 210), hoof=(54, 52, 56))),
 ('Emberwaste Sandstrider', coat('emberwaste', (214, 180, 112), (240, 226, 190), sock=(70, 50, 34), hoof=(60, 44, 30))),
 ('Blackfen Mire-Pony', coat('blackfen', (48, 38, 34), (24, 20, 20), shaggy=True, feather=True, sock=(66, 54, 46), hoof=(20, 18, 18))),
 ('Crossbred', coat('crossbred', (120, 74, 44), (40, 30, 26), patches=(236, 230, 218), sock=(236, 230, 218))),
 ('Vale Plough-Cob', coat('cob_vale', (122, 82, 52), (52, 36, 26), sock=(96, 66, 44), blanket=((70, 112, 58), (222, 210, 172), 'check'))),
 ('Frostmarch Sledge-Cob', coat('cob_frostmarch', (150, 136, 116), (70, 62, 54), sock=(214, 208, 196), feather=True, shaggy=True, blanket=((168, 44, 40), (232, 228, 220), 'stripe'))),
 ('Saltreach Cart-Cob', coat('cob_saltreach', (112, 108, 104), (190, 186, 176), hoof=(54, 52, 56), blanket=((44, 62, 104), (226, 222, 210), 'stripe'))),
 ('Emberwaste Pack-Cob', coat('cob_emberwaste', (176, 142, 98), (86, 62, 40), sock=(120, 90, 60), blanket=((196, 112, 40), (88, 40, 28), 'zigzag'))),
 ('Blackfen Peat-Cob', coat('cob_blackfen', (70, 56, 44), (36, 30, 26), feather=True, shaggy=True, sock=(84, 70, 56), hoof=(24, 20, 18), blanket=((88, 100, 56), (122, 96, 62), 'sack'))),
 ('Glimstrider', coat('hollow', (176, 206, 240), (236, 246, 255), alpha=170, eye=(10, 8, 20), hoof=(120, 150, 200), dapple=(226, 240, 255))),
]
ST = ramp_of((150, 154, 168)); GD = ramp_of((204, 164, 60))
def plate(f, x, y, w, h, keep=True):
    if not keep: return None
    t = 3 + (1 if y == 0 or x == 0 else 0) - (1 if y == h - 1 or x == w - 1 else 0)
    if (x + y) % 7 == 0 and t == 3: t = 4
    return ST[t]
ims.append(('Knight Warhorse barding', overlay('warhorse', {
    'Head': lambda f, x, y, w, h: (GD[4] if (f == 'north' and x in (2, 3) and y == 0) else plate(f, x, y, w, h, f in ('north', 'up') or (f in ('east', 'west') and y == 0))),      # chamfron
    'UMouth': lambda f, x, y, w, h: plate(f, x, y, w, h, f in ('north', 'up') and y < 3),
    'Neck': lambda f, x, y, w, h: (GD[3] if f != 'down' and y % 4 == 3 and f in ('east', 'west') else plate(f, x, y % 4, w, 4, f in ('north', 'east', 'west') and y < 11)),      # crinet lames
    'Body': lambda f, x, y, w, h: (GD[3] if (f == 'north' and y == h - 3) else plate(f, x, y, w, h, f == 'north' or (f in ('east', 'west') and (x < 5 if f == 'west' else x >= w - 5) and y < 8))),  # peytral
})))
CL = ramp_of((236, 234, 228))
def cloth(f, x, y, w, h, keep=True):
    if not keep: return None
    t = 3 + (1 if y == 0 else 0) - (1 if x % 4 == 3 else 0)
    if y == h - 1: t = 1                                                                                         # hem
    if y == h - 2 and x % 2 == 0: t = 5                                                                           # dagged edge
    return CL[t]
ims.append(('Caparison (tinted by the banner)', overlay('caparison', {
    'Body': lambda f, x, y, w, h: cloth(f, x, y, w, h, f != 'down'),
    'Neck': lambda f, x, y, w, h: cloth(f, x, y, w, h, f in ('east', 'west', 'north') and y >= 4),
    'Head': lambda f, x, y, w, h: cloth(f, x, y, w, h, f == 'up' or (f in ('east', 'west') and y == 0)),
})))
sh = Image.new('RGBA', (5 * 200 + 8, 3 * 200 + 8), (88, 92, 100, 255))
for i, (n, im) in enumerate(ims): sh.alpha_composite(im.resize((192, 192), Image.NEAREST), (8 + (i % 5) * 200, 8 + (i // 5) * 200))
sh.save(ROOT + 'art/steeds.png'); print('ok', len(ims))
