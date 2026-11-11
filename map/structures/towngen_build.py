"""Buildings for the town generator (towngen.py): cottages in many shapes, barns, windmills,
a well and a market cross, plus the roof palettes the generator mixes.

Every maker returns a Blueprint in the kit's frame: front faces south (+z), y = 0 is the floor
block (a full block at ground level), the door is at y = 1. bp.markers["door"] is the cell just
outside the front door, where the generator starts the walkway down to the street.
All sizes are odd (Mateo's rule), so ridges, doors and gables have a true centre.
"""
import random
from bp import Blueprint, DIRS, OPP
from kit import Building, VALE, mix, grow, h3, side_cells
import vale


class TownBuilding(Building):
    """Kit building that also knows hip roofs (ridge='hip': slopes on all four sides)."""
    def height(self, x, z):
        best, who = None, None
        for i, (r, ridge, base, pitch, mats, wall) in enumerate(self.roofs):
            if not (r[0] <= x <= r[2] and r[1] <= z <= r[3]): continue
            if ridge == "hip": d = min(x - r[0], r[2] - x, z - r[1], r[3] - z)
            elif ridge == "x": d = min(z - r[1], r[3] - z)
            else: d = min(x - r[0], r[2] - x)
            h = base + d * pitch
            if best is None or h > best: best, who = h, i
        return best, who

    def roof(self, rect, ridge, base, overhang=1, verge=1, pitch=1, mats=None):
        if ridge != "hip": return super().roof(rect, ridge, base, overhang, verge, pitch, mats)
        r = (rect[0] - overhang, rect[1] - overhang, rect[2] + overhang, rect[3] + overhang)
        self.roofs.append((r, "hip", base - overhang * pitch, pitch, mats or {}, tuple(rect)))


# ---- roofs -------------------------------------------------------------------------------
def _wood_roof(w, trim="spruce"):
    return dict(roof=f"{w}_stairs", roof_block=f"{w}_planks", roof_slab=f"{w}_slab",
                trim=f"{trim}_stairs", trim_block=f"{trim}_planks", trim_slab=f"{trim}_slab")

def copper_gradient(y_eave, y_ridge, seed):
    """Mateo's copper roof: waxed copper that runs from green (oxidized) at the ridge to bright
    orange at the eaves through the exposed and weathered stages, dithered so the bands blend."""
    stages = ("waxed_cut_copper", "waxed_exposed_cut_copper", "waxed_weathered_cut_copper", "waxed_oxidized_cut_copper")
    span = max(1, y_ridge - y_eave)
    def pick(suffix):
        def f(x, y, z):
            t = (y - y_eave) / span * 3.0 + (h3(x, y, z, seed) - 0.5) * 1.1
            name = stages[max(0, min(3, int(round(t))))]
            return name + suffix, {}
        return f
    return dict(roof=pick("_stairs"), roof_block=pick(""), roof_slab=pick("_slab"),
                trim="dark_oak_stairs", trim_block="dark_oak_planks", trim_slab="dark_oak_slab")

COPPER = ("waxed_cut_copper", "waxed_exposed_cut_copper", "waxed_weathered_cut_copper", "waxed_oxidized_cut_copper")

def recolour_copper(bp, seed):
    """Second pass over a copper roof once its real height is known: green (oxidized) over the
    top third, then weathered, exposed and bright copper down to the eaves, lightly dithered."""
    cells = [(k, v) for k, v in bp.cells.items() if "copper" in v[0]]
    if not cells: return
    ys = [k[1] for k, _ in cells]; y0, y1 = min(ys), max(ys)
    for (x, y, z), (n, p) in cells:
        t = (y - y0) / max(1, y1 - y0)
        st = 3 if t > 0.66 else int(t / 0.66 * 3 + (h3(x, y, z, seed) - 0.5) * 0.8)
        st = max(0, min(3, st))
        suf = "_stairs" if n.endswith("_stairs") else ("_slab" if n.endswith("_slab") else "")
        bp.cells[(x, y, z)] = (COPPER[st] + suf, p)

