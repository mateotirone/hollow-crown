"""The ground each plot's story stands on (thread "Match story areas to the map", 2026-11-12).

Every plot's old landmark (Siege_Nights_BP/scripts/lore/data/plots.js `build`, placed at PLOT_PLAN[i].relic) belongs to
a piece of land its story describes: a river bank, an island in the fen, an oasis among dunes, a mesa top, a cliff. On
the generated map several of those did not exist (Harrowford's nearest water was 235 blocks off, Lanternbog was dry on
every side, Dunehold had no water within 331 blocks, Redmesa was flat...). This step shapes that land, one small area
per plot, just outside the settlement's level ground (SETTLEMENT.flatRadius 74), and never on a road, trail or rail.

    shape(GX, GZ, Yf, land, protect, sea) -> Ground

GX, GZ: world x and z of every column (2-D, [x, z]); Yf: float ground height, changed in place and returned;
land: True on land; protect: True where nothing may change (roads, trails, rails, bridges, with a margin); sea: the
sea's water level. Returned masks tell genworld what to do with the blocks:
    water, level   columns that hold still water, and its surface y (backwater, moat, oasis pool, inlets)
    sand           dune sand, beach sand round the oasis and the inlets
    chalk, top     chalk faces of the Gullcliff zawn and the clifftop height they belong to (genworld's chalk rules)
    copper         the Frosthelm crag face, where copper ore shows in the stone

Run on its own (python3 map/plotground.py HEIGHTS.npy WATER.npy OUT_PREFIX) it applies the step to an existing map's
heights and water (the .npy grids, origin -1264) and writes OUT_PREFIX-heights.npy / -water.npy, for previews and for
the landmark spots (map/structures/landmark_preview.mjs).
"""
import math
import numpy as np

# Each site in world coordinates. Plot centres and landmarks: Siege_Nights_BP/scripts/plots/config.js PLOT_PLAN.
SITES = {
    # a backwater of the lower Alder (an old river arm, cut off) curving past the meadow, for the ferry post
    "Harrowford": dict(kind="oxbow", plot=(-470, -300), relic=(-443, -228), bearing=157, near=20, r=46, width=9, sweep=75),
    # the dry island: a ring of black water round the plot, open to the north where the gate, road and rail come in
    "Lanternbog": dict(kind="moat", plot=(260, 980), inner=88, width=24, gap=(0, 32)),
    # the oasis pool south of the well and its palms, and dunes round the plot
    "Dunehold": dict(kind="oasis", plot=(760, 860), pool=(655, 887), rx=12, rz=7, dunes=(90, 190), calm=(653, 862, 36)),  # calm: well and palms on level sand
    # a mesa the landmark's stone yard stands on, its south lip at the plot's edge, a ramp up from the plot
    "Redmesa": dict(kind="mesa", plot=(700, 60), centre=(700, -44), rx=50, rz=30, rise=14, ramp=((746, -6), (722, -11))),
    # the highest ground of the plot: a knoll under the bell frame
    "Thistledown": dict(kind="knoll", plot=(300, 130), relic=(374, 110), out=6, r=13, rise=7),
    # the plateau edge behind the cairn: a scarp falling away outward
    "Wolfcairn": dict(kind="scarp", plot=(520, -1010), relic=(579, -1059), back=9, drop=12, half=48, reach=90),
    # the cliff behind the plot with copper in it, west of the cart road
    "Frosthelm": dict(kind="crag", plot=(-520, -760), x=(-542, -503), z=(-884, -836), rise=10),   # 26+ from the landmark, so the road still finds the hill north
    # the beach the posts run down: a tidal inlet from the sea up to a sandy cove below the landmark
    "Tidewatch": dict(kind="inlet", plot=(-560, 650), path=[(-660, 812), (-641, 784), (-628, 758), (-612, 742)], width=11, cove=16, beach=True),
    # the cliff the beacon stands on: a sea zawn cut back from the chalk coast to just below the landmark
    "Gullcliff": dict(kind="inlet", plot=(-760, -560), path=[(-936, -478), (-905, -494), (-878, -503), (-850, -518)], width=12, cove=11, zawn=True),
}


