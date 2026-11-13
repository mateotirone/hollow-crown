"""The Everwake air boat: a blimp with a gondola, moored at the air boat station in Aldmere and at Everwake's
sky dock (Mateo OK'd the look 2026-11-13, thread "Design the Cloud City air boat"). In lore you ride it to
the city; in game the station's Gate teleports you.

    python3 airboat.py OUT_SPEC.json          # the boat on its own
    from airboat import cells, MOORING        # cells(ring_at, heading) for a mooring

Local frame: x along the boat (tail x 0, nose x 60), y up, z south (starboard); gondola keel y 0, deck y 4.
Envelope 61 x 19 (skill part "envelope", fitted ring by ring), four cross fins with copper rudders, two copper
engines and a pusher propeller at the stern, a 7 x 15 gondola cabin with an interior, chains, a nose ring.
"""
import json, math, os, sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", ".claude", "skills", "minecraft-builder", "scripts"))
from parts import envelope_cells, turn_cell  # noqa: E402

FLOOR = 4                   # gondola deck block
A = 24                      # envelope axis: the centre of block row A (axis at y A + 0.5)
L = 60                      # nose x (envelope is x 0..60, 61 long)
PROFILE = [(0, 0.8), (3, 2.4), (8, 4.7), (14, 6.8), (20, 8.3), (26, 9.2), (32, 9.5), (42, 9.5),
           (48, 9.1), (53, 8.0), (56.5, 6.4), (58.5, 4.6), (59.6, 2.8), (60.2, 1.2)]

def r(x):
    if x <= PROFILE[0][0]: return PROFILE[0][1]
    for (x0, r0), (x1, r1) in zip(PROFILE, PROFILE[1:]):
        if x0 <= x <= x1: return r0 + (r1 - r0) * (x - x0) / (x1 - x0)
    return 0.0

C = {}                      # (x, y, z) -> [block, {states}]
def put(x, y, z, b, **s): C[(x, y, z)] = [b, s]


# ---------- envelope: fitted ring by ring (skill part "envelope") ----------
for u, y, w, blk, *st in envelope_cells(PROFILE, rib="waxed_weathered_cut_copper", cap="waxed_cut_copper", cap_len=(2, 4)):
    put(u, A + y, w, blk, **(st[0] if st else {}))
ENV = set(C)
def under(x, z):
    """y of the first free cell under the envelope at column (x, z)."""
    return min(y for (xx, y, zz) in ENV if xx == x and zz == z) - 1
def env_edge(x, y):
    """outermost w of the envelope in row y at slice x."""
    return max(zz for (xx, yy, zz) in ENV if xx == x and yy == y)

# ---------- tail fins: four in a cross, canvas with birch spars, copper rudder / elevators ----------
FIN_X0, FIN_X1, FIN_H = 1, 17, 12      # trailing edge, root leading edge, tip distance from the axis
def fin_out(x):
    if x <= 5: return FIN_H
    return FIN_H + (r(FIN_X1) - FIN_H) * (x - 5) / (FIN_X1 - 5)
for dy, dz in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
    for x in range(FIN_X0, FIN_X1 + 1):
        top = math.floor(fin_out(x) + 0.3)
        for d in range(max(1, math.floor(r(x)) - 1), top + 1):
            y, z = A + dy * d, dz * d
            edge = d == top or x == FIN_X1
            if x <= 2:   b = "waxed_weathered_cut_copper"            # the moving rudder / elevator
            elif x == 3: b = "stripped_birch_log"                    # hinge post
            elif edge or x % 4 == 0: b = "birch_planks"              # spars and the edge
            else:        b = "white_wool"
            if b == "stripped_birch_log": put(x, y, z, b, axis="y" if dy else "z")
            else: put(x, y, z, b)
        if dy and x > 5:                                             # top/bottom fins: stair on each leading-edge step
            nxt = math.floor(fin_out(x + 1) + 0.3) if x < FIN_X1 else 0
            if nxt < top:
                put(x, A + dy * top, 0, "birch_stairs", facing="w", half="bottom" if dy > 0 else "top")

# ---------- tail pusher propeller (X blades, so they clear the cross of fins) ----------
put(-1, A, 0, "waxed_copper"); put(-2, A, 0, "waxed_cut_copper")
PX = -3
put(PX, A, 0, "waxed_copper")
for sy, sz in [(1, 1), (1, -1), (-1, 1), (-1, -1)]:
    for k in range(1, 4):
        put(PX, A + sy * k, sz * k, "spruce_trapdoor", facing="w", open=True)

