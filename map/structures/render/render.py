"""Logical blueprint -> self-contained 3D viewer page (+ optional screenshots).

    python3 render.py scene.json out_dir --title "..." --textures <bedrock-samples>/resource_pack/textures/blocks
            [--shots front-left,high] [--dusk] [--three node_modules/three]
"""
import sys, os, json, base64, argparse, subprocess
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from mesher import Mesher

ap = argparse.ArgumentParser()
ap.add_argument("scene"); ap.add_argument("out"); ap.add_argument("--title", default="Preview"); ap.add_argument("--blurb", default="")
ap.add_argument("--textures", required=True); ap.add_argument("--shots", default=""); ap.add_argument("--dusk", action="store_true")
ap.add_argument("--three", default=os.environ.get("THREE_DIR", ""))
ap.add_argument("--cut", type=int, default=None, help="hide every block at this y and above (cutaway)")
a = ap.parse_args()
d = json.load(open(a.scene))
cells = {(x, y, z): tuple(d["palette"][i]) for x, y, z, i in d["blocks"] if a.cut is None or y < a.cut}
m = Mesher(cells, a.textures).run()
os.makedirs(a.out, exist_ok=True); texdir = os.path.join(a.out, "tex")
names = m.textures(texdir)
tex = {k: "data:image/png;base64," + base64.b64encode(open(os.path.join(texdir, f), "rb").read()).decode() for k, f in names.items()}
xs, ys, zs = zip(*cells)
data = {"meshes": m.out, "textures": names, "bounds": [min(xs), min(ys), min(zs), max(xs) + 1, max(ys) + 1, max(zs) + 1], "camera": d.get("camera")}
html = open(os.path.join(HERE, "viewer.tpl.html")).read()
html = html.replace("__TITLE__", a.title).replace("__BLURB__", a.blurb).replace("__DATA__", json.dumps(data, separators=(",", ":"))).replace("__TEX__", json.dumps(tex))
page = os.path.join(a.out, "viewer.html"); open(page, "w").write(html)
print("quads", sum(len(v["c"]) // 4 for v in m.out.values()), "page", page, round(len(html) / 1e6, 1), "MB")
if a.shots:
    base = os.path.join(a.out, "shot")
    for light in (["day", "dusk"] if a.dusk else ["day"]):
        subprocess.run(["node", os.path.join(HERE, "shoot.cjs"), page, base, a.shots, light, a.three], check=True, env={**os.environ, "NODE_PATH": os.environ.get("NODE_PATH", "")})
