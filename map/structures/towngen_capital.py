"""Kingsrest with every current building (preview of the full capital, not the plots-only world bake).

    python3 towngen_capital.py SLICE.npz lines.json OUT [--seed 13] [--reserve rail-corridor-cells.json]
            [--trees TREEDB/trees.json --trees-src TREES_DIR]

SLICE: terrain_slice.py MAP_DIR -236 -226 221, then slice_heights.py on the pre-town heights. The capital hall
(85x39) only fits the flat ground south of the square, so the ward is centred at (-125, -115).
"""
import sys, os, json, math, argparse, collections, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import towngen as TG, capital, vale_civic, vale, stations
import towngen_build as TB
ap = argparse.ArgumentParser(); ap.add_argument("slice"); ap.add_argument("lines"); ap.add_argument("out")
ap.add_argument("--seed", type=int, default=13); ap.add_argument("--reserve", default=""); ap.add_argument("--trees", default="")
ap.add_argument("--trees-src", default=os.path.join(HERE, "..", "trees"))
ap.add_argument("--routes", default=os.path.join(HERE, "..", "..", "Siege_Nights_BP", "scripts", "trains", "routes_data.js"), help="track for the preview")
a = ap.parse_args(); out = a.out; seed = a.seed

HALL = (-114, -70)

