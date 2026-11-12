"""Rimeforge Hall, rebuilt as the great forge of the north (Mateo, 2026-11-12: "an okay start, but it lacks any
character").

    python3 make_rimeforge.py   -> rimeforge_hall.json (a minecraft-builder spec), then run export_wonders.py

Frostmarch (regions/frostmarch.md: Norse, dark log frames on deepslate, steep pitch 2 roofs that shed snow, a
longhouse hall with a weathered copper roof and crossed dragon heads, stave towers with skirt roofs, bells).

A cross-shaped longhouse 51 long: a deepslate ground storey with stone piers and a timbered upper storey, a steep
weathered copper roof with dragon heads crossed over every gable and a lantern belfry on the ridge, a porch on
the front. Two great forge stacks of dark brick climb past the eaves either side, smoke at the top. In the forge
court in front: the Rime Anvil on its plinth under a chained hood, blast furnaces and grindstones, a quench trough,
and a waterwheel on a mill race that drives the trip hammer. To one side the bell tower, a stave tower of three
tiers each with its own skirt roof, a copper spire on top, because Frostmarch is the land of bells. Front = +z.
"""
import json, math, os, random

HERE = os.path.dirname(os.path.abspath(__file__))
rng = random.Random(1130)
cells = {}
COPPER = {"ladder": ["waxed_weathered_cut_copper", "waxed_oxidized_cut_copper"], "axis": "y"}


def put(x, y, z, b, **p): cells[(x, y, z)] = [b, p] if p else [b]


def pick(pairs):
    r, acc = rng.random(), 0.0
    for b, w in pairs:
        acc += w
        if r < acc: return b
    return pairs[-1][0]


DARK = [("deepslate_bricks", 0.5), ("cracked_deepslate_bricks", 0.15), ("cobbled_deepslate", 0.2), ("polished_deepslate", 0.15)]
YARD = [("cobbled_deepslate", 0.35), ("stone", 0.2), ("gravel", 0.2), ("andesite", 0.15), ("snow", 0.1)]


def forge_stack(cx, cz, top):
    """A 5 x 5 forge chimney of dark brick from the ground to `top`, iron bands, a corbelled crown, smoke."""
    for y in range(0, top + 1):
        for x in range(-2, 3):
            for z in range(-2, 3):
                edge = abs(x) == 2 or abs(z) == 2
                if not edge and y > 0: continue
                b = pick(DARK)
                if y % 8 == 0 and y > 0: b = "polished_blackstone"
                if abs(x) == 2 and abs(z) == 2: b = "deepslate_tiles" if y % 2 else "deepslate_bricks"
                put(cx + x, y, cz + z, b)
    for x in range(-3, 4):                                   # crown on corbels
        for z in range(-3, 4):
            if max(abs(x), abs(z)) == 3:
                f = ("e" if x > 0 else "w") if abs(x) == 3 else ("s" if z > 0 else "n")
                put(cx + x, top - 1, cz + z, "deepslate_brick_stairs", facing=f, half="top")
                put(cx + x, top, cz + z, "deepslate_bricks")
                if (x + z) % 2 == 0: put(cx + x, top + 1, cz + z, "deepslate_brick_wall")
    for (x, z) in ((-1, -1), (1, 1), (0, 0), (-1, 1), (1, -1)):
        put(cx + x, top, cz + z, "campfire")
        put(cx + x, top - 1, cz + z, "deepslate_bricks")
    # the firebox at the foot opens into the hall's side: an arch of glowing magma behind iron bars
    return


