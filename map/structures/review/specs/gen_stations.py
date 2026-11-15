"""Writes the railway station specs on the skill (Mateo 2026-11-15: "Kings rest station go ahead, and then use this
base as a repair job for ALL the regions castle level stations", "make sure all station upgrades have the same applied
build principals as well").

The Kingsrest station is the base: a two-storey booking hall along the line, a clock tower on its middle (stone shaft,
the region's top stage jettied one out on brackets with a framed clock on every face, the region's cap: towers/README.md
section 5), a platform canopy leaning on the hall, and the booking hall inside (interior "station"). Every region's four
station stages follow it in the region's own style (regions/<region>.md): Halt, Station, Junction, Grand.

kingsrest_station.json is in its own frame (street to +z, the line to -z). station_<stage>_<region>.json are in the
station frame of map/structures/stations.py, in blueprint coordinates: local x along the line, blueprint z = -local z,
so the track side is "s" and the street side "n". stations.py adds what the skill has no part for: the platform, the
Grand Station's glass train shed, the stalls fittings and the marks.
"""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))

def R(x0, a, x1, b):
    """A blueprint rect from local x0..x1 and local z a..b (stations.py's R)."""
    return [x0, -b, x1, -a]

SHINGLE = {"ladder": ["dark_oak_planks", "spruce_planks"], "axis": "noise", "scale": 2}
SLATE = {"block": "deepslate_tiles"}
COPPER = {"ladder": ["waxed_weathered_cut_copper", "waxed_oxidized_cut_copper"], "axis": "noise", "scale": 2}

# each region's way (regions/<region>.md "Building it with the skill", towers/README.md section 5)
REG = {
    "vale": dict(style={"base": "vale_stone"}, upper={"frame_kind": "flush", "frame": "stripped_spruce_log", "infill": "calcite"},
                 roof={"type": "gable", "pitch": 1}, tower_top={"base": "vale_timber", "frame": "stripped_spruce_log", "infill": "spruce_planks"},
                 cap=("spire", SLATE), lean=dict(post="stripped_spruce_log", trim="dark_oak_planks", roof={"ladder": "VAL-06", "axis": "y", "reverse": True}), wood="dark_oak", bracket="dark_oak_stairs",
                 sub="Norman stone and timber"),
    "frostmarch": dict(style={"base": "frost_timber", "roof": SHINGLE}, ground={"frame_kind": "stone", "frame": "deepslate_bricks", "infill": {"ladder": "FRO-01", "axis": "y"}},
                       roof={"type": "gable", "pitch": 2, "gable_horns": True, "snow": True}, tower_top={"base": "frost_timber"},
                       cap=("spire", SLATE), lean=dict(post="dark_oak_log", trim="dark_oak_planks", roof=SHINGLE), wood="dark_oak", bracket="dark_oak_stairs",
                       sub="Norse stave and stone"),
    "saltreach": dict(style={"base": "salt_stone"}, upper={"frame_kind": "flush", "frame": "stripped_birch_log", "infill": "calcite"},
                      roof={"type": "hip"}, tower_top={"base": "salt_stone"}, cap=("hip", {"block": "dark_prismarine"}),
                      lean=dict(post="stripped_birch_log", trim="birch_planks", roof={"block": "dark_prismarine"}), wood="birch", bracket="birch_stairs",
                      sub="Sea-town sandstone and birch"),
    "emberwaste": dict(style={"base": "ember_sandstone", "roof": {"block": "smooth_sandstone"}}, roof={"type": "flat", "parapet": "crenel"},
                       tower_top={"base": "ember_sandstone", "roof": {"block": "smooth_sandstone"}}, cap=("dome", None),
                       lean=dict(post="stripped_acacia_log", trim="acacia_planks", roof={"block": "smooth_red_sandstone"}), wood="acacia", bracket="sandstone_stairs",
                       sub="Desert sandstone"),
    "blackfen": dict(style={"base": "fen_timber"}, roof={"type": "gable", "pitch": 1, "moss": True}, piles=True,
                     tower_top={"base": "fen_timber"}, cap=("spire", {"block": "dark_oak_planks"}),
                     lean=dict(post="mangrove_log", trim="spruce_planks", roof={"block": "dark_oak_planks"}), wood="spruce", bracket="spruce_stairs",
                     sub="Bog timber and mud brick"),
}

