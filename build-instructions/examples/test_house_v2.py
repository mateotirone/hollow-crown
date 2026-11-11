"""Test house v2 (2026-11-11): the same Vale town house (9 x 11, two storeys, Kingsrest side street),
rebuilt with the rules Mateo added after v1:

- stone ground floor in the stone / spruce / dark oak pairing: slim 3-tall windows with upside-down stair
  heads, dark oak trapdoor panels between them, light dressed piers by the door, spruce lantern stand and
  a bush boxed in by signs at the foot (05-windows-and-doors, texturing Pairings)
- wall texture painted by the doctrine (texturing/doctrine.py paint: gradient + clusters, no skipped steps,
  cracks only round openings)
- beamed upper floor: logs flush with the floor, top slabs between (03-floors)
- arched supports of stairs, slabs and trapdoors under the jettied floor band (02-frame)
- close studding on the jettied fronts (one block log, one block white) and the add-on's Timber Frame
  blocks on the sides (04-walls)
- shutter dressing on the upper windows: single shutter, slab shelf with a lantern, hanging leaves, leaf
  boxes with signs (05)
- roof chosen from 06-roof/roof-types.md: span 9, run 13, side street -> gable, pitch 1, gable to the
  street; slate gradient tiles at the ridge to cobbled deepslate at the eaves; curled verges; lanterns on
  chains at the verge tips (07-detailing)
"""
import os, sys, argparse, subprocess
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
sys.path.insert(0, os.environ.get("DOCTRINE", "/home/user/hollow-crown/build-instructions/texturing"))
from bp import Blueprint
from kit import Building, VALE, mix, h3
from doctrine import paint

P = dict(VALE)
P.update(frame="spruce_log", infill="calcite", pane="brown_stained_glass_pane",
         floor_field="spruce_slab", floor_border="dark_oak_slab", trim="dark_oak_stairs", bracket="spruce_stairs")
LEAVES = mix([("azalea_leaves", 70), ("azalea_leaves_flowered", 30)], 12)
SIGN = "spruce_wall_sign"
PANEL = "dark_oak_trapdoor"
W, D = 8, 10
YF, Y_UP, Y_PLATE = 2, 7, 12
SIDE_POSTS_U = (-1, 3, 7, 11)
STAIR_X, STAIR_Z0, STAIR_Z1 = 7, 4, 9

def log(bp, x, y, z, axis="y", wood=None): bp.set(x, y, z, wood or P["frame"], axis=axis)

# ------------------------------------------------------------------ ground-floor stone, painted
STONE_LADDER = ["mossy_cobblestone", "cobblestone", "stone_bricks", "stone_bricks", "stone_bricks", "stone_bricks"]
OPENINGS = set()          # (x, y, z) of glass and door cells, filled by openings plan below

def faces():
    """The four ground walls as lists of (x, z) left to right seen from outside."""
    return {"s": [(x, D) for x in range(0, W + 1)], "n": [(x, 0) for x in range(W, -1, -1)],
            "e": [(W, z) for z in range(D, -1, -1)], "w": [(0, z) for z in range(0, D + 1)]}

def ground_plan():
    """Per face: which cells are windows, panels, piers, door. Slim windows 1 x 3, panels either side."""
    plan = {}
    plan["s"] = {2: "win", 6: "win", 1: "panel", 7: "panel", 3: "pier", 5: "pier", 4: "door"}
    plan["n"] = {2: "win", 6: "win", 1: "panel", 3: "panel", 5: "panel", 7: "panel"}
    side = {3: "win", 7: "win", 2: "panel", 4: "panel", 6: "panel", 8: "panel"}
    plan["e"] = {(D - z): v for z, v in side.items()}      # e runs z = D..0
    plan["w"] = dict(side)
    return plan

OUT = {"s": (0, 1), "n": (0, -1), "e": (1, 0), "w": (-1, 0)}

def stone_walls(bp):
    plan = ground_plan()
    for f, cells in faces().items():
        grid = paint(len(cells), 6, STONE_LADDER, seed=ord(f))          # rows y 1..6
        roles = plan[f]
        for i, (x, z) in enumerate(cells):
            # role by coordinate along the face
            k = x if f in "sn" else z
            role = roles.get(k)
            for row, y in enumerate(range(1, 7)):
                b = grid[row][i]
                near = any(roles.get(k + d) in ("win", "door") for d in (-1, 1))
                if b == "stone_bricks" and near and y >= 3 and h3(x, y, z, 31) < 0.35: b = "cracked_stone_bricks"
                if role == "pier" and y >= 2: b = "polished_andesite"
                bp.set(x, y, z, b)

