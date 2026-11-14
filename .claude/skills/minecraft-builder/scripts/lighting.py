"""The light stage: every build is lit at night (Mateo 2026-11-13, "we need to go around and light all the builds").

Runs at the end of every build, after `place` and before connections are worked out:

    import lighting
    added, report = lighting.light(blocks)          # {(x, y, z): (block, props)}, Bedrock ids, kit-style props
    lighting.light_blueprint(bp)                     # the same for a map/structures bp.Blueprint (then bp.finish())
    lighting.report(blocks)                          # just measure: dark cells, without adding anything

What it does. It works out the block light (what a lantern gives at night, 15 at the lantern, one less for every
block walked, walls stop it) on every cell a player can stand on in the build, then adds light where a cell is
darker than its target, until none is:

- Inside (a cell with a roof somewhere over it): at least 7. A lantern hung from whatever is overhead, on a chain
  in tall rooms (as the interior stage does), no lower than two rows over the floor, so heads clear it. Where the
  ceiling is too low, a lantern stands on the floor against a wall, never in front of a door.
- Every door: its outside step at least 8, from a lantern beside the door, hung one block out from the wall
  under a fence bracket of the build's own wood ("a lantern lights a door", 07-detailing).
- Outside floors the build lays (courts, yards, decks, landings): at least 4, the street rule (house rules,
  "Towns are lit"). A bracket lantern on the nearest wall, or a lamp post (stone foot, two posts, a lantern) in
  an open yard, never on a one-wide way.
- The Hollow (any build that already burns soul light): soul lanterns and lower targets (5 inside, 3 outside,
  6 at doors). Uneasy, not black, not floodlit.

A spec opts out with "light": false (a deliberately dark crypt); "light": {"inside": 6, "outside": 3, "door": 8}
changes the targets. Pure and deterministic: same blocks in, same lights out.
"""
import re
from collections import Counter

import numpy as np

# Bedrock light levels of the blocks builds use (vanilla) and of the add-on's own glowing blocks.
EMIT = {
    "lantern": 15, "soul_lantern": 10, "torch": 14, "soul_torch": 10, "redstone_torch": 7, "copper_torch": 14,
    "glowstone": 15, "sea_lantern": 15, "shroomlight": 15, "ochre_froglight": 15, "verdant_froglight": 15,
    "pearlescent_froglight": 15, "jack_o_lantern": 15, "lit_pumpkin": 15, "campfire": 15, "soul_campfire": 10,
    "lava": 15, "flowing_lava": 15, "fire": 15, "soul_fire": 10, "end_rod": 14, "beacon": 15, "conduit": 15,
    "lit_redstone_lamp": 15, "magma": 3, "sea_pickle": 6, "glow_lichen": 7, "lit_furnace": 13, "lit_smoker": 13,
    "lit_blast_furnace": 13, "crying_obsidian": 10, "respawn_anchor": 15, "amethyst_cluster": 5, "brewing_stand": 1,
    "enchanting_table": 7, "ender_chest": 7, "light_block": 15, "candle_cake": 3, "copper_lantern": 15,
    "exposed_copper_lantern": 15, "weathered_copper_lantern": 15, "oxidized_copper_lantern": 15,
    "waxed_copper_lantern": 15, "waxed_exposed_copper_lantern": 15, "waxed_weathered_copper_lantern": 15,
    "waxed_oxidized_copper_lantern": 15, "creaking_heart": 0, "firefly_bush": 2,
    # the add-on's own (Siege_Nights_BP/blocks, minecraft:light_emission)
    "siege:rift_seam": 2, "siege:glimmerflow": 13, "siege:plot_stone": 4, "siege:choir_ore": 6, "siege:glimbulb": 7,
    "siege:veilcap": 9, "siege:rift_edge": 10, "siege:rift_veil": 15, "siege:veilmoss_strands": 3, "siege:brazier": 15,
    "siege:hollowwood_core": 12, "siege:old_hollowwood_core": 12, "siege:fallen_shard": 12, "siege:glint_cluster": 12,
    "siege:citadel_cornerstone": 7, "siege:veilcap_cap": 11, "siege:waystone": 11, "siege:tree_of_oaths": 10,
    "hc:looking_glass": 4, "siege:ironworks": 4, "siege:vault_door_choirsteel": 6, "siege:vault_lock_choirsteel": 6,
    "siege:trade_board": 4, "siege:hall_waystone": 6, "siege:map_marker": 15, "hc:station_post": 6,
    "hc:breeder_post": 6, "siege:dragon_roost": 7, "hc:dragon_nest": 4,
}
SOUL = ("soul_lantern", "soul_torch", "soul_campfire", "soul_fire")