# ---------- stern engines: two copper nacelles on struts, propellers behind ----------
NX0, NX1, NY = 9, 17, A - 4
for side in (1, -1):
    zc = side * 12
    for sx in (11, 15):                                              # struts out from the envelope
        z0 = env_edge(sx, NY) + 1
        for z in range(z0, 11): put(sx, NY, side * z, "stripped_dark_oak_log", axis="z")
    for x in range(NX0, NX1 + 1):                                    # 3x3 body with rounded ends and a cowl
        band = x in (NX0 + 2, NX1 - 2)
        for dy in (-1, 0, 1):
            for dz in (-1, 0, 1):
                corner = dy and dz
                if x in (NX0, NX1) and corner: continue
                put(x, NY + dy, zc + dz, "waxed_cut_copper" if band else "waxed_copper")
        if NX0 < x < NX1:
            put(x, NY + 2, zc, "waxed_cut_copper_slab")
            put(x, NY - 2, zc, "waxed_cut_copper_slab", half="top")
    put(NX1 + 1, NY, zc, "waxed_cut_copper")
    put(NX1 - 3, NY + 2, zc, "polished_blackstone_wall"); put(NX1 - 3, NY + 3, zc, "polished_blackstone_wall")   # exhaust
    put(NX0 - 1, NY, zc, "waxed_cut_copper"); PXn = NX0 - 2
    put(PXn, NY, zc, "waxed_copper")
    for dy, dz in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
        for k in range(1, 4):
            put(PXn, NY + dy * k, zc + dz * k, "spruce_trapdoor", facing="w", open=True)

# ---------- keel spine under the envelope ----------
for x in range(14, 49):
    put(x, under(x, 0), 0, "stripped_dark_oak_log", axis="x")

# ---------- gondola ----------
GX0, GX1 = 24, 42          # hull, 19 long
CX0, CX1 = 26, 40          # cabin, 15 long
GZ = 3                     # half width: 7 wide
ROOF = 10
DX = (CX0 + CX1) // 2
def hull_half(x, y):
    end = min(x - GX0, GX1 - x)                     # 0 at the tips
    base = {4: 3, 3: 3, 2: 2, 1: 1}[y]
    return base - max(0, 2 - end) if base > 1 else (1 if end >= 2 else 0)
for x in range(GX0, GX1 + 1):
    for y in (1, 2, 3, 4):
        n = hull_half(x, y)
        below = hull_half(x, y - 1) if y > 1 else -1
        for z in range(-n, n + 1):
            if y == FLOOR: b = "spruce_planks" if abs(z) < n else "dark_oak_planks"
            elif y == 1: put(x, y, z, "stripped_dark_oak_log", axis="x"); continue
            else: b = "dark_oak_planks"
            if y < FLOOR and abs(z) == n and n > below:                # the hull curves in under this row
                put(x, y, z, "dark_oak_stairs", facing="n" if z > 0 else "s", half="top")
            else: put(x, y, z, b)
# cabin walls
for x in range(CX0, CX1 + 1):
    for z in range(-GZ, GZ + 1):
        if not (abs(z) == GZ or x in (CX0, CX1)): continue
        for y in range(FLOOR + 1, ROOF):
            post = (abs(z) == GZ and (x - CX0) % 4 == 0) or (x in (CX0, CX1) and abs(z) == GZ)
            if post: put(x, y, z, "stripped_birch_log", axis="y")
            elif y == FLOOR + 1: put(x, y, z, "dark_oak_planks")
            elif y in (FLOOR + 2, FLOOR + 3): put(x, y, z, "light_blue_stained_glass_pane")
            else: put(x, y, z, "birch_planks")
# roof: copper, with a sloped eave one block out all round
for x in range(CX0 - 1, CX1 + 2):
    for z in range(-GZ - 1, GZ + 2):
        ex, ez = x in (CX0 - 1, CX1 + 1), abs(z) == GZ + 1
        if ex and ez:
            put(x, ROOF - 1, z, "waxed_weathered_cut_copper_stairs", facing="n" if z > 0 else "s", half="top", corner="outer_left")
        elif ez: put(x, ROOF - 1, z, "waxed_weathered_cut_copper_stairs", facing="n" if z > 0 else "s", half="top")
        elif ex: put(x, ROOF - 1, z, "waxed_weathered_cut_copper_stairs", facing="e" if x < CX0 else "w", half="top")
        else: put(x, ROOF, z, "waxed_weathered_cut_copper_slab" if abs(z) == GZ or x in (CX0, CX1) else "waxed_weathered_cut_copper")
# doors: bow end (gangway at the station) and the south side (pier at the sky dock)
put(CX1, FLOOR + 1, 0, "birch_door", facing="e"); put(CX1, FLOOR + 2, 0, "birch_door", facing="e", upper=True)
put(CX1, FLOOR + 3, 0, "birch_planks")
put(DX, FLOOR + 1, GZ, "birch_door", facing="s"); put(DX, FLOOR + 2, GZ, "birch_door", facing="s", upper=True)
put(DX, FLOOR + 3, GZ, "birch_planks")
for x in (DX - 1, DX + 1):
    for y in range(FLOOR + 1, ROOF): put(x, y, GZ, "stripped_birch_log", axis="y")
