"""3D worn models for every custom armour set (Mateo 2026-11-11: "make every armor's texture 3D").

Same idea as studio/build_varmor.py does for vanilla iron, diamond, netherite and chainmail: each set gets its own
geometry per piece (the normal armour boxes plus raised parts: brims, crests, pauldrons, tabard flaps, capes, fur,
knee guards) and one 128x64 texture. The left half of the texture is the set's existing flat sheets pasted in
(layer 1 on top, layer 2 below), so the painted look stays exactly as it is; the 3D parts are painted on the right
half from the same colour ramps.

Sets: the Castle Guard armour, the five regional Castle Guard sets in iron, diamond and netherite, and the two worn
relics (Crownless Mantle, Widow's Veil). Choirsteel is built by studio/art/build_choirsteel_3d.py (PR #83); the
guard-only armour line already has its own 3D models (studio/build_guardgear.py).

Guard sets keep the leather-dye trick (material armor_leather): alpha 255 = grey cloth that takes the banner colour,
alpha 1 = keeps its own colour. So the 3D tabard flaps and capes take the banner colour too.

    python3 studio/art/build_armor3d.py [repo root]

Writes textures/models/siege_armor/<set>.png, models/entity/armor/<set>_<piece>.geo.json and repoints
attachables/<set>_<piece>.json (relics: attachables/bestiary_<relic>.json). Rerun after the flat sheets change.
"""
import json, os, random, sys
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from palette import M, REGIONS, fixed

ROOT = (sys.argv[1].rstrip('/') + '/') if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) + '/'
RP = ROOT + 'Siege_Nights_RP/'
FLAT = RP + 'textures/models/armor/'

# ---- colour ramps (the same ones studio/art/build_regional_guard.py paints the flat sheets with)
CLOTH = M['cloth']
FUR = fixed('#8a8580', '#b4aea6', '#d2ccc2', '#e8e3da', '#f4f1ea', '#fdfcf8')
PALE = fixed('#4a5560', '#7a8690', '#a9b3b8', '#cdd3d2', '#e4e6df', '#f6f5ee')
FENLEATHER = fixed('#1a1a12', '#2c2b1c', '#423f28', '#5a5536', '#726b45', '#8a8258')
BONE = M['parchment']
DIAMOND = fixed('#0f3a3d', '#1b6b6e', '#2aa3a3', '#4fd3cf', '#8ef0e8', '#d4fffb')
NETHERITE = fixed('#1c1719', '#2b2427', '#3d3437', '#4f4548', '#665a5c', '#7f7275')
def dim(r, k): return [r[max(0, i - k)] for i in range(6)]
RAMPS = {   # metal, trim, leather/rope
    'guard': (M['steel'], M['gold'], M['leather']),
    'vale': (M['steel'], M['gold'], M['leather']),
    'frostmarch': (M['steel'], REGIONS['frostmarch']['accent'], M['spruce']),
    'saltreach': (PALE, dim(REGIONS['saltreach']['accent'], 1), M['rope']),
    'emberwaste': (M['blacksteel'], M['ember'], M['leather']),
    'blackfen': (FENLEATHER, dim(REGIONS['blackfen']['accent'], 2), M['rope']),
}

rnd = random.Random(31)

# ---- geometry
def cube(o, s, uv=None, inf=0, mir=False):
    c = {"origin": o, "size": s}
    if uv: c["uv"] = uv
    if inf: c["inflate"] = inf
    if mir: c["mirror"] = True
    return c
