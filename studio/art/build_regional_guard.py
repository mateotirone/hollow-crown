"""Regional Castle Guard armour (Mateo chose regional sets, 2026-11-10): five sets with the same stats as the
Castle Guard armour, each with its own look. Writes worn sheets (vanilla 64x32 armour layout, leather-dye trick:
alpha 255 = grey cloth that takes the banner colour, alpha 1 = keeps its own colour) and 16x16 item icons.

    python3 build_regional_guard.py [repo root]      (default: the shared project folder)

Files: textures/models/armor/guard_<region>_layer_1.png / _layer_2.png,
       textures/items/siege_guard_<region>_<helmet|chestplate|leggings|boots>.png, sheet art/regional-guard-armor.png
"""
import os, sys, random
from PIL import Image
from palette import M, REGIONS, fixed

ROOT = (sys.argv[1].rstrip('/') + '/') if len(sys.argv) > 1 else '/mnt/project-files/siege-nights/'
T = ROOT + 'Siege_Nights_RP/textures/'
REG = ['vale', 'frostmarch', 'saltreach', 'emberwaste', 'blackfen']
CLOTH = M['cloth']
FUR = fixed('#8a8580', '#b4aea6', '#d2ccc2', '#e8e3da', '#f4f1ea', '#fdfcf8')
PALE = fixed('#4a5560', '#7a8690', '#a9b3b8', '#cdd3d2', '#e4e6df', '#f6f5ee')      # salt-bleached steel
FENLEATHER = fixed('#1a1a12', '#2c2b1c', '#423f28', '#5a5536', '#726b45', '#8a8258')
BONE = M['parchment']
WOOL = fixed('#2a3038', '#3e4752', '#56616d', '#6e7a86', '#8995a0', '#a6b0b8')   # Frostmarch blue-grey wool
def dim(r, k): return [r[max(0, i - k)] for i in range(6)]


def faces(u, v, w, h, d):
    return dict(top=(u + d, v, w, d), bottom=(u + d + w, v, w, d), right=(u, v + d, d, h), front=(u + d, v + d, w, h),
                left=(u + d + w, v + d, d, h), back=(u + 2 * d + w, v + d, w, h))


# ---- surface patterns: return a tone 0..5 for pixel (x, y) of a w x h face
def p_plate(x, y, w, h, base=3):
    v = base + (1 if y == 0 or x == 0 else 0) - (1 if x == w - 1 else 0)
    if (x * 5 + y * 3) % 11 == 0 and v == base: v += 1
    return v
def p_mail(x, y, w, h): return 3 if (x + y) % 2 == 0 else 1 + (y % 3 == 0)
def p_scale(x, y, w, h):
    r = y // 2; c = (x + r % 2) % 3
    if y % 2 == 0: return 4 if c == 1 else 3
    return 1 if c != 1 else 2
def p_lam(x, y, w, h):
    if y % 4 == 3: return -1                     # lacing row (trim colour)
    return (3 if x % 2 == 0 else 2) + (1 if y % 4 == 0 else 0)
def p_quilt(x, y, w, h): return 2 if ((x + y) % 4 == 0 or (x - y) % 4 == 0) else 3 + ((x + y) % 7 == 1)
_rng = random.Random(5)
FURN = [[_rng.randint(2, 5) for _ in range(64)] for _ in range(32)]
def p_fur(x, y, w, h): return FURN[y % 32][(x * 7) % 64]
def p_leather(x, y, w, h): return 3 - (1 if x == w - 1 else 0) + (1 if y == 0 else 0) - ((x * 3 + y * 5) % 9 == 0)


