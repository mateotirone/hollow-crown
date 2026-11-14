#!/usr/bin/env python3
"""Cut the six NPC towns and the twelve map plots out of a baked Bedrock world, for the town audit.

    python3 tools/town_audit_dump.py WORLD_DIR OUT_DIR [name ...]

WORLD_DIR is an unzipped .mcworld (holds db/). Writes OUT_DIR/<slug>.npz per site: xyz (int32 [n,3]), pid (int32 [n]),
pal (JSON [[name, states], ...]), meta (JSON: kind, name, region, centre, radius, box). Only blocks from a dozen rows
under the lowest ground in the box up are kept (the stone below says nothing about the build).
Read by tools/town_audit.py (checks) and tools/sim-hamlet.mjs (the Hamlet laid on the real ground).
"""
import os, sys, re, json
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from bedrock_world import World

CFG = os.path.join(HERE, "..", "Siege_Nights_BP", "scripts", "plots", "config.js")


def sites():
    cfg = open(CFG).read()
    out = []
    for m in re.finditer(r'\{ name: "([^"]+)", region: "([^"]+)", x: (-?\d+), z: (-?\d+), gate: (\d+)', cfg):
        out.append({"kind": "plot", "name": m[1], "region": m[2], "x": int(m[3]), "z": int(m[4]), "r": 120, "gate": int(m[5])})
    regions = {"Kingsrest": "Aldmere Vale", "Millbrook": "Aldmere Vale", "Rimehold": "Frostmarch", "Gull's Rest": "Saltreach",
               "Sunscar": "Emberwaste", "Mirelight": "Blackfen"}
    for m in re.finditer(r'\{ name: "([^"]+)", x: (-?\d+), z: (-?\d+), r: (\d+)', cfg):
        if m[1] in regions:
            out.append({"kind": "town", "name": m[1], "region": regions[m[1]], "x": int(m[2]), "z": int(m[3]), "r": int(m[4]) + 12})
    return out


def slug(n): return re.sub(r"[^a-z0-9]+", "_", n.lower()).strip("_")


def main():
    wdir, out, *only = sys.argv[1:]
    os.makedirs(out, exist_ok=True)
    w = World(wdir)
    todo = [s for s in sites() if not only or slug(s["name"]) in only]
    need = set()
    for s in todo:
        for cx in range((s["x"] - s["r"]) >> 4, ((s["x"] + s["r"]) >> 4) + 1):
            for cz in range((s["z"] - s["r"]) >> 4, ((s["z"] + s["r"]) >> 4) + 1): need.add((cx, cz))
    print("reading", len(need), "chunks", flush=True)
    w.load_chunks(need)
    for s in todo:
        r = s["r"]
        b = w.box(s["x"] - r, -20, s["z"] - r, s["x"] + r, 250, s["z"] + r)
        tops = {}
        for (x, y, z), (n, _) in b.items():
            if n in ("minecraft:stone", "minecraft:deepslate", "minecraft:dirt", "minecraft:grass_block", "minecraft:sand", "minecraft:sandstone",
                     "minecraft:mud", "minecraft:snow", "minecraft:gravel", "minecraft:red_sand", "minecraft:terracotta") or n.endswith("_terracotta"):
                if tops.get((x, z), -99) < y: tops[(x, z)] = y
        lo = int(np.percentile(list(tops.values()), 2)) - 14 if tops else 30
        keys = [k for k in b if k[1] >= lo]
        pal, idx = [], {}
        pid = np.empty(len(keys), np.int32)
        for i, k in enumerate(keys):
            n, st = b[k]
            key = json.dumps([n, st], sort_keys=True)
            if key not in idx: idx[key] = len(pal); pal.append([n, st])
            pid[i] = idx[key]
        meta = {**s, "lo": lo, "box": [s["x"] - r, lo, s["z"] - r, s["x"] + r, 250, s["z"] + r]}
        if os.environ.get("AUDIT_JSON"):                  # the sim's input (tools/sim-hamlet.mjs)
            import base64
            xyz = np.array(keys, np.int32).reshape(-1, 3)
            stone = [list(map(int, k)) for k in keys if b[k][0] == "siege:plot_stone"]
            meta["stone"] = min(stone, key=lambda k: abs(k[0] - s["x"]) + abs(k[2] - s["z"])) if stone else None
            json.dump({"meta": meta, "pal": pal, "xyz": base64.b64encode(xyz.astype("<i4").tobytes()).decode(),
                       "pid": base64.b64encode(pid.astype("<i4").tobytes()).decode()}, open(os.path.join(out, slug(s["name"]) + ".json"), "w"))
        np.savez_compressed(os.path.join(out, slug(s["name"]) + ".npz"), xyz=np.array(keys, np.int32).reshape(-1, 3), pid=pid,
                            pal=json.dumps(pal), meta=json.dumps(meta))
        print(s["kind"], s["name"], len(keys), "blocks", len(pal), "kinds", flush=True)


if __name__ == "__main__":
    main()