class Ground:
    def __init__(self, shape):
        self.water = np.zeros(shape, bool)
        self.level = np.full(shape, -999, np.int32)
        self.sand = np.zeros(shape, bool)
        self.chalk = np.zeros(shape, bool)
        self.top = np.zeros(shape, np.float32)
        self.copper = np.zeros(shape, bool)
        self.turf = np.zeros(shape, bool)       # grass downs, even where the region's ground is sand


def _vnoise(gx, gz, scale, seed):
    """Smooth value noise in [-0.5, 0.5] by world position (the same anywhere it is sampled)."""
    fx, fz = gx / scale, gz / scale
    ix, iz = np.floor(fx).astype(np.int64), np.floor(fz).astype(np.int64)
    tx, tz = fx - ix, fz - iz
    tx, tz = tx * tx * (3 - 2 * tx), tz * tz * (3 - 2 * tz)
    def h(a, b):
        v = (a * 73856093) ^ (b * 19349663) ^ (seed * 83492791)
        v = (v ^ (v >> 13)) * 1274126177
        return ((v ^ (v >> 16)) & 0xFFFF).astype(np.float32) / 65535.0
    return (h(ix, iz) * (1 - tx) * (1 - tz) + h(ix + 1, iz) * tx * (1 - tz) + h(ix, iz + 1) * (1 - tx) * tz + h(ix + 1, iz + 1) * tx * tz) - 0.5


def _smooth(t):
    t = np.clip(t, 0, 1)
    return t * t * (3 - 2 * t)


def _seg_dist(px, pz, path):
    """Distance from every column to a polyline, and how far along it (0..1) the nearest point lies."""
    best = np.full(px.shape, 1e9, np.float32); along = np.zeros(px.shape, np.float32)
    total = sum(math.dist(a, b) for a, b in zip(path, path[1:])); done = 0.0
    for (ax, az), (bx, bz) in zip(path, path[1:]):
        vx, vz = bx - ax, bz - az; L2 = vx * vx + vz * vz; L = math.sqrt(L2)
        t = np.clip(((px - ax) * vx + (pz - az) * vz) / L2, 0, 1)
        d = np.hypot(px - (ax + t * vx), pz - (az + t * vz))
        m = d < best
        best = np.where(m, d, best); along = np.where(m, (done + t * L) / total, along)
        done += L
    return best, along


def shape(GX, GZ, Yf, land, protect, sea, only=None):
    g = Ground(Yf.shape)
    x0w, z0w = int(GX[0, 0]), int(GZ[0, 0])
    keep = protect.astype(np.float32)
    for name, s in SITES.items():
        if only and name not in only: continue
        cx, cz = s["plot"]
        R = 240
        a0, a1 = max(0, cx - R - x0w), min(Yf.shape[0], cx + R - x0w); b0, b1 = max(0, cz - R - z0w), min(Yf.shape[1], cz + R - z0w)
        if a0 >= a1 or b0 >= b1: continue
        win = (slice(a0, a1), slice(b0, b1))
        X, Z, Y, L = GX[win].astype(np.float32), GZ[win].astype(np.float32), Yf[win], land[win]
        # nothing changes on a road, trail or rail; the change fades in over 6 blocks beside them
        free = 1 - _box_max(keep[win], 6)
        out = _SHAPERS[s["kind"]](s, X, Z, Y.copy(), L, sea, g, win)
        Ynew = out
        Yf[win] = np.where(L, Y * (1 - free) + Ynew * free, Y)
        for m in (g.water, g.sand, g.chalk, g.copper, g.turf):
            m[win] &= free > 0.5
    return Yf, g


