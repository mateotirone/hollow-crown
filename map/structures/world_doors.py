"""The three sealed ways out (plots/config.js EXPANSION) and the Warlord King's own ground, as landmark designs
(landmarks.py format: y = 0 the ground layer, front -z). landmarks_story.py adds them to STORY_DESIGNS, so they
export, place and preview with the story places.

  shut_pass_gate     the old kingdom's gate across the Shut Pass, its far side buried in rockfall and snow
  westwatch          the Far Shore's harbour mouth on the west coast: a barred sea gate, an unlit lighthouse
  southmost_light    the Horizon Isles' watch on the south shore: a tower with a great spyglass trained south
  vorlunds_muster    the Grey Host's war camp on the Frostmarch plateau, where the Warlord King is met

The Far Shore and Horizon Isles doors on the map are out at sea (300+ blocks offshore), so their landmarks stand on
the nearest coast, facing the way, found with a "water" seek (the piece's front looks out over the water).
"""
import math
from landmarks import D, CARD

DEEP = [("deepslate_bricks", 5), ("cobbled_deepslate", 3), ("cracked_deepslate_bricks", 2), ("polished_deepslate", 1)]
ROCK = [("cobbled_deepslate", 4), ("stone", 3), ("andesite", 2), ("gravel", 2), ("tuff", 1), ("cobblestone", 1)]
SALT = [("stone_bricks", 4), ("smooth_sandstone", 3), ("cracked_stone_bricks", 1), ("cut_sandstone", 1)]
OLDK = [("stone_bricks", 5), ("cracked_stone_bricks", 2), ("mossy_stone_bricks", 2), ("andesite", 1)]


def disc(r):
    n = int(r) + 1
    return [(x, z) for x in range(-n, n + 1) for z in range(-n, n + 1) if math.hypot(x, z) <= r]


def round_tower(d, cx, cz, r, y0, y1, mix, salt=0, slits=()):
    for y in range(y0, y1 + 1):
        for (x, z) in disc(r):
            if math.hypot(x, z) > r - 1.05:
                X, Z = cx + x, cz + z
                if y in slits and (x == 0 or z == 0) and abs(x) + abs(z) >= int(r): d.put(X, y, Z, "air"); continue
                d.put(X, y, Z, d.pick(X, y, Z, mix, salt))


def cone(d, cx, cz, r, y0, h, mix, salt=0, tip="lightning_rod"):
    """A conical roof of stairs facing out, solid under, with a finial."""
    for k in range(h):
        rr = r * (1 - k / h)
        for (x, z) in disc(rr + 0.5):
            dd = math.hypot(x, z)
            if dd > rr - 0.6 and dd <= rr + 0.5:
                f = ("w" if x < 0 else "e") if abs(x) >= abs(z) else ("n" if z < 0 else "s")
                f = {"w": "e", "e": "w", "n": "s", "s": "n"}[f]   # stairs rise toward the centre
                d.put(cx + x, y0 + k, cz + z, d.pick(cx + x, y0 + k, cz + z, mix, salt), facing=f, half="bottom")
            elif dd <= rr - 0.6:
                d.put(cx + x, y0 + k, cz + z, "dark_oak_planks")
    d.put(cx, y0 + h, cz, tip, **({"bs": {"facing_direction": 1}} if tip == "lightning_rod" else {}))


def crenels(d, x0, x1, z, y, mix, salt=0):
    for x in range(x0, x1 + 1):
        if (x - x0) % 2 == 0: d.put(x, y, z, d.pick(x, y, z, mix, salt))


# ---------------------------------------------------------------- the Shut Pass


