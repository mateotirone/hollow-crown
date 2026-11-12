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
OUTER = 115          # outer curtain: outer face this far out on the axes
CHAMFER = 35         # corners cut off: the diagonal faces
WALL_T = 5           # curtain thickness
OUTER_WALK = 17      # wall walk level (top of the solid wall)
INNER = 57           # inner curtain outer face
INNER_WALK = 23
RING = 85            # the ring street's middle line (a square loop through the bailey)
RING_W = 5
AVENUE_W = 7         # the gate avenue
KEEP = (0, -15)      # middle of the Great Keep
KEEP_HALF = 18       # 37 x 37
KEEP_TOP = 51        # roof level of the keep walls
KEEP_FLOORS = [13, 23, 33, 43]
DIAG = 2 * OUTER - CHAMFER   # |x| + |z| <= DIAG on the diagonal faces

STYLES = {
    "vale": dict(
        smooth="siege:castle_smooth", stone="siege:castle_stone", band="siege:castle_bricks", plinth="siege:castle_cobbled",
        tiles="siege:castle_tiles", corbel="stone_brick_stairs", slab="stone_brick_slab", wallcap="stone_brick_wall",
        roof={"ladder": "VAL-06", "axis": "y", "texture": True}, pane="glass_pane", wood="spruce", dark="dark_oak",
        street=[("stone_bricks", 40), ("cobblestone", 20), ("andesite", 16), ("cracked_stone_bricks", 10), ("tuff", 6), ("gravel", 8)],
        lane=[("grass_path", 50), ("gravel", 20), ("cobblestone", 15), ("coarse_dirt", 15)],
        court="polished_andesite", court2="stone_bricks", ground="grass_block", under="dirt",
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
    def gatehouse(self, zf, zb, half, top, tower_r, tower_h, walk, name, barbican=0):
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
            self.tower(sx * (half + 2), zf - 3, tower_r, tower_h, walks=(walk,), name=f"{name} tower")
            for k in (-1, 0, 1):
                tx = sx * (half + 2) + k
                tz = zf - 3 + int(tower_r) + 1
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
                self.tower(kx + sx * H, kz + sz * H, 5.5, TOP + 8, walks=(TOP,), name="keep turret")
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
        """Streets and squares, paved in the style's street mix; lanterns on posts along them."""
        S = self.S
        self.street = set()
        def pave(x, z, table=None, seed=3):
            self.set(x, 0, z, pick(table or S["street"], x, z, seed)); self.street.add((x, z))
        h = RING_W // 2
        # the ring street (a square loop), clipped by nothing: it runs inside the outer wall everywhere
        for t in range(-RING - h, RING + h + 1):
            for w in range(RING - h, RING + h + 1):
                for x, z in ((t, w), (t, -w), (w, t), (-w, t)):
                    pave(x, z)
        # the gate avenue, inner gate to outer gate, and lanes from the inner towers out to the outer towers
        a = AVENUE_W // 2
        for z in range(INNER + 8, OUTER - 4):
            for x in range(-a, a + 1): pave(x, z)
        for x in range(-a, a + 1):                               # through the barbican to the outside road
            for z in range(OUTER, OUTER + 50): pave(x, z)
        for t in range(INNER + 9, OUTER - 7):
            for w in (-1, 0, 1):
                pave(t, w, S["lane"]); pave(-t, w, S["lane"]); pave(w, -t, S["lane"])
        # the market square by the gate: 31 wide, 13 deep, a market cross in the middle
        for x in range(-15, 16):
            for z in range(RING + h + 1, RING + h + 14):
                pave(x, z, seed=5)
        mz = RING + h + 7
        for y in range(1, 4): self.set(0, y, mz, self.S["stone"])
        self.set(0, 4, mz, self.S["wallcap"]); self.set(0, 5, mz, "lantern")
        for dx in (-1, 0, 1):
            for dz in (-1, 0, 1):
                if dx or dz: self.set(dx, 1, mz + dz, self.S["slab"])
        # the inner ward: the processional way, the court, lawns either side
        for z in range(KEEP[1] + KEEP_HALF + 10, INNER + 1):
            for x in range(-4, 5):
                self.set(x, 0, z, S["court"] if abs(x) <= 2 else S["court2"]); self.street.add((x, z))
        for x in range(-13, 14):                                  # the court before the keep's door
            for z in range(KEEP[1] + KEEP_HALF + 10, KEEP[1] + KEEP_HALF + 23):
                self.set(x, 0, z, S["court"] if (x + z) % 2 else S["court2"]); self.street.add((x, z))
        for z in range(KEEP[1] + KEEP_HALF + 26, INNER - 6, 6):   # braziers lining the way
            for sx in (-6, 6):
                self.set(sx, 1, z, S["stone"]); self.set(sx, 2, z, "siege:brazier")
        # lanterns on posts along the ring street, both kerbs, every 12
        for t in range(-RING + 6, RING - 5, 12):
            for w in (RING - h - 1, RING + h + 1):
                for x, z in ((t, w), (t, -w), (w, t), (-w, t)):
                    if abs(x) <= a + 1 and z > 0: continue
                    self.lamp(x, z)

    def lamp(self, x, z):
        w = self.S["wood"]
        if self.bp.get(x, 1, z)[0] not in ("keep", "air"): return
        self.set(x, 1, z, self.S["wallcap"]); self.set(x, 2, z, f"{w}_fence"); self.set(x, 3, z, f"{w}_fence"); self.set(x, 4, z, "lantern")

    def blocked(self, x0, z0, x1, z1, margin=2):
        """True if a plot rectangle hits a wall, a tower, the keep, a street or another plot."""
        for x in range(x0 - margin, x1 + margin + 1):
            for z in range(z0 - margin, z1 + margin + 1):
                if d_outer(x, z) < WALL_T + 3: return True
                if -3 - 0 <= d_inner(x, z) < WALL_T + 3 and abs(x) <= INNER + 3 and abs(z) <= INNER + 3: return True
                if (x, z) in self.street and x0 <= x <= x1 and z0 <= z <= z1: return True
                if (x, z) in self.taken: return True
        for t in self.towers:
            cx, cz = min(max(t["x"], x0), x1), min(max(t["z"], z0), z1)
            if math.hypot(cx - t["x"], cz - t["z"]) <= t["r"] + margin + 1: return True
        return False

    def plot(self, size, x0, z0, w, d, door, where):
        x1, z1 = x0 + w - 1, z0 + d - 1
        if self.blocked(x0, z0, x1, z1): return False
        for x in range(x0 - 1, x1 + 2):
            for z in range(z0 - 1, z1 + 2): self.taken.add((x, z))
        S = self.S
        # the plot: corner stones flush with the grass, a marker post at the front corner, a path to the street
        for x in range(x0, x1 + 1):                            # the plot's edge, a path you can see from the walls
            for z in range(z0, z1 + 1):
                if x in (x0, x1) or z in (z0, z1): self.set(x, 0, z, pick(S["lane"], x, z, 11))
        for x, z in ((x0, z0), (x1, z0), (x0, z1), (x1, z1)): self.set(x, 0, z, S["court"])
        fx, fz = {"s": (x0, z1 + 1), "n": (x1, z0 - 1), "e": (x1 + 1, z1), "w": (x0 - 1, z0)}[door]
        self.set(fx, 1, fz, "siege:castle_cobbled"); self.set(fx, 2, fz, f"{S['wood']}_fence"); self.set(fx, 3, fz, "lantern")
        mx, mz = (x0 + x1) // 2, (z0 + z1) // 2
        step = {"s": (0, 1), "n": (0, -1), "e": (1, 0), "w": (-1, 0)}[door]
        px, pz = {"s": (mx, z1 + 1), "n": (mx, z0 - 1), "e": (x1 + 1, mz), "w": (x0 - 1, mz)}[door]
        for _ in range(8):
            if (px, pz) in self.street: break
            for k in (-1, 0, 1):
                qx, qz = px + (k if step[1] else 0), pz + (k if step[0] else 0)
                self.set(qx, 0, qz, pick(S["lane"], qx, qz, 9))
            px, pz = px + step[0], pz + step[1]
        self.plots.append({"size": size, "x0": x0, "z0": z0, "x1": x1, "z1": z1, "door": door, "where": where})
        return True

    def lay_plots(self):
        self.taken = set()
        SIZES = {"S": (9, 13), "M": (11, 15), "L": (15, 15), "G": (21, 21)}
        h = RING_W // 2
        # the inner ward first: two Great plots by the court, two Large plots by the keep, the garden behind
        for sx in (-1, 1):
            x0 = 26 if sx > 0 else -26 - 20
            self.plot("G", x0, 22, 21, 21, "w" if sx > 0 else "e", "inner ward")
            x0 = 30 if sx > 0 else -30 - 14
            self.plot("L", x0, -20, 15, 15, "w" if sx > 0 else "e", "inner ward")
        for x in range(-17, 18):                                 # the walled garden behind the keep
            for z in range(-INNER + 7, KEEP[1] - KEEP_HALF - 3):
                edge = abs(x) == 17 or z == -INNER + 7
                if edge:
                    self.set(x, 1, z, self.S["smooth"]); self.set(x, 2, z, self.S["wallcap"])
                else:
                    self.set(x, 0, z, "grass_block")
                    if (x % 4 == 0 and z % 4 == 0): self.set(x, 1, z, "azalea_leaves_flowered")
                    elif abs(x) == 8 or z == -INNER + 14: self.set(x, 0, z, pick(self.S["lane"], x, z))
                self.taken.add((x, z))
        # the bailey: rows either side of the ring street on each of the four sides, doors to the street
        rows = []
        for side in ("s", "n", "e", "w"):
            rows.append((side, "inner", RING - h - 2))   # plots just inside the ring street, back toward the inner wall
            rows.append((side, "outer", RING + h + 2))   # plots just outside it, back toward the outer wall
        pattern = ["M", "S", "S", "L", "S", "M", "S", "G", "S", "M", "L", "S"]
        k = 0
        for side, row, edge in rows:
            for t in range(-RING + 3, RING - 2):
                size = pattern[k % len(pattern)]
                if row == "inner" and size == "G": size = "M"
                w, d = SIZES[size]
                # the plot along the row: front edge on the street side, starting at t
                if side == "s":
                    x0 = t; z0 = edge - d + 1 if row == "inner" else edge; door = "s" if row == "inner" else "n"; ww, dd = w, d
                elif side == "n":
                    x0 = t; z0 = -edge if row == "inner" else -edge - d + 1; door = "n" if row == "inner" else "s"; ww, dd = w, d
                elif side == "e":
                    z0 = t; x0 = edge - d + 1 if row == "inner" else edge; door = "e" if row == "inner" else "w"; ww, dd = d, w
                else:
                    z0 = t; x0 = -edge if row == "inner" else -edge - d + 1; door = "w" if row == "inner" else "e"; ww, dd = d, w
                if self.plot(size, x0, z0, ww, dd, door, f"{side} {row}"): k += 1
        # the corners of the bailey, where the outer wall cuts across: fields for the farms
        for sx in (-1, 1):
            for sz in (-1, 1):
                n = 0
                for ax in range(58, OUTER):
                    for az in range(58, OUTER):
                        x, z = sx * ax, sz * az
                        if (x, z) in self.taken or (x, z) in self.street or d_outer(x, z) < WALL_T + 3: continue
                        if ax <= INNER + 8 and az <= INNER + 8: continue
                        if min(ax, az) < 66: continue
                        if any(math.hypot(x - t["x"], z - t["z"]) <= t["r"] + 3 for t in self.towers): continue
                        if ax % 9 == 4 and az % 2 == 0 and False: pass
                        if (ax if ax > az else az) % 9 == 0: self.set(x, 0, z, "water")
                        else: self.set(x, 0, z, "farmland"); self.set(x, 1, z, "wheat")
                        n += 1
                if n: self.fields.append({"cells": n, "corner": [sx, sz]})

    # ---- the whole thing -----------------------------------------------------------------------------
    def build(self):
        S = self.S
        R = OUTER + 50
        # outer curtain and its towers
        self.curtain(d_outer, OUTER + 2, OUTER_WALK, 13)
        verts = [(80, 115), (115, 80), (115, -80), (80, -115), (-80, -115), (-115, -80), (-115, 80), (-80, 115)]
        for vx, vz in verts:
            self.tower(vx - (2 if vx > 0 else -2), vz - (2 if vz > 0 else -2), 10.5, 33, walks=(OUTER_WALK,), name="outer corner tower")
        for side in ("n", "e", "w", "s"):
            for t in ((-40, 0, 40) if side != "s" else (-48, 48)):
                x, z = {"n": (t, -OUTER + 2), "s": (t, OUTER - 2), "e": (OUTER - 2, t), "w": (-OUTER + 2, t)}[side]
                self.tower(x, z, 7.5 if t else 8.5, 25 if t else 29, walks=(OUTER_WALK,), door=OPP[side] if t == 0 else None, name="outer tower")
        self.gatehouse(OUTER + 6, OUTER - 14, 11, 29, 9.5, 35, OUTER_WALK, "Great Gatehouse", barbican=19)
        # inner curtain and its towers
        self.curtain(lambda x, z: d_inner(x, z), INNER + 2, INNER_WALK, 17)
        for sx in (-1, 1):
            for sz in (-1, 1):
                self.tower(sx * (INNER - 2), sz * (INNER - 2), 11.5, 43, walks=(INNER_WALK,), name="inner corner tower")
        for side in ("n", "e", "w"):
            x, z = {"n": (0, -INNER + 2), "e": (INNER - 2, 0), "w": (-INNER + 2, 0)}[side]
            self.tower(x, z, 8.5, 35, walks=(INNER_WALK,), door=side, name="inner tower")
        self.gatehouse(INNER + 6, INNER - 12, 11, 33, 8.5, 39, INNER_WALK, "inner gatehouse")
        self.keep()
        self.ground()
        self.lay_plots()
        self.bp.finish()
        return self.bp

    def summary(self):
        from collections import Counter
        c = Counter(p["size"] for p in self.plots)
        lo, hi = self.bp.bounds()
        return {"plots": dict(c), "plot_count": len(self.plots), "fields": len(self.fields), "towers": len(self.towers),
                "bounds": [lo, hi], "blocks": sum(1 for v in self.bp.cells.values() if v[0] not in ("air", "keep"))}


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