# ------------------------------------------------------------------ stage 1
def foundation(bp):
    bp.fill(0, -3, 0, W, 0, D, P["found"])
    for x in range(1, W):
        for z in range(1, D): bp.set(x, 1, z, P["found"])
    for x in (3, 4, 5):
        bp.set(x, 1, D + 1, "stone_bricks")
        bp.set(x, 1, D + 2, "stone_brick_stairs", facing="n")

# ------------------------------------------------------------------ stage 2: frame (stone below, timber above)
def frame(bp):
    stone_walls(bp)
    # floor band y 7, jettied front and back (z -1..11)
    for x in range(0, W + 1):
        for z in (-1, D + 1): log(bp, x, Y_UP, z, "x")
    for z in range(-1, D + 2):
        for x in (0, W): log(bp, x, Y_UP, z, "z")
    for z in (2, 5, 8):                                    # beam ends of the beamed floor show in the band
        for x in (0, W): log(bp, x, Y_UP, z, "x")
    for x, z in ((0, -1), (W, -1), (0, D + 1), (W, D + 1)): log(bp, x, Y_UP, z, "y")   # corner uprights
    # arched supports under the jettied band: stair at the posts, slab, trapdoor at mid-bay (02-frame)
    for z, out, back in ((D + 1, "s", "n"), (-1, "n", "s")):
        for x in range(0, W + 1):
            k = x % 4
            if k == 0: bp.set(x, Y_UP - 1, z, P["bracket"], facing=back, half="top")
            elif k in (1, 3): bp.set(x, Y_UP - 1, z, "spruce_slab", half="top")
            else: bp.set(x, Y_UP - 1, z, "spruce_trapdoor", facing=out, half="top")
    # upper storey: close studding on the jettied fronts, posts on the sides, wall plate
    for y in range(Y_UP + 1, Y_PLATE):
        for z in (-1, D + 1):
            for x in range(0, W + 1, 2): log(bp, x, y, z)
        for z in SIDE_POSTS_U:
            for x in (0, W): log(bp, x, y, z)
    for x in range(0, W + 1):
        for z in (-1, D + 1): log(bp, x, Y_PLATE, z, "x")
    for z in range(-1, D + 2):
        for x in (0, W): log(bp, x, Y_PLATE, z, "z")

# ------------------------------------------------------------------ stage 3: floors (beamed upper floor)
def floors(bp):
    def lay(y, x0, z0, x1, z1):
        for x in range(x0, x1 + 1):
            for z in range(z0, z1 + 1):
                border = x in (x0, x1) or z in (z0, z1)
                bp.set(x, y, z, P["floor_border"] if border else P["floor_field"], half="top")
    lay(1, 1, 1, W - 1, D - 1)
    bp.set(4, 1, D, "dark_oak_planks")
    lay(Y_UP, 1, 0, W - 1, D)
    for z in (2, 5, 8):                                    # beams flush with the floor, slabs between
        for x in range(1, W):
            if not (x == STAIR_X and STAIR_Z0 <= z <= STAIR_Z1): log(bp, x, Y_UP, z, "x")
    for k in range(6):
        z, y = STAIR_Z1 - k, YF + k
        bp.set(STAIR_X, y, z, "spruce_stairs", facing="n")
        for yy in range(YF, y): bp.set(STAIR_X, yy, z, "spruce_planks")
    for z in range(STAIR_Z0 + 1, STAIR_Z1 + 1): bp.set(STAIR_X, Y_UP, z, "air")
    for z in range(STAIR_Z0 + 1, STAIR_Z1 + 1): bp.set(STAIR_X - 1, Y_UP + 1, z, P["fence"])
    bp.set(STAIR_X, Y_UP + 1, STAIR_Z1 + 1, P["fence"])

# ------------------------------------------------------------------ stage 4: upper walls
def walls(bp):
    for y in range(Y_UP + 1, Y_PLATE):
        for z in (-1, D + 1):                              # close studding: white between the posts
            for x in range(1, W, 2): bp.set(x, y, z, P["infill"])
        for x in (0, W):                                   # sides: the add-on's Timber Frame blocks
            for z in range(-1, D + 2):
                if bp.get(x, y, z)[0] == "keep": bp.set(x, y, z, "siege:timber_frame")

