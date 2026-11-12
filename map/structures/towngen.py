"""Procedural, terrain-aware towns and villages.

    python3 towngen.py SITE SLICE.npz LINES.json OUT_DIR [--seed N] [--render --textures DIR --three DIR]

SITE is a key of SITES below (or "x,z,radius,town|village" for a quick try anywhere).
SLICE.npz comes from terrain_slice.py (the exact ground genworld.py writes); LINES.json is
draw_map.py's lines.json (the map's roads, which become the town's main streets).

How a town is made (Mateo, 2026-11-11):
  1. Take the circle the town owns and read its ground heights.
  2. Lay the paths first. The market square goes on the flattest ground near the middle (or
     where the map already put it). Main streets follow the map's roads and run in to the
     square; lanes branch off them. Every route is found with a slope-aware path search, so
     streets wind along the contours instead of charging up hills.
  3. Paths are sunk half a block: the walking surface is a bottom slab where the ground's top
     block would be. Buildings stand on full blocks, so you step up half a block to walk off
     the path or into a door. On slopes a path climbs in half steps (slab, full block, slab...),
     never more than half a block per block walked, so nobody has to jump.
  4. Buildings are dropped along the streets by size: tall houses and civic buildings round
     the square, cottages further out, barns and windmills by the fields. Each one is turned
     so its door faces the street, and a short walkway runs from the door down to the path.
     The floor height is picked to balance cutting into the hill against building up a
     foundation; the downhill side gets a stone foundation as deep as the slope needs.
  5. Land left between the paths in the outer ring becomes farmland: 9-wide strips with a
     water channel down the middle (every crop within 4 blocks of water), each strip levelled
     into a terrace, hedged where it meets the street. Wheat, carrots, potatoes, beetroot.
  6. Windmills go on the high ground among the fields; stalls, a well or market cross and
     lamps fill the square; trees and lamps line the streets.

Writes to OUT_DIR:
  <site>-plan.json        buildings to stamp: stamp name, world x/z of the stamp origin, ground y,
                          rotation (clockwise from above; 0 = front faces south), kind
  <site>-groundwork.json  every block the town changes outside its buildings (paths, grading,
                          foundations, fields, hedges, water) in world coordinates
  stamps/<name>.json      one stamp per building design (bp.save_json format)
  <site>-plan.png         top-down plan
  scene.json              preview scene for render/render.py (with --render: shots)
All sizes are odd (streets 5 / 3 / 1, strips 9, buildings): Mateo's rule.
"""
import os, sys, json, math, heapq, random, argparse, collections, subprocess
import numpy as np
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".claude", "skills", "minecraft-builder", "scripts"))
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from bp import Blueprint
from kit import h3, VALE, mix
import towngen_build as TB
import dressing, vale, vale_civic

SITES = {
    # map towns (centre = the square genworld writes; town-sites.json)
    "Millbrook": dict(centre=(-60, -470), radius=70, size="town", fixed_square=True, square_r=7, seed=11,
                      roofs={"dark shingle": 5, "slate": 3, "warm red": 2}, accent="slate",
                      first=("chapel",),        # Sister Wren's chapel claims its place on the square (storyline audit)
                      civic=[("chapel", lambda: vale_civic.chapel(name="millbrook_chapel")),
                             ("clock tower", vale_civic.clock_tower),
                             ("bakery", lambda: __import__("story_builds").build("bakery"))]),
    "Kingsrest": dict(centre=(-118, -118), radius=90, size="town", fixed_square=True, square_r=9, seed=7, inn=True,
                      roofs={"slate": 4, "dark shingle": 3, "warm red": 2, "white": 1}, accent="copper",
                      civic=[("guildhall", vale_civic.guildhall), ("chapel", vale_civic.chapel)]),
    # a farming village on rolling Vale ground west of Kingsrest, clear of plots, wards and rivers (test site)
    "Alder Combe": dict(centre=(-380, -120), radius=60, size="village", fixed_square=False, square_r=7, seed=23, civic=[],
                        roofs={"dark shingle": 4, "slate": 3, "warm red": 2, "copper": 1}, accent="slate"),
}

