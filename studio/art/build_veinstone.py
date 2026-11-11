"""Veinstone, repainted with depth (Mateo 2026-11-11: "It can be textured much better. It's really flat.").

The Hollow's ground stone, after the concept art (art/reference/undertow-concept.png): dark violet columnar basalt,
cracked into blocks. Every block is lit from the top left (bright top edge and left edge, shadowed right and bottom
edges), the joints between blocks are deep and dark, the faces are rough (chips, pits, fine grain), with a little
dull rust like the concept's cliffs. Three of the four variants carry a thin glowing violet vein that sits in a
recessed crack: dark rim below, a soft glow either side, a bright core and one or two bright nodes.

    python3 studio/art/build_veinstone.py [repo root]

Writes textures/blocks/siege_veinstone.png and siege_veinstone_1..3.png (the game mixes them at random, weights in
terrain_texture.json) and art/veinstone.png (before/after sheet, tiled 3x3). Replaces the Veinstone part of
build_hollow_blocks.py, which no longer needs re-running for it.
"""
import math, os, random, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from palette import REGIONS

ROOT = (sys.argv[1].rstrip('/') + '/') if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) + '/'
BL = ROOT + 'Siege_Nights_RP/textures/blocks/'
ST = REGIONS['undertow']['stone']                    # 6 tones, darkest first
RUST = [(58, 38, 40), (84, 54, 50), (110, 74, 62)]
VIOLET = [(42, 18, 80), (74, 30, 136), (114, 52, 196), (160, 92, 240), (200, 150, 255), (236, 216, 255)]


def tone(v):
    """Stone colour for a value 0..5, in half steps so the face reads smooth but stays pixel art."""
    v = max(0.0, min(5.0, round(v * 2) / 2))
    a, b = int(math.floor(v)), int(math.ceil(v))
    t = v - a
    return tuple(round(ST[a][i] + (ST[b][i] - ST[a][i]) * t) for i in range(3))


def mix(c, d, t): return tuple(round(c[i] + (d[i] - c[i]) * t) for i in range(3))


def noise(seed, cell=4):
    """Tileable value noise on a 16x16 torus, returns 16x16 floats in -1..1."""
    r = random.Random(seed); n = 16 // cell
    g = [[r.uniform(-1, 1) for _ in range(n)] for _ in range(n)]
    out = [[0.0] * 16 for _ in range(16)]
    for y in range(16):
        for x in range(16):
            fx, fy = x / cell, y / cell
            x0, y0 = int(fx) % n, int(fy) % n; x1, y1 = (x0 + 1) % n, (y0 + 1) % n
            tx, ty = fx - int(fx), fy - int(fy)
            tx, ty = tx * tx * (3 - 2 * tx), ty * ty * (3 - 2 * ty)
            a = g[y0][x0] + (g[y0][x1] - g[y0][x0]) * tx
            b = g[y1][x0] + (g[y1][x1] - g[y1][x0]) * tx
            out[y][x] = a + (b - a) * ty
    return out


