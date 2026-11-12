"""Gull's Rest harbour (Mateo 2026-11-12: "let's do it in 3D, and then let's just design it").

The town moves down to the west coast so the sea is inside its ward, and gets a real harbour, laid by hand
like a station spot because the map is one fixed world:

  * a stone quay wall along the straight shore (x = -922, z 383..423), the promenade behind it at y 64;
  * a north breakwater (out west, then turning south) with the lighthouse on its head, and a shorter south
    breakwater, so the basin opens to the south-west through a 13-wide mouth;
  * the basin dredged to 4 deep (the shore here is a 1-2 deep shoal), a timber jetty on piles across it;
  * the harbourmaster's hut on the quay, a cargo crane, bollards, lanterns that read in a sea fret;
  * the boathouse straddling the shore south of the basin, its slip open to the sea.

Buildings come from the building skill (harbour_specs/*.json through the skill's engine.py, Mateo's one
engine), in the Saltreach style: salt_stone / salt_timber, sea-green hip roofs, white tower banded in teal.
Moles, quay, jetty and basin are groundwork blocks (town.works); everything is marked TAKEN so the town's
streets and houses keep off it, and the promenade is a main street the rest of the town joins.
"""
import os, sys, json, math
HERE = os.path.dirname(os.path.abspath(__file__))
from bp import Blueprint

SEA = 62          # water surface y
TOP = 64          # quay, mole and jetty walking surface y
BED = 58          # dredged basin floor y

QUAY_X = -922                             # quay wall face (the first water column)
QUAY_Z = (383, 423)
NORTH = [((-951, 378), (-922, 382)), ((-951, 378), (-947, 401))]   # breakwater boxes (inclusive)
SOUTH = [((-939, 424), (-922, 428))]
LIGHT = (-949, 405)                        # lighthouse centre on the north head
SOUTH_HEAD = (-939, 426)
BASIN = ((-946, 383), (-923, 423))
JETTY = ((-936, 402), (-922, 404))
HUT = (-911, 388, 90)                      # x, z, rotation (front faces west onto the promenade)
BOATHOUSE = (-912, 438, 270)               # water end west, land door east
CRANE = (-920, 414)
SQUARE = (-910, 403)


def _skill_scripts():
    """The building skill's scripts folder: in this repo, or SKILL_DIR for a checkout without it yet."""
    cands = [os.environ.get("SKILL_DIR", "")]
    d = HERE
    for _ in range(4):
        cands.append(os.path.join(d, ".claude", "skills", "minecraft-builder", "scripts")); d = os.path.dirname(d)
    for c in cands:
        if c and os.path.exists(os.path.join(c, "engine.py")): return c
    raise SystemExit("harbour.py needs the minecraft-builder skill (.claude/skills/minecraft-builder, PR #155) or SKILL_DIR")


def skill_build(name, door):
    """harbour_specs/<name>.json built by the skill's engine into a Blueprint, door marker given (x, z)."""
    p = _skill_scripts()
    if p not in sys.path: sys.path.insert(0, p)
    import engine
    spec = json.load(open(os.path.join(HERE, "harbour_specs", name + ".json")))
    bp = Blueprint(spec["name"]); engine.into_blueprint(bp, spec)
    bp.cells = {c: v for c, v in bp.cells.items() if v[0] != "air"}
    bp.markers["door"] = (door[0], 0, door[1])
    return bp


def h(x, z, s=0):
    v = (x * 73856093) ^ (z * 19349663) ^ (s * 83492791)
    return ((v ^ (v >> 13)) & 0xffff) / 65535.0


def stone(x, y, z):
    r = h(x * 3 + y, z, 7)
    if y < SEA - 1: return "mossy_cobblestone" if r < 0.3 else "cobblestone" if r < 0.65 else "andesite"
    return "stone_bricks" if r < 0.45 else "andesite" if r < 0.75 else "cobblestone"


def cells(box):
    (x0, z0), (x1, z1) = box
    return [(x, z) for x in range(x0, x1 + 1) for z in range(z0, z1 + 1)]


