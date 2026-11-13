"""The Lantern Spire, rebuilt (Mateo, 2026-11-12: "The roof is messed up. Also, we have better instructions for roof
designs"). Roofs now come from the skill's spire part (build-instructions/06-roof steep roofs and towers/README):
tidy stepped rings of stairs with a flared eave, never a pyramid of slices.

    python3 make_lantern_spire.py   -> lantern_spire.json (a minecraft-builder spec), then run export_wonders.py

Blackfen (regions/blackfen.md: mud brick between mangrove posts on stilts, mossy dark shingle, froglights and
lanterns that show through fen mist). A beacon for those lost in the fen: a deck on mangrove piles over the
black water with boardwalk piers to four landings, a mud brick shaft framed in mangrove rising in four stages,
each stage hooded by its own mossy skirt roof with lanterns hung on chains from every corner, a jettied lamp room
glowing with ochre froglights, and a steep dark helm roof with a flared eave, an open lantern on the tip. About
86 high. Front = +z.
"""
import json, math, os, random

HERE = os.path.dirname(os.path.abspath(__file__))
rng = random.Random(570)
cells = {}


def put(x, y, z, b, **p): cells[(x, y, z)] = [b, p] if p else [b]


def pick(pairs):
    r, acc = rng.random(), 0.0
    for b, w in pairs:
        acc += w
        if r < acc: return b
    return pairs[-1][0]


def opp(f): return {"e": "w", "w": "e", "n": "s", "s": "n"}[f]
def out_face(x, z): return ("e" if x > 0 else "w") if abs(x) >= abs(z) else ("s" if z > 0 else "n")


MUD = [("mud_bricks", 0.7), ("packed_mud", 0.2), ("mud_bricks", 0.1)]
DECK = 4                                            # deck level (piles 0..3 under it)
H = 5                                               # the shaft is 11 wide
STAGES = [(DECK + 1, 15), (16, 26), (27, 37), (38, 48)]


def hang(x, y, z, n):
    """A chain of n links down from (x, y, z), a lantern at the end."""
    for k in range(n): put(x, y - k, z, "iron_chain")
    put(x, y - n, z, "lantern", hanging=True)


def deck():
    for x in range(-15, 16):
        for z in range(-15, 16):
            m = max(abs(x), abs(z))
            if m > 15 or abs(x) + abs(z) > 26: continue
            put(x, DECK, z, "mangrove_planks" if (x + z) % 5 else "stripped_mangrove_log")
            if (m == 15 or abs(x) + abs(z) == 26) or (abs(x) % 5 == 0 and abs(z) % 5 == 0):
                for y in range(0, DECK): put(x, y, z, "mangrove_log")
            if m == 15 or abs(x) + abs(z) == 26:
                put(x, DECK + 1, z, "mangrove_fence")
    for (x, z) in ((15, 11), (11, 15), (-15, 11), (-11, 15), (15, -11), (11, -15), (-15, -11), (-11, -15)):
        for y in range(DECK + 1, DECK + 5): put(x, y, z, "mangrove_fence")
        put(x, DECK + 5, z, "ochre_froglight")
    # four boardwalk piers out to landings, lantern posts along them, a gap in the rail where each starts
    for (dx, dz) in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        for k in range(15, 30):
            for w in (-1, 0, 1):
                x, z = (w, dz * k) if dx == 0 else (dx * k, w)
                put(x, DECK - 1, z, "mangrove_slab", half="top")
                if abs(w) == 1 and k % 4 == 3:
                    for y in range(0, DECK - 1): put(x, y, z, "mangrove_log")
            for w in (-2, 2):
                x, z = (w, dz * k) if dx == 0 else (dx * k, w)
                put(x, DECK, z, "mangrove_fence")
                if k % 6 == 0:
                    for y in range(DECK + 1, DECK + 4): put(x, y, z, "mangrove_fence")
                    hx, hz = (x - (1 if w > 0 else -1), z) if dx == 0 else (x, z - (1 if w > 0 else -1))
                    put(x, DECK + 4, z, "mangrove_fence"); put(hx, DECK + 4, hz, "mangrove_fence"); hang(hx, DECK + 3, hz, 0)
        for w in (-1, 0, 1):
            x, z = (w, dz * 15) if dx == 0 else (dx * 15, w)
            cells.pop((x, DECK + 1, z), None)
            put(x, DECK, z, "mangrove_stairs", facing="n" if dz == 1 else "s" if dz == -1 else "w" if dx == 1 else "e")
    # moss and lily pads round the piles (water is the map's)
    for _ in range(140):
        x, z = rng.randint(-14, 14), rng.randint(-14, 14)
        if max(abs(x), abs(z)) > 6 and (x, DECK + 1, z) not in cells: put(x, DECK + 1, z, "moss_carpet")


