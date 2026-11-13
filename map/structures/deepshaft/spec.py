"""Deep Shaft specs for the minecraft-builder skill: three levels, each drawn over the last, in every region's look
(machine_regions.py; Mateo 2026-11-12: every machine comes in every region's theme). Frostmarch is the home
style (skill regions/frostmarch.md: cobbled deepslate plinths 2 high, dark log frames, steep pitch 2 roofs with
dragon-head gable horns, snow on ridges and caps, weathered copper on the great building).

  1 Prospect Shaft (Town)    a stone shaft collar under a windlass shed, the miners' hut, a spoil heap and cart rail
  2 Winding House (City)     a tall timber headframe with a sheave; a stone winding house whose rope runs to it; a sorting shed
  3 Deep Shaft (Castle)      a stone headframe tower over the shaft; a cutters' hall where the hut stood

Skill frame: x east, y up, z south; the front (gate) faces south. The plot is 25 x 15 (x -12..12, z -15..-1),
walled from level 1; ground later levels build on is the region's scrub and trees until then (Mateo 2026-11-12).

Usage: python3 spec.py OUTDIR [--ground] [--skill SKILL_DIR] [--region R|all]
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
from machine_regions import theme, snow_cap, ORDER, names_json, _hash, noise  # noqa: E402

PLOT = (-12, -15, 12, -1)
COLLAR = (-2, -9, 2, -5)       # shaft collar 5 x 5, 3 x 3 shaft inside
HUT = (-11, -11, -7, -5)       # miners' hut 5 x 7 (levels 1-2)
WIND = (5, -13, 11, -7)        # winding house 7 x 7 (levels 2-3)
SORT = (5, -6, 11, -5)         # sorting lean-to against the winding house (levels 2-3)
HALL = (-11, -13, -5, -5)      # cutters' hall 7 x 9 (level 3)
HEAP = (-5, -14, -1, -12)      # spoil heap
RAIL_X = 0
STAGES = ["Prospect Shaft", "Winding House", "Deep Shaft"]

MATERIALS = {"copper": {"ladder": ["waxed_weathered_cut_copper", "waxed_oxidized_cut_copper"], "axis": "y"},
             "slate": {"block": "deepslate_tiles"}, "spruce_roof": {"block": "spruce_planks"}}

SKILL = os.path.join(HERE, "..", "..", "..", ".claude", "skills", "minecraft-builder")


def inside(x, z, r, pad=0):
    return r[0] - pad <= x <= r[2] + pad and r[1] - pad <= z <= r[3] + pad


def shaft_cell(x, z):
    return COLLAR[0] < x < COLLAR[2] and COLLAR[1] < z < COLLAR[3]


def styled(base, **kw):
    """A preset (name or {"base": ...} dict) with overrides"""
    d = dict(base) if isinstance(base, dict) else {"base": base}
    d.update(kw)
    return d


# ---------- ground ----------

def path_cells(lv):
    cells = set()
    for z in range(-4, 0): cells |= {(x, z) for x in (-1, 0, 1)}                 # gate to the collar
    cells |= {(x, -3) for x in range(-6, 2)} | {(-6, z) for z in range(-8, -2)}  # to the hut / hall door (east side)
    if lv >= 2: cells |= {(x, -3) for x in range(2, 9)} | {(8, -4)}             # to the sorting shed
    return cells


def ground(T, place, lv, keep_clear):
    """The region's ground, path blocks from the gate to each door, snow in Frostmarch"""
    x0, z0, x1, z1 = PLOT
    paths = path_cells(lv)
    for x in range(x0, x1 + 1):
        for z in range(z0, z1 + 1):
            if shaft_cell(x, z): continue
            if (x, z) in paths:
                place.append([x, 0, z, T.path(x, z)]); continue
            verge = any((x + dx, z + dz) in paths for dx, dz in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            b = T.yard(x, z) if verge and _hash(x, z, 6) < 0.45 else T.ground(x, z)
            place.append([x, 0, z, b])
            if b not in ("gravel", "water") and not any(inside(x, z, r) for r in keep_clear): T.snow_layer(place, x, z)


def perimeter(T, place):
    """A low stone dyke with wall tops, log posts at the corners and the gate, a lantern on each gate post"""
    x0, z0, x1, z1 = PLOT
    run = {(x, z1) for x in range(x0, x1 + 1)} | {(x, z0) for x in range(x0, x1 + 1)} | \
          {(x0, z) for z in range(z0, z1 + 1)} | {(x1, z) for z in range(z0, z1 + 1)}
    posts = {(x0, z0), (x1, z0), (x0, z1), (x1, z1), (-2, z1), (2, z1), (x0, -8), (x1, -8), (0, z0)}
    for (x, z) in run:
        if abs(x) <= 1 and z == z1: continue
        if (x, z) in posts:
            place += [[x, 1, z, T.stone_full], [x, 2, z, T.log], [x, 3, z, T.log], [x, 4, z, T.stone_wall]]
        else:
            k = _hash(x, z, 9)
            place += [[x, 1, z, T.stone_full if k < 0.7 else T.stone_brick], [x, 2, z, T.stone_wall]]
    place += [[-2, 5, z1, "lantern"], [2, 5, z1, "lantern"]]


# ---------- the works ----------

def collar(T, place):
    """A brick ring round a 3 x 3 shaft, open to the depth"""
    x0, z0, x1, z1 = COLLAR
    for x in range(x0, x1 + 1):
        for z in range(z0, z1 + 1):
            if shaft_cell(x, z):
                for y in range(-4, 2): place.append([x, y, z, "air"])
                place.append([x, -5, z, "black_concrete"])
            else:
                place += [[x, 0, z, T.stone_accent], [x, 1, z, T.stone_brick]]


def rails(place, z_from, z_to):
    for z in range(z_to, z_from + 1): place.append([RAIL_X, 1, z, "rail"])


def spoil_heap(T, place):
    """Spoil from the shaft in a low heap: gravel, tuff and the region's rough stone"""
    x0, z0, x1, z1 = HEAP
    cx, cz = (x0 + x1) / 2, (z0 + z1) / 2
    for x in range(x0, x1 + 1):
        for z in range(z0, z1 + 1):
            h = 3 - round(abs(x - cx) * 0.9 + abs(z - cz) * 1.3 + noise(x, z, 8, 1.5))
            for y in range(1, max(1, h) + 1):
                k = _hash(x, y * 7 + z, 11)
                place.append([x, y, z, "gravel" if k < 0.35 else "tuff" if k < 0.6 else "cobbled_deepslate"])
            if T.snow: place.append([x, max(1, h) + 1, z, "snow_layer"])


def hut(T):
    return T.house("timber", rect=list(HUT), y=1, plinth=2, storeys=[5], door={"side": "e"}, shutters=0.3, ridge="z",
                   chimney=[[-9, -10]])


def frame_style(T):
    """The headframe and windlass shed are timber in every region: the region's timber preset with its log as frame"""
    return styled(T.timber, frame=T.log, frame_kind="flush")


def shed(T):
    """Level 1: the windlass shed over the collar, a block whose walls are stripped to the frame afterwards"""
    return T.house("timber", style=frame_style(T), rect=list(COLLAR), y=1, plinth=1, storeys=[5], door={"side": "s"},
                   windows={}, chimney=False, shutters=0, name="shaft_shed", ridge="x", bushes=False, piles=False)


def headframe(T):
    """Level 2: the tall timber headframe, the same block raised to two storeys and stripped to its frame"""
    return T.house("timber", style=frame_style(T), rect=list(COLLAR), y=1, plinth=1, storeys=[5, 5], door={"side": "s"},
                   windows={}, chimney=False, shutters=0, name="headframe", ridge="x", bushes=False, piles=False)


def windlass(T, place):
    """Level 1: a log drum across the shaft on two posts, a chain down to a hanging bucket barrel"""
    for x in (COLLAR[0], COLLAR[2]):
        place += [[x, 2, -7, T.log], [x, 3, -7, T.log]]
    for x in range(COLLAR[0] + 1, COLLAR[2]): place.append([x, 4, -7, T.log, {"axis": "x"}])
    for y in range(-1, 4): place.append([0, y, -7, "iron_chain"])
    place.append([0, -2, -7, "barrel"])


def sheave(place, top):
    """Level 2: the sheave wheel on the headframe's top beam, the rope down the shaft and across to the winding house"""
    for y in range(-1, top - 1): place.append([0, y, -7, "iron_chain"])
    place.append([0, top - 1, -7, "grindstone"])
    for x in range(1, WIND[0]): place.append([x, 6, -7, "iron_chain", {"axis": "x"}])


def winding_house(T):
    extra = {"materials": {"roof": "slate"}} if T.region == "frostmarch" else {}
    return T.house("stone", rect=list(WIND), y=1, plinth=2, storeys=[5], door={"side": "s", "kind": "large"}, ridge="x",
                   chimney=[[10, -11]], **extra)


def sorting_shed(T):
    s = {"part": "lean_to", "rect": list(SORT), "against": "n", "top": 7, "y": 1, "post": T.log, "trim": T.planks}
    if T.region == "frostmarch": s["roof"] = "spruce_roof"
    return s


def tower(T):
    """Level 3: the stone headframe tower over the collar, barred slit windows. Frostmarch and the Vale take a
    copper spire (the great building's accent); the others keep their own roof (hipped, mossy gable, crenels)."""
    win = {s: [{"at": 0, "storey": k, "w": 1, "h": 2} for k in (1, 2)] for s in "ensw"}
    kw = {"materials": {"roof": "copper"}} if T.region == "frostmarch" else {}
    if T.region == "saltreach": kw["roof_kw"] = {"pitch": 2}
    return T.house("stone", style=styled(T.stone, glass="iron_bars"), rect=list(COLLAR), y=1, plinth=2, storeys=[5, 5, 5],
                   door={"side": "s", "kind": "large"}, windows=win, chimney=False, shutters=0, name="shaft_tower", ridge="x",
                   bushes=False, **kw)


def cutters_hall(T):
    kw = {}
    if T.region in ("vale", "frostmarch", "saltreach"):
        kw["storey_style"] = [{"frame_kind": "stone", "infill": T.stone_brick if T.region != "frostmarch" else "FRO-01"}, {}]
    return T.house("timber", rect=list(HALL), y=1, plinth=2, storeys=[5, 4], door={"side": "e"}, shutters=0.3, ridge="z",
                   chimney=[[-8, -12]], **kw)


# ---------- levels ----------

def level(T, lv):
    parts, place, strip = [], [], []
    if lv == 1:
        clear = [HUT, COLLAR, (HUT[0] - 1, HUT[1] - 2, HUT[2] + 1, HUT[3] + 1)]
    elif lv == 2:
        clear = [HUT, COLLAR, WIND, SORT, (WIND[0] - 1, WIND[1] - 1, WIND[2] + 1, SORT[3] + 1), (HUT[0] - 1, HUT[1] - 2, HUT[2] + 1, HUT[3] + 1)]
    else:
        clear = [HALL, COLLAR, WIND, SORT, (WIND[0] - 1, WIND[1] - 1, WIND[2] + 1, SORT[3] + 1), (HALL[0] - 1, HALL[1] - 1, HALL[2] + 1, HALL[3] + 1)]
    clear = clear + [HEAP, (COLLAR[0] - 1, COLLAR[1] - 1, COLLAR[2] + 1, COLLAR[3] + 1)]
    ground(T, place, lv, clear)
    perimeter(T, place)
    collar(T, place)
    spoil_heap(T, place)
    rails(place, COLLAR[1] - 1, PLOT[1] + 2)
    if lv < 3:
        parts.append(hut(T))
        parts.append({"part": "woodpile", "at": [HUT[0] + 1, 1, HUT[1] - 1], "len": 3, "h": 2, "facing": "n", "wood": T.wood})
        place.append([-6, 1, -10, "barrel"])
        T.green(place, (HALL[0], HALL[1], HALL[2], HUT[1] - 2), 41, ground=False)   # the hall's ground, still scrub
    if lv == 1:
        parts.append(shed(T)); strip.append((COLLAR, 2, 4))
        windlass(T, place)
        T.green(place, (WIND[0], WIND[1], WIND[2], SORT[3]), 43, trees=[(7, -11, 7), (10, -7, 6)], ground=False)
        place += [[4, 1, -3, "barrel"], [3, 1, -4, T.boulder]]
    if lv >= 2:
        parts += [winding_house(T), sorting_shed(T)]
        place += [[6, 1, -5, "barrel"], [7, 1, -5, "barrel"], [10, 1, -5, "crafting_table"]]
        for z in (-9, -8): place.append([8, 3, z, T.log, {"axis": "z"}])            # the winding drum inside
    if lv == 2:
        parts.append(headframe(T)); strip.append((COLLAR, 2, 9))
        sheave(place, 12)
    if lv == 3:
        parts.append(tower(T))
        if T.region in ("frostmarch", "vale"):
            parts.append({"part": "spire", "rect": list(COLLAR), "kind": "broach", "rows": 3, "roof": "copper", "trim": "dark_oak_planks"})
        parts += [cutters_hall(T), {"part": "woodpile", "at": [HALL[0] + 2, 1, HALL[1] - 1], "len": 3, "h": 2, "facing": "n", "wood": T.wood}]
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
    return out, sorted(beams)


def braces(T, rect, beams):
    x0, z0, x1, z1 = rect
    out = []
    for yb in beams:
        y = yb - 1
        for cx, cz, ux, uz in ((x0, z0, 1, 1), (x1, z0, -1, 1), (x0, z1, 1, -1), (x1, z1, -1, -1)):
            out.append([cx + ux, y, cz, T.stairs, {"facing": "w" if ux > 0 else "e", "half": "top"}])
            out.append([cx, y, cz + uz, T.stairs, {"facing": "n" if uz > 0 else "s", "half": "top"}])
    return out


def specs(ground_plate=False, skill=SKILL, regions=("frostmarch",)):
    sys.path.insert(0, os.path.join(skill, "scripts"))
    from engine import compute  # noqa: E402
    out = {}
    for region in regions:
        T = theme(region)
        for lv in (1, 2, 3):
            parts, place, strip = level(T, lv)
            shapes = []
            if ground_plate:
                x0, z0, x1, z1 = PLOT
                shapes = [{"shape": "box", "min": [x0 - 3, -5, z0 - 3], "max": [x1 + 3, -1, z1 + 3], "material": T.plate[0]},
                          {"shape": "box", "min": [x0 - 3, 0, z0 - 3], "max": [x1 + 3, 0, z1 + 3], "material": T.plate[1]}]
            name = f"deepshaft_{region}_{lv}"
            spec = {"name": name, "edition": "bedrock", "materials": MATERIALS, "shapes": shapes, "parts": parts, "place": place}
            if strip:
                blocks, _, _ = compute(spec)
                for r, y0, y1 in strip:
                    air, beams = strip_to_frame(blocks, r, y0, y1)
                    place += air + braces(T, r, beams)
            if T.snow:
                blocks, _, _ = compute(spec)
                snow_cap(blocks, place)
            out[name] = spec
    return out


def names():
    return names_json("deepshaft", "Deep Shaft", STAGES)


if __name__ == "__main__":
    a = sys.argv[1:]
    skill = a[a.index("--skill") + 1] if "--skill" in a else SKILL
    r = a[a.index("--region") + 1] if "--region" in a else "all"
    for name, spec in specs("--ground" in a, skill, ORDER if r == "all" else r.split(",")).items():
        json.dump(spec, open(os.path.join(a[0], name + ".json"), "w"))
    print("ok")
