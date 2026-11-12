"""Write the Barracks as building-skill specs, one per region (barracks_<region>.json).

    python3 gen_barracks.py

From Mateo's reference (2026-11-12, "Greenhills Barracks"): a timber hall on a stone ground storey, a tall
round keep with machicolated battlements and flags joined to the hall's gable, and a walled yard in front
with square corner turrets, an outside stair up to the keep and a banner over the gate. The yard is where
off-duty soldiers wait (Mateo 2026-11-12); the sieges thread reads its corners and muster spot from the
marks barracks_skill.py adds (yard_a, yard_b, muster, banner).

Frame (settle_buildings.py): front faces south (+z), the yard's front wall on z = 0, the Barracks block just
outside the gate at (0, 1, 1). Everything fits a Large plot (15 x 15): x -7..7, z -14..0. Each region starts
from its preset (skill regions/<region>.md); the keep follows the castle row of build-instructions/towers.
"""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))

def noise(*blocks, scale=3): return {"ladder": list(blocks), "axis": "noise", "scale": scale}
SLATE = noise("deepslate_tiles", "cobbled_deepslate", scale=2)

# per region: hall style, stone ground storey, roof, the keep's and the yard wall's stone, trim (courses, corbels),
# keep height (one stage clear of the hall ridge: towers/README section 2), yard ground
R = {
    "vale": dict(
        hall={"base": "vale_timber", "frame": "stripped_spruce_log"},
        ground={"frame_kind": "stone", "frame": "stone_bricks", "infill": {"ladder": "VAL-01", "axis": "y"}},
        roof={"type": "gable", "ridge": "x", "pitch": 1}, roof_mat="polished_granite",
        stone={"ladder": "VAL-01", "axis": "y"}, plinth=noise("mossy_cobblestone", "cobblestone", "andesite"),
        trim="stone_bricks", h=20, ground_mix=noise("coarse_dirt", "gravel", "coarse_dirt", scale=2)),
    "frostmarch": dict(
        hall={"base": "frost_timber"},
        ground={"frame_kind": "stone", "frame": "deepslate_bricks", "infill": noise("cobbled_deepslate", "polished_deepslate")},
        roof={"type": "gable", "ridge": "x", "pitch": 2, "gable_horns": True, "snow": True}, roof_mat=SLATE,
        stone=noise("cobbled_deepslate", "deepslate_bricks"), plinth={"ladder": "FRO-01", "axis": "noise", "scale": 3},
        trim="polished_deepslate", h=25, ground_mix=noise("gravel", "coarse_dirt", scale=2)),
    "saltreach": dict(
        hall={"base": "salt_timber"},
        ground={"frame_kind": "stone", "frame": "cut_sandstone", "infill": noise("smooth_sandstone", "sandstone", scale=2)},
        roof={"type": "hip", "pitch": 1}, roof_mat="dark_prismarine",
        stone=noise("smooth_sandstone", "sandstone", scale=2), plinth={"ladder": "SAL-05", "axis": "noise", "scale": 3},
        trim="cut_sandstone", h=20, ground_mix=noise("gravel", "coarse_dirt", scale=2)),
    "emberwaste": dict(
        hall={"base": "ember_sandstone", "frame": "cut_red_sandstone", "infill": noise("smooth_red_sandstone", "red_sandstone", scale=2)},
        ground={}, roof={"type": "flat", "parapet": "slab", "beams": True}, roof_mat="smooth_sandstone",
        stone=noise("smooth_sandstone", "sandstone", scale=2), plinth={"block": "sandstone"},
        trim="cut_sandstone", h=20, ground_mix=noise("coarse_dirt", "packed_mud", scale=2)),
    "blackfen": dict(
        hall={"base": "fen_timber"},
        ground={"frame_kind": "stone", "frame": "tuff_bricks", "infill": noise("mud_bricks", "packed_mud", scale=2)},
        roof={"type": "gable", "ridge": "x", "pitch": 1, "moss": True}, roof_mat="dark_oak_planks",
        stone=noise("tuff", "tuff_bricks", scale=2), plinth=noise("mud_bricks", "tuff"),
        trim="polished_tuff", h=20, ground_mix=noise("mud", "coarse_dirt", "packed_mud", scale=2)),
}
NAMES = {"vale": "Vale", "frostmarch": "Frostmarch", "saltreach": "Saltreach", "emberwaste": "Emberwaste", "blackfen": "Blackfen"}

