"""Railway stations for every plot and Rail Depot, in each region's style, at four settlement tiers:
Halt (Hamlet), Station (Town), Junction (City) and Grand Station (Castle); plus the Trade House wing each
stage can add behind it and the Junction's engine shed. Asked for by the train system thread (2026-11-11).

Frame (agreed with the train thread). In the exported design, local x runs along the track, with x = 0 at
the middle of the platform. The main line runs along local z = 0 and the building stands behind it at +z.
The platform is full blocks in the y = 0 layer, from z = 2. No design places track. Nothing at all, not
even air, sits in local z -6..1 at y 0..4, because the main line and the passing loop (z = -4) run there.
The Grand Station's arched train shed spans the track from y 5 up.

In the blueprint the building's front faces +z (the kit's "s") toward the track, and blueprint z = -local z.
The door marker (0, 0, -1) makes export_halls.export map blueprint (x, y, z) to local (x, y, -z).

Each stage contains the one before it, so an upgrade only builds outward. Footprints behind the track
(x across the platform, z from 2):
  Halt 15 x 5, Station 23 x 11, Junction 31 x 15, Grand 45 x 21.
The Trade House (up to 11 x 9) is its own design. Its local (0, 0, 0) goes on the station's trade_join
mark: a one-block step at z = 0, its front wall at z = 1, and the building behind.

Interiors stay empty apart from a booking counter.
"""
import math
from kit import Building, h3, finish_detail, wool_awning
from bp import DIRS, OPP
import settle_halls as SH
from settle_halls import pyramid, flat_roof, hang, tower, thatch, dragon_heads
from settle_buildings import new, body, side_windows, dress, REGIONS

STAGES = ("halt", "station", "junction", "grand")
# platform length, last platform row (local z), deepest local z allowed
SIZE = {"halt": (15, 6, 6), "station": (23, 5, 12), "junction": (31, 6, 16), "grand": (45, 7, 22)}

def R(x0, a, x1, b):
    """A blueprint rect from local x0..x1 and local z a..b."""
    return (x0, -b, x1, -a)

def S(bp, x, y, lz, name, **p):
    bp.set(x, y, -lz, name, **p)

def mark(bp, key, x, y, lz):
    bp.marks[key] = (x, y, -lz)

def plat_mats(region, k):
    if region == "blackfen": return "mangrove_planks", k("stone")
    return k("smooth"), k("stone")

def platform(bp, region, k, half, z0, z1):
    body_, edge = plat_mats(region, k)
    for x in range(-half, half + 1):
        for lz in range(z0, z1 + 1):
            S(bp, x, 0, lz, edge if lz == 2 else body_)
            S(bp, x, -1, lz, k("cobbled"))

