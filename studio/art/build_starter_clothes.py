"""Starter clothes and a starter weapon for every region (Mateo 2026-11-13: "the player should get cheap starter armor
that looks like clothes, (depending on the theme and region) and a starter weapon"; "those need textures").

A new player is dressed in the clothes of the region they start in (the region of the plot they pick in the welcome
hall; Kingsrest, for those who start with no plot, is the Vale) and handed that region's working tool as a weapon.
They are leather-weak on purpose: protection 1/3/2/1 and leather durability, so the first real armour is a clear step up.

  Aldmere Vale  farmhand: straw hat, linen shirt under a red jerkin, breeches and stockings, field shoes; billhook
  Frostmarch    trapper: fur-trimmed wool hood, quilted coat with a fur mantle, wool trousers with wrappings, fur boots;
                hatchet
  Saltreach     deckhand: knit cap, striped smock with a red neckerchief, rolled canvas trousers, rope sandals; cutlass
  Emberwaste    caravaneer: sun wrap with an eye slit and a neck cloth, long sand tunic with a rust sash, loose trousers,
                wrapped sandals; sickle-sword
  Blackfen      fen-walker: oilskin hat with a neck flap, oilskin coat with bone toggles, patched trousers, waders;
                reed spear

    python3 studio/art/build_starter_clothes.py [repo root]
    python3 tools/build_player_joints.py              (elbows and knees, as after every armour builder)

Writes, for every starter_<region>_<piece> (piece: helmet, chestplate, leggings, boots) and starter_<region>_weapon:
  RP textures/models/siege_armor/<id>.png, models/entity/armor/<id>.geo.json, attachables/<id>.json (via
     build_armor3d.build: one 64x32 vanilla-layout sheet per piece, so armour trims still line up, 3D parts in the
     empty corners), textures/items/siege_<id>.png, item_texture.json keys, en_US.lang names
  BP items/starter_clothes/<id>.json
  art/starter-clothes.png (contact sheet)
"""
import json, os, re, sys, tempfile
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
ROOT = (sys.argv[1].rstrip('/') + '/') if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(HERE)) + '/'
sys.argv[1:] = [ROOT]                       # build_armor3d reads the root from argv
import build_armor3d as A                   # noqa: E402  (packing, 3D parts, writing)
from palette import M, ramp, fixed          # noqa: E402

RP, BP = ROOT + 'Siege_Nights_RP/', ROOT + 'Siege_Nights_BP/'
REG = ['vale', 'frostmarch', 'saltreach', 'emberwaste', 'blackfen']
REGION_NAME = {'vale': 'Aldmere Vale', 'frostmarch': 'Frostmarch', 'saltreach': 'Saltreach', 'emberwaste': 'Emberwaste', 'blackfen': 'Blackfen'}
PIECES = ['helmet', 'chestplate', 'leggings', 'boots']

# ---- cloth ramps (6 tones, 0 = outline/shadow, 5 = highlight)
LINEN = ramp('#d8ccb0', 0.30, 0.92, sat=0.6)          # undyed linen
STRAW = fixed('#5e4a1c', '#8c7030', '#b8983e', '#d8bc5a', '#ecd682', '#f8ecb4')
VALE_RED = ramp('#8e2a22', 0.10, 0.62)                # the Vale's red, in wool
BREECH = ramp('#6a5038', 0.10, 0.58)                  # brown homespun
CREAM = ramp('#e2dcc8', 0.40, 0.95, sat=0.5)          # wool stockings
LEATHER = M['leather']
DARKLEA = ramp('#4c3020', 0.06, 0.44)
SLATE = ramp('#46586e', 0.10, 0.62)                   # Frostmarch blue-grey wool
DKWOOL = ramp('#3a3e48', 0.07, 0.48)
FUR = A.FUR
BONE = M['parchment']
SAIL = ramp('#e8e4d8', 0.42, 0.96, sat=0.4)
SEA = ramp('#2c4c78', 0.08, 0.58)                     # sea-blue stripe
TEAL = ramp('#2f8f88', 0.10, 0.70)
KERCHIEF = ramp('#b8322a', 0.12, 0.70)
CANVAS = ramp('#b4a07a', 0.18, 0.80, sat=0.7)
ROPE = M['rope']
SAND = ramp('#d6b98a', 0.22, 0.90, sat=0.8)
RUST = ramp('#9a3a24', 0.10, 0.62)
PALE = ramp('#e6dcc4', 0.36, 0.94, sat=0.5)
OIL = ramp('#4a5236', 0.06, 0.50)                     # waxed oilskin, fen olive
MOSS = ramp('#6a8a3a', 0.10, 0.62)
PEAT = ramp('#4e4030', 0.07, 0.48)
PATCH = ramp('#6c6a44', 0.10, 0.56)
WADER = A.FENLEATHER
WOOD = M['oak']
DKWOOD = M['dark_oak']
STEEL = M['steel']
IRON = M['iron']

