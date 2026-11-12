"""Buildings for the four map towns outside the Vale: Rimehold (Frostmarch), Gull's Rest (Saltreach),
Sunscar (Emberwaste) and Mirelight (Blackfen), built to the build instructions (PR #87): regional palettes
(build-instructions/palettes), stone painted as gradients by the region's ladder code, regional glass,
dressed windows and chimneys, roofs that connect.

The town generator (towngen, PR #91) lays the towns out and imports three hooks from here:

  HOUSES[region](seed, rnd, tier, roof=None) -> Blueprint
        tier 0 tall house by the square, 1 street house, 2 outer cottage, 3 barn / farm building.
        Widths 7/9/11, depths 7..13, all odd. Front faces +z, markers["door"] = the cell just outside the
        door, bp.kind = "house" (or "barn"). Pitched houses are built with a slate roof
        (deepslate_tile_*, used nowhere else on them) so the town can recolour them after placement with
        recolour_roof(bp, region, colour); pass roof= to build one colour straight away.
  CIVIC[town] = [(name, maker), ...]   square buildings, door on +z, every footprint 15x19 or under.
  SHORE[town] = [(name, maker), ...]   buildings with water behind: land door on +z, and
        markers["water_edge"] = (x, y, z) whose z is the first building-local row that should be water
        (everything further towards -z is water).

ROOF_MIX[town] is each town's roof colour mix out of 10 (palettes/towns.md); assign_roofs() turns it into
an exact, shuffled list for n buildings.
"""
import math
import random
from bp import Blueprint, DIRS, OPP, RIGHT
from kit import band_index, Building, VALE, mix, grow, h3, DOCTRINE, finish_doctrine, SLATE, LADDERS, paint_stone
import vale
import furnish as F
from settle_halls import pyramid, skirt, dragon_heads, dome, drum, arcade

# ---- ladders: read from the doctrine JSON (kit.LADDERS), bottom of the wall to the top --------------------
FRO_STONE = LADDERS["FRO-01"]      # dark stone: plinths, walls, chimneys
FRO_PLANK = LADDERS["FRO-02"]      # plank infill
SAL_GREY = LADDERS["SAL-05"]       # warm grey footings
SAL_WHITE = LADDERS["SAL-02"]      # whitewash
BLK_STONE = LADDERS["BLK-03"]      # grey-brown stone footings
BLK_MUD = LADDERS["BLK-01"]        # mud infill, darker low
EMB_SAND = LADDERS["EMB-01"]       # pale sand walls
WEATHERED = ["waxed_exposed_cut_copper_stairs", "waxed_weathered_cut_copper_stairs", "waxed_oxidized_cut_copper_stairs"]  # civic accent: copper stays a colour gradient
INFILL = "__infill__"               # placeholder the paint pass replaces with the region's infill ladder

