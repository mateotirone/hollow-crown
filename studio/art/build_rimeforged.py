"""Rimeforged gear (Frostmarch, forged at Rimeforge Hall's Rime Anvil; asked by the custom armour thread, 2026-11-13).
Dark iron rimed in pale blue, a fur collar, a dragon-head crest on the helm.

    python3 studio/art/build_rimeforged.py [repo root]      (re-run safe, everything is painted from scratch)

Writes, under Siege_Nights_RP/:
  textures/models/armor/rimeforged_layer_1.png, _2.png       flat sheets, vanilla 64x32 armour layout
  textures/models/siege_armor/rimeforged_<piece>.png         one 64x32 sheet per piece: the flat art plus the 3D parts,
                                                             tucked in the corners vanilla armour and trims leave empty
  models/entity/armor/rimeforged_<piece>.geo.json            helm: dragon head and swept horns; hauberk: fur collar and
                                                             pauldrons; greaves: knee cops; boots: fur cuffs
  attachables/rimeforged_<piece>.json                        for items siege:rimeforged_<helmet|chestplate|leggings|boots>
  textures/items/siege_rimeforged_<piece>.png, siege_rime_axe.png, siege_rime_spear.png, siege_rime_steel.png
  and their keys in textures/item_texture.json (the items themselves belong to the custom armour thread)
After a run, run python3 tools/build_player_joints.py (it cuts the arm and leg boxes at the elbow and knee).
Sheet for review: art/rimeforged-gear.png
"""
import colorsys, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from palette import M, fixed
from texlib import Tex, R, outline_alpha

ROOT = (sys.argv[1].rstrip('/') + '/') if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) + '/'
RP = ROOT + 'Siege_Nights_RP/'; T = RP + 'textures/'
IRON = fixed('#14161c', '#20242d', '#2e343f', '#3f4753', '#545e6c', '#6e7a89')      # dark, cold iron
RIME = fixed('#3e6480', '#6a9cbc', '#9ccbe4', '#c4e6f6', '#e2f5fd', '#f8feff')      # the frost on it
FUR = fixed('#6f6a66', '#9a948c', '#c2bbb0', '#e0dace', '#f1ede4', '#fdfcf8')
WOOD = M['spruce']
PIECES = ('helmet', 'chestplate', 'leggings', 'boots')


def faces(u, v, w, h, d):
    return dict(top=(u + d, v, w, d), bottom=(u + d + w, v, w, d), right=(u, v + d, d, h), front=(u + d, v + d, w, h),
                left=(u + d + w, v + d, d, h), back=(u + 2 * d + w, v + d, w, h))


def plate(px, f, keep=lambda x, y, w, h: True, tone=3, rime=True):
    """Dark plate, lit top-left. Frost gathers on the upper edge and in a few clusters below it."""
    x0, y0, w, h = f
    for y in range(h):
        for x in range(w):
            if not keep(x, y, w, h): continue
            v = tone + (1 if x == 0 else 0) - (1 if x == w - 1 else 0)
            if y + 1 >= h or not keep(x, y + 1, w, h): v = tone - 2
            c = IRON[max(0, min(5, v))]
            top = y == 0 or not keep(x, y - 1, w, h)
            if rime and top: c = RIME[3 if (x + y) % 3 else 4]
            elif rime and (x * 5 + y * 3) % 11 == 0 and y < h // 2 + 1: c = RIME[1]
            px[x0 + x, y0 + y] = c + (255,)


def fur(px, f, rows=None):
    x0, y0, w, h = f
    for y in range(h if rows is None else rows):
        for x in range(w):
            px[x0 + x, y0 + y] = FUR[max(0, min(5, 3 + (1 if (x + y * 2) % 3 == 0 else 0) - (1 if (x * 3 + y) % 5 == 0 else 0) - (1 if y == (h if rows is None else rows) - 1 else 0)))] + (255,)


