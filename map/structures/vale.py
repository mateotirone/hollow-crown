"""Aldmere Vale buildings: Norman stone ground floors, dark timber frames, slate roofs."""
import random
from bp import Blueprint, DIRS, OPP, RIGHT
from kit import Building, VALE, mix, grow, h3, side_cells, DOCTRINE, finish_doctrine
import furnish as F


STYLES = {
    # A: white plaster and dark timber under slate (the first proof)
    "tudor": {},
    # B: Norman stone throughout, ashlar piers where the timber was, slate roof
    "stone": dict(frame="stone_bricks", infill=VALE["stone"], bracket="stone_brick_stairs",
                  shutter="dark_oak_trapdoor", shutters=0.15, wsill="stone_brick_stairs"),
    # C: warm red brick between pale spruce frames, dark oak shingle roof
    "brick": dict(frame="stripped_spruce_log", infill=mix([("brick_block", 85), ("mud_bricks", 15)], 41),
                  roof="dark_oak_stairs", roof_block="dark_oak_planks", roof_slab="dark_oak_slab",
                  trim="spruce_stairs", trim_block="spruce_planks", trim_slab="spruce_slab", bracket="spruce_stairs",
                  shutter="spruce_trapdoor"),
}


def coaching_inn(seed=1, style="tudor"):
    """Kingsrest's coaching inn: a long stone-and-timber range with a carriage arch,
    a jettied cross wing whose tall gable faces the street, dormers and two chimneys.
    Front (street) faces south (+z). Ground floor at y=1."""
    bp = Blueprint("kingsrest_inn" + ("" if style == "tudor" else "_" + style))
    P = {**VALE, **STYLES[style], **DOCTRINE, "pane": "brown_stained_glass_pane" if style != "stone" else "gray_stained_glass_pane"}
    B = Building(bp, P, seed)
    main = (0, 0, 22, 8)              # long range, ridge east-west
    wing = (13, 8, 21, 18)            # cross wing, gable to the street
    B.foundation(grow(main, "nsew"), 0); B.foundation(grow(wing, "nsew"), 0)
    # ground floor: stone
    B.stone_storey(main, 1, 4); B.stone_storey(wing, 1, 4)
    for x in range(14, 21): bp.set(x, 1, 8, "air"); bp.set(x, 2, 8, "air"); bp.set(x, 3, 8, "air"); bp.set(x, 4, 8, "air")  # open between range and wing
    B.floor(main, 0); B.floor(wing, 0)
    # carriage arch through the range to the yard behind
    for x in range(3, 6):
        for y in range(1, 5):
            for z in range(0, 9): bp.set(x, y, z, "air")
    for z in (0, 8):
        bp.set(3, 4, z, "stone_brick_stairs", facing="w", half="top"); bp.set(5, 4, z, "stone_brick_stairs", facing="e", half="top")
        bp.set(4, 4, z, "air")
        bp.set(2, 1, z, "chiseled_stone_bricks"); bp.set(6, 1, z, "chiseled_stone_bricks")
    for z in range(0, 9):
        for x in (2, 6):
            for y in range(1, 5):
                if bp.get(x, y, z)[0] == "air": bp.set(x, y, z, P["stone"])
    for x in range(3, 6):
        for z in range(0, 9): bp.set(x, 0, z, mix([("cobblestone", 50), ("gravel", 25), ("andesite", 25)], 11)(x, 0, z)[0])
    # upper floor: timber, jettied out over the street and the yard
    up_main = grow(main, "ns"); up_wing = grow(wing, "esw")
    B.floor(up_main, 5); B.floor(up_wing, 5)
    B.timber_storey(up_main, 5, 5, bay=4)
    B.timber_storey(up_wing, 5, 5, bay=4)
    for x in range(14, 21):
        for y in range(5, 10): bp.set(x, y, 9, "air"); bp.set(x, y, 8, "air"); bp.set(x, y, 10, "air")
    for x in range(14, 21):
        for z in range(8, 11): bp.set(x, 5, z, P["floor"])
    B.jetty_brackets(up_main, "ns", 4); B.jetty_brackets(up_wing, "esw", 4)
    # second jetty in the wing gable: the attic floor steps out again over the street
    gable_wing = grow(up_wing, "s")
    # roofs
    B.roof(up_main, "x", 10, overhang=1, verge=1)
    B.roof(gable_wing, "z", 10, overhang=1, verge=1)
    # dormers on the street slope of the range
    for dx in (0,):
        B.roof((dx, 3, dx + 6, 9), "z", 10, overhang=0, verge=1)
    B.build_roofs()
    B.gable_walls(up_main, "x", 10)
    B.gable_walls(gable_wing, "z", 10)
    # wing attic jetty: front frame line at z = 20 one storey up
    for x in range(gable_wing[0], gable_wing[2] + 1):
        bp.set(x, 10, gable_wing[3], P["frame"], axis="x")
        if x in (gable_wing[0], gable_wing[2]) or (x - gable_wing[0]) % 3 == 0:
            bp.set(x, 9, gable_wing[3], P["bracket"], facing="n", half="top")
    for x in range(gable_wing[0] + 1, gable_wing[2]):
        for y in range(5, 9):
            if bp.get(x, y, gable_wing[3])[0] in ("keep",): pass
    # dormer fronts
    for dx in (0,):
        for x in range(dx + 1, dx + 6):
            for y in range(10, B.H[(x, 9)][0]):
                if bp.get(x, y, 9)[0] in ("keep", "air"): bp.set(x, y, 9, P["infill"])
        bp.set(dx + 3, 10, 9, P["frame"], axis="y"); bp.set(dx + 3, 11, 9, P["frame"], axis="y")
        for x in (dx + 2, dx + 4): bp.set(x, 10, 9, P["pane"]); bp.set(x, 11, 9, P["pane"])
        for x in range(dx + 1, dx + 6):
            for z in range(4, 9):
                for y in range(10, B.H[(x, z)][0]):
                    if bp.get(x, y, z)[0] in ("keep",) : bp.set(x, y, z, "air")
    # windows, ground floor (stone): street side of range and wing
    for x in (8, 10): B.window(x, 2, 0, "n", 1, 2, kind="stone")
    for x in (0 + 9, 11):
        pass
    for x in (15, 19): B.window(x, 2, 18, "s", 1, 2, kind="stone")
    for x in (7, 11): B.window(x, 2, 8, "s", 1, 2, kind="stone")
    for z in (11, 15): B.window(21, 2, z, "e", 1, 2, kind="stone"); B.window(13, 2, z, "w", 1, 2, kind="stone")
    for z in (3, 5): B.window(0, 2, z, "w", 1, 2, kind="stone"); B.window(22, 2, z, "e", 1, 2, kind="stone")
    # windows, upper floor (timber): centred in the bays, pane one block behind the face
    B.bay_windows(up_main, 5, "n")
    B.bay_windows(up_main, 5, "s", skip=(3, 4))
    B.bay_windows(up_main, 5, "w")
    B.bay_windows(up_wing, 5, "sew")
    # attic gable window and lantern bracket
    B.window(17, 11, 19, "s", 1, 2, shutters=False)
    # front door: double door on the range's street side
    P["jamb"] = "chiseled_stone_bricks"; P["lintel"] = "stone_bricks"
    B.door(9, 1, 8, "s", canopy=False)
    # side door to the yard
    B.door(13, 1, 0, "n", canopy=True)
    # chimneys
    B.chimney(-1, 3, 1, w=1, d=2)
    for y in range(1, 3): bp.set(-1, y, 2, P["chimney"]); bp.set(-1, y, 5, P["chimney"])
    B.chimney(17, 13, 1)
    # inn sign: a fence arm with a hanging lantern off the wing corner
    bp.set(12, 4, 19, P["fence"]); bp.set(11, 4, 19, P["fence"]); bp.set(11, 3, 19, "lantern", hanging=True)
    # details: barrels, hay and a bench out front
    for (x, z, n) in ((11, 9, "barrel"), (12, 9, "barrel"), (11, 10, "barrel"), (22, 10, "hay_block"), (22, 11, "hay_block")):
        bp.set(x, 1, z, n)
    bp.set(12, 2, 9, "lantern")
    bp.set(0, 1, 9, "spruce_stairs", facing="n"); bp.set(1, 1, 9, "spruce_stairs", facing="n")
    # flower boxes on the upper street windows of the range
    for x0 in (2, 10):
        B.flower_box(x0, 5, 9 + 1, "s", 2, seed=x0) if False else None
    # yard behind: fence and a cart shed lean-to
    for x in range(-1, 23):
        if bp.get(x, 1, -6)[0] == "keep": bp.set(x, 1, -6, P["fence"])
    for z in range(-6, 0):
        bp.set(-1, 1, z, P["fence"]); bp.set(23, 1, z, P["fence"])
    bp.set(4, 1, -6, "spruce_fence_gate"); bp.set(5, 1, -6, "spruce_fence_gate")
    for x in range(-1, 23):
        for z in range(-6, 0):
            if bp.get(x, 0, z)[0] == "keep": bp.set(x, 0, z, P["path"](x, 0, z)[0])
    inn_interior(bp)
    # path from the street to the doors, shrubs against the plinth, a well and a cart
    for z in range(9, 21):
        for x in (8, 9, 10): bp.set(x, 0, z, P["path"](x, 0, z)[0])
    for (x, z) in ((-1, 9), (0, 10), (13, 19), (21, 19), (22, 18), (12, 12), (-1, -1)):
        bp.set(x, 1, z, "oak_leaves")
        if h3(x, 0, z, 2) < 0.5: bp.set(x, 2, z, "oak_leaves")
    for x in (3, 5, 13 - 1):
        if bp.get(x, 1, 10)[0] == "keep": bp.set(x, 1, 10, ["poppy", "azure_bluet", "cornflower"][x % 3])
    # lamp post at the path's street end
    for (x, z) in ((7, 20), (11, 20)):
        bp.set(x, 1, z, "stone_brick_wall"); bp.set(x, 2, z, P["fence"]); bp.set(x, 3, z, P["fence"]); bp.set(x, 4, z, "lantern")
    # well in the yard
    wx, wz = 10, -3
    for dx in (-1, 0, 1):
        for dz in (-1, 0, 1):
            bp.set(wx + dx, 1, wz + dz, "stone_bricks" if (dx or dz) else "water")
            bp.set(wx + dx, 0, wz + dz, "stone_bricks" if (dx or dz) else "water")
    for dx, dz in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
        bp.set(wx + dx, 2, wz + dz, P["fence"]); bp.set(wx + dx, 3, wz + dz, P["fence"])
    for dx in (-1, 0, 1):
        bp.set(wx + dx, 4, wz - 1, P["trim"], facing="s"); bp.set(wx + dx, 4, wz + 1, P["trim"], facing="n"); bp.set(wx + dx, 4, wz, P["trim_slab"], half="bottom")
    bp.set(wx, 3, wz, "lantern", hanging=True) if False else None
    # hay cart by the arch
    for (x, z) in ((1, -3), (2, -3), (1, -2), (2, -2)): bp.set(x, 1, z, "spruce_slab", half="top")
    bp.set(1, 2, -3, "hay_block"); bp.set(2, 2, -2, "hay_block"); bp.set(0, 1, -3, "spruce_trapdoor", facing="e", open=True)
    bp.markers["door"] = (9, 1, 9); bp.markers["innkeeper"] = (10, 1, 4)
    finish_doctrine(bp)
    return bp


