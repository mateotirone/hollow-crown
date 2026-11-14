"""The plot mine's pithead (Mateo 2026-11-14: "Let's retexture the mine and redo the 3D build of the mine too. Right
now, it's boring."). Every plot has one, about 76 blocks from its Plot Stone, and Act 1 day 2 sends every player to
it ("Find the old mine shaft"), so it is a story build and must be perfect.

What stands at the top of the shaft, in every region's look (machine_regions.py):
  - the collar: a stone ring round the 3 x 3 shaft, a low parapet with a gap at the front where the ladder starts
  - the headframe: four tall legs braced at two girts, a little roof, and the sheave wheel turning on its axle at
    the top; the rope drops from the wheel down the middle of the shaft with a lantern on its end
  - the winding drum in an open lean-to, the rope straight down to it from the wheel; the winding house (east)
    behind it with the miners' gear (interior "storage")
  - the ore tip (west): a cart track from the collar to a timber ore bin and the spoil heap behind it
  - the pit bell on its frame by the front path, lamp posts, a woodpile, barrels

The shaft below ground (ladder, timbers, the pit bottom, the haulage way, the miners' rest) is the game's nightly
plan (Siege_Nights_BP/scripts/plotcaves/data.js), because the cave under it is generated per plot.

Skill frame: x east, y up, z south; the front faces south (+z), towards the Plot Stone. The shaft is the 3 x 3 at
x, z = -1..1; y = 0 is the ground (the collar row). Footprint 25 x 15: x -11..13, z -6..8.

Usage: python3 spec.py OUTDIR [--ground] [--region R|all]
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
from machine_regions import theme, snow_cap, ORDER, NAMES, _hash, noise  # noqa: E402

PLOT = (-11, -6, 13, 8)
COLLAR = (-2, -2, 2, 2)        # 5 x 5 ring; the shaft is the 3 x 3 inside
WIND = (6, -3, 12, 3)          # winding house 7 x 7
BIN = (-9, -2, -7, 2)          # ore bin 3 x 5
HEAP = (-10, -6, -5, -3)       # spoil heap
LEG_TOP = 10                   # the legs stand y 1..10, the head deck is y 11
WHEEL_Y = 15                   # the sheave's axle (radius 3: the rim runs y 12..18)
SKILL = os.path.join(HERE, "..", "..", "..", ".claude", "skills", "minecraft-builder")


def inside(x, z, r, pad=0):
    return r[0] - pad <= x <= r[2] + pad and r[1] - pad <= z <= r[3] + pad


def shaft_cell(x, z):
    return abs(x) <= 1 and abs(z) <= 1


def path_cells():
    cells = {(x, z) for x in (-1, 0, 1) for z in range(3, PLOT[3] + 1)}             # the front path to the gap
    cells |= {(x, 5) for x in range(2, 10)} | {(9, 4)}                                # to the winding house door
    cells |= {(x, z) for x in range(-6, -2) for z in (-1, 0, 1)}                      # the tip yard beside the track
    return cells


def ground(T, place, keep_clear):
    x0, z0, x1, z1 = PLOT
    paths = path_cells()
    for x in range(x0, x1 + 1):
        for z in range(z0, z1 + 1):
            if inside(x, z, COLLAR): continue
            if (x, z) in paths:
                place.append([x, 0, z, T.path(x, z)]); continue
            near = any(inside(x, z, r, 1) for r in keep_clear) or any((x + dx, z + dz) in paths for dx in (-1, 0, 1) for dz in (-1, 0, 1))
            b = T.yard(x, z, 3) if near and _hash(x, z, 6) < 0.6 else T.ground(x, z, 4)
            place.append([x, 0, z, b])


def collar(T, place):
    """A stone ring round the 3 x 3 shaft, a parapet on it with a gap at the front over the ladder"""
    x0, z0, x1, z1 = COLLAR
    for x in range(x0, x1 + 1):
        for z in range(z0, z1 + 1):
            if shaft_cell(x, z): continue                                # the shaft (and its ladder) are the game's nightly plan
            place.append([x, 0, z, T.stone_accent if (x + z) % 2 else T.stone_brick])
            if abs(x) == 2 and abs(z) == 2: continue                     # the legs stand on the corners
            if (x, z) == (0, 2): continue                                 # the gap: the ladder is below it
            place.append([x, 1, z, T.stone_wall])


def headframe(T, place):
    """Four legs braced at girts y 4 and 7 (knee braces under each), the head deck on y 11 with a rail round it,
    the bearers and the sheave wheel standing open above it, the rope down through the deck into the shaft"""
    L = T.log
    for x in (-2, 2):
        for z in (-2, 2):
            for y in range(1, LEG_TOP + 1): place.append([x, y, z, L])
    for y in (4, 7, LEG_TOP):
        for k in (-1, 0, 1):
            place += [[k, y, -2, L, {"axis": "x"}], [k, y, 2, L, {"axis": "x"}], [-2, y, k, L, {"axis": "z"}], [2, y, k, L, {"axis": "z"}]]
        for cx, cz, ux, uz in ((-2, -2, 1, 1), (2, -2, -1, 1), (-2, 2, 1, -1), (2, 2, -1, -1)):
            place.append([cx + ux, y - 1, cz, T.stairs, {"facing": "w" if ux > 0 else "e", "half": "top"}])
            place.append([cx, y - 1, cz + uz, T.stairs, {"facing": "n" if uz > 0 else "s", "half": "top"}])
    # the head deck: one wider than the legs all round, carried on upside-down stairs; a hole for the rope
    D = LEG_TOP + 1
    for x in range(-3, 4):
        for z in range(-3, 4):
            if (x, z) == (0, 0): continue
            edge = max(abs(x), abs(z)) == 3
            place.append([x, D, z, T.slab if edge else T.planks, {"half": "top"} if edge else {}])
    for x in range(-3, 4):
        for z in range(-3, 4):
            if max(abs(x), abs(z)) == 3 and not (abs(x) == 3 and abs(z) == 3) and abs(x) != 0 and abs(z) != 0 and min(abs(x), abs(z)) == 2:
                f = "e" if x == -3 else "w" if x == 3 else "s" if z == -3 else "n"
                place.append([x, D - 1, z, T.stairs, {"facing": f, "half": "top"}])
    for x in range(-3, 4):
        for z in range(-3, 4):
            if max(abs(x), abs(z)) == 3: place.append([x, D + 1, z, T.fence])
    # bearers: two posts each side carry the axle, braced off the deck
    for z in (-2, 2):
        for y in range(D + 1, WHEEL_Y): place.append([0, y, z, L])
        place.append([0, WHEEL_Y, z, L, {"axis": "z"}])
        for dx in (-1, 1): place.append([dx, D + 1, z, T.stairs, {"facing": "e" if dx < 0 else "w", "half": "bottom"}])
    place.append([0, WHEEL_Y, -1, L, {"axis": "z"}]); place.append([0, WHEEL_Y, 1, L, {"axis": "z"}])
    sheave(T, place)
    # the rope down the middle of the shaft (the game's plan carries it on down, with a lantern on its end)
    for y in range(1, D + 1): place.append([0, y, 0, "iron_chain"])


def sheave(T, place):
    """The wheel in the x-y plane over the shaft: a rim of radius 3, eight spokes and an iron hub on the axle"""
    cy = WHEEL_Y
    rim = set()
    for a in range(0, 360, 5):
        import math
        dx, dy = round(3 * math.cos(math.radians(a))), round(3 * math.sin(math.radians(a)))
        rim.add((dx, dy))
    rim_block = "dark_oak_planks" if T.wood != "dark_oak" else "spruce_planks"
    for dx, dy in rim: place.append([dx, cy + dy, 0, rim_block])
    for dx in (-2, -1, 1, 2): place.append([dx, cy, 0, T.fence])
    for dy in (-2, -1, 1, 2): place.append([0, cy + dy, 0, T.fence])
    place.append([0, cy, 0, "iron_block" if T.region != "emberwaste" else "polished_basalt"])


def winding_house(T):
    kw = {"materials": {"roof": "slate"}} if T.region == "frostmarch" else {}
    return T.house("timber", rect=list(WIND), y=1, plinth=1, storeys=[5], door={"side": "s"}, ridge="x",
                   chimney=False, interior="storage", name="winding_house", **kw)


def drum(T, place):
    """The winding drum in the open lean-to between the headframe and the winding house, on two posts; the rope
    runs from the sheave's east rim straight down to it through the lean-to's roof"""
    x = 4
    for z in (-2, 2): place += [[x, 1, z, T.stone_full], [x, 2, z, T.log], [x, 3, z, T.log]]
    for z in (-1, 0, 1): place.append([x, 4, z, T.log, {"axis": "z"}])
    for y in range(5, WHEEL_Y + 1): place.append([x, y, 0, "iron_chain"])
    place += [[5, 1, -1, "barrel"], [5, 1, 1, "barrel"], [5, 2, 1, "barrel"]]


def drum_shelter(T, place):
    """An open shelter over the drum against the winding house's west wall: two posts and a beam at the front,
    a slab roof back to the wall, the rope through it"""
    for z in (-3, 3):
        for y in range(1, 6): place.append([3, y, z, T.log])
    for z in range(-3, 4): place.append([3, 6, z, T.log, {"axis": "z"}])
    for x in (4, 5):
        for z in range(-3, 4):
            if (x, z) != (4, 0): place.append([x, 6, z, T.slab, {"half": "top"}])
    for x in (3, 4, 5):
        for z in (-3, 3): place.append([x, 7, z, T.slab, {"half": "bottom"}])
    place.append([3, 5, -1, "lantern", {"hanging": True}])


def lights(T, place):
    """Lanterns on the parapet beside the ladder gap and under the top girt on every face"""
    place += [[-1, 2, 2, "lantern"], [1, 2, 2, "lantern"]]
    for x, z in ((0, 2), (0, -2), (2, 0), (-2, 0)): place.append([x, LEG_TOP - 1, z, "lantern", {"hanging": True}])


def ore_tip(T, place):
    """Rails from the collar's west side to the ore bin: an open plank bin on a stone sill, heaped with ore"""
    for x in range(-6, -2): place.append([x, 1, 0, "rail", {"axis": "x"}])
    x0, z0, x1, z1 = BIN
    for x in range(x0, x1 + 1):
        for z in range(z0, z1 + 1):
            place.append([x, 0, z, T.stone_full])
            if x in (x0, x1) or z in (z0, z1):
                corner = x in (x0, x1) and z in (z0, z1)
                place += [[x, 1, z, T.log if corner else T.planks], [x, 2, z, T.log if corner else T.slab, {} if corner else {"half": "bottom"}]]
            else:
                k = _hash(x, z, 21)
                place.append([x, 1, z, "raw_iron_block" if k < 0.3 else "coal_block" if k < 0.6 else "raw_copper_block" if k < 0.75 else "gravel"])
                if abs(z) <= 0: place.append([x, 2, z, "coal_block" if k < 0.5 else "raw_iron_block"])
    place += [[x1, 1, 0, "rail", {"axis": "x"}], [x1, 2, 0, "air"], [x1 + 1, 1, 0, "rail", {"axis": "x"}]]   # the bin's mouth to the track


