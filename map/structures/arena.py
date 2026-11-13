"""The grand arena at Kingsrest (Mateo, 2026-11-13): twelve starting rooms in the twelve settlement colours round
one fighting floor, so two kings can fight one against one, three at once, six against six or all twelve. Name
not chosen yet (NAME below; "Colosseum" was only Mateo's example).

Where: the open meadow south-west of Kingsrest's grand station, between the Bay Line and the Fen Line, on the
station's side of the rails (CENTRE). A paved processional way runs from the station's south door down to the
forecourt and the gatehouse, which faces the station. The land round it is solved by the shared terraform pass.

The plan (local coordinates, x east, z south, y 0 = the arena floor; every size odd):
  floor      an octagon, ring_norm(x, z, 18) <= 30: 61 across, the diagonal faces cut 18 in from the corners.
             Sand, a medallion in the middle with a wedge of each room's colour pointing at its gate, and lights
             set flush in the floor (nothing standing on it: mobs and fighters need the room).
  rooms      12 starting rooms, 3 on each straight side, 9 x 9 x 5 inside (room for a team of 6), in the podium
             under the stands. Each has a 3 x 3 gate onto the floor (iron bars the fight code lifts row by row),
             its colour in the floor, a band round the walls, a hanging over the board and a panel over the gate,
             the default loadout on racks, the board (a lectern) where fighters pick a loadout and start, and a
             door at the back to the inner corridor.
  stands     21 rows rising one up and one out from the podium (the skill's `stands` part), a walkway between
             the tiers, a promenade along the top, and the royal box on the north side.
  shell      a square Norman shell 115 across: a plinth, pilasters, an open arcade on the ground storey with an
             ambulatory behind it, a gallery storey with open arches, lancets above, string courses, a cornice and
             battlements; turrets with copper cones on the four outer corners.
  towers     four stair towers in the corners (13 wide, a square spiral of 27 steps round a solid core up to the
             promenade, a lookout room, an open belfry stage) under copper domes.
  gatehouse  on the north side facing the station: the entrance hall with the two challenge boards ("Challenge a
             king", "Fight a beast") and the roll of the twelve colours, flanked by two round towers with copper
             cones; a forecourt and lamps in front.

    python3 arena.py OUT [--no-ground]     # OUT/arena/scene.json (with the terraformed ground), names.json
    python3 arena.py OUT --bake            # also map/arena-blocks.json (world blocks for genworld) and map/arena-layout.json
    python3 arena.py OUT --viewer DIR --textures <bedrock-samples>/resource_pack/textures/blocks   # the hosted 3D page

Everything is built by the one building engine (the skill: engine.into_blueprint), the ground by terraform.py.
"""
import json, math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(REPO, ".claude", "skills", "minecraft-builder", "scripts"))
import engine  # noqa: E402
from bp import Blueprint  # noqa: E402
from parts import ring_norm  # noqa: E402

NAME = None                      # Mateo picks the name (offered: the King's Ring, the Crown Lists, the Tourney of Kings ...)
CENTRE = (-190, 50)              # world x, z of the floor centre
CH = 18                          # the octagon's corner cut
FLOOR, WALL = 30, 31             # floor rings 0..30, the podium wall on ring 31
ROOM0, ROOM1, BACK = 32, 40, 41  # room insides on rings 32..40, back wall 41
CORR0, CORR1 = 42, 44            # the inner corridor
S_OUT = 57                       # the shell's outer face (square ring)
AMB0, AMB1 = 51, 55              # the outer ambulatory (square rings), behind the ground arcade
GAL_FLOOR = 10                   # the gallery storey's floor
TOP = 27                         # the promenade and corner terraces (top block)
OFFS = (-12, 0, 12)              # room centres along each straight side
BAYS = list(range(-40, 41, 8))   # shell bay centres along each face (arches), piers between them

# The twelve colours, clockwise from the middle of the north side (agreed with the fight code, arena/layout.js)
COLOURS = ["red", "orange", "yellow", "lime", "green", "cyan", "light_blue", "blue", "purple", "magenta", "pink", "white"]
SIDE_ORDER = [("n", 0), ("n", 12), ("e", -12), ("e", 0), ("e", 12), ("s", -12), ("s", 0), ("s", 12), ("w", -12), ("w", 0), ("w", 12), ("n", -12)]

# ---- turning a design drawn on the north side (outward = -z) to the other sides
TURN = {"n": lambda x, z: (x, z), "e": lambda x, z: (-z, x), "s": lambda x, z: (-x, -z), "w": lambda x, z: (z, -x)}
FACE_TURN = {"n": {}, "e": {"n": "e", "e": "s", "s": "w", "w": "n"}, "s": {"n": "s", "s": "n", "e": "w", "w": "e"},
             "w": {"n": "w", "w": "s", "s": "e", "e": "n"}}
# the four corners: a design drawn in the south-east corner (x, z > 0) turned clockwise
CORNER = {"se": "n", "sw": "e", "nw": "s", "ne": "w"}


def turned(side, x, y, z, b, p=None):
    tx, tz = TURN[side](x, z)
    p = dict(p or {})
    if "facing" in p: p["facing"] = FACE_TURN[side].get(p["facing"], p["facing"])
    if p.get("axis") in ("x", "z") and side in "ew": p["axis"] = "z" if p["axis"] == "x" else "x"
    return [tx, y, tz, b] + ([p] if p else [])


def h3(x, y, z, s=0):
    v = math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + s * 4.581) * 43758.5453
    return v - math.floor(v)


def pick(table, x, y, z, s=0):
    t = h3(x, y, z, s) * sum(w for _, w in table)
    for b, w in table:
        t -= w
        if t < 0: return b
    return table[-1][0]


def val01(x, y, z):
    """The Vale stone ladder VAL-01 (texturing/regions/vale.md), darker at the foot, dithered between steps."""
    L = ["tuff_bricks", "cobblestone", "stone", "andesite"]
    f = min(0.999, max(0.0, y / 32 + (h3(x, y, z, 11) - 0.5) * 0.18))
    return L[int(f * len(L))]