class Sheet:
    def __init__(s): s.im = Image.new('RGBA', (64, 32)); s.p = s.im.load()
    def put(s, x, y, c, cloth=False): s.p[x, y] = tuple(c) + ((255,) if cloth else (1,))
    def fill(s, f, ramp, pat, keep=lambda x, y, w, h: True, rows=None, trim=None, shade_bottom=True, cloth=False):
        x0, y0, w, h = f
        r0, r1 = rows or (0, h)
        for y in range(r0, r1):
            for x in range(w):
                if not keep(x, y, w, h): continue
                v = pat(x, y - r0, w, r1 - r0)
                if v == -1: s.put(x0 + x, y0 + y, (trim or ramp)[3]); continue
                if shade_bottom and y == r1 - 1: v = min(v, 2) - 1
                s.put(x0 + x, y0 + y, ramp[max(0, min(5, v))], cloth)
    def row(s, f, y, ramp, tone=4, xs=None, cloth=False):
        x0, y0, w, h = f
        for x in (xs if xs is not None else range(w)):
            s.put(x0 + x, y0 + y, ramp[tone - (1 if x == w - 1 else 0)], cloth)
    def dot(s, f, x, y, c): s.put(f[0] + x, f[1] + y, c)


EMBLEM = {   # 4 wide x 5 tall marks on the tabard, painted in the trim colour (not tinted)
    'vale':       [".##.", "####", ".##.", ".##.", ".##."],        # cross
    'frostmarch': ["#..#", ".##.", "####", ".##.", "#..#"],        # star
    'saltreach':  [".##.", ".##.", "####", ".##.", "#..#"],        # anchor
    'emberwaste': [".#..", ".##.", "####", "####", ".##."],        # flame
    'blackfen':   [".##.", "#..#", "#.##", "#..#", ".##."],        # watching eye
}


def tabard(s, bd, reg, trim, cols=(2, 6), r0=1):
    for k in ('front', 'back'):
        f = bd[k]
        s.fill(f, CLOTH, lambda x, y, w, h: 3 + (1 if x == cols[0] else 0) - (1 if y == h - 1 else 0),
               lambda x, y, w, h: cols[0] <= x < cols[1], rows=(r0, 12), cloth=True, shade_bottom=False)
    f = bd['front']; e = EMBLEM[reg]; ox = cols[0] + (cols[1] - cols[0] - 4) // 2
    for yy, line in enumerate(e):
        for xx, ch in enumerate(line):
            if ch == '#': s.dot(f, ox + xx, r0 + 2 + yy, trim[4 if yy < 2 else 3])


