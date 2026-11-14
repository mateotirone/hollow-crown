"""Two player skins painted from Mateo's reference photos (2026-11-13: "make a skin that looks like these two people for
emberwaste (the girl) and blackfin (the guy)"). The photos themselves are never kept in the repo: these are hand-placed
pixel portraits in the shared art style, dressed in each region's starter clothes (build_starter_clothes.py, PR #295).

  Reikia Cinderhale  Emberwaste, slim arms. Long dark curly hair with a middle part, olive skin, winged liner, a soft
                     smile, gold necklace, bead bracelets. Caravaneer's sand tunic with the rust sash, the sun wrap worn
                     as a neck cloth, loose pale trousers wrapped at the ankle, wrapped sandals.
  Lorcan Duskmire    Blackfen, classic arms. Big dark curls falling over the forehead, thick dark brows, brown eyes,
                     moustache and chin beard, gold chain. Fen-walker's oilskin coat with the moss collar and bone
                     toggles, patched trousers, thigh waders.

    python3 studio/art/build_photo_skins.py [OUT_DIR]    (writes reikia_cinderhale.png, lorcan_duskmire.png;
                                                        default Hollow_Crown_Skins/, the skin pack in the .mcaddon)

Full 64x64 Bedrock layout with the second (overlay) layer: hair volume on the hat layer, coat skirts on the jacket layer.
"""
import os, sys
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from palette import M, ramp, fixed  # noqa: E402

# ---- ramps (cloth ramps are the same as build_starter_clothes.py, so the skins match the starter kit)
SAND = ramp('#d6b98a', 0.22, 0.90, sat=0.8)
RUST = ramp('#9a3a24', 0.10, 0.62)
PALE = ramp('#e6dcc4', 0.36, 0.94, sat=0.5)
LEATHER = M['leather']
DARKLEA = ramp('#4c3020', 0.06, 0.44)
OIL = ramp('#4a5236', 0.06, 0.50)
MOSS = ramp('#6a8a3a', 0.10, 0.62)
PEAT = ramp('#4e4030', 0.07, 0.48)
PATCH = ramp('#6c6a44', 0.10, 0.56)
ROPE = M['rope']
BONE = M['parchment']
WADER = fixed('#1a1a12', '#2c2b1c', '#423f28', '#5a5536', '#726b45', '#8a8258')
GOLD = M['gold']
# people (sampled by eye from the photos, then pushed into 6-tone ramps)
SKIN_R = fixed('#7a4a34', '#a06a4c', '#c08664', '#d8a07c', '#e8b892', '#f4d0ae')   # Reikia: warm olive, sun-kissed
SKIN_L = fixed('#7e5040', '#a4705a', '#c28a70', '#d8a286', '#e8b89c', '#f2ceb4')   # Lorcan: olive, a touch pinker
HAIR_R = fixed('#140c0a', '#24160f', '#352217', '#4a3020', '#64432c', '#80583a')   # dark brown, warm lights
HAIR_L = fixed('#100b09', '#1c1410', '#2a1e17', '#3a2b21', '#4e3b2e', '#665040')   # near-black brown, cool lights
BEARD = fixed('#1a120e', '#2a1e17', '#3c2c22', '#5a4434', '#7a604c', '#9a7c64')
LIP_R, LIP_L = (190, 106, 104), (196, 128, 118)
WHITE, IRIS_R, IRIS_L, LINER = (236, 230, 222), (58, 34, 22), (66, 36, 22), (26, 16, 14)
SILVER = M['iron']


def _h(x, y, s=0):          # deterministic hash 0..1, so re-running never changes a finished skin
    n = (x * 374761393 + y * 668265263 + s * 2147483647) & 0xffffffff
    n = ((n ^ (n >> 13)) * 1274126177) & 0xffffffff
    return ((n ^ (n >> 16)) & 0xffff) / 65535.0


def faces(u, v, w, h, d):
    return dict(top=(u + d, v, w, d), bottom=(u + d + w, v, w, d), right=(u, v + d, d, h), front=(u + d, v + d, w, h),
                left=(u + d + w, v + d, d, h), back=(u + 2 * d + w, v + d, w, h))

SIDES = ('front', 'right', 'back', 'left')


