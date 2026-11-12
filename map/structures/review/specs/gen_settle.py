"""Write the settlement plot buildings as building-skill specs, one per building per region (settle_<id>_<region>.json).

    python3 gen_settle.py

Plot frame (settle_buildings.py): the front faces south (+z), the door is in the wall on z = 0 at x = 0, the
plinth course sits on the ground (y = 0). The Foundation Stone goes in front of everything (export_buildings.py
moves it out until it is clear). Sizes are odd, and each fits its plot with the roof: Medium 11 x 15, long Medium
13 x 15, Large 15 x 15. Every region keeps the Vale footprint of each building, so plot fits and charters hold.
Interiors stay empty except the stair; the inn is furnished (settle_skill.py, which also does what the skill has
no part for: Emberwaste's flat parapet roofs, Blackfen's mangrove stilts, Frostmarch's dragon-head gables).

How each region builds (build-instructions/palettes/<region>.md):
  vale        stripped-spruce frame on rubble, calcite infill, warm red or old slate roofs
  frostmarch  dark oak frame, spruce plank infill on a cobbled-deepslate plinth, steep slate roofs, dragon heads
  saltreach   pale sandstone ground storey, whitewash between birch frames, low hipped sea-green roofs
  emberwaste  thick sandstone walls, small windows, flat roofs with a parapet and roof beams
  blackfen    mangrove frame and mud brick lifted on mangrove stilts, dark shingle roofs
"""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))

def noise(*blocks, scale=3): return {"ladder": list(blocks), "axis": "noise", "scale": scale}
SLATE = noise("deepslate_tiles", "cobbled_deepslate", scale=2)
WARM = "brick_block"
FARM = noise("mud_bricks", "brick_block", scale=2)   # two warm browns, mixed

