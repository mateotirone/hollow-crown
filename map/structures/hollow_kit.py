"""The Hollow's own building kit, and the Hollow's buildings made with it.

The Hollow is a separate world seeping into ours (not a mirror), so its buildings are their own: dark
veinstone and blackstone walls, black timber with pale ash between, steep deepslate roofs, warm lit
windows in the miners' homes, soul light everywhere else. What makes them uneasy is that nothing stands
quite straight: upper floors lean out of true and ridges sag, the same crookedness as the drowned city
of leaning towers the story's travellers see.

Frame as everywhere in map/structures: y = 0 is the ground's top layer, floors at y = 1.
"""
from bp import Blueprint
from kit import Building, mix, grow, h3, DOCTRINE, LADDERS, stairs_of, paint_stone, ground_dressing
from settle_halls import pyramid, hang

def hollow_palette(seed=0):
    return dict(
        stone=mix([("siege:veinstone_bricks", 74), ("siege:cracked_veinstone_bricks", 14), ("polished_blackstone_bricks", 12)], 300 + seed),
        plinth=mix([("cobbled_deepslate", 70), ("siege:veinstone", 30)], 301 + seed), found="cobbled_deepslate",
        quoin="polished_blackstone", quoin2="polished_blackstone_bricks",
        frame="dark_oak_log", frame2="dark_oak_log", infill="siege:pale_ash",
        floor="dark_oak_planks", gable=None,
        roof=HOL_ROOF[0], roof_ladder=HOL_ROOF,              # HOL-05 gradient, eaves -> ridge
        roof_block="deepslate_tiles", roof_slab="deepslate_tile_slab",
        trim="dark_oak_stairs", trim_block="dark_oak_planks", trim_slab="dark_oak_slab",
        bracket="dark_oak_stairs", sill="polished_blackstone_brick_stairs", shutter="dark_oak_trapdoor", shutters=0.25,
        door="dark_oak_door", pane="ochre_froglight", fence="dark_oak_fence",
        chimney=mix([("polished_blackstone_bricks", 70), ("cobbled_deepslate", 30)], 303), chimney_cap="cobbled_deepslate_wall",
        path=mix([("coarse_dirt", 60), ("cobbled_deepslate", 25), ("siege:pale_ash", 15)], 304),
        # the detailing passes (build-instructions 05-07) in the Hollow's own things: dark oak shelves and
        # signs, soul lanterns, dark leaves, blackstone spikes on the ridges
        **DOCTRINE, shelf="dark_oak_slab", lantern="soul_lantern", leaves=HOL_LEAVES,
        spike="polished_blackstone_wall", finial="polished_blackstone_wall", finial_top="soul_lantern",
    )

HOL_ROOF = [stairs_of(b) for b in LADDERS["HOL-05"]]
HOL_WALL = LADDERS["HOL-02"]
HOL_LEAVES = ("dark_oak_leaves", "dark_oak_leaves")

def finish_hollow(bp):
    """The Hollow's last pass: veinstone walls painted by HOL-02 in interlocking bands, and dark bushes boxed by
    signs or soul lantern stands at the foot of blank walls."""
    paint_stone(bp, HOL_WALL, set(HOL_WALL))
    ground_dressing(bp, set(HOL_WALL) | {"polished_blackstone_bricks", "cobbled_deepslate"}, "dark_oak", leaves=HOL_LEAVES, lamp="soul_lantern")
    return bp

