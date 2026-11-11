"""Kingsrest's capital hall: the grandest building in the game, at the heart of the royal town.

Two takes for Mateo to compare (both front south, +z, ground floor y = 1):
  medieval(): Norman stone below, dark timber above, a tiered drum of pale pillars and lit windows rising
              out of a hipped roof, crowned by a copper dome that weathers from green at the top to bright
              copper at the eaves; long two-storey wings ending in corner towers.
  roman():    the same plan and dome dressed with Roman touches: a columned portico with a pediment and
              broad steps, a smooth stone drum, arcaded wings.
"""
import math
from bp import Blueprint, DIRS, OPP
from kit import Building, VALE, mix, h3
from settle_halls import pyramid, hang
from vale import STYLES

COPPER = ["waxed_oxidized_cut_copper", "waxed_weathered_cut_copper", "waxed_exposed_cut_copper", "waxed_cut_copper"]

def copper_at(frac, x, z, seed=0):
    """Ridge green to eaves orange: frac 1 at the top, 0 at the eave, with a little dithering between bands."""
    f = min(0.999, max(0.0, 1 - frac + (h3(x, 0, z, seed) - 0.5) * 0.08))
    return COPPER[int(f * len(COPPER))]

def ring(r):
    """Cells on a circle of radius r round (0, 0), in order round it."""
    pts = sorted({(round(r * math.cos(a)), round(r * math.sin(a))) for a in [i * math.pi / 180 for i in range(360)]},
                 key=lambda p: math.atan2(p[1], p[0]))
    return pts

def disc(r):
    n = int(r) + 1
    return [(x, z) for x in range(-n, n + 1) for z in range(-n, n + 1) if x * x + z * z <= r * r]

def dome(bp, cx, cz, base, r, rise=1.3, seed=0, finial=True, ribs=False):
    """A copper dome: shell of radius r, stretched up by `rise`, gradient by height, a lantern and rod on top."""
    top = base + int(r * rise)
    for (x, z) in disc(r + 0.5):
        d = math.hypot(x, z)
        h = base + int(round(math.sqrt(max(0.0, (r + 0.5) ** 2 - d * d)) * rise))
        inner = base + int(round(math.sqrt(max(0.0, (r - 0.7) ** 2 - d * d)) * rise)) if d < r - 0.7 else base - 1
        a = math.degrees(math.atan2(z, x)) % 45
        rib = ribs and d > 1.5 and (a < 6 or a > 39)
        for y in range(max(base, inner + 1), h + 1):
            bp.set(cx + x, y, cz + z, "stripped_dark_oak_log" if rib and y == h else copper_at((y - base) / max(1, top - base), x, z, seed), axis="y")
    if finial:
        bp.set(cx, top + 1, cz, "waxed_oxidized_cut_copper")
        for y in range(top + 2, top + 5): bp.set(cx, y, cz, "dark_oak_fence")
        bp.set(cx, top + 5, cz, "lantern"); bp.set(cx, top + 6, cz, "lightning_rod")
    return top

def drum(bp, cx, cz, y0, h, r, pillar, wall, eave, seed=0, lit=True):
    """A round tier: pillars round the ring with windows between, a floor, a band below and an eave above."""
    pts = ring(r)
    for (x, z) in disc(r - 0.5): bp.set(cx + x, y0 - 1, cz + z, "dark_oak_planks")
    for i, (x, z) in enumerate(pts):
        col = i % 3 == 0
        for y in range(y0, y0 + h):
            if col: bp.set(cx + x, y, cz + z, pillar, axis="y")
            elif y == y0 or y == y0 + h - 1: bp.set(cx + x, y, cz + z, wall)
            else: bp.set(cx + x, y, cz + z, "glass")
    for (x, z) in ring(r + 1):   # the eave: upside-down stairs then a ring of stairs stepping out
        a = math.atan2(z, x)
        f = "w" if abs(math.cos(a)) > abs(math.sin(a)) and math.cos(a) > 0 else "e" if abs(math.cos(a)) > abs(math.sin(a)) else "n" if math.sin(a) > 0 else "s"
        bp.set(cx + x, y0 + h, cz + z, eave, facing=f, half="bottom")
        if bp.get(cx + x, y0 - 1, cz + z)[0] in ("keep", "air"): bp.set(cx + x, y0 - 1, cz + z, eave, facing=OPP[f], half="top")
    for (x, z) in disc(r + 0.5):
        if bp.get(cx + x, y0 + h, cz + z)[0] in ("keep", "air"): bp.set(cx + x, y0 + h, cz + z, "dark_oak_planks")