class Plan:
    """Collects the spec (shapes, parts, place) and the layout the fight code needs."""

    def __init__(self):
        self.shapes, self.parts, self.place = [], [], []
        self.lay = {"rooms": [], "seats": []}

    def put(self, x, y, z, b, **p):
        self.place.append([x, y, z, b] + ([p] if p else []))

    def air(self, x, y, z): self.put(x, y, z, "air")

    def side_put(self, side, x, y, z, b, **p):
        self.place.append(turned(side, x, y, z, b, p))

    def box(self, x0, y0, z0, x1, y1, z1, b, **p):
        for x in range(min(x0, x1), max(x0, x1) + 1):
            for y in range(min(y0, y1), max(y0, y1) + 1):
                for z in range(min(z0, z1), max(z0, z1) + 1): self.put(x, y, z, b, **p)


# ------------------------------------------------------------------------------------------------ the design
def spec():
    P = Plan()
    mats = {"shell": {"ladder": "VAL-01", "axis": "y"},
            "copper": {"ladder": ["waxed_oxidized_cut_copper", "waxed_weathered_cut_copper", "waxed_exposed_cut_copper"], "axis": "y", "reverse": True}}

    # 1 the stands, with the podium and the corner masses under them (foundation stage of the stands part)
    P.parts.append({"part": "stands", "name": "stands", "at": [0, 0], "chamfer": CH, "from": ROOM0, "to": 56, "y": 7,
                    "walk": [42, 43, 55, 56], "seat": "stone_bricks", "aisle": "polished_andesite", "aisle_every": 6,
                    "fill": "stone_bricks", "base": 0, "skip": [[-8, -50, 8, -41]],
                    "band": {"every": 4, "material": "polished_andesite"}})
    # 2 the shell, as shapes: four faces of the square, the arches cut out of them
    sh = P.shapes
    for side in "nesw":
        a = TURN[side]
        x0, z0 = a(-S_OUT, -S_OUT); x1, z1 = a(S_OUT, -(S_OUT - 1))
        sh.append({"shape": "box", "min": [min(x0, x1), 0, min(z0, z1)], "max": [max(x0, x1), 31, max(z0, z1)], "material": "shell"})
    for side in "nesw":
        axis = "x" if side in "ns" else "z"
        for t in BAYS:
            gate = side == "n" and abs(t) <= 8           # the gatehouse stands in front of these bays
            ax_, az_ = TURN[side](t, -(S_OUT - 1))
            if not gate:
                sh.append({"op": "sub", "shape": "arch", "at": [ax_, 1, az_], "width": 5, "height": 7, "depth": 3, "axis": axis})
            sh.append({"op": "sub", "shape": "arch", "at": [ax_, GAL_FLOOR + 1, az_], "width": 3, "height": 5, "depth": 3, "axis": axis})
    shell_details(P)
    for side in "esw":
        frontispiece(P, side)

    # 3 the corner masses and towers
    for corner, side in CORNER.items():
        corner_mass(P, side)
    # 4 the floor, podium, rooms, corridor, ambulatory, galleries
    floor(P)
    podium(P)
    for k, (side, c) in enumerate(SIDE_ORDER):
        room(P, k, side, c)
    corridors(P)
    royal_box(P)
    for corner, side in CORNER.items():
        stair_tower(P, corner, side)
    gatehouse(P)
    return {"name": "arena_kingsrest", "edition": "bedrock", "materials": mats, "shapes": P.shapes, "parts": P.parts,
            "place": P.place, "hollow": 0, "quality": 2}, P


def shell_details(P):
    """Plinth, pilasters, string courses, cornice, battlements and the attic windows, on all four faces."""
    for side in "nesw":
        for t in range(-S_OUT - 1, S_OUT + 2):
            for y in (0, 1):                                            # 01: a two-course plinth one out
                b = "mossy_cobblestone" if y == 0 and h3(t, y, ord(side)) < 0.5 else "cobblestone"
                P.side_put(side, t, y, -(S_OUT + 1), b)
            for y in (9, 18):                                           # 07: string courses one out
                P.side_put(side, t, y, -(S_OUT + 1), "stone_brick_stairs", facing="s", half="top")
            P.side_put(side, t, 31, -(S_OUT + 1), "polished_andesite_stairs", facing="s", half="top")   # cornice
            if abs(t) <= S_OUT:
                P.side_put(side, t, 32, -S_OUT, "stone_bricks")                                   # parapet
                if t % 2 == 0 or abs(t) == S_OUT: P.side_put(side, t, 33, -S_OUT, "stone_bricks")  # merlons
                if t % 2 == 0: P.side_put(side, t, 34, -S_OUT, "stone_brick_slab", half="bottom")
            P.side_put(side, t, 32, -(S_OUT - 1), "stone_bricks")                                  # the wall walk
        for t in BAYS:
            for p_ in (t - 4, t + 4):                                   # pilasters on the piers, 1 out
                if abs(p_) > 44: continue
                for y in range(2, 31):
                    if y in (9, 18): continue
                    P.side_put(side, p_, y, -(S_OUT + 1), "polished_andesite" if y % 6 in (0, 1, 2) else "stone_bricks")
                P.side_put(side, p_, 9, -(S_OUT + 2), "stone_brick_stairs", facing="s", half="top")
                P.side_put(side, p_, 18, -(S_OUT + 2), "stone_brick_stairs", facing="s", half="top")
            for y in (20, 21, 22):                                      # lancets on the third storey
                P.side_put(side, t, y, -S_OUT, "light_gray_stained_glass_pane")
            P.side_put(side, t, 19, -(S_OUT + 1), "stone_brick_stairs", facing="n", half="bottom")   # its sill
            P.side_put(side, t, 23, -S_OUT, "chiseled_stone_bricks")
            for dx in (-1, 0, 1):                                       # attic windows over the promenade
                for y in (28, 29): P.side_put(side, t + dx, y, -S_OUT, "air"); P.side_put(side, t + dx, y, -(S_OUT - 1), "air")
                P.side_put(side, t + dx, 30, -S_OUT, "polished_andesite")
            for dx in (-1, 0, 1):                                       # gallery arch balustrade
                P.side_put(side, t + dx, GAL_FLOOR + 1, -S_OUT, "stone_brick_wall")
            k = (BAYS.index(t) + "nesw".index(side) * 3) % 12           # a pennant of the twelve colours over every bay
            for y in range(34, 39): P.side_put(side, t, y, -S_OUT, "dark_oak_fence")
            for (dx, y) in ((1, 38), (2, 38), (1, 37), (1, 36), (2, 37), (3, 38)):
                P.side_put(side, t + dx, y, -S_OUT, COLOURS[k] + "_wool")
            if not (side == "n" and abs(t) <= 8):                       # a lantern in the crown of every ground arch
                P.side_put(side, t, 7, -(S_OUT - 1), "iron_chain", axis="y")
                P.side_put(side, t, 6, -(S_OUT - 1), "lantern", hanging=True)


