"""The Mason's Yard: the mason's workshop that every new base raises with the rest (Mateo's playtest 2026-11-12:
"the mason is still standing on top of his block ... his building needs to spawn with the rest of everything else").

    python3 gen_mason.py      -> mason_yard_<region>.json, one per region

Footprint 9 x 9 with the roof (x -4..4, z -8..0): a 7 x 5 stone-and-timber workshop at the back (door on the
south wall), and an open yard in front of it where the mason works: the Mason's Bench (siege:mason_bench,
placed by the game at its mark, "bench"), a stonecutter, stacked blocks and rubble. The front faces south (+z),
same frame as the plot buildings (gen_settle.py). Every region starts from its preset (skill regions/<region>.md).
"""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
from gen_settle import R, NAMES, roof, noise

YARD = {"vale": "gravel", "frostmarch": "cobbled_deepslate", "saltreach": "smooth_sandstone",
        "emberwaste": "red_sandstone", "blackfen": "packed_mud"}
STACK = {"vale": ["stone_bricks", "cobblestone"], "frostmarch": ["deepslate_bricks", "cobbled_deepslate"],
         "saltreach": ["cut_sandstone", "sandstone"], "emberwaste": ["cut_red_sandstone", "smooth_red_sandstone"],
         "blackfen": ["mud_bricks", "tuff_bricks"]}

def spec(region):
    g = R[region]; flat = g["kind"] == "flat"
    style = dict(g["stone"], roof=g["roofs"][3])
    a, b = STACK[region]
    yard = [[x, 0, z, YARD[region]] for x in range(-4, 5) for z in (-2, -1, 0)]
    dress = [
        [-3, 1, -1, "stonecutter_block", {"facing": "s"}],          # the cutting bench
        [3, 1, -2, a], [3, 2, -2, a], [4, 1, -2, b], [4, 1, -1, b],  # stacked dressed stone and rubble
        [-4, 1, -1, "cobblestone_slab", {"half": "bottom"}],
        [-4, 1, -2, "barrel"],
    ]
    return {
        "name": f"mason_yard_{region}",
        "card": {"title": "Mason's Yard", "sub": f"{NAMES[region]}, workshop and yard", "region": region,
                 "where": "Every new base, beside the square", "kind": "Work",
                 "blurb": "The mason's workshop: a small stone shop with his tools inside, and a yard in front where he cuts and sells blocks."},
        "parts": [{"part": "house", "style": style, "rect": [-3, -7, 3, -3], "y": 0, "plinth": 1,
                   "storeys": [5], "door": {"side": "s", "kind": "house", "steps": 0},
                   "roof": {"type": "flat", "parapet": "slab", "beams": True} if flat else dict(roof(region, "x"), overhang=1),
                   "interior": {"use": "shop", "rooms": ["shop"]}, "chimney": False if flat else [[2, -5]],
                   "shutters": 0.3, "bushes": False}],
        "place": yard + dress,
        "marks": {"bench": [1, 1, -1]}   # the Mason's Bench (the game places it; the mason stands beside it),
    }

if __name__ == "__main__":
    for region in R:
        open(os.path.join(HERE, f"mason_yard_{region}.json"), "w").write(json.dumps(spec(region), indent=1))
    print("wrote", len(R), "Mason's Yard specs")