def shaft():
    for (y0, y1) in STAGES:
        for x in range(-H, H + 1):
            for z in range(-H, H + 1):
                m = max(abs(x), abs(z))
                if m != H and y0 != STAGES[0][0]:
                    if m < H and (x, z) != (0, 0) and y0 > STAGES[0][0]: put(x, y0, z, "mangrove_planks")
                    continue
                along = x if abs(z) == H else z
                for y in range(y0, y1 + 1):
                    if m != H: continue
                    post = abs(along) in (0, H) or abs(along) == 3 and False
                    if post: put(x, y, z, "mangrove_log")
                    elif y == y1 or y == y0: put(x, y, z, "stripped_mangrove_log", axis="x" if abs(z) == H else "z")
                    else: put(x, y, z, pick(MUD) if y > y0 + 3 or rng.random() > 0.3 else "packed_mud")
        # a pair of windows on each face of the stage, glowing green
        for (x, z) in ((-2, H), (2, H), (-2, -H), (2, -H), (H, -2), (H, 2), (-H, -2), (-H, 2)):
            for y in (y1 - 5, y1 - 4, y1 - 3): put(x, y, z, "green_stained_glass_pane")
            ox, oz = (0, 1 if z > 0 else -1) if abs(z) == H else (1 if x > 0 else -1, 0)
            put(x + ox, y1 - 6, z + oz, "mangrove_slab", half="top")
        if y1 != STAGES[-1][1]: skirt(y1)
    for x in (-1, 0, 1):                              # the door on the front
        for y in (DECK + 1, DECK + 2, DECK + 3): put(x, y, H, "air")
    put(0, DECK + 1, H, "mangrove_door") if False else None


def skirt(y):
    """A hood round the tower at a stage line: two rows of mossy dark oak stairs falling outward (pitch 1),
    trim under the low edge, moss carpet and moss on about a seventh, lanterns on chains at all four corners."""
    for (k, hw) in ((0, H + 1), (1, H + 2)):
        for x in range(-hw, hw + 1):
            for z in range(-hw, hw + 1):
                if max(abs(x), abs(z)) != hw: continue
                f = opp(out_face(x, z))
                if abs(x) == hw and abs(z) == hw:
                    put(x, y + 1 - k, z, "dark_oak_stairs", facing=f)
                    continue
                mossy = rng.random() < 0.14
                put(x, y + 1 - k, z, "mossy_cobblestone_stairs" if mossy else "dark_oak_stairs", facing=f)
                if k == 1: put(x, y - k, z, "dark_oak_stairs", facing=out_face(x, z), half="top")
    for x in range(-H, H + 1):                        # the stairs' upper row sits on a course over the wall
        for z in range(-H, H + 1):
            if max(abs(x), abs(z)) == H: put(x, y + 1, z, "dark_oak_planks")
    for sx in (-1, 1):
        for sz in (-1, 1):
            hang(sx * (H + 2), y - 2, sz * (H + 2), 2)
            put(sx * (H + 2), y - 1, sz * (H + 2), "dark_oak_planks")


def lamp_room():
    """Jettied 15-wide lamp room, y 50 to 58, posts every 2, the bays filled with ochre froglight behind yellow
    glass, brackets under every post, then the helm roof (a part) with a flared eave."""
    y0, y1, L = 50, 58, H + 2
    for x in range(-L, L + 1):
        for z in range(-L, L + 1):
            m = max(abs(x), abs(z))
            put(x, y0, z, "mangrove_planks")
            if m != L: continue
            along = x if abs(z) == L else z
            for y in range(y0 + 1, y1 + 1):
                post = abs(along) % 2 == 1 or abs(along) == L
                if y == y1: put(x, y, z, "stripped_mangrove_log", axis="x" if abs(z) == L else "z")
                elif post: put(x, y, z, "mangrove_log")
                else: put(x, y, z, "yellow_stained_glass")
            if abs(along) % 2 == 1:
                put(x, y0 - 1, z, "mangrove_stairs", facing=opp(out_face(x, z)), half="top")
    for x in range(-L + 1, L):
        for z in range(-L + 1, L):
            if max(abs(x), abs(z)) == L - 1:
                for y in range(y0 + 1, y1): put(x, y, z, "ochre_froglight" if (x + z + y) % 3 == 0 else "air")
    for x in range(-L, L + 1):                        # the floor's corbel course down onto the shaft
        for z in range(-L, L + 1):
            if max(abs(x), abs(z)) == H + 1: put(x, y0 - 1, z, "dark_oak_planks")
    for y in range(49, 50): pass
    # the shaft's last bit up to the lamp room
    for x in range(-H, H + 1):
        for z in range(-H, H + 1):
            if max(abs(x), abs(z)) == H: put(x, 49, z, "mangrove_log" if abs(x) == H and abs(z) == H else pick(MUD))
    # lanterns hung under the hood's corners (eave at y 59, overhang 2)
    for sx in (-1, 1):
        for sz in (-1, 1):
            hang(sx * (L + 1), 58, sz * (L + 1), 1)


def write():
    deck(); shaft(); lamp_room()
    place = [[x, y, z, v[0]] + ([v[1]] if len(v) > 1 else []) for (x, y, z), v in sorted(cells.items())]
    L = H + 2
    parts = [{"part": "spire", "rect": [-L, -L, L, L], "y": 59, "rows": 3, "overhang": 2,
              "roof": {"block": "dark_oak_planks"}, "trim": "mangrove_planks", "finial": "tall"}]
    spec = {"name": "lantern_spire", "edition": "bedrock", "materials": {}, "shapes": [], "parts": parts, "place": place}
    with open(os.path.join(HERE, "lantern_spire.json"), "w") as f:
        json.dump(spec, f, separators=(",", ":"))
    print("lantern_spire.json", len(place), "placed cells")


if __name__ == "__main__":
    write()
