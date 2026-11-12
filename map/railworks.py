#!/usr/bin/env python3
"""The earthworks and structures a rail stretch needs, as "works" for map/rail-segments.json (Mateo 2026-11-12:
nothing of a line is in the world until its stretch is bought; then the game builds it). The trains' own plain bed
(3 wide, cleared 6 high, ballast on up to 6 of fill) covers most of a line. Works cover what it can't:

  bridges and viaducts   where the line is over water or more than 6 above the natural ground: the one bridge
                         engine (.claude/skills/minecraft-builder/scripts/bridges.py, kind "rail")
  tunnels                where the hill stands more than 10 over the bed for 15+ blocks: a 3-wide bore 5 high,
                         lined in the portal's stone, and a dressed portal at each mouth (scripts/portal.py)
  deep cuttings          where the cut is deeper than the plain bed clears: the sides cleared back about 1 in 1

    works, palette, custom = segment_works(cells, ys, ground, water, region)

cells: [(x, z)] track cells; ys: the y each track block sits in (bed = y - 1); ground(x, z): natural ground top;
water(x, z): water surface y or None; region(x, z): the portal region name. works: [[x, z, y0, y1, i]]
(run-length columns, palette[0] = air), custom: [[i0, i1]] index ranges where the plain bed is skipped.
"""
import math
import os
import sys

SKILL = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".claude", "skills", "minecraft-builder", "scripts")
if os.environ.get("MB_SCRIPTS"): SKILL = os.environ["MB_SCRIPTS"]
sys.path.insert(0, SKILL)

PLAIN_FILL = 6          # the plain bed fills up to this deep; deeper is a viaduct
PLAIN_CLEAR = 6         # and clears this high
TUNNEL_COVER = 10       # hill over the bed that makes a tunnel
TUNNEL_MIN = 15
BRIDGE_REGION = {"Aldmere Vale": "vale", "Frostmarch": "frostmarch", "Saltreach": "saltreach", "Emberwaste": "emberwaste",
                 "Blackfen": "blackfen"}
LINING = {"Aldmere Vale": "stone_bricks", "Frostmarch": "deepslate_bricks", "Saltreach": "stone_bricks",
          "Emberwaste": "cut_red_sandstone", "Blackfen": "mud_bricks"}


def _runs(flags, min_len=1, join=0):
    out, i, n = [], 0, len(flags)
    while i < n:
        if not flags[i]: i += 1; continue
        j = i
        while j < n and flags[j]: j += 1
        if out and i - out[-1][1] <= join: out[-1][1] = j
        else: out.append([i, j])
        i = j
    return [(a, b - 1) for a, b in out if b - a >= min_len]


class Works:
    def __init__(self):
        self.blocks = {}                       # (x, y, z) -> (bedrock name, states); "air" clears

    def put(self, x, y, z, name, states=None, over=True):
        if over or (x, y, z) not in self.blocks: self.blocks[(x, y, z)] = (name, states or {})

    def columns(self):
        pal, index, cols, bycol = [{"name": "minecraft:air"}], {}, [], {}
        for (x, y, z), b in self.blocks.items(): bycol.setdefault((x, z), {})[y] = b
        for (x, z) in sorted(bycol):
            run = None
            for y in sorted(bycol[(x, z)]):
                n, st = bycol[(x, z)][y]
                if n in ("air", "minecraft:air"): i = 0
                else:
                    nm = n if ":" in n else "minecraft:" + n
                    key = (nm, tuple(sorted(st.items())))
                    if key not in index:
                        index[key] = len(pal); pal.append({"name": nm, **({"states": dict(st)} if st else {})})
                    i = index[key]
                if run and run[3] == y - 1 and run[4] == i: run[3] = y
                else:
                    if run: cols.append(run)
                    run = [x, z, y, y, i]
            if run: cols.append(run)
        return cols, pal


