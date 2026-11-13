"""Story places the lore names that the map did not have yet (thread "Match story areas to the map", 2026-11-12),
as landmark designs (landmarks.py format: y = 0 the ground layer, front -z). landmarks_story.py adds them to
STORY_DESIGNS, so they export, place and preview with the other story places.

  frost_watchtower    "A ruined watchtower on the Frostmarch border, in a chest" (Chronicle II, chron_02): the old
                      kingdom's watch over the north pass, on the pass's west shoulder above the line (-130, -748).
                      Seven wide, built in stages (plinth, two string courses, a corbelled fighting top), its
                      north-west half fallen; two rotten floors inside, the chest on the first.
  hallowmere_shrine   "A shrine on the shore is carved with a full moon" (frozen_lake, Hild Ashby, Gerrit): a
                      standing stone under a small shingle roof on the south shore of Hallowmere, the full moon
                      carved on its lake face, old offerings round its foot.
  hallowmere_ice_hut  a fishing hut out on the ice ("a drowned satchel under the ice hut", Corvin's Notebook II).
  hallowmere_ice_door "No moon in the sky, but a full white moon in the ice. Then the ice opened like a door"
                      (Gerrit, the Wrong Moon): a white disc under the ice, 9 across, round a 3x3 patch of ice that
                      is a moon door carved full (lore/moondoors.js: it opens on the dark moon, closes at dawn).
                      Under it a packed-ice shaft goes down through the water into the student's refuge in the
                      lake bed. The piece is "carve" and `dry`: it stands on the ice (the game reads the ice as
                      ground) and its walls are set before the water inside them is cleared.
                      All three stand inside the Pale Huntsman's area (landmarks/sites.js, after: "huntsman"), on
                      patches its stamp leaves plain: shrine (107, -1102), hut (97, -1133), door (33, -1108).

Design meta used here besides landmarks.py's:
  doors  [[x, y, z, carving, wide, tall, long]]  moon doors the game registers when it builds the piece (wide runs
         east, long runs south, tall runs up). Not for turning pieces.
  dry    set the walls before clearing (landmarks/plan.js), for rooms under water.
"""
import math
from landmarks import D

DARK = [("cobbled_deepslate", 4), ("deepslate_bricks", 3), ("cracked_deepslate_bricks", 2), ("stone_bricks", 2), ("andesite", 1)]
FALLEN = [("cobbled_deepslate", 4), ("cobblestone", 2), ("deepslate_bricks", 2), ("gravel", 1), ("andesite", 1)]
ICE_WALL = [("packed_ice", 5), ("blue_ice", 1)]


def disc(r):
    n = int(r) + 1
    return [(x, z) for x in range(-n, n + 1) for z in range(-n, n + 1) if math.hypot(x, z) <= r]


def snow_on_tops(d, x0, x1, z0, z1, chance=0.7, salt=0):
    """A snow layer on the highest solid block of each column (Frostmarch: everything flat carries snow)."""
    for x in range(x0, x1 + 1):
        for z in range(z0, z1 + 1):
            ys = [y for (cx, y, cz), (b, _) in d.cells.items() if cx == x and cz == z and b != "air"]
            if not ys: continue
            y = max(ys); b = d.get(x, y, z)
            if any(k in b for k in ("stairs", "slab", "wall", "fence", "lantern", "campfire", "chain", "ladder", "trapdoor", "candle", "pot", "rod", "sign")): continue
            if d.r(x, y, z, salt) < chance: d.put(x, y + 1, z, "snow_layer")


