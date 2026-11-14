#!/usr/bin/env python3
"""The Forester's woodlot: one 41 x 29 plot per town, just outside the outermost wall, beside the gate road
(Mateo 2026-11-14, settlement thread: "big plots in every town"; the grove's trees are up to 15 across, so it is an
unwalled lot outside the Castle wall instead of a yard inside it). It opens at Town. Its ground is left as it is:
the Forester's Lodge stands on uneven ground.

    python3 woodlot.py LAYOUT_DIR STARTER_DIR SLICE_DIR

LAYOUT_DIR holds the towngen_settle.py outputs (one <plot>.json each, the variants picked for the game); each
variant gets a slot of size "Wood" (letter O in towns_data.js). STARTER_DIR holds the starter bakes (<plot>.json, for
the wall outline). SLICE_DIR holds a 281-wide slice of the world per plot (<plot>-281.npz: terrain_slice.py, then
slice_heights.py), wide enough to see past the land edge.

The box: its long side (41) runs along the gate road, its door in the middle of that side, 3 to 11 blocks off the road's
centre line (a walk joins it to the road); it starts 4 blocks outside the Castle wall at the gate. Whichever side of the road has the flatter, drier
ground (and no rail or road through it) wins; failing both, the lot slides a few blocks further out. Where a cross road
runs too close to the wall for the long side (Gullcliff), the lot turns end-on: its 29 side faces the gate road.
"""
import os, sys, json, math
import numpy as np

CASTLE = 66                 # the Castle ring (walldata.js WALLS.radius)
LAND = 72                   # the land edge: the wall never goes past LAND - 2 (walldata.js)
LONG, DEEP = 41, 29


def outline_r(st, a):
    """The Castle wall's radius at angle a (radians; walldata.js angles: cos -> x, sin -> z)."""
    radii = st["wall"]["radii"]; n = len(radii)
    f = ((a % (2 * math.pi)) / (2 * math.pi)) * n
    i = int(math.floor(f)) % n; t = f - math.floor(f)
    r = radii[i] * (1 - t) + radii[(i + 1) % n] * t + (CASTLE - st["wall"]["radiiAt"])
    return min(r, LAND - 2)


def place(plot, st, S):
    Y, W = S["Y"].astype(int), S["water"].astype(int)
    road = S["road"] if "road" in S else np.zeros(Y.shape, bool)
    X0, Z0 = int(S["X0"]), int(S["Z0"])
    cx, cz = plot["x"], plot["z"]
    b = math.radians(plot["gate"])
    g = (round(math.sin(b)), round(-math.cos(b)))        # out through the gate (bearings are cardinal)
    side_v = (-g[1], g[0])
    R = outline_r(st, math.atan2(g[1], g[0]))
    best = None
    for la, ld, turn in ((LONG, DEEP, 0), (DEEP, LONG, 6)):  # long side on the road, or turned end-on where a cross road cuts it short
     for push in range(0, 21, 2):
      for off0 in (3, 5, 7, 9, 11, 13, 15, 17):
        for s in (1, -1):
            n = (side_v[0] * s, side_v[1] * s)
            cells = []
            for u in range(la):                         # along the road, outward
                for w in range(ld):                     # away from the road
                    along = int(math.ceil(R)) + 4 + push + u; off = off0 + w
                    cells.append((cx + g[0] * along + n[0] * off, cz + g[1] * along + n[1] * off))
            ij = [(x - X0, z - Z0) for x, z in cells]
            if any(not (0 <= i < Y.shape[0] and 0 <= j < Y.shape[1]) for i, j in ij):
                continue
            hs = np.array([Y[i, j] for i, j in ij]); wet = sum(W[i, j] > Y[i, j] for i, j in ij)
            roads = sum(bool(road[i, j]) for i, j in ij)
            score = (np.percentile(hs, 95) - np.percentile(hs, 5)) + 5 * wet + 20 * roads + push + 2 * (off0 - 3) + turn
            if best is None or score < best[0]:
                xs, zs = zip(*cells)
                mid = int(math.ceil(R)) + 4 + push + la // 2
                door = (cx + g[0] * mid + n[0] * off0, cz + g[1] * mid + n[1] * off0)
                step = (door[0] - n[0], door[1] - n[1])
                walk = [(cx + g[0] * mid + n[0] * k, cz + g[1] * mid + n[1] * k) for k in range(off0 - 1, 1, -1)]   # to the road's edge
                best = (score, dict(walk=walk, box=[min(xs) - cx, min(zs) - cz, max(xs) - cx, max(zs) - cz], door=door, step=step, n=n,
                                    floor=int(np.median(hs)), wet=int(wet), roads=int(roads), relief=int(hs.max() - hs.min())))
    return best[1] if best else None


def main(layouts, starters, slices):
    for name in sorted(os.listdir(layouts)):
        if not name.endswith(".json"): continue
        key = name[:-5]
        L = json.load(open(os.path.join(layouts, name)))
        st = json.load(open(os.path.join(starters, f"{key}.json")))
        S = np.load(os.path.join(slices, f"{key}-281.npz"))
        lot = place(L["plot"], st, S)
        if not lot: print(f"{key}: no room for a woodlot"); continue
        cx, cz = L["plot"]["x"], L["plot"]["z"]
        letter = {(0, -1): "n", (0, 1): "s", (1, 0): "e", (-1, 0): "w"}[(-lot["n"][0], -lot["n"][1])]
        sx, sz = lot["step"][0] - cx, lot["step"][1] - cz
        for v in L["variants"]:
            v["slots"] = [s for s in v["slots"] if s["size"] != "Wood"]
            v["slots"].append({"id": "wood1", "size": "Wood", "box": lot["box"], "floor_y": lot["floor"], "tags": ["woodlot", "outside"],
                               "door": {"side": letter, "step": [sx, sz], "walk": [[x - cx, z - cz, lot["floor"], "slab"] for x, z in lot["walk"]]},
                               "long": False, "foundation": 0, "opensAt": "Town"})
        json.dump(L, open(os.path.join(layouts, name), "w"), separators=(",", ":"))
        print(f"{key}: woodlot {lot['box']} door {letter}, relief {lot['relief']}, wet {lot['wet']}, road cells {lot['roads']}")


if __name__ == "__main__":
    main(*sys.argv[1:4])