def wing(B, P, rect, ridge, seed, storeys=2, timber=True, arcade=False):
    bp = B.bp
    x0, z0, x1, z1 = rect
    B.foundation(rect, 0); B.floor(rect, 0)
    B.stone_storey(rect, 1, 5)
    if arcade:   # round-arched openings along the front, one bay in three
        for x in range(x0 + 2, x1 - 1, 3):
            for y in (1, 2, 3): bp.set(x, y, z1, "air")
            bp.set(x - 1, 3, z1, "stone_brick_stairs", facing="e", half="top"); bp.set(x + 1, 3, z1, "stone_brick_stairs", facing="w", half="top")
    else:
        for x in range(x0 + 2, x1 - 1, 3):
            for z, side in ((z1, "s"), (z0, "n")): B.window(x, 2, z, side, 1, 2, kind="stone")
    if timber:
        B.floor(rect, 5); B.timber_storey(rect, 5, 5, bay=3); B.bay_windows(rect, 5, "ns")
        top = 10
    else:
        B.floor(rect, 5); B.stone_storey(rect, 6, 4, plinth=False)
        for x in range(x0 + 2, x1 - 1, 3):
            for z, side in ((z1, "s"), (z0, "n")): B.window(x, 7, z, side, 1, 2, kind="stone")
        top = 10
    B.roof(rect, ridge, top, overhang=1, verge=1, pitch=1)
    return top

def corner_tower(bp, P, cx, cz, h, seed):
    B = Building(bp, P, seed)
    r = (cx - 3, cz - 3, cx + 3, cz + 3)
    B.foundation(r, 0); B.floor(r, 0); B.stone_storey(r, 1, h)
    for y in range(3, h, 4):
        for side, (x, z) in (("s", (cx, cz + 3)), ("n", (cx, cz - 3)), ("e", (cx + 3, cz)), ("w", (cx - 3, cz))): B.window(x, y, z, side, 1, 2, kind="stone")
    pyramid(bp, P, cx - 4, cz - 4, cx + 4, cz + 4, h + 1, pitch=2, finial="stone_brick_wall")
    bp.set(cx, h + 12, cz, "lightning_rod")

