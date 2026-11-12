"""Gull's Rest houses in the Atlantean style (Mateo 2026-11-12: "more variation to the roofs for the ocean
village houses, and shift the style to be more Atlantean"), built on the building skill (one engine).

Pale stone walls (diorite, calcite, smooth quartz), quartz-pillar columns at the corners, a sea-worn prismarine
plinth and trim, sea-glass windows (light blue or cyan), and seven roof forms so no street repeats:

    hip       the low Saltreach hip (pitch 1)
    mansard   a steep lower course under a low top (profile [2, 1])
    bell      a hip that swells into a bell toward the top (profile [1, 1, 2])
    dome      a flat quartz deck with a parapet carrying a dome on a short drum (teal prismarine or weathered copper)
    temple    a low gable turned to the street (a pediment) over a colonnade of quartz pillars
    terrace   a hipped main block with a lower wing whose flat roof is a terrace
    tower     a hipped house with a slim corner tower, capped with a steep pyramid or a small dome

regions_towns.HOUSES["salt"] calls house(); the hook contract is unchanged (front +z, markers["door"], bp.kind,
pitched roofs built in the slate sentinel so the town recolours them with recolour_roof). Interiors come from the
skill's house part ("interior" key). The style rules live in .claude/skills/minecraft-builder/regions/saltreach.md
("Atlantean houses").

    python3 atlantean.py OUT            # one of every form, for the 3D review page
"""
import os, sys, random
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
SKILL = os.path.join(HERE, "..", "..", ".claude", "skills", "minecraft-builder", "scripts")
if SKILL not in sys.path: sys.path.insert(0, SKILL)
from bp import Blueprint

SENTINEL = {"block": "deepslate_tiles", "texture": False}      # the town recolours it (regions_towns.recolour_roof)
DECK_EDGE = {"block": "smooth_quartz", "forms": {"wall": "diorite_wall"}}   # parapet slabs, diorite wall posts
DOMES = {
    "teal":   ({"ladder": ["prismarine_bricks", "prismarine", "dark_prismarine"], "axis": "y", "texture": True}, "short"),
    "copper": (None, "short"),                                   # the skill's waxed copper, greener at the top
}
FORMS = {   # weights by tier (0 by the square, 1 street, 2 outer cottage)
    "hip":     (2, 2, 3),
    "mansard": (2, 2, 0),
    "bell":    (1, 2, 2),
    "dome":    (3, 2, 1),
    "temple":  (2, 2, 1),
    "terrace": (2, 1, 0),
    "tower":   (2, 1, 0),
}


TITLES = {"hip": "Low hip house", "mansard": "Mansard house", "bell": "Bell-roof house", "dome": "Domed house",
          "temple": "Temple-front house", "terrace": "Terrace house", "tower": "Tower house"}
BLURBS = {"hip": "The classic Saltreach low hip, now on pale stone and quartz columns with a prismarine plinth.",
          "mansard": "A steep lower course under a low top: the roof reads as a second storey wrapped in tiles.",
          "bell": "A hip that swells toward the top into a bell, finished with a ridge spike.",
          "dome": "A flat quartz deck behind a parapet carrying a dome on a short drum with sea-glass windows: teal prismarine or weathered copper.",
          "temple": "A low gable turned to the street as a pediment over a colonnade of quartz pillars.",
          "terrace": "A hipped main block with a lower wing whose flat roof is a terrace behind a quartz parapet.",
          "tower": "A hipped house with a slim tower at the back corner, under a steep pyramid or a small dome."}


def _pick(rnd, tier):
    keys = list(FORMS); w = [FORMS[k][min(tier, 2)] for k in keys]
    return rnd.choices(keys, w)[0]


def _sizes(rnd, tier):
    if tier == 0: return rnd.choice([(9, 9), (9, 11), (11, 11), (9, 13)])
    if tier == 1: return rnd.choice([(7, 9), (9, 9), (9, 7), (7, 11)])
    return rnd.choice([(7, 7), (7, 9), (9, 7)])


