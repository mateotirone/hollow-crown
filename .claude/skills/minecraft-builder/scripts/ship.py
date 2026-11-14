"""Ships and piers (Gull's Rest's deep-water pier and its great ship, Mateo 2026-11-14: "a big sailboat at
Saltreach with a big dock ... a cool prop").

Two parts, registered in parts.py:

  ship   a block-built sailing ship moored on water: a curved hull fitted row by row (upside-down stairs where the
         bilge turns in), a raised quarterdeck over the captain's cabin and a forecastle over the galley, a lower
         deck with crew bunks, a mess table and the cargo hold, square sails on yards, shrouds and stays, a
         bowsprit with a jib, a crow's nest, stern lanterns and a gangway. Every room has a door or a stair.
  pier   a timber pier on log piles: a deck of one or more rectangles, stringers and cross beams, rails on the
         sides that are not for mooring, bollards and lamp posts along the mooring face, lamp posts along the rail.

Ship frame (local): u along the keel from the stern (u 0) to the stem (u length-1), y 0 the waterline row (the top
water block), w across, + to starboard. turn_cell (parts.py) places it facing `heading`. Every cell inside the hull
is written (air included), so stamping it over the sea leaves no water in the hold.
"""
import math

from materials import h3

SALT = dict(bottom="dark_oak_planks", boot="spruce_planks", wale="stripped_dark_oak_log", hull="oak_planks",
            stripe="warped_planks", rail="birch_fence", deck="oak_planks", castle="oak_planks", post="stripped_birch_log",
            mast="stripped_spruce_log", yard="spruce_log", sail="white_wool", band="cyan_wool", rig="spruce_fence",
            trim="spruce", glass="light_blue_stained_glass_pane", door="birch_door", pennant="cyan_wool",
            ballast="spruce_planks", carpet="cyan_carpet")

DEFAULT_MASTS = [  # u, top (rows over the deck it stands on), yards [[y over that deck, half span, sail rows]], nest
    {"at": 7, "top": 13, "yards": [[8, 5, 5]]},
    {"at": 23, "top": 27, "yards": [[10, 8, 6], [19, 6, 7]], "nest": 21},
    {"at": 36, "top": 22, "yards": [[10, 7, 4], [18, 5, 6]]},
]


def _lerp_line(a, b):
    """Cells of a stepped line from a to b (2D tuples), each step joined by a face (fences connect)."""
    (x0, y0), (x1, y1) = a, b
    n = max(abs(x1 - x0), abs(y1 - y0))
    out = []
    for k in range(n + 1):
        x = x0 + round((x1 - x0) * k / max(n, 1)); y = y0 + round((y1 - y0) * k / max(n, 1))
        if out and out[-1][0] != x and out[-1][1] != y: out.append((x, out[-1][1]))
        if not out or out[-1] != (x, y): out.append((x, y))
    return out