def roofs(bp, P, L, region, parts, base, seed=0):
    """The region's roof over several wall rects at once: [(rect, ridge, verge)]. Gables merge into one
    height field, so cross gables meet properly. Returns the top y."""
    if L["roof"] == "gable":
        B = Building(bp, P, seed)
        for rect, ridge, verge in parts: B.roof(rect, ridge, base, overhang=1, verge=verge)
        B.build_roofs()
        for rect, ridge, _ in parts: B.gable_walls(rect, ridge, base, style="timber" if L["wall"] == "timber" else "stone")
        if region == "blackfen":
            for rect, _, _ in parts: thatch(bp, P, B, rect)
        if region == "frostmarch":
            for rect, ridge, verge in parts[:1]:
                x0, z0, x1, z1 = rect
                if ridge == "z":
                    for z in (z0 - verge, z1 + verge):
                        cx = (x0 + x1) // 2
                        if (cx, z) in B.H: dragon_heads(bp, cx, B.H[(cx, z)][0] + 1, z)
                else:
                    for x in (x0 - verge, x1 + verge):
                        cz = (z0 + z1) // 2
                        if (x, cz) in B.H: dragon_heads(bp, x, B.H[(x, cz)][0] + 1, cz, along="x")
        return max(h for h, _ in B.H.values()) + 1
    if L["roof"] == "hip":
        top = base
        for (x0, z0, x1, z1), ridge, verge in parts:
            top = max(top, pyramid(bp, P, x0 - 1, z0 - 1, x1 + 1, z1 + 1, base, pitch=1, finial=None) or base)
        return top
    cells = {(x, z) for (x0, z0, x1, z1), _, _ in parts for x in range(x0, x1 + 1) for z in range(z0, z1 + 1)}
    for (x, z) in cells:                            # one roof over the union, parapet only on its outer edge
        edge = any((x + dx, z + dz) not in cells for dx, dz in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        bp.set(x, base, z, P["stone"] if edge else P["roof_flat"])
        if not edge: continue
        bp.set(x, base + 1, z, P["stone"])
        for d, (dx, _, dz) in DIRS.items():         # a corbelled cornice under the parapet breaks up the plain wall
            if dx == dz == 0 or (x + dx, z + dz) in cells: continue
            if bp.get(x + dx, base, z + dz)[0] in ("keep", "air"): bp.set(x + dx, base, z + dz, P["sill"], facing=OPP[d], half="top")
    return base + 1

def canopy(bp, P, half, z0, z1, y, posts_z, skip=lambda x, lz: False, step=4):
    """A platform canopy: top slabs in the region's roof slab, edged with upside-down trim stairs, on
    fence posts, with lanterns hung between the posts."""
    for x in range(-half, half + 1):
        for lz in range(z0, z1 + 1):
            if skip(x, lz) or bp.get(x, y, -lz)[0] not in ("keep", "air"): continue
            if lz == z0: S(bp, x, y, lz, P["trim"], facing="n", half="top")
            else: S(bp, x, y, lz, P["trim_slab"] if P.get("flat_canopy") else P["roof_slab"], half="top")
    xs = list(range(-half + 2, half - 1, step))
    for x in xs:
        if skip(x, posts_z): continue
        for y_ in range(1, y): S(bp, x, y_, posts_z, P["fence"])
    for a, b in zip(xs, xs[1:]):
        m = (a + b) // 2
        if not skip(m, posts_z): S(bp, m, y - 1, posts_z, "lantern", hanging=True)

def bench(bp, P, x, lz, n=2):
    for i in range(n): S(bp, x + i, 1, lz, P["trim"], facing="n")

def counter(bp, P, x0, x1, lz):
    """The booking counter: a run of planks with a slab top, and a lantern on it."""
    for x in range(x0, x1 + 1): S(bp, x, 1, lz, P["trim_block"])
    S(bp, x0, 2, lz, "lantern")

def lamp(bp, P, x, lz, h=3):
    for y in range(1, h): S(bp, x, y, lz, P["fence"])
    S(bp, x, h, lz, "lantern")

def stalls_shed(bp, P, k, L, x0, x1, z0, z1, open_side="back"):
    """A lean-to of horse stalls: coarse dirt floor, a hitching rail, hay and a water trough, a slab roof on posts."""
    post = P["frame"] if L["wall"] == "timber" else k("stone")
    for x in range(x0, x1 + 1):
        for lz in range(z0, z1 + 1):
            S(bp, x, 0, lz, "coarse_dirt"); S(bp, x, -1, lz, k("cobbled"))
            S(bp, x, 4, lz, P["roof_slab"], half="bottom" if lz == z0 else "top")
    for (x, lz) in ((x0, z0), (x1, z0), (x0, z1), (x1, z1)):
        for y in range(1, 4): S(bp, x, y, lz, post, axis="y")
    rail = z1 if open_side == "front" else z0
    for x in range(x0 + 1, x1): S(bp, x, 1, rail, P["fence"])
    S(bp, x0 + 1, 1, z1 if rail == z0 else z0, "hay_block", axis="y")
    S(bp, x1 - 1, 1, z1 if rail == z0 else z0, "cauldron")
    S(bp, (x0 + x1) // 2, 3, (z0 + z1) // 2, "lantern", hanging=True)
    return ((x0 + x1) // 2, 1, (z0 + z1) // 2)

def link(bp, k, lz):
    """The step at the back door toward the Trade House."""
    S(bp, 0, 0, lz, k("cobbled"))

def front_door(B, P, k, L, x, lz, side="s"):
    frame = P["frame"] if L["wall"] == "timber" else k("stone")
    B.door(x, 1, -lz, side, canopy=False, lanterns=True, frame=frame)

def start(region, stage):
    bp, B, P, k, L = new(f"station_{stage}", region)
    P["flat_canopy"] = L["roof"] == "flat"
    return bp, B, P, k, L

def hung(bp, reach=6):
    """Every hanging lantern hangs from something: a chain up to the first solid block above it, or it goes
    (nothing in a station floats, Mateo 2026-11-12)."""
    for (x, y, z), (n, p) in list(bp.cells.items()):
        if n != "lantern" or not p.get("hanging"): continue
        for d in range(1, reach + 1):
            a = bp.cells.get((x, y + d, z))
            if a and a[0] not in ("keep", "air"): break
        else:
            del bp.cells[(x, y, z)]; continue
        for dd in range(1, d): bp.set(x, y + dd, z, "iron_chain")
    return bp

def end(bp, stage, post, stalls, join):
    mark(bp, "track_centre", 0, 0, 0)
    mark(bp, "platform_edge", 0, 0, 2)
    mark(bp, "post", *post)
    mark(bp, "stalls", *stalls)
    mark(bp, "trade_join", *join)
    bp.markers["door"] = (0, 0, -1)
    return hung(finish_detail(bp, {"planters": False}))

# ---------------------------------------------------------------- back detail

def _empty(bp, x, y, z): return bp.get(x, y, z)[0] in ("keep", "air")
def _solid(n): return n not in ("keep", "air") and not any(w in n for w in ("glass", "pane", "door", "lantern", "stairs", "slab", "fence", "trapdoor"))

def course(bp, P, x0, x1, lz, y):
    """A string course along a back wall at local z = lz: top-half stairs one out, under every solid wall block."""
    for x in range(x0, x1 + 1):
        if _solid(bp.get(x, y, -lz)[0]) and _empty(bp, x, y, -(lz + 1)): S(bp, x, y, lz + 1, P["sill"], facing="s", half="top")

def ring_course(bp, P, rect, y):
    """The same band round all four faces of a tower or pavilion (blueprint rect)."""
    x0, z0, x1, z1 = rect
    for x in range(x0, x1 + 1):
        for z in range(z0, z1 + 1):
            if not (x in (x0, x1) or z in (z0, z1)) or not _solid(bp.get(x, y, z)[0]): continue
            for f, (dx, dz) in (("s", (0, -1)), ("n", (0, 1)), ("e", (-1, 0)), ("w", (1, 0))):
                if (x + dx, z + dz) == (x, z): continue
                if not (x0 <= x + dx <= x1 and z0 <= z + dz <= z1) and _empty(bp, x + dx, y, z + dz):
                    bp.set(x + dx, y, z + dz, P["sill"], facing=f, half="top")

def sills(bp, P, x0, x1, lz, y0, y1):
    """A bracketed sill (an upside-down stair, one out) under every back window between y0 and y1."""
    for x in range(x0, x1 + 1):
        for y in range(y0, y1 + 1):
            n = bp.get(x, y, -lz)[0]
            if ("pane" in n or "glass" in n) and "pane" not in bp.get(x, y - 1, -lz)[0] and "glass" not in bp.get(x, y - 1, -lz)[0] \
                    and _empty(bp, x, y - 1, -(lz + 1)):
                S(bp, x, y - 1, lz + 1, P["sill"], facing="s", half="top")

def planter(bp, P, x, lz):
    """A sign-boxed bush against the back wall (07-detailing)."""
    if not _empty(bp, x, 1, -(lz + 1)): return
    wood = P["trim"].replace("_stairs", "")
    S(bp, x, 1, lz + 1, "azalea_leaves" if h3(x, 1, lz, 3) < 0.5 else "oak_leaves", persistent=True)
    for f, dx in (("e", 1), ("w", -1)):
        if _empty(bp, x + dx, 1, -(lz + 1)): S(bp, x + dx, 1, lz + 1, wood + "_wall_sign" if wood != "oak" else "oak_wall_sign", facing=f)

def louvres(bp, P, xs, ys, lz, out):
    """Belfry louvres: the bell openings shut with slatted trapdoors flush to the outer face."""
    td = P["trim"].replace("_stairs", "_trapdoor")
    if td in ("stone_brick_trapdoor",) or "stone" in td or "brick" in td: td = "spruce_trapdoor"
    for x in xs:
        for y in ys: S(bp, x, y, lz, td, facing="n" if out == "s" else "s", open=True)

# ---------------------------------------------------------------- the four stages

def halt(region):
    """Halt: a small waiting shelter with its eaves to the line, a ticket counter and a bench, a hitching rail."""
    bp, B, P, k, L = start(region, "halt")
    platform(bp, region, k, 7, 2, 6)
    rect = R(-3, 3, 3, 5)
    B.foundation(rect, 0)
    for x in range(-2, 3):
        for lz in (4,): S(bp, x, 0, lz, plat_mats(region, k)[0])
    top = body(B, P, L, rect, 4)
    for x in range(-2, 3):                         # open front under the beam
        for y in range(1, 4): S(bp, x, y, 3, "air")
    S(bp, 0, 0, 3, plat_mats(region, k)[0])
    side_windows(B, L, rect, 1, sides="ew")
    counter(bp, P, 1, 2, 4); bench(bp, P, -2, 4)
    # eaves to the line (Mateo 2026-11-12: a gable to the line on a box three deep read as a house cut in half)
    roofs(bp, P, L, region, [(rect, "x", 1)], top + (1 if L["roof"] != "flat" else 0))
    hang(bp, [(0, 3, -4)])
    stalls = stalls_shed(bp, P, k, L, -7, -5, 4, 6)
    lamp(bp, P, 6, 4); lamp(bp, P, -4, 6)
    # the back (Mateo 2026-11-12: more detail on the back): a door to the Trade House step, windows either side
    B.door(0, 1, -5, "n", canopy=False, lanterns=True, frame=P["frame"] if L["wall"] == "timber" else k("stone"))
    for x in (-2, 2):
        for y in (2, 3): S(bp, x, y, 5, P["pane"])
    sills(bp, P, -3, 3, 5, 1, 4)
    S(bp, 3, 1, 6, "barrel"); S(bp, 3, 2, 6, "barrel")
    return end(bp, "halt", (5, 1, 3), stalls, (0, 0, 7))

def station(region):
    """Station: a booking hall along the platform with a centre gable to the line, a platform canopy,
    benches, street doors at both ends, a parcels corner and a stalls lean-to."""
    bp, B, P, k, L = start(region, "station")
    platform(bp, region, k, 11, 2, 5)
    hall = R(-7, 6, 7, 10); mid = R(-3, 5, 3, 10)
    for r in (hall, mid): B.foundation(r, 0); B.floor(r, 0)
    top = body(B, P, L, hall, 5)
    body(B, P, L, mid, 5)
    for x in range(-2, 3):                          # the hall and the centre bay are one room
        for y in range(1, 6): S(bp, x, y, 6, "air")
    S(bp, 0, 0, 6, P["floor"])
    for x in range(-2, 3): S(bp, x, 0, 6, P["floor"])
    side_windows(B, L, hall, 1, sides="sn")
    front_door(B, P, k, L, 0, 5)
    front_door(B, P, k, L, 0, 10, side="n")
    B.door(7, 1, -8, "e", canopy=False, lanterns=True, frame=P["frame"] if L["wall"] == "timber" else k("stone"))
    B.door(-7, 1, -8, "w", canopy=False, lanterns=True, frame=P["frame"] if L["wall"] == "timber" else k("stone"))
    counter(bp, P, 2, 5, 8); bench(bp, P, -5, 9, 3)
    base = top + (1 if L["roof"] != "flat" else 0)
    roofs(bp, P, L, region, [(hall, "x", 1), (mid, "z", 1)], base)
    dress(bp, k, L, hall, 1, top, region)
    if L["roof"] == "gable":                        # a window in the centre gable over the door
        for x in (-1, 0, 1): S(bp, x, base + 1, 5, P["pane"])
        S(bp, 0, base + 2, 5, P["pane"])
    skip = lambda x, lz: (-3 <= x <= 3 and lz >= 5) or (-7 <= x <= 7 and lz >= 6)
    canopy(bp, P, 10, 2, 5, 4, 4, skip=lambda x, lz: skip(x, lz) or (abs(x) <= 1 and lz == 4))
    bench(bp, P, -6, 5); bench(bp, P, 5, 5)
    stalls = stalls_shed(bp, P, k, L, 9, 11, 7, 11)
    for (x, lz) in ((-10, 8), (-9, 8), (-10, 9)): S(bp, x, 1, lz, "barrel")
    S(bp, -10, 2, 8, "barrel"); S(bp, -9, 1, 10, "chest", facing="e")
    lamp(bp, P, -11, 10); link(bp, k, 11)
    sills(bp, P, -7, 7, 10, 1, 6)                   # the back: sills, planters, a lamp at the street door
    for x in (-6, -4, 4, 6): planter(bp, P, x, 10)
    lamp(bp, P, 3, 11)
    return end(bp, "station", (4, 1, 3), stalls, (0, 0, 12))

def junction(region):
    """Junction: a two-storey hall with a clock tower in the middle of its platform front, single-storey
    wings (a stable wing open to the street, a parcels wing), and a deep platform canopy."""
    bp, B, P, k, L = start(region, "junction")
    platform(bp, region, k, 15, 2, 6)
    hall = R(-8, 8, 8, 14)
    B.foundation(hall, 0); B.floor(hall, 0)
    B.stone_storey(hall, 1, 5, quoins=True)
    B.floor(hall, 5)
    top = body(B, P, L, hall, 5, y0=6, plinth=False)
    side_windows(B, L, hall, 1, sides="sn"); side_windows(B, L, hall, 6, sides="sn")
    for x in (-5, 5): front_door(B, P, k, L, x, 8)
    for x in (-5, 0, 5): front_door(B, P, k, L, x, 14, side="n")
    counter(bp, P, -7, -3, 11); bench(bp, P, 2, 13, 3)
    base = top + (1 if L["roof"] != "flat" else 0)
    roofs(bp, P, L, region, [(hall, "x", 1)], base)
    wings = (R(-13, 9, -9, 13), R(9, 9, 13, 13))
    for w in wings:
        B.foundation(w, 0); B.floor(w, 0)
        wt = body(B, P, L, w, 5)
    for x in range(-12, -9):                        # the stable wing opens to the street
        for y in range(1, 5): S(bp, x, y, 13, "air")
        S(bp, x, 0, 13, "coarse_dirt")
    for x in range(-12, -9):
        for lz in range(10, 13): S(bp, x, 0, lz, "coarse_dirt")
    for x in range(-12, -9): S(bp, x, 1, 11, P["fence"])
    S(bp, -12, 1, 10, "hay_block", axis="y"); S(bp, -10, 1, 10, "cauldron")
    hang(bp, [(-11, 4, -11)])
    side_windows(B, L, wings[1], 1, sides="se")
    side_windows(B, L, wings[0], 1, sides="s")
    for (x, lz) in ((12, 10), (11, 10), (12, 11)): S(bp, x, 1, lz, "barrel")
    S(bp, 10, 1, 12, "chest", facing="e")
    B.door(11, 1, -13, "n", canopy=False, lanterns=True, frame=P["frame"] if L["wall"] == "timber" else k("stone"))
    roofs(bp, P, L, region, [(wings[0], "z", 1), (wings[1], "z", 1)], wt + (1 if L["roof"] != "flat" else 0), seed=3)
    TB = Building(bp, P, 31)
    yt = tower(TB, 0, -9, 2, 1, 17, top="spire" if L["roof"] != "flat" else "crenel")
    for y in (1, 2, 3):
        for x in (-1, 0, 1): S(bp, x, y, 11, "air")
    front_door(TB, P, k, L, 0, 7)
    louvres(bp, P, (-1, 0, 1), (13, 14), 7, "s"); louvres(bp, P, (-1, 0, 1), (13, 14), 11, "n")
    for x in (-1, 0, 1):                            # sills under the louvres, front and back
        S(bp, x, 12, 6, P["sill"], facing="n", half="top"); S(bp, x, 12, 12, P["sill"], facing="s", half="top")
    hang(bp, [(0, 14, -9)])
    ring_course(bp, P, (-2, -11, 2, -7), 6); ring_course(bp, P, (-2, -11, 2, -7), 11)
    skip = lambda x, lz: (-2 <= x <= 2 and lz >= 7) or (-8 <= x <= 8 and lz >= 8) or (abs(x) >= 9 and lz >= 9)
    canopy(bp, P, 14, 2, 8, 5, 4, skip=skip)
    for x in (-7, 6): bench(bp, P, x, 7)
    stalls = (-11, 1, 12)
    link(bp, k, 15)
    course(bp, P, -8, 8, 14, 5)                     # the back: a band at the upper floor, sills, planters, lamps
    sills(bp, P, -8, 8, 14, 1, 12); sills(bp, P, 9, 13, 13, 1, 5)
    for x in (-7, -3, 3, 7): planter(bp, P, x, 14)
    lamp(bp, P, -8, 15); lamp(bp, P, 8, 15)
    return end(bp, "junction", (4, 1, 3), stalls, (0, 0, 16))

def shed_arch(lz):
    """Height of the Grand Station's train shed vault over local z (-7..7)."""
    return 5 + int(round(6.5 * math.sqrt(max(0.0, 1 - (lz / 7.5) ** 2))))

def grand(region):
    """Grand Station: an arched glass train shed over both lines, a long two-storey hall with a tall centre
    pavilion and archway, twin clock towers, and end wings (stables to the street, parcels)."""
    bp, B, P, k, L = start(region, "grand")
    platform(bp, region, k, 22, 2, 8)
    rib = k("smooth"); col = k("stone")
    ribs = list(range(-22, 23, 4))
    for x in range(-22, 23):
        for lz in range(-7, 8):
            y = shed_arch(lz)
            # each column reaches down to its outer neighbour's height, so the vault has no holes on either side,
            # and the outermost comes down onto the side beam (y 5): no open row under the roof (Mateo, 2026-11-12)
            low = 5 if abs(lz) == 7 else min(y, shed_arch(lz + (1 if lz > 0 else -1)))
            for yy in range(low, y + 1):
                if x in ribs: S(bp, x, yy, lz, rib)
                else: S(bp, x, yy, lz, "glass")
        S(bp, x, 5, -7, rib); S(bp, x, 5, 7, rib)
    for x in ribs:
        for y in range(0, 5): S(bp, x, y, 7, col); S(bp, x, y, -7, col)
        S(bp, x, -1, -7, k("cobbled"))
    for x in ribs[:-1]:                             # an arch between each pair of pillars, both sides (Mateo, 2026-11-12)
        for lz in (-7, 7):
            S(bp, x + 1, 4, lz, P["sill"], facing="w", half="top")
            S(bp, x + 3, 4, lz, P["sill"], facing="e", half="top")
    hall = R(-11, 9, 11, 19); pav = R(-4, 8, 4, 20)
    for r in (hall, pav): B.foundation(r, 0); B.floor(r, 0)
    B.stone_storey(hall, 1, 6, quoins=True)
    B.floor(hall, 6)
    top = body(B, P, L, hall, 5, y0=7, plinth=False)
    side_windows(B, L, hall, 1, sides="sn"); side_windows(B, L, hall, 7, sides="sn")
    PB = Building(bp, P, 17)
    PB.stone_storey(pav, 1, 15, quoins=True)
    for x in range(-3, 4):                          # the pavilion opens into the hall
        for y in range(1, 6):
            S(bp, x, y, 9, "air"); S(bp, x, y, 19, "air")
    for x in range(-3, 4): S(bp, x, 0, 9, P["floor"]); S(bp, x, 0, 19, P["floor"])
    for x in (-1, 0, 1):                            # the archway from the platform, and the tall window above it
        for y in range(1, 5): S(bp, x, y, 8, "air")
        for y in range(7, 13): S(bp, x, y, 8, P["pane"])
    S(bp, 0, 13, 8, P["pane"])
    for x in (-2, 2):
        for y in range(1, 6): S(bp, x, y, 8, col)
    for x in (-1, 0, 1): S(bp, x, 5, 8, rib)
    for y in (2, 3, 9, 10): S(bp, -4, y, 14, P["pane"]); S(bp, 4, y, 14, P["pane"])
    front_door(PB, P, k, L, 0, 20, side="n")
    for x in (-8, 8): front_door(B, P, k, L, x, 9)
    for x in (-8, 8): front_door(B, P, k, L, x, 19, side="n")
    counter(bp, P, -9, -6, 15); counter(bp, P, 6, 9, 15)
    base = top + (1 if L["roof"] != "flat" else 0)
    roofs(bp, P, L, region, [(hall, "x", 1)], base)
    roofs(bp, P, L, region, [(pav, "z", 1)], 16, seed=5)
    dress(bp, k, L, pav, 1, 16, region)
    for cx in (-14, 14):
        TB = Building(bp, P, 40 + cx)
        tower(TB, cx, -14, 2, 1, 21, top="spire" if L["roof"] != "flat" else "crenel")
        hang(bp, [(cx, 18, -14)])
    wings = (R(-21, 10, -17, 18), R(17, 10, 21, 18))
    for w in wings:
        B.foundation(w, 0); B.floor(w, 0)
        wt = body(B, P, L, w, 5)
    side_windows(B, L, wings[0], 1, sides="sw"); side_windows(B, L, wings[1], 1, sides="se")
    for x in range(-20, -17):                       # the stable wing opens to the street
        for y in range(1, 5): S(bp, x, y, 18, "air")
        for lz in range(11, 19): S(bp, x, 0, lz, "coarse_dirt")
    for x in range(-20, -17): S(bp, x, 1, 15, P["fence"]); S(bp, x, 1, 12, P["fence"])
    S(bp, -20, 1, 11, "hay_block", axis="y"); S(bp, -18, 1, 13, "cauldron"); S(bp, -20, 1, 14, "hay_block", axis="y")
    hang(bp, [(-19, 4, -13), (-19, 4, -16)])
    for (x, lz) in ((20, 11), (19, 11), (20, 12), (18, 11)): S(bp, x, 1, lz, "barrel")
    S(bp, 20, 2, 11, "barrel"); S(bp, 20, 1, 14, "chest", facing="w")
    B.door(19, 1, -18, "n", canopy=False, lanterns=True, frame=P["frame"] if L["wall"] == "timber" else k("stone"))
    for w in wings: B.door(w[0] + 2 if w[0] > 0 else w[2] - 2, 1, -10, "s", canopy=False, lanterns=True, frame=P["frame"] if L["wall"] == "timber" else k("stone"))
    roofs(bp, P, L, region, [(wings[0], "z", 1), (wings[1], "z", 1)], wt + (1 if L["roof"] != "flat" else 0), seed=3)
    for x in range(-22, 23):                        # a slab strip from the shed's edge to the building
        for lz in (8,):
            if bp.get(x, 5, -lz)[0] in ("keep", "air") and not (-4 <= x <= 4): S(bp, x, 5, lz, P["roof_slab"], half="top")
    for x in (-18, -10, 10, 18): bench(bp, P, x, 8)
    for x in (-20, -6, 6, 20): hang(bp, [(x, 4, -6)])
    link(bp, k, 21)
    # the back (Mateo 2026-11-12): the pavilion gets the front's tall window, pilasters, two bands and a balcony
    for x in (-1, 0, 1):
        for y in range(7, 13): S(bp, x, y, 20, P["pane"])
    S(bp, 0, 13, 20, P["pane"])
    for x in (-3, 3):
        S(bp, x, 1, 21, P["sill"], facing="s")
        for y in range(2, 15): S(bp, x, y, 21, rib)
        S(bp, x, 15, 21, P["sill"], facing="s", half="top")
    course(bp, P, -4, 4, 20, 14); course(bp, P, -11, 11, 19, 6)
    for x in range(-2, 3):
        S(bp, x, 6, 21, P["trim_slab"] if "trim_slab" in P else P["roof_slab"], half="top"); S(bp, x, 6, 22, P["trim_slab"] if "trim_slab" in P else P["roof_slab"], half="top")
        S(bp, x, 7, 22, P["fence"])
    for x in (-2, 2): S(bp, x, 7, 21, P["fence"]); S(bp, x, 5, 22, P["trim"], facing="s", half="top")
    sills(bp, P, -11, 11, 19, 1, 12); sills(bp, P, -21, -17, 18, 1, 5); sills(bp, P, 17, 21, 18, 1, 5)
    for x in (-10, -6, 6, 10): planter(bp, P, x, 19)
    for cx in (-14, 14):                            # bands round the clock towers at each storey
        for y in (6, 12, 18): ring_course(bp, P, (cx - 2, -16, cx + 2, -12), y)
    lamp(bp, P, -5, 21); lamp(bp, P, 5, 21)
    return end(bp, "grand", (6, 1, 3), (-19, 1, 14), (0, 0, 22))

STAGE_BUILDERS = {"halt": halt, "station": station, "junction": junction, "grand": grand}

# ---------------------------------------------------------------- the Trade House wing

TRADE = {"halt": (3, 5, 1), "station": (4, 5, 1), "junction": (4, 7, 2), "grand": (4, 7, 2)}   # half width, depth, storeys

def trade_house(region, stage):
    """The Trade House: a goods hall behind the station, its door facing the station's back door across a
    one-block step, a striped awning over the serving counter on the street side, crates and barrels."""
    bp, B, P, k, L = new(f"trade_{stage}", region)
    hw, d, storeys = TRADE[stage]
    a, b = L["awning"]
    rect = R(-hw, 1, hw, d)
    B.foundation(rect, 0); B.floor(rect, 0)
    S(bp, 0, 0, 0, k("cobbled"))
    if storeys == 2:
        B.stone_storey(rect, 1, 5, quoins=True); B.floor(rect, 5)
        top = body(B, P, L, rect, 5, y0=6, plinth=False)
        side_windows(B, L, rect, 6, sides="nsew")
    else:
        top = body(B, P, L, rect, 4)
    side_windows(B, L, rect, 1, sides="ew")
    front_door(B, P, k, L, 0, 1)
    for x in range(-hw + 2, hw - 1):                # the serving hatch and counter on the street side
        S(bp, x, 2, d, "air"); S(bp, x, 1, d, P["trim"], facing="n", half="top")
    wool_awning(bp, range(-hw + 1, hw), 4, -d, "n", (a, b), depth=1)
    for x in (-hw + 1, hw - 1):
        for y in (1, 2, 3): S(bp, x, y, d + 1, P["fence"])
    roofs(bp, P, L, region, [(rect, "x", 1)], top + (1 if L["roof"] != "flat" else 0))
    dress(bp, k, L, rect, 1, top, region)
    for (x, lz) in ((-hw + 1, 2), (-hw + 1, 3), (hw - 1, 2)): S(bp, x, 1, lz, "barrel")
    S(bp, -hw + 1, 2, 2, "barrel"); S(bp, hw - 1, 1, d - 1, "chest", facing="w")
    if storeys == 2:                                # a hoist beam over the street hatch
        S(bp, 0, 9, d + 1, P["trim_block"]); S(bp, 0, 8, d + 1, P["fence"])
    hang(bp, [(0, 3, -(d + 1))])
    mark(bp, "door", 0, 1, 1)
    bp.markers["door"] = (0, 0, -1)
    return hung(finish_detail(bp, dict(P, planters=False)))

# ---------------------------------------------------------------- the Junction's engine shed

def engine_shed(region):
    """An engine shed with its own track axis along local x at z = 0: walls at z = +-3, open arched ends,
    17 long, a pitched roof with two smoke stacks. The inside, z -2..2, stays clear up to y 5."""
    bp, B, P, k, L = new("engine_shed", region)
    rect = R(-8, -3, 8, 3)
    for x in range(-8, 9):
        for lz in (-3, 3): S(bp, x, 0, lz, k("cobbled")); S(bp, x, -1, lz, k("cobbled"))
    top = body(B, P, L, rect, 6)
    for x in (-8, 8):
        for lz in range(-2, 3):
            for y in range(1, 6): S(bp, x, y, lz, "air")
    for x in range(-7, 8):
        for lz in range(-2, 3): bp.cells.pop((x, 0, -lz), None)
    for x in (-8, 8):
        for lz in range(-2, 3): bp.cells.pop((x, 0, -lz), None)
    side_windows(B, L, rect, 2, sides="ns")
    base = top + (1 if L["roof"] != "flat" else 0)
    roofs(bp, P, L, region, [(rect, "x", 1)], base)
    for x in (-4, 4):
        for y in range(base + 1, base + 6):   # from the roof up: no gap under a stack on a flat roof
            if bp.get(x, y, 0)[0] in ("keep", "air") or "carpet" in bp.get(x, y, 0)[0]: S(bp, x, y, 0, k("bricks"))   # a stack stands on the roof, not on a moss carpet
        S(bp, x, base + 6, 0, "stone_brick_wall")
    for x in (-8, 8):
        for lz in (-3, 3): S(bp, x, 6, lz, k("stone"))
    hang(bp, [(-4, 5, 0), (4, 5, 0)])
    mark(bp, "track_centre", 0, 0, 0)
    bp.markers["door"] = (0, 0, -1)
    return hung(finish_detail(bp, dict(P, planters=False)))