# Blocks that fill their cell but let light through.
CLEAR = re.compile(r"(glass|^ice$|packed_ice|blue_ice|frosted_ice|leaves|^barrier$|^glowstone$|^sea_lantern$|"
                   r"^beacon$|^honey_block$|^slime$|^light_block|^structure_void|^spawner$|^mob_spawner$)")
# Blocks that do not fill their cell (a slab, a fence, a lantern ...).
PART = re.compile(r"(_slab$|_stairs$|_fence$|_fence_gate$|_wall$|_pane$|^iron_bars$|_door$|trapdoor$|_sign$|"
                  r"_carpet$|^carpet$|_button$|pressure_plate$|_banner$|candle|lantern$|torch$|chain$|^bell$|"
                  r"^ladder$|^vine$|^rail$|_rail$|^lever$|^bed$|_bed$|^chest$|^trapped_chest$|^ender_chest$|"
                  r"^cauldron$|^water_cauldron$|^lectern$|^brewing_stand$|^anvil$|^grindstone$|^campfire$|"
                  r"^soul_campfire$|^end_rod$|^lightning_rod$|^decorated_pot$|^flower_pot$|^snow_layer$|"
                  r"^enchanting_table$|^stonecutter_block$|^stonecutter$|^daylight_detector|^composter$|"
                  r"^hopper$|^bamboo$|^scaffolding$|^cake$|^conduit$|^sea_pickle$|^skull$|_head$|_skull$|"
                  r"^mangrove_roots$|^hanging_roots$|^pale_hanging_moss$|^leaf_litter$|^glow_lichen$|"
                  r"^amethyst_cluster$|_bud$|^pointed_dripstone$|^item_frame$|^glow_frame$|^tripwire_hook$|"
                  r"^chiseled_bookshelf_never$)")
# A cell a player's feet can be in: nothing to bump into.
FREE = re.compile(r"(^air$|^keep$|^cave_air$|_carpet$|^carpet$|pressure_plate$|^snow_layer$|^rail$|_rail$|"
                  r"^short_grass$|^tall_grass$|^fern$|^large_fern$|^deadbush$|^leaf_litter$|^glow_lichen$|"
                  r"^vine$|^short_dry_grass$|^tall_dry_grass$|^poppy$|^dandelion$|^cornflower$|^oxeye_daisy$|"
                  r"^azure_bluet$|^allium$|_tulip$|^lily_of_the_valley$|^wildflowers$|^pink_petals$|_button$|"
                  r"^tripwire_hook$|^light_block)")
WATERY = re.compile(r"(^water$|^flowing_water$|^lava$|^flowing_lava$|^bubble_column$|^kelp$|^seagrass$)")
# Ground nobody built: an outside floor of it (a field, a lake, a dune, a wild road) is the land's, not the build's, and
# is left to the night. Paving, planks, decks and courts are lit.
NATURAL = re.compile(r"(^grass_block$|^dirt$|^coarse_dirt$|^rooted_dirt$|^podzol$|^mycelium$|^sand$|^red_sand$|^suspicious_|"
                     r"^snow$|^snow_block$|^powder_snow$|^ice$|^packed_ice$|^blue_ice$|^mud$|^clay$|^gravel$|^stone$|"
                     r"^deepslate$|^tuff$|^calcite$|^andesite$|^diorite$|^granite$|^moss_block$|^pale_moss_block$|"
                     r"^netherrack$|^soul_sand$|^soul_soil$|^basalt$|^blackstone$|^terracotta$|_terracotta$|^dripstone_block$|"
                     r"_ore$|^farmland$|^magma$|^obsidian$|^end_stone$|^sandstone$|^red_sandstone$|^siege:pale_ash$|"
                     r"^siege:veinstone$|^siege:ashen_soil$|"
                     # a tree's crown and limbs are the land's too: never a floor to stand a lamp on (Millbrook's
                     # treetops got lamp posts, plot plan thread 2026-11-14)
                     r"leaves$|^siege:old_)")
