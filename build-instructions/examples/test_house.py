"""Test building for build-instructions/: a two-storey Vale town house in Kingsrest, built stage by stage
exactly as the instructions say. Each stage is a function; after each one the scene is saved so it can
be rendered on its own.

Plan (build-instructions/00-planning): see TEST-HOUSE-PLAN.md next to the renders.
  Footprint 9 x 11 (x 0..8, z 0..10), front south (z = 10). Ground floor walking surface y = 2
  (one step above the outside ground). Storey height 5 (9 wide). Upper storey jettied 1 front and back
  (z -1..11, 13 deep, so the side walls stay odd). Gable roof, ridge along z, pitch 1, slate.
  Bay patterns: front P1P3P1P, back P3P3P, ground sides P3P5P, upper sides P3P3P3P.
"""
import os, sys, json, argparse, subprocess
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from bp import Blueprint
from kit import Building, VALE, mix, h3

P = dict(VALE)
P.update(
    plinth=mix([("cobblestone", 60), ("mossy_cobblestone", 15), ("andesite", 15), ("stone_bricks", 10)], 4),
    frame="stripped_dark_oak_log", infill="calcite",
    pane="brown_stained_glass_pane",               # tinted to the house (palettes/vale.md: plaster houses)
    floor_field="spruce_slab", floor_border="dark_oak_slab", joist="stripped_dark_oak_log",
)
LEAVES = mix([("azalea_leaves", 70), ("azalea_leaves_flowered", 30)], 12)
SIGN = "darkoak_wall_sign"
W, D = 8, 10            # last x, last z of the ground storey
YF = 2                  # ground floor walking surface
Y_UP = 7                # upper floor layer (walking surface 8)
Y_PLATE = 12            # wall plate
FRONT_POSTS = (0, 2, 6, 8); BACK_POSTS = (0, 4, 8)
SIDE_POSTS_G = (0, 4, 10); SIDE_POSTS_U = (-1, 3, 7, 11)

def log(bp, x, y, z, axis): bp.set(x, y, z, P["frame"], axis=axis)

# ---------------------------------------------------------------- stage 1: foundation
def foundation(bp):
    bp.fill(0, -3, 0, W, 0, D, P["found"])                            # footings 4 deep under the whole footprint
    for x in range(0, W + 1):                                          # plinth course y = 1
        for z in range(0, D + 1):
            if x in (0, W) or z in (0, D): bp.set(x, 1, z, P["plinth"])
            else: bp.set(x, 1, z, P["found"])                          # solid layer under the floor
    for x in (3, 4, 5):                                                # one rise: landing level with the floor, one stair
        bp.set(x, 1, D + 1, "stone_bricks")
        bp.set(x, 1, D + 2, "stone_brick_stairs", facing="n")

# ---------------------------------------------------------------- stage 2: frame
def frame(bp):
    # ground storey: sill beam on the plinth (y 2), posts y 2..6
    for x in range(0, W + 1):
        for z in (0, D): log(bp, x, 2, z, "x")
    for z in range(0, D + 1):
        for x in (0, W): log(bp, x, 2, z, "z")
    for y in range(2, Y_UP):
        for x in FRONT_POSTS: log(bp, x, y, D, "y")
        for x in BACK_POSTS: log(bp, x, y, 0, "y")
        for z in SIDE_POSTS_G:
            for x in (0, W): log(bp, x, y, z, "y")
    # floor line beam (y 7) = sill beam of the jettied upper storey, z -1..11
    for x in range(0, W + 1):
        for z in (-1, D + 1): log(bp, x, Y_UP, z, "x")
    for z in range(-1, D + 2):
        for x in (0, W): log(bp, x, Y_UP, z, "z")
    # upper storey posts y 8..12 and the wall plate at y 12
    for y in range(Y_UP + 1, Y_PLATE):
        for x in FRONT_POSTS: log(bp, x, y, D + 1, "y")
        for x in BACK_POSTS: log(bp, x, y, -1, "y")
        for z in SIDE_POSTS_U:
            for x in (0, W): log(bp, x, y, z, "y")
    for x in range(0, W + 1):
        for z in (-1, D + 1): log(bp, x, Y_PLATE, z, "x")
    for z in range(-1, D + 2):
        for x in (0, W): log(bp, x, Y_PLATE, z, "z")
    # jetty brackets: an upside-down stair under every upper post on the jettied walls
    for x in FRONT_POSTS: bp.set(x, Y_UP - 1, D + 1, P["bracket"], facing="n", half="top")
    for x in BACK_POSTS: bp.set(x, Y_UP - 1, -1, P["bracket"], facing="s", half="top")
    # the jettied ends of the side sill beams also get a bracket
    for x in (0, W):
        bp.set(x, Y_UP - 1, -1, P["bracket"], facing="s", half="top"); bp.set(x, Y_UP - 1, D + 1, P["bracket"], facing="n", half="top")

