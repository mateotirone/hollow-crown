"""The Twelve Gates, the grand arena at Kingsrest (Mateo, 2026-11-13): a round amphitheatre with twelve starting
rooms in the twelve settlement colours spaced evenly round one fighting floor, so two kings can fight one against
one, three at once, six against six or all twelve. Mateo picked the name ("Colosseum" was only his example) and
asked for it round, with no colour wheel in the middle.

Where: the open meadow south-west of Kingsrest's grand station, between the Bay Line and the Fen Line, on the
station's side of the rails (CENTRE). A paved processional way runs from the station's south door down to the
forecourt and the gatehouse, which faces the station. The land round it is solved by the shared terraform pass.

The plan (local coordinates, x east, z south, y 0 = the arena floor; rings are round(hypot(x, z)); sizes odd):
  floor      a circle, ring <= 30 (61 across): plain sand, a small chiseled stone centre stone, and lights set
             flush in the floor on four rings (nothing standing on it: mobs and fighters need the room).
  podium     the arena wall on ring 31, 7 high, a parapet of wall posts and lanterns on top.
  rooms      12 starting rooms, one every 30 degrees, 9 x 9 x 5 inside (room for a team of 6), in the podium
             under the stands. Each room is square to its nearest axis so its gate is a flat wall: a Vale
             portcullis 3 wide and 4 high (the fight code lifts it like the castle gate), with a short passage
             through the podium where the circle curves away. Its colour in the floor, a band round the walls, a
             hanging over the board and a panel over the gate, the default loadout on racks, the board (a lectern)
             where fighters pick a loadout and start, and a door at the back out to the inner corridor.
  stands     25 round rows rising one up and one out from the podium (the skill's `stands` part, round), two
             walkways between the tiers with lamp posts, 24 aisles, the promenade along the top, the royal box
             on the north side.
  shell      a round Norman shell 117 across (rings 57-58): a plinth, pilasters on the piers, 40 bays of open
             arches on the ground storey with the ambulatory behind them, a gallery storey with open arches,
             lancets above, string courses, a cornice, battlements and a pennant of the twelve colours on every
             bay. A frontispiece with a tall entrance arch and a gable on the east, south and west.
  towers     four round stair towers 19 across on the diagonals, half outside the shell: a square spiral of 27
             steps round a solid core from the ambulatory up to the promenade, a lookout room, an open belfry
             stage and a copper dome.
  gatehouse  on the north side facing the station: the entrance hall with the two challenge boards ("Challenge a
             king", "Fight a beast") and the roll of the twelve colours, flanked by two round towers with copper
             cones; a forecourt and lamps in front.

    python3 arena.py OUT [--no-ground]     # OUT/arena/scene.json (with the terraformed ground), names.json
    python3 arena.py OUT --bake            # also map/arena-blocks.json (world blocks for genworld) and map/arena-layout.json
    python3 arena.py OUT --viewer DIR --textures <bedrock-samples>/resource_pack/textures/blocks   # the hosted 3D page
    python3 arena.py OUT --light           # light check: the darkest places people stand (blocks lit like the game)

Everything is built by the one building engine (the skill: engine.into_blueprint), the ground by terraform.py.
"""
import json, math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(REPO, ".claude", "skills", "minecraft-builder", "scripts"))
import engine  # noqa: E402
from bp import Blueprint  # noqa: E402

NAME = "The Twelve Gates"        # Mateo's pick, 2026-11-13
CENTRE = (-190, 50)              # world x, z of the floor centre
FLOOR, WALL = 30, 31             # floor rings 0..30, the podium wall on ring 31
STAND0, STAND1 = 32, 56          # the stands' first and last rows
WALKS = [44, 45, 55, 56]         # level walkways: between the tiers, and the promenade at the top
CORR0, CORR1 = 46, 48            # the inner corridor behind the rooms
AMB0, AMB1 = 52, 56              # the outer ambulatory, behind the ground arcade
SH0, S_OUT = 57, 58              # the shell's rings (S_OUT its outer face)
CLEAR_UP = 8                     # dig the map's ground out this far above the pad over the whole footprint
GAL_FLOOR = 10                   # the gallery storey's floor
NBAYS = 40                       # arches round the shell, 9 degrees apart
TOWER = (47, 47)                 # the south-east stair tower's centre (the others turned)
BOX = (-8, -53, 8, -44)          # the royal box (x0, z0, x1, z1), in the stands on the north side


def stand_tops():
    tops, y = {}, 7
    for d in range(STAND0, STAND1 + 1):
        if d in WALKS and d != STAND0: y -= 1
        tops[d] = y; y += 1
    return tops


TOPS = stand_tops()
TOP = TOPS[STAND1]               # the promenade (top block), 27
WALK_Y = TOPS[WALKS[0]]          # the walkway between the tiers (top block), 18

# The twelve colours, clockwise from the north (agreed with the fight code, arena/layout.js). Each room is drawn on
# the side of its nearest axis: c is its centre along that side, the gate on the plane `zg` out from the centre.
COLOURS = ["red", "orange", "yellow", "lime", "green", "cyan", "light_blue", "blue", "purple", "magenta", "pink", "white"]
SIDE_ORDER = [("n", 0), ("n", 17), ("e", -17), ("e", 0), ("e", 17), ("s", -17), ("s", 0), ("s", 17), ("w", -17), ("w", 0), ("w", 17), ("n", -17)]
GATE_Z = {0: 31, 17: 29}         # the gate plane for a room on the axis / 30 degrees off it (its front wall clears the floor)

# ---- turning a design drawn on the north side (outward = -z) to the other sides
TURN = {"n": lambda x, z: (x, z), "e": lambda x, z: (-z, x), "s": lambda x, z: (-x, -z), "w": lambda x, z: (z, -x)}
FACE_TURN = {"n": {}, "e": {"n": "e", "e": "s", "s": "w", "w": "n"}, "s": {"n": "s", "s": "n", "e": "w", "w": "e"},
             "w": {"n": "w", "w": "s", "s": "e", "e": "n"}}
