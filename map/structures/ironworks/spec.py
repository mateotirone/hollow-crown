"""Ironworks specs for the minecraft-builder skill, one per level, each drawn over the last.
Skill frame: x east, y up, z south; the front (gate, Ironworks block) faces south (+z). Yard x -7..7, z -15..-1 (15 x 15).
Usage: python3 spec.py OUTDIR [--ground] [--skill SKILL_DIR] [--region R|all]
  -> OUTDIR/ironworks_<region>_1.json .. _3.json (--ground adds a ground plate for pictures)
Built with the minecraft-builder skill (the one building engine, Mateo 2026-11-12). Viewer: ../ironworks_builds.py.
Every region's look (machine_regions.py, Mateo 2026-11-12); the Vale is the home style.
"""
import json, os, random, sys, math

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
from machine_regions import theme, snow_cap, ORDER, names_json  # noqa: E402
SKILL = os.path.join(HERE, "..", "..", "..", ".claude", "skills", "minecraft-builder")
STAGES = ["Ore Pit", "Bloomery", "Trip-Hammer Forge"]
T = theme("vale")     # the region being built; specs() sets it

def _hash(x, z, k):
    h = (x * 374761393 + z * 668265263 + k * 2147483647) & 0xffffffff
    h = ((h ^ (h >> 13)) * 1274126177) & 0xffffffff
    return (h & 0xffff) / 65535

def noise(x, z, k, s=3.0):
    """Smooth value noise, 0..1 (clusters with a cause, not speckle)"""
    fx, fz = x / s, z / s
    x0, z0 = math.floor(fx), math.floor(fz)
    tx, tz = fx - x0, fz - z0
    tx, tz = tx * tx * (3 - 2 * tx), tz * tz * (3 - 2 * tz)
    a, b = _hash(x0, z0, k), _hash(x0 + 1, z0, k)
    c, d = _hash(x0, z0 + 1, k), _hash(x0 + 1, z0 + 1, k)
    return (a + (b - a) * tx) * (1 - tz) + (c + (d - c) * tx) * tz

X0, X1, Z0, Z1 = -7, 7, -15, -1          # the yard, inclusive
PIT = (-2, -8, 2, -4)                     # stone ring x0 z0 x1 z1 (5 x 5), 3 x 3 shaft inside
STORE = [-7, -15, -3, -11]                # storeroom 5 x 5, back left
BLOOM = [1, -15, 7, -9]                   # bloomery 7 x 7, back right
MILL = [-13, -13, -9, -3]                 # trip-hammer mill 5 x 11, outside the west fence
WHEEL_X = -15
PLOT = (-17, -15, 7, -1)                  # the whole plot, fenced from day one (25 x 15): the works grow into it
MEADOW = (-16, -14, -8, -2)               # west of the yard: the mill's ground, green until level 3
BLOOM_SITE = (1, -15, 7, -9)              # the bloomery's ground, green until level 2
TRACK = [(0, -1, -3, 1), (-5, -10, -6, 0), (4, -8, -3, 0)]  # (x, z from, z to, half width): gate to pit, storeroom door, bloomery door

def yard_surface(place, skip):
    """Worked earth: coarse dirt, damp packed mud in patches, a worn gravel and cobble track from the gate to
    each door and the pit, rooted dirt only along the fence where nobody walks."""
    for x in range(X0, X1 + 1):
        for z in range(Z0, Z1 + 1):
            if (x, z) in skip: continue
            n = noise(x, z, 1)
            on_track = any(abs(x - tx) <= w and min(za, zb) <= z <= max(za, zb) for tx, za, zb, w in TRACK) or (z == -6 and -5 <= x <= 4)
            if on_track: b = T.path(x, z)
            else: b = T.yard(x, z)
            place.append([x, 0, z, b])

def ground_plate(shapes, x0, z0, x1, z1):
    """Render only: grass round the build and earth under it, so it reads as standing in the world"""
    shapes.append({"shape": "box", "min": [x0 - 3, -6, z0 - 3], "max": [x1 + 3, -1, z1 + 3], "material": T.plate[0]})
    shapes.append({"shape": "box", "min": [x0 - 3, 0, z0 - 3], "max": [x1 + 3, 0, z1 + 3], "material": T.plate[1]})

def log(x, y, z, axis="y"): return [x, y, z, T.log, {"axis": axis}]

