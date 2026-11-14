#!/usr/bin/env python3
"""Audit a town (or a laid-out Hamlet) block for block against the playtest build rules.

    python3 tools/town_audit.py SITE.npz [SITE.npz ...] --out FINDINGS.json

SITE.npz comes from tools/town_audit_dump.py (an NPC town or a map plot cut out of the baked world) or from
tools/sim-hamlet.mjs (the Hamlet as the game lays it on that plot). Checks, each finding with a spot to look at:

  floating     a group of blocks touching nothing that reaches the ground (junk in the air, a lantern or sign
               left behind, leaves of a felled tree)
  hung         a lantern hung from nothing, a chain that ends in the air at the top, a standing lantern, sign,
               plant or rail on nothing, a wall sign / ladder / frame / button / torch with no wall behind
  facing       a wall sign or item frame whose face is against a solid block (put on backwards), a door whose
               two sides are not both open
  door         a door with nothing to stand on outside, a door you can't walk to from the square, a door step that
               is grass or sand instead of a path, a building in the town plan with no door where the plan put it
  interior     a door that opens on a room with no furnishing at all, or on no room (open to the sky)
  light        street cells (built paths under the sky) darker than 4 at night, rooms darker than 7
  ground       a natural cliff 3+ blocks high in the town (pads not blended), a path or square block over air
  junk         tree logs or leaves standing on a path, or leaves over a roof

Rules: build-instructions/09-final-check, .claude/skills/minecraft-builder/reference/house-rules.md.
Needs numpy and scipy (pip install scipy).
"""
import os, sys, re, json, argparse
from collections import Counter, defaultdict
import numpy as np
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", ".claude", "skills", "minecraft-builder", "scripts"))
import lighting as LG  # noqa: E402

ROOT = os.path.join(HERE, "..")
bare = LG.bare

AIRY = re.compile(r"^(air|cave_air|structure_void|light_block.*)$")
FLUID = re.compile(r"^(water|flowing_water|lava|flowing_lava|bubble_column)$")
# stands on the block below it
STANDS = re.compile(r"(^short_grass$|^tall_grass$|^fern$|^large_fern$|^deadbush$|^poppy$|^dandelion$|^cornflower$|"
                    r"^oxeye_daisy$|^azure_bluet$|^allium$|_tulip$|^lily_of_the_valley$|^blue_orchid$|^wildflowers$|"
                    r"^pink_petals$|^leaf_litter$|^sweet_berry_bush$|^wheat$|^carrots$|^potatoes$|^beetroot$|_sapling$|"
                    r"^sapling$|^sugar_cane$|^reeds$|^cactus$|^bamboo$|^snow_layer$|_carpet$|^carpet$|pressure_plate$|"
                    r"^rail$|_rail$|^redstone_wire$|^flower_pot$|^decorated_pot$|^brown_mushroom$|^red_mushroom$|"
                    r"^torchflower$|^pitcher_plant$|^bush$|^firefly_bush$|^short_dry_grass$|^tall_dry_grass$|"
                    r"^standing_sign$|_standing_sign$|^standing_banner$|^candle$|_candle$|^double_plant$|^tallgrass$|"
                    r"^red_flower$|^yellow_flower$|^cake$|^frame_never$)")
ON_WATER = re.compile(r"^(waterlily|lily_pad)$")
WALL_HUNG = re.compile(r"(^frame$|^glow_frame$|^ladder$|_button$|^wall_sign$|_wall_sign$|^wall_banner$|^tripwire_hook$|^cocoa$)")
HANG_FROM_ABOVE = re.compile(r"(^hanging_roots$|^spore_blossom$|^weeping_vines$|^cave_vines|^pale_hanging_moss$)")
LANTERN = re.compile(r"(^lantern$|^soul_lantern$|copper_lantern$)")
# can't hold anything on its side / from below
SOFT = re.compile(r"(^air$|vine|ladder|lantern|button|sign|frame|torch|carpet|_pane$|^glass_pane$|^iron_bars$|fence|chain|"
                  r"trapdoor|door|_slab$|stairs|_wall$|structure_void|flower|grass$|fern|bush|sapling|candle|banner|rail|"
                  r"snow_layer|^water$|^lava$|flowing_|leaves)")
DOOR = re.compile(r"(_door$|^iron_door$|^wooden_door$)")
NATURAL_GROUND = re.compile(r"^(grass_block|dirt|coarse_dirt|podzol|mycelium|sand|red_sand|snow|snow_block|mud|clay|"
                            r"gravel|stone|andesite|diorite|granite|tuff|calcite|moss_block|rooted_dirt|sandstone|"
                            r"red_sandstone|terracotta|.*_terracotta|deepslate|packed_ice|ice|dripstone_block)$")
