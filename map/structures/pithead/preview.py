"""3D preview of the plot mine: the pithead (spec.py, the building skill) on top of the cave as the game writes it
one night (dump_cave.mjs over Siege_Nights_BP/scripts/plotcaves), turnable in the browser with Mojang's textures.

    python3 preview.py OUT_DIR --textures <bedrock-samples>/resource_pack/textures/blocks

OUT_DIR gets index.html, data/mine.txt and tex.json (publish index.html with the other two as files).
"""
import argparse, base64, gzip, json, os, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..")); sys.path.insert(0, os.path.join(HERE, "..", "render"))
import spec as pit  # noqa: E402
from machine_regions import NAMES  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("out"); ap.add_argument("--textures", required=True)
ap.add_argument("--quick", action="store_true", help="only the Vale at Hamlet")
a = ap.parse_args()

PLOTS = [("Oakmere", "vale"), ("Frosthelm", "frostmarch"), ("Gullcliff", "saltreach"), ("Reedmoor", "blackfen"), ("Redmesa", "emberwaste")]
TIERS = ["Hamlet", "Town", "City", "Castle"]
jobs = [(p, r, 0) for p, r in PLOTS] + [("Oakmere", "vale", t) for t in (1, 2, 3)]
if a.quick: jobs = jobs[:1]

sys.path.insert(0, os.path.join(pit.SKILL, "scripts"))
from engine import compute  # noqa: E402
from mesher import Mesher  # noqa: E402
from build_3d_catalogue import _pack  # noqa: E402

tmp = tempfile.mkdtemp()
dump = os.path.join(tmp, "caves.json")
subprocess.run(["node", os.path.join(HERE, "dump_cave.mjs"), dump] + [f"{p}:{r}:{t}:0,1" for p, r, t in jobs], check=True)
caves = json.load(open(dump))

heads = {}
for p, r, t in jobs:
    if r in heads: continue
    blocks, _, _ = compute(pit.specs(False, pit.SKILL, (r,))[f"pithead_{r}"])
    heads[r] = {k: (n, p_ or {}) for k, (n, p_) in blocks.items() if n != "air"}

os.makedirs(os.path.join(a.out, "data"), exist_ok=True)
index, tex, buf = [], {}, bytearray()
for p, r, t in jobs:
    d = caves[f"{p}:{r}:{t}:0,1"]
    cells = {(x, y, z): tuple(d["palette"][i]) for x, y, z, i in d["blocks"]}
    for k, v in heads[r].items():
        if k[1] >= 0 or k not in cells: cells[k] = v
    cells = {k: (n, dict(pp)) for k, (n, pp) in cells.items()}
    m = Mesher(cells, a.textures).run()
    td = tempfile.mkdtemp()
    for k, f in m.textures(td).items():
        tex[k] = "data:image/png;base64," + base64.b64encode(open(os.path.join(td, f), "rb").read()).decode()
    shutil.rmtree(td)
    xs, ys, zs = zip(*cells)
    lo, hi = [min(xs), min(ys), min(zs)], [max(xs) + 1, max(ys) + 1, max(zs) + 1]
    way = d["way"]
    mid = sorted(c[1] for c in way)[len(way) // 2] if way else -30
    cuts = [["Pit bottom and rest", -26], ["Haulage way", mid + 3]]
    if t >= 3: cuts.append(["Sealed door", min(c[1] for c in way) + 4])
    cam = {"views": {"card": [-38, 20, max(hi[0] - lo[0], hi[2] - lo[2]) * 2.0, (lo[0] + hi[0]) / 2, -16, (lo[2] + hi[2]) / 2]}}
    raw = gzip.compress(json.dumps({"meshes": {k: _pack(v) for k, v in m.out.items()}, "bounds": lo + hi, "camera": cam}, separators=(",", ":")).encode(), 9)
    title = f"{NAMES[r]} mine" if t == 0 else f"Vale mine at {TIERS[t]}"
    sub = f"{p}, {TIERS[t]} level open" + (", the sealed door" if d["door"] else "")
    blurb = ("The pithead on top; under it the shaft, the timbered pit bottom, the miners' rest and the haulage way, in the "
             "cave as the game writes it each night. Use the cut buttons or the slider to look inside.")
    index.append({"key": f"mine_{p}_{t}", "bundle": "mine", "section": "Regions at Hamlet" if t == 0 else "Each tier opens deeper",
                  "group": "", "title": title, "sub": sub, "blurb": blurb, "size": [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]],
                  "blocks": len(cells), "at": [len(buf), len(raw)], "cuts": cuts, "cut": None})
    buf += raw
    print("meshed", p, r, t, len(cells), flush=True)
open(os.path.join(a.out, "data", "mine.txt"), "w").write(base64.b64encode(bytes(buf)).decode())
json.dump(tex, open(os.path.join(a.out, "tex.json"), "w"), separators=(",", ":"))
html = open(os.path.join(HERE, "..", "render", "viewer3d.tpl.html")).read()
# named cut buttons for a mine (pit bottom, haulage way, the door) instead of a house's floors
html = html.replace('  const lv = b.levels || [];', '  (b.cuts || []).forEach(([label, y]) => add(label, y));\n  const lv = b.levels || [];')
# a hook for screenshots: window.__view(azimuth, elevation, distance, x, y, z)
html = html.replace("function frame(D) {", "window.__view = (az, el, d, X, Y, Z) => { const a = az * Math.PI / 180, e = el * Math.PI / 180; cam.position.set(X + Math.sin(a) * Math.cos(e) * d, Y + Math.sin(e) * d, Z + Math.cos(a) * Math.cos(e) * d); controls.target.set(X, Y, Z); controls.update(); };\nfunction frame(D) {", 1)
html = html.replace("<title>Hollow Crown in 3D</title>", "<title>Plot Mine in 3D</title>")
html = html.replace("__INDEX__", json.dumps(index, separators=(",", ":")))
open(os.path.join(a.out, "index.html"), "w").write(html)
shutil.rmtree(tmp)
print(len(index), "scenes", round(len(buf) / 1e6, 1), "MB")
