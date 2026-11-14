"""The starter village with real Minecraft block textures: one page, one data file per plot.

    python3 mktextured.py TEXTURES_DIR OUT_DIR view.json [view.json ...]

TEXTURES_DIR = <Mojang bedrock-samples>/resource_pack/textures/blocks. view.json files come from dump.mjs.
Writes OUT_DIR/index.html and OUT_DIR/plots/<plot>.json (meshes from map/structures/render/mesher.py,
textures inlined), so the page can be published as a multi-file artifact or opened from a local server.
"""
import sys, os, json, base64, re, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "map", "structures", "render"))
from mesher import Mesher

texroot, out, *views = sys.argv[1:]
os.makedirs(os.path.join(out, "plots"), exist_ok=True)
SIEGE = {"plot_marker", "mason_bench"}
index = []
for vf in views:
    V = json.load(open(vf))
    cy = V["center"]["y"]
    pal = [("siege:" + n if n in SIEGE else n, p) for n, p in V["pal"]]
    vox = V["vox"]
    cells = {(vox[i], vox[i + 1] - cy, vox[i + 2]): (pal[vox[i + 3]][0], pal[vox[i + 3]][1]) for i in range(0, len(vox), 4)}
    m = Mesher(cells, texroot).run()
    td = tempfile.mkdtemp()
    names = m.textures(td)
    tex = {k: "data:image/png;base64," + base64.b64encode(open(os.path.join(td, f), "rb").read()).decode() for k, f in names.items()}
    meshes = {k: {**v, "p": [round(x, 3) for x in v["p"]], "uv": [round(x, 4) for x in v["uv"]], "c": [round(x, 3) for x in v["c"]]} for k, v in m.out.items()}
    xs, ys, zs = zip(*cells)
    R, A = V["frame"]["right"], V["frame"]["ahead"]
    to = lambda r, a: (r * R[0] + a * A[0], r * R[1] + a * A[1])
    tags = []
    for ar in V["areas"]:
        if ar["kind"] == "building": continue
        x, z = to((ar["box"][0] + ar["box"][1]) / 2, (ar["box"][2] + ar["box"][3]) / 2)
        tags.append([ar["label"], x + 0.5, ar["y"] - cy + 3, z + 0.5])
    for p in V["placed"]: tags.append([p["label"], p["at"][0] + 0.5, p["at"][1] - cy + p.get("h", 6), p["at"][2] + 0.5])
    x, z = to(0, -8); tags.append(["Square", x + 0.5, 3, z + 0.5])
    import math
    ga = V["wall"]["gateAngle"]; rr = V["wall"]["radii"]; gr = rr[round((ga % (2 * math.pi)) / (2 * math.pi) * len(rr)) % len(rr)]
    tags.append(["Gate", math.cos(ga) * gr, 5, math.sin(ga) * gr])
    slug = re.sub(r"[^a-z0-9]+", "-", V["plot"].lower()).strip("-")
    data = {"plot": V["plot"], "region": V["region"], "meshes": meshes, "tex": tex, "bounds": [min(xs), min(ys), min(zs), max(xs) + 1, max(ys) + 1, max(zs) + 1],
            "gateAngle": ga, "tags": tags, "areas": V["areas"], "wall": {"name": V["wall"]["name"], "min": min(rr), "max": max(rr)}, "squareY": cy}
    json.dump(data, open(os.path.join(out, "plots", slug + ".json"), "w"), separators=(",", ":"))
    index.append({"plot": V["plot"], "region": V["region"], "file": f"plots/{slug}.json"})
    print(V["plot"], sum(len(v["c"]) // 4 for v in m.out.values()), "quads", os.path.getsize(os.path.join(out, "plots", slug + ".json")) // 1024, "KB")
html = open(os.path.join(HERE, "textured.tpl.html")).read().replace("/*INDEX*/[]", json.dumps(index))
open(os.path.join(out, "index.html"), "w").write(html)