SOFT_GROUND = re.compile(r"^(grass_block|dirt|coarse_dirt|podzol|mycelium|sand|red_sand|snow|snow_block|mud|moss_block|rooted_dirt)$")
# what a laid path, square or step is made of
PATHY = re.compile(r"(^grass_path$|^dirt_path$|_slab$|_stairs$|^gravel$|^cobblestone$|^mossy_cobblestone$|stone_bricks$|"
                   r"^stone_brick|_bricks$|^bricks$|^polished_|^smooth_|^cut_|_planks$|^packed_mud$|^mud_bricks$|^tuff|"
                   r"^andesite$|^coarse_dirt$|^chiseled_|_tiles$|^deepslate_|^cobbled_deepslate$|^blackstone$|"
                   r"^siege:castle_|^siege:.*cobble|^packed_ice$|^sandstone$|^red_sandstone$|^calcite$|^prismarine)")
FURNISH = re.compile(r"(bed$|^chest$|^barrel$|^crafting_table$|furnace$|^smoker$|^lectern$|bookshelf$|_table$|^loom$|"
                     r"^stonecutter|^grindstone$|^anvil$|^brewing_stand$|cauldron$|^composter$|^jukebox$|^flower_pot$|"
                     r"^decorated_pot$|^campfire$|^bell$|^noteblock$|^armor_stand$|_carpet$|^carpet$|^hay_block$|"
                     r"^ender_chest$|^trapped_chest$|^beehive$|^bee_nest$|^scaffolding$|^siege:|^hc:|_sign$|^frame$|"
                     r"^glow_frame$|^chiseled_bookshelf$|^candle|_candle$|^skull$|banner$)")
LOG = re.compile(r"(_log$|^log$|^log2$|_wood$|_stem$|^mangrove_roots$)")
LEAVES = re.compile(r"(leaves|^leaves2$)")
EMIT = {k: v for k, v in LG.EMIT.items()}
DIR4 = ((1, 0), (-1, 0), (0, 1), (0, -1))
# Bedrock facing_direction: 2 north, 3 south, 4 west, 5 east (the way the face looks)
FACING_VEC = {2: (0, -1), 3: (0, 1), 4: (-1, 0), 5: (1, 0)}
CARD_VEC = {"north": (0, -1), "south": (0, 1), "west": (-1, 0), "east": (1, 0)}
TORCH_BEHIND = {"west": (1, 0), "east": (-1, 0), "north": (0, 1), "south": (0, -1)}
DOOR_DIR = {0: (1, 0), 1: (0, 1), 2: (-1, 0), 3: (0, -1)}   # Bedrock door "direction" -> the way it faces (x, z)


def load_site(path):
    """A site from town_audit_dump.py (.npz) or sim-hamlet.mjs (.json: meta, pal, xyz and pid as base64 int32)."""
    if path.endswith(".json"):
        import base64
        d = json.load(open(path))
        xyz = np.frombuffer(base64.b64decode(d["xyz"]), "<i4").reshape(-1, 3)
        pid = np.frombuffer(base64.b64decode(d["pid"]), "<i4")
        return d["meta"], d["pal"], xyz, pid
    d = np.load(path, allow_pickle=False)
    meta = json.loads(str(d["meta"]))
    pal = json.loads(str(d["pal"]))
    return meta, pal, d["xyz"], d["pid"]


class Site:
    def __init__(self, path):
        self.meta, pal, xyz, pid = load_site(path)
        self.pal = [(bare(n), st or {}) for n, st in pal]
        if len(xyz) == 0: raise ValueError("empty site")
        self.o = xyz.min(0) - 1
        hi = xyz.max(0) + 3
        self.shape = tuple(int(v) for v in hi - self.o)
        self.g = np.full(self.shape, -1, np.int32)      # -1 = air
        rel = xyz - self.o
        self.g[rel[:, 0], rel[:, 1], rel[:, 2]] = pid
        names = [n for n, _ in self.pal]
        P = len(names)

        def cls(rx):
            return np.array([bool(rx.search(n)) for n in names] + [False], bool)   # last = air (-1)
        self.is_air = np.array([bool(AIRY.match(n)) for n in names] + [True], bool)
        self.is_fluid = cls(FLUID)
        self.is_opaque = np.array([LG.opaque(n) and not AIRY.match(n) for n in names] + [False], bool)
        self.is_free = np.array([LG.free(n) or bool(AIRY.match(n)) for n in names] + [True], bool)
        self.is_stand = np.array([LG.standable(n) for n in names] + [False], bool)
        self.is_pathy = cls(PATHY)
        self.is_natural = cls(NATURAL_GROUND)
        self.is_soft_ground = cls(SOFT_GROUND)
        self.is_leaves = cls(LEAVES)
        self.is_log = cls(LOG)
        self.emit = np.array([EMIT.get(n, EMIT.get("siege:" + n, 0)) for n in names] + [0], np.int8)
        self.P = P

    # palette index arrays use -1 for air: index the class arrays with g (−1 hits the last entry)
    def C(self, arr): return arr[self.g]

    def name(self, x, y, z):
        i, j, k = x - self.o[0], y - self.o[1], z - self.o[2]
        if not (0 <= i < self.shape[0] and 0 <= j < self.shape[1] and 0 <= k < self.shape[2]): return "air", {}
        p = self.g[i, j, k]
        return ("air", {}) if p < 0 else self.pal[p]

    def w(self, i, j, k): return int(i + self.o[0]), int(j + self.o[1]), int(k + self.o[2])


