"""Town Board job sites (townhall/board.js): the raider camp at Carter's Rest, the opened barrows, the row of
road lamps, a nest of clothes pegs in an elm. Each is a minecraft-builder skill spec (the one engine, drawn with
landmarks.D like every landmark) plus the placing keys of landmarks/plan.js, plus

    marks   [[x, y, z, kind]]  spots the job uses (board.js marksOf):
            foe     where a camp's raiders or a hunt's quarry stand when the job begins
            look    what a Look job sends you to see (you are near it: the "seen" line)
            find    where the lost thing lies (the item is dropped there)
            person  where the missing person is found
            lamp    a lamp a Watch keeps lit: the lantern itself, standing on its post (click the post to relight)
            sheep   a sheep of the fold

The game stamps a site on the job's place when the job is given (the player is still far off), saving the ground
first, and puts the ground back once the job is over and the player has gone (townhall/board_sites.js).
Coordinates: x east, y up, z south, y = 0 the ground layer, (0, 0) the place's spot in board_data.js PLACES.
Every size is odd. Ground round each place read off the map's heights (2026-11-14) is noted on each design.

    python3 board_sites.py [--scenes DIR] [--only a,b]
        -> Siege_Nights_BP/scripts/townhall/board_sites_data.js
        --scenes DIR: a scene.json per site (on a patch of grass) for render/render.py
"""
import argparse, json, math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
from landmarks import D, oak, post  # noqa: E402
import export_landmarks as EX  # noqa: E402

OUT = os.path.join(ROOT, "Siege_Nights_BP", "scripts", "townhall", "board_sites_data.js")

CANVAS = [("light_gray_wool", 6), ("white_wool", 2), ("brown_wool", 1)]   # stolen canvas, patched
COBBLE = [("cobblestone", 4), ("mossy_cobblestone", 3), ("stone", 1)]
FACE = {"n": "north", "s": "south", "e": "east", "w": "west"}


STYLE = {   # each region's camp woods, canvas, stone and lamp (regions/<region>.md; dressing.py LAMP_STYLE)
    "vale": dict(log="spruce_log", slog="stripped_spruce_log", planks="spruce_planks", slab="spruce_slab", stairs="spruce_stairs",
                 fence="spruce_fence", trap="spruce_trapdoor", canvas=CANVAS, stone=COBBLE, foot="stone_brick_wall", post="dark_oak_fence",
                 ground=[("coarse_dirt", 3), ("grass_path", 2), ("gravel", 1)], flag="black_wool"),
    "frost": dict(log="spruce_log", slog="stripped_spruce_log", planks="spruce_planks", slab="spruce_slab", stairs="spruce_stairs",
                  fence="spruce_fence", trap="spruce_trapdoor", canvas=[("light_gray_wool", 4), ("brown_wool", 2), ("gray_wool", 1)],
                  stone=[("cobbled_deepslate", 4), ("deepslate_bricks", 2), ("andesite", 1)], foot="cobbled_deepslate_wall", post="spruce_fence",
                  ground=[("coarse_dirt", 2), ("gravel", 2), ("packed_ice", 1)], flag="black_wool"),
    "salt": dict(log="oak_log", slog="stripped_birch_log", planks="birch_planks", slab="birch_slab", stairs="birch_stairs",
                 fence="birch_fence", trap="birch_trapdoor", canvas=[("white_wool", 4), ("light_gray_wool", 2), ("brown_wool", 1)],
                 stone=[("cobblestone", 3), ("andesite", 3), ("smooth_sandstone", 2)], foot="stone_brick_wall", post="birch_fence",
                 ground=[("sand", 3), ("gravel", 2), ("coarse_dirt", 1)], flag="black_wool"),
    "ember": dict(log="acacia_log", slog="stripped_acacia_log", planks="acacia_planks", slab="acacia_slab", stairs="acacia_stairs",
                  fence="acacia_fence", trap="acacia_trapdoor", canvas=[("orange_wool", 3), ("red_wool", 2), ("white_wool", 2)],
                  stone=[("sandstone", 4), ("smooth_sandstone", 2), ("cut_sandstone", 1)], foot="sandstone_wall", post="acacia_fence",
                  ground=[("red_sand", 2), ("coarse_dirt", 2), ("sand", 1)], flag="black_wool"),
    "fen": dict(log="mangrove_log", slog="stripped_mangrove_log", planks="mangrove_planks", slab="spruce_slab", stairs="spruce_stairs",
                fence="mangrove_fence", trap="spruce_trapdoor", canvas=[("brown_wool", 3), ("green_wool", 2), ("light_gray_wool", 1)],
                stone=[("mud_bricks", 4), ("packed_mud", 2), ("tuff", 1)], foot="mud_brick_wall", post="mangrove_fence",
                ground=[("mud", 2), ("packed_mud", 2), ("coarse_dirt", 1)], flag="black_wool"),
}
V = STYLE["vale"]


def mark(d, x, y, z, kind):
    d.meta.setdefault("marks", []).append([x, y, z, kind])


# ---------------------------------------------------------------- pieces

def tent(d, cx, cz, front="n", mix=CANVAS, salt=0, S=V):
    """A ridge tent 5 wide, 5 deep, 3 high, open at the front, a bedroll and a pack inside. Ridge along z
    (front n/s) or x (front e/w); the front ridge pole is a fence post that carries the ridge's end."""
    along_z = front in "ns"
    fs = -1 if front in "nw" else 1                   # the front is this way along the ridge
    for a in range(-2, 3):                            # a: along the ridge, b: across it
        for b, y in ((-2, 1), (2, 1), (-1, 2), (1, 2), (0, 3)):
            x, z = (cx + b, cz + a) if along_z else (cx + a, cz + b)
            d.put(x, y, z, d.pick(x, y, z, mix, salt))
    for b, y in ((-1, 1), (0, 1), (1, 1), (0, 2)):    # the back closed
        x, z = (cx + b, cz - 2 * fs) if along_z else (cx - 2 * fs, cz + b)
        d.put(x, y, z, d.pick(x, y, z, mix, salt + 1))
    px, pz = (cx, cz + 3 * fs) if along_z else (cx + 3 * fs, cz)
    d.put(px, 1, pz, S["fence"]); d.put(px, 2, pz, S["fence"])
    d.put(px, 3, pz, d.pick(px, 3, pz, mix, salt))    # the ridge carried out over its pole
    for a in (0, -1):                                 # bedroll, head to the back
        x, z = (cx - 1, cz + a * fs) if along_z else (cx + a * fs, cz - 1)
        d.put(x, 1, z, "brown_carpet" if a == 0 else "white_carpet")
    x, z = (cx + 1, cz - fs) if along_z else (cx - fs, cz + 1)
    d.put(x, 1, z, "barrel", bs={"facing_direction": 1})   # the pack


def fire_ring(d, cx, cz, lit=True, seats=True, S=V):
    for dx in (-1, 0, 1):
        for dz in (-1, 0, 1):
            if dx or dz: d.put(cx + dx, 0, cz + dz, "cobblestone" if dx and dz else "mossy_cobblestone")
    d.put(cx, 0, cz, "coarse_dirt")
    d.put(cx, 1, cz, "campfire", bs={"extinguished": not lit})
    if seats:                                          # log seats round it
        d.put(cx - 3, 1, cz, S["slog"], axis="z"); d.put(cx - 3, 1, cz + 1, S["slog"], axis="z")
        d.put(cx + 3, 1, cz - 1, S["slog"], axis="z"); d.put(cx + 3, 1, cz, S["slog"], axis="z")
        d.put(cx, 1, cz + 3, S["log"], axis="x"); d.put(cx + 1, 1, cz + 3, S["log"], axis="x")


def stakes(d, pts, gaps=(), salt=0, S=V):
    """A raider palisade: sharpened logs 2 or 3 high along the ring of points, a fence spike on the tall ones,
    leaving `gaps` (cells) open."""
    for i, (x, z) in enumerate(pts):
        if (x, z) in gaps: continue
        tall = 2 + (d.r(x, 5, z, salt) < 0.55)
        for y in range(1, tall + 1): d.put(x, y, z, S["slog"] if d.r(x, y, z, salt) < 0.7 else S["log"], axis="y")
        if tall == 3 and d.r(x, 9, z, salt) < 0.6: d.put(x, 4, z, S["fence"])


def ring(rx, rz):
    """Cells on an ellipse of radii rx, rz round (0, 0), joined (no diagonal leaks)."""
    pts, last = [], None
    for k in range(720):
        a = k * math.tau / 720
        c = (round(math.sin(a) * rx), round(-math.cos(a) * rz))
        if c != last:
            if last and abs(c[0] - last[0]) + abs(c[1] - last[1]) == 2: pts.append((c[0], last[1]))
            pts.append(c); last = c
    out = []
    for c in pts:
        if c not in out: out.append(c)
    return out


def lookout(d, cx, cz, tall=5, S=V):
    """A raider lookout: four posts 3 x 3, a plank deck at `tall` with a rail, a ladder up the south face."""
    for dx in (-1, 1):
        for dz in (-1, 1):
            post(d, cx + dx, cz + dz, tall, S["log"])
    for dx in (-1, 0, 1):
        for dz in (-1, 0, 1):
            d.put(cx + dx, tall, cz + dz, S["planks"])
    for dx in (-1, 0, 1):
        for dz in (-1, 0, 1):
            if dz != 1 or dx != 0: d.put(cx + dx, tall + 1, cz + dz, S["fence"]) if (dx or dz) else None
    for y in range(1, tall + 1): d.put(cx, y, cz + 2, S["log"], axis="y")      # the ladder pole, outside
    for y in range(1, tall + 1): d.put(cx, y, cz + 3, "ladder", bs={"facing_direction": 3})
    d.put(cx + 1, tall + 2, cz - 1, S["fence"]); d.put(cx + 1, tall + 3, cz - 1, S["fence"])
    d.put(cx + 1, tall + 4, cz - 1, S["flag"]); d.put(cx + 2, tall + 4, cz - 1, S["flag"])   # their rag of a flag
    d.put(cx + 2, tall + 3, cz - 1, S["flag"])


def crate(d, x, z, y=1):
    d.put(x, y, z, "barrel", bs={"facing_direction": 1} if d.r(x, y, z) < 0.5 else {"facing_direction": 2})


def lamp_post(d, x, z, y0=1, foot="stone_brick_wall", wood="dark_oak_fence", S=None):
    if S: foot, wood = S["foot"], S["post"]
    """The Vale's road lamp (dressing.py LAMP_STYLE): a stone foot, two posts, a lantern standing on top."""
    d.put(x, y0, z, foot); d.put(x, y0 + 1, z, wood); d.put(x, y0 + 2, z, wood)
    d.put(x, y0 + 3, z, "lantern")
    return (x, y0 + 3, z)


# ---------------------------------------------------------------- Aldmere Vale