WOODS = ("pale_oak", "dark_oak", "spruce", "birch", "jungle", "acacia", "mangrove", "cherry", "bamboo", "crimson",
         "warped", "oak")
TARGETS = {"normal": {"inside": 7, "outside": 4, "door": 8}, "hollow": {"inside": 5, "outside": 3, "door": 6}}
DIRS4 = ((1, 0), (-1, 0), (0, 1), (0, -1))
FACE = {"n": (0, -1), "s": (0, 1), "e": (1, 0), "w": (-1, 0)}
MAX_LIGHTS = 400


def bare(n): return n[10:] if n.startswith("minecraft:") else n


def emits(n, p=None):
    n = bare(n)
    if n in EMIT: return EMIT[n]
    if n.endswith("candle") or n == "candle":
        q = p or {}
        if q.get("lit") is False or (q.get("raw") or {}).get("lit") is False: return 0
        k = int((q.get("raw") or {}).get("candles", q.get("candles", 1) - 1 if "candles" in q else 0)) + 1
        return min(12, 3 * k)
    return 0


def opaque(n):
    n = bare(n)
    if FREE.search(n) or WATERY.search(n) or CLEAR.search(n) or PART.search(n): return False
    return True


def free(n): return n is None or bool(FREE.search(bare(n)))


def standable(n):
    if n is None: return False
    n = bare(n)
    if WATERY.search(n) or FREE.search(n): return False
    if opaque(n) or CLEAR.search(n): return True
    return bool(re.search(r"(_slab$|_stairs$|trapdoor$|^scaffolding$|^mangrove_roots$|^bed$|_bed$|^chest$)", n))


class Grid:
    """The build in a numpy box with a margin, so light can be worked out fast."""

    def __init__(self, blocks):
        xs, ys, zs = zip(*blocks)
        self.x0, self.y0, self.z0 = min(xs) - 2, min(ys) - 1, min(zs) - 2
        self.sx, self.sy, self.sz = max(xs) - self.x0 + 3, max(ys) - self.y0 + 5, max(zs) - self.z0 + 3
        self.bx = (min(xs), max(xs), min(zs), max(zs))
        sh = (self.sx, self.sy, self.sz)
        self.op = np.zeros(sh, bool)
        self.em = np.zeros(sh, np.int8)
        for (x, y, z), (n, p) in blocks.items():
            i = (x - self.x0, y - self.y0, z - self.z0)
            if opaque(n): self.op[i] = True
            e = emits(n, p)
            if e: self.em[i] = e

    def idx(self, x, y, z): return x - self.x0, y - self.y0, z - self.z0

    def light(self):
        L = self.em.copy()
        tr = ~self.op
        for _ in range(15):
            m = np.zeros_like(L)
            m[1:] = np.maximum(m[1:], L[:-1]); m[:-1] = np.maximum(m[:-1], L[1:])
            m[:, 1:] = np.maximum(m[:, 1:], L[:, :-1]); m[:, :-1] = np.maximum(m[:, :-1], L[:, 1:])
            m[:, :, 1:] = np.maximum(m[:, :, 1:], L[:, :, :-1]); m[:, :, :-1] = np.maximum(m[:, :, :-1], L[:, :, 1:])
            nl = np.where(tr, np.maximum(L, m - 1), self.em).astype(np.int8)
            if np.array_equal(nl, L): break
            L = nl
        self.L = L
        return L

    def at(self, x, y, z):
        i, j, k = self.idx(x, y, z)
        if 0 <= i < self.sx and 0 <= j < self.sy and 0 <= k < self.sz: return int(self.L[i, j, k])
        return 0

    def put(self, x, y, z, n, p=None):
        """Set a cell. A new light spreads at once (a flood out from it), so a big town needs no full pass per lantern.
        Builds only ever add lights and see-through blocks here, so light never has to go down."""
        i = self.idx(x, y, z)
        self.op[i] = opaque(n)
        e = emits(n, p)
        self.em[i] = e
        if e and hasattr(self, "L") and self.L[i] < e:
            self.L[i] = e
            todo = [i]
            while todo:
                nxt = []
                for a, b, c in todo:
                    v = int(self.L[a, b, c]) - 1
                    if v <= 0: continue
                    for da, db, dc in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)):
                        q = (a + da, b + db, c + dc)
                        if not (0 <= q[0] < self.sx and 0 <= q[1] < self.sy and 0 <= q[2] < self.sz): continue
                        if self.op[q] or self.L[q] >= v: continue
                        self.L[q] = v; nxt.append(q)
                todo = nxt


