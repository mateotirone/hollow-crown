"""Each boss site drawn as a whole area of the map (Mateo, 2026-11-12: "not just a monument, but the full area"):
the ground shaped against the real map and blended into it at the edges, the fight grounds, the approach, the set
dressing, and the landmark seen from far off. Shipped as the site's LANDMARKS stamp (unlocks/landmark_stamps.js):
the stamp goes down first and the bosses' own plan (unlocks/plans.js) on top, so every cell their code needs wins.

Offsets are from the site plan's centre (the same centre plans.js uses), y = 0 at that centre's y.

  mother   the Cradle Tree area, south of Mirelight: a vast mangrove on a raised knoll over the cradle cave, roots
           sprawling out across the fen, shallow black-water pools, the sunken Changeling Glade on the approach
           (walled by arching roots, where the changelings come for you) and the ramp down into the cave
"""
import math

from area_ground import Ground, shape
from landmarks import D, CARD

ANCHORS = {"huntsman": (60, -1130), "bride": (-690, 130), "seneschal": (850, 590), "mother": (-120, 1060), "mirelight": (-60, 900)}


def disc(r):
    n = int(r) + 1
    return [(x, z) for x in range(-n, n + 1) for z in range(-n, n + 1) if math.hypot(x, z) <= r]


def blob(d, cx, cy, cz, r, mix, salt=0, squash=1.0, only_empty=False):
    n = int(r) + 1
    for x in range(-n, n + 1):
        for y in range(-n, n + 1):
            for z in range(-n, n + 1):
                if math.hypot(x, y / squash, z) <= r - 0.6 * d.r(cx + x, cy + y, cz + z, salt):
                    c = (cx + x, cy + y, cz + z)
                    if only_empty and d.get(*c) not in (None, "air"): continue
                    d.put(*c, d.pick(*c, mix, salt) if isinstance(mix, list) else mix)


def tube(d, pts, r0, r1, mix, salt=0, keep=None, axis=None):
    """A thick limb along a polyline of (x, y, z), radius r0 at the start to r1 at the end."""
    segs = list(zip(pts, pts[1:]))
    total = sum(math.dist(a, b) for a, b in segs) or 1
    done = 0
    for a, b in segs:
        L = math.dist(a, b); n = max(1, int(L * 2))
        for k in range(n + 1):
            t = k / n; f = (done + L * t) / total
            p = [a[i] + (b[i] - a[i]) * t for i in range(3)]
            rr = r0 + (r1 - r0) * f
            m = int(rr) + 1
            for x in range(-m, m + 1):
                for y in range(-m, m + 1):
                    for z in range(-m, m + 1):
                        if x * x + y * y + z * z <= rr * rr:
                            c = (round(p[0] + x), round(p[1] + y), round(p[2] + z))
                            if keep and not keep(*c): continue
                            b_ = d.pick(*c, mix, salt) if isinstance(mix, list) else mix
                            if axis: d.put(*c, b_, axis=axis)
                            else: d.put(*c, b_)
        done += L


def bezier(p0, p1, p2, n=6):
    return [tuple(p0[i] * (1 - t) ** 2 + 2 * p1[i] * (1 - t) * t + p2[i] * t * t for i in range(3)) for t in [k / n for k in range(n + 1)]]


# ---------------------------------------------------------------- the Mother of Changelings


