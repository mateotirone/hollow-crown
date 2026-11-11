#!/usr/bin/env python3
"""Bake a town plan (towngen's <town>-plots.json + <town>-groundwork.json) into a flat list of world blocks that
map/genworld.py stamps into the map (GW_BLOCKS=file[:file...]).

    python3 map/bake_town.py PLAN_DIR/kingsrest-plots.json STRUCTURES_DIR TREEDB OUT.json

STRUCTURES_DIR holds map/structures (bp.py, dressing.py, towngen_build.py); TREEDB is a map/trees/build_trees.py
database. Order matters: groundwork first (air digs out), then the fixtures (well, lamps, trees). Fence and wall
connections are worked out over the whole groundwork. Leaves are marked soft: they only fill air.

Output: {"format": "hollow-crown-worldblocks/1", "town", "palette": [{name, states, soft?}], "blocks": [[x,y,z,i]...]}
"""
import json, os, sys


def bake(plan_path, structures, treedb):
    sys.path.insert(0, structures)
    from bp import Blueprint
    import dressing
    import towngen_build
    plan = json.load(open(plan_path))
    gw = json.load(open(os.path.join(os.path.dirname(plan_path), plan["groundwork"])))
    pal, idx, out = [], {}, []

    def pid(name, states, soft=False):
        key = json.dumps([name, states, soft], sort_keys=True)
        if key not in idx:
            idx[key] = len(pal); e = {"name": name, "states": states}
            if soft: e["soft"] = True
            pal.append(e)
        return idx[key]

    ground = Blueprint(plan["town"] + "_groundwork")
    for x, y, z, i in gw["blocks"]:
        n, p = gw["palette"][i]
        ground.set(x, y, z, n, **p)
    ground.finish()
    for (x, y, z), (n, p) in sorted(ground.cells.items(), key=lambda c: (c[0][1], c[0][0], c[0][2])):
        out.append([x, y, z, pid(*ground.to_bedrock(n, p))])
    n_ground = len(out)
    made = {}
    seats = []                                                  # trunk spots: the map keeps their ground at ground_y
    for f in plan["fixtures"]:
        s, (ax, az), gy, rot = f["stamp"], f["at"], f["ground_y"], f.get("rotation", 0)
        if "/" in s:                                            # a tree from the tree database
            st = json.load(open(os.path.join(treedb, s + ".stamp.json"))); seats.append([ax, az, gy])
            ox, _oy, oz = st["origin"]
            for x, y, z, i in st["blocks"]:
                e = st["palette"][i]
                out.append([ax + x + ox, gy + y, az + z + oz, pid(e["name"], e["states"], "leaves" in e["name"])])
            continue
        if s not in made:
            if s == "lamp_post": made[s] = dressing.lamp()
            elif s.startswith("tg_well_"): made[s] = towngen_build.well(int(s.rsplit("_", 1)[1]))
            else: raise ValueError(f"no builder for fixture stamp {s!r}")
        bp = made[s].rotated(rot) if rot else made[s]
        for (x, y, z), (n, p) in bp.cells.items():
            if n == "keep": continue
            out.append([ax + x, gy + y, az + z, pid(*bp.to_bedrock(n, p))])
    return {"format": "hollow-crown-worldblocks/1", "town": plan["town"],
            "note": "world coordinates, placed in order; soft entries only fill air; the first groundwork_blocks are the "
            "groundwork (streets, plots, fields), which the map grades the land to", "groundwork_blocks": n_ground, "tree_seats": seats, "palette": pal, "blocks": out}


if __name__ == "__main__":
    plan, structures, treedb, dst = sys.argv[1:5]
    d = bake(plan, structures, treedb)
    with open(dst, "w") as fh: json.dump(d, fh, separators=(",", ":"))
    print(d["town"], len(d["blocks"]), "blocks,", len(d["palette"]), "palette entries ->", dst)
