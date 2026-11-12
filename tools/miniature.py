"""The miniature map in the welcome hall: the real world map, scaled down, built in blocks.

    python3 tools/miniature.py [terrain.npz] [preview.png]

Reads the files map/draw_map.py and map/genworld.py leave in the shared folder (terrain.npz, lines.json,
organic.json, hollow-crown-full-map-preview.png) and the add-on's plots/config.js, and writes:

    Siege_Nights_BP/scripts/plots/miniature_data.js   every column of the miniature, packed (read by miniature.js)
    /mnt/project-files/siege-nights/miniature/miniature.json   the same, unpacked, for the 3D preview

Scale: one block of the miniature is SCALE x SCALE blocks of the real map, so the 2,500-block map is CELLS blocks
across (odd, centred on x = z = 0). Heights are squeezed by VSCALE. Run it again whenever the world map is
regenerated, then commit miniature_data.js.

How water stays put in the sky: every river, lake pool and sea cell holds water at ONE level (the floor plus one),
and every land column is at least that tall, so no water block ever has an open side to flow out of. Rivers high
in the mountains (where the real ones are frozen) are ice at the ground's height instead, and so is Hallowmere.
"""
import os, re, sys, json, math
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHARED = "/mnt/project-files/siege-nights/map"
TERRAIN = sys.argv[1] if len(sys.argv) > 1 else os.path.join(SHARED, "terrain.npz")
PREVIEW = sys.argv[2] if len(sys.argv) > 2 else os.path.join(SHARED, "hollow-crown-full-map-preview.png")
CONFIG = os.path.join(ROOT, "Siege_Nights_BP", "scripts", "plots", "config.js")
OUT_JS = os.path.join(ROOT, "Siege_Nights_BP", "scripts", "plots", "miniature_data.js")
OUT_JSON = "/mnt/project-files/siege-nights/miniature/miniature.json"

SCALE = 25            # real blocks per miniature block
HALF = 50             # cells each side of the middle: CELLS = 101 (odd, per Mateo's rule)
CELLS = 2 * HALF + 1
VSCALE = 10           # real blocks of height per miniature block
SEA = 63
PREVIEW_ORIGIN = -1264

d = np.load(TERRAIN)
Y, REG, LAND, FOREST = d["Y"], d["reg"], d["land"], d["forest"]
H, N = int(d["H"]), int(d["N"])
S = N / (2 * H)
REGIONS = ["Aldmere Vale", "Frostmarch", "Saltreach", "Blackfen", "Emberwaste"]   # draw_map.py order
VALE, FROST, SALT, FEN, EMBER = range(5)
pre = np.asarray(Image.open(PREVIEW).convert("RGB"), np.float32)
L = json.load(open(os.path.join(os.path.dirname(os.path.abspath(TERRAIN)), "lines.json")))
cfg = open(CONFIG).read()
PLOTS = [(m[0], m[1], int(m[2]), int(m[3])) for m in re.findall(r'\{ name: "([^"]+)", region: "([^"]+)", x: (-?\d+), z: (-?\d+)', cfg)]
WARDS = [(m[0], int(m[1]), int(m[2]), int(m[3])) for m in re.findall(r'\{ name: "([^"]+)", x: (-?\d+), z: (-?\d+), r: (\d+)', cfg)]
TOWNS = WARDS[:6]

def hsh(i, j, k=0):
    n = math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453
    return n - math.floor(n)

def window(arr, x, z, half=SCALE / 2):
    c0, c1 = int(max(0, (x - half + H) * S)), int(min(N, (x + half + H) * S + 1))
    r0, r1 = int(max(0, (z - half + H) * S)), int(min(N, (z + half + H) * S + 1))
    return arr[r0:r1, c0:c1]

def pwindow(x, z, half=SCALE / 2):
    a, b = int(x - half - PREVIEW_ORIGIN), int(x + half - PREVIEW_ORIGIN + 1)
    c, e = int(z - half - PREVIEW_ORIGIN), int(z + half - PREVIEW_ORIGIN + 1)
    a, c = max(a, 0), max(c, 0)
    w = pre[c:e, a:b].reshape(-1, 3)
    return w if len(w) else np.zeros((1, 3), np.float32)

cell = lambda v: int(round(v / SCALE))
idx = lambda i: i + HALF          # cell coordinate -> array index