def _box_max(a, k):
    """Soft dilation: 1 on and next to the mask, falling to 0 k blocks away."""
    out = a.copy()
    for _ in range(k):
        p = np.pad(out, 1, mode="edge")
        out = np.maximum(out, np.maximum.reduce([p[:-2, 1:-1], p[2:, 1:-1], p[1:-1, :-2], p[1:-1, 2:]]) - 1.0 / k)
    return np.clip(out, 0, 1)


# ---------------------------------------------------------------- the shapes

def _water_body(g, win, m, level, Y, depth):
    """Hold still water over mask m at `level`, the bed `depth` (array or number) under it."""
    Y = np.where(m, np.minimum(Y, level - depth), Y)
    g.water[win] |= m
    g.level[win] = np.where(m, level, g.level[win])
    return Y


def oxbow(s, X, Z, Y, L, sea, g, win):
    """A crescent of still water: an arc of radius r whose inner side passes `near` blocks off the landmark."""
    rx, rz = s["relic"]; b = math.radians(s["bearing"]); dx, dz = math.sin(b), -math.cos(b)
    ox, oz = rx + dx * (s["near"] + s["r"]), rz + dz * (s["near"] + s["r"])      # centre of the arc
    d = np.hypot(X - ox, Z - oz)
    ang = np.degrees(np.arctan2(X - ox, -(Z - oz)))                               # bearing from the centre
    back = (math.degrees(math.atan2(-dx, dz)) + 360) % 360                        # toward the landmark
    off = np.abs(((ang - back + 540) % 360) - 180)                                 # 0 at the near side
    taper = 1 - _smooth((off - s["sweep"] * 0.7) / (s["sweep"] * 0.3))           # thins to nothing at the horns
    wob = _vnoise(X, Z, 17, 401) * 4
    half = (s["width"] / 2) * taper
    across = np.abs(d + wob - s["r"])
    m = (across < half) & (off < s["sweep"]) & L
    if not m.any(): return Y
    ring = (across < half + 6) & (off < s["sweep"] + 8) & L
    level = int(np.floor(np.percentile(Y[ring], 15))) - 1
    depth = 1 + 2.5 * (1 - across / np.maximum(half, 0.5))
    Y = _water_body(g, win, m, level, Y, np.where(m, depth, 0))
    bank = ~m & (across < half + 5) & (off < s["sweep"] + 4) & L                    # a low reedy bank down to the water
    Y = np.where(bank, np.minimum(Y, level + (across - half) * 0.55), Y)
    return Y


def moat(s, X, Z, Y, L, sea, g, win):
    """The island: a wide wandering band of black water round the plot at sea level, broken by reedy islets,
    the ground easing down to it on both sides, and a causeway left where the gate, road and rail come in."""
    px, pz = s["plot"]
    d = np.hypot(X - px, Z - pz) + _vnoise(X, Z, 31, 411) * 14 + _vnoise(X, Z, 9, 412) * 4
    ang = np.degrees(np.arctan2(X - px, -(Z - pz))) % 360
    gc, gw = s["gap"]
    gap = np.abs(((ang - gc + 540) % 360) - 180)
    k = _smooth((gap - gw) / 14)                                                    # 0 on the causeway, 1 round the rest
    k = k * (1 - _smooth((Y - (sea + 11)) / 5))                                     # rising ground (the hills east) stays
    inner = s["inner"] + 7                                                          # the wobble never reaches the plot
    w = s["width"] * (1 + 0.6 * (_vnoise(X, Z, 47, 413) + 0.5))
    t = (d - inner) / w                                                             # 0..1 across the water
    band = (t > 0) & (t < 1) & L
    bed = sea - 1 - 2.2 * np.sin(np.clip(t, 0, 1) * math.pi) + np.maximum(_vnoise(X, Z, 8, 414), 0) * 9 * (0.6 + 0.4 * np.abs(t - 0.5) * 2)
    bed = Y * (1 - k) + np.minimum(Y, bed) * k
    Y = np.where(band, bed, Y)
    m = band & (Y < sea - 0.4) & (k > 0.5)
    Y = np.where(m, np.minimum(Y, sea - 1), Y)
    g.water[win] |= m
    g.level[win] = np.where(m, sea, g.level[win])
    ease_in = (t <= 0) & (t > -9 / w) & L                                           # the island's shore
    ease_out = (t >= 1) & (t < 1 + 16 / w) & L                                      # the fen beyond comes down to it
    Y = np.where(ease_in, Y * (1 - k) + np.minimum(Y, sea + 1 + (-t * w) * 0.9) * k, Y)
    Y = np.where(ease_out, Y * (1 - k) + np.minimum(Y, sea + 1 + ((t - 1) * w) * 0.55) * k, Y)
    return Y


