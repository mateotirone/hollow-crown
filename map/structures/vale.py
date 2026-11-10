"""Aldmere Vale buildings: Norman stone ground floors, dark timber frames, slate roofs."""
import random
from bp import Blueprint, DIRS, OPP, RIGHT
from kit import Building, VALE, mix, grow, h3, side_cells


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
    P = {**VALE, **STYLES[style]}
    B = Building(bp, P, seed)
    main = (0, 0, 22, 8)              # long range, ridge east-west
    wing = (13, 8, 21, 18)            # cross wing, gable to the street
    B.foundation(grow(main, "nsew"), 0); B.foundation(grow(wing, "nsew"), 0)
    # ground floor: stone
    B.stone_storey(main, 1, 4); B.stone_storey(wing, 1, 4)
    for x in range(14, 21): bp.set(x, 1, 8, "air"); bp.set(x, 2, 8, "air"); bp.set(x, 3, 8, "air"); bp.set(x, 4, 8, "air")  # open between range and wing
    B.floor(main, 0); B.floor(wing, 0)
    # carriage arch through the range to the yard behind
    for x in range(3, 7):
        for y in range(1, 5):
            for z in range(0, 9): bp.set(x, y, z, "air")
    for z in (0, 8):
        bp.set(3, 4, z, "stone_brick_stairs", facing="w", half="top"); bp.set(6, 4, z, "stone_brick_stairs", facing="e", half="top")
        bp.set(4, 4, z, "air"); bp.set(5, 4, z, "air")
        bp.set(2, 1, z, "chiseled_stone_bricks"); bp.set(7, 1, z, "chiseled_stone_bricks")
    for z in range(1, 8): bp.set(3, 1, z, "stone_bricks"); bp.set(6, 1, z, "stone_bricks")   # passage walls inside
    for z in range(0, 9):
        for x in (2, 7):
            for y in range(1, 5):
                if bp.get(x, y, z)[0] == "air": bp.set(x, y, z, P["stone"])
    for x in range(3, 7):
        for z in range(0, 9): bp.set(x, 0, z, mix([("cobblestone", 50), ("gravel", 25), ("andesite", 25)], 11)(x, 0, z)[0])
    # upper floor: timber, jettied out over the street and the yard
    up_main = grow(main, "ns"); up_wing = grow(wing, "esw")
    B.floor(up_main, 5); B.floor(up_wing, 5)
    B.timber_storey(up_main, 5, 5, bay=4)
    B.timber_storey(up_wing, 5, 5, bay=3)
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
    for x in (10, 12): B.window(x, 2, 0, "n", 1, 2, kind="stone")
    for x in (0 + 9, 11):
        pass
    for x in (15, 19): B.window(x, 2, 18, "s", 1, 2, kind="stone")
    for x in (9, 11): B.window(x, 2, 8, "s", 1, 2, kind="stone")
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
    B.door(8, 1, 8, "s", double=True)
    bp.set(8, 0, 9, "stone_brick_stairs", facing="n"); bp.set(9, 0, 9, "stone_brick_stairs", facing="n")
    # side door to the yard
    B.door(16, 1, 0, "n")
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
    for x in (1, 2): bp.set(x, 1, 9, "spruce_stairs", facing="n")
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
    # interior: tap room
    for x in range(9, 13): bp.set(x, 1, 3, "barrel")
    for x in range(9, 13): bp.set(x, 2, 3, "spruce_slab", half="bottom")
    for (x, z) in ((15, 3), (18, 3), (15, 13), (18, 13)):
        bp.set(x, 1, z, "spruce_fence"); bp.set(x, 2, z, "spruce_slab", half="bottom") if False else None
        bp.set(x, 1, z, "dark_oak_fence")
    for (x, z) in ((10, 6), (19, 5), (16, 15)): bp.set(x, 4, z, "lantern", hanging=True)
    # path from the street to the doors, shrubs against the plinth, a well and a cart
    for z in range(10, 21):
        for x in (8, 9): bp.set(x, 0, z, P["path"](x, 0, z)[0])
    for (x, z) in ((-1, 9), (0, 10), (13, 19), (21, 19), (22, 18), (12, 12), (-1, -1)):
        bp.set(x, 1, z, "oak_leaves")
        if h3(x, 0, z, 2) < 0.5: bp.set(x, 2, z, "oak_leaves")
    for x in (2, 4, 6):
        if bp.get(x, 1, 10)[0] == "keep": bp.set(x, 1, 10, ["poppy", "azure_bluet", "cornflower"][x % 3])
    # lamp post at the path's street end
    for (x, z) in ((7, 20), (10, 20)):
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
    bp.markers["door"] = (8, 1, 9); bp.markers["innkeeper"] = (10, 1, 4)
    bp.finish()
    return bp


