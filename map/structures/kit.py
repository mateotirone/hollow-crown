"""Building kit: the parts good Minecraft builders use, as code.

Rules baked in (from how skilled builders work, see README.md):
  - no flat walls: log frames stand proud, infill sits one block back
  - stone plinth and foundations that run into the ground
  - jettied upper floors carried on upside-down stair brackets
  - steep roofs from a height field, with eave and verge overhangs and a trim colour
  - windows recessed, with sills and shutters; doors under small canopies
  - weathered material mixes instead of one block type
  - detail blocks everywhere: stairs, slabs, trapdoors, fences, walls, lanterns
Everything takes a seed so one generator makes many different buildings.
"""
import math
from bp import Blueprint, DIRS, OPP, LEFT, RIGHT

def h3(x, y, z, s=0):
    """Deterministic hash noise in [0,1)."""
    n = (x * 374761393 + y * 668265263 + z * 2147483647 + s * 1274126177) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFFFF) / 0x1000000

def mix(table, seed=0, low_moss=None):
    """table = [(name, weight), ...] -> function(x,y,z) giving a weathered pick.
    low_moss: (name, extra_weight, height) adds more of `name` near the ground."""
    tot = sum(w for _, w in table)
    def f(x, y, z):
        r = h3(x, y, z, seed)
        if low_moss and y <= low_moss[2] and h3(x, y, z, seed + 7) < low_moss[1]: return low_moss[0], {}
        acc = 0
        for n, w in table:
            acc += w / tot
            if r < acc: return n, {}
        return table[-1][0], {}
    return f

# ---- palettes -------------------------------------------------------------
VALE = dict(
    stone=mix([("stone_bricks", 50), ("cracked_stone_bricks", 10), ("mossy_stone_bricks", 8), ("cobblestone", 14), ("andesite", 10), ("tuff", 4)], 3,
              low_moss=("mossy_cobblestone", 0.35, 2)),
    plinth=mix([("cobblestone", 50), ("mossy_cobblestone", 30), ("stone_bricks", 10), ("andesite", 10)], 4),
    found="cobblestone", quoin="polished_andesite",
    frame="stripped_dark_oak_log", frame2="dark_oak_log",
    infill="calcite",
    floor="spruce_planks", gable=None,
    roof=mix([("deepslate_tile_stairs", 88), ("deepslate_brick_stairs", 8), ("cobbled_deepslate_stairs", 4)], 21),
    roof_block="deepslate_tiles", roof_slab="deepslate_tile_slab",
    trim="dark_oak_stairs", trim_block="dark_oak_planks", trim_slab="dark_oak_slab",
    bracket="dark_oak_stairs", sill="stone_brick_stairs", shutter="spruce_trapdoor", door="spruce_door",
    pane="glass_pane", chimney=mix([("stone_bricks", 60), ("cobblestone", 25), ("cracked_stone_bricks", 15)], 6),
    chimney_cap="stone_brick_wall", fence="dark_oak_fence", path=mix([("grass_path", 50), ("gravel", 18), ("cobblestone", 16), ("coarse_dirt", 16)], 8),
)

def side_cells(x0, z0, x1, z1, side):
    """Cells along one side of a rectangle, left to right as seen from outside."""
    if side == "s": return [(x, z1) for x in range(x0, x1 + 1)]
    if side == "n": return [(x, z0) for x in range(x1, x0 - 1, -1)]
    if side == "e": return [(x1, z) for z in range(z1, z0 - 1, -1)]
    if side == "w": return [(x0, z) for z in range(z0, z1 + 1)]

def grow(rect, sides, n=1):
    x0, z0, x1, z1 = rect
    if "w" in sides: x0 -= n
    if "e" in sides: x1 += n
    if "n" in sides: z0 -= n
    if "s" in sides: z1 += n
    return (x0, z0, x1, z1)

