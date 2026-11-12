"""Deep Shaft specs for the minecraft-builder skill, one per level, each drawn over the last. Frostmarch style
(skill regions/frostmarch.md: plinths of cobbled deepslate 2 courses high, dark log frames, spruce plank infill,
white frosted glass, steep pitch 2 roofs with dragon-head gable horns, snow on ridges and caps, woodpiles,
weathered copper only on the great building, no bright colours).

  1 Prospect Shaft (Town)    a deepslate shaft collar under a windlass shed, the miners' hut, a spoil heap and cart rail
  2 Winding House (City)     a tall timber headframe with a sheave; a stone winding house whose rope runs to it; a sorting shed
  3 Deep Shaft (Castle)      a deepslate headframe tower with a copper roof over the shaft; a cutters' hall where the hut stood

Skill frame: x east, y up, z south; the front (gate) faces south. The plot is 25 x 15 (x -12..12, z -15..-1),
walled from level 1; ground later levels build on is spruce, fern and berry scrub until then (Mateo 2026-11-12).
Snow is added after the build from the engine's own result (ridges, caps and wall tops), as frostmarch.md asks.

Usage: python3 spec.py OUTDIR [--ground] [--skill SKILL_DIR]
"""
import json, math, os, sys

PLOT = (-12, -15, 12, -1)
COLLAR = (-2, -9, 2, -5)       # shaft collar 5 x 5, 3 x 3 shaft inside
HUT = (-11, -11, -7, -5)       # miners' hut 5 x 7 (levels 1-2)
WIND = (5, -13, 11, -7)        # winding house 7 x 7 (levels 2-3)
SORT = (5, -6, 11, -5)         # sorting lean-to against the winding house (levels 2-3)
HALL = (-11, -13, -5, -5)      # cutters' hall 7 x 9 (level 3)
HEAP = (-5, -14, -1, -12)      # spoil heap
RAIL_X = 0

MATERIALS = {"copper": {"ladder": ["waxed_weathered_cut_copper", "waxed_oxidized_cut_copper"], "axis": "y"},
             "slate": {"block": "deepslate_tiles"}, "spruce_roof": {"block": "spruce_planks"}}

HERE = os.path.dirname(os.path.abspath(__file__))
SKILL = os.path.join(HERE, "..", "..", "..", ".claude", "skills", "minecraft-builder")


def _hash(x, z, k):
    h = (x * 374761393 + z * 668265263 + k * 2147483647) & 0xffffffff
    h = ((h ^ (h >> 13)) * 1274126177) & 0xffffffff
    return (h & 0xffff) / 65535


def noise(x, z, k, s=3.0):
    fx, fz = x / s, z / s
    x0, z0 = math.floor(fx), math.floor(fz)
    tx, tz = fx - x0, fz - z0
    tx, tz = tx * tx * (3 - 2 * tx), tz * tz * (3 - 2 * tz)
    a, b, c, d = _hash(x0, z0, k), _hash(x0 + 1, z0, k), _hash(x0, z0 + 1, k), _hash(x0 + 1, z0 + 1, k)
    return (a + (b - a) * tx) * (1 - tz) + (c + (d - c) * tx) * tz


def inside(x, z, r, pad=0):
    return r[0] - pad <= x <= r[2] + pad and r[1] - pad <= z <= r[3] + pad


def shaft_cell(x, z):
    return COLLAR[0] < x < COLLAR[2] and COLLAR[1] < z < COLLAR[3]


# ---------- ground ----------

def path_cells(lv):
    cells = set()
    for z in range(-4, 0): cells |= {(x, z) for x in (-1, 0, 1)}                 # gate to the collar
    cells |= {(x, -3) for x in range(-6, 2)} | {(-6, z) for z in range(-8, -2)}  # to the hut / hall door (east side)
    if lv >= 2: cells |= {(x, -3) for x in range(2, 9)} | {(8, -4)}                         # to the sorting shed
    return cells


