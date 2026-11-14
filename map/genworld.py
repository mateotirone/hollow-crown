"""Write the Hollow Crown map plan into a Bedrock world.

Run with a Python that has amulet-core 1.9:
    python genworld.py terrain.npz out_dir x0 z0 size [config.js]

terrain.npz and lines.json come from draw_map.py. x0 z0 size pick the square to write
(the whole map is -1250 -1250 2500). config.js (scripts/plots/config.js) gives the plots
and towns, so trees, pools and caves keep away from them.

The land is designed, not left to Minecraft: heights, rivers, roads and regions come from
the plan; this script adds the block detail. Per region: Aldmere Vale (grass, oak and
birch), Frostmarch (snow, spruce and pine, frozen water), Saltreach (stony coast,
wind-bent trees), Blackfen (mud, moss, pools, mangroves; black water via the resource
pack's mangrove_swamp restyle), Emberwaste (sand, sandstone, banded terracotta, cacti).
Underground: deepslate below 0, stone patches, winding caves, ores, lava at the bottom.

The world is written in square tiles so the full map fits in memory, and a top-down
picture of what was written is saved next to it (<out_dir>-preview.png).
"""
import sys, os, re, math, json, time, shutil, numpy as np
import amulet
from amulet.api.block import Block
from amulet.api.chunk import Chunk
from amulet.level.formats.leveldb_world import LevelDBFormat
from amulet_nbt import ByteTag, IntTag, StringTag, LongTag
from PIL import Image, ImageDraw

src, out = sys.argv[1], sys.argv[2]
X0, Z0, SIZE = int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5])
CONFIG = sys.argv[6] if len(sys.argv) > 6 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "Siege_Nights_BP", "scripts", "plots", "config.js")
VER = (26, 30, 0); SEA = 62; DIM = "minecraft:overworld"; YMIN = -64
TILE = 256; MARGIN = 10
VALE, FROST, SALT, FEN, EMBER = range(5)
T0 = time.time()
def log(*a): print(f"[{time.time()-T0:6.0f}s]", *a, flush=True)

# ---------------------------------------------------------------- plan data
t = np.load(src); H = int(t['H']); N = int(t['N']); S = N / (2 * H)
xs_w = np.arange(X0, X0 + SIZE); zs_w = np.arange(Z0, Z0 + SIZE)
GX, GZ = np.meshgrid(xs_w, zs_w, indexing='ij')          # world coords, [x,z]

def sample(arr, smooth=True, dx=0, dz=0):
    gx = (GX + dx + H) * S; gz = (GZ + dz + H) * S
    if not smooth:
        return arr[np.clip(np.round(gz).astype(int), 0, N - 1), np.clip(np.round(gx).astype(int), 0, N - 1)]
    x0 = np.clip(np.floor(gx).astype(int), 0, N - 2); z0 = np.clip(np.floor(gz).astype(int), 0, N - 2)
    fx = (gx - x0).astype(np.float32); fz = (gz - z0).astype(np.float32); a = arr.astype(np.float32)
    return a[z0, x0] * (1 - fx) * (1 - fz) + a[z0, x0 + 1] * fx * (1 - fz) + a[z0 + 1, x0] * (1 - fx) * fz + a[z0 + 1, x0 + 1] * fx * fz

def noise(scale, seed):
    """Smooth value noise over the written square, by world position (same for any slice)."""
    r = np.random.default_rng(seed); n = max(int(2 * H / scale) + 4, int((max(xs_w.max(), zs_w.max()) + H) / scale) + 3)   # fine scales need a bigger grid at the edge
    g = r.random((n, n)).astype(np.float32)
    fxw = (xs_w + H) / scale; fzw = (zs_w + H) / scale
    ix = fxw.astype(int); iz = fzw.astype(int); fx = fxw - ix; fz = fzw - iz
    fx = fx * fx * (3 - 2 * fx); fz = fz * fz * (3 - 2 * fz)
    return (g[ix][:, iz] * (1 - fx)[:, None] * (1 - fz)[None, :] + g[ix + 1][:, iz] * fx[:, None] * (1 - fz)[None, :]
            + g[ix][:, iz + 1] * (1 - fx)[:, None] * fz[None, :] + g[ix + 1][:, iz + 1] * fx[:, None] * fz[None, :]) - 0.5

def box(a, k):
    p = np.pad(a, k, mode='edge'); c = np.cumsum(np.cumsum(p, 0, dtype=np.float64), 1); c = np.pad(c, ((1, 0), (1, 0)))
    n = 2 * k + 1; return ((c[n:, n:] - c[:-n, n:] - c[n:, :-n] + c[:-n, :-n]) / (n * n)).astype(np.float32)

# plots and towns from the add-on's own config
cfg = open(CONFIG).read()
PLOTS = [(m[0], int(m[1]), int(m[2])) for m in re.findall(r'\{ name: "([^"]+)", region: "[^"]+", x: (-?\d+), z: (-?\d+)', cfg)]
WARDS = [(m[0], int(m[1]), int(m[2]), int(m[3]), 'thin: true' in m[4]) for m in re.findall(r'\{ name: "([^"]+)", x: (-?\d+), z: (-?\d+), r: (\d+)([^}]*)\}', cfg)]
TOWNS = WARDS[:6]
PLAZA = {n: (x, z) for n, x, z, r, _ in TOWNS}
m_ = re.search(r"kingsrest: \{ x: (-?\d+), y: -?\d+, z: (-?\d+)", cfg)
if m_: PLAZA["Kingsrest"] = (int(m_[1]), int(m_[2]))   # the square sits off the river, where arrivals land
log("plots", len(PLOTS), "wards", len(WARDS))

rng = np.random.default_rng(5)
Yf = sample(t['Y']) + noise(24, 1) * 3.0 + noise(9, 2) * 1.2
land = sample(t['land'].astype(np.float32)) > 0.5
forest = sample(t['forest']) + noise(12, 3) * 0.08
# region edges wander instead of following the plan's coarse grid
reg = sample(t['reg'], False, noise(40, 11) * 70 + noise(5, 13) * 9, noise(40, 12) * 70 + noise(5, 14) * 9).astype(np.uint8)

L = json.load(open(os.path.join(os.path.dirname(os.path.abspath(src)), 'lines.json')))
def raster(lines, width_fn):
    im = Image.new('L', (SIZE, SIZE), 0); d = ImageDraw.Draw(im)
    for pts in lines:
        k = len(pts)
        for j in range(k - 1):
            w = width_fn(j / k); a_ = (pts[j][0] - X0, pts[j][1] - Z0); b_ = (pts[j + 1][0] - X0, pts[j + 1][1] - Z0)
            d.line([a_, b_], fill=255, width=w); r_ = w / 2; d.ellipse([b_[0] - r_, b_[1] - r_, b_[0] + r_, b_[1] + r_], fill=255)
    return (np.asarray(im) > 127).T
rl = list(L["rivers"].values())
isriver = raster(rl, lambda f: int(7 + 8 * f)) & land
bank = raster(rl, lambda f: int(13 + 10 * f)) & land & ~isriver
valley = raster(rl, lambda f: int(30 + 14 * f)).astype(np.float32)
def offset_line(pts, d):
    """The polyline moved d blocks to its right (the road runs beside the rail, not on it)."""
    P = np.asarray(pts, float); T = np.gradient(P, axis=0); T /= np.maximum(np.hypot(T[:, 0], T[:, 1]), 1e-6)[:, None]
    return [tuple(v) for v in P + np.stack([-T[:, 1], T[:, 0]], 1) * d]
ROADOFF = 8
roadlines = [offset_line(v, ROADOFF) for v in L["roads"].values()]
isroad = raster(roadlines, lambda f: 5) & land & ~isriver
roadbridge = raster(roadlines, lambda f: 5) & isriver
istrail = raster(list(L["trails"].values()), lambda f: 3) & land & ~isroad & ~isriver
log("rasters done")

# distance-to-thing masks
def disc_mask(points, extra=0):
    m = np.zeros((SIZE, SIZE), bool)
    for _, x, z, r in points:
        x0, x1 = max(0, x - r - extra - X0), min(SIZE, x + r + extra - X0 + 1); z0, z1 = max(0, z - r - extra - Z0), min(SIZE, z + r + extra - Z0 + 1)
        if x0 >= x1 or z0 >= z1: continue
        sx, sz = np.meshgrid(np.arange(x0, x1) + X0, np.arange(z0, z1) + Z0, indexing='ij')
        m[x0:x1, z0:z1] |= (sx - x) ** 2 + (sz - z) ** 2 <= (r + extra) ** 2
    return m
def plot_shape(name, theta):
    """Wandering edge factor (>= 1) by bearing; same numbers as draw_map.py's terraces."""
    r_ = np.random.default_rng(sum(map(ord, name)) * 7919)
    f = np.ones_like(theta)
    for k in (2, 3, 5, 7):
        a = r_.uniform(0.05, 0.22) / (1 + 0.15 * k); ph = r_.uniform(0, 6.283)
        f = f + a * (1 + np.cos(k * theta + ph))
    return f
# each plot's clearing: no trees inside its wandering edge (never closer than r76, past the r72 land),
# then woodland thickens back over a wandering band instead of stopping at a hard ring
plotfade = np.ones((SIZE, SIZE), np.float32)       # 0 = clear, 1 = natural density
for n, x, z in PLOTS:
    x0, x1 = max(0, x - 200 - X0), min(SIZE, x + 200 - X0); z0, z1 = max(0, z - 200 - Z0), min(SIZE, z + 200 - Z0)
    if x0 >= x1 or z0 >= z1: continue
    dx_ = GX[x0:x1, z0:z1] - x; dz_ = GZ[x0:x1, z0:z1] - z
    th = np.arctan2(dz_, dx_); d = np.hypot(dx_, dz_)
    rc = 76 * plot_shape(n, th); band = 25 + 45 * (plot_shape(n + "e", th) - 1)
    fade = np.clip((d - rc) / band, 0, 1)
    plotfade[x0:x1, z0:z1] = np.minimum(plotfade[x0:x1, z0:z1], fade * fade)
plotzone = plotfade < 0.02
townzone = disc_mask([(n, x, z, r) for n, x, z, r, _ in TOWNS])
sitezone = disc_mask([(n, x, z, int(r * 0.6)) for n, x, z, r, _ in WARDS[6:]])
keepclear = plotzone | townzone | sitezone
# mountains get crags and steeper faces: ridged noise, only high up and never on plots, towns or roads
mmask = np.clip((Yf - 128) / 45, 0, 1); mmask = mmask * mmask * (3 - 2 * mmask)
mmask *= (box((plotzone | townzone).astype(np.float32), 20) < 0.01) & (box((isroad | istrail).astype(np.float32), 8) < 0.01)
ridge = (1 - np.abs(2 * noise(34, 51) * 2)) * 16 + (1 - np.abs(2 * noise(13, 52) * 2)) * 7 + (1 - np.abs(2 * noise(6, 53) * 2)) * 2.5
Yf = Yf + mmask * (ridge - 12)

# roads sit on gently smoothed ground; river valleys are smoothed and lowered
Ys = box(Yf, 6); near = box((isroad | istrail).astype(np.float32), 3)
Yf = np.where(near > 0.02, Yf * (1 - np.clip(near * 6, 0, 1)) + Ys * np.clip(near * 6, 0, 1), Yf)
Yr = box(Yf, 16); rw = np.clip(box(valley, 6), 0, 1); Yf = Yf * (1 - rw) + (Yr - 1.5) * rw

# white chalk cliffs on the Saltreach's northern coast (Mateo 2026-11-11: "Cliffs of Dover"; first try looked like a flat
# white wall). Modelled on the Seven Sisters / Dover: rolling chalk downs cut off by the sea, so the cliff top rises and
# dips with the hills (dry valleys bring it down to ~12 blocks, crests reach ~55); a rounded grassy shoulder at the edge;
# a sheer face with buttresses, flutes and the odd ledge; fallen chalk blocks and flint shingle at the foot; a pale
# wave-cut platform just under the water. Breaks where a river valley reaches the sea; never near plots, towns or roads.
def chamfer_b(src, cap):
    """Blocks to the nearest True cell of src (8-neighbour chamfer), capped."""
    d = np.where(src, 0.0, cap).astype(np.float32)
    for _ in range(int(cap) + 2):
        p = np.pad(d, 1, mode='edge')
        n_ = np.minimum.reduce([p[1:-1, :-2] + 1, p[1:-1, 2:] + 1, p[:-2, 1:-1] + 1, p[2:, 1:-1] + 1,
                                p[:-2, :-2] + 1.414, p[:-2, 2:] + 1.414, p[2:, :-2] + 1.414, p[2:, 2:] + 1.414])
        d = np.minimum(d, n_)
    return d
cz = np.clip(box((reg == SALT).astype(np.float32), 40) * 1.6 - 0.3, 0, 1)
cz *= np.clip((-GZ - 150) / 250, 0, 1)                                                # northern coast only
cz *= 1 - np.clip(box(valley, 24) * 4, 0, 1)                                            # gaps at river mouths
cz *= box((keepclear | isroad | istrail).astype(np.float32), 24) < 0.01
cz = box(cz, 8); cz = cz * cz * (3 - 2 * cz)
chalk = np.zeros((SIZE, SIZE), bool); chalkfoot = np.zeros((SIZE, SIZE), bool); chalkface = np.zeros((SIZE, SIZE), bool)
chalkdown = np.zeros((SIZE, SIZE), np.float32); chalktop = np.zeros((SIZE, SIZE), np.float32); chalkshelf = np.zeros((SIZE, SIZE), bool); boulder = np.zeros((SIZE, SIZE), bool)
if (cz > 0.01).any():
    xi, zi = np.nonzero(cz > 0.01); a0_, a1_ = max(0, xi.min() - 230), min(SIZE, xi.max() + 230); b0_, b1_ = max(0, zi.min() - 230), min(SIZE, zi.max() + 230)
    dsb = np.full((SIZE, SIZE), 220.0, np.float32); dsb[a0_:a1_, b0_:b1_] = chamfer_b(~land[a0_:a1_, b0_:b1_], 220)
    dlb = np.full((SIZE, SIZE), 40.0, np.float32); dlb[a0_:a1_, b0_:b1_] = chamfer_b(land[a0_:a1_, b0_:b1_], 40)
    # the face line: broad bays and headlands, then buttresses and flutes a few blocks deep
    bite = np.clip((noise(70, 61) + noise(23, 62) * 0.6) * 26 + 6, 0, 16) + (noise(7, 66) + 0.5) * 4 + (noise(3, 67) + 0.5) * 1.6
    dse = dsb - bite
    w0 = 2 + (noise(11, 63) + 0.5) * 4                                                  # shingle strip width
    # the downs: rounded hills and dry valleys running inland
    roll = noise(95, 64) + noise(41, 65) * 0.45
    top = np.maximum(SEA + 32 + roll * 38, SEA + 12) + np.clip(dse - w0, 0, 140) * 0.07
    p_ = dse - w0
    apr = (noise(13, 68) + 0.5) * 3                                                     # small rubble apron at the foot
    shoulder = (2 + (noise(19, 70) + 0.5) * 3) * (1 - np.clip((p_ - apr) / 7, 0, 1)) ** 2   # rounded grass edge
    Ycl = np.where(p_ < apr, SEA + 1 + np.clip(p_, 0, None) * 1.3, top - shoulder)
    batter = (p_ >= apr) & (p_ < apr + 3) & (noise(21, 76) > -0.15)                      # face steps back a little as it rises
    Ycl = np.where(batter, np.minimum(Ycl, SEA + 1 + (top - SEA - 1) * (0.5 + 0.5 * (p_ - apr) / 3) + (noise(4, 77) * 6)), Ycl)
    ledge = (noise(17, 69) > 0.28) & (p_ >= apr) & (p_ < apr + 1 + (noise(5, 71) + 0.5) * 2.5)
    Ycl = np.where(ledge, SEA + 1 + (top - SEA - 1) * (0.38 + (noise(29, 72) + 0.5) * 0.25), Ycl)   # a fallen step part-way down
    k_ = np.clip((dsb - 120) / 100, 0, 1); k_ = k_ * k_ * (3 - 2 * k_)                      # back into the land inland
    Ycl = Ycl * (1 - k_) + Yf * k_
    rb = rng.random((SIZE, SIZE))
    boulder = land & (cz > 0.35) & (p_ < 0) & (p_ > -4) & (box((rb < 0.05).astype(np.float32), 1) > 0.15)
    Ynew = np.where(p_ < 0, SEA + 1 + boulder * (1 + (rb > 0.5)), np.maximum(Ycl, Yf))
    Yf = np.where(land, Yf * (1 - cz) + Ynew * cz, Yf)
    # wave-cut platform: a pale shelf just under the surface reaching ~20 blocks out from the foot
    shelfw = 14 + (noise(31, 73) + 0.5) * 14
    chalkshelf = ~land & (cz > 0.35) & (dlb < shelfw)
    Yf = np.where(chalkshelf, np.maximum(Yf, SEA - 2 - (dlb > shelfw * 0.7) - (noise(6, 74) > 0.2)), Yf)
    chalk = land & (cz > 0.35) & (p_ >= 0) & (dsb < 200)
    chalkfoot = land & (cz > 0.35) & (p_ < 0)
    chalktop = top - shoulder
    chalkdown = cz * (1 - np.clip((dsb - 60) / 150, 0, 1))
    log("chalk cliffs", int(chalk.sum()), "columns")