def mother(cave_r=13.5, floor=-12, h=9, ramp=11):
    """The Cradle Tree area over the changelings' cave."""
    ax, az = ANCHORS["mother"]
    G = Ground(ax, az, None)
    G.y0 = G.world(0, 0)                 # cradlePlan: the centre is the ground at the anchor
    d = D("boss_mother", seed=731)
    R0, R = 48, 64
    GX, GZ, GR = 0, 47, 13               # the Changeling Glade, on the approach from the south
    mouth = math.ceil(cave_r) + ramp     # the ramp's top step (z), y 0
    in_cave = lambda x, y, z: math.hypot(x, z) <= cave_r + 1.5 and floor - 1 <= y <= floor + h + 1
    in_ramp = lambda x, y, z: abs(x) <= 2 and 8 <= z <= mouth + 1 and y <= 4
    glade_d = lambda x, z: math.hypot(x - GX, z - GZ)
    WOOD = [("mangrove_log", 6), ("mangrove_wood", 2), ("dark_oak_log", 1)]

    def n2(x, z, s):
        return math.sin(x * 0.11 + s) * math.cos(z * 0.093 + 2 * s) + 0.6 * math.sin((x - z) * 0.17 + 3 * s)

    def pool(x, z):
        r = math.hypot(x, z)
        return 24 < r < R0 - 2 and glade_d(x, z) > GR + 9 and not (abs(x) <= 4 and z > 0) and n2(x, z, 1.7) > 0.72

    def target(x, z, real):
        r = math.hypot(x, z)
        t = 7.5 * math.exp(-(r / 26) ** 2) + 2.2 * n2(x, z, 0.4) + 1.0
        g = glade_d(x, z)
        if g < GR: t = -1 + (0.4 if (x * 7 + z * 3) % 5 == 0 else 0)
        elif g < GR + 8: t = max(t, -1 + 3.6 * math.sin(math.pi * min(1, (g - GR) / 8) * 0.5) + 0.8 * n2(x, z, 2.2))
        if abs(x) <= 3 and mouth - 2 <= z <= GZ - GR + 1: t = -1           # the cut from the glade to the ramp
        elif abs(x) <= 5 and mouth - 2 <= z <= GZ - GR + 2: t = min(t, 1.5)
        if pool(x, z): t = -3
        return t if pool(x, z) else max(t, -1)

    TOP = lambda x, y, z: d.pick(x, y, z, [("grass_block", 7), ("moss_block", 3), ("podzol", 2), ("mud", 1), ("muddy_mangrove_roots", 1)], 11)
    SUB = lambda x, y, z: d.pick(x, y, z, [("mud", 3), ("packed_mud", 2), ("dirt", 2)], 12)
    skip = lambda x, z: math.hypot(x, z) <= cave_r + 1 and False
    T = shape(d, G, R0, R, target, TOP, SUB, skip)
    for (x, z), y in T.items():                                            # the shallow black-water pools
        if pool(x, z) and math.hypot(x, z) < R0:
            d.put(x, y, z, "mud"); d.put(x, y + 1, z, "water"); d.put(x, y + 2, z, "water")
            T[(x, z)] = y + 2
    ground = lambda x, z: T.get((round(x), round(z)), 0)

    keep = lambda x, y, z: not in_cave(x, y, z) and not in_ramp(x, y, z) and not (glade_d(x, z) < GR - 1 and y < ground(x, z) + 7)

    # ---- the trunk: vast, flared, slightly twisting, on the knoll over the cave roof
    tx, tz = 0, -3
    for y in range(1, 48):
        r = 6.0 + 4.0 * math.exp(-y / 4.5) - y * 0.02
        ox, oz = tx + math.sin(y * 0.10) * 1.5, tz + math.cos(y * 0.08) * 1.2
        for (x, z) in disc(r + 0.4 * math.sin(math.atan2(z, x) * 5 + y * 0.3) if False else r):
            c = (round(ox + x), y, round(oz + z))
            if keep(*c) and y > ground(c[0], c[2]) - 3: d.put(*c, d.pick(*c, WOOD, 1), axis="y")
    # ---- great buttress roots: up high on the trunk, arching out and down, then snaking away across the fen
    for k in range(13):
        a = math.radians(8 + 360 / 13 * k + 9 * math.sin(k * 2.1))
        ux, uz = math.sin(a), math.cos(a)
        if uz > 0.93: continue                                            # the ramp side gets its own two arches
        reach = 40 + 10 * d.r(k, 3, 0)
        pts = [(tx + ux * 6, 16 + 3 * d.r(k, 0, 0), tz + uz * 6), (tx + ux * 13, 12, tz + uz * 13)]
        for s in range(5):
            rr = 19 + (reach - 19) * s / 4
            wob = math.radians(14 * math.sin(k + s * 1.3))
            px, pz = tx + math.sin(a + wob) * rr, tz + math.cos(a + wob) * rr
            sink = -1 if s < 4 else -3
            pts.append((px, ground(px, pz) + (2 if s == 0 else sink + 1), pz))
        tube(d, pts, 3.0, 0.9, WOOD, 2, keep)
        # a side root off the middle
        m = pts[3]
        b = math.radians(math.degrees(a) + (35 if k % 2 else -35))
        e = (m[0] + math.sin(b) * 14, 0, m[2] + math.cos(b) * 14)
        tube(d, [m, ((m[0] + e[0]) / 2, ground((m[0] + e[0]) / 2, (m[2] + e[2]) / 2) + 2, (m[2] + e[2]) / 2), (e[0], ground(e[0], e[2]) - 1, e[2])], 1.6, 0.7, WOOD, 3, keep)
    for s in (-1, 1):   # two roots arching right over the ramp mouth
        pts = [(tx + s * 5, 16, tz + 5), (s * 6, 15, 14), (s * 5, 11, mouth - 4), (s * 7, 6, mouth + 3), (s * 9, ground(s * 9, mouth + 7), mouth + 7)]
        tube(d, pts, 2.4, 1.2, WOOD, 3, keep)

    # ---- the Changeling Glade: a ring of roots arching in over the sunken floor
    for k in range(6):
        a = math.radians(60 * k + 30)                                       # none due south (the way in) or north (the cut)
        ux, uz = math.sin(a), math.cos(a)
        o = (GX + ux * (GR + 7), 0, GZ + uz * (GR + 7))
        i = (GX + ux * (GR + 0.5), 0, GZ + uz * (GR + 0.5))
        top = (GX + ux * (GR + 1), 10 + 2 * d.r(k, 9, 9), GZ + uz * (GR + 1))
        pts = bezier((o[0], ground(o[0], o[2]) - 1, o[2]), top, (i[0], -1, i[2]), 10)
        tube(d, pts, 1.5, 0.7, WOOD, 6, lambda x, y, z: not in_ramp(x, y, z))
        hx, hz = round(top[0] - ux * 1.5), round(top[2] - uz * 1.5)       # a cradle hanging under each arch
        yb = max((c[1] for c in d.cells if c[0] == hx and c[2] == hz and d.get(*c) in ("mangrove_log", "mangrove_wood", "dark_oak_log")), default=None)
        if yb:
            for y in range(4, yb): d.put(hx, y, hz, "iron_chain", axis="y")
            d.put(hx, 3, hz, "spruce_slab", half="top")
            for f, (dx, dz) in CARD.items(): d.put(hx + dx, 3, hz + dz, "spruce_trapdoor", facing=f, open=True)
    for (x, z) in disc(GR - 0.5):                                          # the glade floor, trodden and mossy
        X, Z = GX + x, GZ + z
        d.put(X, -1, Z, d.pick(X, -1, Z, [("moss_block", 4), ("mud", 2), ("podzol", 2), ("muddy_mangrove_roots", 1), ("coarse_dirt", 1)], 21))
        for y in range(0, 8):
            if d.get(X, y, Z) is None: d.air(X, y, Z)
        t = d.r(X, 0, Z, 22)
        if t < 0.18: d.put(X, 0, Z, "moss_carpet")
    for (x, z) in ((-6, -3), (6, 2), (-3, 7), (5, -6), (0, 0)):                 # stumps and dolls of sticks
        X, Z = GX + x, GZ + z
        if (x, z) == (0, 0):
            for (dx, dz) in disc(1.5): d.put(X + dx, -1, Z + dz, "mossy_cobblestone")
            d.put(X, 0, Z, "mossy_cobblestone_wall"); d.put(X, 1, Z, "ochre_froglight")
            continue
        d.put(X, 0, Z, "mangrove_log", axis="y"); d.put(X, 1, Z, "mangrove_fence") if d.r(X, 1, Z) < 0.6 else None
    for (x, z) in ((-9, 4), (9, -2), (-8, -7), (8, 7), (0, -10)):             # caged froglights round the edge
        X, Z = GX + x, GZ + z
        for y in (0, 1): d.put(X, y, Z, "mangrove_fence")
        d.put(X, 2, Z, "iron_bars"); d.put(X, 3, Z, "ochre_froglight" if (x + z) % 2 else "verdant_froglight"); d.put(X, 4, Z, "mangrove_slab", half="bottom")
    for z in range(mouth - 2, GZ - GR + 2):                                 # the cut from the glade to the ramp, mud-brick walled
        for x in (-3, 3):
            for y in range(-1, max(1, ground(x + (1 if x > 0 else -1) * 2, z)) + 1): d.put(x, y, z, d.pick(x, y, z, [("mud_bricks", 3), ("packed_mud", 1), ("mossy_cobblestone", 1)], 23))
        for x in range(-2, 3):
            d.put(x, -1, z, "mud_brick_slab" if z % 2 else "packed_mud", **({"half": "top"} if z % 2 else {}))
            for y in range(0, 4): d.air(x, y, z)

    # ---- the boardwalk in from the south, across the pools to the glade
    for z in range(GZ + GR - 1, R + 1):
        r = math.hypot(0, z)
        y = max(1, max(ground(x, z) for x in (-1, 0, 1)) + 1)
        for x in (-1, 0, 1): d.put(x, y, z, "mangrove_slab", half="bottom")
        for x in (-1, 0, 1):
            for k in range(1, 5): d.air(x, y + k, z)
        if z % 4 == 0:
            for x in (-2, 2):
                for k in range(ground(x, z) - 1, y + 2): d.put(x, k, z, "mangrove_log", axis="y")
                d.put(x, y + 2, z, "mangrove_fence")
            if z % 8 == 0: d.put(2, y + 3, z, "ochre_froglight")
        else:
            for x in (-2, 2): d.put(x, y + 1, z, "mangrove_fence")

    # ---- dead snags out in the fen
    for k in range(9):
        a = math.radians(360 / 9 * k + 13)
        rr = 33 + 12 * d.r(k, 7, 1)
        x, z = round(math.sin(a) * rr), round(math.cos(a) * rr)
        if glade_d(x, z) < GR + 10 or abs(x) < 5 and z > 0 or pool(x, z): continue
        g = ground(x, z); tall = 6 + int(6 * d.r(k, 8, 1))
        for y in range(g - 1, g + tall): d.put(x, y, z, "stripped_mangrove_log" if d.r(x, y, z) < 0.3 else "mangrove_log", axis="y")
        for s in (-1, 1):
            b = math.radians(math.degrees(a) + 90 * s)
            y0 = g + tall - 3 - (s > 0)
            tube(d, [(x, y0, z), (x + math.sin(b) * 3, y0 + 2, z + math.cos(b) * 3), (x + math.sin(b) * 4, y0 + 4, z + math.cos(b) * 4)], 0.6, 0.5, "mangrove_log")
        d.put(x, g + tall, z, "hanging_roots") if False else None

    # ---- limbs and the canopy (vast: some 75 across)
    for k in range(9):
        a = math.radians(15 + 40 * k)
        ux, uz = math.sin(a), math.cos(a)
        reach = 25 + 6 * d.r(k, 1, 0)
        y1 = 46 + 5 * d.r(k, 2, 0)
        end = (tx + ux * reach, y1, tz + uz * reach)
        tube(d, [(tx, 30 + (k % 3) * 4, tz), (tx + ux * 10, 38, tz + uz * 10), (tx + ux * 18, 44, tz + uz * 18), end], 2.8, 1.1, WOOD, 4)
        LEAF = [("mangrove_leaves", 7), ("azalea_leaves", 1), ("moss_block", 1)]
        for j in range(4):                                                # a ragged cloud of lobes, not one ball
            b = a + math.radians(70 * (d.r(k, j, 3) - 0.5))
            rr = reach * (0.55 + 0.5 * d.r(k, j, 4))
            c = (round(tx + math.sin(b) * rr), round(y1 - 4 + 9 * d.r(k, j, 5)), round(tz + math.cos(b) * rr))
            blob(d, *c, 4.5 + 4.5 * d.r(k, j, 6), LEAF, 5 + j, squash=0.5 + 0.2 * d.r(k, j, 7), only_empty=True)
    blob(d, tx, 53, tz, 12, [("mangrove_leaves", 7), ("azalea_leaves", 2)], 6, squash=0.5, only_empty=True)
    leaves = [c for c, (b, _) in d.cells.items() if b.endswith("leaves")]
    for (x, y, z) in leaves:                                                # hanging roots and vines under the canopy
        if d.get(x, y - 1, z) is None and d.r(x, y, z) < 0.2:
            for k in range(1 + int(6 * d.r(x, 1, z))):
                c = (x, y - 1 - k, z)
                if d.get(*c) is None and c[1] > ground(x, z) + 4: d.put(*c, "hanging_roots" if k else "mangrove_roots")
    for k in range(10):                                                     # empty cradles on chains under the limbs
        a = math.radians(18 + 36 * k)
        rr = 13 + 6 * (k % 2)
        x, z = round(tx + math.sin(a) * rr), round(tz + math.cos(a) * rr)
        top = max((c[1] for c in d.cells if c[0] == x and c[2] == z and c[1] > 20 and d.get(*c) != "air"), default=None)
        if not top: continue
        yb = ground(x, z) + 9 + (k % 3) * 3
        for y in range(yb + 1, top): d.put(x, y, z, "iron_chain", axis="y")
        d.put(x, yb, z, "spruce_slab", half="top")
        for f, (dx, dz) in CARD.items(): d.put(x + dx, yb, z + dz, "spruce_trapdoor", facing=f, open=True)
        if k % 2 == 0: d.put(x, yb - 1, z, "ochre_froglight")
    # ---- set dressing on the ground
    for (x, z), y in T.items():
        if math.hypot(x, z) > R0 + 6 or pool(x, z) or d.get(x, y + 1, z) not in (None, "air"): continue
        if glade_d(x, z) < GR: continue
        t = d.r(x, y, z, 31)
        if t < 0.10: d.put(x, y + 1, z, "moss_carpet")
        elif t < 0.17: d.put(x, y + 1, z, "short_grass")
        elif t < 0.20: d.put(x, y + 1, z, "fern")
    for (x, z) in disc(GR - 1.5):                                          # keep the fight floor clear
        X, Z = GX + x, GZ + z
        for y in range(0, 9):
            if d.get(X, y, Z) in ("mangrove_log", "mangrove_wood", "dark_oak_log", "hanging_roots", "mangrove_roots"): d.air(X, y, Z)
    d.meta["glade"] = {"center": [GX, -1, GZ], "r": GR}
    d.meta["y0"] = G.y0
    return d


