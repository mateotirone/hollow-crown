"""Everwake, the city in the sky, as minecraft-builder specs (regions/everwake.md).

Local coordinates: the city's paving is y = -1, so houses stand at y = 0. In the world the paving sits at
Y 254 and the top of the Spire of the Held Note reaches Y 316 (local 61; nothing may pass local 64, Y 319). x east, z south.

specs() -> {"everwake_city": spec, "everwake_needle": spec}
"""
import math, os, random, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from airboat import cells as boat_cells, MOORING  # noqa: E402  (the air boat, PR #305)
from parts import turn_cell  # noqa: E402  (airboat.py puts the skill's scripts on the path)

WORLD_Y = 255            # world Y of local y = 0
STYLE = "everwake_stone"
COPPER = {"ladder": ["waxed_weathered_cut_copper", "waxed_oxidized_cut_copper"], "axis": "y"}
SPIRE_ROOF = {"ladder": ["waxed_weathered_cut_copper", "waxed_oxidized_cut_copper"], "axis": "y"}
PLAZA = {"ladder": ["polished_diorite", "calcite", "smooth_quartz"], "axis": "noise", "scale": 4}
CLOUD = {"ladder": ["light_gray_wool", "white_concrete", "white_wool", "white_wool", "white_wool"], "axis": "y", "texture": False}
ROCK = {"ladder": ["tuff", "andesite", "diorite", "calcite"], "axis": "y"}

R_CITY = 88              # radius of the main disc (round 2, Mateo 2026-11-13: "much more dense ... maybe bigger")
LOBES = [(a, 78, 24.5) for a in (90, 141, 193, 244, 296, 347, 39)]   # cloud-shaped edge (degrees, centre r, radius)
TOWER_R = 64             # the seven bell towers
RINGS = (30, 54, 78)     # ring streets
SPIRE = (-10, -10, 10, 10)
GATE_Z = (93, 101)       # the gatehouse, at the tip of the south lobe


def lobe_centres():
    return [(round(math.cos(math.radians(a)) * r), round(math.sin(math.radians(a)) * r), rr) for a, r, rr in LOBES]


def inside(x, z, margin=0):
    if math.hypot(x, z) <= R_CITY - margin: return True
    return any(math.hypot(x - cx, z - cz) <= rr - margin for cx, cz, rr in lobe_centres())


def towers():
    out = []
    for i in range(7):
        a = math.radians(i * 360 / 7 - 90)                  # one due north; none due south, where the gatehouse avenue runs
        out.append((round(math.cos(a) * TOWER_R), round(math.sin(a) * TOWER_R)))
    return out


def platform_shapes():
    """The paved deck: the disc and its lobes, 3 thick, with a low parapet round the outer edge."""
    sh = [{"shape": "cylinder", "at": [0, -3, 0], "r": R_CITY + 0.5, "h": 3, "material": "plaza", "hollow": 0}]
    for cx, cz, rr in lobe_centres():
        sh.append({"shape": "cylinder", "at": [cx, -3, cz], "r": rr, "h": 3, "material": "plaza", "hollow": 0})
    sh.append({"shape": "cylinder", "at": [0, 0, 0], "r": R_CITY + 0.5, "h": 1, "material": "parapet"})
    for cx, cz, rr in lobe_centres():
        sh.append({"shape": "cylinder", "at": [cx, 0, cz], "r": rr, "h": 1, "material": "parapet"})
    sh.append({"op": "sub", "shape": "cylinder", "at": [0, 0, 0], "r": R_CITY - 0.5, "h": 1})
    for cx, cz, rr in lobe_centres():
        sh.append({"op": "sub", "shape": "cylinder", "at": [cx, 0, cz], "r": rr - 1, "h": 1})
    sh.append({"op": "sub", "shape": "box", "min": [-2, 0, 98], "max": [2, 0, 112]})     # the gate in the parapet
    return sh