def hall(g, rect, storeys, door, windows, interior="station", ridge="x", wings=(), y=0):
    """The booking hall: the region's preset, a stone ground storey under the region's upper storey when it has one."""
    ss = []
    for i in range(len(storeys)):
        if i == 0 and g.get("ground"): ss.append(g["ground"])
        elif i > 0 and g.get("upper"): ss.append(g["upper"])
        else: ss.append({})
    roof = dict(g["roof"])
    if roof["type"] == "gable": roof["ridge"] = ridge
    h = {"part": "house", "style": dict(g["style"]), "rect": rect, "y": y, "plinth": 1, "storeys": storeys, "storey_style": ss,
         "door": door, "windows": windows, "shutters": 0, "roof": roof, "chimney": False, "vines": 0, "bushes": False,
         "interior": {"use": interior, "entry": door["side"]} if interior and door else interior}
    if g.get("piles"): h["piles"] = True
    if wings: h["wings"] = list(wings)
    return h

def clock_tower(g, rect, base_top, stage_h=7, clock=5, door=None, belfry=True):
    """towers/README.md: a stone shaft (the hall's ground preset) up to base_top, the region's top stage jettied one out
    on brackets with a framed clock on every face, then the region's cap. Returns (parts, place)."""
    x0, z0, x1, z1 = rect
    J = [x0 - 1, z0 - 1, x1 + 1, z1 + 1]
    region_stone = {"vale": "vale_stone", "frostmarch": "frost_stone", "saltreach": "salt_stone", "emberwaste": "ember_sandstone", "blackfen": "fen_timber"}
    h = base_top - 1
    shaft_storeys = []
    while h > 0:
        s = min(6, h); shaft_storeys.append(s); h -= s
    if shaft_storeys[-1] < 3 and len(shaft_storeys) > 1: shaft_storeys[-2] += shaft_storeys.pop()
    w = x1 - x0 + 1
    win = {sd: [{"at": 0, "storey": i, "w": 1, "h": 2} for i in range(1, len(shaft_storeys))] for sd in "nsew"}
    parts = [{"part": "house", "style": {"base": region_stone[g["key"]]} if g["key"] != "blackfen" else dict(g["style"]),
              "rect": rect, "y": 0, "plinth": 1, "storeys": shaft_storeys, "door": door, "windows": win, "shutters": 0,
              "roof": {"type": "flat"}, "chimney": False, "vines": 0, "bushes": False, "interior": {"use": "tower", "rooms": ["open", "guard", "lookout"], "entry": door["side"]} if door else False}]
    if g.get("piles"): parts[0]["piles"] = True
    SY = base_top
    parts.append({"part": "house", "style": dict(g["tower_top"]), "rect": J, "y": SY, "plinth": 1, "storeys": [stage_h], "door": None,
                  "windows": {"n": [], "s": [], "e": [], "w": []}, "roof": {"type": "flat"}, "chimney": False, "bushes": False, "vines": 0, "interior": False})
    kind, mat = g["cap"]
    if kind == "spire":
        parts.append({"part": "spire", "rect": J, "rows": 3, "overhang": 1, "roof": mat, "trim": g["lean"]["trim"], "finial": "none"})
        if belfry:
            cx, cz = (x0 + x1) // 2, (z0 + z1) // 2
            parts.append({"part": "belfry", "rect": [cx - 1, cz - 1, cx + 1, cz + 1], "y": "roof", "h": 3, "pier": g["wood"] + "_fence",
                          "deck": g["wood"] + "_planks", "trim": g["wood"] + "_planks", "roof": mat, "cap": "spire", "rows": 2, "finial": "spire_block"})
    elif kind == "hip":
        parts.append({"part": "belfry", "rect": J, "y": "top", "h": 3, "pier": "smooth_sandstone", "deck": "birch_planks", "trim": "birch_planks",
                      "roof": mat, "cap": "hip", "rows": 2, "finial": "lantern", "bell": False})
    elif kind == "dome":
        cx, cz = (x0 + x1) // 2, (z0 + z1) // 2
        parts.append({"part": "dome", "at": [cx, cz], "r": w / 2, "finial": "gold"})
    ft = {"vale": "dark_oak", "frostmarch": "dark_oak", "saltreach": "birch", "emberwaste": "acacia", "blackfen": "spruce"}[g["key"]]
    parts += [{"part": "clock_face", "rect": J, "side": sd, "y": SY + 1 + (stage_h - clock) // 2 + clock // 2, "size": clock, "time": "3:00",
               "frame": "stairs", "frame_wood": ft, "hub": ft + "_button"} for sd in "nsew"]
    place = []
    for x in range(J[0], J[2] + 1):          # brackets under the jetty: every other block, corners left bare
        for z in range(J[1], J[3] + 1):
            if x0 <= x <= x1 and z0 <= z <= z1: continue
            if x in (J[0], J[2]) and z in (J[1], J[3]): continue
            sd = "s" if z == J[1] else "n" if z == J[3] else "e" if x == J[0] else "w"
            t = x if z in (J[1], J[3]) else z
            if t % 2 == 0: place.append([x, SY - 1, z, g["bracket"], {"facing": sd, "half": "top"}])
    return parts, place

