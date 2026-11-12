"""The Citadel: one fixed, grand layout (Mateo, 2026-11-12).

The ruler's town becomes the Citadel. It is the same plan everywhere, a concentric castle:

  * an octagonal outer curtain (231 wide, chamfered corners) with 19 round towers and the Great Gatehouse
    with its barbican to the south (the gate side),
  * the outer bailey: the town. A ring street, the gate avenue and the market square, and building plots
    of the settlement sizes (S 9x13, M 11x15, L 15x15, G 21x21) so every building a settlement can raise
    has a place. Players raise the buildings themselves, as in their town. Corner fields for the farms.
  * a square inner curtain (115 wide) with seven towers and the inner gatehouse,
  * the inner ward: the processional way, the Great Keep (37 x 37, corner turrets, a central tower),
    two Great plots and two Large plots for the court's buildings, and the walled garden behind the keep.

Coordinates as in bp.py: x east, y up, z south, y = 0 the ground, origin = the Keep Banner, gate to the
south (+z). Everything is in odd sizes so it all has a centre. Built in the "regular" (Vale) style first;
STYLES carries the blocks each region swaps in (Mateo: the Citadel takes on its region's look).

Roofs, cones and arches come from the minecraft-builder engine (the one building engine); straight
masonry is filled here directly, in the same palette.

    python3 citadel.py OUT_DIR [--style vale]       # writes OUT_DIR/citadel.json (plots, gates, keep) and a preview
"""
import os, sys, math, json
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, "..", "..", ".claude", "skills", "minecraft-builder", "scripts"))
from bp import Blueprint
import engine

# ---- the plan, in numbers ------------------------------------------------------------------------------
OUTER = 67           # outer curtain: outer face this far out on the axes, on the old Castle wall line (r66)
CHAMFER = 27         # corners cut off: the diagonal faces
WALL_T = 5           # curtain thickness
OUTER_WALK = 15      # wall walk level (top of the solid wall)
INNER = 35           # inner curtain outer face
INNER_WALK = 21
RING = 40            # the ring street's middle line (a square loop round the inner curtain)
RING_W = 5
AVENUE_W = 7         # the gate avenue
KEEP = (0, -8)       # middle of the Great Keep
KEEP_HALF = 15       # 31 x 31
KEEP_TOP = 45        # roof level of the keep walls
KEEP_FLOORS = [12, 21, 30, 39]
FARM_TO = 100        # farmland runs from the foot of the outer wall out over the plot's edge (MAP.plotRadius is 80)
DIAG = 2 * OUTER - CHAMFER   # |x| + |z| <= DIAG on the diagonal faces

STYLES = {
    "vale": dict(
        smooth="siege:castle_smooth", stone="siege:castle_stone", band="siege:castle_bricks", plinth="siege:castle_cobbled",
        tiles="siege:castle_tiles", corbel="stone_brick_stairs", slab="stone_brick_slab", wallcap="stone_brick_wall",
        roof={"ladder": "VAL-06", "axis": "y", "texture": True}, pane="glass_pane", wood="spruce", dark="dark_oak",
        street=[("stone_bricks", 40), ("cobblestone", 20), ("andesite", 16), ("cracked_stone_bricks", 10), ("tuff", 6), ("gravel", 8)],
        lane=[("grass_path", 50), ("gravel", 20), ("cobblestone", 15), ("coarse_dirt", 15)],
        court="polished_andesite", court2="stone_bricks", ground="grass_block", under="dirt",
        soil=[("grass_block", 62), ("moss_block", 10), ("coarse_dirt", 10), ("podzol", 8), ("gravel", 5)],
        flowers=["poppy", "cornflower", "oxeye_daisy", "allium", "azure_bluet", "red_tulip", "white_tulip", "lily_of_the_valley"],
        bush=["azalea_leaves", "azalea_leaves_flowered", "oak_leaves"], hedge="azalea_leaves",
        trees={"vale_apple": 3, "vale_hawthorn": 3, "vale_silver_birch": 2, "vale_yew": 2},
        frame="stripped_spruce_log", infill="calcite", range_roof=["deepslate_tile_stairs", "deepslate_brick_stairs"],
        range_floor="spruce_planks", door="spruce_door", crops=["carrots", "beetroot", "potatoes", "wheat"],
    ),
}


def h3(x, y, z, s=0):
    n = (x * 73856093) ^ (y * 19349663) ^ (z * 83492791) ^ (s * 2654435761)
    n = (n ^ (n >> 13)) * 1274126177
    return ((n ^ (n >> 16)) & 0xFFFFFF) / float(0xFFFFFF)


def pick(table, x, z, seed=0):
    r, tot, acc = h3(x, 0, z, seed), sum(w for _, w in table), 0
    for n, w in table:
        acc += w / tot
        if r < acc: return n
    return table[-1][0]


def d_outer(x, z):
    """How far inside the outer curtain's outer face a cell is (negative = outside)."""
    ax, az = abs(x), abs(z)
    return min(OUTER - ax, OUTER - az, (DIAG - ax - az) / math.sqrt(2))


def d_inner(x, z):
    return min(INNER - abs(x), INNER - abs(z))


def outward(dx, dz):
    """The side a cell faces, seen from a centre (n/s/e/w)."""
    if abs(dx) >= abs(dz): return "e" if dx > 0 else "w"
    return "s" if dz > 0 else "n"


OPP = {"n": "s", "s": "n", "e": "w", "w": "e"}


