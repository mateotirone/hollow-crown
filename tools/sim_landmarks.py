#!/usr/bin/env python3
"""Check the world's story landmarks in 3D before anyone walks up to them.

The landmarks (Siege_Nights_BP/scripts/landmarks/sites.js: Crownhold, Bellhollow, the Ashen Gate chapterhouse, the
role homes, the plot relics ...) are built by the game the first time a player comes near. This reads the ground
out of a generated world the way the game does (landmarks/index.js groundY / waterY), plans every piece with the
game's own planner (tools/sim_landmarks.mjs), lays it over the real blocks and reports:
  - blocks of the landmark (or of the ground it cut) that float, joined by no face or edge to anything that reaches the ground
  - pieces that could not be placed
and writes one scene per site for map/structures/render/render.py (real terrain round it, same view as in game).

  amv/bin/python tools/sim_landmarks.py WORLD OUT [site ...] [--heights WORLD-heights.npy]
Needs Amulet (genworld's venv). OUT gets <site>.scene.json and report.json.
"""
import json, os, re, subprocess, sys
from collections import deque
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
args = [a for a in sys.argv[1:] if not a.startswith("--")]
opts = dict(a[2:].split("=", 1) for a in sys.argv[1:] if a.startswith("--") and "=" in a)
WORLD, OUT, ONLY = args[0], args[1], args[2:]
os.makedirs(OUT, exist_ok=True)

import amulet  # noqa: E402
level = amulet.load_level(WORLD)
DIM = "minecraft:overworld"
tr = level.translation_manager.get_version("bedrock", (1, 21, 0))

SOFT = re.compile(r"leaves|grass(?!_block)|fern|flower|tulip|poppy|dandelion|bush|snow_layer|log|vine|sapling|mushroom|azalea|dead_bush|torch|reeds|sugar_cane|kelp|seagrass|lily|wood|fence")
BRANCH = re.compile(r"_wall|stairs|slab|trapdoor")
_bed = {}


def bedrock(block):
    """Universal block -> (bedrock name without namespace, {state: value})"""
    k = block.blockstate
    if k not in _bed:
        try:
            b = tr.block.from_universal(block)[0]
            _bed[k] = (b.base_name, {p: getattr(v, "py_data", v) for p, v in b.properties.items()})
        except Exception:
            _bed[k] = (block.base_name, {})
    return _bed[k]


_chunks = {}


def chunk(cx, cz):
    if (cx, cz) not in _chunks:
        try:
            _chunks[(cx, cz)] = level.get_chunk(cx, cz, DIM)
        except Exception:
            _chunks[(cx, cz)] = None
    return _chunks[(cx, cz)]


def column(x, z, y0, y1):
    """[(y, name, states)] from y1 down to y0"""
    c = chunk(x >> 4, z >> 4)
    out = []
    if c is None: return out
    ids = np.asarray(c.blocks[x & 15, y0:y1 + 1, z & 15]).ravel()
    for y in range(y1, y0 - 1, -1):
        out.append((y, *bedrock(c.block_palette[int(ids[y - y0])])))
    return out


H = np.load(opts.get("heights", WORLD.rstrip("/") + "-heights.npy"))
O = -1264
need = json.loads(subprocess.check_output(["node", os.path.join(HERE, "sim_landmarks.mjs"), "need", *ONLY], cwd=ROOT))

# 1. read the ground round every piece, the way landmarks/index.js does
probe, cols = {}, {}
for b in need:
    xs, zs = range(b["x0"], b["x0"] + b["nx"]), range(b["z0"], b["z0"] + b["nz"])
    hh = H[b["x0"] - O:b["x0"] - O + b["nx"], b["z0"] - O:b["z0"] - O + b["nz"]]
    y0, y1 = int(hh.min()) - 24, int(hh.max()) + 70
    ground, water, top = [], [], []
    for x in xs:
        for z in zs:
            col = cols.get((x, z))
            if col is None or col[0][0] < y1 or col[-1][0] > y0:
                col = cols[(x, z)] = column(x, z, y0, y1)
            g = w = t = None
            first = next((c for c in col if c[1] != "air"), None)
            if first is not None:
                if "water" in first[1]: w = first[0]
                rest = col[col.index(first):]
                for i, (y, n, st) in enumerate(rest[:48]):
                    if n == "air" or "water" in n or "lava" in n or SOFT.search(n): continue
                    if BRANCH.search(n):   # a tree branch (wall/stairs/slab/trapdoor with nothing firm under it)
                        un = rest[i + 1][1] if i + 1 < len(rest) else "air"
                        if un == "air" or "water" in un or "lava" in un or SOFT.search(un) or BRANCH.search(un): continue
                    g, t = y, ["minecraft:" + n, st]; break
            ground.append(g); water.append(w); top.append(t)
    probe[b["key"]] = {"x0": b["x0"], "z0": b["z0"], "nx": b["nx"], "nz": b["nz"], "ground": ground, "water": water, "top": top}