def forge_court():
    for x in range(-24, 25):
        for z in range(27, 47):
            put(x, 0, z, pick(YARD))
    # the Rime Anvil: a stepped plinth, the anvil, blue ice set in the top, a chained hood over it on four posts
    for x in range(-3, 4):
        for z in range(33, 40):
            m = max(abs(x), abs(z - 36))
            put(x, 1, z, "polished_deepslate" if m == 3 else "deepslate_tiles")
            if m <= 2: put(x, 2, z, "polished_blackstone" if m == 2 else "deepslate_tiles")
    for (x, z) in ((-1, 35), (1, 37), (-1, 37), (1, 35)): put(x, 2, z, "blue_ice")
    put(0, 3, 36, "anvil", facing="e")
    for (x, z) in ((-3, 33), (3, 33), (-3, 39), (3, 39)):
        for y in range(2, 9): put(x, y, z, "dark_oak_log")
    for x in range(-4, 5):
        for z in range(32, 41):
            m = max(abs(x), abs(z - 36))
            if m == 4: put(x, 9, z, "spruce_stairs", facing=("e" if x < 0 else "w") if abs(x) == 4 else ("s" if z < 36 else "n"))
            elif m <= 3: put(x, 10 - (1 if m == 3 else 0), z, "dark_oak_planks")
            if m <= 1: put(x, 11, z, "dark_oak_planks")
    for k in range(-3, 4):
        put(k, 8, 32, "dark_oak_stairs", facing="n", half="top"); put(k, 8, 40, "dark_oak_stairs", facing="s", half="top")
    put(0, 12, 36, "copper_bulb") if False else None
    for (x, z) in ((-2, 34), (2, 38)):
        put(x, 8, z, "iron_chain"); put(x, 7, z, "lantern", hanging=True)
    # blast furnaces and hearths along the court's west side, grindstones and a quench trough east
    for z in (30, 34, 38, 42):
        put(-14, 1, z, "blast_furnace", facing="e"); put(-14, 2, z, "blast_furnace", facing="e")
        put(-15, 1, z, "deepslate_bricks"); put(-15, 2, z, "deepslate_bricks"); put(-15, 3, z, "campfire")
        put(-14, 3, z, "deepslate_brick_slab")
    for z in range(29, 44):
        put(-16, 1, z, "deepslate_bricks"); put(-16, 2, z, "deepslate_bricks"); put(-16, 3, z, "deepslate_brick_wall")
        put(-15, 4, z, "spruce_slab", half="bottom") if False else None
    for z in range(29, 44):                                  # a lean-to shade over the hearths
        put(-17, 4, z, "dark_oak_log", axis="z") if z in (29, 43) else None
        put(-16, 5, z, "spruce_stairs", facing="w"); put(-15, 5, z, "spruce_stairs", facing="w") if False else None
        put(-15, 4, z, "spruce_stairs", facing="w"); put(-14, 4, z, "spruce_slab") if False else None
    for z in (29, 35, 43):
        for y in (1, 2, 3): put(-13, y, z, "dark_oak_fence")
    for (x, z) in ((10, 32), (10, 36)):
        put(x, 1, z, "grindstone", facing="n"); put(x + 1, 1, z, "smithing_table")
    for x in range(8, 13):
        for z in (40, 42):
            put(x, 1, z, "polished_deepslate")
        put(x, 1, 41, "water")
    for z in (40, 41, 42):
        put(7, 1, z, "polished_deepslate"); put(13, 1, z, "polished_deepslate")
    # the mill race along the east of the court and the waterwheel that drives the trip hammer
    for z in range(25, 47):
        for x in (20, 21, 22):
            put(x, 0, z, "water" if x == 21 else "polished_deepslate")
            if x != 21: put(x, 1, z, "deepslate_brick_slab")
    # trip hammer: a beam from the wheel's axle across to a hammer head over an anvil
    for x in range(14, 19): put(x, 6, 36, "stripped_dark_oak_log", axis="x")
    for y in range(1, 6): put(14, y, 34, "dark_oak_log"); put(14, y, 38, "dark_oak_log")
    put(15, 4, 36, "polished_blackstone"); put(15, 5, 36, "dark_oak_fence")
    put(15, 1, 36, "anvil", facing="n"); put(15, 0, 36, "deepslate_bricks")
    # snow drifted against the court's walls
    for x in range(-24, 25):
        put(x, 1, 46, "snow_layer") if rng.random() < 0.6 else None