def finding(kind, what, at, n=1, sev="fix", **kw):
    return {"kind": kind, "what": what, "at": [int(v) for v in at], "n": n, "sev": sev, **kw}


def cluster(points, gap=4):
    """Group nearby points: [(centre, count, points)]."""
    out, left = [], list(points)
    while left:
        seed = left.pop(); grp = [seed]; i = 0
        while i < len(grp):
            p = grp[i]; i += 1
            keep = []
            for q in left:
                if abs(q[0] - p[0]) <= gap and abs(q[1] - p[1]) <= gap and abs(q[2] - p[2]) <= gap: grp.append(q)
                else: keep.append(q)
            left = keep
        c = tuple(int(round(np.mean([p[a] for p in grp]))) for a in range(3))
        out.append((c, len(grp), grp))
    return sorted(out, key=lambda t: -t[1])


def audit(path, plan=None, centre_hint=None, radius=None):
    S = Site(path)
    meta = S.meta
    F = []
    g = S.g
    air = S.C(S.is_air)
    fluid = S.C(S.is_fluid)
    solidish = ~air & ~fluid
    # lily pads float on water by nature
    lily = S.C(np.array([bool(ON_WATER.search(n)) for n, _ in S.pal] + [False]))
    solidish[:, 1:, :] &= ~(lily[:, 1:, :] & fluid[:, :-1, :])
    cx, cz = meta.get("x", 0), meta.get("z", 0)
    R = radius or meta.get("r", 80)
    ii, kk = np.meshgrid(np.arange(S.shape[0]) + S.o[0], np.arange(S.shape[2]) + S.o[2], indexing="ij")
    inside2d = (ii - cx) ** 2 + (kk - cz) ** 2 <= R * R

    # ---- floating: connected groups that never reach the bottom rows or the box's sides
    lab, nlab = ndimage.label(solidish, structure=np.ones((3, 3, 3), bool))   # diagonal touch counts (a stepped roof)
    anchored = set(np.unique(lab[:, :3, :]).tolist())
    # the grid pads one row below the data and three above it, so the cut edges are a few rows in
    for face in (lab[:3], lab[-5:], lab[:, :, :3], lab[:, :, -5:]): anchored |= set(np.unique(face).tolist())
    anchored.discard(0)
    objs = ndimage.find_objects(lab)
    for li, sl in enumerate(objs, 1):
        if li in anchored or sl is None: continue
        sub = (lab[sl] == li)
        idx = np.argwhere(sub)
        cnt = Counter(S.pal[g[sl][tuple(p)]][0] for p in idx[:400])
        top = ", ".join(f"{v} {k}" for k, v in cnt.most_common(3))
        c = idx.mean(0).astype(int) + np.array([s.start for s in sl])
        wx, wy, wz = S.w(*c)
        if not inside2d[c[0], c[2]] and len(idx) < 3: continue
        allleaf = all(LEAVES.search(k) or LOG.search(k) or k in ("vine",) for k in cnt)
        F.append(finding("floating", f"{len(idx)} block{'s' if len(idx) > 1 else ''} floating in the air ({top})" + (" — a tree left hanging" if allleaf else ""),
                         (wx, wy, wz), len(idx), "fix" if len(idx) < 400 else "check",
                         gap=int(_gap_below(S, solidish, sl, sub))))

    # ---- per-block hangers and standers
    def nm(i, j, k):
        if not (0 <= i < S.shape[0] and 0 <= j < S.shape[1] and 0 <= k < S.shape[2]): return "air"
        p = g[i, j, k]
        return "air" if p < 0 else S.pal[p][0]
    hung = defaultdict(list)
    facing = defaultdict(list)
    for p, (n, st) in enumerate(S.pal):
        kinds = []
        if LANTERN.search(n): kinds.append("lantern")
        elif n == "chain" or n.endswith("_chain"): kinds.append("chain")
        elif WALL_HUNG.search(n): kinds.append("wall")
        elif n in ("torch", "soul_torch", "redstone_torch", "copper_torch") or n.endswith("_torch"): kinds.append("torch")
        elif STANDS.search(n): kinds.append("stand")
        elif ON_WATER.search(n): kinds.append("water")
        elif HANG_FROM_ABOVE.search(n): kinds.append("above")
        elif n.endswith("hanging_sign"): kinds.append("hsign")
        elif n == "bell": kinds.append("bell")
        if not kinds: continue
        cells = np.argwhere(g == p)
        if len(cells) == 0: continue
        for (i, j, k) in cells:
            if not inside2d[i, k] or j <= 4: continue          # the cut's bottom rows: what holds them may be below it
            kind = kinds[0]
            bad = None
            if kind == "lantern":
                if st.get("hanging"):
                    jj = j + 1
                    while nm(i, jj, k) in ("chain",) or nm(i, jj, k).endswith("_chain"): jj += 1
                    a = nm(i, jj, k)
                    if AIRY.match(a) or FLUID.match(a) or STANDS.search(a) or LEAVES.search(a): bad = f"hanging {n} with nothing above it" + (f" (its chain ends in the air)" if jj > j + 1 else "")
                else:
                    b = nm(i, j - 1, k)
                    if AIRY.match(b) or FLUID.match(b) or STANDS.search(b): bad = f"standing {n} on nothing"
            elif kind == "chain":
                if st.get("pillar_axis", "y") != "y": continue
                if nm(i, j + 1, k) == n: continue        # only the top of each run
                a = nm(i, j + 1, k)
                if AIRY.match(a) or FLUID.match(a):
                    jj = j
                    while nm(i, jj - 1, k) == n: jj -= 1
                    below = nm(i, jj - 1, k)
                    if AIRY.match(below) or FLUID.match(below): bad = f"chain ({j - jj + 1} long) hanging in the air, fixed to nothing"
                    elif LANTERN.search(below): bad = f"chain ({j - jj + 1} long) with a lantern, fixed to nothing at the top"
            elif kind == "wall":
                v = FACING_VEC.get(st.get("facing_direction"))
                if v is None:
                    if n == "ladder" or n.endswith("wall_sign"): bad = f"{n} with no facing"
                else:
                    behind = nm(i - v[0], j, k - v[1]); front = nm(i + v[0], j, k + v[1])
                    ok = not SOFT.search(behind) or (n.endswith("wall_sign") and LEAVES.search(behind))
                    if not ok:
                        if not SOFT.search(front) and (n.endswith("sign") or "frame" in n):
                            facing[f"{n} put on backwards: its face is against {front}"].append((i, j, k))
                        else: bad = f"{n} on nothing (behind it: {behind})"
                    elif (n.endswith("sign") or "frame" in n) and LG.opaque(front) and not AIRY.match(front):
                        facing[f"{n} faces straight into {front}"].append((i, j, k))
            elif kind == "torch":
                tf = st.get("torch_facing_direction", "top")
                if tf in ("top", "unknown"):
                    b = nm(i, j - 1, k)
                    if AIRY.match(b) or FLUID.match(b) or STANDS.search(b): bad = f"{n} standing on nothing"
                else:
                    v = TORCH_BEHIND.get(tf)
                    if v and SOFT.search(nm(i + v[0], j, k + v[1])): bad = f"{n} on a wall that isn't there"
            elif kind == "stand":
                b = nm(i, j - 1, k)
                if (AIRY.match(b) or FLUID.match(b) or (STANDS.search(b) and not (n == b and n in ("sugar_cane", "reeds", "cactus", "bamboo")))
                        and not (n in ("tall_grass", "large_fern", "double_plant") and b == n)) and not (b == n and st.get("upper_block_bit")):
                    if not (n in ("tall_grass", "large_fern", "double_plant") or b in ("tall_grass", "large_fern", "double_plant")):
                        bad = f"{n} standing on {b}"
                if n.endswith("standing_sign"):
                    d = int(st.get("ground_sign_direction", 0)) % 16
                    ang = d * 22.5
                    vx, vz = round(-np.sin(np.radians(ang))), round(np.cos(np.radians(ang)))
                    fr = nm(i + vx, j, k + vz)
                    if LG.opaque(fr) and not AIRY.match(fr): facing[f"{n} faces straight into {fr}"].append((i, j, k))
            elif kind == "water":
                if not FLUID.match(nm(i, j - 1, k)): bad = f"{n} not on water"
            elif kind == "above":
                if AIRY.match(nm(i, j + 1, k)) and nm(i, j + 1, k) != n: bad = f"{n} hanging from nothing"
            elif kind == "hsign":
                if st.get("hanging") and AIRY.match(nm(i, j + 1, k)): bad = f"{n} hanging from nothing"
            elif kind == "bell":
                att = st.get("attachment", "standing")
                if att == "standing" and SOFT.search(nm(i, j - 1, k)): bad = "bell standing on nothing"
                if att == "hanging" and AIRY.match(nm(i, j + 1, k)): bad = "bell hanging from nothing"
            if bad: hung[bad].append((i, j, k))
    for what, cells in hung.items():
        for c, n, grp in cluster(cells, 3):
            F.append(finding("hung", what, S.w(*c), n))
    for what, cells in facing.items():
        for c, n, grp in cluster(cells, 2):
            F.append(finding("facing", what, S.w(*c), n))

    # ---- walking: cells a player can stand in
    free = S.C(S.is_free)
    stand = S.C(S.is_stand)
    feet = np.zeros_like(free)
    feet[:, 1:-1, :] = stand[:, :-2, :] & free[:, 1:-1, :] & free[:, 2:, :]
    opaque = S.C(S.is_opaque)
    # sky: no opaque/slab block anywhere above
    cover = (opaque | S.C(np.array([bool(re.search(r"(_slab$|_stairs$|leaves)", n)) for n, _ in S.pal] + [False])))
    above = np.flip(np.cumsum(np.flip(cover, 1), 1), 1)   # count of covers at or above
    covered = np.zeros_like(free)
    covered[:, :-1, :] = above[:, 1:, :] > 0
    # a ceiling within 7 rows over the cell (a room, a porch), not just something far up (eaves, a tree)
    low = np.zeros_like(free)
    for d in range(2, 9):
        low[:, :-d, :] |= cover[:, d:, :]
    S.lowroof = low

    # ---- light at night (block light only)
    L = _light(S, opaque)

    # reachability from the square: walk graph over feet cells (step up 1, drop up to 3)
    seeds = _square_seeds(S, feet, meta, plan)
    reach = feet.copy() if meta.get("kind") == "buildings" else _walk(feet, seeds, S)

    # ---- doors
    doors = []
    for p, (n, st) in enumerate(S.pal):
        if not DOOR.search(n) or "trapdoor" in n or st.get("upper_block_bit"): continue
        for (i, j, k) in np.argwhere(g == p):
            if not inside2d[i, k]: continue
            doors.append((i, j, k, n, st))
    door_spots = []
    for (i, j, k, n, st) in doors:
        wx, wy, wz = S.w(i, j, k)
        v = DOOR_DIR.get(int(st.get("direction", 1)), (0, 1))
        if "minecraft:cardinal_direction" in st: v = CARD_VEC.get(st["minecraft:cardinal_direction"], v)
        up = nm(i, j + 1, k)
        if not DOOR.search(up): F.append(finding("door", f"{n} has no top half", (wx, wy, wz)))
        sides = [(i + v[0], k + v[1]), (i - v[0], k - v[1])]
        opn = []
        for (a, c) in sides:
            ok = free[a, j, c] and free[a, j + 1, c] if (0 <= a < S.shape[0] and 0 <= c < S.shape[2]) else False
            opn.append(bool(ok))
        if not all(opn):
            # a side blocked: which one
            b = [nm(a, j, c) for (a, c) in sides]
            F.append(finding("facing", f"{n} opens into a block ({b[0] if not opn[0] else b[1]}): one side is walled up", (wx, wy, wz)))
        # inside = the side whose roofed space is the bigger closed room; outside = the other (a porch roof or eaves
        # may cover its step, but that covered patch is small and joins the open sky)
        rooms = []
        for (a, c), o in zip(sides, opn):
            if not o: rooms.append(None); continue
            if not low[a, j, c]: rooms.append((0, True)); continue
            cells = _room_cells(S, free, covered, (a, c), j)
            sky = any(free[q[0] + dx, q[1], q[2] + dz] and free[q[0] + dx, q[1] + 1, q[2] + dz] and not low[q[0] + dx, q[1], q[2] + dz]
                      for q in cells for dx, dz in DIR4 if 0 <= q[0] + dx < S.shape[0] and 0 <= q[2] + dz < S.shape[2]
                      and (q[0] + dx, q[2] + dz) != (i, k))
            rooms.append((len(cells), sky and len(cells) < 60))
        outs, ins = [], []
        for s_, r in zip(sides, rooms):
            if r is None: continue
            (outs if r[1] or r[0] < 12 else ins).append(s_)
        if not outs:
            continue                                     # an inner door (both sides roofed rooms)
        if len(outs) == 2 and not ins:
            # a door standing in the open (a gate between yards, or a building with no room behind it)
            big = max(rooms[0][0], rooms[1][0])
            if big == 0: F.append(finding("interior", f"{n}: no room on either side (open to the sky both ways)", (wx, wy, wz), sev="check"))
        a, c = outs[0]
        door_spots.append((wx, wy, wz))
        floor = nm(a, j - 1, c)
        if not S.is_stand[g[a, j - 1, c]] and not stand[a, j - 1, c]:
            jj = j - 1
            while jj > 0 and air[a, jj, c]: jj -= 1
            F.append(finding("door", f"{n}: nothing to stand on outside it (a {j - 1 - jj + 1}-block drop)", (wx, wy, wz)))
            continue
        if not reach[a, j, c]:
            F.append(finding("door", f"{n}: can't be walked to from the square", (wx, wy, wz)))
        if SOFT_GROUND.match(floor) and meta.get("kind") != "buildings":   # a bare field round the test builds
            # paved within one step?
            near = any(S.is_pathy[g[a + dx, j - 1 + dy, c + dz]] for dx, dz in ((0, 0),) for dy in (0,))
            F.append(finding("door", f"{n}: the step outside is {floor}, not paved to the door", (wx, wy, wz), sev="fix"))
        if L[a, j, c] < 8:
            F.append(finding("light", f"{n}: door step light {int(L[a, j, c])} (needs 8)", (wx, wy, wz), sev="check"))
        # interior
        if ins:
            room, fur, sky = _room(S, free, covered, ins[0], j)
            if sky:
                F.append(finding("interior", f"{n}: the room behind it is open to the sky (roof or wall missing)", (wx, wy, wz)))
            elif fur == 0:
                F.append(finding("interior", f"{n}: the room behind it ({room} cells) has no furnishing", (wx, wy, wz)))
            else:
                dark = sum(1 for c3 in _room_cells(S, free, covered, ins[0], j) if feet[c3] and L[c3] < 7)
                if dark > 3: F.append(finding("light", f"{n}: {dark} floor cells inside darker than 7", (wx, wy, wz), dark, sev="check"))

    # plan doors: a building the plan gives a door must have one there
    if plan:
        for b in plan.get("buildings", []):
            d = b.get("door")
            if not d or b.get("kind") in ("lamp", "tree", "square", "stall"): continue
            gy = b.get("ground_y", 0)
            if b.get("door_block"):                         # the bake names the door block itself (towngen, 2026-11-14)
                d = b["door_block"]; gy = d[1] - 1
            ok = any(abs(x - d[0]) <= 2 and abs(z - d[1]) <= 2 and abs(y - gy) <= 8 for x, y, z in [S.w(i, j, k) for i, j, k, *_ in doors])
            ok = ok or any(abs(x - d[0]) <= 2 and abs(z - d[1]) <= 2 for x, y, z in door_spots)
            if not ok and b.get("door_block"):              # a yard's gate is its door
                gi, gj, gk = d[0] - S.o[0], d[1] - S.o[1], d[2] - S.o[2]
                ok = 0 <= gi < S.shape[0] and 0 <= gj < S.shape[1] and 0 <= gk < S.shape[2] and "fence_gate" in nm(gi, gj, gk)
            if not ok:
                # an open archway counts: walkable cell at the door spot under cover
                i, k = d[0] - S.o[0], d[1] - S.o[2]
                arch = 0 <= i < S.shape[0] and 0 <= k < S.shape[2] and bool((feet[i, :, k] & covered[i, :, k]).any())
                F.append(finding("door", f"{b.get('name') or b['stamp']} ({b['kind']}): no door where the plan puts it" + (" (an open doorway is there)" if arch else ""),
                                 (d[0], gy + 1, d[1]), sev="check" if arch else "fix"))
        for b in plan.get("buildings", []):
            if b.get("kind") in ("barn", "windmill", "house", "civic") and not b.get("door"):
                F.append(finding("door", f"{b.get('name') or b['stamp']} ({b['kind']}): the plan gives it no door", (b["x"], b.get("ground_y", 0) + 1, b["z"]), sev="check"))

    # ---- streets: built paths under the sky darker than 4
    floor_pathy = np.zeros_like(free)
    floor_pathy[:, 1:, :] = S.C(S.is_pathy)[:, :-1, :]
    street = feet & floor_pathy & ~covered & reach & inside2d[:, None, :]
    dark = np.argwhere(street & (L < 4))
    if len(dark):
        for c, n, grp in cluster([tuple(p) for p in dark[:3000]], 5)[:40]:
            F.append(finding("light", f"{n} street cells darker than 4 at night", S.w(*c), n, sev="fix" if n >= 6 else "check"))

    # ---- ground: cliffs in the town, paths over air
    top = _tops(S)
    nat = np.zeros(top.shape, bool)
    for i in range(S.shape[0]):
        for k in range(S.shape[2]):
            t = top[i, k]
            if t >= 0: nat[i, k] = S.is_natural[g[i, t, k]]
    cliffs = []
    for dx, dz in ((1, 0), (0, 1)):
        a = top[:S.shape[0] - dx, :S.shape[2] - dz]; b = top[dx:, dz:]
        na = nat[:S.shape[0] - dx, :S.shape[2] - dz]; nb = nat[dx:, dz:]
        m = (np.abs(a - b) >= 3) & na & nb & inside2d[:S.shape[0] - dx, :S.shape[2] - dz]
        for (i, k) in np.argwhere(m):
            cliffs.append((int(i), int(max(a[i, k], b[i, k])), int(k)))
    if meta.get("kind") == "buildings": cliffs = []
    for c, n, grp in cluster(cliffs, 3)[:30]:
        if n >= 3: F.append(finding("ground", f"natural cliff {n} blocks long, 3+ high (land not blended)", S.w(*c), n, sev="check"))
    pathy = S.C(S.is_pathy) & ~S.C(np.array([bool(re.search(r"(_stairs$|_slab$|_planks$)", n)) for n, _ in S.pal] + [False]))
    gp = np.zeros_like(free)
    gp[:, 1:, :] = pathy[:, 1:, :] & air[:, :-1, :]
    # only path surfaces (sky above) in the town
    gp &= inside2d[:, None, :]
    pts = [tuple(p) for p in np.argwhere(gp) if not covered[p[0], p[1], p[2]] and S.pal[g[tuple(p)]][0] in ("grass_path", "dirt_path", "gravel")]
    for c, n, grp in cluster(pts, 3)[:30]:
        F.append(finding("ground", f"{n} path blocks over air", S.w(*c), n))

    # ---- junk: trees on paths, leaves over roofs
    logs = S.C(S.is_log)
    on_path = np.zeros_like(free)
    on_path[:, 1:, :] = logs[:, 1:, :] & S.C(S.is_pathy)[:, :-1, :]
    on_path &= inside2d[:, None, :]
    pts = []
    for p in np.argwhere(on_path):
        n0 = S.pal[g[tuple(p)]][0]
        if n0.startswith("stripped_") or S.pal[g[p[0], p[1] - 1, p[2]]][0] not in ("grass_path", "dirt_path", "gravel"): continue
        col = g[p[0], p[1]:p[1] + 14, p[2]]
        if any(c >= 0 and LEAVES.search(S.pal[c][0]) for c in g[max(0, p[0] - 2):p[0] + 3, p[1] + 2:p[1] + 14, max(0, p[2] - 2):p[2] + 3].ravel()): pts.append(tuple(p))
    for c, n, grp in cluster(pts, 2):
        F.append(finding("junk", "a tree trunk standing on a path", S.w(*c), n, sev="check"))
    leaves = S.C(S.is_leaves)
    built = S.C(np.array([bool(re.search(r"(_stairs$|_slab$|_planks$|bricks$|^chimney)", n)) for n, _ in S.pal] + [False]))
    over = np.zeros_like(free)
    over[:, 1:, :] = leaves[:, 1:, :] & built[:, :-1, :]
    over &= inside2d[:, None, :]
    for c, n, grp in cluster([tuple(p) for p in np.argwhere(over)], 3)[:30]:
        if n >= 2: F.append(finding("junk", f"tree leaves lying on a roof or wall ({n})", S.w(*c), n, sev="check"))

    stats = {"blocks": int((~air).sum()), "doors": len(doors), "outside_doors": len(door_spots),
             "street_cells": int(street.sum()), "dark_street": int((street & (L < 4)).sum())}
    return F, stats, S, L


