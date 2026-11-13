"""Write the Storehouse as building-skill specs: four levels in each region (storehouse_<level>_<region>.json).

    python3 gen_storehouse.py

Mateo (2026-11-13): "a custom storage building at your home ... you're not gonna be able to carry everything",
"it's gonna have to have custom builds and it's gonna have to upgrade with the town", and inside "chests ... on a
nine block grid ... facing sideways so you see the side of the chest" between stone pillars (his reference picture).

Every settlement gets one from the start: level 1 rises with the Hamlet and the game rebuilds it bigger on the same
ground at Town, City and Castle (settle/storehouse.js). The inside is the skill's "storehouse" use: 3 x 3 bays of
sideways chests between pillars of the region's stone, a beam of the same stone over each bay, and free-standing
racks down the middle of wide rooms (interiors.py, _chest_walls).

  level 1  Hamlet   Store Shed       9 x 9,  one storey
  level 2  Town     Storehouse      11 x 11, one storey
  level 3  City     Storehouse      13 x 13, two storeys
  level 4  Castle   Great Storehouse 13 x 13, three storeys

Frame (settle_buildings.py): front faces south (+z), the front wall on z = 0, the door in its middle (Mateo's big
plank door: a 3 x 3 cart opening), the ground floor walked at y 2 (plinth 2). Every level fits the 15 x 15 box
x -7..7, z -14..0 the starter village keeps for it. Each region starts from the preset its regions/<region>.md names.
"""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))

def noise(*blocks, scale=3): return {"ladder": list(blocks), "axis": "noise", "scale": scale}

LEVELS = {   # rect, storeys, attic, the tier it opens at
    1: dict(rect=[-4, -8, 4, 0], storeys=[5], tier="Hamlet", name="Store Shed"),
    2: dict(rect=[-5, -10, 5, 0], storeys=[5], tier="Town", name="Storehouse"),
    3: dict(rect=[-6, -12, 6, 0], storeys=[5, 5], tier="City", name="Storehouse"),
    4: dict(rect=[-6, -12, 6, 0], storeys=[5, 5, 5], tier="Castle", name="Great Storehouse"),
}

R = {
    "vale": dict(
        style={"base": "vale_timber", "frame": "stripped_spruce_log", "roof": "dark_oak_planks"},
        ground={"frame_kind": "stone", "frame": "stone_bricks", "infill": {"ladder": "VAL-01", "axis": "y"}},
        roof={"type": "gable", "ridge": "z", "pitch": 1}, pillar="stone_bricks", beam="stone_bricks"),
    "frostmarch": dict(
        style={"base": "frost_timber", "roof": "dark_oak_planks"},
        ground={"frame_kind": "stone", "frame": "deepslate_bricks", "infill": noise("cobbled_deepslate", "polished_deepslate")},
        roof={"type": "gable", "ridge": "z", "pitch": 2, "gable_horns": True, "snow": True},
        pillar="deepslate_bricks", beam="polished_deepslate"),
    "saltreach": dict(
        style={"base": "salt_atlantean", "roof": "dark_prismarine"},
        ground={}, roof={"type": "gable", "ridge": "z", "pitch": 1},
        pillar="prismarine_bricks", beam="smooth_quartz"),
    "emberwaste": dict(
        style={"base": "ember_sandstone", "roof": "smooth_sandstone"},
        ground={}, roof={"type": "flat", "parapet": "crenel", "beams": True},
        pillar="cut_sandstone", beam="smooth_sandstone"),
    "blackfen": dict(
        style={"base": "fen_timber"}, piles=True,
        ground={"frame_kind": "stone", "frame": "tuff_bricks", "infill": noise("mud_bricks", "packed_mud", scale=2)},
        roof={"type": "gable", "ridge": "z", "pitch": 1, "thatch": True},
        pillar="tuff_bricks", beam="polished_tuff"),
}
NAMES = {"vale": "Vale", "frostmarch": "Frostmarch", "saltreach": "Saltreach", "emberwaste": "Emberwaste", "blackfen": "Blackfen"}

def spec(level, region):
    L, g = LEVELS[level], R[region]
    x0, z0, x1, z1 = L["rect"]
    flat = g["roof"]["type"] == "flat"
    hatch = flat and len(L["storeys"]) > 1        # the roof terrace is reached from the two- and three-storey levels
    front = [{"at": a, "storey": 0, "w": 1, "h": 2, "sill": "slab"} for a in ((-3, 3) if x1 - x0 >= 8 else ())]
    for k in range(1, len(L["storeys"])): front += [{"at": a, "storey": k, "w": 1, "h": 2, "sill": "slab"} for a in (-3, 0, 3)]
    house = {"part": "house", "style": g["style"], "rect": L["rect"], "y": 0, "plinth": 2,
             "storeys": L["storeys"], "storey_style": [g["ground"], {}] if g["ground"] else [],
             "door": {"side": "s", "kind": "large", "steps": 1},
             "windows": {"s": front, "n": [], "e": [], "w": []}, "shutters": 0,
             "roof": dict(g["roof"], **({"hatch": True} if hatch else {})), "chimney": False,
             "interior": {"use": "storehouse", "attic": bool(L.get("attic")), "pillar": g["pillar"], "beam": g["beam"],
                          **({"hatch": True} if hatch else {})},
             "vines": 0.04 if region in ("vale", "blackfen") else 0,
             "bushes": False}   # the cart door opens on a working yard, and the 15 x 15 ground has no row to spare
    if g.get("piles"): house["piles"] = True
    return {
        "name": f"storehouse_{level}_{region}",
        "card": {"title": L["name"], "sub": f"{NAMES[region]}, level {level} ({L['tier']})", "region": region,
                 "where": "Every settlement, on the starter village's Storehouse ground (15 x 15); rebuilt bigger at each tier",
                 "kind": "Work",
                 "blurb": "Walls of chests turned sideways in 3 x 3 bays between stone pillars, a beam over each bay: "
                          "the settlement's storage, growing with the town."},
        "parts": [house],
    }

if __name__ == "__main__":
    for region in R:
        for level in LEVELS:
            open(os.path.join(HERE, f"storehouse_{level}_{region}.json"), "w").write(json.dumps(spec(level, region), indent=1))
    print("wrote", len(R) * len(LEVELS), "specs")
