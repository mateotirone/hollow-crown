"""Gold Sluice specs for the minecraft-builder skill, one per level, each drawn over the last. Emberwaste style
(build-instructions/palettes/emberwaste.md: kasbah sandstone, flat roofs with parapets, vigas, lattice windows,
striped awnings, domes on civic buildings, no grass).

  1 Panning Sluice (Hamlet)   a raised timber trough fed from the stream, a wash pool, spoil heaps, a store hut
  2 Washing Mill (Town)       a waterwheel on the stream drives the washers; a smelting house with a sandstone stack
  3 Assay House (City)        a domed two-storey assay and strongroom with a kasbah tower, where the store hut stood

Skill frame: x east, y up, z south; the front (gate) faces south. The plot is 25 x 15 (x -12..12, z -15..-1),
walled from level 1; ground later levels build on is a desert garden until then (Mateo 2026-11-12).
Usage: python3 spec.py OUTDIR [--ground]
"""
import json, math, random, sys

PLOT = (-12, -15, 12, -1)
STREAM = (-14, -12)          # z rows of the stream (water), across the whole plot
SLUICE_X = 0
POOL = (-2, -5, 2, -3)
HUT = (-11, -11, -7, -7)     # store hut 5 x 5 (levels 1-2)
MILL = (5, -11, 11, -5)      # smelting house 7 x 7 (level 2)
ASSAY = (-11, -11, -3, -3)   # assay house 9 x 9 (level 3)
WHEEL = (8, 3, -13)

MATERIALS = {"sandwall": {"ladder": ["smooth_sandstone", "sandstone", "smooth_sandstone", "cut_sandstone"], "axis": "noise", "scale": 3},
             "dome": {"ladder": ["smooth_red_sandstone", "red_sandstone"], "axis": "y", "texture": False}}
SAND = {"ladder": ["smooth_sandstone", "sandstone", "smooth_sandstone", "cut_sandstone"], "axis": "noise", "scale": 3}


def _hash(x, z, k):
    h = (x * 374761393 + z * 668265263 + k * 2147483647) & 0xffffffff
    h = ((h ^ (h >> 13)) * 1274126177) & 0xffffffff
    return (h & 0xffff) / 65535


def noise(x, z, k, s=3.0):
    fx, fz = x / s, z / s
    x0, z0 = math.floor(fx), math.floor(fz)
    tx, tz = fx - x0, fz - z0
    tx, tz = tx * tx * (3 - 2 * tx), tz * tz * (3 - 2 * tz)
    a, b, c, d = _hash(x0, z0, k), _hash(x0 + 1, z0, k), _hash(x0, z0 + 1, k), _hash(x0 + 1, z0 + 1, k)
    return (a + (b - a) * tx) * (1 - tz) + (c + (d - c) * tx) * tz


def wall_block(x, y, z):
    n = noise(x + y * 7, z, 4, 2.5)
    return "sandstone" if n < 0.3 else "cut_sandstone" if n > 0.85 else "smooth_sandstone"


def inside(x, z, r):
    return r[0] <= x <= r[2] and r[1] <= z <= r[3]


# ---------- ground ----------

def ground(place, lv):
    """Packed red earth and sand, smooth sandstone paths from the gate; the stream in its sandstone bed"""
    x0, z0, x1, z1 = PLOT
    for x in range(x0, x1 + 1):
        for z in range(z0, z1 + 1):
            if STREAM[0] <= z <= STREAM[1]:
                place += [[x, -2, z, "sandstone"], [x, -1, z, "water"], [x, 0, z, "water"]]
                continue
            if z in (STREAM[0] - 1, STREAM[1] + 1):
                place.append([x, 0, z, "cut_sandstone" if x % 2 else "smooth_sandstone"]); continue
            n = noise(x, z, 1)
            path = (abs(x) <= 1 and z >= -2) or (z == -2 and abs(x) <= 6) or (x == -5 and -6 <= z <= -2) or (x == 4 and -4 <= z <= -2)
            b = ("smooth_sandstone" if noise(x, z, 2, 2) > 0.35 else "cut_red_sandstone") if path else \
                "red_sand" if n < 0.28 else "coarse_dirt" if n < 0.62 else "sand" if n < 0.85 else "packed_mud"
            place.append([x, 0, z, b])


