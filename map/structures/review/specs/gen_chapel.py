"""Writes kingsrest_chapel.json from kingsrest_chapel.base.json: the tower's spire is laid on the built tower top
(a broach spire: rings of steep stairs stepping in, 2 rows per step, a finial). python3 gen_chapel.py"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "..", "..", ".claude", "skills", "minecraft-builder", "scripts"))
import engine
spec = json.load(open(os.path.join(HERE, "kingsrest_chapel.base.json")))
blocks, stage_of, log = engine.compute(spec)
cx, cz = 5, 21
top = max(y for (x, y, z) in blocks if 3 <= x <= 7 and 19 <= z <= 23 and stage_of.get((x, y, z)) in ("walls", "frame"))
pl = []
y = top + 1
for half in (3, 2, 1):                       # 7x7 eave ring, then 5x5, 3x3
    for k in range(2):
        for x in range(cx - half, cx + half + 1):
            for z in range(cz - half, cz + half + 1):
                edge = max(abs(x - cx), abs(z - cz)) == half
                if not edge:
                    pl.append([x, y, z, "deepslate_tiles"]); continue
                f = "s" if z == cz - half else "n" if z == cz + half else "e" if x == cx - half else "w"
                corner = abs(x - cx) == half and abs(z - cz) == half
                pl.append([x, y, z, "deepslate_tile_stairs" if (x + y + z) % 3 else "deepslate_brick_stairs", {"facing": f}] if not corner else [x, y, z, "deepslate_tiles"])
        y += 1
        if half == 3: break                 # the eave ring is one row
for k in range(3): pl.append([cx, y + k, cz, "deepslate_tile_wall" if k < 2 else "deepslate_tiles"])
pl.append([cx, y + 3, cz, "lightning_rod"])
# louvres in the bell storey: the top windows of the tower become trapdoor louvres
spec["place"] = spec.get("place", []) + pl
spec["parts"][-1]["roof"] = {"type": "hip", "pitch": 1, "overhang": 1}
json.dump(spec, open(os.path.join(HERE, "kingsrest_chapel.json"), "w"), indent=1)
print("tower top", top)
