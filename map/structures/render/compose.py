"""A town's base scene plus its level groups (town hall 1-5, station halt to grand) in one 3D viewer page with
level buttons (Mateo 2026-11-12: "in all of these renderings, I want to be able to level up the town hall
and the train station").

    python3 compose.py OUT_DIR/scene.json OUT_DIR/levels.json view_dir --title ... --textures TEX [--shots town] [--three DIR]

levels.json comes from towngen.Town.scene_levels: [{group, labels, default, files}], one scene per level.
"""
import sys, os, json, base64, argparse, subprocess
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from mesher import Mesher

ap = argparse.ArgumentParser()
ap.add_argument("scene"); ap.add_argument("levels"); ap.add_argument("out"); ap.add_argument("--title", default="Preview"); ap.add_argument("--blurb", default="")
ap.add_argument("--textures", required=True); ap.add_argument("--shots", default=""); ap.add_argument("--three", default=os.environ.get("THREE_DIR", ""))
a = ap.parse_args()
NAMES = {"town hall": "Town hall", "station": "Station"}

def load(path):
    d = json.load(open(path))
    return d, {(x, y, z): tuple(d["palette"][i]) for x, y, z, i in d["blocks"]}

os.makedirs(a.out, exist_ok=True); texdir = os.path.join(a.out, "tex")
d, cells = load(a.scene)
m = Mesher(cells, a.textures).run(); names = dict(m.textures(texdir)); meshes = dict(m.out)
xs, ys, zs = zip(*cells)
groups = []
for g, L in enumerate(json.load(open(a.levels))):
    groups.append({"name": NAMES.get(L["group"], L["group"]), "labels": L["labels"], "default": L["default"]})
    for o, f in enumerate(L["files"]):
        _, c = load(f)
        if not c: continue
        mm = Mesher(c, a.textures).run(); names.update(mm.textures(texdir))
        for k, v in mm.out.items(): meshes[f"g{g}o{o}:{k}"] = {**v, "t": k, "g": g, "o": o}
tex = {k: "data:image/png;base64," + base64.b64encode(open(os.path.join(texdir, f), "rb").read()).decode() for k, f in names.items()}
data = {"meshes": meshes, "textures": names, "bounds": [min(xs), min(ys), min(zs), max(xs) + 1, max(ys) + 1, max(zs) + 1], "camera": d.get("camera"), "groups": groups}
html = open(os.path.join(HERE, "viewer.tpl.html")).read()
html = html.replace("__TITLE__", a.title).replace("__BLURB__", a.blurb).replace("__DATA__", json.dumps(data, separators=(",", ":"))).replace("__TEX__", json.dumps(tex))
page = os.path.join(a.out, "viewer.html"); open(page, "w").write(html)
print("groups", [(G["name"], len(G["labels"])) for G in groups], "page", page, round(len(html) / 1e6, 1), "MB")
if a.shots:
    subprocess.run(["node", os.path.join(HERE, "shoot.cjs"), page, os.path.join(a.out, "shot"), a.shots, "day", a.three], check=True)