def perimeter(place):
    """A low sandstone wall with cut sandstone piers, a 3 wide gate with lanterns, gaps where the stream runs"""
    x0, z0, x1, z1 = PLOT
    run = [(x, z1) for x in range(x0, x1 + 1)] + [(x, z0) for x in range(x0, x1 + 1)] + \
          [(x0, z) for z in range(z0, z1 + 1)] + [(x1, z) for z in range(z0, z1 + 1)]
    piers = {(x0, z0), (x1, z0), (x0, z1), (x1, z1), (-2, z1), (2, z1), (-7, z1), (7, z1), (x0, -7), (x1, -7), (-6, z0), (6, z0)}
    for (x, z) in set(run):
        if abs(x) <= 1 and z == z1: continue
        if STREAM[0] <= z <= STREAM[1]: continue
        if (x, z) in piers:
            place += [[x, 1, z, "cut_sandstone"], [x, 2, z, "chiseled_sandstone"], [x, 3, z, "sandstone_slab"]]
        else:
            place += [[x, 1, z, wall_block(x, 1, z)], [x, 2, z, "sandstone_wall"]]
    place += [[-2, 4, z1, "lantern"], [2, 4, z1, "lantern"]]


# ---------- greenery for ground not built on yet ----------

def palm(place, x, z, h):
    for y in range(1, h + 1): place.append([x + (1 if y > h - 2 and h > 5 else 0), y, z, "jungle_log"])
    tx = x + (1 if h > 5 else 0)
    place.append([tx, h + 1, z, "jungle_leaves"])
    for dx, dz in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        place += [[tx + dx, h + 1, z + dz, "jungle_leaves"], [tx + 2 * dx, h, z + 2 * dz, "jungle_leaves"], [tx + 3 * dx, h - 1, z + 3 * dz, "jungle_leaves"]]
    for dx, dz in ((1, 1), (-1, 1), (1, -1), (-1, -1)):
        place.append([tx + dx, h, z + dz, "jungle_leaves"])


def desert_garden(place, box, seed, palms=()):
    x0, z0, x1, z1 = box
    for x in range(x0, x1 + 1):
        for z in range(z0, z1 + 1):
            if any(abs(x - px) <= 1 and abs(z - pz) <= 1 for px, pz, _ in palms): continue
            k = _hash(x, z, seed)
            if k < 0.07: place.append([x, 1, z, "deadbush"])
            elif k < 0.10: place += [[x, 1, z, "cactus"]] + ([[x, 2, z, "cactus"]] if k < 0.085 else [])
            elif k < 0.13: place.append([x, 1, z, "sandstone"])           # boulders
            elif k < 0.15: place.append([x, 1, z, "smooth_sandstone_slab"])
    for p in palms: palm(place, *p)


# ---------- kasbah buildings, by hand: walls, flat roof, parapet, vigas, lattice windows ----------

