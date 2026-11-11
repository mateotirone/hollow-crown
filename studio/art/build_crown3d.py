"""The Hollow Crown, rebuilt (Mateo 2026-11-11: "We got to texture the hollow crown much, much, much better").

Follows the reference (art/reference/hollow-crown-reference.png) closely:
- a band of dark violet cracked stone around the head, with a lower lip, glowing magenta veins running up it like roots,
  and pale blue diamond gems set into it (a big one under the centre arch);
- a tall pointed centre arch at the front, open in the middle, with a violet amethyst shard set in its tip and a small
  pale blue crystal floating in the opening;
- two smaller open arches either side at the front, open arches on each side, and jagged leaning spikes all round.

Every face gets its own patch of a hand-built stone sheet, so no two parts look the same, and the parts that face the
light (tops of the arches, the upper band) use a brighter cut of the stone.

    python3 studio/art/build_crown3d.py [repo root]

Writes models/entity/hollow_crown.geo.json (64x64 texture) and textures/models/armor/siege_hollow_crown.png, plus
art/hollow-crown-sheet.png. Replaces the worn part of build_crown_art.py (its icon stays).
"""
import json, math, os, random, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from palette import fixed

ROOT = (sys.argv[1].rstrip('/') + '/') if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) + '/'
RP = ROOT + 'Siege_Nights_RP/'
STONE = fixed('#120a1a', '#241532', '#38214a', '#4e2e64', '#68407e', '#86589c', '#a678b8')
AMETH = fixed('#2a1250', '#4a1e88', '#7234c4', '#a05cf0', '#c896ff', '#ecd8ff')
ICE = fixed('#2c5c84', '#5a94c0', '#8cc4e6', '#b8e2f8', '#dcf4ff', '#ffffff')
VEIN = [(120, 26, 96), (190, 50, 150), (240, 92, 200), (255, 160, 232)]
RIM = (10, 6, 14)
r = random.Random(17)

# ---------------- texture: 64 x 64 ----------------
# x0-47 y0-47: cracked stone with veins (faces cut patches out of it); x48-63 y0-15 amethyst; y16-31 ice gem;
# x48-63 y32-47 bright stone (lit tops); x0-63 y48-63 band strip (long, veins rising from the bottom edge).
W = H = 64
img = [[(0, 0, 0, 0)] * W for _ in range(H)]
def put(x, y, c): img[y][x] = tuple(c[:3]) + (255,)
def lerp(a, b, t): return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))
def tone(v, ramp=STONE):
    v = max(0.0, min(len(ramp) - 1.0, round(v * 2) / 2)); a = int(v); b = min(a + 1, len(ramp) - 1)
    return lerp(ramp[a], ramp[b], v - a)

def vnoise(w, h, cell, seed):
    rr = random.Random(seed); nx, ny = w // cell + 2, h // cell + 2
    g = [[rr.uniform(-1, 1) for _ in range(nx)] for _ in range(ny)]
    def f(x, y):
        fx, fy = x / cell, y / cell; x0, y0 = int(fx), int(fy); tx, ty = fx - x0, fy - y0
        tx, ty = tx * tx * (3 - 2 * tx), ty * ty * (3 - 2 * ty)
        a = g[y0][x0] + (g[y0][x0 + 1] - g[y0][x0]) * tx; b = g[y0 + 1][x0] + (g[y0 + 1][x0 + 1] - g[y0 + 1][x0]) * tx
        return a + (b - a) * ty
    return f