# ---------------------------------------------------------------- per cell: height, region, land, forest, colours
h = np.zeros((CELLS, CELLS), np.int32)
reg = np.zeros((CELLS, CELLS), np.int32)
land = np.zeros((CELLS, CELLS), bool)
forest = np.zeros((CELLS, CELLS), np.float32)
ymean = np.zeros((CELLS, CELLS), np.float32)
blue = np.zeros((CELLS, CELLS), np.float32)      # share of water-coloured pixels (Blackfen pools)
orange = np.zeros((CELLS, CELLS), np.float32)    # share of terracotta-coloured pixels (Emberwaste)
for a in range(CELLS):
    for b in range(CELLS):
        x, z = (a - HALF) * SCALE, (b - HALF) * SCALE
        yw, lw = window(Y, x, z), window(LAND, x, z)
        if yw.size == 0:
            continue
        land[b, a] = lw.mean() >= 0.5
        ymean[b, a] = yw[lw].mean() if land[b, a] else yw.mean()
        reg[b, a] = np.bincount(window(REG, x, z).ravel(), minlength=5).argmax()
        forest[b, a] = window(FOREST, x, z).mean()
        p = pwindow(x, z)
        blue[b, a] = ((p[:, 2] > p[:, 0] + 40) & (p[:, 2] > p[:, 1] + 10)).mean()
        orange[b, a] = ((p[:, 0] > 170) & (p[:, 1] < 130) & (p[:, 2] < 80)).mean()
        if land[b, a]:
            h[b, a] = max(2, int(round(1 + (ymean[b, a] - SEA) / VSCALE)))

# ---------------------------------------------------------------- water: sea, rivers, lakes, fen pools
WATER, ICE = 1, 2
water = np.zeros((CELLS, CELLS), np.int32)
water[~land] = WATER

def raster(pts, four=True):
    """Cells a line passes through, stepping one side at a time so water never connects only by a corner."""
    out = []
    prev = None
    for x, z in pts:
        c = (cell(x), cell(z))
        if prev is not None and c != prev:
            cx, cz = prev
            while (cx, cz) != c:
                if cx != c[0] and (cz == c[1] or abs(c[0] - cx) >= abs(c[1] - cz)):
                    cx += 1 if c[0] > cx else -1
                else:
                    cz += 1 if c[1] > cz else -1
                out.append((cx, cz))
                if not four and len(out) > 1:
                    pass
        elif prev is None:
            out.append(c)
        prev = c
    return [(i, j) for i, j in out if -HALF <= i <= HALF and -HALF <= j <= HALF]

river_cells = set()
for name, pts in L["rivers"].items():
    for i, j in raster(pts):
        river_cells.add((i, j))
for i, j in river_cells:
    b, a = idx(j), idx(i)
    if not land[b, a]:
        continue
    # High in the mountains the real rivers are frozen: ice at the ground's height. Lower down, open water.
    water[b, a] = ICE if ymean[b, a] > 98 else WATER

LAKES = [("Wren Water", -60, 300, 70, 45, WATER), ("Hallowmere", 60, -1130, 60, 35, ICE)]
for name, lx, lz, ra, rb, kind in LAKES:
    cells = [(a, b) for a in range(CELLS) for b in range(CELLS)
             if ((a - HALF) * SCALE - lx) ** 2 / (ra + 8) ** 2 + ((b - HALF) * SCALE - lz) ** 2 / (rb + 8) ** 2 <= 1]
    lvl = min(h[b, a] for a, b in cells)
    for a, b in cells:
        water[b, a] = kind
        if kind == ICE:
            h[b, a] = lvl

fenpool = land & (reg == FEN) & (blue > 0.28) & (water == 0)
water[fenpool] = WATER

# Land beside open water: valley sides fall gently to it (and the fen sits flush with its pools)
from itertools import product
open_w = water == WATER
dist = np.full((CELLS, CELLS), 99)
dist[open_w] = 0
for step in range(1, 4):
    grow = np.zeros_like(open_w)
    m = dist < step
    grow[1:, :] |= m[:-1, :]; grow[:-1, :] |= m[1:, :]; grow[:, 1:] |= m[:, :-1]; grow[:, :-1] |= m[:, 1:]
    dist[grow & (dist == 99)] = step
for b, a in product(range(CELLS), range(CELLS)):
    if water[b, a] == 0 and land[b, a] and dist[b, a] <= 3:
        floor = 1 if reg[b, a] == FEN else 2
        h[b, a] = min(h[b, a], floor + dist[b, a] - 1 + (1 if dist[b, a] >= 2 else 0))
    if water[b, a] == WATER:
        h[b, a] = 0
    if water[b, a] == 0 and land[b, a]:
        h[b, a] = max(h[b, a], 1)