# Per region: timber-house style, stone ground-storey style (storey_style), stone-building style (the mint),
# and the roofs [house, townhouse, farmhouse, mint, inn].
R = {
    "vale": dict(
        timber={"base": "vale_timber", "frame": "stripped_spruce_log"},
        ground={"frame_kind": "stone", "frame": "stone_bricks", "infill": {"ladder": "VAL-01", "axis": "y"}},
        stone={"base": "vale_stone"}, farm={"base": "vale_brick"},
        roofs=[WARM, SLATE, FARM, SLATE, WARM], lean="mud_bricks", kind="gable"),
    "frostmarch": dict(
        timber={"base": "vale_timber", "frame": "dark_oak_log", "infill": "spruce_planks",
                "plinth": noise("cobbled_deepslate", "deepslate_bricks"), "trim": "dark_oak_planks", "shutter": "dark_oak_planks",
                "door": "dark_oak_door", "glass": "glass_pane", "chimney": "deepslate_bricks", "quoin": "polished_deepslate", "sill": "stair",
                "leaves": "spruce_leaves", "sign_wood": "dark_oak"},
        ground={"frame_kind": "stone", "frame": "deepslate_bricks", "infill": noise("cobbled_deepslate", "polished_deepslate")},
        stone={"base": "vale_stone", "frame": "deepslate_bricks", "infill": noise("polished_deepslate", "deepslate_bricks"),
               "plinth": noise("cobbled_deepslate", "deepslate_bricks"), "quoin": "polished_deepslate", "chimney": "deepslate_bricks",
               "door": "dark_oak_door", "shutter": "dark_oak_planks", "glass": "glass_pane"},
        farm=None, roofs=[SLATE, noise("deepslate_tiles", "deepslate_bricks", scale=2), SLATE, SLATE, SLATE],
        lean="deepslate_tiles", kind="gable"),
    "saltreach": dict(
        timber={"base": "vale_timber", "frame": "stripped_birch_log", "infill": "calcite", "plinth": noise("cobblestone", "andesite", "stone_bricks"),
                "trim": "birch_planks", "shutter": "warped_planks", "door": "birch_door", "glass": "glass_pane", "chimney": "brick_block",
                "quoin": "cut_sandstone", "floor": "birch_planks", "sill": "stair", "sign_wood": "birch"},
        ground={"frame_kind": "stone", "frame": "cut_sandstone", "infill": noise("smooth_sandstone", "sandstone", scale=2)},
        stone={"base": "vale_stone", "frame": "cut_sandstone", "infill": noise("smooth_sandstone", "sandstone", scale=2),
               "plinth": noise("cobblestone", "andesite", "stone_bricks"), "quoin": "cut_sandstone", "chimney": "brick_block",
               "door": "birch_door", "shutter": "warped_planks", "glass": "glass_pane", "trim": "birch_planks"},
        farm=None, roofs=["dark_prismarine", "dark_prismarine", "red_sandstone", "dark_prismarine", "dark_prismarine"],
        lean="red_sandstone", kind="hip"),
    "emberwaste": dict(
        timber={"base": "vale_stone", "frame": "cut_sandstone", "infill": noise("smooth_sandstone", "sandstone", scale=2),
                "plinth": noise("sandstone", "cut_sandstone"), "trim": "acacia_planks", "shutter": "acacia_planks", "door": "acacia_door",
                "glass": "glass_pane", "chimney": "sandstone", "quoin": "chiseled_sandstone", "floor": "acacia_planks", "sign_wood": "acacia"},
        ground={},
        stone={"base": "vale_stone", "frame": "cut_red_sandstone", "infill": noise("smooth_red_sandstone", "red_sandstone", scale=2),
               "plinth": noise("sandstone", "cut_sandstone"), "quoin": "chiseled_sandstone", "trim": "acacia_planks", "shutter": "acacia_planks",
               "door": "acacia_door", "glass": "glass_pane", "floor": "acacia_planks"},
        farm=None, roofs=["smooth_sandstone"] * 5, lean="acacia_planks", kind="flat"),
    "blackfen": dict(
        timber={"base": "vale_timber", "frame": "mangrove_log", "infill": noise("mud_bricks", "packed_mud", scale=2),
                "plinth": noise("mud_bricks", "tuff"), "trim": "spruce_planks", "shutter": "spruce_planks", "door": "mangrove_door",
                "glass": "glass_pane", "chimney": "mud_bricks", "quoin": "tuff_bricks", "floor": "dark_oak_planks",
                "leaves": "mangrove_leaves", "sign_wood": "mangrove"},
        ground={"frame_kind": "stone", "frame": "tuff_bricks", "infill": noise("mud_bricks", "packed_mud", scale=2)},
        stone={"base": "vale_stone", "frame": "tuff_bricks", "infill": noise("tuff", "tuff_bricks", scale=2), "plinth": noise("mud_bricks", "tuff"),
               "quoin": "polished_tuff", "chimney": "mud_bricks", "door": "mangrove_door", "shutter": "mangrove_planks", "glass": "glass_pane",
               "floor": "dark_oak_planks"},
        farm=None, roofs=["dark_oak_planks", "mud_bricks", "mangrove_planks", "dark_oak_planks", "dark_oak_planks"],
        lean="mangrove_planks", kind="gable"),
}
NAMES = {"vale": "Vale", "frostmarch": "Frostmarch", "saltreach": "Saltreach", "emberwaste": "Emberwaste", "blackfen": "Blackfen"}

def card(region, title, sub, plot, blurb, kind="House"):
    return {"title": title, "sub": f"{NAMES[region]}, {sub}", "region": region, "where": f"Settlement plot ({plot})", "kind": kind, "blurb": blurb}

def roof(region, ridge, pitch=1):
    k = R[region]["kind"]
    if k == "gable": return {"type": "gable", "ridge": ridge, "pitch": pitch}
    return {"type": "hip", "pitch": 1}      # flat roofs start as a hip; settle_skill takes it off and lays the parapet roof

