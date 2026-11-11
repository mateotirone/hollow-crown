"""Regional house kits for the towns outside the Vale. Same builder rules (plinth, frame,
odd bays, overhanging roofs, detail blocks), regional materials and shapes:

  frost  Rimehold, Frostmarch: spruce log frames on dark cobbled-deepslate plinths, steep
         (pitch 2) spruce shingle roofs that shed snow, dark oak trim.
  salt   Gull's Rest, Saltreach: wind-proof stone ground floors, whitewashed upper floors in
         pale oak frames, low slate roofs.
  fen    Mirelight, Blackfen: mud-brick and mangrove houses lifted on mangrove stilts above
         the wet ground, reached by a stair.
  ember  Sunscar, Emberwaste: flat-roofed sandstone houses with parapets, a roof terrace,
         striped awnings and deep-set windows.
"""
import random
from bp import Blueprint, DIRS, OPP, RIGHT
from kit import Building, VALE, mix, grow, h3
import vale

vale.STYLES.update({
    "frost": dict(frame="spruce_log", infill=mix([("spruce_planks", 70), ("stripped_spruce_log", 30)], 51),
                  found="cobbled_deepslate", plinth="cobbled_deepslate", quoin="polished_deepslate",
                  stone=mix([("cobbled_deepslate", 55), ("stone_bricks", 25), ("andesite", 20)], 52),
                  roof="spruce_stairs", roof_block="spruce_planks", roof_slab="spruce_slab",
                  trim="dark_oak_stairs", trim_block="dark_oak_planks", trim_slab="dark_oak_slab", bracket="dark_oak_stairs",
                  shutter="dark_oak_trapdoor", shutters=0.5, gable=None, pitch=2),
    "salt": dict(frame="stripped_oak_log", infill="calcite", bracket="oak_stairs", trim="oak_stairs", trim_block="oak_planks",
                 trim_slab="oak_slab", stone=mix([("cobblestone", 40), ("andesite", 30), ("stone_bricks", 30)], 53),
                 shutter="birch_trapdoor", shutters=0.6, door="birch_door"),
    "fen": dict(frame="mangrove_log", infill=mix([("mud_bricks", 70), ("packed_mud", 30)], 54),
                found="mud_bricks", plinth="mud_bricks", quoin="mud_bricks", stone=mix([("mud_bricks", 80), ("packed_mud", 20)], 55),
                roof="mangrove_stairs", roof_block="mangrove_planks", roof_slab="mangrove_slab",
                trim="spruce_stairs", trim_block="spruce_planks", trim_slab="spruce_slab", bracket="mangrove_stairs",
                shutter="mangrove_trapdoor", shutters=0.4, door="mangrove_door", pitch=1),
})

def frost_house(seed, **kw):
    kw.setdefault("jetty", False); kw.setdefault("roof", "slate")
    return vale.townhouse(seed, style="frost", **kw)

def salt_house(seed, **kw):
    kw["ground"] = "stone"; kw.setdefault("jetty", False)
    return vale.townhouse(seed, style="salt", **kw)

def fen_house(seed, stilt=3, **kw):
    """A fen house on stilts: the house is lifted `stilt` blocks, mangrove posts under every corner
    and bay, and a stair up to the door from the ground."""
    kw["ground"] = "timber"; kw["jetty"] = False
    h = vale.townhouse(seed, style="fen", **kw)
    out = Blueprint(h.name + "_stilts")
    for (x, y, z), v in h.cells.items():
        if y < 0: continue                                        # no deep foundation over the mud
        out.cells[(x, y + stilt, z)] = v
    for k, (x, y, z) in h.markers.items(): out.markers[k] = (x, y + stilt, z)
    lo, hi = h.bounds()
    w, d = kw.get("width", 7) - 1, kw.get("depth", 9) - 1
    for x in range(0, w + 1, 2 if w <= 4 else 3):
        for z in (0, d):
            for y in range(0, stilt + 1): out.set(x, y, z, "mangrove_log", axis="y")
    for x in (0, w):
        for z in range(0, d + 1, 4):
            for y in range(0, stilt + 1): out.set(x, y, z, "mangrove_log", axis="y")
    for x in range(0, w + 1):                                     # floor platform under the house
        for z in range(0, d + 1): out.setif(x, stilt, z, "mangrove_planks")
    dx = w // 2                                                   # stair down from the door (front, +z)
    for i in range(stilt):
        out.set(dx, stilt - i, d + 2 + i, "mangrove_stairs", facing="n")
    for x in range(dx - 1, dx + 2): out.set(x, stilt, d + 1, "mangrove_planks")
    out.set(dx - 1, stilt + 1, d + 1, "mangrove_fence"); out.set(dx + 1, stilt + 1, d + 1, "mangrove_fence")
    out.set(dx + 1, stilt + 2, d + 1, "lantern")
    return out.finish()

