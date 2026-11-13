"""Rimeforge Hall, rebuilt as the great forge of the north (Mateo, 2026-11-12: "an okay start, but it lacks any
character").

    python3 make_rimeforge.py   -> rimeforge_hall.json (a minecraft-builder spec), then run export_wonders.py

Frostmarch (regions/frostmarch.md: Norse, dark log frames on deepslate, steep pitch 2 roofs that shed snow, a
longhouse hall with a weathered copper roof and crossed dragon heads, stave towers with skirt roofs, bells).

Made bigger again the same day ("I don't know if Rimeforge Hall is big enough either"): a cross-shaped longhouse
75 long and 31 wide with arms 67 across, three storeys (a deepslate ground storey on stone piers, two timbered
storeys), a steep weathered copper roof with dragon heads crossed over every gable and a lantern belfry over the
crossing, a deep porch on the front and a great round window in each end gable. Two great 7 x 7 forge stacks of
dark brick climb far past the eaves behind the arms, smoke at the top. In the forge court in front: the Rime
Anvil on its plinth under a chained hood, a row of blast furnaces under a lean-to, grindstones, a quench trough,
and a waterwheel on a mill race that drives the trip hammer. Two workshop longhouses close the court's sides. Behind
to the east the bell tower, a stave tower 32 high with a skirt roof at every tier and a copper spire, because
Frostmarch is the land of bells. Front = +z.
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


def forge_stack(cx, cz, top, hw=3):
    """A forge chimney of dark brick (2 hw + 1 square) from the ground to `top`, iron bands, a corbelled crown, smoke."""
    for y in range(0, top + 1):
        for x in range(-hw, hw + 1):
            for z in range(-hw, hw + 1):
                edge = abs(x) == hw or abs(z) == hw
                if not edge and y > 0: continue
                b = pick(DARK)
                if y % 8 == 0 and y > 0: b = "polished_blackstone"
                if abs(x) == hw and abs(z) == hw: b = "deepslate_tiles" if y % 2 else "deepslate_bricks"
                put(cx + x, y, cz + z, b)
    c = hw + 1
    for x in range(-c, c + 1):                               # crown on corbels
        for z in range(-c, c + 1):
            if max(abs(x), abs(z)) == c:
                f = ("e" if x > 0 else "w") if abs(x) == c else ("s" if z > 0 else "n")
                put(cx + x, top - 1, cz + z, "deepslate_brick_stairs", facing=f, half="top")
                put(cx + x, top, cz + z, "deepslate_bricks")
                if (x + z) % 2 == 0: put(cx + x, top + 1, cz + z, "deepslate_brick_wall")
    for x in range(-hw + 1, hw):
        for z in range(-hw + 1, hw):
            put(cx + x, top - 1, cz + z, "deepslate_bricks")
            if (x + z) % 2 == 0: put(cx + x, top, cz + z, "campfire")
            else: put(cx + x, top, cz + z, "deepslate_bricks")


SHIFT = -5          # see write()
Z0 = 29            # the court's back edge (the hall's front wall is at z 27)
AZ = 43            # the Rime Anvil's centre


def forge_court():
    for x in range(-30, 31):
        for z in range(Z0, 58):
            if abs(x) <= 7 and z <= 33: continue             # the porch
            put(x, 0, z, pick(YARD))
    # the Rime Anvil: a stepped plinth, the anvil, blue ice set in the top, a chained hood over it on four posts
    for x in range(-4, 5):
        for z in range(AZ - 4, AZ + 5):
            m = max(abs(x), abs(z - AZ))
            put(x, 1, z, "polished_deepslate" if m == 4 else "deepslate_tiles")
            if m <= 3: put(x, 2, z, "polished_blackstone" if m == 3 else "deepslate_tiles")
            if m <= 1: put(x, 3, z, "deepslate_tiles")
    for (x, z) in ((-2, AZ - 2), (2, AZ + 2), (-2, AZ + 2), (2, AZ - 2)): put(x, 3, z, "blue_ice")
    put(0, 4, AZ, "anvil", facing="e")
    for (x, z) in ((-4, AZ - 4), (4, AZ - 4), (-4, AZ + 4), (4, AZ + 4)):
        for y in range(2, 11): put(x, y, z, "dark_oak_log")
    for x in range(-5, 6):
        for z in range(AZ - 5, AZ + 6):
            m = max(abs(x), abs(z - AZ))
            if m == 5: put(x, 11, z, "spruce_stairs", facing=("e" if x < 0 else "w") if abs(x) == 5 else ("s" if z < AZ else "n"))
            elif m == 4: put(x, 12, z, "dark_oak_planks")
            elif m <= 3: put(x, 13, z, "dark_oak_planks")
            if m <= 1: put(x, 14, z, "dark_oak_planks")
    for k in range(-4, 5):
        put(k, 10, AZ - 4, "dark_oak_stairs", facing="n", half="top"); put(k, 10, AZ + 4, "dark_oak_stairs", facing="s", half="top")
    for (x, z) in ((-2, AZ - 2), (2, AZ + 2), (2, AZ - 2), (-2, AZ + 2)):
        put(x, 12, z, "iron_chain"); put(x, 11, z, "iron_chain"); put(x, 10, z, "lantern", hanging=True)
    # blast furnaces and hearths along the court's west side under a lean-to, a fence screen in front
    for z in range(32, 56, 4):
        put(-20, 1, z, "blast_furnace", facing="e"); put(-20, 2, z, "blast_furnace", facing="e")
        put(-21, 1, z, "deepslate_bricks"); put(-21, 2, z, "deepslate_bricks"); put(-21, 3, z, "campfire")
        put(-20, 3, z, "deepslate_brick_slab")
    for z in range(31, 56):
        put(-22, 1, z, "deepslate_bricks"); put(-22, 2, z, "deepslate_bricks"); put(-22, 3, z, "deepslate_bricks")
        put(-22, 4, z, "spruce_stairs", facing="e")
        put(-21, 4, z, "spruce_stairs", facing="e") if False else None
        put(-21, 5, z, "spruce_stairs", facing="e"); put(-22, 5, z, "spruce_planks")
        put(-20, 4, z, "spruce_slab", half="top") if z % 4 == 2 else None
    for z in (31, 39, 47, 55):
        for y in (1, 2, 3, 4): put(-18, y, z, "dark_oak_log")
        put(-18, 5, z, "spruce_stairs", facing="e")
    for z in range(31, 56): put(-19, 5, z, "spruce_stairs", facing="e"); put(-20, 5, z, "spruce_stairs", facing="e")
    for z in range(31, 56): put(-21, 5, z, "spruce_planks"); put(-22, 6, z, "spruce_slab")
    # grindstones, smithing tables and a quench trough on the east side
    for z in (34, 38, 42):
        put(12, 1, z, "grindstone", facing="n"); put(13, 1, z, "smithing_table"); put(11, 1, z, "barrel", facing="up")
    for x in range(9, 16):
        for z in (48, 50):
            put(x, 1, z, "polished_deepslate")
        put(x, 1, 49, "water")
    for z in (48, 49, 50):
        put(8, 1, z, "polished_deepslate"); put(16, 1, z, "polished_deepslate")
    # the mill race along the east of the court and the waterwheel that drives the trip hammer
    for z in range(Z0 - 4, 58):
        for x in (25, 26, 27):
            put(x, 0, z, "water" if x == 26 else "polished_deepslate")
            if x != 26: put(x, 1, z, "deepslate_brick_slab")
    for x in range(18, 24): put(x, 7, AZ, "stripped_dark_oak_log", axis="x")
    for y in range(1, 7): put(18, y, AZ - 2, "dark_oak_log"); put(18, y, AZ + 2, "dark_oak_log")
    put(19, 5, AZ, "polished_blackstone"); put(19, 6, AZ, "dark_oak_fence")
    put(19, 1, AZ, "anvil", facing="n"); put(19, 0, AZ, "deepslate_bricks")
    # a low dark wall closes the court's front, with an open gate in the middle, braziers on the gate piers
    for x in range(-30, 31):
        if abs(x) <= 4: continue
        put(x, 1, 57, pick(DARK)); put(x, 2, 57, "cobbled_deepslate_wall")
        if rng.random() < 0.5: put(x, 1, 58, "snow_layer")
    for x in (-5, 5):
        for y in (1, 2, 3): put(x, y, 57, "polished_deepslate")
        put(x, 4, 57, "campfire")


def bell_skirts(cx, cz, hw, ys):
    """Skirt roofs one out from the tower at each tier's foot, dragon horns at the skirt corners."""
    h = hw + 1
    for y0 in ys:
        for x in range(-h, h + 1):
            for z in range(-h, h + 1):
                if max(abs(x), abs(z)) != h: continue
                f = ("e" if x > 0 else "w") if abs(x) == h and abs(x) >= abs(z) else ("s" if z > 0 else "n")
                f = {"e": "w", "w": "e", "n": "s", "s": "n"}[f]          # tall side to the tower
                put(cx + x, y0, cz + z, "deepslate_tile_stairs", facing=f)
        for (x, z) in ((-h, -h), (h, -h), (-h, h), (h, h)):
            put(cx + x, y0 + 1, cz + z, "dark_oak_fence")


