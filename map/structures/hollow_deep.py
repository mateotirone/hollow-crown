"""The Deep: the halls under the Vault where the swallowed Grey Host still stands (Act V, arc 2, scripts/after/deep.js).

    python3 hollow_deep.py [--scenes DIR] [--no-write]   -> Siege_Nights_BP/scripts/after/data/deep_design.js

Drawn with the building engine (landmarks.D + the skill's compute, like hollow_arenas.py) to the Hollow's style page
(.claude/skills/minecraft-builder/regions/hollow.md): veinstone and blackstone, soul light only, nothing bright, no
Crown colours (this is not the Seat). It hangs in the void under the Heart, so it carries its own two-block shell.

Origin = DEEP.origin in after/deep.js. Players walk at y = 0 on the Landing; y = -1 is its floor. +z runs south.
    The Landing      x -4..4, z -4..4, walk 0. Players arrive at (0, 0, 1). The bell at (0, 0, -3) takes them up.
    The Long Nave    x -5..5, z 5..47, three flights down: walk 0, -3, -6. Pointed vault, ribs every 6.
    The Bell Room    round, r 14 of clear floor round (0, -6, 63), walk -6: Ulfa's arena. The great bell hangs over it.
    The Seal         x -2..2, z 78, walk -6..-2: siege:court_seal. deep.js opens it when Ulfa falls (DEEP.seal).
    The Ranks        x -15..15, z 79..107. The Note floor (Everwake's Hollow Note trial, asked for by the Cloud City
                     thread): flat stone, x -4..4, z 81..89, walk -6, with a cracked bell-shaped hollow round
                     (0, -6, 85). South of it five tiers rise one block each (z 93 + 3k .. 95 + 3k, walk -5 + k): one
                     company of the Host stands on each, at x -8, -4, 0, 4, 8 on z 94 + 3k (the serjeant at x 0).
Every room is 1 block wider than tall in odd sizes (work in threes). Nothing is lived in, so there is no interior stage:
the "rooms" are the interior.
"""
import argparse, json, math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import export_landmarks as X  # noqa: E402  (the skill's compute)
from landmarks import D  # noqa: E402

VEIN = [("siege:veinstone_bricks", 74), ("siege:cracked_veinstone_bricks", 14), ("polished_blackstone_bricks", 12)]
FLOOR = [("siege:veinstone_bricks", 6), ("siege:cracked_veinstone_bricks", 2), ("polished_blackstone_bricks", 2)]
SHELL = "siege:veil_rock"

BELL_C, BELL_R = (0, 63), 14          # Ulfa's arena: centre (x, z), clear floor radius
NOTE_C = (0, 85)                      # the Hollow Note hollow
TIER_Z0, TIERS = 93, 5
COMPANY_X = (-8, -4, 0, 4, 8)


def nave_walk(z):
    return 0 if z <= 15 else -3 if 19 <= z <= 29 else -6 if z >= 33 else None


def tier_walk(z):
    k = (z - TIER_Z0) // 3
    return -5 + k if 0 <= k < TIERS else -6


def interior():
    """Every air cell a player can stand in or see, and the walking level of each column."""
    air, walk = set(), {}

    def col(x, z, w, top):
        walk[(x, z)] = w
        for y in range(w, top + 1): air.add((x, y, z))

    for x in range(-4, 5):                                   # the Landing
        for z in range(-4, 5): col(x, z, 0, 5)
    for z in range(5, 48):                                   # the Long Nave and its three flights
        w = nave_walk(z)
        if w is None:                                        # a flight: three steps down, one a row
            w = {16: -1, 17: -2, 18: -3, 30: -4, 31: -5, 32: -6}[z]
        for x in range(-5, 6):
            top = w + 5 + {5: 0, 4: 0, 3: 1, 2: 2, 1: 3, 0: 4}[abs(x)] if abs(x) < 6 else w + 5
            col(x, z, w, top)
    for x in range(-2, 3):                                   # the arch into the Bell Room
        for z in (48, 49): col(x, z, -6, -1)
    cx, cz = BELL_C
    for x in range(-15, 16):                                 # the Bell Room: a dome
        for z in range(cz - 15, cz + 16):
            d = math.hypot(x - cx, z - cz)
            if d <= BELL_R + 0.5: col(x, z, -6, -6 + 6 + int(0.6 * math.sqrt(max(0, (BELL_R + 1) ** 2 - d * d))))
    for x in range(-2, 3):                                   # the passage to the Seal and the Ranks
        for z in range(77, 80): col(x, z, -6, -2)
    for x in range(-15, 16):                                 # the Ranks
        for z in range(80, 108): col(x, z, tier_walk(z) if abs(x) <= 14 else -6, 5)
    return air, walk


