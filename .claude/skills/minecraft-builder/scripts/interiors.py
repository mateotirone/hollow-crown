"""Stage 8: interiors (build-instructions/08-interiors). Every building gets one (Mateo, 2026-11-12).

What a builder does inside, by rule, on top of the shell the house part made:
  1. stairs between every pair of storeys (a straight flight along a wall, or a ladder where a flight
     will not fit), the floor above cut for headroom and the well guarded,
  2. rooms furnished by what the building is for ("use") and what storey it is, in the region's woods,
     cloths and lights (FLAVOUR),
  3. a one-block walkway kept everywhere players walk: a piece of furniture is only kept if, with it in
     place, every open floor cell is still reachable from every other, the door, the stair ends and the
     front of every bed, chest and work block stay open,
  4. light: lanterns hung from the ceiling (chains in tall rooms) so mobs do not spawn.

Furniture is made from vanilla blocks the way builders make it (furnish.py in map/structures, the inn
and the Citadel keep): table = fence + pressure plate, chair = stair facing away from the table, bar =
stripped log on its side with trapdoors on the customer face, hearth = campfire in a stone alcove.

Spec, on a house part (default {"use": "home"}):
    "interior": "inn"                                  # just the use
    "interior": {"use": "shop", "rooms": ["shop", "bedroom"], "region": "vale", "stairs": true}
    "interior": false                                  # shell only (a build that furnishes itself)
For anything not made by the house part (towers from shapes, halls by hand), the interior part:
    {"part": "interior", "use": "tower", "levels": [{"rect": [x0, z0, x1, z1], "floor_y": 3, "height": 5}, ...]}
rect there is the room's inside (walls excluded), floor_y the floor block's row.
"""
from materials import h3

DIRS = {"n": (0, -1), "s": (0, 1), "e": (1, 0), "w": (-1, 0)}
OPP = {"n": "s", "s": "n", "e": "w", "w": "e"}
LEFT = {"n": "w", "w": "s", "s": "e", "e": "n"}
RIGHT = {v: k for k, v in LEFT.items()}
S = "interior"

# ---- what each kind of building has on each storey (ground first; the last entry repeats upward)
USES = {
    "home":      ["living", "bedroom"],
    "cottage":   ["cottage"],
    "townhouse": ["living", "bedroom", "bedroom"],
    "farmhouse": ["farm_kitchen", "bedroom"],
    "inn":       ["taproom", "guest_rooms"],
    "mint":      ["mint", "storage"],
    "moneyer":   ["moneyer", "storage"],   # the town money-changer (Mateo 2026-11-14): grilled counter, scales, strongbox
    "shop":      ["shop", "bedroom"],
    "smithy":    ["smithy", "bedroom"],
    "guildhall": ["hall", "office"],
    "hall":      ["hall", "council"],
    "capital":   ["hall", "council"],
    "chapel":    ["nave", "storage"],
    "tower":     ["guard", "storage", "lookout"],
    "mill":      ["mill", "storage"],
    "storage":   ["storage"],
    "barracks":  ["guard", "bunks"],
    "library":   ["library", "library"],
    "stable":    ["stable"],
    "storehouse": ["chest_store"],   # walls of sideways chests in 3 x 3 bays between stone pillars (Mateo 2026-11-13)
}

# ---- region flavour (08-interiors step 3; regions/<region>.md "inside")
FLAVOUR = {
    "vale":       dict(wood="spruce", table="dark_oak", rug=("red", "brown"), light="lantern", stone="stone_bricks",
                       extra=["flower_pot", "barrel", "bookshelf"]),
    "frostmarch": dict(wood="spruce", table="dark_oak", rug=("white", "brown"), light="lantern", stone="deepslate_bricks",
                       extra=["barrel", "barrel", "smoker"]),       # furs (white and brown rugs), long hearth tables
    "saltreach":  dict(wood="birch", table="birch", rug=("light_blue", "white"), light="lantern", stone="smooth_sandstone",
                       extra=["cartography_table", "barrel", "chest"]),   # nets, maps and sea chests
    "blackfen":   dict(wood="mangrove", table="mangrove", rug=("green", "brown"), light="lantern", stone="mud_bricks",
                       extra=["decorated_pot", "cauldron", "flower_pot"]),  # jars and drying herbs
    "emberwaste": dict(wood="acacia", table="acacia", rug=("orange", "red"), light="lantern", stone="sandstone",
                       extra=["decorated_pot", "orange_wool", "red_wool"]),  # cushions (wool) and low tables
    "hollow":     dict(wood="dark_oak", table="dark_oak", rug=("gray", "black"), light="soul_lantern", stone="polished_blackstone_bricks",
                       extra=["candle", "bookshelf", "decorated_pot"]),   # pale ash and soul light, a little off-true
}
REGION_OF_STYLE = {"vale": "vale", "frost": "frostmarch", "salt": "saltreach", "fen": "blackfen", "ember": "emberwaste", "hollow": "hollow"}


def region_of(s):
    st = s.get("style", "vale_timber")
    if isinstance(st, dict): st = st.get("base", "vale_timber")
    return REGION_OF_STYLE.get(str(st).split("_")[0], "vale")


def _raw(ctx, x, y, z):
    v = ctx.get(x, y, z)
    if not v: return None
    return v.get("name") if v.get("kind") == "raw" else (v.get("kind") or "block")


def _see_through(n):
    return bool(n) and ("glass" in n or n == "iron_bars" or n.endswith("_door"))


