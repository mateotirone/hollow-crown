"""Everwake, the city in the sky, as minecraft-builder specs (regions/everwake.md).

Local coordinates: the city's paving is y = -1, so houses stand at y = 0. In the world the paving sits at
Y 254 and the top of the Spire of the Held Note reaches Y 319 (local 64). x east, z south.

specs() -> {"everwake_city": spec, "everwake_needle": spec}
"""
import math, random

WORLD_Y = 255            # world Y of local y = 0
STYLE = "everwake_stone"
COPPER = {"ladder": ["waxed_weathered_cut_copper", "waxed_oxidized_cut_copper"], "axis": "y"}
SPIRE_ROOF = {"ladder": ["waxed_weathered_cut_copper", "waxed_oxidized_cut_copper"], "axis": "y"}
PLAZA = {"ladder": ["polished_diorite", "calcite", "smooth_quartz"], "axis": "noise", "scale": 4}
CLOUD = {"ladder": ["light_gray_wool", "white_concrete", "white_wool"], "axis": "y", "texture": False}
ROCK = {"ladder": ["tuff", "andesite", "diorite", "calcite"], "axis": "y"}

R_CITY = 60              # radius of the main disc
LOBES = [(a, 52, 17.5) for a in (90, 141, 193, 244, 296, 347, 39)]   # cloud-shaped edge (degrees, centre r, radius)
TOWER_R = 44             # the seven bell towers
SPIRE = (-10, -10, 10, 10)
GATE_Z = (49, 57)


def lobe_centres():
    return [(round(math.cos(math.radians(a)) * r), round(math.sin(math.radians(a)) * r), rr) for a, r, rr in LOBES]


def inside(x, z, margin=0):
    if math.hypot(x, z) <= R_CITY - margin: return True
    return any(math.hypot(x - cx, z - cz) <= rr - margin for cx, cz, rr in lobe_centres())


def towers():
    out = []
    for i in range(7):
        a = math.radians(i * 360 / 7 - 90 + 360 / 14)       # leave due south free for the gatehouse avenue
        out.append((round(math.cos(a) * TOWER_R), round(math.sin(a) * TOWER_R)))
    return out


def platform_shapes():
    sh = [{"shape": "cylinder", "at": [0, -3, 0], "r": R_CITY + 0.5, "h": 3, "material": "plaza", "hollow": 0}]
    for cx, cz, rr in lobe_centres():
        sh.append({"shape": "cylinder", "at": [cx, -3, cz], "r": rr, "h": 3, "material": "plaza", "hollow": 0})
    # a low parapet round the outer edge only: the same discs one higher, minus the discs shrunk by one
    sh.append({"shape": "cylinder", "at": [0, 0, 0], "r": R_CITY + 0.5, "h": 1, "material": "parapet"})
    for cx, cz, rr in lobe_centres():
        sh.append({"shape": "cylinder", "at": [cx, 0, cz], "r": rr, "h": 1, "material": "parapet"})
    sh.append({"op": "sub", "shape": "cylinder", "at": [0, 0, 0], "r": R_CITY - 0.5, "h": 1})
    for cx, cz, rr in lobe_centres():
        sh.append({"op": "sub", "shape": "cylinder", "at": [cx, 0, cz], "r": rr - 1, "h": 1})
    # the gate in the parapet, due south
    sh.append({"op": "sub", "shape": "box", "min": [-2, 0, 55], "max": [2, 0, 72]})
    return sh


def underside_shapes(rng):
    sh = []
    # the cloud the city sits in: a broad belly under the disc, puffs round the rim
    sh.append({"shape": "ellipsoid", "at": [0, -14, 0], "r": [R_CITY + 2, 12, R_CITY + 2], "material": "cloud"})
    for cx, cz, rr in lobe_centres():
        sh.append({"shape": "ellipsoid", "at": [cx, -11, cz], "r": [rr + 3, 8, rr + 3], "material": "cloud"})
    for k in range(34):
        a = rng.uniform(0, 2 * math.pi); r = rng.uniform(R_CITY - 6, R_CITY + 8)
        x, z = round(math.cos(a) * r), round(math.sin(a) * r)
        if abs(x) < 7 and z > 40: continue                   # keep the gate and the cloud stair clear
        rr = rng.choice([4.5, 5.5, 6.5, 7.5])
        sh.append({"shape": "sphere", "at": [x, rng.choice([-6, -5, -4]), z], "r": rr, "material": "cloud"})
    for k in range(10):                                      # lower puffs under the belly
        a = rng.uniform(0, 2 * math.pi); r = rng.uniform(5, 40)
        sh.append({"shape": "ellipsoid", "at": [round(math.cos(a) * r), -24, round(math.sin(a) * r)],
                   "r": [rng.uniform(9, 15), rng.uniform(4, 6), rng.uniform(9, 15)], "material": "cloud"})
    # stone roots hanging out of the cloud: what the city tore out of the ground when it was rung up
    for k in range(9):
        a = math.radians(k * 40 + rng.uniform(-12, 12)); r = rng.uniform(12, 42)
        x, z = round(math.cos(a) * r), round(math.sin(a) * r)
        top = -20; ln = rng.choice([18, 22, 26, 30])
        sh.append({"shape": "lathe", "at": [x, top - ln, z], "material": "rock",
                   "profile": [[0, 0.5], [ln * 0.35, 1.5], [ln * 0.7, 2.5], [ln, 3.5]]})
    return sh