def flat():
    """The two vanilla-layout sheets, split by piece so each 3D sheet can take only its own part."""
    part = {p: Image.new('RGBA', (64, 32)) for p in PIECES}
    p = part['helmet'].load(); hd = faces(0, 0, 8, 8, 8)
    plate(p, hd['top'], tone=4)
    plate(p, hd['front'], lambda x, y, w, h: y < 3 or (x in (0, 7) and y < 7) or (x in (3, 4) and y < 6))      # brow, cheek plates, nasal
    for k in ('right', 'left'): plate(p, hd[k], lambda x, y, w, h: y < 5 or (y < 7 and 1 <= x <= 5))
    plate(p, hd['back'], lambda x, y, w, h: y < 7)
    f = hd['front']
    for x in (1, 6): p[f[0] + x, f[1] + 1] = RIME[4] + (255,)                                                  # two rime studs on the brow
    p = part['chestplate'].load(); bd = faces(16, 16, 8, 12, 4)
    for k in ('front', 'back'): plate(p, bd[k], lambda x, y, w, h: y < 10 and not (y == 9 and x in (0, 7)), rime=False)
    for k in ('right', 'left'): plate(p, bd[k], lambda x, y, w, h: 1 <= y < 9, rime=False)
    plate(p, bd['top'], tone=4)
    for k in ('front', 'back', 'right', 'left'): fur(p, bd[k], rows=2)                                         # the fur collar lies on the shoulders
    f = bd['front']
    for y in range(3, 9):                                                                                      # hauberk: rows of rings, a rimed seam
        for x in range(8):
            if y % 2 and x % 2 == 0: p[f[0] + x, f[1] + y] = IRON[4] + (255,)
    for y in range(2, 9): p[f[0] + 3, f[1] + y] = RIME[2 if y % 2 else 3] + (255,); p[f[0] + 4, f[1] + y] = IRON[1] + (255,)
    for x in range(8): p[f[0] + x, f[1] + 8] = WOOD[2 if x not in (3, 4) else 4] + (255,)                      # belt
    p[f[0] + 3, f[1] + 8] = RIME[4] + (255,); p[f[0] + 4, f[1] + 8] = RIME[2] + (255,)
    ar = faces(40, 16, 4, 12, 4)
    plate(p, ar['top'], tone=5)
    for k in ('front', 'back', 'right', 'left'):
        plate(p, ar[k], lambda x, y, w, h: y < 4)
        g = ar[k]; plate(p, (g[0], g[1] + 5, g[2], 7), tone=2)                                                 # vambrace
    plate(p, ar['bottom'], tone=1, rime=False)
    p = part['boots'].load(); lg = faces(0, 16, 4, 12, 4)
    for k in ('front', 'back', 'right', 'left'):
        g = lg[k]; plate(p, (g[0], g[1] + 7, g[2], 5)); fur(p, (g[0], g[1] + 7, g[2], 1))
    plate(p, lg['bottom'], tone=1, rime=False)
    p = part['leggings'].load(); bd = faces(16, 16, 8, 12, 4)
    for k in ('front', 'back', 'right', 'left'):
        g = bd[k]; plate(p, (g[0], g[1] + 7, g[2], 5), rime=False)
    lg = faces(0, 16, 4, 12, 4)
    for k in ('front', 'back', 'right', 'left'): plate(p, lg[k], lambda x, y, w, h: y < 9, rime=False)
    f = lg['front']
    for x in (1, 2): p[f[0] + x, f[1] + 4] = RIME[4] + (255,); p[f[0] + x, f[1] + 5] = IRON[5] + (255,)        # knee plate
    for k in ('right', 'left'):
        g = lg[k]
        for y in range(1, 8, 2): p[g[0] + 1, g[1] + y] = RIME[1] + (255,)                                      # a frosted seam down the side
    l1 = Image.new('RGBA', (64, 32))
    for k in ('helmet', 'chestplate', 'boots'): l1.alpha_composite(part[k])
    os.makedirs(T + 'models/armor', exist_ok=True)
    l1.save(T + 'models/armor/rimeforged_layer_1.png'); part['leggings'].save(T + 'models/armor/rimeforged_layer_2.png')
    return part


# ---- 3D
def cube(o, s, uv, inf=0, mir=False):
    c = {"origin": o, "size": s, "uv": uv}
    if inf: c["inflate"] = inf
    if mir: c["mirror"] = True
    return c
