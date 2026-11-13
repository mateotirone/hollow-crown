"""The Dragon Stable drawn on the building skill (one engine): a kasbah stable hall with a nursery joined on the east.

The shell comes from map/structures/review/specs/dragon_stable_emberwaste.json (written by gen_dragon_stable.py)
through the skill's engine (a house part with a wing, and a dome); this module adds what the skill has no part for:
the wide arched way in for a grown dragon, the stalls, the tack corner, the loft, the wall and arch between the hall
and the nursery, and the nursery's Hatching Braziers on their warm bed.

Inside (spec frame: front south, front wall z = 0; floors at y 0 and 6, so the ground is walked at y 1, the loft at y 7):
  hall     x -6..6, z -13..-1. A 5-wide aisle (x -2..2) of sandstone flags; stalls 4 deep either side behind acacia
           rails with a gate: three on the west, one on the east. On the east the nursery arch, then the ladder to the
           loft and the feed store by the door. The tack corner is by the door on the west.
  nursery  x 8..12, z -11..-3, through a 3-wide arch in the shared wall at z -8..-6: three Hatching Braziers along
           the east wall on a red sandstone kerb, the keeper's lectern and stores.
  loft     hay, saddles in chests, the keeper's bunk, and a ladder up to a hatch onto the roof terrace.

Marks (feet height, spec frame): brazier0..2 (the three Hatching Braziers), aisle, nursery, loft.

    build(region) -> Blueprint with the door marker on the Dragon Roost's spot, for export_buildings.py
"""
import os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
SKILL = os.path.join(HERE, "..", "..", ".claude", "skills", "minecraft-builder", "scripts")
if SKILL not in sys.path: sys.path.insert(0, SKILL)
from bp import Blueprint
from kit import finish_detail, wool_awning
import furnish as F

SPECS = os.path.join(HERE, "review", "specs")
P = {}                                   # the catalogue's "after" hook passes Building(bp, P, seed); unused here
Building = lambda bp, P=None, seed=0: None
BRAZIER = "siege:hatching_brazier"
BRAZIERS = [(11, 1, -9), (11, 1, -7), (11, 1, -5)]
WALL = ("smooth_sandstone", "smooth_sandstone", "sandstone", "smooth_sandstone", "cut_sandstone")

def wall_at(x, y, z):
    """A wall block from the region's EMB-01 mix by a fixed hash (smooth 60, sandstone 30, cut 10 near enough)."""
    h = ((x * 73856093) ^ (y * 83492791) ^ (z * 19349663)) & 0xffff
    return WALL[h % len(WALL)]

def arch(bp, x0, x1, y0, top, z=None, x=None, jamb="cut_red_sandstone", lintel="stripped_acacia_log"):
    """A round-angle opening: clear x0..x1 (or z0..z1 along x = const) from y0 up to top, upside-down stairs in the
    two top corners facing the jambs, jambs one block either side, a log lintel across above."""
    along_x = z is not None
    put = (lambda a, y, *s, **k: bp.set(a, y, z, *s, **k)) if along_x else (lambda a, y, *s, **k: bp.set(x, y, a, *s, **k))
    for a in range(x0, x1 + 1):
        for y in range(y0, top + 1): put(a, y, "air")
        put(a, top + 1, lintel, axis="x" if along_x else "z")
    lo, hi = ("e", "w") if along_x else ("s", "n")
    put(x0, top, "smooth_red_sandstone_stairs", facing=lo, half="top")
    put(x1, top, "smooth_red_sandstone_stairs", facing=hi, half="top")
    for a in (x0 - 1, x1 + 1):
        for y in range(y0, top + 1): put(a, y, jamb)
        put(a, top + 1, lintel, axis="x" if along_x else "z")

def front(bp):
    """The way in: a 5-wide, 4-high arch through the front wall, red sandstone jambs, a log lintel, lanterns either
    side on chains from the lintel ends, and a striped awning over each of the two front windows of the loft."""
    for x in range(-3, 4):                       # whatever the door stage put in front of the wall goes
        for y in range(1, 6):
            bp.set(x, y, 1, "air")
    arch(bp, -2, 2, 1, 4, z=0)
    for y in range(1, 6):                        # a proud red surround, one block out (depth comes outward)
        for x in (-3, 3): bp.set(x, y, 1, "cut_red_sandstone")
    for x in range(-3, 4): bp.set(x, 6, 1, "smooth_red_sandstone_slab", half="bottom")
    for x in range(-2, 3): bp.set(x, 5, 1, "chiseled_red_sandstone" if x == 0 else "cut_red_sandstone")
    bp.set(-2, 4, 1, "smooth_red_sandstone_stairs", facing="e", half="top"); bp.set(2, 4, 1, "smooth_red_sandstone_stairs", facing="w", half="top")
    for x in (-2, -1, 0, 1, 2): bp.set(x, 0, 0, "cut_red_sandstone")       # the sill, flush with the floor
    for x in (-2, -1, 0, 1, 2): bp.set(x, 0, 1, "smooth_red_sandstone_slab", half="top")
    for x in (-4, 4):
        bp.set(x, 4, 1, "stripped_acacia_log", axis="z"); bp.set(x, 3, 1, "lantern", hanging=True)
    wool_awning(bp, range(-6, -3), 10, 0, "s", ("orange_wool", "white_wool"), depth=2)
    wool_awning(bp, range(4, 7), 10, 0, "s", ("orange_wool", "white_wool"), depth=2)

