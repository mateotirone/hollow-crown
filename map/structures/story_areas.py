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
    R0, R = 70, 86

    def n2(x, z, s_):
        return math.sin(x * 0.11 + s_) * math.cos(z * 0.09 + 2 * s_) + 0.5 * math.sin((x + z) * 0.23 + 3 * s_)

    # the plateau: a lobed superellipse south of the rim; the rim is straight and sheer where the Span leaves it
    HARM = [(k, 0.05 + 0.1 * d.r(k, 3, 1) / (1 + 0.25 * k), d.r(k, 4, 1) * math.tau) for k in range(2, 9)]

    def rim(th):                                                       # the plateau's radius round (0, 24)
        return 30 * (1 + sum(a * math.cos(k * th + ph) for k, a, ph in HARM))

    def inside(x, z):
        if abs(x) <= 11 and 0 <= z <= 16: return 1.0                 # the yard and gatehouse, and the rock under them
        if z < 0 and not (abs(x) > 14): return -1.0
        th = math.atan2(z - 24, x * 1.25); r = math.hypot(x / 1.25, z - 24)
        return 1.0 - (r + 1.6 * n2(x * 2.1, z * 2.1, 0.4)) / rim(th)

    def bench(x, z):                                                   # a ledge partway down the face, here and there
        return n2(x * 0.6, z * 0.6, 2.7) > 0.35
    BUTTE = (0, -21)                                                  # the perch's own rock (perch walls G-14..G)

    def butte_r(y):                                                   # radius of the butte at height y (relative)
        return 4.6 + max(0, (-14 - y)) * 0.32

    edge = next(z for z in range(20, 90) if inside(0, z) < 0)       # the south rim on the centre line
    ZA, ZB = edge - 20, edge + 24

    def way(x, z):
        if abs(x) > 2 or not ZA <= z <= ZB: return None
        return -((z - ZA) // 2)

    def target(x, z, real):
        w = way(x, z)
        if w is not None:
            return max(w, real) if abs(x) <= 1 else max(w + 1, real) if inside(x, z) < 0 else max(w + 3, min(0, w + 4))
        k = inside(x, z)
        if k >= 0:
            if abs(x) <= 13 and -1 <= z <= 18: return 0                 # the yard stays flat (rigid mode's median)
            lip = -1 if (k < 0.06 and d.r(x, 0, z, 4) < 0.4) else 0
            return lip + round(max(0, 2.2 * n2(x * 0.5, z * 0.5, 4.1) - 0.6) * min(1, k * 4))   # low hummocks on the top
        if k > -0.12 and bench(x, z) and not (abs(x) <= 6 and z < 0): return -8 - round(2 * d.r(x, 1, z, 6))
        bd = math.hypot(x - BUTTE[0], z - BUTTE[1])
        if bd <= butte_r(real): return -14 if bd <= 5.5 else round(-14 - (bd - 4.6) / 0.32)
        # off the mesa: scree heaped at the foot of the cliffs, fading out over ten blocks
        dist = 99
        for r_ in range(1, 12):
            if any(inside(x + dx * r_, z + dz * r_) >= 0 for dx, dz in ((1, 0), (-1, 0), (0, 1), (0, -1))): dist = r_; break
        if abs(x) <= 6 and -17 <= z < 0: return real                  # under the Span: the drop stays clear
        return real + max(0, round(6 - 0.9 * dist + 2.5 * n2(x * 1.7, z * 1.7, 2.1)))

    def band(x, y, z):
        i = int((y + TOP) + 0.8 * math.sin(x * 0.07 + z * 0.05)) % len(BANDS)
        return BANDS[i]
    TOPB = lambda x, y, z: (band(x, y, z) if y < -2 else
                            d.pick(x, y, z, [("red_sand", 7), ("red_sandstone", 2), ("coarse_dirt", 1), ("sand", 1)], 5))
    SUB = lambda x, y, z: band(x, y, z)
    T = shape(d, G, R0, R, target, TOPB, SUB, depth=4)

    # the cliff faces: banded all the way down (shape() tops raised columns with the top block; the face below is
    # the sub band), with spurs and fallen blocks at the foot
    for k in range(18):
        a = d.r(k, 1, 7) * math.tau; rr = 40 + 10 * d.r(k, 2, 7)
        x, z = round(math.sin(a) * rr * 0.95), round(24 + math.cos(a) * rr * 0.7)
        if z < -2 or inside(x, z) >= 0: continue
        g = T.get((x, z), G.real(x, z))
        for (dx, dz) in ((0, 0), (1, 0), (0, 1), (1, 1)):
            if d.r(x + dx, 0, z + dz, 8) < 0.7: d.put(x + dx, g + 1, z + dz, d.pick(x + dx, g, z + dz, [("red_sandstone", 2), ("orange_terracotta", 1), ("hardened_clay", 1)], 9))
    # dead bushes and a few red-sand drifts on the top
    for (x, z), y in T.items():
        if inside(x, z) < 0.1 or (abs(x) <= 11 and -1 <= z <= 16): continue
        t = d.r(x, y, z, 12)
        if t < 0.008: d.put(x, y + 1, z, "deadbush")
    # the riders' way up: a cut climbing the south face toward Sunscar, open to the sky, one up in two
    for (x, z), y in T.items():
        if way(x, z) is not None and abs(x) <= 1:
            d.put(x, y, z, "smooth_red_sandstone" if (z % 2 == 0) else "red_sandstone_slab", **({} if z % 2 == 0 else {"half": "top"}))
    # the story piece itself, as it builds (rigid at G = 0 here)
    piece = LS.cinder_roost()
    for c, v in piece.cells.items(): d.cells[c] = v
    d.meta["y0"] = TOP
    d.meta["anchor"] = [ax, TOP, az]
    return d


DESIGNS = {"roost": (roost, "The Cinder Roost")}