# ---------------------------------------------------------------- the Drowned Bride


def bride():
    """The drowned village of Brannoc round the Chapel of Saint Brannoc, Gull Bay: the chapel on the sea bed under some
    nineteen blocks of water, its bell tower carried up out of the sea as a great spired landmark, the drowned
    churchyard and cottages on a silted shoal round it, a churchyard islet, and a broken causeway from the shallows."""
    ax, az = ANCHORS["bride"]
    G = Ground(ax, az, None)
    G.y0 = 0
    bed = G.world(0, 0); S = G.water(0, 0) if G.water(0, 0) is not None else bed + 19
    G.y0 = min(bed, S - 10)               # chapelPlan: floor = min(sea bed, surface - 10)
    S = S - G.y0                          # the sea surface, relative (19 here)
    d = D("boss_bride", seed=711)
    R0, R = 52, 70
    NAVE = (-10, 10, -5, 5)               # chapel shell incl. walls (plans.js CHAPEL), floor 0, roof 9
    TX = -12                              # the tower's middle (plans.js tower x -14..-10, z -2..2)
    ISLE = (27, -4)                       # the churchyard islet
    STONE_LO = [("prismarine_bricks", 3), ("mossy_stone_bricks", 4), ("dark_prismarine", 1), ("mossy_cobblestone", 1), ("stone_bricks", 2)]
    STONE_MID = [("stone_bricks", 5), ("mossy_stone_bricks", 2), ("cracked_stone_bricks", 2), ("andesite", 1)]
    PALE = [("smooth_sandstone", 6), ("sandstone", 2), ("cut_sandstone", 1), ("calcite", 1)]
    near_nave = lambda x, z: NAVE[0] - 3 <= x <= NAVE[1] + 3 and NAVE[2] - 3 <= z <= NAVE[3] + 3

    def n2(x, z, s_):
        return math.sin(x * 0.09 + s_) * math.cos(z * 0.083 + 2 * s_) + 0.5 * math.sin((x + z) * 0.15 + 3 * s_)

    def target(x, z, real):
        r = math.hypot(x, z)
        t = max(real, 1.5 + 5 * math.exp(-(r / 30) ** 2) + 1.5 * n2(x, z, 0.3))     # the silted shoal
        if near_nave(x, z): t = min(t, 0.0 if NAVE[0] <= x <= NAVE[1] and NAVE[2] <= z <= NAVE[3] else 1.0)
        if -18 <= x <= -6 and -6 <= z <= 6: t = 0                                  # under the tower
        gi = math.hypot(x - ISLE[0], (z - ISLE[1]) * 1.3)
        if gi < 13: t = max(t, S + 1 + 2.5 * math.cos(gi / 13 * math.pi / 2) + 0.6 * n2(x, z, 1.1))
        return t

    TOP = lambda x, y, z: (d.pick(x, y, z, [("grass_block", 3), ("gravel", 2), ("coarse_dirt", 1), ("stone", 1)], 3) if y > S else
                           d.pick(x, y, z, [("gravel", 5), ("sand", 3), ("clay", 1), ("mossy_cobblestone", 1)], 4))
    SUB = lambda x, y, z: d.pick(x, y, z, [("gravel", 2), ("stone", 2), ("andesite", 1), ("dirt", 1)], 5)
    T = shape(d, G, R0, R, target, TOP, SUB)
    ground = lambda x, z: T.get((round(x), round(z)), G.real(round(x), round(z)))

    # ---------------- the bell tower: 11 square with clasping buttresses, carried from the sea bed to a copper spire
    land = S + 3                          # the landing floor: the plan's tower top is S + 4
    shaft0, bell0 = land + 5, land + 23   # shaft walls from here; the bell chamber
    corn = bell0 + 9                      # cornice
    spire_top = corn + 26
    def wall_mat(x, y, z):
        if y <= S + 1: return d.pick(x, y, z, STONE_LO, 1)
        if y <= land + 4: return d.pick(x, y, z, STONE_MID, 1)
        return d.pick(x, y, z, PALE, 1)
    def quoin(y):
        return "polished_andesite" if y <= land + 4 else "cut_sandstone"
    for y in range(-3, corn + 1):
        for u in range(-6, 7):
            for z in range(-6, 7):
                x = TX + u
                au, az_ = abs(u), abs(z)
                corner = au >= 4 and az_ >= 4
                if y <= land + 4:                                          # the base block, 11 square, solid
                    if au <= 5 and az_ <= 5:
                        if au <= 2 and az_ <= 2: continue                  # the plan's own tower
                        if y >= land and au <= 4 and az_ <= 4: continue    # the landing room
                        edge = au == 5 or az_ == 5
                        if y >= land and edge and not corner:                # the landing's arches, through the outer wall too
                            off = z if au == 5 else u
                            if abs(off) <= (1 if y < land + 3 else 0 if y == land + 3 else -1): continue
                        d.put(x, y, z, quoin(y) if edge and corner else wall_mat(x, y, z))
                    elif corner and au <= 6 and az_ <= 6 and y <= land + 7:   # clasping buttresses, stepping
                        if not (au == 6 and az_ == 6): d.put(x, y, z, wall_mat(x, y, z))
                else:                                                      # the shaft and bell chamber, 9 square
                    if au > 5 or az_ > 5: continue
                    if corner and au <= 5 and az_ <= 5:                    # corner buttresses, 2 square, up to the cornice
                        d.put(x, y, z, quoin(y) if (au == 5 and az_ == 5) else wall_mat(x, y, z)); continue
                    if au == 4 or az_ == 4:
                        if au == 4 and az_ == 4: continue
                        off = z if au == 4 else u
                        if shaft0 + 2 <= y <= shaft0 + 9 and off in (-2, 0, 2) and not (off != 0 and y == shaft0 + 9):
                            d.put(x, y, z, "iron_bars") if y < shaft0 + 9 or off == 0 else None   # lancets
                            continue
                        if bell0 <= y <= bell0 + 6:
                            wdt = 2 if y <= bell0 + 4 else 1 if y == bell0 + 5 else 0
                            if abs(off) <= wdt:                            # the open bell arches, pointed
                                if y == bell0: d.put(x, y, z, "stone_brick_wall")
                                continue
                        d.put(x, y, z, wall_mat(x, y, z))
                    elif y in (shaft0, bell0 - 1) and au < 4 and az_ < 4:
                        d.put(x, y, z, "spruce_planks" if y == bell0 - 1 else d.pick(x, y, z, STONE_MID, 2))   # floors
    for y in (land - 1,):                                                  # the landing floor and its balcony ledge
        for u in range(-6, 7):
            for z in range(-6, 7):
                if abs(u) <= 2 and abs(z) <= 2: continue
                if abs(u) == 6 and abs(z) == 6: continue
                d.put(TX + u, y, z, "stone_bricks" if max(abs(u), abs(z)) < 6 else "stone_brick_slab", **({} if max(abs(u), abs(z)) < 6 else {"half": "top"}))
    for u in range(-4, 5):                                                 # landing walls with an arch each side
        for z in range(-4, 5):
            if max(abs(u), abs(z)) != 4 or (abs(u) == 4 and abs(z) == 4): continue
            off = z if abs(u) == 4 else u
            for y in range(land, land + 5):
                if abs(off) <= (1 if y < land + 3 else 0 if y == land + 3 else -1): continue
                d.put(TX + u, y, z, d.pick(TX + u, y, z, STONE_MID, 3))
        for z in range(-3, 4):
            if abs(u) <= 3: d.put(TX + u, land + 5, z, d.pick(TX + u, land + 5, z, STONE_MID, 4))   # its ceiling = shaft floor
    for y in (land + 5, bell0 - 1, corn):                                  # string courses: upside-down stairs all round
        for u in range(-6, 7):
            for z in range(-6, 7):
                if max(abs(u), abs(z)) != 6 or (abs(u) == 6 and abs(z) == 6): continue
                f = "e" if u == 6 else "w" if u == -6 else "s" if z == 6 else "n"
                d.put(TX + u, y, z, "stone_brick_stairs" if y < shaft0 else "smooth_sandstone_stairs", facing=f, half="top")
    for z in range(-5, 6):                                                 # the cornice roof
        for u in range(-5, 6): d.put(TX + u, corn, z, "cut_sandstone" if max(abs(u), abs(z)) == 5 else "stone_bricks")
    # the bell, on chains from the cornice
    for y in range(bell0 + 4, corn): d.put(TX, y, 0, "iron_chain", axis="y")
    d.put(TX, bell0 + 3, 0, "bell", bs={"attachment": "hanging", "direction": 0})
    for y in (bell0 + 2,): d.put(TX, y, 0, "lantern", hanging=True) if False else None
    # corner pinnacles
    for su in (-5, 5):
        for sz in (-5, 5):
            x = TX + su
            d.put(x, corn + 1, sz, "chiseled_stone_bricks")
            for y in range(corn + 2, corn + 5): d.put(x, y, sz, "cut_sandstone" if y < corn + 4 else "sandstone_wall")
            d.put(x, corn + 5, sz, "sandstone_wall"); d.put(x, corn + 6, sz, "lightning_rod", bs={"facing_direction": 1})
    # the spire: octagonal, oxidized copper, a little lean at the tip, a ragged hole torn in the seaward side
    COP = [("deepslate_tiles", 6), ("polished_deepslate", 2), ("cobbled_deepslate", 1)]   # slate, copper ribs
    for y in range(corn + 1, spire_top):
        t = (y - corn - 1) / (spire_top - corn - 1)
        rr = 4.6 * (1 - t) + 0.4
        lx = -1.2 * t * t
        for u in range(-5, 6):
            for z in range(-5, 6):
                a, b = u - lx, z
                inside = lambda q: abs(a) <= q and abs(b) <= q and abs(a) + abs(b) <= q * 1.42
                if inside(rr) and not inside(rr - 1.05):
                    if 0.35 < t < 0.55 and a < -1 and -2 <= b <= 1 and d.r(u, y, z) < 0.8: continue   # the tear
                    rib = abs(abs(a) - abs(b)) < 0.6 or (y - corn) % 7 == 0
                    d.put(TX + u, y, z, "oxidized_cut_copper" if rib else d.pick(TX + u, y, z, COP, 7))
    d.put(TX - 2, spire_top, 0, "lightning_rod", bs={"facing_direction": 1})
    for k, y in enumerate(range(corn + 12, corn + 4, -1)):                 # a chain swinging out of the tear
        d.put(TX - 4, y, 0, "iron_chain", axis="y") if y > corn + 6 else None
    # lucarnes (little gabled openings) on the four faces low on the spire
    for (du, dz, f) in ((0, -1, "n"), (0, 1, "s"), (1, 0, "e"), (-1, 0, "w")):
        cxu, czz = du * 4, dz * 4
        for y in (corn + 3, corn + 4):
            d.air(TX + cxu, y, czz)
        d.put(TX + cxu + du, corn + 2, czz + dz, "smooth_sandstone_slab", half="bottom")
        d.put(TX + cxu, corn + 5, czz, "oxidized_cut_copper_stairs", facing=f)
    # glow from inside under the water: sea lanterns in the base
    for y in (6, 13):
        for (u, z) in ((-5, 0), (0, -5), (0, 5)): d.put(TX + u, y, z, "sea_lantern")

    # ---------------- the drowned churchyard: rows of leaning stones on the shoal round the chapel
    for gx in range(-6, 22, 3):
        for gz in list(range(-14, -6, 3)) + list(range(8, 16, 3)):
            if d.r(gx, 0, gz, 41) < 0.25: continue
            y = ground(gx, gz) + 1
            d.put(gx, y, gz, "cobblestone_wall" if d.r(gx, 1, gz) < 0.5 else "mossy_cobblestone_wall")
            if d.r(gx, 2, gz) < 0.5: d.put(gx, y + 1, gz, "stone_brick_slab", half="bottom")
            if y < S - 1 and d.r(gx, 3, gz) < 0.4: d.put(gx + 1, y, gz, "sea_pickle")
    # ---------------- drowned cottages on the shoal: stone shells, broken off at different heights
    COTS = [(-30, -16, 9, 7, 0), (-34, 14, 7, 5, 1), (20, 24, 9, 7, 0), (-6, 30, 7, 7, 1), (36, 22, 7, 5, 0), (12, -30, 9, 7, 1), (-22, 36, 7, 5, 0)]
    for (cx_, cz_, w, dd, rot) in COTS:
        if rot: w, dd = dd, w
        g = min(ground(cx_ + i, cz_ + j) for i in (-w // 2, w // 2) for j in (-dd // 2, dd // 2))
        top = g + 3 + int(6 * d.r(cx_, 0, cz_, 43))
        if rot or cx_ > 30: top = max(top, S + 2 + int(4 * d.r(cx_, 1, cz_, 49)))   # gables breaking the surface
        for i in range(-(w // 2), w // 2 + 1):
            for j in range(-(dd // 2), dd // 2 + 1):
                x, z = cx_ + i, cz_ + j
                edge = abs(i) == w // 2 or abs(j) == dd // 2
                d.put(x, g, z, d.pick(x, g, z, [("cobblestone", 2), ("gravel", 1), ("mossy_cobblestone", 1)], 44))
                if not edge: continue
                hh = top - int(4 * d.r(x, 1, z, 45)) if d.r(x, 2, z, 46) < 0.45 else top
                door = (j == dd // 2 and i == 0) or (abs(j) == 0 and abs(i) == w // 2 and rot)
                for y in range(g + 1, hh + 1):
                    if door and y <= g + 2: continue
                    if y == g + 2 and (i == 0 or j == 0) and not door: continue           # window holes
                    d.put(x, y, z, d.pick(x, y, z, STONE_LO if y <= S else STONE_MID, 47))
        for y in range(g + 1, min(top, S)):
            if d.r(cx_, y, cz_, 48) < 0.5: d.put(cx_, y, cz_, "kelp") if False else None
    # ---------------- the old cloister: an arcade of pointed arches breaking the surface north of the chapel
    for k, px in enumerate(range(-4, 26, 6)):
        pz = -15
        g = min(ground(px + i, pz + j) for i in (-1, 0, 1) for j in (-1, 0, 1))
        broken = k in (3,)
        ph = S + 4 if not broken else S + 1
        for y in range(g, ph + 1):
            for i in (-1, 0, 1):
                for j in (-1, 0, 1): d.put(px + i, y, pz + j, d.pick(px + i, y, pz + j, STONE_LO if y <= S else STONE_MID, 61))
        d.put(px, ph + 1, pz, "stone_brick_slab", half="bottom") if not broken else None
        if k < 4 and k != 2 and not broken:                                # the arch to the next pier
            for i in range(2, 5):
                rise = {2: 2, 3: 3, 4: 2}[i]
                for j in (-1, 0, 1):
                    d.put(px + i, ph + rise - 1, pz + j, "stone_bricks")
                    d.put(px + i, ph + rise - 2, pz + j, "stone_brick_stairs", facing="e" if i == 2 else "w" if i == 4 else "n", half="top") if i != 3 else None
                d.put(px + i, ph + rise, pz, "stone_brick_slab", half="bottom")
            d.put(px + 3, ph + 1, pz, "iron_chain", axis="y"); d.put(px + 3, ph, pz, "lantern", hanging=True)
    # ---------------- sea stacks out in the bay, stone and chalk, gulls' rocks
    for (sx, sz, hgt, rad) in ((-46, -30, 14, 4.5), (44, -38, 9, 3.5), (-50, 32, 7, 3.0), (52, 6, 11, 4.0)):
        g = ground(sx, sz)
        for y in range(g, S + hgt):
            rr = rad * (1 - 0.5 * max(0, (y - S) / hgt)) + 0.8 * d.r(sx, y, sz, 62)
            for (x, z) in disc(rr):
                X, Z = sx + x, sz + z
                d.put(X, y, Z, d.pick(X, y, Z, [("stone", 3), ("calcite", 3), ("diorite", 1), ("andesite", 1)] if y > S - 2 else [("stone", 3), ("mossy_cobblestone", 1), ("prismarine", 1)], 63))
        for (x, z) in disc(rad * 0.5):
            d.put(sx + x, S + hgt, sz + z, "white_wool" if d.r(x, z, 1) < 0.2 else "calcite")
    # ---------------- the churchyard islet: grass and shingle, a lych-gate ruin, stones, a dead thorn tree
    ix, iz = ISLE
    for (x, z) in disc(10):
        X, Z = ix + x, iz + z
        y = ground(X, Z)
        if y <= S: continue
        t = d.r(X, y, Z, 51)
        if t < 0.12: d.put(X, y + 1, Z, "short_grass")
        elif t < 0.16 and math.hypot(x, z) < 7: d.put(X, y + 1, Z, "cobblestone_wall"); d.put(X, y + 2, Z, "stone_brick_slab", half="bottom")
    for s_ in (-1, 1):                                                     # the lych-gate: two posts and a little roof
        for y in range(ground(ix - 9, iz + s_ * 2) + 1, ground(ix - 9, iz) + 4): d.put(ix - 9, y, iz + s_ * 2, "spruce_log", axis="y")
    gy = ground(ix - 9, iz) + 4
    for zz in range(-3, 4):
        d.put(ix - 10, gy, iz + zz, "spruce_stairs", facing="w"); d.put(ix - 9, gy + 1, iz + zz, "spruce_slab", half="bottom"); d.put(ix - 8, gy, iz + zz, "spruce_stairs", facing="e")
    tgy = ground(ix + 3, iz - 2)
    for y in range(tgy + 1, tgy + 8): d.put(ix + 3, y, iz - 2, "stripped_spruce_log" if y % 3 == 0 else "spruce_log", axis="y")
    tube(d, [(ix + 3, tgy + 6, iz - 2), (ix + 6, tgy + 8, iz - 3), (ix + 8, tgy + 10, iz - 3)], 0.6, 0.5, "spruce_log")
    tube(d, [(ix + 3, tgy + 5, iz - 2), (ix + 1, tgy + 8, iz + 1)], 0.6, 0.5, "spruce_log")
    # ---------------- the broken causeway from the southern shallows to the tower's balcony
    deck = S + 1
    prev = None
    for k, z in enumerate(range(7, R0 + 12)):
        x = TX + round(3 * math.sin(z * 0.05))
        gap = 22 <= z <= 25 or 38 <= z <= 40
        if z % 6 == 1:                                                     # piers
            for i in (-2, -1, 0, 1, 2):
                for y in range(ground(x + i, z) - 1, deck + 1): d.put(x + i, y, z, d.pick(x + i, y, z, STONE_LO if y <= S else STONE_MID, 52))
        if gap and z % 6 != 1: continue
        for i in (-1, 0, 1): d.put(x + i, deck, z, d.pick(x + i, deck, z, [("stone_bricks", 3), ("mossy_stone_bricks", 2), ("cracked_stone_bricks", 1)], 53))
        for i in (-2, 2):
            if d.r(x + i, deck + 1, z) < 0.7: d.put(x + i, deck + 1, z, "stone_brick_wall")
        if z % 6 == 4:                                                     # an arch under the deck between piers
            for i in (-1, 0, 1): d.put(x + i, deck - 1, z, "stone_brick_stairs", facing="s", half="top")
        if z % 12 == 7: d.put(x + 2, deck + 2, z, "lantern")
    for z in range(6, 9):                                                  # steps up to the balcony
        for i in (-1, 0, 1): d.put(TX + i, deck + 1, z, "stone_brick_stairs", facing="n")
    d.meta["y0"] = G.y0
    return d


# ---------------------------------------------------------------- the Pale Huntsman


def huntsman():
    """Hallowmere: the frozen lake in its bowl of snowy hills, the floor snow and ice (never all ice: you slide),
    drifts and pressure ridges, the Antler Crown of bone rising round it, spruce and dead pines on the shore, the
    hunters' camp by the lodge."""
    import boss_landmarks as BL
    ax, az = ANCHORS["huntsman"]
    G = Ground(ax, az, 0)
    wl = G.water(0, 0)
    G.y0 = wl if wl is not None else G.world(0, 0)    # huntPlan: the centre is the lake surface
    d = D("boss_huntsman", seed=701)
    R0, R = 60, 76
    CRACK, ARENA = 17, 16
    WOLF0, WOLF1 = 18, 23          # the night ring where rimewolves come (bosses thread, plans.js ICE_EDGE): flat ice at dy 0
    CAIRNS = [(26, -26), (26, 26), (-34, 34), (-34, -34)]      # where huntPlan's beast cairns land on this map
    LODGE = (0, 30)
    lake = lambda x, z: G.water(x, z) is not None
    protect = lambda x, z: any(math.hypot(x - cx, z - cz) < 5 for cx, cz in CAIRNS) or (abs(x - LODGE[0]) <= 6 and abs(z - LODGE[1]) <= 5)

    def n2(x, z, s_):
        return math.sin(x * 0.07 + s_) * math.cos(z * 0.061 + 2 * s_) + 0.5 * math.sin((x - z) * 0.13 + 3 * s_)

    def target(x, z, real):
        if protect(x, z): return real
        # a bowl of hills: the shore rises away from the ice, higher to the north and west
        dl = shore.get((x, z), 0)
        rise = max(0.0, dl - 3) * (0.30 + 0.10 * (z < 0) + 0.06 * (x < 0)) + 1.6 * n2(x, z, 0.5) * min(1, dl / 8)
        return max(real, real + min(11, rise))
    shore = {}                                                            # distance to the lake, for the hills
    from collections import deque
    q = deque()
    for x in range(-R - 1, R + 2):
        for z in range(-R - 1, R + 2):
            if lake(x, z): shore[(x, z)] = 0; q.append((x, z))
    while q:
        x, z = q.popleft()
        for dx, dz in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            c = (x + dx, z + dz)
            if c not in shore and abs(c[0]) <= R + 1 and abs(c[1]) <= R + 1: shore[c] = shore[(x, z)] + 1; q.append(c)
    TOP = lambda x, y, z: d.pick(x, y, z, [("snow", 12), ("stone", 1), ("gravel", 1)] if y > 6 else [("snow", 10), ("grass_block", 1), ("gravel", 1)], 3)
    SUB = lambda x, y, z: d.pick(x, y, z, [("stone", 3), ("dirt", 2), ("andesite", 1), ("cobblestone", 1)], 4)
    T = shape(d, G, R0, R, target, TOP, SUB, skip=lake)
    ground = lambda x, z: T.get((round(x), round(z)), G.real(round(x), round(z)))

    # ---- the frozen lake: snow and ice, never all ice
    n = R
    for x in range(-n, n + 1):
        for z in range(-n, n + 1):
            if not lake(x, z) or math.hypot(x, z) > R: continue
            r = math.hypot(x, z)
            if CRACK - 0.5 <= r < CRACK + 0.5: continue                     # the crack ring: huntPlan's cells
            if abs(x) <= 1 and abs(z) <= 1: d.put(x, 0, z, "snow"); continue   # the floor under the Hunter's Cairn
            t = d.r(x, 0, z, 9) * 0.55 + 0.45 * (0.5 + 0.5 * n2(x * 2.3, z * 2.3, 1.9))
            b = "snow" if t > 0.52 else "packed_ice" if t > 0.3 else "ice" if t > 0.22 else "snow"
            d.put(x, 0, z, b)
            if b == "snow" and d.r(x, 1, z, 10) < 0.45:
                d.put(x, 1, z, "snow_layer", bs={"height": int(1 + 3 * d.r(x, 2, z, 11)) if r > WOLF1 else int(1 + 2 * d.r(x, 2, z, 11))})
    # drifts: low inside the fight ring (layers only), full banks outside it
    for k in range(26):
        a = d.r(k, 1, 1) * math.tau; rr = 8 + 40 * d.r(k, 2, 1)
        cx, cz = round(math.sin(a) * rr), round(math.cos(a) * rr)
        if not lake(cx, cz) or protect(cx, cz): continue
        L, W = 5 + int(7 * d.r(k, 3, 1)), 1.6 + 1.6 * d.r(k, 4, 1)
        ang = a + math.pi / 2 + 0.6 * (d.r(k, 5, 1) - 0.5)
        for i in range(-L, L + 1):
            for j in range(-3, 4):
                x, z = round(cx + math.cos(ang) * i - math.sin(ang) * j), round(cz + math.sin(ang) * i + math.cos(ang) * j)
                r = math.hypot(x, z)
                if not lake(x, z) or CRACK - 1 <= r < WOLF1 + 1 or (abs(x) <= 2 and abs(z) <= 2): continue
                hgt = (1 - (i / (L + 0.5)) ** 2) * (1 - (j / W) ** 2 if abs(j) < W else 0) * (3.2 if r > ARENA + 2 else 0.9)
                if hgt <= 0.15: continue
                full = int(hgt)
                for y in range(1, full + 1): d.put(x, y, z, "snow")
                layers = int((hgt - full) * 8)
                if layers: d.put(x, full + 1, z, "snow_layer", bs={"height": max(1, min(7, layers)) - 1})
    # pressure ridges: jumbled slabs of ice pushed up along lines out from the crack, outside the fight ring
    for k in range(7):
        a = math.radians(360 / 7 * k + 20 + 15 * d.r(k, 6, 2))
        for s_ in range(WOLF1 + 2, 52):
            x, z = round(math.sin(a) * s_ + 2 * math.sin(s_ * 0.3 + k)), round(math.cos(a) * s_ + 2 * math.cos(s_ * 0.27 + k))
            if not lake(x, z): break
            hgt = 1 + int(2.6 * d.r(x, 3, z, 12) * min(1, (s_ - WOLF1 - 1) / 6))
            for y in range(1, hgt + 1):
                for (dx, dz) in ((0, 0), (1, 0), (0, 1)):
                    if d.r(x + dx, y, z + dz, 13) < 0.75 - 0.2 * y:
                        d.put(x + dx, y, z + dz, d.pick(x + dx, y, z + dz, [("packed_ice", 4), ("blue_ice", 1), ("ice", 1), ("snow", 2)], 14))
    # rocks frozen into the ice near the shore
    for k in range(10):
        a = d.r(k, 7, 3) * math.tau; rr = WOLF1 + 5 + 22 * d.r(k, 8, 3)
        cx, cz = round(math.sin(a) * rr), round(math.cos(a) * rr)
        if not lake(cx, cz): continue
        blob(d, cx, 0, cz, 1.5 + 1.5 * d.r(k, 9, 3), [("stone", 3), ("andesite", 2), ("cobblestone", 1), ("mossy_cobblestone", 1)], 15, squash=0.7)
        d.put(cx, round(1.5 + 1.5 * d.r(k, 9, 3)), cz, "snow_layer", bs={"height": 1})

    # ---- the Antler Crown: eight great beams of bone round the ice (from boss_landmarks)
    crown = BL.huntsman()
    for c, v in crown.cells.items():
        x, y, z = c
        if v[0] == "snow_layer" or (y < 0 and lake(x, z) is False and y < ground(x, z) - 3): continue
        d.cells[c] = v

    # ---- spruce and dead pines on the hills
    for k in range(40):
        a = d.r(k, 1, 7) * math.tau; rr = 38 + 34 * d.r(k, 2, 7)
        x, z = round(math.sin(a) * rr), round(math.cos(a) * rr)
        if lake(x, z) or protect(x, z) or math.hypot(x, z) > R - 2: continue
        g = ground(x, z); tall = 7 + int(8 * d.r(k, 3, 7))
        dead = d.r(k, 4, 7) < 0.3
        for y in range(g + 1, g + tall + 1): d.put(x, y, z, "spruce_log", axis="y")
        if dead:
            for s_ in (-1, 1):
                b = a + s_ * 1.6
                y0 = g + tall - 3 - (s_ > 0) * 2
                tube(d, [(x, y0, z), (x + math.sin(b) * 2.5, y0 + 1, z + math.cos(b) * 2.5)], 0.5, 0.5, "spruce_log")
            continue
        for y in range(g + 3, g + tall + 2):
            rr2 = (g + tall + 2 - y) * 0.38 + (0.8 if (y - g) % 3 == 0 else 0)
            for (dx, dz) in disc(rr2):
                if d.get(x + dx, y, z + dz) is None: d.put(x + dx, y, z + dz, "spruce_leaves")
                if d.r(x + dx, y, z + dz, 16) < 0.35 and d.get(x + dx, y + 1, z + dz) is None: d.put(x + dx, y + 1, z + dz, "snow_layer", bs={"height": 0})
    # ---- the hunters' camp by the lodge: drying racks with hides, a cold fire, a meat pole, antlers on a post
    lx, lz = LODGE
    for (fx, fz) in ((-9, 2), (8, 1)):
        g = ground(lx + fx, lz + fz)
        for i in (-2, 2):
            for y in range(g + 1, g + 4): d.put(lx + fx + i, y, lz + fz, "spruce_fence")
        for i in range(-2, 3): d.put(lx + fx + i, g + 4, lz + fz, "spruce_fence")
        for i in (-1, 0, 1):
            d.put(lx + fx + i, g + 3, lz + fz, "brown_wool" if (i + fx) % 2 else "white_wool")
    g = ground(lx - 4, lz - 6)
    for (dx, dz) in ((1, 0), (-1, 0), (0, 1), (0, -1)): d.put(lx - 4 + dx, g + 1, lz - 6 + dz, "cobblestone")
    d.put(lx - 4, g + 1, lz - 6, "campfire", bs={"extinguished": True})
    g = ground(lx + 5, lz - 6)
    for y in range(g + 1, g + 5): d.put(lx + 5, y, lz - 6, "spruce_log", axis="y")
    for s_ in (-1, 1):
        d.put(lx + 5 + s_, g + 5, lz - 6, "bone_block", axis="x"); d.put(lx + 5 + 2 * s_, g + 6, lz - 6, "bone_block", axis="y")
        d.put(lx + 5 + 2 * s_, g + 7, lz - 6, "end_rod" if False else "bone_block", axis="y") if d.r(s_, 1, 1) < 0.6 else None
    d.meta["y0"] = G.y0
    return d


# ---------------------------------------------------------------- the Ash Seneschal


def seneschal():
    """The Faceless Gate's sunken precinct out in the open desert south of Sunscar: rolling dunes all round, a walled
    courtyard dug down between them, the gate and the seated faceless figure over the vault stair, the processional
    way of statues, obelisks at the south gate, fallen columns and a toppled head half under the sand."""
    import boss_landmarks as BL
    ax, az = ANCHORS["seneschal"]
    G = Ground(ax, az, 0)
    G.y0 = G.world(0, 0)                 # vaultPlan: the centre is the ground at the anchor
    d = D("boss_seneschal", seed=721)
    R0, R = 56, 70
    PX0, PX1, PZ0, PZ1 = -19, 19, -43, 35  # the precinct walls
    stair = lambda x, z: abs(x) <= 2 and -14 <= z <= 1
    town = lambda x, z: z < -52          # Sunscar's south edge: leave its ground alone
    in_prec = lambda x, z: PX0 < x < PX1 and PZ0 < z < PZ1

    def dune(x, z):
        u = 0.085 * x + 0.035 * z + 1.1 * math.sin(0.045 * z + 0.6) + 0.6 * math.sin(0.03 * x - 1.0)
        f = (u / math.tau) % 1.0
        ridge = (f / 0.7) if f < 0.7 else (1 - f) / 0.3   # long windward slope, steep slip face
        return 11 * ridge ** 1.5 * (0.6 + 0.4 * math.sin(0.02 * x + 0.05 * z) ** 2)

    def target(x, z, real):
        if in_prec(x, z): return 0
        wall_d = max(PX0 - x, x - PX1, PZ0 - z, z - PZ1)
        t = dune(x, z) + 0.6 * math.sin(x * 0.4 + z * 0.2)
        if wall_d < 8: t = min(t, 1.5 + wall_d * 0.9) if wall_d > 0 else 0          # dunes banked against the walls
        return max(0, t)
    TOP = lambda x, y, z: "red_sand" if math.sin(x * 0.05 + 2) * math.cos(z * 0.06) > 0.75 else "sandstone" if d.r(x, y, z, 3) < 0.03 else "sand"
    SUB = lambda x, y, z: d.pick(x, y, z, [("sand", 2), ("sandstone", 3)], 4)
    T = shape(d, G, R0, R, target, TOP, SUB, skip=town)
    ground = lambda x, z: T.get((round(x), round(z)), G.real(round(x), round(z)))

    # the courtyard floor: worn paving, half drifted over
    for x in range(PX0 + 1, PX1):
        for z in range(PZ0 + 1, PZ1):
            if stair(x, z): continue
            t = d.r(x, 0, z, 21)
            edge = min(x - PX0, PX1 - x, z - PZ0, PZ1 - z)
            if t < 0.35 + 0.08 * edge: d.put(x, 0, z, "smooth_sandstone" if t < 0.2 else "cut_sandstone" if t < 0.3 else "sandstone")
            if edge <= 3 and d.r(x, 1, z, 22) < 0.5 - 0.12 * edge:                 # sand drifted in against the walls
                d.put(x, 1, z, "sand")
                if edge == 1 and d.r(x, 2, z, 23) < 0.4: d.put(x, 2, z, "sand")
    # the precinct wall, broken down to different heights, gates north and south
    for x in range(PX0, PX1 + 1):
        for z in range(PZ0, PZ1 + 1):
            if not (x in (PX0, PX1) or z in (PZ0, PZ1)): continue
            if z in (PZ0, PZ1) and abs(x) <= 3: continue
            hh = 2 + int(4 * (0.5 + 0.5 * math.sin(x * 0.7 + z * 0.45))) - (2 if d.r(x, 0, z, 24) < 0.15 else 0)
            for y in range(-2, hh + 1): d.put(x, y, z, d.pick(x, y, z, [("sandstone", 3), ("cut_sandstone", 2), ("smooth_sandstone", 2)], 25))
            if hh >= 5 and d.r(x, 9, z) < 0.5: d.put(x, hh + 1, z, "sandstone_slab", half="bottom")
    for s_ in (-1, 1):                                                     # gate piers at the south gate
        for y in range(0, 9):
            for i in (0, 1):
                for j in (0, 1): d.put(s_ * (4 + i), y, PZ1 - j, "cut_sandstone" if y % 4 else "chiseled_sandstone")
        d.put(s_ * 4, 9, PZ1, "sandstone_wall"); d.put(s_ * 4, 10, PZ1, "lantern")
    # the gate, the figure and the processional way (Mateo liked these: kept from the first landmark)
    gate = BL.seneschal()
    for c, v in gate.cells.items(): d.cells[c] = v
    # the scarab court in front of the stair (bosses thread, plans.js ASH_SAND: centre (0, 11), r 9, scarabs on r 6 at
    # dy 1) stays open: faceless_statues.AVENUE stands the statues south of it and lays four along the sides
    # obelisks out beyond the south gate
    for s_ in (-1, 1):
        ox, oz = s_ * 8, PZ1 + 6
        g = min(ground(ox + i, oz + j) for i in (-1, 0, 1) for j in (-1, 0, 1))
        for y in range(g - 2, g + 2):
            for i in range(-2, 3):
                for j in range(-2, 3): d.put(ox + i, y, oz + j, "smooth_sandstone" if y < g + 1 else "cut_sandstone")
        for y in range(g + 2, g + 17):
            for i in (-1, 0, 1):
                for j in (-1, 0, 1):
                    if y > g + 13 and abs(i) + abs(j) > 0 and (abs(i) == 1 and abs(j) == 1 or y > g + 15): continue
                    d.put(ox + i, y, oz + j, "smooth_red_sandstone" if (y - g) % 5 else "chiseled_red_sandstone")
        d.put(ox, g + 17, oz, "gold_block")
    # fallen columns and a toppled faceless head, half under the dunes
    for (cx, cz, ang, L) in ((-30, 4, 0.3, 11), (29, -12, -0.5, 9), (34, 18, 1.2, 8), (-27, -28, 2.0, 10)):
        g = ground(cx, cz)
        pts = [(cx, g, cz), (cx + math.cos(ang) * L, ground(cx + math.cos(ang) * L, cz + math.sin(ang) * L), cz + math.sin(ang) * L)]
        tube(d, pts, 1.5, 1.5, [("smooth_sandstone", 3), ("cut_sandstone", 1)], 26)
    hx, hz = 38, -2
    blob(d, hx, ground(hx, hz) + 1, hz, 4.2, "smooth_quartz", 27, squash=1.2)
    for x in range(-4, 5):
        for y in range(-2, 3):
            if d.get(hx + x, ground(hx, hz) + 1 + y, hz + 3) is None and abs(x) >= 3: d.put(hx + x, ground(hx, hz) + 1 + y, hz + 3, "orange_terracotta" if y % 2 else "cyan_terracotta")
    for (x, z) in disc(6):                                                 # the dune swallowing half of it
        if x > 0: continue
        X, Z = hx + x - 2, hz + z
        for y in range(ground(X, Z) + 1, ground(X, Z) + 1 + max(0, round(3 - math.hypot(x, z) * 0.5))): d.put(X, y, Z, "sand")
    # dead palms and dry bushes on the dunes
    for k in range(18):
        a = d.r(k, 1, 7) * math.tau; rr = 24 + 40 * d.r(k, 2, 7)
        x, z = round(math.sin(a) * rr), round(math.cos(a) * rr)
        if in_prec(x - 2, z) or in_prec(x + 2, z) or town(x, z) or rr > R - 3: continue
        g = ground(x, z)
        if k % 3 == 0:
            tall = 5 + int(4 * d.r(k, 3, 7)); bx = 1 if d.r(k, 4, 7) < 0.5 else -1
            for y in range(1, tall + 1): d.put(x + (bx if y > tall * 0.6 else 0), g + y, z, "stripped_jungle_log" if y % 3 else "jungle_log", axis="y")
            for (dx, dz) in ((1, 0), (-1, 0), (0, 1)): d.put(x + bx + dx, g + tall + (dz == 0 and dx != 0), z + dz, "deadbush") if False else d.put(x + bx + dx, g + tall, z + dz, "jungle_fence")
        else:
            d.put(x, g + 1, z, "deadbush")
    d.meta["y0"] = G.y0
    return d


# ---------------------------------------------------------------- Mirelight's lantern square


def mirelight():
    """The Mire Lantern: a lantern-house in the middle of Mirelight's square (the town is the towns thread's; this
    replaces the old lantern mast). A mud-brick plinth with steps, four mangrove posts carrying a steep mossy roof,
    and hung under it on chains a great iron cage round a green froglight, the light the town is named for. The five
    villagers' posts (mirelightPlan) stand round it at r 8."""
    ax, az = ANCHORS["mirelight"]
    G = Ground(ax, az, 0)
    G.y0 = G.world(0, 0)
    d = D("boss_mirelight", seed=741)
    # the plinth: 7 across, two steps up, mud bricks with a packed-mud skirt down to the ground
    for x in range(-3, 4):
        for z in range(-3, 4):
            g = G.real(x, z)
            edge = max(abs(x), abs(z))
            for y in range(min(g, -1) - 1, 1): d.put(x, y, z, "packed_mud" if y < 0 else "mud_bricks")
            if edge == 3 and not (abs(x) == 3 and abs(z) == 3):
                f = "e" if x == 3 else "w" if x == -3 else "s" if z == 3 else "n"
                d.put(x, 0, z, "mud_brick_stairs", facing={"e": "w", "w": "e", "s": "n", "n": "s"}[f])
            elif edge <= 2: d.put(x, 1, z, "mud_bricks" if edge == 2 else "polished_deepslate" if (x + z) % 2 else "mud_bricks")
    # four posts and their braces
    for sx in (-2, 2):
        for sz in (-2, 2):
            for y in range(2, 10): d.put(sx, y, sz, "mangrove_log", axis="y")
            d.put(sx, 2, sz, "mud_brick_wall")
            for (dx, dz, f) in ((-sx // 2, 0, "x"), (0, -sz // 2, "z")):
                d.put(sx + dx, 9, sz + dz, "mangrove_log", axis=f)
    for i in range(-2, 3):                                                # the ring beam
        for (x, z, ax_) in ((i, -2, "x"), (i, 2, "x"), (-2, i, "z"), (2, i, "z")): d.put(x, 9, z, "mangrove_log", axis=ax_)
    # the roof: steep, four-sided, moss over dark timber, eaves out over the plinth
    for k, y in enumerate(range(10, 16)):
        rr = 4 - k * 0.7
        n = int(rr + 0.5)
        for x in range(-n, n + 1):
            for z in range(-n, n + 1):
                if max(abs(x), abs(z)) != n: continue
                f = "e" if x == n else "w" if x == -n else "s" if z == n else "n"
                if abs(x) == n and abs(z) == n: d.put(x, y, z, "moss_block" if k % 2 else "mangrove_planks"); continue
                d.put(x, y, z, ("mangrove_stairs" if k % 2 else "mud_brick_stairs"), facing={"e": "w", "w": "e", "s": "n", "n": "s"}[f])
                if d.r(x, y, z) < 0.3: d.put(x, y + 1, z, "moss_carpet") if False else None
        for x in range(-n + 1, n):
            for z in range(-n + 1, n): d.put(x, y, z, "mangrove_planks")
    d.put(0, 16, 0, "mangrove_fence"); d.put(0, 17, 0, "verdant_froglight"); d.put(0, 18, 0, "lightning_rod", bs={"facing_direction": 1})
    for x in range(-4, 5):                                                # hanging roots from the eaves
        for z in (-4, 4):
            if d.r(x, 9, z) < 0.35: d.put(x, 9, z, "hanging_roots"); d.put(z, 9, x, "hanging_roots")
    # the great lantern: an iron cage round a froglight, hung on chains from the roof
    for y in range(6, 10): d.put(0, y, 0, "iron_chain", axis="y") if y > 7 else None
    d.put(0, 8, 0, "iron_chain", axis="y"); d.put(0, 9, 0, "iron_chain", axis="y")
    for x in (-1, 0, 1):
        for z in (-1, 0, 1):
            for y in (4, 5, 6):
                core = x == 0 and z == 0 and y == 5
                d.put(x, y, z, "verdant_froglight" if core else "iron_bars" if (abs(x) + abs(z) > 0 or y != 5) and not (y in (4, 6) and abs(x) + abs(z) == 0) else "iron_bars")
            d.put(x, 7, z, "mangrove_slab", half="bottom") if abs(x) + abs(z) < 2 else None
            d.put(x, 3, z, "mangrove_trapdoor", facing="n", half="top")
    d.put(0, 4, 0, "ochre_froglight"); d.put(0, 6, 0, "verdant_froglight")
    # small caged lanterns on brackets at the four corners
    for sx in (-2, 2):
        for sz in (-2, 2):
            ox, oz = sx + (1 if sx > 0 else -1), sz + (1 if sz > 0 else -1)
            d.put(ox, 7, oz, "mangrove_fence"); d.put(ox, 6, oz, "lantern", hanging=True)
    d.meta["y0"] = G.y0
    return d


# ---------------------------------------------------------------- Millbrook (the Clockwork Reeve)


def reeve():
    """The Millbrook clock tower: a gate tower over the street leaving the square eastward, built to
    build-instructions/towers (stages, courses, a jettied timber clock stage with 7x7 faces on all four sides, a steep
    slate spire with a bellcast eave, an open lantern on top). The Tower clock (siege:stopped_clock, reeve.js) is the
    hub of the west face, looking onto the square. The square and town are the towns thread's; the well and the
    chamber under it are the bosses'."""
    d = D("boss_reeve", seed=751)
    d.meta["y0"] = 79                    # Millbrook's square paving (town-sites squareY 78 + paving)
    X0, X1, Z0, Z1 = 9, 17, -4, 4        # the shaft, 9 square
    CX = 13
    SHAFT_TOP, ST0, ST1 = 24, 25, 31     # stone shaft; the timber clock stage
    STONE = [("stone_bricks", 6), ("andesite", 2), ("mossy_stone_bricks", 1), ("cracked_stone_bricks", 1)]
    passage = lambda y, z: (y <= 5 and abs(z) <= 2) or (y == 6 and abs(z) <= 1) or (y == 7 and z == 0)
    for y in range(-2, SHAFT_TOP + 1):
        for x in range(X0, X1 + 1):
            for z in range(Z0, Z1 + 1):
                edge = x in (X0, X1) or z in (Z0, Z1)
                corner = x in (X0, X1) and z in (Z0, Z1)
                if y >= 1 and passage(y, z): continue
                if y >= 1 and not edge:
                    if y in (8, 14, 20) and (x, z) != (16, -3): d.put(x, y, z, "spruce_planks")   # floors inside
                    continue
                if y <= 2: d.put(x, y, z, "cobblestone" if y < 1 else d.pick(x, y, z, [("andesite", 2), ("cobblestone", 1)], 1)); continue
                b = "polished_andesite" if corner or (y % 2 == 0 and (x in (X0, X1) and abs(z) == 3 or z in (Z0, Z1) and x in (X0 + 1, X1 - 1))) else d.pick(x, y, z, STONE, 2)
                d.put(x, y, z, b)
                if edge and not corner and y in (11, 17):                          # lancets, centre on centre
                    off = z if x in (X0, X1) else x - CX
                    if off == 0: d.put(x, y, z, "air"); d.put(x, y + 1, z, "air")
                if edge and not corner and y in (11, 12) and (x - CX if z in (Z0, Z1) else z) == 0: d.air(x, y, z)
    for y in range(1, 8):                                                   # the arch's voussoirs on both street faces
        for x in (X0, X1):
            for z in (-3, 3) if y <= 5 else (-2, 2) if y == 6 else (-1, 1):
                d.put(x, y, z, "stone_bricks" if y < 5 else "chiseled_stone_bricks" if y == 7 else "stone_bricks")
        for x in range(X0 + 1, X1):
            d.put(x, 6, -2, "stone_brick_stairs", facing="s", half="top"); d.put(x, 6, 2, "stone_brick_stairs", facing="n", half="top")
            d.put(x, 7, -1, "stone_brick_stairs", facing="s", half="top"); d.put(x, 7, 1, "stone_brick_stairs", facing="n", half="top")
    for x in (X0, X1): d.put(x, 7, 0, "stone_bricks")
    for y in (8, 14, 20):                                                   # string courses
        for x in range(X0 - 1, X1 + 2):
            for z in range(Z0 - 1, Z1 + 2):
                if not (x in (X0 - 1, X1 + 1) or z in (Z0 - 1, Z1 + 1)) or (x in (X0 - 1, X1 + 1) and z in (Z0 - 1, Z1 + 1)): continue
                if y == 8 and abs(z) <= 2 and x in (X0 - 1, X1 + 1): continue
                f = "w" if x == X0 - 1 else "e" if x == X1 + 1 else "n" if z == Z0 - 1 else "s"
                d.put(x, y, z, "stone_brick_stairs", facing=f, half="top")
    # corbels under the jetty: upside-down stairs at every corner and every third block
    for x in range(X0 - 1, X1 + 2):
        for z in range(Z0 - 1, Z1 + 2):
            if not (x in (X0 - 1, X1 + 1) or z in (Z0 - 1, Z1 + 1)): continue
            along = z if x in (X0 - 1, X1 + 1) else x - CX
            if along % 3 == 0 or (x in (X0 - 1, X1 + 1) and z in (Z0 - 1, Z1 + 1)):
                f = "w" if x == X0 - 1 else "e" if x == X1 + 1 else "n" if z == Z0 - 1 else "s"
                d.put(x, SHAFT_TOP, z, "spruce_stairs", facing=f, half="top")
    # the timber clock stage, jettied one out: stripped spruce frame, calcite infill
    for y in range(ST0, ST1 + 1):
        for x in range(X0 - 1, X1 + 2):
            for z in range(Z0 - 1, Z1 + 2):
                edge = x in (X0 - 1, X1 + 1) or z in (Z0 - 1, Z1 + 1)
                if not edge:
                    if y == ST0 + 1 and (x, z) != (16, -3): d.put(x, y, z, "spruce_planks")   # the clock floor, dy 26
                    continue
                corner = x in (X0 - 1, X1 + 1) and z in (Z0 - 1, Z1 + 1)
                along = z if x in (X0 - 1, X1 + 1) else x - CX
                post = corner or abs(along) == 5
                d.put(x, y, z, "stripped_spruce_log" if post or y in (ST0, ST1) else "calcite", axis="y" if post else "x")
    # 7x7 clock faces, corners cut, on all four faces; every one shows the same stopped minute
    CY = 28
    def face(sx, sz):                     # (sx, sz): outward normal
        px = (lambda a: (X0 - 1 if sx < 0 else X1 + 1, a)) if sx else (lambda a: (CX + a, Z0 - 1 if sz < 0 else Z1 + 1))
        for a in range(-3, 4):
            for b in range(-3, 4):
                if abs(a) == 3 and abs(b) == 3: continue
                x, z = px(a)
                d.put(x, CY + b, z, "smooth_quartz" if max(abs(a), abs(b)) < 3 else "dark_oak_planks")
        for a, b in ((0, 2), (0, -2), (2, 0), (-2, 0)):                  # hour marks
            x, z = px(a); d.put(x, CY + b, z, "polished_blackstone")
        for a, b in ((0, 1), (0, 2), (1, 0), (1, -1)):                   # hands: twelve minutes to midnight, stopped
            x, z = px(-a if sx > 0 or sz < 0 else a); d.put(x, CY + b, z, "polished_blackstone")
        x, z = px(0); d.put(x, CY, z, "dark_oak_planks")                  # hub (the west hub is the Tower clock itself)
        ox, oz = (sx, 0) if sx else (0, sz)                               # the frame: trim stairs one out
        for a in range(-3, 4):
            x, z = px(a)
            nf = "w" if sx < 0 else "e" if sx > 0 else "n" if sz < 0 else "s"
            d.put(x + ox, CY + 4, z + oz, "dark_oak_stairs", facing=nf, half="top") if abs(a) < 3 else None
            d.put(x + ox, CY - 4, z + oz, "dark_oak_stairs", facing=nf) if abs(a) < 3 else None
    for sx, sz in ((-1, 0), (1, 0), (0, -1), (0, 1)): face(sx, sz)
    d.air(X0 - 2, CY, 0)                                                   # the Tower clock's face cell stays open
    for y in range(1, ST0 + 2): d.put(16, y, -3, "ladder", bs={"facing_direction": 3})   # up from the arch to the clock floor
    for x in (9, 10):                                                      # standing room behind the Tower clock
        for y in (27, 28, 29):
            for z in (-1, 0, 1): d.air(x, y, z)
    # the spire: a bellcast eave ring over the jetty, then steep slate rings, broach-cut corners
    SL = [("deepslate_tiles", 6), ("polished_deepslate", 1)]
    for x in range(X0 - 2, X1 + 3):
        for z in range(Z0 - 2, Z1 + 3):
            if not (x in (X0 - 2, X1 + 2) or z in (Z0 - 2, Z1 + 2)): continue
            f = "w" if x == X0 - 2 else "e" if x == X1 + 2 else "n" if z == Z0 - 2 else "s"
            d.put(x, ST1 + 1, z, "deepslate_tile_stairs", facing={"w": "e", "e": "w", "n": "s", "s": "n"}[f])
            d.put(x, ST1, z, "dark_oak_stairs", facing=f, half="top") if not (x in (X0 - 2, X1 + 2) and z in (Z0 - 2, Z1 + 2)) else None
    top = ST1 + 20
    for y in range(ST1 + 1, top + 1):
        t = (y - ST1 - 1) / (top - ST1 - 1)
        rr = 5.5 * (1 - t) + 0.3
        for x in range(X0 - 1, X1 + 2):
            for z in range(Z0 - 1, Z1 + 2):
                a, b = x - CX, z
                inside = lambda q: max(abs(a), abs(b)) <= q and abs(a) + abs(b) <= q * (1.25 + 0.35 * (1 - t))
                if inside(rr) and not inside(rr - 1.1): d.put(x, y, z, d.pick(x, y, z, SL, 5))
    # an open lantern on the top: four posts, a lantern, its own tiny spire, a rod
    for sx in (-1, 1):
        for sz in (-1, 1):
            for y in (top + 1, top + 2): d.put(CX + sx, y, sz, "dark_oak_fence")
    for x in (CX - 1, CX, CX + 1):
        for z in (-1, 0, 1): d.put(x, top + 3, z, "deepslate_tile_slab", half="bottom") if (x, z) != (CX, 0) else d.put(x, top + 3, z, "deepslate_tiles")
    d.put(CX, top + 2, 0, "lantern", hanging=True)
    d.put(CX, top + 4, 0, "deepslate_tile_wall"); d.put(CX, top + 5, 0, "lightning_rod", bs={"facing_direction": 1})
    # lanterns either side of the arch on the square side, the street paved through
    for z in (-4, 4): d.put(X0 - 1, 4, z, "lantern") if False else d.put(X0 - 1, 5, z + (1 if z > 0 else -1) * 0, "lantern", hanging=False)
    for x in range(X0, X1 + 1):
        for z in range(-2, 3): d.put(x, 0, z, "stone_bricks" if (x + z) % 3 else "polished_andesite")
    return d


DESIGNS = {"mother": (mother, "The Cradle Tree area (Mother of Changelings)"),
           "huntsman": (huntsman, "Hallowmere and the Antler Crown (Pale Huntsman)"),
           "seneschal": (seneschal, "The Faceless Gate precinct (Ash Seneschal)"),
           "mirelight": (mirelight, "The Mire Lantern in Mirelight's square"),
           "reeve": (reeve, "The Millbrook clock tower (Clockwork Reeve)"),
           "bride": (bride, "The drowned village of Brannoc and its bell tower (Drowned Bride)")}
