"""Everwake Wings: write the real Bedrock animation + controller files, and pack a preview page that
plays THOSE files on the game's own player model (geometry.hc.jointed + a look skin), the real
Choirsteel armour geometry/textures and the real wing geometry/texture.

    python3 build_anim.py REPO WINGS_OUT OUTDIR      (WINGS_OUT = where build_wings.py wrote the geo + png)
Installed into the pack by tools/build_everwake_wings.py.
"""
import base64, json, os, sys
REPO, WOUT, OUT = sys.argv[1:4]; os.makedirs(OUT, exist_ok=True)
HERE = os.path.dirname(os.path.abspath(__file__))
RP = os.path.join(REPO, "Siege_Nights_RP")

def n(x): return f"{x:g}"
def L(a, b, s): return f"({n(a)} + {n(b - a)} * ({s}))" if s not in ("0", "1") else n(a if s == "0" else b)

def pose(s="1", sw="0", fl="0", lean="0", scale=True, arms=True):
    """Bedrock bone channels (degrees). Wings lie in the plane of the back: z raises them or sweeps
    them toward the feet inside that plane, y moves them out of it (the up-and-down beat).
    Left wing (+x) and right wing mirror: z and y flip sign."""
    b = {}
    for side, k in (("left", -1), ("right", 1)):
        z0 = f"({L(6, 6.9, s)} - ({sw}) * 45.8)"
        b[f"{side}_wing"] = {"rotation": [0, f"{k} * (0 - ({fl}))", f"{k} * {z0}"]}
        if scale: b[f"{side}_wing"]["scale"] = [L(0.32, 1, s), L(0.7, 1, s), 1]
        b[f"{side}_wing_mid"] = {"rotation": [0, f"{-k} * ({fl}) * 0.45", f"{k} * ({L(0, -2.3, s)} - ({sw}) * 17.2)"]}
        b[f"{side}_wing_tip"] = {"rotation": [0, f"{-k} * ({fl}) * 0.65", f"{k} * ({L(0, -3.4, s)} - ({sw}) * 20.0)"]}
    if lean != "0":
        # tip the whole body face-down around its middle (pivot is at the feet, so lift and shift it back)
        b["root"] = {"rotation": [lean, 0, 0], "position": [0, f"14.4 * (1 - math.cos({lean}))", f"14.4 * math.sin({lean})"]}
    if arms:
        b["rightarm"] = {"rotation": [f"-0.15 * ({lean})", 0, -10.3]}
        b["leftarm"] = {"rotation": [f"-0.15 * ({lean})", 0, 10.3]}
        b["rightleg"] = {"rotation": [5.7, 0, 0]}
        b["leftleg"] = {"rotation": [1.7, 0, 0]}
    return b

T = "query.anim_time"
def beat(amp, spd, s="1"): return f"math.sin({T} * {n(spd * 180)}) * {n(amp)} * ({s})" if amp else "0"
A = "animation.siege.everwake_wings."
ANIMS = {
    A + "folded": {"loop": True, "bones": pose("0", arms=False)},
    A + "open": {"animation_length": 0.6, "bones": pose(s=f"math.min({T} / 0.45, 1)", sw="0.05",
                 fl=beat(20, 1.6, f"math.min({T} / 0.45, 1)"), lean=f"17.2 * math.min({T} / 0.6, 1)")},
    A + "glide": {"loop": True, "animation_length": 2.5, "bones": pose("1", "0.1", beat(2.3, 0.8), "77.3")},
    A + "boost": {"animation_length": 0.8, "bones": pose(s=f"1 - 0.2 * math.sin({T} / 0.8 * 180)", sw=f"0.1 + 0.35 * math.sin({T} / 0.8 * 180)",
                  lean=f"77.3 + 4 * math.sin({T} / 0.8 * 180)")},
    A + "dive": {"loop": True, "animation_length": 2.0, "bones": pose("0.45", "1", beat(1.1, 1, "0.45"), "86")},
    A + "flare": {"loop": True, "animation_length": 1.6667, "bones": pose("1", "-0.05", beat(17.2, 1.2), "8.6")},
}
ANIM_FILE = {"format_version": "1.8.0", "animations": ANIMS}

P = "(query.has_property('siege:wings') ? query.property('siege:wings') : 0)"
def st(anims, trans, blend=0.3): return {"animations": anims, "transitions": [{k: v} for k, v in trans], "blend_transition": blend}
CTRL = {"controller.animation.siege.everwake_wings": {"initial_state": "none", "states": {
    "none": {"transitions": [{"folded": f"{P} >= 1"}]},
    "folded": st(["everwake_folded"], [("none", f"{P} < 1"), ("open", f"{P} >= 2")]),
    "open": st(["everwake_open"], [("glide", "query.all_animations_finished")], 0.2),
    "glide": st(["everwake_glide"], [("folded", f"{P} == 1"), ("boost", f"{P} == 3"), ("flare", f"{P} == 4"), ("dive", "query.target_x_rotation > 50")]),
    "boost": st(["everwake_boost"], [("glide", "query.all_animations_finished")], 0.15),
    "dive": st(["everwake_dive"], [("glide", "query.target_x_rotation < 40"), ("boost", f"{P} == 3"), ("folded", f"{P} == 1")], 0.4),
    "flare": st(["everwake_flare"], [("folded", f"{P} == 1"), ("glide", f"{P} == 2")], 0.4),
}}}
CTRL_FILE = {"format_version": "1.10.0", "animation_controllers": CTRL}
ALIASES = {"everwake_" + k.split(".")[-1]: k for k in ANIMS}
json.dump(ANIM_FILE, open(os.path.join(OUT, "everwake_wings.animation.json"), "w"), indent=1)
json.dump(CTRL_FILE, open(os.path.join(OUT, "everwake_wings.animation_controllers.json"), "w"), indent=1)

# ---------------------------------------------------------------- pack the preview
def uri(p): return "data:image/png;base64," + base64.b64encode(open(p, "rb").read()).decode()
def geo(p): return json.load(open(p))["minecraft:geometry"][0]
GEOS = {"player": geo(os.path.join(RP, "models/entity/hc_jointed.geo.json")),
        "wings": geo(os.path.join(WOUT, "everwake_wings.geo.json"))}
ARMOR = {p: geo(os.path.join(RP, f"models/entity/armor/choirsteel_{p}.geo.json")) for p in ("helmet", "chestplate", "leggings", "boots")}
LOOKS = {f[:-4]: uri(os.path.join(RP, "textures/entity/looks", f)) for f in sorted(os.listdir(os.path.join(RP, "textures/entity/looks"))) if f.endswith(".png")}
TEX = {"wings": uri(os.path.join(WOUT, "everwake_wings.png")),
       "choir1": uri(os.path.join(RP, "textures/models/siege_armor/choirsteel_1.png")),
       "choir2": uri(os.path.join(RP, "textures/models/siege_armor/choirsteel_2.png"))}
DATA = {"GEOS": GEOS, "ARMOR": ARMOR, "LOOKS": LOOKS, "TEX": TEX, "ANIMS": ANIMS, "CTRL": CTRL, "ALIASES": ALIASES,
        "FILES": {"anim": json.dumps(ANIM_FILE, indent=1), "ctrl": json.dumps(CTRL_FILE, indent=1)}}
tpl = open(os.path.join(HERE, "anim_tpl.html")).read()
html = tpl.replace("/*DATA*/null", json.dumps(DATA))
open(os.path.join(OUT, "everwake-wings.html"), "w").write(html)
print("ok", len(html))