class Level:
    """One walking level: the open floor cells at stand row y, what is taken, what must stay open."""
    def __init__(self, ctx, cells, y, height, flav, name):
        self.ctx, self.y, self.h, self.F, self.name = ctx, y, height, flav, name
        self.area = set(cells)            # (x, z) with floor under, two air rows above
        self.taken = set()                # blocking furniture, stairs, holes
        self.must = set()                 # cells that stay walkable (door insides, stair ends)
        self.needs = []                   # [set of cells]: at least one stays walkable (bed sides, chest fronts)
        self.base = None
        self.zone = self.area             # the room being furnished (one block's storey); the walkway is checked level-wide
        self.zones = []

    def walk(self): return self.area - self.taken

    def parts(self, W=None):
        W = self.walk() if W is None else W
        seen, n = set(), 0
        for c in W:
            if c in seen: continue
            n += 1; todo = [c]; seen.add(c)
            while todo:
                x, z = todo.pop()
                for dx, dz in DIRS.values():
                    q = (x + dx, z + dz)
                    if q in W and q not in seen: seen.add(q); todo.append(q)
        return n

    def comps(self, W):
        seen, out = set(), []
        for c in W:
            if c in seen: continue
            comp = {c}; todo = [c]; seen.add(c)
            while todo:
                x, z = todo.pop()
                for dx, dz in DIRS.values():
                    q = (x + dx, z + dz)
                    if q in W and q not in seen: seen.add(q); comp.add(q); todo.append(q)
            out.append(comp)
        return out

    def ok_with(self, block, need=(), must=()):
        """Would the level still have its walkway with these cells taken? A nook of one or two cells may be
        closed off behind furniture; anything bigger, or any door, stair end or front, must stay reachable."""
        W = self.walk() - set(block)
        keep = set(must) | self.must
        if not keep <= W: return False
        big = [c for c in self.comps(W) if len(c) > 2 or (c & keep)]
        if self.base is None: self.base = len([c for c in self.comps(self.walk()) if len(c) > 2 or (c & self.must)])
        if len(big) > self.base: return False
        reach = set().union(*big) if big else set()
        for grp in self.needs + ([set(need)] if need else []):
            if not (grp & reach): return False
        return True

    def wall_dir(self, x, z):
        """Directions (inward) of the walls this cell stands against."""
        out = []
        for d, (dx, dz) in DIRS.items():
            q = (x - dx, z - dz)
            if q not in self.area and self.ctx.get(q[0], self.y, q[1]) is not None: out.append(d)
        return out

    def wall_cells(self):
        res = []
        for (x, z) in sorted(self.walk() & self.zone):
            for d in self.wall_dir(x, z): res.append((x, z, d))
        return res

    def behind(self, x, z, d, dy):
        dx, dz = DIRS[d]
        return _raw(self.ctx, x - dx, self.y + dy, z - dz)

    def free3(self, x, z, dy=0):
        return self.ctx.free(x, self.y + dy, z)


# ---------------------------------------------------------------- placing
def _put(L, cells, block, need=(), must=()):
    """cells: [(x, dy, z, name, props)]. Places only if every cell is free and the walkway survives."""
    for (x, dy, z, n, p) in cells:
        if not L.ctx.free(x, L.y + dy, z): return False
        if dy == 0 and (x, z) not in L.area: return False
    if any(c not in L.area or c in L.taken for c in block): return False
    if not L.ok_with(block, need, must): return False
    for (x, dy, z, n, p) in cells: L.ctx.set(x, L.y + dy, z, S, raw=n, **p)
    L.taken |= set(block)
    if need: L.needs.append(set(need))
    return True


def _fwd(x, z, d, k=1): return x + DIRS[d][0] * k, z + DIRS[d][1] * k
def _side(x, z, d, k): return x + DIRS[RIGHT[d]][0] * k, z + DIRS[RIGHT[d]][1] * k


def _clear_behind(L, x, z, d, rows):
    """The wall behind has no window or door in these rows (tall pieces never stand in front of glass)."""
    return not any(_see_through(L.behind(x, z, d, dy)) for dy in rows)


def p_single(L, x, z, d, name, props=None, rows=(0,)):
    if not _clear_behind(L, x, z, d, rows if len(rows) > 1 else ()): return False
    props = dict(props or {})
    cells = [(x, dy, z, name, props) for dy in rows]
    return _put(L, cells, [(x, z)], need=[_fwd(x, z, d)])


def p_bed(L, x, z, d):
    """Head to the wall, centred on the cell, a chest or barrel beside the head when it fits."""
    fx, fz = _fwd(x, z, d)
    sides = [_side(x, z, d, 1), _side(x, z, d, -1), _side(fx, fz, d, 1), _side(fx, fz, d, -1), _fwd(fx, fz, d)]
    head = OPP[d]
    ok = _put(L, [(x, 0, z, "bed", {"facing": head, "head": True}), (fx, 0, fz, "bed", {"facing": head, "head": False})],
              [(x, z), (fx, fz)], need=sides)
    if ok:
        for k in (1, -1):
            cx, cz = _side(x, z, d, k)
            if (cx, cz) in L.area and (cx, cz) not in L.taken and L.wall_dir(cx, cz):
                if _put(L, [(cx, 0, cz, "chest", {"facing": d})], [(cx, cz)], need=[_fwd(cx, cz, d)]): break
    return ok


def p_hearth(L, x, z, d, stone):
    """Fireplace 3 wide against a wall with no window: campfire in an alcove, stone cheeks 3 high, a
    mantle slab and a hood of upside-down stairs (furnish.hearth)."""
    if not _clear_behind(L, x, z, d, (0, 1, 2, 3)): return False
    l, r = _side(x, z, d, -1), _side(x, z, d, 1)
    for c in (l, r):
        if not _clear_behind(L, c[0], c[1], d, (0, 1, 2, 3)): return False
    if L.h < 5: rows = (0, 1)
    else: rows = (0, 1, 2)
    cells = [(c[0], dy, c[1], stone, {}) for c in (l, r) for dy in rows]
    cells.append((x, 0, z, "campfire", {"facing": d}))
    cells.append((x, rows[-1], z, f"{stone.replace('_bricks', '_brick').replace('bricks', 'brick')}_slab" if stone.endswith("bricks") else f"{stone}_slab", {"half": "top"}))
    if L.h >= 5:
        for c in (l, (x, z), r):
            if L.ctx.free(c[0], L.y + rows[-1] + 1, c[1]): cells.append((c[0], rows[-1] + 1, c[1], _stairs_of(stone), {"facing": OPP[d], "half": "top"}))
    cells = [c for c in cells if not (c[3].endswith("_slab") and c[1] == 0)]
    return _put(L, cells, [l, (x, z), r], need=[_fwd(x, z, d)])


def _stairs_of(stone):
    return {"stone_bricks": "stone_brick_stairs", "deepslate_bricks": "deepslate_brick_stairs", "mud_bricks": "mud_brick_stairs",
            "polished_blackstone_bricks": "polished_blackstone_brick_stairs", "smooth_sandstone": "smooth_sandstone_stairs",
            "sandstone": "sandstone_stairs"}.get(stone, "stone_brick_stairs")


def _slab_of(stone):
    return {"stone_bricks": "stone_brick_slab", "deepslate_bricks": "deepslate_brick_slab", "mud_bricks": "mud_brick_slab",
            "polished_blackstone_bricks": "polished_blackstone_brick_slab", "smooth_sandstone": "smooth_sandstone_slab",
            "sandstone": "sandstone_slab"}.get(stone, "stone_brick_slab")


