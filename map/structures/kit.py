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

# ---- texturing doctrine (build-instructions/texturing, PR #87): gradients, not speckle ----------------
def _load_ladders():
    """Every colour ladder (code -> blocks, bottom of the wall to the top) from the doctrine JSON: the repo copy
    in build-instructions/texturing once PR #87 is in, else the copy kept next to this file."""
    import json, os
    here = os.path.dirname(os.path.abspath(__file__))
    for p in (os.path.join(here, "..", "..", "build-instructions", "texturing", "doctrine.json"), os.path.join(here, "doctrine_ladders.json")):
        if os.path.exists(p):
            out = {}
            for r in json.load(open(p))["regions"]:
                for v in r.values():
                    for c in (v if isinstance(v, list) else []):
                        if isinstance(c, dict) and "code" in c: out[c["code"]] = list(c["blocks"])
            return out
    raise FileNotFoundError("doctrine.json")
LADDERS = _load_ladders()

def stairs_of(block):
    """The stair block made of a full block (deepslate_tiles -> deepslate_tile_stairs)."""
    special = {"deepslate_tiles": "deepslate_tile_stairs", "deepslate_bricks": "deepslate_brick_stairs", "stone_bricks": "stone_brick_stairs",
               "mud_bricks": "mud_brick_stairs", "tuff_bricks": "tuff_brick_stairs", "prismarine_bricks": "prismarine_bricks_stairs",
               "polished_blackstone_bricks": "polished_blackstone_brick_stairs", "brick_block": "brick_stairs", "quartz_bricks": "quartz_stairs"}
    if block in special: return special[block]
    if block.endswith("_planks"): return block[:-7] + "_stairs"
    return block + "_stairs"

SLATE = [stairs_of(b) for b in LADDERS["VAL-06"]]                                              # eaves -> ridge
COPPER = ["waxed_cut_copper_stairs", "waxed_exposed_cut_copper_stairs", "waxed_weathered_cut_copper_stairs",
          "waxed_oxidized_cut_copper_stairs"]                                                    # eaves -> ridge
COPPER_MATS = dict(roof=COPPER[0], roof_ladder=COPPER, roof_block="waxed_oxidized_cut_copper",
                   roof_slab="waxed_oxidized_cut_copper_slab")
VALE_STONE = LADDERS["VAL-01"]                                                                  # Mateo's ladder, bottom to top
STONE_FAMILY = {"stone_bricks", "cracked_stone_bricks", "mossy_stone_bricks", "cobblestone", "mossy_cobblestone",
                "andesite", "tuff", "tuff_bricks", "stone", "smooth_stone"}

DOCTRINE = dict(dress=True, verge_lanterns=True, arched_jetty=True, panel_trapdoor="dark_oak_trapdoor")

def finish_doctrine(bp, ladder=VALE_STONE, family=STONE_FAMILY, planters=True, wood="spruce"):
    """Canvas first, paint last: repaint the stone walls by the doctrine, dress the foot of the stone walls
    (07-detailing: sign-boxed bushes and spruce lantern stands), then finish the blueprint."""
    paint_stone(bp, ladder, family)
    if planters: ground_dressing(bp, set(ladder) | set(family), wood)
    return bp.finish()

def finish_detail(bp, P=None):
    """The last pass for builds outside the Vale doctrine palettes (settlement halls, plot buildings, stations):
    bushes and lantern stands at the foot of blank stone walls, then finish. Emberwaste's sand gets none."""
    # settlement builds are placed in fixed slots: dressing never widens a build's footprint, so trim any
    # shutter, shelf, sign or lantern that would stand outside the box of the building itself
    detail = lambda n: n.endswith(("trapdoor", "_wall_sign", "_leaves", "lantern")) or n in ("iron_chain", "flower_pot", "azalea_leaves_flowered") \
        or (n.endswith("_slab") and n == (P or {}).get("shelf"))
    core = [c for c, (n, p) in bp.cells.items() if not detail(n) and n not in ("air", "keep")]
    if core:
        x0 = min(c[0] for c in core); x1 = max(c[0] for c in core); z0 = min(c[2] for c in core); z1 = max(c[2] for c in core)
        for c in [c for c, (n, p) in bp.cells.items() if detail(n) and not (x0 <= c[0] <= x1 and z0 <= c[2] <= z1)]: del bp.cells[c]
    if P is None or P.get("planters", True):
        stone = {n for n, p in bp.cells.values() if n.startswith("siege:castle") or n in STONE_FAMILY}
        wood = (P or {}).get("trim", "spruce_stairs").replace("_stairs", "")
        if stone:
            before = set(bp.cells)
            ground_dressing(bp, stone, wood if wood != "smooth_sandstone" else "spruce")
            if core:
                for c in set(bp.cells) - before:
                    if not (x0 <= c[0] <= x1 and z0 <= c[2] <= z1): del bp.cells[c]
    return bp.finish()