def oasis(s, X, Z, Y, L, sea, g, win):
    """The pool by the well (a block under the ground round it) with a sand rim, and wind-cut dunes round the plot."""
    qx, qz = s["pool"]
    rr = np.hypot((X - qx) / s["rx"], (Z - qz) / s["rz"]) + _vnoise(X, Z, 6, 421) * 0.35
    m = (rr < 1) & L
    if m.any():
        rim = (rr >= 1) & (rr < 1.6) & L
        level = int(np.floor(np.percentile(Y[rim], 20))) - 1
        Y = _water_body(g, win, m, level, Y, np.where(m, 1 + 3 * (1 - rr), 0))
        shore = (rr >= 1) & (rr < 1.7) & L
        Y = np.where(shore, np.minimum(Y, level + 1 + (rr - 1) * 3), Y)
        g.sand[win] |= shore
    # dunes: long ridges across the wind (from the west), crests 3 to 8 high, faded in and out of the band
    px, pz = s["plot"]; r0, r1 = s["dunes"]
    d = np.hypot(X - px, Z - pz)
    band = _smooth((d - r0) / 18) * (1 - _smooth((d - (r1 - 30)) / 30))
    band *= 1 - _smooth(1.8 - rr) if m.any() else 1                                 # none on the pool
    wx, wz, wr = s["calm"]
    band *= _smooth((np.hypot(X - wx, Z - wz) - wr) / 12)                           # none under the well and palms
    u = X * 0.94 + Z * 0.34 + _vnoise(X, Z, 70, 424) * 60                          # across the wind, bending
    wave = (np.sin(u / 13 + _vnoise(X, Z, 33, 422) * 6) + 1) / 2
    crest = wave ** 1.6 * (2 + 4 * (_vnoise(X, Z, 45, 423) + 0.5)) * (0.4 + 0.6 * _smooth(_vnoise(X, Z, 60, 425) * 2 + 0.6))
    crest = crest + (_vnoise(X, Z, 17, 426) + 0.5) * 2.5                            # hummocks between the ridges
    Y = Y + crest * band * L
    g.sand[win] |= (band > 0.2) & L
    return Y


def mesa(s, X, Z, Y, L, sea, g, win):
    """A flat-topped butte: banded cliffs (genworld bands steep Emberwaste ground), a talus apron, a ramp up."""
    mx, mz = s["centre"]
    q = (np.abs((X - mx) / s["rx"]) ** 3 + np.abs((Z - mz) / s["rz"]) ** 3) ** (1 / 3)
    q = q + _vnoise(X, Z, 21, 431) * 0.38 + _vnoise(X, Z, 8, 433) * 0.12        # lobes, bays and spurs
    inside = L & (q < 1.25)
    base = np.median(Y[inside]) if inside.any() else Y.mean()
    top = base + s["rise"] + _vnoise(X, Z, 15, 432) * 1.5                          # a slightly hummocky top
    face = _smooth((1.0 - q) / 0.05)                                                # sheer for ~2 blocks
    talus = (1 - _smooth((q - 1.0) / 0.2)) * (q >= 1.0) * 0.35                       # scree apron at the foot
    h = np.maximum(face, talus)
    Y = np.where(L, np.maximum(Y, Y * (1 - h) + top * h), Y)
    (ax, az), (bx, bz) = s["ramp"]                                                 # ramp: from the plot's ground to the lip
    dist, along = _seg_dist(X, Z, [(ax, az), (bx, bz)])
    r = (dist < 2.6) & L
    ramp_y = base + (top.max() - base - 1) * along
    Y = np.where(r, np.maximum(Y, ramp_y), Y)
    return Y