def segment_works(cells, ys, ground, water, region, log=print):
    import bridges, portal, emit
    n = len(cells)
    bed = [y - 1 for y in ys]
    g = [ground(x, z) for x, z in cells]
    wl = [water(x, z) for x, z in cells]
    W = Works(); custom = []
    # tunnels: enough hill for long enough (smoothed so a dip doesn't split one)
    deep = [g[i] - bed[i] > TUNNEL_COVER and wl[i] is None for i in range(n)]
    sm = [sum(deep[max(0, i - 3):i + 4]) >= 4 for i in range(n)]
    tunnels = _runs(sm, TUNNEL_MIN)
    in_tunnel = [False] * n
    for a, b in tunnels:
        for i in range(a, b + 1): in_tunnel[i] = True
    # spans: over water, or more than the plain fill above the ground (a gap in the land), not in a tunnel
    span = [(wl[i] is not None or bed[i] - g[i] > PLAIN_FILL) and not in_tunnel[i] for i in range(n)]
    for a, b in _runs(span, 1, join=3):
        a, b = max(0, a - 1), min(n - 1, b + 1)
        wy = max([w for w in wl[a:b + 1] if w is not None], default=None)
        reg = region(*cells[(a + b) // 2])
        c = {"a": list(cells[a]), "b": list(cells[b]), "ya": ys[a], "yb": ys[b], "water_y": wy, "kind": "rail",
             "region": BRIDGE_REGION.get(reg, "vale"), "ground": lambda x, z: ground(x, z)}
        try:
            blocks = bridges.bridge_blocks(c)
        except Exception as e:                     # never lose the whole export over one bridge
            log("rail works: bridge failed", cells[a], cells[b], e); continue
        for (x, y, z), (nm, p) in blocks.items():
            if nm == "air": W.put(x, y, z, "air", over=False)
            else:
                bn, st = emit.bedrock_state(nm, p); W.put(x, y, z, bn, st)
        custom.append([a, b])
    # tunnels: bore, lining, gravel floor, portals
    for a, b in tunnels:
        reg = region(*cells[(a + b) // 2]); lin = LINING.get(reg, "stone_bricks")
        bore, wall = set(), {}
        for i in range(a, b + 1):
            x, z = cells[i]
            for dx in range(-2, 3):
                for dz in range(-2, 3):
                    c = (x + dx, z + dz)
                    if max(abs(dx), abs(dz)) <= 1: bore.add((c, bed[i]))
                    else: wall.setdefault(c, bed[i])
        bore_xz = {c for c, _ in bore}
        for (x, z), fy in wall.items():
            if (x, z) in bore_xz: continue
            for y in range(fy, fy + 6): W.put(x, y, z, lin)
        for (x, z), fy in bore:
            W.put(x, fy, z, "gravel")
            for y in range(fy + 1, fy + 5): W.put(x, y, z, "air")
            W.put(x, fy + 5, z, lin)
        for i, j in ((a, max(0, a - 1)), (b, min(n - 1, b + 1))):
            (x, z), (ox, oz) = cells[i], cells[j]
            out = (ox - x, oz - z) if (ox, oz) != (x, z) else (0, 1)
            try:
                for bx, by, bz, nm, p in portal.portal_blocks({"x": x, "z": z, "floor_y": bed[i], "out": out}, reg):
                    if nm == "air": W.put(bx, by, bz, "air")
                    else:
                        bn, st = emit.bedrock_state(nm, p); W.put(bx, by, bz, bn, st)
            except Exception as e:
                log("rail works: portal failed", (x, z), e)
        # the approaches inside the custom range get the plain bed the trains would have laid: ballast, cleared 6 high
        for i in list(range(max(0, a - 4), a)) + list(range(b + 1, min(n, b + 5))):
            x, z = cells[i]
            for dx in (-1, 0, 1):
                for dz in (-1, 0, 1):
                    W.put(x + dx, bed[i], z + dz, "gravel", over=False)
                    for y in range(bed[i] + 1, bed[i] + 1 + PLAIN_CLEAR): W.put(x + dx, y, z + dz, "air", over=False)
        custom.append([max(0, a - 4), min(n - 1, b + 4)])
    # cuttings and embankments (Mateo: no sheer trenches or walls): the plain bed is 3 wide; past it the sides of
    # a cutting are cleared back at 1 in 1, and an embankment's sides are built out at 1 in 1 in earth, turfed
    side = [(g[i] - bed[i] > 2 or bed[i] - g[i] > 2) and not in_tunnel[i] and wl[i] is None for i in range(n)]
    for a, b in _runs(side, 1, join=2):
        for i in range(max(0, a - 2), min(n, b + 3)):
            if in_tunnel[i] or any(c0 <= i <= c1 for c0, c1 in custom): continue
            x, z = cells[i]
            if i + 1 < n: dx, dz = cells[i + 1][0] - x, cells[i + 1][1] - z
            else: dx, dz = x - cells[i - 1][0], z - cells[i - 1][1]
            L = math.hypot(dx, dz) or 1; px, pz = -dz / L, dx / L
            reach = min(24, abs(g[i] - bed[i]) + 2)
            for sd in (-1, 1):
                for d2 in range(2, 2 * reach + 1):
                    d = d2 / 2
                    cx, cz = round(x + px * sd * d), round(z + pz * sd * d)
                    if max(abs(cx - x), abs(cz - z)) <= 1: continue
                    top = ground(cx, cz)
                    if water(cx, cz) is not None: continue
                    hi = bed[i] + max(PLAIN_CLEAR if d <= 1.5 else 0, round(d))     # a cutting's side
                    lo = bed[i] - round(d) + 1                                    # an embankment's side
                    if top > hi:
                        for y in range(hi + 1, top + 13): W.put(cx, y, cz, "air", over=False)
                    elif top < lo:
                        for y in range(top + 1, lo): W.put(cx, y, cz, "dirt", over=False)
                        W.put(cx, lo, cz, "grass_block", over=False)
    # the train's body stays open: the track cell and one cell each side, 4 high (an engine is 3.1 wide, 3.8 tall).
    # This trims bridge-end parapets and abutments where the line curves off the bridge axis, and a portal arch's
    # shoulders, back to a clear 3 x 4 opening; decks (y - 1) and tunnel linings (y + 4, ring 2) are untouched.
    for (x, z), y in zip(cells, ys):
        for k in range(4): W.put(x, y + k, z, "air")
    for (x, z), y in zip(cells, ys):                 # the sides only where the works built something (no extra columns)
        for dx in (-1, 0, 1):
            for dz in (-1, 0, 1):
                for k in range(4):
                    b = W.blocks.get((x + dx, y + k, z + dz))
                    if b and b[0] not in ("air", "minecraft:air"): W.put(x + dx, y + k, z + dz, "air")
    cols, pal = W.columns()
    return cols, pal, sorted(custom)


def _selftest():
    import numpy as np
    # a valley with a river, then a hill: one bridge, one tunnel, both custom
    cells = [(i, 0) for i in range(200)]
    gnd = lambda x, z: 70 if x < 40 else (50 if x < 70 else (70 if x < 110 else (95 if x < 160 else 70)))
    wat = lambda x, z: 58 if 50 <= x < 60 else None
    ys = [71] * 200
    cols, pal, custom = segment_works(cells, ys, gnd, wat, lambda x, z: "Aldmere Vale", log=lambda *a: None)
    assert pal[0]["name"] == "minecraft:air"
    assert any(a <= 55 <= b for a, b in custom), custom            # the bridge
    assert any(a <= 130 <= b for a, b in custom), custom           # the tunnel
    assert not any(a <= 20 <= b for a, b in custom)                # plain bed on the flat
    # the bore is clear 4 high over the bed inside the tunnel
    air = {(x, y, z) for x, z, y0, y1, i in cols if i == 0 for y in range(y0, y1 + 1)}
    assert all((130, y, 0) in air for y in range(71, 75))
    solid = {(x, y, z) for x, z, y0, y1, i in cols if i != 0 for y in range(y0, y1 + 1)}
    assert not any((x + dx, y + k, z + dz) in solid for (x, z), y in zip(cells, ys)
                   for dx in (-1, 0, 1) for dz in (-1, 0, 1) for k in range(4))   # the train's body stays air
    print("railworks: ALL OK", len(cols), "columns", len(pal), "palette")


if __name__ == "__main__":
    _selftest()
