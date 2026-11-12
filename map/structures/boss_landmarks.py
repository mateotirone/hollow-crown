"""The big exterior landmarks round the regional boss unlock sites, seen from far off before anyone knows a boss is
there (Mateo: "Oh my gosh, what is that?"). Drawn on the landmark design format (D, y = 0 the site's ground,
offsets from the site centre that unlocks/plans.js uses), keeping clear of every cell the site's own plan needs
(spots.json from map/structures/boss_unlock_sites.py):

  huntsman   the Antler Crown: eight great tines of pale bone and ice rising out of Hallowmere round the frozen
             disc (outside r 23), leaning in, branching, snow-capped, chains and lanterns hung between
  bride      the Drowned Bell Tower: the chapel's tower carried on up out of the sea, leaning, its bell chamber open
             above the waves, and six broken pillars of the old churchyard breaking the surface with sea lanterns
  seneschal  the Faceless Gate: twin pylons over the vault stair's mouth and a colossal faceless figure seated
             behind them, a processional way of faceless statues to the south
  mother     the Cradle Tree: a vast mangrove over the cave, buttress roots arching round (never into) the cave
             and over the ramp, a canopy 45 across, hanging roots and empty cradles on chains
  mirelight  the Lantern Mast: a tall mangrove and iron mast in the middle of the lantern square, hung with
             froglight lanterns, which the five villagers' posts stand round

    python3 boss_landmarks.py         -> Siege_Nights_BP/scripts/unlocks/landmark_stamps.js (STAMPS, stamp/1 format)
    python3 boss_landmarks.py OUT     -> viewer scenes (add --js to write the stamps too) OUT/<id>/scene.json + OUT/names.json
"""
import json, math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from landmarks import D, CARD  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(HERE))
OUT_JS = os.path.join(ROOT, "Siege_Nights_BP", "scripts", "unlocks", "landmark_stamps.js")


def disc(r):
    n = int(r) + 1
    return [(x, z) for x in range(-n, n + 1) for z in range(-n, n + 1) if math.hypot(x, z) <= r]


def blob(d, cx, cy, cz, r, mix, salt=0, squash=1.0, only_empty=False):
    n = int(r) + 1
    for x in range(-n, n + 1):
        for y in range(-n, n + 1):
            for z in range(-n, n + 1):
                if math.hypot(x, y / squash, z) <= r - 0.25 * d.r(cx + x, cy + y, cz + z, salt):
                    c = (cx + x, cy + y, cz + z)
                    if only_empty and d.get(*c) is not None: continue
                    d.put(*c, d.pick(*c, mix, salt) if isinstance(mix, list) else mix)


def tube(d, pts, r0, r1, mix, salt=0, keep=None):
    """A thick limb along a polyline of (x, y, z), radius r0 at the start to r1 at the end."""
    segs = list(zip(pts, pts[1:]))
    total = sum(math.dist(a, b) for a, b in segs) or 1
    done = 0
    for a, b in segs:
        L = math.dist(a, b); n = max(1, int(L * 2))
        for k in range(n + 1):
            t = k / n; f = (done + L * t) / total
            p = [a[i] + (b[i] - a[i]) * t for i in range(3)]
            rr = r0 + (r1 - r0) * f
            m = int(rr) + 1
            for x in range(-m, m + 1):
                for y in range(-m, m + 1):
                    for z in range(-m, m + 1):
                        if x * x + y * y + z * z <= rr * rr:
                            c = (round(p[0] + x), round(p[1] + y), round(p[2] + z))
                            if keep and not keep(*c): continue
                            d.put(*c, d.pick(*c, mix, salt) if isinstance(mix, list) else mix)
        done += L


# ---------------------------------------------------------------- the Pale Huntsman


