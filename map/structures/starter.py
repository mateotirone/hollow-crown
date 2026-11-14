"""The starter village: what a player's settlement looks like the moment they arrive on a plot (Hamlet).

    python3 starter.py PLOT SLICE.npz OUT.json [--config config.js]

PLOT is a name from Siege_Nights_BP/scripts/plots/config.js PLOT_PLAN. SLICE.npz is
terrain_slice.py of a square round the Plot Stone (201 wide, centred on it, is plenty).

Mateo's brief (2026-11-11, after the first map playtest): paths, clearly defined areas, a real
"starter village" feel, and a wall that follows the land instead of a circle. Rules kept here:

  * Paths come first: the square, the gate lane and the back lanes are laid and given smooth
    heights (half a block per block at most: slab, block, slab), then every plot and yard is
    levelled to the lane in front of it, then the rest of the ground is graded to them. Nothing
    is ever steeper than 1 block in 2.5 (no sheer cuts), and it eases out into the plot's land.
  * Paths are sunk half a block (a bottom slab), so you step up half a block off a path.
  * Every area has an edge you can see: fences, flush log borders, hedges, a paved square.
  * Build dimensions are odd.
  * The wall line is worked out from what it has to hold, a few slow lobes that are different
    for every plot, and the ground: it bends to keep off steep slopes and likes the brow of a
    rise. It runs straight across the gate.

The layout is written in (right, ahead) from the Plot Stone: ahead points away from the gate.
These numbers stay compatible with the town layouts (towngen_settle.py): Hall Cornerstone 5 ahead,
square 8 toward the gate, main street on the gate axis, everything inside the Hamlet wall.

Writes OUT.json (format "hollow-crown-starter/1", see the end of this file). The 3D preview
(studio/starter_preview) adds the hall, the buildings and the wall from the add-on's own code.
"""
import os, sys, json, math, re, argparse, hashlib
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------- the plan
# Boxes are (r0, r1, a0, a1) inclusive, in (right, ahead) blocks from the Plot Stone. All sizes odd.
SQUARE = (-6, 6, -13, -3)          # 13 x 11, corners cut
SQUARE_C = (0, -8)
FORECOURT = (-3, 3, -2, 2)         # 7 wide, square to the hall door
CORNERSTONE = (0, 5)
HALL1 = (-7, 7, 3, 21)             # ground the level-1 hall takes (any region), kept clear
AREAS = [
    # kind, label, box, door side (the side facing its lane: "r+" = toward +right ...), extra
    ("yard",      "Mason's yard",     (9, 19, -13, -3),  "r-", {}),
    # buildings give their door cell; the box comes from the design's real size (--sizes, from sizes.mjs)
    ("building",  "Library",          (-9, -8),           "r+", {"design": "library", "slot": (-23, -9, -14, -2)}),   # a long Medium, 13 x 15
    ("building",  "House",            (5, -23),           "r-", {"design": "house", "slot": (5, 19, -28, -18)}),
    ("building",  "House",            (-5, -23),          "r+", {"design": "house", "slot": (-19, -5, -28, -18)}),
    # Behind the square the town hall grows (HALL_REACH): everything back there stands outside the ground its
    # level-5 hall takes, so nothing is ever knocked down for it.
    # The open plot is a deep Large (15 wide x 17 deep): the Barracks needs it later (settlement thread, PR #276)
    ("slot",      "Empty plot",       (-38, -22, 1, 15),  "r+", {"size": "L"}),
    ("pen",       "Pen",              (-30, -22, 18, 26), "r+", {}),
    # the Works yard (27 along its lane x 17 deep): the Ironworks opens at Hamlet, so its plot is set up from day one
    # (Mateo 2026-11-14, settlement thread: "they should have their plots already done. Not done, but set up")
    ("slot",      "Works yard",       (21, 37, -1, 25),   "r-", {"size": "W"}),
    # the woodyard and the common field sit out front, past the library and the left house, off a walk from the main lane
    ("woodyard",  "Woodyard",         (-35, -25, -28, -18), "r+", {}),
    ("field",     "Common field",     (-37, -25, -14, -4),  "r+", {}),
    ("commons",   "Hall green",       (-6, 6, 23, 29),    "a-", {}),   # the hall's own green: the hall grows over it
    # the Storehouse's ground (15 x 15, door on its lane side): the game raises it on arrival and rebuilds it bigger
    # at every tier on the same ground (Storehouse thread, 2026-11-13); a walk runs to it beside the Mason's yard
    ("storehouse", "Storehouse",      (22, 36, -17, -3),  "r-", {}),
]
# lanes: (kind, width, [(r, a), ...]) starting at the square; the main lane runs out through the gate.
# The back lanes run either side of the hall's ground (r = +-19), so the hall never builds over them.
LANES = [
    ("lane", 3, [(-5, -4), (-9, 0), (-19, 0), (-19, 27)]),
    ("lane", 3, [(5, -4), (9, 0), (19, 0), (19, 27)]),
]
WALKS = [  # 1-wide paths from a lane or the square to a door or gate
    [(-7, -8), (-9, -8)], [(7, -8), (9, -8)], [(-20, 8), (-22, 8)], [(20, 12), (21, 12)], [(-3, -15), (-24, -15), (-24, -23), (-25, -23)], [(-24, -15), (-24, -9), (-25, -9)], [(-20, 22), (-22, 22)], [(20, -1), (20, -10), (22, -10)],
]
HALL_REACH = 21                    # the widest level-5 hall (Blackfen) with its 2 clear: r = -21 .. 21 behind the square
WALL_BASE = 36                     # the Hamlet wall ring (outer face). Rings 36/54/60/66 (Mateo 2026-11-13: the Town ring moved
                                   # out from 46 so the Town's plots fit round the village); each follows this outline