def specs(region):
    g = R[region]; flat = g["kind"] == "flat"; gable = g["kind"] == "gable"
    st = lambda base, i: dict(base, roof=g["roofs"][i])
    dorm = (lambda *d: list(d)) if gable else (lambda *d: [])
    chim = (lambda c: c) if not flat else (lambda c: False)
    extra = [5] if flat else []          # flat roofs have no attic: they get a low top storey instead
    house = {
        "card": card(region, "House", "one storey and an attic" if not flat else "two storeys and a roof terrace", "Medium 11 x 15",
                     "A home of about four beds: one storey on a plinth and a room under the roof, a chimney."),
        "after": "settle_skill:house_inside",
        "parts": [{"part": "house", "style": st(g["timber"], 0), "rect": [-4, -10, 4, 0], "y": 0, "plinth": 2,
                   "storeys": [5] + extra, "door": {"side": "s", "kind": "house", "steps": 1}, "roof": roof(region, "z"),
                   "dormers": dorm({"side": "e", "at": 1, "w": 3, "h": 3}, {"side": "w", "at": -1, "w": 3, "h": 3}),
                   "chimney": chim([[-2, -8]]), "vines": 0.04 if region in ("vale", "blackfen") else 0}],
    }
    town = {
        "card": card(region, "Townhouse", "taller", "long Medium 13 x 15 or Large",
                     "A taller home of about six beds: a stone ground floor, a floor above jettied over the road, a high attic."),
        "after": "settle_skill:townhouse_inside",
        "parts": [{"part": "house", "style": st(g["timber"], 1), "rect": [-5, -10, 5, 0], "y": 0, "plinth": 2,
                   "storeys": [5, 5] + extra, "jetty": [] if flat else ["s"], "storey_style": [g["ground"], {}] + ([{}] if flat else []),
                   "door": {"side": "s", "kind": "house", "steps": 1}, "roof": roof(region, "z"),
                   "dormers": dorm({"side": "e", "at": 1, "w": 3, "h": 3}, {"side": "w", "at": -1, "w": 3, "h": 3}),
                   "chimney": chim([[3, -8]]), "vines": 0.03 if region in ("vale", "blackfen") else 0}],
    }
    farm = {
        "card": card(region, "Farmhouse", "by the fields", "Medium 11 x 15",
                     "A long low farmhouse with an open lean-to behind for hay, a cart and the woodpile.", kind="Work"),
        "after": "settle_skill:farmhouse_inside",
        "parts": [
            {"part": "house", "style": st(g["farm"] or g["timber"], 2), "rect": [-4, -8, 4, 0], "y": 0, "plinth": 2,
             "storeys": [5] + extra, "door": {"side": "s", "kind": "house", "steps": 1}, "roof": roof(region, "z"),
             "dormers": dorm({"side": "w", "at": 0, "w": 3, "h": 3}), "chimney": chim([[2, -6]]),
             "vines": 0.06 if region in ("vale", "blackfen") else 0},
            {"part": "lean_to", "rect": [-3, -11, 3, -9], "against": "s", "top": 5, "pitch": "half", "y": 0,
             "roof": g["lean"], "post": g["timber"].get("frame", "stripped_spruce_log") if not flat else "stripped_acacia_log",
             "trim": "dark_oak_planks", "floor": "coarse_dirt"},
            {"part": "woodpile", "at": [2, 1, -11], "len": 2, "h": 2, "facing": "n", "wood": "spruce_log", "cover": "none"},
        ],
    }
    mint = {
        "card": card(region, "Mint", "stone", "Medium 11 x 15",
                     "Where the town strikes its Regals: stone walls, barred ground-floor windows and a heavy door.", kind="Work"),
        "after": "settle_skill:mint_inside",
        "parts": [{"part": "house", "style": st(g["stone"], 3), "rect": [-4, -10, 4, 0], "y": 0, "plinth": 2,
                   "storeys": [5, 4], "door": {"side": "s", "kind": "grand", "steps": 1},
                   "roof": {"type": "hip", "pitch": 1}, "chimney": chim([[2, -8]]), "shutters": 0}],
    }
    inn = {
        "card": card(region, "Inn", "furnished", "Large 15 x 15",
                     "Eaves to the road, a stone tap room with the bar, tables and a hearth, three bedrooms above.", kind="Work"),
        "after": "settle_skill:inn_inside",
        "parts": [{"part": "house", "style": st(g["timber"], 4), "rect": [-6, -10, 6, 0], "y": 0, "plinth": 2,
                   "storeys": [5, 5], "jetty": [] if flat else ["s"], "storey_style": [g["ground"], {}],
                   "door": {"side": "s", "kind": "house", "steps": 1}, "roof": roof(region, "x"),
                   "dormers": dorm({"side": "s", "at": -4, "w": 3, "h": 3}, {"side": "s", "at": 4, "w": 3, "h": 3}, {"side": "n", "at": 0, "w": 3, "h": 3}),
                   "chimney": chim([[-6, -6], [6, -6]]), "vines": 0.03 if region in ("vale", "blackfen") else 0}],
    }
    return {"house": house, "townhouse": town, "farmhouse": farm, "mint": mint, "inn": inn}

if __name__ == "__main__":
    for region in R:
        for k, s in specs(region).items():
            s = dict(s, name=f"settle_{k}_{region}")
            open(os.path.join(HERE, f"settle_{k}_{region}.json"), "w").write(json.dumps(s, indent=1))
    print("wrote", 5 * len(R), "specs")
