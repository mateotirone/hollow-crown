"""All nine soldier types: models, skins, client entities, animations and starter behaviour files.

Run from anywhere:   python3 studio/art/build_soldiers.py [repo root]

Types: Man-at-Arms, Archer (the old guards, repainted), Pikeman, Shieldbearer, Crossbowman, Knight,
Ram crew, Trebuchet crew, Sapper.

How a soldier looks (Mateo 2026-11-12):
  * Army colour: every soldier wears its settlement's banner colour where you can always see it, whatever armour
    it has on: the tabard (the guard armour leaves a window over it), a cloth armband on both arms that sits over the
    armour, and the coloured part of its gear (shield face, lance pennon, pavise, satchel flap, crest).
  * Region: a different set of clothes for each region, picked by the int property siege:region
    (0 vale, 1 frostmarch, 2 saltreach, 3 emberwaste, 4 blackfen, 5 hollow). Events siege:region_0..5 set it.
  * Armour tier: Gambeson is the bare skin; tiers 1-4 are the guard armour line siege:guardgear_<tier>_<piece>,
    worn over it. The type's gear sits outside the armour so it shows at every tier.

Every skin is baked (type x region x colour, 128x64: the player layout on the left, the gear on the right),
because a baked texture works with the plain alphatest material. controller.render.hc_soldier picks
Array.skins[region * 16 + variant].

Writes (never hand-edit these):
  RP models/entity/soldiers/<id>.geo.json, textures/entity/soldiers/<id>/<region>_<colour>.png,
     entity/<id>.entity.json, render_controllers/hc_soldier.render_controllers.json,
     animations/soldiers.animation.json
  BP entities/<id>.json for the seven new types (cloned from the guards, only when missing, so the sieges thread
     owns behaviour after the first run), loot_tables/entities/siege_<id>_gear.json; adds siege:region to all nine.
  studio/soldiers/data.json for the 3D preview (studio/soldiers/build_preview.py).
"""
import copy, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from palette import M, dye_ramp, fixed, ramp, DYE
from texlib import Tex, R

ROOT = (sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))).rstrip('/') + '/'
RP, BP = ROOT + 'Siege_Nights_RP/', ROOT + 'Siege_Nights_BP/'
COLORS = ["white", "orange", "magenta", "light_blue", "yellow", "lime", "pink", "gray",
          "light_gray", "cyan", "purple", "blue", "brown", "green", "red", "black"]
REGION_IDS = ["vale", "frostmarch", "saltreach", "emberwaste", "blackfen", "hollow"]
TYPES = ["man_at_arms", "archer", "pikeman", "shieldbearer", "crossbowman", "knight", "ram_crew", "trebuchet_crew", "sapper"]
NAMES = {"man_at_arms": "Man-at-Arms", "archer": "Archer", "pikeman": "Pikeman", "shieldbearer": "Shieldbearer",
         "crossbowman": "Crossbowman", "knight": "Knight", "ram_crew": "Ram Crew", "trebuchet_crew": "Trebuchet Crew", "sapper": "Sapper"}
SK = M['skin']; IRON = M['iron']; STEEL = M['steel']; BS = M['blacksteel']; GOLD = M['gold']; OAK = M['oak']; DOAK = M['dark_oak']; ROPE = M['rope']

# ---------------------------------------------------------------- regional wardrobes
# cloth: the padded undercoat (gambeson); hose: legs; lea: leather; wood: shafts and boards; trim: the region's own
# extra (fur, rope, sash, mud, vein); emb: the tabard emblem metal; jerkin: archer/crew jacket.
W = {
    'vale': dict(cloth=fixed('#6a5e48', '#8e826a', '#b0a488', '#cdc2a6', '#e2d9c0', '#f2ecda'),
                 hose=fixed('#1c1a22', '#2a2830', '#3a3840', '#4c4a52', '#605e66', '#787680'),
                 lea=M['leather'], wood=OAK, emb=GOLD,
                 jerkin=fixed('#1e2a1a', '#2f4226', '#445c34', '#5c7846', '#7a965e', '#9cb480'), trim=None),
    'frostmarch': dict(cloth=ramp('#7c8796', 0.16, 0.80, cool=0.14), hose=ramp('#2a3446', 0.07, 0.42),
                       lea=M['spruce'], wood=M['spruce'], emb=fixed('#3b4a5c', '#5e7488', '#8aa4b8', '#b4cede', '#d8ecf6', '#f4fbff'),
                       jerkin=ramp('#3e4c5e', 0.09, 0.55), trim=fixed('#6e6a66', '#8e8984', '#b2ada6', '#d0cbc2', '#e6e2da', '#f6f4ee')),
    'saltreach': dict(cloth=ramp('#d6ccb0', 0.30, 0.90, sat=0.7), hose=ramp('#2f6460', 0.10, 0.55),
                      lea=ramp('#8a7a66', 0.14, 0.66, sat=0.7), wood=ramp('#a29482', 0.16, 0.78, sat=0.8), emb=fixed('#0e4c4a', '#17706a', '#2f9a90', '#5cc4b4', '#9ce4d4', '#dcfff6'),
                      jerkin=ramp('#3a6a74', 0.10, 0.60), trim=ROPE),
    'emberwaste': dict(cloth=ramp('#c8a06a', 0.20, 0.82), hose=ramp('#7a3a22', 0.10, 0.52),
                       lea=ramp('#8a4a2a', 0.10, 0.60), wood=ramp('#9a6a42', 0.12, 0.66), emb=GOLD,
                       jerkin=ramp('#a4683c', 0.12, 0.66), trim=ramp('#b0402a', 0.12, 0.66)),
    'blackfen': dict(cloth=ramp('#5c6644', 0.10, 0.60), hose=ramp('#3a2e24', 0.07, 0.40),
                     lea=ramp('#4c3a2a', 0.07, 0.48), wood=DOAK, emb=fixed('#2a2c1a', '#44482a', '#686c3e', '#8c9258', '#b2b67a', '#d6d8a4'),
                     jerkin=ramp('#3e4a32', 0.08, 0.50), trim=ramp('#4a3c2c', 0.06, 0.42)),
    'hollow': dict(cloth=ramp('#4e4262', 0.08, 0.56), hose=ramp('#241c30', 0.05, 0.34),
                   lea=ramp('#3a3040', 0.06, 0.44), wood=ramp('#4a3a52', 0.08, 0.50), emb=fixed('#2a4a66', '#3c6e92', '#5c9cc4', '#8ccaee', '#c2ecff', '#f2fbff'),
                   jerkin=ramp('#3c3050', 0.07, 0.48), trim=fixed('#4a0c3c', '#7c1462', '#b02a8c', '#e04cb4', '#f88ad2', '#ffd0f0')),
}

