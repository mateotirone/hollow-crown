"""Aldmere Vale civic buildings in Norman stone: guildhall, chapel, station.

Front faces south (+z), ground floor at y = 1, every size odd. These are the "important"
buildings, so they use the stone style (Mateo: stone for important buildings).
"""
from bp import Blueprint, DIRS, OPP, RIGHT
from kit import Building, VALE, mix, grow, h3, DOCTRINE, COPPER_MATS, finish_doctrine
import furnish as F
from vale import STYLES

P_STONE = {**VALE, **STYLES["stone"]}
# civic buildings are kept up: cleaner ashlar than the houses' weathered mix
P_STONE["stone"] = mix([("stone_bricks", 82), ("cracked_stone_bricks", 10), ("mossy_stone_bricks", 8)], 77)
P_STONE["infill"] = P_STONE["stone"]
P_STONE.update(DOCTRINE, pane="gray_stained_glass_pane", spikes=3, finial="stone_brick_wall", finial_top="lightning_rod", spike="lightning_rod")      # build-instructions: doctrine texturing, tinted glass
CHAPEL_GLASS = mix([("red_stained_glass_pane", 34), ("blue_stained_glass_pane", 33), ("yellow_stained_glass_pane", 33)], 19)

def _belfry(bp, P, x, y, z, w=1):
    """Open bell turret standing on a roof ridge: wall posts at the corners, a bell, a stone cap."""
    for dx in (-1, 1):
        for dz in (-1, 1):
            for h in range(3): bp.set(x + dx, y + h, z + dz, "stone_brick_wall")
    for dx in (-1, 0, 1):                      # base and cap in trim stone (not roof metal), stepped stair cap
        for dz in (-1, 0, 1):
            bp.set(x + dx, y - 1, z + dz, "polished_andesite")
            bp.set(x + dx, y + 3, z + dz, "stone_brick_stairs", facing={(-1, 0): "e", (1, 0): "w", (0, -1): "s", (0, 1): "n"}.get((dx, dz), "n"), half="bottom") if (dx == 0) != (dz == 0) else \
                bp.set(x + dx, y + 3, z + dz, "stone_brick_slab", half="bottom")
    bp.set(x, y + 3, z, "polished_andesite"); bp.set(x, y + 4, z, "stone_brick_wall"); bp.set(x, y + 5, z, "lightning_rod")
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
    B.roof(rect, "x", 11, overhang=1, verge=1, mats=COPPER_MATS)      # civic accent: copper gradient (palettes/towns.md)
    B.roof((4, 3, 10, 10), "z", 11, overhang=1, verge=1, mats=COPPER_MATS)
    B.build_roofs()
    B.gable_walls(rect, "x", 11, style="stone"); B.gable_walls((4, 3, 10, 10), "z", 11, style="stone")
    B.window(7, 12, 10, "s", 1, 2, kind="stone")
    top = B.H[(7, 5)][0]
    _belfry(bp, P, 7, top + 1, 5)
    B.chimney(-1, 2, 1)
    # inside: stairs only; rooms are left empty (Mateo, 2026-11-11)
    F.stair_flight(bp, 13, 1, 1, 5, "s")
    bp.markers["door"] = (7, 1, 8); bp.markers["reeve"] = (7, 6, 5)
    return finish_doctrine(bp)


def _skill_spec(fname, name, bells=True):
    """Build a review spec on the skill (the one engine) for a map stamp. bells=False takes every bell down:
    each belfry keeps its beam and a bare chain (Millbrook: "they have taken down every bell", the story)."""
    import json, os, sys
    here = os.path.dirname(os.path.abspath(__file__))
    sk = os.path.join(here, "..", "..", ".claude", "skills", "minecraft-builder", "scripts")
    if sk not in sys.path: sys.path.insert(0, sk)
    import engine
    spec = json.load(open(os.path.join(here, "review", "specs", fname)))
    if not bells:
        for part in spec.get("parts", []):
            if part.get("part") == "belfry" and part.get("bell", True): part["bell"] = "empty"
    bp = Blueprint(name); engine.into_blueprint(bp, spec)
    return bp