def knoll(s, X, Z, Y, L, sea, g, win):
    px, pz = s["plot"]; rx, rz = s["relic"]
    dx, dz = rx - px, rz - pz; n = math.hypot(dx, dz)
    kx, kz = rx + dx / n * s["out"], rz + dz / n * s["out"]
    d = np.hypot(X - kx, Z - kz) / s["r"] + _vnoise(X, Z, 8, 441) * 0.15
    hump = (np.cos(np.clip(d, 0, 1) * math.pi) + 1) / 2
    g.turf[win] |= L & (np.hypot(X - kx, Z - kz) < s["r"] * 2.2 + _vnoise(X, Z, 10, 443) * 12)   # "open downs": grass, not the sand next door
    return Y + s["rise"] * hump * L


def scarp(s, X, Z, Y, L, sea, g, win):
    """The plateau breaks off: a ragged, curving edge `back` blocks behind the landmark, the ground falling `drop`
    beyond it into a broad hollow that rises back to the natural plateau, `half` blocks wide along the edge."""
    px, pz = s["plot"]; rx, rz = s["relic"]
    dx, dz = rx - px, rz - pz; n = math.hypot(dx, dz); dx, dz = dx / n, dz / n
    R = s["half"] * 1.4                                                             # the hollow: a circle out beyond the edge
    ox, oz = rx + dx * (s["back"] + R), rz + dz * (s["back"] + R)
    d = np.hypot(X - ox, Z - oz) + _vnoise(X, Z, 19, 451) * 16 + _vnoise(X, Z, 6, 452) * 4
    fall = _smooth((R - d) / 3) * (1 - _smooth((R * 0.55 - d) / (R * 0.5)) * 0.5)
    fall = fall * (1 - _smooth((np.hypot(X - ox, Z - oz) - R * 1.6) / 20))
    return Y - s["drop"] * fall * L


def crag(s, X, Z, Y, L, sea, g, win):
    """A rock shelf west of the cart road, its ragged east face a cliff with copper showing; it sinks into the
    slope behind it to the west and north."""
    (x0, x1), (z0, z1) = s["x"], s["z"]
    wob = _vnoise(X, Z, 9, 461) * 7 + _vnoise(X, Z, 3, 463) * 2
    east = _smooth((x1 + wob - X) / 1.5)                                            # sheer east face, in bays and spurs
    west = _smooth((X - x0 + _vnoise(X, Z, 13, 464) * 8) / 12)
    north = _smooth((Z - z0 + _vnoise(X, Z, 11, 465) * 8) / 10); south = _smooth((z1 + wob - Z) / 3)
    h = east * west * north * south
    Y2 = np.maximum(Y, Y + s["rise"] * h + (_vnoise(X, Z, 5, 462) + 0.3) * 3 * h)
    Y2 = np.where(L, Y2, Y)
    g.copper[win] |= L & (h > 0.06) & (h < 0.92)                                   # the faces and their foot
    return Y2


