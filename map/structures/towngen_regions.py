"""The four region map towns: Rimehold (Frostmarch), Gull's Rest (Saltreach), Sunscar (Emberwaste) and
Mirelight (Blackfen), laid out by towngen with each region's own buildings (regions_towns.py, PR #89).

    python3 towngen_regions.py SITE SLICE.npz LINES.json OUT [--trees trees.json --trees-src map/trees]

SITE is rimehold, gulls_rest, sunscar or mirelight. Plan the slice on the world's exact ground first
(terrain_slice.py, then slice_heights.py with hollow-crown-full-map-heights-pretown.npy).

Same pipeline and rules as towngen.py: paths first and sunk half a slab, buildings on the highest ground
block they cover with stone foundation below, land portions decided whole as build or field, fields
watered level by level. On top of that, per region:
  * houses from HOUSES[region] (tier 0 by the square .. 3 barns), civic buildings from CIVIC[town] round
    the square, roof colours from the town's mix (ROOF_MIX, assign_roofs + recolour_roof) with the
    neighbour rule;
  * buildings from SHORE[town] where the town meets water: land door on the street side, the part past
    markers["water_edge"] over the water (Mirelight's stilt houses on its river; Gull's Rest's quay,
    lighthouse and boathouse only if its ward reaches the sea, which today it does not);
  * Mirelight's paths over water are mangrove boardwalks on mangrove log piles (BOARDWALK);
  * street paving and crops in each region's own materials.

Writes OUT/<town>-plan.json, OUT/<town>-groundwork.json, OUT/stamps/, OUT/<town>-plan.png (as towngen).
"""
import os, sys, json, math, random, argparse, collections
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from bp import Blueprint
import towngen as TG
from towngen import Town, ROT, rot_xz, snap_rot
import regions_towns as RT
import settle_halls as SH
HALLS = {"frost": SH.frost_hall, "salt": SH.salt_hall, "ember": SH.ember_hall, "fen": SH.fen_hall}
WALL_STONE = {"salt": [("stone_bricks", 4), ("smooth_sandstone", 3), ("andesite", 2), ("cut_sandstone", 1)],
              "frost": [("cobbled_deepslate", 5), ("deepslate_bricks", 3), ("stone_bricks", 2)],
              "ember": [("red_sandstone", 5), ("smooth_red_sandstone", 3), ("cut_red_sandstone", 2)],
              "fen": [("mud_bricks", 5), ("mossy_cobblestone", 3), ("mossy_stone_bricks", 2)]}
RT_REGION_NAME = {"frost": "frostmarch", "salt": "saltreach", "ember": "emberwaste", "fen": "blackfen"}

# centres and wards from map/town-sites.json (the square genworld writes) and plots/config.js WARDS
REGION_SITES = {
    "rimehold":   dict(name="Rimehold", centre=(-80, -1080), radius=70, seed=31),
    # Mateo 2026-11-12: Gull's Rest moves down to the coast and gets a real harbour (harbour.py)
    "gulls_rest": dict(name="Gull's Rest", centre=(-865, 405), radius=85, seed=41, harbour=True, square_at=(-910, 403), build_u=1.6, lanes=12,
                       station=((-781, 400), 270), wall=True),    # where the lines leave east; the map thread fixes the exact spot
    "sunscar":    dict(name="Sunscar", centre=(850, 450), radius=80, seed=61, wall=True,
                       avenue=((850, 457), (850, 547)), avenue_statues=32,
                       road_to=(734, 450)),   # the station the map thread set west of the ward (2026-11-13): a gate and a street out to it   # a walled "desert fortress town"; the statue avenue to the Faceless Gate (z 547)
    "mirelight":  dict(name="Mirelight", centre=(-60, 900), radius=70, seed=51),
}