def gable(d, a0, a1, half, y0, wood, gable_block, axis="x", wall=None):
    """A pitch-2 roof (two up for each one in) running along `axis` from a0 to a1, `half` out each side of the
    ridge, eaves at y0. Solid under the stairs down to the eave line, so there is no sky under the roof; the gable
    ends (at +-`wall`, default the roof's own ends) are faced in `gable_block`. The ridge: planks, a slab on top."""
    plank = f"{wood}_planks"
    def at(a, o, y, b, **p):
        (d.put(a, y, o, b, **p) if axis == "x" else d.put(o, y, a, b, **p))
    ends = (a0, a1) if wall is None else (-wall, wall)
    for o in range(-half, half + 1):
        k = half - abs(o)                                  # steps in from the eave
        ytop = y0 + 2 * k
        for a in range(a0, a1 + 1):
            for y in range(y0, ytop if o else ytop + 1): at(a, o, y, gable_block if a in ends else plank)
            if o == 0: at(a, o, ytop + 1, f"{wood}_slab", half="bottom")
            else: at(a, o, ytop, f"{wood}_stairs", facing=("s" if o > 0 else "n") if axis == "x" else ("e" if o > 0 else "w"))


# ---------------------------------------------------------------- the watchtower on the Frostmarch border


def frost_watchtower():
    d = D("frost_watchtower", "rigid", seed=611, fill="cobblestone", top="keep", ease=4)
    H = 21                                   # the shaft's full height where it still stands (3 x 7)
    # broken top: full height on the south-east (the side toward the Vale), falling away to the north-west
    def top_at(x, z):
        fall = max(0, (-x - z) + 1)          # 0 on the SE half, growing to the NW corner
        return H - min(13, int(fall * 2.2 + 3 * d.r(x, 91, z) ** 1.5))
    # plinth: two courses, the first battered one block out
    for x in range(-4, 5):
        for z in range(-4, 5):
            d.put(x, 0, z, "polished_deepslate" if max(abs(x), abs(z)) == 4 else "cobbled_deepslate")
            if max(abs(x), abs(z)) == 4: d.put(x, 1, z, "cobbled_deepslate_stairs", facing={4: "e", -4: "w"}.get(x) or {4: "s", -4: "n"}[z]) if abs(x) != abs(z) else d.put(x, 1, z, "cobbled_deepslate")
    # the shaft: 7 x 7, quoined corners, a string course every 6 blocks
    for x in range(-3, 4):
        for z in range(-3, 4):
            if max(abs(x), abs(z)) != 3: continue
            corner = abs(x) == 3 and abs(z) == 3
            for y in range(1, top_at(x, z) + 1):
                if y in (7, 13): d.put(x, y, z, "polished_deepslate"); continue
                d.put(x, y, z, "polished_deepslate" if corner and y % 2 else d.pick(x, y, z, DARK, 3))
    # string courses: upside-down stairs one block out at each stage line, where the wall still stands
    for y in (7, 13):
        for k in range(-3, 4):
            for (x, z, f) in ((k, -4, "n"), (k, 4, "s"), (-4, k, "w"), (4, k, "e")):
                ix, iz = max(-3, min(3, x)), max(-3, min(3, z))
                if top_at(ix, iz) >= y: d.put(x, y, z, "deepslate_brick_stairs", facing=f, half="top")
    # the fighting top: corbels and merlons on the two walls that still reach it (south and east)
    for k in range(-3, 4):
        for (x, z, f) in ((k, 4, "s"), (4, k, "e")):
            ix, iz = max(-3, min(3, x)), max(-3, min(3, z))
            if top_at(ix, iz) >= H - 1:
                d.put(x, H - 1, z, "deepslate_brick_stairs", facing=f, half="top")
                d.put(x, H, z, "deepslate_bricks")
                if (k % 2 == 0) and d.r(x, H, z) < 0.8: d.put(x, H + 1, z, "deepslate_brick_wall")
    # door to the south (toward the Vale), the watch windows to the north
    for y in (1, 2, 3): d.air(0, y, 3)
    d.put(0, 4, 3, "deepslate_brick_stairs", facing="s", half="top")
    d.put(0, 1, 4, "cobbled_deepslate_slab", half="bottom")
    for y in (5, 6):                         # slits low on the sides, lancets higher on the north face
        for (x, z) in ((3, 0), (-3, 0)):
            if d.get(x, y, z): d.air(x, y, z)
    for y in (9, 10, 11):
        for (x, z) in ((0, -3), (3, 0)):
            if d.get(x, y, z) and d.get(x, y, z) != "air": d.air(x, y, z)
    for y in (15, 16, 17):
        for (x, z) in ((0, 3), (3, 0)):
            if d.get(x, y, z) and d.get(x, y, z) != "air": d.air(x, y, z)
    # inside: the ground floor of flags, a ladder up the east wall, two rotten floors
    for x in range(-2, 3):
        for z in range(-2, 3):
            d.put(x, 0, z, "stone_bricks" if d.r(x, 0, z) < 0.6 else "cracked_stone_bricks")
    for y in range(1, 15): d.put(2, y, 0, "ladder", bs={"facing_direction": 4})
    for fy in (7, 13):
        for x in range(-2, 3):
            for z in range(-2, 3):
                if (x, z) == (2, 0): continue
                if top_at(-3 if x < 0 else 3, -3 if z < 0 else 3) < fy and d.r(x, fy, z) < 0.7: continue   # fallen with the wall
                if d.r(x, fy, z, 5) < 0.72: d.put(x, fy, z, "spruce_slab", half="top")
                elif d.r(x, fy, z, 6) < 0.5: d.put(x, fy, z, "spruce_trapdoor", bs={"direction": 0, "open_bit": False, "upside_down_bit": True})
    # the first floor: the chest Bertram Quill's chronicle was found in, a cot, a dead brazier at the north window
    d.put(1, 8, 2, "chest", facing="n")
    d.put(-2, 8, 2, "spruce_slab", half="bottom"); d.put(-1, 8, 2, "white_carpet")
    d.put(0, 8, -2, "campfire", bs={"extinguished": True})
    d.put(-1, 8, -2, "cauldron")
    # the fallen half: rubble down the slope to the north-west
    for k in range(70):
        a = math.radians(285 + 60 * d.r(k, 1, 0)); rr = 5 + 9 * d.r(k, 2, 0) ** 0.8
        x, z = round(math.sin(a) * rr), round(-math.cos(a) * rr)
        if max(abs(x), abs(z)) <= 4: continue
        t = d.r(k, 3, 0)
        d.put(x, 1, z, d.pick(x, 1, z, FALLEN) if t < 0.55 else "cobbled_deepslate_slab" if t < 0.8 else "deepslate_brick_stairs",
              **({"half": "bottom"} if 0.55 <= t < 0.8 else {"facing": "nsew"[k % 4]} if t >= 0.8 else {}))
        if t < 0.2: d.put(x, 2, z, "cobbled_deepslate_slab", half="bottom")
    snow_on_tops(d, -14, 14, -14, 14, 0.75, 4)
    d.meta["mark"] = [1, 8, 2]
    d.meta["tomes"] = [[1, 9, 2, "chron_02"]]     # Chronicle II, on the chest (laid by landmarks/index.js once "tomes" is in, PR #244)
    return d


