"""The settlement plot buildings drawn on the building skill (one engine): House, Townhouse, Farmhouse, Mint, Inn.

The shells come from map/structures/review/specs/settle_<id>_<region>.json (written by gen_settle_<region>.py)
through the skill's engine; the functions here are each spec's "after" stage: the stair up, and the inn's furniture.
They draw in the spec's own frame (door wall on z = 0, ground floor walked at y = 2).

    build(id, region) -> Blueprint with the door marker set, for export_buildings.py
"""
import os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
SKILL = os.path.join(HERE, "..", "..", ".claude", "skills", "minecraft-builder", "scripts")
if SKILL not in sys.path: sys.path.insert(0, SKILL)
from bp import Blueprint
from kit import Building, finish_detail
import furnish as F
import settle_halls as SH

P = SH.timber_palette(0)            # the "after" hook's Building wants a palette; these stages only use plain ids
SPECS = os.path.join(HERE, "review", "specs")
IDS = ("house", "townhouse", "farmhouse", "mint", "inn")
HALF = {"house": 5, "farmhouse": 5, "mint": 5, "townhouse": 6, "inn": 7}   # half the plot width (Medium 11, long Medium 13, Large 15)
ATTIC = ("house", "townhouse", "farmhouse")   # buildings whose attic is a room (beds go up there)
YW = 2                              # walking level of the ground floor (plinth 2)

def up_stair(bp, x, z, y0, n, d):
    """A plain spruce stair climbing n steps toward d from (x, y0, z), with the floor above cut for headroom."""
    dx, _, dz = F.DIRS[d]; top = y0 + n - 1
    for i in range(n):
        bp.set(x + dx * i, y0 + i, z + dz * i, "spruce_stairs", facing=d)
        if i < n - 1: bp.set(x + dx * i, top, z + dz * i, "air")          # the hole in the floor above

def house_inside(bp, B):
    up_stair(bp, 3, -2, YW, 5, "n")             # to the attic

def townhouse_inside(bp, B):
    up_stair(bp, 4, -2, YW, 5, "n")
    up_stair(bp, -4, -8, YW + 5, 5, "s")        # first floor to the attic

def farmhouse_inside(bp, B):
    up_stair(bp, 3, -1, YW, 5, "n")
    for x, z in ((-3, -10), (-2, -10), (-3, -9)): bp.set(x, 1, z, "hay_block", axis="y")
    bp.set(-3, 2, -10, "hay_block", axis="y"); bp.set(0, 1, -10, "composter"); bp.set(1, 1, -10, "barrel", facing="up")

def mint_inside(bp, B):
    up_stair(bp, 3, -2, YW, 5, "n")

def bar_ground_windows(bp):
    """The mint's ground-floor windows are barred (the coin is kept there)."""
    for (x, y, z), (n, p) in list(bp.cells.items()):
        if y in (YW, YW + 1, YW + 2) and "glass" in n: bp.cells[(x, y, z)] = ("iron_bars", {})

def inn_inside(bp, B):
    y = YW
    F.bar(bp, -4, 0, y, -7, "s")                         # the bar across the back of the tap room
    for x in (-2, 2): bp.set(x, y, -9, "barrel", facing="up")
    F.table(bp, -3, y, -3, chairs="ew"); F.table(bp, 3, y, -4, chairs="ew")
    F.hearth(bp, 5, y, -8, "w")
    up_stair(bp, -5, -1, y, 5, "n")
    for x, z in ((-2, -3), (3, -6)): F.lantern_ceiling(bp, x, y + 4, z)
    # upstairs: a passage along the front, three bedrooms behind it
    y = YW + 5
    F.partition(bp, -4, -3, 5, -3, y, y + 3)
    for x in (-1, 2): F.partition(bp, x, -9, x, -4, y, y + 3)
    for x in (-3, 0, 4):
        bp.set(x, y, -3, "spruce_door", facing="n"); bp.set(x, y + 1, -3, "spruce_door", facing="n", upper=True)
    for x in (-4, 1, 4):
        F.bed(bp, x, y, -9, "n")
        F.lantern_ceiling(bp, x, y + 3, -6)

def build(bid, region="vale"):
    import engine
    f = os.path.join(SPECS, f"settle_{bid}_{region}.json")
    spec = json.load(open(f)); bp = Blueprint(spec["name"]); bp.marks = {}
    engine.into_blueprint(bp, spec)
    if spec.get("after"):
        mod, fn = spec["after"].split(":")
        tmp = Blueprint("after"); globals()[fn](tmp, Building(tmp, P, 3))
        for (x, y, z), v in tmp.cells.items():
            if v[0] != "keep": bp.cells[(x, y + spec.get("after_dy", 0), z)] = v
    # a window box's sign face can stand past the roof's verge; on a narrow plot it goes, the box stays
    for c in [c for c, v in bp.cells.items() if abs(c[0]) > HALF[bid] and v[0].endswith("wall_sign")]: del bp.cells[c]
    if bid == "mint": bar_ground_windows(bp)
    h = spec["parts"][0]
    x0, z0, x1, z1 = h["rect"]; plate = h.get("y", 0) + h.get("plinth", 1) - 1 + sum(h["storeys"])
    if bid in ATTIC and region != "emberwaste":      # the skill floors each storey; the attic under the roof gets its floor here (the stair comes up through it)
        ya = plate
        for x in range(x0 + 1, x1):
            for z in range(z0 + 1, z1):
                if (x, ya, z) not in bp.cells: bp.cells[(x, ya, z)] = ("spruce_planks", {})
    bp.markers["door"] = (0, YW, 0)
    return bp.finish()

def has(bid, region): return os.path.exists(os.path.join(SPECS, f"settle_{bid}_{region}.json"))
