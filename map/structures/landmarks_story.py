"""The story's places out in the land (lore/data/world.js PLACES): Crownhold, Bellhollow, the Ashen Gate chapterhouse
and its Burned Archive, the Ashen Watch, Corvin's Tower, Old Mag's hut, Nell Sedge's raft-house, the Deepforge and
the Cinder Roost. Same design format as landmarks.py (minecraft-builder skill specs + placing keys), plus
    npcs  [[x, y, z, lore npc id]]  story characters the game stands there once, when it is built
"""
import math
from landmarks import D, h3, CARD, oak, post

STONE_RUIN = [("stone_bricks", 4), ("mossy_stone_bricks", 3), ("cracked_stone_bricks", 2), ("cobblestone", 1), ("mossy_cobblestone", 1)]
GREY = [("stone_bricks", 3), ("andesite", 1), ("polished_andesite", 1), ("tuff_bricks", 2), ("cracked_stone_bricks", 1)]


def ruin_height(d, x, z, base, var, salt=0):
    """A broken top: high in places, low in others, in soft lumps."""
    return base - int(var * (d.r(x // 2, 77, z // 2, salt) ** 1.3))


def wall_line(d, a, b, base, var, mix=STONE_RUIN, thick=1, salt=0):
    (x0, z0), (x1, z1) = a, b
    n = max(abs(x1 - x0), abs(z1 - z0))
    for k in range(n + 1):
        x = round(x0 + (x1 - x0) * k / max(n, 1)); z = round(z0 + (z1 - z0) * k / max(n, 1))
        top = ruin_height(d, x, z, base, var, salt)
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


def crownhold_hall():
    """The Hall of Bells: the old king's great hall, roofless, its bell frames empty, a bell tower broken off above
    the door; under the floor the cellar with the crack the old king sat beside."""
    d = D("crownhold_hall", "rigid", seed=201, fill="stone", top="keep", ease=4)
    W, L = 9, 17   # half sizes: 19 x 35
    for x in range(-W, W + 1):
        for z in range(-L, L + 1):
            edge = x in (-W, W) or z in (-L, L)
            d.put(x, 0, z, d.pick(x, 0, z, [("stone_bricks", 3), ("cracked_stone_bricks", 2), ("mossy_stone_bricks", 2), ("moss_block", 1), ("gravel", 1)]))
            if edge:
                top = ruin_height(d, x, z, 11, 9)
                for y in range(1, top + 1): d.put(x, y, z, d.pick(x, y, z, STONE_RUIN))
    # buttresses on the long walls, every 6, and tall lancet windows between them
    for z in range(-L + 3, L - 2, 6):
        for s in (-1, 1):
            x = s * (W + 1)
            for y in range(1, 9 - abs(z) // 8): d.put(x, y, z, "stone_bricks" if y % 3 else "polished_andesite")
            d.put(x, 9 - abs(z) // 8, z, "stone_brick_stairs", facing="w" if s > 0 else "e")
            for wz in (z + 2, z + 3):
                if abs(wz) < L:
                    for y in range(3, 8):
                        if d.get(s * W, y, wz): d.air(s * W, y, wz)
    # the door: a pointed arch in the south gable, under the stump of the bell tower
    for y in range(1, 6):
        for x in range(-1, 2): d.air(x, y, L)
    d.put(-1, 5, L, "stone_brick_stairs", facing="w", half="top"); d.put(1, 5, L, "stone_brick_stairs", facing="e", half="top")
    for x in range(-3, 4):
        for z in range(L - 2, L + 3):
            if abs(x) == 3 or z in (L - 2, L + 2):
                top = 22 - int(7 * d.r(x, 99, z) ** 0.7)
                for y in range(1, top + 1):
                    if not (abs(x) <= 1 and z >= L - 2 and y <= 5):
                        d.put(x, y, z, d.pick(x, y, z, STONE_RUIN, 3))
    bell_frame(d, 0, 15, L, w=2, tall=4)
    for x in range(-2, 3):
        for z in range(L - 1, L + 2): d.put(x, 14, z, "dark_oak_planks" if d.r(x, 14, z) < 0.7 else "air")
    # the empty bell frames down the nave: where the Founding Bell's sisters hung
    for z in (-11, -3, 5):
        bell_frame(d, 0, 1, z, w=3, tall=7, wood="dark_oak")
        for s in (-1, 1): d.put(s * 3, 1, z - 1, "dark_oak_stairs", facing="s"); d.put(s * 3, 1, z + 1, "dark_oak_stairs", facing="n")
    # fallen roof timbers and rubble in the nave
    for z in range(-14, 12, 5):
        if d.r(z, 1, 1) < 0.6:
            for x in range(-6, 7):
                if d.r(x, 2, z) < 0.8: d.put(x, 1, z + (x // 4), "stripped_dark_oak_log", axis="x")
    rubble(d, 0, 0, 8, 40, salt=5)
    # the dais at the north end, the throne gone, and the cellar stair beside it
    for x in range(-4, 5):
        for z in range(-L + 1, -L + 4): d.put(x, 1, z, "polished_andesite" if z > -L + 1 else "stone_bricks")
    for x in range(-2, 3): d.put(x, 1, -L + 4, "stone_brick_stairs", facing="n")
    # the cellar: the King's crack in the floor
    for x in range(-5, 6):
        for z in range(-L + 1, -L + 12):
            for y in range(-6, 0):
                edge = x in (-5, 5) or z in (-L + 1, -L + 11) or y == -6
                if edge: d.put(x, y, z, d.pick(x, y, z, [("deepslate_bricks", 3), ("cracked_deepslate_bricks", 2), ("cobbled_deepslate", 1)]))
                else: d.air(x, y, z)
    for k, y in enumerate(range(0, -6, -1)):   # a stair down along the east wall
        d.air(6 - 2, y, -L + 5 + k)
        d.put(6 - 2, y - 1, -L + 5 + k, "deepslate_brick_stairs", facing="s")
    d.air(4, 1, -L + 5)
    for z in range(-L + 3, -L + 10):           # the crack, running across the floor and up the north wall
        x = round(1.5 * math.sin(z * 0.9))
        d.put(x, -6, z, "tinted_glass" if d.r(x, -6, z) < 0.5 else "crying_obsidian")
    for y in range(-5, -1): d.put(round(1.5 * math.sin((-L + 2) * 0.9)), y, -L + 1, "crying_obsidian" if y % 2 else "tinted_glass")
    d.put(-3, -5, -L + 8, "lantern", hanging=False); d.put(-3, -5, -L + 9, "dark_oak_stairs", facing="w")   # where he sat with his lamp
    d.meta["mark"] = [0, 1, 0]
    return d


def crownhold_walls():
    """What is left of Crownhold's walls and streets round the Hall: broken curtain, two gate towers, house footings."""
    d = D("crownhold_walls", "drape", seed=202)
    R = 34
    pts = [(round(math.sin(a) * R * (1 + 0.08 * math.sin(3 * a))), round(-math.cos(a) * R * (1 + 0.08 * math.sin(3 * a))))
           for a in [k * 2 * math.pi / 28 for k in range(29)]]
    for k in range(28):
        if 13 <= k <= 15 or d.r(k, 0, 0) < 0.2: continue       # the south gate gap, and fallen stretches
        wall_line(d, pts[k], pts[k + 1], 6, 5, thick=2, salt=k)
    for gx in (-4, 4):   # gate towers either side of the south gap
        for x in range(gx - 2, gx + 3):
            for z in range(R - 3, R + 2):
                if max(abs(x - gx), abs(z - R + 1)) == 2:
                    top = ruin_height(d, x, z, 12, 6, 9)
                    for y in range(1, top + 1): d.put(x, y, z, d.pick(x, y, z, STONE_RUIN, 9))
    # the old street from the gate to the Hall, and footings of houses along it
    for z in range(18, R + 2):
        for x in range(-2, 3):
            if d.r(x, 0, z) < 0.8: d.put(x, 0, z, d.pick(x, 0, z, [("cobblestone", 3), ("mossy_cobblestone", 2), ("gravel", 1)], 4))
    for k, (hx, hz) in enumerate(((-12, 22), (10, 24), (-20, 8), (19, 6), (-18, -14), (17, -16), (-8, -28), (9, -27))):
        w, l = 3 + int(d.r(k, 5, 5) * 2), 2 + int(d.r(k, 6, 6) * 2)
        for x in range(hx - w, hx + w + 1):
            for z in range(hz - l, hz + l + 1):
                if x in (hx - w, hx + w) or z in (hz - l, hz + l):
                    top = ruin_height(d, x, z, 4, 4, k)
                    for y in range(1, max(top, 1) + 1): d.put(x, y, z, d.pick(x, y, z, STONE_RUIN, k))
                elif d.r(x, 1, z) < 0.15: d.put(x, 1, z, "mossy_cobblestone_slab", half="bottom")
    # an old oak grown up in a ruined courtyard
    oak(d, -22, -2, tall=7, crown=3.5, salt=4)
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
    d.hollow = 1
    d.meta["mark"] = [0, 1, 0]
    return d


def bellhollow_frame():
    """The great bell frame, broken and fallen across the valley, and the pilgrims' shrine by the road with their
    little bells left outside it."""
    d = D("bellhollow_frame", "drape", seed=212)
    # the frame: two great trestles, one standing, one fallen; the beam lying between
    for k in range(10): d.put(-6, 1 + k, 0, "stripped_dark_oak_log", axis="y"); d.put(-6, 1 + k, 1, "stripped_dark_oak_log", axis="y")
    for s in (-1, 1):
        for k in range(6): d.put(-6, 1 + k, s * (2 + k // 2) + (1 if s > 0 else 0), "dark_oak_fence")
    for k in range(13): d.put(-5 + k, 1, 6 + k // 4, "stripped_dark_oak_log", axis="x")    # the fallen beam
    for k in range(10): d.put(8 + k // 5, 1, 9 + k, "stripped_dark_oak_log", axis="z")     # the fallen trestle
    d.put(-6, 11, 0, "dark_oak_slab", half="bottom"); d.put(-6, 10, -1, "iron_chain", axis="y")
    # the shrine: a little stone house, open on the road side
    sx, sz = 18, -12
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
    d.meta["mark"] = [sx, 1, sz + 3]
    return d

# ---------------------------------------------------------------- the Ashen Gate


def ashen_chapterhouse():
    """The Chapterhouse of the Ashen Gate: the Order's last house, grey and cold. The archive is the ground floor,
    where Brother Cael keeps the books; a trapdoor behind the lectern leads down to the Burned Archive."""
    d = D("ashen_chapterhouse", "rigid", seed=221, fill="stone", top="keep", ease=4)
    d.parts = [{"part": "house", "style": {"base": "vale_stone", "infill": "VAL-01"}, "rect": [-10, -7, 10, 7], "y": 0,
                "storeys": [5, 5], "frame": "stone", "bay": 3, "door": {"side": "s", "kind": "grand"},
                "roof": {"type": "gable", "ridge": "x", "pitch": 1}, "materials": {"roof": "VAL-06"}, "chimney": [[-7, 0], [7, 0]],
                "shutters": 0}]
    # grey hangings either side of the door: the Order's banners, gone threadbare
    for x in (-4, 4):
        for y in range(4, 9): d.put(x, y, 8, "gray_wool" if y > 4 else "light_gray_wool")
        d.put(x, 9, 8, "dark_oak_slab", half="top")
    # the archive inside: shelves along the walls, a long reading table, the cold hearths at each end
    for x in range(-8, 9):
        for z in (-5, 5):
            if abs(x) > 1 or z == -5:
                for y in (2, 3): d.put(x, y, z, "bookshelf" if d.r(x, y, z) < 0.8 else "chiseled_bookshelf")
    for x in range(-4, 5): d.put(x, 2, 0, "dark_oak_slab", half="top")
    for x in (-5, 5): d.put(x, 2, 0, "lectern", bs={"minecraft:cardinal_direction": "south"})
    for x in (-8, 8):
        d.put(x, 2, 0, "campfire", bs={"extinguished": True}); d.put(x, 2, -1, "cobblestone_wall"); d.put(x, 2, 1, "cobblestone_wall")
    d.put(0, 1, -4, "dark_oak_trapdoor", facing="s", half="top")   # behind the lectern: the way down
    d.put(0, 2, -3, "lectern", bs={"minecraft:cardinal_direction": "south"})
    # the Burned Archive below: charred shelves, a locked cell
    for x in range(-6, 7):
        for z in range(-6, 1):
            for y in range(-5, 1):
                edge = x in (-6, 6) or z in (-6, 0) or y == -5
                if y == 0 and not edge: continue
                if edge or y == 0: d.put(x, y, z, d.pick(x, y, z, [("deepslate_bricks", 3), ("cracked_deepslate_bricks", 2), ("blackstone", 1)]))
                else: d.air(x, y, z)
    d.air(0, 0, -4)
    for y in range(-4, 0): d.put(0, y, -3, "ladder", bs={"facing_direction": 2})
    d.put(0, -1, -3, "air")
    for x in range(-5, 6):
        for z in (-5,):
            for y in (-4, -3, -2): d.put(x, y, z, d.pick(x, y, z, [("coal_block", 2), ("bookshelf", 1), ("blackstone", 1), ("air", 1)], 6))
    d.put(-4, -4, -2, "campfire", bs={"extinguished": True}); d.put(3, -4, -3, "soul_lantern", hanging=False)
    # the cell, locked from the outside
    d.put(5, -4, -1, "iron_bars"); d.put(5, -3, -1, "iron_bars"); d.put(4, -4, -1, "iron_bars"); d.put(4, -3, -1, "iron_bars")
    d.meta["npcs"] = [[2, 2, 2, "cael"]]
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
    for y in range(1, 15): d.put(0, y, -3, "ladder", bs={"facing_direction": 3})
    for x in range(-3, 4):   # the old floors, half rotted through
        for z in range(-3, 4):
            for y in (5, 10):
                if math.hypot(x, z) < 3.6 and d.r(x, y, z) < 0.45 and (x, z) != (0, -3): d.put(x, y, z, "spruce_slab", half="top")
    # the bell frame on top, against the sky
    for x in range(-2, 3):
        for z in (-1, 0, 1): d.put(x, 15, z, "spruce_planks" if d.r(x, 15, z) < 0.85 else "spruce_slab")
    bell_frame(d, 0, 16, 0, w=2, tall=4, wood="oak")
    rubble(d, 0, 0, 10, 26, salt=7)
    d.meta["mark"] = [0, 1, 6]
    return d

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


def cinder_roost():
    """The Cinder Roost: a rider school on the cliff above Sunscar. A gatehouse on the edge, the Span running out
    over the drop to the old perch tower, and the names of the fallen on the gate wall.
    Front (-z) is the drop."""
    d = D("cinder_roost", "rigid", seed=281, fill="red_sandstone", top="keep", ease=3, clearTo=14,
          fillRects=[[-9, 0, 9, 14]])   # the yard and gatehouse stand on built-up rock; the Span stays open
    RS = [("red_sandstone", 3), ("cut_red_sandstone", 2), ("smooth_red_sandstone", 2), ("chiseled_red_sandstone", 1)]
    # the yard on the cliff top
    for x in range(-9, 10):
        for z in range(0, 15):
            d.put(x, 0, z, d.pick(x, 0, z, [("smooth_red_sandstone", 3), ("red_sandstone", 2), ("red_sand", 1)]))
            if abs(x) == 9 or z == 14:
                for y in range(1, 5): d.put(x, y, z, d.pick(x, y, z, RS))
                if (x + z) % 2: d.put(x, 5, z, "red_sandstone_wall")
    # the gatehouse on the edge: two towers, an arch, the way out onto the Span
    for tx in (-4, 4):
        for x in range(tx - 2, tx + 3):
            for z in range(0, 5):
                if abs(x - tx) == 2 or z in (0, 4):
                    for y in range(1, 11): d.put(x, y, z, d.pick(x, y, z, RS, 2))
                    if (x + z) % 2 == 0: d.put(x, 11, z, "red_sandstone_wall")
    for x in range(-2, 3):
        for y in range(1, 9): d.put(x, y, 2, "cut_red_sandstone")
        for y in range(1, 6): d.air(x, y, 2)
    d.put(-1, 6, 2, "red_sandstone_stairs", facing="w", half="top"); d.put(1, 6, 2, "red_sandstone_stairs", facing="e", half="top")
    for x in range(-2, 3): d.put(x, 9, 2, "smooth_red_sandstone_slab", half="bottom")
    # the names of the fallen, on the inside of the gate wall
    names = ["ORREN of the\nRed Wing", "TASKA\nand Emberlash", "YSOLT\nthe First", "BRAN\nand Coalheart", "MERE\nwho flew blind", "KESHAN\nthe Elder"]
    for k, x in enumerate((-7, -6, -5, 5, 6, 7)):
        d.put(x, 2, 5, "dark_oak_wall_sign", facing="s")
        d.meta["signs"].append([x, 2, 5, names[k]])
    for x in (-8, 8): d.put(x, 1, 13, "lantern", hanging=False)
    # the Span: a thin arched bridge out over the drop
    for z in range(-1, -17, -1):
        for x in (-1, 0, 1):
            d.put(x, 0, z, "smooth_red_sandstone_slab" if x == 0 else "cut_red_sandstone", half="top")
        for x in (-1, 1): d.put(x, 1, z, "red_sandstone_wall")
        d.put(0, -1, z, "red_sandstone_stairs", facing="n" if z < -8 else "s", half="top")
    # the perch: a round tower at the far end, its top a landing for a dragon
    for x in range(-4, 5):
        for z in range(-25, -16):
            r = math.hypot(x, z + 21)
            if r <= 4.4:
                for y in range(-14, 1): d.put(x, y, z, d.pick(x, y, z, RS, 5) if r > 3.4 or y in (-14, 0) else "air")
                if r > 3.6: d.put(x, 1, z, "red_sandstone_wall")
    d.put(0, 1, -21, "campfire", bs={"extinguished": True})
    d.meta["npcs"] = [[0, 1, 8, "kesh"]]
    d.meta["mark"] = [0, 1, 4]
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
STORY_TURNING = {"deepforge", "cinder_roost"}
