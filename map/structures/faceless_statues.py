"""The forty Faceless statues: stepped block plinths in the map, 3D figures stood on them by the game.

Mateo, 2026-11-13: the figures are custom 3D entities (siege:faceless_statue, models by studio/statues/build_statues.py),
not built blocks. The map bakes only the plinths (and the rubble round a broken one); each statue's spot goes into a
statue-spot list, and the game (scripts/statues) stands the figure on its plinth when a player comes near.

The forty (lore: Lord Sorrel, Warden Isolde) are King Oswin at every age, boy to old king: 32 line Sunscar's avenue
from the square to the Faceless Gate, and the Gate's own 8 make forty. Every one is robed and hooded with a blank
quartz face, the same pale hands on every one; crowned from the young king on; holding a staff, a sword or a bowl, or
with hands folded; about a third are broken (headless, armless, or snapped off at the stump), and four at the Gate
have fallen.

    plinth_cells(half)                   {(x, y, z): (block, props)} of one stepped plinth, y 0 = the ground (2 high)
    avenue(d, ground)                    the Gate precinct's 4 plinths (boss_landmarks.seneschal)
    gate_spots(anchor)                   the Gate's 8 statue spots, world x/z (anchor = boss_areas.ANCHORS["seneschal"])
    avenue_plan(points, n=32)            Sunscar's avenue: where each statue stands and what it is (pure)
    avenue_cells(points, n=32)           its plinths and rubble for the towns bake (a drape stamp, y 0 = the street)
    avenue_spots(points, n=32)           its statue spots
    write_spots(site, spots)             map/statue-spots/<site>.json; export_statues.py turns them into the game's list

A statue spot (one per figure, the format the towns thread and the game share):
    {"id": "sunscar_07", "x": 857, "z": 470, "face": "w", "age": "young_king", "hold": "sword", "wear": "whole",
     "size": 5, "plinth": 2}
    x, z      world block the figure stands on (the plinth's centre column); the game finds the plinth's top itself
    face      n / e / s / w, the way the figure looks
    age       boy, youth, young_king, king, old_king
    hold      folded, staff, sword, bowl
    wear      whole, headless, armless, stump, fallen (a fallen one lies on its back, feet at x/z, head away from `face`)
    size      times the model's size: 5 on the avenue (a king about 15 blocks tall), 7.3 at the Gate (about 20)
    plinth    half-width of the plinth's footing (2 = 5x5, 4 = 9x9), 0 for a fallen one lying on the ground
    y         optional: the block the figure stands on, if the bake knows it (otherwise the game reads the plinth)
    rise      optional: how many blocks the plinth stands above the ground round it (default 2); a bottom slab on top
              is fine, the figure then stands on the slab
    age "seated" is the Gate's great seated figure on its throne (hold and wear are ignored; the throne is part of the
    model, centred on x/z, his feet forward of it toward `face`)
"""
import json, math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SKILL = os.path.join(HERE, "..", "..", ".claude", "skills", "minecraft-builder", "scripts")
if SKILL not in sys.path: sys.path.insert(0, SKILL)
SPOTS_DIR = os.path.join(HERE, "..", "statue-spots")

PLINTH_H = 2
STONE = {"ladder": ["cut_sandstone", "sandstone", "smooth_sandstone"], "axis": "noise", "scale": 3}
AGES = ["boy", "youth", "young_king", "king", "old_king", "seated"]
HOLDS = ["folded", "staff", "sword", "bowl"]
WEARS = ["whole", "headless", "armless", "stump", "fallen"]
AVENUE_SIZE, GATE_SIZE, SEATED_SIZE = 5, 7.3, 10


def _h(*k):
    x = 0
    for v in k: x = (x * 73856093) ^ (int(v) * 19349663 + 83492791)
    x = (x ^ (x >> 13)) * 1274126177
    return ((x ^ (x >> 16)) & 0xFFFF) / 65535.0