def vale_camp():
    """The Tollmen's camp in Carter's Rest, where the carters water their mules: a ring of stakes with a gap to the
    Harrowford road, three tents of stolen canvas, the toll they took (a crate and a half, the rope, the axle grease)
    piled by a cart with its wheels off, a lookout with their black rag on it, and the fire in the middle.
    Ground: flat (79-80 round -372, -387), the road ~22 blocks south-west."""
    d = D("vale_camp", "rigid", seed=301, fill="dirt", top="keep", ease=3)
    R = ring(11, 9)
    gate = {c for c in R if c[1] > 6 and -2 <= c[0] <= 2}            # the gap faces south, to the road
    stakes(d, R, gaps=gate | {c for c in R if c[0] < -9 and -1 <= c[1] <= 0}, salt=1)
    # trodden ground inside
    for x in range(-10, 11):
        for z in range(-8, 9):
            if (x / 10.5) ** 2 + (z / 8.5) ** 2 < 1 and d.r(x, 0, z) < 0.35:
                d.put(x, 0, z, d.pick(x, 0, z, [("coarse_dirt", 3), ("grass_path", 2), ("gravel", 1)], 2))
    for z in range(6, 12):                              # the track out through the gap
        for x in (-1, 0, 1):
            if d.r(x, 0, z, 4) < 0.7: d.put(x, 0, z, "grass_path" if d.r(x, 1, z) < 0.6 else "coarse_dirt")
    fire_ring(d, 0, 0)
    tent(d, -6, -4, "e", salt=1)
    tent(d, 6, -4, "w", salt=2)
    tent(d, -5, 4, "n", salt=3)
    lookout(d, 6, 2)
    # the toll: the cart up on blocks, its load spilled
    for x in range(-2, 3):
        d.put(x, 1, -6, "spruce_slab", half="top" if x in (-2, 2) else "bottom")
    d.put(-2, 0, -6, "cobblestone"); d.put(2, 0, -6, "cobblestone")
    d.put(-3, 1, -6, "spruce_fence"); d.put(3, 1, -7, "spruce_trapdoor", facing="w", half="bottom")   # shafts down, a wheel off
    crate(d, -1, -7); crate(d, 0, -7); d.put(1, 1, -7, "chest", facing="s"); crate(d, -1, -7, 2)
    d.put(3, 1, -5, "spruce_trapdoor", facing="n", half="bottom")    # the other wheel, lying flat
    # rope and grease: a coil of chain on the cart, a cauldron of grease by the fire
    d.put(0, 2, -6, "iron_chain", axis="x"); d.put(1, 2, -6, "iron_chain", axis="x")
    d.put(2, 1, 1, "cauldron")
    d.put(-2, 1, -2, "hay_block", axis="x")            # a mule's feed, also taken
    # what the rope is for: the start of a frame, two poles lashed with chain
    for y in range(1, 5): d.put(-8, y, 2, "spruce_log", axis="y")
    for y in range(1, 4): d.put(-8, y, 5, "spruce_log", axis="y")
    d.put(-8, 4, 3, "spruce_log", axis="z"); d.put(-8, 4, 4, "iron_chain", axis="z")
    for x, z in ((0, -2), (-3, 2), (3, 1), (-1, 7), (1, 7), (3, -2), (-4, -1)): mark(d, x, 1, z, "foe")
    return d


def vale_ram_camp():
    """The fellers on the Oakwood ride: Millbrook's oaks cut low and clean, the trunks shaped into a ram on a cradle
    that has no wheels yet, a log pile, a saw-horse, chips everywhere, one tent and their fire.
    Ground: flat (77-78 round 101, -504) in the Oakwood, the ride ~10 blocks south."""
    d = D("vale_ram_camp", "rigid", seed=302, fill="dirt", top="keep", ease=3)
    # stumps cut low: the trees they took
    for k, (x, z) in enumerate(((-9, -6), (-6, -8), (-10, 1), (8, -7), (10, -2), (-3, -9), (4, -9), (9, 5))):
        d.put(x, 1, z, "oak_log", axis="y")
        if d.r(k, 1, 0) < 0.5: d.put(x + 1, 1, z, "oak_slab", half="bottom")
        d.put(x, 0, z, "dirt_with_roots" if k % 2 else "coarse_dirt")
    # chips and sawdust
    for x in range(-8, 9):
        for z in range(-6, 7):
            t = d.r(x, 0, z, 3)
            if t < 0.22: d.put(x, 0, z, d.pick(x, 0, z, [("coarse_dirt", 2), ("grass_path", 1), ("dirt_with_roots", 1)], 4))
            elif t < 0.26 and d.get(x, 1, z) is None: d.put(x, 1, z, "oak_slab" if t < 0.24 else "spruce_slab", half="bottom")
    # the cradle: two sleepers, uprights, the ram slung between them, its head capped in iron
    for x in (-4, 2):
        for z in (-1, 1): d.put(x, 1, z, "stripped_spruce_log", axis="y"); d.put(x, 2, z, "stripped_spruce_log", axis="y")
        d.put(x, 3, -1, "stripped_spruce_log", axis="z"); d.put(x, 3, 0, "stripped_spruce_log", axis="z"); d.put(x, 3, 1, "stripped_spruce_log", axis="z")
        d.put(x, 1, 0, "spruce_slab", half="bottom")
    for x in range(-6, 5): d.put(x, 2, 0, "stripped_oak_log", axis="x")
    d.put(5, 2, 0, "iron_block"); d.put(-7, 2, 0, "oak_log", axis="x")
    for x in (-4, 2): d.put(x, 4, 0, "iron_chain", axis="y")                      # the slings, hung from the beams
    d.put(-1, 1, 2, "spruce_trapdoor", facing="s", half="bottom")                 # an axle cut but no wheels
    # the log pile and a saw-horse
    for x in range(-2, 3):
        d.put(x, 1, -5, "oak_log", axis="x"); d.put(x, 1, -4, "oak_log", axis="x")
        if abs(x) < 2: d.put(x, 2, -5, "oak_log", axis="x")
    d.put(4, 1, -4, "spruce_fence"); d.put(6, 1, -4, "spruce_fence")
    d.put(4, 2, -4, "oak_slab", half="bottom"); d.put(5, 2, -4, "oak_slab", half="bottom"); d.put(6, 2, -4, "oak_slab", half="bottom")
    d.put(5, 1, -3, "grindstone", bs={"attachment": "standing", "direction": 0})
    fire_ring(d, -2, 5, seats=False)
    d.put(-5, 1, 5, "stripped_spruce_log", axis="z"); d.put(1, 1, 5, "stripped_spruce_log", axis="z")
    tent(d, 6, 5, "w", salt=4)
    for x, z in ((-2, 2), (0, -2), (3, 3), (-5, -2), (2, 7), (-6, 3)): mark(d, x, 1, z, "foe")
    return d


def barrow(d, cx, cz, rx, rz, tall, door="s", salt=0):
    """A grass barrow: a mound with a stone chamber, its door slab pushed out from inside and lying on the turf."""
    for x in range(cx - rx - 1, cx + rx + 2):
        for z in range(cz - rz - 1, cz + rz + 2):
            e = ((x - cx) / (rx + 0.5)) ** 2 + ((z - cz) / (rz + 0.5)) ** 2
            if e >= 1: continue
            top = max(1, round(tall * math.sqrt(1 - e)))
            for y in range(1, top + 1): d.put(x, y, z, "dirt")
            d.put(x, top, z, "grass_block" if d.r(x, top, z, salt) < 0.85 else "moss_block")
            if d.r(x, top + 1, z, salt) < 0.12: d.put(x, top + 1, z, "short_grass")
    # the chamber: 3 wide, 5 deep, 2 high inside, stone, a bier with nothing on it, under a skin of turf
    sz = 1 if door == "s" else -1
    for x in range(cx - 2, cx + 3):
        for z in range(cz - 3, cz + 4):
            for y in range(0, 4):
                wall = abs(x - cx) == 2 or abs(z - cz) == 3 or y in (0, 3)
                if wall: d.put(x, y, z, d.pick(x, y, z, [("mossy_stone_bricks", 3), ("stone_bricks", 2), ("cracked_stone_bricks", 2), ("tuff", 1)], salt))
                else: d.air(x, y, z)
    d.put(cx, 1, cz - 2 * sz, "smooth_stone_slab", half="top"); d.put(cx, 1, cz - sz, "smooth_stone_slab", half="top")
    d.put(cx - 1, 2, cz - 2 * sz, "web"); d.put(cx + 1, 1, cz + sz, "web")
    # the doorway: a lintel of big stones, open
    dz = cz + 3 * sz
    for y in (1, 2): d.air(cx, y, dz)
    for x in (cx - 1, cx + 1):
        for y in (1, 2, 3): d.put(x, y, dz, "polished_andesite")
    d.put(cx, 3, dz, "chiseled_stone_bricks")
    for z in range(dz + sz, dz + 3 * sz, sz):                     # the passage out through the mound
        for y in (1, 2): d.air(cx, y, z)
        d.put(cx, 0, z, "coarse_dirt")
    # the slab, flung out flat
    for x in (cx - 1, cx):
        d.put(x, 1, dz + 4 * sz, "smooth_stone_slab", half="bottom")
    d.put(cx + 1, 1, dz + 5 * sz, "cobblestone_slab", half="bottom")
    for x in range(cx - 1, cx + 2): d.put(x, 0, dz + 3 * sz, "coarse_dirt")
    return (cx, 1, dz + 3 * sz)


def vale_barrows():
    """The Crownhold barrows, below the old capital on the Crownhold road: three of the old knights' mounds, every
    one opened from the inside, their door slabs lying out on the grass. A crypt meant to be dark (no lamps).
    Ground: 82-84 round -300, -289, falling gently south."""
    d = D("vale_barrows", "rigid", seed=303, fill="dirt", top="keep", ease=4, light=False)
    fronts = [barrow(d, -7, -4, 5, 6, 5, "s", 1), barrow(d, 7, -5, 5, 6, 5, "s", 2), barrow(d, 0, 8, 4, 5, 5, "s", 3)]
    # a few old standing stones between them, leaning, and the grave-iron of the walkers' kin in the grass
    for k, (x, z) in enumerate(((-1, -6), (-12, 6), (12, 5))):
        for y in (1, 2): d.put(x, y, z, "mossy_cobblestone" if y == 1 else "cobblestone_wall")
    d.put(3, 1, 3, "iron_bars"); d.put(-4, 1, 6, "iron_trapdoor", facing="n", half="bottom")
    for x, y, z in fronts: mark(d, x, y, z + 1, "foe"); mark(d, x + 2, y, z + 2, "foe")
    return d


def vale_peg_nest():
    """The wind's nest: an old elm below Crownhold, and in the fork of its crown a nest the size of a cart, every
    stick a clothes peg (birch and oak pegs), Joan's sheet folded in the middle and her ring on it. Vines up the
    trunk's south side to climb by. Ground: 83 round -269, -273, flat to the south."""
    d = D("vale_peg_nest", "rigid", seed=304, fill="dirt", top="keep", ease=2, light=False)
    top = oak(d, 0, 0, tall=11, crown=5.5, log="dark_oak_log", leaves="dark_oak_leaves", salt=3)
    tx, ty, tz = top
    # the nest: a bowl 7 across, 2 deep, round the trunk's top, woven of fences (pegs) and trapdoors (split pegs)
    ny = ty - 1
    for x in range(-3, 4):
        for z in range(-3, 4):
            r = math.hypot(x, z)
            if r > 3.4: continue
            c = (tx + x, tz + z)
            if r > 2.3:
                d.put(c[0], ny + 1, c[1], d.pick(c[0], ny + 1, c[1], [("birch_fence", 3), ("oak_fence", 2), ("stripped_birch_log", 1)], 5))
                d.put(c[0], ny, c[1], d.pick(c[0], ny, c[1], [("stripped_birch_log", 2), ("stripped_oak_log", 1)], 6), axis="x" if abs(x) < abs(z) else "z")
                if r > 2.8 and d.r(c[0], ny + 2, c[1], 8) < 0.5:   # the rim woven higher in places
                    d.put(c[0], ny + 2, c[1], "birch_fence" if d.r(c[0], 3, c[1]) < 0.6 else "oak_fence")
            else:                                                # the bowl: pegs laid every which way
                d.put(c[0], ny, c[1], d.pick(c[0], ny, c[1], [("stripped_birch_log", 3), ("stripped_oak_log", 2), ("birch_planks", 1)], 7),
                      axis="x" if d.r(c[0], ny, c[1], 9) < 0.5 else "z")
                d.air(c[0], ny + 1, c[1]); d.air(c[0], ny + 2, c[1])
    d.air(0, ny, 1)                                           # the way up through the pegs from the vines
    for y in range(ny + 1, ny + 3):                           # room in the bowl, the crown closing over it
        for x in range(-2, 3):
            for z in range(-2, 3):
                if math.hypot(x, z) < 2.4: d.air(tx + x, y, tz + z)
    d.put(tx, ny + 1, tz, "white_carpet"); d.put(tx + 1, ny + 1, tz, "white_carpet")   # the sheet, folded
    # vines up the south face of the trunk, from the ground to the nest
    for y in range(1, ny + 1): d.put(0, y, 1, "vine", bs={"vine_direction_bits": 4})
    # pegs dropped round the foot of the tree
    for k in range(9):
        a = d.r(k, 3, 0) * math.tau; rr = 2 + 3 * d.r(k, 4, 0)
        x, z = round(math.sin(a) * rr), round(math.cos(a) * rr)
        if d.get(x, 1, z) is None: d.put(x, 1, z, "birch_button" if k % 2 else "wooden_button", bs={"facing_direction": 1})
    mark(d, tx, ny + 1, tz, "find")
    return d