# ---------------------------------------------------------------- painting helpers
def box_faces(u, v, w, h, d):
    return {'top': (u + d, v, w, d), 'bottom': (u + d + w, v, w, d), 'right': (u, v + d, d, h), 'front': (u + d, v + d, w, h),
            'left': (u + d + w, v + d, d, h), 'back': (u + 2 * d + w, v + d, w, h)}
def part(t, box, paint):
    for face, (x0, y0, fw, fh) in box_faces(*box).items():
        for j in range(fh):
            for i in range(fw):
                c = paint(face, i, j, fw, fh)
                if c is not None: t.set(x0 + i, y0 + j, c)

HEAD, BODY, RARM, RLEG, LLEG, LARM = (0, 0, 8, 8, 8), (16, 16, 8, 12, 4), (40, 16, 4, 12, 4), (0, 16, 4, 12, 4), (16, 48, 4, 12, 4), (32, 48, 4, 12, 4)

def face_px(i, j, shade=0, brows=None):
    s = lambda k: R(SK, k - shade)
    if j == 4 and i in (1, 5): return (236, 236, 230)
    if j == 4 and i in (2, 6): return R(M['coal'], 1)
    if j == 3 and i in (1, 2, 5, 6): return R(brows or DOAK, 1)
    if j == 5 and i in (3, 4): return s(2)
    if j == 6 and 2 <= i <= 5: return s(1)
    if j == 7: return s(2)
    return s(4 if (i < 4 and j < 5) else 3)
def quilt(rp, i, j, base=3):
    return R(rp, base - (1 if i % 2 == 1 and j % 4 != 0 else 0) - (1 if j % 4 == 3 else 0) + (1 if j == 0 else 0))

# 4-wide tabard emblems (cols 2..5 of the chest front; the armour window). X = metal, D = dark metal
EMBLEM = {
    'man_at_arms':   ["X.XX.X", "XXXXXX", ".XXXX.", ".XDDX.", "XXXXXX"],  # the old tower, 6 wide
    'pikeman':       [".XX.", ".XX.", "XXXX", ".XX.", ".XX.", ".XX."],
    'shieldbearer':  ["XXXX", "XDDX", "XDDX", "XDDX", ".XX."],
    'crossbowman':   ["XXXX", "X..X", ".XX.", ".XX.", ".XX."],
    'knight':        ["X..X", "XXXX", "XDDX", "XXXX"],
    'ram_crew':      ["XXXX", "XXXX", ".XX.", ".XX.", ".XX."],
    'trebuchet_crew': [".XX.", "XXXX", "XDDX", "XXXX", ".XX."],
    'sapper':        ["..X.", ".X..", ".XX.", "XXXX", "XDDX", ".XX."],
}

