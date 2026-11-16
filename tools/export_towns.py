#!/usr/bin/env python3
"""Settlement layouts for the game: the town generator's per-plot JSON -> Siege_Nights_BP/scripts/settle/towns_data.js

    python3 tools/export_towns.py DIR [--starter SDIR]
    python3 tools/export_towns.py --windmills-only      (re-site every layout's windmill in the towns_data.js there)
        DIR holds <plot>.json files (format hollow-crown-settlement/1), e.g. /mnt/project-files/siege-nights/towngen/settlements
        SDIR holds the starter villages (<plot>.json, format hollow-crown-starter/1, from map/structures/starter_all.py)

The starter village is every plot's Hamlet (Mateo, 2026-11-13): with --starter, each layout's Hamlet band (its
slots, groundwork and fixtures) is replaced by the plot's starter village, and the Town, City and Castle bands
grow round it: their slots, ground and fixtures that would land on the starter's paths, plots or yards are left
out. The starter's wall outline (radii) goes with the town, so every ring follows the land.

One entry per map plot (key = plot name in lower case), three layouts each. Heights are stored relative to the
town square (the game adds the difference between the square and the real ground at the Plot Stone), and the
groundwork is packed into a short string so twelve towns stay small:

  gw = four tier sections joined by "|", each a string of column runs (see pack_groundwork); a block char is an
       index into the layout's palette (CHARS).
"""
import argparse, collections, glob, json, math, os, re, sys

CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
TIER = {"Hamlet": 0, "Town": 1, "City": 2, "Castle": 3}
TIERS = list(TIER)
SIZE = {"Small": "S", "Medium": "M", "Large": "L", "Great": "G", "Works": "W", "Dragon": "D", "Barn": "B", "Wood": "O"}
STAIR = {"e": 0, "w": 1, "s": 2, "n": 3}       # Bedrock weirdo_direction
GATE = {"s": 0, "w": 1, "n": 2, "e": 3}        # Bedrock direction
RENAME = {"dirt_path": "grass_path"}
STARTER_SKIP = {"plot_marker", "mason_bench"}   # placed by the game (Plot Markers, the bench fixture)


# ---------- the Hamlet wall line, drawn round what the starter village laid ----------
# (Mateo, 2026-11-14: no "dead space" inside the Low Palisade.) It is worked out here, in the same run and from the
# same starter village as the plots, paths and ground it goes round, and goes into towns_data.js as outline.tight,
# so the wall can never follow an older village than the one laid (2026-11-16: a separate hamlet_walls_data.js made
# on Nov 14 outlived the village rebuild that day and cut through the gardens and wood yards on all 12 plots).
# The line is drawn from everything the village LAID (Mateo 2026-11-16: "lay the plots, lay the paths, wall goes
# around"): every planned cell (paths, plots, yards, the hall's ground), every area's whole box (the wood yard, the cow
# pen, the common field, the Works yard, the empty plot), every block the village set that isn't bare ground or a
# wild plant (fences, log piles, farmland, lamps, the hay and barrels), and every fixture. Only the gate road beyond
# the square is left out (it runs on out through the gate to the map road). At each of the outline's angles the line
# stands KEEP blocks past the furthest of those on that side, never less than LEAST, smoothed; across the gate it is
# one flat chord GATE_CLEAR past what flanks the gate road (the gate lamps), and the gate road is narrowed to the
# gate's width where the wall crosses it (gate_trim), so no wall column ever stands on a path.
KEEP = 5        # the wall stays this far outside anything laid (room for the walk, the steps and a lane inside)
GATE_CLEAR = 3  # across the gate: this far past the lamps and posts flanking the gate road (the stair is never there)
LEAST = 22      # never closer than this to the square
SPAN, NOTCH = 3, 3   # outline points either side a dip is measured over, and how deep it may go (no sharp notches)
GATE_KEEP = 6   # outline points either side of the gate that make one flat chord
TOWN_DEPTH = 6  # and never further out than this inside the Town ring (its wall must still go round the Hamlet's)
BARE = {"air", "dirt", "grass_block", "sand", "red_sand", "snow", "stone", "gravel", "mud", "short_grass", "tall_grass", "fern",
        "dandelion", "poppy", "azure_bluet", "cornflower", "oxeye_daisy", "azalea_leaves"}
