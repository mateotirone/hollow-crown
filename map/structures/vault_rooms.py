"""The Strongroom: the vault room a settlement keeps its relics in.

Mateo's design (2026-11-12): the town hall's board has "Add Vault". Pay, and a starter vault is dug out
underground with a staircase carved down to it. At the bottom is the Vault Lock in the wall beside a 3x3
door; click the lock with the Vault Key and the door swings open (the gates' swing). The room is built out
behind the lock. Every tier is a bigger room, styled by the material it was reinforced with. Inside:
containers along the walls and a floating stand for each relic (Crown, Heart, Choirsteel template).

Odd sizes throughout (Mateo's rule). Inside: wood 7x7, iron 9x9, diamond 11x11, netherite 13x13,
choirsteel 15x15. The door faces south (+z) and the stairs climb away south from it; y = 0 is the floor.

    python3 vault_rooms.py OUT [--mcstructure]

Writes OUT/<tier>_strongroom/scene.json (the room with its stairs) and OUT/inside_<tier>/scene.json (roof
and the near walls left off, to see in) for the asset viewer's Builds tab. With --mcstructure also
<tier>_strongroom.mcstructure for the game to stamp.
"""
import argparse, os, sys

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from bp import Blueprint  # noqa: E402

# per tier: inside width/depth and height, walls (main, accent band), floor, frame round the door, corner and
# inner pillars, lights, carpet runner, roof
TIERS = {
    "wood": {"inside": 7, "height": 5, "wall": "cobbled_deepslate", "band": "stripped_dark_oak_log", "floor": "dark_oak_planks",
             "frame": "stripped_dark_oak_log", "pillar": "stripped_dark_oak_log", "light": "lantern", "carpet": None, "roof": "cobbled_deepslate",
             "plinth": "stripped_dark_oak_log"},
    "iron": {"inside": 9, "height": 5, "wall": "siege:vault_stone", "band": "polished_deepslate", "floor": "polished_deepslate",
             "frame": "iron_block", "pillar": "polished_deepslate", "light": "lantern", "carpet": "gray_carpet", "roof": "deepslate_tiles",
             "plinth": "iron_block"},
    "diamond": {"inside": 11, "height": 5, "wall": "siege:vault_stone", "band": "polished_deepslate", "floor": "deepslate_tiles",
                "frame": "polished_deepslate", "pillar": "iron_block", "light": "sea_lantern", "carpet": "cyan_carpet", "roof": "deepslate_tiles",
                "plinth": "iron_block"},
    "netherite": {"inside": 13, "height": 7, "wall": "siege:vault_stone", "band": "gilded_blackstone", "floor": "polished_blackstone_bricks",
                  "frame": "polished_blackstone_bricks", "pillar": "chiseled_polished_blackstone", "light": "soul_lantern", "carpet": "red_carpet",
                  "roof": "polished_blackstone_bricks", "plinth": "gilded_blackstone"},
    "choirsteel": {"inside": 15, "height": 7, "wall": "siege:vault_stone", "band": "amethyst_block", "floor": "polished_blackstone_bricks",
                   "frame": "purpur_pillar", "pillar": "amethyst_block", "light": "end_rod", "carpet": "purple_carpet", "roof": "deepslate_tiles",
                   "plinth": "amethyst_block"},
}
NAMES = {"wood": "Wooden Strongroom", "iron": "Iron Strongroom", "diamond": "Diamond Strongroom",
         "netherite": "Netherite Strongroom", "choirsteel": "Choirsteel Strongroom"}


def strongroom(tier, cutaway=False):
    t = TIERS[tier]
    n, h = t["inside"], t["height"]
    W = D = n + 2
    x1, z1, y1 = W - 1, D - 1, h + 1
    mid = W // 2
    door_x = (mid - 1, mid, mid + 1)
    b = Blueprint(NAMES[tier])

    # shell: floor, walls with an accent band, roof, corner pillars
    b.fill(0, 0, 0, x1, 0, z1, t["floor"])
    band = 4 if h == 5 else 5
    for y in range(1, y1):
        for x in range(W):
            for z in range(D):
                if x in (0, x1) or z in (0, z1):
                    b.set(x, y, z, t["band"] if y == band else t["wall"], axis="x")
    b.fill(0, y1, 0, x1, y1, z1, t["roof"])
    for x in (0, x1):
        for z in (0, z1):
            b.fill(x, 1, z, x, y1, z, t["pillar"], axis="y")

    # the door: 3x3, wheel in the centre, plates round it, facing out; frame posts and lintel
    for x in door_x:
        for y in (1, 2, 3):
            centre = x == mid and y == 2
            b.set(x, y, z1, f"siege:vault_door_{tier}" if centre else f"siege:vault_door_plate_{tier}", facing="s")
    for y in range(1, 5):
        b.set(mid - 2, y, z1, t["frame"], axis="y")
        b.set(mid + 2, y, z1, t["frame"], axis="y")
    for x in range(mid - 2, mid + 3):
        b.set(x, 4, z1, t["frame"], axis="x")
    # the Vault Lock, in the wall to the right of the door at hand height
    b.set(mid + 3, 2, z1, f"siege:vault_lock_{tier}", facing="s")
    b.markers["lock"] = (mid + 3, 2, z1)

    # inside
    b.fill(1, 1, 1, x1 - 1, y1 - 1, z1 - 1, "air")
    # relic stands along the back wall: Crown in the middle, Heart and template either side
    for k, x in (("crown", mid), ("heart", mid - 2), ("template", mid + 2)):
        b.set(x, 1, 2, t["plinth"], axis="y")
        b.markers[f"stand_{k}"] = (x, 2, 2)   # the floating stand entity goes here
    b.set(mid - 1, 1, 1, t["light"]); b.set(mid + 1, 1, 1, t["light"])
    # containers down both side walls (Relic Coffers), more as the room grows; barrels in the far corners
    for z in range(3, z1 - 1, 2):
        b.set(1, 1, z, "siege:relic_coffer", facing="e")
        b.set(x1 - 1, 1, z, "siege:relic_coffer", facing="w")
        if z + 1 < z1 - 1:
            b.set(1, 1, z + 1, t["light"]); b.set(x1 - 1, 1, z + 1, t["light"])
    b.set(1, 1, 1, "barrel", facing="u"); b.set(x1 - 1, 1, 1, "barrel", facing="u")
    # big rooms get inner pillars and a carpet runner from the door to the stands
    if n >= 11:
        for x in (2, x1 - 2):
            for z in (2, z1 - 2):
                if b.get(x, 1, z)[0] == "air":
                    b.fill(x, 1, z, x, y1 - 1, z, t["pillar"], axis="y")
    if t["carpet"]:
        for z in range(3, z1):
            b.set(mid, 1, z, t["carpet"])

    # the staircase carved down from the surface: three wide, climbing south from the door. In the world the
    # ground it is cut through is its walls, so only the steps are part of the build.
    steps = h + 2
    for i in range(steps):
        for x in range(mid - 1, mid + 2):
            b.set(x, i, z1 + 1 + i, t["floor"])
    b.markers["stairs_top"] = (mid, steps, z1 + steps)

    if cutaway:
        # to look in: no roof, and the right wall and front wall (except the door and lock) cut to knee height
        b.fill(0, y1, 0, x1, y1, z1, "air")
        for y in range(2, y1):
            for z in range(D):
                b.set(x1, y, z, "air")
            for x in range(W):
                if not (mid - 2 <= x <= mid + 3):
                    b.set(x, y, z1, "air")
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
        print("strongroom", tier, f"{TIERS[tier]['inside']}x{TIERS[tier]['inside']} inside")