def _name(blocks, c):
    v = blocks.get(c)
    return None if v is None else bare(v[0])


def walk_cells(blocks):
    """Cells a player stands in: free feet and head, a floor the build lays under the feet.
    Returns {(x, y, z): covered} (covered = a block that stops light somewhere over it)."""
    out = {}
    tops = {}
    for (x, y, z), (n, _p) in blocks.items():
        if opaque(n) or PART.search(bare(n)): tops[(x, z)] = max(tops.get((x, z), -10 ** 9), y)
    roofs = {}
    for (x, y, z), (n, _p) in blocks.items():
        if opaque(n) or re.search(r"(_slab$|_stairs$)", bare(n)): roofs.setdefault((x, z), []).append(y)
    for k in roofs: roofs[k].sort()
    for (x, y, z), (n, _p) in blocks.items():
        if not standable(n): continue
        f, h = (x, y + 1, z), (x, y + 2, z)
        if not free(_name(blocks, f)) or not free(_name(blocks, h)): continue
        if _name(blocks, f) is None and _name(blocks, h) is None and (x, z) not in roofs: pass
        cov = any(r > y + 2 for r in roofs.get((x, z), ()))
        out[f] = cov
    # outside, only level ground a player uses (a court, a yard, a deck, a wall walk): a cell with at least four
    # standing neighbours at its own height. A roof slope (stairs) or a one-wide ridge is not a floor to light.
    for c, cov in list(out.items()):
        if cov: continue
        fl = _name(blocks, (c[0], c[1] - 1, c[2])) or ""
        n = sum(1 for dx in (-1, 0, 1) for dz in (-1, 0, 1) if (dx or dz) and (c[0] + dx, c[1], c[2] + dz) in out)
        if fl.endswith("_stairs") or n < 4: del out[c]
    # natural ground under the open sky is the land's (NATURAL); it still connects the build's ways (reachable)
    return out


def lit_cells(blocks, wc, laid=()):
    """The walk cells that must reach their light: everything covered, and outside only built floors.
    laid = feet cells over a floor the build laid of a stone the land is also made of (a sandstone walk, a gravel lane)."""
    return {c: cov for c, cov in wc.items() if cov or c in laid or not NATURAL.search(_name(blocks, (c[0], c[1] - 1, c[2])) or "")}


def reachable(blocks, wc):
    """The walk cells a player can get to: from every door's steps and every open-sky floor, walking (a step up of
    one block, a drop of up to three) or climbing a ladder. A sealed roof void or a wall cavity is not lit."""
    seeds = [c for c, cov in wc.items() if not cov]
    for x, y, z, f in doors(blocks):
        dx, dz = FACE.get(f, (0, 1))
        seeds += [c for c in ((x + dx, y, z + dz), (x - dx, y, z - dz), (x, y, z)) if c in wc]
    seen = set(seeds); todo = list(seeds)
    while todo:
        x, y, z = todo.pop()
        nxt = [(x + dx, y + dy, z + dz) for dx, dz in DIRS4 for dy in (1, 0, -1, -2, -3)]
        for dy in range(1, 24):                        # ladders and vines up and down
            if _name(blocks, (x, y + dy - 1, z)) in ("ladder", "vine", "scaffolding"): nxt.append((x, y + dy, z))
            else: break
        for dy in range(1, 24):
            if _name(blocks, (x, y - dy, z)) in ("ladder", "vine", "scaffolding") or _name(blocks, (x, y - dy + 1, z)) == "ladder":
                nxt.append((x, y - dy, z))
            else: break
        for c in nxt:
            if c in wc and c not in seen: seen.add(c); todo.append(c)
    return {c: wc[c] for c in seen}


def doors(blocks):
    """Lower halves of doors: [(x, y, z, facing)]."""
    out = []
    for (x, y, z), (n, p) in blocks.items():
        b = bare(n)
        if not (b.endswith("_door") or b == "door") or "trapdoor" in b: continue
        if p.get("upper") or (p.get("raw") or {}).get("upper_block_bit"): continue
        up = blocks.get((x, y + 1, z))
        if up is not None and bare(up[0]) == b and not up[1].get("upper", True) is False: pass
        out.append((x, y, z, p.get("facing", "s")))
    return out


