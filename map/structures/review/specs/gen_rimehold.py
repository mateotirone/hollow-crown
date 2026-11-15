"""Writes the Rimehold (Frostmarch) civic specs on the skill: the longhouse hall and the stave chapel.

Built to regions/frostmarch.md and build-instructions/towers/README.md (Frostmarch row: dark stone base, dark oak
stave, tiered stages each with its own shingle skirt one out, a steep slate spire, snow on every ledge).
Door on the +z side ("s"), as the town generator expects for civic buildings.
"""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))

SHINGLE = {"ladder": ["dark_oak_planks", "spruce_planks"], "axis": "noise", "scale": 2}
COPPER = {"ladder": ["waxed_weathered_cut_copper", "waxed_oxidized_cut_copper"], "axis": "noise", "scale": 2}
SLATE = {"ladder": ["deepslate_tiles", "cobbled_deepslate"], "axis": "noise", "scale": 2}

def skirt(rect, top, roof, y=0, sides="nsew", depth=2):
    """A gallery skirt roof all round a hall on posts (frostmarch.md): four lean-tos, n and s full width."""
    x0, z0, x1, z1 = rect; out = []
    for sd in sides:
        if sd == "s": r = [x0 - depth, z1 + 1, x1 + depth, z1 + depth]
        elif sd == "n": r = [x0 - depth, z0 - depth, x1 + depth, z0 - 1]
        elif sd == "e": r = [x1 + 1, z0, x1 + depth, z1]
        else: r = [x0 - depth, z0, x0 - 1, z1]
        against = {"s": "n", "n": "s", "e": "w", "w": "e"}[sd]
        out.append({"part": "lean_to", "rect": r, "against": against, "top": top, "pitch": 1, "y": y,
                    "roof": roof, "post": "dark_oak_log", "trim": "dark_oak_planks", "floor": "cobbled_deepslate"})
    return out

# ---------------- the longhouse hall: stone course and plank rows in a dark frame, a steep weathered copper roof,
# a gallery skirt roof round it on posts, crossed dragon heads on both gables, a ridge lantern tower.
H = [0, 0, 8, 12]
hall = {"name": "rimehold_hall",
        "card": {"title": "Rimehold longhouse hall", "sub": "Norse stave and stone", "region": "frostmarch", "where": "Rimehold, the square", "kind": "Civic",
                 "blurb": "A longhouse on a dark stone course, plank rows in a dark oak frame, a steep weathered copper roof with dragon heads on both gables, a shingle gallery skirt all round on posts and a lantern on the ridge. Built on the skill."},
        "parts": [
            {"part": "house", "style": {"base": "frost_timber", "glass": "light_blue_stained_glass_pane", "roof": COPPER, "trim": "dark_oak_planks"},
             "rect": H, "y": 0, "plinth": 2, "storeys": [4, 5],
             "storey_style": [{"frame_kind": "stone", "frame": "deepslate_bricks", "infill": {"ladder": "FRO-01", "axis": "y"}}, {}],
             "door": {"side": "s", "kind": "grand", "steps": 1},
             "windows": {"e": [{"at": a, "storey": 1} for a in (-3, 0, 3)], "w": [{"at": a, "storey": 1} for a in (-3, 0, 3)],
                         "n": [{"at": 0, "storey": 1, "h": 3}], "s": [{"at": -2, "storey": 1}, {"at": 2, "storey": 1}]},
             "shutters": 0, "roof": {"type": "gable", "ridge": "z", "pitch": 2, "gable_horns": True, "snow": True},
             "chimney": [[7, 3]], "vines": 0, "interior": {"use": "hall", "entry": "s"}},
            {"part": "belfry", "rect": [3, 6, 5, 8], "y": "roof", "h": 3, "pier": "dark_oak_log", "deck": "dark_oak_planks", "trim": "dark_oak_planks",
             "roof": COPPER, "cap": "spire", "rows": 2, "finial": "rod", "bell": False},
        ] + skirt(H, 6, SHINGLE)}
json.dump(hall, open(os.path.join(HERE, "rimehold_hall.json"), "w"), indent=1)

