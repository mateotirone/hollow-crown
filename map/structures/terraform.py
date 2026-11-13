"""One terraform pass for everything placed on the map (Mateo 2026-11-13, after Enshrouded's building terrain):
a building, a plot, a story site or a station never sits on the land as it is. It carries a small terrain spec, and
the land round it is solved from the specs of everything near it.

    site = Site(pad={(x, z): y, ...},          # the floor: the top solid block under it, one level per cell
                connectors={(x, z): y, ...},   # door landings, path ends, track beds: ground that must meet them
                carve=6,                       # air this high over the pad (clears trees and old ground)
                skirt=4, skirt_max=6)          # the blend round it: 4 blocks, out to 6 on rough ground
    T, wall = solve(h, [site, ...], fixed=mask)   # h: the land's top block y per cell (2-D, local cells)
    works = blocks(h, T, wall, sites, region="vale", x0=..., z0=...)   # {(x, y, z): (name, props)}

How the land is solved: every pad and connector cell is an anchor at its own height. From each anchor the ground may
rise or fall by at most k per block of distance (1 in 2 by default, 1 in 1 on rough ground), which gives an upper
and a lower envelope round everything placed (a multi-source shortest path over the cells). The new ground is the
old ground clamped between them, so open land keeps its shape wherever it already fits and only the ground that has
to move does. Beyond skirt_max nothing moves: where the land still doesn't meet there, the step becomes a retaining
wall in the region's stone (never a bare dirt cliff, never a stone wall under a whole building).

The pad height (pad_height) balances digging in against building up: never more than 3 below the highest block of
the footprint, and level with the connectors it must meet (half a block). This replaces "the floor on the highest
block, stone under everything" (Mateo 2026-11-11), which put tall stone walls under buildings on slopes.

Cells marked fixed (water, streets, other towns' ground) are never moved. The game side runs the same rules in
Siege_Nights_BP/scripts/settle/terraform.js; both pass map/structures/terraform_cases.json.
"""
import heapq, math
from dataclasses import dataclass, field

import numpy as np

K_SOFT = 0.5          # 1 block up for every 2 across: walkable, looks like land
K_STEEP = 1.0         # 1 in 1: used only when the soft slope would reach past skirt_max
MAX_BELOW = 3         # a pad is never more than this below the highest block of its footprint
SQ2 = math.sqrt(2)

# region ground: top block (and patches), what lies under it, and the retaining wall
REGION = {
    "vale":       {"top": "grass_block", "patch": ("coarse_dirt", 9), "sub": "dirt", "wall": ("cobblestone", "mossy_cobblestone")},
    "frostmarch": {"top": "grass_block", "patch": ("podzol", 11), "sub": "dirt", "wall": ("cobbled_deepslate", "deepslate_bricks")},
    "saltreach":  {"top": "grass_block", "patch": ("gravel", 7), "sub": "dirt", "wall": ("stone_bricks", "cobblestone")},
    "emberwaste": {"top": "red_sand", "patch": ("coarse_dirt", 6), "sub": "red_sandstone", "wall": ("sandstone", "cut_sandstone")},
    "blackfen":   {"top": "grass_block", "patch": ("moss_block", 5), "sub": "mud", "wall": ("mud_bricks", "packed_mud")},
    "hollow":     {"top": "coarse_dirt", "patch": ("siege:pale_ash", 6), "sub": "dirt", "wall": ("polished_blackstone_bricks", "cracked_polished_blackstone_bricks")},
}
SOIL = 3              # soil this deep under a new top, then stone


@dataclass
class Site:
    pad: dict                                   # (x, z) -> floor y (the top solid block)
    connectors: dict = field(default_factory=dict)
    carve: int = 6                              # air from the floor up to floor + carve
    skirt: int = 4
    skirt_max: int = 6
    pad_fill: str = "stone"                     # under a building: dressed stone; "soil" for a bare plot or yard
    k: float = None                             # chosen by solve(): K_SOFT or K_STEEP


def pad_height(hs, connectors=(), max_below=MAX_BELOW):
    """The floor for a footprint whose land heights are hs: balance cut against fill (filling shows more than cutting,
    so it costs a little more), at most max_below under the highest block, and within one block of every connector
    (a slab step). Returns None if no height fits."""
    hs = np.asarray(hs, float); top = int(hs.max())
    best = None
    for y in range(top - max_below, top + 1):
        if any(abs(c - y) > 1 for c in connectors): continue
        cut = float(np.maximum(0, hs - y).sum()); fill = float(np.maximum(0, y - hs).sum())
        cost = abs(cut - 1.3 * fill) + 0.25 * (cut + fill) + 0.5 * (top - y)
        if best is None or cost < best[0]: best = (cost, y)
    return None if best is None else best[1]