def underside_shapes(rng):
    """Round 2 (Mateo: "the platform itself needs some work"). The deck sits on the torn-up hill it was rung up
    with: a floating island of rock, broad under the deck and narrowing in lumps to a ragged point far below,
    with lesser crags and roots hanging off it. Cloud wraps the rim and the island's shoulders in round puffs,
    white on top, only the undersides grey, so from the side the city reads as resting on a cloud."""
    sh = []
    R = R_CITY
    # the main crag: a lumpy inverted cone (a lathe, so it stays a shell)
    prof = [[0, 1.5], [10, 9], [22, 20], [34, 34], [44, 50], [52, 64], [58, 76], [62, R - 4], [63.5, R - 10]]
    sh.append({"shape": "lathe", "at": [0, -66, 0], "material": "rock", "profile": prof})
    for cx, cz, rr in lobe_centres():                          # each lobe on its own shoulder of rock
        p2 = [[0, 1.5], [8, rr * 0.35], [16, rr * 0.7], [22, rr * 0.95], [24, rr - 3]]
        sh.append({"shape": "lathe", "at": [cx, -27, cz], "material": "rock", "profile": p2})
    for k in range(14):                                        # lumps on the crag, so it is not a smooth cone
        a = rng.uniform(0, 2 * math.pi); dep = rng.uniform(8, 44)
        rad = (R - 6) * (1 - dep / 64) ** 1.15
        x, z = math.cos(a) * rad, math.sin(a) * rad
        sh.append({"shape": "ellipsoid", "at": [round(x), -dep - 4, round(z)], "material": "rock",
                   "r": [rng.uniform(9, 16), rng.uniform(7, 12), rng.uniform(9, 16)]})
    for k in range(11):                                        # lesser crags hanging off the shoulders
        a = rng.uniform(0, 2 * math.pi); r = rng.uniform(20, 66)
        x, z = round(math.cos(a) * r), round(math.sin(a) * r)
        top = -int(8 + 50 * (r / R) ** 0.5 * 0.6) - 6
        top = -int(64 * (1 - r / (R + 4)) ** 0.9) - 2
        ln = rng.choice([14, 18, 22, 28, 34])
        w = rng.uniform(3.5, 7.5)
        sh.append({"shape": "lathe", "at": [x, top - ln, z], "material": "rock",
                   "profile": [[0, 0.5], [ln * 0.3, w * 0.4], [ln * 0.7, w * 0.8], [ln, w]]})
    # cloud: a ring of round puffs round the rim, banked up to the parapet and spilling under it
    for k in range(64):
        a = k * 2 * math.pi / 64 + rng.uniform(-0.04, 0.04)
        x, z = math.cos(a) * R, math.sin(a) * R
        best = min(lobe_centres(), key=lambda c: math.hypot(x - c[0], z - c[1]))
        for cx, cz, rr in [best]:                          # push out to the edge of a lobe where there is one
            if math.hypot(cx, cz) and math.hypot(x - cx, z - cz) < rr + 6:
                d = math.hypot(x - cx, z - cz) or 1
                x, z = cx + (x - cx) / d * (rr - 1), cz + (z - cz) / d * (rr - 1)
        if abs(x) < 9 and z > 80: continue                    # keep the gate clear
        sh.append({"shape": "sphere", "at": [round(x), rng.choice([-10, -11, -12]), round(z)], "r": rng.choice([5.5, 6.5, 7.5, 8.5]), "material": "cloud"})
    for k in range(40):                                        # the cloud bank on the island's shoulders
        a = rng.uniform(0, 2 * math.pi); dep = rng.uniform(10, 30)
        rad = (R - 2) * (1 - dep / 64) ** 1.15 + rng.uniform(2, 8)
        x, z = round(math.cos(a) * rad), round(math.sin(a) * rad)
        sh.append({"shape": "ellipsoid", "at": [x, -dep, z], "material": "cloud",
                   "r": [rng.uniform(8, 14), rng.uniform(4.5, 7), rng.uniform(8, 14)]})
    return sh


