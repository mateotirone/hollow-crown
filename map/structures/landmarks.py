"""The world's landmarks: the old things standing on each plot that its lore books describe.

Each design is a minecraft-builder skill spec (the one building engine, Mateo 2026-11-12) plus a few keys the
game needs to set it on the land (scripts/landmarks/plan.js):

    mode    "rigid" (keeps its shape at one ground height, graded in) or "drape" (each column follows the land)
    rise    drape only: columns standing in water are carried up to the surface; `piles` lists the blocks that
            grow down to the bed under them (posts), the rest just float up with their neighbours
    fill / top   rigid only: the block that fills under the design and the ground's top block round it
                 (fill None: never fill, for things on a cliff edge that must not grow a pillar off it)
    ease    rigid only: blocks of grading round the design (default 3)
    signs   [[x, y, z, text]]  sign texts the game writes after placing
    spawns  [[x, y, z, entity]]  animals let loose once, when it is built
    mark    [x, y, z]  where the lore's Ledger points (lore/ledger.js markPlace)

Coordinates: x east, y up, z south, y = 0 the ground layer. Designs that turn (pieces that seek water or a cliff
edge) are drawn with their front to the north (-z), the water or the drop beyond z = 0.

    python3 export_landmarks.py            -> Siege_Nights_BP/scripts/landmarks/designs_data.js
"""
import math

# ---------------------------------------------------------------- helpers


def h3(x, y, z, seed=0):
    """Deterministic hash in [0, 1)."""
    n = (x * 374761393 + y * 668265263 + z * 2147483647 + seed * 144269504) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFFFF) / 0x1000000


class D:
    """A design being drawn: blocks go into the spec's `place` list (later wins)."""

    def __init__(self, name, mode="rigid", seed=1, **meta):
        self.name, self.seed = name, seed
        self.cells = {}
        self.shapes, self.materials = [], {}
        self.meta = {"mode": mode, **meta}
        self.meta.setdefault("signs", [])
        self.meta.setdefault("spawns", [])

    def r(self, *k):
        return h3(*(list(k) + [0] * (3 - len(k)))[:3], self.seed + (k[3] if len(k) > 3 else 0))

    def put(self, x, y, z, b, **p):
        self.cells[(x, y, z)] = (b, p)

    def get(self, x, y, z):
        return self.cells.get((x, y, z), (None, None))[0]

    def air(self, x, y, z):
        self.cells[(x, y, z)] = ("air", {})

    def box(self, x0, y0, z0, x1, y1, z1, b, **p):
        for x in range(min(x0, x1), max(x0, x1) + 1):
            for y in range(min(y0, y1), max(y0, y1) + 1):
                for z in range(min(z0, z1), max(z0, z1) + 1):
                    self.put(x, y, z, b, **p)

    def pick(self, x, y, z, choices, salt=0):
        """choices: [(block, weight), ...]"""
        t = h3(x, y, z, self.seed + salt) * sum(w for _, w in choices)
        for b, w in choices:
            t -= w
            if t < 0: return b
        return choices[-1][0]

    def spec(self):
        place = [[x, y, z, b, p] for (x, y, z), (b, p) in sorted(self.cells.items()) if b != "air"]
        return {"name": self.name, "edition": "bedrock", "materials": self.materials, "shapes": self.shapes,
                "quality": 4, "hollow": getattr(self, "hollow", 0), "parts": getattr(self, "parts", []), "place": place}

    def airs(self):
        return [c for c, (b, _) in self.cells.items() if b == "air"]


CARD = {"n": (0, -1), "s": (0, 1), "e": (1, 0), "w": (-1, 0)}
OPP = {"n": "s", "s": "n", "e": "w", "w": "e"}


def oak(dsg, x, z, y=1, lean=(0, 0), tall=7, crown=3.5, log="oak_log", leaves="oak_leaves", salt=0):
    """A big old broadleaf: a trunk that leans `lean` (dx, dz per 3 up), a couple of limbs, a lumpy crown."""
    cx, cz = float(x), float(z)
    top = None
    for k in range(tall):
        bx, bz = round(cx), round(cz)
        dsg.put(bx, y + k, bz, log, axis="y")
        if k == 0:   # root flare
            for d in "nsew":
                dx, dz = CARD[d]
                if dsg.r(bx + dx, y, bz + dz, salt) < 0.6: dsg.put(bx + dx, y, bz + dz, log, axis="x" if dx else "z")
        if k and k % 3 == 0 and (lean[0] or lean[1]):
            nx, nz = cx + lean[0], cz + lean[1]
            if round(nx) != bx or round(nz) != bz:   # a sideways log joins the step
                dsg.put(round(nx), y + k, round(nz), log, axis="x" if round(nx) != bx else "z")
            cx, cz = nx, nz
        top = (round(cx), y + k, round(cz))
    tx, ty, tz = top
    # two limbs
    for i, d in enumerate(("e", "w") if dsg.r(tx, ty, tz, salt) < 0.5 else ("n", "s")):
        dx, dz = CARD[d]
        for s in (1, 2):
            dsg.put(tx + dx * s, ty - 1 + (s == 2), tz + dz * s, log, axis="x" if dx else "z")
    # crown: a squashed blob, edges ragged
    R = crown
    for ix in range(-int(R) - 2, int(R) + 3):
        for iz in range(-int(R) - 2, int(R) + 3):
            for iy in range(-2, 4):
                d = (ix * ix + iz * iz) / (R * R) + ((iy - 0.5) ** 2) / (2.4 * 2.4)
                if d < 1.0 - 0.25 * dsg.r(tx + ix, ty + iy, tz + iz, salt + 7):
                    c = (tx + ix, ty + iy, tz + iz)
                    if dsg.get(*c) is None: dsg.put(*c, leaves)
    return top