def spec(seed, rnd, tier, form=None):
    """The skill spec for one Gull's Rest house -> (spec, info). info: form, door cell, whether the roof is the
    sentinel (recolourable)."""
    form = form or _pick(rnd, tier)
    w, d = _sizes(rnd, tier)
    two = tier == 0 or form in ("mansard", "terrace", "tower", "dome") or (tier == 1 and rnd.random() < 0.6)
    if tier == 2 and form in ("terrace", "tower", "mansard"): form = "hip"
    W, D = w - 1, d - 1
    glass = rnd.choice(["light_blue_stained_glass_pane", "light_blue_stained_glass_pane", "cyan_stained_glass_pane"])
    style = {"base": "salt_atlantean", "glass": glass, "roof": SENTINEL,
             "door": rnd.choice(["warped_door", "birch_door"]), "shutter": rnd.choice(["warped_planks", "birch_planks"])}
    storeys = [5, 5] if two else [5]
    h = {"part": "house", "name": f"gulls_rest_{form}_{seed}", "style": style, "rect": [0, 0, W, D], "y": 0, "plinth": 1,
         "storeys": storeys, "door": {"side": "s", "kind": "grand" if tier == 0 and w >= 9 else "house", "steps": 0},
         "roof": {"type": "hip"}, "shutters": 0.3, "chimney": False, "interior": "home"}
    parts = [h]; door_z = D + 1; sentinel = True
    if form == "hip":
        h["chimney"] = "auto" if rnd.random() < 0.5 else False
    elif form == "mansard":
        h["roof"] = {"type": "hip", "profile": [2, 1]}
    elif form == "bell":
        h["roof"] = {"type": "hip", "profile": [1, 1, 2]}
    elif form == "dome":
        sentinel = False
        style["roof"] = {"block": "smooth_quartz", "texture": False}
        h["roof"] = {"type": "flat", "parapet": "slab", "beams": False, "parapet_mat": "deck_edge"}
        kind = rnd.choice(list(DOMES)); mat, fin = DOMES[kind]
        r = min(w, d) // 2 - 0.5                        # the dome fills the deck inside the parapet
        dm = {"part": "dome", "at": [W // 2, D // 2], "r": r, "drum": {"h": 2, "windows": 4, "glass": glass}, "finial": fin}
        if mat: dm["material"] = mat
        parts.append(dm)
    elif form == "temple":
        h["roof"] = {"type": "gable", "ridge": "z", "pitch": 1}
        h["porch"] = {"side": "s", "w": w, "d": 3, "h": 4, "every": 2, "post": "quartz_pillar"}
        h["door"]["kind"] = "house"; door_z = D + 4
    elif form == "terrace":
        ww = 5
        h["wings"] = [{"rect": [W + 1, 2, W + ww, D], "storeys": [5], "roof": {"type": "flat", "parapet": "slab", "beams": False,
                                                                                "parapet_mat": "deck_edge"}, "join": "none",
                       "style": dict(style, roof={"block": "smooth_quartz", "texture": False})}]
        h["balconies"] = []
    elif form == "tower":
        cap = rnd.choice(["pyramid", "dome"])
        tr = [W - 4, 0, W, 4] if rnd.random() < 0.5 else [0, 0, 4, 4]
        tw = {"rect": [tr[0], tr[1] - 5, tr[2], tr[1] - 1], "storeys": [5, 5, 4], "join": "none",
              "roof": {"type": "hip", "pitch": 2} if cap == "pyramid" else {"type": "flat", "parapet": "none", "beams": False}}
        if cap == "dome": tw["style"] = dict(style, roof={"block": "smooth_quartz", "texture": False})
        h["wings"] = [tw]
        if cap == "dome":
            mat, fin = DOMES[rnd.choice(["teal", "copper"])]
            dm = {"part": "dome", "at": [tr[0] + 2, tr[1] - 3], "r": 2.5, "finial": fin}
            if mat: dm["material"] = mat
            parts.append(dm)
    return ({"name": h["name"], "edition": "bedrock", "parts": parts, "materials": {"deck_edge": DECK_EDGE}},
            {"form": form, "door": (W // 2, 1, door_z), "sentinel": sentinel, "w": w, "d": d})


def house(seed, rnd, tier, roof=None, form=None):
    """A Gull's Rest house as a map Blueprint (the regions_towns.HOUSES["salt"] hook)."""
    import engine
    import regions_towns as RT
    s, info = spec(seed, rnd, tier, form)
    bp = Blueprint(f"gulls_rest_house_{seed}_t{tier}")
    engine.into_blueprint(bp, s)
    bp.markers["door"] = info["door"]
    bp.form = info["form"]
    if roof and info["sentinel"]: RT.recolour_roof(bp, "salt", roof, seed)
    bp.kind = "house"
    return bp


def store(seed, rnd, roof=None, name="gulls_rest_net_store"):
    """A net / farm store: prismarine-plinthed stone below, a low gable, a big plank door to the street."""
    import engine
    import regions_towns as RT
    w, d = rnd.choice([(9, 11), (11, 9), (9, 9)])
    W, D = w - 1, d - 1
    st = {"base": "salt_atlantean", "roof": SENTINEL, "door": "birch_door", "glass": "white_stained_glass_pane"}
    s = {"name": f"{name}_{seed}", "edition": "bedrock", "parts": [
        {"part": "house", "style": st, "rect": [0, 0, W, D], "y": 0, "plinth": 1, "storeys": [5],
         "door": {"side": "s", "kind": "large", "steps": 0}, "roof": {"type": "gable", "pitch": 1}, "shutters": 0,
         "chimney": False, "interior": {"use": "store"}}]}
    bp = Blueprint(f"{name}_{seed}")
    engine.into_blueprint(bp, s)
    bp.markers["door"] = (W // 2, 1, D + 1)
    if roof: RT.recolour_roof(bp, "salt", roof, seed)
    bp.kind = "barn"
    return bp


if __name__ == "__main__":
    import json
    out = sys.argv[1] if len(sys.argv) > 1 else "atlantean_out"
    os.makedirs(out, exist_ok=True)
    for k, form in enumerate(FORMS):
        for t in (0, 1):
            s, info = spec(100 + k * 10 + t, random.Random(100 + k * 10 + t), t, form)
            json.dump(s, open(os.path.join(out, f"{form}_t{t}.json"), "w"), indent=1)
    print("wrote", 2 * len(FORMS), "specs to", out)