HALL = [-6, -13, 2, -7]          # 9 x 7, the hall along the back left
KEEP = [4, -10]                  # r 2.5 (5 wide) behind the yard's right side, its west wall in the hall's gable
FLAT = lambda region: R[region]["roof"]["type"] == "flat"

def spec(region):
    g = R[region]; flat = FLAT(region)
    pil = {"piles": True} if region == "blackfen" else {}
    hall = {"part": "house", "style": dict(g["hall"], roof=g["roof_mat"]), "rect": HALL, "y": 0, "plinth": 2, **pil,
            "storeys": [5, 5] if flat else [5, 4], "storey_style": [g["ground"], {}],
            "door": {"side": "s", "kind": "house", "steps": 1}, "roof": g["roof"],
            "dormers": [] if flat or g["roof"]["type"] != "gable" else [{"side": "s", "at": -2, "w": 3, "h": 2}],
            "chimney": False if flat else [[-4, -11]], "shutters": 0 if region == "frostmarch" else 0.3,
            "vines": 0.04 if region in ("vale", "blackfen") else 0}
    keep = {"part": "keep", "at": KEEP, "r": 2.5, "y": 0, "h": g["h"] + (5 if flat else 0),
            "floors": [5, 10, 15] + ([20] if g["h"] >= 25 or flat else []),
            "material": "keepwall", "plinth": "keepplinth", "trim": g["trim"], "floor": "spruce_planks",
            "slits": {"sides": "ns", "glass": "gray_stained_glass_pane"},
            "doors": [{"side": "w", "floor": 0}, {"side": "s", "floor": 1}], "ladder": "e",
            "flags": [{"at": [1, -1], "dir": "w"}, {"at": [-1, 1], "dir": "w", "h": 3}], "flag": "white_wool"}
    yard = {"part": "curtain", "path": [[-7, -7], [-7, 0], [7, 0], [7, -9]], "y": 0, "h": 4,
            "material": "yardwall", "plinth": "keepplinth", "cap": g["trim"],
            "turrets": [{"at": [-6, -1], "size": 3, "h": 7}, {"at": [6, -1], "size": 3, "h": 7}],
            "gate": {"at": [0, 0], "face": "s", "w": 3, "h": 3, "crown": 4, "banner": "white_wool",
                     "trim": g["hall"].get("trim", "spruce_planks") if isinstance(g["hall"].get("trim"), str) else "spruce_planks"}}
    return {
        "name": f"barracks_{region}",
        "card": {"title": "Barracks", "sub": f"{NAMES[region]}, hall, keep and yard", "region": region,
                 "where": "Settlement plot (Large 15 x 15), raised by the Barracks block", "kind": "Work",
                 "blurb": "The guard's hall with bunks above a mess, a round keep with a stair up from the yard, "
                          "and a walled yard where off-duty soldiers wait. A banner hangs over the gate, ready to take the settlement colour."},
        "materials": {"keepwall": g["stone"], "yardwall": g["stone"], "keepplinth": g["plinth"]},
        "after": "barracks_skill:inside", "yard_ground": g["ground_mix"],
        "parts": [hall, yard, keep],
    }

if __name__ == "__main__":
    for region in R:
        open(os.path.join(HERE, f"barracks_{region}.json"), "w").write(json.dumps(spec(region), indent=1))
    print("wrote", len(R), "specs")