def frontispiece(P, side):
    """The middle of the east, south and west faces: a bay 11 wide standing 2 out, a taller entrance arch (7 wide,
    9 high) into the ambulatory, and a stone gable over the battlements with a round window of the twelve colours."""
    S = lambda x, y, z, b, **p: P.side_put(side, x, y, z, b, **p)
    F = -(S_OUT + 2)
    for t in range(-5, 6):
        for d in (S_OUT, S_OUT + 1, S_OUT + 2):
            for y in range(0, 33):
                S(t, y, -d, "polished_andesite" if abs(t) == 5 and y % 3 != 2 else "stone_bricks" if abs(t) == 5 else
                  ("cobblestone" if y < 2 else val01(t, y, d)))
    for t in range(-6, 7):                                       # courses wrap the bay
        S(t, 9, F - 1, "stone_brick_stairs", facing="s", half="top"); S(t, 18, F - 1, "stone_brick_stairs", facing="s", half="top")
        S(t, 31, F - 1, "polished_andesite_stairs", facing="s", half="top")
    for t in range(-3, 4):                                        # the entrance arch, through to the ambulatory
        top = 9 if abs(t) <= 1 else 8 if abs(t) == 2 else 7
        for d in range(S_OUT - 1, S_OUT + 3):
            for y in range(1, top + 1): S(t, y, -d, "air")
            S(t, 0, -d, "polished_andesite")
        S(t, top + 1, F, "polished_andesite" if abs(t) != 0 else "chiseled_stone_bricks")
    for t in (-3, 3): S(t, 8, F, "stone_brick_stairs", facing="e" if t < 0 else "w", half="top")
    for t in (-2, 2): S(t, 9, F, "stone_brick_stairs", facing="e" if t < 0 else "w", half="top")
    for y in range(11, 16):                                       # the gallery window over it
        for t in (-1, 0, 1): S(t, y, F, "air" if y > 11 else "stone_brick_wall"); S(t, y, F + 1, "air"); S(t, y, F + 2, "air")
    for k in range(6):                                            # the gable over the battlements
        y = 32 + k
        for t in range(-5 + k, 6 - k):
            S(t, y, F, "stone_bricks"); S(t, y, F + 1, "stone_bricks")
        for t in (-6 + k, 6 - k):
            S(t, y, F, "polished_andesite_stairs", facing="e" if t < 0 else "w")
    S(0, 38, F, "polished_andesite"); S(0, 39, F, "siege:spire_roof")
    ring = [(0, 3), (1, 3), (2, 2), (3, 1), (3, 0), (3, -1), (2, -2), (1, -3), (0, -3), (-1, -3), (-2, -2), (-3, -1), (-3, 0), (-3, 1), (-2, 2), (-1, 3)]
    for i, (t, dy) in enumerate(ring):                             # the round window in the shell's face, mid storey 3
        S(t, 22 + dy, F, COLOURS[(i * 3 // 4) % 12] + "_stained_glass")
    for t in (-2, -1, 0, 1, 2):
        for dy in (-2, -1, 0, 1, 2):
            if abs(t) + abs(dy) <= 3 and not (abs(t) == 2 and abs(dy) == 2): S(t, 22 + dy, F, "white_stained_glass" if (t, dy) != (0, 0) else "yellow_stained_glass")


def corner_mass(P, side):
    """The corners between the octagonal stands and the square shell: solid to the terrace at TOP, paved."""
    for x in range(1, S_OUT):
        for z in range(1, S_OUT):
            if ring_norm(x, z, CH) <= 56 or max(x, z) > S_OUT - 1: continue
            tx, tz = TURN[side](x, z)
            for y in range(0, TOP):
                P.put(tx, y, tz, "stone_bricks")
            P.put(tx, TOP, tz, "polished_andesite" if (x + z) % 4 == 0 else "stone_bricks")


def floor(P):
    gates, gate_out = [], []
    for side, c in SIDE_ORDER:
        gx, gz = TURN[side](c, -WALL)
        gates.append(math.atan2(gz, gx)); gate_out.append(TURN[side](c, -(WALL - 1)))
    for x in range(-FLOOR, FLOOR + 1):
        for z in range(-FLOOR, FLOOR + 1):
            if ring_norm(x, z, CH) > FLOOR: continue
            r = math.hypot(x, z)
            a = math.atan2(z, x)
            k = min(range(12), key=lambda i: abs(math.atan2(math.sin(a - gates[i]), math.cos(a - gates[i]))))
            for y in (-1, -2): P.put(x, y, z, "stone")
            near_gate = min(math.hypot(x - g[0], z - g[1]) for g in gate_out) < 3.2
            if r < 1.5: b = "ochre_froglight" if (x, z) == (0, 0) else "chiseled_stone_bricks"
            elif r < 2.5: b = "polished_andesite"
            elif r < 7.6: b = COLOURS[k] + "_concrete"
            elif r < 9.0: b = "polished_andesite"
            elif r < 9.7: b = "stone_bricks"
            elif near_gate: b = pick([("coarse_dirt", 2), ("sand", 3), ("gravel", 1)], x, 0, z, 4)   # worn at the gates
            else:
                b = pick([("sand", 90), ("smooth_sandstone", 5), ("sandstone", 5)], x, 0, z, 3)
            P.put(x, 0, z, b)
    for k, (side, c) in enumerate(SIDE_ORDER):          # lights flush in the floor, pointing at each gate
        gx, gz = TURN[side](c, -WALL)
        d = math.hypot(gx, gz)
        for r in (14, 23):
            P.put(round(gx * r / d), 0, round(gz * r / d), "ochre_froglight")


def podium(P):
    """The arena wall on ring 31: stone with a mossy foot, a polished cap, a parapet of wall posts with lanterns."""
    n = WALL
    for x in range(-n, n + 1):
        for z in range(-n, n + 1):
            if ring_norm(x, z, CH) != n: continue
            for y in range(0, 8):
                b = "mossy_stone_bricks" if y == 1 and h3(x, y, z, 5) < 0.5 else "polished_andesite" if y == 7 else "stone_bricks"
                P.put(x, y, z, b)
            P.put(x, 8, z, "stone_brick_wall")
            if (x + z) % 4 == 0: P.put(x, 9, z, "lantern")


def room(P, k, side, c):
    """One starting room, drawn on the north side (outward -z) and turned. Insides x c-4..c+4, z -40..-32."""
    col = COLOURS[k]
    S = lambda x, y, z, b, **p: P.side_put(side, x, y, z, b, **p)
    for x in range(c - 4, c + 5):
        for z in range(-ROOM1, -ROOM0 + 1):
            edge = x in (c - 4, c + 4) or z in (-ROOM1, -ROOM0)
            S(x, -1, z, "stone"); S(x, -2, z, "stone")             # solid under the floor (the fight code's locker)
            S(x, 0, z, col + "_concrete" if abs(x - c) <= 1 and abs(z + 36) <= 1 else
              "polished_andesite" if abs(x - c) <= 2 and abs(z + 36) <= 2 else "stone_bricks")
            for y in range(1, 6): S(x, y, z, "air")
    for z in range(-BACK, -WALL + 1):                       # the colour band round the walls, inside
        for x in (c - 5, c + 5): S(x, 4, z, col + "_terracotta" if col != "white" else "white_terracotta")
    for x in range(c - 5, c + 6):
        S(x, 4, -BACK, col + "_terracotta")
    # the gate: a Vale portcullis 3 wide x 4 high in the arena wall (it rises like the castle gate: the fight code
    # opens and shuts it with setGate), a dressed arch round it, the colour panel over it
    for dx in (-1, 0, 1):
        for y in range(1, 5): S(c + dx, y, -WALL, "siege:portcullis", facing="n")
    for y in range(1, 6):
        for dx in (-2, 2): S(c + dx, y, -WALL, "polished_andesite")
    S(c - 1, 5, -WALL, "stone_brick_stairs", facing="w", half="top")
    S(c + 1, 5, -WALL, "stone_brick_stairs", facing="e", half="top")
    S(c, 5, -WALL, "chiseled_stone_bricks")
    for dx in (-1, 0, 1):
        for y in (6, 7): S(c + dx, y, -WALL, col + "_wool")
    for dx in (-3, 3):                                      # lanterns on ledges either side, on the arena face
        S(c + dx, 4, -(WALL - 1), "stone_brick_slab", half="top")
        S(c + dx, 5, -(WALL - 1), "lantern")
    # the board: a lectern facing the gate under the room's hanging; the back door to the corridor
    S(c, 1, -(ROOM1), "lectern", facing="s")
    for dx in (-1, 0, 1):
        for y in (2, 3): S(c + dx, y, -BACK, col + "_wool")
    S(c, 1, -BACK, col + "_wool")
    S(c + 3, 1, -BACK, "spruce_door", facing="s", hinge=False, upper=False)
    S(c + 3, 2, -BACK, "spruce_door", facing="s", hinge=False, upper=True)
    # the default loadout on racks: west wall weapon racks (empty frames over barrels), east wall the armoury
    for z in (-39, -37, -35, -33):
        S(c - 4, 1, z, "barrel")
        S(c - 4, 2, z, "frame", facing="e")
        S(c - 4, 3, z, "frame", facing="e")
    for z, b in ((-39, "grindstone"), (-37, "smithing_table"), (-35, "anvil"), (-33, "chest")):
        S(c + 4, 1, z, b, facing="w")
    for z in (-38, -36, -34):
        S(c + 4, 1, z, "spruce_stairs", facing="e")         # benches along the armoury wall
    for dx, dz in ((-2, -38), (2, -38), (-2, -34), (2, -34)):
        S(c + dx, 5, dz, "lantern", hanging=True)
    # what the fight code needs (world-relative to the floor centre, turned)
    sx, sz = TURN[side](c, -36); ox, oz = TURN[side](c, -(WALL - 2)); bx, bz = TURN[side](c, -ROOM1)
    g0 = TURN[side](c - 1, -WALL); g1 = TURN[side](c + 1, -WALL)
    P.lay["rooms"].append({"color": col, "side": side, "spawn": [sx, 1, sz], "board": [bx, 1, bz], "out": [ox, 1, oz],
                           "gate": {"from": [min(g0[0], g1[0]), 1, min(g0[1], g1[1])], "to": [max(g0[0], g1[0]), 4, max(g0[1], g1[1])]},
                           "door": list(TURN[side](c + 3, -BACK))})


def corridors(P):
    """The inner corridor behind the rooms, the passages out on the four axes, the outer ambulatory behind the
    ground arcade and the gallery storey above it, with the flights between them. Lit."""
    for x in range(-AMB1, AMB1 + 1):
        for z in range(-AMB1, AMB1 + 1):
            n = ring_norm(x, z, CH); s = max(abs(x), abs(z))
            if CORR0 <= n <= CORR1:
                P.put(x, 0, z, "polished_andesite" if n == 43 else "stone_bricks")
                for y in range(1, 6): P.air(x, y, z)
                if n == 43 and (x if abs(z) >= abs(x) else z) % 6 == 3:
                    P.put(x, 5, z, "lantern", hanging=True)
            if AMB0 <= s <= AMB1:
                P.put(x, 0, z, "polished_andesite" if s == 53 else pick([("stone_bricks", 3), ("cracked_stone_bricks", 1)], x, 0, z, 9))
                for y in range(1, 9): P.air(x, y, z)
                if s == 53 and ((x if abs(z) >= abs(x) else z) - 4) % 8 == 0 and abs(x) != abs(z):
                    P.put(x, 8, z, "iron_chain", axis="y"); P.put(x, 7, z, "lantern", hanging=True)
                if s >= 52:                                       # the gallery storey
                    P.put(x, GAL_FLOOR, z, "spruce_planks" if s in (53, 54) else "dark_oak_planks")
                    for y in range(GAL_FLOOR + 1, 17): P.air(x, y, z)
                    if s == 53 and ((x if abs(z) >= abs(x) else z)) % 8 == 0 and abs(x) != abs(z):
                        P.put(x, 16, z, "lantern", hanging=True)
    for side in "nesw":                                           # passages on the axes, corridor to ambulatory
        for d in range(CORR1 + 1, AMB0):
            for dx in (-1, 0, 1):
                P.side_put(side, dx, 0, -d, "polished_andesite")
                for y in range(1, 5): P.side_put(side, dx, y, -d, "air")
            if d == CORR1 + 3: P.side_put(side, 0, 4, -d, "lantern", hanging=True)
        for sgn in (-1, 1):                                       # flights up to the gallery, 2 wide, near the corners
            for i in range(10):                                   # steps at y 1..10 along the inner wall
                t = sgn * (24 + i)
                for zz in (-(AMB0), -(AMB0 + 1)):
                    P.side_put(side, t, i + 1, zz, "stone_brick_stairs", facing="e" if sgn > 0 else "w")
                    for y in range(1, i + 1): P.side_put(side, t, y, zz, "stone_bricks")
                    for y in range(i + 2, i + 5): P.side_put(side, t, y, zz, "air")
            for i in range(4, 10):                                # a rail on the gallery side of the stair well
                P.side_put(side, sgn * (24 + i), GAL_FLOOR + 1, -(AMB0 + 2), "stone_brick_wall")


def royal_box(P):
    """The royal box on the north side, at the walkway between the tiers: a floor over three rows, a balustrade,
    a copper lean-to canopy on posts, thrones, and the twelve colours hung on its back wall."""
    for x in range(-8, 9):
        for z in range(-50, -40):
            for y in range(0, 17): P.put(x, y, z, "stone_bricks")
            P.put(x, 16, z, "dark_oak_planks" if abs(x) == 8 or z in (-50, -41) else "spruce_planks")
            for y in range(17, 26): P.air(x, y, z)
    for x in range(-7, 8):
        P.put(x, 17, -41, "stone_brick_wall" if abs(x) > 0 else "chiseled_stone_bricks")
        for y in range(17, 25): P.put(x, y, -51, "stone_bricks")
    for z in range(-51, -40):
        for y in range(17, 20): P.put(-8, y, z, "stone_bricks"); P.put(8, y, z, "stone_bricks")
    for k, col in enumerate(COLOURS):                       # the twelve colours on the back wall
        x = [-6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6][k]
        for y in range(19, 23): P.put(x, y, -51, col + "_wool")
    P.put(0, 19, -51, "chiseled_stone_bricks"); P.put(0, 20, -51, "gold_block"); P.put(0, 21, -51, "chiseled_stone_bricks")
    for x in (-1, 0, 1):
        P.put(x, 17, -49, "dark_oak_stairs", facing="n")      # the thrones
    for x in range(-7, 8):
        for z in range(-47, -42): P.put(x, 17, z, "red_carpet")
    for x in (-7, 7):
        for y in range(17, 21): P.put(x, y, -42, "stripped_dark_oak_log", axis="y")
    P.parts.append({"part": "lean_to", "name": "royal_canopy", "rect": [-8, -51, 8, -41], "against": "n", "top": 25, "pitch": "half",
                    "y": 17, "roof": {"ladder": ["waxed_weathered_cut_copper", "waxed_exposed_cut_copper"], "axis": "y"}, "post": "stripped_dark_oak_log",
                    "trim": "dark_oak_planks"})
    for x in (-4, 4):
        P.put(x, 22, -45, "iron_chain", axis="y"); P.put(x, 21, -45, "lantern", hanging=True)


def stair_tower(P, corner, side):
    """A stair tower in the south-east corner design, turned to `corner`: a 13-wide stone shaft (x, z 37..49)
    from the ground, a square spiral of 27 steps two wide round a solid core from the ambulatory up to the
    promenade, a lookout room, an open belfry stage and a copper dome."""
    T = lambda x, y, z, b, **p: P.side_put(side, x, y, z, b, **p)
    X0, X1, Y1 = 37, 49, 47
    for x in range(X0, X1 + 1):
        for z in range(X0, X1 + 1):
            wall = x in (X0, X1) or z in (X0, X1)
            for y in range(0, Y1 + 1):
                if wall or y in (0, 32, 41, Y1): T(x, y, z, "stone_bricks" if not (wall and x in (X0, X1) and z in (X0, X1)) else "polished_andesite")
                else: T(x, y, z, "air")
    for x in range(40, 47):                                    # the core
        for z in range(40, 47):
            for y in range(1, TOP + 1): T(x, y, z, "stone_bricks")
    steps = []                                                 # (cells, facing) in order, 27 of them
    for z in range(40, 47): steps.append(([(47, z), (48, z)], "s"))
    for x in range(46, 39, -1): steps.append(([(x, 47), (x, 48)], "w"))
    for z in range(46, 39, -1): steps.append(([(38, z), (39, z)], "n"))
    for x in range(40, 46): steps.append(([(x, 38), (x, 39)], "e"))
    landings = [([(47, 47), (48, 47), (47, 48), (48, 48)], 7), ([(38, 47), (39, 47), (38, 48), (39, 48)], 14),
                ([(38, 38), (39, 38), (38, 39), (39, 39)], 21)]
    for i, (cells, f) in enumerate(steps[:27]):
        y = i + 1
        for (x, z) in cells:
            for yy in range(1, y): T(x, yy, z, "stone_bricks")
            T(x, y, z, "stone_brick_stairs", facing=f)
    for cells, y in landings:
        for (x, z) in cells:
            for yy in range(1, y + 1): T(x, yy, z, "stone_bricks")
    T(47, 8, 47, "lantern"); T(39, 15, 47, "lantern"); T(39, 22, 39, "lantern")
    for x in (46, 47, 48):                                     # the top landing over the way in
        for z in (38, 39): T(x, TOP, z, "stone_bricks")
    for z in (38, 39, 40):                                     # the way in from the ambulatory (east face)
        for y in (1, 2, 3):
            T(49, y, z, "air"); T(50, y, z, "air")
        T(49, 0, z, "polished_andesite"); T(50, 0, z, "polished_andesite")
    T(46, TOP + 1, X0, "spruce_door", facing="n", hinge=False, upper=False)   # out onto the terrace
    T(46, TOP + 2, X0, "spruce_door", facing="n", hinge=False, upper=True)
    T(43, TOP + 4, 43, "iron_chain", axis="y"); T(43, TOP + 3, 43, "lantern", hanging=True)
    for y in range(TOP + 1, Y1):                               # a ladder up the east wall to the deck
        T(48, y, 39, "ladder", facing="w")
    for y in (32, 41, Y1): T(48, y, 39, "air")
    T(48, Y1, 39, "spruce_trapdoor", facing="w", half="top")
    for y in range(Y1 - 5, Y1):                                # the belfry stage: open arches on every face
        for t in range(41, 46):
            if y == Y1 - 1 and t in (41, 45): continue
            T(t, y, X0, "air"); T(t, y, X1, "air"); T(X0, y, t, "air"); T(X1, y, t, "air")
    for y in (35, 36):                                         # lookout windows
        for (a, b) in ((43, X0), (43, X1), (X0, 43), (X1, 43)): T(a, y, b, "gray_stained_glass_pane")
    T(43, 40, 43, "iron_chain", axis="y"); T(43, 39, 43, "lantern", hanging=True)
    for y in (TOP, 40):                                        # courses round the visible shaft
        for t in range(X0 - 1, X1 + 2):
            for (a, b, f) in ((t, X0 - 1, "s"), (t, X1 + 1, "n"), (X0 - 1, t, "e"), (X1 + 1, t, "w")):
                T(a, y + 1 if y == TOP else y, b, "stone_brick_stairs", facing=f, half="top")
    cx, cz = TURN[side](43, 43)
    P.parts.append({"part": "dome", "name": f"dome_{corner}", "at": [cx, Y1 + 1, cz], "r": 5.5, "drum": {"h": 3, "windows": 8, "material": "stone_bricks"},
                    "finial": "spire_block"})
    # an outer-corner turret on the shell, with a copper cone
    tx, tz = TURN[side](S_OUT, S_OUT)
    P.parts.append({"part": "keep", "name": f"turret_{corner}", "at": [tx, tz], "r": 3.5, "y": 0, "h": 38, "floors": [10, 20, 30],
                    "material": "stone_bricks", "trim": "polished_andesite", "cap": "cone", "roof": "waxed_weathered_cut_copper",
                    "slits": {"sides": "nsew"}, "doors": []})


def gatehouse(P):
    """The gatehouse on the north face, toward the station: the entrance hall (house part, Norman stone, copper
    gable to the north) between two round towers with copper cones, the grand arch through to the ambulatory,
    the two challenge boards and the roll of the twelve colours."""
    x0, z0, x1, z1 = -11, -71, 11, -57
    P.parts.append({"part": "house", "name": "gatehouse", "style": "vale_stone", "rect": [x0, z0, x1, z1], "y": 0, "plinth": 1,
                    "storeys": [10, 6, 6], "door": {"side": "n", "kind": "grand"}, "roof": {"type": "gable", "ridge": "z"},
                    "materials": {"roof": {"ladder": ["waxed_oxidized_cut_copper", "waxed_weathered_cut_copper", "waxed_exposed_cut_copper"], "axis": "y", "reverse": True}},
                    "chimney": False, "interior": {"use": "hall", "rooms": ["open", "council"]}, "bushes": False})
    for sx in (-15, 15):
        P.parts.append({"part": "keep", "name": f"gate_tower_{'w' if sx < 0 else 'e'}", "at": [sx, -67], "r": 5.5, "y": 0, "h": 42,
                        "floors": [11, 17, 23, 29, 35], "material": "stone_bricks", "trim": "polished_andesite", "cap": "cone",
                        "roof": "waxed_weathered_cut_copper", "slits": {"sides": "nsew" if sx < 0 else "nsew"},
                        "doors": [{"side": "e" if sx < 0 else "w", "floor": 0}], "ladder": "n"})
    # the grand arch from the hall into the ambulatory, 5 wide
    for x in range(-2, 3):
        for z in (-57, -56):
            for y in range(1, 6): P.air(x, y, z)
            P.put(x, 0, z, "polished_andesite")
    for z in (-57, -56):
        P.put(-2, 5, z, "stone_brick_stairs", facing="w", half="top"); P.put(2, 5, z, "stone_brick_stairs", facing="e", half="top")
        P.put(-1, 5, z, "stone_brick_slab", half="top"); P.put(1, 5, z, "stone_brick_slab", half="top")
        P.put(0, 6, z, "chiseled_stone_bricks")
    # the portal: the grand door stands in a round-arched porch 7 wide and 9 high, cut through the front wall
    for x in range(-3, 4):
        top = 8 if abs(x) <= 1 else 7 if abs(x) == 2 else 6
        for z in (-72, -71):
            for y in range(1, top + 1): P.air(x, y, z)
            P.put(x, 0, z, "polished_andesite")
        P.put(x, top + 1, -72, "chiseled_stone_bricks" if x == 0 else "polished_andesite")
    for x in (-3, 3): P.put(x, 6, -72, "stone_brick_stairs", facing="e" if x < 0 else "w", half="top")
    for x in (-2, 2): P.put(x, 7, -72, "stone_brick_stairs", facing="e" if x < 0 else "w", half="top")
    for x in range(-5, 6):                                    # steps up to the porch from the forecourt
        P.put(x, 0, -73, "stone_brick_slab", half="top")
    for x in (-4, 4):
        P.put(x, 1, -73, "polished_andesite"); P.put(x, 2, -73, "lantern")
    # the two boards, the roll of colours over each
    P.put(-9, 1, -64, "lectern", facing="e"); P.put(9, 1, -64, "lectern", facing="w")
    for k, col in enumerate(COLOURS):
        z = -70 + k + (1 if k >= 6 else 0)
        P.put(-11, 5, z, col + "_wool"); P.put(11, 5, z, col + "_wool")
    for z in range(-70, -58, 2):                               # benches along the hall
        if z in (-64,): continue
        P.put(-10, 1, z, "spruce_stairs", facing="w"); P.put(10, 1, z, "spruce_stairs", facing="e")
    P.lay["sign"] = [-9, 1, -64]
    P.lay["signs"] = [{"at": [-9, 1, -64], "kind": "king"}, {"at": [9, 1, -64], "kind": "mob"}]


# ------------------------------------------------------------------------------------------------ ground and outputs
STATION_DOOR = (-123, -36)       # world x, z just south of the grand station's front (it faces south, the rails behind it)
STREET = [("cobblestone_slab", 60), ("stone_brick_slab", 25), ("andesite_slab", 15)]
VERGE = [("grass_path", 3), ("coarse_dirt", 1), ("gravel", 1)]


def way_cells():
    """Local (x, z) -> "court" / "way" / "verge": the forecourt before the gatehouse (29 x 9) and the processional
    way to the station, the Vale high street (5 wide) with a verge each side (build-instructions/paths)."""
    cx, cz = CENTRE
    out = {}
    for x in range(-14, 15):
        for z in range(-81, -72): out[(x, z)] = "court"
    sx, sz = STATION_DOOR[0] - cx, STATION_DOOR[1] - cz
    ax, az = 0, -81
    pts = []
    n = 400
    for i in range(n + 1):
        t = i / n
        x = ax + (sx - ax) * (3 * t * t - 2 * t * t * t)       # leaves the forecourt heading north, swings east,
        z = az + (sz - az) * t                                  # comes into the station heading north
        pts.append((x, z))
    for (x, z) in pts:
        for dx in range(-4, 5):
            for dz in range(-4, 5):
                c = (round(x + dx), round(z + dz)); r = math.hypot(c[0] - x, c[1] - z)
                if c in out and out[c] in ("court", "way"): continue
                if r <= 2.6: out[c] = "way"
                elif r <= 3.6 and out.get(c) != "way": out[c] = "verge"
    return out, pts


def ground(blocks):
    """The terraform pass (terraform.py) for the arena, its forecourt and the way: the pad under the footprint, the
    way and forecourt as connectors, the skirt blended into the real map ground. Returns (padY, world blocks of the
    groundwork incl. the paving and lamps, the solved heights for the viewer)."""
    import numpy as np
    import terraform as TF
    from area_ground import Ground
    import dressing
    cx, cz = CENTRE
    G = Ground(cx, cz, 0)
    foot = {(x, z) for (x, y, z) in blocks if 0 <= y <= 2}
    ways, pts = way_cells()
    X0, Z0, X1, Z1 = -100, -112, 100, 100
    W, H = X1 - X0 + 1, Z1 - Z0 + 1
    h = np.array([[G.real(X0 + i, Z0 + j) for j in range(H)] for i in range(W)], int)
    padY = TF.pad_height([h[x - X0, z - Z0] for (x, z) in foot])
    pad = {(x - X0, z - Z0): padY for (x, z) in foot}
    con = {}
    for (x, z), k in ways.items():
        if (x, z) in foot or not (X0 <= x <= X1 and Z0 <= z <= Z1): continue
        if k == "court": con[(x - X0, z - Z0)] = padY
    # the way follows the land, smoothed, and meets the forecourt at its height
    for (x, z), k in ways.items():
        if k != "way" or (x, z) in foot or not (X0 <= x <= X1 and Z0 <= z <= Z1): continue
        i, j = x - X0, z - Z0
        win = h[max(0, i - 6): i + 7, max(0, j - 6): j + 7]
        y = int(round(float(win.mean())))
        dz = -81 - z if z < -81 else 0
        con[(i, j)] = max(min(y, padY + dz // 2), padY - dz // 2) if dz < 30 else y
    town = np.zeros((W, H), bool)                                   # Kingsrest's own ground is never moved
    for i in range(W):
        for j in range(H):
            if math.hypot(cx + X0 + i + 123, cz + Z0 + j + 125) <= 84: town[i, j] = True
    site = TF.Site(pad=pad, connectors=con, carve=8, skirt=4, skirt_max=6)
    T, wall = TF.solve(h, [site], fixed=town)
    rep = TF.report(h, T, wall, [site])
    print("terraform:", rep, "pad y", padY)
    gw = TF.blocks(h, T, wall, [site], region="vale", x0=X0, z0=Z0, fixed=town)
    # the paving: a bottom slab sunk half a block on the street, the verge in path blocks, lamps every 11 on
    # alternate sides of the way and at the forecourt corners
    for (x, z), k in ways.items():
        if (x, z) in foot or not (X0 <= x <= X1 and Z0 <= z <= Z1) or town[x - X0, z - Z0]: continue
        t = int(T[x - X0, z - Z0])
        if k in ("court", "way"):
            gw[(x, t, z)] = (pick(STREET, x, t, z, 21), {"half": "bottom"})
            gw[(x, t - 1, z)] = ("stone", {})
        else:
            gw[(x, t, z)] = (pick(VERGE, x, t, z, 22), {})
    lamp = dressing.lamp("vale")
    spots = [(-15, -81), (15, -81), (-15, -73), (15, -73)]
    acc, side = 0.0, 1
    for a, b_ in zip(pts, pts[1:]):
        acc += math.hypot(b_[0] - a[0], b_[1] - a[1])
        if acc >= 11:
            acc = 0.0; side = -side
            dx, dz = b_[0] - a[0], b_[1] - a[1]; L = math.hypot(dx, dz) or 1
            spots.append((round(b_[0] - dz / L * 3.6 * side), round(b_[1] + dx / L * 3.6 * side)))
    for (x, z) in spots:
        if not (X0 <= x <= X1 and Z0 <= z <= Z1) or town[x - X0, z - Z0] or (x, z) in foot: continue
        if ways.get((x, z)) in ("way", "court") and (x, z) not in [(-15, -81), (15, -81), (-15, -73), (15, -73)]: continue
        t = int(T[x - X0, z - Z0])
        for (lx, ly, lz), (n, p) in lamp.cells.items():
            if n != "keep": gw[(x + lx, t + ly - (1 if ways.get((x, z)) in ("court",) else 0), z + lz)] = (n, p)
    return padY, gw, (h, T, X0, Z0)


def build():
    sp, P = spec()
    blocks, stage_of, log = engine.compute(sp)
    print("engine:", len(blocks), "blocks;", len(log), "notes")
    for l in log:
        if not l.startswith(("smoothed", "hollow:")): print("  ", l)
    info = engine.layout(sp)
    P.lay["seats"] = info.get("stands", [])[::3]
    P.lay["center"] = [0, 1, 0]
    P.lay["floorRadius"] = FLOOR
    return sp, P, blocks, log


def world_layout(lay, padY):
    """The fight code's positions in world coordinates (arena/layout.js shape, agreed with the fight thread)."""
    cx, cz = CENTRE
    w = lambda p: {"x": p[0] + cx, "y": p[1] + padY, "z": p[2] + cz}
    return {"name": NAME, "dim": "minecraft:overworld", "center": w(lay["center"]), "floorRadius": lay["floorRadius"],
            "rooms": [{"color": r["color"], "spawn": w(r["spawn"]), "board": w(r["board"]), "out": w(r["out"]), "door": w([r["door"][0], 1, r["door"][1]]),
                       "gate": {"from": w(r["gate"]["from"]), "to": w(r["gate"]["to"]), "block": "siege:portcullis"}} for r in lay["rooms"]],
            "seats": [w(s) for s in lay["seats"]],
            "sign": w(lay["sign"]), "signs": [{"kind": s["kind"], **w(s["at"])} for s in lay["signs"]]}


def viewer(b, out, textures):
    """The 3D page: the whole area, then sections and close looks, each with floor cuts (render/viewer3d.tpl.html)."""
    from build_3d_catalogue import write_viewer
    sec = {"id": "arena", "title": "The grand arena at Kingsrest"}

    def part(name, keep):
        def make():
            p = Blueprint(name); p.cells = {k: v for k, v in b.cells.items() if keep(*k)}
            return p
        return make
    levels = [0, GAL_FLOOR, TOP, 32]
    items = [
        (sec, {"key": "arena-area", "title": "The arena and its ground", "sub": "the whole area: forecourt, the way to the station, the land blended round it",
               "levels": levels, "blurb": "Cut buttons: rooms and corridors, gallery storey, promenade, tower lookouts."}, part("area", lambda x, y, z: True), ("air", "air"), (-38, 26, 1.0)),
        (sec, {"key": "arena-section-ns", "title": "Section, north to south", "sub": "cut down the middle: gatehouse, rooms, corridor, ambulatory, stands, royal box",
               "levels": levels}, part("ns", lambda x, y, z: x <= 0 and abs(z) <= 100 and abs(x) <= 70), ("air", "air"), (75, 12, 0.9)),
        (sec, {"key": "arena-section-diag", "title": "Section through a corner", "sub": "a quarter cut away: the stair tower's spiral, the corner terrace, the turret",
               "levels": levels}, part("q", lambda x, y, z: not (x > 0 and z > 0) and max(abs(x), abs(z)) <= 64), ("air", "air"), (45, 20, 0.9)),
        (sec, {"key": "arena-rooms-north", "title": "The north rooms (red, orange, white)", "sub": "starting rooms cut open at the ceiling: gates, racks, boards, back doors",
               "levels": [0], "cut": 5}, part("rooms", lambda x, y, z: -20 <= x <= 20 and -46 <= z <= -26 and -2 <= y <= 9), ("air", "air"), (-30, 50, 1.2)),
        (sec, {"key": "arena-gatehouse", "title": "Gatehouse and entrance hall", "sub": "the two challenge boards, the roll of colours, the towers",
               "levels": [0, 10, 16]}, part("gate", lambda x, y, z: -24 <= x <= 24 and -84 <= z <= -50), ("air", "air"), (160, 18, 1.1)),
    ]
    write_viewer(items, out, textures)


def main():
    import argparse
    ap = argparse.ArgumentParser(); ap.add_argument("out"); ap.add_argument("--no-ground", action="store_true")
    ap.add_argument("--bake", action="store_true", help="also write map/arena-blocks.json and map/arena-layout.json")
    ap.add_argument("--viewer", help="also write a hosted 3D page here (whole area, sections, close looks)")
    ap.add_argument("--textures", help="bedrock-samples textures/blocks, for --viewer")
    a = ap.parse_args()
    sp, P, blocks, log = build()
    b = Blueprint("arena_kingsrest")
    padY, gw = 0, {}
    if not a.no_ground:
        padY, gw, (h, T, X0, Z0) = ground(blocks)
        cx, cz = CENTRE
        for (x, y, z), (n, p) in gw.items():                     # the groundwork, relative to the floor
            if n != "air": b.set(x, y - padY, z, n, **p)
        R = 96                                                    # and the land round it, as it stands after the pass
        for i in range(T.shape[0]):
            for j in range(T.shape[1]):
                x, z = X0 + i, Z0 + j
                if math.hypot(x, z) > R and not (x > 0 and z < -60): continue
                t = int(T[i, j]) - padY
                for y in range(t - 2, t + 1):
                    if (x, y, z) not in b.cells:
                        b.set(x, y, z, "grass_block" if y == t else "dirt")
    for (x, y, z), q in blocks.items():
        n, p = engine.to_bp(*q)
        b.cells[(x, y, z)] = (n, p)
    b.finish()
    os.makedirs(os.path.join(a.out, "arena"), exist_ok=True)
    b.camera = {"views": {"card": [-38, 26, 260, 0, 12, -10]}}
    b.save_logical(os.path.join(a.out, "arena", "scene.json"))
    json.dump({"arena": "The grand arena at Kingsrest (name to pick)"}, open(os.path.join(a.out, "names.json"), "w"))
    lay = world_layout(P.lay, padY)
    json.dump(lay, open(os.path.join(a.out, "layout.json"), "w"), indent=1)
    print("rooms", len(lay["rooms"]), "seats", len(lay["seats"]), "pad y", padY)
    if a.viewer: viewer(b, a.viewer, a.textures)
    if a.bake:
        cx, cz = CENTRE
        world = Blueprint("arena_world")
        for c, v in gw.items(): world.cells[c] = (v[0], v[1])
        for (x, y, z), q in blocks.items():
            world.cells[(x + cx, y + padY, z + cz)] = engine.to_bp(*q)
        world.finish()
        pal, idx, out = [], {}, []
        n_ground = 0
        order = sorted(world.cells.items(), key=lambda c: (c[0] not in gw, c[0][1], c[0][0], c[0][2]))
        for (x, y, z), (n, p) in order:
            if n == "keep": continue
            e = world.to_bedrock(n, p); key = json.dumps(e, sort_keys=True)
            if key not in idx: idx[key] = len(pal); pal.append({"name": e[0], "states": e[1]})
            out.append([x, y, z, idx[key]])
            if (x, y, z) in gw: n_ground += 1
        dst = os.path.join(REPO, "map", "arena-blocks.json")
        json.dump({"format": "hollow-crown-worldblocks/1", "town": "Kingsrest arena",
                   "note": "world coordinates, placed in order; the first groundwork_blocks are the terraform pass (pad, skirt, "
                   "forecourt, the way to the station), then the arena (map/structures/arena.py)", "groundwork_blocks": n_ground,
                   "tree_seats": [], "palette": pal, "blocks": out}, open(dst, "w"), separators=(",", ":"))
        json.dump(lay, open(os.path.join(REPO, "map", "arena-layout.json"), "w"), indent=1)
        print("baked", len(out), "blocks ->", dst)


if __name__ == "__main__":
    main()
