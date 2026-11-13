"""The Storehouse drawn on the building skill (one engine): four levels in each region, one per town tier.

The shells and their insides come from map/structures/review/specs/storehouse_<level>_<region>.json (written by
gen_storehouse.py) through the skill's engine; the inside is the skill's "storehouse" use (interiors.py: walls of
sideways chests in 3 x 3 bays between stone pillars, racks down the middle of wide rooms, stairs, light). Nothing is
added here by hand but the marks the game reads.

Marks (feet height, the spec's frame; export_halls.export turns them into the design's frame):
  goods   just inside the cart door: deliveries from the station crates arrive here (settle/storehouse.js)
  keeper  the Storekeeper's spot by the door

    build(level, region) -> Blueprint with the door marker on the threshold, for export_buildings.py
    chests(bp) -> number of chests in a build
"""
import os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
SKILL = os.path.join(HERE, "..", "..", ".claude", "skills", "minecraft-builder", "scripts")
if SKILL not in sys.path: sys.path.insert(0, SKILL)
from bp import Blueprint

SPECS = os.path.join(HERE, "review", "specs")
REGIONS = ("vale", "frostmarch", "saltreach", "emberwaste", "blackfen")
LEVELS = (1, 2, 3, 4)
YW = 2                          # the ground floor is walked at y 2 (plinth 2)

def build(level, region="vale"):
    import engine
    spec = json.load(open(os.path.join(SPECS, f"storehouse_{level}_{region}.json")))
    bp = Blueprint(spec["name"]); bp.marks = {}
    engine.into_blueprint(bp, spec)
    bp.marks.update({"goods": (0, YW, -2), "keeper": (0, YW, -1)})
    bp.markers["door"] = (0, YW, 0)
    return bp.finish()

def chests(bp): return sum(1 for v in bp.cells.values() if v[0] == "chest")

if __name__ == "__main__":
    for r in REGIONS:
        print(r, [chests(build(l, r)) for l in LEVELS])