class Capital(TG.Town):
    """Kingsrest with every current building: the capital hall, inn and civic buildings claim their ground
    round the square before the streets (so streets go round them), then are placed for real once the
    streets are down, so floors and paths meet."""
    SNAP = ("G", "K", "KIND", "TAKEN", "EAVES", "FIX", "DOORWALK")
    def makers(self):
        m = [("capital hall", capital.medieval), ("inn", lambda: vale.coaching_inn(style="tudor"))] + list(self.site["civic"])
        return m
    def search(self, bp, k, rmax=40, relief=8):
        for extra in range(1, rmax, 2):
            for t in range(48):
                a = 2 * math.pi * ((t + k * 17) * 0.618 % 1)
                rr = self.sqR + 1 + extra
                x, z = self.sq[0] + math.cos(a) * rr, self.sq[1] + math.sin(a) * rr
                deg = TG.snap_rot(self.sq[0] - x, self.sq[1] - z)
                e = self.try_place(bp, deg, (int(round(x)), int(round(z))), "civic", gap=1, max_relief=relief, need_walk=False)
                if e: return e
        return None
    def capital_spot(self, bp):
        """The hall needs the flattest 85x39 the ward has (the slope south of the square): try doors on a grid
        there, every way round, and keep the one with the lowest foundation."""
        best = None
        for deg in (180, 90, 270, 0):
            for dx in range(-40, 41, 3):
                for dz in range(-40, 41, 3):
                    snap = ({k: getattr(self, k).copy() for k in self.SNAP}, dict(self.works), len(self.plan), len(self.walks))
                    door = (HALL[0] + dx, HALL[1] + dz)
                    e = TG.Town.try_place(self, bp, deg, door, "civic", gap=1, max_relief=12, need_walk=False)
                    if e:
                        fx, fz = TG.ROT[deg]; tx, tz = self.sq[0] - door[0], self.sq[1] - door[1]; dd = math.hypot(tx, tz) or 1
                        f = e.get("foundation", 99) + 0.03 * dd + 3 * (1 - (fx * tx + fz * tz) / dd)   # low plinth, near the square, facing it
                        if best is None or f < best[0]: best = (f, deg, door)
                        self.undo(snap)
        if not best: return None
        print("capital hall", best)
        return TG.Town.try_place(self, bp, best[1], best[2], "civic", gap=1, max_relief=12, need_walk=False)
    def undo(self, snap):
        arr, works, n_plan, n_walks = snap
        for k, v in arr.items(): setattr(self, k, v)
        self.works = works; del self.plan[n_plan:]; del self.walks[n_walks:]
    def claim(self):
        snap = {k: getattr(self, k).copy() for k in self.SNAP}; works = dict(self.works); n_plan = len(self.plan); n_walks = len(self.walks)
        self.claims = []; self.claim_y = {}
        for k, (name, mk) in enumerate(self.makers()):
            bp = mk(); bp.kind = "civic"
            e = self.capital_spot(bp) if name == "capital hall" else self.search(bp, k, rmax=24, relief=7)
            if e:
                self.claims.append((name, mk, e["rotation"], tuple(e["door"]), self.footprint(bp, e["rotation"])[0], (e["x"], e["z"])))
                self.claim_y[name] = e["ground_y"]
            else: print("no claim for", name)
        for k, v in snap.items(): setattr(self, k, v)
        self.works = works; del self.plan[n_plan:]; del self.walks[n_walks:]
        for *_, cells, (ox, oz) in self.claims:
            for x, z in cells:
                for dx in (-2, -1, 0, 1, 2):
                    for dz in (-2, -1, 0, 1, 2):
                        if self.ok(x + ox + dx, z + oz + dz): self.TAKEN[self.ij(x + ox + dx, z + oz + dz)] = 2
    def place_square_buildings(self):
        for *_, cells, (ox, oz) in self.claims:
            for x, z in cells:
                for dx in (-2, -1, 0, 1, 2):
                    for dz in (-2, -1, 0, 1, 2):
                        c = (x + ox + dx, z + oz + dz)
                        if self.ok(*c) and self.K[self.ij(*c)] < 0 and self.TAKEN[self.ij(*c)] == 2: self.TAKEN[self.ij(*c)] = 0
        for k, (name, mk, deg, door, _, _) in enumerate(self.claims):
            bp = mk(); bp.kind = "civic"
            e = self.try_place(bp, deg, door, "civic", gap=1, max_relief=10)
            if not e: e = self.search(bp, k, rmax=46 if name == "capital hall" else 24, relief=10)
            if not e: e = self.civic_on_street(bp, name)
            if e: e["name"] = name
            else: print("no room for", name)
    # ------------------------------------------------------------------ the grand station
    STOP = (-95, 80, -100)              # Kingsrest stop: every line starts here, running east and west along z = -100
    def station(self):
        """The Grand Station north of the hub, its platform on the line and its street doors toward the square;
        its ground is levelled to the platform and an avenue runs from the street front to the square."""
        bp = stations.grand("vale"); bp.kind = "station"
        x, y, z = self.STOP
        g, _ = self.footprint(bp, 0); cells = [(gx + x, gz + z) for gx, gz in g if self.ok(gx + x, gz + z)]
        self.stamp(bp, x, z, y, 0, "station"); self.plan[-1]["name"] = "grand station"; self.plan[-1]["footprint"] = len(cells)
        self.foundation(cells, y)
        for cx, cz in cells:
            for dx in (-1, 0, 1):
                for dz in (-1, 0, 1):
                    if self.ok(cx + dx, cz + dz): self.TAKEN[self.ij(cx + dx, cz + dz)] = 2
        (lx, _, lz), (hx, _, hz) = bp.bounds()
        self.station_front = ((x, z + lz - 1), (0, -1), y)        # the street side faces north, toward the square

    def avenue(self, start, f, yf, kind="main"):
        """A street from a door (start, facing f) out of its own grounds to the nearest street or the square."""
        x, z = start; n = 0
        while self.ok(x, z) and self.at(self.TAKEN, x, z) >= 2 and n < 30: x, z = x + f[0], z + f[1]; n += 1
        goals = [(int(i) + self.X0, int(j) + self.Z0) for i, j in np.argwhere((self.K >= 0) & (self.KIND >= TG.PRIO["lane"]))]
        if not goals: return
        lead = [(start[0] + f[0] * t, start[1] + f[1] * t) for t in range(n)]
        p = self.astar((x, z), goals, kind, limit=1500)
        if not p or len(p) < 2: print("no avenue from", start); return
        self.lay(lead + p, kind, k_start=2 * yf + 1, k_end=self.k_at(*p[-1]))

    def avenues(self):
        for name, mk, deg, door, cells, (ox, oz) in self.claims:
            if name == "capital hall": self.avenue(door, TG.ROT[deg], self.claim_y[name])
        if getattr(self, "station_front", None):
            (sx, sz), f, y = self.station_front; self.avenue((sx, sz), f, y)

    # ------------------------------------------------------------------ twice as dense
    def pick_building(self, tier, kinds=None):
        """A capital: tall townhouses in rows near the middle, cottages only toward the wall."""
        sd = self.seed * 1000 + len(self.plan) * 7 + self.rng.randint(0, 999)
        if tier <= 1 or self.rng.random() < 0.5:
            st = self.rng.choice(["tudor", "tudor", "stone", "brick", "stone"])
            w, d = self.rng.choice([(5, 9), (7, 9), (7, 11), (9, 11)])
            b = vale.townhouse(sd, width=w, depth=d, storeys=self.rng.choice([2, 3, 3]), ground="stone", style=st,
                               jetty=self.rng.random() < 0.7, roof=self.rng.choice(["slate", "wood"]), chimney_side=self.rng.choice("ew"))
            b.kind = "house"; return b
        return TB.random_cottage(sd, self.rng, min(tier, 2), roof="slate")

    def houses(self):
        def tier(x, z):
            if not self.ok(x, z) or self.at(self.PKIND, x, z) == 0: return None
            u = self.u(x, z)
            return 0 if u < 0.3 else 1 if u < 0.55 else 2
        ring = [(self.sq[0] + math.cos(a) * (self.sqR + 1.2), self.sq[1] + math.sin(a) * (self.sqR + 1.2)) for a in np.linspace(0, 2 * math.pi, 64)]
        self.place_along({"kind": "walk", "pts": ring}, -1, lambda x, z: 0, setbacks=(1, 2), gap_rng=(0, 1))
        for _ in range(2):                                  # two sweeps: the second fills the gaps the first left
            for rd in [r for r in self.roads if r["kind"] == "main"] + [r for r in self.roads if r["kind"] == "lane"]:
                for side in (1, -1):
                    self.place_along(rd, side, tier, setbacks=(1, 2, 3, 5, 6, 7), gap_rng=(0, 1))

    # ------------------------------------------------------------------ the city wall
    def wall(self):
        """A stone curtain wall on the town's edge: 2 thick, 6 high with a crenellated parapet, a tower every
        ~22 blocks, and a gatehouse arch wherever a street or the railway crosses it; open over water."""
        band = (self.E > self.R - 1.0) & (self.E <= self.R + 1.0) & ~self.WET
        gap = np.zeros_like(band)
        for cx, cz in self.rail_cells:
            if self.ok(cx, cz): gap[self.ij(cx, cz)] = True
        road = (self.K >= 0) | gap
        near_road = np.zeros_like(band)
        for di in range(-4, 5):
            for dj in range(-4, 5): near_road |= np.roll(np.roll(road, di, 0), dj, 1)
        STONE = [("stone_bricks", 6), ("mossy_stone_bricks", 2), ("cracked_stone_bricks", 1), ("andesite", 1)]
        def stone(x, y, z):
            r = TG.h3(x, y, z, 41) * 10
            for m, w in STONE:
                r -= w
                if r < 0: return (m, {})
            return ("stone_bricks", {})
        ii, jj = np.nonzero(band)
        ang = np.degrees(np.arctan2(jj + self.Z0 - self.C[1], ii + self.X0 - self.C[0])) % 360
        for i, j, a in zip(ii, jj, ang):
            x, z = int(i) + self.X0, int(j) + self.Z0
            g = int(self.G[i, j]); H = 6
            tower = (a % 16) < 2.2                                  # a tower every ~22 blocks round a 90 ring
            if road[i, j]:                                          # gate: an arch over the street or the line
                kk = int(self.K[i, j]) if self.K[i, j] >= 0 else 2 * g + 1
                base = (kk - 1) // 2 + 5
                for y in range(base, base + 3): self.works[(x, y, z)] = stone(x, y, z)
                if (x + z) % 2 == 0: self.works[(x, base + 3, z)] = stone(x, base + 3, z)
                continue
            top = g + (H + 4 if (tower or near_road[i, j]) else H)
            for y in range(g + 1, top + 1): self.works[(x, y, z)] = stone(x, y, z)
            if (x * 3 + z) % 2 == 0: self.works[(x, top + 1, z)] = ("stone_brick_wall", {})
            if (tower or near_road[i, j]) and (x + z) % 7 == 0: self.works[(x, top, z)] = ("lantern", {})
            self.TAKEN[i, j] = 2

    def rails_in_view(self):
        """Track for the preview scene (genworld lays the real track): every Kingsrest line inside the slice."""
        return [(x, y, z) for x, y, z in self.rail_blocks if self.ok(x, z) and self.E[self.ij(x, z)] <= self.R + 7]

    def run(self):
        self.square(); self.station(); self.claim()
        self.streets(); self.avenues(); self.relax(); self.grade_verges()
        self.portions(); self.place_square_buildings()
        self.houses(); self.relax(); self.windmills(); self.field_paths(); self.fences(); self.fields()
        self.dress(); self.roof_colours(); self.path_blocks(); self.ground_blocks(); self.banks(); self.wall()
        self.works = {(int(x), int(y), int(z)): v for (x, y, z), v in self.works.items()}
        for e in self.plan:
            for k in ('x', 'z', 'ground_y', 'rotation', 'footprint'): e[k] = int(e[k])