def p_table(L, x, z, wood, chairs="nsew", low=False):
    """Fence + pressure plate (low: a trapdoor on top, the Emberwaste low table), chairs facing away."""
    if low: cells = [(x, 0, z, f"{wood}_trapdoor", {"facing": "n", "half": "top"})]
    else: cells = [(x, 0, z, f"{wood}_fence", {}), (x, 1, z, f"{wood}_pressure_plate", {})]
    block = [(x, z)]
    for d in chairs:
        cx, cz = _fwd(x, z, d)
        if (cx, cz) in L.area and (cx, cz) not in L.taken and L.free3(cx, cz):
            cells.append((cx, 0, cz, f"{wood}_stairs", {"facing": d})); block.append((cx, cz))
    if len(block) < 3: return False
    return _put(L, cells, block)


def p_long_table(L, cells_line, wood, along):
    """A row of fence + slab with chairs every other cell on both sides; a seat at each end."""
    side = [d for d in "nsew" if d not in (along, OPP[along])]
    cells, block = [], []
    for i, (x, z) in enumerate(cells_line):
        cells += [(x, 0, z, f"{wood}_fence", {}), (x, 1, z, f"{wood}_slab", {"half": "bottom"})]; block.append((x, z))
        if i % 2 == 0:
            for d in side:
                cx, cz = _fwd(x, z, d)
                cells.append((cx, 0, cz, f"{wood}_stairs", {"facing": d})); block.append((cx, cz))
    for (x, z), d in ((cells_line[0], OPP[along]), (cells_line[-1], along)):
        cx, cz = _fwd(x, z, d)
        cells.append((cx, 0, cz, f"{wood}_stairs", {"facing": d})); block.append((cx, cz))
    return _put(L, cells, block)


