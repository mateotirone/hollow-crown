"""The Hollow's two last fight spaces, drawn to the build standard and exported for undertow/builder.js:

    python3 hollow_arenas.py [--scenes DIR]   -> Siege_Nights_BP/scripts/undertow/arenas_data.js

The Drowned Court (COURT in undertow/layout.js): King Oswin's flooded throne hall, where the Choir holds the floor.
    Origin = COURT.center at COURT.floorY: players walk at y = 0, the floor is y = -1 and -2. +z runs south to the
    sealed wall (COURT.gateZ = z 32), the way in is the north door. Kept for the fight (undertow/choir.js): the
    floor is open and flat to r 26 (the Closing's rings 26/21/16/11, Singers at r 19, the Conductor in the middle),
    knee-deep water channels only, columns stand at r 26 and beyond. The gate cells (x -3..3, y 0..8, z 31..32) are
    never written: the seal and openCourtGate() own them.
The Seat (HEART): the floating ring where Morvane waits. Origin = HEART.center: players stand at y = 0 on the disc
    (r 7, top y = -1) and on the ring (r 11..30). Seven Singer pillars at r 22 on the angles i/7 (as before), the
    throne just south of the middle, Morvane's spot (z + 3.5) left clear. Everything beyond r 7 stays between
    y -8 and y +34, the band dropHeartBand() clears; the disc's root hangs below it and never falls.
The approach (HEART): the way from the cliff at z 2330 to the Seat, see approach(). Origin = HEART.center.

Each design carries v (2: the first redesign) and clear: the cells the old fill-op look (builder.js before
2026-11-12) stood on that the new one leaves empty, so a world that built the old look is cleared and stamped again.
"""
import argparse, json, math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import export_landmarks as X  # noqa: E402  (the skill's compute)
from landmarks import D  # noqa: E402
from engine import spilling_water  # noqa: E402  (the skill: water that would run out of its basin)
import emit, lighting  # noqa: E402  (the skill: connections, the light stage)

VEIN = [("siege:veinstone_bricks", 6), ("siege:cracked_veinstone_bricks", 2), ("polished_blackstone_bricks", 2)]
SEA = [("dark_prismarine", 6), ("prismarine_bricks", 3), ("siege:cracked_veinstone_bricks", 1)]
R, GATE_Z = 32, 32


# ---------------------------------------------------------------- the Drowned Court

