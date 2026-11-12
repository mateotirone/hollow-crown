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

Y = np.round(Yf).astype(np.int32)
Y[land & ~fenpool & ~islake] = np.maximum(Y[land & ~fenpool & ~islake], SEA + 1)
Y[~land] = np.minimum(Y[~land], SEA - 1)            # the sea bed stays under water (no grass specks at sea level)
Y[isriver] -= 3; Y[bank] -= 1
water_level = np.full((SIZE, SIZE), -999, np.int32)
water_level[~land] = SEA
water_level[isriver] = Y[isriver] + 2
water_level[fenpool] = SEA
water_level[islake] = lakelevel[islake]
wet = water_level > Y

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
SEQ = {}
for lname, pts in L["roads"].items():
    P = np.asarray(pts, float)
    SEQ[lname] = [sid for sid, st in sorted(stops_on(P), key=lambda t: int(np.argmin(np.hypot(P[:, 0] - t[1]["x"], P[:, 1] - t[1]["z"]))))]
_foot = {}                                         # how far out each stamped town's blocks reach
for fn_ in filter(None, os.environ.get("GW_BLOCKS", "").split(":")):
    d_ = json.load(open(fn_)); b_ = np.array(d_["blocks"], np.int64)[:, [0, 2]]
    _foot[d_["town"]] = b_
R_TOWNS = []
for n_, x_, z_, r_, _ in TOWNS:
    if n_ in _foot: R_ = int(np.hypot(_foot[n_][:, 0] - x_, _foot[n_][:, 1] - z_).max()) + 6
    else: R_ = int(r_ * 1.12) + 10
    R_TOWNS.append((slug(n_), x_, z_, R_))
AVOID = [(x_, z_, 82) for _, x_, z_ in PLOTS] + [(x_, z_, int(r_ * 0.7)) for _, x_, z_, r_, _ in WARDS[6:]]
STATION_POS, LINE_PTS = railroute.plan_network(Y, wet, land, X0, Z0, STOPS, SEQ, R_TOWNS, AVOID, log=log)
for sid_, (x_, z_, _) in STATION_POS.items(): STOPS[sid_].update({"x": x_, "z": z_})
for lname in SEQ:
    pts = LINE_PTS[lname]
    on = [(sid, STOPS[sid]) for sid in SEQ[lname]]
    stops_ = [(st["x"], st["z"], STATION_POS[sid][2][-1]) for sid, st in on]
    cells, si = railplan.trace(pts, stops_, routed=True)
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
segs = []
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
         "orange_terracotta", "red_terracotta", "yellow_terracotta", "white_terracotta", "brown_terracotta", "light_gray_terracotta", "bone_block"]
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
m = R[FROST] & (Y > snowline) & (slope < 0.9); surf[m] = np.where(r2[m] < 0.85, ID["snow"], ID["packed_ice"]); sub[m] = ID["stone"]
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
# steep ground shows rock (banded terracotta in the Emberwaste, calcite streaks in the north)
m = steep & ~R[EMBER]; surf[m] = np.where(r1[m] < 0.5, ID["stone"], np.where(R[FROST][m] & (r2[m] < 0.15), ID["calcite"], ID["andesite"]))
mesa = R[EMBER] & (steep | (Y > 112))
# chalk cliffs: grass right to the edge over a thin soil, white where a column stands below its neighbours (faces,
# ledges), flint shingle with fallen chalk blocks at the foot, and a pale platform of chalk, weed and gravel under the water
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
m = pl & R[FROST] & (Y < 135) & (r2 > 0.93); plant[m] = np.where(k[m] < 0.6, ID["fern"], np.where(k[m] < 0.9, ID["short_grass"], ID["sweet_berry_bush"]))
m = pl & R[SALT] & (surf == ID["grass_block"]) & (r2 > 0.85); plant[m] = ID["short_grass"]
m = pl & R[FEN] & ((surf == ID["grass_block"]) | (surf == ID["moss_block"])) & (r2 > 0.75); plant[m] = np.where(k[m] < 0.6, ID["short_grass"], ID["fern"])
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
for d_ in GW_FILES:
    pid_ = np.array([B_raw(e["name"], e["states"]) if e["name"] != "minecraft:air" else -1 for e in d_["palette"]], np.int64)
    sf_ = np.array([bool(e.get("soft")) for e in d_["palette"]])
    b_ = np.array(d_["blocks"], np.int64)
    STAMPED.append((b_[:, 0], b_[:, 1], b_[:, 2], pid_[b_[:, 3]], sf_[b_[:, 3]])); STAMPED_TOWNS.add(d_["town"])
    log("town plan", d_["town"], len(b_), "blocks")