# lakes (drawn on the plan as shapes, carved here): water a block under the lowest rim
LAKES = [("Wren Water", -60, 300, 70, 45), ("Hallowmere", 60, -1130, 60, 35)]
islake = np.zeros((SIZE, SIZE), bool); lakelevel = np.zeros((SIZE, SIZE), np.int32)
for name, lx, lz, a, b in LAKES:
    th = np.arctan2((GZ - lz) / b, (GX - lx) / a)
    rr = np.hypot((GX - lx) / a, (GZ - lz) / b) / ((1 + 0.18 * np.sin(3 * th + 1)) * (1 + 0.2 * np.cos(2 * th)))
    m = (rr < 1) & land
    if not m.any(): continue
    rim = (rr >= 1) & (rr < 1.15) & land
    lvl = int(np.floor(np.percentile(Yf[rim], 10))) - 1 if rim.any() else SEA + 6
    depth = np.clip((1 - rr) * 9, 0, 7)
    Yf = np.where(m, np.minimum(Yf, lvl - 1 - depth), Yf)
    shore = (rr >= 1) & (rr < 1.35) & land
    Yf = np.where(shore, np.minimum(Yf, lvl + 1 + (rr - 1) * 12), Yf)   # gentle shore
    islake |= m; lakelevel[m] = lvl
    log("lake", name, "level", lvl)

# Blackfen pools: shallow black-water pools in the low fen, never on plots, towns or roads
fenpool = (reg == FEN) & land & ~keepclear & ~isriver & ~bank & (box((isroad | istrail).astype(np.float32), 6) < 0.01) & ~islake
pn = noise(18, 21) + noise(7, 22) * 0.5
fenpool &= (pn > 0.16) & (Yf < SEA + 9)
Yf = np.where(fenpool, np.minimum(Yf, SEA - 1 - (pn - 0.16) * 8), Yf)

# the ground each plot's story stands on (map/plotground.py): Harrowford's backwater, Lanternbog's island, Dunehold's
# oasis and dunes, Redmesa's mesa, Thistledown's knoll, Wolfcairn's edge, Frosthelm's copper crag, the Tidewatch inlet
# and the Gullcliff zawn. Never on a road, trail, bridge or the rail line (lines.json "roads" are the rail lines).
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import plotground
israil = raster(list(L["roads"].values()), lambda f: 7)
Yf, PG = plotground.shape(GX, GZ, Yf, land, isroad | istrail | roadbridge | israil | isriver, SEA)
pgwater = PG.water & ~islake & ~isriver
fenpool &= ~PG.water
log("plot ground:", int(pgwater.sum()), "water columns")

Y = np.round(Yf).astype(np.int32)
_dry = land & ~fenpool & ~islake & ~pgwater; Y[_dry] = np.maximum(Y[_dry], SEA + 1)   # one mask both sides (they differed by the plot ponds)
Y[~land] = np.minimum(Y[~land], SEA - 1)            # the sea bed stays under water (no grass specks at sea level)
Y[isriver] -= 3; Y[bank] -= 1
water_level = np.full((SIZE, SIZE), -999, np.int32)
water_level[~land] = SEA
water_level[isriver] = Y[isriver] + 2
water_level[fenpool] = SEA
water_level[islake] = lakelevel[islake]
water_level[pgwater] = PG.level[pgwater]
wet = water_level > Y

# ---------------------------------------------------------------- the seven thin places: designed land
# (Mateo 2026-11-12: "it's designing the actual map itself".) Each thin place gets its own land from
# map/thinplaces/shape.mjs, the one approved in the 3D view: a long barrow in a wet ditch, a mine escarpment, a
# gorge, a chalk headland with a flooded sinkhole, a flooded hollow, a salt pan, a stepped quarry pit. Fully shaped
# out to ~62 blocks, blended back into the plan by 96. Roads and rivers keep their ground; trails ride the new land.
# The add-on builds each cave into this land (undertow/thinplaces.js reads thin_land.js to know it is there).
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "thinplaces"))
from land import shape_sites, write_js
_riv = (isriver | bank).astype(np.float32)
_keep = np.maximum.reduce([np.clip(box(isroad.astype(np.float32), 8) * 6, 0, 1), np.clip(box(_riv, 30) * 8, 0, 1), _riv])
thin_shaped, THIN_BLOCKS, THIN_FACTS = shape_sites(Y, water_level, X0, Z0, _keep, log=log, pools=fenpool, paths=isroad | istrail)
if thin_shaped.any():
    Yf = np.where(thin_shaped, Y, Yf).astype(np.float32)     # slopes and steep faces are read from Yf further down
    wet = water_level > Y
    fenpool &= wet & ~thin_shaped                             # pools filled in near a place are gone; a place's own water is not a fen pool
    isroad &= ~(thin_shaped & wet); istrail &= ~(thin_shaped & wet)
    keepclear |= thin_shaped                                  # no map trees, plants or cave mouths on designed land
    if os.environ.get("GW_THIN_JS"): write_js(THIN_FACTS, os.environ["GW_THIN_JS"])   # refresh the add-on's copy (full map only)

# ---------------------------------------------------------------- road and trail bridges (the one bridge engine:
# .claude/skills/minecraft-builder/scripts/bridges.py). Mateo 2026-11-12: a bridge never runs into a field; each
# carries a paved approach onto land and is joined to its path. Rail bridges are built in game with the stretch
# (map/railworks.py, the rail "works").
MB_SCRIPTS = os.environ.get("MB_SCRIPTS") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".claude", "skills", "minecraft-builder", "scripts")
REGION_NAMES = {VALE: "Aldmere Vale", FROST: "Frostmarch", SALT: "Saltreach", FEN: "Blackfen", EMBER: "Emberwaste"}
BRIDGE_REGION = {VALE: "vale", FROST: "frostmarch", SALT: "saltreach", FEN: "blackfen", EMBER: "emberwaste"}
def _cl(v): return min(max(int(v), 0), SIZE - 1)
def ground_at(x, z): return int(Y[_cl(x - X0), _cl(z - Z0)])
def water_at(x, z):
    i, k = _cl(x - X0), _cl(z - Z0)
    return int(water_level[i, k]) if wet[i, k] else None
def region_at(x, z): return REGION_NAMES[int(reg[_cl(x - X0), _cl(z - Z0)])]
def inside(x, z): return 0 <= x - X0 < SIZE and 0 <= z - Z0 < SIZE
BRIDGE_BLOCKS = []                                # (x, y, z, bedrock name, states)
try:
    sys.path.insert(0, MB_SCRIPTS); import bridges as _bridges, emit as _emit
except ImportError:
    _bridges = None; log("bridges: the minecraft-builder bridge engine is not here, keeping plain road bridges")
if _bridges:
    _paths = isroad | istrail
    def _is_path(x, z):
        i, k = x - X0, z - Z0
        return 0 <= i < SIZE and 0 <= k < SIZE and bool(_paths[i, k])
    nb_ = 0
    for kind_, path_, lines_ in (("road", "road", roadlines), ("foot", "trail", list(L["trails"].values()))):
        for pts_ in lines_:
            for c_ in _bridges.find_crossings([tuple(p) for p in pts_], ground_at, water_at, kind_):
                if c_["water_y"] is None: continue           # roads follow the land; only water needs a bridge
                mx_, mz_ = (c_["a"][0] + c_["b"][0]) / 2, (c_["a"][1] + c_["b"][1]) / 2
                if not inside(int(mx_), int(mz_)): continue
                if keepclear[_cl(mx_ - X0), _cl(mz_ - Z0)]: continue   # towns and plots lay their own bridges
                c_.update(region=BRIDGE_REGION[int(reg[_cl(mx_ - X0), _cl(mz_ - Z0)])], path=path_, ground=ground_at)
                try: blocks_ = _bridges.bridge_blocks(c_)
                except Exception as e_: log("bridge failed", c_["a"], c_["b"], e_); continue
                for (x_, y_, z_), (n_, p_) in blocks_.items():
                    if n_ == "air": BRIDGE_BLOCKS.append((x_, y_, z_, "minecraft:air", {}))
                    else:
                        bn_, st_ = _emit.bedrock_state(n_, p_)
                        BRIDGE_BLOCKS.append((x_, y_, z_, bn_ if ":" in bn_ else "minecraft:" + bn_, st_))
                for end_ in c_.get("_ends", []):              # pave the gap from the approach to the path
                    for x_, z_ in _bridges.connect_to_paths(end_, _is_path):
                        if inside(x_, z_):
                            (isroad if kind_ == "road" else istrail)[x_ - X0, z_ - Z0] = True
                nb_ += 1; log("bridge", kind_, [round(v) for v in c_["a"]], "->", [round(v) for v in c_["b"]], c_["region"])
    roadbridge[:] = False
    log("bridges:", nb_, "road and trail bridges,", len(BRIDGE_BLOCKS), "blocks")

# ---------------------------------------------------------------- rail lines, planned block by block in advance
# (Mateo 2026-11-11: the track is laid out ahead of time and the game spawns it one stop at a time as routes are
# bought). The world gets the graded bed: ballast, benches, cuttings and embankments, tunnels where a hill is too
# deep to cut, bridges over water. No track blocks: map/rail-segments.json holds every segment's Track blocks
# (map/tracklay.py) and its stops for the train scripts.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import railplan
ORG = json.load(open(os.path.join(os.path.dirname(os.path.abspath(src)), 'organic.json')))
KS = tuple(ORG.get("kingsrest_station", PLAZA.get("Kingsrest", (-118, -118))))
STOPS = {}   # id -> dict
def slug(n): return re.sub(r"[^a-z0-9]+", "_", n.lower()).strip("_")
for n_, (sx_, sz_) in ORG["stations"].items(): STOPS[slug(n_)] = {"id": slug(n_), "name": n_, "x": sx_, "z": sz_, "kind": "plot", "plot": n_}
for n_, x_, z_, r_, _ in TOWNS:
    if n_ == "Kingsrest": x_, z_ = KS
    STOPS[slug(n_)] = {"id": slug(n_), "name": n_, "x": x_, "z": z_, "kind": "village"}
rail_y = np.full((SIZE, SIZE), -999, np.int32); rail_d = np.full((SIZE, SIZE), 99.0, np.float32)
rail_t = np.zeros((SIZE, SIZE), bool)          # the nearest line cell runs in a tunnel
RAIL_R = 48                                    # how far out the banks may reach
# Mateo 2026-11-12: no rail bed in the world. A line is only a plan (map/rail-segments.json) until a stretch is
# bought; then the game builds bed, earthworks and track together. RAIL_IN_WORLD=1 brings back the graded beds.
RAIL_IN_WORLD = os.environ.get("RAIL_IN_WORLD") == "1"
tun_floor = np.full((SIZE, SIZE), -999, np.int32); br_deck = np.full((SIZE, SIZE), -999, np.int32)
br_wall = np.zeros((SIZE, SIZE), bool); br_pier = np.zeros((SIZE, SIZE), bool)
RAILLINES = {}
def inside(x, z): return 0 <= x - X0 < SIZE and 0 <= z - Z0 < SIZE
def gy(x, z):
    i, k = x - X0, z - Z0
    if not (0 <= i < SIZE and 0 <= k < SIZE): return SEA + 4
    return int(max(Y[i, k], water_level[i, k] + 3)) if wet[i, k] else int(Y[i, k])
stop_y = {}
def stops_on(P): return [(sid, st) for sid, st in STOPS.items() if np.min(np.hypot(P[:, 0] - st["x"], P[:, 1] - st["z"])) < 30]
# Mateo 2026-11-12: railways on their own routes, laid out the way 19th-century lines were (gentle gradients along
# valleys and hillsides, long curves, stations at the edge of town), not beside the roads. The lines.json "roads"
# only say which stops each line serves and in what order; railroute places the stations and routes the track.
import railroute
_foot = {}                                         # how far out each stamped town's blocks reach
FIXED_ST = {}; FIXED_Y = {}                        # stations a town plan already stamped (<town>-plan.json beside it)
for fn_ in filter(None, os.environ.get("GW_BLOCKS", "").split(":")):
    d_ = json.load(open(fn_)); b_ = np.array(d_["blocks"], np.int64)[:, [0, 2]]
    _foot[d_["town"]] = b_
    pf_ = fn_.replace("-blocks.json", "-plan.json")
    if os.path.exists(pf_):
        for e_ in json.load(open(pf_)).get("buildings", []):
            if e_.get("kind") == "station":          # track along the stamp's local x at z 0, one above its ground
                FIXED_ST[slug(d_["town"])] = (int(e_["x"]), int(e_["z"]), "x" if int(e_.get("rotation", 0)) % 180 == 0 else "z")
                FIXED_Y[slug(d_["town"])] = int(e_["ground_y"]) + 1
log("rail: stations stamped by town plans", FIXED_ST)
SEQ = {}                                           # a stop is on a line if its old spot or its stamped station is
for lname, pts in L["roads"].items():              # near the line's lines.json road
    P = np.asarray(pts, float); on_ = []
    for sid, st in STOPS.items():
        spots_ = [(st["x"], st["z"])] + ([FIXED_ST[sid][:2]] if sid in FIXED_ST else [])
        dd_ = [np.hypot(P[:, 0] - sx_, P[:, 1] - sz_) for sx_, sz_ in spots_]
        k_ = min(range(len(dd_)), key=lambda j: dd_[j].min())
        if dd_[k_].min() < 30: on_.append((int(np.argmin(dd_[k_])), sid))
    SEQ[lname] = [sid for _, sid in sorted(on_)]
for sid_, (x_, z_, _) in FIXED_ST.items(): STOPS[sid_].update({"x": x_, "z": z_})
log("rail: line stops", SEQ)
R_TOWNS = []
for n_, x_, z_, r_, _ in TOWNS:
    if n_ in _foot: R_ = int(np.hypot(_foot[n_][:, 0] - x_, _foot[n_][:, 1] - z_).max()) + 6
    else: R_ = int(r_ * 1.12) + 10
    R_TOWNS.append((slug(n_), x_, z_, R_))
AVOID = [(x_, z_, 82) for _, x_, z_ in PLOTS] + [(x_, z_, int(r_ * 0.7)) for _, x_, z_, r_, _ in WARDS[6:]]
if os.environ.get("GW_SITES", "1") != "0" and shutil.which("node"):   # and the boss sites' whole areas (baked below)
    _ba = json.loads(__import__("subprocess").check_output(["node", os.path.join(os.path.dirname(os.path.abspath(__file__)), "bake_sites.mjs"), "--anchors"]))
    AVOID += [(a_["x"], a_["z"], int(_ba["reach"][s_])) for s_, a_ in _ba["anchors"].items() if s_ not in ("reeve", "mirelight")]
if os.environ.get("GW_RAIL_KEEP"):
    # GW_RAIL_KEEP=map/rail-segments.json: keep that export's stations and routes (the towns, station roads and
    # world were built round them) and only re-raster, re-profile and re-plan the works along them
    _kp = json.load(open(os.environ["GW_RAIL_KEEP"]))
    STATION_POS, LINE_PTS = {}, {}
    for st_ in _kp["stops"]:
        d_ = next((b_[4] for g_ in _kp["segments"] for b_ in g_["blocks"] if (b_[0], b_[2]) == (st_["x"], st_["z"]) and b_[3] == 0), 2)
        STATION_POS[st_["id"]] = (st_["x"], st_["z"], "x" if d_ % 4 == 2 else "z"); stop_y[st_["id"]] = st_["y"]
    # GW_RAIL_ROUTE=<an older export with the same stations>: take the routes (the line before straightening) from it
    _rt = json.load(open(os.environ["GW_RAIL_ROUTE"])) if os.environ.get("GW_RAIL_ROUTE") else _kp
    for g_ in _rt["segments"]:
        pts_ = LINE_PTS.setdefault(g_["line"], [])
        cl_ = [(b_[0], b_[2]) for b_ in g_["blocks"]]
        pts_ += cl_ if not pts_ else cl_[1:]
    log("rail: kept the stations and routes of", os.environ["GW_RAIL_KEEP"])
else:
    STATION_POS, LINE_PTS = railroute.plan_network(Y, wet, land, X0, Z0, STOPS, SEQ, R_TOWNS, AVOID, log=log, fixed=FIXED_ST)
stop_y.update(FIXED_Y)
for sid_, (x_, z_, _) in STATION_POS.items(): STOPS[sid_].update({"x": x_, "z": z_})
# a station road (towns thread 2026-11-13): a village station the map placed itself gets a 5-wide road from the
# platform's town side to the town's nearest street end (a paved groundwork cell of its plan). Stamped stations
# (FIXED_ST) already come with their own street.
_paved = ("slab", "path", "gravel", "cobblestone", "stone_bricks", "sandstone")
for n_, tx_, tz_, _r, _ in TOWNS:
    sid_ = slug(n_)
    if sid_ in FIXED_ST or sid_ not in STATION_POS: continue
    fn_ = next((f for f in filter(None, os.environ.get("GW_BLOCKS", "").split(":")) if json.load(open(f)).get("town") == n_), None)
    if not fn_: continue
    d_ = json.load(open(fn_)); pal_ = d_["palette"]; gw_ = d_["groundwork_blocks"]
    sx_, sz_, ax_ = STATION_POS[sid_]; ax_ = ax_[-1]
    px_, pz_ = (0, 1) if ax_ == "x" else (1, 0)                    # across the track, toward the town
    if (tx_ - sx_) * px_ + (tz_ - sz_) * pz_ < 0: px_, pz_ = -px_, -pz_
    fx_, fz_ = sx_ + px_ * 4, sz_ + pz_ * 4
    top_ = {}
    for x_, y_, z_, i_ in d_["blocks"][:gw_]:                  # the top solid block (air entries only dig out)
        if "air" not in pal_[i_]["name"] and y_ >= top_.get((x_, z_), (-999, ""))[0]: top_[(x_, z_)] = (y_, pal_[i_]["name"])
    ends_ = [(math.hypot(x_ - fx_, z_ - fz_), x_, z_) for (x_, z_), (_, nm_) in top_.items()
             if any(w_ in nm_ for w_ in _paved) and "wall" not in nm_ and (x_ - sx_) * px_ + (z_ - sz_) * pz_ > 4]
    if not ends_: continue
    _, ex_, ez_ = min(ends_)
    rd_ = raster([[(fx_, fz_), (ex_, ez_)]], lambda f: 5) & land & ~isriver
    isroad |= rd_; istrail &= ~rd_
    log("station road", n_, (fx_, fz_), "->", (ex_, ez_), int(rd_.sum()), "cells")
