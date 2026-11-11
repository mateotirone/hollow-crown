"""Build the tree database: every species x size x variant as .mcstructure + stamp JSON, plus previews.

    python3 build_trees.py OUT [--variants 6] [--only vale_great_oak,...] [--render --textures <bedrock-samples>/resource_pack/textures/blocks --three <node_modules/three>]

OUT/<species>/<species>_<size>_<n>.mcstructure and .stamp.json, OUT/trees.json (the index the world writer
reads), OUT/preview/<species>/viewer.html (+ shots) with the four sizes side by side on grass.
"""
import argparse, json, os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from species import CARDS, SIZES
from grow import grow
from bp import Blueprint
from lock import locked

ap = argparse.ArgumentParser()
ap.add_argument("out"); ap.add_argument("--variants", type=int, default=6); ap.add_argument("--only", default="")
ap.add_argument("--render", action="store_true"); ap.add_argument("--textures", default=""); ap.add_argument("--three", default="")
ap.add_argument("--shots", default="front-left"); ap.add_argument("--all-only", action="store_true")
a = ap.parse_args()
only = [s for s in a.only.split(",") if s]
index = {"format": "hollow-crown-trees/1", "species": {}}
everything = Blueprint("all_trees"); row_z = 0
for sid, card in CARDS.items():
    if only and sid not in only: continue
    d = os.path.join(a.out, sid); os.makedirs(d, exist_ok=True)
    ent = {"name": card["name"], "region": card["region"], "real": card["real"], "sizes": {}}
    lineup = Blueprint(sid + "_lineup"); x = 0
    for size in SIZES:
        files = []
        for v in range(a.variants):
            seed = hash((sid, size, v)) & 0xFFFFFFF if False else (abs(hash(sid)) % 10000) * 100 + SIZES.index(size) * 10 + v
            seed = sum(map(ord, sid)) * 1000 + SIZES.index(size) * 100 + v
            t = grow(card, size, seed)
            name = f"{sid}_{size}_{v}"
            lk = locked(t); lk.rotations = [0]          # tree-only block states don't turn with a stamp rotation; variants give the variety
            lk.fill_below = None
            lk.save_mcstructure(os.path.join(d, name + ".mcstructure")); lk.save_json(os.path.join(d, name + ".stamp.json"))
            lo, hi = t.bounds()
            files.append({"file": f"{sid}/{name}", "size": [hi[0] - lo[0] + 1, hi[1] - lo[1] + 1, hi[2] - lo[2] + 1], "blocks": len(t.cells)})
            if v == 0:
                w = hi[0] - lo[0] + 1
                lineup.paste(t, x - lo[0], 0, 0); x += w + 3
        ent["sizes"][size] = files
    index["species"][sid] = ent
    lo_, hi_ = lineup.bounds(); everything.paste(lineup, 0, 0, row_z - lo_[2]); row_z += hi_[2] - lo_[2] + 5
    if a.render and not a.all_only:
        lo, hi = lineup.bounds()
        for gx in range(lo[0] - 3, hi[0] + 4):
            for gz in range(lo[2] - 3, hi[2] + 4):
                lineup.setif(gx, 0, gz, "grass_block")
        pd = os.path.join(a.out, "preview", sid); os.makedirs(pd, exist_ok=True)
        lineup.save_logical(os.path.join(pd, "scene.json"))
        subprocess.run([sys.executable, os.path.join(HERE, "..", "structures", "render", "render.py"), os.path.join(pd, "scene.json"), pd,
                        "--title", card["name"], "--textures", a.textures, "--three", a.three, "--shots", a.shots], check=True)
if a.render and everything.cells:
    lo, hi = everything.bounds()
    for gx in range(lo[0] - 3, hi[0] + 4):
        for gz in range(lo[2] - 3, hi[2] + 4): everything.setif(gx, 0, gz, "grass_block")
    pd = os.path.join(a.out, "preview", "all"); os.makedirs(pd, exist_ok=True); everything.save_logical(os.path.join(pd, "scene.json"))
    subprocess.run([sys.executable, os.path.join(HERE, "..", "structures", "render", "render.py"), os.path.join(pd, "scene.json"), pd,
                    "--title", "Hollow Crown Trees", "--blurb", "Rows: " + ", ".join(CARDS[k]["name"] for k in index["species"]) + ". Sizes left to right: sapling, young, mature, ancient.",
                    "--textures", a.textures, "--three", a.three, "--shots", "front-left,high" if a.shots else ""], check=True)
json.dump(index, open(os.path.join(a.out, "trees.json"), "w"), indent=1)
print("species", len(index["species"]))