def kasbah(place, r, h, door, windows=(), vigas=True, storeys=1):
    """A flat-roofed sandstone block on a plinth. door = (side, offset); windows = [(side, offset, y)]."""
    x0, z0, x1, z1 = r
    for x in range(x0, x1 + 1):
        for z in range(z0, z1 + 1):
            edge = x in (x0, x1) or z in (z0, z1)
            place.append([x, 0, z, "smooth_sandstone" if not edge else "sandstone"])     # floor / plinth
            for y in range(1, h + 1):
                if edge: place.append([x, y, z, wall_block(x, y, z)])
                else: place.append([x, y, z, "air"])
            place.append([x, h + 1, z, "smooth_sandstone"])                               # flat roof
            if storeys > 1 and not edge: place.append([x, 5, z, "acacia_slab", {"half": "top"}])
    # parapet: crenels of cut sandstone and slabs, sandstone wall posts at the corners
    for x in range(x0, x1 + 1):
        for z in range(z0, z1 + 1):
            if not (x in (x0, x1) or z in (z0, z1)): continue
            corner = x in (x0, x1) and z in (z0, z1)
            if corner: place += [[x, h + 2, z, "cut_sandstone"], [x, h + 3, z, "sandstone_wall"]]
            else: place.append([x, h + 2, z, "cut_sandstone" if (x + z) % 2 == 0 else "smooth_sandstone_slab"])
    # vigas: spruce beam ends through the wall under the roof, every other block on the long sides
    if vigas:
        long_x = (x1 - x0) >= (z1 - z0)
        if long_x:
            for x in range(x0 + 1, x1, 2): place += [[x, h, z0 - 1, "spruce_fence"], [x, h, z1 + 1, "spruce_fence"]]
        else:
            for z in range(z0 + 1, z1, 2): place += [[x0 - 1, h, z, "spruce_fence"], [x1 + 1, h, z, "spruce_fence"]]
    cx, cz = (x0 + x1) // 2, (z0 + z1) // 2

    def wall_at(side, off):
        return {"s": (cx + off, z1, 0, 1), "n": (cx - off, z0, 0, -1), "e": (x1, cz + off, 1, 0), "w": (x0, cz - off, -1, 0)}[side]

    side, off = door
    x, z, nx, nz = wall_at(side, off)
    if side in "ns":
        # 3 wide arched doorway: jambs, door, chiseled lintel, upside-down stairs as the round head
        for dx in (-1, 0, 1):
            for y in (1, 2, 3): place.append([x + dx, y, z, "air"])
        place += [[x - 1, 3, z, "sandstone_stairs", {"facing": "w", "half": "top"}], [x + 1, 3, z, "sandstone_stairs", {"facing": "e", "half": "top"}],
                  [x, 4, z, "chiseled_sandstone"], [x - 2, 1, z, "cut_sandstone"], [x - 2, 2, z, "cut_sandstone"], [x + 2, 1, z, "cut_sandstone"], [x + 2, 2, z, "cut_sandstone"]]
        place += [[x, 1, z, "acacia_door", {"facing": "s" if nz > 0 else "n"}], [x, 2, z, "acacia_door", {"facing": "s" if nz > 0 else "n", "upper": True}]]
        place += [[x, 0, z + nz, "smooth_sandstone_slab"]]
    else:
        for dz in (-1, 0, 1):
            for y in (1, 2, 3): place.append([x, y, z + dz, "air"])
        place += [[x, 3, z - 1, "sandstone_stairs", {"facing": "n", "half": "top"}], [x, 3, z + 1, "sandstone_stairs", {"facing": "s", "half": "top"}],
                  [x, 4, z, "chiseled_sandstone"]]
        place += [[x, 1, z, "acacia_door", {"facing": "e" if nx > 0 else "w"}], [x, 2, z, "acacia_door", {"facing": "e" if nx > 0 else "w", "upper": True}]]
    # small deep windows: orange glass in the wall, an acacia trapdoor lattice standing open in front, a slab sill
    for side, off, y in windows:
        x, z, nx, nz = wall_at(side, off)
        f = {"s": "s", "n": "n", "e": "e", "w": "w"}[side]
        place += [[x, y, z, "orange_stained_glass_pane"], [x + nx, y, z + nz, "acacia_trapdoor", {"facing": f, "open": True}],
                  [x + nx, y - 1, z + nz, "smooth_sandstone_slab", {"half": "top"}], [x, y + 1, z, "cut_sandstone"]]


def awning(place, r, y, colours=("orange_wool", "white_wool")):
    """Striped cloth on acacia posts: stripes run front to back"""
    x0, z0, x1, z1 = r
    for x, z in ((x0, z0), (x1, z0), (x0, z1), (x1, z1)):
        for yy in range(1, y): place.append([x, yy, z, "acacia_fence"])
    for x in range(x0, x1 + 1):
        for z in range(z0, z1 + 1):
            place.append([x, y, z, colours[(x - x0) % 2].replace("_wool", "_carpet") if False else colours[(x - x0) % 2]])
    for x in range(x0, x1 + 1):   # a carpet fringe hanging off the front
        place.append([x, y - 1, z1 + 1, "acacia_trapdoor", {"facing": "s", "half": "top", "open": True}])


# ---------- the works ----------