def canopy(g, rect, against, top, pitch="half"):
    """The platform canopy: the skill's lean-to on the hall wall, posts on the platform side."""
    return dict({"part": "lean_to", "rect": rect, "against": against, "top": top, "pitch": pitch, "y": 0}, **g["lean"])

def G(region):
    g = dict(REG[region]); g["key"] = region; return g

# ---------------------------------------------------------------- Kingsrest station (the base)
def kingsrest():
    g = G("vale"); g["style"] = {"base": "vale_stone", "roof": SLATE}; g["upper"] = None; g["lean"] = dict(g["lean"], roof=SLATE)
    H = [0, 0, 20, 6]                                      # the booking hall, 21 x 7, along the line (to -z)
    T = [7, 6, 13, 12]                                     # the clock tower on the street front, 7 x 7, its base the entrance
    win_s = [{"at": a, "storey": i} for a in (-8, -4, 4, 8) for i in (0, 1)]
    win_n = [{"at": a, "storey": i} for a in (-8, -4, 4, 8) for i in (0, 1)] + [{"at": 0, "storey": 1}]
    hl = hall(g, H, [6, 5], {"side": "n", "kind": "grand", "steps": 0}, {"s": win_s, "n": win_n, "e": [{"at": 0, "storey": i} for i in (0, 1)],
              "w": [{"at": 0, "storey": i} for i in (0, 1)]})
    tp, place = clock_tower(g, T, 19, stage_h=8, door={"side": "s", "kind": "grand", "steps": 1})
    tp[2]["roof"] = COPPER; tp[3]["roof"] = COPPER              # copper is for civic towers only (towers/README.md): the capital's station is civic
    parts = [hl] + tp + [
        {"part": "door", "rect": H, "side": "s", "at": 0, "floor": 0, "kind": "house", "canopy": False},   # the hall opens into the tower's base
        dict(canopy(g, [0, -4, 20, -1], "s", 7), floor="polished_andesite")]
    return {"name": "kingsrest_station",
            "card": {"title": "Kingsrest station", "sub": "Norman stone", "region": "vale", "where": "Kingsrest", "kind": "Civic",
                     "blurb": "The capital's station: a two-storey stone booking hall along the line under slate, a clock tower on the street front with "
                              "a timber clock stage jettied on brackets, a clock on every face and a copper spire, a slate platform canopy on posts, "
                              "and the booking hall inside (ticket window, benches, timetable). Built on the skill."},
            "parts": parts, "place": place}