def parts(slim):
    a = 3 if slim else 4
    base = dict(head=faces(0, 0, 8, 8, 8), body=faces(16, 16, 8, 12, 4), rarm=faces(40, 16, a, 12, 4),
                larm=faces(32, 48, a, 12, 4), rleg=faces(0, 16, 4, 12, 4), lleg=faces(16, 48, 4, 12, 4))
    over = dict(head=faces(32, 0, 8, 8, 8), body=faces(16, 32, 8, 12, 4), rarm=faces(40, 32, a, 12, 4),
                larm=faces(48, 48, a, 12, 4), rleg=faces(0, 32, 4, 12, 4), lleg=faces(0, 48, 4, 12, 4))
    return base, over


class Skin:
    def __init__(s, slim):
        s.im = Image.new('RGBA', (64, 64), (0, 0, 0, 0)); s.p = s.im.load(); s.B, s.O = parts(slim)

    def paint(s, f, fn, layer='B'):
        """fn(x, y, w, h) -> rgb tuple, (ramp, tone), or None (leave)."""
        x0, y0, w, h = f
        for y in range(h):
            for x in range(w):
                r = fn(x, y, w, h)
                if r is None: continue
                if isinstance(r[0], list):
                    rm, t = r; r = rm[max(0, min(5, int(t)))]
                s.p[x0 + x, y0 + y] = tuple(r[:3]) + (255,)

    def each(s, part, fn_for_side, layer='B', sides=SIDES):
        g = (s.B if layer == 'B' else s.O)[part]
        for k in sides: s.paint(g[k], fn_for_side(k), layer)


# ---- shared shading
def skin_tone(rm, x, y, w, h, side):
    t = 3 + (y == 0 and side == 'top') - (x == w - 1 and w > 3) * 0
    if side in ('right', 'left'): t -= 1
    if side == 'bottom': t = 2
    return (rm, t)

def curls(rm, x, y, seed, base=2):
    """Tight curl clusters: a lit pixel with a shadow under-right, in a loose diagonal grid."""
    q = (x + 2 * y + seed) % 4
    t = base + (1 if q == 0 else 0) + (1 if _h(x, y, seed) > 0.82 else 0) - (1 if q == 2 and _h(y, x, seed) > 0.4 else 0)
    return (rm, t)

def weave(x, y, w, h): return 3 + ((x + y) % 5 == 0) - ((x * 3 + y) % 7 == 0) - (y == h - 1)
def linen(x, y, w, h): return 3 + (x == 0) - (x == w - 1) + ((x + 2 * y) % 9 == 0)
def sheen(x, y, w, h): return 2 + (x == 1 or x == w - 2) * 2 - (y == h - 1) + ((x + y * 3) % 13 == 0)