ROADY = re.compile(r"cobble|andesite|stone_brick|tuff_brick|mud_brick|gravel|_slab|path|planks")


def gate_axes(st):
    ga = st["wall"]["gateAngle"]; ca, sa = math.cos(ga), math.sin(ga)
    return lambda x, z: (x * ca + z * sa, -x * sa + z * ca)   # (along the gate line, across it)


def laid_cells(st):
    """(dx, dz, gate_side) of everything the starter village laid, without the gate road past the square. gate_side is
    True for what flanks the gate road (within 4 of its middle line), which the gate chord measures from."""
    ax = gate_axes(st)
    R, A = st["frame"]["right"], st["frame"]["ahead"]
    out = set()
    road = lambda x, z: (lambda al, ac: al >= 20 and abs(ac) <= 2.5)(*ax(x, z))
    for dx, dz, kind, _ in st["used"]:
        if not (kind == 3 and road(dx, dz)): out.add((dx, dz))
    for ar in st["areas"]:
        b = ar["box"]; pts = [(r * R[0] + a * A[0], r * R[1] + a * A[1]) for r, a in ((b[0], b[2]), (b[1], b[3]))]
        for x in range(min(p[0] for p in pts), max(p[0] for p in pts) + 1):
            for z in range(min(p[1] for p in pts), max(p[1] for p in pts) + 1): out.add((x, z))
    for x, y, z, n, p in st["blocks"]:
        if n in BARE or (ROADY.search(n) and road(x, z)): continue
        out.add((x, z))
    for f in st["fixtures"]: out.add((f["at"][0], f["at"][2]))
    return [(x, z, abs(ax(x, z)[1]) <= 4.5) for x, z in out]


def tight(st, town_ring):
    radii = st["wall"]["radii"]; N = len(radii)
    cells = laid_cells(st)
    pts = [(math.atan2(dz, dx), math.hypot(dx, dz), g) for dx, dz, g in cells]
    # the line KEEP blocks out from everything laid: along each ray, the furthest point of a KEEP-wide disc round any
    # laid cell (an exact offset of the village, so the wall hugs the corners of plots instead of bulging past them)
    def offset(i, keep, only=None):
        a = i / N * 2 * math.pi; far = 0
        for b, d, g in pts:
            if only is not None and g != only: continue
            along, perp = d * math.cos(b - a), abs(d * math.sin(b - a))
            if along > 0 and perp <= keep: far = max(far, along + math.sqrt(keep * keep - perp * perp))
        return far
    need = [offset(i, KEEP) for i in range(N)]
    gi = round((st["wall"]["gateAngle"] % (2 * math.pi)) / (2 * math.pi) * N) % N
    chord = range(gi - GATE_KEEP, gi + GATE_KEEP + 1)
    # across the gate: off the gate road, KEEP as everywhere; beside it, GATE_CLEAR past the gate lamps
    flat = max(max(offset(i % N, KEEP, False) for i in chord), max(offset(i % N, GATE_CLEAR, True) for i in chord))
    for i in chord: need[i % N] = flat
    # no sharp notches between two plots: a dip narrower than about 20 degrees is filled to within NOTCH of its sides
    r = [max(LEAST, n, max(need[(i + d) % N] for d in range(-SPAN, SPAN + 1)) - NOTCH) for i, n in enumerate(need)]
    for _ in range(2):
        r = [max((r[i - 1] + 2 * r[i] + r[(i + 1) % N]) / 4, need[i]) for i in range(N)]
    for i in chord: r[i % N] = max(r[j % N] for j in chord)   # the gate chord stays flat after smoothing
    cap = [radii[i] + town_ring - st["wall"]["radiiAt"] - TOWN_DEPTH for i in range(N)]
    over = [i for i in range(N) if r[i] > cap[i] + 0.05]
    if over: print(f"  warning: {st['plot']} Hamlet line pushed against the Town ring at {len(over)} of {N} angles", file=sys.stderr)
    return [round(min(v, cap[i]), 1) for i, v in enumerate(r)]