def lean(bp, y_from, dx=1, every=3, xs=None):
    """Shear everything at or above y_from sideways: one block per `every` rows. The Hollow's crookedness."""
    moved = {}
    for (x, y, z), v in bp.cells.items():
        if y < y_from or (xs and not (xs[0] <= x <= xs[1])): continue
        moved[(x, y, z)] = v
    for k in moved: del bp.cells[k]
    for (x, y, z), v in moved.items():
        bp.cells[(x + dx * ((y - y_from) // every + 1), y, z)] = v
    return bp

def lamp(bp, x, y, z, tall=3, soul=True):
    for i in range(tall): bp.set(x, y + i, z, "dark_oak_fence")
    bp.set(x, y + tall, z, "soul_lantern" if soul else "lantern")

def cottage(seed, w=7, d=7, door="s", storeys=2, crooked=1):
    """A miner's cottage: veinstone ground floor, a jettied black-and-ash timber floor above that leans out
    of true, a steep deepslate roof and a blackstone chimney. Centred on (0, 0); door on `door` side."""
    P = hollow_palette(seed); bp = Blueprint(f"hollow_cottage_{seed}"); B = Building(bp, P, seed)
    hx, hz = w // 2, d // 2
    rect = (-hx, -hz, hx, hz)
    B.foundation(rect, 0); B.floor(rect, 0)
    B.stone_storey(rect, 1, 3)
    top = 4
    up = rect
    if storeys > 1:
        up = (rect[0] - (door in "w"), rect[1] - (door == "n"), rect[2] + (door == "e"), rect[3] + (door == "s"))
        B.floor(up, 4); B.timber_storey(up, 4, 3, bay=3); top = 7
    ridge = "x" if w > d else "z" if d > w else ("z" if door in "ns" else "x")
    B.roof(up, ridge, top, overhang=1, verge=1, pitch=1); B.build_roofs(); B.gable_walls(up, ridge, top, style="timber")
    x0, z0, x1, z1 = rect
    door_at = {"s": (0, z1), "n": (0, z0), "e": (x1, 0), "w": (x0, 0)}[door]
    B.door(door_at[0], 1, door_at[1], door, canopy=False, lanterns=False, frame=P["quoin"])
    for side in "nsew":
        if side == door: continue
        x, z = {"s": (0, z1), "n": (0, z0), "e": (x1, 0), "w": (x0, 0)}[side]
        B.window(x, 2, z, side, 1, 1, kind="stone")
    if storeys > 1:
        for side in "nsew":
            ux0, uz0, ux1, uz1 = up
            x, z = {"s": (0, uz1 - 1), "n": (0, uz0 + 1), "e": (ux1 - 1, 0), "w": (ux0 + 1, 0)}[side]
            B.window(x, 5, z, side, 1, 1, kind="timber")   # one in from the face, so the pane sits in the wall; dressed (05)
    B.chimney(x1 if door != "e" else x0, (z0 + z1) // 2 + 1, 1)
    if crooked: lean(bp, 4 if storeys > 1 else 4, dx=crooked, every=99)   # the whole upper floor and roof sit a block out of true
    bp.markers["door"] = (door_at[0], 1, door_at[1])
    return bp

# ---------------------------------------------------------------- the mining village
# One layout for the four villages (hollowfolk/index.js buildVillage), turned a little differently by
# seed. Offsets from the village centre; y = 0 is the trodden yard. The terrace, the yard, the mine mouths
# in the west face and the walk down to the landing stay in code, because they follow the ground.
# Kept clear: the north gate (x -1..1, z -13), the east gate (x 14, z -1..1), the path x -2..2, the
# yard x -9..9 z -3..4 and the miners' spots (0,2) (-5,1) (4,-1) (-11,9).
def village(vid="glimwade", seed=0):
    P = hollow_palette(seed); bp = Blueprint(f"hollow_village_{vid}"); bp.marks = {}
    s = seed
    # the foreman's house (two storeys) and two cottages
    bp.paste(cottage(s + 1, 7, 7, "s", 2, crooked=-1 if s >= 2 else 1), -10, 0, -9)
    bp.paste(cottage(s + 2, 7, 7, "s", 2, crooked=-1 if s % 2 else 1), 8, 0, -9)
    bp.paste(cottage(s + 3, 5, 7, "n", 1, crooked=0), -5, 0, 9)
    # the smithy: open front on the yard, blast furnace, anvil, a tall smoking chimney
    B = Building(bp, P, s + 4)
    sm = (6, 6, 12, 12)
    B.foundation(sm, 0); B.floor(sm, 0, mat="cobbled_deepslate")
    for x in range(6, 13):
        for z in range(6, 13):
            edge_back = x == 12 or z == 12
            if edge_back:
                for y in (1, 2, 3): bp.set(x, y, z, P["stone"])
    for (x, z) in ((6, 6), (6, 11), (11, 6)):
        for y in (1, 2, 3): bp.set(x, y, z, "dark_oak_log", axis="y")
    B.roof((5, 5, 13, 13), "x", 4, overhang=0, verge=1, pitch=1); B.build_roofs()
    bp.set(11, 1, 11, "blast_furnace", facing="w"); bp.set(9, 1, 9, "anvil"); bp.set(10, 1, 11, "furnace", facing="n")
    for y in range(1, 10): bp.set(12, y, 12, P["chimney"])
    bp.set(12, 10, 12, "campfire")
    hang(bp, [(8, 3, 8)])
    # the ore-sorting shed by the rails from the mine mouths: four posts, a pitched roof, ore heaped on the floor
    for (x, z) in ((-14, 8), (-10, 8), (-14, 12), (-10, 12)):
        for y in (1, 2, 3): bp.set(x, y, z, "dark_oak_log", axis="y")
    for x in range(-14, -9):
        for z in (8, 12): bp.set(x, 3, z, "dark_oak_log", axis="x")
    S = Building(bp, P, s + 5); S.roof((-15, 7, -9, 13), "x", 4, overhang=0, verge=1, pitch=1); S.build_roofs()
    for (x, z) in ((-13, 10), (-12, 10), (-13, 11), (-11, 11)): bp.set(x, 1, z, "siege:choir_ore")
    bp.set(-13, 1, 9, "barrel"); bp.set(-13, 2, 9, "barrel")
    # the fire and the Tally: a copper counting block and a barrel under a purple awning
    bp.set(-3, 1, 1, "campfire")
    bp.set(1, 1, 0, "barrel")
    for (x, z) in ((-1, -1), (2, -1), (-1, 1), (2, 1)):
        for y in (1, 2, 3): bp.set(x, y, z, "dark_oak_fence")
    for x in range(-1, 3):
        for z in range(-1, 2): bp.set(x, 4, z, "purple_wool")
    # soul lamps along the yard and fences round the open north and east edges, with the gates open
    for (x, z) in ((-4, -3), (4, 3), (-11, 2), (6, -2), (0, 11)): lamp(bp, x, 1, z)
    for x in range(-14, 15):
        if abs(x) > 1: bp.set(x, 1, -13, "dark_oak_fence")
    for z in range(-13, 14):
        if abs(z) > 1: bp.set(14, 1, z, "dark_oak_fence")
    bp.markers["door"] = (0, 1, 0)
    return bp

VILLAGES = ("glimwade", "lowseam", "tollrest", "highcut")

# ---------------------------------------------------------------- the drowned city of leaning towers
# Hallowmere's own country: towers standing in black water, every one out of true. They stand in and
# beside the light river where it ends at the Court landing, in view of the path to the Court.
def leaning_tower(seed, side=5, tall=22, lean_dir=(1, 0), every=4, broken=False):
    """A square tower whose shaft leans one block per `every` rows toward lean_dir, a waterline of dark
    prismarine, string courses, slit windows (a few still lit), and a steep spire, or a broken top."""
    P = hollow_palette(seed); bp = Blueprint(f"hollow_tower_{seed}")
    h = side // 2
    drown = mix([("dark_prismarine", 45), ("siege:cracked_veinstone_bricks", 35), ("prismarine_bricks", 20)], 310 + seed)
    for y in range(-6, tall + 1):
        sx, sz = lean_dir[0] * (max(0, y) // every), lean_dir[1] * (max(0, y) // every)
        for x in range(-h, h + 1):
            for z in range(-h, h + 1):
                edge = abs(x) == h or abs(z) == h
                if not edge and y > 0: continue
                corner = abs(x) == h and abs(z) == h
                m = drown if y <= 2 else (P["quoin"] if corner else "polished_blackstone_bricks" if y % 6 == 0 else P["stone"])
                bp.set(x + sx, y, z + sz, m)
        if y > 3 and y % 6 == 3:   # slit windows on each face, a few still lit by someone
            for (x, z) in ((0, -h), (0, h), (-h, 0), (h, 0)):
                lit = h3(x, y, z, seed + 7) < 0.22
                bp.set(x + sx, y, z + sz, "ochre_froglight" if lit else "air")
                bp.set(x + sx, y + 1, z + sz, "ochre_froglight" if lit else "air")
    top = tall + 1
    sx, sz = lean_dir[0] * (tall // every), lean_dir[1] * (tall // every)
    if broken:   # the top has fallen: ragged wall stubs and a few blocks lying on the last floor
        for x in range(-h, h + 1):
            for z in range(-h, h + 1):
                if abs(x) != h and abs(z) != h: continue
                for y in range(top, top + int(h3(x, 0, z, seed + 3) * 4)): bp.set(x + sx, y, z + sz, P["stone"])
    else:
        for x in range(-h - 1, h + 2):   # a corbelled band under the spire
            for z in range(-h - 1, h + 2):
                if abs(x) == h + 1 or abs(z) == h + 1:
                    f = "s" if z == -h - 1 else "n" if z == h + 1 else "e" if x == -h - 1 else "w"
                    bp.set(x + sx, top, z + sz, "polished_blackstone_brick_stairs", facing=f, half="top")
        pyramid(bp, P, -h - 1 + sx, -h - 1 + sz, h + 1 + sx, h + 1 + sz, top + 1, pitch=2, finial="cobbled_deepslate_wall")
        bp.set(sx, top + 2 * (h + 1) + 2, sz, "soul_lantern")
    return bp

TOWERS = [   # (seed, side, tall, lean, every, broken): a set to scatter, no two alike
    (0, 5, 24, (1, 0), 4, False), (1, 7, 30, (0, 1), 5, False), (2, 5, 18, (-1, 0), 3, True),
    (3, 5, 26, (0, -1), 4, False), (4, 7, 20, (1, 1), 5, True), (5, 5, 22, (-1, 1), 4, False),
    (6, 3, 14, (1, 0), 3, False),
]

# ---------------------------------------------------------------- the centre sites
# Offsets from the site's middle (undertow/roads.js SITES), y = 0 is the ground's top block.
def truce_hall(seed=0):
    """Where two kings sat down: a long veinstone hall with buttresses and tall lit windows, its steep roof
    fallen in at the far end and the whole east wall leaning out. Inside one table, two seats (one knocked
    over), the lectern for the tome at (0, 1, 12). Door on the north end, toward the road."""
    P = hollow_palette(seed); bp = Blueprint("hollow_truce_hall"); B = Building(bp, P, seed)
    rect = (-7, -15, 7, 15)
    B.foundation(rect, 0); B.floor(rect, 0, mat="polished_blackstone_bricks")
    B.stone_storey(rect, 1, 7)
    for z in range(-12, 13, 6):   # buttresses between the windows
        for x in (-8, 8):
            for y in range(1, 6): bp.set(x, y, z, P["quoin2"])
            bp.set(x, 6, z, "polished_blackstone_brick_stairs", facing="e" if x < 0 else "w")
    for z in range(-9, 10, 6):
        for x in (-7, 7): B.window(x, 2, z, "w" if x < 0 else "e", 1, 3, kind="stone")
    B.window(-1, 3, 15, "s", 3, 3, kind="stone")   # the great window behind where the kings sat
    B.door(0, 1, -15, "n", canopy=False, lanterns=True, frame=P["quoin"])
    B.roof(rect, "z", 8, overhang=1, verge=1, pitch=1); B.build_roofs(); B.gable_walls(rect, "z", 8, style="stone")
    # the far third of the roof has fallen in: open to the sky, with a few rafters left
    for (x, y, z) in list(bp.cells):
        if y >= 8 and z >= 5 and h3(x, y, z, seed + 11) < 0.85: del bp.cells[(x, y, z)]
    for z in (6, 10): 
        for x in range(-6, 7): bp.set(x, 8, z, "dark_oak_log", axis="x")
    for x in range(-4, 5):   # rubble where it came down
        for z in range(6, 13):
            if h3(x, 1, z, seed + 12) < 0.18 and abs(x) > 1: bp.set(x, 1, z, P["stone"] if h3(x, 2, z, 1) < 0.5 else "cobbled_deepslate_slab", half="bottom")
    # the table, the seat still standing, the one knocked over, the lectern
    for x in (-1, 0, 1): bp.set(x, 1, 4, "dark_oak_planks")
    bp.set(0, 1, 6, "dark_oak_stairs", facing="n"); bp.set(2, 1, 2, "dark_oak_slab", half="bottom")
    bp.set(0, 1, 12, "lectern", facing="n")
    hang(bp, [(0, 6, -10), (0, 6, -4), (0, 6, 2)])
    lean(bp, 4, dx=1, every=99, xs=(4, 9))   # the east side has settled: wall tops and roof slip a block
    lamp(bp, -5, 1, -18); lamp(bp, 5, 1, -18)
    bp.markers["door"] = (0, 1, -15)
    return bp

def far_door(seed=0):
    """The Hollow's side of the Gate: a tall sealed arch in the rock face, framed in blackstone with a
    veinstone surround, two scaffold towers with plank decks and ladders, a winch, dig pits and lamps."""
    P = hollow_palette(seed); bp = Blueprint("hollow_far_door")
    rock = mix([("basalt", 70), ("blackstone", 20), ("siege:veinstone", 10)], 320 + seed)
    for x in range(-22, -16):
        for z in range(-12, 13):
            for y in range(1, 21 - abs(z) // 3 + int(h3(x, 0, z, seed) * 3)): bp.set(x, y, z, rock, axis="y")
    for z in range(-6, 7):   # the frame: a pointed arch of polished blackstone round the seal
        for y in range(1, 17):
            inside = abs(z) <= 3 and y <= 12 or abs(z) <= 2 and y <= 14 or abs(z) <= 1 and y <= 15
            ring = abs(z) <= 5 and y <= 14 or abs(z) <= 4 and y <= 15 or abs(z) <= 3 and y <= 16
            if inside: bp.set(-17, y, z, "siege:court_seal"); bp.set(-16, y, z, "air")
            elif ring:
                bp.set(-17, y, z, "polished_blackstone_bricks" if (y + z) % 3 else "chiseled_polished_blackstone")
                bp.set(-16, y, z, P["quoin"] if abs(z) >= 4 else "polished_blackstone_bricks")
    for z in (-6, 6):   # flanking pillars with braziers
        for y in range(1, 9): bp.set(-15, y, z, "polished_blackstone_bricks" if y % 3 else "chiseled_polished_blackstone")
        bp.set(-15, 9, z, "soul_campfire")
    for zc in (-9, 9):   # scaffold towers: log posts, plank decks, a ladder up one side
        for (dx, dz) in ((0, -1), (4, -1), (0, 1), (4, 1)):
            for y in range(1, 12): bp.set(-14 + dx, y, zc + dz, "dark_oak_log" if y in (1, 5, 10) else "dark_oak_fence", axis="y")
        for y in (5, 10):
            for x in range(-14, -9):
                for dz in (-1, 0, 1): bp.set(x, y, zc + dz, "dark_oak_planks" if dz == 0 or x in (-14, -10) else "dark_oak_slab", half="top")
        for y in range(1, 11): bp.set(-12, y, zc + (2 if zc > 0 else -2), "ladder", facing="s" if zc > 0 else "n")
        for x in range(-14, -9):
            if x != -12: bp.set(x, 11, zc - 1, "dark_oak_fence"); bp.set(x, 11, zc + 1, "dark_oak_fence")
    for x in range(-14, -9): bp.set(x, 10, 0, "dark_oak_log", axis="x")   # a beam between them with a hanging lantern
    for z in range(-8, 9): bp.set(-12, 12, z, "dark_oak_log", axis="z")
    bp.set(-12, 11, 0, "iron_chain"); bp.set(-12, 10, 0, "soul_lantern", hanging=True)
    for (x0, z0, x1, z1, d) in ((-6, -6, -2, -2, 3), (2, 3, 5, 7, 2)):   # dig pits with a rim of spoil
        for x in range(x0, x1 + 1):
            for z in range(z0, z1 + 1):
                for y in range(-d + 1, 1): bp.set(x, y, z, "air")
        for x in range(x0 - 1, x1 + 2):
            for z in range(z0 - 1, z1 + 2):
                if (x in (x0 - 1, x1 + 1) or z in (z0 - 1, z1 + 1)) and h3(x, 1, z, seed + 4) < 0.6: bp.set(x, 1, z, "coarse_dirt" if h3(x, 2, z, 3) < 0.6 else "cobbled_deepslate")
    bp.set(-7, 1, 2, "barrel"); bp.set(-7, 1, 3, "barrel"); bp.set(-8, 1, 2, "barrel"); bp.set(-7, 2, 2, "barrel")
    lamp(bp, -9, 1, 0); lamp(bp, 4, 1, -4)
    bp.markers["door"] = (0, 1, 0)
    return bp

def drowned_city_preview():
    """Only for the catalogue: the tower set stood in black water as the game scatters them."""
    bp = Blueprint("hollow_drowned_city")
    spots = [(-30, -6), (-14, 10), (-2, -12), (12, 6), (26, -8), (34, 14), (2, 22)]
    for (sx, sz), t in zip(spots, TOWERS): bp.paste(_tower(*t), sx, 0, sz)
    for x in range(-40, 44):
        for z in range(-22, 32):
            if (x, 0, z) not in bp.cells: bp.set(x, 0, z, "water")
    return bp

def shed(bp, P, rect, ridge, seed, posts=3, walls=()):
    """An open timber shed: log posts at the corners, plate beams, a steep deepslate gable roof.
    `walls` lists sides ("n", "s", "e", "w") closed with black-and-ash planking."""
    x0, z0, x1, z1 = rect
    for (x, z) in ((x0, z0), (x1, z0), (x0, z1), (x1, z1)):
        for y in range(1, posts + 1): bp.set(x, y, z, "dark_oak_log", axis="y")
    for x in range(x0, x1 + 1):
        for z in (z0, z1): bp.set(x, posts, z, "dark_oak_log", axis="x")
    for z in range(z0, z1 + 1):
        for x in (x0, x1): bp.set(x, posts, z, "dark_oak_log", axis="z")
    for side in walls:
        cells = {"n": [(x, z0) for x in range(x0 + 1, x1)], "s": [(x, z1) for x in range(x0 + 1, x1)],
                 "w": [(x0, z) for z in range(z0 + 1, z1)], "e": [(x1, z) for z in range(z0 + 1, z1)]}[side]
        for (x, z) in cells:
            for y in range(1, posts): bp.set(x, y, z, "siege:pale_ash" if y == 2 else "dark_oak_planks")
    S = Building(bp, P, seed); S.roof(rect, ridge, posts + 1, overhang=1, verge=1, pitch=1); S.build_roofs()

def signpost(bp, x, z):
    for y in range(1, 5): bp.set(x, y, z, "cobbled_deepslate_wall")
    for d in (-1, 1):
        bp.set(x + d, 4, z, "dark_oak_fence"); bp.set(x, 3, z + d, "dark_oak_fence")
    bp.set(x, 5, z, "soul_lantern")

def pilgrims_cross(seed=0):
    """The west crossroads: a roofed waymarker over a bench, a four-armed signpost on a stepped plinth."""
    P = hollow_palette(seed); bp = Blueprint("hollow_pilgrims_cross")
    for x in range(-1, 2):
        for z in range(-1, 2): bp.set(x, 1, z, "polished_blackstone_bricks")
    for d in range(4):
        x, z = ((0, -2), (0, 2), (-2, 0), (2, 0))[d]
        bp.set(x, 1, z, "polished_blackstone_brick_stairs", facing={0: "s", 1: "n", 2: "e", 3: "w"}[d])
    for y in range(2, 6): bp.set(0, y, 0, "cobbled_deepslate_wall")
    for d in (-1, 1): bp.set(d, 5, 0, "dark_oak_fence"); bp.set(0, 4, d, "dark_oak_fence")
    bp.set(0, 6, 0, "soul_lantern")
    shed(bp, P, (-6, 2, -2, 6), "z", seed + 1, posts=3, walls=("w",))   # the pilgrims' shelter
    for z in (3, 4, 5): bp.set(-5, 1, z, "dark_oak_stairs", facing="w")
    bp.set(4, 1, 4, "chiseled_polished_blackstone"); bp.set(4, 2, 4, "chiseled_polished_blackstone")
    lamp(bp, 4, 1, -3)
    bp.markers["door"] = (0, 1, 0)
    return bp

def cartmeet(seed=0):
    """The east crossroads where ore carts turn: a cart shelter over a stub of rail, signpost, lamp, barrels."""
    P = hollow_palette(seed); bp = Blueprint("hollow_cartmeet")
    signpost(bp, 0, 0)
    for z in range(-3, 4): bp.set(3, 0, z, "cobbled_deepslate"); bp.set(3, 1, z, "rail")
    shed(bp, P, (2, -3, 6, 3), "z", seed + 2, posts=3, walls=("e",))
    bp.set(5, 1, -2, "barrel"); bp.set(5, 1, 2, "barrel"); bp.set(5, 2, 2, "barrel")
    lamp(bp, -4, 1, 3)
    bp.markers["door"] = (0, 1, 0)
    return bp

def lattice_gate(seed=0):
    """Where the lane ends at the thick forest: a woodcutter's shed, a stack of cut lattice, a chopping block."""
    P = hollow_palette(seed); bp = Blueprint("hollow_lattice_gate")
    shed(bp, P, (-4, -6, 0, -2), "x", seed + 3, posts=3, walls=("n", "w"))
    bp.set(-3, 1, -5, "crafting_table"); bp.set(-1, 1, -5, "barrel")
    for x in (3, 4, 5):
        for z in (1, 2):
            for y in (1, 2): bp.set(x, y, z, "siege:hollowwood_lattice")
    bp.set(2, 1, -1, "dark_oak_log", axis="y")   # the chopping block
    lamp(bp, 2, 1, -4)
    bp.markers["door"] = (0, 1, 0)
    return bp

def wound_dock(seed=0):
    """The first dock a new arrival sees: a plank landing on log piles, a boatwright's shed, a signpost,
    a lamp, and a Latticewood boat frame on the bank."""
    P = hollow_palette(seed); bp = Blueprint("hollow_wound_dock")
    for x in range(-3, 4):
        for z in range(-5, 2): bp.set(x, 0, z, "dark_oak_planks" if x % 3 else "spruce_planks")
    for (x, z) in ((-3, -5), (3, -5), (-3, -2), (3, -2)):
        for y in range(-3, 2): bp.set(x, y, z, "dark_oak_log", axis="y")
    for x in range(-3, 4):
        if x not in (-3, 3): bp.set(x, 1, -5, "dark_oak_fence")
    signpost(bp, 4, 2); lamp(bp, -4, 1, -5)
    shed(bp, P, (-8, 2, -4, 6), "z", seed + 4, posts=3, walls=("w", "s"))
    for z in (3, 4, 5): bp.set(-1, 1, z, "siege:hollowwood_lattice"); bp.set(1, 1, z, "siege:hollowwood_lattice")
    bp.set(0, 1, 3, "siege:hollowwood_lattice"); bp.set(0, 1, 5, "siege:hollowwood_lattice")   # a boat being built
    bp.markers["door"] = (0, 1, 0)
    return bp

def the_seams(seed=0):
    """An open ore face in a cliff with a timbered mouth, a winch house over the rail, and the cart rail
    running off toward Cartmeet."""
    P = hollow_palette(seed); bp = Blueprint("hollow_the_seams")
    rock = mix([("basalt", 75), ("blackstone", 25)], 330 + seed)
    for x in range(9, 16):
        for z in range(-9, 10):
            for y in range(1, 12 - abs(z) // 4 + int(h3(x, 0, z, seed) * 2)):
                bp.set(x, y, z, "siege:choir_ore" if x == 9 and h3(z, y, 0, 911) < 0.35 else rock, axis="y")
    for x in range(9, 13):
        for y in (1, 2, 3):
            for z in (-1, 0, 1): bp.set(x, y, z, "air")
    for z in (-2, 2):
        for y in range(1, 5): bp.set(8, y, z, "dark_oak_log", axis="y")
    for z in range(-2, 3): bp.set(8, 4, z, "dark_oak_log", axis="z")
    bp.set(8, 3, 0, "soul_lantern", hanging=True)
    for x in range(-8, 12): bp.set(x, 0, 0, "cobbled_deepslate"); bp.set(x, 1, 0, "rail")
    shed(bp, P, (0, -2, 4, 2), "x", seed + 5, posts=4)   # the winch house straddling the rail
    for y in (5, 6): bp.set(2, y, 0, "dark_oak_log", axis="y")
    bp.set(2, 4, 0, "iron_chain")
    lamp(bp, 6, 1, -4)
    bp.markers["door"] = (0, 1, 0)
    return bp

SITE_BUILDERS = {"pilgrims_cross": pilgrims_cross, "cartmeet": cartmeet, "truce_hall": truce_hall,
                 "far_door": far_door, "lattice_gate": lattice_gate, "the_seams": the_seams, "wound_dock": wound_dock}

# every Hollow build that leaves this module gets the Hollow's last pass once (the village's cottages are
# pasted into it, so the village is finished whole, not cottage by cottage)
def _finished(fn):
    def f(*a, **k): return finish_hollow(fn(*a, **k))
    f.__name__, f.__doc__ = fn.__name__, fn.__doc__
    return f
SITE_BUILDERS = {k: _finished(v) for k, v in SITE_BUILDERS.items()}
_village, _tower, _cottage = village, leaning_tower, cottage
village = _finished(_village); leaning_tower = _finished(_tower)
def cottage_finished(*a, **k): return finish_hollow(_cottage(*a, **k))