def perimeter(place, open_west=False):
    """Fence round the yard: log posts 2 high at corners and gate jambs (runs of 5 and 3 between, odd),
    spruce fence between, a 3 wide gate in the front with lanterns on its posts. Buildings close the back."""
    posts = {(X0, Z1), (-2, Z1), (2, Z1), (X1, Z1), (X0, -5), (X1, -5), (X1, -9), (X0, -9)}
    if open_west: posts = (posts - {(X0, -9), (X0, -5)}) | {(X0, -10), (X0, -6)}
    fence = set()
    for x in range(X0, X1 + 1):
        if abs(x) > 1: fence.add((x, Z1))
    for z in range(-10, Z1 + 1):
        fence.add((X0, z)); fence.add((X1, z))
    for x in range(-2, 1): fence.add((x, Z0))   # the alley between storeroom and bloomery
    if open_west:
        for z in (-9, -8, -7): fence.discard((X0, z))
    for (x, z) in sorted(fence - posts): place.append([x, 1, z, T.fence])
    for (x, z) in sorted(posts): place += [log(x, 1, z), log(x, 2, z)]
    place += [[-2, 3, Z1, "lantern"], [2, 3, Z1, "lantern"]]

def ore_pit(R, place):
    x0, z0, x1, z1 = PIT
    for x in range(x0, x1 + 1):
        for z in range(z0, z1 + 1):
            inner = x0 < x < x1 and z0 < z < z1
            for y in range(-5, 1):
                if inner and y > -5: place.append([x, y, z, "air"]); continue
                if inner: place.append([x, y, z, "gravel"]); continue
                if y == 0: place.append([x, y, z, T.stone_brick if noise(x, z, 5, 1.5) < 0.6 else T.stone_accent])
                else:  # shaft walls: stone getting darker down, iron showing
                    r = R.random()
                    place.append([x, y, z, "iron_ore" if r < 0.18 else "cobblestone" if r < 0.45 else "stone" if y > -3 else "tuff"])
            if not inner:
                corner = x in (x0, x1) and z in (z0, z1)
                if corner: place.append([x, 1, z, T.stone_wall])
                elif not (x == 0 and z == z0): place.append([x, 1, z, T.stone_slab])
    for y in range(-4, 1): place.append([0, y, z0 + 1, "ladder", {"facing": "s"}])
    # windlass over the shaft: two posts on the curb, a beam, upside-down stair braces, chain and bucket, crank
    zc = (z0 + z1) // 2
    for x in (x0, x1):
        for y in range(1, 5): place.append(log(x, y, zc))
    for x in range(x0 - 1, x1 + 2): place.append(log(x, 5, zc, "x"))
    place += [[x0 + 1, 4, zc, T.stairs, {"facing": "w", "half": "top"}], [x1 - 1, 4, zc, T.stairs, {"facing": "e", "half": "top"}]]
    place += [[0, 4, zc, "iron_chain"], [0, 3, zc, "iron_chain"], [0, 2, zc, "cauldron"]]
    place += [[x1 + 1, 4, zc, T.fence], [x0 - 1, 4, zc, "lantern", {"hanging": True}]]

def greenery(place, box, seed, trees=()):
    """The region's ground, ground cover and trees (machine_regions.Theme.green)"""
    T.green(place, box, seed, trees=[(t[0], t[1], t[2]) for t in trees])

def outer_fence(place):
    """The plot's own fence beyond the yard: west meadow (and the bloomery ground until it is built)"""
    px0, pz0, px1, pz1 = PLOT
    posts = {(px0, pz1), (px0, pz0), (px0, -8), (-12, pz1), (-12, pz0)}
    fence = {(x, pz1) for x in range(px0, X0)} | {(x, pz0) for x in range(px0, X0)} | {(px0, z) for z in range(pz0, pz1 + 1)}
    for (x, z) in sorted(fence - posts): place.append([x, 1, z, T.fence])
    for (x, z) in sorted(posts): place += [log(x, 1, z), log(x, 2, z)]

def site_fence(place):
    """Until the bloomery stands, a fence closes the yard round its ground"""
    x0, z0, x1, z1 = BLOOM_SITE
    for x in range(x0, x1 + 1): place.append([x, 1, z0, T.fence])
    for z in range(z0, -9): place.append([x1, 1, z, T.fence])
    place += [log(x1, 1, z0), log(x1, 2, z0)]

