"""The settlement plot buildings drawn on the building skill (one engine): House, Townhouse, Farmhouse, Mint, Inn.

The shells come from map/structures/review/specs/settle_<id>_<region>.json (written by gen_settle_<region>.py)
through the skill's engine; the skill furnishes every one of them (its interior stage: stairs, rooms by use, attics, light); the functions here
are what the skill has no part for (the farmhouse's hay store, the mint's barred windows, narrow-plot signs).
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

def farmhouse_inside(bp, B):
    """The skill furnishes the farmhouse (its interior stage); the lean-to is walked through: hay and barrels keep
    to its two ends, the middle stays a clear walk."""
    for z in (-9, -10): bp.set(-3, 1, z, "hay_block", axis="y")
    bp.set(-3, 2, -10, "hay_block", axis="y"); bp.set(3, 1, -9, "composter"); bp.set(3, 1, -10, "barrel", facing="up")

def bar_ground_windows(bp):
    """The mint's ground-floor windows are barred (the coin is kept there)."""
    for (x, y, z), (n, p) in list(bp.cells.items()):
        if y in (YW, YW + 1, YW + 2) and "glass" in n: bp.cells[(x, y, z)] = ("iron_bars", {})

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
    bp.markers["door"] = (0, YW, 0)
    return bp.finish()

def has(bid, region): return os.path.exists(os.path.join(SPECS, f"settle_{bid}_{region}.json"))
