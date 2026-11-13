"""Packs dump.mjs + mesh.py output into the one-file Town Upgrade Simulator page.

    python3 studio/town_sim/mkpage.py SIM_JSON LIB_JSON OUT_HTML
"""
import base64, gzip, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sim_path, lib_path, out_path = sys.argv[1:4]
sim, lib = json.load(open(sim_path)), json.load(open(lib_path))

def flat(ops):  # [[kind, ...], ...] -> [kind, ..., kind, ...]
    return [v for op in ops for v in op]

sim["initial"] = flat(sim["initial"])
for e in sim["events"]: e["ops"] = flat(e["ops"])
for t in sim["tiers"]:
    for k in ("ground", "blend", "fixtures", "markers"):
        if k in t: t[k] = flat(t[k])
    t["ring"]["fresh"] = {L: flat(o) for L, o in t["ring"]["fresh"].items()}
for h in sim["halls"]:
    if h: h["ops"] = flat(h["ops"])
for s in sim["stations"]: s["ops"] = flat(s["ops"])
for d in sim["designs"].values():
    for f in d["faces"].values():
        f["cols"] = flat(f["cols"]); f["cells"] = flat(f["cells"])
sim["treeOps"] = [{**t, "ops": flat(t["ops"])} for t in lib["treeOps"]]
sim["forest"] = [flat(t) for t in lib["forest"]]
for k in ("palette", "names", "soft", "models", "joins", "full", "groups", "atlas", "atlasSize", "rects", "avg"):
    sim[k] = lib[k]
del sim["ground"]["h"][:0]
raw = json.dumps(sim, separators=(",", ":")).encode()
data = base64.b64encode(gzip.compress(raw, 9)).decode()
tpl = open(os.path.join(HERE, "viewer.tpl.html")).read()
page = tpl.replace("__TITLE__", f"{sim['plot']} Town Builder").replace("__DATA__", data)
open(out_path, "w").write(page)
print(f"{len(raw) / 1e6:.1f} MB data, page {len(page) / 1e6:.1f} MB")
