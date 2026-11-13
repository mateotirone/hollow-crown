"""Real block shapes and Mojang textures for the Town Upgrade Simulator, from the 3D catalogue's own mesher.

    python3 studio/town_sim/mesh.py SIM_JSON TEXTURES_DIR OUT_JSON

SIM_JSON is dump.mjs's output; TEXTURES_DIR is bedrock-samples' resource_pack/textures/blocks (the asset viewer
downloads it to .asset-viewer/). Every palette entry (Bedrock id + states) is turned back into the builder's
logical block, meshed on its own by map/structures/render/mesher.py (so stairs, slabs, fences, doors, lanterns,
plants and the add-on's own blocks have the shapes the catalogue gives them), and written as quads the page
joins into chunks. Fences, walls and panes get all 16 joins (the page picks one from the neighbours).
The town's trees (layout fixtures) and the forest round the plot are grown by map/trees/grow.py.
"""
import base64, io, json, math, os, random, sys, tempfile, shutil
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "map", "structures"))
sys.path.insert(0, os.path.join(ROOT, "map", "structures", "render"))
sys.path.insert(0, os.path.join(ROOT, "map", "trees"))
import mesher as _mesher  # noqa: E402
from mesher import Mesher, opaque_cube, cull_group  # noqa: E402
# a few Bedrock texture names the catalogue's builds never needed
_mesher.TEX_ALIAS.update({"bricks": "brick", "stonecutter": "stonecutter2_side", "water_cauldron": "cauldron_side"})
from bp import is_fence, is_wall, is_pane, BEDROCK_ALIAS  # noqa: E402

sim_path, texdir, out_path = sys.argv[1:4]
sim = json.load(open(sim_path))

# ---------- Bedrock id + states -> the builder's logical block (bp.py to_bedrock, run backwards) ----------
UNALIAS = {v[0]: k for k, v in BEDROCK_ALIAS.items()}
UNALIAS.update({"wooden_door": "oak_door", "trapdoor": "oak_trapdoor", "spruce_log_log": "spruce_log", "stonecutter_block": "stonecutter",
                "brick_block": "bricks", "iron_chain": "chain", "darkoak_wall_sign": "dark_oak_wall_sign"})
WEIRDO = ["e", "w", "s", "n"]
CARD = {"north": "n", "south": "s", "east": "e", "west": "w"}


def logical(bid, st):
    if bid == "siege:track":
        return ("siege:track_preview", {"kind": st.get("siege:kind", 0), "dir": st.get("siege:dir", 0)})
    if bid.startswith("siege:"):
        p = {}
        if "minecraft:cardinal_direction" in st: p["facing"] = CARD[st["minecraft:cardinal_direction"]]
        if "minecraft:vertical_half" in st: p["half"] = st["minecraft:vertical_half"]
        return (bid, p)
    n = bid[10:] if bid.startswith("minecraft:") else bid
    n = UNALIAS.get(n, n)
    p = {}
    if "weirdo_direction" in st: p["facing"] = WEIRDO[st["weirdo_direction"]]
    if st.get("upside_down_bit"): p["half"] = "top"
    if "minecraft:vertical_half" in st: p["half"] = st["minecraft:vertical_half"]
    if "pillar_axis" in st: p["axis"] = st["pillar_axis"]
    if n.endswith("trapdoor"):
        p["facing"] = WEIRDO[st.get("direction", 3)]
        if st.get("open_bit"): p["open"] = True
    if n.endswith("_door"):
        p["facing"] = CARD.get(st.get("minecraft:cardinal_direction", "south"), "s")
        if st.get("upper_block_bit"): p["upper"] = True
        if st.get("door_hinge_bit"): p["hinge"] = True
        if st.get("open_bit"): p["open"] = True
    elif "minecraft:cardinal_direction" in st: p["facing"] = CARD[st["minecraft:cardinal_direction"]]
    if "hanging" in st: p["hanging"] = bool(st["hanging"])
    if n == "bed":
        p["facing"] = ["s", "w", "n", "e"][st.get("direction", 0)]
        if st.get("head_piece_bit"): p["head"] = True
    if "facing_direction" in st and (n.endswith("wall_sign") or n == "ladder"):
        p["facing"] = {2: "n", 3: "s", 4: "w", 5: "e"}.get(st["facing_direction"], "n")
    if n in ("wheat", "carrots", "potatoes", "beetroot"): p["age"] = st.get("growth", 7)
    return (n, p)