def landscape(lv):
    """Greenery and fences for the ground this level has not built on yet"""
    soft = []
    outer_fence(soft)
    if lv < 3: greenery(soft, MEADOW, 11, trees=[(-13, -11, 5, "oak"), (-10, -5, 4, "birch"), (-15, -4, 4, "oak")])
    else:
        for z in range(MEADOW[1], MEADOW[3] + 1):   # the strip between mill and yard fence stays green
            soft.append([-8, 0, z, T.ground(-8, z)])
            if _hash(-8, z, 3) < 0.3 and T.region != "emberwaste": soft.append([-8, 1, z, "azalea_leaves" if T.region != "blackfen" else "mangrove_leaves"])
    if lv < 2:
        greenery(soft, BLOOM_SITE, 21, trees=[(4, -12, 5, "oak")])
        site_fence(soft)
    return soft

def level1(R):
    place, parts, shapes = [], [], []
    perimeter(place)
    ore_pit(R, place)
    # the ore heap left of the pit: a low mound of spoil, raw iron on top, slabs round its foot
    place += [[-5, 1, -6, "gravel"], [-5, 1, -5, "gravel"], [-5, 2, -6, "raw_iron_block"], [-5, 1, -4, "iron_ore"],
              [-4, 1, -6, T.stone_slab], [-4, 1, -5, T.stone_slab], [-5, 1, -7, T.stone_slab], [-6, 1, -5, T.stone_slab],
              [-6, 1, -6, "gravel"], [-4, 1, -4, T.stone_slab]]
    # storeroom: a small timber house at the back left, door to the yard
    parts.append(T.house("timber", rect=STORE, y=0, plinth=1, storeys=[5], door={"side": "s", "kind": "house"}, ridge="z",
                         chimney=False, shutters=0,
                         windows={"e": [{"at": 0, "storey": 0, "w": 1, "h": 2}], "w": [{"at": 0, "storey": 0, "w": 1, "h": 2}]}))
    place += [[-2, 1, -14, "barrel"], [-2, 1, -13, "barrel"], [-2, 2, -14, "barrel", {"facing": "u"}]]
    # by the gate: chopping block and tool barrel
    place += [[5, 1, -2, "stripped_oak_log", {"axis": "y"}], [6, 1, -2, "barrel"], [-6, 1, -2, "composter"]]
    return place, parts, shapes

def level2(R):
    place, parts, shapes = level1(R)
    parts.append(T.house("stone", rect=BLOOM, y=0, plinth=1, storeys=[5], door={"side": "s", "kind": "large"}, ridge="z",
                         chimney=[[4, -13]], shutters=0,
                         windows={"e": [{"at": -2, "storey": 0, "w": 1, "h": 2}, {"at": 2, "storey": 0, "w": 1, "h": 2}]}))
    # the bloomery hearth inside against the back wall, under the chimney
    place += [[3, 2, -14, "blast_furnace", {"facing": "s"}], [4, 2, -14, "blast_furnace", {"facing": "s"}], [5, 2, -14, "blast_furnace", {"facing": "s"}],
              [3, 1, -14, "stone_bricks"], [4, 1, -14, "stone_bricks"], [5, 1, -14, "stone_bricks"]]
    # work yard in front: anvil on a log, quench tub, grindstone, a charcoal bin of trapdoor sides
    place += [[6, 1, -6, "anvil", {"facing": "e"}], [6, 1, -7, "cauldron"], [6, 1, -4, "grindstone"]]
    for x in (3, 4, 5):
        place += [[x, 1, -2, "coal_block"], [x, 1, -3, T.trapdoor, {"facing": "s", "open": True}]]
    place += [[2, 1, -2, T.trapdoor, {"facing": "w", "open": True}] if False else [2, 1, -2, "stripped_spruce_log", {"axis": "y"}]]
    for d in range(len(place) - 1, -1, -1):  # the chopping block moves for the bin
        if place[d][:3] == [5, 1, -2] and place[d][3] == "stripped_oak_log": del place[d]
    return place, parts, shapes

