"""The Sun Gate Caravanserai, rebuilt as a real desert caravanserai (Mateo, 2026-11-12: "I don't even know what
it's supposed to be").

    python3 make_sungate.py   -> sun_gate.json (a minecraft-builder spec), then run export_wonders.py

Emberwaste (regions/emberwaste.md: a ksar caravanserai, flat roofs with vigas and parapets, tapering towers with
corner horns, pointed arcades, a blue-green dome with a gold finial, striped awnings, palms and a well).

From outside in: a 63-block square of thick battered sandstone walls with stepped merlons, a tapering kasbah
tower with corner horns at each corner, and on the front the Sun Gate itself: a great pishtaq (a tall gate block)
with a pointed iwan 13 wide and 22 high, framed in blue-green copper, a gilded sun over the door, and two round
minarets with balconies and little copper domes. Inside, two-storey ranges of rooms behind pointed arcades round
a courtyard with a pool, a fountain and four palms, striped market awnings, and on the far side the domed hall
whose green dome and gold finial show over the walls from far off. Front = +z.
"""
import json, math, os, random

HERE = os.path.dirname(os.path.abspath(__file__))
rng = random.Random(240)
cells, CARVE = {}, set()
OUTER = 31                      # outer face of the perimeter wall
WALL_TOP = 13


def put(x, y, z, b, **p): cells[(x, y, z)] = [b, p] if p else [b]
def drop(x, y, z): cells.pop((x, y, z), None)
def carve(x, y, z): cells[(x, y, z)] = ["air"]; CARVE.add((x, y, z))


def pick(pairs):
    r, acc = rng.random(), 0.0
    for b, w in pairs:
        acc += w
        if r < acc: return b
    return pairs[-1][0]


def sand(y=5):
    """EMB-01: smooth sandstone 60, sandstone 30, cut 10, a little darker (more plain sandstone) at the base."""
    low = max(0.0, (3 - y) / 3) * 0.3
    return pick([("smooth_sandstone", 0.6 - low), ("sandstone", 0.3 + low), ("cut_sandstone", 0.1)])


def pointed(u, yy, a):
    """Inside a pointed (equilateral) arch of half width a, yy above the springing line."""
    return yy <= 0 or (abs(u) + a) ** 2 + yy ** 2 <= (2 * a) ** 2


# ------------------------------------------------------------------------------------------------ the walls
def perimeter():
    for x in range(-OUTER, OUTER + 1):
        for z in range(-OUTER, OUTER + 1):
            m = max(abs(x), abs(z))
            put(x, 0, z, sand(0) if m >= 28 else "smooth_sandstone")
            if m < 28: continue
            depth = OUTER - m                         # 0 = outer face
            for y in range(1, WALL_TOP + 1):
                if depth == 0 and y > 3: continue     # battered: the outer course stops at y 3
                put(x, y, z, sand(y))
            if depth == 0:
                put(x, 4, z, "sandstone_stairs", facing="n" if z == -OUTER else "s" if z == OUTER else "w" if x == -OUTER else "e", half="bottom")
                # the stair faces into the wall (tall side to the wall): flip
                b = cells[(x, 4, z)]
                f = {"n": "s", "s": "n", "e": "w", "w": "e"}[b[1]["facing"]]
                put(x, 4, z, "sandstone_stairs", facing=f)
            if depth == 1:                            # parapet with stepped merlons on the outer line
                put(x, WALL_TOP + 1, z, "cut_sandstone")
                along = x if abs(z) == OUTER - 1 else z
                if along % 4 == 0:
                    put(x, WALL_TOP + 2, z, "cut_sandstone"); put(x, WALL_TOP + 3, z, "sandstone_wall")
                elif along % 4 in (1, 3):
                    put(x, WALL_TOP + 2, z, "sandstone_slab")
            if depth == 3 and m == 28:                # vigas poking through the inside face under the walk
                pass
    # small deep windows high in the outer wall, lattice in front
    for t in range(-24, 25, 8):
        for (x, z, f) in ((t, -OUTER + 1, "n"), (-OUTER + 1, t, "w"), (OUTER - 1, t, "e")):
            for y in (9, 10): put(x, y, z, "orange_stained_glass")
            ox, oz = {"n": (0, -1), "w": (-1, 0), "e": (1, 0)}[f]
            for y in (9, 10): put(x + ox, y, z + oz, "acacia_trapdoor", facing=f, open=True)
            put(x + ox, 11, z + oz, "chiseled_sandstone")


