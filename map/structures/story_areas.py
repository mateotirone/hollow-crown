"""Story places drawn as whole areas of the map (Mateo, 2026-11-12: "Don't just make monuments. Make areas of the
map."): the land reshaped against the real ground so the place makes sense where it stands, edges blended into
the map, the story piece (landmarks_story.py) set on top. Positions and game wiring belong to the storyline code
(landmarks/sites.js); this file owns the land and set dressing round them.

Offsets are from the piece's anchor; y 0 is the height the piece is built at (rigid mode takes the median ground
under the design, so the area leaves its yard flat at 0).

  roost   the Cinder Roost (882, 310): a red mesa raised out of the desert north of Sunscar, sheer banded cliffs
          about 21 high, the rider school on its north rim, the Span out over a real drop to the perch, which
          stands on a broken butte of its own. Kesh Cinder's "rider school cut into the cliff above Sunscar".
"""
import math

from area_ground import Ground, shape
from landmarks import D

ANCHORS = {"roost": (882, 310)}
BANDS = ["orange_terracotta", "hardened_clay", "red_terracotta", "orange_terracotta", "yellow_terracotta", "hardened_clay",
         "brown_terracotta", "red_terracotta", "orange_terracotta", "light_gray_terracotta", "hardened_clay", "red_sandstone"]


