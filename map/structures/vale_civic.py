"""Aldmere Vale civic buildings in Norman stone: guildhall, chapel, station.

Front faces south (+z), ground floor at y = 1, every size odd. These are the "important"
buildings, so they use the stone style (Mateo: stone for important buildings).
"""
from bp import Blueprint, DIRS, OPP, RIGHT
from kit import Building, VALE, mix, grow, h3
import furnish as F
from vale import STYLES

P_STONE = {**VALE, **STYLES["stone"]}
# civic buildings are kept up: cleaner ashlar than the houses' weathered mix
P_STONE["stone"] = mix([("stone_bricks", 82), ("cracked_stone_bricks", 10), ("mossy_stone_bricks", 8)], 77)
P_STONE["infill"] = P_STONE["stone"]

def _belfry(bp, P, x, y, z, w=1):
    """Open bell turret standing on a roof ridge: wall posts at the corners, a bell, a stone cap."""
    for dx in (-1, 1):
        for dz in (-1, 1):
            for h in range(3): bp.set(x + dx, y + h, z + dz, "stone_brick_wall")
    for dx in (-1, 0, 1):
        for dz in (-1, 0, 1):
            bp.set(x + dx, y - 1, z + dz, P["roof_block"])
            bp.set(x + dx, y + 3, z + dz, P["roof"], facing={(-1, 0): "e", (1, 0): "w", (0, -1): "s", (0, 1): "n"}.get((dx, dz), "n"), half="bottom") if (dx == 0) != (dz == 0) else \
                bp.set(x + dx, y + 3, z + dz, P["roof_block"])
    bp.set(x, y + 3, z, P["roof_block"]); bp.set(x, y + 4, z, "stone_brick_wall")
    bp.set(x, y, z, "bell")


def guildhall(seed=3):
    """Market guildhall on the square: an open arcade for the market below, the council hall above,
    a front cross gable and a bell turret on the ridge. 15 x 11."""
    bp = Blueprint("kingsrest_guildhall"); P = dict(P_STONE); B = Building(bp, P, seed)
    rect = (0, 0, 14, 10)
    B.foundation(grow(rect, "nsew"), 0); B.floor(rect, 0)
    B.stone_storey(rect, 1, 5)
    # arcade across the front: piers at x 0, 4, 10, 14 (bays 3, 5, 3), loggia two blocks deep
    for x0, x1 in ((1, 3), (5, 9), (11, 13)):
        for x in range(x0, x1 + 1):
            for y in range(1, 4): bp.set(x, y, 10, "air")
            bp.set(x, 4, 10, P["stone"])
        bp.set(x0, 3, 10, "stone_brick_stairs", facing="w", half="top"); bp.set(x1, 3, 10, "stone_brick_stairs", facing="e", half="top")
    for x in range(1, 14):
        for z in (8, 9, 10): bp.set(x, 0, z, mix([("stone_bricks", 60), ("polished_andesite", 25), ("cracked_stone_bricks", 15)], seed)(x, 0, z)[0])
        for y in range(1, 5): bp.set(x, y, 7, P["stone"])           # inner wall behind the loggia
        for z in (8, 9):
            for y in range(1, 5): bp.set(x, y, z, "air")
    B.door(7, 1, 7, "s", canopy=False, lanterns=False, frame="chiseled_stone_bricks")
    for x in (3, 11): B.window(x, 2, 7, "s", 1, 2, kind="stone")
    for x in (4, 10): bp.set(x, 3, 8, "lantern", hanging=True)
    for z in (3,): B.window(14, 2, z + 1, "e", 1, 2, kind="stone"); B.window(0, 2, z, "w", 1, 2, kind="stone")
    # council hall upstairs
    B.floor(rect, 5)
    for x in range(1, 14): bp.set(x, 5, 9, P["floor"]); bp.set(x, 5, 8, P["floor"])
    B.stone_storey(rect, 6, 5, plinth=False)
    B.window(8, 7, 10, "s", 3, 2, kind="stone"); B.window(2, 7, 10, "s", 1, 2, kind="stone"); B.window(12, 7, 10, "s", 1, 2, kind="stone")
    B.window(2, 7, 0, "n", 1, 2, kind="stone"); B.window(12, 7, 0, "n", 1, 2, kind="stone"); B.window(6, 7, 0, "n", 3, 2, kind="stone")
    B.window(14, 7, 4, "e", 3, 2, kind="stone"); B.window(0, 7, 6, "w", 3, 2, kind="stone")
    # roofs: main ridge along x, cross gable to the square
    B.roof(rect, "x", 11, overhang=1, verge=1)
    B.roof((4, 3, 10, 10), "z", 11, overhang=1, verge=1)
    B.build_roofs()
    B.gable_walls(rect, "x", 11, style="stone"); B.gable_walls((4, 3, 10, 10), "z", 11, style="stone")
    B.window(7, 12, 10, "s", 1, 2, kind="stone")
    top = B.H[(7, 5)][0]
    _belfry(bp, P, 7, top + 1, 5)
    B.chimney(-1, 2, 1)
    # inside: stairs only; rooms are left empty (Mateo, 2026-11-11)
    F.stair_flight(bp, 13, 1, 1, 5, "s")
    bp.markers["door"] = (7, 1, 8); bp.markers["reeve"] = (7, 6, 5)
    return bp.finish()