def road_cells():
    """Round 2 street plan: avenues from the Spire to the seven towers and on to the edge, a wide avenue due south
    to the gate, three ring streets, and lanes between the avenues from the first ring out (paint on the paving)."""
    cells = set()
    def line(x0, z0, x1, z1, w):
        n = int(max(abs(x1 - x0), abs(z1 - z0))) + 1
        for i in range(n + 1):
            t = i / n; x = x0 + (x1 - x0) * t; z = z0 + (z1 - z0) * t
            for dx in range(-w, w + 1):
                for dz in range(-w, w + 1):
                    cells.add((round(x + dx), round(z + dz)))
    for tx, tz in towers():
        d = math.hypot(tx, tz); line(0, 0, tx / d * (R_CITY + 26), tz / d * (R_CITY + 26), 1)
    line(0, 0, 0, 112, 2)
    for i in range(7):                                         # lanes halfway between the avenues
        a = math.radians(i * 360 / 7 - 90 + 360 / 14)
        if abs(math.degrees(a) % 360 - 90) < 20: continue      # the gate avenue already runs there
        line(math.cos(a) * RINGS[0], math.sin(a) * RINGS[0], math.cos(a) * (R_CITY + 26), math.sin(a) * (R_CITY + 26), 0)
    for i in range(14):                                        # and quarter lanes in the outer band
        a = math.radians(i * 360 / 14 - 90 + 360 / 28)
        line(math.cos(a) * RINGS[1], math.sin(a) * RINGS[1], math.cos(a) * (R_CITY + 26), math.sin(a) * (R_CITY + 26), 0)
    for rr, w in ((RINGS[0], 1), (RINGS[1], 1), (RINGS[2], 0)):
        for k in range(720):
            a = math.radians(k / 2); line(math.cos(a) * rr, math.sin(a) * rr, math.cos(a) * rr, math.sin(a) * rr, w)
    for cx, cz, rr in lobe_centres():                          # a loop street round each lobe
        for k in range(720):
            a = math.radians(k / 2); x, z = cx + math.cos(a) * (rr - 9), cz + math.sin(a) * (rr - 9)
            if math.hypot(x, z) > RINGS[2]: line(x, z, x, z, 0)
    return {c for c in cells if inside(*c, 1) and not (SPIRE[0] - 2 <= c[0] <= SPIRE[2] + 2 and SPIRE[1] - 2 <= c[1] <= SPIRE[3] + 2)}


OPP = {"n": "s", "s": "n", "e": "w", "w": "e"}
SLITS = {"base": STYLE, "panel": None, "sill": "none"}     # tower windows: bare slits and lancets


def tower(cx, cz, w, storeys, door, top_h=6, rows=3, plinth=2, y=0, wins=None, style=SLITS, finial="spire_block", eave=1):
    """A tower by build-instructions/towers (Mateo, 2026-11-12): a plain pale shaft with quoins and a course at
    every stage line (the house's stone frame does both), slits low and lancets high, then an open bell stage
    one block wider on every side carried on corbels, then a steep copper spire with a flared birch eave and
    the spire top block. Four changes of outline: plinth, shaft, belfry, spire. Returns (parts, place)."""
    h = w // 2
    r = [cx - h, cz - h, cx + h, cz + h]
    top = y + plinth + sum(storeys) - 1                   # the shaft's flat top: the belfry deck
    n = len(storeys)
    if wins is None:                                      # slits 1x2 low, lancets 1x3 in the top storey, stacked centre on centre
        wins = {sd: [{"at": 0, "storey": k, "w": 1, "h": 3 if k == n - 1 else 2} for k in range(1, n)] for sd in "nsew"}
    parts = [{"part": "house", "style": style, "rect": r, "y": y, "plinth": plinth, "storeys": storeys,
              "door": {"side": door} if door else False, "chimney": False, "shutters": 0,
              "roof": {"type": "flat", "parapet": "none"}, "windows": wins},
             {"part": "belfry", "rect": [cx - h - 1, cz - h - 1, cx + h + 1, cz + h + 1], "y": top, "h": top_h,
              "pier": "quartz_bricks", "deck": "smooth_quartz", "trim": "birch_planks", "roof": SPIRE_ROOF,
              "cap": "spire", "rows": rows, "overhang": eave, "cap_trim": "birch_planks", "finial": finial}]
    place = []                                            # corbels under the overhang: each corner and every 3rd block
    for t in sorted({-(h), 0, h} | set(range(-(h), h + 1, 3))):
        for sd, (x, z) in {"n": (cx + t, cz - h - 1), "s": (cx + t, cz + h + 1), "w": (cx - h - 1, cz + t), "e": (cx + h + 1, cz + t)}.items():
            place.append([x, top - 1, z, "smooth_quartz_stairs", {"facing": OPP[sd], "half": "top"}])
    return parts, place


