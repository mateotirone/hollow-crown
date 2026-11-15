"""Write the windmill as building-skill specs, one per region (windmill_<region>.json).

    python3 gen_windmill.py

Mateo (2026-11-15): "fix the windmill system and also rebuild each region's windmill". Every settlement's field gets
a windmill when the field opens (Town), and each region's mill has its own shape, not the Vale mill in other blocks.
All five are the skill's `windmill` part (scripts/parts.py): a round tower in sections, floors inside with a ladder up
the main shaft, a door on the front, windows on the other sides, a cap, sails on the back, a mill inside (sack floor,
stone floor, cap floor), lit.

  Vale        a stage mill: two storeys of grey stone, a railed stage on brackets where it steps in, a timber cap
              storey (spruce planks, stripped spruce posts), a steep slate cone, four white lattice sails
  Frostmarch  a squat dark stone tower (three storeys of deepslate), a very steep dark oak cone with an ice finial,
              four lattice sails of grey cloth (no bright colours)
  Saltreach   a slender whitewashed tower (calcite and white concrete), a low sea-green cone, teal shutters, eight
              triangle sails of white cloth on birch poles, the cyan band of the harbour's ships on every other one
  Emberwaste  a broad sandstone tower with a flat deck behind a parapet and a low red dome, six triangle sails striped
              orange and white like the awnings (no timber frames, no steep roof)
  Blackfen    a mud brick tower on a tuff footing, a mangrove-framed cap storey, a low dark oak cone with moss on it,
              four lattice sails of patched grey and brown cloth

Frame (like the other plot buildings): the door faces south (+z) on the front wall z = 0, the tower is centred at
x 0, z -R1, the ground floor walked at y 1 (plinth 0 + 1). The sails stand on the north (back) side.
"""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))

def noise(*blocks, scale=3): return {"ladder": list(blocks), "axis": "noise", "scale": scale}
def up(code, **k): return dict({"ladder": code, "axis": "y"}, **k)

R = {
    "vale": dict(
        materials={"stone": up("VAL-01"), "slate": {"ladder": "VAL-06", "axis": "y", "reverse": True, "jitter": 0.04},
                   "plinth": noise("mossy_cobblestone", "cobblestone", "andesite")},
        sections=[{"r": 4.5, "storeys": [5, 5]}, {"r": 3.5, "storeys": [5], "material": "spruce_planks", "frame": "stripped_spruce_log",
                                                  "infill": "spruce_planks"}],
        material="stone", plinth="plinth", trim="dark_oak_planks", floor="spruce_planks",
        door={"side": "s", "door": "spruce_door"}, glass="brown_stained_glass_pane",
        gallery={"depth": 2, "rail": "dark_oak_fence", "deck": "spruce_planks"},
        cap={"type": "cone", "roof": "slate", "pitch": 2, "finial": "spire_block"},
        sails={"kind": "lattice", "count": 4, "arm": 9, "wood": "spruce", "lattice": "spruce_planks", "cloth": ["white_wool", "white_wool"]}),
    "frostmarch": dict(
        materials={"stone": up("FRO-01"), "plinth": noise("cobbled_deepslate", "deepslate_bricks", "cobbled_deepslate")},
        sections=[{"r": 4.5, "storeys": [5, 5, 4]}],
        material="stone", plinth="plinth", trim="spruce_planks", floor="spruce_planks",
        door={"side": "s", "door": "spruce_door"}, glass="white_stained_glass_pane",
        cap={"type": "cone", "roof": "dark_oak_planks", "pitch": 3, "finial": "rod"},
        sails={"kind": "lattice", "count": 4, "arm": 9, "wood": "dark_oak", "lattice": "spruce_planks",
               "cloth": ["light_gray_wool", "white_wool"]}),
    "saltreach": dict(
        materials={"wash": noise("calcite", "white_concrete", "calcite", scale=4), "plinth": noise("cobblestone", "andesite", "stone_bricks"),
                   "sea": {"ladder": "SAL-04", "axis": "y", "jitter": 0.05}},
        sections=[{"r": 3.5, "storeys": [5, 5, 5]}],
        material="wash", plinth="plinth", trim="birch_planks", floor="birch_planks",
        door={"side": "s", "door": "birch_door"}, glass="light_blue_stained_glass_pane", shutters="warped_trapdoor",
        cap={"type": "cone", "roof": "sea", "pitch": 1, "finial": "spire_block"},
        sails={"kind": "jib", "count": 8, "arm": 10, "wood": "birch", "stock": "stripped_birch_log",
               "cloth": ["white_wool", "white_wool"], "band": "cyan_wool"}),
    "emberwaste": dict(
        materials={"sand": up("EMB-01"), "plinth": noise("sandstone", "cut_sandstone", "sandstone"),
                   "red": {"ladder": ["smooth_red_sandstone", "red_sandstone", "smooth_red_sandstone"], "axis": "y"}},
        sections=[{"r": 4.5, "storeys": [5, 5]}],
        material="sand", plinth="plinth", trim="smooth_sandstone", floor="acacia_planks",
        door={"side": "s", "door": "acacia_door"}, glass="orange_stained_glass_pane",
        cap={"type": "dome", "roof": "red", "r": 3.5, "parapet": "cut_sandstone", "finial": "gold"},
        sails={"kind": "jib", "count": 6, "arm": 8, "wood": "acacia", "stock": "stripped_acacia_log",
               "cloth": ["orange_wool", "white_wool"], "band": "red_wool"}),
    "blackfen": dict(
        materials={"mud": up("BLK-01"), "plinth": noise("tuff", "mud_bricks", "tuff_bricks"),
                   "shingle": {"ladder": ["dark_oak_planks", "dark_oak_planks", "spruce_planks"], "axis": "noise", "scale": 2}},
        sections=[{"r": 4.5, "storeys": [5, 5], "material": "mud"},
                  {"r": 4.5, "storeys": [4], "material": "mud", "frame": "mangrove_log", "infill": "packed_mud"}],
        material="mud", plinth="plinth", trim="spruce_planks", floor="dark_oak_planks",
        door={"side": "s", "door": "mangrove_door"}, glass="green_stained_glass_pane",
        cap={"type": "cone", "roof": "shingle", "pitch": 1, "finial": "rod"},
        sails={"kind": "lattice", "count": 4, "arm": 9, "wood": "spruce", "lattice": "dark_oak_planks",
               "cloth": ["light_gray_wool", "brown_wool"]}),
}


def spec(region):
    r = R[region]
    R1 = int(r["sections"][0]["r"] - 0.5)
    part = {"part": "windmill", "name": f"windmill_{region}", "at": [0, -R1], "y": 0}
    for k in ("sections", "material", "plinth", "trim", "floor", "door", "glass", "shutters", "gallery", "cap", "sails"):
        if k in r: part[k] = r[k]
    return {"name": f"windmill_{region}", "edition": "bedrock", "materials": r["materials"], "parts": [part]}


if __name__ == "__main__":
    for region in R:
        p = os.path.join(HERE, f"windmill_{region}.json")
        json.dump(spec(region), open(p, "w"), indent=1)
        print("wrote", p)