def palm(dsg, x, z, y=1, tall=8, bend=(1, 0), salt=0):
    """A desert palm: a slim jungle-log trunk leaning one way, a small head with long drooping fronds."""
    cx, cz = x, z
    for k in range(tall):
        if k and k % 3 == 0:
            cx += bend[0]; cz += bend[1]
            dsg.put(cx - bend[0], y + k, cz - bend[1], "jungle_log", axis="x" if bend[0] else "z")
        dsg.put(cx, y + k, cz, "jungle_log", axis="y")
    ty = y + tall
    dsg.put(cx, ty, cz, "jungle_leaves")
    dsg.put(cx, ty - 1, cz, "jungle_log", axis="y")
    for d, (dx, dz) in CARD.items():
        n = 3 + (dsg.r(cx + dx, ty, cz + dz, salt) < 0.5)
        for s in range(1, n + 1):
            dsg.put(cx + dx * s, ty - (s >= 3) - (s >= 4), cz + dz * s, "jungle_leaves")
    for dx, dz in ((1, 1), (1, -1), (-1, 1), (-1, -1)):
        dsg.put(cx + dx, ty, cz + dz, "jungle_leaves")
        dsg.put(cx + 2 * dx, ty - 1, cz + 2 * dz, "jungle_leaves")
    if dsg.r(cx, ty, cz, salt) < 0.5: dsg.put(cx + 1, ty - 2, cz, "cocoa", bs={"direction": 1})


def post(dsg, x, z, tall, wood="stripped_spruce_log", y=1):
    for k in range(tall): dsg.put(x, y + k, z, wood, axis="y")

# ---------------------------------------------------------------- Aldmere Vale


def harrowford_field():
    """The Field Without Bones: the Grey Host's iron rusting in the meadow, and not one bone."""
    d = D("harrowford_field", "drape", seed=11)
    R = 13
    for x in range(-R, R + 1):
        for z in range(-R, R + 1):
            r = math.hypot(x, z)
            if r > R: continue
            t = d.r(x, 0, z)
            if t < 0.10 and r < R - 1: d.put(x, 0, z, d.pick(x, 0, z, [("coarse_dirt", 3), ("dirt_with_roots", 1), ("podzol", 1)], 3))
            elif t < 0.135: d.put(x, 1, z, "iron_bars")                                        # a pike snapped off in the turf
            elif t < 0.15: d.put(x, 1, z, "iron_trapdoor", facing="nsew"[int(d.r(x, 1, z, 4) * 4)], half="bottom")  # a shield lying flat
            elif t < 0.158: d.put(x, 0, z, d.pick(x, 0, z, [("anvil", 1), ("chipped_anvil", 2), ("damaged_anvil", 3)], 5),
                                  bs={"minecraft:cardinal_direction": "nsew"[int(d.r(x, 0, z, 6) * 4)].replace("n", "north").replace("s", "south").replace("e", "east").replace("w", "west")})
            elif t < 0.163: d.put(x, 1, z, "iron_chain", axis="x" if d.r(x, 1, z, 7) < 0.5 else "z")
    # two of the eleven hundred camp fires: a ring of stones, a fire laid and never relit
    for fx, fz in ((-5, 3), (6, -4)):
        for dx in (-1, 0, 1):
            for dz in (-1, 0, 1):
                if dx or dz: d.put(fx + dx, 0, fz + dz, "cobblestone" if (dx and dz) else "mossy_cobblestone")
        d.put(fx, 0, fz, "coarse_dirt")
        d.put(fx, 1, fz, "campfire", bs={"extinguished": True})
        d.put(fx + 2, 1, fz, "cauldron")           # a cooking pot with the porridge burned on
    # a tent's ridge pole still standing on its two posts
    for k in (-2, 2):
        d.put(1 + k, 1, 7, "spruce_fence"); d.put(1 + k, 2, 7, "spruce_fence")
    for k in (-1, 0, 1): d.put(1 + k, 2, 7, "spruce_fence")
    d.meta["mark"] = [0, 1, 0]
    return d