def huntsman():
    """The Antler Crown over Hallowmere."""
    d = D("boss_huntsman", seed=701)
    BONE = [("bone_block", 6), ("calcite", 3), ("diorite", 1)]
    keep = lambda x, y, z: math.hypot(x, z) > 23.5   # never on the ice disc or the crack ring
    for k in range(8):
        a = math.radians(22.5 + 45 * k)
        ux, uz = math.sin(a), math.cos(a)
        base = 31
        # the beam: up out of the water, leaning in over the lake, then tines branching off it
        beam = [(ux * base, -8, uz * base), (ux * (base + 1), 4, uz * (base + 1)), (ux * (base - 1), 14, uz * (base - 1)),
                (ux * (base - 4), 24, uz * (base - 4)), (ux * (base - 7), 31, uz * (base - 7))]
        tube(d, beam, 2.4, 0.9, BONE, 1, keep)
        px, pz = -uz, ux   # sideways
        for (t, h, side, ln) in ((0.35, 12, 1, 7), (0.55, 18, -1, 8), (0.75, 24, 1, 6)):
            sx, sz = ux * (base - 2 - t * 4), uz * (base - 2 - t * 4)
            tine = [(sx, h, sz), (sx + px * side * ln * 0.5 + ux * 1.5, h + ln * 0.6, sz + pz * side * ln * 0.5 + uz * 1.5),
                    (sx + px * side * ln * 0.7 + ux * 2.5, h + ln, sz + pz * side * ln * 0.7 + uz * 2.5)]
            tube(d, tine, 1.2, 0.5, BONE, 2, keep)
            tip = tuple(round(v) for v in tine[-1])
            d.put(tip[0], tip[1] + 1, tip[2], "blue_ice")
        top = tuple(round(v) for v in beam[-1])
        d.put(top[0], top[1] + 1, top[2], "blue_ice"); d.put(top[0], top[1] + 2, top[2], "end_rod", bs={"facing_direction": 1})
    # snow on every upward face, icicles of packed ice under the overhangs
    cells = list(d.cells.items())
    for (x, y, z), (b, p) in cells:
        if b in ("bone_block", "calcite", "packed_ice", "diorite") and d.get(x, y + 1, z) is None and y > 2 and d.r(x, y, z) < 0.55:
            d.put(x, y + 1, z, "snow_layer")
        if b in ("bone_block", "calcite") and d.get(x, y - 1, z) is None and y > 6 and d.r(x, 3, z) < 0.12:
            d.put(x, y - 1, z, "pointed_dripstone", bs={"hanging": True}) if False else d.put(x, y - 1, z, "packed_ice")
    # chains between neighbouring beams with lanterns, sagging over the lake
    for k in range(8):
        a0, a1 = math.radians(22.5 + 45 * k), math.radians(22.5 + 45 * (k + 1))
        p0 = (math.sin(a0) * 29, 16, math.cos(a0) * 29); p1 = (math.sin(a1) * 29, 16, math.cos(a1) * 29)
        for s in range(1, 20):
            t = s / 20
            x, z = round(p0[0] + (p1[0] - p0[0]) * t), round(p0[2] + (p1[2] - p0[2]) * t)
            y = round(16 - 4 * math.sin(math.pi * t))
            if math.hypot(x, z) > 23.5 and d.get(x, y, z) is None: d.put(x, y, z, "iron_chain", axis="x")
            if s == 10 and math.hypot(x, z) > 23.5: d.put(x, y - 1, z, "soul_lantern", hanging=True)
    return d


# ---------------------------------------------------------------- the Drowned Bride


