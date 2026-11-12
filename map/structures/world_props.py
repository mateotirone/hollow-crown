"""Small world builds for every region: signposts, wells, field fencing and windmills, plus construction-site
scaffolds. Same design format as landmarks.py (D: cells, y = 0 the ground layer, front -z), so they export, place
and preview the same way.

    python3 world_props.py OUT        -> OUT/<design>/scene.json + OUT/names.json (asset viewer "World props")

Styles follow build-instructions/palettes/<region>.md. Each kind is also a function other builders call:
    signpost(d, x, z, region)           a road signpost on a plinth, two pairs of arms with hanging signs
    well(region)                        a design
    fence_run(d, pts, region, gate=i)   the region's field boundary along a polyline, a gate at point i
    windmill(region)                    a design
    scaffold(d, box, h, stage, wood)    a building going up: 1 staked out, 2 footings and poles, 3 frame and decks
"""
import json, math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from landmarks import D, CARD, oak  # noqa: E402

REGIONS = ("vale", "frostmarch", "saltreach", "blackfen", "emberwaste", "hollow")
NAMES = {"vale": "Aldmere Vale", "frostmarch": "Frostmarch", "saltreach": "Saltreach", "blackfen": "Blackfen",
         "emberwaste": "Emberwaste", "hollow": "The Hollow"}

# The roles each region fills (palettes/<region>.md)
R = {
    "vale": dict(plinth=[("cobblestone", 5), ("mossy_cobblestone", 3), ("andesite", 1), ("stone_bricks", 1)],
                 stone=[("stone_bricks", 5), ("cobblestone", 2), ("cracked_stone_bricks", 1), ("andesite", 1), ("mossy_stone_bricks", 1)],
                 quoin="polished_andesite", stair="stone_brick_stairs", slab="stone_brick_slab", wall="stone_brick_wall",
                 log="stripped_spruce_log", dark="stripped_dark_oak_log", planks="spruce_planks", infill="calcite",
                 trim="dark_oak", fence="dark_oak_fence", gate="dark_oak_fence_gate", sign="spruce_hanging_sign",
                 roof=[("dark_oak_stairs", 3), ("spruce_stairs", 1)], roofslab="dark_oak_slab", light="lantern",
                 pad="grass_block", path="gravel"),
    "frostmarch": dict(plinth=[("cobbled_deepslate", 6), ("deepslate_bricks", 3), ("cobblestone", 1)],
                       stone=[("deepslate_bricks", 5), ("cobbled_deepslate", 3), ("cracked_deepslate_bricks", 1), ("polished_deepslate", 1)],
                       quoin="polished_deepslate", stair="deepslate_brick_stairs", slab="deepslate_brick_slab", wall="cobbled_deepslate_wall",
                       log="dark_oak_log", dark="dark_oak_log", planks="spruce_planks", infill="spruce_planks",
                       trim="spruce", fence="dark_oak_fence", gate="spruce_fence_gate", sign="spruce_hanging_sign",
                       roof=[("dark_oak_stairs", 3), ("spruce_stairs", 2)], roofslab="dark_oak_slab", light="lantern",
                       pad="snow", path="gravel"),
    "saltreach": dict(plinth=[("cobblestone", 4), ("andesite", 3), ("stone_bricks", 3)],
                      stone=[("smooth_sandstone", 5), ("stone_bricks", 2), ("cut_sandstone", 1)],
                      quoin="cut_sandstone", stair="smooth_sandstone_stairs", slab="smooth_sandstone_slab", wall="diorite_wall",
                      log="stripped_birch_log", dark="stripped_oak_log", planks="birch_planks", infill="calcite",
                      trim="birch", fence="birch_fence", gate="birch_fence_gate", sign="birch_hanging_sign",
                      roof=[("dark_prismarine_stairs", 3), ("prismarine_brick_stairs", 1)], roofslab="dark_prismarine_slab", light="lantern",
                      pad="grass_block", path="gravel"),
    "blackfen": dict(plinth=[("mud_bricks", 5), ("tuff", 2), ("packed_mud", 2)],
                     stone=[("mud_bricks", 6), ("packed_mud", 2), ("tuff_bricks", 1)],
                     quoin="tuff_bricks", stair="mud_brick_stairs", slab="mud_brick_slab", wall="mud_brick_wall",
                     log="mangrove_log", dark="stripped_mangrove_log", planks="mangrove_planks", infill="mud_bricks",
                     trim="mangrove", fence="mangrove_fence", gate="mangrove_fence_gate", sign="mangrove_hanging_sign",
                     roof=[("dark_oak_stairs", 4), ("mangrove_stairs", 1)], roofslab="dark_oak_slab", light="verdant_froglight",
                     pad="mud", path="packed_mud"),
    "emberwaste": dict(plinth=[("sandstone", 6), ("cut_sandstone", 2)],
                       stone=[("smooth_sandstone", 6), ("sandstone", 3), ("cut_sandstone", 1)],
                       quoin="cut_sandstone", stair="smooth_sandstone_stairs", slab="smooth_sandstone_slab", wall="sandstone_wall",
                       log="stripped_acacia_log", dark="spruce_log", planks="acacia_planks", infill="smooth_sandstone",
                       trim="acacia", fence="acacia_fence", gate="acacia_fence_gate", sign="acacia_hanging_sign",
                       roof=[("smooth_red_sandstone_stairs", 1)], roofslab="smooth_sandstone_slab", light="lantern",
                       pad="red_sand", path="smooth_sandstone"),
    "hollow": dict(plinth=[("cobbled_deepslate", 7), ("siege:veinstone", 3)],
                   stone=[("siege:veinstone_bricks", 7), ("siege:cracked_veinstone_bricks", 2), ("polished_blackstone_bricks", 1)],
                   quoin="polished_blackstone", stair="polished_blackstone_brick_stairs", slab="polished_blackstone_brick_slab",
                   wall="polished_blackstone_wall", log="dark_oak_log", dark="stripped_dark_oak_log", planks="dark_oak_planks",
                   infill="siege:pale_ash", trim="dark_oak", fence="dark_oak_fence", gate="dark_oak_fence_gate",
                   sign="dark_oak_hanging_sign", roof=[("deepslate_tile_stairs", 3), ("cobbled_deepslate_stairs", 1)],
                   roofslab="deepslate_tile_slab", light="soul_lantern", pad="siege:undertow_moss", path="coarse_dirt"),
}
SIGN_FACE = {"n": 2, "s": 3, "w": 4, "e": 5}


def st(r, k):
    """The region's trim wood's stairs / slab / trapdoor."""
    return f"{R[r]['trim']}_{k}"