ROT = {0: (0, 1), 90: (-1, 0), 180: (0, -1), 270: (1, 0)}        # where a stamp's front (south) points after turning
def rot_xz(x, z, deg):
    for _ in range((deg // 90) % 4): x, z = -z, x
    return x, z
def snap_rot(fx, fz):
    return max(ROT, key=lambda r: ROT[r][0] * fx + ROT[r][1] * fz)

# ---- path materials: every block has a slab, because the walking surface is a slab ------------
PAVE = {
    "main":   [("cobblestone", 34), ("mossy_cobblestone", 18), ("stone_brick", 18), ("andesite", 14), ("mossy_stone_brick", 8), ("tuff_brick", 8)],
    "lane":   [("cobblestone", 45), ("mossy_cobblestone", 30), ("andesite", 17), ("mud_brick", 8)],
    "walk":   [("stone_brick", 45), ("cobblestone", 30), ("mossy_stone_brick", 25)],
    "square": [("stone_brick", 40), ("polished_andesite", 25), ("andesite", 15), ("mossy_stone_brick", 10), ("cobblestone", 10)],
}
FULL = {"cobblestone": "cobblestone", "mossy_cobblestone": "mossy_cobblestone", "stone_brick": "stone_bricks", "mossy_stone_brick": "mossy_stone_bricks",
        "andesite": "andesite", "polished_andesite": "polished_andesite", "tuff_brick": "tuff_bricks", "mud_brick": "mud_bricks"}
WIDTH = {"main": 5, "lane": 3, "walk": 1}
PRIO = {"square": 4, "main": 3, "lane": 2, "walk": 1}

def pave(kind, x, z, slab):
    tab = PAVE[kind]; tot = sum(w for _, w in tab); r = h3(x, 7, z, 91 + len(kind)) * tot
    for m, w in tab:
        r -= w
        if r < 0: break
    if kind == "square":                         # a border course and a cross of dressed stone through the middle
        pass
    return (m + "_slab", {"half": "bottom"}) if slab else (FULL[m], {})

CROPS = [("wheat", 45, (5, 7)), ("carrots", 20, (5, 7)), ("potatoes", 20, (5, 7)), ("beetroot", 15, (5, 7))]


class Town:
    def __init__(self, name, site, T, L, seed):
        self.name, self.site, self.L = name, site, L
        self.key = name.lower().replace("'", "").replace(" ", "_")
        self.rng = random.Random(seed); self.seed = seed
        self.X0, self.Z0 = int(T["X0"]), int(T["Z0"])
        self.G0 = T["Y"].astype(np.int32)                         # top block y of the untouched ground
        self.WL = T["water"].astype(np.int32)
        self.WET = self.WL > self.G0
        self.MAPROAD = T["road"] | T["trail"]
        self.C = site["centre"]; self.R = site["radius"]
        self.big = site["size"] == "town"
        n0, n1 = self.G0.shape
        ii, jj = np.meshgrid(np.arange(n0) + self.X0, np.arange(n1) + self.Z0, indexing="ij")
        self.D = np.hypot(ii - self.C[0], jj - self.C[1])
        # the town's edge is not a circle: it wanders in and out by up to `wobble` of the radius (out by at most
        # 9, the slice ends 20 past R), so fields and verges close on an organic line. E is distance scaled to that edge.
        self.wob = random.Random(seed * 7919 + 13); w = float(site.get("wobble", 0.12))
        self.wave = [(k, self.wob.uniform(0.4, 1.0) / k ** 0.7, self.wob.uniform(0, 2 * math.pi)) for k in (2, 3, 4, 5, 7)]
        tot = sum(a for _, a, _ in self.wave) or 1; self.wave = [(k, a / tot, ph) for k, a, ph in self.wave]; self.wobw = w
        self.E = self.D * self.R / self.edge_r(np.arctan2(jj - self.C[1], ii - self.C[0])) if w else self.D
        self.IN = self.E <= self.R
        self.Gs = self._blur(self.G0.astype(np.float32), 3)    # smoothed ground for path costs and heights
        self.G = self.G0.copy()                                 # graded ground (top block y)
        self.K = np.full(self.G0.shape, -1, np.int32)           # path surface in half blocks (slab at (k-1)//2 when odd)
        self.KIND = np.zeros(self.G0.shape, np.int8)            # path kind (PRIO), 0 = none
        self.KMIN = np.where(self.WET, 2 * (self.WL + 1) + 1, -1)  # paths over water become a raised deck
        self.DOORWALK = np.zeros(self.G0.shape, bool)           # door walkways (their steps are kept)
        self.TAKEN = np.zeros(self.G0.shape, np.int8)           # 1 margin, 2 building ground, 3 field, 4 dressing
        self.EAVES = np.zeros(self.G0.shape, bool)
        self.FIX = np.zeros(self.G0.shape, bool)                # ground set by a building, field or path: don't regrade
        self.works = {}                                         # (x,y,z) -> (name, props): groundwork blocks
        self.top = {}                                           # (x,z) -> top block name override
        self.plan = []; self.designs = {}; self.roads = []; self.walks = []

    # ---- helpers
    @staticmethod
    def _blur(a, r):
        k = 2 * r + 1; p = np.pad(a, r, mode="edge"); c = p.cumsum(0).cumsum(1)
        c = np.pad(c, ((1, 0), (1, 0)))
        return (c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]) / (k * k)
    def ij(self, x, z): return x - self.X0, z - self.Z0
    def ok(self, x, z): i, j = self.ij(x, z); return 0 <= i < self.G0.shape[0] and 0 <= j < self.G0.shape[1]
    def edge_r(self, ang):
        """Radius of the town's edge at angle ang (radians): R * (1 +- wobble), never more than R + 9."""
        f = sum(a * np.sin(k * ang + ph) for k, a, ph in self.wave)
        return np.minimum(self.R * (1 + self.wobw * f), self.R + 9)
    def inside(self, x, z, m=0):
        if not self.ok(x, z): return False
        d = math.hypot(x - self.C[0], z - self.C[1])
        return d <= (self.edge_r(math.atan2(z - self.C[1], x - self.C[0])) if self.wobw else self.R) - m
    def at(self, A, x, z): i, j = self.ij(x, z); return A[i, j]
    def u(self, x, z): return math.hypot(x - self.sq[0], z - self.sq[1]) / self.R

    # =========================================================================== 2. paths
    def square(self):
        s = self.site; r = s["square_r"]
        if s.get("square_at"): c = tuple(s["square_at"])
        elif s.get("fixed_square"): c = tuple(s["centre"])
        else:
            best = None
            for x in range(self.C[0] - self.R // 3, self.C[0] + self.R // 3 + 1, 2):
                for z in range(self.C[1] - self.R // 3, self.C[1] + self.R // 3 + 1, 2):
                    i, j = self.ij(x, z)
                    win = self.G0[i - r:i + r + 1, j - r:j + r + 1]; wet = self.WET[i - r - 4:i + r + 5, j - r - 4:j + r + 5].any()
                    sc = win.std() + 0.04 * math.hypot(x - self.C[0], z - self.C[1]) + (99 if wet else 0)
                    if best is None or sc < best[0]: best = (sc, (x, z))
            c = best[1]
        self.sq = (int(c[0]), int(c[1])); i, j = self.ij(*c)
        self.sqY = int(round(float(np.median(self.G0[i - r:i + r + 1, j - r:j + r + 1]))))
        self.sqR = r
        k = 2 * self.sqY + 1
        for x in range(c[0] - r - 2, c[0] + r + 3):
            for z in range(c[1] - r - 2, c[1] + r + 3):
                a = math.atan2(z - c[1], x - c[0])
                rr = r + 0.6 + 0.9 * math.sin(3 * a + self.seed) + 0.5 * math.sin(5 * a + 2 * self.seed)   # a lumpy, not round, square
                if math.hypot(x - c[0], z - c[1]) <= rr:
                    self.K[self.ij(x, z)] = k; self.KIND[self.ij(x, z)] = PRIO["square"]
        self.square_cells = np.argwhere(self.KIND == PRIO["square"])

    def astar(self, start, goals, kind, avoid_new=True, limit=None):
        """Cheapest 8-way route from start to any goal cell. Climbing costs a lot (streets wind along
        the contours), water is a bridge (dear), joining an existing street is cheap, and running
        alongside one without joining it is discouraged so streets don't hug each other."""
        goals = set(goals); n0, n1 = self.G0.shape
        si, sj = self.ij(*start)
        near = getattr(self, "_near", None)
        dist = {(si, sj): 0.0}; prev = {}; pq = [(0.0, 0.0, si, sj)]
        gi = [self.ij(*g) for g in goals]; gset = set(gi)
        if not gset: return None
        gx = np.mean([g[0] for g in gi]); gz = np.mean([g[1] for g in gi])
        SLOPE = 14.0 if kind == "main" else 10.0
        xc = getattr(self, "XCOST", None)             # extra cost per cell (e.g. a railway: streets cross it, never run along it)
        while pq:
            _, d, i, j = heapq.heappop(pq)
            if (i, j) in gset:
                path = [(i, j)]
                while path[-1] in prev: path.append(prev[path[-1]])
                return [(a + self.X0, b + self.Z0) for a, b in path[::-1]]
            if d > dist.get((i, j), 1e18) + 1e-9: continue
            if limit and d > limit: break
            for di, dj, w in ((1, 0, 1), (-1, 0, 1), (0, 1, 1), (0, -1, 1), (1, 1, 1.414), (1, -1, 1.414), (-1, 1, 1.414), (-1, -1, 1.414)):
                a, b = i + di, j + dj
                if not (0 <= a < n0 and 0 <= b < n1) or not self.IN[a, b]: continue
                if self.TAKEN[a, b] >= 2: continue
                dh = abs(float(self.Gs[a, b] - self.Gs[i, j])) / w
                c = w * (1 + SLOPE * dh * dh + (3.0 if dh > 0.5 else 0))
                if self.WET[a, b]: c += 40 * w
                if self.KIND[a, b]: c *= 0.35
                elif near is not None and near[a, b]: c += 2.5 * w
                if self.E[a, b] > self.R - 3: c += 4
                if xc is not None: c += xc[a, b] * w
                nd = d + c
                if nd < dist.get((a, b), 1e18):
                    dist[(a, b)] = nd; prev[(a, b)] = (i, j)
                    heapq.heappush(pq, (nd + 0.9 * math.hypot(a - gx, b - gz), nd, a, b))
        return None

    @staticmethod
    def smooth(pts, n=2):
        pts = [tuple(map(float, p)) for p in pts]
        for _ in range(n):
            if len(pts) < 3: break
            out = [pts[0]]
            for (x0, z0), (x1, z1) in zip(pts, pts[1:]):
                out += [(0.75 * x0 + 0.25 * x1, 0.75 * z0 + 0.25 * z1), (0.25 * x0 + 0.75 * x1, 0.25 * z0 + 0.75 * z1)]
            out.append(pts[-1]); pts = out
        return pts
    @staticmethod
    def resample(pts, step=1.0):
        out = [tuple(pts[0])]; acc = 0.0
        for (x0, z0), (x1, z1) in zip(pts, pts[1:]):
            d = math.hypot(x1 - x0, z1 - z0)
            if d == 0: continue
            t = step - acc
            while t <= d:
                out.append((x0 + (x1 - x0) * t / d, z0 + (z1 - z0) * t / d)); t += step
            acc = d - (t - step)
        if math.hypot(out[-1][0] - pts[-1][0], out[-1][1] - pts[-1][1]) > 0.3: out.append(tuple(pts[-1]))
        return out

    def lay(self, cells, kind, k_start=None, k_end=None, beyond=0):
        """Turn a cell route into a street: smooth it, give it half-block heights that never change
        by more than half a block per block, and paint it `WIDTH[kind]` wide."""
        if len(cells) < 2: return None
        pts = self.resample(self.smooth(cells, 2), 1.0)
        hs = []
        for x, z in pts:
            i, j = self.ij(int(round(x)), int(round(z)))
            k = 2 * int(round(float(self.Gs[i, j]))) + 1
            k = max(k, int(self.KMIN[i, j]))
            hs.append(k)
        if k_start is not None: hs[0] = k_start
        if k_end is not None: hs[-1] = k_end
        lo = [self.KMIN[self.ij(int(round(x)), int(round(z)))] for x, z in pts]
        for _ in range(4):                       # clamp both ways until every step is at most one half block
            for i in range(1, len(hs)):
                if not (k_end is not None and i == len(hs) - 1): hs[i] = max(min(hs[i], hs[i - 1] + 1), hs[i - 1] - 1, lo[i])
            for i in range(len(hs) - 2, -1, -1):
                if not (k_start is not None and i == 0): hs[i] = max(min(hs[i], hs[i + 1] + 1), hs[i + 1] - 1, lo[i])
        r = WIDTH[kind] / 2.0; p = PRIO[kind]
        for (x, z), k in zip(pts, hs):
            for dx in range(-int(r) - 1, int(r) + 2):
                for dz in range(-int(r) - 1, int(r) + 2):
                    cx, cz = int(round(x)) + dx, int(round(z)) + dz
                    if (cx + 0.0 - x) ** 2 + (cz + 0.0 - z) ** 2 > r * r + 0.15 or not self.inside(cx, cz, -beyond): continue
                    i, j = self.ij(cx, cz)
                    if self.KIND[i, j] >= p: continue
                    if self.TAKEN[i, j] >= 2: continue
                    if self.WET[i, j] and not self.at(self.WET, int(round(x)), int(round(z))): continue   # a bank, not a bridge
                    self.K[i, j] = k; self.KIND[i, j] = p
        rd = {"kind": kind, "pts": pts, "k": hs}
        self.roads.append(rd)
        self._near = self._dilate(self.KIND > 0, 3) & ~(self.KIND > 0)
        return rd

    @staticmethod
    def _dilate(m, r):
        out = m.copy()
        for _ in range(r):
            o = out.copy(); o[1:] |= out[:-1]; o[:-1] |= out[1:]; o[:, 1:] |= out[:, :-1]; o[:, :-1] |= out[:, 1:]; out = o
        return out

    def k_at(self, x, z): return int(self.at(self.K, x, z))

    def streets(self):
        sqcells = [(int(i) + self.X0, int(j) + self.Z0) for i, j in self.square_cells]
        ring = [c for c in sqcells if any(self.at(self.KIND, c[0] + dx, c[1] + dz) == 0 for dx, dz in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
        # gates: where the map's roads leave the circle
        gates = []; self.gate_out = {}
        for name, pts in list(self.L["roads"].items()) + list(self.L["trails"].items()):
            pts = self.resample(pts, 1.0)
            ins = [self.inside(int(round(x)), int(round(z)), 3) for x, z in pts]
            for t in range(1, len(pts)):
                if ins[t] != ins[t - 1]:
                    x, z = pts[t] if ins[t] else pts[t - 1]
                    g = (int(round(x)), int(round(z)), name, "trail" if name in self.L["trails"] else "road")
                    gates.append(g)
                    # the map road on out past the edge (Mateo 2026-11-12: paths run to the plot's edge, and
                    # through the wall, where the gate goes)
                    run = pts[t:] if ins[t - 1] else pts[t - 1::-1]
                    out = [(int(round(a)), int(round(b))) for a, b in run[:40]]
                    self.gate_out[g[:2]] = [c for k, c in enumerate(out) if k == 0 or c != out[k - 1]]
        merged = []
        for g in gates:
            if all(math.hypot(g[0] - m[0], g[1] - m[1]) > 14 for m in merged): merged.append(g)
        want = 4 if self.big else 3
        ang0 = self.rng.random() * 360
        while len(merged) < want:                # no map road here: open lanes out to the country anyway
            a = math.radians(ang0 + 360 * len(merged) / want + self.rng.uniform(-25, 25))
            x, z = int(self.C[0] + math.cos(a) * (self.R - 4)), int(self.C[1] + math.sin(a) * (self.R - 4))
            if not self.at(self.WET, x, z) and all(math.hypot(x - m[0], z - m[1]) > 20 for m in merged): merged.append((x, z, "country lane", "lane"))
            else: ang0 += 17
        self.gates = merged
        # main streets: each gate in to the square, and on out through the edge
        for gx, gz, name, kind in merged:
            path = self.astar((gx, gz), ring, "main")
            if not path: print("no street from gate", (gx, gz), name); continue
            rk = "main" if kind == "road" else "lane"
            rd = self.lay(path[::-1], rk, k_start=self.k_at(*path[-1]))
            self.street_out((gx, gz), rk)

        # a back lane ringing the middle of town: with the streets running in, it boxes the land
        # into portions (inner blocks to build on, outer sectors for fields)
        self.ring_lane()
        # lanes cut across from street to street, splitting the bigger blocks
        nl = self.site.get("lanes") or (self.rng.randint(5, 8) if self.big else self.rng.randint(2, 4))
        mains = [r for r in self.roads if r["kind"] in ("main", "lane")]
        tries = 0
        while nl > 0 and tries < 60 and mains:
            tries += 1
            r = self.rng.choice(mains); pts = r["pts"]
            if len(pts) < 20: continue
            t = self.rng.randint(8, len(pts) - 6)
            x, z = pts[t]
            if math.hypot(x - self.sq[0], z - self.sq[1]) < self.sqR + 10: continue
            (x0, z0), (x1, z1) = pts[t - 3], pts[t + 3]
            tx, tz = x1 - x0, z1 - z0; d = math.hypot(tx, tz) or 1; tx, tz = tx / d, tz / d
            side = self.rng.choice((1, -1)); ang = math.radians(self.rng.uniform(-30, 30))
            nx, nz = -tz * side, tx * side
            nx, nz = nx * math.cos(ang) - nz * math.sin(ang), nx * math.sin(ang) + nz * math.cos(ang)
            L = self.rng.uniform(22, 42)
            ex, ez = int(round(x + nx * L)), int(round(z + nz * L))
            if not self.inside(ex, ez, 5) or self.at(self.WET, ex, ez) or self.at(self.KIND, ex, ez): continue
            if any(math.hypot(ex - q["pts"][-1][0], ez - q["pts"][-1][1]) < 16 for q in self.roads if q["kind"] == "lane"): continue
            sx, sz = int(round(x + nx * 3)), int(round(z + nz * 3))
            if not self.inside(sx, sz) or self.at(self.KIND, sx, sz) == 0: sx, sz = int(round(x)), int(round(z))
            path = self.astar((ex, ez), [(sx, sz)], "lane")
            if not path or len(path) < 10: continue
            path = path[::-1]
            # carry on to the nearest other street if one is close: a loop instead of a dead end
            tail = self.astar(path[-1], [tuple(int(v) for v in (c[0] + self.X0, c[1] + self.Z0)) for c in np.argwhere(self.KIND >= PRIO["lane"])
                                         if math.hypot(c[0] + self.X0 - path[-1][0], c[1] + self.Z0 - path[-1][1]) < 26
                                         and math.hypot(c[0] + self.X0 - sx, c[1] + self.Z0 - sz) > 22], "lane", limit=120)
            ke = None
            if not tail or len(tail) < 2: continue          # no dead ends: every lane joins two streets
            path = path + tail[1:]; ke = self.k_at(*tail[-1])
            rd = self.lay(path, "lane", k_start=self.k_at(sx, sz), k_end=ke)
            if rd: mains.append(rd); nl -= 1


    def street_out(self, gate, kind):
        """Carry a street from its gate (3 inside the edge) out past the edge, along the map road where there is
        one, else straight out from the centre, so it crosses the wall line (an arch) and meets the country."""
        gx, gz = gate
        out = self.gate_out.get((gx, gz)) if hasattr(self, "gate_out") else None
        if not out:
            dx, dz = gx - self.C[0], gz - self.C[1]; d = math.hypot(dx, dz) or 1
            out = [(int(round(gx + dx / d * t)), int(round(gz + dz / d * t))) for t in range(0, 16)]
        cells = [(gx, gz)]
        for c in out:
            if c == (gx, gz): continue
            if not self.ok(*c) or self.at(self.WET, *c): break
            cells.append(c)
            if not self.inside(c[0], c[1], -4): break
        if len(cells) < 3 or self.inside(cells[-1][0], cells[-1][1], -2): print("no way out from gate", gate, len(cells)); return None
        k0 = int(self.at(self.K, gx, gz)) if self.at(self.K, gx, gz) >= 0 else None
        rd = self.lay(cells, kind, k_start=k0, beyond=6)
        return rd

    def ring_lane(self):
        rr = self.R * (0.5 if self.big else 0.46)
        a0 = self.rng.random() * 2 * math.pi; n = 9
        way = []
        for k in range(n):
            a = a0 + 2 * math.pi * k / n
            r = rr * self.rng.uniform(0.85, 1.12)
            x, z = int(round(self.sq[0] + math.cos(a) * r)), int(round(self.sq[1] + math.sin(a) * r))
            for _ in range(8):
                if self.inside(x, z, 6) and not self.at(self.WET, x, z): break
                r *= 0.92; x, z = int(round(self.sq[0] + math.cos(a) * r)), int(round(self.sq[1] + math.sin(a) * r))
            else: continue
            way.append((x, z))
        for p0, p1 in zip(way, way[1:] + way[:1]):
            path = self.astar(p1, [p0], "lane", limit=400)
            if not path or len(path) < 2: continue
            path = path[::-1]
            ks = self.k_at(*path[0]) if self.at(self.K, *path[0]) >= 0 else None
            ke = self.k_at(*path[-1]) if self.at(self.K, *path[-1]) >= 0 else None
            self.lay(path, "lane", k_start=ks, k_end=ke)

    def relax(self, it=40):
        """Make sure no two touching path cells differ by more than half a block anywhere,
        including where streets cross and widen."""
        M = (self.K >= 0) & ~self.DOORWALK          # door walkways keep their steps and never drag a street
        for _ in range(it):
            Kp = np.where(M, self.K, -10 ** 6); Km = np.where(M, self.K, 10 ** 6)
            hi = np.full(self.K.shape, 10 ** 6); lo = np.full(self.K.shape, -10 ** 6)
            for sh in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                hi = np.minimum(hi, np.roll(Km, sh, (0, 1)) + 1); lo = np.maximum(lo, np.roll(Kp, sh, (0, 1)) - 1)
            new = np.where(M, np.maximum(np.minimum(self.K, hi), lo), self.K)
            new = np.where(M, np.maximum(new, self.KMIN), new)
            if (new == self.K).all(): break
            self.K = new

    # =========================================================================== 3. grading
    def grade_verges(self):
        """Ground beside a path sits half a block above it; the bank eases back to the natural
        ground one block per block (a cut lane gets stone banks where it is deep)."""
        M = self.K >= 0
        top = np.where(M, self.K // 2, -10 ** 6)
        # path cells: the slab (or full block) replaces the top block
        self.G = np.where(M, (self.K - 1) // 2, self.G)
        self.FIX |= M
        cur = top.copy()
        band = np.zeros(self.G.shape, bool)
        for d in range(1, 7):
            nb = np.full(self.G.shape, -10 ** 6)
            for sh in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nb = np.maximum(nb, np.roll(cur, sh, (0, 1)))
            new = (nb > -10 ** 5) & ~M & ~band & self.IN & ~self.WET
            if d == 1: tgt = nb
            else: tgt = np.clip(self.G0, nb - 1, nb + 1)
            ring = new & ((d == 1) | (np.abs(self.G0 - nb) > 1))
            self.G = np.where(ring, tgt, self.G)
            if d == 1: self.FIX |= ring
            band |= ring
            cur = np.where(ring, self.G, -10 ** 6)
            if not ring.any(): break

    # =========================================================================== 4. buildings
    def footprint(self, bp, deg):
        g, full = set(), set()
        for (x, y, z), c in bp.cells.items():
            if c[0] == "keep" or y < 0: continue
            q = rot_xz(x, z, deg); full.add(q)
            if y <= 2: g.add(q)
        return g, full

    def door_of(self, bp):
        if "door" in bp.markers: x, y, z = bp.markers["door"]; return x, z
        best = None
        for (x, y, z), (n, p) in bp.cells.items():
            if n.endswith("_door") and not p.get("upper") and p.get("facing") == "n" and (best is None or z > best[1]): best = (x, z + 1)
        if best: return best
        (lx, _, lz), (hx, _, hz) = bp.bounds(); return (lx + hx) // 2, hz + 1

    def walk_cells(self, start, f, maxlen=10):
        """Cells from the door step forward (direction f) until a path is reached."""
        out = []; x, z = start
        for _ in range(maxlen):
            if not self.inside(x, z): return None
            if self.at(self.K, x, z) >= 0 and self.at(self.KIND, x, z) >= PRIO["walk"] and (x, z) not in out:
                return out, (x, z)
            out.append((x, z)); x, z = x + f[0], z + f[1]
        return None

    LANDING = 4          # Mateo 2026-11-12: 4 flat blocks in front of every front door, level with the floor,
                         # then graded off; a door never opens onto a drop (the house turns round instead)
    LANDING_FILL = 4     # the landing is built up by at most this much (then banked off); more means a cliff
    def landing_cells(self, door_xz, f):
        return [(door_xz[0] + f[0] * t - f[1] * s, door_xz[1] + f[1] * t + f[0] * s) for t in range(self.LANDING) for s in (-1, 0, 1)]

    FLOOR_HIGHEST = True
    ROAD_FIT = 2         # half blocks: no path beside a plot is more than a block above its floor,
    ROAD_DROP = 4        # nor more than two below it (the walkway climbs to the door with a stair)
    def try_place(self, bp, deg, door_xz, kind, gap=1, max_relief=6, need_walk=True, extra=None):
        dx, dz = self.door_of(bp); rdx, rdz = rot_xz(dx, dz, deg)
        ox, oz = door_xz[0] - rdx, door_xz[1] - rdz
        g, full = self.footprint(bp, deg)
        G = [(x + ox, z + oz) for x, z in g]; F = [(x + ox, z + oz) for x, z in full]
        for x, z in G:
            if not self.inside(x, z, 2): return None
            i, j = self.ij(x, z)
            if self.K[i, j] >= 0 or self.WET[i, j] or self.TAKEN[i, j]: return None
        for x, z in F:
            if not self.ok(x, z): return None
            i, j = self.ij(x, z)
            if self.TAKEN[i, j] >= 2 or self.EAVES[i, j] and self.TAKEN[i, j]: return None
        if extra:
            for x, z in extra:
                i, j = self.ij(x + ox, z + oz)
                if not self.inside(x + ox, z + oz, 2) or self.K[i, j] >= 0 or self.WET[i, j] or self.TAKEN[i, j]: return None
        hs = np.array([self.at(self.G, x, z) for x, z in G])
        if hs.max() - hs.min() > max_relief: return None
        # paths first (Mateo 2026-11-11): the floor is graded to the paths round the plot, never left
        # a block or more above or below them
        gs = set(G); near_k = []
        for x, z in G:
            for ddx in range(-2, 3):
                for ddz in range(-2, 3):
                    c = (x + ddx, z + ddz)
                    if c in gs or not self.ok(*c): continue
                    i, j = self.ij(*c)
                    if self.K[i, j] >= 0 and not self.DOORWALK[i, j]: near_k.append(int(self.K[i, j]))
        near_k = np.array(sorted(set(near_k)), int)
        y_lo, y_hi = int(hs.min()), int(hs.max())
        if len(near_k):
            y_lo = min(y_lo, int(near_k.min()) // 2 - 1); y_hi = max(y_hi, int(near_k.max()) // 2 + 1)
        wk = None
        if need_walk:
            f = ROT[deg]
            wk = self.walk_cells(door_xz, f)
            if wk is None: return None
            cells, end = wk
            for x, z in cells:
                i, j = self.ij(x, z)
                if self.TAKEN[i, j] >= 2 or self.WET[i, j]: return None
            k_road = self.k_at(*end)
        # floor height: balance digging in against building up, and keep the walkway walkable
        best = None
        # Mateo 2026-11-11: a building stands on the highest ground block it covers; everything below
        # is stone foundation (never cut in, so no side is buried)
        for yf in ([int(hs.max())] if self.FLOOR_HIGHEST else range(y_lo, y_hi + 1)):
            if len(near_k) and ((near_k - (2 * yf + 1)).max() > self.ROAD_FIT or ((2 * yf + 1) - near_k).max() > self.ROAD_DROP): continue
            if yf < hs.min() - 2 or yf > hs.max() + 2: continue
            cost = float(np.abs(hs - yf).sum()) + 0.6 * float(np.maximum(0, yf - hs).sum())   # fill shows; cutting is tidier
            if need_walk:
                n = max(0, len(cells) - self.LANDING); dk = abs(2 * yf + 1 - k_road)   # the landing is flat: only the rest climbs
                if dk > 2 * n + 1: continue          # too steep even with stairs
                cost += 6 * max(0, dk - n - 1)        # half steps are free; whole steps (stairs) cost a bit
            if best is None or cost < best[0]: best = (cost, yf)
        if best is None: return None
        yf = best[1]
        # the landing: level with the floor (built up to LANDING_FILL, cut a block at most), paths on it level with the door
        # (it ends where it meets a street, which must then be level with the door, a slab step at most)
        f = ROT[deg]; gs = set(G); walk = set(cells) if need_walk else set(); land = []
        for t in range(self.LANDING):
            cx, cz = door_xz[0] + f[0] * t, door_xz[1] + f[1] * t
            if not self.ok(cx, cz): return None
            ci, cj = self.ij(cx, cz)
            if self.K[ci, cj] >= 0 and (cx, cz) not in walk:
                if abs(int(self.K[ci, cj]) - (2 * yf + 1)) > 2: return None
                break
            land += [c for c in ((cx - f[1] * s, cz + f[0] * s) for s in (-1, 0, 1)) if c not in gs]
        for x, z in land:
            if not self.ok(x, z): return None
            i, j = self.ij(x, z)
            if self.WET[i, j]: return None
            if self.K[i, j] >= 0: continue                     # a street beside the landing keeps its own height
            if self.TAKEN[i, j] >= 2 or not (yf - self.LANDING_FILL <= self.G[i, j] <= yf + 1): return None
        # commit
        for x, z in land:
            i, j = self.ij(x, z)
            if self.K[i, j] < 0 and (x, z) not in walk:
                g0 = int(self.G[i, j])
                for y in range(yf + 1, max(g0, yf) + 1): self.works.setdefault((x, y, z), ("air", {}))
                self.G[i, j] = yf; self.FIX[i, j] = True; self.TAKEN[i, j] = max(self.TAKEN[i, j], 1)
        for x, z in F:
            i, j = self.ij(x, z); self.EAVES[i, j] = True
            if self.TAKEN[i, j] < 2: self.TAKEN[i, j] = max(self.TAKEN[i, j], 1)
        for x, z in G:
            for ddx in range(-gap, gap + 1):
                for ddz in range(-gap, gap + 1):
                    if self.ok(x + ddx, z + ddz):
                        i, j = self.ij(x + ddx, z + ddz); self.TAKEN[i, j] = max(self.TAKEN[i, j], 1)
        for x, z in G:
            i, j = self.ij(x, z); self.TAKEN[i, j] = 2
        if extra:
            for x, z in extra:
                i, j = self.ij(x + ox, z + oz); self.TAKEN[i, j] = 2
        e = {"stamp": bp.name, "kind": kind, "x": ox, "z": oz, "ground_y": yf, "rotation": deg, "footprint": len(G), "foundation": int(yf - hs.min()),
             "door": [door_xz[0], door_xz[1]]}
        self.plan.append(e); self.designs[bp.name] = bp
        self.foundation(G, yf, extra=[(x + ox, z + oz) for x, z in extra] if extra else None)
        if need_walk: self.walkway(cells, yf, k_road, ROT[deg])
        return e

    def foundation(self, G, yf, extra=None):
        """Cut the plot level with the floor, build a stone foundation down to the ground on the low
        side, and ease the ground round the building to the floor level."""
        cells = set(G) | set(extra or [])
        for x, z in cells:
            i, j = self.ij(x, z)
            g0 = int(self.G[i, j])
            if g0 < yf:                                            # foundation shows above the slope: dressed stone
                for y in range(g0 + 1, yf): self.works[(x, y, z)] = VALE["plinth"](x, y, z)
            for y in range(yf, max(g0, yf) + 1): self.works.setdefault((x, y, z), ("air", {}))
            self.G[i, j] = yf; self.FIX[i, j] = True
        # apron and banks round it
        ring = set()
        for x, z in cells:
            for d in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
                c = (x + d[0], z + d[1])
                if c not in cells and self.ok(*c): ring.add(c)
        cur = {c: yf for c in ring}
        for step in range(4):
            nxt = {}
            for (x, z), h in cur.items():
                i, j = self.ij(x, z)
                if self.FIX[i, j] or self.WET[i, j] or not self.IN[i, j]: continue
                t = int(np.clip(self.G[i, j], h - (0 if step == 0 else 1), h + (0 if step == 0 else 1)))
                if t == self.G[i, j] and step > 0: continue
                self.G[i, j] = t
                if step == 0: self.FIX[i, j] = True
                for d in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    c = (x + d[0], z + d[1])
                    if c not in cells and self.ok(*c) and c not in cur: nxt[c] = t
            cur = nxt

    def walkway(self, cells, yf, k_road, f):
        """Door step to street: a slab half a block below the floor at the door, then half steps
        (slab, block, slab) to the street; a stair where it has to climb faster."""
        n = len(cells); k0 = 2 * yf + 1; ks = []
        if n == 0: return
        flat = min(n, self.LANDING); m = n - flat                 # the landing stays level with the door
        ks = [k0] * flat
        for t in range(m):
            ks.append(int(round(k0 + (k_road - k0) * (t + 1) / (m + 1))))
        for (x, z), k in zip(cells, ks):
            i, j = self.ij(x, z)
            self.K[i, j] = k; self.KIND[i, j] = PRIO["walk"]; self.TAKEN[i, j] = max(self.TAKEN[i, j], 1); self.DOORWALK[i, j] = True
        self.walks.append((cells, ks, f))

    def place_along(self, rd, side, tier_fn, setbacks=(1, 2), gap_rng=(1, 3), spacing=None, kinds=None):
        pts = rd["pts"]; hw = WIDTH[rd["kind"]] / 2.0 if rd["kind"] in WIDTH else 0.5
        t = 4
        while t < len(pts) - 4:
            x, z = pts[t]
            if self.inside(int(x), int(z), 6) is False: t += 2; continue
            (x0, z0), (x1, z1) = pts[t - 3], pts[min(t + 3, len(pts) - 1)]
            tx, tz = x1 - x0, z1 - z0; d = math.hypot(tx, tz) or 1; tx, tz = tx / d, tz / d
            nx, nz = -tz * side, tx * side
            deg = snap_rot(-nx, -nz)
            f = ROT[deg]
            placed = None
            probe = (int(round(x + nx * (hw + 2.5))), int(round(z + nz * (hw + 2.5))))
            tier = tier_fn(*probe)
            if tier is None: t += 3; continue
            for sb in setbacks:
                door = (int(round(x + nx * (hw + 0.5 + sb))), int(round(z + nz * (hw + 0.5 + sb))))
                for att in range(4):
                    bp = self.pick_building(tier if att < 2 else min(2, tier + 1), kinds)
                    gap = self.rng.randint(*gap_rng)
                    placed = self.try_place(bp, deg, door, bp.kind if hasattr(bp, "kind") else "house", gap=gap)
                    if placed: break
                if placed: break
            if placed:
                (lx, _, lz), (hx, _, hz) = bp.bounds()
                along = (hx - lx + 1) if deg in (0, 180) else (hz - lz + 1)
                t += along + self.rng.randint(*gap_rng)
            else: t += 2

    def pick_building(self, tier, kinds=None):
        sd = self.seed * 1000 + len(self.plan) * 7 + self.rng.randint(0, 999)
        if tier == 3: return TB.barn(sd, 9, self.rng.choice([11, 13]))
        if tier == 0 and self.site.get("region", "vale") == "vale" and self.rng.random() < 0.35:
            st = self.rng.choice(["tudor", "tudor", "stone", "brick"])
            w, d = self.rng.choice([(7, 9), (7, 11), (9, 11)])
            b = vale.townhouse(sd, width=w, depth=d, storeys=self.rng.choice([2, 3]), ground="stone", style=st,
                               jetty=self.rng.random() < 0.7, roof="slate", chimney_side=self.rng.choice("ew"))
            b.kind = "house"; return b
        return TB.random_cottage(sd, self.rng, min(tier, 2), roof="slate")      # colours are given out by the town's mix later

    def place_square_buildings(self):
        """Civic buildings and the inn on the square's edge, facing in."""
        out = []
        makers = [m for m in self.site.get("civic", []) if m[0] not in self.site.get("first", ())]
        if self.site.get("inn"): makers.insert(0, ("inn", lambda: vale.coaching_inn(style="tudor")))
        for name, mk in makers:
            bp = mk(); bp.kind = "civic"
            done = None
            for k in range(72):
                a = 2 * math.pi * (k * 0.618 % 1)
                for extra_r in (1, 2, 3, 5, 7, 9, 11):
                    rr = self.sqR + 1 + extra_r
                    x, z = self.sq[0] + math.cos(a) * rr, self.sq[1] + math.sin(a) * rr
                    deg = snap_rot(self.sq[0] - x, self.sq[1] - z)
                    done = self.try_place(bp, deg, (int(round(x)), int(round(z))), "civic", gap=1, max_relief=6)
                    if done: done["name"] = name; break
                if done: break
            if not done: done = self.civic_on_street(bp, name)
            if not done: done = self.civic_on_street(bp, name, near=self.sq, relief=9)   # anywhere on a street, nearest first
            if not done: print("no room for", name)

    def civic_on_street(self, bp, name, near=None, relief=6):
        """Civic buildings that don't fit round the square front the main streets, nearest the square first."""
        cands = []
        for rd in self.roads:
            if rd["kind"] not in ("main", "lane"): continue
            pts = rd["pts"]; hw = WIDTH[rd["kind"]] / 2.0
            for t in range(3, len(pts) - 3):
                x, z = pts[t]; (x0, z0), (x1, z1) = pts[t - 3], pts[t + 3]
                tx, tz = x1 - x0, z1 - z0; d = math.hypot(tx, tz) or 1; tx, tz = tx / d, tz / d
                for side in (1, -1):
                    nx, nz = -tz * side, tx * side
                    for sb in (1, 2, 3):
                        door = (int(round(x + nx * (hw + 0.5 + sb))), int(round(z + nz * (hw + 0.5 + sb))))
                        cands.append((math.hypot(door[0] - self.sq[0], door[1] - self.sq[1]), door, snap_rot(-nx, -nz)))
        if near: cands = [(math.hypot(d[0] - near[0], d[1] - near[1]), d, g) for _, d, g in cands]
        cands.sort()
        for dist, door, deg in cands:
            if not near and dist > 0.7 * self.R: break
            e = self.try_place(bp, deg, door, "civic", gap=1, max_relief=relief)
            if e: e["name"] = name; return e
        return None

    def houses(self):
        def tier(x, z):
            pk = self.at(self.PKIND, x, z) if self.ok(x, z) else 0
            if pk == 2: return 3 if self.rng.random() < 0.12 else None      # field portions: only the odd barn on the edge
            if pk == 0: return None
            u = self.u(x, z)
            if u < (0.32 if self.big else 0.28): return 0
            if u < (0.55 if self.big else 0.5): return 1
            if u < 0.8: return 2
            return 3 if self.rng.random() < 0.4 else None
        # the square's own edge first, then the main streets out from it, then the lanes
        ring = [(self.sq[0] + math.cos(a) * (self.sqR + 1.2), self.sq[1] + math.sin(a) * (self.sqR + 1.2)) for a in np.linspace(0, 2 * math.pi, 64)]
        sqrd = {"kind": "walk", "pts": ring}
        self.place_along(sqrd, -1, lambda x, z: 0, setbacks=(1, 2), gap_rng=(0, 1))
        for rd in [r for r in self.roads if r["kind"] == "main"] + [r for r in self.roads if r["kind"] == "lane"]:
            for side in (1, -1):
                self.place_along(rd, side, tier, setbacks=(1, 2, 3, 5, 6, 7), gap_rng=(1, 2) if rd["kind"] == "main" else (1, 3),
                                 kinds=None)

    # =========================================================================== 5. windmills, fields
    def footpath(self, a, b):
        p = self.astar(a, [b], "lane", limit=400)
        if p and len(p) > 1:
            self.lay(p, "walk", k_end=self.k_at(*b) if self.at(self.K, *b) >= 0 else None)

    # ---- land portions (Mateo, 2026-11-11): the land boxed in by paths, each decided as a whole
    def portions(self):
        """Label every patch of land enclosed by paths (or the town edge, or water) and decide
        each one: a build portion (plots round its edge, free ground in the middle) or a field
        portion (crops on every block). Near the square and small portions build; big ones
        further out farm."""
        land = self.IN & (self.E <= getattr(self, 'LAND_R', self.R - 4)) & (self.K < 0) & ~self.WET & (self.TAKEN < 2)      # streets end 3 in from the edge: the edge closes the portions
        lab = np.zeros(self.G.shape, np.int32); n = 0
        for i, j in np.argwhere(land):
            if lab[i, j]: continue
            n += 1; st = [(i, j)]; lab[i, j] = n
            while st:
                a, b = st.pop()
                for c in ((a + 1, b), (a - 1, b), (a, b + 1), (a, b - 1)):
                    if 0 <= c[0] < lab.shape[0] and 0 <= c[1] < lab.shape[1] and land[c] and not lab[c]: lab[c] = n; st.append(c)
        self.PORT = lab; self.port = {}
        ii, jj = np.meshgrid(np.arange(self.G.shape[0]) + self.X0, np.arange(self.G.shape[1]) + self.Z0, indexing="ij")
        dsq = np.hypot(ii - self.sq[0], jj - self.sq[1]) / self.R
        build_u = self.site.get("build_u", 0.42 if self.big else 0.34)
        for L in range(1, n + 1):
            m = lab == L; area = int(m.sum())
            u_mean = float(dsq[m].mean()); u_min = float(dsq[m].min())
            g = self.G[m]
            kind = "build"
            if area >= 160 and u_mean >= build_u and u_min > (self.sqR + 4) / self.R: kind = "field"
            if kind == "field" and np.percentile(g, 95) - np.percentile(g, 5) > 12: kind = "build"   # too steep to farm
            self.port[L] = {"kind": kind, "area": area, "u": round(u_mean, 2)}
        if not any(p["kind"] == "field" for p in self.port.values()):            # always some farmland
            big = max((L for L in self.port if self.port[L]["u"] > 0.3), key=lambda L: self.port[L]["area"], default=None)
            if big: self.port[big]["kind"] = "field"
        self.PKIND = np.zeros(self.G.shape, np.int8)                              # 1 build, 2 field
        for L, p in self.port.items(): self.PKIND[lab == L] = 1 if p["kind"] == "build" else 2

    def footpath(self, a, b, fence=False):
        p = self.astar(a, [b], "lane", limit=600)
        if p and len(p) > 1:
            rd = self.lay(p, "walk", k_end=self.k_at(*b) if self.at(self.K, *b) >= 0 else None)
            if rd and fence: rd["fence"] = True
            return rd

    def nearest_street(self, x, z, cells=None):
        pts = np.argwhere(self.KIND >= PRIO["lane"]) if cells is None else cells
        if not len(pts): return None
        dd = np.hypot(pts[:, 0] + self.X0 - x, pts[:, 1] + self.Z0 - z); q = pts[dd.argmin()]
        return int(q[0]) + self.X0, int(q[1]) + self.Z0

    WINDMILL_AREA = 900          # a field portion at least this big gets a windmill near its centre
    def windmills(self):
        for L, p in sorted(self.port.items(), key=lambda t: -t[1]["area"]):
            if p["kind"] != "field" or p["area"] < self.WINDMILL_AREA: continue
            m = (self.PORT == L) & (self.TAKEN == 0)
            cells = np.argwhere(m)
            if not len(cells): continue
            ci, cj = cells.mean(0)
            order = sorted(cells, key=lambda c: (c[0] - ci) ** 2 + (c[1] - cj) ** 2)
            for c in order[:400]:
                x, z = int(c[0]) + self.X0, int(c[1]) + self.Z0
                i, j = int(c[0]), int(c[1])
                win = self.PORT[i - 6:i + 7, j - 6:j + 7]
                if win.shape != (13, 13) or (win != L).any(): continue
                g = self.G[i - 4:i + 5, j - 4:j + 5]
                if g.max() - g.min() > 4: continue
                q = self.nearest_street(x, z)
                if not q: break
                deg = snap_rot(q[0] - x, q[1] - z); f = ROT[deg]
                bp = TB.windmill(self.seed * 31 + L)
                e = self.try_place(bp, deg, (x + f[0] * 4, z + f[1] * 4), "windmill", gap=2, max_relief=4, need_walk=False)
                if not e: continue
                p["windmill"] = [x, z]
                rd = self.footpath((x + f[0] * 4, z + f[1] * 4), q, fence=True)
                break
        self.relax()

    def field_paths(self):
        """Paths cut through big fields so you can walk in: a straight track across each field
        portion every ~31 blocks, joining street to street, fenced on both sides (placeholder
        fence until the field fencing system is designed)."""
        for L, p in self.port.items():
            if p["kind"] != "field": continue
            cells = np.argwhere((self.PORT == L) & (self.K < 0))
            if len(cells) < 500: continue
            (i0, j0), (i1, j1) = cells.min(0), cells.max(0)
            along_x = (i1 - i0) < (j1 - j0)                 # cut across the long way
            span = (i1 - i0) if along_x else (j1 - j0)
            cuts = max(1, int(span // 31))
            for c in range(1, cuts + 1):
                t = (i0 if along_x else j0) + span * c // (cuts + 1)
                line = cells[cells[:, 0] == t] if along_x else cells[cells[:, 1] == t]
                if len(line) < 12: continue
                lo, hi = line[:, 1 if along_x else 0].min(), line[:, 1 if along_x else 0].max()
                a = (t + self.X0, lo + self.Z0) if along_x else (lo + self.X0, t + self.Z0)
                b = (t + self.X0, hi + self.Z0) if along_x else (hi + self.X0, t + self.Z0)
                sa, sb = self.nearest_street(*a), self.nearest_street(*b)
                if not sa or not sb or sa == sb: continue
                self.footpath(sa, sb, fence=True)
        self.relax()

    def fences(self):
        """Placeholder field fencing: a spruce fence beside every fenced field path, with a gate
        every 15 blocks. Replaced once the fencing system is designed."""
        for rd in self.roads:
            if not rd.get("fence"): continue
            path = {(int(round(x)), int(round(z))) for x, z in rd["pts"]}
            for x, z in path:
                for dx, dz in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    c = (x + dx, z + dz)
                    if not self.ok(*c) or c in path: continue
                    i, j = self.ij(*c)
                    if self.K[i, j] >= 0 or self.TAKEN[i, j] >= 2 or self.WET[i, j] or self.PKIND[i, j] != 2: continue
                    gate = (c[0] * 7 + c[1] * 13) % 15 == 0
                    self.works[(c[0], int(self.G[i, j]) + 1, c[1])] = ("spruce_fence_gate", {"facing": "n" if dx else "e"}) if gate else ("spruce_fence", {})
                    self.TAKEN[i, j] = 4

    def fields(self):
        """Crops on every free block of every field portion, on the ground as it lies (no
        levelling). Water then goes into the ground one level at a time: for each height, water
        blocks at that height are added until every crop at that height is within 4 blocks
        (a 9 x 9 square) of one. Water never sits beside a lower block, where it would spill."""
        self.FIELD = (self.PKIND == 2) & (self.E <= getattr(self, 'LAND_R', self.R - 4)) & (self.K < 0) & (self.TAKEN == 0) & ~self.WET & self.IN
        F = self.FIELD
        # crop patches: a few seeds per portion, nearest seed decides the crop
        crop_of = np.full(self.G.shape, -1, np.int8)
        for L, p in self.port.items():
            if p["kind"] != "field": continue
            cells = np.argwhere(F & (self.PORT == L))
            if not len(cells): continue
            k = max(1, len(cells) // 260)
            seeds = cells[[self.rng.randrange(len(cells)) for _ in range(k)]]
            picks = []
            for _ in range(k):
                r = self.rng.random() * 100
                for ci, (c, w, g) in enumerate(CROPS):
                    r -= w
                    if r < 0: picks.append(ci); break
                else: picks.append(0)
            d = np.stack([np.hypot(cells[:, 0] - s[0], cells[:, 1] - s[1]) + 3 * h3(int(s[0]), 0, int(s[1]), 9) for s in seeds])
            near = d.argmin(0)
            for (i, j), q in zip(cells, near): crop_of[i, j] = picks[q]
        # water, level by level
        water = np.zeros(self.G.shape, bool); dry = np.zeros(self.G.shape, bool); self.unwatered = 0; nwater = 0
        Gt = np.where(self.K >= 0, (self.K - 1) // 2, self.G)         # the top of every neighbour (a path's slab counts)
        H = self.G
        for L, p in self.port.items():
            if p["kind"] != "field": continue
            M = F & (self.PORT == L)
            for h in np.unique(H[M]):
                S = M & (H == h)
                # a cell can hold water if none of its four neighbours is lower (water would spill)
                cand = S.copy()
                for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nb = np.roll(Gt, (-di, -dj), (0, 1))
                    cand &= nb >= h
                need = S.copy()
                cov = np.zeros(S.shape, bool)
                # first a 9-block lattice, then fill what is left greedily
                ox, oz = self.rng.randrange(9), self.rng.randrange(9)
                ii, jj = np.nonzero(cand)
                order = [(a, b) for a, b in zip(ii, jj) if (a + ox) % 9 == 4 and (b + oz) % 9 == 4]
                def put(a, b):
                    water[a, b] = True; cov[max(0, a - 4):a + 5, max(0, b - 4):b + 5] = True
                for a, b in order: put(a, b)
                for _ in range(3000):
                    left = need & ~cov & ~water
                    if not left.any(): break
                    li, lj = np.nonzero(left)
                    ci_, cj_ = np.nonzero(cand & ~water)
                    if not len(ci_): break
                    # the candidate that waters the most dry crops
                    best, bc = None, 0
                    for a, b in zip(ci_, cj_):
                        if abs(a - li[0]) > 4 or abs(b - lj[0]) > 4: continue    # must reach the first dry cell
                        c = int(left[max(0, a - 4):a + 5, max(0, b - 4):b + 5].sum())
                        if c > bc: best, bc = (a, b), c
                    if best is None:                                   # nothing can reach it: no crop there
                        need[li[0], lj[0]] = False; dry[li[0], lj[0]] = True; self.unwatered += 1; continue
                    put(*best)
                left = need & ~cov & ~water                            # anything still dry on this level: headland
                dry |= left; self.unwatered += int(left.sum())
                nwater += int((water & S).sum())
        # blocks
        for i, j in np.argwhere(F):
            x, z = int(i) + self.X0, int(j) + self.Z0; g = int(self.G[i, j])
            self.TAKEN[i, j] = 3
            if water[i, j]:
                self.works[(x, g, z)] = ("water", {})
                continue
            if dry[i, j]:                                      # no water can reach it on its level: a grass headland
                self.works[(x, g, z)] = ("grass_block", {})
                if h3(x, 5, z, 8) < 0.15: self.works[(x, g + 1, z)] = ("hay_block", {"axis": "y"})
                continue
            c, w, gr = CROPS[max(0, int(crop_of[i, j]))]
            self.works[(x, g, z)] = ("farmland", {"raw": {"moisturized_amount": 7}})
            gv = gr[0] + int(h3(x, 4, z, 7) * (gr[1] - gr[0] + 1))
            self.works[(x, g + 1, z)] = (c, {"raw": {"growth": min(7, gv)}})
            self.TAKEN[i, j] = 3
        self.nparcel = sum(1 for p in self.port.values() if p["kind"] == "field"); self.nwater = nwater

    # =========================================================================== 6. dressing
    def dress(self):
        # square: a well or market cross in the middle, stalls round it facing in, lamps at the edge
        mid = TB.market_cross(self.seed) if (self.big and self.rng.random() < 0.5) or not self.big and self.rng.random() < 0.3 else TB.well(self.seed)
        self.stamp(mid, self.sq[0], self.sq[1], self.sqY, 0, "square")
        ns = 5 if self.big else 3
        a0 = self.rng.random() * 6.28
        for k in range(ns):
            a = a0 + 2 * math.pi * k / ns + self.rng.uniform(-0.2, 0.2)
            rr = self.sqR - 1.5
            x, z = self.sq[0] + math.cos(a) * rr, self.sq[1] + math.sin(a) * rr
            deg = snap_rot(self.sq[0] - x, self.sq[1] - z)
            st = dressing.stall(self.seed + k)
            ox, oz = rot_xz(1, 1, deg)
            self.stamp(st, int(round(x - ox)), int(round(z - oz)), self.sqY, deg, "stall")
        # lamps along main streets on the verge, trees in the gaps
        lamp = dressing.lamp()
        for rd in self.roads:
            if rd["kind"] not in ("main", "lane"): continue
            hw = WIDTH[rd["kind"]] / 2.0 + 1
            for t in range(6, len(rd["pts"]) - 3, 13 if rd["kind"] == "main" else 17):
                x, z = rd["pts"][t]; (x0, z0), (x1, z1) = rd["pts"][t - 1], rd["pts"][t + 1]
                d = math.hypot(x1 - x0, z1 - z0) or 1; s = 1 if (t // 13) % 2 else -1
                lx, lz = int(round(x - (z1 - z0) / d * hw * s)), int(round(z + (x1 - x0) / d * hw * s))
                if not self.inside(lx, lz, 2): continue
                i, j = self.ij(lx, lz)
                if self.K[i, j] >= 0 or self.TAKEN[i, j] or self.WET[i, j]: continue
                self.stamp(lamp, lx, lz, int(self.G[i, j]), 0, "lamp"); self.TAKEN[i, j] = 4
        nt = 0; want = int(26 * (self.R / 70) ** 2)
        if self.tree_index is not None:                # the tree database (map/trees, PR #94) instead of dressing.tree
            self.db_trees(); want = 0
        for k in range(5000):
            if nt >= want: break
            a = self.rng.random() * 2 * math.pi; r = self.R * math.sqrt(self.rng.random())
            x, z = int(self.C[0] + math.cos(a) * r), int(self.C[1] + math.sin(a) * r)
            if not self.inside(x, z, 4): continue
            i, j = self.ij(x, z)
            if self.TAKEN[i - 2:i + 3, j - 2:j + 3].any() or (self.K[i - 2:i + 3, j - 2:j + 3] >= 0).any() or self.WET[i - 2:i + 3, j - 2:j + 3].any(): continue
            if self.EAVES[i - 3:i + 4, j - 3:j + 4].any(): continue
            self.stamp(dressing.tree(self.seed * 100 + k), x, z, int(self.G[i, j]), 0, "tree")
            self.TAKEN[i - 2:i + 3, j - 2:j + 3] = 4; nt += 1
        # flowers and long grass on untouched ground near houses
        for i, j in np.argwhere(self.IN & (self.TAKEN <= 1) & (self.K < 0) & ~self.WET & ~self.EAVES):
            x, z = int(i) + self.X0, int(j) + self.Z0
            r = h3(x, 9, z, self.seed)
            if r < 0.06: self.works.setdefault((x, int(self.G[i, j]) + 1, z), ("short_grass", {}))
            elif r < 0.075: self.works.setdefault((x, int(self.G[i, j]) + 1, z), (dressing.FLOWERS[int(h3(x, 1, z, 3) * len(dressing.FLOWERS))], {}))

    tree_index = None; tree_dir = None; tree_src = None
    TOWN_TREES = {"vale": {"vale_great_oak": 2, "vale_ash": 2, "vale_silver_birch": 1, "vale_apple": 1, "vale_hawthorn": 1},
                  "frost": {"frost_tall_spruce": 3, "frost_scots_pine": 2, "frost_snow_birch": 1},
                  "salt": {"salt_umbrella_pine": 2, "salt_olive": 2, "salt_italian_cypress": 2},
                  "fen": {"fen_black_alder": 2, "fen_pollard_willow": 2, "fen_bald_cypress": 1},
                  "ember": {"ember_date_palm": 3, "ember_umbrella_acacia": 1, "ember_argan": 1}}

    def db_trees(self):
        """Scatter database trees (map/trees/place.py): crowns a block clear of every building and
        fixture, trunks off streets, fields and water; outside the town circle nothing."""
        if self.tree_src and self.tree_src not in sys.path: sys.path.insert(0, self.tree_src)
        import place as TP
        hard = self.EAVES | (self.TAKEN == 2) | ~self.IN
        if getattr(self, "RES", None) is not None: hard = hard | self.RES        # reserved corridors (rail): no crowns over them
        soft = (self.K >= 0) | (self.TAKEN >= 3) | self.WET | (self.E > self.R - 4)
        sp = {k: w for k, w in self.TOWN_TREES.get(self.site.get("region", "vale"), self.TOWN_TREES["vale"]).items() if k in self.tree_index["species"]}
        dens = 26 * (self.R / 70) ** 2 / soft.size
        for i, j, f, prof in TP.scatter(self.tree_index, sp, hard, soft, density=dens, seed=self.seed, tries=40000):
            x, z = int(i) + self.X0, int(j) + self.Z0
            name = f.replace("/", "__")
            if name not in self.designs:
                bp = self.load_stamp(os.path.join(self.tree_dir, f + ".stamp.json"), name)
                self.designs[name] = bp
            self.plan.append({"stamp": name, "db_stamp": f, "kind": "tree", "x": x, "z": z, "ground_y": int(self.G[i, j]), "rotation": 0, "footprint": 0})
            self.TAKEN[max(0, i - 1):i + 2, max(0, j - 1):j + 2] = 4

    @staticmethod
    def load_stamp(path, name):
        d = json.load(open(path)); bp = Blueprint(name); o = d["origin"]; pal = d["palette"]
        for x, y, z, k in d["blocks"]:
            nm = pal[k]["name"].replace("siege:old_", "")
            bp.cells[(x + o[0], y + o[1], z + o[2])] = (nm, pal[k].get("states") or {})
        bp.markers = d.get("markers", {}); bp.rotations = d.get("rotations", [0])
        return bp

    def roof_colours(self):
        """Roof colours by the town's mix (build-instructions/palettes/towns.md): exact counts from
        the mix, shuffled by a seeded hash of the town, then swaps until no house shares a colour
        with both street neighbours (the majority colour may, but never 4 in a row). Civic
        buildings take the town's accent. Every house was built slate; recolour_roof swaps it."""
        mix_ = self.site.get("roofs") or {"slate": 4, "dark shingle": 3, "warm red": 2, "white": 1}
        houses = [e for e in self.plan if e["kind"] == "house"]
        n = len(houses)
        if not n: return
        tot = sum(mix_.values()); cols = []
        shares = sorted(((c, w * n / tot) for c, w in mix_.items()), key=lambda t: -t[1])
        for c, sh in shares: cols += [c] * int(sh)
        rest = sorted(shares, key=lambda t: -(t[1] - int(t[1])))
        for c, _ in rest:
            if len(cols) < n: cols.append(c)
        rnd = random.Random(sum(ord(ch) for ch in self.name) * 7919 + self.seed)
        rnd.shuffle(cols)
        major = shares[0][0]
        # street neighbours: the two nearest houses (doors within 18 blocks)
        P = np.array([e["door"] for e in houses], float)
        nb = []
        for a in range(n):
            d = np.hypot(*(P - P[a]).T); d[a] = 1e9
            nb.append([int(b) for b in np.argsort(d)[:2] if d[b] < 18])
        def bad(a):
            same = sum(cols[b] == cols[a] for b in nb[a])
            if cols[a] != major: return same >= 2 or (same >= 1 and len(nb[a]) == 1)
            return same >= 2 and all(sum(cols[c] == major for c in nb[b]) >= 1 for b in nb[a])
        for _ in range(400):
            bads = [a for a in range(n) if bad(a)]
            if not bads: break
            a = rnd.choice(bads)
            far = [b for b in range(n) if b != a and b not in nb[a] and cols[b] != cols[a]]
            if not far: break
            b = rnd.choice(far); cols[a], cols[b] = cols[b], cols[a]
            if bad(b) and rnd.random() < 0.7: cols[a], cols[b] = cols[b], cols[a]
        for e, c in zip(houses, cols):
            roof = TB.COLOUR[c]
            if roof == "slate": e["roof"] = c; continue
            bp = self.designs[e["stamp"]]
            nb_ = Blueprint(f"{bp.name}_{roof}"); nb_.cells = dict(bp.cells); nb_.markers = dict(bp.markers); nb_.kind = "house"
            TB.recolour_roof(nb_, roof, seed=e["x"] * 31 + e["z"])
            self.designs[nb_.name] = nb_; e["stamp"] = nb_.name; e["roof"] = c
        acc = TB.COLOUR.get(self.site.get("accent", "slate"), "slate")
        for e in self.plan:
            if e["kind"] == "civic" and acc != "slate":
                bp = self.designs[e["stamp"]]
                nb_ = Blueprint(f"{bp.name}_{acc}"); nb_.cells = dict(bp.cells); nb_.markers = dict(bp.markers)
                TB.recolour_roof(nb_, acc, seed=7); self.designs[nb_.name] = nb_; e["stamp"] = nb_.name
        self.roof_counts = dict(collections.Counter(e.get("roof") for e in houses))

    def banks(self):
        """Where grading leaves a face two or more blocks high (a lane cut into a hill, a plot dug
        in), the face is dry-stone walling instead of bare dirt: the sunken-lane look."""
        Gt = np.where(self.K >= 0, (self.K - 1) // 2, self.G)
        for i, j in np.argwhere(self.IN & ~self.WET & (self.K < 0)):
            g = int(self.G[i, j]); low = g
            for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                a, b = i + di, j + dj
                if 0 <= a < Gt.shape[0] and 0 <= b < Gt.shape[1]: low = min(low, int(Gt[a, b]))
            if g - low < 2: continue
            x, z = int(i) + self.X0, int(j) + self.Z0
            for y in range(low + 1, g):
                if (x, y, z) in self.works and self.works[(x, y, z)][0] not in ("dirt", "air"): continue
                r = h3(x, y, z, 41)
                self.works[(x, y, z)] = ("mossy_cobblestone" if r < 0.3 else "cobblestone" if r < 0.6 else "stone_bricks" if r < 0.85 else "mossy_stone_bricks", {})

    def stamp(self, bp, x, z, y, deg, kind):
        self.designs[bp.name] = bp
        self.plan.append({"stamp": bp.name, "kind": kind, "x": x, "z": z, "ground_y": y, "rotation": deg, "footprint": 0})

    # =========================================================================== paths to blocks
    def path_blocks(self):
        wet = {}
        for i, j in np.argwhere(self.K >= 0):
            x, z = int(i) + self.X0, int(j) + self.Z0
            k = int(self.K[i, j]); kind = {4: "square", 3: "main", 2: "lane", 1: "walk"}[int(self.KIND[i, j])]
            y = (k - 1) // 2; slab = k % 2 == 1
            g0 = int(self.G0[i, j])
            if self.WET[i, j]:                                   # over water: a real bridge, built after the loop
                wet[(x, z)] = WIDTH.get(kind, 5); continue
            if kind == "square":
                r = math.hypot(x - self.sq[0], z - self.sq[1])
                if abs(r - self.sqR + 0.5) < 0.8: blk = ("polished_andesite_slab", {"half": "bottom"}) if slab else ("polished_andesite", {})
                elif x == self.sq[0] or z == self.sq[1]: blk = ("stone_brick_slab", {"half": "bottom"}) if slab else ("stone_bricks", {})
                else: blk = pave("square", x, z, slab)
            else: blk = pave(kind, x, z, slab)
            self.works[(x, y, z)] = blk
            for yy in range(g0 + 1, y): self.works[(x, yy, z)] = ("cobblestone" if yy == y - 1 else "dirt", {})
            for yy in range(y + 1, max(g0, y) + 3): self.works.setdefault((x, yy, z), ("air", {}))
        self.bridges(wet)
        # stairs where a walkway climbs a whole block in one step
        for cells, ks, f in self.walks:
            seq = list(zip(cells, ks))
            for t in range(1, len(seq)):
                (c0, k0), (c1, k1) = seq[t - 1], seq[t]
                if abs(k1 - k0) >= 2:
                    lo_c, hi_c, hi_k = (c0, c1, k1) if k1 > k0 else (c1, c0, k0)
                    fx, fz = hi_c[0] - lo_c[0], hi_c[1] - lo_c[1]
                    face = {(1, 0): "e", (-1, 0): "w", (0, 1): "s", (0, -1): "n"}.get((fx, fz), "n")
                    self.works[(hi_c[0], (hi_k - 1) // 2, hi_c[1])] = ("stone_brick_stairs", {"facing": face})

    region = "vale"

    def bridges(self, wet):
        """Paths over water get a bridge from the one bridge generator (minecraft-builder skill, bridges.py):
        arches, cutwaters, parapets, lamps, deck in the town's own paving, humped to clear boats."""
        if not wet: return
        import bridges as BR
        def walk(x, z):
            if not self.ok(x, z): return None
            i, j = self.ij(x, z)
            if self.K[i, j] < 0 or self.WET[i, j]: return None
            return int(self.K[i, j]) / 2.0
        def ground(x, z):
            if not self.ok(x, z): return int(self.WL.max()) - 2
            i, j = self.ij(x, z); return int(self.G0[i, j]) if self.WET[i, j] else int(self.G[i, j])   # the town's graded ground on land
        def water(x, z):
            if not self.ok(x, z): return None
            i, j = self.ij(x, z)
            return int(self.WL[i, j]) if self.WL[i, j] > self.G0[i, j] else None
        def is_path(x, z):
            if not self.ok(x, z): return False
            i, j = self.ij(x, z); return self.K[i, j] >= 0 and not self.WET[i, j]
        self.bridge_plans, quays = [], []
        self.bridge_clear = {}
        for c in BR.crossings_from_cells(set(wet), walk, lambda x, z: water(x, z) if water(x, z) is not None else int(self.WL[self.ij(x, z)]),
                                         lambda c: wet[c], region={"frost": "frostmarch", "salt": "saltreach", "ember": "emberwaste", "fen": "blackfen"}.get(self.region, self.region), path="town", rejects=quays):
            c.pop("_cells", None)
            c["ground"] = ground; c["name"] = f"{self.key}_bridge{len(self.bridge_plans)}"
            built = {cell: b for cell, b in BR.to_works(BR.bridge_blocks(c)).items() if b[0] != "air"}
            self.works.update(built)
            tops = {}
            for (x, y, z) in built: tops[(x, z)] = max(tops.get((x, z), y), y)
            # Mateo: a bridge never runs into a field. Join each approach end to the nearest street with paving.
            for end in c.get("_ends", []):
                for x, z in BR.connect_to_paths(end, is_path):
                    if not self.ok(x, z) or self.WET[self.ij(x, z)]: continue
                    i, j = self.ij(x, z); g = int(self.G[i, j])
                    self.works[(x, g, z)] = pave("lane", x, z, False)
                    tops[(x, z)] = g
                    self.TAKEN[i, j] = max(int(self.TAKEN[i, j]), 1)
            # Mateo: everything above the bridge, its approaches and the joining path is open to the sky
            for (x, z), top in tops.items():
                hi = top + 5
                if self.ok(x, z):
                    i, j = self.ij(x, z); hi = max(hi, int(max(self.G[i, j], self.G0[i, j])) + 5)
                for yy in range(top + 1, hi): self.works[(x, yy, z)] = ("air", {})
                self.bridge_clear[(x, z)] = (top + 1, hi)
            self.bridge_plans.append({k: v for k, v in c.items() if k not in ("ground", "_ends")})
        print(f"{self.name} bridges: {len(self.bridge_plans)} built ({', '.join(str(round(math.dist(b['a'], b['b']))) for b in self.bridge_plans)}), {len(quays)} quays ({sum(len(q) for q in quays)} cells)")
        # wet path cells that are no bridge (a street along the bank): a solid stone quay under the paving
        for comp in quays:
            for x, z in comp:
                i, j = self.ij(x, z); k = int(self.K[i, j]); y = (k - 1) // 2
                self.works[(x, y, z)] = pave("main", x, z, k % 2 == 1)
                for yy in range(int(self.G0[i, j]) + 1, y): self.works[(x, yy, z)] = ("stone_bricks", {})

    def finish_bridges(self):
        """Last pass, after banks and outlines: nothing stands over a bridge, its approaches or its joining path."""
        for (x, z), (lo, hi) in getattr(self, "bridge_clear", {}).items():
            for yy in range(lo, hi): self.works[(x, yy, z)] = ("air", {})

    def ground_blocks(self):
        """Every column the town regraded: top block, fill under it, air over a cut."""
        for i, j in np.argwhere(self.IN & ~self.WET):
            x, z = int(i) + self.X0, int(j) + self.Z0
            g, g0 = int(self.G[i, j]), int(self.G0[i, j])
            if self.K[i, j] >= 0: continue
            if g == g0 and not self.MAPROAD[i, j]: continue
            for y in range(g0 + 1, g): self.works.setdefault((x, y, z), ("dirt", {}))
            self.works.setdefault((x, g, z), ("grass_block", {}))
            for y in range(g + 1, g0 + 1): self.works.setdefault((x, y, z), ("air", {}))

    # =========================================================================== run
    def run(self):
        self.square()
        self.claim_first()
        self.streets()
        for fr in getattr(self, "first_fronts", []): self.front_road(fr)
        self.relax(); self.grade_verges()
        self.portions()
        self.place_square_buildings()
        self.houses(); self.relax()
        self.windmills()
        self.field_paths()
        self.fences()
        self.fields()
        self.dress()
        self.roof_colours()
        self.path_blocks(); self.ground_blocks(); self.banks(); self.finish_bridges()
        self.works = {(int(x), int(y), int(z)): v for (x, y, z), v in self.works.items()}
        for e in self.plan:
            for k in ('x', 'z', 'ground_y', 'rotation', 'footprint'): e[k] = int(e[k])
        c = collections.Counter(p["kind"] for p in self.plan)
        print(self.name, dict(c), "portions", collections.Counter(p["kind"] for p in self.port.values()), "water", getattr(self, "nwater", 0), "dry", getattr(self, "unwatered", 0), "roofs", getattr(self, "roof_counts", {}), "fields", self.nparcel, "streets", collections.Counter(r["kind"] for r in self.roads), "groundwork", len(self.works))

    # =========================================================================== output
    def write_worldblocks(self, out):
        """The whole town as world blocks for genworld (format hollow-crown-worldblocks/1, as map/bake_town.py
        writes for Kingsrest): groundwork first (streets, levelled plots, foundations, fields), then every
        building, fixture and tree turned and placed. Tree leaves are soft (they only fill air)."""
        pal, idx, rows = [], {}, []
        def pid(name, states, soft=False):
            key = json.dumps([name, states, soft], sort_keys=True)
            if key not in idx:
                idx[key] = len(pal); e = {"name": name, "states": states}
                if soft: e["soft"] = True
                pal.append(e)
            return idx[key]
        ground = Blueprint(self.key + "_groundwork")
        for (x, y, z), (n, p) in self.works.items(): ground.set(x, y, z, n, **p)
        ground.finish()
        solid = set()
        for (x, y, z), (n, p) in sorted(ground.cells.items(), key=lambda c: (c[0][1], c[0][0], c[0][2])):
            rows.append([x, y, z, pid(*ground.to_bedrock(n, p))])
            if n != "air": solid.add((x, y, z))
        n_ground = len(rows); seats = []
        for e in self.plan:
            if e.get("db_stamp"):
                st = json.load(open(os.path.join(self.tree_dir, e["db_stamp"] + ".stamp.json"))); seats.append([e["x"], e["z"], e["ground_y"]])
                ox, _oy, oz = st["origin"]
                for x, y, z, i in st["blocks"]:
                    q = st["palette"][i]
                    rows.append([e["x"] + x + ox, e["ground_y"] + y, e["z"] + z + oz, pid(q["name"], q.get("states") or {}, "leaves" in q["name"])])
                continue
            bp = self.designs[e["stamp"]].rotated(e["rotation"]) if e["rotation"] else self.designs[e["stamp"]]
            bp.finish()
            for (x, y, z), (n, p) in bp.cells.items():
                if n == "keep": continue
                X, Y, Z = x + e["x"], y + e["ground_y"], z + e["z"]
                if y < 0 and (X, Y, Z) in solid and e["kind"] != "square": continue
                rows.append([X, Y, Z, pid(*bp.to_bedrock(n, p))])
        d = {"format": "hollow-crown-worldblocks/1", "town": self.name,
             "note": "world coordinates, placed in order; soft entries only fill air; the first groundwork_blocks are the "
                     "groundwork (streets, plots, fields), which the map grades the land to",
             "groundwork_blocks": n_ground, "tree_seats": seats, "palette": pal, "blocks": rows}
        with open(os.path.join(out, f"{self.key}-blocks.json"), "w") as fh: json.dump(d, fh, separators=(",", ":"), default=int)
        return len(rows)

    def write(self, out):
        os.makedirs(os.path.join(out, "stamps"), exist_ok=True)
        db = {e["stamp"] for e in self.plan if e.get("db_stamp")}            # tree database stamps live in map/trees' output
        for name, bp in self.designs.items():
            if name not in db: bp.save_json(os.path.join(out, "stamps", name + ".json"))
        json.dump({"town": self.name, "centre": list(self.C), "radius": self.R, "square": {"centre": list(self.sq), "y": self.sqY, "radius": self.sqR},
                   "about": "Stamp origin = blueprint (0,0,0) at world x, ground_y, z after turning clockwise by rotation (0 = front faces south). "
                            "Apply the groundwork file first (it already levels every plot and builds the foundations), then the stamps. "
                            "Inside the circle, skip the map's own trees and road paint: the groundwork re-lays the streets.",
                   "groundwork": f"{self.key}-groundwork.json", "gates": [list(g) for g in self.gates],
                   "buildings": self.plan}, open(os.path.join(out, f"{self.key}-plan.json"), "w"), indent=1, default=int)
        pal, idx, rows = [], {}, []
        for (x, y, z), (n, p) in sorted(self.works.items()):
            key = json.dumps([n, p], sort_keys=True)
            if key not in idx: idx[key] = len(pal); pal.append([n, p])
            rows.append([x, y, z, idx[key]])
        json.dump({"town": self.name, "format": "hollow-crown-groundwork/1", "note": "world coordinates; place every block as listed (air = dig out)",
                   "palette": pal, "blocks": rows}, open(os.path.join(out, f"{self.key}-groundwork.json"), "w"), separators=(",", ":"), default=int)

    def picture(self, out):
        from PIL import Image, ImageDraw
        S = 4; R = self.R + 6
        x0, z0 = self.C[0] - R, self.C[1] - R; n = 2 * R + 1
        img = Image.new("RGB", (n * S, n * S), (40, 40, 40)); dr = ImageDraw.Draw(img)
        gmin, gmax = int(self.G[self.IN].min()), int(self.G[self.IN].max())
        occ = {}
        for e in self.plan:
            bp = self.designs[e["stamp"]]
            g, full = self.footprint(bp, e["rotation"])
            for x, z in full: occ[(x + e["x"], z + e["z"])] = e["kind"]
        COL = {"house": (236, 226, 205), "civic": (160, 150, 170), "barn": (150, 100, 60), "windmill": (250, 250, 250), "tree": (40, 95, 40),
               "lamp": (20, 20, 20), "stall": (205, 70, 60), "square": (120, 120, 120)}
        for a in range(n):
            for b in range(n):
                x, z = x0 + a, z0 + b
                if not self.ok(x, z): continue
                i, j = self.ij(x, z)
                t = (self.G[i, j] - gmin) / max(1, gmax - gmin)
                col = (int(95 + 70 * t), int(140 + 60 * t), int(80 + 40 * t))
                if self.G[i, j] % 2: col = tuple(int(c * 0.93) for c in col)
                if self.WET[i, j] and self.K[i, j] < 0: col = (70, 120, 200)
                if getattr(self, "FIELD", None) is not None and self.FIELD[i, j]: col = (214, 190, 90)
                if self.K[i, j] >= 0: col = {4: (175, 170, 160), 3: (150, 140, 125), 2: (170, 155, 130), 1: (190, 180, 160)}[int(self.KIND[i, j])]
                if (x, z) in occ: col = COL.get(occ[(x, z)], (200, 200, 200))
                if not self.IN[i, j]: col = tuple(int(c * 0.55) for c in col)
                dr.rectangle([a * S, b * S, a * S + S - 1, b * S + S - 1], fill=col)
        c = ((self.C[0] - x0) * S, (self.C[1] - z0) * S)
        dr.ellipse([c[0] - self.R * S, c[1] - self.R * S, c[0] + self.R * S, c[1] + self.R * S], outline=(160, 40, 40), width=2)
        img.save(os.path.join(out, f"{self.key}-plan.png"))

    # ------------------------------------------------------------------ a railway station on the town's edge
    def station_site(self, stop, deg, region):
        """Stamp the Grand Station (the biggest stage, so it claims the ground) with its stop on the line at
        stop (x, z) and its street front toward the town (deg turns the station's north-facing front), level
        its ground, keep houses off it, and offer every stage as levels in the 3D view."""
        import stations
        x, z = stop; bp = stations.grand(region); bp.kind = "station"
        g, _ = self.footprint(bp, deg); cells = [(gx + x, gz + z) for gx, gz in g if self.ok(gx + x, gz + z)]
        y = int(max(self.at(self.G, cx, cz) for cx, cz in cells))
        self.stamp(bp, x, z, y, deg, "station"); e = self.plan[-1]; e["name"] = "station"; e["footprint"] = len(cells)
        self.foundation(cells, y)
        for cx, cz in cells:
            for dx in (-2, -1, 0, 1, 2):
                for dz in (-2, -1, 0, 1, 2):
                    if self.ok(cx + dx, cz + dz): self.TAKEN[self.ij(cx + dx, cz + dz)] = 2
        (bx0, _, bz0), _ = bp.bounds(); fx, fz = rot_xz(0, bz0 - 1, deg); f = rot_xz(0, -1, deg)
        self.station_front = ((x + fx, z + fz), f, y)
        self.station_axis = (x, z, deg); self.wall_region = region
        self.add_levels("station", e, [(st.capitalize(), bp if st == "grand" else getattr(stations, st)(region)) for st in stations.STAGES], align="origin")
        return e

    def claim_first(self):
        """Civic buildings named in site["first"] (Millbrook's chapel: Sister Wren's, on the square) claim their
        ground facing the square before the streets go down, as the town hall does; a street joins the door."""
        self.first_fronts = []
        for name, mk in self.site.get("civic", []):
            if name not in self.site.get("first", ()): continue
            bp = mk(); bp.kind = "civic"; done = None
            for extra_r in range(1, 20, 2):
                for k in range(72):
                    a = 2 * math.pi * k / 72
                    rr = self.sqR + 1 + extra_r
                    x, z = int(round(self.sq[0] + math.cos(a) * rr)), int(round(self.sq[1] + math.sin(a) * rr))
                    deg = snap_rot(self.sq[0] - x, self.sq[1] - z)
                    done = self.try_place(bp, deg, (x, z), "civic", gap=1, max_relief=8, need_walk=False)
                    if done: break
                if done: break
            if not done: print("no room for", name); continue
            done["name"] = name
            f = ROT[deg]; self.first_fronts.append(((x, z), f, done["ground_y"]))

    def front_road(self, front, kind="main"):
        """A street from a door (front = (door xz, facing, floor y)) straight on to the streets, or by path search."""
        (sx, sz), f, yf = front
        for t in range(1, 60):
            c = (sx + f[0] * t, sz + f[1] * t)
            if not self.ok(*c) or self.at(self.WET, *c): break
            if self.at(self.K, *c) >= 0:
                self.lay([(sx + f[0] * k, sz + f[1] * k) for k in range(t + 1)], kind, k_start=2 * yf + 1, k_end=int(self.at(self.K, *c))); return
        goals = [(int(i) + self.X0, int(j) + self.Z0) for i, j in np.argwhere((self.K >= 0) & (self.KIND >= PRIO["lane"]))]
        p = self.astar((sx, sz), goals, kind, limit=3000) if goals else None
        if p and len(p) > 1: self.lay(p, kind, k_start=2 * yf + 1, k_end=self.k_at(*p[-1]))

    def station_road(self, kind="main"):
        """A street from the station's front straight to the town's streets (or by path search if none ahead)."""
        if not getattr(self, "station_front", None): return
        (sx, sz), f, yf = self.station_front
        for t in range(1, 60):
            c = (sx + f[0] * t, sz + f[1] * t)
            if not self.ok(*c) or self.at(self.WET, *c): break
            if self.at(self.K, *c) >= 0:
                self.lay([(sx + f[0] * k, sz + f[1] * k) for k in range(t + 1)], kind, k_start=2 * yf + 1, k_end=int(self.at(self.K, *c))); return
        goals = [(int(i) + self.X0, int(j) + self.Z0) for i, j in np.argwhere((self.K >= 0) & (self.KIND >= PRIO["lane"]))]
        x, z, n = sx, sz, 0
        while self.ok(x, z) and self.at(self.TAKEN, x, z) >= 2 and n < 30: x, z = x + f[0], z + f[1]; n += 1
        p = self.astar((x, z), goals, kind, limit=3000) if goals else None
        if p and len(p) > 1: self.lay([(sx + f[0] * k, sz + f[1] * k) for k in range(n)] + p, kind, k_start=2 * yf + 1, k_end=self.k_at(*p[-1]))
        else: print("no station road")

    # ------------------------------------------------------------------ town wall
    WALL_STONE = [("stone_bricks", 6), ("mossy_stone_bricks", 2), ("cracked_stone_bricks", 1), ("andesite", 1)]
    def town_wall(self, H=5):
        """A curtain wall on the town's edge (Mateo 2026-11-12: Gull's Rest needs one): 2 thick, crenellated,
        a taller tower every ~22 blocks, an arch wherever a street crosses, open over water, and the station
        standing in the line as its own gatehouse."""
        band = (self.E > self.R - 1.0) & (self.E <= self.R + 1.0) & ~self.WET
        if getattr(self, "station_axis", None):
            # the railway runs along the station's back (local z -6..1 kept clear for the passing loop): the
            # wall never runs beside the track; it turns in and runs straight along the town side of it, meeting
            # the station as its gatehouse, the way Kingsrest's does (map thread 2026-11-12)
            sx, sz, sdeg = self.station_axis
            nx, nz = rot_xz(0, 1, sdeg)
            ii0, jj0 = np.indices(band.shape)
            lz = (ii0 + self.X0 - sx) * nx + (jj0 + self.Z0 - sz) * nz
            band &= ~((lz >= -9) & (lz <= 12))
            band |= (lz >= -11) & (lz < -9) & (self.E <= self.R + 1.0) & ~self.WET & (self.TAKEN < 2) & (self.K < 0)
        for cx, cz in self.footprint_cells("station"):
            for dx in range(-2, 3):
                for dz in range(-2, 3):
                    if self.ok(cx + dx, cz + dz): band[self.ij(cx + dx, cz + dz)] = False
        road = self.K >= 0
        near = np.zeros_like(band)
        for di in range(-3, 4):
            for dj in range(-3, 4): near |= np.roll(np.roll(road, di, 0), dj, 1)
        kit = self.wall_kit()
        WS = kit["stone"] if kit else self.WALL_STONE
        cap = kit["cap"] if kit else "stone_brick_wall"
        def stone(x, y, z):
            r = h3(x, y, z, 41) * sum(w for _, w in WS)
            for m, w in WS:
                r -= w
                if r < 0: return (m, {})
            return (WS[0][0], {})
        if kit: step = 1e9                                      # towers are the station's own (wall_towers)
        ii, jj = np.nonzero(band)
        ang = np.degrees(np.arctan2(jj + self.Z0 - self.C[1], ii + self.X0 - self.C[0])) % 360
        step = 22 / (2 * math.pi * self.R) * 360 if not kit else 1e9
        line = []
        for i, j, a in zip(ii, jj, ang):
            x, z = int(i) + self.X0, int(j) + self.Z0
            g = int(self.G[i, j])
            if road[i, j]:                                          # gate: an arch over the street
                base = (int(self.K[i, j]) - 1) // 2 + 5
                for y in range(base, base + 3): self.works[(x, y, z)] = stone(x, y, z)
                if (x + z) % 2 == 0: self.works[(x, base + 3, z)] = stone(x, base + 3, z)
                continue
            tower = (a % step) < step * 0.12
            top = g + (H + 3 if (tower or near[i, j]) and not kit else H)
            for y in range(g + 1, top + 1): self.works[(x, y, z)] = stone(x, y, z)
            if (x * 3 + z) % 2 == 0: self.works[(x, top + 1, z)] = (cap, {})
            if (tower or near[i, j]) and (x + z) % 7 == 0 and not kit: self.works[(x, top, z)] = ("lantern", {})
            self.TAKEN[i, j] = 2; line.append((x, z))
        self.wall_towers(line, H)

    # Mateo 2026-11-12: "a castle-style train station, but not a castle-style wall": a town whose station
    # stands in its wall builds the wall in the station's own stone, capped like it, and its towers are the
    # station's towers (stations.py / settle_halls.tower): spires in the region's roof, flanking every gate
    def wall_kit(self):
        region = getattr(self, "wall_region", None)
        if not region: return None
        import stations
        _, _, P, k, _ = stations.start(region, "grand")
        return {"stone": [(k("stone"), 7), (P.get("quoin2", k("stone")), 2), (k("cobbled"), 1)],
                "cap": P.get("chimney_cap", "stone_brick_wall")}

    def wall_tower_bp(self, h):
        import settle_buildings as SB, settle_halls as SH
        bp, B, P, k, L = SB.new(f"wall_tower_{h}", self.wall_region)
        SH.tower(B, 0, 0, 2, 1, h, top="spire" if L["roof"] != "flat" else "crenel")
        bp.kind = "civic"; bp.markers["door"] = (0, 0, 3)
        return bp

    def wall_towers(self, line, H, gap=22):
        """Towers on the wall line: one each side of every gate (a gatehouse), then one every ~gap blocks.
        A tower's 5 x 5 never sits on a street, water or another building."""
        if not getattr(self, "wall_region", None) or not line: return
        lineset = set(line)
        road = [(int(i) + self.X0, int(j) + self.Z0) for i, j in np.argwhere(self.K >= 0)]
        roadset = set(road)
        def fits(x, z):
            for dx in range(-2, 3):
                for dz in range(-2, 3):
                    c = (x + dx, z + dz)
                    if not self.ok(*c) or c in roadset or self.at(self.WET, *c): return False
                    if self.at(self.TAKEN, *c) >= 2 and c not in lineset: return False
            return True
        gates = [c for c in roadset if any((c[0] + dx, c[1] + dz) in lineset for dx, dz in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
        chosen = []
        def far(c, d): return all(math.hypot(c[0] - q[0], c[1] - q[1]) >= d for q in chosen)
        if gates:
            gx = np.array(gates)
            for c in sorted(line, key=lambda c: (h3(c[0], 0, c[1], 7))):
                dmin = float(np.min(np.hypot(gx[:, 0] - c[0], gx[:, 1] - c[1])))
                if 4.0 <= dmin <= 6.5 and far(c, 9) and fits(*c): chosen.append(c)
        for c in sorted(line, key=lambda c: math.atan2(c[1] - self.C[1], c[0] - self.C[0])):
            if far(c, gap) and fits(*c): chosen.append(c)
        h = H + 7
        bp = self.wall_tower_bp(h)
        for x, z in chosen:
            cells = [(x + dx, z + dz) for dx in range(-2, 3) for dz in range(-2, 3)]
            y = int(max(self.at(self.G, *c) for c in cells))
            for cx, cz in cells:
                for yy in range(y + 1, y + h + 12): self.works.pop((cx, yy, cz), None)
            self.foundation(cells, y)
            self.stamp(bp, x, z, y, 0, "civic"); self.plan[-1]["name"] = "wall tower"
            for c in cells: self.TAKEN[self.ij(*c)] = 2

    def footprint_cells(self, kind):
        out = []
        for e in self.plan:
            if e["kind"] != kind: continue
            g, _ = self.footprint(self.designs[e["stamp"]], e["rotation"]); out += [(gx + e["x"], gz + e["z"]) for gx, gz in g]
        return out

    # ------------------------------------------------------------------ levels in the 3D view
    def add_levels(self, group, e, options, align="door", default=None):
        """Mateo 2026-11-12: every 3D view lets him level up the town hall and the train station. e is the plan
        entry of the biggest level (it claimed the ground); options are (label, Blueprint) for every level.
        align "door" keeps each level's door on e's door cell, "origin" keeps the stamp origin (stations: the
        stop on the line). The base scene leaves e out; each level is its own little scene (scene_levels)."""
        big = self.designs[e["stamp"]]
        deg = e["rotation"]
        if align == "door":
            dx, dz = self.door_of(big); rdx, rdz = rot_xz(dx, dz, deg); door = (e["x"] + rdx, e["z"] + rdz)
        opts = []
        for label, bp in options:
            if align == "door":
                dx, dz = self.door_of(bp); rdx, rdz = rot_xz(dx, dz, deg); ox, oz = door[0] - rdx, door[1] - rdz
            else: ox, oz = e["x"], e["z"]
            opts.append((label, bp, ox, oz))
        if not hasattr(self, "levels"): self.levels = []
        self.levels.append({"group": group, "entry": e, "options": opts, "default": len(opts) - 1 if default is None else default})

    def scene_levels(self, out):
        """One scene file per level of every level group: the stamp, plus stone foundation down to the ground
        under its footprint. Returns [{group, labels, default, files}] for render/compose.py."""
        res = []
        for gi, L in enumerate(getattr(self, "levels", [])):
            e = L["entry"]; files = []
            for k, (label, bp, ox, oz) in enumerate(L["options"]):
                s = Blueprint(f"{self.key}_{L['group']}_{k}")
                r = bp.rotated(e["rotation"]); low = {}
                for (x, y, z), v in r.cells.items():
                    if v[0] == "keep": continue
                    X, Y, Z = x + ox, y + e["ground_y"], z + oz
                    s.cells[(X, Y, Z)] = v
                    if (X, Z) not in low or Y < low[(X, Z)]: low[(X, Z)] = Y
                for (X, Z), y0 in low.items():
                    if not self.ok(X, Z): continue
                    g = int(self.at(self.G, X, Z))
                    for y in range(g + 1, y0): s.cells[(X, y, Z)] = VALE["plinth"](X, y, Z)
                s.cells = {(int(x), int(y), int(z)): v for (x, y, z), v in s.cells.items()}
                s.finish(); f = os.path.join(out, f"level_{gi}_{k}.json"); s.save_logical(f); files.append(f)
            res.append({"group": L["group"], "labels": [o[0] for o in L["options"]], "default": L["default"], "files": files})
        json.dump(res, open(os.path.join(out, "levels.json"), "w"), indent=1)
        return res

    def scene(self, out):
        s = Blueprint(f"{self.key}_scene"); R = self.R + 20
        skip = {id(L["entry"]) for L in getattr(self, "levels", [])}
        for x in range(self.C[0] - R, self.C[0] + R + 1):
            for z in range(self.C[1] - R, self.C[1] + R + 1):
                if not self.ok(x, z): continue
                # the preview shows the land round the town out to a ragged edge, not a cut-out disc
                if self.E[self.ij(x, z)] > self.R + 8 + 6 * h3(x // 4, 0, z // 4, 5) + 3 * h3(x, 1, z, 6): continue
                i, j = self.ij(x, z); g = int(self.G[i, j])
                if self.K[i, j] >= 0: g = (int(self.K[i, j]) - 1) // 2 - 1
                low = g
                for d in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    if self.ok(x + d[0], z + d[1]): low = min(low, int(self.G[self.ij(x + d[0], z + d[1])]) - 1)
                for y in range(low - 1, g): s.set(x, y, z, "dirt")
                if self.WET[i, j]:
                    s.set(x, int(self.G0[i, j]), z, "gravel")
                    for y in range(int(self.G0[i, j]) + 1, int(self.WL[i, j]) + 1): s.set(x, y, z, "water")
                else: s.set(x, g, z, "grass_block")
        for (x, y, z), v in self.works.items():
            if v[0] == "air": s.cells.pop((x, y, z), None)
            else: s.cells[(x, y, z)] = v
        for L in getattr(self, "levels", []):                 # a levelled plot shows grass round the smaller levels
            e = L["entry"]; g, _ = self.footprint(self.designs[e["stamp"]], e["rotation"])
            for gx, gz in g:
                X, Z = gx + e["x"], gz + e["z"]
                if self.ok(X, Z) and self.K[self.ij(X, Z)] < 0: s.cells[(X, int(self.at(self.G, X, Z)), Z)] = ("grass_block", {})
        for e in self.plan:
            if id(e) in skip: continue
            bp = self.designs[e["stamp"]].rotated(e["rotation"])
            for (x, y, z), v in bp.cells.items():
                if v[0] == "keep": continue
                if y < 0 and (x + e["x"], y + e["ground_y"], z + e["z"]) in s.cells and e["kind"] not in ("square",): continue
                s.cells[(x + e["x"], y + e["ground_y"], z + e["z"])] = v
        s.cells = {(int(x), int(y), int(z)): v for (x, y, z), v in s.cells.items()}
        s.finish()
        cx, cz = self.sq; y = self.sqY
        rd = max((r for r in self.roads if r["kind"] in ("main", "lane")), key=lambda r: len(r["pts"]), default=None)
        if rd:
            t = min(len(rd["pts"]) - 2, 28); (x0, z0), (x1, z1) = rd["pts"][t - 1], rd["pts"][t + 1]
            px, pz = rd["pts"][t]; py = (self.k_at(int(round(px)), int(round(pz))) - 1) // 2
            street = [math.degrees(math.atan2(x1 - x0, z1 - z0)) + 35, 24, 42, px, py + 2, pz]
            ang = math.degrees(math.atan2(x1 - x0, z1 - z0))
            lane = [ang + 180 + 12, 13, 24, px, py + 1, pz]          # low, looking along the street
        else: street = lane = [-140, 20, 55, cx + 18, y + 2, cz + 10]
        s.camera = {"views": {"town": [-35, 38, self.R * 2.3, self.C[0], y, self.C[1]], "aerial": [10, 72, self.R * 2.7, self.C[0], y, self.C[1]],
                              "square": [25, 30, 48 if not self.big else 62, cx, y + 2, cz], "street": street, "lane": lane,
                              "lane2": [lane[0] + 180, 13, 24] + lane[3:]}}
        s.save_logical(os.path.join(out, "scene.json"))
        if getattr(self, "levels", None): self.scene_levels(out)
        return len(s.cells)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("site"); ap.add_argument("slice"); ap.add_argument("lines"); ap.add_argument("out")
    ap.add_argument("--seed", type=int, default=None); ap.add_argument("--render", action="store_true")
    ap.add_argument("--trees", default="", help="trees.json from map/trees/build_trees.py (stamps beside it); scatter with map/trees/place.py")
    ap.add_argument("--trees-src", default=os.path.join(HERE, "..", "trees"))
    ap.add_argument("--textures", default=""); ap.add_argument("--three", default=""); ap.add_argument("--shots", default="town,square,street")
    a = ap.parse_args()
    if a.site in SITES: site = dict(SITES[a.site]); name = a.site
    else:
        x, z, r, size = a.site.split(","); site = dict(centre=(int(x), int(z)), radius=int(r), size=size, fixed_square=False,
                                                     square_r=7 if size == "town" else 5, seed=5, civic=[]); name = f"Town {x} {z}"
    seed = a.seed if a.seed is not None else site.get("seed", 1)
    T = np.load(a.slice); L = json.load(open(a.lines))
    if a.trees:
        Town.tree_index = json.load(open(a.trees)); Town.tree_dir = os.path.dirname(os.path.abspath(a.trees)); Town.tree_src = os.path.abspath(a.trees_src)
    t = Town(name, site, T, L, seed); t.run()
    os.makedirs(a.out, exist_ok=True); t.write(a.out); t.picture(a.out)
    print("world blocks", t.write_worldblocks(a.out))
    print("scene blocks", t.scene(a.out))
    if a.render:
        subprocess.run([sys.executable, os.path.join(HERE, "render", "render.py"), os.path.join(a.out, "scene.json"), a.out,
                        "--title", name, "--blurb", "Generated town on the real map ground.", "--textures", a.textures, "--three", a.three,
                        "--shots", a.shots], check=True)

if __name__ == "__main__":
    main()