def vale_sunk_bell():
    """The Harrow ferry bell, half in the silt of the Alder by the old ferry post (the Harrowford landmark stands at
    0, 0 and its jetty runs south): a patch of silt below the jetty's end with the post's old rotten stump, the
    ferry's rope rotted through, and the bell lying where the game drops it (find). Drape: on the river bed.
    Ground: the post on the bank at 87, the channel 81-82 from 8 blocks south."""
    d = D("vale_sunk_bell", "drape", seed=305, light=False)
    for x in range(-3, 4):
        for z in range(8, 15):
            if math.hypot(x, z - 11) > 3.4: continue
            d.put(x, 0, z, d.pick(x, 0, z, [("mud", 3), ("clay", 2), ("gravel", 2), ("packed_mud", 1)], 1))
    d.put(-2, 1, 10, "stripped_dark_oak_log", axis="y")           # the old post's stump, rotted off
    d.put(-1, 1, 10, "dark_oak_slab", half="bottom")
    d.put(2, 1, 12, "mossy_cobblestone"); d.put(-2, 1, 13, "mossy_cobblestone")
    d.put(1, 1, 9, "spruce_trapdoor", facing="n", half="bottom")   # a board off the old ferry
    d.put(-1, 1, 12, "moss_carpet"); d.put(1, 1, 11, "moss_carpet")
    mark(d, 0, 1, 11, "find")
    return d


def vale_lantern_line():
    """Lights on the Bellhollow road: nine candles set down on the north verge in a dead straight line, every one
    just gone out; a strip of frost along them with footprints that start at the first and stop at the last.
    Drape. The road runs ENE about 12 blocks south of the spot (map 2026-11-14: through -2, 12 heading 0.9, 0.43);
    the line keeps 4 off its edge, parallel. Dark on purpose (a night Look)."""
    d = D("vale_lantern_line", "drape", seed=306, light=False)
    ux, uz = 0.9, 0.43
    L = math.hypot(ux, uz); ux, uz = ux / L, uz / L
    ox, oz = -2 - 6.5 * -uz, 12.4 - 6.5 * ux                   # the line, 6.5 blocks off the road's middle
    cells = []
    for k in range(-12, 13, 3):
        cells.append((round(ox + ux * k), round(oz + uz * k)))
    for i, (x, z) in enumerate(cells):
        d.put(x, 1, z, "candle", bs={"lit": False, "candles": 0})
    # frost along the line, two wide on the road side; footprints are the gaps, left and right
    for k10 in range(-130, 131, 5):
        k = k10 / 10
        for s in (0.0, 1.0):
            x, z = round(ox + ux * k + uz * s), round(oz + uz * k - ux * s)
            if (x, z) in cells or d.get(x, 1, z): continue
            step = int((k + 13) * 1.4)
            foot = (-12 <= k <= 12) and ((s == 0.0 and step % 4 == 0) or (s == 1.0 and step % 4 == 2))
            if not foot: d.put(x, 1, z, "snow_layer")
    mark(d, round(ox), 1, round(oz), "look")
    return d


def vale_waystone():
    """A face off the waystone on the Wrenfield road: an old stone on the west verge, a crowned king carved on its
    road face (east), the face chiselled flat and pale; stone dust still in the grass. Ground: flat 79, the road
    4-8 blocks east of the spot running north-south."""
    d = D("vale_waystone", "rigid", seed=307, fill="dirt", top="keep", ease=2)
    for x in range(-1, 2):
        for z in range(-1, 2): d.put(x, 0, z, d.pick(x, 0, z, COBBLE))
    for z in (-1, 0, 1):                                            # the stone: 1 thick, 3 wide, 5 high, a round top
        for y in range(1, 6 if z == 0 else 5):
            d.put(0, y, z, d.pick(0, y, z, [("stone", 3), ("andesite", 2), ("mossy_cobblestone", 1)] if y < 3 else [("stone", 3), ("andesite", 2), ("tuff", 1)]))
    d.put(0, 1, 0, "chiseled_stone_bricks")                         # the king's robe
    d.put(0, 2, 0, "stone_bricks")
    d.put(0, 3, 0, "calcite")                                        # the face, fresh-cut and pale
    d.put(0, 4, -1, "chiseled_tuff"); d.put(0, 4, 0, "chiseled_tuff"); d.put(0, 4, 1, "chiseled_tuff")   # the crown
    d.put(1, 3, 0, "stone_button", bs={"facing_direction": 5})       # a chip still stuck to it
    for x, z in ((1, 1), (2, -1), (1, -2), (2, 0)):                  # stone dust in the grass
        d.put(x, 1, z, "white_carpet" if (x + z) % 2 else "light_gray_carpet")
    mark(d, 2, 1, 0, "look")
    return d


def vale_lamps():
    """The Millbrook road lamps: five Vale lamp posts on the road's verges, sides alternating, 9 apart (the street
    rule, nothing closer than 7), and the lamplighter's box by the middle one. The road runs north-south about 9
    east of the spot (map 2026-11-14: x = 9.2 - 0.11 z), 6 wide. Drape. Lit by its own lamps."""
    d = D("vale_lamps", "drape", seed=308, light=False)
    for i, z in enumerate((-18, -9, 0, 9, 18)):
        rx = round(9.2 - 0.11 * z)
        x = rx - 5 if i % 2 == 0 else rx + 5
        lx, ly, lz = lamp_post(d, x, z)
        mark(d, lx, ly, lz, "lamp")
    rx = round(9.2)
    d.put(rx - 6, 1, 1, "barrel", bs={"facing_direction": 1})        # the lamplighter's box and his oil
    d.put(rx - 6, 1, 2, "spruce_slab", half="bottom")
    return d


def vale_fold():
    """Abel's fold on the hill above Millbrook: a dry-stone ring 15 x 13 with a gate to the south, a shepherd's
    lean-to inside the north wall (bench, lantern, crook, a bale), a trough and hay. Ground: 99-101 round 30, -561,
    a broad hilltop."""
    d = D("vale_fold", "rigid", seed=309, fill="dirt", top="keep", ease=3)
    R = ring(7, 6)
    for x, z in R:
        if z == 6 and abs(x) <= 1: continue
        d.put(x, 1, z, d.pick(x, 1, z, COBBLE, 1))
        d.put(x, 2, z, "cobblestone_wall" if d.r(x, 2, z) < 0.6 else "mossy_cobblestone_wall")
    d.put(0, 1, 6, "spruce_fence_gate", bs={"direction": 0})
    d.put(-1, 1, 6, "spruce_fence"); d.put(1, 1, 6, "spruce_fence")
    for x in range(-6, 7):                                         # trodden ground and droppings of hay
        for z in range(-5, 6):
            if (x / 6.5) ** 2 + (z / 5.5) ** 2 < 1 and d.r(x, 0, z) < 0.3:
                d.put(x, 0, z, "coarse_dirt" if d.r(x, 1, z) < 0.6 else "grass_path")
    # the lean-to against the north wall: a back wall, two posts, a roof falling from the wall to the posts
    d.box(-4, 1, -5, 4, 3, -5, "cobblestone")
    for x in (-4, 4): d.box(x, 1, -4, x, 2, -3, "spruce_planks")     # the ends, boarded
    for x in (-3, 3): post(d, x, -2, 2, "stripped_spruce_log")
    for x in range(-5, 6):
        d.put(x, 4, -5, "spruce_stairs", facing="s")
        d.put(x, 3, -4, "spruce_stairs", facing="s")
        d.put(x, 3, -3, "spruce_slab", half="top")
        d.put(x, 3, -2, "spruce_slab", half="bottom")
    d.put(-2, 1, -4, "spruce_stairs", facing="s"); d.put(-1, 1, -4, "spruce_stairs", facing="s")
    d.put(1, 1, -4, "hay_block", axis="x"); d.put(2, 1, -4, "barrel", bs={"facing_direction": 1})
    d.put(0, 2, -3, "lantern", hanging=True)
    d.put(0, 1, -4, "spruce_fence")                               # the crook, propped
    d.put(-4, 1, 2, "cauldron", bs={"fill_level": 6, "cauldron_liquid": "water"})   # trough
    d.put(4, 1, 2, "hay_block", axis="y"); d.put(4, 1, 1, "hay_block", axis="z")
    for x, z in ((-2, 0), (0, 1), (2, -1), (-1, 3), (3, 3), (-4, -1)): mark(d, x, 1, z, "sheep")
    return d


def vale_cold_camp():
    """The traveller's cold camp in the ravens' copse west of Millbrook: a lean-to of poles and boards, a bedroll,
    his pack (where the raven sits and the note is), a fire long dead. Ground: 80-81 round -180, -509, the copse.
    Not lit (a cold camp, its fire out: you find it by day)."""
    d = D("vale_cold_camp", "rigid", seed=310, fill="dirt", top="keep", ease=2, light=False)
    for x in (-2, 2):
        d.put(x, 1, -2, "spruce_fence"); d.put(x, 2, -2, "spruce_fence")
    for x in range(-2, 3):
        d.put(x, 3, -2, "spruce_slab", half="bottom")
        d.put(x, 2, -3, "spruce_trapdoor", facing="s", half="top")
        d.put(x, 1, -3, "spruce_planks")
    d.put(-1, 1, -1, "brown_carpet"); d.put(-1, 1, -2, "brown_carpet")       # bedroll
    d.put(1, 1, -1, "barrel", bs={"facing_direction": 1})                     # the pack
    fire_ring(d, 0, 2, lit=False, seats=False)
    d.put(-3, 1, 2, "oak_log", axis="z")
    mark(d, 1, 2, -1, "look")
    return d



# ---------------------------------------------------------------- pieces shared by the other regions

def ground_patch(d, rx, rz, mix, density=0.35, salt=0):
    """Trodden ground inside an ellipse (y 0, the ground's own top)."""
    for x in range(-rx, rx + 1):
        for z in range(-rz, rz + 1):
            if (x / (rx + 0.5)) ** 2 + (z / (rz + 0.5)) ** 2 < 1 and d.r(x, 0, z, salt) < density:
                d.put(x, 0, z, d.pick(x, 0, z, mix, salt + 1))


def snow_cover(d, R, density=0.7, keep_out=lambda x, z: False, salt=0, y=1):
    """Snow lying on the ground round a site (snow_layer, height 0), where nothing else stands."""
    for x in range(-R, R + 1):
        for z in range(-R, R + 1):
            if math.hypot(x, z) > R + 0.4 or keep_out(x, z) or d.get(x, y, z): continue
            if d.r(x, 3, z, salt) < density: d.put(x, y, z, "snow_layer")


def raider_camp(d, S, rx=11, rz=9, gap="s", tents=((-6, -4, "e"), (6, -4, "w"), (-5, 4, "n")), tower=(6, 2), fire=(0, 0), salt=0):
    """The raiders' camp every region shares in shape (Mateo: "these raiders and their camps have 3D builds"): a ring of
    sharpened stakes with a gap toward the road, tents of whatever cloth they took, a lookout with their rag on it and the
    fire in the middle. Each camp adds what makes it that camp."""
    R = ring(rx, rz)
    side = {"s": lambda c: c[1] > rz - 3 and abs(c[0]) <= 2, "n": lambda c: c[1] < 3 - rz and abs(c[0]) <= 2,
            "e": lambda c: c[0] > rx - 3 and abs(c[1]) <= 2, "w": lambda c: c[0] < 3 - rx and abs(c[1]) <= 2}
    gaps = set()
    for g in gap: gaps |= {c for c in R if side[g](c)}
    stakes(d, R, gaps=gaps, salt=salt, S=S)
    ground_patch(d, rx - 1, rz - 1, S["ground"], salt=salt)
    fire_ring(d, *fire, S=S)
    for k, (x, z, f) in enumerate(tents): tent(d, x, z, f, S["canvas"], salt + k, S=S)
    if tower: lookout(d, *tower, S=S)
    return R