def spire_parts():
    """The Spire of the Held Note: a 21 x 21 base with a paved crenellated terrace, a 15 x 15 shaft, and on top
    the great open belfry, 17 x 17 on corbels, where the warden of the note is fought (deck at Y 291), under a
    steep copper spire (the build limit caps it at about 1.2 times the shaft's width) to the finial at Y 316."""
    x0, z0, x1, z1 = SPIRE
    paved = {"base": STYLE, "roof": {"block": "polished_diorite"}}
    parts = [
        {"part": "house", "style": paved, "rect": [x0, z0, x1, z1], "y": 0, "plinth": 1, "storeys": [5] * 4,
         "door": {"side": "s", "kind": "grand"}, "chimney": False, "bay": 5,
         "roof": {"type": "flat", "parapet": "crenel", "parapet_mat": "diorite"}},
    ] + [{"part": "buttress", "rect": [x0, z0, x1, z1], "side": sd, "at": [-6, 6], "y": 0, "height": 14, "depth": 2,
          "material": "smooth_quartz"} for sd in "nsew"]
    wins = {sd: [{"at": a, "storey": k, "w": 1, "h": 3} for a in (-4, 0, 4) for k in (1, 2)] for sd in "nsew"}
    p2, place = tower(0, 0, 15, [5, 5, 5], "s", top_h=6, rows=2, plinth=1, y=21, wins=wins,
                      style=dict(SLITS, roof={"block": "polished_diorite"}))
    p2[0]["bay"] = 5
    return parts + p2, place


def tower_parts():
    """The seven bell towers: 7 x 7 shafts of four 6-high stages (3.4 times the width), a 9 x 9 bell stage on
    corbels, a copper spire (rows 3, 13 high over the eave). Doors face the Spire."""
    parts, place = [], []
    for tx, tz in towers():
        door = "n" if tz > 8 else "s" if tz < -8 else ("w" if tx > 0 else "e")
        p, pl = tower(tx, tz, 7, [6, 6, 6, 6], door)
        parts += p; place += pl
    return parts, place