# ---------------------------------------------------------------- Hallowmere: the shrine, the hut, the door in the ice


def hallowmere_shrine():
    """The stone faces the lake (its front, -z, is north). 7 x 7 with the steps."""
    d = D("hallowmere_shrine", "rigid", seed=621, fill="cobblestone", top="keep", ease=3)
    for x in range(-3, 4):
        for z in range(-3, 4):
            d.put(x, 0, z, "polished_deepslate" if max(abs(x), abs(z)) == 3 else "deepslate_tiles")
    for x in range(-2, 3): d.put(x, 1, -3, "deepslate_tile_slab", half="bottom")   # a low step on the lake side
    # the standing stone: 3 wide, 1 deep, 6 high, the full moon carved on its north face
    for x in (-1, 0, 1):
        for y in range(1, 7):
            d.put(x, y, 0, "polished_deepslate" if abs(x) == 1 else "deepslate_bricks")
    d.put(0, 7, 0, "deepslate_brick_slab", half="bottom")
    # carved into the face: a round pale moon, 3 x 3 with its corners cut, set into the stone
    for (x, y) in ((0, 2), (-1, 3), (0, 3), (1, 3), (0, 4)):
        d.put(x, y, 0, "calcite")
    d.put(0, 3, 0, "chiseled_quartz_block")
    for (x, y) in ((-1, 2), (1, 2), (-1, 4), (1, 4)): d.put(x, y, 0, "smooth_quartz")
    # the roof over it: four posts and a steep little shingle roof (pitch 2: two up for each one in), ridge east-west
    for (x, z) in ((-2, -2), (2, -2), (-2, 2), (2, 2)):
        for y in range(1, 6): d.put(x, y, z, "stripped_dark_oak_log", axis="y")
    gable(d, -3, 3, 3, 6, "spruce", "dark_oak_planks", axis="x")
    for x in (-4, 4): d.put(x, 12, 0, "dark_oak_fence")                       # carved dragon heads on the gable peaks
    # old offerings at the foot of the stone: candles (unlit), a pot, a small bell laid on its side
    d.put(-1, 1, -1, "candle", bs={"candles": 2, "lit": False}); d.put(1, 1, -1, "candle", bs={"candles": 1, "lit": False})
    d.put(0, 1, -2, "flower_pot"); d.put(-2, 1, -1, "spruce_trapdoor", bs={"direction": 2, "open_bit": False, "upside_down_bit": False})
    d.put(2, 1, 1, "barrel", bs={"facing_direction": 1})
    # a path of stepping stones down to the ice
    for k, (x, z) in enumerate(((0, -4), (1, -5), (0, -6), (0, -7))):
        d.put(x, 0, z, "deepslate_tiles" if k % 2 else "polished_deepslate")
    snow_on_tops(d, -4, 4, -4, 4, 0.65, 2)
    d.meta["mark"] = [0, 1, -2]
    return d