# =====================================================================================================  Reikia
def reikia():
    S = Skin(slim=True); B, O = S.B, S.O; H, SK = HAIR_R, SKIN_R

    # --- head: base layer face and hair
    def face(x, y, w, h):
        if y == 0: return (SK, 2) if x in (3, 4) else curls(H, x, y, 1, 3)          # middle part at the hairline
        if x in (0, 7): return curls(H, x, y, 1, 2 + (y < 3))                        # curls framing the face
        if y == 1: return curls(H, x, y, 1, 3) if x in (1, 6) else (SK, 4)
        if y == 2: return (H, 4) if x in (1, 2, 5, 6) else (SK, 4)                     # soft arched brows
        if y == 3: return LINER if x in (1, 2, 5, 6) else (SK, 3 + (x in (3, 4)))   # lash line, winged
        if y == 4:
            if x in (2, 5): return IRIS_R
            if x in (1, 6): return WHITE
            return (SK, 3 + (x == 3))
        if y == 5: return (SK, 4) if x in (1, 6) else (SK, 3 - (x == 4) + (x == 3))  # cheeks lit, nose shadow
        if y == 6:
            if x in (3, 4): return LIP_R
            return (SK, 2) if x in (2, 5) else (SK, 3)                                # smile corners
        return (SK, 2 + (x in (3, 4)))                                                # chin
    S.paint(B['head']['front'], face)
    S.paint(B['head']['top'], lambda x, y, w, h: (SK, 1) if x in (3, 4) and y >= 5 else curls(H, x, y, 2, 3))
    S.paint(B['head']['back'], lambda x, y, w, h: curls(H, x, y, 3, 2 + (y < 2)))
    S.paint(B['head']['bottom'], lambda x, y, w, h: (SK, 2) if 2 <= x <= 5 and y <= 5 else (H, 1))
    S.paint(B['head']['right'], lambda x, y, w, h: (SK, 3) if x >= 6 and 3 <= y <= 6 and not (x == 7 and y == 3) else curls(H, x, y, 4, 2 + (y < 2)))
    S.paint(B['head']['left'], lambda x, y, w, h: (SK, 2) if x <= 0 and 4 <= y <= 6 else curls(H, x, y, 5, 2 + (y < 2)))
    # gold stud on the visible ear side
    S.p[B['head']['right'][0] + 5, B['head']['right'][1] + 5] = tuple(GOLD[4]) + (255,)

    # --- hat layer: volume of curls on top, sides and back; nothing over the face
    S.paint(O['head']['top'], lambda x, y, w, h: None if (x in (3, 4) and y >= 4) or _h(x, y, 9) < 0.25 else curls(H, x, y, 6, 3))
    S.paint(O['head']['front'], lambda x, y, w, h: curls(H, x, y, 7, 3) if (y == 0 and x not in (3, 4)) or (x in (0, 7) and _h(x, y, 7) > 0.35) else None)
    for k, sd in (('right', 8), ('left', 9)):
        S.paint(O['head'][k], lambda x, y, w, h, sd=sd: curls(H, x, y, sd, 2 + (y < 3)) if _h(x, y, sd) > 0.3 else None)
    S.paint(O['head']['back'], lambda x, y, w, h: curls(H, x, y, 10, 2 + (y < 3)) if _h(x, y, 10) > 0.15 else None)
    S.paint(O['head']['bottom'], lambda x, y, w, h: curls(H, x, y, 11, 1) if y >= 6 or x in (0, 7) else None)

    # --- body: sand tunic with the rust sash across, neck cloth (the sun wrap, worn down), gold necklace
    def tunic(side):
        def fn(x, y, w, h):
            if y in (7, 8): return (RUST, 3 + (y == 7))                                   # waist sash
            if side == 'front':
                if y == 0: return (SK, 3) if 2 <= x <= 5 else (RUST, 3)                   # neckline, cloth on shoulders
                if y == 1: return GOLD[3] if x in (2, 5) else ((SK, 3) if x in (3, 4) else (RUST, 2))   # fine gold chain
                if y == 2 and x in (3, 4): return GOLD[4] if x == 3 else (SK, 2)          # small pendant
                if abs(x - (y - 1)) == 0 and 2 <= y < 7: return (RUST, 3)                  # diagonal sash
            if side == 'back':
                if y <= 4 and not (y == 4 and x in (0, 7)): return curls(H, x, y, 12, 2 + (y < 2))   # long hair down the back
                if abs((w - 1 - x) - (y - 1)) == 0 and 2 <= y < 7: return (RUST, 3)
            if side in ('right', 'left') and y == 0: return (RUST, 3)
            return (SAND, linen(x, y, w, h) - (side in ('right', 'left')))
        return fn
    S.each('body', tunic)
    S.paint(B['body']['top'], lambda x, y, w, h: (RUST, 3) if x in (0, 1, 6, 7) else (SK, 4))
    S.paint(B['body']['bottom'], lambda x, y, w, h: (PALE, 2))
    # jacket layer: curls spilling past the shoulders at the back, tunic skirts below the sash
    S.paint(O['body']['back'], lambda x, y, w, h: curls(H, x, y, 13, 2) if (y <= 5 and _h(x, y, 13) > 0.25 and not (y == 5 and x in (0, 1, 6, 7))) or (y == 6 and x in (2, 4) ) else ((SAND, linen(x, y, w, h) - 1) if y >= 9 else None))
    S.paint(O['body']['front'], lambda x, y, w, h: curls(H, x, y, 14, 2) if (x in (0, 7) and y <= 2 and _h(x, y, 14) > 0.3) else ((SAND, linen(x, y, w, h)) if y >= 9 and not (y == 11 and x in (3, 4)) else ((RUST, 2) if y == 9 and False else None)))
    for k in ('right', 'left'):
        S.paint(O['body'][k], lambda x, y, w, h: (SAND, 2 + (x % 2)) if y >= 9 else None)

    # --- arms: short tunic sleeves, bare forearms, bead bracelets on the right wrist
    def arm(right):
        def side(k):
            def fn(x, y, w, h):
                if y <= 3: return (SAND, linen(x, y, w, h) - (k in ('right', 'left')))
                if y == 4: return (RUST, 3)                                               # sleeve hem
                if right and y == 9: return SILVER[4] if (x + (k == 'back')) % 2 == 0 else LINER   # silver bangle + black cord
                if right and y == 10 and k in ('front', 'right'): return GOLD[4] if x % 2 else None
                return skin_tone(SK, x, y, w, h, k)
            return fn
        return side
    S.each('rarm', arm(True)); S.each('larm', arm(False))
    for a in ('rarm', 'larm'):
        S.paint(B[a]['top'], lambda x, y, w, h: (SAND, 4)); S.paint(B[a]['bottom'], lambda x, y, w, h: (SK, 2))

    # --- legs: loose pale trousers wrapped in rust at the ankle, wrapped sandals
    def legs(k):
        def fn(x, y, w, h):
            if y >= 11: return (LEATHER, 2 + (x % 2)) if k == 'front' and x in (1, 2) else (SK, 2 + (x == 1))   # sandal straps, feet
            if y >= 9: return (RUST, 2 + (x + y) % 2)
            return (PALE, linen(x, y, w, h) - ((x + y) % 5 == 0) - (k in ('right', 'left')))
        return fn
    for lg in ('rleg', 'lleg'):
        S.each(lg, legs)
        S.paint(B[lg]['top'], lambda x, y, w, h: (PALE, 3)); S.paint(B[lg]['bottom'], lambda x, y, w, h: (DARKLEA, 1))
        S.paint(O[lg]['front'], lambda x, y, w, h: (LEATHER, 3) if y == 11 or (y == 10 and x in (1, 2)) else None)
    return S.im


