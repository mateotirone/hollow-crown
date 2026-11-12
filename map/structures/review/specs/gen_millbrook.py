"""Writes millbrook_clock_tower.json and millbrook_watermill.json (the skill specs) with the one-off parts the
skill has no part for laid on the built shell: clock faces, the open belfry and spire, the paddle wheel."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "..", "..", ".claude", "skills", "minecraft-builder", "scripts"))
import engine

def top_of(spec, x0, z0, x1, z1):
    b, st, _ = engine.compute(spec)
    return max(y for (x, y, z) in b if x0 <= x <= x1 and z0 <= z <= z1 and st.get((x, y, z)) in ("walls", "frame"))

# ---------------- the clock tower: a 7 x 7 stone shaft, clock faces, an open belfry, a slate spire
tower = {"name": "millbrook_clock_tower",
         "card": {"title": "Millbrook clock tower", "sub": "Norman stone", "region": "vale", "where": "Millbrook, the square", "kind": "Civic",
                  "blurb": "A 7 by 7 stone shaft with string courses, clock faces on all four sides, an open belfry with a bell and a slate spire. Built on the skill."},
         "parts": [{"part": "house", "style": "vale_stone", "rect": [0, 0, 6, 6], "y": 0, "plinth": 2, "storeys": [5, 5, 6],
                    "door": {"side": "s", "kind": "house", "steps": 2},
                    "windows": {s: [{"at": 0, "storey": 1, "w": 1, "h": 2}] for s in "nsew"},
                    "roof": {"type": "flat"} , "chimney": False, "vines": 0.05}]}
tower["parts"][0].pop("roof")
tower["parts"][0]["roof"] = {"type": "hip", "pitch": 1, "overhang": 0}
top = top_of(tower, 0, 0, 6, 6)
pl = []
cy = top - 3                                           # clock faces in the top storey, 3 x 3 with a hub and hands
faces = {"s": lambda i, j: (2 + i, cy + j, 6), "n": lambda i, j: (4 - i, cy + j, 0), "e": lambda i, j: (6, cy + j, 4 - i), "w": lambda i, j: (0, cy + j, 2 + i)}
for side, f in faces.items():
    for i in range(3):
        for j in range(3): pl.append([*f(i, j), "calcite"])
    pl.append([*f(1, 1), "dark_oak_log", {"axis": "z" if side in "ns" else "x"}])
    pl.append([*f(1, 2), "polished_blackstone"]); pl.append([*f(2, 1), "polished_blackstone"])
yb = top + 1                                           # open belfry: corner piers, round-angle heads, a bell
for y in range(yb, yb + 8):                            # the shaft's own hip roof gives way to the belfry and spire
    for x in range(-2, 9):
        for z in range(-2, 9): pl.append([x, y, z, "air"])
for y in range(yb, yb + 3):
    for x in range(7):
        for z in range(7):
            edge = x in (0, 6) or z in (0, 6); corner = x in (0, 1, 5, 6) and z in (0, 1, 5, 6)
            if edge: pl.append([x, y, z, "stone_bricks" if (corner or y == yb + 2) else "air"])
            elif y == yb: pl.append([x, y - 1, z, "spruce_planks"])
for dz in (0, 6):
    pl += [[2, yb + 1, dz, "stone_brick_stairs", {"facing": "w", "half": "top"}], [4, yb + 1, dz, "stone_brick_stairs", {"facing": "e", "half": "top"}]]
for x in (0, 6):
    pl += [[x, yb + 1, 2, "stone_brick_stairs", {"facing": "n", "half": "top"}], [x, yb + 1, 4, "stone_brick_stairs", {"facing": "s", "half": "top"}]]
pl.append([3, yb + 2, 3, "spruce_planks"]); pl.append([3, yb + 1, 3, "bell", {"attachment": "hanging"}])
y = yb + 3
for k in range(5):                                     # stepped slate spire, one ring per row
    lo, hi = -1 + k, 7 - k
    if lo > hi: break
    for x in range(lo, hi + 1):
        for z in range(lo, hi + 1):
            if x in (lo, hi) or z in (lo, hi):
                f = "s" if z == lo else "n" if z == hi else "e" if x == lo else "w"
                corner = x in (lo, hi) and z in (lo, hi)
                pl.append([x, y, z, "deepslate_tiles"] if corner else [x, y, z, "deepslate_tile_stairs" if (x * 7 + z + y) % 3 else "deepslate_brick_stairs", {"facing": f}])
            else: pl.append([x, y, z, "deepslate_tiles"])
    y += 1
pl += [[3, y, 3, "stone_brick_wall"], [3, y + 1, 3, "stone_brick_wall"], [3, y + 2, 3, "lightning_rod"]]
tower["place"] = pl
json.dump(tower, open(os.path.join(HERE, "millbrook_clock_tower.json"), "w"), indent=1)

# ---------------- the watermill: stone below, timber above, a paddle wheel standing in the brook
mill = {"name": "millbrook_watermill",
        "card": {"title": "Millbrook watermill", "sub": "Stone and timber", "region": "vale", "where": "Millbrook, on the river", "kind": "Civic",
                 "blurb": "Stone ground floor on the bank, a stripped-spruce timber floor above under slate, and a 7-block paddle wheel in the brook. Built on the skill."},
        "parts": [{"part": "house", "style": {"base": "vale_timber", "frame": "stripped_spruce_log"}, "rect": [0, 0, 8, 8], "y": 0, "plinth": 2, "storeys": [5, 5],
                   "storey_style": [{"frame_kind": "stone", "frame": "stone_bricks", "infill": {"ladder": "VAL-01", "axis": "y"}}, {}],
                   "door": {"side": "s", "kind": "house", "steps": 2}, "roof": {"type": "gable", "ridge": "z", "pitch": 1}, "chimney": [[7, 2]],
                   "windows": {"w": [], "n": [{"at": 0, "storey": 0}, {"at": 0, "storey": 1}], "e": [{"at": 0, "storey": 0}, {"at": -2, "storey": 1}, {"at": 2, "storey": 1}],
                               "s": [{"at": -3, "storey": 1}, {"at": 3, "storey": 1}]},
                   "vines": 0.05},
                  {"part": "lean_to", "rect": [9, 1, 11, 5], "against": "w", "top": 5, "pitch": "half", "y": 0, "roof": "deepslate_tiles", "post": "stripped_spruce_log", "trim": "dark_oak_planks", "floor": "coarse_dirt"}]}
pl, cy, cz = [], 3, 4
for y in range(cy - 3, cy + 4):
    for z in range(cz - 3, cz + 4):
        d2 = (y - cy) ** 2 + (z - cz) ** 2
        if 6 <= d2 <= 10: pl.append([-2, y, z, "spruce_planks"])
        elif (y == cy or z == cz) and d2 < 6: pl.append([-2, y, z, "spruce_fence"])
for x in (-2, -1, 0): pl.append([x, cy, cz, "dark_oak_log", {"axis": "x"}])
for z in (cz - 4, cz + 4):
    for y in (0, 1): pl.append([-1, y, z, "stone_bricks"])
pl += [[-1, 2, cz - 4, "stone_brick_wall"], [-1, 2, cz + 4, "stone_brick_wall"]]
mill["place"] = pl
mill["stamp"] = {"wet_ok": [[-2, z] for z in range(cz - 3, cz + 4)], "wet_soft": [[-1, z] for z in range(-1, 10)] + [[-2, z] for z in (-1, 0, 8, 9)]}
json.dump(mill, open(os.path.join(HERE, "millbrook_watermill.json"), "w"), indent=1)
print("tower top", top)