def gate_trim(st, line):
    """The gate road's cells the Hamlet wall would stand on (beside the 3-wide gate, where the wall crosses the road):
    {(dx, dz)}. The road is narrowed to the gate there, so it goes through the gate and nothing stands on a path."""
    ax = gate_axes(st); N = len(line)
    gi = round((st["wall"]["gateAngle"] % (2 * math.pi)) / (2 * math.pi) * N) % N
    L = line[gi]
    out = set()
    for x, y, z, n, p in st["blocks"]:
        al, ac = ax(x, z)
        if ROADY.search(n) and 1.5 < abs(ac) <= 2.5 and L - 4 <= al <= L + 1: out.add((x, z))
    return out


# ---------- the Town, City and Castle wall lines, drawn round what each tier laid ----------
# The same order for every tier (Mateo 2026-11-16: "lay the plots, lay the paths, wall goes around, paths are correctly
# connected"). A tier's wall needs DEPTH blocks inside its line for the wall, the walk, the stairs and the towers of the
# levels it can reach (walldata.js tierCap: Town 5, City 8, Castle 10). For each tier:
#   1. the line: the ring (the starter's outline moved out) or, where that tier's plots reach
#      further, DEPTH past them, smoothed, one flat chord across the gate, never past the land (LAND)
#   2. what else that tier laid inside the wall band (paths running on to the wall, a field's last rows, a lamp, a tree) is
#      laid one tier later instead, when the wall has moved past it (or not at all past the Castle's), and the gate
#      road narrows to the gate where the wall crosses it
# so no wall, walk, stair or tower ever stands on a plot, a field, a path or a fixture, and nothing is laid under a wall.
DEPTH = [5, 4, 6.5, 7]   # blocks inside the line kept free of paths, fields and fixtures, per tier (the Hamlet's is KEEP above)
PLOT_DEPTH = [5, 4, 6, 6]   # and of plots: the wall, the walk and the towers (no ladder or step is put on a plot: outline.keep)
LAND = 72                # walldata.js WALLS.radius + landBeyond - 2: the furthest a wall line may stand (the land reaches 2 further)
BARE_IDS = BARE | {"coarse_dirt", "podzol", "snow_layer"}


def interp(line, a):
    N = len(line); f = (a % (2 * math.pi)) / (2 * math.pi) * N; i = int(f) % N; t = f - int(f)
    return line[i] * (1 - t) + line[(i + 1) % N] * t