# street paving per region: every block has a slab (the walking surface is a slab)
PAVE = {
    "frost": {"main": [("cobbled_deepslate", 40), ("deepslate_brick", 25), ("stone_brick", 20), ("cobblestone", 15)],
              "lane": [("cobbled_deepslate", 45), ("cobblestone", 35), ("deepslate_brick", 20)],
              "walk": [("deepslate_brick", 50), ("cobbled_deepslate", 50)],
              "square": [("polished_deepslate", 35), ("deepslate_brick", 30), ("deepslate_tile", 20), ("cobbled_deepslate", 15)]},
    "salt":  {"main": [("andesite", 30), ("stone_brick", 25), ("cobblestone", 25), ("polished_diorite", 20)],
              "lane": [("andesite", 40), ("cobblestone", 35), ("diorite", 25)],
              "walk": [("polished_diorite", 50), ("stone_brick", 50)],
              "square": [("polished_diorite", 35), ("smooth_sandstone", 30), ("stone_brick", 20), ("andesite", 15)]},
    "ember": {"main": [("sandstone", 35), ("smooth_sandstone", 25), ("red_sandstone", 20), ("cut_sandstone", 20)],
              "lane": [("sandstone", 50), ("red_sandstone", 30), ("smooth_red_sandstone", 20)],
              "walk": [("cut_sandstone", 50), ("smooth_sandstone", 50)],
              "square": [("cut_sandstone", 35), ("smooth_sandstone", 30), ("cut_red_sandstone", 20), ("sandstone", 15)]},
    "fen":   {"main": [("mud_brick", 40), ("mossy_cobblestone", 30), ("cobblestone", 30)],
              "lane": [("mud_brick", 50), ("mossy_cobblestone", 50)],
              "walk": [("mangrove", 70), ("mud_brick", 30)],
              "square": [("mud_brick", 45), ("mossy_stone_brick", 25), ("stone_brick", 20), ("mossy_cobblestone", 10)]},
}
FULL = {"cobbled_deepslate": "cobbled_deepslate", "deepslate_brick": "deepslate_bricks", "deepslate_tile": "deepslate_tiles",
        "polished_deepslate": "polished_deepslate", "polished_diorite": "polished_diorite", "diorite": "diorite",
        "smooth_sandstone": "smooth_sandstone", "sandstone": "sandstone", "red_sandstone": "red_sandstone",
        "cut_sandstone": "cut_sandstone", "smooth_red_sandstone": "smooth_red_sandstone", "cut_red_sandstone": "cut_red_sandstone",
        "mangrove": "mangrove_planks"}
CROPS = {"frost": [("potatoes", 40, (5, 7)), ("beetroot", 35, (5, 7)), ("wheat", 25, (5, 7))],
         "salt":  [("wheat", 40, (5, 7)), ("carrots", 30, (5, 7)), ("beetroot", 30, (5, 7))],
         "ember": [("wheat", 50, (5, 7)), ("beetroot", 50, (5, 7))],
         "fen":   [("potatoes", 40, (5, 7)), ("carrots", 30, (5, 7)), ("beetroot", 30, (5, 7))]}