ROOFS = {
    "slate": dict(roof=VALE["roof"], roof_block="deepslate_tiles", roof_slab="deepslate_tile_slab",
                  trim="dark_oak_stairs", trim_block="dark_oak_planks", trim_slab="dark_oak_slab"),
    "dark_oak": _wood_roof("dark_oak", "spruce"),
    "spruce": _wood_roof("spruce", "dark_oak"),
    "mangrove": _wood_roof("mangrove", "dark_oak"),            # the warm red roofs of the reference town
    "brick": dict(roof=mix([("brick_stairs", 85), ("mud_brick_stairs", 15)], 71), roof_block="brick_block", roof_slab="brick_slab",
                  trim="spruce_stairs", trim_block="spruce_planks", trim_slab="spruce_slab"),
    "white": dict(roof="smooth_quartz_stairs", roof_block="smooth_quartz", roof_slab="smooth_quartz_slab",
                  trim="dark_oak_stairs", trim_block="dark_oak_planks", trim_slab="dark_oak_slab"),
    "copper": None,                                            # built per house (needs the roof's height)
}
# colour names used by build-instructions/palettes/towns.md -> roof sets here
COLOUR = {"slate": "slate", "dark shingle": "dark_oak", "mid shingle": "spruce", "warm red": "mangrove", "white": "white",
          "brick": "brick", "copper": "copper"}

ROOF_CELLS = {"stairs": ("deepslate_tile_stairs", "deepslate_brick_stairs", "cobbled_deepslate_stairs"),
              "block": ("deepslate_tiles",), "slab": ("deepslate_tile_slab",)}

def recolour_roof(bp, roof, seed=0):
    """Swap a slate-roofed building's roof for another colour. Every house is built with slate
    (deepslate appears nowhere else on Vale houses), so the town can pick colours afterwards."""
    if roof == "slate": return bp
    if roof == "copper":
        for k, (n, p) in list(bp.cells.items()):
            if n in ROOF_CELLS["stairs"]: bp.cells[k] = ("waxed_cut_copper_stairs", p)
            elif n in ROOF_CELLS["block"]: bp.cells[k] = ("waxed_cut_copper", p)
            elif n in ROOF_CELLS["slab"]: bp.cells[k] = ("waxed_cut_copper_slab", p)
        recolour_copper(bp, seed); return bp
    R = ROOFS[roof]
    for k, (n, p) in list(bp.cells.items()):
        x, y, z = k
        if n in ROOF_CELLS["stairs"]:
            r = R["roof"]; bp.cells[k] = ((r(x, y, z)[0] if callable(r) else r), p)
        elif n in ROOF_CELLS["block"]: bp.cells[k] = (R["roof_block"], p)
        elif n in ROOF_CELLS["slab"]: bp.cells[k] = (R["roof_slab"], p)
    return bp
# how often each roof turns up in a Vale town; copper is kept rare and for the richer houses
ROOF_WEIGHTS = {"slate": 30, "dark_oak": 22, "spruce": 16, "mangrove": 14, "brick": 10, "copper": 8}

def pick_roof(rnd, weights=ROOF_WEIGHTS):
    t = rnd.random() * sum(weights.values())
    for k, w in weights.items():
        t -= w
        if t < 0: return k
    return "slate"


# ---- cottages ----------------------------------------------------------------------------
WALLS = {   # ground-floor and frame looks (all Vale materials; the reference sheet's stone bases + timber)
    "stone": {},
    "cobble": dict(stone=mix([("cobblestone", 55), ("mossy_cobblestone", 25), ("andesite", 10), ("stone", 10)], 72)),
    "brick": dict(stone=mix([("brick_block", 80), ("mud_bricks", 10), ("stone_bricks", 10)], 73), quoin="stone_bricks"),
}
FRAMES = ["dark_oak_log", "dark_oak_log", "spruce_log", "stripped_spruce_log", "oak_log"]
INFILLS = [("calcite", 50), ("plank", 20), ("brick", 15), ("white", 15)]