def ring_lines(d, st):
    """Draw the Town, City and Castle lines from what each tier laid (all layouts together: the wall belongs to the
    plot) and move what each tier laid in its wall band to a later tier. Changes d["variants"] in place.
    Returns {radius: [line at even angles]} for walldata.js radiusAt (outline.lines)."""
    radii, at = st["wall"]["radii"], st["wall"]["radiiAt"]; N = len(radii)
    ax = gate_axes(st)
    gi = round((st["wall"]["gateAngle"] % (2 * math.pi)) / (2 * math.pi) * N) % N
    chord = range(gi - GATE_KEEP, gi + GATE_KEEP + 1)
    road = lambda x, z: (lambda al, ac: al >= 20 and abs(ac) <= 2.5)(*ax(x, z))
    lines = {}
    for t in (1, 2, 3):
        R, D, DP = d["wall_radius"][t], DEPTH[t], PLOT_DEPTH[t]
        base = [min(LAND, radii[i] + R - at) for i in range(N)]
        # 1. what this tier's plots reach (paths, fields' outer rows, lamps and trees give way instead)
        pts = set()
        for v in d["variants"]:
            pal = v["groundwork"]["palette"]
            for s in v["slots"]:
                b = s["box"]
                if TIER[s["opensAt"]] > t or max(abs(c) for c in b) > LAND: continue
                for x in range(b[0], b[2] + 1):
                    for z in range(b[1], b[3] + 1): pts.add((x, z))
        # the woodlot stands outside every wall (Mateo 2026-11-14): the line stops 3 short of it (a tower stands 2 proud)
        wood = [(math.atan2(z, x), math.hypot(x, z)) for v in d["variants"] for sl in v["slots"] if sl["size"] == "Wood"
                for x in range(sl["box"][0], sl["box"][2] + 1) for z in range(sl["box"][1], sl["box"][3] + 1)]
        def woodcap(i):
            a = i / N * 2 * math.pi; near = LAND
            for b, dd in wood:
                if dd * math.cos(b - a) > 0 and abs(dd * math.sin(b - a)) <= 3.5: near = min(near, dd * math.cos(b - a) - 3)
            return near
        cap = [woodcap(i) for i in range(N)]
        def draw(pts):
            P = [(math.atan2(z, x), math.hypot(x, z), DP if (x, z) in plotcells else D) for x, z in pts]
            def offset(i):
                a = i / N * 2 * math.pi; far = 0
                for b, dd, k in P:
                    along, perp = dd * math.cos(b - a), abs(dd * math.sin(b - a))
                    if along > 0 and perp <= k: far = max(far, along + math.sqrt(k * k - perp * perp))
                return far
            need = [offset(i) for i in range(N)]
            r = [max(base[i], need[i], max(need[(i + k) % N] for k in range(-SPAN, SPAN + 1)) - NOTCH) for i in range(N)]
            for _ in range(2):
                r = [max((r[i - 1] + 2 * r[i] + r[(i + 1) % N]) / 4, need[i], base[i]) for i in range(N)]
            flat = max(r[i % N] for i in chord)
            for i in chord: r[i % N] = flat
            return need, [round(min(LAND, cap[i], v), 1) for i, v in enumerate(r)]
        def inband(line, x, z):
            return interp(line, math.atan2(z, x)) - D < math.hypot(x, z) <= LAND + 4
        # paths in the band that join two parts of the town are kept, and the line goes round them instead: only the
        # ends of streets that run on to the wall give way (paths are correctly connected, Mateo 2026-11-16)
        def bridges(line):
            keep = set()
            for v in d["variants"]:
                pal = v["groundwork"]["palette"]
                G = {(x, z) for x, y, z, q, tt in v["groundwork"]["blocks"] if tt <= t and ROADY.search(pal[q][0]) and math.hypot(x, z) <= LAND + 4}
                B = {c for c in G if inband(line, *c) and not road(*c)}
                rest, comps, seen = G - B, [], set()
                for c in rest:
                    if c in seen: continue
                    seen.add(c); todo, cells = [c], [c]
                    while todo:
                        x, z = todo.pop()
                        for i in (-1, 0, 1):
                            for j in (-1, 0, 1):
                                n = (x + i, z + j)
                                if n in rest and n not in seen: seen.add(n); todo.append(n); cells.append(n)
                    comps.append(cells)
                if len(comps) < 2: continue
                comps.sort(key=len, reverse=True)
                main = set(comps[0])
                for cells in comps[1:]:   # the way back to the main network through the band, if there is one
                    par = {c: None for c in cells}; todo = collections.deque(cells); hit = None
                    while todo and not hit:
                        x, z = todo.popleft()
                        for i in (-1, 0, 1):
                            for j in (-1, 0, 1):
                                n = (x + i, z + j)
                                if n in G and n not in par:
                                    par[n] = (x, z)
                                    if n in main: hit = n; break
                                    todo.append(n)
                            if hit: break
                    while hit:
                        if hit in B: keep.add(hit)
                        hit = par[hit]
            return keep
        plotcells = set(pts)
        held = set()
        for _ in range(4):
            need, line = draw(pts | held)
            more = bridges(line) - held
            if not more: break
            held |= more
        lines[str(R)] = line
        short = [i for i in range(N) if need[i] > LAND + 0.05]
        if short: print(f"  warning: {d['plot']['name']} {TIERS[t]}: plots reach the land's edge at {len(short)} of {N} angles", file=sys.stderr)
        # 2. what this tier laid in the wall band is laid a tier later (past the Castle: not at all)
        L = line[gi]
        for v in d["variants"]:
            pal = v["groundwork"]["palette"]
            boxes = [s["box"] for s in v["slots"] if TIER[s["opensAt"]] <= t]
            in_slot = lambda x, z: any(b[0] <= x <= b[2] and b[1] <= z <= b[3] for b in boxes)
            idx = {}
            def pid(n):
                if n not in idx:
                    k = next((i for i, (nn, pp) in enumerate(pal) if nn == n and not pp), None)
                    if k is None: pal.append([n, {}]); k = len(pal) - 1
                    idx[n] = k
                return idx[n]
            later = {(x, y, z) for x, y, z, q, tt in v["groundwork"]["blocks"] if tt > t}
            tops = collections.Counter(pal[q][0] for x, y, z, q, tt in v["groundwork"]["blocks"] if pal[q][0] in ("grass_block", "sand", "red_sand", "snow", "mud"))
            top = tops.most_common(1)[0][0] if tops else "grass_block"
            rows, moved = [], 0
            for row in v["groundwork"]["blocks"]:
                x, y, z, q, tt = row
                n = pal[q][0]
                if tt > t or n in BARE_IDS or in_slot(x, z) or (x, z) in held:
                    rows.append(row); continue
                al, ac = ax(x, z)
                dist = math.hypot(x, z); lr = interp(line, math.atan2(z, x))
                if road(x, z):   # the gate road runs on out; only its edges give way, where the wall crosses it
                    band = 1.5 < abs(ac) and L - D <= al <= L + 1.5
                else:
                    band = lr - D < dist <= LAND + 4
                if not band:
                    rows.append(row); continue
                moved += 1
                solid = not (n in ("lantern", "wheat", "carrots", "potatoes", "beetroot", "air") or "fence" in n or "torch" in n)
                rows.append([x, y, z, pid(top if solid and (ROADY.search(n) or n in ("farmland", "water")) else "air"), tt])
                if t < 3 and (x, y, z) not in later: rows.append([x, y, z, q, t + 1])
            v["groundwork"]["blocks"] = rows
            fx = []
            for f in v["fixtures"]:
                ft = TIER[f["tier"]]
                if ft <= t and f["name"] in ("lamp", "tree"):
                    x, z = f["at"][0], f["at"][1]
                    if interp(line, math.atan2(z, x)) - D < math.hypot(x, z) <= LAND + 2:
                        if t == 3: continue
                        f = {**f, "tier": TIERS[t + 1]}
                fx.append(f)
            v["fixtures"] = fx
    # the plots that come near a wall line: no tower ladder or flight of steps is ever put on one (walldata.js wallColumns)
    keep = set()
    for v in d["variants"]:
        for sl in v["slots"]:
            b = sl["box"]
            if sl["size"] == "Wood" or TIER[sl["opensAt"]] == 0: continue
            for rad, line in lines.items():
                if any(math.hypot(x, z) > interp(line, math.atan2(z, x)) - 8 for x, z in ((b[0], b[1]), (b[2], b[1]), (b[0], b[3]), (b[2], b[3]))):
                    keep.add(tuple(b)); break
    return lines, sorted(keep)