def wheel(place, cx, cy, cz, R_out=3.5):
    for y in range(int(cy - 5), int(cy + 6)):
        for z in range(int(cz - 5), int(cz + 6)):
            d = math.hypot(y - cy, z - cz)
            if 2.5 <= d <= R_out: place.append([cx, y, z, T.planks])
            elif d < 2.5 and (y == cy or z == cz): place.append(log(cx, y, z, "y" if z == cz else "z"))
    for k in (0, 1, 2, 3): place.append(log(cx + k, cy, cz, "x"))   # the axle into the mill
    for a in range(0, 360, 45):
        r = math.radians(a)
        place.append([cx, round(cy + math.sin(r) * (R_out + 1)), round(cz + math.cos(r) * (R_out + 1)), T.slab])

def level3(R):
    place, parts, shapes = level2(R)
    for z in range(-10, Z1 + 1): place += [[X0, 1, z, "air"], [X0, 2, z, "air"]]   # level 1's west fence, redrawn with the gate
    perimeter(place, open_west=True)
    parts.append(T.house("timber", rect=MILL, y=0, plinth=1, storeys=[5, 4], door={"side": "e", "kind": "large"}, ridge="z",
                         chimney=False, shutters=0.3,
                         windows={"s": [{"at": 0, "storey": 0, "w": 1, "h": 2}, {"at": 0, "storey": 1, "w": 1, "h": 2}],
                              "n": [{"at": 0, "storey": 1, "w": 1, "h": 2}],
                              "e": [{"at": -4, "storey": 1, "w": 1, "h": 2}, {"at": 4, "storey": 1, "w": 1, "h": 2}]}))
    # a gravel walk from the mill door to the yard gate in the fence
    for z in (-9, -8, -7): place.append([-8, 0, z, T.path(-8, z)])
    # the race: a stone channel of water along the west wall, the wheel turning in it
    for z in range(MILL[1] - 1, MILL[3] + 2):
        for x in (WHEEL_X - 1, WHEEL_X + 1):
            place += [[x, -1, z, T.stone_brick], [x, 0, z, T.stone_accent if noise(x, z, 9, 2) > 0.6 else T.stone_brick]]
        place += [[WHEEL_X, -2, z, T.stone_brick], [WHEEL_X, -1, z, "water"], [WHEEL_X, 0, z, "water"]]
    wheel(place, WHEEL_X, 3, -8)
    # inside: the hammer, a beam on the axle line with an iron head over an anvil
    place += [[-11, 1, -8, "anvil", {"facing": "n"}], [-11, 3, -8, "iron_block"]]
    return place, parts, shapes

def specs(ground=False, skill=SKILL, regions=("vale",)):
    """{name: spec} for the three levels of each region, each drawn over the last"""
    global T
    out = {}
    for region in regions:
        T = theme(region)
        for lv, fn in ((1, level1), (2, level2), (3, level3)):
            place, parts, shapes = fn(random.Random(147))
            x0, z0, x1, z1 = PIT
            skip = {(x, z) for x in range(x0, x1 + 1) for z in range(z0, z1 + 1)}
            for p in parts:
                a, b, c, d = p["rect"]
                skip |= {(x, z) for x in range(a, c + 1) for z in range(b, d + 1)}
            surf = []
            yard_surface(surf, skip | ({(x, z) for x in range(BLOOM_SITE[0], BLOOM_SITE[2] + 1) for z in range(BLOOM_SITE[1], BLOOM_SITE[3] + 1)} if lv < 2 else set()))
            place = surf + landscape(lv) + place
            if ground:
                xs = [p[0] for p in place]; zs = [p[2] for p in place]
                ground_plate(shapes, min(xs), min(zs), max(xs), max(zs))
            name = f"ironworks_{region}_{lv}"
            spec = {"name": name, "edition": "bedrock", "shapes": shapes, "parts": parts, "place": place}
            if T.snow:
                sys.path.insert(0, os.path.join(skill, "scripts"))
                from engine import compute  # noqa: E402
                blocks, _, _ = compute(spec)
                snow_cap(blocks, place)
            out[name] = spec
    return out


def names():
    return names_json("ironworks", "Ironworks", STAGES)


if __name__ == "__main__":
    a = sys.argv[1:]
    skill = a[a.index("--skill") + 1] if "--skill" in a else SKILL
    r = a[a.index("--region") + 1] if "--region" in a else "all"
    for name, spec in specs("--ground" in a, skill, ORDER if r == "all" else r.split(",")).items():
        json.dump(spec, open(os.path.join(a[0], name + ".json"), "w"))
    print("ok")