def harrowford_ferry():
    """The ferryman's post, still in the bank of the Alder. Front (-z) is the river."""
    d = D("harrowford_ferry", "drape", seed=12, rise=True)
    # the landing: worn stone at the bank
    for x in range(-2, 3):
        for z in range(0, 3):
            if d.r(x, 0, z) < 0.8: d.put(x, 0, z, "mossy_cobblestone" if d.r(x, 0, z, 1) < 0.6 else "cobblestone")
    # the post: a great old log with a fence arm over the water and the chain the ferry rope ran through
    post(d, 0, 0, 5, "stripped_dark_oak_log")
    d.put(0, 5, -1, "dark_oak_fence"); d.put(0, 4, -1, "iron_chain", axis="y"); d.put(0, 3, -1, "iron_chain", axis="y")
    d.put(0, 6, 0, "dark_oak_slab", half="bottom")
    # the jetty: piles, a few deck boards left near the bank, stumps further out
    for z in range(-1, -8, -1):
        for x in (-1, 1):
            if z % 2 == 0 or z > -3: d.put(x, 1, z, "stripped_spruce_log", axis="y")
        if z >= -3:
            for x in (-1, 0, 1):
                if (x, z) != (0, -1) and d.r(x, 2, z) < 0.75: d.put(x, 2, z, "spruce_slab", half="bottom")
    d.put(2, 1, 1, "barrel", bs={"facing_direction": 1})
    d.meta["piles"] = ["stripped_spruce_log", "stripped_dark_oak_log"]
    return d


def oakmere_cellar():
    """The Cellar in the Oakwood: a mossy flagstone with an iron ring, a small empty cellar facing a blank wall."""
    d = D("oakmere_cellar", "rigid", seed=21, fill="dirt", top="keep", ease=3)
    # flagstones over the cellar
    for x in range(-2, 3):
        for z in range(-2, 3):
            d.put(x, 0, z, d.pick(x, 0, z, [("mossy_stone_bricks", 3), ("cracked_stone_bricks", 1), ("moss_block", 1)]))
    d.put(0, 0, 0, "iron_trapdoor", facing="s", half="top")      # the hatch with its iron ring
    # the cellar: 5 x 5 inside, 4 high, the ladder on the south wall, the north wall blank
    for x in range(-3, 4):
        for z in range(-3, 4):
            for y in range(-5, 0):
                edge = x in (-3, 3) or z in (-3, 3) or y in (-5,)
                if edge: d.put(x, y, z, d.pick(x, y, z, [("stone_bricks", 4), ("mossy_stone_bricks", 2), ("cracked_stone_bricks", 1)], 2))
                else: d.air(x, y, z)
    for y in range(-4, 0): d.put(0, y, 1, "ladder", bs={"facing_direction": 2})
    d.put(0, -1, 1, "stone_bricks"); d.put(0, -1, 2, "stone_bricks")
    for y in range(-4, 0): d.put(0, y, 1, "ladder", bs={"facing_direction": 2})
    d.box(-1, -4, 2, 1, -1, 2, "stone_bricks")
    d.put(0, -4, 1, "ladder", bs={"facing_direction": 2})
    d.put(-2, -4, -2, "web"); d.put(2, -2, -2, "web")
    d.meta["mark"] = [0, 0, 0]
    return d


def oakmere_oaks():
    """The oaks round the cellar, every one leaning a little away from it."""
    d = D("oakmere_oaks", "drape", seed=22)
    for k in range(7):
        a = k * 2 * math.pi / 7 + 0.3
        r = 8.5 + 1.5 * d.r(k, 0, 0)
        x, z = round(math.sin(a) * r), round(-math.cos(a) * r)
        lx, lz = round(math.sin(a)), round(-math.cos(a))
        oak(d, x, z, tall=8 + int(d.r(k, 1, 0) * 3), lean=(lx, lz), crown=3.5 + d.r(k, 2, 0), salt=k)
    return d