def spoil_heap(T, place):
    x0, z0, x1, z1 = HEAP
    cx, cz = (x0 + x1) / 2, (z0 + z1) / 2
    for x in range(x0, x1 + 1):
        for z in range(z0, z1 + 1):
            h = 4 - round(abs(x - cx) * 0.7 + abs(z - cz) * 1.1 + noise(x, z, 8, 1.2))
            for y in range(1, max(0, h) + 1):
                k = _hash(x, y * 7 + z, 11)
                place.append([x, y, z, "gravel" if k < 0.3 else "tuff" if k < 0.55 else T.stone_full if k < 0.8 else "cobblestone"])
            if T.snow and h >= 1: place.append([x, h + 1, z, "snow_layer"])


def pit_bell(T, place):
    """The pit bell, rung at the start and end of a shift: two posts, a beam and the bell under it"""
    x, z = 3, 6
    for dx in (0, 2):
        place += [[x + dx, 1, z, T.stone_full], [x + dx, 2, z, T.fence], [x + dx, 3, z, T.fence]]
    for dx in (0, 1, 2): place.append([x + dx, 4, z, T.log, {"axis": "x"}])
    place.append([x + 1, 3, z, "bell", {"facing": "s", "attach": "hanging"}])


def lamp(T, place, x, z, arm):
    """A lamp post: stone foot, a log post, an arm and a lantern hung under it"""
    place += [[x, 1, z, T.stone_full], [x, 2, z, T.fence], [x, 3, z, T.fence], [x, 4, z, T.fence]]
    ax, az = x + arm[0], z + arm[1]
    place += [[ax, 4, az, T.fence], [ax, 3, az, "lantern", {"hanging": True}]]