PIV = {"head": [0, 24, 0], "body": [0, 24, 0], "rightArm": [-5, 22, 0], "leftArm": [5, 22, 0], "rightLeg": [-1.9, 12, 0], "leftLeg": [1.9, 12, 0]}
BASE = {
    "helmet": {"head": [cube([-4, 24, -4], [8, 8, 8], [0, 0], 1)]},
    "chestplate": {"body": [cube([-4, 12, -2], [8, 12, 4], [16, 16], 1.01)],
                   "rightArm": [cube([-8, 12, -2], [4, 12, 4], [40, 16], 1)], "leftArm": [cube([4, 12, -2], [4, 12, 4], [40, 16], 1, True)]},
    "leggings": {"body": [cube([-4, 12, -2], [8, 12, 4], [16, 16], 0.5)],
                 "rightLeg": [cube([-3.9, 0, -2], [4, 12, 4], [0, 16], 0.5)], "leftLeg": [cube([-0.1, 0, -2], [4, 12, 4], [0, 16], 0.5, True)]},
    "boots": {"rightLeg": [cube([-3.9, 0, -2], [4, 12, 4], [0, 16], 1)], "leftLeg": [cube([-0.1, 0, -2], [4, 12, 4], [0, 16], 1, True)]},
}
SKULL, SNOUT, HORN, COLLAR, PAULDRON, KNEE, CUFF = [32, 0], [50, 0], [50, 7], [32, 0], [32, 9], [32, 0], [32, 0]
EXTRAS = {   # odd sizes ("work in threes")
    "helmet": {"head": [cube([-1.5, 33, -3], [3, 3, 5], SKULL),                 # the dragon's skull along the crown
                        cube([-0.5, 33, -6], [1, 2, 3], SNOUT),                 # its snout over the brow
                        cube([-2.5, 35, 1], [1, 1, 5], HORN), cube([1.5, 35, 1], [1, 1, 5], HORN, 0, True)]},   # horns swept back
    "chestplate": {"body": [cube([-5, 22, -3], [10, 3, 6], COLLAR)],            # fur collar
                   "rightArm": [cube([-9.5, 22, -2.5], [5, 2, 5], PAULDRON)], "leftArm": [cube([4.5, 22, -2.5], [5, 2, 5], PAULDRON, 0, True)]},
    "leggings": {"rightLeg": [cube([-3.4, 6, -3.6], [3, 3, 1], KNEE)], "leftLeg": [cube([0.4, 6, -3.6], [3, 3, 1], KNEE, 0, True)]},
    "boots": {"rightLeg": [cube([-4.9, 5, -3], [6, 2, 6], CUFF)], "leftLeg": [cube([-1.1, 5, -3], [6, 2, 6], CUFF, 0, True)]},   # fur cuffs
}


def extra_px(uv, f, x, y, w, h):
    side = f not in ('top', 'bottom')
    if uv in (COLLAR, CUFF) and w > 3 or uv == CUFF:
        return FUR[max(0, min(5, (4 if f == 'top' else 3) + (1 if (x + y * 2) % 3 == 0 else 0) - (1 if (x * 3 + y) % 5 == 0 else 0) - (2 if f == 'bottom' else 1 if side and y == h - 1 else 0)))]
    if uv == SKULL:
        if f in ('right', 'left') and (x, y) == ((1, 1) if f == 'right' else (w - 2, 1)): return RIME[5]       # the eye, a point of frost light
        if f == 'top': return RIME[3] if x == 1 and y % 2 == 0 else IRON[4 if x == 1 else 3]                    # a rimed ridge of scales
        if side and y == 0: return RIME[2 if (x % 2) else 3]
        return IRON[1 if f == 'bottom' or y == h - 1 else 3 if (x + y) % 2 else 2]
    if uv == SNOUT:
        if f == 'front': return RIME[4] if y == 0 else IRON[1]                                                  # nostrils dark under a frosted nose
        if side and y == h - 1: return RIME[5] if x % 2 == 0 else IRON[1]                                       # teeth
        return IRON[4 if f == 'top' else 2]
    if uv == HORN:
        k = y if f in ('top', 'bottom') else x                                                                  # pale toward the tip
        return RIME[min(5, 1 + k)] if f != 'bottom' else RIME[1]
    if uv == PAULDRON:
        if f == 'top': return RIME[3] if (x in (0, w - 1) or y in (0, h - 1)) else IRON[4]
        return RIME[2 if x % 2 else 3] if y == 0 else IRON[2 if f != 'bottom' else 1]
    if uv == KNEE:
        if f == 'front': return RIME[5] if (x, y) == (1, 1) else RIME[3] if y == 0 else IRON[4]
        return IRON[3 if f == 'top' else 2]
    return IRON[3]


def uvfaces(c):
    w, h, d = c["size"]; return faces(c["uv"][0], c["uv"][1], w, h, d)