def foes(d, spots):
    for x, z in spots: mark(d, x, 1, z, "foe")


def pen(d, S, rx=7, rz=6, wall=None, gate="s", salt=0):
    """A stock pen: a dry-stone (or rail) ring with a gate, trodden ground, and a lean-to inside the far wall."""
    R = ring(rx, rz)
    gz = rz if gate == "s" else -rz
    for x, z in R:
        if z == gz and abs(x) <= 1: continue
        if wall:
            d.put(x, 1, z, d.pick(x, 1, z, wall, salt))
            d.put(x, 2, z, S["foot"] if d.r(x, 2, z, salt) < 0.7 else S["fence"])
        else:
            d.put(x, 1, z, S["fence"])
    d.put(0, 1, gz, S["fence"] + "_gate" if S["fence"] != "oak_fence" else "fence_gate", bs={"direction": 0})
    d.put(-1, 1, gz, S["fence"]); d.put(1, 1, gz, S["fence"])
    ground_patch(d, rx - 1, rz - 1, S["ground"], density=0.3, salt=salt)
    # the lean-to against the far wall: a back wall, two posts, a roof falling from the wall to the posts
    b = -rz + 1
    d.box(-4, 1, b, 4, 3, b, S["planks"])
    for x in (-4, 4): d.box(x, 1, b + 1, x, 2, b + 2, S["planks"])
    for x in (-3, 3): post(d, x, b + 3, 2, S["slog"])
    for x in range(-5, 6):
        d.put(x, 4, b, S["stairs"], facing="s")
        d.put(x, 3, b + 1, S["stairs"], facing="s")
        d.put(x, 3, b + 2, S["slab"], half="top")
        d.put(x, 3, b + 3, S["slab"], half="bottom")
    d.put(-2, 1, b + 1, S["stairs"], facing="s"); d.put(-1, 1, b + 1, S["stairs"], facing="s")   # the bench
    d.put(1, 1, b + 1, "hay_block", axis="x"); d.put(2, 1, b + 1, "barrel", bs={"facing_direction": 1})
    d.put(0, 2, b + 2, "lantern", hanging=True)
    return b


def flock(d, spots):
    for x, z in spots: mark(d, x, 1, z, "sheep")


def road_lamps(d, S, ox, oz, ux, uz, n=5, gap=9, off=5):
    """Lamps along a road (the street rule: on the verges, sides alternating, `gap` apart, never closer than 7).
    (ox, oz) a point on the road's middle, (ux, uz) its heading."""
    L = math.hypot(ux, uz); ux, uz = ux / L, uz / L
    out = []
    for i in range(n):
        k = (i - (n - 1) / 2) * gap
        sgn = 1 if i % 2 == 0 else -1
        x, z = round(ox + ux * k - uz * off * sgn), round(oz + uz * k + ux * off * sgn)
        out.append(lamp_post(d, x, z, S=S))
    for lx, ly, lz in out: mark(d, lx, ly, lz, "lamp")
    return out


def lamp_ring(d, S, n, r, y0=1, start=0.0):
    out = []
    for i in range(n):
        a = start + i * math.tau / n
        out.append(lamp_post(d, round(math.sin(a) * r), round(-math.cos(a) * r), y0=y0, S=S))
    for lx, ly, lz in out: mark(d, lx, ly, lz, "lamp")
    return out


def basin(d, cells, rim, depth=1, floor="dirt"):
    """Water held in the ground (house rule: water in its basin): every water cell has water or a solid block on all
    four sides and under it. cells: (x, z) of the water; rim: the block round it."""
    cs = set(cells)
    for x, z in cs:
        for y in range(1 - depth, 1): d.put(x, y, z, "water")
        d.put(x, -depth, z, floor)
        for dx, dz in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            c = (x + dx, z + dz)
            if c not in cs:
                for y in range(-depth, 1): d.put(c[0], y, c[1], rim if y == 0 else "dirt")


def disc(r, cx=0, cz=0):
    return [(x, z) for x in range(cx - int(r) - 1, cx + int(r) + 2) for z in range(cz - int(r) - 1, cz + int(r) + 2) if math.hypot(x - cx, z - cz) <= r]


def boulder(d, cx, cz, r, mix, tall=2, salt=0):
    for x, z in disc(r, cx, cz):
        top = max(1, round(tall * (1 - (math.hypot(x - cx, z - cz) / (r + 0.6)) ** 2)) + (d.r(x, 0, z, salt) < 0.3))
        for y in range(1, top + 1): d.put(x, y, z, d.pick(x, y, z, mix, salt))


def gable_shed(d, S, x0, z0, x1, z1, wall, roof=("spruce_stairs", "dark_oak_stairs"), door="e", h=3, salt=0):
    """A small pitched building on the skill's rules: a plinth course, walls `h` high, a roof falling both ways from a
    ridge along z with a one-block overhang, a 1-wide doorway on the `door` side, glass flush in the long walls."""
    for x in range(x0, x1 + 1):
        for z in range(z0, z1 + 1):
            edge = x in (x0, x1) or z in (z0, z1)
            d.put(x, 0, z, d.pick(x, 0, z, S["stone"], salt))
            for y in range(1, h + 1):
                if edge: d.put(x, y, z, d.pick(x, y, z, S["stone"], salt) if y == 1 else wall)
                else: d.air(x, y, z)
    for z in (z0, z1):                                     # corner posts
        for x in (x0, x1):
            for y in range(1, h + 1): d.put(x, y, z, S["log"], axis="y")
    cx, cz = (x0 + x1) // 2, (z0 + z1) // 2
    if door == "e": dx, dz = x1, cz
    elif door == "w": dx, dz = x0, cz
    elif door == "s": dx, dz = cx, z1
    else: dx, dz = cx, z0
    d.air(dx, 1, dz); d.air(dx, 2, dz)
    for z in (z0 + 2, z1 - 2):
        if z != dz or door in "ns": d.put(x0, 2, z, "glass_pane"); d.put(x1, 2, z, "glass_pane") if not (door == "e" and z == dz) else None
    half = (x1 - x0) // 2 + 1
    for k in range(half + 1):
        y = h + 1 + k
        for z in range(z0 - 1, z1 + 2):
            for x, f in ((x0 - 1 + k, "e"), (x1 + 1 - k, "w")):
                if x0 - 1 + k > x1 + 1 - k: continue
                if x0 - 1 + k == x1 + 1 - k: d.put(x, y, z, S["slab"], half="bottom"); continue
                d.put(x, y, z, d.pick(x, y, z, [(roof[0], 3), (roof[1], 2)], salt + 9), facing=f)
                if k and x not in (x0 - 1, x1 + 1):
                    if z in (z0, z1): d.put(x, y - 1, z, wall)   # gable wall up under the roof
    return dx, dz


# ---------------------------------------------------------------- Frostmarch

F = STYLE["frost"]


def frost_wolf_den():
    """The rimewolves' den on the Hound's Back: a knot of deepslate boulders round a low rock hollow, gnawed bones in the
    snow, the traps Hakon set laid out in a row. Ground: flat 114 round -175, -1194, open moor."""
    d = D("frost_wolf_den", "rigid", seed=401, fill="dirt", top="keep", ease=3, light=False)
    rock = [("cobbled_deepslate", 3), ("stone", 2), ("andesite", 2), ("tuff", 1)]
    boulder(d, -4, -2, 3.2, rock, 4, 1); boulder(d, 3, -4, 2.6, rock, 3, 2); boulder(d, 5, 2, 2.0, rock, 2, 3)
    for x in range(-5, -2):                                 # the hollow under the big rock
        for z in range(-2, 1): d.air(x, 1, z); d.air(x, 2, z)
    d.put(-4, 0, -1, "podzol"); d.put(-4, 1, -1, "brown_carpet")
    for x, z, ax in ((0, 3, "x"), (-2, 4, "z"), (2, -1, "x")): d.put(x, 1, z, "bone_block", axis=ax)
    for k in range(4): d.put(-3 + 2 * k, 1, 6, "iron_trapdoor", facing="n", half="bottom")   # the sprung traps, in a row
    snow_cover(d, 10, 0.75, salt=1)
    foes(d, ((0, 0), (-1, 3), (2, 1), (-6, 3), (4, -1)))
    return d


def frost_sled_camp():
    """Olaf's old sled-shed on the south road, taken: the shed (spruce on a deepslate plinth, a ridge roof, the bench and
    spare runners inside), two big badly-made sleds outside with their runners on backwards, tents, stakes on the
    north and west, the fire. The road runs north-south 9 east of the spot. Ground: flat 117 round -130, -1002."""
    d = D("frost_sled_camp", "rigid", seed=402, fill="dirt", top="keep", ease=3)
    raider_camp(d, F, 11, 9, gap="e", tents=((-6, 3, "e"), (-1, 6, "n")), tower=None, fire=(2, 2), salt=2)
    gable_shed(d, F, -9, -8, -3, -2, "spruce_planks", roof=("deepslate_tile_stairs", "cobbled_deepslate_stairs"), door="e", salt=2)
    d.put(-7, 1, -7, "crafting_table"); d.put(-7, 1, -6, "barrel", bs={"facing_direction": 1})
    for z in (-6, -5, -4): d.put(-5, 1, z, "stripped_spruce_log", axis="z")       # spare runners on the floor
    d.put(-7, 1, -3, "spruce_stairs", facing="e")                                   # Olaf's stool
    for sx, sz in ((4, -5), (5, 5)):                                                 # the sleds: runners, a deck, a crate
        for z in range(sz - 2, sz + 3):
            d.put(sx - 1, 1, z, "spruce_fence"); d.put(sx + 1, 1, z, "spruce_fence")
            d.put(sx - 1, 2, z, "spruce_slab", half="bottom"); d.put(sx, 2, z, "spruce_slab", half="bottom"); d.put(sx + 1, 2, z, "spruce_slab", half="bottom")
        d.put(sx - 1, 1, sz + 3, "spruce_trapdoor", facing="s", half="top")            # the runner's curl, the wrong end
        crate(d, sx, sz, 3)
    snow_cover(d, 12, 0.55, salt=2)
    foes(d, ((2, -1), (-1, 2), (5, 0), (0, -5), (8, 2), (-4, 0)))
    return d


def frost_pass_camp():
    """The raiders' camp in the pass below the old border watchtower: stakes, three tents, a lookout on the rocks, the
    carts they stopped stripped to the boards and the drivers' boots in a heap. Ground: 130-131 round -87, -736."""
    d = D("frost_pass_camp", "rigid", seed=403, fill="dirt", top="keep", ease=3)
    raider_camp(d, F, 11, 9, gap="w", salt=3)
    rock = [("cobbled_deepslate", 3), ("stone", 2), ("andesite", 1)]
    boulder(d, 8, -6, 2.4, rock, 3, 3)
    for x in range(-2, 3): d.put(x, 1, -6, "spruce_slab", half="top" if x in (-2, 2) else "bottom")   # a stripped cart
    d.put(-2, 0, -6, "cobbled_deepslate"); d.put(2, 0, -6, "cobbled_deepslate")
    d.put(-3, 1, -6, "spruce_fence")
    crate(d, 0, -7); crate(d, 1, -7); d.put(-1, 1, -7, "chest", facing="s")
    for x, z in ((-3, 2), (-2, 2), (-3, 3)): d.put(x, 1, z, "brown_carpet")           # the boots
    snow_cover(d, 12, 0.5, salt=3)
    foes(d, ((0, -2), (-3, 1), (3, 1), (-8, -1), (-8, 1), (3, -2), (-4, -2)))
    return d