# ---------- the town's trees and the forest round it (the tree thread's grower) ----------
from species import CARDS  # noqa: E402
from grow import grow  # noqa: E402
palette = [logical(b, s) for b, s in sim["palette"]]
names = [b for b, s in sim["palette"]]
soft = list(sim["soft"])
pindex = {json.dumps(v, sort_keys=True): i for i, v in enumerate(palette)}


def pid(cell):
    k = json.dumps(cell, sort_keys=True)
    if k not in pindex:
        pindex[k] = len(palette); palette.append(cell); names.append(cell[0])
        soft.append(1 if any(w in cell[0] for w in ("leaves", "sapling", "flower", "grass", "fern", "vine", "bush", "azalea")) else 0)
    return pindex[k]


grown = {}
def tree_cells(species, size, seed):
    key = (species, size, seed)
    if key not in grown:
        card = CARDS.get(species) or CARDS["vale_great_oak"]
        try: bp = grow(card, size, seed)
        except Exception as e:
            print("tree", species, size, e); bp = None
        grown[key] = [] if bp is None else [(x, y, z, pid([n if not n.startswith("minecraft:") else n[10:], p]))
                                            for (x, y, z), (n, p) in sorted(bp.cells.items(), key=lambda c: (c[0][1], c[0][0], c[0][2])) if n not in ("air", "keep")]
    return grown[key]


cx, cz = sim["center"]
g = sim["ground"]; G = np.array(g["h"], dtype=np.int32).reshape(g["n"], g["n"])
def ground_y(x, z):  # x, z from the Plot Stone
    i, j = x - g["x0"], z - g["z0"]
    return int(G[max(0, min(g["n"] - 1, i)), max(0, min(g["n"] - 1, j))])

tree_ops = []
for t in sim["trees"]:
    gy = t["y"] - 1
    ops = [[0, t["x"] + x, gy + y, t["z"] + z, p] for x, y, z, p in tree_cells(t["species"], t["size"], hash((t["x"], t["z"])) & 0xffff)]
    tree_ops.append({"tier": t["tier"], "at": [t["x"], t["z"]], "species": t["species"], "size": t["size"], "ops": ops})

# The forest outside the plot's land (radius 74 is the map's flat ward), thinned by the map's forest density
forest = []
try:
    T = np.load("/mnt/project-files/siege-nights/map/terrain.npz")
    H, Nn = int(T["H"]), int(T["N"]); F = T["forest"]
    def density(x, z):
        i = int((x + cx + H) / (2 * H) * Nn); j = int((z + cz + H) / (2 * H) * Nn)
        return float(F[min(Nn - 1, max(0, i)), min(Nn - 1, max(0, j))])
except Exception as e:
    print("no forest map:", e); density = lambda x, z: 0.15
rnd = random.Random(7)
kinds = [("vale_great_oak", 0.45), ("vale_ash", 0.25), ("vale_silver_birch", 0.2), ("vale_hawthorn", 0.1)]
taken = []
half = sim["half"]
st = sim.get("station") or {"origin": [9999, 0, 9999]}
track = [(op[1], op[3]) for op in sim["initial"] if op[0] == 0]
for _ in range(2600):
    x, z = rnd.randint(-half + 4, half - 4), rnd.randint(-half + 4, half - 4)
    r = math.hypot(x, z)
    if r < 82: continue
    if abs(x - st["origin"][0]) < 30 and abs(z - st["origin"][2]) < 26: continue
    if min((abs(x - a) + abs(z - b) for a, b in track), default=99) < 7: continue
    d = density(x, z)
    if rnd.random() > 0.25 + 1.6 * d: continue
    if any((x - a) ** 2 + (z - b) ** 2 < s * s for a, b, s in taken): continue
    roll, acc, species = rnd.random(), 0, kinds[0][0]
    for k, w in kinds:
        acc += w
        if roll <= acc: species = k; break
    size = rnd.choice(["young", "mature", "mature", "ancient"] if species != "vale_hawthorn" else ["young", "mature"])
    space = {"sapling": 4, "young": 6, "mature": 9, "ancient": 12}[size]
    taken.append((x, z, space))
    gy = ground_y(x, z)
    forest.append([[0, x + a, gy + y, z + b, p] for a, y, b, p in tree_cells(species, size, rnd.randint(0, 5))])
    if len(forest) >= 90: break
print(len(tree_ops), "town trees,", len(forest), "forest trees,", len(grown), "grown kinds")