def plinth_spec(half=4):
    """A stepped plinth: a (2h+1)-square footing and a die one smaller all round, 2 high, the sand drifted on it."""
    return {"name": f"faceless_plinth_{2 * half + 1}", "edition": "bedrock",
            "materials": {"plinth": STONE},
            "shapes": [{"shape": "box", "min": [-half, 0, -half], "max": [half, 0, half], "material": "plinth"},
                       {"shape": "box", "min": [-half + 1, 1, -half + 1], "max": [half - 1, 1, half - 1], "material": "plinth"}]}


_PLINTHS = {}
def plinth_cells(half=4):
    if half not in _PLINTHS:
        import engine
        blocks, _, _ = engine.compute(plinth_spec(half))
        _PLINTHS[half] = {k: (n, dict(q)) for k, (n, q) in blocks.items()}
    return _PLINTHS[half]


# The Gate's processional way (local to the precinct, boss_areas.seneschal / boss_landmarks.seneschal): four standing
# either side of it south of the scarab court (plans.js ASH_SAND, (0, 11) r 9, stays open), four fallen along the sides.
AVENUE = [("staff", "w", 7, 21), ("folded", "e", -7, 21), ("bowl", "w", 7, 29), ("headless", "e", -7, 29)]
FALLEN = [("folded", 15, -6), ("staff", -15, -6), ("bowl", 15, 33), ("folded", -15, 33)]


def avenue(d, ground=lambda x, z: 0):
    """The Gate precinct's four plinths (9x9). The figures on them, and the four fallen, are entities (gate_spots)."""
    for k, (v, f, x, z) in enumerate(AVENUE):
        put(d, plinth_cells(4), x, ground(x, z), z)


def gate_spots(anchor=(850, 590)):
    ax, az = anchor
    out = []
    for k, (v, f, x, z) in enumerate(AVENUE):
        hold, wear = (v, "whole") if v in HOLDS else ("folded", v)
        out.append({"id": f"gate_{k + 1}", "x": ax + x, "z": az + z, "face": f, "age": "old_king", "hold": hold, "wear": wear,
                    "size": GATE_SIZE, "plinth": 4})
    # the great seated figure behind the pylons, on its three-tier stepped plinth (boss_landmarks.seneschal: centre
    # (0, -26), radius 11.5, top a slab layer at y 10), about 30 blocks tall, looking south down the processional way
    out.append({"id": "gate_seated", "x": ax, "z": az - 26, "face": "s", "age": "seated", "hold": "folded", "wear": "whole",
                "size": SEATED_SIZE, "plinth": 11, "rise": 10})
    for k, (v, x, z) in enumerate(FALLEN):   # toppled long ago: feet at the spot, head to the north
        out.append({"id": f"gate_fallen_{k + 1}", "x": ax + x, "z": az + z, "face": "s", "age": "old_king", "hold": v, "wear": "fallen",
                    "size": GATE_SIZE, "plinth": 0})
    return out


ORDER = ["boy"] * 6 + ["youth"] * 8 + ["young_king"] * 9 + ["king"] * 9 + ["old_king"] * 8     # forty, square to gate