def inn_interior(bp):
    """Tap room and kitchen downstairs, four bedrooms and the innkeeper's hall upstairs."""
    # store room in the strip west of the arch
    for z in (1, 3, 5, 7): bp.set(1, 1, z, "barrel"); bp.set(1, 2, z, "barrel") if z % 4 == 1 else None
    # tap room: bar facing the front door, kegs behind it, a hearth by the wing chimney
    F.bar(bp, 8, 12, 1, 4, "s")
    for (x, z) in ((19, 3), (15, 6)): F.table(bp, x, 1, z, chairs="ew")
    F.hearth(bp, 17, 1, 14, "s")
    for (x, z) in ((15, 10), (19, 10), (15, 16), (19, 16)): F.table(bp, x, 1, z, chairs="ns" if z == 16 else "ew")
    bp.set(14, 1, 17, "barrel"); bp.set(20, 1, 17, "barrel"); bp.set(20, 2, 17, "barrel")
    for x in range(8, 13): bp.set(x, 0, 6, "red_carpet") if False else None
    for (x, z) in ((10, 6), (16, 3), (20, 5), (15, 12), (19, 13), (17, 17)): F.lantern_ceiling(bp, x, 4, z)
    # stairs up along the back wall, rail around the stairwell upstairs
    F.stair_flight(bp, 17, 1, 1, 5, "e")
    for x in range(17, 21): bp.set(x, 6, 2, "spruce_fence")
    bp.set(16, 6, 1, "spruce_fence")
    # upstairs: corridor along the back, bedrooms along the street side
    F.partition(bp, 1, 4, 16, 4, 6, 9)
    for x in (6, 11, 16): F.partition(bp, x, 5, x, 8, 6, 9)
    for i, (x0, x1) in enumerate(((1, 5), (7, 10), (12, 15))):
        dx = (x0 + x1) // 2
        bp.set(dx, 6, 4, "spruce_door", facing="s"); bp.set(dx, 7, 4, "spruce_door", facing="s", upper=True)
        F.bed(bp, x0, 6, 8, "s") if True else None
        bp.set(x1, 6, 8, "barrel"); bp.set(x1, 6, 5, "flower_pot", plant=["poppy", "cornflower", "dandelion"][i]) if False else None
        bp.set(x0, 6, 5, "bookshelf") if i == 1 else bp.set(x0, 6, 5, "barrel")
        for x in range(x0 + 1, x1): bp.set(x, 6, 6, "red_carpet") if free(bp, x, 6, 6) else None
        F.lantern_ceiling(bp, dx, 9, 6)
    for x in (4, 9, 14): F.lantern_ceiling(bp, x, 9, 2)
    # the innkeeper's hall in the wing: long table, shelves, lectern
    F.long_table(bp, 15, 19, 6, 14)
    for z in (10, 11, 12, 16, 17): bp.set(13, 6, z, "bookshelf"); bp.set(13, 7, z, "bookshelf")
    bp.set(21, 6, 17, "lectern", facing="w"); bp.set(21, 6, 11, "chest", facing="w")
    for z in (11, 16): F.lantern_ceiling(bp, 17, 9, z)