def townhouse(seed, width=7, depth=9, storeys=2, ground="stone", jetty=True, infill=None, roof=None, chimney_side="w", style="tudor"):
    """A gable-fronted town house facing south. Different seeds change materials and details."""
    rnd = random.Random(seed)
    bp = Blueprint(f"vale_house_{seed}")
    P = dict(VALE)
    P["infill"] = infill or rnd.choice([VALE["infill"], mix([("packed_mud", 70), ("mud_bricks", 30)], seed),
                                        mix([("spruce_planks", 80), ("stripped_spruce_log", 20)], seed),
                                        mix([("bricks" if False else "brick_block", 85), ("mud_bricks", 15)], seed)])
    if roof == "wood" or (roof is None and rnd.random() < 0.2):
        P.update(roof="dark_oak_stairs", roof_block="dark_oak_planks", roof_slab="dark_oak_slab",
                 trim="spruce_stairs", trim_block="spruce_planks", trim_slab="spruce_slab")
    P["frame"] = rnd.choice(["dark_oak_log", "dark_oak_log", "spruce_log"])
    if style != "tudor":
        P.update(STYLES[style])
        if style == "stone" and rnd.random() < 0.5: P["infill"] = VALE["infill"]   # some plastered upper floors
        bp.name += "_" + style
    B = Building(bp, P, seed)
    w, d = width - 1, depth - 1
    rect = (0, 0, w, d)
    B.foundation(grow(rect, "nsew"), 0)
    B.floor(rect, 0)
    y = 1
    if ground == "stone":
        B.stone_storey(rect, 1, 4); y = 5
        B.window(w // 2 + 1, 2, d, "s", 1, 2, kind="stone")
        B.door(1, 1, d, "s", canopy=True, lanterns=False)
        bp.set(w - 1, 2, d + 1, "lantern")
    up = grow(rect, "s") if jetty else rect
    for k in range(storeys - (1 if ground == "stone" else 0)):
        B.floor(up, y)
        B.timber_storey(up, y, 5, bay=3 if width <= 7 else 4)
        if jetty and k == 0 and ground == "stone": B.jetty_brackets(up, "s", y - 1)
        # street windows
        B.bay_windows(up, y, "sew")
        if ground != "stone" and k == 0:
            B.door(up[0] + 2, y + 0, up[3] - 1, "s", canopy=False, lanterns=True) if False else None
        y += 5
    B.roof(up, "z", y, overhang=1, verge=1)
    B.build_roofs()
    B.gable_walls(up, "z", y)
    B.window((up[0] + up[2]) // 2, y + 1, up[3] - 1, "s", 1, 2, shutters=False)
    cx = -1 if chimney_side == "w" else w + 1
    B.chimney(cx, d // 2, 1)
    # front step details
    if rnd.random() < 0.6: bp.set(w, 1, d + 1, "barrel")
    if rnd.random() < 0.5: bp.set(w - 1, 1, d + 1, "flower_pot", plant=rnd.choice(["poppy", "dandelion", "cornflower"]))
    bp.finish()
    return bp
