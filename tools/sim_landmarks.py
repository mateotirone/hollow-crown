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
                for y, n, st in col[col.index(first):][:48]:
                    if n == "air" or "water" in n or "lava" in n or SOFT.search(n): continue
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


N18 = [(a, b, e) for a in (-1, 0, 1) for b in (-1, 0, 1) for e in (-1, 0, 1) if 0 < abs(a) + abs(b) + abs(e) < 3]
report = {}
for sid, pieces in plans.items():
    ops = [o for p in pieces for o in p.get("ops", [])]
    rep = {"pieces": [{k: p.get(k) for k in ("k", "d", "x", "z", "G", "missing")} for p in pieces]}
    if not ops:
        report[sid] = rep; continue
    xs = [o[0] for o in ops]; zs = [o[2] for o in ops]; ys = [o[1] for o in ops]
    x0, x1, z0, z1 = min(xs) - 4, max(xs) + 4, min(zs) - 4, max(zs) + 4
    yb0, yb1 = min(ys) - 6, max(ys) + 2
    cells = {}
    for x in range(x0, x1 + 1):
        for z in range(z0, z1 + 1):
            for y, n, st in column(x, z, yb0, yb1):
                if n != "air": cells[(x, y, z)] = (n, st)
    mine = set()
    for x, y, z, n, st in ops:
        n = n.replace("minecraft:", "")
        if n == "air": cells.pop((x, y, z), None); mine.discard((x, y, z))
        else: cells[(x, y, z)] = (n, st); mine.add((x, y, z))
    # grounded: reachable (by a face or an edge, so a stair roof stepping down holds) from the bottom layer through anything solid-ish; water holds nothing
    holds = lambda c: c in cells and "water" not in cells[c][0] and "lava" not in cells[c][0]
    seen = set(c for c in cells if c[1] == yb0 and holds(c))
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