def frost_old_working():
    """The old copper working off the Deepforge road: a timber headframe over a shaft, a ladder down six, and at the
    bottom a tidy chamber cut in green copper, a cart of ore on its rails, every tool stood in a row along the wall.
    Dark (Torvald: "very tidy dark"). Ground: 179 round -212, -875 on the climb to the Deepforge."""
    d = D("frost_old_working", "rigid", seed=404, fill="dirt", top="keep", ease=3, light=False)
    wall = [("stone", 3), ("copper_ore", 2), ("oxidized_copper", 1), ("weathered_copper", 1), ("deepslate", 1)]
    for x in range(-2, 3):                                   # the collar round the shaft
        for z in range(-2, 3):
            d.put(x, 0, z, d.pick(x, 0, z, F["stone"]))
    for y in range(-6, 1):                                   # the shaft, 1 x 1 with its ladder
        for x in range(-1, 2):
            for z in range(-1, 2):
                if (x, z) == (0, 0): d.air(0, y, 0)
                elif y < 0: d.put(x, y, z, d.pick(x, y, z, wall, 1))
    for y in range(-6, 1): d.put(0, y, 0, "ladder", bs={"facing_direction": 2})
    d.put(0, 0, 1, "cobbled_deepslate")
    for x, z in ((-2, -2), (2, -2), (-2, 2), (2, 2)): post(d, x, z, 4, "stripped_spruce_log")
    for x in range(-2, 3): d.put(x, 5, -2, "spruce_log", axis="x"); d.put(x, 5, 2, "spruce_log", axis="x")
    for z in range(-1, 2): d.put(0, 5, z, "spruce_log", axis="z")
    d.put(0, 4, 0, "iron_chain", axis="y")
    # the chamber at the bottom: 5 wide, 7 long, 3 high, to the north of the shaft
    for x in range(-3, 4):
        for z in range(-8, 1):
            for y in range(-8, -3):
                inside = abs(x) < 3 and -8 < z < 0 and -8 < y < -4
                if inside: d.air(x, y, z)
                elif (x, z) != (0, 0): d.put(x, y, z, d.pick(x, y, z, wall, 2))
    d.air(0, -7, -1); d.air(0, -6, -1)
    for y in (-7, -6): d.air(0, y, 0)
    for z in range(-6, -1): d.put(-1, -7, z, "rail")
    d.put(-1, -7, -6, "raw_copper_block"); d.put(-1, -6, -6, "copper_ore")      # the cart's load
    for k, z in enumerate(range(-7, -1)): d.put(2, -7, z, "lightning_rod")      # the tools, stood in a row
    mark(d, 0, -7, -3, "find")
    return d


def frost_black_spruce():
    """The biggest of the black spruces on the ridge: a trunk two blocks square, a dark cone of needles, a ring of bare
    ground round its foot where the snow will not lie, and the cut where Gunnar's axe went in, grown over.
    Ground: flat 118 round -277, -1200."""
    d = D("frost_black_spruce", "rigid", seed=405, fill="dirt", top="keep", ease=2, light=False)
    H = 17
    for y in range(1, H):
        for x, z in ((0, 0), (1, 0), (0, 1), (1, 1)): d.put(x, y, z, "spruce_log", axis="y")
    d.put(0, 2, 0, "stripped_spruce_log", axis="y")                                # the cut, closed over
    for y in range(5, H + 2):                                                       # the cone
        r = max(0.8, (H + 2 - y) * 0.36)
        for x in range(-6, 8):
            for z in range(-6, 8):
                if d.get(x, y, z): continue
                dd = math.hypot(x - 0.5, z - 0.5)
                if dd <= r and (y % 3 != 1 or dd <= r - 1.2): d.put(x, y, z, "spruce_leaves")
    d.put(0, H + 2, 0, "spruce_leaves"); d.put(1, H + 2, 1, "spruce_leaves")
    for x, z in disc(4.5, 0, 0):
        if d.get(x, 1, z) is None: d.put(x, 0, z, "podzol" if d.r(x, 0, z) < 0.6 else "coarse_dirt")
    snow_cover(d, 10, 0.85, keep_out=lambda x, z: math.hypot(x - 0.5, z - 0.5) < 5.2, salt=5)
    mark(d, 0, 1, 3, "find")
    return d


def frost_lake_ring():
    """The ring on the north shore of the lake: snow over the bank, and a perfect ring of bare wet ground in it, wider
    than a house, with a patch of humming ice at its middle. Drape. Dark (a night Look). Ground: 114, the lake 6 south."""
    d = D("frost_lake_ring", "drape", seed=406, light=False)
    for x in range(-10, 11):
        for z in range(-10, 11):
            r = math.hypot(x, z)
            if r > 10.4: continue
            if 5.4 <= r <= 7.0: d.put(x, 0, z, "mud" if d.r(x, 0, z) < 0.7 else "packed_mud")
            elif r < 1.6: d.put(x, 0, z, "packed_ice")
            elif d.r(x, 1, z) < 0.9: d.put(x, 1, z, "snow_layer")
    mark(d, 0, 1, 6, "look")
    return d


def frost_stag_tracks():
    """The goat path above the lake: a strip of fresh snow up the path; a stag's paired hoof-prints climb it and halfway up
    turn into a man's bare feet. Drape. Ground: 116, a gentle rise north."""
    d = D("frost_stag_tracks", "drape", seed=407)
    for z in range(-13, 14):
        for x in range(-2, 3):
            hoof = z > 0 and z % 3 == 0 and x in (-1, 0)
            foot = z <= 0 and ((z % 4 == 0 and x == -1) or (z % 4 == 2 and x == 1))
            if not (hoof or foot): d.put(x, 1, z, "snow_layer")
    for x, z in ((3, -6), (-3, 4), (3, 9)): d.put(x, 1, z, "sweet_berry_bush" if False else "fern")
    mark(d, 0, 1, 0, "look")
    return d


def frost_ice_holes():
    """The fishing holes on the west shore: a sheet of ice laid on the bank with three holes cut through to water, a
    stool and a fish crate, and four lamps on poles round it (Bjorna's lamps, the ones the watch keeps lit). Drape.
    Ground: 114, the lake 5 east."""
    d = D("frost_ice_holes", "drape", seed=408, light=False)
    holes = [(-2, -1), (1, 1), (2, -2)]
    for x in range(-4, 5):
        for z in range(-3, 4):
            if (x, z) in holes:
                d.put(x, 0, z, "water"); d.put(x, -1, z, "packed_ice")
            else: d.put(x, 0, z, "ice" if d.r(x, 0, z) < 0.6 else "packed_ice")
    d.put(-3, 1, 2, "spruce_stairs", facing="e"); d.put(3, 1, 2, "barrel", bs={"facing_direction": 1})
    lamp_ring(d, F, 4, 6, start=math.pi / 4)
    snow_cover(d, 9, 0.6, keep_out=lambda x, z: abs(x) <= 4 and abs(z) <= 3, salt=8)
    return d


def frost_goat_pen():
    """Astrid's goat pen on the high pasture: a dry-stone ring of deepslate, a gate south, a lean-to on the north wall
    with a bench, a bale and a lantern. Ground: flat 118 round -277, -1097."""
    d = D("frost_goat_pen", "rigid", seed=409, fill="dirt", top="keep", ease=3)
    pen(d, F, 7, 6, wall=[("cobbled_deepslate", 3), ("cobblestone", 2), ("mossy_cobblestone", 1)], salt=9)
    d.put(-4, 1, 2, "cauldron", bs={"fill_level": 6, "cauldron_liquid": "water"})
    d.put(4, 1, 2, "hay_block", axis="y")
    snow_cover(d, 11, 0.5, keep_out=lambda x, z: (x / 7.5) ** 2 + (z / 6.5) ** 2 < 1, salt=9)
    flock(d, ((-2, 0), (0, 1), (2, -1), (-1, 3), (3, 3), (-4, -1)))
    return d


def frost_bothy():
    """The shepherd's bothy on the south road: a one-room stone hut, the door shut, a laid fire never lit, a horn of mead
    on the table under a skin of ice, a straw bed, frost inside the door. Dark on purpose (nobody has lit it).
    Ground: 98 round -107, -913, the road 7 east."""
    d = D("frost_bothy", "rigid", seed=410, fill="dirt", top="keep", ease=2, light=False)
    gable_shed(d, F, -3, -3, 3, 3, "cobbled_deepslate", roof=("spruce_stairs", "dark_oak_stairs"), door="e", salt=10)
    d.put(3, 1, 0, "spruce_door", bs={"direction": 2, "upper_block_bit": False}); d.put(3, 2, 0, "spruce_door", bs={"direction": 2, "upper_block_bit": True})
    d.put(-2, 1, 0, "campfire", bs={"extinguished": True}); d.put(-3, 1, 0, "cobbled_deepslate")
    d.put(0, 1, -2, "spruce_fence"); d.put(0, 2, -2, "spruce_pressure_plate" if False else "spruce_slab", half="bottom")
    d.put(0, 3, -2, "air")
    d.put(1, 1, -2, "spruce_stairs", facing="w")
    d.put(-1, 1, 2, "hay_block", axis="x"); d.put(0, 1, 2, "hay_block", axis="x")
    d.put(2, 1, 1, "snow_layer"); d.put(2, 1, -1, "snow_layer")
    d.put(0, 2, -2, "spruce_slab", half="bottom")
    snow_cover(d, 8, 0.6, keep_out=lambda x, z: abs(x) <= 4 and abs(z) <= 4, salt=10)
    mark(d, 5, 1, 0, "look")
    return d


# ---------------------------------------------------------------- Saltreach

SA = STYLE["salt"]


def salt_westwatch_camp():
    """The raiders squatting in the Westwatch (Mateo asked for these by name): their camp on the land side of the old
    quay (the quay and its dark lighthouse stand 40 west and are left as they are), stakes of driftwood, tents of
    sailcloth, an upturned boat for a roof, nets on poles, a lookout. Ground: 68 round -818, 314."""
    d = D("salt_westwatch_camp", "rigid", seed=501, fill="dirt", top="keep", ease=3)
    raider_camp(d, SA, 11, 9, gap="w", tents=((6, -4, "w"), (-5, 5, "n")), tower=(6, 3), salt=1)
    for x in range(-7, -2):                                   # the upturned boat, keel up, a fire-hole at the end
        d.put(x, 1, -5, "birch_stairs", facing="s", half="top"); d.put(x, 1, -3, "birch_stairs", facing="n", half="top")
        d.put(x, 2, -4, "birch_planks")
    d.put(-2, 1, -4, "birch_trapdoor", facing="e", half="bottom")
    for x in (-8, -4):                                       # nets on poles
        d.put(x, 1, 1, "birch_fence"); d.put(x, 2, 1, "birch_fence")
    for x in range(-7, -4): d.put(x, 2, 1, "web")
    crate(d, 1, -6); crate(d, 2, -6); d.put(3, 1, -6, "chest", facing="s")
    foes(d, ((0, -2), (-3, 2), (3, 1), (-9, 0), (-8, -2), (2, 4), (-4, -1)))
    return d


def salt_wreckers_camp():
    """The wreckers on Gannet Strand: a tall pole with a lantern swung from an arm on a chain (the false light), the
    salvage piled up, a broken mast on the sand, tents, stakes on the land side only. Ground: 63, the sea 5 south."""
    d = D("salt_wreckers_camp", "rigid", seed=502, fill="sand", top="keep", ease=3)
    raider_camp(d, SA, 11, 9, gap="s", tents=((-6, -4, "e"), (6, -4, "w")), tower=None, salt=2)
    for y in range(1, 8): d.put(0, y, 6, "stripped_oak_log", axis="y")      # the false light
    d.put(0, 7, 5, "oak_fence"); d.put(0, 6, 5, "iron_chain", axis="y"); d.put(0, 5, 5, "lantern", hanging=True)
    for x in range(-6, 1): d.put(x, 1, 3, "stripped_oak_log", axis="x")     # the broken mast
    for x, z in ((4, 2), (5, 3), (4, 3), (-3, -6), (-2, -6)): crate(d, x, z)
    d.put(5, 2, 3, "barrel", bs={"facing_direction": 2}); d.put(3, 1, -6, "chest", facing="s")
    foes(d, ((0, -2), (-3, 1), (3, 0), (1, 4), (-1, 7), (4, -2)))
    return d