# ---------------------------------------------------------------- roads and rails
road = np.zeros((CELLS, CELLS), np.int32)   # 1 trail, 2 road beside a rail line
for name, pts in L["trails"].items():
    for i, j in raster(pts):
        road[idx(j), idx(i)] = max(road[idx(j), idx(i)], 1)
for name, pts in L["roads"].items():
    for i, j in raster(pts):
        road[idx(j), idx(i)] = 2

# ---------------------------------------------------------------- surface and decoration per cell
def surface(a, b):
    r, y, hh = reg[b, a], ymean[b, a], h[b, a]
    if water[b, a] == WATER:
        if not land[b, a]:
            return "sand" if y >= 56 else ("gravel" if y >= 44 else "clay")
        return "mud" if r == FEN else "gravel"
    if water[b, a] == ICE:
        return "packed_ice"
    if road[b, a] == 2:
        return "gravel"
    if road[b, a] == 1:
        return "grass_path"
    if hh >= 13:
        return "snow"
    if r == FROST:
        if hh >= 9:
            return "stone" if hsh(a, b, 1) < 0.35 else "snow"
        return "snow" if hsh(a, b, 2) < 0.75 else "podzol"
    if hh >= 10:
        return "stone"
    if r == EMBER:
        return "red_sand" if orange[b, a] > 0.35 else "sand"
    if r == FEN:
        return "mud" if hsh(a, b, 3) < 0.35 else "moss_block"
    if r == SALT:
        if hh <= 2 and dist[b, a] <= 1 and not land_near_cliff(a, b):
            return "sand"
        return "grass" if hsh(a, b, 4) < 0.8 else "stone"
    return "grass"

def land_near_cliff(a, b):
    return h[b, a] >= 4

LEAF = {VALE: "oak_leaves", FROST: "spruce_leaves", SALT: "birch_leaves", FEN: "mangrove_leaves"}
deco = {}       # (a, b) -> [block, block, ...] stacked on the surface
for a in range(CELLS):
    for b in range(CELLS):
        r = reg[b, a]
        if water[b, a] or road[b, a] or not land[b, a] or r not in LEAF or h[b, a] >= 12:
            continue
        f = forest[b, a]
        dens = 0.55 if f > 0.18 else 0.3 if f > 0.05 else 0.06
        if r == FEN:
            dens *= 0.7
        if hsh(a, b, 5) < dens:
            leaf = "dark_oak_leaves" if r == VALE and hsh(a, b, 6) < 0.3 else LEAF[r]
            deco[(a, b)] = [leaf] + ([leaf] if hsh(a, b, 7) < 0.15 else [])

# Towns: a little paved square and a few roofs; Kingsrest gets its domed hall
HOUSE = {VALE: ("spruce_planks", "dark_oak_slab"), FROST: ("spruce_planks", "deepslate_tile_slab"),
         SALT: ("calcite", "prismarine_brick_slab"), EMBER: ("smooth_sandstone", "red_sandstone_slab"),
         FEN: ("mud_bricks", "mangrove_slab")}
for name, x, z, r_ in TOWNS:
    ci, cj = cell(x), cell(z)
    rad = max(1, round(r_ / SCALE * 0.75))
    rg = REG[int((z + H) * S), int((x + H) * S)]
    wall, roof = HOUSE[int(rg)]
    for i in range(ci - rad, ci + rad + 1):
        for j in range(cj - rad, cj + rad + 1):
            if math.hypot(i - ci, j - cj) > rad + 0.4:
                continue
            a, b = idx(i), idx(j)
            if water[b, a] or road[b, a] == 2:
                continue
            deco.pop((a, b), None)
            if (i, j) == (ci, cj):
                deco[(a, b)] = ["stone_bricks", "stone_bricks", "waxed_oxidized_copper"] if name == "Kingsrest" else ["cobblestone", "lantern"]
            elif hsh(i, j, 8) < 0.7:
                deco[(a, b)] = [wall, roof]
    # level the town's ground to its middle
    ground = [h[idx(j), idx(i)] for i in range(ci - rad, ci + rad + 1) for j in range(cj - rad, cj + rad + 1)
              if math.hypot(i - ci, j - cj) <= rad + 0.4 and not water[idx(j), idx(i)]]
    mid = max(2, int(np.median(ground)))
    for i in range(ci - rad, ci + rad + 1):
        for j in range(cj - rad, cj + rad + 1):
            if math.hypot(i - ci, j - cj) <= rad + 0.4 and not water[idx(j), idx(i)]:
                h[idx(j), idx(i)] = mid

