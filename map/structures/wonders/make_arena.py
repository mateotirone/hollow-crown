"""The Great Horse Fair, rebuilt as a tourney arena (Mateo, 2026-11-12: "Let's build a fucking arena").

    python3 make_arena.py   -> horse_fair.json (a minecraft-builder spec), then run export_wonders.py

A stadium-shaped bowl (two straights and two round ends) in the Vale's stone and timber, banners in red and
white. From the field out: a sanded track round a grass infield with the jousting tilt down the middle and
two striped pavilions, a painted barrier, five tiers of spruce seats, a walkway, then the outer wall in two
arcaded storeys with pilasters, string courses and battlements, flags along the top. A dark arcade runs under
the stands. Four ways in: the Grand Gate on the front (+z) between two tall spired towers with the herald's
gallery over the arch, a horse gate through a spired tower at each end, and the royal box on the far side
under a red hip roof, with the King's Tower rising behind it. The stables and a paddock stand outside the
west gate. Front = +z (the spec's south), as for every wonder.
"""
import json, math, os, random

HERE = os.path.dirname(os.path.abspath(__file__))
rng = random.Random(1812)

LH, R, W = 20, 13, 13          # half length of the straights, field radius, width of the bowl round it
TIERS = 5                      # seat tiers, two deep each, rising one per tier
OUT = R + W                    # outer face of the outer wall (z = +-26, x = +-46)
WALL_TOP = 14                  # top of the outer wall (battlements above)

cells = {}                     # (x, y, z) -> [block, props]


def put(x, y, z, b, **p):
    cells[(x, y, z)] = [b, p] if p else [b]


CARVE = set()


def clear(x, y, z):
    cells.pop((x, y, z), None)


def carve(x, y, z):
    """Air through a part (a passage through a tower): kept even inside a part's footprint."""
    cells[(x, y, z)] = ["air"]; CARVE.add((x, y, z))


def pick(pairs):
    r, acc = rng.random(), 0.0
    for b, w in pairs:
        acc += w
        if r < acc: return b
    return pairs[-1][0]


STONE = [("stone_bricks", 0.55), ("cracked_stone_bricks", 0.12), ("mossy_stone_bricks", 0.1), ("andesite", 0.13), ("cobblestone", 0.1)]
FLOOR = [("gravel", 0.3), ("coarse_dirt", 0.3), ("cobblestone", 0.2), ("stone", 0.2)]
TRACK = [("coarse_dirt", 0.45), ("grass_path", 0.25), ("dirt_with_roots", 0.1), ("sand", 0.2)]


def stone(): return pick(STONE)


def sd(x, z):
    """Signed distance from the field's edge (stadium of radius R), and the outward normal."""
    dx = max(abs(x) - LH, 0)
    r = math.hypot(dx, z)
    if r < 1e-6: return -R, (0, 1)
    return r - R, ((math.copysign(dx, x) / r), z / r)


def outward(n):
    nx, nz = n
    if abs(nx) > abs(nz): return "e" if nx > 0 else "w"
    return "s" if nz > 0 else "n"


def perim(x, z, rad):
    """Position along a ring of radius rad: x on the straights, arc length on the round ends."""
    if abs(x) <= LH: return float(x)
    a = math.atan2(z, abs(x) - LH)
    return math.copysign(LH, x) + math.copysign(1, x) * a * rad


def gate_cut(x, z):
    """True inside one of the four passages through the bowl (grand gate, two horse gates, royal stair)."""
    if abs(x) <= 3 and z > 0: return "grand"
    if abs(z) <= 2 and abs(x) > LH: return "horse"
    return None