def ember_house(seed, width=7, depth=9, storeys=1, **kw):
    """Flat-roofed sandstone house: thick walls, a parapet round a roof terrace, a striped
    awning over the door, small deep windows and a roof hatch."""
    rnd = random.Random(seed)
    bp = Blueprint(f"ember_house_{seed}")
    P = {**VALE, "stone": mix([("smooth_sandstone", 60), ("sandstone", 30), ("cut_sandstone", 10)], seed),
         "plinth": "cut_sandstone", "quoin": "cut_sandstone", "quoin2": "smooth_sandstone", "found": "sandstone", "floor": "smooth_sandstone",
         "sill": "smooth_sandstone_stairs", "door": "acacia_door", "jamb": "cut_sandstone", "lintel": "chiseled_sandstone",
         "trim": "smooth_sandstone_stairs", "shutter": "acacia_trapdoor"}
    B = Building(bp, P, seed)
    w, d = width - 1, depth - 1; rect = (0, 0, w, d)
    B.foundation(grow(rect, "nsew"), 0); B.floor(rect, 0)
    h = 4 + (storeys - 1) * 4
    B.stone_storey(rect, 1, h + 1)
    for k in range(storeys):
        y = 2 + k * 4
        for wx in (w // 2 - 2, w // 2 + 2):
            if 0 < wx < w and not (k == 0 and abs(wx - w // 2) < 2): B.window(wx, y, d, "s", 1, 2, kind="stone")
        B.window(w // 2, y, 0, "n", 1, 2, kind="stone")
        B.window(w, y, d // 2, "e", 1, 2, kind="stone"); B.window(0, y, d // 2, "w", 1, 2, kind="stone")
        if k > 0: B.floor(rect, 1 + k * 4)
    B.door(w // 2, 1, d, "s", canopy=False, lanterns=False)
    roof_y = h + 2
    B.floor(rect, roof_y - 1, mat="smooth_sandstone")
    for x in range(0, w + 1):                                    # parapet with crenels
        for z in range(0, d + 1):
            if x in (0, w) or z in (0, d):
                corner = x in (0, w) and z in (0, d)
                bp.set(x, roof_y, z, "sandstone_wall") if corner else bp.set(x, roof_y, z, "smooth_sandstone_slab", half="bottom")
    for x in range(1, w):
        for z in range(1, d): bp.set(x, roof_y - 1, z, "smooth_sandstone")
    bp.set(1, roof_y - 1, 1, "acacia_trapdoor", facing="s")          # roof hatch
    colour = rnd.choice(["orange", "red", "yellow", "white"])
    for i, x in enumerate(range(w // 2 - 1, w // 2 + 2)):            # striped awning on fence posts
        bp.set(x, 4, d + 1, f"{colour}_wool" if i % 2 == 0 else "white_wool")
        bp.set(x, 4, d + 2, f"{colour}_carpet" if i % 2 == 0 else "white_carpet")
    for x in (w // 2 - 1, w // 2 + 1): bp.set(x, 3, d + 2, "acacia_fence"); bp.set(x, 2, d + 2, "acacia_fence"); bp.set(x, 1, d + 2, "acacia_fence")
    for x in range(0, w + 1):                                     # projecting roof beams (vigas)
        if x % 2 == 1:
            bp.set(x, roof_y - 2, -1, "spruce_log", axis="z"); bp.set(x, roof_y - 2, d + 1, "spruce_log", axis="z")
    if rnd.random() < 0.6: bp.set(w - 1, roof_y, d - 1, "barrel")
    for y in range(1, roof_y - 1): bp.set(w - 1, y, 1, "ladder", facing="s")   # inside, up to the hatch corner
    bp.set(w - 1, roof_y - 1, 1, "air")
    bp.markers["door"] = (w // 2, 1, d - 1)
    return bp.finish()