def shut_pass_gate():
    """The Shut Pass gate: the old kingdom's wall across the pass at the east end of the Greyspine, two round
    towers with steep roofs, the gate shut behind a lowered portcullis, and on its far side the rockfall and
    snow that buried the way, spilling through the bars."""
    d = D("shut_pass_gate", "rigid", seed=601, fill="cobbled_deepslate", top="keep", ease=5, clearTo=34)
    W = 20
    # the curtain wall, three thick, buttressed, a wall walk and crenels on both faces
    for x in range(-W, W + 1):
        for z in (0, 1, 2):
            for y in range(1, 14): d.put(x, y, z, d.pick(x, y, z, DEEP, 1))
        for z in (-1, 3): d.put(x, 14, z, d.pick(x, 14, z, DEEP, 2))
        if x % 2 == 0: d.put(x, 15, -1, d.pick(x, 15, -1, DEEP, 3)); d.put(x, 15, 3, d.pick(x, 15, 3, DEEP, 3))
        for z in (0, 1, 2): d.put(x, 14, z, "polished_deepslate")
        d.put(x, 1, -1, "deepslate_brick_stairs", facing="s", half="bottom")   # a plinth course
        if x % 6 == 0 and abs(x) not in (0, 6) and abs(x) < W:   # buttresses stepping out
            for y in range(1, 11): d.put(x, y, -1, "polished_deepslate")
            for y in range(1, 7): d.put(x, y, -2, "deepslate_bricks")
            d.put(x, 7, -2, "deepslate_brick_stairs", facing="s", half="bottom"); d.put(x, 11, -1, "deepslate_brick_stairs", facing="s", half="bottom")
        if x % 4 == 2 and abs(x) > 7: d.put(x, 9, 0, "air"); d.put(x, 10, 0, "air")   # arrow slits
    # the gatehouse: thicker, taller, machicolations on corbels over the arch
    for x in range(-7, 8):
        for z in range(-2, 4):
            for y in range(1, 18): d.put(x, y, z, d.pick(x, y, z, DEEP, 4))
        d.put(x, 13, -3, "deepslate_brick_stairs", facing="s", half="top")
        for y in (14, 15): d.put(x, y, -3, d.pick(x, y, -3, DEEP, 5))
        if x % 2 == 0: d.put(x, 16, -3, "deepslate_brick_wall")
        d.put(x, 18, -2, "polished_deepslate"); d.put(x, 18, 3, "polished_deepslate")
        if x % 2: d.put(x, 19, -2, "deepslate_brick_wall"); d.put(x, 19, 3, "deepslate_brick_wall")
    for x in range(-6, 7):   # a slab roof on the gatehouse
        for z in range(-1, 3): d.put(x, 18, z, "deepslate_tile_slab", half="bottom")
    # the arch: 7 wide, 9 high to the crown, through the gatehouse
    for x in range(-3, 4):
        top = 7 + (2 if abs(x) <= 1 else 1 if abs(x) == 2 else 0)
        for z in range(-2, 4):
            for y in range(1, top + 1): d.put(x, y, z, "air")
    for x in range(-4, 5):   # voussoirs and a keystone
        y = 8 + (2 if abs(x) <= 1 else 1 if abs(x) <= 2 else 0) + (1 if abs(x) == 4 else 0)
        d.put(x, y, -2, "polished_deepslate" if x else "chiseled_deepslate")
    d.put(0, 11, -2, "chiseled_deepslate"); d.put(0, 12, -2, "chiseled_deepslate")   # the crowned date stone
    d.put(-1, 12, -2, "deepslate_brick_stairs", facing="e", half="top"); d.put(1, 12, -2, "deepslate_brick_stairs", facing="w", half="top")
    for x in range(-3, 4):   # the portcullis, all the way down, and the doors behind it
        top = 7 + (2 if abs(x) <= 1 else 1 if abs(x) == 2 else 0)
        for y in range(1, top + 1): d.put(x, y, -1, "iron_bars")
        for y in range(1, top + 1): d.put(x, y, 2, "dark_oak_planks" if y % 3 else "stripped_dark_oak_log", axis="x")
    for s in (-1, 1):   # braziers, cold, and hanging lanterns either side of the arch
        d.put(5 * s, 1, -4, "cobbled_deepslate_wall"); d.put(5 * s, 2, -4, "campfire", out=True, bs={"extinguished": True})
        d.put(4 * s, 6, -3, "deepslate_brick_wall"); d.put(4 * s, 5, -3, "lantern", hanging=True)
    # the two towers, steep shingle cones
    for s in (-1, 1):
        cx = s * (W + 4)
        round_tower(d, cx, 1, 5.5, 1, 22, DEEP, 6, slits=(8, 14, 19))
        for (x, z) in disc(4.5): d.put(cx + x, 15, 1 + z, "spruce_planks")
        for (x, z) in disc(6.5):
            if math.hypot(x, z) > 5.4: d.put(cx + x, 22, 1 + z, "deepslate_brick_slab", half="top")
        cone(d, cx, 1, 6.6, 23, 11, [("dark_oak_stairs", 3), ("spruce_stairs", 2)], 7, tip="lightning_rod")
        for (x, z) in disc(5.5):   # a door in from the wall walk
            pass
    # wing walls stepping down into the mountainside beyond the towers
    for s in (-1, 1):
        for k in range(1, 9):
            x = s * (W + 9 + k)
            top = max(2, 12 - k)
            for z in (0, 1, 2):
                for y in range(1, top + 1): d.put(x, y, z, d.pick(x, y, z, ROCK if k > 4 else DEEP, 8))
    # the rockfall: a great heap against the far side, up over the wall walk, snow on it, boulders through the bars
    for x in range(-W - 9, W + 10):
        for z in range(3, 26):
            hh = 17 - (z - 3) * 0.75 - (abs(x) / (W + 9)) ** 2 * 9 + (d.r(x // 3, 1, z // 3) - 0.5) * 4
            hh = int(hh)
            for y in range(1, hh + 1):
                if d.get(x, y, z) in (None, "air"): d.put(x, y, z, d.pick(x, y, z, ROCK, 9))
            if hh >= 1:
                d.put(x, hh + 1, z, "snow" if d.r(x, 2, z) < 0.55 else "powder_snow" if d.r(x, 3, z) < 0.1 else "snow_layer")
    for x in range(-3, 4):   # the fall came through the doors and bars: rubble in the gate passage
        for z in range(-1, 4):
            hh = 2 + (z + 1) // 2 + (1 if d.r(x, 4, z) < 0.4 else 0)
            for y in range(1, hh + 1):
                if d.get(x, y, z) in ("air", None) or z >= 0: d.put(x, y, z, d.pick(x, y, z, ROCK, 10))
    for (x, z) in ((-2, -3), (1, -4), (3, -3), (0, -5), (-4, -5), (2, -6)):
        d.put(x, 1, z, d.pick(x, 1, z, [("gravel", 2), ("cobbled_deepslate", 1), ("stone", 1)], 11))
        if d.r(x, 5, z) < 0.5: d.put(x, 2, z, "cobbled_deepslate_slab", half="bottom")
    # snow on the wall walks and crenels, the old road up to the gate
    for x in range(-W - 9, W + 10):
        for z in (-1, 0, 1, 2, 3):
            for y in range(25, 0, -1):
                b = d.get(x, y, z)
                if b and b != "air" and "snow" not in b:
                    if d.get(x, y + 1, z) is None and d.r(x, y, z) < 0.6: d.put(x, y + 1, z, "snow_layer")
                    break
    for z in range(-16, -2):
        for x in range(-3, 4):
            if d.get(x, 0, z) is None: d.put(x, 0, z, d.pick(x, 0, z, [("gravel", 3), ("cobbled_deepslate", 2), ("snow", 1)], 12))
    for (x, z) in ((-5, -12), (5, -9)):   # two waymarks: posts with an old crown sign, a warning in its place
        for y in (1, 2, 3): d.put(x, y, z, "dark_oak_log", axis="y")
        d.put(x, 4, z, "dark_oak_fence"); d.put(x, 3, z - 1, "dark_oak_wall_sign", facing="n")
    d.meta["signs"] += [[-5, 3, -13, "THE SHUT PASS\nClosed by order\nof the Crown"], [5, 3, -10, "No way east\nwhile the snow\nholds"]]
    return d


# ---------------------------------------------------------------- the Far Shore


def westwatch():
    """The Westwatch: the old harbour mouth on the west coast that looks toward the Far Shore. A stone quay with
    steps into the sea, a great sea arch barred by a lowered portcullis and a chain, an unlit lighthouse with a
    copper lantern room, bollards, an upturned boat, and a sign that no ship crosses yet."""
    d = D("westwatch", "rigid", seed=611, fill="stone", top="keep", ease=4, clearTo=40, ground="max")
    for x in range(-13, 14):   # the quay platform, its front edge on the water
        for z in range(-6, 8):
            d.put(x, 1, z, d.pick(x, 1, z, [("stone_bricks", 4), ("smooth_sandstone", 3), ("cobblestone", 1)], 1))
            d.put(x, 0, z, "stone")
    for x in range(-13, 14):
        d.put(x, 1, -7, "stone_brick_stairs", facing="s", half="top")   # a cope over the water
        for y in range(-6, 1): d.put(x, y, -7, d.pick(x, y, -7, [("mossy_stone_bricks", 3), ("stone_bricks", 2), ("cracked_stone_bricks", 1)], 2))
    for k, x in enumerate(range(10, 14)):   # steps down to the water at the south end
        for z in range(-6, -2): d.put(x, 1 - k, z, "smooth_sandstone_stairs", facing="w", half="bottom") if False else None
    for x in (-11, -5, 5, 11):   # bollards
        d.put(x, 2, -6, "polished_andesite"); d.put(x, 3, -6, "andesite_wall")
    # the sea arch: two piers on the quay's front, 9 wide, 13 high, a portcullis down to the water and a chain
    for s in (-1, 1):
        for x in range(s * 5, s * 8, s):
            for z in (-7, -6, -5):
                for y in range(-6, 15): d.put(x, y, z, d.pick(x, y, z, SALT, 3))
        d.put(s * 6, 15, -6, "lantern"); d.put(s * 7, 15, -6, "stone_brick_wall"); d.put(s * 5, 15, -6, "stone_brick_wall")
    for x in range(-4, 5):
        crown = 13 - int(abs(x) ** 2 / 6)
        for z in (-7, -6, -5):
            for y in range(crown, 15): d.put(x, y, z, d.pick(x, y, z, SALT, 4))
        d.put(x, 15, -6, "smooth_sandstone_slab", half="bottom")
        for y in range(-6, crown): d.put(x, y, -6, "iron_bars")
        for y in range(-6, crown): d.put(x, y, -5, "air") if y >= 2 else None
    d.put(0, 13, -8, "chiseled_quartz_block"); d.put(0, 14, -8, "smooth_quartz_slab", half="bottom")
    for x in range(-4, 5): d.put(x, 2, -8, "iron_chain", axis="x")   # the chain boom across the mouth
    for y in range(2, 5): d.put(-8, y, -4, "iron_chain", axis="y")
    # the lighthouse on the north end of the quay
    cx, cz = -8, 4
    round_tower(d, cx, cz, 4.5, 2, 28, [("calcite", 6), ("smooth_sandstone", 1)], 5, slits=(9, 16, 23))
    for y in range(2, 29):
        if y % 7 == 0:
            for (x, z) in disc(4.5):
                if math.hypot(x, z) > 3.5: d.put(cx + x, y, cz + z, "cut_sandstone")
    d.put(cx, 2, cz - 4, "air"); d.put(cx, 3, cz - 4, "air")
    d.put(cx, 2, cz - 4, "birch_door", facing="n"); d.put(cx, 3, cz - 4, "birch_door", facing="n", upper=True)
    for (x, z) in disc(6.5):   # the gallery on corbels, a rail, the lantern room
        dd = math.hypot(x, z)
        if dd <= 6.5: d.put(cx + x, 29, cz + z, "smooth_sandstone_slab", half="top" if dd > 4.4 else "bottom") if dd > 4.4 else d.put(cx + x, 29, cz + z, "smooth_sandstone")
        if 5.6 < dd <= 6.5: d.put(cx + x, 30, cz + z, "birch_fence")
        if 4.4 < dd <= 5.6: d.put(cx + x, 28, cz + z, "smooth_sandstone_stairs", facing="n" if z < 0 else "s", half="top") if abs(z) >= abs(x) else d.put(cx + x, 28, cz + z, "smooth_sandstone_stairs", facing="w" if x < 0 else "e", half="top")
    for y in range(30, 34):
        for (x, z) in disc(3.5):
            dd = math.hypot(x, z)
            if dd > 2.5: d.put(cx + x, y, cz + z, "waxed_oxidized_copper" if (abs(x) == 3 and z == 0) or (abs(z) == 3 and x == 0) or y == 33 else "glass")
    d.put(cx, 30, cz, "campfire", out=True, bs={"extinguished": True})   # the light that has never been lit
    for k, rr in enumerate((3.5, 2.6, 1.6, 0.6)):
        for (x, z) in disc(rr):
            if math.hypot(x, z) > rr - 1.1: d.put(cx + x, 34 + k, cz + z, "waxed_oxidized_cut_copper")
    d.put(cx, 38, cz, "lightning_rod", bs={"facing_direction": 1})
    # the harbour master's store, shut up: a small hip-roofed house on the south end
    for x in range(5, 12):
        for z in range(1, 7):
            edge = x in (5, 11) or z in (1, 6)
            for y in range(2, 6):
                if edge: d.put(x, y, z, "calcite" if y > 2 else "stone_bricks")
            for y in (5,):
                if edge and (x in (5, 11) and z in (1, 6)): d.put(x, y, z, "stripped_birch_log", axis="y")
    for k in range(4):
        for x in range(4 + k, 13 - k):
            for z in range(0 + k, 8 - k):
                if x in (4 + k, 12 - k) or z in (k, 7 - k):
                    f = "e" if x == 4 + k else "w" if x == 12 - k else "s" if z == k else "n"
                    d.put(x, 6 + k, z, "dark_prismarine_stairs" if d.r(x, k, z) < 0.75 else "prismarine_brick_stairs", facing=f, half="bottom")
    d.put(8, 9, 3, "dark_prismarine_slab", half="bottom")
    d.put(8, 2, 1, "birch_planks"); d.put(8, 3, 1, "birch_planks")   # its door boarded up
    for x in (7, 9): d.put(x, 3, 0, "warped_trapdoor", facing="n", open=True)
    # an upturned boat on trestles, crates and nets
    for x in range(-3, 4):
        w = 2 if abs(x) < 3 else 1
        for z in range(3 - w, 4 + w):
            d.put(x, 3, z, "spruce_slab", half="top" if abs(z - 3) < w else "bottom")
        d.put(x, 2, 3, "spruce_planks")
    for x in (-3, 3): d.put(x, 2, 1, "spruce_fence"); d.put(x, 2, 5, "spruce_fence")
    for (x, z) in ((12, -4), (12, -3), (11, -4)): d.put(x, 2, z, "barrel", bs={"facing_direction": 1})
    d.put(-12, 2, 6, "cobweb"); d.put(-12, 2, 5, "dried_kelp_block")
    d.put(2, 2, -5, "spruce_standing_sign", bs={"ground_sign_direction": 8})
    d.meta["signs"] += [[2, 2, -5, "THE WESTWATCH\nNo ship crosses\nto the Far Shore\n...yet"]]
    return d


# ---------------------------------------------------------------- the Horizon Isles


def southmost_light():
    """The Southmost Light: the old watch on the south shore from which the Horizon Isles are seen on clear days.
    A square tower on a stone mound, a roof terrace with a great copper spyglass trained south, a stair round the
    mound, a boathouse with its doors barred, and a ring of stones marking where the isles rise at midsummer."""
    d = D("southmost_light", "rigid", seed=621, fill="stone", top="keep", ease=5, clearTo=40, ground="max")
    for (x, z) in disc(11.5):   # the mound: stone, mossy at the foot, a ring path
        dd = math.hypot(x, z)
        for y in range(1, 1 + max(0, int(4 - max(0, dd - 7) * 0.9))):
            d.put(x, y, z, d.pick(x, y, z, [("stone", 3), ("cobblestone", 2), ("mossy_cobblestone", 2), ("andesite", 1)], 1))
    for (x, z) in disc(7.5):
        if math.hypot(x, z) > 6.4: d.put(x, 5, z, "stone_brick_wall")
    for k in range(4):   # the stair up the mound's north side
        for x in (-1, 0, 1): d.put(x, 1 + k, -11 + k, "stone_brick_stairs", facing="s", half="bottom")
    for x in range(-4, 5):   # the tower, 9 square, 27 high, string courses, quoins
        for z in range(-4, 5):
            edge = abs(x) == 4 or abs(z) == 4
            for y in range(5, 32):
                if not edge: continue
                q = abs(x) == 4 and abs(z) == 4
                d.put(x, y, z, "polished_andesite" if q else "stone_brick_slab" if False else d.pick(x, y, z, OLDK, 2))
            if edge:
                for y in (12, 20, 28): d.put(x, y, z, "polished_andesite")
    for y in (8, 15, 23):   # windows, one a face per storey, a sill and a head
        for (x, z, f) in ((0, -4, "n"), (0, 4, "s"), (-4, 0, "w"), (4, 0, "e")):
            d.put(x, y, z, "gray_stained_glass_pane"); d.put(x, y + 1, z, "gray_stained_glass_pane")
            dx, dz = CARD[f]
            d.put(x + dx, y - 1, z + dz, "stone_brick_stairs", facing={"n": "s", "s": "n", "e": "w", "w": "e"}[f], half="top")
    d.put(0, 5, -4, "air"); d.put(0, 6, -4, "air"); d.put(0, 5, -4, "spruce_door", facing="n"); d.put(0, 6, -4, "spruce_door", facing="n", upper=True)
    for x in range(-5, 6):   # the roof terrace on corbels, crenels, the spyglass
        for z in range(-5, 6):
            if max(abs(x), abs(z)) == 5:
                d.put(x, 31, z, "stone_brick_stairs", facing="n" if z == -5 else "s" if z == 5 else "w" if x == -5 else "e", half="top")
                d.put(x, 32, z, "polished_andesite")
                if (x + z) % 2 == 0: d.put(x, 33, z, "stone_brick_wall")
            elif max(abs(x), abs(z)) < 5: d.put(x, 32, z, "spruce_planks")
    d.put(0, 33, -1, "spruce_log", axis="y"); d.put(0, 34, -1, "spruce_fence")   # the spyglass stand
    for k in range(7):   # the barrel, angled up a little toward the south
        z = k - 2; y = 35 + k // 3
        d.put(0, y, z, "waxed_cut_copper" if k not in (0, 6) else "waxed_copper_block")
    d.put(0, 37, 5, "glass"); d.put(0, 35, -3, "tinted_glass")
    d.put(-3, 33, -3, "lantern"); d.put(3, 33, 3, "lantern")
    # the boathouse at the water's edge, front (-z) on the water, doors barred
    for x in range(8, 17):
        for z in range(-9, -2):
            edge = x in (8, 16) or z == -3
            for y in range(1, 6):
                if edge: d.put(x, y, z, d.pick(x, y, z, OLDK, 5) if y < 3 else "spruce_planks")
            d.put(x, 0, z, "water" if 9 <= x <= 15 and z <= -4 else "stone")
    for x in range(9, 16):
        for y in range(1, 5): d.put(x, y, -9, "spruce_planks" if (x + y) % 3 else "stripped_spruce_log", axis="y")
        d.put(x, 3, -10, "iron_bars")
    for k in range(5):
        for x in range(7, 18):
            for z, f in ((-10 + k, "s"), (-2 - k, "n")):
                if z <= -6 + (k == 4): pass
            d.put(x, 6 + k, -10 + k, "spruce_stairs", facing="s", half="bottom"); d.put(x, 6 + k, -2 - k, "spruce_stairs", facing="n", half="bottom")
        if k == 4:
            for x in range(7, 18): d.put(x, 10, -6, "spruce_slab", half="bottom")
    for z in range(-9, -2):
        for k in range(5):
            if -10 + k < z < -2 - k: d.put(8, 6 + k, z, "spruce_planks"); d.put(16, 6 + k, z, "spruce_planks")
    # the Horizon Stones: seven standing stones in an arc on the south side, tallest on the sight line
    for k in range(7):
        a = math.radians(140 + k * 13.3)
        x, z = round(math.sin(a) * 15), round(-math.cos(a) * 15)
        tall = 5 - abs(k - 3) + (2 if k == 3 else 0)
        for y in range(1, tall + 1): d.put(x, y, z, "tuff" if y < tall else "polished_tuff")
    d.put(2, 1, -12, "spruce_standing_sign", bs={"ground_sign_direction": 8})
    d.meta["signs"] += [[2, 1, -12, "THE SOUTHMOST LIGHT\nOn clear days\nlook south"]]
    return d


# ---------------------------------------------------------------- the Warlord King's ground


def vorlunds_muster():
    """Vorlund's Muster: the Grey Host's war camp on the Frostmarch plateau, where the Warlord King is met on his
    own ground. A palisade of sharpened logs round a beaten fighting ground 81 across, two gate towers with signal
    fires, the great hall of an upturned longship at the north end with its dragon prow raised, his high seat on a
    timber dais before it, tents and weapon racks round the ring, war drums, and grey banners on tall poles."""
    d = D("vorlunds_muster", "rigid", seed=631, fill="cobbled_deepslate", top="keep", ease=6, clearTo=36)
    R = 42
    hz = 28   # the hall's centre line, at the north end of the ring
    # the fighting ground: trodden snow and gravel and mud, a ring of stones round the centre
    for (x, z) in disc(R - 1):
        dd = math.hypot(x, z)
        d.put(x, 0, z, d.pick(x, 0, z, [("packed_mud", 2), ("gravel", 3), ("coarse_dirt", 3), ("snow", 2), ("cobbled_deepslate", 1)], 1))
        if 13.5 < dd <= 14.5 and d.r(x, 1, z) < 0.5: d.put(x, 1, z, "cobbled_deepslate_slab", half="bottom")
    for (x, z) in disc(2.5): d.put(x, 0, z, "polished_deepslate")
    d.put(0, 0, 0, "chiseled_deepslate")
    # the palisade: spruce logs, every other one taller, sharpened with a fence tip; a walk inside on brackets
    for k in range(int(2 * math.pi * R)):
        a = k / R
        x, z = round(math.sin(a) * R), round(-math.cos(a) * R)
        if abs(x) <= 3 and abs(z) > R - 3: continue   # the two gates, north and south
        tall = 9 + (k % 2) + (1 if d.r(x, 2, z) < 0.3 else 0)
        for y in range(1, tall + 1): d.put(x, y, z, "spruce_log" if d.r(x, y, z) < 0.85 else "stripped_spruce_log", axis="y")
        d.put(x, tall + 1, z, "spruce_fence")
        ix, iz = round(math.sin(a) * (R - 1)), round(-math.cos(a) * (R - 1))
        if iz < -hz + 10 and abs(ix) < 26: continue   # the hall's back wall is the palisade there
        if d.get(ix, 7, iz) is None: d.put(ix, 7, iz, "spruce_slab", half="top")
        if k % 6 == 0:
            for y in range(1, 7): d.put(ix, y, iz, "stripped_dark_oak_log", axis="y")
    # gate towers: four timber towers (two a gate), signal fires on top, a lintel beam with antlers... and skulls of
    # nothing: grey shields instead
    for gz, out in ((-R, "n"), (R, "s")):
        for s in (-1, 1):
            cx = s * 5
            for x in range(cx - 2, cx + 3):
                for z in range(gz - 2, gz + 3):
                    corner = abs(x - cx) == 2 and abs(z - gz) == 2
                    for y in range(1, 17):
                        if corner: d.put(x, y, z, "dark_oak_log", axis="y")
                        elif (abs(x - cx) == 2 or abs(z - gz) == 2) and y < 13: d.put(x, y, z, "spruce_planks" if y % 4 else "stripped_spruce_log", axis="y")
                    d.put(x, 13, z, "spruce_slab", half="top")
                    if abs(x - cx) == 2 or abs(z - gz) == 2: d.put(x, 14, z, "spruce_fence")
            d.put(cx, 14, gz, "cobbled_deepslate"); d.put(cx, 15, gz, "campfire")
            for (x, z) in ((cx - 2, gz - 2), (cx + 2, gz - 2), (cx - 2, gz + 2), (cx + 2, gz + 2)):
                d.put(x, 17, z, "spruce_fence")
            for x in range(cx - 2, cx + 3):
                for z in range(gz - 2, gz + 3):
                    if max(abs(x - cx), abs(z - gz)) <= 2: d.put(x, 18, z, "dark_oak_slab", half="bottom")
            d.put(cx, 18, gz, "air"); d.put(cx, 19, gz, "air")
        for x in range(-7, 8): d.put(x, 12, gz, "dark_oak_log", axis="x")
        for x in (-2, 0, 2): d.put(x, 11, gz + (1 if gz < 0 else -1), "gray_wool")   # hung shields
        for x in (-3, 3): d.put(x, 10, gz, "iron_chain", axis="y"); d.put(x, 9, gz, "lantern", hanging=True)
    # the hall: an upturned longship, keel up, 51 long east-west, its prow raised as a dragon at the east end
    hz = 28   # its centre line (north end of the ring is -z: the hall stands at the north, z = -hz)
    for x in range(-25, 26):
        t = abs(x) / 25
        half = 10.5 * math.sqrt(max(0, 1 - t ** 2.4))   # beam at each x
        keel = 21 + int(4 * (1 - math.sqrt(max(0, 1 - t ** 2))))
        if half < 1: continue
        for z in range(-int(half) - 1, int(half) + 2):
            dz = abs(z) / max(half, 1)
            if dz > 1.05: continue
            ytop = int(keel - (dz ** 1.6) * (keel - 2))   # the hull curving down to the gunwale
            for y in (ytop, ytop - 1):
                if y >= 2:
                    d.put(x, y, -hz + z, "dark_oak_planks" if (y + x) % 5 else "stripped_dark_oak_log", axis="x")
            if dz > 0.85:   # the gunwale on the ground, walls of stone and timber under it
                for y in range(1, max(2, ytop - 1)): d.put(x, y, -hz + z, d.pick(x, y, -hz + z, [("cobbled_deepslate", 3), ("spruce_planks", 2), ("stripped_spruce_log", 1)], 3))
        d.put(x, keel + 1, -hz, "stripped_dark_oak_log", axis="x")   # the keel
        if x % 4 == 0 and abs(x) < 22:   # shields along the gunwale, the Host's colours
            for s in (-1, 1): d.put(x, 3, -hz + s * (int(half) + 2), "gray_wool" if (x // 4) % 2 else "black_wool")
    for y in range(22, 37):   # the dragon prow, rising and curling at the east end
        k = y - 22
        x = 25 + int(k * 0.35); z = -hz + (0 if k < 9 else -int((k - 8) * 0.7))
        d.put(x, y, z, "stripped_dark_oak_log", axis="y"); d.put(x - 1, y - 1, z, "dark_oak_planks")
        d.put(29, 36, -hz - 4, "crying_obsidian")   # the eye: a splinter of the Crown
    for y in range(21, 31): d.put(-25 - int((y - 21) * 0.25), y, -hz, "stripped_dark_oak_log", axis="y")   # the stern post
    # the ship's mast, stood up again through the upturned keel, its yard and a ragged grey sail: seen for miles
    for y in range(1, 47): d.put(0, y, -hz, "stripped_dark_oak_log", axis="y")
    for x in range(-13, 14): d.put(x, 42, -hz, "dark_oak_log", axis="x")
    for x in range(-12, 13):
        bottom = 28 + int(3 * d.r(x, 9, 0)) + (2 if abs(x) > 9 else 0)
        for y in range(bottom, 42): d.put(x, y, -hz - 1, "gray_wool" if not (-2 <= x <= 2 and 33 <= y <= 38) else "black_wool")
    for s_ in (-1, 1):   # stays from the masthead to the stem and stern
        for k in range(1, 20): d.put(s_ * k, 46 - k, -hz, "iron_chain", axis="y") if k % 2 else None
    d.put(0, 47, -hz, "campfire")
    for x in (-2, -1, 0, 1, 2):   # the hall door, facing the ring (south), under a porch
        for y in range(1, 6): d.put(x, y, -hz + 11, "air"); d.put(x, y, -hz + 10, "air")
    for x in (-3, 3):
        for y in range(1, 7): d.put(x, y, -hz + 12, "dark_oak_log", axis="y")
    for x in range(-4, 5): d.put(x, 7, -hz + 12, "dark_oak_stairs", facing="s", half="bottom"); d.put(x, 6, -hz + 12, "dark_oak_log", axis="x")
    # the high seat on a dais before the hall, facing the ring
    for x in range(-6, 7):
        for z in range(-hz + 13, -hz + 18):
            d.put(x, 1, z, "spruce_planks"); d.put(x, 2, z, "spruce_slab" if z < -hz + 15 else "spruce_planks", half="bottom")
        d.put(x, 1, -hz + 18, "spruce_stairs", facing="s", half="bottom")
    d.put(0, 3, -hz + 14, "polished_deepslate_stairs", facing="s", half="bottom")
    for s in (-1, 1): d.put(s, 3, -hz + 14, "polished_deepslate_wall"); d.put(s, 4, -hz + 14, "deepslate_tile_slab", half="bottom")
    d.put(0, 4, -hz + 13, "polished_deepslate"); d.put(0, 5, -hz + 13, "polished_deepslate_wall")
    for s in (-1, 1): d.put(4 * s, 3, -hz + 15, "campfire"); d.put(4 * s, 2, -hz + 15, "cobbled_deepslate")
    # banners on tall poles round the ring, tents and racks between them, war drums by the dais
    for k in range(12):
        a = 2 * math.pi * k / 12 + 0.26
        x, z = round(math.sin(a) * (R - 6)), round(-math.cos(a) * (R - 6))
        if z < -hz + 10 and abs(x) < 27: continue
        for y in range(1, 13): d.put(x, y, z, "dark_oak_fence")
        for y in range(7, 12): d.put(x + 1, y, z, "gray_wool" if y % 2 else "light_gray_wool")
        d.put(x, 13, z, "lightning_rod", bs={"facing_direction": 1})
    for k in range(10):
        a = 2 * math.pi * k / 10 + 0.55
        cx, cz = round(math.sin(a) * (R - 10)), round(-math.cos(a) * (R - 10))
        if cz < -hz + 12 and abs(cx) < 28: continue
        tx, tz = (1, 0) if abs(math.sin(a)) > 0.7 else (0, 1)
        for j in range(-2, 3):   # a ridge tent of grey wool on poles, 5 long
            x, z = cx + tz * j, cz + tx * j
            d.put(x, 3, z, "gray_wool")
            for w in (-1, 1): d.put(x + tx * w, 2, z + tz * w, "gray_wool"); d.put(x + tx * 2 * w, 1, z + tz * 2 * w, "gray_wool_slab" if False else "light_gray_wool")
        d.put(cx + tz * 3, 1, cz + tx * 3, "spruce_fence"); d.put(cx + tz * 3, 2, cz + tx * 3, "spruce_fence")
    for k in range(8):   # weapon racks and stacked shields
        a = 2 * math.pi * k / 8 + 0.9
        x, z = round(math.sin(a) * 30), round(-math.cos(a) * 30)
        if z < -hz + 12 and abs(x) < 28: continue
        for j in (-1, 0, 1): d.put(x + j, 1, z, "spruce_fence"); d.put(x + j, 2, z, "spruce_trapdoor", facing="n", half="bottom")
        d.put(x - 2, 1, z, "barrel", bs={"facing_direction": 1}); d.put(x + 2, 1, z, "grindstone", bs={"attachment": "standing", "direction": 0})
    for s in (-1, 1):   # war drums: big barrels with hide tops
        for (dx, dz) in ((9, -hz + 16), (11, -hz + 17)):
            d.put(s * dx, 1, dz, "barrel", bs={"facing_direction": 1}); d.put(s * dx, 2, dz, "white_carpet")
    return d


DOOR_DESIGNS = {"shut_pass_gate": shut_pass_gate, "westwatch": westwatch, "southmost_light": southmost_light,
                "vorlunds_muster": vorlunds_muster}