def gardens(bp, seed):
    """The forecourt: a gravel walk to the door between clipped hedges and flower beds, a low stone wall
    with gate piers along the front, two flowering trees and lanterns on posts."""
    flowers = ["poppy", "cornflower", "oxeye_daisy", "allium", "red_tulip", "azure_bluet", "lily_of_the_valley"]
    for x in range(-33, 34):
        for z in range(10 if abs(x) > 8 else 17, 26):
            if abs(x) <= 2: bp.set(x, 0, z, "gravel" if h3(x, 0, z, seed) < 0.7 else "cobblestone"); continue
            edge = z in (10, 25) or abs(x) == 33
            bed = 12 <= z <= 23 and (abs(x) - 4) % 9 < 6
            if edge and not (z == 25 and abs(x) <= 3):
                bp.set(x, 1, z, "stone_brick_wall" if z == 25 or abs(x) == 33 else "azalea_leaves", persistent=True)
            elif bed:
                hedge = (abs(x) - 4) % 9 in (0, 5) or z in (12, 23)
                if hedge: bp.set(x, 1, z, "azalea_leaves" if h3(x, 1, z, seed) < 0.7 else "azalea_leaves_flowered", persistent=True)
                else:
                    bp.set(x, 0, z, "grass_block")
                    if h3(x, 2, z, seed) < 0.6: bp.set(x, 1, z, flowers[int(h3(x, 3, z, seed) * len(flowers))])
            else: bp.set(x, 0, z, "grass_path" if (z - 10) % 15 == 0 else "grass_block")
    for x in (-4, 4):   # gate piers with lanterns
        for y in (1, 2): bp.set(x, y, 25, "stone_bricks")
        bp.set(x, 3, 25, "lantern")
    for (tx, tz) in ((-20, 18), (20, 18)):   # two flowering trees in the lawns
        for y in range(1, 6): bp.set(tx, y, tz, "oak_log", axis="y")
        for dx in range(-2, 3):
            for dz in range(-2, 3):
                for y in (5, 6, 7):
                    if abs(dx) + abs(dz) + (y == 7) * 2 <= 3 and (dx, dz, y) != (0, 0, 5):
                        bp.set(tx + dx, y, tz + dz, "azalea_leaves_flowered" if h3(dx, y, dz, tx) < 0.5 else "azalea_leaves", persistent=True)
    for x in (-27, -14, 14, 27):
        for y in (1, 2, 3): bp.set(x, y, 24, "dark_oak_fence")
        bp.set(x, 4, 24, "lantern")