pp = os.path.join(OUT, "probe.json")
json.dump(probe, open(pp, "w"))
plans = json.loads(subprocess.run(["node", os.path.join(HERE, "sim_landmarks.mjs"), "plan", pp, *ONLY], cwd=ROOT, capture_output=True, check=True).stdout)

# 2. lay each site over the real blocks and look for what floats
HANG = re.compile(r"lantern|chain|torch|sign|banner|button|ladder|vine|frame|trapdoor|bell")
LOOSE = re.compile(r"^(air|water|flowing_water|lava|.*_leaves|short_grass|tall_grass|fern|large_fern|snow_layer|deadbush|dead_bush|.*flower.*|poppy|dandelion|.*tulip|azure_bluet|allium|oxeye_daisy|cornflower|lily_of_the_valley|sweet_berry_bush|seagrass|kelp)$")


def logical(n, st):
    p = {}
    if "weirdo_direction" in st: p["facing"] = ["e", "w", "s", "n"][st["weirdo_direction"]]
    if st.get("upside_down_bit"): p["half"] = "top"
    if "minecraft:vertical_half" in st: p["half"] = st["minecraft:vertical_half"]
    if "pillar_axis" in st: p["axis"] = st["pillar_axis"]
    if "direction" in st and n.endswith("trapdoor"): p["facing"] = ["e", "w", "s", "n"][st["direction"]]
    if "open_bit" in st: p["open"] = bool(st["open_bit"])
    if "hanging" in st: p["hanging"] = bool(st["hanging"])
    if "facing_direction" in st: p["facing"] = {2: "n", 3: "s", 4: "w", 5: "e"}.get(st["facing_direction"], "n")
    if "minecraft:cardinal_direction" in st: p["facing"] = st["minecraft:cardinal_direction"][0]
    return n, p


