"""The Faceless Gate's avenue statues (Mateo, 2026-11-12: the old ones were thin 5-block posts): robed, hooded,
faceless figures twice a man's height and more, worn by the sand, on stepped plinths. Built with the
minecraft-builder engine from a shape spec, so the robe, hood and sleeves come out in slabs and stairs.

    spec(variant)                              the engine spec of one standing figure, facing +z (south)
    cells(variant, facing, fallen=False)       {(x, y, z): (block, props)} about the plinth's centre, y 0 = ground
    put(d, cells, x, y, z)                     into a landmarks.D design at (x, y, z)
    avenue_cells(points, n=32)                 Sunscar's avenue of King Oswin's statues (towns bake, map/bake_town)

The forty statues (lore/data: Lord Sorrel, Warden Isolde) are one man at every age, boy to old king: 32 line Sunscar's
avenue from the square to the Faceless Gate, the Gate's own 8 make forty. spec_age() draws them smaller (5x5 plinth),
crowned from the young king on, each with the same pale quartz hands ("You can tell from the hands").

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


AGES = {   # scale of the figure, and how it stands: the same man from a boy to an old king (lore: the forty statues)
    "boy": 0.46, "youth": 0.6, "young_king": 0.7, "king": 0.74, "old_king": 0.68,
}


def spec_age(age="king", variant="folded", seed=1):
    """One of the forty statues of King Oswin on Sunscar's avenue: a 5x5 plinth, the figure at his age, faceless,
    and the same pale hands on every one ("You can tell from the hands": Warden Isolde)."""
    k = AGES[age]; y0 = PLINTH_H
    R = lambda v: round(v * k, 2)
    stoop = 0.6 if age == "old_king" else 0.0
    H = 14.6 * k                                                    # hem to the top of the robe
    shapes = [
        {"shape": "box", "min": [-2, 0, -2], "max": [2, 0, 2], "material": "plinth"},
        {"shape": "box", "min": [-2, 1, -2], "max": [2, 1, 2], "material": "plinth"},
        {"shape": "lathe", "at": [0, y0, 0], "profile": [[0, R(3.0)], [R(5), R(2.3)], [R(8), R(2.1)], [R(11), R(2.4)], [R(13), R(2.6)], [R(14), R(1.9)], [R(14.6), 0]], "material": "robe"},
        {"shape": "ellipsoid", "at": [0, y0 + R(13), stoop * 0.5], "r": [R(3.6), R(1.6), R(2.2)], "material": "robe"},
        {"shape": "egg", "at": [0, y0 + R(16.3), R(-0.2) + stoop], "R": R(2.3), "H": R(3.2), "k": -0.12, "material": "robe"},
    ]
    if age in ("king", "young_king", "old_king"):        # a crown ring on the hood
        shapes.append({"op": "paint", "shape": "torus", "at": [0, y0 + R(17.2), R(-0.2) + stoop], "R": R(2.0), "r": 0.55, "axis": "y", "material": "crown"})
    fy = y0 + round(R(16.3)); fz = max(1, round(R(2.3) - 0.6 + stoop))
    shapes.append({"op": "sub", "shape": "box", "min": [-1 if k > 0.55 else 0, fy - 1, fz], "max": [1 if k > 0.55 else 0, fy, fz + 3]})
    place = [[x, fy + j, fz - 1, "smooth_quartz"] for x in ((-1, 0, 1) if k > 0.55 else (0,)) for j in (-1, 0)]   # the blank face
    hy = y0 + round(R(8.5)); hz = round(R(2.3))                      # the hands, pale, in front of the chest
    if variant == "staff":
        place += [[1, hy, hz, "smooth_quartz"]] + [[1, y, hz, "sandstone_wall"] for y in range(y0, hy)] + [[1, y, hz, "sandstone_wall"] for y in range(hy + 1, hy + round(R(9)))]
    elif variant == "sword":
        place += [[0, hy, hz, "smooth_quartz"]] + [[0, y, hz, "sandstone_wall"] for y in range(y0, hy)] + [[-1, hy, hz, "smooth_sandstone_slab", {"half": "top"}], [1, hy, hz, "smooth_sandstone_slab", {"half": "top"}]]
    elif variant == "bowl":
        place += [[x, hy, hz, "smooth_quartz"] for x in (-1, 1)] + [[0, hy, hz, "cut_red_sandstone_slab", {"half": "top"}]]
    else:
        place += [[x, hy, hz, "smooth_quartz"] for x in ((-1, 0, 1) if k > 0.5 else (0,))]
    if variant == "headless":
        shapes.append({"op": "sub", "shape": "plane", "at": [0, y0 + R(14.4), 0], "normal": [0.3, -1, 0.2]})
        place = [p for p in place if p[1] < y0 + R(14.4)]
    if variant == "armless":
        place = [p for p in place if p[3] != "smooth_quartz" or p[1] > hy]
        shapes.append({"op": "sub", "shape": "box", "min": [1, y0 + round(R(7)), 0], "max": [3, y0 + round(R(12)), 3]})
    for j in range(3):
        a = _h(seed, j, 5) * math.tau
        shapes.append({"op": "sub", "shape": "sphere", "at": [round(math.cos(a) * R(3.2), 1), y0 + round(_h(seed, j, 6) * R(14), 1), round(math.sin(a) * R(3.2), 1)], "r": 0.7})
    return {"name": f"oswin_{age}_{variant}", "edition": "bedrock",
            "materials": {"plinth": STONE, "robe": ROBE, "crown": "cut_red_sandstone"}, "shapes": shapes, "place": place}


_ROT = {"s": 0, "w": 1, "n": 2, "e": 3}
_DIR = ["s", "w", "n", "e"]


def _turn(x, z, q):
    """A quarter turn clockwise seen from above: south-facing -> west-facing."""
    return -z, x, q


def cells(variant="folded", facing="s", fallen=False, seed=1, age=None):
    import engine
    blocks, _, _ = engine.compute(spec_age(age, variant, seed) if age else spec(variant, seed))
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


ORDER = ["boy"] * 6 + ["youth"] * 8 + ["young_king"] * 9 + ["king"] * 9 + ["old_king"] * 8     # forty, square to gate
HOLDS = ["folded", "staff", "bowl", "sword"]


def avenue_cells(points, n=32, seed=7, width=9):
    """Sunscar's avenue: n statues of Oswin in pairs along a street centreline (32 here and the Gate's 8 make the
    forty; the plinths stand 5 to 9 out from the centre, so a 9-wide walk stays clear (world [x, z] points, from the square
    to the Faceless Gate), boy to old king, facing the street, about a third broken: hood gone, an arm gone, or
    broken off at the stump. Every cell stands 5 to 9 out from the centreline. -> {(x, y, z): (block, props)} with y 0 = the street (a drape stamp)."""
    seg, L = [], 0.0
    for a, b in zip(points, points[1:]):
        l = math.hypot(b[0] - a[0], b[1] - a[1]); seg.append((a, b, l, L)); L += l
    order = [ORDER[round(i * (len(ORDER) - 1) / max(1, n - 1))] for i in range(n)]
    out = {}
    pairs = (n + 1) // 2
    for i in range(n):
        t = (i // 2 + 0.5) / pairs * L; side = 1 if i % 2 == 0 else -1
        a, b, l, l0 = next(s_ for s_ in seg if s_[3] + s_[2] >= t)
        u = (t - l0) / l; px, pz = a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u
        dx, dz = (b[0] - a[0]) / l, (b[1] - a[1]) / l
        nx, nz = -dz * side, dx * side                                   # out to this statue's side
        off = width // 2 + 3                                              # the plinth 5 wide just outside the walk
        cx, cz = round(px + nx * off), round(pz + nz * off)
        face = ("e" if -nx > 0 else "w") if abs(nx) >= abs(nz) else ("s" if -nz > 0 else "n")   # toward the street
        r_ = _h(seed, i, 9); age = order[i]
        hold = HOLDS[int(_h(seed, i, 10) * len(HOLDS))]
        if r_ < 0.12:     # broken off: only the stump of the robe on its plinth, and the pieces round its foot
            for (x, y, z), v in cells(hold, face, seed=seed + i, age=age).items():
                if y <= PLINTH_H + 2 + int(_h(seed, i, 11) * 3): out[(cx + x, y, cz + z)] = v
            for j in range(4):
                x, z = (-2, -2, 2, 2)[j], (-2, 2, -2, 2)[j]
                if _h(seed, i, 12 + j) < 0.6: out[(cx + x, PLINTH_H, cz + z)] = ("sandstone" if j % 2 else "smooth_sandstone_slab", {} if j % 2 else {"half": "bottom"})
            continue
        var = "headless" if r_ < 0.24 else "armless" if r_ < 0.33 else hold
        for (x, y, z), v in cells(var, face, seed=seed + i, age=age).items(): out[(cx + x, y, cz + z)] = v
    return out


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