def _gap_below(S, solidish, sl, sub):
    i0, j0, k0 = sl[0].start, sl[1].start, sl[2].start
    best = 999
    idx = np.argwhere(sub)
    low = idx[:, 1].min()
    for p in idx[idx[:, 1] == low][:20]:
        i, j, k = p[0] + i0, p[1] + j0, p[2] + k0
        d = 0
        while j - d - 1 >= 0 and not solidish[i, j - d - 1, k]: d += 1
        best = min(best, d)
    return best


def _light(S, opaque):
    em = S.C(S.emit).astype(np.int16)
    # leaves and water cut more light
    L = em.copy()
    tr = ~opaque
    for _ in range(15):
        m = np.zeros_like(L)
        m[1:] = np.maximum(m[1:], L[:-1]); m[:-1] = np.maximum(m[:-1], L[1:])
        m[:, 1:] = np.maximum(m[:, 1:], L[:, :-1]); m[:, :-1] = np.maximum(m[:, :-1], L[:, 1:])
        m[:, :, 1:] = np.maximum(m[:, :, 1:], L[:, :, :-1]); m[:, :, :-1] = np.maximum(m[:, :, :-1], L[:, :, 1:])
        nl = np.where(tr, np.maximum(L, m - 1), em)
        if np.array_equal(nl, L): break
        L = nl
    return L