def style(blocks, kind=None):
    """The light, bracket and lamp post blocks for this build: its own wood, soul light in the Hollow."""
    names = Counter(bare(n) for n, _p in blocks.values())
    hollow = sum(c for n, c in names.items() if n in SOUL) > sum(c for n, c in names.items() if n in ("lantern", "torch"))
    if kind: hollow = kind == "hollow"
    wood = Counter()
    for n, c in names.items():
        if not re.search(r"(_planks$|_log$|_wood$|_fence$|_stairs$|_slab$|_trapdoor$)", n): continue
        for w in WOODS:
            if n.startswith(w + "_") or n.startswith("stripped_" + w + "_"):
                wood[w] += c; break
    w = wood.most_common(1)[0][0] if wood else ("dark_oak" if not hollow else "dark_oak")
    fence = "fence" if w == "oak" else f"{w}_fence"
    if w == "oak": fence = "oak_fence"
    stone = Counter()
    for n, c in names.items():
        if n.endswith("_wall") and "sign" not in n and "banner" not in n: stone[n] += c
    foot = stone.most_common(1)[0][0] if stone else ("polished_blackstone_brick_wall" if hollow else "stone_brick_wall")
    return {"lantern": "soul_lantern" if hollow else "lantern", "fence": fence, "foot": foot,
            "kind": "hollow" if hollow else "normal"}


def report(blocks, targets=None, kind=None):
    """Measure only: {'walk': n, 'dark_inside': n, 'dark_outside': n, 'dark_doors': n}."""
    blocks = {k: (bare(v[0]), v[1]) for k, v in blocks.items()}
    if not blocks: return {"walk": 0, "dark_inside": 0, "dark_outside": 0, "dark_doors": 0}
    st = style(blocks, kind)
    T = dict(TARGETS[st["kind"]]); T.update(targets or {})
    g = Grid(blocks); g.light()
    wc = lit_cells(blocks, reachable(blocks, walk_cells(blocks)))
    di = sum(1 for c, cov in wc.items() if cov and g.at(*c) < T["inside"])
    do = sum(1 for c, cov in wc.items() if not cov and g.at(*c) < T["outside"])
    dd = 0
    for x, y, z, f in doors(blocks):
        o = _outside(blocks, x, y, z, f, wc)
        if o and g.at(o[0], y, o[1]) < T["door"]: dd += 1
    return {"walk": len(wc), "dark_inside": di, "dark_outside": do, "dark_doors": dd}


def _outside(blocks, x, y, z, f, wc):
    """The (x, z) of a door's outside step: the side with open sky over it (else the side not in wc as covered)."""
    dx, dz = FACE.get(f, (0, 1))
    best = None
    for s in (1, -1):
        c = (x + s * dx, y, z + s * dz)
        if not free(_name(blocks, c)): continue
        cov = wc.get(c)
        if cov is False or (cov is None and best is None): best = (c[0], c[2]) if cov is False else best or (c[0], c[2])
        if cov is False: return best
    return best