def _infill(kind):
    return {"calcite": "calcite", "plank": mix([("spruce_planks", 70), ("stripped_spruce_log", 30)], 74),
            "brick": mix([("brick_block", 85), ("mud_bricks", 15)], 75), "white": "white_concrete_powder" if False else "smooth_quartz"}[kind]

def _weighted(rnd, table):
    t = rnd.random() * sum(w for _, w in table)
    for k, w in table:
        t -= w
        if t < 0: return k
    return table[-1][0]


def cottage(seed, width=7, depth=9, storeys=1, shape="front", ground="stone", roof="slate", pitch=1,
            walls="stone", wing=(5, 5), name=None):
    """A house facing south.
    shape: 'front' gable to the street (optional jetty), 'side' eaves to the street,
           'L' side-gabled main range with a gabled wing forward on one side,
           'hip' hipped roof all round.
    ground: 'stone' (stone ground floor, timber above) or 'timber' (framed from the plinth up)."""
    rnd = random.Random(seed)
    bp = Blueprint(name or f"tg_cottage_{seed}")
    P = dict(VALE)
    P.update(WALLS[walls])
    P["frame"] = rnd.choice(FRAMES)
    P["infill"] = _infill(_weighted(rnd, INFILLS))
    P["shutter"] = rnd.choice(["spruce_trapdoor", "dark_oak_trapdoor", "spruce_trapdoor"])
    P["door"] = rnd.choice(["spruce_door", "dark_oak_door", "spruce_door"])
    W, D = width - 1, depth - 1
    rect = (0, 0, W, D)
    masses = [(rect, "x" if shape in ("side", "L") else ("hip" if shape == "hip" else "z"))]
    if shape == "L":
        ww, wl = wing                                     # wing width (odd) and how far it comes forward
        right = rnd.random() < 0.5
        wx0 = W - ww + 1 if right else 0
        masses.append(((wx0, D, wx0 + ww - 1, D + wl), "z"))
    top = 1 + 4 * storeys                                  # roof base y
    yr = top + ((max(width, depth) + 1) // 2 + 1) * pitch
    mats = copper_gradient(top, yr, seed) if roof == "copper" else ROOFS[roof]
    P.update(mats)
    B = TownBuilding(bp, P, seed)
    jetty = shape == "front" and storeys == 2 and ground == "stone" and rnd.random() < 0.6
    for k, (r, ridge) in enumerate(masses):
        B.foundation(grow(r, "nsew"), 0)
        B.floor(r, 0)
        y = 1
        if ground == "stone":
            B.stone_storey(r, 1, 4); y = 5
            for side in ("s", "e", "w", "n"):
                cells = side_cells(*r, side)
                L = len(cells)
                for i in range(2, L - 2, 4 if L > 7 else 3):
                    if i == L // 2 and side == "s": continue     # the door goes in the middle of the front
                    cx, cz = cells[i]
                    B.window(cx, 2, cz, side, 1, 2, kind="stone")
            P["jamb"] = "stone_bricks"; P["lintel"] = "stone_bricks"
        else:
            B.timber_storey(r, 0, 5, bay=3 if (r[2] - r[0]) <= 6 else 4)
            B.bay_windows(r, 0, "sew" if k == 0 else "sew")
            y = 5
        up = grow(r, "s") if (jetty and k == 0) else r
        for s_ in range(storeys - 1):
            B.floor(up, y)
            B.timber_storey(up, y, 5, bay=3 if (up[2] - up[0]) <= 6 else 4)
            if jetty and k == 0 and s_ == 0: B.jetty_brackets(up, "s", y - 1)
            B.bay_windows(up, y, "sew")
            y += 5
        masses[k] = (up, ridge)
    for r, ridge in masses:
        B.roof(r, ridge, top, overhang=1, verge=1, pitch=pitch)
    B.build_roofs()
    if roof == "copper": recolour_copper(bp, seed)
    for r, ridge in masses:
        if ridge != "hip": B.gable_walls(r, ridge, top)
        if ridge == "z":
            gw = 2 if (r[2] - r[0]) >= 6 else 1
            B.window((r[0] + r[2]) // 2, top + 1, r[3] - 1, "s", 1, gw, shutters=False)
    # front door: middle of the main range's front, or of the free part of it beside an L wing
    main = masses[0][0]
    if shape == "L":
        wr = masses[1][0]
        free = [x for x in range(main[0] + 1, main[2]) if not (wr[0] - 1 <= x <= wr[2] + 1)]
        xd = free[len(free) // 2] if free else (main[0] + main[2]) // 2
    else:
        xd = (main[0] + main[2]) // 2
    zd = main[3]
    B.door(xd, 1, zd, "s", canopy=storeys == 1 or ground != "stone" or not jetty, lanterns=True)
    bp.markers["door"] = (xd, 1, zd + 1)
    if storeys > 1:
        vale.house_interior(bp, W, D, [0] + [1 + 4 * s for s in range(1, storeys)] + [top], D)
    # chimney on a gable end (side-gabled: the east or west end; front-gabled: a long side)
    if masses[0][1] == "x": B.chimney(-1 if rnd.random() < 0.5 else W + 1, D // 2, 1)
    elif masses[0][1] == "z": B.chimney(-1 if rnd.random() < 0.5 else W + 1, D // 2, 1)
    else: B.chimney(W // 2, 1, top - 1)
    # porch life: a barrel, a pot, a bench
    zf = zd + 1
    for xx in (xd - 2, xd + 2):
        if bp.get(xx, 1, zf)[0] == "keep" and rnd.random() < 0.4:
            bp.set(xx, 1, zf, rnd.choice(["barrel", "flower_pot", "composter"]), **({"plant": rnd.choice(["poppy", "dandelion", "cornflower"])} if False else {}))
    bp.finish()
    bp.kind = "house"
    return bp


def random_cottage(seed, rnd, tier, roof=None):
    """A cottage for a plot. tier 0 = by the square (taller, richer), 1 = town, 2 = edge (small)."""
    if tier == 0:
        shape = _weighted(rnd, [("front", 45), ("side", 25), ("L", 20), ("hip", 10)])
        storeys = 2 if rnd.random() < 0.85 else 1
        w, d = rnd.choice([(7, 9), (7, 11), (9, 9), (9, 11)])
    elif tier == 1:
        shape = _weighted(rnd, [("front", 30), ("side", 35), ("L", 25), ("hip", 10)])
        storeys = 2 if rnd.random() < 0.45 else 1
        w, d = rnd.choice([(7, 7), (7, 9), (9, 7), (9, 9), (5, 7)])
    else:
        shape = _weighted(rnd, [("front", 30), ("side", 45), ("L", 15), ("hip", 10)])
        storeys = 1
        w, d = rnd.choice([(5, 7), (7, 5), (7, 7), (5, 5), (9, 7)])
    if shape == "side" and w < d: w, d = d, w           # eaves to the street: wide and shallow
    if shape == "L": w = max(w, 9); d = min(d, 7)
    weights = dict(ROOF_WEIGHTS)
    if tier == 0: weights["copper"] = 16
    if tier == 2: weights.pop("copper"); weights["spruce"] += 8
    roof = roof or pick_roof(rnd, weights)
    pitch = 2 if (rnd.random() < 0.15 and w <= 7 and shape == "front") else 1
    ground = "stone" if rnd.random() < (0.75 if storeys == 2 else 0.5) else "timber"
    walls = _weighted(rnd, [("stone", 55), ("cobble", 30), ("brick", 15)])
    wing = (5, rnd.choice([3, 5]))
    return cottage(seed, w, d, storeys, shape, ground, roof, pitch, walls, wing)


# ---- farm buildings ----------------------------------------------------------------------
def barn(seed, width=9, depth=13):
    """A big framed barn with a 3-wide cart door in the front gable and hay by the door."""
    rnd = random.Random(seed)
    bp = Blueprint(f"tg_barn_{seed}")
    P = dict(VALE)
    P.update(ROOFS[rnd.choice(["dark_oak", "spruce", "slate"])])
    P["frame"] = "dark_oak_log"
    P["infill"] = mix([("spruce_planks", 60), ("dark_oak_planks", 25), ("stripped_spruce_log", 15)], seed)
    B = TownBuilding(bp, P, seed)
    W, D = width - 1, depth - 1
    r = (0, 0, W, D)
    B.foundation(grow(r, "nsew"), 0)
    B.floor(r, 0, "coarse_dirt")
    B.stone_storey(r, 1, 1, quoins=False)
    B.timber_storey(r, 2, 6, bay=4)
    B.roof(r, "z", 7, overhang=1, verge=1, pitch=1)
    B.build_roofs()
    B.gable_walls(r, "z", 7)
    xd = W // 2
    for x in range(xd - 1, xd + 2):
        for y in range(1, 5): bp.set(x, y, D, "air")
    for y in range(1, 5):
        for x in (xd - 2, xd + 2): bp.set(x, y, D, "dark_oak_log", axis="y")
    for x in range(xd - 2, xd + 3): bp.set(x, 5, D, "dark_oak_log", axis="x")
    bp.set(xd - 3, 1, D + 1, "hay_block", axis="y"); bp.set(xd - 3, 2, D + 1, "hay_block", axis="x")
    if rnd.random() < 0.6: bp.set(xd + 3, 1, D + 1, "hay_block", axis="z")
    for x in range(1, W):
        for z in range(1, 4):
            if h3(x, 0, z, seed) < 0.5: bp.set(x, 1, z, "hay_block", axis="y")
    bp.markers["door"] = (xd, 1, D + 1)
    bp.finish(); bp.kind = "barn"
    return bp


def windmill(seed):
    """A post-and-tower windmill: octagonal stone base, framed timber upper, hipped cap, four
    sails on the front (south) face. 7 x 7 footprint, about 19 high."""
    rnd = random.Random(seed)
    bp = Blueprint(f"tg_windmill_{seed}")
    P = dict(VALE); P.update(ROOFS[rnd.choice(["dark_oak", "spruce", "slate"])])
    oct_ = lambda x, z, r: abs(x) <= r and abs(z) <= r and abs(x) + abs(z) <= r + r // 2 + 1
    stone = VALE["stone"]
    for x in range(-4, 5):
        for z in range(-4, 5):
            if oct_(x, z, 4): bp.set(x, -1, z, "cobblestone"); bp.set(x, 0, z, VALE["plinth"])
    for y in range(1, 13):
        r = 3
        for x in range(-r, r + 1):
            for z in range(-r, r + 1):
                if not oct_(x, z, r): continue
                edge = not oct_(x + 1, z, r) or not oct_(x - 1, z, r) or not oct_(x, z + 1, r) or not oct_(x, z - 1, r)
                if not edge: bp.set(x, y, z, "air" if y > 0 else "spruce_planks"); continue
                if y <= 6: bp.set(x, y, z, stone)
                else:
                    corner = abs(x) + abs(z) == r + r // 2 + 1 or (abs(x) == r and abs(z) == r)
                    bp.set(x, y, z, "stripped_dark_oak_log" if (corner or y in (7, 12)) else "spruce_planks", axis="y")
        if y == 6:
            for x in range(-3, 4):
                for z in range(-3, 4):
                    if oct_(x, z, 3) and not oct_(x, z, 2): pass
    for x in range(-2, 3):
        for z in range(-2, 3):
            if oct_(x, z, 2): bp.set(x, 7, z, "spruce_planks")       # mill floor
    # a band of upside-down stairs where the stone gives way to timber
    for side in "nsew":
        dx, _, dz = DIRS[side]
        for t in range(-1, 2):
            x, z = (t, dz * 4) if side in "ns" else (dx * 4, t)
            bp.set(x, 6, z, "stone_brick_stairs", facing=OPP[side], half="top")
    # windows and door
    bp.set(0, 1, 3, "spruce_door", facing="n"); bp.set(0, 2, 3, "spruce_door", facing="n", upper=True)
    bp.set(0, 3, 3, "stone_bricks")
    for (x, y, z) in ((-3, 3, 0), (3, 3, 0), (0, 4, -3), (-3, 9, 0), (3, 9, 0), (0, 9, -3)):
        bp.set(x, y, z, "glass_pane")
    bp.set(-1, 1, 4, "lantern"); bp.set(1, 2, 4, "barrel")
    # cap
    B = TownBuilding(bp, P, seed)
    B.roof((-3, -3, 3, 3), "hip", 13, overhang=1, pitch=1)
    B.build_roofs()
    # axle and sails on the front
    hub_y = 11
    bp.set(0, hub_y, 4, "dark_oak_log", axis="z"); bp.set(0, hub_y, 5, "dark_oak_log", axis="z")
    arm = 8
    for i, (ax, ay) in enumerate(((0, 1), (1, 0), (0, -1), (-1, 0))):
        cx, cy = -ay, ax                                   # the side the sail cloth hangs on (turns with the arm)
        for t in range(1, arm + 1):
            x, y = ax * t, hub_y + ay * t
            bp.set(x, y, 5, "stripped_dark_oak_log", axis="x" if ax else "y")
            if t >= 2:                                     # cloth three wide on a lattice: a crossbar every third block
                for c in (1, 2, 3):
                    bp.set(x + cx * c, y + cy * c, 5, "spruce_planks" if t % 3 == 2 else "white_wool")
    bp.markers["door"] = (0, 1, 4)
    bp.finish(); bp.kind = "windmill"
    return bp


# ---- square furniture --------------------------------------------------------------------
def well(seed=1):
    """5 x 5 well: stone curb round water, four posts, a little slate roof and a bucket chain."""
    bp = Blueprint(f"tg_well_{seed}")
    for x in range(-2, 3):
        for z in range(-2, 3):
            ring = max(abs(x), abs(z))
            if ring == 2: bp.set(x, 0, z, "stone_brick_slab", half="top" if False else "bottom")
            elif ring == 1: bp.set(x, 0, z, "stone_bricks"); bp.set(x, 1, z, "stone_brick_wall")
            else:
                for y in range(-4, 1): bp.set(x, y, z, "water")
                bp.set(x, -5, z, "stone_bricks")
    for x in (-1, 1):
        for z in (-1, 1):
            for y in (2, 3): bp.set(x, y, z, "dark_oak_fence")
    for x in range(-2, 3):
        bp.set(x, 4, -1, "deepslate_tile_stairs", facing="s"); bp.set(x, 4, 1, "deepslate_tile_stairs", facing="n")
        bp.set(x, 4, 0, "deepslate_tile_slab", half="bottom")
    bp.set(0, 3, 0, "chain" if False else "iron_chain"); bp.set(0, 2, 0, "lantern", hanging=True)
    bp.finish(); bp.kind = "well"
    return bp

def market_cross(seed=2):
    """A stepped stone base with a tall shaft and a lantern head: the middle of a village green."""
    bp = Blueprint(f"tg_cross_{seed}")
    for x in range(-2, 3):
        for z in range(-2, 3):
            bp.set(x, 0, z, "stone_brick_slab", half="bottom") if max(abs(x), abs(z)) == 2 else bp.set(x, 0, z, "stone_bricks")
    for x in range(-1, 2):
        for z in range(-1, 2):
            bp.set(x, 1, z, "stone_brick_stairs", facing={(-1, 0): "e", (1, 0): "w", (0, -1): "s", (0, 1): "n"}.get((x, z), "n")) if (x == 0) != (z == 0) \
                else (bp.set(x, 1, z, "stone_brick_slab", half="bottom") if x and z else None)
    for y in range(1, 6): bp.set(0, y, 0, "stone_brick_wall" if y < 5 else "chiseled_stone_bricks")
    bp.set(0, 6, 0, "lantern")
    bp.finish(); bp.kind = "cross"
    return bp
