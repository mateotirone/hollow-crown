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
  Halt 15 x 8, Station 23 x 11, Junction 31 x 15, Grand 45 x 21.
The Trade House (up to 11 x 9) is its own design. Its local (0, 0, 0) goes on the station's trade_join
mark: a one-block step at z = 0, its front wall at z = 1, and the building behind.

Every building comes from the skill (review/specs/gen_stations.py) with its interior: the booking hall's ticket\nwindow, benches and timetable, the stable and parcels wings, the tower's rooms.
"""
import math
from kit import Building, h3, finish_detail, wool_awning
from bp import DIRS, OPP
import settle_halls as SH
from settle_halls import pyramid, flat_roof, hang, tower, thatch, dragon_heads
from settle_buildings import new, body, side_windows, dress, REGIONS, castle

STAGES = ("halt", "station", "junction", "grand")
# platform length, last platform row (local z), deepest local z allowed
SIZE = {"halt": (15, 7, 9), "station": (23, 5, 12), "junction": (31, 6, 16), "grand": (45, 7, 22)}

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
    if _empty(bp, x, 0, -lz):                       # a footing: nothing floats
        st = P.get("stone", "cobblestone"); S(bp, x, 0, lz, st(x, 0, -lz)[0] if callable(st) else st)
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
    return hung(finish_detail(bp, {"planters": False, "region": bp.name.rsplit("_", 1)[-1]}))

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

def shell(bp, stage, region):
    """The station building on the skill (the one engine): review/specs/station_<stage>_<region>.json, written by
    gen_stations.py after the Kingsrest station (Mateo 2026-11-15). Hall, porch or clock tower, canopies, wings and
    the booking hall inside all come from there; this module adds the platform, the train shed and the marks."""
    import json, os, sys
    here = os.path.dirname(os.path.abspath(__file__))
    sk = os.path.join(here, "..", "..", ".claude", "skills", "minecraft-builder", "scripts")
    if sk not in sys.path: sys.path.insert(0, sk)
    import engine
    from bp import Blueprint
    spec = json.load(open(os.path.join(here, "review", "specs", f"station_{stage}_{region}.json")))
    tmp = Blueprint("shell"); engine.into_blueprint(tmp, spec)
    for c, v in tmp.cells.items(): bp.cells[c] = v
    # every door path is paved to the door (Mateo, PR #400): a cobbled step outside any outer door with no floor
    out = {"n": (0, -1), "s": (0, 1), "e": (1, 0), "w": (-1, 0)}
    for (x, y, z), (n, p) in list(bp.cells.items()):
        if n.endswith("_door") and not p.get("upper") and p.get("facing") in out:
            dx, dz = out[p["facing"]]
            if bp.get(x + dx, y - 1, z + dz)[0] in ("keep", "air"): bp.set(x + dx, y - 1, z + dz, castle(region)("cobbled"))
    return bp

def halt(region):
    """Halt: a booking hut on the platform, its gable to the line, a waiting canopy against each side, a hitching
    rail at the west end, a back door to the Trade House step."""
    bp, B, P, k, L = start(region, "halt")
    platform(bp, region, k, 7, 2, 7)
    shell(bp, "halt", region)
    bench(bp, P, -5, 7); bench(bp, P, 4, 7)
    for lz in (4, 5): S(bp, -7, 1, lz, P["fence"])
    S(bp, -7, 1, 6, "hay_block", axis="y")
    S(bp, 5, 1, 4, "barrel"); S(bp, 5, 2, 4, "barrel")
    lamp(bp, P, 7, 3); lamp(bp, P, -6, 3)
    link(bp, k, 9)
    return end(bp, "halt", (2, 1, 3), (-6, 1, 5), (0, 0, 10))

def station(region):
    """Station: a booking hall along the platform with a gabled porch to the line, canopies either side on the hall
    wall, a stalls lean-to at the east end, a parcels lean-to at the west, a street door behind."""
    bp, B, P, k, L = start(region, "station")
    platform(bp, region, k, 11, 2, 5)
    shell(bp, "station", region)
    bench(bp, P, -6, 5); bench(bp, P, 4, 5)
    S(bp, 8, 1, 9, "hay_block", axis="y"); S(bp, 8, 1, 7, "cauldron")
    for (x, lz) in ((-8, 9), (-8, 8), (-9, 9)): S(bp, x, 1, lz, "barrel")
    S(bp, -8, 2, 9, "barrel"); S(bp, -8, 1, 7, "chest", facing="w")
    lamp(bp, P, -10, 3); lamp(bp, P, 10, 3)
    link(bp, k, 11); lamp(bp, P, 3, 11); lamp(bp, P, -3, 11)
    return end(bp, "station", (4, 1, 3), (9, 1, 8), (0, 0, 12))

def junction(region):
    """Junction: a two-storey hall with a clock tower on the middle of its platform front (its foot the entrance),
    canopies either side on the hall wall, a stable wing and a parcels wing at the ends."""
    bp, B, P, k, L = start(region, "junction")
    platform(bp, region, k, 15, 2, 7)
    shell(bp, "junction", region)
    for x in (-7, 5): bench(bp, P, x, 7)
    lamp(bp, P, -12, 3); lamp(bp, P, 12, 3)
    link(bp, k, 15); lamp(bp, P, -3, 15); lamp(bp, P, 3, 15)
    return end(bp, "junction", (4, 1, 3), (-11, 1, 11), (0, 0, 16))

def shed_arch(lz):
    """Height of the Grand Station's train shed vault over local z (-7..7)."""
    return 5 + int(round(6.5 * math.sqrt(max(0.0, 1 - (lz / 7.5) ** 2))))