# =====================================================================================================  Lorcan
def lorcan():
    S = Skin(slim=False); B, O = S.B, S.O; H, SK = HAIR_L, SKIN_L

    def face(x, y, w, h):
        if y <= 1: return curls(H, x, y, 21, 2 + (y == 0))
        if y == 2: return curls(H, x, y, 21, 2) if x in (0, 1, 2, 5, 7) else (SK, 4)    # curls falling on the forehead
        if y == 3:
            if x in (1, 2, 5, 6): return (H, 1)                                            # thick dark brows
            if x in (0, 7): return (H, 2)
            return (SK, 3 + (x in (3, 4)))
        if y == 4:
            if x in (2, 5): return IRIS_L
            if x in (1, 6): return WHITE
            return (SK, 3) if x in (0, 7) else (SK, 4 - (x == 4))
        if y == 5:
            if x in (3, 4): return (BEARD, 1)                                              # moustache
            if x in (2, 5): return (BEARD, 2)
            return (SK, 3 - (x in (0, 7)))
        if y == 6:
            if x in (3, 4): return LIP_L
            if x in (2, 5): return (BEARD, 1)                                              # moustache corners down
            return (SK, 2 + (x in (1, 6)))
        if x in (3, 4): return (BEARD, 0 + (x == 3))                                      # chin beard
        if x in (2, 5): return (BEARD, 2)
        return (SK, 2) if x in (1, 6) else (BEARD, 3)                                      # jaw stubble
    S.paint(B['head']['front'], face)
    S.paint(B['head']['top'], lambda x, y, w, h: curls(H, x, y, 22, 3))
    S.paint(B['head']['back'], lambda x, y, w, h: curls(H, x, y, 23, 2 + (y < 3)) if y < 6 else ((SK, 2) if y == 7 else curls(H, x, y, 23, 1)))
    S.paint(B['head']['bottom'], lambda x, y, w, h: (BEARD, 2) if y <= 2 and 1 <= x <= 6 else (SK, 2))
    def side(mirror):
        def fn(x, y, w, h):
            fx = x if not mirror else w - 1 - x                     # fx: 7 = front edge
            if y <= 2: return curls(H, x, y, 24 + mirror, 2 + (y == 0))
            if fx >= 6 and y <= 4: return (H, 2)                     # sideburn
            if fx >= 5 and y >= 5: return (BEARD, 3 - (y == 7))      # stubble along the jaw
            if fx in (3, 4) and y in (4, 5): return (SK, 2 + (fx == 3 and y == 4))   # ear
            if fx <= 2 and y <= 4: return curls(H, x, y, 26, 2)
            return (SK, 3 - (fx <= 2))
        return fn
    S.paint(B['head']['right'], side(False)); S.paint(B['head']['left'], side(True))

    # hat layer: the big curly top, curls tumbling over the brow and round the ears
    S.paint(O['head']['top'], lambda x, y, w, h: curls(H, x, y, 27, 3) if _h(x, y, 27) > 0.1 else None)
    S.paint(O['head']['front'], lambda x, y, w, h: curls(H, x, y, 28, 3) if y == 0 or (y == 1 and x not in (3, 4)) or (y == 2 and x in (1, 5)) else None)
    for k, m in (('right', False), ('left', True)):
        S.paint(O['head'][k], lambda x, y, w, h, m=m: curls(H, x, y, 29 + m, 2 + (y == 0)) if y <= 1 or (y <= 3 and ((w - 1 - x) if m else x) <= 4 and _h(x, y, 29) > 0.3) else None)
    S.paint(O['head']['back'], lambda x, y, w, h: curls(H, x, y, 31, 2) if y <= 3 or (y <= 5 and _h(x, y, 31) > 0.4) else None)

    # --- body: oilskin coat, moss collar, bone toggles, a glint of gold chain at the neck
    def coat(k):
        def fn(x, y, w, h):
            if k == 'front' and y == 0 and 2 <= x <= 5: return GOLD[4] if x in (2, 5) else (SK, 2)
            if y <= 1: return (MOSS, 3 - y + (x % 2))
            if k == 'front' and x in (3, 4):
                return (BONE, 4) if x == 4 and y in (3, 6, 9) else (OIL, 1 if x == 3 else 3)
            if y == 8: return (ROPE, 2 + (x % 2))                                            # rope belt
            return (OIL, sheen(x, y, w, h) - (k in ('right', 'left')))
        return fn
    S.each('body', coat)
    S.paint(B['body']['top'], lambda x, y, w, h: (MOSS, 3)); S.paint(B['body']['bottom'], lambda x, y, w, h: (OIL, 1))
    # jacket layer: coat skirts over the hips, collar stands up at the back
    S.paint(O['body']['front'], lambda x, y, w, h: ((OIL, sheen(x, y, w, h)) if x not in (3, 4) else (OIL, 1 + (x == 4))) if y >= 9 else None)
    S.paint(O['body']['back'], lambda x, y, w, h: (MOSS, 2 + (x % 2)) if y == 0 else ((OIL, sheen(x, y, w, h)) if y >= 9 else None))
    for k in ('right', 'left'):
        S.paint(O['body'][k], lambda x, y, w, h: (OIL, 1 + (x % 2)) if y >= 9 else None)

    def arm(k):
        def fn(x, y, w, h):
            if y == 11: return skin_tone(SK, x, y, w, h, k)                               # hands
            if y == 10: return (MOSS, 2)                                                   # cuff
            return (OIL, sheen(x, y, w, h) - (k in ('right', 'left')))
        return fn
    for a in ('rarm', 'larm'):
        S.each(a, arm)
        S.paint(B[a]['top'], lambda x, y, w, h: (OIL, 3)); S.paint(B[a]['bottom'], lambda x, y, w, h: (SK, 2))

    # --- legs: patched peat trousers, waders to the thigh with a rope strap
    def legs(right):
        def fn_side(k):
            def fn(x, y, w, h):
                if y < 2:
                    if right and k == 'front' and y == 1 and x in (1, 2): return (PATCH, 3)
                    return (PEAT, weave(x, y, w, h))
                if y == 2: return (ROPE, 2)
                return (WADER, 3 + (x == 1) - (y == 11) + ((x + y) % 7 == 0) - (k in ('right', 'left')))
            return fn
        return fn_side
    S.each('rleg', legs(True)); S.each('lleg', legs(False))
    for lg in ('rleg', 'lleg'):
        S.paint(B[lg]['top'], lambda x, y, w, h: (PEAT, 3)); S.paint(B[lg]['bottom'], lambda x, y, w, h: (WADER, 1))
    return S.im


SKINS = {'reikia_cinderhale': (reikia, True), 'lorcan_duskmire': (lorcan, False)}

if __name__ == '__main__':
    out = (sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'Hollow_Crown_Skins')).rstrip('/') + '/'
    os.makedirs(out, exist_ok=True)
    for name, (fn, _slim) in SKINS.items():
        fn().save(out + name + '.png'); print(out + name + '.png')