def sluice(place):
    """The raised trough from the stream to the wash pool: acacia log rails, plank bed, water between,
    log trestles under it, riffle slabs; the pool is a sunken sandstone basin"""
    x = SLUICE_X
    z_start, z_end = STREAM[1] + 1, POOL[1] - 1
    for z in range(z_start, z_end + 1):
        place += [[x - 1, 2, z, "stripped_acacia_log", {"axis": "z"}], [x + 1, 2, z, "stripped_acacia_log", {"axis": "z"}],
                  [x, 1, z, "acacia_planks"], [x, 2, z, "water"]]
        if (z - z_start) % 3 == 1:
            place += [[x - 1, 1, z, "stripped_acacia_log", {"axis": "y"}], [x + 1, 1, z, "stripped_acacia_log", {"axis": "y"}]]
    # the head box over the stream, fed by a little gate
    place += [[x - 1, 1, STREAM[1], "stripped_acacia_log", {"axis": "y"}], [x + 1, 1, STREAM[1], "stripped_acacia_log", {"axis": "y"}],
              [x, 1, STREAM[1], "acacia_planks"], [x - 1, 2, STREAM[1], "acacia_planks"], [x + 1, 2, STREAM[1], "acacia_planks"],
              [x, 3, STREAM[1], "acacia_trapdoor", {"facing": "s", "half": "top"}], [x, 2, STREAM[1], "water"]]
    # pool
    x0, z0, x1, z1 = POOL
    for xx in range(x0, x1 + 1):
        for zz in range(z0, z1 + 1):
            rim = xx in (x0, x1) or zz in (z0, z1)
            place.append([xx, -1, zz, "sandstone"])
            place.append([xx, 0, zz, "cut_sandstone" if rim else "water"])
            if rim and not (xx == x and zz == z0): place.append([xx, 1, zz, "smooth_sandstone_slab"])
    place += [[x, 1, z0, "acacia_trapdoor", {"facing": "s", "open": False}]]   # the trough spills into the pool


def level1(R):
    place = []
    ground(place, 1)
    perimeter(place)
    sluice(place)
    # spoil heaps of washed gravel and sand beside the trough
    for (x, z, b) in ((-3, -9, "gravel"), (-3, -8, "gravel"), (-4, -9, "sand"), (-3, -10, "sand"), (-4, -8, "gravel"), (2, -10, "gravel")):
        place.append([x, 1, z, b])
    place += [[-3, 2, -9, "gravel"], [-4, 1, -10, "sandstone_slab"], [-2, 1, -8, "sandstone_slab"]]
    # the panners' shade and bench
    awning(place, (3, -4, 5, -2), 4)
    place += [[4, 1, -3, "barrel", {"facing": "u"}], [3, 1, -3, "cauldron"], [5, 1, -3, "smoker", {"facing": "s"}] if False else [5, 1, -3, "crafting_table"]]
    # store hut
    kasbah(place, HUT, 4, ("s", 0), windows=[("e", 0, 2), ("w", 0, 2)])
    place += [[-8, 1, -10, "chest", {"facing": "s"}], [-10, 1, -10, "barrel", {"facing": "u"}]]
    # unbuilt ground: the mill's corner and the far west
    desert_garden(place, (MILL[0], MILL[1], MILL[2], MILL[3]), 31, palms=[(9, -8, 6)])
    desert_garden(place, (-11, -6, -6, -3), 33, palms=[(-10, -4, 5)])
    return place


def wheel(place, cx, cy, cz, R_out=3.5):
    """Waterwheel turning in the stream, axle running north-south into the mill"""
    for x in range(int(cx - 5), int(cx + 6)):
        for y in range(int(cy - 5), int(cy + 6)):
            d = math.hypot(x - cx, y - cy)
            if 2.5 <= d <= R_out: place.append([x, y, cz, "acacia_planks"])
            elif d < 2.5 and (x == cx or y == cy): place.append([x, y, cz, "stripped_acacia_log", {"axis": "y" if x == cx else "x"}])
    for k in range(0, 3): place.append([cx, cy, cz + k, "stripped_acacia_log", {"axis": "z"}])
    for a in range(0, 360, 45):
        r = math.radians(a)
        place.append([round(cx + math.cos(r) * (R_out + 1)), round(cy + math.sin(r) * (R_out + 1)), cz, "acacia_slab"])
    # the wheel's pit: deepen the stream under it
    for x in range(cx - 4, cx + 5): place += [[x, -3, cz, "sandstone"], [x, -2, cz, "water"]]


def level2(R):
    place = [p for p in level1(R) if not (inside(p[0], p[2], MILL) and p[1] >= 1)]   # the garden makes way
    kasbah(place, MILL, 5, ("w", 0), windows=[("s", -2, 3), ("s", 2, 3), ("e", 0, 3)])
    # the smelting hearth: blast furnaces under a sandstone stack that rises through the roof
    place += [[8, 1, -10, "blast_furnace", {"facing": "s"}], [7, 1, -10, "furnace", {"facing": "s"}], [9, 1, -10, "furnace", {"facing": "s"}]]
    for y in range(2, 11): place.append([8, y, -10, "cut_red_sandstone" if y < 9 else "red_sandstone_wall"])
    place += [[8, 11, -10, "campfire"]]
    place += [[10, 1, -6, "anvil", {"facing": "e"}], [6, 1, -6, "cauldron"], [6, 1, -10, "barrel", {"facing": "u"}]]
    # second trough feeding the mill from the wheel side
    for z in range(STREAM[1] + 1, MILL[1]):
        place += [[6, 2, z, "stripped_acacia_log", {"axis": "z"}], [5, 1, z, "stripped_acacia_log", {"axis": "y"}]] if False else []
    wheel(place, *WHEEL)
    # a little footbridge over the stream to the back gate
    for x in (-6, -5, -4):
        place += [[x, 1, STREAM[0], "acacia_slab"], [x, 1, STREAM[1] - 1, "acacia_slab"], [x, 1, STREAM[1], "acacia_slab"]]
    return place