def roofstair(d, r, x, y, z, facing, salt=0, half="bottom"):
    d.put(x, y, z, d.pick(x, y, z, R[r]["roof"], salt), facing=facing, half=half)


def hsign(d, x, y, z, r, face):
    d.put(x, y, z, R[r]["sign"], hanging=True, bs={"facing_direction": SIGN_FACE[face], "attached_bit": False})


# ---------------------------------------------------------------- signposts


def signpost(d, x, z, r, y=1):
    """The region's road signpost: a stepped plinth, a post, two pairs of arms at different heights (east-west
    over north-south, like a real fingerpost's boards), a hanging sign under every arm end, and a light."""
    P = R[r]
    pl = lambda a, b, c: d.pick(a, b, c, P["plinth"], 3)
    for i in (-1, 0, 1):
        for j in (-1, 0, 1): d.put(x + i, y, z + j, pl(x + i, y, z + j))
    for f, (dx, dz) in (("s", (0, -2)), ("n", (0, 2)), ("e", (-2, 0)), ("w", (2, 0))):
        d.put(x + dx, y, z + dz, P["stair"], facing=f, half="bottom")
    if r == "emberwaste":    # a sandstone obelisk instead of a wooden post
        d.put(x, y + 1, z, "chiseled_sandstone")
        for k in range(2, 6): d.put(x, y + k, z, "cut_sandstone" if k % 2 else "smooth_sandstone")
        d.put(x, y + 6, z, "chiseled_sandstone"); d.put(x, y + 7, z, "sandstone_wall")
    elif r == "saltreach":   # a whitewashed pillar
        d.put(x, y + 1, z, "cut_sandstone")
        for k in range(2, 6): d.put(x, y + k, z, "calcite")
        d.put(x, y + 6, z, "smooth_sandstone_slab", half="bottom")
    else:
        d.put(x, y + 1, z, P["quoin"])
        for k in range(2, 7): d.put(x, y + k, z, P["log"], axis="y")
    top = y + 6
    for s in (-1, 1):   # upper arms east-west, lower north-south
        d.put(x + s, top - 1, z, P["fence"]); d.put(x + 2 * s, top - 1, z, P["fence"])
        hsign(d, x + 2 * s, top - 2, z, r, "n")
        d.put(x, top - 2, z + s, P["fence"]); d.put(x, top - 2, z + 2 * s, P["fence"])
        hsign(d, x, top - 3, z + 2 * s, r, "e")
    if r == "emberwaste":
        d.put(x, top + 2, z, "lantern")
    elif r == "saltreach":
        d.put(x, top, z, "birch_fence"); d.put(x, top + 1, z, "lantern")
    elif r == "blackfen":   # a froglight in a cage of bars on a little bracket
        d.put(x, top, z, P["fence"]); d.put(x, top + 1, z, "iron_bars"); d.put(x, top + 2, z, "verdant_froglight")
        d.put(x, top + 3, z, "mangrove_trapdoor", facing="n", half="bottom")
    elif r == "frostmarch":   # a carved cap with a lantern under its eave
        d.put(x, top + 1, z, "spruce_slab", half="bottom")
        for f, (dx, dz) in CARD.items(): d.put(x + dx, top + 1, z + dz, "spruce_trapdoor", facing=f, open=False, half="top")
        d.put(x, top, z, "dark_oak_log", axis="y"); d.put(x + 1, top, z, "lantern", hanging=True)
        d.put(x + 1, top + 1, z, "spruce_slab", half="top")
    elif r == "hollow":
        d.put(x, top + 1, z, "soul_lantern")
    else:   # Vale: a little pitched cap and a lantern on a bracket
        d.put(x, top + 1, z, "dark_oak_slab", half="bottom")
        d.put(x, top, z - 1, "dark_oak_fence"); d.put(x, top - 1, z - 1, "lantern", hanging=True)
    # life round its foot
    if r == "frostmarch":
        for (a, b) in ((2, 1), (-2, -1), (1, 2), (-1, -2), (2, -2)): d.put(x + a, y, z + b, "snow_layer")
    if r == "vale":
        d.put(x + 2, y, z + 1, "fern"); d.put(x - 2, y, z - 1, "poppy")
    if r == "blackfen":
        d.put(x + 2, y, z + 1, "moss_carpet"); d.put(x - 2, y, z + 2, "moss_carpet")


def signpost_design(r):
    d = D(f"signpost_{r}", "rigid", seed=410 + REGIONS.index(r), fill="dirt", top="keep", ease=2)
    signpost(d, 0, 0, r)
    for x in range(-3, 4):   # the crossroads it stands at
        for z in range(-3, 4):
            if (abs(x) <= 0 or abs(z) <= 0) and max(abs(x), abs(z)) >= 2 and d.get(x, 1, z) is None: pass
    return d


# ---------------------------------------------------------------- wells


def shaft(d, cx, cz, rr, r, depth=5, round_=True):
    """The well's shaft: a ring of the region's stone going down, water at the bottom."""
    P = R[r]
    for x in range(cx - 3, cx + 4):
        for z in range(cz - 3, cz + 4):
            dd = math.hypot(x - cx, z - cz) if round_ else max(abs(x - cx), abs(z - cz))
            if dd <= rr - 1.0:   # inside: air, then water
                for y in range(-depth, 2): d.put(x, y, z, "water" if y <= -2 else "air")
            elif dd <= rr:
                for y in range(-depth, 2): d.put(x, y, z, d.pick(x, y, z, P["stone"], 5))