# ---------------- the stave chapel: a tall narrow nave and a lower apse, a skirt roof all round on posts, a stave
# tower rising through the nave roof in stages, each with a shingle skirt one out, then a louvred belfry and a steep
# slate spire; dragon heads on every gable peak, cyan, blue and white glass.
N = [0, 4, 8, 14]                                   # the nave; the apse is at the -z end, the door at +z
T = [2, 7, 6, 11]                                   # the stave tower over the middle of the nave
TY = 10                                             # the tower's floor, in the nave's roof space
chapel = {"name": "rimehold_chapel",
          "card": {"title": "Rimehold stave chapel", "sub": "Norse stave", "region": "frostmarch", "where": "Rimehold", "kind": "Civic",
                   "blurb": "A tall stave nave and a lower apse under steep shingle with dragon heads on every gable, a gallery skirt all round, and a stave tower climbing out of the roof in stages to a louvred belfry and a steep slate spire. Built on the skill."},
          "parts": [
              {"part": "house", "style": {"base": "frost_timber", "glass": "cyan_stained_glass_pane", "roof": SHINGLE},
               "rect": N, "y": 0, "plinth": 2, "storeys": [8],
               "storey_style": [{"infill": "spruce_planks"}],
               "door": {"side": "s", "kind": "grand", "steps": 1},
               "windows": {"e": [{"at": a, "storey": 0, "w": 1, "h": 3} for a in (-3, 0, 3)],
                           "w": [{"at": a, "storey": 0, "w": 1, "h": 3} for a in (-3, 0, 3)], "n": [], "s": [{"at": 0, "storey": 0, "w": 1, "h": 2, "y": 5}]},
               "shutters": 0, "roof": {"type": "gable", "ridge": "z", "pitch": 2, "gable_horns": True, "snow": True},
               "wings": [{"rect": [2, 0, 6, 3], "storeys": [6], "roof": {"type": "gable", "ridge": "z", "pitch": 2, "gable_horns": True, "snow": True}}],
               "chimney": False, "vines": 0, "bushes": False, "interior": {"use": "chapel", "entry": "s"}},
              {"part": "house", "style": {"base": "frost_timber", "glass": "white_stained_glass_pane", "roof": SHINGLE},
               "rect": T, "y": TY, "plinth": 1, "storeys": [14], "door": None,
               "windows": {sd: [{"at": 0, "storey": 0, "w": 1, "h": 2, "y": TY + 10}] for sd in "nsew"},
               "shutters": 0, "roof": {"type": "flat"}, "chimney": False, "vines": 0, "bushes": False, "interior": False},
              {"part": "belfry", "rect": T, "y": "top", "h": 4, "pier": "dark_oak_log", "deck": "dark_oak_planks", "trim": "dark_oak_planks",
               "louvres": False, "bell": True, "roof": SLATE, "cap": "spire", "rows": 3, "overhang": 1, "finial": "spire_block", "cap_trim": "dark_oak_planks"},
          ] + skirt(N, 6, SHINGLE, sides="sew")
            + skirt(T, TY + 9, SHINGLE, y=TY + 7, depth=1)}
json.dump(chapel, open(os.path.join(HERE, "rimehold_chapel.json"), "w"), indent=1)
print("wrote rimehold_hall.json, rimehold_chapel.json")

# ---------------- the town set (frostmarch.md: stone ground storey, plank upper storey, steep roofs; the smithy has a
# big chimney and an open workshop). Roofs pitch 2 with dragon heads and snow; woodpiles under the eaves.
GROUND = {"frame_kind": "stone", "frame": "deepslate_bricks", "infill": {"ladder": "FRO-01", "axis": "y"}}
def frost_hall(name, title, blurb, rect, storeys, ridge, door_at, windows, chimney, extra=(), interior="home", roof=SHINGLE):
    return {"name": name, "card": {"title": title, "sub": "Norse timber and stone", "region": "frostmarch", "where": "Rimehold", "kind": "Civic", "blurb": blurb},
            "parts": [{"part": "house", "style": {"base": "frost_timber", "roof": roof}, "rect": rect, "y": 0, "plinth": 2, "storeys": storeys,
                       "storey_style": [GROUND] + [{}] * (len(storeys) - 1), "door": {"side": "s", "at": door_at, "kind": "house", "steps": 1},
                       "windows": windows, "shutters": 0, "roof": {"type": "gable", "ridge": ridge, "pitch": 2, "gable_horns": True, "snow": True},
                       "chimney": chimney, "vines": 0, "interior": interior}] + list(extra)}

