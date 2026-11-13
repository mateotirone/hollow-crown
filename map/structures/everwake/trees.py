"""Trees for Everwake and the air boat station, from the tree database (map/trees; Mateo 2026-11-13: "we need
some trees", at the station and in the city's squares and courtyards).

The stamps (/mnt/project-files/trees/db or map/trees build output) use the unbreakable siege:old_* blocks; here they
turn back into vanilla names for the 3D pages. In game the same spots get the stamps themselves.

    python3 trees.py scene.json out.json city|station [DB]
"""
import json, math, os, random, sys

DB = "/mnt/project-files/trees/db"
DIRS = {0: "n", 1: "e", 2: "s", 3: "w"}
AXES = {0: "y", 1: "x", 2: "z"}


def stamp_cells(species, size, variant=0, db=DB):
    """(dx, dy, dz) -> (vanilla name, logical props), y 0 = the ground surface (left out: the paving stays)."""
    d = json.load(open(os.path.join(db, species, f"{species}_{size}_{variant}.stamp.json")))
    ox, oy, oz = d["origin"]
    out = {}
    for x, y, z, i in d["blocks"]:
        p = d["palette"][i]; n = p["name"].split(":")[-1].replace("old_", "", 1) if p["name"].startswith("siege:old_") else p["name"].split(":")[-1]
        s = p.get("states", {}); q = {}
        if "siege:axis" in s: q["axis"] = AXES[s["siege:axis"]]
        if n.endswith("_stairs"): q = {"facing": DIRS[s.get("siege:dir", 0)], "half": "top" if s.get("siege:top") else "bottom"}
        elif n.endswith("_slab"): q = {"type": "top" if s.get("siege:top") else "bottom"}
        elif n.endswith("_trapdoor"): q = {"facing": DIRS[s.get("siege:dir", 0)], "half": "top" if s.get("siege:top") else "bottom", "open": bool(s.get("siege:open"))}
        elif n.endswith("_fence") or n.endswith("_wall"):
            q = {"conn": {k: bool(s.get("siege:" + k)) for k in "nesw"}}
            if n.endswith("_wall"): q["post"] = bool(s.get("siege:post", 1))
        elif n == "vine": continue
        if y + oy <= 0 and n in ("dirt_with_roots", "podzol", "coarse_dirt", "leaf_litter", "grass_block", "dirt", "moss_carpet"): continue
        out[(x + ox, y + oy, z + oz)] = (n, q)
    return out


def load(scene):
    d = json.load(open(scene))
    return {(x, y, z): tuple(d["palette"][i]) if isinstance(d["palette"][i], list) else (d["palette"][i], {}) for x, y, z, i in d["blocks"]}


def save(cells, path, camera=None):
    pal, idx, blocks = [], {}, []
    for (x, y, z), (n, p) in cells.items():
        k = json.dumps([n, p], sort_keys=True)
        if k not in idx: idx[k] = len(pal); pal.append([n, p])
        blocks.append([x, y, z, idx[k]])
    json.dump({"palette": pal, "blocks": blocks, **({"camera": camera} if camera else {})}, open(path, "w"))


def plant(cells, at, species, size, variant, ground_y, db=DB):
    """Put one tree with its ground row on ground_y + 1; only into empty cells (it never cuts a building)."""
    x0, z0 = at; n = 0
    for (dx, dy, dz), b in stamp_cells(species, size, variant, db).items():
        c = (x0 + dx, ground_y + dy, z0 + dz)
        if c not in cells: cells[c] = b; n += 1
    return n


def tops(cells):
    t = {}
    for (x, y, z), (n, _p) in cells.items():
        if (x, z) not in t or y > t[(x, z)][0]: t[(x, z)] = (y, n)
    return t


def city_spots(cells, rng, want=26):
    """Open paving away from walls and off the streets: squares, courtyards, the wide plazas by the towers.
    Small trees only (young silver birch, whose white bark suits the city, and young hawthorn)."""
    t = tops(cells)
    spots = []
    cand = [(x, z) for (x, z), (y, n) in t.items() if y == -1 and n != "polished_andesite" and 14 < math.hypot(x, z) < 84]
    rng.shuffle(cand)
    for x, z in cand:
        ok = all(t.get((x + dx, z + dz), (99, ""))[0] == -1 for dx in range(-3, 4) for dz in range(-3, 4)) and \
            all(t[(x + dx, z + dz)][1] != "polished_andesite" for dx in range(-1, 2) for dz in range(-1, 2))   # clear of walls; may stand by a street
        if not ok or any(math.hypot(x - a, z - b) < 11 for a, b in spots): continue
        spots.append((x, z))
        if len(spots) >= want: break
    return spots


STATION = [  # (x, z, species, size): a ring of old trees round the grounds, an orchard by the hall, birches by the road
    (-40, -18, "vale_great_oak", "mature"), (-26, -24, "vale_ash", "mature"), (-10, -26, "vale_great_oak", "mature"),
    (12, -22, "vale_silver_birch", "mature"), (26, -16, "vale_ash", "mature"), (34, 4, "vale_great_oak", "mature"),
    (28, 22, "vale_hawthorn", "mature"), (12, 28, "vale_silver_birch", "mature"), (-8, 26, "vale_great_oak", "mature"),
    (-24, 22, "vale_apple", "mature"), (-31, 16, "vale_apple", "mature"), (-17, 16, "vale_apple", "mature"), (-24, 13, "vale_apple", "young"),
    (-42, 12, "vale_silver_birch", "young"), (-38, -8, "vale_silver_birch", "young"), (20, -32, "vale_yew", "mature"),
]


def main():
    scene, out, which = sys.argv[1:4]
    db = sys.argv[4] if len(sys.argv) > 4 else DB
    cells = load(scene); rng = random.Random(7); n = 0
    if which == "city":
        for k, (x, z) in enumerate(city_spots(cells, rng)):
            sp = "vale_silver_birch" if k % 3 else "vale_hawthorn"
            n += plant(cells, (x, z), sp, "young", k % 5, -1, db)
    else:
        for k, (x, z, sp, size) in enumerate(STATION):
            for dz in (0, 110):                                           # the restored station and the ruin beside it
                n += plant(cells, (x, z + dz), sp, size, k % 5, -1, db)
    save(cells, out, json.load(open(scene)).get("camera"))
    print("tree blocks", n)


if __name__ == "__main__":
    main()
