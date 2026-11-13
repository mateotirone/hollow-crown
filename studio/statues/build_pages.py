"""The Faceless statues in 3D, for the builds page: each scene is the block plinths (Mojang's textures) with the
statue entities posed on them exactly as the game draws them (statue_mesh), in the builds page's mesh format.

    python3 studio/statues/build_pages.py TEXTURES OUT
        TEXTURES  bedrock-samples resource_pack/textures/blocks
        OUT       gets index.html (viewer3d template, these scenes only), data/statues.txt and tex.json;
                  index.json holds the scene entries to add to the main builds page's index
"""
import base64, gzip, json, os, sys, tempfile, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path[:0] = [HERE, os.path.join(REPO, "map/structures"), os.path.join(REPO, "map/structures/render")]
import statue_mesh as SM
import faceless_statues as FS
from build_3d_catalogue import _pack

YAW = {"s": 0, "w": 90, "n": 180, "e": -90}
SECTION = "Faceless statues (3D figures)"


def sand(cells, x0, x1, z0, z1, top="sand"):
    for x in range(x0, x1 + 1):
        for z in range(z0, z1 + 1):
            cells.setdefault((x, -1, z), (top, {}))


def scene_row(items, gap, half=2):
    """A row of statues on plinths, facing the viewer (south): items = [(age, hold, wear, size)]."""
    cells, figs = {}, []
    n = len(items)
    for i, (age, hold, wear, size) in enumerate(items):
        x = (i - (n - 1) / 2) * gap; x = round(x)
        if wear == "fallen":
            figs.append((age, hold, wear, size, 0, (x + 0.5, 0, 6.5)))   # lying on the sand, head to the north
            continue
        for (px, py, pz), v in FS.plinth_cells(half).items(): cells[(x + px, py, pz)] = v
        figs.append((age, hold, wear, size, 0, (x + 0.5, FS.PLINTH_H, 0.5)))
    w = round((n - 1) / 2 * gap) + half + 4
    sand(cells, -w, w, -half - 16, half + 8)
    return cells, figs


def scene_avenue():
    """Sunscar's avenue as the towns thread bakes it: the paved walk, the 32 plinths, the figures on them."""
    pts = FS.SUNSCAR_AVENUE; ox, oz = pts[0]
    cells = {}
    for (x, y, z), v in FS.avenue_cells(pts).items(): cells[(x - ox, y, z - oz)] = v
    for z in range(-3, 94):
        for x in range(-4, 5): cells.setdefault((x, -1, z), ("smooth_sandstone" if (x + z) % 4 else "cut_sandstone", {}))
    sand(cells, -14, 14, -3, 93)
    figs = [(s["age"], s["hold"], s["wear"], s["size"], YAW[s["face"]], (s["x"] - ox + 0.5, FS.PLINTH_H, s["z"] - oz + 0.5)) for s in FS.avenue_spots(pts)]
    return cells, figs


def seated_plinth(cells, cx, cz):
    """The great figure's three-tier stepped plinth (boss_landmarks.seneschal), top a slab layer at y 10."""
    import math
    for step, rr in enumerate((11.5, 10.5, 9.5)):
        n = int(rr) + 1
        for x in range(-n, n + 1):
            for z in range(-n, n + 1):
                if math.hypot(x, z) > rr: continue
                for y in range(step * 3, 3 + step * 3): cells[(cx + x, y, cz + z)] = (("smooth_red_sandstone", "cut_red_sandstone", "red_sandstone")[(x * 7 + z * 3 + y) % 3], {})
                if step == 2 and math.hypot(x, z) <= 8.5: cells[(cx + x, 9, cz + z)] = ("smooth_red_sandstone_slab", {"half": "bottom"})


def scene_seated():
    cells = {}
    seated_plinth(cells, 0, 0)
    sand(cells, -22, 22, -22, 26)
    return cells, [("seated", "folded", "whole", FS.SEATED_SIZE, 0, (0.5, 9.5, 0.5))]


def scene_gate():
    """The Faceless Gate's processional way: four on 9x9 plinths either side of it, four fallen along the sides."""
    ax, az = 850, 590
    cells = {}
    for z in range(2, 30):
        for x in range(-2, 3): cells[(x, -1, z)] = ("smooth_sandstone" if (x + z) % 3 else "cut_red_sandstone", {})
    for v, f, x, z in FS.AVENUE:
        for (px, py, pz), b in FS.plinth_cells(4).items(): cells[(x + px, py, z + pz)] = b
    seated_plinth(cells, 0, -26)
    sand(cells, -22, 22, -40, 40, "smooth_sandstone")
    figs = []
    for s in FS.gate_spots((ax, az)):
        y = s["rise"] - 0.5 if "rise" in s else FS.PLINTH_H if s["plinth"] else 0
        figs.append((s["age"], s["hold"], s["wear"], s["size"], YAW[s["face"]], (s["x"] - ax + 0.5, y, s["z"] - az + 0.5)))
    return cells, figs


