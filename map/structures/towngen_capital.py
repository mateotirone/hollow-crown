"""Kingsrest with every current building (preview of the full capital, not the plots-only world bake).

    python3 towngen_capital.py SLICE.npz lines.json OUT [--seed 13] [--reserve rail-corridor-cells.json]
            [--trees TREEDB/trees.json --trees-src TREES_DIR]

SLICE: terrain_slice.py MAP_DIR -236 -226 221, then slice_heights.py on the pre-town heights. The capital hall
(85x39) only fits the flat ground south of the square, so the ward is centred at (-125, -115).
"""
import sys, os, json, math, argparse, collections, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import towngen as TG, capital, vale_civic, vale
ap = argparse.ArgumentParser(); ap.add_argument("slice"); ap.add_argument("lines"); ap.add_argument("out")
ap.add_argument("--seed", type=int, default=13); ap.add_argument("--reserve", default=""); ap.add_argument("--trees", default="")
ap.add_argument("--trees-src", default=os.path.join(HERE, "..", "trees"))
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
        self.claims = []
        for k, (name, mk) in enumerate(self.makers()):
            bp = mk(); bp.kind = "civic"
            e = self.capital_spot(bp) if name == "capital hall" else self.search(bp, k, rmax=24, relief=7)
            if e: self.claims.append((name, mk, e["rotation"], tuple(e["door"]), self.footprint(bp, e["rotation"])[0], (e["x"], e["z"])))
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
    def run(self):
        self.square(); self.claim()
        self.streets(); self.relax(); self.grade_verges()
        self.portions(); self.place_square_buildings()
        self.houses(); self.relax(); self.windmills(); self.field_paths(); self.fences(); self.fields()
        self.dress(); self.roof_colours(); self.path_blocks(); self.ground_blocks(); self.banks()
        self.works = {(int(x), int(y), int(z)): v for (x, y, z), v in self.works.items()}
        for e in self.plan:
            for k in ('x', 'z', 'ground_y', 'rotation', 'footprint'): e[k] = int(e[k])

site = dict(centre=(-125, -115), radius=90, size="town", square_at=(-100, -128), square_r=9, seed=seed, build_u=0.9,
            roofs={"warm red": 5, "slate": 4, "dark shingle": 1}, accent="copper",
            civic=[("guildhall", vale_civic.guildhall), ("chapel", vale_civic.chapel)])
T = np.load(a.slice); L = json.load(open(a.lines))
if a.trees:
    TG.Town.tree_index = json.load(open(a.trees)); TG.Town.tree_dir = os.path.dirname(os.path.abspath(a.trees)); TG.Town.tree_src = os.path.abspath(a.trees_src)
t = Capital("Kingsrest", site, T, L, seed)
for x, z in (json.load(open(a.reserve)) if a.reserve else []):          # the rail corridor stays clear
    if t.ok(x, z): t.TAKEN[t.ij(x, z)] = max(int(t.TAKEN[t.ij(x, z)]), 1)
t.run()
print(collections.Counter(e["kind"] for e in t.plan), [e.get("name") for e in t.plan if e["kind"] == "civic"])
os.makedirs(out, exist_ok=True); t.write(out); t.picture(out)
print("world blocks", t.write_worldblocks(out)); print("scene", t.scene(out))
