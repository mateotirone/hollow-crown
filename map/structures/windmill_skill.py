"""The settlement windmill drawn on the building skill (one engine): one per region.

Mateo (2026-11-15): "fix the windmill system and also rebuild each region's windmill". The shells, sails and insides
come from map/structures/review/specs/windmill_<region>.json (written by gen_windmill.py) through the skill's
`windmill` part; nothing is added here but the region's window glass (kit.region_glass) and the door marker.

    build(region, sails) -> Blueprint (sails back / left / right), door marker on the door block (export_halls.export frame: the door's front step is
                     the design's (0, 1, 0), +z into the mill), for export_buildings.py (settle/windmill_data.js)
    for_town(region) -> the same with the marker on the step outside the door, for towngen (TB.windmill)

Regions are the long names (vale, frostmarch, saltreach, emberwaste, blackfen); the town generator's short names
(frost, salt, ember, fen) are accepted too.
"""
import os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
SKILL = os.path.join(HERE, "..", "..", ".claude", "skills", "minecraft-builder", "scripts")
if SKILL not in sys.path: sys.path.insert(0, SKILL)
from bp import Blueprint
from kit import region_glass, REGION_ALIAS

SPECS = os.path.join(HERE, "review", "specs")
REGIONS = ("vale", "frostmarch", "saltreach", "emberwaste", "blackfen")
YW = 1                          # the ground floor is walked at y 1 (plinth 0)

def region_of(region):
    region = REGION_ALIAS.get(region, region)
    return region if region in REGIONS else "vale"

SAILS = {"back": "n", "left": "w", "right": "e"}   # where the sails stand, seen from the door step looking in

def build(region="vale", sails="back"):
    """sails: back (the usual), left or right, for a site where the sails only fit beside the mill (windmill_sites.py)."""
    import engine
    region = region_of(region)
    spec = json.load(open(os.path.join(SPECS, f"windmill_{region}.json")))
    spec["parts"][0]["sails"] = dict(spec["parts"][0]["sails"], side=SAILS[sails])
    bp = Blueprint(spec["name"] + ("" if sails == "back" else f"_{sails}")); bp.marks = {}
    engine.into_blueprint(bp, spec)
    region_glass(bp, region)
    bp.markers["door"] = (0, YW, 0)
    bp.region = region
    return bp.finish()

def for_town(region="vale", sails="back"):
    bp = build(region, sails)
    bp.markers["door"] = (0, YW, 1)
    bp.kind = "windmill"
    return bp

if __name__ == "__main__":
    for r in REGIONS:
      for side in SAILS:
        bp = build(r, side)
        (lx, ly, lz), (hx, hy, hz) = bp.bounds()
        print(r, side, len(bp.cells), "cells", "x", lx, hx, "y", ly, hy, "z", lz, hz)
