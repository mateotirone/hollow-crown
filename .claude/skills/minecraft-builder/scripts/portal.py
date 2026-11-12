r"""Rail tunnel portals: a dressed stone face round each tunnel mouth, for the map's precomputed rail works.

    portal_blocks(mouth, region) -> [(x, y, z, block, props), ...]

mouth: {"x", "z", "floor_y", "out": (dx, dz)}   the last bore cell, the bed's floor height there (the track sits
       at floor_y + 1), and the direction out of the tunnel (any length; the larger axis wins).
region: "Aldmere Vale", "Frostmarch", "Saltreach", "Emberwaste", "Blackfen" (anything else gets the Vale look).

Blocks are logical (map/structures/bp.py props: facing n/s/e/w, half top/bottom); "air" entries are the opening,
which the caller must clear. Nothing is placed on the floor row (the bed is the caller's) and nothing in the 3-wide
corridor up to 6 above the floor. The face stands on the mouth cell and one cell into the hill; wing walls hold the
cutting back for 4 blocks outside it; 2 cells of lining run in behind the face. About 330 blocks a mouth.

Face (looking into the tunnel, 11 wide, u = -5..5; y from the floor row):
    y10  W . . . W W W . . . W        parapet, a lantern on each pilaster
    y9   = = = = = = = = = = =        cornice, overhanging one block
    y8   P # # # # D # # # # P        D date stone
    y7   P # # t t K t t # # P        voussoirs and keystone
    y6   P # # \ . . . / # # P        arch shoulders; corridor clear 6 high
    y1-5 P # # . . . . . # # P        a 5-wide mouth
"""

REGIONS = {
    "Aldmere Vale": dict(main=[("stone_bricks", 5), ("cracked_stone_bricks", 2), ("mossy_stone_bricks", 2)],
                         trim="polished_andesite", stair="polished_andesite_stairs", wall="stone_brick_wall",
                         key="chiseled_stone_bricks", coping="stone_brick_stairs"),
    "Frostmarch": dict(main=[("deepslate_bricks", 5), ("cracked_deepslate_bricks", 2)],
                       trim="polished_deepslate", stair="polished_deepslate_stairs", wall="deepslate_brick_wall",
                       key="chiseled_deepslate", coping="deepslate_brick_stairs"),
    "Saltreach": dict(main=[("stone_bricks", 5), ("cracked_stone_bricks", 2)],
                      trim="polished_diorite", stair="polished_diorite_stairs", wall="stone_brick_wall",
                      key="chiseled_quartz_block", coping="stone_brick_stairs"),
    "Emberwaste": dict(main=[("red_sandstone", 4), ("cut_red_sandstone", 3)],
                       trim="smooth_red_sandstone", stair="smooth_red_sandstone_stairs", wall="red_sandstone_wall",
                       key="chiseled_red_sandstone", coping="smooth_red_sandstone_stairs"),
    "Blackfen": dict(main=[("mud_bricks", 5), ("packed_mud", 2)],
                     trim="mossy_stone_bricks", stair="mossy_stone_brick_stairs", wall="mud_brick_wall",
                     key="chiseled_stone_bricks", coping="mud_brick_stairs"),
}

CARD = {(0, -1): "n", (0, 1): "s", (1, 0): "e", (-1, 0): "w"}


def _h(x, y, z):
    n = (x * 73856093) ^ (y * 19349663) ^ (z * 83492791)
    n = (n ^ (n >> 13)) * 1274126177 & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFFFF) / 0x1000000


def _pick(mix, x, y, z):
    t = _h(x, y, z) * sum(w for _, w in mix)
    for b, w in mix:
        t -= w
        if t < 0: return b
    return mix[-1][0]


def portal_blocks(mouth, region="Aldmere Vale"):
    P = REGIONS.get(region, REGIONS["Aldmere Vale"])
    dx, dz = mouth["out"]
    o = (1 if dx > 0 else -1, 0) if abs(dx) >= abs(dz) else (0, 1 if dz > 0 else -1)
    r = (-o[1], o[0])                                   # to the right, looking out of the tunnel
    face = {"out": CARD[o], "in": CARD[(-o[0], -o[1])], "right": CARD[r], "left": CARD[(-r[0], -r[1])]}
    X, Z, F = mouth["x"], mouth["z"], mouth["floor_y"]
    cells = {}

    def put(u, y, v, b, **p):
        if "facing" in p: p["facing"] = face[p["facing"]]
        cells[(X + u * r[0] + v * o[0], F + y, Z + u * r[1] + v * o[1])] = (b, p)

    def main(u, y, v):
        put(u, y, v, _pick(P["main"], X + u * 7 + v, F + y, Z + u * 3 - v))

    def opening(u, y):
        return (abs(u) <= 2 and 1 <= y <= 5) or (abs(u) <= 1 and y == 6)

    # the face, two deep
    for v in (0, -1):
        for u in range(-5, 6):
            for y in range(1, 10):
                if opening(u, y): put(u, y, v, "air")
                elif abs(u) == 4: put(u, y, v, P["trim"])
                else: main(u, y, v)
    for s in (-1, 1):                                    # arch shoulders, voussoirs, keystone, date stone
        put(2 * s, 6, 0, P["stair"], facing="right" if s > 0 else "left", half="top")
        put(2 * s, 6, -1, P["stair"], facing="right" if s > 0 else "left", half="top")
        for u in (s, 2 * s): put(u, 7, 0, P["trim"])
    put(0, 7, 0, P["key"]); put(0, 8, 0, P["key"])
    # pilasters standing a block proud, the cornice over them, the parapet and two lanterns
    for s in (-1, 1):
        for y in range(1, 9): put(4 * s, y, 1, P["trim"])
        put(4 * s, 1, 1, P["key"])
        put(4 * s, 9, 1, P["trim"])
        put(4 * s, 10, 1, "lantern", hanging=False)
    for u in range(-5, 6):
        if abs(u) != 4: put(u, 9, 1, P["stair"], facing="in", half="top")
        put(u, 10, 0, P["wall"] if abs(u) in (0, 4, 5) or u % 2 else "air")
        put(u, 10, -1, P["trim"])
    # wing walls holding the cutting back, stepping down away from the face
    for s in (-1, 1):
        for v in range(1, 5):
            top = 8 - 2 * v
            for y in range(1, top + 1): main(6 * s, y, v)
            put(6 * s, top + 1, v, P["coping"], facing="in")
        put(5 * s, 9, 1, P["trim"])
        for y in range(1, 9): put(5 * s, y, 1, P["trim"] if y in (1, 8) else _pick(P["main"], s, y, 1))
    # the lining behind the face: walls either side of the corridor and a flat roof
    for v in (-2, -3):
        for u in range(-2, 3):
            for y in range(1, 8):
                if abs(u) <= 1 and y <= 6: put(u, y, v, "air")
                elif abs(u) == 2 or y == 7: main(u, y, v)
    return [(x, y, z, b, p) for (x, y, z), (b, p) in sorted(cells.items())]


if __name__ == "__main__":   # a quick look: python3 portal.py [region]  (prints the face, looking in)
    import sys
    reg = sys.argv[1] if len(sys.argv) > 1 else "Aldmere Vale"
    bl = portal_blocks({"x": 0, "z": 0, "floor_y": 0, "out": (0, -1)}, reg)
    print(len(bl), "blocks")
    m = {(x, y): b for x, y, z, b, p in bl if z == 0}
    for y in range(10, 0, -1):
        print(f"y{y:<3}" + "".join("." if m.get((x, y)) == "air" else " " if (x, y) not in m else m[(x, y)][0].upper() for x in range(-6, 7)))