def build(reg):
    L1, L2 = Sheet(), Sheet()
    hd = faces(0, 0, 8, 8, 8); bd = faces(16, 16, 8, 12, 4); ar = faces(40, 16, 4, 12, 4); lg = faces(0, 16, 4, 12, 4)
    sides4 = ('front', 'back', 'right', 'left')
    if reg == 'vale':      # kettle hat over a mail coif, brigandine with brass rivets, leather boots with steel toes
        met, trim, lea = M['steel'], M['gold'], M['leather']
        L1.fill(hd['top'], met, lambda x, y, w, h: p_plate(x, y, w, h, 4), shade_bottom=False)
        for k in ('front', 'back', 'right', 'left'):
            L1.fill(hd[k], met, p_plate, rows=(0, 3))
            L1.row(hd[k], 2, met, 2)
            face = (lambda x, y, w, h: x in (0, 7) or y == 7) if k == 'front' else (lambda x, y, w, h: True)
            L1.fill(hd[k], met, p_mail, face, rows=(3, 8))
        L1.fill(bd['top'], lea, p_leather, shade_bottom=False)
        for k in sides4: L1.fill(bd[k], lea, p_leather, rows=(0, 11))
        for k in sides4:
            f = bd[k]
            for y in range(1, 11, 3):
                for x in range(1, f[2], 3): L1.dot(f, x, y, trim[4])
        tabard(L1, bd, reg, trim)
        for k in sides4: L1.fill(ar[k], met, p_plate, rows=(0, 4)); L1.row(ar[k], 3, trim, 3)
        for k in sides4: L1.fill(ar[k], met, p_mail, rows=(4, 10)); L1.fill(ar[k], lea, p_leather, rows=(10, 12))
        L1.fill(ar['top'], met, lambda x, y, w, h: 4, shade_bottom=False); L1.fill(ar['bottom'], lea, lambda *a: 2)
        for k in sides4: L1.fill(lg[k], lea, p_leather, rows=(8, 12))
        L1.fill(lg['front'], met, p_plate, rows=(10, 12)); L1.fill(lg['bottom'], lea, lambda *a: 1)
        for k in sides4: L2.fill(bd[k], lea, p_leather, rows=(7, 12)); L2.row(bd[k], 7, trim, 3)
        for k in sides4: L2.fill(lg[k], met, p_mail, rows=(0, 9))
    elif reg == 'frostmarch':   # spangenhelm in a fur hood, quilted gambeson, fur collar and cuffs
        met, trim, lea = M['steel'], REGIONS['frostmarch']['accent'], M['spruce']
        quilt = WOOL
        L1.fill(hd['top'], met, lambda x, y, w, h: p_plate(x, y, w, h, 4) - (1 if x in (3, 4) or y in (3, 4) else 0), shade_bottom=False)
        for k in ('front', 'back', 'right', 'left'):
            L1.fill(hd[k], met, p_plate, rows=(0, 2))
            L1.fill(hd[k], FUR, p_fur, rows=(2, 4), shade_bottom=False)
            if k == 'front':
                L1.fill(hd[k], FUR, p_fur, lambda x, y, w, h: x in (0, 7), rows=(4, 8))
                L1.fill(hd[k], met, lambda *a: 4, lambda x, y, w, h: x in (3, 4), rows=(2, 6), shade_bottom=False)  # nasal
            else:
                L1.fill(hd[k], FUR, p_fur, rows=(4, 8))
        L1.fill(bd['top'], FUR, p_fur, shade_bottom=False)
        for k in sides4: L1.fill(bd[k], quilt, p_quilt, rows=(0, 11)); L1.fill(bd[k], FUR, p_fur, rows=(0, 2), shade_bottom=False)
        tabard(L1, bd, reg, trim, r0=2)
        for k in sides4:
            L1.fill(ar[k], FUR, p_fur, rows=(0, 2), shade_bottom=False); L1.fill(ar[k], quilt, p_quilt, rows=(2, 10))
            L1.fill(ar[k], FUR, p_fur, rows=(10, 12), shade_bottom=False)
        L1.fill(ar['top'], FUR, p_fur, shade_bottom=False); L1.fill(ar['bottom'], FUR, lambda *a: 2)
        for k in sides4: L1.fill(lg[k], FUR, p_fur, rows=(7, 9), shade_bottom=False); L1.fill(lg[k], lea, p_leather, rows=(9, 12))
        L1.fill(lg['bottom'], lea, lambda *a: 1)
        for k in sides4: L2.fill(bd[k], quilt, p_quilt, rows=(7, 12)); L2.row(bd[k], 7, lea, 2)
        for k in sides4: L2.fill(lg[k], quilt, p_quilt, rows=(0, 8)); L2.row(lg[k], 0, trim, 3)
    elif reg == 'saltreach':    # salt-bleached sallet with a visor slit, pale breastplate, rope belt, sea-green scale
        met, trim, lea = PALE, dim(REGIONS['saltreach']['accent'], 1), M['rope']
        L1.fill(hd['top'], met, lambda x, y, w, h: p_plate(x, y, w, h, 4), shade_bottom=False)
        for k in ('front', 'back', 'right', 'left'):
            if k == 'front':
                L1.fill(hd[k], met, p_plate, rows=(0, 4))
                L1.fill(hd[k], met, lambda *a: 0, lambda x, y, w, h: 1 <= x <= 6, rows=(2, 3), shade_bottom=False)  # visor slit
                L1.fill(hd[k], met, p_plate, lambda x, y, w, h: y >= 2, rows=(5, 8))                              # bevor
            elif k == 'back': L1.fill(hd[k], met, p_plate, rows=(0, 8))                                          # the tail
            else: L1.fill(hd[k], met, p_plate, lambda x, y, w, h: y < 6 or x >= 4, rows=(0, 8))
            L1.row(hd[k], 0, trim, 3)
        L1.fill(bd['top'], met, lambda *a: 4, shade_bottom=False)
        for k in sides4: L1.fill(bd[k], met, p_plate, rows=(0, 8)); L1.fill(bd[k], trim, p_scale, rows=(8, 12))
        tabard(L1, bd, reg, trim, r0=1)
        for k in sides4: L1.row(bd[k], 7, lea, 3); L1.row(bd[k], 8, lea, 2)
        for k in sides4:
            L1.fill(ar[k], trim, p_scale, rows=(0, 5)); L1.fill(ar[k], met, p_plate, rows=(7, 12))
        L1.fill(ar['top'], trim, lambda *a: 4, shade_bottom=False); L1.fill(ar['bottom'], met, lambda *a: 2)
        for k in sides4:
            L1.fill(lg[k], lea, lambda x, y, w, h: 3 if (x + y) % 3 else 1, rows=(8, 12))                        # rope wraps
        L1.fill(lg['bottom'], M['leather'], lambda *a: 1)
        for k in sides4: L2.fill(bd[k], trim, p_scale, rows=(7, 12)); L2.row(bd[k], 7, lea, 3)
        for k in sides4: L2.fill(lg[k], met, p_plate, rows=(0, 8))
        L2.fill(lg['front'], met, lambda *a: 5, lambda x, y, w, h: x in (1, 2), rows=(4, 6), shade_bottom=False)  # knee
    elif reg == 'emberwaste':   # blackened scale from crown to boot, ember trim, a veil across the face, crest on top
        met, trim, lea = M['blacksteel'], M['ember'], M['leather']
        L1.fill(hd['top'], met, lambda x, y, w, h: p_plate(x, y, w, h, 3), shade_bottom=False)
        L1.fill(hd['top'], trim, lambda *a: 3, lambda x, y, w, h: x in (3, 4), shade_bottom=False)              # crest
        for k in ('front', 'back', 'right', 'left'):
            if k == 'front':
                L1.fill(hd[k], met, p_plate, rows=(0, 2))
                L1.fill(hd[k], met, p_scale, lambda x, y, w, h: x in (0, 7), rows=(2, 4))
                L1.fill(hd[k], CLOTH, lambda x, y, w, h: 3 - (y == h - 1) + (y == 0), rows=(4, 8), cloth=True, shade_bottom=False)  # veil
            else: L1.fill(hd[k], met, p_scale, rows=(0, 8))
            L1.row(hd[k], 1, trim, 3)
        L1.fill(bd['top'], met, lambda *a: 3, shade_bottom=False)
        for k in sides4: L1.fill(bd[k], met, p_scale, rows=(0, 12))
        tabard(L1, bd, reg, trim, cols=(3, 5), r0=1)
        f = bd['front']; ox = 2
        for yy, line in enumerate(EMBLEM[reg]):
            for xx, ch in enumerate(line):
                if ch == '#': L1.dot(f, ox + xx, 3 + yy, trim[4 if yy < 2 else 3])
        for k in sides4: L1.fill(ar[k], met, p_scale, rows=(0, 12)); L1.row(ar[k], 4, trim, 3)
        L1.fill(ar['top'], met, lambda *a: 4, shade_bottom=False); L1.fill(ar['bottom'], met, lambda *a: 1)
        for k in sides4: L1.fill(lg[k], met, p_plate, rows=(8, 12)); L1.row(lg[k], 8, trim, 3)
        L1.fill(lg['bottom'], met, lambda *a: 0)
        for k in sides4: L2.fill(bd[k], met, p_scale, rows=(7, 12)); L2.row(bd[k], 7, trim, 3)
        for k in sides4: L2.fill(lg[k], met, p_scale, rows=(0, 8))
    else:                       # blackfen: dark leather lamellar laced with reed-green, bone toggles and a bone nasal
        met, trim, lea = FENLEATHER, dim(REGIONS['blackfen']['accent'], 2), M['rope']
        L1.fill(hd['top'], met, lambda x, y, w, h: p_lam(x, y, w, h) if p_lam(x, y, w, h) >= 0 else 2, shade_bottom=False)
        for k in ('front', 'back', 'right', 'left'):
            if k == 'front':
                L1.fill(hd[k], met, p_lam, rows=(0, 2), trim=trim)
                L1.fill(hd[k], met, p_lam, lambda x, y, w, h: x in (0, 1, 6, 7), rows=(2, 7), trim=trim)        # cheek flaps
                L1.fill(hd[k], BONE, lambda *a: 4, lambda x, y, w, h: x in (3, 4), rows=(1, 5), shade_bottom=False)  # nasal
            else: L1.fill(hd[k], met, p_lam, rows=(0, 7), trim=trim)
        L1.fill(bd['top'], met, lambda *a: 3, shade_bottom=False)
        for k in sides4: L1.fill(bd[k], met, p_lam, rows=(0, 12), trim=trim)
        tabard(L1, bd, reg, trim)
        for k in ('front', 'back'):
            for y in (2, 6, 10): L1.dot(bd[k], 1, y, BONE[4]); L1.dot(bd[k], 6, y, BONE[4])                    # bone toggles
        for k in sides4:
            L1.fill(ar[k], met, p_lam, rows=(0, 6), trim=trim)
            L1.fill(ar[k], M['leather'], p_leather, rows=(6, 12))
            for y in (7, 10): L1.row(ar[k], y, lea, 3)
        L1.fill(ar['top'], met, lambda *a: 3, shade_bottom=False); L1.fill(ar['bottom'], M['leather'], lambda *a: 1)
        for k in sides4: L1.fill(lg[k], lea, lambda x, y, w, h: 3 if (x + 2 * y) % 4 else 1, rows=(8, 12))
        L1.fill(lg['bottom'], met, lambda *a: 1)
        for k in sides4: L2.fill(bd[k], met, p_lam, rows=(7, 12), trim=trim)
        for k in sides4: L2.fill(lg[k], M['leather'], p_leather, rows=(0, 8))
        L2.fill(lg['front'], BONE, lambda *a: 4, lambda x, y, w, h: x in (1, 2), rows=(4, 6), shade_bottom=False)  # bone kneecap
    return L1.im, L2.im, (met, trim, lea)