def ship_cells(s):
    """Local cells [u, y, w, block, {states}] of the ship described by spec part s."""
    M = dict(SALT); M.update(s.get("materials", {}))
    L = s.get("length", 47); B = s.get("beam", 13) // 2; K = s.get("keel", 5); D = s.get("deck", 3)
    A = s.get("aft", 11); F = s.get("fore", 9)
    QD = D + 3                    # quarterdeck block row (its walking row is QD + 1)
    FD = D + 2                    # forecastle deck block row
    masts = s.get("masts", DEFAULT_MASTS)
    C = {}

    def put(u, y, w, b, **p): C[(u, y, w)] = (b, p)

    def plan(u):                  # half beam at the rail
        if u < 0 or u >= L: return -1
        hb = B
        if u < 6: hb = B - 1.5 * (1 - u / 6)
        ub = L - 17
        if u > ub: hb = min(hb, B * math.sqrt(max(0.0, 1 - ((u - ub) / (L - 1 - ub + 0.5)) ** 2)))
        return hb

    def keel(u):
        if u < 3: return -K + (3 - u) * 0.67
        if u > L - 11: return -K + ((u - (L - 11)) / 10) ** 2 * (K + 1)
        return -K

    def top(u):                   # top row of the hull side (bulwark / castle walls)
        return QD if u < A else FD if u >= L - F else D

    def half(u, y):               # half width of the hull at row y
        k = keel(u); t = (y - k) / max(0.5, D - k)
        if t < 0: return -1
        if t >= 1: return math.floor(plan(u) + 0.5)
        return math.floor(plan(u) * math.sin(t * math.pi / 2) ** 0.6 + 0.5)

    def inside(u, y, w):
        return 0 <= u < L and math.ceil(keel(u)) <= y <= top(u) and abs(w) <= half(u, y)

    # ---- hull: a one-block shell; the bilge turns in with upside-down stairs; colour bands by row
    def hull_block(u, y, w):
        if y == top(u): return M["stripe"], {}
        if y <= -1: return M["bottom"], {}
        if y == 0: return M["boot"], {}
        if y == 1: return M["wale"], {"axis": "x"}
        if u < A and y > D: return M["castle"], {}
        return M["hull"], {}
    for u in range(L):
        for y in range(math.ceil(keel(u)), top(u) + 1):
            hw = half(u, y)
            for w in range(-hw, hw + 1):
                nb = [(u + 1, y, w), (u - 1, y, w), (u, y, w + 1), (u, y, w - 1), (u, y - 1, w)]
                if all(inside(*q) for q in nb):
                    continue
                b, p = hull_block(u, y, w)
                put(u, y, w, b, **p)
            # where the row below is narrower, an upside-down stair rounds the turn of the bilge
            below = half(u, y - 1) if y - 1 >= math.ceil(keel(u)) else -1
            if 0 <= below < hw:
                for sgn in (1, -1):
                    w = sgn * (below + 1)
                    if (u, y - 1, w) not in C:
                        put(u, y - 1, w, (M["bottom"] if y - 1 <= -1 else M["boot"]).replace("_planks", "_stairs"),
                            facing="n" if sgn > 0 else "s", half="top")
    # ---- inside: ballast below the lower deck, floors, air everywhere else (no sea left in the hold)
    for u in range(L):
        for y in range(math.ceil(keel(u)), top(u) + 1):
            hw = half(u, y)
            for w in range(-hw, hw + 1):
                if (u, y, w) in C: continue
                if y < -2: put(u, y, w, M["ballast"])
                elif y == -2: put(u, y, w, M["deck"])                       # lower deck floor
                elif y == D - 1: put(u, y, w, M["deck"])                    # main deck
                elif u < A and y == QD: put(u, y, w, M["deck"])             # quarterdeck
                elif u >= L - F and y == FD: put(u, y, w, M["deck"])        # forecastle deck
                else: put(u, y, w, "air")
    # rails on every hull edge at the top row
    edge = set()
    for u in range(L):
        t = top(u); hw = half(u, t)
        for w in range(-hw, hw + 1):
            if C.get((u, t, w), ("",))[0] in (M["stripe"],): edge.add((u, w))
    for (u, w) in edge: put(u, top(u) + 1, w, M["rail"])
    # deck lights: lanterns standing on the rail posts every few blocks along both sides and round the castle decks,
    # so the decks are lit from the rail (never a lantern chained down from a crow's nest or a yard, 2026-11-14)
    for (u, w) in edge:
        if abs(w) == half(u, top(u)) and u % 5 == 2 and 0 < u < L - 2:
            put(u, top(u) + 2, w, "lantern")

    # ---- the castles: front walls, doors, windows, stairs up
    trim = M["trim"]
    def wall_row(u, y0, y1, door_w=0, windows=()):
        hw = min(half(u, y) for y in range(y0, y1 + 1))
        for y in range(y0, y1 + 1):
            for w in range(-hw + 1, hw):
                if C.get((u, y, w), ("air",))[0] != "air": continue
                post = abs(w) in (hw - 1, 3)
                put(u, y, w, M["post"] if post else M["castle"], **({"axis": "y"} if post else {}))
        put(u, y0, door_w, M["door"], facing="e" if u < L // 2 else "w", hinge=False, upper=False)
        put(u, y0 + 1, door_w, M["door"], facing="e" if u < L // 2 else "w", hinge=False, upper=True)
        for w in windows:
            put(u, y0 + 1, w, M["glass"])
    wall_row(A - 1, D, QD - 1, windows=(-2, 2))
    wall_row(L - F, D, FD - 1, windows=())
    # quarterdeck rail across its front, with gaps for the two stairs
    hw_q = half(A - 1, QD)
    for w in range(-hw_q + 1, hw_q):
        if abs(w) == 4: continue
        put(A - 1, QD + 1, w, M["rail"])
    for sgn in (1, -1):                                   # stairs up to the quarterdeck, each side, rising aft
        w = sgn * 4
        for k in range(4):
            u = A + k; y = QD - k
            put(u, y, w, trim + "_stairs", facing="w", half="bottom")
            for yy in range(D, y): put(u, yy, w, M["castle"])
    hw_f = half(L - F, FD)
    for w in range(-hw_f + 1, hw_f):
        if abs(w) == 3: continue
        put(L - F, FD + 1, w, M["rail"])
    for sgn in (1, -1):                                   # stairs up to the forecastle, rising forward
        w = sgn * 3
        for k in range(3):
            u = L - F - 1 - k; y = FD - k
            put(u, y, w, trim + "_stairs", facing="e", half="bottom")
            for yy in range(D, y): put(u, yy, w, M["castle"])
    # stern windows and side lights of the great cabin; the cabin's stern lanterns
    for w in (-3, 0, 3):
        for y in (D + 1, D + 2):
            if (0, y, w) in C and C[(0, y, w)][0] != "air": put(0, y, w, M["glass"])
    for u in (3, 6, 9):
        hw = half(u, D + 1)
        for sgn in (1, -1): put(u, D + 1, sgn * hw, M["glass"])
    put(0, QD + 1, 0, M["rail"]); put(0, QD + 2, 0, M["rail"]); put(0, QD + 3, 0, "lantern")
    for sgn in (1, -1):
        hw = half(0, QD)
        put(0, QD + 2, sgn * hw, "lantern")
    # the rudder on the stern post
    for y in range(math.ceil(keel(0)), D):
        put(-1, y, 0, M["bottom"] if y < 1 else M["hull"])

    # ---- masts, yards, sails, nests, pennants
    def base_deck(u):
        return (QD + 1) if u < A else (FD + 1) if u >= L - F else (D)
    mast_tops = {}
    for m in masts:
        mu = m["at"]; dk = base_deck(mu); tp = dk + m["top"]
        for y in range(-1, tp + 1): put(mu, y, 0, M["mast"], axis="y")
        mast_tops[mu] = tp
        for (yy, span, rows) in m.get("yards", []):
            yy += dk
            for w in range(-span, span + 1): put(mu + 1, yy, w, M["yard"], axis="z")
            put(mu, yy, 0, M["mast"], axis="y")
            sw = span - 1
            band = yy - 1 - rows // 2 if rows >= 5 else None
            for r in range(rows):
                y = yy - 1 - r
                for w in range(-sw, sw + 1):
                    belly = 0 < r < rows - 1 and abs(w) <= sw - 2
                    b = M["band"] if y == band else M["sail"]
                    put(mu + 1, y, w, b)
                    if belly: put(mu + 2, y, w, b)          # the belly bulges forward, still joined to the sail behind
        if m.get("nest"):
            ny = dk + m["nest"]
            for du in range(-2, 3):
                for w in range(-2, 3):
                    if du == 0 and w == 0: continue
                    put(mu + du, ny, w, M["deck"])
                    if abs(du) == 2 or abs(w) == 2: put(mu + du, ny + 1, w, M["rail"])
            for du, w, f in ((1, 0, "w"), (-1, 0, "e"), (0, 1, "n"), (0, -1, "s")):
                put(mu + du, ny - 1, w, trim + "_stairs", facing=f, half="top")
        for k in range(3):                                   # a pennant streaming aft from the truck
            put(mu - 1 - k, tp, 0, M["pennant"])
            if k < 2: put(mu - 1 - k, tp - 1, 0, M["pennant"])
        put(mu, tp + 1, 0, M["rig"])
    # ---- shrouds: a stepped line each side, from the channel (a ledge one out from the side, on the waist) or the
    # castle rail, up to under the lowest yard
    for m in masts:
        mu = m["at"]; dk = base_deck(mu)
        low = min((yy for yy, _, _ in m.get("yards", [])), default=m["top"] - 2) + dk - 1
        waist = A <= mu - 1 < L - F
        for sgn in (1, -1):
            hw = math.floor(plan(mu - 1) + 0.5)
            start = (sgn * (hw + 1), D + 1) if waist else (sgn * hw, top(mu - 1) + 2)
            if waist:
                for u in range(mu - 3, mu + 2):
                    put(u, D, sgn * (half(u, D) + 1), trim + "_slab", half="top")
            for (w, y) in _lerp_line(start, (sgn * 1, low)):
                if (mu - 1, y, w) not in C or C[(mu - 1, y, w)][0] == "air": put(mu - 1, y, w, M["rig"])
    # ---- bowsprit, stays and the jib
    stem_y = FD + 1
    bow = [(L + k, stem_y + k // 3) for k in range(9)]
    for (u, y) in bow: put(u, y, 0, M["mast"], axis="x")
    for y in range(D, stem_y): put(L, y, 0, M["hull"])     # the stem carried down to the cutwater
    us = sorted(mast_tops)
    if len(us) >= 2:
        fore = us[-1]
        stay = _lerp_line((fore, mast_tops[fore] - 2), bow[-1])
        for (u, y) in stay:
            if C.get((u, y, 0), ("air",))[0] in ("air",): put(u, y, 0, M["rig"])
        line = {}
        for (u, y) in stay: line.setdefault(u, []).append(y)
        for (u, yb) in bow[1:-1]:                            # the jib: between the bowsprit and the forestay
            top_y = min(line.get(u, [yb])) - 1
            for y in range(yb + 1, top_y + 1):
                if C.get((u, y, 0), ("air",))[0] == "air": put(u, y, 0, M["sail"])
        for a, b in zip(us, us[1:]):                         # main stay, mizzen stay
            for (u, y) in _lerp_line((a, mast_tops[a] - 1), (b, base_deck(b) + 4)):
                if C.get((u, y, 0), ("air",))[0] == "air" and u not in (a, b): put(u, y, 0, M["rig"])

    # ---- the deck: hatch grating, capstan, wheel, barrels by the masts
    for u in range(26, 29):
        for w in (-1, 0, 1): put(u, D, w, trim + "_trapdoor", facing="n", half="bottom", open=False)
    put(31, D, 0, M["mast"], axis="y"); put(31, D + 1, 0, trim + "_fence")
    put(A - 2, QD + 1, 0, M["mast"], axis="y"); put(A - 3, QD + 1, 0, "dark_oak_trapdoor", facing="w", open=True, half="bottom")
    for (u, w) in ((22, 2), (22, -2), (24, 3), (35, 2), (34, -2), (20, -4)):
        put(u, D, w, "barrel", facing="up")
    put(22, D + 1, 2, "barrel", facing="up")
    for (u, y, w) in ((22, D + 2, 2), (24, D + 1, 3), (20, D + 1, -4), (35, D + 1, 2), (34, D + 1, -2)):
        put(u, y, w, "lantern")                              # lanterns on the deck cargo light the waist under the sails
    put(31, D + 2, 0, "lantern")                             # and one on the capstan

    # ---- stairs down to the lower deck (starboard of the waist), with a rail round the well
    su = A + 1
    for k in range(4):
        u = su + k; y = D - 1 - k
        for w in (1, 2):
            put(u, y, w, trim + "_stairs", facing="w", half="bottom")
            for yy in range(-1, y): put(u, yy, w, M["deck"])      # a solid flight down to the lower deck floor
    for k in range(1, 4):
        for w in (1, 2): put(su + k, D - 1, w, "air")
    for u in range(su + 1, su + 4):
        put(u, D, 0, M["rail"]); put(u, D, 3, M["rail"])
    for w in (1, 2): put(su + 4, D, w, M["rail"])

    # ---- the great cabin (under the quarterdeck): bed, chart table, books, lanterns
    put(3, D, 0, trim + "_fence"); put(3, D + 1, 0, trim + "_pressure_plate")
    put(4, D, 0, trim + "_fence"); put(4, D + 1, 0, trim + "_pressure_plate")
    put(3, D, 1, trim + "_stairs", facing="s", half="bottom"); put(4, D, -1, trim + "_stairs", facing="n", half="bottom")
    put(1, D, 2, "bed", facing="w", head=True); put(2, D, 2, "bed", facing="w", head=False)
    put(1, D, -2, "cartography_table"); put(2, D, -2, "lectern", facing="e")
    put(9, D, 3, "chest", facing="n"); put(9, D, -3, "bookshelf"); put(9, D + 1, -3, "bookshelf"); put(8, D, -3, "barrel", facing="up")
    for u in (2, 5, 9):
        put(u, QD - 1, 0 if u != 5 else 1, "lantern", hanging=True)
    for u in range(2, 7):
        for w in (-1, 0, 1):
            if C.get((u, D, w), ("air",))[0] == "air": put(u, D, w, M["carpet"])

    # ---- the galley (under the forecastle)
    gu = L - F + 2
    put(gu, D, -2, "smoker", facing="e"); put(gu + 1, D, -2, "barrel", facing="up"); put(gu, D, 2, "cauldron")
    put(gu + 1, D, 2, "barrel", facing="up"); put(gu + 3, D, 0, "crafting_table")
    put(gu + 2, D, 1, "lantern")

    # ---- the lower deck: bunks aft of the waist, a mess table, the hold forward; a 3-wide way down the middle
    LY = -1
    for (ua, ub) in ((14, 15), (17, 18), (20, 21)):
        for sgn in (1, -1):
            w = sgn * 4
            put(ua, LY, w, "bed", facing="w", head=True); put(ub, LY, w, "bed", facing="w", head=False)
    for (u, sgn) in ((16, 1), (16, -1), (19, -1)):
        put(u, LY, sgn * 4, "chest", facing="n" if sgn > 0 else "s")
    for u in range(25, 30):                                  # mess table along the port side, benches each side of it
        put(u, LY, -3, trim + "_fence"); put(u, LY + 1, -3, trim + "_pressure_plate")
        put(u, LY, -2, trim + "_stairs", facing="s", half="bottom"); put(u, LY, -4, trim + "_stairs", facing="n", half="bottom")
    for u in range(25, 30, 2): put(u, LY, 3, "barrel", facing="up")
    for u in list(range(31, 35)) + list(range(38, 43)):     # the hold: barrels two high, crates
        hw = half(u, LY) - 1
        for w in range(2, hw + 1):
            for sgn in (1, -1):
                put(u, LY, sgn * w, "barrel" if (u + w) % 3 else "chest", facing="up" if (u + w) % 3 else ("n" if sgn > 0 else "s"))
                if (u + w) % 2 == 0 and (u + w) % 3: put(u, LY + 1, sgn * w, "barrel", facing="up")
    for u in range(3, 10):                                   # stores aft, under the cabin
        hw = half(u, LY) - 1
        for sgn in (1, -1):
            if hw >= 2: put(u, LY, sgn * hw, "barrel", facing="up")
    for u in (5, 12, 16, 20, 26, 29, 33, 40):                # lanterns hung from the deck beams over the way
        put(u, 1, 0 if u not in (7, 23, 36) else 1, "lantern", hanging=True)

    # ---- gangway: an opening in the bulwark and a plank out to the pier
    g = s.get("gangway")
    if g:
        sgn = 1 if g.get("side", "port") == "starboard" else -1
        gu0 = g.get("at", 27); gw = g.get("w", 3) // 2; out = g.get("out", 1)
        for u in range(gu0 - gw, gu0 + gw + 1):
            hw = half(u, D)
            put(u, D, sgn * hw, "air"); put(u, D + 1, sgn * hw, "air")
        for u in range(gu0 - gw - 1, gu0 + gw + 2):
            hw = half(u, D)
            for k in range(1, out + 1):
                put(u, D - 1, sgn * (hw + k), trim + "_slab", half="top")
                if abs(u - gu0) > gw: put(u, D, sgn * (hw + k), M["rail"])
    out = []
    for (u, y, w), (b, p) in C.items():
        out.append([u, y, w, b] + ([p] if p else []))
    return out


def ship(ctx, s):
    """Part "ship": see the module docstring. at [x, y, z] = the stern's centre on the waterline row, heading = where
    the bow points; length (47), beam (13), keel (5 rows under the waterline), deck (3: the main deck's walking row),
    aft / fore (castle lengths 11 / 9), masts, gangway {"side", "at", "w", "out"}, materials (role -> block, SALT)."""
    from parts import turn_cell
    for c in ship_cells(s):
        x, y, z, b, *st = turn_cell(c, s["at"], s.get("heading", "e"))
        p = dict(st[0]) if st else {}
        if b == "air": ctx.set(x, y, z, "frame", raw="air"); continue
        stage = "frame" if b.endswith("_log") or "planks" in b else "details"
        ctx.set(x, y, z, stage, raw=b, **p)


def pier(ctx, s):
    """Part "pier": a timber pier on piles. rects [[x0, z0, x1, z1], ...] (the deck, inclusive), y (deck block row),
    bed (the row the piles stand on, -8), moor ("n" / "s" / "e" / "w" sides kept open for mooring, with bollards),
    deck / deck2 (planks; every fifth board the second), pile (stripped_oak_log), beam (stripped_oak_log), rail
    (oak_fence), bollard (polished_blackstone_wall), lamp_every (8)."""
    y = s["y"]; bed = s.get("bed", y - 10)
    deck = s.get("deck", "oak_planks"); deck2 = s.get("deck2", "spruce_planks")
    pile = s.get("pile", "stripped_oak_log"); beam = s.get("beam", "stripped_oak_log")
    rail = s.get("rail", "oak_fence"); bollard = s.get("bollard", "polished_blackstone_wall")
    moor = set(s.get("moor", "")); every = s.get("lamp_every", 8)
    cells = set()
    for x0, z0, x1, z1 in s["rects"]:
        for x in range(min(x0, x1), max(x0, x1) + 1):
            for z in range(min(z0, z1), max(z0, z1) + 1): cells.add((x, z))
    D = {"n": (0, -1), "s": (0, 1), "e": (1, 0), "w": (-1, 0)}
    for (x, z) in cells:
        ctx.set(x, y, z, "floors", raw=deck2 if x % 4 == 0 else deck)          # darker boards over the pile rows
        for yy in range(y + 1, y + 4): ctx.setif(x, yy, z, "floors", raw="air")
    edges = {}
    for (x, z) in cells:
        out = [d for d, (dx, dz) in D.items() if (x + dx, z + dz) not in cells]
        if out: edges[(x, z)] = out
    land = set(s.get("land", ""))                      # the side that joins the quay: no rail, no beam
    for (x, z), out in edges.items():                  # stringers under every edge, along it
        if all(d in land for d in out): continue
        ax = "x" if any(d in "ns" for d in out) else "z"
        ctx.set(x, y - 1, z, "frame", raw=beam, axis=ax)
    for (x, z) in cells:                               # piles: rows across every 4, under the edges and the middle
        out = edges.get((x, z), [])
        along_x = any(d in "ns" for d in out); along_z = any(d in "ew" for d in out)
        if out and all(d in land for d in out): continue
        on = (x % 4 == 0 and (along_x or z % 4 == 0)) or (z % 4 == 0 and along_z) or (along_x and along_z)
        if not on: continue
        for yy in range(bed, y): ctx.set(x, yy, z, "foundation", raw=pile, axis="y")
    for (x, z) in cells:                               # cross beams on the pile rows
        if x % 4 == 0 and (x, z) not in edges: ctx.setif(x, y - 1, z, "frame", raw=beam, axis="z")
    lamps = 0
    for (x, z), out in sorted(edges.items()):
        if all(d in land for d in out): continue
        mooring = any(d in moor for d in out)
        k = x if any(d in "ns" for d in out) else z
        if mooring:
            if k % 4 == 2: ctx.set(x, y + 1, z, "details", raw=bollard)
            elif k % every == 0:
                ctx.set(x, y + 1, z, "details", raw=rail); ctx.set(x, y + 2, z, "details", raw=rail); ctx.set(x, y + 3, z, "details", raw="lantern"); lamps += 1
        else:
            ctx.set(x, y + 1, z, "details", raw=rail)
            if k % every == 0:
                ctx.set(x, y + 2, z, "details", raw=rail); ctx.set(x, y + 3, z, "details", raw="lantern"); lamps += 1
    ctx.info.setdefault("piers", []).append({"rects": s["rects"], "y": y, "lamps": lamps})