# ---------------------------------------------------------------- stage 3: floors
STAIR_X, STAIR_Z0, STAIR_Z1 = 7, 4, 9        # flight along the east wall, z 9 up to z 4
def floors(bp):
    def lay(y, x0, z0, x1, z1):
        for x in range(x0, x1 + 1):
            for z in range(z0, z1 + 1):
                border = x in (x0, x1) or z in (z0, z1)
                bp.set(x, y, z, P["floor_border"] if border else P["floor_field"], half="top")
    lay(1, 1, 1, W - 1, D - 1)                                         # ground floor, top slabs
    bp.set(4, 1, D, "dark_oak_planks")                                 # threshold under the door
    lay(Y_UP, 1, 0, W - 1, D)                                          # upper floor over the joists
    for z in (2, 5, 8):                                                # joists every 3, across the short span
        for x in range(1, W):
            if not (x == STAIR_X and STAIR_Z0 <= z <= STAIR_Z1): bp.set(x, Y_UP - 1, z, P["joist"], axis="x")
    for k in range(6):                                                 # 6 steps for a floor-to-floor of 6
        z, y = STAIR_Z1 - k, YF + k
        bp.set(STAIR_X, y, z, "spruce_stairs", facing="n")
        for yy in range(YF, y): bp.set(STAIR_X, yy, z, "spruce_planks")
    for z in range(STAIR_Z0 + 1, STAIR_Z1 + 1):                        # stair well, headroom over the flight
        bp.set(STAIR_X, Y_UP, z, "air")
    for z in range(STAIR_Z0 + 1, STAIR_Z1 + 1): bp.set(STAIR_X - 1, Y_UP + 1, z, P["fence"])   # guard rail upstairs
    bp.set(STAIR_X, Y_UP + 1, STAIR_Z1 + 1, P["fence"])

# ---------------------------------------------------------------- stage 4: walls
def walls(bp):
    def infill(cells, y0, y1):
        for (x, z) in cells:
            for y in range(y0, y1 + 1):
                if bp.get(x, y, z)[0] == "keep": bp.set(x, y, z, P["infill"])
    ground = [(x, z) for x in range(0, W + 1) for z in (0, D)] + [(x, z) for z in range(0, D + 1) for x in (0, W)]
    upper = [(x, z) for x in range(0, W + 1) for z in (-1, D + 1)] + [(x, z) for z in range(-1, D + 2) for x in (0, W)]
    infill(ground, 3, Y_UP - 1)
    infill(upper, Y_UP + 1, Y_PLATE - 1)

# ---------------------------------------------------------------- stage 5: windows and doors
def window(bp, cells, y, out, shutters=False, cap=False, box=True):
    """cells: wall cells of the glass (one row); y: bottom of a 2-tall window; out: outward direction.
    Glass flush in the wall face. Under it a window box (Mateo, 2026-11-11): leaves one block out, as wide
    as the glass, with wall signs round its front and ends. A top-slab cap only when asked (stone, or no
    beam close above)."""
    dx, dz = {"n": (0, -1), "s": (0, 1), "e": (1, 0), "w": (-1, 0)}[out]
    along = (1, 0) if out in "ns" else (0, 1)
    left = {"s": "w", "n": "e", "e": "s", "w": "n"}[out]; right = {"s": "e", "n": "w", "e": "n", "w": "s"}[out]
    for (x, z) in cells:
        for j in range(2): bp.set(x, y + j, z, P["pane"])
    ends = [(cells[0][0] - along[0], cells[0][1] - along[1]), (cells[-1][0] + along[0], cells[-1][1] + along[1])]
    if box:
        free = lambda x, yy, z: bp.get(x, yy, z)[0] == "keep"
        if all(free(x + dx, y - 1, z + dz) for (x, z) in cells):
            for (x, z) in cells:
                bp.set(x + dx, y - 1, z + dz, LEAVES(x, y, z)[0], persistent=True)
                if free(x + 2 * dx, y - 1, z + 2 * dz): bp.set(x + 2 * dx, y - 1, z + 2 * dz, SIGN, facing=out)
            # end signs face along the wall, away from the box (wall signs on the ends of the leaves)
            first, last = cells[0], cells[-1]
            order = sorted([first, last], key=lambda c: c[0] * along[0] + c[1] * along[1])
            lo_c, hi_c = order[0], order[1]
            lo_dir = "w" if along == (1, 0) else "n"; hi_dir = "e" if along == (1, 0) else "s"
            for (cx, cz), d, (ax, az) in ((lo_c, lo_dir, (-along[0], -along[1])), (hi_c, hi_dir, along)):
                sx, sz = cx + dx + ax, cz + dz + az
                if free(sx, y - 1, sz): bp.set(sx, y - 1, sz, SIGN, facing=d)
    for (x, z) in [ends[0]] + list(cells) + [ends[1]]:
        if cap and bp.get(x + dx, y + 2, z + dz)[0] == "keep": bp.set(x + dx, y + 2, z + dz, P["trim_slab"], half="top")
    if shutters:
        for (x, z) in ends:
            for j in range(2): bp.set(x + dx, y + j, z + dz, P["shutter"], facing=out, open=True)

