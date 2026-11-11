"""Procedural layouts for player settlements on the 12 map plots (settlement mode of towngen.py).

    python3 towngen_settle.py PLOT SLICE.npz LINES.json OUT_DIR [--variants 3] [--templates a,b,c]

PLOT is a name from Siege_Nights_BP/scripts/plots/config.js PLOT_PLAN (Harrowford, Wrenfield...).
SLICE.npz is terrain_slice.py of the square round the Plot Stone (161 wide, centred on it).

Same pipeline as the towns (paths first, half-sunk paths, land portions decided whole as build or
field, slope-aware floor heights and foundations, fields watered level by level), with the rules
a growing settlement adds (worked out with the building-placement thread, 2026-11-11):

  * The wall grows: Hamlet r32, Town r40, City r48, Castle r56 (outer face, blocks from the Plot
    Stone). The gate keeps its bearing. A slot may only open once the whole box is inside the wall
    with 2 blocks clear (radius <= wall - 3); a slot straddling an old wall line opens later.
  * Old wall lines at r32 and r48 can become ring roads (templates choose which, and which arc).
    The r40 and r56 lines just become build land once the wall moves past them.
  * The town hall grows too: the ground each hall level takes (drawHall(level) bounds, levels 1-5,
    from the Hall Cornerstone 5 ahead of the Plot Stone, plus 2 clear) is kept free of roads and
    slots for good up to level 4 (the Castle's hall); level 5's extra ground stays free of roads,
    fields and trees but may hold slots (tagged hall5), which the Sovereign hall takes back.
  * Slots are odd boxes (width along the door side x depth): Small 9x13, Medium 11x15 (long Medium
    13x15), Large 15x15, Great 21x21 (Large and Great may be 2 longer); each Hamlet has one long
    Medium or Large for the library (13 x 14),
    each with an absolute floor height, door side, walkway down to the road, tags and the tier
    that opens it. Fields are whole portions with no slots; they grow with the wall.
  * Minimum slots, cumulative: Hamlet 4 S 1 M; Town 7 S 3 M 1 L and a field; City 10 S 6 M 2 L;
    Castle 13 S 8 M 3 L (a Great is a bonus). A seed that misses them is thrown away and the next one tried.

Templates are data (TEMPLATES below): which ring arcs become roads, the radial streets, the shape
of the square, how much land is farmed. Everything else is read off the ground.

Writes OUT_DIR/<plot>.json (all variants; format in README.md "Settlement layouts") and a plan
picture per variant.
"""
import os, sys, json, math, random, argparse, collections, re
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from bp import Blueprint
import towngen as TG
from towngen import Town, ROT, PRIO, WIDTH
import dressing

TIERS = ["Hamlet", "Town", "City", "Castle"]
WALL_R = [32, 40, 48, 56]                       # wall ring (outer face) per tier
CLEAR = 3                                       # a slot's far corner stays this far inside the wall line
# (width along the door side, depth into the plot); the first shape is the size's plain box, the
# others its long variants. Grown to fit the region designs of PR #89 with a block to spare
# (placement thread 2026-11-11): S 9x13, M 11x15 (long M 13x15, also the Hamlet's library slot),
# L 15x15, G 21x21; Large and Great may be 2 longer either way.
SHAPES = {"S": [(9, 13)], "M": [(11, 15), (13, 15)], "L": [(15, 15), (17, 15), (15, 17)], "G": [(21, 21), (23, 21), (21, 23)]}
SIZES = {k: v[0][0] for k, v in SHAPES.items()}   # frontage of the plain box
SIZE_NAME = {"S": "Small", "M": "Medium", "L": "Large", "G": "Great"}
MINIMUM = [dict(S=4, M=1, L=0, G=0, field=0), dict(S=7, M=3, L=1, G=0, field=1),      # agreed with the placement
           dict(S=10, M=6, L=2, G=0, field=1), dict(S=13, M=8, L=3, G=0, field=1)]     # thread 2026-11-11; Great optional
HALL_AT = {"Hamlet": 1, "Town": 2, "City": 3, "Castle": 4}   # hall level per tier (5 = Sovereign, reserved anyway)
CORNERSTONE_AHEAD = 5
MASON = (6, -5)                                  # (right, ahead) of the Mason's Bench
SQUARE_AHEAD = -8                                # the well / Keep Banner square

# drawHall(level) bounds per architecture: x = right, z = ahead, from the Hall Cornerstone
# (node over townhall/halls.js, 2026-11-11). Re-measure if the halls change.
HALL_BOUNDS = {
    "vale":  [(-5, 5, 0, 14), (-7, 7, 0, 22), (-10, 10, -1, 25), (-15, 15, -2, 34), (-15, 15, -2, 40)],
    "frost": [(-5, 5, 0, 14), (-7, 7, 0, 22), (-8, 8, 0, 26), (-12, 12, -1, 34), (-12, 12, -1, 42)],
    "salt":  [(-4, 4, 1, 15), (-7, 12, 1, 23), (-8, 13, 1, 27), (-12, 15, -1, 35), (-12, 15, -1, 40)],
    "ember": [(-5, 5, 1, 13), (-9, 9, -2, 21), (-11, 11, -2, 28), (-15, 15, -3, 35), (-15, 15, -3, 40)],
    "fen":   [(-6, 6, 0, 12), (-13, 13, 0, 14), (-14, 14, 0, 23), (-17, 17, 0, 29), (-19, 19, 0, 32)],
}
ARCH = {"Aldmere Vale": "vale", "Frostmarch": "frost", "Saltreach": "salt", "Emberwaste": "ember", "Blackfen": "fen"}
HALL_CLEAR = 2

# ---- templates: angles are degrees from the gate direction (0 = toward the gate, 180 = behind
# the hall), radii are blocks from the Plot Stone. A radial starting at r <= 12 starts on the square.
TEMPLATES = {
    "crossroads": dict(label="Crossroads",
                       about="A cross street through the square out to the wall, a ring lane on the old Hamlet wall line round the front, side streets beyond it.",
                       rings=[(32, -75, 75)],
                       radials=[(90, 8, 54), (-90, 8, 54), (40, 8, 32), (-40, 8, 32), (40, 32, 54), (-40, 32, 54), (135, 32, 54), (-135, 32, 54)],
                       square="round", field_share=0.1),
    "twin_rings": dict(label="Twin Rings",
                       about="Both old wall lines (r32, r48) become ring lanes; streets from the square out to the first ring, staggered cross streets between the rings.",
                       rings=[(32, -175, 175), (48, -115, 115)],
                       radials=[(60, 8, 32), (-60, 8, 32), (120, 8, 32), (-120, 8, 32), (30, 32, 48), (-30, 32, 48), (95, 32, 48), (-95, 32, 48), (150, 32, 54), (-150, 32, 54)],
                       square="round", field_share=0.1),
    "market_street": dict(label="Market Street",
                          about="A long market runs from the square toward the gate; diagonal streets fan out from it to the outer ring.",
                          rings=[(48, -150, 150)],
                          radials=[(50, 8, 48), (-50, 8, 48), (115, 8, 54), (-115, 8, 54), (20, 20, 54), (-20, 20, 54), (85, 30, 48), (-85, 30, 48), (160, 40, 54), (-160, 40, 54)],
                          square="long", field_share=0.1),
}


def tier_of_radius(r, clear=CLEAR):
    for t, w in enumerate(WALL_R):
        if r <= w - clear: return t
    return None


def set_walls(walls):
    """Other wall rings: template radii move with the old wall lines (piecewise linear through the
    square's edge 8, each wall line, and the outer streets' end 2 inside the last wall)."""
    global WALL_R
    old = [0, 8] + WALL_R[:-1] + [WALL_R[-1] - 2]; new = [0, 8] + walls[:-1] + [walls[-1] - 2]
    f = lambda r: int(round(float(np.interp(r, old, new))))
    for t in TEMPLATES.values():
        t["rings"] = [(f(r), a0, a1) for r, a0, a1 in t["rings"]]
        t["radials"] = [(a, f(r0), f(r1)) for a, r0, r1 in t["radials"]]
    WALL_R = list(walls)


