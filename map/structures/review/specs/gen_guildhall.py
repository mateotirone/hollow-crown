"""Writes kingsrest_guildhall.json: the guildhall on the skill. The belfry sits on the ridge, so its cells are
worked out from the built roof (run: python3 gen_guildhall.py)."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "..", "..", ".claude", "skills", "minecraft-builder", "scripts"))
import engine

COPPER = {"ladder": ["waxed_cut_copper", "waxed_exposed_cut_copper", "waxed_weathered_cut_copper", "waxed_oxidized_cut_copper"], "axis": "y"}   # green at the ridge
spec = {
    "name": "kingsrest_guildhall",
    "card": {"title": "Kingsrest guildhall", "sub": "Copper roof", "region": "vale", "where": "Kingsrest, on the square", "kind": "Civic",
             "blurb": "An open market arcade under the guild's hall, a copper roof and a belfry on the ridge. Built on the skill."},
    "parts": [
        {"part": "house", "style": {"base": "vale_stone", "roof": COPPER, "floor": {"ladder": ["polished_andesite", "stone_bricks"], "axis": "noise", "scale": 2}, "glass": "light_gray_stained_glass_pane"},
         "rect": [0, 0, 20, 12], "y": 0, "plinth": 1, "storeys": [6, 8], "bay": 3,
         "storey_style": [{}, {"floor": "spruce_planks"}],
         "door": None, "interior": {"use": "guildhall", "rooms": ["open", "hall"]},             # the arcade is open on all four sides, level with the ground (Mateo 2026-11-12)
         "windows": {"s": [{"at": a, "storey": 1, "w": 1, "h": 4} for a in (-8, -4, 4, 8)] + [{"at": 0, "storey": 1, "w": 3, "h": 4}],
                     "n": [{"at": a, "storey": 1, "w": 1, "h": 4} for a in (-8, -4, 0, 4, 8)],
                     "e": [{"at": a, "storey": 1, "w": 1, "h": 4} for a in (-4, 0, 4)], "w": [{"at": a, "storey": 1, "w": 1, "h": 4} for a in (-4, 0, 4)]},
         "roof": {"type": "gable", "ridge": "x", "pitch": 1}, "chimney": [[18, 3]], "vines": 0.03},
    ]
}
# the market arcade: round-angle arches between the piers on all four sides, at ground level (02, arched supports)
for z in (0, 12):
  for i in range(5): spec["parts"].append({"part": "arch", "at": [2 + 4 * i, 1, z], "axis": "x", "width": 3, "height": 5, "style": "round_angle", "material": "stone_bricks", "trim": "spruce_planks"})
for x in (0, 20):
    for i in range(3): spec["parts"].append({"part": "arch", "at": [x, 1, 2 + 4 * i], "axis": "z", "width": 3, "height": 5, "style": "round_angle", "material": "stone_bricks", "trim": "spruce_planks"})

blocks, stage_of, log = engine.compute(spec)
C = 10
ridge = max(y for (x, y, z), (n, p) in blocks.items() if x == C and z == 6 and stage_of.get((x, y, z)) == "roof")
pl = []
bx0, bx1, bz0, bz1 = C - 1, C + 1, 5, 7
for x in range(bx0, bx1 + 1):
    for z in range(bz0, bz1 + 1):
        for y in range(ridge - 1, ridge + 2): pl.append([x, y, z, "polished_andesite"])
for x, z in ((bx0, bz0), (bx1, bz0), (bx0, bz1), (bx1, bz1)):
    for y in range(ridge + 2, ridge + 5): pl.append([x, y, z, "stone_brick_wall"])
pl += [[C, ridge + 4, 6, "spruce_planks"], [C, ridge + 3, 6, "bell", {"attachment": "hanging"}]]
for x in range(bx0, bx1 + 1):
    for z in range(bz0, bz1 + 1):
        if (x, z) != (C, 6): pl.append([x, ridge + 2, z, "air"]) if (x, z) not in ((bx0, bz0), (bx1, bz0), (bx0, bz1), (bx1, bz1)) else None
yc = ridge + 5
BACK = {"s": "n", "n": "s", "e": "w", "w": "e"}
for x in range(bx0 - 1, bx1 + 2):
    for z in range(bz0 - 1, bz1 + 2):
        face = [k for k, v in {"s": z == bz1 + 1, "n": z == bz0 - 1, "e": x == bx1 + 1, "w": x == bx0 - 1}.items() if v]
        pl.append([x, yc, z, "waxed_weathered_cut_copper_stairs", {"facing": BACK[face[0]]}] if face else [x, yc, z, "waxed_oxidized_cut_copper"])
for x in range(bx0, bx1 + 1):
    for z in range(bz0, bz1 + 1):
        if (x, z) != (C, 6):
            f = "s" if z == bz1 else "n" if z == bz0 else "e" if x == bx1 else "w"
            pl.append([x, yc + 1, z, "waxed_oxidized_cut_copper_stairs", {"facing": BACK[f]}])
pl += [[C, yc + 1, 6, "waxed_oxidized_cut_copper"], [C, yc + 2, 6, "lightning_rod"]]
# a lantern in every arch crown
pl += [[2 + 4 * i, 4, z, "lantern", {"hanging": True}] for z in (0, 12) for i in range(5)]
pl += [[x, 4, 2 + 4 * i, "lantern", {"hanging": True}] for x in (0, 20) for i in range(3)]
spec["place"] = [p for p in pl if p]
json.dump(spec, open(os.path.join(HERE, "kingsrest_guildhall.json"), "w"), indent=1)
print("ridge", ridge, "warnings", log[:5])
