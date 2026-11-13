"""The air boat station (Mateo, 2026-11-13): how players reach Everwake. It stands in Aldmere from the start as a
ruin; when the story brings the cloud city in, it is rebuilt and an air boat moors at its mast. Players walk
through the Gate on the mast deck, a portal that takes them to Everwake's own world; in the story they are
simply boarding the air boat.

    specs() -> {"airboat_station_restored": spec, "airboat_station_ruin": spec}

Local y 0 is the ground the station stands on. x east, z south. The mast stands at (0, 0); the hall to the west;
the boat lies east of the mast, its nose ring against the spire tip (the air boat is airboat.py).
"""
import math, os, random, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from airboat import cells as boat_cells, MOORING  # noqa: E402  (the air boat, PR #305)

STONE = "vale_stone"
COPPER = {"ladder": ["waxed_weathered_cut_copper", "waxed_oxidized_cut_copper"], "axis": "y"}
OPP = {"n": "s", "s": "n", "e": "w", "w": "e"}

MAST_W = 9                 # the mooring mast: 9 x 9 shaft
MAST_ST = [6, 6, 6, 6, 6]  # five 6-high stages
PLINTH = 2
DECK = PLINTH + sum(MAST_ST) - 1          # the shaft's flat top, the mooring deck (31)
HALL = [-33, -7, -13, 7]                  # the station hall, 21 x 15
RING = (4, DECK - MOORING["deck_y"], 0)   # the boat's nose ring, against the spire tip; its deck level with the mast deck
GANG_END = RING[0] - MOORING["bow_gate"][0] - 1   # the gangway runs to the gap in the bow rail (the boat points west)


def mast():
    h = MAST_W // 2
    parts = [{"part": "house", "style": STONE, "rect": [-h, -h, h, h], "y": 0, "plinth": PLINTH, "storeys": MAST_ST,
              "door": {"side": "w", "kind": "grand"}, "chimney": False, "shutters": 0, "interior": {"use": "tower", "hatch": True},
              "roof": {"type": "flat", "parapet": "none"},
              "windows": {sd: [{"at": 0, "storey": k, "w": 1, "h": 3 if k == 4 else 2} for k in range(1, 5)] for sd in "nsew"}},
             {"part": "belfry", "rect": [-h - 1, -h - 1, h + 1, h + 1], "y": DECK, "h": 6, "pier": "stone_bricks",
              "deck": "polished_andesite", "trim": "spruce_planks", "roof": COPPER, "cap": "spire", "rows": 3,
              "overhang": 1, "cap_trim": "spruce_planks", "finial": "spire_block", "bell": False}]
    place = []
    for t in sorted({-h, 0, h} | set(range(-h, h + 1, 3))):   # corbels under the belfry overhang
        for sd, (x, z) in {"n": (t, -h - 1), "s": (t, h + 1), "w": (-h - 1, t), "e": (h + 1, t)}.items():
            place.append([x, DECK - 1, z, "stone_brick_stairs", {"facing": OPP[sd], "half": "top"}])
    return parts, place


def gangway():
    """From the belfry's east arch, across to the gondola, with the Gate standing at its head."""
    pl, parts = [], []
    x0, x1 = MAST_W // 2 + 2, GANG_END
    for x in range(x0, x1 + 1):
        for z in (-1, 0, 1):
            pl.append([x, DECK, z, "spruce_planks"])
        for z in (-2, 2):
            pl.append([x, DECK, z, "spruce_planks"])
            pl.append([x, DECK + 1, z, "spruce_fence"])
    for z in (-2, 2):                                        # corbels: raking struts back to the shaft
        pl.append([x0, DECK - 1, z, "spruce_stairs", {"facing": "w", "half": "top"}])
    # the Gate: a stone arch over the gangway, 3 wide, 5 high, filled with the portal (pale glass stands in for it)
    gx = x0 + 2
    for z in (-2, 2):
        for y in range(DECK + 1, DECK + 7):
            pl.append([gx, y, z, "stone_bricks"]); pl.append([gx + 1, y, z, "stone_bricks"])
    for z in range(-2, 3):
        pl.append([gx, DECK + 7, z, "polished_andesite"]); pl.append([gx + 1, DECK + 7, z, "polished_andesite"])
    pl.append([gx, DECK + 8, 0, "stone_brick_wall"]); pl.append([gx, DECK + 9, 0, "bell", {"attachment": "standing"}])
    for z in (-1, 1):
        pl.append([gx, DECK + 6, z, "stone_brick_stairs", {"facing": "s" if z < 0 else "n", "half": "top"}])
        pl.append([gx + 1, DECK + 6, z, "stone_brick_stairs", {"facing": "s" if z < 0 else "n", "half": "top"}])
    portal = [[gx, y, z, "light_blue_stained_glass"] for y in range(DECK + 1, DECK + 6) for z in (-1, 0, 1)
              if not (y == DECK + 5 and z != 0)]
    for z in (-2, 2):
        pl.append([gx - 1, DECK + 1, z, "lantern"])
    return pl, portal