def odd_posts(L, bay):
    """Post positions along a wall of L cells, corners included, so that every gap is odd
    (posts an even step apart). Leftover length goes to the middle bays."""
    s = bay + (bay % 2)
    span = L - 1
    if span % 2:      # even wall length cannot be split into odd gaps: fall back to even-ish spacing
        nb = max(1, round(span / s)); return sorted({round(k * span / nb) for k in range(nb + 1)})
    n = max(1, span // s); steps = [s] * n; rem = span - n * s; i = n // 2
    while rem > 0:
        steps[i % n] += 2; rem -= 2; i += 1
    out = [0]
    for st in steps: out.append(out[-1] + st)
    return out

class Building:
    """A building made of masses (boxes with storeys) and a combined roof height field."""
    def __init__(self, bp, pal, seed=0):
        self.bp, self.P, self.seed = bp, pal, seed
        self.roofs = []          # (rect incl. overhang, ridge axis, base y, pitch, material set)
        self.footprints = []     # (rect, y_top) interior volumes for clearing
        self.walls_plane = {}    # (x,z) -> outermost wall rect info, for gables
        self.gables = []         # (rect, ridge, y_base, style)

    # ---- walls
    def foundation(self, rect, y_top=0, depth=4):
        x0, z0, x1, z1 = rect
        self.bp.fill(x0, y_top - depth, z0, x1, y_top, z1, self.P["found"])

    def floor(self, rect, y, mat=None):
        x0, z0, x1, z1 = rect
        self.bp.fill(x0 + 1, y, z0 + 1, x1 - 1, y, z1 - 1, mat or self.P["floor"])

    def clear(self, rect, y0, y1):
        x0, z0, x1, z1 = rect
        self.bp.fill(x0 + 1, y0, z0 + 1, x1 - 1, y1, z1 - 1, "air")

    def stone_storey(self, rect, y0, h, windows=None, quoins=True, plinth=True):
        """Solid weathered stone walls on the rect's outline, y0..y0+h-1."""
        bp, P = self.bp, self.P
        x0, z0, x1, z1 = rect
        for y in range(y0, y0 + h):
            for x in range(x0, x1 + 1):
                for z in (z0, z1): bp.set(x, y, z, P["plinth"] if (plinth and y == y0) else P["stone"])
            for z in range(z0, z1 + 1):
                for x in (x0, x1): bp.set(x, y, z, P["plinth"] if (plinth and y == y0) else P["stone"])
        if quoins:
            for (x, z) in ((x0, z0), (x1, z0), (x0, z1), (x1, z1)):
                for y in range(y0 + 1, y0 + h):
                    bp.set(x, y, z, P["quoin"] if (y - y0) % 2 else P.get("quoin2", "stone_bricks"))
        self.clear(rect, y0, y0 + h - 1)

    def timber_storey(self, rect, y0, h, bay=4, infill=None):
        """Log frame on the outline (posts about every `bay`, sill and plate beams), infill set back one block."""
        bp, P = self.bp, self.P
        x0, z0, x1, z1 = rect
        inf = infill or P["infill"]
        yt = y0 + h - 1
        self.clear(rect, y0 + 1, yt)          # y0 inside is the floor
        if not hasattr(self, "bays"): self.bays = {}
        for side in "nsew":
            cells = side_cells(x0, z0, x1, z1, side)
            L = len(cells); posts = odd_posts(L, bay)
            self.bays[(rect, y0, side)] = (cells, posts, h)
            axis = "x" if side in "ns" else "z"
            ix, iz = {"n": (0, 1), "s": (0, -1), "e": (-1, 0), "w": (1, 0)}[side]
            for i, (x, z) in enumerate(cells):
                for y in range(y0, yt + 1):
                    if i in posts: bp.set(x, y, z, P["frame"], axis="y")
                    elif y in (y0, yt): bp.set(x, y, z, P["frame"], axis=axis)
                    else:
                        bp.set(x, y, z, inf)
        return yt

    def bay_windows(self, rect, y0, sides, skip=(), wide=5):
        """A window centred in every bay of a timber storey (bays listed by index in skip are left blank)."""
        for side in sides:
            cells, posts, h = self.bays[(rect, y0, side)]
            ix, iz = {"n": (0, 1), "s": (0, -1), "e": (-1, 0), "w": (1, 0)}[side]
            for b, (p0, p1) in enumerate(zip(posts, posts[1:])):
                gap = p1 - p0 - 1
                if gap < 1 or b in skip: continue
                w = 3 if gap >= wide else 1
                start = p0 + 1 + (gap - w) // 2
                span = cells[start:start + w]
                if any(self.bp.get(c[0], y0 + 1, c[1])[0] in ("air", "keep") for c in span): continue
                # window() grows toward RIGHT[side] seen from outside; start from the cell that makes it cover exactly this span
                rx, rz = DIRS[RIGHT[side]][0], DIRS[RIGHT[side]][2]
                x, z = next(c for c in span if (c[0] + rx * (w - 1), c[1] + rz * (w - 1)) in span)
                self.window(x + ix, y0 + 1, z + iz, side, w, min(2, h - 2))

    def jetty_brackets(self, rect_upper, sides, y):
        """Upside-down stairs under a jettied floor, one under each post of the upper frame."""
        bp, P = self.bp, self.P
        x0, z0, x1, z1 = rect_upper
        for side in sides:
            for i, (x, z) in enumerate(side_cells(x0, z0, x1, z1, side)):
                if bp.get(x, y + 1, z)[0] == P["frame"] and bp.get(x, y + 1, z)[1].get("axis") == "y" or i == 0:
                    bp.set(x, y, z, P["bracket"], facing=OPP[side], half="top")

    def window(self, x, y, z, side, w=1, h=2, kind="timber", shutters=None):
        """Window whose bottom-left (seen from outside) is at x,y,z in the wall plane given by side."""
        bp, P = self.bp, self.P
        rx, rz = DIRS[RIGHT[side]][0], DIRS[RIGHT[side]][2]
        ox, oz = DIRS[side][0], DIRS[side][2]
        for i in range(w):
            for j in range(h):
                bp.set(x + rx * i, y + j, z + rz * i, P["pane"])
            if kind == "stone":
                bp.set(x + rx * i + ox, y - 1, z + rz * i + oz, P["sill"], facing=OPP[side], half="bottom")
                bp.set(x + rx * i, y + h, z + rz * i, P["sill"].replace("_stairs", "_stairs"), facing=side, half="top")
        if kind == "timber":
            # the pane sits one block behind the wall face; open the face, shutters outside, a sill below
            for i in range(w):
                for j in range(h):
                    bp.set(x + rx * i + ox, y + j, z + rz * i + oz, P["pane"]); bp.set(x + rx * i, y + j, z + rz * i, "air")
                c = bp.get(x + rx * i + ox, y - 1, z + rz * i + oz)
                if not c[0].endswith("_log"): bp.set(x + rx * i + ox, y - 1, z + rz * i + oz, P.get("wsill", P["trim"]), facing=OPP[side], half="bottom")
            if shutters is None: shutters = h3(x, y, z, self.seed + 31) < self.P.get("shutters", 0.3)
            for sx, sz in (((x - rx + 2 * ox, z - rz + 2 * oz), (x + rx * w + 2 * ox, z + rz * w + 2 * oz)) if shutters else ()):
                if bp.get(sx, y, sz)[0] in ("keep", "air"):
                    for j in range(h): bp.set(sx, y + j, sz, P["shutter"], facing=side, open=True)

    def flower_box(self, x, y, z, side, w, seed=0):
        """Trapdoor box with flowers under a window (x,y,z = first cell in front of the wall)."""
        rx, rz = DIRS[RIGHT[side]][0], DIRS[RIGHT[side]][2]
        fl = ["poppy", "dandelion", "cornflower", "azure_bluet", "oxeye_daisy", "red_tulip"]
        for i in range(w):
            self.bp.set(x + rx * i, y, z + rz * i, "dirt")   # becomes a planter behind trapdoors
            self.bp.set(x + rx * i, y + 1, z + rz * i, fl[int(h3(x + i, y, z, seed) * len(fl))])
        ox, oz = DIRS[side][0], DIRS[side][2]
        for i in range(w):
            self.bp.set(x + rx * i + ox, y, z + rz * i + oz, self.P["shutter"], facing=side, open=True)

    def door(self, x, y, z, side, canopy=True, lanterns=True, frame=None):
        """A single centred door in the wall plane at x,y,z. Stone or timber jambs, a lintel,
        wall lanterns hung from brackets, and a small 3-wide pent canopy when there is room above."""
        bp, P = self.bp, self.P
        rx, rz = DIRS[RIGHT[side]][0], DIRS[RIGHT[side]][2]
        ox, oz = DIRS[side][0], DIRS[side][2]
        bp.set(x, y, z, P["door"], facing=OPP[side])
        bp.set(x, y + 1, z, P["door"], facing=OPP[side], upper=True)
        bp.set(x - ox, y, z - oz, "air"); bp.set(x - ox, y + 1, z - oz, "air")
        jamb = frame or P.get("jamb", P["frame"])
        for s in (-1, 1):
            for j in range(2): bp.set(x + rx * s, y + j, z + rz * s, jamb, axis="y")
        bp.set(x, y + 2, z, P.get("lintel", P["frame"]), axis="x" if side in "ns" else "z")
        room = all(self.bp.get(x + rx * s + ox, y + 3, z + rz * s + oz)[0] in ("keep", "air") for s in (-1, 0, 1))
        if canopy and room:
            for s in (-1, 0, 1): bp.set(x + rx * s + ox, y + 2, z + rz * s + oz, P["trim"], facing=OPP[side], half="bottom")
            if lanterns:
                for s in (-1, 1): bp.set(x + rx * s + ox, y + 1, z + rz * s + oz, "lantern", hanging=True)
        elif lanterns:
            for s in (-2, 2):
                if self.bp.get(x + rx * s + ox, y + 2, z + rz * s + oz)[0] in ("keep", "air"):
                    bp.set(x + rx * s + ox, y + 2, z + rz * s + oz, P["trim"], facing=OPP[side], half="top")   # bracket
                    bp.set(x + rx * s + ox, y + 1, z + rz * s + oz, "lantern", hanging=True)

    # ---- roofs
    def roof(self, rect, ridge, base, overhang=1, verge=1, pitch=1, mats=None):
        """Gable roof over rect (wall outline) with the ridge along 'x' or 'z'."""
        r = list(rect)
        if ridge == "x": r = [r[0] - verge, r[1] - overhang, r[2] + verge, r[3] + overhang]
        else: r = [r[0] - overhang, r[1] - verge, r[2] + overhang, r[3] + verge]
        self.roofs.append((tuple(r), ridge, base - overhang * pitch, pitch, mats or {}, tuple(rect)))

    def height(self, x, z):
        best, who = None, None
        for i, (r, ridge, base, pitch, mats, wall) in enumerate(self.roofs):
            if not (r[0] <= x <= r[2] and r[1] <= z <= r[3]): continue
            if ridge == "x": lo, hi, c = r[1], r[3], z
            else: lo, hi, c = r[0], r[2], x
            d = min(c - lo, hi - c)
            h = base + d * pitch
            if best is None or h > best: best, who = h, i
        return best, who

    def build_roofs(self):
        bp, P = self.bp, self.P
        cells = set()
        for r, *_ in self.roofs:
            for x in range(r[0], r[2] + 1):
                for z in range(r[1], r[3] + 1): cells.add((x, z))
        Hm = {c: self.height(*c) for c in cells}
        for (x, z), (h, i) in Hm.items():
            r, ridge, base, pitch, mats, wall = self.roofs[i]
            m = lambda k: mats.get(k, P[k])
            verge_cell = (ridge == "x" and x in (r[0], r[2])) or (ridge == "z" and z in (r[1], r[3]))
            higher = []
            for d, (dx, _, dz) in DIRS.items():
                n = Hm.get((x + dx, z + dz))
                if n and n[0] > h: higher.append((n[0] - h, d))
            stair, block, slab = m("roof"), m("roof_block"), m("roof_slab")
            if higher:
                higher.sort(reverse=True)
                bp.set(x, h, z, stair, facing=higher[0][1], half="bottom")
                if verge_cell and bp.get(x, h - 1, z)[0] in ("keep", "air") and h > base:
                    bp.set(x, h - 1, z, m("trim"), facing=OPP[higher[0][1]], half="top")   # barge board under the verge
                if higher[0][0] > 1:      # steeper than a stair: stack blocks under
                    for y in range(h + 1, h + higher[0][0]): bp.set(x, y, z, block)
                    bp.set(x, h + higher[0][0] - 1, z, stair, facing=higher[0][1], half="bottom")
            else:
                bp.set(x, h, z, block); bp.set(x, h + 1, z, slab, half="bottom")
        self.H = Hm

    def gable_walls(self, rect, ridge, y_from, style="timber"):
        """Fill the triangular gable ends of a roof over rect (wall outline)."""
        bp, P = self.bp, self.P
        x0, z0, x1, z1 = rect
        ends = [(x, z0) for x in range(x0, x1 + 1)] + [(x, z1) for x in range(x0, x1 + 1)] if ridge == "z" else \
               [(x0, z) for z in range(z0, z1 + 1)] + [(x1, z) for z in range(z0, z1 + 1)]
        for (x, z) in ends:
            h, _ = self.H.get((x, z), (None, None))
            if h is None: continue
            for y in range(y_from, h):
                if bp.get(x, y, z)[0] in ("air", "keep"):
                    if style == "timber":
                        edge = (x in (x0, x1)) if ridge == "z" else (z in (z0, z1))
                        center = (x == (x0 + x1) // 2) if ridge == "z" else (z == (z0 + z1) // 2)
                        bp.set(x, y, z, P["frame"], axis="y") if (center or y == y_from) and not edge else bp.set(x, y, z, P["gable"] or P["infill"])
                        if y == y_from: bp.set(x, y, z, P["frame"], axis="x" if ridge == "z" else "z")
                    else:
                        bp.set(x, y, z, P["stone"])
        # clear the attic under the roof inside the walls
        for x in range(x0 + 1, x1):
            for z in range(z0 + 1, z1):
                h, _ = self.H.get((x, z), (None, None))
                if h is None: continue
                for y in range(y_from, h):
                    if bp.get(x, y, z)[0] in ("keep",): bp.set(x, y, z, "air")

    def eaves(self, rect, ridge, y):
        """Upside-down trim stairs tucked under the eave overhang along the long walls."""
        bp, P = self.bp, self.P
        x0, z0, x1, z1 = rect
        sides = "ns" if ridge == "x" else "ew"
        for side in sides:
            dx, _, dz = DIRS[side]
            for (x, z) in side_cells(x0, z0, x1, z1, side):
                c = bp.get(x + dx, y, z + dz)
                if c[0] in ("keep", "air"): bp.set(x + dx, y, z + dz, P["trim"], facing=OPP[side], half="top")

    def chimney(self, x, z, y0, top=None, w=1, d=1):
        bp, P = self.bp, self.P
        if top is None:
            hs = [self.H.get((x + i, z + j), (y0, 0))[0] for i in range(w) for j in range(d)]
            top = max(hs) + 2
        for i in range(w):
            for j in range(d):
                for y in range(y0, top + 1): bp.set(x + i, y, z + j, P["chimney"])
                bp.set(x + i, top + 1, z + j, P["chimney_cap"])
        return top