# GW_RAIL_PLAIN="x,z;x,z;...": spots where the line keeps its routed cells exactly, 30 blocks round each (where the
# real-map lay test, tools/rail_lay_test.mjs, found the straightened line running along a road, a bridge's works or
# under an overhang, and the routed one laid clean)
RAIL_PLAIN = [tuple(map(int, p_.split(","))) for p_ in os.environ.get("GW_RAIL_PLAIN", "").split(";") if p_.strip()]
def _rail_blocked(x, z):
    """Ground the line was routed round (towns, plots, story sites), and the GW_RAIL_PLAIN spots: the straightener
    keeps out of it and leaves the routed cells there as they are."""
    return (any(math.hypot(x - ax_, z - az_) < ar_ for ax_, az_, ar_ in AVOID) or any(math.hypot(x - tx_, z - tz_) < tr_ for _, tx_, tz_, tr_ in R_TOWNS)
            or any(math.hypot(x - px_, z - pz_) < 30 for px_, pz_ in RAIL_PLAIN))
for lname in SEQ:
    pts = LINE_PTS[lname]
    on = [(sid, STOPS[sid]) for sid in SEQ[lname]]
    stops_ = [(st["x"], st["z"], STATION_POS[sid][2][-1]) for sid, st in on]
    # GW_RAIL_EXACT=1 (with GW_RAIL_KEEP): the kept export's track cells exactly as they are, only heights and works re-fitted
    cells, si = railplan.trace(pts, stops_, routed=True, blocked=_rail_blocked, straighten=os.environ.get("GW_RAIL_EXACT") != "1")
    order = sorted(range(len(on)), key=lambda k: si[k]); on = [on[k] for k in order]; si = [si[k] for k in order]
    ground = [gy(x, z) for x, z in cells]
    for (sid, st), i in zip(on, si):
        if sid not in stop_y:
            seg = ground[max(0, i - railplan.PLATFORM):i + railplan.PLATFORM + 1]
            stop_y[sid] = int(round(float(np.median(seg)))) + 1
    # inside towns (and just outside) the track hugs the ground the streets were planned on
    hold = np.ones(len(cells))
    for tn_, tx_, tz_, tr_, _ in TOWNS:
        dd_ = np.hypot(np.array([c[0] for c in cells]) - tx_, np.array([c[1] for c in cells]) - tz_)
        hold = np.maximum(hold, np.where(dd_ < tr_ + 30, 6.0, 1.0))
    ys = railplan.profile_dp(cells, ground, si, stop_y=[stop_y[sid] for sid, _ in on], weight=hold)
    RAILLINES[lname] = (cells, ys, [(sid, i) for (sid, _), i in zip(on, si)])
    for sid, _ in on: STOPS[sid].setdefault("lines", []).append(lname)
    # per path cell: tunnel where the hill stands more than 10 over the bed (6 over a 4-high bore), bridge over water
    cx = np.array([c[0] for c in cells]) - X0; cz = np.array([c[1] for c in cells]) - Z0; ys_ = np.asarray(ys)
    okc = (cx >= 0) & (cx < SIZE) & (cz >= 0) & (cz < SIZE)
    gnd = np.where(okc, Y[np.clip(cx, 0, SIZE - 1), np.clip(cz, 0, SIZE - 1)], ys_)
    wt = np.where(okc, wet[np.clip(cx, 0, SIZE - 1), np.clip(cz, 0, SIZE - 1)], False)
    tun = (gnd - (ys_ - 1) > 10) & ~wt
    tun = np.convolve(tun.astype(float), np.ones(7) / 7, 'same') > 0.5
    run0 = None                                                          # no tunnel shorter than 15 blocks: cut it open
    for i_ in range(len(tun) + 1):
        if i_ < len(tun) and tun[i_]:
            run0 = i_ if run0 is None else run0
        elif run0 is not None:
            if i_ - run0 < 15: tun[run0:i_] = False
            run0 = None
    wtd = np.convolve(wt.astype(float), np.ones(7), 'same') > 0          # a few blocks of approach either side
    # paint the corridor: nearest path cell's track height for every cell within RAIL_R blocks
    R = RAIL_R; off = np.array([(a, b) for a in range(-R, R + 1) for b in range(-R, R + 1)]); od = np.hypot(off[:, 0], off[:, 1])
    keep_ = od <= R; off, od = off[keep_], od[keep_]
    for c0 in range(0, len(cells), 300):
        sl = slice(c0, c0 + 300)
        X_ = (cx[sl, None] + off[None, :, 0]).ravel(); Z_ = (cz[sl, None] + off[None, :, 1]).ravel()
        D_ = np.broadcast_to(od[None, :], (len(cx[sl]), len(od))).ravel(); Yv = np.broadcast_to(ys_[sl, None], (len(cx[sl]), len(od))).ravel()
        T_ = np.broadcast_to(tun[sl, None], (len(cx[sl]), len(od))).ravel(); W_ = np.broadcast_to(wtd[sl, None], (len(cx[sl]), len(od))).ravel()
        m = (X_ >= 0) & (X_ < SIZE) & (Z_ >= 0) & (Z_ < SIZE)
        X_, Z_, D_, Yv, T_, W_ = X_[m], Z_[m], D_[m], Yv[m], T_[m], W_[m]
        np.minimum.at(rail_d, (X_, Z_), D_.astype(np.float32))
        win = D_ <= rail_d[X_, Z_] + 1e-4
        rail_y[X_[win], Z_[win]] = Yv[win]; rail_t[X_[win], Z_[win]] = T_[win]
        if not RAIL_IN_WORLD: continue
        t2 = win & T_ & (D_ <= 2.5); tun_floor[X_[t2], Z_[t2]] = Yv[t2] - 1
        b2 = win & W_ & (D_ <= 2.5); br_deck[X_[b2], Z_[b2]] = Yv[b2] - 1
        br_wall[X_[b2 & (D_ > 1.5)], Z_[b2 & (D_ > 1.5)]] = True
    for i in range(0, len(cells), 8):
        if okc[i] and wt[i] and RAIL_IN_WORLD: br_pier[cx[i], cz[i]] = True
# earthworks on land (Mateo 2026-11-11: grade the land round paths, no sheer trenches). The bed and the road
# beside it are laid first as one flat bench at track level; then banks slope back from the bench edge to the
# natural ground, about 3 up for every 4 out with a little noise, as far out as they need (up to RAIL_R), for
# cuttings and embankments alike. Banks are measured from the open bench, so over a tunnel the hill is left whole.
# Tunnels (see the line loop: at least 6 blocks of hill over a 4-high bore, 15+ blocks long) keep their hill whole:
# nothing is cut over the bore or beside it, so the cutting ends at a portal face; everywhere else is open to the sky.
bed = rail_y - 1
bore = tun_floor > -999
corr = (rail_d <= RAIL_R) & land & ~wet & ~bore & (br_deck == -999) & RAIL_IN_WORLD
flat_ = corr & ((rail_d <= 3.5) | (isroad & (rail_d <= ROADOFF + 5))) & ~rail_t   # over a tunnel the road keeps to the hill
Y[flat_] = bed[flat_]
dF = chamfer_b(flat_, RAIL_R)
rbank = np.floor(dF * 0.75 + np.maximum(dF - 20, 0) * 0.5 + (noise(7, 91) + 0.5) * 1.5).astype(np.int32)   # steeper, rockier far up
slope_ = corr & ~flat_
cut = slope_ & ~rail_t & (Y > bed + rbank); Y[cut] = (bed + rbank)[cut]
fill = slope_ & (Y < bed - rbank); Y[fill] = (bed - rbank)[fill]
# tunnel lining: stone brick walls and roof round the bore, which also make the portal faces
tun_wall = np.zeros((SIZE, SIZE), bool); tun_wall_y = np.full((SIZE, SIZE), -999, np.int32)
_tb = tun_floor > -999
if _tb.any():
    _nb = box(_tb.astype(np.float32), 1) > 0
    tun_wall = _nb & ~_tb & (rail_d <= 4.5) & land & ~wet
    _tf = tun_floor.copy()
    for _ in range(2):                                         # walls take the floor level of the bore beside them
        p_ = np.pad(_tf, 1, constant_values=-999)
        _tf = np.where(_tf > -999, _tf, np.maximum.reduce([p_[:-2, 1:-1], p_[2:, 1:-1], p_[1:-1, :-2], p_[1:-1, 2:]]))
    tun_wall_y = np.where(tun_wall, _tf, -999); tun_wall &= tun_wall_y > -999
# baked town plans (GW_BLOCKS, map/bake_town.py): paths first, then the land graded to them (Mateo 2026-11-11).
# Every groundwork column sits on ground exactly one block under its lowest block; the land beside it meets its top
# ground block and may then rise or fall at most one block per two outwards, so no path stands proud or sinks in a trench.
# the ground as it stands before any town plan is laid (rails, roads and their banks done): town generators plan on this
np.save(out.rstrip('/') + '-heights-pretown.npy', Y.astype(np.int16))
GW_FILES = [json.load(open(fn_)) for fn_ in filter(None, os.environ.get("GW_BLOCKS", "").split(":"))]
for d_ in GW_FILES:
    b_ = np.array(d_["blocks"][:d_.get("groundwork_blocks", len(d_["blocks"]))], np.int64)
    air_ = np.array([e["name"] == "minecraft:air" for e in d_["palette"]])[b_[:, 3]]
    gx_, gz_ = b_[:, 0] - X0, b_[:, 2] - Z0
    ok_ = (gx_ >= 0) & (gx_ < SIZE) & (gz_ >= 0) & (gz_ < SIZE)
    if not ok_.any(): continue
    T_ = np.full((SIZE, SIZE), 9999, np.int32)
    np.minimum.at(T_, (gx_[ok_ & ~air_], gz_[ok_ & ~air_]), b_[ok_ & ~air_, 1].astype(np.int32) - 1)
    Ta = np.full((SIZE, SIZE), 9999, np.int32)
    np.minimum.at(Ta, (gx_[ok_ & air_], gz_[ok_ & air_]), b_[ok_ & air_, 1].astype(np.int32) - 1)
    T_ = np.where(T_ == 9999, Ta, T_)
    # the level the land beside each column meets: its top ground block (a sunken path slab, a field's farmland,
    # a plot's floor), not crops, fences or the air dug out above it
    over_ = np.array([any(w in e["name"] for w in ("wheat", "carrots", "potatoes", "beetroot", "fence", "_wall", "hay_block", "air"))
                      for e in d_["palette"]])[b_[:, 3]]
    Tt = np.full((SIZE, SIZE), -9999, np.int32)
    np.maximum.at(Tt, (gx_[ok_ & ~over_], gz_[ok_ & ~over_]), b_[ok_ & ~over_, 1].astype(np.int32))
    Tt = np.where(Tt == -9999, T_, Tt)
    foot = (T_ < 9999) & ~wet
    Y[foot] = T_[foot]
    xs_, zs_ = np.nonzero(foot); M_ = 70
    a0_, a1_ = max(0, xs_.min() - M_), min(SIZE, xs_.max() + M_ + 1); c0_, c1_ = max(0, zs_.min() - M_), min(SIZE, zs_.max() + M_ + 1)
    f_ = foot[a0_:a1_, c0_:c1_]
    Dn = np.where(f_, 0.0, np.inf); Vn = Tt[a0_:a1_, c0_:c1_].astype(np.int32).copy()
    for _ in range(M_):                                       # distance to, and level of, the nearest groundwork column
        for dx_, dz_, w_ in ((1, 0, 1), (-1, 0, 1), (0, 1, 1), (0, -1, 1), (1, 1, 1.5), (1, -1, 1.5), (-1, 1, 1.5), (-1, -1, 1.5)):
            cand = np.roll(np.roll(Dn, dx_, 0), dz_, 1) + w_
            b2_ = cand < Dn
            if b2_.any(): Dn[b2_] = cand[b2_]; Vn[b2_] = np.roll(np.roll(Vn, dx_, 0), dz_, 1)[b2_]
    Yw = Y[a0_:a1_, c0_:c1_]
    free = ~f_ & ~wet[a0_:a1_, c0_:c1_] & land[a0_:a1_, c0_:c1_] & ((rail_d[a0_:a1_, c0_:c1_] > 4.5) | (not RAIL_IN_WORLD)) & np.isfinite(Dn)
    slack = np.floor(np.where(np.isfinite(Dn), Dn, 0) / 2).astype(np.int32)      # one block up or down per two out
    Yw[free] = np.clip(Yw[free], (Vn - slack)[free], (Vn + slack)[free]); Y[a0_:a1_, c0_:c1_] = Yw
    for sx_, sz_, sy_ in d_.get("tree_seats", []):            # the town's own trees stand on the ground they were planned on
        i_, k_ = sx_ - X0, sz_ - Z0
        if 1 <= i_ < SIZE - 1 and 1 <= k_ < SIZE - 1:
            w_ = (slice(i_ - 1, i_ + 2), slice(k_ - 1, k_ + 2)); m_ = ~foot[w_] & ~wet[w_]
            Y[w_][m_] = sy_
    log("graded the land to", d_["town"], "groundwork:", int(foot.sum()), "columns")
railcore = (rail_d <= 1.5) & ~wet & (tun_floor == -999) & (br_deck == -999) & RAIL_IN_WORLD
railzone = (rail_d <= 4.5) & RAIL_IN_WORLD
# the planned lines keep trees off even with no bed in the world (playtest 2026-11-12: trees stood on the lines, and
# the track the game lays went round their roots and branches): no trunk within 8 of a line, no crown over its bed
# and graded sides (the game grades 5 out, rail_bed.js)
railkeep = rail_d <= 6.5
log("rail lines", len(RAILLINES), "stops", len(STOPS), "tunnel cells", int((tun_floor > -999).sum()), "bridge cells", int((br_deck > -999).sum()))
# the export: stops (the track block where trains stop, mid-platform) and segments between neighbouring stops,
# sharing their end blocks
try:
    from tracklay import lay
except ImportError:
    lay = None
try:
    import railworks
except ImportError:
    railworks = None
try:
    import railcross              # level crossings where roads and trails cross a line (Mateo 2026-11-13)
except ImportError:
    railcross = None
# one height for track two lines share (playtest 2026-11-12: Millbrook's Oakmere branch ran its shared platform a
# block above the North line's, so buying it stacked a second track on the first): the first line keeps its heights
import railshare
_ln = list(RAILLINES)
for n_, ys_h in zip(_ln, railshare.harmonise([([tuple(map(int, c)) for c in RAILLINES[n_][0]], RAILLINES[n_][1]) for n_ in _ln])):
    RAILLINES[n_] = ([tuple(map(int, c)) for c in RAILLINES[n_][0]], ys_h, RAILLINES[n_][2])
segs = []
_alltrack = {tuple(map(int, c)) for cells_, _, _ in RAILLINES.values() for c in cells_}
_plotstops = [(st_["x"], st_["z"]) for st_ in STOPS.values() if st_["kind"] == "plot" and "x" in st_]
def _pathw(x, z):
    i, j = _cl(x - X0), _cl(z - Z0)
    return 5 if isroad[i, j] else 3 if istrail[i, j] else 0
def _hutfree(x, z):
    i, j = _cl(x - X0), _cl(z - Z0)
    return bool(land[i, j] and not (isriver[i, j] or isroad[i, j] or istrail[i, j] or townzone[i, j] or plotzone[i, j]))
for lname, (cells, ys, stops_on) in RAILLINES.items():
    path = [(x, int(y), z) for (x, z), y in zip(cells, ys)]
    blocks = None
    if lay:
        try: blocks = [[b[0], b[1], b[2], b[3]["siege:kind"], b[3]["siege:dir"]] for b in lay(path)]
        except ValueError as e: log("tracklay refused", lname, e)
    for (sa, ia), (sb, ib) in zip(stops_on, stops_on[1:]):
        part = blocks[ia:ib + 1] if blocks else [[x, y, z] for x, y, z in path[ia:ib + 1]]
        seg_ = {"id": f"{sa}__{sb}", "line": lname, "from": sa, "to": sb, "length": ib - ia, "blocks": part}
        if railworks and blocks:          # bridges, viaducts, tunnels and earthworks the plain bed can't do
            try:
                w_, wp_, cu_ = railworks.segment_works([(b[0], b[2]) for b in part], [b[1] for b in part], ground_at, water_at, region_at, log=log)
                if w_: seg_.update(works=w_, works_palette=wp_, custom=cu_)
            except Exception as e_: log("rail works failed", seg_["id"], e_)
        if railcross and blocks:
            try:
                xs_ = railcross.segment_crossings([(b[0], b[2]) for b in part], [b[1] for b in part], _pathw, region_at, log=log,
                                                  custom=seg_.get("custom", []), side_free=_hutfree, lines=_alltrack, stations=_plotstops)
                if xs_: seg_["crossings"] = xs_
            except Exception as e_: log("rail crossings failed", seg_["id"], e_)
        segs.append(seg_)
    for sid, i in stops_on:
        x, y, z = path[i]; STOPS[sid].update({"x": x, "y": y, "z": z})