def well(r):
    """The region's well: a stone head over a deep shaft of water, a winch to draw it, a roof over in the wet
    and cold regions, a dome in the desert."""
    P = R[r]
    d = D(f"well_{r}", "rigid", seed=430 + REGIONS.index(r), fill="dirt", top="keep", ease=2)
    if r in ("vale", "hollow"):
        shaft(d, 0, 0, 2.5, r)
        for x in range(-3, 4):   # a cobbled apron
            for z in range(-3, 4):
                if 2.5 < math.hypot(x, z) <= 3.6: d.put(x, 0, z, d.pick(x, 0, z, P["plinth"], 1))
        for x in range(-2, 3):
            for z in range(-2, 3):
                if 1.6 < math.hypot(x, z) <= 2.5: d.put(x, 2, z, P["slab"], half="bottom")
        for s in (-1, 1):   # two posts, a windlass, a little gable roof
            for y in range(2, 6): d.put(3 * s, y, 0, P["log"] if r == "vale" else "dark_oak_log", axis="y")
            d.put(3 * s, 1, 0, P["quoin"])
        for x in range(-3, 4): d.put(x, 5, 0, P["dark"], axis="x")
        d.put(0, 4, 0, "iron_chain", axis="y"); d.put(0, 3, 0, "cauldron")
        d.put(4, 4, 0, "dark_oak_fence")   # the crank
        for x in range(-4, 5):
            for z, f in ((-1, "s"), (1, "n")):
                roofstair(d, r, x, 6, z, f, 2)
            d.put(x, 7, 0, P["roofslab"], half="bottom")
        for z, f in ((-1, "s"), (1, "n")):
            for x in (-4, 4): d.put(x, 5, z, st(r, "stairs"), facing=f, half="top")
        if r == "hollow":
            d.put(0, -2, 0, "siege:glimbulb")   # the water glows from below
            d.put(-3, 6, 0, "soul_lantern"); d.put(3, 6, 0, "soul_lantern")
            d.put(2, 1, 2, "siege:veilcap"); d.put(-2, 1, -3, "siege:veilcap")
        else:
            d.put(-2, 1, 3, "flower_pot"); d.put(2, 1, -3, "barrel", bs={"facing_direction": 1})
            d.put(3, 1, 2, "fern")
    elif r == "frostmarch":
        shaft(d, 0, 0, 2, r, round_=False)
        for x in range(-2, 3):
            for z in range(-2, 3):
                if max(abs(x), abs(z)) == 2: d.put(x, 2, z, "packed_ice" if (x + z) % 4 == 0 else P["quoin"])
        for (a, b) in ((-2, -2), (2, -2), (-2, 2), (2, 2)):
            for y in range(3, 7): d.put(a, y, b, "dark_oak_log", axis="y")
        for x in range(-2, 3): d.put(x, 6, -2, "dark_oak_log", axis="x"); d.put(x, 6, 2, "dark_oak_log", axis="x")
        for z in range(-1, 2): d.put(-2, 6, z, "dark_oak_log", axis="z"); d.put(2, 6, z, "dark_oak_log", axis="z")
        d.put(0, 6, 0, "dark_oak_log", axis="x"); d.put(0, 5, 0, "iron_chain", axis="y"); d.put(0, 4, 0, "cauldron")
        for k in range(4):   # a steep pyramid roof, pitch 2, snow on it
            for x in range(-3 + k, 4 - k):
                for z in range(-3 + k, 4 - k):
                    if max(abs(x), abs(z)) != 3 - k: continue
                    f = "s" if z == -(3 - k) else "n" if z == 3 - k else "e" if x == -(3 - k) else "w"
                    for yy in (0, 1):
                        roofstair(d, r, x, 7 + 2 * k + yy, z, f, 4) if yy else d.put(x, 7 + 2 * k, z, R[r]["planks"])
        d.put(0, 15, 0, "dark_oak_fence"); d.put(0, 16, 0, "packed_ice")
        d.put(-3, 6, 0, "lantern", hanging=True)
        for (a, b) in ((3, 1), (-3, -2), (2, 3), (-1, -3)): d.put(a, 1, b, "snow_layer")
    elif r == "saltreach":
        shaft(d, 0, 0, 2.5, r)
        for x in range(-3, 4):
            for z in range(-3, 4):
                dd = math.hypot(x, z)
                if 1.6 < dd <= 2.5: d.put(x, 2, z, "smooth_quartz_slab", half="bottom")
                if 2.5 < dd <= 3.6: d.put(x, 0, z, "smooth_sandstone")
        for s in (-1, 1):   # a white stone arch with an iron pulley
            for y in range(2, 6): d.put(2 * s, y, 0, "calcite")
            d.put(2 * s, 1, 0, "cut_sandstone")
            d.put(s, 6, 0, "smooth_sandstone_stairs", facing="e" if s < 0 else "w", half="top")
        d.put(0, 6, 0, "chiseled_sandstone"); d.put(0, 7, 0, "smooth_sandstone_slab", half="bottom")
        d.put(0, 5, 0, "iron_chain", axis="y"); d.put(0, 4, 0, "iron_chain", axis="y"); d.put(0, 3, 0, "cauldron")
        for (a, b) in ((-1, -2), (1, 2)): d.put(a, 2, b, "warped_trapdoor", facing="n", half="bottom")   # the painted lid
        for (a, b) in ((3, -1), (-3, 1), (2, 3)): d.put(a, 1, b, "flower_pot")
    elif r == "blackfen":
        for x in range(-3, 4):   # a raised mud platform, the well in it, a mossy roof on mangrove posts
            for z in range(-3, 4):
                if max(abs(x), abs(z)) <= 3: d.put(x, 1, z, "packed_mud" if max(abs(x), abs(z)) < 3 else "mud_brick_slab", half="bottom")
        shaft(d, 0, 0, 2, r, round_=False)
        for x in range(-2, 3):
            for z in range(-2, 3):
                if max(abs(x), abs(z)) == 2: d.put(x, 2, z, "mud_bricks"); d.put(x, 3, z, "mud_brick_slab", half="bottom")
        for (a, b) in ((-3, -3), (3, -3), (-3, 3), (3, 3)):
            for y in range(1, 6): d.put(a, y, b, "mangrove_log", axis="y")
        for x in range(-4, 5):
            for z, f in ((-3, "s"), (-2, "s"), (-1, "s"), (1, "n"), (2, "n"), (3, "n")):
                yy = 6 + (3 - abs(z)) // 1
                roofstair(d, r, x, 6 + (3 - abs(z)), z, f, 6)
            d.put(x, 9, 0, "moss_block")
        for x in range(-4, 5):
            for z in (-4, 4): d.put(x, 5, z, "mangrove_stairs", facing="s" if z < 0 else "n", half="top")
        for (a, b) in ((-2, -3), (1, 3), (4, 0), (-4, 2)):
            if d.r(a, 9, b) < 0.9: d.put(a, 7 + (3 - abs(b)) - 1 if abs(b) < 3 else 6, b, "moss_block")
        d.put(0, 8, 0, "mangrove_log", axis="x"); d.put(0, 7, 0, "iron_bars"); d.put(0, 6, 0, "verdant_froglight")
        d.put(0, 5, 0, "iron_chain", axis="y"); d.put(0, 4, 0, "cauldron")
        for (a, b) in ((4, 2), (-4, -1), (2, -4)): d.put(a, 1, b, "moss_carpet")
    elif r == "emberwaste":
        shaft(d, 0, 0, 2.5, r)
        for x in range(-4, 5):
            for z in range(-4, 5):
                if 2.5 < math.hypot(x, z) <= 4.6: d.put(x, 0, z, "cut_red_sandstone" if (x + z) % 2 else "smooth_sandstone")
        for x in range(-2, 3):
            for z in range(-2, 3):
                if 1.6 < math.hypot(x, z) <= 2.5: d.put(x, 2, z, "orange_terracotta" if (x * z) % 2 else "smooth_sandstone_slab", half="bottom")
        for (a, b) in ((-3, -3), (3, -3), (-3, 3), (3, 3)):   # a little domed canopy on four piers
            for y in range(1, 6): d.put(a, y, b, "cut_sandstone" if y in (1, 5) else "smooth_sandstone")
        for s in (-1, 1):
            for k in range(-2, 3):
                f = ("e" if k < 0 else "w") if k else None
                d.put(k, 5, 3 * s, "smooth_sandstone_stairs" if k and abs(k) == 2 else "smooth_sandstone", **({"facing": f, "half": "top"} if k and abs(k) == 2 else {}))
                d.put(3 * s, 5, k, "smooth_sandstone_stairs" if k and abs(k) == 2 else "smooth_sandstone", **({"facing": "s" if k < 0 else "n", "half": "top"} if k and abs(k) == 2 else {}))
        for x in range(-4, 5):
            for y in range(6, 11):
                for z in range(-4, 5):
                    if math.hypot(x, (y - 5) * 1.05, z) <= 4.2 and math.hypot(x, (y - 5) * 1.05, z) > 3.0 and d.get(x, y, z) is None:
                        d.put(x, y, z, "cyan_terracotta" if y >= 8 else "smooth_sandstone")
        d.put(0, 10, 0, "cyan_terracotta"); d.put(0, 11, 0, "gold_block"); d.put(0, 12, 0, "lightning_rod", bs={"facing_direction": 1})
        d.put(0, 6, 0, "iron_chain", axis="y"); d.put(0, 5, 0, "iron_chain", axis="y"); d.put(0, 4, 0, "iron_chain", axis="y"); d.put(0, 3, 0, "cauldron")
        d.put(4, 1, 4, "dead_bush"); d.put(-5, 1, 2, "flower_pot")
    return d