def openings(bp):
    # door: jamb, door, jamb (front P1P3P1P, door bay x 3..5); lintel; canopy with brackets and one lantern
    bp.set(4, YF, D, P["door"], facing="s"); bp.set(4, YF + 1, D, P["door"], facing="s", upper=True)
    for x in (3, 4, 5): log(bp, x, YF + 2, D, "x")                      # lintel across the door bay; the bay's infill is the jamb
    for x in (3, 4, 5): bp.set(x, YF + 3, D + 1, P["trim"], facing="n")
    for x in (3, 5): bp.set(x, YF + 2, D + 1, P["bracket"], facing="n", half="top")
    bp.set(4, YF + 2, D + 1, "lantern", hanging=True)
    yg, yu = YF + 1, Y_UP + 2                                          # window bottoms: floor + 1
    # ground floor
    window(bp, [(1, D)], yg, "s"); window(bp, [(7, D)], yg, "s")
    window(bp, [(2, 0)], yg, "n", shutters=True); window(bp, [(6, 0)], yg, "n", shutters=True)
    for x, out in ((0, "w"), (W, "e")):
        window(bp, [(x, 2)], yg, out)
        window(bp, [(x, 6), (x, 7), (x, 8)], yg, out)
    # upper floor (jettied front z 11, back z -1)
    window(bp, [(1, D + 1)], yu, "s"); window(bp, [(7, D + 1)], yu, "s")
    window(bp, [(4, D + 1)], yu, "s")
    window(bp, [(2, -1)], yu, "n"); window(bp, [(6, -1)], yu, "n")
    for x, out in ((0, "w"), (W, "e")):
        for zc in (1, 5, 9): window(bp, [(x, zc)], yu, out)

# ---------------------------------------------------------------- stage 6: roof
def roof(bp, B):
    up = (0, -1, W, D + 1)
    B.roof(up, "z", Y_PLATE + 1, overhang=1, verge=1, pitch=1)
    B.build_roofs()
    B.gable_walls(up, "z", Y_PLATE + 1)
    for z in (-1, D + 1):                                              # the wall plate is the gable's bottom beam: no second beam on top of it
        for x in range(1, W):
            if x != 4 and bp.get(x, Y_PLATE + 1, z)[0] == P["frame"]: bp.set(x, Y_PLATE + 1, z, P["infill"])
    B.eaves(up, "z", Y_PLATE - 1)
    for z, out in ((D + 1, "s"), (-1, "n")):                           # gable windows on the centre line
        window(bp, [(4, z)], Y_PLATE + 2, out)
    # trusses: the upper rooms are open to the roof, so a tie beam and king post over each pair of side posts
    for z in (3, 7):
        for x in range(1, W): log(bp, x, Y_PLATE, z, "x")
        for y in range(Y_PLATE + 1, B.H[(4, z)][0]): log(bp, 4, y, z, "y")
        bp.set(1, Y_PLATE - 1, z, P["bracket"], facing="w", half="top"); bp.set(W - 1, Y_PLATE - 1, z, P["bracket"], facing="e", half="top")
        bp.set(3, Y_PLATE + 1, z, P["trim"], facing="e", half="top"); bp.set(5, Y_PLATE + 1, z, P["trim"], facing="w", half="top")
    # chimney through the ridge over the back hearth
    for y in range(YF, Y_UP + 1): bp.set(4, y, 1, P["chimney"])
    B.chimney(4, 1, Y_UP + 1)