def salt_eel_rocks():
    """The Eel Rocks: a run of wet rocks on the shore, Fergus's lobster pots on them, bitten floats, a coil of rope.
    Drape. Ground: 63, the sea 5 north-west."""
    d = D("salt_eel_rocks", "drape", seed=503, light=False)
    rock = [("andesite", 3), ("stone", 2), ("cobblestone", 1), ("mossy_cobblestone", 1)]
    boulder(d, -3, -2, 2.6, rock, 2, 1); boulder(d, 3, 1, 2.2, rock, 2, 2); boulder(d, -1, 4, 1.6, rock, 1, 3)
    for x, z in ((-1, -2), (3, 3), (0, 6)): d.put(x, 2 if d.get(x, 1, z) else 1, z, "barrel", bs={"facing_direction": 1})
    for x, z in ((1, -1), (-4, 1)): d.put(x, 1, z, "orange_carpet")
    mark(d, 0, 1, 0, "foe"); mark(d, 4, 1, -2, "foe"); mark(d, -4, 1, 3, "foe")
    return d


def salt_annets_strand():
    """Where Annet walked: on the dry sand above the tide line a ring of pebbles, very neat, and the locket at its middle
    (where the game drops it). Drape. Ground: 64, the sea 5 south."""
    d = D("salt_annets_strand", "drape", seed=504, light=False)
    for x, z in disc(4.5):
        d.put(x, 0, z, "sand")
    for k in range(14):
        a = k * math.tau / 14
        d.put(round(math.sin(a) * 2.6), 1, round(math.cos(a) * 2.6), "stone_button", bs={"facing_direction": 1})
    for x, z in ((4, -3), (-4, 2)): d.put(x, 1, z, "dried_kelp_block")
    mark(d, 0, 1, 0, "find")
    return d


def salt_kings_barrel():
    """The shingle north of the harbour: grey stones, driftwood, weed, and where the barrel lies (the game drops it there),
    an old hoop come off it. Drape. Ground: 64, the sea 5 west."""
    d = D("salt_kings_barrel", "drape", seed=505, light=False)
    for x, z in disc(5):
        d.put(x, 0, z, d.pick(x, 0, z, [("gravel", 4), ("cobblestone", 1), ("andesite", 1)]))
    for x in range(-4, 0): d.put(x, 1, -3, "stripped_oak_log", axis="x")
    d.put(3, 1, 2, "stripped_birch_log", axis="z"); d.put(3, 1, 3, "stripped_birch_log", axis="z")
    for x, z in ((-2, 3), (2, -2)): d.put(x, 1, z, "dried_kelp_block")
    d.put(1, 1, 1, "iron_chain", axis="x")
    mark(d, 0, 1, 0, "find")
    return d


def salt_bride_strand():
    """The strand below the dunes: a line of small bare footprints up out of the surf to a driftwood post, and a wet veil
    hung on it. The prints don't go back. Drape. Dark (a night Look). Ground: 65, the sea 5 west."""
    d = D("salt_bride_strand", "drape", seed=506, light=False)
    for z in range(-3, 4):
        for x in range(-7, 4): d.put(x, 0, z, "sand")
    for k, x in enumerate(range(-7, 1)): d.put(x, 0, -1 if k % 2 else 0, "packed_mud" if False else "sandstone")
    for y in (1, 2, 3): d.put(1, y, 0, "stripped_birch_log", axis="y")
    d.put(1, 3, -1, "web"); d.put(1, 2, -1, "web")
    mark(d, 0, 1, 1, "look")
    return d


def salt_gull_head():
    """The top of Gull Head: an old stone cairn, a weather-worn bench, a dead beacon on its plinth, the whole bay below.
    Ground: 79 round -695, 399."""
    d = D("salt_gull_head", "rigid", seed=507, fill="dirt", top="keep", ease=2, light=False)
    boulder(d, 0, -2, 1.6, [("cobblestone", 3), ("andesite", 2), ("mossy_cobblestone", 1)], 3, 1)
    d.put(0, 4, -2, "cobblestone_wall")
    for x in (-1, 0, 1): d.put(x, 1, 2, "birch_stairs", facing="s")
    d.box(3, 1, -1, 3, 1, 1, "stone_bricks"); d.put(3, 2, 0, "campfire", bs={"extinguished": True})
    mark(d, 0, 1, 4, "look")
    return d


def salt_cliff_lamps():
    """The lamps on the cliff road's bad bends: five on the verges, sides alternating, and the lamp-man's oil box.
    The road runs WNW-ESE about 9 south of the spot (map 2026-11-14: through -0.5, 10.1 heading 0.88, -0.47). Drape."""
    d = D("salt_cliff_lamps", "drape", seed=508, light=False)
    road_lamps(d, SA, -0.5, 10.1, 0.88, -0.47)
    d.put(-2, 1, 3, "barrel", bs={"facing_direction": 1}); d.put(-1, 1, 3, "birch_slab", half="bottom")
    return d


def salt_dune_fold():
    """The farmer's fold on the dune pasture: a rail of birch fence round the salt grass, a gate, the lean-to, a trough.
    Ground: 77 round -618, 480."""
    d = D("salt_dune_fold", "rigid", seed=509, fill="dirt", top="keep", ease=3)
    pen(d, SA, 7, 6, wall=None, salt=3)
    d.put(-4, 1, 2, "cauldron", bs={"fill_level": 6, "cauldron_liquid": "water"})
    flock(d, ((-2, 0), (0, 1), (2, -1), (-1, 3), (3, 3), (-4, -1)))
    return d


# ---------------------------------------------------------------- Emberwaste

E = STYLE["ember"]


def ember_caravan_camp():
    """The raiders astride the caravan road south of Sunscar: their fire on the road itself, a ring of stakes open to the
    road both ways, tents of stolen rugs, the water they took in jars and barrels, a lookout. The road runs north-south
    through the middle. Ground: 86 round 882, 573."""
    d = D("ember_caravan_camp", "rigid", seed=601, fill="sandstone", top="keep", ease=3)
    raider_camp(d, E, 11, 9, gap="ns", tents=((-6, -4, "e"), (6, -4, "w"), (-6, 4, "e")), tower=(6, 3), salt=1)
    for x, z in ((-2, -6), (-1, -6), (2, 6), (3, 5)): d.put(x, 1, z, "decorated_pot")
    for x, z in ((2, -6), (-3, 6), (-2, 6)): crate(d, x, z)
    d.put(1, 1, -6, "barrel", bs={"facing_direction": 2})
    foes(d, ((0, -2), (-3, 1), (3, 0), (0, 8), (0, -8), (4, -2), (-4, -1)))
    return d