def stone_area(x0, y0, w, h, base, seed):
    big, mid = vnoise(w, h, 8, seed), vnoise(w, h, 3, seed + 1)
    v = [[base + big(x, y) * 0.7 + mid(x, y) * 0.35 + r.choice((0, 0, 0, 0.5, -0.5)) for x in range(w)] for y in range(h)]
    # cracks: wandering dark lines with a lit lip above
    for _ in range(w * h // 90):
        x, y = r.randrange(w), r.randrange(h); dx = r.choice((-1, 1))
        for _ in range(r.randint(3, 7)):
            if 0 <= x < w and 0 <= y < h:
                v[y][x] = 0.3
                if y > 0: v[y - 1][x] += 0.8
            x += dx if r.random() < 0.6 else 0; y += 1 if r.random() < 0.7 else 0
    for y in range(h):
        for x in range(w): put(x0 + x, y0 + y, tone(v[y][x]))
    return v

def veins(x0, y0, w, h, n, seed, up=True):
    """Glowing roots: start at the bottom edge, climb and fork, bright core with a dim glow beside it."""
    rr = random.Random(seed)
    for _ in range(n):
        tips = [(rr.randrange(w), h - 1, rr.choice((-1, 1)))]
        steps = 0
        while tips and steps < 60:
            steps += 1; nt = []
            for x, y, d in tips:
                if not (0 <= x < w and 0 <= y < h): continue
                core = VEIN[2] if rr.random() < 0.8 else VEIN[3]
                put(x0 + x, y0 + y, core)
                for gx in (x - 1, x + 1):
                    if 0 <= gx < w:
                        c = img[y0 + y][x0 + gx]
                        if c[:3] not in [tuple(v) for v in VEIN]: put(x0 + gx, y0 + y, lerp(c, VEIN[0], 0.45))
                ny, nx = y - 1, x + (d if rr.random() < 0.45 else 0)
                if rr.random() < 0.06 + 0.02 * (h - y) / h: nt.append((nx, ny, -d))      # fork
                if rr.random() < 0.97: nt.append((nx, ny, d))
            tips = nt[:3]

stone_area(0, 0, 48, 48, 2.6, 3); veins(0, 0, 48, 48, 4, 5)
stone_area(48, 32, 16, 16, 4.0, 9); veins(48, 32, 16, 16, 2, 11)
stone_area(0, 48, 64, 16, 2.8, 13); veins(0, 48, 64, 16, 7, 15)
for x in range(64): put(x, 48, tone(4.5)); put(x, 63, RIM)                                     # band: lit top, dark foot
def crystal_area(x0, y0, ramp):
    for y in range(16):
        for x in range(16):
            # faceted: two lit facets on the left, dark on the right, a bright glint, rim at the edges
            v = 3.6 - x * 0.18 + (0.8 if (x + y) % 7 == 0 else 0) - (0.6 if y > 12 else 0)
            if x + y < 5: v = 5
            put(x0 + x, y0 + y, tone(v, ramp))
crystal_area(48, 0, AMETH); crystal_area(48, 16, ICE)
put(49, 1, AMETH[5]); put(49, 17, ICE[5]); put(50, 17, ICE[5])

# ---------------- geometry ----------------
def patch(w, h, region):
    """A face's UV rect inside a region, at a random offset so faces differ."""
    x0, y0, rw, rh = region
    w, h = max(1, round(w)), max(1, round(h))
    return [x0 + r.randrange(max(1, rw - w + 1)), y0 + r.randrange(max(1, rh - h + 1))], [w, h]
STONE_R, LIT_R, BAND_R, AM_R, ICE_R = (0, 0, 48, 48), (48, 32, 16, 16), (0, 48, 64, 16), (48, 0, 16, 16), (48, 16, 16, 16)
def faces(s, region, top=None):
    w, h, d = s
    out = {}
    for f, (fw, fh) in {"north": (w, h), "south": (w, h), "east": (d, h), "west": (d, h), "up": (w, d), "down": (w, d)}.items():
        reg = top if (top and f == "up") else region
        uv, sz = patch(fw, fh, reg)
        out[f] = {"uv": uv, "uv_size": sz}
    return out
cubes = []
def cube(o, s, region=STONE_R, top=LIT_R, rot=None, pivot=None, inflate=0):
    c = {"origin": o, "size": s, "uv": faces(s, region, top)}
    if rot: c["rotation"] = rot; c["pivot"] = pivot or [o[0] + s[0] / 2, o[1], o[2] + s[2] / 2]
    if inflate: c["inflate"] = inflate
    cubes.append(c)

Y = 29.5        # the band sits around the top of the head
# band: four walls, 3 high, 1 thick, around a 10 x 10 ring, plus a lower lip
cube([-5, Y, -5.5], [10, 3, 1], BAND_R); cube([-5, Y, 4.5], [10, 3, 1], BAND_R)
cube([-5.5, Y, -5.5], [1, 3, 11], BAND_R); cube([4.5, Y, -5.5], [1, 3, 11], BAND_R)
cube([-5.25, Y - 0.5, -5.75], [10.5, 1, 0.25], BAND_R); cube([-5.25, Y - 0.5, 5.5], [10.5, 1, 0.25], BAND_R)
cube([-5.75, Y - 0.5, -5.75], [0.25, 1, 11.5], BAND_R); cube([5.5, Y - 0.5, -5.75], [0.25, 1, 11.5], BAND_R)

SGN = {'x': 1, 'z': -1}     # which way a positive rotation leans a part, per wall direction (checked in the Studio)
def wall(axis, wpos, u0, y0, wu, h, depth=1, ang=0, pu=None, py=None, region=STONE_R, top=LIT_R):
    """A part on a wall. axis 'x' = front/back wall (z = wpos), 'z' = side wall (x = wpos); u runs along the wall."""
    rot = None
    if ang:
        pu = u0 + wu / 2 if pu is None else pu; py = y0 if py is None else py
        rot = ([0, 0, ang * SGN['x']], [pu, py, wpos + depth / 2]) if axis == 'x' else ([ang * SGN['z'], 0, 0], [wpos + depth / 2, py, pu])
    if axis == 'x': cube([u0, y0, wpos], [wu, h, depth], region, top, *(rot or (None, None)))
    else: cube([wpos, y0, u0], [depth, h, wu], region, top, *(rot or (None, None)))

def arch(axis, wpos, cu, half, hp, rise, tip, depth=1):
    """Open pointed arch on the band: two posts, two slanted arms that meet in a point, and a spike on top."""
    top = Y + 3
    L = math.hypot(half, rise); th = math.degrees(math.atan2(half, rise))
    for sgn in (-1, 1):
        u = cu + sgn * half
        wall(axis, wpos, u - 0.5, top, 1, hp + 0.5, depth)                                       # post
        wall(axis, wpos, u - 0.5, top + hp, 1, L + 0.4, depth, -sgn * th, u, top + hp)          # arm leaning in
    apex = top + hp + rise
    wall(axis, wpos, cu - 0.5, apex - 0.3, 1, tip, depth)                                          # spike
    return apex

# the great centre arch, front
apex = arch('x', -5.5, 0, 2, 3, 3, 3)
cube([-0.5, apex - 2.6, -5.9], [1, 3, 0.5], AM_R, AM_R)                                    # amethyst set in the tip
cube([-0.5, Y + 4.5, -5.0], [1, 1.5, 0.5], ICE_R, ICE_R, [0, 0, 45], [0, Y + 5.25, -4.75])   # the floating crystal
# smaller arches either side of it, on the side walls and at the back
for cu in (-3.75, 3.75): arch('x', -5.5, cu, 0.75, 1, 2, 2)
for wp in (-5.5, 4.5): arch('z', wp, 0, 1.5, 2, 2.5, 2)
for cu in (-2.5, 2.5): arch('x', 4.5, cu, 1, 1, 2, 1)
# jagged corner spikes, leaning out over the corners
for sx, sz in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
    x, z = (4.5 if sx > 0 else -5.5), (4.5 if sz > 0 else -5.5)
    cube([x, Y + 3, z], [1, 4, 1], STONE_R, LIT_R, [-15 * sz, 0, 15 * sx], [x + 0.5, Y + 3, z + 0.5])
# gems in the band
cube([-0.75, Y + 0.75, -5.85], [1.5, 1.5, 0.5], ICE_R, ICE_R, [0, 0, 45], [0, Y + 1.5, -5.6])
for gx in (-3.5, 3.5): cube([gx - 0.5, Y + 1, -5.75], [1, 1, 0.5], ICE_R, ICE_R, [0, 0, 45], [gx, Y + 1.5, -5.5])
for gz in (-3, 3):
    cube([-5.85, Y + 1, gz - 0.5], [0.5, 1, 1], ICE_R, ICE_R, [45, 0, 0], [-5.6, Y + 1.5, gz])
    cube([5.35, Y + 1, gz - 0.5], [0.5, 1, 1], ICE_R, ICE_R, [45, 0, 0], [5.6, Y + 1.5, gz])
cube([-0.5, Y + 1, 5.35], [1, 1, 0.5], ICE_R, ICE_R, [0, 0, 45], [0, Y + 1.5, 5.6])

geo = {"format_version": "1.12.0", "minecraft:geometry": [{"description": {"identifier": "geometry.siege_hollow_crown",
       "texture_width": 64, "texture_height": 64, "visible_bounds_width": 3, "visible_bounds_height": 3.5,
       "visible_bounds_offset": [0, 1.75, 0]}, "bones": [{"name": "head", "pivot": [0, 24, 0], "cubes": cubes}]}]}
with open(RP + 'models/entity/hollow_crown.geo.json', 'w') as f: json.dump(geo, f, indent=1); f.write('\n')
im = Image.new('RGBA', (W, H)); px = im.load()
for y in range(H):
    for x in range(W): px[x, y] = img[y][x]
im.save(RP + 'textures/models/armor/siege_hollow_crown.png')
im.resize((512, 512), Image.NEAREST).save(ROOT + 'art/hollow-crown-sheet.png')
print(len(cubes), 'cubes')