# rails round the open bow and stern decks; a gap at the bow tip for the gangway
for x in list(range(GX0, CX0)) + list(range(CX1 + 1, GX1 + 1)):
    n = hull_half(x, FLOOR)
    for z in range(-n, n + 1):
        edge = abs(z) == n or x in (GX0, GX1) or hull_half(x + (1 if x > DX else -1), FLOOR) < abs(z)
        if not edge: continue
        if x == GX1 and abs(z) <= 1: continue
        put(x, FLOOR + 1, z, "birch_fence")
put(GX1, FLOOR + 1, -1, "birch_fence") if False else None
for x, z in ((GX0, -1), (GX0, 1), (GX1, -2), (GX1, 2)):
    if (x, FLOOR + 1, z) in C: put(x, FLOOR + 2, z, "lantern")
# ---------- rigging: chains from the envelope down to the gondola eaves and bow/stern ----------
for x in (CX0 - 1, DX - 4, DX + 4, CX1 + 1):
    for z in (-GZ - 1, GZ + 1):
        for yy in range(ROOF, under(x, z) + 1): put(x, yy, z, "iron_chain", axis="y")
for x in (CX0 + 3, DX, CX1 - 3):
    for yy in range(ROOF + 1, under(x, 0) + 0): put(x, yy, 0, "iron_chain", axis="y")
for x in (GX0, GX1):
    for yy in range(FLOOR + 2, under(x, 0) + 0): put(x, yy, 0, "iron_chain", axis="y")
# ---------- mooring: a copper ring on the nose and two lines let down from the gondola ----------
put(L + 1, A, 0, "waxed_copper"); put(L + 2, A, 0, "iron_chain", axis="x")
for yy in range(A - 6, A + 1): put(L + 3, yy, 0, "iron_chain", axis="y")
for x in (GX0 + 1, GX1 - 2):
    for yy in range(-6, 1):
        put(x, yy, -GZ + 1 if x < DX else GZ - 1, "iron_chain", axis="y") if yy < 1 else None
# ---------- interior: benches, chart table, a bell, lanterns ----------
for x in range(CX0 + 2, CX1 - 1, 2):
    if abs(x - DX) <= 1: continue
    put(x, FLOOR + 1, -GZ + 1, "birch_stairs", facing="n")
    if abs(x - DX) > 1: put(x, FLOOR + 1, GZ - 1, "birch_stairs", facing="s")
put(CX1 - 1, FLOOR + 1, -2, "lectern", facing="w")                # pilot's chart table by the bow window
put(CX1 - 1, FLOOR + 1, 2, "barrel")
put(CX0 + 1, FLOOR + 1, -2, "barrel"); put(CX0 + 1, FLOOR + 2, -2, "barrel"); put(CX0 + 1, FLOOR + 1, 2, "chest", facing="e")
put(DX, ROOF - 1, 0, "bell", facing="s")
for x in (CX0 + 3, CX1 - 3): put(x, ROOF - 1, 0, "lantern", hanging=True)

RING = (L + 1, A, 0)        # the copper mooring ring on the nose: the anchor every mooring ties to
MOORING = {                 # where things are, counted from the ring, for a boat whose nose points east
    "ring": (0, 0, 0),
    "deck_y": FLOOR - A,                                # gondola deck block, 20 under the ring
    "bow_gate": (GX1 - RING[0], FLOOR + 1 - A, 0),      # the gap in the bow rail (gangway at the station), 3 wide
    "side_door": (DX - RING[0], FLOOR + 1 - A, GZ),     # the starboard door (pier at the sky dock)
    "size": (L + 7, None, 31),
}


def cells(ring_at=(0, 0, 0), heading="e"):
    """Every block of the boat as place cells, the nose ring at ring_at, the nose pointing `heading` (e/w/n/s)."""
    out = []
    for (x, y, z), (b, st) in sorted(C.items()):
        out.append(turn_cell([x - RING[0], y - RING[1], z - RING[2], b] + ([st] if st else []), ring_at, heading))
    return out


def specs():
    """The boat on its own, the deck at y 4 as in the viewer (asset viewer section Everwake)."""
    return {"everwake_airboat": {"name": "everwake_airboat", "edition": "bedrock", "place": cells((RING[0], RING[1], 0), "e")}}


if __name__ == "__main__":
    json.dump(specs()["everwake_airboat"], open(sys.argv[1], "w"))
    print("cells", len(C))
