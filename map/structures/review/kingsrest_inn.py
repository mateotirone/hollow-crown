"""Kingsrest coaching inn, built stage by stage from build-instructions/ (review round 2, 2026-11-12).

Plan: review/kingsrest_inn_plan.md. A long range (27 x 11) with a carriage arch through it to the yard behind,
and a cross wing (9 wide) standing forward to the street with its tall gable and the inn door. Stone ground
storey, jettied timber upper storey, attic in the roof with dormers, a chimney on each gable end. The inn is
the one standard build with a furnished interior (08-interiors).
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT); sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(ROOT, "..", "..", "build-instructions", "texturing"))
from bp import Blueprint
from kit import Building, VALE, DOCTRINE, mix, h3, texture_roofs
from doctrine import paint_teeth, family
import furnish as F

# ------------------------------------------------------------------ plan numbers
RX0, RX1, RZ0, RZ1 = 0, 26, 0, 10        # range, ground storey
UZ0, UZ1 = -1, 11                        # range upper storey jettied front and back
WX0, WX1, WZ1, WUZ1 = 15, 23, 18, 19     # wing x 15..23, ground to z 18, upper jettied to z 19
ARCH = (5, 9)                            # carriage arch through the range
YF, Y_UP, Y_PLATE = 2, 7, 12
WING_C = 19
DORMERS = (2, 12)                        # dormer centre lines on the range's street slope
BACK_DORMERS = (7, 13, 19)               # and on the back slope, over the back windows (breaks the long roof)

P = dict(VALE); P.update(DOCTRINE)
P.update(frame="stripped_spruce_log", infill="calcite", pane="brown_stained_glass_pane",
         floor_field="spruce_slab", floor_border="dark_oak_slab",
         trim="dark_oak_stairs", trim_block="dark_oak_planks", trim_slab="dark_oak_slab", bracket="dark_oak_stairs",
         door="spruce_door", fence="spruce_fence", spikes=5, finial="spruce_fence", finial_top="lightning_rod", spike="spruce_fence",
         roof="brick_stairs", roof_block="brick_block", roof_slab="brick_slab", roof_ladder=None, verge_lanterns=False)
LEAVES = mix([("azalea_leaves", 70), ("azalea_leaves_flowered", 30)], 12)
SIGN = "spruce_wall_sign"; PANEL = "dark_oak_trapdoor"
STONE = family("VAL-01")["blocks"]
OUT = {"s": (0, 1), "n": (0, -1), "e": (1, 0), "w": (-1, 0)}
BACK = {"s": "n", "n": "s", "e": "w", "w": "e"}

def log(bp, x, y, z, axis="y"): bp.set(x, y, z, P["frame"], axis=axis)
def keep(bp, x, y, z): return bp.get(x, y, z)[0] in ("keep", "air")

# ground walls, left to right seen from outside, with what each cell is (plan section 3)
def ground_faces():
    F_ = {}
    F_["n"] = ([(x, RZ0) for x in range(RX1, RX0 - 1, -1)], {2: "win", 13: "win", 19: "win", 24: "win"})
    F_["s_w"] = ([(x, RZ1) for x in range(RX0, WX0)], {2: "win", 12: "win", 1: "panel", 3: "panel", 11: "panel", 13: "panel"})
    F_["s_e"] = ([(x, RZ1) for x in range(WX1 + 1, RX1 + 1)], {25: "win", 24: "panel"})
    F_["w"] = ([(RX0, z) for z in range(RZ0, RZ1 + 1)], {2: "win", 8: "win"})
    F_["e"] = ([(RX1, z) for z in range(RZ1, RZ0 - 1, -1)], {2: "win", 8: "win"})
    F_["ww"] = ([(WX0, z) for z in range(RZ1 + 1, WZ1 + 1)], {12: "win", 16: "win"})
    F_["we"] = ([(WX1, z) for z in range(WZ1, RZ1, -1)], {12: "win", 16: "win"})
    F_["ws"] = ([(x, WZ1) for x in range(WX0, WX1 + 1)], {16: "win", 22: "win", 19: "door", 18: "pier", 20: "pier", 17: "panel", 21: "panel"})
    return F_
FACE_OUT = {"n": "n", "s_w": "s", "s_e": "s", "w": "w", "e": "e", "ww": "w", "we": "e", "ws": "s"}

# ------------------------------------------------------------------ stage 1: foundation
def foundation(bp, B):
    bp.fill(RX0, -3, RZ0, RX1, 0, RZ1, P["found"]); bp.fill(WX0, -3, RZ1 + 1, WX1, 0, WZ1, P["found"])
    for x in range(RX0 + 1, RX1):
        for z in range(RZ0 + 1, RZ1): bp.set(x, 1, z, P["found"])
    for x in range(WX0 + 1, WX1):
        for z in range(RZ1, WZ1): bp.set(x, 1, z, P["found"])
    for x in range(ARCH[0], ARCH[1] + 1):                          # the cart way through the arch, at ground level
        for z in range(RZ0 - 1, RZ1 + 2): bp.set(x, 0, z, mix([("cobblestone", 45), ("gravel", 30), ("andesite", 25)], 11)(x, 0, z)[0])
    for x in (WING_C - 1, WING_C, WING_C + 1): bp.set(x, 1, WZ1 + 1, "stone_brick_stairs", facing="n")   # one step at the inn door
    for z in (4, 5, 6):                                            # chimney breast footings on both gable ends
        for x in (RX0 - 1, RX1 + 1): bp.fill(x, -3, z, x, 0, z, P["found"])

# ------------------------------------------------------------------ stage 2: frame
def frame(bp, B):
    for name, (cells, roles) in ground_faces().items():
        grid = paint_teeth(len(cells), 6, STONE, seed=sum(map(ord, name)))
        for i, (x, z) in enumerate(cells):
            for row, y in enumerate(range(1, 7)): bp.set(x, y, z, grid[row][i])
    for x, z in ((RX0, RZ0), (RX1, RZ0), (RX0, RZ1), (RX1, RZ1), (WX0, WZ1), (WX1, WZ1)):
        for y in range(2, 7, 2): bp.set(x, y, z, P["quoin"])
    for x in (ARCH[0] - 1, ARCH[1] + 1):                           # arch piers, dressed
        for z in (RZ0, RZ1):
            for y in range(1, 6): bp.set(x, y, z, P["quoin"])
    for x in (WING_C - 1, WING_C + 1):                             # door piers
        for y in range(2, 6): bp.set(x, y, WZ1, P["quoin"])
    # the carriage arch: open 1..5, the curve in the top row (stair, slab, open, slab, stair) the whole way through
    a0, a1 = ARCH
    for z in range(RZ0, RZ1 + 1):
        for x in range(a0, a1 + 1):
            for y in range(1, 6): bp.set(x, y, z, "air")
        bp.set(a0, 5, z, "stone_brick_stairs", facing="w", half="top"); bp.set(a1, 5, z, "stone_brick_stairs", facing="e", half="top")
        bp.set(a0 + 1, 5, z, "stone_brick_slab", half="top"); bp.set(a1 - 1, 5, z, "stone_brick_slab", half="top")
        for x in range(a0, a1 + 1): bp.set(x, 6, z, "spruce_planks" if z % 2 else P["frame"], **({} if z % 2 else {"axis": "x"}))
    for z in range(RZ0 + 1, RZ1):                                  # passage walls
        for x in (a0 - 1, a1 + 1):
            for y in range(1, 7):
                if keep(bp, x, y, z): bp.set(x, y, z, STONE[1 + (y > 3)])
    # floor band at y 7 round the upper storey, jetty supports under it
    def band(x, z, axis): log(bp, x, Y_UP, z, axis)
    for x in range(RX0, RX1 + 1): band(x, UZ0, "x")
    for x in list(range(RX0, WX0)) + list(range(WX1 + 1, RX1 + 1)): band(x, UZ1, "x")
    for z in range(UZ0, UZ1 + 1): band(RX0, z, "z"); band(RX1, z, "z")
    for z in range(RZ1 + 1, WUZ1 + 1): band(WX0, z, "z"); band(WX1, z, "z")
    for x in range(WX0, WX1 + 1): band(x, WUZ1, "x")
    def supports(xs, z, out, posts):
        for x in xs:
            d = min(abs(x - p) for p in posts)
            if d == 0: bp.set(x, Y_UP - 1, z, P["bracket"], facing=BACK[out], half="top")
            elif d == 1: bp.set(x, Y_UP - 1, z, "spruce_slab", half="top")
            else: bp.set(x, Y_UP - 1, z, "spruce_trapdoor", facing=out, half="top")
    supports(range(RX0, RX1 + 1), UZ0, "n", NORTH_U)
    supports(range(RX0, WX0), UZ1, "s", SOUTH_W_U); supports(range(WX1 + 1, RX1 + 1), UZ1, "s", SOUTH_E_U)
    supports(range(WX0, WX1 + 1), WUZ1, "s", WING_S_U)
    # upper posts by the bay patterns, the wall plate on top
    for y in range(Y_UP + 1, Y_PLATE):
        for x in NORTH_U: log(bp, x, y, UZ0)
        for x in SOUTH_W_U + SOUTH_E_U: log(bp, x, y, UZ1)
        for z in SIDE_U: log(bp, RX0, y, z); log(bp, RX1, y, z)
        for z in WING_SIDE_U: log(bp, WX0, y, z); log(bp, WX1, y, z)
        for x in WING_S_U: log(bp, x, y, WUZ1)
    for x in range(RX0, RX1 + 1): log(bp, x, Y_PLATE, UZ0, "x")
    for x in list(range(RX0, WX0)) + list(range(WX1 + 1, RX1 + 1)): log(bp, x, Y_PLATE, UZ1, "x")
    for z in range(UZ0, UZ1 + 1): log(bp, RX0, Y_PLATE, z, "z"); log(bp, RX1, Y_PLATE, z, "z")
    for z in range(RZ1 + 1, WUZ1 + 1): log(bp, WX0, Y_PLATE, z, "z"); log(bp, WX1, Y_PLATE, z, "z")
    for x in range(WX0, WX1 + 1): log(bp, x, Y_PLATE, WUZ1, "x")

NORTH_U = [0, 4, 10, 16, 22, 26]          # P3P5P5P5P3P (27)
SOUTH_W_U = [0, 4, 10, 14]                # P3P5P3P (15, west of the wing)
SOUTH_E_U = [24, 26]                      # east end past the wing
SIDE_U = [-1, 3, 7, 11]                   # P3P3P3P (13)
WING_SIDE_U = [11, 15, 19]                # P3P3P (9)
WING_S_U = [15, 17, 21, 23]               # P1P3P1P (9)

# ------------------------------------------------------------------ stage 3: floors
def floors(bp, B):
    stone = mix([("polished_andesite", 60), ("stone_bricks", 40)], 21)
    def lay(y, x0, z0, x1, z1, field, border, half="top"):
        for x in range(x0, x1 + 1):
            for z in range(z0, z1 + 1):
                b = border if x in (x0, x1) or z in (z0, z1) else field
                if callable(b): bp.set(x, y, z, b(x, y, z)[0])
                elif b.endswith("_slab"): bp.set(x, y, z, b, half=half)
                else: bp.set(x, y, z, b)
    lay(1, ARCH[1] + 2, RZ0 + 1, RX1 - 1, RZ1 - 1, stone, "stone_bricks")            # the hall: stone
    lay(1, WX0 + 1, RZ1, WX1 - 1, WZ1 - 1, stone, "stone_bricks")                   # the tap room: stone
    lay(1, RX0 + 1, RZ0 + 1, ARCH[0] - 2, RZ1 - 1, P["floor_field"], P["floor_border"])   # the parlour: boards
    lay(Y_UP, RX0 + 1, RZ0, RX1 - 1, RZ1, P["floor_field"], P["floor_border"])
    lay(Y_UP, WX0 + 1, RZ1 + 1, WX1 - 1, WUZ1 - 1, P["floor_field"], P["floor_border"])
    for x in NORTH_U[1:-1]:                                                         # beamed floor, joists across the range
        for z in range(RZ0, RZ1 + 1): log(bp, x, Y_UP, z, "z")
    for z in WING_SIDE_U[1:-1]:
        for x in range(WX0 + 1, WX1): log(bp, x, Y_UP, z, "x")
    # stair along the hall's back wall, rising east to the gallery
    for k in range(6):
        x, y = 12 + k, YF + k
        bp.set(x, y, 1, "spruce_stairs", facing="e")
        for yy in range(YF, y): bp.set(x, yy, 1, "spruce_planks")
    for x in range(12, 18): bp.set(x, Y_UP, 1, "air")
    for x in range(12, 18): bp.set(x, Y_UP + 1, 2, P["fence"])

# ------------------------------------------------------------------ stage 4: walls
def walls(bp, B):
    def fill(x, z):
        for y in range(Y_UP + 1, Y_PLATE):
            if keep(bp, x, y, z): bp.set(x, y, z, P["infill"])
    for x in range(RX0, RX1 + 1): fill(x, UZ0)
    for x in list(range(RX0, WX0)) + list(range(WX1 + 1, RX1 + 1)): fill(x, UZ1)
    for z in range(UZ0, UZ1 + 1): fill(RX0, z); fill(RX1, z)
    for z in range(RZ1 + 1, WUZ1 + 1): fill(WX0, z); fill(WX1, z)
    for x in range(WX0, WX1 + 1): fill(x, WUZ1)
    # inside: the wall between tap room and hall keeps piers, opened 3 wide
    for x in range(WING_C - 1, WING_C + 2):
        for y in range(YF, YF + 3): bp.set(x, y, RZ1, "air")
    # chimney breasts on both gable ends: 3 wide to the floor band, shoulders, then 1 wide
    for x, inward in ((RX0 - 1, "e"), (RX1 + 1, "w")):
        for z in (4, 5, 6):
            for y in range(1, Y_UP): bp.set(x, y, z, P["chimney"])
        bp.set(x, Y_UP, 4, "stone_brick_stairs", facing="s"); bp.set(x, Y_UP, 6, "stone_brick_stairs", facing="n")

# ------------------------------------------------------------------ stage 5: windows and doors
def leaf_box(bp, cells, y, out):
    dx, dz = OUT[out]
    along = (1, 0) if out in "ns" else (0, 1)
    for (x, z) in cells:
        bp.set(x + dx, y, z + dz, LEAVES(x, y, z)[0], persistent=True)
        if keep(bp, x + 2 * dx, y, z + 2 * dz): bp.set(x + 2 * dx, y, z + 2 * dz, SIGN, facing=out)
    ends = sorted(cells, key=lambda c: c[0] * along[0] + c[1] * along[1])
    for (cx, cz), d, (ax, az) in ((ends[0], "w" if along == (1, 0) else "n", (-along[0], -along[1])),
                                   (ends[-1], "e" if along == (1, 0) else "s", along)):
        if keep(bp, cx + dx + ax, y, cz + dz + az): bp.set(cx + dx + ax, y, cz + dz + az, SIGN, facing=d)

def shutters(bp, cells, ys, out):
    dx, dz = OUT[out]; along = (1, 0) if out in "ns" else (0, 1)
    ends = sorted(cells, key=lambda c: c[0] * along[0] + c[1] * along[1])
    for (cx, cz), s in ((ends[0], -1), (ends[-1], 1)):
        for y in ys: bp.set(cx + dx + s * along[0], y, cz + dz + s * along[1], "spruce_trapdoor", facing=out, open=True)

def openings(bp, B):
    for name, (cells, roles) in ground_faces().items():
        f = FACE_OUT[name]; dx, dz = OUT[f]
        for (x, z) in cells:
            role = roles.get(x if f in "sn" else z)
            if role == "win":
                for y in (3, 4, 5): bp.set(x, y, z, P["pane"])
                bp.set(x, 6, z, "stone_brick_stairs", facing=BACK[f], half="top")
            elif role == "panel":
                for y in (3, 4, 5): bp.set(x + dx, y, z + dz, PANEL, facing=f, open=True)
            elif role == "door":
                bp.set(x, YF, z, P["door"], facing=f); bp.set(x, YF + 1, z, P["door"], facing=f, upper=True)
                bp.set(x, YF + 2, z, "stone_brick_stairs", facing=BACK[f], half="top")
    up = [("n", [[(2, UZ0)], [(x, UZ0) for x in (6, 7, 8)], [(x, UZ0) for x in (12, 13, 14)], [(x, UZ0) for x in (18, 19, 20)], [(24, UZ0)]]),
          ("s", [[(2, UZ1)], [(x, UZ1) for x in (6, 7, 8)], [(12, UZ1)], [(25, UZ1)]]),
          ("w", [[(RX0, 1)], [(RX0, 9)]]), ("e", [[(RX1, 1)], [(RX1, 9)]]),
          ("w", [[(WX0, 13)], [(WX0, 17)]]), ("e", [[(WX1, 13)], [(WX1, 17)]]),
          ("s", [[(16, WUZ1)], [(x, WUZ1) for x in (18, 19, 20)], [(22, WUZ1)]])]
    for out, wins in up:
        for cells in wins:
            for (x, z) in cells:
                for y in (9, 10): bp.set(x, y, z, P["pane"])
            leaf_box(bp, cells, 8, out)
    # shutters on symmetric pairs (5 pairs of 19 windows... 10 of 19 cells): the wing front pair and the range front pair
    shutters(bp, [(16, WUZ1)], (9, 10), "s"); shutters(bp, [(22, WUZ1)], (9, 10), "s")
    shutters(bp, [(2, UZ1)], (9, 10), "s"); shutters(bp, [(12, UZ1)], (9, 10), "s")

# ------------------------------------------------------------------ stage 6: roof
def roof(bp, B):
    rng = (RX0, UZ0, RX1, UZ1); wing = (WX0, RZ1 + 1, WX1, WUZ1)
    B.roof(rng, "x", Y_PLATE + 1, overhang=1, verge=1, pitch=1)
    B.roof(wing, "z", Y_PLATE + 1, overhang=1, verge=1, pitch=1)
    for c in DORMERS: B.roof((c - 1, 7, c + 1, UZ1), "z", Y_PLATE + 3, overhang=1, verge=1, pitch=1)
    for c in BACK_DORMERS: B.roof((c - 1, UZ0, c + 1, 3), "z", Y_PLATE + 3, overhang=1, verge=1, pitch=1)
    B.build_roofs()
    B.gable_walls(rng, "x", Y_PLATE + 1); B.gable_walls(wing, "z", Y_PLATE + 1)
    # gables: posts over the bay posts and the centre line
    for x in (RX0, RX1):
        for z in range(UZ0 + 1, UZ1):
            for y in range(Y_PLATE + 1, B.H[(x, z)][0]):
                if bp.get(x, y, z)[0] in (P["frame"], P["infill"]):
                    log(bp, x, y, z) if z in SIDE_U or z == 5 else bp.set(x, y, z, P["infill"])
    for x in range(WX0 + 1, WX1):
        for y in range(Y_PLATE + 1, B.H[(x, WUZ1)][0]):
            if bp.get(x, y, WUZ1)[0] in (P["frame"], P["infill"]):
                log(bp, x, y, WUZ1) if x in WING_S_U or x == WING_C else bp.set(x, y, WUZ1, P["infill"])
    for y in (Y_PLATE + 2, Y_PLATE + 3): bp.set(WING_C, y, WUZ1, P["pane"])
    for z in (3, 7):                                                    # range gables: two small windows each side of the stack
        for x in (RX0, RX1): bp.set(x, Y_PLATE + 2, z, P["pane"])
    # dormers: front on the wall line, a 1 x 2 window, cheeks down to the main slope
    for cs, zw, inward, out in ((DORMERS, UZ1, -1, "s"), (BACK_DORMERS, UZ0, 1, "n")):
        for c in cs:
            for x in (c - 1, c, c + 1):
                for y in (Y_PLATE + 1, Y_PLATE + 2):
                    log(bp, x, y, zw) if x != c else bp.set(x, y, zw, P["pane"])
            log(bp, c, Y_PLATE + 3, zw, "x")
            for k in range(1, 5):
                z = zw + inward * k
                main_h = Y_PLATE + 1 + k
                for x in (c - 1, c + 1):
                    for y in range(main_h + 1, Y_PLATE + 3):
                        if keep(bp, x, y, z): bp.set(x, y, z, P["infill"])
                for y in range(Y_PLATE + 1, Y_PLATE + 3):
                    if bp.get(c, y, z)[0].endswith("_stairs"): bp.set(c, y, z, "air")
            leaf_box(bp, [(c, zw)], Y_PLATE, out)
    B.eaves(rng, "x", Y_PLATE - 1); B.eaves(wing, "z", Y_PLATE - 1)
    # corner blocks under every verge foot, lanterns on chains (a grand house: 07 hanging details)
    for x, z in ((RX0 - 1, UZ0 - 1), (RX1 + 1, UZ0 - 1), (RX0 - 1, UZ1 + 1), (RX1 + 1, UZ1 + 1), (WX0 - 1, WUZ1 + 1), (WX1 + 1, WUZ1 + 1)):
        if keep(bp, x, Y_PLATE - 1, z):
            bp.set(x, Y_PLATE - 1, z, P["trim_block"]); bp.set(x, Y_PLATE - 2, z, "iron_chain"); bp.set(x, Y_PLATE - 3, z, "lantern", hanging=True)
    # chimneys up the gable ends, through the verge, with the default top
    for x in (RX0 - 1, RX1 + 1):
        for y in range(Y_UP, Y_PLATE + 2): bp.set(x, y, 5, P["chimney"])
        top = B.chimney(x, 5, Y_UP)
        bp.set(x, top + 1, 5, "campfire")
        for d, (dx, dz) in OUT.items():
            if keep(bp, x + dx, top, 5 + dz) or bp.get(x + dx, top, 5 + dz)[0].endswith(("_stairs", "_slab")):
                bp.set(x + dx, top, 5 + dz, SIGN, facing=d)
            bp.set(x + dx, top + 1, 5 + dz, "dark_oak_trapdoor", facing=d, open=True)
        bp.set(x, top + 2, 5, "flower_pot")

# ------------------------------------------------------------------ stage 7: detailing
def detailing(bp, B):
    for x in (WING_C - 2, WING_C + 2): bp.set(x, Y_UP - 2, WUZ1, "lantern", hanging=True)     # at the inn door
    for x in (ARCH[0] - 1, ARCH[1] + 1):                                                    # either side of the arch
        bp.set(x, 4, RZ1 + 1, "lantern") if False else None
    bp.set(7, 4, RZ1, "lantern", hanging=True); bp.set(7, 4, RZ0, "lantern", hanging=True)  # in the arch crowns
    # a bench either side of the inn door, barrels by the arch, a trough and hitching rail for the coaches
    for x, d in ((WING_C - 2, "e"), (WING_C + 2, "w")):
        bp.set(x, 1, WZ1 + 1, "spruce_stairs", facing="n")
    for x in (11, 13): bp.set(x, 1, RZ1 + 1, "barrel")
    bp.set(12, 1, RZ1 + 1, "spruce_trapdoor", facing="s", open=True) if False else None
    for x in (1, 2, 3): bp.set(x, 1, RZ1 + 2, "spruce_fence")
    bp.set(0, 1, RZ1 + 2, "spruce_log", axis="y"); bp.set(4, 1, RZ1 + 2, "spruce_log", axis="y")
    for z in (RZ1 + 1,):
        for x in (1, 2, 3): bp.set(x, 1, z, "cauldron") if x == 2 else None
    # sign-boxed bushes on the back, vines on the shady north wall
    leaf_box(bp, [(8 - 7, RZ0)], 1, "n"); leaf_box(bp, [(25, RZ0)], 1, "n")
    for x, y in ((11, 3), (11, 4), (15, 2), (15, 3), (21, 2), (21, 3), (21, 4)):
        if keep(bp, x, y, RZ0 - 1): bp.set(x, y, RZ0 - 1, "vine", facing="s")
    # flowers along the street front of the range, an azalea at the wing corner
    for x, fl in ((0, "poppy"), (4, "cornflower"), (10, "azure_bluet"), (14, "dandelion")):
        if keep(bp, x, 1, RZ1 + 1): bp.set(x, 1, RZ1 + 1, fl)
    bp.set(WX1 + 1, 1, WZ1, "azalea_leaves_flowered", persistent=True)

# ------------------------------------------------------------------ stage 8: interiors (the inn is furnished)
def interiors(bp, B):
    # tap room: the bar across the back, two tables, lanterns
    F.bar(bp, 17, 21, YF, 12, "s")
    F.table(bp, 17, YF, 16, chairs="ew"); F.table(bp, 21, YF, 16, chairs="ew")
    for x in (17, 21): F.lantern_ceiling(bp, x, Y_UP - 1, 14)
    # hall: long table, the hearth on the east gable, the stair up
    F.long_table(bp, 13, 21, YF, 6)
    F.hearth(bp, RX1 - 1, YF, 5, "w")
    for x in (14, 20): F.lantern_ceiling(bp, x, Y_UP - 1, 6)
    for z in (8, 9): bp.set(RX1 - 1, YF, z, "barrel")
    # parlour west of the arch: hearth on the west gable, a table
    F.hearth(bp, RX0 + 1, YF, 5, "e")
    F.table(bp, 2, YF, 8, chairs="ns"); F.lantern_ceiling(bp, 2, Y_UP - 1, 3)
    # upstairs: three bedrooms on the street side west of the wing, one at the east end, the innkeeper's hall in the wing
    y = Y_UP + 1
    F.partition(bp, 1, 5, 14, 5, y, Y_PLATE - 1)
    for x in (5, 10): F.partition(bp, x, 6, x, 10, y, Y_PLATE - 1)
    F.partition(bp, 15, 5, 15, 10, y, Y_PLATE - 1)
    F.partition(bp, 23, 5, 23, 10, y, Y_PLATE - 1); F.partition(bp, 24, 5, 25, 5, y, Y_PLATE - 1)
    for dx_ in (3, 7, 12):
        bp.set(dx_, y, 5, "spruce_door", facing="n"); bp.set(dx_, y + 1, 5, "spruce_door", facing="n", upper=True)
    bp.set(24, y, 5, "spruce_door", facing="n"); bp.set(24, y + 1, 5, "spruce_door", facing="n", upper=True)
    for x0 in (1, 6, 11, 24):
        F.bed(bp, x0, y, 10, "s"); bp.set(x0 + 1, y, 10, "chest", facing="n") if keep(bp, x0 + 1, y, 10) else None
        F.lantern_ceiling(bp, x0 + 1, Y_PLATE - 1, 8)
    for z in (13, 14, 16, 17): bp.set(WX0 + 1, y, z, "bookshelf"); bp.set(WX0 + 1, y + 1, z, "bookshelf")
    F.long_table(bp, 18, 20, y, 15); bp.set(WX1 - 1, y, 17, "lectern", facing="w")
    for x in (8, 20): F.lantern_ceiling(bp, x, Y_PLATE - 1, 2)

STAGES = [("1 foundation", foundation), ("2 frame", frame), ("3 floors", floors), ("4 walls", walls),
          ("5 windows and doors", openings), ("6 roof", roof), ("7 detailing", detailing), ("8 interiors", interiors)]

def build(upto=99, roof_colour="red"):
    bp = Blueprint("kingsrest_inn_v2")
    B = Building(bp, P, 3)
    for i, (name, fn) in enumerate(STAGES):
        if i >= upto: break
        fn(bp, B)
    bp.markers["door"] = (WING_C, YF, WZ1 + 1)
    if upto >= 6: texture_roofs(bp)
    return bp.finish()
