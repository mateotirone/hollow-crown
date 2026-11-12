"""Town plans: place the building designs along the real roads of the generated map.

    python3 town.py TOWN SLICE.npz LINES.json OUT_DIR [--render --textures DIR --three DIR]

TOWN is a key of TOWNS below (Kingsrest, Millbrook, ...).

SLICE.npz comes from terrain_slice.py (the same ground genworld.py writes); LINES.json is
draw_map.py's lines.json. Writes:
  OUT_DIR/<town>-plan.json       one entry per building: stamp, world x/z of the stamp origin,
                                ground y, rotation (clockwise from above; 0 = front faces south)
  OUT_DIR/<town>-plan.png       top-down plan
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

ap = argparse.ArgumentParser(); ap.add_argument("town"); ap.add_argument("slice"); ap.add_argument("lines"); ap.add_argument("out")
ap.add_argument("--render", action="store_true"); ap.add_argument("--textures", default=""); ap.add_argument("--three", default="")
ap.add_argument("--seed", type=int, default=7)
a = ap.parse_args(); os.makedirs(a.out, exist_ok=True)
T = np.load(a.slice); Y = T["Y"]; WATER = T["water"] > Y; ROAD = T["road"] | T["trail"]; X0, Z0 = int(T["X0"]), int(T["Z0"])
L = json.load(open(a.lines))
# Per town: ward (plots/config.js WARDS), the square genworld writes, bridges, the high street,
# civic buildings (name, maker, point they should stand near, what they face) and roads to build along.
TOWNS = {
    "Kingsrest": dict(ward=((-150, -150), 90), square=((-118, -118), 9, 75), inn=True,
                      bridges=[[(-150, -168), (-150, -140)]],                 # where all five lines meet
                      high=[(-124, -124), (-131, -133), (-150, -139)],
                      civic=[("Guildhall", vale_civic.guildhall, (-118, -130), "square"),
                             ("Station", vale_civic.station, (-142, -136), "high"),
                             ("Chapel", vale_civic.chapel, (-106, -122), "square")],
                      roads=("Coast Line", "North Line", "Bay Line", "Fen Line", "Sun Line"), seed=7),
    "Millbrook": dict(ward=((-60, -470), 70), square=((-60, -470), 6, 78), inn=False,
                      bridges=[[(-97, -470), (-69, -470)]],                   # the High Road over the brook
                      high=None,
                      civic=[("Clock tower", vale_civic.clock_tower, (-60, -480), "square"),
                             ("Chapel", lambda: vale_civic.chapel(name="millbrook_chapel"), (-44, -462), "square"),
                             ("Watermill", vale_civic.watermill, (-98, -492), "river")],
                      roads=("North Line", "Oakmere Branch"), trails=("High Road",), seed=11),
}
TW = TOWNS[a.town]; TNAME = a.town; TKEY = a.town.lower().replace("'", "").replace(" ", "_")
(WARD_C, WARD_R), (SQUARE, SQUARE_R, SQUARE_Y) = TW["ward"], TW["square"]
BRIDGES = TW["bridges"]; a.seed = TW.get("seed", a.seed)
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

def try_place(key, bp, deg, front_pt, style, kind="house", gap=1, steep=3, extra=None, wet_ok=None):
    lo, hi = bp.bounds()
    fx, fz = rot_xz((lo[0] + hi[0]) // 2, hi[2], deg)      # front-centre of the blueprint, turned
    ox, oz = int(round(front_pt[0] - fx)), int(round(front_pt[1] - fz))
    fp = [(x + ox, z + oz) for x, z in footprint(bp, deg)]
    if extra is not None: fp += [(x + ox, z + oz) for x, z in footprint(extra, deg)]
    wetcells = set()
    if wet_ok:                                   # cells that must stand in water (a mill wheel)
        wetcells = {(x + ox, z + oz) for x, z in (rot_xz(x_, z_, deg) for x_, z_ in wet_ok)}
        if sum(1 for x, z in wetcells if inmap(x, z) and wet(x, z)) < len(wetcells) - 2: return None
        fp = [c for c in fp if c not in wetcells]
        soft = {(x + ox, z + oz) for x, z in (rot_xz(x_, z_, deg) for x_, z_ in getattr(bp, "wet_soft", []))}
    hs = []
    for x, z in fp:
        if not inmap(x, z): return None
        if (x - WARD_C[0]) ** 2 + (z - WARD_C[1]) ** 2 > (WARD_R - 4) ** 2: return None
        if (x - SQUARE[0]) ** 2 + (z - SQUARE[1]) ** 2 <= (SQUARE_R + 2) ** 2: return None
        if taken[x - X0, z - Z0]: return None
        if not (wetcells and (x, z) in soft): hs.append(gy(x, z))
    for x, z in fp:
        if wetcells and wet(x, z) and (x, z) not in soft: return None
        for dx in (-1, 0, 1):
            for dz in (-1, 0, 1):
                if road(x + dx, z + dz) or (not wetcells and wet(x + dx, z + dz)): return None
    if max(hs) - min(hs) > steep: return None
    y0 = int(round(float(np.median(hs))))
    if wetcells:                                 # a mill sits on its water: the race's top (local y 0) is the brook's level
        wl = [int(T["water"][x - X0, z - Z0]) for x, z in wetcells if inmap(x, z) and wet(x, z)]
        yw = int(round(float(np.median(wl))))
        if abs(yw - y0) > steep: return None     # the bank must sit close to the water, or the mill hangs or drowns
        y0 = yw
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
HIGH = TW.get("high")
RING = [(SQUARE[0] + math.cos(t) * (SQUARE_R + 2), SQUARE[1] + math.sin(t) * (SQUARE_R + 2)) for t in np.linspace(0, 2 * math.pi, 48)]
if HIGH: paint_street(HIGH, 5)
paint_street(RING, 3)
for b0, b1 in BRIDGES:                       # bridges are streets too: keep houses off their landings
    paint_street([b0, b1], 5)
def road_pts(name, extra=10):
    pts = L["roads"].get(name) or L["trails"].get(name) or next((v for k, v in {**L["roads"], **L["trails"]}.items() if k.startswith(name)), [])
    return [p for p in pts if (p[0] - WARD_C[0]) ** 2 + (p[1] - WARD_C[1]) ** 2 <= (WARD_R + extra) ** 2]
STREETS = [road_pts(n) for n in TW["roads"] + TW.get("trails", ())]

# ---- 1. the inn (Kingsrest) fronts the square, its yard behind it
if TW.get("inn"):
    inn = design("kingsrest_inn", lambda s: vale.coaching_inn(style=s), "tudor")
    for deg, fp in [(d_, (SQUARE[0] + ox_, SQUARE[1] + oz_)) for d_, ox_, oz_ in
                    ((180, 0, 15), (180, 3, 15), (180, -3, 15), (180, 0, 16), (270, 15, 0), (270, 15, 3), (90, -15, 0), (0, 0, -15))]:
        if try_place("kingsrest_inn", inn, deg, fp, "tudor", kind="inn", steep=4): break

# ---- 2. civic buildings: searched for near where they belong, facing the square, the high street or the river
def nearest_wet(x, z, r=30):
    best = None
    for dx in range(-r, r + 1):
        for dz in range(-r, r + 1):
            if inmap(x + dx, z + dz) and wet(x + dx, z + dz) and (best is None or dx * dx + dz * dz < best[0]): best = (dx * dx + dz * dz, x + dx, z + dz)
    return best[1:] if best else (x, z)
reserved = []
for name, maker, near, face in TW["civic"]:
    bp_c = maker(); best = None; key = bp_c.name
    if face == "river":                          # brute force: every spot and turn near the brook until the wheel lands in water
        cand = sorted(((x, z) for x in range(near[0] - 40, near[0] + 41) for z in range(near[1] - 40, near[1] + 41)),
                      key=lambda c: (c[0] - near[0]) ** 2 + (c[1] - near[1]) ** 2)
        for fp in cand:
            for deg in ROT:
                best = try_place(key, bp_c, deg, fp, "stone", kind="civic", gap=2, steep=4, wet_ok=bp_c.wet_ok)
                if best: break
            if best: break
    for r_ in range(0, 0 if face == "river" else 30):
        for k in range(max(1, 8 * r_)):
            t_ = 2 * math.pi * k / max(1, 8 * r_)
            fp = (near[0] + math.cos(t_) * r_, near[1] + math.sin(t_) * r_)
            tgt = SQUARE if face == "square" else (HIGH[-1] if face == "high" else nearest_wet(int(fp[0]), int(fp[1])))
            vx_, vz_ = tgt[0] - fp[0], tgt[1] - fp[1]
            deg = snap_rot(vx_, vz_) if face != "river" else \
                max(ROT, key=lambda r: rot_xz(-1, 0, r)[0] * vx_ + rot_xz(-1, 0, r)[1] * vz_)   # the mill's wheel side (west) faces the water
            best = try_place(key, bp_c, deg, fp, "stone", kind="civic", gap=2, steep=4, wet_ok=getattr(bp_c, "wet_ok", None))
            if best: break
        if best: break
    if best: best["name"] = name; reserved.append(best); CACHE[(key, "stone")] = bp_c
    else: print("no site for", name)
# ---- 3. streets: the high street, the lane round the square, the map's roads through the ward
if HIGH: line_houses(HIGH, setback=4.5)
line_houses(RING, setback=3.5, sides=(1,))
for pts in STREETS:
    if len(pts) > 2: line_houses(pts, setback=5.5)

# ---- 4. dressing: market stalls on the square, lamps along the streets, trees in the gaps
for k, ang in enumerate((215, 270, 325)):
    t_ = math.radians(ang); rr = min(5, SQUARE_R - 2); fx_, fz_ = SQUARE[0] + math.cos(t_) * rr, SQUARE[1] + math.sin(t_) * rr
    deg = snap_rot(SQUARE[0] - fx_, SQUARE[1] - fz_)
    st_ = dressing.stall(k + 1); CACHE[(st_.name, "-")] = st_
    lo, hi = st_.bounds(); ox_, oz_ = rot_xz(1, 1, deg)
    plan.append({"stamp": st_.name, "design": st_.name, "style": "-", "kind": "stall", "x": int(round(fx_ - ox_)), "z": int(round(fz_ - oz_)),
                 "ground_y": SQUARE_Y, "rotation": deg, "footprint": 9})
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
if HIGH: lamps_along(HIGH, every=9)
lamps_along(RING, every=8, off=2.5)
for pts in STREETS:
    pts = [p for p in pts if (p[0] - WARD_C[0]) ** 2 + (p[1] - WARD_C[1]) ** 2 <= WARD_R ** 2]
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
    if ntree >= int(30 * (WARD_R / 90) ** 2): break

# ---- 5. stone bridges: arches on piers, parapets, a lamp at each end. Built along +z, turned to fit.
def mix_deck(x, z):
    return "stone_bricks" if h3(x, 0, z, 61) < 0.75 else ("cracked_stone_bricks" if h3(x, 1, z, 62) < 0.6 else "polished_andesite")
def make_bridge(i, b0, b1):
    ns = b0[0] == b1[0]
    (p0, p1) = sorted([b0, b1], key=lambda p: p[1] if ns else p[0])
    n = (p1[1] - p0[1]) if ns else (p1[0] - p0[0])
    W = lambda lat, l: (p0[0] + lat, p0[1] + l) if ns else (p0[0] + l, p0[1] - lat)      # local (lateral x, along z) -> world
    G = lambda lat, l: gy(*W(lat, l)); WT = lambda lat, l: wet(*W(lat, l))
    deck = max(G(0, 0), G(0, n))
    b = Blueprint(f"{TKEY}_bridge_{i + 1}")
    wl = [l for l in range(n + 1) if WT(0, l)]
    w0, w1 = (min(wl), max(wl)) if wl else (0, 0)
    piers = list(range(w0 + 3, w1 - 1, 6))
    for l in range(n + 1):
        for x in range(-3, 4):
            b.set(x, 0, l, mix_deck(x, l + i * 50))
            if abs(x) == 3: b.set(x, -1, l, "stone_bricks")
        for x in (-3, 3): b.set(x, 1, l, "stone_brick_wall")
        bed = min(G(dx, l) for dx in (-2, 0, 2))
        if l in piers:
            for x in range(-2, 3):
                for y in range(bed - deck, 0): b.set(x, y, l, "stone_bricks")
        elif w0 <= l <= w1 and (l - 1 in piers or l + 1 in piers):
            for x in range(-2, 3): b.set(x, -1, l, "stone_brick_stairs", facing="n" if l - 1 in piers else "s", half="top")
        elif not (w0 <= l <= w1):
            for x in range(-2, 3):
                for y in range(G(x, l) - deck + 1, 0): b.set(x, y, l, "stone_bricks")
    for l in (0, n):
        for x in (-3, 3): b.set(x, 2, l, "dark_oak_fence"); b.set(x, 3, l, "lantern")
    return b.finish(), deck, p0, (0 if ns else 270), n
for i, (b0, b1) in enumerate(BRIDGES):
    bb, deck_y, p0, rot, n = make_bridge(i, b0, b1); CACHE[(bb.name, "-")] = bb
    plan.append({"stamp": bb.name, "design": bb.name, "style": "-", "kind": "bridge", "x": p0[0], "z": p0[1], "ground_y": deck_y, "rotation": rot, "footprint": 7 * (n + 1)})

import collections; print("placed", dict(collections.Counter(p["kind"] for p in plan)))
json.dump({"town": TNAME, "about": "Stamp origin = blueprint (0,0,0) at world x, ground_y, z after turning the stamp clockwise by rotation "
           "(0 = front faces south). Level the footprint to ground_y first; fill_below under it.",
           "civic": [r["name"] for r in reserved],
           "buildings": plan}, open(os.path.join(a.out, f"{TKEY}-plan.json"), "w"), indent=1)

# ---- plan picture
from PIL import Image, ImageDraw
n0, n1 = Y.shape; S = 4
img = np.zeros((n0, n1, 3), np.uint8); t = np.clip((Y - Y.min()) / max(1, Y.max() - Y.min()), 0, 1)
img[..., 0] = 120 + t * 80; img[..., 1] = 160 + t * 60; img[..., 2] = 100 + t * 40
img[Y % 2 == 0] = (img[Y % 2 == 0] * 0.92).astype(np.uint8)
img[ROAD] = (214, 196, 150); img[WATER] = (80, 130, 205)
im = Image.fromarray(img.transpose(1, 0, 2)).resize((n0 * S, n1 * S), Image.NEAREST); dr = ImageDraw.Draw(im)
P = lambda x, z: ((x - X0) * S, (z - Z0) * S)
c = P(*WARD_C); dr.ellipse([c[0] - WARD_R * S, c[1] - WARD_R * S, c[0] + WARD_R * S, c[1] + WARD_R * S], outline=(150, 40, 40), width=2)
c = P(*SQUARE); dr.ellipse([c[0] - SQUARE_R * S, c[1] - SQUARE_R * S, c[0] + SQUARE_R * S, c[1] + SQUARE_R * S], fill=(170, 170, 165), outline=(60, 60, 60))
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
im.crop((*crop[0], *crop[1])).save(os.path.join(a.out, f"{TKEY}-plan.png"))

# ---- preview scene: terrain columns + buildings
scene = Blueprint(f"{TKEY}_town")
R = WARD_R + 6
level = {}
for p in plan:
    if p["kind"] in ("lamp", "tree", "stall", "bridge"): continue
    bp = CACHE[(p["design"], p["style"])]
    keepwet = {rot_xz(x_, z_, p["rotation"]) for x_, z_ in getattr(bp, "wet_ok", [])}
    for x, z in footprint(bp, p["rotation"]):
        for dx, dz in ([(0, 0)] if keepwet else [(dx, dz) for dx in (-1, 0, 1) for dz in (-1, 0, 1)]):
            if (x + dx, z + dz) in keepwet: continue
            level[(x + p["x"] + dx, z + p["z"] + dz)] = p["ground_y"]
def H(x, z): return level.get((x, z), gy(x, z)) if inmap(x, z) else 70
for x in range(WARD_C[0] - R, WARD_C[0] + R + 1):
    for z in range(WARD_C[1] - R, WARD_C[1] + R + 1):
        if (x - WARD_C[0]) ** 2 + (z - WARD_C[1]) ** 2 > R * R: continue
        h = H(x, z); low = min(h, *(H(x + dx, z + dz) for dx, dz in ((1, 0), (-1, 0), (0, 1), (0, -1)))) - 1
        sq = (x - SQUARE[0]) ** 2 + (z - SQUARE[1]) ** 2 <= SQUARE_R ** 2 + 1
        if sq: h = SQUARE_Y
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
cx, cz = SQUARE; bx_, bz_ = (BRIDGES[0][0][0] + BRIDGES[0][1][0]) // 2, (BRIDGES[0][0][1] + BRIDGES[0][1][1]) // 2
scene.camera = {"views": {"town": [-25, 34, WARD_R * 2.2, cx - 14, SQUARE_Y + 1, cz - 8], "square": [20, 22, 70, cx, SQUARE_Y + 3, cz],
                          "bridge": [-60, 18, 80, bx_, SQUARE_Y - 1, bz_], "aerial": [0, 70, WARD_R * 2.6, WARD_C[0], SQUARE_Y, WARD_C[1]]}}
scene.save_logical(os.path.join(a.out, "scene.json"))
print("scene blocks", len(scene.cells))
if a.render:
    subprocess.run([sys.executable, os.path.join(HERE, "render", "render.py"), os.path.join(a.out, "scene.json"), a.out,
                    "--title", TNAME, "--blurb", "Town plan on the real map ground.",
                    "--textures", a.textures, "--three", a.three, "--shots", "town,bridge"], check=True)