def corner_tower(cx, cz):
    """A tapering kasbah tower: 11 wide to y 15, 9 wide to y 23, corner horns, red bands, deep slits."""
    for x in range(-5, 6):
        for z in range(-5, 6):
            m = max(abs(x), abs(z))
            for y in range(0, 25):
                hw = 5 if y <= 15 else 4
                if m > hw: continue
                if y == 0: put(cx + x, y, cz + z, "sandstone"); continue
                edge = m == hw
                if not edge and y not in (8, 15, 23): continue           # hollow inside, floors at 8, 15, 23
                b = sand(y)
                if edge and y in (14, 22): b = "cut_red_sandstone"         # red bands under each set-back
                if edge and abs(x) == hw and abs(z) == hw: b = "cut_sandstone"
                put(cx + x, y, cz + z, b)
            # set-back ledge at y 16 on the 11-wide ring
            if m == 5: put(cx + x, 16, cz + z, "smooth_sandstone_slab")
            if m == 4:                                                   # parapet and horns
                put(cx + x, 24, cz + z, "cut_sandstone")
                if abs(x) == 4 and abs(z) == 4:
                    for y in range(25, 29): put(cx + x, y, cz + z, "cut_sandstone")
                    put(cx + x, 29, cz + z, "sandstone_wall")
                elif (x + z) % 2 == 0:
                    put(cx + x, 25, cz + z, "sandstone_slab")
    # vigas out through the walls under the parapet, every other block
    for k in range(-3, 4, 2):
        for (x, z, ax) in ((k, -5, "z"), (k, 5, "z"), (-5, k, "x"), (5, k, "x")):
            ox, oz = (0, -1 if z < 0 else 1) if ax == "z" else (-1 if x < 0 else 1, 0)
            put(cx + x + ox, 14, cz + z + oz, "spruce_log", axis=ax)
    # slits
    for y0 in (5, 11, 19):
        for (x, z) in ((0, -5), (0, 5), (-5, 0), (5, 0)):
            hw = 5 if y0 < 16 else 4
            sx, sz = (x and (hw if x > 0 else -hw)), (z and (hw if z > 0 else -hw))
            for y in (y0, y0 + 1): put(cx + sx, y, cz + sz, "orange_stained_glass")


# ------------------------------------------------------------------------------------------------ the gate
GATE_Z0, GATE_Z1, GATE_HW, GATE_TOP = OUTER - 5, OUTER + 5, 11, 30
IWAN_A, IWAN_SPRING = 6.5, 11                      # the iwan: 13 wide, springing at y 11, crown about y 22