def stall(bp, side, z0, z1):
    """One stall 4 deep (x 3..6 or -6..-3) between z0 and z1: a straw floor, a rail with a gate on the aisle side,
    a hay bed against the back wall, a water trough, a barrel of meat and a hook (a chain) over the bed."""
    xs = range(3, 7) if side > 0 else range(-6, -2)
    back = 6 * side
    rail = 3 * side
    for x in xs:
        for z in range(z0, z1 + 1):
            bp.set(x, 0, z, "coarse_dirt")
            if (x * 7 + z * 3) % 4 == 0 and abs(x) not in (3, 6): bp.set(x, 1, z, "yellow_carpet")   # loose straw
    mid = (z0 + z1) // 2
    for z in range(z0, z1 + 1):
        bp.set(rail, 1, z, "acacia_fence_gate" if z == mid else "acacia_fence", **({"facing": "e" if side > 0 else "w", "open": False} if z == mid else {}))
    for z in (z0, z0 + 1): bp.set(back, 1, z, "hay_block", axis="y")
    bp.set(back, 2, z0, "hay_block", axis="y")
    bp.set(back - side, 1, z0, "hay_block", axis="z")
    bp.set(back, 1, z1, "cauldron", fill_level=6)
    bp.set(back - side, 1, z1, "barrel", facing="up")
    for y in (4, 5): bp.set(back - side, y, mid, "chain")
    bp.set(back - side, 3, mid, "chain")

def divider(bp, side, z):
    """A stall partition 4 deep and 2 high: a sandstone wall on the inside, an acacia post at the rail."""
    for x in (range(4, 7) if side > 0 else range(-6, -3)):
        for y in (1, 2): bp.set(x, y, z, "sandstone_wall")
    bp.set(3 * side, 1, z, "stripped_acacia_log", axis="y"); bp.set(3 * side, 2, z, "stripped_acacia_log", axis="y")
    bp.set(3 * side, 3, z, "lantern")

def hall(bp):
    for x in range(-2, 3):                                                   # the aisle: sandstone flags, a red band down the middle
        for z in range(-13, 0): bp.set(x, 0, z, "cut_red_sandstone" if x == 0 else ("smooth_sandstone" if (z % 2) else "cut_sandstone"))
    for z0, z1 in ((-13, -11), (-9, -7), (-5, -3)): stall(bp, -1, z0, z1)   # west: three stalls
    for z in (-10, -6, -2): divider(bp, -1, z)
    stall(bp, 1, -13, -11); divider(bp, 1, -10)                              # east: one stall, then the nursery arch
    for z in (-9, -8, -7, -6, -5):                                           # the way to the nursery, flagged like the aisle
        for x in range(3, 7): bp.set(x, 0, z, "smooth_sandstone")
    divider(bp, 1, -4)
    # the tack corner (west, by the door): saddles and bridles in chests, a grindstone, barrels
    bp.set(-6, 1, -1, "chest", facing="e"); bp.set(-6, 1, -2, "barrel", facing="up"); bp.set(-6, 2, -2, "barrel", facing="up")
    bp.set(-5, 1, -1, "grindstone", face="floor", facing="n"); bp.set(-4, 1, -1, "crafting_table")
    for z in (-1, -2): bp.set(-3, 1, z, "air")
    # the feed store (east, by the door): barrels of salt meat, a smoker; the ladder to the loft in the corner
    bp.set(4, 1, -1, "barrel", facing="up"); bp.set(4, 2, -1, "barrel", facing="up"); bp.set(5, 1, -1, "smoker", facing="w")
    for y in range(1, 7): bp.set(6, y, -1, "ladder", facing="w")
    bp.set(6, 6, -1, "air"); bp.set(6, 6, -1, "ladder", facing="w")
    bp.set(4, 1, -3, "barrel", facing="up"); bp.set(5, 1, -3, "barrel", facing="up")
    for z in (-12, -8, -4): F.lantern_ceiling(bp, 0, 5, z)                  # over the aisle