def _envelope(shape, seeds, k, radius, sign, fixed):
    """Multi-source shortest path: out[c] = min over seeds (sign * y_s + k * dist(s, c)), out to radius (octile
    distance). sign=+1 gives the upper envelope, -1 the negated lower one. Fixed cells don't pass it on."""
    W, H = shape
    best = np.full(shape, np.inf); dist = np.full(shape, np.inf)
    pq = []
    for (i, j), y in seeds.items():
        v = sign * y
        if v < best[i, j]: best[i, j] = v; dist[i, j] = 0.0; heapq.heappush(pq, (v, 0.0, i, j))
    steps = [(1, 0, 1.0), (-1, 0, 1.0), (0, 1, 1.0), (0, -1, 1.0), (1, 1, SQ2), (1, -1, SQ2), (-1, 1, SQ2), (-1, -1, SQ2)]
    while pq:
        v, d, i, j = heapq.heappop(pq)
        if v > best[i, j] + 1e-9: continue
        if fixed is not None and fixed[i, j] and d > 0: continue
        for di, dj, c in steps:
            a, b = i + di, j + dj
            if not (0 <= a < W and 0 <= b < H): continue
            nd = d + c
            if nd > radius + 1e-9: continue
            nv = v + k * c
            if nv < best[a, b] - 1e-9: best[a, b] = nv; dist[a, b] = nd; heapq.heappush(pq, (nv, nd, a, b))
    return best


def _site_env(shape, site, k, fixed):
    seeds = {**site.connectors, **site.pad}
    U = _envelope(shape, seeds, k, site.skirt_max, +1, fixed)
    L = -_envelope(shape, seeds, k, site.skirt_max, -1, fixed)
    return U, L


def solve(h, sites, fixed=None):
    """New ground heights for land h (int, [i, j] local cells) round every site. Returns (T, wall): T the new top
    block y per cell, wall a bool mask of cells whose exposed side becomes a retaining wall."""
    h = np.asarray(h); shape = h.shape
    U = np.full(shape, np.inf); L = np.full(shape, -np.inf)
    for s in sites:
        k = s.k or K_SOFT
        u, l = _site_env(shape, s, k, fixed)
        # the soft slope reaches past the skirt where the land is too far from the pad: steepen to 1 in 1 there
        if s.k is None:
            T0 = np.clip(h, np.ceil(l - 1e-9), np.floor(u + 1e-9))
            ring = np.isfinite(u) & _dilate(np.isinf(u))      # the outermost cells the skirt reaches
            if ring.any() and np.abs(T0[ring] - h[ring]).max() > 2:     # more than feathering can ease
                k = K_STEEP; u, l = _site_env(shape, s, k, fixed)
        s.k = k
        U = np.minimum(U, u); L = np.maximum(L, l)
    lo = np.ceil(L - 1e-9); hi = np.floor(U + 1e-9)
    T = h.astype(float).copy()
    touched = np.isfinite(U) | np.isfinite(L)
    ok = touched & (lo <= hi)
    T[ok] = np.clip(h[ok], lo[ok], hi[ok])
    bad = touched & (lo > hi)                       # two sites that can't both be met: split the difference
    T[bad] = np.round((lo[bad] + hi[bad]) / 2)
    for s in sites:                                 # pads and connectors are exact
        for (i, j), y in {**s.connectors, **s.pad}.items(): T[i, j] = y
    if fixed is not None: T[fixed] = h[fixed]
    T = T.astype(int)
    pad = np.zeros(shape, bool); hard = np.zeros(shape, bool)
    for s in sites:
        for (i, j) in s.pad: pad[i, j] = True
        for c in {**s.connectors, **s.pad}: hard[c] = True
    if fixed is not None: hard |= fixed
    T = _feather(h, T, hard)
    # a retaining wall wherever the pass left a column 2 or more over its neighbour, steeper than the land was there
    # (never round a pad: that's foundation; natural crags stay as they are)
    gap = _edge_gap(T, T)
    wall = (gap >= 2) & (gap > _edge_gap(h, h)) & _dilate(T != h) & ~pad
    return T, wall


FEATHER = 3          # past skirt_max, a small leftover step is eased over up to this many more blocks before it's a wall