def sun_gate():
    for x in range(-GATE_HW, GATE_HW + 1):
        for z in range(GATE_Z0, GATE_Z1 + 1):
            put(x, 0, z, sand(0))
            for y in range(1, GATE_TOP + 1):
                in_iwan = z >= OUTER and abs(x) <= 6 and pointed(x, y - IWAN_SPRING, IWAN_A)
                in_door = z >= GATE_Z0 and abs(x) <= 2 and pointed(x, y - 5, 2.5)
                if in_iwan or in_door:
                    drop(x, y, z); continue
                if z not in (GATE_Z0, GATE_Z1) and abs(x) not in (GATE_HW,) and y not in (GATE_TOP, IWAN_SPRING - 1):
                    # solid where the iwan's walls are, hollow behind
                    if not (z >= OUTER - 1 and abs(x) <= 8):
                        continue
                b = sand(y)
                if z == GATE_Z1 and (abs(x) in (8, 9) or y in (27, 28)) and abs(x) <= 9 and y >= 2:
                    b = "waxed_oxidized_cut_copper" if (abs(x) == 8 or y == 27) else "cut_red_sandstone"
                if z == GATE_Z1 and abs(x) <= 7 and y < 27 and not in_iwan:
                    # a ring of red sandstone hugging the arch
                    if pointed(x, y - IWAN_SPRING, IWAN_A + 1.1) and not pointed(x, y - IWAN_SPRING, IWAN_A):
                        b = "cut_red_sandstone"
                put(x, y, z, b)
    # stepped crenellation along the top of the gate block
    for x in range(-GATE_HW, GATE_HW + 1):
        put(x, GATE_TOP + 1, GATE_Z1, "cut_sandstone")
        k = (x + GATE_HW) % 4
        if k == 0:
            put(x, GATE_TOP + 2, GATE_Z1, "cut_sandstone"); put(x, GATE_TOP + 3, GATE_Z1, "cut_sandstone"); put(x, GATE_TOP + 4, GATE_Z1, "sandstone_wall")
        elif k in (1, 3):
            put(x, GATE_TOP + 2, GATE_Z1, "sandstone_stairs", facing="w" if k == 1 else "e")
    # the iwan's back wall: the door frame, a gilded sun with rays above it
    zb = OUTER - 1
    for u in range(-6, 7):
        for y in range(1, 23):
            if (u, y) and not pointed(u, y - IWAN_SPRING, IWAN_A): continue
            if abs(u) <= 2 and pointed(u, y - 5, 2.5): continue
            put(u, y, zb, sand(y))
    sx, sy = 0, 15
    for u in range(-6, 7):
        for v in range(-6, 7):
            r = math.hypot(u, v)
            if not pointed(u, sy + v - IWAN_SPRING, IWAN_A - 0.5): continue
            if r <= 2.5: put(sx + u, sy + v, zb, "gold_block")
            elif r <= 3.3: put(sx + u, sy + v, zb, "yellow_terracotta")
            elif r <= 6.2:
                ang = math.atan2(v, u)
                if int(round(ang / (math.pi / 8))) % 2 == 0 and r <= 5.5: put(sx + u, sy + v, zb, "orange_terracotta")
    # muqarnas: corbelled steps in the crown of the iwan, cut sandstone stairs upside down
    for z in range(OUTER, GATE_Z1 + 1):
        for u in range(-6, 7):
            for y in range(IWAN_SPRING, 24):
                inside = pointed(u, y - IWAN_SPRING, IWAN_A)
                below = pointed(u, y - 1 - IWAN_SPRING, IWAN_A)
                if not inside and below and (u, y, z) not in cells:
                    pass
            # one row of hanging stairs along the arch soffit
    for u in range(-6, 7):                       # one hood moulding row inside the crown, at the face only
        for y in range(IWAN_SPRING, 24):
            if pointed(u, y - IWAN_SPRING, IWAN_A) and not pointed(u, y + 1 - IWAN_SPRING, IWAN_A):
                put(u, y, GATE_Z1, "cut_red_sandstone")
    # acacia gate leaves and lanterns hung either side
    for u in (-2, -1, 1, 2):
        for y in (1, 2, 3, 4): put(u, y, zb, "acacia_planks" if y < 4 or abs(u) == 1 else "acacia_planks")
    for u in (-1, 0, 1): put(u, 5, zb, "acacia_planks")
    put(0, 6, zb, "acacia_planks")
    for u in (-5, 5):
        put(u, 9, zb + 1, "iron_chain"); put(u, 8, zb + 1, "lantern", hanging=True)
    # blind niches across the gate's face above the iwan, and corner pilasters standing one proud
    for x in range(-6, 7, 2):
        for y in (24, 25): drop(x, y, GATE_Z1); put(x, y, GATE_Z1 - 1, "cut_red_sandstone")
        put(x, 23, GATE_Z1 + 1, "smooth_sandstone_slab", half="top")
        put(x, 26, GATE_Z1, "cut_red_sandstone")
    for x in (-GATE_HW - 1, GATE_HW + 1):
        for z in range(GATE_Z0, GATE_Z1 + 2):
            for y in range(1, GATE_TOP + 2):
                if z == GATE_Z1 + 1 or z in (GATE_Z0, GATE_Z1): put(x, y, z, "cut_sandstone" if y % 6 else "cut_red_sandstone")
        for y in range(GATE_TOP + 2, GATE_TOP + 5): put(x, y, GATE_Z1 + 1, "cut_sandstone")
        put(x, GATE_TOP + 5, GATE_Z1 + 1, "gold_block")
    for x in range(-GATE_HW, GATE_HW + 1):
        put(x, 1, GATE_Z1 + 1, "cut_sandstone"); put(x, 2, GATE_Z1 + 1, "sandstone_stairs", facing="n") if abs(x) > 6 else None
    # the passage through to the courtyard
    for x in range(-2, 3):
        for z in range(18, GATE_Z0 + 1):
            for y in range(1, 8): carve(x, y, z)
            put(x, 0, z, "cut_red_sandstone" if x == 0 else "smooth_sandstone")
    # the approach: a paved forecourt, two braziers
    for z in range(GATE_Z1 + 1, GATE_Z1 + 10):
        for x in range(-6, 7): put(x, 0, z, "smooth_red_sandstone" if (x + z) % 3 else "cut_red_sandstone")
    for x in (-7, 7):
        put(x, 1, GATE_Z1 + 3, "chiseled_sandstone"); put(x, 2, GATE_Z1 + 3, "campfire")