def p_counter(L, x, z, d, n, wood):
    """A counter n long, one cell out from the wall at (x, z) facing d into the room: stripped logs on
    their side with trapdoors on the customer face, barrels against the wall behind (furnish.bar)."""
    cx, cz = _fwd(x, z, d)
    ax = "z" if d in "ew" else "x"
    cells, block, need = [], [], []
    for k in range(-(n // 2), n // 2 + 1):
        px, pz = _side(cx, cz, d, k)
        cells.append((px, 0, pz, f"stripped_{wood}_log", {"axis": ax}))
        cells.append((px, 1, pz, f"{wood}_trapdoor", {"facing": d, "half": "bottom"})) if False else None
        block.append((px, pz))
        fx, fz = _fwd(px, pz, d)
        need.append((fx, fz))
    for k in range(-(n // 2), n // 2 + 1, 2):
        bx, bz = _side(x, z, d, k)
        if (bx, bz) in L.area and _clear_behind(L, bx, bz, d, (1,)):
            cells.append((bx, 0, bz, "barrel", {})); block.append((bx, bz))
    return _put(L, cells, block, need=need)


def p_rug(L, rect, colours):
    """Carpets on the open floor of a centred rectangle: a border colour round a field colour."""
    x0, z0, x1, z1 = rect
    if x1 - x0 < 2 or z1 - z0 < 2: return
    field, border = colours
    for x in range(x0, x1 + 1):
        for z in range(z0, z1 + 1):
            if (x, z) in L.taken or (x, z) not in L.area or not L.free3(x, z): continue
            edge = x in (x0, x1) or z in (z0, z1)
            L.ctx.set(x, L.y, z, S, raw=f"{border if edge else field}_carpet")


def p_lights(L, avoid=(), every=4):
    """Lanterns hung from whatever is overhead (a chain down in tall rooms), on a grid over the room."""
    xs = [x for x, _ in L.area]; zs = [z for _, z in L.area]
    if not xs: return 0
    x0, x1, z0, z1 = min(xs), max(xs), min(zs), max(zs)
    n = 0
    def grid(a0, a1):
        L_ = a1 - a0 + 1
        k = max(1, round(L_ / every))
        return sorted({a0 + int((i + 0.5) * L_ / k) for i in range(k)})
    low = L.y + 2                    # head room: feet at y, head at y + 1, lantern no lower than y + 2
    for x in grid(x0, x1):
        for z in grid(z0, z1):
            if (x, z) not in L.area or (x, z) in avoid: continue
            top = None
            for yy in range(L.y + 2, L.y + 14):
                if not L.ctx.free(x, yy, z): top = yy; break
            if top is None or top - 1 < low: continue
            lant = min(top - 1, L.y + (3 if L.h >= 5 else 2))
            if not L.ctx.free(x, lant, z): continue
            for yy in range(lant + 1, top): L.ctx.set(x, yy, z, S, raw="iron_chain", axis="y")
            L.ctx.set(x, lant, z, S, raw=L.F["light"], hanging=True); n += 1
    return n


# ---------------------------------------------------------------- stairs
def _stair_between(lo, hi, rise, door_cells, wood):
    """A straight flight of `rise` stairs along a wall of the lower level that lands on the upper one.
    Scores keep it off windows and far from the door. Falls back to a ladder."""
    best = None
    for (x, z, d) in lo.wall_cells():               # d points into the room from this wall
        for run in (RIGHT[d], LEFT[d]):            # the flight runs along the wall
            cs = [_fwd(x, z, run, k) for k in range(rise)]
            a = _fwd(x, z, run, -1); e = _fwd(x, z, run, rise)
            if any(c not in lo.area or c in lo.taken for c in cs): continue
            if any(d not in lo.wall_dir(*c) for c in cs): continue        # hugs the same wall all the way
            if a not in lo.area or a in lo.taken: continue
            holes = cs[:-1]
            if any(c not in hi.area or c in hi.taken for c in cs): continue
            if e not in hi.area or e in hi.taken: continue
            if any(abs(c[0] - q[0]) + abs(c[1] - q[1]) <= 1 for c in cs + [a] for q in door_cells): continue
            glass = sum(1 for k, c in enumerate(cs) for dy in (k, k + 1, k + 2) if _see_through(lo.behind(c[0], c[1], d, dy)))
            far = min((abs(a[0] - q[0]) + abs(a[1] - q[1]) for q in door_cells), default=0)
            ch = getattr(lo.ctx, "chimneys", set())     # leave the chimney breast free for the hearth
            near_ch = any(max(abs(c[0] - q[0]), abs(c[1] - q[1])) <= 2 for c in cs + [a] for q in ch)
            score = glass * 10 - far * 0.5 + near_ch * 8 + h3(x, z, rise, 3) * 0.1
            # walkway: the flight must not cut either level in two
            if not lo.ok_with(cs, must=[a]) or not hi.ok_with(holes, must=[e]): continue
            if best is None or score < best[0]: best = (score, cs, a, e, run, d)
    if best:
        _, cs, a, e, run, d = best
        ctx = lo.ctx
        for k, (cx, cz) in enumerate(cs):
            for yy in (lo.y + k, lo.y + k + 1, lo.y + k + 2):
                if yy >= hi.y - 1 and k < rise - 1: ctx.clear(cx, yy, cz)       # the well through the floor above
            ctx.set(cx, lo.y + k, cz, S, raw=f"{wood}_stairs", facing=run)
            if k < rise - 1: ctx.clear(cx, hi.y - 1, cz)
        lo.taken |= set(cs); lo.must.add(a)
        hi.taken |= set(cs[:-1]); hi.must.add(e)
        # guard the well on the upper floor: a fence along its open side where the walkway allows
        guard = [_side(c[0], c[1], OPP[d], 0) for c in cs[:-1]]
        rail = [(c[0] + DIRS[d][0], c[1] + DIRS[d][1]) for c in cs[:-1]]
        rail = [c for c in rail if c in hi.area and c not in hi.taken]
        if rail and _put(hi, [(c[0], 0, c[1], f"{wood}_fence", {}) for c in rail], rail): pass
        return "stairs"
    # ladder: one cell against a blank wall, a hole above, open floor in front on both levels
    for (x, z, d) in lo.wall_cells():
        f = _fwd(x, z, d)
        if (x, z) not in hi.area or (x, z) in hi.taken or f not in hi.area or f in hi.taken: continue
        if any(_see_through(lo.behind(x, z, d, dy)) for dy in range(0, hi.y - lo.y + 1)): continue
        if any(abs(x - q[0]) + abs(z - q[1]) <= 1 for q in door_cells): continue
        if not lo.ok_with([(x, z)], must=[f]) or not hi.ok_with([(x, z)], must=[f]): continue
        for yy in range(lo.y, hi.y): lo.ctx.clear(x, yy, z); lo.ctx.set(x, yy, z, S, raw="ladder", facing=d)
        lo.taken.add((x, z)); hi.taken.add((x, z)); lo.must.add(f); hi.must.add(f)
        return "ladder"
    return None


def _roof_hatch(L, door_cells, wood):
    """Mateo 2026-11-13 ("how do you get up to the top?"): a tower whose flat top is walked on (a mooring deck,
    a lookout, a belfry deck) gets a ladder from its top storey up through a trapdoor hatch in the roof. Ask
    for it with "interior": {"use": "tower", "hatch": true}. The hatch is a closed top trapdoor, so the deck
    stays walkable; a belfry built on top later leaves it in place (ctx.hatches)."""
    ctx = L.ctx
    for (x, z, d) in L.wall_cells():
        f = _fwd(x, z, d)
        if f in L.taken or (x, z) in L.taken or (x, z) in L.must: continue
        top = next((yy for yy in range(L.y, L.y + 16) if not ctx.free(x, yy, z)), None)
        if top is None or top - L.y > 12: continue
        if any(_see_through(L.behind(x, z, d, dy)) for dy in range(0, top - L.y)): continue
        if any(abs(x - q[0]) + abs(z - q[1]) <= 1 for q in door_cells): continue
        if not L.ok_with([(x, z)], must=[f]): continue
        for yy in range(L.y, top): ctx.set(x, yy, z, S, raw="ladder", facing=d)
        ctx.clear(x, top, z); ctx.set(x, top, z, S, raw=f"{wood}_trapdoor", facing=OPP[d], half="top", open=False)
        if not hasattr(ctx, "hatches"): ctx.hatches = set()
        ctx.hatches.add((x, top, z))
        L.taken.add((x, z)); L.must.add(f)
        return True
    return False


# ---------------------------------------------------------------- rooms
def _room_box(L):
    xs = [x for x, _ in L.zone]; zs = [z for _, z in L.zone]
    return min(xs), min(zs), max(xs), max(zs)


def _centre(L):
    x0, z0, x1, z1 = _room_box(L)
    return (x0 + x1) // 2, (z0 + z1) // 2


def _by_far(L, cells, doors):
    """Wall cells: the end wall facing the door first, then the farthest from the door."""
    ins = set()
    for (x, z) in doors:
        for d, (dx, dz) in DIRS.items():
            n = _raw(L.ctx, x - dx, L.y, z - dz)
            if n and n.endswith("_door"): ins.add(d)
    if not ins and getattr(L, "entry", None): ins.add(OPP[L.entry])
    def far(c): return -min((abs(c[0] - q[0]) + abs(c[1] - q[1]) for q in doors), default=0)
    return sorted(cells, key=lambda c: (0 if (len(c) > 2 and OPP[c[2]] in ins) else 1, far(c), h3(c[0], c[1], L.y, 7)))


def _wall_items(L, names, doors, start=0):
    """Single blocks along the walls, spread out (every other wall cell at most)."""
    cells = _by_far(L, L.wall_cells(), doors)
    placed, used = 0, set()
    k = start
    for (x, z, d) in cells:
        if placed >= len(names): break
        if any(abs(x - u[0]) + abs(z - u[1]) <= 1 for u in used): continue
        n = names[placed]
        rows = (0, 1) if n in ("bookshelf",) and L.h >= 5 else (0,)
        props = {"facing": d} if n in ("chest", "furnace", "smoker", "blast_furnace", "lectern", "anvil", "loom",
                                       "stonecutter_block", "grindstone", "decorated_pot", "chiseled_bookshelf") else {}
        if n == "candle": props = {"candles": 2, "lit": True}
        if p_single(L, x, z, d, n, props, rows): placed += 1; used.add((x, z))
    return placed


def _beds(L, n, doors):
    """Beds along the walls with a gap between them (a chest or a walkway), never side by side."""
    got, heads = 0, []
    for (x, z, d) in _by_far(L, L.wall_cells(), doors):
        if got >= n: break
        if any(abs(x - hx) + abs(z - hz) <= 2 for hx, hz in heads): continue
        if p_bed(L, x, z, d): got += 1; heads.append((x, z)); heads.append(_fwd(x, z, d))
    return got


def _hearth(L, doors):
    """Against the chimney breast when the chimney stands inside (Mateo's chimney), else a blank wall."""
    ch = getattr(L.ctx, "chimneys", set())
    cells = _by_far(L, L.wall_cells(), doors)
    cells.sort(key=lambda c: 0 if (c[0] - DIRS[c[2]][0], c[1] - DIRS[c[2]][1]) in ch else 1)
    for (x, z, d) in cells:
        if p_hearth(L, x, z, d, L.F["stone"]): return (x, z)
    return None


def _tables(L, wood, n, low=False):
    """Tables with their chairs on a grid 4 apart (one table, its chairs, a walkway), centred in the room."""
    x0, z0, x1, z1 = _room_box(L)
    def axis(a0, a1):
        lo, hi = a0 + 2, a1 - 2
        if hi < lo: return []
        k = (hi - lo) // 4 + 1; start = lo + ((hi - lo) - (k - 1) * 4) // 2
        return [start + 4 * i for i in range(k)]
    cx, cz = _centre(L)
    spots = [(x, z) for x in axis(x0, x1) for z in axis(z0, z1)]
    if len(spots) <= 1: spots = [(x, z) for x in range(x0 + 2, x1 - 1) for z in range(z0 + 2, z1 - 1)]
    spots.sort(key=lambda c: (abs(c[0] - cx) + abs(c[1] - cz), h3(c[0], c[1], 5, 1)))
    got = 0; used = []
    for (x, z) in spots:
        if got >= n: break
        if any(max(abs(x - u[0]), abs(z - u[1])) < 4 for u in used): continue
        if p_table(L, x, z, wood, low=low): got += 1; used.append((x, z))
    return got


def _long_table(L, wood):
    x0, z0, x1, z1 = _room_box(L)
    W, D = x1 - x0 + 1, z1 - z0 + 1
    along = "e" if W >= D else "s"
    n = (W if along == "e" else D) - 6
    if n < 3: return False
    if n % 2 == 0: n -= 1
    cx, cz = _centre(L)
    for off in (0, 1, -1, 2, -2):
        line = [(cx - n // 2 + i, cz + off) for i in range(n)] if along == "e" else [(cx + off, cz - n // 2 + i) for i in range(n)]
        if p_long_table(L, line, wood, along): return True
    return False


def _counter(L, doors, wood):
    """Across the end wall facing the door, with a way round one end."""
    x0, z0, x1, z1 = _room_box(L)
    for (x, z, d) in _by_far(L, L.wall_cells(), doors):
        span = (x1 - x0 + 1) if d in "ns" else (z1 - z0 + 1)
        n = min(5, span - 4)
        if n < 3: n = 1
        if n % 2 == 0: n -= 1
        if p_counter(L, x, z, d, n, wood): return True
    return False


def p_grille_counter(L, x, z, d, n, wood):
    """The money-changer's counter (Mateo 2026-11-14, "a Moneyer in every town"): p_counter's logs, an iron grille
    three high along the top, and in the middle a pass window under it with the scales, an iron and a gold weighted
    plate side by side. The Moneyer stands behind the middle (L.spot)."""
    cx, cz = _fwd(x, z, d)
    ax = "z" if d in "ew" else "x"
    cells, block, need = [], [], []
    for k in range(-(n // 2), n // 2 + 1):
        px, pz = _side(cx, cz, d, k)
        cells.append((px, 0, pz, f"stripped_{wood}_log", {"axis": ax}))
        top = "heavy_weighted_pressure_plate" if k == 0 else "light_weighted_pressure_plate" if k == 1 else "iron_bars"
        cells.append((px, 1, pz, top, {}))      # the scales sit in the gap under the grille: the pass window
        for dy in (2, 3): cells.append((px, dy, pz, "iron_bars", {}))   # the grille runs whole above, bars joined
        block.append((px, pz)); need.append(_fwd(px, pz, d))
    for k in (-(n // 2),):                        # a barrel at one end only: the other end is the way in behind
        bx, bz = _side(x, z, d, k)
        if (bx, bz) in L.area and _clear_behind(L, bx, bz, d, (1,)):
            cells.append((bx, 0, bz, "barrel", {})); block.append((bx, bz))
    if not _put(L, cells, block, need=need, must=[(x, z)]): return False
    L.spot = (x, z)                               # behind the pass window, facing the room
    return True


def _grille_counter(L, doors, wood):
    """Across the wall furthest from the door, 5 long where it fits (3 at least), a gap at one end to get behind."""
    x0, z0, x1, z1 = _room_box(L)
    for (x, z, d) in _by_far(L, L.wall_cells(), doors):
        span = (x1 - x0 + 1) if d in "ns" else (z1 - z0 + 1)
        n = min(5, span - 2)
        if n % 2 == 0: n -= 1
        if n < 3: continue
        if p_grille_counter(L, x, z, d, n, wood): return True
    return False


def _strongbox(L, doors):
    """An iron-bound strongbox: a chest on an iron block against a wall, its front free."""
    for (x, z, d) in _by_far(L, L.wall_cells(), doors):
        if _put(L, [(x, 0, z, "iron_block", {}), (x, 1, z, "chest", {"facing": d})], [(x, z)], need=[_fwd(x, z, d)]): return True
    return False


def _iron_stack(L, doors):
    """Iron bars stacked in a corner: two iron blocks up and one beside, weighted plates on top."""
    for (x, z, d) in _by_far(L, L.wall_cells(), doors):
        sx, sz = _side(x, z, d, 1)
        if (sx, sz) not in L.area or not _clear_behind(L, x, z, d, (1,)): continue
        if _put(L, [(x, 0, z, "iron_block", {}), (x, 1, z, "iron_block", {}), (x, 2, z, "heavy_weighted_pressure_plate", {}),
                    (sx, 0, sz, "iron_block", {}), (sx, 1, sz, "heavy_weighted_pressure_plate", {})], [(x, z), (sx, sz)], need=[_fwd(x, z, d)]):
            return True
    return False


def _pews(L, doors, wood, cloth):
    """Chapel: an aisle on the centre line from the door, pews (stairs) in rows either side facing the altar
    at the far end, the altar on a step with candles, a runner up the aisle."""
    x0, z0, x1, z1 = _room_box(L)
    if not doors: return
    dx_, dz_ = doors[0]
    along_x = (x1 - x0) >= (z1 - z0)
    if along_x:
        to = "e" if dx_ <= (x0 + x1) // 2 else "w"; cz = (z0 + z1) // 2
        far = x1 if to == "e" else x0
        aisle = [(x, cz) for x in range(x0, x1 + 1)]
    else:
        to = "s" if dz_ <= (z0 + z1) // 2 else "n"; cx = (x0 + x1) // 2
        far = z1 if to == "s" else z0
        aisle = [(cx, z) for z in range(z0, z1 + 1)]
    # altar: a top-slab dais 3 wide on the far wall, a lectern on it? no: a block altar with candles
    ac = aisle[-1] if to in "es" else aisle[0]
    sd = RIGHT[to]
    dais = [_side(ac[0], ac[1], to, k) for k in (-1, 0, 1)]
    cells = [(c[0], 0, c[1], _slab_of(L.F["stone"]), {"half": "bottom"}) for c in dais]
    cells = [c for c in cells if (c[0], c[2]) != ac] + [(ac[0], 0, ac[1], "polished_andesite" if L.F["stone"] == "stone_bricks" else L.F["stone"], {}),
                                                      (ac[0], 1, ac[1], "white_candle", {"candles": 3, "lit": True})]
    _put(L, cells, dais)
    # pews: rows across, two blocks clear of the altar, one row every two cells, both sides of the aisle
    rows = [c for c in aisle if c not in dais]
    rows = rows[::-1] if to in "es" else rows
    rows = rows[2:-2]
    for i, c in enumerate(rows):
        if i % 2: continue
        for side in (1, -1):
            seats = []
            for k in range(1, 8):
                q = _side(c[0], c[1], to, k * side)
                if q not in L.area: break
                if not L.wall_dir(*q): seats.append(q)
            seats = seats[:-1] if len(seats) > 1 else seats      # leave the side walkway
            if len(seats) >= 1:
                _put(L, [(q[0], 0, q[1], f"{wood}_stairs", {"facing": OPP[to]}) for q in seats], seats)
    # runner
    for c in aisle:
        if c not in L.taken and c in L.area and L.free3(*c): L.ctx.set(c[0], L.y, c[1], S, raw=f"{cloth}_carpet")


# ---------------------------------------------------------------- the storehouse's chest walls (Mateo 2026-11-13)
# Mateo's reference: chests turned sideways (you see their side, not the lid's latch) in 3 x 3 bays between stone
# pillars, a stone beam across the top of each bay. A bay is pillar, 3 chests, pillar along a wall; neighbouring
# bays share their pillar, so a run of 4n + 1 cells holds n bays (9 cells: 2, 13: 3). Chests face along the wall:
# side by side along their own facing they never join into double chests, so every chest is its own 27 slots.
# A bay goes up only where the wall behind it is blank (no glass, no door), it keeps clear of stairs and door
# insides, and the walkway rule holds (every chest front stays reachable). Big rooms also get free-standing racks
# down the middle, open both sides.
CHEST_ROWS = 3                     # chests high in a bay; the beam row goes on top (4 clear rows in a storey of 5)

def _runs(L):
    """Straight wall runs: (d, [cells in order along the wall]) for each wall direction and line."""
    by = {}
    for (x, z, d) in L.wall_cells():
        key = (d, x if d in "ew" else z)
        by.setdefault(key, []).append((x, z))
    out = []
    for (d, _), cells in sorted(by.items()):
        along = 1 if d in "ew" else 0                       # the coordinate that runs along the wall
        cells.sort(key=lambda c: c[along])
        run = [cells[0]]
        for c in cells[1:]:
            if c[along] == run[-1][along] + 1: run.append(c)
            else: out.append((d, run)); run = [c]
        out.append((d, run))
    return out

def _bay(L, d, cells, pillar, beam, facing, back=True):
    """One bay: cells = [pillar, c, c, c, pillar] along the line. back = it stands against a wall (checked blank)."""
    rows = CHEST_ROWS + 1
    pil = [cells[0], cells[-1]]; mid = cells[1:-1]
    if back and not all(_clear_behind(L, x, z, d, range(rows)) for (x, z) in cells): return 0
    for (x, z) in pil:                                   # a pillar may already stand there (the bay beside it)
        here = _raw(L.ctx, x, L.y, z)
        if here != pillar and (any(not L.ctx.free(x, L.y + dy, z) for dy in range(CHEST_ROWS)) or (x, z) in L.taken or (x, z) in L.must): return 0
    for (x, z) in mid:   # the top row may already hold a beam (a roof's tie beam): it is the bay's beam then
        if any(not L.ctx.free(x, L.y + dy, z) for dy in range(CHEST_ROWS)) or (x, z) in L.taken or (x, z) in L.must: return 0
    block = [c for c in cells if c not in L.taken]
    fronts = [_fwd(x, z, d) for (x, z) in mid] if back else []
    if not L.ok_with(block, need=fronts): return 0
    for (x, z) in pil:
        for dy in range(rows):
            if L.ctx.free(x, L.y + dy, z): L.ctx.set(x, L.y + dy, z, S, raw=pillar)
    for (x, z) in mid:
        for dy in range(CHEST_ROWS): L.ctx.set(x, L.y + dy, z, S, raw="chest", facing=facing)
        if L.ctx.free(x, L.y + CHEST_ROWS, z): L.ctx.set(x, L.y + CHEST_ROWS, z, S, raw=beam)
    L.taken |= set(cells)
    if fronts: L.needs.append(set(fronts))
    return len(mid) * CHEST_ROWS

def _chest_walls(L, pillar, beam):
    n = 0
    for d, run in _runs(L):
        if len(run) < 5: continue
        bays = (len(run) - 1) // 4
        off = (len(run) - (4 * bays + 1)) // 2
        facing = RIGHT[d]                                # along the wall: you see the chest's side
        for b in range(bays):
            n += _bay(L, d, run[off + 4 * b: off + 4 * b + 5], pillar, beam, facing)
    return n

def _chest_racks(L, pillar, beam, doors):
    """Free-standing racks down a wide room: a line 3 in from each long wall (a 2-wide aisle behind it), pillar
    and 3 chests along it, open both sides, the ends kept 2 clear for cross aisles. Only where the room is 11+ wide."""
    x0, z0, x1, z1 = _room_box(L)
    w, dz = x1 - x0 + 1, z1 - z0 + 1
    long_z = dz >= w                                     # racks run along the long side
    span = w if long_z else dz
    if span < 11: return 0
    n = 0
    for k in (3, span - 4):                              # 3 in from each wall: wall row, 2 aisle, the rack
        line = []
        lo, hi = (z0, z1) if long_z else (x0, x1)
        for a in range(lo + 2, hi - 1):
            line.append((x0 + k, a) if long_z else (a, z0 + k))
        bays = (len(line) - 1) // 4
        off = (len(line) - (4 * bays + 1)) // 2
        facing = "s" if long_z else "e"
        for b in range(bays):
            n += _bay(L, "e" if long_z else "s", line[off + 4 * b: off + 4 * b + 5], pillar, beam, facing, back=False)
    return n


def furnish_level(L, kind, doors, region, wood, table):
    F = L.F
    rug = F["rug"]
    low = region == "emberwaste"
    x0, z0, x1, z1 = _room_box(L)
    area = len(L.walk())
    big = area >= 60
    if kind == "living":
        _hearth(L, doors)
        _tables(L, table, 1, low)
        _wall_items(L, ["crafting_table", "barrel", "chest", F["extra"][0]], doors)
    elif kind == "cottage":
        _hearth(L, doors); _beds(L, 1, doors); _tables(L, table, 1, low)
        _wall_items(L, ["barrel", "crafting_table", F["extra"][0]], doors)
    elif kind == "farm_kitchen":
        _hearth(L, doors); _tables(L, table, 1, low)
        _wall_items(L, ["smoker", "barrel", "composter", "barrel", "cauldron", "crafting_table"], doors)
    elif kind == "bedroom":
        nb = 1 if area < 30 else 2 if area < 60 else 3
        _beds(L, nb, doors)
        _wall_items(L, ["bookshelf", "lectern", F["extra"][0]], doors)
    elif kind == "guest_rooms" or kind == "bunks":
        _beds(L, max(2, min(6, area // 16)), doors)
        _wall_items(L, ["barrel", F["extra"][0]], doors)
    elif kind == "taproom":
        _counter(L, doors, wood)
        _hearth(L, doors)
        _tables(L, table, 2 if area < 80 else 4, low)
        _wall_items(L, ["barrel", "barrel", F["extra"][0]], doors)
    elif kind == "shop":
        _counter(L, doors, wood)
        _wall_items(L, ["barrel", "chest", "barrel", "bookshelf", F["extra"][0]], doors)
    elif kind == "moneyer":
        _grille_counter(L, doors, wood)
        _strongbox(L, doors)
        _iron_stack(L, doors)
        _wall_items(L, ["lectern", "chest", "barrel"], doors)
    elif kind == "mint":
        _counter(L, doors, wood)
        _wall_items(L, ["chest", "chest", "anvil", "chest", "lectern", "furnace"], doors)
    elif kind == "smithy":
        _hearth(L, doors)
        _wall_items(L, ["anvil", "grindstone", "smithing_table", "blast_furnace", "barrel", "chest"], doors)
    elif kind in ("hall", "council"):
        _long_table(L, table) or _tables(L, table, 2, low)
        _hearth(L, doors)
        _wall_items(L, ["lectern", "bookshelf", "bookshelf", "cartography_table" if kind == "council" else "barrel"], doors)
    elif kind == "office":
        _tables(L, table, 1, low)
        _wall_items(L, ["lectern", "bookshelf", "bookshelf", "chest", "cartography_table"], doors)
    elif kind == "library":
        _tables(L, table, 1, low)
        _wall_items(L, ["bookshelf"] * 8 + ["lectern"], doors)
    elif kind == "nave":
        _pews(L, doors, wood, rug[0])
        _wall_items(L, ["white_candle", "white_candle"], doors)
        return
    elif kind == "guard":
        _tables(L, table, 1, low)
        _wall_items(L, ["barrel", "chest", "grindstone", "barrel"], doors)
    elif kind == "lookout":
        _wall_items(L, ["barrel", "cartography_table"], doors)
    elif kind == "mill":
        _wall_items(L, ["grindstone", "barrel", "barrel", "composter", "hay_block", "chest"], doors)
    elif kind == "open":       # an open arcade or market floor: nothing but light, the walk stays clear
        return
    elif kind == "stable":
        _wall_items(L, ["hay_block", "hay_block", "barrel", "composter"], doors)
    elif kind == "chest_store":
        I = getattr(L, "I", {}) or {}
        pillar = I.get("pillar", F["stone"]); beam = I.get("beam", pillar)
        L.chests = _chest_walls(L, pillar, beam)
        if I.get("racks", True): L.chests += _chest_racks(L, pillar, beam, doors)
        _wall_items(L, ["barrel", "crafting_table", "barrel"], doors)
        return
    else:   # storage
        _wall_items(L, ["barrel", "chest", "barrel", "barrel", "chest", "barrel"], doors)
    if big or kind in ("living", "bedroom", "hall", "council", "taproom", "cottage"):
        cx, cz = _centre(L)                       # a rug at most 9 x 9 (a runner in a long hall), centred on the room
        hx = min((x1 - x0) // 2 - 2, 4 if (x1 - x0) <= (z1 - z0) else 8); hz = min((z1 - z0) // 2 - 2, 4 if (z1 - z0) < (x1 - x0) else 8)
        p_rug(L, (cx - hx, cz - hz, cx + hx, cz + hz), rug)


# ---------------------------------------------------------------- entry points
def _wood_of(st, region):
    v = st.get("floor")
    if isinstance(v, str):
        for w in ("dark_oak", "pale_oak", "spruce", "birch", "jungle", "acacia", "mangrove", "cherry", "crimson", "warped", "oak"):
            if v.startswith(w): return w
    return FLAVOUR[region]["wood"]


def _uses(spec):
    if spec is None or spec is True: return {"use": "home"}
    if isinstance(spec, str): return {"use": spec}
    return dict(spec)


def furnish(ctx, s, st, blocks):
    """The house part's stage 8: blocks = [(spec, style, body)] as house() keeps them."""
    I = s.get("interior", True)
    if I is False or I == "none": return
    I = _uses(I)
    region = I.get("region") or region_of(s)
    F = dict(FLAVOUR[region]); F.update(I.get("flavour", {}))
    wood = I.get("wood") or _wood_of(st, region)
    table = I.get("table") or F["table"]
    rooms = I.get("rooms") or USES.get(I.get("use", "home"), USES["home"])
    off = s.get("offset") if isinstance(s.get("offset"), dict) and not s.get("offset", {}).get("roof") else None
    # walking levels: storeys of every block grouped by stand row (wings at the same height share one)
    levels = {}
    for bs, bst, B in blocks:
        for i, (fl, rr, h) in enumerate(zip(B["floors"], B["rects"], B["storeys"])):
            dx = dz = 0
            if off and bs is s and i >= max(1, off.get("storey", 1)):
                dx, dz = DIRS[off.get("dir", "e")]
            y = fl + 1
            cells = set()
            for x in range(rr[0] + 1 + dx, rr[2] + dx):
                for z in range(rr[1] + 1 + dz, rr[3] + dz):
                    if ctx.get(x, fl, z) is not None and ctx.free(x, y, z) and ctx.free(x, y + 1, z): cells.add((x, z))
            key = y
            if key in levels:
                levels[key]["zones"].append(cells - levels[key]["cells"])
                levels[key]["cells"] |= cells; levels[key]["h"] = max(levels[key]["h"], h)
            else: levels[key] = {"cells": cells, "h": h, "i": i, "zones": [cells]}
    if I.get("attic"):        # a room under the roof: a floor on the wall plate, wherever two rows of air stand over it
        B = blocks[0][2]; rr = B["rects"][-1]; P = B["plate"]
        dx = dz = 0
        if off and len(B["floors"]) > max(1, off.get("storey", 1)): dx, dz = DIRS[off.get("dir", "e")]
        floor = ctx.mat(st, "floor"); cells = set()
        for x in range(rr[0] + 1 + dx, rr[2] + dx):
            for z in range(rr[1] + 1 + dz, rr[3] + dz):
                if ctx.free(x, P, z): ctx.set(x, P, z, "floors", "full", floor)
                if ctx.get(x, P, z) is not None and ctx.free(x, P + 1, z) and ctx.free(x, P + 2, z): cells.add((x, z))
        if cells: levels[P + 1] = {"cells": cells, "h": 4, "i": len(B["floors"]), "zones": [cells]}
    _furnish_levels(ctx, sorted(levels.items()), rooms, F, region, wood, table, I, st.get("_name", "house"))


def _furnish_levels(ctx, levels, rooms, F, region, wood, table, I, name):
    Ls = []
    for y, v in levels:
        if not v["cells"]: continue
        L = Level(ctx, v["cells"], y, v["h"], F, name)
        L.zones = sorted([z for z in v.get("zones", [v["cells"]]) if z], key=len, reverse=True)
        L.I = I
        Ls.append(L)
    if not Ls: return
    # doors on the ground level: any door block in a wall next to an open cell
    doors = []
    G = Ls[0]
    for (x, z) in G.area:
        for dx, dz in DIRS.values():
            n = _raw(ctx, x + dx, G.y, z + dz)
            if n and n.endswith("_door") and (x + dx, z + dz) not in G.area: doors.append((x, z))
    # doorways a spec cuts later with "place" air (place runs after the parts): their inside cells stay open
    holes = {(e[0], e[1], e[2]) for e in ctx.spec.get("place", []) if len(e) > 3 and str(e[3]).replace("minecraft:", "") == "air"}
    for L in Ls:
        for (x, z) in sorted(L.area):
            for dx, dz in DIRS.values():
                if (x + dx, L.y, z + dz) in holes and (x + dx, L.y + 1, z + dz) in holes and (x + dx, z + dz) not in L.area:
                    L.must.add((x, z))
                    if L is G and (x, z) not in doors: doors.append((x, z))
    if not doors and I.get("entry"):     # the way in is through another block (a chapel entered by its tower): the side it comes from
        xs = [x for x, _ in G.area]; zs = [z for _, z in G.area]
        cx, cz = (min(xs) + max(xs)) // 2, (min(zs) + max(zs)) // 2
        e = I["entry"]
        c = {"n": (cx, min(zs)), "s": (cx, max(zs)), "w": (min(xs), cz), "e": (max(xs), cz)}[e]
        if c in G.area: doors.append(c)
    if not doors:              # no door of its own: the way in is an opening (an arch, or a door in the next block)
        for (x, z) in sorted(G.area):
            for dx, dz in DIRS.values():
                q = (x + dx, z + dz)
                if q in G.area: continue
                n = _raw(ctx, q[0], G.y, q[1])
                if (n and n.endswith("_door")) or (ctx.free(q[0], G.y, q[1]) and ctx.free(q[0], G.y + 1, q[1]) and ctx.get(q[0], G.y - 1, q[1]) is not None):
                    doors.append((x, z)); break
        doors = doors[:3]
    G.must |= set(doors)
    for L in Ls: L.entry = I.get("entry")
    # stairs first (they decide where the floors are cut), then rooms bottom up, then lights
    if I.get("stairs", True):
        for lo, hi in zip(Ls, Ls[1:]):
            got = _stair_between(lo, hi, hi.y - lo.y, doors, wood)
            if not got: ctx.log.append(f"{name}: no room for a stair or ladder from y {lo.y} to y {hi.y} (08-interiors)")
        if I.get("hatch") and Ls:
            if not _roof_hatch(Ls[-1], doors if len(Ls) == 1 else list(Ls[-1].must), wood):
                ctx.log.append(f"{name}: no room for a ladder up to the roof hatch (08-interiors)")
    if I.get("furnish", True):
        for k, L in enumerate(Ls):
            kind = rooms[min(k, len(rooms) - 1)]
            ups = list(L.must)                      # upper floors: the stair top is the 'door' of the room
            for zone in L.zones:                    # each block's room on its own (a wing is its own room)
                L.zone = zone & L.area
                if len(L.zone) >= 4: furnish_level(L, kind, doors if k == 0 else ups, region, wood, table)
            L.zone = L.area
    if I.get("lights", True):
        for L in Ls: p_lights(L, avoid=L.taken)


def interior_part(ctx, pt):
    """Stand-alone interior for builds not made by the house part: explicit levels."""
    region = pt.get("region", "vale")
    F = dict(FLAVOUR[region]); F.update(pt.get("flavour", {}))
    rooms = pt.get("rooms") or USES.get(pt.get("use", "storage"), USES["storage"])
    levels = []
    for lv in pt["levels"]:
        x0, z0, x1, z1 = lv["rect"]; fl = lv["floor_y"]; y = fl + 1
        cells = {(x, z) for x in range(x0, x1 + 1) for z in range(z0, z1 + 1)
                 if ctx.get(x, fl, z) is not None and ctx.free(x, y, z) and ctx.free(x, y + 1, z)}
        levels.append((y, {"cells": cells, "h": lv.get("height", 5)}))
    _furnish_levels(ctx, levels, rooms, F, region, pt.get("wood", F["wood"]), pt.get("table", F["table"]), pt, pt.get("name", "interior"))
