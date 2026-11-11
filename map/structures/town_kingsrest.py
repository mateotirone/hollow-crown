"""Kingsrest town plan: places the building designs along the real roads of the generated map.

    python3 town_kingsrest.py SLICE.npz LINES.json OUT_DIR [--render --textures DIR --three DIR]

SLICE.npz comes from terrain_slice.py (the same ground genworld.py writes); LINES.json is
draw_map.py's lines.json. Writes:
  OUT_DIR/kingsrest-plan.json   one entry per building: stamp, world x/z of the stamp origin,
                                ground y, rotation (clockwise from above; 0 = front faces south)
  OUT_DIR/kingsrest-plan.png    top-down plan
  OUT_DIR/scene.json            preview scene (terrain + buildings) for render/render.py

Rules: every building fronts a street (roads from the map, plus a high street from the square
to the bridge), keeps clear of water, roads, the square and its neighbours, and stands on
ground that varies by at most 3 blocks (the stamp levels its footprint to the ground y).
"""
import os, sys, json, math, argparse, random, subprocess
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from bp import Blueprint
from kit import h3, VALE
import vale, dressing, vale_civic

ap = argparse.ArgumentParser(); ap.add_argument("slice"); ap.add_argument("lines"); ap.add_argument("out")
ap.add_argument("--render", action="store_true"); ap.add_argument("--textures", default=""); ap.add_argument("--three", default="")
ap.add_argument("--seed", type=int, default=7)
a = ap.parse_args(); os.makedirs(a.out, exist_ok=True)
T = np.load(a.slice); Y = T["Y"]; WATER = T["water"] > Y; ROAD = T["road"] | T["trail"]; X0, Z0 = int(T["X0"]), int(T["Z0"])
L = json.load(open(a.lines))
WARD_C, WARD_R = (-150, -150), 90          # plots/config.js WARDS
SQUARE, SQUARE_R = (-118, -118), 9          # the stone square genworld writes
BRIDGE = [(-150, -168), (-150, -140)]       # north-south crossing at the confluence, where all five lines meet
rng = random.Random(a.seed)

def inmap(x, z): return 0 <= x - X0 < Y.shape[0] and 0 <= z - Z0 < Y.shape[1]
def gy(x, z): return int(Y[x - X0, z - Z0])
def wet(x, z): return bool(WATER[x - X0, z - Z0])
def road(x, z): return bool(ROAD[x - X0, z - Z0])

# ---- designs (front faces south in the blueprint)
STYLE_W = [("tudor", 70), ("brick", 20), ("stone", 10)]
def pick_style():
    r = rng.random() * 100
    for s, w in STYLE_W:
        r -= w
        if r < 0: return s
    return "tudor"
SHAPES = [(5, 9, 3), (7, 9, 2), (7, 11, 2), (9, 9, 2), (7, 7, 2), (5, 7, 2), (9, 11, 2), (7, 9, 3)]   # width, depth, storeys (all odd sizes)
_seed = [100]
def house_options():
    """A fresh house for this plot: its own seed, shape, ground floor, jetty, roof and chimney side."""
    order = SHAPES[:]; rng.shuffle(order)
    for w, d, st in order:
        _seed[0] += 1; sd = _seed[0]
        ground = "stone" if rng.random() < 0.7 else "timber"
        kw = dict(width=w, depth=d, storeys=st, ground=ground, jetty=ground == "stone" and rng.random() < 0.8,
                  roof="slate" if rng.random() < 0.75 else "wood", chimney_side=rng.choice("ew"))
        yield f"vale_house_{sd}", (lambda s_, sd=sd, kw=kw: vale.townhouse(sd, style=s_, **kw))
CACHE = {}
def design(key, make, style):
    if (key, style) not in CACHE: CACHE[(key, style)] = make(style)
    return CACHE[(key, style)]

