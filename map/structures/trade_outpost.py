"""The Trade Outpost: the goods hall a settlement raises beside its station (trade/ in the add-on), in each
region's style and at each station stage, built with the minecraft-builder skill (the one building engine).

    python3 map/structures/trade_outpost.py OUT            -> OUT/<region>_<stage>/scene.json (+ .mcfunction), for the viewer
    python3 map/structures/trade_outpost.py --export       -> Siege_Nights_BP/scripts/trade/outpost_data.js

Frame (the same as the old Trade House wing): skill x east, y up, z south ARE the wing's local x, y, z. The front
faces the station (the skill's "n" side, low z): its (0, 0, 0) is the one-block step on the station's trade_join
mark, the front wall stands at z = 1 and the hall runs back to +z. y = 0 is the floor layer, the door at y = 1.
Inside, along the back wall: the Exports barrel (x -2), the Trade Board (x 0) and the Imports barrel (x +2), left
as marks (export / board / import) for the add-on to fill. Interiors stay empty apart from those.

Each stage contains the one before it, so an upgrade only builds outward:
  halt 7 x 5, station 9 x 5, junction 9 x 7, grand 9 x 7 with an upper storey.
"""
import json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..", "..")
BUILD = os.path.join(ROOT, ".claude", "skills", "minecraft-builder", "scripts", "build.py")

REGIONS = ("vale", "frostmarch", "saltreach", "emberwaste", "blackfen")
STAGES = ("halt", "station", "junction", "grand")
# rect x0, z0, x1, z1 (inclusive, odd both ways) and storeys
SIZE = {"halt": ((-3, 1, 3, 5), [5]), "station": ((-4, 1, 4, 5), [5]), "junction": ((-4, 1, 4, 7), [5]), "grand": ((-4, 1, 4, 7), [5, 4])}

# Region styles from build-instructions/palettes/<region>.md, on the skill's presets
STYLE = {
    "vale": "vale_timber",
    "frostmarch": {"base": "vale_timber", "frame": "dark_oak_log", "infill": "spruce_planks", "trim": "spruce_planks",
                   "plinth": {"ladder": ["cobbled_deepslate", "deepslate_bricks"], "axis": "noise", "scale": 3},
                   "roof": "dark_oak_planks",
                   "glass": "light_blue_stained_glass_pane", "door": "dark_oak_door", "shutter": "dark_oak_planks",
                   "sign_wood": "spruce", "leaves": "spruce_leaves", "chimney": "deepslate_bricks", "quoin": "polished_deepslate"},
    "saltreach": {"base": "vale_timber", "frame": "stripped_birch_log", "infill": "calcite", "trim": "birch_planks", "floor": "birch_planks",
                  "plinth": {"ladder": ["cobblestone", "andesite", "stone_bricks"], "axis": "noise", "scale": 3},
                  "roof": {"ladder": ["prismarine_bricks", "dark_prismarine"], "axis": "y", "reverse": True},
                  "glass": "light_blue_stained_glass_pane", "door": "birch_door", "shutter": "warped_planks",
                  "sign_wood": "birch", "leaves": "azalea_leaves_flowered", "chimney": "brick_block", "quoin": "cut_sandstone"},
    "blackfen": {"base": "vale_timber", "frame": "mangrove_log", "frame_kind": "proud", "trim": "mangrove_planks", "floor": "dark_oak_planks",
                 "infill": {"ladder": ["packed_mud", "mud_bricks"], "axis": "y"},
                 "plinth": {"ladder": ["mud_bricks", "tuff", "packed_mud"], "axis": "noise", "scale": 3},
                 "roof": "dark_oak_planks",
                 "glass": "brown_stained_glass_pane", "door": "mangrove_door", "shutter": "mangrove_planks",
                 "sign_wood": "mangrove", "leaves": "mangrove_leaves", "chimney": "mud_bricks", "quoin": "tuff_bricks"},
}
ROOF = {"vale": {"type": "gable", "ridge": "x"}, "frostmarch": {"type": "gable", "ridge": "x", "pitch": 2},
        "saltreach": {"type": "hip", "pitch": 1}, "blackfen": {"type": "gable", "ridge": "x"}}
# the awning over the back loading hatch: two wools in stripes
AWNING = {"vale": ("red_wool", "white_wool"), "frostmarch": ("blue_wool", "white_wool"), "saltreach": ("cyan_wool", "white_wool"),
          "emberwaste": ("orange_wool", "yellow_wool"), "blackfen": ("green_wool", "brown_wool")}