def smooth_noise(a, b, seed, cell=4.0):
    """Value noise in 0..1 that forms clusters about `cell` blocks across (never single-block speckle)."""
    fa, fb = a / cell, b / cell
    ia, ib = math.floor(fa), math.floor(fb)
    ta, tb = fa - ia, fb - ib
    ta, tb = ta * ta * (3 - 2 * ta), tb * tb * (3 - 2 * tb)
    g = lambda i, j: h3(i, j, 0, seed)
    top = g(ia, ib) * (1 - ta) + g(ia + 1, ib) * ta
    bot = g(ia, ib + 1) * (1 - ta) + g(ia + 1, ib + 1) * ta
    return top * (1 - tb) + bot * tb

def band_index(h, base, top, n, col, seed=77, depth=1):
    """Which of n ladder steps a roof row h takes between base (eaves) and top (ridge): clean bands, each band
    edge shifted up or down by up to `depth` rows per column `col` (interlocking teeth at the band edges only,
    never islands inside a band)."""
    span = max(1, top - base + 1)
    if span / n < 3: depth = 0          # bands under 3 rows: teeth would break them into patches
    i = 0
    for k in range(n - 1):
        edge = (k + 1) * span / n + round((h3(col, k, 0, seed) - 0.5) * (2 * depth + 0.99))
        if h - base >= edge: i += 1
    return min(n - 1, i)

GROUND_LEAVES = ("azalea_leaves", "azalea_leaves_flowered")

def ground_dressing(bp, stone, wood="spruce", seed=21, leaves=GROUND_LEAVES, lamp="lantern"):
    """07-detailing at the foot of stone walls: here and there a bush held in by wall signs, or a slab
    lantern stand, on the outside of a blank stretch of stone wall (never in front of a door or window)."""
    sign = f"{wood}_wall_sign"
    cells = [c for c, (n, p) in bp.cells.items() if c[1] == 1 and n in stone]
    if not cells: return
    taken = set()
    free = lambda c: bp.get(*c)[0] in ("keep", "air")
    blank = lambda c: bp.get(*c)[0] in stone
    for (x, y, z) in sorted(cells):
        for side, (dx, _, dz) in DIRS.items():
            o = (x + dx, 1, z + dz)
            if not free(o) or not free((o[0], 2, o[2])) or o in taken: continue
            if not blank((x, 2, z)): continue                       # a window or door above: keep it clear
            ax, az = (1, 0) if side in "ns" else (0, 1)
            if any(not blank((x + ax * k, yy, z + az * k)) for k in (-1, 1) for yy in (1, 2)): continue
            if bp.get(x - dx, 1, z - dz)[0] in ("keep", "air"): continue   # only on real walls with a room behind
            r = h3(x, z, side == "s", seed)
            if r < 0.16:                                             # a bush boxed in by signs
                bp.set(*o, leaves[int(h3(x, 3, z, seed) * len(leaves))], persistent=True)
                f2 = (o[0] + dx, 1, o[2] + dz)
                if free(f2): bp.set(*f2, sign, facing=side)
                for k, d in ((-1, LEFT_OF[side]), (1, RIGHT_OF[side])):
                    f3 = (o[0] + ax * k, 1, o[2] + az * k)
                    if free(f3): bp.set(*f3, sign, facing=d); taken.add(f3)
                taken.update({o, f2})
            elif r < 0.22:                                           # a spruce lantern stand
                bp.set(*o, f"{wood}_slab", half="top"); taken.add(o)
                if free((o[0], 2, o[2])): bp.set(o[0], 2, o[2], lamp)

