"""The Hollow's own building kit, and the Hollow's buildings made with it.

The Hollow is a separate world seeping into ours (not a mirror), so its buildings are their own: dark
veinstone and blackstone walls, black timber with pale ash between, steep deepslate roofs, warm lit
windows in the miners' homes, soul light everywhere else. What makes them uneasy is that nothing stands
quite straight: upper floors lean out of true and ridges sag, the same crookedness as the drowned city
of leaning towers the story's travellers see.

Frame as everywhere in map/structures: y = 0 is the ground's top layer, floors at y = 1.
"""
from bp import Blueprint
from kit import Building, mix, grow, h3
from settle_halls import pyramid, hang

def hollow_palette(seed=0):
    return dict(
        stone=mix([("siege:veinstone_bricks", 74), ("siege:cracked_veinstone_bricks", 14), ("polished_blackstone_bricks", 12)], 300 + seed),
        plinth=mix([("cobbled_deepslate", 70), ("siege:veinstone", 30)], 301 + seed), found="cobbled_deepslate",
        quoin="polished_blackstone", quoin2="polished_blackstone_bricks",
        frame="dark_oak_log", frame2="dark_oak_log", infill="siege:pale_ash",
        floor="dark_oak_planks", gable=None,
        roof=mix([("deepslate_tile_stairs", 84), ("cobbled_deepslate_stairs", 16)], 302 + seed),
        roof_block="deepslate_tiles", roof_slab="deepslate_tile_slab",
        trim="dark_oak_stairs", trim_block="dark_oak_planks", trim_slab="dark_oak_slab",
        bracket="dark_oak_stairs", sill="polished_blackstone_brick_stairs", shutter="dark_oak_trapdoor", shutters=0.25,
        door="dark_oak_door", pane="ochre_froglight", fence="dark_oak_fence",
        chimney=mix([("polished_blackstone_bricks", 70), ("cobbled_deepslate", 30)], 303), chimney_cap="cobbled_deepslate_wall",
        path=mix([("coarse_dirt", 60), ("cobbled_deepslate", 25), ("siege:pale_ash", 15)], 304),
    )

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
            B.window(x, 5, z, side, 1, 1, kind="timber", shutters=False)   # one in from the face, so the pane sits in the wall
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