def bride(surface=12):
    """The Drowned Bell Tower over the Chapel of Saint Brannoc."""
    d = D("boss_bride", seed=711)
    STONE = [("stone_bricks", 4), ("mossy_stone_bricks", 4), ("cracked_stone_bricks", 2), ("prismarine_bricks", 1)]
    lean = lambda y: int(max(0, y - 14) * 0.12)   # leaning seaward as it rises
    for y in range(8, 38):
        o = lean(y)
        for x in range(-15, -8):
            for z in range(-3, 4):
                edge = x in (-15, -9) or abs(z) == 3
                if not edge: continue
                q = x in (-15, -9) and abs(z) == 3
                X = x - o
                if 26 <= y <= 31 and not q and (abs(z) <= 1 or x == -12):   # the open bell chamber
                    continue
                d.put(X, y, z, "polished_andesite" if q else d.pick(X, y, z, STONE, 1))
        if y in (18, 25, 32):
            for x in range(-16, -7):
                for z in (-4, 4): d.put(x - o, y, z, "stone_brick_stairs", facing="n" if z < 0 else "s", half="top")
            for z in range(-3, 4):
                d.put(-16 - o, y, z, "stone_brick_stairs", facing="w", half="top"); d.put(-8 - o, y, z, "stone_brick_stairs", facing="e", half="top")
    o = lean(30)
    d.put(-12 - o, 31, 0, "iron_chain", axis="y"); d.put(-12 - o, 30, 0, "iron_chain", axis="y")
    d.put(-12 - o, 29, 0, "bell", bs={"attachment": "hanging", "direction": 0})
    for x in range(-15, -8):   # a broken spire over the chamber: a stump of a cone, cracked open on one side
        for z in range(-3, 4):
            for k in range(6):
                rr = 3.5 - k * 0.55
                dd = max(abs(x + 12), abs(z))
                if rr - 1 < dd <= rr and not (k > 2 and x > -12 and z > 0):
                    d.put(x - lean(38 + k), 38 + k, z, d.pick(x, 38 + k, z, [("cobbled_deepslate", 2), ("mossy_cobblestone", 1)], 3))
    d.put(-12 - lean(44), 44, 0, "lightning_rod", bs={"facing_direction": 1})
    for y in (14, 21):   # sea lanterns glowing up through the windows under the water
        d.put(-15, y, 0, "sea_lantern"); d.put(-9, y, 0, "sea_lantern")
    for y in range(8, surface + 1):   # kelp up the walls under water
        for (x, z) in ((-16, -1), (-8, 2), (-14, -4), (-10, 4)):
            if d.r(x, y, z) < 0.7: d.put(x, y, z, "kelp") if False else None
    # the churchyard's broken pillars round the chapel, breaking the surface, each with a sea lantern
    for k in range(6):
        a = math.radians(30 + 60 * k)
        cx, cz = round(math.sin(a) * 17), round(math.cos(a) * 15)
        if -16 <= cx <= -7 and abs(cz) <= 4: continue
        tall = surface + 2 + int(4 * d.r(k, 1, 0))
        for y in range(0, tall + 1):
            for (x, z) in ((0, 0), (1, 0), (0, 1), (1, 1)):
                if y > tall - 2 and (x, z) == (1, 1): continue
                d.put(cx + x, y, cz + z, d.pick(cx + x, y, cz + z, STONE, 4))
        d.put(cx, tall + 1, cz, "sea_lantern"); d.put(cx + 1, tall + 1, cz, "prismarine_brick_slab", half="bottom")
    return d


# ---------------------------------------------------------------- the Ash Seneschal


