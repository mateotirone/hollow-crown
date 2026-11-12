"""Kingsrest guildhall, built stage by stage from build-instructions/ (review round 3, 2026-11-12).

Plan: review/kingsrest_guildhall_plan.md. A Norman stone market hall on the north side of the square: an open
arcade on three sides at street level (the market), the council hall above lit by tall arched windows between
pilasters, a copper roof weathering green at the ridge (the town's civic accent), and a light open belfry on
the ridge. Formal: mirror-symmetric about the front centre line. Interior empty (floors and the stair).
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT); sys.path.insert(0, HERE)
from bp import Blueprint
from kit import Building, VALE, COPPER_MATS, mix, h3, texture_roofs, paint_stone, ground_dressing, VALE_STONE, STONE_FAMILY, ridge_cap

X0, X1, Z0, Z1 = 0, 20, 0, 12            # 21 x 13
C = 10                                    # front centre line
PIERS_X = (0, 4, 8, 12, 16, 20)           # P3P3P3P3P3P: five arches to the square, the middle one on the centre line
PIERS_Z = (0, 4, 8, 12)                   # P3P3P3P: three arches down each side
YF = 3                                    # market floor (two plinth courses, 02 civic)
Y_ARCH = 7                                # top row of the arches
Y_UP = 9                                  # council hall floor layer
Y_TOP = 16                                # wall top (cornice under the eaves at 15)
STONE = "stone_bricks"; DRESSED = "polished_andesite"
P = dict(VALE); P.update(COPPER_MATS)
P.update(trim="spruce_stairs", trim_block="spruce_planks", trim_slab="spruce_slab", door="spruce_door",
         fence="spruce_fence", pane="light_gray_stained_glass_pane", spikes=5, finial="spruce_fence", finial_top="lightning_rod", spike="spruce_fence", verge_lanterns=False)
SIGN = "spruce_wall_sign"
OUT = {"s": (0, 1), "n": (0, -1), "e": (1, 0), "w": (-1, 0)}
BACK = {"s": "n", "n": "s", "e": "w", "w": "e"}

def keep(bp, x, y, z): return bp.get(x, y, z)[0] in ("keep", "air")
def ring():
    """Outer wall cells with the face they look out of."""
    for x in range(X0, X1 + 1): yield x, Z1, "s"; yield x, Z0, "n"
    for z in range(Z0 + 1, Z1): yield X0, z, "w"; yield X1, z, "e"

# ------------------------------------------------------------------ stage 1: foundation, a two-course plinth, the steps
def foundation(bp, B):
    bp.fill(X0, -3, Z0, X1, 0, Z1, "cobblestone")
    bp.fill(X0, 1, Z0, X1, 1, Z1, "cobblestone")
    bp.fill(X0, 2, Z0, X1, 2, Z1, DRESSED)                     # top course smoother (01: civic plinth)
    # the flight to the middle arch: two steps, 3 wide, cheeks capped with slabs
    for x in (C - 1, C, C + 1):
        bp.set(x, 2, Z1 + 1, "stone_brick_stairs", facing="n"); bp.set(x, 1, Z1 + 1, STONE)
        bp.set(x, 1, Z1 + 2, "stone_brick_stairs", facing="n")
    for x in (C - 2, C + 2):
        for z in (Z1 + 1, Z1 + 2): bp.set(x, 1, z, STONE)
        bp.set(x, 2, Z1 + 1, STONE); bp.set(x, 3, Z1 + 1, "stone_brick_slab"); bp.set(x, 2, Z1 + 2, "stone_brick_slab")
    # back door steps
    for x in (C - 1, C, C + 1):
        bp.set(x, 2, Z0 - 1, "stone_brick_stairs", facing="s"); bp.set(x, 1, Z0 - 1, STONE)
        bp.set(x, 1, Z0 - 2, "stone_brick_stairs", facing="s")
    # drip course round the plinth top, except at the steps
    for x, z, f in ring():
        dx, dz = OUT[f]
        if keep(bp, x + dx, 2, z + dz): bp.set(x + dx, 2, z + dz, "stone_brick_stairs", facing=BACK[f], half="top")

# ------------------------------------------------------------------ stage 2: frame (piers, arcades, columns, string course)
def frame(bp, B):
    # arcade piers on the front and sides, solid back wall, the spandrel row over the arches
    for x, z, f in ring():
        on_pier = (f in "sn" and x in PIERS_X) or (f in "ew" and z in PIERS_Z)
        for y in range(YF, Y_UP):
            if f == "n" or on_pier or y > Y_ARCH: bp.set(x, y, z, STONE)
        if on_pier and f != "n":
            for y in range(YF, Y_ARCH): bp.set(x, y, z, DRESSED)
    # the arches: Mateo's round angle in every 3-wide bay (open trapdors at the jambs, stairs in the corners,
    # a top trapdoor in the crown)
    def arch(cells, f):
        a, m, b = cells
        r = {"s": ("w", "e"), "n": ("e", "w"), "e": ("s", "n"), "w": ("n", "s")}[f]

        bp.set(a[0], Y_ARCH, a[1], "stone_brick_stairs", facing=r[0], half="top")
        bp.set(b[0], Y_ARCH, b[1], "stone_brick_stairs", facing=r[1], half="top")
        bp.set(m[0], Y_ARCH, m[1], "spruce_trapdoor", facing=f, half="top", open=False)
        bp.set(a[0], Y_ARCH - 1, a[1], "spruce_trapdoor", facing=OPPF[r[0]], open=True)
        bp.set(b[0], Y_ARCH - 1, b[1], "spruce_trapdoor", facing=OPPF[r[1]], open=True)
    for p0 in PIERS_X[:-1]: arch([(p0 + 1, Z1), (p0 + 2, Z1), (p0 + 3, Z1)], "s")
    for p0 in PIERS_Z[:-1]:
        arch([(X0, p0 + 3), (X0, p0 + 2), (X0, p0 + 1)], "w"); arch([(X1, p0 + 1), (X1, p0 + 2), (X1, p0 + 3)], "e")
    # free-standing columns carry the hall floor over the market (02: floors spanning more than 9)
    for x in (4, 8, 12, 16):
        for z in (4, 8):
            for y in range(YF, Y_UP - 1): bp.set(x, y, z, DRESSED)
            bp.set(x, Y_UP - 1, z, "chiseled_stone_bricks")
    for z in (4, 8):
        for x in range(X0 + 1, X1): bp.set(x, Y_UP - 1, z, "stripped_dark_oak_log", axis="x")
    # string course at the hall floor line, all round, wrapping the corners
    for x, z, f in ring():
        dx, dz = OUT[f]
        if keep(bp, x + dx, Y_UP - 1, z + dz): bp.set(x + dx, Y_UP - 1, z + dz, "stone_brick_stairs", facing=BACK[f], half="top")
    # hall walls go up now (stone buildings: the walls are the frame), pilasters on every pier line
    for x, z, f in ring():
        for y in range(Y_UP, Y_TOP + 1): bp.set(x, y, z, STONE)
        pil = (f in "sn" and x in PIERS_X) or (f in "ew" and z in PIERS_Z)
        if pil:
            dx, dz = OUT[f]
            bp.set(x + dx, Y_UP, z + dz, "stone_brick_stairs", facing=BACK[f])      # base
            for y in range(Y_UP + 1, Y_TOP - 1): bp.set(x + dx, y, z + dz, DRESSED)
    for x, z in ((X0, Z0), (X1, Z0), (X0, Z1), (X1, Z1)):                          # quoins
        for y in range(Y_UP, Y_TOP + 1, 2): bp.set(x, y, z, DRESSED)
OPPF = {"n": "s", "s": "n", "e": "w", "w": "e"}

# ------------------------------------------------------------------ stage 3: floors
def floors(bp, B):
    market = mix([(DRESSED, 55), ("stone_bricks", 30), ("polished_diorite", 15)], 17)
    for x in range(X0 + 1, X1):
        for z in range(Z0 + 1, Z1 + 1 if False else Z1):
            bp.set(x, YF - 1, z, market(x, YF - 1, z)[0])
    for x in range(X0 + 1, X1):                                 # under the arcade too
        bp.set(x, YF - 1, Z1, market(x, YF - 1, Z1)[0]) if x not in PIERS_X else None
    for x in range(X0 + 1, X1):
        for z in range(Z0 + 1, Z1):
            border = x in (X0 + 1, X1 - 1) or z in (Z0 + 1, Z1 - 1)
            bp.set(x, Y_UP, z, "dark_oak_slab" if border else "spruce_slab", half="top")
    for x in PIERS_X[1:-1]:                                      # beamed hall floor, beams on the pier lines
        for z in range(Z0 + 1, Z1): bp.set(x, Y_UP, z, "stripped_dark_oak_log", axis="z")
    # the stair along the back wall, rising east, and its well
    for k in range(7):
        x, y = 3 + k, YF + k
        bp.set(x, y, Z0 + 1, "spruce_stairs", facing="e")
        for yy in range(YF, y): bp.set(x, yy, Z0 + 1, "spruce_planks")
    for x in range(3, 10): bp.set(x, Y_UP, Z0 + 1, "air"); bp.set(x, Y_UP + 1, Z0 + 2, "spruce_fence")

# ------------------------------------------------------------------ stage 4: walls are up; nothing to infill on a stone hall
def walls(bp, B):
    pass

# ------------------------------------------------------------------ stage 5: windows and doors
def tall_window(bp, x, z, f, w=1):
    """Hall window: 1 x 3 (or 3 x 4 with a round top), stair head, slab sill wider than the glass."""
    dx, dz = OUT[f]; ax, az = (1, 0) if f in "sn" else (0, 1)
    cells = [(x + ax * k, z + az * k) for k in range(-(w // 2), w // 2 + 1)]
    top = Y_UP + 3 if w == 1 else Y_UP + 4
    for (cx, cz) in cells:
        for y in range(Y_UP + 1, top + 1): bp.set(cx, y, cz, P["pane"])
    if w == 3:
        (lx, lz), (rx, rz) = cells[0], cells[-1]
        bp.set(lx, top, lz, "stone_brick_stairs", facing={"s": "w", "n": "e", "e": "s", "w": "n"}[f], half="top")
        bp.set(rx, top, rz, "stone_brick_stairs", facing={"s": "e", "n": "w", "e": "n", "w": "s"}[f], half="top")
        bp.set(x, top + 1, z, "chiseled_stone_bricks")                              # keystone
    else:
        bp.set(x, top + 1, z, "stone_brick_stairs", facing=BACK[f], half="top")
    for k in range(-(w // 2) - 1, w // 2 + 2):                                       # sill: a slab row 2 wider
        sx, sz = x + ax * k + dx, z + az * k + dz
        if keep(bp, sx, Y_UP, sz) or bp.get(sx, Y_UP, sz)[0].endswith("_stairs"):
            bp.set(sx, Y_UP, sz, "stone_brick_slab", half="top")

def openings(bp, B):
    for x in (2, 6, 14, 18): tall_window(bp, x, Z1, "s")
    tall_window(bp, C, Z1, "s", w=3)
    for x in (2, 6, 10, 14, 18): tall_window(bp, x, Z0, "n")
    for z in (2, 6, 10): tall_window(bp, X0, z, "w"); tall_window(bp, X1, z, "e")
    # back door: the six-block door (02/05: halls), dark oak, a stone arch over it
    for x in (C - 1, C, C + 1):
        for y in range(YF, YF + 3): bp.set(x, y, Z0, "air")
    bp.set(C, YF, Z0, "spruce_door", facing="n"); bp.set(C, YF + 1, Z0, "spruce_door", facing="n", upper=True)
    for x in (C - 1, C + 1):
        for y in (YF, YF + 1): bp.set(x, y, Z0, "spruce_trapdoor", facing="s", open=True)
        bp.set(x, YF + 2, Z0, "stone_brick_stairs", facing="w" if x < C else "e", half="top")
    bp.set(C, YF + 2, Z0, "spruce_slab", half="top")
    # slim windows in the solid back wall either side of the door
    for x in (2, 14, 18):
        for y in (YF + 1, YF + 2): bp.set(x, y, Z0, P["pane"])
        bp.set(x, YF + 3, Z0, "stone_brick_stairs", facing="s", half="top")

# ------------------------------------------------------------------ stage 6: roof, belfry, chimney
def roof(bp, B):
    rect = (X0, Z0, X1, Z1)
    B.roof(rect, "x", Y_TOP + 1, overhang=1, verge=1, pitch=1)
    B.build_roofs()
    B.gable_walls(rect, "x", Y_TOP + 1, style="stone")
    for x, z in [(X0, z) for z in range(Z0, Z1 + 1)] + [(X1, z) for z in range(Z0, Z1 + 1)]:   # gables: plain stone, a round window
        for y in range(Y_TOP + 1, B.H.get((x, z), (0,))[0]):
            if bp.get(x, y, z)[0] not in ("keep", "air") and not bp.get(x, y, z)[0].endswith(("_stairs", "_slab")): bp.set(x, y, z, STONE)
    for x in (X0, X1):
        bp.set(x, Y_TOP + 2, 6, P["pane"]); bp.set(x, Y_TOP + 3, 6, P["pane"])
        bp.set(x, Y_TOP + 4, 6, "chiseled_stone_bricks")
    # cornice under the eaves: upside-down stairs one proud on both long walls
    for x in range(X0, X1 + 1):
        for z, f in ((Z1 + 1, "s"), (Z0 - 1, "n")):
            if keep(bp, x, Y_TOP - 1, z): bp.set(x, Y_TOP - 1, z, "stone_brick_stairs", facing=BACK[f], half="top")
    # the belfry: a stone base on the ridge, four slim posts, the bell, a copper cap and a finial
    bx0, bx1, bz0, bz1 = C - 1, C + 1, 5, 7
    ridge = B.H[(C, 6)][0]
    for x in range(bx0, bx1 + 1):
        for z in range(bz0, bz1 + 1):
            for y in range(ridge - 1, ridge + 2): bp.set(x, y, z, DRESSED)
    for x, z in ((bx0, bz0), (bx1, bz0), (bx0, bz1), (bx1, bz1)):
        for y in range(ridge + 2, ridge + 5): bp.set(x, y, z, "stone_brick_wall")
    bp.set(C, ridge + 4, 6, "spruce_planks"); bp.set(C, ridge + 3, 6, "bell", attachment="hanging")
    yc = ridge + 5
    for x in range(bx0 - 1, bx1 + 2):
        for z in range(bz0 - 1, bz1 + 2):
            d = {"s": z == bz1 + 1, "n": z == bz0 - 1, "e": x == bx1 + 1, "w": x == bx0 - 1}
            face = [k for k, v in d.items() if v]
            if face: bp.set(x, yc, z, "waxed_weathered_cut_copper_stairs", facing=BACK[face[0]])
            else: bp.set(x, yc, z, "waxed_oxidized_cut_copper")
    for x in range(bx0, bx1 + 1):
        for z in range(bz0, bz1 + 1):
            if (x, z) != (C, 6):
                f = "s" if z == bz1 else "n" if z == bz0 else "e" if x == bx1 else "w"
                bp.set(x, yc + 1, z, "waxed_oxidized_cut_copper_stairs", facing=BACK[f])
    bp.set(C, yc + 1, 6, "waxed_oxidized_cut_copper"); bp.set(C, yc + 2, 6, "lightning_rod")
    # the hall's chimney up the east gable
    top = B.chimney(X1, 3, Y_UP + 1)
    # lanterns on chains at the four verge feet (a grand building)
    for x, z in ((X0 - 1, Z0 - 1), (X1 + 1, Z0 - 1), (X0 - 1, Z1 + 1), (X1 + 1, Z1 + 1)):
        if keep(bp, x, Y_TOP - 1, z):
            bp.set(x, Y_TOP - 1, z, P["trim_block"]); bp.set(x, Y_TOP - 2, z, "iron_chain"); bp.set(x, Y_TOP - 3, z, "lantern", hanging=True)

# ------------------------------------------------------------------ stage 7: detailing
def detailing(bp, B):
    # a lantern hanging in every arch crown: an even rhythm all round the market
    for p0 in PIERS_X[:-1]: bp.set(p0 + 2, Y_ARCH - 1, Z1, "lantern", hanging=True)
    for p0 in PIERS_Z[:-1]:
        bp.set(X0, Y_ARCH - 1, p0 + 2, "lantern", hanging=True); bp.set(X1, Y_ARCH - 1, p0 + 2, "lantern", hanging=True)
    # market stalls: barrels and crates under the side arcades, a sign-boxed bush at each front corner
    for z in (2, 10):
        bp.set(X0 + 1, YF, z, "barrel"); bp.set(X1 - 1, YF, z, "barrel")
    for x, z in ((X0 - 1, Z1 + 1), (X1 + 1, Z1 + 1)):
        bp.set(x, 1, z, "azalea_leaves_flowered", persistent=True)
        for d, (dx, dz) in OUT.items():
            if keep(bp, x + dx, 1, z + dz) and (x + dx, z + dz) not in [(X0 - 1, Z1), (X1 + 1, Z1)]:
                bp.set(x + dx, 1, z + dz, SIGN, facing=d) if not (X0 <= x + dx <= X1 and Z0 <= z + dz <= Z1) else None
    # vines on the shady back wall
    for x, y in ((5, 5), (5, 6), (5, 7), (15, 4), (15, 5), (17, 10), (17, 11)):
        if keep(bp, x, y, Z0 - 1): bp.set(x, y, Z0 - 1, "vine", facing="s")
    # a banner of the town over the middle arch: hanging lantern pair at the steps
    for x in (C - 2, C + 2): bp.set(x, 4, Z1 + 1, "lantern")

STAGES = [("1 foundation", foundation), ("2 frame", frame), ("3 floors", floors), ("4 walls", walls),
          ("5 windows and doors", openings), ("6 roof", roof), ("7 detailing", detailing)]

def build(upto=99, roof_colour="copper"):
    bp = Blueprint("kingsrest_guildhall_v2")
    B = Building(bp, P, 5)
    for i, (name, fn) in enumerate(STAGES):
        if i >= upto: break
        fn(bp, B)
    paint_stone(bp, VALE_STONE, STONE_FAMILY)
    if upto >= 6: ridge_cap(bp); texture_roofs(bp)
    bp.markers["door"] = (C, YF, Z1 + 1)
    return bp.finish()