def light(blocks, targets=None, log=None, stage_of=None, kind=None, avoid=(), posts=True, laid=()):
    """Add the lights this build lacks, in place. Returns (cells added, report after).
    kind "hollow" forces soul light and the Hollow's targets; avoid = cells that must stay empty (NPC spots, marks);
    posts=False keeps every floor clear (a boss fight floor): only lanterns hung overhead or from walls."""
    if not blocks: return [], {}
    for k, v in list(blocks.items()):
        if v[0].startswith("minecraft:"): blocks[k] = (bare(v[0]), v[1])
    st = style(blocks, kind)
    T = dict(TARGETS[st["kind"]]); T.update(targets or {})
    g = Grid(blocks); g.light()
    wc = reachable(blocks, walk_cells(blocks))
    need = lit_cells(blocks, wc, laid)
    added = []
    reserved = set()                      # door steps, the cells right in front of doors and marked spots stay clear
    for (x, y, z) in avoid:
        for yy in (y, y + 1): reserved.add((x, yy, z))
    door_list = doors(blocks)
    for x, y, z, f in door_list:
        dx, dz = FACE.get(f, (0, 1))
        for s in (1, -1):
            for yy in (y, y + 1):
                reserved.add((x + s * dx, yy, z + s * dz))

    def setb(c, n, p=None):
        blocks[c] = (n, dict(p or {}))
        if stage_of is not None: stage_of[c] = "light"
        g.put(*c, n, p); added.append(c)

    low = 2 if posts else 4                   # rows kept clear over a floor: heads, or a whole fight (posts=False)

    def empty(c): return c not in reserved and _name(blocks, c) in (None, "air", "keep", "cave_air")

    def hang(x, y, z):
        """A lantern from whatever is overhead of feet cell (x, y, z): straight under it in a low room, on a chain
        (a chandelier) in a tall one, three or four rows over the floor, never lower than two rows over the floor."""
        top = None
        for yy in range(y + 2, y + 26):
            if not empty((x, yy, z)): top = yy; break
        if top is None or top - 1 < y + low: return False
        tb = _name(blocks, (x, top, z))
        if not (opaque(tb) or re.search(r"(_slab$|_stairs$|_fence$|_wall$|chain$|trapdoor$)", tb or "")): return False
        lant = min(top - 1, y + max(low, 3 if top - y <= 7 else 4))   # close enough to light the floor under it
        if not empty((x, lant, z)) or (x, lant, z) in reserved: return False
        for yy in range(top - 1, lant, -1): setb((x, yy, z), "iron_chain", {"axis": "y"})
        setb((x, lant, z), st["lantern"], {"hanging": True})
        return True

    def bracket(x, y, z):
        """A lantern hung one block out from a wall beside feet cell (x, y, z), under a fence bracket."""
        a, b = y + low, y + low + 1                   # the lantern's row and its bracket's
        if not (empty((x, a, z)) and empty((x, b, z))): return False
        for dx, dz in DIRS4:
            w = (x + dx, b, z + dz)
            if opaque(_name(blocks, w) or "air") and _name(blocks, w) is not None and opaque(_name(blocks, (x + dx, a, z + dz)) or "air"):
                setb((x, b, z), st["fence"])
                setb((x, a, z), st["lantern"], {"hanging": True})
                return True
        return False

    def by_rail(x, y, z):
        """Nothing stands on a track or right beside it (stations, mine carts)."""
        return any(re.search(r"rail$", _name(blocks, (x + dx, yy, z + dz)) or "")
                   for dx in (-1, 0, 1) for dz in (-1, 0, 1) for yy in (y - 1, y))

    def stand(x, y, z):
        """A lantern on the floor against a wall (a low room), never on a door step or by a track."""
        if not posts or (x, y, z) in reserved or not empty((x, y, z)) or by_rail(x, y, z): return False
        if not any(opaque(_name(blocks, (x + dx, y, z + dz)) or "air") and _name(blocks, (x + dx, y, z + dz)) is not None
                   for dx, dz in DIRS4): return False
        setb((x, y, z), st["lantern"])
        return True

    def post(x, y, z, grass=False):
        """A lamp post: foot, two posts, a lantern. In an open yard, or on the verge of a way at least 3 wide;
        grass=True: on the land beside a narrow built way (the way itself stays clear)."""
        if not posts or any(c in reserved for c in ((x, y, z), (x, y + 1, z))) or by_rail(x, y, z): return False
        if not all(empty((x, yy, z)) for yy in range(y, y + 4)): return False
        if grass:
            if (x, y, z) not in wc or (x, y, z) in need: return False
        else:
            open_n = sum(1 for dx in (-1, 0, 1) for dz in (-1, 0, 1) if (x + dx, y, z + dz) in wc)
            verge = any((x - dx, y, z - dz) not in wc and (x + dx, y, z + dz) in wc and (x + 2 * dx, y, z + 2 * dz) in wc
                        for dx, dz in DIRS4)          # on the verge of a way at least three wide: two stay clear
            if open_n < 9 and not verge: return False
        fl = blocks.get((x, y - 1, z))
        if fl and bare(fl[0]).endswith("_slab") and (fl[1] or {}).get("half", "bottom") != "top":
            # nothing stands on a sunk slab (house rules): the foot takes the slab's place
            setb((x, y - 1, z), st["foot"]); setb((x, y, z), st["fence"]); setb((x, y + 1, z), st["fence"])
            setb((x, y + 2, z), st["lantern"])
        else:
            setb((x, y, z), st["foot"]); setb((x, y + 1, z), st["fence"]); setb((x, y + 2, z), st["fence"])
            setb((x, y + 3, z), st["lantern"])
        wc.pop((x, y, z), None)
        return True

    def tall(x, y, z):
        """A room over 8 high: lanterns on the walls first, chandeliers only between them."""
        return all(empty((x, yy, z)) for yy in range(y + 2, y + 9))

    # 1. a lantern beside every door
    for x, y, z, f in door_list:
        o = _outside(blocks, x, y, z, f, wc)
        if not o or g.at(o[0], y, o[1]) >= T["door"]: continue
        dx, dz = FACE.get(f, (0, 1))
        sx, sz = o[0] - x, o[1] - z                   # outward
        lx, lz = (abs(dz), abs(dx))                    # along the wall
        done = False
        for side in (1, -1):
            for k in (1, 2, 3):
                cx, cz = x + side * lx * k, z + side * lz * k
                nb = _name(blocks, (cx, y, cz))
                if nb and (nb.endswith("_door") and "trapdoor" not in nb): continue
                fx, fz = cx + sx, cz + sz             # in front of the wall, beside the door
                if not (empty((fx, y + 2, fz)) and empty((fx, y + 3, fz))): break
                w = (cx, y + 3, cz)
                if opaque(_name(blocks, w) or "air") and _name(blocks, w) is not None:
                    setb((fx, y + 3, fz), st["fence"]); setb((fx, y + 2, fz), st["lantern"], {"hanging": True})
                    done = True
                break
            if done: break
        if not done:
            # no wall beside it (an arch, a gate): hang from the lintel over the outside step
            hang(o[0], y, o[1])
    g.light()

    # 2. inside and outside floors, darkest first, the light where it reaches the most dark cells
    failed = set()
    for _ in range(MAX_LIGHTS):
        dark = [c for c, cov in need.items() if c in wc and c not in failed and g.at(*c) < (T["inside"] if cov else T["outside"])]
        if not dark: break
        dark.sort(key=lambda c: (g.at(*c), c))
        p = dark[0]
        near = [c for c in dark if abs(c[1] - p[1]) <= 1 and abs(c[0] - p[0]) + abs(c[2] - p[2]) <= 6]
        dk = set(dark)
        def score(c):
            return -sum(1 for dx in range(-5, 6) for dz in range(-5, 6) if abs(dx) + abs(dz) <= 6 and (c[0] + dx, c[1], c[2] + dz) in dk), c
        near.sort(key=score)
        ok = False
        for c in near[:30]:
            cov = wc.get(c)
            tries = ((bracket, hang, stand) if tall(*c) else (hang, bracket, stand)) if cov else (bracket, hang, post)
            for t in tries:
                if t(*c): ok = True; break
            if ok: break
        if not ok and not wc.get(p):
            # a narrow built way through the land (a sand walk round a granary): a post on the land beside it
            for c in near[:10]:
                for dx, dz in sorted(((a, b) for a in range(-2, 3) for b in range(-2, 3) if 0 < abs(a) + abs(b) <= 2),
                                     key=lambda v: (abs(v[0]) + abs(v[1]), v)):
                    if post(c[0] + dx, c[1], c[2] + dz, grass=True): ok = True; break
                if ok: break
        if not ok: failed.add(p)
    if failed and log is not None:
        log.append(f"light: {len(failed)} dark cell(s) found no spot for a lantern, first at {sorted(failed)[0]}")
    return added, report(blocks, targets, kind)


def light_blueprint(bp, targets=None, log=None, kind=None, avoid=()):
    """light() on a map/structures bp.Blueprint (kit props), then its connections again. Every marker of the
    blueprint (doors, NPC spots, signs, marks) stays clear. bp.light = False opts a build out. Returns cells added."""
    if getattr(bp, "light", True) is False: return []
    cells = {k: v for k, v in bp.cells.items() if v[0] != "keep"}
    if not cells: return []
    spots = set(avoid) | {tuple(v[:3]) for v in bp.markers.values()} | {tuple(v[:3]) for v in getattr(bp, "marks", {}).values()}
    added, _r = light(cells, targets=targets, log=log, kind=kind, avoid=spots)
    for c in added: bp.cells[c] = cells[c]
    bp.finish()
    return added