# The ruined old capital, the Chapterhouse and the Ashen Watch
for name, ruin in [("Crownhold", ["cracked_stone_bricks", "mossy_cobblestone_wall"]),
                   ("the Ashen Gate Chapterhouse", ["deepslate_bricks", "deepslate_brick_wall"]),
                   ("the Ashen Watch", ["deepslate_bricks", "deepslate_bricks", "deepslate_brick_wall"])]:
    w = next(w for w in WARDS if w[0] == name)
    a, b = idx(cell(w[1])), idx(cell(w[2]))
    if not water[b, a]:
        deco[(a, b)] = ruin

# Plots: the marker cell and its neighbours are kept clear (the marker itself is placed by the add-on: it shows
# whether the plot is free)
plots_out = []
for name, region, x, z in PLOTS:
    i, j = cell(x), cell(z)
    a, b = idx(i), idx(j)
    for da in (-1, 0, 1):
        for db in (-1, 0, 1):
            deco.pop((a + da, b + db), None)
    if water[b, a]:
        raise SystemExit(f"{name}'s marker would stand in water at cell {i},{j}")
    plots_out.append({"name": name, "region": region, "dx": i, "dz": j, "h": int(h[b, a])})

# ---------------------------------------------------------------- the arrival quay out in Gull Bay, where the Waystone stands
QUAY = {"dx": -27, "dz": 1, "half": 3, "h": 2}
for i in range(QUAY["dx"] - QUAY["half"], QUAY["dx"] + QUAY["half"] + 1):
    for j in range(QUAY["dz"] - QUAY["half"], QUAY["dz"] + QUAY["half"] + 1):
        a, b = idx(i), idx(j)
        if land[b, a]:
            raise SystemExit(f"the quay reaches land at {i},{j}: move it out to sea")

# ---------------------------------------------------------------- the cloud: the miniature's outline (Mateo 2026-11-12)
# Not a square: the map sits on a cloud. The outline is a round core with puffs round its edge (overlapping circles),
# so the edge bulges and dips like a cloud. Every plot, town and the quay stays well inside. Cells outside the cloud
# are left empty; the ring of cells just outside it is the cloud's rim (white puffs a step above the land, with the
# barrier fence above), and the cloud bulges a few blocks down under the floor.
OUT, INSIDE, RIM = 0, 1, 2
CORE = 37          # radius of the round middle
REACH = 49         # no puff goes further than this from the middle (the rim must stay inside the array)
rg = np.random.default_rng(1212)
puffs = []
a0 = ang = rg.uniform(0, 2 * math.pi)
while ang < a0 + 2 * math.pi - 0.3:
    r = rg.uniform(9.5, 12.5)
    ring = rg.uniform(34, REACH - r)
    puffs.append((ring * math.cos(ang), ring * math.sin(ang), r))
    ang += rg.uniform(0.42, 0.62)
GX, GZ = np.meshgrid(np.arange(CELLS) - HALF, np.arange(CELLS) - HALF)
cloud = np.hypot(GX, GZ) <= CORE
for px_, pz_, r in puffs:
    cloud |= np.hypot(GX - px_, GZ - pz_) <= r
# Everything that matters stands at least 3 blocks in from the edge: add a puff wherever something would be too close
must = [(p["dx"], p["dz"]) for p in plots_out] + [(cell(x), cell(z)) for _, x, z, _ in TOWNS] + [(QUAY["dx"], QUAY["dz"])]
def clear_of_edge(i, j, m=3 + QUAY["half"]):
    return all(cloud[idx(j + dj), idx(i + di)] for di in range(-m, m + 1) for dj in range(-m, m + 1)
               if math.hypot(di, dj) <= m + 0.3 and abs(i + di) <= HALF and abs(j + dj) <= HALF)
for i, j in must:
    m = 3 + (QUAY["half"] if (i, j) == (QUAY["dx"], QUAY["dz"]) else 0)
    if not clear_of_edge(i, j, m):
        d = math.hypot(i, j) or 1
        r = 10.5
        k = min(1.0, (REACH - r) / d)
        cloud |= np.hypot(GX - i * k, GZ - j * k) <= r
        if not clear_of_edge(i, j, m):
            raise SystemExit(f"cannot fit {i},{j} inside the cloud")