WALL_KEEP = 5                      # the wall stays this far outside anything in the plan
SLOPE = 0.4                        # graded ground: at most 1 block up per 2.5 across

# ---- materials (same tables as towngen.py so the settlement matches its town) ----
PAVE = {
    "main":   [("cobblestone", 34), ("mossy_cobblestone", 18), ("stone_brick", 18), ("andesite", 14), ("mossy_stone_brick", 8), ("tuff_brick", 8)],
    "lane":   [("cobblestone", 45), ("mossy_cobblestone", 30), ("andesite", 17), ("mud_brick", 8)],
    "walk":   [("stone_brick", 45), ("cobblestone", 30), ("mossy_stone_brick", 25)],
    "square": [("stone_brick", 40), ("polished_andesite", 25), ("andesite", 15), ("mossy_stone_brick", 10), ("cobblestone", 10)],
}
FULL = {"cobblestone": "cobblestone", "mossy_cobblestone": "mossy_cobblestone", "stone_brick": "stone_bricks", "mossy_stone_brick": "mossy_stone_bricks",
        "andesite": "andesite", "polished_andesite": "polished_andesite", "tuff_brick": "tuff_bricks", "mud_brick": "mud_bricks"}
REGION_WOOD = {"Aldmere Vale": "oak", "Frostmarch": "spruce", "Saltreach": "spruce", "Blackfen": "mangrove", "Emberwaste": "acacia"}
REGION_SURFACE = {"Aldmere Vale": "grass_block", "Frostmarch": "grass_block", "Saltreach": "grass_block", "Blackfen": "grass_block", "Emberwaste": "sand"}


def h3(x, y, z, s=0):
    h = (x * 374761393 + y * 668265263 + z * 2147483647 + s * 1274126177) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((h ^ (h >> 16)) & 0xFFFFFF) / 0x1000000


def pick(tab, x, z, salt):
    tot = sum(w for _, w in tab); r = h3(x, 7, z, salt) * tot
    for m, w in tab:
        r -= w
        if r < 0: return m
    return tab[-1][0]


def load_plots(path):
    src = open(path).read()
    out = {}
    for m in re.finditer(r'\{\s*name:\s*"([^"]+)",\s*region:\s*"([^"]+)",\s*x:\s*(-?\d+),\s*z:\s*(-?\d+),\s*gate:\s*(\d+)', src):
        out[m.group(1).lower()] = dict(name=m.group(1), region=m.group(2), x=int(m.group(3)), z=int(m.group(4)), gate=int(m.group(5)))
    return out