def inlet(s, X, Z, Y, L, sea, g, win):
    """Sea water up a channel from the coast to a cove under the landmark. A beach inlet eases its banks down as
    sand; a zawn keeps them sheer and white (chalk)."""
    path = s["path"]
    dist, along = _seg_dist(X + _vnoise(X, Z, 23, 472) * 10, Z + _vnoise(X, Z, 23, 473) * 10, path)
    half = s["width"] / 2 + (s["cove"] - s["width"] / 2) * _smooth((along - 0.7) / 0.3) + _vnoise(X, Z, 9, 471) * 3 + _vnoise(X, Z, 4, 474) * 1.5
    m = dist < half
    hx, hz = path[-1]                                                               # round the head off
    m &= ~((along >= 0.999) & (np.hypot(X - hx, Z - hz) > half * (1 + _vnoise(X, Z, 5, 475) * 0.6)))
    orig = Y.copy()
    Y = _water_body(g, win, m, sea, Y, np.where(m, 2 + 2 * (1 - dist / np.maximum(half, 1)), 0))
    g.water[win] |= m & ~L                                                          # the sea end is sea already
    if s.get("zawn"):
        wall = ~m & (dist < half + 3) & L
        Y = np.where(wall, np.minimum(Y, np.where(dist < half + 1.2, sea + 1 + (dist - half) * 2, Y)), Y)
        g.chalk[win] |= (dist < half + 4) & L
        g.top[win] = np.where((dist < half + 4) & L, orig, g.top[win])
    else:
        bank = ~m & (dist < half + 14) & L
        Y = np.where(bank, np.minimum(Y, sea + 1 + (dist - half) * 0.7), Y)
        g.sand[win] |= ~m & (dist < half + 6) & L
    return Y


_SHAPERS = dict(oxbow=oxbow, moat=moat, oasis=oasis, mesa=mesa, knoll=knoll, scarp=scarp, crag=crag, inlet=inlet)


if __name__ == "__main__":
    import sys
    hp, wp, out = sys.argv[1:4]
    only = sys.argv[4:] or None
    H = np.load(hp).astype(np.float32); W = np.load(wp)
    O = 1264
    xs = np.arange(H.shape[0]) - O; zs = np.arange(H.shape[1]) - O
    GX, GZ = np.meshgrid(xs, zs, indexing="ij")
    SEA = 62
    land = ~((W > -999) & (H < SEA))                                                # under the sea = not land
    protect = np.zeros(H.shape, bool)
    try:                                                                            # rails, from the map's own plan
        import json, os
        here = os.path.dirname(os.path.abspath(__file__))
        rs = json.load(open(os.path.join(here, "rail-segments.json")))
        for seg in rs["segments"]:
            for b in seg["blocks"]:
                protect[b[0] + O, b[2] + O] = True
    except Exception as e:
        print("no rails:", e)
    try:                                                                            # roads and trails, from the plan
        t = np.load(os.path.join(here, "..", "..", "..", "mnt", "project-files", "siege-nights", "map", "terrain.npz")) if False else np.load("/mnt/project-files/siege-nights/map/terrain.npz")
        TH, TN = int(t["H"]), int(t["N"]); S = TN / (2 * TH)
        ix = np.clip(np.round((GX + TH) * S).astype(int), 0, TN - 1); iz = np.clip(np.round((GZ + TH) * S).astype(int), 0, TN - 1)
        protect |= (t["road"][iz, ix] > 0.5) | (t["trail"][iz, ix] > 0.5)
    except Exception as e:
        print("no roads:", e)
    Yf, g = shape(GX, GZ, H, land, protect, SEA, only)
    Y = np.round(Yf).astype(np.int16)
    W2 = W.copy()
    W2[g.water] = g.level[g.water]
    # a pool cut where the old map had none
    np.save(out + "-heights.npy", Y); np.save(out + "-water.npy", W2.astype(np.int16))
    for name, s in SITES.items():
        if only and name not in only: continue
        print(name, "water", int((g.water & (np.abs(GX - s["plot"][0]) < 260) & (np.abs(GZ - s["plot"][1]) < 260)).sum()), "columns")