def stone(seed):
    r = random.Random(seed)
    # columns of varying width, each split into blocks at its own joints (wraps top to bottom so it tiles)
    widths = []
    while sum(widths) < 16:
        widths.append(r.choice((3, 4, 4, 5)))
    widths[-1] -= sum(widths) - 16
    if widths[-1] < 2: widths[-2] += widths.pop()
    v = [[0.0] * 16 for _ in range(16)]
    kind = [[0] * 16 for _ in range(16)]           # 0 face, 1 joint
    big, fine = noise(seed * 7 + 1, 8), noise(seed * 7 + 2, 4)
    x0 = r.randrange(16)                            # columns start anywhere, so variants do not line up
    for w in widths:
        base = r.uniform(1.5, 2.1)
        cuts = sorted(r.sample(range(16), r.choice((2, 2, 3))))
        for k, c in enumerate(cuts):
            top, bot = c + 1, cuts[(k + 1) % len(cuts)] + (16 if k + 1 == len(cuts) else 0)
            bt = base + r.uniform(-0.35, 0.35)
            tilt = r.choice((-1, 0, 0, 1))          # joints are not dead level
            for dx in range(w):
                x = (x0 + dx) % 16
                for yy in range(c, bot + 1):
                    y = yy % 16
                    jy = c + (tilt if dx >= w // 2 else 0)
                    if yy == jy or (dx == w - 1):   # joint row, and the gap down the column's right side
                        if yy == jy: v[y][x] = 0.4; kind[y][x] = 1; continue
                    if dx == w - 1 and kind[y][x] == 0:
                        v[y][x] = 0.9; kind[y][x] = 1; continue
                    if yy < jy: continue
                    d = yy - jy                     # rows below this block's top joint
                    val = bt
                    if d == 1: val += 1.1           # lit top edge
                    elif d == 2: val += 0.5
                    if dx == 0: val += 0.6          # lit left edge
                    if dx == w - 2: val -= 0.5      # turning away from the light
                    if yy == bot - 1: val -= 0.7    # shadowed foot of the block
                    v[y][x] = val; kind[y][x] = 0
        x0 += w
    # rough faces: broad unevenness, fine grain, chips (pit with a lit lip above), specks
    for y in range(16):
        for x in range(16):
            if kind[y][x] == 0:
                v[y][x] += big[y][x] * 0.45 + fine[y][x] * 0.3 + r.choice((0, 0, 0, 0.5, -0.5))
    for _ in range(r.randint(4, 6)):
        x, y = r.randrange(16), r.randrange(16)
        if kind[y][x] or kind[(y - 1) % 16][x]: continue
        v[y][x] = 0.9; v[(y - 1) % 16][x] += 0.9
        if r.random() < 0.5 and not kind[y][(x + 1) % 16]: v[y][(x + 1) % 16] = 1.3
    # every variant gets the same average brightness, so the mixed ground does not look patchy
    faces = [v[y][x] for y in range(16) for x in range(16) if kind[y][x] == 0]
    shift = 1.95 - sum(faces) / len(faces)
    for y in range(16):
        for x in range(16):
            if kind[y][x] == 0: v[y][x] += shift
    img = [[tone(v[y][x]) for x in range(16)] for y in range(16)]
    # a little dull rust on a couple of faces, like the concept's cliffs
    for _ in range(r.randint(1, 2)):
        cx, cy = r.randrange(16), r.randrange(16)
        for dy in range(-1, 2):
            for dx in range(-1, 2):
                x, y = (cx + dx) % 16, (cy + dy) % 16
                if kind[y][x] == 0 and r.random() < 0.55:
                    img[y][x] = mix(img[y][x], RUST[1 if v[y][x] > 2.6 else 0], 0.55)
    return img, kind, v


def vein(img, path, nodes, glow=0.35):
    """Glowing vein in a recessed crack: dark rim below, soft glow each side, bright core."""
    pts = []
    for a, b in zip(path, path[1:]):
        n = max(abs(b[0] - a[0]), abs(b[1] - a[1]))
        for i in range(n + 1):
            p = (round(a[0] + (b[0] - a[0]) * i / n) % 16, round(a[1] + (b[1] - a[1]) * i / n) % 16)
            if p not in pts: pts.append(p)
    core = set(pts)
    for x, y in pts:
        below = (x, (y + 1) % 16)
        if below not in core: img[below[1]][below[0]] = mix(img[below[1]][below[0]], (12, 6, 18), 0.6)
        for dx, dy in ((-1, 0), (1, 0), (0, -1)):
            q = ((x + dx) % 16, (y + dy) % 16)
            if q not in core: img[q[1]][q[0]] = mix(img[q[1]][q[0]], VIOLET[2], glow)
    for i, (x, y) in enumerate(pts):
        img[y][x] = VIOLET[3] if i % 3 else VIOLET[2]
    for x, y in nodes: img[y][x] = VIOLET[5]; img[(y - 1) % 16][x] = mix(img[(y - 1) % 16][x], VIOLET[4], 0.6)


def to_image(img):
    im = Image.new('RGBA', (16, 16)); px = im.load()
    for y in range(16):
        for x in range(16): px[x, y] = img[y][x] + (255,)
    return im


VARIANTS = [
    ('veinstone', 11, None),
    ('veinstone_1', 23, ([(2, 8), (4, 9), (5, 11), (7, 12), (9, 12)], [(5, 11)])),
    ('veinstone_2', 37, ([(11, 1), (10, 3), (11, 5), (13, 6)], [(10, 3)])),
    ('veinstone_3', 41, ([(4, 6), (6, 7), (9, 7), (11, 9), (12, 11)], [(9, 7), (12, 11)])),
]

old = {n: Image.open(BL + f'siege_{n}.png').convert('RGBA') for n, _, _ in VARIANTS if os.path.exists(BL + f'siege_{n}.png')}
new = {}
for name, seed, vn in VARIANTS:
    img, kind, v = stone(seed)
    if vn: vein(img, *vn)
    new[name] = to_image(img)
    new[name].save(BL + f'siege_{name}.png')

# before / after sheet: each texture tiled 3x3 at 6x
S = 6
sheet = Image.new('RGBA', (len(VARIANTS) * (48 * S + 12) + 12, 2 * (48 * S + 12) + 12), (30, 26, 36, 255))
for row, src in enumerate((old, new)):
    for i, (name, _, _) in enumerate(VARIANTS):
        if name not in src: continue
        tile = Image.new('RGBA', (48, 48))
        for ty in range(3):
            for tx in range(3): tile.paste(src[name], (tx * 16, ty * 16))
        sheet.paste(tile.resize((48 * S, 48 * S), Image.NEAREST), (12 + i * (48 * S + 12), 12 + row * (48 * S + 12)))
os.makedirs(ROOT + 'art', exist_ok=True)
sheet.save(ROOT + 'art/veinstone.png')
print('ok')