# ---- icons: re-tone the Castle Guard icons (same silhouettes as the base set), then add each region's mark
def lum(c): return 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]
def icon(reg, piece, ramps):
    met, trim, lea = ramps
    src = Image.open(T + f'items/siege_guard_{piece}.png').convert('RGBA'); px = src.load()
    out = Image.new('RGBA', (16, 16)); o = out.load()
    import colorsys
    for y in range(16):
        for x in range(16):
            c = px[x, y]
            if c[3] == 0: continue
            h, l, s = colorsys.rgb_to_hls(*(v / 255 for v in c[:3]))
            k = max(0, min(5, int(lum(c) / 255 * 6.2) + (1 if reg in ('emberwaste', 'blackfen') else 0)))
            if s > 0.45 and (h < 0.03 or h > 0.93): o[x, y] = c                                 # red cloth: stays (takes dye)
            elif s > 0.35 and 0.09 < h < 0.19: o[x, y] = tuple(trim[max(2, k)]) + (255,)          # gold
            elif s > 0.2 and h < 0.11: o[x, y] = tuple(lea[k]) + (255,)                         # leather
            else: o[x, y] = tuple(met[k]) + (255,)
    def P(x, y, c):
        if 0 <= x < 16 and 0 <= y < 16: o[x, y] = tuple(c) + (255,)
    occ = [(x, y) for y in range(16) for x in range(16) if o[x, y][3]]
    bottom = max(y for _, y in occ); top = min(y for _, y in occ)
    xs = [x for x, y in occ if y == bottom]; left, right = min(xs), max(xs)
    if reg == 'frostmarch' and piece in ('helmet', 'boots', 'chestplate'):
        yb = bottom if piece == 'helmet' else (top + 1 if piece == 'chestplate' else min(y for x, y in occ if y > bottom - 4))
        for x, y in occ:
            if y == yb: P(x, y, FUR[4 if x % 2 else 3])
    if reg == 'emberwaste' and piece == 'helmet':
        cx = sum(x for x, _ in occ) // len(occ)
        P(cx, top - 1, trim[4]); P(cx, top - 2, trim[3]); P(cx - 1, top - 1, trim[2])
    if reg == 'saltreach' and piece == 'helmet':
        for x, y in occ:
            if y == bottom and x == right: P(x + 1, y, met[2]); P(x + 1, y - 1, met[3])
    if reg == 'blackfen' and piece == 'chestplate':
        for x, y in occ:
            if y in (top + 4, top + 7) and o[x, y][:3] == tuple(lea[3]): P(x, y, BONE[4])
    if reg == 'blackfen' and piece == 'helmet':
        cx = sum(x for x, _ in occ) // len(occ)
        for y in range(top + 2, top + 6): P(cx, y, BONE[4])
    if reg == 'vale' and piece == 'chestplate':
        for x, y in occ:
            if (x + y) % 3 == 0 and o[x, y][:3] in [tuple(c) for c in lea]: P(x, y, trim[4])
    return out


