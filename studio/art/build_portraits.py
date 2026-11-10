"""Portraits of each settlement's prior leaders (Mateo, 2026-11-10: "i want each settlements prior leaders to show on
the walls"). Brief: PORTRAIT-BRIEF.md (lore thread). 36 panels, 32x64, two-pixel dark frame, pixel (0,0) = frame colour.
Each portrait is a small spec (figure + props + backdrop) painted by shared parts, so the set stays in one hand.
SECRET: no adult face of the last king anywhere; redmesa_3 is a wrapped bundle only.
Run: python3 build_portraits.py   (overwrites textures/entity/portrait/<plot>_<n>.png, never plate_N.png)"""
import os, sys, random, colorsys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
OUT = '/mnt/project-files/siege-nights/Siege_Nights_RP/textures/entity/portrait/'
W, H = 32, 64
def hx(h): h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
def sh(h):
    """6 tones from one colour, shadows pulled cool, lights pulled warm."""
    r, g, b = [v / 255 for v in (hx(h) if isinstance(h, str) else h)]; hh, s, v = colorsys.rgb_to_hsv(r, g, b); out = []
    for k, (vm, dh, sm) in enumerate(((.32, -.04, 1.15), (.52, -.02, 1.1), (.76, 0, 1.05), (1, 0, 1), (1.18, .015, .82), (1.36, .03, .6))):
        c = colorsys.hsv_to_rgb((hh + dh) % 1, min(1, s * sm), min(1, v * vm)); out.append(tuple(int(x * 255) for x in c))
    return out
SKIN = {'pale': sh('#d9b89a'), 'ruddy': sh('#c98a6a'), 'tan': sh('#b88a5e'), 'burnt': sh('#a8704a'), 'grey': sh('#b8b2a6'), 'smooth': sh('#e0c4a8')}
HAIR = {'grey': sh('#8a8880'), 'white': sh('#c8c6be'), 'brown': sh('#5a3c26'), 'black': sh('#2a2622'), 'red': sh('#8a4222'), 'blond': sh('#b89a58'), 'ash': sh('#d8d4c4')}
C = {k: sh(v) for k, v in dict(wood='#6a4a2c', iron='#8a8e94', rust='#8a4a2a', gold='#d4a838', brass='#b8923c', bronze='#9a6a34', copper='#c8703c', white='#d8d2c2', red='#8a2a26', green='#4a6a34',
     grey='#6e6e72', dark='#34303a', sea='#3a5a6a', sky='#5a6a7a', snow='#c4ccd4', fire='#e8922a', night='#1c2230', stone='#7a7670', sand='#b0603c', blue='#5a8ac8', wool='#a89a80', leather='#5a4030',
     reed='#8a8a4a', pale='#b8d8d0', fen='#2a3428', chalk='#c8c4b0', ink='#22202a', vein='#4a9a6a').items()}
class P:
    def __init__(s, seed): s.im = Image.new('RGBA', (W, H), (0, 0, 0, 255)); s.px = s.im.load(); s.r = random.Random(seed)
    def set(s, x, y, c):
        if 2 <= x < W - 2 and 2 <= y < H - 2: s.px[int(x), int(y)] = tuple(c[:3]) + (255,)
    def rect(s, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): s.set(x, y, c)
    def line(s, x0, y0, x1, y1, c):
        n = max(abs(x1 - x0), abs(y1 - y0)) or 1
        for i in range(n + 1): s.set(round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n), c)
    def glow(s, x, y, c, rad=2):
        for dy in range(-rad, rad + 1):
            for dx in range(-rad, rad + 1):
                d = abs(dx) + abs(dy)
                if 0 < d <= rad and 2 <= x + dx < W - 2 and 2 <= y + dy < H - 2:
                    o = s.px[x + dx, y + dy]; k = .35 / d; s.px[x + dx, y + dy] = tuple(int(o[i] * (1 - k) + c[i] * k) for i in range(3)) + (255,)
        s.set(x, y, c)

# ------------------------------------------------------------------ backdrops (things sit at the sides and top; the sitter covers the middle)
def ground(p, top, bot, horizon=34, floor=None):
    for y in range(2, H - 2):
        k = min(1, (y - 2) / max(1, horizon - 2)); c = tuple(int(top[i] * (1 - k) + bot[i] * k) for i in range(3))
        if floor and y > horizon: c = floor[1 if (y - horizon) < 6 else 0]
        for x in range(2, W - 2): p.set(x, y, c)
