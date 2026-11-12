"""The Barracks drawn on the building skill (one engine): a timber hall, a round keep and a walled yard.

The shell comes from map/structures/review/specs/barracks_<region>.json (written by gen_barracks.py) through the
skill's engine (parts house, curtain, keep); this module adds what the skill has no part for: the yard floor and
the soldiers' things in it, the outside stair up to the keep, the furnished hall (mess below, bunks above) and the
keep's stores, and the marks the scripts read.

Marks (feet height, the spec's frame; export_halls.export turns them into the design's frame):
  yard_a, yard_b  opposite corners of the yard's open walkable floor: off-duty soldiers wait inside (sieges thread)
  muster          just inside the gate: new soldiers step out here and a march forms up
  banner          the middle of the banner over the gate (white wool here; the game recolours it to the banner colour)
  hall, keep      a spot inside each, for NPCs and the training menu

    build(region) -> Blueprint with the door marker on the Barracks block's spot, for export_buildings.py
"""
import os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
SKILL = os.path.join(HERE, "..", "..", ".claude", "skills", "minecraft-builder", "scripts")
if SKILL not in sys.path: sys.path.insert(0, SKILL)
from bp import Blueprint
from kit import finish_detail
import furnish as F

SPECS = os.path.join(HERE, "review", "specs")
REGIONS = ("vale", "frostmarch", "saltreach", "emberwaste", "blackfen")
YARD = (-6, -7, 6, -1)          # inside the curtain wall: x0, z0, x1, z1 (the turrets and the hall take their corners)
YW = 2                          # the hall's ground floor is walked at y 2 (plinth 2); the yard at y 1
WOOD = {"vale": "spruce", "frostmarch": "dark_oak", "saltreach": "birch", "emberwaste": "acacia", "blackfen": "mangrove"}

def mix(spec_mat, x, z):
    """A yard-ground block from the spec's noise ladder, by a fixed hash so the export is the same every run."""
    lad = spec_mat["ladder"]; h = ((x * 73856093) ^ (z * 19349663)) & 0xffff
    return lad[h % len(lad)]

def yard(bp, spec, region):
    w = WOOD[region]
    x0, z0, x1, z1 = YARD
    for x in range(x0, x1 + 1):                                   # the yard floor, trodden earth and gravel; a path from the gate
        for z in range(z0, z1 + 1):
            if bp.get(x, 1, z)[0] not in ("air", "keep"): continue
            if bp.get(x, 0, z)[0] not in ("air", "keep", "grass_block", "dirt"): continue
            on_path = (-1 <= x <= 1 and z >= -5) or (-2 <= x <= 1 and z == -6)
            bp.set(x, 0, z, ("gravel" if region != "blackfen" else "packed_mud") if on_path else mix(spec["yard_ground"], x, z))
    # the outside stair to the keep's first floor door, on the east wall, with a landing
    for i, z in enumerate(range(-3, -8, -1)):
        bp.set(6, 1 + i, z, f"{w}_stairs", facing="n")
        for y in range(1, 1 + i): bp.set(6, y, z, f"{w}_planks")
    for x in (4, 5): bp.set(x, 5, -7, f"{w}_planks")                       # the landing, on a post
    for y in range(1, 5): bp.set(5, y, -7, f"stripped_{w}_log", axis="y")
    bp.set(5, 6, -7, f"{w}_fence"); bp.set(5, 7, -7, f"{w}_fence")
    for x in (4, 5, 6): bp.set(x, 9, -7, f"{w}_stairs", facing="n")          # a little roof over the keep door
    bp.set(6, 8, -7, f"{w}_stairs", facing="n", half="top")
    bp.set(4, 8, -7, f"{w}_stairs", facing="n", half="top")
    # where the off-duty men sit: a fire with benches round it by the west wall, a trough, a rack, targets
    bp.set(-5, 1, -4, "campfire", facing="s")
    bp.set(-6, 1, -4, f"{w}_stairs", facing="w"); bp.set(-5, 1, -3, f"{w}_stairs", facing="s"); bp.set(-5, 1, -5, f"{w}_stairs", facing="n")
    bp.set(-6, 1, -6, "cauldron"); bp.set(-5, 1, -6, "barrel", facing="up")
    bp.set(-4, 1, -6, "grindstone"); bp.set(-6, 1, -3, f"{w}_fence"); bp.set(-6, 2, -3, "lantern")
    for z in (-3, -5):                                                     # straw targets for the archers
        bp.set(4, 1, z, "hay_block", axis="y"); bp.set(4, 2, z, "target")
    bp.set(5, 1, -6, "barrel", facing="up"); bp.set(5, 2, -6, "barrel", facing="up")