def thistledown_frame():
    """The Empty Frame: an old oak bell frame on the top of the down, with no bell in it."""
    d = D("thistledown_frame", "rigid", seed=31, fill="dirt", top="keep", ease=4)
    for x in range(-3, 4):
        for z in range(-2, 3):
            d.put(x, 0, z, d.pick(x, 0, z, [("mossy_stone_bricks", 3), ("stone_bricks", 2), ("cracked_stone_bricks", 1)]))
    for x in (-2, 2):
        post(d, x, 0, 7, "stripped_oak_log")
        for dz in (-1, 1):   # raking braces
            d.put(x, 1, dz, "oak_stairs", facing="s" if dz < 0 else "n")
            d.put(x, 2, dz, "oak_fence")
        d.put(x, 8, 0, "oak_planks")
    for x in range(-3, 4): d.put(x, 8, 0, "stripped_oak_log", axis="x")
    d.put(-1, 7, 0, "oak_stairs", facing="w", half="top"); d.put(1, 7, 0, "oak_stairs", facing="e", half="top")
    for x in range(-4, 5):   # a little gable roof over the beam, its eaves carried on the beam ends
        d.put(x, 8, -2, "spruce_stairs", facing="s"); d.put(x, 8, 2, "spruce_stairs", facing="n")
        d.put(x, 9, -1, "spruce_stairs", facing="s"); d.put(x, 9, 1, "spruce_stairs", facing="n")
        d.put(x, 9, 0, "spruce_planks"); d.put(x, 10, 0, "spruce_slab", half="bottom")
        if abs(x) == 4:
            d.put(x, 7, -2, "spruce_stairs", facing="n", half="top"); d.put(x, 7, 2, "spruce_stairs", facing="s", half="top")
    for z in (-1, 1): d.put(-4, 8, z, "spruce_planks"); d.put(4, 8, z, "spruce_planks")
    d.put(-4, 8, 0, "stripped_oak_log", axis="x"); d.put(4, 8, 0, "stripped_oak_log", axis="x")
    d.put(0, 11, 0, "lightning_rod")
    d.put(0, 7, 0, "iron_chain", axis="y")         # the chain the bell hung from, and nothing on it
    d.meta["mark"] = [0, 1, 0]
    return d


def thistledown_pens():
    """Sheep pens round the frame, their gates all opening toward it."""
    d = D("thistledown_pens", "drape", seed=32)
    for k, (cx, cz) in enumerate(((-11, -3), (10, 4), (-2, 11))):
        w, h = 3, 2
        ang = math.atan2(-cx, -cz)
        gate_side = "e" if abs(cx) > abs(cz) and cx < 0 else "w" if abs(cx) > abs(cz) else "n" if cz > 0 else "s"
        for x in range(cx - w, cx + w + 1):
            for z in range(cz - h, cz + h + 1):
                if x in (cx - w, cx + w) or z in (cz - h, cz + h):
                    d.put(x, 1, z, "oak_fence")
        gx, gz = cx + CARD[gate_side][0] * (w if gate_side in "ew" else 0), cz + CARD[gate_side][1] * (h if gate_side in "ns" else 0)
        d.put(gx, 1, gz, "fence_gate", bs={"direction": {"s": 0, "w": 1, "n": 2, "e": 3}[gate_side], "open_bit": False, "in_wall_bit": False})
        d.put(cx, 1, cz, "hay_block", axis="y")
        d.meta["spawns"] += [[cx - 1, 1, cz, "minecraft:sheep"], [cx + 1, 1, cz, "minecraft:sheep"]]
    return d


def wrenfield_garden():
    """The Letter in the Apple Tree: a burned house, its knee-high garden wall, one old apple tree with an E cut in it."""
    d = D("wrenfield_garden", "drape", seed=41)
    W, H = 9, 7
    for x in range(-W, W + 1):
        for z in range(-H, H + 1):
            if x in (-W, W) or z in (-H, H):
                if d.r(x, 0, z) < 0.22: continue          # gaps where the wall has gone
                d.put(x, 1, z, d.pick(x, 1, z, [("mossy_cobblestone_wall", 3), ("cobblestone_wall", 2), ("mossy_stone_brick_wall", 1)]))
                if d.r(x, 2, z) < 0.12: d.put(x, 1, z, "mossy_cobblestone")
    # the burned house: a charred footprint, stubs of wall, a fallen beam
    for x in range(-7, 0):
        for z in range(-5, 2):
            edge = x in (-7, -1) or z in (-5, 1)
            d.put(x, 0, z, d.pick(x, 0, z, [("coarse_dirt", 3), ("blackstone", 1), ("tuff", 1)], 2))
            if edge and d.r(x, 1, z) < 0.65:
                for y in range(1, 1 + int(d.r(x, 3, z) * 3) + 1):
                    d.put(x, y, z, d.pick(x, y, z, [("cobblestone", 2), ("blackstone", 2), ("polished_blackstone_bricks", 1), ("cracked_polished_blackstone_bricks", 1)], 3))
    for x in range(-6, -1): d.put(x, 1, -2, "stripped_dark_oak_log", axis="x")
    d.put(-4, 1, 0, "campfire", bs={"extinguished": True})
    # the apple tree, spared
    top = oak(d, 4, 2, tall=6, crown=3.5, salt=3)
    d.put(4, 2, 1, "oak_wall_sign", facing="n")
    d.meta["signs"].append([4, 2, 1, "E"])
    d.meta["mark"] = [4, 1, 3]
    return d