class Starter:
    def __init__(self, plot, T, sizes=None):
        self.plot = plot; self.sizes = sizes or {}
        self.region = plot["region"]; self.wood = REGION_WOOD.get(self.region, "oak")
        self.X0, self.Z0 = int(T["X0"]), int(T["Z0"])
        self.G = T["Y"].astype(np.int32)                       # top block y of the untouched ground, [x, z]
        self.WL = T["water"].astype(np.int32)
        self.n = self.G.shape[0]
        self.C = (plot["x"], plot["z"])
        b = math.radians(plot["gate"])
        self.g = (round(math.sin(b)), round(-math.cos(b)))      # toward the gate (bearings are cardinal)
        self.F = (-self.g[0], -self.g[1])                        # ahead
        self.Rt = (-self.F[1], self.F[0])                        # right, standing at the gate looking in
        xs = np.arange(self.n) + self.X0; zs = np.arange(self.n) + self.Z0
        self.WX, self.WZ = np.meshgrid(xs, zs, indexing="ij")
        dx = self.WX - self.C[0]; dz = self.WZ - self.C[1]
        self.R = dx * self.Rt[0] + dz * self.Rt[1]               # right of every column
        self.A = dx * self.F[0] + dz * self.F[1]                 # ahead of every column
        self.D = np.hypot(dx, dz)
        self.ANG = np.arctan2(dz, dx)                            # walldata.js angle (cos -> x, sin -> z)
        self.blocks = {}                                         # (x, y, z) -> (name, props)
        self.areas = []; self.fixtures = []; self.buildings = []
        self.KIND = np.zeros(self.G.shape, np.int8)              # 0 free, 1 walk, 2 lane, 3 main, 4 square, 5 area, 6 hall ground
        self.K = np.full(self.G.shape, -1, np.int32)             # path surface in half blocks (odd = bottom slab at (k-1)//2)
        self.LEVEL = np.full(self.G.shape, -999, np.int32)       # levelled top block of an area
        seed = int(hashlib.md5(plot["name"].encode()).hexdigest()[:8], 16)
        self.rng = np.random.default_rng(seed)

    # ---- frames
    def world(self, r, a): return (self.C[0] + r * self.Rt[0] + a * self.F[0], self.C[1] + r * self.Rt[1] + a * self.F[1])
    def ij(self, x, z): return x - self.X0, z - self.Z0
    def boxmask(self, box):
        r0, r1, a0, a1 = box
        return (self.R >= r0) & (self.R <= r1) & (self.A >= a0) & (self.A <= a1)
    def g_at(self, x, z):
        i, j = self.ij(x, z); return int(self.G[i, j])
    def put(self, x, y, z, name, props=None):
        self.blocks[(int(x), int(y), int(z))] = (name, props or {})

    # ---- 1. the square and the lanes, with their heights
    def smooth_ground(self):
        g = self.G.astype(np.float32)
        k = 3
        p = np.pad(g, k, mode="edge"); acc = np.zeros_like(g)
        for a in range(-k, k + 1):
            for b in range(-k, k + 1): acc += p[k + a:k + a + self.n, k + b:k + b + self.n]
        self.GS = acc / (2 * k + 1) ** 2

    def lay_square(self):
        sq = self.boxmask(SQUARE)
        cut = (np.abs(self.R - SQUARE_C[0]) + np.abs(self.A - SQUARE_C[1])) > 9      # corners cut: an octagon
        sq &= ~cut
        fc = self.boxmask(FORECOURT)
        both = sq | fc
        ys = int(round(float(np.median(self.G[both]))))
        self.sqY = ys
        self.K[both] = 2 * ys + 1; self.KIND[both] = 4
        self.square_mask = sq; self.fore_mask = fc

    def polyline_cells(self, pts, width):
        """Cells within width/2 of the polyline, each with its distance along the line."""
        best = np.full(self.G.shape, 1e9, np.float32); along = np.zeros(self.G.shape, np.float32)
        run = 0.0
        for (r0, a0), (r1, a1) in zip(pts, pts[1:]):
            vr, va = r1 - r0, a1 - a0; L = math.hypot(vr, va) or 1
            t = np.clip(((self.R - r0) * vr + (self.A - a0) * va) / (L * L), 0, 1)
            d = np.hypot(self.R - (r0 + t * vr), self.A - (a0 + t * va))
            m = d < best; best[m] = d[m]; along[m] = run + t[m] * L
            run += L
        return best <= width / 2 + 0.01, along, run

    def lay_lane(self, kind, width, pts, code):
        mask, along, run = self.polyline_cells(pts, width)
        mask &= self.KIND < code
        # profile: ground along the line, then at most half a block per block from the square outward
        n = int(math.ceil(run)) + 1
        samples = []
        for s in range(n):
            # point at distance s
            acc = 0.0; pt = pts[-1]
            for (r0, a0), (r1, a1) in zip(pts, pts[1:]):
                L = math.hypot(r1 - r0, a1 - a0)
                if acc + L >= s: f = (s - acc) / (L or 1); pt = (r0 + (r1 - r0) * f, a0 + (a1 - a0) * f); break
                acc += L
            x, z = self.world(round(pt[0]), round(pt[1])); i, j = self.ij(x, z)
            samples.append(2 * float(self.GS[i, j]) + 1)
        k = [2 * self.sqY + 1]
        for s in range(1, n):
            t = int(round(samples[s]))
            k.append(max(k[-1] - 1, min(k[-1] + 1, t)))
        k = np.asarray(k)
        idx = np.clip(np.round(along).astype(int), 0, n - 1)
        self.K[mask] = k[idx[mask]]; self.KIND[mask] = code
        return mask, k

    def lay_paths(self):
        self.lay_square()
        # the main lane: from the square straight out through the gate, on past the wall
        self.main_pts = [(0, SQUARE[2]), (0, -(WALL_BASE + 18))]
        self.main_mask, self.main_k = self.lay_lane("main", 5, self.main_pts, 3)
        self.lane_masks = []
        for kind, w, pts in LANES:
            m, _ = self.lay_lane(kind, w, pts, 2); self.lane_masks.append(m)
        for pts in WALKS:
            self.lay_lane("walk", 1, pts, 1)
        self.lay_aprons()

    def area_boxes(self):
        """(kind, box, door box, side) of every area: the ground it takes, and the box its door is on (the building's own
        for a building, so the door is where the game puts it)."""
        for kind, label, box, side, extra in AREAS:
            door_box = box
            if kind == "building":
                door_box = self.design_box(box, side, extra["design"]); full = extra.get("slot", door_box)
                box = (min(full[0], door_box[0]), max(full[1], door_box[1]), min(full[2], door_box[2]), max(full[3], door_box[3]))
            yield kind, box, door_box, side

    def lay_aprons(self):
        """Every door and gate gets a path as wide as it is (Mateo 2026-11-14, Oakmere's Store Shed: "Got to fix this
        path generation"). A walk is 1 wide, but doors, door steps and gates are 3: the walk widens to 3 for the last
        blocks to the door, so the steps land on paving, not grass. And a walk stops at the edge of the ground it
        leads to, so the steps stand on that ground's full blocks, never on a sunk slab."""
        for kind, box, door_box, side in self.area_boxes():
            inside = self.boxmask(box) & (self.KIND == 1)
            self.K[inside] = -1; self.KIND[inside] = 0
            dr, da = self.door_cell(door_box, side)
            (fr, fa), (cr, ca) = {"r-": ((-1, 0), (0, 1)), "r+": ((1, 0), (0, 1)), "a-": ((0, -1), (1, 0)), "a+": ((0, 1), (1, 0))}[side]
            # out from the door: the first path the middle of the door meets (a walk, a lane or the square)
            join = None
            for n in range(1, 6):
                r, a = dr + fr * n, da + fa * n
                i, j = self.ij(*self.world(r, a))
                if self.K[i, j] >= 0: join = (n, int(self.K[i, j])); break
                if self.KIND[i, j] != 0: break
            if not join: continue
            n, k = join
            for m in range(1, n + 2):        # on to the row the path runs in, so the apron meets it square
                for w in (-1, 0, 1):
                    r, a = dr + fr * m + cr * w, da + fa * m + ca * w
                    i, j = self.ij(*self.world(r, a))
                    if self.KIND[i, j] == 0 and not self.boxmask(box)[i, j]:
                        self.K[i, j] = k; self.KIND[i, j] = 1

    # ---- 2. levelled areas
    def path_y_near(self, box, side):
        """Top-block height of the path in front of a box's door side (its slab sits at this y)."""
        r0, r1, a0, a1 = box
        if side == "r-": probe = ((self.R >= r0 - 3) & (self.R < r0) & (self.A >= a0) & (self.A <= a1))
        elif side == "r+": probe = ((self.R <= r1 + 3) & (self.R > r1) & (self.A >= a0) & (self.A <= a1))
        elif side == "a-": probe = ((self.A >= a0 - 3) & (self.A < a0) & (self.R >= r0) & (self.R <= r1))
        else: probe = ((self.A <= a1 + 3) & (self.A > a1) & (self.R >= r0) & (self.R <= r1))
        probe &= self.K >= 0
        if not probe.any(): return None
        return int(np.median((self.K[probe] - 1) // 2))

    def level_areas(self):
        hall = self.boxmask(HALL1) & (self.KIND == 0)
        self.LEVEL[hall] = self.sqY; self.KIND[hall] = 6
        for kind, label, box, side, extra in AREAS:
            if kind == "building": box = self.design_box(box, side, extra["design"])
            full = extra.get("slot", box)
            if kind == "building":   # a slot is never smaller than the building on it
                full = (min(full[0], box[0]), max(full[1], box[1]), min(full[2], box[2]), max(full[3], box[3]))
            m = self.boxmask(full) & (self.KIND == 0)
            y = self.path_y_near(full, side)
            if y is None: y = int(round(float(np.median(self.G[m]))))
            self.LEVEL[m] = y; self.KIND[m] = 5
            self.areas.append(dict(kind=kind, label=label, box=list(full), side=side, y=y, **({"building": list(box)} if kind == "building" else {}), **{k: v for k, v in extra.items() if k != "slot"}))

    def design_box(self, door, side, design):
        """(r0, r1, a0, a1) a design takes with its door on `side` at cell `door`: wide along the door edge, deep inward."""
        x0, x1, z0, z1 = self.sizes.get(design, (-4, 4, 0, 8))
        r, a = door; deep = z1
        if side == "r+": return (r - deep, r, a + x0, a + x1)
        if side == "r-": return (r, r + deep, a - x1, a - x0)
        if side == "a-": return (r + x0, r + x1, a, a + deep)
        return (r - x1, r - x0, a - deep, a)

    # ---- 3. the wall line
    def wall_line(self, N=120):
        ang = np.linspace(0, 2 * math.pi, N, endpoint=False)
        gate = math.atan2(self.g[1], self.g[0])
        planned = (self.KIND > 0) & ((self.KIND != 3) | (self.D < 20))   # the main lane runs on out of the gate
        planned &= self.D < 70
        pa = self.ANG[planned]; pd = self.D[planned]
        need = np.zeros(N)
        for i, a in enumerate(ang):
            dd = np.abs((pa - a + math.pi) % (2 * math.pi) - math.pi)
            near = dd < math.radians(9)
            # main lane runs out past the wall: it doesn't push the wall out
            need[i] = (pd[near].max() if near.any() else 0) + WALL_KEEP
        # a few slow lobes, different for every plot
        lob = np.zeros(N)
        for k, amp in ((2, 3.0), (3, 2.2), (5, 1.2)):
            lob += amp * (0.5 + self.rng.random()) * np.cos(k * ang + self.rng.random() * 2 * math.pi)
        r = np.maximum(WALL_BASE + lob, need)
        # the ground: try a little in and out, keep off slopes and prefer the brow of a rise
        best = r.copy()
        for i, a in enumerate(ang):
            costs = []
            for dr in range(-2, 5):
                rr = r[i] + dr
                if rr < need[i]: continue
                x = self.C[0] + math.cos(a) * rr; z = self.C[1] + math.sin(a) * rr
                ii, jj = int(round(x)) - self.X0, int(round(z)) - self.Z0
                if not (2 <= ii < self.n - 2 and 2 <= jj < self.n - 2): continue
                xi = self.C[0] + math.cos(a) * (rr - 3); zi = self.C[1] + math.sin(a) * (rr - 3)
                xo = self.C[0] + math.cos(a) * (rr + 3); zo = self.C[1] + math.sin(a) * (rr + 3)
                gi = self.GS[int(round(xi)) - self.X0, int(round(zi)) - self.Z0]; go = self.GS[int(round(xo)) - self.X0, int(round(zo)) - self.Z0]
                steep = abs(gi - go)
                brow = gi - go                     # ground falls away outside: good for a wall
                wet = self.WL[ii, jj] > self.G[ii, jj]
                costs.append((steep * 0.8 - brow * 0.6 + abs(dr) * 0.35 + (50 if wet else 0), rr))
            if costs: best[i] = min(costs)[1]
        r = best
        for _ in range(3):                         # smooth, never inside what it holds
            r = np.maximum((np.roll(r, 1) + 2 * r + np.roll(r, -1)) / 4, need)
        # straight across the gate: the line is a chord there
        gi = int(round((gate % (2 * math.pi)) / (2 * math.pi) * N)) % N
        rg = r[gi]
        for d in range(-5, 6):
            j = (gi + d) % N
            th = (ang[j] - gate + math.pi) % (2 * math.pi) - math.pi
            r[j] = max(need[j], rg / max(0.5, math.cos(th)))
        self.wall_r = [round(float(v), 2) for v in r]; self.wall_ang = gate; self.wallN = N
        # the inside, for grading: columns within the line
        f = (self.ANG % (2 * math.pi)) / (2 * math.pi) * N
        i0 = np.floor(f).astype(int) % N; t = f - np.floor(f)
        rr = np.asarray(r)[i0] * (1 - t) + np.asarray(r)[(i0 + 1) % N] * t
        self.WALLR = rr
        self.INSIDE = self.D <= rr

    # ---- 4. grade the land to the paths and areas
    def grade(self):
        s_fixed = np.full(self.G.shape, np.nan, np.float32)
        path = self.K >= 0
        s_fixed[path] = self.K[path] / 2.0 + 0.5            # walking surface: slab top = y + 0.5 ... ground beside is half higher
        area = self.LEVEL > -999
        s_fixed[area] = self.LEVEL[area] + 1.0
        fixed = ~np.isnan(s_fixed)
        # free ground: inside the wall the bumps are smoothed away, outside it is the plot's own land
        base = np.where(self.INSIDE, self.GS, self.G.astype(np.float32)) + 1.0
        w = np.clip((self.D - self.WALLR - 2) / 10, 0, 1)
        base = base * (1 - w) + (self.G + 1.0) * w
        lo = np.where(fixed, s_fixed, -1e4).astype(np.float32); hi = np.where(fixed, s_fixed, 1e4).astype(np.float32)
        steps = [((1, 0), SLOPE), ((-1, 0), SLOPE), ((0, 1), SLOPE), ((0, -1), SLOPE),
                 ((1, 1), SLOPE * 1.414), ((1, -1), SLOPE * 1.414), ((-1, 1), SLOPE * 1.414), ((-1, -1), SLOPE * 1.414)]
        def shift(a, dx, dz, fill):
            out = np.full_like(a, fill)
            xs = slice(max(dx, 0), self.n + min(dx, 0)); xd = slice(max(-dx, 0), self.n + min(-dx, 0))
            zs = slice(max(dz, 0), self.n + min(dz, 0)); zd = slice(max(-dz, 0), self.n + min(-dz, 0))
            out[xs, zs] = a[xd, zd]; return out
        for _ in range(60):
            for (dx, dz), st in steps:
                lo = np.maximum(lo, shift(lo, dx, dz, -1e4) - st)
                hi = np.minimum(hi, shift(hi, dx, dz, 1e4) + st)
        s = np.clip(base, lo, np.maximum(lo, hi))
        s = np.where(fixed, s_fixed, s)
        top = np.floor(s - 1.0 + 0.5).astype(np.int32)      # free ground: nearest whole block
        top[area] = self.LEVEL[area]
        top[path] = (self.K[path] - 1) // 2                 # block the path slab (or full block) sits in
        self.TOP = self.fill_pits(top, path, area)

    def fill_pits(self, top, path, area):
        """No pits: a little patch of free ground left lower than all the free ground and paths round it (a strip
        squeezed between a yard, a plot and a walk rounds down while its neighbours round up) comes up to the lowest
        of them. A yard or plot beside it is its own levelled ground behind a fence or border, so it doesn't count.
        Ground beside a path never sits below the block the path's slab is in."""
        free = ~path & ~area & self.INSIDE
        nb = ((1, 0), (-1, 0), (0, 1), (0, -1))
        for _ in range(4):
            changed = False
            seen = np.zeros(top.shape, bool)
            for i0, j0 in np.argwhere(free):
                if seen[i0, j0]: continue
                h = top[i0, j0]; comp = [(i0, j0)]; seen[i0, j0] = True; edge = []; q = 0
                while q < len(comp) and len(comp) <= 6:
                    i, j = comp[q]; q += 1
                    for di, dj in nb:
                        a, b = i + di, j + dj
                        if not (0 <= a < self.n and 0 <= b < self.n) or area[a, b]: continue
                        if free[a, b] and top[a, b] == h:
                            if not seen[a, b]: seen[a, b] = True; comp.append((a, b))
                        else: edge.append(top[a, b])
                if len(comp) <= 6 and edge and min(edge) > h:
                    for c in comp: top[c] = min(edge)
                    changed = True
            if not changed: break
        return top

    # ---- 5. blocks
    def surface(self, x, z):
        return REGION_SURFACE.get(self.region, "grass_block")

    def write_ground(self):
        reach = self.D <= (self.WALLR + 14)
        self.reach = reach
        for i, j in np.argwhere(reach):
            x, z = int(self.WX[i, j]), int(self.WZ[i, j])
            if (x, z) == self.C: continue
            g = int(self.G[i, j]); t = int(self.TOP[i, j])
            k = int(self.K[i, j]); kind = int(self.KIND[i, j])
            for y in range(t + 1, g + 1): self.put(x, y, z, "air")                     # cut
            for y in range(g + 1, t): self.put(x, y, z, "dirt")                         # fill
            if k >= 0:
                slab = k % 2 == 1
                pk = {4: "square", 3: "main", 2: "lane", 1: "walk"}[kind] if kind in (1, 2, 3, 4) else "lane"
                m = pick(PAVE[pk], x, z, 91 + len(pk))
                if pk == "square":
                    r, a = int(self.R[i, j]), int(self.A[i, j])
                    edge = self.square_mask[i, j] and ((abs(r - SQUARE_C[0]) + abs(a - SQUARE_C[1])) >= 9 or abs(r) == 6 or a in (SQUARE[2], SQUARE[3]))
                    if edge: m = "polished_andesite"
                    elif r == 0 or a == SQUARE_C[1]: m = "stone_brick"
                if slab:
                    self.put(x, t, z, m + "_slab", {"half": "bottom"})
                    if t - 1 >= g + 1 or t <= g: self.put(x, t - 1, z, FULL[m] if t - 1 > g else "dirt")
                    self.put(x, t - 1, z, "dirt") if t - 1 > g else None
                else:
                    self.put(x, t, z, FULL[m])
            elif t != g or kind in (5, 6) or self.INSIDE[i, j]:
                self.put(x, t, z, self.surface(x, z))
        # remember the final top for every column (the preview draws terrain from it)

    # ---- 6. what stands on each area
    def at(self, r, a):
        x, z = self.world(r, a); i, j = self.ij(x, z)
        return x, int(self.TOP[i, j]), z

    def fence_ring(self, box, gap_side, gap_w=3, block=None, skip_door=None):
        r0, r1, a0, a1 = box; block = block or f"{self.wood}_fence"
        cells = [(r, a0) for r in range(r0, r1 + 1)] + [(r, a1) for r in range(r0, r1 + 1)] + [(r0, a) for a in range(a0 + 1, a1)] + [(r1, a) for a in range(a0 + 1, a1)]
        mr, ma = (r0 + r1) // 2, (a0 + a1) // 2
        for r, a in cells:
            if gap_side in ("r-", "r+") and r == (r0 if gap_side == "r-" else r1) and abs(a - ma) <= gap_w // 2: continue
            if gap_side in ("a-", "a+") and a == (a0 if gap_side == "a-" else a1) and abs(r - mr) <= gap_w // 2: continue
            x, y, z = self.at(r, a)
            if self.K[self.ij(x, z)] >= 0: continue
            self.put(x, y + 1, z, block)

    def door_cell(self, box, side):
        r0, r1, a0, a1 = box; mr, ma = (r0 + r1) // 2, (a0 + a1) // 2
        return {"r-": (r0, ma), "r+": (r1, ma), "a-": (mr, a0), "a+": (mr, a1)}[side]

    def side_vec(self, side):
        """forward (into the area) in world terms for a door on this side"""
        v = {"r-": (1, 0), "r+": (-1, 0), "a-": (0, 1), "a+": (0, -1)}[side]
        return (v[0] * self.Rt[0] + v[1] * self.F[0], v[0] * self.Rt[1] + v[1] * self.F[1])

    def lamp(self, r, a):
        x, y, z = self.at(r, a)
        if self.K[self.ij(x, z)] >= 0: y = (self.K[self.ij(x, z)] - 1) // 2
        self.put(x, y + 1, z, f"{self.wood}_fence"); self.put(x, y + 2, z, f"{self.wood}_fence"); self.put(x, y + 3, z, "lantern")
        self.fixtures.append({"kind": "lamp", "at": [x - self.C[0], y + 1, z - self.C[1]]})

    def dress(self):
        W = self.wood
        for ar in self.areas:
            box = tuple(ar.get("building", ar["box"])); side = ar["side"]; kind = ar["kind"]; r0, r1, a0, a1 = box
            fwd = self.side_vec(side)
            dr, da = self.door_cell(box, side)
            if kind == "building":
                dx, y, dz = self.at(dr, da)
                self.buildings.append({"design": ar["design"], "label": ar["label"], "origin": [dx - self.C[0], y + 1, dz - self.C[1]], "forward": list(fwd), "built": True})
                # a stone foundation under the whole box, down to the old ground
                for r in range(r0, r1 + 1):
                    for a in range(a0, a1 + 1):
                        x, yy, z = self.at(r, a)
                        self.put(x, yy, z, "cobblestone")
                if ar.get("design") == "cottage":   # front garden of its slot: flowers either side of the walk
                    for a in range(a0, a1 + 1):
                        if abs(a - da) <= 1: continue
                        x, yy, z = self.at(r0 - 0, a)
                self.fence_ring(tuple(ar["box"]), side, 3) if False else None
            elif kind == "slot":
                # a flush log border, the Plot Marker at the front middle, a sign
                log = f"stripped_{W}_log"
                for r in range(r0, r1 + 1):
                    for a in range(a0, a1 + 1):
                        if r in (r0, r1) or a in (a0, a1):
                            x, y, z = self.at(r, a)
                            axis = "x" if (a in (a0, a1)) == (self.Rt[0] != 0) else "z"
                            self.put(x, y, z, log, {"axis": axis})
                x, y, z = self.at(dr, da)
                self.put(x, y + 1, z, "plot_marker")
                self.fixtures.append({"kind": "plot_marker", "at": [x - self.C[0], y + 1, z - self.C[1]], "size": ar.get("size", "S")})
            elif kind == "yard":
                for r in range(r0 + 1, r1):
                    for a in range(a0 + 1, a1):
                        x, y, z = self.at(r, a)
                        self.put(x, y, z, "gravel" if h3(x, 1, z, 5) < 0.55 else "coarse_dirt")
                self.fence_ring(box, side, 3)
                # stone stock: little stacks along the back, a stonecutter and the bench near the gate
                stock = ["cobblestone", "stone_bricks", "andesite", "cobblestone", "stone"]
                for n, a in enumerate(range(a0 + 2, a1 - 1, 2)):
                    x, y, z = self.at(r1 - 2, a)
                    hgt = 1 + int(h3(x, 2, z, 9) * 2)
                    for k in range(hgt): self.put(x, y + 1 + k, z, stock[n % len(stock)])
                x, y, z = self.at(r0 + 3, da - 2); self.put(x, y + 1, z, "mason_bench")
                self.fixtures.append({"kind": "mason_bench", "at": [x - self.C[0], y + 1, z - self.C[1]]})
                x, y, z = self.at(r0 + 3, da + 2); self.put(x, y + 1, z, "stonecutter_block")
                x, y, z = self.at(r1 - 2, a0 + 1); self.put(x, y + 1, z, "grindstone")
            elif kind == "field":
                self.fence_ring(box, side, 1)
                # 9-wide strips, a water channel down the middle of each, crops in rows
                for r in range(r0 + 1, r1):
                    for a in range(a0 + 1, a1):
                        x, y, z = self.at(r, a)
                        if (a - (a0 + 1)) % 5 == 2 and r not in (r0 + 1, r1 - 1):
                            self.put(x, y, z, "water")
                        elif r in (r0 + 1, r1 - 1) or a in (a0 + 1, a1 - 1):
                            self.put(x, y, z, "coarse_dirt")
                        else:
                            self.put(x, y, z, "farmland")
                            crop = ["wheat", "carrots", "potatoes", "beetroot"][((a - a0) // 5) % 4]
                            self.put(x, y + 1, z, crop, {"growth": 7})
                x, y, z = self.at(r1 - 1, a1 - 1); self.put(x, y + 1, z, "composter")
                x, y, z = self.at(r0 + 1, a1 - 1); self.put(x, y + 1, z, "hay_block")
            elif kind == "woodyard":
                for r in range(r0, r1 + 1):
                    for a in range(a0, a1 + 1):
                        x, y, z = self.at(r, a)
                        self.put(x, y, z, "coarse_dirt" if h3(x, 3, z, 4) < 0.7 else "podzol")
                # log piles lying along the back, a chopping block, barrels
                for a in range(a0 + 1, a1, 4):
                    for rr in range(r1 - 3, r1):
                        for k in range(2 if rr != r1 - 3 else 1):
                            x, y, z = self.at(rr, a); self.put(x, y + 1 + k, z, f"{W}_log", {"axis": "x" if self.F[0] else "z"})
                            x, y, z = self.at(rr, a + 1); self.put(x, y + 1 + k, z, f"{W}_log", {"axis": "x" if self.F[0] else "z"})
                x, y, z = self.at(r0 + 3, da); self.put(x, y + 1, z, f"stripped_{W}_log", {"axis": "y"})
                x, y, z = self.at(r0 + 2, a1 - 1); self.put(x, y + 1, z, "barrel")
                x, y, z = self.at(r0 + 3, a1 - 1); self.put(x, y + 1, z, "barrel")
                for a in (a0, a1):
                    for r in range(r0, r1 + 1, 2):
                        x, y, z = self.at(r, a); self.put(x, y + 1, z, f"{W}_fence")
            elif kind == "pen":
                self.fence_ring(box, side, 1)
                x, y, z = self.at(*self.door_cell(box, side)); self.put(x, y + 1, z, f"{W}_fence_gate")
                for (r, a) in ((r1 - 1, a0 + 1), (r1 - 1, a0 + 2), (r1 - 2, a0 + 1)):
                    x, y, z = self.at(r, a); self.put(x, y + 1, z, "hay_block")
                x, y, z = self.at(r1 - 1, a1 - 1); self.put(x, y + 1, z, "cauldron")
                for r in range(r0 + 1, r1):
                    for a in range(a0 + 1, a1):
                        x, y, z = self.at(r, a)
                        if h3(x, 4, z, 2) < 0.35: self.put(x, y, z, "coarse_dirt")
            elif kind == "commons":
                for r in range(r0, r1 + 1):
                    for a in range(a0, a1 + 1):
                        x, y, z = self.at(r, a)
                        if a == a1 or (r in (r0, r1) and a > a0 + 1):
                            self.put(x, y + 1, z, "azalea_leaves", {"persistent_bit": True}); continue
                        v = h3(x, 5, z, 1)
                        if v < 0.10: self.put(x, y + 1, z, ["poppy", "dandelion", "cornflower", "oxeye_daisy"][int(v * 40) % 4])
                        elif v < 0.3: self.put(x, y + 1, z, "short_grass")
        # the square: well in the middle, benches facing in, lamps at the corners
        for (r, a) in ((-5, -12), (5, -12), (-5, -4), (5, -4)): self.lamp(r, a)
        for r in (-3, -2, 2, 3):
            x, y, z = self.at(r, -13); self.put(x, y + 1, z, f"{W}_stairs", {"facing": {(1, 0): "e", (-1, 0): "w", (0, 1): "s", (0, -1): "n"}[self.F]})
        self.buildings.append({"design": "well", "label": "Well", "origin": [*(lambda p: [p[0] - self.C[0], self.sqY + 1, p[1] - self.C[1]])(self.world(0, -10))], "forward": list(self.F), "built": True})
        # lamps down the main lane and the back lanes
        for a in range(-16, -(WALL_BASE + 2), -6):
            for r in (-3, 3): self.lamp(r, a)
        for r in (-11, 11):
            for a in (3, 11, 19): self.lamp(r if r < 0 else 11, a) if False else None
        for a in (4, 12, 20):
            self.lamp(-11, a) if self.KIND[self.ij(*self.world(-11, a))] == 0 else None
            self.lamp(11, a) if self.KIND[self.ij(*self.world(11, a))] == 0 else None
        # the hall cornerstone and the plot stone
        self.fixtures.append({"kind": "hall_cornerstone", "at": [*(lambda p: [p[0] - self.C[0], self.sqY + 1, p[1] - self.C[1]])(self.world(*CORNERSTONE))]})
        self.fixtures.append({"kind": "plot_stone", "at": [0, self.sqY + 1, 0]})
        # wildflowers and long grass in the free ground inside the wall
        for i, j in np.argwhere(self.INSIDE & (self.KIND == 0) & (self.D < self.WALLR - 3)):
            x, z = int(self.WX[i, j]), int(self.WZ[i, j]); y = int(self.TOP[i, j]); v = h3(x, 6, z, 3)
            if (x, y + 1, z) in self.blocks: continue
            if v < 0.008: self.put(x, y + 1, z, ["poppy", "dandelion", "cornflower", "azure_bluet"][int(v * 1000) % 4])
            elif v < 0.12: self.put(x, y + 1, z, "short_grass")

    def run(self):
        self.smooth_ground(); self.lay_paths(); self.level_areas(); self.wall_line(); self.grade(); self.write_ground(); self.dress()
        return self

    def used_cells(self):
        return [[int(self.WX[i, j]) - self.C[0], int(self.WZ[i, j]) - self.C[1], int(self.KIND[i, j]), int(self.K[i, j])]
                for i, j in np.argwhere((self.KIND > 0) & self.INSIDE)]

    def doors(self):
        """Where each area's door is, in world terms: the door cell on its edge, the step outside it and the
        height of the path there, and the side of the box it is on as a compass letter (n, s, e, w)."""
        out = []
        for ar in self.areas:
            side = ar["side"]; box = tuple(ar["box"])
            dr, da = self.door_cell(box, side)
            fr, fa = {"r-": (-1, 0), "r+": (1, 0), "a-": (0, -1), "a+": (0, 1)}[side]   # outward
            ox, oz = fr * self.Rt[0] + fa * self.F[0], fr * self.Rt[1] + fa * self.F[1]
            x, z = self.world(dr, da); sx, sz = x + ox, z + oz
            k = int(self.K[self.ij(sx, sz)])
            sy = (k - 1) // 2 if k >= 0 else int(self.TOP[self.ij(sx, sz)])
            letter = {(0, -1): "n", (0, 1): "s", (1, 0): "e", (-1, 0): "w"}[(ox, oz)]
            out.append({"cell": [x - self.C[0], z - self.C[1]], "step": [sx - self.C[0], sz - self.C[1]], "stepY": sy, "side": letter})
        return out

    def export(self):
        m = self.reach
        cols = []
        for i, j in np.argwhere(m | (self.D <= self.WALLR + 24)):
            x, z = int(self.WX[i, j]), int(self.WZ[i, j])
            top = int(self.TOP[i, j]) if m[i, j] else int(self.G[i, j])
            cols.append([x - self.C[0], z - self.C[1], top, int(self.G[i, j]), int(self.WL[i, j])])
        return {
            "format": "hollow-crown-starter/1", "plot": self.plot["name"], "region": self.region, "wood": self.wood,
            "center": {"x": self.C[0], "y": self.sqY, "z": self.C[1]}, "gate": self.plot["gate"],
            "frame": {"right": list(self.Rt), "ahead": list(self.F)},
            "wall": {"radii": self.wall_r, "radiiAt": WALL_BASE, "gateAngle": self.wall_ang},
            "areas": self.areas, "buildings": self.buildings, "fixtures": self.fixtures,
            "used": self.used_cells(),   # [dx, dz, kind, k] of every planned cell inside the wall: kind 1 walk, 2 lane,
                                         # 3 main, 4 square, 5 area, 6 hall ground; k = path surface in half blocks (-1 off paths)
            "doors": self.doors(),       # per area index: {cell, step, stepY, side} in world dx, dz (for the game's slots)
            "columns": cols,   # [dx, dz, top, oldTop, water]
            "blocks": [[x - self.C[0], y, z - self.C[1], n, p] for (x, y, z), (n, p) in sorted(self.blocks.items())],
        }


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("plot"); ap.add_argument("slice"); ap.add_argument("out")
    ap.add_argument("--config", default=os.path.join(HERE, "..", "..", "Siege_Nights_BP", "scripts", "plots", "config.js"))
    ap.add_argument("--sizes", default="", help="design bounds per region from studio/starter_preview/sizes.mjs")
    a = ap.parse_args()
    plot = load_plots(a.config)[a.plot.lower()]
    T = np.load(a.slice)
    sizes = json.load(open(a.sizes)).get(plot["region"], {}) if a.sizes else {}
    st = Starter(plot, T, sizes).run()
    out = st.export()
    json.dump(out, open(a.out, "w"), separators=(",", ":"), default=lambda v: v.item() if hasattr(v, "item") else str(v))
    print(f"{plot['name']}: square y {st.sqY}, wall {min(st.wall_r):.0f}-{max(st.wall_r):.0f}, {len(out['blocks'])} blocks, {len(out['areas'])} areas")


if __name__ == "__main__":
    main()