# ---------------------------------------------------------------- the four stages, every region (station frame)
def _top(parts):
    """The highest block of what is built so far (the tower's shaft must clear the hall's ridge)."""
    import sys
    sk = os.path.join(HERE, "..", "..", "..", "..", ".claude", "skills", "minecraft-builder", "scripts")
    if sk not in sys.path: sys.path.insert(0, sk)
    import engine
    blocks, _, _ = engine.compute({"name": "probe", "parts": parts})
    return max(y for (x, y, z) in blocks)

def win(sides, ats, storeys=(0,)):
    return {sd: ([{"at": a, "storey": i} for a in ats.get(sd, ()) for i in storeys]) for sd in sides}

def halt(region):
    """Halt: a 5 x 5 booking hut in the middle of the platform, its gable to the line and its door to the platform,
    a lean-to waiting canopy against each side, a back door to the Trade House step."""
    g = G(region)
    hut = R(-2, 4, 2, 8)
    h = hall(g, hut, [6], {"side": "s", "kind": "house", "steps": 0}, {"s": [], "n": [], "e": [], "w": []}, ridge="z")
    h["windows"] = {"s": [], "n": [], "e": [{"at": 0, "storey": 0}], "w": [{"at": 0, "storey": 0}]}
    return [h, canopy(g, R(-5, 4, -3, 7), "e", 6), canopy(g, R(3, 4, 5, 7), "w", 6),
            {"part": "door", "rect": hut, "side": "n", "at": 0, "floor": 0, "kind": "house", "canopy": False, "style": g["style"]["base"]}]

def g_door(region):
    return {"vale": "spruce_door", "frostmarch": "dark_oak_door", "saltreach": "birch_door", "emberwaste": "acacia_door", "blackfen": "mangrove_door"}[region]

def station(region):
    """Station: a booking hall along the platform with a gabled porch to the line (the door), a canopy either side of
    it on the hall wall, a stalls lean-to at the east end and a parcels lean-to at the west, a street door behind."""
    g = G(region)
    H = R(-7, 6, 7, 10); porch = R(-2, 3, 2, 5)
    roof = dict(g["roof"]); 
    wing = {"rect": porch, "storeys": [6]}
    if roof["type"] == "gable": wing["roof"] = dict(roof, ridge="z")
    elif roof["type"] == "hip": wing["roof"] = dict(roof)
    else: wing["roof"] = dict(roof)
    h = hall(g, H, [6], {"side": "n", "kind": "house", "steps": 0}, win("nsew", {"s": (-5, 5), "n": (-4, 4)}), wings=[wing])
    lean = dict(g["lean"])
    stalls = dict(canopy(g, R(8, 7, 10, 9), "w", 6), floor="coarse_dirt")
    parcels = dict(canopy(g, R(-10, 7, -8, 9), "e", 6), floor=None)
    return [h, canopy(g, R(-7, 3, -3, 5), "n", 6), canopy(g, R(3, 3, 7, 5), "n", 6), stalls, parcels,
            {"part": "door", "rect": porch, "side": "s", "at": 0, "floor": 0, "kind": "grand", "canopy": False, "style": g["style"]["base"]}]

def junction(region):
    """Junction: a two-storey hall (stone ground storey) with a clock tower on the middle of its platform front, the
    tower's foot the entrance, canopies either side on the hall wall, a stable wing and a parcels wing at the ends."""
    g = G(region)
    H = R(-8, 8, 8, 14); T = R(-2, 4, 2, 8)
    h = hall(g, H, [6, 5], {"side": "n", "kind": "house", "steps": 0}, win("nsew", {"s": (-6, 6), "n": (-5, 5)}, (0, 1)))
    wroof = dict(g["roof"]); 
    if wroof["type"] == "gable": wroof["ridge"] = "x"
    wings = []
    for rect, use, at in ((R(-14, 9, -8, 13), "stable", -1), (R(8, 9, 14, 13), "storage", 1)):
        w = hall(g, rect, [5], {"side": "n", "kind": "large" if use == "stable" else "house", "steps": 0, "at": at}, win("nsew", {"s": (-1,), "e": (0,), "w": (0,)}), interior=use)
        w["roof"] = wroof; w["storey_style"] = [g["ground"]] if g.get("ground") else [{}]
        if use == "stable": w["style"] = dict(w["style"], floor="coarse_dirt")
        wings.append(w)
    shell = [h] + wings
    tp, place = clock_tower(g, T, _top(shell) + 2, door={"side": "s", "kind": "grand", "steps": 0})
    parts = shell + tp + [canopy(g, R(-8, 3, -4, 7), "n", 7), canopy(g, R(4, 3, 8, 7), "n", 7)] + [
        {"part": "door", "rect": H, "side": "s", "at": 0, "floor": 0, "kind": "house", "canopy": False, "style": g["style"]["base"]}]
    return parts, place