# ---------------------------------------------------------------- stage 7: detailing
def detailing(bp):
    flowers = ["poppy", "cornflower", "dandelion", "azure_bluet", "oxeye_daisy"]
    for x in (0, 1, 2, 6, 7, 8):                                       # flower bed under the front windows
        bp.set(x, 0, D + 1, "grass_block"); bp.set(x, 1, D + 1, flowers[int(h3(x, 1, D, 5) * 5)])
    bp.set(6, 1, D + 2, "barrel", facing="up")                          # one prop by the door
    for x, z in ((-1, -1), (W + 1, -1)):                                # bushes at the back corners
        bp.set(x, 1, z, "azalea_leaves", persistent=True)
    bp.set(-1, 1, 0, "oak_leaves", persistent=True)

# ---------------------------------------------------------------- stage 8: interiors (empty: hidden light only)
def interiors(bp):
    bp.set(4, Y_UP - 2, 5, "lantern", hanging=True)                     # ground floor, hung from the middle joist
    for z in (3, 7): bp.set(4, Y_PLATE - 1, z, "lantern", hanging=True)  # upper floor, from the tie beams

STAGES = [("1-foundation", foundation), ("2-frame", frame), ("3-floors", floors), ("4-walls", walls),
          ("5-windows-and-doors", openings), ("6-roof", None), ("7-detailing", detailing), ("8-interiors", interiors)]

def build(upto=99):
    bp = Blueprint("test_house_vale"); B = Building(bp, P, 7)
    for i, (name, fn) in enumerate(STAGES):
        if i >= upto: break
        if fn is None: roof(bp, B)
        else: fn(bp)
    return bp.finish()

def scene_of(house):
    sc = Blueprint("scene")
    for x in range(-12, 21):
        for z in range(-12, 24):
            sc.set(x, -1, z, "dirt")
            road = 17 <= z <= 21
            sc.set(x, 0, z, mix([("grass_path", 50), ("gravel", 20), ("cobblestone", 15), ("coarse_dirt", 15)], 8)(x, 0, z)[0] if road else "grass_block")
    for x in (3, 4, 5):
        for z in range(D + 3, 17): sc.set(x, 0, z, mix([("grass_path", 60), ("gravel", 25), ("coarse_dirt", 15)], 9)(x, 0, z)[0])
    for (x, y, z), v in house.cells.items():
        if v[0] != "keep": sc.cells[(x, y, z)] = v
    # an oak tree in the back garden
    tx, tz = 14, 1
    for y in range(1, 7): sc.set(tx, y, tz, "oak_log", axis="y")
    for dx in range(-3, 4):
        for dy in range(-2, 3):
            for dz in range(-3, 4):
                if dx * dx + dz * dz + (dy * 1.4) ** 2 <= 9.5 + h3(tx + dx, dy, tz + dz, 3) * 3 and sc.get(tx + dx, 7 + dy, tz + dz)[0] == "keep":
                    sc.set(tx + dx, 7 + dy, tz + dz, "oak_leaves", persistent=True)
    return sc.finish()

if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("out"); ap.add_argument("--textures", required=True); ap.add_argument("--three", required=True)
    ap.add_argument("--stages", default="all"); ap.add_argument("--final-shots", default="front-left,front-right,high,street")
    a = ap.parse_args(); os.makedirs(a.out, exist_ok=True)
    want = range(1, len(STAGES) + 1) if a.stages == "all" else [int(s) for s in a.stages.split(",")]
    for n in want:
        house = build(n); sc = scene_of(house)
        sc.camera = {"views": {"front": [0, 8, 40, 4, 9, 5], "front-left": [-35, 20, 46, 4, 7, 5], "front-right": [35, 20, 46, 4, 7, 5], "high": [25, 50, 54, 4, 6, 5],
                               "street": [-18, 4, 30, 4, 7, 8], "back": [155, 20, 46, 4, 7, 5]}}
        name = STAGES[n - 1][0]
        sub = os.path.join(a.out, name); os.makedirs(sub, exist_ok=True)
        sc.save_logical(os.path.join(sub, "scene.json"))
        shots = "front," + a.final_shots + ",back" if n == len(STAGES) else "front-left"
        subprocess.run([sys.executable, os.path.join(HERE, "render", "render.py"), os.path.join(sub, "scene.json"), sub,
                        "--title", f"Test house, stage {name}", "--textures", a.textures, "--three", a.three, "--shots", shots], check=True)
    house = build()
    house.save_mcstructure(os.path.join(a.out, "test_house_vale.mcstructure"))
    house.save_json(os.path.join(a.out, "test_house_vale.stamp.json"))