def capital(take="medieval", seed=7):
    roman = take == "roman"
    P = {**VALE, **STYLES["stone"]} if roman else dict(VALE)
    if roman: P.update(quoin="smooth_stone", quoin2="stone_bricks")
    bp = Blueprint(f"kingsrest_capital_{take}"); bp.marks = {}
    # ---- the wings and their corner towers
    WB = Building(bp, P, seed)
    for rect in ((-33, -6, -11, 6), (11, -6, 33, 6)): wing(WB, P, rect, "x", seed, timber=not roman, arcade=roman)
    WB.build_roofs()
    for rect in ((-33, -6, -11, 6), (11, -6, 33, 6)): WB.eaves(rect, "x", 10)
    for cx in (-37, 37): corner_tower(bp, P, cx, 0, 16, seed + 1)
    # ---- the centre block, hipped round the drum
    C = (-10, -9, 10, 9)
    CB = Building(bp, P, seed + 2)
    CB.foundation(C, 0); CB.floor(C, 0); CB.stone_storey(C, 1, 6)
    if roman: CB.floor(C, 6); CB.stone_storey(C, 7, 5, plinth=False)
    else: CB.floor(C, 6); CB.timber_storey(C, 7, 5, bay=3); CB.bay_windows(C, 7, "nsew")
    for x in range(-8, 9, 4):
        for z, side in ((9, "s"), (-9, "n")):
            if abs(x) > 2 or side == "n": CB.window(x, 2, z, side, 1, 3, kind="stone")
    if roman:
        for x in range(-8, 9, 4):
            for z, side in ((9, "s"), (-9, "n")): CB.window(x, 8, z, side, 1, 2, kind="stone")
    pyramid(bp, P, -11, -10, 11, 10, 12, pitch=1)
    # ---- the drum in two tiers and the dome
    for (x, z) in disc(8.5):   # clear the roof where the drum stands
        for y in range(12, 24):
            if bp.get(x, y, z)[0] not in ("keep",): bp.set(x, y, z, "air") if y > 12 else None
    pil = "quartz_pillar" if roman else "stripped_birch_log"
    wall = "smooth_stone" if roman else "dark_oak_planks"
    eave = "smooth_stone_slab" if False else ("stone_brick_stairs" if roman else "dark_oak_stairs")
    drum(bp, 0, 0, 13, 7, 7, pil, wall, eave, seed)
    drum(bp, 0, 0, 21, 4, 5.5, pil, wall, eave, seed)
    top = dome(bp, 0, 0, 26, 6, rise=1.25 if roman else 1.45, seed=seed)
    # ---- the front
    if roman:
        # a portico of six columns under a pediment, broad steps up to it
        for x in range(-9, 10):
            for z in range(10, 16): bp.set(x, 1, z, "smooth_stone")
            for z, y in ((16, 0), (17, 0)): bp.set(x, 1, z - 0, "stone_brick_stairs" if z == 16 else "air", facing="n")
            bp.set(x, 1, 16, "stone_brick_stairs", facing="n"); bp.set(x, 0, 17, "stone_brick_stairs", facing="n")
        for x in (-8, -5, -2, 2, 5, 8):
            bp.set(x, 2, 14, "quartz_block")
            for y in range(3, 10): bp.set(x, y, 14, "quartz_pillar", axis="y")
            bp.set(x, 10, 14, "chiseled_quartz_block")
        for x in range(-9, 10):
            for z in range(10, 16): bp.set(x, 11, z, "smooth_stone")
        for i in range(0, 10):   # the pediment: a low triangle of stairs facing the street
            for x in range(-10 + i, 11 - i):
                y = 12 + i // 2
                if abs(x) == 10 - i: bp.set(x, y, 16, "smooth_quartz_stairs", facing="e" if x < 0 else "w")
                else: bp.set(x, y, 16, "smooth_quartz" if i % 2 == 0 else "smooth_quartz", )
        for x in range(-9, 10):
            for z in range(10, 16):
                if bp.get(x, 12, z)[0] == "keep": bp.set(x, 12, z, "smooth_stone_slab", half="bottom")
        bp.set(0, 15, 16, "lantern")
        for x in (-1, 0, 1):
            for y in (1, 2, 3, 4): bp.set(x, y, 9, "air")
        bp.set(0, 1, 9, "spruce_door", facing="n"); bp.set(0, 2, 9, "spruce_door", facing="n", upper=True)
        bp.set(-1, 1, 9, "spruce_door", facing="n", hinge=True); bp.set(-1, 2, 9, "spruce_door", facing="n", upper=True, hinge=True)
    else:
        # an entrance pavilion with a tall timber gable to the square
        F = (-8, 9, 8, 15)
        FB = Building(bp, P, seed + 3)
        FB.foundation(F, 0); FB.floor(F, 0); FB.stone_storey(F, 1, 6)
        FB.floor(F, 6); FB.timber_storey(F, 7, 5, bay=4); FB.bay_windows(F, 7, "sew")
        FB.roof(F, "z", 12, overhang=1, verge=1, pitch=1); FB.build_roofs(); FB.gable_walls(F, "z", 12, style="timber")
        FB.window(-1, 14, 15, "s", 3, 2, kind="timber", shutters=False)   # a big window high in the gable
        for x in (-1, 0, 1):
            for y in range(1, 5): bp.set(x, y, 15, "air")
            for z in range(10, 15):
                for y in range(1, 5): bp.set(x, y, z, "air")
        bp.set(-2, 4, 15, "stone_brick_stairs", facing="e", half="top"); bp.set(2, 4, 15, "stone_brick_stairs", facing="w", half="top")
        bp.set(0, 1, 10, "spruce_door", facing="n"); bp.set(0, 2, 10, "spruce_door", facing="n", upper=True)
        for x in (-5, 5): FB.window(x, 2, 15, "s", 1, 3, kind="stone")
        hang(bp, [(-3, 4, 16), (3, 4, 16)])
        for x in range(-3, 4): bp.set(x, 1, 16, "stone_brick_stairs", facing="n")   # steps
    if not roman: gardens(bp, seed)
    # banners of the crown either side of the door, lamp posts along the front
    for x in (-12, 12):
        for y in range(1, 4): bp.set(x, y, 12, "dark_oak_fence")
        bp.set(x, 4, 12, "lantern")
    bp.markers["door"] = (0, 1, 16)
    return bp

def medieval(seed=7): return capital("medieval", seed)
def roman(seed=7): return capital("roman", seed)
