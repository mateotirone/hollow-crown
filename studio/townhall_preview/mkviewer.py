import json, base64, re
src = open("render.py").read()
COL = eval(re.search(r"COL = (\{.*?\})\ndef render", src, re.S).group(1))
plans = json.load(open("plans.json"))
names = sorted({c[3] for v in plans.values() for c in v})
def shape(b):
    if "carpet" in b or b == "snow_layer": return 1
    if b in ("lantern", "campfire", "siege:brazier"): return 2
    if "fence" in b or b in ("scaffolding", "iron_chain") or b.endswith("_wall") or b == "siege:battlement": return 3
    if b.endswith("_slab"): return 4
    if "glass_pane" in b: return 5
    if b == "siege:tree_of_oaths": return 6
    return 0
palette = [[*COL[n], shape(n), n.replace("siege:", "").replace("_", " ")] for n in names]
idx = {n: i for i, n in enumerate(names)}
data = {}
for k, cells in plans.items():
    buf = bytearray()
    for x, y, z, b in cells:
        buf += bytes([x + 32, y, z + 8, idx[b]])
    data[k] = base64.b64encode(bytes(buf)).decode()
html = open("viewer.tpl.html").read().replace("/*PALETTE*/", json.dumps(palette)).replace("/*DATA*/", json.dumps(data))
open("/mnt/project-files/siege-nights/art/townhall/hall-viewer.html", "w").write(html)
print(len(html))