def _tops(S):
    """Highest block per column that a player would call the ground or a floor (not plants, leaves, lanterns)."""
    ok = S.C(S.is_stand) & ~S.C(S.is_leaves)
    sy = S.shape[1]
    rev = ok[:, ::-1, :]
    has = rev.any(1)
    t = sy - 1 - rev.argmax(1)
    t[~has] = -1
    return t


def _square_seeds(S, feet, meta, plan):
    sqy = None
    if plan and plan.get("square"):
        cx, cz = plan["square"]["centre"]; sqy = plan["square"].get("y")
    else:
        cx, cz = meta.get("sq", [meta.get("x", 0), meta.get("z", 0)]); sqy = meta.get("sqy")
    i0, k0 = cx - S.o[0], cz - S.o[2]
    seeds = []
    for r in range(0, 12):
        for i in range(i0 - r, i0 + r + 1):
            for k in range(k0 - r, k0 + r + 1):
                if 0 <= i < S.shape[0] and 0 <= k < S.shape[2]:
                    js = np.nonzero(feet[i, :, k])[0]
                    for j in js:
                        wy = j + S.o[1]
                        if sqy is not None and abs(wy - (sqy + 1)) > 2: continue
                        if not S.is_air[S.g[i, j + 2:, k]].all(): continue      # under a roof: a seed in a house, not the square
                        seeds.append((i, int(j), k))
        if len(seeds) > 20: break
    return seeds