def minaret(cx, cz):
    """A round minaret: shaft to y 31, a balcony on corbels, a slimmer shaft, an open lantern, a copper dome."""
    for x in range(-5, 6):
        for z in range(-5, 6):
            r = math.hypot(x, z)
            for y in range(0, 31):
                if r <= 3.6 and (r > 2.6 or y in (0, 30)):
                    b = sand(y) if y not in (10, 20) else "cut_red_sandstone"
                    put(cx + x, y, cz + z, b)
            if 3.6 < r <= 4.6:                                   # balcony on corbels
                put(cx + x, 29, cz + z, "smooth_sandstone_stairs", facing=_out(x, z), half="top")
                put(cx + x, 30, cz + z, "smooth_sandstone")
                put(cx + x, 31, cz + z, "sandstone_wall")
            for y in range(31, 41):                              # upper shaft
                if 1.6 < r <= 2.6: put(cx + x, y, cz + z, sand(y) if y != 36 else "waxed_oxidized_cut_copper")
            if r <= 2.6:                                         # lantern: four posts and a floor
                put(cx + x, 41, cz + z, "smooth_sandstone")
                if abs(x) == 2 and abs(z) == 2: pass
            if abs(x) == 2 and abs(z) == 2:
                for y in range(42, 45): put(cx + x, y, cz + z, "cut_sandstone")
            if r <= 2.9 and max(abs(x), abs(z)) <= 2:
                put(cx + x, 41, cz + z, "smooth_sandstone"); put(cx + x, 45, cz + z, "smooth_sandstone")
                put(cx + x, 45, cz + z, "smooth_sandstone")
    put(cx, 42, cz, "lantern")
    for (x, z) in ((2, 1), (2, -1), (-2, 1), (-2, -1), (1, 2), (-1, 2), (1, -2), (-1, -2)):
        put(cx + x, 42, cz + z, "sandstone_wall")
    # the dome: a lathe in copper, gold on top
    prof = [(0, 2.6), (1, 2.6), (2, 2.2), (3, 1.5), (4, 0.6)]
    for x in range(-3, 4):
        for z in range(-3, 4):
            r = math.hypot(x, z)
            for (yy, rr) in prof:
                if r <= rr: put(cx + x, 46 + yy, cz + z, "waxed_weathered_cut_copper" if yy < 2 else "waxed_oxidized_cut_copper")
    put(cx, 51, cz, "gold_block"); put(cx, 52, cz, "lightning_rod")


