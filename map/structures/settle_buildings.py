"""The nine plot buildings (cottage, well, library, market stall, kitchen garden, smithy, stable,
storehouse, watchtower) rebuilt in the map kit's style for each region (Mateo 2026-11-11: every
building in its own region's style, "it has to be perfect").

Same frame as settle_halls.py: front faces south (+z), the door's outside face on z = 0 at x = 0
(bp.markers["door"]); ground floor at y = 1; every size odd. Stone is the region's Castle Stone
family. Only the working pieces each building is for go inside (forge, stalls, shelves...).
"""
from bp import Blueprint, DIRS, OPP, RIGHT
from kit import Building, mix, grow, h3
import settle_halls as SH
from settle_halls import castle, pyramid, flat_roof, hang, tower, skirt, thatch, dragon_heads

REGIONS = ("vale", "frostmarch", "saltreach", "emberwaste", "blackfen")
LOOK = {   # how each region builds: wall kind, roof kind
    "vale": dict(wall="timber", roof="gable", awning=("red_wool", "white_wool")),
    "frostmarch": dict(wall="timber", roof="gable", awning=("blue_wool", "white_wool")),
    "saltreach": dict(wall="stone", roof="hip", awning=("cyan_wool", "white_wool")),
    "emberwaste": dict(wall="stone", roof="flat", awning=("orange_wool", "white_wool")),
    "blackfen": dict(wall="timber", roof="gable", awning=("brown_wool", "white_wool")),
}

def palette(region):
    if region == "vale":
        P = SH.timber_palette(0); P.setdefault("roof_flat", castle("vale")("tiles")); return P
    return {"frostmarch": SH.frost_palette, "saltreach": SH.salt_palette, "emberwaste": SH.ember_palette, "blackfen": SH.fen_palette}[region](0)

def new(name, region):
    P = palette(region); bp = Blueprint(f"{name}_{region}"); bp.marks = {}
    return bp, Building(bp, P, hash(name) % 97), P, castle(region), LOOK[region]

def body(B, P, L, rect, h, y0=1, plinth=True):
    """Walls in the region's way: timber frame on a stone footing, or plain ashlar."""
    if L["wall"] == "timber":
        if plinth: B.stone_storey(rect, y0, 1, quoins=False); B.timber_storey(rect, y0 + 1, h - 1, bay=4)
        else: B.timber_storey(rect, y0, h, bay=4)
    else:
        B.stone_storey(rect, y0, h, quoins=(L["roof"] != "flat"))
    return y0 + h