def ruin_wall(d, a, b, base, var, mix, salt=0):
    (x0, z0), (x1, z1) = a, b
    n = max(abs(x1 - x0), abs(z1 - z0))
    for k in range(n + 1):
        x = round(x0 + (x1 - x0) * k / max(n, 1)); z = round(z0 + (z1 - z0) * k / max(n, 1))
        top = base - int(var * d.r(x // 2, 77, z // 2, salt) ** 1.3)
        for y in range(1, top + 1): d.put(x, y, z, d.pick(x, y, z, mix, salt))


def ember_serai_camp():
    """The old caravanserai east of town, roofless, its cistern still holding rain, with the raiders camped in its court:
    broken sandstone walls round a square yard, an arch where the gate was, the cistern and its rim in the middle,
    tents, barrels being filled. Ground: 95 round 1060, 521."""
    d = D("ember_serai_camp", "rigid", seed=602, fill="sandstone", top="keep", ease=3)
    mix = [("sandstone", 4), ("smooth_sandstone", 2), ("cut_sandstone", 1), ("red_sandstone", 1)]
    for a, b in (((-10, -10), (10, -10)), ((10, -10), (10, 10)), ((-10, 10), (-3, 10)), ((3, 10), (10, 10)), ((-10, -10), (-10, 10))):
        ruin_wall(d, a, b, 5, 4, mix, 1)
    for x in (-2, 2):
        for y in range(1, 5): d.put(x, y, 10, "cut_sandstone")
    for x in range(-2, 3): d.put(x, 5, 10, "chiseled_sandstone" if x == 0 else "cut_sandstone")
    ground_patch(d, 9, 9, E["ground"], 0.3, 2)
    cis = disc(1.6)
    basin(d, cis, "smooth_sandstone", depth=2, floor="sandstone")
    for x, z in disc(2.6):
        if (x, z) not in set(cis) and d.get(x, 0, z) == "smooth_sandstone": d.put(x, 1, z, "sandstone_slab", half="bottom")
    tent(d, -6, -5, "e", E["canvas"], 1, S=E); tent(d, 6, -5, "w", E["canvas"], 2, S=E)
    fire_ring(d, -5, 5, S=E)
    for x, z in ((4, 4), (5, 4), (4, 5), (6, 6)): crate(d, x, z)
    foes(d, ((0, 4), (-3, -1), (3, -2), (0, 8), (-6, 2), (6, 1), (-2, -6)))
    return d


def ember_ash_pans():
    """The Ash Pans: shallow pits of grey ash where the stone is dug, spoil heaps of tuff, a rack of picks, scarab holes.
    Ground: 86 round 793, 660."""
    d = D("ember_ash_pans", "rigid", seed=603, fill="sandstone", top="keep", ease=3, light=False)
    for cx, cz, r in ((-4, -2, 3.2), (4, 3, 2.6)):
        for x, z in disc(r, cx, cz):
            d.put(x, 0, z, "light_gray_concrete_powder" if d.r(x, 0, z) < 0.7 else "gray_concrete_powder")
            d.put(x, -1, z, "tuff")
    boulder(d, 5, -4, 1.8, [("tuff", 3), ("smooth_basalt", 1), ("andesite", 1)], 2, 3)
    for x in (-1, 1): d.put(x, 1, 6, "acacia_fence"); d.put(x, 2, 6, "acacia_fence")
    d.put(0, 2, 6, "acacia_slab", half="bottom")
    for x, z in ((-5, -3), (-3, -1), (3, 4)): d.put(x, 0, z, "coarse_dirt")
    foes(d, ((-4, -2), (4, 3), (0, 0), (-2, 3), (2, -3)))
    return d


def ember_wyrm_dunes():
    """The deep dunes by the south wells: the sand swirled in a ring where the wyrm turns under it, bones half buried, a
    camel's saddle-cloth. Drape. Ground: 92, open dunes."""
    d = D("ember_wyrm_dunes", "drape", seed=604, light=False)
    for x in range(-9, 10):
        for z in range(-9, 10):
            r = math.hypot(x, z)
            if r > 9.2: continue
            a = math.atan2(z, x)
            band = (r + a * 1.4) % 3.0
            if band < 1.0: d.put(x, 0, z, "sandstone")
            elif band < 1.6: d.put(x, 0, z, "smooth_sandstone")
            else: d.put(x, 0, z, "sand")
    for x, z, ax in ((3, -2, "x"), (-4, 3, "z"), (5, 4, "x")): d.put(x, 1, z, "bone_block", axis=ax)
    d.put(-2, 1, -5, "red_carpet"); d.put(-1, 1, -5, "orange_carpet")
    foes(d, ((0, 0), (5, 0), (-5, -1)))
    return d


def ember_glass_flats():
    """The glass flats: rows of glass grown out of the sand where lightning struck, straight as a ploughed field, and the
    camel bell lying in the middle (the game drops it). Drape. Ground: 91, open flats."""
    d = D("ember_glass_flats", "drape", seed=605, light=False)
    for z in range(-8, 9, 2):
        for x in range(-9, 10):
            if abs(z) <= 1 and abs(x) <= 1: continue
            t = d.r(x, 0, z)
            if t < 0.55:
                h = 1 + (t < 0.25) + (t < 0.1)
                for y in range(1, h + 1): d.put(x, y, z, "glass" if y == 1 else "glass_pane")
                d.put(x, 0, z, "sandstone")
    mark(d, 0, 1, 0, "find")
    return d


def ember_dye_house():
    """The ruined dye-house in the Red Wash: broken sandstone walls, the roof fallen in as beams across the floor, dye vats
    still standing, and under the beams where the rug lies (the game drops it). A ruin is never lit.
    Ground: 87 round 636, 653."""
    d = D("ember_dye_house", "rigid", seed=606, fill="sandstone", top="keep", ease=3, light=False)
    mix = [("smooth_sandstone", 3), ("sandstone", 3), ("red_sandstone", 1)]
    for a, b in (((-5, -4), (5, -4)), ((5, -4), (5, 4)), ((-5, 4), (-2, 4)), ((2, 4), (5, 4)), ((-5, -4), (-5, 4))):
        ruin_wall(d, a, b, 4, 3, mix, 2)
    for x in range(-4, 5):
        for z in range(-3, 4): d.put(x, 0, z, "smooth_sandstone" if d.r(x, 0, z) < 0.7 else "red_sand")
    for z in (-2, 1): 
        for x in range(-4, 4): d.put(x, 1, z, "stripped_acacia_log", axis="x")
    for x, z in ((-3, 3), (3, -3), (3, 3)): d.put(x, 1, z, "cauldron", bs={"fill_level": 4, "cauldron_liquid": "water"})
    mark(d, 0, 1, -1, "find")
    return d


def palm_at(d, x, z, tall, bend, salt):
    from landmarks import palm
    palm(d, x, z, tall=tall, bend=bend, salt=salt)


def ember_palm_lean():
    """Where the palms lean: out in the open sand one grey palm stands dead straight in a ring of stones, and every palm
    round it leans toward it. Drape. Ground: 94, open sand."""
    d = D("ember_palm_lean", "drape", seed=607, light=False)
    for y in range(1, 9): d.put(0, y, 0, "stripped_birch_log", axis="y")
    for k in range(10):
        a = k * math.tau / 10
        d.put(round(math.sin(a) * 2.4), 1, round(math.cos(a) * 2.4), "cobblestone")
    for x, z in disc(1.5): d.put(x, 0, z, "smooth_sandstone")
    for k in range(6):
        a = k * math.tau / 6 + 0.4
        x, z = round(math.sin(a) * 11), round(math.cos(a) * 11)
        palm_at(d, x, z, 7, (-round(math.sin(a)), -round(math.cos(a))), k)
    mark(d, 0, 1, 3, "look")
    return d


def ember_cold_dune():
    """The cold dune east of town: on its crest the sand white with frost in a great ring, bare narrow footprints across
    it, and three short lines drawn in the frost. Drape. Dark (a night Look). Ground: 97, the crest."""
    d = D("ember_cold_dune", "drape", seed=608, light=False)
    for x in range(-8, 9):
        for z in range(-8, 9):
            r = math.hypot(x, z)
            if 4.6 <= r <= 7.2 and not (abs(x) <= 0 and z % 2 == 0): d.put(x, 1, z, "snow_layer")
    for k in range(3):
        for z in (-1, 0, 1): d.put(-1 + k, 0, z + 2 * 0, "packed_ice") if (k, z) != (1, 1) else d.put(-1 + k, 0, z, "packed_ice")
    mark(d, 0, 1, 5, "look")
    return d


def ember_well_lamps():
    """The well-house on the north road: a little sandstone house over the well (open arches, a flat roof with a
    parapet, the well and its bucket inside), four lamps round it. Ground: 97 round 811, 290, the road 7 east."""
    d = D("ember_well_lamps", "rigid", seed=609, fill="sandstone", top="keep", ease=3, light=False)
    for x in range(-2, 3):
        for z in range(-2, 3):
            d.put(x, 0, z, "smooth_sandstone")
            if abs(x) == 2 and abs(z) == 2:
                for y in range(1, 4): d.put(x, y, z, "cut_sandstone")
            d.put(x, 4, z, "smooth_sandstone")
            if abs(x) == 2 or abs(z) == 2: d.put(x, 5, z, "sandstone_wall")
    for x, z in ((-2, -1), (-2, 0), (-2, 1), (2, -1), (2, 0), (2, 1), (-1, -2), (0, -2), (1, -2), (-1, 2), (0, 2), (1, 2)):
        d.put(x, 3, z, "smooth_sandstone_slab", half="top")
    basin(d, [(0, 0)], "smooth_sandstone", depth=3, floor="sandstone")
    for x, z in ((1, 0), (-1, 0), (0, 1), (0, -1)): d.put(x, 1, z, "sandstone_wall")
    d.put(0, 3, 0, "iron_chain", axis="y"); d.put(0, 2, 0, "iron_chain", axis="y")
    d.put(0, 3, 1, "lantern", hanging=True)
    lamp_ring(d, E, 4, 6, start=math.pi / 4)
    return d


def ember_oasis_pen():
    """The goat pen at the south oasis: sandstone walls, a gate, a shade on acacia posts with striped cloth, a trough.
    Ground: 88 round 895, 693."""
    d = D("ember_oasis_pen", "rigid", seed=610, fill="sandstone", top="keep", ease=3)
    pen(d, E, 7, 6, wall=[("sandstone", 3), ("smooth_sandstone", 2), ("cut_sandstone", 1)], salt=4)
    d.put(-4, 1, 2, "cauldron", bs={"fill_level": 6, "cauldron_liquid": "water"})
    palm_at(d, 5, 3, 6, (0, 0), 3)
    flock(d, ((-2, 0), (0, 1), (2, -1), (-1, 3), (3, 3), (-4, -1)))
    return d


# ---------------------------------------------------------------- Blackfen

B = STYLE["fen"]


def fen_peat_camp():
    """The raiders dug into the peat cuttings: the cut banks, stacks of peat drying, a great frame of mangrove poles with
    a hide stretched on it (drying something big), tents, stakes, the fire. Ground: 69 round -55, 729."""
    d = D("fen_peat_camp", "rigid", seed=701, fill="dirt", top="keep", ease=3)
    raider_camp(d, B, 11, 9, gap="s", tents=((-6, -4, "e"), (6, -4, "w")), tower=(6, 3), salt=1)
    for x in range(-8, -2):                                   # a cut bank: the trench and its wall of peat
        for z in (3, 4):
            d.air(x, 0, z); d.put(x, -1, z, "mud")
        d.put(x, 0, 5, "packed_mud")
    for x, z in ((-3, -1), (-2, -1), (-3, 0), (3, 4), (4, 4)):          # peat stacks
        d.put(x, 1, z, "packed_mud"); d.put(x, 2, z, "mud") if d.r(x, 2, z) < 0.5 else None
    for x in (-2, 2):                                          # the frame, and what's stretched on it
        for y in range(1, 6): d.put(x, y, -7, "mangrove_log", axis="y")
    for x in range(-2, 3): d.put(x, 6, -7, "mangrove_log", axis="x")
    for x in range(-1, 2):
        for y in range(2, 6): d.put(x, y, -7, "brown_wool")
    foes(d, ((0, -2), (-3, 2), (3, 1), (0, 8), (-1, 7), (4, -1), (-5, 0)))
    return d


def fen_causeway_camp():
    """The raiders across the old causeway: a barrier of stakes right across the road with a gap they open for the toll,
    the toll-table, tents on either side, their fire. The road runs NNE through the middle (map 2026-11-14: heading
    0.43, 0.9). Ground: 69-70 round -125, 818, open fen water 12+ west."""
    d = D("fen_causeway_camp", "rigid", seed=702, fill="dirt", top="keep", ease=3)
    for k in range(-7, 8):                                    # the barrier, across the road
        x, z = round(k * 0.9), round(-k * 0.43)
        if abs(k) <= 1: continue
        for y in (1, 2): d.put(x, y, z, "stripped_mangrove_log" if y == 1 else "mangrove_log", axis="y")
        if k % 2: d.put(x, 3, z, "mangrove_fence")
    d.put(-2, 1, 3, "mangrove_fence"); d.put(-2, 2, 3, "spruce_pressure_plate" if False else "spruce_slab", half="bottom")   # the toll-table
    d.put(-3, 1, 3, "barrel", bs={"facing_direction": 1})
    tent(d, -7, 5, "e", B["canvas"], 1, S=B); tent(d, 7, -5, "w", B["canvas"], 2, S=B)
    fire_ring(d, 5, 5, S=B)
    ground_patch(d, 9, 8, B["ground"], 0.3, 2)
    foes(d, ((0, 0), (-1, 2), (1, -2), (4, 2), (-5, -2), (3, 7), (-4, 4)))
    return d


def fen_toad_pools():
    """The toad pools west of town: three round pools held in the peat, lily pads, reeds at the edges, mangrove roots.
    Ground: 69, open fen."""
    d = D("fen_toad_pools", "rigid", seed=703, fill="dirt", top="keep", ease=3, light=False)
    for cx, cz, r in ((-4, -3, 2.4), (4, -1, 2.0), (-1, 5, 2.2)):
        cells = disc(r, cx, cz)
        basin(d, cells, "mud", depth=1, floor="mud")
        for x, z in cells:
            if d.r(x, 1, z) < 0.3: d.put(x, 1, z, "waterlily")
    for x, z in ((-7, -3), (-4, 0), (6, -1), (2, 6)): d.put(x, 1, z, "mangrove_roots")
    foes(d, ((0, 0), (-4, 1), (4, 2), (1, -4)))
    return d


def fen_drowned_alders():
    """The drowned alders: dead trees standing in black pools, roots up out of the water, moss, the sundew Moll picks.
    Ground: 70, open fen."""
    d = D("fen_drowned_alders", "rigid", seed=704, fill="dirt", top="keep", ease=3, light=False)
    for cx, cz, r in ((-3, -2, 2.6), (4, 3, 2.2)):
        basin(d, disc(r, cx, cz), "mud", depth=1, floor="mud")
    for k, (x, z, h) in enumerate(((-3, -2, 6), (-1, -1, 4), (4, 3, 5), (2, -4, 3), (-5, 4, 4))):
        for y in range(0, h): d.put(x, y + 1, z, "stripped_dark_oak_log" if y % 3 else "dark_oak_log", axis="y")
        d.put(x, 0, z, "mud")
        if h > 3: d.put(x + 1, h - 1, z, "dark_oak_log", axis="x")
    for x, z in ((0, 2), (-6, 0), (1, 5)): d.put(x, 1, z, "red_tulip" if False else "moss_carpet")
    foes(d, ((0, 0), (-5, -4)))
    return d


def fen_lantern_post():
    """The old lantern post out west: a lone black post leaning out of a mud pool with an iron hook at its top, and at its
    foot, where the first lantern lies (the game drops it). Drape. Dark (it is the lantern that should be there).
    Ground: 70, open fen."""
    d = D("fen_lantern_post", "drape", seed=705, light=False)
    for x, z in disc(3.2): d.put(x, 0, z, "mud" if d.r(x, 0, z) < 0.8 else "packed_mud")
    for y in range(1, 6): d.put(0, y, 0, "dark_oak_log", axis="y")
    d.put(1, 5, 0, "dark_oak_fence"); d.put(1, 4, 0, "iron_chain", axis="y")
    mark(d, 1, 1, 1, "find")
    return d


def fen_deep_cutting():
    """The deep cutting: a trench cut three deep in the peat, steps down at one end, the black wall where the bog man's
    hand comes out, and below it where the spade lies (the game drops it). Dark. Ground: 73 round -237, 772."""
    d = D("fen_deep_cutting", "rigid", seed=706, fill="dirt", top="keep", ease=2, light=False)
    for x in range(-5, 6):
        for z in range(-2, 3):
            for y in range(-3, 1):
                wall = abs(z) == 2 or abs(x) == 5 or y == -3
                if wall: d.put(x, y, z, d.pick(x, y, z, [("packed_mud", 3), ("mud", 2), ("dirt_with_roots", 1)], 1))
                else: d.air(x, y, z)
    for k, x in enumerate(range(2, 5)): d.put(x, -2 + k, 0, "spruce_stairs", facing="w")
    for k, x in enumerate(range(2, 5)): d.put(x, -2 + k, 1, "spruce_stairs", facing="w")
    d.put(-3, -1, -2, "brown_terracotta")                      # the hand
    d.put(-3, -1, -1, "spruce_trapdoor", facing="s", half="top")
    mark(d, -3, -2, -1, "find")
    return d


def fen_moving_lights():
    """The open fen north-east of town: a line of old marker poles leading out over the wet ground, moss, a punt pole
    left stuck in the mud. Drape. Dark (a night Look: the lights are the fen's own)."""
    d = D("fen_moving_lights", "drape", seed=707, light=False)
    for k in range(5):
        x, z = -8 + 4 * k, round(-2 + k * 0.8)
        d.put(x, 1, z, "mangrove_fence"); d.put(x, 2, z, "mangrove_fence")
    for x, z in disc(6):
        if d.get(x, 1, z) is None and d.r(x, 1, z) < 0.2: d.put(x, 1, z, "moss_carpet")
    d.put(3, 1, 4, "stripped_mangrove_log", axis="y"); d.put(3, 2, 4, "mangrove_fence")
    mark(d, 0, 1, 0, "look")
    return d


def fen_toad_ring():
    """The round pool: a pool held in the peat, lily pads on it, a ring of moss and mud round its edge where the toads sit.
    Ground: 72 round 121, 816. Dark (a night Look)."""
    d = D("fen_toad_ring", "rigid", seed=708, fill="dirt", top="keep", ease=2, light=False)
    cells = disc(4.2)
    basin(d, cells, "mud", depth=1, floor="mud")
    for x, z in cells:
        if 2.5 < math.hypot(x, z) and d.r(x, 1, z) < 0.35: d.put(x, 1, z, "waterlily")
    for x, z in disc(6.2):
        if math.hypot(x, z) > 5.2 and d.get(x, 1, z) is None: d.put(x, 1, z, "moss_carpet")
    mark(d, 0, 1, 6, "look")
    return d


def fen_far_boardwalk():
    """The far boardwalk: a raised walk of mangrove planks on log stilts running east beside the road, and four of
    Gertie's lanterns on posts along it, sides alternating. The road runs east 8 south of the spot (map 2026-11-14:
    heading 0.99, -0.17), the open water north. Drape."""
    d = D("fen_far_boardwalk", "drape", seed=709, light=False)
    for x in range(-12, 13):
        z0 = round(-x * 0.17)
        for dz in (-1, 0, 1):
            d.put(x, 1, z0 + dz, "mangrove_planks" if (x + dz) % 5 else "spruce_planks")
        if x % 3 == 0:
            for dz in (-1, 1): d.put(x, 0, z0 + dz, "mangrove_log", axis="y")
    out = []
    for i, x in enumerate((-9, -3, 3, 9)):
        z = round(-x * 0.17) + (2 if i % 2 else -2)
        out.append(lamp_post(d, x, z, S=B))
    for lx, ly, lz in out: mark(d, lx, ly, lz, "lamp")
    return d


def fen_pig_pen():
    """The pig pen on the east hummock: a mangrove rail round the dry ground, a gate, the lean-to, a mud wallow.
    Ground: 72 round 187, 848."""
    d = D("fen_pig_pen", "rigid", seed=710, fill="dirt", top="keep", ease=3)
    pen(d, B, 7, 6, wall=None, salt=5)
    for x, z in disc(1.6, 3, 2): d.put(x, 0, z, "mud")
    flock(d, ((-2, 0), (0, 1), (2, -1), (-1, 3), (-3, 2), (-4, -1)))
    return d


# ---------------------------------------------------------------- the burned hamlets (Act 2: the cart family's home)

HAMLET = {   # region: (style, wall mix, the hamlet's place in board_data.js PLACES)
    "vale": (V, [("cobblestone", 3), ("mossy_cobblestone", 2), ("calcite", 2)], "brackenfold"),
    "frost": (F, [("cobbled_deepslate", 3), ("deepslate_bricks", 2), ("spruce_planks", 1)], "kettlenes"),
    "salt": (SA, [("smooth_sandstone", 3), ("calcite", 2), ("andesite", 1)], "sandwick"),
    "ember": (E, [("smooth_sandstone", 3), ("sandstone", 2), ("orange_terracotta", 1)], "thornwell"),
    "fen": (B, [("mud_bricks", 3), ("packed_mud", 2), ("tuff", 1)], "rushby"),
}
CHAR = [("blackstone", 3), ("coal_block", 1), ("polished_blackstone_bricks", 1)]


def burned_cottage(d, S, wall, x0, z0, x1, z1, door="s", salt=0):
    """A cottage burned to its walls: the stone stands, scorched black at the top and round the openings, the roof gone
    but for two charred rafters, ash on the floor, a table and a bed frame inside, the door out on the grass."""
    for x in range(x0, x1 + 1):
        for z in range(z0, z1 + 1):
            edge = x in (x0, x1) or z in (z0, z1)
            d.put(x, 0, z, d.pick(x, 0, z, S["stone"], salt))
            if not edge:
                if d.r(x, 1, z, salt) < 0.45: d.put(x, 1, z, "light_gray_carpet" if d.r(x, 2, z) < 0.6 else "gray_carpet")
                continue
            top = 3 - int(2 * d.r(x // 2, 9, z // 2, salt) ** 1.5)
            for y in range(1, top + 1):
                d.put(x, y, z, d.pick(x, y, z, CHAR, salt) if y == top and d.r(x, y, z, salt) < 0.7 else d.pick(x, y, z, wall, salt))
    cx = (x0 + x1) // 2
    dz = z1 if door == "s" else z0
    for y in (1, 2): d.air(cx, y, dz)
    d.put(cx, 3, dz, d.pick(cx, 3, dz, CHAR, salt))
    d.put(cx - 1, 1, dz + (2 if door == "s" else -2), "dark_oak_trapdoor", facing="s", half="bottom")   # the door, flung out
    for z in (z0 + 1, z1 - 2):                         # two charred rafters left, on wall ends kept to full height
        for x in (x0, x1):
            for y in range(1, 4): d.put(x, y, z, d.pick(x, y, z, wall, salt + 1))
        for x in range(x0, x1 + 1): d.put(x, 4, z, "dark_oak_log", axis="x")
    d.put(x0 + 1, 1, z0 + 1, "dark_oak_fence"); d.put(x0 + 1, 2, z0 + 1, "dark_oak_slab", half="bottom")   # what's left of the table
    d.put(x1 - 1, 1, z1 - 1, "dark_oak_slab", half="bottom"); d.put(x1 - 1, 1, z1 - 2, "dark_oak_slab", half="bottom")  # the bed frame


def burned_hamlet(region):
    S, wall, place = HAMLET[region]
    d = D(f"{region}_burned_hamlet", "rigid", seed=900 + list(HAMLET).index(region), fill="dirt", top="keep", ease=4, light=False)
    burned_cottage(d, S, wall, -11, -9, -5, -3, "s", 1)
    burned_cottage(d, S, wall, 4, -10, 10, -4, "s", 2)
    burned_cottage(d, S, wall, -3, 4, 3, 10, "n", 3)
    # the lane between them, a well, a cart on its side, ash blown across, one fire still smoking in the last house
    for x in range(-2, 3):
        for z in range(-10, 4): d.put(x, 0, z, d.pick(x, 0, z, S["ground"], 4)) if d.r(x, 0, z) < 0.6 else None
    for x, z in ((6, 2), (7, 2), (6, 3), (8, 1)):
        d.put(x, 0, z, "cobblestone")
    basin(d, [(7, 2)], "cobblestone", depth=2, floor="cobblestone")
    for x, z in ((6, 2), (8, 2), (7, 1), (7, 3)): d.put(x, 1, z, "cobblestone_wall")
    for x in range(-9, -5): d.put(x, 1, 3, S["slab"], half="bottom")
    d.put(-5, 1, 2, S["trap"], facing="n", half="bottom"); d.put(-10, 1, 4, S["trap"], facing="e", half="bottom")
    d.put(0, 1, 8, "campfire", bs={"extinguished": False})
    for x, z in ((-1, 0), (3, -1), (-4, 1), (5, 5)): d.put(x, 1, z, "light_gray_carpet")
    mark(d, 0, 1, 0, "look"); mark(d, 0, 1, 2, "person")
    return d


def vale_burned_hamlet(): return burned_hamlet("vale")
def frost_burned_hamlet(): return burned_hamlet("frost")
def salt_burned_hamlet(): return burned_hamlet("salt")
def ember_burned_hamlet(): return burned_hamlet("ember")
def fen_burned_hamlet(): return burned_hamlet("fen")

SITES = {f.__name__: f for f in (
    vale_camp, vale_ram_camp, vale_barrows, vale_peg_nest, vale_sunk_bell, vale_lantern_line, vale_waystone, vale_lamps, vale_fold,
    vale_cold_camp,
    frost_wolf_den, frost_sled_camp, frost_pass_camp, frost_old_working, frost_black_spruce, frost_lake_ring, frost_stag_tracks,
    frost_ice_holes, frost_goat_pen, frost_bothy,
    salt_westwatch_camp, salt_wreckers_camp, salt_eel_rocks, salt_annets_strand, salt_kings_barrel, salt_bride_strand,
    salt_gull_head, salt_cliff_lamps, salt_dune_fold,
    ember_caravan_camp, ember_serai_camp, ember_ash_pans, ember_wyrm_dunes, ember_glass_flats, ember_dye_house, ember_palm_lean,
    ember_cold_dune, ember_well_lamps, ember_oasis_pen,
    fen_peat_camp, fen_causeway_camp, fen_toad_pools, fen_drowned_alders, fen_lantern_post, fen_deep_cutting, fen_moving_lights,
    fen_toad_ring, fen_far_boardwalk, fen_pig_pen,
    vale_burned_hamlet, frost_burned_hamlet, salt_burned_hamlet, ember_burned_hamlet, fen_burned_hamlet)}


def build(name):
    d = SITES[name]()
    marks = d.meta.pop("marks", [])
    lit = d.meta.pop("light", True)
    d.meta["spawns"] = [[x, y, z, k] for x, y, z, k in marks]       # kept clear by the lighting stage
    keep = EX.LIT_ELSEWHERE
    if lit is False: EX.LIT_ELSEWHERE = keep + (name,)               # dark on purpose (said on the design)
    try: out = EX.export(d, name=name)
    finally: EX.LIT_ELSEWHERE = keep
    out.pop("spawns", None); out.pop("signs", None)
    out["marks"] = marks
    return out


def scene(data, pad=4):
    """For render.py: the site's blocks (Java names from the Bedrock palette) on a patch of grass."""
    pal = [[n.replace("minecraft:", ""), {"raw": st}] for n, st in data["palette"]]
    cells = {}
    for y, z, x0, n, i in data["rows"]:
        for x in range(x0, x0 + n): cells[(x, y, z)] = i
    b = data["box"]
    gi = len(pal); pal.append(["grass_block", {}]); di = len(pal); pal.append(["dirt", {}])
    for x in range(b["x0"] - pad, b["x1"] + pad + 1):
        for z in range(b["z0"] - pad, b["z1"] + pad + 1):
            if (x, 0, z) not in cells: cells[(x, 0, z)] = gi
            if (x, -1, z) not in cells: cells[(x, -1, z)] = di
    air = {i for i, (n, _) in enumerate(pal) if n == "air"}
    return {"palette": pal, "blocks": [[x, y, z, i] for (x, y, z), i in cells.items() if i not in air]}


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--scenes"); ap.add_argument("--only")
    a = ap.parse_args()
    out = {}
    for name in SITES:
        if a.only and name not in a.only.split(","): continue
        out[name] = build(name)
        print(f"{name}: {sum(r[3] for r in out[name]['rows'])} blocks, {len(out[name]['marks'])} marks")
        if a.scenes:
            os.makedirs(os.path.join(a.scenes, name), exist_ok=True)
            json.dump(scene(out[name]), open(os.path.join(a.scenes, name, "scene.json"), "w"))
    if a.only: return
    js = ("// Generated by map/structures/board_sites.py (minecraft-builder skill). Do not edit by hand.\n"
          "// BOARD_SITES[key]: a Town Board job site in the landmarks' design format (landmarks/plan.js), plus marks.\n"
          "export const BOARD_SITES = " + json.dumps(out, separators=(",", ":")) + ";\n")
    open(OUT, "w").write(js)
    print("wrote", os.path.relpath(OUT, ROOT), round(len(js) / 1024), "KB")


if __name__ == "__main__":
    main()
