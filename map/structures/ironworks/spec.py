"""Ironworks specs for the minecraft-builder skill, one per level, each drawn over the last.
Skill frame: x east, y up, z south; the front (gate, Ironworks block) faces south (+z). Yard x -7..7, z -15..-1 (15 x 15).
Usage: python3 spec.py OUTDIR [--ground]  -> OUTDIR/ironworks_1.json .. _3.json (--ground adds a grass plate for pictures)
Built with the minecraft-builder skill (the one building engine, Mateo 2026-11-12). Viewer: ../ironworks_builds.py.
"""
import json, random, sys, math

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
TRACK = [(0, -1, -3, 1), (-5, -10, -6, 0), (4, -8, -3, 0)]  # (x, z from, z to, half width): gate to pit, storeroom door, bloomery door

def yard_surface(place, skip):
    """Worked earth: coarse dirt, damp packed mud in patches, a worn gravel and cobble track from the gate to
    each door and the pit, rooted dirt only along the fence where nobody walks."""
    for x in range(X0, X1 + 1):
        for z in range(Z0, Z1 + 1):
            if (x, z) in skip: continue
            n = noise(x, z, 1)
            on_track = any(abs(x - tx) <= w and min(za, zb) <= z <= max(za, zb) for tx, za, zb, w in TRACK) or (z == -6 and -5 <= x <= 4)
            if on_track: b = "cobblestone" if noise(x, z, 2, 2) > 0.62 else "gravel"
            elif x in (X0, X1) or z == Z0: b = "dirt_with_roots" if n > 0.55 else "coarse_dirt"
            else: b = "packed_mud" if n < 0.3 else "coarse_dirt" if n < 0.78 else "gravel"
            place.append([x, 0, z, b])

def ground_plate(shapes, x0, z0, x1, z1):
    """Render only: grass round the build and earth under it, so it reads as standing in the world"""
    shapes.append({"shape": "box", "min": [x0 - 3, -2, z0 - 3], "max": [x1 + 3, -1, z1 + 3], "material": "dirt"})
    shapes.append({"shape": "box", "min": [x0 - 3, 0, z0 - 3], "max": [x1 + 3, 0, z1 + 3], "material": "grass_block"})

def log(x, y, z, axis="y"): return [x, y, z, "stripped_spruce_log", {"axis": axis}]

def perimeter(place, open_west=False):
    """Fence round the yard: log posts 2 high at corners and gate jambs (runs of 5 and 3 between, odd),
    spruce fence between, a 3 wide gate in the front with lanterns on its posts. Buildings close the back."""
    posts = {(X0, Z1), (-2, Z1), (2, Z1), (X1, Z1), (X0, -5), (X1, -5), (X1, -9), (X0, -9)}
    if open_west: posts |= {(X0, -3), (X0, -7)}
    fence = set()
    for x in range(X0, X1 + 1):
        if abs(x) > 1: fence.add((x, Z1))
    for z in range(-10, Z1 + 1):
        fence.add((X0, z)); fence.add((X1, z))
    for x in range(-2, 1): fence.add((x, Z0))   # the alley between storeroom and bloomery
    if open_west:
        for z in (-6, -5, -4): fence.discard((X0, z))
        posts.discard((X0, -5))
    for (x, z) in sorted(fence - posts): place.append([x, 1, z, "spruce_fence"])
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
                if y == 0: place.append([x, y, z, "stone_bricks" if noise(x, z, 5, 1.5) < 0.6 else "mossy_stone_bricks"])
                else:  # shaft walls: stone getting darker down, iron showing
                    r = R.random()
                    place.append([x, y, z, "iron_ore" if r < 0.18 else "cobblestone" if r < 0.45 else "stone" if y > -3 else "tuff"])
            if not inner:
                corner = x in (x0, x1) and z in (z0, z1)
                if corner: place.append([x, 1, z, "stone_brick_wall"])
                elif not (x == 0 and z == z0): place.append([x, 1, z, "stone_brick_slab"])
    for y in range(-4, 1): place.append([0, y, z0 + 1, "ladder", {"facing": "s"}])
    # windlass over the shaft: two posts on the curb, a beam, upside-down stair braces, chain and bucket, crank
    zc = (z0 + z1) // 2
    for x in (x0, x1):
        for y in range(1, 5): place.append(log(x, y, zc))
    for x in range(x0 - 1, x1 + 2): place.append(log(x, 5, zc, "x"))
    place += [[x0 + 1, 4, zc, "spruce_stairs", {"facing": "w", "half": "top"}], [x1 - 1, 4, zc, "spruce_stairs", {"facing": "e", "half": "top"}]]
    place += [[0, 4, zc, "iron_chain"], [0, 3, zc, "iron_chain"], [0, 2, zc, "cauldron"]]
    place += [[x1 + 1, 4, zc, "spruce_fence"], [x0 - 1, 4, zc, "lantern", {"hanging": True}]]