def bg(p, kind):
    n, d = C['night'], C['dark']; r = p.r
    if kind == 'river_fires':
        ground(p, n[0], n[1], 30, C['sea']); [p.glow(x, y, C['fire'][4], 1) for x, y in ((4, 27), (7, 28), (25, 27), (28, 28), (22, 28), (10, 27))]
    elif kind == 'clock':
        ground(p, d[1], d[0]); cx, cy = 23, 12
        for a in range(-5, 6):
            for b in range(-5, 6):
                if a * a + b * b <= 26: p.set(cx + a, cy + b, C['chalk'][3 if a * a + b * b < 17 else 1])
        p.line(cx, cy, cx + 1, cy - 3, C['ink'][0]); p.line(cx, cy, cx + 3, cy + 1, C['ink'][0])            # seventeen past three
    elif kind == 'meadow':
        ground(p, C['sky'][2], C['sky'][4], 30, C['wood']); [p.line(2, y, 29, y + 1, C['wood'][2]) for y in range(34, 62, 4)]
    elif kind == 'oaks':
        ground(p, d[0], C['green'][0], 40, C['green'])
        for x in (3, 8, 24, 28): p.line(x, 50, x + 3, 4, C['wood'][1]); p.line(x + 1, 50, x + 4, 4, C['wood'][0])      # all leaning the same way
    elif kind == 'walled_door':
        ground(p, C['stone'][0], C['stone'][1]); p.rect(20, 14, 29, 61, C['stone'][3])
        for y in range(15, 61, 4):
            p.line(20, y, 29, y, C['stone'][1]); [p.set(x + (2 if (y // 4) % 2 else 0), y + 2, C['stone'][1]) for x in (22, 26)]
        p.rect(19, 12, 30, 13, C['stone'][0])
    elif kind in ('bell_hill', 'empty_frame'):
        ground(p, C['sky'][3], C['sky'][5], 26, C['green']); p.line(2, 30, 14, 22, C['green'][2]); p.line(14, 22, 29, 28, C['green'][2])
        p.line(22, 8, 22, 22, C['wood'][1]); p.line(28, 8, 28, 22, C['wood'][1]); p.line(21, 8, 29, 8, C['wood'][2])
        if kind == 'bell_hill': p.rect(24, 10, 26, 13, C['bronze'][3]); p.set(25, 14, C['bronze'][1])
        else: [p.rect(x, 26, x, 28, C['wool'][2]) or p.set(x, 25, SKIN['ruddy'][3]) for x in (3, 5, 7, 9, 21, 23, 25, 27)]
    elif kind == 'listening':
        ground(p, d[1], d[0])
    elif kind == 'lake':
        ground(p, C['sky'][3], C['sky'][4], 28, C['sea']); p.rect(22, 30, 29, 30, C['wood'][2]); [p.line(x, 30, x, 34, C['wood'][1]) for x in (23, 28)]
    elif kind == 'boat':
        ground(p, C['sky'][3], C['sky'][4], 30, C['sea']); p.rect(2, 28, 9, 30, C['green'][2]); p.line(5, 18, 5, 28, C['wood'][1]); p.rect(3, 14, 8, 19, C['green'][3]); p.set(4, 16, C['red'][4])
    elif kind == 'chimney':
        ground(p, C['sky'][2], C['sky'][4], 34, C['green']); p.rect(3, 12, 7, 40, C['ink'][1]); p.rect(2, 10, 8, 12, C['ink'][2])
        p.line(26, 22, 26, 40, C['wood'][1]); [p.rect(23 + a, 12 + b, 26 + a, 16 + b, C['green'][3]) for a, b in ((0, 0), (2, 3), (-1, 5), (1, 8))]
    elif kind == 'mine':
        ground(p, C['stone'][0], d[0]); [p.line(x, y, x + 3, y + 6, C['vein'][3]) for x, y in ((24, 8), (26, 20), (3, 14), (5, 30))]; p.glow(5, 44, C['fire'][5], 3)
    elif kind == 'ore':
        ground(p, C['stone'][1], d[0]); [p.set(x, y, C['gold'][4]) for x, y in ((4, 10), (5, 11), (26, 16), (27, 15), (3, 30))]; [p.set(x, y, C['white'][4]) for x, y in ((25, 8), (6, 22), (27, 30), (28, 31))]
    elif kind == 'furnace':
        ground(p, d[1], C['rust'][1]); p.rect(22, 20, 29, 40, C['ink'][1]); p.rect(24, 28, 27, 34, C['fire'][4]); p.glow(25, 30, C['fire'][5], 3)
    elif kind in ('cairn_start', 'cairn_tall'):
        ground(p, C['sky'][2], C['snow'][2], 34, C['snow'])
        hgt = 3 if kind == 'cairn_start' else 30
        for i in range(hgt):
            y = 44 - i; wd = max(1, (4 if kind == 'cairn_start' else 6) - i // 6)
            for x in range(25 - wd, 25 + wd + 1): p.set(x, y, C['stone'][2 + (x + y) % 2])
        [p.set(r.randrange(2, 30), r.randrange(4, 60), C['snow'][5]) for _ in range(14)]
    elif kind == 'frozen_sea':
        ground(p, C['sky'][2], C['snow'][3], 28, C['snow']); p.rect(2, 4, 5, 61, C['wood'][0]); p.rect(26, 4, 29, 61, C['wood'][0]); p.rect(2, 4, 29, 6, C['wood'][1])
    elif kind in ('clear_sea', 'grey_sails'):
        ground(p, C['sky'][3], C['sky'][5], 30, C['sea']); p.rect(2, 40, 12, 61, C['chalk'][2])
        p.line(25, 26, 25, 40, C['iron'][1]); p.rect(23, 22, 27, 26, C['iron'][2])
        if kind == 'grey_sails':
            p.glow(25, 21, C['fire'][5], 3); p.rect(24, 19, 26, 22, C['fire'][4])
            for x in (4, 9, 14, 19): p.rect(x, 31, x + 1, 33, C['grey'][3]); p.set(x, 34, C['ink'][1])        # exactly evenly spaced
    elif kind == 'bunks':
        ground(p, C['chalk'][1], C['chalk'][0]); [p.rect(21, y, 29, y + 5, C['ink'][1]) or p.rect(21, y + 5, 29, y + 5, C['wool'][2]) for y in (10, 20, 30)]
    elif kind in ('posts_sea', 'one_post'):
        ground(p, C['sky'][3], C['sky'][5], 30, C['sea'])
        for i, x in enumerate((28, 25, 23, 21) if kind == 'posts_sea' else (26,)):
            p.line(x, 26 + i, x, 36 + i * 2, C['wood'][1])
            if kind == 'one_post': [p.set(x + 1, y, C['white'][3]) for y in (28, 31, 34)]                    # marks on the wrong side
    elif kind == 'even_market':
        ground(p, hx('#6a5a2a'), hx('#4a4020'), 40); [p.line(x, 22, x, 34, C['wood'][0]) for x in (3, 6, 9, 22, 25, 28)]
        [p.rect(x, 12, x + 1, 30, C['fen'][2]) or p.set(x, 11, C['fen'][3]) for x in (23, 26, 5)]           # tall indistinct figures
    elif kind == 'fen':
        ground(p, C['fen'][1], C['fen'][0], 36, C['fen']); [p.line(x, 30, x + 1, 22, C['reed'][2]) for x in (3, 5, 26, 28)]
    elif kind == 'fen_post':
        ground(p, C['fen'][2], C['fen'][0], 36, C['fen']); p.line(26, 14, 26, 40, C['wood'][2]); [p.rect(x, 30, x + 1, 36, C['reed'][1]) or p.set(x, 29, SKIN['tan'][2]) for x in (22, 28)]
    elif kind in ('lanterns', 'nine_lanterns', 'blue_lantern'):
        ground(p, C['fen'][0], (10, 12, 14), 36, [(8, 10, 12), (14, 18, 20)])
        if kind == 'lanterns':
            for _ in range(16): x, y = r.choice((3, 5, 7, 9, 23, 25, 27, 29)), r.randrange(8, 34); p.glow(x, y, C['fire'][5], 1); p.set(x, 72 - y if 72 - y < 60 else 59, C['fire'][2])
        elif kind == 'nine_lanterns': [p.glow(3 + i * 3, 12, C['fire'][5], 1) for i in range(9)]
        else: p.line(26, 10, 26, 44, C['wood'][0]); p.glow(26, 9, C['blue'][5], 3)
    elif kind == 'statues':
        ground(p, C['sand'][1], C['sand'][3], 36, C['sand']); [p.rect(x, 18, x + 3, 36, C['sand'][2]) or p.rect(x, 12, x + 3, 17, C['sand'][0 if True else 3]) for x in (3, 8, 22, 26)]
    elif kind == 'statue_row':
        ground(p, C['sand'][0], C['sand'][2], 36, C['sand']); [p.rect(x, 20, x + 3, 36, C['sand'][3]) or p.rect(x, 14, x + 3, 19, C['sand'][3]) for x in (3, 8, 22, 26)]   # no faces cut
    elif kind == 'well':
        ground(p, C['sky'][4], C['sky'][5], 30, C['sand']); p.rect(21, 40, 29, 44, C['stone'][2]); p.rect(23, 41, 27, 43, C['ink'][0])
    elif kind == 'desks':
        ground(p, d[1], d[0]); [p.rect(x, y, x + 6, y + 1, C['wood'][2]) or p.line(x + 3, y + 2, x + 3, y + 6, C['iron'][1]) for x, y in ((2, 22), (2, 32), (23, 22), (23, 32))]

# ------------------------------------------------------------------ the sitter
def figure(p, f):
    """The sitter as a blocky Minecraft character (Mateo: "minecraft textured like the 3d textures"): an 8x8 texel face,
    8x12 body, 4 wide arms and legs, every texel painted 2x2, shaded per texel like a skin seen from the front."""
    cx = 16 + f.get('dx', 0); oy = f.get('dy', 0); sk = SKIN[f.get('skin', 'pale')]; cl = sh(f['cloth']) if f['cloth'].startswith('#') else C[f['cloth']]
    hair = HAIR[f.get('hair', 'brown')]; flat = f.get('flat'); r = random.Random(sum(map(ord, f['cloth'])) + oy + cx)
    def tone(ramp_, i): return ramp_[1 if i < 3 else 3] if flat else ramp_[max(0, min(5, i))]
    def tx(gx, gy, ramp_, i, x0, y0):                      # one texel = 2x2 pixels
        c = tone(ramp_, i)
        for a in (0, 1):
            for b in (0, 1): p.set(x0 + gx * 2 + a, y0 + gy * 2 + b, c)
    hx0, hy0 = cx - 8, 8 + oy; bx0, by0 = cx - 8, hy0 + 16
    # legs, body, arms (drawn first so the head overlaps the collar)
    legc = sh('#4a3a30') if not f.get('robe', True) else cl
    for gy in range(0, 8):
        for gx in range(8):
            if by0 + 24 + gy * 2 > 61: break
            tx(gx, gy, legc, (2 if gx in (3, 4) else 3) - (1 if gx > 4 else 0) + r.choice((0, 0, -1)) * (not flat), bx0, by0 + 24)
    for gy in range(12):
        for gx in range(8):
            v = 3 + (1 if gx == 0 else 0) - (1 if gx >= 6 else 0) - (1 if gy == 11 else 0) + r.choice((0, 0, 0, -1)) * (not flat); tx(gx, gy, cl, v, bx0, by0)
        for gx in range(4):                                # arms: sitter's right on our left
            if gy < 10:
                tx(gx, gy, cl, 3 + (1 if gx == 0 else 0) - (1 if gx == 3 else 0), bx0 - 8, by0); tx(gx, gy, cl, 2 - (1 if gx == 3 else 0) + (1 if gx == 0 else 0), bx0 + 16, by0)
    for gx in range(2, 6): tx(gx, 0, sk, 2, bx0, by0)      # neck opening
    tx(2, 0, cl, 4, bx0, by0); tx(5, 0, cl, 2, bx0, by0)
    if f.get('apron'):
        ap = C[f['apron']]
        for gy in range(2, 12):
            for gx in range(2, 6): tx(gx, gy, ap, 3 + (1 if gx == 2 else 0) - (1 if gx == 5 else 0), bx0, by0)
    if f.get('fur'):
        for gx in range(-4, 12): tx(gx, 0, C['wool'], 4 if gx % 2 else 3, bx0, by0)
    if f.get('belt'):
        for gx in range(8): tx(gx, 8, C['leather'], 2 if gx != 3 else 4, bx0, by0)
    if f.get('seated'):
        for gy in range(0, 3):
            for gx in range(-2, 10): tx(gx, gy, cl, 4 - gy, bx0, by0 + 20)
    # head
    hs = f.get('hairstyle', 'short'); hood = f.get('hood'); hat = f.get('hat'); hd = C[hood] if hood in C else cl
    for gy in range(8):
        for gx in range(8):
            tx(gx, gy, sk, 3 + (1 if gx < 2 and gy < 6 else 0) - (1 if gx >= 6 else 0) - (1 if gy == 7 else 0), hx0, hy0)
    if f.get('smooth'):
        for gy in range(1, 7):
            for gx in range(1, 7): tx(gx, gy, sk, 4, hx0, hy0)          # too even: no shadow where there should be one
    def hair_tx(gx, gy): tx(gx, gy, hair, 3 + (1 if gx < 3 else 0) - (1 if gx >= 6 else 0), hx0, hy0)
    if hs in ('short', 'long', 'bun'):
        for gx in range(8): hair_tx(gx, 0); hair_tx(gx, 1) if gx in (0, 1, 6, 7) or hs != 'short' or gx % 3 else None
        for gy in (2, 3): hair_tx(0, gy); hair_tx(7, gy)
        if hs == 'long':
            for gy in range(4, 12): hair_tx(0, gy) if gy < 8 else tx(-1, gy - 8, hair, 3, bx0, by0); hair_tx(7, gy) if gy < 8 else tx(8, gy - 8, hair, 1, bx0, by0)
        if hs == 'bun':
            for gx in (3, 4): tx(gx, -1, hair, 3, hx0, hy0)
    elif hs == 'tonsure':
        for gx in (0, 1, 6, 7): hair_tx(gx, 0); hair_tx(gx, 1)
        for gy in (2, 3): hair_tx(0, gy); hair_tx(7, gy)
    else:                                                                # bald: a fringe over the ears
        for gy in (2, 3): hair_tx(0, gy); hair_tx(7, gy)
    ink = (40, 30, 28); eyec = f.get('eyes', ink); gz = f.get('gaze', 0); white = sk[5]
    def px2(gx, gy, c):
        for a in (0, 1):
            for b in (0, 1): p.set(hx0 + gx * 2 + a, hy0 + gy * 2 + b, c)
    if f.get('closed'):
        for gx in (1, 2, 5, 6): px2(gx, 4, sk[1])
    elif gz == 2:                                                        # looking down
        for gx in (1, 2, 5, 6): px2(gx, 4, sk[2]); p.set(hx0 + gx * 2, hy0 + 9, eyec); p.set(hx0 + gx * 2 + 1, hy0 + 9, eyec)
    else:
        for a, b in ((1, 2), (5, 6)):
            wgx, pgx = (a, b) if (gz > 0 or (gz == 0 and a == 1)) else (b, a)
            if gz == 0: wgx, pgx = (a, b) if a == 1 else (b, a)
            px2(wgx, 4, white); px2(pgx, 4, eyec)
    br = f.get('brow', 0)
    for gx in (1, 2): px2(gx, 3 - (1 if br == 2 else 0), tone(hair, 1))
    for gx in (5, 6): px2(gx, 3 - (1 if br else 0), tone(hair, 1))
    px2(3, 5, sk[2]); px2(4, 5, sk[1])                                   # nose
    m = f.get('mouth', 'set'); lip = tuple(int(v * .62) for v in sk[2])
    px2(3, 6, lip); px2(4, 6, lip)
    if m == 'smile': px2(2, 6, lip); px2(5, 6, lip); p.set(hx0 + 4, hy0 + 11, lip); p.set(hx0 + 11, hy0 + 11, lip)
    if m == 'frown': p.set(hx0 + 5, hy0 + 14, lip); p.set(hx0 + 10, hy0 + 14, lip)
    if f.get('old'): p.set(hx0 + 2, hy0 + 11, sk[1]); p.set(hx0 + 13, hy0 + 11, sk[1]); p.rect(hx0 + 6, hy0 + 4, hx0 + 9, hy0 + 4, sk[2])
    if f.get('beard'):
        bc = HAIR[f['beard']]
        for gy in (5, 6, 7, 8):
            for gx in range(8):
                if gy == 5 and gx in (2, 3, 4, 5): continue
                if gy == 6 and gx in (3, 4): continue
                if gy == 8 and gx in (0, 7): continue
                tx(gx, gy, bc, 3 + (1 if gx < 2 else 0) - (1 if gx >= 6 else 0), hx0, hy0)
    if hood:
        for gy in range(-1, 9):
            for gx in range(-1, 9):
                if gy <= 0 or gx in (-1, 0, 7, 8): tx(gx, gy, hd, 3 + (1 if gx < 2 else 0) - (1 if gx >= 6 else 0), hx0, hy0)
    if hat == 'cap':
        for gx in range(-1, 8): tx(gx, 0, C['wool'], 2 if gx < 0 else 3, hx0, hy0)
        for gx in range(0, 8): tx(gx, -1, C['wool'], 4 if gx < 3 else 2, hx0, hy0)
    if hat == 'circlet':
        for gx in range(8): tx(gx, 1, C['bronze'], 4 if gx < 5 else 2, hx0, hy0)
        px2(3, 0, C['bronze'][5]); px2(4, 0, C['bronze'][4])
    if hat == 'wrap':
        for gy in range(-1, 10):
            for gx in range(-1, 9):
                if gy <= 0 or gx in (-1, 0, 7, 8) or gy >= 8: tx(gx, gy, C['wool'], 4 if gx < 2 else 2 if gx >= 6 else 3, hx0, hy0)
    return cx, by0 + 6, 10, sk
def hand(p, x, y, sk, bandage=False):
    c = C['white'] if bandage else sk; p.rect(x - 1, y - 1, x + 2, y + 2, c[4]); p.rect(x + 1, y - 1, x + 2, y + 2, c[3]); p.rect(x - 1, y + 2, x + 2, y + 2, c[2])
    if bandage: p.rect(x - 1, y - 5, x + 2, y - 2, c[3]); p.line(x - 1, y - 3, x + 2, y - 4, c[1])

# ------------------------------------------------------------------ props (rx,ry = sitter's right hand, on our left; lx,ly = their left)
def pole(p, x, y0, y1, c=None): c = c or C['wood']; p.line(x, y0, x, y1, c[3]); p.line(x + 1, y0 + 1, x + 1, y1, c[1])
def props(p, names, cx, top, bw, sk, f):
    ht = top - 6; rx, ry = cx - bw - 1, top + 15; lx, ly = cx + bw, top + 15; hands = {'r': (rx, ry), 'l': (lx, ly)}; ban = 'bandages' in names
    for nm in names:
        if nm == 'ferry_pole': pole(p, rx, 6, 61)
        elif nm == 'tally': p.rect(cx + 2, top + 17, cx + 2, top + 21, C['wood'][4]); [p.set(cx + 2, y, C['wood'][0]) for y in (top + 18, top + 20)]
        elif nm == 'key': p.rect(rx - 1, ry - 8, rx + 2, ry - 5, C['iron'][3]); p.rect(rx, ry - 7, rx + 1, ry - 6, C['dark'][0]); p.line(rx, ry - 4, rx, ry + 4, C['iron'][3]); p.rect(rx + 1, ry + 2, rx + 2, ry + 4, C['iron'][2])
        elif nm == 'spearhead': hands['r'] = (cx - 4, top + 14); hands['l'] = (cx + 3, top + 14); [p.rect(cx - 3 + i, top + 12, cx + 2 - i, top + 12 - i, C['rust'][3]) for i in range(3)]; p.set(cx, top + 9, C['rust'][4])
        elif nm == 'red_book': hands['r'] = (cx - 4, 47); p.rect(cx - 3, 46, cx + 1, 49, C['red'][3]); p.rect(cx - 3, 49, cx + 1, 49, C['red'][1])
        elif nm == 'lamp_feet': p.rect(5, 55, 6, 58, C['iron'][1]); p.glow(5, 54, C['fire'][5], 3)
        elif nm == 'hound': p.rect(cx + bw + 1, 48, cx + bw + 4, 61, C['wool'][2]); p.rect(cx + bw + 2, 43, cx + bw + 5, 47, C['wool'][3]); p.set(cx + bw + 5, 45, (30, 26, 24)); p.rect(cx + bw + 1, 44, cx + bw + 1, 45, C['wool'][1]); p.set(cx + bw + 6, 46, C['wool'][2])
        elif nm == 'keys': p.rect(lx - 1, ly + 2, lx + 1, ly + 4, C['iron'][2]); [p.set(lx - 1 + i, ly + 5 + (i % 2), C['iron'][4]) for i in range(3)]; p.line(rx, ry - 5, rx, ry - 1, C['brass'][4]); p.rect(rx - 1, ry - 7, rx + 1, ry - 6, C['brass'][4])
        elif nm == 'crook': pole(p, rx, 8, 61); p.line(rx, 8, rx + 2, 6, C['wood'][3]); p.line(rx + 2, 6, rx + 3, 9, C['wood'][3])
        elif nm == 'lamb': p.rect(lx - 3, ly - 3, lx + 1, ly, C['white'][4]); p.rect(lx - 4, ly - 4, lx - 3, ly - 3, C['white'][5]); p.set(lx - 4, ly - 4, (30, 26, 24)); p.rect(lx + 1, ly - 2, lx + 1, ly, C['white'][2])
        elif nm == 'sack_bell': p.rect(lx - 3, ly - 4, lx + 1, ly + 1, C['wool'][2]); p.rect(lx - 2, ly - 5, lx, ly - 5, C['wool'][3]); p.line(lx - 3, ly - 2, lx + 1, ly - 2, C['wool'][0]); p.set(lx - 1, ly + 2, C['bronze'][3])
        elif nm == 'shears': hands['r'] = (cx - 1, top + 12); hands['l'] = (cx + 1, top + 13); p.line(cx - 1, top + 15, cx, top + 28, C['iron'][4]); p.line(cx + 1, top + 15, cx, top + 28, C['iron'][2])
        elif nm == 'daybook': p.rect(lx - 3, ly - 3, lx + 1, ly, C['white'][4]); p.line(lx - 1, ly - 3, lx - 1, ly, C['white'][1]); p.line(rx + 1, ry - 4, rx + 3, ry, C['white'][5])
        elif nm == 'oar': pole(p, rx - 2, 14, 58); p.rect(rx - 3, 8, rx - 1, 14, C['wood'][4])
        elif nm == 'smudge': hands['l'] = (lx, ly - 4); p.set(lx, ly - 4, (150, 150, 152))
        elif nm == 'apple': hands['r'] = (cx - 3, top + 12); p.rect(cx - 3, top + 9, cx - 2, top + 10, C['red'][4]); p.set(cx - 2, top + 8, C['green'][4])
        elif nm == 'rock_hand': hands['l'] = (cx + bw + 2, ht + 4); p.rect(cx + bw + 3, 4, 29, 61, C['stone'][1]); p.line(cx + bw + 4, 10, cx + bw + 6, 40, C['vein'][3])
        elif nm == 'pick': p.line(rx, ry, cx + 5, ht - 3, C['wood'][3]); p.line(cx + 3, ht - 6, cx + 8, ht - 1, C['iron'][3])
        elif nm == 'ingot': p.rect(lx - 2, ly - 2, lx + 1, ly - 1, C['copper'][4]); p.rect(lx - 2, ly - 1, lx + 1, ly - 1, C['copper'][2])
        elif nm == 'fork': hands['r'] = (cx - 6, ht - 3); p.line(cx - 6, ht - 4, cx - 6, ht - 9, C['iron'][4]); p.set(cx - 7, ht - 10, C['iron'][5]); p.set(cx - 5, ht - 10, C['iron'][5]); p.set(cx - 7, ht - 11, C['iron'][5]); p.set(cx - 5, ht - 11, C['iron'][5])
        elif nm == 'cord': hands['r'] = (cx - 4, top + 14); hands['l'] = (cx + 3, top + 14); [p.set(x, top + 16 + (1 if x % 2 else 0), C['white'][3 if x % 3 else 5]) for x in range(cx - 3, cx + 4)]
        elif nm == 'axe': pole(p, lx + 1, 10, 61); p.rect(lx + 2, 10, lx + 4, 16, C['iron'][3]); p.rect(lx + 4, 11, lx + 4, 15, C['iron'][5])
        elif nm == 'stone': hands['r'] = (cx - 4, top + 14); hands['l'] = (cx + 3, top + 14); p.rect(cx - 2, top + 12, cx + 2, top + 15, C['stone'][3]); p.rect(cx + 1, top + 14, cx + 2, top + 15, C['stone'][1])
        elif nm == 'letter': p.rect(cx + 2, top + 13, cx + 4, top + 15, C['white'][5])
        elif nm == 'spyglass': p.line(rx, ry, rx + 5, ry - 5, C['brass'][4]); p.line(rx, ry + 1, rx + 5, ry - 4, C['brass'][2])
        elif nm == 'torch': p.line(rx, ry + 2, rx, ry - 6, C['wood'][3]); p.glow(rx, ry - 8, C['fire'][5], 2); p.set(rx, ry - 7, C['fire'][4])
        elif nm == 'page': hands['r'] = (cx - 4, top + 14); p.rect(cx - 3, top + 9, cx + 2, top + 16, C['white'][5]); p.line(cx - 2, top + 11, cx + 1, top + 11, C['ink'][2]); p.line(cx - 2, top + 13, cx + 1, top + 13, C['ink'][0]); p.line(cx - 2, top + 15, cx, top + 15, C['ink'][2])
        elif nm == 'rod': pole(p, rx, 4, 61); [p.set(rx, y, C['wood'][0]) for y in range(8, 60, 5)]
        elif nm == 'cup_r': p.rect(rx - 1, ry - 3, rx + 1, ry - 2, C['brass'][4]); p.set(rx, ry - 1, C['brass'][2])
        elif nm == 'cup_both': hands['r'] = (cx - 3, top + 14); hands['l'] = (cx + 2, top + 14); p.rect(cx - 1, top + 11, cx + 1, top + 13, C['brass'][4]); p.set(cx + 1, top + 13, C['brass'][2])
        elif nm == 'net': p.rect(3, 54, 9, 58, C['wool'][1]); [p.set(x, 54 + (x % 2) * 2, C['wool'][3]) for x in range(3, 10)]
        elif nm == 'jar': hands['r'] = (rx, ht + 2); p.rect(rx - 1, ht - 4, rx + 2, ht + 1, C['pale'][2]); p.glow(rx, ht - 2, C['pale'][5], 3); p.rect(rx - 1, ht - 5, rx + 2, ht - 5, C['wood'][2])
        elif nm == 'bowl': hands['r'] = (cx - 4, top + 12); hands['l'] = (cx + 3, top + 12); p.rect(cx - 3, top + 10, cx + 2, top + 11, C['wood'][3]); p.rect(cx - 2, top + 9, cx + 1, top + 9, C['ink'][2]); [p.set(cx + 4, top + 14 + i, C['white'][4]) for i in (0, 2, 4)]
        elif nm == 'board': p.rect(lx - 4, ly - 5, lx + 1, ly + 1, C['wood'][3]); p.rect(lx - 3, ly - 4, lx, ly, C['white'][4])
        elif nm == 'hook_lantern': pole(p, rx, 6, 61); p.line(rx, 6, rx + 3, 5, C['iron'][3]); p.rect(rx + 3, 7, rx + 4, 9, C['iron'][1]); p.glow(rx + 3, 8, C['fire'][5], 3)
        elif nm == 'lantern': p.rect(rx - 1, ry + 2, rx + 1, ry + 5, C['iron'][1]); p.glow(rx, ry + 3, C['fire'][5], 3)
        elif nm == 'hidden_hand': hands.pop('l')
        elif nm == 'eel_spear': pole(p, rx, 10, 61); [p.line(rx + d, 6, rx + d, 10, C['iron'][4]) for d in (-1, 0, 1)]
        elif nm == 'wet_shoes': p.rect(cx - 4, 59, cx - 1, 61, C['sea'][1]); p.rect(cx + 1, 59, cx + 4, 61, C['sea'][1]); p.set(cx - 2, 59, C['sea'][4]); p.set(cx + 3, 59, C['sea'][4])
        elif nm == 'clean_boots': p.rect(cx - 4, 58, cx - 1, 61, C['leather'][3]); p.rect(cx + 1, 58, cx + 4, 61, C['leather'][3]); p.set(cx - 3, 58, C['leather'][5]); p.set(cx + 2, 58, C['leather'][5])
        elif nm == 'chisel': p.line(rx, ry - 1, rx, ry - 5, C['iron'][4]); p.rect(lx - 1, ly - 5, lx + 1, ly - 3, C['wood'][3]); p.line(lx, ly - 2, lx, ly, C['wood'][1])
        elif nm == 'bandages': hands['r'] = (rx - 1, ry + 2); hands['l'] = (lx + 1, ly + 2)
        elif nm == 'seedling': hands['r'] = (cx - 6, 54); hands['l'] = (cx - 3, 54); p.line(cx - 5, 53, cx - 5, 49, C['green'][3]); p.rect(cx - 7, 47, cx - 5, 48, C['green'][4]); p.rect(cx - 5, 46, cx - 3, 47, C['green'][3]); p.rect(cx - 8, 56, cx - 2, 57, C['sand'][1])
        elif nm == 'ink_spoon': p.rect(rx - 1, ry - 2, rx + 1, ry, C['ink'][1]); p.set(rx, ry - 3, C['ink'][3]); p.line(lx, ly, lx + 2, ly - 4, C['iron'][4]); p.set(lx + 2, ly - 5, C['iron'][5])
        elif nm == 'desk_pen':
            p.rect(4, 44, 27, 46, C['wood'][3]); p.rect(4, 47, 27, 61, C['wood'][1]); p.line(24, 47, 24, 56, C['iron'][2]); hands['r'] = (cx - 6, 42); hands.pop('l', None)     # left hand out of sight
            p.line(cx - 6, 41, cx - 8, 36, C['white'][5]); p.rect(cx - 4, 42, cx + 2, 43, C['white'][4])
    for k, (x, y) in hands.items(): hand(p, x, y, sk, ban)

def finish(p, age, plate='name'):
    r = p.r; px = p.px
    for y in range(2, H - 2):                                              # varnish: warm, darker toward the corners; older = browner, with cracks
        for x in range(2, W - 2):
            c = px[x, y]; v = 1 - .28 * (((x - 13) / 16) ** 2 + ((y - 26) / 34) ** 2); k = min(.3, age / 2400)
            px[x, y] = tuple(int((c[i] * (1 - k) + (96, 72, 40)[i] * k) * v) for i in range(3)) + (255,)
    for _ in range(int(age / 140)):
        x, y = r.randrange(3, W - 3), r.randrange(3, H - 3)
        for i in range(r.randrange(2, 5)):
            c = px[x, y]; px[x, y] = tuple(int(v * .84) for v in c[:3]) + (255,); x = max(3, min(W - 4, x + r.choice((-1, 0, 1)))); y = min(H - 4, y + 1)
    fr = sh('#3a2616')
    for i in range(W):
        px[i, 0] = fr[1] + (255,); px[i, 1] = fr[2] + (255,); px[i, H - 1] = fr[0] + (255,); px[i, H - 2] = fr[1] + (255,)
    for j in range(H):
        px[0, j] = fr[1] + (255,); px[1, j] = fr[2] + (255,) if 1 <= j < H - 1 else px[1, j]; px[W - 1, j] = fr[0] + (255,); px[W - 2, j] = fr[1] + (255,) if 1 <= j < H - 1 else px[W - 2, j]
    px[0, 0] = fr[1] + (255,)
    if plate == 'name': [px.__setitem__((x, H - 2), C['brass'][4] + (255,)) for x in range(13, 19)]
    elif plate == 'gouged': [px.__setitem__((x, H - 2), (C['brass'][1] if x % 2 else fr[0]) + (255,)) for x in range(13, 19)]
    elif plate == 'short': [px.__setitem__((x, H - 2), C['brass'][3] + (255,)) for x in range(15, 18)]

F = dict
SPECS = {
 'harrowford_1': (310, 'river_fires', F(cloth='#5a5040', skin='burnt', hair='grey', hat='cap', old=True, belt=True), ['ferry_pole', 'tally']),
 'harrowford_2': (310, 'clock', F(cloth='ink', skin='pale', hair='white', hairstyle='bald', build='thin', old=True, mouth='frown'), ['key'], 'gouged'),
 'harrowford_3': (250, 'meadow', F(cloth='#7a4a3a', skin='burnt', hair='brown', hairstyle='bun', build='broad', apron='white'), ['spearhead']),
 'oakmere_1': (360, 'oaks', F(cloth='#4a4a38', skin='pale', hair='grey', beard='grey', old=True, seated=True, gaze=1, dy=4), ['red_book', 'lamp_feet']),
 'oakmere_2': (360, 'oaks', F(cloth='green', hood='green', skin='tan', build='thin', dx=-2), ['hound']),
 'oakmere_3': (330, 'walled_door', F(cloth='#6a4030', skin='ruddy', hair='brown', hairstyle='bald', build='broad', dx=-3, belt=True), ['keys']),
 'thistledown_1': (310, 'bell_hill', F(cloth='wool', skin='ruddy', hair='red', beard='red', dx=-2), ['crook', 'lamb']),
 'thistledown_2': (310, 'listening', F(cloth='#5a4a3a', skin='pale', hair='black', build='thin', gaze=-1, dx=2, mouth='frown', brow=1), ['sack_bell'], 'short'),
 'thistledown_3': (300, 'empty_frame', F(cloth='#6a5a48', skin='ruddy', hair='grey', hairstyle='bun', build='broad', old=True), ['shears']),
 'wrenfield_1': (300, 'lake', F(cloth='grey', skin='pale', hair='brown', hairstyle='bun', build='thin', brow=2, dx=-2), ['daybook']),
 'wrenfield_2': (300, 'boat', F(cloth='#7a8a9a', skin='pale', hair='ash', hairstyle='long', build='tiny', dy=14, mouth='frown', dx=2), ['oar', 'smudge']),
 'wrenfield_3': (285, 'chimney', F(cloth='#5a5a40', skin='tan', hair='white', hairstyle='bald', old=True, dy=5, build='thin'), ['apple']),
 'frosthelm_1': (700, 'mine', F(cloth='#5a6a80', skin='pale', hair='black', hairstyle='long', hat='circlet', fur=True, flat=True, dx=-3, mouth='set'), ['rock_hand']),
 'frosthelm_2': (700, 'ore', F(cloth='#6a5a4a', skin='ruddy', hair='brown', beard='brown', build='huge', flat=True), ['pick', 'ingot']),
 'frosthelm_3': (700, 'furnace', F(cloth='#5a5a5e', skin='grey', hair='grey', hairstyle='bun', apron='leather', closed=True, flat=True, mouth='frown', dx=-2), ['fork']),
 'wolfcairn_1': (310, 'cairn_start', F(cloth='wool', skin='pale', hair='white', hat='wrap', old=True, build='thin', dy=4, dx=-3), ['cord'], 'none'),
 'wolfcairn_2': (310, 'frozen_sea', F(cloth='#4a5a70', skin='pale', hair='blond', hairstyle='long', build='broad', fur=True, gaze=-1, dx=-1), ['axe']),
 'wolfcairn_3': (280, 'cairn_tall', F(cloth='#5a5a66', skin='ruddy', hair='brown', hairstyle='bun', build='broad', belt=True, dx=-4), ['stone', 'letter']),
 'gullcliff_1': (320, 'clear_sea', F(cloth='#5a5a3a', skin='burnt', hair='brown', hairstyle='long', dx=-3), ['spyglass']),
 'gullcliff_2': (310, 'grey_sails', F(cloth='#4a4a52', skin='tan', hair='white', beard='white', old=True, dx=-4), ['torch']),
 'gullcliff_3': (280, 'bunks', F(cloth='grey', skin='pale', hair='brown', hairstyle='tonsure', build='thin', gaze=2, dx=-4), ['page']),
 'tidewatch_1': (400, 'posts_sea', F(cloth='#6a7a80', skin='ruddy', hair='brown', hairstyle='tonsure', build='broad', mouth='smile', dx=-2), ['rod']),
 'tidewatch_2': (300, 'one_post', F(cloth='#6a7a80', skin='tan', hair='grey', hairstyle='tonsure', old=True, gaze=1, dx=-3), ['cup_both']),
 'tidewatch_3': (300, 'clear_sea', F(cloth='#5a6a5a', skin='smooth', hair='brown', smooth=True, mouth='smile', dx=1), ['cup_r', 'net', 'clean_boots']),
 'reedmoor_1': (700, 'even_market', F(cloth='reed', skin='tan', hair='black', build='thin', flat=True), ['jar']),
 'reedmoor_2': (350, 'fen', F(cloth='#4a4a38', skin='tan', hair='white', hat='wrap', old=True, build='tiny', dy=10, mouth='frown'), ['bowl']),
 'reedmoor_3': (350, 'fen_post', F(cloth='#6a5a40', skin='ruddy', hair='brown', hairstyle='tonsure', build='broad', brow=2, dx=-4), ['board']),
 'lanternbog_1': (450, 'lanterns', F(cloth='#3a4a40', skin='pale', hair='black', hairstyle='long', build='thin', dx=2), ['hook_lantern']),
 'lanternbog_2': (330, 'nine_lanterns', F(cloth='#4a4a3a', skin='pale', hair='grey', hairstyle='bun', brow=1), ['lantern', 'hidden_hand']),
 'lanternbog_3': (330, 'blue_lantern', F(cloth='#5a6a4a', skin='ruddy', hair='brown', hairstyle='long', mouth='smile', gaze=1, dx=-3), ['eel_spear', 'wet_shoes']),
 'redmesa_1': (285, 'statue_row', F(cloth='#8a5a40', skin='burnt', hair='black', hairstyle='bun', build='broad', apron='wool'), ['chisel']),
 'redmesa_2': (280, 'statues', F(cloth='#a04a30', skin='tan', hair='black', beard='black', mouth='frown', hat='wrap'), ['bandages']),
 'dunehold_1': (280, 'well', F(cloth='grey', skin='tan', hair='brown', hairstyle='bun', dy=14, gaze=2, dx=3), ['seedling']),
 'dunehold_2': (250, 'desks', F(cloth='grey', skin='tan', hair='white', hairstyle='tonsure', old=True, mouth='frown'), ['ink_spoon']),
 'dunehold_3': (200, 'desks', F(cloth='grey', skin='tan', hair='grey', hairstyle='tonsure', old=True, brow=2, mouth='smile'), ['desk_pen']),
}
def under_the_bench(p):
    """redmesa_3: no person. A carver's bench from low down, and under it a wrapped bundle half buried in red sand."""
    ground(p, C['sand'][0], C['sand'][1], 40, C['sand'])
    p.rect(2, 16, 29, 19, C['wood'][3]); p.rect(2, 20, 29, 20, C['wood'][0]); p.rect(4, 21, 6, 50, C['wood'][2]); p.rect(25, 21, 27, 48, C['wood'][1])
    p.line(9, 15, 13, 13, C['iron'][4]); p.rect(18, 12, 21, 15, C['wood'][4])                            # chisel and mallet left on top
    for y in range(40, 52):
        for x in range(11, 21):
            if (x - 15.5) ** 2 / 26 + (y - 46) ** 2 / 36 <= 1: p.set(x, y, C['wool'][4 if x < 14 and y < 46 else 3 if x < 18 else 1])
    p.line(11, 45, 20, 46, C['leather'][1]); p.line(15, 40, 16, 51, C['leather'][1]); p.rect(15, 38, 16, 39, C['wool'][2])   # cord and knot
    for x in range(8, 24): p.set(x, 51 + (x % 3 == 0), C['sand'][3]); p.set(x, 52, C['sand'][2])          # sand drifted over it
    for y in range(21, 40): [p.set(x, y, tuple(int(v * .6) for v in p.px[x, y][:3])) for x in range(7, 25)]  # shadow under the bench

def build():
    os.makedirs(OUT, exist_ok=True); ims = {}
    for i, (name, spec) in enumerate(SPECS.items()):
        age, back, f, pr = spec[:4]; plate = spec[4] if len(spec) > 4 else 'name'; p = P(100 + i)
        bg(p, back); cx, top, bw, sk = figure(p, f); props(p, pr, cx, top, bw, sk, f); finish(p, age, plate); p.im.save(OUT + name + '.png'); ims[name] = p.im
    p = P(999); under_the_bench(p); finish(p, 280, 'short'); p.im.save(OUT + 'redmesa_3.png'); ims['redmesa_3'] = p.im
    names = sorted(ims, key=lambda n: list(SPECS).index(n) if n in SPECS else list(SPECS).index('redmesa_2') + .5)
    sheet = Image.new('RGBA', (12 * 36 + 4, 3 * 68 + 4), (24, 20, 26, 255))
    plots = []; [plots.append(n.rsplit('_', 1)[0]) for n in names if n.rsplit('_', 1)[0] not in plots]
    for n in names:
        pl, k = n.rsplit('_', 1); sheet.paste(ims[n], (4 + plots.index(pl) * 36, 4 + (int(k) - 1) * 68))
    sheet.resize((sheet.width * 4, sheet.height * 4), Image.NEAREST).save('/mnt/project-files/siege-nights/art/portraits/portraits.png')
if __name__ == '__main__': build()