STACK = {"vale": "spruce", "frostmarch": "spruce", "saltreach": "birch", "emberwaste": "acacia", "blackfen": "mangrove"}


def marks(rect):
    x0, z0, x1, z1 = rect
    return {"export": [-2, 1, z1 - 1], "board": [0, 1, z1 - 1], "import": [2, 1, z1 - 1], "door": [0, 1, z0], "step": [0, 0, 0]}


def goods(place, region, rect, stage):
    """Outside dressing that says 'goods': a striped awning over a loading hatch at the back, barrels and a
    crate stack against the east wall, a hanging lantern by the door. Odd runs, centred."""
    x0, z0, x1, z1 = rect
    a, b = AWNING[region]
    wood = STACK[region]
    # loading hatch in the back wall: a 3 wide opening at y 1..2 with a counter (top slab) and the awning above
    for x in (-1, 0, 1):
        for y in (2, 3): place.append([x, y, z1, "air"])
        place.append([x, 1, z1, f"{wood}_slab", {"half": "top"}])
        # a window's box, sill or shutters there would block the hatch
        for y in (1, 2, 3): place.append([x, y, z1 + 1, "air"])
        for y in (1, 2): place.append([x, y, z1 + 2, "air"])
    for x in range(-2, 3):
        place.append([x, 4, z1 + 1, a if (x + 2) % 2 == 0 else b])
    for x in (-2, 2):
        for y in (1, 2, 3): place.append([x, y, z1 + 1, f"{wood}_fence"])
    # barrels and a crate stack on the east side (3 long, centred on the wall)
    cz = (z0 + z1) // 2
    for dz in (-1, 0, 1): place.append([x1 + 1, 1, cz + dz, "barrel", {"facing": "u"}])
    place.append([x1 + 1, 2, cz, "barrel", {"facing": "e"}])
    if stage in ("junction", "grand"):
        for dz in (-1, 0, 1): place.append([x0 - 1, 1, cz + dz, f"{wood}_planks" if dz else "barrel"])
        place.append([x0 - 1, 2, cz, f"{wood}_trapdoor", {"half": "bottom"}])


def timber_spec(region, stage):
    rect, storeys = SIZE[stage]
    roof = dict(ROOF[region])
    house = {"part": "house", "style": STYLE[region], "rect": list(rect), "y": 0, "plinth": 1, "storeys": storeys,
             "door": {"side": "n", "at": 0, "kind": "house"}, "windows": "auto", "roof": roof, "chimney": False,
             "shutters": 0 if region == "frostmarch" else 0.3}
    if region == "blackfen": house["vines"] = 0.08
    place = []
    goods(place, region, rect, stage)
    m = marks(rect)
    for k in ("export", "board", "import"): place.append([*m[k], "air"])
    place.append([0, 0, 0, "cobblestone" if region != "frostmarch" else "cobbled_deepslate"])
    return {"name": f"trade_outpost_{region}_{stage}", "edition": "bedrock", "parts": [house], "place": place}