class RegionTown(Town):
    def __init__(self, key, T, L, seed=None):
        s = REGION_SITES[key]; self.town = key; self.region = RT.TOWN_REGION[key]
        site = dict(centre=s["centre"], radius=s["radius"], size="town", fixed_square=True, square_r=6, square_at=s.get("square_at"),
                    seed=s["seed"] if seed is None else seed, region=self.region, civic=[], build_u=s.get("build_u", 0.55), lanes=s.get("lanes"))
        super().__init__(s["name"], site, T, L, site["seed"])
        self.key = key

    def u(self, x, z):
        """A harbour town's square is on its water edge, so the town reaches twice as far from it: tiers by
        half the distance (houses all the way up the slope, barns only at the top)."""
        d = super().u(x, z)
        return d * 0.5 if REGION_SITES[self.key].get("harbour") else d

    def houses(self):
        super().houses()
        if REGION_SITES[self.key].get("harbour"):           # a second, tighter sweep: harbour towns are packed
            for rd in [r for r in self.roads if r["kind"] in ("main", "lane")]:
                for side in (1, -1):
                    self.place_along(rd, side, lambda x, z: (0 if self.u(x, z) < 0.3 else 1 if self.u(x, z) < 0.6 else 2) if self.ok(x, z) and self.at(self.PKIND, x, z) == 1 else None,
                                     setbacks=(1, 2, 3, 5), gap_rng=(0, 1))

    # ---- buildings
    def pick_building(self, tier, kinds=None):
        sd = self.seed * 1000 + len(self.plan) * 7 + self.rng.randint(0, 999)
        rnd = random.Random(sd)
        bp = RT.HOUSES[self.region](sd, rnd, min(tier, 3))
        if not getattr(bp, "kind", None) or bp.kind not in ("house",): bp.kind = "house" if tier < 3 else "barn"
        return bp

    def hall_first(self):
        """The town hall claims its ground facing the square before the streets go down (level 5, the biggest,
        so every level fits), and the streets go round it."""
        hall = HALLS[self.region]; bp = hall(5); bp.kind = "civic"; self.hall_entry = None
        best = None
        for k in range(96):
            a = 2 * math.pi * (k / 96)
            for extra_r in range(1, 26, 2):
                rr = self.sqR + 1 + extra_r
                x, z = int(round(self.sq[0] + math.cos(a) * rr)), int(round(self.sq[1] + math.sin(a) * rr))
                deg = snap_rot(self.sq[0] - x, self.sq[1] - z)
                snap = ({n: getattr(self, n).copy() for n in ("G", "K", "TAKEN", "EAVES", "FIX", "DOORWALK")}, dict(self.works), len(self.plan))
                e = self.try_place(bp, deg, (x, z), "civic", gap=1, max_relief=8, need_walk=False)
                if e:
                    sc = e.get("foundation", 9) + 0.15 * extra_r
                    if best is None or sc < best[0]: best = (sc, deg, (x, z))
                arr, works, n_plan = snap
                for n, v in arr.items(): setattr(self, n, v)
                self.works = works; del self.plan[n_plan:]
                if e: break
        if not best: print("no room for town hall"); return
        e = self.try_place(bp, best[1], best[2], "civic", gap=1, max_relief=8, need_walk=False)
        e["name"] = "town hall"; self.hall_entry = (e, best[1], best[2])
        g, _ = self.footprint(bp, best[1])
        for gx, gz in g:
            for dx in (-2, -1, 0, 1, 2):
                for dz in (-2, -1, 0, 1, 2):
                    c = (gx + e["x"] + dx, gz + e["z"] + dz)
                    if self.ok(*c): self.TAKEN[self.ij(*c)] = 2
        self.add_levels("town hall", e, [(f"Level {L}", hall(L)) for L in range(1, 5)] + [("Level 5", self.designs[e["stamp"]])])

    def hall_road(self):
        """From the hall's door straight across to the square."""
        if not getattr(self, "hall_entry", None): return
        e, deg, door = self.hall_entry; f = ROT[deg]
        for t in range(1, 40):
            c = (door[0] + f[0] * t, door[1] + f[1] * t)
            if not self.ok(*c): break
            if self.at(self.K, *c) >= 0:
                self.lay([(door[0] + f[0] * k, door[1] + f[1] * k) for k in range(t + 1)], "main", k_start=2 * e["ground_y"] + 1, k_end=int(self.at(self.K, *c))); return

    def place_square_buildings(self):
        """The town's civic buildings round the square, facing in (biggest first)."""
        hall = HALLS[self.region]
        makers = list(RT.CIVIC.get(self.town, []))          # (the town hall claimed its ground first: hall_first)
        built = [(name, mk()) for name, mk in makers]
        built.sort(key=lambda t: -len(t[1].cells))
        import story_builds
        for name, bp in built:
            bp.kind = "civic"; done = None
            if name in story_builds.NEAR:                     # placed by what it serves (the net sheds: the lake)
                done = self.civic_on_street(bp, name, near=story_builds.NEAR[name])
                if not done: print("no room for", name)
                continue
            for k in range(72):
                a = 2 * math.pi * (k * 0.618 % 1)
                for extra_r in ((1, 2, 3, 5, 7, 9, 11, 13, 15) if name == "town hall" else (1, 2, 3, 5, 7)):
                    rr = self.sqR + 1 + extra_r
                    x, z = self.sq[0] + math.cos(a) * rr, self.sq[1] + math.sin(a) * rr
                    deg = snap_rot(self.sq[0] - x, self.sq[1] - z)
                    done = self.try_place(bp, deg, (int(round(x)), int(round(z))), "civic", gap=1, max_relief=8 if name == "town hall" else 6)
                    if done: done["name"] = name; break
                if done: break
            if not done: done = self.civic_on_street(bp, name)
            if not done and name == "breeder's post":         # a paddock takes rougher ground (Mirelight's fen)
                done = self.civic_on_street(bp, name, near=self.sq, relief=10)   # near: out to the town edge too
            if not done: print("no room for", name)
            elif name == "town hall": self.add_levels("town hall", done, [(f"Level {L}", hall(L)) for L in range(1, 6)])

    def harbour(self):
        """Gull's Rest: quay, breakwaters, basin, jetty, lighthouse, hut, crane, boathouse (harbour.py); the
        promenade along the quay is a main street joined to the square, so the town's streets meet it."""
        import harbour as HB
        prom = HB.build(self)
        self.lay(prom, "main", k_start=2 * HB.TOP + 2, k_end=2 * HB.TOP + 2)
        sq = min(prom, key=lambda c: abs(c[1] - self.sq[1]))
        link = [(x, sq[1]) for x in range(sq[0], self.sq[0] - self.sqR + 1)]
        self.lay(link, "main", k_start=2 * HB.TOP + 2, k_end=self.k_at(*link[-1]) if self.k_at(*link[-1]) >= 0 else 2 * HB.TOP + 2)
        self.harboured = True

    def shore(self):
        """SHORE buildings where land meets water inside the ward: front (land door) away from the water,
        everything past markers["water_edge"] standing over water."""
        makers = RT.SHORE.get(self.town, [])
        if not makers or getattr(self, "harboured", False): return
        wet = self.WET & self.IN
        if not wet.any(): print("no water inside the ward for", [n for n, _ in makers]); return
        edge = []
        for i, j in np.argwhere(~self.WET & self.IN & (self.K < 0)):
            if not wet[max(0, i - 1):i + 2, max(0, j - 1):j + 2].any(): continue
            w = np.argwhere(wet[max(0, i - 4):i + 5, max(0, j - 4):j + 5]) - [min(i, 4), min(j, 4)]
            v = -w.sum(0)
            if not v.any(): continue
            edge.append((int(i) + self.X0, int(j) + self.Z0, snap_rot(v[0], v[1])))
        self.rng.shuffle(edge)
        want = {"mirelight": 4, "gulls_rest": 3}.get(self.town, 3)
        placed = 0
        for n in range(want * 3):
            if placed >= want: break
            name, mk = makers[n % len(makers)]
            bp = mk(seed=self.seed * 100 + n) if name.startswith("stilt") else mk()
            for x, z, deg in edge:
                if self.place_shore(bp, x, z, deg, name): placed += 1; break
        print("shore buildings", placed)

    def place_shore(self, bp, ex, ez, deg, name):
        wx, wy, wz = bp.markers["water_edge"]
        dx, dz = self.door_of(bp)
        land = Blueprint(bp.name + "_land"); water = []
        for (x, y, z), c in bp.cells.items():
            if c[0] == "keep" or y < 0: continue
            if z >= wz: land.set(x, 0, z, "keep_floor")
            else: water.append((x, z))
        land.markers["door"] = bp.markers["door"]
        # put the water edge on the first water cell beyond (ex, ez)
        f = ROT[deg]
        rwx, rwz = rot_xz(wx, wz, deg)
        rdx, rdz = rot_xz(dx, dz, deg)
        W = {rot_xz(x, z, deg) for x, z in water}
        for shift in range(5):                                        # the bank wanders: step inland until the land part is dry
            ox, oz = (ex - f[0] * (1 - shift)) - rwx, (ez - f[1] * (1 - shift)) - rwz
            door = (ox + rdx, oz + rdz)
            nwet, ok = 0, True
            for x, z in W:
                X, Z = x + ox, z + oz
                if not self.inside(X, Z, 1): ok = False; break
                i, j = self.ij(X, Z)
                if self.K[i, j] >= 0 or self.TAKEN[i, j]: ok = False; break
                nwet += bool(self.WET[i, j])
            if not ok or nwet < 0.5 * len(W): continue           # at least half of the piled part stands in the water
            if all(self.ok(x + ox, z + oz) and not self.WET[self.ij(x + ox, z + oz)] for x, z in self.footprint(land, deg)[0]): break
        else:
            return False
        st = self.nearest_street(*door)
        if st is None or math.hypot(st[0] - door[0], st[1] - door[1]) > 24: return False
        e = self.try_place(land, deg, door, "shore", gap=1, max_relief=4, need_walk=False)
        if not e: return False
        self.footpath(door, st)                                        # a path from the land door to the nearest street
        e["stamp"] = bp.name; e["name"] = name; self.designs[bp.name] = bp
        self.designs.pop(land.name, None)
        for x, z in W:
            i, j = self.ij(x + ox, z + oz); self.TAKEN[i, j] = 2
        return True

    def roof_colours(self):
        """The town's mix (ROOF_MIX) in exact counts, then swaps so no house shares its colour with both
        street neighbours; houses were built with the slate sentinel roof and are recoloured here."""
        houses = [e for e in self.plan if e["kind"] == "house"]
        n = len(houses)
        self.roof_counts = {}
        if not n: return
        cols = RT.assign_roofs(self.town, n, self.seed)
        major = max(RT.ROOF_MIX[self.town], key=RT.ROOF_MIX[self.town].get)
        rnd = random.Random(self.seed * 7 + 3)
        P = np.array([e["door"] for e in houses], float)
        nb = []
        for a in range(n):
            d = np.hypot(*(P - P[a]).T); d[a] = 1e9
            nb.append([int(b) for b in np.argsort(d)[:2] if d[b] < 18])
        def bad(a):
            same = sum(cols[b] == cols[a] for b in nb[a])
            return same >= 2 and (cols[a] != major or all(sum(cols[c] == major for c in nb[b]) >= 1 for b in nb[a]))
        for _ in range(400):
            bads = [a for a in range(n) if bad(a)]
            if not bads: break
            a = rnd.choice(bads); far = [b for b in range(n) if b != a and b not in nb[a] and cols[b] != cols[a]]
            if not far: break
            b = rnd.choice(far); cols[a], cols[b] = cols[b], cols[a]
        for e, c in zip(houses, cols):
            e["roof"] = c
            if c == "slate": continue
            bp = self.designs[e["stamp"]]
            nb_ = Blueprint(f"{bp.name}_{c}"); nb_.cells = dict(bp.cells); nb_.markers = dict(bp.markers); nb_.kind = bp.kind
            RT.recolour_roof(nb_, self.region, c, seed=e["x"] * 31 + e["z"])
            self.designs[nb_.name] = nb_; e["stamp"] = nb_.name
        self.roof_counts = dict(collections.Counter(cols))

    # ---- paths
    def path_blocks(self):
        super().path_blocks()
        if self.town != "mirelight": return
        slab, plank, log, fence = RT.BOARDWALK["mirelight"]
        for i, j in np.argwhere((self.K >= 0) & self.WET):          # boardwalks over the river on log piles
            x, z = int(i) + self.X0, int(j) + self.Z0
            for (xx, y, zz) in [(x, y, z) for y in range(int(self.G0[i, j]) - 1, int(self.K[i, j]) // 2 + 1)]:
                v = self.works.get((xx, y, zz))
                if not v: continue
                if v[0] == "stone_brick_slab": self.works[(xx, y, zz)] = (slab, {"half": "bottom"})
                elif v[0] == "stone_bricks": self.works[(xx, y, zz)] = (log, {"axis": "y"}) if y < (int(self.K[i, j]) - 1) // 2 else (plank, {})

    def road_to(self, target):
        """A main street from the slice's edge on the way to target (a station outside the ward) in to the town's
        streets; the wall puts a gate where it crosses, and the map's own road carries on from the edge."""
        tx, tz = target; cx, cz = self.C
        d = math.hypot(tx - cx, tz - cz); ux, uz = (tx - cx) / d, (tz - cz) / d
        f = (-1, 0) if abs(ux) >= abs(uz) and ux > 0 else (1, 0) if abs(ux) >= abs(uz) else (0, -1) if uz > 0 else (0, 1)
        edge = None
        for t in range(int(d) + 1):
            x, z = round(cx + ux * t), round(cz + uz * t)
            if not self.ok(x, z) or not self.inside(x, z, 2): break
            edge = (x, z)
        if not edge: return
        self.station_front = (edge, f, int(self.G0[self.ij(*edge)]))
        self.station_road(); self.station_front = None
        print("road to", target, "from", edge)

    def run(self):
        self.square()
        if REGION_SITES[self.key].get("harbour"): self.harbour()
        st = REGION_SITES[self.key].get("station")
        if st: self.station_site(st[0], st[1], RT_REGION_NAME[self.region])
        self.hall_first()
        if REGION_SITES[self.key].get("avenue"):
            self.site.update({k: REGION_SITES[self.key][k] for k in ("avenue", "avenue_statues")}); self.avenue()
        self.streets()
        if st: self.station_road()
        if REGION_SITES[self.key].get("road_to"): self.road_to(REGION_SITES[self.key]["road_to"])
        self.hall_road(); self.relax(); self.grade_verges()
        self.portions()
        self.place_square_buildings()
        self.shore()
        self.houses(); self.relax()
        self.windmills()
        self.terraform()
        self.field_paths()
        self.fences()
        self.fields()
        self.dress()
        self.roof_colours()
        self.path_blocks(); self.ground_blocks(); self.banks(); self.avenue_statues()
        if REGION_SITES[self.key].get("wall"):
            self.WALL_STONE = WALL_STONE[self.region]
            if not getattr(self, "wall_region", None): self.wall_region = RT_REGION_NAME[self.region]   # towers and gatehouses in the region's style
            self.town_wall()
        self.works = {(int(x), int(y), int(z)): v for (x, y, z), v in self.works.items()}
        for e in self.plan:
            for k in ('x', 'z', 'ground_y', 'rotation', 'footprint'): e[k] = int(e[k])
        c = collections.Counter(p["kind"] for p in self.plan)
        print(self.name, dict(c), "roofs", self.roof_counts, "fields", self.nparcel, "dry", getattr(self, "unwatered", 0), "groundwork", len(self.works))


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("site", choices=list(REGION_SITES)); ap.add_argument("slice"); ap.add_argument("lines"); ap.add_argument("out")
    ap.add_argument("--seed", type=int, default=None)
    ap.add_argument("--trees", default=""); ap.add_argument("--trees-src", default=os.path.join(HERE, "..", "trees"))
    a = ap.parse_args()
    region = RT.TOWN_REGION[a.site]
    TG.PAVE.update(PAVE[region]); TG.FULL.update(FULL); TG.CROPS[:] = CROPS[region]
    T = np.load(a.slice); L = json.load(open(a.lines))
    if a.trees:
        Town.tree_index = json.load(open(a.trees)); Town.tree_dir = os.path.dirname(os.path.abspath(a.trees)); Town.tree_src = os.path.abspath(a.trees_src)
    t = RegionTown(a.site, T, L, a.seed); t.run()
    os.makedirs(a.out, exist_ok=True); t.write(a.out); t.picture(a.out)
    print("world blocks", t.write_worldblocks(a.out))
    print("scene blocks", t.scene(a.out))


if __name__ == "__main__":
    main()