def hallowmere_ice_hut():
    """A one-room fishing hut on the ice, 5 x 5, door to the shore (south). Inside: the hole in the ice, a stool,
    a barrel of tackle, a soul lantern (a bright light would melt the ice under it)."""
    d = D("hallowmere_ice_hut", "rigid", seed=631, top=None, ease=0)
    for x in range(-2, 3):
        for z in range(-2, 3):
            d.put(x, 0, z, "spruce_planks")
            if max(abs(x), abs(z)) == 2:
                for y in (1, 2, 3):
                    corner = abs(x) == 2 and abs(z) == 2
                    d.put(x, y, z, "stripped_spruce_log" if corner else "spruce_planks", **({"axis": "y"} if corner else {}))
    d.air(0, 0, -1)                                           # the fishing hole: the planks stop over open water
    for y in (1, 2): d.put(0, y, 2, "spruce_door", bs={"direction": 3, "upper_block_bit": y == 2})
    d.put(-2, 2, 0, "spruce_trapdoor", bs={"direction": 3, "open_bit": True}); d.air(-2, 2, 0)
    gable(d, -3, 3, 3, 4, "dark_oak", "spruce_planks", axis="z", wall=2)       # a steep roof, ridge north-south
    d.put(1, 1, 1, "barrel", bs={"facing_direction": 1}); d.put(-1, 1, 1, "spruce_stairs", facing="n")
    d.put(1, 3, -1, "soul_lantern", hanging=True); d.put(1, 4, -1, "iron_chain", axis="y")
    snow_on_tops(d, -3, 3, -3, 3, 0.8, 3)
    return d