used = {s for g in segs for s in (g["from"], g["to"])}
for st in STOPS.values():
    if st["kind"] == "village" and len(st.get("lines", [])) > 1: st["junction"] = True
json.dump({"format": "hollow-crown-rail/1", "note": "Track is not in the world: the game lays a segment's blocks when its route is bought. blocks = [x, y, z, siege:kind, siege:dir]; y is the block the track sits in.",
           "stops": [st for st in STOPS.values() if st["id"] in used], "segments": segs}, open(out.rstrip('/') + '-rail-segments.json', 'w'))
log("rail segments", len(segs), "with track" if lay else "(paths only: map/tracklay.py not found)")
steep = np.maximum(np.abs(np.gradient(Yf, axis=0)), np.abs(np.gradient(Yf, axis=1))) > 1.6
coast = (box((~land).astype(np.float32), 14) > 0.02) & land
log("heights ready, max", int(Y.max()), "min", int(Y.min()))
np.save(out.rstrip('/') + '-heights.npy', Y.astype(np.int16))   # final ground heights [x, z], for the 3D viewer

# ---------------------------------------------------------------- world file
if os.path.exists(out): shutil.rmtree(out)
w = LevelDBFormat(out); w.create_and_open("bedrock", VER, overwrite=True)
rt = w.root_tag.compound if hasattr(w.root_tag, 'compound') else w.root_tag
def setk(k, v):
    try: rt[k] = v
    except Exception as e: print('level.dat', k, e)
spawn = (-118, -118)
sy = int(Y[spawn[0] - X0, spawn[1] - Z0]) + 3 if (0 <= spawn[0] - X0 < SIZE and 0 <= spawn[1] - Z0 < SIZE) else 120
setk("LevelName", StringTag("The Hollow Crown map")); setk("GameType", IntTag(1)); setk("commandsEnabled", ByteTag(1))
setk("Generator", IntTag(2)); setk("SpawnX", IntTag(spawn[0])); setk("SpawnZ", IntTag(spawn[1])); setk("SpawnY", IntTag(sy))
setk("spawnMobs", ByteTag(0)); setk("dodaylightcycle", ByteTag(0)); setk("Time", LongTag(6000))
try: w.root_tag = w.root_tag
except Exception as e: print('root_tag set', e)
w.save(); w.close()
level = amulet.load_level(out)
ver = level.translation_manager.get_version("bedrock", VER)
def B(name, props=None):
    u = ver.block.to_universal(Block("minecraft", name, props or {}))[0]; return level.block_palette.get_add_block(u)
LEAF = {"persistent_bit": ByteTag(1), "update_bit": ByteTag(0)}
NAMES = ["stone", "grass_block", "dirt", "water", "sand", "gravel", "bedrock", "cobblestone", "grass_path", "stone_bricks",
         "gold_block", "mossy_cobblestone", "coarse_dirt", "oak_log", "birch_log", "spruce_log", "mangrove_log", "dark_oak_log",
         "acacia_log", "clay", "andesite", "granite", "diorite", "tuff", "deepslate", "calcite", "red_sand", "sandstone",
         "red_sandstone", "hardened_clay", "mud", "moss_block", "podzol", "packed_ice", "ice", "snow", "cactus", "mangrove_roots",
         "muddy_mangrove_roots", "lava", "fern", "short_grass", "dandelion", "poppy", "deadbush", "waterlily", "cobbled_deepslate",
         "coal_ore", "iron_ore", "copper_ore", "gold_ore", "redstone_ore", "lapis_ore", "diamond_ore", "emerald_ore",
         "deepslate_coal_ore", "deepslate_iron_ore", "deepslate_copper_ore", "deepslate_gold_ore", "deepslate_redstone_ore",
         "deepslate_lapis_ore", "deepslate_diamond_ore", "deepslate_emerald_ore", "sweet_berry_bush", "seagrass",
         "orange_terracotta", "red_terracotta", "yellow_terracotta", "white_terracotta", "brown_terracotta", "light_gray_terracotta", "bone_block", "moss_carpet",
         "raw_iron_block", "raw_copper_block"]
ID = {n: B(n) for n in NAMES}
for lf in ["oak", "birch", "spruce", "mangrove", "dark_oak", "acacia"]: ID[lf + "_leaves"] = B(lf + "_leaves", LEAF)
ID["snow_layer"] = B("snow_layer", {"height": IntTag(0), "covered_bit": ByteTag(0)})
AIR = level.block_palette.get_add_block(ver.block.to_universal(Block("minecraft", "air"))[0])
assert max(ID.values()) < 65535
BIO = {n: level.biome_palette.get_add_biome(ver.biome.to_universal("minecraft:" + n)) for n in
       ["plains", "forest", "river", "ice_plains", "frozen_river", "stone_beach", "mangrove_swamp", "desert", "ocean", "beach", "cold_ocean"]}
log("palette ready")

# ---------------------------------------------------------------- 2D block choices
r1 = rng.random((SIZE, SIZE)); r2 = rng.random((SIZE, SIZE))
n_patch = noise(14, 31); n_patch2 = noise(6, 32)
surf = np.full((SIZE, SIZE), ID["grass_block"], np.uint16)
sub = np.full((SIZE, SIZE), ID["dirt"], np.uint16)
subd = np.full((SIZE, SIZE), 4, np.int32)
R = [reg == i for i in range(5)]
# Vale: grass, coarse dirt patches
m = R[VALE] & (n_patch > 0.36) & (r2 < 0.7); surf[m] = ID["coarse_dirt"]
# Frostmarch: grass under snow, bare stone and snow block on the heights, podzol in the woods
m = R[FROST] & (forest > 0.05) & (n_patch2 > 0.1); surf[m] = ID["podzol"]
# mountains (Mateo 2026-11-11: they need texture): rock and scree on the slopes, snow only near the tops
slope = np.maximum(np.abs(np.gradient(Yf, axis=0)), np.abs(np.gradient(Yf, axis=1)))
snowline = 168 + noise(40, 41) * 30
rocky = (Y > 100) & (slope > 0.6) & ~R[EMBER] & ~chalk
m = rocky; pick_ = r1 + n_patch2 * 0.8
surf[m] = np.select([pick_[m] < 0.45, pick_[m] < 0.65, pick_[m] < 0.8, pick_[m] < 0.9], [ID["stone"], ID["andesite"], ID["gravel"], ID["cobblestone"]], ID["tuff"]); sub[m] = ID["stone"]
m = rocky & (Y > 130) & (r2 < 0.12) & R[FROST]; surf[m] = ID["calcite"]
m = R[FROST] & (Y > snowline) & (slope < 0.9); surf[m] = np.select([r2[m] < 0.86, r2[m] < 0.93], [ID["snow"], ID["stone"]], ID["gravel"]); sub[m] = ID["stone"]   # no packed-ice speckle: it reads as blue dots (Mateo 2026-11-12)
m = R[FROST] & (Y > snowline + 22) & (slope < 1.4); surf[m] = ID["snow"]
# tundra between the woods and the peaks: grass, podzol, coarse dirt and stony patches, snow lying only in drifts
m = R[FROST] & ~rocky & (Y > 100) & (Y < snowline) & (surf == ID["grass_block"]); tp = n_patch * 1.4 + (r1 - 0.5) * 0.4
surf[m] = np.select([tp[m] < -0.25, tp[m] < 0.0, tp[m] < 0.3], [ID["coarse_dirt"], ID["grass_block"], ID["podzol"]], ID["gravel"])
snowcover = R[FROST] & ((Y + noise(30, 42) * 50 + (r1 - 0.5) * 8 > 128) | ((forest > 0.05) & (Y > 95))) & ~(rocky & (Y < snowline))
# Saltreach: stony shore, gravel and coarse ground
m = R[SALT] & coast & (r1 < 0.55); surf[m] = np.where(r2[m] < 0.5, ID["stone"], ID["gravel"])
m = R[SALT] & ~coast & (n_patch > 0.22); surf[m] = np.where(r2[m] < 0.5, ID["coarse_dirt"], ID["stone"])
# Blackfen: grass, mud, moss and podzol in patches
m = R[FEN]; pick = n_patch * 1.6 + (r1 - 0.5) * 0.5
surf[m] = np.select([pick[m] < -0.25, pick[m] < 0.05, pick[m] < 0.35], [ID["mud"], ID["grass_block"], ID["moss_block"]], ID["podzol"])
sub[m] = np.where(r2[m] < 0.6, ID["mud"], ID["dirt"])
# Emberwaste: sand over sandstone, red sand drifts
m = R[EMBER]; red = (noise(90, 33) + n_patch * 0.35 + n_patch2 * 0.15) > 0.12
surf[m] = np.where(red[m], ID["red_sand"], ID["sand"]); sub[m] = np.where(red[m], ID["red_sandstone"], ID["sandstone"]); subd[m] = 6
# fine ground mix (Mateo 2026-11-12, of the Cradle Tree's ground: "That needs to be everywhere"). The patches above set
# each region's ground in broad strokes; this speckles single blocks of the region's other grounds through them, so no
# stretch reads as one flat colour. Picked by a hash of the world position (no rng draws, so trees and caves stay put,
# and any slice of the map gets the same blocks), and faded out on plots and towns so their edges still blend.
def hash01(seed):
    h = (GX.astype(np.int64) * 73856093) ^ (GZ.astype(np.int64) * 19349663) ^ np.int64(seed * 83492791)
    h = (h ^ (h >> 13)) * np.int64(1274126177); h = h ^ (h >> 16)
    return (h & 0xFFFFFF).astype(np.float32) / 16777216.0
def mix(m, h, opts):
    """A weighted pick per cell of mask m from opts = [(block, weight)]; a weight may be a map-sized array."""
    w = [np.broadcast_to(np.asarray(wt[m] if np.ndim(wt) == 2 else wt, np.float32), (int(m.sum()),)) for _, wt in opts]
    hv = h[m] * sum(w); acc = np.zeros_like(hv); out = np.full(hv.shape, ID[opts[-1][0]], np.uint16)
    for (n, _), wi in zip(opts, w):
        out = np.where((hv >= acc) & (hv < acc + wi), ID[n], out); acc = acc + wi
    return out
hs, hp = hash01(11), hash01(12)
speck = plotfade * (1 - np.clip(box(townzone.astype(np.float32), 10) * 3, 0, 1))      # 0 on plots and in towns
soft = land & ~wet & ~isroad & ~istrail & ~steep & ~rocky & ~chalk
def sprinkle(m, p, opts):
    m = m & soft & (hp < p * speck)
    if m.any(): surf[m] = mix(m, hs, opts)
woods = forest > 0.05
sprinkle(R[VALE] & (surf == ID["grass_block"]), 0.3, [("grass_block", 4), ("coarse_dirt", 2), ("podzol", np.where(woods, 3, 1)), ("moss_block", 1), ("gravel", 0.4)])
sprinkle(R[VALE] & (surf == ID["coarse_dirt"]), 0.45, [("grass_block", 4), ("podzol", 1), ("gravel", 1), ("dirt", 1)])
sprinkle(R[FEN], 0.45, [("grass_block", 7), ("moss_block", 3), ("podzol", 2), ("mud", 1), ("muddy_mangrove_roots", 1)])   # the Cradle's own mix
sprinkle(R[SALT] & ~coast, 0.35, [("grass_block", 3), ("gravel", 2), ("coarse_dirt", 1), ("stone", 1)])
sprinkle(R[FROST] & (Y < snowline), 0.3, [("grass_block", 3), ("podzol", 2), ("coarse_dirt", 2), ("gravel", 1), ("stone", 1), ("snow", 1)])
sprinkle(R[EMBER] & (surf == ID["sand"]), 0.1, [("sandstone", 3), ("red_sand", 1), ("gravel", 0.3)])
sprinkle(R[EMBER] & (surf == ID["red_sand"]), 0.1, [("red_sandstone", 3), ("sand", 1), ("coarse_dirt", 0.5)])
# steep ground shows rock (banded terracotta in the Emberwaste, calcite streaks in the north)
m = steep & ~R[EMBER]; surf[m] = np.where(r1[m] < 0.5, ID["stone"], np.where(R[FROST][m] & (r2[m] < 0.15), ID["calcite"], ID["andesite"]))
mesa = R[EMBER] & (steep | (Y > 112))
# chalk cliffs: grass right to the edge over a thin soil, white where a column stands below its neighbours (faces,
# ledges), flint shingle with fallen chalk blocks at the foot, and a pale platform of chalk, weed and gravel under the water
# plot ground (map/plotground.py): dune and beach sand, the Gullcliff zawn's chalk, copper in the Frosthelm crag
m = PG.sand & ~wet & land; surf[m] = np.where(R[EMBER][m] & (r2[m] < 0.3), ID["red_sand"], ID["sand"]); sub[m] = ID["sandstone"]
chalk |= PG.chalk & land; chalktop = np.where(PG.chalk, PG.top, chalktop)
m = PG.turf & ~wet & land & ~steep; surf[m] = np.where(r1[m] < 0.85, ID["grass_block"], ID["coarse_dirt"]); sub[m] = ID["dirt"]; subd[m] = 3
m = PG.copper & ~wet & (steep | (slope > 0.9)); surf[m] = np.select([r1[m] < 0.3, r1[m] < 0.55, r1[m] < 0.75], [ID["copper_ore"], ID["stone"], ID["andesite"]], ID["tuff"]); sub[m] = ID["stone"]; subd[m] = 1
pY = np.pad(Y, 1, mode='edge'); nbmax = np.maximum.reduce([pY[:-2, 1:-1], pY[2:, 1:-1], pY[1:-1, :-2], pY[1:-1, 2:]])
m = chalk & ~wet; surf[m] = np.where((Y[m] >= nbmax[m] - 1) & (Y[m] >= chalktop[m] - 3), ID["grass_block"], np.where(r1[m] < 0.8, ID["calcite"], ID["gravel"])); subd[m] = 1
m = chalkfoot & ~wet; surf[m] = np.select([r1[m] < 0.65, r1[m] < 0.75, r1[m] < 0.85, r1[m] < 0.95], [ID["gravel"], ID["cobblestone"], ID["andesite"], ID["calcite"]], ID["diorite"])
m = boulder & ~wet; surf[m] = np.where(r2[m] < 0.75, ID["calcite"], ID["diorite"]); sub[m] = ID["calcite"]
chalkbed = chalkshelf | (~land & (box(chalk.astype(np.float32), 6) > 0.05))
# shores and water beds
beach = land & ~wet & coast & (Y <= SEA + 2) & ~R[SALT]
surf[beach & ~R[FEN]] = ID["sand"]
under = wet
surf[under] = np.where(r1[under] < 0.6, ID["sand"], np.where(r1[under] < 0.85, ID["gravel"], ID["clay"]))
m = under & chalkbed; cb_ = r1[m] + n_patch2[m] * 0.6; surf[m] = np.select([cb_ < 0.35, cb_ < 0.5, cb_ < 0.62, cb_ < 0.8], [ID["calcite"], ID["diorite"], ID["gravel"], ID["moss_block"]], ID["calcite"])
m = under & R[FEN]; surf[m] = np.where(r1[m] < 0.7, ID["mud"], ID["clay"])
surf[bank] = np.where(r1[bank] < 0.5, ID["sand"], np.where(r1[bank] < 0.8, ID["coarse_dirt"], ID["grass_block"]))
m = bank & R[FEN]; surf[m] = np.where(r1[m] < 0.6, ID["mud"], ID["muddy_mangrove_roots"])
m = bank & R[EMBER]; surf[m] = ID["sand"]
surf[isroad] = np.select([r1[isroad] < 0.45, r1[isroad] < 0.7, r1[isroad] < 0.88], [ID["grass_path"], ID["gravel"], ID["cobblestone"]], ID["mossy_cobblestone"])
surf[istrail] = np.where(r1[istrail] < 0.7, ID["grass_path"], np.where(r1[istrail] < 0.9, ID["coarse_dirt"], ID["gravel"]))
m = (isroad | istrail) & R[EMBER]; surf[m] = np.where(r1[m] < 0.6, ID["sandstone"], ID["gravel"])
# grass_path cannot sit under snow cover nicely; northern roads are gravel and cobble
m = (isroad | istrail) & R[FROST] & (surf == ID["grass_path"]); surf[m] = ID["gravel"]
# rail bed: gravel ballast three wide over stone, ready for the track the game lays
surf[railcore] = np.where(r1[railcore] < 0.85, ID["gravel"], ID["cobblestone"]); sub[railcore] = ID["stone"]; subd[railcore] = 2
TERRA = [ID[n] for n in ["orange_terracotta", "hardened_clay", "red_terracotta", "yellow_terracotta", "brown_terracotta", "white_terracotta", "orange_terracotta", "light_gray_terracotta", "red_terracotta", "hardened_clay"]]