def road_cells():
    """Seven avenues from the Spire to the towers, one due south to the gate, and a ring street (paint on the paving)."""
    cells = set()
    def line(x0, z0, x1, z1, w):
        n = int(max(abs(x1 - x0), abs(z1 - z0))) + 1
        for i in range(n + 1):
            t = i / n; x = x0 + (x1 - x0) * t; z = z0 + (z1 - z0) * t
            for dx in range(-w, w + 1):
                for dz in range(-w, w + 1):
                    cells.add((round(x + dx), round(z + dz)))
    for tx, tz in towers(): line(0, 0, tx, tz, 1)
    line(0, 0, 0, 62, 2)
    for k in range(360):
        a = math.radians(k); line(math.cos(a) * 28, math.sin(a) * 28, math.cos(a) * 28, math.sin(a) * 28, 1)
    return {c for c in cells if inside(*c, 1) and not (SPIRE[0] <= c[0] <= SPIRE[2] and SPIRE[1] <= c[1] <= SPIRE[3])}


def spire_parts():
    """The Spire of the Held Note: a 21 x 21 base with a paved terrace, a 15 x 15 shaft, and on top the great
    open belfry, 15 x 15, where the warden of the note is fought (deck at about Y 298, finial at Y 318)."""
    x0, z0, x1, z1 = SPIRE
    paved = {"base": STYLE, "roof": {"block": "polished_diorite"}}
    return [
        {"part": "house", "style": paved, "rect": [x0, z0, x1, z1], "y": 0, "plinth": 1, "storeys": [5] * 5,
         "door": {"side": "s", "kind": "grand"}, "chimney": False, "bay": 5,
         "roof": {"type": "flat", "parapet": "crenel", "parapet_mat": "diorite"}},
        {"part": "house", "style": paved, "rect": [-7, -7, 7, 7], "y": 27, "plinth": 1, "storeys": [5, 5, 5],
         "door": {"side": "s"}, "chimney": False, "bay": 5, "roof": {"type": "flat", "parapet": "none"}},
        {"part": "belfry", "rect": [-7, -7, 7, 7], "y": 44, "h": 8, "pier": "quartz_bricks", "trim": "birch_planks",
         "roof": SPIRE_ROOF, "cap": "spire", "rows": 1, "finial": "spire_block"},
    ] + [{"part": "buttress", "rect": [x0, z0, x1, z1], "side": sd, "at": [-6, 6], "y": 0, "height": 14, "depth": 2}
         for sd in "nsew"]


def tower_parts():
    parts = []
    for tx, tz in towers():
        r = [tx - 3, tz - 3, tx + 3, tz + 3]
        door = "n" if tz > 8 else "s" if tz < -8 else ("w" if tx > 0 else "e")
        parts += [
            {"part": "house", "style": STYLE, "rect": r, "y": 0, "plinth": 1, "storeys": [5] * 5,
             "door": {"side": door}, "chimney": False, "roof": {"type": "hip", "overhang": 0},
             "windows": {sd: [{"at": 0, "storey": k, "w": 1, "h": 2} for k in (1, 3) if not (sd == door and k == 0)] for sd in "nsew"}},
            {"part": "belfry", "rect": r, "y": "top", "h": 4, "pier": "quartz_bricks", "trim": "birch_planks",
             "roof": SPIRE_ROOF, "cap": "spire", "rows": 2, "finial": "spire_block"},
        ]
    return parts