def chapel(seed=5):
    """Stone chapel: a buttressed nave with lancet windows, a rose window over the door and a
    bellcote on the front gable. 11 x 19 (plus buttresses)."""
    bp = Blueprint("kingsrest_chapel"); P = dict(P_STONE); B = Building(bp, P, seed)
    rect = (0, 0, 10, 18)
    B.foundation(grow(rect, "nsew", 2), 0); B.floor(rect, 0, mat="polished_andesite")
    B.stone_storey(rect, 1, 7)
    for z in (0, 6, 12, 18):                      # buttresses: bays of 5
        for x, f in ((-1, "e"), (11, "w")):
            for y in range(1, 6): bp.set(x, y, z, "stone_bricks")
            bp.set(x, 6, z, "stone_brick_stairs", facing=f, half="bottom")
    for z in (3, 9, 15):                          # lancets, one per bay
        B.window(10, 3, z, "e", 1, 3, kind="stone"); B.window(0, 3, z, "w", 1, 3, kind="stone")
    B.roof(rect, "z", 8, overhang=1, verge=1)
    B.build_roofs()
    B.gable_walls(rect, "z", 8, style="stone")
    B.door(5, 1, 18, "s", canopy=False, lanterns=True, frame="chiseled_stone_bricks")
    bp.set(5, 3, 18, "stone_brick_stairs", facing="s", half="top")
    for dx, dy in ((0, 0), (-1, 1), (0, 1), (1, 1), (0, 2)): bp.set(5 + dx, 9 + dy, 18, P["pane"])   # rose window
    B.window(5, 9, 0, "n", 1, 3, kind="stone")
    apex = B.H[(5, 18)][0]
    for x in (4, 5, 6): bp.set(x, apex, 18, "stone_bricks"); bp.set(x, apex + 1, 18, "stone_bricks") if x != 5 else bp.set(x, apex + 1, 18, "bell")
    for x in (4, 6): bp.set(x, apex + 2, 18, "stone_brick_wall")
    for x in (4, 5, 6): bp.set(x, apex + 3, 18, "stone_bricks")
    bp.set(5, apex + 4, 18, "stone_brick_wall")
    # inside left empty (Mateo, 2026-11-11)
    bp.markers["door"] = (5, 1, 17); bp.markers["priest"] = (5, 1, 3)
    return bp.finish()


def station(seed=9):
    """Railway station: a long stone booking hall with a central gable to the street and a
    timber platform canopy along the back (rail) side. 21 x 11, canopy 3 deep behind."""
    bp = Blueprint("kingsrest_station"); P = dict(P_STONE); B = Building(bp, P, seed)
    rect = (0, 0, 20, 10)
    B.foundation(grow(rect, "nsew"), 0); B.floor(rect, 0)
    B.stone_storey(rect, 1, 5)
    for x in (3, 17): B.window(x, 2, 10, "s", 1, 2, kind="stone")
    B.window(7, 2, 10, "s", 1, 2, kind="stone"); B.window(13, 2, 10, "s", 1, 2, kind="stone")
    B.door(10, 1, 10, "s", canopy=False, lanterns=True, frame="chiseled_stone_bricks")
    B.window(11, 4, 10, "s", 3, 1, kind="stone")
    for x in (3, 17): B.window(x, 2, 0, "n", 1, 2, kind="stone")
    for x in (7, 13): B.door(x, 1, 0, "n", canopy=False, lanterns=False)
    B.window(20, 2, 4, "e", 3, 2, kind="stone"); B.window(0, 2, 6, "w", 3, 2, kind="stone")
    B.roof(rect, "x", 6, overhang=1, verge=1)
    B.roof((7, 4, 13, 10), "z", 6, overhang=1, verge=1)
    B.build_roofs()
    B.gable_walls(rect, "x", 6, style="stone"); B.gable_walls((7, 4, 13, 10), "z", 6, style="stone")
    B.window(10, 8, 10, "s", 1, 2, kind="stone")
    B.chimney(4, 5, 1); B.chimney(16, 5, 1)
    # platform canopy on the rail side: posts at x 0, 4, 10, 16, 20 (bays 3, 5, 5, 3)
    for x in range(-1, 22):
        for z in (-1, -2, -3): bp.set(x, 0, z, mix([("polished_andesite", 70), ("stone_bricks", 30)], seed)(x, 0, z)[0])
        bp.set(x, 0, -4, "stone_brick_slab", half="top")
        bp.set(x, 5, -1, P["trim"], facing="s", half="bottom")
        bp.set(x, 4, -2, P["trim"], facing="s", half="bottom")
        bp.set(x, 4, -3, P["trim_slab"], half="top")
    for x in (0, 4, 10, 16, 20):
        for y in (1, 2, 3): bp.set(x, y, -3, "dark_oak_fence")
        bp.set(x, 3, -2, "lantern", hanging=True) if x in (4, 16) else None
    for x in (2, 3, 18, 19): bp.set(x, 1, -1, "spruce_stairs", facing="s")      # benches against the wall
    # inside left empty (Mateo, 2026-11-11)
    bp.markers["door"] = (10, 1, 9); bp.markers["stationmaster"] = (10, 1, 2)
    bp.rotations = [0, 90, 180, 270]
    return bp.finish()