# the four diagonals: a design drawn in the south-east (x, z > 0) turned clockwise
CORNER = {"se": "n", "sw": "e", "nw": "s", "ne": "w"}


def turned(side, x, y, z, b, p=None):
    tx, tz = TURN[side](x, z)
    p = dict(p or {})
    if "facing" in p: p["facing"] = FACE_TURN[side].get(p["facing"], p["facing"])
    if p.get("axis") in ("x", "z") and side in "ew": p["axis"] = "z" if p["axis"] == "x" else "x"
    return [tx, y, tz, b] + ([p] if p else [])


def ring(x, z): return int(round(math.hypot(x, z)))


def ang(x, z): return math.atan2(x, -z)          # clockwise from north


def at_angle(r, a): return (int(round(r * math.sin(a))), int(round(-r * math.cos(a))))


def spots(r, n, phase=0.0):
    """n cells evenly round ring r (lamps, posts), starting `phase` of a step clockwise from north."""
    return [at_angle(r, (i + phase) * 2 * math.pi / n) for i in range(n)]


def outward(x, z):
    """The axis direction pointing away from the centre (for stairs on a round face)."""
    return ("s" if z > 0 else "n") if abs(z) >= abs(x) else ("e" if x > 0 else "w")


OPP = {"n": "s", "s": "n", "e": "w", "w": "e"}


def in_box(x, z): return BOX[0] <= x <= BOX[2] and BOX[1] <= z <= BOX[3]


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
    mats = {"copper": {"ladder": ["waxed_oxidized_cut_copper", "waxed_weathered_cut_copper", "waxed_exposed_cut_copper"], "axis": "y", "reverse": True}}

    # 1 the stands, round, with the podium fill under them (foundation stage of the stands part)
    P.parts.append({"part": "stands", "name": "stands", "at": [0, 0], "round": True, "from": STAND0, "to": STAND1, "y": TOPS[STAND0],
                    "walk": WALKS, "seat": "stone_bricks", "aisle": "polished_andesite", "aisles": 24,
                    "fill": "stone_bricks", "base": 0, "skip": [list(BOX)],
                    "band": {"every": 4, "material": "polished_andesite"}})
    shell(P)
    for side in "esw":
        frontispiece(P, side)
    floor(P)
    podium(P)
    royal_box(P)
    for k, (side, c) in enumerate(SIDE_ORDER):
        room(P, k, side, c)
    corridors(P)
    stand_lights(P)
    for corner, side in CORNER.items():
        stair_tower(P, corner, side)
    gatehouse(P)
    return {"name": "arena_kingsrest", "edition": "bedrock", "materials": mats, "shapes": P.shapes, "parts": P.parts,
            "place": P.place, "hollow": 0, "quality": 2}, P


def bay_of(x, z):
    """(bay index, tangential offset u from the bay's centre line) for a cell of the shell."""
    step = 2 * math.pi / NBAYS
    a = ang(x, z); k = int(round(a / step))
    return k % NBAYS, math.hypot(x, z) * math.sin(a - k * step)


