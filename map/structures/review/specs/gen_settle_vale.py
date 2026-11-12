"""Write the Vale settlement plot buildings as building-skill specs (settle_<id>_vale.json).

    python3 gen_settle_vale.py

Plot frame (settle_buildings.py): the front faces south (+z), the door is in the wall on z = 0 at x = 0, the
plinth course sits on the ground (y = 0) and the ground floor is one up (plinth 2, one step at the door).
The Foundation Stone goes in front of everything (export_buildings.py moves it out until it is clear).
Sizes are odd, and each fits its plot with the roof: Medium 11 x 15, long Medium 13 x 15, Large 15 x 15.
Interiors stay empty except the stair; the inn is furnished (settle_skill.py).
"""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))

TIMBER = {"base": "vale_timber", "frame": "stripped_spruce_log"}
STONE_GROUND = {"frame_kind": "stone", "frame": "stone_bricks", "infill": {"ladder": "VAL-01", "axis": "y"}}
SLATE = {"ladder": ["deepslate_tiles", "cobbled_deepslate"], "axis": "noise", "scale": 2}
WARM = "brick_block"
FARM = {"ladder": ["mud_bricks", "brick_block"], "axis": "noise", "scale": 2}   # two warm browns, mixed

def card(title, sub, plot, blurb, kind="House"):
    return {"title": title, "sub": sub, "region": "vale", "where": f"Settlement plot ({plot})", "kind": kind, "blurb": blurb}

SPECS = {
    # ---- House: a Medium plot. One storey and a tall attic under a steep gable to the road, dormers both sides.
    "house": {
        "card": card("House", "Vale, warm red roof", "Medium 11 x 15",
                     "One storey on a rubble plinth and a tall attic, gable end to the road, a dormer each side, a chimney. About four beds."),
        "after": "settle_skill:house_inside",
        "parts": [{
            "part": "house", "style": dict(TIMBER, roof=WARM), "rect": [-4, -10, 4, 0], "y": 0, "plinth": 2,
            "storeys": [5], "door": {"side": "s", "kind": "house", "steps": 1},
            "roof": {"type": "gable", "ridge": "z", "pitch": 1},
            "dormers": [{"side": "e", "at": 1, "w": 3, "h": 3}, {"side": "w", "at": -1, "w": 3, "h": 3}],
            "chimney": [[-2, -8]], "vines": 0.04,
        }],
    },
    # ---- Townhouse: a long Medium or Large plot. Taller: stone ground floor, jettied timber floor over the street, attic.
    "townhouse": {
        "card": card("Townhouse", "Vale, old slate roof", "long Medium 13 x 15 or Large",
                     "Stone ground floor, a jettied stripped-spruce floor over the road, a high attic with dormers. About six beds."),
        "after": "settle_skill:townhouse_inside",
        "parts": [{
            "part": "house", "style": dict(TIMBER, roof=SLATE), "rect": [-5, -10, 5, 0], "y": 0, "plinth": 2,
            "storeys": [5, 5], "jetty": ["s"], "storey_style": [STONE_GROUND, {}],
            "door": {"side": "s", "kind": "house", "steps": 1},
            "roof": {"type": "gable", "ridge": "z", "pitch": 1},
            "dormers": [{"side": "e", "at": 1, "w": 3, "h": 3}, {"side": "w", "at": -1, "w": 3, "h": 3}],
            "chimney": [[3, -8]], "vines": 0.03,
        }],
    },
    # ---- Farmhouse: a Medium plot by the fields. Brick-nogged frame, a plank roof, an open cart shed behind with hay.
    "farmhouse": {
        "card": card("Farmhouse", "Vale, by the fields", "Medium 11 x 15",
                     "A long low farmhouse in brick-nogged spruce frame with a warm mud-brick roof, and an open lean-to behind for hay, a cart and the woodpile.",
                     kind="Work"),
        "after": "settle_skill:farmhouse_inside",
        "parts": [
            {"part": "house", "style": {"base": "vale_brick", "roof": FARM}, "rect": [-4, -8, 4, 0], "y": 0, "plinth": 2,
             "storeys": [5], "door": {"side": "s", "kind": "house", "steps": 1},
             "roof": {"type": "gable", "ridge": "z", "pitch": 1},
             "dormers": [{"side": "w", "at": 0, "w": 3, "h": 3}],
             "chimney": [[2, -6]], "vines": 0.06},
            {"part": "lean_to", "rect": [-3, -11, 3, -9], "against": "s", "top": 5, "pitch": "half", "y": 0,
             "roof": "mud_bricks", "post": "stripped_spruce_log", "trim": "dark_oak_planks", "floor": "coarse_dirt"},
            {"part": "woodpile", "at": [2, 1, -11], "len": 2, "h": 2, "facing": "n", "wood": "spruce_log", "cover": "none"},
        ],
    },
    # ---- Mint: a Medium plot. A strong stone house, two storeys, slate roof, barred ground windows, a grand door.
    "mint": {
        "card": card("Mint", "Vale, stone and slate", "Medium 11 x 15",
                     "Where the town strikes its Regals: ashlar walls, barred ground-floor windows, a heavy door and a hipped slate roof.",
                     kind="Work"),
        "after": "settle_skill:mint_inside",
        "parts": [{
            "part": "house", "style": {"base": "vale_stone", "roof": SLATE}, "rect": [-4, -10, 4, 0], "y": 0, "plinth": 2,
            "storeys": [5, 4], "door": {"side": "s", "kind": "grand", "steps": 1},
            "roof": {"type": "hip", "pitch": 1}, "chimney": [[2, -8]], "shutters": 0,
        }],
    },
    # ---- Inn: a Large plot, furnished. Eaves to the road, jettied upper floor, three dormers, tap room and bedrooms.
    "inn": {
        "card": card("Inn", "Vale, warm red roof", "Large 15 x 15",
                     "Eaves to the road, a stone tap room with the bar, tables and a hearth, a jettied floor of three bedrooms above, a sign over the door.",
                     kind="Work"),
        "after": "settle_skill:inn_inside",
        "parts": [{
            "part": "house", "style": dict(TIMBER, roof=WARM), "rect": [-6, -10, 6, 0], "y": 0, "plinth": 2,
            "storeys": [5, 5], "jetty": ["s"], "storey_style": [STONE_GROUND, {}],
            "door": {"side": "s", "kind": "house", "steps": 1},
            "roof": {"type": "gable", "ridge": "x", "pitch": 1},
            "dormers": [{"side": "s", "at": -4, "w": 3, "h": 3}, {"side": "s", "at": 4, "w": 3, "h": 3}, {"side": "n", "at": 0, "w": 3, "h": 3}],
            "chimney": [[-6, -6], [6, -6]], "vines": 0.03,
        }],
    },
}

if __name__ == "__main__":
    for k, s in SPECS.items():
        s = dict(s, name=f"settle_{k}_vale")
        open(os.path.join(HERE, f"settle_{k}_vale.json"), "w").write(json.dumps(s, indent=1))
        print("wrote", f"settle_{k}_vale.json")
