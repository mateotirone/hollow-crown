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

Each design carries v (2: the first redesign) and clear: the cells the old fill-op look (builder.js before
2026-11-12) stood on that the new one leaves empty, so a world that built the old look is cleared and stamped again.
"""
import argparse, json, math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import export_landmarks as X  # noqa: E402  (the skill's compute)
from landmarks import D  # noqa: E402

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
    for k in range(8):                     # eight channels between the rings, knee deep
        a = math.radians(k * 45 + 22.5)
        for s in range(10, 24):
            if 15.5 <= s <= 16.5: continue
            x, z = round(math.cos(a) * s), round(math.sin(a) * s)
            d.put(x, -1, z, "water"); d.put(x, 0, z, "water")
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


def export(d, old, keep_out=()):
    blocks = X.compute(d.spec())
    for c in d.airs(): blocks[c] = ("air", {})
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
    return {"palette": pal, "rows": runs(cells), "v": 2, "clear": runs(gone, val=True),
            "box": {"x0": min(xs), "x1": max(xs), "y0": min(ys), "y1": max(ys), "z0": min(zs), "z1": max(zs)}}


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--scenes"); ap.add_argument("--no-write", action="store_true"); a = ap.parse_args()
    gate = {(x, y, z) for x in range(-3, 4) for y in range(0, 9) for z in (31, 32)}
    designs = {"COURT_DESIGN": export(court(), old_court(), gate), "SEAT_DESIGN": export(seat(), old_seat())}
    for k, v in designs.items():
        print(k, sum(r[3] for r in v["rows"]), "blocks,", sum(r[3] for r in v["clear"]), "to clear,", v["box"])
    dest = os.path.join(HERE, "..", "..", "Siege_Nights_BP", "scripts", "undertow", "arenas_data.js")
    js = ("// Generated by map/structures/hollow_arenas.py. Do not edit by hand.\n"
          "// The Drowned Court and the Seat: palette [id, logical props], rows [y, z, x0, count, palette index] as offsets\n"
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
