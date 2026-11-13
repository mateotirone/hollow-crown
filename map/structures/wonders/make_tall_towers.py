"""The Great Lighthouse and the High Watch, rebuilt as real wonders (Mateo, 2026-11-12: "It's called the Great
Lighthouse, and it's only 46 blocks tall"; "If it's going to be a high watchtower, then let it be a high
watchtower"). Both follow build-instructions/towers/README.md: a solid shaft with strong corners, stages marked
by courses, a top stage that changes and overhangs on corbels, a steep or region-right roof, a finish on top,
and an outline that changes many times from the ground to the tip.

    python3 make_tall_towers.py   -> great_lighthouse.json, high_watch.json (minecraft-builder specs)

Then run export_wonders.py. Front = +z for both.
"""
import json, math, os, random

HERE = os.path.dirname(os.path.abspath(__file__))


class Cells:
    def __init__(self, seed):
        self.c = {}; self.rng = random.Random(seed)

    def put(self, x, y, z, b, **p): self.c[(x, y, z)] = [b, p] if p else [b]
    def has(self, x, y, z): return (x, y, z) in self.c
    def drop(self, x, y, z): self.c.pop((x, y, z), None)

    def pick(self, pairs):
        r, acc = self.rng.random(), 0.0
        for b, w in pairs:
            acc += w
            if r < acc: return b
        return pairs[-1][0]

    def place(self):
        return [[x, y, z, v[0]] + ([v[1]] if len(v) > 1 else []) for (x, y, z), v in sorted(self.c.items())]


def oct_in(x, z, a, c=None):
    c = round(a * 0.42) if c is None else c
    return abs(x) <= a and abs(z) <= a and abs(x) + abs(z) <= 2 * a - c


def out_face(x, z):
    return ("e" if x > 0 else "w") if abs(x) >= abs(z) else ("s" if z > 0 else "n")


# =============================================================================================== lighthouse
WHITE = [("calcite", 0.55), ("smooth_quartz", 0.3), ("polished_diorite", 0.15)]


