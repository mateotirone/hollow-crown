"""Writes millbrook_clock_tower.json and millbrook_watermill.json (the skill specs) with the one-off parts the
skill has no part for laid on the built shell: clock faces, the open belfry and spire, the paddle wheel."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "..", "..", ".claude", "skills", "minecraft-builder", "scripts"))
import engine

def top_of(spec, x0, z0, x1, z1):
    b, st, _ = engine.compute(spec)
    return max(y for (x, y, z) in b if x0 <= x <= x1 and z0 <= z <= z1 and st.get((x, y, z)) in ("walls", "frame"))

# ---------------- the clock tower (build-instructions/towers/README.md, Mateo 2026-11-12): a 7 x 7 stone shaft in
# two stages marked by string courses, a stripped-spruce clock stage jettied one out on brackets with a framed
# 5 x 5 clock on every face, a steep slate helm with a flared eave, and an open lantern with its own spire on top.
SY = 19                                                  # the clock stage's floor (the shaft's plate is 18)
tower = {"name": "millbrook_clock_tower",
         "card": {"title": "Millbrook clock tower", "sub": "Norman stone", "region": "vale", "where": "Millbrook, the square", "kind": "Civic",
                  "blurb": "A stone shaft in two stages, a timber clock stage jettied out on brackets with a framed clock on every face, a steep slate helm and an open bell lantern on top. Built on the skill."},
         "parts": [
             {"part": "house", "style": "vale_stone", "rect": [0, 0, 6, 6], "y": 0, "plinth": 2, "storeys": [6, 6, 6],
              "door": {"side": "s", "kind": "house", "steps": 2},
              "windows": {sd: [{"at": 0, "storey": 1, "w": 1, "h": 2}, {"at": 0, "storey": 2, "w": 1, "h": 3}] for sd in "nsew"},
              "roof": {"type": "flat"}, "chimney": False, "vines": 0.05, "bushes": False},
             {"part": "house", "style": {"base": "vale_timber", "frame": "stripped_spruce_log", "infill": "spruce_planks"}, "rect": [-1, -1, 7, 7], "y": SY, "plinth": 1,
              "storeys": [8], "door": None, "windows": {"n": [], "s": [], "e": [], "w": []}, "roof": {"type": "flat"}, "chimney": False, "bushes": False},
             {"part": "spire", "rect": [-1, -1, 7, 7], "rows": 3, "overhang": 1, "roof": {"block": "deepslate_tiles"}, "trim": "dark_oak_planks", "finial": "none"},
             {"part": "belfry", "rect": [2, 2, 4, 4], "y": "roof", "h": 3, "pier": "dark_oak_fence", "deck": "dark_oak_planks", "trim": "dark_oak_planks",
              "roof": {"block": "deepslate_tiles"}, "cap": "spire", "rows": 2, "finial": "spire_block"},
         ] + [{"part": "clock_face", "rect": [-1, -1, 7, 7], "side": sd, "y": SY + 4, "size": 5, "time": "3:00", "frame": "stairs", "frame_wood": "dark_oak", "hub": "dark_oak_button"} for sd in "nsew"]}
pl = []
for x in range(-1, 8):                                   # brackets under the jetty: corners and every other block
    for z in range(-1, 8):
        if 0 <= x <= 6 and 0 <= z <= 6: continue
        if (x in (-1, 7)) and (z in (-1, 7)): continue
        sd = "s" if z == -1 else "n" if z == 7 else "e" if x == -1 else "w"
        t = x if z in (-1, 7) else z
        if t % 2 == 0: pl.append([x, SY - 1, z, "dark_oak_stairs", {"facing": sd, "half": "top"}])
tower["place"] = pl
json.dump(tower, open(os.path.join(HERE, "millbrook_clock_tower.json"), "w"), indent=1)
top = SY

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