def paint_skin(kind, region, color):
    """The 64x64 player-layout part of a soldier's skin."""
    P = W[region]; D = dye_ramp(color); C, H, L, J, TR = P['cloth'], P['hose'], P['lea'], P['jerkin'], P['trim']
    emb = P['emb'] if color not in ('yellow', 'orange') or P['emb'] is not GOLD else BS
    t = Tex(128, 64)
    hood = kind in ('archer', 'sapper') or region == 'blackfen'
    wrap = region == 'emberwaste' and not hood
    fur = region == 'frostmarch'
    crew = kind in ('ram_crew', 'trebuchet_crew', 'sapper')
    jerk = kind in ('archer', 'crossbowman') or crew
    hood_col = D if kind == 'archer' else (J if kind == 'sapper' else P['cloth'])

    def head(face, i, j, fw, fh):
        if face == 'bottom': return R(SK, 1)
        if hood:
            if face == 'front':
                if j <= 1 or i in (0, 7): return R(hood_col, 4 if j == 0 else 2 if j == 1 else 3)
                if kind == 'sapper' and j >= 6: return R(M['coal'], 2 + (i + j) % 2)        # soot scarf over the mouth
                return face_px(i, j, 1 if j == 2 else 0)
            return R(hood_col, 3 + (1 if face == 'top' and j < 4 else 0) - (1 if (i + j) % 5 == 0 else 0) - (1 if j == fh - 1 and face != 'top' else 0))
        if wrap:                                                                          # desert head wrap and face veil
            band = TR if j in (1, 2) else C
            if face == 'front':
                if j <= 2 or i in (0, 7): return R(band, 4 if j == 0 else 3)
                if j >= 5: return R(C, 3 - (j == 7) + (i % 3 == 0))
                return face_px(i, j)
            return R(band, 3 + (face == 'top') - ((i + j) % 4 == 0))
        if fur:                                                                           # fur-lined cap
            if face == 'front':
                if j <= 1 or i in (0, 7): return R(TR, 4 - (i + j) % 2)
                return face_px(i, j)
            return R(TR, 3 + (face == 'top') - (i * 3 + j) % 4 // 3)
        if crew and kind == 'ram_crew':                                                   # bare head, banner headband
            if face == 'front':
                if j == 1: return R(D, 3)
                if j == 0 or i in (0, 7) and j < 3: return R(DOAK, 2)
                return face_px(i, j)
            if j == 1 and face != 'top': return R(D, 3 - (face == 'back'))
            return R(DOAK, 2 + ((i + j) % 3 == 0))
        if face == 'front':                                                               # arming cap (padded coif)
            if j <= 1 or i in (0, 7): return quilt(C, i, j, 4 if j == 0 else 3)
            return face_px(i, j)
        cap = D if kind == 'knight' else C
        return quilt(cap, i, j, 4 if face == 'top' else 3)

    def body(face, i, j, fw, fh):
        if face == 'bottom': return R(H, 1)
        if face == 'top': return (R(D, 4) if 1 <= i <= 6 else R(TR if fur else C, 4))
        if fur and j <= 1: return R(TR, 4 - (i + j) % 2)                                   # fur collar
        if face in ('front', 'back'):
            if j == 8:                                                                    # belt
                if region == 'saltreach': return R(ROPE, 3 + (i % 2))
                if region == 'emberwaste': return R(TR, 3)
                return R(L, 1) if i not in (3, 4) or face == 'back' else R(emb, 4)
            if region == 'hollow' and face == 'front' and j == 9 and i in (3, 4): return R(P['emb'], 4)
            in_tab = 2 <= i <= 5 if jerk else 1 <= i <= 6
            if in_tab:
                e = EMBLEM.get(kind)
                if face == 'front' and e:
                    off = 1 if len(e[0]) == 6 else 2
                    jj = j - 2
                    if 0 <= jj < len(e) and 0 <= i - off < len(e[0]) and e[jj][i - off] != '.':
                        return R(emb, 1 if e[jj][i - off] == 'D' else 4 if i < 4 else 3)
                return R(D, 3 + (j == 0) - (i == (5 if jerk else 6)) - (j in (7, 11)))
            if kind == 'archer' and face == 'back' and i in (6, 7) and 2 <= j <= 10: return R(L, 3 - (i == 7))
            if jerk:
                if kind == 'ram_crew' and region != 'frostmarch': return R(L, 3 - (i in (0, 7)) - (j == 11))   # leather apron
                return R(J, 3 - (i in (0, 7)) - (j == 11) + (j == 0))
            if region == 'saltreach' and j % 3 == 0: return R(P['hose'], 3)                # sailor stripes
            return quilt(C, i, j)
        if jerk: return R(J, 2 + (j == 0))
        if region == 'saltreach' and j % 3 == 0: return R(P['hose'], 3)
        return quilt(C, i, j, 2)

    def arm(face, i, j, fw, fh):
        if face == 'top': return R(D, 3) if kind in ('archer', 'knight') else R(TR if fur else C, 4)
        if face == 'bottom': return R(L, 1) if not crew else R(SK, 2)
        if fur and j <= 1: return R(TR, 4 - (i + j) % 2)
        if kind == 'archer' and j <= 1: return R(D, 3 - j)
        if crew:                                                                          # rolled sleeves, bare forearms
            if j >= 7: return R(SK, 3 - (i == fw - 1) + (j == 7 and kind != 'sapper')) if not (kind == 'sapper' and (i + j) % 3 == 0) else R(M['coal'], 3)
            if j == 6: return R(C, 4)
        if kind in ('archer', 'crossbowman') and 7 <= j <= 9: return R(L, 4 if j == 7 else 2 if i < fw - 1 else 1)
        if j >= 9: return R(L, 3 if j == 9 else 2 - (i == fw - 1))                        # leather gauntlet
        if region == 'saltreach' and j % 3 == 0: return R(P['hose'], 3)
        if jerk and kind != 'ram_crew': return R(J, 3 - (face in ('left', 'back')))
        return quilt(C, i, j, 3 if face in ('front', 'right') else 2)

    def leg(face, i, j, fw, fh):
        if face == 'top': return R(H, 2)
        if face == 'bottom': return R(L, 0)
        mud = region == 'blackfen' and j >= 6 and (i * 7 + j * 3) % 5 < 2 + (j >= 9)
        if mud: return R(TR, 2 + (i + j) % 2)
        if j <= 1 and face in ('front', 'back') and not jerk: return R(D, 2 if j == 1 else 3)  # tabard skirt
        if fur and j in (7, 8): return R(TR, 4 - (i + j) % 2)                              # fur boot tops
        if region == 'emberwaste' and j == 7: return R(TR, 3)                              # boot binding
        if j >= 8 or (kind in ('archer', 'knight') and j >= 7): return R(L, 3 if j in (7, 8) and (j == 8 or kind in ('archer', 'knight')) else 2 if i < fw - 1 else 1)
        return R(H, 3 - (i == fw - 1) + (j == 4 and i == 1))
    for box, fn in ((HEAD, head), (BODY, body), (RARM, arm), (LARM, arm), (RLEG, leg), (LLEG, leg)): part(t, box, fn)
    if region == 'hollow':                                                                # faint magenta vein stitching
        for (x, y) in [(20, 23), (21, 24), (22, 25), (44, 22), (45, 23), (36, 55), (37, 56), (5, 24), (21, 55)]:
            t.set(x, y, R(P['trim'], 3))
    return t

# ---------------------------------------------------------------- gear (right half of the skin)
class Atlas:
    """Shelf-packs box-UV regions into x 64..127."""
    def __init__(self): self.x, self.y, self.row = 64, 0, 0
    def take(self, w, h, d):
        bw, bh = 2 * d + 2 * w, d + h
        bw, bh = int(-(-bw // 1)), int(-(-bh // 1))
        if self.x + bw > 128: self.x, self.y, self.row = 64, self.y + self.row, 0
        if self.y + bh > 64: raise SystemExit(f'gear atlas full ({w},{h},{d})')
        u, v = self.x, self.y; self.x += bw; self.row = max(self.row, bh); return [u, v]

def ceil(v): return int(-(-v // 1))

def gear_paint(kind_of, P, D, emblem):
    """Returns paint(face,i,j,fw,fh) for a gear cube by its material name."""
    W_, L, emb = P['wood'], P['lea'], P['emb']
    def wood(f, i, j, fw, fh): return R(W_, 3 - (i == fw - 1) + (j % 7 == 0 and f not in ('top', 'bottom')))
    def iron(f, i, j, fw, fh): return R(IRON, 4 if (j == 0 or f == 'top') else 3 - (i == fw - 1))
    def steel_tip(f, i, j, fw, fh): return R(STEEL, 5 if j < 1 else 4 - (i == fw - 1))
    def cloth(f, i, j, fw, fh): return R(D, 3 + (j == 0) - (i == fw - 1) - (j == fh - 1))
    def band(f, i, j, fw, fh): return R(D, 4 if j == 0 else 3) if f not in ('top', 'bottom') else None
    def leather(f, i, j, fw, fh): return R(L, 3 - (i == fw - 1) - (j == fh - 1) + (j == 0))
    def rope(f, i, j, fw, fh):
        if f in ('front', 'back') and 1 <= i < fw - 1 and 1 <= j < fh - 1: return None   # hole in the coil
        return R(ROPE, 3 + ((i + j) % 2) - (j == fh - 1))
    def plume(f, i, j, fw, fh): return R(D, 4 - (j + i) % 3 // 2 - (j == fh - 1))
    def shield(f, i, j, fw, fh):                                                           # banner face, iron rim, emblem
        if f in ('top', 'bottom') or min(fw, fh) <= 1: return R(IRON, 3)
        if i == 0 or j == 0 or i == fw - 1 or j == fh - 1: return R(IRON, 4 if (i == 0 or j == 0) else 2)
        cx = fw // 2
        if emblem == 'tower':
            if abs(i - cx + 0.5) < 1.6 and 2 <= j <= fh - 3: return R(emb, 4)
            if j in (3, 4) and 2 <= i <= fw - 3: return R(emb, 4 if j == 3 else 3)
        elif emblem == 'chevron':
            if abs(abs(i - (fw - 1) / 2) - (j - 2) * 0.8) < 0.9 and j >= 2: return R(emb, 4)
        elif emblem == 'bend':
            if abs(i - j * fw / fh) < 1.2: return R(emb, 4)
        return R(D, 3 + (j < fh // 3) - (j > fh * 2 // 3) - (i == fw - 2))
    return dict(wood=wood, iron=iron, steel_tip=steel_tip, cloth=cloth, band=band, leather=leather, rope=rope,
                plume=plume, shield=shield)

# Gear: (bone, parent, pivot, [(origin, size, material, extra)]). Bedrock model space: front is -z, the right arm
# is at negative x, hand at about (-6, 13, 0) / (6, 13, 0).
BAND = [("rightBand", "rightArm", [-5, 22, 0], [([-8, 19.5, -2], [4, 0, 4], 'band', {"inflate": 1.06})]),
        ("leftBand", "leftArm", [5, 22, 0], [([4, 19.5, -2], [4, 0, 4], 'band', {"inflate": 1.06})])]
GEAR = {
    'man_at_arms': [],
    'archer': [],
    'pikeman': [
        ("pike", "rightArm", [-6, 13, 0], [
            ([-6.5, 1, -0.5], [1, 43, 1], 'wood', {}),
            ([-7, 44, -0.5], [2, 3, 1], 'steel_tip', {}),
            ([-6.5, 47, -0.5], [1, 2, 1], 'steel_tip', {}),
            ([-7, 41, -1], [2, 3, 2], 'iron', {}),          # langets
            ([-5, 39, 0], [3, 4, 0], 'cloth', {}),          # banner tassel
        ])],
    'shieldbearer': [
        ("pavise", "leftArm", [6, 13, 0], [
            ([9.5, 3, -7], [1, 21, 14], 'shield:tower', {}),
            ([9, 11, -1], [1, 4, 2], 'leather', {}),         # grip strap
        ])],
    'crossbowman': [   # holds the vanilla crossbow (Mateo 2026-11-12), so only the pavise is modelled
        ("backPavise", "body", [0, 24, 0], [([-4.5, 9, 3.3], [9, 14, 1], 'shield:chevron', {})])],
    'knight': [
        ("lance", "rightArm", [-6, 13, 0], [
            ([-6.5, 1, -0.5], [1, 50, 1], 'wood', {}),
            ([-7.5, 14, -1.5], [3, 3, 3], 'iron', {}),       # vamplate over the hand
            ([-6.5, 51, -0.5], [1, 3, 1], 'steel_tip', {}),
            ([-5.5, 44, 0], [6, 5, 0], 'cloth', {}),         # pennon
        ]),
        ("kite", "leftArm", [6, 13, 0], [([9.5, 5, -4], [1, 14, 8], 'shield:bend', {})]),
        ("crest", "head", [0, 24, 0], [([-0.5, 33, -3], [1, 4, 7], 'plume', {})])],
    'ram_crew': [],
    'trebuchet_crew': [
        ("mallet", "rightArm", [-6, 13, 0], [
            ([-6.5, 3, -0.5], [1, 11, 1], 'wood', {}),
            ([-8, 0, -1.5], [4, 3, 3], 'wood', {}),
        ]),
        ("coil", "body", [0, 24, 0], [([-3.5, 13, 3.3], [7, 7, 1], 'rope', {})])],
    'sapper': [
        ("satchel", "body", [0, 24, 0], [
            ([-3.5, 12, 3.3], [7, 7, 3], 'leather', {}),
            ([-3.5, 16, 3.1], [7, 3.5, 3.4], 'cloth', {}),   # banner flap
            ([2.5, 9, -3.5], [2, 3, 2], 'rope', {}),         # a bundled charge on the belt
        ])],
}

def base_bones():
    return [
        {"name": "root", "pivot": [0, 0, 0]},
        {"name": "waist", "parent": "root", "pivot": [0, 12, 0]},
        {"name": "body", "parent": "waist", "pivot": [0, 24, 0], "cubes": [{"origin": [-4, 12, -2], "size": [8, 12, 4], "uv": [16, 16]}]},
        {"name": "head", "parent": "body", "pivot": [0, 24, 0], "cubes": [{"origin": [-4, 24, -4], "size": [8, 8, 8], "uv": [0, 0]}]},
        {"name": "rightArm", "parent": "body", "pivot": [-5, 22, 0], "cubes": [{"origin": [-8, 12, -2], "size": [4, 12, 4], "uv": [40, 16]}]},
        {"name": "rightItem", "parent": "rightArm", "pivot": [-6, 15, 1]},
        {"name": "leftArm", "parent": "body", "pivot": [5, 22, 0], "cubes": [{"origin": [4, 12, -2], "size": [4, 12, 4], "uv": [32, 48]}]},
        {"name": "leftItem", "parent": "leftArm", "pivot": [6, 15, 1]},
        {"name": "rightLeg", "parent": "root", "pivot": [-1.9, 12, 0], "cubes": [{"origin": [-3.9, 0, -2], "size": [4, 12, 4], "uv": [0, 16]}]},
        {"name": "leftLeg", "parent": "root", "pivot": [1.9, 12, 0], "cubes": [{"origin": [-0.1, 0, -2], "size": [4, 12, 4], "uv": [16, 48]}]},
    ]

def build_model(kind):
    """Geometry plus a list of (uv box, material) to paint on every skin of this type."""
    atlas = Atlas(); bones = base_bones(); paints = []
    allc = [(bi, ci, c) for bi, (_, _, _, cubes) in enumerate(BAND + GEAR[kind]) for ci, c in enumerate(cubes)]
    uvs = {}
    for bi, ci, (origin, size, mat, extra) in sorted(allc, key=lambda a: -(ceil(a[2][1][1]) + ceil(a[2][1][2]))):
        w, h, d = ceil(size[0]), ceil(size[1]), ceil(size[2])
        if mat == 'band':   # a flat ring (height 0, inflated): per-face UV onto one 4x2 cloth patch
            u, v = atlas.take(2, 2, 0)
            f = {"uv": [u, v], "uv_size": [4, 2]}
            uvs[bi, ci] = {k: dict(f) for k in ("north", "south", "east", "west", "up", "down")}
            paints.append(((u, v, 4, 2, 0), 'flat'))
            continue
        uvs[bi, ci] = atlas.take(w, h, d)
        paints.append(((uvs[bi, ci][0], uvs[bi, ci][1], w, h, d), mat))
    for bi, (name, parent, pivot, cubes) in enumerate(BAND + GEAR[kind]):
        out = [{"origin": o, "size": s_, "uv": uvs[bi, ci], **ex} for ci, (o, s_, m, ex) in enumerate(cubes)]
        bones.append({"name": name, "parent": parent, "pivot": pivot, "cubes": out})
    geo = {"format_version": "1.12.0", "minecraft:geometry": [{
        "description": {"identifier": f"geometry.hc.soldier.{kind}", "texture_width": 128, "texture_height": 64,
                        "visible_bounds_width": 4, "visible_bounds_height": 4.5, "visible_bounds_offset": [0, 1.5, 0]},
        "bones": bones}]}
    return geo, paints

def paint_gear(t, paints, region, color):
    P = W[region]; D = dye_ramp(color)
    for box, mat in paints:
        if mat == 'flat':
            u, v, w, h, _ = box
            for j in range(h):
                for i in range(w): t.set(u + i, v + j, R(D, 4 if j == 0 else 2 if i == w - 1 else 3))
            continue
        name, _, em = mat.partition(':')
        fn = gear_paint(name, P, D, em)[name]
        part(t, box, fn)

# ---------------------------------------------------------------- animations
def r(x=0, y=0, z=0):
    f = lambda v: v if isinstance(v, str) else float(v)
    return [f(x), f(y), f(z)]
MV, RDY, T = "variable.hc_mv", "variable.hc_rdy", "query.life_time"
ST = f"(1.0 - {MV})"
WIND, STRIKE = "variable.hc_wind", "variable.hc_strike"

def held(bone_pose, length, ease_in=0.25, ease_out=0.3):
    """One-shot: ease into a pose, hold it, ease out. bone_pose = {bone: (rotation, position or None)}."""
    bones = {}
    for b, (rot, pos) in bone_pose.items():
        e = {"rotation": {"0.0": r(), str(ease_in): r(*rot), str(round(length - ease_out, 2)): r(*rot), str(length): r()}}
        if pos: e["position"] = {"0.0": r(), str(ease_in): r(*pos), str(round(length - ease_out, 2)): r(*pos), str(length): r()}
        bones[b] = e
    return {"loop": False, "animation_length": length, "bones": bones}

def scaled(pose, k):
    """Loop version of a pose, scaled by a Molang factor (e.g. the eased has-target value)."""
    out = {}
    for b, (rot, pos) in pose.items():
        e = {"rotation": r(*[f"{v} * {k}" if v else 0 for v in rot])}
        if pos: e["position"] = r(*[f"{v} * {k}" if v else 0 for v in pos])
        out[b] = e
    return {"loop": True, "bones": out}

A = {}
# poses: {bone: ((rx, ry, rz), (px, py, pz) or None)}
BRACE = {"rightArm": ((-62, -8, 0), None), "pike": ((152, 0, 0), None), "leftArm": ((-58, 26, 0), None),
         "body": ((10, -18, 0), None), "head": ((-8, 18, 0), None), "rightLeg": ((24, 0, 4), None), "leftLeg": ((-30, 0, -4), None)}
PIKE_CARRY = {"rightArm": ((-18, 0, 0), None), "pike": ((18, 0, 0), None)}
A["animation.hc.pikeman.carry"] = scaled(PIKE_CARRY, f"(1.0 - {RDY})")
A["animation.hc.pikeman.stance"] = scaled(BRACE, RDY)
A["animation.hc.pikeman.brace"] = held(BRACE, 2.4)
A["animation.hc.pikeman.thrust"] = {"loop": False, "animation_length": 0.7, "bones": {
    "rightArm": {"rotation": {"0.0": r(), "0.2": r(8, 0, 0), "0.35": r(-14, 0, 0), "0.7": r()}, "position": {"0.0": r(), "0.2": r(0, 0, 2), "0.35": r(0, 0, -4), "0.7": r()}},
    "leftArm": {"position": {"0.0": r(), "0.2": r(0, 0, 2), "0.35": r(0, 0, -4), "0.7": r()}},
    "body": {"rotation": {"0.0": r(), "0.2": r(-4, 0, 0), "0.35": r(10, 0, 0), "0.7": r()}}}}

SHIELD_UP = {"leftArm": ((-78, 0, 0), None), "pavise": ((0, 0, 0), (0, 0, 0)), "body": ((6, 22, 0), None), "head": ((0, -22, 0), None),
             "rightArm": ((-20, 0, 8), None), "rightLeg": ((-14, 0, 4), None), "leftLeg": ((16, 0, -4), None)}
SHIELD_UP["leftArm"] = ((-40, -45, 0), None); SHIELD_UP["pavise"] = ((-40, 80, 0), None)   # shield upright, face to the front
SHIELD_CARRY = {"leftArm": ((-12, 0, -4), None)}
A["animation.hc.shieldbearer.carry"] = scaled(SHIELD_CARRY, f"(1.0 - {RDY})")
A["animation.hc.shieldbearer.stance"] = scaled(SHIELD_UP, RDY)
A["animation.hc.shieldbearer.raise_shield"] = held(SHIELD_UP, 2.4)
A["animation.hc.shieldbearer.bash"] = {"loop": False, "animation_length": 0.6, "bones": {
    "leftArm": {"position": {"0.0": r(), "0.15": r(0, 0, 2), "0.3": r(0, 0, -5), "0.6": r()}},
    "body": {"rotation": {"0.0": r(), "0.15": r(-6, 0, 0), "0.3": r(12, 0, 0), "0.6": r()}},
    "rightLeg": {"rotation": {"0.0": r(), "0.3": r(-22, 0, 0), "0.6": r()}}}}

AIM = {"rightArm": ((-88, -6, 0), None), "leftArm": ((-84, 34, 0), None), "body": ((0, -10, 0), None), "head": ((0, 10, 0), None),
       "rightLeg": ((-6, 0, 5), None), "leftLeg": ((4, 0, -5), None)}
A["animation.hc.crossbowman.stance"] = scaled(AIM, RDY)
A["animation.hc.crossbowman.aim"] = held(AIM, 2.0)
A["animation.hc.crossbowman.reload"] = {"loop": False, "animation_length": 2.0, "bones": {   # foot in the stirrup, crank, back up
    "rightArm": {"rotation": {"0.0": r(), "0.35": r(-20, 0, 0), "1.6": r(-20, 0, 0), "2.0": r()}},
    "leftArm": {"rotation": {"0.0": r(), "0.35": r(-50, 20, 0), "0.7": r(-80, 20, 0), "1.0": r(-50, 20, 0), "1.3": r(-80, 20, 0), "1.6": r(-50, 20, 0), "2.0": r()}},
    "body": {"rotation": {"0.0": r(), "0.35": r(32, 0, 0), "1.6": r(32, 0, 0), "2.0": r()}},
    "head": {"rotation": {"0.0": r(), "0.35": r(-14, 0, 0), "1.6": r(-14, 0, 0), "2.0": r()}},
    "rightLeg": {"rotation": {"0.0": r(), "0.35": r(-46, 0, 0), "1.6": r(-46, 0, 0), "2.0": r()}}}}

RIDE = {"rightLeg": ((-72, 18, 0), None), "leftLeg": ((-72, -18, 0), None)}
COUCH = {"rightArm": ((-28, 0, 0), None), "lance": ((112, 0, 0), None), "leftArm": ((-34, -10, 0), None), "kite": ((0, 0, 0), None),
         "body": ((12, 0, 0), None), "head": ((-12, 0, 0), None)}
LANCE_CARRY = {"rightArm": ((-28, 0, 0), None), "lance": ((28, 0, 0), None)}
A["animation.hc.knight.ride"] = {"loop": True, "bones": {b: {"rotation": r(*rot)} for b, (rot, _) in RIDE.items()}}
A["animation.hc.knight.carry"] = scaled(LANCE_CARRY, f"(1.0 - {RDY})")
A["animation.hc.knight.stance"] = scaled(COUCH, RDY)
A["animation.hc.knight.charge"] = held(COUCH, 2.6, 0.35, 0.4)

SWING = {"rightArm": {"rotation": {"0.0": r(), "0.4": r(-62, 12, 0), "0.9": r(-70, 12, 0), "1.15": r(-88, 12, 0), "1.6": r()}},
         "leftArm": {"rotation": {"0.0": r(), "0.4": r(-62, -12, 0), "0.9": r(-70, -12, 0), "1.15": r(-88, -12, 0), "1.6": r()}},
         "body": {"rotation": {"0.0": r(), "0.4": r(-8, 0, 0), "0.9": r(-14, 0, 0), "1.15": r(18, 0, 0), "1.6": r()}},
         "rightLeg": {"rotation": {"0.0": r(), "0.9": r(14, 0, 0), "1.15": r(-26, 0, 0), "1.6": r()}},
         "leftLeg": {"rotation": {"0.0": r(), "0.9": r(-18, 0, 0), "1.15": r(20, 0, 0), "1.6": r()}}}
A["animation.hc.ram_crew.swing_ram"] = {"loop": False, "animation_length": 1.6, "bones": SWING}
A["animation.hc.ram_crew.push"] = {"loop": True, "bones": {                       # hands on the beam while it walks
    "rightArm": {"rotation": r(f"-64.0 * {MV}", 10, 0)}, "leftArm": {"rotation": r(f"-64.0 * {MV}", -10, 0)},
    "body": {"rotation": r(f"14.0 * {MV}", 0, 0)}}}

A["animation.hc.trebuchet_crew.load_trebuchet"] = {"loop": False, "animation_length": 2.4, "bones": {
    "rightArm": {"rotation": {"0.0": r(), "0.5": r(-30, 0, 0), "1.2": r(-170, 10, 0), "1.6": r(-150, 10, 0), "2.4": r()}},
    "leftArm": {"rotation": {"0.0": r(), "0.5": r(-30, 0, 0), "1.2": r(-170, -10, 0), "1.6": r(-150, -10, 0), "2.4": r()}},
    "body": {"rotation": {"0.0": r(), "0.5": r(38, 0, 0), "1.2": r(-8, 0, 0), "1.6": r(-4, 0, 0), "2.4": r()}},
    "head": {"rotation": {"0.0": r(), "0.5": r(-20, 0, 0), "1.2": r(-14, 0, 0), "2.4": r()}},
    "rightLeg": {"rotation": {"0.0": r(), "0.5": r(-20, 0, 0), "1.2": r(), "2.4": r()}},
    "leftLeg": {"rotation": {"0.0": r(), "0.5": r(20, 0, 0), "1.2": r(), "2.4": r()}}}}
A["animation.hc.trebuchet_crew.carry"] = {"loop": True, "bones": {"rightArm": {"rotation": r(-14, 0, 0)}, "mallet": {"rotation": r(14, 0, 0)}}}

A["animation.hc.sapper.plant_charge"] = {"loop": False, "animation_length": 2.2, "bones": {   # kneel, set the charge, spring away
    "root": {"position": {"0.0": r(), "0.35": r(0, -5, 0), "1.5": r(0, -5, 0), "1.8": r(0, 1, 2), "2.2": r()}},
    "rightLeg": {"rotation": {"0.0": r(), "0.35": r(-90, 0, 0), "1.5": r(-90, 0, 0), "1.8": r(20, 0, 0), "2.2": r()}},
    "leftLeg": {"rotation": {"0.0": r(), "0.35": r(-10, 0, 0), "1.5": r(-10, 0, 0), "1.8": r(-30, 0, 0), "2.2": r()}},
    "body": {"rotation": {"0.0": r(), "0.35": r(28, 0, 0), "1.5": r(28, 0, 0), "1.8": r(-6, 0, 0), "2.2": r()}},
    "rightArm": {"rotation": {"0.0": r(), "0.35": r(-60, 0, 0), "0.8": r(-48, 0, 0), "1.1": r(-60, 0, 0), "1.5": r(-60, 0, 0), "1.8": r(30, 0, 0), "2.2": r()}},
    "leftArm": {"rotation": {"0.0": r(), "0.35": r(-56, 0, 0), "0.8": r(-62, 0, 0), "1.1": r(-50, 0, 0), "1.5": r(-56, 0, 0), "1.8": r(30, 0, 0), "2.2": r()}}}}

# pre_animation and the shared guard animations (written by tools/build_guard_anims.py)
PRE = [
    "variable.tcos0 = (Math.cos(query.modified_distance_moved * 38.17) * query.modified_move_speed / 1.0) * 57.3;",
    "variable.hc_mv = math.min(query.modified_move_speed * 4.0, 1.0);",
    "variable.hc_rdy = math.lerp(variable.hc_rdy ?? 0.0, query.has_target ? 1.0 : 0.0, 0.12);",
    "variable.hc_wind = variable.attack_time > 0.0 ? math.clamp(variable.attack_time / 0.3, 0.0, 1.0) : 0.0;",
    "variable.hc_strike = variable.attack_time > 0.3 ? math.clamp((variable.attack_time - 0.3) / 0.4, 0.0, 1.0) : 0.0;",
    "variable.hc_draw = math.clamp(math.mod(query.life_time, 2.0) / 1.5, 0.0, 1.0);",
]
COMMON = {
    "humanoid_base_pose": "animation.humanoid.base_pose",
    "look_at_target_default": "animation.humanoid.look_at_target.default",
    "holding": "animation.humanoid.holding",
    "hc_march": "animation.hc.guard.march",
    "hc_idle": "animation.hc.guard.idle",
    "hc_hurt": "animation.hc.guard.hurt",
    "hc_salute": "animation.hc.guard.salute",
}
HURT = {"hc_hurt": "query.hurt_time > 0"}
RIDING = "query.is_riding"
ANIMATE = {
    "man_at_arms": (["humanoid_base_pose", "look_at_target_default", "holding", "hc_march", "hc_idle", "hc_ready",
                     {"hc_slash": "variable.attack_time > 0.0"}, HURT],
                    {"hc_ready": "animation.hc.guard.ready", "hc_slash": "animation.hc.guard.slash"}),
    "archer": (["humanoid_base_pose", "look_at_target_default", "holding", "hc_march", "hc_idle",
                {"bow_and_arrow": "query.has_target"}, {"hc_aim": "query.has_target"}, HURT],
               {"bow_and_arrow": "animation.humanoid.bow_and_arrow", "hc_aim": "animation.hc.guard.aim"}),
    "pikeman": (["humanoid_base_pose", "look_at_target_default", "hc_march", "hc_idle", "carry", "stance",
                 {"thrust": "variable.attack_time > 0.0"}, HURT],
                {"carry": "animation.hc.pikeman.carry", "stance": "animation.hc.pikeman.stance", "thrust": "animation.hc.pikeman.thrust",
                 "brace": "animation.hc.pikeman.brace"}),
    "shieldbearer": (["humanoid_base_pose", "look_at_target_default", "hc_march", "hc_idle", "carry", "stance",
                      {"bash": "variable.attack_time > 0.0"}, HURT],
                     {"carry": "animation.hc.shieldbearer.carry", "stance": "animation.hc.shieldbearer.stance",
                      "bash": "animation.hc.shieldbearer.bash", "raise_shield": "animation.hc.shieldbearer.raise_shield"}),
    "crossbowman": (["humanoid_base_pose", "look_at_target_default", "holding", "hc_march", "hc_idle", "stance", HURT],
                    {"stance": "animation.hc.crossbowman.stance", "aim": "animation.hc.crossbowman.aim",
                     "reload": "animation.hc.crossbowman.reload"}),
    "knight": (["humanoid_base_pose", "look_at_target_default", {"hc_march": f"!{RIDING}"}, {"hc_idle": f"!{RIDING}"},
                {"ride": RIDING}, "carry", "stance", HURT],
               {"ride": "animation.hc.knight.ride", "carry": "animation.hc.knight.carry", "stance": "animation.hc.knight.stance",
                "charge": "animation.hc.knight.charge"}),
    "ram_crew": (["humanoid_base_pose", "look_at_target_default", "holding", "hc_march", "hc_idle", HURT],
                 {"swing_ram": "animation.hc.ram_crew.swing_ram", "push": "animation.hc.ram_crew.push"}),
    "trebuchet_crew": (["humanoid_base_pose", "look_at_target_default", "hc_march", "hc_idle", "carry", HURT],
                       {"carry": "animation.hc.trebuchet_crew.carry", "load_trebuchet": "animation.hc.trebuchet_crew.load_trebuchet"}),
    "sapper": (["humanoid_base_pose", "look_at_target_default", "holding", "hc_march", "hc_idle", HURT],
               {"plant_charge": "animation.hc.sapper.plant_charge"}),
}

# ---------------------------------------------------------------- client entity, render controller
def client_entity(kind):
    animate, anims = ANIMATE[kind]
    tex = {f"r{ri}c{ci}": f"textures/entity/soldiers/{kind}/{rg}_{c}" for ri, rg in enumerate(REGION_IDS) for ci, c in enumerate(COLORS)}
    return {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
        "identifier": f"siege:{kind}", "materials": {"default": "entity_alphatest"}, "textures": tex,
        "geometry": {"default": f"geometry.hc.soldier.{kind}"},
        "scripts": {"pre_animation": PRE, "animate": animate},
        "animations": {**COMMON, **anims},
        "render_controllers": ["controller.render.hc_soldier"],
        "enable_attachables": True}}}

RC = {"format_version": "1.8.0", "render_controllers": {"controller.render.hc_soldier": {
    "arrays": {"textures": {"Array.skins": [f"Texture.r{ri}c{ci}" for ri in range(6) for ci in range(16)]}},
    "geometry": "Geometry.default",
    "materials": [{"*": "Material.default"}],
    "textures": ["Array.skins[math.clamp(query.property('siege:region'), 0, 5) * 16 + math.clamp(query.variant, 0, 15)]"]}}}

# ---------------------------------------------------------------- behaviour starters
STARTER = {   # cloned from: stats are a first guess; the sieges thread owns behaviour after this
    "pikeman": ("man_at_arms", 34, 0.30, 6), "shieldbearer": ("man_at_arms", 40, 0.28, 3), "crossbowman": ("archer", 26, 0.30, None),
    "knight": ("man_at_arms", 44, 0.34, 8), "ram_crew": ("man_at_arms", 26, 0.30, 2), "trebuchet_crew": ("man_at_arms", 22, 0.30, 2),
    "sapper": ("man_at_arms", 20, 0.36, 2),
}
REGION_PROP = {"type": "int", "range": [0, 5], "default": 0, "client_sync": True}

def add_region(data):
    e = data["minecraft:entity"]
    e["description"].setdefault("properties", {})["siege:region"] = REGION_PROP
    ev = e.setdefault("events", {})
    for n in range(6): ev[f"siege:region_{n}"] = {"set_property": {"siege:region": n}}

def starters():
    made = []
    for kind, (src, hp, speed, dmg) in STARTER.items():
        path = BP + f'entities/{kind}.json'
        if not os.path.exists(path):
            data = copy.deepcopy(json.load(open(BP + f'entities/{src}.json')))
            e = data["minecraft:entity"]; c = e["components"]
            e["description"]["identifier"] = f"siege:{kind}"
            c["minecraft:health"] = {"value": hp, "max": hp}
            c["minecraft:movement"] = {"value": speed}
            c["minecraft:equipment"] = {"table": f"loot_tables/entities/siege_{kind}_gear.json"}
            if dmg is not None and "minecraft:attack" in c: c["minecraft:attack"] = {"damage": dmg}
            made.append(kind)
        else:
            data = json.load(open(path))
        add_region(data)
        json.dump(data, open(path, 'w'), indent=2); open(path, 'a').write('\n')
        lt = BP + f'loot_tables/entities/siege_{kind}_gear.json'
        if kind == 'crossbowman':   # the one type that holds a vanilla item
            json.dump({"pools": [{"rolls": 1, "entries": [{"type": "item", "name": "minecraft:crossbow", "weight": 1}]}]}, open(lt, 'w'), indent=2)
        elif not os.path.exists(lt):
            json.dump({"pools": []}, open(lt, 'w'), indent=2)
    for kind in ("man_at_arms", "archer"):
        path = BP + f'entities/{kind}.json'; data = json.load(open(path)); add_region(data)
        json.dump(data, open(path, 'w'), indent=2); open(path, 'a').write('\n')
    return made

def lang():
    p = RP + 'texts/en_US.lang'; lines = open(p).read().splitlines()
    have = {l.split('=')[0] for l in lines if '=' in l}
    add = [f"entity.siege:{k}.name={NAMES[k]}" for k in TYPES if f"entity.siege:{k}.name" not in have]
    if add:
        i = max(i for i, l in enumerate(lines) if l.startswith('entity.siege:man_at_arms.name')) + 1
        lines[i:i] = add
        open(p, 'w').write('\n'.join(lines) + '\n')

# ---------------------------------------------------------------- main
def main():
    os.makedirs(RP + 'models/entity/soldiers', exist_ok=True)
    preview = {"types": {}, "regions": REGION_IDS, "colors": COLORS}
    for kind in TYPES:
        geo, paints = build_model(kind)
        json.dump(geo, open(RP + f'models/entity/soldiers/{kind}.geo.json', 'w'), indent=1)
        d = RP + f'textures/entity/soldiers/{kind}/'; os.makedirs(d, exist_ok=True)
        for rg in REGION_IDS:
            for c in COLORS:
                t = paint_skin(kind, rg, c); paint_gear(t, paints, rg, c)
                t.im.save(d + f'{rg}_{c}.png', optimize=True)
        p = RP + f'entity/{kind}.entity.json'
        json.dump(client_entity(kind), open(p, 'w'), indent=2); open(p, 'a').write('\n')
        preview["types"][kind] = {"name": NAMES[kind], "geo": geo["minecraft:geometry"][0], "anims": ANIMATE[kind][1]}
    json.dump(RC, open(RP + 'render_controllers/hc_soldier.render_controllers.json', 'w'), indent=2)
    json.dump({"format_version": "1.8.0", "animations": A}, open(RP + 'animations/soldiers.animation.json', 'w'), indent=1)
    made = starters(); lang()
    os.makedirs(ROOT + 'studio/soldiers', exist_ok=True)
    json.dump(preview, open(ROOT + 'studio/soldiers/data.json', 'w'))
    print('soldiers done; new behaviour starters:', made or 'none')

if __name__ == '__main__':
    main()