def seneschal():
    """The Faceless Gate over the vault stair at Sunscar."""
    d = D("boss_seneschal", seed=721)
    SAND = [("smooth_sandstone", 5), ("cut_sandstone", 2), ("sandstone", 2)]
    RED = [("smooth_red_sandstone", 4), ("cut_red_sandstone", 2), ("red_sandstone", 1)]
    clear = lambda x, z: abs(x) <= 2 and -14 <= z <= 1   # the stair mouth and run, open to the sky
    # twin pylons astride the stair mouth, battered (narrowing) and capped with a cavetto cornice
    for s in (-1, 1):
        for y in range(1, 22):
            w = 4 - y // 8
            for x in range(3, 3 + 2 * w + 1):
                for z in range(-3 + y // 10, 4 - y // 10):
                    X = s * x
                    d.put(X, y, z, d.pick(X, y, z, SAND if y % 6 else [("cut_sandstone", 1)], 1))
        for x in range(3, 12):
            for z in range(-4, 5):
                X = s * x
                if abs(z) == 4 or x in (3, 11): d.put(X, 22, z, "smooth_sandstone_stairs", facing="s" if z == 4 else "n" if z == -4 else ("e" if X > 0 else "w") if x == 11 else ("w" if X > 0 else "e"), half="top")
                else: d.put(X, 22, z, "cut_red_sandstone")
                d.put(X, 23, z, "smooth_sandstone_slab", half="bottom")
        for y in (6, 12, 18): d.put(s * 3, y, -4, "orange_terracotta")
    for x in range(-3, 4):   # the lintel between them, a carved band, braziers on it
        for z in range(-2, 3):
            for y in (16, 17, 18): d.put(x, y, z, "cut_red_sandstone" if y == 17 else "smooth_sandstone")
        d.put(x, 17, -3, "chiseled_red_sandstone")
    for s in (-1, 1): d.put(s * 2, 19, 0, "campfire")
    # the seated faceless figure behind the gate, over the vault (on top of the ground, z -12..-30)
    fx, fz, FY = 0, -26, 7   # raised on a tall stepped plinth so it shows over the pylons
    for step, rr in enumerate((11.5, 10.5, 9.5)):   # a stepped plinth, three tiers
        for (x, z) in disc(rr):
            for y in range(1 + step * 3, 4 + step * 3): d.put(fx + x, y, fz + z, d.pick(fx + x, y, fz + z, RED, 2))
    for (x, z) in disc(8.5):
        d.put(fx + x, 10, fz + z, "smooth_red_sandstone_slab", half="bottom")
    blob(d, fx, 14 + FY, fz - 2, 7.5, SAND, 3, squash=1.6)          # the body, robed
    blob(d, fx, 6 + FY, fz + 3, 6.5, SAND, 3, squash=0.6)           # the lap
    for s in (-1, 1):
        tube(d, [(fx + s * 6, 20 + FY, fz - 2), (fx + s * 7, 13 + FY, fz + 1), (fx + s * 5, 8 + FY, fz + 5)], 2.0, 1.6, SAND, 4)   # arms
        blob(d, fx + s * 4, 4 + FY, fz + 6, 2.6, SAND, 4)          # knees
        blob(d, fx + s * 5, 7 + FY, fz + 6, 1.8, "cut_sandstone", 4)   # hands on the knees
    blob(d, fx, 27 + FY, fz - 2, 4.6, "smooth_quartz", 5, squash=1.25)   # the head: smooth and white, no face at all
    for x in range(-5, 6):   # the headdress, striped
        for y in range(23 + FY, 31 + FY):
            for z in range(-3, 2):
                if d.get(fx + x, y, fz - 2 + z - 2) is None and abs(x) >= 4 and (z <= 0):
                    d.put(fx + x, y, fz - 4 + z, "orange_terracotta" if y % 2 else "cyan_terracotta")
    d.put(fx, 32 + FY, fz - 2, "gold_block"); d.put(fx, 33 + FY, fz - 2, "lightning_rod", bs={"facing_direction": 1})
    # the processional way to the south, faceless statues either side
    for z in range(2, 30):
        for x in range(-2, 3): d.put(x, 0, z, "smooth_sandstone" if (x + z) % 3 else "cut_red_sandstone")
    import faceless_statues as FS   # robed, hooded, faceless figures on plinths, four standing and four fallen
    FS.avenue(d)
    for c in list(d.cells.keys()):
        if clear(c[0], c[2]) and c[1] >= 0 and c[1] < 16: del d.cells[c]
    return d


# ---------------------------------------------------------------- the Mother of Changelings


def mother(cave_r=13.5, floor=-12, h=9, ramp=11):
    """The Cradle Tree over the changelings' cave."""
    d = D("boss_mother", seed=731)
    WOOD = [("mangrove_log", 5), ("mangrove_wood", 2), ("dark_oak_log", 1)]
    in_cave = lambda x, y, z: math.hypot(x, z) <= cave_r + 1 and floor - 1 <= y <= floor + h + 1
    in_ramp = lambda x, y, z: abs(x) <= 2 and 0 <= z <= cave_r + ramp + 2 and y >= floor + (z - cave_r) * 0 - 1 and y <= 4
    keep = lambda x, y, z: not in_cave(x, y, z) and not (abs(x) <= 2 and z >= 8 and y <= 4)
    # the trunk: thick, slightly twisted, on the cave's roof
    for y in range(0, 30):
        r = 5.2 - y * 0.06
        ox, oz = round(math.sin(y * 0.12) * 1.2), round(math.cos(y * 0.09) * 1.0) - 1
        for (x, z) in disc(r):
            if keep(ox + x, y, oz + z): d.put(ox + x, y, oz + z, d.pick(ox + x, y, oz + z, WOOD, 1), axis="y")
    # buttress roots arching out and down round the cave, into the ground beyond it
    for k in range(9):
        a = math.radians(20 + 40 * k)
        ux, uz = math.sin(a), math.cos(a)
        if abs(math.degrees(a) % 360) < 25 or abs(math.degrees(a) % 360 - 360) < 25: pass
        pts = [(ux * 4, 9, uz * 4), (ux * 10, 7, uz * 10), (ux * 16, 3, uz * 16), (ux * 20, -2, uz * 20), (ux * 22, -10, uz * 22)]
        tube(d, pts, 2.2, 1.0, WOOD, 2, keep)
    for s in (-1, 1):   # two roots that arch right over the ramp mouth
        pts = [(s * 4, 10, 3), (s * 4, 12, 12), (s * 3, 9, 20), (s * 5, 3, 25), (s * 6, -3, 27)]
        tube(d, pts, 1.8, 1.0, WOOD, 3, keep)
    # limbs and the canopy
    for k in range(7):
        a = math.radians(10 + 360 / 7 * k)
        ux, uz = math.sin(a), math.cos(a)
        end = (ux * 17, 32 + 3 * d.r(k, 1, 0), uz * 17)
        tube(d, [(0, 22, -1), (ux * 8, 28, uz * 8), end], 2.2, 1.0, WOOD, 4)
        blob(d, round(end[0]), round(end[1]) + 2, round(end[2]), 6.5, [("mangrove_leaves", 6), ("azalea_leaves", 1), ("moss_block", 1)], 5, squash=0.6, only_empty=True)
    blob(d, 0, 36, -1, 9.5, [("mangrove_leaves", 6), ("azalea_leaves", 1)], 6, squash=0.55, only_empty=True)
    # hanging roots under the canopy, and empty cradles on chains
    leaves = [c for c, (b, _) in d.cells.items() if b.endswith("leaves")]
    for (x, y, z) in leaves:
        if d.get(x, y - 1, z) is None and d.r(x, y, z) < 0.18:
            for k in range(1 + int(4 * d.r(x, 1, z))):
                if d.get(x, y - 1 - k, z) is None and y - 1 - k > 4: d.put(x, y - 1 - k, z, "hanging_roots" if k else "mangrove_roots")
    for k in range(6):
        a = math.radians(30 + 60 * k)
        x, z = round(math.sin(a) * 12), round(math.cos(a) * 12)
        top = max((c[1] for c in d.cells if c[0] == x and c[2] == z and c[1] > 15), default=26)
        for y in range(14, top): d.put(x, y, z, "iron_chain", axis="y")
        d.put(x, 13, z, "spruce_slab", half="top")   # the cradle: a little box of trapdoors
        for f, (dx, dz) in CARD.items(): d.put(x + dx, 13, z + dz, "spruce_trapdoor", facing=f, open=True)
        d.put(x, 12, z, "ochre_froglight") if k % 2 == 0 else None
    return d


# ---------------------------------------------------------------- Mirelight


def mirelight():
    """The Lantern Mast in Mirelight's lantern square."""
    d = D("boss_mirelight", seed=741)
    for (x, z) in disc(2.5):
        d.put(x, 0, z, "mud_bricks"); d.put(x, 1, z, "mud_brick_slab", half="bottom") if math.hypot(x, z) > 1.5 else None
    for y in range(1, 22): d.put(0, y, 0, "mangrove_log", axis="y")
    d.put(0, 22, 0, "mangrove_fence"); d.put(0, 23, 0, "verdant_froglight")
    for y, ln in ((8, 3), (13, 3), (18, 2)):   # three tiers of arms, a lantern hung under every arm end
        for f, (dx, dz) in CARD.items():
            for s in range(1, ln + 1): d.put(dx * s, y, dz * s, "mangrove_fence")
            d.put(dx * ln, y - 1, dz * ln, "iron_chain", axis="y")
            d.put(dx * ln, y - 2, dz * ln, "verdant_froglight" if y != 13 else "ochre_froglight")
            d.put(dx * ln, y - 3, dz * ln, "mangrove_trapdoor", facing=f, half="top")
    for y in (4, 5): d.put(1, y, 0, "moss_block") if y == 4 else d.put(-1, y, 0, "moss_block")
    return d


MONUMENTS = {"huntsman": (huntsman, "Boss site · the Antler Crown over Hallowmere (Pale Huntsman)"),
             "bride": (bride, "Boss site · the Drowned Bell Tower (Drowned Bride)"),
             "seneschal": (seneschal, "Boss site · the Faceless Gate (Ash Seneschal)"),
             "mother": (mother, "Boss site · the Cradle Tree (Mother of Changelings)"),
             "mirelight": (mirelight, "Boss site · the Lantern Mast, Mirelight")}


def _areas():
    """Mateo 2026-11-12: every boss site is the whole area, not a monument: boss_areas.py draws each one against the
    real map ground (needs the map heights, area_ground.py). The monuments above are pieces of those areas."""
    import boss_areas
    return {k: (fn, "Boss area · " + t) for k, (fn, t) in boss_areas.DESIGNS.items()}


def blocks_of(d):
    import export_landmarks as X
    b = X.compute(d.spec())
    for c in d.airs(): b[c] = ("air", {})
    return b


def stamp(name, blocks):
    import bp as BP
    B = BP.Blueprint(name)
    for (x, y, z), (n, p) in blocks.items():
        p = dict(p)
        if "bs" in p: p["raw"] = {**p.pop("bs"), **p.get("raw", {})}
        B.set(x, y, z, n, **p)
    o, size = B._grid()
    pal, cells = B.palette_and_blocks()
    out = {"name": name, "format": "hollow-crown-stamp/1", "size": list(size), "origin": list(o), "ground_y": 0, "palette": pal}
    if len(cells) < 4000:
        out["blocks"] = [[x - o[0], y - o[1], z - o[2], i] for x, y, z, i in cells]
    else:
        out["cols"] = encode_cols([(x - o[0], y - o[1], z - o[2], i) for x, y, z, i in cells], len(pal))
    return out


ALPHA = "".join(chr(c) for c in range(35, 127) if c != 92)   # 91 symbols; "!" is a gap


def encode_cols(cells, npal):
    """Whole areas run to 100k+ cells, so big stamps carry their cells as columns: "x,z,y0:" then one symbol per
    cell going up (two per cell when the palette passes 91), "!" (or "!!") where a column skips a cell; ";" between
    columns. unlocks/landmarks.js stampOps reads it."""
    w = 1 if npal <= len(ALPHA) else 2
    sym = (lambda i: ALPHA[i]) if w == 1 else (lambda i: ALPHA[i // len(ALPHA)] + ALPHA[i % len(ALPHA)])
    cols = {}
    for x, y, z, i in cells: cols.setdefault((x, z), {})[y] = i
    parts = []
    for (x, z), ys in sorted(cols.items()):
        y0, y1 = min(ys), max(ys)
        parts.append(f"{x},{z},{y0}:" + "".join(sym(ys[y]) if y in ys else "!" * w for y in range(y0, y1 + 1)))
    return {"w": w, "data": ";".join(parts)}


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else None
    stamps, names = {}, {}
    js = not out or "--js" in sys.argv
    for key, (fn, title) in (_areas() if js else MONUMENTS).items():   # the viewer scenes stay the monuments on a pad;
        bl = blocks_of(fn())                                            # the areas need the real map (area_preview)
        if js:
            stamps[key] = stamp(f"boss_{key}", bl)
            print(key, len(bl), "cells")
        if out and key in MONUMENTS and not js:
            pad = {"huntsman": "packed_ice", "bride": "water", "seneschal": "red_sand", "mother": "mud", "mirelight": "mud"}[key]
            pal, idx, rows = [], {}, []

            def ix(n, p):
                k = json.dumps([n, p], sort_keys=True)
                if k not in idx: idx[k] = len(pal); pal.append([n, p])
                return idx[k]
            xs = [c[0] for c in bl]; zs = [c[2] for c in bl]; ys = [c[1] for c in bl]
            for x in range(min(xs) - 2, max(xs) + 3):
                for z in range(min(zs) - 2, max(zs) + 3):
                    if (x, 0, z) not in bl: rows.append([x, 0, z, ix(pad, {})])
            for (x, y, z), (n, p) in sorted(bl.items()):
                if n != "air" and y >= -2: rows.append([x, y, z, ix(n, p)])
            os.makedirs(os.path.join(out, key), exist_ok=True)
            size = max(max(xs) - min(xs), max(zs) - min(zs), max(ys)) + 4
            cam = {"views": {"front-left": [215, 18, size * 1.9, 0, max(ys) * 0.4, 0], "south": [20, 16, size * 1.9, 0, max(ys) * 0.4, 0], "high": [200, 45, size * 2.1, 0, max(ys) * 0.3, 0]}}
            json.dump({"name": key, "palette": pal, "blocks": rows, "camera": cam}, open(os.path.join(out, key, "scene.json"), "w"), separators=(",", ":"))
            names[key] = title
    if out: json.dump(names, open(os.path.join(out, "names.json"), "w"), indent=1)
    if not js: return   # the viewer only wants its scenes
    with open(OUT_JS, "w") as f:
        f.write("// Generated by map/structures/boss_landmarks.py. Do not edit by hand.\n"
                "// Each boss site's whole area (boss_areas.py: the ground shaped against the real map, the landmark, the set\n"
                "// dressing), as hollow-crown-stamp/1 stamps: offsets from the site centre that unlocks/plans.js uses; big ones\n"
                "// carry their cells as columns (cols, see encode_cols). unlocks/landmarks.js puts them in LANDMARKS.\n")
        f.write("export const STAMPS = " + json.dumps(stamps, separators=(",", ":")) + ";\n")
    print("wrote", OUT_JS, os.path.getsize(OUT_JS) // 1024, "KB")


if __name__ == "__main__":
    main()
