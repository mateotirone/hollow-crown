"""Plots-only towns: streets, levelled empty building plots with an outlined edge, fields and trees,
no buildings (Mateo 2026-11-11: build the map's centre out "just as plots" for now).

    python3 towngen_plots.py SITE SLICE.npz LINES.json OUT [--reserve cells.json] [--trees trees.json --trees-src map/trees]

Same pipeline as towngen.py (paths first, sunk half a slab; land portions decided whole as build or
field; floor heights balance cut and fill; fields watered level by level). Where towngen drops a
house, this lays out a plot of the size that house would have had (Small 7, Medium 11, Large 15,
Great 21; the long side may be 2 more), levelled to its floor height with a foundation on the low
side, its edge marked with a course of stone, and a walkway from its door side down to the street.
Civic plots round the square are Large or Great.

--reserve: JSON list of [x, z] world cells kept free of plots and fields (rail station corridors);
streets may cross them.

Writes OUT/<town>-plots.json (format hollow-crown-town-plots/1), OUT/<town>-groundwork.json (as
towngen), OUT/<town>-plan.png and scene.json (plots shown as their outline).
"""
import os, sys, json, math, argparse, collections, subprocess
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from bp import Blueprint
import towngen as TG
from towngen import Town, SITES, ROT

SIZES = {"S": 7, "M": 11, "L": 15, "G": 21}
SIZE_NAME = {"S": "Small", "M": "Medium", "L": "Large", "G": "Great"}
EDGE = [("cobblestone", 5), ("stone_bricks", 3), ("mossy_cobblestone", 2)]
PLOT_SITES = {
    # Kingsrest: town circle from plots/config.js TOWNS (-150, -150, r90), square on the plaza WELCOME.kingsrest
    "Kingsrest": dict(centre=(-150, -150), radius=90, size="town", square_at=(-118, -118), square_r=9, seed=7,
                      civic=["G", "L", "L", "L"], build_u=0.8, lanes=12),     # the capital: built up to the edge, a few fields
}