def court():
    d = D("drowned_court", "rigid", seed=901)
    # the floor: dark prismarine, veinstone rings at 8, 16 and 24, a rose in the middle, channels of water
    for x in range(-R, R + 1):
        for z in range(-R, R + 1):
            dd = math.hypot(x, z)
            if dd > 32.5 or z > GATE_Z: continue
            d.put(x, -2, z, "dark_prismarine")
            if dd <= 30.5:
                if dd < 1.5: b = "sea_lantern"
                elif dd < 3.5: b = "prismarine_bricks"
                elif dd < 4.5: b = "chiseled_deepslate"
                elif any(r0 <= dd < r0 + 1 for r0 in (8, 16, 24)): b = "siege:veinstone_bricks"
                elif dd > 5 and min(abs((math.degrees(math.atan2(z, x)) - k * 30 + 180) % 360 - 180) for k in range(12)) * math.pi / 180 * dd < 0.6:
                    b = "prismarine_bricks"                                          # twelve spokes
                elif 9 <= dd < 16 and (x + z) % 2 == 0: b = "prismarine"             # a tiled band
                elif 17 <= dd < 24 and (x // 2 + z // 2) % 2 == 0: b = "dark_prismarine"
                else: b = d.pick(x, -1, z, [("dark_prismarine", 14), ("prismarine_bricks", 3), ("siege:cracked_veinstone_bricks", 1)])
                d.put(x, -1, z, b)
    for k in range(8):                     # eight channels between the rings, sunk one row into the floor
        a = math.radians(k * 45 + 22.5)
        for s in range(10, 24):
            if 15.5 <= s <= 16.5: continue
            x, z = round(math.cos(a) * s), round(math.sin(a) * s)
            d.put(x, -1, z, "water")       # never at y 0 too: open on every side there, it ran over the whole floor (v3)
    # the round wall: two thick, coursed, its top broken where the water brought it down
    for x in range(-R - 1, R + 2):
        for z in range(-R - 1, R + 2):
            dd = math.hypot(x, z)
            if not 30.5 < dd <= 32.5 or z > GATE_Z: continue
            top = 17 - int(6 * (d.r(x // 3, 5, z // 3) ** 2.2))
            for y in range(-2, top + 1):
                d.put(x, y, z, "dark_prismarine" if y % 6 == 5 else d.pick(x, y, z, VEIN))
            if dd > 31.5 and top >= 16 and (x + z) % 2 == 0: d.put(x, top + 1, z, "polished_blackstone_wall")
    # sixteen pilasters inside the wall, with lancet niches and soul lanterns between them
    for k in range(16):
        a = k * 22.5
        if abs(a - 270) < 12 or abs(a - 90) < 12: continue          # the north door and the south gate
        c, s = math.cos(math.radians(a)), math.sin(math.radians(a))
        px, pz = round(c * 29.6), round(s * 29.6)
        for y in range(0, 15): d.put(px, y, pz, "prismarine_bricks" if y else "polished_blackstone")
        d.put(px, 15, pz, "chiseled_deepslate")
        a2 = math.radians(a + 11.25)
        nx, nz = round(math.cos(a2) * 31), round(math.sin(a2) * 31)
        if math.hypot(nx, nz) > 30.5 and nz < GATE_Z - 2 and abs(math.degrees(a2) % 360 - 270) > 14:
            for y in range(2, 10): d.air(nx, y, nz)
            d.put(nx, 1, nz, "polished_blackstone_bricks"); d.put(nx, 2, nz, "soul_lantern", hanging=False)
            d.put(nx, 10, nz, "dark_prismarine_slab", half="top")
            for y in range(10, 14):                                  # a drowned banner hanging over it
                bx, bz = round(math.cos(a2) * 30), round(math.sin(a2) * 30)
                if math.hypot(bx, bz) <= 30.5: d.put(bx, y, bz, "cyan_wool" if y > 10 else "light_blue_wool")
    # eight columns at r 26 between the channels' ends, sea light on top
    for k in range(8):
        a = math.radians(k * 45)
        cx, cz = round(math.cos(a) * 27), round(math.sin(a) * 27)
        if cz > 24: continue                                         # not in front of the gate
        for dx, dz in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)):
            d.put(cx + dx, 0, cz + dz, "polished_blackstone_bricks")
            for y in range(1, 12): d.put(cx + dx, y, cz + dz, "prismarine_bricks" if (dx, dz) == (0, 0) else "prismarine")
        for f, (dx, dz) in (("e", (1, 0)), ("w", (-1, 0)), ("s", (0, 1)), ("n", (0, -1))):
            d.put(cx + dx, 12, cz + dz, "dark_prismarine_stairs", facing={"e": "w", "w": "e", "s": "n", "n": "s"}[f], half="top")
        d.put(cx, 12, cz, "dark_prismarine"); d.put(cx, 13, cz, "sea_lantern")
    # Oswin's throne on its dais, the way to the gate round either side of it
    for y, (w, z0) in enumerate(((6, 21), (4, 23), (2, 25))):
        for x in range(-w, w + 1):
            for z in range(z0, 28):
                edge = z == z0
                d.put(x, y, z, "dark_prismarine_stairs" if edge else "prismarine_bricks", facing="s")
    d.put(0, 3, 26, "dark_prismarine_stairs", facing="s")                       # the seat
    for x in (-1, 1): d.put(x, 3, 26, "prismarine_brick_slab", half="bottom")   # its arms
    for x in (-1, 0, 1):
        for y in range(3, 9): d.put(x, y, 27, "dark_prismarine")
    d.put(0, 9, 27, "sea_lantern"); d.put(-1, 9, 27, "dark_prismarine_stairs", facing="e"); d.put(1, 9, 27, "dark_prismarine_stairs", facing="w")
    for x in (-2, 2):
        for y in range(3, 8): d.put(x, y, 27, "polished_blackstone_wall")
        d.put(x, 8, 27, "soul_lantern", hanging=False)
    # the gate's frame on the inside face of the wall (the opening itself is the seal's)
    for y in range(0, 11):
        for x in (-5, -4, 4, 5): d.put(x, y, 30, "polished_blackstone_bricks" if y < 10 else "chiseled_deepslate")
    for x in range(-3, 4): d.put(x, 10, 30, "chiseled_deepslate" if x == 0 else "polished_blackstone_bricks")
    for x in (-3, 3): d.put(x, 9, 30, "polished_blackstone_brick_stairs", facing="e" if x < 0 else "w", half="top")
    # the north door: an arch through the wall between two broken towers, a paved way in
    for x in range(-3, 4):
        for z in range(-34, -29):
            if math.hypot(x, z) > 30.4:
                for y in range(0, 8): d.air(x, y, z)
    for z in (-31, -32):
        for x in (-3, 3): d.put(x, 7, z, "polished_blackstone_brick_stairs", facing="e" if x < 0 else "w", half="top")
        for x in range(-2, 3): d.put(x, 8, z, "chiseled_deepslate" if x == 0 else "polished_blackstone_bricks")
    for tx in (-7, 7):
        for x in range(tx - 2, tx + 3):
            for z in range(-36, -31):
                if max(abs(x - tx), abs(z + 34)) == 2:
                    top = 22 - int(5 * d.r(x, 7, z) ** 1.5)
                    for y in range(-2, top + 1): d.put(x, y, z, d.pick(x, y, z, VEIN, 7))
        d.put(tx, 0, -34, "polished_blackstone_bricks"); d.put(tx, 1, -34, "soul_lantern", hanging=False)
    for x in range(-3, 4):
        for z in range(-42, -32): d.put(x, -1, z, d.pick(x, -1, z, [("polished_blackstone_bricks", 3), ("siege:veinstone_bricks", 2), ("dark_prismarine", 1)], 9))
    court_detail(d)
    # nothing on the gate's cells
    for x in range(-3, 4):
        for y in range(0, 9):
            for z in (31, 32): d.cells.pop((x, y, z), None)
    return d


def court_detail(d):
    """The second pass: gallery, chains and lamps, buttresses, the throne's canopy, drowned things at the walls."""
    def bad(a): return abs(a - 270) < 14 or abs(a - 90) < 14             # the door (north) and the gate (south)
    # a gallery round the hall at y 11 on corbels, with a parapet; a cornice above at y 16
    for x in range(-31, 32):
        for z in range(-31, 32):
            dd = math.hypot(x, z)
            if 28.5 < dd <= 30.5 and z < GATE_Z - 1:
                d.put(x, 11, z, "dark_prismarine_slab", half="top")
                if dd <= 29.3: d.put(x, 12, z, "polished_blackstone_wall")
            if 30.0 < dd <= 30.9 and z < GATE_Z - 1 and d.get(x, 16, z) is None and d.get(x, 15, z): d.put(x, 16, z, "dark_prismarine_slab", half="bottom")
    for k in range(32):
        a = k * 11.25
        c, s_ = math.cos(math.radians(a)), math.sin(math.radians(a))
        x, z = round(c * 29.4), round(s_ * 29.4)
        if z >= GATE_Z - 1: continue
        face = "e" if abs(c) >= abs(s_) and c < 0 else "w" if abs(c) >= abs(s_) else "s" if s_ < 0 else "n"
        d.put(x, 10, z, "dark_prismarine_stairs", facing=face, half="top")      # corbel
        if k % 2 and not bad(a):                                              # a chain and a soul lantern
            hx, hz = round(c * 28.2), round(s_ * 28.2)
            d.put(hx, 10, hz, "iron_chain", axis="y"); d.put(hx, 9, hz, "iron_chain", axis="y"); d.put(hx, 8, hz, "soul_lantern", hanging=True)
    # buttresses outside the wall, stepping down
    for k in range(16):
        a = k * 22.5 + 11.25
        if bad(a): continue
        c, s_ = math.cos(math.radians(a)), math.sin(math.radians(a))
        for step, top in ((33, 13), (34, 9), (35, 5)):
            x, z = round(c * step), round(s_ * step)
            if z > GATE_Z: continue
            for y in range(-2, top + 1): d.put(x, y, z, d.pick(x, y, z, VEIN, 11))
            face = "w" if abs(c) >= abs(s_) and c > 0 else "e" if abs(c) >= abs(s_) else "n" if s_ > 0 else "s"
            d.put(x, top + 1, z, "polished_blackstone_brick_stairs", facing=face)
    # drowned things along the foot of the wall: dead coral, a toppled column, rubble
    for x in range(-30, 31):
        for z in range(-30, 30):
            dd = math.hypot(x, z)
            if 28.6 < dd <= 30.5 and d.get(x, 0, z) is None and not bad(math.degrees(math.atan2(z, x)) % 360):
                t = d.r(x, 21, z)
                if t < 0.18: d.put(x, 0, z, "dead_tube_coral_block" if t < 0.09 else "dead_brain_coral_block")
                elif t < 0.26: d.put(x, 0, z, "dark_prismarine_slab", half="bottom")
                elif t < 0.31: d.put(x, 0, z, "moss_carpet")
    for k, (a0, ln) in enumerate(((140, 6), (320, 5))):                  # two columns fallen against the wall
        for i in range(ln):
            a = math.radians(a0 + i * 2.2)
            d.put(round(math.cos(a) * 28), 0, round(math.sin(a) * 28), "prismarine_bricks")
        a = math.radians(a0 - 3)
        for y in range(0, 3): d.put(round(math.cos(a) * 28), y, round(math.sin(a) * 28), "prismarine_bricks")
    # the throne's canopy, and the drowned banners either side of the gate
    for x in (-3, 3):
        for z in (24, 28):
            for y in range(2 if z == 24 else 3, 10): d.put(x, y, z, "polished_blackstone_wall")
    for x in range(-4, 5):
        for z in range(23, 30):
            edge = x in (-4, 4) or z in (23, 29)
            d.put(x, 10, z, "dark_prismarine_stairs" if edge else "dark_prismarine_slab", half="bottom",
                  facing="e" if x == -4 else "w" if x == 4 else "s" if z == 23 else "n")
    d.put(0, 11, 26, "sea_lantern"); d.put(0, 9, 25, "iron_chain", axis="y"); d.put(0, 8, 25, "soul_lantern", hanging=True)
    for x in (-7, -6, 6, 7):
        for y in range(3, 10): d.put(x, y, 29, "cyan_wool" if y > 3 else "light_blue_wool")
        d.put(x, 10, 29, "polished_blackstone_brick_slab", half="top")
    # six drowned towers rising out of the wall (the Court is seen from far down the valley), and taller door towers
    for a_ in (0, 40, 140, 180, 220, 320):
        c, s_ = math.cos(math.radians(a_)), math.sin(math.radians(a_))
        tx, tz = round(c * 32), round(s_ * 32)
        for x in range(tx - 4, tx + 5):
            for z in range(tz - 4, tz + 5):
                r_ = math.hypot(x - tx, z - tz)
                if r_ > 3.9 or z > GATE_Z: continue
                for y in range(-2, 25):
                    if r_ > 2.9: d.put(x, y, z, "dark_prismarine" if y % 6 == 5 else d.pick(x, y, z, VEIN, 13))
                    elif y >= 0 and math.hypot(x, z) < 31.5: d.air(x, y, z) if y > 0 else None
                if r_ > 2.9 and (x + z) % 2 == 0: d.put(x, 25, z, "polished_blackstone_wall")
                if r_ <= 3.2: d.put(x, 24, z, "dark_prismarine")
        for y, rr in ((25, 2.6), (26, 1.6), (27, 0.6)):          # a pointed cap of deepslate tiles
            for x in range(tx - 3, tx + 4):
                for z in range(tz - 3, tz + 4):
                    if math.hypot(x - tx, z - tz) <= rr: d.put(x, y, z, "deepslate_tiles" if y < 27 else "sea_lantern")
        for y in (6, 13, 20):                                    # slit windows with sea light inside
            wx, wz = round(c * 35.8), round(s_ * 35.8)
            if wz <= GATE_Z: d.put(wx, y, wz, "sea_lantern"); d.put(wx, y + 1, wz, "sea_lantern")
    for tx in (-7, 7):
        for x in range(tx - 2, tx + 3):
            for z in range(-36, -31):
                if max(abs(x - tx), abs(z + 34)) == 2:
                    for y in range(17, 26): d.put(x, y, z, d.pick(x, y, z, VEIN, 7))
                    if (x + z) % 2 == 0: d.put(x, 26, z, "polished_blackstone_wall")
        d.put(tx, 27, -34, "sea_lantern")
    # the north door's portcullis, half up
    for x in range(-2, 3):
        for y in (6, 7): d.put(x, y, -31, "iron_bars")


def old_court():
    """Cells builder.js's first Court stood on (offsets from the same origin), and the cells it dug."""
    cells, r = set(), R
    for dx in range(-r, r + 1):
        for dz in range(-r, r + 1):
            dd = math.hypot(dx, dz)
            if dz > GATE_Z: continue
            if dd <= r - 1:
                cells |= {(dx, -2, dz), (dx, -1, dz)}
                if abs(dx) % 8 == 4 and dd < r - 4: cells.add((dx, 0, dz))
            elif dd <= r + 0.5:
                door = dz < 0 and abs(dx) <= 3
                cells |= {(dx, y, dz) for y in range(-2, 0)}
                cells |= {(dx, y, dz) for y in range(8 if door else 0, 18)}
    for a in range(8):
        px, pz = round(math.cos(a * math.pi / 4) * (r - 7)), round(math.sin(a * math.pi / 4) * (r - 7))
        cells |= {(px, y, pz) for y in range(0, 16)}
    tz = r - 6
    cells |= {(x, y, z) for x in range(-2, 3) for y in (0, 1) for z in range(tz, tz + 3)}
    cells |= {(x, y, tz + 2) for x in range(-1, 2) for y in range(2, 8)}
    return cells


# ---------------------------------------------------------------- the Seat

def seat():
    d = D("the_seat", "rigid", seed=911)
    INNER, SING, OUTER = 7, 22, 30
    for x in range(-OUTER - 1, OUTER + 2):
        for z in range(-OUTER - 1, OUTER + 2):
            dd = math.hypot(x, z)
            if dd <= INNER:
                for y in (-3, -2): d.put(x, y, z, "polished_blackstone_bricks")
                if dd < 2: b = "siege:hollowwood_core"
                elif dd > 6.2: b = "polished_blackstone_bricks"
                else: b = d.pick(x, -1, z, [("siege:veinstone_bricks", 6), ("siege:cracked_veinstone_bricks", 2), ("chiseled_deepslate", 1)])
                d.put(x, -1, z, b)
            elif INNER + 4 <= dd <= OUTER:
                d.put(x, -2, z, "siege:veinstone")
                if dd > OUTER - 1.2: b = "siege:hollowwood_lattice"
                elif 17.5 <= dd < 18.5: b = "polished_blackstone_bricks"
                else: b = d.pick(x, -1, z, VEIN)
                d.put(x, -1, z, b)
                if dd > OUTER - 2.5 and d.r(x, 3, z) < 0.35:              # teeth hanging under the rim
                    for y in range(-3, -3 - int(1 + 4 * d.r(x, 4, z)), -1): d.put(x, y, z, "siege:hollowwood_lattice")
    for k in range(7):                                                 # seven rays of choir ore in the disc
        a = math.radians(k * 360 / 7)
        for s in (3, 4, 5):
            d.put(round(math.cos(a) * s), -1, round(math.sin(a) * s), "siege:choir_ore")
    # the disc's root, hanging into the fog under it (inside r 7, so it never falls)
    for y in range(-4, -16, -1):
        rr = 6.5 * (1 - (-4 - y) / 12) ** 0.8
        for x in range(-7, 8):
            for z in range(-7, 8):
                dd = math.hypot(x, z)
                if dd <= rr and (dd > rr - 1.5 or y == -4): d.put(x, y, z, "siege:veinstone" if d.r(x, y, z) < 0.7 else "siege:hollowwood_lattice")
    # four bridges over the gap, at the corners
    for ux, uz in ((1, 1), (-1, 1), (1, -1), (-1, -1)):
        for s in range(INNER, INNER + 6):
            x, z = round(ux * s * 0.707), round(uz * s * 0.707)
            for ax in (-1, 0, 1):
                for az in (-1, 0, 1): d.put(x + ax, -1, z + az, "polished_blackstone_bricks")
    # the throne, south of the middle, facing the way players come; Morvane's own spot in front of it left clear
    for x in range(-2, 3):
        for z in (4, 5, 6): d.put(x, 0, z, "polished_blackstone_brick_stairs" if z == 4 else "polished_blackstone_bricks", facing="s")
    d.put(0, 1, 5, "polished_blackstone_brick_stairs", facing="s")
    for x in (-1, 1): d.put(x, 1, 5, "polished_blackstone_brick_slab", half="bottom")
    for x in (-1, 0, 1):
        for y in range(1, 7): d.put(x, y, 6, "siege:veinstone_bricks" if x else "polished_blackstone")
    for x in (-2, 2):
        for y in range(1, 6): d.put(x, y, 6, "polished_blackstone_wall")
        d.put(x, 6, 6, "soul_lantern", hanging=False)
    d.put(0, 7, 6, "siege:hollowwood_core"); d.put(-1, 7, 6, "polished_blackstone_wall"); d.put(1, 7, 6, "polished_blackstone_wall")
    d.put(0, 8, 6, "amethyst_cluster")
    # the seven Singer pillars, as before at r 22 on the angles i/7, now with plinths and a crystal crown
    for i in range(7):
        a = i / 7 * 2 * math.pi
        px, pz = round(math.cos(a) * SING), round(math.sin(a) * SING)
        for ax in (-1, 0, 1):
            for az in (-1, 0, 1):
                d.put(px + ax, 0, pz + az, "polished_blackstone_bricks")
                for y in (1, 2): d.put(px + ax, y, pz + az, "polished_basalt" if abs(ax) + abs(az) < 2 else "polished_blackstone_wall", axis="y")
        for y in range(3, 14): d.put(px, y, pz, "siege:hollowwood_lattice")
        for ax, az in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            d.put(px + ax, 3, pz + az, "polished_blackstone_brick_stairs", facing={(1, 0): "w", (-1, 0): "e", (0, 1): "n", (0, -1): "s"}[(ax, az)])
            d.put(px + ax, 13, pz + az, "siege:hollowwood_lattice")
        d.put(px, 14, pz, "amethyst_block"); d.put(px, 15, pz, "siege:hollowwood_core")
    # the landing: a lip on the ring's north edge where the approach (below) comes in
    for x in range(-2, 3):
        d.put(x, -2, -31, "siege:veinstone"); d.put(x, -1, -31, "polished_blackstone_bricks" if abs(x) < 2 else "siege:cracked_veinstone_bricks")
    seat_detail(d)
    return d


def seat_detail(d):
    """The second pass: spokes and bands in the ring, a broken balustrade and spikes at the rim, collars, arms and
    lanterns on the pillars, candles round the disc, spires hanging under the ring, crystal shards in the fog."""
    for x in range(-30, 31):
        for z in range(-30, 31):
            dd = math.hypot(x, z)
            if not 11 <= dd <= 28.6: continue
            a = math.degrees(math.atan2(z, x)) % 360
            if min(abs((a - i * 360 / 7 + 180) % 360 - 180) for i in range(7)) * math.pi / 180 * dd < 0.7: d.put(x, -1, z, "polished_blackstone_bricks")
            elif 11 <= dd < 12 or 25 <= dd < 26: d.put(x, -1, z, "chiseled_deepslate")
    for k in range(72):                                              # rim: a broken balustrade, a lattice spike every 15 degrees
        a = math.radians(k * 5)
        x, z = round(math.cos(a) * 29.6), round(math.sin(a) * 29.6)
        if k % 3 == 0: [d.put(x, y, z, "siege:hollowwood_lattice") for y in range(0, 2 + int(3 * d.r(k, 1, 1)))]
        elif d.r(k, 2, 2) < 0.7: d.put(x, 0, z, "polished_blackstone_wall")
    for i in range(7):                                               # pillar collars, arms and lanterns
        a = i / 7 * 2 * math.pi
        c, s_ = math.cos(a), math.sin(a)
        px, pz = round(c * 22), round(s_ * 22)
        for y in (7, 11):
            for ax, az in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                d.put(px + ax, y, pz + az, "polished_blackstone_brick_stairs", half="top" if y == 11 else "bottom",
                      facing={(1, 0): "w", (-1, 0): "e", (0, 1): "n", (0, -1): "s"}[(ax, az)])
        ix, iz = px - round(c), pz - round(s_)                          # an arm toward the middle, a lantern under it
        ix2, iz2 = px - round(c * 2), pz - round(s_ * 2)
        d.put(ix2, 12, iz2, "polished_blackstone_wall"); d.put(ix2, 11, iz2, "iron_chain", axis="y"); d.put(ix2, 10, iz2, "soul_lantern", hanging=True)
        d.put(ix, 12, iz, "polished_blackstone_wall")
        for y in (-3, -4, -5, -6, -7):                                   # each pillar's own spire under the ring
            rr = 2.2 * (1 - (-3 - y) / 5)
            for ax in range(-2, 3):
                for az in range(-2, 3):
                    if math.hypot(ax, az) <= rr: d.put(px + ax, y, pz + az, "siege:veinstone" if y > -6 else "siege:hollowwood_lattice")
    for k in range(14):                                              # lesser spires between them
        a = (k + 0.5) / 14 * 2 * math.pi
        r0 = 15 if k % 2 else 26
        px, pz = round(math.cos(a) * r0), round(math.sin(a) * r0)
        for y in range(-3, -3 - int(3 + 3 * d.r(k, 5, 5)), -1):
            for ax, az in ((0, 0), (1, 0), (0, 1)) if y > -5 else ((0, 0),):
                d.put(px + ax, y, pz + az, "siege:veinstone" if y > -6 else "siege:hollowwood_lattice")
    for k in range(16):                                              # purple candles round the disc's edge
        a = math.radians(k * 22.5)
        x, z = round(math.cos(a) * 6.4), round(math.sin(a) * 6.4)
        if (x, z) in ((0, 6), (1, 6), (-1, 6)) or abs(x) <= 2 and z >= 4: continue
        d.put(x, 0, z, "purple_candle", bs={"candles": 1 + k % 3, "lit": True})
    # the Hollow Crown itself, as big as the Seat: seven great spikes rising from the rim and leaning in, dark cracked
    # stone with magenta veins of choir ore and a blue gem in each, and seven lesser points behind the Singers
    for i in range(14):
        great = i % 2 == 0
        a = (i / 2 + (0.5 if great else 0)) / 7 * 2 * math.pi
        H, w0 = (32, 3.4) if great else (14, 1.9)
        for y in range(0, H + 1):
            t = y / H
            rc = 28.6 - t * (6 if great else 2)
            w = w0 * (1 - t) ** 0.9
            cx, cz = math.cos(a) * rc, math.sin(a) * rc
            for x in range(math.floor(cx - w - 1), math.ceil(cx + w + 2)):
                for z in range(math.floor(cz - w - 1), math.ceil(cz + w + 2)):
                    if math.hypot(x - cx, z - cz) > max(w, 0.45) or math.hypot(x, z) > 30.5: continue
                    v = d.r(x, y, z)
                    d.put(x, y, z, "siege:choir_ore" if v < 0.07 else "cracked_polished_blackstone_bricks" if v < 0.3 else "polished_blackstone" if v < 0.55 else "blackstone")
        if great:                                                # the gem, on the face toward the middle
            for y in (11, 12):
                rc = 28.6 - y / H * 6 - w0 * (1 - y / H) ** 0.9 + 0.4
                d.put(round(math.cos(a) * rc), y, round(math.sin(a) * rc), "light_blue_stained_glass")
            rc = 28.6 - 6
            d.put(round(math.cos(a) * rc), H + 1, round(math.sin(a) * rc), "end_rod")
    for k in range(12):                                              # crystal shards floating in the fog beyond the rim
        a = math.radians(k * 30 + 9)
        r0 = 34 + 3 * d.r(k, 6, 6); y0 = int(1 + 10 * d.r(k, 7, 7))
        x, z = round(math.cos(a) * r0), round(math.sin(a) * r0)
        d.put(x, y0, z, "amethyst_block"); d.put(x, y0 + 1, z, "amethyst_block" if k % 2 else "budding_amethyst")
        d.put(x, y0 - 1, z, "siege:veinstone"); d.put(x, y0 + 2, z, "amethyst_cluster")


def old_seat():
    cells, I, O = set(), 7, 30
    for dx in range(-O, O + 1):
        for dz in range(-O, O + 1):
            dd = math.hypot(dx, dz)
            if dd <= I: cells |= {(dx, y, dz) for y in (-3, -2, -1)}
            elif I + 4 <= dd <= O: cells |= {(dx, -2, dz), (dx, -1, dz)}
    for ux, uz in ((1, 1), (-1, 1), (1, -1), (-1, -1)):
        for s in range(I, I + 6):
            x, z = round(ux * s * 0.707), round(uz * s * 0.707)
            cells |= {(x + a, -1, z + b) for a in (-1, 0, 1) for b in (-1, 0, 1)}
    for i in range(7):
        a = i / 7 * 2 * math.pi
        px, pz = round(math.cos(a) * 22), round(math.sin(a) * 22)
        cells |= {(px + a2, y, pz + b) for a2 in (-1, 0, 1) for b in (-1, 0, 1) for y in (0, 1, 2)}
        cells |= {(px, y, pz) for y in range(3, 16)}
    return cells


# ---------------------------------------------------------------- the approach to the Seat

EDGE_Z, EDGE_Y = -70, 3      # the story path's spur ends at z 2330 with its top block at y 123 (terrain.js heartEdge)
ROCK = [("siege:veinstone", 58), ("blackstone", 24), ("basalt", 10), ("cobbled_deepslate", 8)]
TOP = [("siege:undertow_moss", 40), ("siege:undertow_moss_deep", 22), ("tuff", 16), ("cobbled_deepslate", 14), ("siege:pale_ash", 8)]
PAVE = [("cobbled_deepslate", 58), ("polished_blackstone_bricks", 24), ("tuff", 12), ("siege:cracked_veinstone_bricks", 6)]
# The way across: the Last Step (a shelf hanging off the cliff), five islands, the Seat's landing. (x, z, radius, depth)
STOPS = [(0, -70, 7.5, 13), (7, -56, 5.5, 15), (15, -46, 3.2, 7), (5, -41, 4.6, 11), (-7, -42, 3.0, 9), (-1, -35, 2.6, 6)]
WAY = [(0, -70), (0, -64), (7, -56), (15, -46), (5, -41), (-7, -42), (-4, -37), (0, -34), (0, -32)]
# Broken rock adrift in the fog, none of it on the way: (x, y of its top, z, radius, depth, what stands on it)
DRIFT = [(-24, 6, -53, 6.4, 17, "veilcap"), (27, -4, -60, 4.2, 11, "pillar"), (-14, -9, -61, 2.4, 6, None), (33, 9, -44, 3.0, 9, "shard"),
         (-38, 1, -63, 3.4, 10, "pillar"), (-33, -12, -44, 4.4, 12, "shard"), (22, -14, -52, 2.2, 5, None), (46, 2, -57, 5.0, 14, "veilcap"),
         (-52, 11, -50, 3.0, 8, None), (58, -7, -64, 2.6, 7, None), (-19, 13, -40, 1.8, 4, None), (38, -11, -39, 2.0, 5, None),
         (-58, -5, -62, 4.0, 11, "shard"), (17, 12, -66, 1.6, 4, None), (-44, 14, -38, 2.2, 6, None), (64, 8, -47, 3.6, 10, "pillar"),
         (-9, -15, -52, 1.6, 4, None), (51, -15, -41, 3.0, 8, None)]


def way_cells():
    """The walk across as floor cells in order: [(x, y, z)], three wide round a centre line, dropping from the
    cliff (y 3) to the Seat's ring (y -1) a block at a time, each drop out on a span between two islands."""
    pts, total = [], 0.0
    for (ax, az), (bx, bz) in zip(WAY, WAY[1:]):
        n = max(1, int(math.hypot(bx - ax, bz - az) * 4))
        for i in range(n): pts.append((ax + (bx - ax) * i / n, az + (bz - az) * i / n))
    pts.append(WAY[-1])
    drops = [0.27, 0.45, 0.63, 0.83]                    # fractions of the way where it steps down
    centre, seen = [], set()
    for i, (x, z) in enumerate(pts):
        c = (round(x), round(z))
        if c in seen: continue
        seen.add(c)
        if centre and abs(c[0] - centre[-1][0]) == 1 and abs(c[1] - centre[-1][2]) == 1:   # no diagonal squeezes
            mid = (c[0], centre[-1][2])
            if mid not in seen: seen.add(mid); centre.append((mid[0], None, mid[1], i / len(pts)))
        centre.append((c[0], None, c[1], i / len(pts)))
    return [(x, EDGE_Y - sum(1 for q in drops if t >= q), z) for x, _, z, t in centre]


def approach():
    """The way to the Seat (Mateo, 2026-11-12: "the most important part of the game... built out correctly and
    thoroughly"). Origin = HEART.center. Nothing here is inside r 32, so none of it falls with the Seat's ring, and
    nothing is north of z -70, where the land ends (terrain.js heartEdge). Walked on foot: no jump is needed."""
    d = D("seat_approach", "rigid", seed=977)
    way = way_cells()
    level = {}                                             # (x, z) -> floor y, three wide
    for x, y, z in way:
        for ax in (-1, 0, 1):
            for az in (-1, 0, 1):
                if math.hypot(x + ax, z + az) >= 32 and z + az >= EDGE_Z: level[(x + ax, z + az)] = min(y, level.get((x + ax, z + az), 99))
    for x, y, z in way: level[(x, z)] = y

    def wob(a, seed):                                      # a smooth wobble round an outline, 0.72 .. 1.22
        return 0.97 + 0.13 * math.sin(a * 2 + seed * 1.7) + 0.08 * math.sin(a * 3 + seed * 4.1) + 0.05 * math.sin(a * 5 + seed * 2.3)

    def rock(cx, top, cz, r, depth, seed, half=False):
        """A floating rock: a ragged plate on top, tapering under it to a point that hangs off centre."""
        tx, tz = cx + (h(seed, 1) - 0.5) * r * 0.9, cz + (h(seed, 2) - 0.5) * r * 0.9
        R = int(r * 1.3) + 2
        for x in range(round(cx) - R, round(cx) + R + 1):
            for z in range(round(cz) - R, round(cz) + R + 1):
                if half and z < EDGE_Z: continue
                dd = math.hypot(x - cx, z - cz); rr = r * wob(math.atan2(z - cz, x - cx), seed)
                if dd > rr or math.hypot(x, z) < 32: continue
                t = min(1.0, math.hypot(x - tx, z - tz) / (r * 1.25))
                low = top - max(1, round(depth * (1 - t) ** 1.35 + d.r(x, seed, z) * 1.6))
                y1 = top - (1 if dd > rr - 1.1 and d.r(x, seed + 3, z) < 0.3 and (x, z) not in level else 0)   # a crumbled rim
                for y in range(low, y1 + 1):
                    d.put(x, y, z, d.pick(x, y, z, TOP if y == y1 else ROCK) if d.r(x, y, z, 7) > 0.025 else "siege:choir_ore")
                under(x, low, z, seed)
        return tx, tz

    def under(x, low, z, seed):
        k = d.r(x, seed + 11, z)
        if k < 0.13:
            for y in range(low - 1, low - 2 - int(d.r(x, seed + 12, z) * 5), -1): d.put(x, y, z, "siege:veilmoss_strands")
        elif k < 0.2:
            for y in range(low - 1, low - 3 - int(d.r(x, seed + 13, z) * 6), -1): d.put(x, y, z, "siege:hollowwood_lattice")
        elif k < 0.23: d.put(x, low - 1, z, "siege:glimbulb")

    def h(seed, k): return d.r(seed * 31 + k, 5, seed * 7)

    def lantern_chain(x, y, z, n):                         # a chain hanging under a rock, soul light at its end
        for i in range(n): d.put(x, y - i, z, "chain", axis="y")
        d.put(x, y - n, z, "soul_lantern", hanging=True)

    def bottom(x, z):
        ys = [c[1] for c in d.cells if c[0] == x and c[2] == z and d.cells[c][0] in dict(ROCK + TOP) | {"siege:choir_ore": 1}]
        return min(ys) if ys else None

    # ---- the rocks of the way, each at the level the walk has there
    tips = []
    for i, (cx, cz, r, depth) in enumerate(STOPS):
        top = level.get((cx, max(cz, EDGE_Z)), EDGE_Y)
        tips.append((rock(cx, top, cz, r, depth, 40 + i, half=(i == 0)), top, depth))
    # ---- broken rock adrift: nothing within 6 of the walk
    for i, (cx, top, cz, r, depth, what) in enumerate(DRIFT):
        assert all(math.hypot(cx - x, cz - z) > r + 6 for x, _, z in way), (cx, cz)
        tx, tz = rock(cx, top, cz, r, depth, 70 + i)
        if what == "veilcap":
            hh = 7 + int(h(i, 3) * 4); rr = 3
            for y in range(top + 1, top + hh + 1): d.put(cx, y, cz, "siege:veilcap_stem")
            for ax in range(-rr - 1, rr + 2):
                for az in range(-rr - 1, rr + 2):
                    q = math.hypot(ax, az)
                    if q <= rr - 0.6: d.put(cx + ax, top + hh + 1, cz + az, "siege:veilcap_cap")
                    if rr - 1.4 < q <= rr + 0.4: d.put(cx + ax, top + hh, cz + az, "siege:veilcap_cap")
                    if rr - 0.6 < q <= rr + 0.4 and d.r(ax, i, az) < 0.3: d.put(cx + ax, top + hh - 1, cz + az, "siege:glimbulb")
        elif what == "pillar":                             # a Singer pillar that broke away with its ground
            hh = 4 + int(h(i, 4) * 5); lean = 1 if h(i, 5) < 0.5 else -1
            for ax in (-1, 0, 1):
                for az in (-1, 0, 1): d.put(cx + ax, top + 1, cz + az, "polished_blackstone_bricks" if (ax or az) else "polished_basalt")
            for y in range(top + 2, top + 2 + hh): d.put(cx + (lean if y > top + 1 + hh // 2 else 0), y, cz, "polished_basalt" if y < top + 4 else "siege:hollowwood_lattice", axis="y")
            d.put(cx + lean, top + 2 + hh, cz, "amethyst_block")
        elif what == "shard":                              # a crystal growth, tall and off true
            hh = 5 + int(h(i, 6) * 5)
            for y in range(top + 1, top + 1 + hh):
                w = 1 if y < top + 1 + hh // 3 else 0
                sx = cx + (1 if y > top + hh // 2 else 0)
                for ax in range(-w, w + 1):
                    for az in range(-w, w + 1):
                        if abs(ax) + abs(az) <= w: d.put(sx + ax, y, cz + az, "budding_amethyst" if d.r(ax, y, az, i) < 0.15 else "amethyst_block")
        b = bottom(round(tx), round(tz))
        if b is not None and r >= 3: lantern_chain(round(tx), b - 1, round(tz), 2 + int(h(i, 8) * 5))

    # ---- the walk: paved three wide over the rocks, root spans between them, a half step at each drop
    onrock = {(x, z) for (x, y, z) in d.cells}
    for (x, z), y in sorted(level.items()):
        col = [c for c in d.cells if c[0] == x and c[2] == z]
        for c in col:
            if c[1] > y and d.cells[c][0] not in ("siege:veilmoss_strands", "siege:hollowwood_lattice", "siege:glimbulb"): del d.cells[c]
        if (x, z) in onrock:
            lo = min((c[1] for c in col), default=y)
            for yy in range(lo, y): d.cells.setdefault((x, yy, z), (d.pick(x, yy, z, ROCK), {}))
            d.put(x, y, z, d.pick(x, y, z, PAVE))
        else:                                              # a span: hollowwood roots grown across, ragged at one edge
            centre = any((x, z) == (wx, wz) for wx, _, wz in way)
            near = min(math.hypot(x - wx, z - wz) for wx, _, wz in way)
            if centre or near <= 1.0 or d.r(x, 21, z) < 0.62:
                d.put(x, y, z, "siege:hollowwood_lattice" if not centre or d.r(x, 22, z) < 0.5 else "dark_oak_planks")
                if d.r(x, 23, z) < 0.22: d.put(x, y - 1, z, "siege:hollowwood_lattice")
                if d.r(x, 24, z) < 0.1:
                    for yy in range(y - 2, y - 3 - int(d.r(x, 25, z) * 4), -1): d.put(x, yy, z, "siege:veilmoss_strands")
    for (x, z), y in level.items():                        # half steps: a slab on the low side of every drop
        if (x, y, z) not in d.cells: continue
        if any(level.get((x + ax, z + az)) == y + 1 and (x + ax, y + 1, z + az) in d.cells for ax, az in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            d.put(x, y + 1, z, "polished_blackstone_brick_slab", half="bottom")

    # ---- the Last Step: a broken gate on the shelf, two pylons that no longer match
    def pylon(px, pz, hh, lean, broken):
        for ax in (-1, 0, 1):
            for az in (-1, 0, 1):
                d.put(px + ax, EDGE_Y + 1, pz + az, "polished_blackstone_bricks")
                for y in range(EDGE_Y, EDGE_Y - 3, -1): d.cells.setdefault((px + ax, y, pz + az), (d.pick(px + ax, y, pz + az, ROCK), {}))
        cut = EDGE_Y + 2 + (hh * 3) // 5
        for y in range(EDGE_Y + 2, EDGE_Y + 2 + hh):
            ox = lean if y >= cut else 0                    # the upper part sits one block off, in one clean step
            for ax in (-1, 0, 1):
                for az in (-1, 0, 1):
                    if abs(ax) + abs(az) == 2:
                        if y % 4 == 1 or (broken and y > EDGE_Y + hh - 1 and d.r(ax, y, az) < 0.6): continue   # notched corners
                        d.put(px + ox + ax, y, pz + az, "polished_blackstone_wall")
                    else: d.put(px + ox + ax, y, pz + az, d.pick(px + ax, y, pz + az, VEIN) if (ax or az) else "siege:hollowwood_core" if y % 5 == 2 else "polished_blackstone")
        t = EDGE_Y + 2 + hh
        if broken:
            for ax, az in ((0, 0), (1, 0), (0, 1)):
                if d.r(ax, t, az) < 0.7: d.put(px + lean + ax, t, pz + az, "siege:cracked_veinstone_bricks")
            for ax, az, b in ((2, 1, "siege:cracked_veinstone_bricks"), (-2, 2, "polished_blackstone_bricks"), (2, 3, "siege:veinstone_bricks")):   # what fell
                if (px + ax, EDGE_Y, pz + az) in d.cells: d.put(px + ax, EDGE_Y + 1, pz + az, b)
        else:
            for ax, az, f in ((1, 0, "w"), (-1, 0, "e"), (0, 1, "n"), (0, -1, "s")): d.put(px + lean + ax, t, pz + az, "polished_blackstone_brick_stairs", facing=f)
            for y in range(t, t + 3): d.put(px + lean, y, pz, "polished_blackstone")
            d.put(px + lean, t + 3, pz, "polished_blackstone_wall"); d.put(px + lean, t + 4, pz, "amethyst_cluster")
            arm = 1 if px < 0 else -1                       # an arm out over the way, a soul lantern on a chain
            for k in (2, 3): d.put(px + lean + arm * k, t - 2, pz, "siege:hollowwood_lattice")
            d.put(px + lean + arm * 3, t - 3, pz, "chain", axis="y"); d.put(px + lean + arm * 3, t - 4, pz, "soul_lantern", hanging=True)
    pylon(-5, -68, 15, 1, False)
    pylon(5, -67, 7, -1, True)

    # ---- light and life on the stops: lantern posts off the walk, never two alike
    for i, (cx, cz, r, depth) in enumerate(STOPS[1:], 1):
        top = level.get((cx, cz), EDGE_Y)
        spots = sorted(((x, z) for (x, y, z) in d.cells if y == top and (x, z) not in level and math.hypot(x - cx, z - cz) <= r - 1
                        and (x, top + 1, z) not in d.cells and all(level.get((x + ax, z + az)) is None or abs(ax) + abs(az) > 0 for ax in (-1, 0, 1) for az in (-1, 0, 1))),
                       key=lambda c: d.r(c[0], 60 + i, c[1]))
        if spots:
            x, z = spots[0]; n = 1 + (i % 3)
            for y in range(top + 1, top + 1 + n): d.put(x, y, z, "cobbled_deepslate_wall")
            d.put(x, top + 1 + n, z, "soul_lantern", hanging=False)
        for x, z in spots[1:1 + int(r)]:
            d.put(x, top + 1, z, d.pick(x, 3, z, [("siege:glint_cluster", 3), ("amethyst_cluster", 2), ("siege:glimbulb", 2)]))
    (tx, tz), top, depth = tips[1]
    b = bottom(round(tx), round(tz))
    if b is not None: lantern_chain(round(tx), b - 1, round(tz), 6)
    (tx, tz), top, depth = tips[3]
    b = bottom(round(tx), round(tz))
    if b is not None: lantern_chain(round(tx), b - 1, round(tz), 3)
    for x, y, z in way:                                    # headroom over the whole walk
        for yy in range(y + 1, y + 4):
            if d.cells.get((x, yy, z), ("",))[0].endswith("_slab") and yy == y + 1: continue
            d.cells.pop((x, yy, z), None)
    d.way = way
    return d


def old_stones():
    """The six stepping stones builder.js used to place (before 2026-11-12), as offsets from HEART.center."""
    cells, start = set(), 124
    for k in range(6):
        z = 2334 + k * 6 - 2400; y = round(start + ((119 - start) * (k + 1)) / 7) - 120; x = round(math.sin(k) * 3)
        cells |= {(x + a, y + b, z + c) for a in (-1, 0, 1) for b in (-1, 0) for c in (-1, 0, 1)}
    return cells


def export(d, old, keep_out=(), v=2):
    spec = dict(d.spec()); spec["light"] = False
    blocks = X.compute(spec)
    for c in d.airs(): blocks[c] = ("air", {})
    # every build lit (Mateo 2026-11-13): soul light, hung overhead or from walls, nothing on the fight floor
    lighting.light(blocks, kind="hollow", posts=False, avoid=list(keep_out)); emit.connect(blocks)
    spill = spilling_water(blocks)
    if spill: raise SystemExit(f"{d.name}: {len(spill)} water block(s) would spill, first at {spill[0]}")
    pal, idx, cells = [], {}, {}
    for c, (n, p) in blocks.items():
        q = {k: v for k, v in p.items() if k in ("facing", "half", "axis", "hanging", "open", "upper", "hinge", "corner", "conn")}
        key = json.dumps([n, q], sort_keys=True)
        if key not in idx: idx[key] = len(pal); pal.append([n if ":" in n else "minecraft:" + n, q])
        cells[c] = idx[key]

    def runs(keys, val=None):
        out = []
        for (y, z, x) in sorted((c[1], c[2], c[0]) for c in keys):
            v = cells[(x, y, z)] if val is None else None
            if out and out[-1][0] == y and out[-1][1] == z and out[-1][2] + out[-1][3] == x and (val is not None or out[-1][4] == v): out[-1][3] += 1
            else: out.append([y, z, x, 1] + ([v] if val is None else []))
        return out

    gone = {c for c in old if c not in cells and c not in keep_out}
    xs = [c[0] for c in cells]; ys = [c[1] for c in cells]; zs = [c[2] for c in cells]
    return {"palette": pal, "rows": runs(cells), "v": v, "clear": runs(gone, val=True),
            "box": {"x0": min(xs), "x1": max(xs), "y0": min(ys), "y1": max(ys), "z0": min(zs), "z1": max(zs)}}


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--scenes"); ap.add_argument("--no-write", action="store_true"); a = ap.parse_args()
    gate = {(x, y, z) for x in range(-3, 4) for y in range(0, 9) for z in (31, 32)}
    ap_d = approach()
    designs = {"COURT_DESIGN": export(court(), old_court(), gate, v=4), "SEAT_DESIGN": export(seat(), old_seat(), v=4),
               "APPROACH_DESIGN": export(ap_d, old_stones(), v=2)}   # v +1 2026-11-13: lit
    designs["APPROACH_DESIGN"]["way"] = [list(c) for c in ap_d.way]
    for k, v in designs.items():
        print(k, sum(r[3] for r in v["rows"]), "blocks,", sum(r[3] for r in v["clear"]), "to clear,", v["box"])
    dest = os.path.join(HERE, "..", "..", "Siege_Nights_BP", "scripts", "undertow", "arenas_data.js")
    js = ("// Generated by map/structures/hollow_arenas.py. Do not edit by hand.\n"
          "// The Drowned Court, the Seat and the approach to it (way = the walk's floor cells in order): palette [id, logical props], rows [y, z, x0, count, palette index] as offsets\n"
          "// from COURT.center at COURT.floorY and from HEART.center; clear = cells the old look stood on that this one leaves empty.\n"
          + "".join(f"export const {k} = " + json.dumps(v, separators=(",", ":")) + ";\n" for k, v in designs.items()))
    if not a.no_write: open(dest, "w").write(js)
    print("wrote" if not a.no_write else "(not written)", os.path.normpath(dest), round(len(js) / 1e3), "KB")
    if a.scenes:
        for k, v in designs.items():
            blocks = [[x, y + 20, z, i] for y, z, x0, n, i in v["rows"] for x in range(x0, x0 + n)]
            pal = [[n.replace("minecraft:", "").replace("siege:veinstone_bricks", "deepslate_bricks").replace("siege:cracked_veinstone_bricks", "cracked_deepslate_bricks")
                    .replace("siege:veinstone", "cobbled_deepslate").replace("siege:hollowwood_lattice", "warped_fence").replace("siege:hollowwood_core", "crying_obsidian")
                    .replace("siege:choir_ore", "amethyst_block"), p] for n, p in v["palette"]]
            sd = os.path.join(a.scenes, k.lower())
            os.makedirs(sd, exist_ok=True)
            json.dump({"palette": pal, "blocks": blocks}, open(os.path.join(sd, "scene.json"), "w"))


if __name__ == "__main__":
    main()