def wrenfield_jetty():
    """The stumps of a jetty in Wren Water. Front (-z) is the lake."""
    d = D("wrenfield_jetty", "drape", seed=42, rise=True)
    for z in range(-1, -10, -2):
        for x in (-1, 1):
            if d.r(x, 0, z) < 0.85: d.put(x, 1, z, "stripped_oak_log", axis="y")
    d.put(0, 0, 0, "oak_planks"); d.put(-1, 0, 0, "mossy_cobblestone"); d.put(1, 0, 0, "mossy_cobblestone")
    d.meta["piles"] = ["stripped_oak_log"]
    return d

# ---------------------------------------------------------------- Frostmarch


def frosthelm_road():
    """Forty Tons of Copper: an overgrown cart road climbing to a seam of copper, ending at packed ice.
    The road runs north (-z) uphill; the game turns it to climb."""
    d = D("frosthelm_road", "drape", seed=51)
    L = 26
    for z in range(8, -L, -1):
        wob = round(1.5 * math.sin(z * 0.21))
        for x in range(-2, 3):
            xx = x + wob
            t = d.r(xx, 0, z)
            if abs(x) <= 1:
                d.put(xx, 0, z, "coarse_dirt" if t < 0.55 else "gravel" if t < 0.75 else "grass_block")
            elif t < 0.5:
                d.put(xx, 0, z, "coarse_dirt")
        if d.r(wob, 1, z) < 0.7 and z > -L + 4: d.put(wob, 1, z, "rail", bs={"rail_direction": 0})
        if d.r(wob, 2, z) < 0.15: d.put(wob + 1, 1, z, "short_grass")
    # the end of the road: a tipped cart's iron, packed ice where the wall of the cut was
    for x in range(-4, 5):
        for z in range(-L - 4, -L + 3):
            if math.hypot(x, (z + L) * 1.2) < 4.2: d.put(x, 0, z, "packed_ice")
    for x, z, h in ((-3, -L - 3, 2), (-2, -L - 4, 3), (0, -L - 4, 3), (2, -L - 4, 2), (3, -L - 3, 1)):
        for y in range(1, h + 1): d.put(x, y, z, "packed_ice" if y > 1 or d.r(x, y, z) < 0.5 else "stone")
    # copper showing in the cut beside it, the silver and gold left in the wall
    for x, z, h in ((-6, -L - 1, 3), (-6, -L, 2), (-7, -L, 4), (-7, -L - 1, 4), (6, -L, 2), (7, -L - 1, 3)):
        for y in range(1, h + 1):
            t = d.r(x, y, z)
            d.put(x, y, z, "copper_ore" if t < 0.35 else "raw_copper_block" if t < 0.4 else "gold_ore" if t < 0.43 else "stone")
    d.put(1, 1, -L + 2, "iron_bars"); d.put(-1, 1, -L + 3, "iron_trapdoor", facing="e", half="bottom")
    d.meta["mark"] = [0, 1, -L]
    return d