def deep():
    d = D("the_deep", "rigid", seed=2417)
    air, walk = interior()
    for c in air: d.air(*c)
    # the shell: two blocks of rock round every air cell; the inner face dressed stone, the outer Veil Rock
    near1, near2 = set(), set()
    for (x, y, z) in air:
        for dx in (-2, -1, 0, 1, 2):
            for dy in (-2, -1, 0, 1, 2):
                for dz in (-2, -1, 0, 1, 2):
                    c = (x + dx, y + dy, z + dz)
                    if c in air: continue
                    (near1 if max(abs(dx), abs(dy), abs(dz)) == 1 else near2).add(c)
    near2 -= near1
    for c in near2: d.put(*c, SHELL)
    for (x, y, z) in near1:
        if (x, y + 1, z) in air: d.put(x, y, z, d.pick(x, y, z, FLOOR, 3))       # a floor
        else: d.put(x, y, z, d.pick(x, y, z, VEIN))                            # a wall or a ceiling
    landing(d, walk); nave(d, walk); bell_room(d); ranks(d, walk)
    return d


def stair(d, x, y, z, facing, half="bottom", mat="polished_blackstone_brick_stairs"):
    d.put(x, y, z, mat, facing=facing, half=half)


def landing(d, walk):
    for x in range(-4, 5):
        for z in range(-4, 5):
            if abs(x) == 4 or abs(z) == 4: d.put(x, -1, z, "polished_blackstone_bricks")   # a border round the floor
    d.put(0, -1, 0, "chiseled_polished_blackstone")
    d.put(0, -1, -3, "polished_blackstone"); d.put(0, 0, -3, "bell")                    # the bell that takes you up
    for x in (-1, 1): d.put(x, 0, -3, "polished_blackstone_wall")
    for x, z in ((-3, -3), (3, -3), (-3, 3), (3, 3)):                                   # four lamps on posts
        d.put(x, 0, z, "polished_blackstone_wall"); d.put(x, 1, z, "soul_lantern", hanging=False)
    for x in range(-4, 5): d.put(x, 5, -4, "polished_blackstone_brick_slab", half="top")
    for x in (-5, 5):                                                                   # the arch into the nave
        for y in range(0, 6): d.put(x, y, 5, "polished_blackstone_bricks")
    for z in (4, 5):
        for x in (-4, 4): d.put(x, 5, z, "polished_blackstone_brick_stairs", facing="e" if x < 0 else "w", half="top")