if BRIDGE_BLOCKS:
    _bb = np.array([(x, y, z) for x, y, z, _, _ in BRIDGE_BLOCKS], np.int64)
    _bi = np.array([B_raw(n, st) if n != "minecraft:air" else -1 for _, _, _, n, st in BRIDGE_BLOCKS], np.int64)
    STAMPED.append((_bb[:, 0], _bb[:, 1], _bb[:, 2], _bi, np.zeros(len(_bi), bool)))
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
    hard_t = keepclear | railzone                    # crowns stay off the line (trains need the air above the bed)
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

# ---------------------------------------------------------------- caves: winding tunnels, sealed under the ground
crg = np.random.default_rng(123)
area_cells = (SIZE // 48) ** 2
worms = []
for _ in range(int(area_cells * 5)):
    x = X0 + crg.random() * SIZE; z = Z0 + crg.random() * SIZE; y = crg.uniform(-50, 60)
    yaw = crg.random() * 6.28; pitch = crg.uniform(-0.3, 0.3); rad = crg.uniform(1.6, 3.2)
    big = crg.random() < 0.08
    pts = []
    for s in range(int(crg.integers(60, 200))):
        x += math.cos(yaw) * math.cos(pitch) * 1.4; z += math.sin(yaw) * math.cos(pitch) * 1.4; y += math.sin(pitch) * 1.2
        yaw += crg.normal(0, 0.18); pitch = pitch * 0.85 + crg.normal(0, 0.12)
        r = rad + math.sin(s * 0.21) * 0.7 + (2.5 if big and 20 < s < 50 else 0)
        pts.append((x, y, z, r))
    worms.append(np.array(pts, np.float32))
caves = np.concatenate(worms) if worms else np.zeros((0, 4), np.float32)
# never reach within 7 blocks of the surface, or under water within 10
ci = np.clip(np.round(caves[:, 0] - X0).astype(int), 0, SIZE - 1); ck = np.clip(np.round(caves[:, 2] - Z0).astype(int), 0, SIZE - 1)
ceiling = Y[ci, ck] - 7 - caves[:, 3] - np.where(wet[ci, ck], 4, 0)
caves[:, 1] = np.minimum(caves[:, 1], ceiling); caves[:, 1] = np.maximum(caves[:, 1], -58)
log("cave points", len(caves))

ORES = [  # name, deepslate twin, veins per 16x16 column, y low, y high, vein size
    ("coal_ore", "deepslate_coal_ore", 14, 0, 140, 10), ("iron_ore", "deepslate_iron_ore", 9, -40, 80, 7),
    ("copper_ore", "deepslate_copper_ore", 6, -10, 90, 8), ("gold_ore", "deepslate_gold_ore", 2.2, -60, 30, 6),
    ("redstone_ore", "deepslate_redstone_ore", 3, -60, -20, 6), ("lapis_ore", "deepslate_lapis_ore", 1.6, -50, 30, 5),
    ("diamond_ore", "deepslate_diamond_ore", 1.0, -60, -15, 4),
]
BLOBS = [("granite", 1.2, -20, 120, 3.5), ("diorite", 1.2, -20, 120, 3.5), ("andesite", 1.4, -20, 120, 3.5), ("gravel", 0.8, -40, 100, 2.5),
         ("dirt", 0.8, 0, 120, 2.5), ("tuff", 1.2, -60, 0, 3.5)]

# ---------------------------------------------------------------- write tiles
TOP = int(Y.max()) + 45; YR = TOP - YMIN
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
        def blob_fill(name, n, ylo, yhi, rad, only=(ID["stone"], ID["deepslate"]), alt=None, size=None):
            cnt = trg2.poisson(n * W * D / 256)
            if not cnt: return
            bx = trg2.integers(0, W, cnt); bz = trg2.integers(0, D, cnt); by = trg2.integers(ylo, yhi, cnt) - YMIN
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
        for name, alt, n, lo, hi, size in ORES: blob_fill(name, n, lo, hi, 1.5, alt=alt, size=size)
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
        # caves
        cm = (caves[:, 0] >= X0 + a0 - 6) & (caves[:, 0] < X0 + a1 + 6) & (caves[:, 2] >= Z0 + b0 - 6) & (caves[:, 2] < Z0 + b1 + 6)
        for cx_, cy_, cz_, cr_ in caves[cm]:
            lx_, ly_, lz_ = cx_ - X0 - a0, cy_ - YMIN, cz_ - Z0 - b0; ri = int(math.ceil(cr_))
            i0, i1 = max(0, int(lx_) - ri), min(W, int(lx_) + ri + 2); j0, j1 = max(1, int(ly_) - ri), min(YR, int(ly_) + ri + 2); k0, k1 = max(0, int(lz_) - ri), min(D, int(lz_) + ri + 2)
            if i0 >= i1 or k0 >= k1 or j0 >= j1: continue
            ii, jj, kk = np.ogrid[i0:i1, j0:j1, k0:k1]
            sm = (ii - lx_) ** 2 + ((jj - ly_) * 1.3) ** 2 + (kk - lz_) ** 2 <= cr_ * cr_
            sub_ = vol[i0:i1, j0:j1, k0:k1]
            sub_[sm & (sub_ != AIR)] = AIR
        lava = (vol == AIR) & (yy < -54) & solid
        vol[lava] = ID["lava"]
        # surface, water, ice
        ix, iz = np.indices((W, D))
        vol[ix, Yt - YMIN, iz] = surf[a0:a1, b0:b1]
        wl = water_level[a0:a1, b0:b1]
        wm = (yy > Ye) & (yy <= wl[:, None, :])
        vol[wm] = ID["water"]
        rt_ = reg[a0:a1, b0:b1]; wett = wet[a0:a1, b0:b1]
        icy = wett & (rt_ == FROST) & (wl > -999) & (land[a0:a1, b0:b1] | (box((land[a0:a1, b0:b1]).astype(np.float32), 10) > 0.3))
        vol[ix[icy], wl[icy] - YMIN, iz[icy]] = ID["ice"]
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
        p_ = plant[a0:a1, b0:b1]; pm = p_ > 0; vol[ix[pm], Yt[pm] + 1 - YMIN, iz[pm]] = p_[pm]
        # trees whose base is in this tile or its margin
        tm = (tx >= X0 + a0 - TREEM) & (tx < X0 + a1 + TREEM) & (tz >= Z0 + b0 - TREEM) & (tz < Z0 + b1 + TREEM)
        for x_, z_, kk_, vv_ in zip(tx[tm], tz[tm], tkind[tm], tvar[tm]):
            off, ids, isleaf, isg = TEMPL[KLIST[kk_]][vv_]
            gy = Y[x_ - X0, z_ - Z0] + 1
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
            okb = ft & ~np.isin(topb, [ID["water"], ID["ice"], ID["fern"], ID["short_grass"], ID["sweet_berry_bush"], ID["cactus"], ID["lava"], ID["snow"]]) & (topi + 1 < YR)
            vol[ix[okb], topi[okb] + 1, iz[okb]] = ID["snow_layer"]
        if os.environ.get("GW_DUMP"):                                   # debugging: save this tile's blocks for the voxel viewer
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