def bowl():
    span = OUT + 1
    for x in range(-(LH + span), LH + span + 1):
        for z in range(-span, span + 1):
            d, n = sd(x, z)
            if d > W + 0.5: continue
            face = outward(n)
            gc = gate_cut(x, z)
            # floor layer under everything
            if d <= -4: put(x, 0, z, "grass_block")
            elif d <= 0: put(x, 0, z, pick(TRACK))
            else: put(x, 0, z, pick(FLOOR))
            if d <= 0: continue
            if gc and d < W - 0.5:
                put(x, 0, z, pick(TRACK))           # the passage floor is track
                continue
            if d <= 1:                                # painted barrier, three high, capped
                for y in (1, 2): put(x, y, z, "stripped_spruce_log" if int(perim(x, z, R)) % 4 == 0 else "spruce_planks")
                put(x, 3, z, "spruce_slab")
                continue
            if d <= 1 + 2 * TIERS:                    # tiers: seat (front) then footway (back), one up per tier
                i = int((d - 1 - 1e-6) // 2)
                top = 3 + i
                front = (d - 1 - 2 * i) <= 1
                if front:
                    put(x, top, z, "spruce_stairs", facing=face)
                    for y in range(max(1, top - 2), top): put(x, y, z, stone())
                    if i == 0:
                        for y in range(1, top): put(x, y, z, stone())
                else:
                    put(x, top, z, "spruce_planks")
                    put(x, top - 1, z, "spruce_slab", half="top")
                continue
            if d <= W - 1:                            # top walkway behind the last tier
                put(x, 3 + TIERS, z, "spruce_planks")
                put(x, 2 + TIERS, z, "spruce_slab", half="top")
                if int(perim(x, z, R + W - 1.5)) % 6 == 0:          # posts under the stands carry it
                    for y in range(1, 2 + TIERS): put(x, y, z, "stripped_spruce_log")
                continue
            outer_wall(x, z, d, n, face)


def outer_wall(x, z, d, n, face):
    """Two arcaded storeys, pilasters on the piers, string courses, battlements, flags."""
    s = perim(x, z, OUT - 0.5)
    k = (s + 3) % 6                                   # 0..6 along each bay, arch in the middle three
    in_arch = 1.5 <= k <= 4.5
    mid = abs(k - 3) < 0.5
    gc = gate_cut(x, z)
    for y in range(1, WALL_TOP + 1):
        open_low = in_arch and (y <= 3 or (y == 4 and mid)) and not gc
        open_up = in_arch and (8 <= y <= 9 or (y == 10 and mid)) and not gc
        if open_low or open_up:
            clear(x, y, z)
        elif y in (6, 12):
            put(x, y, z, "polished_andesite")
        else:
            put(x, y, z, stone())
    # battlements on top
    put(x, WALL_TOP + 1, z, stone())
    if int(s) % 2 == 0: put(x, WALL_TOP + 2, z, stone())
    # pilasters on the piers, one out
    nx, nz = n
    ox, oz = round(x + nx * 1.2), round(z + nz * 1.2)
    if (k < 0.75 or k > 5.25) and sd(ox, oz)[0] > d + 0.3 and not gc:
        for y in range(1, WALL_TOP): put(ox, y, oz, "stone_brick_wall" if y not in (5, 11) else "stone_bricks")
        put(ox, 0, oz, "polished_andesite")
        nb = int(round((s + 3) / 6))
        if nb % 2 == 0:                               # a long banner hung on every other pier
            bx, bz = round(x + nx * 2.2), round(z + nz * 2.2)
            if sd(bx, bz)[0] > d + 1.3:
                col = "red_wool" if nb % 4 == 0 else "white_wool"
                for y in range(7, 12): put(bx, y, bz, col)
                put(bx, 12, bz, "dark_oak_fence")
                put(bx, 6, bz, "red_wool" if col == "white_wool" else "white_wool")
        elif (s // 6) % 1 == 0:
            lx, lz = round(x + nx * 2.2), round(z + nz * 2.2)
            pass
    # string courses one out at the storey lines
    for y in (6, 12):
        if (ox, y, oz) not in cells and sd(ox, oz)[0] > d + 0.3:
            put(ox, y, oz, "stone_brick_stairs", facing=face, half="top")
    # flags every 12 along the top
    if int(round(s)) % 12 == 0 and not gc:
        for y in range(WALL_TOP + 2, WALL_TOP + 7): put(x, y, z, "spruce_fence")
        put(x, WALL_TOP + 7, z, "lightning_rod")
        col = "red_wool" if int(round(s)) % 24 == 0 else "white_wool"
        tx, tz = round(x - n[0]), round(z - n[1])
        for y in (WALL_TOP + 5, WALL_TOP + 6): put(tx, y, tz, col)
        put(tx, WALL_TOP + 4, tz, col)


def field():
    # the tilt: a painted barrier down the middle for jousting
    for x in range(-17, 18):
        if x % 4 == 1 or abs(x) == 17:
            put(x, 1, 0, "stripped_spruce_log"); put(x, 2, 0, "stripped_spruce_log"); put(x, 3, 0, "spruce_fence")
        else:
            put(x, 1, 0, "spruce_fence")
            put(x, 2, 0, "red_wool" if (x // 2) % 2 == 0 else "white_wool")
    for x in (-17, 17):
        put(x, 4, 0, "red_wool" if x < 0 else "white_wool")
    # sand strips either side of the tilt, where the horses run
    for x in range(-18, 19):
        for z in (-2, -1, 1, 2): put(x, 0, z, pick([("sand", 0.6), ("coarse_dirt", 0.4)]))
    # two striped pavilions at the ends of the infield
    for cx, a, b in ((-27, "red_wool", "white_wool"), (27, "blue_wool", "white_wool")):
        tent(cx, 0, a, b)
    # lance racks and hay by the tilt ends
    for x in (-20, 20):
        for z in (-3, 3):
            put(x, 1, z, "hay_block"); put(x, 2, z, "hay_block")
    for x, z in ((-21, -2), (-21, 2), (21, -2), (21, 2)):
        put(x, 1, z, "spruce_fence"); put(x, 2, z, "spruce_fence"); put(x, 3, z, "lightning_rod")


def tent(cx, cz, a, b):
    r, h = 3.5, 6
    for x in range(-4, 5):
        for z in range(-4, 5):
            rr = math.hypot(x, z)
            if rr > r: continue
            top = 1 + int((h - 1) * (1 - rr / r) + 0.5)
            sector = int(((math.atan2(z, x) + math.pi) / (2 * math.pi)) * 8) % 2
            col = a if sector == 0 else b
            if rr > r - 1.2:
                for y in range(1, top + 1): put(cx + x, y, cz + z, col)
            else:
                put(cx + x, top, cz + z, col)
    for y in range(1, h + 1): put(cx, y, cz, "spruce_fence")
    put(cx, h + 1, cz, "spruce_fence"); put(cx, h + 2, cz, a)
    for z in (r, ):
        clear(cx, 1, cz + 3); clear(cx, 2, cz + 3)       # the door flap


ARCH_GATE = []


def grand_gate():
    """The Grand Gate on the front: a pointed archway between two spired towers, the herald's gallery above."""
    z0, z1 = OUT - 5, OUT + 5                         # gatehouse depth, standing proud of the wall
    for x in range(-3, 4):                            # passage walls and vault
        for z in range(R + 1, z1 + 1):
            for y in range(1, 10):
                clear(x, y, z)
            put(x, 0, z, pick(TRACK))
    for x in range(-12, 13):
        for z in range(z0, z1 + 1):
            if abs(x) <= 3 and z >= z0:
                # the arch: 7 wide, pointed to y 9
                for y in range(1, 23):
                    inside = y <= 6 or (y == 7 and abs(x) <= 2) or (y == 8 and abs(x) <= 1) or (y == 9 and x == 0)
                    if not inside: put(x, y, z, stone())
                continue
            if abs(x) <= 12 and abs(x) > 3:
                pass                                  # towers built by parts
    # the gate's crown between the towers: battlements, a great banner hung over the arch
    for x in range(-3, 4):
        put(x, 23, z1, stone())
        if x % 2 == 0: put(x, 24, z1, stone())
        for y in range(11, 21):
            put(x, y, z1 + 1, "red_wool" if abs(x) <= 2 else "spruce_planks") if y >= 12 else None
    for x in range(-2, 3):
        put(x, 11, z1 + 1, "spruce_slab", half="top")
        put(x, 21, z1 + 1, "dark_oak_fence")
    # a white charge on the banner: a horse's head, roughly
    for (x, y) in ((0, 18), (1, 18), (-1, 17), (0, 17), (1, 17), (-1, 16), (0, 16), (-1, 15), (0, 15), (1, 14), (0, 14), (-1, 14)):
        put(x, y, z1 + 1, "white_wool")
    # herald's gallery on corbels over the arch, facing the approach
    for x in range(-4, 5):
        put(x, 10, z1 + 1, "stone_brick_stairs", facing="n", half="top")
        put(x, 10, z1 + 2, "spruce_slab", half="top")
        put(x, 11, z1 + 3, "dark_oak_fence")
        put(x, 10, z1 + 3, "stone_brick_stairs", facing="n", half="top")
    # portcullis teeth hanging in the arch head
    for x in range(-2, 3): put(x, 7 if abs(x) <= 2 else 6, z1 - 1, "iron_bars")
    put(0, 8, z1 - 1, "iron_bars"); put(-1, 8, z1 - 1, "iron_bars"); put(1, 8, z1 - 1, "iron_bars")
    # lanterns either side of the arch
    for x in (-4, 4):
        put(x, 5, z1 + 1, "lantern")
    # the approach: a broad path and banner poles
    for z in range(z1 + 1, z1 + 9):
        for x in range(-4, 5): put(x, 0, z, pick(TRACK))
    for x in (-6, 6):
        for z in (z1 + 3, z1 + 7):
            for y in range(1, 7): put(x, y, z, "spruce_fence")
            put(x, 7, z, "lantern")
            put(x - (1 if x < 0 else -1), 6, z, "red_wool"); put(x - (1 if x < 0 else -1), 5, z, "red_wool")


def horse_gates():
    """At each end a square tower straddles the wall with a passage through it for the horses."""
    for sx in (-1, 1):
        x_in = sx * (LH + R + 1)
        for x in range(LH + R + 1, OUT + 7):
            for z in range(-2, 3):
                for y in range(1, 7): carve(sx * x, y, z)
                put(sx * x, 0, z, pick(TRACK))
        for x in range(OUT + 6, OUT + 12):
            for z in range(-3, 4): put(sx * x, 0, z, pick(TRACK))


def royal_box():
    # the stand's centre on the far side is cut into a stair up to the royal box
    for x in range(-2, 3):
        for z in range(-(R + 2 * TIERS + 1), -R):
            d, _ = sd(x, z)
            i = int((d - 1 - 1e-6) // 2) if d > 1 else -1
            pass


def stables():
    # paddock fence west of the west horse gate
    xs, xe, zs, ze = -(OUT + 26), -(OUT + 8), -24, -5
    for x in range(xs, xe + 1):
        for z in (zs, ze):
            put(x, 1, z, "spruce_fence"); put(x, 0, z, "grass_block")
    for z in range(zs, ze + 1):
        for x in (xs, xe):
            put(x, 1, z, "spruce_fence")
    put(xe, 1, -14, "spruce_fence_gate", facing="e") if False else None
    for x, z in ((xs + 4, zs + 6), (xs + 11, zs + 12), (xs + 15, zs + 4)):
        put(x, 1, z, "hay_block")
    # water trough
    for x in range(xs + 6, xs + 10):
        put(x, 1, ze - 2, "cauldron")


def write():
    bowl()
    field()
    grand_gate()
    horse_gates()
    stables()
    # parts own their footprints: nothing of the bowl is written inside a tower or the royal box
    own = [(-12, -4, OUT - 4, OUT + 4), (4, 12, OUT - 4, OUT + 4), (OUT + LH - 5, OUT + LH + 5, -5, 5),
           (-(OUT + LH + 5), -(OUT + LH - 5), -5, 5), (-6, 6, -(OUT + 14), -(OUT + 2)), (-10, 10, -(OUT + 1), -(R + 4))]
    for k in [k for k in cells if k[1] > 0 and k not in CARVE and any(a <= k[0] <= b and c <= k[2] <= d for a, b, c, d in own)]:
        del cells[k]
    place = []
    for (x, y, z), v in sorted(cells.items()):
        place.append([x, y, z, v[0]] + ([v[1]] if len(v) > 1 else []))

    def tower_windows(n, door="n"):
        w = {}
        for side in "nsew":
            w[side] = [{"at": 0, "storey": k, "w": 1, "h": 2, "sill": "slab"} for k in range(1, n - 1) if not (side == door and k == 0)]
            w[side] += [{"at": a, "storey": n - 1, "w": 1, "h": 3, "sill": "slab"} for a in (-2, 2)]
        return w
    gate_tower = lambda x0, x1, z0, z1, h, door="n": {
        "part": "house", "style": "vale_stone", "rect": [x0, z0, x1, z1], "y": 0, "plinth": 2,
        "storeys": [6] * (h // 6), "frame": "stone", "door": {"side": door, "kind": "house"}, "windows": tower_windows(h // 6, door), "shutters": 0,
        "chimney": False, "bushes": False, "interior": "tower", "roof": {"type": "hip", "pitch": 2}}
    spire = lambda x0, x1, z0, z1, rows=2: {"part": "spire", "rect": [x0, z0, x1, z1], "rows": rows, "overhang": 1,
                                            "roof": "slate", "trim": "dark_oak_planks", "finial": "tall"}
    parts = []
    # Grand Gate towers (9 x 9, 26 high, steep spires), front
    for x0 in (-12, 4):
        parts.append(gate_tower(x0, x0 + 8, OUT - 4, OUT + 4, 24))
        parts.append(spire(x0, x0 + 8, OUT - 4, OUT + 4, 3))
    # horse gate towers at the ends (11 x 11, 18 high)
    for x0 in (OUT + LH - 5, -(OUT + LH + 5)):
        parts.append(gate_tower(x0, x0 + 10, -5, 5, 18))
        parts.append(spire(x0, x0 + 10, -5, 5, 2))
    # royal box: an open pavilion over the far stand under a red hip roof
    parts.append({"part": "house", "style": {"base": "vale_stone", "roof": "bricks"}, "rect": [-10, -(OUT + 1), 10, -(R + 4)],
                  "y": 3 + TIERS, "plinth": 1, "storeys": [7], "frame": "stone", "door": {"side": "n", "kind": "grand"},
                  "windows": "auto", "arcade": {"sides": "sew", "storey": 0, "lanterns": True}, "chimney": False,
                  "bushes": False, "interior": "hall", "roof": {"type": "hip", "pitch": 1}})
    # the King's Tower behind it, the tallest thing in the Fair
    parts.append(gate_tower(-6, 6, -(OUT + 14), -(OUT + 2), 36))
    parts.append(spire(-6, 6, -(OUT + 14), -(OUT + 2), 3))
    # stables outside the west gate
    parts.append({"part": "house", "style": "vale_timber", "rect": [-(OUT + 26), 7, -(OUT + 10), 19], "y": 0,
                  "plinth": 1, "storeys": [5], "door": {"side": "n", "kind": "large"}, "windows": "auto",
                  "roof": {"type": "gable", "ridge": "x", "pitch": 1}, "interior": "storage", "chimney": False})
    spec = {"name": "great_horse_fair", "edition": "bedrock",
            "materials": {"slate": {"block": "deepslate_tiles"}},
            "shapes": [], "parts": parts, "place": place}
    with open(os.path.join(HERE, "horse_fair.json"), "w") as f:
        json.dump(spec, f, separators=(",", ":"))
    print("horse_fair.json", len(place), "placed cells,", len(parts), "parts")


if __name__ == "__main__":
    write()
