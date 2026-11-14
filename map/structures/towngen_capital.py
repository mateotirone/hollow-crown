"""Kingsrest with every current building (preview of the full capital, not the plots-only world bake).

    python3 towngen_capital.py SLICE.npz lines.json OUT [--seed 13] [--reserve rail-corridor-cells.json]
            [--trees TREEDB/trees.json --trees-src TREES_DIR]

SLICE: terrain_slice.py MAP_DIR -236 -226 221, then slice_heights.py on the pre-town heights. The capital hall
(85x39) only fits the flat ground south of the square, so the ward is centred at (-115, -100): station, market square and hall in a line, the hall facing the station.
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

HALL = (-123, -110)     # Mateo 2026-11-12: the hall faces the station across the market square
RAIL_Z = -51            # the map thread's line (PR #195): east-west along z = -51, the town north of it
RAIL_X = (-176, -70)    # straight platform track -146..-100 plus the curves away; z -60..-42 stays clear of buildings

class Capital(TG.Town):
    """Kingsrest with every current building: the capital hall, inn and civic buildings claim their ground
    round the square before the streets (so streets go round them), then are placed for real once the
    streets are down, so floors and paths meet."""
    SNAP = ("G", "K", "KIND", "TAKEN", "EAVES", "FIX", "DOORWALK", "LANDK")
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
        for deg in (0, 90, 270, 180):
            for dx in range(-16, 17, 2):
                for dz in range(-8, 9, 2):
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
            if name == "capital hall":   # its claim was tested with these limits (capital_spot): use the same, or it is lost
                e = (TG.Town.try_place(self, bp, deg, door, "civic", gap=1, max_relief=12, need_walk=False, yf_want=self.claim_y[name])   # the avenue was laid to this floor
                     or TG.Town.try_place(self, bp, deg, door, "civic", gap=1, max_relief=12, need_walk=False) or self.capital_spot(bp))
            else: e = self.try_place(bp, deg, door, "civic", gap=1, max_relief=10)
            if not e: e = self.search(bp, k, rmax=46 if name == "capital hall" else 24, relief=10)
            if not e: e = self.civic_on_street(bp, name)
            if e:
                e["name"] = name
                if name == "capital hall":               # level buttons in the 3D view: the five town halls, then the capital
                    import settle_halls as SH
                    self.add_levels("town hall", e, [(f"Level {L}", getattr(SH, f"vale_{L}")()) for L in range(1, 6)] + [("Capital", self.designs[e["stamp"]])])
            else: print("no room for", name)
    # ------------------------------------------------------------------ the grand station
    STOP = (-123, 79, -51)              # Kingsrest stop (map thread, PR #195): the town's south edge, lines east and west
    def station(self):
        """The Grand Station on the town's south edge, north of the line, its street doors north onto the square;
        its ground is levelled to the platform and an avenue runs from the street front to the square."""
        bp = stations.grand("vale"); bp.kind = "station"
        x, y, z = self.STOP
        g, _ = self.footprint(bp, 0); cells = [(gx + x, gz + z) for gx, gz in g if self.ok(gx + x, gz + z)]
        self.station_cells = set(cells)
        self.stamp(bp, x, z, y, 0, "station"); self.plan[-1]["name"] = "grand station"; self.plan[-1]["footprint"] = len(cells)
        self.add_levels("station", self.plan[-1], [(st.capitalize(), bp if st == "grand" else getattr(stations, st)("vale")) for st in stations.STAGES], align="origin")
        self.foundation(cells, y)
        for cx, cz in cells:
            for dx in (-1, 0, 1):
                for dz in (-1, 0, 1):
                    if self.ok(cx + dx, cz + dz): self.TAKEN[self.ij(cx + dx, cz + dz)] = 2
        zmin = min(gz for _, gz in g)
        self.station_front = ((x, z + zmin - 1), (0, -1), y)      # the street side faces north, onto the square

    def avenue(self, start, f, yf, kind="main"):
        """A street from a door (start, facing f) out of its own grounds to the nearest street or the square."""
        for t in range(1, 40):                             # the square or a street straight ahead: run straight to it
            c = (start[0] + f[0] * t, start[1] + f[1] * t)
            if not self.ok(*c) or self.at(self.WET, *c): break
            if self.at(self.K, *c) >= 0:
                lead = [(start[0] + f[0] * s, start[1] + f[1] * s) for s in range(t + 1)]
                self.lay(lead, kind, k_start=2 * yf + 1, k_end=int(self.at(self.K, *c))); return
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
        n0, n1 = band.shape
        zz = np.arange(n1)[None, :] + self.Z0
        band &= np.broadcast_to(zz < RAIL_Z - 11, band.shape)          # the ring stops short of the railway...
        band |= np.broadcast_to((zz >= RAIL_Z - 13) & (zz <= RAIL_Z - 12), band.shape) & (self.E <= self.R) & ~self.WET   # ...and runs straight beside it
        for cx, cz in getattr(self, "station_cells", ()):              # the Grand Station is the gatehouse
            for dx in range(-1, 2):
                for dz in range(-1, 2):
                    if self.ok(cx + dx, cz + dz): band[self.ij(cx + dx, cz + dz)] = False
        self.rail_gates = set()
        gap = np.zeros_like(band); rail_y = {}
        for cx, cz in self.rail_cells:                      # the railway's opening: 5 wide round the line
            for dx in range(-2, 3):
                for dz in range(-2, 3):
                    if self.ok(cx + dx, cz + dz):
                        gap[self.ij(cx + dx, cz + dz)] = True
        for x, y, z in self.rail_blocks:
            for dx in range(-2, 3):
                for dz in range(-2, 3): rail_y.setdefault((x + dx, z + dz), y)
        on_line = {(x, z) for x, _, z in self.rail_blocks}
        road = (self.K >= 0) | gap
        near_road = np.zeros_like(band)
        for di in range(-4, 5):
            for dj in range(-4, 5): near_road |= np.roll(np.roll(road, di, 0), dj, 1)
        self.wall_region = "vale"                          # Mateo 2026-11-12: the wall is built like the Grand Station
        kit = self.wall_kit(); STONE = kit["stone"]; cap = kit["cap"]
        def stone(x, y, z):
            r = TG.h3(x, y, z, 41) * sum(w for _, w in STONE)
            for m, w in STONE:
                r -= w
                if r < 0: return (m, {})
            return (STONE[0][0], {})
        ii, jj = np.nonzero(band); line = []
        ang = np.degrees(np.arctan2(jj + self.Z0 - self.C[1], ii + self.X0 - self.C[0])) % 360
        for i, j, a in zip(ii, jj, ang):
            x, z = int(i) + self.X0, int(j) + self.Z0
            g = int(self.G[i, j]); H = 6
            tower = False                                           # towers: the station's own (wall_towers)
            if gap[i, j] and (x, z) in rail_y:                     # the railway arch: tall enough for a train, and
                ry = rail_y[(x, z)]; base = ry + 6                   # a rail gate that lifts for trains only (shown shut)
                for y in range(base, base + 3): self.works[(x, y, z)] = stone(x, y, z)
                if (x + z) % 2 == 0: self.works[(x, base + 3, z)] = stone(x, base + 3, z)
                for y in range(ry + 1, base): self.works[(x, y, z)] = ("air", {})
                if abs(self.E[i, j] - self.R) < 0.5:
                    for y in range(ry + 1, base): self.works[(x, y, z)] = ("iron_bars", {})
                    self.rail_gates.add((x, ry, z))
                continue
            if road[i, j]:                                          # gate: an arch over the street
                kk = int(self.K[i, j]) if self.K[i, j] >= 0 else 2 * g + 1
                base = (kk - 1) // 2 + 5
                for y in range(base, base + 3): self.works[(x, y, z)] = stone(x, y, z)
                if (x + z) % 2 == 0: self.works[(x, base + 3, z)] = stone(x, base + 3, z)
                continue
            top = g + H
            for y in range(g + 1, top + 1): self.works[(x, y, z)] = stone(x, y, z)
            if (x * 3 + z) % 2 == 0: self.works[(x, top + 1, z)] = (cap, {})
            self.TAKEN[i, j] = 2; line.append((x, z))
        self.wall_towers(line, H)

    def rails_in_view(self):
        """Track for the preview scene (genworld lays the real track): every Kingsrest line inside the slice."""
        return [(x, y, z) for x, y, z in self.rail_blocks if self.ok(x, z)]

    def run(self):
        self.square(); self.station(); self.claim()
        self.streets(); self.avenues(); self.relax(); self.grade_verges()
        self.portions(); self.place_square_buildings()
        self.houses(); self.relax(); self.windmills(); self.terraform(); self.field_paths(); self.fences(); self.fields()
        self.dress(); self.roof_colours(); self.path_blocks(); self.ground_blocks(); self.banks(); self.wall()
        self.works = {(int(x), int(y), int(z)): v for (x, y, z), v in self.works.items()}
        for e in self.plan:
            for k in ('x', 'z', 'ground_y', 'rotation', 'footprint'): e[k] = int(e[k])

site = dict(centre=(-123, -125), radius=82, size="town", square_at=(-123, -96), square_r=9, seed=seed, build_u=2.0, lanes=16,
            roofs={"warm red": 5, "slate": 4, "dark shingle": 1}, accent="copper",
            civic=[("guildhall", vale_civic.guildhall), ("chapel", vale_civic.chapel),
                   ("breeder's post", lambda: __import__("settle_buildings").town_breeder_yard("vale"))])
T = np.load(a.slice); L = json.load(open(a.lines))
if a.trees:
    TG.Town.tree_index = json.load(open(a.trees)); TG.Town.tree_dir = os.path.dirname(os.path.abspath(a.trees)); TG.Town.tree_src = os.path.abspath(a.trees_src)
t = Capital("Kingsrest", site, T, L, seed)
t.rail_shape = {(x, Capital.STOP[1], RAIL_Z): (0, 2) for x in range(t.X0, t.X0 + t.G0.shape[0])}   # preview: the straight through the station, out to both edges (Mateo: show the line arriving)
t.rail_blocks = sorted(t.rail_shape)
t.rail_cells = {(x, z) for x, _, z in t.rail_blocks}
t.XCOST = np.zeros(t.G0.shape, np.float32)                 # streets cross the line, they never run along it
for x, z in t.rail_cells:
    for dx in range(-2, 3):
        for dz in range(-2, 3):
            if t.ok(x + dx, z + dz): t.XCOST[t.ij(x + dx, z + dz)] = 30.0
for x in range(RAIL_X[0] - 30, RAIL_X[1] + 31):                      # the railway band stays clear (map thread)
    for z in range(RAIL_Z - 9, RAIL_Z + 10):
        if t.ok(x, z): t.TAKEN[t.ij(x, z)] = 2
t.run()
print(collections.Counter(e["kind"] for e in t.plan), [e.get("name") for e in t.plan if e["kind"] == "civic"])
os.makedirs(out, exist_ok=True); t.write(out); t.picture(out)
print("world blocks", t.write_worldblocks(out))
for x, y, z in t.rails_in_view():                                       # preview only, after the world blocks
    k, d = t.rail_shape[(x, y, z)]; t.works[(x, y, z)] = ("siege:track_preview", {"kind": k, "dir": d})
print("scene", t.scene(out))