# ------------------------------------------------------------------ stage 5: windows and doors
def ground_openings(bp):
    plan = ground_plan()
    for f, cells in faces().items():
        dx, dz = OUT[f]; back = {"s": "n", "n": "s", "e": "w", "w": "e"}[f]
        for (x, z) in cells:
            k = x if f in "sn" else z
            role = plan[f].get(k)
            if role == "win":
                for y in (3, 4, 5): bp.set(x, y, z, P["pane"])
                bp.set(x, 6, z, "stone_brick_stairs", facing=back, half="top")       # stair head
            elif role == "panel":
                for y in (3, 4, 5): bp.set(x + dx, y, z + dz, PANEL, facing=f, open=True)
            elif role == "door":
                bp.set(x, YF, z, P["door"], facing=f); bp.set(x, YF + 1, z, P["door"], facing=f, upper=True)
                bp.set(x, YF + 2, z, "stone_brick_stairs", facing=back, half="top")
                bp.set(x, YF + 3, z, "polished_andesite")

def leaf_box(bp, cells, y, out):
    dx, dz = OUT[out]
    along = (1, 0) if out in "ns" else (0, 1)
    free = lambda x, yy, z: bp.get(x, yy, z)[0] == "keep"
    for (x, z) in cells:
        bp.set(x + dx, y, z + dz, LEAVES(x, y, z)[0], persistent=True)
        if free(x + 2 * dx, y, z + 2 * dz): bp.set(x + 2 * dx, y, z + 2 * dz, SIGN, facing=out)
    ends = sorted(cells, key=lambda c: c[0] * along[0] + c[1] * along[1])
    for (cx, cz), d, (ax, az) in ((ends[0], "w" if along == (1, 0) else "n", (-along[0], -along[1])),
                                   (ends[-1], "e" if along == (1, 0) else "s", along)):
        if free(cx + dx + ax, y, cz + dz + az): bp.set(cx + dx + ax, y, cz + dz + az, SIGN, facing=d)