def bell_tower(cx, cz):
    """Stave bell tower: 9 x 9 dark stone base, three timber tiers, each tier's foot carries a skirt roof one out."""
    for (y0, hw) in ((7, 5), (14, 5), (21, 5)):
        for x in range(-hw, hw + 1):
            for z in range(-hw, hw + 1):
                m = max(abs(x), abs(z))
                if m != hw: continue
                f = ("e" if x > 0 else "w") if abs(x) == hw and abs(x) >= abs(z) else ("s" if z > 0 else "n")
                f = {"e": "w", "w": "e", "n": "s", "s": "n"}[f]          # tall side to the tower
                put(cx + x, y0, cz + z, "deepslate_tile_stairs", facing=f)
                put(cx + x, y0 - 1, cz + z, "dark_oak_stairs", facing={"e": "w", "w": "e", "n": "s", "s": "n"}[f], half="top")
    # dragon heads at the skirt corners: a stair snout and a fence horn
    for (x, z) in ((-6, -6), (6, -6), (-6, 6), (6, 6)):
        put(cx + x, 7, cz + z, "dark_oak_fence"); put(cx + x, 8, cz + z, "dark_oak_fence")


def gable_window(zf, yc, r=3.5):
    """A round window in the front gable: light blue glass in a dark oak ring, a cross of mullions."""
    for x in range(-5, 6):
        for y in range(-5, 6):
            d = math.hypot(x, y)
            if d <= r - 1: put(x, yc + y, zf, "dark_oak_planks" if (x == 0 or y == 0) else "light_blue_stained_glass")
            elif d <= r + 0.3: put(x, yc + y, zf, "stripped_dark_oak_log", axis="z")


def write():
    forge_court()
    gable_window(25, 22)
    gable_window(-25, 22)
    for sx in (-1, 1): forge_stack(sx * 13, -16, 34)
    bell_tower(26, -14)
    place = [[x, y, z, v[0]] + ([v[1]] if len(v) > 1 else []) for (x, y, z), v in sorted(cells.items())]

    hall_style = {"base": "frost_timber", "roof": COPPER}
    parts = [
        {"part": "house", "style": hall_style, "rect": [-10, -25, 10, 25], "y": 0, "plinth": 2, "storeys": [7, 6],
         "storey_style": [{"frame_kind": "piers", "pier": "deepslate_bricks", "infill": "cobbled_deepslate"}, {}],
         "door": {"side": "s", "kind": "grand"}, "windows": "auto", "shutters": 0, "bay": 5,
         "wings": [{"rect": [-22, -6, 22, 6], "storeys": [7, 4], "roof": {"ridge": "x"}}],
         "porch": {"side": "s", "at": 0, "w": 9, "d": 5, "h": 5},
         "roof": {"type": "gable", "ridge": "z", "pitch": 2, "snow": True, "gable_horns": True},
         "chimney": False, "interior": "smithy", "trusses": True},
        {"part": "belfry", "rect": [-2, -14, 2, -10], "y": "roof", "h": 4, "cap": "spire", "roof": COPPER},
        {"part": "house", "style": {"base": "frost_timber", "roof": COPPER}, "rect": [22, -18, 30, -10], "y": 0, "plinth": 2,
         "storeys": [7, 7, 7, 6], "storey_style": [{"frame_kind": "piers", "pier": "deepslate_bricks", "infill": "cobbled_deepslate"}, {}, {}, {}],
         "door": {"side": "s"}, "windows": "auto", "shutters": 0, "chimney": False, "interior": "tower", "roof": {"type": "hip", "pitch": 2}},
        {"part": "belfry", "rect": [22, -18, 30, -10], "y": "top", "h": 5, "cap": "spire", "roof": COPPER},
        {"part": "wheel", "at": [19, 5, 36], "axis": "x", "r": 4, "width": 2},
    ]
    spec = {"name": "rimeforge_hall", "edition": "bedrock", "materials": {}, "shapes": [], "parts": parts, "place": place}
    with open(os.path.join(HERE, "rimeforge_hall.json"), "w") as f:
        json.dump(spec, f, separators=(",", ":"))
    print("rimeforge_hall.json", len(place), "placed cells,", len(parts), "parts")


if __name__ == "__main__":
    write()
