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
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from bp import Blueprint
from kit import h3, VALE, mix
import towngen_build as TB
import dressing, vale, vale_civic

SITES = {
    # map towns (centre = the square genworld writes; town-sites.json)
    "Millbrook": dict(centre=(-60, -470), radius=70, size="town", fixed_square=True, square_r=7, seed=11,
                      roofs={"dark shingle": 5, "slate": 3, "warm red": 2}, accent="slate",
                      civic=[("chapel", lambda: vale_civic.chapel(name="millbrook_chapel")),
                             ("clock tower", vale_civic.clock_tower)]),
    "Kingsrest": dict(centre=(-118, -118), radius=90, size="town", fixed_square=True, square_r=9, seed=7, inn=True,
                      roofs={"slate": 4, "dark shingle": 3, "warm red": 2, "white": 1}, accent="copper",
                      civic=[("guildhall", vale_civic.guildhall), ("chapel", vale_civic.chapel)]),
    # a farming village on rolling Vale ground between Kingsrest and Millbrook (test site)
    "Alder Combe": dict(centre=(-200, -330), radius=60, size="village", fixed_square=False, square_r=7, seed=23, civic=[],
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
        self.IN = self.D <= self.R
        self.Gs = self._blur(self.G0.astype(np.float32), 3)    # smoothed ground for path costs and heights
        self.G = self.G0.copy()                                 # graded ground (top block y)
        self.K = np.full(self.G0.shape, -1, np.int32)           # path surface in half blocks (slab at (k-1)//2 when odd)
        self.KIND = np.zeros(self.G0.shape, np.int8)            # path kind (PRIO), 0 = none
        self.KMIN = np.where(self.WET, 2 * (self.WL + 1) + 1, -1)  # paths over water become a raised deck
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
    def inside(self, x, z, m=0): return self.ok(x, z) and (x - self.C[0]) ** 2 + (z - self.C[1]) ** 2 <= (self.R - m) ** 2
    def at(self, A, x, z): i, j = self.ij(x, z); return A[i, j]
    def u(self, x, z): return math.hypot(x - self.sq[0], z - self.sq[1]) / self.R

    # =========================================================================== 2. paths
    def square(self):
        s = self.site; r = s["square_r"]
        if s.get("fixed_square"): c = tuple(s["centre"])
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
                if self.D[a, b] > self.R - 3: c += 4
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

    def lay(self, cells, kind, k_start=None, k_end=None):
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
                    if (cx + 0.0 - x) ** 2 + (cz + 0.0 - z) ** 2 > r * r + 0.15 or not self.inside(cx, cz): continue
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
        gates = []
        for name, pts in list(self.L["roads"].items()) + list(self.L["trails"].items()):
            pts = self.resample(pts, 1.0)
            ins = [self.inside(int(round(x)), int(round(z)), 3) for x, z in pts]
            for t in range(1, len(pts)):
                if ins[t] != ins[t - 1]:
                    x, z = pts[t] if ins[t] else pts[t - 1]
                    gates.append((int(round(x)), int(round(z)), name, "trail" if name in self.L["trails"] else "road"))
        merged = []
        for g in gates:
            if all(math.hypot(g[0] - m[0], g[1] - m[1]) > 14 for m in merged): merged.append(g)
        want = 3 if self.big else 2
        ang0 = self.rng.random() * 360
        while len(merged) < want:                # no map road here: open lanes out to the country anyway
            a = math.radians(ang0 + 360 * len(merged) / want + self.rng.uniform(-25, 25))
            x, z = int(self.C[0] + math.cos(a) * (self.R - 4)), int(self.C[1] + math.sin(a) * (self.R - 4))
            if not self.at(self.WET, x, z) and all(math.hypot(x - m[0], z - m[1]) > 20 for m in merged): merged.append((x, z, "country lane", "lane"))
            else: ang0 += 17
        self.gates = merged
        # main streets: each gate in to the square
        for gx, gz, name, kind in merged:
            path = self.astar((gx, gz), ring, "main")
            if path: self.lay(path[::-1], "main" if kind == "road" else "lane", k_start=self.k_at(*path[-1]))
        # lanes branch off the main streets, some looping back into another street
        nl = self.rng.randint(8, 11) if self.big else self.rng.randint(4, 6)
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
                                         if math.hypot(c[0] + self.X0 - path[-1][0], c[1] + self.Z0 - path[-1][1]) < 18
                                         and math.hypot(c[0] + self.X0 - sx, c[1] + self.Z0 - sz) > 25], "lane", limit=60) if self.rng.random() < 0.5 else None
            ke = None
            if tail and len(tail) > 1: path = path + tail[1:]; ke = self.k_at(*tail[-1])
            rd = self.lay(path, "lane", k_start=self.k_at(sx, sz), k_end=ke)
            if rd: mains.append(rd); nl -= 1

    def relax(self, it=40):
        """Make sure no two touching path cells differ by more than half a block anywhere,
        including where streets cross and widen."""
        M = self.K >= 0
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

    def walk_cells(self, start, f, maxlen=6):
        """Cells from the door step forward (direction f) until a path is reached."""
        out = []; x, z = start
        for _ in range(maxlen):
            if not self.inside(x, z): return None
            if self.at(self.K, x, z) >= 0 and self.at(self.KIND, x, z) >= PRIO["walk"] and (x, z) not in out:
                return out, (x, z)
            out.append((x, z)); x, z = x + f[0], z + f[1]
        return None

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
        for yf in range(int(hs.min()), int(hs.max()) + 1):
            cost = float(np.abs(hs - yf).sum()) + 0.6 * float(np.maximum(0, yf - hs).sum())   # fill shows; cutting is tidier
            if need_walk:
                n = len(cells); dk = abs(2 * yf + 1 - k_road)
                if dk > 2 * n + 2: continue          # too steep even with stairs
                cost += 6 * max(0, dk - n - 1)        # half steps are free; whole steps (stairs) cost a bit
            if best is None or cost < best[0]: best = (cost, yf)
        if best is None: return None
        yf = best[1]
        # commit
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
        e = {"stamp": bp.name, "kind": kind, "x": ox, "z": oz, "ground_y": yf, "rotation": deg, "footprint": len(G),
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
        for t in range(n):
            target = k0 + (k_road - k0) * (t + 1) / (n + 1)
            ks.append(int(round(target)))
        ks[0] = k0 if abs(k_road - k0) <= n else ks[0]
        for (x, z), k in zip(cells, ks):
            i, j = self.ij(x, z)
            self.K[i, j] = k; self.KIND[i, j] = PRIO["walk"]; self.TAKEN[i, j] = max(self.TAKEN[i, j], 1)
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
            tier = tier_fn(x, z)
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
        if tier == 3 or (kinds and "barn" in kinds and self.rng.random() < 0.35): return TB.barn(sd, 9, self.rng.choice([11, 13]))
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
        makers = list(self.site.get("civic", []))
        if self.site.get("inn"): makers.insert(0, ("inn", lambda: vale.coaching_inn(style="tudor")))
        for name, mk in makers:
            bp = mk(); bp.kind = "civic"
            done = None
            for k in range(72):
                a = 2 * math.pi * (k * 0.618 % 1)
                for extra_r in (1, 2, 3, 5):
                    rr = self.sqR + 1 + extra_r
                    x, z = self.sq[0] + math.cos(a) * rr, self.sq[1] + math.sin(a) * rr
                    deg = snap_rot(self.sq[0] - x, self.sq[1] - z)
                    done = self.try_place(bp, deg, (int(round(x)), int(round(z))), "civic", gap=1, max_relief=6)
                    if done: done["name"] = name; break
                if done: break
            if not done: print("no room on the square for", name)

    def houses(self):
        def tier(x, z):
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
                self.place_along(rd, side, tier, setbacks=(1, 2, 3), gap_rng=(1, 2) if rd["kind"] == "main" else (1, 3),
                                 kinds=("barn",) if True else None)

    # =========================================================================== 5. windmills, fields
    def footpath(self, a, b):
        p = self.astar(a, [b], "lane", limit=400)
        if p and len(p) > 1:
            self.lay(p, "walk", k_end=self.k_at(*b) if self.at(self.K, *b) >= 0 else None)

    def windmills(self):
        n = 2 if self.big else 1
        cand = []
        for _ in range(2500):
            a = self.rng.random() * 2 * math.pi; r = self.R * math.sqrt(self.rng.uniform(0.3, 0.85))
            x, z = int(self.C[0] + math.cos(a) * r), int(self.C[1] + math.sin(a) * r)
            if not self.inside(x, z, 8) or self.u(x, z) < 0.45: continue
            i, j = self.ij(x, z)
            if self.TAKEN[i - 6:i + 7, j - 6:j + 7].any() or (self.K[i - 6:i + 7, j - 6:j + 7] >= 0).any() or self.WET[i - 7:i + 8, j - 7:j + 8].any(): continue
            win = self.G[i - 4:i + 5, j - 4:j + 5]
            if win.max() - win.min() > 3: continue
            cand.append((float(win.mean()) + self.rng.random(), x, z))
        cand.sort(reverse=True); got = []
        for h, x, z in cand:
            if len(got) >= n: break
            if any(math.hypot(x - a, z - b) < 30 for a, b in got): continue
            # door toward the nearest street
            pts = np.argwhere(self.KIND >= PRIO["lane"])
            if not len(pts): break
            dd = np.hypot(pts[:, 0] + self.X0 - x, pts[:, 1] + self.Z0 - z); q = pts[dd.argmin()]
            qx, qz = int(q[0]) + self.X0, int(q[1]) + self.Z0
            deg = snap_rot(qx - x, qz - z); f = ROT[deg]
            bp = TB.windmill(self.seed * 31 + len(got))
            e = self.try_place(bp, deg, (x + f[0] * 4, z + f[1] * 4), "windmill", gap=2, max_relief=4, need_walk=False)
            if not e: continue
            got.append((x, z))
            self.footpath((x + f[0] * 4, z + f[1] * 4), (qx, qz))
        self.relax()

    def fields(self):
        """Farmland strips between the paths in the outer ring, levelled into terraces."""
        nearpath = self._dilate(self.K >= 0, 2)
        free = self.IN & (self.D <= self.R - 2) & ~self.WET & (self.TAKEN == 0) & ~nearpath & ~self.FIX
        ii, jj = np.meshgrid(np.arange(self.G.shape[0]) + self.X0, np.arange(self.G.shape[1]) + self.Z0, indexing="ij")
        U = np.hypot(ii - self.sq[0], jj - self.sq[1]) / self.R
        free &= U >= (0.42 if self.big else 0.3)
        lab = np.zeros(self.G.shape, np.int32); nlab = 0
        for i, j in np.argwhere(free):
            if lab[i, j]: continue
            nlab += 1; st = [(i, j)]; lab[i, j] = nlab
            while st:
                a, b = st.pop()
                for c in ((a + 1, b), (a - 1, b), (a, b + 1), (a, b - 1)):
                    if 0 <= c[0] < lab.shape[0] and 0 <= c[1] < lab.shape[1] and free[c] and not lab[c]: lab[c] = nlab; st.append(c)
        self.FIELD = np.zeros(self.G.shape, bool); nparcel = 0
        for L in range(1, nlab + 1):
            cells = np.argwhere(lab == L)
            if len(cells) < 70: continue
            i0, j0 = cells.min(0); i1, j1 = cells.max(0)
            along_x = (i1 - i0) >= (j1 - j0)
            S = 9; oA = self.rng.randint(0, 6); oB = self.rng.randint(0, 9)
            comp = lab == L
            # strips: 9 across, 11-21 along, a one-block grass balk between them
            for c in range((j0 if along_x else i0) - oB, (j1 if along_x else i1) + 1, S + 1):
                a = (i0 if along_x else j0)
                end = (i1 if along_x else j1)
                while a <= end:
                    # the longest run of whole 9-wide columns from here, cut into strips of 7-21
                    run = 0
                    while a + run <= end:
                        col = comp[a + run, max(0, c):c + S] if along_x else comp[max(0, c):c + S, a + run]
                        if c < 0 or len(col) < S or not col.all(): break
                        run += 1
                    if run < 7: a += max(1, run + 1); continue
                    while run >= 7:
                        Ln = min(run, self.rng.choice([11, 13, 15, 17, 19, 21]))
                        if Ln % 2 == 0: Ln -= 1
                        if Ln < 7: break
                        nparcel += self.parcel(comp, a, c, Ln, S, True) if along_x else self.parcel(comp, c, a, Ln, S, False)
                        a += Ln + 1; run -= Ln + 1
                    a += max(1, run + 1)
        # hedges where the fields meet the streets, orchards and meadows in the left-over corners
        F = self.FIELD
        edge = self._dilate(F, 1) & ~F & ~(self.K >= 0) & (self.TAKEN == 0) & self.IN & ~self.WET
        hedge = edge & self._dilate(self.K >= 0, 3)
        for i, j in np.argwhere(hedge):
            x, z = int(i) + self.X0, int(j) + self.Z0
            if h3(x, 0, z, 77) < 0.12: continue                  # gaps to walk through
            g = int(self.G[i, j])
            self.works[(x, g + 1, z)] = ("oak_leaves" if h3(x, 1, z, 78) < 0.7 else "azalea_leaves", {})
            self.TAKEN[i, j] = 4
        self.nparcel = nparcel

    def parcel(self, comp, a, b, Ln, S, along_x):
        (ia, ib) = (Ln, S) if along_x else (S, Ln)
        if a < 0 or b < 0 or a + ia > comp.shape[0] or b + ib > comp.shape[1]: return 0
        if not comp[a:a + ia, b:b + ib].all(): return 0
        win = self.G[a:a + ia, b:b + ib]
        if win.max() - win.min() > 4: return 0
        m = int(round(float(np.median(win))))
        r = self.rng.random() * 100; crop = "wheat"; gr = (5, 7)
        for c, w, g in CROPS:
            r -= w
            if r < 0: crop, gr = c, g; break
        fallow = self.rng.random() < 0.08
        for di in range(ia):
            for dj in range(ib):
                i, j = a + di, b + dj; x, z = i + self.X0, j + self.Z0
                g0 = int(self.G[i, j])
                for y in range(m + 1, max(g0, m) + 2): self.works[(x, y, z)] = ("air", {})
                for y in range(g0 + 1, m): self.works[(x, y, z)] = ("dirt", {})
                across = dj if along_x else di; alongk = di if along_x else dj
                if across == S // 2 and 0 < alongk < (Ln - 1):
                    self.works[(x, m, z)] = ("water", {}); self.works[(x, m - 1, z)] = ("dirt", {})
                elif fallow:
                    self.works[(x, m, z)] = ("coarse_dirt" if h3(x, 2, z, 5) < 0.5 else "grass_block", {})
                    if h3(x, 3, z, 6) < 0.05: self.works[(x, m + 1, z)] = ("hay_block", {"axis": "y"})
                else:
                    self.works[(x, m, z)] = ("farmland", {"raw": {"moisturized_amount": 7}})
                    gv = gr[0] + int(h3(x, 4, z, 7) * (gr[1] - gr[0] + 1))
                    self.works[(x, m + 1, z)] = (crop, {"raw": {"growth": min(7, gv)}})
                self.G[i, j] = m; self.FIX[i, j] = True; self.FIELD[i, j] = True; self.TAKEN[i, j] = 3
        return 1

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
        for i, j in np.argwhere(self.K >= 0):
            x, z = int(i) + self.X0, int(j) + self.Z0
            k = int(self.K[i, j]); kind = {4: "square", 3: "main", 2: "lane", 1: "walk"}[int(self.KIND[i, j])]
            y = (k - 1) // 2; slab = k % 2 == 1
            g0 = int(self.G0[i, j])
            if self.WET[i, j]:                                   # a deck over the water on stone piers every few blocks
                self.works[(x, y, z)] = ("stone_brick_slab", {"half": "bottom"}) if slab else ("stone_bricks", {})
                if (x + z) % 4 == 0:
                    for yy in range(g0, y): self.works[(x, yy, z)] = ("stone_bricks", {})
                continue
            if kind == "square":
                r = math.hypot(x - self.sq[0], z - self.sq[1])
                if abs(r - self.sqR + 0.5) < 0.8: blk = ("polished_andesite_slab", {"half": "bottom"}) if slab else ("polished_andesite", {})
                elif x == self.sq[0] or z == self.sq[1]: blk = ("stone_brick_slab", {"half": "bottom"}) if slab else ("stone_bricks", {})
                else: blk = pave("square", x, z, slab)
            else: blk = pave(kind, x, z, slab)
            self.works[(x, y, z)] = blk
            for yy in range(g0 + 1, y): self.works[(x, yy, z)] = ("cobblestone" if yy == y - 1 else "dirt", {})
            for yy in range(y + 1, max(g0, y) + 3): self.works.setdefault((x, yy, z), ("air", {}))
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
        self.streets(); self.relax(); self.grade_verges()
        self.place_square_buildings()
        self.houses(); self.relax()
        self.windmills()
        self.fields()
        self.dress()
        self.roof_colours()
        self.path_blocks(); self.ground_blocks(); self.banks()
        self.works = {(int(x), int(y), int(z)): v for (x, y, z), v in self.works.items()}
        for e in self.plan:
            for k in ('x', 'z', 'ground_y', 'rotation', 'footprint'): e[k] = int(e[k])
        c = collections.Counter(p["kind"] for p in self.plan)
        print(self.name, dict(c), "roofs", getattr(self, "roof_counts", {}), "fields", self.nparcel, "streets", collections.Counter(r["kind"] for r in self.roads), "groundwork", len(self.works))

    # =========================================================================== output
    def write(self, out):
        os.makedirs(os.path.join(out, "stamps"), exist_ok=True)
        for name, bp in self.designs.items(): bp.save_json(os.path.join(out, "stamps", name + ".json"))
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

    def scene(self, out):
        s = Blueprint(f"{self.key}_scene"); R = self.R + 5
        for x in range(self.C[0] - R, self.C[0] + R + 1):
            for z in range(self.C[1] - R, self.C[1] + R + 1):
                if (x - self.C[0]) ** 2 + (z - self.C[1]) ** 2 > R * R or not self.ok(x, z): continue
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
        for e in self.plan:
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
        else: street = [-140, 20, 55, cx + 18, y + 2, cz + 10]
        s.camera = {"views": {"town": [-35, 38, self.R * 2.3, self.C[0], y, self.C[1]], "aerial": [10, 72, self.R * 2.7, self.C[0], y, self.C[1]],
                              "square": [25, 30, 48 if not self.big else 62, cx, y + 2, cz], "street": street}}
        s.save_logical(os.path.join(out, "scene.json"))
        return len(s.cells)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("site"); ap.add_argument("slice"); ap.add_argument("lines"); ap.add_argument("out")
    ap.add_argument("--seed", type=int, default=None); ap.add_argument("--render", action="store_true")
    ap.add_argument("--textures", default=""); ap.add_argument("--three", default=""); ap.add_argument("--shots", default="town,square,street")
    a = ap.parse_args()
    if a.site in SITES: site = dict(SITES[a.site]); name = a.site
    else:
        x, z, r, size = a.site.split(","); site = dict(centre=(int(x), int(z)), radius=int(r), size=size, fixed_square=False,
                                                     square_r=7 if size == "town" else 5, seed=5, civic=[]); name = f"Town {x} {z}"
    seed = a.seed if a.seed is not None else site.get("seed", 1)
    T = np.load(a.slice); L = json.load(open(a.lines))
    t = Town(name, site, T, L, seed); t.run()
    os.makedirs(a.out, exist_ok=True); t.write(a.out); t.picture(a.out)
    print("scene blocks", t.scene(a.out))
    if a.render:
        subprocess.run([sys.executable, os.path.join(HERE, "render", "render.py"), os.path.join(a.out, "scene.json"), a.out,
                        "--title", name, "--blurb", "Generated town on the real map ground.", "--textures", a.textures, "--three", a.three,
                        "--shots", a.shots], check=True)

if __name__ == "__main__":
    main()