def _out(x, z):
    return ("e" if x > 0 else "w") if abs(x) > abs(z) else ("s" if z > 0 else "n")


# ------------------------------------------------------------------------------------------------ the court
def courtyard():
    for x in range(-18, 19):
        for z in range(-18, 19):
            k = (abs(x) + abs(z)) % 6
            b = "smooth_sandstone" if k else "cut_red_sandstone"
            if (abs(x) % 6 == 3 and abs(z) % 6 == 3): b = "orange_terracotta"
            put(x, 0, z, b)
    # the pool: an octagon, a cut sandstone rim, water, a fountain in the middle
    for x in range(-7, 8):
        for z in range(-7, 8):
            if abs(x) + abs(z) > 10: continue
            edge = abs(x) == 7 or abs(z) == 7 or abs(x) + abs(z) == 10
            if edge:
                put(x, 1, z, "cut_sandstone"); put(x, 0, z, "cut_sandstone")
            else:
                put(x, 0, z, "water")
    for y in (0, 1, 2): put(0, y, 0, "chiseled_sandstone")
    put(0, 3, 0, "cauldron")
    for (x, z) in ((1, 0), (-1, 0), (0, 1), (0, -1)): put(x, 1, z, "smooth_sandstone_slab")
    # four palms round the pool, a well in a corner
    for (x, z) in ((-12, -12), (12, -12), (-12, 12), (12, 12)):
        palm(x, z, 9 + (x * z > 0))
    for (x, z) in ((-15, 10), (15, -10)):
        well(x, z)
    # striped awnings over market stalls along the east and west arcades
    for side in (-1, 1):
        for zc in (-10, -4, 4, 10):
            stall(side * 17, zc, side)


