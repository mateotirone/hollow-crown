# Packs settlement.json (from dump.mjs) into art/settle/settlement-viewer.html
import json, base64, re, os
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..", "..")
src = open(os.path.join(HERE, "..", "townhall_preview", "render.py")).read()
COL = eval(re.search(r"COL = (\{.*?\})\ndef render", src, re.S).group(1))
COL.update({"anvil": (68, 68, 72), "barrel": (122, 90, 52), "blast_furnace": (80, 80, 84), "cauldron": (58, 58, 62), "chest": (160, 112, 40),
    "composter": (118, 84, 48), "crafting_table": (140, 100, 60), "farmland": (92, 60, 34), "furnace": (110, 110, 110), "grass_path": (150, 126, 70),
    "grindstone": (140, 140, 140), "hay_block": (200, 170, 40), "water": (60, 110, 200), "white_wool": (234, 236, 236), "siege:portcullis": (66, 68, 74),
    "plot marker": (204, 172, 96), "hall ground": (178, 122, 104), "siege:mason_bench": (150, 130, 100), "siege:archive_shelf": (126, 84, 58)})
tt = json.load(open(os.path.join(ROOT, "Siege_Nights_RP/textures/terrain_texture.json")))["texture_data"]
def avg(block):
    tex = tt.get(block.replace(":", "_"), {}).get("textures")
    if isinstance(tex, list): tex = tex[0]
    if isinstance(tex, dict): tex = tex.get("path")
    path = os.path.join(ROOT, "Siege_Nights_RP", (tex or "") + ".png")
    if not tex or not os.path.exists(path): return None
    im = Image.open(path).convert("RGBA").resize((1, 1), Image.BOX)
    return im.getpixel((0, 0))[:3]
d = json.load(open(os.path.join(HERE, "settlement.json")))
names = {"plot marker", "hall ground", "red_wool", "spruce_fence", "siege:mason_bench"}
for s in d["styles"].values():
    for h in s["halls"]: names |= {c[3] for c in h}
    for v in s["slots"].values(): names |= {c[3] for c in v}
    names |= set(s["kinds"].values())
names = sorted(names)
for n in names:
    if n not in COL:
        c = avg(n)
        if c is None: raise SystemExit("no colour for " + n)
        COL[n] = c
def shape(b):
    if "carpet" in b or b in ("snow_layer", "plot marker", "hall ground"): return 1
    if b in ("lantern", "campfire", "siege:brazier"): return 2
    if "fence" in b or b in ("scaffolding", "iron_chain") or b.endswith("_wall") or b == "siege:battlement": return 3
    if b.endswith("_slab"): return 4
    if "glass_pane" in b: return 5
    if b == "siege:tree_of_oaths": return 6
    return 0
nice = lambda n: n.replace("siege:", "").replace("_", " ")
palette = [[*COL[n], shape(n), nice(n)] for n in names]
idx = {n: i for i, n in enumerate(names)}
KINDS = ["log", "fence", "plank", "stone", "tiles", "bricks", "cobbled", "smooth", "tooth", "light", "gate", "port"]
def pack(cells, look):
    buf = bytearray()
    for x, y, z, b in cells: buf += bytes([x + 128, max(0, y), z + 128, look[b]])
    return base64.b64encode(bytes(buf)).decode()
data = {"halls": {}, "slots": {}, "walls": [], "kinds": {}}
for k, s in d["styles"].items():
    data["halls"][k] = [pack(h, idx) for h in s["halls"]]
    data["slots"][k] = {sid: pack(c, idx) for sid, c in s["slots"].items()}
    data["kinds"][k] = [idx[s["kinds"][kind]] for kind in KINDS]
kidx = {k: i for i, k in enumerate(KINDS)}
data["walls"] = [pack(w["cells"], kidx) for w in d["wallLevels"]]
meta = {
    "radius": d["radius"], "masonAt": [d["masonAt"]["x"], d["masonAt"]["z"]], "tierCap": d["walls"]["tierCap"],
    "walls": [{k: w.get(k) for k in ("name", "h", "thick", "towers", "blocks", "cost", "port", "gatehouse")} for w in d["wallLevels"]],
    "slots": d["slots"], "buildings": d["buildings"], "marker": idx["plot marker"], "hallGround": idx["hall ground"],
    "banner": [idx["spruce_fence"], idx["red_wool"]], "bench": idx["siege:mason_bench"],
    "sizes": {k: {"hall": s["hallBox"], "b": s["slotBox"]} for k, s in d["styles"].items()},
}
html = open(os.path.join(HERE, "viewer.tpl.html")).read().replace("/*PALETTE*/", json.dumps(palette)).replace("/*DATA*/", json.dumps(data)).replace("/*META*/", json.dumps(meta))
out = os.path.join(ROOT, "art", "settle", "settlement-viewer.html")
os.makedirs(os.path.dirname(out), exist_ok=True)
open(out, "w").write(html)
print(len(html))
