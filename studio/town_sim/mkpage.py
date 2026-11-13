"""Packs dump.mjs + mesh.py output into the Town Upgrade Simulator page.

    python3 studio/town_sim/mkpage.py SIM_JSON LIB_JSON OUT_HTML [PLOTS_DIR]

SIM_JSON/LIB_JSON is the plot the page opens on, packed into the page itself. With PLOTS_DIR (one folder per plot,
each holding dump.mjs's sim.json and mesh.py's lib.json), every plot there is also packed to plots/<id>.txt next to
the page, and the page gets a picker for them: publish those files alongside it.
"""
import base64, gzip, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sim_path, lib_path, out_path = sys.argv[1:4]
plots_dir = sys.argv[4] if len(sys.argv) > 4 else None


def pack(sim, lib):

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
    return raw, data


plots = []
if plots_dir:
    os.makedirs(os.path.join(os.path.dirname(out_path) or ".", "plots"), exist_ok=True)
    for pid in sorted(os.listdir(plots_dir)):
        d = os.path.join(plots_dir, pid)
        if not os.path.exists(os.path.join(d, "lib.json")): continue
        psim, plib = json.load(open(os.path.join(d, "sim.json"))), json.load(open(os.path.join(d, "lib.json")))
        plots.append({"id": pid, "name": psim["plot"], "region": psim.get("region"), "layout": psim.get("layout")})
        _, pdata = pack(psim, plib)
        open(os.path.join(os.path.dirname(out_path) or ".", "plots", pid + ".txt"), "w").write(pdata)
    print(f"{len(plots)} plots packed to plots/")
sim = json.load(open(sim_path))
raw, data = pack(sim, json.load(open(lib_path)))
tpl = open(os.path.join(HERE, "viewer.tpl.html")).read()
page = (tpl.replace("__TITLE__", "Town Builder" if plots else f"{sim['plot']} Town Builder").replace("__DATA__", data)
        .replace("__PLOTS__", json.dumps(plots)).replace("__HOME__", json.dumps(sim["plot"].lower())))
open(out_path, "w").write(page)
print(f"{len(raw) / 1e6:.1f} MB data, page {len(page) / 1e6:.1f} MB")
