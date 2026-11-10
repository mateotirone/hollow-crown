"""Final-style entity textures: siege machine atlases and the guard skins (x16 banner colours).
Run: python3 build_entities.py
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from palette import M, REGIONS, dye_ramp, fixed, DYE
from texlib import *

E = '/mnt/project-files/siege-nights/Siege_Nights_RP/textures/entity/'
BACKUP = '/mnt/project-files/siege-nights/art/placeholder-backup/entity/'
V = REGIONS['vale']
OAK, DOAK, IRON, BS, L, ROPE, GOLD = M['oak'], M['dark_oak'], M['iron'], M['blacksteel'], M['leather'], M['rope'], M['gold']
LINEN = fixed('#6a5e48', '#8e826a', '#b0a488', '#cdc2a6', '#e2d9c0', '#f2ecda')
HOSE = fixed('#1c1a22', '#2a2830', '#3a3840', '#4c4a52', '#605e66', '#787680')

# ---------------- 16x16 material cells for the machine atlases ----------------
def c_planks(seed=21):
    t = Tex(); planks(t, OAK, False, (4, 4, 4, 4), seed=seed)
    for (x, y) in [(1, 1), (14, 5), (1, 9), (14, 13)]: t.set(x, y, R(BS, 2))     # nail heads
    return t
def c_bark(seed=22):
    t = Tex(); r = random.Random(seed)
    for x in range(16):
        tone = r.choice((1, 2, 2, 3))
        for y in range(16): t.set(x, y, R(DOAK, tone))
    for _ in range(14):   # bark ridges
        x = r.randrange(16); y0 = r.randrange(16); n = r.randrange(3, 8)
        for y in range(y0, y0 + n): t.set(x, y % 16, R(DOAK, 4)); t.set((x + 1) % 16, y % 16, R(DOAK, 0))
    return t
def c_iron(metal=None, seed=23):
    metal = metal or M['steel']; t = Tex(); r = random.Random(seed)
    for y in range(16):
        for x in range(16): t.set(x, y, R(metal, 2 if (x + y) % 7 else 3))
    for i in range(16):
        t.set(i, 0, R(metal, 4)); t.set(0, i, R(metal, 4)); t.set(i, 15, R(metal, 0)); t.set(15, i, R(metal, 0))
        t.set(i, 1, R(metal, 3)) if 0 < i < 15 else None; t.set(i, 14, R(metal, 1)) if 0 < i < 15 else None
    for (x, y) in [(2, 2), (13, 2), (2, 13), (13, 13)]: t.set(x, y, R(metal, 5)); t.set(x + 1, y + 1, R(metal, 0))
    return t
def c_rope():
    t = Tex()
    for y in range(16):
        for x in range(16):
            k = (x + y * 2) % 4
            t.set(x, y, R(ROPE, (4, 3, 2, 1)[k]))
    return t
def c_stone(seed=24):
    t = Tex(); r = random.Random(seed); S = V['stone']
    for y in range(16):
        for x in range(16): t.set(x, y, R(S, 2))
    for _ in range(16):   # facets of a rough boulder
        x, y = r.randrange(16), r.randrange(16); k = r.choice((1, 3, 3, 4))
        for dx in range(r.randrange(2, 5)):
            for dy in range(r.randrange(1, 3)): t.set((x + dx) % 16, (y + dy) % 16, R(S, k))
        t.set(x, (y + 2) % 16, R(S, 0))
    return t
def c_leather(seed=25):
    t = Tex(); r = random.Random(seed)
    for y in range(16):
        for x in range(16): t.set(x, y, R(L, 2 if (x * 3 + y * 5) % 9 else 3))
    for y in (0, 8):   # stitched seams
        for x in range(16): t.set(x, y, R(L, 0)); t.set(x, y + 1, R(L, 4) if x % 3 == 0 else R(L, 3))
    for _ in range(5): x, y = r.randrange(16), r.randrange(16); t.set(x, y, R(L, 1)); t.set((x + 1) % 16, y, R(L, 1))
    return t
def c_log_end():
    t = Tex()
    for y in range(16):
        for x in range(16):
            d = max(abs(x - 7.5), abs(y - 7.5)) * 0.6 + ((x - 7.5) ** 2 + (y - 7.5) ** 2) ** 0.5 * 0.4
            ring = int(d)
            t.set(x, y, R(DOAK, 1) if ring >= 7 else R(OAK, (4, 2, 3, 2, 4, 2, 3)[ring % 7]))
    t.set(7, 7, R(OAK, 1)); t.set(8, 8, R(OAK, 1))
    for (x, y) in line((8, 7), (12, 3)): t.set(x, y, R(OAK, 1))   # a drying split
    return t
def c_lightwood(seed=26):
    t = Tex(); planks(t, fixed('#6a5236', '#8e7250', '#b0946a', '#c8ae84', '#dcc8a0', '#eee0c0'), True, (8, 8), seed=seed); return t
def c_darkwood(seed=27):
    t = Tex(); planks(t, DOAK, False, (4, 4, 4, 4), seed=seed); return t
def c_cloth(ramp):
    t = Tex()
    for y in range(16):
        for x in range(16): t.set(x, y, R(ramp, 2 if (x * 5 + y * 3) % 7 == 0 else 3))
    for x in range(16): t.set(x, 0, R(ramp, 4)); t.set(x, 15, R(ramp, 1))
    for y in range(16): t.set(5, y, R(ramp, 1)) if y % 5 else None
    return t
def c_wheel(mask):
    t = Tex(); mp = mask.load()
    for y in range(16):
        for x in range(16):
            if not mp[x, y][3]: continue
            dx, dy = x - 7.5, y - 7.5; d = (dx * dx + dy * dy) ** 0.5
            if d > 6.2: c = R(BS, 3 if (dx + dy) < 0 else 1)                    # iron tyre
            elif d < 1.6: c = R(BS, 4)                                         # hub
            elif abs(dx) < 1 or abs(dy) < 1 or abs(abs(dx) - abs(dy)) < 0.8: c = R(OAK, 4 if (dx + dy) < 0 else 2)   # spokes
            else: c = R(DOAK, 1)
            t.set(x, y, c)
    return t

def atlas(w, h, cells):
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    for (cx, cy), t in cells.items(): im.paste(t.im, (cx * 16, cy * 16))
    return im
def machine_cells():
    return {(0, 0): c_planks(), (1, 0): c_bark(), (2, 0): c_iron(), (3, 0): c_rope(), (0, 1): c_stone(), (1, 1): c_leather(),
            (2, 1): c_log_end(), (3, 1): c_lightwood(), (0, 2): c_darkwood(), (1, 2): c_cloth(M['blood_red'])}
for n in ('siege_trebuchet', 'siege_ballista'):
    atlas(64, 64, machine_cells()).save(E + n + '.png')
old_ram = Image.open(BACKUP + 'siege_battering_ram.png').convert('RGBA')
atlas(64, 32, {(0, 0): c_planks(), (1, 0): c_bark(), (2, 0): c_iron(), (3, 0): c_wheel(old_ram.crop((48, 0, 64, 16))),
               (0, 1): c_log_end(), (1, 1): c_leather()}).save(E + 'siege_battering_ram.png')

# ---------------- guard skins (64x64 player layout) ----------------
def faces(u, v, w, h, d):
    return {'top': (u + d, v, w, d), 'bottom': (u + d + w, v, w, d), 'right': (u, v + d, d, h), 'front': (u + d, v + d, w, h),
            'left': (u + d + w, v + d, d, h), 'back': (u + d + w + d, v + d, w, h)}
def part(t, box, paint):
    for face, (x0, y0, fw, fh) in faces(*box).items():
        for j in range(fh):
            for i in range(fw):
                c = paint(face, i, j, fw, fh)
                if c is not None: t.set(x0 + i, y0 + j, c)

HEAD, BODY, RARM, RLEG, LLEG, LARM = (0, 0, 8, 8, 8), (16, 16, 8, 12, 4), (40, 16, 4, 12, 4), (0, 16, 4, 12, 4), (16, 48, 4, 12, 4), (32, 48, 4, 12, 4)
SK = M['skin']
def face_px(i, j, skin_shadow=0):
    """An 8x8 face. Returns a colour for the skin area."""
    s = lambda k: R(SK, k - skin_shadow)
    if j == 4 and i in (1, 5): return (236, 236, 230)
    if j == 4 and i in (2, 6): return R(M['coal'], 1)
    if j == 3 and i in (1, 2, 5, 6): return R(M['dark_oak'], 1)        # brows
    if j == 5 and i in (3, 4): return s(2)                              # nose shadow
    if j == 6 and 2 <= i <= 5: return s(1)                              # mouth
    if j == 7: return s(2)
    return s(4 if (i < 4 and j < 5) else 3)
def quilt(ramp, i, j, fh, base=3):
    v = base - (1 if i % 2 == 1 and j % 4 != 0 else 0) - (1 if j % 4 == 3 else 0) + (1 if j == 0 else 0)
    return R(ramp, v)
TOWER = [".X.XX.X.", ".XXXXXX.", "..XXXX..", "..XDDX..", ".XXXXXX."]   # only cols 1..6 used on the tabard

def man_at_arms(color):
    D = dye_ramp(color); t = Tex(64, 64); emb = GOLD if color not in ('yellow', 'orange') else BS
    def head(face, i, j, fw, fh):
        if face == 'front':
            if j <= 1 or i in (0, 7): return quilt(LINEN, i, j, fh, 4 if j == 0 else 3)   # arming cap and cheek flaps
            return face_px(i, j)
        if face == 'bottom': return R(SK, 1)
        return quilt(LINEN, i, j, fh, 4 if face == 'top' else 3)
    def body(face, i, j, fw, fh):
        if face in ('front', 'back'):
            if j == 8: return R(L, 1) if i not in (3, 4) or face == 'back' else R(GOLD, 4)   # belt and buckle
            if 1 <= i <= 6:
                if face == 'front' and 2 <= j <= 6 and TOWER[j - 2][i] != '.': return R(emb, 0 if TOWER[j - 2][i] == 'D' else 4 if i < 4 else 3)
                return R(D, 3 + (1 if j == 0 else 0) - (1 if i == 6 else 0) - (1 if j in (7, 11) else 0))
            return quilt(LINEN, i, j, fh)
        if face == 'top': return R(D, 4) if 1 <= i <= 6 else R(LINEN, 4)
        if face == 'bottom': return R(HOSE, 1)
        return quilt(LINEN, i, j, fh, 2)
    def arm(face, i, j, fw, fh):
        if face == 'top': return R(LINEN, 4)
        if face == 'bottom': return R(L, 1)
        if j >= 9: return R(L, 3 if j == 9 else 2 - (1 if i == fw - 1 else 0))             # leather gauntlet
        return quilt(LINEN, i, j, fh, 3 if face in ('front', 'right') else 2)
    def leg(face, i, j, fw, fh):
        if face == 'top': return R(HOSE, 2)
        if face == 'bottom': return R(L, 0)
        if j <= 1 and face in ('front', 'back'): return R(D, 2 if j == 1 else 3)             # tabard skirt
        if j >= 8: return R(L, 3 if j == 8 else 2 if i < fw - 1 else 1)                      # boots
        return R(HOSE, 3 - (1 if i == fw - 1 else 0) + (1 if j == 4 and i == 1 else 0))     # hose, knee highlight
    for box, fn in ((HEAD, head), (BODY, body), (RARM, arm), (LARM, arm), (RLEG, leg), (LLEG, leg)): part(t, box, fn)
    return t

GREEN = fixed('#1e2a1a', '#2f4226', '#445c34', '#5c7846', '#7a965e', '#9cb480')
def archer(color):
    D = dye_ramp(color); t = Tex(64, 64)
    def head(face, i, j, fw, fh):
        if face == 'front':
            if j <= 1 or i in (0, 7): return R(D, 4 if j == 0 else 2 if j == 1 else 3)      # hood rim
            return face_px(i, j, 1 if j == 2 else 0)                                         # hood shades the brow
        if face == 'bottom': return R(SK, 1)
        v = 3 + (1 if (face == 'top' and j < 4) else 0) - (1 if (i + j) % 5 == 0 else 0) - (1 if j == fh - 1 and face != 'top' else 0)
        return R(D, v)
    def body(face, i, j, fw, fh):
        if face == 'bottom': return R(HOSE, 1)
        if face == 'top': return R(D, 3)
        if j <= 2:                                                                           # hood mantle over the shoulders
            if j == 2 and (i % 2 == 0): return R(D, 1)
            return R(D, 3 if j == 0 else 2)
        if j == 8: return R(DOAK, 1) if not (face == 'front' and i in (3, 4)) else R(IRON, 4)
        if face == 'front' and i == j - 2 + 0 and 3 <= j <= 8: return R(L, 4)               # quiver strap
        if face == 'back' and 2 <= i <= 4 and 3 <= j <= 9: return R(L, 3 if i == 2 else 2 if i == 3 else 1)   # quiver
        v = 3 - (1 if i in (0, fw - 1) else 0) - (1 if j == 11 else 0)
        if face in ('front', 'back') and i in (3, 4) and j < 8 and face == 'front': return R(GREEN, v - 1) if i == 4 else R(GREEN, v + 1)   # laced front
        return R(GREEN, v)
    def arm(face, i, j, fw, fh):
        if face == 'top': return R(D, 3)
        if face == 'bottom': return R(SK, 2)
        if j <= 1: return R(D, 3 - j)
        if 7 <= j <= 9: return R(L, 4 if j == 7 else 2 if i < fw - 1 else 1)                 # bracer
        if j >= 10: return R(SK, 3)
        return quilt(LINEN, i, j, fh, 3 if face in ('front', 'right') else 2)
    def leg(face, i, j, fw, fh):
        if face == 'top': return R(GREEN, 1)
        if face == 'bottom': return R(L, 0)
        if j <= 1: return R(GREEN, 2 - j)
        if j >= 7: return R(L, 4 if j == 7 else 2 if i < fw - 1 else 1)                      # tall boots
        return R(HOSE, 3 - (1 if i == fw - 1 else 0))
    for box, fn in ((HEAD, head), (BODY, body), (RARM, arm), (LARM, arm), (RLEG, leg), (LLEG, leg)): part(t, box, fn)
    return t

for c in DYE:
    man_at_arms(c).save(E + f'siege/man_at_arms_{c}.png'); archer(c).save(E + f'siege/archer_{c}.png')
print('entities done')