class Citadel:
    def __init__(self, style="vale"):
        self.S = STYLES[style]
        self.bp = Blueprint(f"citadel_{style}")
        self.plots, self.towers, self.gates, self.fields = [], [], [], []
        self.cone_cache = {}

    # ---- helpers -------------------------------------------------------------------------------------
    def set(self, x, y, z, n, **p): self.bp.set(x, y, z, n, **p)

    def col(self, x, z, y0, y1, n, **p):
        for y in range(y0, y1 + 1): self.bp.set(x, y, z, n, **p)

    def dressed(self, x, z, top, bands=(), quoin=False):
        """A wall column: cobbled plinth, smooth face, brick string courses, a Castle Stone top course."""
        S = self.S
        for y in range(1, top + 1):
            n = S["smooth"]
            if quoin and y % 2: n = S["stone"]
            if y <= 2: n = S["plinth"]
            if y in bands: n = S["band"]
            if y == top: n = S["stone"]
            self.set(x, y, z, n)

    def found(self, x, z):
        self.col(x, z, -3, 0, self.S["plinth"])

    def cone(self, cx, y, cz, r, h):
        key = (r, h)
        if key not in self.cone_cache:
            spec = {"name": "cone", "materials": {"roof": self.S["roof"]},
                    "shapes": [{"shape": "cone", "at": [0, 0, 0], "r": r, "h": h, "material": "roof"}]}
            self.cone_cache[key] = engine.compute(spec)[0]
        for (x, yy, z), (n, q) in self.cone_cache[key].items():
            bn, bq = engine.to_bp(n, q)
            self.bp.cells[(x + cx, yy + y, z + cz)] = (bn, bq)
        self.set(cx, y + h, cz, "siege:spire_roof")

    # ---- round tower ---------------------------------------------------------------------------------
    def tower(self, cx, cz, r, h, walks=(), door=None, roof=True, name="tower"):
        """A round tower r (x.5 = odd width), walls h high, a corbelled top and a cone roof.
        walks: wall-walk levels that pass through it (doorways there). door: a ground door side."""
        S = self.S
        R = int(r)
        floors = list(range(9, h - 2, 8)) + [h]
        for dx in range(-R - 2, R + 3):
            for dz in range(-R - 2, R + 3):
                d = math.hypot(dx, dz)
                x, z = cx + dx, cz + dz
                if d <= r:
                    self.found(x, z)
                    if d > r - 2:
                        self.dressed(x, z, h, bands=(9, 17, 25, 33, 41))
                        side = outward(dx, dz)
                        along = dz if side in "ew" else dx
                        if d > r - 1 and along == 0:          # slits on the four faces, every floor
                            for f in floors[:-1]:
                                self.set(x, f + 4, z, "siege:arrow_slit")
                    else:
                        self.col(x, z, 1, h - 1, "air")
                        for f in floors: self.set(x, f, z, S["tiles"])
                        self.set(x, 0, z, S["tiles"])
                elif d <= r + 1 and roof:                     # corbel ring under the roof
                    self.set(x, h, z, S["corbel"], facing=OPP[outward(dx, dz)], half="top")
        for w in walks:                                       # wall walk doorways (3 wide, 3 high) on every side
            for dx in range(-R - 1, R + 2):
                for dz in range(-R - 1, R + 2):
                    d = math.hypot(dx, dz)
                    if r - 2 < d <= r and (abs(dx) <= 1 or abs(dz) <= 1):
                        self.col(cx + dx, cz + dz, w + 1, w + 3, "air")
        if door:
            ox, oz = {"n": (0, -1), "s": (0, 1), "e": (1, 0), "w": (-1, 0)}[door]
            for k in range(R - 2, R + 1):
                for s in (-1, 0, 1):
                    x, z = cx + ox * k + (s if oz else 0), cz + oz * k + (s if ox else 0)
                    self.col(x, z, 1, 4, "air")
        if roof:
            self.cone(cx, h + 1, cz, r + 1.5, int(round((r + 1.5) * 1.6)))
        self.towers.append({"name": name, "x": cx, "z": cz, "r": r, "h": h})

    # ---- curtain walls -------------------------------------------------------------------------------
    def curtain(self, dist, reach, walk, slit_y):
        """Every cell with 0 <= dist(x, z) < WALL_T is wall: outer face carries the parapet."""
        S = self.S
        for x in range(-reach, reach + 1):
            for z in range(-reach, reach + 1):
                d = dist(x, z)
                if -2 <= d < 0:                               # battered foot
                    self.col(x, z, -2, 1 if d < -1 else 2, S["plinth"])
                    continue
                if not (0 <= d < WALL_T): continue
                self.found(x, z)
                if d < 1:                                     # outer face, parapet, merlons
                    self.dressed(x, z, walk + 2, bands=(9, walk - 1))
                    if (x + z) % 2 == 0: self.set(x, walk + 3, z, S["stone"])
                    along = x if abs(x) < abs(z) else z
                    if along % 9 == 0: self.set(x, slit_y, z, "siege:arrow_slit")
                elif d >= WALL_T - 1:                         # inner face with a low parapet
                    self.dressed(x, z, walk + 1, bands=(9,))
                else:
                    self.col(x, z, 1, walk - 1, S["smooth"])
                    self.set(x, walk, z, S["tiles"])

    # ---- gatehouses ----------------------------------------------------------------------------------
    def gatehouse(self, zf, zb, half, top, tower_r, tower_h, walk, name, barbican=0, tower_back=3):
        """A gate passage 7 wide along z from zb (inner) to zf (outer), its block |x| <= half, two
        round towers on the outer corners, portcullises at both ends, a pointed arch 11 high."""
        S = self.S
        for x in range(-half, half + 1):
            for z in range(zb, zf + 1):
                self.found(x, z)
                edge = abs(x) == half or z in (zb, zf)
                self.dressed(x, z, top, bands=(9, walk - 1, top - 6), quoin=abs(x) == half and z in (zb, zf))
                if edge and (x + z) % 2 == 0: self.set(x, top + 1, z, S["stone"])
                if not edge: self.set(x, top, z, S["tiles"])
        # the passage: 7 wide, walls straight to 8 then a pointed arch to 11
        for z in range(zb, zf + 1):
            for x in range(-3, 4):
                hgt = {3: 8, 2: 10, 1: 11, 0: 11}[abs(x)]
                self.col(x, z, 1, hgt, "air")
                self.set(x, 0, z, S["tiles"])
        for zp in (zf - 1, zb + 1):
            for x in range(-3, 4):
                hgt = {3: 8, 2: 10, 1: 11, 0: 11}[abs(x)]
                for y in range(1, hgt + 1): self.set(x, y, zp, "siege:portcullis")
        # rooms over the gate and the hangings in the ruler's colour
        for x in range(-half + 1, half):
            for z in range(zb + 1, zf):
                self.col(x, z, 13, top - 1, "air")
                self.set(x, 13, z, S["tiles"])
        for x in range(-half + 1, half):
            if abs(x) <= 4: self.set(x, 18, zf, "siege:arrow_slit") if x % 2 == 0 else None
        for sx in (-1, 1):
            self.tower(sx * (half + 2), zf - tower_back, tower_r, tower_h, walks=(walk,), name=f"{name} tower")
            for k in (-1, 0, 1):
                tx = sx * (half + 2) + k
                tz = zf - tower_back + int(tower_r) + 1
                for y in range(9, tower_h - 4): self.set(tx, y, tz, "red_wool")
        # a brazier either side of the gate and a lantern in the arch
        for sx in (-5, 5): self.set(sx, top + 1, zf, "siege:brazier")
        self.set(0, 11, zf, "lantern", hanging=True); self.set(0, 11, zb, "lantern", hanging=True)
        self.gates.append({"name": name, "x": 0, "z": zf, "inner": zb})
        if barbican:
            zo = zf + barbican
            for z in range(zf + 1, zo + 1):
                for sx in (-1, 1):
                    for k in range(3):
                        x = sx * (half - k)
                        self.found(x, z)
                        self.dressed(x, z, 11 if k == 0 else 10, bands=(7,))
                        if k == 0 and z % 2 == 0: self.set(x, 12, z, S["stone"])
                for x in range(-half + 3, half - 2): self.set(x, 0, z, S["tiles"])
            for x in range(-half, half + 1):                 # the barbican's front wall and outer gate
                for z in (zo, zo + 1, zo + 2):
                    self.found(x, z); self.dressed(x, z, 13, bands=(7,))
                    if z == zo + 2 and x % 2 == 0: self.set(x, 14, z, S["stone"])
                for z in (zo, zo + 1, zo + 2):
                    if abs(x) <= 3:
                        self.col(x, z, 1, {3: 6, 2: 7, 1: 8, 0: 8}[abs(x)], "air")
                        if z == zo + 1:
                            for y in range(1, {3: 6, 2: 7, 1: 8, 0: 8}[abs(x)] + 1): self.set(x, y, z, "siege:portcullis")
            for sx in (-1, 1):
                self.tower(sx * half, zo + 1, 4.5, 17, name="barbican turret")
            self.gates[-1]["outer"] = zo + 2

    # ---- the Great Keep ------------------------------------------------------------------------------
    def keep(self):
        S = self.S
        kx, kz = KEEP
        H, TOP = KEEP_HALF, KEEP_TOP
        for dx in range(-H, H + 1):
            for dz in range(-H, H + 1):
                x, z = kx + dx, kz + dz
                ring = max(abs(dx), abs(dz))
                self.found(x, z)
                if ring >= H - 2:
                    corner = abs(dx) >= H - 2 and abs(dz) >= H - 2
                    self.dressed(x, z, TOP, bands=KEEP_FLOORS if ring == H else (), quoin=corner)
                    if ring == H:
                        along = dx if abs(dz) == H else dz
                        # pilasters every 6, a block proud
                        if along % 6 == 0 and not corner:
                            ox, oz = (0, 1 if dz > 0 else -1) if abs(dz) == H else (1 if dx > 0 else -1, 0)
                            self.dressed(x + ox, z + oz, TOP + 1, bands=KEEP_FLOORS, quoin=True)
                        # parapet and merlons
                        self.set(x, TOP + 1, z, S["smooth"]); self.set(x, TOP + 2, z, S["stone"])
                        if (dx + dz) % 2 == 0: self.set(x, TOP + 3, z, S["stone"])
                        # windows: lancets 1 x 3 between the pilasters on the upper floors, slits on the ground floor
                        if not corner and along % 6 == 3 and abs(along) <= H - 4:
                            for f in KEEP_FLOORS:
                                for y in range(f + 3, f + 7): self.set(x, y, z, S["pane"])
                                self.set(x, f + 7, z, S["band"])
                            self.set(x, 6, z, "siege:arrow_slit"); self.set(x, 7, z, "siege:arrow_slit")
                    elif ring < H:
                        if not corner and ((abs(dx) == H - 1 and dz % 6 == 3) or (abs(dz) == H - 1 and dx % 6 == 3)):
                            for f in KEEP_FLOORS:
                                for y in range(f + 3, f + 7): self.set(x, y, z, "air")
                else:
                    self.set(x, 0, z, S["tiles"] if (dx + dz) % 2 else S["court"])
                    self.col(x, z, 1, TOP - 1, "air")
                    for f in KEEP_FLOORS: self.set(x, f, z, S["tiles"])
                    self.set(x, TOP, z, S["tiles"])
        # the great door: 5 wide, a pointed arch 9 high, on the south face, and the forebuilding in front
        zf = kz + H
        for dx in range(-7, 8):
            for z in range(zf + 1, zf + 10):
                edge = abs(dx) == 7 or z == zf + 9
                self.found(kx + dx, z)
                if edge:
                    self.dressed(kx + dx, z, 19, bands=(13,), quoin=abs(dx) == 7 and z == zf + 9)
                    if (dx + z) % 2 == 0: self.set(kx + dx, 20, z, S["stone"])
                else:
                    self.set(kx + dx, 0, z, S["court"]); self.col(kx + dx, z, 1, 18, "air"); self.set(kx + dx, 19, z, S["tiles"])
        for z in range(zf - 2, zf + 10):
            for dx in range(-2, 3):
                self.col(kx + dx, z, 1, {2: 7, 1: 8, 0: 9}[abs(dx)], "air")
        for dx in (-5, -4, 4, 5):                              # ruler's colour hangings on the forebuilding
            self.col(kx + dx, zf + 10, 5, 16, "red_wool")
        self.set(kx, 9, zf + 9, "lantern", hanging=True)
        # long hangings down the keep's faces
        for t in (-9, 9):
            for side in ("s", "n", "e", "w"):
                for k in (-1, 0, 1):
                    if side == "s": x, z = kx + t + k, kz + H + 1
                    elif side == "n": x, z = kx + t + k, kz - H - 1
                    elif side == "e": x, z = kx + H + 1, kz + t + k
                    else: x, z = kx - H - 1, kz + t + k
                    self.col(x, z, 22, 46, "red_wool")
        # the throne hall: two rows of columns, the carpet, the dais and the throne at the north end
        for dz in range(-H + 3, H - 2, 6):
            for sx in (-8, 8):
                self.col(kx + sx, kz + dz, 1, 12, S["stone"])
                self.set(kx + sx, 12, kz + dz, S["band"])
        for dz in range(-H + 6, H - 1): self.set(kx, 1, kz + dz, "red_carpet"); self.set(kx - 1, 1, kz + dz, "red_carpet"); self.set(kx + 1, 1, kz + dz, "red_carpet")
        for dx in range(-5, 6):
            for dz in range(-H + 3, -H + 6):
                self.set(kx + dx, 1, kz + dz, "gold_block" if abs(dx) == 5 or dz == -H + 5 else "quartz_block")
        self.set(kx, 2, kz - H + 4, "siege:throne")
        for dx in (-4, 4): self.set(kx + dx, 2, kz - H + 4, "siege:brazier")
        # corner turrets, rising past the roof, ladders up the north-west one
        for sx in (-1, 1):
            for sz in (-1, 1):
                self.tower(kx + sx * H, kz + sz * H, 4.5, TOP + 8, walks=(TOP,), name="keep turret")
        self.col(kx - H + 3, kz - H + 3, 1, TOP, "ladder", facing="s")
        # the central tower: 15 x 15, up to 73, a cone roof and the tallest spire in the land
        CT = 7
        for dx in range(-CT, CT + 1):
            for dz in range(-CT, CT + 1):
                x, z = kx + dx, kz - 6 + dz
                ring = max(abs(dx), abs(dz))
                if ring == CT:
                    corner = abs(dx) == CT and abs(dz) == CT
                    for y in range(TOP + 1, TOP + 31):
                        self.set(x, y, z, S["stone"] if corner and y % 2 else S["smooth"])
                    self.set(x, TOP + 12, z, S["band"]); self.set(x, TOP + 22, z, S["band"]); self.set(x, TOP + 30, z, S["stone"])
                    along = dx if abs(dz) == CT else dz
                    if along in (-3, 0, 3) and not corner:
                        for y in list(range(TOP + 15, TOP + 20)) + list(range(TOP + 24, TOP + 28)): self.set(x, y, z, S["pane"])
                elif ring < CT:
                    self.col(x, z, TOP + 1, TOP + 29, "air")
                    self.set(x, TOP + 12, z, S["tiles"]); self.set(x, TOP + 22, z, S["tiles"]); self.set(x, TOP + 30, z, S["tiles"])
                if ring == CT + 1:
                    self.set(x, TOP + 30, z, S["corbel"], facing=OPP[outward(dx, dz)], half="top")
        self.cone(kx, TOP + 31, kz - 6, 9.5, 19)
        self.keep_box = (kx - H, kz - H, kx + H, kz + zf - kz + 9)

    # ---- streets, plots, fields ----------------------------------------------------------------------
    def ground(self):
        """Streets and the court, paved in the style's street mix; lanterns on posts along them."""
        S = self.S
        self.street = set()
        def pave(x, z, table=None, seed=3):
            self.set(x, 0, z, pick(table or S["street"], x, z, seed)); self.street.add((x, z))
        h = RING_W // 2
        # the ring street: a square loop hugging the inner curtain
        for t in range(-RING - h, RING + h + 1):
            for w in range(RING - h, RING + h + 1):
                for x, z in ((t, w), (t, -w), (w, t), (-w, t)):
                    if d_inner(x, z) < 0: pave(x, z)
        # the gate avenue, inner gate to outer gate, then on out through the barbican and the fields
        a = AVENUE_W // 2
        for z in range(INNER + 1, FARM_TO + 6):
            for x in range(-a, a + 1): pave(x, z)
        # the inner ward: the court before the keep's door
        kz = KEEP[1] + KEEP_HALF + 10
        for x in range(-13, 14):
            for z in range(kz, INNER - 11):
                self.set(x, 0, z, S["court"] if (x + z) % 2 else S["court2"]); self.street.add((x, z))
        for sx in (-12, 12):
            self.set(sx, 1, kz + 2, S["stone"]); self.set(sx, 2, kz + 2, "siege:brazier")
        # lanterns on posts along the ring street's outer kerb, every 8
        for t in range(-RING + 4, RING - 3, 8):
            w = RING + h + 1
            for x, z in ((t, w), (t, -w), (w, t), (-w, t)):
                if abs(x) <= a + 1 and z > 0: continue
                self.lamp(x, z)

    def lamp(self, x, z):
        w = self.S["wood"]
        if self.bp.get(x, 1, z)[0] not in ("keep", "air"): return
        self.set(x, 1, z, self.S["wallcap"]); self.set(x, 2, z, f"{w}_fence"); self.set(x, 3, z, f"{w}_fence"); self.set(x, 4, z, "lantern")

    def blocked(self, x0, z0, x1, z1, margin=1):
        """True if a plot rectangle hits a wall, a tower, the keep, a street or another plot."""
        for x in range(x0 - margin, x1 + margin + 1):
            for z in range(z0 - margin, z1 + margin + 1):
                if d_outer(x, z) < WALL_T + 1: return True
                if d_inner(x, z) >= -1: return True
                if (x, z) in self.street or (x, z) in self.taken: return True
        for t in self.towers:
            cx, cz = min(max(t["x"], x0), x1), min(max(t["z"], z0), z1)
            if math.hypot(cx - t["x"], cz - t["z"]) <= t["r"] + margin + 0.5: return True
        return False

    def plot(self, size, x0, z0, w, d, door, where):
        x1, z1 = x0 + w - 1, z0 + d - 1
        if self.blocked(x0, z0, x1, z1): return False
        for x in range(x0, x1 + 1):
            for z in range(z0, z1 + 1): self.taken.add((x, z))
        S = self.S
        for x in range(x0, x1 + 1):                            # the plot's edge, a path you can see from the walls
            for z in range(z0, z1 + 1):
                if x in (x0, x1) or z in (z0, z1): self.set(x, 0, z, pick(S["lane"], x, z, 11))
        for x, z in ((x0, z0), (x1, z0), (x0, z1), (x1, z1)): self.set(x, 0, z, S["court"])
        self.plots.append({"size": size, "x0": x0, "z0": z0, "x1": x1, "z1": z1, "door": door, "where": where})
        return True

    def lay_plots(self):
        """One row of plots on each side of the bailey, packed a block apart, doors onto the ring street."""
        SIZES = {"S": (9, 13), "M": (11, 15), "L": (15, 15)}
        h = RING_W // 2
        front = RING + h + 2                                   # first plot row starts here (one block of kerb)
        order = ["S","M","M","L","S","M","S","S","M","L"]
        k = 0
        for side in ("s", "e", "n", "w"):
            t = -OUTER
            while t <= OUTER:
                placed = False
                for j in range(3):
                    size = order[(k + j) % len(order)] if j == 0 else ("S" if j == 1 else "M")
                    w, d = SIZES[size]
                    if side == "s": x0, z0, ww, dd, door = t, front, w, d, "n"
                    elif side == "n": x0, z0, ww, dd, door = t, -front - d + 1, w, d, "s"
                    elif side == "e": x0, z0, ww, dd, door = front, t, d, w, "w"
                    else: x0, z0, ww, dd, door = -front - d + 1, t, d, w, "e"
                    if self.plot(size, x0, z0, ww, dd, door, f"{side} row"):
                        t += w + 1; k += 1; placed = True; break
                if not placed: t += 1
        self.gardens()

    # ---- dressing: trees, ground, planting ------------------------------------------------------------
    TREE_DB = os.environ.get("CITADEL_TREES", "/mnt/project-files/trees/db")

    def tree_stamp(self, species, size, variant):
        key = (species, size, variant)
        if not hasattr(self, "_trees"): self._trees = {}
        if key not in self._trees:
            path = os.path.join(self.TREE_DB, species, f"{species}_{size}_{variant}.stamp.json")
            if not os.path.exists(path): self._trees[key] = None
            else:
                d = json.load(open(path)); o = d["origin"]; pal = d["palette"]
                self._trees[key] = [(x + o[0], y + o[1], z + o[2], pal[k]["name"].replace("siege:old_", "").replace("minecraft:", ""), pal[k].get("states") or {})
                                    for x, y, z, k in d["blocks"]]
        return self._trees[key]

    def plant_tree(self, x, z, seed, size_hint=None):
        sp = self.S["trees"]; tot = sum(sp.values()); r = h3(x, 0, z, seed) * tot
        for name, w in sp.items():
            r -= w
            if r < 0: break
        size = size_hint or ("mature" if h3(x, 1, z, seed) < 0.6 else "young")
        cells = self.tree_stamp(name, size, int(h3(x, 2, z, seed) * 4))
        if not cells: return False
        for dx, y, dz, n, st in cells:
            if y <= 0: continue                                 # keep our own ground
            c = (x + dx, y, z + dz)
            if self.bp.cells.get(c, ("keep",))[0] != "keep": continue
            self.bp.cells[c] = (n, {"raw": st} if st else {})
        self.trees.append({"x": x, "z": z, "species": name, "size": size})
        return True

    def free(self, x, z):
        """Inside the walls, nothing built, paved or planned here."""
        if (x, z) in self.street or (x, z) in self.taken: return False
        if self.bp.get(x, 0, z)[0] != "keep" or self.bp.get(x, 1, z)[0] != "keep": return False
        return True

    def gardens(self):
        """Every bit of ground no plot or street takes becomes planted: mixed ground, trees from the tree
        database, clipped bushes, flower beds and hedges along the plot backs, lanterns in the dark corners.
        Nothing inside the Citadel is left as bare lawn."""
        S = self.S
        self.trees = []
        cells = [(x, z) for x in range(-OUTER, OUTER + 1) for z in range(-OUTER, OUTER + 1)
                 if d_outer(x, z) >= WALL_T and not (0 <= d_inner(x, z) < WALL_T)
                 and not any(math.hypot(x - t["x"], z - t["z"]) <= t["r"] + 0.5 for t in self.towers)
                 and self.free(x, z)]
        free = set(cells)
        kx0, kz0, kx1, kz1 = self.keep_box
        # trees where there is room for a crown: three blocks clear of plots, streets, walls and towers
        def roomy(x, z, r=3):
            for dx in range(-r, r + 1):
                for dz in range(-r, r + 1):
                    if (x + dx, z + dz) not in free and not (abs(dx) + abs(dz) > r + 1): return False
            return True
        spots = sorted(cells, key=lambda c: h3(c[0], 5, c[1], 77))
        placed = []
        for x, z in spots:
            if any(abs(x - px) < 7 and abs(z - pz) < 7 for px, pz in placed): continue
            if not roomy(x, z): continue
            if self.plant_tree(x, z, 19): placed.append((x, z))
        for x, z in spots:                                     # smaller trees where only a little crown fits
            if any(abs(x - px) < 5 and abs(z - pz) < 5 for px, pz in placed): continue
            if not roomy(x, z, 2): continue
            if self.plant_tree(x, z, 29, "young" if h3(x, 3, z, 5) < 0.5 else "sapling"): placed.append((x, z))
        for x, z in cells:
            if self.bp.get(x, 1, z)[0] != "keep": continue      # a trunk or low branch
            self.set(x, 0, z, pick(S["soil"], x // 2, z // 2, 23))
            r = h3(x, 0, z, 41)
            # beside a plot or a wall: a hedge, a bush or a bed of flowers
            near_plot = any((x + dx, z + dz) in self.taken for dx in (-1, 0, 1) for dz in (-1, 0, 1))
            if near_plot:
                if r < 0.55: self.set(x, 1, z, S["hedge"], raw={"persistent_bit": True})
                elif r < 0.85: self.set(x, 1, z, S["flowers"][int(r * 997) % len(S["flowers"])])
                else: self.set(x, 0, z, "grass_block"); self.set(x, 1, z, "short_grass")
            elif r < 0.12: self.set(x, 1, z, S["bush"][int(r * 997) % len(S["bush"])], raw={"persistent_bit": True})
            elif r < 0.38: self.set(x, 0, z, "grass_block"); self.set(x, 1, z, S["flowers"][int(r * 997) % len(S["flowers"])])
            elif r < 0.62: self.set(x, 0, z, "grass_block"); self.set(x, 1, z, "short_grass")
            elif r < 0.66: self.set(x, 0, z, "grass_block"); self.set(x, 1, z, "fern")
        # lanterns on posts in the bigger open patches, so the corners are lit at night
        for x, z in spots[::37]:
            if self.bp.get(x, 1, z)[0] in ("keep", "short_grass", "fern") and roomy(x, z, 1): self.lamp(x, z)

    # ---- the inner ward: ranges against the curtain, the garden round the keep -----------------------
    def inner_ward(self):
        """The inner ward is lived in: two-storey ranges built against the inside of the inner curtain
        (stone below, timber above, a lean-to roof running up to the wall walk), a paved lane round the
        keep, parterre gardens either side of the court and a kitchen garden behind the keep."""
        S = self.S
        face = INNER - WALL_T                                  # inner face of the inner curtain (x = +-30)
        D = 6                                                  # range depth
        kx, kz = KEEP
        for sx in (-1, 1):
            for z0, z1 in ((-25, -7), (7, 23)):
                self.range_block(sx, face - D, face - 1, z0, z1)
        # the lane round the keep, paved, with lanterns at the corners
        H = KEEP_HALF
        for x in range(kx - H - 5, kx + H + 6):
            for z in range(kz - H - 5, kz + H + 10):
                if abs(x - kx) <= H + 5 and (abs(x - kx) > H or z < kz - H) and z < kz + H + 10:
                    if self.bp.get(x, 1, z)[0] == "keep" and self.bp.get(x, 0, z)[0] == "keep" and abs(x) < face - D:
                        self.set(x, 0, z, pick(S["street"], x, z, 31)); self.street.add((x, z))
        for x in (kx - H - 3, kx + H + 3):
            for z in (kz - H - 3, kz + 2, kz + H + 8):
                self.set(x, 0, z, S["stone"]); self.lamp(x, z) if self.bp.get(x, 1, z)[0] == "keep" else None
        # the kitchen garden behind the keep: beds of crops in rows with paths between
        for x in range(-17, 18):
            for z in range(-face + 1, kz - H - 5):
                if self.bp.get(x, 1, z)[0] != "keep": continue
                if x % 4 == 0: self.set(x, 0, z, pick(S["lane"], x, z, 3)); continue
                if x % 4 == 2 and z % 4 == 0: self.set(x, 0, z, "water"); continue
                self.set(x, 0, z, "farmland"); self.set(x, 1, z, S["crops"][(x // 4) % len(S["crops"])])
                self.taken.add((x, z))
        # parterres either side of the court: box hedges round gravel beds, a fountain in the middle
        cz0, cz1 = kz + H + 10, INNER - 12
        for sx in (-1, 1):
            xa, xb = sorted((sx * 15, sx * (face - D - 2)))
            mx, mz = (xa + xb) // 2, (cz0 + cz1) // 2
            for x in range(xa, xb + 1):
                for z in range(cz0, cz1 + 1):
                    if self.bp.get(x, 1, z)[0] != "keep" or self.bp.get(x, 0, z)[0] != "keep": continue
                    edge = x in (xa, xb) or z in (cz0, cz1)
                    cross = x == mx or z == mz
                    if edge or (abs(x - mx) == 3 and abs(z - mz) <= 3) or (abs(z - mz) == 3 and abs(x - mx) <= 3):
                        self.set(x, 0, z, "grass_block"); self.set(x, 1, z, S["hedge"], raw={"persistent_bit": True})
                    elif cross: self.set(x, 0, z, "gravel")
                    else:
                        self.set(x, 0, z, "grass_block")
                        if (x + z) % 2 == 0: self.set(x, 1, z, S["flowers"][(x * 7 + z * 3) % len(S["flowers"])])
                    self.taken.add((x, z))
            # the fountain: a basin of stone with water and a spout
            for dx in range(-2, 3):
                for dz in range(-2, 3):
                    x, z = mx + dx, mz + dz
                    if max(abs(dx), abs(dz)) == 2: self.set(x, 0, z, S["stone"]); self.set(x, 1, z, S["slab"])
                    else: self.set(x, 0, z, "water"); self.set(x, 1, z, "air")
            self.col(mx, mz, 0, 3, S["wallcap"]); self.set(mx, 4, mz, "water")

    def range_block(self, sx, a0, a1, z0, z1):
        """One range against the curtain on side sx: x from a0 to a1 measured outward (|x|), z0..z1."""
        S = self.S
        xs = [sx * a for a in range(a0, a1 + 1)]
        inner_x = sx * a0                                      # the ward-facing wall
        for x in xs:
            for z in range(z0, z1 + 1):
                edge = x == inner_x or z in (z0, z1)
                self.found(x, z)
                self.set(x, 0, z, S["plinth"])
                if edge:
                    post = z in (z0, z1) and x == inner_x or (x == inner_x and (z - z0) % 4 == 0)
                    for y in range(1, 6): self.set(x, y, z, S["stone"] if post else S["smooth"])
                    self.set(x, 1, z, S["plinth"])
                    for y in range(6, 10): self.set(x, y, z, S["frame"] if post or y == 6 else S["infill"])
                    self.set(x, 6, z, S["frame"], axis="z" if x == inner_x else "x")
                else:
                    self.col(x, z, 1, 9, "air"); self.set(x, 5, z, S["range_floor"])
        # windows and doors on the ward face
        for z in range(z0 + 2, z1 - 1, 4):
            for y in (3, 8):
                self.set(inner_x, y, z, S["pane"])
            if (z - z0) % 8 == 2:
                self.set(inner_x, 1, z, S["door"], facing="w" if sx > 0 else "e")
                self.set(inner_x, 2, z, S["door"], facing="w" if sx > 0 else "e", upper=True)
                self.set(inner_x, 3, z, "lantern" if False else S["pane"])
        # the lean-to roof: from the ward face (low) up to the curtain (high)
        span = a1 - a0 + 2
        for k in range(span + 1):
            a = a0 - 1 + k
            y = 10 + k
            for z in range(z0 - 1, z1 + 2):
                roof = S["range_roof"][0 if h3(a, y, z, 9) < 0.65 else 1]
                self.set(sx * a, y, z, roof, facing="e" if sx > 0 else "w")
                for yy in range(10, y): 
                    if a > a0 - 1 and (z in (z0, z1)): self.set(sx * a, yy, z, S["infill"])
        self.ranges = getattr(self, "ranges", []) + [{"side": sx, "z0": z0, "z1": z1}]

    def farmland(self):
        """Outside the walls: fields in strips out to the edge of the plot, each strip its own crop,
        watered every ninth row, a farm track round the wall's foot and hedges between the strips."""
        S = self.S
        CROPS = [("wheat", {}), ("carrots", {}), ("potatoes", {}), ("wheat", {}), ("beetroot", {})]
        a = AVENUE_W // 2
        n = 0
        for x in range(-FARM_TO, FARM_TO + 1):
            for z in range(-FARM_TO, FARM_TO + 1):
                if math.hypot(x, z) > FARM_TO: continue
                d = d_outer(x, z)
                if d >= -2: continue
                if (x, z) in self.street or self.bp.get(x, 1, z)[0] != "keep": continue
                if any(math.hypot(x - t["x"], z - t["z"]) <= t["r"] + 1 for t in self.towers): continue
                if -6 <= d < -2:                               # the track round the wall's foot
                    self.set(x, 0, z, pick(S["lane"], x, z, 13)); continue
                ang = (math.degrees(math.atan2(z, x)) + 360) % 360
                strip = int(ang // 12)
                if abs(ang - strip * 12) < 0.6 or abs(ang - (strip + 1) * 12) < 0.6:   # hedge between strips
                    self.set(x, 0, z, "grass_block"); self.set(x, 1, z, "oak_leaves", raw={"persistent_bit": True}); continue
                if (x % 9 == 0 and z % 3 == 0) or (z % 9 == 0 and x % 3 == 0 and False):
                    self.set(x, 0, z, "water"); continue
                crop, q = CROPS[strip % len(CROPS)]
                self.set(x, 0, z, "farmland"); self.set(x, 1, z, crop, **q); n += 1
        self.fields.append({"cells": n})

    # ---- the whole thing -----------------------------------------------------------------------------
    def build(self):
        S = self.S
        # outer curtain on the old wall line, towers standing out from its face
        self.curtain(d_outer, OUTER + 2, OUTER_WALK, 12)
        v = OUTER - CHAMFER
        verts = [(v, OUTER), (OUTER, v), (OUTER, -v), (v, -OUTER), (-v, -OUTER), (-OUTER, -v), (-OUTER, v), (-v, OUTER)]
        for vx, vz in verts:
            self.tower(vx - (1 if vx > 0 else -1), vz - (1 if vz > 0 else -1), 7.5, 27, walks=(OUTER_WALK,), name="outer corner tower")
        for side in ("n", "e", "w"):
            x, z = {"n": (0, -OUTER), "e": (OUTER, 0), "w": (-OUTER, 0)}[side]
            self.tower(x, z, 6.5, 25, walks=(OUTER_WALK,), name="outer tower")
        self.gatehouse(OUTER + 5, OUTER - 9, 9, 25, 7.5, 31, OUTER_WALK, "Great Gatehouse", barbican=11)
        # inner curtain and its towers
        self.curtain(lambda x, z: d_inner(x, z), INNER + 2, INNER_WALK, 15)
        for sx in (-1, 1):
            for sz in (-1, 1):
                self.tower(sx * (INNER - 2), sz * (INNER - 2), 7.5, 35, walks=(INNER_WALK,), name="inner corner tower")
        for side in ("n", "e", "w"):
            x, z = {"n": (0, -INNER + 3), "e": (INNER - 3, 0), "w": (-INNER + 3, 0)}[side]
            self.tower(x, z, 5.5, 31, walks=(INNER_WALK,), name="inner tower")
        self.gatehouse(INNER + 1, INNER - 11, 9, 29, 5.5, 35, INNER_WALK, "inner gatehouse", tower_back=5)
        self.keep()
        self.ground()
        self.taken = set()
        self.inner_ward()
        self.lay_plots()
        self.farmland()
        self.bp.finish()
        return self.bp

    def summary(self):
        from collections import Counter
        c = Counter(p["size"] for p in self.plots)
        lo, hi = self.bp.bounds()
        return {"plots": dict(c), "plot_count": len(self.plots), "fields": len(self.fields), "towers": len(self.towers),
                "bounds": [lo, hi], "blocks": sum(1 for v in self.bp.cells.values() if v[0] not in ("air", "keep"))}

    # ---- a preview with every plot built on (what a finished Citadel looks like) ---------------------
    def fill(self, region="vale"):
        """Raises a settlement building of this region on every plot, turned to face its street. Only for
        previews: in game the players choose and raise the buildings themselves."""
        import settle_buildings as SB
        makers = {**SB.BUILDERS, **SB.BLOCK_BUILDERS}
        cache = {}
        def get(bid, deg):
            if (bid, deg) not in cache:
                b = makers[bid](region).rotated(deg) if deg else makers[bid](region).finish()
                cache[(bid, deg)] = (b, b.bounds())
            return cache[(bid, deg)]
        CHOICE = {   # what goes on each size of plot, in turn
            "S": ["cottage", "cottage", "watchtower", "cottage", "cottage", "garden", "cottage", "well", "cottage"],
            "M": ["smithy", "cottage", "quartermaster", "cottage", "stable", "cottage"],
            "L": ["stables_2", "storehouse", "library", "breeder_yard", "smithy", "storehouse"],
            "G": ["barracks", "library"],
            "inner L": ["storehouse", "quartermaster"],
        }
        turn = {"s": 0, "w": 90, "n": 180, "e": 270}
        count = {}
        self.filled = []
        for pl in self.plots:
            key = ("inner " + pl["size"]) if pl["where"] == "inner ward" and pl["size"] == "L" else pl["size"]
            seq = CHOICE.get(key, ["market", "smithy", "market", "cottage"])
            i = count.get(key, 0); count[key] = i + 1
            deg = turn[pl["door"]]
            for k in range(len(seq)):
                bid = seq[(i + k) % len(seq)]
                b, (lo, hi) = get(bid, deg)
                if hi[0] - lo[0] <= pl["x1"] - pl["x0"] and hi[2] - lo[2] <= pl["z1"] - pl["z0"]: break
            else:
                continue
            # centred across the plot, front edge one block in from the plot's street side
            w, d = hi[0] - lo[0], hi[2] - lo[2]
            cx = (pl["x0"] + pl["x1"]) // 2 - (lo[0] + w // 2)
            cz = (pl["z0"] + pl["z1"]) // 2 - (lo[2] + d // 2)
            if pl["door"] == "s": cz = pl["z1"] - hi[2]
            if pl["door"] == "n": cz = pl["z0"] - lo[2]
            if pl["door"] == "e": cx = pl["x1"] - hi[0]
            if pl["door"] == "w": cx = pl["x0"] - lo[0]
            for (x, y, z), v in b.cells.items():
                if v[0] == "keep": continue
                self.bp.cells[(x + cx, y, z + cz)] = v
            self.filled.append(bid)
        self.bp.finish()
        return self.filled


def build(style="vale"):
    c = Citadel(style); c.build(); return c


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser(); ap.add_argument("out"); ap.add_argument("--style", default="vale")
    a = ap.parse_args()
    c = build(a.style)
    os.makedirs(a.out, exist_ok=True)
    s = c.summary(); print(json.dumps(s))
    json.dump({"plots": c.plots, "towers": c.towers, "gates": c.gates, "fields": c.fields, "summary": s},
              open(os.path.join(a.out, "citadel.json"), "w"), indent=1)
