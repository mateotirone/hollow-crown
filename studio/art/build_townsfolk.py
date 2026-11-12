"""Townsfolk skins: eight everyday people per region, painted on the 64x64 player layout (geometry.humanoid.custom).
Writes Siege_Nights_RP/textures/entity/siege/townsfolk/tf_<region>_<n>.png and a contact sheet to look at.
Run: python3 studio/art/build_townsfolk.py [sheet.png]

Each skin mixes a region's working clothes (tunic, apron or vest, hood or cap, skirt or breeches) with a skin tone
and hair colour, so a town of twenty does not look like twenty copies. The order of SKINS is the skin index the
game uses (scripts/townsfolk/data.js picks one per person), so only ever add to the end of a region's list.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from palette import ramp, fixed
from texlib import Tex, R

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'Siege_Nights_RP/textures/entity/siege/townsfolk/')
REGIONS = ['vale', 'frostmarch', 'saltreach', 'emberwaste', 'blackfen']

SKIN = [ramp(c, 0.18, 0.86, cool=0.04, warm=0.06) for c in ('#e8b896', '#c98d64', '#9a6440', '#6e4428')]
HAIR = [ramp(c, 0.06, 0.62, sat=0.8) for c in ('#3a2618', '#6a4422', '#a8742c', '#d8c08a', '#8a8a86', '#2a2a2e', '#8a3a1c')]
LINEN = fixed('#6a5e48', '#8e826a', '#b0a488', '#cdc2a6', '#e2d9c0', '#f2ecda')
LEATHER = ramp('#7a4e2c', 0.10, 0.56)
EYE = (40, 34, 30)

C = lambda h, **k: ramp(h, 0.10, 0.72, sat=0.7, **k)   # working clothes: dyed, then washed and worn
# region -> [(tunic, over, legs, head, over-kind, head-kind, legs-kind)], eight people each
OUTFITS = {
    'vale': [('#8a3a26', '#cdc2a6', '#5a4a36', None, 'apron', 'short', 'breeches'),
             ('#5a7a34', '#7a4e2c', '#4a3e30', '#6a5e48', 'vest', 'cap', 'breeches'),
             ('#b08a3a', '#e2d9c0', '#6a3a2a', None, 'apron', 'long', 'skirt'),
             ('#4a5e7a', '#8e826a', '#3a3430', None, 'none', 'short', 'breeches'),
             ('#7a2a3a', '#cdc2a6', '#5a4a36', '#cdc2a6', 'apron', 'kerchief', 'skirt'),
             ('#6a6a4a', '#5a3a22', '#4a3e30', '#5a3a22', 'vest', 'hood', 'breeches'),
             ('#a0603a', '#e2d9c0', '#3a4a5a', None, 'none', 'long', 'skirt'),
             ('#3a5a3a', '#8a3a26', '#4a3e30', None, 'sash', 'bald', 'breeches')],
    'frostmarch': [('#2e4a5a', '#d8d8d4', '#3a3632', '#d8d8d4', 'fur', 'fur', 'breeches'),
                   ('#6a2424', '#7a6a5a', '#3a3632', None, 'fur', 'long', 'skirt'),
                   ('#3a4a3a', '#5a4632', '#2e2a28', '#4a5a6a', 'vest', 'cap', 'breeches'),
                   ('#4a5a7a', '#d8d8d4', '#3a3632', None, 'fur', 'short', 'breeches'),
                   ('#5a4a3a', '#8a7a6a', '#2e2a28', '#8a2a2a', 'sash', 'kerchief', 'skirt'),
                   ('#2a3440', '#b8b8b4', '#2e2a28', '#b8b8b4', 'fur', 'hood', 'breeches'),
                   ('#7a5a3a', '#d8d8d4', '#3a3632', None, 'fur', 'long', 'skirt'),
                   ('#3a3a4a', '#6a2424', '#2e2a28', None, 'sash', 'bald', 'breeches')],
    'saltreach': [('#2a3e6a', '#e2e6e8', '#5a5448', None, 'stripes', 'short', 'breeches'),
                  ('#2f8f88', '#cdc2a6', '#4a4a52', '#cdc2a6', 'apron', 'kerchief', 'skirt'),
                  ('#c8c0a8', '#2a3e6a', '#3a3e4a', '#2a3e6a', 'vest', 'cap', 'breeches'),
                  ('#8a4a3a', '#e2e6e8', '#4a4a52', None, 'stripes', 'long', 'skirt'),
                  ('#4a6a8a', '#7a5a3a', '#5a5448', None, 'sash', 'short', 'breeches'),
                  ('#d8d0b8', '#2f8f88', '#3a3e4a', '#d8d0b8', 'apron', 'hood', 'skirt'),
                  ('#2a4a5a', '#e2e6e8', '#5a5448', '#e8c040', 'stripes', 'cap', 'breeches'),
                  ('#6a7a7a', '#5a3a22', '#3a3e4a', None, 'vest', 'bald', 'breeches')],
    'emberwaste': [('#d8c8a0', '#a8482a', '#8a6a4a', '#e8dcc0', 'sash', 'wrap', 'breeches'),
                   ('#a8482a', '#e0b040', '#6a4a3a', '#e0b040', 'sash', 'wrap', 'skirt'),
                   ('#c89a5a', '#5a3a2a', '#6a4a3a', None, 'vest', 'short', 'breeches'),
                   ('#e8dcc0', '#c0603a', '#8a6a4a', '#c0603a', 'apron', 'kerchief', 'skirt'),
                   ('#7a3a2a', '#d8c8a0', '#5a3a2a', '#d8c8a0', 'sash', 'wrap', 'breeches'),
                   ('#b07a3a', '#e8dcc0', '#6a4a3a', None, 'apron', 'long', 'skirt'),
                   ('#5a3a3a', '#e0b040', '#4a3a30', '#e8dcc0', 'vest', 'hood', 'breeches'),
                   ('#d0b080', '#8a2a1a', '#6a4a3a', None, 'sash', 'bald', 'breeches')],
    'blackfen': [('#4a5a2a', '#5a4632', '#3a3428', '#4a5a2a', 'vest', 'hood', 'breeches'),
                 ('#5a4a5a', '#8a8a5a', '#3a3428', None, 'apron', 'long', 'skirt'),
                 ('#5a4632', '#3a4a2a', '#2e2a24', '#3a4a2a', 'sash', 'hood', 'breeches'),
                 ('#6a6a3a', '#cdc2a6', '#3a3428', '#6a5a7a', 'apron', 'kerchief', 'skirt'),
                 ('#3a3a2a', '#7a6a3a', '#2e2a24', None, 'vest', 'short', 'breeches'),
                 ('#4a3a4a', '#5a6a3a', '#3a3428', '#4a3a4a', 'sash', 'hood', 'skirt'),
                 ('#5a6a4a', '#5a4632', '#2e2a24', '#5a4632', 'vest', 'cap', 'breeches'),
                 ('#3a4a3a', '#9ad04a', '#2e2a24', None, 'none', 'bald', 'breeches')],
}

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

def person(region, n):
    tunic, over, legs, headc, okind, hkind, lkind = OUTFITS[region][n]
    T_, O_, L_ = C(tunic), C(over), C(legs)
    H_ = C(headc) if headc else None
    sk = SKIN[(n * 3 + REGIONS.index(region)) % len(SKIN)]
    hair = HAIR[(n * 5 + REGIONS.index(region) * 2) % len(HAIR)]
    t = Tex(64, 64, seed=n)
    covered = hkind in ('hood', 'wrap', 'fur')

    def head(face, i, j, fw, fh):
        if face == 'front':
            if covered and (j <= 1 or i in (0, 7)): return R(H_, 3 if j == 0 else 2)
            if hkind in ('cap', 'kerchief') and j <= 1: return R(H_, 4 if j == 0 else 3)
            if hkind in ('short', 'long', 'cap', 'kerchief') and j <= 1 or (hkind == 'long' and i in (0, 7) and j <= 6): return R(hair, 3 - (j == 1))
            if hkind == 'bald' and j == 0: return R(sk, 3)
            if j == 4 and i in (2, 5): return EYE
            if j == 4 and i in (1, 6): return (226, 222, 214)
            if j == 3 and i in (1, 2, 5, 6) and not covered: return R(hair, 1)
            if j == 5 and i in (3, 4): return R(sk, 2)
            if j == 6 and 3 <= i <= 4: return R(sk, 1)
            if n % 3 == 0 and hkind != 'long' and j == 7 and 1 <= i <= 6 and region in ('frostmarch', 'blackfen'): return R(hair, 2)  # beard
            return R(sk, 4 if (i < 4 and j < 5) else 3)
        if face == 'bottom': return R(sk, 2)
        if covered: return R(H_, 3 + (face == 'top') - ((i + j) % 6 == 0))
        if hkind in ('cap', 'kerchief') and (face == 'top' or j <= 2): return R(H_, 3 + (face == 'top') - (i % 3 == 0))
        if hkind == 'bald': return R(hair, 2) if (face != 'top' and 3 <= j <= 5) else R(sk, 3 + (face == 'top'))
        if hkind == 'short' and face != 'top' and j >= 4: return R(sk, 3) if face in ('left', 'right') and j >= 5 else R(hair, 2)
        return R(hair, 3 + (face == 'top') - ((i * 3 + j) % 5 == 0) - (j == fh - 1))

    def body(face, i, j, fw, fh):
        if face == 'top': return R(T_, 4)
        if face == 'bottom': return R(L_, 1)
        edge = -1 if face in ('left', 'right', 'back') else 0
        if j == 7 and okind != 'sash': return R(LEATHER, 2) if not (face == 'front' and i in (3, 4)) else R(LEATHER, 4)
        if okind == 'sash' and j in (6, 7): return R(O_, 3 - (j == 7))
        if face == 'front':
            if okind == 'apron' and 2 <= i <= 5 and j >= 3: return R(O_, 4 - (j == fh - 1) - (i == 5))
            if okind == 'vest' and i in (0, 1, 6, 7) and j < 7: return R(O_, 3 - (i in (1, 6)))
            if okind == 'fur' and j <= 2: return R(O_, 4 - (i + j) % 2)
            if okind == 'stripes' and j % 2 == 1 and j < 7: return R(O_, 3)
        elif okind in ('vest', 'fur') and j <= (11 if okind == 'vest' else 2) and face != 'back' or (okind == 'vest' and face == 'back' and j < 7):
            return R(O_, 3 + edge)
        elif okind == 'stripes' and j % 2 == 1 and j < 7: return R(O_, 3 + edge)
        if covered and j <= 1: return R(H_, 3 - j)                             # hood falls on the shoulders
        return R(T_, 3 + edge + (j == 0) - (j == fh - 1) - (i == fw - 1))

    def arm(face, i, j, fw, fh):
        if face == 'top': return R(O_ if okind == 'fur' else T_, 4)
        if face == 'bottom': return R(sk, 2)
        if j >= 10: return R(sk, 3 - (i == fw - 1))
        if okind == 'fur' and j <= 2: return R(O_, 4 - (i + j) % 2)
        if j == 9 and region in ('frostmarch', 'saltreach'): return R(T_, 2)       # cuff
        return R(T_, 3 - (face in ('back', 'left')) - (i == fw - 1) + (j == 0))

    def leg(face, i, j, fw, fh):
        if face == 'top': return R(L_, 2)
        if face == 'bottom': return R(LEATHER, 0)
        if lkind == 'skirt' and j <= 8: return R(T_ if okind != 'apron' else O_, 3 - (j == 8) - (face in ('back', 'left'))) if face == 'front' and okind == 'apron' and j <= 4 else R(L_, 3 - (j == 8) - (face in ('back', 'left')) - (i == fw - 1))
        if j >= 9: return R(LEATHER, 3 if j == 9 else 2 - (i == fw - 1))
        return R(L_, 3 - (i == fw - 1) - (face in ('back', 'left')))

    for box, fn in ((HEAD, head), (BODY, body), (RARM, arm), (LARM, arm), (RLEG, leg), (LLEG, leg)): part(t, box, fn)
    return t

def front_view(im, scale=6):
    """A flat front picture for the contact sheet: head, body, arms, legs."""
    v = Image.new('RGBA', (16, 32), (0, 0, 0, 0))
    v.paste(im.crop((8, 8, 16, 16)), (4, 0)); v.paste(im.crop((20, 20, 28, 32)), (4, 8))
    v.paste(im.crop((44, 20, 48, 32)), (0, 8)); v.paste(im.crop((36, 52, 40, 64)), (12, 8))
    v.paste(im.crop((4, 20, 8, 32)), (4, 20)); v.paste(im.crop((20, 52, 24, 64)), (8, 20))
    return v.resize((16 * scale, 32 * scale), Image.NEAREST)

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    sheet = Image.new('RGBA', (8 * 110, 5 * 210), (58, 58, 64, 255))
    for r, region in enumerate(REGIONS):
        for n in range(len(OUTFITS[region])):
            t = person(region, n); t.save(OUT + f'tf_{region}_{n}.png')
            sheet.paste(front_view(t.im), (n * 110 + 7, r * 210 + 9), front_view(t.im))
    if len(sys.argv) > 1: sheet.save(sys.argv[1])
    print('townsfolk skins done')
