"""Kingsrest street house, built stage by stage from build-instructions/ (review round 1, 2026-11-11).

The plan (00-planning/plan-template.md) is in review/kingsrest_house_plan.md. Each stage below is one
folder of build-instructions/, and build(upto) stops after that stage so every stage can be rendered.

    python3 review/kingsrest_house.py OUT_DIR [--roof slate|red] [--stages 1,2,...,8]
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.join(ROOT, "..", "..", "build-instructions", "texturing"))
from bp import Blueprint
from kit import Building, VALE, mix, h3
from doctrine import paint_teeth, family

# ------------------------------------------------------------------ plan numbers (00-planning)
W, D = 8, 10                       # ground storey x 0..8 (9), z 0..10 (11)
UZ0, UZ1 = -1, D + 1               # upper storey jettied front and back: z -1..11 (13)
YF, Y_UP, Y_PLATE = 2, 7, 12       # ground walking surface, upper floor line, wall plate
FRONT_U = (0, 2, 6, 8)             # upper front posts, P1P3P1P
BACK_U = (0, 4, 8)                 # upper back posts, P3P3P
SIDE_U = (-1, 3, 7, 11)            # upper side posts, P3P3P3P
SIDE_WIN = (1, 5, 9)               # side windows, both storeys (stacked)
STAIR_X, STAIR_Z0, STAIR_Z1 = 7, 4, 9
DORMER_Z = 5                       # east dormer over the middle side window
LEAN = (3, 7)                      # west woodshed lean-to, z 3..7

# ------------------------------------------------------------------ palette sheet (plan section 8)
P = dict(VALE)
P.update(
    frame="stripped_spruce_log",           # warm mid-brown frame (decision by eye, plan section 9)
    infill="calcite", pane="brown_stained_glass_pane",
    floor_field="spruce_slab", floor_border="dark_oak_slab",
    trim="dark_oak_stairs", trim_block="dark_oak_planks", trim_slab="dark_oak_slab",
    bracket="dark_oak_stairs", door="spruce_door", fence="spruce_fence",
)
ROOFS = {
    # old slate (06-roof step 10): tiles at the ridge down to cobble at the eaves
    "slate": dict(roof="cobbled_deepslate_stairs", roof_block="deepslate_tiles", roof_slab="deepslate_tile_slab",
                  roof_ladder=["cobbled_deepslate_stairs", "deepslate_brick_stairs", "deepslate_tile_stairs"]),
    # warm red (Kingsrest mix: 2 in 10): granite at the eaves, brick above
    "red": dict(roof="polished_granite_stairs", roof_block="brick_block", roof_slab="brick_slab",
                roof_ladder=["polished_granite_stairs", "brick_stairs", "brick_stairs"]),
}
LEAVES = mix([("azalea_leaves", 70), ("azalea_leaves_flowered", 30)], 12)
SIGN = "spruce_wall_sign"
PANEL = "dark_oak_trapdoor"
STONE = family("VAL-01")["blocks"]          # tuff bricks, cobblestone, andesite, smooth stone (bottom to top)
OUT = {"s": (0, 1), "n": (0, -1), "e": (1, 0), "w": (-1, 0)}
BACK = {"s": "n", "n": "s", "e": "w", "w": "e"}

def log(bp, x, y, z, axis="y"): bp.set(x, y, z, P["frame"], axis=axis)

def faces():
    """Ground walls left to right seen from outside."""
    return {"s": [(x, D) for x in range(0, W + 1)], "n": [(x, 0) for x in range(W, -1, -1)],
            "e": [(W, z) for z in range(D, -1, -1)], "w": [(0, z) for z in range(0, D + 1)]}

def ground_roles(f):
    """Plan section 3: what each cell of a ground wall is (keyed by x on n/s walls, z on e/w)."""
    if f == "s": return {1: "win", 7: "win", 2: "panel", 6: "panel", 3: "pier", 5: "pier", 4: "door"}
    if f == "n": return {2: "win", 6: "win"}
    return {z: "win" for z in SIDE_WIN}

# ------------------------------------------------------------------ stage 1: foundation
def foundation(bp, B):
    bp.fill(0, -3, 0, W, 0, D, P["found"])                    # footings 4 down under the whole footprint
    for x in range(1, W):
        for z in range(1, D): bp.set(x, 1, z, P["found"])    # solid layer under the ground floor
    for x in (3, 4, 5): bp.set(x, 1, D + 1, "stone_brick_stairs", facing="n")   # one step, doorway wide
    for z in LEAN:                                            # footings under the lean-to posts
        for y in range(-3, 1): bp.set(-3, y, z, P["found"])

# ------------------------------------------------------------------ stage 2: frame
def frame(bp, B):
    # stone ground storey: painted gradient (texturing doctrine), quoins at the corners
    for f, cells in faces().items():
        grid = paint_teeth(len(cells), 6, STONE, seed=ord(f))
        for i, (x, z) in enumerate(cells):
            for row, y in enumerate(range(1, 7)):
                bp.set(x, y, z, grid[row][i])
    for x, z in ((0, 0), (W, 0), (0, D), (W, D)):
        for y in range(2, 7):
            if y % 2 == 0: bp.set(x, y, z, P["quoin"])
    for x in (3, 5):                                          # dressed piers either side of the door
        for y in range(2, 6): bp.set(x, y, D, P["quoin"])
    # floor band at y 7 on all four walls of the jettied upper storey, corner uprights
    for x in range(0, W + 1):
        for z in (UZ0, UZ1): log(bp, x, Y_UP, z, "x")
    for z in range(UZ0, UZ1 + 1):
        for x in (0, W): log(bp, x, Y_UP, z, "z")
    for x, z in ((0, UZ0), (W, UZ0), (0, UZ1), (W, UZ1)): log(bp, x, Y_UP, z, "y")
    # jetty supports (02-frame): a bracket under every upper post, arched slab / trapdoor between
    for z, out, posts in ((UZ1, "s", FRONT_U), (UZ0, "n", BACK_U)):
        for x in range(0, W + 1):
            d = min(abs(x - p) for p in posts)
            if d == 0: bp.set(x, Y_UP - 1, z, P["bracket"], facing=BACK[out], half="top")
            elif d == 1: bp.set(x, Y_UP - 1, z, "spruce_slab", half="top")
            else: bp.set(x, Y_UP - 1, z, "spruce_trapdoor", facing=out, half="top")
    # upper posts by the bay patterns, wall plate on top
    for y in range(Y_UP + 1, Y_PLATE):
        for x in FRONT_U: log(bp, x, y, UZ1)
        for x in BACK_U: log(bp, x, y, UZ0)
        for z in SIDE_U:
            for x in (0, W): log(bp, x, y, z)
    for x in range(0, W + 1):
        for z in (UZ0, UZ1): log(bp, x, Y_PLATE, z, "x")
    for z in range(UZ0, UZ1 + 1):
        for x in (0, W): log(bp, x, Y_PLATE, z, "z")
    # lean-to woodshed on the west: two posts, a beam
    for z in LEAN:
        for y in range(1, 4): log(bp, -3, y, z)
    for z in range(LEAN[0], LEAN[1] + 1): log(bp, -3, 4, z, "z")

# ------------------------------------------------------------------ stage 3: floors
def floors(bp, B):
    def lay(y, x0, z0, x1, z1):
        for x in range(x0, x1 + 1):
            for z in range(z0, z1 + 1):
                bp.set(x, y, z, P["floor_border"] if x in (x0, x1) or z in (z0, z1) else P["floor_field"], half="top")
    lay(1, 1, 1, W - 1, D - 1)
    bp.set(4, 1, D, P["trim_block"])                          # threshold
    lay(Y_UP, 1, 0, W - 1, D)
    for z in (1, 5, 9):                                       # beamed floor: joists flush, in line with posts
        for x in range(1, W):
            if not (x == STAIR_X and STAIR_Z0 <= z <= STAIR_Z1): log(bp, x, Y_UP, z, "x")
    for k in range(6):                                        # stair along the east wall, rising north
        z, y = STAIR_Z1 - k, YF + k
        bp.set(STAIR_X, y, z, "spruce_stairs", facing="n")
        for yy in range(YF, y): bp.set(STAIR_X, yy, z, "spruce_planks")
    for z in range(STAIR_Z0 + 1, STAIR_Z1 + 1): bp.set(STAIR_X, Y_UP, z, "air")
    for z in range(STAIR_Z0 + 1, STAIR_Z1 + 1): bp.set(STAIR_X - 1, Y_UP + 1, z, P["fence"])

# ------------------------------------------------------------------ stage 4: walls
def walls(bp, B):
    for y in range(Y_UP + 1, Y_PLATE):
        for x in range(0, W + 1):
            for z in (UZ0, UZ1):
                if bp.get(x, y, z)[0] == "keep": bp.set(x, y, z, P["infill"])
        for z in range(UZ0, UZ1 + 1):
            for x in (0, W):
                if bp.get(x, y, z)[0] == "keep": bp.set(x, y, z, P["infill"])

# ------------------------------------------------------------------ stage 5: windows and doors
def leaf_box(bp, cells, y, out):
    """Leaves boxed in by wall signs, one block out (05: window boxes)."""
    dx, dz = OUT[out]
    along = (1, 0) if out in "ns" else (0, 1)
    free = lambda x, yy, z: bp.get(x, yy, z)[0] in ("keep", "air")
    for (x, z) in cells:
        bp.set(x + dx, y, z + dz, LEAVES(x, y, z)[0], persistent=True)
        if free(x + 2 * dx, y, z + 2 * dz): bp.set(x + 2 * dx, y, z + 2 * dz, SIGN, facing=out)
    ends = sorted(cells, key=lambda c: c[0] * along[0] + c[1] * along[1])
    for (cx, cz), d, (ax, az) in ((ends[0], "w" if along == (1, 0) else "n", (-along[0], -along[1])),
                                   (ends[-1], "e" if along == (1, 0) else "s", along)):
        if free(cx + dx + ax, y, cz + dz + az): bp.set(cx + dx + ax, y, cz + dz + az, SIGN, facing=d)

def shutters(bp, cells, ys, out):
    dx, dz = OUT[out]
    along = (1, 0) if out in "ns" else (0, 1)
    ends = sorted(cells, key=lambda c: c[0] * along[0] + c[1] * along[1])
    for (cx, cz), s in ((ends[0], -1), (ends[-1], 1)):
        for y in ys: bp.set(cx + dx + s * along[0], y, cz + dz + s * along[1], "spruce_trapdoor", facing=out, open=True)

def openings(bp, B):
    # ground storey (stone, 05 "Stone ground floors"): slim 1 x 3 windows, stair heads, dark oak panels on the front
    for f, cells in faces().items():
        roles = ground_roles(f)
        dx, dz = OUT[f]
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
    # upper storey: windows 2 tall at y 9..10, stacked over the openings below
    front = [[(1, UZ1)], [(3, UZ1), (4, UZ1), (5, UZ1)], [(7, UZ1)]]
    back = [[(2, UZ0)], [(6, UZ0)]]
    sides = {"e": [[(W, z)] for z in SIDE_WIN], "w": [[(0, z)] for z in SIDE_WIN]}
    for out, wins in [("s", front), ("n", back), ("e", sides["e"]), ("w", sides["w"])]:
        for cells in wins:
            for (x, z) in cells:
                for y in (9, 10): bp.set(x, y, z, P["pane"])
            leaf_box(bp, cells, 8, out)
    # shutters on 4 of 13 windows, in symmetric pairs: the two narrow front windows, the two middle side windows
    shutters(bp, [(1, UZ1)], (9, 10), "s"); shutters(bp, [(7, UZ1)], (9, 10), "s")
    shutters(bp, [(0, 5)], (9, 10), "w"); shutters(bp, [(W, 5)], (9, 10), "e")

# ------------------------------------------------------------------ stage 6: roof
def roof(bp, B):
    up = (0, UZ0, W, UZ1)
    B.roof(up, "z", Y_PLATE + 1, overhang=1, verge=1, pitch=1)
    # east dormer, 3 wide, on the middle side window line; its ridge runs into the main slope
    B.roof((5, DORMER_Z - 1, W, DORMER_Z + 1), "x", Y_PLATE + 3, overhang=1, verge=1, pitch=1)
    B.build_roofs()
    B.gable_walls(up, "z", Y_PLATE + 1)
    # gables: posts carried up over the bay posts and the centre line, a window on the centre line
    for z in (UZ0, UZ1):
        posts = FRONT_U if z == UZ1 else BACK_U
        for x in range(1, W):
            for y in range(Y_PLATE + 1, B.H[(x, z)][0]):
                if bp.get(x, y, z)[0] in (P["frame"], P["infill"]):
                    if x in posts or x == 4: log(bp, x, y, z)
                    else: bp.set(x, y, z, P["infill"])
        for y in (Y_PLATE + 2, Y_PLATE + 3): bp.set(4, y, z, P["pane"])
    # dormer walls: front on the wall line, cheeks down to the main roof
    for z in range(DORMER_Z - 1, DORMER_Z + 2):
        for y in (Y_PLATE + 1, Y_PLATE + 2):
            edge = z != DORMER_Z
            if edge: log(bp, W, y, z)
            else: bp.set(W, y, z, P["pane"])
        if z == DORMER_Z: log(bp, W, Y_PLATE + 3, z, "x")
    for z in (DORMER_Z - 1, DORMER_Z + 1):
        for x in range(5, W):
            main_h = Y_PLATE + 1 + (W - x)                        # main slope height in this column
            for y in range(main_h + 1, Y_PLATE + 3):
                if bp.get(x, y, z)[0] in ("keep", "air"): bp.set(x, y, z, P["infill"])
    for z in range(DORMER_Z - 1, DORMER_Z + 2):                   # clear the main roof inside the dormer
        for x in range(6, W):
            for y in range(Y_PLATE + 1, Y_PLATE + 3):
                if z == DORMER_Z and bp.get(x, y, z)[0].endswith("_stairs"): bp.set(x, y, z, "air")
    leaf_box(bp, [(W, DORMER_Z)], Y_PLATE, "e") if bp.get(W + 1, Y_PLATE, DORMER_Z)[0] in ("keep", "air") else None
    B.eaves(up, "z", Y_PLATE - 1)
    # corner blocks under the verge feet (06 step 5); lanterns on chains at the two street corners only
    for z in (UZ0 - 1, UZ1 + 1):
        for x in (-1, W + 1):
            bp.set(x, Y_PLATE - 1, z, P["trim_block"])
            if z == UZ1 + 1:
                bp.set(x, Y_PLATE - 2, z, "iron_chain"); bp.set(x, Y_PLATE - 3, z, "lantern", hanging=True)
    # chimney: a stack inside against the back wall, up through the roof west of the ridge
    cx, cz = 2, 1
    for y in range(YF, Y_UP): bp.set(cx, y, cz, P["chimney"])
    top = B.chimney(cx, cz, Y_UP)
    bp.set(cx, top + 1, cz, "campfire")
    for d, (dx, dz) in OUT.items():
        bp.set(cx + dx, top, cz + dz, SIGN, facing=d)
        bp.set(cx + dx, top + 1, cz + dz, "dark_oak_trapdoor", facing=d, open=True)
    bp.set(cx, top + 2, cz, "flower_pot")
    # lean-to: one slope of the main roof's colour from the wall down to the beam, flashing against the wall
    lad = P["roof_ladder"]
    for i, x in enumerate((-1, -2, -3)):
        for z in range(LEAN[0] - 1, LEAN[1] + 2):
            bp.set(x, 6 - i, z, lad[0] if i == 2 else lad[min(1, len(lad) - 1)], facing="e")
    for z in (LEAN[0] - 1, LEAN[1] + 1):                         # barge boards on the two open ends
        for i, x in enumerate((-1, -2)):
            bp.set(x, 5 - i, z, P["trim"], facing="w", half="top")
    # ridge cap of the lean-to against the wall
    for z in range(LEAN[0] - 1, LEAN[1] + 2): bp.set(-1, 7, z, P["trim_slab"]) if bp.get(-1, 7, z)[0] in ("keep", "air") else None

# ------------------------------------------------------------------ stage 7: detailing
def detailing(bp, B):
    # the door: lanterns hang from the jetty brackets either side
    for x in (2, 6): bp.set(x, Y_UP - 2, UZ1, "lantern", hanging=True)
    # foot of the front: a spruce planter of flowers under each panel, the step path
    for x, fl in ((1, "poppy"), (7, "cornflower")):
        bp.set(x, 1, D + 1, "dirt"); bp.set(x, 2, D + 1, fl)
        bp.set(x, 1, D + 2, "spruce_trapdoor", facing="s", open=True)
        for s in (-1, 1): bp.set(x + s, 1, D + 1, "spruce_trapdoor", facing="e" if s > 0 else "w", open=True)
    # sign-boxed bushes at the back corners, vines on the shady north side
    leaf_box(bp, [(1, 0)], 1, "n"); leaf_box(bp, [(7, 0)], 1, "n")
    for x, y in ((3, 3), (3, 4), (5, 2), (5, 3)): bp.set(x, y, -1, "vine", facing="s") if bp.get(x, y, -1)[0] == "keep" else None
    # the woodpile under the lean-to, a chopping block
    for z in (LEAN[0], LEAN[0] + 1, LEAN[1] - 1, LEAN[1]):
        for y in (1, 2): bp.set(-1, y, z, "stripped_spruce_log" if (y + z) % 3 else "spruce_log", axis="x")
    bp.set(-2, 1, 5, "stripped_oak_log", axis="y")

STAGES = [("1 foundation", foundation), ("2 frame", frame), ("3 floors", floors), ("4 walls", walls),
          ("5 windows and doors", openings), ("6 roof", roof), ("7 detailing", detailing)]

def build(upto=99, roof_colour="slate"):
    bp = Blueprint(f"kingsrest_street_house_{roof_colour}")
    pal = dict(P, **ROOFS[roof_colour])
    globals()["P"].update(ROOFS[roof_colour])
    B = Building(bp, pal, 7)
    for i, (name, fn) in enumerate(STAGES):
        if i >= upto: break
        fn(bp, B)
    bp.markers["door"] = (4, YF, D + 1)
    return bp.finish()