def level(T):
    parts, place = [], []
    clear = [COLLAR, WIND, BIN, HEAP]
    ground(T, place, clear)
    T.green(place, (-10, 3, -3, 8), 51, ground=False)
    T.green(place, (8, 6, 10, 8), 52, ground=False)
    collar(T, place)
    headframe(T, place)
    parts.append(winding_house(T))
    drum_shelter(T, place)
    lights(T, place)
    drum(T, place)
    ore_tip(T, place)
    spoil_heap(T, place)
    pit_bell(T, place)
    lamp(T, place, -3, 3, (1, 0))
    parts.append({"part": "woodpile", "at": [5, 1, -5], "len": 5, "h": 2, "facing": "s", "wood": T.wood})
    place += [[4, 1, -3, "barrel"], [4, 1, -4, "barrel"], [4, 2, -4, "barrel"], [-4, 1, 3, "barrel"], [-5, 1, 3, "crafting_table"]]
    return parts, place


def specs(ground_plate=False, skill=SKILL, regions=ORDER):
    sys.path.insert(0, os.path.join(skill, "scripts"))
    from engine import compute  # noqa: E402
    out = {}
    for region in regions:
        T = theme(region)
        parts, place = level(T)
        shapes = []
        if ground_plate:
            x0, z0, x1, z1 = PLOT
            shapes = [{"shape": "box", "min": [x0, -2, z0 - 2], "max": [x1 + 2, -1, z1 + 2], "material": T.plate[0]},
                      {"shape": "box", "min": [-1, -6, -1], "max": [1, -1, 1], "op": "sub"}]
        name = f"pithead_{region}"
        spec = {"name": name, "edition": "bedrock", "materials": {"slate": {"block": "deepslate_tiles"}}, "shapes": shapes,
                "parts": parts, "place": place}
        if T.snow:
            blocks, _, _ = compute(spec)
            snow_cap(blocks, place)
        out[name] = spec
    return out


if __name__ == "__main__":
    a = sys.argv[1:]
    r = a[a.index("--region") + 1] if "--region" in a else "all"
    for name, spec in specs("--ground" in a, SKILL, ORDER if r == "all" else r.split(",")).items():
        json.dump(spec, open(os.path.join(a[0], name + ".json"), "w"))
    print("ok")