inn = frost_hall("rimehold_inn", "Rimehold inn", "A long two-storey inn: dark stone tap room below, plank rooms above, a steep shingle roof with dragon heads at both gables and a woodpile by the door. Built on the skill.",
                 [0, 0, 14, 8], [5, 4], "x", 0,
                 {"s": [{"at": a, "storey": 0} for a in (-5, -2, 2, 5)] + [{"at": a, "storey": 1} for a in (-5, -2, 2, 5)],
                  "n": [{"at": a, "storey": 1} for a in (-5, 0, 5)], "e": [{"at": 0, "storey": 1}], "w": [{"at": 0, "storey": 1}]},
                 [[2, 4], [12, 4]], [{"part": "woodpile", "at": [15, 1, 2], "len": 3, "h": 2, "facing": "e", "wood": "spruce"}], interior="inn")
smithy = frost_hall("rimehold_smithy", "Rimehold smithy", "A stone forge house with a big deepslate chimney and an open workshop under a lean-to on posts, where the anvil and quench barrel stand. Built on the skill.",
                    [0, 0, 8, 8], [5], "z", 0, {"s": [{"at": -2, "storey": 0}, {"at": 2, "storey": 0}], "w": [{"at": 0, "storey": 0}], "n": [], "e": []},
                    [[6, 4]], [{"part": "lean_to", "rect": [9, 1, 12, 7], "against": "w", "top": 6, "pitch": "half", "y": 0, "roof": SHINGLE,
                                "post": "dark_oak_log", "trim": "dark_oak_planks", "floor": "cobbled_deepslate"}], interior="smithy")
smithy["place"] = [[10, 1, 3, "anvil", {"facing": "n"}], [11, 1, 6, "cauldron"], [10, 1, 6, "barrel", {"facing": "up"}], [9, 1, 2, "grindstone", {"facing": "n"}]]
store = frost_hall("rimehold_store", "Rimehold store", "A tall narrow store: stone ground storey with the shop, plank loft above under a steep roof with dragon heads, barrels and a woodpile at the side. Built on the skill.",
                   [0, 0, 8, 10], [5, 4], "z", 0, {"s": [{"at": -2, "storey": 0}, {"at": 2, "storey": 0}, {"at": 0, "storey": 1}], "e": [{"at": -2, "storey": 1}, {"at": 2, "storey": 1}],
                                                  "w": [{"at": 0, "storey": 0}, {"at": 0, "storey": 1}], "n": [{"at": 0, "storey": 1}]},
                   [[1, 6]], [{"part": "woodpile", "at": [9, 1, 7], "len": 3, "h": 2, "facing": "e", "wood": "spruce"}], interior="shop")
store["place"] = [[-1, 1, 9, "barrel", {"facing": "up"}], [-1, 1, 8, "barrel", {"facing": "up"}], [-1, 2, 9, "barrel", {"facing": "up"}]]
barn = {"name": "rimehold_barn", "card": {"title": "Rimehold byre", "sub": "Norse stone and timber", "region": "frostmarch", "where": "Rimehold, the edges", "kind": "Barn",
        "blurb": "A low byre: dark stone walls, plank rows above, a very steep roof coming down low, big cart doors in the gable and hay inside. Built on the skill."},
        "parts": [{"part": "house", "style": {"base": "frost_timber", "roof": SHINGLE, "floor": "coarse_dirt"}, "rect": [0, 0, 10, 12], "y": 0, "plinth": 1, "storeys": [5],
                   "storey_style": [GROUND], "door": {"side": "s", "kind": "large", "steps": 0}, "windows": {"e": [{"at": -3, "storey": 0}, {"at": 3, "storey": 0}], "w": [], "n": [], "s": []},
                   "shutters": 0, "roof": {"type": "gable", "ridge": "z", "pitch": 2, "gable_horns": True, "snow": True}, "chimney": False, "vines": 0, "interior": "storage"},
                  {"part": "woodpile", "at": [-1, 1, 3], "len": 3, "h": 2, "facing": "w", "wood": "spruce"}]}
for n, spec in (("inn", inn), ("smithy", smithy), ("store", store), ("barn", barn)):
    json.dump(spec, open(os.path.join(HERE, f"rimehold_{n}.json"), "w"), indent=1)
print("wrote rimehold_inn/smithy/store/barn.json")