# ---------- a model per palette entry ----------
CULL = {(1, 0, 0): 1, (-1, 0, 0): 2, (0, 1, 0): 3, (0, -1, 0): 4, (0, 0, 1): 5, (0, 0, -1): 6}
texkeys, tex_spec = {}, {}
FACE_PLANE = {1: (0, 1), 2: (0, 0), 3: (1, 1), 4: (1, 0), 5: (2, 1), 6: (2, 0)}


def model(cell):
    m = Mesher({(0, 0, 0): tuple(cell)}, texdir).run()
    quads = []
    for key, v in m.out.items():
        if key not in texkeys: texkeys[key] = len(texkeys); tex_spec[key] = m.texfiles[key]
        flags = (1 if v["cut"] else 0) | (2 if v["water"] else 0) | (4 if v["glow"] else 0)
        P, UV, Nr = v["p"], v["uv"], v["n"]
        for q in range(len(P) // 12):
            pts = [P[q * 12 + k * 3: q * 12 + k * 3 + 3] for k in range(4)]
            uvs = [UV[q * 8 + k * 2: q * 8 + k * 2 + 2] for k in range(4)]
            nrm = tuple(int(round(c)) for c in Nr[q * 12: q * 12 + 3])
            cull = CULL.get(nrm, 0)
            if cull:
                ax, side = FACE_PLANE[cull]
                if not all(abs(p[ax] - side) < 1e-4 for p in pts): cull = 0
            quads.append([texkeys[key], cull, flags, [c for p, t in zip(pts, uvs) for c in (*p, *t)]])
    return quads


def conn_variants(n, p):
    out = []
    for bits in range(16):
        c = {"n": bool(bits & 1), "s": bool(bits & 2), "e": bool(bits & 4), "w": bool(bits & 8)}
        for post in ((True, False) if is_wall(n) else (True,)):
            q = dict(p); q["conn"] = c
            if is_wall(n): q["post"] = post
            out.append(model((n, q)))
    return out


models, joins, full = [], {}, []
for i, cell in enumerate(palette):
    n, p = cell
    if i == 0: models.append([]); full.append(0); continue
    if n in ("air", "keep"): models.append([]); full.append(0); continue
    try:
        models.append(model(cell))
    except Exception as e:
        print("model failed", cell, e); models.append(model(("stone", {})))
    full.append(1 if opaque_cube(tuple(cell)) else 0)
    if is_fence(n) or is_wall(n) or is_pane(n): joins[i] = {"kind": "wall" if is_wall(n) else "pane" if is_pane(n) else "fence", "m": conn_variants(n, p)}
groups = [cull_group(c[0]) or "" for c in palette]

# ---------- the texture atlas (18 px tiles: a 16 px texture with a copied 1 px edge, so nothing bleeds) ----------
tmp = tempfile.mkdtemp()
probe = Mesher({}, texdir); probe.texfiles = dict(tex_spec)
files = probe.textures(tmp)
n = len(texkeys); cols = 32; rows = math.ceil(n / cols); TS = 18
atlas = Image.new("RGBA", (cols * TS, rows * TS), (0, 0, 0, 0))
rects = [None] * n
for key, k in texkeys.items():
    im = Image.open(os.path.join(tmp, files[key])).convert("RGBA")
    tile = Image.new("RGBA", (TS, TS)); tile.paste(im.resize((TS, TS), Image.NEAREST), (0, 0)); tile.paste(im, (1, 1))
    cx_, cy_ = (k % cols) * TS, (k // cols) * TS
    atlas.paste(tile, (cx_, cy_))
    rects[k] = [cx_ + 1, cy_ + 1]
shutil.rmtree(tmp)
buf = io.BytesIO(); atlas.save(buf, "PNG", optimize=True)
avg = []
for k in range(n):
    x0, y0 = rects[k]; px = np.asarray(atlas.crop((x0, y0, x0 + 16, y0 + 16))).reshape(-1, 4).astype(float)
    a = px[:, 3] > 20
    avg.append([int(v) for v in (px[a, :3].mean(0) if a.any() else [128, 128, 128])])

json.dump({
    "palette": palette, "names": names, "soft": soft, "models": models, "joins": joins, "full": full, "groups": groups,
    "atlas": "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode(), "atlasSize": [cols * TS, rows * TS], "rects": rects, "avg": avg,
    "treeOps": tree_ops, "forest": forest,
}, open(out_path, "w"), separators=(",", ":"))
print(len(palette), "blocks,", n, "textures, atlas", cols * TS, "x", rows * TS, ",", round(os.path.getsize(out_path) / 1e6, 1), "MB")