def build3d(part):
    os.makedirs(T + 'models/siege_armor', exist_ok=True); os.makedirs(RP + 'models/entity/armor', exist_ok=True)
    VIS = {"helmet": "helmet", "chestplate": "chest", "leggings": "leg", "boots": "boot"}
    for piece in PIECES:
        im = part[piece].copy(); px = im.load(); painted = set()
        for cs in EXTRAS[piece].values():
            for c in cs:
                for f, (x0, y0, fw, fh) in uvfaces(c).items():
                    for y in range(fh):
                        for x in range(fw):
                            at = (x0 + x, y0 + y)
                            assert at in painted or px[at][3] == 0, f'{piece}: 3D part would paint over the armour layer at {at}'
                            px[at] = extra_px(c["uv"], f, x, y, fw, fh) + (255,); painted.add(at)
        im.save(T + f'models/siege_armor/rimeforged_{piece}.png')
        bones = {k: list(v) for k, v in BASE[piece].items()}
        for b, cs in EXTRAS[piece].items(): bones.setdefault(b, []).extend(cs)
        json.dump({"format_version": "1.12.0", "minecraft:geometry": [{"description": {"identifier": f"geometry.siege_rimeforged_{piece}",
                   "texture_width": 64, "texture_height": 32, "visible_bounds_width": 3, "visible_bounds_height": 3, "visible_bounds_offset": [0, 1.5, 0]},
                   "bones": [{"name": n, "pivot": PIV[n], "cubes": cs} for n, cs in bones.items()]}]},
                  open(RP + f'models/entity/armor/rimeforged_{piece}.geo.json', 'w'), indent=1)
        json.dump({"format_version": "1.10.0", "minecraft:attachable": {"description": {"identifier": f"siege:rimeforged_{piece}",
                   "materials": {"default": "armor", "enchanted": "armor_enchanted"},
                   "textures": {"default": f"textures/models/siege_armor/rimeforged_{piece}", "enchanted": "textures/misc/enchanted_actor_glint"},
                   "geometry": {"default": f"geometry.siege_rimeforged_{piece}"},
                   "scripts": {"parent_setup": f"variable.{VIS[piece]}_layer_visible = 0.0;"},
                   "render_controllers": ["controller.render.armor"]}}}, open(RP + f'attachables/rimeforged_{piece}.json', 'w'), indent=1)


# ---- icons
def armour_icon(piece):
    im = Image.open(T + f'items/siege_guard_{piece}.png').convert('RGBA'); px = im.load(); W, H = im.size
    op = lambda x, y: 0 <= x < W and 0 <= y < H and px[x, y][3] > 0
    src = {(x, y): px[x, y] for y in range(H) for x in range(W) if px[x, y][3]}
    for (x, y), (r, g, b, a) in src.items():
        h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
        edge = not op(x, y - 1) or not op(x - 1, y) or not op(x + 1, y) or not op(x, y + 1)
        if edge: c = IRON[0]
        elif s > 0.35 and 0.09 < h < 0.19: c = RIME[4]                                   # gold studs become frost
        elif s > 0.40 and (h < 0.05 or h > 0.93): c = RIME[3] if piece == 'helmet' else IRON[2 + (1 if (x + y) % 2 else 0)]   # plume = crest; tabard = ring mail
        else:
            c = IRON[max(1, min(4, int(l * 6.4) - 1))]
            if not op(x, y - 2) and op(x, y - 1): c = RIME[3 if (x + y) % 3 else 4]       # frost lies along the upper edges
            elif (x * 5 + y * 3) % 13 == 0: c = RIME[1]
        px[x, y] = c + (255,)
    if piece in ('chestplate', 'boots'):                                                # fur collar, fur cuffs
        for x in range(W):
            ys = [y for y in range(H) if (x, y) in src]
            for y in ys[1:3 if piece == 'chestplate' else 2]:
                if (x, y - 1) in src and (x - 1, y) in src and (x + 1, y) in src: px[x, y] = FUR[3 + ((x + y) % 2)] + (255,)
    if piece == 'helmet':                                                               # the dragon's horns either side of the crest
        for (x, y) in ((5, 2), (4, 1), (10, 2), (11, 1)):
            if not op(x, y): px[x, y] = RIME[4] + (255,)
    im.save(T + f'items/siege_rimeforged_{piece}.png'); return im


def rows(spec): return [(x, y) for y, (a, b) in spec.items() for x in range(a, b + 1)]