PIV = {"head": [0, 24, 0], "body": [0, 24, 0], "rightArm": [-5, 22, 0], "leftArm": [5, 22, 0], "rightLeg": [-1.9, 12, 0], "leftLeg": [1.9, 12, 0]}
BASE = {
    "helmet": {"head": [cube([-4, 24, -4], [8, 8, 8], [0, 0], 1)]},
    "chestplate": {"body": [cube([-4, 12, -2], [8, 12, 4], [16, 16], 1.01)],
                   "rightArm": [cube([-8, 12, -2], [4, 12, 4], [40, 16], 1)], "leftArm": [cube([4, 12, -2], [4, 12, 4], [40, 16], 1, True)]},
    "leggings": {"body": [cube([-4, 12, -2], [8, 12, 4], [16, 48], 0.5)],
                 "rightLeg": [cube([-3.9, 0, -2], [4, 12, 4], [0, 48], 0.5)], "leftLeg": [cube([-0.1, 0, -2], [4, 12, 4], [0, 48], 0.5, True)]},
    "boots": {"rightLeg": [cube([-3.9, 0, -2], [4, 12, 4], [0, 16], 1)], "leftLeg": [cube([-0.1, 0, -2], [4, 12, 4], [0, 16], 1, True)]},
}
def geo(ident, bones):
    return {"format_version": "1.12.0", "minecraft:geometry": [{"description": {"identifier": ident, "texture_width": 128, "texture_height": 64,
            "visible_bounds_width": 3, "visible_bounds_height": 3.5, "visible_bounds_offset": [0, 1.5, 0]},
            "bones": [{"name": n, "pivot": PIV[n], "cubes": cs} for n, cs in bones.items()]}]}

def faces(u, v, w, h, d):
    return {"up": (u + d, v, w, d), "down": (u + d + w, v, w, d), "east": (u, v + d, d, h), "north": (u + d, v + d, w, h),
            "west": (u + d + w, v + d, d, h), "south": (u + 2 * d + w, v + d, w, h)}
def border(x, y, w, h): return x == 0 or y == 0 or x == w - 1 or y == h - 1

# ---- surface patterns: tone 0..5 for pixel x, y of a w x h face (f = face name)
def p_plate(f, x, y, w, h):
    if f == 'up': return 4
    if f == 'down': return 1
    v = 3 + (1 if y == 0 or x == 0 else 0) - (1 if x == w - 1 or y == h - 1 else 0)
    if (x * 5 + y * 3) % 11 == 0 and v == 3: v += 1
    return v
def p_scale(f, x, y, w, h):
    r = y // 2; c = (x + r % 2) % 3
    if y % 2 == 0: return 4 if c == 1 else 3
    return 1 if c != 1 else 2
def p_lam(f, x, y, w, h):
    if y % 4 == 3: return -1
    return (3 if x % 2 == 0 else 2) + (1 if y % 4 == 0 else 0)
def p_fur(f, x, y, w, h): return rnd.choice((2, 3, 3, 4, 4, 5)) - (1 if f == 'down' else 0)
def p_leather(f, x, y, w, h): return 3 - (1 if x == w - 1 else 0) + (1 if y == 0 else 0) - ((x * 3 + y * 5) % 9 == 0)
def p_cloth(f, x, y, w, h): return 3 + (1 if x == 0 and f in ('north', 'south') else 0) - (1 if f == 'down' else 0) + (1 if (x + 2 * y) % 7 == 0 else 0)
def p_flat(t): return lambda f, x, y, w, h: t

class Style:
    """How to paint one 3D part. ramp = 6 colours; cloth=True paints alpha 255 so the banner dye tints it.
    trim: (ramp, rule) where rule(f, x, y, w, h) says which pixels take the trim colour instead."""
    def __init__(s, ramp, pat, cloth=False, trim=None, dots=None):
        s.ramp, s.pat, s.cloth, s.trim, s.dots = ramp, pat, cloth, trim, dots or []
    def px(s, f, x, y, w, h, alpha_cloth):
        for ramp, rule, tone in s.dots:
            if rule(f, x, y, w, h): return tuple(ramp[tone]) + (1 if alpha_cloth else 255,)
        if s.trim and s.trim[1](f, x, y, w, h):
            t = s.trim[0]; return tuple(t[4 if f == 'up' or y == 0 else 3]) + (1 if alpha_cloth else 255,)
        v = s.pat(f, x, y, w, h)
        if v == -1: return tuple((s.trim[0] if s.trim else s.ramp)[3]) + (1 if alpha_cloth else 255,)
        v = max(0, min(5, v))
        if s.cloth: return tuple(CLOTH[v]) + (255,)
        return tuple(s.ramp[v]) + (1 if alpha_cloth else 255,)

def hem(f, x, y, w, h): return f in ('north', 'south', 'east', 'west') and y == h - 1
def edge_side(f, x, y, w, h): return f not in ('up', 'down') and y == h - 1
def rim(f, x, y, w, h): return (f == 'up' and border(x, y, w, h)) or (f not in ('up', 'down') and y == h - 1)