class Settlement(Town):
    def __init__(self, plot, template, T, L, seed):
        self.plot = plot; self.tpl = TEMPLATES[template]; self.template = template
        site = dict(centre=(plot["x"], plot["z"]), radius=WALL_R[-1] + 2, size="town", fixed_square=True, square_r=6, seed=seed, civic=[])
        super().__init__(plot["name"], site, T, L, seed)
        self.key = plot["name"].lower()
        b = math.radians(plot["gate"])
        self.g = (round(math.sin(b)), round(-math.cos(b)))          # toward the gate (bearings are cardinal)
        self.F = (-self.g[0], -self.g[1])                             # ahead: away from the gate
        self.Rt = (-self.F[1], self.F[0])                             # right, standing at the gate looking in
        self.h = (-self.g[1], self.g[0])
        self.LAND_R = WALL_R[-1] - CLEAR
        self.arch = ARCH.get(plot.get("region"), "vale")
        n0, n1 = self.G0.shape
        ii, jj = np.meshgrid(np.arange(n0) + self.X0, np.arange(n1) + self.Z0, indexing="ij")
        # column tier: inside which wall the column first lies
        self.GEO = np.full(self.G0.shape, 9, np.int8)
        for t in range(len(WALL_R) - 1, -1, -1): self.GEO[self.D <= WALL_R[t] - 1] = t
        self.slots = []; self.fixtures = []; self.RINGS = []

    # ---- frames
    def world(self, right, ahead): return (self.C[0] + right * self.Rt[0] + ahead * self.F[0], self.C[1] + right * self.Rt[1] + ahead * self.F[1])
    def polar(self, theta, r):
        a = math.radians(theta); dx = math.cos(a) * self.g[0] + math.sin(a) * self.h[0]; dz = math.cos(a) * self.g[1] + math.sin(a) * self.h[1]
        return self.C[0] + dx * r, self.C[1] + dz * r
    def rel(self, x, z): return int(x) - self.C[0], int(z) - self.C[1]

    def hall_boxes(self):
        """World boxes (x0, z0, x1, z1) of each hall level with its clearance."""
        out = []
        for lv, (x0, x1, z0, z1) in enumerate(HALL_BOUNDS[self.arch], 1):
            pts = [self.world(x, CORNERSTONE_AHEAD + z) for x in (x0 - HALL_CLEAR, x1 + HALL_CLEAR) for z in (z0 - HALL_CLEAR, z1 + HALL_CLEAR)]
            xs, zs = zip(*pts); out.append((lv, (min(xs), min(zs), max(xs), max(zs))))
        return out

    def reserve(self):
        self.halls = self.hall_boxes()
        _, (x0, z0, x1, z1) = self.halls[-1]
        self.HALL = np.zeros(self.G0.shape, bool)
        i0, j0 = self.ij(x0, z0); i1, j1 = self.ij(x1, z1)
        self.HALL[i0:i1 + 1, j0:j1 + 1] = True
        self.TAKEN[self.HALL] = 2
        _, (x0, z0, x1, z1) = self.halls[-2]                  # the Castle's hall (level 4) is kept for good; level 5's
        self.HALL4 = np.zeros(self.G0.shape, bool)             # extra ground stays clear of roads, fields and trees but
        i0, j0 = self.ij(x0, z0); i1, j1 = self.ij(x1, z1)     # may hold slots, taken back when the hall reaches level 5
        self.HALL4[i0:i1 + 1, j0:j1 + 1] = True
        for name, (r, a) in (("plot_stone", (0, 0)), ("mason_bench", MASON), ("hall_cornerstone", (0, CORNERSTONE_AHEAD))):
            x, z = self.world(r, a); self.fixtures.append({"name": name, "at": [x - self.C[0], z - self.C[1]], "tier": 0})

    # ---- paths
    def square(self):
        self.site["centre"] = self.world(0, SQUARE_AHEAD)
        super().square()
        self.site["centre"] = (self.plot["x"], self.plot["z"])
        k = 2 * self.sqY + 1
        cells = []
        # forecourt from the square to the hall's door
        for r in range(-5, 6):
            for a in range(SQUARE_AHEAD, CORNERSTONE_AHEAD - 1):
                cells.append(self.world(r, a))
        if self.tpl["square"] == "long":                 # the market: 9 wide, running toward the gate
            for r in range(-4, 5):
                for a in range(-30, SQUARE_AHEAD + 1): cells.append(self.world(r, a))
        for x, z in cells:
            i, j = self.ij(x, z)
            if self.HALL[i, j]: continue
            self.K[i, j] = k; self.KIND[i, j] = PRIO["square"]
        self.square_cells = np.argwhere(self.KIND == PRIO["square"])

    def streets(self):
        sqcells = [(int(i) + self.X0, int(j) + self.Z0) for i, j in self.square_cells]
        ring = [c for c in sqcells if any(self.at(self.KIND, c[0] + dx, c[1] + dz) == 0 for dx, dz in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
        # the main street: straight in through every gate the wall will ever have, then on to the square
        gx, gz = self.polar(0, self.R)
        inner = [self.polar(0, r) for r in range(self.R, WALL_R[0] - 3, -1)]
        path = self.astar((int(round(inner[-1][0])), int(round(inner[-1][1]))), ring, "main") or [(int(round(inner[-1][0])), int(round(inner[-1][1])))]
        cells = [(int(round(x)), int(round(z))) for x, z in inner] + path[1:]
        self.lay(cells, "main", k_end=self.k_at(*cells[-1]))
        self.main_rd = self.roads[-1]
        self.gates = [[*self.rel(*self.polar(0, w)), TIERS[t]] for t, w in enumerate(WALL_R)]
        # ring lanes on old wall lines
        for r, a0, a1 in self.tpl["rings"]:
            n = int(abs(a1 - a0) * math.pi / 180 * r)
            pts = [self.polar(a0 + (a1 - a0) * s / n, r) for s in range(n + 1)]
            arc = []
            for p in pts + [None]:
                bad = p is None or self.at(self.TAKEN, int(round(p[0])), int(round(p[1]))) >= 2
                if not bad: arc.append(p); continue
                if len(arc) > 6:
                    c0 = (int(round(arc[0][0])), int(round(arc[0][1]))); c1 = (int(round(arc[-1][0])), int(round(arc[-1][1])))
                    rd = self.lay(arc, "lane", k_start=self.k_at(*c0) if self.at(self.K, *c0) >= 0 else None,
                                  k_end=self.k_at(*c1) if self.at(self.K, *c1) >= 0 else None)
                    if rd: rd["ring"] = r; self.RINGS.append(rd)
                arc = []
        # radial streets
        for theta, r0, r1 in self.tpl["radials"]:
            end = self.polar(theta, r1); end = (int(round(end[0])), int(round(end[1])))
            if r0 <= 12:
                ring = [(int(i) + self.X0, int(j) + self.Z0) for i, j in np.argwhere(self.KIND == PRIO["square"])]
                start = min(ring, key=lambda c: math.hypot(c[0] - end[0], c[1] - end[1]))
            else:
                s = self.polar(theta, r0); start = (int(round(s[0])), int(round(s[1])))
            for c in (start, end):
                if self.at(self.TAKEN, *c) >= 2: break
            else:
                path = self.astar(end, [start], "lane", limit=900)
                if path and len(path) > 4:
                    path = path[::-1]
                    ks = self.k_at(*path[0]) if self.at(self.K, *path[0]) >= 0 else None
                    ke = self.k_at(*path[-1]) if self.at(self.K, *path[-1]) >= 0 else None
                    rd = self.lay(path, "lane", k_start=ks, k_end=ke)
                    if rd: rd["radial"] = theta

    def rid_map(self):
        """Road ids, for corner tags and ring tiers."""
        self.RID = np.full(self.G0.shape, -1, np.int16)
        for n, rd in enumerate(self.roads):
            r = WIDTH[rd["kind"]] / 2.0 + 0.5
            for x, z in rd["pts"]:
                for dx in range(-2, 3):
                    for dz in range(-2, 3):
                        cx, cz = int(round(x)) + dx, int(round(z)) + dz
                        if self.ok(cx, cz) and self.at(self.K, cx, cz) >= 0 and self.at(self.RID, cx, cz) < 0 and math.hypot(cx - x, cz - z) <= r:
                            self.RID[self.ij(cx, cz)] = n


    def subdivide(self, max_area=900, min_width=42):
        """Build portions too big to fill from their edges get a lane through the middle, across
        their long axis, from road to road (or to the wall). Repeats until none is too big."""
        tried = set()
        for _ in range(14):
            big = []
            for L, p in self.port.items():
                if p["kind"] != "build" or p["area"] <= max_area: continue
                cells = np.argwhere(self.PORT == L).astype(float)
                w, v = np.linalg.eigh(np.cov((cells - cells.mean(0)).T))
                if math.sqrt(12 * w[0]) < min_width: continue      # already narrow enough to fill from both edges
                key = tuple(np.round(cells.mean(0)).astype(int))
                if key in tried: continue
                big.append((p["area"], L))
            if not big: break
            done = False
            for area, L in sorted(big, reverse=True):
                m = self.PORT == L; cells = np.argwhere(m).astype(float)
                tried.add(tuple(np.round(cells.mean(0)).astype(int)))
                c = cells.mean(0); w, v = np.linalg.eigh(np.cov((cells - c).T))
                short = v[:, 0]                                   # cut along the short axis = across the long one
                ends = []
                for sgn in (1, -1):
                    q = None
                    for t in range(1, 60):
                        i, j = int(round(c[0] + sgn * short[0] * t)), int(round(c[1] + sgn * short[1] * t))
                        if not (0 <= i < m.shape[0] and 0 <= j < m.shape[1]): break
                        if self.K[i, j] >= 0: q = (i, j); break
                        if self.TAKEN[i, j] >= 2 or self.D[i, j] > self.LAND_R: q = (i - int(round(sgn * short[0])), j - int(round(sgn * short[1]))); break
                    if q is None: break
                    ends.append((q[0] + self.X0, q[1] + self.Z0))
                if len(ends) < 2 or math.hypot(ends[0][0] - ends[1][0], ends[0][1] - ends[1][1]) < 14: continue
                path = self.astar(ends[0], [ends[1]], "lane", limit=600)
                if not path or len(path) < 8: continue
                ks = self.k_at(*path[0]) if self.at(self.K, *path[0]) >= 0 else None
                ke = self.k_at(*path[-1]) if self.at(self.K, *path[-1]) >= 0 else None
                rd = self.lay(path, "lane", k_start=ks, k_end=ke)
                if rd: rd["infill"] = True; done = True; break
            old = self.PKIND.copy()
            self.relax()
            Town.portions(self)
            for L2, p in self.port.items():
                p["kind"] = "field" if (old[self.PORT == L2] == 2).mean() > 0.5 else "build"
            self.PKIND = np.zeros(self.G.shape, np.int8)
            for L2, p in self.port.items(): self.PKIND[self.PORT == L2] = 1 if p["kind"] == "build" else 2
            self.port_area = None
            if not done: break

    BACK = 10                    # a back footpath runs this far in from a deep portion's edge
    def back_paths(self):
        """Second rows (agreed with the placement thread): in a build portion deep enough to hold a
        row facing the street, a 1-wide footpath, a second row facing that, and still an open middle
        at least 5 blocks across, a footpath loops round inside the first row and is joined to the
        street. Shallower portions keep one row and an open middle."""
        need = self.BACK + 1 + SHAPES["S"][0][1] + 1 + 3
        for L, p in list(self.port.items()):
            if p["kind"] != "build": continue
            m = self.PORT == L
            d = np.zeros(m.shape, np.int16); cur = m.copy(); k = 0
            while cur.any():
                k += 1; d[cur] = k
                nxt = cur.copy()
                for sh in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)): nxt &= np.roll(cur, sh, (0, 1))
                cur = nxt
            if d.max() < need: continue
            ring = np.argwhere(m & (d == self.BACK) & (self.TAKEN < 2))
            if len(ring) < 20: continue
            c = ring.mean(0)
            order = sorted(ring.tolist(), key=lambda q: math.atan2(q[1] - c[1], q[0] - c[0]))
            segs = [[order[0]]]
            for q in order[1:]:
                if max(abs(q[0] - segs[-1][-1][0]), abs(q[1] - segs[-1][-1][1])) > 2: segs.append([q])
                else: segs[-1].append(q)
            if len(segs) > 1 and max(abs(segs[0][0][0] - segs[-1][-1][0]), abs(segs[0][0][1] - segs[-1][-1][1])) <= 2:
                segs[0] = segs.pop() + segs[0]
            for sg in segs:
                if len(sg) < 12: continue
                loop = len(segs) == 1
                pts = [(a + self.X0, b + self.Z0) for a, b in sg] + ([(sg[0][0] + self.X0, sg[0][1] + self.Z0)] if loop else [])
                rd = self.lay(pts, "walk")
                if not rd: continue
                rd["back"] = True
                for a in (pts[len(pts) // 4], pts[3 * len(pts) // 4]) if loop else (pts[len(pts) // 2],):
                    q = self.nearest_street(*a)
                    if q: self.footpath(a, q)
        self.relax()

    def road_tiers(self):
        """The tier each path cell opens: the approach through the gates is there from the start,
        a ring lane opens once the wall has moved off its line, anything else once it is inside the wall."""
        OT = self.GEO.copy()
        for i, j in np.argwhere(self.K >= 0):
            x, z = int(i) + self.X0, int(j) + self.Z0
            dx, dz = x - self.C[0], z - self.C[1]
            along = dx * self.g[0] + dz * self.g[1]; across = abs(dx * self.h[0] + dz * self.h[1])
            t = int(self.GEO[i, j])
            if self.KIND[i, j] == PRIO["main"] and along > 0 and across <= 3: t = 0
            rid = int(self.RID[i, j])
            if rid >= 0 and "ring" in self.roads[rid]: t = max(t, WALL_R.index(self.roads[rid]["ring"]) + 1)
            OT[i, j] = min(t, 3)
        self.OT = OT

    # ---- portions: fields are whole outer portions
    def portions(self):
        super().portions()
        hall_near = self._dilate(self.HALL, 4)
        land = sum(p["area"] for p in self.port.values())
        for p in self.port.values(): p["kind"] = "build"
        cand = []; spare = []
        for L, p in self.port.items():
            m = self.PORT == L
            if p["area"] >= 200 and (m & (self.D <= WALL_R[0] - CLEAR)).sum() <= 0.25 * p["area"]:
                spare.append((int((m & (self.D <= WALL_R[1] - CLEAR)).sum()) - 4 * int((m & hall_near).sum()), p["area"], L))
            if p["area"] < 220 or (m & hall_near).any(): continue
            if (m & (self.D <= WALL_R[0] - CLEAR)).sum() > 0.25 * p["area"]: continue   # Hamlet ground is for building
            g = self.G[m]
            if np.percentile(g, 95) - np.percentile(g, 5) > 10: continue
            core = m.copy()
            for _ in range(3): core = core & np.roll(core, 1, 0) & np.roll(core, -1, 0) & np.roll(core, 1, 1) & np.roll(core, -1, 1)
            if core.sum() < 0.25 * p["area"]: continue           # a thin strip: no field (it stays build land)
            town = int((m & (self.D <= WALL_R[1] - CLEAR)).sum())
            cand.append((town, p["area"], L))
        cand.sort(key=lambda t: (-(t[0] >= 80), -t[1] * (0.6 + 0.8 * self.rng.random())))
        got = 0
        for town, area, L in cand:
            if got >= self.tpl["field_share"] * land: break
            self.port[L]["kind"] = "field"; got += area
        if not got and spare:                                   # every layout gets a field (the Farmhouse needs one)
            L = min(spare, key=lambda t: abs(t[1] - self.tpl["field_share"] * land) - 2 * min(t[0], 120))[2]
            self.port[L]["kind"] = "field"
        self.PKIND = np.zeros(self.G.shape, np.int8)
        for L, p in self.port.items(): self.PKIND[self.PORT == L] = 1 if p["kind"] == "build" else 2

    # ---- slots
    def slot_bp(self, w, d):
        bp = Blueprint(f"slot_{w}x{d}")
        for x in range(w):
            for z in range(d): bp.set(x, 0, z, "keep_floor")
        bp.markers["door"] = (w // 2, 1, d); bp.kind = "slot"
        return bp

    def candidates(self):
        out = []
        for n, rd in enumerate(self.roads):
            pts = rd["pts"]; hw = WIDTH[rd["kind"]] / 2.0
            for t in range(3, len(pts) - 3):
                x, z = pts[t]; (x0, z0), (x1, z1) = pts[t - 3], pts[t + 3]
                tx, tz = x1 - x0, z1 - z0; d = math.hypot(tx, tz) or 1; tx, tz = tx / d, tz / d
                for side in (1, -1):
                    nx, nz = -tz * side, tx * side
                    deg = TG.snap_rot(-nx, -nz)
                    for sb in (1, 2, 3, 4):
                        door = (int(round(x + nx * (hw + 0.5 + sb))), int(round(z + nz * (hw + 0.5 + sb))))
                        out.append((door, deg, n))
        # the square's edge, facing in
        for a in np.linspace(0, 2 * math.pi, 90, endpoint=False):
            x, z = self.sq[0] + math.cos(a) * (self.sqR + 2.2), self.sq[1] + math.sin(a) * (self.sqR + 2.2)
            out.append(((int(round(x)), int(round(z))), TG.snap_rot(self.sq[0] - x, self.sq[1] - z), -1))
        return out

    def box_tier(self, G):
        dmax = max(math.hypot(x - self.C[0] + (0.5 if x >= self.C[0] else -0.5), z - self.C[1] + (0.5 if z >= self.C[1] else -0.5)) for x, z in G)
        return tier_of_radius(dmax)

    def try_slot(self, size, cand, max_tier=3, long_only=False, square_only=False):
        door, deg, rid = cand
        plain = SHAPES[size][0]
        shapes = SHAPES[size][:]; self.rng.shuffle(shapes)
        if long_only: shapes = [q for q in shapes if q != plain]
        if square_only: shapes = [plain]
        for w, d in shapes:
            bp = self.slot_bp(w, d)
            dx, dz = self.door_of(bp); rdx, rdz = TG.rot_xz(dx, dz, deg)
            ox, oz = door[0] - rdx, door[1] - rdz
            g, _ = self.footprint(bp, deg); G = [(x + ox, z + oz) for x, z in g]
            t = self.box_tier(G)
            if t is None or t > max_tier: continue
            if any(not self.ok(x, z) or self.at(self.PKIND, x, z) == 2 for x, z in G): continue
            wk = self.walk_cells(door, ROT[deg])
            if wk is None: continue
            t = max(t, int(self.at(self.OT, *wk[1])))                # never before the road it opens onto
            if t > max_tier: continue
            nw = len(self.walks)
            e = self.try_place(bp, deg, door, "slot", gap=1 if self.rng.random() < 0.8 else 2, max_relief=5)
            if not e: continue
            e.update(size=size, geo=t, long=((w, d) != plain), dims=(w, d), cells=G, deg=deg, walk=self.walks[-1] if len(self.walks) > nw else None, rid=rid)
            self.slots.append(e)
            return e
        return None

    def town_field(self):
        """Every layout has a field by Town (the Farmhouse needs one): if no field portion has 80+
        crop cells inside the Town wall, a 9 x 9 field plot (one watered cell's reach) is set aside
        on level ground between the Hamlet and Town walls, by a road, before any slot is placed."""
        town = self.D <= WALL_R[1] - CLEAR
        if any(((self.PKIND == 2) & (self.PORT == L) & town & (self.K < 0)).sum() >= 100 for L in self.port if self.port[L]["kind"] == "field"):
            return
        free = (self.K < 0) & (self.TAKEN == 0) & ~self.WET & (self.PKIND == 1) & town
        road = self._dilate(self.K >= 0, 2)
        best = None
        for i, j in np.argwhere(free):
            win = (slice(i - 5, i + 6), slice(j - 5, j + 6))       # 11 x 11: neighbours' margins may take the outer ring
            if i < 5 or j < 5 or not free[win].all(): continue
            g = self.G[win]
            if g.max() - g.min() > 2: continue
            near = road[i - 6:i + 7, j - 6:j + 7].any()
            sc = (0 if near else 50) + 2 * max(0.0, WALL_R[1] - CLEAR - 6 - float(self.D[i, j])) + self.rng.random()   # as far out as fits: Hamlet ground is precious
            if best is None or sc < best[0]: best = (sc, i, j)
        if best is None: print("no room for a Town field"); return
        _, i, j = best; L = int(self.PORT.max()) + 1
        self.PORT[i - 5:i + 6, j - 5:j + 6] = L; self.PKIND[i - 5:i + 6, j - 5:j + 6] = 2
        self.port[L] = {"kind": "field", "area": 121, "u": 0, "plot": True}

    def place_slots(self):
        C = self.candidates()
        self.D53 = self.D > WALL_R[-1] - CLEAR
        self.TAKEN[self.HALL & ~self.HALL4 & (self.K < 0) & (self.TAKEN == 2)] = 0
        self.TAKEN[self.D53 & (self.TAKEN == 0)] = 1
        def big(max_tier, need):
            """Large slots for the market (Town) and barracks (City); a long Medium where no Large fits."""
            have = sum(1 for e in self.slots if e["geo"] <= max_tier and (e["size"] == "L" or (e["size"] == "M" and e.get("long"))))
            if have >= need: return
            have += pass_("L", max_tier, need - have, near_sq)
            if have < need: pass_long(max_tier, need - have)
        def pass_long(max_tier, count, prefer=None):
            cs = C[:]; self.rng.shuffle(cs); cs.sort(key=prefer or near_sq); got = 0
            for c in cs:
                if got >= count: break
                e = self.try_slot("M", c, max_tier, long_only=True)
                if e: got += 1; e["library"] = max_tier == 0
            return got
        def pass_(size, max_tier, count, prefer=None):
            cs = C[:]; self.rng.shuffle(cs)
            if prefer: cs.sort(key=prefer)
            got = 0
            for c in cs:
                if got >= count: break
                if self.try_slot(size, c, max_tier): got += 1
            return got
        far = lambda c: -math.hypot(c[0][0] - self.C[0], c[0][1] - self.C[1]) + 6 * self.rng.random()
        near_sq = lambda c: math.hypot(c[0][0] - self.sq[0], c[0][1] - self.sq[1]) + 4 * self.rng.random()
        hamlet = lambda c: math.hypot(c[0][0] - self.sq[0], c[0][1] - self.sq[1]) + 3 * self.rng.random()
        # inner tiers first (their ground is smallest), biggest boxes first within each
        if not pass_long(0, 1, hamlet):                # Hamlet first: its ground is the smallest; its Medium is
            pass_("M", 0, 1, hamlet)                   # a long one (13 x 15) for the library where it fits
        big(1, 2)                                      # then the Town charter: the market's slot (the library counts
        pass_("M", 1, 1, near_sq)                      # as one big), a Medium, then Smalls
        pass_("S", 1, 3, hamlet)
        pass_("M", 2, 1, near_sq)                      # City: one more Medium, three more Smalls
        pass_("S", 2, 3, near_sq)
        pass_("S", 0, 2, hamlet); pass_("S", 1, 2, near_sq)
        big(2, 3)
        pass_("M", 2, 2, near_sq)
        pass_("G", 3, 1, far)
        pass_("L", 3, 2, far)
        pass_("M", 3, 3 + self.rng.randint(0, 2))
        # then rows of Smalls (and the odd Medium) along every road, leaving the middles of portions free
        for n, rd in enumerate(self.roads):
            pts = rd["pts"]; hw = WIDTH[rd["kind"]] / 2.0
            for side in (1, -1):
                t = 3
                while t < len(pts) - 3:
                    x, z = pts[t]; (x0, z0), (x1, z1) = pts[t - 3], pts[t + 3]
                    tx, tz = x1 - x0, z1 - z0; d = math.hypot(tx, tz) or 1; tx, tz = tx / d, tz / d
                    nx, nz = -tz * side, tx * side; deg = TG.snap_rot(-nx, -nz)
                    e = None
                    for sb in (1, 2, 3, 4):
                        door = (int(round(x + nx * (hw + 0.5 + sb))), int(round(z + nz * (hw + 0.5 + sb))))
                        e = self.try_slot("M" if self.rng.random() < 0.3 else "S", (door, deg, n)) or self.try_slot("S", (door, deg, n))
                        if e: break
                    t += (e["dims"][0] + 1) if e else 1
        self.relax()

    def balance(self):
        """opensAt: never before the box is inside the wall; within that, each size class is spread
        over the tiers in proportion to the minimums, inner slots first, so every tier adds slots."""
        for s in "SMLG":
            sl = sorted([e for e in self.slots if e["size"] == s], key=lambda e: (e["geo"], math.hypot(e["x"] - self.C[0], e["z"] - self.C[1])))
            N = len(sl); cum = [MINIMUM[t][s] for t in range(4)]
            if not N: continue
            last = cum[-1] or 1
            tgt = [max(cum[t], int(round(N * cum[t] / last))) if cum[-1] else N for t in range(4)]
            for k, e in enumerate(sl):
                t_k = next((t for t in range(4) if k < tgt[t]), 3)
                e["opensAt"] = max(e["geo"], t_k)
            if s == "G":
                for e in sl: e["opensAt"] = 3
        # the market (Town) and barracks (City) slots: the first big slots (Large, or a long Medium)
        # open as early as their ground allows, never deferred
        bigs = sorted([e for e in self.slots if e["geo"] >= 1 and (e["size"] == "L" or (e["size"] == "M" and e.get("long")))], key=lambda e: e["geo"])
        for e in bigs[:2]: e["opensAt"] = max(e["geo"], 1)
        for e in self.slots:
            if e.get("library"): e["opensAt"] = e["geo"]          # the Hamlet's library slot opens with the Hamlet
        self.slots.sort(key=lambda e: (e["opensAt"], "GLMS".index(e["size"])))

    def counts(self):
        out = []
        for t in range(4):
            c = {s: sum(1 for e in self.slots if e["size"] == s and e["opensAt"] <= t) for s in "SMLG"}
            c["M_long"] = sum(1 for e in self.slots if e["size"] == "M" and e.get("long") and e["opensAt"] <= t)
            c["field"] = sum(1 for f in self.field_out if f["area_by_tier"][t] >= 80)
            out.append(c)
        return out

    def charter(self):
        """The tier charters (placement thread, 2026-11-11), cumulative. Town: 3 S, 2 M (Farmhouse,
        Mint), a big slot for the market (Large or long Medium) and a field. City: 6 S, 4 Medium-or-
        bigger in all with at least 1 big (the barracks may take a plain Medium). Since the slot resize, also
        a Hamlet slot for the library (a long Medium or a Large). Returns (passes, shortfall)."""
        c = {t: self.counts()[n] for n, t in enumerate(TIERS)}
        H, T, Ci = c["Hamlet"], c["Town"], c["City"]
        lib = min(1, H["L"] + H["M_long"])                 # the Hamlet's library slot (13 x 14 fits a long Medium)
        need = [(lib, 1),
                (T["S"], 3), (T["M"] + T["L"], 3), (T["L"] + T["M_long"] - lib, 1), (T["field"], 1),
                (Ci["S"], 6), (Ci["M"] + Ci["L"], 4), (Ci["L"] + Ci["M_long"], 1)]
        short = sum(max(0, b - a) for a, b in need)
        return short == 0, short

    def meets(self):
        """Minimums, where a Large may be stood in for by a long Medium (13 x 15: the market and the
        barracks may take one when no Large is free; placement thread 2026-11-11)."""
        cs = [dict(c, L=c["L"] + min(c["M_long"], max(0, c["M"] - 1))) for c in self.counts()]
        return all(cs[t][k] >= MINIMUM[t][k] for t in range(4) for k in MINIMUM[t]), cs

    # ---- fields grow with the wall
    def fields(self):
        """Crops on every block of each field portion, watered level by level as in towns. The crop
        area at each tier is the part of the portion inside that tier's wall (with 2 clear); each
        stage keeps the water already placed and adds only what its new crops need."""
        F0 = (self.PKIND == 2) & (self.D <= self.LAND_R) & (self.K < 0) & (self.TAKEN == 0) & ~self.WET & self.IN
        self.FIELD = F0
        Gt = np.where(self.K >= 0, (self.K - 1) // 2, self.G); H = self.G
        water = np.zeros(self.G.shape, bool); dry = np.zeros(self.G.shape, bool)
        STAGE = np.full(self.G.shape, -1, np.int8)
        crop_of = np.zeros(self.G.shape, np.int8)
        self.field_out = []; self.unwatered = 0; self.nwater = 0
        for L, p in self.port.items():
            if p["kind"] != "field": continue
            M = F0 & (self.PORT == L)
            if not M.any(): continue
            cells = np.argwhere(M)
            k = max(1, len(cells) // 260); seeds = cells[[self.rng.randrange(len(cells)) for _ in range(k)]]
            picks = [self.rng.choices(range(len(TG.CROPS)), [c[1] for c in TG.CROPS])[0] for _ in range(k)]
            dd = np.stack([np.hypot(cells[:, 0] - s[0], cells[:, 1] - s[1]) for s in seeds]); near = dd.argmin(0)
            for (i, j), q in zip(cells, near): crop_of[i, j] = picks[q]
            prev = np.zeros(M.shape, bool); first = None
            for t in range(4):
                Mt = M & (self.D <= WALL_R[t] - CLEAR)
                new = Mt & ~prev
                if not new.any(): continue
                if first is None: first = t
                STAGE[new] = t
                for h in np.unique(H[new]):
                    S = new & (H == h)
                    cand = S.copy()
                    for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)): cand &= np.roll(Gt, (-di, -dj), (0, 1)) >= h
                    cov = np.zeros(S.shape, bool)
                    for a, b in np.argwhere(water & (H == h) & M): cov[max(0, a - 4):a + 5, max(0, b - 4):b + 5] = True
                    def put(a, b):
                        water[a, b] = True; cov[max(0, a - 4):a + 5, max(0, b - 4):b + 5] = True
                    ox, oz = self.rng.randrange(9), self.rng.randrange(9)
                    for a, b in np.argwhere(cand):
                        if (a + ox) % 9 == 4 and (b + oz) % 9 == 4 and not cov[a, b]: put(a, b)
                    for _ in range(3000):
                        left = S & ~cov & ~water
                        if not left.any(): break
                        li, lj = np.nonzero(left); ci_, cj_ = np.nonzero(cand & ~water)
                        best, bc = None, 0
                        for a, b in zip(ci_, cj_):
                            if abs(a - li[0]) > 4 or abs(b - lj[0]) > 4: continue
                            c = int(left[max(0, a - 4):a + 5, max(0, b - 4):b + 5].sum())
                            if c > bc: best, bc = (a, b), c
                        if best is None: dry[li[0], lj[0]] = True; cov[li[0], lj[0]] = True; self.unwatered += 1; continue
                        put(*best)
                prev = Mt
            if first is None: continue
            ci = cells.mean(0)
            self.field_out.append({"id": f"field_{len(self.field_out) + 1}", "opensAt": first, "area": int(M.sum()),
                                   "area_by_tier": [int((M & (STAGE >= 0) & (STAGE <= t)).sum()) for t in range(4)],
                                   "centre": [int(ci[0]) + self.X0 - self.C[0], int(ci[1]) + self.Z0 - self.C[1]], "_L": L})
        for i, j in np.argwhere(F0 & (STAGE >= 0)):
            x, z = int(i) + self.X0, int(j) + self.Z0; g = int(self.G[i, j])
            self.TAKEN[i, j] = 3; self.OT[i, j] = max(int(self.OT[i, j]), int(STAGE[i, j]))
            if water[i, j]: self.works[(x, g, z)] = ("water", {}); self.nwater += 1; continue
            if dry[i, j]: self.works[(x, g, z)] = ("grass_block", {}); continue
            c, w, gr = TG.CROPS[int(crop_of[i, j])]
            self.works[(x, g, z)] = ("farmland", {"raw": {"moisturized_amount": 7}})
            self.works[(x, g + 1, z)] = (c, {"raw": {"growth": 7}})
        self.nparcel = len(self.field_out)

    def windmills(self):
        super().windmills()
        # a windmill is a fixture of its field, not a slot
        for e in [e for e in self.plan if e["kind"] == "windmill"]:
            self.fixtures.append({"name": "windmill", "stamp": e["stamp"], "at": [e["x"] - self.C[0], e["z"] - self.C[1]], "ground_y": e["ground_y"], "rotation": e["rotation"], "tier": None})

    # ---- trees (agreed with the placement thread and Mateo, 2026-11-11)
    # Species ids are map/trees/species.py cards; stamps are build_trees.py's "<id>/<id>_<size>_<n>".
    TREES = {   # region arch -> role -> species
        "vale":  {"avenue": ["vale_ash", "vale_great_oak"], "clump": ["vale_great_oak", "vale_silver_birch", "vale_ash"], "water": ["vale_weeping_willow"], "edge": ["vale_hawthorn", "vale_apple"]},
        "frost": {"avenue": ["frost_tall_spruce"], "clump": ["frost_tall_spruce", "frost_scots_pine", "frost_snow_birch"], "water": ["frost_snow_birch"], "edge": ["frost_juniper"]},
        "salt":  {"avenue": ["salt_italian_cypress"], "clump": ["salt_umbrella_pine", "salt_olive", "salt_sea_cypress"], "water": ["salt_tamarisk"], "edge": ["salt_olive"]},
        "fen":   {"avenue": ["fen_black_alder"], "clump": ["fen_black_alder", "fen_pollard_willow"], "water": ["fen_bald_cypress"], "edge": ["fen_pollard_willow"]},
        "ember": {"avenue": ["ember_date_palm"], "clump": ["ember_umbrella_acacia", "ember_argan"], "water": ["ember_date_palm"], "edge": ["ember_argan"]},
    }
    CROWN = [("ancient", 11), ("mature", 7), ("young", 4), ("sapling", 2)]    # crown radius each size needs clear
    TREE_VARIANTS = 4

    tree_index = None            # trees.json from map/trees/build_trees.py (PR #94); None = built-in sizes

    def trees_db(self, never, rd1, nearw):
        """The tree database placer (map/trees/place.py scatter): crowns clear of anything built (hard),
        trunks off roads, fields and fixtures (soft), one call per role with the rest of the ground
        made soft so only that role's zone gets trunks."""
        if self.tree_src and self.tree_src not in sys.path: sys.path.insert(0, self.tree_src)
        import place as TP
        idx = self.tree_index; tab = self.TREES.get(self.arch, self.TREES["vale"])
        hard = never.copy()
        base_soft = (self.K >= 0) | (self.TAKEN == 3) | (self.TAKEN == 4) | (self.TAKEN == 1) | self.WET
        crop = self.TAKEN == 3
        av = np.zeros(self.G0.shape, bool)
        m = self.KIND == PRIO["main"]
        av = self._dilate(m, 4) & ~self._dilate(m, 1)
        zones = {"avenue": (av, 0.0004), "water": (nearw, 0.0004), "edge": (self._dilate(crop, 2) & ~crop, 0.0005),
                 "clump": (self.PKIND == 1, 0.0007)}
        for role, (zone, dens) in zones.items():
            sp = {k: 1.0 for k in tab[role] if k in idx["species"]}
            if not sp or not zone.any(): continue
            soft = base_soft | ~zone
            for i, j, f, prof in TP.scatter(idx, sp, hard, soft, density=dens, seed=self.seed * 7 + len(role), tries=30000):
                x, z = int(i) + self.X0, int(j) + self.Z0
                tt = tier_of_radius(float(self.D[i, j]) + prof["crown_r"] + 1)
                if tt is None: continue
                c = max(1, prof["crown_r"] - 2); hard[max(0, i - c):i + c + 1, max(0, j - c):j + c + 1] = True
                base_soft[max(0, i - 1):i + 2, max(0, j - 1):j + 2] = True
                sid, size = f.split("/")[0], f.split("/")[1].split("_")[-2]
                self.fixtures.append({"name": "tree", "role": role, "species": sid, "size": size, "stamp": f, "crown_r": prof["crown_r"],
                                      "at": [x - self.C[0], z - self.C[1]], "ground_y": int(self.G[i, j]), "rotation": 0, "tier": tt})
                self.TAKEN[i, j] = 4

    def trees(self, fixed=()):
        """Trees only where no slot at any tier, no walkway, road, wall line (+2) or hall level will
        ever be: world trees are unbreakable, so they must never block a later plot. Size is picked
        by the clear radius round the trunk. An avenue along the main street, small clumps in the
        open middles of build portions, water trees by water, hedge trees on field edges.
        `fixed` = existing (ancient) map trees as (x, z, radius): kept, and nothing grows over them."""
        never = self.HALL | (self.TAKEN == 2) | self.EAVES | self.D53     # a crown inside the wall line of its tier also clears every later wall
        road = self.K >= 0
        # clear radius (chebyshev-ish, by dilation) from anything a tree may not overhang
        far = np.full(self.G0.shape, 99, np.int16); cur = never.copy()
        for r in range(0, 13):
            far[cur & (far == 99)] = r
            cur = self._dilate(cur, 1)
        rd1 = self._dilate(road, 1)
        if self.tree_index is not None:
            for x, z, r in fixed:
                i, j = self.ij(x, z); never[max(0, i - r):i + r + 1, max(0, j - r):j + r + 1] = True
            return self.trees_db(never, rd1, self._dilate(self.WET, 3) & ~self.WET)
        trunk_ok = ~never & ~road & (self.TAKEN == 0) & ~self.WET & (self.D <= self.LAND_R)
        taken = np.zeros(self.G0.shape, bool)
        tab = self.TREES.get(self.arch, self.TREES["vale"])
        def put(x, z, role, max_size=None):
            if not self.ok(x, z): return False
            i, j = self.ij(x, z)
            if not trunk_ok[i, j] or taken[i, j] or (role != "avenue" and rd1[i, j]): return False
            r = int(far[i, j]) - 1
            sizes = [c for c in self.CROWN if c[1] <= r and (max_size is None or c[1] <= max_size)]
            if not sizes: return False
            size, cr = sizes[0]
            tt = tier_of_radius(float(self.D[i, j]) + cr)        # the whole crown inside the wall (with 2 clear) of its tier
            if tt is None:
                sizes = [c for c in sizes if tier_of_radius(float(self.D[i, j]) + c[1]) is not None]
                if not sizes: return False
                size, cr = sizes[0]; tt = tier_of_radius(float(self.D[i, j]) + cr)
            sp = self.rng.choice(tab[role]); v = self.rng.randrange(self.TREE_VARIANTS)
            self.fixtures.append({"name": "tree", "role": role, "species": sp, "size": size, "stamp": f"{sp}/{sp}_{size}_{v}",
                                  "at": [x - self.C[0], z - self.C[1]], "ground_y": int(self.G[i, j]), "rotation": 0, "tier": tt})
            k = max(2, cr // 2 + 1)
            taken[max(0, i - k):i + k + 1, max(0, j - k):j + k + 1] = True
            self.TAKEN[i, j] = 4
            return True
        for x, z, r in fixed:
            i, j = self.ij(x, z); taken[max(0, i - r):i + r + 1, max(0, j - r):j + r + 1] = True
        # avenue along the main street, alternating sides every 9 blocks
        rd = self.main_rd; hw = WIDTH["main"] / 2.0
        for t in range(4, len(rd["pts"]) - 2, 9):
            (x0, z0), (x1, z1) = rd["pts"][t - 1], rd["pts"][t + 1]; x, z = rd["pts"][t]
            d = math.hypot(x1 - x0, z1 - z0) or 1
            for s in (1, -1):
                for off in (1.5, 2.5, 3.5):
                    if put(int(round(x - (z1 - z0) / d * (hw + off) * s)), int(round(z + (x1 - x0) / d * (hw + off) * s)), "avenue", 7): break
        # water trees
        nearw = self._dilate(self.WET, 3) & ~self.WET
        for i, j in np.argwhere(nearw & trunk_ok)[::5]: put(int(i) + self.X0, int(j) + self.Z0, "water")
        # field edges: a hedge tree every few blocks along the edge of the crops
        crop = self.TAKEN == 3
        edge = self._dilate(crop, 2) & ~crop
        for n, (i, j) in enumerate(np.argwhere(edge & trunk_ok)):
            if n % 7 == 0: put(int(i) + self.X0, int(j) + self.Z0, "edge", 4)
        # clumps in the open middles of build portions
        mids = np.argwhere(trunk_ok & (self.PKIND == 1) & (far >= 5))
        self.rng.shuffle(mids := [tuple(m) for m in mids])
        clumps = 0
        for i, j in mids:
            if clumps >= 4 + int(self.LAND_R // 12): break
            if taken[i, j]: continue
            x, z = int(i) + self.X0, int(j) + self.Z0
            if not put(x, z, "clump"): continue
            clumps += 1
            for _ in range(self.rng.randint(1, 3)):
                a = self.rng.random() * 6.283; r = self.rng.uniform(3, 5)
                put(int(round(x + math.cos(a) * r)), int(round(z + math.sin(a) * r)), "clump", 4)

    def dress(self):
        mid = TG.TB.well(self.seed); self.stamp(mid, self.sq[0], self.sq[1], self.sqY, 0, "square")
        self.fixtures.append({"name": "well", "stamp": mid.name, "at": list(self.rel(*self.sq)), "ground_y": self.sqY, "rotation": 0, "tier": 0})
        lamp = dressing.lamp()
        for rd in self.roads:
            if rd["kind"] not in ("main", "lane"): continue
            hw = WIDTH[rd["kind"]] / 2.0 + 1
            for t in range(6, len(rd["pts"]) - 3, 15):
                x, z = rd["pts"][t]; (x0, z0), (x1, z1) = rd["pts"][t - 1], rd["pts"][t + 1]
                d = math.hypot(x1 - x0, z1 - z0) or 1; s = 1 if (t // 15) % 2 else -1
                lx, lz = int(round(x - (z1 - z0) / d * hw * s)), int(round(z + (x1 - x0) / d * hw * s))
                if not self.inside(lx, lz, 4): continue
                i, j = self.ij(lx, lz)
                if self.K[i, j] >= 0 or self.TAKEN[i, j] or self.WET[i, j] or self.HALL[i, j]: continue
                self.stamp(lamp, lx, lz, int(self.G[i, j]), 0, "lamp"); self.TAKEN[i, j] = 4
                self.fixtures.append({"name": "lamp", "stamp": lamp.name, "at": list(self.rel(lx, lz)), "ground_y": int(self.G[i, j]), "rotation": 0, "tier": int(self.OT[i, j])})

    # ---- tags
    def tag(self, e):
        G = e["cells"]; tags = []
        xs, zs = zip(*G); box = (min(xs), min(zs), max(xs), max(zs))
        def near(mask, r):
            i0, j0 = self.ij(box[0] - r, box[1] - r); i1, j1 = self.ij(box[2] + r, box[3] + r)
            i0, j0 = max(0, i0), max(0, j0)
            return bool(mask[i0:i1 + 1, j0:j1 + 1].any())
        end = None
        if e["walk"]:
            cells, ks, f = e["walk"]; last = cells[-1]; end = (last[0] + f[0], last[1] + f[1])
        else:
            end = (e["door"][0] + ROT[e["deg"]][0], e["door"][1] + ROT[e["deg"]][1])
        ek = int(self.at(self.KIND, *end)) if self.ok(*end) else 0
        if e.get("library"): tags.append("library")
        if near(self.HALL, 3): tags.append("hall")
        if e.get("foundation", 0) >= 4: tags.append("tall_foundation")
        if near(self.HALL & ~self.HALL4, 0): tags.append("hall5")
        if ek == PRIO["square"] or near(self.KIND == PRIO["square"], 2): tags.append("square")
        if ek == PRIO["main"]: tags.append("road_front")
        t = e["opensAt"]; w = WALL_R[t]
        dmax = max(math.hypot(x - self.C[0], z - self.C[1]) for x, z in G)
        if dmax >= w - CLEAR - 4: tags.append("wall")
        gx, gz = self.polar(0, w); cx, cz = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2
        if math.hypot(cx - gx, cz - gz) <= 16 + max(e["dims"]) / 2: tags.append("gate")
        if self.ok(*end):
            i, j = self.ij(*end); win = self.RID[max(0, i - 5):i + 6, max(0, j - 5):j + 6]
            if len(set(win[win >= 0].tolist())) >= 2: tags.append("corner")
        if near(self.PKIND == 2, 3) and near(self.TAKEN == 3, 3): tags.append("field_edge")
        if near(self.WET, 4): tags.append("water")
        return tags, box

    # ---- run
    def run(self):
        self.reserve()
        self.square()
        self.streets(); self.relax(); self.grade_verges()
        self.portions()
        self.subdivide(); self.back_paths(); self.grade_verges()
        self.rid_map(); self.road_tiers()
        self.town_field()
        self.place_slots()
        self.road_tiers()
        self.windmills()
        self.field_paths()
        self.road_tiers()
        self.fences()
        self.fields()
        self.balance()
        for e in self.slots:
            for x, z in e["cells"]: self.OT[self.ij(x, z)] = max(int(self.OT[self.ij(x, z)]), e["opensAt"])
            if e["walk"]:
                for x, z in e["walk"][0]: self.OT[self.ij(x, z)] = max(int(self.OT[self.ij(x, z)]), e["opensAt"])
        for f in self.fixtures:
            if f["name"] == "windmill":
                fo = next((q for q in self.field_out if self.at(self.PORT, f["at"][0] + self.C[0], f["at"][1] + self.C[1]) == q["_L"]), None)
                f["tier"] = fo["opensAt"] if fo else 3
                if fo: fo["windmill"] = f["at"]
        self.dress()
        self.trees()
        self.path_blocks(); self.ground_blocks(); self.banks()
        self.works = {(int(x), int(y), int(z)): v for (x, y, z), v in self.works.items()}

    def export(self):
        C = self.C
        def k2(k): return [(int(k) - 1) // 2, "slab" if int(k) % 2 else "full"]
        slots = []
        for n, e in enumerate(self.slots):
            tags, box = self.tag(e)
            f = ROT[e["deg"]]; side = {(0, 1): "s", (-1, 0): "w", (0, -1): "n", (1, 0): "e"}[f]
            walk = [[x - C[0], z - C[1], *k2(k)] for (x, z), k in zip(e["walk"][0], e["walk"][1])] if e["walk"] else []
            slots.append({"id": f"{e['size'].lower()}{n + 1}", "size": SIZE_NAME[e["size"]], "box": [box[0] - C[0], box[1] - C[1], box[2] - C[0], box[3] - C[1]],
                          "floor_y": int(e["ground_y"]), "door": {"side": side, "step": [e["door"][0] - C[0], e["door"][1] - C[1]], "walk": walk},
                          "tags": tags, "long": bool(e.get("long")), "foundation": int(e.get("foundation", 0)), "opensAt": TIERS[e["opensAt"]]})
        roads = []
        for i, j in np.argwhere(self.K >= 0):
            x, z = int(i) + self.X0, int(j) + self.Z0
            roads.append([x - C[0], z - C[1], *k2(self.K[i, j]), {4: "square", 3: "main", 2: "lane", 1: "walk"}[int(self.KIND[i, j])], int(self.OT[i, j])])
        pal, idx, rows = [], {}, []
        for (x, y, z), (nm, p) in sorted(self.works.items()):
            key = json.dumps([nm, p], sort_keys=True)
            if key not in idx: idx[key] = len(pal); pal.append([nm, p])
            t = int(self.OT[self.ij(x, z)]) if self.ok(x, z) else 3
            rows.append([x - C[0], y, z - C[1], idx[key], min(t, 3)])
        ok, _ = self.meets(); cs = self.counts()
        return {
            "template": self.template, "label": self.tpl["label"], "about": self.tpl["about"], "seed": self.seed, "meets_minimum": ok,
            "passes_charter": self.charter()[0],
            "counts_by_tier": {TIERS[t]: cs[t] for t in range(4)}, "meets_minimum_note": "a long Medium (13 x 15) may stand in for a Large",
            "square": {"centre": list(self.rel(*self.sq)), "y": int(self.sqY), "shape": self.tpl["square"]},
            "gates": self.gates,
            "hall": [{"level": lv, "box": [b[0] - C[0], b[1] - C[1], b[2] - C[0], b[3] - C[1]]} for lv, b in self.halls],
            "rings": [{"radius": rd["ring"], "opensAt": TIERS[WALL_R.index(rd["ring"]) + 1]} for rd in self.RINGS],
            "slots": slots,
            "fields": [{k: v for k, v in f.items() if k != "_L"} | {"opensAt": TIERS[f["opensAt"]]} for f in self.field_out],
            "fixtures": [dict(f, tier=TIERS[f["tier"]] if isinstance(f["tier"], int) else f["tier"]) for f in self.fixtures],
            "roads": roads,
            "groundwork": {"palette": pal, "blocks": rows},
        }

    def picture_settle(self, path):
        from PIL import Image, ImageDraw
        S = 5; R = self.R + 3; n = 2 * R + 1; x0, z0 = self.C[0] - R, self.C[1] - R
        img = Image.new("RGB", (n * S, n * S + 40), (32, 32, 32)); dr = ImageDraw.Draw(img)
        gmin, gmax = int(self.G[self.IN].min()), int(self.G[self.IN].max())
        TC = [(240, 236, 220), (200, 225, 245), (245, 215, 175), (225, 190, 235)]
        self.tree_at = {tuple(f["at"]) for f in self.fixtures if f["name"] == "tree"}
        owner = {}
        for e in self.slots:
            for c in e["cells"]: owner[c] = e
        for a in range(n):
            for b in range(n):
                x, z = x0 + a, z0 + b
                if not self.ok(x, z): continue
                i, j = self.ij(x, z)
                t = (self.G[i, j] - gmin) / max(1, gmax - gmin)
                col = (int(90 + 60 * t), int(135 + 55 * t), int(80 + 35 * t))
                if self.G[i, j] % 2: col = tuple(int(c * 0.94) for c in col)
                if self.HALL[i, j]: col = (110, 100, 120)
                if self.WET[i, j] and self.K[i, j] < 0: col = (70, 120, 200)
                if self.TAKEN[i, j] == 3: col = (214, 190, 90) if (x, int(self.G[i, j]), z) not in self.works or self.works[(x, int(self.G[i, j]), z)][0] != "water" else (60, 110, 210)
                if self.K[i, j] >= 0: col = {4: (175, 170, 160), 3: (150, 140, 125), 2: (170, 155, 130), 1: (190, 180, 160)}[int(self.KIND[i, j])]
                if (x, z) in owner: col = TC[owner[(x, z)]["opensAt"]]
                if (x - self.C[0], z - self.C[1]) in self.tree_at: col = (30, 80, 30)
                if self.D[i, j] > WALL_R[-1]: col = tuple(int(c * 0.5) for c in col)
                dr.rectangle([a * S, b * S, a * S + S - 1, b * S + S - 1], fill=col)
        cx, cz = (self.C[0] - x0) * S + S // 2, (self.C[1] - z0) * S + S // 2
        for t, w in enumerate(WALL_R):
            dr.ellipse([cx - w * S, cz - w * S, cx + w * S, cz + w * S], outline=(170, 50, 50) if t == 3 else (150, 90, 90), width=2)
        for lv, (bx0, bz0, bx1, bz1) in self.halls:
            dr.rectangle([(bx0 - x0) * S, (bz0 - z0) * S, (bx1 - x0 + 1) * S - 1, (bz1 - z0 + 1) * S - 1], outline=(60, 50, 80), width=1)
        for e in self.slots:
            xs, zs = zip(*e["cells"])
            dr.rectangle([(min(xs) - x0) * S, (min(zs) - z0) * S, (max(xs) - x0 + 1) * S - 1, (max(zs) - z0 + 1) * S - 1], outline=(60, 45, 30), width=1)
            dr.text((((min(xs) + max(xs)) / 2 - x0) * S - 3, ((min(zs) + max(zs)) / 2 - z0) * S - 6), e["size"], fill=(40, 30, 20))
        CR = dict(self.CROWN)
        for f in self.fixtures:
            if f["name"] != "tree": continue
            tx, tz = (f["at"][0] + self.C[0] - x0) * S + S // 2, (f["at"][1] + self.C[1] - z0) * S + S // 2; r = f.get("crown_r", CR.get(f["size"], 3)) * S
            dr.ellipse([tx - r, tz - r, tx + r, tz + r], outline=(25, 70, 25), width=2)
        y = n * S + 8; x = 8
        for t in range(4):
            dr.rectangle([x, y, x + 14, y + 14], fill=TC[t]); dr.text((x + 20, y + 2), TIERS[t], fill=(230, 230, 230)); x += 110
        dr.text((x, y + 2), f"{self.name}: {self.tpl['label']}  (gate {self.plot['gate']})", fill=(230, 230, 230))
        img.save(path)


def load_plots(config_js):
    src = open(config_js).read()
    block = src[src.index("PLOT_PLAN"):]; block = block[:block.index("];")]
    out = {}
    for m in re.finditer(r'name: "([^"]+)", region: "([^"]+)", x: (-?\d+), z: (-?\d+), gate: (\d+)', block):
        out[m.group(1)] = dict(name=m.group(1), region=m.group(2), x=int(m.group(3)), z=int(m.group(4)), gate=int(m.group(5)))
    return out


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("plot"); ap.add_argument("slice"); ap.add_argument("lines"); ap.add_argument("out")
    ap.add_argument("--config", default=os.path.join(HERE, "..", "..", "Siege_Nights_BP", "scripts", "plots", "config.js"))
    ap.add_argument("--templates", default=",".join(TEMPLATES)); ap.add_argument("--seed", type=int, default=1); ap.add_argument("--tries", type=int, default=8)
    ap.add_argument("--trees", default="", help="trees.json from map/trees/build_trees.py; uses map/trees/place.py to scatter them")
    ap.add_argument("--trees-src", default=os.path.join(HERE, "..", "trees"))
    ap.add_argument("--walls", default="", help="try other wall rings, e.g. 36,46,56,66: template radii are stretched to match")
    a = ap.parse_args()
    if a.walls: set_walls([int(v) for v in a.walls.split(",")])
    plot = load_plots(a.config)[a.plot]
    if a.trees:
        Settlement.tree_src = os.path.abspath(a.trees_src); Settlement.tree_index = json.load(open(a.trees))
    T = np.load(a.slice); L = json.load(open(a.lines))
    os.makedirs(a.out, exist_ok=True)
    variants = []
    for n, tpl in enumerate(a.templates.split(",")):
        best = None
        for k in range(a.tries):
            seed = a.seed * 1000 + n * 97 + k * 13 + sum(map(ord, plot["name"]))
            s = Settlement(plot, tpl, T, L, seed); s.run()
            ok, cs = s.meets(); passes, cshort = s.charter()
            short = sum(max(0, MINIMUM[t][q] - cs[t][q]) for t in range(4) for q in MINIMUM[t])
            print(plot["name"], tpl, seed, "charter" if passes else f"charter short {cshort}", "| minimum", "ok" if ok else f"short {short}", cs[-1], flush=True)
            if best is None or (cshort, short) < best[0]: best = ((cshort, short), s)
            if passes: break
        s = best[1]
        s.picture_settle(os.path.join(a.out, f"{s.key}-{tpl}.png"))
        variants.append(s.export())
    doc = {"format": "hollow-crown-settlement/1", "plot": plot, "tiers": TIERS, "wall_radius": WALL_R, "clear": CLEAR,
           "sizes": {SIZE_NAME[k]: SHAPES[k] for k in SHAPES}, "minimum": {TIERS[t]: MINIMUM[t] for t in range(4)},
           "about": "Coordinates are blocks from the Plot Stone on world axes (dx east, dz south); y is absolute. "
                    "box = [x0, z0, x1, z1] inclusive. roads rows = [dx, dz, y, slab|full, kind, tier index]. "
                    "groundwork rows = [dx, y, dz, palette index, tier index]: place a tier's rows when that tier opens (air = dig). "
                    "A slot's ground is levelled to floor_y by its groundwork; door.step is the cell outside the door, door.walk the path down to the road.",
           "variants": variants}
    with open(os.path.join(a.out, f"{plot['name'].lower()}.json"), "w") as f: json.dump(doc, f, separators=(",", ":"), default=int)
    print("wrote", os.path.join(a.out, f"{plot['name'].lower()}.json"))

if __name__ == "__main__":
    main()
