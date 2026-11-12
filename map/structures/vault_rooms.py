"""The Strongroom: the vault room a settlement keeps its relics in.

Mateo's design (2026-11-12): the town hall's board has "Add Vault". Pay, and a starter vault is dug out
underground with a staircase carved down to it. At the bottom is the Vault Lock in the wall beside a 3x3
door; click the lock with the Vault Key and the door swings open (the gates' swing). The room is built out
behind the lock. Every tier is a bigger room, styled by the material it was reinforced with. Inside:
containers along the walls and a floating stand for each relic (Crown, Heart, Choirsteel template).

Odd sizes throughout (Mateo's rule). Inside: wood 7x7, iron 9x9, diamond 11x11, netherite 13x13,
choirsteel 15x15. The door faces south (+z) and the stairs climb away south from it; y = 0 is the floor.

    python3 vault_rooms.py OUT [--mcstructure]

Three layouts per tier for Mateo to compare (LAYOUTS): treasury, hall, crypt. Writes
OUT/<tier>_<layout>/scene.json (the room with its stairs) and OUT/<tier>_<layout>_inside/scene.json (roof and
the near walls left off, to see in) plus OUT/names.json for the asset viewer's Builds tab. With --mcstructure
also <tier>_<layout>.mcstructure for the game to stamp.
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


LAYOUTS = {
    "treasury": "Treasury: stands along the back wall, coffers down both sides",
    "hall": "Pillared hall: columns down both sides, stands up on a stepped dais",
    "crypt": "Crypt: a raised relic dais in the middle, coffers between wall piers, stair-block cornice",
}


def _stairs(floor):
    from kit import stairs_of
    return stairs_of(floor)


ENTRY = 3   # depth of the entrance landing in front of the vault door


def shell(b, t, tier, n, h):
    """Floor, walls with an accent band, roof, corner pillars, the 3x3 door with its frame, the Vault Lock,
    and the stair-block staircase climbing south from the door. Returns (W, D, x1, z1, y1, mid)."""
    W = D = n + 2
    x1, z1, y1 = W - 1, D - 1, h + 1
    mid = W // 2
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
    for x in (mid - 1, mid, mid + 1):
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
    b.fill(1, 1, 1, x1 - 1, y1 - 1, z1 - 1, "air")
    # the entrance hall: a 7-wide, 3-deep landing in front of the door, so the door and the lock are
    # reached from flat ground and never from the stairs. Walls, ceiling and corner posts in the tier's style.
    ex0, ex1 = mid - 4, mid + 4            # its side walls (the lock at mid+3 sits inside the landing)
    ez0, ez1 = z1 + 1, z1 + ENTRY          # the landing floor rows
    ezw = ez1 + 1                          # its south wall, with the 3-wide opening to the stairs
    eh = 5                                 # ceiling height
    b.fill(ex0, 0, ez0, ex1, 0, ezw, t["floor"])
    for z in range(ez0, ezw + 1):
        for y in range(1, eh):
            for x in (ex0, ex1):
                b.set(x, y, z, t["band"] if y == 4 else t["wall"], axis="x")
    for x in range(ex0 + 1, ex1):
        for y in range(1, eh):
            b.set(x, y, ezw, "air" if abs(x - mid) <= 1 and y <= 3 else t["wall"], axis="x")
    b.fill(ex0, eh, ez0, ex1, eh, ezw, t["roof"])
    for x in (ex0, ex1):
        b.fill(x, 1, ezw, x, eh, ezw, t["pillar"], axis="y")
    for x in range(mid - 2, mid + 3):
        b.set(x, 4, ezw, t["frame"], axis="x")
    b.set(mid - 2, 1, ezw, t["frame"], axis="y"); b.set(mid + 2, 1, ezw, t["frame"], axis="y")
    for y in (2, 3):
        b.set(mid - 2, y, ezw, t["frame"], axis="y"); b.set(mid + 2, y, ezw, t["frame"], axis="y")
    b.set(ex0 + 1, 1, ez1, t["light"]); b.set(ex1 - 1, 1, ez1, t["light"])
    if t["carpet"]:
        for z in range(ez0, ezw + 1):
            b.set(mid, 1, z, t["carpet"])
    b.markers["entrance"] = (mid, 1, ez0 + 1)
    # the staircase carved down from the surface: three wide stair blocks climbing south from the landing.
    # In the world the ground it is cut through is its walls (and what is under the steps).
    steps = h + 2
    st = _stairs(t["floor"])
    for i in range(steps):
        for x in range(mid - 1, mid + 2):
            b.set(x, i + 1, ezw + 1 + i, st, facing="s", half="bottom")
    b.fill(mid - 1, 0, ezw + 1, mid + 1, 0, ezw + 1, t["floor"])
    b.markers["stairs_top"] = (mid, steps + 1, ezw + steps)
    return W, D, x1, z1, y1, mid


def treasury(b, t, n, x1, z1, y1, mid):
    for k, x in (("crown", mid), ("heart", mid - 2), ("template", mid + 2)):
        b.set(x, 1, 2, t["plinth"], axis="y")
        b.markers[f"stand_{k}"] = (x, 2, 2)   # the floating stand entity goes here
    b.set(mid - 1, 1, 1, t["light"]); b.set(mid + 1, 1, 1, t["light"])
    for z in range(3, z1 - 1, 2):
        b.set(1, 1, z, "siege:relic_coffer", facing="e")
        b.set(x1 - 1, 1, z, "siege:relic_coffer", facing="w")
        if z + 1 < z1 - 1:
            b.set(1, 1, z + 1, t["light"]); b.set(x1 - 1, 1, z + 1, t["light"])
    b.set(1, 1, 1, "barrel", facing="u"); b.set(x1 - 1, 1, 1, "barrel", facing="u")
    if n >= 11:
        for x in (2, x1 - 2):
            for z in (2, z1 - 2):
                if b.get(x, 1, z)[0] == "air":
                    b.fill(x, 1, z, x, y1 - 1, z, t["pillar"], axis="y")
    if t["carpet"]:
        for z in range(3, z1):
            b.set(mid, 1, z, t["carpet"])


def hall(b, t, n, x1, z1, y1, mid):
    # the back three rows are a dais one block up, with a full-width flight of stairs at its front edge
    st = _stairs(t["floor"])
    b.fill(1, 1, 1, x1 - 1, 1, 2, t["floor"])
    for x in range(1, x1):
        b.set(x, 1, 3, st, facing="n", half="bottom")
    for k, x in (("crown", mid), ("heart", mid - 2), ("template", mid + 2)):
        b.set(x, 2, 1, t["plinth"], axis="y")
        b.markers[f"stand_{k}"] = (x, 3, 1)
    b.set(1, 2, 1, t["light"]); b.set(x1 - 1, 2, 1, t["light"])
    # two rows of columns down the room, one in from the walls, with coffers in the aisles behind them
    for z in range(4, z1 - 1, 2):
        for x in (2, x1 - 2):
            b.fill(x, 1, z, x, y1 - 1, z, t["pillar"], axis="y")
        b.set(1, 1, z, "siege:relic_coffer", facing="e")
        b.set(x1 - 1, 1, z, "siege:relic_coffer", facing="w")
        if z + 1 < z1 - 1:
            b.set(1, 1, z + 1, "barrel", facing="u"); b.set(x1 - 1, 1, z + 1, "barrel", facing="u")
    # upside-down stairs over the aisles from each column to the wall, like little arches
    for z in range(4, z1 - 1, 2):
        b.set(1, y1 - 1, z, st, facing="w", half="top")
        b.set(x1 - 1, y1 - 1, z, st, facing="e", half="top")
    for z in range(5, z1 - 1, 2):
        b.set(mid - 1, y1 - 1, z, t["light"]) if t["light"] in ("sea_lantern",) else None
    if t["carpet"]:
        for z in range(4, z1):
            b.set(mid, 1, z, t["carpet"])
    b.set(mid, 1, z1 - 2, t["light"]) if t["light"] not in ("end_rod",) else None


def crypt(b, t, n, x1, z1, y1, mid):
    st = _stairs(t["floor"])
    c = (x1) // 2
    r = 2 if n < 11 else 3                       # dais half-width
    zc = c - 1                                    # dais a little towards the back
    # raised dais in the middle: a flat top, stairs climbing in from all four sides, full blocks at its corners
    for x in range(c - r, c + r + 1):
        for z in range(zc - r, zc + r + 1):
            edge_x, edge_z = x in (c - r, c + r), z in (zc - r, zc + r)
            if edge_x and edge_z: b.set(x, 1, z, t["floor"])
            elif z == zc + r: b.set(x, 1, z, st, facing="n", half="bottom")
            elif z == zc - r: b.set(x, 1, z, st, facing="s", half="bottom")
            elif x == c - r: b.set(x, 1, z, st, facing="e", half="bottom")
            elif x == c + r: b.set(x, 1, z, st, facing="w", half="bottom")
            else: b.set(x, 1, z, t["floor"])
    # the three stands on the dais: Crown in the middle, Heart and template either side
    for k, x in (("crown", c), ("heart", c - (r - 1)), ("template", c + (r - 1))):
        b.set(x, 2, zc - (0 if k == "crown" else 1), t["plinth"], axis="y")
        b.markers[f"stand_{k}"] = (x, 3, zc - (0 if k == "crown" else 1))
    # piers along the side and back walls with a coffer in each bay between them
    for z in range(1, z1 - 1):
        for x, face in ((1, "e"), (x1 - 1, "w")):
            if z % 2 == 1: b.fill(x, 1, z, x, y1 - 1, z, t["pillar"], axis="y")
            else: b.set(x, 1, z, "siege:relic_coffer", facing=face)
    for x in range(2, x1 - 1):
        if x % 2 == 1: b.fill(x, 1, 1, x, y1 - 1, 1, t["pillar"], axis="y")
        else: b.set(x, 1, 1, "siege:relic_coffer", facing="s")
    # a cornice of upside-down stairs round the top of the room
    for x in range(2, x1 - 1):
        if b.get(x, y1 - 1, 2)[0] == "air": b.set(x, y1 - 1, 2, st, facing="n", half="top")
        if b.get(x, y1 - 1, z1 - 1)[0] == "air": b.set(x, y1 - 1, z1 - 1, st, facing="s", half="top")
    for z in range(2, z1 - 1):
        if b.get(2, y1 - 1, z)[0] == "air": b.set(2, y1 - 1, z, st, facing="w", half="top")
        if b.get(x1 - 2, y1 - 1, z)[0] == "air": b.set(x1 - 2, y1 - 1, z, st, facing="e", half="top")
    # lights at the dais corners
    for x in (c - r - 1, c + r + 1):
        for z in (zc - r - 1, zc + r + 1):
            if 1 < x < x1 - 1 and 1 < z < z1 - 1 and b.get(x, 1, z)[0] == "air":
                b.set(x, 1, z, t["light"])


def strongroom(tier, layout="treasury", cutaway=False):
    t = TIERS[tier]
    n, h = t["inside"], t["height"]
    b = Blueprint(f"{NAMES[tier]} ({layout})")
    W, D, x1, z1, y1, mid = shell(b, t, tier, n, h)
    {"treasury": treasury, "hall": hall, "crypt": crypt}[layout](b, t, n, x1, z1, y1, mid)
    if cutaway:
        # to look in: no roof, and the right wall and front wall (except the door and lock) cut to knee height
        b.fill(0, y1, 0, x1, y1, z1, "air")
        for y in range(2, y1):
            for z in range(D):
                b.set(x1, y, z, "air")
            for x in range(W):
                if not (mid - 2 <= x <= mid + 3):
                    b.set(x, y, z1, "air")
        b.fill(mid - 4, 5, z1 + 1, mid + 4, 5, z1 + ENTRY + 1, "air")   # and the entrance hall's ceiling
    return b.finish()


if __name__ == "__main__":
    import json
    ap = argparse.ArgumentParser()
    ap.add_argument("out"); ap.add_argument("--mcstructure", action="store_true")
    a = ap.parse_args()
    names = {}
    for tier in TIERS:
        for layout in LAYOUTS:
            for key, cut in ((f"{tier}_{layout}", False), (f"{tier}_{layout}_inside", True)):
                d = os.path.join(a.out, key); os.makedirs(d, exist_ok=True)
                b = strongroom(tier, layout, cut)
                b.save_logical(os.path.join(d, "scene.json"))
                names[key] = f"{NAMES[tier]} · {layout.title()}" + (", inside" if cut else "")
                if a.mcstructure and not cut:
                    b.save_mcstructure(os.path.join(a.out, key + ".mcstructure"))
        print("strongroom", tier, f"{TIERS[tier]['inside']}x{TIERS[tier]['inside']} inside")
    json.dump(names, open(os.path.join(a.out, "names.json"), "w"), indent=1)