def bedrock(name, states):
    """[id, states] for the game (Java-style names and states from the generator)"""
    out = {}
    for k, v in states.items():
        if k == "raw":
            out.update(v)
        elif k == "half":
            out["minecraft:vertical_half"] = "top" if v == "top" else "bottom"
        elif k == "facing" and name.endswith("_stairs"):
            out["weirdo_direction"] = STAIR[v]
        elif k == "facing" and name.endswith("_gate"):
            out["minecraft:cardinal_direction"] = {"s": "south", "w": "west", "n": "north", "e": "east"}[v]   # 26.x: no more "direction"
        elif k == "axis":
            out["pillar_axis"] = v
        elif k in ("growth", "persistent_bit"):
            out[k] = v
    return ["minecraft:" + RENAME.get(name, name), out]


def pack_groundwork(rows, base):
    """Columns packed to a few characters each. A run of blocks stacked up one column starts with
    "-" (the next column: same dx, dz + 1), "~" (the same column again, higher up) or "!" + dx, dz (two chars each, +2048),
    then dy0 (one char, +32) and the count (one char), then one palette char per block."""
    enc2 = lambda v: CHARS[(v + 2048) >> 6] + CHARS[(v + 2048) & 63]
    tiers = [{} for _ in range(4)]
    for dx, y, dz, pal, tier in rows:
        assert -2048 <= dx < 2048 and -2048 <= dz < 2048 and -32 <= y - base < 32, (dx, dz, y - base)
        tiers[tier].setdefault((dx, dz), {})[y - base] = pal
    sections = []
    for cols in tiers:
        out, last = [], None
        for (dx, dz) in sorted(cols):
            col = cols[(dx, dz)]
            runs, cur = [], []
            for y in sorted(col):
                if cur and (y != cur[-1] + 1 or len(cur) == 63):
                    runs.append(cur)
                    cur = []
                cur.append(y)
            runs.append(cur)
            for i, run in enumerate(runs):
                if i:
                    head = "~"
                elif last == (dx, dz - 1):
                    head = "-"
                else:
                    head = "!" + enc2(dx) + enc2(dz)
                out.append(head + CHARS[run[0] + 32] + CHARS[len(run)] + "".join(CHARS[col[y]] for y in run))
            last = (dx, dz)
        sections.append("".join(out))
    return "|".join(sections)