def gate_parts():
    """The gatehouse: an 11 x 9 hall open in an arcade on the ground storey, between two 5 x 5 towers of three
    6-high stages with 7 x 7 bell stages on corbels and copper spires, a full stage clear of the hall's ridge.
    Round 2: it stands at the tip of the south lobe, where the sky dock comes in."""
    z0, z1 = GATE_Z
    parts = [{"part": "house", "style": STYLE, "rect": [-5, z0, 5, z1], "y": 0, "plinth": 1, "storeys": [5, 5],
              "door": {"side": "s", "kind": "grand"}, "chimney": False, "arcade": {"sides": "ew", "storey": 0},
              "roof": {"type": "hip"}, "interior": "hall"}]
    place = []
    for cx in (-8, 8):
        p, pl = tower(cx, (z0 + z1) // 2, 5, [6, 6, 6], None, top_h=5, eave=0)   # no flare: a 5-wide shaft under a 9-wide eave reads as a mushroom
        parts += p; place += pl
    return parts, place


ROOFS = [STYLE, STYLE, STYLE, {"base": STYLE, "roof": {"ladder": ["waxed_exposed_cut_copper", "waxed_weathered_cut_copper"], "axis": "y"}},
         {"base": STYLE, "roof": {"block": "smooth_quartz", "texture": True}}]
CIVIC = [("the_bell_foundry", 17, 13, [6, 5], "smithy"), ("the_bellkeepers_hall", 15, 13, [5, 5, 4], "hall"),
         ("the_market_hall", 15, 11, [5, 5], "shop"), ("the_last_inn", 13, 11, [5, 5, 4], "inn"),
         ("the_chapter_house", 13, 13, [5, 5], "library"), ("the_ringers_lodge", 13, 9, [5, 5], "barracks")]


def house_parts(rng, roads):
    """Round 2 (Mateo, 2026-11-13: "much more dense, more buildings, more roads"): every block between the streets
    is filled. Plots are packed from the street edge inwards, each house fronting the nearest street with its door
    on it, two blocks between walls (their eaves meet over a gutter lane). Six civic buildings go first, in the
    inner bands. Taller (three storeys) toward the Spire, lower toward the rim."""
    W = int(R_CITY + 30)
    road = roads
    dist = {}                                              # steps from the nearest street, over the paving
    from collections import deque
    q = deque()
    for c in road: dist[c] = 0; q.append(c)
    while q:
        x, z = q.popleft()
        for dx, dz in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + dx, z + dz)
            if n in dist or not inside(*n, 1): continue
            dist[n] = dist[(x, z)] + 1; q.append(n)
    taken = set()
    def block(x0, z0, x1, z1):
        for x in range(x0, x1 + 1):
            for z in range(z0, z1 + 1): taken.add((x, z))
    block(SPIRE[0] - 4, SPIRE[1] - 4, SPIRE[2] + 4, SPIRE[3] + 4)
    block(-14, GATE_Z[0] - 3, 14, GATE_Z[1] + 12)
    for tx, tz in towers(): block(tx - 6, tz - 6, tx + 6, tz + 6)
    def fits(x0, z0, x1, z1):
        for x in range(x0 - 1, x1 + 2):                    # the eave ring must be paving, off the streets, unclaimed
            for z in range(z0 - 1, z1 + 2):
                if (x, z) in taken or (x, z) in road or not inside(x, z, 2): return False
        return True
    def door_side(x0, z0, x1, z1):
        best = None
        for sd, (x, z) in {"n": ((x0 + x1) // 2, z0 - 2), "s": ((x0 + x1) // 2, z1 + 2), "w": (x0 - 2, (z0 + z1) // 2), "e": (x1 + 2, (z0 + z1) // 2)}.items():
            d = dist.get((x, z), 99)
            if best is None or d < best[0]: best = (d, sd)
        return best
    parts = []
    def place_one(x0, z0, w, d, name=None, storeys=None, use="home"):
        x1, z1 = x0 + w - 1, z0 + d - 1
        if not fits(x0, z0, x1, z1): return False
        dd, sd = door_side(x0, z0, x1, z1)
        if dd > 2: return False                            # every door opens on a street (or a step from one)
        block(x0 - 1, z0 - 1, x1 + 1, z1 + 1)
        r = math.hypot((x0 + x1) / 2, (z0 + z1) / 2)
        if storeys is None:
            storeys = [5, 4, 4] if r < 40 and rng.random() < 0.6 else [5, 4] if r < 70 or rng.random() < 0.6 else [5]
        p = {"part": "house", "style": rng.choice(ROOFS), "rect": [x0, z0, x1, z1], "y": 0, "plinth": 1, "storeys": storeys,
             "door": {"side": sd}, "chimney": False, "roof": {"type": rng.choice(["hip", "hip", "gable"])}, "shutters": 0.25,
             "vines": 0, "finials": False, "interior": use}
        if name: p["name"] = name; p["door"]["kind"] = "grand"
        parts.append(p); return True
    cells = sorted((c for c in dist if dist[c] in (1, 2)), key=lambda c: (math.hypot(*c), c))
    for name, w, d, st, use in CIVIC:                      # civic buildings first, in the inner two bands
        ok = False
        for c in cells[rng.randrange(len(cells) // 3):] + cells:
            if not (18 < math.hypot(*c) < 70): continue
            for ww, dd in ((w, d), (d, w)):
                for ox, oz in ((0, 0), (-ww + 1, 0), (0, -dd + 1), (-ww + 1, -dd + 1)):
                    if place_one(c[0] + ox, c[1] + oz, ww, dd, name, st, use): ok = True; break
                if ok: break
            if ok: break
    sizes = [(9, 7), (7, 9), (9, 9), (11, 7), (7, 11), (7, 7), (11, 9), (9, 11), (5, 7), (7, 5)]
    for k in range(4):                                     # several sweeps: the street edge first, then inwards
        order = sorted(dist, key=lambda c: (dist[c] if dist[c] > 0 else 99, rng.random()))
        for c in order:
            if dist[c] == 0 or c in taken: continue
            rng.shuffle(sizes)
            for w, d in sizes:
                done = False
                for ox, oz in ((0, 0), (-w + 1, 0), (0, -d + 1), (-w + 1, -d + 1)):
                    if place_one(c[0] + ox, c[1] + oz, w, d): done = True; break
                if done: break
    return parts


def sky_dock(rng):
    """Round 2: where the air boat comes in (Mateo, 2026-11-13: you reach Everwake by air boat; in game the Gate in
    Aldmere is a portal). A stone pier runs on south from the gatehouse over the cloud, carried on corbel brackets,
    to a small mooring mast; the air boat lies along its east side, a gangway across to its gondola."""
    pl, parts, sh = [], [], []
    z0, z1 = GATE_Z[1] + 1, GATE_Z[1] + 46
    for z in range(z0, z1 + 1):
        for x in range(-3, 4):
            pl.append([x, -1, z, "polished_andesite" if abs(x) <= 1 else "polished_diorite"])
            pl.append([x, -2, z, "smooth_quartz"])
        for x in (-4, 4):
            pl.append([x, -1, z, "smooth_quartz"]); pl.append([x, 0, z, "diorite_wall"])
            if (z - z0) % 3 == 0:
                pl.append([x, -2, z, "smooth_quartz_stairs", {"facing": "n" if False else ("e" if x < 0 else "w"), "half": "top"}])
        if (z - z0) % 6 == 0:                                # brackets under the deck
            for x in range(-3, 4):
                pl.append([x, -3, z, "smooth_quartz_stairs", {"facing": "s", "half": "top"}])
            for x in (-4, 4):
                pl += [[x, 1, z, "diorite_wall"], [x, 2, z, "lantern"]]
    mz = z1 - 3
    p, pll = tower(0, mz, 5, [5, 5], "n", top_h=4, eave=0, rows=2)   # the mooring mast at the pier's end
    parts += p; pl += pll
    for z in range(z0 + 8, z1 - 4):                          # clear the parapet walk where the gangway leaves
        pass
    ring = (20, -1 - MOORING["deck_y"], GATE_Z[1] + 69)       # the air boat (airboat.py), nose to the south, deck level with the pier
    pl += boat_cells(ring, "s")
    door = turn_cell(list(MOORING["side_door"]) + ["x"], ring, "s")   # its starboard door faces the pier (west)
    gw = door[2]
    for x in range(5, door[0]):                                # the gangway, pier to the door
        for z in (gw - 1, gw, gw + 1): pl.append([x, -1, z, "spruce_planks"])
        pl += [[x, 0, gw - 2, "spruce_fence"], [x, 0, gw + 2, "spruce_fence"]]
    for z in (gw - 1, gw, gw + 1): pl.append([4, 0, z, "air"])
    return sh, parts, pl


def needle_shapes(rng):
    base = 62 - WORLD_Y          # sea level in local y (-193)
    sh = [{"shape": "lathe", "at": [0, base - 4, 82], "material": "rock_tall", "hollow": 1,
           "profile": [[0, 15.5], [30, 13.5], [70, 10.5], [110, 8.5], [150, 7.5], [176, 9.5], [184, 8.5], [186, 6.5]]}]
    # wind-cut ledges round the stack, a few blocks apart, the climbing line
    for k in range(60):
        y = base + 6 + k * 3
        a = k * 0.62
        t = (y - base) / 186
        r = 15.5 - 8 * t + 2
        x, z = round(math.cos(a) * r), round(82 + math.sin(a) * r)
        sh.append({"shape": "box", "min": [x - 1, y, z - 1], "max": [x + 1, y, z + 1], "material": "ledge"})
    for y in (base + 45, base + 95, base + 145):       # the three wind shrines
        t = (y - base) / 186; r = 15.5 - 8 * t
        sh.append({"shape": "cylinder", "at": [0, y, 82], "r": r + 3.5, "h": 1, "material": "ledge", "hollow": 0})
    return sh


def cloud_sea(rng):
    sh = []
    for k in range(70):
        a = rng.uniform(0, 2 * math.pi); r = 75 + rng.uniform(0, 75)
        x, z = round(math.cos(a) * r), round(math.sin(a) * r)
        sh.append({"shape": "ellipsoid", "at": [x, -17, z], "r": [rng.uniform(12, 22), rng.uniform(2.5, 4), rng.uniform(12, 22)],
                   "material": "cloudsea"})
    return sh


def city_spec(rng):
    roads = road_cells()
    place = [[x, -1, z, "polished_andesite"] for (x, z) in sorted(roads)]
    sp, spl = spire_parts(); tp, tpl = tower_parts(); gp, gpl = gate_parts()
    dsh, dparts, dpl = sky_dock(rng)
    place += spl + tpl + gpl + dpl
    return {
        "name": "everwake_city", "edition": "bedrock",
        "materials": {"plaza": PLAZA, "parapet": "smooth_quartz", "cloud": CLOUD, "rock": ROCK,
},
        "shapes": underside_shapes(rng) + platform_shapes() + dsh,
        "parts": sp + tp + gp + house_parts(rng, roads) + dparts,
        "place": place,
    }


def specs():
    """Round 2: Everwake is its own world (Mateo, 2026-11-13), reached by air boat, so the Needle scene is gone."""
    return {"everwake_city": city_spec(random.Random(1319))}