# ---------------------------------------------------------------- field fencing


def line(a, b):
    (x0, z0), (x1, z1) = a, b
    n = max(abs(x1 - x0), abs(z1 - z0), 1)
    return [(round(x0 + (x1 - x0) * k / n), round(z0 + (z1 - z0) * k / n)) for k in range(n + 1)]


def fence_run(d, pts, r, gate=None, y=1):
    """The region's field boundary along a polyline of (x, z) corners (closed if the last equals the first).
    gate: index of the segment that gets a field gate at its middle. Vale: a hedge on a low bank with oak posts
    showing through; Frostmarch: a dry-stone wall; Saltreach: a low whitewashed wall with a coping; Blackfen: a
    mangrove fence on a bank between two ditches; Emberwaste: a mud-brick wall; the Hollow: a dark oak fence
    on blackstone posts."""
    P = R[r]
    cells, gates = [], set()
    for i in range(len(pts) - 1):
        seg = line(pts[i], pts[i + 1])
        if i == gate:
            m = len(seg) // 2
            gates |= {seg[m - 1], seg[m], seg[m + 1]} if r in ("vale", "blackfen") else {seg[m]}
        cells += seg if not cells else seg[1:]
    for k, (x, z) in enumerate(cells):
        nb = [c for c in (cells[k - 1] if k else None, cells[k + 1] if k + 1 < len(cells) else None) if c]
        axis_x = all(c[1] == z for c in nb)
        if (x, z) in gates:
            f = "n" if axis_x else "e"
            if r == "frostmarch": d.put(x, y, z, P["gate"], facing=f, bs={"in_wall_bit": True})
            else: d.put(x, y, z, P["gate"], facing=f)
            continue
        corner = len(nb) == 2 and not (nb[0][0] == nb[1][0] or nb[0][1] == nb[1][1])
        if r == "vale":
            d.put(x, y - 1, z, "coarse_dirt")
            if k % 4 == 0 or corner: d.put(x, y, z, "spruce_log", axis="y"); d.put(x, y + 1, z, "oak_leaves")
            else:
                d.put(x, y, z, "oak_leaves")
                if d.r(x, y, z) < 0.6: d.put(x, y + 1, z, "oak_leaves")
            if d.r(x, 9, z) < 0.12: d.put(x, y + 2, z, "oak_leaves")
        elif r == "frostmarch":
            d.put(x, y, z, d.pick(x, y, z, [("cobbled_deepslate", 4), ("cobblestone", 2), ("mossy_cobblestone", 1)], 7))
            d.put(x, y + 1, z, "cobbled_deepslate_wall" if not corner else "polished_deepslate")
            if d.r(x, 3, z) < 0.3: d.put(x, y + 2, z, "snow_layer")
        elif r == "saltreach":
            d.put(x, y, z, "calcite" if d.r(x, 1, z) < 0.8 else "diorite")
            d.put(x, y + 1, z, "smooth_quartz_slab" if not corner else "cut_sandstone", half="bottom")
        elif r == "blackfen":
            d.put(x, y - 1, z, "packed_mud"); d.put(x, y, z, "mangrove_fence" if not corner else "mangrove_log", axis="y")
            if corner: d.put(x, y + 1, z, "mangrove_fence")
        elif r == "emberwaste":
            d.put(x, y, z, "mud_bricks"); d.put(x, y + 1, z, "mud_brick_wall" if not corner else "mud_bricks")
            if corner: d.put(x, y + 2, z, "mud_brick_slab", half="bottom")
        else:
            d.put(x, y, z, "polished_blackstone" if k % 3 == 0 or corner else "dark_oak_fence")
            if k % 3 == 0 or corner: d.put(x, y + 1, z, "dark_oak_fence")
    return cells