def free(bp, x, y, z): return bp.get(x, y, z)[0] in ("air", "keep")


def house_interior(bp, w, d, levels, front_d, furnished=False):
    """A stair up the east side to every floor. Rooms are left empty for players to fill
    (Mateo, 2026-11-11); furnished=True adds a hearth, table and bedrooms for show builds."""
    sx = w - 1
    for k in range(len(levels) - 2):          # the last level is the roof base: no stair up into the roof
        L0, L1 = levels[k], levels[k + 1]
        F.stair_flight(bp, sx, d - 2, L0 + 1, L1 - L0, "n")
    if not furnished: return
    L = levels[0]
    F.hearth(bp, w // 2, L + 1, 1, "s")
    F.table(bp, w // 2 - 1 if w > 5 else 1, L + 1, d // 2 + 1, chairs="ew" if w > 5 else "s")
    bp.set(1, L + 1, 1, "barrel"); bp.set(1, L + 2, 1, "barrel"); bp.set(1, L + 1, d - 1, "crafting_table")
    F.lantern_ceiling(bp, w // 2, levels[1] - 1, d // 2)
    for k, Lk in enumerate(levels[1:-1] if len(levels) > 2 else levels[1:]):
        F.bed(bp, 1, Lk + 1, 1, "n")
        bp.set(1, Lk + 1, 3, "barrel"); bp.set(1, Lk + 1, front_d - 1, "bookshelf" if k % 2 else "chest", facing="e")
        for x in range(2, sx):
            if free(bp, x, Lk + 1, 3): bp.set(x, Lk + 1, 3, "white_carpet" if k % 2 else "red_carpet")
        F.lantern_ceiling(bp, w // 2, Lk + 4, d // 2)


def townhouse(seed, width=7, depth=9, storeys=2, ground="stone", jetty=True, infill=None, roof=None, chimney_side="w", style="tudor"):
    """A gable-fronted town house facing south. Different seeds change materials and details."""
    rnd = random.Random(seed)
    bp = Blueprint(f"vale_house_{seed}")
    P = dict(VALE)
    P["infill"] = infill or VALE["infill"]         # plaster; plank and brick looks belong to the brick style
    if roof == "wood" or (roof is None and rnd.random() < 0.2):
        P.update(roof="dark_oak_stairs", roof_block="dark_oak_planks", roof_slab="dark_oak_slab",
                 trim="spruce_stairs", trim_block="spruce_planks", trim_slab="spruce_slab")
    P["frame"] = rnd.choice(["dark_oak_log", "dark_oak_log", "spruce_log"])
    if style != "tudor":
        P.update(STYLES[style])
        if style == "stone" and rnd.random() < 0.5: P["infill"] = VALE["infill"]   # some plastered upper floors
        bp.name += "_" + style
    P.update(DOCTRINE)
    P["pane"] = "gray_stained_glass_pane" if style == "stone" else "brown_stained_glass_pane" if style == "brick" or rnd.random() < 0.6 else "light_gray_stained_glass_pane"
    B = Building(bp, P, seed)
    w, d = width - 1, depth - 1
    rect = (0, 0, w, d)
    B.foundation(grow(rect, "nsew"), 0)
    B.floor(rect, 0)
    y = 1
    levels = [0]
    if ground == "stone":
        B.stone_storey(rect, 1, 4); y = 5
        for wx in (w // 2 - 2, w // 2 + 2):
            if 0 < wx < w: B.window(wx, 2, d, "s", 1, 2, kind="stone")     # never on a corner
        P["jamb"] = "stone_bricks"; P["lintel"] = "stone_bricks"
        B.door(w // 2, 1, d, "s", canopy=not jetty, lanterns=True)
    up = grow(rect, "s") if jetty else rect
    for k in range(storeys - (1 if ground == "stone" else 0)):
        B.floor(up, y); levels.append(y) if y != 1 else None
        B.timber_storey(up, y, 5, bay=3 if width <= 7 else 4)
        if jetty and k == 0 and ground == "stone": B.jetty_brackets(up, "s", y - 1)
        # street windows
        if ground != "stone" and k == 0:
            B.bay_windows(up, y, "ew")                       # the street side gets the door and two flanking windows
            dx_ = (up[0] + up[2]) // 2
            for wx in (dx_ - 2, dx_ + 2):
                if up[0] < wx < up[2]: B.window(wx, y + 1, up[3] - 1, "s", 1, 2, shutters=False)
            B.door(dx_, y + 1 if y == 1 else y, up[3], "s", canopy=True, lanterns=True)
        else:
            B.bay_windows(up, y, "sew")
        y += 5
    levels.append(y)
    B.roof(up, "z", y, overhang=1, verge=1, pitch=P.get("pitch", 1))
    B.build_roofs()
    B.gable_walls(up, "z", y)
    B.window((up[0] + up[2]) // 2, y + 1, up[3] - 1, "s", 1, 2 if width > 5 else 1, shutters=False)   # a narrow gable only has room for one pane
    house_interior(bp, w, d, levels if ground == "stone" else [1] + levels[1:], up[3])
    cx = -1 if chimney_side == "w" else w + 1
    B.chimney(cx, d // 2, 1)
    # front step details
    if rnd.random() < 0.6: bp.set(w, 1, d + 1 + (1 if jetty else 0), "barrel")
    if rnd.random() < 0.5: bp.set(0, 1, d + 1 + (1 if jetty else 0), "flower_pot", plant=rnd.choice(["poppy", "dandelion", "cornflower"]))
    finish_doctrine(bp)
    return bp