def lighthouse():
    """Saltreach's Pharos: a square whitewashed base with corner bartizans and a ramp to a high door, an octagonal
    middle stage with a gallery, a round upper stage, the lamp room on a wide gallery, a sea-green copper dome, a
    gilded cupola. About 108 high. Saltreach keeps low caps (no needle spires)."""
    C = Cells(960)
    white = lambda: C.pick(WHITE)
    # --- stage A: the square base, 23 wide, to y 36, battered foot, sandstone quoins, teal courses
    A, TOP_A = 11, 36
    for x in range(-A - 2, A + 3):
        for z in range(-A - 2, A + 3):
            m = max(abs(x), abs(z))
            if m <= A + 2: C.put(x, 0, z, "smooth_stone" if m > A else "polished_diorite")
            if m == A + 1:
                C.put(x, 1, z, "smooth_sandstone"); C.put(x, 2, z, "smooth_sandstone_stairs", facing={"e": "w", "w": "e", "n": "s", "s": "n"}[out_face(x, z)])
            if m > A: continue
            for y in range(1, TOP_A + 1):
                edge = m == A
                if not edge and y % 9 != 0: continue          # floors every 9 inside
                b = white()
                if edge and abs(x) == A and abs(z) == A: b = "cut_sandstone" if (y // 2) % 2 else "smooth_sandstone"
                if edge and y in (12, 24): b = "prismarine_bricks"
                C.put(x, y, z, b)
    for y in (12, 24, TOP_A - 1):                            # string courses and the cornice, one out
        for x in range(-A - 1, A + 2):
            for z in range(-A - 1, A + 2):
                if max(abs(x), abs(z)) == A + 1 and not (abs(x) == A + 1 and abs(z) == A + 1):
                    C.put(x, y, z, "prismarine_bricks_stairs", facing=out_face(x, z) and {"e": "w", "w": "e", "n": "s", "s": "n"}[out_face(x, z)], half="top")
    for x in range(-A - 1, A + 2):                           # the terrace on top with a parapet of pillars and walls
        for z in range(-A - 1, A + 2):
            if max(abs(x), abs(z)) == A + 1:
                C.put(x, TOP_A, z, "smooth_quartz")
                C.put(x, TOP_A + 1, z, "quartz_pillar" if (x + z) % 4 == 0 else "prismarine_wall")
            else:
                C.put(x, TOP_A, z, "smooth_stone" if (x + z) % 2 else "polished_diorite")
    # arched windows on every face: three bays of tall lancets in two rows
    for a in (-6, 0, 6):
        for y0 in (14, 26):
            for (x, z) in ((a, A), (a, -A), (A, a), (-A, a)):
                for y in range(y0, y0 + 3): C.put(x, y, z, "light_blue_stained_glass")
                ox, oz = (0, 1 if z > 0 else -1) if abs(z) == A else (1 if x > 0 else -1, 0)
                f = out_face(x, z)
                C.put(x + ox, y0 - 1, z + oz, "smooth_quartz_slab", half="top")
                C.put(x, y0 + 3, z, "prismarine_bricks_stairs", facing={"e": "w", "w": "e", "n": "s", "s": "n"}[f], half="top")
    # corner bartizans: round turrets on corbels with little sea-green domes
    for sx in (-1, 1):
        for sz in (-1, 1):
            cx, cz = sx * A, sz * A
            for x in range(-3, 4):
                for z in range(-3, 4):
                    r = math.hypot(x, z)
                    if r <= 2.6:
                        C.put(cx + x, 27, cz + z, "prismarine_bricks")
                        for y in range(28, 41):
                            if r > 1.6 or y in (28, 40): C.put(cx + x, y, cz + z, white() if y not in (34,) else "prismarine_bricks")
                        if r > 1.6 and y and (abs(x) + abs(z)) % 2 == 0: C.put(cx + x, 41, cz + z, "prismarine_wall")
                    if 2.6 < r <= 3.4: C.put(cx + x, 26, cz + z, "prismarine_bricks_stairs", facing=out_face(x, z) and {"e": "w", "w": "e", "n": "s", "s": "n"}[out_face(x, z)], half="top")
            for (yy, rr) in ((41, 2.2), (42, 1.6), (43, 0.8)):
                for x in range(-2, 3):
                    for z in range(-2, 3):
                        if math.hypot(x, z) <= rr: C.put(cx + x, yy, cz + z, "waxed_oxidized_cut_copper")
            C.put(cx, 44, cz, "gold_block"); C.put(cx, 45, cz, "lightning_rod")
            for (x, z) in ((sx * 2, 0), (0, sz * 2)):
                C.put(cx + x, 32, cz + z, "light_blue_stained_glass"); C.put(cx + x, 33, cz + z, "light_blue_stained_glass")
    # the high door and the ramp up to it on the front
    DOOR_Y = 7
    for x in range(-2, 3):
        for y in range(DOOR_Y, DOOR_Y + 5): C.drop(x, y, A)
    for x in (-1, 0, 1):
        for y in range(DOOR_Y, DOOR_Y + 4): C.put(x, y, A, "air")
    for x in range(-3, 4):
        C.put(x, DOOR_Y + 5, A + 1, "prismarine_bricks_stairs", facing="n", half="top")
    C.put(-3, DOOR_Y + 4, A + 1, "prismarine_bricks_stairs", facing="e", half="top"); C.put(3, DOOR_Y + 4, A + 1, "prismarine_bricks_stairs", facing="w", half="top")
    for k in range(0, 14):                                   # the ramp: 7 wide, rising 1 every 2, on arches
        z = A + 1 + 14 - k
        y = (k + 1) // 2
        for x in range(-3, 4):
            if abs(x) == 3:
                for yy in range(1, y + 2): C.put(x, yy, z, "smooth_sandstone" if yy <= y else "prismarine_wall")
            else:
                for yy in range(1, y): C.put(x, yy, z, "smooth_sandstone")
                C.put(x, y, z, "smooth_quartz_stairs", facing="n") if k % 2 == 0 else C.put(x, y, z, "smooth_quartz")
    for x in range(-3, 4):
        for z in range(A + 1, A + 3): C.put(x, DOOR_Y - 1, z, "smooth_quartz"); [C.put(x, yy, z, "smooth_sandstone") for yy in range(1, DOOR_Y - 1)]
    for (x, z) in ((-3, A + 15), (3, A + 15), (-3, A + 8), (3, A + 8)):
        y = C.c.get((x, 4, z)) and 0
        top = max(yy for (xx, yy, zz) in C.c if xx == x and zz == z) + 1
        C.put(x, top, z, "prismarine_wall"); C.put(x, top + 1, z, "sea_lantern")
    # --- stage B: octagon 15 wide, y 37 to 70, teal bands, lancets, a gallery at the top
    B, TOP_B = 7, 70
    for x in range(-B, B + 1):
        for z in range(-B, B + 1):
            if not oct_in(x, z, B): continue
            edge = not oct_in(x, z, B - 1)
            for y in range(TOP_A + 1, TOP_B + 1):
                if not edge and y % 9 != 0: continue
                C.put(x, y, z, "prismarine_bricks" if edge and y in (45, 54, 63) else white())
    for y0 in (39, 48, 57, 64):
        for (x, z) in ((0, B), (0, -B), (B, 0), (-B, 0)):
            for y in range(y0, y0 + 3): C.put(x, y, z, "light_blue_stained_glass")
    for x in range(-B - 2, B + 3):                           # gallery on corbels
        for z in range(-B - 2, B + 3):
            if oct_in(x, z, B + 2) and not oct_in(x, z, B):
                C.put(x, TOP_B, z, "smooth_quartz_slab", half="top")
                if not oct_in(x, z, B + 1): C.put(x, TOP_B + 1, z, "prismarine_wall")
            if oct_in(x, z, B + 1) and not oct_in(x, z, B):
                C.put(x, TOP_B - 1, z, "prismarine_bricks_stairs", facing={"e": "w", "w": "e", "n": "s", "s": "n"}[out_face(x, z)], half="top")
    # --- stage C: round, 9 wide, y 71 to 88
    TOP_C = 88
    for x in range(-5, 6):
        for z in range(-5, 6):
            r = math.hypot(x, z)
            if r > 4.6: continue
            for y in range(TOP_B, TOP_C + 1):
                if r > 3.6 or y in (TOP_B, 80): C.put(x, y, z, "prismarine_bricks" if r > 3.6 and y in (78, 86) else white())
    for (x, z) in ((0, 4), (0, -4), (4, 0), (-4, 0)):
        for y in (74, 75, 82, 83): C.put(x, y, z, "light_blue_stained_glass")
    # --- the lamp room: a wide gallery on corbels, a glass drum with copper mullions, the light inside
    G = 89
    for x in range(-8, 9):
        for z in range(-8, 9):
            r = math.hypot(x, z)
            if r <= 6.7: C.put(x, G, z, "smooth_quartz" if r > 4.6 else "polished_diorite")
            if 4.6 < r <= 6.7 and r > 5.7: C.put(x, G + 1, z, "prismarine_wall")
            if 4.6 < r <= 5.8: C.put(x, G - 1, z, "prismarine_bricks_stairs", facing={"e": "w", "w": "e", "n": "s", "s": "n"}[out_face(x, z)], half="top")
            if 5.8 < r <= 6.7: C.put(x, G - 1, z, "smooth_quartz_slab", half="top")
            if 3.6 < r <= 4.6:
                ang = math.atan2(z, x)
                post = abs(((ang + math.pi) / (math.pi / 4)) % 1 - 0.5) > 0.38
                for y in range(G + 1, G + 8): C.put(x, y, z, "waxed_oxidized_cut_copper" if post else "light_blue_stained_glass")
            if r <= 1.5:
                for y in range(G + 1, G + 7): C.put(x, y, z, "sea_lantern" if (x + z + y) % 2 else "glowstone")
    # the dome: an eave ring, a sea-green copper hemisphere, a little open cupola and a gilded finial
    D = G + 8
    for x in range(-6, 7):
        for z in range(-6, 7):
            r = math.hypot(x, z)
            if 4.6 < r <= 5.7: C.put(x, D, z, "waxed_oxidized_cut_copper_stairs", facing={"e": "w", "w": "e", "n": "s", "s": "n"}[out_face(x, z)])
            for (yy, rr) in ((0, 4.6), (1, 4.4), (2, 4.0), (3, 3.3), (4, 2.3)):
                if r <= rr and (r > rr - 1.4 or yy == 4): C.put(x, D + yy, z, "waxed_oxidized_cut_copper" if yy > 1 else "waxed_weathered_cut_copper")
    for (x, z) in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
        for y in (D + 5, D + 6): C.put(x, y, z, "prismarine_wall")
    C.put(0, D + 5, 0, "lantern")
    for x in (-1, 0, 1):
        for z in (-1, 0, 1): C.put(x, D + 7, z, "waxed_oxidized_cut_copper_slab")
    C.put(0, D + 7, 0, "gold_block"); C.put(0, D + 8, 0, "gold_block"); C.put(0, D + 9, 0, "lightning_rod")
    parts = [{"part": "house", "style": "salt_stone", "rect": [15, -7, 23, 5], "y": 0, "plinth": 1, "storeys": [5, 4],
              "door": {"side": "s"}, "windows": "auto", "roof": {"type": "hip", "pitch": 1}, "interior": "home"}]
    return {"name": "great_lighthouse", "edition": "bedrock", "materials": {}, "shapes": [], "parts": parts, "place": C.place()}


# =============================================================================================== high watch
STONE = [("stone_bricks", 0.5), ("andesite", 0.18), ("cracked_stone_bricks", 0.12), ("mossy_stone_bricks", 0.08), ("cobblestone", 0.12)]


def high_watch():
    """The Vale's high watchtower: a walled bailey with round corner turrets and a gate, a 13-wide shaft 72 high in
    six stages with clasping buttresses, a machicolated parapet, a jettied two-storey timber watch room 17 wide with
    the great bell, four corner bartizans with their own spires, and a slate spire 27 high with an open lantern on
    the tip. About 112 high."""
    C = Cells(370)
    stone = lambda: C.pick(STONE)
    H, TOP = 6, 66
    for x in range(-H - 2, H + 3):
        for z in range(-H - 2, H + 3):
            m = max(abs(x), abs(z))
            C.put(x, 0, z, "polished_andesite" if m <= H + 2 else "cobblestone")
            # clasping buttresses: the corners stand out 2 to y 24, 1 to y 48
            for y in range(1, TOP + 1):
                if m <= H:
                    edge = m == H
                    if not edge and y % 12 != 0: continue
                    b = stone()
                    if edge and abs(x) == H and abs(z) == H: b = "polished_andesite" if (y // 2) % 2 else "stone_bricks"
                    C.put(x, y, z, b)
                else:
                    out = m - H
                    near_corner = (abs(x) >= H - 1 and abs(z) >= H - 1)
                    if near_corner and ((out <= 2 and y <= 24) or (out <= 1 and y <= 48)):
                        C.put(x, y, z, stone())
    for (yb, out) in ((24, 2), (48, 1)):                     # buttress set-offs: a stair cap where each steps in
        for x in range(-H - out, H + out + 1):
            for z in range(-H - out, H + out + 1):
                m = max(abs(x), abs(z))
                if m == H + out and abs(x) >= H - 1 and abs(z) >= H - 1:
                    C.put(x, yb + 1, z, "stone_brick_stairs", facing={"e": "w", "w": "e", "n": "s", "s": "n"}[out_face(x, z)])
    for y in (12, 36, 60):                                   # string courses between the buttresses
        for x in range(-H - 1, H + 2):
            for z in range(-H - 1, H + 2):
                if max(abs(x), abs(z)) == H + 1 and not C.has(x, y, z):
                    C.put(x, y, z, "stone_brick_stairs", facing={"e": "w", "w": "e", "n": "s", "s": "n"}[out_face(x, z)], half="top")
    for y0 in (8, 20, 32, 44, 56):                           # slits low, lancets higher, centre on centre
        h = 2 if y0 < 30 else 3
        for (x, z) in ((0, H), (0, -H), (H, 0), (-H, 0)):
            for y in range(y0, y0 + h): C.put(x, y, z, "gray_stained_glass")
            f = out_face(x, z)
            C.put(x, y0 + h, z, "stone_brick_stairs", facing={"e": "w", "w": "e", "n": "s", "s": "n"}[f], half="top")
    for x in (-1, 0, 1):                                     # the door
        for y in (1, 2, 3): C.put(x, y, H, "air")
    C.put(0, 4, H, "air")
    for x in range(-2, 3): C.put(x, 5, H + 1, "stone_brick_stairs", facing="n", half="top")
    # machicolations: corbels one out at y 66, a parapet wall to y 71 with slits
    for x in range(-H - 1, H + 2):
        for z in range(-H - 1, H + 2):
            if max(abs(x), abs(z)) == H + 1:
                C.put(x, TOP, z, "stone_brick_stairs", facing={"e": "w", "w": "e", "n": "s", "s": "n"}[out_face(x, z)], half="top")
                for y in range(TOP + 1, TOP + 6):
                    slit = (y in (68, 69)) and ((x if abs(z) == H + 1 else z) % 4 == 2)
                    C.put(x, y, z, "gray_stained_glass" if slit else stone())
    # the jettied watch room: 17 wide, timber on stone, two storeys, windows all round, on brackets
    W0, WT = TOP + 6, TOP + 6 + 12                           # floor y 72, plate y 84
    Wh = H + 2
    for x in range(-Wh, Wh + 1):
        for z in range(-Wh, Wh + 1):
            m = max(abs(x), abs(z))
            if m == Wh:
                C.put(x, W0 - 1, z, "spruce_stairs", facing={"e": "w", "w": "e", "n": "s", "s": "n"}[out_face(x, z)], half="top")
            C.put(x, W0, z, "spruce_planks")
            if m != Wh:
                if m <= Wh - 1 and (x, z) != (0, 0): C.put(x, W0 + 6, z, "spruce_planks")
                continue
            along = x if abs(z) == Wh else z
            for y in range(W0 + 1, WT + 1):
                post = abs(along) % 4 == 0 or abs(along) == Wh
                beam = y in (W0 + 6, WT)
                if post or beam: C.put(x, y, z, "stripped_spruce_log", axis="y" if post and not beam else ("x" if abs(z) == Wh else "z"))
                elif (W0 + 2 <= y <= W0 + 4) or (W0 + 8 <= y <= W0 + 10): C.put(x, y, z, "brown_stained_glass_pane")
                else: C.put(x, y, z, "calcite")
    for k in range(-Wh, Wh + 1, 4):                          # big brackets under the jetty at each post
        for (x, z) in ((k, Wh), (k, -Wh), (Wh, k), (-Wh, k)):
            f = out_face(x, z)
            ix, iz = (x, z - (1 if z > 0 else -1)) if abs(z) == Wh else (x - (1 if x > 0 else -1), z)
            C.put(x, W0 - 2, z, "spruce_stairs", facing={"e": "w", "w": "e", "n": "s", "s": "n"}[f], half="top")
            C.put(ix, W0 - 3, iz, "spruce_stairs", facing={"e": "w", "w": "e", "n": "s", "s": "n"}[f], half="top")
    # the great bell hangs in the middle of the watch room
    for y in range(W0 + 7, WT): C.put(0, y, 0, "iron_chain")
    C.put(0, W0 + 6, 0, "bell", attachment="hanging") if False else C.put(0, W0 + 6, 0, "air")
    C.put(0, W0 + 5, 0, "bell")
    # bartizans on the watch room's corners: round turrets with steep cone roofs
    for sx in (-1, 1):
        for sz in (-1, 1):
            cx, cz = sx * (Wh + 1), sz * (Wh + 1)
            for x in range(-3, 4):
                for z in range(-3, 4):
                    r = math.hypot(x, z)
                    if r <= 2.6:
                        C.put(cx + x, W0 - 2, cz + z, "stone_bricks")
                        for y in range(W0 - 1, WT + 1):
                            if r > 1.6: C.put(cx + x, y, cz + z, stone() if y != W0 + 6 else "polished_andesite")
                    if 2.6 < r <= 3.3: C.put(cx + x, WT, cz + z, "deepslate_tile_stairs", facing={"e": "w", "w": "e", "n": "s", "s": "n"}[out_face(x, z)])
            for k in range(9):                               # cone: radius 2.6 down to a point over 9
                rr = 2.6 * (1 - k / 9)
                for x in range(-3, 4):
                    for z in range(-3, 4):
                        if math.hypot(x, z) <= rr + 0.15: C.put(cx + x, WT + 1 + k, cz + z, "deepslate_tiles" if k % 3 else "deepslate_bricks")
            C.put(cx, WT + 10, cz, "spruce_fence"); C.put(cx, WT + 11, cz, "lightning_rod")
            for (x, z) in ((sx * 2, 0), (0, sz * 2)):
                for y in (W0 + 2, W0 + 3, W0 + 8, W0 + 9): C.put(cx + x, y, cz + z, "brown_stained_glass_pane")
    spec_parts = [
        {"part": "spire", "rect": [-Wh, -Wh, Wh, Wh], "y": WT + 1, "rows": 4, "overhang": 1,
         "roof": {"block": "deepslate_tiles"}, "trim": "spruce_planks", "finial": "tall"},
        # the bailey: a curtain wall with round corner turrets and a gate on the front
        {"part": "curtain", "path": [[-19, 19], [-19, -19], [19, -19], [19, 19], [-19, 19]], "y": 0, "h": 6,
         "material": "bailey", "cap": "stone_bricks",
         "turrets": [{"at": [-19, -19], "size": 5, "h": 11}, {"at": [19, -19], "size": 5, "h": 11},
                     {"at": [-19, 19], "size": 5, "h": 11}, {"at": [19, 19], "size": 5, "h": 11}],
         "gate": {"at": [0, 19], "face": "s", "w": 3, "h": 4, "crown": 4, "banner": "red_wool"}},
    ]
    # an open lantern on the spire's tip: four posts, a lantern, a tiny cap (towers/README step 6)
    tip = WT + 1 + 1 + 3 * (Wh + 1) - 2
    C.c.update({})
    return {"name": "high_watch", "edition": "bedrock", "materials": {"bailey": {"ladder": ["cobblestone", "stone_bricks", "andesite"], "axis": "noise", "scale": 3}}, "shapes": [], "parts": spec_parts, "place": C.place(), "_tip": tip}


def main():
    for name, fn in (("great_lighthouse", lighthouse), ("high_watch", high_watch)):
        spec = fn(); spec.pop("_tip", None)
        with open(os.path.join(HERE, f"{name}.json"), "w") as f:
            json.dump(spec, f, separators=(",", ":"))
        print(name, len(spec["place"]), "placed cells")


if __name__ == "__main__":
    main()