def level3(R):
    place = [p for p in level2(R) if not ((inside(p[0], p[2], ASSAY) or inside(p[0], p[2], (ASSAY[0] - 1, ASSAY[1] - 1, ASSAY[2] + 1, ASSAY[3] + 1)) and p[1] >= 1) and not inside(p[0], p[2], (-11, -6, -6, -3)))]
    place = [p for p in place if not (inside(p[0], p[2], HUT) or (inside(p[0], p[2], (HUT[0] - 1, HUT[1] - 1, HUT[2] + 1, HUT[3] + 1)) and p[1] >= 1))]
    kasbah(place, ASSAY, 9, ("s", 0), windows=[("s", -3, 3), ("s", 3, 3), ("s", -3, 7), ("s", 3, 7), ("e", -2, 3), ("e", 2, 3), ("e", 0, 7), ("w", 0, 7)], storeys=2)
    # the strongroom inside: iron door, iron bars, a gold block on a lectern of chiseled stone
    place += [[-9, 1, -9, "iron_block"], [-9, 2, -9, "gold_block"], [-10, 1, -10, "chest", {"facing": "s"}], [-8, 1, -10, "chest", {"facing": "s"}]]
    # the dome: a drum and a red sandstone dome with a gold finial on the roof (civic: the assay is the town's pride)
    shapes = [{"shape": "sphere", "at": [-5, 13, -8], "r": 3.5, "material": "dome"},
              {"op": "sub", "shape": "box", "min": [-11, 8, -13], "max": [0, 12, -3]},
              {"shape": "cylinder", "at": [-5, 11, -8], "r": 3.5, "h": 2, "material": "sandwall"}]
    place += [[-5, 17, -8, "gold_block"], [-5, 18, -8, "lightning_rod"]]
    # a kasbah tower on the front-left corner, rising four above the roof with its own parapet and corner horns
    kasbah(place, (-11, -7, -7, -3), 13, ("e", 0), windows=[("s", 0, 3), ("s", 0, 7), ("s", 0, 11), ("w", 0, 11), ("n", 0, 11)], vigas=True)
    for y in range(1, 4): place.append([-7, y, -5, "air"])   # the tower opens into the hall, no second door
    place = [p for p in place if not (p[0] == -7 and p[2] == -5 and p[3] == "acacia_door")]
    return place, shapes


def specs(ground_plate=False):
    out = {}
    for lv in (1, 2, 3):
        R = random.Random(212)
        res = level1(R) if lv == 1 else level2(R) if lv == 2 else level3(R)
        place, shapes = (res if isinstance(res, tuple) else (res, []))
        shapes = list(shapes)
        if ground_plate:
            x0, z0, x1, z1 = PLOT
            shapes = [{"shape": "box", "min": [x0 - 3, -3, z0 - 3], "max": [x1 + 3, -1, z1 + 3], "material": "red_sandstone"},
                      {"shape": "box", "min": [x0 - 3, 0, z0 - 3], "max": [x1 + 3, 0, z1 + 3], "material": "red_sand"}] + shapes
            # the stream runs on beyond the plot so it reads as a real watercourse
            for x in list(range(x0 - 3, x0)) + list(range(x1 + 1, x1 + 4)):
                for z in range(STREAM[0], STREAM[1] + 1): place = [[x, -1, z, "water"], [x, 0, z, "water"]] + place
        out[f"goldsluice_{lv}"] = {"name": f"goldsluice_{lv}", "edition": "bedrock", "materials": MATERIALS, "shapes": shapes, "parts": [], "place": place}
    return out


if __name__ == "__main__":
    import os
    for name, spec in specs("--ground" in sys.argv).items():
        json.dump(spec, open(os.path.join(sys.argv[1], name + ".json"), "w"))
    print("ok")