def ember_spec(stage):
    """Emberwaste: a kasbah goods hall. Thick sandstone walls on a sandstone footing, cut sandstone jambs, a
    flat roof with a slab parapet and wall-post corners, spruce vigas out every other block under the roof,
    small windows behind acacia lattice, a round-angle arched door, the striped awning at the back."""
    rect, storeys = SIZE[stage]
    x0, z0, x1, z1 = rect
    top = sum(storeys)                    # roof layer
    mats = {"wall": {"ladder": ["sandstone", "smooth_sandstone"], "axis": "y"}}
    shapes = [
        {"shape": "box", "min": [x0, 0, z0], "max": [x1, top, z1], "material": "wall", "hollow": 1},
    ]
    place = []
    # footing course and floor
    for x in range(x0, x1 + 1):
        for z in range(z0, z1 + 1):
            edge = x in (x0, x1) or z in (z0, z1)
            place.append([x, 0, z, "sandstone" if edge else "smooth_sandstone"])
    # corner jambs, cut sandstone full height
    for x in (x0, x1):
        for z in (z0, z1):
            for y in range(1, top): place.append([x, y, z, "cut_sandstone"])
    # flat roof, parapet of slabs with wall posts at the corners and mid-sides
    for x in range(x0 + 1, x1):
        for z in range(z0 + 1, z1):
            place.append([x, top, z, "smooth_sandstone"])
    for x in range(x0, x1 + 1):
        for z in range(z0, z1 + 1):
            if x in (x0, x1) or z in (z0, z1):
                post = (x in (x0, x1) and z in (z0, z1)) or (x == 0 and z in (z0, z1)) or (z == (z0 + z1) // 2 and x in (x0, x1))
                place.append([x, top + 1, z, "sandstone_wall" if post else "smooth_sandstone_slab", {} if post else {"half": "bottom"}])
    # a string course of red sandstone between storeys on the grand hall
    if len(storeys) > 1:
        y = storeys[0]
        for x in range(x0, x1 + 1):
            for z in (z0, z1): place.append([x, y, z, "cut_red_sandstone"])
        for z in range(z0, z1 + 1):
            for x in (x0, x1): place.append([x, y, z, "cut_red_sandstone"])
    # vigas: spruce logs out of the front and back walls under the roof, every other block on odd offsets
    for x in range(x0 + 1, x1, 2):
        place.append([x, top - 1, z0 - 1, "spruce_log", {"axis": "z"}])
        place.append([x, top - 1, z1 + 1, "spruce_log", {"axis": "z"}])
    # the door: 3 wide, 3 high, round-angle head in acacia; jambs chiseled
    for y in (1, 2, 3):
        for x in (-1, 0, 1): place.append([x, y, z0, "air"])
    place.append([-1, 3, z0, "acacia_stairs", {"facing": "w", "half": "top"}])
    place.append([1, 3, z0, "acacia_stairs", {"facing": "e", "half": "top"}])
    for x in (-2, 2):
        for y in (1, 2, 3): place.append([x, y, z0, "cut_sandstone"])
    place.append([-2, 4, z0, "chiseled_sandstone"]); place.append([2, 4, z0, "chiseled_sandstone"])
    for x in (-1, 0, 1): place.append([x, 4, z0, "chiseled_sandstone"])
    # windows: 1 x 2, orange glass flush, acacia trapdoor lattice on the outside, on bay centres
    for y0 in [1 + 1] + ([storeys[0] + 2] if len(storeys) > 1 else []):
        for x in range(x0 + 2, x1 - 1, 2 if x1 - x0 <= 6 else 3):
            if abs(x) <= 2 and y0 == 2: continue      # the door bay on the front
            for y in (y0, y0 + 1): place.append([x, y, z0, "orange_stained_glass_pane"])
            place.append([x, y0 + 1, z0 - 1, "acacia_trapdoor", {"open": True, "facing": "n"}])
        for z in range(z0 + 2, z1 - 1, 2):
            for x, f in ((x0, "w"), (x1, "e")):
                for y in (y0, y0 + 1): place.append([x, y, z, "orange_stained_glass_pane"])
                place.append([x + (-1 if f == "w" else 1), y0 + 1, z, "acacia_trapdoor", {"open": True, "facing": f}])
    # lanterns either side of the door
    place.append([-2, 3, z0 - 1, "lantern", {"hanging": False}])
    place.append([2, 3, z0 - 1, "lantern", {"hanging": False}])
    goods(place, "emberwaste", rect, stage)
    m = marks(rect)
    for k in ("export", "board", "import"): place.append([*m[k], "air"])
    place.append([0, 0, 0, "smooth_sandstone"])
    return {"name": f"trade_outpost_emberwaste_{stage}", "edition": "bedrock", "materials": mats, "shapes": shapes, "place": place}


def spec(region, stage):
    return ember_spec(stage) if region == "emberwaste" else timber_spec(region, stage)


def build(region, stage, out):
    d = os.path.join(out, f"{region}_{stage}")
    os.makedirs(d, exist_ok=True)
    path = os.path.join(d, "spec.json")
    json.dump(spec(region, stage), open(path, "w"), indent=1)
    r = subprocess.run([sys.executable, BUILD, path, d, "--no-preview"], check=True, capture_output=True, text=True)
    summ = json.loads(r.stdout.strip().splitlines()[-1])
    # nothing may stand in front of the step (z < 0 is the station's back): the window boxes' front signs go
    sp = os.path.join(d, "scene.json")
    sc = json.load(open(sp))
    sc["blocks"] = [b for b in sc["blocks"] if b[2] >= 0]
    sc.pop("camera", None)   # the viewer frames it itself
    json.dump(sc, open(sp, "w"), separators=(",", ":"))
    return d, summ


# ---------------------------------------------------------------- export to the add-on

KEEP = ("facing", "axis", "half", "upper", "hinge", "open", "hanging")
FLIP = {"n": "s", "s": "n", "e": "e", "w": "w", "u": "u", "d": "d"}   # skill z south = local +z; the data's "n" is local +z


def export_one(scene_path, rect):
    sc = json.load(open(scene_path))
    pal, idx, cells = [], {}, {}
    for x, y, z, i in sc["blocks"]:
        n, p = sc["palette"][i]
        q = {k: v for k, v in p.items() if k in KEEP}
        if "facing" in q: q["facing"] = FLIP.get(q["facing"], q["facing"])
        if n == "air": q = {}
        key = json.dumps([n, q], sort_keys=True)
        if key not in idx: idx[key] = len(pal); pal.append([n if ":" in n else "minecraft:" + n, q])
        cells[(x, y, z)] = idx[key]
    # clear whatever stands inside and under the eaves: air below the top block of every column the hall covers
    air = None
    tops = {}
    for (x, y, z) in cells: tops[(x, z)] = max(tops.get((x, z), 0), y)
    for (x, z), t in tops.items():
        for y in range(1, t):
            if (x, y, z) not in cells:
                if air is None:
                    air = len(pal); pal.append(["minecraft:air", {}])
                cells[(x, y, z)] = air
    rows = []
    for (y, z) in sorted({(c[1], c[2]) for c in cells}):
        run = None
        for x in sorted(c[0] for c in cells if c[1] == y and c[2] == z):
            pi = cells[(x, y, z)]
            if run and run[2] + run[3] == x and run[4] == pi: run[3] += 1
            else:
                if run: rows.append(run)
                run = [y, z, x, 1, pi]
        if run: rows.append(run)
    xs = [c[0] for c in cells]; ys = [c[1] for c in cells]; zs = [c[2] for c in cells]
    box = {"x0": min(xs), "x1": max(xs), "y0": min(ys), "y1": max(ys), "z0": min(zs), "z1": max(zs)}
    return {"palette": pal, "rows": rows, "marks": marks(rect), "box": box}


def export(tmp):
    out, problems = {}, []
    for region in REGIONS:
        out[region] = {}
        prev = None
        for stage in STAGES:
            d, summ = build(region, stage, tmp)
            for w in summ.get("warnings", []): print("  warning", region, stage, w)
            e = export_one(os.path.join(d, "scene.json"), SIZE[stage][0])
            b = e["box"]
            if b["z0"] < 0 or max(-b["x0"], b["x1"]) > 6 or b["z1"] > 9: problems.append(f"{region} {stage}: box {b}")
            if prev and not (b["x0"] <= prev["x0"] and b["x1"] >= prev["x1"] and b["z1"] >= prev["z1"]):
                problems.append(f"{region} {stage}: does not contain the stage before")
            prev = b
            out[region][stage] = e
            print(region, stage, "cells", sum(r[3] for r in e["rows"]), "box", b)
    if problems: sys.exit("PROBLEMS:\n " + "\n ".join(problems))
    dest = os.path.join(ROOT, "Siege_Nights_BP", "scripts", "trade", "outpost_data.js")
    js = ("// Generated by map/structures/trade_outpost.py (minecraft-builder skill). Do not edit by hand.\n"
          "// TRADE_OUTPOST_DESIGNS[region][halt|station|junction|grand]: the Trade Outpost wing. Local frame: its (0, 0, 0)\n"
          "// is the step on the station's trade_join mark, front wall at z = 1 facing the station, the hall at +z, floor y = 0.\n"
          "// marks: export, board, import (left as air for the add-on), door, step.\n"
          "// Same shape as townhall/designs_data.js: palette [id, logical props], rows [y, z, x0, count, palette index].\n"
          "export const TRADE_OUTPOST_DESIGNS = " + json.dumps(out, separators=(",", ":")) + ";\n")
    open(dest, "w").write(js)
    print("wrote", os.path.relpath(dest, ROOT), os.path.getsize(dest) // 1024, "KB")


def main():
    if "--export" in sys.argv:
        import tempfile
        with tempfile.TemporaryDirectory() as t: export(t)
        return
    out = os.path.abspath(sys.argv[1])
    names = {}
    for region in REGIONS:
        for stage in STAGES:
            d, summ = build(region, stage, out)
            names[f"{region}_{stage}"] = f"Trade Outpost · {region.capitalize()} · {stage}"
            print(region, stage, summ["blocks"], "blocks", "warnings:", summ.get("warnings", []))
    json.dump(names, open(os.path.join(out, "names.json"), "w"))


if __name__ == "__main__":
    main()