SCENES = [
    ("statues-ages", "The five ages", "Boy, youth, young king, king, old king",
     "King Oswin at every age on the avenue's 5x5 plinths (size 5). The crown ring starts at the young king; the old king stoops and bows his head. Every face is blank quartz, and the hands are the same pale quartz on every one.",
     lambda: scene_row([("boy", "folded", "whole", 5), ("youth", "staff", "whole", 5), ("young_king", "sword", "whole", 5), ("king", "bowl", "whole", 5), ("old_king", "staff", "whole", 5)], 11),
     [-12, 14, 82, -4, 7, 0]),
    ("statues-holds", "What they hold", "Folded hands, staff, sword, bowl",
     "The four ways the hands go, on a king: folded on the chest, a tall staff, a sword point-down on the plinth, a bowl held out.",
     lambda: scene_row([("king", h, "whole", 5) for h in FS.HOLDS], 11),
     [-14, 14, 70, -3, 7, 0]),
    ("statues-broken", "Broken and fallen", "Headless, armless, stump, fallen",
     "About a third of the avenue is broken: the hood gone at the neck, the right arm gone at the shoulder, or snapped off at the knees with the pieces round the plinth. Four at the Gate have fallen on their backs, broken at the knees, half sunk in the sand.",
     lambda: scene_row([("king", "staff", "headless", 5), ("young_king", "sword", "armless", 5), ("king", "bowl", "stump", 5), ("old_king", "folded", "fallen", 5)], 13),
     [-24, 22, 74, -4, 4, 2]),
    ("statues-seated", "The great seated figure", "Behind the Faceless Gate",
     "The colossus over the vault: robed, on a stone throne, hands flat on his knees, a smooth pale head with no face at all under a striped headdress and a gold point. About 30 blocks tall (size 10) on the three-tier stepped plinth, which stays blocks.",
     scene_seated, [-28, 16, 95, 0.5, 15, 0]),
    ("statues-avenue", "Sunscar's statue avenue", "32 statues, boy to old king",
     "The road from Sunscar's square south to the Faceless Gate: 32 plinths 5 to 9 blocks out from the centreline, the figures facing the walk and ageing as you go. The map bakes the plinths; the game stands the figures on them.",
     scene_avenue, [-35, 28, 120, 0.5, 4, 46]),
    ("statues-gate", "The Faceless Gate's statues", "Four standing, four fallen, the seated figure",
     "The Gate's own eight (with the avenue's 32 they make forty): old kings about 20 blocks tall (size 7.3) on 9x9 plinths either side of the processional way, one headless, and four fallen along the precinct's sides. The great seated figure looks down the way from its stepped plinth at the north end (the gate's pylons are left out here).",
     scene_gate, [32, 24, 130, 0.5, 10, -4]),
]


def mesh_scene(cells, figs, texdir):
    from mesher import Mesher
    m = Mesher(cells, texdir).run()
    tmp = tempfile.mkdtemp(); names = m.textures(tmp)
    tex = {k: "data:image/png;base64," + base64.b64encode(open(os.path.join(tmp, f), "rb").read()).decode() for k, f in names.items()}
    shutil.rmtree(tmp)
    out = dict(m.out)
    pts = [k for k in cells]
    lo = [min(p[i] for p in pts) for i in range(3)]; hi = [max(p[i] for p in pts) + 1 for i in range(3)]
    for age, hold, wear, size, yaw, at in figs:
        key = f"faceless_statue_{age}"
        if key not in tex:
            png = os.path.join(REPO, f"Siege_Nights_RP/textures/entity/statues/{key}.png")
            tex[key] = "data:image/png;base64," + base64.b64encode(open(png, "rb").read()).decode()
        mm = out.setdefault(key, {"p": [], "n": [], "uv": [], "c": [], "cut": 0, "water": 0, "glow": 0})
        for P, uv, n in SM.quads(age, hold, wear, size, yaw, at):
            for (x, y, z), (u, v) in zip(P, uv):
                mm["p"] += [x, y, z]; mm["n"] += n; mm["uv"] += [u, 1 - v]; mm["c"].append(1.0)
                for i, q in enumerate((x, y, z)): lo[i] = min(lo[i], q); hi[i] = max(hi[i], q)
    return {k: _pack(v) for k, v in out.items()}, [round(q, 2) for q in lo + hi], tex


def build(texdir, outdir):
    os.makedirs(os.path.join(outdir, "data"), exist_ok=True)
    index, tex, buf = [], {}, bytearray()
    for key, title, sub, blurb, make, view in SCENES:
        cells, figs = make()
        meshes, bounds, t = mesh_scene(cells, figs, texdir)
        tex.update(t)
        raw = gzip.compress(json.dumps({"meshes": meshes, "bounds": bounds, "camera": {"views": {"card": view}}}, separators=(",", ":")).encode(), 9)
        size = [round(bounds[3] - bounds[0]), round(bounds[4] - bounds[1]), round(bounds[5] - bounds[2])]
        index.append({"key": key, "bundle": "statues", "section": SECTION, "group": "", "title": title, "sub": sub, "blurb": blurb,
                      "size": size, "blocks": len(cells), "at": [len(buf), len(raw)], "from": "faceless statues", "fresh": True})
        buf += raw
        print("scene", key, len(figs), "figures", len(cells), "blocks")
    open(os.path.join(outdir, "data", "statues.txt"), "w").write(base64.b64encode(bytes(buf)).decode())
    json.dump(tex, open(os.path.join(outdir, "tex.json"), "w"), separators=(",", ":"))
    json.dump(index, open(os.path.join(outdir, "index.json"), "w"), indent=1)
    tpl = open(os.path.join(REPO, "map/structures/render/viewer3d.tpl.html")).read()
    open(os.path.join(outdir, "index.html"), "w").write(tpl.replace("__INDEX__", json.dumps(index, separators=(",", ":"))))


if __name__ == "__main__":
    build(sys.argv[1], sys.argv[2])
