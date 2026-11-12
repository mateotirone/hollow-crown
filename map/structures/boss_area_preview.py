"""Each boss area on the real map, for review in 3D: the area stamp (boss_areas.py), the bosses' own plan run on the
real ground (boss_area_plans.mjs), the map's ground and water round it, and the town's blocks where it is in a town.

    python3 map/structures/boss_area_preview.py OUT [site ...]     -> OUT/<site>/scene.json (render/render.py) and
                                                                     OUT/page/ (index.html + data/ + tex.json, the
                                                                     hosted 3D page) when TEXTURES is set
Needs the map heights and water (area_ground.py) and, for the page, Mojang's bedrock-samples block textures
(env TEXTURES).
"""
import json, os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, "render"))
import boss_areas as BA, export_landmarks as X
from area_ground import Ground, HEIGHTS, WATER
ROOT = os.path.dirname(os.path.dirname(HERE))
REG = {"mother": ("grass_block", "mud"), "mirelight": ("grass_block", "mud"), "bride": ("gravel", "stone"), "huntsman": ("snow", "snow"),
       "seneschal": ("sand", "sand"), "reeve": ("grass_block", "dirt")}
TOWN = {"mirelight": "mirelight", "reeve": "millbrook"}


def scene(site, out, PAD=22):
    fn, title = BA.DESIGNS[site]; d = fn()
    bl = X.compute(d.spec())
    for c in d.airs(): bl[c] = ("air", {})
    plan = json.loads(subprocess.check_output(["node", os.path.join(HERE, "boss_area_plans.mjs"), HEIGHTS, WATER, site], stderr=subprocess.DEVNULL))
    cx, cy, cz = plan["center"]
    assert cy == d.meta["y0"], (cy, d.meta["y0"])
    G = Ground(cx, cz, cy)
    xs = [c[0] for c in bl]; zs = [c[2] for c in bl]
    x0, x1, z0, z1 = min(xs) - PAD, max(xs) + PAD, min(zs) - PAD, max(zs) + PAD
    pal, idx, cells = [], {}, {}
    def ix(n, p):
        k = json.dumps([n, p or {}], sort_keys=True)
        if k not in idx: idx[k] = len(pal); pal.append([n, p or {}])
        return idx[k]
    top_b, wet_b = REG[site]
    gmin = min(G.real(x, z) for x in range(x0, x1 + 1) for z in range(z0, z1 + 1))
    for x in range(x0, x1 + 1):
        for z in range(z0, z1 + 1):
            g = G.real(x, z); w = G.water(x, z)
            lo = min([g - 3] + [G.real(x + a, z + b) for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))])
            for y in range(lo, g + 1):
                cells[(x, y, z)] = ix(top_b if y == g and w is None else wet_b if y == g else "dirt" if site in ("mother", "mirelight") else top_b, {})
            if w is not None:
                cells[(x, w, z)] = ix("water", {})
    TOWN_ = TOWN.get(site)
    if TOWN_:
        tb = json.load(open(os.path.join(ROOT, "map", f"{TOWN_}-blocks.json")))
        for wx, wy, wz, i, *rest in tb["blocks"]:
            x, z = wx - cx, wz - cz
            if x0 <= x <= x1 and z0 <= z <= z1:
                n = tb["palette"][i]["name"].replace("minecraft:", "")
                if n == "air": cells.pop((x, wy - cy, z), None); continue
                if n.startswith("siege:"): continue
                st = tb["palette"][i].get("states") or {}
                p = {}
                if "pillar_axis" in st: p["axis"] = st["pillar_axis"]
                if "weirdo_direction" in st: p["facing"] = ["e", "w", "s", "n"][st["weirdo_direction"]]
                if st.get("upside_down_bit"): p["half"] = "top"
                if "minecraft:vertical_half" in st: p["half"] = st["minecraft:vertical_half"]
                cells[(x, wy - cy, z)] = ix(n, p)
    for (x, y, z), (n, p) in bl.items():
        if n == "air": cells.pop((x, y, z), None)
        elif n == "water" and (x, y + 1, z) in bl and bl[(x, y + 1, z)][0] == "water": continue
        else:
            p = dict(p); p.pop("bs", None)
            cells[(x, y, z)] = ix(n, p)
    for dx, dy, dz, b, st in plan["ops"]:
        c = (dx, dy, dz)
        if b == "air": cells.pop(c, None); continue
        p = {}
        if st:
            if "pillar_axis" in st: p["axis"] = st["pillar_axis"]
            if "weirdo_direction" in st: p["facing"] = ["e", "w", "s", "n"][st["weirdo_direction"]]
            if "facing_direction" in st: p["facing"] = {2: "n", 3: "s", 4: "w", 5: "e"}.get(st["facing_direction"], "n")
            if "hanging" in st: p["hanging"] = st["hanging"]
        cells[c] = ix(b.replace("siege:", "") if not b.startswith("siege:") else {"siege:root_cradle": "spruce_trapdoor", "siege:hunters_cairn": "chiseled_stone_bricks", "siege:hunt_cairn": "chiseled_stone_bricks", "siege:drowned_altar": "chiseled_stone_bricks", "siege:carved_floor": "chiseled_stone_bricks"}.get(b, "chiseled_stone_bricks"), p)
    ymin = min(c[1] for c in cells)
    blocks = [[x, y - ymin, z, i] for (x, y, z), i in cells.items()]
    os.makedirs(out, exist_ok=True)
    json.dump({"palette": pal, "blocks": blocks, "meta": {"site": site, "center": [cx, cy, cz], "ymin": ymin, "title": title}}, open(f"{out}/scene.json", "w"))
    print(site, len(blocks), "blocks")


def page(out, sites):
    from bp import Blueprint
    import build_3d_catalogue as C
    def from_scene(path, name):
        sc = json.load(open(path)); b = Blueprint(name)
        for x, y, z, i in sc["blocks"]:
            n, p = sc["palette"][i]
            b.set(x, y, z, n, **(p or {}))
        return b
    items = []
    for s in sites:
        m = json.load(open(os.path.join(out, s, "scene.json")))["meta"]
        items.append(({"id": "areas", "title": "Boss areas, built into the real map"},
                      {"key": s, "title": m["title"], "sub": f"at x {m['center'][0]}, z {m['center'][2]} on the map", "blurb": ""},
                      (lambda s=s: from_scene(os.path.join(out, s, "scene.json"), s)), ("grass_block", "dirt"), (-25, 28, 0.9)))
    C.write_viewer(items, os.path.join(out, "page"), os.environ["TEXTURES"])


if __name__ == "__main__":
    out = sys.argv[1]; sites = sys.argv[2:] or list(BA.DESIGNS)
    for s in sites: scene(s, os.path.join(out, s), 30 if s in TOWN else 22)
    if os.environ.get("TEXTURES"): page(out, sites)