def hall():
    x0, z0, x1, z1 = HALL
    return [{"part": "house", "style": {"base": STONE, "roof": COPPER}, "rect": HALL, "y": 0, "plinth": 1, "storeys": [5, 5],
             "door": {"side": "w", "kind": "grand"}, "chimney": False, "interior": "hall", "bay": 4,
             "roof": {"type": "hip"}, "shutters": 0},
            {"part": "belfry", "rect": [x0 + 8, -2, x0 + 12, 2], "y": "roof", "h": 4, "pier": "stone_bricks", "trim": "spruce_planks",
             "roof": COPPER, "cap": "spire", "rows": 2, "finial": "spire_block"}]


def yard(rng):
    """Ground the station stands on: a grass rise with a paved yard and paths, lamp posts."""
    sh = [{"shape": "cylinder", "at": [0, -4, 0], "r": 44.5, "h": 4, "material": "ground", "hollow": 0}]
    pl = []
    for x in range(-50, 50):
        for z in range(-45, 45):
            if math.hypot(x, z) > 44: continue
            paved = (HALL[0] - 2 <= x <= 7 and -9 <= z <= 9) or (abs(z) <= 1 and x < HALL[0]) or (-7 <= x <= 7 and -7 <= z <= 7)
            if paved:
                r = rng.random()
                pl.append([x, -1, z, "cobblestone" if r < 0.55 else "stone_bricks" if r < 0.85 else "andesite"])
    for x in range(-44, HALL[0] - 2, 9):                     # lamp posts along the road in
        for z in (-3, 3):
            pl += [[x, 0, z, "cobblestone_wall"], [x, 1, z, "spruce_fence"], [x, 2, z, "spruce_fence"], [x, 3, z, "lantern"]]
    return sh, pl


def materials():
    return {"ground": "grass_block"}


def spec(restored, rng):
    ysh, ypl = yard(rng)
    mp, mpl = mast()
    gpl, portal = gangway()
    parts = mp + hall()
    shapes = list(ysh); place = ypl + mpl
    if restored:
        place += gpl + portal + boat_cells(RING, "w")
    else:
        place += [c for c in gpl if c[0] <= MAST_W // 2 + 5]      # only the stub of the gangway and the broken Gate
    s = {"name": "airboat_station_" + ("restored" if restored else "ruin"), "edition": "bedrock",
         "materials": materials(), "shapes": shapes, "parts": parts, "place": place}
    if not restored:
        h = MAST_W // 2
        s["ruin"] = {"seed": 13, "holes": 0.07, "cap": [
            [-h - 2, -h - 2, h + 2, h + 2, 19, 6],                 # the mast broke off in its fourth stage
            [h + 2, -3, h + 9, 3, DECK - 3, 5],                    # the Gate and gangway stub fell with it
            [HALL[0] - 2, HALL[1] - 2, HALL[2] + 2, HALL[3] + 2, 6, 3],   # the hall lost its roof and upper floor
        ]}
    return s


def specs():
    return {"airboat_station_restored": spec(True, random.Random(5)), "airboat_station_ruin": spec(False, random.Random(5))}


if __name__ == "__main__":
    import json, os, subprocess, sys
    out = os.path.abspath(sys.argv[1])
    build = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", ".claude", "skills", "minecraft-builder", "scripts", "build.py")
    for name, sp in specs().items():
        d = os.path.join(out, name); os.makedirs(d, exist_ok=True)
        json.dump(sp, open(os.path.join(d, "spec.json"), "w"))
        r = subprocess.run([sys.executable, build, os.path.join(d, "spec.json"), d, "--no-preview"], capture_output=True, text=True)
        print(name, r.stdout[-600:], r.stderr[-1500:])