def nursery(bp):
    for z in range(-11, -2):                                                 # the shared wall rebuilt, one arch through it
        for y in range(1, 6): bp.set(7, y, z, wall_at(7, y, z))
    arch(bp, -8, -6, 1, 3, x=7)
    for x in range(8, 13):                                                   # a warm floor: smooth red sandstone, cut red edges
        for z in range(-11, -2): bp.set(x, 0, z, "cut_red_sandstone" if x in (8, 12) or z in (-11, -3) else "smooth_red_sandstone")
    for (x, y, z) in BRAZIERS:
        bp.set(x, 0, z, "magma")                                             # the coals under each brazier (a block under, never walked)
        bp.set(x, 1, z, BRAZIER)
        for dz in (-1, 1):
            if (x, y, z + dz) not in BRAZIERS and bp.get(x, 1, z + dz)[0] in ("air", "keep"):
                bp.set(x, 1, z + dz, "smooth_red_sandstone_slab", half="bottom")   # the kerb between them
        bp.set(x + 1, 1, z, "red_sandstone_wall")
    bp.set(12, 1, -10, "smooth_red_sandstone_slab", half="bottom"); bp.set(12, 1, -4, "smooth_red_sandstone_slab", half="bottom")
    bp.set(9, 1, -11, "lectern", facing="s"); bp.set(8, 1, -11, "barrel", facing="up"); bp.set(10, 1, -11, "chest", facing="s")
    bp.set(8, 1, -3, "barrel", facing="up"); bp.set(9, 1, -3, "cauldron", fill_level=6); bp.set(10, 1, -3, "flower_pot")
    bp.set(10, 2, -3, "air")
    F.lantern_ceiling(bp, 10, 6, -9); F.lantern_ceiling(bp, 10, 6, -5)

def loft(bp):
    y = 7
    for x in (-6, -5):                                                      # hay stacked along the west wall
        for z in range(-13, -4, 2): bp.set(x, y, z, "hay_block", axis="z")
    for z in range(-13, -6, 2): bp.set(-6, y + 1, z, "hay_block", axis="z")
    F.bed(bp, 5, y, -13, "n"); bp.set(4, y, -13, "chest", facing="s"); bp.set(6, y, -11, "barrel", facing="up")
    for x in (-1, 1): bp.set(x, y, -13, "chest", facing="s")                # saddles and harness
    bp.set(0, y, -13, "barrel", facing="up")
    bp.set(3, y, -1, "barrel", facing="up"); bp.set(2, y, -1, "barrel", facing="up")
    for yy in range(y, 11): bp.set(0, yy, -8, "stripped_acacia_log", axis="y"); bp.set(0, yy, -7, "ladder", facing="s")   # up to the roof terrace (a hatch in the deck)
    bp.set(0, 11, -7, "acacia_trapdoor", facing="s", half="bottom", open=False)
    bp.set(0, y, -6, "air")
    for (x, z) in ((-3, -10), (3, -10), (-3, -4), (3, -4)): F.lantern_ceiling(bp, x, 10, z)

def terrace(bp):
    """The roof is where a dragon lands: hay heaped in one corner, lantern posts inside the parapet corners, and
    the kasbah's corner horns: each corner of the hall rises two courses above the parapet, capped by a wall post."""
    for (x, z) in ((-5, -12), (-4, -12), (-5, -11)): bp.set(x, 12, z, "hay_block", axis="y")
    for (x, z) in ((-5, -13), (5, -13), (-5, -1), (5, -1)):
        bp.set(x, 12, z, "sandstone_wall"); bp.set(x, 13, z, "lantern")
    for (x, z) in ((-7, -14), (7, -14), (-7, 0), (7, 0)):
        for y in (12, 13): bp.set(x, y, z, "cut_sandstone")
        bp.set(x, 14, z, "sandstone_wall")

def inside(bp, B=None):
    front(bp); hall(bp); nursery(bp); loft(bp); terrace(bp)

def build(region="emberwaste"):
    import engine
    spec = json.load(open(os.path.join(SPECS, "dragon_stable_emberwaste.json")))
    bp = Blueprint(spec["name"]); bp.marks = {}
    engine.into_blueprint(bp, spec)
    inside(bp)
    bp.marks.update({f"brazier{i}": b for i, b in enumerate(BRAZIERS)}); bp.marks.update({"aisle": (0, 1, -7), "nursery": (9, 1, -7), "loft": (0, 7, -9)})
    bp.markers["door"] = (0, 1, 1)
    return finish_detail(bp, None)

if __name__ == "__main__":
    b = build(); xs = [c[0] for c in b.cells]; zs = [c[2] for c in b.cells]; ys = [c[1] for c in b.cells]
    print(len(b.cells), "x", min(xs), max(xs), "z", min(zs), max(zs), "y", min(ys), max(ys))