def wolfcairn_cairn():
    """Six Thousand and Four Stones: a great cobble cairn on the plateau edge, small stones round its foot."""
    d = D("wolfcairn_cairn", "rigid", seed=61, fill="cobblestone", top="keep", ease=3)
    H = 10
    for y in range(0, H + 1):
        r = 4.6 * (1 - y / (H + 1.5)) ** 0.8 + 0.4
        for x in range(-6, 7):
            for z in range(-6, 7):
                rr = math.hypot(x, z) + 0.6 * (d.r(x, y // 2, z) - 0.5)
                if rr <= r:
                    d.put(x, y, z, d.pick(x, y, z, [("cobblestone", 5), ("mossy_cobblestone", 3), ("andesite", 1), ("stone", 1)]))
    d.put(0, H + 1, 0, "cobblestone_wall")
    # small stones round the foot
    for k in range(40):
        a = d.r(k, 0, 9) * 2 * math.pi
        rr = 5.5 + 2.5 * d.r(k, 1, 9)
        x, z = round(math.sin(a) * rr), round(math.cos(a) * rr)
        if d.get(x, 1, z) or d.get(x, 0, z) not in (None,): continue
        t = d.r(k, 2, 9)
        if t < 0.5: d.put(x, 1, z, "stone_button", bs={"facing_direction": 1})
        elif t < 0.8: d.put(x, 1, z, "cobblestone_slab", half="bottom")
        else: d.put(x, 1, z, "mossy_cobblestone_slab", half="bottom")
    d.meta["spawns"] = [[8, 1, 3, "minecraft:wolf"], [-7, 1, -5, "minecraft:wolf"], [3, 1, -9, "minecraft:wolf"]]
    d.meta["mark"] = [0, 1, 6]
    return d

# ---------------------------------------------------------------- Saltreach


def gullcliff_beacon():
    """Sails Without Wind: the iron beacon basket at the cliff edge, the watch room cut into the chalk under it.
    Front (-z) is the drop to the sea."""
    d = D("gullcliff_beacon", "rigid", seed=71, fill=None, top="keep", ease=0, clearTo=6)
    # a stone footing at the edge and the basket on an iron-bound post
    for x in range(-1, 2):
        for z in range(1, 4): d.put(x, 0, z, "polished_diorite" if (x + z) % 2 else "calcite")
    d.put(0, 1, 2, "stone_brick_wall"); d.put(0, 2, 2, "stone_brick_wall")
    d.put(0, 3, 2, "campfire", bs={"extinguished": True})
    for dx, dz in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, 1), (-1, 1), (1, -1)):
        d.put(dx, 3, 2 + dz, "iron_bars")
    d.put(0, 4, 2, "iron_bars")
    # the stair down: a hatch, then a ladder shaft into the room
    d.put(2, 0, 3, "spruce_trapdoor", facing="n", half="top")
    for y in range(-6, 0):
        d.air(2, y, 3)
        d.put(2, y, 4, "calcite")
        if y < 0: d.put(2, y, 3, "ladder", bs={"facing_direction": 2})
    # the watch room: 5 wide, 3 deep, 3 high, its slit window on the sea
    for x in range(-3, 4):
        for z in range(0, 6):
            for y in range(-8, -3):
                edge = x in (-3, 3) or z in (0, 5) or y in (-8, -4)
                if edge: d.put(x, y, z, d.pick(x, y, z, [("calcite", 4), ("diorite", 1), ("smooth_stone", 1)]))
                else: d.air(x, y, z)
    for y in range(-7, -4): d.air(2, y, 3)
    d.put(2, -7, 3, "ladder", bs={"facing_direction": 2}); d.put(2, -6, 3, "ladder", bs={"facing_direction": 2}); d.put(2, -5, 3, "ladder", bs={"facing_direction": 2})
    for z in range(-5, 0): d.air(0, -6, z)            # the slit cut out through the chalk to the sea
    d.put(0, -6, 0, "iron_bars")
    # three bunks, the tally on the wall above them
    for x in (-2, 0):
        d.put(x, -7, 4, "spruce_slab", half="top" if False else "bottom")
    d.put(-2, -6, 4, "spruce_trapdoor", facing="n", half="bottom")
    d.put(-2, -6, 1, "lantern", hanging=False)
    for k, x in enumerate((-2, -1, 0)):
        d.put(x, -6, 4, "spruce_wall_sign", facing="n")
        d.meta["signs"].append([x, -6, 4, ["IIII IIII IIII", "IIII IIII IIII IIII", "IIII IIII II", "IIII IIII IIII IIII"][k] + ("\n... and then\nno more" if k == 2 else "")])
    d.meta["mark"] = [0, 1, 2]
    return d


def tidewatch_posts():
    """The Last Post: measuring posts from the dunes down into the sea, marks cut on the far side of the last one.
    Front (-z) is the sea."""
    d = D("tidewatch_posts", "drape", seed=81, rise=True)
    for k, z in enumerate(range(9, -34, -3)):
        x = round(0.6 * math.sin(k * 0.7))
        if z > 0:
            d.put(x, 1, z, "stripped_spruce_log", axis="y"); d.put(x, 2, z, "spruce_fence")
        else:
            d.put(x, 1, z, "stripped_spruce_log", axis="y"); d.put(x, 2, z, "stripped_spruce_log", axis="y")
        last = (x, z)
    x, z = last
    d.put(x, 3, z, "stripped_spruce_log", axis="y")
    d.put(x, 2, z - 1, "stone_button", bs={"facing_direction": 2})
    d.put(x, 3, z - 1, "spruce_trapdoor", facing="n", half="bottom", open=True)
    d.put(x, 1, z - 1, "stone_button", bs={"facing_direction": 2})
    d.meta["piles"] = ["stripped_spruce_log"]
    return d

# ---------------------------------------------------------------- Blackfen


def reedmoor_ring():
    """The Even Market: a ring of nine old posts on bare ground where nothing grows."""
    d = D("reedmoor_ring", "drape", seed=91)
    for x in range(-12, 13):
        for z in range(-12, 13):
            r = math.hypot(x, z) + 1.2 * (d.r(x, 0, z) - 0.5)
            if r < 11: d.put(x, 0, z, "coarse_dirt" if d.r(x, 1, z) < 0.85 else "mud")
    for k in range(9):
        a = k * 2 * math.pi / 9
        x, z = round(math.sin(a) * 8.5), round(-math.cos(a) * 8.5)
        tall = 3 + int(d.r(k, 3, 3) * 2)
        post(d, x, z, tall, "stripped_spruce_log")
        if d.r(k, 4, 4) < 0.4: d.put(x, tall + 1, z, "moss_carpet")
        if d.r(k, 5, 5) < 0.5: d.put(x, 1, z + (1 if z < 0 else -1), "mangrove_roots")
    d.meta["mark"] = [0, 1, 0]
    return d