assert not cloud[0, :].any() and not cloud[-1, :].any() and not cloud[:, 0].any() and not cloud[:, -1].any()
mask = np.where(cloud, INSIDE, OUT)
grow = np.zeros_like(cloud)
for da in (-1, 0, 1):
    for db in (-1, 0, 1):
        grow |= np.roll(np.roll(cloud, da, 1), db, 0)
mask[grow & ~cloud] = RIM
# How far the cloud bulges under the floor: deeper towards the middle, lumpy
edge_d = np.full((CELLS, CELLS), 0.0)
inside_pts = cloud.copy()
for step in range(1, 9):
    sh = inside_pts.copy()
    for da, db in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        sh &= np.roll(np.roll(inside_pts, da, 1), db, 0)
    edge_d[sh] += 1
    inside_pts = sh
under = np.zeros((CELLS, CELLS), np.int32)
for b in range(CELLS):
    for a in range(CELLS):
        if mask[b, a] == INSIDE:
            under[b, a] = 1 + min(3, int(edge_d[b, a] / 2.5 + hsh(a, b, 9) * 1.4))
        elif mask[b, a] == RIM:
            under[b, a] = 1

# ---------------------------------------------------------------- pack it
SURFACES = sorted({surface(a, b) for a in range(CELLS) for b in range(CELLS)})
DECOS = sorted({"|".join(v) for v in deco.values()})
ALPHA = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_"
assert len(SURFACES) < 64 and len(DECOS) < 63 and h.max() < 64
cols = []
grid = {"cells": CELLS, "scale": SCALE, "surfaces": SURFACES, "decos": DECOS, "h": [], "s": [], "w": [], "d": [], "m": [], "u": []}
for b in range(CELLS):
    hs, ss, ws, ds = [], [], [], []
    grid["m"].append("".join(str(v) for v in mask[b]))
    grid["u"].append("".join(str(v) for v in under[b]))
    for a in range(CELLS):
        hs.append(ALPHA[h[b, a]])
        ss.append(ALPHA[SURFACES.index(surface(a, b))])
        ws.append(str(water[b, a]))
        dv = deco.get((a, b))
        ds.append(ALPHA[DECOS.index("|".join(dv)) + 1] if dv else "0")
    grid["h"].append("".join(hs)); grid["s"].append("".join(ss)); grid["w"].append("".join(ws)); grid["d"].append("".join(ds))

def check_water():
    """No water block may have an open side (sideways neighbour without a solid block at the water's level)."""
    bad = []
    for b in range(CELLS):
        for a in range(CELLS):
            if water[b, a] != WATER or mask[b, a] != INSIDE:
                continue
            for da, db in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                na, nb = a + da, b + db
                if not (0 <= na < CELLS and 0 <= nb < CELLS):
                    continue  # the rim wall closes the edge
                if water[nb, na] == WATER or mask[nb, na] == RIM:
                    continue  # more water, or the cloud's rim
                if h[nb, na] < 1:
                    bad.append((a - HALF, b - HALF))
    return bad
bad = check_water()
if bad:
    raise SystemExit(f"water could run out at {bad[:10]}")

with open(OUT_JS, "w") as f:
    f.write("// Made by tools/miniature.py from the world map (terrain.npz, lines.json, the map preview). Do not edit by hand:\n")
    f.write("// change the map or the tool and run it again. One block here is %d x %d blocks of the real map.\n" % (SCALE, SCALE))
    f.write("// Rows run north to south, columns west to east, one character per column (see miniature.js for the alphabet).\n")
    out = {"cells": CELLS, "scale": SCALE, "half": HALF, "surfaces": SURFACES, "decos": DECOS, "quay": QUAY,
           "plots": plots_out,
           "towns": [{"name": n, "dx": cell(x), "dz": cell(z), "h": int(h[idx(cell(z)), idx(cell(x))])} for n, x, z, _ in TOWNS],
           "h": grid["h"], "s": grid["s"], "w": grid["w"], "d": grid["d"], "m": grid["m"], "u": grid["u"]}
    f.write("export const MINIATURE = " + json.dumps(out, separators=(",", ":")).replace('],"', '],\n"') + ";\n")
os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
json.dump(out, open(OUT_JSON, "w"))
blocks = int(h[cloud].sum()) + int(cloud.sum()) + int(under.sum()) + sum(len(v) for v in deco.values()) + int((water == WATER).sum())
print(f"{CELLS}x{CELLS} cells, max height {h.max()}, {len(deco)} decorations, ~{blocks} blocks, surfaces {SURFACES}")
print("plots:", [(p["name"], p["dx"], p["dz"], p["h"]) for p in plots_out])