def chapel(seed=5, name="kingsrest_chapel", bells=True, healer=False):
    """Stone chapel on the skill (review/specs/kingsrest_chapel.json, gen_chapel.py): a buttressed nave with
    lancets, a front tower in three stages with the door at its foot, a louvred belfry and a broach spire
    (build-instructions/towers/README.md), a lower chancel at the back. bells=False: the belfry stands empty."""
    bp = _skill_spec("kingsrest_chapel.json", name, bells)
    bp.markers["door"] = (5, 2, 24); bp.markers["priest"] = (5, 2, 3)
    if healer: _healers_corner(bp)
    return bp.finish()


def _healers_corner(bp):
    """Sister Wren's chapel (Millbrook, story-critical; story-builds thread 2026-11-14): the three pew rows nearest the
    chancel step go, and her healer's corner stands on the north side of the aisle there. Local z is the row counted
    back from the chancel arch (0), x 5 the aisle; in the plan's turn (90) local +z is west and local -x is north.
    Wren stands in the aisle at (5, 2, 2): the bed's head beside her, its foot one row back, the water cauldron
    between the bed and the aisle, a stair chair, a barrel with a flower pot at the bed's foot."""
    for z in (1, 3, 5):
        for x in (3, 4, 6, 7):
            if (x, 2, z) in bp.cells and bp.cells[(x, 2, z)][0].endswith("_stairs"): bp.set(x, 2, z, "air")
    bp.set(2, 2, 2, "bed", facing="n", head=True)       # head to the east (towards the altar)
    bp.set(2, 2, 3, "bed", facing="n", head=False)
    bp.set(3, 2, 2, "cauldron", water=True)
    bp.set(3, 2, 4, "spruce_stairs", facing="w")        # back to the north wall: sits facing the aisle
    bp.set(2, 2, 5, "barrel", facing="up")
    bp.set(2, 3, 5, "flower_pot")
    bp.markers["wren"] = (5, 2, 2)


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
    B.roof(rect, "x", 6, overhang=1, verge=1, mats=COPPER_MATS)
    B.roof((7, 4, 13, 10), "z", 6, overhang=1, verge=1, mats=COPPER_MATS)
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
    return finish_doctrine(bp)


def clock_tower(seed=13, name="millbrook_clock_tower", bells=False):
    """Millbrook's clock tower on the square (the Clockwork Reeve's arena is at its foot), on the skill
    (review/specs/millbrook_clock_tower.json, gen_millbrook.py, build-instructions/towers/README.md): a stone
    shaft in three stages, a jettied timber clock stage with a framed 5 x 5 clock on every face, a steep slate
    helm and an open bell lantern. Its bell is down (bells=False) like every bell in Millbrook (the story)."""
    bp = _skill_spec("millbrook_clock_tower.json", name, bells)
    bp.markers["door"] = (3, 2, 5); bp.markers["arena"] = (3, 0, 12)
    return bp.finish()


def watermill(seed=17, name="millbrook_watermill"):
    """Watermill on the skill (review/specs/millbrook_watermill.json, gen_millbrook.py): stone ground floor,
    timber floor above under slate, a 7-block paddle wheel on the west side turning in its own stone-lined mill
    race. The stamp's wet_ok cells must land in water; town.py sets the floor one above the brook's water."""
    import json, os
    bp = _skill_spec("millbrook_watermill.json", name)
    st = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "review", "specs", "millbrook_watermill.json")))["stamp"]
    bp.wet_ok = [tuple(c) for c in st["wet_ok"]]; bp.wet_soft = [tuple(c) for c in st["wet_soft"]]
    bp.markers["door"] = (4, 2, 7); bp.markers["miller"] = (4, 2, 4)
    return bp.finish()