site = dict(centre=(-125, -115), radius=90, size="town", square_at=(-100, -132), square_r=9, seed=seed, build_u=2.0, lanes=16,
            roofs={"warm red": 5, "slate": 4, "dark shingle": 1}, accent="copper",
            civic=[("guildhall", vale_civic.guildhall), ("chapel", vale_civic.chapel)])
T = np.load(a.slice); L = json.load(open(a.lines))
if a.trees:
    TG.Town.tree_index = json.load(open(a.trees)); TG.Town.tree_dir = os.path.dirname(os.path.abspath(a.trees)); TG.Town.tree_src = os.path.abspath(a.trees_src)
t = Capital("Kingsrest", site, T, L, seed)
src = open(a.routes).read(); R = json.loads(src[src.index("{"):src.rindex("}") + 1])
t.rail_blocks = sorted({(b[0], b[1], b[2]) for sg in R["segments"] if "kingsrest" in (sg["from"], sg["to"]) for b in sg["blocks"]})
t.rail_cells = {(x, z) for x, _, z in t.rail_blocks}
for x, z in (json.load(open(a.reserve)) if a.reserve else []):          # the rail corridor stays clear
    if t.ok(x, z): t.TAKEN[t.ij(x, z)] = max(int(t.TAKEN[t.ij(x, z)]), 1)
t.run()
print(collections.Counter(e["kind"] for e in t.plan), [e.get("name") for e in t.plan if e["kind"] == "civic"])
os.makedirs(out, exist_ok=True); t.write(out); t.picture(out)
print("world blocks", t.write_worldblocks(out))
for x, y, z in t.rails_in_view(): t.works[(x, y, z)] = ("rail", {})      # preview only, after the world blocks
print("scene", t.scene(out))
