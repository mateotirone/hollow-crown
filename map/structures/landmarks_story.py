"""The story's places out in the land (lore/data/world.js PLACES): Crownhold, Bellhollow, the Ashen Gate chapterhouse
and its Burned Archive, the Ashen Watch, Corvin's Tower, Old Mag's hut, Nell Sedge's raft-house, the Deepforge and
the Cinder Roost. Same design format as landmarks.py (minecraft-builder skill specs + placing keys, tomes included), plus
    npcs  [[x, y, z, lore npc id]]  story characters the game stands there once, when it is built
"""
import math
from landmarks import D, h3, CARD, oak, palm, post

STONE_RUIN = [("stone_bricks", 4), ("mossy_stone_bricks", 3), ("cracked_stone_bricks", 2), ("cobblestone", 1), ("mossy_cobblestone", 1)]
GREY = [("stone_bricks", 3), ("andesite", 1), ("polished_andesite", 1), ("tuff_bricks", 2), ("cracked_stone_bricks", 1)]


def ruin_height(d, x, z, base, var, salt=0):
    """A broken top: high in places, low in others, in soft lumps."""
    return base - int(var * (d.r(x // 2, 77, z // 2, salt) ** 1.3))


def ruin_s(d, x, z, base, var, salt=0):
    """A broken top for the big ruins (Crownhold's castle): long stretches still standing, falling away in slopes and
    steps to gaps, not a comb of single columns. Smooth noise along the wall (x + z runs along any straight wall)."""
    u = (x + z * 1.37) * 0.11
    ph = [d.r(salt, k, 5) * math.tau for k in range(3)]
    n = 0.5 + 0.28 * math.sin(u + ph[0]) + 0.16 * math.sin(2.3 * u + ph[1]) + 0.08 * math.sin(5.1 * u + ph[2])
    n = min(1.0, max(0.0, (n - 0.35) / 0.6))
    return base - int(var * n ** 1.4) - (1 if d.r(x, 78, z, salt) < 0.25 else 0)


def wall_line(d, a, b, base, var, mix=STONE_RUIN, thick=1, salt=0, top_fn=None):
    (x0, z0), (x1, z1) = a, b
    n = max(abs(x1 - x0), abs(z1 - z0))
    for k in range(n + 1):
        x = round(x0 + (x1 - x0) * k / max(n, 1)); z = round(z0 + (z1 - z0) * k / max(n, 1))
        top = (top_fn or ruin_height)(d, x, z, base, var, salt)
        for t in range(thick):
            xx, zz = (x + t, z) if abs(z1 - z0) >= abs(x1 - x0) else (x, z + t)
            for y in range(1, top + 1): d.put(xx, y, zz, d.pick(xx, y, zz, mix, salt))


def rubble(d, cx, cz, r, n, mix=STONE_RUIN, salt=0):
    for k in range(n):
        a = d.r(k, 1, salt) * 2 * math.pi; rr = r * math.sqrt(d.r(k, 2, salt))
        x, z = cx + round(math.sin(a) * rr), cz + round(math.cos(a) * rr)
        t = d.r(k, 3, salt)
        if t < 0.45: d.put(x, 1, z, d.pick(x, 1, z, mix, salt))
        elif t < 0.75: d.put(x, 1, z, "stone_brick_slab" if t < 0.6 else "cobblestone_slab", half="bottom")
        else: d.put(x, 1, z, "mossy_stone_brick_stairs", facing="nsew"[int(d.r(k, 4, salt) * 4)])


def bell_frame(d, cx, y0, cz, w=2, tall=5, wood="dark_oak", axis="x"):
    """An empty bell frame: two posts, a beam, a chain with nothing on it."""
    log = f"stripped_{wood}_log"
    for s in (-w, w):
        x, z = (cx + s, cz) if axis == "x" else (cx, cz + s)
        for k in range(tall): d.put(x, y0 + k, z, log, axis="y")
    for s in range(-w - 1, w + 2):
        x, z = (cx + s, cz) if axis == "x" else (cx, cz + s)
        d.put(x, y0 + tall, z, log, axis=axis)
    d.put(cx, y0 + tall - 1, cz, "iron_chain", axis="y")


# ---------------------------------------------------------------- Crownhold


COPPER = [("oxidized_copper", 3), ("weathered_copper", 3), ("exposed_copper", 1), ("oxidized_cut_copper", 1)]
DEEP = [("deepslate_bricks", 3), ("cracked_deepslate_bricks", 2), ("cobbled_deepslate", 1)]


def ring_tower(d, cx, cz, r, base, var, salt=0, floors=(), door=None, y0=1):
    """A round tower gone to ruin: a shell one block thick, its top broken in lumps, slits every few blocks, what
    is left of its floors (joists and planks clinging to the wall), a door gap on one side ("n"/"s"/"e"/"w")."""
    R = int(r + 1)
    for x in range(-R, R + 1):
        for z in range(-R, R + 1):
            rr = math.hypot(x, z)
            if rr > r: continue
            X, Z = cx + x, cz + z
            d.put(X, y0 - 1, Z, d.pick(X, 0, Z, [("stone_bricks", 3), ("cobblestone", 1), ("moss_block", 1), ("gravel", 1)], salt))
            if rr > r - 1.05:
                top = ruin_s(d, X, Z, base, var, salt)
                for y in range(y0, y0 + top):
                    slit = (y % 5 == 3) and (x == 0 or z == 0) and rr > r - 0.5
                    if slit: d.air(X, y, Z)
                    else: d.put(X, y, Z, d.pick(X, y, Z, STONE_RUIN if y > 2 else GREY, salt))
            else:
                for fy in floors:
                    if d.r(X, fy, Z, salt + 3) < 0.45 and rr > r - 2.6: d.put(X, y0 + fy, Z, "spruce_planks" if d.r(X, 1, Z, salt) < 0.6 else "spruce_slab", **({} if d.r(X, 1, Z, salt) < 0.6 else {"half": "top"}))
    if door:
        dx, dz = CARD[door]
        for k in range(int(r) - 1, R + 1):
            for y in range(y0, y0 + 3): d.air(cx + dx * k, y, cz + dz * k)


def box_ruin(d, x0, z0, x1, z1, base, var, salt=0, floors=(), doors=(), mix=STONE_RUIN, floor=None, y0=1, windows=True):
    """A roofless building: walls broken to lumps, window gaps every third block on the upper floors, a door gap at
    each (side, offset along the wall), and joists and planks left at each upper floor line where the wall still
    stands to hold them."""
    floor = floor or [("stone_bricks", 3), ("cracked_stone_bricks", 2), ("mossy_stone_bricks", 1), ("moss_block", 1), ("gravel", 1)]
    for x in range(x0, x1 + 1):
        for z in range(z0, z1 + 1):
            edge = x in (x0, x1) or z in (z0, z1)
            d.put(x, y0 - 1, z, d.pick(x, y0 - 1, z, floor, salt))
            if edge:
                top = ruin_s(d, x, z, base, var, salt)
                for y in range(y0, y0 + top):
                    run = (z if x in (x0, x1) else x)
                    if windows and y % 5 in (2, 3) and run % 3 == 0 and not (x in (x0, x1) and z in (z0, z1)) and y > 1: d.air(x, y, z)
                    else: d.put(x, y, z, d.pick(x, y, z, mix, salt))
            else:
                for y in range(y0, y0 + base): d.air(x, y, z) if d.get(x, y, z) is None else None
                for fy in floors:
                    near = min(x - x0, x1 - x, z - z0, z1 - z)
                    if near <= 2 and d.r(x, fy, z, salt + 5) < 0.55: d.put(x, y0 + fy, z, "spruce_planks")
                    elif d.r(x, fy, z, salt + 6) < 0.12: d.put(x, y0 + fy, z, "stripped_spruce_log", axis="x" if (x1 - x0) < (z1 - z0) else "z")
    for side, off in doors:
        if side in "ns":
            z = z0 if side == "n" else z1
            for x in range(off - 1, off + 2):
                for y in range(y0, y0 + 3): d.air(x, y, z)
            d.put(off, y0 + 3, z, "stone_bricks")
        else:
            x = x0 if side == "w" else x1
            for z in range(off - 1, off + 2):
                for y in range(y0, y0 + 3): d.air(x, y, z)
            d.put(x, y0 + 3, off, "stone_bricks")


def fallen_bell(d, cx, y, cz, axis="x", n=6, r0=1.4, r1=3.4, flip=1, salt=0):
    """A great bell lying on its side where it fell: a hollow bronze cone gone green, crown end closed, the lip
    flared at the open end, half sunk in the ground; the clapper fallen out beside it."""
    for k in range(n):
        t = k / (n - 1); r = r0 + (r1 - r0) * t ** 1.6 + (0.5 if k == n - 1 else 0)
        for a in range(-int(r) - 1, int(r) + 2):
            for b in range(-int(r) - 1, int(r) + 2):
                q = math.hypot(a, b)
                if q > r or b < -1: continue                         # sunk: nothing below a block under the axis
                if q > r - 1.0 or k == 0:
                    off = flip * (k - n // 2)
                    X, Z = (cx + off, cz + a) if axis == "x" else (cx + a, cz + off)
                    d.put(X, y + 1 + b, Z, d.pick(X, y + b, Z, COPPER, salt))
    off = flip * (n // 2 + 2)
    X, Z = (cx + off, cz + 1) if axis == "x" else (cx + 1, cz + off)
    d.put(X, y + 1, Z, "iron_block"); d.put(X, y + 2, Z, "iron_chain", axis="y")


def crownhold_hall():
    """Crownhold, the old king's castle, on its rise above the Vale (Mateo 2026-11-13: "The Hall of Bells needs to be
    much bigger", "this should be a castle"). Everything inside the curtain is one rigid piece so it stands level:
      the Hall of Bells   27 x 51, roofless, two aisles of broken pillars, four empty bell frames down the nave, the
                          dais at the north end and the cellar under it with the crack the King sat beside; the bell
                          tower over the south door broken off, its top lying in the ward in pieces, the bells fallen
      the royal wing      east of the Hall: the King's bedchamber and the nursery (royal_wing)
      the long gallery    north of the inner court: every portrait of the King cut out of its frame
      the chapel          east of the court, its altar under a broken window
      the guest range     south of the court, two floors with the floor between them fallen in
      the keep            the donjon in the north-west, four floors high where it still stands
      the kitchens        west of the Hall, the great hearth
      the curtain         round towers at the corners and on the sides, one fallen, and the great gatehouse south
    Front (+z) is the gate; the town spills down the slope outside (crownhold_walls)."""
    d = D("crownhold_hall", "rigid", seed=201, fill="stone", top="keep", ease=5, clearTo=34,
          fillRects=[[-47, -41, 47, 53]])
    W, L = 13, 25   # half sizes: 27 x 51
    # ---- the ground inside the walls: worn paving, grass and gravel coming through
    for x in range(-43, 44):
        for z in range(-37, 46):
            t = d.r(x, 0, z, 31)
            d.put(x, 0, z, "grass_block" if t < 0.35 else d.pick(x, 0, z, [("cobblestone", 2), ("mossy_cobblestone", 2), ("gravel", 1), ("stone_bricks", 1), ("coarse_dirt", 1)], 2))
            if t < 0.06: d.put(x, 1, z, "short_grass")
    # ---- the Hall of Bells
    for x in range(-W, W + 1):
        for z in range(-L, L + 1):
            edge = x in (-W, W) or z in (-L, L)
            d.put(x, 0, z, d.pick(x, 0, z, [("stone_bricks", 3), ("cracked_stone_bricks", 2), ("mossy_stone_bricks", 2), ("moss_block", 1), ("gravel", 1)]))
            if edge:
                top = ruin_s(d, x, z, 17, 12)
                for y in range(1, top + 1): d.put(x, y, z, d.pick(x, y, z, STONE_RUIN))
            else:
                for y in range(1, 20): d.air(x, y, z)
    # buttresses on the long walls, every 6, two deep, and tall lancet windows between them
    for z in range(-L + 3, L - 2, 6):
        for s in (-1, 1):
            for k, x in enumerate((s * (W + 1), s * (W + 2))):
                tall = 13 - k * 4 - abs(z) // 10
                for y in range(1, tall): d.put(x, y, z, "stone_bricks" if y % 4 else "polished_andesite")
                d.put(x, tall, z, "stone_brick_stairs", facing="w" if s > 0 else "e")
            for wz in (z + 2, z + 3, z + 4):
                if abs(wz) < L - 1:
                    for y in range(4, 12):
                        if d.get(s * W, y, wz) and not (wz == z + 3 and y >= 11): d.air(s * W, y, wz)
    # the aisles: two rows of pillars, the arches between them, most broken off
    for s in (-1, 1):
        x = s * 7
        for z in range(-L + 4, L - 3, 5):
            tall = 13 if d.r(x, 5, z, 41) < 0.55 else 4 + int(6 * d.r(x, 6, z, 41))
            for y in range(1, tall + 1): d.put(x, y, z, "polished_andesite" if y in (1, tall) else "stone_bricks")
            if tall >= 13:
                for dz in (-2, -1, 1, 2):
                    if abs(z + dz) < L - 1 and d.r(x, 7, z + dz, 42) < 0.7:
                        d.put(x, 12 if abs(dz) == 2 else 13, z + dz, "stone_brick_stairs", facing="s" if dz < 0 else "n", half="top")
            elif d.r(x, 8, z, 43) < 0.8:                              # the fallen drum of a pillar beside its stump
                for k in range(1, 4): d.put(x - s * k, 1, z + 1, "stone_bricks" if k < 3 else "polished_andesite")
    # the door: a tall pointed arch in the south gable, five wide, under the bell tower
    for y in range(1, 8):
        for x in range(-2, 3): d.air(x, y, L)
    for (x, y, f) in ((-2, 6, "w"), (2, 6, "e"), (-1, 7, "w"), (1, 7, "e")): d.put(x, y, L, "stone_brick_stairs", facing=f, half="top")
    d.put(0, 8, L, "chiseled_stone_bricks")
    # the bell tower over the door, nine square, broken off at about 30; its top lies in the ward
    for x in range(-4, 5):
        for z in range(L - 2, L + 7):
            if abs(x) == 4 or z in (L - 2, L + 6):
                top = 31 - int(10 * d.r(x, 99, z) ** 0.7)
                for y in range(1, top + 1):
                    if not (abs(x) <= 2 and z in (L - 2, L + 6) and y <= 7):
                        slit = y % 6 == 4 and (x == 0 or z == L + 2)
                        d.put(x, y, z, "air" if slit else d.pick(x, y, z, STONE_RUIN, 3))
            elif not (abs(x) <= 2):
                pass
    for x in range(-2, 3):
        for y in range(1, 8): d.air(x, y, L + 6)
    for (x, y, f) in ((-2, 6, "w"), (2, 6, "e"), (-1, 7, "w"), (1, 7, "e")): d.put(x, y, L + 6, "stone_brick_stairs", facing=f, half="top")
    bell_frame(d, 0, 21, L + 2, w=3, tall=5)
    for x in range(-3, 4):
        for z in range(L - 1, L + 6): d.put(x, 20, z, "dark_oak_planks" if d.r(x, 20, z) < 0.65 else "air")
    for z in range(L - 1, L + 6, 2):                                  # the ladder of floors inside it, mostly gone
        if d.r(0, 9, z) < 0.5: d.put(-3, 9, z, "dark_oak_slab", half="top")
    # its top, lying in the ward where it came down: drums of tower in a broken line, and the great bell
    for k in range(0, 17):
        if k in (5, 6, 11): continue
        cxz = (6 + k, L + 9 + k // 4)
        for a in range(-4, 5):
            for b in range(0, 6):
                if (abs(a) == 4 or b in (0, 5)) and not (b == 5 and d.r(k, a, 3) < 0.4):
                    d.put(cxz[0], b + 1 if b < 5 else 5, cxz[1] + a, d.pick(cxz[0], b, cxz[1] + a, STONE_RUIN, 7)) if b < 5 else None
    rubble(d, 14, L + 12, 9, 60, salt=17)
    fallen_bell(d, 26, 0, L + 11, axis="x", n=7, r0=1.6, r1=3.6, salt=1)
    # inside it, where its open mouth looks back at the Hall: Corvin's ninth book, sealed with the King's wax until
    # three of the five have fallen (lore/places.js TOME_GATES)
    d.meta.setdefault("tomes", []).append([27, 1, L + 11, "corv_09"])
    # the empty bell frames down the nave: where the Founding Bell's sisters hung; one bell still on the floor, cracked
    for z in (-15, -5, 5, 15):
        bell_frame(d, 0, 1, z, w=4, tall=9, wood="dark_oak")
        for s in (-1, 1): d.put(s * 4, 1, z - 1, "dark_oak_stairs", facing="s"); d.put(s * 4, 1, z + 1, "dark_oak_stairs", facing="n")
    fallen_bell(d, -2, 0, 9, axis="z", n=5, r0=1.2, r1=2.6, flip=-1, salt=2)
    # fallen roof timbers and rubble in the nave
    for z in range(-20, 20, 5):
        if d.r(z, 1, 1) < 0.6:
            for x in range(-11, 12):
                if d.r(x, 2, z) < 0.75 and d.get(x, 1, z + (x // 5)) in (None, "air"): d.put(x, 1, z + (x // 5), "stripped_dark_oak_log", axis="x")
    rubble(d, 0, 0, 11, 80, salt=5)
    # the dais at the north end, the throne gone (its steps and the stone it stood on), the cellar stair beside it
    for x in range(-6, 7):
        for z in range(-L + 1, -L + 5): d.put(x, 1, z, "polished_andesite" if z > -L + 1 else "stone_bricks")
    for x in range(-4, 5): d.put(x, 1, -L + 5, "stone_brick_stairs", facing="n")
    for x in (-1, 0, 1): d.put(x, 2, -L + 2, "polished_deepslate")
    # the cellar: the King's crack in the floor
    for x in range(-5, 6):
        for z in range(-L + 1, -L + 12):
            for y in range(-6, 0):
                edge = x in (-5, 5) or z in (-L + 1, -L + 11) or y == -6
                if edge: d.put(x, y, z, d.pick(x, y, z, DEEP))
                else: d.air(x, y, z)
    for k, y in enumerate(range(0, -6, -1)):   # a stair down along the east wall
        d.air(4, y, -L + 6 + k)
        d.put(4, y - 1, -L + 6 + k, "deepslate_brick_stairs", facing="s")
        for yy in (y + 1, y + 2): d.air(4, yy, -L + 6 + k)
    for z in range(-L + 3, -L + 10):           # the crack, running across the floor and up the north wall
        x = round(1.5 * math.sin(z * 0.9))
        d.put(x, -6, z, "tinted_glass" if d.r(x, -6, z) < 0.5 else "crying_obsidian")
    for y in range(-5, -1): d.put(round(1.5 * math.sin((-L + 2) * 0.9)), y, -L + 1, "crying_obsidian" if y % 2 else "tinted_glass")
    d.put(-3, -5, -L + 8, "lantern", hanging=False); d.put(-3, -5, -L + 9, "dark_oak_stairs", facing="w")   # where he sat with his lamp
    # ---- the royal wing, off the Hall's east wall at its north end (laid out for the old Hall, moved across)
    t = D("crownhold_wing", seed=201); royal_wing(t, 9, 17)
    sx, sz = W - 9, -L + 17
    for (x, y, z), v in t.cells.items(): d.cells[(x + sx, y, z + sz)] = v
    d.meta.setdefault("tomes", []).extend([[x + sx, y, z + sz, i] for x, y, z, i in t.meta.get("tomes", [])])
    for y in (1, 2, 3):                                                # the way through the buttress line
        for x in range(W + 1, W + 3): d.air(x, y, -11 + sz)
    crownhold_castle(d, W, L)
    d.meta["mark"] = [0, 1, 0]
    return d


def crownhold_castle(d, W, L):
    """The rest of the castle round the Hall (see crownhold_hall)."""
    # ---- the long gallery, north of the court (x 15..41, z -33..-25): the portraits of the old kings in their frames
    # down both walls; every one of the last King cut out, the frame left empty (no one was to remember his face)
    GX0, GX1, GZ0, GZ1 = 15, 41, -35, -25
    box_ruin(d, GX0, GZ0, GX1, GZ1, 10, 6, salt=51, floors=(), doors=[("s", 21), ("w", -30)], windows=False,
             floor=[("dark_oak_planks", 3), ("spruce_planks", 1), ("moss_block", 1)])
    for x in range(GX0 + 2, GX1 - 1, 3):
        for z, f in ((GZ0 + 1, "s"), (GZ1 - 1, "n")):
            wz = GZ0 if f == "s" else GZ1
            if d.get(x, 4, wz) in (None, "air") or d.get(x, 5, wz) in (None, "air"): continue
            last = (x + (z > -30)) % 2 == 0
            for y in (3, 4, 5):                                         # the frame: pale gilt wood round a picture
                d.put(x - 1, y, z, "stripped_birch_log", axis="y"); d.put(x + 1, y, z, "stripped_birch_log", axis="y")
            d.put(x, 3, z, "stripped_birch_log", axis="x"); d.put(x, 5, z, "stripped_birch_log", axis="x")
            if last: d.air(x, 4, z); d.put(x, 4, z - (1 if f == "s" else -1), "black_concrete")   # cut out: the wall behind
            else: d.put(x, 4, z, d.pick(x, 4, z, [("red_terracotta", 1), ("brown_terracotta", 1), ("blue_terracotta", 1), ("green_terracotta", 1)], 52))
    for x in range(GX0 + 3, GX1 - 2, 6):                                 # benches down the middle, a rug gone to rags
        d.put(x, 1, -30, "dark_oak_stairs", facing="n"); d.put(x + 1, 1, -30, "dark_oak_stairs", facing="n")
    for x in range(GX0 + 1, GX1):
        if d.r(x, 1, -30, 53) < 0.55: d.put(x, 1, -31, "red_carpet")
    # ---- the chapel, east of the court (x 31..41, z -21..5): pews, the altar at the north end under a broken window
    CX0, CX1, CZ0, CZ1 = 31, 41, -21, 5
    box_ruin(d, CX0, CZ0, CX1, CZ1, 14, 9, salt=61, doors=[("s", 36), ("w", -2)], windows=False)
    for y in range(4, 12):
        for x in range(34, 39):
            if abs(x - 36) + abs(y - 8) <= 3 and d.get(x, y, CZ0) not in (None, "air"): d.put(x, y, CZ0, "air" if d.r(x, y, 0, 62) < 0.5 else "light_blue_stained_glass")
    for z in range(-17, 3, 2):
        for x in (33, 34, 38, 39):
            if d.r(x, 1, z, 63) < 0.8: d.put(x, 1, z, "spruce_stairs", facing="s")
    for x in range(35, 38): d.put(x, 1, -20, "polished_andesite"); d.put(x, 2, -20, "white_carpet" if x == 36 else "lantern")
    for x in range(35, 38):
        for z in range(-19, 4):
            if d.r(x, 0, z, 64) < 0.6: d.put(x, 1, z, "red_carpet") if d.get(x, 1, z) is None else None
    for z in range(-18, 4, 4):                                           # its buttresses on the east
        for y in range(1, 9): d.put(42, y, z, "stone_bricks")
        d.put(42, 9, z, "stone_brick_stairs", facing="w")
    # ---- the guest range, south of the court (x 15..41, z 21..29): two floors, the floor between them fallen in
    box_ruin(d, 15, 21, 41, 29, 11, 7, salt=71, floors=(5,), doors=[("n", 22), ("n", 34), ("s", 28)])
    for x in (18, 24, 30, 36):
        d.put(x, 1, 27, "white_wool" if x % 12 else "red_wool"); d.put(x, 1, 28, "dark_oak_slab", half="bottom")
        d.put(x + 1, 1, 28, "chest", facing="n") if d.r(x, 1, 28, 72) < 0.5 else None
    for x in range(16, 41, 5): d.put(x, 1, 22, "stone_brick_wall"); d.put(x, 2, 22, "lantern", hanging=False) if d.r(x, 2, 22, 73) < 0.3 else None
    # ---- the inner court: the old well, a fallen bell, a tree grown up where the paving lifted
    for x in range(15, 30):
        for z in range(-23, 20):
            if d.get(x, 1, z) is None and d.r(x, 1, z, 81) < 0.08: d.put(x, 1, z, "short_grass" if d.r(x, 2, z, 81) < 0.7 else "fern")
    for (x, z) in ((21, 2), (23, 2), (21, 4), (23, 4), (20, 3), (24, 3), (22, 1), (22, 5)):
        d.put(x, 1, z, "mossy_stone_bricks"); d.put(x, 2, z, "stone_brick_slab", half="bottom") if d.r(x, 2, z, 82) < 0.6 else None
    for y in (0, -1, -2): d.put(22, y, 3, "water") if y == -2 else d.air(22, y, 3)
    for (x, z) in ((21, 3), (23, 3), (22, 2), (22, 4)):
        for y in (-1, -2): d.put(x, y, z, "mossy_stone_bricks")
    d.air(22, 1, 3); d.air(22, 2, 3)
    fallen_bell(d, 25, 0, 12, axis="z", n=5, r0=1.2, r1=2.8, salt=3)
    oak(d, 18, 14, tall=6, lean=(1, 0), crown=3.2, salt=84)
    # ---- the keep, north-west: nineteen square, walls two thick, four floors high where it still stands
    KX0, KZ0, KX1, KZ1 = -41, -35, -23, -17
    for x in range(KX0, KX1 + 1):
        for z in range(KZ0, KZ1 + 1):
            e = min(x - KX0, KX1 - x, z - KZ0, KZ1 - z)
            d.put(x, 0, z, d.pick(x, 0, z, [("stone_bricks", 3), ("cobblestone", 2), ("moss_block", 1)], 91))
            if e <= 1:
                top = ruin_s(d, x, z, 27, 18, 91)
                if x - KX0 + KZ1 - z < 10: top = min(top, 4 + (x - KX0 + KZ1 - z))   # the south-west corner is gone to the ground
                for y in range(1, top + 1):
                    slit = e == 0 and y % 6 == 3 and (x - KX0) % 4 == 2 or e == 0 and y % 6 == 3 and (z - KZ0) % 4 == 2
                    d.put(x, y, z, "air" if slit and e == 0 else d.pick(x, y, z, STONE_RUIN, 92))
                    if slit: d.air(x, y, z)
            else:
                for y in range(1, 28): d.air(x, y, z)
                for fy in (6, 12, 18):
                    if e <= 3 and d.r(x, fy, z, 93) < 0.6 and not (x - KX0 + KZ1 - z < 14): d.put(x, fy, z, "spruce_planks")
    for k in range(18):                                                  # its stair, round the inside of the walls
        x, z = KX0 + 2 + min(k, 14), KZ0 + 2
        y = 1 + k // 1 if k < 6 else None
    for k in range(6):
        d.put(KX0 + 3 + k, 1 + k, KZ0 + 2, "stone_brick_stairs", facing="w"); d.put(KX0 + 3 + k, k, KZ0 + 2, "stone_bricks") if k else None
        d.put(KX1 - 2, 7 + k, KZ0 + 3 + k, "stone_brick_stairs", facing="n"); d.put(KX1 - 2, 6 + k, KZ0 + 3 + k, "stone_bricks")
    for z in range(KZ0 + 2, KZ0 + 4):
        for x in range(KX0 + 2, KX0 + 4): d.air(x, 6, z)
    for y in (1, 2, 3):                                                  # the door on the east, toward the Hall
        for z in (-27, -26, -25): d.air(KX1, y, z); d.air(KX1 - 1, y, z)
    rubble(d, -38, -15, 7, 50, salt=94)
    d.put(-30, 1, -27, "spruce_stairs", facing="s"); d.put(-31, 1, -27, "spruce_stairs", facing="s"); d.put(-30, 1, -28, "spruce_fence"); d.put(-30, 2, -28, "spruce_pressure_plate")
    # ---- the kitchens, west of the Hall (x -41..-17, z -11..19): the great hearth, the long tables, the ovens
    box_ruin(d, -41, -11, -17, 19, 7, 5, salt=101, doors=[("e", 4), ("n", -30), ("s", -26)])
    for z in range(-1, 10):
        for y in range(1, 6): d.put(-40, y, z, "bricks" if d.r(-40, y, z, 102) < 0.7 else "cracked_stone_bricks")
    for z in range(1, 8):
        for y in (1, 2, 3): d.air(-40, y, z)
        d.put(-41, 1, z, "campfire", bs={"extinguished": True}) if z % 3 == 1 else d.put(-41, 1, z, "cobblestone")
        d.put(-40, 4, z, "stone_brick_stairs", facing="e", half="top")
    for z in (-7, 12):
        for x in range(-36, -22):
            if d.r(x, 1, z, 103) < 0.85: d.put(x, 1, z, "spruce_slab", half="top")
    for x in (-38, -36): d.put(x, 1, 16, "furnace", facing="n"); d.put(x, 2, 16, "furnace", facing="n")
    for x in range(-34, -24, 3): d.put(x, 1, 17, "barrel", facing="u")
    d.put(-20, 1, -9, "cauldron")
    # ---- the curtain: round towers at the corners and halfway along the sides, the wall between them broken
    TOW = [(-43, -37), (43, -37), (-43, 45), (43, 45), (-43, 4), (43, 4), (0, -37)]
    for k, (a, b) in enumerate(TOW + [TOW[0]]):
        pass
    for (a, b), (c, e) in (((-43, -37), (0, -37)), ((0, -37), (43, -37)), ((43, -37), (43, 4)), ((43, 4), (43, 45)),
                           ((43, 45), (9, 45)), ((-9, 45), (-43, 45)), ((-43, 45), (-43, 4)), ((-43, 4), (-43, -37))):
        wall_line(d, (a, b), (c, e), 10, 7, thick=2, salt=a + 2 * b, top_fn=ruin_s)
    for k, (a, b) in enumerate(TOW):
        fallen = k == 3                                                  # the south-east corner tower has come down
        ring_tower(d, a, b, 5.5, 6 if fallen else 21, 4 if fallen else 11, salt=110 + k, floors=() if fallen else (6, 12))
        if fallen: rubble(d, a - 6, b - 6, 9, 70, salt=119)
    # the great gatehouse: two round towers either side of the gate, the passage between with the portcullis half down
    for gx in (-7, 7):
        ring_tower(d, gx, 47, 5.5, 25, 8, salt=130 + gx, floors=(7, 13), door="n")
    for x in range(-3, 4):
        for z in range(42, 53):
            side = abs(x) == 3
            d.put(x, 0, z, d.pick(x, 0, z, [("cobblestone", 2), ("stone_bricks", 2), ("gravel", 1)], 133))
            for y in range(1, 17):
                if side or y >= 7: d.put(x, y, z, d.pick(x, y, z, STONE_RUIN, 134)) if y <= ruin_s(d, x, z, 17, 6, 135) else None
                else: d.air(x, y, z)
            if y and not side and z in (44, 45): pass
    for z in (42, 52):                                                   # the arches at each end of the passage
        for x in range(-2, 3):
            for y in range(1, 7): d.air(x, y, z)
        d.put(-2, 6, z, "stone_brick_stairs", facing="w", half="top"); d.put(2, 6, z, "stone_brick_stairs", facing="e", half="top")
    for x in range(-2, 3):                                               # the portcullis, stuck half down
        for y in range(4, 7): d.put(x, y, 48, "iron_bars")
        d.put(x, 7, 48, "dark_oak_planks")
    for z in range(43, 52, 4): d.put(0, 6, z, "lantern", hanging=True) if z != 48 else None
    # the guardroom in the west gate tower: the gate wardens' chest, and Chronicle VI on it
    d.put(-10, 1, 47, "chest", facing="e")
    d.meta.setdefault("tomes", []).append([-10, 2, 47, "chron_06"])
    # ---- the outer ward: the street from the gate up to the Hall's door, the old well, the stables' footings
    for z in range(32, 46):
        for x in range(-2, 3):
            if d.r(x, 0, z, 141) < 0.85: d.put(x, 0, z, d.pick(x, 0, z, [("cobblestone", 3), ("mossy_cobblestone", 2), ("stone_bricks", 1)], 142))
    box_ruin(d, -37, 27, -19, 39, 5, 4, salt=151, doors=[("e", 33)], floor=[("coarse_dirt", 2), ("gravel", 1), ("cobblestone", 1)])
    for z in range(29, 38, 3):
        for x in (-35, -21): d.put(x, 1, z, "hay_block") if d.r(x, 1, z, 152) < 0.6 else None
        for x in range(-34, -22, 4): d.put(x, 1, z, "spruce_fence")
    # ---- light (Mateo 2026-11-13: "light all the builds"): lanterns on posts up the street from the gate, either side of
    # the Hall's door and the gate, round the court and its well, by the dais, down the gallery, in the keep and kitchens
    def post(x, z, h=2):
        if d.get(x, 1, z) not in (None, "air", "short_grass", "fern"): return
        for y in range(1, h + 1): d.put(x, y, z, "stone_brick_wall")
        d.put(x, h + 1, z, "lantern")
    for z in range(33, 46, 4): post(-4, z); post(4, z)
    for (x, z) in ((-5, L + 8), (5, L + 8), (-4, 53), (4, 53), (20, 0), (25, 6), (20, 10), (27, -4), (18, -18), (28, 18),
                   (-15, 22), (-15, -18), (-30, 24), (-12, 40), (12, 40), (30, 40), (-38, -3), (38, 15)):
        post(x, z)
    for z in (-15, -5, 5, 15):                                          # on the bell frames' feet down the nave
        for sx in (-5, 5): d.put(sx, 1, z, "lantern")
    for x in (-5, 5): d.put(x, 2, -L + 2, "lantern")                    # either side of where the throne stood
    for x in range(GX0 + 4, GX1 - 2, 6): d.put(x, 1, -29, "lantern")   # down the gallery
    d.put(-32, 1, -26, "lantern"); d.put(-34, 1, -20, "lantern"); d.put(-28, 1, 5, "lantern"); d.put(-24, 1, 14, "lantern")
    d.put(-3, -5, -L + 3, "lantern")                                   # the cellar: a second lamp by the stair foot


def royal_wing(d, W, L):
    """The royal wing off the Hall's east wall, as roofless as the rest: the King's bedchamber (a four-poster bed
    gone to rags, a cold hearth, the chair by it where he sat the nights out) and beyond it the nursery where the
    royal children slept (three cradles, two little beds, a rocking chair). Tomes: chron_09 by the King's bed,
    chron_03 in a cradle."""
    X0, X1, Z0, ZM, Z1 = W + 2, W + 10, -L + 2, -L + 10, -L + 16   # x 11..19; bedchamber z -15..-7, nursery -7..-1
    floor = [("dark_oak_planks", 4), ("spruce_planks", 1), ("moss_block", 1), ("coarse_dirt", 1), ("stone_bricks", 1)]
    for x in range(X0, X1 + 1):
        for z in range(Z0, Z1 + 1):
            d.put(x, 0, z, d.pick(x, 0, z, floor, 11))
            if x in (X0, X1) or z in (Z0, ZM, Z1):
                top = ruin_height(d, x, z, 8, 5, 12)
                for y in range(1, top + 1): d.put(x, y, z, d.pick(x, y, z, STONE_RUIN, 12))
            else:
                for y in range(1, 9): d.air(x, y, z)
    # the way in from the Hall, past a buttress: a door through both walls, and one between the two rooms
    for x in range(W, X0 + 1):
        for y in (1, 2, 3): d.air(x, y, -11)
    d.put(W, 4, -11, "stone_brick_slab", half="top"); d.put(X0, 4, -11, "stone_brick_slab", half="top")
    for y in (1, 2, 3): d.air(15, y, ZM)
    for y in (2, 3, 4):                                   # slit windows on the east side
        for z in (-13, -10, -4): d.air(X1, y, z)
    # the King's bedchamber (inside x 12..18, z -14..-8)
    for (x, z), tall in (((16, -12), 4), ((16, -10), 2), ((18, -12), 4), ((18, -10), 4)):   # one foot post broken off
        for y in range(1, tall + 1): d.put(x, y, z, "stripped_dark_oak_log", axis="y")
    for x in (16, 17, 18):
        for z in (-12, -11, -10):
            if d.get(x, 1, z) != "stripped_dark_oak_log": d.put(x, 1, z, "red_wool" if x < 18 else "white_wool")
    for x in (16, 17, 18):                                # what is left of the canopy, a red rag hanging off it
        for z in (-12, -11, -10):
            if (x, z) in ((16, -10), (17, -10)): continue
            if (x, z) in ((16, -12), (18, -12), (18, -10)): continue
            d.put(x, 4, z, "dark_oak_slab", half="top")
    d.put(17, 4, -12, "red_wool"); d.put(18, 4, -11, "dark_oak_slab", half="top")
    d.put(18, 1, -13, "stripped_dark_oak_wood")           # the table by his bed
    d.put(18, 1, -9, "chest", facing="w")
    for x in (13, 15):                                    # the cold hearth in the north wall
        for y in (1, 2, 3): d.put(x, y, -14, "stone_bricks")
    d.put(14, 3, -14, "stone_brick_slab", half="top"); d.air(14, 1, -14); d.air(14, 2, -14)
    for x in (13, 14, 15): d.put(x, 4, -14, "stone_brick_stairs", facing="s", half="top")
    d.put(14, 1, -15, "campfire", bs={"extinguished": True}); d.put(14, 2, -15, "air")
    for y in range(3, 10): d.put(14, y, -15, "stone_bricks")
    d.put(14, 1, -12, "dark_oak_stairs", facing="s")      # the chair by the hearth: where he slept, or tried to
    d.put(13, 1, -12, "dark_oak_trapdoor", facing="w", open=True); d.put(15, 1, -12, "dark_oak_trapdoor", facing="e", open=True)
    for x in range(12, 16):                               # a moth-eaten rug
        for z in range(-11, -8):
            if d.r(x, 1, z, 13) < 0.7: d.put(x, 1, z, "red_carpet")
    d.put(12, 1, -14, "barrel", facing="u"); d.put(12, 2, -14, "flower_pot")
    # the nursery (inside x 12..18, z -6..-2)
    for x in (13, 15, 17):                                # three cradles along the north wall, white linen in each
        d.put(x, 1, -6, "dark_oak_slab", half="top")
        d.put(x, 2, -6, "white_carpet")
    for z in (-3, -2):                                    # two little beds against the east wall
        d.put(18, 1, z, "light_blue_wool" if z == -3 else "white_wool")
    d.put(18, 1, -4, "spruce_trapdoor", facing="w", half="top")
    d.put(12, 1, -2, "spruce_stairs", facing="e")         # the nurse's rocking chair
    d.put(12, 1, -4, "barrel", facing="u"); d.put(12, 2, -4, "white_candle")
    for x in range(14, 17):
        for z in (-3, -2):
            if d.r(x, 2, z, 14) < 0.6: d.put(x, 1, z, "light_blue_carpet")
    d.meta.setdefault("tomes", []).extend([[18, 2, -13, "chron_09"], [15, 2, -6, "chron_03"]])


def crownhold_walls():
    """Crownhold town, spilling down the slope outside the castle gate (draped on the ground): the high street winding
    down from the gatehouse to the market square with its broken cross and dry well, then on toward the Vale; a cross
    street; roofless houses along them, two floors where they still stand (hearths, tables, a bed frame, a barrel), some
    down to their footings. Odd sizes throughout. The castle itself is crownhold_hall."""
    d = D("crownhold_walls", "drape", seed=202)
    CASTLE = (-48, -42, 48, 54)                                         # the curtain and the gatehouse: stay out

    def in_castle(x, z, m=0):
        return CASTLE[0] - m <= x <= CASTLE[2] + m and CASTLE[1] - m <= z <= CASTLE[3] + m
    COB = [("cobblestone", 3), ("mossy_cobblestone", 2), ("gravel", 1), ("stone_bricks", 1), ("coarse_dirt", 1)]
    street = set()

    def lay(x, z):
        if in_castle(x, z) or d.r(x, 0, z, 3) > 0.88: return
        street.add((x, z)); d.put(x, 0, z, d.pick(x, 0, z, COB, 4))
    # the high street: from the gate down the slope, swinging east and back
    HS = lambda z: round(5 * math.sin((z - 53) * 0.06))
    for z in range(53, 112):
        for k in range(-2, 3): lay(HS(z) + k, z)
    # the market square
    MZ = 80
    for x in range(HS(MZ) - 10, HS(MZ) + 11):
        for z in range(MZ - 7, MZ + 8): lay(x, z)
    mx = HS(MZ)
    for (x, z) in ((mx - 1, MZ), (mx + 1, MZ), (mx, MZ - 1), (mx, MZ + 1)): d.put(x, 1, z, "stone_brick_stairs", facing={(-1, 0): "e", (1, 0): "w", (0, -1): "s", (0, 1): "n"}[(x - mx, z - MZ)])
    for y in range(1, 6): d.put(mx, y, MZ, "polished_andesite" if y in (1, 5) else "stone_bricks")
    d.put(mx, 6, MZ, "stone_brick_wall"); d.put(mx - 1, 5, MZ, "stone_brick_slab", half="top")          # the cross, one arm gone
    d.put(mx + 1, 1, MZ + 1, "stone_brick_slab", half="bottom"); d.put(mx + 2, 1, MZ + 2, "polished_andesite")   # the other arm, fallen
    wx, wz = mx + 6, MZ - 4                                               # the dry well
    for (x, z) in ((wx - 1, wz), (wx + 1, wz), (wx, wz - 1), (wx, wz + 1), (wx - 1, wz - 1), (wx + 1, wz + 1), (wx - 1, wz + 1), (wx + 1, wz - 1)):
        d.put(x, 1, z, "mossy_cobblestone")
    for y in range(-5, 1): d.air(wx, y, wz)
    for (x, z) in ((wx - 1, wz), (wx + 1, wz)): d.put(x, 2, z, "spruce_fence"); d.put(x, 3, z, "spruce_fence")
    d.put(wx - 1, 4, wz, "spruce_slab", half="bottom"); d.put(wx, 4, wz, "spruce_slab", half="bottom"); d.put(wx + 1, 4, wz, "spruce_slab", half="bottom")
    # the cross street, east and west from the square, and the lane round the castle's foot
    for x in range(-75, 76):
        z = MZ + 9 + round(3 * math.sin(x * 0.07))
        for k in range(-1, 2): lay(x, z + k)
    for z in range(-30, 60):
        for side in (-1, 1):
            x = side * (52 + round(2 * math.sin(z * 0.09)))
            for k in range(-1, 2): lay(x + k, z)
    for x in range(-52, 53):
        for k in range(-1, 2): lay(x, 58 + k + round(math.sin(x * 0.1)))
    # the houses: plots along the streets, each a roofless shell with what was left inside
    lots = []
    for z in range(58, 108, 10):                                          # both sides of the high street
        for side in (-1, 1):
            lots.append((HS(z) + side * 9, z, "w" if side > 0 else "e"))
    for x in range(-70, 71, 11):                                          # both sides of the cross street
        if abs(x) < 16: continue
        z0 = MZ + 9 + round(3 * math.sin(x * 0.07))
        lots.append((x, z0 - 8, "s")); lots.append((x, z0 + 8, "n"))
    for z in range(-26, 52, 11):                                          # along the lane at the castle's foot
        for side in (-1, 1):
            lots.append((side * 61, z, "w" if side > 0 else "e"))
    kept = []
    for k, (hx, hz, face) in enumerate(lots):
        w = 2 + int(d.r(k, 5, 5) * 3); l = 3 + int(d.r(k, 6, 6) * 3)       # half sizes: 5..9 by 7..11
        if face in "ns": w, l = l, w
        rect = (hx - w, hz - l, hx + w, hz + l)
        if any(in_castle(x, z, 2) or (x, z) in street for x in range(rect[0], rect[2] + 1) for z in range(rect[1], rect[3] + 1)): continue
        if any(not (r[2] + 2 < rect[0] or rect[2] + 2 < r[0] or r[3] + 2 < rect[1] or rect[3] + 2 < r[1]) for r in kept): continue
        if math.hypot(hx, hz) > 118: continue
        kept.append(rect)
        x0, z0, x1, z1 = rect
        t = d.r(k, 7, 7)
        base, var = (2, 2) if t < 0.2 else ((6, 4) if t < 0.6 else (10, 6))  # footings, one floor, two floors
        door = {"n": ("n", (x0 + x1) // 2), "s": ("s", (x0 + x1) // 2), "e": ("e", (z0 + z1) // 2), "w": ("w", (z0 + z1) // 2)}[face]
        box_ruin(d, x0, z0, x1, z1, base, var, salt=300 + k, floors=(5,) if base >= 10 else (), doors=[door] if base > 2 else [],
                 floor=[("spruce_planks", 2), ("cobblestone", 2), ("coarse_dirt", 2), ("moss_block", 1), ("gravel", 1)])
        if base <= 2: continue
        cx, cz = (x0 + x1) // 2, (z0 + z1) // 2
        if base >= 6:                                                     # the gable ends still standing (one may be down)
            along_x = (x1 - x0) <= (z1 - z0)
            ends = (z0, z1) if along_x else (x0, x1)
            for j, e in enumerate(ends):
                if d.r(k, 10 + j, 10) < 0.3: continue
                lo, hi = (x0, x1) if along_x else (z0, z1)
                half, mid = (hi - lo) // 2, (lo + hi) // 2
                for u in range(lo, hi + 1):
                    X, Z = (u, e) if along_x else (e, u)
                    if d.get(X, base - 1, Z) in (None, "air"): continue
                    for y in range(base, base + half - abs(u - mid) + 1):
                        d.put(X, y, Z, d.pick(X, y, Z, STONE_RUIN, 300 + k))
                    if abs(u - mid) == 0 and half >= 3: d.air(X, base + 1, Z)          # the loft window
        # the hearth: a stone chimney breast in the back wall, a cold fire in it
        back = {"n": (cx, z1), "s": (cx, z0), "e": (x1, cz), "w": (x0, cz)}[face]
        bx, bz = back
        inward = {"n": (0, -1), "s": (0, 1), "e": (-1, 0), "w": (1, 0)}[face]
        for y in range(1, base + 2): d.put(bx, y, bz, "cobblestone" if y > 3 else "stone_bricks")
        d.put(bx + inward[0], 1, bz + inward[1], "campfire", bs={"extinguished": True})
        # a table and its bench, a barrel, maybe a bed frame and a chest
        tx, tz = cx - inward[0] * 0 + (1 if face in "ns" else 0), cz + (1 if face in "ew" else 0)
        if d.get(tx, 1, tz) is None:
            d.put(tx, 1, tz, "spruce_fence"); d.put(tx, 2, tz, "spruce_pressure_plate")
            sx_, sz_ = (tx + 1, tz) if face in "ns" else (tx, tz + 1)
            if d.get(sx_, 1, sz_) is None: d.put(sx_, 1, sz_, "spruce_stairs", facing="w" if face in "ns" else "n")
        if d.get(x0 + 1, 1, z0 + 1) is None: d.put(x0 + 1, 1, z0 + 1, "barrel", facing="u")
        if d.r(k, 8, 8) < 0.5 and d.get(x1 - 1, 1, z1 - 1) is None:
            d.put(x1 - 1, 1, z1 - 1, "spruce_slab", half="bottom"); d.put(x1 - 1, 1, z1 - 2, "spruce_slab", half="bottom") if d.get(x1 - 1, 1, z1 - 2) is None else None
        if d.r(k, 9, 9) < 0.35: rubble(d, cx, cz, 2, 6, salt=k)
    # light: lanterns on posts down the high street (alternating sides), round the square, along the cross street
    def lamp(x, z):
        if (x, z) in street or d.get(x, 1, z) is not None or in_castle(x, z, 1): return
        d.put(x, 1, z, "spruce_fence"); d.put(x, 2, z, "spruce_fence"); d.put(x, 3, z, "lantern")
    for i, z in enumerate(range(56, 112, 7)): lamp(HS(z) + (3 if i % 2 else -3), z)
    for (x, z) in ((mx - 11, MZ - 8), (mx + 11, MZ - 8), (mx - 11, MZ + 8), (mx + 11, MZ + 8)): lamp(x, z)
    d.put(mx, 7, MZ, "lantern")
    for i, x in enumerate(range(-72, 73, 9)):
        z = MZ + 9 + round(3 * math.sin(x * 0.07)); lamp(x, z + (2 if i % 2 else -2))
    for z in range(-28, 58, 9):
        for side in (-1, 1): lamp(side * (52 + round(2 * math.sin(z * 0.09))) + side * 2, z)
    # an old oak grown up in a ruined yard, a few more down the slope
    for k, (x, z) in enumerate(((-30, 96), (34, 70), (-66, 30), (70, -10), (20, 104))):
        if not in_castle(x, z, 3) and (x, z) not in street: oak(d, x, z, tall=6 + k % 3, crown=3.2, salt=40 + k)
    return d

# ---------------------------------------------------------------- Bellhollow


def bellhollow_seal():
    """The Seal at Bellhollow, over solid rock now, and half of the split Founding Bell lying where it fell."""
    d = D("bellhollow_seal", "rigid", seed=211, fill="stone", top="keep", ease=4)
    # the Seal: a great round stone in the valley floor, ringed and graven
    for x in range(-7, 8):
        for z in range(-7, 8):
            r = math.hypot(x, z)
            if r <= 7.4:
                b = "chiseled_deepslate" if 5.6 < r <= 6.5 else "polished_deepslate" if r > 2.5 else "deepslate_tiles"
                if 6.5 < r: b = "cobbled_deepslate"
                d.put(x, 0, z, b)
    for k in range(8):   # chain staples round the rim
        a = k * math.pi / 4; x, z = round(math.sin(a) * 7), round(math.cos(a) * 7)
        d.put(x, 1, z, "iron_chain", axis="x" if abs(x) > abs(z) else "z")
    d.put(0, 0, 0, "lodestone")
    # the bell half: the Founding Bell split top to bottom; one half stands on its rim beside the Seal, its open
    # side to the Seal so you can see into it, the clapper long gone
    d.materials["bronze"] = {"ladder": ["waxed_weathered_cut_copper", "waxed_exposed_cut_copper", "waxed_cut_copper"], "axis": "noise", "scale": 3}
    prof = [[0, 6.5], [1, 6.2], [2, 5.4], [4, 4.7], [6, 4.4], [8, 4.2], [9.5, 4.0], [10.5, 3.4], [11.2, 2.2], [11.6, 0]]
    d.shapes.append({"shape": "lathe", "at": [17, 1, 0], "profile": prof, "axis": "y", "material": "bronze"})
    inner = [[y, max(r - 1.3, 0)] for y, r in prof if y <= 10] + [[10.4, 0]]
    d.shapes.append({"op": "sub", "shape": "lathe", "at": [17, 0, 0], "profile": [[0, 5.4]] + inner, "axis": "y"})   # it is a bell: hollow
    d.shapes.append({"op": "sub", "shape": "box", "min": [8, 0, -9], "max": [16, 16, 9]})          # split: only the far half remains
    for y in (12, 13): d.put(17, y, 0, "waxed_exposed_cut_copper")                                  # the crown loop
    for z in (-1, 1): d.put(17, 13, z, "waxed_exposed_cut_copper")
    for z in range(-2, 3): d.put(17, 14, z, "waxed_exposed_cut_copper_slab", half="bottom")
    # the shrine: a little stone house, open on the road side
    sx, sz = -4, -12   # 22 west of the frame's centre, just north of the Seal
    for x in range(sx - 2, sx + 3):
        for z in range(sz - 2, sz + 3):
            d.put(x, 0, z, "stone_bricks")
            if max(abs(x - sx), abs(z - sz)) == 2 and z != sz + 2:
                for y in range(1, 4): d.put(x, y, z, "mossy_stone_bricks" if d.r(x, y, z) < 0.4 else "stone_bricks")
    for x in range(sx - 3, sx + 4):
        for z in range(sz - 3, sz + 4):
            dz = abs(z - sz)
            if dz <= 3: d.put(x, 4 + (3 - dz) // 2 if dz < 3 else 4, z, "deepslate_tile_stairs" if dz else "deepslate_tile_slab", facing="n" if z > sz else "s", half="bottom")
    d.put(sx, 1, sz - 1, "candle", bs={"candles": 3, "lit": True}); d.put(sx - 1, 1, sz - 1, "flower_pot"); d.put(sx + 1, 1, sz - 1, "candle", bs={"candles": 1, "lit": True})
    # the pilgrims' bells, set down in rows outside
    for k in range(14):
        x, z = sx - 3 + (k % 7), sz + 4 + (k // 7)
        d.put(x, 1, z, "bell", bs={"attachment": "standing", "direction": 0})
    # the old seal chamber under the shrine (seal_08: "beneath the shrine, in the old seal chamber"): a trapdoor in
    # the shrine's open front, a ladder down, a low deepslate room with the first, smaller seal in its floor
    for x in range(sx - 3, sx + 4):
        for z in range(sz - 3, sz + 4):
            for y in range(-5, 0):
                edge = abs(x - sx) == 3 or abs(z - sz) == 3 or y == -5
                if edge: d.put(x, y, z, d.pick(x, y, z, [("deepslate_bricks", 3), ("cracked_deepslate_bricks", 2), ("cobbled_deepslate", 1)], 9))
                else: d.air(x, y, z)
    for x in range(sx - 1, sx + 2):
        for z in range(sz - 2, sz + 1): d.put(x, -5, z, "chiseled_deepslate" if (x, z) != (sx, sz - 1) else "lodestone")
    for y in range(-4, 0): d.put(sx, y, sz + 2, "ladder", bs={"facing_direction": 2})
    d.put(sx, 0, sz + 2, "spruce_trapdoor", facing="s", half="top")
    d.put(sx - 2, -4, sz - 2, "soul_lantern", hanging=False); d.put(sx + 2, -4, sz + 1, "candle", bs={"candles": 2, "lit": True})
    d.put(sx + 2, -4, sz - 2, "stone_bricks")
    d.meta["tomes"] = [[sx + 1, 1, sz, "seal_03"],            # in the shrine, among the pilgrims' candles
                       [sx + 2, -3, sz - 2, "seal_08"]]       # below, on the old stone in the chamber's corner
    d.hollow = 1
    d.meta["mark"] = [0, 1, 0]
    return d


def bellhollow_frame():
    """The great bell frame, broken and fallen across the valley (the pilgrims' shrine is in bellhollow_seal, so it
    stands level over the old seal chamber)."""
    d = D("bellhollow_frame", "drape", seed=212)
    # the frame: two great trestles, one standing, one fallen; the beam lying between
    for k in range(10): d.put(-6, 1 + k, 0, "stripped_dark_oak_log", axis="y"); d.put(-6, 1 + k, 1, "stripped_dark_oak_log", axis="y")
    for s in (-1, 1):
        for k in range(6): d.put(-6, 1 + k, s * (2 + k // 2) + (1 if s > 0 else 0), "dark_oak_fence")
    for k in range(13): d.put(-5 + k, 1, 6 + k // 4, "stripped_dark_oak_log", axis="x")    # the fallen beam
    for k in range(10): d.put(8 + k // 5, 1, 9 + k, "stripped_dark_oak_log", axis="z")     # the fallen trestle
    d.put(-6, 11, 0, "dark_oak_slab", half="bottom"); d.put(-6, 10, -1, "iron_chain", axis="y")
    return d

# ---------------------------------------------------------------- the Ashen Gate


def ashen_chapterhouse():
    """The Chapterhouse of the Ashen Gate: the Order's last house, grey and cold. The archive is the ground floor,
    where Brother Cael keeps the books; a trapdoor behind the lectern leads down to the Burned Archive."""
    d = D("ashen_chapterhouse", "rigid", seed=221, fill="stone", top="keep", ease=4)
    d.parts = [{"part": "house", "style": {"base": "vale_stone", "infill": "VAL-01"}, "rect": [-10, -7, 10, 7], "y": 0,
                "storeys": [5, 5], "frame": "stone", "bay": 3, "door": {"side": "s", "kind": "grand"},
                "roof": {"type": "gable", "ridge": "x", "pitch": 1}, "materials": {"roof": "VAL-06"}, "chimney": [[-7, 0], [7, 0]],
                "shutters": 0, "interior": {"rooms": ["open", "office"], "region": "vale"}},
               # the chapel, east of the archive (its altar to the east): Ashe's little book, the founder's life
               {"part": "house", "style": {"base": "vale_stone", "infill": "VAL-01"}, "rect": [10, -4, 24, 4], "y": 0,
                "storeys": [7], "frame": "stone", "bay": 3, "door": {"side": "s"},
                "roof": {"type": "gable", "ridge": "x", "pitch": 1}, "materials": {"roof": "VAL-06"}, "shutters": 0,
                "interior": {"use": "chapel", "rooms": ["nave"], "region": "vale"}}]
    # grey hangings either side of the door: the Order's banners, gone threadbare
    for x in (-4, 4):
        for y in range(4, 9): d.put(x, y, 8, "gray_wool" if y > 4 else "light_gray_wool")
        d.put(x, 9, 8, "dark_oak_slab", half="top")
    # version 1 stood its furniture a block too high: clear those cells when it is built again over the old one
    for x in range(-8, 9):
        for z in (-5, 5): d.air(x, 3, z)
    for x in range(-5, 6): d.air(x, 2, 0)
    for x, z in ((-8, 0), (8, 0), (-8, -1), (-8, 1), (8, -1), (8, 1), (0, -3)): d.air(x, 2, z)
    d.air(0, 1, -4)
    # the archive inside (the reading room, the floor at y 0): shelves along the walls, a long reading table, the
    # cold hearths at each end in front of the chimney breasts
    for x in range(-8, 9):
        for z in (-5, 5):
            if abs(x) > 1 or z == -5:
                for y in (1, 2): d.put(x, y, z, "bookshelf" if d.r(x, y, z) < 0.8 else "chiseled_bookshelf")
    for x in range(-3, 4): d.put(x, 1, 0, "dark_oak_slab", half="top")
    for x in (-4, 4): d.put(x, 1, 0, "lectern", bs={"minecraft:cardinal_direction": "south"})
    for x in (-6, 6):
        d.put(x, 1, 0, "campfire", bs={"extinguished": True}); d.put(x, 1, -1, "cobblestone_wall"); d.put(x, 1, 1, "cobblestone_wall")
    d.put(0, 0, -4, "dark_oak_trapdoor", facing="s", half="top")   # behind the lectern: the way down
    d.put(0, 1, -3, "lectern", bs={"minecraft:cardinal_direction": "south"})
    d.put(2, 1, 6, "stripped_dark_oak_wood")                         # a stand inside the door
    # the Grandmaster's study upstairs (floor y 5): his books along the north wall, his desk by the east chimney
    for x in range(-9, 2):
        for y in (6, 7): d.put(x, y, -6, "bookshelf" if d.r(x, y, -6, 21) < 0.75 else "chiseled_bookshelf")
    for x in (4, 5, 6): d.put(x, 6, 3, "dark_oak_slab", half="top")
    d.put(4, 6, 2, "dark_oak_trapdoor", facing="n", open=True); d.put(6, 6, 2, "dark_oak_trapdoor", facing="n", open=True)
    d.put(5, 6, 4, "dark_oak_stairs", facing="s")                     # his chair, its back to the room
    d.put(4, 7, 3, "candle"); d.put(6, 7, 3, "flower_pot")
    # the way through to the chapel, at the east end of the archive
    for y in (1, 2, 3):
        for x in (10, 11): d.air(x, y, 2)
    for z in range(-3, 4): d.air(9, 1, z)                             # the chapel's plinth step, inside the archive
    # the chapel's east window: grey glass over the altar
    for z in (-1, 0, 1):
        for y in (3, 4, 5): d.put(24, y, z, "light_gray_stained_glass")
    # the Burned Archive below: charred shelves, a locked cell
    for x in range(-6, 7):
        for z in range(-6, 1):
            for y in range(-5, 1):
                edge = x in (-6, 6) or z in (-6, 0) or y == -5
                if y == 0 and not edge: continue
                if edge or y == 0: d.put(x, y, z, d.pick(x, y, z, [("deepslate_bricks", 3), ("cracked_deepslate_bricks", 2), ("blackstone", 1)]))
                else: d.air(x, y, z)
    for x in range(-5, 6):
        for z in (-5,):
            for y in (-4, -3, -2): d.put(x, y, z, d.pick(x, y, z, [("coal_block", 2), ("bookshelf", 1), ("blackstone", 1), ("air", 1)], 6))
    for y in range(-4, 0):                                            # the ladder down, against the north shelves
        d.put(0, y, -5, "deepslate_bricks"); d.put(0, y, -4, "ladder", bs={"facing_direction": 3})
    d.put(-4, -4, -2, "campfire", bs={"extinguished": True}); d.put(1, -4, -3, "soul_lantern", hanging=False)
    # the cell where Corvin was held, in the south-east corner (x 4..5, z -3..-1): bars on its two open sides, the
    # door of bars long since forced and gone, his straw pallet, and Corvin's tenth book where he left it
    for y in (-4, -3, -2):
        for z in (-3, -1): d.put(3, y, z, "iron_bars")
        for x in (3, 4, 5): d.put(x, y, -4, "iron_bars")
    for y in (-3, -2): d.air(3, y, -2)
    d.put(3, -4, -2, "air")
    d.put(5, -4, -3, "hay_block"); d.put(5, -4, -2, "brown_carpet")
    d.put(4, -4, -1, "soul_lantern", hanging=False)
    d.meta["npcs"] = [[2, 1, 2, "cael"]]
    d.meta["tomes"] = [[1, 2, 0, "chron_10"], [2, 2, 6, "seal_01"], [5, 7, 3, "seal_09"],   # reading room, door, study desk
                       [5, -3, -3, "corv_10"]]                                              # on his pallet in the cell
    d.meta["mark"] = [0, 1, 8]
    return d


def ashen_watch():
    """The Ashen Watch: an Order watchtower over the fen, broken, and the statue fragments carried here from the
    desert, stacked like evidence."""
    d = D("ashen_watch", "rigid", seed=231, fill="cobblestone", top="keep", ease=3)
    for x in range(-3, 4):
        for z in range(-3, 4):
            d.put(x, 0, z, "stone_bricks")
            if max(abs(x), abs(z)) == 3:
                top = ruin_height(d, x, z, 15, 9, 2)
                for y in range(1, top + 1):
                    d.put(x, y, z, "polished_andesite" if abs(x) == 3 and abs(z) == 3 else d.pick(x, y, z, GREY + [("mossy_stone_bricks", 2)]))
    for y in range(1, 4): d.air(0, y, 3)
    d.put(0, 4, 3, "stone_brick_slab", half="top")
    for y in (6, 10):
        for x, z in ((3, 0), (-3, 0), (0, -3)):
            if d.get(x, y, z): d.air(x, y, z); d.put(x, y + 1, z, "stone_brick_slab", half="top") if d.get(x, y + 1, z) else None
    for y in range(1, 9): d.put(0, y, -2, "ladder", bs={"facing_direction": 3})
    for x in range(-2, 3):
        for z in range(-2, 3):
            if d.r(x, 8, z) < 0.6: d.put(x, 8, z, "spruce_slab", half="top")
    for x in range(-4, 5): d.put(x, 1, 6, "stone_brick_wall") if d.r(x, 0, 6) < 0.6 else None
    # statue fragments: heads, a hand, a torso, laid out on the flags in front
    frags = [((-6, 6), "chiseled_sandstone"), ((-5, 8), "chiseled_red_sandstone"), ((6, 7), "chiseled_sandstone"), ((5, 9), "chiseled_sandstone")]
    for (x, z), b in frags: d.put(x, 1, z, b)
    for x, z in ((-7, 9), (-6, 10)): d.put(x, 1, z, "smooth_sandstone_stairs", facing="e")
    for y in (1, 2): d.put(7, y, 10, "smooth_sandstone")
    d.put(7, 3, 10, "smooth_sandstone_slab", half="bottom")
    for x in range(-8, 9):
        for z in range(5, 12):
            if d.get(x, 1, z) is None and d.r(x, 0, z) < 0.5: d.put(x, 0, z, "smooth_sandstone" if d.r(x, 1, z) < 0.4 else "stone_bricks")
    d.meta["mark"] = [0, 1, 4]
    return d

# ---------------------------------------------------------------- Corvin's Tower


def corvins_tower():
    """Corvin's Tower: a roofless round tower in the hills over the Vale, an empty bell frame against the sky."""
    d = D("corvins_tower", "rigid", seed=241, fill="cobblestone", top="keep", ease=4)
    R = 4.5
    for x in range(-6, 7):
        for z in range(-6, 7):
            r = math.hypot(x, z)
            if r <= R + 0.5:
                d.put(x, 0, z, "mossy_cobblestone" if d.r(x, 0, z) < 0.5 else "cobblestone")
            if R - 0.5 < r <= R + 0.5:
                top = ruin_height(d, x, z, 17, 6, 4)
                for y in range(1, top + 1):
                    d.put(x, y, z, d.pick(x, y, z, [("stone_bricks", 4), ("mossy_stone_bricks", 3), ("cracked_stone_bricks", 2), ("andesite", 1)], 4))
    # a door to the south, slit windows up the sides, a ring of corbels where the roof was
    for y in (1, 2, 3): d.air(0, y, 5); d.air(0, y, 4)
    d.put(0, 4, 5, "stone_brick_stairs", facing="s", half="top")
    for y, (x, z) in ((6, (5, 0)), (9, (-5, 0)), (12, (0, -5)), (12, (4, 3))):
        if d.get(x, y, z): d.air(x, y, z); d.air(x, y + 1, z)
    for y in range(1, 15):
        d.put(0, y, -4, "ladder", bs={"facing_direction": 3})   # against the north wall
        d.air(0, y, -3)                                          # (where version 1 hung it, on nothing)
    for x in range(-3, 4):   # the old floors, half rotted through
        for z in range(-3, 4):
            for y in (5, 10):
                if math.hypot(x, z) < 3.6 and d.r(x, y, z) < 0.45 and (x, z) != (0, -3): d.put(x, y, z, "spruce_slab", half="top")
    # the bell frame on top, against the sky, on two old posts up from the ground floor (2026-11-14: it hung in the air)
    for x in (-2, 2):
        for y in range(1, 15): d.put(x, y, 0, "stripped_spruce_log", axis="y")
    for x in range(-2, 3):
        for z in (-1, 0, 1): d.put(x, 15, z, "spruce_planks" if d.r(x, 15, z) < 0.85 else "spruce_slab")
    bell_frame(d, 0, 16, 0, w=2, tall=4, wood="oak")
    rubble(d, 0, 0, 10, 26, salt=7)
    corvins_rooms(d)
    d.meta["mark"] = [0, 1, 6]
    return d


def corvins_rooms(d):
    """What the tower keeps below and behind: the hearth on the ground floor, the room behind it where Corvin hid
    his map of the thin places, and the cellar under the floor where he was held. Tomes: chron_04 on the ground
    floor, corv_01 by the bell frame, corv_08 behind the hearth, seal_05 in the cellar."""
    # the hearth in the west wall: an open fire under a mantle, its back black with soot and, when you stand in
    # it, open: a passage through the wall into the hidden room
    for z in (-1, 1):
        for y in (1, 2, 3): d.put(-4, y, z, "stone_bricks")
    d.put(-4, 1, 0, "campfire", bs={"extinguished": True}); d.air(-4, 2, 0)
    d.put(-4, 3, 0, "stone_brick_slab", half="top")
    for z in (-1, 0, 1): d.put(-3, 4, z, "stone_brick_stairs", facing="w", half="top")
    for y in (1, 2): d.air(-5, y, 0)
    for y in range(3, 12): d.put(-5, y, 0, "stone_bricks")
    d.put(-5, 0, 0, "blackstone")
    # the hidden room (inside x -8..-6, z -1..1): built against the tower and heaped over with rubble and turf so
    # from outside it is only a mound at the foot of the wall
    for x in range(-9, -4):
        for z in range(-2, 3):
            for y in range(0, 5):
                inside = -8 <= x <= -6 and -1 <= z <= 1 and 1 <= y <= 3
                if inside: d.air(x, y, z)
                elif (x, z) == (-5, 0) and y in (1, 2): continue      # the way through from the hearth
                elif x <= -6 or y in (0, 4) or d.get(x, y, z) is None:
                    d.put(x, y, z, "blackstone" if y == 0 else d.pick(x, y, z, [("cobblestone", 3), ("mossy_cobblestone", 3), ("stone_bricks", 1)], 15))
    for x in range(-10, -4):                              # the mound over it
        for z in range(-3, 4):
            if d.get(x, 4, z) is None and math.hypot(x + 7, z) < 3.6 and x <= -6: d.put(x, 4, z, "mossy_cobblestone")
            if math.hypot(x + 7, z) < 2.9 and x <= -6: d.put(x, 5, z, "moss_block" if d.r(x, 5, z, 15) < 0.7 else "coarse_dirt")
            if math.hypot(x + 7.5, z) < 1.6 and x <= -6: d.put(x, 6, z, "moss_block")
    for x in range(-12, -4):
        for z in range(-5, 6):
            if -9 <= x and -2 <= z <= 2: continue
            dist = math.hypot(max(-9 - x, 0), max(abs(z) - 2, 0))
            top = round(4.6 - 1.1 * dist + 0.9 * d.r(x, 3, z, 17) - (0.6 if x == -5 else 0))
            for y in range(1, top + 1):
                if d.get(x, y, z) is None:
                    d.put(x, y, z, ("moss_block" if d.r(x, y, z, 18) < 0.75 else "coarse_dirt") if y == top else
                          d.pick(x, y, z, [("coarse_dirt", 2), ("mossy_cobblestone", 2), ("dirt", 1)], 17))
            if top >= 1 and d.r(x, 9, z, 19) < 0.18: d.put(x, top + 1, z, "short_grass")
    d.put(-8, 1, 0, "cartography_table"); d.put(-8, 1, -1, "stripped_spruce_wood"); d.put(-8, 1, 1, "barrel", facing="u")
    d.put(-6, 1, -1, "spruce_stairs", facing="e")         # where he sat to draw it
    d.put(-8, 2, 1, "candle"); d.put(-7, 3, 0, "iron_chain", axis="y")
    # a small table on the ground floor, and the trapdoor down to the cellar
    d.put(2, 1, -2, "stripped_spruce_wood")
    d.put(0, 0, 3, "spruce_trapdoor", facing="n", half="top")
    # the cellar where he was held (inside x -3..3, z -3..3, y -4..-2)
    for x in range(-4, 5):
        for z in range(-4, 5):
            for y in range(-5, 0):
                edge = max(abs(x), abs(z)) == 4 or y == -5
                if edge: d.put(x, y, z, d.pick(x, y, z, [("cobblestone", 3), ("mossy_cobblestone", 2), ("stone", 1), ("cobbled_deepslate", 1)], 16))
                elif y < -1 or (x, z) == (0, 3): d.air(x, y, z)
                else: d.put(x, y, z, "cobblestone")
    for y in range(-4, 0): d.put(0, y, 3, "ladder", bs={"facing_direction": 2})   # against the south wall
    for x in range(-3, 4):                                # bars across the north end: the cell
        for y in (-4, -3, -2):
            if x != 1 or y == -2: d.put(x, y, -1, "iron_bars")    # its door long gone
    d.put(-2, -4, -3, "hay_block"); d.put(-1, -4, -3, "brown_carpet")   # his pallet
    d.put(2, -4, -3, "cauldron"); d.put(3, -2, -2, "iron_chain", axis="y"); d.put(3, -3, -2, "iron_chain", axis="y")
    for z in (-3, -2): d.put(-4, -3, z, "chiseled_stone_bricks")      # marks scratched in the wall
    d.put(-3, -4, 2, "lantern", hanging=False)
    d.meta.setdefault("tomes", []).extend([[2, 2, -2, "chron_04"], [1, 16, -1, "corv_01"], [-7, 1, 1, "corv_08"], [0, -4, -3, "seal_05"]])

# ---------------------------------------------------------------- the Blackfen


def mags_hut():
    """Old Mag's hut, past the last lantern of Mirelight: a mangrove hut on stilts, herbs drying, one lamp."""
    d = D("mags_hut", "drape", seed=251, rise=True)
    for x, z in ((-3, -3), (3, -3), (-3, 3), (3, 3), (0, -3), (0, 3), (-3, 0), (3, 0)):
        for y in range(1, 4): d.put(x, y, z, "mangrove_log", axis="y")
    for x in range(-3, 4):
        for z in range(-3, 4):
            d.put(x, 4, z, "mangrove_planks")
            if max(abs(x), abs(z)) == 3 and not (abs(x) == 3 and abs(z) == 3):
                for y in (5, 6, 7): d.put(x, y, z, "mud_bricks" if (x, z) not in ((0, 3),) else "air")
            if abs(x) == 3 and abs(z) == 3:
                for y in (5, 6, 7): d.put(x, y, z, "stripped_mangrove_log", axis="y")
    d.put(0, 5, 3, "mangrove_door", facing="s"); d.put(0, 6, 3, "mangrove_door", facing="s", upper=True)
    d.put(-3, 6, 0, "brown_stained_glass_pane"); d.put(3, 6, 0, "brown_stained_glass_pane")
    for x in range(-4, 5):   # a mossy hipped roof
        for z in range(-4, 5):
            k = 4 - max(abs(x), abs(z))
            d.put(x, 8 + k, z, "moss_block" if k == 4 else "mangrove_stairs" if k < 3 else "mangrove_planks",
                  facing="n" if z > abs(x) else "s" if -z > abs(x) else "w" if x > 0 else "e")
            if k < 3 and d.r(x, 8, z) < 0.3: d.put(x, 9 + k, z, "moss_carpet")
    for x in range(-2, 3): d.put(x, 1, 4 + abs(x) // 2, "mangrove_roots")
    for k in range(4): d.put(0, 4 - k, 4 + k, "mangrove_stairs", facing="n")     # steps down to the mud
    d.put(2, 5, 4, "lantern", hanging=False)
    for x in (-2, 2): d.put(x, 7, 2, "iron_chain", axis="y")
    d.put(1, 5, -2, "cauldron"); d.put(-2, 5, -2, "barrel", bs={"facing_direction": 1})
    d.meta["npcs"] = [[1, 5, 1, "mag"]]
    d.meta["piles"] = ["mangrove_log"]
    d.meta["mark"] = [0, 5, 4]
    return d


def nell_raft():
    """Nell Sedge's raft-house, moored in the reeds further out than anyone lives: a deck on the water, a cabin,
    the kettle always on."""
    d = D("nell_raft", "drape", seed=261, rise=True)
    for x in range(-4, 5):
        for z in range(-3, 4):
            d.put(x, 0, z, "spruce_planks" if (x + 100) % 3 else "stripped_spruce_log", axis="z")
    for x in range(-1, 4):
        for z in range(-2, 3):
            if x in (-1, 3) or abs(z) == 2:
                for y in (1, 2, 3): d.put(x, y, z, "stripped_spruce_log" if (x in (-1, 3) and abs(z) == 2) else "spruce_planks", axis="y")
    d.put(-1, 1, 0, "spruce_door", facing="w"); d.put(-1, 2, 0, "spruce_door", facing="w", upper=True)
    d.put(3, 2, 0, "glass_pane")
    for x in range(-2, 5):
        for z in range(-3, 4):
            k = 3 - abs(z)
            if k >= 0: d.put(x, 4 + (k // 2), z, "spruce_slab" if k == 3 else "spruce_stairs", facing="n" if z > 0 else "s", half="bottom")
    d.put(-3, 1, -2, "campfire"); d.put(-3, 2, -2, "cauldron")                  # the kettle
    d.put(-4, 1, 3, "spruce_fence"); d.put(-4, 2, 3, "lantern", hanging=False)
    for x, z in ((-5, 0), (5, 2), (5, -2)): d.put(x, 1, z, "spruce_fence")      # mooring posts
    d.meta["npcs"] = [[-2, 1, 1, "nell"]]
    d.meta["mark"] = [-4, 1, 0]
    return d

# ---------------------------------------------------------------- the Deepforge and the Cinder Roost


def deepforge():
    """The Deepforge: a forge hall cut into the mountain above Rimehold, its fire burning four hundred years.
    Front (-z) is the open hillside; the hall runs into the rock."""
    d = D("deepforge", "carve", seed=271)
    W, H, L = 6, 8, 24
    for x in range(-W - 1, W + 2):
        for z in range(0, L + 2):
            for y in range(0, H + 2):
                edge = abs(x) == W + 1 or z == L + 1 or y in (0, H + 1)
                if edge:
                    d.put(x, y, z, d.pick(x, y, z, [("deepslate_bricks", 4), ("polished_blackstone_bricks", 2), ("cracked_deepslate_bricks", 1)]))
                else:
                    d.air(x, y, z)
    # the great door frame on the hillside, and the way out cleared in front of it
    for x in range(-W - 2, W + 3):
        for y in range(0, H + 3):
            if abs(x) >= W - 1 or y >= H - 1: d.put(x, y, -1, "polished_blackstone_bricks" if (x + y) % 4 else "gilded_blackstone")
            else: d.air(x, y, -1)
    for x in range(-W + 2, W - 1):
        for z in range(-6, -1):
            for y in range(1, H): d.air(x, y, z)
            d.put(x, 0, z, "cobbled_deepslate" if d.r(x, 0, z) < 0.6 else "polished_deepslate")
    for x in (-W + 2, W - 2): d.put(x, H - 2, -1, "polished_blackstone_brick_stairs", facing="e" if x < 0 else "w", half="top")
    # pillars down the hall
    for z in range(4, L, 6):
        for s in (-1, 1):
            for y in range(1, H + 1): d.put(s * (W - 1), y, z, "polished_basalt", axis="y")
            d.put(s * (W - 1), H, z + 1, "deepslate_brick_stairs", facing="n", half="top")
            d.put(s * (W - 1), H, z - 1, "deepslate_brick_stairs", facing="s", half="top")
            d.put(s * (W - 2), H - 1, z, "lantern", hanging=True)
    # Hroda's fire: a great hearth at the back, the fire behind bars
    for x in range(-3, 4):
        for y in range(1, 7):
            for z in (L - 2, L - 1, L):
                inner = abs(x) <= 1 and y <= 3 and z >= L - 1
                if inner: d.put(x, y, z, "lava" if (y == 1 and z == L) else "air")
                else: d.put(x, y, z, "polished_blackstone_bricks" if y < 6 else "blackstone")
        d.put(x, 1, L - 2, "magma") if abs(x) <= 1 else None
    for x in (-1, 0, 1):
        for y in (2, 3): d.put(x, y, L - 2, "iron_bars")
        d.put(x, 1, L - 1, "campfire")
    for y in range(7, H + 2): d.put(0, y, L, "polished_blackstone_bricks")
    # the work floor: anvils, the quench, grindstones, chains for the moulds that were taken
    for x, z, b in ((-3, L - 6, "anvil"), (3, L - 6, "anvil"), (-4, L - 10, "smithing_table"), (4, L - 10, "blast_furnace"),
                    (4, L - 12, "blast_furnace"), (-4, L - 12, "grindstone")):
        d.put(x, 1, z, b, bs={"minecraft:cardinal_direction": "north"} if "anvil" in b else {})
    for x in range(-2, 3): d.put(x, 1, L - 14, "cauldron")
    for x in (-2, 2):
        for y in range(H - 3, H + 1): d.put(x, y, L - 8, "iron_chain", axis="y")
    d.meta["npcs"] = [[0, 1, L - 5, "ulla"]]
    d.meta["mark"] = [0, 1, -2]
    return d


def _kasbah(d, cx, cz, w, h, RS, salt=0):
    """A tapering Emberwaste kasbah tower (regions/emberwaste.md: towers taper, the corners rise as horns above the
    parapet): square, w wide at the foot (odd), stepping in one block on each side every third of its height, a
    floor every 5 with a ladder in the north-east corner, small deep windows, beam ends under the parapet."""
    n = w // 2
    for y in range(1, h + 1):
        m = n - (1 if y > h * 2 // 3 else 0) - (1 if y > h // 3 and n > 3 else 0)
        for x in range(-m, m + 1):
            for z in range(-m, m + 1):
                edge = abs(x) == m or abs(z) == m
                if edge: d.put(cx + x, y, cz + z, d.pick(cx + x, y, cz + z, RS, salt))
                elif y % 5 == 0 and not (x == m - 1 and z == -(m - 1)): d.put(cx + x, y, cz + z, "acacia_planks")
                elif d.get(cx + x, y, cz + z) is None: d.air(cx + x, y, cz + z)
        if y % 5 == 3 and y < h - 2:                        # a deep window in the middle of each face
            for (x, z) in ((0, -m), (0, m), (-m, 0), (m, 0)): d.air(cx + x, y, cz + z)
        if y < h: d.put(cx + n - 1 - (n - m), y, cz - (n - 1 - (n - m)), "ladder", facing="s")
    m = n - (1 if n > 3 else 0) - 1
    for x in range(-m - 1, m + 2):                          # beam ends one out under the parapet
        for z in (-m - 1, m + 1):
            if (x + z) % 2 == 0: d.put(cx + x, h - 1, cz + z, "stripped_acacia_log", axis="z")
    for x in range(-m, m + 1):
        for z in range(-m, m + 1):
            if abs(x) == m or abs(z) == m: d.put(cx + x, h + 1, cz + z, "red_sandstone_wall" if (abs(x) != m or abs(z) != m) and (x + z) % 2 else ("cut_red_sandstone" if abs(x) == m and abs(z) == m else "air"))
            else: d.put(cx + x, h, cz + z, "smooth_red_sandstone")
    for sx in (-m, m):                                      # the horns: the four corners rise three above the deck
        for sz in (-m, m):
            for y in range(h + 1, h + 4): d.put(cx + sx, y, cz + sz, "cut_red_sandstone" if y < h + 3 else "red_sandstone_wall")


def cinder_roost():
    """The Cinder Roost: the dragon riders' school on the mesa above Sunscar, a castle-school spread over the whole
    top (Mateo 2026-11-13: "this should be much bigger", the feel of a great old school, not its look). Front (-z) is
    the drop. From the Span gate on the north cliff: the court of the fallen (Kesh at the roll of names), the riders'
    great hall to the west, the school wing with its dome to the east, the rookery tower, a covered bridge between the
    hall and the school at the upper floor, the dragon stables with their landing deck, the sand ring, the library,
    terrace houses stepping down the north cliff, a curtain wall and the south gate where the climb from Sunscar
    (story_areas.roost) arrives. The Span and the perch are as they were (the Rider trial).
    Every size odd; the yard is y 0."""
    d = D("cinder_roost", "rigid", seed=281, fill="red_sandstone", top="keep", ease=3, clearTo=40,
          fillRects=[[-37, 0, 37, 59], [-25, -9, -11, -1], [11, -9, 25, -1], [19, -17, 33, -9]])
    RS = [("red_sandstone", 3), ("cut_red_sandstone", 2), ("smooth_red_sandstone", 2), ("chiseled_red_sandstone", 1)]
    lad = {"ladder": ["smooth_red_sandstone", "red_sandstone", "cut_red_sandstone"], "axis": "noise", "scale": 2}
    d.materials = {"rwall": lad, "rplinth": {"block": "cut_red_sandstone"}}
    ST = {"base": "ember_sandstone", "frame": "cut_red_sandstone", "infill": lad, "roof": "smooth_red_sandstone"}
    FLAT = {"type": "flat", "parapet": "crenel", "beams": "stripped_acacia_log"}
    DOME = lambda x, z, r, **k: {"part": "dome", "at": [x, z], "r": r, "drum": {"h": 3, "windows": 4, "glass": "yellow_stained_glass_pane"}, "finial": "gold", **k}
    KEEP = lambda x, z, r, h, **k: {"part": "keep", "at": [x, z], "r": r, "y": 0, "h": h, "floors": list(range(5, h - 1, 5)),
                                    "material": "rwall", "plinth": "rplinth", "trim": "cut_red_sandstone", "floor": "acacia_planks",
                                    "slits": {"sides": "nsew", "glass": "orange_stained_glass_pane"}, "ladder": "e", "flag": "red_wool", **k}
    d.parts = [
        # the riders' great hall, west of the court: one tall storey, the long tables, its door onto the court
        {"part": "house", "style": ST, "rect": [-27, 9, -9, 31], "y": 0, "storeys": [9], "door": {"side": "e", "kind": "grand"},
         "roof": FLAT, "chimney": False, "shutters": 0, "interior": {"use": "hall", "rooms": ["hall"], "region": "emberwaste"}},
        # the school wing, east of the court: guardroom and classroom, the library floor, the students' bunks
        {"part": "house", "style": ST, "rect": [9, 9, 27, 23], "y": 0, "storeys": [5, 5, 5], "door": {"side": "w"},
         "roof": FLAT, "chimney": False, "shutters": 0.3, "interior": {"rooms": ["guard", "library", "bunks"], "region": "emberwaste"}},
        DOME(18, 16, 3.5),
        # the library, south-east: two floors of books and a small dome
        {"part": "house", "style": ST, "rect": [17, 39, 31, 51], "y": 0, "storeys": [5, 5], "door": {"side": "w"},
         "roof": FLAT, "chimney": False, "shutters": 0.3, "interior": {"use": "library", "region": "emberwaste"}},
        DOME(24, 45, 2.5),
        # the dragon stables, south-west: one storey nine high; two great arches open east onto the sand (cut below),
        # the flat roof is the landing deck
        {"part": "house", "style": ST, "rect": [-29, 35, -11, 51], "y": 0, "storeys": [9], "door": {"side": "n"},
         "roof": FLAT, "chimney": False, "shutters": 0, "interior": {"use": "stable", "region": "emberwaste"}},
        # terrace houses stepping down the north cliff (their roofs are lookouts off the rim walk)
        {"part": "house", "style": ST, "rect": [11, -9, 25, -1], "y": -6, "storeys": [5], "door": {"side": "e"},
         "roof": FLAT, "chimney": False, "shutters": 0.3, "interior": {"use": "barracks", "rooms": ["bunks"], "region": "emberwaste"}},
        {"part": "house", "style": ST, "rect": [19, -17, 33, -9], "y": -12, "storeys": [5], "door": {"side": "e"},
         "roof": FLAT, "chimney": False, "shutters": 0.3, "interior": {"use": "storage", "region": "emberwaste"}},
        {"part": "house", "style": ST, "rect": [-25, -9, -11, -1], "y": -6, "storeys": [5], "door": {"side": "w"},
         "roof": FLAT, "chimney": False, "shutters": 0.3, "interior": {"use": "barracks", "rooms": ["bunks"], "region": "emberwaste"}},
        # the towers: the Span gate pair, the rookery (tallest), the star tower, the corners, the south gate pair
        KEEP(-6, 3, 3.5, 18, doors=[{"side": "s", "floor": 0}]), KEEP(6, 3, 3.5, 18, doors=[{"side": "s", "floor": 0}]),
        KEEP(22, 31, 4.5, 33, doors=[{"side": "w", "floor": 0}], flags=[{"at": [0, 0], "dir": "e", "h": 4}]),
        KEEP(-31, 21, 3.5, 25, doors=[{"side": "e", "floor": 0}]),
        KEEP(-33, 3, 2.5, 13, doors=[{"side": "s", "floor": 0}]), KEEP(33, 3, 2.5, 13, doors=[{"side": "s", "floor": 0}]),
        KEEP(-33, 55, 2.5, 13, doors=[{"side": "n", "floor": 0}]), KEEP(33, 55, 2.5, 13, doors=[{"side": "n", "floor": 0}]),
        KEEP(-5, 57, 2.5, 15, doors=[{"side": "n", "floor": 0}]), KEEP(5, 57, 2.5, 15, doors=[{"side": "n", "floor": 0}]),
        DOME(22, 31, 3.5, y=34, shape="onion"),
        # the curtain round the land sides (the north is the cliff) and the south gate the climb arrives at
        {"part": "curtain", "path": [[-35, 6], [-35, 57], [35, 57], [35, 6]], "y": 0, "h": 5, "material": "rwall", "plinth": "rplinth",
         "cap": "cut_red_sandstone", "turrets": [{"at": [-35, 30], "size": 3, "h": 9}, {"at": [35, 30], "size": 3, "h": 9}],
         "gate": {"at": [0, 57], "face": "s", "w": 3, "h": 4, "crown": 4, "banner": "red_wool", "trim": "acacia_planks"}},
    ]
    # ---- the ground: paving everywhere inside, sand in the ring, a garden of palms between the stables and the road
    for x in range(-35, 36):
        for z in range(0, 58):
            d.put(x, 0, z, d.pick(x, 0, z, [("smooth_red_sandstone", 4), ("red_sandstone", 2), ("cut_red_sandstone", 1), ("red_sand", 1)]))
    for x in range(-1, 2):
        for z in range(31, 58): d.put(x, 0, z, "cut_red_sandstone" if x == 0 else "smooth_sandstone")
    RING = (8, 46)
    for x in range(1, 16):
        for z in range(38, 55):
            r = math.hypot(x - RING[0], z - RING[1])
            if r <= 6.5: d.put(x, 0, z, "sand" if d.r(x, 0, z, 3) < 0.8 else "red_sand")
            elif r <= 7.5:
                d.put(x, 0, z, "cut_red_sandstone")
                if not (abs(z - RING[1]) <= 1 and x < RING[0]): d.put(x, 1, z, "red_sandstone_wall")
    d.put(RING[0], 1, RING[1], "stripped_acacia_log"); d.put(RING[0], 2, RING[1], "stripped_acacia_log"); d.put(RING[0], 3, RING[1], "target")
    for (x, z) in ((-7, 37), (-4, 44), (-8, 50), (-5, 53)): palm(d, x, z, tall=7 + (x + z) % 3, bend=(1 if x < -5 else -1, 0), salt=x)
    for x in range(-10, -1):
        for z in range(36, 56):
            if d.r(x, 0, z, 9) < 0.35: d.put(x, 0, z, "coarse_dirt")
    # ---- the north rim: a low wall along the cliff edge, the Span gate between the two keeps
    for x in list(range(-35, -9)) + list(range(10, 36)):
        if abs(x) < 10: continue
        d.put(x, 1, 0, "red_sandstone_wall")
        if x % 6 == 0: d.put(x, 2, 0, "lantern")
    for x in range(-3, 4):
        for z in range(0, 7):
            wall = abs(x) == 3 or z in (0, 6)
            for y in range(1, 13):
                if wall or y in (6, 12): d.put(x, y, z, d.pick(x, y, z, RS, 2))
                else: d.air(x, y, z)
            if (x + z) % 2 == 0 and wall: d.put(x, 13, z, "red_sandstone_wall")
    for z in (0, 6):                                        # the passage, an arch at each end
        for x in range(-1, 2):
            for y in range(1, 5): d.air(x, y, z)
        d.put(-1, 4, z, "red_sandstone_stairs", facing="w", half="top"); d.put(1, 4, z, "red_sandstone_stairs", facing="e", half="top")
        d.put(0, 5, z, "chiseled_red_sandstone")
    for z in range(1, 6):
        for x in range(-2, 3):
            for y in range(1, 6): d.air(x, y, z)
        d.put(0, 5, z, "lantern", hanging=True)
    # ---- the court of the fallen: a cloister round the court (pillars and arches, a slab roof), a well in the middle
    for x in range(-7, 8):
        for z in range(9, 32):
            inner = -5 <= x <= 5 and 11 <= z <= 29
            if inner: continue
            d.put(x, 5, z, "smooth_red_sandstone_slab", half="bottom")
            if x in (-5, 5) and z % 3 == 2 and 11 <= z <= 29 or z in (11, 29) and x % 3 == 0 and -5 <= x <= 5:
                for y in range(1, 5): d.put(x, y, z, "cut_red_sandstone")
                d.put(x, 1, z, "chiseled_red_sandstone")
            elif x in (-5, 5) and 11 <= z <= 29:
                d.put(x, 4, z, "red_sandstone_stairs", facing="n" if z % 3 == 0 else "s", half="top")
            elif z in (11, 29) and -5 <= x <= 5:
                d.put(x, 4, z, "red_sandstone_stairs", facing="w" if x % 3 == 1 else "e", half="top")
    for x in range(-1, 2):
        for z in range(19, 22):
            d.put(x, 1, z, "cut_red_sandstone" if (x, z) != (0, 20) else "water")
    d.put(0, 0, 20, "water")
    for (x, z) in ((-1, 19), (1, 19), (-1, 21), (1, 21)): d.put(x, 2, z, "acacia_fence")
    for x in range(-1, 2):
        for z in range(19, 22): d.put(x, 3, z, "smooth_red_sandstone_slab", half="bottom")
    for (x, z) in ((-3, 15), (3, 25)): palm(d, x, z, tall=8, bend=(0, 1), salt=7)
    # the names of the fallen on the court side of the Span gate, where Kesh keeps them
    names = ["ORREN of the\nRed Wing", "TASKA\nand Emberlash", "YSOLT\nthe First", "BRAN\nand Coalheart", "MERE\nwho flew blind", "KESHAN\nthe Elder"]
    for k, x in enumerate((-3, -2, 2, 3, -4, 4)):
        zz, yy = (7, 2) if abs(x) <= 3 else (7, 3)
        if abs(x) == 4: continue
        d.put(x, yy, zz, "dark_oak_wall_sign", facing="s"); d.meta["signs"].append([x, yy, zz, names[k]])
    for k, x in enumerate((-9, 9)):
        d.put(x, 2, 7, "dark_oak_wall_sign", facing="s"); d.meta["signs"].append([x, 2, 7, names[4 + k]])
        d.put(x, 1, 6, "cut_red_sandstone"); d.put(x, 2, 6, "cut_red_sandstone")
    for x in (-4, 4): d.put(x, 1, 8, "lantern")
    # ---- the covered bridge between the hall and the school, over the cloister at the upper floor
    BY = 11
    for x in range(-9, 10):
        for z in range(13, 18):
            side = z in (13, 17)
            d.put(x, BY, z, "acacia_planks" if not side else "cut_red_sandstone")
            if side and -8 <= x <= 8:
                for y in range(BY + 1, BY + 4):
                    d.put(x, y, z, "orange_stained_glass_pane" if y == BY + 2 and x % 2 == 0 else d.pick(x, y, z, RS, 4))
            elif -8 <= x <= 8:
                for y in range(BY + 1, BY + 4): d.air(x, y, z)
            d.put(x, BY + 4, z, "smooth_red_sandstone_slab", half="bottom")
            if -8 <= x <= 8 and z in (13, 17): d.put(x, BY + 5, z, "red_sandstone_wall" if x % 2 else "air")
        for z in range(14, 17):
            if x in (-9, 9):
                for y in range(BY + 1, BY + 4): d.air(x, y, z)
    for x in range(-8, 9):                                  # its underside: a shallow arch over the court
        k = abs(x)
        if k >= 6: d.put(x, BY - 1, 13, "cut_red_sandstone"); d.put(x, BY - 1, 17, "cut_red_sandstone")
        for z in (13, 17):
            if k >= 7: d.put(x, BY - 2, z, "cut_red_sandstone")
            if k == 5: d.put(x, BY - 1, z, "red_sandstone_stairs", facing="e" if x < 0 else "w", half="top")
    for x in (-3, 3): d.put(x, BY + 3, 15, "lantern", hanging=True)
    # ---- kasbah towers at the hall's north-west and the school's north-east corners
    _kasbah(d, -29, 9, 7, 19, RS, 11)
    _kasbah(d, 29, 11, 7, 23, RS, 12)
    # ---- the stables' great arches onto the sand
    for zc in (39, 47):
        for z in range(zc - 2, zc + 3):
            for y in range(1, 8 if abs(z - zc) < 2 else 7): d.air(-11, y, z)
        d.put(-11, 7, zc - 2, "red_sandstone_stairs", facing="s", half="top"); d.put(-11, 7, zc + 2, "red_sandstone_stairs", facing="n", half="top")
        for z in range(zc - 1, zc + 2): d.put(-11, 8, z, "chiseled_red_sandstone")
        for z in range(zc - 2, zc + 3): d.put(-11, 0, z, "red_sand")
    for z in range(37, 50, 4): d.put(-20, 1, z, "hay_block"); d.put(-26, 1, z, "hay_block")
    # stairs from the rim walk down to the terrace houses' doors
    for i in range(6):
        for x in (26, 27): d.put(x, -i, -1 - i, "red_sandstone_stairs", facing="n"); d.put(x, -i - 1, -1 - i, "red_sandstone")
        for x in (-27, -26): d.put(x, -i, -1 - i, "red_sandstone_stairs", facing="n"); d.put(x, -i - 1, -1 - i, "red_sandstone")
    for i in range(6):
        for x in (34, 35): d.put(x, -6 - i, -8 - i, "red_sandstone_stairs", facing="n"); d.put(x, -7 - i, -8 - i, "red_sandstone")
    for x in range(26, 36):
        for z in range(-8, -6): d.put(x, -6, z, "smooth_red_sandstone")
    for (x, z) in ((26, 0), (27, 0), (-27, 0), (-26, 0)): d.air(x, 1, z)
    # the Span: one block wide out over the drop, with nothing to hold on to. Older than the town and it doesn't hold
    # together everywhere: two stones are gone (step over), and the plain red sandstone blocks among the slabs are loose
    # (they give way a second after you step on them: roletrials CRUMBLES). Fall and you're washed out for three days.
    GONE, LOOSE = (-6, -12), (-4, -9, -14)
    # the drop under it: the site stands on a cliff edge (sites.js), so the land under the Span is the flats below,
    # about seven blocks down. In case the map's edge runs a little different, nothing within four blocks of the Span
    # is left higher than seven below it: no ledge to step down onto. Fall and you walk out across the flats.
    for z in range(-1, -17, -1):
        for x in range(-4, 5):
            for y in range(-6, 1): d.air(x, y, z)
    for z in range(-1, -17, -1):
        for x in (-1, 1):                  # where the old three-wide Span and its parapets stood (worlds built before)
            for y in (-1, 0, 1): d.air(x, y, z)
        d.air(0, -1, z)
        if z in GONE: d.air(0, 0, z); continue
        if z in LOOSE: d.put(0, 0, z, "red_sandstone")
        else: d.put(0, 0, z, "smooth_red_sandstone_slab", half="top")
        if z not in LOOSE and z != -5 and z != -7 and z != -11 and z != -13:
            d.put(0, -1, z, "red_sandstone_stairs", facing="n" if z < -8 else "s", half="top")
    # the perch: a round tower at the far end, its top a landing for a dragon
    for x in range(-4, 5):
        for z in range(-25, -16):
            r = math.hypot(x, z + 21)
            if r <= 4.4:
                for y in range(-14, 1): d.put(x, y, z, d.pick(x, y, z, RS, 5) if r > 3.4 or y in (-14, 0) else "air")
                if r > 3.6 and not (x == 0 and z == -17): d.put(x, 1, z, "red_sandstone_wall")   # a gap where the Span lands
    d.air(0, 1, -17)
    d.put(0, 1, -21, "campfire", bs={"extinguished": True})
    # ---- light (Mateo 2026-11-13: "light all the builds"): lanterns on posts across the yards, on the curtain's walk
    # every sixth block, on every tower deck and either side of every door and gate, hung in the cloister and the
    # passages, round the sand ring, and on the roof terraces' corners
    def post(x, z, y=1):
        if d.get(x, y, z) not in (None,): return
        d.put(x, y, z, "red_sandstone_wall"); d.put(x, y + 1, z, "lantern")
    for (x, z) in ((-5, 33), (5, 33), (-5, 40), (-5, 47), (-5, 55), (5, 55), (14, 33), (14, 54), (-31, 33), (-31, 54), (-14, 54),
                   (-8, 7), (8, 7), (-20, 4), (20, 4), (-31, 7), (31, 7), (14, 26), (-14, 26), (30, 26), (30, 36)):
        post(x, z)
    for k in range(-33, 34, 6):                                         # along the curtain's walk (cap at y 5)
        for (x, z) in ((k, 57), (-35, k + 30), (35, k + 30)):
            if 7 <= z <= 57 and abs(x) not in (4, 5, 6) and not (abs(x) <= 2 and z == 57): d.put(x, 6, z, "lantern")
    for (x, z, r, h) in ((-6, 3, 3.5, 18), (6, 3, 3.5, 18), (22, 31, 4.5, 33), (-31, 21, 3.5, 25), (-33, 3, 2.5, 13), (33, 3, 2.5, 13),
                         (-33, 55, 2.5, 13), (33, 55, 2.5, 13), (-5, 57, 2.5, 15), (5, 57, 2.5, 15)):
        if (x, z) != (22, 31): d.put(x, h + 1, z, "lantern")
        d.put(x + 1, h + 1, z + 1, "lantern") if (x, z) == (22, 31) else None
    for (x, z) in ((-2, 59), (2, 59)): d.put(x, 1, z, "red_sandstone_wall"); d.put(x, 2, z, "lantern")     # the south gate, outside
    for z in range(10, 31, 5):                                          # the cloister walk, hung under its roof
        for x in (-6, 6): d.put(x, 4, z, "lantern", hanging=True)
    for x in range(-3, 4, 3):
        for z in (10, 30): d.put(x, 4, z, "lantern", hanging=True)
    for a in range(0, 360, 45):                                         # round the sand ring
        x, z = RING[0] + round(8.5 * math.cos(math.radians(a))), RING[1] + round(8.5 * math.sin(math.radians(a)))
        if abs(z - RING[1]) > 1 or x > RING[0]: post(x, z)
    for (x0, z0, x1, z1, top) in ((-27, 13, -9, 31, 10), (9, 9, 25, 23, 16), (17, 39, 31, 51, 11), (-29, 35, -11, 51, 10)):
        for (x, z) in ((x0 + 1, z0 + 1), (x1 - 1, z0 + 1), (x0 + 1, z1 - 1), (x1 - 1, z1 - 1)): d.put(x, top, z, "lantern")
    # ---- life (Mateo 2026-11-13: "wild dragons flying around, wild dragons in the yards, people and NPCs training with
    # the dragons"): landmarks/life.js keeps these about while a player is near. sky = a dragon circling the point
    # (species, radius, height, name; wild ones have no name); dragon = one standing or asleep there (species, stage,
    # pose); folk = one of the Roost's people (landmarks/life_data.js ROOST_FOLK, by number)
    d.meta["life"] = [
        [0, 1, 27, "sky:cinderwing:52:30:"], [0, 1, 27, "sky:wyvern:38:44:"], [0, 1, 27, "sky:wyrm:68:22:"], [0, 1, 27, "sky:drake:30:54:"],
        [RING[0], 1, RING[1], "sky:cinderwing:9:7:Cadet Tamsin on Ember"],
        [-15, 1, 39, "dragon:cinderwing:adult:0"], [-15, 1, 47, "dragon:drake:adult:0"], [-24, 10, 43, "dragon:wyvern:adult:0"],
        [-16, 10, 38, "dragon:cinderwing:fledgling:0"], [8, 1, 42, "dragon:wyvern:fledgling:0"], [-18, 1, 4, "dragon:wyrm:adult:1"],
        [44, 1, 30, "dragon:drake:adult:1"], [-46, 1, 16, "dragon:cinderwing:adult:0"], [26, 1, 4, "dragon:wyvern:hatchling:0"],
        [5, 1, 45, "folk:0"], [11, 1, 49, "folk:1"], [5, 1, 50, "folk:2"], [-17, 1, 43, "folk:3"], [-21, 10, 41, "folk:4"],
        [3, 1, 15, "folk:5"], [0, 1, 54, "folk:6"], [14, 1, 30, "folk:7"],
    ]
    d.meta["npcs"] = [[0, 1, 10, "kesh"]]
    d.meta["mark"] = [0, 1, 8]
    # the Rider trial's Span: from the gate's mouth to the last stone before the perch (roletrials marks.js)
    d.meta["roleMarks"] = [[0, 1, -1, "span_start"], [0, 1, -16, "span_end"]]
    return d


def sedge_graves():
    """Goody Sedge's three graves, on the last dry ground between Old Mag's hut and Nell's raft: low mounds under thin
    headstones gone green, a stub of candle on each. The Witch trial asks you to kneel at all three (roletrials).
    Three graves, 1 wide and 3 long, four blocks apart (odd sizes)."""
    d = D("sedge_graves", "drape", seed=301)
    graves = []
    for k, x in enumerate((-4, 0, 4)):
        for z in range(0, 3):
            d.put(x, 0, z, d.pick(x, 0, z, [("coarse_dirt", 3), ("mud", 2), ("moss_block", 1)], k))
            if d.r(x, 1, z, k) < 0.5: d.put(x, 1, z, "moss_carpet")
        d.put(x, 0, -1, "mud_bricks")                                   # the headstone's footing
        d.put(x, 1, -1, "mossy_stone_brick_wall" if k == 1 else "mud_brick_wall")
        d.put(x, 2, -1, "candle", bs={"candles": 0, "lit": False})
        graves.append([x, 1, 1, "grave"])
    for x, z in ((-6, 2), (6, 0), (2, 4)): d.put(x, 1, z, "dead_bush")
    d.put(-2, 1, -2, "spruce_fence"); d.put(-2, 2, -2, "lantern", hanging=False)
    d.meta["roleMarks"] = graves
    return d


STORY_DESIGNS = {f.__name__: f for f in (
    crownhold_hall, crownhold_walls, bellhollow_seal, bellhollow_frame, ashen_chapterhouse, ashen_watch, corvins_tower,
    mags_hut, nell_raft, sedge_graves, deepforge, cinder_roost)}
from world_doors import DOOR_DESIGNS  # noqa: E402  (the sealed ways out and the Warlord King's ground)
STORY_DESIGNS.update(DOOR_DESIGNS)
from story_places import DESIGNS as PLACE_DESIGNS  # noqa: E402  (the Frostmarch watchtower, the Hallowmere shrine and ice door)
STORY_DESIGNS.update(PLACE_DESIGNS)
STORY_TURNING = {"deepforge", "cinder_roost", "shut_pass_gate", "westwatch", "southmost_light"}