def gate_bay(k): return k in (NBAYS - 1, 0, 1)                    # behind the gatehouse
def front_bay(k): return k in (NBAYS // 4, NBAYS // 2, 3 * NBAYS // 4)   # the frontispieces (e, s, w)
def tower_bay(k): return k % (NBAYS // 4) == NBAYS // 8             # on the diagonals, under the towers


def shell(P):
    """The round shell, rings 57-58, 0..31: the VAL-01 stone with 40 bays of arches cut out of it, the plinth,
    courses and cornice one out (ring 59), pilasters on the piers, battlements, pennants, lanterns in the arches."""
    R = S_OUT + 2
    for x in range(-R, R + 1):
        for z in range(-R, R + 1):
            n = ring(x, z)
            if n not in (SH0, S_OUT, S_OUT + 1): continue
            k, u = bay_of(x, z); au = abs(u)
            open_bay = not (gate_bay(k) or front_bay(k) or tower_bay(k))
            if n == S_OUT + 1:                                           # one out: plinth, courses, cornice
                f = OPP[outward(x, z)]
                ground_arch = open_bay and au <= 2.4
                P.put(x, 0, z, "mossy_cobblestone" if h3(x, 0, z) < 0.5 else "cobblestone")
                if not ground_arch: P.put(x, 1, z, "cobblestone")
                for y in (9, 18): P.put(x, y, z, "stone_brick_stairs", facing=f, half="top")
                P.put(x, 31, z, "polished_andesite_stairs", facing=f, half="top")
                continue
            for y in range(0, 32):
                b = val01(x, y, z)
                if y == 0: b = "polished_andesite" if open_bay and au <= 2.4 else "cobblestone"
                elif open_bay and au <= 2.4 and y <= (7 if au < 1.5 else 6): b = "air"            # ground arch
                elif not gate_bay(k) and not front_bay(k) and not tower_bay(k) and au <= 1.4 and GAL_FLOOR + 1 <= y <= (15 if au < 0.6 else 14):
                    b = "stone_brick_wall" if y == GAL_FLOOR + 1 and n == S_OUT else "air"         # gallery arch
                elif open_bay and au < 0.6 and 20 <= y <= 22:
                    b = "light_gray_stained_glass_pane" if n == S_OUT else b                       # lancet
                elif open_bay and au < 0.6 and y == 23 and n == S_OUT: b = "chiseled_stone_bricks"
                elif not front_bay(k) and not tower_bay(k) and au <= 1.4 and y in (28, 29): b = "air"   # attic windows
                elif not front_bay(k) and not tower_bay(k) and au <= 1.4 and y == 30 and n == S_OUT: b = "polished_andesite"
                P.put(x, y, z, b)
            if n == S_OUT:                                               # parapet and merlons
                P.put(x, 32, z, "stone_bricks")
                if int(round(ang(x, z) * S_OUT)) % 2 == 0:
                    P.put(x, 33, z, "stone_bricks"); P.put(x, 34, z, "stone_brick_slab", half="bottom")
            else:
                P.put(x, 32, z, "stone_bricks")                          # the wall walk
    step = 2 * math.pi / NBAYS
    for k in range(NBAYS):
        a = k * step
        if not (front_bay(k) or tower_bay(k) or gate_bay(k)):            # pilasters on the piers either side
            for side_ in (-0.5, 0.5):
                px, pz = at_angle(S_OUT + 1, (k + side_) * step)
                for y in range(2, 31):
                    if y in (9, 18): continue
                    P.put(px, y, pz, "polished_andesite" if y % 6 in (0, 1, 2) else "stone_bricks")
        if front_bay(k) or tower_bay(k): continue
        fx, fz = at_angle(S_OUT, a)                                       # a pennant of the twelve colours
        for y in range(34, 39): P.put(fx, y, fz, "dark_oak_fence")
        tx, tz = math.cos(a), math.sin(a)
        for (d, y) in ((1, 38), (2, 38), (1, 37), (1, 36), (2, 37), (3, 38)):
            P.put(int(round(fx + tx * d)), y, int(round(fz + tz * d)), COLOURS[k % 12] + "_wool")
        if not gate_bay(k):                                               # a lantern in the crown of every ground arch
            lx, lz = at_angle(SH0, a)
            P.put(lx, 7, lz, "iron_chain", axis="y"); P.put(lx, 6, lz, "lantern", hanging=True)


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
    S(0, 9, F + 1, "lantern", hanging=True)                       # lit: a lantern in the arch, lamps either side
    for t in (-4, 4):
        S(t, 3, F - 1, "stone_brick_slab", half="top"); S(t, 4, F - 1, "lantern")
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


def gate_outs():
    """Each room's way onto the floor: the gate's middle column, walked in from the gate plane to the first floor
    cell, and the 'out' spot one further in (where the fight code puts a fighter when the gate opens)."""
    outs = []
    for side, c in SIDE_ORDER:
        zg = GATE_Z[abs(c)]
        z = -(zg - 1)
        while ring(c, z) > FLOOR: z += 1
        outs.append((side, c, zg, z))
    return outs


def floor(P):
    """Plain sand (worn where the gates open), a small chiseled centre stone, lights flush in the floor."""
    worn = [TURN[s](c, z) for s, c, zg, z in gate_outs()]
    for x in range(-FLOOR, FLOOR + 1):
        for z in range(-FLOOR, FLOOR + 1):
            if ring(x, z) > FLOOR: continue
            for y in (-1, -2): P.put(x, y, z, "stone")
            if max(abs(x), abs(z)) <= 1: b = "chiseled_stone_bricks"
            elif min(math.hypot(x - g[0], z - g[1]) for g in worn) < 3.2:
                b = pick([("coarse_dirt", 2), ("sand", 3), ("gravel", 1)], x, 0, z, 4)
            else:
                b = pick([("sand", 90), ("smooth_sandstone", 5), ("sandstone", 5)], x, 0, z, 3)
            P.put(x, 0, z, b)
    P.put(0, 0, 0, "ochre_froglight")
    for r, n, ph in ((8, 6, 0.5), (15, 12, 0.0), (22, 18, 0.5), (28, 24, 0.25)):   # every 7 or 8 blocks
        for (x, z) in spots(r, n, ph): P.put(x, 0, z, "ochre_froglight")


def podium(P):
    """The arena wall on ring 31: stone with a mossy foot, a polished cap, a parapet of wall posts with lanterns."""
    for x in range(-WALL, WALL + 1):
        for z in range(-WALL, WALL + 1):
            if ring(x, z) != WALL: continue
            for y in range(0, 8):
                b = "mossy_stone_bricks" if y == 1 and h3(x, y, z, 5) < 0.5 else "polished_andesite" if y == 7 else "stone_bricks"
                P.put(x, y, z, b)
            P.put(x, 8, z, "stone_brick_wall")
    for (x, z) in spots(WALL, 48, 0.5): P.put(x, 9, z, "lantern")


def room(P, k, side, c):
    """One starting room, drawn on the north side (outward -z) and turned: insides x c-4..c+4, z -(zg+9)..-(zg+1),
    the gate in the plane z = -zg and a passage from it to the floor where the circle curves away."""
    col = COLOURS[k]; zg = GATE_Z[abs(c)]; B = zg + 10; mid = zg + 5
    S = lambda x, y, z, b, **p: P.side_put(side, x, y, z, b, **p)
    for x in range(c - 4, c + 5):
        for z in range(-(zg + 9), -zg):
            S(x, -1, z, "stone"); S(x, -2, z, "stone")             # solid under the floor (the fight code's locker)
            S(x, 0, z, col + "_concrete" if abs(x - c) <= 1 and abs(z + mid) <= 1 else
              "polished_andesite" if abs(x - c) <= 2 and abs(z + mid) <= 2 else "stone_bricks")
            for y in range(1, 6): S(x, y, z, "air")
    for z in range(-B, -zg + 1):                            # the colour band round the walls, inside
        for x in (c - 5, c + 5): S(x, 4, z, col + "_terracotta")
    for x in range(c - 5, c + 6):
        S(x, 4, -B, col + "_terracotta")
    # the passage from the gate to the floor (rooms off the axis), 3 wide, 4 high, paved, a lantern in its roof
    oz = -(zg - 1)
    while ring(c, oz) > FLOOR:
        for dx in (-1, 0, 1):
            S(c + dx, 0, oz, "polished_andesite"); S(c + dx, -1, oz, "stone")
            for y in range(1, 5): S(c + dx, y, oz, "air")
        oz += 1
    if oz > -(zg - 1) + 1:
        S(c, 4, -(zg - 1), "lantern", hanging=True)
    # the gate: a Vale portcullis 3 wide x 4 high (it rises like the castle gate: the fight code opens and shuts it
    # with setGate), a dressed arch round it, the colour panel over it
    for dx in (-1, 0, 1):
        for y in range(1, 5): S(c + dx, y, -zg, "siege:portcullis", facing="n")
    for y in range(1, 6):
        for dx in (-2, 2): S(c + dx, y, -zg, "polished_andesite")
    S(c - 1, 5, -zg, "stone_brick_stairs", facing="w", half="top")
    S(c + 1, 5, -zg, "stone_brick_stairs", facing="e", half="top")
    S(c, 5, -zg, "chiseled_stone_bricks")
    for dx in (-1, 0, 1):
        for y in (6, 7): S(c + dx, y, -zg, col + "_wool")
    if c == 0:
        for dx in (-3, 3):                                  # lanterns on ledges either side, on the arena face
            S(c + dx, 4, -(zg - 1), "stone_brick_slab", half="top")
            S(c + dx, 5, -(zg - 1), "lantern")
    # the board: a lectern facing the gate under the room's hanging; the back door to the corridor
    S(c, 1, -(zg + 9), "lectern", facing="s")
    for dx in (-1, 0, 1):
        for y in (2, 3): S(c + dx, y, -B, col + "_wool")
    S(c, 1, -B, col + "_wool")
    S(c + 3, 1, -B, "spruce_door", facing="s", hinge=False, upper=False)
    S(c + 3, 2, -B, "spruce_door", facing="s", hinge=False, upper=True)
    dz = -(B + 1)                                          # and the passage from it out to the corridor
    while ring(*TURN[side](c + 3, dz)) < CORR0:
        for dx in (-1, 0, 1):
            S(c + 3 + dx, 0, dz, "polished_andesite" if dx == 0 else "stone_bricks")
            for y in range(1, 4): S(c + 3 + dx, y, dz, "air")
        dz -= 1
    # the default loadout on racks: west wall weapon racks (empty frames over barrels), east wall the armoury
    for z in (zg + 8, zg + 6, zg + 4, zg + 2):
        S(c - 4, 1, -z, "barrel")
        S(c - 4, 2, -z, "frame", facing="e")
        S(c - 4, 3, -z, "frame", facing="e")
    for z, b in ((zg + 8, "grindstone"), (zg + 6, "smithing_table"), (zg + 4, "anvil"), (zg + 2, "chest")):
        S(c + 4, 1, -z, b, facing="w")
    for z in (zg + 7, zg + 5, zg + 3):
        S(c + 4, 1, -z, "spruce_stairs", facing="e")         # benches along the armoury wall
    for ddx, z in ((-2, zg + 7), (2, zg + 7), (-2, zg + 3), (2, zg + 3)):
        S(c + ddx, 5, -z, "lantern", hanging=True)
    # what the fight code needs (relative to the floor centre, turned)
    sx, sz = TURN[side](c, -mid); ox, oz2 = TURN[side](c, oz + 1); bx, bz = TURN[side](c, -(zg + 9))
    g0 = TURN[side](c - 1, -zg); g1 = TURN[side](c + 1, -zg)
    P.lay["rooms"].append({"color": col, "side": side, "spawn": [sx, 1, sz], "board": [bx, 1, bz], "out": [ox, 1, oz2],
                           "gate": {"from": [min(g0[0], g1[0]), 1, min(g0[1], g1[1])], "to": [max(g0[0], g1[0]), 4, max(g0[1], g1[1])]},
                           "door": list(TURN[side](c + 3, -B))})


def corridors(P):
    """The inner corridor behind the rooms (rings 46-48), the passages out on the four axes, the outer ambulatory
    behind the ground arcade (52-56) and the gallery storey above it (53-56), with flights between them. Lit."""
    R = AMB1
    for x in range(-R, R + 1):
        for z in range(-R, R + 1):
            n = ring(x, z)
            if CORR0 <= n <= CORR1:
                P.put(x, 0, z, "polished_andesite" if n == 47 else "stone_bricks")
                for y in range(1, 6): P.air(x, y, z)
            if AMB0 <= n <= AMB1:
                P.put(x, 0, z, "polished_andesite" if n == 54 else pick([("stone_bricks", 3), ("cracked_stone_bricks", 1)], x, 0, z, 9))
                for y in range(1, 9): P.air(x, y, z)
                if n > AMB0:                                      # the gallery storey
                    P.put(x, GAL_FLOOR, z, "spruce_planks" if n in (54, 55) else "dark_oak_planks")
                    for y in range(GAL_FLOOR + 1, 17): P.air(x, y, z)
    for (x, z) in spots(47, 48, 0.5): P.put(x, 5, z, "lantern", hanging=True)
    for (x, z) in spots(54, 80, 0.0):                            # every 4 blocks: no dark stretch between them
        P.put(x, 8, z, "iron_chain", axis="y"); P.put(x, 7, z, "iron_chain", axis="y"); P.put(x, 6, z, "lantern", hanging=True)
    for (x, z) in spots(55, 80, 0.5): P.put(x, 16, z, "lantern", hanging=True)
    for side in "nesw":                                           # passages on the axes, corridor to ambulatory
        for d in range(CORR1 + 1, AMB0):
            for dx in (-1, 0, 1):
                P.side_put(side, dx, 0, -d, "polished_andesite")
                for y in range(1, 5): P.side_put(side, dx, y, -d, "air")
        P.side_put(side, 0, 4, -(CORR1 + 2), "lantern", hanging=True)
        for sgn in (-1, 1):                                       # flights up to the gallery, 2 wide, along the ring
            for i in range(10):                                   # (a chord this short stays inside the ambulatory)
                t = sgn * (5 + i)
                for zz in (-53, -54):
                    P.side_put(side, t, i + 1, zz, "stone_brick_stairs", facing="e" if sgn > 0 else "w")
                    for y in range(1, i + 1): P.side_put(side, t, y, zz, "stone_bricks")
                    for y in range(i + 2, i + 5): P.side_put(side, t, y, zz, "air")
            P.side_put(side, sgn * 9, GAL_FLOOR - 1, -55, "lantern", hanging=True)
            P.side_put(side, sgn * 11, 8, -52, "lantern", hanging=True); P.side_put(side, sgn * 6, 8, -52, "lantern", hanging=True)
            for i in range(4, 10):                                # a rail on the gallery side of the stair well
                P.side_put(side, sgn * (5 + i), GAL_FLOOR + 1, -55, "stone_brick_wall")


def royal_box(P):
    """The royal box on the north side, at the walkway between the tiers: a floor over the rows behind, a
    balustrade, a copper lean-to canopy on posts, thrones, and the twelve colours hung on its back wall."""
    x0, z0, x1, z1 = BOX; F = WALK_Y
    for x in range(x0, x1 + 1):
        for z in range(z0, z1 + 1):
            for y in range(0, F): P.put(x, y, z, "stone_bricks")
            P.put(x, F, z, "dark_oak_planks" if x in (x0, x1) or z in (z0, z1) else "spruce_planks")
            for y in range(F + 1, F + 10): P.air(x, y, z)
    for x in range(x0 + 1, x1):
        P.put(x, F + 1, z1, "stone_brick_wall" if x else "chiseled_stone_bricks")
        for y in range(F + 1, F + 9): P.put(x, y, z0 - 1, "stone_bricks")
    for z in range(z0 - 1, z1 + 1):
        for y in range(F + 1, F + 4): P.put(x0, y, z, "stone_bricks"); P.put(x1, y, z, "stone_bricks")
    for k, col in enumerate(COLOURS):                       # the twelve colours on the back wall
        x = [-6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6][k]
        for y in range(F + 3, F + 7): P.put(x, y, z0 - 1, col + "_wool")
    P.put(0, F + 3, z0 - 1, "chiseled_stone_bricks"); P.put(0, F + 4, z0 - 1, "gold_block"); P.put(0, F + 5, z0 - 1, "chiseled_stone_bricks")
    for x in (-1, 0, 1):
        P.put(x, F + 1, z0 + 1, "dark_oak_stairs", facing="n")      # the thrones
    for x in range(x0 + 1, x1):
        for z in range(z0 + 3, z1 - 1): P.put(x, F + 1, z, "red_carpet")
    for x in (x0 + 1, x1 - 1):
        for y in range(F + 1, F + 5): P.put(x, y, z1 - 1, "stripped_dark_oak_log", axis="y")
    P.parts.append({"part": "lean_to", "name": "royal_canopy", "rect": [x0, z0 - 1, x1, z1], "against": "n", "top": F + 9, "pitch": "half",
                    "y": F + 1, "roof": {"ladder": ["waxed_weathered_cut_copper", "waxed_exposed_cut_copper"], "axis": "y"}, "post": "stripped_dark_oak_log",
                    "trim": "dark_oak_planks"})
    for x in (-4, 4):
        P.put(x, F + 6, -48, "iron_chain", axis="y"); P.put(x, F + 5, -48, "lantern", hanging=True)
    for x in (x0 + 1, x1 - 1):                              # lanterns on the side walls, either end of the box
        P.put(x, F + 1, z0, "lantern")


def stand_lights(P):
    """Lamp posts on the walkway between the tiers and along the promenade (lit right up the stands), with a light
    set flush in the walkway at the foot of each post."""
    for (x, z) in spots(WALKS[1], 72, 0.5):                     # every 4 blocks round the walkway
        if in_box(x, z): continue
        P.put(x, WALK_Y + 1, z, "stone_brick_wall"); P.put(x, WALK_Y + 2, z, "lantern")
    for (x, z) in spots(WALKS[0], 72, 0.0):
        if not in_box(x, z): P.put(x, WALK_Y, z, "ochre_froglight")
    for d, n in ((37, 48), (50, 64)):                            # and studs of light set in two rows of seats
        for (x, z) in spots(d, n, 0.5):
            if not in_box(x, z) and ring(x, z) == d: P.put(x, TOPS[d], z, "ochre_froglight")
    for (x, z) in spots(WALKS[3], 2 * NBAYS, 0.25):              # the promenade: posts every 4 or 5 blocks
        P.put(x, TOP + 1, z, "stone_brick_wall"); P.put(x, TOP + 2, z, "lantern")
    for (x, z) in spots(WALKS[2], 2 * NBAYS, 0.75): P.put(x, TOP, z, "ochre_froglight")


def stair_tower(P, corner, side):
    """A round stair tower drawn on the south-east diagonal and turned: 19 across (walls 2 thick), standing half
    outside the shell. A square spiral of 27 steps round a solid 7 x 7 core climbs from the ambulatory to the
    promenade, widening into the round shaft; a lookout room, an open belfry stage and a copper dome on top.
    Ways in on the diagonal at the ambulatory and at the promenade."""
    T = lambda x, y, z, b, **p: P.side_put(side, x, y, z, b, **p)
    cx, cz = TOWER; Y1 = 47
    RI, RO = 7.5, 9.5
    clamp = lambda v: max(-5, min(5, v))

    def step(u, v):
        """(top y, stair facing or None for a landing) of the spiral at (u, v), clamped to the square."""
        u, v = clamp(u), clamp(v)
        if v <= -4 and -3 <= u <= 3: return u + 4, "e"
        if u >= 4 and v <= -4: return 7, None
        if u >= 4 and -3 <= v <= 3: return v + 11, "s"
        if u >= 4 and v >= 4: return 14, None
        if v >= 4 and -3 <= u <= 3: return 18 - u, "w"
        if u <= -4 and v >= 4: return 21, None
        if u <= -4 and -2 <= v <= 3: return 25 - v, "n"
        if u <= -4 and v == -3: return TOP, None
        return None, None                                     # the corner it starts from (and lands on at the top)
    for u in range(-11, 12):
        for v in range(-11, 12):
            r = math.hypot(u, v); x, z = cx + u, cz + v
            if r < RI:
                T(x, 0, z, "polished_andesite" if (u + v) % 2 else "stone_bricks"); T(x, -1, z, "stone")
                for y in range(1, Y1): T(x, y, z, "air")
                for y in (32, 41, Y1): T(x, y, z, "spruce_planks" if y < Y1 else "stone_bricks")
                if max(abs(u), abs(v)) <= 3:                  # the core
                    for y in range(1, TOP + 1): T(x, y, z, "stone_bricks")
                    continue
                h, f = step(u, v)
                if h is None:                                 # the bottom corner, the top landing over it
                    T(x, TOP, z, "stone_bricks"); continue
                for y in range(1, h): T(x, y, z, "stone_bricks")
                T(x, h, z, "stone_brick_stairs" if f else "stone_bricks", **({"facing": f} if f else {}))
            elif r < RO:
                for y in range(0, Y1 + 1):
                    T(x, y, z, "polished_andesite" if y in (TOP + 1, 41) else val01(x, y, z) if y < 2 else "stone_bricks")
            elif r < RO + 1:
                T(x, 0, z, "mossy_cobblestone" if h3(x, 0, z) < 0.5 else "cobblestone"); T(x, 1, z, "cobblestone")
                for y in (TOP + 1, 41):
                    T(x, y, z, "stone_brick_stairs", facing=OPP[outward(u, v)], half="top")
    # the ways in, on the diagonal toward the arena: at the ambulatory (y 1-3) and the promenade (TOP+1..TOP+3)
    for u in range(-22, 0):
        for v in range(-22, 0):
            if abs(u - v) > 1 or math.hypot(u, v) < RI: continue
            if ring(cx + u, cz + v) < AMB0 + 1: continue
            for y0, y1, fl in ((1, 3, 0), (TOP + 1, TOP + 3, TOP)):
                if y0 == 1 or ring(cx + u, cz + v) >= WALKS[3]:
                    T(cx + u, fl, cz + v, "polished_andesite")
                    for y in range(y0, y1 + 1): T(cx + u, y, cz + v, "air")
    # lights set flush in the shaft wall all the way up the spiral, two above the step beside them
    for i in range(16):
        a = 2 * math.pi * (i + 0.5) / 16
        u, v = int(round(8 * math.sin(a))), int(round(-8 * math.cos(a)))
        iu, iv = int(round(6.4 * math.sin(a))), int(round(-6.4 * math.cos(a)))
        h, f = step(iu, iv)
        T(cx + u, (h if h is not None else 0) + 2 + (1 if h is None else 0), cz + v, "ochre_froglight")
    # lights: a lantern on each landing, under the top landing, in the lookout and the belfry
    T(cx + 5, 8, cz - 5, "lantern"); T(cx + 5, 15, cz + 5, "lantern"); T(cx - 5, 22, cz + 5, "lantern")
    T(cx - 4, TOP - 1, cz - 4, "lantern", hanging=True)
    T(cx, 31, cz, "lantern", hanging=True); T(cx, Y1 - 1, cz, "lantern", hanging=True)
    T(cx, 40, cz, "iron_chain", axis="y"); T(cx, 39, cz, "lantern", hanging=True)
    for (u, v) in ((4, 4), (-4, 4), (4, -4)):                 # the lookout room: lanterns on the floor by the walls
        T(cx + u, 33, cz + v, "lantern")
    for (u, v) in ((5, 0), (-5, 0), (0, 5), (0, -5)):         # and the belfry, one by each arch
        T(cx + u, 42, cz + v, "lantern")
    # a ladder from the top landing to the deck, against the west wall
    for y in range(TOP + 1, Y1):
        T(cx - 6, y, cz - 3, "ladder", facing="e")
    T(cx - 6, Y1, cz - 3, "spruce_trapdoor", facing="e", half="top")
    for y in range(Y1 - 5, Y1 - 1):                           # the belfry stage: open arches on four faces
        for u in range(-11, 12):
            for v in range(-11, 12):
                r = math.hypot(u, v)
                if RI <= r < RO and (abs(u) <= 2 or abs(v) <= 2): T(cx + u, y, cz + v, "air")
    for y in (35, 36):                                        # lookout windows
        for (u, v) in ((0, -8), (0, 8), (-8, 0), (8, 0), (0, -9), (0, 9), (-9, 0), (9, 0)):
            T(cx + u, y, cz + v, "gray_stained_glass_pane")
    wx, wz = TURN[side](*TOWER)
    P.parts.append({"part": "dome", "name": f"dome_{corner}", "at": [wx, Y1 + 1, wz], "r": 8.5, "drum": {"h": 3, "windows": 8, "material": "stone_bricks"},
                    "finial": "spire_block"})


def gatehouse(P):
    """The gatehouse on the north face, toward the station: the entrance hall (house part, Norman stone, copper
    gable to the north) between two round towers with copper cones, the grand arch through to the ambulatory,
    the two challenge boards and the roll of the twelve colours."""
    x0, z0, x1, z1 = -11, -72, 11, -58
    P.parts.append({"part": "house", "name": "gatehouse", "style": "vale_stone", "rect": [x0, z0, x1, z1], "y": 0, "plinth": 1,
                    "storeys": [10, 6, 6], "door": {"side": "n", "kind": "grand"}, "roof": {"type": "gable", "ridge": "z"},
                    "materials": {"roof": {"ladder": ["waxed_oxidized_cut_copper", "waxed_weathered_cut_copper", "waxed_exposed_cut_copper"], "axis": "y", "reverse": True}},
                    "chimney": False, "interior": {"use": "hall", "rooms": ["open", "council"]}, "bushes": False})
    for sx in (-15, 15):
        P.parts.append({"part": "keep", "name": f"gate_tower_{'w' if sx < 0 else 'e'}", "at": [sx, -68], "r": 5.5, "y": 0, "h": 42,
                        "floors": [11, 17, 23, 29, 35], "material": "stone_bricks", "trim": "polished_andesite", "cap": "cone",
                        "roof": "waxed_weathered_cut_copper", "slits": {"sides": "nsew" if sx < 0 else "nsew"},
                        "doors": [{"side": "e" if sx < 0 else "w", "floor": 0}], "ladder": "n"})
    for sx in (-15, 15):                                         # the gate towers lit on every floor
        for f in (11, 17, 23, 29, 35, 42):
            P.put(sx + (2 if sx < 0 else -2), f - 1, -68, "lantern", hanging=True)
    # the grand arch from the hall into the ambulatory, 5 wide
    for x in range(-2, 3):
        for z in (-58, -57):
            for y in range(1, 6): P.air(x, y, z)
            P.put(x, 0, z, "polished_andesite")
    for z in (-58, -57):
        P.put(-2, 5, z, "stone_brick_stairs", facing="w", half="top"); P.put(2, 5, z, "stone_brick_stairs", facing="e", half="top")
        P.put(-1, 5, z, "stone_brick_slab", half="top"); P.put(1, 5, z, "stone_brick_slab", half="top")
        P.put(0, 6, z, "chiseled_stone_bricks")
    # the portal: the grand door stands in a round-arched porch 7 wide and 9 high, cut through the front wall
    for x in range(-3, 4):
        top = 8 if abs(x) <= 1 else 7 if abs(x) == 2 else 6
        for z in (-73, -72):
            for y in range(1, top + 1): P.air(x, y, z)
            P.put(x, 0, z, "polished_andesite")
        P.put(x, top + 1, -73, "chiseled_stone_bricks" if x == 0 else "polished_andesite")
    for x in (-3, 3): P.put(x, 6, -73, "stone_brick_stairs", facing="e" if x < 0 else "w", half="top")
    for x in (-2, 2): P.put(x, 7, -73, "stone_brick_stairs", facing="e" if x < 0 else "w", half="top")
    for x in range(-5, 6):                                    # steps up to the porch from the forecourt
        P.put(x, 0, -74, "stone_brick_slab", half="top")
    for x in (-4, 4):
        P.put(x, 1, -74, "polished_andesite"); P.put(x, 2, -74, "lantern")
    # the two boards, the roll of colours over each
    P.put(-9, 1, -65, "lectern", facing="e"); P.put(9, 1, -65, "lectern", facing="w")
    for k, col in enumerate(COLOURS):
        z = -71 + k + (1 if k >= 6 else 0)
        P.put(-11, 5, z, col + "_wool"); P.put(11, 5, z, col + "_wool")
    for z in range(-71, -59, 2):                               # benches along the hall
        if z in (-65,): continue
        P.put(-10, 1, z, "spruce_stairs", facing="w"); P.put(10, 1, z, "spruce_stairs", facing="e")
    P.lay["sign"] = [-9, 1, -65]
    P.lay["signs"] = [{"at": [-9, 1, -65], "kind": "king"}, {"at": [9, 1, -65], "kind": "mob"}]


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
        for z in range(-82, -73): out[(x, z)] = "court"
    sx, sz = STATION_DOOR[0] - cx, STATION_DOOR[1] - cz
    ax, az = 0, -82
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
        dz = -82 - z if z < -82 else 0
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
    spots = [(-15, -82), (15, -82), (-15, -74), (15, -74)]
    acc, side = 0.0, 1
    for a, b_ in zip(pts, pts[1:]):
        acc += math.hypot(b_[0] - a[0], b_[1] - a[1])
        if acc >= 11:
            acc = 0.0; side = -side
            dx, dz = b_[0] - a[0], b_[1] - a[1]; L = math.hypot(dx, dz) or 1
            spots.append((round(b_[0] - dz / L * 3.6 * side), round(b_[1] + dx / L * 3.6 * side)))
    for (x, z) in spots:
        if not (X0 <= x <= X1 and Z0 <= z <= Z1) or town[x - X0, z - Z0] or (x, z) in foot: continue
        if ways.get((x, z)) in ("way", "court") and (x, z) not in [(-15, -82), (15, -82), (-15, -74), (15, -74)]: continue
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


LIGHTS = {"lantern": 15, "ochre_froglight": 15, "glowstone": 15, "sea_lantern": 15, "shroomlight": 15, "torch": 14}
CLEAR = ("air", "glass", "pane", "fence", "wall", "slab", "stairs", "door", "trapdoor", "lantern", "chain", "carpet", "ladder",
         "lectern", "frame", "portcullis", "leaves", "grass", "torch", "sign", "bars", "anvil", "grindstone", "path")


def light_check(b):
    """Block light (night, no sky) as the game spreads it: 15 at a lamp, one less per step through anything that is
    not a full block. Prints the darkest standing spots in each part of the arena, so a dark corner is found before
    Mateo walks into it (2026-11-13: "Is it lit correctly?")."""
    import numpy as np
    cells = {k: v[0] for k, v in b.cells.items() if v[0] not in ("keep",) and (math.hypot(k[0], k[2]) <= 80 or (abs(k[0]) < 30 and -95 < k[2] < 0))}
    xs, ys, zs = zip(*cells)
    o = (min(xs) - 1, min(ys) - 1, min(zs) - 1)
    sh = (max(xs) - o[0] + 2, max(ys) - o[1] + 2, max(zs) - o[2] + 2)
    solid = np.zeros(sh, bool); lit = np.zeros(sh, np.int8)
    for (x, y, z), n in cells.items():
        i = (x - o[0], y - o[1], z - o[2]); n = n.split(":")[-1]
        if n in LIGHTS: lit[i] = LIGHTS[n]
        if not any(t in n for t in CLEAR): solid[i] = True
    for _ in range(15):
        m = lit.copy()
        for ax in range(3):
            for sgn in (1, -1): m = np.maximum(m, np.roll(lit, sgn, ax) - 1)
        m[solid] = 0; lit = np.maximum(lit, m)
    stand = (~solid) & np.roll(solid, 1, 1) & (~np.roll(solid, -1, 1))

    def zone(x, y, z):
        r = math.hypot(x, z)
        if z < -S_OUT and abs(x) < 25: return "gatehouse"
        if math.hypot(abs(x) - TOWER[0], abs(z) - TOWER[1]) < 9.5: return "towers"
        if r <= FLOOR + 0.5: return "floor"
        if y >= 7 and r < SH0: return "stands"
        if r < CORR0: return "rooms"
        if r < CORR1 + 1: return "corridor"
        if r < SH0: return "ambulatory, gallery"
        return None
    Z = {}
    for i, j, k in np.argwhere(stand):
        x, y, z = int(i + o[0]), int(j + o[1]), int(k + o[2])
        below = cells.get((x, y - 1, z), "")
        if y < 1 or (x, y + 1, z) not in cells and (x, y, z) not in cells: continue   # open sky
        if not below or below.startswith(("grass", "dirt")) or "copper" in below: continue
        zn = zone(x, y, z)
        if zn: Z.setdefault(zn, []).append((int(lit[i, j, k]), x, y, z))
    for zn, v in sorted(Z.items()):
        v.sort(); ls = [a[0] for a in v]
        print(f"light {zn:20s} {len(v):5d} spots, darkest {ls[0]:2d}, median {sorted(ls)[len(ls) // 2]:2d}, below 7: {sum(1 for l in ls if l < 7):4d}",
              " e.g.", [a[1:] for a in v[:3]])


def viewer(b, out, textures):
    """The 3D page: the whole area, then sections and close looks, each with floor cuts (render/viewer3d.tpl.html)."""
    from build_3d_catalogue import write_viewer
    sec = {"id": "arena", "title": "The Twelve Gates (the arena at Kingsrest)"}

    def part(name, keep):
        def make():
            p = Blueprint(name); p.cells = {k: v for k, v in b.cells.items() if keep(*k)}
            return p
        return make
    levels = [0, GAL_FLOOR, TOP + 1, 32]
    items = [
        (sec, {"key": "arena-area", "title": "The Twelve Gates and its ground", "sub": "the whole area: forecourt, the way to the station, the land blended round it",
               "levels": levels, "blurb": "Cut buttons: rooms and corridors, gallery storey, promenade, tower lookouts."}, part("area", lambda x, y, z: True), ("air", "air"), (-38, 26, 1.0)),
        (sec, {"key": "arena-section-ns", "title": "Section, north to south", "sub": "cut down the middle: gatehouse, rooms, corridor, ambulatory, stands, royal box",
               "levels": levels}, part("ns", lambda x, y, z: x <= 0 and abs(z) <= 100 and abs(x) <= 80), ("air", "air"), (75, 12, 0.9)),
        (sec, {"key": "arena-section-diag", "title": "A quarter cut away", "sub": "through the south-east stair tower: its spiral, the rooms, corridor, ambulatory, gallery and stands",
               "levels": levels}, part("q", lambda x, y, z: not (x > 0 and z > 0 and not (x > 47 or z > 47)) and math.hypot(x, z) <= 80 and not (x >= 47 and z >= 47)), ("air", "air"), (45, 20, 0.9)),
        (sec, {"key": "arena-rooms-north", "title": "The north rooms (white, red, orange)", "sub": "starting rooms cut open at the ceiling: gates, racks, boards, back doors",
               "levels": [0], "cut": 5}, part("rooms", lambda x, y, z: -24 <= x <= 24 and -50 <= z <= -24 and -2 <= y <= 9), ("air", "air"), (-30, 50, 1.2)),
        (sec, {"key": "arena-gatehouse", "title": "Gatehouse and entrance hall", "sub": "the two challenge boards, the roll of colours, the towers",
               "levels": [0, 10, 16]}, part("gate", lambda x, y, z: -24 <= x <= 24 and -85 <= z <= -51), ("air", "air"), (160, 18, 1.1)),
    ]
    write_viewer(items, out, textures)


def main():
    import argparse
    ap = argparse.ArgumentParser(); ap.add_argument("out"); ap.add_argument("--no-ground", action="store_true")
    ap.add_argument("--bake", action="store_true", help="also write map/arena-blocks.json and map/arena-layout.json")
    ap.add_argument("--viewer", help="also write a hosted 3D page here (whole area, sections, close looks)")
    ap.add_argument("--textures", help="bedrock-samples textures/blocks, for --viewer")
    ap.add_argument("--light", action="store_true", help="print the darkest standing spots in each part (night, block light)")
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
    json.dump({"arena": "The Twelve Gates, the arena at Kingsrest"}, open(os.path.join(a.out, "names.json"), "w"))
    lay = world_layout(P.lay, padY)
    json.dump(lay, open(os.path.join(a.out, "layout.json"), "w"), indent=1)
    print("rooms", len(lay["rooms"]), "seats", len(lay["seats"]), "pad y", padY)
    if a.light: light_check(b)
    if a.viewer: viewer(b, a.viewer, a.textures)
    if a.bake:
        cx, cz = CENTRE
        world = Blueprint("arena_world")
        # the map's own ground under the whole footprint is dug out above the pad (playtest 2026-11-13: dirt, grass
        # and tall grass were left standing on the gatehouse floor where the land was a block or two above the pad).
        # These air entries go in the groundwork, so genworld also levels its ground there to the pad.
        for (x, z) in {(x, z) for (x, y, z) in blocks}:
            for y in range(1, CLEAR_UP + 1):
                if (x, y, z) not in blocks: gw.setdefault((x + cx, y + padY, z + cz), ("air", {}))
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