def fixture(f, base):
    tier = TIER[f["tier"]]
    x, z = f["at"]
    dy = f["ground_y"] - base if "ground_y" in f else None
    row = [f["name"], x, z, tier, dy]
    if f["name"] == "tree":
        row += [f.get("species"), f.get("size"), f.get("rotation", 0)]
    elif f["name"] in ("mason_yard", "storehouse"):  # side = the way its front faces (n/s/e/w), read as rotation
        row += [f.get("side", f.get("rotation", "s"))]
    elif "rotation" in f:
        row += [f.get("stamp"), f.get("rotation", 0)]
    return row


def variant(v):
    base = v["square"]["y"]
    pal = v["groundwork"]["palette"]
    assert len(pal) <= len(CHARS), "palette too long"
    return {
        "template": v["template"], "label": v["label"], "seed": v.get("seed"), "charter": v.get("passes_charter", True),
        "base": base,   # the square's real height on the map: the game lays the groundwork from here (founding.js)
        "square": v["square"]["centre"],
        "hall": [h["box"] for h in v["hall"]],
        "rings": [[r["radius"], TIER[r["opensAt"]]] for r in v["rings"]],
        "slots": [[s["id"], SIZE[s["size"]], *s["box"], s["floor_y"] - base, s["door"]["side"], s["door"]["step"],
                   [[w[0], w[1], w[2] - base] for w in s["door"]["walk"]], TIER[s["opensAt"]], s["tags"], bool(s.get("long")), s.get("start")] for s in v["slots"]],
        "fields": [[*f["centre"], TIER[f["opensAt"]], f["area_by_tier"]] for f in v["fields"]],
        "fix": [fixture(f, base) for f in v["fixtures"]],
        "pal": [bedrock(n, s) for n, s in pal],
        "gw": pack_groundwork(v["groundwork"]["blocks"], base),
    }


def boxes_meet(a, b, pad=0):
    return a[0] - pad <= b[2] and b[0] - pad <= a[2] and a[1] - pad <= b[3] and b[1] - pad <= a[3]


