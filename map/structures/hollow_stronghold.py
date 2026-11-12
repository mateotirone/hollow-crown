"""The Hollow's stronghold: the Citadel's way of building, the Hollow's own character (Mateo, 2026-11-12).

Raised the same way as the Citadel (curtains, towers with spiral stairs, gatehouses, a ring street with
settlement plots, gardens from the tree database, a ruler's keep with a throne), from the same Citadel
class, but it is the crooked city's stronghold, not a re-skin. Mateo (18:15): keep the round plan; make it
"stupid tall, with angles and sharp points", spooky, and NOT symmetrical.

  * ROUND: a round outer curtain and a round inner ring, a light-river moat (siege:glimmerflow) round it.
  * NEEDLES, not round towers: every tower is angular (diamond, octagon or square plan, chosen per tower),
    each a different height, each LEANING the way the drowned city's towers lean: whole storeys stepped one
    block over every dozen or so blocks, never a shear. Each ends in a corbelled parapet with spiked corner
    pinnacles and a steep faceted pyramid spire of deepslate, tipped with the spire top.
  * NOTHING MATCHES: towers spaced unevenly round the rings, heights and sizes all different, jagged
    merlons of uneven height, and the keep a lopsided cluster.
  * THE SPIRE: in place of a keep, a cluster of four needles of different plans and heights round the
    throne hall, the tallest climbing in three leaning steps to about 150 (the cave roof over the Seat is
    166 up). Amethyst points (the Crown's colours, the ruler's seat only) at its parapet.
  * Soul light behind iron bars, soul fire on the parapets, Veilmoss strands down walls and towers,
    giant glowing Veilcaps and Veilcap beds outside.

Coordinates as in citadel.py: x east, y up, z south, y = 0 the ground, origin the ruler's banner,
gate to the south.

    python3 hollow_stronghold.py OUT_DIR          # writes OUT_DIR/hollow_stronghold.json
"""
import os, sys, math, json
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from bp import Blueprint
import furnish as F
from citadel import Citadel, h3, pick, outward, OPP, WALL_T

R_OUT = 73          # outer curtain's outer face (a circle with the area of the Citadel's octagon)
WALK = 17           # outer wall walk
R_IN = 37           # inner ring's outer face
IN_WALK = 23
RING = 43           # ring street's middle radius
RING_W = 5
AVENUE_W = 7
KEEP = (0, -2)      # the Spire: the throne hall at the foot of the tallest needle
KEEP_REACH = 20     # the cluster stays inside this radius; the lane and the river ring go round it
MOAT = (R_OUT + 3, R_OUT + 9)
FIELDS_TO = 100

# (angle in degrees: 0 east, 90 south = the gate side; size; height): uneven on purpose
OUT_TOWERS = [(61, 7.5, 52), (121, 6.5, 40), (24, 5.5, 34), (-11, 8.5, 63), (-49, 6.5, 44), (-93, 7.5, 58),
              (-124, 5.5, 37), (-166, 8.5, 49), (154, 6.5, 66)]
IN_TOWERS = [(44, 6.5, 74), (141, 7.5, 61), (-31, 5.5, 88), (-97, 6.5, 57), (-148, 7.5, 80)]
# the Spire's needles: (dx, dz from KEEP, size, height, plan, lean steps every)
SPIRE = [(-12, 4, 6.5, 84, "oct", 14), (11, -9, 5.5, 68, "round", 13), (8, 10, 4.5, 52, "diamond", 11),
         (0, 0, 10.5, 108, "diamond", 32)]
SHAPES = ("diamond", "oct", "square", "oct")


def d_out(x, z): return R_OUT - math.hypot(x, z)
def d_in(x, z): return R_IN - math.hypot(x, z)


def metric(shape, dx, dz):
    """Distance from a tower's axis in its plan's own measure: round, diamond, octagon or square."""
    ax, az = abs(dx), abs(dz)
    if shape == "diamond": return (ax + az) * 0.78
    if shape == "square": return max(ax, az)
    if shape == "oct": return max(ax, az, (ax + az) * 0.76)
    return math.hypot(dx, dz)