TREE = re.compile(r"^old_|_log$|_wood$|leaves|^vine$|hanging_roots|pale_hanging_moss|mangrove_roots|propagule|bee_nest|cocoa")
BRANCHB = re.compile(r"^(oak|spruce|birch|jungle|acacia|dark_oak|mangrove|cherry|pale_oak)_(fence|stairs|slab|trapdoor)$|^(tuff|cobbled_deepslate|diorite|mud_brick|polished_blackstone)_wall$|^(tuff|diorite|polished_diorite|mud_brick|polished_blackstone)_stairs$|^(moss_carpet|pale_moss_carpet|trapdoor|cobblestone_wall)$")   # cobblestone_wall: how Amulet reads the old walls
LIGHT = re.compile(r"snow_layer|short_grass|tall_grass|fern|flower|tulip|poppy|dandelion|bluet|allium|daisy|cornflower|lily_of_the_valley|leaf_litter|sweet_berry")
N18 = [(a, b, e) for a in (-1, 0, 1) for b in (-1, 0, 1) for e in (-1, 0, 1) if 0 < abs(a) + abs(b) + abs(e) < 3]
report = {}
for sid, pieces in plans.items():
    ops = [o for p in pieces for o in p.get("ops", [])]
    rep = {"pieces": [{k: p.get(k) for k in ("k", "d", "x", "z", "G", "missing")} for p in pieces]}
    if not ops:
        report[sid] = rep; continue
    xs = [o[0] for o in ops]; zs = [o[2] for o in ops]; ys = [o[1] for o in ops]
    x0, x1, z0, z1 = min(xs) - 30, max(xs) + 30, min(zs) - 30, max(zs) + 30
    lowest = int(H[x0 - O:x1 - O + 1, z0 - O:z1 - O + 1].min())   # the land round it can lie well below the site
    yb0, yb1 = min(min(ys), lowest) - 6, max(ys) + 34
    cells = {}
    for x in range(x0, x1 + 1):
        for z in range(z0, z1 + 1):
            for y, n, st in column(x, z, yb0, yb1):
                if n != "air": cells[(x, y, z)] = (n, st)
    # what the game does first (core/clearing.js clearTrees): every tree block round it and over it goes, then what is
    # left of the trees it cut (tree and branch blocks within 8 more, grouped by face or edge) that holds to nothing
    cx0, cx1, cz0, cz1, cy0, cy1 = min(xs) - 8, max(xs) + 8, min(zs) - 8, max(zs) + 8, min(ys) - 4, max(ys) + 32
    inclear = lambda c: cx0 <= c[0] <= cx1 and cz0 <= c[2] <= cz1 and cy0 <= c[1] <= cy1
    inring = lambda c: cx0 - 8 <= c[0] <= cx1 + 8 and cz0 - 8 <= c[2] <= cz1 + 8 and cy0 <= c[1] <= cy1
    for c in [c for c, (n, _) in cells.items() if inclear(c) and TREE.search(n)]: del cells[c]
    part = lambda c: c in cells and (TREE.search(cells[c][0]) or BRANCHB.match(cells[c][0]))
    inbox = lambda k: x0 <= k[0] <= x1 and z0 <= k[2] <= z1 and yb0 <= k[1] <= yb1
    def remnants():   # core/clearing.js looseGroups: seeds in the ring, each group followed as far as its tree goes
        seen, keep = set(), set()
        for s0 in [c for c in cells if inring(c) and part(c)]:
            if s0 in seen: continue
            grp, held = [s0], False; seen.add(s0)
            i = 0
            while i < len(grp) and not held and len(grp) <= 20000:
                c = grp[i]; i += 1
                for d in N18:
                    k = (c[0] + d[0], c[1] + d[1], c[2] + d[2])
                    if k in seen:
                        if k in keep: held = True
                        continue
                    if not inbox(k): held = True
                    elif part(k): seen.add(k); grp.append(k)
                    elif k in cells and "water" not in cells[k][0] and "lava" not in cells[k][0] and not LIGHT.search(cells[k][0]): held = True
            if held or len(grp) > 20000: keep.update(grp)
            else:
                for c in grp:
                    cells.pop(c, None); mine.discard(c)
                    u = (c[0], c[1] + 1, c[2])
                    if u in cells and LIGHT.search(cells[u][0]): cells.pop(u)
    mine = set()
    remnants()
    for x, y, z, n, st in ops:
        n = n.replace("minecraft:", "")
        if n == "air": cells.pop((x, y, z), None); mine.discard((x, y, z))
        else: cells[(x, y, z)] = (n, st); mine.add((x, y, z))
    remnants()   # landmarks/index.js: again once it stands (a tree on ground it paved or cut away)
    # grounded: reachable (by a face or an edge, so a stair roof stepping down holds) from the bottom layer through anything solid-ish; water holds nothing
    holds = lambda c: c in cells and "water" not in cells[c][0] and "lava" not in cells[c][0]
    seen = set(c for c in cells if (c[1] == yb0 or c[0] in (x0, x1) or c[2] in (z0, z1)) and holds(c))   # past the box edge: assumed held
    q = deque(seen)
    while q:
        x, y, z = q.popleft()
        for d in N18:
            c = (x + d[0], y + d[1], z + d[2])
            if c not in seen and holds(c) and x0 <= c[0] <= x1 and z0 <= c[2] <= z1:
                seen.add(c); q.append(c)
    edge = lambda c: c[0] in (x0, x1) or c[2] in (z0, z1)
    floating = sorted((c, cells[c][0]) for c in cells if holds(c) and c not in seen and not edge(c) and (c in mine or not LOOSE.match(cells[c][0])))
    rep["floating"] = len(floating)
    rep["floating_landmark"] = sum(1 for c, _ in floating if c in mine)
    rep["examples"] = [[*c, n] for c, n in floating[:25]]
    report[sid] = rep
    # scene for render.py
    pal, key, blocks = [], {}, []
    for (x, y, z), (n, st) in cells.items():
        lp = logical(n, st); k = json.dumps(lp, sort_keys=True)
        if k not in key: key[k] = len(pal); pal.append([lp[0], lp[1]])
        blocks.append([x, y, z, key[k]])
    cx, cz, ymin = (x0 + x1) // 2, (z0 + z1) // 2, min(b[1] for b in blocks)
    json.dump({"palette": pal, "blocks": [[x - cx, y - ymin, z - cz, i] for x, y, z, i in blocks],
               "camera": {"views": {"front-left": [-35, 30, 1.15], "front-right": [35, 30, 1.15], "high": [20, 60, 1.25], "back": [145, 30, 1.15]}}},
              open(os.path.join(OUT, f"{sid}.scene.json"), "w"))
    print(f"{sid}: {len(ops)} ops, floating {rep['floating']} ({rep['floating_landmark']} of the landmark)", flush=True)
json.dump(report, open(os.path.join(OUT, "report.json"), "w"), indent=1)
level.close()
