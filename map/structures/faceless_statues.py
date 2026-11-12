"""The Faceless Gate's avenue statues (Mateo, 2026-11-12: the old ones were thin 5-block posts): robed, hooded,
faceless figures twice a man's height and more, worn by the sand, on stepped plinths. Built with the
minecraft-builder engine from a shape spec, so the robe, hood and sleeves come out in slabs and stairs.

    spec(variant)                              the engine spec of one standing figure, facing +z (south)
    cells(variant, facing, fallen=False)       {(x, y, z): (block, props)} about the plinth's centre, y 0 = ground
    put(d, cells, x, y, z)                     into a landmarks.D design at (x, y, z)

Variants: "staff" (a tall staff in the right hand), "folded" (hands folded on the chest), "bowl" (a bowl held out),
"broken" (the hood snapped off at the neck). Every figure is faceless: the hood's opening is a smooth, blank
quartz plane, the same as the great seated figure. A fallen figure lies on its back along its facing, broken in
two at the knees, half sunk in the sand.
"""
import math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SKILL = os.path.join(HERE, "..", "..", ".claude", "skills", "minecraft-builder", "scripts")
if SKILL not in sys.path: sys.path.insert(0, SKILL)

PLINTH_H = 2          # stepped plinth: 9x9 footing, 7x7 die
TOP = 22              # the hood's crown, from the ground
STONE = {"ladder": ["cut_sandstone", "sandstone", "smooth_sandstone"], "axis": "noise", "scale": 3}
ROBE = {"ladder": ["sandstone", "smooth_sandstone", "cut_sandstone"], "axis": "y", "noise": 0.25, "jitter": 0.08}


def _h(*k):
    x = 0
    for v in k: x = (x * 73856093) ^ (int(v) * 19349663 + 83492791)
    x = (x ^ (x >> 13)) * 1274126177
    return ((x ^ (x >> 16)) & 0xFFFF) / 65535.0


def spec(variant="folded", seed=1):
    y0 = PLINTH_H
    shapes = [
        {"shape": "box", "min": [-4, 0, -4], "max": [4, 0, 4], "material": "plinth"},
        {"shape": "box", "min": [-3, 1, -3], "max": [3, 1, 3], "material": "plinth"},
        # the robe: wide at the hem, gathered at the waist, out again over the chest
        {"shape": "lathe", "at": [0, y0, 0], "profile": [[0, 3.2], [1, 3.0], [5, 2.4], [8, 2.2], [11, 2.5], [13, 2.8], [14, 2.0], [14.6, 0]], "material": "robe"},
        {"shape": "ellipsoid", "at": [0, y0 + 13, 0], "r": [3.8, 1.6, 2.4], "material": "robe"},           # shoulders
        # the hood: an egg over the head, its opening cut flat and set back, a blank face inside
        {"shape": "egg", "at": [0, y0 + 16.5, -0.3], "R": 2.3, "H": 3.3, "k": -0.12, "material": "robe"},
        {"op": "sub", "shape": "box", "min": [-1, y0 + 15, 2], "max": [1, y0 + 17, 4]},
        # sleeves hanging from the shoulders, the forearms across the chest
        {"shape": "box", "min": [-4, y0 + 8, -1], "max": [-3, y0 + 12, 1], "material": "robe"},
        {"shape": "box", "min": [3, y0 + 8, -1], "max": [4, y0 + 12, 1], "material": "robe"},
        {"shape": "box", "min": [-3, y0 + 8, 2], "max": [3, y0 + 9, 3], "material": "robe"},
        # folds down the front of the robe
        {"op": "paint", "shape": "box", "min": [-2, y0, 1], "max": [-2, y0 + 7, 4], "material": "fold"},
        {"op": "paint", "shape": "box", "min": [1, y0, 1], "max": [1, y0 + 7, 4], "material": "fold"},
        {"op": "paint", "shape": "box", "min": [-4, 0, -4], "max": [4, y0, 4], "material": "dust"},
    ]
    place = [[x, y0 + 15 + j, 1, "smooth_quartz"] for x in (-1, 0, 1) for j in (0, 1, 2)]   # the blank face
    if variant == "staff":
        place += [[4, y, 2, "sandstone_wall"] for y in range(y0, y0 + 17)]
        place += [[4, y0 + 17, 2, "chiseled_sandstone"], [4, y0 + 18, 2, "sandstone_wall"]]
    elif variant == "bowl":
        place += [[x, y0 + 9, 4, "smooth_sandstone_slab", {"half": "top"}] for x in (-1, 0, 1)]
        place += [[x, y0 + 10, 4, "cut_red_sandstone_slab", {"half": "bottom"}] for x in (-1, 1)]
        place += [[0, y0 + 10, 4, "cut_red_sandstone"]]
    elif variant == "broken":
        shapes.append({"op": "sub", "shape": "plane", "at": [0, y0 + 14.2, 0], "normal": [0.3, -1, 0.15]})
        place = []
    # wear: a few chips out of the hem and the hood's rim
    for k in range(5):
        a = _h(seed, k, 1) * math.tau; hi = k >= 3
        y = y0 + (14 + 2 * _h(seed, k, 2) if hi else 0.5 + 3 * _h(seed, k, 2)); r = 2.3 if hi else 3.1
        shapes.append({"op": "sub", "shape": "sphere", "at": [round(math.cos(a) * (r + 0.4), 1), round(y, 1), round(math.sin(a) * (r + 0.4), 1)], "r": 0.8})
    return {"name": f"faceless_statue_{variant}", "edition": "bedrock",
            "materials": {"plinth": STONE, "robe": ROBE, "fold": "cut_sandstone", "dust": {"ladder": ["sandstone", "smooth_sandstone"], "axis": "noise", "scale": 2}},
            "shapes": shapes, "place": place}