def field(r):
    """A field 17 by 13 inside the region's boundary, a gate at the front, the region's crop inside."""
    d = D(f"field_{r}", "drape", seed=450 + REGIONS.index(r))
    W, L = 8, 6
    pts = [(-W, -L), (W, -L), (W, L), (-W, L), (-W, -L)]
    fence_run(d, pts, r, gate=0)
    crop = {"vale": ("wheat", "farmland"), "frostmarch": ("potatoes", "farmland"), "saltreach": ("carrots", "farmland"),
            "blackfen": ("reeds", "mud"), "emberwaste": ("wheat", "farmland"), "hollow": ("siege:veilcap", "siege:undertow_moss")}[r]
    for x in range(-W + 1, W):
        for z in range(-L + 1, L):
            if r in ("blackfen", "emberwaste") and x % 4 == 0:   # irrigation ditches
                d.put(x, 0, z, "water"); continue
            if r == "blackfen" and abs(x % 4) != 1: d.put(x, 0, z, "mud"); continue
            if r == "hollow":
                d.put(x, 0, z, "siege:undertow_moss")
                if (x + z) % 2 == 0: d.put(x, 1, z, "siege:veilcap")
                continue
            d.put(x, 0, z, "farmland", bs={"moisturized_amount": 7})
            d.put(x, 1, z, crop[0], bs={"growth": 7 if d.r(x, 1, z) < 0.8 else 5})
    if r == "blackfen":   # reeds along the ditch banks, a bank of packed mud outside the fence with a ditch beyond
        for x in range(-W + 1, W):
            for z in range(-L + 1, L):
                if abs(x % 4) == 1: d.put(x, 0, z, "mud"); d.put(x, 1, z, "reeds"); d.put(x, 2, z, "reeds")
        for x in range(-W - 1, W + 2):
            for z in (-L - 1, L + 1): d.put(x, 0, z, "water")
        for z in range(-L - 1, L + 2):
            for x in (-W - 1, W + 1): d.put(x, 0, z, "water")
        for x in (-1, 0, 1): d.put(x, 0, -L - 1, "mangrove_planks")   # a plank bridge over the ditch to the gate
    if r == "vale":   # a stile at the far end, a field oak in the hedge
        d.put(0, 1, L, "oak_slab", half="bottom"); d.put(0, 2, L, "oak_slab", half="top")
        oak(d, W, 0, tall=6, crown=3.2)
    if r == "frostmarch":
        for (a, b) in ((-W + 2, -L + 2), (W - 3, L - 2)): d.put(a, 1, b, "snow_layer")
        d.put(W - 2, 1, -L + 2, "hay_block", axis="y")
    if r == "saltreach":   # a scarecrow of driftwood
        d.put(0, 1, 0, "stripped_oak_log", axis="y"); d.put(0, 2, 0, "stripped_oak_log", axis="y"); d.put(0, 3, 0, "carved_pumpkin", facing="n")
        d.put(-1, 2, 0, "oak_fence"); d.put(1, 2, 0, "oak_fence")
    if r == "emberwaste":   # a shaduf over the channel
        d.put(-W + 2, 1, L - 1, "stripped_acacia_log", axis="y"); d.put(-W + 2, 2, L - 1, "stripped_acacia_log", axis="y")
        for k in (-1, 0, 1, 2): d.put(-W + 2 + k, 3, L - 1, "acacia_fence")
        d.put(-W + 4, 2, L - 1, "iron_chain", axis="y"); d.put(-W + 4, 1, L - 1, "cauldron")
    if r == "hollow":
        d.put(0, 1, -L + 1, "polished_blackstone"); d.put(0, 2, -L + 1, "dark_oak_fence"); d.put(0, 3, -L + 1, "soul_lantern")
    return d


# ---------------------------------------------------------------- windmills


def sails(d, cx, cy, cz, n=4, length=9, cloth="white_wool", frame="spruce_fence", hub="spruce_log", tilt=0.0, wide=3):
    """Sails in the x-y plane at z = cz, turning about the hub at (cx, cy): `n` straight arms (stocks) of log
    from the hub, each with a lattice of fence bars across it and a cloth sheet on the trailing side."""
    d.put(cx, cy, cz, hub, axis="z"); d.put(cx, cy, cz + 1, hub, axis="z"); d.put(cx, cy, cz + 2, hub, axis="z")
    for k in range(n):
        a = tilt + 2 * math.pi * k / n
        ux, uy = round(math.cos(a)), round(math.sin(a))
        px, py = -uy, ux   # across the arm, the trailing side
        for s in range(1, length + 1):
            x, y = cx + ux * s, cy + uy * s
            d.put(x, y, cz, hub, axis="x" if ux else "y")
            if s >= 2:
                for w in range(1, wide + 1):
                    xx, yy = x + px * w, y + py * w
                    edge = w == wide or s in (2, length) or s % 3 == 0
                    d.put(xx, yy, cz, frame if edge else cloth)