biome = np.full((SIZE, SIZE), BIO["plains"], np.uint32)
biome[R[VALE] & (forest > 0.06)] = BIO["forest"]
biome[R[FROST]] = BIO["ice_plains"]; biome[R[SALT]] = BIO["stone_beach"]; biome[R[FEN]] = BIO["mangrove_swamp"]; biome[R[EMBER]] = BIO["desert"]
biome[isriver & ~R[FEN]] = BIO["river"]; biome[isriver & R[FROST]] = BIO["frozen_river"]
biome[~land] = BIO["ocean"]; biome[~land & (reg == FROST)] = BIO["cold_ocean"]
biome[beach & R[VALE]] = BIO["beach"]
biome[~land & (reg == FEN)] = BIO["mangrove_swamp"]

open_ = land & ~wet & ~isroad & ~istrail & ~bank & ~steep & (near < 0.01) & ~railzone
# ground plants
pl = open_ & ~keepclear
plant = np.zeros((SIZE, SIZE), np.uint16)
k = rng.random((SIZE, SIZE))
m = pl & R[VALE] & (surf == ID["grass_block"]) & (r2 > 0.72); plant[m] = np.where(k[m] < 0.93, ID["short_grass"], np.where(k[m] < 0.97, ID["dandelion"], ID["poppy"]))
m = pl & R[VALE] & woods & np.isin(surf, [ID["grass_block"], ID["podzol"], ID["moss_block"]]) & (r2 > 0.8) & (hs < 0.25); plant[m] = np.where(hp[m] < 0.5, ID["fern"], ID["moss_carpet"])
m = pl & R[FROST] & (Y < 135) & (r2 > 0.93); plant[m] = np.where(k[m] < 0.6, ID["fern"], np.where(k[m] < 0.9, ID["short_grass"], ID["sweet_berry_bush"]))
m = pl & R[SALT] & (surf == ID["grass_block"]) & (r2 > 0.85); plant[m] = ID["short_grass"]
m = pl & R[FEN] & np.isin(surf, [ID["grass_block"], ID["moss_block"], ID["podzol"]]) & (r2 > 0.7); plant[m] = np.select([k[m] < 0.4, k[m] < 0.75], [ID["moss_carpet"], ID["short_grass"]], ID["fern"])   # the Cradle's dressing
m = pl & R[EMBER] & (r2 > 0.992); plant[m] = ID["deadbush"]
plant[(plant != 0) & (r2 < 0.85 * (1 - plotfade))] = 0
lily = fenpool & (r2 > 0.9) & (water_level - Y <= 3)
seagr = wet & ~R[FROST] & (water_level - Y >= 2) & (r2 > 0.8) & ~R[FEN]
log("surface chosen")

# ---------------------------------------------------------------- trees (shapes are ours, a dozen variants each)
def sphere(rad, squash=1.25, jitter=0.9, rg=None):
    pts = []
    for dx in range(-rad - 1, rad + 2):
        for dz in range(-rad - 1, rad + 2):
            for dy in range(-rad, rad + 2):
                if math.sqrt(dx * dx + dz * dz + (dy * squash) ** 2) + rg.random() * jitter <= rad + 0.3: pts.append((dx, dy, dz))
    return pts