def grand(region):
    """Grand Station: the Kingsrest base at full size. A long two-storey hall along the platform under the glass train
    shed (stations.py), the clock tower on the middle of the street front (its foot the street entrance, a 9 x 9
    clock stage), a stable wing and a parcels wing at the ends."""
    g = G(region)
    H = R(-11, 9, 11, 15); T = R(-3, 14, 3, 20)
    h = hall(g, H, [6, 5], {"side": "s", "kind": "grand", "steps": 0}, win("nsew", {"s": (-8, -4, 4, 8), "n": (-8, -5, 5, 8)}, (0, 1)))
    wroof = dict(g["roof"])
    if wroof["type"] == "gable": wroof["ridge"] = "x"
    wings = []
    for rect, use, sd in ((R(-21, 10, -11, 16), "stable", "n"), (R(11, 10, 21, 16), "storage", "s")):
        w = hall(g, rect, [6], {"side": sd, "kind": "large" if use == "stable" else "house", "steps": 0, "at": -1 if use == "stable" else 1},
                 win("nsew", {"s": (-3, 3), "n": (3,) if use == "stable" else (-3, 3), "e": (0,), "w": (0,)}), interior=use)
        w["roof"] = wroof; w["storey_style"] = [g["ground"]] if g.get("ground") else [{}]
        if use == "stable": w["style"] = dict(w["style"], floor="coarse_dirt")
        wings.append(w)
    shell = [h] + wings
    tp, place = clock_tower(g, T, _top(shell) + 2, stage_h=8, door={"side": "n", "kind": "grand", "steps": 0})
    parts = shell + tp + [
        {"part": "door", "rect": H, "side": "n", "at": 0, "floor": 0, "kind": "house", "canopy": False, "style": g["style"]["base"]}]
    return parts, place

STAGE_TITLE = {"halt": "Halt", "station": "Station", "junction": "Junction", "grand": "Grand Station"}
TIER = {"halt": "Hamlet", "station": "Town", "junction": "City", "grand": "Castle"}

def stage_spec(stage, region):
    got = {"halt": halt, "station": station, "junction": junction, "grand": grand}[stage](region)
    parts, place = got if isinstance(got, tuple) else (got, [])
    rname = {"vale": "Vale", "frostmarch": "Frostmarch", "saltreach": "Saltreach", "emberwaste": "Emberwaste", "blackfen": "Blackfen"}[region]
    return {"name": f"station_{stage}_{region}",
            "card": {"title": f"{rname} {STAGE_TITLE[stage]}", "sub": REG[region]["sub"], "region": region, "where": f"Every {rname} plot's railway, {TIER[stage]} tier",
                     "kind": "Station", "blurb": (globals()[stage].__doc__ or "").split("\n")[0] + " The building on the skill; stations.py lays the platform" +
                     (", the glass train shed" if stage == "grand" else "") + " and the marks."},
            "parts": parts, "place": place}

if __name__ == "__main__":
    import sys
    for region in REG:
        for stage in ("halt", "station", "junction", "grand"):
            json.dump(stage_spec(stage, region), open(os.path.join(HERE, f"station_{stage}_{region}.json"), "w"), indent=1)
    print("wrote station_<stage>_<region>.json")

    s = kingsrest(); json.dump(s, open(os.path.join(HERE, "kingsrest_station.json"), "w"), indent=1)
    print("wrote kingsrest_station.json")