def build(t):
    """Lay the harbour into town t (a towngen.Town) right after its square: moles, basin, quay, jetty,
    lighthouse, hut, crane and boathouse. Returns the promenade's cells for the street."""
    W = t.works
    def col(x, z, top=TOP, mat=stone):
        if not t.ok(x, z): return
        g0 = int(t.at(t.G0, x, z))
        for y in range(min(g0, BED) - 1, top): W[(x, y, z)] = (mat(x, y, z), {})
        W[(x, top, z)] = (("polished_andesite" if h(x, z, 3) < 0.4 else "stone_bricks"), {})
        for y in range(top + 1, top + 4): W.setdefault((x, y, z), ("air", {}))
    def take(x, z, v=2):
        if t.ok(x, z): t.TAKEN[t.ij(x, z)] = max(int(t.TAKEN[t.ij(x, z)]), v)

    # the basin, dredged to BED, water to the surface (before the moles, which overwrite its edges)
    for x, z in cells(BASIN):
        if not t.ok(x, z): continue
        g0 = int(t.at(t.G0, x, z))
        W[(x, BED, z)] = ("gravel", {})
        for y in range(BED + 1, max(g0, SEA) + 1): W[(x, y, z)] = ("water", {}) if y <= SEA else ("air", {})
        take(x, z)
    # breakwaters: solid stone from the bed, a parapet on the sea side, bollards and lamps on the basin side
    mole = set()
    for box in NORTH + SOUTH: mole |= set(cells(box))
    for cx, cz, r in ((LIGHT[0], LIGHT[1], 5.5), (SOUTH_HEAD[0], SOUTH_HEAD[1], 3.5)):
        for x in range(int(cx - r), int(cx + r) + 1):
            for z in range(int(cz - r), int(cz + r) + 1):
                if math.hypot(x - cx, z - cz) <= r: mole.add((x, z))
    for x, z in mole: col(x, z); take(x, z)
    basin = set(cells(BASIN)) - mole
    for x, z in mole:
        nb = [(x + 1, z), (x - 1, z), (x, z + 1), (x, z - 1)]
        if any(n not in mole and n not in basin for n in nb) and math.hypot(x - LIGHT[0], z - LIGHT[1]) > 5.5:
            W[(x, TOP + 1, z)] = ("stone_brick_wall", {})                         # parapet, sea side
            if (x + z) % 8 == 0: W[(x, TOP + 2, z)] = ("lantern", {})
        elif any(n in basin for n in nb) and (x + 2 * z) % 6 == 0:
            W[(x, TOP + 1, z)] = ("polished_blackstone_wall", {})                # bollard
    # the quay wall along the shore and the promenade behind it, level at TOP
    prom = []
    for z in range(QUAY_Z[0] - 5, QUAY_Z[1] + 6):
        for x in range(QUAY_X, QUAY_X + 4):
            if (x, z) in mole: continue
            col(x, z); take(x, z, 1)
        prom.append((QUAY_X + 2, z))
    for z in range(QUAY_Z[0], QUAY_Z[1] + 1):
        if z % 4 == 1: W[(QUAY_X, TOP + 1, z)] = ("polished_blackstone_wall", {})       # bollards on the edge
        if z % 8 == 3: W[(QUAY_X + 1, TOP + 1, z)] = ("stone_brick_wall", {}); W[(QUAY_X + 1, TOP + 2, z)] = ("lantern", {})
    for z in range(QUAY_Z[0], QUAY_Z[1] + 1, 6):                                   # harbour steps down to the water
        if JETTY[0][1] - 1 <= z <= JETTY[1][1] + 1: continue
        W[(QUAY_X - 1, SEA + 1, z)] = ("stone_brick_slab", {"half": "bottom"})
    # the jetty: oak deck on stripped oak piles, rails on the ends, a lamp at the head
    (jx0, jz0), (jx1, jz1) = JETTY
    for x in range(jx0, jx1 + 1):
        for z in range(jz0, jz1 + 1):
            W[(x, TOP, z)] = ("oak_planks" if (x + z) % 5 else "spruce_planks", {})
            for y in range(TOP + 1, TOP + 3): W.setdefault((x, y, z), ("air", {}))
            if z in (jz0, jz1) and (x - jx0) % 3 == 0:
                for y in range(BED, TOP): W[(x, y, z)] = ("stripped_oak_log", {})
            take(x, z)
        W[(x, TOP - 1, jz0 - 1)] = ("oak_stairs", {"facing": "s", "half": "top"})       # a beam along each side
        W[(x, TOP - 1, jz1 + 1)] = ("oak_stairs", {"facing": "n", "half": "top"})
    for z in range(jz0, jz1 + 1): W[(jx0, TOP + 1, z)] = ("oak_fence", {})
    W[(jx0, TOP + 2, jz0)] = ("lantern", {}); W[(jx0, TOP + 2, jz1)] = ("lantern", {})
    # the cargo crane: an oak post, a jib out over the water, a chain and a barrel on the hook
    cx, cz = CRANE
    for y in range(TOP + 1, TOP + 8): W[(cx, y, cz)] = ("stripped_oak_log", {})
    for x in range(cx - 4, cx + 2): W[(x, TOP + 7, cz)] = ("stripped_oak_log", {"axis": "x"})
    W[(cx - 1, TOP + 6, cz)] = ("oak_stairs", {"facing": "e", "half": "top"})
    for y in range(TOP + 3, TOP + 7): W[(cx - 4, y, cz)] = ("iron_chain", {})
    W[(cx - 4, TOP + 2, cz)] = ("barrel", {"facing": "up"})
    for dx, dz in ((1, 1), (1, 2), (2, 1), (1, -1)): W[(cx + dx, TOP + 1, cz + dz)] = ("barrel", {"facing": "up"})
    W[(cx + 2, TOP + 2, cz + 1)] = ("barrel", {"facing": "up"})

    # buildings on the skill
    lb = skill_build("lighthouse", (0, 5))
    t.stamp(lb, LIGHT[0], LIGHT[1], TOP, 180, "civic"); t.plan[-1].update(name="lighthouse", door=[LIGHT[0], LIGHT[1] - 5])
    hb = skill_build("harbourmaster", (0, 5))
    x, z, deg = HUT; t.stamp(hb, x, z, TOP, deg, "civic"); t.plan[-1].update(name="harbourmaster", door=[x - 5, z])
    for dx in range(-4, 5):
        for dz in range(-3, 4): col(x + dx, z + dz, TOP - 1); take(x + dx, z + dz)
    bb = skill_build("boathouse", (0, 7))
    x, z, deg = BOATHOUSE; t.stamp(bb, x, z, TOP, deg, "civic"); t.plan[-1].update(name="boathouse", door=[x + 7, z])
    # boathouse ground: stone under the land half, piers under the water half, the slip open to the sea
    for lx in range(-4, 5):
        for lz in range(-10, 7):
            wx, wz = x + lz, z - lx                                     # rotation 270: (x, z) -> (z, -x)
            if not t.ok(wx, wz): continue
            wet = bool(t.at(t.WET, wx, wz)); take(wx, wz)
            slip = -2 <= lx <= 2 and -10 <= lz <= -1
            if slip:
                g0 = int(t.at(t.G0, wx, wz)); W[(wx, BED, wz)] = ("gravel", {})
                for y in range(BED + 1, SEA + 1): W[(wx, y, wz)] = ("water", {})
                for y in range(SEA + 1, TOP): W[(wx, y, wz)] = ("air", {})
            elif not wet or abs(lx) == 4 and lz % 4 == 2 or lz == -10 and abs(lx) >= 3:
                for y in range(min(int(t.at(t.G0, wx, wz)), BED), TOP): W[(wx, y, wz)] = (stone(wx, y, wz), {})
    for z in range(BOATHOUSE[1] - 2, BOATHOUSE[1] + 3):                 # the slip runs out to open water
        for x in range(BOATHOUSE[0] - 14, BOATHOUSE[0] - 10):
            if t.ok(x, z) and int(t.at(t.G0, x, z)) > BED:
                W[(x, BED, z)] = ("gravel", {})
                for y in range(BED + 1, SEA + 1): W[(x, y, z)] = ("water", {})
    return prom
