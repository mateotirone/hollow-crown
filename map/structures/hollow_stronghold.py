"""The Hollow's stronghold: the Citadel's way of building, the Hollow's own character (Mateo, 2026-11-12).

It is raised the same way as the Citadel (curtains, round towers with spiral stairs, gatehouses, a ring
street with settlement plots, gardens from the tree database, a ruler's seat with a throne), from the
same Citadel class, but it is not a re-skin. Everything that makes the Citadel a Citadel is changed:

  * a ROUND plan instead of an octagon and a square: a round outer curtain and a round inner ring,
  * towers spaced unevenly and every one LEANING in clean steps: the upper storey one block off true and
    the roof one block further (the Hollow's crookedness rule: whole storeys, never a shear),
  * a MOAT of the light river (siege:glimmerflow) round the walls, crossed by one bridge,
  * no farmland: Veilcap beds and giant glowing Veilcap mushrooms out to the edge,
  * in place of the square Great Keep, the DRUM: a round keep whose upper storey sits one block off true,
    a crown of points on its parapet (the Crown's colours, allowed only at the ruler's seat), a slim
    spire, four leaning buttress turrets, and its own ring of light river with four bridges,
  * LOW, because the Hollow has a stone sky 30 to 50 blocks up: the walls stop at 13 and 17, the top of
    the spire is under 50.

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
WALK = 13           # outer wall walk: low, under the stone sky
R_IN = 37           # inner ring's outer face
IN_WALK = 17
RING = 43           # ring street's middle radius
RING_W = 5
AVENUE_W = 7
DRUM = (0, -2)      # the Drum: a round drum
DRUM_R = 15.5       # 31 across
DRUM_TOP = 28
DRUM_FLOORS = [12, 20]
OFF_Y = 20          # from here up the Drum's storey sits one block off true
MOAT = (R_OUT + 3, R_OUT + 9)
FIELDS_TO = 100

OUT_TOWERS = [62, 118, 24, -14, -52, -91, -128, -163, 157]   # degrees, 0 east, 90 south (the gate): uneven on purpose
IN_TOWERS = [42, 138, -28, -93, -151]


def d_out(x, z): return R_OUT - math.hypot(x, z)
def d_in(x, z): return R_IN - math.hypot(x, z)


class HollowStronghold(Citadel):
    def __init__(self):
        super().__init__("hollow")
        self.S = dict(self.S, roof_off=0)            # the lean carries the roof's offset here
        self.bp = Blueprint("hollow_stronghold")
        self.dout, self.din, self.reach = d_out, d_in, R_OUT

    # ---- crookedness: whole storeys one block off true ----------------------------------------------
    def shifted(self, steps, fn, *a, **k):
        """Builds fn into a scratch blueprint, then copies it back with everything at or above each step's
        height moved one block that way. Steps sit on floors, so each storey stays square on its beam."""
        real, tmp = self.bp, Blueprint("tmp")
        self.bp = tmp
        try: fn(*a, **k)
        finally: self.bp = real
        for (x, y, z), v in tmp.cells.items():
            ox = oz = 0
            for ys, dx, dz in steps:
                if y >= ys: ox += dx; oz += dz
            real.cells[(x + ox, y, z + oz)] = v

    def tower(self, cx, cz, r, h, walks=(), door=None, roof=True, name="tower"):
        """Every tower leans: straight up to its first floor above the wall walk, one block over from there,
        and its roof one block further, the same way. The way it leans is the tower's own."""
        dx, dz = ((1, 0), (-1, 0), (0, 1), (0, -1))[int(h3(cx, 7, cz, 3) * 4)]
        floors = sorted({h} | set(walks) | {f for f in range(9, h - 2, 8) if all(abs(f - w) > 3 for w in walks)})
        low = max(list(walks) + [8]) + 4
        step = next((f for f in floors if f >= low and f < h), h - 4)
        self.shifted([(step, dx, dz), (h + 1, dx, dz)], Citadel.tower, self, cx, cz, r, h, walks, door, roof, name)

    # ---- the Drum ------------------------------------------------------------------------------------
    def drum(self):
        kx, kz = DRUM
        self.shifted([(OFF_Y, 1, 0)], self.drum_body)
        for k in range(4):                               # four buttress turrets on the diagonals, leaning
            a = math.radians(45 + 90 * k)
            self.tower(kx + round(math.cos(a) * (DRUM_R + 1)), kz + round(math.sin(a) * (DRUM_R + 1)), 3.5, DRUM_TOP + 6, name="Drum turret")
        self.spire(kx + 1, kz)                           # on the offset storey
        self.keep_box = (kx - 17, kz - 17, kx + 17, kz + 17)

    def drum_body(self):
        S = self.S
        kx, kz = DRUM
        R, TOP = DRUM_R, DRUM_TOP
        Ri = int(R)
        for dx in range(-Ri, Ri + 1):
            for dz in range(-Ri, Ri + 1):
                d = math.hypot(dx, dz)
                if d > R: continue
                x, z = kx + dx, kz + dz
                self.found(x, z)
                if d > R - 3:
                    self.dressed(x, z, TOP, bands=(DRUM_FLOORS[0], DRUM_FLOORS[1], OFF_Y - 1))
                    if d > R - 1:
                        self.set(x, TOP + 1, z, S["smooth"])
                        if (dx + dz) % 2 == 0: self.set(x, TOP + 2, z, S["stone"])
                        ang = (math.degrees(math.atan2(dz, dx)) + 360) % 360
                        if min(ang % 30, 30 - ang % 30) < 1.6 and not (75 < ang < 105):   # barred windows, the door side kept clear
                            for f in (0, DRUM_FLOORS[0], DRUM_FLOORS[1]):
                                for y in range(f + 4, f + 7): self.set(x, y, z, "iron_bars")
                else:
                    self.set(x, 0, z, S["court"] if (dx + dz) % 2 else S["tiles"])
                    self.col(x, z, 1, TOP - 1, "air")
                    for f in DRUM_FLOORS + [TOP]: self.set(x, f, z, S["tiles"])
        # the crown: eight points on the parapet, amethyst-tipped (the Crown's colours, at the ruler's seat only)
        for k in range(8):
            a = math.radians(22.5 + 45 * k)
            x, z = kx + round(math.cos(a) * (R - 0.5)), kz + round(math.sin(a) * (R - 0.5))
            self.col(x, z, TOP + 1, TOP + 4, S["stone"]); self.set(x, TOP + 5, z, "amethyst_block")
        # the door: 5 wide, pointed, on the south
        for z in range(kz + Ri - 3, kz + Ri + 1):
            for dx in range(-2, 3):
                self.col(kx + dx, z, 1, {2: 6, 1: 7, 0: 8}[abs(dx)], "air")
        self.set(kx, 8, kz + Ri - 3, self.S["light"], hanging=True)
        self.drum_interior(kx, kz)

    def drum_interior(self, kx, kz):
        """The throne hall on the ground floor (a ring of columns, the carpet, the dais and the throne), the
        ruler's chambers above it, the council room on the offset storey, a spiral stair through all of it."""
        S = self.S
        bp = self.bp
        cloth = f"{S['cloth']}_carpet"
        def put(x, y, z, n, **p):
            if bp.get(x, y, z)[0] in ("air", "keep"): self.set(x, y, z, n, **p)
        for k in range(8):                               # columns
            a = math.radians(22.5 + 45 * k)
            x, z = kx + round(math.cos(a) * 9), kz + round(math.sin(a) * 9)
            self.col(x, z, 1, 11, S["stone"]); self.set(x, 11, z, S["band"])
        for z in range(kz - 9, kz + 13):
            for dx in (-1, 0, 1): put(kx + dx, 1, z, cloth)
        for dx in range(-4, 5):                          # the dais, the throne, soul fire either side
            for dz in range(-12, -9):
                if math.hypot(dx, dz) <= 12.4: self.set(kx + dx, 1, kz + dz, S["dais"][0] if abs(dx) == 4 or dz == -10 else S["dais"][1])
        self.set(kx, 2, kz - 11, "siege:throne")
        for dx in (-3, 3): self.set(kx + dx, 2, kz - 11, "soul_campfire")
        for y in (11,):
            for dx, dz in ((-5, 0), (5, 0), (0, 5), (0, -5)): put(kx + dx, y, kz + dz, S["light"], hanging=True)
        sx, sz = kx - 7, kz + 7                          # the spiral, between two columns
        self.spiral(sx, sz, 1, DRUM_TOP)
        # floor one: the ruler's chambers, a bed in an alcove, chests, bookshelves round the wall
        y = DRUM_FLOORS[0] + 1
        F.bed(bp, kx + 2, y, kz - 10, "n"); F.bed(bp, kx - 2, y, kz - 10, "n")
        for k in range(24):
            a = math.radians(k * 15)
            x, z = kx + round(math.cos(a) * 11.5), kz + round(math.sin(a) * 11.5)
            if math.hypot(x - sx, z - sz) < 3: continue
            put(x, y, z, "bookshelf" if k % 3 else "chest", facing=OPP[outward(x - kx, z - kz)])
            if k % 3: put(x, y + 1, z, "bookshelf")
        F.table(bp, kx, y, kz + 2, chairs="ew", mat="dark_oak")
        put(kx + 5, y, kz + 3, "lectern", facing="w"); put(kx - 5, y, kz - 3, "barrel")
        for dx, dz in ((-6, 0), (6, 0), (0, 6), (0, -6)): put(kx + dx, DRUM_FLOORS[1] - 1, kz + dz, S["light"], hanging=True)
        # floor two (the offset storey): the council room round a long table
        y = DRUM_FLOORS[1] + 1
        F.long_table(bp, kx - 5, kx + 5, y, kz, mat="dark_oak")
        put(kx, y, kz - 4, "cartography_table"); put(kx - 3, y, kz + 5, "lectern", facing="n"); put(kx + 3, y, kz + 5, "lectern", facing="n")
        for dx, dz in ((-6, 0), (6, 0), (0, 6), (0, -6)): put(kx + dx, DRUM_TOP - 1, kz + dz, S["light"], hanging=True)

    def spire(self, cx, cz):
        """The slim spire on the Drum's roof: a 9-wide round tower to 38, a tall deepslate cone, the spire top."""
        S = self.S
        y0, y1, r = DRUM_TOP + 1, DRUM_TOP + 10, 4.5
        for dx in range(-5, 6):
            for dz in range(-5, 6):
                d = math.hypot(dx, dz)
                if d > r: continue
                x, z = cx + dx, cz + dz
                if d > r - 1.5:
                    for y in range(y0, y1 + 1): self.set(x, y, z, S["band"] if y in (y0 + 4, y1) else S["smooth"])
                    if d > r - 1 and (dx == 0 or dz == 0): self.set(x, y0 + 6, z, "iron_bars"); self.set(x, y0 + 7, z, "iron_bars")
                else:
                    self.col(x, z, y0, y1 - 1, "air"); self.set(x, y1, z, S["tiles"])
        for y in range(y0, y0 + 3): self.set(cx, y, cz + 4, "air")
        self.col(cx, cz - 3, y0, y1 - 1, "ladder", facing="s")
        self.cone(cx, y1 + 1, cz, r + 1.5, 12)

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
        kx, kz = DRUM
        for x in range(kx - 24, kx + 25):
            for z in range(kz - 24, kz + 25):
                d = math.hypot(x - kx, z - kz)
                if d <= DRUM_R or d_in(x, z) < WALL_T + 1 or self.bp.get(x, 1, z)[0] != "keep": continue
                bridge = abs(x - kx) <= 1 or abs(z - kz) <= 1
                if DRUM_R < d <= 19.5:
                    self.set(x, 0, z, pick(S["street"], x, z, 31)); self.street.add((x, z))
                elif 19.5 < d <= 22.5:
                    if bridge:
                        self.set(x, 0, z, S["court"]); self.street.add((x, z))
                    else:
                        self.col(x, z, -1, 0, "siege:glimmerflow"); self.taken.add((x, z))
                    if d > 22: self.street.add((x, z))
        for z in range(kz + 17, R_IN - 10):              # the processional way to the Crown gate
            for x in range(-3, 4):
                if self.bp.get(x, 1, z)[0] == "keep": self.set(x, 0, z, S["court"] if (x + z) % 2 else S["court2"]); self.street.add((x, z))
        for k in range(8):                               # soul lanterns round the Drum's way
            a = math.radians(k * 45)
            self.lamp(kx + round(math.cos(a) * 18), kz + round(math.sin(a) * 18))
        # the grove between the river ring and the inner wall
        spots = sorted(((x, z) for x in range(-31, 32) for z in range(-31, 32)
                        if 24 <= math.hypot(x - kx, z - kz) and d_in(x, z) >= WALL_T + 3), key=lambda c: h3(c[0], 4, c[1], 71))
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
                for y in range(WALK + 1, WALK - 2 - int(h3(x, 1, z, 33) * 4), -1):
                    if self.bp.get(x, y, z)[0] == "keep": self.set(x, y, z, "siege:veilmoss_strands")

    def build(self):
        self.curtain(d_out, R_OUT + 2, WALK, 10)
        for i, ang in enumerate(OUT_TOWERS):
            a = math.radians(ang)
            big = i % 3 != 1
            self.tower(round(math.cos(a) * (R_OUT - 1)), round(math.sin(a) * (R_OUT - 1)), 7.5 if big else 6.5, 24 if big else 22,
                       walks=(WALK,), name="outer tower")
        self.gatehouse(R_OUT + 5, R_OUT - 9, 9, 22, 6.5, 26, WALK, "Hollow Gate")
        self.curtain(d_in, R_IN + 2, IN_WALK, 12)
        for i, ang in enumerate(IN_TOWERS):
            a = math.radians(ang)
            self.tower(round(math.cos(a) * (R_IN - 2)), round(math.sin(a) * (R_IN - 2)), 6.5 if i % 2 == 0 else 5.5, 28,
                       walks=(IN_WALK,), name="inner tower")
        self.gatehouse(R_IN + 1, R_IN - 11, 9, 25, 5.5, 29, IN_WALK, "Crown Gate", tower_back=5)
        self.drum()
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