LEFT_OF = {"s": "w", "n": "w", "e": "n", "w": "n"}
RIGHT_OF = {"s": "e", "n": "e", "e": "s", "w": "s"}

def paint_stone(bp, ladder=VALE_STONE, family=STONE_FAMILY, seed=5, depth=1, lone=0.03):
    """The doctrine's last pass over finished stone walls (texturing/doctrine.py paint_teeth, Mateo's gradient
    examples): every outside stone cell is repainted in bands from the foot of its wall to the top, dark to
    light, the band edges interlocking column by column (each edge shifted up or down by up to `depth`) with a
    few lone blocks one row ahead of each edge, then no skipped steps between neighbours. Small walls (under
    9 rows) use 3 steps of the ladder, taller ones all of it."""
    cells = {c for c, (n, p) in bp.cells.items() if n in family and c[1] >= 1}
    air = lambda c: bp.cells.get(c, ("keep",))[0] in ("keep", "air")
    outer = {c for c in cells if any(air((c[0] + dx, c[1], c[2] + dz)) for dx, dz in ((1, 0), (-1, 0), (0, 1), (0, -1)))}
    if not outer: return
    # bands run level round the whole building from its foot (not from the foot of each column, which put
    # blotches over arches and openings); the top of the tallest wall gets the lightest step
    y_lo = min(c[1] for c in outer); y_hi = max(c[1] for c in outer)
    lo = {(x, z): y_lo for (x, y, z) in outer}
    rows = y_hi - y_lo + 1
    lad = ladder if rows >= 9 else ladder[:3]
    n = len(lad)
    hsh = lambda a, b, s: h3(a, b, 0, s)
    idx = {}
    for (x, y, z) in outer:
        h = rows; yy = y - lo[(x, z)]
        col = x + z            # runs along either wall direction, so neighbouring columns share a tooth
        cut = [(k + 1) * h / n + round((smooth_noise(col, k * 17, seed, 2.5) - 0.5) * (2 * depth + 0.99)) for k in range(n - 1)]
        i = sum(1 for c in cut if yy >= c)
        r = hsh(col, yy, seed + 13)
        if r < lone / 2 and i < n - 1 and yy + 1 >= cut[i] - 1: i += 1
        elif r > 1 - lone / 2 and i > 0 and yy <= cut[i - 1] + 1: i -= 1
        idx[(x, y, z)] = i
    for _ in range(n):
        changed = False
        for c, i in list(idx.items()):
            for d in ((1, 0, 0), (0, 1, 0), (0, 0, 1)):
                o = (c[0] + d[0], c[1] + d[1], c[2] + d[2])
                if o in idx and abs(idx[o] - idx[c]) > 1:
                    if idx[c] > idx[o]: idx[c] -= 1
                    else: idx[o] -= 1
                    changed = True
        if not changed: break
    for c, i in idx.items(): bp.cells[c] = (lad[i], {})