def hall_inside(bp, region):
    w = WOOD[region]; y = YW
    for i in range(5):                                                     # the stair up the west wall to the bunks
        bp.set(-5, y + i, -8 - i, f"{w}_stairs", facing="n")
        if i < 4: bp.set(-5, y + 4, -8 - i, "air")
    F.long_table(bp, -3, 0, y, -10, "spruce" if w == "birch" else w)       # the mess
    bp.set(1, y, -12, "smithing_table"); bp.set(0, y, -12, "grindstone"); bp.set(-1, y, -12, "barrel", facing="up")
    bp.set(1, y, -8, "barrel", facing="up"); bp.set(1, y + 1, -8, "barrel", facing="up")
    for x in (-3, 0): F.lantern_ceiling(bp, x, y + 3, -10)
    y = YW + 5                                                             # the bunk room
    for x in (-3, -1, 1):
        F.bed(bp, x, y, -12, "n")
        F.bed(bp, x, y, -8, "s")
    bp.set(-2, y, -12, "chest", facing="s"); bp.set(0, y, -12, "chest", facing="s")
    bp.set(-2, y, -8, "chest", facing="n"); bp.set(0, y, -8, "chest", facing="n")
    bp.set(-4, y, -12, "barrel", facing="up"); bp.set(-4, y + 1, -12, "lantern")

def keep_inside(bp, region, spec):
    k = next(p for p in spec["parts"] if p["part"] == "keep")
    cx, cz = k["at"]
    bp.set(cx - 1, 2, cz - 1, "barrel", facing="up"); bp.set(cx, 2, cz - 1, "barrel", facing="up")
    bp.set(cx - 1, 2, cz + 1, "fletching_table")
    for fy in k["floors"]:
        bp.set(cx - 1, fy + 1, cz - 1, "barrel", facing="up")
        bp.set(cx, fy + 1, cz - 1, "lantern")

def inside(bp, spec, region):
    yard(bp, spec, region); hall_inside(bp, region); keep_inside(bp, region, spec)

def build(region="vale"):
    import engine
    spec = json.load(open(os.path.join(SPECS, f"barracks_{region}.json")))
    bp = Blueprint(spec["name"]); bp.marks = {}
    engine.into_blueprint(bp, spec)
    inside(bp, spec, region)
    bp.marks.update({"yard_a": (-3, 1, -6), "yard_b": (3, 1, -1), "muster": (0, 1, -1),
                     "banner": (0, 5, 1), "hall": (-2, YW, -9), "keep": (4, YW, -10)})
    bp.markers["door"] = (0, 1, 1)
    bp.yard = yard_columns(spec)
    return finish_detail(bp, None)

def yard_columns(spec):
    """The curtain's plain wall columns (not the turrets or the gate crown) and the yard's floor columns: where a
    town path meets the yard on a level site, the game leaves those out so the path runs in (settle/raised.js)."""
    c = next(p for p in spec["parts"] if p["part"] == "curtain")
    keep_out = set()
    for t in c.get("turrets", []):
        n = t.get("size", 3) // 2; tx, tz = t["at"]
        keep_out |= {(tx + dx, tz + dz) for dx in range(-n, n + 1) for dz in range(-n, n + 1)}
    g = c.get("gate")
    if g: keep_out |= {(g["at"][0] + k, g["at"][1]) for k in range(-(g.get("w", 3) // 2) - 1, g.get("w", 3) // 2 + 2)}
    wall = []
    for (ax, az), (bx, bz) in zip(c["path"], c["path"][1:]):
        n = max(abs(bx - ax), abs(bz - az))
        for k in range(n + 1):
            p = (ax + (bx - ax) * k // n, az + (bz - az) * k // n)
            if p not in keep_out and p not in wall: wall.append(p)
    x0, z0, x1, z1 = YARD
    floor = [(x, z) for x in range(x0, x1 + 1) for z in range(z0, z1 + 1) if (x, z) not in keep_out and (z >= -6 or x >= 3)]   # not under the hall
    return {"wall": wall, "floor": floor}

def has(region): return os.path.exists(os.path.join(SPECS, f"barracks_{region}.json"))

if __name__ == "__main__":
    for r in REGIONS:
        b = build(r); xs = [c[0] for c in b.cells]; zs = [c[2] for c in b.cells]; ys = [c[1] for c in b.cells]
        print(r, len(b.cells), "x", min(xs), max(xs), "z", min(zs), max(zs), "y", min(ys), max(ys))
