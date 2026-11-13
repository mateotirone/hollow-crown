#!/usr/bin/env python3
"""Turn or drop wall-hung blocks (and vines) in baked world files that would hang on nothing.

An item frame, ladder, button or wall sign needs a solid block behind it, or it pops off the first time a block
next to it changes (tools/hung-check.mjs finds them). For each one that hangs on air, this turns it to face away
from a solid neighbour on the same level; if none of the four sides is solid, it is dropped.

  python3 map/hang_blocks.py map/sunscar-blocks.json [more files...]
Uses the same rules as tools/hung-check.mjs (keep the two in step).
"""
import json, re, sys

BEHIND = {2: (0, 0, 1), 3: (0, 0, -1), 4: (1, 0, 0), 5: (-1, 0, 0)}
SOFT = re.compile(r"(^|:)air$|vine|ladder|lantern|button|sign|frame|torch|carpet|glass_pane|iron_bars|fence|chain|trapdoor|door|slab|stairs|_wall$|structure_void|flower|grass$|fern|bush|sapling|candle|banner|rail|snow_layer")
VINE = {1: (0, 1), 2: (-1, 0), 4: (0, -1), 8: (1, 0)}   # vine_direction_bits: the side it clings to (s w n e)
HUNG = re.compile(r"(^|:)(glow_)?frame$|(^|:)ladder$|_button$|wall_sign$")


def holds(hung, wall):
    if wall is None: return False
    return not SOFT.search(wall["name"]) or (hung["name"].endswith("wall_sign") and "leaves" in wall["name"])


def fix(path):
    d = json.load(open(path))
    pal, blocks = d["palette"], d["blocks"]
    at = {}
    for i, b in enumerate(blocks): at[(b[0], b[1], b[2])] = i          # the last block placed at a cell wins
    pidx = {json.dumps(p, sort_keys=True): i for i, p in enumerate(pal)}

    def index_of(p):
        k = json.dumps(p, sort_keys=True)
        if k not in pidx: pidx[k] = len(pal); pal.append(p)
        return pidx[k]

    turned = dropped = 0; drop = set()
    for cell, i in at.items():
        e = pal[blocks[i][3]]
        if e["name"].endswith(":vine") and "vine_direction_bits" in (e.get("states") or {}):
            bits = e["states"]["vine_direction_bits"]
            solid = lambda o: (lambda j: j is not None and j not in drop and not SOFT.search(pal[blocks[j][3]]["name"]))(
                at.get((cell[0] + o[0], cell[1], cell[2] + o[1])))
            good = [k for k, o in VINE.items() if solid(o)]
            if any(bits & k for k in good): continue
            above = at.get((cell[0], cell[1] + 1, cell[2]))
            if not good and above is not None and pal[blocks[above][3]]["name"].endswith(":vine"): continue   # hangs from the vine above
            if good:
                blocks[i] = [*blocks[i][:3], index_of({**e, "states": {**e["states"], "vine_direction_bits": good[0]}}), *blocks[i][4:]]
                turned += 1
            else:
                drop.add(i); dropped += 1
            continue
        if not HUNG.search(e["name"]): continue
        f = (e.get("states") or {}).get("facing_direction")
        wall = lambda fd: (lambda j: pal[blocks[j][3]] if j is not None and j not in drop else None)(
            at.get(tuple(c + o for c, o in zip(cell, BEHIND[fd]))))
        if f in BEHIND and holds(e, wall(f)): continue
        for fd in (2, 3, 4, 5):
            if holds(e, wall(fd)):
                blocks[i] = [*blocks[i][:3], index_of({**e, "states": {**(e.get("states") or {}), "facing_direction": fd}}), *blocks[i][4:]]
                turned += 1; break
        else:
            drop.add(i); dropped += 1
    if drop:
        d["blocks"] = [b for i, b in enumerate(blocks) if i not in drop]
        if "groundwork_blocks" in d and isinstance(d["groundwork_blocks"], int):
            d["groundwork_blocks"] -= sum(1 for i in drop if i < d["groundwork_blocks"])
    with open(path, "w") as fh: json.dump(d, fh, separators=(",", ":"))
    print(f"{path}: {turned} turned, {dropped} dropped")


if __name__ == "__main__":
    for p in sys.argv[1:]: fix(p)