def _feather(h, T, hard):
    """Ease small steps the skirt left at its edge into the land beyond (a block a cell), so a wall is built only
    where the land really can't meet: a lone two-block wall on open grass reads as a stray stone."""
    W, H = T.shape; T = T.copy()
    for _ in range(FEATHER):
        moved = T != h; changed = False
        for i, j in np.argwhere(moved):
            t = T[i, j]
            for a, b in ((i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1)):
                if not (0 <= a < W and 0 <= b < H) or hard[a, b] or moved[a, b]: continue
                if T[a, b] - t >= 2 and T[a, b] - t <= 3: T[a, b] = t + 1; changed = True
                elif t - T[a, b] >= 2 and t - T[a, b] <= 3: T[a, b] = t - 1; changed = True
        if not changed: break
    return T


def _dilate(m):
    o = m.copy()
    o[1:] |= m[:-1]; o[:-1] |= m[1:]; o[:, 1:] |= m[:, :-1]; o[:, :-1] |= m[:, 1:]
    return o


def _edge_gap(a, b):
    """Per cell: a minus the lowest 4-neighbour of b (0 at the grid edge)."""
    lo = b.astype(float).copy()
    lo[1:] = np.minimum(lo[1:], b[:-1]); lo[:-1] = np.minimum(lo[:-1], b[1:])
    lo[:, 1:] = np.minimum(lo[:, 1:], b[:, :-1]); lo[:, :-1] = np.minimum(lo[:, :-1], b[:, 1:])
    return a - lo


def _h(x, z, s):
    v = (x * 73856093) ^ (z * 19349663) ^ (s * 83492791)
    return (v & 0xFFFF) / 65536.0


def blocks(h, T, wall, sites, region="vale", x0=0, z0=0, fixed=None):
    """World blocks for a solved ground: {(x, y, z): (name, props)}. Raised ground is soil (stone deeper than SOIL),
    cut ground is opened to the sky, a new top gets the region's top block, retaining walls face the drop, pads are
    carved clear above and filled with stone (or soil) under. Cell (i, j) is world (x0 + i, z0 + j)."""
    R = REGION.get(region, REGION["vale"]); out = {}
    pad = {}; carve = {}
    for s in sites:
        for c, y in s.pad.items():
            pad[c] = s.pad_fill; carve[c] = max(carve.get(c, 0), y + s.carve)
    W, H = T.shape
    lowest = T - _edge_gap(T, T)
    for i in range(W):
        for j in range(H):
            if fixed is not None and fixed[i, j]: continue
            t, g = int(T[i, j]), int(h[i, j])
            c = (i, j)
            if t == g and c not in pad and not wall[i, j]: continue
            x, z = x0 + i, z0 + j
            if c in pad:
                fill = pad[c]
                for y in range(g + 1, t + 1):
                    out[(x, y, z)] = (R["wall"][0], {}) if fill == "stone" else (R["sub"], {})
                if fill == "soil": out[(x, t, z)] = (R["top"], {})
                for y in range(t + 1, max(g, carve[c]) + 1): out[(x, y, z)] = ("air", {})
                continue
            for y in range(g + 1, t):                               # raised: soil, stone below SOIL
                out[(x, y, z)] = (R["sub"] if t - y <= SOIL else "stone", {})
            for y in range(t + 1, g + 1): out[(x, y, z)] = ("air", {})   # cut: open to the sky
            if t < g:                                               # a cut exposes the deep ground: soil it
                for y in range(max(t - SOIL, t - (g - t)), t): out[(x, y, z)] = (R["sub"], {})
            top = R["top"]
            pn, every = R["patch"]
            if _h(x // 2, z // 2, 3) * every < 1 and lowest[i, j] == t: top = pn   # patches on level ground, never down a slope
            out[(x, t, z)] = (top, {})
            if wall[i, j]:
                lo = int(lowest[i, j])
                for y in range(lo + 1, t + 1):
                    out[(x, y, z)] = (R["wall"][1] if _h(x, z + y, 7) < 0.25 else R["wall"][0], {})
    return out


def report(h, T, wall, sites):
    """Numbers for a check: cells moved, cut and fill volume, wall cells, the steepest open-ground step."""
    pad = np.zeros(T.shape, bool)
    for s in sites:
        for c in s.pad: pad[c] = True
    d = T - h
    gap = _edge_gap(T, T)
    made = ~pad & ~wall & _dilate(d != 0) & (gap > _edge_gap(h, h))     # steps the pass made (natural crags don't count)
    return {"moved": int((d != 0).sum()), "cut": int(np.maximum(0, -d).sum()), "fill": int(np.maximum(0, d).sum()),
            "wall": int(wall.sum()), "steepest": int(gap[made].max()) if made.any() else int(min(1, gap[~pad].max())),
            "k": [s.k for s in sites]}
