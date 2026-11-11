"""Turn preview scenes (Blueprint.save_logical JSON) into one section of the 3D building catalogue.

    python3 mesh_scenes.py KIT_DIR TEXTURES OUT_DIR SECTION_ID "Section title" scenes.json

KIT_DIR is a branch's map/structures (its mesher and catalogue packer are used, so the result matches that
branch's viewer). scenes.json is [{"key", "title", "sub", "blurb", "scene"}]. Writes OUT_DIR/data/<SECTION_ID>.txt,
OUT_DIR/tex.json and OUT_DIR/index.json in the same format build_3d_catalogue.py writes.
"""
import base64, gzip, json, os, shutil, sys, tempfile

kit, textures, out, sec_id, sec_title, listing = sys.argv[1:7]
sys.path.insert(0, kit); sys.path.insert(0, os.path.join(kit, "render"))
from mesher import Mesher
from build_3d_catalogue import _pack

os.makedirs(os.path.join(out, "data"), exist_ok=True)
index, tex, buf = [], {}, bytearray()
for item in json.load(open(listing)):
    d = json.load(open(item["scene"]))
    cells = {(x, y, z): tuple(d["palette"][i]) for x, y, z, i in d["blocks"]}
    if not cells: continue
    m = Mesher(cells, textures).run()
    tmp = tempfile.mkdtemp()
    for k, f in m.textures(tmp).items():
        tex[k] = "data:image/png;base64," + base64.b64encode(open(os.path.join(tmp, f), "rb").read()).decode()
    shutil.rmtree(tmp)
    xs, ys, zs = zip(*cells)
    lo, hi = [min(xs), min(ys), min(zs)], [max(xs) + 1, max(ys) + 1, max(zs) + 1]
    w, h, dd = hi[0] - lo[0], hi[1] - max(0, lo[1]), hi[2] - lo[2]
    tgt = [(lo[0] + hi[0]) / 2, max(2, h * 0.42), (lo[2] + hi[2]) / 2]
    camera = d.get("camera") or {"views": {"card": [-38, 22, max((max(w, dd) + 2) * 1.25, h * 2.4)] + tgt}}
    raw = gzip.compress(json.dumps({"meshes": {k: _pack(v) for k, v in m.out.items()}, "bounds": lo + hi, "camera": camera}, separators=(",", ":")).encode(), 9)
    index.append({"key": item["key"], "bundle": sec_id, "section": sec_title, "group": item.get("group", ""), "title": item["title"],
                  "sub": item.get("sub", ""), "blurb": item.get("blurb", ""), "size": [w, h, dd],
                  "blocks": sum(1 for v in cells.values() if v[0] not in ("air", "grass_block")), "at": [len(buf), len(raw)]})
    buf += raw
    print("meshed", item["key"], flush=True)
open(os.path.join(out, "data", sec_id + ".txt"), "w").write(base64.b64encode(bytes(buf)).decode())
json.dump(tex, open(os.path.join(out, "tex.json"), "w"), separators=(",", ":"))
json.dump(index, open(os.path.join(out, "index.json"), "w"))
print(len(index), "scenes")