PIECES = ['helmet', 'chestplate', 'leggings', 'boots']

# ---- tiers (Mateo 2026-11-11): every region's set comes in iron (the original ids), diamond and netherite.
# A higher tier is the same regional look with its metal re-toned. Ids: siege:guard_<region>[_<tier>]_<piece>.
DIAMOND = fixed('#0f3a3d', '#1b6b6e', '#2aa3a3', '#4fd3cf', '#8ef0e8', '#d4fffb')
NETHERITE = fixed('#1c1719', '#2b2427', '#3d3437', '#4f4548', '#665a5c', '#7f7275')
TIERS = {'': None, 'diamond': DIAMOND, 'netherite': NETHERITE}


def retone(im, src, dst):
    if dst is None: return im
    look = {tuple(c): tuple(d) for c, d in zip(src, dst)}
    out = im.copy(); px = out.load()
    for y in range(out.size[1]):
        for x in range(out.size[0]):
            c = px[x, y]
            if c[3] and c[:3] in look: px[x, y] = look[c[:3]] + (c[3],)
    return out


def tier_ramps(reg, ramps, tier):
    met, trim, lea = ramps
    new = TIERS[tier]
    if new is None: return ramps
    if tier == 'netherite' and reg == 'emberwaste': trim = M['gold']   # black on black needs a gold edge
    return new, trim, lea


