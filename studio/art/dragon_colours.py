"""The dragons' colours: every species hatches in one of three hides (Mateo 2026-11-13: "Do the dragons have different
colors that they can be?"). Colour 0 is the species' own painted skin (geoskin.py DRAGONS); this paints colours 1 and 2
from the same geo with other palettes, in the same style, as textures/entity/siege/dragons/<species>_<n>.png.

    python3 studio/art/dragon_colours.py

Names live with the game numbers (Siege_Nights_BP/scripts/dragons/data.js SPECIES[].colours), in the same order.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from geoskin import paint

RP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "Siege_Nights_RP") + "/"
SADDLE = {"saddle": {"c": (110, 72, 44), "style": "cloth"}, "strap": {"c": (70, 48, 32), "style": "plain"}}

def pal(hide, belly, horn, membrane, horn_style="bone"):
    return dict(hide={"c": hide, "style": "scale"}, belly={"c": belly, "style": "plain"}, horn={"c": horn, "style": horn_style},
                membrane={"c": membrane, "style": "plain"}, **SADDLE)

COLOURS = {
    "cinderwing": [   # 0 Ember Red
        ("Ash Black", pal((52, 44, 46), (150, 90, 60), (180, 150, 110), (120, 40, 30)), (255, 180, 40)),
        ("Copper", pal((176, 104, 48), (226, 196, 140), (90, 60, 40), (214, 140, 70)), (255, 220, 90)),
    ],
    "wyvern": [       # 0 Ashen Grey
        ("Bone White", pal((200, 196, 186), (232, 228, 216), (110, 100, 90), (170, 160, 150)), (255, 130, 30)),
        ("Soot", pal((58, 56, 62), (110, 106, 110), (30, 28, 32), (80, 40, 40)), (255, 80, 40)),
    ],
    "drake": [        # 0 Dune Gold
        ("Rust", pal((150, 78, 44), (214, 170, 120), (90, 52, 30), (170, 96, 56), "stone"), (40, 200, 190)),
        ("Pale Sand", pal((226, 206, 160), (246, 238, 214), (170, 140, 90), (210, 180, 130), "stone"), (40, 140, 220)),
    ],
    "wyrm": [         # 0 Amethyst Glass
        ("Sea Glass", pal((30, 70, 72), (60, 120, 116), (110, 190, 180), (110, 210, 200, 170)), (220, 255, 120)),
        ("Frost Glass", pal((150, 170, 196), (200, 214, 232), (230, 240, 250), (190, 220, 250, 160)), (90, 170, 255)),
    ],
}

BASE = {"cinderwing": "Ember Red", "wyvern": "Ashen Grey", "drake": "Dune Gold", "wyrm": "Amethyst Glass"}

def viewer_data():
    """Every colour's skin into the 3D dragon viewer's data (studio/dragon_viewer/data.json, species[].colours)."""
    import base64, json
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "dragon_viewer", "data.json")
    data = json.load(open(path))
    uri = lambda f: "data:image/png;base64," + base64.b64encode(open(RP + f"textures/entity/siege/dragons/{f}.png", "rb").read()).decode()
    for sp in data["species"]:
        k = sp["key"]
        sp["colours"] = [{"name": BASE[k], "texture": uri(k)}] + [{"name": c[0], "texture": uri(f"{k}_{n}")} for n, c in enumerate(COLOURS[k], 1)]
    json.dump(data, open(path, "w"))

if __name__ == "__main__":
    for k, cols in COLOURS.items():
        for n, (name, p, eye) in enumerate(cols, 1):
            paint(RP + f"models/entity/dragons/{k}.geo.json", RP + f"textures/entity/siege/dragons/{k}_{n}.png", p, eye)
            print(k, n, name)
    viewer_data()