def grand(region):
    """Grand Station: the Kingsrest station's plan at full size (Mateo 2026-11-15): an arched glass train shed over
    both lines, a long two-storey hall along the platform, the clock tower on the middle of the street front (its
    foot the street entrance), a stable wing and a parcels wing at the ends."""
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
    shell(bp, "grand", region)
    for x in range(-22, 23):                        # a slab strip from the shed's edge to the building
        if bp.get(x, 5, -8)[0] in ("keep", "air"): S(bp, x, 5, 8, P["roof_slab"], half="top")
    for x in (-18, -10, 10, 18): bench(bp, P, x, 8)
    for x in (-20, -6, 6, 20): hang(bp, [(x, 4, -6)])
    link(bp, k, 21); lamp(bp, P, -6, 21); lamp(bp, P, 6, 21)
    return end(bp, "grand", (6, 1, 3), (-17, 1, 13), (0, 0, 22))

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
    # Mateo 2026-11-12 ("needs a ton of work", "the blocks on top are floating"): a smoke ventilator runs along the
    # ridge (slatted sides, its own little roof), the two stacks rise from the roof itself, and the open ends get
    # arched heads with plank doors folded back against the walls.
    soft = lambda n: n in ("keep", "air") or "carpet" in n
    def roof_top(x, z):
        ys = [y for (cx, y, cz), v in bp.cells.items() if cx == x and cz == z and not soft(v[0])
              and not any(w in v[0] for w in ("fence", "_wall", "rod", "chain", "lantern", "spike"))]
        return max(ys) if ys else base
    if L["roof"] == "gable":                     # the vent sits on a ridge (hips and flat roofs have none)
        ridge = roof_top(0, 0)
        trap = P["trim"].replace("_stairs", "_trapdoor")
        if "stone" in trap or "brick" in trap or "sandstone" in trap: trap = "spruce_trapdoor"
        slab = P["trim"].replace("_stairs", "_slab")
        for x in range(-6, 7):
            if x in (-4, 4): continue
            for lz in (-1, 1):                                                  # slats standing on the slopes either side
                for y in range(roof_top(x, -lz) + 1, ridge + 2): S(bp, x, y, lz, trap, open=True, facing="n" if lz > 0 else "s")
            S(bp, x, ridge + 1, 0, "air")
            for lz in (-1, 0, 1): S(bp, x, ridge + 2, lz, slab, half="bottom")  # its own low roof
    for x in (-4, 4):
        t = roof_top(x, 0)
        for y in range(t + 1, t + 4): S(bp, x, y, 0, k("bricks"))             # a stack on the roof, never in the air
        S(bp, x, t + 4, 0, "stone_brick_wall")
    for x in (-8, 8):                                                             # arched heads over the open ends
        out = 1 if x > 0 else -1
        S(bp, x, 5, -2, P["sill"], facing="n", half="top"); S(bp, x, 5, 2, P["sill"], facing="s", half="top")
        for lz in (-2, 2):                                                        # plank doors folded back on the walls
            for y in range(1, 5): S(bp, x + out, y, lz + (1 if lz > 0 else -1), P["trim"].replace("_stairs", "_trapdoor") if "stone" not in P["trim"] else "spruce_trapdoor", open=True, facing="e" if out > 0 else "w")
    for x in (-8, 8):
        for lz in (-3, 3): S(bp, x, 6, lz, k("stone"))
    hang(bp, [(-4, 5, 0), (4, 5, 0)])
    mark(bp, "track_centre", 0, 0, 0)
    bp.markers["door"] = (0, 0, -1)
    return hung(finish_detail(bp, dict(P, planters=False)))