def windmill(r):
    P = R[r]
    d = D(f"windmill_{r}", "rigid", seed=470 + REGIONS.index(r), fill="dirt", top="keep", ease=3)
    if r == "vale":
        # a post mill: a brick-plinthed trestle, a timber-framed body on its post, gable roof, a ladder tail pole
        for (a, b) in ((-2, -2), (2, -2), (-2, 2), (2, 2)): d.put(a, 1, b, "brick_block"); d.put(a, 2, b, "brick_block")
        for y in range(1, 9): d.put(0, y, 0, "stripped_dark_oak_log", axis="y")
        for (a, b) in ((-2, 0), (2, 0), (0, -2), (0, 2)):
            for k in (1, 2): d.put(a * (3 - k) // 2, 2 + k, b * (3 - k) // 2, "stripped_dark_oak_log", axis="y")
        for x in range(-3, 4):
            for z in range(-4, 5):
                edge = abs(x) == 3 or abs(z) == 4
                for y in range(9, 18):
                    if not edge: continue
                    frame = abs(x) == 3 and abs(z) == 4 or y in (9, 13, 17) or (abs(z) == 4 and x == 0) or (abs(x) == 3 and z % 4 == 0)
                    d.put(x, y, z, "stripped_spruce_log" if frame else "calcite" if y < 13 else "spruce_planks", axis="y" if frame and y not in (9, 13, 17) else ("x" if abs(z) == 4 else "z"))
                d.put(x, 9, z, "spruce_planks") if not edge else None
        for x in (-1, 1): d.put(x, 11, -4, "glass_pane"); d.put(x, 15, 4, "glass_pane")
        for k in range(5):   # the gable roof, ridge along z (the long way)
            for z in range(-5, 6):
                for s in (-1, 1):
                    x = s * (4 - k)
                    roofstair(d, r, x, 18 + k, z, "e" if s < 0 else "w", 8)
                if k == 4: d.put(0, 22, z, "dark_oak_slab", half="bottom")
            for z in (-4, 4):
                for x in range(-3 + k, 4 - k): d.put(x, 18 + k, z, "spruce_planks")
        for z in (-5, 5): d.put(0, 23, z, "end_rod", bs={"facing_direction": 1})
        for k in range(1, 8): d.put(0, max(1, 9 - k), 4 + k, "stripped_dark_oak_log", axis="z")   # the tail pole to turn it by
        d.put(0, 2, 11, "cobblestone"); d.put(0, 9, 5, "spruce_planks"); d.put(0, 10, 5, "spruce_trapdoor", facing="s", half="bottom")
        sails(d, 0, 15, -5, length=11, frame="spruce_fence")
    elif r == "frostmarch":
        # a smock mill: a deepslate base, an eight-sided tapering timber tower, a boat cap, dark sails
        for y in range(1, 22):
            rad = 5.6 - y * 0.12 if y > 4 else 6.0
            for x in range(-7, 8):
                for z in range(-7, 8):
                    o = max(abs(x), abs(z), (abs(x) + abs(z)) / 1.42)
                    if rad - 1 < o <= rad:
                        if y <= 4: d.put(x, y, z, d.pick(x, y, z, P["plinth"], 2))
                        else:
                            cor = abs(abs(x) - abs(z)) <= 0 or x == 0 or z == 0
                            d.put(x, y, z, "dark_oak_log" if cor and (abs(x) + abs(z)) >= rad else "spruce_planks" if y % 6 else "stripped_spruce_log", axis="y")
        for x in range(-7, 8):   # a stage round the tower on brackets
            for z in range(-7, 8):
                o = max(abs(x), abs(z), (abs(x) + abs(z)) / 1.42)
                if 5.4 < o <= 7.0: d.put(x, 8, z, "spruce_slab", half="top")
                if 6.4 < o <= 7.0 and (x + z) % 2 == 0: d.put(x, 9, z, "dark_oak_fence")
        for y in range(22, 27):   # the cap
            for x in range(-5, 6):
                for z in range(-5, 6):
                    if abs(x) <= 4 - (y - 22) * 0.8 and abs(z) <= 4.5 - (y - 22) * 0.5 and d.get(x, y, z) is None:
                        on_edge = abs(x) > 3 - (y - 22) * 0.8 or y == 26
                        if on_edge: d.put(x, y, z, d.pick(x, y, z, R[r]["roof"], 9), facing="e" if x < 0 else "w")
        for z in range(-4, 5): d.put(0, 27, z, "dark_oak_slab", half="bottom")
        d.put(0, 28, -4, "packed_ice")
        for (a, b) in ((0, -6), (0, 6)): d.put(a, 10, b, "lantern", hanging=True)
        for x in (-1, 0, 1):
            for y in (1, 2, 3): d.put(x, y, -6, "air")
        d.put(0, 1, -6, "dark_oak_door", facing="n"); d.put(0, 2, -6, "dark_oak_door", facing="n", upper=True)
        d.put(-1, 1, -6, P["quoin"]); d.put(1, 1, -6, P["quoin"]); d.put(-1, 2, -6, P["quoin"]); d.put(1, 2, -6, P["quoin"])
        sails(d, 0, 22, -6, length=12, cloth="brown_wool", frame="dark_oak_fence", hub="dark_oak_log")
    elif r == "saltreach":
        # a round white tower mill with a conical cap and eight triangular cloth sails (the Mediterranean kind)
        for y in range(1, 15):
            rad = 4.5 - y * 0.06
            for x in range(-5, 6):
                for z in range(-5, 6):
                    dd = math.hypot(x, z)
                    if rad - 1 < dd <= rad:
                        d.put(x, y, z, "cut_sandstone" if y == 1 else "calcite" if d.r(x, y, z) < 0.9 else "white_concrete")
        for x in range(-5, 6):
            for z in range(-5, 6):
                if 3.4 < math.hypot(x, z) <= 4.5: d.put(x, 15, z, "smooth_sandstone_slab", half="bottom")
        for y in range(15, 22):   # the cone
            rad = 4.6 - (y - 15) * 0.7
            for x in range(-5, 6):
                for z in range(-5, 6):
                    dd = math.hypot(x, z)
                    if rad - 1.1 < dd <= rad and d.get(x, y, z) is None:
                        d.put(x, y, z, d.pick(x, y, z, [("dark_prismarine", 3), ("prismarine_bricks", 1)], 3) if y > 15 else "smooth_sandstone")
        d.put(0, 22, 0, "lightning_rod", bs={"facing_direction": 1})
        for (y, z) in ((5, -5), (10, -5), (8, 5)): d.put(0, y, z, "glass_pane")
        for y in (5, 10): d.put(-1, y, -5, "warped_trapdoor", facing="w", open=True); d.put(1, y, -5, "warped_trapdoor", facing="e", open=True)
        d.put(0, 1, -5, "birch_door", facing="n"); d.put(0, 2, -5, "birch_door", facing="n", upper=True)
        for (a, b) in ((2, -5), (-2, -5)): d.put(a, 1, b, "flower_pot")
        d.put(0, 17, -5, "birch_log", axis="z"); d.put(0, 17, -6, "birch_log", axis="z")
        # eight spars (the Mediterranean kind): four straight ones with a cloth sheet, four diagonal ones between
        # them with a triangle of cloth tied back to the next spar
        sails(d, 0, 17, -7, n=4, length=9, cloth="white_wool", frame="birch_fence", hub="stripped_birch_log", wide=2)
        for ux, uy in ((1, 1), (-1, 1), (-1, -1), (1, -1)):
            for s in range(1, 7):
                d.put(ux * s, 17 + uy * s, -7, "birch_fence")
                for t in range(1, s // 2 + 1):   # the jib, between the spar and the arm it trails
                    c = (ux * s, 17 + uy * s - uy * t) if ux * uy > 0 else (ux * s - ux * t, 17 + uy * s)
                    if d.get(c[0], c[1], -7) is None: d.put(c[0], c[1], -7, "white_wool")
    elif r == "blackfen":
        # a drainage mill: a tarred brick tower on a mound by the ditch, thatched cap, a scoop wheel lifting water
        for x in range(-6, 7):
            for z in range(-6, 7):
                if math.hypot(x, z) <= 6.5: d.put(x, 1, z, "packed_mud" if math.hypot(x, z) <= 5.5 else "mud_brick_slab", half="bottom")
        for y in range(2, 17):
            rad = 4.2 - (y - 2) * 0.09
            for x in range(-5, 6):
                for z in range(-5, 6):
                    dd = math.hypot(x, z)
                    if rad - 1 < dd <= rad: d.put(x, y, z, d.pick(x, y, z, [("mud_bricks", 6), ("packed_mud", 1), ("tuff_bricks", 1)], 4) if y > 3 else "tuff_bricks")
        for y in range(17, 23):
            rad = 3.9 - (y - 17) * 0.62
            for x in range(-5, 6):
                for z in range(-5, 6):
                    dd = math.hypot(x, z)
                    if rad - 1.1 < dd <= rad and d.get(x, y, z) is None: d.put(x, y, z, "hay_block" if d.r(x, y, z) < 0.85 else "moss_block", axis="y")
        d.put(0, 23, 0, "mangrove_fence"); d.put(0, 24, 0, "verdant_froglight")
        d.put(0, 2, -4, "mangrove_door", facing="n"); d.put(0, 3, -4, "mangrove_door", facing="n", upper=True)
        d.put(0, 9, -4, "iron_bars"); d.put(0, 13, -4, "iron_bars")
        # the ditch along the east side, the scoop wheel in a brick race
        for z in range(-9, 10):
            for x in (7, 8, 9): d.put(x, 0, z, "water"); d.put(x, 1, z, "air")
        for z in (-2, 2):
            for y in range(1, 4): d.put(6, y, z, "tuff_bricks"); d.put(10, y, z, "tuff_bricks")
        for k in range(12):   # a wheel of planks in the race, turning across x
            a = 2 * math.pi * k / 12
            d.put(8, 2 + round(math.sin(a) * 2.5), round(math.cos(a) * 2.5), "mangrove_planks")
        for x in (6, 7, 8): d.put(x, 2, 0, "mangrove_log", axis="x")
        sails(d, 0, 17, -5, length=10, cloth="white_wool", frame="mangrove_fence", hub="mangrove_log")
        for (a, b) in ((-5, 3), (-4, -5), (4, 5)): d.put(a, 2, b, "moss_carpet")
    elif r == "emberwaste":
        # vertical-axis mills in a row (the old Persian kind): tall mud-brick walls, a slot facing the wind,
        # reed-matted blades round an upright shaft between them, a timber head beam on top
        for u in range(3):
            ox = (u - 1) * 6
            for y in range(1, 15):
                for z in range(-3, 4):
                    for s in (-3, 3): d.put(ox + s, y, z, d.pick(ox + s, y, z, [("mud_bricks", 5), ("packed_mud", 2), ("smooth_sandstone", 1)], 5))
                for x in range(ox - 2, ox + 3):
                    if x != ox - 2: d.put(x, y, 3, d.pick(x, y, 3, [("mud_bricks", 5), ("packed_mud", 2)], 6))   # back wall, the slot at the front-left
            for y in range(2, 14): d.put(ox, y, 0, "stripped_acacia_log", axis="y")
            for y in range(3, 13):
                for k in range(6):
                    a = math.pi * k / 3 + y * 0.0
                    x, z = round(ox + math.cos(a) * 1.6), round(math.sin(a) * 1.6)
                    if (x, z) != (ox, 0): d.put(x, y, z, "bamboo_block" if y % 3 else "stripped_acacia_log", axis="y")
            for x in range(ox - 3, ox + 4): d.put(x, 15, 0, "spruce_log", axis="x")
            for z in range(-3, 4): d.put(ox - 3, 15, z, "acacia_slab", half="bottom"); d.put(ox + 3, 15, z, "acacia_slab", half="bottom")
        for x in range(-10, 11):   # the mill house below them, flat roofed
            for z in range(4, 10):
                edge = abs(x) == 10 or z in (4, 9)
                for y in range(1, 6):
                    if edge: d.put(x, y, z, d.pick(x, y, z, P["stone"], 8))
                d.put(x, 6, z, "smooth_sandstone" if not edge else "smooth_sandstone_slab", half="bottom")
        for x in range(-9, 10, 2): d.put(x, 5, 3, "spruce_log", axis="z")   # vigas
        d.put(0, 1, 9, "acacia_door", facing="s"); d.put(0, 2, 9, "acacia_door", facing="s", upper=True)
        for x in (-6, 6): d.put(x, 3, 9, "acacia_trapdoor", facing="s", half="bottom")
        d.put(-11, 1, 6, "dead_bush"); d.put(11, 1, 8, "flower_pot")
    elif r == "hollow":
        return None
    return d


# ---------------------------------------------------------------- construction-site scaffolds


def scaffold(d, box, h, stage, wood="spruce", stone=None):
    """A building going up inside box (x0, z0, x1, z1), roof ridge about h up.
    1  staked out: corner stakes, string lines of fence, the footing trench, stacks of timber and stone, a tent
    2  footings laid and the ground-floor posts up, scaffold towers at the corners, ladders, a treadwheel hoist
    3  the frame to the eaves, rafters on one end, scaffold decks round two sides on putlog poles, the hoist
       lifting a block on its chain"""
    x0, z0, x1, z1 = box
    stone = stone or [("cobblestone", 5), ("stone_bricks", 3), ("andesite", 2)]
    log, planks, fence, slab = f"stripped_{wood}_log", f"{wood}_planks", f"{wood}_fence", f"{wood}_slab"
    for (x, z) in ((x0, z0), (x1, z0), (x0, z1), (x1, z1)):
        d.put(x, 1, z, fence); d.put(x, 2, z, fence)
    if stage == 1:
        for x in range(x0, x1 + 1):
            for z in (z0, z1): d.put(x, 0, z, "coarse_dirt")
        for z in range(z0, z1 + 1):
            for x in (x0, x1): d.put(x, 0, z, "coarse_dirt")
        for (x, z) in ((x0, z0), (x1, z0), (x0, z1), (x1, z1)): d.put(x, 3, z, "white_wool")   # flagged stakes
        for x in range(x0 + 1, x1): d.put(x, 1, z0 - 1, "white_carpet") if (x - x0) % 2 else None
    else:
        for x in range(x0, x1 + 1):   # the plinth
            for z in range(z0, z1 + 1):
                if x in (x0, x1) or z in (z0, z1): d.put(x, 1, z, d.pick(x, 1, z, stone, 11))
                else: d.put(x, 1, z, planks if stage == 3 else "coarse_dirt")
        top = 6 if stage == 2 else h - 3
        posts = [(x, z) for x in range(x0, x1 + 1, 4) for z in (z0, z1)] + [(x, z) for z in range(z0, z1 + 1, 4) for x in (x0, x1)]
        for (x, z) in posts:
            for y in range(2, top + 1): d.put(x, y, z, log, axis="y")
        if stage == 3:
            for x in range(x0, x1 + 1):
                for z in (z0, z1): d.put(x, 6, z, log, axis="x"); d.put(x, top, z, log, axis="x")
            for z in range(z0, z1 + 1):
                for x in (x0, x1): d.put(x, 6, z, log, axis="z"); d.put(x, top, z, log, axis="z")
            mid = (x0 + x1) // 2
            for z in range(z0, z0 + 5, 2):   # rafters on the front end
                for k in range(0, (x1 - x0) // 2 + 1):
                    d.put(x0 + k, top + 1 + k, z, fence); d.put(x1 - k, top + 1 + k, z, fence)
            for z in range(z0, z0 + 5): d.put(mid, top + 1 + (x1 - x0) // 2, z, log, axis="z")
        # scaffold towers at the corners outside the box, decks on the long sides
        for (x, z) in ((x0 - 2, z0 - 2), (x1 + 2, z0 - 2), (x0 - 2, z1 + 2), (x1 + 2, z1 + 2)):
            for y in range(1, top + 2): d.put(x, y, z, "scaffolding")
        if stage == 3:
            for y in (5, top):
                for x in range(x0 - 1, x1 + 2):
                    d.put(x, y, z0 - 2, slab, half="top")
                    if (x - x0) % 4 == 0:
                        for yy in range(1, y): d.put(x, yy, z0 - 2, log, axis="y")
                for z in range(z0 - 1, z1 + 2):
                    d.put(x1 + 2, y, z, slab, half="top")
                    if (z - z0) % 4 == 0:
                        for yy in range(1, y): d.put(x1 + 2, yy, z, log, axis="y")
                for x in range(x0 - 1, x1 + 2, 2): d.put(x, y, z0 - 3, fence) if y == top else None
            for y in range(1, top + 1): d.put(x0 - 3, y, z0 - 2, "ladder", facing="w")
        # the treadwheel hoist on the open side
        hx, hz = x0 - 5, (z0 + z1) // 2
        for k in range(16):
            a = 2 * math.pi * k / 16
            d.put(hx, 4 + round(math.sin(a) * 3), hz + round(math.cos(a) * 3), planks)
        d.put(hx, 4, hz, log, axis="x"); d.put(hx + 1, 4, hz, log, axis="x")
        for y in range(1, top + 4): d.put(hx + 2, y, hz, log, axis="y")
        for x in range(hx + 2, x0 + 2): d.put(x, top + 3, hz, log, axis="x")
        if stage == 3:
            for y in range(top - 1, top + 3): d.put(x0 + 1, y, hz, "iron_chain", axis="y")
            d.put(x0 + 1, top - 2, hz, d.pick(0, 0, 0, stone, 1))
    # the yard: stacks of timber and stone, a sawhorse, a barrel, a tent in stage 1
    ax = x1 + 4
    for z in range(z0, z0 + 4):
        for y in (1, 2): d.put(ax, y, z, log, axis="z"); d.put(ax + 1, y, z, log, axis="z")
    for z in range(z1 - 2, z1 + 1):
        for x in (ax, ax + 1):
            for y in range(1, 3 if stage > 1 else 4): d.put(x, y, z, d.pick(x, y, z, stone, 12))
    d.put(ax, 1, (z0 + z1) // 2, "barrel", bs={"facing_direction": 1}); d.put(ax + 1, 1, (z0 + z1) // 2 + 1, fence)
    d.put(ax + 1, 2, (z0 + z1) // 2 + 1, slab, half="bottom"); d.put(ax + 1, 1, (z0 + z1) // 2 + 2, fence)
    if stage == 1:
        tx, tz = x0 - 5, z1 - 2
        for k, y in enumerate((1, 2, 3)):
            for z in range(tz - 2, tz + 3):
                d.put(tx - 2 + k, y, z, "white_wool"); d.put(tx + 2 - k, y, z, "white_wool")
        d.put(tx, 4, tz, "white_wool_slab", half="bottom")


def scaffold_design(stage):
    d = D(f"scaffold_{stage}", "rigid", seed=490 + stage, fill="dirt", top="keep", ease=2)
    scaffold(d, (-4, -6, 4, 6), 13, stage)
    return d


# ---------------------------------------------------------------- the catalogue


def designs():
    out = {}
    for r in REGIONS:
        if r != "hollow": out[f"signpost_{r}"] = (lambda r=r: signpost_design(r), f"Signpost · {NAMES[r]}")
        out[f"well_{r}"] = (lambda r=r: well(r), f"Well · {NAMES[r]}")
        out[f"field_{r}"] = (lambda r=r: field(r), f"Field fencing · {NAMES[r]}")
        if r != "hollow": out[f"windmill_{r}"] = (lambda r=r: windmill(r), f"Windmill · {NAMES[r]}")
    for s, t in ((1, "staked out"), (2, "footings and poles"), (3, "frame and scaffold decks")):
        out[f"scaffold_{s}"] = (lambda s=s: scaffold_design(s), f"Construction site · stage {s}, {t}")
    return out


def scene(d, pad):
    import export_landmarks as X
    blocks = X.compute(d.spec())
    for c in d.airs(): blocks[c] = ("air", {})
    pal, idx, rows = [], {}, []

    def ix(n, p):
        k = json.dumps([n, p], sort_keys=True)
        if k not in idx: idx[k] = len(pal); pal.append([n, p])
        return idx[k]
    xs = [c[0] for c in blocks]; zs = [c[2] for c in blocks]
    for x in range(min(xs) - 2, max(xs) + 3):
        for z in range(min(zs) - 2, max(zs) + 3):
            if (x, 0, z) not in blocks: rows.append([x, 0, z, ix(pad, {})])
            if (x, -1, z) not in blocks: rows.append([x, -1, z, ix("dirt", {})])
    for (x, y, z), (n, p) in sorted(blocks.items()):
        if n != "air": rows.append([x, y, z, ix(n, p)])
    ys = [c[1] for c in blocks]
    cx, cz = (min(xs) + max(xs)) / 2, (min(zs) + max(zs)) / 2
    size = max(max(xs) - min(xs), max(zs) - min(zs), max(ys)) + 4
    mid = max(ys) * 0.42
    views = {"front-left": [215, 20, size * 2.1, cx, mid, cz], "front-right": [145, 22, size * 2.1, cx, mid, cz], "back": [20, 22, size * 2.1, cx, mid, cz],
             "high": [200, 50, size * 2.3, cx, mid * 0.6, cz], "close": [200, 10, size * 1.3, cx, mid, cz]}
    return {"name": d.name, "palette": pal, "blocks": rows, "camera": {"views": views}}


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "world-props"
    os.makedirs(out, exist_ok=True)
    names = {}
    for key, (fn, title) in designs().items():
        d = fn()
        if d is None: continue
        r = next((k for k in REGIONS if key.endswith(k)), "vale")
        sc = scene(d, R[r]["pad"] if r != "hollow" else "moss_block")
        os.makedirs(os.path.join(out, key), exist_ok=True)
        json.dump(sc, open(os.path.join(out, key, "scene.json"), "w"), separators=(",", ":"))
        names[key] = title
        print(key, len(sc["blocks"]))
    json.dump(names, open(os.path.join(out, "names.json"), "w"), indent=1)


if __name__ == "__main__":
    main()