def lanternbog_posts():
    """The Loose Board: many short hooked posts, a few lanterns still lit, one soul lantern set apart."""
    d = D("lanternbog_posts", "drape", seed=101)
    spots = []
    for k in range(22):
        a = d.r(k, 0, 1) * 2 * math.pi
        r = 2 + 9 * math.sqrt(d.r(k, 1, 1))
        x, z = round(math.sin(a) * r), round(math.cos(a) * r)
        if any(abs(x - sx) + abs(z - sz) < 3 for sx, sz in spots) or max(abs(x), abs(z)) <= 3: continue
        spots.append((x, z))
    for k, (x, z) in enumerate(spots):
        tall = 1 + int(d.r(k, 2, 2) * 2)
        for y in range(1, tall + 1): d.put(x, y, z, "mangrove_fence")
        t = d.r(k, 3, 3)
        if t < 0.25:
            d.put(x, tall + 1, z, "lantern", hanging=False)
        elif t < 0.6:   # an arm with an empty chain
            d.put(x + 1, tall, z, "mangrove_fence"); d.put(x + 1, tall - 1, z, "iron_chain", axis="y") if tall > 1 else None
        else:           # a bare hook
            d.put(x, tall, z - 1, "tripwire_hook", bs={"direction": 2})
    # the lantern house itself: its mossy footing and the stumps of its frame
    for x in range(-2, 3):
        for z in range(-2, 3):
            edge = max(abs(x), abs(z)) == 2
            if edge and d.r(x, 0, z, 9) < 0.8: d.put(x, 1, z, d.pick(x, 1, z, [("mossy_cobblestone", 3), ("mud_bricks", 2), ("cobblestone", 1)], 9))
            elif not edge: d.put(x, 0, z, "mud")
    for x, z, h in ((-2, -2, 4), (2, -2, 2), (2, 2, 3)):
        for y in range(1, h + 1): d.put(x, y, z, "stripped_mangrove_log", axis="y")
    d.put(-2, 4, -1, "stripped_mangrove_log", axis="z"); d.put(-2, 3, 0, "lantern", hanging=True)
    # the one that was never taken down
    d.put(13, 1, 5, "mangrove_fence"); d.put(13, 2, 5, "mangrove_fence"); d.put(14, 2, 5, "mangrove_fence")
    d.put(14, 1, 5, "soul_lantern", hanging=True)
    d.meta["mark"] = [13, 1, 5]
    return d

# ---------------------------------------------------------------- Emberwaste


def redmesa_stones():
    """The Forty-First Stone: forty pale slabs in rows where statues were carved, one more under a fallen lean-to."""
    d = D("redmesa_stones", "drape", seed=111)
    n = 0
    for row in range(5):
        for col in range(8):
            cx, cz = -14 + col * 4, -10 + row * 5
            for dx in (0, 1):
                for dz in (0, 1, 2):
                    if d.r(cx + dx, 0, cz + dz) < 0.1: d.put(cx + dx, 0, cz + dz, "sand")
                    else: d.put(cx + dx, 1, cz + dz, "smooth_quartz_slab", half="bottom")
            if d.r(cx, 5, cz) < 0.3: d.put(cx + 1, 1, cz - 1, "sandstone_wall" if d.r(cx, 6, cz) < 0.5 else "chiseled_sandstone")
            n += 1
    # the forty-first, apart, under a collapsed lean-to; a carved head buried under it
    bx, bz = 19, 2
    for dx in (0, 1):
        for dz in (0, 1, 2): d.put(bx + dx, 1, bz + dz, "smooth_quartz_slab", half="bottom")
    d.put(bx, -1, bz + 1, "chiseled_red_sandstone"); d.put(bx, 0, bz + 1, "sand")
    for z in (bz - 1, bz + 3):
        d.put(bx + 2, 1, z, "stripped_acacia_log", axis="y"); d.put(bx + 2, 2, z, "stripped_acacia_log", axis="y")
    for z in range(bz - 1, bz + 4):
        d.put(bx + 1, 2, z, "acacia_slab", half="bottom")
        if d.r(bx, 3, z) < 0.6: d.put(bx, 1, z, "acacia_stairs", facing="e") if (z - bz) % 2 else None
    d.put(bx - 1, 1, bz + 4, "stripped_acacia_log", axis="z")
    d.put(bx - 1, 1, bz + 5, "stripped_acacia_log", axis="z")
    d.meta["mark"] = [bx, 1, bz + 1]
    return d


