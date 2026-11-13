"""The Choir ore barge (Mateo 2026-11-12 picked: each dawn a barge carries the Choir Seam's ore down the light river to
the arrival landing). Hollow style (skill regions/hollow.md): black timber, soul light, a cabin roof one block off
true, no Crown colours. This is the block model: the barge moored at a Choir Seam jetty, and the shape the moving
barge entity's model follows.

Frame: x along the barge (bow east, +x), z across (port north), y 0 = the water surface. 15 long, 5 wide (odd).
    barge(place, x0, z0, size="long"|"short") writes it at an offset; spec() returns a standalone spec on water.
"""
import json, os, sys

HULL = "dark_oak_planks"
TRIM = "dark_oak"


def barge(place, ox=0, oz=0, length=15, oy=0):
    """A flat-bottomed river barge: square stern with a tiller, a raked bow on stairs, low sides of planks with a
    trapdoor rail, a deck of slabs, ore crates and barrels amidships under a crooked cabin, a lantern pole at the
    bow and a punt pole lying along the side"""
    L = length
    P = lambda x, y, z, b, p=None: place.append([ox + x, oy + y, oz + z, b] + ([p] if p else []))
    half = 2
    for x in range(L):
        bow = x >= L - 2
        w = half - (1 if x == L - 1 else 0)                 # the bow narrows in its last block
        for z in range(-w, w + 1):
            side = abs(z) == w
            P(x, -1, z, HULL)                                # bottom, just under the waterline
            if side or x == 0 or x == L - 1:
                P(x, 0, z, HULL)                             # the sides
                if not (x == L - 1 and z == 0):
                    f = "n" if z < 0 else "s" if z > 0 else ("w" if x == 0 else "e")
                    P(x, 1, z, f"{TRIM}_trapdoor", {"facing": f, "open": True})
            else:
                P(x, 0, z, f"{TRIM}_slab", {"half": "top"})  # the deck
        if bow:
            P(x, 0, 0, HULL)
    # the raked bow: a stair stem rising forward, a carved post on the tip
    P(L, 0, 0, f"{TRIM}_stairs", {"facing": "w"})
    P(L - 1, 1, 0, "dark_oak_log", {"axis": "x"})
    P(L - 1, 2, 0, "dark_oak_fence")
    P(L - 1, 3, 0, "dark_oak_fence")
    P(L - 1, 4, 0, "soul_lantern", {"hanging": False})
    # stern: a tiller post and the rudder hanging in the water
    P(-1, 0, 0, "dark_oak_fence"); P(-1, -1, 0, "dark_oak_fence")
    P(-1, 1, 0, "dark_oak_fence"); P(-1, 2, 0, "dark_oak_trapdoor", {"facing": "w", "half": "top"})
    # the cargo: Choir Ore in open crates (ore blocks inside trapdoor boxes) and sealed barrels
    cx0 = 3
    for x in range(cx0, cx0 + 3):
        for z in (-1, 0, 1):
            P(x, 1, z, "siege:choir_ore" if (x + z) % 2 == 0 else "barrel")
    for x in range(L - 6, L - 3):
        for z in (-1, 1): P(x, 1, z, "barrel")
        P(x, 1, 0, "barrel")
    P(L - 5, 2, 0, "barrel")
    # the bargeman's cabin aft: dark oak corner posts, pale ash walls with warm froglight windows, a door to the
    # deck, and a steep deepslate roof sitting one block off true to port (the Hollow's crookedness)
    for x in (0, 2):
        for z in (-1, 1):
            for y in (1, 2, 3): P(x, y, z, "dark_oak_log")
    for y in (1, 2, 3):
        P(1, y, -1, "ochre_froglight" if y == 2 else "siege:pale_ash")
        P(1, y, 1, "ochre_froglight" if y == 2 else "siege:pale_ash")
        P(0, y, 0, "siege:pale_ash")
    P(2, 1, 0, "dark_oak_door", {"facing": "e"}); P(2, 2, 0, "dark_oak_door", {"facing": "e", "upper": True}); P(2, 3, 0, "siege:pale_ash")
    P(1, 1, 0, "air"); P(1, 2, 0, "air"); P(1, 3, 0, "air")
    for x in range(-1, 4):
        P(x, 4, -3, "deepslate_tile_stairs", {"facing": "s"})
        for z in (-2, -1, 0): P(x, 4, z, "cobbled_deepslate" if (x + z) % 3 == 0 else "deepslate_tiles")
        P(x, 4, 1, "deepslate_tile_stairs", {"facing": "n"})
        P(x, 5, -2, "deepslate_tile_stairs", {"facing": "s"})
        P(x, 5, -1, "deepslate_tiles")
        P(x, 5, 0, "deepslate_tile_stairs", {"facing": "n"})
        P(x, 6, -1, "deepslate_tile_slab")
    P(3, 3, -2, "soul_lantern", {"hanging": True})
    P(2, 7, -1, "polished_blackstone_brick_wall")         # the stove pipe through the roof
    P(2, 6, -1, "polished_blackstone_bricks")


def spec(length=15):
    place = []
    for x in range(-4, length + 5):
        for z in range(-6, 7):
            place += [[x, -3, z, "siege:glimmerflow"], [x, -2, z, "water"], [x, -1, z, "water"]]
    barge(place, 0, 0, length)
    return {"name": "choir_barge", "edition": "bedrock",
            "shapes": [{"shape": "box", "min": [-4, -5, -6], "max": [length + 4, -4, 6], "material": "deepslate"}],
            "parts": [], "place": place}


def specs(ground_plate=False, skill=None, regions=None):
    return {"choir_barge": spec()}


if __name__ == "__main__":
    json.dump(spec(), open(os.path.join(sys.argv[1], "choir_barge.json"), "w"))
    print("ok")