def paint_infill(bp, ladder, seed=11):
    """Paint the infill panels with paint_teeth (kit.paint_stone) on the region's infill ladder; any panel cell the
    pass cannot see (no air beside it) takes the middle step."""
    paint_stone(bp, ladder, {INFILL}, seed=seed)
    for k, (n, p) in list(bp.cells.items()):
        if n == INFILL: bp.cells[k] = (ladder[len(ladder) // 2], {})

# ---- roofs: one sentinel per house, recoloured by the town --------------------------------------------
BASE_ROOF = dict(roof="deepslate_tile_stairs", roof_block="deepslate_tiles", roof_slab="deepslate_tile_slab", roof_ladder=None)
ROOF_SETS = {
    "frost": {"dark": ("dark_oak_stairs", "dark_oak_slab", "dark_oak_planks", None),
              "mid": ("spruce_stairs", "spruce_slab", "spruce_planks", None),
              "slate": ("deepslate_tile_stairs", "deepslate_tile_slab", "deepslate_tiles", SLATE),
              "copper": (WEATHERED[0], "waxed_oxidized_cut_copper_slab", "waxed_oxidized_cut_copper", WEATHERED)},
    "salt": {"green": ("dark_prismarine_stairs", "dark_prismarine_slab", "dark_prismarine", None),
             "teal": ("prismarine_bricks_stairs", "prismarine_brick_slab", "prismarine_bricks", None),
             "white": ("smooth_quartz_stairs", "smooth_quartz_slab", "smooth_quartz", ["polished_diorite_stairs", "smooth_quartz_stairs"]),
             "orange": ("waxed_cut_copper_stairs", "waxed_cut_copper_slab", "waxed_cut_copper", None),
             "slate": ("deepslate_tile_stairs", "deepslate_tile_slab", "deepslate_tiles", SLATE)},
    "fen": {"moss": ("dark_oak_stairs", "dark_oak_slab", "dark_oak_planks", None),
            "mangrove": ("mangrove_stairs", "mangrove_slab", "mangrove_planks", None),
            "mud": ("mud_brick_stairs", "mud_brick_slab", "mud_bricks", None),
            "thatch": ("dark_oak_stairs", "dark_oak_slab", "hay_block", None)},
    "ember": {"red": ("smooth_red_sandstone_stairs", "smooth_red_sandstone_slab", "cut_red_sandstone", ["red_sandstone_stairs", "smooth_red_sandstone_stairs"]),
              "flat": None},
}
ROOF_MIX = {"rimehold": {"dark": 5, "mid": 3, "slate": 2}, "gulls_rest": {"green": 3, "teal": 3, "white": 3, "orange": 1},
            "mirelight": {"moss": 5, "mangrove": 3, "mud": 2}, "sunscar": {"flat": 7, "red": 3}}
TOWN_REGION = {"rimehold": "frost", "gulls_rest": "salt", "mirelight": "fen", "sunscar": "ember"}

def assign_roofs(town, n, seed=0):
    """Exactly the town's mix for n buildings (largest remainders), shuffled by a hash of the town name.
    The generator then swaps colours between non-neighbours to keep the neighbour rule (towns.md)."""
    mixd = ROOF_MIX[town]; tot = sum(mixd.values())
    raw = {k: n * v / tot for k, v in mixd.items()}
    cnt = {k: int(r) for k, r in raw.items()}
    for k in sorted(raw, key=lambda k: raw[k] - cnt[k], reverse=True)[: n - sum(cnt.values())]: cnt[k] += 1
    out = [k for k, c in cnt.items() for _ in range(c)]
    random.Random(sum(map(ord, town)) * 7919 + seed).shuffle(out)
    return out

def recolour_roof(bp, region, colour, seed=0):
    """Swap a house's sentinel slate roof for one of its region's colours, keeping the eaves-to-ridge gradient
    where the colour has a ladder. Frostmarch roofs keep their snow; Blackfen's mossy shingle gets its moss."""
    S = ROOF_SETS[region].get(colour)
    if S is None: return bp
    stair, slab, block, ladder = S
    roof = [k for k, (n, p) in bp.cells.items() if n == "deepslate_tile_stairs"]
    if not roof and colour != "slate": return bp
    ys = [k[1] for k in roof] or [0]; y0, y1 = min(ys), max(ys)
    for k, (n, p) in list(bp.cells.items()):
        x, y, z = k
        if n == "deepslate_tile_stairs":
            st = stair
            if ladder: st = ladder[band_index(y, y0, y1, len(ladder), x * 7 + z)]
            bp.cells[k] = (st, p)
        elif n == "deepslate_tile_slab": bp.cells[k] = (slab, p)
        elif n == "deepslate_tiles": bp.cells[k] = (block, p)
    tex = ROOF_TEXTURE.get(block)
    if tex and not ladder:     # every roof is textured (Mateo 2026-11-12): a same-colour partner block mixed in at random
        share, (ps, pl, pb) = tex
        for k, (n, p) in list(bp.cells.items()):
            if h3(seed, k[0] * 3 + k[1], k[2], 17) >= share: continue
            if n == stair: bp.cells[k] = (ps, p)
            elif n == slab: bp.cells[k] = (pl, p)
            elif n == block: bp.cells[k] = (pb, p)
    if region == "fen" and colour == "moss": moss_roof(bp, stair, block, slab, seed)
    if getattr(bp, "roof_untextured", False):    # a skill house: every roof gets its two-block texture (Mateo 2026-11-12)
        from kit import texture_roofs
        texture_roofs(bp, seed); bp.roof_untextured = False
    return bp

# the town's recolour keeps the skill's two-block roof texture (TEXTURE_PAIRS in the skill's materials.py)
ROOF_TEXTURE = {"dark_prismarine": (0.3, ("warped_stairs", "warped_slab", "warped_planks")),
                "prismarine_bricks": (0.35, ("prismarine_stairs", "prismarine_slab", "prismarine"))}

def moss_roof(bp, stair, block, slab, seed=0):
    """Mossy dark shingle: moss blocks along the ridge, 10 to 15% moss on the slope (settle_halls.thatch)."""
    for k, (n, p) in list(bp.cells.items()):
        if n == stair and h3(*k, 7 + seed) < 0.13: bp.cells[k] = ("moss_block", {})
        elif n == block and bp.get(k[0], k[1] + 1, k[2])[0] == slab: bp.cells[k] = ("moss_block", {})
        elif n == slab and bp.get(k[0], k[1] - 1, k[2])[0] in ("moss_block", block): bp.cells[k] = ("moss_carpet", {})

def snow_cap(bp):
    """Frostmarch: snow on the ridge (a snow layer on every ridge block) and on chimney caps and flat tops."""
    tops = {}
    for (x, y, z), (n, p) in bp.cells.items():
        if n not in ("air", "keep"): tops[(x, z)] = max(tops.get((x, z), y), y)
    for (x, z), y in tops.items():
        n = bp.get(x, y, z)[0]
        if n.endswith("_slab") and not bp.get(x, y, z)[1].get("half") == "top":
            below = bp.get(x, y - 1, z)[0]
            if not below.endswith(("_stairs", "_slab")) and below not in ("air", "keep"): bp.cells[(x, y, z)] = ("snow_layer", {"height": 1})
        elif n.endswith(("_planks", "_tiles", "_bricks", "cobblestone", "deepslate", "_copper", "_wall")) and n not in ("campfire",):
            bp.cells[(x, y + 1, z)] = ("snow_layer", {"height": 0})

def door_marker(bp, x, y, z):
    bp.markers["door"] = (x, y, z)

# ---- regional palettes --------------------------------------------------------------------------------
def frost_P(seed=0, civic=False):
    P = dict(VALE); P.update(DOCTRINE); P.update(BASE_ROOF)
    P.update(frame="spruce_log", frame2="dark_oak_log", infill=INFILL, infill_ladder=FRO_PLANK, found="cobbled_deepslate",
             plinth=FRO_STONE[0], quoin="polished_deepslate", quoin2="polished_deepslate",
             stone=FRO_STONE[1],
             trim="dark_oak_stairs", trim_block="dark_oak_planks", trim_slab="dark_oak_slab", bracket="dark_oak_stairs",
             gable="stripped_spruce_log", floor="spruce_planks", door="dark_oak_door", shutter="dark_oak_trapdoor", shutters=0.3,
             fence="dark_oak_fence", sill="deepslate_brick_stairs", jamb="polished_deepslate", lintel="deepslate_bricks",
             chimney=mix([("deepslate_bricks", 80), ("cobbled_deepslate", 20)], 72), chimney_cap="cobbled_deepslate_wall",
             pane="light_blue_stained_glass_pane" if civic else "white_stained_glass_pane", shelf="spruce_slab",
             panel_trapdoor="dark_oak_trapdoor", pitch=2,
             ladder=FRO_STONE, family=set(FRO_STONE) | {"stone_bricks"})
    return P

def salt_P(seed=0, civic=False):
    P = dict(VALE); P.update(DOCTRINE); P.update(BASE_ROOF)
    P.update(frame="stripped_birch_log", frame2="stripped_oak_log", infill=INFILL, infill_ladder=SAL_WHITE,
             found="cobblestone", plinth=SAL_GREY[0], quoin="cut_sandstone", quoin2="smooth_sandstone",
             stone=SAL_GREY[1],
             trim="birch_stairs", trim_block="birch_planks", trim_slab="birch_slab", bracket="birch_stairs",
             gable=None, floor="birch_planks", door="warped_door" if h3(seed, 0, 0, 9) < 0.4 else "birch_door",
             shutter="warped_trapdoor" if h3(seed, 1, 0, 9) < 0.6 else "birch_trapdoor", shutters=0.3, fence="birch_fence",
             sill="smooth_sandstone_stairs", jamb="cut_sandstone", lintel="smooth_sandstone", wsill="birch_stairs",
             chimney="brick_block", chimney_cap="brick_wall", shelf="birch_slab", panel_trapdoor="birch_trapdoor",
             pane="cyan_stained_glass_pane" if civic else "light_blue_stained_glass_pane",
             ladder=SAL_GREY, family=set(SAL_GREY) | {"stone_bricks"})
    return P

def fen_P(seed=0, civic=False):
    P = dict(VALE); P.update(DOCTRINE); P.update(BASE_ROOF)
    P.update(frame="mangrove_log", frame2="stripped_mangrove_log", infill=INFILL, infill_ladder=BLK_MUD,
             found="tuff", plinth=BLK_STONE[0], quoin="polished_tuff", quoin2="polished_tuff",
             stone=BLK_STONE[1],
             trim="spruce_stairs", trim_block="spruce_planks", trim_slab="spruce_slab", bracket="mangrove_stairs",
             gable="mangrove_planks", floor="dark_oak_planks", door="mangrove_door", shutter="mangrove_trapdoor", shutters=0.4,
             fence="mangrove_fence", sill="mud_brick_stairs", jamb="mangrove_log", lintel="stripped_mangrove_log", wsill="mangrove_stairs",
             chimney="mud_bricks", chimney_cap="mud_brick_wall", shelf="mangrove_slab", panel_trapdoor="mangrove_trapdoor",
             pane="green_stained_glass_pane" if civic else "brown_stained_glass_pane", pitch=1,
             ladder=BLK_STONE, family=set(BLK_STONE) | {"tuff"})
    return P

def ember_P(seed=0, civic=False):
    P = dict(VALE); P.update(DOCTRINE)
    P.update(stone="sandstone", plinth=EMB_SAND[0],
             quoin="cut_sandstone", quoin2="smooth_sandstone", found="sandstone", floor="smooth_sandstone", frame="stripped_acacia_log",
             sill="smooth_sandstone_stairs", door="acacia_door", jamb="cut_sandstone", lintel="chiseled_sandstone",
             trim="acacia_stairs", trim_block="acacia_planks", trim_slab="acacia_slab", shutter="acacia_trapdoor", shutters=0.0,
             fence="acacia_fence", shelf="acacia_slab", roof="smooth_red_sandstone_stairs", roof_block="cut_red_sandstone",
             roof_slab="smooth_red_sandstone_slab", roof_ladder=["red_sandstone_stairs", "smooth_red_sandstone_stairs"],
             roof_flat="smooth_sandstone", chimney="sandstone", chimney_cap="sandstone_wall", dress=False,
             pane="yellow_stained_glass_pane" if civic else "orange_stained_glass_pane",
             ladder=EMB_SAND, family={"sandstone", "smooth_sandstone", "white_terracotta"})
    return P

PALETTES = {"frost": frost_P, "salt": salt_P, "fen": fen_P, "ember": ember_P}

def finish(bp, P, region, kind="house", snow=None):
    if region == "frost" and snow is not False: snow_cap(bp)
    if P.get("infill_ladder"): paint_infill(bp, P["infill_ladder"])
    finish_doctrine(bp, P["ladder"], P["family"], planters=region != "ember", wood=P["trim"].replace("_stairs", ""))
    bp.kind = kind
    return bp

def _weighted(rnd, table):
    t = rnd.random() * sum(w for _, w in table)
    for k, w in table:
        t -= w
        if t < 0: return k
    return table[-1][0]

# =========================================================================================================
# Houses
# =========================================================================================================
vale.STYLES.update({
    "frost_town": dict(frost_P(0)),
    "salt_town": dict(salt_P(0)),
    "fen_town": dict(fen_P(0)),
})

def _sizes(rnd, tier):
    if tier == 0: return rnd.choice([(7, 9), (7, 11), (9, 9), (9, 11), (9, 13)])
    if tier == 1: return rnd.choice([(7, 7), (7, 9), (9, 7), (9, 9), (7, 11)])
    return rnd.choice([(7, 7), (7, 9), (9, 7)])

def _engine():
    import os, sys
    sk = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".claude", "skills", "minecraft-builder", "scripts")
    if sk not in sys.path: sys.path.insert(0, sk)
    import engine
    return engine

def frost_house(seed, rnd, tier, roof=None):
    """A Frostmarch house on the skill (regions/frostmarch.md): dark deepslate plinth two courses high, plank rows
    in a dark oak frame (the bigger ones on a stone ground storey), a steep pitch 2 roof that sheds snow with snow on
    the ridge, dragon heads on both gables (every gable roof carries them), frosted glass, a woodpile under the
    eaves. The roof is built in slate so the town can recolour it (recolour_roof)."""
    if tier == 3: return frost_barn(seed, rnd, roof)
    w, d = _sizes(rnd, tier)
    storeys = 2 if (tier == 0 or (tier == 1 and rnd.random() < 0.4)) else 1
    W, D = w - 1, d - 1; xd = W // 2
    stone = tier == 0 and rnd.random() < 0.6
    cside = rnd.choice("we"); cx = W - 1 if cside == "e" else 1
    hs = {"part": "house", "style": {"base": "frost_timber", "roof": {"block": "deepslate_tiles", "texture": False}},
          "rect": [0, 0, W, D], "y": 0, "plinth": 2, "storeys": [5] + [4] * (storeys - 1),
          "door": {"side": "s", "kind": "house", "steps": 1},
          "roof": {"type": "gable", "ridge": "z", "pitch": 2, "gable_horns": True, "snow": True},
          "chimney": [[cx, D // 2]], "vines": 0, "seed": seed, "interior": "home"}
    if stone: hs["storey_style"] = [{"frame_kind": "stone", "frame": "deepslate_bricks", "infill": {"ladder": "FRO-01", "axis": "y"}}] + [{}] * (storeys - 1)
    if rnd.random() < 0.3: hs["style"]["shutter"] = "dark_oak_planks"
    else: hs["shutters"] = 0
    pile = {"part": "woodpile", "at": [-1 if cside == "e" else W + 1, 1, 1 if cside == "e" else D - 1], "len": 3, "h": 2,
            "facing": "w" if cside == "e" else "e", "wood": "spruce"}
    bp = Blueprint(f"rimehold_house_{seed}_t{tier}")
    _engine().into_blueprint(bp, {"name": bp.name, "parts": [hs, pile]})
    door_marker(bp, xd, 2, D + 1)
    bp.roof_untextured = True                    # plain slate until the town picks its colour; recolour_roof textures it
    if roof: recolour_roof(bp, "frost", roof, seed)
    bp.kind = "house"
    return bp

def frost_house_kit(seed, rnd, tier, roof=None):
    """A Frostmarch house: dark deepslate base, plank rows in a spruce frame, a steep (pitch 2) roof that sheds
    snow, frosted glass, dragon heads on the gable of the bigger houses."""
    if tier == 3: return frost_barn(seed, rnd, roof)
    w, d = _sizes(rnd, tier)
    storeys = 2 if (tier == 0 or (tier == 1 and rnd.random() < 0.4)) else 1
    vale.STYLES["frost_town"] = dict(frost_P(seed), pitch=2 if w <= 7 else 1)   # pitch 2 sheds snow; on wider spans it would be all roof
    bp = vale.townhouse(seed, width=w, depth=d, storeys=storeys, ground="stone" if (tier == 0 and rnd.random() < 0.6) else "timber",
                        jetty=False, roof="slate", chimney_side=rnd.choice("we"), style="frost_town")
    bp.name = f"rimehold_house_{seed}_t{tier}"
    if tier == 0 or rnd.random() < 0.3:
        top = max(y for (x, y, z), (n, p) in bp.cells.items() if n == "deepslate_tile_slab" and x == (w - 1) // 2)
        z0 = min(z for (x, y, z), (n, p) in bp.cells.items() if n.startswith("deepslate_tile") and x == (w - 1) // 2 and y == top)
        z1 = max(z for (x, y, z), (n, p) in bp.cells.items() if n.startswith("deepslate_tile") and x == (w - 1) // 2 and y == top)
        dragon_heads(bp, (w - 1) // 2, top, z1 + 1, mat="dark_oak_stairs"); dragon_heads(bp, (w - 1) // 2, top, z0 - 1, mat="dark_oak_stairs")
    snow_cap(bp); paint_infill(bp, FRO_PLANK, seed)
    if roof: recolour_roof(bp, "frost", roof, seed)
    bp.kind = "house"
    return bp

def salt_house(seed, rnd, tier, roof=None):
    """A Gull's Rest house, Atlantean (Mateo 2026-11-12): pale stone and quartz columns on a prismarine plinth,
    sea-glass windows, and seven roof forms (hip, mansard, bell, dome, temple, terrace, tower). Built on the
    building skill: atlantean.py. The old kit house is kept below as salt_house_kit."""
    import atlantean
    if tier == 3: return atlantean.store(seed, rnd, roof)
    return atlantean.house(seed, rnd, tier, roof)

def salt_house_kit(seed, rnd, tier, roof=None):
    """The first Gull's Rest house (kit build): wind-proof stone ground storey, whitewashed upper storey between pale birch posts,
    a low hipped roof (pitch 1), painted sea-green shutters, a flat roof terrace on some."""
    if tier == 3: return salt_store(seed, rnd, roof, name="gulls_rest_net_store")
    w, d = _sizes(rnd, tier)
    storeys = 2 if (tier == 0 or (tier == 1 and rnd.random() < 0.6)) else 1
    P = salt_P(seed)
    bp = Blueprint(f"gulls_rest_house_{seed}_t{tier}")
    B = Building(bp, P, seed)
    W, D = w - 1, d - 1; r = (0, 0, W, D)
    B.foundation(grow(r, "nsew"), 0); B.floor(r, 0)
    B.stone_storey(r, 1, 4)
    for wx in (W // 2 - 2, W // 2 + 2):
        if 0 < wx < W: B.window(wx, 2, D, "s", 1, 2, kind="stone")
    B.window(0, 2, D // 2, "w", 1, 2, kind="stone"); B.window(W, 2, D // 2, "e", 1, 2, kind="stone")
    B.door(W // 2, 1, D, "s", canopy=storeys == 1, lanterns=True)
    y = 5
    if storeys == 2:
        B.floor(r, y); B.timber_storey(r, y, 5, bay=4); B.bay_windows(r, y, "sewn"); y += 5
        if w >= 9:     # a balcony over the door on the bigger houses
            for x in range(W // 2 - 1, W // 2 + 2):
                bp.set(x, y - 5, D + 1, P["trim_slab"], half="top"); bp.set(x, y - 4, D + 1, P["fence"])
            bp.set(W // 2, y - 4, D + 1, "air")
            for yy in (y - 4, y - 3): bp.set(W // 2, yy, D, "air")
            bp.set(W // 2, y - 4, D, P["door"], facing="n"); bp.set(W // 2, y - 3, D, P["door"], facing="n", upper=True)
    terrace = tier == 0 and rnd.random() < 0.35
    if terrace:     # flat roof terrace with a stone parapet and a small hipped stair hut
        B.floor(r, y, mat="smooth_sandstone")
        for x in range(0, W + 1):
            for z in range(0, D + 1):
                if x in (0, W) or z in (0, D): bp.set(x, y, z, "smooth_sandstone"); bp.set(x, y + 1, z, "smooth_sandstone_slab", half="bottom")
                else: bp.set(x, y, z, "smooth_sandstone")
        hut = (W - 4, 0, W, 4)
        B.stone_storey(hut, y + 1, 3, quoins=False, plinth=False)
        bp.set(W - 2, y + 1, 4, P["door"], facing="n"); bp.set(W - 2, y + 2, 4, P["door"], facing="n", upper=True)
        pyramid(bp, P, hut[0] - 1, hut[1] - 1, hut[2] + 1, hut[3] + 1, y + 4, pitch=1, finial=None)
        bp.set(1, y + 1, D - 1, "flower_pot", plant="red_tulip"); bp.set(2, y + 1, D - 1, P["trim"], facing="n")
    else:
        pyramid(bp, P, -1, -1, W + 1, D + 1, y, pitch=1, finial=None)
        B.H = {}
    vale.house_interior(bp, W, D, [0, 5, 10][:storeys + 1] if storeys == 2 else [0, 5], D)
    cx = rnd.choice((-1, W + 1)); top = y + (2 if terrace else min(W, D) // 2 + 2)
    for yy in range(1, top + 1): bp.set(cx, yy, D // 2, P["chimney"])
    bp.set(cx, top + 1, D // 2, P["chimney_cap"])
    if rnd.random() < 0.5: bp.set(W, 1, D + 1, "barrel")
    if rnd.random() < 0.6: bp.set(0, 1, D + 1, "flower_pot", plant=rnd.choice(["red_tulip", "cornflower", "azure_bluet"]))
    if rnd.random() < 0.4: bp.set(0 if cx > 0 else W, 2, -1, "dried_kelp_block")
    door_marker(bp, W // 2, 1, D + 1)
    if roof: recolour_roof(bp, "salt", roof, seed)
    return finish(bp, P, "salt")

def fen_house(seed, rnd, tier, roof=None, stilt=None):
    """A Mirelight house: mud brick between mangrove posts, lifted on mangrove stilts, a stair down to the
    boardwalk, mossy low roof, froglight in a cage by the door."""
    if tier == 3: return fen_store(seed, rnd, roof, name="mirelight_barn")
    w, d = _sizes(rnd, tier)
    if w > 9: w = 9
    stilt = stilt if stilt is not None else (2 if tier == 0 else 3)
    storeys = 2 if (tier == 0 and rnd.random() < 0.6) else 1
    vale.STYLES["fen_town"] = dict(fen_P(seed))
    h = vale.townhouse(seed, width=w, depth=d, storeys=storeys, ground="timber", jetty=False, roof="slate",
                       chimney_side=rnd.choice("we"), style="fen_town")
    bp = Blueprint(f"mirelight_house_{seed}_t{tier}")
    for (x, y, z), v in h.cells.items():
        if y < 0: continue
        if y == 0 and v[0] in ("tuff", "tuff_bricks", "polished_tuff", "cobbled_deepslate", "dripstone_block"): v = ("mangrove_planks", {})   # the deck, not a stone footing
        bp.cells[(x, y + stilt, z)] = v
    W, D = w - 1, d - 1
    for x in range(0, W + 1, 2 if W <= 4 else 3 if W % 3 == 0 else 4):
        for z in (0, D):
            for y in range(0, stilt + 1): bp.set(x, y, z, "mangrove_log", axis="y")
    for x in (0, W):
        for z in range(0, D + 1, 4 if D % 4 == 0 else 3 if D % 3 == 0 else D):
            for y in range(0, stilt + 1): bp.set(x, y, z, "mangrove_log", axis="y")
    for z in (0, D):
        for y in range(0, stilt): bp.set(W, y, z, "mangrove_log", axis="y")
    for x in range(0, W + 1):
        for z in range(0, D + 1): bp.setif(x, stilt, z, "mangrove_planks")
    for x in range(-1, W + 2):        # mangrove roots splaying round the foot of the stilts
        for z in (-1, D + 1):
            if h3(x, 0, z, seed) < 0.3: bp.setif(x, 0, z, "mangrove_roots")
    dx = W // 2
    for x in range(dx - 1, dx + 2): bp.set(x, stilt, D + 1, "mangrove_planks")
    for i in range(stilt):
        bp.set(dx, stilt - i, D + 2 + i, "mangrove_stairs", facing="n")
        bp.set(dx, stilt - i - 1, D + 2 + i, "mangrove_planks") if stilt - i - 1 >= 1 else None
    bp.set(dx - 1, stilt + 1, D + 1, "mangrove_fence"); bp.set(dx + 1, stilt + 1, D + 1, "mangrove_fence")
    bp.set(dx + 1, stilt + 2, D + 1, "iron_bars"); bp.set(dx + 1, stilt + 3, D + 1, "verdant_froglight" if h3(seed, 0, 0, 3) < 0.6 else "ochre_froglight")
    bp.set(dx - 1, stilt + 2, D + 1, "flower_pot", plant="fern")
    for (x, y, z), v in list(bp.cells.items()):
        if v[0] == "keep": del bp.cells[(x, y, z)]
    door_marker(bp, dx, 1, D + 2 + stilt)
    bp.markers["stilt"] = (0, stilt, 0)
    if roof: recolour_roof(bp, "fen", roof, seed)
    bp.kind = "house"
    paint_infill(bp, BLK_MUD, seed)
    return bp.finish()

def ember_house(seed, rnd, tier, roof=None):
    """A Sunscar house: thick painted sandstone walls, a parapet round a flat roof terrace, deep windows behind
    acacia lattice, projecting roof beams, a striped awning; some (the red share) carry a low red roof or dome."""
    if tier == 3: return ember_granary(seed, rnd)
    w, d = _sizes(rnd, tier)
    storeys = 2 if (tier == 0 or (tier == 1 and rnd.random() < 0.5)) else 1
    P = ember_P(seed)
    bp = Blueprint(f"sunscar_house_{seed}_t{tier}")
    B = Building(bp, P, seed)
    W, D = w - 1, d - 1; rect = (0, 0, W, D)
    B.foundation(grow(rect, "nsew"), 0); B.floor(rect, 0)
    h = 4 * storeys
    B.stone_storey(rect, 1, h + 1)
    for k in range(storeys):
        y = 2 + k * 4
        for wx in (W // 2 - 2, W // 2 + 2):
            if 0 < wx < W: lattice_window(B, wx, y, D, "s")
        lattice_window(B, W // 2, y, 0, "n")
        lattice_window(B, W, y, D // 2, "e"); lattice_window(B, 0, y, D // 2, "w")
        if k > 0: B.floor(rect, 1 + k * 4)
    B.door(W // 2, 1, D, "s", canopy=False, lanterns=False)
    for y in range(1, 3): bp.set(W // 2, y, D, P["door"], facing="n", **({"upper": True} if y == 2 else {}))
    bp.set(W // 2 - 1, 3, D, "sandstone_stairs", facing="e", half="top"); bp.set(W // 2 + 1, 3, D, "sandstone_stairs", facing="w", half="top")
    roof_y = h + 2
    B.floor(rect, roof_y - 1, mat="smooth_sandstone")
    for x in range(1, W):
        for z in range(1, D): bp.set(x, roof_y - 1, z, "smooth_sandstone")
    red = roof == "red"
    if red and rnd.random() < 0.5:     # a small red dome on a drum over the middle
        R = min(W, D) // 2 - 1
        dome(bp, W // 2, roof_y, D // 2, max(2, R), "smooth_red_sandstone", finial="red_sandstone_wall")
    elif red:                           # a low red hipped roof over the whole house
        pyramid(bp, P, -1, -1, W + 1, D + 1, roof_y, pitch=1, finial=None)
    for x in range(0, W + 1):               # parapet wherever the roof leaves the wall top open
        for z in range(0, D + 1):
            if (x in (0, W) or z in (0, D)) and bp.get(x, roof_y, z)[0] in ("keep", "air"):
                corner = x in (0, W) and z in (0, D)
                bp.set(x, roof_y, z, "sandstone_wall" if corner else "smooth_sandstone_slab", half="bottom")
    bp.set(1, roof_y - 1, 1, "acacia_trapdoor", facing="s")
    for y in range(1, roof_y - 1): bp.set(1, y, 2, "ladder", facing="s")
    colour = rnd.choice(["orange", "red", "yellow", "white"])
    for i, x in enumerate(range(W // 2 - 1, W // 2 + 2)):        # striped awning on posts over the door
        bp.set(x, 4, D + 1, f"{colour}_wool" if i % 2 == 0 else "white_wool")
        bp.set(x, 4, D + 2, f"{colour}_carpet" if i % 2 == 0 else "white_carpet")
    for x in (W // 2 - 1, W // 2 + 1):
        for y in range(1, 4): bp.set(x, y, D + 2, "acacia_fence")
    for x in range(1, W, 2):                                       # projecting roof beams (vigas)
        bp.set(x, roof_y - 2, -1, "stripped_spruce_log", axis="z"); bp.set(x, roof_y - 2, D + 1, "stripped_spruce_log", axis="z")
    if rnd.random() < 0.6: bp.set(W - 1, roof_y, D - 1, "barrel")
    if rnd.random() < 0.5: bp.set(W + 1, 1, D, "flower_pot", plant="cactus")
    if rnd.random() < 0.5: bp.set(-1, 1, D, "decorated_pot")
    door_marker(bp, W // 2, 1, D + 1)
    return finish(bp, P, "ember")

def lattice_window(B, x, y, z, side, h=2):
    """A deep window: glass set back one block, acacia lattice (closed trapdoor) over the opening, sill and lintel."""
    bp, P = B.bp, B.P
    ox, oz = DIRS[side][0], DIRS[side][2]
    for j in range(h):
        bp.set(x - ox, y + j, z - oz, P["pane"])
        bp.set(x, y + j, z, "acacia_trapdoor", facing=OPP[side], open=True)
    bp.set(x, y + h, z, P["lintel"]); bp.set(x + ox, y - 1, z + oz, P["sill"], facing=OPP[side], half="bottom")

# =========================================================================================================
# Farm buildings (tier 3)
# =========================================================================================================
def frost_barn(seed, rnd, roof=None):
    """A Frostmarch byre on the skill (review/specs/rimehold_barn.json): low dark stone walls, plank rows above, a very
    steep roof with dragon heads, big cart doors, hay inside."""
    bp = _skill("rimehold_barn.json", f"rimehold_barn_{seed}", "barn", None)
    if roof:
        S = ROOF_SETS["frost"].get(roof)
        if S and roof != "dark":                 # the spec is in dark shingle; swap it for the town's colour
            for k, (n, p) in list(bp.cells.items()):
                if n in ("dark_oak_stairs", "spruce_stairs") and k[1] > 6: bp.cells[k] = (S[0], p)
    return bp

def frost_barn_kit(seed, rnd, roof=None):
    """A Frostmarch byre: low dark stone walls, plank rows above, a very steep roof down to head height, cart doors."""
    P = frost_P(seed); bp = Blueprint(f"rimehold_barn_{seed}")
    B = Building(bp, P, seed)
    w, d = rnd.choice([(9, 11), (9, 13), (11, 13)]); W, D = w - 1, d - 1; r = (0, 0, W, D)
    B.foundation(grow(r, "nsew"), 0); B.floor(r, 0, "coarse_dirt")
    B.stone_storey(r, 1, 2, quoins=False); B.timber_storey(r, 3, 3, bay=4)
    B.roof(r, "z", 5, overhang=1, verge=1, pitch=2); B.build_roofs(); B.gable_walls(r, "z", 5)
    xd = W // 2
    for x in range(xd - 1, xd + 2):
        for y in range(1, 5): bp.set(x, y, D, "air")
    for y in range(1, 5):
        for x in (xd - 2, xd + 2): bp.set(x, y, D, "dark_oak_log", axis="y")
    for x in range(xd - 2, xd + 3): bp.set(x, 5, D, "dark_oak_log", axis="x")
    for z in range(1, 5):
        for x in range(1, W):
            if h3(x, 0, z, seed) < 0.5: bp.set(x, 1, z, "hay_block", axis="y")
    bp.set(xd - 3, 1, D + 1, "hay_block", axis="y"); bp.set(W + 1, 1, 2, "spruce_log", axis="z")
    bp.set(W + 1, 2, 2, "spruce_log", axis="z"); bp.set(W + 1, 1, 3, "spruce_log", axis="z")
    door_marker(bp, xd, 1, D + 1)
    if roof: recolour_roof(bp, "frost", roof, seed)
    return finish(bp, P, "frost", "barn")

def salt_store(seed, rnd, roof=None, name="gulls_rest_store"):
    """A harbour net store / farm store: stone below, white boards above, low hipped roof, a hoist beam over a loft door."""
    P = salt_P(seed); bp = Blueprint(f"{name}_{seed}")
    B = Building(bp, P, seed)
    w, d = rnd.choice([(9, 11), (9, 9), (11, 9)]); W, D = w - 1, d - 1; r = (0, 0, W, D)
    B.foundation(grow(r, "nsew"), 0); B.floor(r, 0, "spruce_planks")
    B.stone_storey(r, 1, 4, quoins=True); B.floor(r, 5); B.timber_storey(r, 5, 4, bay=4, infill="birch_planks")
    pyramid(bp, P, -1, -1, W + 1, D + 1, 9, pitch=1, finial=None)
    xd = W // 2
    for x in range(xd - 1, xd + 2):
        for y in range(1, 4): bp.set(x, y, D, "air")
    for x in (xd - 1, xd + 1): bp.set(x, 3, D, "smooth_sandstone_stairs", facing="e" if x < xd else "w", half="top")
    bp.set(xd, 6, D, "air"); bp.set(xd, 7, D, "air"); bp.set(xd, 8, D + 1, "stripped_oak_log", axis="z")
    bp.set(xd, 7, D + 1, "iron_chain"); bp.set(xd, 6, D + 1, "barrel")
    for (x, z) in ((1, 1), (2, 1), (1, 2), (W - 1, 1)): bp.set(x, 1, z, "barrel")
    bp.set(W - 1, 1, D - 1, "dried_kelp_block"); bp.set(W - 1, 2, D - 1, "dried_kelp_block")
    door_marker(bp, xd, 1, D + 1)
    if roof: recolour_roof(bp, "salt", roof, seed)
    return finish(bp, P, "salt", "barn")

def fen_store(seed, rnd, roof=None, name="mirelight_store"):
    """A Blackfen barn or store on short stilts: mud and mangrove, a thatch roof (hay with dark oak edges)."""
    P = fen_P(seed); bp = Blueprint(f"{name}_{seed}")
    B = Building(bp, P, seed)
    w, d = rnd.choice([(9, 11), (9, 9)]); W, D = w - 1, d - 1; r = (0, 0, W, D)
    for x in (0, W // 2, W):
        for z in (0, D // 2, D): bp.set(x, 0, z, "mangrove_log", axis="y")
    B.floor(grow(r, "nsew"), 1, "mangrove_planks")
    for x in range(0, W + 1):
        for z in range(0, D + 1): bp.set(x, 1, z, "mangrove_planks")
    B.timber_storey(r, 1, 5, bay=4)
    thatch_roof(B, r, 6)
    xd = W // 2
    for x in range(xd - 1, xd + 2):
        for y in range(2, 5): bp.set(x, y, D, "air")
    for x in range(xd - 1, xd + 2): bp.set(x, 1, D + 1, "mangrove_slab", half="top")
    for z in range(1, 4):
        for x in range(1, W):
            if h3(x, 0, z, seed) < 0.45: bp.set(x, 2, z, "hay_block", axis="y")
    for (x, z) in ((1, D - 1), (W - 1, D - 1)): bp.set(x, 2, z, "barrel")
    door_marker(bp, xd, 1, D + 2)
    return finish(bp, P, "fen", "barn")

def thatch_roof(B, r, y, ridge="z", pitch=1):
    """Thatch: hay blocks on the slopes, dark oak stairs along the eaves and verges, a moss ridge."""
    mats = dict(roof="dark_oak_stairs", roof_block="moss_block", roof_slab="moss_carpet")
    B.roof(r, ridge, y, overhang=1, verge=1, pitch=pitch, mats=mats); B.build_roofs(); B.gable_walls(r, ridge, y)
    bp = B.bp
    for (x, z), (hh, i) in B.H.items():
        n, p = bp.get(x, hh, z)
        edge = (x, z) not in B.H or any((x + dx, z + dz) not in B.H for dx, _, dz in DIRS.values())
        if n == "dark_oak_stairs" and not edge and hh > y: bp.set(x, hh, z, "hay_block", axis="y")

def ember_granary(seed, rnd):
    """A Sunscar granary: a squat flat-roofed mud-and-sandstone store, a walled yard, hay under an awning."""
    P = ember_P(seed); bp = Blueprint(f"sunscar_granary_{seed}")
    B = Building(bp, P, seed)
    w, d = rnd.choice([(9, 11), (11, 11)]); W, D = w - 1, d - 1; r = (0, 0, W, D - 4)
    B.foundation(grow((0, 0, W, D), "nsew"), 0); B.floor(r, 0, "coarse_dirt")
    B.stone_storey(r, 1, 5, quoins=False)
    for x in range(1, W):
        for z in range(1, D - 4): bp.set(x, 5, z, "smooth_sandstone")
    for x in range(0, W + 1):
        for z in (0, D - 4): bp.set(x, 6, z, "smooth_sandstone_slab", half="bottom")
    for z in range(0, D - 3):
        for x in (0, W): bp.set(x, 6, z, "smooth_sandstone_slab", half="bottom")
    for x in range(0, W + 1):            # yard wall in front
        bp.set(x, 1, D, "sandstone_wall")
    for z in range(D - 4, D + 1): bp.set(0, 1, z, "sandstone_wall"); bp.set(W, 1, z, "sandstone_wall")
    xd = W // 2; bp.set(xd, 1, D, "air"); bp.set(xd - 1, 2, D, "sandstone_wall"); bp.set(xd + 1, 2, D, "sandstone_wall")
    for y in (1, 2, 3): bp.set(xd, y, D - 4, "air")
    for x in range(1, 4):
        for y in (1, 2): bp.set(x, y, D - 3, "hay_block", axis="y")
    for x in range(0, 5): bp.set(x, 4, D - 3, "orange_carpet" if x % 2 else "white_carpet")
    for x in range(1, W, 2): bp.set(x, 4, D - 3, "spruce_log", axis="z")
    bp.set(W - 1, 1, D - 2, "decorated_pot"); bp.set(W - 2, 1, D - 2, "barrel")
    door_marker(bp, xd, 1, D + 1)
    return finish(bp, P, "ember", "barn")

HOUSES = {"frost": frost_house, "salt": salt_house, "fen": fen_house, "ember": ember_house}

# =========================================================================================================
# Shared square buildings: inn, smithy, store (pitched regions)
# =========================================================================================================
def _gable_hall(region, name, seed, w, d, storeys, civic=False, hip=False, roof=None):
    """A plain two-storey range for the regional inn and store: stone ground storey, timber or stone upper."""
    P = PALETTES[region](seed, civic)
    if roof: P.update(dict(zip(("roof", "roof_slab", "roof_block", "roof_ladder"), ROOF_SETS[region][roof])))
    if name.endswith("_inn"): P["spikes"] = 5
    bp = Blueprint(name); B = Building(bp, P, seed)
    W, D = w - 1, d - 1; r = (0, 0, W, D)
    B.foundation(grow(r, "nsew"), 0); B.floor(r, 0)
    B.stone_storey(r, 1, 4); y = 5
    for k in range(storeys - 1):
        B.floor(r, y); B.timber_storey(r, y, 5, bay=4); B.bay_windows(r, y, "sewn"); y += 5
    if hip: pyramid(bp, P, -1, -1, W + 1, D + 1, y, pitch=1, finial=None)
    else:
        B.roof(r, "x", y, overhang=1, verge=1, pitch=P.get("pitch", 1) if D <= 6 else 1); B.build_roofs(); B.gable_walls(r, "x", y)
    return bp, B, P, W, D, y

def inn(region, seed=21, roof=None):
    """The town inn: a long two-storey range with the door in the middle of the street front, a tap room with a
    bar and hearth below and bedrooms above (the only furnished building), a hanging lantern sign bracket."""
    town = {"frost": "rimehold", "salt": "gulls_rest", "fen": "mirelight"}[region]
    bp, B, P, W, D, y = _gable_hall(region, f"{town}_inn", seed, 15, 9, 2, hip=region == "salt",
                                    roof=roof or {"frost": "dark", "salt": "orange", "fen": "moss"}[region])
    for wx in (2, 4, 10, 12): B.window(wx, 2, D, "s", 1, 2, kind="stone")
    for wx in (3, 11): B.window(wx, 2, 0, "n", 1, 2, kind="stone")
    B.door(7, 1, D, "s", canopy=True, lanterns=True)
    bp.set(9, 4, D + 1, P["trim"], facing="n", half="top"); bp.set(9, 4, D + 2, P["fence"]); bp.set(9, 3, D + 2, "lantern", hanging=True)
    # tap room
    F.bar(bp, 2, 5, 1, 3, "s"); F.hearth(bp, 12, 1, 1, "s")
    for (x, z) in ((10, 5), (12, 6)): F.table(bp, x, 1, z, chairs="ew")
    F.table(bp, 3, 1, 6, chairs="ew")
    for (x, z) in ((4, 4), (11, 4)): F.lantern_ceiling(bp, x, 4, z)
    F.stair_flight(bp, 1, 1, 1, 5, "e")
    # bedrooms
    F.partition(bp, 7, 1, 7, D - 1, 6, 9)
    for (x, z, hd) in ((9, 2, "n"), (12, 2, "n"), (9, 6, "s"), (3, 6, "s")): F.bed(bp, x, 6, z, hd)
    for (x, z) in ((10, 4), (4, 4)): F.lantern_ceiling(bp, x, 9, z)
    bp.set(7, 6, 4, P["door"], facing="e"); bp.set(7, 7, 4, P["door"], facing="e", upper=True)
    B.chimney(12, -1, 1, top=y + 7 if region == "salt" else None)
    for x in (0, W):
        bp.set(x + (-1 if x == 0 else 1), 1, D, "barrel")
    bp.markers["innkeeper"] = (3, 1, 2)
    door_marker(bp, 7, 1, D + 1)
    if region == "fen": moss_roof(bp, "dark_oak_stairs", "dark_oak_planks", "dark_oak_slab", seed)
    return finish(bp, P, region, "inn")

def smithy(region, seed=23, roof=None):
    """The smithy: a stone forge house with a big chimney and an open-fronted workshop under a lean-to on posts:
    anvil, grindstone, blast furnace, a water trough (cauldron), a rack of iron (vanilla iron only)."""
    town = {"frost": "rimehold", "salt": "gulls_rest", "fen": "mirelight"}[region]
    P = PALETTES[region](seed)
    if roof: P.update(dict(zip(("roof", "roof_slab", "roof_block", "roof_ladder"), ROOF_SETS[region][roof])))
    else: P.update(dict(zip(("roof", "roof_slab", "roof_block", "roof_ladder"), ROOF_SETS[region][{"frost": "slate", "salt": "slate", "fen": "mud"}[region]])))
    bp = Blueprint(f"{town}_smithy"); B = Building(bp, P, seed)
    house = (0, 0, 6, 8); W, D = 6, 8
    B.foundation(grow((0, 0, 12, 8), "nsew"), 0); B.floor(house, 0, "polished_andesite" if region != "frost" else "polished_deepslate")
    B.stone_storey(house, 1, 5)
    B.roof(house, "z", 6, overhang=1, verge=1, pitch=P.get("pitch", 1)); B.build_roofs(); B.gable_walls(house, "z", 6, style="stone")
    B.window(3, 2, 0, "n", 1, 2, kind="stone"); B.window(0, 2, 4, "w", 1, 2, kind="stone")
    B.door(3, 1, D, "s", canopy=True, lanterns=True)
    # lean-to workshop on the east side: open front, posts, a pent roof falling east
    for z in (0, 4, 8):
        for yy in range(1, 5): bp.set(12, yy, z, P["frame"], axis="y")
    for z in range(-1, 10):
        for k, x in enumerate(range(7, 14)):
            yy = 6 - k // 2
            bp.set(x, yy, z, P["roof"], facing="w", half="bottom") if k % 2 == 1 or x == 13 else bp.set(x, yy, z, P["roof_slab"], half="top")
    for x in range(7, 13):
        for z in range(1, 8): bp.set(x, 0, z, "cobblestone" if h3(x, 0, z, seed) < 0.6 else "gravel")
    for z in range(1, D):
        for yy in (1, 2, 3): bp.set(6, yy, z, P["stone"])
    bp.set(6, 1, 4, "air"); bp.set(6, 2, 4, "air")
    bp.set(9, 1, 3, "anvil", facing="e"); bp.set(11, 1, 6, "grindstone", facing="n"); bp.set(7, 1, 1, "blast_furnace", facing="e")
    bp.set(7, 1, 2, "smithing_table"); bp.set(11, 1, 1, "water_cauldron"); bp.set(7, 1, 7, "barrel"); bp.set(8, 1, 7, "iron_block")
    for z in (2, 3): bp.set(7, 2, z, "dark_oak_trapdoor" if region == "frost" else "spruce_trapdoor", facing="e", half="top")
    bp.set(9, 4, 3, "iron_chain"); bp.set(9, 3, 3, "lantern", hanging=True)
    # the forge inside: a hearth of stone round a campfire under a 2x2 chimney
    for x in (1, 2):
        for z in (1, 2): bp.set(x, 1, z, "campfire" if (x, z) == (1, 1) else ("deepslate_bricks" if region == "frost" else "brick_block"))
    B.chimney(1, -1, 1, w=2, d=1)
    bp.set(5, 1, 1, "furnace", facing="s"); bp.set(5, 1, 2, "chest", facing="w")
    door_marker(bp, 3, 1, D + 1)
    bp.markers["smith"] = (9, 1, 4)
    return finish(bp, P, region, "smithy")

def store(region, seed=25, roof=None):
    """The general store: a narrow, tall shop with a 3-wide shop window either side of the door, crates and
    barrels out front, the shopkeeper's rooms above."""
    town = {"frost": "rimehold", "salt": "gulls_rest", "fen": "mirelight"}[region]
    if region == "fen": return fen_store(seed, random.Random(seed), name="mirelight_general_store")
    bp, B, P, W, D, y = _gable_hall(region, f"{town}_store", seed, 9, 11, 2, hip=region == "salt",
                                    roof=roof or {"frost": "mid", "salt": "green"}[region])
    for wx in (1, 5): B.window(wx, 2, D, "s", 3, 2, kind="stone")
    B.door(4, 1, D, "s", canopy=False, lanterns=True)
    for x in range(0, W + 1): bp.set(x, 4, D + 1, P["trim"], facing="n", half="bottom")
    for x in (0, W): bp.set(x, 1, D + 2, "barrel"); bp.set(x, 2, D + 2, "barrel") if x == 0 else None
    bp.set(1, 1, D + 2, "composter" if region == "frost" else "barrel")
    for z in range(2, D - 1): bp.set(1, 1, z, "barrel") if z % 2 else bp.set(1, 1, z, "chest", facing="e")
    for x in range(3, 7): bp.set(x, 1, 3, P["trim_block"])
    bp.set(4, 1, 2, "lectern", facing="s"); F.lantern_ceiling(bp, 4, 4, 5)
    F.stair_flight(bp, W - 1, D - 2, 1, 5, "n")
    door_marker(bp, 4, 1, D + 1); bp.markers["shopkeeper"] = (4, 1, 2)
    return finish(bp, P, region, "store")

# =========================================================================================================
# Rimehold civic: the longhouse hall and the stave chapel
# =========================================================================================================
def _skill(fname, name, kind, door, markers=()):
    """A civic building on the skill (the one engine, review/specs/<fname>), moved into this module's frame: the
    door at x 0 on the z 0 wall, the building towards -z, door marker one out. door = the door cell in the spec."""
    import json, os, sys
    here = os.path.dirname(os.path.abspath(__file__))
    sk = os.path.join(here, "..", "..", ".claude", "skills", "minecraft-builder", "scripts")
    if sk not in sys.path: sys.path.insert(0, sk)
    import engine
    spec = json.load(open(os.path.join(here, "review", "specs", fname)))
    raw = Blueprint(name); engine.into_blueprint(raw, spec)
    if door is None:                             # the front door: the lowest door cell facing +z, nearest the middle
        ds = [(y, -z, abs(x), (x, y, z)) for (x, y, z), (n, p) in raw.cells.items() if n.endswith("_door") and not p.get("upper") and p.get("facing") == "s"]
        door = min(ds)[3] if ds else (0, 2, max(z for (x, y, z) in raw.cells))
    dx, dy, dz = door
    bp = Blueprint(name)
    for (x, y, z), v in raw.cells.items(): bp.cells[(x - dx, y, z - dz)] = v
    door_marker(bp, 0, dy, 1)
    for k, (x, y, z) in markers: bp.markers[k] = (x - dx, y, z - dz)
    bp.kind = kind
    return bp

def rimehold_hall(seed=31):
    """The longhouse hall on the skill (review/specs/gen_rimehold.py): dark stone course, plank rows in a dark oak
    frame, a steep weathered copper roof with dragon heads, a shingle gallery skirt on posts, a ridge lantern."""
    return _skill("rimehold_hall.json", "rimehold_hall", "hall", (4, 2, 12), [("jarl", (4, 2, 1))])

def rimehold_chapel(seed=33):
    """The stave chapel on the skill (review/specs/gen_rimehold.py, towers/README.md Frostmarch row)."""
    return _skill("rimehold_chapel.json", "rimehold_chapel", "chapel", (4, 2, 14))


def rimehold_hall_kit(seed=31):
    """Rimehold's longhouse: a stone course and plank rows in a dark frame, a steep weathered-copper roof with a
    gallery skirt roof round it, crossed dragon heads on both gables, a ridge lantern tower, light blue glass."""
    P = frost_P(seed, civic=True); P.update(roof=WEATHERED[0], roof_block="waxed_oxidized_cut_copper",
                                         roof_slab="waxed_oxidized_cut_copper_slab", roof_ladder=WEATHERED, frame="dark_oak_log")
    P["spikes"] = 5
    bp = Blueprint("rimehold_hall"); B = Building(bp, P, seed)
    r = (-4, -14, 4, 0)
    B.foundation(grow(r, "nsew", 2), 0); B.floor(r, 0)
    B.stone_storey(r, 1, 2, quoins=True)
    B.timber_storey(r, 3, 4, bay=4)
    for z in (-3, -7, -11):
        for x, sd in ((4, "e"), (-4, "w")): B.window(x, 4, z, sd, 1, 2)
    skirt(bp, P, r, 5, width=2, posts=4, mat=WEATHERED[0])
    B.roof(r, "z", 7, overhang=1, verge=1, pitch=2); B.build_roofs(); B.gable_walls(r, "z", 7, style="timber")
    apex_f = B.H[(0, 0)][0]; apex_b = B.H[(0, -14)][0]
    dragon_heads(bp, 0, apex_f + 1, 1 + 1); dragon_heads(bp, 0, apex_b + 1, -14 - 1 - 1)
    B.door(0, 1, 0, "s", canopy=False, lanterns=False, frame="dark_oak_log")
    for x in (-1, 1): bp.set(x, 1, 0, "dark_oak_log", axis="y"); bp.set(x, 2, 0, "dark_oak_log", axis="y")
    for x in (-2, 2):
        for yy in (1, 2, 3): bp.set(x, yy, 2, "dark_oak_log", axis="y")
    B.window(0, 9, 0, "s", 1, 2)
    # ridge lantern tower: a little square tower with light blue glass and a steep spire
    tz = -7; base = B.H[(0, tz)][0]
    for x in range(-1, 2):
        for z in range(tz - 1, tz + 2):
            for yy in range(base, base + 3):
                edge = abs(x) == 1 or abs(z - tz) == 1
                corner = abs(x) == 1 and abs(z - tz) == 1
                bp.set(x, yy, z, ("dark_oak_log" if corner else P["pane"] if yy == base + 1 else "spruce_planks") if edge else "air",
                       **({"axis": "y"} if corner else {}))
    pyramid(bp, P, -2, tz - 2, 2, tz + 2, base + 3, pitch=2, finial="lightning_rod")
    # inside: long hearth down the middle, benches along the walls, the jarl's seat at the back
    for z in range(-10, -3):
        bp.set(0, 0, z, "polished_deepslate"); bp.set(0, 1, z, "campfire") if z in (-9, -5) else bp.set(0, 1, z, "cobbled_deepslate_slab", half="bottom")
    for z in range(-12, -1):
        for x in (-3, 3): bp.set(x, 1, z, "spruce_stairs", facing="e" if x < 0 else "w")
    bp.set(0, 1, -13, "dark_oak_stairs", facing="s"); bp.markers["jarl"] = (0, 1, -13)
    for x in (-1, 1): bp.set(x, 1, -13, "dark_oak_log", axis="y"); bp.set(x, 2, -13, "lantern")
    for z in (-4, -8, -12):
        for x in (-3, 3): bp.set(x, 4, z, "air")
    door_marker(bp, 0, 1, 1)
    return finish(bp, P, "frost", "hall")

def rimehold_chapel_kit(seed=33):
    """The stave chapel: a tall narrow nave and a lower apse, a gallery skirt roof all round on posts, three
    tiers of steep roofs climbing to a spire, dragon heads on every gable peak, stained glass in cyan, blue
    and white."""
    P = frost_P(seed, civic=True); P.update(roof=WEATHERED[0], roof_block="waxed_oxidized_cut_copper",
                                         roof_slab="waxed_oxidized_cut_copper_slab", roof_ladder=WEATHERED, frame="dark_oak_log",
                                         infill_ladder=FRO_PLANK)
    glass = lambda x, y, z: (["cyan_stained_glass_pane", "blue_stained_glass_pane", "white_stained_glass_pane"][int(h3(x, y, z, 5) * 3)], {})
    P["pane"] = glass
    bp = Blueprint("rimehold_stave_chapel"); B = Building(bp, P, seed)
    nave = (-3, -10, 3, 0); apse = (-2, -14, 2, -10)
    B.foundation(grow(nave, "nsew", 2), 0); B.foundation(grow(apse, "nsew", 2), 0)
    B.floor(nave, 0); B.floor(apse, 0)
    B.stone_storey(nave, 1, 1, quoins=False); B.stone_storey(apse, 1, 1, quoins=False)
    B.timber_storey(nave, 2, 7, bay=4); B.timber_storey(apse, 2, 4, bay=4)
    for yy in range(2, 6):
        for x in range(-1, 2): bp.set(x, yy, -10, "air")
    for z in (-3, -7):
        for x, sd in ((3, "e"), (-3, "w")): B.window(x, 4, z, sd, 1, 3)
    B.window(2, 3, -12, "e", 1, 2); B.window(-2, 3, -12, "w", 1, 2)
    skirt(bp, P, nave, 4, width=2, posts=4, mat=WEATHERED[0])
    B.roof(nave, "z", 9, overhang=1, verge=1, pitch=2); B.roof(apse, "z", 6, overhang=1, verge=1, pitch=2)
    B.build_roofs(); B.gable_walls(nave, "z", 9); B.gable_walls(apse, "z", 6)
    apex = B.H[(0, 0)][0]
    dragon_heads(bp, 0, apex + 1, 2); dragon_heads(bp, 0, B.H[(0, -14)][0] + 1, -16)
    B.door(0, 1, 0, "s", canopy=False, lanterns=True, frame="dark_oak_log")
    B.window(0, 11, 0, "s", 1, 2)
    # tiered tower on the ridge, three steps up to a needle spire
    tz = -5; base = B.H[(0, tz)][0] - 1; half = 2
    for t in range(3):
        for x in range(-half, half + 1):
            for z in range(tz - half, tz + half + 1):
                for yy in range(base, base + 3):
                    edge = abs(x) == half or abs(z - tz) == half; corner = abs(x) == half and abs(z - tz) == half
                    bp.set(x, yy, z, ("dark_oak_log" if corner else "spruce_planks") if edge else "air", **({"axis": "y"} if corner else {}))
        for (x, z) in ((0, tz + half), (0, tz - half), (half, tz), (-half, tz)): bp.set(x, base + 1, z, "white_stained_glass_pane")
        pyramid(bp, P, -half - 1, tz - half - 1, half + 1, tz + half + 1, base + 3, pitch=1 if t < 2 else 2, finial=None if t < 2 else "lightning_rod")
        if t < 2:
            base += 4; half = max(1, half - 1) if t == 0 else 1
    # inside: benches facing the apse, an altar with candles
    for z in range(-8, -1, 2):
        for x in (-2, -1, 1, 2): bp.set(x, 1, z, "spruce_stairs", facing="s")
    bp.set(0, 1, -12, "polished_deepslate"); bp.set(0, 2, -12, "candle", candles=3, lit=True)
    for x in (-1, 1): bp.set(x, 1, -13, "lantern")
    door_marker(bp, 0, 1, 1)
    return finish(bp, P, "frost", "chapel")

# =========================================================================================================
# Gull's Rest shore: harbour quay, lighthouse, boathouse (water behind, at -z)
# =========================================================================================================
def _piles(bp, x, z, top, mat="stripped_oak_log", depth=4):
    for y in range(-depth, top + 1): bp.set(x, y, z, mat, axis="y")

def gulls_rest_quay(seed=41):
    """The harbour quay: a stone quay wall along the water with mooring bollards and a timber jetty running
    out on piles, a cargo crane, stacked barrels and nets, and the harbourmaster's hut on the land side."""
    P = salt_P(seed, civic=True); P.update(dict(zip(("roof", "roof_slab", "roof_block", "roof_ladder"), ROOF_SETS["salt"]["green"])))
    bp = Blueprint("gulls_rest_quay"); B = Building(bp, P, seed)
    # stone quay: land from z=0 to 6, quay face at z=0 dropping into the water
    for x in range(-7, 8):
        for z in range(0, 7):
            bp.set(x, 0, z, "smooth_sandstone" if (x + z) % 5 else "cut_sandstone")
            for y in range(-4, 0): bp.set(x, y, z, "stone_bricks" if z == 0 else "cobblestone")
        bp.set(x, 0, 0, "smooth_sandstone_slab", half="top") if x % 4 else bp.set(x, 1, 0, "stone_brick_wall")
    for x in (-6, -2, 2, 6): bp.set(x, 1, 1, "stone_brick_wall"); bp.set(x, 2, 1, "air")
    # timber jetty out over the water
    for z in range(-9, 0):
        for x in range(-1, 2): bp.set(x, 0, z, "spruce_slab", half="top")
        if z % 3 == 0:
            for x in (-2, 2): _piles(bp, x, z, 1); bp.set(x, 2, z, "lantern") if z == -9 else None
    for z in range(-9, 0):
        for x in (-2, 2):
            if z % 3: bp.set(x, 0, z, "spruce_slab", half="top"); bp.set(x, 1, z, "spruce_fence")
    # crane on the quay: a post, a jib out over the water, a chain and a hanging crate
    for y in range(1, 7): bp.set(5, y, 2, "dark_oak_log", axis="y")
    for z in range(-2, 3): bp.set(5, 7, z, "dark_oak_log", axis="z")
    bp.set(5, 6, 1, "dark_oak_fence"); bp.set(5, 6, -2, "iron_chain"); bp.set(5, 5, -2, "iron_chain"); bp.set(5, 4, -2, "barrel")
    for (x, z, n) in ((3, 4, "barrel"), (3, 5, "barrel"), (4, 5, "barrel"), (3, 4, None), (-6, 3, "barrel"), (-6, 4, "barrel"), (-5, 4, "dried_kelp_block")):
        if n: bp.set(x, 1, z, n)
    bp.set(3, 2, 5, "barrel"); bp.set(-6, 2, 4, "dried_kelp_block")
    # harbourmaster's hut on the land side, door to the street (+z)
    hut = (-5, 6, 1, 12)
    B.foundation(grow(hut, "nsew"), 0); B.floor(hut, 0)
    B.stone_storey(hut, 1, 4)
    B.window(-2, 2, 6, "n", 1, 2, kind="stone"); B.window(-5, 2, 9, "w", 1, 2, kind="stone"); B.window(1, 2, 9, "e", 1, 2, kind="stone")
    B.door(-2, 1, 12, "s", canopy=True, lanterns=True)
    pyramid(bp, P, -6, 5, 2, 13, 5, pitch=1, finial=None)
    bp.set(-4, 1, 7, "lectern", facing="s"); bp.set(0, 1, 7, "chest", facing="w"); bp.set(0, 1, 11, "barrel")
    for x in range(2, 8):
        for z in range(7, 13): bp.set(x, 0, z, "smooth_sandstone" if (x * 3 + z) % 4 else "cobblestone")
    bp.markers["water_edge"] = (0, 0, -1); bp.markers["harbourmaster"] = (-2, 1, 9)
    door_marker(bp, -2, 1, 13)
    return finish(bp, P, "salt", "quay")

def gulls_rest_lighthouse(seed=43):
    """The lighthouse: an octagonal white tower banded in teal on a stone base at the water's edge, a gallery
    on brackets, a glass lamp room with sea lanterns, an oxidized copper cap; the keeper's cottage on the land side."""
    P = salt_P(seed, civic=True); P.update(dict(zip(("roof", "roof_slab", "roof_block", "roof_ladder"), ROOF_SETS["salt"]["green"])))
    bp = Blueprint("gulls_rest_lighthouse"); B = Building(bp, P, seed)
    def octagon(r):
        return {(x, z) for x in range(-r, r + 1) for z in range(-r, r + 1) if abs(x) + abs(z) <= r + r // 2}
    cz = -2
    H = 22
    for y in range(-4, H + 1):
        r = 4 if y <= 2 else 3 if y <= 12 else 2
        ring = octagon(r); inner = octagon(r - 1)
        for (x, z) in ring:
            edge = (x, z) not in inner
            if y <= 0: bp.set(x, y, z + cz, "stone_bricks"); continue
            if edge:
                band = (y // 4) % 2 == 1 and y > 3
                n = ("dark_prismarine" if band else "smooth_quartz") if y > 2 else "stone_bricks"
                bp.set(x, y, z + cz, n)
            else: bp.set(x, y, z + cz, "air")
    for y in range(1, H):                                          # ladder up the inside, slit windows
        bp.set(0, y, cz - 1 if y > 12 else cz - 2, "ladder", facing="s")
    for y in (6, 10, 15, 19): bp.set(0 if y % 2 else 3 - (y > 12), y, cz + (3 - (y > 12)) if y % 2 else cz, "glass_pane")
    bp.set(0, 1, cz + 4, P["door"], facing="n"); bp.set(0, 2, cz + 4, P["door"], facing="n", upper=True); bp.set(0, 3, cz + 4, "cut_sandstone")
    # gallery on brackets and the lamp room
    g = H + 1
    for (x, z) in octagon(4):
        bp.set(x, g, z + cz, "smooth_quartz_slab", half="top")
        if (x, z) not in octagon(3): bp.set(x, g + 1, z + cz, "iron_bars")
    for (x, z) in octagon(3):
        if (x, z) not in octagon(2): bp.set(x, g - 1, z + cz, "smooth_quartz_stairs", facing="n" if z > 0 else "s", half="top") if abs(z) >= abs(x) else bp.set(x, g - 1, z + cz, "smooth_quartz_stairs", facing="w" if x > 0 else "e", half="top")
    for y in range(g + 1, g + 4):
        for (x, z) in octagon(2):
            bp.set(x, y, z + cz, "glass" if (x, z) not in octagon(1) else ("sea_lantern" if (x, z) == (0, 0) else "air"))
    for (x, z) in octagon(2): bp.set(x, g, z + cz, "smooth_quartz")
    bp.set(0, g + 1, cz, "sea_lantern"); bp.set(0, g + 2, cz, "sea_lantern")
    cap = pyramid(bp, P, -2, cz - 2, 2, cz + 2, g + 4, pitch=1, mat="waxed_oxidized_cut_copper_stairs", block="waxed_oxidized_cut_copper", finial="lightning_rod")
    # keeper's cottage, land side, door to the street
    hut = (-4, 3, 4, 9)
    B.foundation(grow(hut, "nsew"), 0); B.floor(hut, 0); B.stone_storey(hut, 1, 4)
    for x in range(-1, 2):
        for y in (1, 2): bp.set(x, y, 3, "air")
    B.window(-3, 2, 9, "s", 1, 2, kind="stone"); B.window(3, 2, 9, "s", 1, 2, kind="stone")
    B.door(0, 1, 9, "s", canopy=True, lanterns=True)
    B.roof(hut, "x", 5, overhang=1, verge=1, pitch=1); B.build_roofs(); B.gable_walls(hut, "x", 5, style="stone")
    bp.set(-3, 1, 4, "barrel"); bp.set(3, 1, 4, "chest", facing="w"); bp.set(3, 1, 8, "barrel")
    bp.markers["water_edge"] = (0, 0, cz - 4); bp.markers["keeper"] = (0, 1, 6)
    door_marker(bp, 0, 1, 10)
    return finish(bp, P, "salt", "lighthouse")

def gulls_rest_boathouse(seed=45):
    """The boathouse: a stone-walled shed straddling the shore, its back open over a water slip with a boat
    cradle and a winch, sea-green hipped roof, net loft above; the street door on the land side."""
    P = salt_P(seed, civic=True); P.update(dict(zip(("roof", "roof_slab", "roof_block", "roof_ladder"), ROOF_SETS["salt"]["green"])))
    bp = Blueprint("gulls_rest_boathouse"); B = Building(bp, P, seed)
    r = (-4, -8, 4, 6)
    B.foundation(grow((-4, 0, 4, 6), "nsew"), 0)
    for x in range(-4, 5):
        for z in range(-8, 0):
            for y in range(-4, 0): bp.set(x, y, z, "stone_bricks" if x in (-4, 4) else "water")
            bp.set(x, 0, z, "stone_bricks" if x in (-4, -3, 3, 4) else "water")
    B.floor((-4, 0, 4, 6), 0, "spruce_planks")
    B.stone_storey(r, 1, 4)
    for x in range(-2, 3):                     # the back stands open over the slip
        for y in range(1, 4): bp.set(x, y, -8, "air")
    for x in (-2, 2): bp.set(x, 4, -8, "smooth_sandstone_stairs", facing="e" if x < 0 else "w", half="top")
    for x in range(-2, 3):
        for z in range(-7, 0):
            for y in (1, 2, 3): bp.set(x, y, z, "air")
    for z in range(-7, 6, 4):                  # boat cradle rails down into the water
        for x in (-1, 1): bp.set(x, 0, z, "spruce_slab", half="top") if z >= 0 else None
    B.floor(r, 5, "spruce_planks")
    for x in range(-3, 4):
        for z in range(-6, 0): bp.set(x, 5, z, "air") if -2 <= x <= 2 else None
    pyramid(bp, P, -5, -9, 5, 7, 6, pitch=1, finial=None)
    for z in (-3, 2): B.window(-4, 2, z, "w", 1, 2, kind="stone"); B.window(4, 2, z, "e", 1, 2, kind="stone")
    B.door(0, 1, 6, "s", canopy=True, lanterns=True)
    bp.set(-3, 1, 1, "barrel"); bp.set(-3, 1, 2, "barrel"); bp.set(3, 1, 1, "dried_kelp_block"); bp.set(3, 1, 4, "chest", facing="w")
    bp.set(-3, 1, -2, "spruce_fence"); bp.set(-3, 2, -2, "iron_chain")
    for z in (-6, -3): bp.set(-3, 1, z, "spruce_slab", half="bottom"); bp.set(3, 1, z, "spruce_slab", half="bottom")
    bp.markers["water_edge"] = (0, 0, -1)
    door_marker(bp, 0, 1, 7)
    return finish(bp, P, "salt", "boathouse")

# =========================================================================================================
# Mirelight shore: stilt houses standing out over the black water
# =========================================================================================================
def mirelight_stilt_house(seed=51, tier=1, roof="moss"):
    """A Mirelight house set on the waterline: tall stilts, the back half over the water, a boardwalk landing
    and stair at the front on the land side, a little mooring platform behind."""
    rnd = random.Random(seed)
    bp = fen_house(seed, rnd, tier, roof=roof, stilt=4)
    lo, hi = bp.bounds()
    W = hi[0] if hi[0] < 10 else 8
    stilt = bp.markers["stilt"][1]
    D = bp.markers["door"][2] - 2 - stilt
    for x in range(1, 4):                     # mooring platform behind, a ladder down to the water
        bp.set(x, stilt - 2, -1, "mangrove_slab", half="top"); bp.set(x, stilt - 2, -2, "mangrove_slab", half="top")
    for y in range(-3, stilt - 2): bp.set(1, y, -2, "mangrove_log", axis="y"); bp.set(3, y, -2, "mangrove_log", axis="y")
    bp.set(3, stilt - 1, -2, "mangrove_fence"); bp.set(3, stilt, -2, "lantern")
    for (x, y, z), (n, p) in list(bp.cells.items()):
        if n == "mangrove_log" and y == 0 and z <= (D // 2):
            for yy in range(-3, 0): bp.set(x, yy, z, "mangrove_log", axis="y")     # stilts go down into the mire
    bp.markers["water_edge"] = (0, 0, D // 2)
    bp.name = f"mirelight_stilt_house_{seed}"
    return bp

# =========================================================================================================
# Sunscar: market hall, inn, smithy, store (flat roofs, domes)
# =========================================================================================================
def sunscar_market_hall(seed=61):
    """Sunscar's market hall: a square hall behind an arcade of pointed arches on the street front, a drum
    with windows carrying a blue-green dome (cyan terracotta, oxidized copper near the top, a gold finial),
    flat parapet roofs round it with corner kiosks, stalls under the arcade."""
    P = ember_P(seed, civic=True); P["sill"] = "smooth_sandstone_stairs"
    bp = Blueprint("sunscar_market_hall"); B = Building(bp, P, seed)
    r = (-7, -12, 7, 0)
    B.foundation(grow(r, "nsew"), 0); B.floor(r, 0, "cut_red_sandstone")
    B.stone_storey(r, 1, 7)
    for x in range(-6, 7):                 # an open arcade along the front wall: piers every 3rd block
        pier = (x + 6) % 3 == 0
        for y in range(1, 5): bp.set(x, y, 0, P["stone"] if pier else "air")
        if not pier:
            l = (x + 6) % 3
            bp.set(x, 4, 0, "smooth_sandstone_stairs", facing="w" if l == 1 else "e", half="top")
    for z in (-4, -8):
        for x, sd in ((7, "e"), (-7, "w")): lattice_window(B, x, 3, z, sd)
    for x in (-3, 3): lattice_window(B, x, 3, -12, "n")
    B.floor(r, 7, "smooth_sandstone")
    for x in range(-6, 7):
        for z in range(-11, 0): bp.set(x, 7, z, "smooth_sandstone")
    for x in range(-7, 8):
        for z in range(-12, 1):
            if x in (-7, 7) or z in (-12, 0): bp.set(x, 8, z, "sandstone_wall" if (x in (-7, 7) and z in (-12, 0)) else "smooth_sandstone_slab", half="bottom")
    for (cx, cz) in ((-7, 0), (7, 0), (-7, -12), (7, -12)):         # corner kiosks with little red domes
        for y in range(8, 11): bp.set(cx, y, cz, "cut_red_sandstone" if y < 10 else "smooth_red_sandstone")
        bp.set(cx, 11, cz, "red_sandstone_wall")
    # drum and dome over the middle
    top = drum(B, 0, -6, 3, 8, 4, windows=True)
    for x in range(-3, 4):
        for z in range(-9, -2): bp.set(x, top, z, "cut_sandstone") if abs(x) == 3 or z in (-9, -3) else None
    import math as _m
    R = 4
    for y in range(0, R + 2):
        for x in range(-R, R + 1):
            for z in range(-R, R + 1):
                d = _m.sqrt(x * x + z * z + (y * 1.15) ** 2)
                c = (x, top + 1 + y, z - 6)
                if R - 1 < d <= R + 0.3: bp.set(*c, "waxed_weathered_cut_copper" if y < 2 else "waxed_oxidized_cut_copper")
                elif d <= R - 1: bp.set(*c, "air")
    peak = max(y for (x, y, z) in bp.cells if x == 0 and z == -6 and bp.cells[(x, y, z)][0] != "air")
    bp.set(0, peak + 1, -6, "gold_block"); bp.set(0, peak + 2, -6, "lightning_rod")
    # stalls under the arcade, a fountain inside
    for (x, col) in ((-4, "orange"), (2, "red"), (5, "yellow")):
        bp.set(x, 1, -1, "barrel"); bp.set(x + 1, 1, -1, "acacia_slab", half="bottom")
    for (x, z) in ((-4, -6), (4, -6)):
        bp.set(x, 1, z, "barrel"); bp.set(x, 1, z - 1, "decorated_pot")
    for x in range(-1, 2):
        for z in range(-7, -4): bp.set(x, 1, z, "smooth_sandstone_slab", half="bottom") if (x, z) != (0, -6) else bp.set(x, 1, z, "water")
    bp.set(0, 2, -6, "sandstone_wall"); bp.set(0, 3, -6, "lantern")
    for z in (-3, -9):
        for x in (-4, 4): F.lantern_ceiling(bp, x, 6, z)
    bp.markers["merchant"] = (0, 1, -10)
    door_marker(bp, 0, 1, 1)
    return finish(bp, P, "ember", "market")

def _ember_block(B, P, r, h, roof_y=None):
    bp = B.bp
    B.foundation(grow(r, "nsew"), 0); B.floor(r, 0)
    B.stone_storey(r, 1, h)
    y = roof_y or h + 1
    x0, z0, x1, z1 = r
    for x in range(x0, x1 + 1):
        for z in range(z0, z1 + 1):
            if x0 < x < x1 and z0 < z < z1: bp.set(x, y - 1, z, "smooth_sandstone")
            elif bp.get(x, y, z)[0] in ("keep", "air"):
                bp.set(x, y, z, "sandstone_wall" if (x in (x0, x1) and z in (z0, z1)) else "smooth_sandstone_slab", half="bottom")
    for x in range(x0 + 1, x1, 2):
        bp.set(x, y - 2, z0 - 1, "spruce_log", axis="z"); bp.set(x, y - 2, z1 + 1, "spruce_log", axis="z")

def sunscar_inn(seed=63):
    """The caravanserai inn: a two-storey block round an open courtyard with a palm and a well, a tapering
    corner tower, a striped awning over the gate, rooms off a gallery upstairs."""
    P = ember_P(seed, civic=True)
    bp = Blueprint("sunscar_inn"); B = Building(bp, P, seed)
    r = (0, 0, 14, 12)
    B.foundation(grow(r, "nsew"), 0); B.floor(r, 0)
    B.stone_storey(r, 1, 8)
    court = (4, 3, 10, 9)
    for x in range(court[0], court[2] + 1):
        for z in range(court[1], court[3] + 1):
            for y in range(1, 10): bp.set(x, y, z, "air")
            bp.set(x, 0, z, "cut_red_sandstone" if (x + z) % 2 else "smooth_sandstone")
    for x in range(court[0] - 1, court[2] + 2):           # inner walls round the court, arches at ground level
        for z in (court[1] - 1, court[3] + 1):
            for y in range(1, 9): bp.set(x, y, z, P["stone"] if (y > 3 or (x - court[0]) % 3 == 2) else "air")
    for z in range(court[1] - 1, court[3] + 2):
        for x in (court[0] - 1, court[2] + 1):
            for y in range(1, 9): bp.set(x, y, z, P["stone"] if (y > 3 or (z - court[1]) % 3 == 2) else "air")
    B.floor(r, 5, "acacia_planks")
    for x in range(court[0] - 1, court[2] + 2):
        for z in range(court[1] - 1, court[3] + 2): bp.set(x, 5, z, "air") if court[0] <= x <= court[2] and court[1] <= z <= court[3] else None
    for x in range(court[0], court[2] + 1):
        for z in (court[1], court[3]): bp.set(x, 5, z, "acacia_slab", half="top"); bp.set(x, 6, z, "acacia_fence")
    for z in range(court[1], court[3] + 1):
        for x in (court[0], court[2]): bp.set(x, 5, z, "acacia_slab", half="top"); bp.set(x, 6, z, "acacia_fence")
    for x in range(1, 14):
        for z in range(1, 12):
            if not (court[0] - 1 <= x <= court[2] + 1 and court[1] - 1 <= z <= court[3] + 1): bp.set(x, 8, z, "smooth_sandstone")
    for x in range(0, 15):
        for z in range(0, 13):
            if x in (0, 14) or z in (0, 12): bp.set(x, 9, z, "sandstone_wall" if (x in (0, 14) and z in (0, 12)) else "smooth_sandstone_slab", half="bottom")
    for x in (2, 5, 9, 12):
        lattice_window(B, x, 2, 12, "s") if x not in (5, 9) else None
        lattice_window(B, x, 6, 12, "s"); lattice_window(B, x, 6, 0, "n")
    for z in (3, 9): lattice_window(B, 0, 6, z, "w"); lattice_window(B, 14, 6, z, "e")
    for x in range(6, 9):                                   # the gate: 3 wide, arched
        for y in range(1, 4):
            for z in range(0, 3): bp.set(x, y, z, "air")
    bp.set(6, 3, 0, "smooth_sandstone_stairs", facing="e", half="top"); bp.set(8, 3, 0, "smooth_sandstone_stairs", facing="w", half="top")
    for i, x in enumerate(range(5, 10)):
        bp.set(x, 4, 13, "orange_wool" if i % 2 == 0 else "white_wool"); bp.set(x, 4, 14, "orange_carpet" if i % 2 == 0 else "white_carpet")
    for x in (5, 9):
        for y in range(1, 4): bp.set(x, y, 14, "acacia_fence")
    # tapering corner tower
    for y in range(1, 15):
        hw = 2 if y < 10 else 1
        for x in range(-hw, hw + 1):
            for z in range(-hw, hw + 1):
                edge = abs(x) == hw or abs(z) == hw
                bp.set(13 + x - (hw - 1), y, 1 + z + (hw - 1) * 0, P["stone"] if edge else "air") if y >= 9 else None
    for y in range(9, 15):
        hw = 1
        for x in range(12, 15):
            for z in range(0, 3): bp.set(x, y, z, P["stone"] if (x in (12, 14) or z in (0, 2)) else "air")
    for x in range(11, 16):
        for z in range(-1, 4):
            if x in (11, 15) or z in (-1, 3): bp.set(x, 15, z, "smooth_sandstone_slab", half="bottom") if (x + z) % 2 else bp.set(x, 15, z, "sandstone_wall")
    for x in range(12, 15):
        for z in range(0, 3): bp.set(x, 15, z, "smooth_sandstone")
    bp.set(13, 12, 2, "orange_stained_glass_pane")
    # court: well and a palm in a planter
    bp.set(7, 1, 6, "water_cauldron"); bp.set(5, 1, 4, "decorated_pot")
    for y in range(1, 6): bp.set(9, y, 8, "jungle_log", axis="y")
    for (x, z) in ((8, 8), (10, 8), (9, 7), (9, 9), (8, 7), (10, 9)): bp.set(x, 6, z, "jungle_leaves", persistent=True)
    bp.set(9, 7, 8, "jungle_leaves", persistent=True)
    # tap room in the front range, beds upstairs
    for (x, z) in ((2, 5), (2, 9), (12, 6)): bp.set(x, 1, z, "barrel")
    F.bed(bp, 1, 6, 1, "n"); F.bed(bp, 3, 6, 1, "n"); F.bed(bp, 11, 6, 1, "n"); F.bed(bp, 1, 6, 11, "s"); F.bed(bp, 12, 6, 11, "s")
    F.stair_flight(bp, 1, 9, 1, 4, "n")
    bp.markers["innkeeper"] = (7, 1, 4)
    door_marker(bp, 7, 1, 13)
    return finish(bp, P, "ember", "inn")

def sunscar_smithy(seed=65):
    """The smithy: a walled forge yard behind a flat-roofed workshop, an open forge under a beam-and-awning
    shade, a squat chimney, an anvil, a quench trough and a rack of iron."""
    P = ember_P(seed)
    bp = Blueprint("sunscar_smithy"); B = Building(bp, P, seed)
    shop = (0, 0, 6, 8)
    _ember_block(B, P, shop, 5)
    B.door(3, 1, 8, "s", canopy=False, lanterns=True)
    lattice_window(B, 0, 2, 4, "w"); lattice_window(B, 3, 2, 0, "n")
    for x in range(7, 13):                                         # forge yard to the east
        bp.set(x, 1, 0, "sandstone_wall"); bp.set(x, 1, 8, "sandstone_wall") if x != 9 else None
        for z in range(1, 8): bp.set(x, 0, z, "coarse_dirt" if h3(x, 0, z, seed) < 0.5 else "smooth_sandstone")
    for z in range(0, 9): bp.set(12, 1, z, "sandstone_wall"); bp.set(12, 2, z, "sandstone_wall") if z % 4 == 0 else None
    for z in (1, 4): bp.set(6, 1, z + 1, "air"); bp.set(6, 2, z + 1, "air")
    for x in (7, 10):
        for y in (1, 2, 3): bp.set(x, y, 4, "acacia_fence")
    for x in range(6, 12):
        for z in range(1, 5): bp.set(x, 4, z, "acacia_slab", half="bottom")
    bp.set(8, 1, 2, "anvil", facing="e"); bp.set(10, 1, 2, "water_cauldron"); bp.set(7, 1, 1, "blast_furnace", facing="s")
    bp.set(11, 1, 1, "grindstone", facing="n"); bp.set(11, 1, 6, "iron_block"); bp.set(10, 1, 7, "barrel"); bp.set(7, 1, 7, "smithing_table")
    for y in range(1, 9): bp.set(1, y, 1, "sandstone" if y < 7 else "cut_sandstone")
    bp.set(1, 9, 1, "sandstone_wall"); bp.set(2, 1, 1, "furnace", facing="s"); bp.set(1, 1, 2, "campfire")
    door_marker(bp, 3, 1, 9); bp.markers["smith"] = (9, 1, 3)
    return finish(bp, P, "ember", "smithy")

def sunscar_store(seed=67):
    """The spice-and-cloth store: a two-storey flat-roofed shop, a deep arched shopfront under a long striped
    awning, pots and barrels out front, a roof terrace with a cloth shade."""
    P = ember_P(seed)
    bp = Blueprint("sunscar_store"); B = Building(bp, P, seed)
    r = (0, 0, 8, 10)
    _ember_block(B, P, r, 9)
    B.floor(r, 5)
    for x in range(1, 8):                    # arched shopfront
        for y in range(1, 4): bp.set(x, y, 10, "air") if x not in (4,) or y > 2 else None
    for x in range(1, 8): bp.set(x, 1, 10, "acacia_slab", half="top") if x not in (4,) else None
    bp.set(4, 1, 10, P["door"], facing="n"); bp.set(4, 2, 10, P["door"], facing="n", upper=True)
    for x in (1, 7): bp.set(x, 3, 10, "smooth_sandstone_stairs", facing="e" if x == 1 else "w", half="top")
    cols = ["red", "white"]
    for x in range(-1, 10):
        bp.set(x, 4, 11, f"{cols[x % 2]}_wool"); bp.set(x, 4, 12, f"{cols[x % 2]}_carpet")
    for x in (-1, 9):
        for y in (1, 2, 3): bp.set(x, y, 12, "acacia_fence")
    for x in (2, 6): lattice_window(B, x, 6, 10, "s"); lattice_window(B, x, 6, 0, "n")
    lattice_window(B, 0, 6, 5, "w"); lattice_window(B, 8, 6, 5, "e")
    for (x, z, n) in ((0, 11, "decorated_pot"), (1, 12, "barrel"), (8, 11, "decorated_pot"), (7, 12, "barrel")): bp.set(x, 1, z, n)
    for x in range(2, 7): bp.set(x, 1, 7, "acacia_planks")
    bp.set(1, 1, 2, "barrel"); bp.set(1, 2, 2, "barrel"); bp.set(7, 1, 2, "chest", facing="w")
    for x in range(1, 5):
        for z in range(6, 9): bp.set(x, 11, z, "yellow_carpet" if (x + z) % 2 else "white_carpet")
    for (x, z) in ((1, 6), (4, 6), (1, 8), (4, 8)):
        for y in (10,): bp.set(x, y, z, "acacia_fence")
    F.stair_flight(bp, 7, 8, 1, 4, "n")
    door_marker(bp, 4, 1, 11); bp.markers["shopkeeper"] = (4, 1, 6)
    return finish(bp, P, "ember", "store")

CIVIC = {
    "rimehold": [("hall", rimehold_hall), ("stave_chapel", rimehold_chapel),
                 ("inn", lambda: _skill("rimehold_inn.json", "rimehold_inn", "inn", None, [("innkeeper", (3, 2, 2))])),
                 ("smithy", lambda: _skill("rimehold_smithy.json", "rimehold_smithy", "smithy", None, [("smith", (10, 1, 4))])),
                 ("store", lambda: _skill("rimehold_store.json", "rimehold_store", "store", None, [("shopkeeper", (4, 2, 2))]))],
    "gulls_rest": [("inn", lambda: inn("salt")), ("smithy", lambda: smithy("salt")), ("store", lambda: store("salt"))],
    "sunscar": [("market_hall", sunscar_market_hall), ("inn", sunscar_inn), ("smithy", sunscar_smithy), ("store", sunscar_store)],
    "mirelight": [("inn", lambda: inn("fen")), ("smithy", lambda: smithy("fen")), ("store", lambda: store("fen"))],
}
SHORE = {
    "gulls_rest": [("quay", gulls_rest_quay), ("lighthouse", gulls_rest_lighthouse), ("boathouse", gulls_rest_boathouse)],
    "mirelight": [("stilt_house", lambda seed=51: mirelight_stilt_house(seed, 1)), ("stilt_house_big", lambda seed=52: mirelight_stilt_house(seed, 0))],
}
# the plank the generator lays Mirelight's boardwalks in (decks over water), and a well / mill per region are
# not made here: towngen falls back to the Vale ones
BOARDWALK = {"mirelight": ("mangrove_slab", "mangrove_planks", "mangrove_log", "mangrove_fence")}