def roof(bp, B, P, L, rect, base, ridge="z", region="vale"):
    """The region's roof over a rect: gable (timber regions), hipped tiles (Saltreach) or a flat parapet roof (Emberwaste)."""
    x0, z0, x1, z1 = rect
    if L["roof"] == "gable":
        B.roof(rect, ridge, base, overhang=1, verge=1)
        B.build_roofs(); B.gable_walls(rect, ridge, base, style="timber" if L["wall"] == "timber" else "stone")
        if region == "blackfen": thatch(bp, P, B, rect)
        if region == "frostmarch":
            if ridge == "z":
                for z in (z0 - 1, z1 + 1): dragon_heads(bp, (x0 + x1) // 2, B.H[((x0 + x1) // 2, z)][0] + 1, z)
            else:
                for x in (x0 - 1, x1 + 1): dragon_heads(bp, x, B.H[(x, (z0 + z1) // 2)][0] + 1, (z0 + z1) // 2, along="x")
        return max(h for h, _ in B.H.values())
    if L["roof"] == "hip":
        return pyramid(bp, P, x0 - 1, z0 - 1, x1 + 1, z1 + 1, base, pitch=1, finial=None)
    flat_roof(bp, P, rect, base, parapet=True, merlons=True)
    return base + 1

def front_door(B, P, k, L, x=0, z=0, y=1):
    frame = P["frame"] if L["wall"] == "timber" else k("stone")
    B.door(x, y, z, "s", canopy=(L["wall"] == "timber"), lanterns=True, frame=frame)

def side_windows(B, L, rect, y0, sides="ew", h=2):
    if L["wall"] == "timber" and (rect, y0 + 1, sides[0]) in getattr(B, "bays", {}):
        B.bay_windows(rect, y0 + 1, sides); return
    x0, z0, x1, z1 = rect
    for side in sides:
        if side in "ew":
            x = x1 if side == "e" else x0
            for z in range(z1 - 2, z0 + 1, -4): B.window(x, y0 + 1, z, side, 1, h, kind="stone")
        else:
            z = z1 if side == "s" else z0
            for x in range(x0 + 2, x1 - 1, 4): B.window(x, y0 + 1, z, side, 1, h, kind="stone")

def dress(bp, k, L, rect, y0, top, region):
    """Break up tall plain ashlar: a brick band at the upper floor line and, in Emberwaste, beam ends (vigas)
    under the parapet. Only plain wall blocks change, never windows or doors."""
    if L["wall"] != "stone": return
    x0, z0, x1, z1 = rect
    ring = [(x, z) for x in range(x0, x1 + 1) for z in (z0, z1)] + [(x, z) for z in range(z0 + 1, z1) for x in (x0, x1)]
    plain = lambda n: n not in ("air", "keep") and not any(w in n for w in ("glass", "pane", "door", "lantern", "stairs", "slab"))
    if top - y0 >= 7:
        for (x, z) in ring:
            if plain(bp.get(x, y0 + 4, z)[0]): bp.set(x, y0 + 4, z, k("bricks"))
    if region == "emberwaste":
        for x in range(x0 + 1, x1, 2):
            for z, s in ((z1 + 1, 1), (z0 - 1, -1)): bp.set(x, top - 1, z, "stripped_spruce_log", axis="z")
        for z in range(z0 + 1, z1, 2):
            for x in (x0 - 1, x1 + 1): bp.set(x, top - 1, z, "stripped_spruce_log", axis="x")

def step_up(bp, lift):
    """A step up to a door on piles; the Foundation Stone then sits one block further out."""
    if not lift: return (0, 1, 0)
    bp.set(0, 1, 1, "dark_oak_stairs", facing="n")
    return (0, 1, 1)

def finish(bp, door=(0, 1, 0)):
    bp.markers["door"] = door
    return bp.finish()

def stilts(bp, P, rect, lift, region):
    """Blackfen buildings stand a little up on mangrove piles with a step up to the door."""
    if region != "blackfen": return 0
    x0, z0, x1, z1 = rect
    for x in range(x0, x1 + 1):
        for z in range(z0, z1 + 1): bp.set(x, lift, z, P["floor"])
        for z in (z0, z1):
            if (x - x0) % 4 == 0 or x == x1:
                for y in range(-2, lift): bp.set(x, y, z, "mangrove_log", axis="y")
    for z in range(z0, z1 + 1):
        for x in (x0, x1):
            if (z - z0) % 4 == 0:
                for y in range(-2, lift): bp.set(x, y, z, "mangrove_log", axis="y")
    return lift

# ---------------------------------------------------------------- the nine
def cottage(region):
    """A one-storey cottage gable-end on to the path, with an attic, a chimney, hearth corner, chest and workbench. 7 x 9."""
    bp, B, P, k, L = new("cottage", region)
    rect = (-3, -8, 3, 0); lift = stilts(bp, P, grow(rect, "ew"), 1, region)
    B.foundation(rect, lift); B.floor(rect, lift)
    top = body(B, P, L, rect, 4, y0=lift + 1)
    side_windows(B, L, rect, lift + 1)
    for x in (-2, 2): B.window(x, lift + 2, 0, "s", 1, 2, kind="timber" if L["wall"] == "timber" else "stone")
    front_door(B, P, k, L, y=lift + 1)
    roof(bp, B, P, L, rect, top + (0 if L["roof"] == "flat" else 1), ridge="z", region=region)
    dress(bp, k, L, rect, lift + 1, top, region)
    if L["roof"] == "gable": B.chimney(-4, -5, 1)
    bp.set(2, lift + 1, -7, "chest", facing="s"); bp.set(1, lift + 1, -7, "crafting_table")
    bp.set(-2, lift + 1, -7, "furnace", facing="s")
    return finish(bp, step_up(bp, lift))

def well(region):
    """A roofed well: a stone ring with water, four posts and a little roof, a bucket on a chain. 5 x 5."""
    bp, B, P, k, L = new("well", region)
    for x in range(-2, 3):
        for z in range(-4, 1):
            edge = abs(x) == 2 or z in (-4, 0)
            for y in range(-3, 1): bp.set(x, y, z, k("cobbled") if edge or y < -2 else "water")
            if edge: bp.set(x, 1, z, k("bricks"))
    for x in range(-1, 2):
        for z in range(-3, 0): bp.set(x, 1, z, "air"); bp.set(x, 0, z, "water")
    for (x, z) in ((-2, 0), (2, 0), (-2, -4), (2, -4)):
        for y in (2, 3): bp.set(x, y, z, P["fence"])
    # two posts on the middle line carry a crossbeam and a light roof of stairs either side of a slab ridge
    for x in (-2, 2): bp.set(x, 1, -2, P["frame"] if L["wall"] == "timber" else k("stone"), axis="y"); bp.set(x, 4, -2, P["frame"] if L["wall"] == "timber" else k("stone"), axis="y")
    for x in (-2, 2):
        for y in (2, 3): bp.set(x, y, -2, P["fence"] if L["wall"] == "timber" else k("stone"))
    for x in range(-1, 2): bp.set(x, 4, -2, P["frame"] if L["wall"] == "timber" else k("stone"), axis="x")
    if L["roof"] == "flat":
        a, b = L["awning"]
        for x in range(-3, 4):
            for z in (-3, -2, -1): bp.set(x, 5, z, a if (x + 3) % 2 == 0 else b)
    else:
        for x in range(-3, 4):
            bp.set(x, 4, -3, P["roof"], facing="s"); bp.set(x, 4, -1, P["roof"], facing="n")
            bp.set(x, 5, -2, P["roof_slab"], half="bottom")
        for x in (-2, 2): bp.set(x, 4, -2, P["frame"] if L["wall"] == "timber" else k("stone"), axis="y")
    bp.set(0, 3, -2, "iron_chain"); bp.set(0, 2, -2, "iron_chain")
    return finish(bp, (0, 1, 0))

def library(region):
    """Two storeys of books: eight Archive Shelves for the town's own lore, a lectern, portraits. 11 x 11."""
    bp, B, P, k, L = new("library", region)
    rect = (-5, -10, 5, 0); lift = stilts(bp, P, grow(rect, "ew"), 1, region)
    B.foundation(rect, lift); B.floor(rect, lift)
    top = body(B, P, L, rect, 8, y0=lift + 1) if L["wall"] != "timber" else None
    if L["wall"] == "timber":
        B.stone_storey(rect, lift + 1, 5, quoins=True)       # stone below for the books' sake, timber above
        B.floor(rect, lift + 5); B.timber_storey(rect, lift + 6, 4, bay=5); top = lift + 10
    for z in (-3, -7):
        for x, s in ((5, "e"), (-5, "w")): B.window(x, lift + 2, z, s, 1, 2, kind="stone")
    for x in (-3, 3): B.window(x, lift + 2, 0, "s", 1, 2, kind="stone")
    if L["wall"] != "timber":
        for z in (-3, -7):
            for x, sd in ((5, "e"), (-5, "w")): B.window(x, lift + 6, z, sd, 1, 2, kind="stone")
    B.window(-1, lift + 7, 0, "s", 3, 2, kind="stone" if L["wall"] != "timber" else "timber")
    front_door(B, P, k, L, y=lift + 1)
    roof(bp, B, P, L, rect, top + (0 if L["roof"] == "flat" else 1), ridge="z", region=region)
    dress(bp, k, L, rect, lift + 1, top, region)
    # the shelves: back wall, two rows of four; lectern in front of them; portraits above
    zb = -9; n = 0
    for y in (lift + 1, lift + 2):
        for x in (-2, -1, 1, 2): bp.set(x, y, zb, "siege:archive_shelf"); bp.marks[f"shelf{n}"] = (x, y, zb); n += 1
    bp.set(0, lift + 1, zb + 2, "lectern", facing="s"); bp.marks["lectern"] = (0, lift + 1, zb + 2)
    for i, x in enumerate((-2, 0, 2)): bp.marks[f"portrait{i}"] = (x, lift + 4, zb)
    bp.marks["painting0"] = (0, lift + 3, -1)
    for z in range(-8, -1): bp.set(-4, lift + 1, z, "bookshelf"); bp.set(4, lift + 1, z, "bookshelf")
    return finish(bp, step_up(bp, lift))

def market(region):
    """A market stall: a counter under a striped awning on posts. 5 x 3."""
    bp, B, P, k, L = new("market", region)
    a, b = L["awning"]
    for x in range(-2, 3):
        for z in range(-2, 1): bp.set(x, 0, z, k("cobbled") if region != "blackfen" else P["floor"])
    for (x, z) in ((-2, 0), (2, 0), (-2, -2), (2, -2)):
        for y in (1, 2, 3): bp.set(x, y, z, P["fence"])
    for x in range(-3, 4):
        for z in range(-3, 2):
            bp.set(x, 4, z, a if (x + 3) % 2 == 0 else b)
    for x in range(-1, 2): bp.set(x, 1, 0, P["trim"], facing="s", half="top")
    bp.set(-1, 1, -2, "barrel", facing="u"); bp.set(1, 1, -2, "barrel"); bp.set(0, 1, -2, "chest", facing="s")
    hang(bp, [(0, 3, -1)])
    return finish(bp, (0, 1, 1))

def garden(region):
    """A kitchen garden: fenced beds either side of a water channel, a gate, a composter. 9 x 9."""
    bp, B, P, k, L = new("garden", region)
    for x in range(-4, 5):
        for z in range(-8, 1):
            edge = abs(x) == 4 or z in (-8, 0)
            bp.set(x, 0, z, "grass_block")
            if edge: bp.set(x, 1, z, P["fence"])
            elif x == 0: bp.set(x, 0, z, "water")
            elif abs(x) == 1: bp.set(x, 0, z, "grass_path")
            else: bp.set(x, 0, z, "farmland"); bp.set(x, 1, z, ("wheat", "carrots", "potatoes")[(abs(x) + z) % 3], raw={"growth": 7})
    bp.set(0, 1, 0, P["fence"].replace("_fence", "_fence_gate"), facing="s"); bp.set(0, 0, 0, "grass_path")
    for z in (-1, -7): bp.set(0, 0, z, k("bricks"))
    bp.set(-3, 1, -1, "composter"); bp.set(3, 1, -1, "barrel")
    return finish(bp, (0, 1, 0))

def smithy(region):
    """Stone workshop with an open forge porch out front: anvil, grindstone, furnaces, a big chimney. 9 x 11."""
    bp, B, P, k, L = new("smithy", region)
    rect = (-4, -10, 4, -4)
    B.foundation(grow(rect, "ew"), 0); B.floor(rect, 0)
    B.stone_storey(rect, 1, 4)
    side_windows(B, dict(L, wall="stone"), rect, 1)
    B.door(0, 1, -4, "s", canopy=False, lanterns=False, frame=k("stone"))
    # the porch: posts and a lean-to roof
    for x in range(-4, 5):
        for z in range(-3, 1): bp.set(x, 0, z, k("cobbled"))
    for x in (-4, 4):
        for z in (0, -2):
            for y in (1, 2, 3): bp.set(x, y, z, P["frame"] if L["wall"] == "timber" else k("stone"), axis="y")
    if L["roof"] == "flat":     # flat-roof country shades the forge with a striped awning on beams
        a, b = L["awning"]
        for x in range(-4, 5):
            for z in range(-3, 1): bp.set(x, 4, z, a if (x + 4) % 2 == 0 else b)
    else:
        for x in range(-5, 6):
            for z, y in ((1, 4), (0, 4), (-1, 5), (-2, 5), (-3, 6)):
                bp.set(x, y, z, P["roof"], facing="n", half="bottom")
    rt = roof(bp, B, P, L, rect, 5, ridge="x", region=region)
    for y in range(1, 4):
        for x in (2, 3): bp.set(x, y, -3, k("bricks"))
    bp.set(2, 1, -3, "blast_furnace", facing="s"); bp.set(3, 1, -3, "furnace", facing="s")
    B.chimney(2, -3, 4, top=None if L["roof"] == "gable" else rt + 1, w=2, d=1)
    bp.set(-1, 1, -1, "anvil"); bp.set(-3, 1, -1, "grindstone"); bp.set(1, 1, -1, "cauldron")
    hang(bp, [(0, 3, -2)])
    return finish(bp, (0, 1, 1))

def stable(region):
    """Three open stalls under one roof with hay and a trough. 11 x 7."""
    bp, B, P, k, L = new("stable", region)
    rect = (-5, -6, 5, 0)
    B.foundation(grow(rect, "ew"), 0)
    for x in range(-4, 5):
        for z in range(-5, 1): bp.set(x, 0, z, "coarse_dirt")
    # back and side walls; open front with posts at the stall dividers
    for y in range(1, 4):
        for x in range(-5, 6): bp.set(x, y, -6, P["infill"] if L["wall"] == "timber" else P["stone"])
        for z in range(-6, 1):
            for x in (-5, 5): bp.set(x, y, z, P["infill"] if L["wall"] == "timber" else P["stone"])
    for x in (-5, -2, 2, 5):
        for y in range(1, 4): bp.set(x, y, 0, P["frame"] if L["wall"] == "timber" else k("stone"), axis="y")
        for z in range(-5, 0):
            if abs(x) == 2: bp.set(x, 1, z, P["fence"])
        for y in range(1, 4): bp.set(x, y, -6, P["frame"] if L["wall"] == "timber" else k("stone"), axis="y")
    for x in range(-5, 6): bp.set(x, 4, 0, P["frame"] if L["wall"] == "timber" else k("stone"), axis="x"); bp.set(x, 4, -6, P["frame"] if L["wall"] == "timber" else k("stone"), axis="x")
    for z in range(-6, 1):
        for x in (-5, 5): bp.set(x, 4, z, P["frame"] if L["wall"] == "timber" else k("stone"), axis="z")
    roof(bp, B, P, L, rect, 5, ridge="x", region=region)
    for x in (-4, -1, 3): bp.set(x, 1, -5, "hay_block", axis="y")
    for x in (-3, 0, 4): bp.set(x, 1, -5, "cauldron")
    hang(bp, [(-3, 3, -1), (0, 3, -1), (3, 3, -1)])
    return finish(bp, (0, 1, 1))

def storehouse(region):
    """A tall barn with a 3-wide cart door, a hay loft door above, barrels and chests. 11 x 11."""
    bp, B, P, k, L = new("storehouse", region)
    rect = (-5, -10, 5, 0)
    B.foundation(grow(rect, "ew"), 0); B.floor(rect, 0)
    top = body(B, P, L, rect, 7)
    side_windows(B, L, rect, 3)
    for x in (-1, 0, 1):
        for y in (1, 2, 3): bp.set(x, y, 0, "air")
    for x in (-2, 2):
        for y in (1, 2, 3, 4): bp.set(x, y, 0, P["frame"] if L["wall"] == "timber" else k("stone"), axis="y")
    for x in (-1, 0, 1): bp.set(x, 4, 0, P["frame"] if L["wall"] == "timber" else k("stone"), axis="x")
    bp.set(0, 6, 0, "air"); bp.set(0, 7, 0, "air"); bp.set(0, 8, 1, P["trim"], facing="s", half="top") if L["roof"] != "flat" else None
    B.floor(rect, 5)
    for x in (-1, 0, 1):
        for z in (-1, -2): bp.set(x, 5, z, "air")
    roof(bp, B, P, L, rect, top + 1 if L["roof"] != "flat" else top, ridge="z", region=region)
    dress(bp, k, L, rect, 1, top, region)
    for x in (-4, -3, 3, 4): bp.set(x, 1, -9, "barrel"); bp.set(x, 2, -9, "barrel") if x in (-4, 4) else None
    for z in (-7, -5): bp.set(-4, 1, z, "chest", facing="e"); bp.set(4, 1, z, "chest", facing="w")
    for x in range(-4, 5): bp.set(x, 6, -9, "hay_block", axis="y")
    for y in range(1, 6): bp.set(4, y, -2, "ladder", facing="w")
    hang(bp, [(0, 4, -5)])
    return finish(bp, (0, 1, 1))

def watchtower(region):
    """A lookout over your land: a stone shaft, a lookout platform with a parapet or rail, a brazier, a roof. 5 x 5."""
    bp, B, P, k, L = new("watchtower", region)
    rect = (-2, -4, 2, 0)
    B.foundation(rect, 0); B.floor(rect, 0)
    B.stone_storey(rect, 1, 8)
    for y in (4, 7):
        for (x, z) in ((2, -2), (-2, -2), (0, -4)): bp.set(x, y, z, P["pane"])
    B.door(0, 1, 0, "s", canopy=False, lanterns=True, frame=k("stone"))
    for y in range(1, 10): bp.set(1, y, -3, "ladder", facing="n")
    # the lookout platform overhangs the shaft by one all round
    for x in range(-3, 4):
        for z in range(-5, 2): bp.set(x, 9, z, P["floor"])
    bp.set(1, 9, -3, "air")
    for x in range(-3, 4):
        for z in range(-5, 2):
            if abs(x) == 3 or z in (-5, 1):
                bp.set(x, 10, z, P["fence"] if L["wall"] == "timber" else P["stone"])
                if L["wall"] != "timber" and (x + z) % 2: bp.set(x, 10, z, "air")
    for x in range(-3, 4):
        for z in (-5, 1): bp.set(x, 8, z, P["sill"], facing="s" if z == 1 else "n", half="top")
    for z in range(-4, 1):
        for x in (-3, 3): bp.set(x, 8, z, P["sill"], facing="e" if x == 3 else "w", half="top")
    bp.set(0, 10, -2, "siege:brazier")
    if L["roof"] != "flat":
        for (x, z) in ((-3, 1), (3, 1), (-3, -5), (3, -5)):
            for y in (10, 11, 12): bp.set(x, y, z, P["fence"] if L["wall"] == "timber" else k("stone"))
        pyramid(bp, P, -4, -6, 4, 2, 13, pitch=1, finial="lantern")
    return finish(bp, (0, 1, 1))

BUILDERS = {"cottage": cottage, "well": well, "library": library, "market": market, "garden": garden,
            "smithy": smithy, "stable": stable, "storehouse": storehouse, "watchtower": watchtower}