def _walk(feet, seeds, S):
    """Reachable feet cells: a step up of 1, a drop of up to 3, ladders."""
    reach = np.zeros_like(feet)
    todo = [s for s in seeds if feet[s]]
    for s in todo: reach[s] = True
    lad = S.C(np.array([n in ("ladder", "vine", "scaffolding") for n, _ in S.pal] + [False]))
    sx, sy, sz = feet.shape
    while todo:
        nxt = []
        for (i, j, k) in todo:
            cand = []
            for dx, dz in DIR4:
                a, c = i + dx, k + dz
                if not (0 <= a < sx and 0 <= c < sz): continue
                for dy in (0, 1, -1, -2, -3):
                    b = j + dy
                    if 0 < b < sy - 1 and feet[a, b, c]:
                        if dy == 1 and not (feet[i, j, k] and S.is_free[S.g[i, j + 2, k]] if j + 2 < sy else False): continue
                        cand.append((a, b, c)); break
            # ladders
            for dy in (1, -1):
                b = j + dy
                while 0 < b < sy - 1 and (lad[i, b, k] or lad[i, b - 1, k]):
                    if feet[i, b, k]: cand.append((i, b, k))
                    b += dy
                    if abs(b - j) > 30: break
            for c3 in cand:
                if not reach[c3]: reach[c3] = True; nxt.append(c3)
        todo = nxt
    return reach


