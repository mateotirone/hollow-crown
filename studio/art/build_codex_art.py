"""Final art for the Codex items (custom armour thread's plan, 2026-11-13): the four regional sets after Rimeforged,
their weapons and the wonder alloys. Paths are the ones agreed with that thread, so its stand-ins are simply replaced:

  textures/items/codex/<id>.png                      icons (keys siege_cx_<id> are that thread's)
  textures/models/siege_armor/codex_<id>.png         worn armour, one 64x32 vanilla-layout sheet per piece (trim-safe)
  models/entity/armor/codex_<id>.geo.json            geometry.siege_codex_<id>: the armour boxes plus the 3D parts

    python3 studio/art/build_codex_art.py [repo root]      then  python3 tools/build_player_joints.py
Re-run safe (everything is painted from scratch). Sheet for review: art/codex-regional-gear.png

  Watchward (Vale)        steel-blue plate, green surcoat, gold beacon trim; a gold comb with a beacon flame on the helm
  Tidewrought (Saltreach) sea-green plate, pearl studs; a lit lighthouse lamp on the helm, fin cuffs on the boots
  Sunscale (Emberwaste)   bronze scale over sand cloth; a sun disc on the brow and the chest, a neck veil
  Fenlight (Blackfen)     dark moss leather and bogsilver; a peaked hood, small lit lantern charms at the ear and belt
"""
import colorsys, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from palette import M, fixed
from texlib import Tex, outline_alpha

ROOT = (sys.argv[1].rstrip('/') + '/') if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) + '/'
RP = ROOT + 'Siege_Nights_RP/'; T = RP + 'textures/'
PIECES = ('helmet', 'chestplate', 'leggings', 'boots')
GOLD, WOOD, DARKWOOD = M['gold'], M['spruce'], M['dark_oak']
PEARL = fixed('#8a8f9c', '#b4bac4', '#d6dade', '#ecefef', '#f8faf8', '#ffffff')
SETS = {
    'watchward': dict(metal=fixed('#1c2536', '#2e3d56', '#465a78', '#63799a', '#8a9db8', '#b9c8d8'), trim=GOLD,
                      cloth=fixed('#16300f', '#254d18', '#377024', '#4f8f33', '#72ac4e', '#9ccb78'), glow=M['flame'], style='plate', tabard=True),
    'tidewrought': dict(metal=fixed('#0d2a2c', '#17474a', '#22696a', '#339088', '#58b5a6', '#95d8c8'), trim=PEARL,
                        cloth=fixed('#12262e', '#1d3c48', '#2c5666', '#417386', '#5f93a6', '#8ab6c6'), glow=fixed('#8a6a14', '#c49a22', '#f0c840', '#ffe680', '#fff6c0', '#fffdf0'), style='plate', tabard=False),
    'sunscale': dict(metal=fixed('#3c2208', '#643a0e', '#905a1a', '#b9802c', '#dba848', '#f4d484'), trim=fixed('#7a4a08', '#b87a10', '#e8ac20', '#fcd040', '#ffe888', '#fff8d0'),
                     cloth=fixed('#6e5a3a', '#948058', '#b8a67a', '#d4c69a', '#e8dec0', '#f6f0dc'), glow=fixed('#b87a10', '#e8ac20', '#fcd040', '#ffe888', '#fff8d0', '#ffffff'), style='scale', tabard=True),
    'fenlight': dict(metal=fixed('#12160e', '#1e2618', '#2c3824', '#3e4c32', '#536444', '#6e8058'), trim=fixed('#4a5258', '#6c767c', '#909ca0', '#b4c0c2', '#d4dede', '#eef4f2'),
                     cloth=fixed('#1a1410', '#2a221a', '#3c3226', '#504434', '#665846', '#7e705c'), glow=fixed('#3a6a10', '#6aa820', '#a0dc40', '#c8f470', '#e4fcb0', '#f8ffe8'), style='leather', tabard=False),
}


def faces(u, v, w, h, d):
    return dict(top=(u + d, v, w, d), bottom=(u + d + w, v, w, d), right=(u, v + d, d, h), front=(u + d, v + d, w, h),
                left=(u + d + w, v + d, d, h), back=(u + 2 * d + w, v + d, w, h))