def starter_hamlet(v, st, trim=frozenset()):
    """Put the starter village in as this layout's Hamlet band. v is a hollow-crown-settlement/1 variant
    (changed in place), st the plot's hollow-crown-starter/1 data."""
    base = v["square"]["y"]
    used = {(c[0], c[1]) for c in st["used"]}
    near = {(x + i, z + j) for x, z in used for i in (-2, -1, 0, 1, 2) for j in (-2, -1, 0, 1, 2)}   # the 3-block clearance
    in_box = lambda b: any((x, z) in near for x in range(b[0], b[2] + 1) for z in range(b[1], b[3] + 1))
    hall4, hall5 = v["hall"][-2]["box"], v["hall"][-1]["box"]
    # 1. the town layout's own Hamlet goes, and whatever of the later bands would land on the starter village
    v["slots"] = [s for s in v["slots"] if s["opensAt"] != "Hamlet" and not in_box(s["box"])]
    v["fixtures"] = [f for f in v["fixtures"] if f["tier"] != "Hamlet" and tuple(f["at"]) not in near]
    rows = [r for r in v["groundwork"]["blocks"] if r[4] > 0 and (r[0], r[2]) not in used]
    # 2. the starter village's ground and blocks (its palette goes on the end of the layout's)
    pal = v["groundwork"]["palette"]
    index = {(n, json.dumps(p, sort_keys=True)): i for i, (n, p) in enumerate(pal)}
    # the Mason's yard is raised by the game (settle/basebuilds.js, the mason_yard design on the fixture below): of the
    # starter's yard only its levelled ground stays
    yard_n, yard = next(((n, a) for n, a in enumerate(st["areas"]) if a["kind"] == "yard"), (None, None))
    R, A = st["frame"]["right"], st["frame"]["ahead"]
    def world_box(b):
        pts = [(r * R[0] + a * A[0], r * R[1] + a * A[1]) for r, a in ((b[0], b[2]), (b[1], b[3]))]
        return [min(p[0] for p in pts), min(p[1] for p in pts), max(p[0] for p in pts), max(p[1] for p in pts)]
    ybox = world_box(yard["box"]) if yard else None
    tops = collections.Counter(n for x, y, z, n, p in st["blocks"] if n in ("grass_block", "sand", "red_sand", "snow", "mud"))
    top = tops.most_common(1)[0][0] if tops else "grass_block"
    for x, y, z, n, p in st["blocks"]:
        if n in STARTER_SKIP or (x, z) == (0, 0):
            continue
        if (x, z) in trim and ROADY.search(n):   # the gate road narrowed to the gate where the wall crosses it, and
            k = (n, json.dumps(p, sort_keys=True))   # widened again once the Town wall has moved past (laid a tier later)
            if k not in index:
                index[k] = len(pal); pal.append([n, p])
            rows.append([x, y, z, index[k], 1])
            n, p = top, {}
        if ybox and ybox[0] <= x <= ybox[2] and ybox[1] <= z <= ybox[3] and y > yard["y"]:
            continue
        k = (n, json.dumps(p, sort_keys=True))
        if k not in index:
            index[k] = len(pal); pal.append([n, p])
        rows.append([x, y, z, index[k], 0])
    keep = sorted({r[3] for r in rows})               # only the palette entries still used
    remap = {o: i for i, o in enumerate(keep)}
    v["groundwork"]["palette"] = [pal[o] for o in keep]
    v["groundwork"]["blocks"] = [[x, y, z, remap[p], t] for x, y, z, p, t in rows]
    # 3. the starter's plots: the library's, the two houses (already standing when you arrive) and the open plot
    for n, (ar, door) in enumerate(zip(st["areas"], st["doors"])):
        if ar["kind"] not in ("building", "slot"):
            continue
        box = world_box(ar["box"])
        wide = box[2] - box[0] + 1 if door["side"] in "ns" else box[3] - box[1] + 1
        deep = box[3] - box[1] + 1 if door["side"] in "ns" else box[2] - box[0] + 1
        design = ar.get("design")
        size = ar.get("size") or ("Small" if wide <= 9 else "Medium" if deep <= 15 and wide <= 13 else "Large")
        size = {"S": "Small", "M": "Medium", "L": "Large", "G": "Great", "W": "Works"}.get(size, size)
        hall = ["hall4"] if boxes_meet(box, hall4) else ["hall5"] if boxes_meet(box, hall5) else []   # ground the hall takes back
        tags = ["starter"] + (["library", "square"] if design == "library" else []) + hall
        if design == "house" and not any("founder" in q["tags"] for q in v["slots"]):
            tags.append("founder")   # the founder's own house: their bed goes in it (settle/basebuilds.js)
        sx, sz = door["step"]
        v["slots"].append({"id": f"st{n}", "size": size, "box": box, "floor_y": ar["y"], "tags": tags, "long": size == "Medium" and wide == 13,
                           "door": {"side": door["side"], "step": [sx, sz], "walk": [[sx, sz, door["stepY"], "slab"]]},
                           "opensAt": "Hamlet", "start": design if design and design != "library" else None})
    # 4. fixtures: the Mason's yard (front middle, facing out), the Hall Cornerstone and the Mason's Bench (the bench
    # only stands there if the yard can't be raised)
    if yard:
        door = st["doors"][yard_n]
        v["fixtures"].append({"name": "mason_yard", "at": door["cell"], "ground_y": yard["y"], "side": door["side"], "tier": "Hamlet"})
    # the Storehouse's 15 x 15 ground: front middle, the way its door faces (raised and rebuilt by the game)
    for n, ar in enumerate(st["areas"]):
        if ar["kind"] == "storehouse":
            door = st["doors"][n]
            v["fixtures"].append({"name": "storehouse", "at": door["cell"], "ground_y": ar["y"], "side": door["side"], "tier": "Hamlet"})
    for f in st["fixtures"]:
        if f["kind"] in ("hall_cornerstone", "mason_bench", "cow_pen"):
            x, y, z = f["at"]
            v["fixtures"].append({"name": f["kind"], "at": [x, z], "ground_y": y - 1, "tier": "Hamlet"})
    return v