# ---- the vanilla armour layout
def faces(u, v, w, h, d):
    return dict(top=(u + d, v, w, d), bottom=(u + d + w, v, w, d), right=(u, v + d, d, h), front=(u + d, v + d, w, h),
                left=(u + d + w, v + d, d, h), back=(u + 2 * d + w, v + d, w, h))
HD, BD, AR, LG = faces(0, 0, 8, 8, 8), faces(16, 16, 8, 12, 4), faces(40, 16, 4, 12, 4), faces(0, 16, 4, 12, 4)
SIDES = ('front', 'right', 'back', 'left')

class Sheet:
    def __init__(s): s.im = Image.new('RGBA', (64, 32)); s.p = s.im.load()
    def paint(s, f, fn, rows=None):
        """fn(x, y, w, h) -> (ramp, tone) or None (left as it is). rows limits the rows painted."""
        x0, y0, w, h = f
        for y in range(*(rows or (0, h))):
            for x in range(w):
                r = fn(x, y, w, h)
                if r is None: continue
                rm, t = r
                s.p[x0 + x, y0 + y] = tuple(rm[max(0, min(5, t))]) + (255,)
    def clear(s, f, fn):
        x0, y0, w, h = f
        for y in range(h):
            for x in range(w):
                if fn(x, y, w, h): s.p[x0 + x, y0 + y] = (0, 0, 0, 0)
    def all(s, group, fn, rows=None, sides=SIDES):
        for k in sides: s.paint(group[k], fn, rows)