def axe():
    t = Tex(); head = set(rows({1: (8, 10), 2: (7, 11), 3: (6, 12), 4: (6, 12), 5: (7, 12), 6: (8, 12), 7: (10, 12), 8: (11, 12)}))
    for i in range(2, 11):
        x, y = i, 15 - i
        if (x, y) not in head: t.set(x, y, R(WOOD, 4)); t.set(x + 1, y, R(WOOD, 2))
    for (x, y) in head:
        v = 3 + (1 if (x - 1, y) not in head else 0) - (1 if (x, y + 1) not in head else 0)
        t.set(x, y, R(IRON, v))
    outline_alpha(t, IRON[0])
    for (x, y) in head:                                       # the bit: frost-bitten along the top and the cutting edge
        if (x, y - 1) not in head or (x + 1, y) not in head: t.set(x, y, RIME[4 if (x + y) % 2 else 3])
    t.set(8, 3, RIME[1]); t.set(9, 5, RIME[1]); t.set(4, 11, RIME[2]); t.set(5, 10, IRON[3])      # frost creeping down, a binding
    t.save(T + 'items/siege_rime_axe.png'); return t.im


def spear():
    t = Tex()
    for i in range(1, 11): t.set(i, 15 - i, R(WOOD, 4)); t.set(i + 1, 15 - i, R(WOOD, 2))        # the shaft, low left to high right
    head = set(rows({1: (13, 14), 2: (11, 14), 3: (10, 13), 4: (10, 12), 5: (10, 11)}))
    for (x, y) in head: t.set(x, y, RIME[5 if x + y < 15 else 3 if x + y == 15 else 2])
    t.set(14, 1, RIME[5]); t.set(9, 6, IRON[4]); t.set(10, 6, IRON[2]); t.set(9, 5, IRON[4])       # dark iron socket
    outline_alpha(t, IRON[0])
    t.set(6, 9, RIME[2]); t.set(7, 9, RIME[1])                                                    # a frozen binding on the shaft
    t.save(T + 'items/siege_rime_spear.png'); return t.im


def ingot():
    shape = ['......#########.', '.....##########.', '....###########.', '...############.', '..#############.', '..############..', '..###########...', '..##########....', '..##########....']
    t = Tex(); S = {(x, y + 4) for y, r in enumerate(shape) for x, ch in enumerate(r) if ch == '#'}
    for (x, y) in S:
        top = y < 9 and (x + y) >= 10                         # the top face of the bar
        edge = (x, y - 1) not in S or (x - 1, y) not in S
        if (x + 1, y) not in S or (x, y + 1) not in S: c = IRON[0]
        elif top: c = RIME[3] if edge else (RIME[2] if (x * 3 + y) % 5 == 0 else IRON[5])
        else: c = IRON[2 if y > 10 else 3]
        t.set(x, y, c)
    for (x, y) in ((6, 9), (9, 9), (12, 9)): 
        if (x, y) in S: t.set(x, y, RIME[1])
    t.set(8, 5, RIME[5]); t.set(9, 6, RIME[4])
    t.save(T + 'items/siege_rime_steel.png'); return t.im


def main():
    part = flat(); build3d(part)
    icons = [armour_icon(p) for p in PIECES] + [axe(), spear(), ingot()]
    it_path = T + 'item_texture.json'; raw = open(it_path).read(); it = json.loads(raw); data = it['texture_data']; n = len(data)
    for k in [f'siege_rimeforged_{p}' for p in PIECES] + ['siege_rime_axe', 'siege_rime_spear', 'siege_rime_steel']:
        data[k] = {'textures': f'textures/items/{k}'}
    if len(data) != n: json.dump(it, open(it_path, 'w'), indent=1); open(it_path, 'a').write('\n')
    sh = Image.new('RGBA', (7 * 104 + 8, 104 + 8 + 4 * 168), (38, 34, 46, 255))
    for i, im in enumerate(icons): sh.alpha_composite(im.resize((96, 96), Image.NEAREST), (8 + i * 104, 8))
    for i, p in enumerate(PIECES): sh.alpha_composite(Image.open(T + f'models/siege_armor/rimeforged_{p}.png').convert('RGBA').resize((320, 160), Image.NEAREST), (8, 112 + i * 168))
    os.makedirs(ROOT + 'art', exist_ok=True); sh.save(ROOT + 'art/rimeforged-gear.png'); print('rimeforged ok')


main()