class HollowStronghold(Citadel):
    def __init__(self):
        super().__init__("hollow")
        self.S = dict(self.S, roof_off=0)
        self.bp = Blueprint("hollow_stronghold")
        self.dout, self.din, self.reach = d_out, d_in, R_OUT

    # ---- needles ------------------------------------------------------------------------------------
    def tower(self, cx, cz, r, h, walks=(), door=None, roof=True, name="tower"):
        """Every tower in the stronghold is a needle: the Citadel's tower calls (gatehouses too) land here.
        Its plan, extra height and lean come from where it stands, so no two match."""
        shape = SHAPES[int(h3(cx, 5, cz, 17) * len(SHAPES))]
        self.needle(cx, cz, r, int(h * (1.25 + h3(cx, 6, cz, 19) * 0.6)), shape, walks=walks, door=door, name=name)

    def needle(self, cx, cz, r, h, shape, walks=(), door=None, name="needle", every=None, crown=False):
        """An angular leaning tower. Shell 2 thick, floors every 8 (and at wall walks), a spiral stair up each
        straight run, barred slits lit with soul lanterns, a corbelled parapet with jagged merlons and spiked
        corner pinnacles, then a steep faceted pyramid spire with the spire top."""
        S = self.S
        R = int(r) + 1
        ldx, ldz = ((1, 0), (-1, 0), (0, 1), (0, -1))[int(h3(cx, 7, cz, 3) * 4)]
        every = every or (11 + int(h3(cx, 8, cz, 5) * 6))
        low = max(list(walks) + [6]) + 4
        floors = sorted({0} | set(walks) | set(range(9, h - 3, 8)) | {h})
        steps = [f for f in floors if f >= low and f < h - 4]
        steps = [f for i, f in enumerate(steps) if i == 0 or f - max([s for s in steps[:i]]) >= every][:4]
        steps = sorted(set(steps))
        def off(y):
            n = sum(1 for s in steps if y >= s)
            return ldx * n, ldz * n
        cells = [(dx, dz, metric(shape, dx, dz)) for dx in range(-R - 1, R + 2) for dz in range(-R - 1, R + 2)]
        cells = [(dx, dz, m) for dx, dz, m in cells if m <= r + 1.01]
        for dx, dz, m in cells:
            if m <= r: self.found(cx + dx, cz + dz)
        for y in range(1, h + 1):
            ox, oz = off(y)
            band = y % 9 == 0
            for dx, dz, m in cells:
                if m > r: continue
                x, z = cx + dx + ox, cz + dz + oz
                if m > r - 2:
                    n = S["band"] if band else (S["stone"] if (m > r - 1 and h3(x, y, z, 2) < 0.12) else S["smooth"])
                    if y <= 2: n = S["plinth"]
                    self.set(x, y, z, n)
                else:
                    self.set(x, y, z, S["tiles"] if y in floors else "air")
        for f in floors[1:-1]:                              # barred slits on the four faces, soul light behind
            ox, oz = off(f + 4)
            for dx, dz, m in cells:
                if m <= r and m > r - 1 and (dx == 0 or dz == 0):
                    for y in range(f + 3, f + 6): self.set(cx + dx + ox, y, cz + dz + oz, "iron_bars")
            self.set(cx + ox + (1 if r > 4 else 0), f + 5, cz + oz, S["light"], hanging=True)
        for w in walks:                                     # wall-walk doorways on every side
            ox, oz = off(w + 1)
            for dx, dz, m in cells:
                if r - 2 < m <= r and (abs(dx) <= 1 or abs(dz) <= 1):
                    self.col(cx + dx + ox, cz + dz + oz, w + 1, w + 3, "air")
        if door:
            ox, oz = {"n": (0, -1), "s": (0, 1), "e": (1, 0), "w": (-1, 0)}[door]
            for k in range(R - 3, R + 1):
                for s in (-1, 0, 1):
                    self.col(cx + ox * k + (s if oz else 0), cz + oz * k + (s if ox else 0), 1, 4, "air")
        # spiral stairs: one per straight run, each landing on the floor where the tower steps over
        runs = [1] + steps + [h]
        for a, b in zip(runs, runs[1:]):
            ox, oz = off(a)
            if r >= 4: self.spiral(cx + ox, cz + oz, a if a == 1 else a + 1, b)
            else: self.col(cx + ox, cz + oz - (int(r) - 2), a, b - 1, "ladder", facing="s")
        # the top: corbels, a parapet of jagged merlons, spiked pinnacles at the corners
        ox, oz = off(h + 1)
        top = h + 1
        ring = [(dx, dz, m) for dx, dz, m in cells if r < m <= r + 1.01]
        for dx, dz, m in ring:
            x, z = cx + dx + ox, cz + dz + oz
            self.set(x, h, z, S["corbel"], facing=OPP[outward(dx, dz)], half="top")
            self.set(x, top, z, S["smooth"])
            hgt = int(h3(x, top, z, 29) * 3)
            for y in range(top + 1, top + 1 + hgt): self.set(x, y, z, S["stone"])
        corners = {}
        for dx, dz, m in ring:
            q = (dx > 0, dz > 0) if shape in ("square", "oct", "round") else ((abs(dx) > abs(dz)), dx + dz > 0)
            sc = abs(dx) + abs(dz) if shape != "diamond" else max(abs(dx), abs(dz))
            if sc > corners.get(q, (-1,))[0]: corners[q] = (sc, dx, dz)
        for _, dx, dz in corners.values():
            x, z = cx + dx + ox, cz + dz + oz
            self.col(x, z, top, top + 5, S["stone"]); self.set(x, top + 6, z, S["wallcap"]); self.set(x, top + 7, z, S["wallcap"])
            self.set(x, top + 8, z, "amethyst_block" if crown else S["finial"])
        for k, (dx, dz, m) in enumerate(ring):              # soul fire here and there on the parapet walk
            if h3(cx + dx, 3, cz + dz, 41) < 0.04: self.set(cx + dx + ox, top + 1, cz + dz + oz, "soul_campfire")
        # the spire: a faceted pyramid in the tower's own plan, very steep, hollow inside
        H = int(round((r + 1) * (3.2 + h3(cx, 9, cz, 7) * 1.4)))
        y0 = top + 1
        for k in range(H + 1):
            rk = (r + 0.2) * (1 - k / (H + 1))
            sx, sz = ox + (ldx if k > H * 0.55 else 0), oz + (ldz if k > H * 0.55 else 0)   # the tip bends over too
            for dx, dz, m in cells:
                if m <= rk and m > rk - 1.6 or (m <= rk and k == H):
                    x, z = cx + dx + sx, cz + dz + sz
                    self.set(x, y0 + k, z, pick([("deepslate_tiles", 70), ("cobbled_deepslate", 18), ("polished_blackstone_bricks", 12)], x, z + k, 5))
        tipx, tipz = cx + ox + ldx, cz + oz + ldz
        t = max(y for (x, y, z) in self.bp.cells if x == tipx and z == tipz and y >= y0 and self.bp.cells[(x, y, z)][0] not in ("air", "keep"))
        self.set(tipx, t + 1, tipz, S["finial"])
        # Veilmoss strands down two faces from under the corbels
        for dx, dz, m in ring:
            if h3(cx + dx, 4, cz + dz, 47) < 0.18:
                for y in range(h - 1, h - 4 - int(h3(cx + dx, 5, cz + dz, 47) * 9), -1):
                    x, z = cx + dx + ox, cz + dz + oz
                    if self.bp.get(x, y, z)[0] in ("keep", "air"): self.set(x, y, z, "siege:veilmoss_strands")
        self.towers.append({"name": name, "x": cx, "z": cz, "r": r + 1, "h": h, "shape": shape, "top": t + 1})

    # ---- curtains with jagged merlons ---------------------------------------------------------------
    def curtain(self, dist, reach, walk, slit_y):
        Citadel.curtain(self, dist, reach, walk, slit_y)
        S = self.S
        for x in range(-reach, reach + 1):
            for z in range(-reach, reach + 1):
                d = dist(x, z)
                if 0 <= d < 1 and (x + z) % 2 == 0:          # merlons of uneven height, some sharpened
                    r = h3(x, walk, z, 13)
                    if r < 0.35: self.set(x, walk + 4, z, S["stone"])
                    if r < 0.12: self.set(x, walk + 5, z, S["wallcap"])

    # ---- the Spire ----------------------------------------------------------------------------------
    def spire_keep(self):
        kx, kz = KEEP
        for dx, dz, r, h, shape, every in SPIRE:
            main = dx == 0 and dz == 0
            self.needle(kx + dx, kz + dz, r, h, shape, every=every, crown=main, name="the Spire" if main else "Spire needle")
        # the main needle's hall: a 5-wide pointed door on the south, the throne at the north
        r = SPIRE[-1][2]
        for dz in range(int(r * 1.28) - 3, int(r * 1.28) + 3):
            for dx in range(-2, 3):
                self.col(kx + dx, kz + dz, 1, {2: 6, 1: 7, 0: 8}[abs(dx)], "air")
        # doorways from the hall into the three lesser needles
        for dx, dz, r2, h, shape, every in SPIRE[:-1]:
            n = max(abs(dx), abs(dz))
            for k in range(n + 1):
                x, z = kx + round(dx * k / n), kz + round(dz * k / n)
                for s in (-1, 0, 1):
                    xx, zz = (x + s, z) if abs(dz) > abs(dx) else (x, z + s)
                    self.col(xx, zz, 1, 4, "air")
        self.spire_interior(kx, kz)
        self.keep_box = (kx - KEEP_REACH, kz - KEEP_REACH, kx + KEEP_REACH, kz + KEEP_REACH)

    def spire_interior(self, kx, kz):
        """The throne hall at the foot of the Spire: the carpet, the dais and the throne, soul fire; the
        ruler's chambers and the council room on the two floors above."""
        S = self.S
        bp = self.bp
        inside = lambda dx, dz: metric("diamond", dx, dz) <= 7.6
        def put(x, y, z, n, **p):
            if bp.get(x, y, z)[0] in ("air", "keep"): self.set(x, y, z, n, **p)
        cloth = f"{S['cloth']}_carpet"
        for dz in range(-6, 13):
            for dx in (-1, 0, 1):
                if inside(dx, dz) or dz > 0: put(kx + dx, 1, kz + dz, cloth)
        for dx in range(-3, 4):
            for dz in range(-8, -5):
                if inside(dx, dz): self.set(kx + dx, 1, kz + dz, S["dais"][0] if abs(dx) == 3 or dz == -6 else S["dais"][1])
        self.set(kx, 2, kz - 7, "siege:throne")
        for dx in (-2, 2): self.set(kx + dx, 2, kz - 7, "soul_campfire")
        y = 10
        F.bed(bp, kx + 2, y, kz - 4, "n")
        for dx, dz, n in ((-4, -2, "chest"), (4, -2, "chest"), (-5, 1, "bookshelf"), (5, 1, "bookshelf"), (-4, 3, "barrel"), (3, 3, "lectern")):
            put(kx + dx, y, kz + dz, n)
        y = 18
        F.long_table(bp, kx - 3, kx + 3, y, kz + 1, mat="dark_oak")
        put(kx, y, kz - 3, "cartography_table")

    # ---- streets, the ward, plots, the moat, the beds ------------------------------------------------
    def ground(self):
        S = self.S
        self.street = set()
        def pave(x, z, seed=3):
            self.set(x, 0, z, pick(S["street"], x, z, seed)); self.street.add((x, z))
        h = RING_W / 2
        for x in range(-RING - 3, RING + 4):
            for z in range(-RING - 3, RING + 4):
                if abs(math.hypot(x, z) - RING) <= h and d_in(x, z) < 0: pave(x, z)
        a = AVENUE_W // 2
        for z in range(R_IN + 1, R_OUT - 8):
            for x in range(-a, a + 1): pave(x, z)
        for k in range(18):                              # soul lanterns on posts round the ring street's outer kerb
            ang = math.radians(k * 20 + 10)
            x, z = round(math.cos(ang) * (RING + 3.5)), round(math.sin(ang) * (RING + 3.5))
            if abs(x) <= a + 1 and z > 0: continue
            self.lamp(x, z)

    def ward(self):
        """Inside the inner ring: a paved way round the Drum, its own ring of light river with four bridges,
        a processional way from the Crown gate, and a grove of giant Veilcaps."""
        S = self.S
        kx, kz = KEEP
        for x in range(kx - 27, kx + 28):
            for z in range(kz - 27, kz + 28):
                d = math.hypot(x - kx, z - kz)
                if d_in(x, z) < WALL_T + 1 or self.bp.get(x, 1, z)[0] != "keep": continue
                bridge = abs(x - kx) <= 1 or abs(z - kz) <= 1
                if d <= 22.5:
                    self.set(x, 0, z, pick(S["street"], x, z, 31)); self.street.add((x, z))
                elif 22.5 < d <= 25.5:
                    if bridge:
                        self.set(x, 0, z, S["court"]); self.street.add((x, z))
                    else:
                        self.col(x, z, -1, 0, "siege:glimmerflow"); self.taken.add((x, z))
                    if d > 25: self.street.add((x, z))
        for z in range(kz + 20, R_IN - 10):              # the processional way to the Crown gate
            for x in range(-3, 4):
                if self.bp.get(x, 1, z)[0] == "keep": self.set(x, 0, z, S["court"] if (x + z) % 2 else S["court2"]); self.street.add((x, z))
        for k in range(7):                               # soul lanterns round the Spire's way, unevenly
            a = math.radians(k * 51 + 13)
            self.lamp(kx + round(math.cos(a) * 21), kz + round(math.sin(a) * 21))
        # the grove between the river ring and the inner wall
        spots = sorted(((x, z) for x in range(-31, 32) for z in range(-31, 32)
                        if 27 <= math.hypot(x - kx, z - kz) and d_in(x, z) >= WALL_T + 3), key=lambda c: h3(c[0], 4, c[1], 71))
        done = []
        for x, z in spots:
            if any(math.hypot(x - a, z - b) < 8 for a, b in done): continue
            if self.veilcap(x, z, 6 + int(h3(x, 1, z, 3) * 5), 3 if h3(x, 2, z, 5) < 0.6 else 4): done.append((x, z))

    def veilcap(self, x, z, h, r):
        """A giant Veilcap: a pale stem, a glowing cap with a lip, glimbulbs hanging from the rim."""
        cells = [(x + dx, z + dz) for dx in range(-r, r + 1) for dz in range(-r, r + 1) if math.hypot(dx, dz) <= r + 0.4]
        if any(self.bp.get(a, y, b)[0] != "keep" for a, b in cells for y in (h - 1, h, h + 1)): return False
        if (x, z) in self.street or self.bp.get(x, 1, z)[0] != "keep": return False
        self.col(x, z, 1, h, "siege:veilcap_stem")
        for a, b in cells:
            d = math.hypot(a - x, b - z)
            if d <= r - 0.6: self.set(a, h + 1, b, "siege:veilcap_cap")
            if d > r - 1.4: self.set(a, h, b, "siege:veilcap_cap")
            if d > r - 0.6 and h3(a, h, b, 9) < 0.3: self.set(a, h - 1, b, "siege:glimbulb")
        self.set(x, 0, z, "siege:undertow_moss")
        self.taken.add((x, z))
        return True

    def lay_plots(self):
        """Plots round the ring street, each turned to face it, packed a block apart, from the gate round."""
        SIZES = {"S": (9, 13), "M": (11, 15), "L": (15, 15)}
        order = ["S", "M", "S", "L", "S", "M", "S", "S", "M", "L", "S", "M"]
        front = RING + RING_W // 2 + 2
        th, k, miss = 98.0, 0, 0
        while th < 82 + 360:
            c, s = math.cos(math.radians(th)), math.sin(math.radians(th))
            placed = False
            for size in (order[k % len(order)],):
                w, d = SIZES[size]
                for push in range(0, 5):
                    rr = front + push + d / 2
                    if abs(c) >= abs(s):                 # east or west of the middle: depth along x
                        door, ww, dd = ("w" if c > 0 else "e"), d, w
                    else:
                        door, ww, dd = ("n" if s > 0 else "s"), w, d
                    x0, z0 = round(c * rr - ww / 2), round(s * rr - dd / 2)
                    if self.plot(size, x0, z0, ww, dd, door, "ring"):
                        th += math.degrees((w + 1) / (front + d / 2)); k += 1; placed = True
                        break
                if placed: break
            if not placed:
                th += 1.0; miss += 1
                if miss > 8: k += 1; miss = 0                    # this size won't go here: try the next one
            else: miss = 0
        self.gardens()

    def beds(self):
        """Outside: a track at the wall foot, the light-river moat with one bridge at the gate, then Veilcap
        beds in rings out to the edge with giant Veilcaps standing among them."""
        S = self.S
        a = AVENUE_W // 2
        towers = [(t["x"], t["z"], t["r"]) for t in self.towers]
        cells = []
        for x in range(-FIELDS_TO, FIELDS_TO + 1):
            for z in range(-FIELDS_TO, FIELDS_TO + 1):
                rr = math.hypot(x, z)
                if rr > FIELDS_TO or d_out(x, z) >= -2 or self.bp.get(x, 1, z)[0] != "keep": continue
                if any(math.hypot(x - tx, z - tz) <= r + 1 for tx, tz, r in towers): continue
                if abs(x) <= a and z > 0:                # the avenue and the bridge over the moat
                    self.set(x, 0, z, S["court"] if MOAT[0] - 1 <= rr <= MOAT[1] + 1 else pick(S["street"], x, z, 5))
                    if abs(x) == a and MOAT[0] - 1 <= rr <= MOAT[1] + 1: self.set(x, 1, z, S["wallcap"])
                    self.street.add((x, z)); continue
                if rr < MOAT[0]: self.set(x, 0, z, pick(S["lane"], x, z, 13)); continue
                if rr <= MOAT[1]: self.col(x, z, -2, 0, "siege:glimmerflow"); continue
                cells.append((x, z, rr))
        for x, z, rr in cells:
            ring = int(rr - MOAT[1]) % 6
            if ring == 0: self.set(x, 0, z, pick(S["lane"], x, z, 17)); continue
            self.set(x, 0, z, S["field_soil"])
            if ring in (2, 4) and h3(x, 0, z, 23) < 0.7: self.set(x, 1, z, S["crops"][0])
        for x, z, rr in sorted(cells, key=lambda c: h3(c[0], 6, c[1], 91))[::40]:
            if int(rr - MOAT[1]) % 6 == 3: self.veilcap(x, z, 7 + int(h3(x, 1, z, 7) * 6), 3 + int(h3(x, 2, z, 7) * 2))
        for sx in (-a, a):                               # soul lanterns at both ends of the bridge
            for rz in (MOAT[0] - 1, MOAT[1] + 1):
                z = round(math.sqrt(max(rz * rz - sx * sx, 0)))
                self.set(sx, 2, z, self.S["light"])

    def strands(self):
        """Veilmoss strands hanging down the outer face of the curtain from the parapet."""
        for x in range(-R_OUT - 1, R_OUT + 2):
            for z in range(-R_OUT - 1, R_OUT + 2):
                if not (-1 <= d_out(x, z) < 0) or h3(x, 0, z, 33) > 0.12: continue
                for y in range(WALK + 1, WALK - 3 - int(h3(x, 1, z, 33) * 7), -1):
                    if self.bp.get(x, y, z)[0] == "keep": self.set(x, y, z, "siege:veilmoss_strands")

    def build(self):
        self.curtain(d_out, R_OUT + 2, WALK, 10)
        for ang, r, h in OUT_TOWERS:
            a = math.radians(ang)
            self.needle(round(math.cos(a) * (R_OUT - 1)), round(math.sin(a) * (R_OUT - 1)), r, h,
                        SHAPES[int(h3(ang, 1, int(r * 2), 3) * len(SHAPES))], walks=(WALK,), name="outer needle")
        self.gatehouse(R_OUT + 5, R_OUT - 9, 9, 28, 6.5, 40, WALK, "Hollow Gate")
        self.curtain(d_in, R_IN + 2, IN_WALK, 12)
        for ang, r, h in IN_TOWERS:
            a = math.radians(ang)
            self.needle(round(math.cos(a) * (R_IN - 2)), round(math.sin(a) * (R_IN - 2)), r, h,
                        SHAPES[int(h3(ang, 2, int(r * 2), 3) * len(SHAPES))], walks=(IN_WALK,), name="inner needle")
        self.gatehouse(R_IN + 1, R_IN - 11, 9, 31, 5.5, 46, IN_WALK, "Crown Gate", tower_back=5)
        self.spire_keep()
        self.ground()
        self.taken = set()
        self.ward()
        self.lay_plots()
        self.beds()
        self.strands()
        self.bp.finish()
        return self.bp


def build():
    h = HollowStronghold(); h.build(); return h


if __name__ == "__main__":
    out = sys.argv[1]
    h = build()
    os.makedirs(out, exist_ok=True)
    s = h.summary(); print(json.dumps(s))
    json.dump({"plots": h.plots, "towers": h.towers, "gates": h.gates, "summary": s},
              open(os.path.join(out, "hollow_stronghold.json"), "w"), indent=1)