def level1(R):
    place, parts, shapes = [], [], []
    perimeter(place)
    ore_pit(R, place)
    # the ore heap left of the pit: a low mound of spoil, raw iron on top, slabs round its foot
    place += [[-5, 1, -6, "gravel"], [-5, 1, -5, "gravel"], [-5, 2, -6, "raw_iron_block"], [-5, 1, -4, "iron_ore"],
              [-4, 1, -6, "cobblestone_slab"], [-4, 1, -5, "cobblestone_slab"], [-5, 1, -7, "cobblestone_slab"], [-6, 1, -5, "cobblestone_slab"],
              [-6, 1, -6, "gravel"], [-4, 1, -4, "cobblestone_slab"]]
    # storeroom: a small timber house at the back left, door to the yard
    parts.append({"part": "house", "style": "vale_timber", "rect": STORE, "y": 0, "plinth": 1, "storeys": [5],
                  "door": {"side": "s", "kind": "house"}, "roof": {"type": "gable", "ridge": "z"}, "chimney": False, "shutters": 0,
                  "windows": {"e": [{"at": 0, "storey": 0, "w": 1, "h": 2}], "w": [{"at": 0, "storey": 0, "w": 1, "h": 2}]}})
    place += [[-2, 1, -14, "barrel"], [-2, 1, -13, "barrel"], [-2, 2, -14, "barrel", {"facing": "u"}]]
    # by the gate: chopping block and tool barrel
    place += [[5, 1, -2, "stripped_oak_log", {"axis": "y"}], [6, 1, -2, "barrel"], [-6, 1, -2, "composter"]]
    return place, parts, shapes

def level2(R):
    place, parts, shapes = level1(R)
    parts.append({"part": "house", "style": "vale_stone", "rect": BLOOM, "y": 0, "plinth": 1, "storeys": [5],
                  "door": {"side": "s", "kind": "large"}, "roof": {"type": "gable", "ridge": "z"}, "chimney": [[4, -13]], "shutters": 0,
                  "windows": {"e": [{"at": -2, "storey": 0, "w": 1, "h": 2}, {"at": 2, "storey": 0, "w": 1, "h": 2}]}})
    # the bloomery hearth inside against the back wall, under the chimney
    place += [[3, 2, -14, "blast_furnace", {"facing": "s"}], [4, 2, -14, "blast_furnace", {"facing": "s"}], [5, 2, -14, "blast_furnace", {"facing": "s"}],
              [3, 1, -14, "stone_bricks"], [4, 1, -14, "stone_bricks"], [5, 1, -14, "stone_bricks"]]
    # work yard in front: anvil on a log, quench tub, grindstone, a charcoal bin of trapdoor sides
    place += [[6, 1, -6, "anvil", {"facing": "e"}], [6, 1, -7, "cauldron"], [6, 1, -4, "grindstone"]]
    for x in (3, 4, 5):
        place += [[x, 1, -2, "coal_block"], [x, 1, -3, "spruce_trapdoor", {"facing": "s", "open": True}]]
    place += [[2, 1, -2, "spruce_trapdoor", {"facing": "w", "open": True}] if False else [2, 1, -2, "stripped_spruce_log", {"axis": "y"}]]
    for d in range(len(place) - 1, -1, -1):  # the chopping block moves for the bin
        if place[d][:3] == [5, 1, -2] and place[d][3] == "stripped_oak_log": del place[d]
    return place, parts, shapes