# ---- the 3D parts of each set: piece -> list of (bone, origin, size, style key, mirror)
def guard_parts(reg, tier):
    met, trim, lea = RAMPS[reg]
    if tier == 'diamond': met = DIAMOND
    if tier == 'netherite':
        met = NETHERITE
        if reg == 'emberwaste': trim = M['gold']
    S = {}
    S['plate'] = Style(met, p_plate)
    S['plate_trim'] = Style(met, p_plate, trim=(trim, rim))
    S['flap'] = Style(CLOTH, p_cloth, cloth=True, trim=(trim, hem))
    S['cape'] = Style(CLOTH, p_cloth, cloth=True, trim=(trim, lambda f, x, y, w, h: f == 'south' and (x in (0, w - 1) or y == h - 1)))
    S['knee'] = Style(met, p_plate, dots=[(trim, lambda f, x, y, w, h: f == 'north' and (x, y) == (w // 2, 1), 4)])
    S['lame'] = Style(met, p_plate, trim=(trim, edge_side))
    P = {'helmet': [], 'chestplate': [], 'leggings': [], 'boots': []}
    def add(piece, bone, o, s, key, mirror_bone=None, mo=None):
        P[piece].append((bone, o, s, key, False))
        if mirror_bone: P[piece].append((mirror_bone, mo, s, key, True))
    narrow = reg == 'emberwaste'
    # every guard set: a tabard skirt front and back below the belt, in the banner colour
    fw = 2 if narrow else 6
    add('chestplate', 'body', [-fw / 2, 4, -3.6], [fw, 8, 1], 'flap')
    add('chestplate', 'body', [-fw / 2, 4, 2.6], [fw, 8, 1], 'flap')
    if reg == 'guard':          # ridged helm, plain steel pauldrons with a gold edge
        add('helmet', 'head', [-0.5, 33, -4], [1, 2, 8], 'plate_trim')
        add('chestplate', 'rightArm', [-10, 21.5, -3.5], [6, 4, 7], 'plate_trim', 'leftArm', [4, 21.5, -3.5])
    elif reg == 'vale':         # kettle hat brim with brass rivets, riveted leather pauldrons, steel toe caps
        S['brim'] = Style(met, p_plate, dots=[(trim, lambda f, x, y, w, h: f == 'up' and border(x, y, w, h) and (x + y) % 3 == 0, 4)])
        S['pad'] = Style(lea, p_leather, dots=[(trim, lambda f, x, y, w, h: f != 'down' and x % 3 == 1 and y % 3 == 1, 4)])
        add('helmet', 'head', [-6.5, 29.5, -6.5], [13, 1, 13], 'brim')
        add('chestplate', 'rightArm', [-9.5, 22.5, -3.5], [5, 3, 7], 'pad', 'leftArm', [4.5, 22.5, -3.5])
        add('boots', 'rightLeg', [-4.4, -1, -4], [4, 2, 1], 'plate', 'leftLeg', [0.4, -1, -4])
    elif reg == 'frostmarch':   # fur ruff round the helm, spangenhelm spike, fur shoulder pads, fur boot cuffs
        S['fur'] = Style(FUR, p_fur)
        add('helmet', 'head', [-5.5, 22.5, -5.5], [11, 2, 11], 'fur')
        add('helmet', 'head', [-0.5, 33, -0.5], [1, 2, 1], 'plate')
        add('chestplate', 'rightArm', [-10, 22, -3.5], [6, 4, 7], 'fur', 'leftArm', [4, 22, -3.5])
        add('boots', 'rightLeg', [-5.4, 4, -3.5], [7, 2, 7], 'fur', 'leftLeg', [-1.6, 4.1, -3.6])
    elif reg == 'saltreach':    # sallet tail, sea-green fin crest, sea-green scale pauldrons
        S['fin'] = Style(trim, p_scale)
        S['scale'] = Style(trim, p_scale, trim=(met, edge_side))
        add('helmet', 'head', [-0.5, 33, -3], [1, 3, 8], 'fin')
        add('helmet', 'head', [-5, 24, 5], [10, 1, 3], 'plate_trim')
        add('chestplate', 'rightArm', [-10, 21.5, -3.5], [6, 4, 7], 'scale', 'leftArm', [4, 21.5, -3.5])
    elif reg == 'emberwaste':   # a ridge of ember spikes over the helm, blackened pauldrons with spikes
        S['ember'] = Style(trim, lambda f, x, y, w, h: 5 if y == 0 or f == 'up' else 3)
        S['scalep'] = Style(met, p_scale, trim=(trim, edge_side))
        for z, hh in ((-4, 1), (-2, 2), (0, 3), (2, 2)):
            add('helmet', 'head', [-0.5, 33, z], [1, hh, 1], 'ember')
        add('chestplate', 'rightArm', [-10, 21.5, -3.5], [6, 4, 7], 'scalep', 'leftArm', [4, 21.5, -3.5])
        add('chestplate', 'rightArm', [-8, 25.5, -0.5], [1, 2, 1], 'ember', 'leftArm', [7, 25.5, -0.5])
    elif reg == 'blackfen':     # leather hood hanging down the back, wide laced lamellar pauldrons, bone knee caps
        S['hood'] = Style(lea if tier else FENLEATHER, p_lam, trim=(trim, lambda *a: False))
        S['lam'] = Style(met, p_lam, trim=(trim, lambda *a: False))
        S['bone'] = Style(BONE, p_plate)
        add('helmet', 'head', [-4.5, 21, 5], [9, 11, 1], 'hood')
        add('chestplate', 'rightArm', [-10.5, 20.5, -3.5], [6, 5, 7], 'lam', 'leftArm', [4.5, 20.5, -3.5])
        if not tier: add('leggings', 'rightLeg', [-2.9, 5, -3.5], [2, 2, 1], 'bone', 'leftLeg', [0.9, 5, -3.5])
    if tier in ('diamond', 'netherite'):   # knee guards and a second lame under the pauldron
        add('leggings', 'rightLeg', [-4.4, 4, -3.5], [4.5, 3, 1], 'knee', 'leftLeg', [-0.1, 4, -3.5])
        low = {'guard': 21.5, 'vale': 22, 'frostmarch': 22, 'saltreach': 21.5, 'emberwaste': 21.5, 'blackfen': 20.5}[reg]
        add('chestplate', 'rightArm', [-9.5, low - 2, -3.25], [5, 2, 6.5], 'lame', 'leftArm', [4.5, low - 2, -3.25])
    if tier == 'netherite':                # a cape in the banner colour, edged in the region's trim
        add('chestplate', 'body', [-5, 3, 3.4], [10, 21, 1], 'cape')
    return P, S

def relic_parts(name, ramp):
    S = {'cloak': Style(ramp, lambda f, x, y, w, h: 2 + (1 if x % 3 == 1 else 0) + (1 if y == 0 else 0) - (1 if y == h - 1 else 0))}
    P = {'helmet': [], 'chestplate': [], 'leggings': [], 'boots': []}
    if name == 'crownless_mantle':        # a long cloak with a high collar and draped shoulders
        P['chestplate'] += [('body', [-5, 1, 3.4], [10, 23, 1], 'cloak', False),
                            ('body', [-4.5, 22.5, -3.5], [9, 3, 7], 'cloak', False),
                            ('rightArm', [-9.5, 21.5, -3.5], [5, 4, 7], 'cloak', False), ('leftArm', [4.5, 21.5, -3.5], [5, 4, 7], 'cloak', True)]
    else:                                 # widow's veil: lace drapes down the back and both sides of the head
        P['helmet'] += [('head', [-5.5, 19, 5], [11, 14, 1], 'cloak', False),
                        ('head', [-6, 19, -4.5], [1, 13, 9.5], 'cloak', False), ('head', [5, 19, -4.5], [1, 13, 9.5], 'cloak', True)]
    return P, S


# ---- texture: flat sheets on the left, 3D parts packed on the right
def pack(parts):
    """Give every distinct (size, style) part a box-UV slot in x 64..127. Returns {(size, key): (u, v)}."""
    slots, x, y, row = {}, 64, 0, 0
    need = []
    for piece in parts.values():
        for bone, o, s, key, mir in piece:
            k = (tuple(s), key)
            if k not in slots and k not in [n[0] for n in need]: need.append((k, s))
    for k, s in sorted(need, key=lambda n: -(n[1][2] + n[1][1])):
        w, h, d = (max(1, int(round(v))) for v in s)
        bw, bh = 2 * (w + d), d + h
        if x + bw > 128: x, y, row = 64, y + row, 0
        if y + bh > 64: raise SystemExit(f'texture full: {k}')
        slots[k] = (x, y); x += bw; row = max(row, bh)
    return slots

def paint(im, slots, styles, cloth_alpha):
    px = im.load()
    for (s, key), (u, v) in slots.items():
        w, h, d = (max(1, int(round(t))) for t in s)
        for f, (x0, y0, fw, fh) in faces(u, v, w, h, d).items():
            for yy in range(fh):
                for xx in range(fw):
                    px[x0 + xx, y0 + yy] = styles[key].px(f, xx, yy, fw, fh, cloth_alpha)

def flat_sheet(l1, l2, alpha_fix=None):
    im = Image.new('RGBA', (128, 64), (0, 0, 0, 0))
    a = Image.open(l1).convert('RGBA'); b = Image.open(l2).convert('RGBA')
    if a.size != (64, 32):   # relic sheets: one flat noise picture at another size
        a = a.resize((64, 32), Image.NEAREST); b = b.resize((64, 32), Image.NEAREST)
    im.paste(a, (0, 0)); im.paste(b, (0, 32))
    return im

VIS = {"helmet": "variable.helmet_layer_visible = 0.0;", "chestplate": "variable.chest_layer_visible = 0.0;",
       "leggings": "variable.leg_layer_visible = 0.0;", "boots": "variable.boot_layer_visible = 0.0;"}

def write(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f: json.dump(data, f, indent=2); f.write('\n')

def build(name, parts, styles, l1, l2, pieces, attach, leather):
    im = flat_sheet(l1, l2)
    slots = pack(parts)
    paint(im, slots, styles, leather)
    os.makedirs(RP + 'textures/models/siege_armor', exist_ok=True)
    im.save(RP + f'textures/models/siege_armor/{name}.png')
    for piece in pieces:
        bones = {k: [dict(c) for c in v] for k, v in BASE[piece].items()}
        for bone, o, s, key, mir in parts[piece]:
            bones.setdefault(bone, []).append(cube(o, s, list(slots[(tuple(s), key)]), 0, mir))
        ident = f'geometry.siege_{name}_{piece}'
        write(RP + f'models/entity/armor/{name}_{piece}.geo.json', geo(ident, bones))
        path = RP + f'attachables/{attach(piece)}.json'
        att = json.load(open(path))
        d = att['minecraft:attachable']['description']
        d['textures']['default'] = f'textures/models/siege_armor/{name}'
        d['geometry'] = {'default': ident}
        d['scripts'] = {'parent_setup': VIS[piece]}
        write(path, att)

PIECES = ['helmet', 'chestplate', 'leggings', 'boots']
SETS = []
for reg in ['guard', 'vale', 'frostmarch', 'saltreach', 'emberwaste', 'blackfen']:
    for tier in ([''] if reg == 'guard' else ['', 'diamond', 'netherite']):
        flat = 'guard' if reg == 'guard' else f'guard_{reg}' + (f'_{tier}' if tier else '')
        if not os.path.exists(FLAT + flat + '_layer_1.png'): continue
        parts, styles = guard_parts(reg, tier)
        build(flat, parts, styles, FLAT + flat + '_layer_1.png', FLAT + flat + '_layer_2.png', PIECES, lambda p, n=flat: f'{n}_{p}', True)
        SETS.append(flat)

for relic, piece, img in (('crownless_mantle', 'chestplate', 'siege_b_crownless_mantle'), ('widows_veil', 'helmet', 'siege_b_widows_veil')):
    src = Image.open(FLAT + img + '.png').convert('RGB')
    avg = [sum(c[i] for c in src.getdata()) // (src.width * src.height) for i in range(3)]
    ramp = [tuple(max(0, min(255, int(v * k))) for v in avg) for k in (0.55, 0.72, 0.88, 1.0, 1.12, 1.25)]
    parts, styles = relic_parts(relic, ramp)
    build(f'relic_{relic}', parts, styles, FLAT + img + '.png', FLAT + img + '.png', [piece], lambda p, r=relic: f'bestiary_{r}', False)
    SETS.append(f'relic_{relic}')

print(f'{len(SETS)} sets:', ', '.join(SETS))