def hallowmere_ice_door():
    d = D("hallowmere_ice_door", "carve", seed=641, dry=True)
    # y = 0 is the ice. The door: 3 x 3 of ice, ringed by packed ice so the edge of the hole is firm
    for x in range(-2, 3):
        for z in range(-2, 3):
            d.put(x, 0, z, "ice" if max(abs(x), abs(z)) <= 1 else "packed_ice")
    # the moon in the ice: a white disc 9 across just under the surface (seen through the ice)
    for (x, z) in disc(4.5):
        if max(abs(x), abs(z)) > 1: d.put(x, -1, z, "snow" if d.r(x, -1, z) < 0.8 else "calcite")
    # the shaft: 3 x 3 of air in a packed-ice tube down through the water and the lake bed
    BOT = -12                                  # the refuge's floor (the lake here is about 6 deep)
    for y in range(BOT + 5, 0):
        for x in range(-2, 3):
            for z in range(-2, 3):
                inner = max(abs(x), abs(z)) <= 1
                if y == -1 and not inner: continue          # the disc closes the tube's top ring
                d.put(x, y, z, "air" if inner else d.pick(x, y, z, ICE_WALL, 1))
    for y in range(BOT + 1, -1): d.put(1, y, -1, "ladder", bs={"facing_direction": 4})
    # the refuge: 7 x 7 inside, 4 high, walls of old deepslate brick, sealed all round against the lake
    for x in range(-4, 5):
        for y in range(BOT - 1, BOT + 6):
            for z in range(-4, 5):
                shell = max(abs(x), abs(z)) == 4 or y in (BOT - 1, BOT + 5)
                if y == BOT + 5 and max(abs(x), abs(z)) <= 1: continue    # the shaft comes in through the ceiling
                if shell: d.put(x, y, z, d.pick(x, y, z, [("deepslate_bricks", 4), ("cracked_deepslate_bricks", 2), ("deepslate_tiles", 1)], 2))
                elif y == BOT: d.put(x, y, z, "deepslate_tiles" if d.r(x, y, z) < 0.7 else "cracked_deepslate_tiles")
                else: d.put(x, y, z, "air")
    for y in range(BOT + 1, BOT + 5): d.put(1, y, -1, "ladder", bs={"facing_direction": 4})
    # what the student left: a bedroll, a table of stacked books gone to pulp, a cold stove, an empty satchel peg
    F = BOT + 1
    d.put(-3, F, 3, "white_carpet"); d.put(-2, F, 3, "white_carpet"); d.put(-3, F, 2, "brown_carpet")
    d.put(3, F, 3, "spruce_slab", half="top"); d.put(3, F, 2, "spruce_slab", half="top")
    d.put(3, F + 1, 3, "bookshelf")
    d.put(-3, F, -3, "furnace", facing="s"); d.put(-3, F + 1, -3, "cobblestone_wall")
    d.put(0, F, 3, "lectern", facing="n")
    d.put(-1, F + 3, 0, "soul_lantern", hanging=True); d.put(-1, F + 4, 0, "iron_chain", axis="y")
    d.put(2, F, -3, "barrel", bs={"facing_direction": 1})
    # the north wall: an arch of her own carving, a dark moon cut in it, and stone behind (the way on is not here)
    for y in (F, F + 1, F + 2): d.put(-1, y, -4, "polished_deepslate"); d.put(1, y, -4, "polished_deepslate")
    d.put(0, F + 3, -4, "chiseled_deepslate"); d.put(-1, F + 3, -4, "deepslate_brick_stairs", facing="e", half="top"); d.put(1, F + 3, -4, "deepslate_brick_stairs", facing="w", half="top")
    for y in (F, F + 1, F + 2): d.put(0, y, -4, "sculk" if y == F + 1 else "blackstone")
    d.meta["doors"] = [[-1, 0, -1, "full", 3, 1, 3]]
    d.meta["mark"] = [0, 1, 0]
    return d


DESIGNS = {f.__name__: f for f in (frost_watchtower, hallowmere_shrine, hallowmere_ice_hut, hallowmere_ice_door)}