def avenue_plan(points, n=32, seed=7, width=9):
    """Sunscar's avenue: n statues in pairs along a street centreline (world [x, z] points from the square to the
    Faceless Gate), boy to old king, facing the street, the plinths 5 wide just outside a `width`-wide walk (so the
    road needs a 19-wide corridor). About a third are broken. -> [{cx, cz, face, age, hold, wear}]"""
    seg, L = [], 0.0
    for a, b in zip(points, points[1:]):
        l = math.hypot(b[0] - a[0], b[1] - a[1]); seg.append((a, b, l, L)); L += l
    order = [ORDER[round(i * (len(ORDER) - 1) / max(1, n - 1))] for i in range(n)]
    pairs = (n + 1) // 2
    out = []
    for i in range(n):
        t = (i // 2 + 0.5) / pairs * L; side = 1 if i % 2 == 0 else -1
        a, b, l, l0 = next(s_ for s_ in seg if s_[3] + s_[2] >= t)
        u = (t - l0) / l; px, pz = a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u
        dx, dz = (b[0] - a[0]) / l, (b[1] - a[1]) / l
        nx, nz = -dz * side, dx * side                                   # out to this statue's side
        off = width // 2 + 3
        cx, cz = round(px + nx * off), round(pz + nz * off)
        face = ("e" if -nx > 0 else "w") if abs(nx) >= abs(nz) else ("s" if -nz > 0 else "n")   # toward the street
        r_ = _h(seed, i, 9)
        hold = HOLDS[int(_h(seed, i, 10) * len(HOLDS))]
        wear = "stump" if r_ < 0.12 else "headless" if r_ < 0.24 else "armless" if r_ < 0.33 else "whole"
        out.append({"i": i, "cx": cx, "cz": cz, "face": face, "age": order[i], "hold": hold, "wear": wear})
    return out


def avenue_cells(points, n=32, seed=7, width=9):
    """The avenue's plinths (5x5, 2 high) and, round a statue broken off at the stump, the pieces that fell from it.
    -> {(x, y, z): (block, props)} in world x/z with y 0 = the street (a drape stamp)."""
    out = {}
    for s in avenue_plan(points, n, seed, width):
        for (x, y, z), v in plinth_cells(2).items(): out[(s["cx"] + x, y, s["cz"] + z)] = v
        if s["wear"] == "stump":
            i = s["i"]
            for j, (x, z) in enumerate(((-3, -1), (-1, 3), (3, 1), (1, -3))):
                if _h(seed, i, 12 + j) < 0.6:
                    out[(s["cx"] + x, 0, s["cz"] + z)] = ("sandstone", {}) if j % 2 else ("smooth_sandstone_slab", {"half": "bottom"})
    return out


avenue_plinths = avenue_cells


def avenue_spots(points, n=32, seed=7, width=9, site="sunscar"):
    return [{"id": f"{site}_{s['i'] + 1:02d}", "x": s["cx"], "z": s["cz"], "face": s["face"], "age": s["age"], "hold": s["hold"],
             "wear": s["wear"], "size": AVENUE_SIZE, "plinth": 2} for s in avenue_plan(points, n, seed, width)]


SUNSCAR_AVENUE = [(850, 457), (850, 547)]   # the towns thread's road from Sunscar's square to the Faceless Gate


def check_spot(s):
    """The problems with one statue spot, as a list of strings (empty = fine)."""
    bad = [f"{k} missing" for k in ("id", "x", "z", "face", "age", "hold", "wear", "size", "plinth") if k not in s]
    if bad: return bad
    if s["face"] not in ("n", "e", "s", "w"): bad.append(f"face {s['face']}")
    if s["age"] not in AGES: bad.append(f"age {s['age']}")
    if s["hold"] not in HOLDS: bad.append(f"hold {s['hold']}")
    if s["wear"] not in WEARS: bad.append(f"wear {s['wear']}")
    if not (0.5 <= s["size"] <= 12): bad.append(f"size {s['size']}")
    if "rise" in s and not (0 <= s["rise"] <= 40): bad.append(f"rise {s['rise']}")
    return bad


def write_spots(site, spots):
    for s in spots:
        bad = check_spot(s)
        if bad: raise ValueError(f"{site} {s.get('id')}: {', '.join(bad)}")
    os.makedirs(SPOTS_DIR, exist_ok=True)
    path = os.path.join(SPOTS_DIR, f"{site}.json")
    with open(path, "w") as f:
        f.write("[\n" + ",\n".join(json.dumps(s, separators=(", ", ": ")) for s in spots) + "\n]\n")
    return path


def put(d, cs, x0, y0, z0):
    for (x, y, z), (n, q) in cs.items():
        d.put(x0 + x, y0 + y, z0 + z, n, **q)


if __name__ == "__main__":
    # python3 map/structures/faceless_statues.py   writes the Gate's and Sunscar's statue spots
    print(write_spots("faceless_gate", gate_spots()))
    print(write_spots("sunscar", avenue_spots(SUNSCAR_AVENUE)))