def gable_window(zf, yc, r=5.5):
    """A round window in the end gable: light blue glass in a dark oak ring, a cross of mullions."""
    R = int(r) + 2
    for x in range(-R, R + 1):
        for y in range(-R, R + 1):
            d = math.hypot(x, y)
            if d <= r - 1: put(x, yc + y, zf, "dark_oak_planks" if (x == 0 or y == 0) else "light_blue_stained_glass")
            elif d <= r + 0.3: put(x, yc + y, zf, "stripped_dark_oak_log", axis="z")


def write():
    forge_court()
    gable_window(27, 28)
    gable_window(-47, 28)
    for sx in (-1, 1): forge_stack(sx * 22, -32, 60)
    bell_skirts(41, -36, 5, (12, 17, 22, 27))
    place = [[x, y, z, v[0]] + ([v[1]] if len(v) > 1 else []) for (x, y, z), v in sorted(cells.items())]

    hall_style = {"base": "frost_timber", "roof": COPPER}
    ground = {"frame_kind": "piers", "pier": "deepslate_bricks", "infill": "cobbled_deepslate"}
    parts = [
        {"part": "house", "style": hall_style, "rect": [-15, -47, 15, 27], "y": 0, "plinth": 2, "storeys": [5, 5, 5],
         "storey_style": [ground, {}, {}],
         "door": {"side": "s", "kind": "grand"}, "windows": "auto", "shutters": 0, "bay": 5,
         "wings": [{"rect": [-33, -19, 33, -1], "storeys": [5, 5, 4], "roof": {"ridge": "x"}}],
         "porch": {"side": "s", "at": 0, "w": 13, "d": 6, "h": 6},
         "roof": {"type": "gable", "ridge": "z", "pitch": 2, "snow": True, "gable_horns": True},
         "chimney": False, "interior": "hall", "trusses": True},
        {"part": "belfry", "rect": [-3, -13, 3, -7], "y": "roof", "h": 6, "cap": "spire", "roof": COPPER},
        {"part": "house", "style": hall_style, "rect": [36, -41, 46, -31], "y": 0, "plinth": 2,
         "storeys": [5, 5, 5, 5, 5, 5], "storey_style": [ground, {}, {}, {}, {}, {}],
         "door": {"side": "s"}, "windows": "auto", "shutters": 0, "chimney": False, "interior": "tower", "roof": {"type": "hip", "pitch": 2}},
        {"part": "belfry", "rect": [36, -41, 46, -31], "y": "top", "h": 6, "cap": "spire", "roof": COPPER},
        {"part": "wheel", "at": [24, 6, AZ], "axis": "x", "r": 5, "width": 2},
    ]
    for x0 in (-45, 33):                                     # the two workshop longhouses closing the court
        parts.append({"part": "house", "style": hall_style, "rect": [x0, 31, x0 + 10, 55], "y": 0, "plinth": 1,
                      "storeys": [5, 4], "storey_style": [ground, {}], "door": {"side": "e" if x0 < 0 else "w"},
                      "windows": "auto", "shutters": 0, "interior": "smithy",
                      "roof": {"type": "gable", "ridge": "z", "pitch": 2, "snow": True, "gable_horns": True}})
    # the court reaches further than the back: shift the whole place back so it fits within export LIMIT both ways
    for e in place: e[2] += SHIFT
    for pt in parts:
        if "rect" in pt: pt["rect"] = [pt["rect"][0], pt["rect"][1] + SHIFT, pt["rect"][2], pt["rect"][3] + SHIFT]
        if "at" in pt and isinstance(pt["at"], list): pt["at"][2] += SHIFT
        for wg in pt.get("wings", []): wg["rect"] = [wg["rect"][0], wg["rect"][1] + SHIFT, wg["rect"][2], wg["rect"][3] + SHIFT]
    spec = {"name": "rimeforge_hall", "edition": "bedrock", "materials": {}, "shapes": [], "parts": parts, "place": place}
    with open(os.path.join(HERE, "rimeforge_hall.json"), "w") as f:
        json.dump(spec, f, separators=(",", ":"))
    print("rimeforge_hall.json", len(place), "placed cells,", len(parts), "parts")


if __name__ == "__main__":
    write()