def surface(S, px, f, keep=lambda x, y, w, h: True, tone=3, trim=True, ramp=None):
    """One face of armour in the set's own make: bevelled plate, rows of scales, or stitched leather. Trim on the upper edge."""
    x0, y0, w, h = f; R = ramp or S['metal']; st = S['style'] if ramp is None else 'plate'
    for y in range(h):
        for x in range(w):
            if not keep(x, y, w, h): continue
            v = tone + (1 if x == 0 else 0) - (1 if x == w - 1 else 0)
            if st == 'scale': v = tone + (1 if (y % 2 == 0) else -1 if (x + (y // 2)) % 2 else 0)        # lit lip, shadow under each scale
            if st == 'leather': v = tone - (1 if (x * 3 + y * 5) % 7 == 0 else 0) + (1 if (x + y * 2) % 9 == 0 else 0)
            if y + 1 >= h or not keep(x, y + 1, w, h): v = tone - 2
            c = R[max(0, min(5, v))]
            if trim and (y == 0 or not keep(x, y - 1, w, h)): c = S['trim'][3 if (x + y) % 3 else 4]
            px[x0 + x, y0 + y] = c + (255,)


def flat(name, S):
    part = {p: Image.new('RGBA', (64, 32)) for p in PIECES}; metal, trim, cloth = S['metal'], S['trim'], S['cloth']
    put = lambda p, f, x, y, c: p.__setitem__((f[0] + x, f[1] + y), tuple(c) + (255,))
    # helmet
    p = part['helmet'].load(); hd = faces(0, 0, 8, 8, 8)
    surface(S, p, hd['top'], tone=4, trim=False)
    if name == 'fenlight':                                   # a hood: open face, deep sides
        surface(S, p, hd['front'], lambda x, y, w, h: y < 2 or x in (0, 7))
        for k in ('right', 'left', 'back'): surface(S, p, hd[k], lambda x, y, w, h: y < 8)
    elif name == 'sunscale':                                 # open-faced cap with cheek scales
        surface(S, p, hd['front'], lambda x, y, w, h: y < 3 or (x in (0, 7) and y < 6))
        for k in ('right', 'left'): surface(S, p, hd[k], lambda x, y, w, h: y < 6)
        surface(S, p, hd['back'], lambda x, y, w, h: y < 5)
    else:                                                    # barbute: T-shaped opening
        surface(S, p, hd['front'], lambda x, y, w, h: y < 3 or x in (0, 1, 6, 7) or (x in (3, 4) and y < 5))
        for k in ('right', 'left', 'back'): surface(S, p, hd[k], lambda x, y, w, h: y < 7)
    f = hd['front']
    if name == 'tidewrought':
        for x in (1, 3, 4, 6): put(p, f, x, 1, PEARL[4])                                 # pearl studs along the brow
    if name == 'watchward':
        for x in range(8): put(p, f, x, 2, trim[3 if x % 2 else 2])                      # gold brow band
    # chestplate
    p = part['chestplate'].load(); bd = faces(16, 16, 8, 12, 4); ar = faces(40, 16, 4, 12, 4)
    for k in ('front', 'back'): surface(S, p, bd[k], lambda x, y, w, h: y < 10 and not (y == 9 and x in (0, 7)))
    for k in ('right', 'left'): surface(S, p, bd[k], lambda x, y, w, h: 1 <= y < 9, trim=False)
    surface(S, p, bd['top'], tone=4, trim=False)
    f = bd['front']
    if S['tabard']:                                          # cloth down the middle, front and back
        for k in ('front', 'back'):
            g = bd[k]
            for y in range(1, 10):
                for x in range(2, 6): put(p, g, x, y, cloth[3 + (1 if x == 2 else 0) - (1 if x == 5 or y == 9 else 0) - (1 if (x + y) % 4 == 0 else 0)])
        if name == 'watchward':                              # the beacon: a gold flame on green
            for (x, y, i) in ((3, 3, 4), (4, 3, 3), (3, 4, 5), (4, 4, 4), (3, 5, 3), (4, 5, 3), (3, 2, 5)): put(p, f, x, y, trim[i])
    if name == 'tidewrought':
        for (x, y) in ((1, 2), (6, 2), (2, 4), (5, 4), (3, 6), (4, 6)): put(p, f, x, y, PEARL[4])
        for y in range(2, 9): put(p, f, 3 if y % 2 else 4, y, metal[1])                 # a wave line down the breast
    if name == 'fenlight':
        for x in range(8): put(p, f, x, 7, S['cloth'][2 if x % 3 else 4])               # belt
        put(p, f, 2, 7, trim[4]); put(p, f, 5, 3, trim[3]); put(p, f, 2, 3, trim[3])    # bogsilver buckle and clasps
        for y in range(1, 7): put(p, f, 3, y, trim[2] if y % 2 else metal[1])           # laced front
    if name in ('watchward', 'sunscale'):
        for x in range(8): put(p, f, x, 8, DARKWOOD[2] if x not in (3, 4) else trim[4])
    surface(S, p, ar['top'], tone=5, trim=False)
    for k in ('front', 'back', 'right', 'left'):
        surface(S, p, ar[k], lambda x, y, w, h: y < 4)
        g = ar[k]; surface(S, p, (g[0], g[1] + 5, g[2], 7), tone=2, trim=name != 'fenlight')
    surface(S, p, ar['bottom'], tone=1, trim=False)
    # boots
    p = part['boots'].load(); lg = faces(0, 16, 4, 12, 4)
    for k in ('front', 'back', 'right', 'left'):
        g = lg[k]; surface(S, p, (g[0], g[1] + 7, g[2], 5))
    surface(S, p, lg['bottom'], tone=1, trim=False)
    # leggings
    p = part['leggings'].load(); bd = faces(16, 16, 8, 12, 4)
    for k in ('front', 'back', 'right', 'left'):
        g = bd[k]; surface(S, p, (g[0], g[1] + 7, g[2], 5), trim=False, ramp=cloth if S['tabard'] else None)
    lg = faces(0, 16, 4, 12, 4)
    for k in ('front', 'back', 'right', 'left'): surface(S, p, lg[k], lambda x, y, w, h: y < 9, trim=False)
    f = lg['front']
    for x in (1, 2): put(p, f, x, 4, trim[4]); put(p, f, x, 5, metal[5])
    return part


# ---- 3D parts. Each piece has its own sheet, so parts of different pieces may share a corner.
def cube(o, s, uv, kind=None, mir=False, inf=0):
    c = {"origin": o, "size": s, "uv": uv}
    if inf: c["inflate"] = inf
    if mir: c["mirror"] = True
    if kind: KIND[id(c)] = kind
    return c
KIND = {}
PIV = {"head": [0, 24, 0], "body": [0, 24, 0], "rightArm": [-5, 22, 0], "leftArm": [5, 22, 0], "rightLeg": [-1.9, 12, 0], "leftLeg": [1.9, 12, 0]}
def base():
    return {
        "helmet": {"head": [cube([-4, 24, -4], [8, 8, 8], [0, 0], inf=1)]},
        "chestplate": {"body": [cube([-4, 12, -2], [8, 12, 4], [16, 16], inf=1.01)],
                       "rightArm": [cube([-8, 12, -2], [4, 12, 4], [40, 16], inf=1)], "leftArm": [cube([4, 12, -2], [4, 12, 4], [40, 16], mir=True, inf=1)]},
        "leggings": {"body": [cube([-4, 12, -2], [8, 12, 4], [16, 16], inf=0.5)],
                     "rightLeg": [cube([-3.9, 0, -2], [4, 12, 4], [0, 16], inf=0.5)], "leftLeg": [cube([-0.1, 0, -2], [4, 12, 4], [0, 16], mir=True, inf=0.5)]},
        "boots": {"rightLeg": [cube([-3.9, 0, -2], [4, 12, 4], [0, 16], inf=1)], "leftLeg": [cube([-0.1, 0, -2], [4, 12, 4], [0, 16], mir=True, inf=1)]},
    }
def pauldrons(kind='metal'):
    return {"rightArm": [cube([-9.5, 22, -2.5], [5, 2, 5], [32, 9], kind)], "leftArm": [cube([4.5, 22, -2.5], [5, 2, 5], [32, 9], kind, True)]}
def knees(): return {"rightLeg": [cube([-3.4, 6, -3.6], [3, 3, 1], [32, 0], 'knee')], "leftLeg": [cube([0.4, 6, -3.6], [3, 3, 1], [32, 0], 'knee', True)]}
def cuffs(kind): return {"rightLeg": [cube([-4.9, 5, -3], [6, 1, 6], [32, 0], kind)], "leftLeg": [cube([-1.1, 5, -3], [6, 1, 6], [32, 0], kind, True)]}
def extras(name):
    if name == 'watchward':
        return {"helmet": {"head": [cube([-0.5, 33, -4], [1, 2, 7], [32, 0], 'comb'), cube([-0.5, 35, -2], [1, 2, 1], [50, 0], 'glow')]},     # gold comb, beacon flame
                "chestplate": {**pauldrons(), "body": [cube([-2.5, 9, -3.2], [5, 3, 1], [32, 0], 'cloth')]},                                  # surcoat hem below the belt
                "leggings": knees(), "boots": cuffs('metal')}
    if name == 'tidewrought':
        return {"helmet": {"head": [cube([-1.5, 33, -1.5], [3, 3, 3], [32, 0], 'lamp'), cube([-0.5, 36, -0.5], [1, 1, 1], [46, 0], 'trimbox')]},  # the lighthouse lamp
                "chestplate": pauldrons('shell'), "leggings": knees(),
                "boots": {"rightLeg": [cube([-2.4, 0.5, 3], [1, 3, 3], [32, 0], 'fin')], "leftLeg": [cube([1.4, 0.5, 3], [1, 3, 3], [32, 0], 'fin', True)]}}
    if name == 'sunscale':
        return {"helmet": {"head": [cube([-2.5, 31, -6], [5, 5, 1], [32, 0], 'disc'), cube([-3.5, 23, 5], [7, 5, 1], [32, 7], 'cloth')]},      # sun disc on the brow, neck veil
                "chestplate": {**pauldrons(), "body": [cube([-1.5, 18, -3.6], [3, 3, 1], [32, 0], 'disc')]},
                "leggings": knees(), "boots": cuffs('cloth')}
    if name == 'fenlight':
        return {"helmet": {"head": [cube([-1.5, 33, 0], [3, 1, 3], [32, 0], 'metal'), cube([5, 25, -1], [1, 3, 1], [46, 0], 'charm')]},        # hood peak, lantern at the ear
                "chestplate": {**pauldrons('leatherpad'), "body": [cube([2.5, 9, -3.2], [1, 3, 1], [32, 0], 'charm')]},                       # lantern on the belt
                "leggings": knees(), "boots": cuffs('leatherpad')}


def extra_px(S, kind, f, x, y, w, h):
    metal, trim, cloth, glow = S['metal'], S['trim'], S['cloth'], S['glow']; side = f not in ('top', 'bottom')
    def bev(R, mid=3):
        if f == 'top': return R[min(5, mid + 1)]
        if f == 'bottom': return R[max(0, mid - 2)]
        return R[min(5, mid + 1)] if (y == 0 or x == 0) else R[max(0, mid - 1)] if (x == w - 1 or y == h - 1) else R[mid]
    if kind == 'metal': return trim[3 if x % 2 else 4] if side and y == 0 and h > 1 else bev(metal)
    if kind == 'shell': return PEARL[4] if side and y == h - 1 and x % 2 == 0 else metal[4 if (f == 'top' and (x + y) % 2 == 0) else 3 if f != 'bottom' else 1]
    if kind == 'leatherpad': return trim[3] if side and (x, y) == (w // 2, 0) else bev(cloth, 3)
    if kind == 'knee': return (trim[5] if (x, y) == (1, 1) else trim[3] if y == 0 else metal[4]) if f == 'front' else metal[3 if f == 'top' else 2]
    if kind == 'comb': return bev(trim, 3)
    if kind == 'trimbox': return bev(trim, 4)
    if kind == 'glow': return glow[5 - min(4, y * 2)] if side else glow[5 if f == 'top' else 2]
    if kind == 'cloth': return cloth[3 + (1 if x == 0 else 0) - (1 if (x + y) % 4 == 0 else 0) - (1 if side and y == h - 1 else 0)] if f != 'bottom' else cloth[1]
    if kind == 'lamp':                                       # a framed lamp: dark corners and rails, light behind
        if not side: return metal[4 if f == 'top' else 1]
        return metal[2] if x in (0, w - 1) or y in (0, h - 1) else glow[4]
    if kind == 'charm': return (metal[1] if y == 0 else glow[4 if y == 1 else 3]) if side else (trim[3] if f == 'top' else glow[2])
    if kind == 'disc':
        if f in ('front', 'back'):
            cx, cy = (w - 1) / 2, (h - 1) / 2; d = (x - cx) ** 2 + (y - cy) ** 2; r = (w / 2) ** 2
            if d > r - 0.6 and w > 3 and (x in (0, w - 1) and y in (0, h - 1)): return glow[1]
            return glow[5] if d < 0.6 else glow[4 if x + y <= w - 1 else 3] if d < r * 0.5 else glow[2]
        return glow[2]
    if kind == 'glowhorn': return glow[4 if (f == 'top' or (side and y == 0)) else 3 if f != 'bottom' else 1]      # bone horns (the set's 'glow' ramp is bone)
    if kind == 'fin': return (trim[4] if y == 0 else metal[3 + (x % 2)]) if f in ('right', 'left') else metal[2]
    return metal[3]


def build_set(name, S, pieces=PIECES, E=None):
    part = flat(name, S); B = base(); E = E or extras(name); out = {}
    os.makedirs(T + 'models/siege_armor', exist_ok=True); os.makedirs(RP + 'models/entity/armor', exist_ok=True)
    for piece in pieces:
        im = part[piece].copy(); px = im.load(); painted = set()
        for cs in E[piece].values():
            for c in cs:
                w, h, d = c["size"]
                for f, (x0, y0, fw, fh) in faces(c["uv"][0], c["uv"][1], w, h, d).items():
                    for y in range(fh):
                        for x in range(fw):
                            at = (x0 + x, y0 + y)
                            assert at in painted or px[at][3] == 0, f'{name} {piece}: 3D part would paint over the armour layer at {at}'
                            px[at] = extra_px(S, KIND[id(c)], f, x, y, fw, fh) + (255,); painted.add(at)
        iid = f'{name}_{piece}'; im.save(T + f'models/siege_armor/codex_{iid}.png'); out[piece] = im
        bones = {k: list(v) for k, v in B[piece].items()}
        for b, cs in E[piece].items(): bones.setdefault(b, []).extend(cs)
        json.dump({"format_version": "1.12.0", "minecraft:geometry": [{"description": {"identifier": f"geometry.siege_codex_{iid}",
                   "texture_width": 64, "texture_height": 32, "visible_bounds_width": 3, "visible_bounds_height": 3, "visible_bounds_offset": [0, 1.5, 0]},
                   "bones": [{"name": n, "pivot": PIV[n], "cubes": cs} for n, cs in bones.items()]}]},
                  open(RP + f'models/entity/armor/codex_{iid}.geo.json', 'w'), indent=1)
    return out


# ---- icons
def armour_icon(name, S, piece):
    im = Image.open(T + f'items/siege_guard_{piece}.png').convert('RGBA'); px = im.load(); W, H = im.size
    src = {(x, y): px[x, y] for y in range(H) for x in range(W) if px[x, y][3]}
    for (x, y), (r, g, b, a) in src.items():
        h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
        edge = any(q not in src for q in ((x, y - 1), (x - 1, y), (x + 1, y), (x, y + 1)))
        i = max(0, min(5, int(l * 6.4)))
        if edge: c = S['metal'][0]
        elif s > 0.35 and 0.09 < h < 0.19: c = S['trim'][max(2, i)]
        elif s > 0.40 and (h < 0.05 or h > 0.93):                                       # the guard's red: plume and tabard
            c = (S['glow'][max(3, i + 1)] if piece == 'helmet' else S['cloth'][min(5, i + 2)] if S['tabard'] else S['metal'][max(1, i)])
        else:
            c = S['metal'][max(1, min(5, i))]
            if S['style'] == 'scale' and (x + y) % 2 == 0: c = S['metal'][max(1, min(5, i - 1))]
            if S['style'] == 'leather' and (x * 3 + y) % 5 == 0: c = S['metal'][max(1, i - 1)]
        px[x, y] = c + (255,)
    if name == 'tidewrought':
        for (x, y) in list(src):
            if (x * 7 + y * 3) % 17 == 0 and all(q in src for q in ((x, y - 1), (x - 1, y), (x + 1, y), (x, y + 1))): px[x, y] = PEARL[4] + (255,)
    if name == 'fenlight' and piece == 'chestplate':
        for (x, y) in ((10, 10), (10, 11)):
            if (x, y) in src: px[x, y] = S['glow'][4 if y == 10 else 3] + (255,)
    os.makedirs(T + 'items/codex', exist_ok=True); im.save(T + f'items/codex/{name}_{piece}.png'); return im


def grid(iid, rows, legend, outline):
    """A 16x16 icon from a character grid. Legend: char -> colour. '.' is empty; a dark outline is added round the shape."""
    t = Tex()
    for y, row in enumerate(rows):
        for x, ch in enumerate(row.ljust(16, '.')):
            if ch != '.': t.set(x, y, legend[ch])
    outline_alpha(t, outline)
    os.makedirs(T + 'items/codex', exist_ok=True); t.save(T + f'items/codex/{iid}.png'); return t.im


def legend(S, wood=WOOD):
    m, t, c, g = S['metal'], S['trim'], S['cloth'], S['glow']
    return {'M': m[5], 'm': m[4], 'n': m[3], 'd': m[2], 'D': m[1], 'T': t[5], 't': t[4], 'u': t[2], 'W': wood[4], 'w': wood[3], 'v': wood[1],
            'C': c[4], 'c': c[3], 'k': c[1], 'G': g[5], 'g': g[4], 'h': g[2], 's': (236, 232, 220), 'S': (190, 186, 172)}


def weapons():
    out = []; W, Ti, Su, Fe = (SETS[k] for k in ('watchward', 'tidewrought', 'sunscale', 'fenlight'))
    out.append(grid('watchmans_glaive', [            # a long pole with a broad curved blade and a green tassel
        '..........Mm....', '.........Mmn....', '........Mmnn....', '........mnnd....', '.......tmnd.....', '......Ctud......', '......cw........',
        '.....kWw........', '.....Ww.........', '....Ww..........', '...Ww...........', '..Ww............', '.Ww.............', '.w..............'], legend(W), W['metal'][0]))
    out.append(grid('watch_crossbow', [              # seen from above the stock: steel prod, gold nut, string
        '................', '...........mMn..', '.........mMnd.s.', '.......mMnd..s..', '......Mnd...s...', '.....mnWw..s....', '....mdwWws......',
        '...md..wtWw.....', '..Md..s.wWWw....', '..n..s...wWWw...', '.....s....wWv...', '....s......vv...', '................'], legend(W, DARKWOOD), W['metal'][0]))
    out.append(grid('lighthouse_harpoon', [          # barbed head, pearl at the socket, a coil of line
        '.............MM.', '...........dMmM.', '..........d.mn..', '..........Mmn...', '.........tnd.d..', '........Wt......', '.......Ww.......',
        '......Ww........', '..S..Ww.........', '.S.sWw..........', '.S.Ww...........', '..sw............', '.Ww.............', '.w..............'], legend(Ti), Ti['metal'][0]))
    out.append(grid('tidesteel_cutlass', [           # short curved blade, a shell guard
        '............Mm..', '...........Mmn..', '..........Mmnn..', '.........Mmnn...', '........Mmnd....', '.......Mmnd.....', '......Mmnd......',
        '....T.mnd.......', '....tTnd........', '...tutT.........', '..wvt.t.........', '.wv.............', '.T..............'], legend(Ti, DARKWOOD), Ti['metal'][0]))
    out.append(grid('sunbrand_sabre', [              # long slim curve, sun-disc pommel, a bright edge
        '.............gM.', '............gMm.', '...........gMm..', '..........gMm...', '.........gMn....', '........gMn.....', '.......gMn......',
        '......gmn.......', '....t.mn........', '....Ttn.........', '...ktT..........', '..kc.t..........', '.GG.............', '.Gg.............'], legend(Su), Su['metal'][0]))
    out.append(grid('sunscale_bow', [                # recurved bronze-scaled limbs, sun disc at the grip
        '......nmMs......', '....nmM..s......', '...nM....s......', '..nm.....s......', '..m......s......', '.nm......s......', '.GG......s......',
        '.Gg......s......', '.nm......s......', '..m......s......', '..nm.....s......', '...nM....s......', '....nmM..s......', '......nmMs......'], legend(Su), Su['metal'][0]))
    out.append(grid('wisp_bow', [                    # dark bog wood, bogsilver tips, a wisp caught at the grip
        '......tWws......', '....vWw..s......', '...vW....s......', '..vW.....s......', '..W......s......', '.vW......s......', '.kG.g....s......',
        '.kg......s......', '.vW..g...s......', '..W......s......', '..vW.....s......', '...vW....s......', '....vWw..s......', '......tWws......'], legend(Fe, DARKWOOD), Fe['metal'][0]))
    out.append(grid('bogsilver_sickle', [            # a pale hooked blade on a short dark haft, a lantern charm tied on
        '.....tTTt.......', '....tT..utt.....', '...tT.....ut....', '...T.......ut...', '...........ut...', '..........utt...', '.........ut.....',
        '........Wu......', '.......Ww.......', '......Ww.k......', '.....Ww..g......', '....Wv...h......', '...vv...........'], legend(Fe, DARKWOOD), Fe['metal'][0]))
    return out


def ingot(iid, body, frost):
    shape = ['......#########.', '.....##########.', '....###########.', '...############.', '..#############.', '..############..', '..###########...', '..##########....', '..##########....']
    t = Tex(); P = {(x, y + 4) for y, r in enumerate(shape) for x, ch in enumerate(r) if ch == '#'}
    for (x, y) in P:
        top = y < 9 and (x + y) >= 10
        if (x + 1, y) not in P or (x, y + 1) not in P: c = body[0]
        elif top: c = frost[4] if ((x, y - 1) not in P or (x - 1, y) not in P) else (frost[3] if (x * 3 + y) % 5 == 0 else body[5])
        else: c = body[2 if y > 10 else 3]
        t.set(x, y, c)
    t.set(8, 5, frost[5])
    os.makedirs(T + 'items/codex', exist_ok=True); t.save(T + f'items/codex/{iid}.png'); return t.im


def main():
    sheets, icons = {}, []
    for name, S in SETS.items():
        sheets[name] = build_set(name, S); icons += [armour_icon(name, S, p) for p in PIECES]
    icons += weapons()
    icons += [ingot('watchsteel', SETS['watchward']['metal'], GOLD), ingot('tidesteel', SETS['tidewrought']['metal'], PEARL),
              ingot('sunsteel', SETS['sunscale']['metal'], SETS['sunscale']['glow']), ingot('bogsilver', SETS['fenlight']['trim'], SETS['fenlight']['glow'])]
    sh = Image.new('RGBA', (14 * 72 + 8, 2 * 72 + 16 + 4 * 72), (38, 34, 46, 255))
    for i, im in enumerate(icons): sh.alpha_composite(im.resize((64, 64), Image.NEAREST), (8 + (i % 14) * 72, 8 + (i // 14) * 72))
    for r, name in enumerate(SETS):
        for k, p in enumerate(PIECES): sh.alpha_composite(sheets[name][p].resize((128, 64), Image.NEAREST), (8 + k * 136, 2 * 72 + 16 + r * 72))
    os.makedirs(ROOT + 'art', exist_ok=True); sh.save(ROOT + 'art/codex-regional-gear.png'); print('codex art:', len(icons), 'icons,', len(SETS) * 4, 'worn pieces')


if __name__ == '__main__':
    main()
