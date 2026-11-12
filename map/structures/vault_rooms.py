"""The Strongroom: the vault room a settlement keeps its relics in (Mateo, 2026-11-12: "I don't want it to
just be one block. I want it to be a room").

One room, five tiers. Upgrading the vault upgrades the whole room: its 3x3 door (studio/build_vault.py blocks),
the door frame, the walls, the floor and the lights. Inside, the Relic Coffer stands on a dais at the back.
Odd sizes throughout (Mateo's rule): 11 wide, 11 deep, 7 tall outside; 9 x 5 x 9 inside; the door 3 x 3.
The front faces south (+z), like every kit building; y = 0 is the floor.

    python3 vault_rooms.py OUT [--mcstructure]

Writes OUT/<tier>_strongroom/scene.json for each tier and OUT/inside_<tier>/scene.json (roof and front
left off, to see in) for the asset viewer's Builds tab. With --mcstructure also <tier>_strongroom.mcstructure.
"""
import argparse, os, sys

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from bp import Blueprint  # noqa: E402

W, D, H = 11, 11, 7                       # outside size
DOOR_X = (4, 5, 6)                         # the door's three columns, centred
DOOR_Y = (1, 2, 3)

# per tier: walls (main, accent band), floor, frame round the door, corner pillars, lights
TIERS = {
    "wood": {"wall": "cobbled_deepslate", "band": "stripped_dark_oak_log", "floor": "dark_oak_planks", "frame": "stripped_dark_oak_log",
             "pillar": "stripped_dark_oak_log", "light": "lantern", "roof": "cobbled_deepslate"},
    "iron": {"wall": "siege:vault_stone", "band": "polished_deepslate", "floor": "polished_deepslate", "frame": "iron_block",
             "pillar": "polished_deepslate", "light": "lantern", "roof": "deepslate_tiles"},
    "diamond": {"wall": "siege:vault_stone", "band": "polished_deepslate", "floor": "deepslate_tiles", "frame": "chiseled_deepslate",
                "pillar": "iron_block", "light": "sea_lantern", "roof": "deepslate_tiles"},
    "netherite": {"wall": "siege:vault_stone", "band": "gilded_blackstone", "floor": "polished_blackstone_bricks", "frame": "polished_blackstone_bricks",
                  "pillar": "chiseled_polished_blackstone", "light": "soul_lantern", "roof": "polished_blackstone_bricks"},
    "choirsteel": {"wall": "siege:vault_stone", "band": "amethyst_block", "floor": "polished_blackstone_bricks", "frame": "purpur_pillar",
                   "pillar": "amethyst_block", "light": "end_rod", "roof": "deepslate_tiles"},
}
NAMES = {"wood": "Wooden Strongroom", "iron": "Iron Strongroom", "diamond": "Diamond Strongroom",
         "netherite": "Netherite Strongroom", "choirsteel": "Choirsteel Strongroom"}


def strongroom(tier, cutaway=False):
    t = TIERS[tier]
    b = Blueprint(NAMES[tier])
    x1, z1, y1 = W - 1, D - 1, H - 1
    # shell: floor, four walls, roof
    b.fill(0, 0, 0, x1, 0, z1, t["floor"])
    for y in range(1, y1):
        for x in range(W):
            for z in range(D):
                if x in (0, x1) or z in (0, z1):
                    b.set(x, y, z, t["band"] if y == 4 else t["wall"])
    b.fill(0, y1, 0, x1, y1, z1, t["roof"])
    # corner pillars, floor to roof
    for x in (0, x1):
        for z in (0, z1):
            b.fill(x, 1, z, x, y1, z, t["pillar"], axis="y")
    # the 3x3 door in the front wall, wheel (or lock) in the centre, plates round it, all facing out
    for x in DOOR_X:
        for y in DOOR_Y:
            centre = x == DOOR_X[1] and y == DOOR_Y[1]
            b.set(x, y, z1, f"siege:vault_door_{tier}" if centre else f"siege:vault_door_plate_{tier}", facing="s")
    # frame round the door: posts both sides and a lintel over it
    for y in range(1, 5):
        b.set(DOOR_X[0] - 1, y, z1, t["frame"], axis="y")
        b.set(DOOR_X[-1] + 1, y, z1, t["frame"], axis="y")
    for x in range(DOOR_X[0] - 1, DOOR_X[-1] + 2):
        b.set(x, 4, z1, t["frame"], axis="x")
    # inside: air, a raised dais at the back with the Relic Coffer on it
    b.fill(1, 1, 1, x1 - 1, y1 - 1, z1 - 1, "air")
    b.fill(3, 1, 1, 7, 1, 3, t["band"] if tier != "wood" else "polished_deepslate", axis="x")
    b.set(5, 2, 2, "siege:relic_coffer", facing="s")
    # shelves of chests and barrels along the side walls, lights in the corners
    for z in (3, 5, 7):
        b.set(1, 1, z, "barrel", facing="e")
        b.set(x1 - 1, 1, z, "chest", facing="w")
    for x, z in ((1, 1), (x1 - 1, 1), (1, z1 - 1), (x1 - 1, z1 - 1)):
        b.set(x, 1, z, t["light"])
    b.set(2, 2, 1, t["light"]); b.set(8, 2, 1, t["light"])
    if cutaway:
        # to look in: no roof, and the front and right walls cut down to knee height (the door stays)
        b.fill(0, y1, 0, x1, y1, z1, "air")
        for y in range(2, y1):
            for x in range(W):
                if x not in range(DOOR_X[0] - 1, DOOR_X[-1] + 2):
                    b.set(x, y, z1, "air")
            for z in range(D):
                b.set(x1, y, z, "air")
    return b.finish()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("out"); ap.add_argument("--mcstructure", action="store_true")
    a = ap.parse_args()
    for tier in TIERS:
        for key, cut in ((f"{tier}_strongroom", False), (f"inside_{tier}", True)):
            d = os.path.join(a.out, key); os.makedirs(d, exist_ok=True)
            b = strongroom(tier, cut)
            b.save_logical(os.path.join(d, "scene.json"))
            if a.mcstructure and not cut:
                b.save_mcstructure(os.path.join(a.out, key + ".mcstructure"))
        print("strongroom", tier)