def roost():
    import landmarks_story as LS
    ax, az = ANCHORS["roost"]
    TOP = 118                                    # the mesa top: about 21 over the desert floor (96-97 here)
    G = Ground(ax, az, TOP)
    d = D("area_cinder_roost", seed=811)
    R0, R = 98, 112
    SUN = (-32, 140, 72)                         # Sunscar's plot (850, 450) r 80, in local offsets: keep out of its middle

    def n2(x, z, s_):
        return math.sin(x * 0.11 + s_) * math.cos(z * 0.09 + 2 * s_) + 0.5 * math.sin((x + z) * 0.23 + 3 * s_)

    # the plateau (Mateo 2026-11-13, "we got to fix the terraforming": the first mesa was a box). rim_t is roughly the
    # distance outside the rim, negative inside: a squared-off superellipse round the school, lobed, with gullies
    # biting in; the north rim stays on z 0 by the Span and wanders a little elsewhere; a bay in the south cliffs for
    # the climb. Off the rim the face comes down the way a real mesa's does: a sheer caprock, a ledge here and there
    # (wide in places, gone in others), a second cliff, then a talus slope of fallen rock down to the desert.
    HARM = [(k, 0.02 + 0.05 * d.r(k, 3, 1) / (1 + 0.25 * k), d.r(k, 4, 1) * math.tau) for k in range(2, 9)]
    GUL = [(d.r(k, 5, 1) * math.tau, 0.05 + 0.05 * d.r(k, 6, 1), 4 + 6 * d.r(k, 7, 1)) for k in range(9)]

    def sdbox(x, z, x0, z0, x1, z1):
        dx, dz = max(x0 - x, 0, x - x1), max(z0 - z, 0, z - z1)
        if dx or dz: return math.hypot(dx, dz)
        return -min(x - x0, x1 - x, z - z0, z1 - z)

    def rim_t(x, z):
        rn = 0 if abs(x) <= 9 else -round(1.2 + 1.2 * math.sin(x * 0.21 + 1.3) + 0.6 * math.sin(x * 0.53))
        tn = rn - z
        th = math.atan2(z - 24, x)
        wob = 1 + sum(a * math.cos(k * th + ph) for k, a, ph in HARM)
        bz = 42 if z > 24 else 60
        e = ((abs(x) / 58) ** 6 + (abs(z - 24) / bz) ** 6) ** (1 / 6)
        tb = (e / wob - 1) * 46 + 1.8 * n2(x * 0.9, z * 0.9, 0.4)
        for ph, w, dep in GUL:
            dth = abs((th - ph + math.pi) % math.tau - math.pi)
            if dth < w: tb += dep * (1 - dth / w)
        t = min(max(tn, tb), sdbox(x, z, -41, 0, 41, 62))               # the school always has rock under it
        bay = sdbox(x, z, -5 + round(1.5 * n2(z, 3, 1.1)), 61 + round(n2(x, 7, 2.2)), 29 + round(1.5 * n2(z, 5, 3.3)), 140)
        return max(t, -bay)

    def inside(x, z):
        return -rim_t(x, z)

    def face(x, z, t, real):                                           # the height of the face, t blocks off the rim
        n_a = 0.5 + 0.5 * n2(x * 0.31, z * 0.31, 1.3); n_b = 0.5 + 0.5 * n2(x * 0.23, z * 0.27, 2.9)
        n_c = 0.5 + 0.5 * n2(x * 0.41, z * 0.37, 4.7)
        cap = 5 + round(4 * n_a)                                       # the caprock: sheer
        if t <= 1.2: return -cap
        wb = max(0.0, 5.5 * n_b - 1.2)                                 # the ledge: wide here, gone there
        if t <= 1.2 + wb: return -cap - (1 if d.r(x, 2, z, 6) < 0.3 else 0)
        t2 = t - 1.2 - wb
        c2 = 4 + round(4 * n_c)                                        # the second cliff
        if t2 <= 1.2: return -cap - c2
        h = -cap - c2 - 1.15 * (t2 - 1.2) + 1.6 * n2(x * 1.3, z * 1.3, 3.1)   # the talus, lumpy
        return max(round(h), real)

    BUTTE = (0, -21)                                                  # the perch's own rock (perch walls G-14..G)

    def butte_r(y):                                                   # radius of the butte at height y (relative)
        return 4.6 + max(0, (-14 - y)) * 0.32
    # the terrace houses down the north cliff (landmarks_story.cinder_roost): the rock under each stops at its floor
    TERR = [((11, -9, 25, -1), -7), ((26, -9, 27, -1), -7), ((19, -17, 33, -9), -13), ((34, -15, 35, -7), -13),
            ((-25, -9, -11, -1), -7), ((-27, -9, -26, -1), -7)]

    # ---- the climb from Sunscar (Mateo 2026-11-13: "the staircase needs work"; regions/hollow.md "Stairs, ledges and
    # the way down from them", which holds for every region): five wide, every step a stair block, three flights of
    # seven with a five-square landing at each turn, a kerb and a low wall on every open side, lanterns at the turns,
    # the whole stair carried on a dressed retaining wall of cut red sandstone with pilasters. From the south gate
    # (z 57): down south to the first landing, then east along the foot of the cliffs, out of Sunscar's plot.
    STEP = {}                                                          # (x, z) -> (level, stair facing or None)
    for x in range(-2, 3):
        for z in range(58, 61): STEP[(x, z)] = (0, None)               # the apron before the gate
    for i in range(1, 8):                                              # flight one, south
        for x in range(-2, 3): STEP[(x, 60 + i)] = (-i, "n")
    for x in range(-2, 3):
        for z in range(68, 73): STEP[(x, z)] = (-7, None)              # the first landing
    for i in range(1, 8):                                              # flight two, east
        for z in range(68, 73): STEP[(2 + i, z)] = (-7 - i, "w")
    for x in range(10, 15):
        for z in range(68, 73): STEP[(x, z)] = (-14, None)             # the second landing
    for i in range(1, 8):                                              # flight three, east
        for z in range(68, 73): STEP[(14 + i, z)] = (-14 - i, "w")
    for x in range(22, 27):
        for z in range(68, 73): STEP[(x, z)] = (-21, None)             # the foot
    LAND_AT = [(-2, 68, 2, 72, -7), (10, 68, 14, 72, -14), (22, 68, 26, 72, -21)]

    def target(x, z, real):
        if math.hypot(x - SUN[0], z - SUN[1]) < SUN[2]: return real    # Sunscar's town: the talus may reach its edge, no further
        if (x, z) in STEP: return min(real, STEP[(x, z)][0] - 1)       # the stair is built; the land keeps under it
        for (x0, z0, x1, z1), fy in TERR:
            if x0 - 1 <= x <= x1 + 1 and z0 - 1 <= z <= z1 + 1: return min(fy, max(real, fy - 2)) if x0 <= x <= x1 and z0 <= z <= z1 else min(fy, real + 4)
        if abs(x) <= 6 and -17 <= z < 0: return real                  # under the Span: the drop stays clear
        t = rim_t(x, z)
        if t <= 0:
            if abs(x) <= 38 and -1 <= z <= 60: return 0                 # the school stands level (rigid mode's median)
            lip = -1 if (t > -1.5 and d.r(x, 0, z, 4) < 0.4) else 0
            return lip + round(max(0, 2.2 * n2(x * 0.5, z * 0.5, 4.1) - 0.6) * min(1, -t / 4))   # low hummocks on the top
        bd = math.hypot(x - BUTTE[0], z - BUTTE[1])
        if bd <= butte_r(real): return -14 if bd <= 5.5 else round(-14 - (bd - 4.6) / 0.32)
        h = face(x, z, t, real)
        if any((x + a_, z + b_) in STEP for a_ in range(-2, 3) for b_ in range(-2, 3)):
            h = min(h, max(real, min(STEP.get((x + a_, z + b_), (99,))[0] for a_ in range(-2, 3) for b_ in range(-2, 3)) - 1))
        return h

    BANDS2 = [b_ for k, b_ in enumerate(BANDS) for _ in range(1 + int(d.r(k, 8, 1) * 3))]   # beds of different thickness

    def band(x, y, z):
        if y >= -2: return d.pick(x, y, z, [("red_sandstone", 3), ("smooth_red_sandstone", 1), ("cut_red_sandstone", 1)], 7)   # the caprock
        f = (y + TOP) + 1.4 * math.sin(x * 0.045 + z * 0.03) + 0.025 * x + 0.7 * n2(x * 0.2, z * 0.2, 5.0)   # gently tilted, wavy
        i = int(f) + (1 if d.r(x, y, z, 9) < 0.12 else 0)
        return BANDS2[i % len(BANDS2)]
    def TOPB(x, y, z):                     # the top block: red sand on the mesa and its scree, fading to the desert's sand
        if y > -3: return d.pick(x, y, z, [("red_sand", 7), ("red_sandstone", 2), ("coarse_dirt", 1), ("sand", 1)], 5)
        f = (math.hypot(x, z - 27) - 62) / 26 + 0.35 * n2(x * 0.6, z * 0.6, 6.1)   # the red sand runs out in tongues
        if f < 0.5: return "red_sand" if d.r(x, y, z, 6) < 0.9 else ("red_sandstone" if d.r(x, y, z, 7) < 0.5 else "terracotta")
        return "sand" if f > 0.75 or d.r(x, y, z, 6) < 0.5 else "red_sand"
    SUB = lambda x, y, z: band(x, y, z)
    T = shape(d, G, R0, R, target, TOPB, SUB, depth=4)

    # boulders fallen from the cliffs, out on the talus (never on the stair or in Sunscar)
    for (x, z), y in T.items():
        t = rim_t(x, z)
        if not 4 <= t <= 22 or d.r(x, 3, z, 31) > 0.018 or z < -18: continue
        if any((x + p, z + q) in STEP for p in range(-3, 4) for q in range(-3, 4)) or math.hypot(x - SUN[0], z - SUN[1]) < SUN[2] + 4: continue
        big = d.r(x, 4, z, 31) < 0.35
        for dx in range(0, 2 + big):
            for dz in range(0, 2 + big):
                if d.r(x + dx, 5, z + dz, 31) < 0.8:
                    gy = T.get((x + dx, z + dz), y)
                    for k in range(1, 2 + big - (dx + dz > 2)):
                        d.put(x + dx, gy + k, z + dz, d.pick(x + dx, gy + k, z + dz, [("red_sandstone", 3), ("orange_terracotta", 1), ("terracotta", 1), ("smooth_red_sandstone", 1)], 32))
    # dead bushes on the top, outside the walls
    for (x, z), y in T.items():
        if inside(x, z) < 2 or (abs(x) <= 38 and -1 <= z <= 60): continue
        if d.r(x, y, z, 12) < 0.01: d.put(x, y + 1, z, "deadbush")

    # ---- build the stair: treads, the retaining wall under it down to the land, kerbs and walls, lanterns
    def foot(x, z):
        return T.get((x, z), G.real(x, z))
    for (x, z), (lv, face) in STEP.items():
        for y in range(foot(x, z) - 1, lv):
            d.put(x, y, z, "red_sandstone" if d.r(x, y, z, 21) < 0.5 else "cut_red_sandstone")
        if face: d.put(x, lv, z, "red_sandstone_stairs", facing=face)
        else: d.put(x, lv, z, "cut_red_sandstone" if (x + z) % 2 else "smooth_red_sandstone")
        for y in range(lv + 1, lv + 5): d.air(x, y, z)
    edge, out = {}, {}
    for (x, z), (lv, face) in STEP.items():
        for dx, dz in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            c = (x + dx, z + dz)
            if c in STEP or (z + dz) <= 57: continue
            if (abs(c[0]) <= 2 and c[1] in (58, 59, 60)): continue
            edge[c] = max(edge.get(c, -99), lv); out[c] = (dx, dz)
    for (x, z), lv in edge.items():
        # the kerb: a dressed wall from the land up to one above the highest tread beside it, a wall block on top
        for y in range(foot(x, z) - 1, lv + 1):
            d.put(x, y, z, "cut_red_sandstone" if y == lv else ("red_sandstone" if d.r(x, y, z, 22) < 0.6 else "smooth_red_sandstone"))
        d.put(x, lv + 1, z, "red_sandstone_wall")
    # the retaining wall's face: a pilaster every fourth block standing one out, and between them a blind arch,
    # recessed a block, its head two stairs and a keystone (regions/hollow.md: retaining walls get bays and arch heads)
    for (x, z), lv in edge.items():
        dx, dz = out[(x, z)]
        run = z if dx else x
        g = foot(x, z)
        if lv - g < 5: continue
        k = run % 4
        if k == 0:
            px, pz = x + dx, z + dz
            if (px, pz) in STEP or (px, pz) in edge: continue
            for y in range(foot(px, pz) - 1, lv): d.put(px, y, pz, "cut_red_sandstone")
            d.put(px, lv, pz, "chiseled_red_sandstone")
        else:
            top = lv - 3
            for y in range(g + 1, top): d.air(x, y, z)
            for y in range(g + 1, top): d.put(x - dx, y, z - dz, "smooth_red_sandstone")
            if k == 2: d.put(x, top, z, "chiseled_red_sandstone")
            else:
                along = ("e" if k == 1 else "w") if dx == 0 else ("s" if k == 1 else "n")
                d.put(x, top - 1, z, "red_sandstone_stairs", facing=along, half="top"); d.put(x, top, z, "cut_red_sandstone")
    for (x0, z0, x1, z1, lv) in LAND_AT:                               # lanterns on the corner posts of each landing
        for (x, z) in ((x0 - 1, z0 - 1), (x1 + 1, z0 - 1), (x0 - 1, z1 + 1), (x1 + 1, z1 + 1)):
            if (x, z) in edge:
                d.put(x, edge[(x, z)] + 1, z, "cut_red_sandstone"); d.put(x, edge[(x, z)] + 2, z, "lantern")
    for (x, z) in ((-3, 58), (3, 58), (-3, 60), (3, 60)):
        if (x, z) in edge: d.put(x, edge[(x, z)] + 2, z, "lantern")
    # the story piece itself, as it builds (rigid at G = 0 here)
    piece = LS.cinder_roost()
    for c, v in piece.cells.items(): d.cells[c] = v
    d.parts = getattr(piece, "parts", [])
    d.materials = piece.materials
    d.meta["y0"] = TOP
    d.meta["anchor"] = [ax, TOP, az]
    return d


DESIGNS = {"roost": (roost, "The Cinder Roost")}
