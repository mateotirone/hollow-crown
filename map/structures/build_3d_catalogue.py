"""The 3D building catalogue: every catalogue build, turnable in the browser.

    python3 build_full_catalogue.py WORK/settle.json OUT --textures T --three x --viewer3d DIR

DIR gets index.html (render/viewer3d.tpl.html), data/<section>.txt (base64) (each build's meshes as a gzipped JSON slice; a section loads when one of its builds is picked)
and tex.json (every texture once, as data URIs). Publish index.html with data/ and tex.json as files.
"""
import os, json, base64, tempfile, shutil, gzip
from array import array
from concurrent.futures import ProcessPoolExecutor
HERE = os.path.dirname(os.path.abspath(__file__))

def _b64(typecode, vals):
    return base64.b64encode(array(typecode, vals).tobytes()).decode()

def _pack(v):
    """One mesh as little typed arrays in base64: positions and uvs in 1/64 steps (int16), normals x100
    (int8), shade 0-255 (uint8). About a fifth of the plain JSON numbers."""
    return {"p": _b64("h", [round(x * 64) for x in v["p"]]), "uv": _b64("h", [round(x * 64) for x in v["uv"]]),
            "n": _b64("b", [round(x * 100) for x in v["n"]]), "c": _b64("B", [min(255, max(0, round(x * 255))) for x in v["c"]]),
            "cut": v.get("cut", 0), "water": v.get("water", 0), "glow": v.get("glow", 0)}

def _mesh(job):
    key, sc, textures = job
    from mesher import Mesher
    cells = {k: v for k, v in sc.cells.items() if v[0] != "keep"}
    m = Mesher(cells, textures).run()
    tmp = tempfile.mkdtemp()
    names = m.textures(tmp)
    tex = {k: "data:image/png;base64," + base64.b64encode(open(os.path.join(tmp, f), "rb").read()).decode() for k, f in names.items()}
    shutil.rmtree(tmp)
    meshes = {k: _pack(v) for k, v in m.out.items()}
    xs, ys, zs = zip(*cells)
    return key, meshes, [min(xs), min(ys), min(zs), max(xs) + 1, max(ys) + 1, max(zs) + 1], tex

def write_viewer(items, out, textures):
    from build_full_catalogue import card_scene
    os.makedirs(os.path.join(out, "data"), exist_ok=True)
    index, jobs, cams = [], [], {}
    for sec, card, make, ground, view in items:
        sc, size, n = card_scene(make(), ground, view=view)
        cams[card["key"]] = sc.camera
        group = card.get("group") or ""
        index.append({"key": card["key"], "bundle": sec["id"], "section": sec["title"], "group": group, "title": card["title"], "sub": card.get("sub", ""),
                      "blurb": card.get("blurb", ""), "size": size, "blocks": n,
                      **{k: card[k] for k in ("levels", "attic", "cut") if k in card}})   # floors to cut at, for looking inside
        jobs.append((card["key"], sc, textures))
    tex, bundles, at = {}, {}, {b["key"]: b for b in index}
    with ProcessPoolExecutor(4) as ex:
        for key, meshes, bounds, t in ex.map(_mesh, jobs, chunksize=2):
            tex.update(t)
            raw = gzip.compress(json.dumps({"meshes": meshes, "bounds": bounds, "camera": cams[key]}, separators=(",", ":")).encode(), 9)
            b = at[key]; buf = bundles.setdefault(b["bundle"], bytearray())
            b["at"] = [len(buf), len(raw)]; buf += raw   # each build is its own gzip member inside its section's bundle
            print("meshed", key, flush=True)
    for name, buf in bundles.items():   # base64 text: artifact hosting serves text, not raw binary
        open(os.path.join(out, "data", name + ".txt"), "w").write(base64.b64encode(bytes(buf)).decode())
    json.dump(tex, open(os.path.join(out, "tex.json"), "w"), separators=(",", ":"))
    html = open(os.path.join(HERE, "render", "viewer3d.tpl.html")).read().replace("__INDEX__", json.dumps(index, separators=(",", ":")))
    open(os.path.join(out, "index.html"), "w").write(html)
    total = sum(os.path.getsize(os.path.join(out, "data", f)) for f in os.listdir(os.path.join(out, "data")))
    print(len(index), "builds,", round(total / 1e6, 1), "MB of meshes,", len(tex), "textures")