def nave(d, walk):
    for z in range(5, 48):
        w = walk[(0, z)]
        flight = nave_walk(z) is None
        if flight:                                                                     # the steps themselves
            for x in range(-5, 6): stair(d, x, w, z, "n", mat="polished_blackstone_brick_stairs"); d.put(x, w - 1, z, "polished_blackstone_bricks")
            for x in range(-5, 6): d.air(x, w + 1, z)
            continue
        for x in range(-5, 6):                                                          # a runner down the middle
            if abs(x) <= 1: d.put(x, w - 1, z, "polished_deepslate" if x == 0 else "deepslate_tiles")
        if z % 6 == 0:                                                                  # a rib, wall to wall over the vault
            for x in (-6, 6):
                for y in range(w - 1, w + 6): d.put(x, y, z, "polished_blackstone_bricks")
            for x in range(-5, 6):
                top = w + 5 + {5: 0, 4: 0, 3: 1, 2: 2, 1: 3, 0: 4}[abs(x)]
                d.put(x, top + 1, z, "polished_blackstone_bricks")
            for x in (-5, 5): d.put(x, w + 5, z, "polished_blackstone_brick_stairs", facing="e" if x < 0 else "w", half="top")
            if z % 12 == 0:                                                             # a hanging lamp from every other rib
                top = w + 9
                d.put(0, top, z, "iron_chain", axis="y"); d.put(0, top - 1, z, "soul_lantern", hanging=True)
        if z % 6 == 3:                                                                  # the Host's old shields on the walls
            for x, f in ((-6, "e"), (6, "w")):
                d.put(x, w + 2, z, "spruce_trapdoor", facing=f, open=True)
                d.put(x + (1 if x < 0 else -1), w + 3, z, "soul_lantern", hanging=False) if z % 12 == 3 else None
        if z % 6 in (1, 5):                                                              # glimbulbs set in the walls, low
            for x in (-6, 6): d.put(x, w + 1, z, "siege:glimbulb") if (z // 6) % 2 else None
    # glow lichen and Veilcap where the floor meets the wall, here and there
    for z in range(5, 48):
        w = walk[(0, z)]
        if nave_walk(z) is None: continue
        for x in (-5, 5):
            r = d.r(x, w, z, 5)
            if r < 0.12: d.put(x, w, z, "siege:veilcap")
            elif r < 0.22: d.put(x, w, z, "glow_lichen")


def bell_room(d):
    cx, cz = BELL_C
    w = -6
    for x in range(-15, 16):                                                            # the floor: rings and spokes
        for z in range(cz - 15, cz + 16):
            r = math.hypot(x - cx, z - cz)
            if r > BELL_R + 0.5: continue
            if r < 1.5: b = "chiseled_polished_blackstone"
            elif r < 3.5: b = "polished_blackstone"
            elif any(r0 <= r < r0 + 1 for r0 in (5, 10)): b = "polished_blackstone_bricks"
            elif r >= 13.5: b = "polished_blackstone_bricks"
            elif r > 4 and min(abs((math.degrees(math.atan2(z - cz, x - cx)) - k * 45 + 180) % 360 - 180) for k in range(8)) * math.pi / 180 * r < 0.55:
                b = "deepslate_tiles"
            else: b = d.pick(x, w - 1, z, FLOOR, 7)
            d.put(x, w - 1, z, b)
    for k in range(12):                                                                 # pilasters round the wall, a lamp on every other
        a = math.radians(k * 30 + 15)
        px, pz = round(cx + math.cos(a) * 15.5), round(cz + math.sin(a) * 15.5)
        if abs(px - cx) <= 3 and (pz < cz): continue                                     # not across the arch in
        if abs(px - cx) <= 3 and (pz > cz): continue                                     # nor the Seal
        for y in range(w, w + 6): d.put(px, y, pz, "polished_blackstone_bricks")
        if k % 2 == 0:
            lx, lz = round(cx + math.cos(a) * 14), round(cz + math.sin(a) * 14)
            d.put(lx, w, lz, "polished_blackstone_wall"); d.put(lx, w + 1, lz, "soul_lantern", hanging=False)
    # the great bell: bronze, mouth over head height, hung on chains from the top of the dome
    prof = [(7, 4.5), (8, 3.8), (9, 3.3), (10, 3.0), (11, 2.9), (12, 2.7), (13, 2.2), (14, 1.3)]   # (height above the floor, radius): lip, waist, shoulder, crown
    for h, rad in prof:
        for x in range(-5, 6):
            for z in range(-5, 6):
                r = math.hypot(x, z)
                if r <= rad + 0.25 and (r >= rad - 1.0 or h >= 13):
                    b = "waxed_exposed_cut_copper" if h in (7, 12) else "waxed_cut_copper"     # a darker band at the lip and the shoulder
                    if x == 2 and h in (8, 9, 10) and z > 0: b = "waxed_oxidized_cut_copper"   # the old crack, gone green
                    d.put(cx + x, w + h, cz + z, b)
    d.put(cx, w + 6, cz, "iron_chain", axis="y")                                         # the clapper, hanging still
    for y in range(w + 15, w + 16): d.put(cx, y, cz, "iron_chain", axis="y")
    for x, z in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        for y in range(w + 14, w + 16): d.put(cx + x, y, cz + z, "iron_chain", axis="y")
    # the Seal, closed: deep.js opens it (DEEP.seal) when Ulfa falls
    for x in range(-2, 3):
        for y in range(w, w + 5): d.put(x, y, 78, "siege:court_seal")
    for x in (-3, 3):
        for y in range(w, w + 6): d.put(x, y, 78, "polished_blackstone_bricks")
    for x in range(-2, 3): d.put(x, w + 5, 78, "chiseled_polished_blackstone" if x == 0 else "polished_blackstone_bricks")


BELL_SHAPE = {-3: 0, -2: 1, -1: 1, 0: 1, 1: 2, 2: 2, 3: 3}   # row (z from the centre) -> half width: a bell laid flat, crown north


def ranks(d, walk):
    w = -6
    nx, nz = NOTE_C
    for x in range(-15, 16):                                                            # the open floor before the tiers
        for z in range(80, TIER_Z0):
            d.put(x, w - 1, z, d.pick(x, w - 1, z, FLOOR, 9))
    for x in range(-4, 5):                                                              # the Note floor: flat stone
        for z in range(nz - 4, nz + 5):
            d.put(x, w - 1, z, "polished_deepslate" if abs(x) < 4 and abs(z - nz) < 4 else "polished_blackstone_bricks")
    for dz, hw in BELL_SHAPE.items():                                                   # the hollow, one deep, cracked
        for x in range(-hw, hw + 1):
            d.air(nx + x, w - 1, nz + dz)
            d.put(nx + x, w - 2, nz + dz, "cracked_deepslate_tiles")
    for x, z in ((1, 4), (2, 5), (2, 6), (3, 7), (-1, -4)):                             # the crack running out of it
        d.put(nx + x, w - 1, nz + z, "cracked_deepslate_bricks")
    for k in range(TIERS):                                                              # five tiers, a rise of one each
        z0, top = TIER_Z0 + 3 * k, -5 + k
        for x in range(-14, 15):
            for z in range(z0, z0 + 3):
                for y in range(w - 1, top):
                    d.put(x, y, z, "polished_blackstone_bricks" if y == top - 1 and z == z0 else d.pick(x, y, z, VEIN))
            stair(d, x, top - 1, z0, "s", half="bottom") if abs(x) in (13, 14) else None
        for x in (-11, 11):                                                             # a lamp at each end of the company
            d.put(x, top, z0 + 1, "polished_blackstone_wall"); d.put(x, top + 1, z0 + 1, "soul_lantern", hanging=False)
    for x in range(-12, 13, 6):                                                         # the back wall: pilasters, and the Host's shields between
        for y in range(-1, 6): d.put(x, y, 108, "polished_blackstone_bricks")
        d.put(x, 5, 107, "polished_blackstone_brick_stairs", facing="n", half="top")
        if x < 12:
            for sx in (x + 2, x + 4): d.put(sx, 1, 107, "spruce_trapdoor", facing="n", open=True)
            d.put(x + 3, 3, 108, "siege:glimbulb")
    for x in range(-14, 15, 4):                                                         # chains and lamps over the Note floor
        if abs(x) > 6: continue
        d.put(x, 5, 82, "iron_chain", axis="y"); d.put(x, 4, 82, "soul_lantern", hanging=True)
    for z in range(80, 108, 4):                                                         # glimbulbs in the side walls
        for x in (-16, 16): d.put(x, -3, z, "siege:glimbulb")


def export(d):
    blocks = X.compute(d.spec())
    for c in d.airs(): blocks.pop(c, None)   # it hangs in the void: air is already there, so none is written
    pal, idx, cells = [], {}, {}
    for c, (n, p) in blocks.items():
        if n == "air": continue
        q = {k: v for k, v in p.items() if k in ("facing", "half", "axis", "hanging", "open")}
        key = json.dumps([n, q], sort_keys=True)
        if key not in idx: idx[key] = len(pal); pal.append([n if ":" in n else "minecraft:" + n, q])
        cells[c] = idx[key]
    rows = []
    for (y, z, x) in sorted((c[1], c[2], c[0]) for c in cells):
        v = cells[(x, y, z)]
        if rows and rows[-1][0] == y and rows[-1][1] == z and rows[-1][2] + rows[-1][3] == x and rows[-1][4] == v: rows[-1][3] += 1
        else: rows.append([y, z, x, 1, v])
    xs = [c[0] for c in cells]; ys = [c[1] for c in cells]; zs = [c[2] for c in cells]
    return {"palette": pal, "rows": rows, "v": 1, "box": {"x0": min(xs), "x1": max(xs), "y0": min(ys), "y1": max(ys), "z0": min(zs), "z1": max(zs)}}


def check(v):
    """The spots the game relies on: open where players and the Host stand, solid under them."""
    idx = {}
    for y, z, x0, n, i in v["rows"]:
        for x in range(x0, x0 + n): idx[(x, y, z)] = v["palette"][i][0]
    air = lambda c: c not in idx
    problems = []
    spots = [(0, 0, 1), (0, -6, 63), (NOTE_C[0], -6, NOTE_C[1] - 4)]
    for k in range(TIERS):
        for x in COMPANY_X: spots.append((x, -5 + k, TIER_Z0 + 3 * k + 1))
    for (x, y, z) in spots:
        if not (air((x, y, z)) and air((x, y + 1, z))): problems.append(f"not open at {(x, y, z)}")
        if air((x, y - 1, z)): problems.append(f"nothing under {(x, y, z)}")
    for r in range(1, BELL_R):                                                          # the arena floor is flat and clear (the lamps stand at r 14)
        for a in range(0, 360, 15):
            x, z = round(BELL_C[0] + math.cos(math.radians(a)) * r), round(BELL_C[1] + math.sin(math.radians(a)) * r)
            if not (air((x, -6, z)) and air((x, -5, z))): problems.append(f"arena blocked at {(x, z)}")
    if v["box"]["y1"] > 11 or v["box"]["y0"] < -10: problems.append(f"too tall for the void band: {v['box']}")
    return problems


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--scenes"); ap.add_argument("--no-write", action="store_true"); a = ap.parse_args()
    v = export(deep())
    problems = check(v)
    print("DEEP_DESIGN", sum(r[3] for r in v["rows"]), "cells,", len(v["rows"]), "rows,", v["box"])
    dest = os.path.join(HERE, "..", "..", "Siege_Nights_BP", "scripts", "after", "data", "deep_design.js")
    js = ("// Generated by map/structures/hollow_deep.py. Do not edit by hand.\n"
          "// The Deep: palette [id, logical props], rows [y, z, x0, count, palette index] as offsets from DEEP.origin (after/deep.js).\n"
          "export const DEEP_DESIGN = " + json.dumps(v, separators=(",", ":")) + ";\n")
    if not a.no_write and not problems: open(dest, "w").write(js)
    print("wrote" if not a.no_write and not problems else "(not written)", os.path.normpath(dest), round(len(js) / 1e3), "KB")
    if a.scenes:
        blocks = [[x, y + 12, z, i] for y, z, x0, n, i in v["rows"] for x in range(x0, x0 + n) if v["palette"][i][0] != "minecraft:air"]
        pal = [[n.replace("minecraft:", "").replace("siege:veinstone_bricks", "deepslate_bricks").replace("siege:cracked_veinstone_bricks", "cracked_deepslate_bricks")
                .replace("siege:veil_rock", "blackstone").replace("siege:court_seal", "chiseled_deepslate").replace("siege:glimbulb", "ochre_froglight")
                .replace("siege:veilcap", "crimson_fungus"), p] for n, p in v["palette"]]
        os.makedirs(a.scenes, exist_ok=True)
        json.dump({"palette": pal, "blocks": blocks}, open(os.path.join(a.scenes, "scene.json"), "w"))
    if problems: print("PROBLEMS:\n  " + "\n  ".join(problems[:30])); sys.exit(1)


if __name__ == "__main__":
    main()