_ROT = {"s": 0, "w": 1, "n": 2, "e": 3}
_DIR = ["s", "w", "n", "e"]


def _turn(x, z, q):
    """A quarter turn clockwise seen from above: south-facing -> west-facing."""
    return -z, x, q


def cells(variant="folded", facing="s", fallen=False, seed=1):
    import engine
    blocks, _, _ = engine.compute(spec(variant, seed))
    out = {}
    for (x, y, z), (n, q) in blocks.items():
        q = dict(q)
        if fallen:
            if y < PLINTH_H: continue                                  # the plinth stays behind, elsewhere
            n = n.replace("_stairs", "").replace("_slab", "").replace("_wall", "")
            n = {"smooth_sandstone": "smooth_sandstone", "cut_red_sandstone": "cut_red_sandstone", "end_rod": "sand"}.get(n, n)
            if n == "sandstone_wall": n = "sandstone"
            q = {}
            yy = y - PLINTH_H
            # toppled onto its side, head to the north: height -> -z, width -> up, depth -> x; broken at the knees,
            # the top half slid a block on; sunk a block into the sand
            if yy == 4: continue
            nx, ny, nz = z, x + 3, -yy
            if yy > 4: nx += 1; nz -= 1
            out[(nx, ny, nz)] = (n, q)
            continue
        out[(x, y, z)] = (n, q)
    turns = _ROT[facing]
    for _ in range(turns):
        nxt = {}
        for (x, y, z), (n, q) in out.items():
            q = dict(q)
            if "facing" in q and q["facing"] in _ROT: q["facing"] = _DIR[(_ROT[q["facing"]] + 1) % 4]
            if "axis" in q and q["axis"] in ("x", "z"): q["axis"] = "z" if q["axis"] == "x" else "x"
            nx, nz, _ = _turn(x, z, q)
            nxt[(nx, y, nz)] = (n, q)
        out = nxt
    return out


AVENUE = [("staff", "w", 7, 21), ("folded", "e", -7, 21), ("bowl", "w", 7, 29), ("broken", "e", -7, 29)]
FALLEN = [("folded", 15, -6), ("staff", -15, -6), ("bowl", 15, 33), ("folded", -15, 33)]


def avenue(d, ground=lambda x, z: 0):
    """The eight statues of the processional way: four standing either side of it south of the scarab court
    (plans.js ASH_SAND, (0, 11) r 9, stays open), four toppled along the precinct's sides."""
    for k, (v, f, x, z) in enumerate(AVENUE):
        put(d, cells(v, f, seed=11 + k), x, ground(x, z), z)
        if v == "broken":   # its hood lies at its feet, face up
            for (hx, hy, hz), (n, q) in cells("folded", "s", fallen=True, seed=19).items():
                if hz <= -16: put(d, {(hx, hy, hz): (n, {})}, x + (3 if x < 0 else -3) - hx * 0, ground(x, z), z + 22)
    for k, (v, x, z) in enumerate(FALLEN):
        put(d, cells(v, "s", fallen=True, seed=31 + k), x, ground(x, z), z)


def put(d, cs, x0, y0, z0):
    for (x, y, z), (n, q) in cs.items():
        d.put(x0 + x, y0 + y, z0 + z, n, **q)


if __name__ == "__main__":
    import json
    out = sys.argv[1] if len(sys.argv) > 1 else "statues"
    os.makedirs(out, exist_ok=True)
    for v in ("staff", "folded", "bowl", "broken"):
        json.dump(spec(v), open(os.path.join(out, f"{v}.json"), "w"), indent=1)
    print("wrote", out)