ROT = {0: (0, 1), 90: (-1, 0), 180: (0, -1), 270: (1, 0)}   # where the front (south) points after turning
def rot_xz(x, z, deg):
    for _ in range((deg // 90) % 4): x, z = -z, x
    return x, z
def snap_rot(fx, fz):
    return max(ROT, key=lambda r: ROT[r][0] * fx + ROT[r][1] * fz)

taken = np.zeros(Y.shape, bool)      # footprints (+ a 1-block gap)
plan = []
def footprint(bp, deg):
    """Ground-level cells the building covers (y >= 0), rotated."""
    cells = {(x, z) for (x, y, z), c in bp.cells.items() if y >= 0 and c[0] not in ("keep",)}
    return {rot_xz(x, z, deg) for x, z in cells}

def try_place(key, bp, deg, front_pt, style, kind="house", gap=1, steep=3, extra=None):
    lo, hi = bp.bounds()
    fx, fz = rot_xz((lo[0] + hi[0]) // 2, hi[2], deg)      # front-centre of the blueprint, turned
    ox, oz = int(round(front_pt[0] - fx)), int(round(front_pt[1] - fz))
    fp = [(x + ox, z + oz) for x, z in footprint(bp, deg)]
    if extra is not None: fp += [(x + ox, z + oz) for x, z in footprint(extra, deg)]
    hs = []
    for x, z in fp:
        if not inmap(x, z): return None
        if (x - WARD_C[0]) ** 2 + (z - WARD_C[1]) ** 2 > (WARD_R - 4) ** 2: return None
        if (x - SQUARE[0]) ** 2 + (z - SQUARE[1]) ** 2 <= (SQUARE_R + 2) ** 2: return None
        if taken[x - X0, z - Z0]: return None
        hs.append(gy(x, z))
    for x, z in fp:
        for dx in (-1, 0, 1):
            for dz in (-1, 0, 1):
                if wet(x + dx, z + dz) or road(x + dx, z + dz): return None
    if max(hs) - min(hs) > steep: return None
    y0 = int(round(float(np.median(hs))))
    for x, z in fp:
        for dx in range(-gap, gap + 1):
            for dz in range(-gap, gap + 1):
                if inmap(x + dx, z + dz): taken[x + dx - X0, z + dz - Z0] = True
    plan.append({"stamp": bp.name, "design": key, "style": style, "kind": kind, "x": ox, "z": oz, "ground_y": y0, "rotation": deg,
                 "footprint": len(fp)})
    me = plan[-1]
    if extra is not None:
        CACHE[(extra.name, "-")] = extra
        plan.append({"stamp": extra.name, "design": extra.name, "style": "-", "kind": "garden", "x": ox, "z": oz, "ground_y": y0, "rotation": deg,
                     "footprint": 0})
    return me

def resample(pts, step=1.0):
    out = [tuple(pts[0])]
    for (x0, z0), (x1, z1) in zip(pts, pts[1:]):
        d = math.hypot(x1 - x0, z1 - z0); n = max(1, int(d / step))
        for i in range(1, n + 1): out.append((x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n))
    return out

def line_houses(pts, setback=4.5, sides=(1, -1), weights=None):
    pts = resample(pts)
    for side in sides:
        i = 0
        while i < len(pts) - 2:
            (x0, z0), (x1, z1) = pts[i], pts[min(i + 2, len(pts) - 1)]
            tx, tz = x1 - x0, z1 - z0; d = math.hypot(tx, tz) or 1; tx, tz = tx / d, tz / d
            nx, nz = -tz * side, tx * side                         # away from the street
            deg = snap_rot(-nx, -nz)                                # front faces the street
            fp = (pts[i][0] + nx * setback, pts[i][1] + nz * setback)
            if (fp[0] - WARD_C[0]) ** 2 + (fp[1] - WARD_C[1]) ** 2 > WARD_R ** 2: i += 2; continue
            placed = None
            for key, make in house_options():
                st = pick_style(); bp = design(key, make, st)
                for gd in (7, 5, None):
                    g = dressing.garden(bp, int(key.split("_")[-1]), depth=gd) if gd else None
                    placed = try_place(key, bp, deg, fp, st, gap=0, extra=g)
                    if placed: break
                if placed: break
            if placed:
                lo, hi = bp.bounds(); i += (hi[0] - lo[0] + 1) + (1 if rng.random() < 0.3 else 0)
            else: i += 2

def paint_street(pts, width):
    for x, z in resample(pts, 0.5):
        r = width / 2
        for dx in range(-int(r) - 1, int(r) + 2):
            for dz in range(-int(r) - 1, int(r) + 2):
                if dx * dx + dz * dz <= r * r and inmap(int(round(x)) + dx, int(round(z)) + dz) and not wet(int(round(x)) + dx, int(round(z)) + dz):
                    ROAD[int(round(x)) + dx - X0, int(round(z)) + dz - Z0] = True
HIGH = [(SQUARE[0] - 6, SQUARE[1] - 6), (-131, -133), (BRIDGE[1][0], BRIDGE[1][1] + 1)]
RING = [(SQUARE[0] + math.cos(t) * (SQUARE_R + 2), SQUARE[1] + math.sin(t) * (SQUARE_R + 2)) for t in np.linspace(0, 2 * math.pi, 48)]
paint_street(HIGH, 5); paint_street(RING, 3)

# ---- 1. the inn fronts the square from the south-east (its yard behind it, away from the river)
inn = design("kingsrest_inn", lambda s: vale.coaching_inn(style=s), "tudor")
for deg, fp in [(d_, (SQUARE[0] + ox_, SQUARE[1] + oz_)) for d_, ox_, oz_ in
                ((180, 0, 15), (180, 3, 15), (180, -3, 15), (180, 0, 16), (270, 15, 0), (270, 15, 3), (90, -15, 0), (0, 0, -15))]:
    if try_place("kingsrest_inn", inn, deg, fp, "tudor", kind="inn", steep=4): break

# ---- 2. sites for buildings still to design: searched for near where they belong, kept clear
def box_bp(name, w, d):
    b = Blueprint(name)
    for x in range(w):
        for z in range(d): b.set(x, 0, z, "stone_bricks")
    return b
CIVIC = {"Guildhall": vale_civic.guildhall(), "Station": vale_civic.station(), "Chapel": vale_civic.chapel()}
RESERVED = [("Guildhall", "stone", 0, 0, (SQUARE[0], SQUARE[1] - SQUARE_R - 3), None),
            ("Station", "stone", 0, 0, (BRIDGE[1][0] + 8, BRIDGE[1][1] + 4), None),
            ("Chapel", "stone", 0, 0, (SQUARE[0] + SQUARE_R + 3, SQUARE[1] - 4), None)]
reserved = []
for name, st, w, d, near, deg0 in RESERVED:
    best = None
    for r_ in range(0, 26):
        for k in range(max(1, 8 * r_)):
            t_ = 2 * math.pi * k / max(1, 8 * r_)
            fp = (near[0] + math.cos(t_) * r_, near[1] + math.sin(t_) * r_)
            vx, vz = (SQUARE[0] - fp[0], SQUARE[1] - fp[1]) if name != "Station" else (HIGH[2][0] - fp[0], HIGH[2][1] - fp[1])
            for deg in ([deg0] if deg0 is not None else [snap_rot(vx, vz)]):
                best = try_place(name.lower(), CIVIC[name], deg, fp, st, kind="civic", gap=2, steep=4)
                if best: break
            if best: break
        if best: break
    if best: best["name"] = name; reserved.append(best); CACHE[(name.lower(), st)] = CIVIC[name]
    else: print("no site for", name)
# ---- 3. the high street: square to the bridge
line_houses(HIGH, setback=4.5)
line_houses(RING, setback=3.5, sides=(1,))
# ---- 4. the map's roads through the ward
for name in ("Coast Line", "North Line", "Bay Line", "Fen Line", "Sun Line"):
    pts = [p for p in L["roads"][name] if (p[0] - WARD_C[0]) ** 2 + (p[1] - WARD_C[1]) ** 2 <= (WARD_R + 10) ** 2]
    if len(pts) > 2: line_houses(pts, setback=5.5)

# ---- 5. dressing: market stalls on the square, lamps along the streets, trees in the gaps
for k, ang in enumerate((215, 270, 325)):
    t_ = math.radians(ang); fx_, fz_ = SQUARE[0] + math.cos(t_) * 5, SQUARE[1] + math.sin(t_) * 5
    deg = snap_rot(SQUARE[0] - fx_, SQUARE[1] - fz_)
    st_ = dressing.stall(k + 1); CACHE[(st_.name, "-")] = st_
    lo, hi = st_.bounds(); ox_, oz_ = rot_xz(1, 1, deg)
    plan.append({"stamp": st_.name, "design": st_.name, "style": "-", "kind": "stall", "x": int(round(fx_ - ox_)), "z": int(round(fz_ - oz_)),
                 "ground_y": 75, "rotation": deg, "footprint": 9})
lamp_bp = dressing.lamp(); CACHE[("lamp_post", "-")] = lamp_bp
def lamps_along(pts, every=11, off=3.5):
    pts = resample(pts); last = -999
    for i in range(1, len(pts) - 1):
        if i - last < every: continue
        (x0, z0), (x1, z1) = pts[i - 1], pts[i + 1]; tx, tz = x1 - x0, z1 - z0; d = math.hypot(tx, tz) or 1
        for side in (1, -1):
            x, z = int(round(pts[i][0] - tz / d * off * side)), int(round(pts[i][1] + tx / d * off * side))
            if not inmap(x, z) or taken[x - X0, z - Z0] or wet(x, z) or road(x, z): continue
            if any((q["x"] - x) ** 2 + (q["z"] - z) ** 2 < 36 for q in plan if q["kind"] == "lamp"): continue
            if (x - WARD_C[0]) ** 2 + (z - WARD_C[1]) ** 2 > (WARD_R - 3) ** 2: continue
            taken[x - X0, z - Z0] = True; last = i
            plan.append({"stamp": "lamp_post", "design": "lamp_post", "style": "-", "kind": "lamp", "x": x, "z": z, "ground_y": gy(x, z), "rotation": 0, "footprint": 1})
            break
lamps_along(HIGH, every=9); lamps_along(RING, every=8, off=2.5)
for name in ("Coast Line", "North Line", "Bay Line", "Fen Line", "Sun Line"):
    pts = [p for p in L["roads"][name] if (p[0] - WARD_C[0]) ** 2 + (p[1] - WARD_C[1]) ** 2 <= WARD_R ** 2]
    if len(pts) > 2: lamps_along(pts, every=14, off=3.5)
ntree = 0
for k in range(4000):
    x = rng.randint(WARD_C[0] - WARD_R, WARD_C[0] + WARD_R); z = rng.randint(WARD_C[1] - WARD_R, WARD_C[1] + WARD_R)
    if (x - WARD_C[0]) ** 2 + (z - WARD_C[1]) ** 2 > (WARD_R - 4) ** 2 or not inmap(x, z): continue
    if (x - SQUARE[0]) ** 2 + (z - SQUARE[1]) ** 2 < 20 ** 2: continue
    if taken[max(0, x - 4 - X0):x + 5 - X0, max(0, z - 4 - Z0):z + 5 - Z0].any(): continue
    if ROAD[max(0, x - 3 - X0):x + 4 - X0, max(0, z - 3 - Z0):z + 4 - Z0].any() or WATER[max(0, x - 2 - X0):x + 3 - X0, max(0, z - 2 - Z0):z + 3 - Z0].any(): continue
    tb = dressing.tree(1000 + k); CACHE[(tb.name, "-")] = tb
    taken[x - 2 - X0:x + 3 - X0, z - 2 - Z0:z + 3 - Z0] = True; ntree += 1
    plan.append({"stamp": tb.name, "design": tb.name, "style": "-", "kind": "tree", "x": x, "z": z, "ground_y": gy(x, z), "rotation": 0, "footprint": 1})
    if ntree >= 30: break

# ---- 6. the stone bridge where all five lines meet: arches on piers, parapets, a lamp at each end
def make_bridge():
    bx, za, zb = BRIDGE[0][0], BRIDGE[0][1], BRIDGE[1][1]
    deck = max(gy(bx, za), gy(bx, zb))
    b = Blueprint("kingsrest_bridge")
    wetz = [z for z in range(za, zb + 1) if wet(bx, z)]
    w0, w1 = (min(wetz), max(wetz)) if wetz else (za, za)
    piers = [z for z in range(w0 + 3, w1 - 1, 6)]
    for z in range(za, zb + 1):
        lz = z - za
        for x in range(-3, 4):
            b.set(x, 0, lz, mix_deck(x, z))
            b.set(x, -1, lz, "stone_bricks") if abs(x) == 3 else None
        for x in (-3, 3):
            b.set(x, 1, lz, "stone_brick_wall")
        bed = min(gy(bx + dx, z) for dx in (-2, 0, 2))
        if z in piers:
            for x in range(-2, 3):
                for y in range(bed - deck, 0): b.set(x, y, lz, "stone_bricks")
            for x in (-2, 0, 2): b.set(x, -1, lz, "chiseled_stone_bricks") if x == 0 else None
        elif w0 <= z <= w1 and (z - 1 in piers or z + 1 in piers):
            f = "s" if z - 1 in piers else "n"
            for x in range(-2, 3): b.set(x, -1, lz, "stone_brick_stairs", facing=OPP_[f], half="top")
        elif not (w0 <= z <= w1):
            for x in range(-2, 3):
                for y in range(gy(bx + x, z) - deck + 1, 0): b.set(x, y, lz, "stone_bricks")
    for lz in (0, zb - za):
        for x in (-3, 3): b.set(x, 2, lz, "dark_oak_fence"); b.set(x, 3, lz, "lantern")
    return b.finish(), deck
OPP_ = {"n": "s", "s": "n"}
_dm = None
def mix_deck(x, z):
    return "stone_bricks" if h3(x, 0, z, 61) < 0.75 else ("cracked_stone_bricks" if h3(x, 1, z, 62) < 0.6 else "polished_andesite")
bridge_bp, deck_y = make_bridge(); CACHE[(bridge_bp.name, "-")] = bridge_bp
plan.append({"stamp": bridge_bp.name, "design": bridge_bp.name, "style": "-", "kind": "bridge", "x": BRIDGE[0][0], "z": BRIDGE[0][1], "ground_y": deck_y, "rotation": 0, "footprint": 7 * (BRIDGE[1][1] - BRIDGE[0][1] + 1)})

import collections; print("placed", dict(collections.Counter(p["kind"] for p in plan)))
json.dump({"town": "Kingsrest", "about": "Stamp origin = blueprint (0,0,0) at world x, ground_y, z after turning the stamp clockwise by rotation "
           "(0 = front faces south). Level the footprint to ground_y first; fill_below under it.",
           "civic": [r["name"] for r in reserved],
           "buildings": plan}, open(os.path.join(a.out, "kingsrest-plan.json"), "w"), indent=1)

# ---- plan picture
from PIL import Image, ImageDraw
n0, n1 = Y.shape; S = 4
img = np.zeros((n0, n1, 3), np.uint8); t = np.clip((Y - 66) / 17, 0, 1)
img[..., 0] = 120 + t * 80; img[..., 1] = 160 + t * 60; img[..., 2] = 100 + t * 40
img[Y % 2 == 0] = (img[Y % 2 == 0] * 0.92).astype(np.uint8)
img[ROAD] = (214, 196, 150); img[WATER] = (80, 130, 205)
im = Image.fromarray(img.transpose(1, 0, 2)).resize((n0 * S, n1 * S), Image.NEAREST); dr = ImageDraw.Draw(im)
P = lambda x, z: ((x - X0) * S, (z - Z0) * S)
c = P(*WARD_C); dr.ellipse([c[0] - WARD_R * S, c[1] - WARD_R * S, c[0] + WARD_R * S, c[1] + WARD_R * S], outline=(150, 40, 40), width=2)
c = P(*SQUARE); dr.ellipse([c[0] - SQUARE_R * S, c[1] - SQUARE_R * S, c[0] + SQUARE_R * S, c[1] + SQUARE_R * S], fill=(170, 170, 165), outline=(60, 60, 60))
dr.line([P(*BRIDGE[0]), P(*BRIDGE[1])], fill=(120, 110, 100), width=5 * S)
COL = {"tudor": (245, 240, 230), "brick": (178, 92, 70), "stone": (150, 150, 150)}
for p in plan:
    bp = CACHE[(p["design"], p["style"])]
    fp_ = [(x + p["x"], z + p["z"]) for x, z in footprint(bp, p["rotation"])]
    for x, z in fp_:
        q = P(x, z); fill = {"civic": (120, 120, 125), "bridge": (130, 125, 115), "garden": (110, 150, 80), "tree": (40, 100, 40), "lamp": (30, 30, 30), "stall": (200, 60, 50)}.get(p["kind"]) or COL[p["style"]]
        dr.rectangle([q[0], q[1], q[0] + S - 1, q[1] + S - 1], fill=fill)
    if p["kind"] == "civic":
        q = P(min(x for x, _ in fp_), min(z for _, z in fp_)); dr.text((q[0] + 3, q[1] + 3), p["name"], fill=(20, 20, 20))
crop = (P(WARD_C[0] - WARD_R - 8, WARD_C[1] - WARD_R - 8), P(WARD_C[0] + WARD_R + 8, WARD_C[1] + WARD_R + 8))
im.crop((*crop[0], *crop[1])).save(os.path.join(a.out, "kingsrest-plan.png"))

# ---- preview scene: terrain columns + buildings
scene = Blueprint("kingsrest_town")
R = WARD_R + 6
level = {}
for p in plan:
    if p["kind"] in ("lamp", "tree", "stall", "bridge"): continue
    bp = CACHE[(p["design"], p["style"])]
    for x, z in footprint(bp, p["rotation"]):
        for dx in (-1, 0, 1):
            for dz in (-1, 0, 1): level[(x + p["x"] + dx, z + p["z"] + dz)] = p["ground_y"]
def H(x, z): return level.get((x, z), gy(x, z)) if inmap(x, z) else 70
for x in range(WARD_C[0] - R, WARD_C[0] + R + 1):
    for z in range(WARD_C[1] - R, WARD_C[1] + R + 1):
        if (x - WARD_C[0]) ** 2 + (z - WARD_C[1]) ** 2 > R * R: continue
        h = H(x, z); low = min(h, *(H(x + dx, z + dz) for dx, dz in ((1, 0), (-1, 0), (0, 1), (0, -1)))) - 1
        sq = (x - SQUARE[0]) ** 2 + (z - SQUARE[1]) ** 2 <= SQUARE_R ** 2 + 1
        if sq: h = 75
        for y in range(min(low, h - 1), h): scene.set(x, y, z, "dirt")
        if wet(x, z) and (x, z) not in level:
            scene.set(x, h, z, "gravel")
            for y in range(h + 1, int(T["water"][x - X0, z - Z0]) + 1): scene.set(x, y, z, "water")
        elif sq: scene.set(x, h, z, "stone_bricks" if h3(x, 0, z, 4) < 0.8 else "mossy_cobblestone")
        elif road(x, z) and (x, z) not in level: scene.set(x, h, z, VALE["path"](x, h, z)[0])
        else:
            scene.set(x, h, z, "grass_block")
            r = h3(x, 1, z, 9)
            if (x, z) not in level and r < 0.05: scene.set(x, h + 1, z, "short_grass")
for p in plan:
    bp = CACHE[(p["design"], p["style"])].rotated(p["rotation"])
    for (x, y, z), v in bp.cells.items():
        wx, wy, wz = x + p["x"], y + p["ground_y"], z + p["z"]
        if y < 0 and p["kind"] != "bridge" and scene.get(wx, wy, wz)[0] != "keep": continue
        scene.cells[(wx, wy, wz)] = v
scene.finish()
cx, cz = SQUARE
scene.camera = {"views": {"town": [-25, 34, 200, cx - 14, 76, cz - 8], "square": [20, 22, 70, cx, 78, cz], "bridge": [-60, 18, 80, -150, 74, -150],
                          "high-street": [-130, 10, 46, -135, 78, -128], "aerial": [0, 70, 230, -150, 74, -150]}}
scene.save_logical(os.path.join(a.out, "scene.json"))
print("scene blocks", len(scene.cells))
if a.render:
    subprocess.run([sys.executable, os.path.join(HERE, "render", "render.py"), os.path.join(a.out, "scene.json"), a.out,
                    "--title", "Kingsrest", "--blurb", "Town plan v1 on the real map ground: houses and the inn along the roads.",
                    "--textures", a.textures, "--three", a.three, "--shots", "town,square,bridge,high-street,aerial"], check=True)
