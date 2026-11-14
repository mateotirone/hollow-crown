"""The wall watchtower drawn on the building skill (one engine): one per region.

The shells and their insides come from map/structures/review/specs/wallwatch_<region>.json (written by gen_wallwatch.py)
through the skill's engine (a ladder inside up both storeys to a hatch in the lookout deck, lit). Nothing is added here
by hand but the marks the game reads.

Marks (feet height, the spec's frame; export_halls.export turns them into the design's frame):
  guard   where the guard keeping the lookout stands: on the deck, on the side away from the door (out over the wall)

    build(region) -> Blueprint with the door marker on the threshold, for export_buildings.py
    build_stand(region) -> the same for the lookout stand that stands in for the tower on the Low Palisade (level 1)
"""
import os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
SKILL = os.path.join(HERE, "..", "..", ".claude", "skills", "minecraft-builder", "scripts")
if SKILL not in sys.path: sys.path.insert(0, SKILL)
from bp import Blueprint

SPECS = os.path.join(HERE, "review", "specs")
REGIONS = ("vale", "frostmarch", "saltreach", "emberwaste", "blackfen")
YW = 1                          # the ground floor is walked at y 1 (plinth 1)
DECK = 10                       # the lookout deck (gen_wallwatch.DECK); the guard stands on it

def build(region="vale"):
    import engine
    spec = json.load(open(os.path.join(SPECS, f"wallwatch_{region}.json")))
    bp = Blueprint(spec["name"]); bp.marks = {}
    engine.into_blueprint(bp, spec)
    bp.marks["guard"] = (0, DECK + 1, -3)
    bp.markers["door"] = (0, YW, 0)
    return bp.finish()

STAND_DECK = 4                  # the lookout stand's deck (gen_wallwatch.STAND); its guard stands on the middle, feet at 5

def build_stand(region="vale"):
    """The Low Palisade's lookout stand (wallstand_<region>.json): the guard mark on the deck's middle."""
    import engine
    spec = json.load(open(os.path.join(SPECS, f"wallstand_{region}.json")))
    bp = Blueprint(spec["name"]); bp.marks = {}
    engine.into_blueprint(bp, spec)
    bp.marks["guard"] = (0, STAND_DECK + 1, -1)
    bp.markers["door"] = (0, YW, 0)
    return bp.finish()

if __name__ == "__main__":
    for r in REGIONS:
        bp = build(r)
        print(r, len(bp.cells), "cells")