def main():
    os.makedirs(T + 'models/armor', exist_ok=True)
    sheet = Image.new('RGBA', (5 * 216 + 8, 300 * len(TIERS)), (38, 34, 46, 255))
    for t, tier in enumerate(TIERS):
        for i, reg in enumerate(REG):
            l1, l2, ramps = build(reg)
            met, trim, lea = ramps
            nmet, ntrim, _ = tier_ramps(reg, ramps, tier)
            if tier:
                l1, l2 = (retone(retone(im, met, nmet), trim, ntrim) for im in (l1, l2))
                if reg == 'frostmarch':   # mostly wool and fur: the quilting takes the tier's colour too
                    l1, l2 = (retone(im, WOOL, dim(nmet, 1)) for im in (l1, l2))
            name = f'{reg}_{tier}' if tier else reg
            l1.save(T + f'models/armor/guard_{name}_layer_1.png'); l2.save(T + f'models/armor/guard_{name}_layer_2.png')
            for n, im in enumerate((l1, l2)):
                v = im.copy(); v.putalpha(im.getchannel('A').point(lambda a: 255 if a else 0))
                sheet.alpha_composite(v.resize((192, 96), Image.NEAREST), (8 + i * 216, 8 + n * 104 + t * 300))
            for j, pc in enumerate(PIECES):
                ic = icon(reg, pc, tier_ramps(reg, ramps, tier)); ic.save(T + f'items/siege_guard_{name}_{pc}.png')
                sheet.alpha_composite(ic.resize((44, 44), Image.NEAREST), (8 + i * 216 + j * 48, 224 + t * 300))
    os.makedirs(ROOT + 'art', exist_ok=True)
    sheet.save(ROOT + 'art/regional-guard-armor.png'); print('ok')


if __name__ == '__main__':
    main()