def palm(x0, z0, h):
    lean = rng.choice([(1, 0), (-1, 0), (0, 1), (0, -1)])
    x, z = x0, z0
    for y in range(1, h + 1):
        if y in (h // 2, h - 2): x += lean[0]; z += lean[1]
        put(x, y, z, "jungle_log")
    put(x, h + 1, z, "jungle_leaves")
    for (dx, dz) in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
        for k in range(1, 5):
            yy = h + 1 - (1 if k >= 3 else 0) - (1 if k >= 4 else 0)
            if abs(dx) + abs(dz) == 2 and k > 3: continue
            put(x + dx * k, yy, z + dz * k, "jungle_leaves")
    put(x, h, z + 1, "cocoa") if False else None


def well(x, z):
    for dx in (-1, 0, 1):
        for dz in (-1, 0, 1):
            if dx or dz: put(x + dx, 1, z + dz, "cut_sandstone")
            else: put(x, 0, z, "water")
    for (dx, dz) in ((-1, -1), (1, 1)):
        for y in (2, 3): put(x + dx, y, z + dz, "acacia_fence")
    for (dx, dz) in ((-1, -1), (0, 0), (1, 1)): put(x + dx, 4, z + dz, "acacia_slab")
    put(x, 3, z, "iron_chain"); put(x, 2, z, "cauldron") if False else None


def stall(x, zc, side):
    cols = ["orange_wool", "white_wool"] if zc % 2 == 0 else ["red_wool", "yellow_wool"]
    for dz in range(-2, 3):
        put(x - side * 2, 1, zc + dz, "acacia_fence") if abs(dz) == 2 else None
        put(x - side * 2, 2, zc + dz, "acacia_fence") if abs(dz) == 2 else None
        for k, xx in enumerate((x, x - side, x - side * 2)):
            put(xx, 4 - (1 if k == 2 else 0), zc + dz, cols[(dz + 2) % 2])
        put(x - side, 1, zc + dz, "barrel", facing="up") if dz in (-1, 1) else None
    put(x - side, 1, zc, "acacia_slab"); put(x - side, 2, zc, "decorated_pot") if False else None


def caravans():
    """Outside the walls: tethered carts, crates and a second well on the approach."""
    for (x, z) in ((-18, 40), (18, 42)):
        for dx in (-1, 0, 1):
            for dz in (-2, -1, 0, 1, 2): put(x + dx, 1, z + dz, "spruce_slab", half="top")
        for dz in (-2, 2): put(x - 2, 1, z + dz, "spruce_fence"); put(x + 2, 1, z + dz, "spruce_fence")
        for dz in (-1, 0, 1):
            put(x, 2, z + dz, "barrel", facing="up") if dz else put(x, 2, z, "hay_block")
        for dx in (-1, 0, 1): put(x + dx, 3, z, "white_wool")
    for (x, z) in ((-26, 38), (27, 37), (-36, 10), (37, -14)):
        palm(x, z, 8)


def write():
    perimeter()
    for cx in (-OUTER + 1, OUTER - 1):
        for cz in (-OUTER + 1, OUTER - 1):
            corner_tower(cx, cz)
    sun_gate()
    for cx in (-15, 15): minaret(cx, OUTER + 1)
    courtyard()
    caravans()

    E = {"base": "ember_sandstone"}
    rng_parts = []
    arc = lambda sides: {"sides": sides, "storey": 0, "style": "round_angle", "lanterns": True}
    rng_parts.append({"part": "house", "style": E, "rect": [-23, 19, 23, 27], "y": 0, "plinth": 1, "storeys": [5, 5],
                      "door": {"side": "n", "at": 6}, "arcade": arc("n"), "roof": {"type": "flat", "parapet": "crenel"},
                      "chimney": False, "bushes": False, "interior": "inn"})
    for x0, x1 in ((-23, -11), (11, 23)):
        rng_parts.append({"part": "house", "style": E, "rect": [x0, -27, x1, -19], "y": 0, "plinth": 1, "storeys": [5, 5],
                          "door": {"side": "s", "at": 0}, "arcade": arc("s"), "roof": {"type": "flat", "parapet": "crenel"},
                          "chimney": False, "bushes": False, "interior": "inn"})
    for x0 in (-27, 19):
        rng_parts.append({"part": "house", "style": E, "rect": [x0, -17, x0 + 8, 17], "y": 0, "plinth": 1, "storeys": [5, 5],
                          "door": {"side": "e" if x0 < 0 else "w", "at": 0}, "arcade": arc("e" if x0 < 0 else "w"),
                          "roof": {"type": "flat", "parapet": "crenel"}, "chimney": False, "bushes": False, "interior": "inn"})
    # the domed hall on the far side, taller than the ranges
    rng_parts.append({"part": "house", "style": {"base": "ember_sandstone", "glass": "yellow_stained_glass_pane"}, "rect": [-9, -29, 9, -15],
                      "y": 0, "plinth": 1, "storeys": [7, 6], "door": {"side": "s", "kind": "grand"},
                      "roof": {"type": "flat", "parapet": "crenel"}, "chimney": False, "bushes": False, "interior": "hall"})
    rng_parts.append({"part": "dome", "at": [0, -22], "r": 7.5, "drum": {"h": 8, "windows": 8, "r": 6.5}, "finial": "gold", "shape": "onion"})

    own = [(-23, 23, 19, 27), (-23, -11, -27, -19), (11, 23, -27, -19), (-27, -19, -17, 17), (19, 27, -17, 17), (-9, 9, -29, -15)]
    for k in [k for k in cells if k[1] > 0 and k not in CARVE and any(a <= k[0] <= b and c <= k[2] <= d for a, b, c, d in own)]:
        del cells[k]
    place = [[x, y, z, v[0]] + ([v[1]] if len(v) > 1 else []) for (x, y, z), v in sorted(cells.items())]
    spec = {"name": "sun_gate", "edition": "bedrock", "materials": {}, "shapes": [], "parts": rng_parts, "place": place}
    with open(os.path.join(HERE, "sun_gate.json"), "w") as f:
        json.dump(spec, f, separators=(",", ":"))
    print("sun_gate.json", len(place), "placed cells,", len(rng_parts), "parts")


if __name__ == "__main__":
    write()