# ---- weaves: tone for pixel x, y of a w x h face
def weave(x, y, w, h): return 3 + ((x + y) % 5 == 0) - ((x * 3 + y) % 7 == 0) - (y == h - 1)
def linen(x, y, w, h): return 3 + (x == 0) - (x == w - 1) + ((x + 2 * y) % 9 == 0)
def knit(x, y, w, h): return 3 + (1 if (x + y // 2) % 2 == 0 else 0) - (y % 2)
def quilt(x, y, w, h): return 2 if ((x + y) % 4 == 0 or (x - y) % 4 == 0) else 3 + ((x + y) % 7 == 1)
def straw(x, y, w, h): return 3 + (1 if (x + y) % 2 == 0 else -1) + ((x * 5 + y) % 11 == 0)
def sheen(x, y, w, h): return 2 + (x == 1 or x == w - 2) * 2 - (y == h - 1) + ((x + y * 3) % 13 == 0)   # oilskin shine
FURN = [[(x * 7 + y * 13) % 4 + 2 for x in range(64)] for y in range(32)]
def fur(x, y, w, h): return FURN[y % 32][x % 64]
def of(rm, fn): return lambda x, y, w, h: (rm, fn(x, y, w, h))
def tone(rm, t): return lambda x, y, w, h: (rm, t)


# ---- each region's clothes: (layer 1 sheet, layer 2 sheet), plus its 3D parts
def vale():
    L1, L2 = Sheet(), Sheet()
    # straw hat: the crown covers the top of the head, a red band round it; the brim is a 3D part
    L1.paint(HD['top'], of(STRAW, straw))
    L1.all(HD, of(STRAW, straw), rows=(0, 2)); L1.all(HD, tone(VALE_RED, 3), rows=(2, 3))
    # shirt and jerkin: linen shirt showing at the laced front, red jerkin, leather belt with a brass buckle
    def jerkin(side):
        def fn(x, y, w, h):
            if y == 8: return (M['gold'], 4 - (x == 4)) if side == 'front' and x in (3, 4) else (LEATHER, 2)
            if side == 'front' and 3 <= x <= 4 and y < 8:
                return (DARKLEA, 1) if y % 2 == 1 and y > 0 else (LINEN, 4 - (x == 4))
            return (VALE_RED, weave(x, y, w, h) - (side in ('right', 'left')))
        return fn
    for k in SIDES: L1.paint(BD[k], jerkin(k))
    L1.paint(BD['top'], tone(LINEN, 4)); L1.paint(BD['bottom'], tone(VALE_RED, 1))
    L1.all(AR, lambda x, y, w, h: (VALE_RED, 3) if y < 2 else (LINEN, linen(x, y, w, h) + (y == 8)), rows=(0, 9))
    L1.paint(AR['top'], tone(VALE_RED, 4))
    # breeches to the knee, tied, pale stockings below
    L2.all(BD, lambda x, y, w, h: (LEATHER, 2) if y == 7 else (BREECH, weave(x, y, w, h)), rows=(7, 12))
    L2.all(LG, lambda x, y, w, h: (BREECH, weave(x, y, w, h)) if y < 6 else (DARKLEA, 2) if y == 6 else (CREAM, linen(x, y, w, h)))
    L2.paint(LG['top'], tone(BREECH, 3))
    # field shoes
    L1.all(LG, lambda x, y, w, h: (DARKLEA, 3) if y == 9 else (LEATHER, 3 - (y == 11) + (x == 0)), rows=(9, 12))
    L1.paint(LG['bottom'], tone(DARKLEA, 1))
    S = {'brim': A.Style(STRAW, lambda f, x, y, w, h: 3 + (1 if (x + y) % 2 == 0 else -1) + (f == 'up') - (f == 'down'),
                         trim=(STRAW, lambda f, x, y, w, h: f == 'up' and A.border(x, y, w, h)))}
    P = {'helmet': [('head', [-6.5, 30, -6.5], [13, 1, 13], 'brim', False)], 'chestplate': [], 'leggings': [], 'boots': []}
    return L1, L2, P, S


def frostmarch():
    L1, L2 = Sheet(), Sheet()
    # wool hood, the face open, fur round the opening
    L1.paint(HD['top'], of(SLATE, quilt))
    L1.all(HD, of(SLATE, quilt))
    L1.clear(HD['front'], lambda x, y, w, h: 1 <= x <= 6 and 2 <= y <= 7)
    L1.paint(HD['front'], lambda x, y, w, h: (FUR, fur(x, y, w, h)) if (y == 1 and 1 <= x <= 6) or (x in (0, 7) and y >= 1) else None)
    # quilted coat, bone toggles, fur hem
    def coat(side):
        def fn(x, y, w, h):
            if y == 11: return (FUR, fur(x, y, w, h))
            if y == 8: return (DARKLEA, 2)
            if side == 'front' and x in (3, 4):
                return (BONE, 4) if x == 4 and y in (2, 5) else (SLATE, 2 if x == 3 else 3)
            return (SLATE, quilt(x, y, w, h) - (side in ('right', 'left')))
        return fn
    for k in SIDES: L1.paint(BD[k], coat(k))
    L1.paint(BD['top'], of(FUR, fur)); L1.paint(BD['bottom'], tone(FUR, 2))
    L1.all(AR, lambda x, y, w, h: (FUR, fur(x, y, w, h)) if y >= 10 else (SLATE, quilt(x, y, w, h)))
    L1.paint(AR['top'], of(SLATE, quilt)); L1.paint(AR['bottom'], tone(FUR, 3))
    # dark wool trousers, cross-gartered wrappings below the knee
    L2.all(BD, lambda x, y, w, h: (DARKLEA, 2) if y == 7 else (DKWOOL, weave(x, y, w, h)), rows=(7, 12))
    L2.all(LG, lambda x, y, w, h: (DKWOOL, weave(x, y, w, h)) if y < 6 else ((LEATHER, 3) if (x + y) % 4 in (0, 1) and (x - y) % 4 else (CREAM, 2 + (x == 0))))
    L2.paint(LG['top'], tone(DKWOOL, 3))
    # fur-lined boots
    L1.all(LG, lambda x, y, w, h: (FUR, fur(x, y, w, h)) if y == 7 else (LEATHER, 3 - (y == 11) - (x == w - 1)), rows=(7, 12))
    L1.paint(LG['bottom'], tone(DARKLEA, 1))
    S = {'fur': A.Style(FUR, A.p_fur)}
    P = {'helmet': [('head', [-5.5, 22.5, -5.5], [11, 2, 11], 'fur', False)],
         'chestplate': [('rightArm', [-9.5, 22, -3.5], [5, 3, 7], 'fur', False), ('leftArm', [4.5, 22, -3.5], [5, 3, 7], 'fur', True)],
         'leggings': [], 'boots': [('rightLeg', [-5.4, 4.5, -3.5], [7, 2, 7], 'fur', False), ('leftLeg', [-1.6, 4.6, -3.6], [7, 2, 7], 'fur', True)]}
    return L1, L2, P, S


def saltreach():
    L1, L2 = Sheet(), Sheet()
    # knit cap: teal and white rounds, a folded brim
    L1.paint(HD['top'], of(TEAL, knit))
    L1.all(HD, lambda x, y, w, h: (TEAL if y in (0, 2) else SAIL, knit(x, y, w, h)) if y < 3 else (TEAL, 2 + (x % 2)), rows=(0, 4))
    # striped smock, red neckerchief, rope belt
    def smock(side):
        def fn(x, y, w, h):
            if y == 9: return (ROPE, 3 + (x % 2))
            if side == 'front' and y <= 3 - abs(2 * x - 7) // 2 and y < 4: return (KERCHIEF, 3 + (y == 0) - (x in (0, 7)))
            stripe = SEA if (y // 2) % 2 == 0 else SAIL
            return (stripe, 3 + (x == 0) - (x == w - 1) - (side in ('right', 'left')))
        return fn
    for k in SIDES: L1.paint(BD[k], smock(k))
    L1.paint(BD['top'], tone(KERCHIEF, 3)); L1.paint(BD['bottom'], tone(SAIL, 2))
    L1.all(AR, lambda x, y, w, h: (SAIL, 4) if y == 7 else ((SEA if (y // 2) % 2 == 0 else SAIL), 3 - (x == w - 1)), rows=(0, 8))
    L1.paint(AR['top'], tone(SEA, 3))
    # canvas trousers rolled up the shin
    L2.all(BD, lambda x, y, w, h: (ROPE, 3 + (x % 2)) if y == 7 else (CANVAS, weave(x, y, w, h)), rows=(7, 12))
    L2.all(LG, lambda x, y, w, h: (CANVAS, 4 + (x == 0)) if y == 8 else (CANVAS, weave(x, y, w, h) - (x % 3 == 2 and y > 4)), rows=(0, 9))
    L2.paint(LG['top'], tone(CANVAS, 3))
    # rope sandals: a sole and straps, the foot showing between
    L1.all(LG, lambda x, y, w, h: (ROPE, 3 + (x % 2)) if y == 11 or (y == 10 and x % 2 == 0) or (y == 9 and x in (0, 3)) else None, rows=(9, 12))
    L1.paint(LG['bottom'], tone(LEATHER, 2))
    S = {'cuff': A.Style(TEAL, lambda f, x, y, w, h: 3 + (1 if x % 2 == 0 else 0) - (f == 'down') + (f == 'up'))}
    # the folded-up brim of the cap, standing a little proud of the head all round
    P = {'helmet': [('head', [-5.5, 28.5, -5.5], [11, 1.5, 11], 'cuff', False)], 'chestplate': [], 'leggings': [], 'boots': []}
    return L1, L2, P, S


def emberwaste():
    L1, L2 = Sheet(), Sheet()
    # sun wrap: wound cloth over the head, an eye slit, a veil over the mouth
    def wrap(x, y, w, h): return 3 + ((x + y) % 4 == 0) - ((x - y) % 6 == 0)
    L1.paint(HD['top'], of(SAND, wrap))
    L1.all(HD, of(SAND, wrap))
    L1.clear(HD['front'], lambda x, y, w, h: 1 <= x <= 6 and 3 <= y <= 4)
    L1.paint(HD['front'], lambda x, y, w, h: (SAND, 2 + (x % 2)) if y >= 5 else ((RUST, 3) if y == 2 else None))
    for k in ('right', 'left', 'back'): L1.paint(HD[k], tone(RUST, 3), rows=(2, 3))
    # long sand tunic, a rust sash across it and round the waist
    def tunic(side):
        def fn(x, y, w, h):
            if y in (7, 8): return (RUST, 3 + (y == 7))
            if side in ('front', 'back') and abs(x - (y if side == 'front' else w - 1 - y)) <= 0 and y < 7: return (RUST, 3)
            return (SAND, linen(x, y, w, h) - (side in ('right', 'left')))
        return fn
    for k in SIDES: L1.paint(BD[k], tunic(k))
    L1.paint(BD['top'], tone(SAND, 4)); L1.paint(BD['bottom'], tone(SAND, 2))
    L1.all(AR, lambda x, y, w, h: (RUST, 3) if y == 10 else (SAND, linen(x, y, w, h)), rows=(0, 11))
    L1.paint(AR['top'], tone(SAND, 4))
    # loose pale trousers, wrapped at the ankle
    L2.all(BD, lambda x, y, w, h: (RUST, 3) if y == 7 else (PALE, linen(x, y, w, h)), rows=(7, 12))
    L2.all(LG, lambda x, y, w, h: (PALE, linen(x, y, w, h) - ((x + y) % 5 == 0)) if y < 9 else (RUST, 2 + (x + y) % 2))
    L2.paint(LG['top'], tone(PALE, 3))
    # wrapped sandals
    L1.all(LG, lambda x, y, w, h: (LEATHER, 3 - (y == 11)) if y == 11 or (x + y) % 3 == 0 else None, rows=(9, 12))
    L1.paint(LG['bottom'], tone(DARKLEA, 1))
    hem = lambda f, x, y, w, h: f in ('north', 'south', 'east', 'west') and y == h - 1
    S = {'tail': A.Style(SAND, lambda f, x, y, w, h: 3 + ((x + y) % 4 == 0) - (f == 'down'), trim=(RUST, hem)),
         'skirt': A.Style(SAND, lambda f, x, y, w, h: 3 + (x == 0) - (x == w - 1) - (f == 'down'), trim=(RUST, hem))}
    P = {'helmet': [('head', [-3.5, 21, 4.4], [7, 7, 1], 'tail', False)],
         'chestplate': [('body', [-3, 4, -3.4], [6, 8, 1], 'skirt', False), ('body', [-3, 4, 2.4], [6, 8, 1], 'skirt', False)],
         'leggings': [], 'boots': []}
    return L1, L2, P, S


def blackfen():
    L1, L2 = Sheet(), Sheet()
    # oilskin hat: a low crown with a rope band; brim and neck flap are 3D parts
    L1.paint(HD['top'], of(OIL, sheen))
    L1.all(HD, lambda x, y, w, h: (ROPE, 3) if y == 2 else (OIL, 3 - (y == 0) + (x == 1)), rows=(0, 3))
    # oilskin coat with a moss collar and bone toggles
    def coat(side):
        def fn(x, y, w, h):
            if y <= 1: return (MOSS, 3 - y + (x % 2))
            if side == 'front' and x in (3, 4):
                return (BONE, 4) if x == 4 and y in (3, 6, 9) else (OIL, 1 if x == 3 else 3)
            return (OIL, sheen(x, y, w, h) - (side in ('right', 'left')))
        return fn
    for k in SIDES: L1.paint(BD[k], coat(k))
    L1.paint(BD['top'], tone(MOSS, 3)); L1.paint(BD['bottom'], tone(OIL, 1))
    L1.all(AR, lambda x, y, w, h: (MOSS, 2) if y == 11 else (OIL, sheen(x, y, w, h)))
    L1.paint(AR['top'], tone(OIL, 3)); L1.paint(AR['bottom'], tone(OIL, 1))
    # patched trousers
    L2.all(BD, lambda x, y, w, h: (ROPE, 2) if y == 7 else (PEAT, weave(x, y, w, h)), rows=(7, 12))
    def trousers(side):
        def fn(x, y, w, h):
            if side == 'front' and 4 <= y <= 6 and 1 <= x <= 2: return (PATCH, 3 + (y == 4) - (x == 2) if not ((x + y) % 2 == 0 and y == 6) else 1)
            return (PEAT, weave(x, y, w, h))
        return fn
    for k in SIDES: L2.paint(LG[k], trousers(k))
    L2.paint(LG['top'], tone(PEAT, 3))
    # waders up to the thigh, a strap at the top
    L1.all(LG, lambda x, y, w, h: (ROPE, 2) if y == 2 else (WADER, 3 + (x == 1) - (y == 11) + ((x + y) % 7 == 0)), rows=(2, 12))
    L1.paint(LG['bottom'], tone(WADER, 1))
    S = {'brim': A.Style(OIL, lambda f, x, y, w, h: 3 + (f == 'up') - (f == 'down') + ((x + y) % 9 == 0)),
         'flap': A.Style(OIL, lambda f, x, y, w, h: 2 + (x == 1) + (y == 0) - (f == 'down'))}
    P = {'helmet': [('head', [-6, 30, -6], [12, 1, 12], 'brim', False), ('head', [-4.5, 25, 4.6], [9, 5, 1], 'flap', False)],
         'chestplate': [('body', [-4, 3, -3.4], [8, 9, 1], 'flap', False), ('body', [-4, 3, 2.4], [8, 9, 1], 'flap', False)],
         'leggings': [], 'boots': []}
    return L1, L2, P, S


BUILD = {'vale': vale, 'frostmarch': frostmarch, 'saltreach': saltreach, 'emberwaste': emberwaste, 'blackfen': blackfen}

NAMES = {
    'vale':       {'helmet': 'Straw Hat', 'chestplate': "Farmhand's Jerkin", 'leggings': 'Breeches', 'boots': 'Field Shoes', 'weapon': 'Billhook'},
    'frostmarch': {'helmet': 'Fur-Trimmed Hood', 'chestplate': 'Quilted Coat', 'leggings': 'Wrapped Trousers', 'boots': 'Fur Boots', 'weapon': 'Hatchet'},
    'saltreach':  {'helmet': 'Knit Cap', 'chestplate': 'Striped Smock', 'leggings': 'Canvas Trousers', 'boots': 'Rope Sandals', 'weapon': 'Cutlass'},
    'emberwaste': {'helmet': 'Sun Wrap', 'chestplate': 'Sand Tunic', 'leggings': 'Loose Trousers', 'boots': 'Wrapped Sandals', 'weapon': 'Sickle-Sword'},
    'blackfen':   {'helmet': 'Oilskin Hat', 'chestplate': 'Oilskin Coat', 'leggings': 'Patched Trousers', 'boots': 'Waders', 'weapon': 'Reed Spear'},
}
SHORT = {'vale': 'Vale', 'frostmarch': 'Frostmarch', 'saltreach': 'Saltreach', 'emberwaste': 'Emberwaste', 'blackfen': 'Blackfen'}


# ---- icons: 16x16 masks. Each letter is a material; the shading (outline, light from the top left) is worked out.
def icon_from(mask, mats):
    im = Image.new('RGBA', (16, 16)); px = im.load()
    rows = [r.replace(' ', '.').ljust(16, '.')[:16] for r in mask] + ['.' * 16] * (16 - len(mask))
    at = lambda x, y: rows[y][x] if 0 <= x < 16 and 0 <= y < 16 else '.'
    for y in range(16):
        for x in range(16):
            ch = at(x, y)
            if ch == '.': continue
            rm, base = mats[ch.lower()]
            t = base + (1 if ch.isupper() else 0)
            if at(x, y - 1) == '.' or at(x - 1, y) == '.': t += 1
            if at(x, y + 1) == '.' or at(x + 1, y) == '.': t -= 1
            if at(x, y + 1) == '.' and at(x + 1, y) == '.': t = min(t, 1)
            px[x, y] = tuple(rm[max(0, min(5, t))]) + (255,)
    return im

# masks for the clothes (hat, top, trousers, shoes) per region; upper case = one tone lighter
ICONS = {
 'vale': {
  'helmet': (["", "", "", "", "      ssss", "     sSSSSs", "     ssssss", "     rrrrrr", "  ssssssssssss", " sSSSSSSSSSSSSs", "  ssssssssssss"],
             {'s': (STRAW, 3), 'r': (VALE_RED, 3)}),
  'chestplate': (["", "  rrr lL rrr", " rrrrrlLrrrrr", " rrrrrlLrrrrr", " lll rlLr lll", " lll rlLr lll", " lll rrrr lll", " ll  rrrr  ll", "     bbgb", "     rrrr", "     rrrr", "     rrrr"],
                 {'r': (VALE_RED, 3), 'l': (LINEN, 3), 'b': (LEATHER, 2), 'g': (M['gold'], 4)}),
  'leggings': (["", "", "   bbbbbbbb", "   BBBBBBBB", "   BBBBBBBB", "   BBB  BBB", "   BBB  BBB", "   kkk  kkk", "   ccc  ccc", "   CCC  CCC", "   ccc  ccc", "   ccc  ccc"],
               {'b': (BREECH, 2), 'k': (DARKLEA, 2), 'c': (CREAM, 3)}),
  'boots': (["", "", "", "", "", "", "", "  ddd    ddd", "  LLL    LLL", "  LLL    LLL", " LLLL   LLLL", " llll   llll"],
            {'d': (DARKLEA, 3), 'l': (LEATHER, 2)}),
 },
 'frostmarch': {
  'helmet': (["", "", "     sssss", "    sSSSSSs", "   sSffffSs", "   sSf  fSs", "   sSf  fSs", "   sSf  fSs", "   ssffffss", "  ffffffffff", "  FFFFFFFFFF"],
             {'s': (SLATE, 2), 'f': (FUR, 3)}),
  'chestplate': (["", "  fff    fff", " fffffffffff", " sssssSbssss", " sss sSSs sss", " sss sSbs sss", " sss sSSs sss", " ff  kkkk  ff", "     sSSs", "     sSbs", "     ffff"],
                 {'s': (SLATE, 2), 'f': (FUR, 3), 'b': (BONE, 4), 'k': (DARKLEA, 2)}),
  'leggings': (["", "", "   kkkkkkkk", "   dddddddd", "   DDDDDDDD", "   DDD  DDD", "   ddd  ddd", "   wWw  wWw", "   Www  Www", "   wWw  wWw", "   Www  Www", "   www  www"],
               {'k': (DARKLEA, 2), 'd': (DKWOOL, 3), 'w': (LEATHER, 2)}),
  'boots': (["", "", "", "", "", " ffff   ffff", "  lll    lll", "  LLL    LLL", "  LLL    LLL", " LLLL   LLLL", " llll   llll"],
            {'f': (FUR, 3), 'l': (LEATHER, 2)}),
 },
 'saltreach': {
  'helmet': (["", "", "", "      tttt", "     tTTTTt", "    tTTTTTTt", "    wwwwwwww", "    WWWWWWWW", "    tttttttt", "    TTTTTTTT", "    tttttttt"],
             {'t': (TEAL, 2), 'w': (SAIL, 3)}),
  'chestplate': (["", "  www kk www", " wwwwkKKkwwww", " eeeeekkeeeee", " WWW WWWW WWW", " eee eeee eee", " WWW WWWW WWW", " ee  eeee  ee", "     WWWW", "     rrrr", "     eeee", "     WWWW"],
                 {'w': (SAIL, 3), 'e': (SEA, 3), 'k': (KERCHIEF, 3), 'r': (ROPE, 3)}),
  'leggings': (["", "", "   rrrrrrrr", "   cccccccc", "   CCCCCCCC", "   CCC  CCC", "   ccc  ccc", "   ccc  ccc", "   CCC  CCC", "   CCC  CCC"],
               {'r': (ROPE, 3), 'c': (CANVAS, 3)}),
  'boots': (["", "", "", "", "", "", "", "  rr     rr", "  rRr    rRr", "  r rr   r rr", "  rr rr  rr rr", " LLLLLL  LLLLLL", " llllll  llllll"],
            {'r': (ROPE, 3), 'l': (LEATHER, 2)}),
 },
 'emberwaste': {
  'helmet': (["", "", "     sssss", "    sSSSSSs", "   sSSSSSSSs", "   rrrrrrrrr", "   s       s", "   sSSSSSSSs", "   sSSSSSSSs", "   sssssssssss", "      ssssssss", "         sssss"],
             {'s': (SAND, 3), 'r': (RUST, 3)}),
  'chestplate': (["", "  sss    sss", " sssSssssssss", " sssSrSSSSsss", " sss SSrSs sss", " sss SSSrs sss", " sss SSSSr sss", " rr  rrrr  rr", "     rrrr", "     sSSs", "     sSSs", "    sSSSSs"],
                 {'s': (SAND, 3), 'r': (RUST, 3)}),
  'leggings': (["", "", "   rrrrrrrr", "   pppppppp", "   PPPPPPPP", "   PPP  PPP", "   PPP  PPP", "   ppp  ppp", "   ppp  ppp", "   rRr  rRr", "   RrR  RrR"],
               {'r': (RUST, 3), 'p': (PALE, 3)}),
  'boots': (["", "", "", "", "", "  ll     ll", "  lLl    lLl", "  LlL    LlL", "  lLl    lLl", "  l ll   l ll", "  ll ll  ll ll", " dddddd  dddddd", " DDDDDD  DDDDDD"],
            {'l': (LEATHER, 3), 'd': (DARKLEA, 2)}),
 },
 'blackfen': {
  'helmet': (["", "", "", "     oooooo", "    oOOOOOOo", "    oOOOOOOo", "    rrrrrrrr", " ooooooooooooo", "oOOOOOOOOOOOOOo", " ooooooooooooo"],
             {'o': (OIL, 2), 'r': (ROPE, 3)}),
  'chestplate': (["", "  mmm    mmm", " mmmmmmmmmmm", " ooooOOboooo", " ooo oOOo ooo", " ooo oObo ooo", " ooo oOOo ooo", " oo  oObo  oo", "    oooOoo", "    oooOoo", "    oooboo", "    oooooo"],
                 {'o': (OIL, 2), 'm': (MOSS, 3), 'b': (BONE, 4)}),
  'leggings': (["", "", "   rrrrrrrr", "   pppppppp", "   PPPPPPPP", "   PaaP  PPP", "   PaaP  PPP", "   ppp  ppp", "   ppp  ppp", "   ppp  ppp", "   ppp  ppp"],
               {'r': (ROPE, 2), 'p': (PEAT, 3), 'a': (PATCH, 3)}),
  'boots': (["", "", "rrrr   rrrr", "wwww   wwww", "WWww   WWww", "Wwww   Wwww", "Wwww   Wwww", "Wwww   Wwww", "Wwww   Wwww", "WwwwW  WwwwW", "wwwww  wwwww"],
            {'r': (ROPE, 2), 'w': (WADER, 3)}),
 },
}

# weapons: handle bottom left, blade top right, as vanilla tools are drawn
WEAPONS = {
 'vale': (["", "          bbbb", "        bbEEEbb", "       bEEbbbEb", "       bEb   bb", "      bEEb", "      bEb", "     bEEb", "     bEb", "    gbb", "   hg", "  hh", " hh", "ww", "w"],
          {'b': (IRON, 2), 'e': (IRON, 3), 'g': (DKWOOD, 2), 'h': (WOOD, 2), 'w': (LEATHER, 2)}),
 'frostmarch': (["", "      bbb", "     bEEbb", "    bEEEbbb", "    bbbhbbb", "     bbhb", "       h", "      h", "     h", "    h", "   hh", "  hh", " ww", "ww", "w"],
                {'b': (STEEL, 2), 'e': (STEEL, 3), 'h': (WOOD, 2), 'w': (LEATHER, 2)}),
 'saltreach': (["", "            bb", "           bEb", "          bEb", "         bEb", "        bEb", "       bEb", "      bEb", "  g  bEb", "  ggbEb", "   ggb", "   hgg", "  hh  g", " ww", "ww"],
               {'b': (STEEL, 2), 'e': (STEEL, 3), 'g': (M['gold'], 2), 'h': (DKWOOD, 2), 'w': (ROPE, 2)}),
 'emberwaste': (["", "        bbb", "      bbEEbb", "     bE    bb", "    bE      b", "    bE", "    bE", "    bEb", "     bEb", "     gbb", "    hg", "   hh", "  hh", " ww", "ww"],
                {'b': (STEEL, 2), 'e': (STEEL, 3), 'g': (M['gold'], 2), 'h': (DKWOOD, 2), 'w': (RUST, 2)}),
 'blackfen': (["             b", "            bE", "           bEb", "          bEb", "          rb", "         rr", "        hh", "       hh", "      hh", "     hh", "    hh", "   hh", "  hh", " hh", "hh"],
              {'b': (IRON, 2), 'e': (IRON, 3), 'r': (ROPE, 3), 'h': (PEAT, 3)}),
}


# ---- items
ARMOUR = dict(prot=(1, 3, 2, 1), dur=(55, 80, 75, 65), ench=15)
WEAPON = dict(damage=5, dur=131)
SLOT = {'helmet': ('slot.armor.head', 'armor_head'), 'chestplate': ('slot.armor.chest', 'armor_torso'),
        'leggings': ('slot.armor.legs', 'armor_legs'), 'boots': ('slot.armor.feet', 'armor_feet')}
def rid(reg, piece): return f'starter_{reg}_{piece}'

def write(path, data, indent=2):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f: json.dump(data, f, indent=indent); f.write('\n')

def armour_json(reg, piece):
    i = PIECES.index(piece); ident = 'siege:' + rid(reg, piece)
    return {"format_version": "1.21.60", "minecraft:item": {
        "description": {"identifier": ident, "menu_category": {"category": "equipment", "group": f"minecraft:itemGroup.name.{piece}"}},
        "components": {
            "minecraft:icon": 'siege_' + rid(reg, piece),
            "minecraft:display_name": {"value": f"item.{ident}.name"},
            "minecraft:max_stack_size": 1,
            "minecraft:wearable": {"slot": SLOT[piece][0], "protection": ARMOUR['prot'][i]},
            # no durability: starter clothes never wear out (Mateo 2026-11-13)
            "minecraft:enchantable": {"slot": SLOT[piece][1], "value": ARMOUR['ench']},
            "minecraft:tags": {"tags": ["minecraft:is_armor", "minecraft:trimmable_armors", "siege:starter_clothes"]}}}}

def weapon_json(reg):
    ident = 'siege:' + rid(reg, 'weapon')
    return {"format_version": "1.21.60", "minecraft:item": {
        "description": {"identifier": ident, "menu_category": {"category": "equipment", "group": "minecraft:itemGroup.name.sword"}},
        "components": {
            "minecraft:icon": 'siege_' + rid(reg, 'weapon'),
            "minecraft:display_name": {"value": f"item.{ident}.name"},
            "minecraft:max_stack_size": 1,
            "minecraft:hand_equipped": True,
            "minecraft:damage": WEAPON['damage'],
            "minecraft:durability": {"max_durability": WEAPON['dur']},
            "minecraft:enchantable": {"slot": "sword", "value": 14},
            "minecraft:repairable": {"repair_items": [{"items": ["minecraft:iron_nugget"], "repair_amount": "q.max_durability * 0.25"}]},
            "minecraft:can_destroy_in_creative": False,
            "minecraft:tags": {"tags": ["minecraft:is_sword", "siege:starter_weapon"]}}}}

def attachable_stub(reg, piece):
    return {"format_version": "1.10.0", "minecraft:attachable": {"description": {
        "identifier": 'siege:' + rid(reg, piece),
        "materials": {"default": "armor", "enchanted": "armor_enchanted"},
        "textures": {"default": "", "enchanted": "textures/misc/enchanted_actor_glint"},
        "geometry": {"default": ""}, "scripts": {"parent_setup": ""},
        "render_controllers": ["controller.render.armor"]}}}

HEADER = '## Starter clothes and weapons (studio/art/build_starter_clothes.py)'
def update_lang(names):
    path = RP + 'texts/en_US.lang'
    lines = [l for l in open(path, encoding='utf-8').read().split('\n') if not re.match(r'item\.siege:starter_(%s)_' % '|'.join(REG), l) and l != HEADER]
    while lines and lines[-1] == '': lines.pop()
    lines += ['', HEADER] + [f'item.siege:{k}.name={v}' for k, v in names.items()]
    open(path, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')

def update_item_textures(keys):
    path = RP + 'textures/item_texture.json'
    d = json.load(open(path))
    for k in keys: d['texture_data'][k] = {"textures": f"textures/items/{k}"}
    write(path, d, indent=1)


def main():
    tmp = tempfile.mkdtemp()
    names, keys = {}, []
    sheet = Image.new('RGBA', (8 + len(REG) * 216, 8 + 150), (38, 34, 46, 255))
    for i, reg in enumerate(REG):
        L1, L2, parts, styles = BUILD[reg]()
        p1, p2 = f'{tmp}/{reg}_1.png', f'{tmp}/{reg}_2.png'
        L1.im.save(p1); L2.im.save(p2)
        for piece in PIECES: write(RP + f'attachables/{rid(reg, piece)}.json', attachable_stub(reg, piece))
        A.build(f'starter_{reg}', parts, styles, p1, p2, PIECES, lambda p, r=reg: rid(r, p), False)
        sheet.alpha_composite(L1.im.resize((128, 64), Image.NEAREST), (8 + i * 216, 8))
        sheet.alpha_composite(L2.im.resize((64, 32), Image.NEAREST), (140 + i * 216, 8))
        for j, piece in enumerate(PIECES + ['weapon']):
            mask, mats = ICONS[reg][piece] if piece != 'weapon' else WEAPONS[reg]
            ic = icon_from(mask, mats)
            key = 'siege_' + rid(reg, piece)
            ic.save(RP + f'textures/items/{key}.png'); keys.append(key)
            sheet.alpha_composite(ic.resize((38, 38), Image.NEAREST), (8 + i * 216 + j * 41, 80))
            write(BP + f'items/starter_clothes/{rid(reg, piece)}.json', weapon_json(reg) if piece == 'weapon' else armour_json(reg, piece))
            names[rid(reg, piece)] = f'{SHORT[reg]} {NAMES[reg][piece]}'
    update_lang(names)
    update_item_textures(keys)
    os.makedirs(ROOT + 'art', exist_ok=True)
    sheet.save(ROOT + 'art/starter-clothes.png')
    print(f'{len(names)} items (5 regions x 4 clothes + a weapon). Now run: python3 tools/build_player_joints.py')


if __name__ == '__main__':
    main()