def upper_window(bp, x, z, out, dress):
    """2-tall window at y 9..10 in a white column, with one dressing (05: shutter dressing)."""
    dx, dz = OUT[out]
    for y in (9, 10): bp.set(x, y, z, P["pane"])
    sx, sz = x + dx, z + dz
    if dress in ("shelf", "lantern", "leaves"):
        bp.set(sx, 8, sz, "spruce_slab", half="top")
        if dress == "lantern": bp.set(sx, 9, sz, "lantern")
        if dress == "leaves":
            bp.set(sx, 7, sz, LEAVES(x, 7, z)[0], persistent=True)
        # single shutter on the outer side
        along = (1, 0) if out in "ns" else (0, 1)
        side = -1 if (x * along[0] + z * along[1]) < (W // 2 if out in "ns" else D // 2) else 1
        for y in (9, 10): bp.set(sx + side * along[0], y, sz + side * along[1], PANEL, facing=out, open=True)
    elif dress == "box":
        leaf_box(bp, [(x, z)], 8, out)

def openings(bp):
    ground_openings(bp)
    # front (z 11) and back (z -1): windows in the white columns
    upper_window(bp, 1, D + 1, "s", "lantern"); upper_window(bp, 7, D + 1, "s", "leaves")
    upper_window(bp, 3, -1, "n", "box"); upper_window(bp, 5, -1, "n", "box")
    for x, out in ((0, "w"), (W, "e")):
        for zc, dress in ((1, "box"), (5, "lantern" if out == "w" else "leaves"), (9, "box")):
            upper_window(bp, x, zc, out, dress)
            bp.set(x, 8, zc, "siege:timber_frame_cross")

# ------------------------------------------------------------------ stage 6: roof
def slate(x, y, z):
    """Slate gradient: tiles at the ridge, bricks, cobbled deepslate at the eaves; dithered band edges."""
    t = (y - (Y_PLATE)) / 6.0 + (h3(x, y, z, 77) - 0.5) * 0.16
    n = "cobbled_deepslate_stairs" if t < 0.3 else "deepslate_brick_stairs" if t < 0.55 else "deepslate_tile_stairs"
    return n, {}

def roof(bp, B):
    up = (0, -1, W, D + 1)
    B.roof(up, "z", Y_PLATE + 1, overhang=1, verge=1, pitch=1, mats={"roof": slate})
    B.build_roofs()
    B.gable_walls(up, "z", Y_PLATE + 1)
    for z in (-1, D + 1):                                  # close studding carried up the gable
        for x in range(1, W):
            for y in range(Y_PLATE + 1, B.H[(x, z)][0]):
                if bp.get(x, y, z)[0] in (P["frame"], P["infill"]):
                    if x % 2 == 0: log(bp, x, y, z)
                    else: bp.set(x, y, z, P["infill"])
        out = "s" if z > 0 else "n"
        for x in (3, 5): bp.set(x, Y_PLATE + 2, z, P["pane"])
    B.eaves(up, "z", Y_PLATE - 1)
    # curled verges: at the foot of each verge an upside-down stair one up and one out
    base = Y_PLATE                                          # lowest roof row
    for z in (-2, D + 2):
        for x in (-1, W + 1):                               # lanterns on chains at the verge tips
            bp.set(x, base - 1, z, "iron_chain"); bp.set(x, base - 2, z, "lantern", hanging=True)
    for z in (3, 7):                                        # trusses over the open upper rooms
        for x in range(1, W): log(bp, x, Y_PLATE, z, "x")
        for y in range(Y_PLATE + 1, B.H[(4, z)][0]): log(bp, 4, y, z)
        bp.set(3, Y_PLATE + 1, z, P["trim"], facing="e", half="top"); bp.set(5, Y_PLATE + 1, z, P["trim"], facing="w", half="top")
    for y in range(YF, Y_UP + 1): bp.set(4, y, 1, P["chimney"])
    top = B.chimney(4, 1, Y_UP + 1)
    # chimney top (06-roof): signs round the last stone block, trapdoors round the campfire, a pot on top
    bp.set(4, top + 1, 1, "campfire")
    for d, (dx, dz) in {"s": (0, 1), "n": (0, -1), "e": (1, 0), "w": (-1, 0)}.items():
        bp.set(4 + dx, top, 1 + dz, SIGN, facing=d)
        bp.set(4 + dx, top + 1, 1 + dz, "spruce_trapdoor", facing=d, open=True)
    bp.set(4, top + 2, 1, "flower_pot")

# ------------------------------------------------------------------ stage 7: detailing
def detailing(bp):
    bp.set(2, 1, D + 1, "spruce_slab", half="top"); bp.set(2, 2, D + 1, "lantern")      # spruce lantern stand
    leaf_box(bp, [(6, D), (7, D)], 1, "s")                                                # the bush held in by signs
    for x in (0, 1):
        bp.set(x, 1, D + 1, ["poppy", "cornflower"][x])
    for x, z in ((-1, -1), (W + 1, -1)): bp.set(x, 1, z, "azalea_leaves", persistent=True)
    leaf_box(bp, [(2, 0)], 1, "n"); leaf_box(bp, [(6, 0)], 1, "n")

def interiors(bp):
    bp.set(4, Y_UP - 1, 4, "lantern", hanging=True)
    for z in (3, 7): bp.set(4, Y_PLATE - 1, z, "lantern", hanging=True)

STAGES = [("1-foundation", foundation), ("2-frame", frame), ("3-floors", floors), ("4-walls", walls),
          ("5-windows-and-doors", openings), ("6-roof", None), ("7-detailing", detailing), ("8-interiors", interiors)]

def build(upto=99):
    bp = Blueprint("test_house_vale_v2"); B = Building(bp, P, 7)
    for i, (name, fn) in enumerate(STAGES):
        if i >= upto: break
        if fn is None: roof(bp, B)
        else: fn(bp)
    return bp.finish()

if __name__ == "__main__":
    from test_house import scene_of
    ap = argparse.ArgumentParser(); ap.add_argument("out"); ap.add_argument("--textures", required=True); ap.add_argument("--three", required=True)
    ap.add_argument("--stages", default="8"); ap.add_argument("--shots", default="front,front-left,front-right,high,street,back")
    a = ap.parse_args(); os.makedirs(a.out, exist_ok=True)
    for n in [int(s) for s in a.stages.split(",")]:
        house = build(n); sc = scene_of(house)
        sc.camera = {"views": {"front": [0, 8, 40, 4, 9, 5], "front-left": [-35, 20, 46, 4, 7, 5], "front-right": [35, 20, 46, 4, 7, 5],
                               "high": [25, 50, 54, 4, 6, 5], "street": [-18, 4, 30, 4, 7, 8], "back": [155, 20, 46, 4, 7, 5],
                               "close": [-20, 10, 24, 4, 6, 9], "chim": [-30, 25, 22, 4, 18, 1]}}
        sub = os.path.join(a.out, STAGES[n - 1][0]); os.makedirs(sub, exist_ok=True)
        sc.save_logical(os.path.join(sub, "scene.json"))
        shots = a.shots if n == len(STAGES) else "front-left"
        subprocess.run([sys.executable, os.path.join(HERE, "render", "render.py"), os.path.join(sub, "scene.json"), sub,
                        "--title", f"Test house v2, stage {STAGES[n - 1][0]}", "--textures", a.textures, "--three", a.three, "--shots", shots], check=True)
    house = build()
    house.save_mcstructure(os.path.join(a.out, "test_house_vale_v2.mcstructure"))
    house.save_json(os.path.join(a.out, "test_house_vale_v2.stamp.json"))