def dunehold_hall():
    """The House at the Well: a long low ruined mud-brick hall with forty chained desks."""
    d = D("dunehold_hall", "rigid", seed=121, fill="sandstone", top="keep", ease=3)
    W, Dp = 11, 9   # half sizes: 23 x 19
    for x in range(-W, W + 1):
        for z in range(-Dp, Dp + 1):
            d.put(x, 0, z, d.pick(x, 0, z, [("smooth_sandstone", 3), ("sandstone", 2), ("sand", 1)]))
            wall = x in (-W, W) or z in (-Dp, Dp)
            if wall:
                hgt = 5 - int(4 * (d.r(x // 2, 1, z // 2) ** 1.6))
                for y in range(1, hgt + 1):
                    d.put(x, y, z, d.pick(x, y, z, [("mud_bricks", 6), ("packed_mud", 1), ("smooth_sandstone", 1)], 2))
                if x in (-W, W) and z in (-Dp, Dp):
                    for y in range(1, 6): d.put(x, y, z, "stripped_jungle_log", axis="y")
    # the door, an arch on the south side
    for y in (1, 2, 3):
        for x in (-1, 0, 1): d.air(x, y, Dp)
    d.put(-1, 3, Dp, "mud_brick_stairs", facing="w", half="top"); d.put(1, 3, Dp, "mud_brick_stairs", facing="e", half="top")
    for x in (-2, 2):
        for y in range(1, 5): d.put(x, y, Dp, "mud_bricks")
    for x in range(-2, 3): d.put(x, 4, Dp, "mud_bricks")
    # a few roof beams left
    for x in (-7, -3, 5):
        for z in range(-Dp, Dp + 1):
            if d.r(x, 5, z) < 0.85: d.put(x, 5, z, "stripped_jungle_log", axis="z")
    # forty desks in five rows of eight: a lectern facing the door, a stair seat behind, a chain to the floor
    k = 0
    for row in range(5):
        z = -6 + row * 3
        for col in range(8):
            x = -8 + col * 2 + (1 if col >= 4 else 0)
            k += 1
            d.put(x, 1, z, "lectern", bs={"minecraft:cardinal_direction": "north"})
            d.put(x, 1, z + 1, "mud_brick_stairs", facing="s")
            if d.r(x, 2, z) < 0.5: d.put(x + (1 if col % 2 == 0 else -1), 1, z, "iron_chain", axis="x")
            if k == 9:   # the ninth desk
                d.put(x, 1, z - 1, "dark_oak_wall_sign", facing="n")
                d.meta["signs"].append([x, 1, z - 1, "THERE WAS A KING.\nHE MADE A PEACE.\nIT HELD."])
    # the Rule, nailed up
    d.put(0, 3, -Dp + 1, "oak_wall_sign", facing="s")
    d.meta["signs"].append([0, 3, -Dp + 1, "RULE OF THE HOUSE\nA brother sent to\nthe Well has not\nsinned. He has read."])
    d.meta["mark"] = [0, 1, 0]
    return d


def dunehold_well():
    """The well the brothers dug, at the middle of their palms."""
    d = D("dunehold_well", "rigid", seed=122, fill="sandstone", top="keep", ease=2)
    for x in range(-2, 3):
        for z in range(-2, 3):
            ring = max(abs(x), abs(z)) == 2
            d.put(x, 0, z, "smooth_sandstone" if ring else "water")
            if ring: d.put(x, 1, z, "sandstone_wall" if (x + z) % 2 else "cut_sandstone")
            for y in range(-4, 0): d.put(x, y, z, "sandstone" if ring else "water")
    for x in (-2, 2):
        d.put(x, 2, 0, "stripped_jungle_log", axis="y"); d.put(x, 3, 0, "stripped_jungle_log", axis="y")
    for x in range(-2, 3): d.put(x, 4, 0, "stripped_jungle_log", axis="x")
    d.put(0, 3, 0, "iron_chain", axis="y")
    return d


def dunehold_palms():
    """Nineteen palms round the well. Count them."""
    d = D("dunehold_palms", "drape", seed=123)
    for k in range(19):
        a = k * 2 * math.pi / 19 + 0.4 * (d.r(k, 0, 0) - 0.5)
        r = 7 + 4 * d.r(k, 1, 0)
        x, z = round(math.sin(a) * r), round(-math.cos(a) * r)
        bx, bz = round(math.sin(a)), round(-math.cos(a))
        palm(d, x, z, tall=6 + int(d.r(k, 2, 0) * 4), bend=(bx, bz), salt=k)
    return d

# ---------------------------------------------------------------- the list


DESIGNS = {f.__name__: f for f in (
    harrowford_field, harrowford_ferry, oakmere_cellar, oakmere_oaks, thistledown_frame, thistledown_pens,
    wrenfield_garden, wrenfield_jetty, frosthelm_road, wolfcairn_cairn, gullcliff_beacon, tidewatch_posts,
    reedmoor_ring, lanternbog_posts, redmesa_stones, dunehold_hall, dunehold_well, dunehold_palms)}

# designs drawn facing north that the game turns to face what they seek
TURNING = {"harrowford_ferry", "wrenfield_jetty", "gullcliff_beacon", "tidewatch_posts", "frosthelm_road"}