def _room_cells(S, free, covered, start, j):
    """The room a door opens on: cells at the door's floor level (a step up or down allowed) with a ceiling no
    more than 7 rows over them, flooded sideways from the cell inside the door."""
    low = S.lowroof
    i0, k0 = start
    if not (free[i0, j, k0] and low[i0, j, k0]): return set()
    seen = {(i0, j, k0)}; todo = [(i0, j, k0)]
    while todo and len(seen) < 4000:
        i, jj, k = todo.pop()
        for dx, dz in DIR4:
            for dy in (0, 1, -1):
                q = (i + dx, jj + dy, k + dz)
                if not (0 <= q[0] < S.shape[0] and 0 < q[1] < S.shape[1] - 1 and 0 <= q[2] < S.shape[2]): continue
                if q in seen or not free[q] or not free[q[0], q[1] + 1, q[2]] or not low[q]: continue
                if dy and abs(q[1] - j) > 2: continue
                seen.add(q); todo.append(q); break
    return seen


def _room(S, free, covered, start, j):
    cells = _room_cells(S, free, covered, start, j)
    # sky leak: a free cell in the room with nothing over it
    sky = 0
    fur = set()
    g = S.g
    for (i, jj, k) in cells:
        for d in ((1, 0, 0), (-1, 0, 0), (0, 0, 1), (0, 0, -1), (0, 1, 0), (0, -1, 0), (0, 0, 0)):
            q = (i + d[0], jj + d[1], k + d[2])
            if not (0 <= q[0] < S.shape[0] and 0 <= q[1] < S.shape[1] and 0 <= q[2] < S.shape[2]): continue
            p = g[q]
            if p >= 0 and FURNISH.search(S.pal[p][0]) and not DOOR.search(S.pal[p][0]): fur.add(q)
    # free cells next to the room that are open to the sky = the room is not closed
    for (i, jj, k) in cells:
        for d in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = (i + d[0], jj, k + d[1])
            if 0 <= q[0] < S.shape[0] and 0 <= q[2] < S.shape[2] and free[q] and not S.lowroof[q]: sky += 1
    # the door itself leaks one or two cells
    return len(cells), len(fur), sky > 6 and len(cells) < 60


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sites", nargs="+")
    ap.add_argument("--out", required=True)
    ap.add_argument("--plans", default=os.path.join(ROOT, "map"), help="folder with <town>-plan.json (the bake's own)")
    a = ap.parse_args()
    allf = {}
    for path in a.sites:
        meta = load_site(path)[0]
        plan = None
        slug = re.sub(r"[^a-z0-9]+", "_", meta["name"].lower()).strip("_")
        pp = os.path.join(a.plans, f"{slug}-plan.json")
        if meta["kind"] == "town" and os.path.exists(pp): plan = json.load(open(pp))
        F, stats, S, L = audit(path, plan, radius={"hamlet": 70, "buildings": 2000}.get(meta["kind"]))
        if meta["kind"] == "buildings":                 # name the building each finding is in
            for f in F:
                for b in meta.get("placed", []):
                    if b["box"][0] - 3 <= f["at"][0] <= b["box"][2] + 3 and b["box"][1] - 3 <= f["at"][2] <= b["box"][3] + 3:
                        f["building"] = b["id"]; f["what"] = f"{b['id']}: " + f["what"]; break
        allf[meta["name"]] = {"meta": meta, "stats": stats, "findings": F}
        c = Counter(f["kind"] for f in F)
        print(f"{meta['kind']:6} {meta['name']:14} {stats}  " + ", ".join(f"{k} {v}" for k, v in sorted(c.items())), flush=True)
    json.dump(allf, open(a.out, "w"), indent=1)


if __name__ == "__main__":
    main()
