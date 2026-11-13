"""scene.json -> one self-contained 3D page (packed + gzipped meshes inline, textures inline).
python3 mkpage.py scene.json textures_dir tpl.html out.html "Title" "blurb"
"""
import sys, os, json, base64, gzip, tempfile, shutil
REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
sys.path.insert(0, REPO); sys.path.insert(0, REPO + "/render")
from mesher import Mesher
from build_3d_catalogue import _pack
scene, texdir, tpl, out, title, blurb = sys.argv[1:7]
d = json.load(open(scene))
cells = {(x, y, z): tuple(d["palette"][i]) for x, y, z, i in d["blocks"]}
cells = {k: v for k, v in cells.items() if v[0] != "keep"}
m = Mesher(cells, texdir).run()
tmp = tempfile.mkdtemp(); names = m.textures(tmp)
tex = {k: "data:image/png;base64," + base64.b64encode(open(os.path.join(tmp, f), "rb").read()).decode() for k, f in names.items()}
shutil.rmtree(tmp)
xs, ys, zs = zip(*cells)
data = {"meshes": {k: _pack(v) | ({"t": v["t"]} if "t" in v else {}) for k, v in m.out.items()},
        "bounds": [min(xs), min(ys), min(zs), max(xs) + 1, max(ys) + 1, max(zs) + 1], "camera": json.load(open(sys.argv[7])) if len(sys.argv) > 7 else d.get("camera")}
if len(sys.argv) > 8: data["terrain"] = json.load(open(sys.argv[8]))
raw = base64.b64encode(gzip.compress(json.dumps(data, separators=(",", ":")).encode(), 9)).decode()
html = open(tpl).read().replace("__TITLE__", title).replace("__BLURB__", blurb).replace("__DATA__", raw).replace("__TEX__", json.dumps(tex, separators=(",", ":")))
open(out, "w").write(html)
print("quads", sum(len(v["c"]) // 4 for v in m.out.values()), round(len(html) / 1e6, 2), "MB")