def mk_round(rg, log_, leaf, big):
    h = int(rg.integers(5, 8)) + (int(rg.integers(3, 6)) if big else 0); rad = 2 + (1 if big else 0) + (rg.random() < 0.4)
    cells = [(dx, h - 1 + dy, dz, leaf) for dx, dy, dz in sphere(rad, rg=rg)]
    cells += [(0, y, 0, log_) for y in range(h)]
    if big:
        for _ in range(int(rg.integers(2, 4))):
            ang = rg.random() * 6.28
            for s in range(1, rad + 1): cells.append((int(round(math.cos(ang) * s)), h - 3 + s // 2, int(round(math.sin(ang) * s)), log_))
    return cells
def mk_birch(rg):
    h = int(rg.integers(6, 10)); cells = []
    for dy in range(-2, 2):
        rr = 2 if dy < 1 else 1
        for dx in range(-rr, rr + 1):
            for dz in range(-rr, rr + 1):
                if abs(dx) + abs(dz) <= rr + 1 and not (abs(dx) == rr and abs(dz) == rr and rg.random() < 0.6): cells.append((dx, h - 1 + dy, dz, "birch_leaves"))
    cells += [(0, h, 0, "birch_leaves")] + [(0, y, 0, "birch_log") for y in range(h)]
    return cells
def mk_spruce(rg, tall):
    h = int(rg.integers(8, 12)) + (int(rg.integers(3, 7)) if tall else 0); cells = [(0, y, 0, "spruce_log") for y in range(h)]
    base = int(h * (0.35 if not tall else 0.5)); y = h; rr = 0
    while y >= base:
        for dx in range(-rr, rr + 1):
            for dz in range(-rr, rr + 1):
                if abs(dx) + abs(dz) <= rr + (rr > 1) and (dx or dz or y >= h): cells.append((dx, y, dz, "spruce_leaves"))
        y -= 1; rr = (rr + 1) if rr < 1 + (h - y) // 3 else max(1, rr - 1)
        rr = min(rr, 3 if tall else 4)
    cells.append((0, h + 1, 0, "spruce_leaves"))
    return cells
def mk_pine(rg):
    h = int(rg.integers(12, 17)); cells = [(0, y, 0, "spruce_log") for y in range(h)]
    for dy in range(-3, 2):
        rr = 2 if dy < -1 else (1 if dy < 1 else 0)
        for dx in range(-rr, rr + 1):
            for dz in range(-rr, rr + 1):
                if abs(dx) + abs(dz) <= rr + 1 and (dx or dz or dy > 0): cells.append((dx, h + dy, dz, "spruce_leaves"))
    return cells
def mk_windswept(rg):
    h = int(rg.integers(5, 8)); lean = (int(rg.choice([-1, 1])), int(rg.choice([-1, 1]))); cells = []
    x = z = 0
    for y in range(h):
        if y > 2 and rg.random() < 0.5: x += lean[0] if rg.random() < 0.6 else 0; z += lean[1] if rg.random() < 0.6 else 0
        cells.append((x, y, z, "oak_log"))
    cells += [(x + dx + lean[0], h - 1 + dy, z + dz + lean[1], "oak_leaves") for dx, dy, dz in sphere(2, squash=1.8, rg=rg)]
    return cells
def mk_dark_oak(rg):
    h = int(rg.integers(6, 9)); cells = []
    for y in range(h):
        for dx in (0, 1):
            for dz in (0, 1): cells.append((dx, y, dz, "dark_oak_log"))
    cells += [(dx, h + dy, dz, "dark_oak_leaves") for dx, dy, dz in sphere(4, squash=2.2, jitter=1.2, rg=rg)]
    return cells
def mk_mangrove(rg):
    h = int(rg.integers(6, 10)); rise = 3; cells = [(0, y, 0, "mangrove_log") for y in range(rise, h)]
    for ang in rg.random(int(rg.integers(3, 6))) * 6.28:        # prop roots arch out from the trunk to the mud
        for s in range(1, 4):
            cells.append((int(round(math.cos(ang) * s)), rise - s + (1 if s == 1 else 0), int(round(math.sin(ang) * s)), "mangrove_roots"))
        cells.append((int(round(math.cos(ang) * 3)), -1, int(round(math.sin(ang) * 3)), "mangrove_roots"))
    cells += [(0, y, 0, "mangrove_roots") for y in range(rise)]
    cells += [(dx, h + dy, dz, "mangrove_leaves") for dx, dy, dz in sphere(3, squash=1.9, jitter=1.0, rg=rg)]
    return cells
def mk_dead(rg, wood):
    h = int(rg.integers(4, 8)); cells = [(0, y, 0, wood) for y in range(h)]
    for _ in range(int(rg.integers(1, 4))):
        ang = rg.random() * 6.28; y0 = int(rg.integers(2, h))
        for s in range(1, int(rg.integers(2, 4))): cells.append((int(round(math.cos(ang) * s)), y0 + s // 2, int(round(math.sin(ang) * s)), wood))
    return cells
def mk_acacia(rg):
    h = int(rg.integers(5, 7)); d = (int(rg.choice([-1, 1])), int(rg.choice([-1, 0, 1]))); cells = []; x = z = 0
    for y in range(h):
        if y >= 2: x += d[0]; z += d[1]
        cells.append((x, y, z, "acacia_log"))
    for dy, rr in ((0, 3), (1, 2)):
        for dx in range(-rr, rr + 1):
            for dz in range(-rr, rr + 1):
                if abs(dx) + abs(dz) <= rr + 1 and rg.random() < 0.92: cells.append((x + dx, h + dy, z + dz, "acacia_leaves"))
    return cells
def mk_cactus(rg): return [(0, y, 0, "cactus") for y in range(int(rg.integers(1, 4)))]
def mk_bush(rg, wood, leaf): return [(0, 0, 0, wood)] + [(dx, dy, dz, leaf) for dx, dy, dz in sphere(1, squash=1.6, jitter=0.6, rg=rg) if (dx, dy, dz) != (0, 0, 0)]

trg = np.random.default_rng(77)
KINDS = {
    "oak": lambda: mk_round(trg, "oak_log", "oak_leaves", False), "big_oak": lambda: mk_round(trg, "oak_log", "oak_leaves", True),
    "birch": lambda: mk_birch(trg), "spruce": lambda: mk_spruce(trg, False), "tall_spruce": lambda: mk_spruce(trg, True),
    "pine": lambda: mk_pine(trg), "windswept": lambda: mk_windswept(trg), "dark_oak": lambda: mk_dark_oak(trg),
    "mangrove": lambda: mk_mangrove(trg), "dead_oak": lambda: mk_dead(trg, "dark_oak_log"), "dead_spruce": lambda: mk_dead(trg, "spruce_log"),
    "acacia": lambda: mk_acacia(trg), "cactus": lambda: mk_cactus(trg),
    "oak_bush": lambda: mk_bush(trg, "oak_log", "oak_leaves"), "spruce_bush": lambda: mk_bush(trg, "spruce_log", "spruce_leaves"),
}
TEMPL = {}
for kname, fn in KINDS.items():
    TEMPL[kname] = []
    for _ in range(12):
        c = fn(); a = np.array([(dx, dy, dz) for dx, dy, dz, _ in c], np.int32); ids = np.array([ID[b] for *_, b in c], np.uint16)
        isleaf = np.array(["leaves" in b for *_, b in c]); TEMPL[kname].append((a, ids, isleaf, np.zeros(len(c), bool)))
KLIST = list(KINDS)
MIX = {  # (kind, weight) per region
    VALE: [("oak", 45), ("big_oak", 15), ("birch", 28), ("oak_bush", 12)],
    FROST: [("spruce", 45), ("tall_spruce", 20), ("pine", 25), ("spruce_bush", 7), ("dead_spruce", 3)],
    SALT: [("windswept", 45), ("spruce", 20), ("oak_bush", 30), ("dead_oak", 5)],
    FEN: [("mangrove", 42), ("dark_oak", 22), ("dead_oak", 16), ("oak_bush", 20)],
    EMBER: [("cactus", 78), ("acacia", 14), ("dead_oak", 8)],
}
# one candidate per 6x6 cell, kept by a density that depends on region and woodland
CELL = 6
gx_c = (np.arange(X0, X0 + SIZE, CELL)); gz_c = (np.arange(Z0, Z0 + SIZE, CELL))
cxs, czs = np.meshgrid(gx_c, gz_c, indexing='ij'); cxs = cxs.ravel(); czs = czs.ravel()
cr = np.random.default_rng(91)
tx = cxs + cr.integers(1, CELL - 1, cxs.size); tz = czs + cr.integers(1, CELL - 1, czs.size)
ok = (tx < X0 + SIZE) & (tz < Z0 + SIZE); tx, tz = tx[ok], tz[ok]
lx, lz = tx - X0, tz - Z0
rg_ = reg[lx, lz]; fo = forest[lx, lz]; yy_ = Y[lx, lz]
dens = np.zeros(tx.size, np.float32)
dens[rg_ == VALE] = np.where(fo[rg_ == VALE] > 0.06, 0.62, np.where(fo[rg_ == VALE] > -0.05, 0.045, 0.012))
dens[rg_ == FROST] = np.where(yy_[rg_ == FROST] > 150, 0.0, np.where(fo[rg_ == FROST] > -0.06, 0.55, 0.09))
dens[rg_ == SALT] = np.where(fo[rg_ == SALT] > 0.1, 0.18, 0.035)
dens[rg_ == FEN] = np.where(fo[rg_ == FEN] > 0.0, 0.42, 0.16)
dens[rg_ == EMBER] = 0.03
dens *= plotfade[lx, lz]
dens *= 1 - chalkdown[lx, lz]                     # open grass on the chalk downs near the cliff edge
keep = (cr.random(tx.size) < dens) & open_[lx, lz] & ~keepclear[lx, lz]
# mangroves want wet ground; elsewhere in the fen the drier kinds
tx, tz, rg_, yy_ = tx[keep], tz[keep], rg_[keep], yy_[keep]
tkind = np.zeros(tx.size, np.int32); tvar = cr.integers(0, 12, tx.size)
for rid, mix in MIX.items():
    sel = np.where(rg_ == rid)[0]
    if not sel.size: continue
    names = [k for k, _ in mix]; wts = np.array([w for _, w in mix], float); wts /= wts.sum()
    tkind[sel] = [KLIST.index(names[i]) for i in cr.choice(len(names), sel.size, p=wts)]
fen_dry = (rg_ == FEN) & (tkind == KLIST.index("mangrove")) & (yy_ > SEA + 6)
tkind[fen_dry] = KLIST.index("dark_oak")

# ---- the custom block-built trees (map/trees, PR #94): set GW_TREES to a database written by map/trees/build_trees.py
# (OUT/trees.json + stamps). Each region gets its own species, picked by habitat; map/trees/place.py keeps every
# crown out of plot clearings, towns and story sites (towns and settlements plant their own trees) and every trunk
# off water, roads, banks and steep ground. Without GW_TREES the simple trees above are used.
TREEDB = os.environ.get("GW_TREES")
_pal = {}
def B_raw(name, states):
    key = name + json.dumps(states, sort_keys=True)
    if key not in _pal:
        ns, n = name.split(":")
        tags = {k: (ByteTag(int(v)) if isinstance(v, bool) else IntTag(v) if isinstance(v, int) else StringTag(str(v))) for k, v in states.items()}
        _pal[key] = level.block_palette.get_add_block(ver.block.to_universal(Block(ns, n, tags))[0])
    return _pal[key]
# ---- baked town plans (map/bake_town.py): world blocks placed last, in order; air digs out, soft (leaves) only fills air
STAMPED = []        # (x, y, z, id, soft) arrays per town
STAMPED_TOWNS = set()
def _key(x, y, z): return (np.asarray(x, np.int64) + 4096) * 1_000_000_000 + (np.asarray(y, np.int64) + 512) * 100_000 + (np.asarray(z, np.int64) + 4096)
_trk = []                                          # the train's body along every planned line: track cell and one each
for cells_, ys_, _ in RAILLINES.values():          # side, 4 high. A town plan or road bridge block left standing in it
    c_ = np.array(cells_, np.int64); y_ = np.asarray(ys_, np.int64)   # would block the bed the game lays on purchase
    for dx_ in (-1, 0, 1):
        for dz_ in (-1, 0, 1):
            for k_ in range(4): _trk.append(_key(c_[:, 0] + dx_, y_ + k_, c_[:, 1] + dz_))
_trk = np.unique(np.concatenate(_trk)) if _trk else np.zeros(0, np.int64)
for d_ in GW_FILES:
    pid_ = np.array([B_raw(e["name"], e["states"]) if e["name"] != "minecraft:air" else -1 for e in d_["palette"]], np.int64)
    sf_ = np.array([bool(e.get("soft")) for e in d_["palette"]])
    b_ = np.array(d_["blocks"], np.int64)
    off_ = np.isin(_key(b_[:, 0], b_[:, 1], b_[:, 2]), _trk) & (pid_[b_[:, 3]] >= 0)
    if off_.any():
        log("town plan", d_["town"], "keeps", int(off_.sum()), "blocks off the track:", sorted({d_["palette"][i]["name"].split(":")[-1] for i in b_[off_, 3]})[:8])
        b_ = b_[~off_]
    STAMPED.append((b_[:, 0], b_[:, 1], b_[:, 2], pid_[b_[:, 3]], sf_[b_[:, 3]])); STAMPED_TOWNS.add(d_["town"])
    log("town plan", d_["town"], len(b_), "blocks")
if THIN_BLOCKS:   # the thin places' own ground, faces and set pieces: first, so towns and bridges win over them
    _tb = np.array([(x, y, z) for x, y, z, _, _ in THIN_BLOCKS], np.int64); _tk = {}
    for _, _, _, n, st in THIN_BLOCKS:
        k_ = n + json.dumps(st, sort_keys=True)
        if k_ not in _tk: _tk[k_] = B_raw(n, st) if n != "minecraft:air" else -1
    _ti = np.array([_tk[n + json.dumps(st, sort_keys=True)] for _, _, _, n, st in THIN_BLOCKS], np.int64)
    STAMPED.insert(0, (_tb[:, 0], _tb[:, 1], _tb[:, 2], _ti, np.zeros(len(_ti), bool)))
    log("thin places", len(_ti), "blocks")
if BRIDGE_BLOCKS:
    _bb = np.array([(x, y, z) for x, y, z, _, _ in BRIDGE_BLOCKS], np.int64)
    _bi = np.array([B_raw(n, st) if n != "minecraft:air" else -1 for _, _, _, n, st in BRIDGE_BLOCKS], np.int64)
    _off = np.isin(_key(_bb[:, 0], _bb[:, 1], _bb[:, 2]), _trk) & (_bi >= 0)     # a road bridge the line crosses: its
    if _off.any():                                                               # parapets and lamps stay off the track
        log("road bridges keep", int(_off.sum()), "blocks off the track")
        _bb, _bi = _bb[~_off], _bi[~_off]
    STAMPED.append((_bb[:, 0], _bb[:, 1], _bb[:, 2], _bi, np.zeros(len(_bi), bool)))
# ---- the boss sites, baked (Mateo 2026-11-13: the boss locations are physical places from the start). map/bake_sites.mjs
# runs the game's own plans against this ground, read the way the game reads it (unlocks/site.js column(), reeve.js
# groundAt), so the blocks are the ones the game would build on approach. They go on after the towns, as the game's
# build would. GW_SITES_JS (full map only) rewrites unlocks/baked_sites.js, which tells the game each site is already
# standing (centre, puzzle seed, check cells) so it only places keepers, signs and fights when a player comes near.
SITE_FACTS = {}
if os.environ.get("GW_SITES", "1") != "0" and shutil.which("node"):
    import subprocess, tempfile
    _here = os.path.dirname(os.path.abspath(__file__))
    _anch = json.loads(subprocess.check_output(["node", os.path.join(_here, "bake_sites.mjs"), "--anchors"]))
    _R = int(_anch["r"])
    _SOFT = re.compile(r"air|grass(?!_block)|fern|flower|tulip|poppy|dandelion|bush|snow_layer|leaves|log|vine|sapling|mushroom|torch|sign|reeds|sugar_cane|kelp|seagrass|lily|roots|moss_carpet|propagule")
    _SOFT_R = re.compile(r"air|water|grass(?!_block)|fern|flower|tulip|poppy|dandelion|bush|snow_layer|leaves|log|vine|sapling|mushroom|torch|sign")
    _cols = {}                                          # (x, z) -> [(y, name, states, soft)] in placing order
    _boxes = [(a["x"] - _R, a["z"] - _R, a["x"] + _R, a["z"] + _R) for a in _anch["anchors"].values()]
    def _inbox(x, z): return any(x0 <= x <= x1 and z0 <= z <= z1 for x0, z0, x1, z1 in _boxes)
    def _gather(entries):
        for x, y, z, n, st, sf in entries:
            if _inbox(x, z): _cols.setdefault((x, z), []).append((y, n, st or {}, sf))
    _gather((x, y, z, n, st, False) for x, y, z, n, st in THIN_BLOCKS)
    for d_ in GW_FILES:
        _p = d_["palette"]; _bl = np.array(d_["blocks"], np.int64)
        _m = np.zeros(len(_bl), bool)
        for x0, z0, x1, z1 in _boxes: _m |= (_bl[:, 0] >= x0) & (_bl[:, 0] <= x1) & (_bl[:, 2] >= z0) & (_bl[:, 2] <= z1)
        _gather((int(b[0]), int(b[1]), int(b[2]), _p[b[3]]["name"], _p[b[3]]["states"], bool(_p[b[3]].get("soft"))) for b in _bl[_m])
    _gather((x, y, z, n, st, False) for x, y, z, n, st in BRIDGE_BLOCKS)
    def _column(x, z, reeve=False):
        """The game's view of a column: (ground, water, gold marker ys). Plain ground unless a stamp touches it."""
        g, w = ground_at(x, z), water_at(x, z)
        if (x, z) not in _cols: return g, (None if reeve else w), []
        cells = {y: "ground" for y in range(g - 6, g + 1)}
        if w is not None:
            for y in range(g + 1, w + 1): cells[y] = "minecraft:water"
        states = {}
        for y, n, st, sf in _cols[(x, z)]:
            if sf and cells.get(y, "minecraft:air") != "minecraft:air": continue
            cells[y] = n; states[y] = st
        gold, water = [], None
        for y in sorted(cells, reverse=True):
            n = cells[y]
            if n == "minecraft:air": continue
            if n == "minecraft:gold_block": gold.append(y); continue
            if reeve:
                if _SOFT_R.search(n): continue
                half = states.get(y, {}).get("minecraft:vertical_half", "bottom")
                return (y - 1 if n.endswith("_slab") and "double" not in n and half != "top" else y), None, gold
            if (("water" in n or "ice" in n) and n not in ("minecraft:packed_ice", "minecraft:blue_ice")) or (n == "minecraft:packed_ice" and water is None):
                water = y if water is None else water; continue
            if not _SOFT.search(n): return y, water, gold
        return g, water, gold
    _probe = {"seed": int.from_bytes(os.urandom(4), "little") & 0x7FFFFFFF, "sites": {}, "reeve_y": None}
    _gold = []
    for sid_, a_ in _anch["anchors"].items():
        if sid_ == "reeve":   # the square's commonest floor round the middle (reeve.js squareFloor: FLOOR_RING)
            _ys = [_column(a_["x"] + dx_, a_["z"] + dz_, reeve=True)[0] for dx_, dz_ in ((4, 0), (-4, 0), (0, 4), (0, -4), (3, 3), (-3, 3), (3, -3), (-3, -3))]
            _probe["reeve_y"] = min(set(_ys), key=lambda v: (-_ys.count(v), v))
            _gold += [(a_["x"], gy_, a_["z"]) for gy_ in _column(a_["x"], a_["z"], reeve=True)[2]]; continue
        n_ = 2 * _R + 1; gr_, wa_ = [], []
        for x_ in range(a_["x"] - _R, a_["x"] + _R + 1):
            for z_ in range(a_["z"] - _R, a_["z"] + _R + 1):
                if not inside(x_, z_): gr_.append(None); wa_.append(None); continue
                g_, w_, gl_ = _column(x_, z_)
                gr_.append(g_); wa_.append(w_)
                if gl_ and math.hypot(x_ - a_["x"], z_ - a_["z"]) <= 24: _gold += [(x_, gy_, z_) for gy_ in gl_]
        _probe["sites"][sid_] = {"x0": a_["x"] - _R, "z0": a_["z"] - _R, "n": n_, "ground": gr_, "water": wa_}
    _pf = os.environ.get("GW_SITES_PROBE") or tempfile.mkstemp(suffix=".json")[1]   # GW_SITES_PROBE: keep it, to rerun the bake alone
    with open(_pf, "w") as f_: json.dump(_probe, f_)
    _sites = json.loads(subprocess.check_output(["node", os.path.join(_here, "bake_sites.mjs"), _pf]))
    if not os.environ.get("GW_SITES_PROBE"): os.unlink(_pf)
    _bid = {}
    for sid_, s_ in _sites.items():
        c_ = s_["center"]; ops_ = s_["ops"]
        xyz_ = np.array([(c_["x"] + o[0], c_["y"] + o[1], c_["z"] + o[2]) for o in ops_], np.int64)
        ids_ = []
        for o in ops_:
            k_ = o[3] + json.dumps(o[4] or {}, sort_keys=True)
            if k_ not in _bid: _bid[k_] = -1 if o[3] == "minecraft:air" else B_raw(o[3], o[4] or {})
            ids_.append(_bid[k_])
        ids_ = np.array(ids_, np.int64)
        off_ = np.isin(_key(xyz_[:, 0], xyz_[:, 1], xyz_[:, 2]), _trk) & (ids_ >= 0)
        if off_.any(): log("boss site", sid_, "keeps", int(off_.sum()), "blocks off the track")
        keep_ = ~off_     # (the game clears trees off its build box first; here stampcol below keeps them off instead)
        STAMPED.append((xyz_[keep_, 0], xyz_[keep_, 1], xyz_[keep_, 2], ids_[keep_], np.zeros(int(keep_.sum()), bool)))
        # check cells for the game: the last block at a few distinctive cells, so an older world without the bake builds
        last_ = {}
        for o, kp in zip(ops_, keep_):
            if kp: last_[(o[0], o[1], o[2])] = o[3]
        cand_ = [(p, n) for p, n in last_.items() if n != "minecraft:air" and (n.startswith("siege:") or n.startswith("hc:"))]
        cand_ += [(p, n) for p, n in last_.items() if n != "minecraft:air" and not _SOFT.search(n) and "water" not in n and (p, n) not in cand_]
        cand_.sort(key=lambda pn: (not (pn[1].startswith("siege:") or pn[1].startswith("hc:")), -abs(pn[0][1])))
        picks_ = []
        for p, n in cand_:
            if all(abs(p[0] - q[0]) + abs(p[2] - q[2]) >= 4 for q, _ in picks_): picks_.append((p, n))
            if len(picks_) == 5: break
        SITE_FACTS[sid_] = {"anchor": s_["anchor"], "center": c_, "seed": s_["seed"], "info": s_["info"],
                            "towerPost": s_.get("towerPost"), "check": [[p[0], p[1], p[2], n] for p, n in picks_]}
        log("boss site", sid_, "baked at", c_["x"], c_["y"], c_["z"], int(keep_.sum()), "blocks")
    if _gold:
        _g = np.array(_gold, np.int64); STAMPED.append((_g[:, 0], _g[:, 1], _g[:, 2], np.full(len(_g), -1, np.int64), np.zeros(len(_g), bool)))
    if os.environ.get("GW_SITES_JS"):
        with open(os.environ["GW_SITES_JS"], "w") as f_:
            f_.write("// Made by map/genworld.py (map/bake_sites.mjs). Do not edit by hand: rebuild the map.\n")
            f_.write("// The boss sites baked into the base map: where each stands, its puzzle seed, and a few cells that show it is\n")
            f_.write("// really there (an older world without the bake builds the site on approach as before). unlocks/site.js, reeve.js.\n")
            f_.write("export const BAKED_SITES = " + json.dumps(SITE_FACTS, separators=(",", ":")) + ";\n")
# ---- the Everwake air boat station, a ruin until the story restores it (Mateo picked Wren Water, 2026-11-13). Built
# with the skill (map/structures/everwake_builds.py), set on this map's own ground by the one terraform pass
# (map/structures/everwake/site.py world_blocks: pad, blend, the lane out to the road, its trees). GW_EVERWAKE=0: none.
if os.environ.get("GW_EVERWAKE", "1") != "0":
    import subprocess, tempfile
    _st = os.path.join(os.path.dirname(os.path.abspath(__file__)), "structures")
    sys.path.insert(0, _st); sys.path.insert(0, os.path.join(_st, "everwake"))
    import importlib.util as _ilu                        # map/structures/everwake/site.py ("site" is a stdlib name)
    for _m in ("trees", "station", "spec", "terraform"): sys.modules.pop(_m, None)
    _sp = _ilu.spec_from_file_location("everwake_site", os.path.join(_st, "everwake", "site.py"))
    _ews = _ilu.module_from_spec(_sp); _sp.loader.exec_module(_ews)
    from bp import Blueprint as _BP
    _tmp = tempfile.mkdtemp()
    subprocess.run([sys.executable, os.path.join(_st, "everwake_builds.py"), _tmp, "--only", "airboat_station_ruin"], check=True, stdout=subprocess.DEVNULL)
    _R = _ews.R; _ls = np.arange(-_R, _R + 1)
    _LX, _LZ = np.meshgrid(_ls, _ls, indexing="ij")
    _gi = np.clip(_ews.CX - _LZ - X0, 0, SIZE - 1); _gk = np.clip(_ews.CZ + _LX - Z0, 0, SIZE - 1)
    _wb, _py = _ews.world_blocks(os.path.join(_tmp, "airboat_station_ruin", "scene.json"), Y[_gi, _gk].astype(int), wet[_gi, _gk], (isroad | istrail)[_gi, _gk])
    _bp = _BP("everwake_station"); _ek = {}
    _ex, _ei, _es = [], [], []
    for x_, y_, z_, n_, p_ in _wb:
        k_ = n_ + json.dumps(p_, sort_keys=True)
        if k_ not in _ek:
            bn_, bs_ = _bp.to_bedrock(n_, p_)
            _ek[k_] = (-1 if bn_ == "minecraft:air" else B_raw(bn_, bs_), "leaves" in bn_)
        _ex.append((x_, y_, z_)); _ei.append(_ek[k_][0]); _es.append(_ek[k_][1])
    _ex = np.array(_ex, np.int64)
    STAMPED.append((_ex[:, 0], _ex[:, 1], _ex[:, 2], np.array(_ei, np.int64), np.array(_es, bool)))
    shutil.rmtree(_tmp, ignore_errors=True)
    log("everwake station (ruin) at", _ews.CX, _ews.CZ, "floor", _py, len(_wb), "blocks")
# no tree in a build's dead space (Mateo 2026-11-12: "in dead space there are trees spawning, so for builds include
# air blocks that remove trees"): every column a town plan or bridge stamps, with a margin, keeps whole trees out, so
# no trunk stands in a courtyard and no crown hangs over a roof or floats where a stamp cut it.
stampcol = np.zeros((SIZE, SIZE), bool)
for sx_, sy_, sz_, sid_, ss_ in STAMPED:
    i_ = sx_ - X0; k_ = sz_ - Z0; m_ = (i_ >= 0) & (i_ < SIZE) & (k_ >= 0) & (k_ < SIZE)
    stampcol[i_[m_], k_[m_]] = True
stampnear = box(stampcol.astype(np.float32), 2) > 0           # crowns (custom trees, through hard_t below)
if True:                                                       # simple trees: trunks 8 out from a planned line
    far_ = rail_d[np.clip(tx - X0, 0, SIZE - 1), np.clip(tz - Z0, 0, SIZE - 1)] > 8
    tx, tz, rg_, yy_, tkind, tvar = tx[far_], tz[far_], rg_[far_], yy_[far_], tkind[far_], tvar[far_]
    log("trees kept off the planned lines:", int((~far_).sum()), "removed")
if stampcol.any():
    far_ = box(stampcol.astype(np.float32), 7)[np.clip(tx - X0, 0, SIZE - 1), np.clip(tz - Z0, 0, SIZE - 1)] == 0   # simple trees: trunks 7 out
    tx, tz, rg_, yy_, tkind, tvar = tx[far_], tz[far_], rg_[far_], yy_[far_], tkind[far_], tvar[far_]
    log("trees kept off stamped builds:", int((~far_).sum()), "removed")
if TREEDB:
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "trees"))
    from place import fits, mark, SIZE_ORDER, SIZE_WEIGHT, _grow_mask
    tindex = json.load(open(os.path.join(TREEDB, "trees.json")))
    SOFTB = ("leaves", "vine", "hanging", "moss_carpet", "leaf_litter", "snow_layer", "veilmoss")
    PROF = {}
    for sid, sp in tindex["species"].items():
        if sp["region"] == "hollow": continue
        for size, files in sp["sizes"].items():
            for f in files:
                st = json.load(open(os.path.join(TREEDB, f["file"] + ".stamp.json")))
                ox, oy, oz = st["origin"]; pal = [B_raw(e["name"], e["states"]) for e in st["palette"]]
                soft_ = [any(k in e["name"] for k in SOFTB) for e in st["palette"]]
                bl = np.array(st["blocks"], np.int32)
                off = np.stack([bl[:, 0] + ox, bl[:, 1] - 1, bl[:, 2] + oz], 1).astype(np.int32)   # stamp y 0 = the ground block
                ids = np.array([pal[i] for i in bl[:, 3]], np.uint16); isl = np.array([soft_[i] for i in bl[:, 3]]); isg = bl[:, 1] == 0
                TEMPL[f["file"]] = [(off, ids, isl, isg)]; KLIST.append(f["file"]); PROF[f["file"]] = f
    NATURAL_G = np.array([ID[n] for n in ["grass_block", "dirt", "coarse_dirt", "podzol", "sand", "red_sand", "mud", "moss_block", "gravel"]], np.uint16)
    near_river = box(valley, 10) > 0.25
    hab = {  # region -> list of (condition name, {species: weight})
        VALE: [("river", {"vale_weeping_willow": 60, "vale_ash": 20, "vale_great_oak": 20}),
               ("wood", {"vale_great_oak": 30, "vale_ash": 25, "vale_silver_birch": 22, "vale_yew": 5, "vale_hawthorn": 8}),
               ("open", {"vale_hawthorn": 35, "vale_great_oak": 25, "vale_ash": 12, "vale_silver_birch": 14, "vale_apple": 10})],
        FROST: [("high", {"frost_treeline_pine": 50, "frost_juniper": 30, "frost_snag": 20}),
                ("wood", {"frost_tall_spruce": 42, "frost_grey_fir": 25, "frost_scots_pine": 20, "frost_snow_birch": 9, "frost_snag": 4}),
                ("open", {"frost_juniper": 30, "frost_snow_birch": 25, "frost_scots_pine": 25, "frost_treeline_pine": 20})],
        SALT: [("shore", {"salt_tamarisk": 40, "salt_sea_cypress": 45, "salt_olive": 15}),
               ("wood", {"salt_umbrella_pine": 32, "salt_italian_cypress": 25, "salt_sea_cypress": 18, "salt_olive": 25}),
               ("open", {"salt_olive": 40, "salt_italian_cypress": 25, "salt_umbrella_pine": 20, "salt_tamarisk": 15})],
        FEN: [("wet", {"fen_bald_cypress": 55, "fen_drowned_snag": 20, "fen_black_alder": 25}),
              ("open", {"fen_black_alder": 45, "fen_pollard_willow": 35, "fen_bald_cypress": 20})],
        EMBER: [("open", {"ember_umbrella_acacia": 35, "ember_argan": 30, "ember_date_palm": 15, "ember_baobab": 10, "ember_dragon_blood": 10})],
    }
    hard_t = keepclear | railzone | railkeep | stampnear   # crowns stay off the line (trains need the air above the bed) and off builds
    soft_t = _grow_mask(~open_ | ~land, 1)
    soft_w = _grow_mask((~open_ & ~fenpool & ~bank) | ~land, 1)        # bald cypress and snags may stand in fen water
    taken = np.zeros((SIZE, SIZE), np.int8)
    order = cr.permutation(tx.size)
    nx, nz, nk = [], [], []
    for i in order:
        x_, z_ = int(tx[i] - X0), int(tz[i] - Z0); rid = int(rg_[i])
        if rid == EMBER and tkind[i] == KLIST.index("cactus"):
            nx.append(tx[i]); nz.append(tz[i]); nk.append(tkind[i]); continue
        f_ = forest[x_, z_]; cond = "open"
        if rid == VALE and near_river[x_, z_]: cond = "river"
        elif rid == FROST and Y[x_, z_] > 125: cond = "high"
        elif rid == SALT and coast[x_, z_]: cond = "shore"
        elif rid == FEN and (Y[x_, z_] < SEA + 4 or fenpool[x_, z_]): cond = "wet"
        elif f_ > (0.06 if rid == VALE else -0.06 if rid == FROST else 0.1): cond = "wood"
        table = dict(hab[rid]); w_ = table.get(cond) or table["open"]
        sids = [k for k in w_ if k in tindex["species"]]
        if not sids: continue
        sid = sids[int(cr.choice(len(sids), p=np.array([w_[k] for k in sids], float) / sum(w_[k] for k in sids)))]
        first = SIZE_ORDER[int(cr.choice(4, p=np.array([SIZE_WEIGHT[k] for k in SIZE_ORDER]) / sum(SIZE_WEIGHT.values())))]
        sv = soft_w if sid in ("fen_bald_cypress", "fen_drowned_snag") else soft_t
        for size in SIZE_ORDER[SIZE_ORDER.index(first):]:
            fl = tindex["species"][sid]["sizes"][size]; f = fl[int(cr.integers(len(fl)))]
            if not fits(f, x_, z_, hard_t, sv, taken): continue
            ty = [Y[x_ + a, z_ + b] for a, b in f["trunk"]]
            if max(ty) - min(ty) > 1: continue                          # not on a slope its roots would float over
            mark(f, x_, z_, taken); nx.append(tx[i]); nz.append(tz[i]); nk.append(KLIST.index(f["file"])); break
    tx, tz, tkind = np.array(nx, np.int64), np.array(nz, np.int64), np.array(nk, np.int32); tvar = np.zeros(tx.size, np.int32)
    import collections
    log("custom trees from", TREEDB, dict(collections.Counter(KLIST[k].split("/")[0] for k in tkind).most_common()))
TREEM = 18 if TREEDB else 6                           # how far outside a tile a tree's trunk may stand and still reach in
log("trees placed", tx.size)

# ---------------------------------------------------------------- caves (map/caves.py): vanilla's cave types
# Mateo 2026-11-13: "generate all the caves correctly, same as the vanilla game". Cheese caverns, spaghetti and noodle
# tunnels, carver caves, ravines, aquifers, lava at the bottom, lush and dripstone caves, big ore veins, and cave mouths
# a player can walk into. Openings only in open country: never in towns, plots, roads, trails, rail, water, bridges,
# boss sites, wards or the Rift's thin places. A starter mouth on a hillside near every plot and two near Kingsrest
# (iron before the day-5 siege). Towns, wards, boss sites and thin places have no caves under them at all (the add-on
# builds its own rooms there: the Millbrook well chamber, the Deep, the thin places' caves).
import caves as CV
CAVE_IDS = {}
for k_, (n_, st_) in {"moss_block": ("moss_block", {}), "moss_carpet": ("moss_carpet", {}), "clay": ("clay", {}),
                      "azalea": ("azalea", {}), "flowering_azalea": ("flowering_azalea", {}), "spore_blossom": ("spore_blossom", {}),
                      "dirt_with_roots": ("dirt_with_roots", {}), "hanging_roots": ("hanging_roots", {}),
                      "cave_vines": ("cave_vines", {"growing_plant_age": 25}),
                      "cave_vines_body_with_berries": ("cave_vines_body_with_berries", {"growing_plant_age": 25}),
                      "cave_vines_head_with_berries": ("cave_vines_head_with_berries", {"growing_plant_age": 25}),
                      "dripstone_block": ("dripstone_block", {}),
                      "glow_lichen_down": ("glow_lichen", {"multi_face_direction_bits": 1}),
                      "glow_lichen_up": ("glow_lichen", {"multi_face_direction_bits": 2}),
                      **{f"pd_{t_}_{h_}": ("pointed_dripstone", {"dripstone_thickness": t_, "hanging": h_ == "h"})
                         for t_ in ("tip", "frustum", "middle", "base") for h_ in ("h", "u")}}.items():
    try: CAVE_IDS[k_] = B_raw("minecraft:" + n_, st_)
    except Exception as e_: log("cave block missing", n_, e_)
ROCK_IDS = [ID[n_] for n_ in ("stone", "deepslate", "granite", "diorite", "andesite", "tuff", "calcite", "dirt", "sandstone",
                              "red_sandstone", "hardened_clay", "orange_terracotta", "red_terracotta", "yellow_terracotta",
                              "brown_terracotta", "white_terracotta", "light_gray_terracotta", "grass_block", "coarse_dirt",
                              "podzol", "mud", "moss_block")]
_boss = [(int(a_), int(b_)) for a_, b_ in re.findall(r"anchor: \{ x: (-?\d+), z: (-?\d+)", "".join(
    open(f_).read() for f_ in __import__("glob").glob(os.path.join(os.path.dirname(os.path.abspath(CONFIG)), "..", "unlocks", "*.js"))))]
_boss += [(x_, z_) for _, x_, z_, _, _ in LAKES[1:2]]                   # Hallowmere (the huntsman's lake)
nocave = disc_mask([(n, x, z, r + 16) for n, x, z, r, _ in WARDS]) | disc_mask([("b", x, z, 85) for x, z in _boss]) | thin_shaped   # a baked site reaches 70-80 from its anchor
_way = isroad | istrail | (rail_d <= 6.5) | stampcol | isriver | bank | wet
_ckeep = keepclear | stampcol | disc_mask([("b", x, z, 90) for x, z in _boss])
d_keep = chamfer_b(_ckeep, 40); d_way = chamfer_b(_way, 16); d_wet = chamfer_b(wet, 10)
cave_cover = np.full((SIZE, SIZE), 4.0, np.float32)                  # blocks of ground every sealed cave keeps over it
cave_cover = np.where(d_way < 12, np.maximum(cave_cover, 8 + (12 - d_way) / 3), cave_cover)
cave_cover = np.where(d_keep < 30, np.maximum(cave_cover, 12 - np.maximum(d_keep - 10, 0) / 2.5), cave_cover)
cave_cover = np.where(wet, 10.0, cave_cover)
mouth_ok = land & ~wet & (d_keep >= 40) & (d_way >= 14) & (d_wet >= 8) & ~nocave & (Y > SEA + 2)
_e = noise(170, 61) + noise(60, 62) * 0.4                            # entrance patches, more on hillsides
_patch = mouth_ok & ((_e > 0.12) | ((_e > -0.02) & steep))
cave_cover = np.where(_patch, np.clip((0.12 - _e) * 20, 0, 4) * (~steep), cave_cover).astype(np.float32)
cave_cover = np.where(_patch & steep, 0.0, cave_cover).astype(np.float32)
_starts = [(n, x, z, 1) for n, x, z in PLOTS] + [("Kingsrest", PLAZA["Kingsrest"][0], PLAZA["Kingsrest"][1], 2)] if "Kingsrest" in PLAZA else [(n, x, z, 1) for n, x, z in PLOTS]
CAV = CV.Caves(Y, X0, Z0, cave_cover, nocave, reg, mouth_ok, _starts, sea=SEA, log=log, regions=(VALE, FROST, SALT, FEN, EMBER),
               deep_only=plotzone)
if os.environ.get("GW_CAVES_JSON"):                                    # mouths and near-plot tunnels for other threads
    json.dump({"mouths": [dict(x=int(x_), y=int(y_), z=int(z_), kind=k_) for x_, y_, z_, k_ in CAV.mouths],
               "starter_ore": [dict(x=round(float(x_), 1), y=round(float(y_), 1), z=round(float(z_), 1), kind=k_) for x_, y_, z_, k_ in CAV.ore_spots]},
              open(os.environ["GW_CAVES_JSON"], "w"), indent=0)

ORES = [  # name, deepslate twin, veins per 16x16 column, y low, y peak, y high, vein size (vanilla 1.18+ spreads: triangles)
    ("coal_ore", "deepslate_coal_ore", 16, 0, 96, 192, 12), ("coal_ore", "deepslate_coal_ore", 6, 136, 200, 320, 12),
    ("iron_ore", "deepslate_iron_ore", 8, -24, None, 56, 7), ("iron_ore", "deepslate_iron_ore", 6, -64, 16, 72, 8),
    ("iron_ore", "deepslate_iron_ore", 10, 80, 232, 384, 8), ("copper_ore", "deepslate_copper_ore", 10, -16, 48, 112, 9),
    ("gold_ore", "deepslate_gold_ore", 3, -64, -16, 32, 8), ("redstone_ore", "deepslate_redstone_ore", 3, -64, None, 15, 7),
    ("redstone_ore", "deepslate_redstone_ore", 5, -64, -64, -32, 7), ("lapis_ore", "deepslate_lapis_ore", 2, -32, 0, 32, 6),
    ("lapis_ore", "deepslate_lapis_ore", 3, -64, None, 64, 6), ("diamond_ore", "deepslate_diamond_ore", 3.5, -64, -64, 16, 4),
]
BLOBS = [("granite", 1.2, -20, 120, 3.5), ("diorite", 1.2, -20, 120, 3.5), ("andesite", 1.4, -20, 120, 3.5), ("gravel", 0.8, -40, 100, 2.5),
         ("dirt", 0.8, 0, 120, 2.5), ("tuff", 1.2, -60, 0, 3.5)]

# ---------------------------------------------------------------- write tiles
TOP = int(Y.max()) + 45; YR = TOP - YMIN
# which columns a cave mouth opens, for the whole square first, so a tree is skipped whichever tile draws its crown
OPENED = np.zeros((SIZE, SIZE), bool)
_mayopen = (cave_cover < 0.5) | (box(mouth_ok.astype(np.float32), 1) > 0)
for tx0 in range(0, SIZE, TILE):
    for tz0 in range(0, SIZE, TILE):
        if not _mayopen[tx0:tx0 + TILE, tz0:tz0 + TILE].any(): continue
        OPENED[tx0:tx0 + TILE, tz0:tz0 + TILE] = CAV.opened(X0 + tx0, Z0 + tz0, Y[tx0:tx0 + TILE, tz0:tz0 + TILE], YR)
OPENED &= ~wet
log("cave mouths: open columns", int(OPENED.sum()))
yy = np.arange(YMIN, TOP, dtype=np.int32)[None, :, None]
pv = np.zeros((SIZE, SIZE), np.uint16)            # top block per column, for the preview
nchunks = 0
for tx0 in range(0, SIZE, TILE):
    for tz0 in range(0, SIZE, TILE):
        a0, a1 = max(0, tx0 - MARGIN), min(SIZE, tx0 + TILE + MARGIN); b0, b1 = max(0, tz0 - MARGIN), min(SIZE, tz0 + TILE + MARGIN)
        W, D = a1 - a0, b1 - b0
        Yt = Y[a0:a1, b0:b1]; Ye = Yt[:, None, :]
        vol = np.full((W, YR, D), AIR, np.uint16)
        solid = yy <= Ye
        deep = yy < (noise_d := (np.random.default_rng(1000 + tx0 * 7 + tz0).integers(-3, 3, (W, 1, D))))
        vol[solid & ~deep] = ID["stone"]; vol[solid & deep] = ID["deepslate"]
        trg2 = np.random.default_rng(5000 + tx0 * 131 + tz0)
        def blob_fill(name, n, ylo, yhi, rad, only=(ID["stone"], ID["deepslate"]), alt=None, size=None, peak=None):
            cnt = trg2.poisson(n * W * D / 256)
            if not cnt: return
            bx = trg2.integers(0, W, cnt); bz = trg2.integers(0, D, cnt)
            by = (trg2.integers(ylo, yhi, cnt) if peak is None else np.round(trg2.triangular(ylo, peak, yhi, cnt)).astype(np.int64)) - YMIN
            r = int(math.ceil(rad)); off = np.array([(i, j, k) for i in range(-r, r + 1) for j in range(-r, r + 1) for k in range(-r, r + 1) if i * i + j * j + k * k <= rad * rad])
            keep_ = trg2.random((cnt, len(off))) < (0.75 if size is None else min(1.0, size / len(off)))
            px_ = (bx[:, None] + off[None, :, 0])[keep_]; py_ = (by[:, None] + off[None, :, 1])[keep_]; pz_ = (bz[:, None] + off[None, :, 2])[keep_]
            ok_ = (px_ >= 0) & (px_ < W) & (pz_ >= 0) & (pz_ < D) & (py_ >= 1) & (py_ < YR)
            px_, py_, pz_ = px_[ok_], py_[ok_], pz_[ok_]
            cur = vol[px_, py_, pz_]
            if alt is None:
                m_ = np.isin(cur, only); vol[px_[m_], py_[m_], pz_[m_]] = ID[name]
            else:
                m_ = cur == ID["stone"]; vol[px_[m_], py_[m_], pz_[m_]] = ID[name]
                m_ = cur == ID["deepslate"]; vol[px_[m_], py_[m_], pz_[m_]] = ID[alt]
        for name, n, lo, hi, rad in BLOBS: blob_fill(name, n, lo, hi, rad, only=(ID["stone"],) if name != "tuff" else (ID["deepslate"],))
        for name, alt, n, lo, pk, hi, size in ORES: blob_fill(name, n, lo, hi, 1.5, alt=alt, size=size, peak=pk)
        # large ore veins (vanilla 1.18): copper in granite up high, iron in tuff down deep, with the odd raw block
        v_cu, v_fe, v_raw, v_fill, _ = CAV.veins(X0 + a0, Z0 + b0, W, D, YR)
        rock_ = (vol == ID["stone"]) | (vol == ID["deepslate"])
        vol[v_fill & rock_ & (yy >= 0)] = ID["granite"]; vol[v_fill & rock_ & (yy < 0)] = ID["tuff"]
        vol[v_cu & rock_] = ID["copper_ore"]; vol[v_fe & rock_] = ID["deepslate_iron_ore"]
        vol[v_raw & rock_ & (yy >= 0)] = ID["raw_copper_block"]; vol[v_raw & rock_ & (yy < 0)] = ID["raw_iron_block"]
        del v_cu, v_fe, v_raw, v_fill, rock_
        # emeralds in the northern mountains, more gold in the waste
        frost_t = (reg[a0:a1, b0:b1] == FROST).mean(); ember_t = (reg[a0:a1, b0:b1] == EMBER).mean()
        if frost_t > 0.05: blob_fill("emerald_ore", 3 * frost_t, 60, 200, 1.0, alt="deepslate_emerald_ore", size=1)
        if ember_t > 0.05: blob_fill("gold_ore", 4 * ember_t, 30, 110, 1.5, alt="deepslate_gold_ore", size=6)
        # mesa bands just under the surface in the Emberwaste
        mz = mesa[a0:a1, b0:b1]
        if mz.any():
            band = np.array(TERRA, np.uint16)[((yy[0, :, 0] + 400) // 3) % len(TERRA)]
            mm = mz[:, None, :] & solid & (yy > Ye - 14)
            vol[mm] = np.broadcast_to(band[None, :, None], vol.shape)[mm]
        # sub-surface layer
        st = sub[a0:a1, b0:b1]; sd = subd[a0:a1, b0:b1]
        subm = solid & (yy > Ye - sd[:, None, :]) & ~(mz[:, None, :])
        vol[subm] = np.broadcast_to(st[:, None, :], vol.shape)[subm]
        # chalk: the cliff body is calcite down to below the sea. Streaks run down the face (bone block and diorite chosen
        # per column, broken now and then), flint lies in thin level bands, the top rows are soil-stained and the bottom
        # rows, in the splash zone, are grey and weedy
        ck = chalk[a0:a1, b0:b1]
        if ck.any():
            cm_ = ck[:, None, :] & solid & ~subm & (yy > SEA - 14) & (vol == ID["stone"])
            crg = np.random.default_rng(7000 + tx0 * 17 + tz0)
            rr_ = crg.random(vol.shape, dtype=np.float32); rc_ = crg.random((W, 1, D), dtype=np.float32)
            run_ = ((yy + rc_ * 400).astype(np.int32) % 19) < 12
            streak_b = (rc_ < 0.16) & run_; streak_d = (rc_ >= 0.16) & (rc_ < 0.22) & run_
            flint = ((yy + 400) % 8 == 0) & (rr_ < 0.25)
            splash = yy <= SEA + 3
            vol[cm_] = ID["calcite"]
            vol[cm_ & streak_b] = ID["bone_block"]; vol[cm_ & streak_d] = ID["diorite"]
            vol[cm_ & ~streak_b & ~streak_d & (rr_ > 0.985)] = ID["diorite"]
            vol[cm_ & flint] = ID["andesite"]
            sp_ = cm_ & splash; pick_s = crg.random(vol.shape, dtype=np.float32)
            vol[sp_ & (pick_s < 0.25)] = ID["mossy_cobblestone"]; vol[sp_ & (pick_s >= 0.25) & (pick_s < 0.4)] = ID["andesite"]; vol[sp_ & (pick_s >= 0.4) & (pick_s < 0.5)] = ID["stone"]
        # surface, water, ice
        ix, iz = np.indices((W, D))
        vol[ix, Yt - YMIN, iz] = surf[a0:a1, b0:b1]
        wl = water_level[a0:a1, b0:b1]
        wm = (yy > Ye) & (yy <= wl[:, None, :])
        vol[wm] = ID["water"]
        rt_ = reg[a0:a1, b0:b1]; wett = wet[a0:a1, b0:b1]
        icy = wett & (rt_ == FROST) & (wl > -999) & (land[a0:a1, b0:b1] | (box((land[a0:a1, b0:b1]).astype(np.float32), 10) > 0.3))
        vol[ix[icy], wl[icy] - YMIN, iz[icy]] = ID["ice"]
        # caves (map/caves.py): carve, fill aquifers and lava, iron on the starter caves' walls, then dress them
        cv_, aq_ = CAV.tile(X0 + a0, Z0 + b0, Yt, YR, None)
        cv_ &= (vol != ID["water"]) & (vol != ID["ice"]) & (vol != ID["bedrock"])
        vol[cv_] = AIR
        cvy_ = np.broadcast_to(yy, vol.shape)
        vol[cv_ & (cvy_ <= aq_[:, None, :]) & (aq_[:, None, :] > CV.LAVA_Y)] = ID["water"]      # aquifers
        vol[cv_ & (cvy_ <= CV.LAVA_Y) & (aq_[:, None, :] <= CV.LAVA_Y)] = ID["lava"]            # lava at the bottom
        for ox_, oy_, oz_, ok_ in CAV.ore_spots:
            i_, j_, k_ = int(round(ox_)) - X0 - a0, int(round(oy_)) - YMIN, int(round(oz_)) - Z0 - b0
            if not (1 <= i_ < W - 1 and 2 <= j_ < YR - 1 and 1 <= k_ < D - 1): continue
            blk_ = vol[i_ - 1:i_ + 2, j_ - 1:j_ + 2, k_ - 1:k_ + 2]
            pick_ = np.isin(blk_, ROCK_IDS) & (np.random.default_rng(i_ * 7 + j_ * 13 + k_).random(blk_.shape) < 0.55)
            blk_[pick_] = ID[("deepslate_" if oy_ < 0 else "") + ok_ + "_ore"]
        cave_stats_ = CAV.dress(vol, cv_, Yt, X0 + a0, Z0 + b0, reg[a0:a1, b0:b1], CAVE_IDS, AIR, ID["water"], ID["lava"], ROCK_IDS,
                                np.random.default_rng(31000 + tx0 * 7 + tz0))
        CV.no_falling(vol, AIR, [(ID["sand"], ID["sandstone"]), (ID["red_sand"], ID["red_sandstone"]), (ID["gravel"], ID["stone"])])
        opened_ = OPENED[a0:a1, b0:b1]
        del cv_, cvy_
        # rail tunnels (air 4 high over a gravel floor, the hill left above) and bridges (stone deck, low parapets,
        # piers every 8 blocks); road bridges a block over the river
        tf = tun_floor[a0:a1, b0:b1]; tm_ = tf > -999
        if tm_.any():
            for h_ in range(1, 5): vol[ix[tm_], tf[tm_] + h_ - YMIN, iz[tm_]] = AIR
            vol[ix[tm_], tf[tm_] - YMIN, iz[tm_]] = ID["gravel"]
            rf_ = tm_ & (Yt >= tf + 5); vol[ix[rf_], tf[rf_] + 5 - YMIN, iz[rf_]] = ID["stone_bricks"]   # lined roof
            tw_ = tun_wall[a0:a1, b0:b1]; twy = tun_wall_y[a0:a1, b0:b1]; tw_ = tw_ & (Yt >= twy + 1)
            for h_ in range(0, 6):                                                # lined walls, which make the portal faces
                m2_ = tw_ & (Yt >= twy + h_); vol[ix[m2_], twy[m2_] + h_ - YMIN, iz[m2_]] = ID["stone_bricks"]
        bd = br_deck[a0:a1, b0:b1]; bm_ = bd > -999
        if bm_.any():
            vol[ix[bm_], bd[bm_] - YMIN, iz[bm_]] = ID["stone_bricks"]
            for h_ in range(1, 5): vol[ix[bm_], bd[bm_] + h_ - YMIN, iz[bm_]] = AIR
            bw = bm_ & br_wall[a0:a1, b0:b1]; vol[ix[bw], bd[bw] + 1 - YMIN, iz[bw]] = ID["stone_bricks"]
            bp = bm_ & br_pier[a0:a1, b0:b1]
            for i_, k_ in zip(ix[bp], iz[bp]):
                for dx_ in (-1, 0, 1):
                    for dz_ in (-1, 0, 1):
                        i2, k2 = i_ + dx_, k_ + dz_
                        if 0 <= i2 < W and 0 <= k2 < D: vol[i2, Yt[i2, k2] - YMIN:bd[i_, k_] - YMIN, k2] = ID["stone_bricks"]
        rb_ = roadbridge[a0:a1, b0:b1] & (wl > -999)
        if rb_.any(): vol[ix[rb_], wl[rb_] + 1 - YMIN, iz[rb_]] = ID["stone_bricks"]
        # lily pads and seagrass
        lm = lily[a0:a1, b0:b1]; vol[ix[lm], wl[lm] + 1 - YMIN, iz[lm]] = ID["waterlily"]
        sg = seagr[a0:a1, b0:b1]; vol[ix[sg], Yt[sg] + 1 - YMIN, iz[sg]] = ID["seagrass"]
        # bedrock
        vol[:, 0, :] = ID["bedrock"]
        br = np.random.default_rng(9000 + tx0 + tz0 * 3).random((W, 4, D)) < np.array([0.8, 0.6, 0.4, 0.2])[None, :, None]
        vol[:, 1:5, :][br] = ID["bedrock"]
        # plants
        p_ = plant[a0:a1, b0:b1]; pm = (p_ > 0) & ~opened_; vol[ix[pm], Yt[pm] + 1 - YMIN, iz[pm]] = p_[pm]
        # trees whose base is in this tile or its margin
        tm = (tx >= X0 + a0 - TREEM) & (tx < X0 + a1 + TREEM) & (tz >= Z0 + b0 - TREEM) & (tz < Z0 + b1 + TREEM)
        for x_, z_, kk_, vv_ in zip(tx[tm], tz[tm], tkind[tm], tvar[tm]):
            off, ids, isleaf, isg = TEMPL[KLIST[kk_]][vv_]
            gy = Y[x_ - X0, z_ - Z0] + 1
            if OPENED[x_ - X0, z_ - Z0]: continue                                  # a cave mouth took its ground
            px_ = x_ - X0 - a0 + off[:, 0]; py_ = gy - YMIN + off[:, 1]; pz_ = z_ - Z0 - b0 + off[:, 2]
            ok_ = (px_ >= 0) & (px_ < W) & (pz_ >= 0) & (pz_ < D) & (py_ > 0) & (py_ < YR)
            if isg.any():                                                      # ground cells follow each column's own surface
                g_ = ok_ & isg; py_[g_] = Yt[px_[g_], pz_[g_]] - YMIN
                g2 = g_.copy(); g2[g_] = np.isin(vol[px_[g_], py_[g_], pz_[g_]], NATURAL_G); ok_ &= ~g_ | g2
            px_, py_, pz_, ids_, lf_ = px_[ok_], py_[ok_], pz_[ok_], ids[ok_], isleaf[ok_]
            cur = vol[px_, py_, pz_]
            put = ~lf_ | (cur == AIR)
            vol[px_[put], py_[put], pz_[put]] = ids_[put]
            if 0 <= x_ - X0 - a0 < W and 0 <= z_ - Z0 - b0 < D and KLIST[kk_] in KINDS and KLIST[kk_] != "cactus":
                vol[x_ - X0 - a0, gy - 1 - YMIN, z_ - Z0 - b0] = ID["dirt"] if reg[x_ - X0, z_ - Z0] != FEN else ID["mud"]
        # town plazas and plot markers
        for name, wx_, wz_, rad_, block_ in [(n, PLAZA[n][0], PLAZA[n][1], 9 if n == "Kingsrest" else 6, "stone_bricks") for n, x, z, r, _ in TOWNS if n not in STAMPED_TOWNS] + [(n, x, z, 3, "stone_bricks") for n, x, z in PLOTS]:
            x_, z_ = wx_ - X0 - a0, wz_ - Z0 - b0
            if not (-rad_ <= x_ < W + rad_ and -rad_ <= z_ < D + rad_): continue
            gx_, gz_ = wx_ - X0, wz_ - Z0
            if not (0 <= gx_ < SIZE and 0 <= gz_ < SIZE): continue
            yb = int(np.median(Y[max(0, gx_ - rad_):gx_ + rad_ + 1, max(0, gz_ - rad_):gz_ + rad_ + 1]))
            pr = np.random.default_rng(abs(hash(name)) % 2**32)
            for dx in range(-rad_, rad_ + 1):
                for dz in range(-rad_, rad_ + 1):
                    if dx * dx + dz * dz > rad_ * rad_ + 1: continue
                    i, k_ = x_ + dx, z_ + dz
                    if not (0 <= i < W and 0 <= k_ < D): continue
                    vol[i, yb + 1 - YMIN:yb + 30 - YMIN, k_] = AIR
                    vol[i, min(Yt[i, k_], yb) - YMIN:yb - YMIN, k_] = ID["dirt"]
                    vol[i, yb - YMIN, k_] = ID[block_] if pr.random() < 0.8 else ID["mossy_cobblestone"]
            if 0 <= x_ < W and 0 <= z_ < D: vol[x_, yb + 1 - YMIN, z_] = ID["gold_block"]
        # baked town plans (streets, levelled plots, fields, well, lamps, trees)
        for sx_, sy_, sz_, sid_, ss_ in STAMPED:
            i_ = sx_ - X0 - a0; k_ = sz_ - Z0 - b0; j_ = sy_ - YMIN
            m_ = (i_ >= 0) & (i_ < W) & (k_ >= 0) & (k_ < D) & (j_ > 0) & (j_ < YR)
            if not m_.any(): continue
            i_, j_, k_, v_, s_ = i_[m_], j_[m_], k_[m_], sid_[m_], ss_[m_]
            for q_ in range(len(i_)):                                     # in order: later blocks win
                if s_[q_] and vol[i_[q_], j_[q_], k_[q_]] != AIR: continue
                vol[i_[q_], j_[q_], k_[q_]] = AIR if v_[q_] < 0 else v_[q_]
        # snow over the north: on ground and leaves, not on water, ice or plants
        ft = snowcover[a0:a1, b0:b1]
        if ft.any():
            nonair = vol != AIR
            topi = YR - 1 - np.argmax(nonair[:, ::-1, :], axis=1)
            topb = vol[ix, topi, iz]
            okb = ft & ~np.isin(topb, [ID["water"], ID["ice"], ID["fern"], ID["short_grass"], ID["sweet_berry_bush"], ID["moss_carpet"], ID["cactus"], ID["lava"], ID["snow"]]) & (topi + 1 < YR)
            vol[ix[okb], topi[okb] + 1, iz[okb]] = ID["snow_layer"]
        if os.environ.get("GW_DUMP") and (not os.environ.get("GW_DUMP_TILES") or f"{tx0},{tz0}" in os.environ["GW_DUMP_TILES"].split(";")):   # debugging: save this tile's blocks for the voxel viewer
            names_ = {int(v): k for k, v in ID.items()}; names_[int(AIR)] = "air"
            names_.update({int(i): k[:k.index("{")].split(":")[1] for k, i in _pal.items()})
            np.savez_compressed(f"{os.environ['GW_DUMP']}-{tx0}-{tz0}.npz", vol=vol[tx0 - a0:tx0 - a0 + min(TILE, SIZE - tx0), :, tz0 - b0:tz0 - b0 + min(TILE, SIZE - tz0)],
                                ymin=YMIN, x0=X0 + tx0, z0=Z0 + tz0, names=json.dumps(names_))
        # preview: top block of the inner tile
        ia0, ia1 = tx0 - a0, tx0 - a0 + min(TILE, SIZE - tx0); ib0, ib1 = tz0 - b0, tz0 - b0 + min(TILE, SIZE - tz0)
        inner = vol[ia0:ia1, :, ib0:ib1]
        topi = YR - 1 - np.argmax((inner != AIR)[:, ::-1, :], axis=1)
        ii2, kk2 = np.indices(topi.shape)
        pv[tx0:tx0 + ia1 - ia0, tz0:tz0 + ib1 - ib0] = inner[ii2, topi, kk2]
        # chunks
        for cx in range((X0 + tx0) >> 4, ((X0 + min(SIZE, tx0 + TILE) - 1) >> 4) + 1):
            for cz in range((Z0 + tz0) >> 4, ((Z0 + min(SIZE, tz0 + TILE) - 1) >> 4) + 1):
                lx0 = cx * 16 - X0 - a0; lz0 = cz * 16 - Z0 - b0
                if lx0 < 0 or lz0 < 0 or lx0 + 16 > W or lz0 + 16 > D: continue
                if cx * 16 - X0 < tx0 or cz * 16 - Z0 < tz0: continue
                ch = Chunk(cx, cz)
                ch.blocks[:, YMIN:TOP, :] = vol[lx0:lx0 + 16, :, lz0:lz0 + 16].astype(np.uint32)
                ch.biomes = biome[cx * 16 - X0:cx * 16 - X0 + 16, cz * 16 - Z0:cz * 16 - Z0 + 16].copy()
                level.put_chunk(ch, DIM); nchunks += 1
        level.save(); level.unload()
        log(f"tile {tx0},{tz0} done, chunks so far {nchunks}")
level.close()
log("chunks", nchunks)

# ---------------------------------------------------------------- preview picture
COL = {"grass_block": (96, 150, 70), "dirt": (134, 96, 67), "coarse_dirt": (119, 85, 59), "podzol": (91, 63, 24), "stone": (125, 125, 125),
       "andesite": (136, 136, 137), "calcite": (223, 224, 220), "sand": (219, 207, 163), "red_sand": (190, 102, 33), "gravel": (131, 127, 126),
       "water": (52, 92, 190), "ice": (160, 190, 250), "snow_layer": (240, 244, 246), "snow": (250, 252, 252), "tuff": (108, 109, 102), "packed_ice": (141, 180, 250), "granite": (149, 103, 85), "diorite": (188, 188, 188), "mud": (60, 57, 60),
       "moss_block": (89, 109, 45), "grass_path": (148, 122, 65), "cobblestone": (110, 110, 110), "mossy_cobblestone": (100, 118, 95),
       "sandstone": (216, 203, 155), "stone_bricks": (122, 121, 122), "gold_block": (246, 208, 61), "clay": (160, 166, 179),
       "waterlily": (32, 128, 48), "seagrass": (40, 110, 60), "cactus": (88, 130, 44), "deadbush": (107, 79, 41),
       "muddy_mangrove_roots": (70, 58, 45), "red_sandstone": (186, 99, 29)}
for n in ["oak_leaves", "birch_leaves", "spruce_leaves", "mangrove_leaves", "dark_oak_leaves", "acacia_leaves"]: COL[n] = {"oak_leaves": (60, 110, 40), "birch_leaves": (110, 140, 70), "spruce_leaves": (50, 80, 55), "mangrove_leaves": (70, 105, 40), "dark_oak_leaves": (45, 80, 30), "acacia_leaves": (110, 120, 40)}[n]
lut = np.zeros((int(max(list(ID.values()) + list(_pal.values()))) + 2, 3), np.uint8) + np.array([150, 120, 110], np.uint8)
for key, i in _pal.items():
    short_ = key[:key.index("{")].split(":")[1]
    lut[i] = COL.get(short_) or COL.get(short_.replace("_slab", "").replace("_stairs", "")) or ((58, 104, 40) if "leaves" in key else (60, 110, 45) if ("vine" in key or "moss" in key)
              else (130, 130, 128) if any(w in key for w in ("stone", "brick", "cobble", "andesite", "slab", "stairs", "wall")) else (96, 78, 52))
for n, c in COL.items():
    if n in ID: lut[ID[n]] = c
for n in TERRA: lut[n] = (170, 90, 60)
img = lut[pv].astype(np.float32)
shade = np.clip(1 + np.gradient(Y.astype(np.float32), axis=0) * 0.06 - np.gradient(Y.astype(np.float32), axis=1) * 0.06, 0.7, 1.3)
img = np.clip(img * shade[..., None], 0, 255).astype(np.uint8).transpose(1, 0, 2)
Image.fromarray(img).save(out.rstrip('/') + "-preview.png")
log("preview saved")