def ground(place, lv, keep_clear):
    """Grass under snow, gravel patches, slab paths half a block down (frostmarch.md streets)"""
    x0, z0, x1, z1 = PLOT
    paths = path_cells(lv)
    for x in range(x0, x1 + 1):
        for z in range(z0, z1 + 1):
            if shaft_cell(x, z): continue
            if (x, z) in paths:
                k = _hash(x, z, 5)
                place.append([x, 0, z, "cobbled_deepslate_slab" if k < 0.6 else "stone_brick_slab" if k < 0.85 else "andesite_slab"])
                continue
            n = noise(x, z, 1)
            verge = any((x + dx, z + dz) in paths for dx, dz in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            b = "gravel" if verge and _hash(x, z, 6) < 0.45 else "gravel" if n < 0.18 else "podzol" if n > 0.86 else "grass_block"
            place.append([x, 0, z, b])
            if b != "gravel" and not any(inside(x, z, r) for r in keep_clear) and noise(x, z, 3, 2.2) > 0.3:
                place.append([x, 1, z, "snow_layer"])


def perimeter(place):
    """A dry-stone dyke of cobbled deepslate with wall tops, dark oak log posts at the corners and the gate,
    a lantern on each gate post"""
    x0, z0, x1, z1 = PLOT
    run = {(x, z1) for x in range(x0, x1 + 1)} | {(x, z0) for x in range(x0, x1 + 1)} | \
          {(x0, z) for z in range(z0, z1 + 1)} | {(x1, z) for z in range(z0, z1 + 1)}
    posts = {(x0, z0), (x1, z0), (x0, z1), (x1, z1), (-2, z1), (2, z1), (x0, -8), (x1, -8), (0, z0)}
    for (x, z) in run:
        if abs(x) <= 1 and z == z1: continue
        if (x, z) in posts:
            place += [[x, 1, z, "cobbled_deepslate"], [x, 2, z, "dark_oak_log"], [x, 3, z, "dark_oak_log"], [x, 4, z, "cobbled_deepslate_wall"]]
        else:
            k = _hash(x, z, 9)
            place += [[x, 1, z, "cobbled_deepslate" if k < 0.65 else "tuff" if k < 0.85 else "andesite"], [x, 2, z, "cobbled_deepslate_wall"]]
    place += [[-2, 5, z1, "lantern"], [2, 5, z1, "lantern"]]


# ---------- greenery for ground not built on yet ----------

def spruce(place, x, z, h):
    """A spruce: trunk, a spire top, then alternating wide and narrow tiers down the trunk"""
    for y in range(1, h + 1): place.append([x, y, z, "spruce_log"])
    place += [[x, h + 1, z, "spruce_leaves"], [x, h + 2, z, "spruce_leaves"]]
    for y in range(3, h + 1):
        r = 1 if (h - y) % 2 == 0 or y > h - 2 else 2
        for dx in range(-r, r + 1):
            for dz in range(-r, r + 1):
                if dx == dz == 0: continue
                if abs(dx) == abs(dz) == r and (r == 2 or _hash(x + dx, z + dz + y, 3) < 0.5): continue
                place.append([x + dx, y, z + dz, "spruce_leaves"])


def scrub(place, box, seed, trees=()):
    """Ferns, sweet berry bushes, a mossy boulder now and then, spruces (no flowers in the north)"""
    x0, z0, x1, z1 = box
    for x in range(x0, x1 + 1):
        for z in range(z0, z1 + 1):
            if any(abs(x - tx) <= 2 and abs(z - tz) <= 2 for tx, tz, _ in trees): continue
            k = _hash(x, z, seed)
            if k < 0.12: place.append([x, 1, z, "fern"])
            elif k < 0.2: place.append([x, 1, z, "bush"])
            elif k < 0.26: place += [[x, 1, z, "cobbled_deepslate"], [x, 2, z, "snow_layer"]]
            elif k < 0.29: place.append([x, 1, z, "mossy_cobblestone"])
    for t in trees: spruce(place, *t)


# ---------- the works ----------

def collar(place):
    """A deepslate brick ring round a 3 x 3 shaft; ladder down the north side; open to the depth"""
    x0, z0, x1, z1 = COLLAR
    for x in range(x0, x1 + 1):
        for z in range(z0, z1 + 1):
            if shaft_cell(x, z):
                for y in range(-4, 2): place.append([x, y, z, "air"])
                place.append([x, -5, z, "black_concrete"])
            else:
                place += [[x, 0, z, "polished_deepslate"], [x, 1, z, "deepslate_bricks"]]


def rails(place, z_from, z_to):
    for z in range(z_to, z_from + 1): place.append([RAIL_X, 1, z, "rail"])


def spoil_heap(place):
    """Grey spoil from the shaft: cobbled deepslate, tuff and gravel in a low heap, snow on top"""
    x0, z0, x1, z1 = HEAP
    cx, cz = (x0 + x1) / 2, (z0 + z1) / 2
    for x in range(x0, x1 + 1):
        for z in range(z0, z1 + 1):
            h = 3 - round(abs(x - cx) * 0.9 + abs(z - cz) * 1.3 + noise(x, z, 8, 1.5))
            for y in range(1, max(1, h) + 1):
                k = _hash(x, y * 7 + z, 11)
                place.append([x, y, z, "gravel" if k < 0.35 else "tuff" if k < 0.6 else "cobbled_deepslate"])
            place.append([x, max(1, h) + 1, z, "snow_layer"])


def hut():
    return {"part": "house", "style": "frost_timber", "rect": list(HUT), "y": 1, "plinth": 2, "storeys": [5],
            "door": {"side": "e"}, "shutters": 0.3,
            "roof": {"type": "gable", "pitch": 2, "ridge": "z", "gable_horns": True}, "chimney": [[-9, -10]]}


def shed():
    """Level 1: the windlass shed over the collar, a frost_timber block whose walls are stripped to the frame
    afterwards (strip_to_frame), so only the posts, beams and the steep roof stand over the shaft"""
    return {"part": "house", "style": "frost_timber", "rect": list(COLLAR), "y": 1, "plinth": 1, "storeys": [5],
            "door": {"side": "s"}, "windows": {}, "chimney": False, "shutters": 0, "name": "shaft_shed",
            "roof": {"type": "gable", "pitch": 2, "ridge": "x", "gable_horns": True}}


def headframe():
    """Level 2: the tall timber headframe, the same block raised to two storeys and stripped to its frame"""
    return {"part": "house", "style": "frost_timber", "rect": list(COLLAR), "y": 1, "plinth": 1, "storeys": [5, 5],
            "door": {"side": "s"}, "windows": {}, "chimney": False, "shutters": 0, "name": "headframe",
            "roof": {"type": "gable", "pitch": 2, "ridge": "x", "gable_horns": True, "overhang": 1}}


def windlass(place):
    """Level 1: a log drum across the shaft on two posts, a chain down to a hanging bucket barrel"""
    for x in (COLLAR[0], COLLAR[2]):
        place += [[x, 2, -7, "dark_oak_log"], [x, 3, -7, "dark_oak_log"]]
    for x in range(COLLAR[0] + 1, COLLAR[2]): place.append([x, 4, -7, "stripped_spruce_log", {"axis": "x"}])
    for y in range(-1, 4): place.append([0, y, -7, "iron_chain"])
    place.append([0, -2, -7, "barrel"])


def sheave(place, top):
    """Level 2: the sheave wheel on the headframe's top beam, the rope down the shaft and across to the winding house"""
    for y in range(-1, top - 1): place.append([0, y, -7, "iron_chain"])
    place.append([0, top - 1, -7, "grindstone"])
    for x in range(1, WIND[0]): place.append([x, 6, -7, "iron_chain", {"axis": "x"}])


def winding_house():
    return {"part": "house", "style": "frost_stone", "rect": list(WIND), "y": 1, "plinth": 2, "storeys": [5],
            "door": {"side": "s", "kind": "large"}, "materials": {"roof": "slate"},
            "roof": {"type": "gable", "pitch": 2, "ridge": "x", "gable_horns": True}, "chimney": [[10, -11]]}


def sorting_shed():
    return {"part": "lean_to", "rect": list(SORT), "against": "n", "top": 7, "y": 1, "roof": "spruce_roof",
            "post": "dark_oak_log", "trim": "dark_oak_planks"}


def tower():
    """Level 3: the deepslate headframe tower over the collar, slit windows, a weathered copper roof"""
    win = {s: [{"at": 0, "storey": k, "w": 1, "h": 2} for k in (1, 2)] for s in "ensw"}
    return {"part": "house", "style": {"base": "frost_stone", "glass": "iron_bars"}, "rect": list(COLLAR), "y": 1, "plinth": 2,
            "storeys": [5, 5, 5], "door": {"side": "s", "kind": "large"}, "windows": win, "chimney": False, "shutters": 0,
            "materials": {"roof": "copper"}, "name": "shaft_tower",
            "roof": {"type": "gable", "pitch": 2, "ridge": "x", "gable_horns": True}}


def cutters_hall():
    return {"part": "house", "style": "frost_timber", "rect": list(HALL), "y": 1, "plinth": 2, "storeys": [5, 4],
            "door": {"side": "e"}, "shutters": 0.3, "storey_style": [{"frame_kind": "stone", "infill": "FRO-01"}, {}],
            "roof": {"type": "gable", "pitch": 2, "ridge": "z", "gable_horns": True}, "chimney": [[-8, -12]]}


# ---------- levels ----------

def level(lv):
    parts, place, strip = [], [], []
    if lv == 1:
        clear = [HUT, COLLAR, (HUT[0] - 1, HUT[1] - 2, HUT[2] + 1, HUT[3] + 1)]
    elif lv == 2:
        clear = [HUT, COLLAR, WIND, SORT, (WIND[0] - 1, WIND[1] - 1, WIND[2] + 1, SORT[3] + 1), (HUT[0] - 1, HUT[1] - 2, HUT[2] + 1, HUT[3] + 1)]
    else:
        clear = [HALL, COLLAR, WIND, SORT, (WIND[0] - 1, WIND[1] - 1, WIND[2] + 1, SORT[3] + 1), (HALL[0] - 1, HALL[1] - 1, HALL[2] + 1, HALL[3] + 1)]
    clear = clear + [HEAP, (COLLAR[0] - 1, COLLAR[1] - 1, COLLAR[2] + 1, COLLAR[3] + 1)]
    ground(place, lv, clear)
    perimeter(place)
    collar(place)
    spoil_heap(place)
    rails(place, COLLAR[1] - 1, PLOT[1] + 2)
    if lv < 3:
        parts.append(hut())
        parts.append({"part": "woodpile", "at": [HUT[0] + 1, 1, HUT[1] - 1], "len": 3, "h": 2, "facing": "n", "wood": "spruce"})
        place.append([-6, 1, -10, "barrel"])
        # the hall's ground, still scrub: the strip north of the hut and the column east of it
        scrub(place, (HALL[0], HALL[1], HALL[2], HUT[1] - 2), 41)
    if lv == 1:
        parts.append(shed()); strip.append(("frame", COLLAR, 2, 4))
        windlass(place)
        # the winding house's ground: spruces and scrub
        scrub(place, (WIND[0], WIND[1], WIND[2], SORT[3]), 43, trees=[(6, -11, 7), (9, -7, 6)])
        place += [[4, 1, -3, "barrel"], [3, 1, -4, "cobbled_deepslate"]]
    if lv >= 2:
        parts += [winding_house(), sorting_shed()]
        place += [[6, 1, -5, "barrel"], [7, 1, -5, "barrel"], [10, 1, -5, "crafting_table"]]
        # the winding drum inside, and a hole in the west wall where the rope runs out to the headframe
        for z in (-9, -8): place.append([8, 3, z, "stripped_spruce_log", {"axis": "z"}])
    if lv == 2:
        parts.append(headframe()); strip.append(("frame", COLLAR, 2, 9))
        sheave(place, 12)
    if lv == 3:
        parts += [tower(), {"part": "spire", "rect": list(COLLAR), "kind": "broach", "rows": 3, "roof": "copper", "trim": "dark_oak_planks"}, cutters_hall(),
                  {"part": "woodpile", "at": [HALL[0] + 2, 1, HALL[1] - 1], "len": 3, "h": 2, "facing": "n", "wood": "spruce"}]
        for y in range(-1, 2): place.append([0, y, -7, "iron_chain"])
        for x in range(COLLAR[2] + 1, WIND[0]): place.append([x, 6, -7, "iron_chain", {"axis": "x"}])
        place += [[-4, 1, -4, "barrel"], [3, 1, -4, "lantern"]]
    return parts, place, strip


def strip_to_frame(blocks, rect, y0, y1):
    """Air everything on the walls of rect between y0 and y1 except the corner legs and the horizontal beams,
    and the floor inside, so a building block stands as an open timber frame (the headframe). Sills and
    shutters 1 out go too. Then knee braces: an upside-down stair under every beam beside each leg."""
    x0, z0, x1, z1 = rect
    out, beams = [], set()
    for (x, y, z), (n, p) in blocks.items():
        if not (y0 <= y <= y1) or not inside(x, z, rect, 1): continue
        ring = inside(x, z, rect) and not (x0 < x < x1 and z0 < z < z1)
        corner = x in (x0, x1) and z in (z0, z1)
        if ring and n.endswith("_log") and (corner or (p or {}).get("axis", "y") != "y"):
            if not corner: beams.add(y)
            continue
        if (x, y, z) in ((x0, 2, -7), (x1, 2, -7), (x0, 3, -7), (x1, 3, -7)): continue     # windlass posts
        out.append([x, y, z, "air"])
    for (x, y, z), (n, p) in blocks.items():           # the plate beam at y1 + 1 counts too
        if y == y1 + 1 and n.endswith("_log") and inside(x, z, rect) and (p or {}).get("axis", "y") != "y": beams.add(y)
    for yb in sorted(beams):
        y = yb - 1
        for cx, cz, ux, uz in ((x0, z0, 1, 1), (x1, z0, -1, 1), (x0, z1, 1, -1), (x1, z1, -1, -1)):
            out.append([cx + ux, y, cz, "dark_oak_stairs", {"facing": "w" if ux > 0 else "e", "half": "top"}])
            out.append([cx, y, cz + uz, "dark_oak_stairs", {"facing": "n" if uz > 0 else "s", "half": "top"}])
    return out


def snow_cap(blocks, place):
    """frostmarch.md: snow layers on ridges, chimney caps, flat tops and wall tops. A snow layer goes on every
    topmost full block, wall or bottom slab that is open to the sky."""
    tops = {}
    for (x, y, z), (n, p) in blocks.items():
        if n != "air": tops[(x, z)] = max(tops.get((x, z), y), y)
    for (x, z), y in tops.items():
        n, p = blocks[(x, y, z)]
        if n in ("snow_layer", "lantern", "campfire", "flower_pot", "lightning_rod", "iron_chain", "grindstone", "rail", "fern",
                 "sweet_berry_bush", "water", "black_concrete") or n.endswith(("_stairs", "_trapdoor", "_door", "_sign", "_fence", "_leaves", "_pane")):
            continue
        if n.endswith("_slab"):
            if (p or {}).get("half") == "top": place.append([x, y + 1, z, "snow_layer"])
            continue
        place.append([x, y + 1, z, "snow_layer"])


def specs(ground_plate=False, skill=SKILL):
    sys.path.insert(0, os.path.join(skill, "scripts"))
    from engine import compute  # noqa: E402
    out = {}
    for lv in (1, 2, 3):
        parts, place, strip = level(lv)
        shapes = []
        if ground_plate:
            x0, z0, x1, z1 = PLOT
            shapes = [{"shape": "box", "min": [x0 - 3, -5, z0 - 3], "max": [x1 + 3, -1, z1 + 3], "material": "stone"},
                      {"shape": "box", "min": [x0 - 3, 0, z0 - 3], "max": [x1 + 3, 0, z1 + 3], "material": "snow"}]
        spec = {"name": f"deepshaft_{lv}", "edition": "bedrock", "materials": MATERIALS, "shapes": shapes, "parts": parts, "place": place}
        if strip:
            blocks, _, _ = compute(spec)
            for _, r, y0, y1 in strip: place += strip_to_frame(blocks, r, y0, y1)
            spec["place"] = place
        blocks, _, _ = compute(spec)
        snow_cap(blocks, place)
        spec["place"] = place
        out[f"deepshaft_{lv}"] = spec
    return out


if __name__ == "__main__":
    a = sys.argv[1:]
    skill = a[a.index("--skill") + 1] if "--skill" in a else SKILL
    for name, spec in specs("--ground" in a, skill).items():
        json.dump(spec, open(os.path.join(a[0], name + ".json"), "w"))
    print("ok")