def gate_parts():
    z0, z1 = GATE_Z
    return [
        {"part": "house", "style": STYLE, "rect": [-5, z0, 5, z1], "y": 0, "plinth": 1, "storeys": [5, 5],
         "door": {"side": "s", "kind": "grand"}, "chimney": False, "arcade": {"sides": "ew", "storey": 0},
         "roof": {"type": "hip"}},
        {"part": "house", "style": STYLE, "rect": [-10, z0 + 1, -6, z1 - 1], "y": 0, "plinth": 1, "storeys": [5, 5, 5],
         "door": False, "chimney": False, "roof": {"type": "hip", "overhang": 0}},
        {"part": "spire", "rect": [-10, z0 + 1, -6, z1 - 1], "rows": 3, "roof": SPIRE_ROOF, "trim": "birch_planks"},
        {"part": "house", "style": STYLE, "rect": [6, z0 + 1, 10, z1 - 1], "y": 0, "plinth": 1, "storeys": [5, 5, 5],
         "door": False, "chimney": False, "roof": {"type": "hip", "overhang": 0}},
        {"part": "spire", "rect": [6, z0 + 1, 10, z1 - 1], "rows": 3, "roof": SPIRE_ROOF, "trim": "birch_planks"},
    ]


def house_parts(rng, roads):
    taken = [(SPIRE[0] - 3, SPIRE[1] - 3, SPIRE[2] + 3, SPIRE[3] + 3), (-13, GATE_Z[0] - 3, 13, GATE_Z[1] + 3)]
    taken += [(tx - 6, tz - 6, tx + 6, tz + 6) for tx, tz in towers()]
    sizes = [(7, 9), (9, 7), (9, 11), (11, 9), (7, 7), (9, 9)]
    parts, inn = [], None
    tries = 0
    while len(parts) < 40 and tries < 6000:
        tries += 1
        w, d = rng.choice(sizes)
        a = rng.uniform(0, 2 * math.pi); r = rng.uniform(15, 56)
        cx, cz = round(math.cos(a) * r), round(math.sin(a) * r)
        x0, z0 = cx - w // 2, cz - d // 2; x1, z1 = x0 + w - 1, z0 + d - 1
        box = (x0 - 2, z0 - 2, x1 + 2, z1 + 2)          # 1 of roof overhang + a lane
        if not all(inside(x, z, 2) for x in (box[0], box[2]) for z in (box[1], box[3])): continue
        if any(not (box[2] < t[0] or box[0] > t[2] or box[3] < t[1] or box[1] > t[3]) for t in taken): continue
        if any((x, z) in roads for x in range(box[0], box[2] + 1) for z in range(box[1], box[3] + 1)): continue
        taken.append(box)
        dx, dz = -cx, -cz                                # door toward the Spire, the way people walk
        door = ("e" if dx > 0 else "w") if abs(dx) > abs(dz) else ("s" if dz > 0 else "n")
        tall = rng.random() < 0.45
        roofc = rng.random()
        style = STYLE if roofc < 0.55 else {"base": STYLE, "roof": {"ladder": ["waxed_exposed_cut_copper", "waxed_weathered_cut_copper"], "axis": "y"}} if roofc < 0.8 else \
            {"base": STYLE, "roof": {"block": "smooth_quartz", "texture": True}}
        p = {"part": "house", "style": style, "rect": [x0, z0, x1, z1], "y": 0, "plinth": 1,
             "storeys": [5, 4] if tall else [5], "door": {"side": door}, "chimney": False,
             "roof": {"type": rng.choice(["hip", "hip", "gable"])}, "shutters": 0.25, "vines": 0}
        if inn is None and r < 30 and w * d >= 81:
            p["storeys"] = [5, 5]; p["name"] = "the_last_inn"; inn = p
        parts.append(p)
    return parts


def stair_from_needle():
    """The last climb: a stone stair from the top of the Needle (under the cloud, due south) up to the gate."""
    pl = []
    for i in range(15):
        z = 74 - i; y = -15 + i
        for x in (-1, 0, 1):
            pl.append([x, y, z, "polished_diorite_stairs", {"facing": "n"}])
            pl.append([x, y - 1, z, "polished_diorite"])
        for x in (-2, 2):
            pl.append([x, y, z, "diorite_wall"])
    return pl


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
    place += stair_from_needle()
    for tx, tz in towers():                  # a lantern post at each tower's door step
        pass
    return {
        "name": "everwake_city", "edition": "bedrock",
        "materials": {"plaza": PLAZA, "parapet": "smooth_quartz", "cloud": CLOUD, "rock": ROCK},
        "shapes": underside_shapes(rng) + platform_shapes(),
        "parts": spire_parts() + tower_parts() + gate_parts() + house_parts(rng, roads),
        "place": place,
    }


def specs():
    rng = random.Random(1319)
    city = city_spec(rng)
    needle = dict(city)
    needle["name"] = "everwake_needle"
    needle["materials"] = dict(city["materials"], rock_tall={"ladder": ["tuff", "andesite", "diorite", "calcite"], "axis": "y"},
                               ledge="polished_diorite", cloudsea={"block": "white_wool", "texture": False})
    needle["shapes"] = city["shapes"] + needle_shapes(rng) + cloud_sea(rng)
    return {"everwake_city": city, "everwake_needle": needle}