# ---- palettes -------------------------------------------------------------
VALE = dict(
    stone=mix([("stone_bricks", 50), ("cracked_stone_bricks", 10), ("mossy_stone_bricks", 8), ("cobblestone", 14), ("andesite", 10), ("tuff", 4)], 3,
              low_moss=("mossy_cobblestone", 0.35, 2)),
    plinth=mix([("cobblestone", 50), ("mossy_cobblestone", 30), ("stone_bricks", 10), ("andesite", 10)], 4),
    found="cobblestone", quoin="polished_andesite",
    frame="stripped_dark_oak_log", frame2="dark_oak_log",
    infill="calcite",
    floor="spruce_planks", gable=None,
    roof="deepslate_tile_stairs",   # painted as a gradient by roof_ladder (texturing doctrine), not a random mix
    roof_block="deepslate_tiles", roof_slab="deepslate_tile_slab", roof_ladder=SLATE,
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
        if not hasattr(bp, "_builders"): bp._builders = []
        bp._builders.append(self)   # every Building on a blueprint shares one roofscape: the higher roof wins (06-roof "Connecting roofs")
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
                    elif y == y0 and y0 > 1 and P.get("dress") and min(abs(i - p_) for p_ in posts) >= 1 and i % 2 == 0:
                        bp.set(x, y, z, P["frame"], axis="z" if axis == "x" else "x")    # beam ends of the beamed floor show in the band (03)
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
            cells = side_cells(x0, z0, x1, z1, side)
            posts = [i for i, (x, z) in enumerate(cells) if i in (0, len(cells) - 1) or
                     (bp.get(x, y + 1, z)[0] == P["frame"] and bp.get(x, y + 1, z)[1].get("axis") == "y")]
            for i, (x, z) in enumerate(cells):
                if i in posts: bp.set(x, y, z, P["bracket"], facing=OPP[side], half="top")
                elif P.get("arched_jetty"):      # arched supports between the posts: slab, trapdoor at mid-bay (02-frame)
                    d = min(abs(i - p) for p in posts)
                    if d == 1: bp.set(x, y, z, P["trim_slab"], half="top")
                    else: bp.set(x, y, z, P.get("panel_trapdoor", P["shutter"]), facing=side, half="top")

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
            asked = shutters is not None
            if shutters is None: shutters = h3(x, y, z, self.seed + 31) < self.P.get("shutters", 0.3)
            if P.get("dress") and not asked:
                self.dress_window(x, y, z, side, w, h)
                return
            sh = (((x - rx + 2 * ox, z - rz + 2 * oz), (x + rx * w + 2 * ox, z + rz * w + 2 * oz)) if shutters else ())
            for sx, sz in sh:
                if bp.get(sx, y, sz)[0] in ("keep", "air"):
                    for j in range(h): bp.set(sx, y + j, sz, P["shutter"], facing=side, open=True)
        elif kind == "stone" and P.get("dress"):
            # dark oak trapdoor panels either side of a stone window (05, the stone / spruce / dark oak pairing)
            panel = P.get("panel_trapdoor", "dark_oak_trapdoor")
            for sx, sz in ((x - rx + ox, z - rz + oz), (x + rx * w + ox, z + rz * w + oz)):
                if all(bp.get(sx, y + j, sz)[0] in ("keep", "air") for j in range(h)) and bp.get(sx - ox, y, sz - oz)[0] not in ("keep", "air") \
                        and not bp.get(sx - ox, y, sz - oz)[0].endswith(("_pane", "_door")):
                    for j in range(h): bp.set(sx, y + j, sz, panel, facing=side, open=True)

    def dress_window(self, x, y, z, side, w, h):
        """Shutter dressing (05-windows-and-doors): trapdoor shutters both sides, a slab shelf under the window,
        and by a seeded hash so neighbours differ: a lantern on the shelf (about one in three, never two side by
        side), leaves hanging under the shelf, a leaf box held by a sign, or the shelf alone."""
        bp, P = self.bp, self.P
        rx, rz = DIRS[RIGHT[side]][0], DIRS[RIGHT[side]][2]
        ox, oz = DIRS[side][0], DIRS[side][2]
        free = lambda a, b, c: bp.get(a, b, c)[0] in ("keep", "air")
        for sx, sz in ((x - rx + 2 * ox, z - rz + 2 * oz), (x + rx * w + 2 * ox, z + rz * w + 2 * oz)):
            if all(free(sx, y + j, sz) for j in range(h)):
                for j in range(h): bp.set(sx, y + j, sz, P["shutter"], facing=side, open=True)
        shelf = P.get("shelf", "spruce_slab")
        cells = [(x + rx * i + 2 * ox, z + rz * i + 2 * oz) for i in range(w)]
        if not all(free(cx, y - 1, cz) for cx, cz in cells): return
        r = h3(x, y, z, self.seed + 57)
        mx, mz = cells[w // 2]
        lamp = P.get("lantern", "lantern")
        lit_near = any(bp.get(mx + rx * k, yy, mz + rz * k)[0] == lamp for k in (-3, -2, -1, 1, 2, 3) for yy in (y, y - 4, y + 4))
        lv = P.get("leaves", ("azalea_leaves_flowered", "azalea_leaves"))
        leaves = lv[0] if h3(x, y, z, self.seed + 5) < 0.5 else lv[-1]
        if 0.33 <= r < 0.47 and all(free(cx + ox, y - 1, cz + oz) for cx, cz in cells):     # leaf box with a sign in front
            sign = P["trim"].replace("_stairs", "") + "_wall_sign"
            for cx, cz in cells:
                bp.set(cx, y - 1, cz, leaves, persistent=True); bp.set(cx + ox, y - 1, cz + oz, sign, facing=side)
            return
        for cx, cz in cells: bp.set(cx, y - 1, cz, shelf, half="top")
        if r < 0.33 and not lit_near:
            bp.set(mx, y, mz, lamp)
        elif r < 0.62 and all(free(cx, y - 2, cz) for cx, cz in cells):
            for cx, cz in cells:
                if h3(cx, y, cz, self.seed + 9) < 0.8: bp.set(cx, y - 2, cz, leaves, persistent=True)

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
        if P.get("dress"):            # a large-looking door: trapdoors framing it make the opening read 3 wide (05)
            for s_ in (-1, 1):
                if all(bp.get(x + rx * s_ + ox, y + j, z + rz * s_ + oz)[0] in ("keep", "air") for j in (0, 1)):
                    for j in (0, 1): bp.set(x + rx * s_ + ox, y + j, z + rz * s_ + oz, P.get("panel_trapdoor", P["shutter"]), facing=side, open=True)
            canopy_lanterns = False
        else: canopy_lanterns = True
        if canopy and room:
            for s in (-1, 0, 1): bp.set(x + rx * s + ox, y + 2, z + rz * s + oz, P["trim"], facing=OPP[side], half="bottom")
            if lanterns and not canopy_lanterns:
                for s in (-2, 2):
                    if all(self.bp.get(x + rx * s + ox, y + k, z + rz * s + oz)[0] in ("keep", "air") for k in (1, 2)):
                        bp.set(x + rx * s + ox, y + 2, z + rz * s + oz, P["trim"], facing=OPP[side], half="top")   # bracket
                        bp.set(x + rx * s + ox, y + 1, z + rz * s + oz, P.get("lantern", "lantern"), hanging=True)
            elif lanterns:
                for s in (-1, 1): bp.set(x + rx * s + ox, y + 1, z + rz * s + oz, P.get("lantern", "lantern"), hanging=True)
        elif lanterns:
            for s in (-2, 2):
                if self.bp.get(x + rx * s + ox, y + 2, z + rz * s + oz)[0] in ("keep", "air"):
                    bp.set(x + rx * s + ox, y + 2, z + rz * s + oz, P["trim"], facing=OPP[side], half="top")   # bracket
                    bp.set(x + rx * s + ox, y + 1, z + rz * s + oz, P.get("lantern", "lantern"), hanging=True)

    def big_door(self, x, y, z, side, frame=None):
        """The six-block door for halls, barns and stores (05): a double door two wide with a row of slabs over
        it, trapdoors framing the opening, jambs and a lintel, lanterns either side."""
        bp, P = self.bp, self.P
        rx, rz = DIRS[RIGHT[side]][0], DIRS[RIGHT[side]][2]
        ox, oz = DIRS[side][0], DIRS[side][2]
        for i in (0, 1):
            cx, cz = x + rx * i, z + rz * i
            bp.set(cx, y, cz, P["door"], facing=OPP[side], hinge=i == 1)
            bp.set(cx, y + 1, cz, P["door"], facing=OPP[side], upper=True, hinge=i == 1)
            bp.set(cx, y + 2, cz, P.get("trim_slab", "spruce_slab"), half="top")
            for j in (0, 1, 2): bp.set(cx - ox, y + j, cz - oz, "air")
        jamb = frame or P.get("jamb", P["frame"])
        for cx, cz in ((x - rx, z - rz), (x + 2 * rx, z + 2 * rz)):
            for j in (0, 1, 2): bp.set(cx, y + j, cz, jamb, axis="y")
            if all(bp.get(cx + ox, y + j, cz + oz)[0] in ("keep", "air") for j in (0, 1)):
                for j in (0, 1): bp.set(cx + ox, y + j, cz + oz, P.get("panel_trapdoor", P["shutter"]), facing=side, open=True)
        for i in range(-1, 3): bp.set(x + rx * i, y + 3, z + rz * i, P.get("lintel", P["frame"]), axis="x" if side in "ns" else "z")
        for cx, cz in ((x - 2 * rx + ox, z - 2 * rz + oz), (x + 3 * rx + ox, z + 3 * rz + oz)):
            if bp.get(cx, y + 2, cz)[0] in ("keep", "air"):
                bp.set(cx, y + 2, cz, P["trim"], facing=OPP[side], half="top"); bp.set(cx, y + 1, cz, P.get("lantern", "lantern"), hanging=True)

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

    def _others(self):
        return [r for b in getattr(self.bp, "_builders", []) if b is not self for r in b.roofs]

    def _other_height(self, x, z):
        best = None
        for (r, ridge, base, pitch, mats, wall) in self._others():
            if not (r[0] <= x <= r[2] and r[1] <= z <= r[3]): continue
            lo, hi, c = (r[1], r[3], z) if ridge == "x" else (r[0], r[2], x)
            h = base + min(c - lo, hi - c) * pitch
            if best is None or h > best: best = h
        return best

    @staticmethod
    def _ridge_h(roof):
        r, ridge, base, pitch = roof[:4]
        return base + ((r[3] - r[1]) // 2 if ridge == "x" else (r[2] - r[0]) // 2) * pitch

    def _extend_into(self):
        """A roof whose gable end stops inside a higher, crossing roof runs on to that roof's ridge, so it
        dies into the slope as a valley instead of leaving its gable and barge boards standing in the roof."""
        everyone = [r for b in getattr(self.bp, "_builders", [self]) for r in b.roofs]
        for i, A in enumerate(self.roofs):
            r, ridge, base, pitch, mats, wall = A
            r = list(r)
            for B in everyone:
                if B is A or B[1] == ridge or self._ridge_h(B) < self._ridge_h(A): continue
                bw = B[5]
                if ridge == "x":
                    cz = (wall[1] + wall[3]) // 2
                    if not (bw[1] <= cz <= bw[3]): continue
                    mid = (bw[0] + bw[2]) // 2
                    if bw[0] <= wall[0] <= bw[2] and wall[0] > mid: r[0] = min(r[0], mid)
                    if bw[0] <= wall[2] <= bw[2] and wall[2] < mid: r[2] = max(r[2], mid)
                else:
                    cx = (wall[0] + wall[2]) // 2
                    if not (bw[0] <= cx <= bw[2]): continue
                    mid = (bw[1] + bw[3]) // 2
                    if bw[1] <= wall[1] <= bw[3] and wall[1] > mid: r[1] = min(r[1], mid)
                    if bw[1] <= wall[3] <= bw[3] and wall[3] < mid: r[3] = max(r[3], mid)
            self.roofs[i] = (tuple(r), ridge, base, pitch, mats, wall)

    def build_roofs(self):
        bp, P = self.bp, self.P
        self._extend_into()
        cells = set()
        for r, *_ in self.roofs:
            for x in range(r[0], r[2] + 1):
                for z in range(r[1], r[3] + 1): cells.add((x, z))
        Hm = {c: self.height(*c) for c in cells}
        OH = {}
        def other(x, z):
            if (x, z) not in OH: OH[(x, z)] = self._other_height(x, z)
            return OH[(x, z)]
        def solid(n): return n not in ("keep", "air")
        ridge_cells = {}
        ladder_span = {}
        for (r_, ridge_, base_, pitch_, mats_, wall_) in self.roofs:
            lad = mats_.get("roof_ladder", P.get("roof_ladder"))
            if not lad: continue
            top_ = base_ + ((r_[3] - r_[1]) // 2 if ridge_ == "x" else (r_[2] - r_[0]) // 2) * pitch_
            b0, t0 = ladder_span.get(tuple(lad), (base_, top_))
            ladder_span[tuple(lad)] = (min(b0, base_), max(t0, top_))
        for (x, z), (h, i) in Hm.items():
            o = other(x, z)
            if o is not None and o >= h: continue        # another roof is higher here: it wins
            here, above = bp.get(x, h, z)[0], bp.get(x, h + 1, z)[0]
            if solid(here) and solid(above) and not (here.endswith(("_stairs", "_slab")) or here == P["roof_block"]):
                continue                                  # a wall carries on up through this cell: the wall wins
            r, ridge, base, pitch, mats, wall = self.roofs[i]
            m = lambda k: mats.get(k, P[k])
            verge_cell = (ridge == "x" and x in (r[0], r[2])) or (ridge == "z" and z in (r[1], r[3]))
            higher = []
            for d, (dx, _, dz) in DIRS.items():
                n = Hm.get((x + dx, z + dz)); nh = n[0] if n else None
                o2 = other(x + dx, z + dz)
                if o2 is not None and (nh is None or o2 > nh): nh = o2
                if nh is not None and nh > h: higher.append((nh - h, d))
            stair, block, slab = m("roof"), m("roof_block"), m("roof_slab")
            ladder = mats.get("roof_ladder", P.get("roof_ladder"))
            if ladder and isinstance(stair, str) and stair in ladder:          # slate / copper: a gradient eaves -> ridge
                # one gradient for every roof of the building: the same height takes the same step, so a wing
                # roof meets the main roof in one colour at the valley (06-roof, connecting roofs)
                lo_b, hi_t = ladder_span[tuple(ladder)]
                stair = ladder[band_index(h, lo_b, hi_t - 1, len(ladder), x if ridge == "x" else z)]
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
                ridge_cells.setdefault(i, []).append((x, h, z))
        # a full block of the trim wood under the lowest stair of every verge corner, where barge board meets
        # eave, so a roof corner is never empty and anything hung from it hangs from wood (06-roof step 5)
        for i, (r, ridge, base, pitch, mats, wall) in enumerate(self.roofs):
            for (x, z) in ((r[0], r[1]), (r[2], r[1]), (r[0], r[3]), (r[2], r[3])):
                h, who = Hm.get((x, z), (None, None))
                if who != i or h is None: continue
                o = other(x, z)
                if o is not None and o >= h: continue
                tb = mats.get("trim_block", P.get("trim_block", "dark_oak_planks"))
                if bp.get(x, h, z)[0].endswith("_stairs") and bp.get(x, h - 1, z)[0] in ("keep", "air"):
                    bp.set(x, h - 1, z, tb)
                if P.get("verge_lanterns"):
                    # the lantern hangs at the eaves corner one out from the long wall, in line with the gable wall,
                    # not out at the tip of the verge
                    if ridge == "x": hx, hz = (wall[0] if x == r[0] else wall[2]), z
                    else: hx, hz = x, (wall[1] if z == r[1] else wall[3])
                    hh = Hm.get((hx, hz), (None, None))[0]
                    if hh is not None and bp.get(hx, hh, hz)[0].endswith("_stairs") and hh - 3 >= 2 and \
                            all(bp.get(hx, hh - k, hz)[0] in ("keep", "air") for k in (1, 2, 3, 4)):
                        bp.set(hx, hh - 1, hz, tb); bp.set(hx, hh - 2, hz, "iron_chain"); bp.set(hx, hh - 3, hz, P.get("lantern", "lantern"), hanging=True)
        if P.get("spikes"):           # 07-detailing: ridge spikes every few blocks, finials at the gable peaks
            for i, cells in ridge_cells.items():
                ridge = self.roofs[i][1]
                cells.sort(key=lambda c: c[0] if ridge == "x" else c[2])
                if len(cells) < 3: continue
                step = P["spikes"]
                for k, (x, h, z) in enumerate(cells):
                    end = k in (0, len(cells) - 1)
                    if end:
                        bp.set(x, h + 1, z, P.get("finial", P["fence"])); bp.set(x, h + 2, z, P.get("finial_top", P["fence"]))
                    elif k % step == 0 and len(cells) - 1 - k >= 2:
                        bp.set(x, h + 1, z, P.get("spike", P["fence"]))
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
        if P.get("dress") and w == 1 and d == 1:       # chimney top (06-roof): campfire boxed by trapdoors, a pot on top
            bp.set(x, top + 1, z, "campfire")
            wsign = P["trim"].replace("_stairs", "") + "_wall_sign"
            for dd, (dx, _, dz) in DIRS.items():       # signs of the trim wood round the last stone block (06-roof step 9)
                if bp.get(x + dx, top, z + dz)[0] in ("keep", "air"): bp.set(x + dx, top, z + dz, wsign, facing=dd)
            for dd, (dx, _, dz) in DIRS.items():
                if bp.get(x + dx, top + 1, z + dz)[0] in ("keep", "air"): bp.set(x + dx, top + 1, z + dz, "spruce_trapdoor", facing=dd, open=True)
            bp.set(x, top + 2, z, "flower_pot")
        return top