def slot_box(w, d, size):
    bp = Blueprint(f"plot_{w}x{d}")
    for x in range(w):
        for z in range(d): bp.set(x, 0, z, "keep_floor")
    bp.markers["door"] = (w // 2, 1, d); bp.kind = "plot"; bp.size = size
    return bp


class TownPlots(Town):
    def pick_building(self, tier, kinds=None):
        r = self.rng.random()
        size = {0: "M" if r < 0.6 else "L", 1: "S" if r < 0.65 else "M", 2: "S" if r < 0.8 else "M", 3: "M" if r < 0.7 else "L"}[min(tier, 3)]
        n = SIZES[size]; w, d = self.rng.choice([(n, n), (n + 2, n), (n, n + 2)])
        return slot_box(w, d, size)

    def place_square_buildings(self):
        for k, size in enumerate(self.site.get("civic", [])):
            n = SIZES[size]; bp = slot_box(n, n + 2, size); bp.civic = True
            done = None
            for t in range(72):
                a = 2 * math.pi * ((t + k * 17) * 0.618 % 1)
                for extra_r in (1, 2, 3, 5):
                    rr = self.sqR + 1 + extra_r
                    x, z = self.sq[0] + math.cos(a) * rr, self.sq[1] + math.sin(a) * rr
                    deg = TG.snap_rot(self.sq[0] - x, self.sq[1] - z)
                    done = self.try_place(bp, deg, (int(round(x)), int(round(z))), "plot", gap=1, max_relief=6)
                    if done: done.update(size=size, civic=True); break
                if done: break
            if not done: print("no room on the square for a", SIZE_NAME[size], "civic plot")

    def try_place(self, bp, deg, door_xz, kind, **kw):
        if kind not in ("plot",) and getattr(bp, "kind", "") == "plot": kind = "plot"
        e = super().try_place(bp, deg, door_xz, kind, **kw)
        if e and kind == "plot":
            e["size"] = getattr(bp, "size", "S")
            g, _ = self.footprint(bp, deg)
            e["cells"] = [(x + e["x"], z + e["z"]) for x, z in g]
        return e

    def windmills(self):            # a windmill is a building: its field keeps the ground for now
        self.relax()

    def dress(self):
        mid = TG.TB.well(self.seed); self.stamp(mid, self.sq[0], self.sq[1], self.sqY, 0, "square")
        lamp = TG.dressing.lamp()
        for rd in self.roads:
            if rd["kind"] not in ("main", "lane"): continue
            hw = TG.WIDTH[rd["kind"]] / 2.0 + 1
            for t in range(6, len(rd["pts"]) - 3, 13 if rd["kind"] == "main" else 17):
                x, z = rd["pts"][t]; (x0, z0), (x1, z1) = rd["pts"][t - 1], rd["pts"][t + 1]
                d = math.hypot(x1 - x0, z1 - z0) or 1; s = 1 if (t // 13) % 2 else -1
                lx, lz = int(round(x - (z1 - z0) / d * hw * s)), int(round(z + (x1 - x0) / d * hw * s))
                if not self.inside(lx, lz, 2): continue
                i, j = self.ij(lx, lz)
                if self.K[i, j] >= 0 or self.TAKEN[i, j] or self.WET[i, j]: continue
                self.stamp(lamp, lx, lz, int(self.G[i, j]), 0, "lamp"); self.TAKEN[i, j] = 4
        if self.tree_index is not None: self.db_trees()

    def roof_colours(self):
        self.roof_counts = {}

    def outline(self):
        """A course of stone round each plot's edge, flush with its levelled floor."""
        for e in self.plan:
            if e["kind"] != "plot": continue
            cells = set(e["cells"]); y = e["ground_y"]
            for x, z in cells:
                if all((x + dx, z + dz) in cells for dx, dz in ((1, 0), (-1, 0), (0, 1), (0, -1))): continue
                r = TG.h3(x, y, z, 5) * 10
                for m, w in EDGE:
                    r -= w
                    if r < 0: break
                self.works[(x, y, z)] = (m, {})

    def run(self):
        self.square()
        self.streets(); self.relax(); self.grade_verges()
        self.portions()
        self.place_square_buildings()
        self.houses(); self.relax()
        self.field_paths(); self.fences(); self.fields()
        self.dress()
        self.path_blocks(); self.ground_blocks(); self.banks(); self.outline()
        self.works = {(int(x), int(y), int(z)): v for (x, y, z), v in self.works.items()}
        c = collections.Counter(e.get("size") for e in self.plan if e["kind"] == "plot")
        print(self.name, "plots", dict(c), "fields", self.nparcel, "dry", self.unwatered, "trees", sum(1 for e in self.plan if e["kind"] == "tree"), "groundwork", len(self.works))

    def write_plots(self, out):
        os.makedirs(out, exist_ok=True)
        plots = []
        for n, e in enumerate(e for e in self.plan if e["kind"] == "plot"):
            xs, zs = zip(*e["cells"]); f = ROT[e["rotation"]]
            plots.append({"id": f"plot{n + 1}", "size": SIZE_NAME[e["size"]], "civic": bool(e.get("civic")),
                          "box": [min(xs), min(zs), max(xs), max(zs)], "floor_y": int(e["ground_y"]),
                          "door": {"side": {(0, 1): "s", (-1, 0): "w", (0, -1): "n", (1, 0): "e"}[f], "step": e["door"]}})
        fixtures = [{"name": e["kind"], "stamp": e.get("db_stamp", e["stamp"]), "at": [e["x"], e["z"]], "ground_y": e["ground_y"], "rotation": e["rotation"]}
                    for e in self.plan if e["kind"] in ("square", "lamp", "tree")]
        json.dump({"format": "hollow-crown-town-plots/1", "town": self.name, "centre": list(self.C), "radius": self.R,
                   "square": {"centre": list(self.sq), "y": self.sqY, "radius": self.sqR},
                   "about": "World coordinates. Apply the groundwork first (streets, levelled plots with stone edges, foundations, fields), "
                            "then the fixtures (well, lamps, trees). Plots are empty: box = [x0, z0, x1, z1] inclusive at floor_y; "
                            "door.step is the cell outside the door side, where the walkway meets it.",
                   "groundwork": f"{self.key}-groundwork.json", "plots": plots, "fixtures": fixtures,
                   "fields": [{"area": p["area"]} for p in self.port.values() if p["kind"] == "field"]},
                  open(os.path.join(out, f"{self.key}-plots.json"), "w"), indent=1, default=int)
        pal, idx, rows = [], {}, []
        for (x, y, z), (nm, p) in sorted(self.works.items()):
            key = json.dumps([nm, p], sort_keys=True)
            if key not in idx: idx[key] = len(pal); pal.append([nm, p])
            rows.append([x, y, z, idx[key]])
        json.dump({"town": self.name, "format": "hollow-crown-groundwork/1", "note": "world coordinates; place every block as listed (air = dig out)",
                   "palette": pal, "blocks": rows}, open(os.path.join(out, f"{self.key}-groundwork.json"), "w"), separators=(",", ":"), default=int)
        return plots


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("site"); ap.add_argument("slice"); ap.add_argument("lines"); ap.add_argument("out")
    ap.add_argument("--seed", type=int, default=None); ap.add_argument("--reserve", default="")
    ap.add_argument("--trees", default=""); ap.add_argument("--trees-src", default=os.path.join(HERE, "..", "trees"))
    ap.add_argument("--render", action="store_true"); ap.add_argument("--textures", default=""); ap.add_argument("--three", default="")
    ap.add_argument("--shots", default="town,aerial,square,street")
    a = ap.parse_args()
    site = dict(PLOT_SITES.get(a.site) or SITES[a.site]); site.setdefault("civic", ["L", "L"])
    if not all(isinstance(c, str) for c in site["civic"]): site["civic"] = ["L"] * len(site["civic"])
    T = np.load(a.slice); L = json.load(open(a.lines))
    if a.trees:
        Town.tree_index = json.load(open(a.trees)); Town.tree_dir = os.path.dirname(os.path.abspath(a.trees)); Town.tree_src = os.path.abspath(a.trees_src)
    t = TownPlots(a.site, site, T, L, a.seed if a.seed is not None else site.get("seed", 1))
    t.RES = np.zeros(t.G0.shape, bool)
    if a.reserve:
        for x, z in json.load(open(a.reserve)):
            if t.ok(x, z): t.TAKEN[t.ij(x, z)] = max(int(t.TAKEN[t.ij(x, z)]), 1); t.RES[t.ij(x, z)] = True
    t.run(); t.write_plots(a.out); t.picture(a.out)
    for e in t.plan:                               # the scene shows a plot as its outline only
        if e["kind"] == "plot": t.designs[e["stamp"]] = Blueprint("empty_plot"); t.designs["empty_plot"] = t.designs[e["stamp"]]
    print("scene blocks", t.scene(a.out))
    if a.render:
        subprocess.run([sys.executable, os.path.join(HERE, "render", "render.py"), os.path.join(a.out, "scene.json"), a.out,
                        "--title", a.site + " plots", "--blurb", "Streets, levelled plots and fields, no buildings yet.", "--textures", a.textures,
                        "--three", a.three, "--shots", a.shots], check=True)

if __name__ == "__main__":
    main()