def windmills(town, region):
    """Every layout's windmill (Mateo 2026-11-15): the site by its Town field from map/structures/windmill_sites.py, in
    place of the town generator's windmill stamps (only on fields of 900+ blocks, Vale everywhere, never raised).
    Row: ["windmill", x, z, tier, dy, side, sails, walk]; settle/windmill.js raises it when that tier is laid out."""
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "map", "structures"))
    import windmill_sites as WS
    region = WS.REGION.get(region, "vale")
    for n, v in enumerate(town["variants"]):
        v["fix"] = [f for f in v["fix"] if f[0] != "windmill"]
        row, why = WS.site(town, v, region)
        assert row, f"{town['name']} layout {n}: no windmill site ({why})"
        v["fix"].append(row)
        print(f"  {town['name']} {n}: windmill at {row[1]}, {row[2]} facing {row[5]}, sails {row[6]} ({why})")


def main(src, starters=None):
    towns = {}
    for path in sorted(glob.glob(os.path.join(src, "*.json"))):
        with open(path, encoding="utf8") as f:
            d = json.load(f)
        if d.get("format") != "hollow-crown-settlement/1":
            continue
        key = d["plot"]["name"].lower()
        st = None
        if starters:
            with open(os.path.join(starters, f"{key}.json"), encoding="utf8") as f:
                st = json.load(f)
            assert st["format"] == "hollow-crown-starter/1" and st["gate"] == d["plot"]["gate"], key
            line = tight(st, d["wall_radius"][1])   # the Hamlet wall line, from what the village laid
            trim = gate_trim(st, line)
            for v in d["variants"]:
                starter_hamlet(v, st, trim)
            lines, keep = ring_lines(d, st)   # the Town, City and Castle lines, from what each tier laid
        towns[key] = {"name": d["plot"]["name"], "gate": d["plot"]["gate"], "walls": d["wall_radius"], "clear": d["clear"],
                      "minimum": d["minimum"], "variants": [variant(v) for v in d["variants"]]}
        if st:   # the wall outline follows the land (walldata.js radiusAt): radii at even angles for a ring of radiiAt
            towns[key]["outline"] = {"radii": [round(r, 1) for r in st["wall"]["radii"]], "radiiAt": st["wall"]["radiiAt"], "tight": line, "lines": lines, "keep": [list(b) for b in keep]}
        windmills(towns[key], d["plot"].get("region"))
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "Siege_Nights_BP", "scripts", "settle", "towns_data.js")
    body = json.dumps(towns, separators=(",", ":"))
    with open(out, "w", encoding="utf8") as f:
        f.write("// Generated by tools/build_towns.py (export_towns.py) from the town generator's layouts and the starter villages. Do not edit by hand: run python3 tools/build_towns.py.\n")
        f.write(f"// {len(towns)} towns: {', '.join(t['name'] for t in towns.values())}\n")
        f.write(f"export const TOWN_CHARS = {json.dumps(CHARS)};\n")
        f.write(f"export const TOWNS = {body};\n")
    print(f"{out}: {len(towns)} towns, {len(body) // 1024} KB")


def windmills_only():
    """Re-site the windmills in the towns_data.js that is there, leaving everything else as it is (no layout inputs needed)."""
    import re
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "Siege_Nights_BP", "scripts", "settle", "towns_data.js")
    text = open(out, encoding="utf8").read()
    m = re.search(r"export const TOWNS = (\{.*\});\n", text)
    towns = json.loads(m.group(1))
    cfg = open(os.path.join(os.path.dirname(out), "..", "plots", "config.js"), encoding="utf8").read()
    region = {r.group(1).lower(): r.group(2) for r in re.finditer(r'name: "([^"]+)", region: "([^"]+)"', cfg)}
    for key, town in towns.items():
        windmills(town, region.get(key))
    body = json.dumps(towns, separators=(",", ":"))
    open(out, "w", encoding="utf8").write(text[:m.start(1)] + body + text[m.end(1):])
    print(f"{out}: windmills re-sited in {len(towns)} towns")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(usage=__doc__)
    ap.add_argument("dir", nargs="?"); ap.add_argument("--starter")
    ap.add_argument("--windmills-only", action="store_true", help="re-site the windmills in the existing towns_data.js and stop")
    a = ap.parse_args()
    if a.windmills_only: windmills_only()
    else: main(a.dir, a.starter)