def wheel(place, cx, cy, cz, R_out=3.5):
    for y in range(int(cy - 5), int(cy + 6)):
        for z in range(int(cz - 5), int(cz + 6)):
            d = math.hypot(y - cy, z - cz)
            if 2.5 <= d <= R_out: place.append([cx, y, z, "spruce_planks"])
            elif d < 2.5 and (y == cy or z == cz): place.append(log(cx, y, z, "y" if z == cz else "z"))
    for k in (0, 1, 2, 3): place.append(log(cx + k, cy, cz, "x"))   # the axle into the mill
    for a in range(0, 360, 45):
        r = math.radians(a)
        place.append([cx, round(cy + math.sin(r) * (R_out + 1)), round(cz + math.cos(r) * (R_out + 1)), "spruce_slab"])

def level3(R):
    place, parts, shapes = level2(R)
    perimeter(place, open_west=True)
    parts.append({"part": "house", "style": "vale_timber", "rect": MILL, "y": 0, "plinth": 1, "storeys": [5, 4],
                  "door": {"side": "e", "kind": "large"}, "roof": {"type": "gable", "ridge": "z"}, "chimney": False, "shutters": 0.3,
                  "windows": {"s": [{"at": 0, "storey": 0, "w": 1, "h": 2}, {"at": 0, "storey": 1, "w": 1, "h": 2}],
                              "n": [{"at": 0, "storey": 1, "w": 1, "h": 2}],
                              "e": [{"at": -4, "storey": 1, "w": 1, "h": 2}, {"at": 4, "storey": 1, "w": 1, "h": 2}]}})
    # a gravel walk from the mill door to the yard gate in the fence
    for z in (-6, -5, -4): place += [[X0, 1, z, "air"], [X0, 2, z, "air"]]
    for x in (-8, -7): place.append([x, 0, -5, "gravel"])
    # the race: a stone channel of water along the west wall, the wheel turning in it
    for z in range(MILL[1] - 1, MILL[3] + 2):
        for x in (WHEEL_X - 1, WHEEL_X + 1):
            place += [[x, -1, z, "stone_bricks"], [x, 0, z, "mossy_stone_bricks" if noise(x, z, 9, 2) > 0.6 else "stone_bricks"]]
        place += [[WHEEL_X, -2, z, "stone_bricks"], [WHEEL_X, -1, z, "water"], [WHEEL_X, 0, z, "water"]]
    wheel(place, WHEEL_X, 3, -8)
    # inside: the hammer, a beam on the axle line with an iron head over an anvil
    place += [[-11, 1, -8, "anvil", {"facing": "n"}], [-11, 3, -8, "iron_block"]]
    return place, parts, shapes

def specs(ground=False):
    """{name: spec} for the three levels, each drawn over the last"""
    out = {}
    for lv, fn in ((1, level1), (2, level2), (3, level3)):
        place, parts, shapes = fn(random.Random(147))
        x0, z0, x1, z1 = PIT
        skip = {(x, z) for x in range(x0, x1 + 1) for z in range(z0, z1 + 1)}
        for p in parts:
            a, b, c, d = p["rect"]
            skip |= {(x, z) for x in range(a, c + 1) for z in range(b, d + 1)}
        surf = []
        yard_surface(surf, skip)
        place = surf + place
        if ground:
            xs = [p[0] for p in place]; zs = [p[2] for p in place]
            ground_plate(shapes, min(xs), min(zs), max(xs), max(zs))
        out[f"ironworks_{lv}"] = {"name": f"ironworks_{lv}", "edition": "bedrock", "shapes": shapes, "parts": parts, "place": place}
    return out


if __name__ == "__main__":
    import os
    for name, spec in specs("--ground" in sys.argv).items():
        json.dump(spec, open(os.path.join(sys.argv[1], name + ".json"), "w"))
    print("ok")
