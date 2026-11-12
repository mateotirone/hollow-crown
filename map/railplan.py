#!/usr/bin/env python3
"""Plan the rail lines block by block, ahead of time (Mateo 2026-11-11: track is laid out in advance and the game
spawns it one stop at a time as routes are bought; you can't go A to C without buying the stop at B).

Pure (numpy only), so map/genworld.py can call it and the self-test runs anywhere: python3 map/railplan.py

    path = trace(points, stops)          # 8-connected integer (x, z) cells along a line's control points;
                                         # straight north/south/east/west track for PLATFORM blocks each side of
                                         # every stop, so station buildings line up on it
    ys = profile(path, ground, stops_i)  # track heights: at most 1 block up per 3 along, only on N/S/E/W steps,
                                         # never twice in a row, flat through every platform

The map grades the bed (genworld.py); the train scripts lay siege:track from map/rail-segments.json when a
segment is bought (scripts/trains, PR #88).
"""
import math
import numpy as np

PLATFORM = 23          # straight track each side of a stop (platforms are up to 45 long)
DX = [0, 1, 1, 1, 0, -1, -1, -1]
DZ = [-1, -1, 0, 1, 1, 1, 0, -1]


def _sign(v): return (v > 0) - (v < 0)


def _raster(pts):
    """Step cell by cell through the points (diagonal when both axes still differ)."""
    cells = [(int(round(pts[0][0])), int(round(pts[0][1])))]
    for a, b in zip(pts, pts[1:]):
        n = max(1, int(math.ceil(math.dist(a, b) * 2)))
        for k in range(1, n + 1):
            tx = int(round(a[0] + (b[0] - a[0]) * k / n)); tz = int(round(a[1] + (b[1] - a[1]) * k / n))
            while (tx, tz) != cells[-1]:
                x, z = cells[-1]; cells.append((x + _sign(tx - x), z + _sign(tz - z)))
    return cells


def _dir(a, b):
    return next(d for d in range(8) if DX[d] == b[0] - a[0] and DZ[d] == b[1] - a[1])


def _smooth_turns(cells, keep=()):
    """Cut every corner sharper than 45 degrees per block (track pieces only turn 45, or 90 slowly)."""
    keep = set(keep)
    changed = True
    while changed:
        changed = False
        out = [cells[0]]
        i = 1
        while i < len(cells) - 1:
            a, b, c = out[-1], cells[i], cells[i + 1]
            turn = (_dir(b, c) - _dir(a, b)) % 8
            if turn in (2, 3, 4, 5, 6) and b not in keep and max(abs(c[0] - a[0]), abs(c[1] - a[1])) == 1:
                i += 1; changed = True; continue        # drop the corner cell: a -> c is one diagonal step
            out.append(b); i += 1
        out.append(cells[-1])
        cells = out
    return cells


def _climb_jogs(cells, keep=(), window=15):
    """Track can only climb on straight north/south/east/west steps, and a slope needs a straight step either side,
    so a line that wanders off the axes (diagonal, or diagonal with the odd straight step) could hardly ever change
    height. Within every `window` steps that keep to one diagonal and its two neighbouring straights, reorder the
    steps so the straights come in runs of three (turning a diagonal into its two straights if there are too few):
    same end point, 45 degree turns, a sideways wobble of a block or two, and a place to climb in every window."""
    keep = set(keep)
    steps = [_dir(a, b) for a, b in zip(cells, cells[1:])]
    out = []
    for w0 in range(0, len(steps), window):
        win = steps[w0:w0 + window]
        if len(win) < window or any(c in keep for c in cells[w0:w0 + window + 1]):
            out += win; continue
        diags = {d for d in win if d % 2 == 1}
        if len(diags) != 1: out += win; continue
        d = diags.pop(); a, b = (d - 1) % 8, (d + 1) % 8
        if not set(win) <= {a, b, d}: out += win; continue
        na, nb, nd = win.count(a), win.count(b), win.count(d)
        if nb > na: a, b, na, nb = b, a, nb, na
        if na < 3:
            k = 3 - na
            if nd - k < 2: out += win; continue
            nd -= k; na += k; nb += k
        h1 = nd // 3; h2 = max(1, nd // 3) if nb else 0; h3 = nd - h1 - h2
        if h3 < 0: out += win; continue
        out += [d] * h1 + [a] * na + [d] * h2 + [b] * nb + [d] * h3
    res = [cells[0]]
    for d in out: res.append((res[-1][0] + DX[d], res[-1][1] + DZ[d]))
    assert res[-1] == cells[-1]
    return res

def _despike(cells, keep=()):
    """Flatten one-block bumps: a cell stepping out sideways and straight back (the track can't turn 90 degrees on a
    diagonal) is moved back onto the straight between its neighbours."""
    cells = list(cells)
    for i in range(1, len(cells) - 1):
        (ax, az), (bx, bz) = cells[i - 1], cells[i + 1]
        if cells[i] not in keep and sorted((abs(bx - ax), abs(bz - az))) == [0, 2]:
            cells[i] = ((ax + bx) // 2, (az + bz) // 2)
    return cells

def trace(points, stops=(), routed=False):
    """points: the line's control points [(x, z), ...] (already smooth); stops: [(x, z, axis or None), ...] that the
    line passes through or starts/ends at. Returns (cells, stop_index) with a straight N/S/E/W run of PLATFORM
    blocks each side of every stop (only on the line's side at a line end). routed=True: the points already run
    straight along each platform (map/railroute.py routes from platform end to platform end), so they are followed
    as they are instead of being thinned out round the platforms."""
    pts = [tuple(map(float, p)) for p in points]
    rough = _raster(pts)
    arr = np.array(rough, float)
    ctrl = []
    for k_in, (sx, sz, axis) in enumerate(stops):
        i = int(np.argmin(np.hypot(arr[:, 0] - sx, arr[:, 1] - sz)))
        if axis is None:
            j0, j1 = max(0, i - 8), min(len(rough) - 1, i + 8)
            dx, dz = rough[j1][0] - rough[j0][0], rough[j1][1] - rough[j0][1]
            axis = "x" if abs(dx) >= abs(dz) else "z"
        ctrl.append((i, int(round(sx)), int(round(sz)), axis, k_in))
    ctrl.sort()
    # rebuild the control list: the original cells, but each stop replaced by its straight platform
    newpts, last = [], 0
    pieces = []
    for i, sx, sz, axis, _k in ctrl:
        ux, uz = (1, 0) if axis == "x" else (0, 1)
        # the platform runs in the direction of travel
        j0, j1 = max(0, i - 8), min(len(rough) - 1, i + 8)
        if (rough[j1][0] - rough[j0][0]) * ux + (rough[j1][1] - rough[j0][1]) * uz < 0: ux, uz = -ux, -uz
        a = (sx - ux * PLATFORM, sz - uz * PLATFORM) if i > 0 else (sx, sz)
        b = (sx + ux * PLATFORM, sz + uz * PLATFORM) if i < len(rough) - 1 else (sx, sz)
        pieces.append((i, a, (sx, sz), b, (ux, uz)))
    out = []
    prev_end = None
    prev_u = None
    if routed: pieces_iter = []
    else: pieces_iter = pieces
    ahead = lambda c, p, u: (c[0] - p[0]) * u[0] + (c[1] - p[1]) * u[1]
    for k, (i, a, s, b, u) in enumerate(pieces_iter):
        lo = int(np.argmin(np.hypot(arr[:, 0] - prev_end[0], arr[:, 1] - prev_end[1]))) if prev_end else 0
        # approach: from the previous platform end (or the line start) through the rough cells clear of both platforms
        mid = [c for c in rough[lo:i] if ahead(a, c, u) > PLATFORM * 0.6 and math.dist(c, s) > PLATFORM * 1.5
               and (prev_end is None or ahead(c, prev_end, prev_u) > PLATFORM * 0.6)]
        seq = ([prev_end] if prev_end else ([rough[0]] if i > 0 else [])) + mid[::6] + [a, s, b]
        seg = _raster([p for p in seq if p is not None])
        out += seg if not out else seg[1:] if seg[0] == out[-1] else _raster([out[-1], seg[0]])[1:-1] + seg
        prev_end = b; prev_u = u
    lo = int(np.argmin(np.hypot(arr[:, 0] - prev_end[0], arr[:, 1] - prev_end[1]))) if prev_end else 0
    tail = [c for c in rough[lo:] if prev_end is None or ahead(c, prev_end, prev_u) > PLATFORM * 0.6]
    if routed: out = list(rough); tail = []
    if tail:
        seg = _raster([out[-1]] + tail[::6] + [rough[-1]]) if out else _raster(tail[::6] + [rough[-1]])
        out += seg[1:] if out else seg
    # dedupe
    cells = [out[0]]
    for c in out[1:]:
        if c != cells[-1]: cells.append(c)
    stop_cells = [(int(s[0]), int(s[1])) for _, _, s, _, _ in pieces]
    keep = set()
    for _, a, s, b, _ in pieces: keep |= set(_raster([a, s, b]))
    cells = _smooth_turns(cells, keep)
    cells = _climb_jogs(cells, keep)
    cells = _despike(cells, keep)
    idx = {c: n for n, c in enumerate(cells)}
    found = [idx.get(c, int(np.argmin([math.dist(c, q) for q in cells]))) for c in stop_cells]
    res = [0] * len(ctrl)
    for (_, _, _, _, k_in), f in zip(ctrl, found): res[k_in] = f
    return cells, res


def profile(cells, ground, stop_idx=(), window=41, flat=PLATFORM, stop_y=None):
    """Track heights (the block the track sits in) along cells. ground[i] = height the bed would like (ground or
    clearance over water). Greedy follow of a smoothed target under the climbing rules, flat through platforms."""
    g = np.asarray(ground, float) + 1
    n = len(cells)
    k = window // 2
    pad = np.pad(g, k, mode='edge')
    t = np.convolve(pad, np.ones(window) / window, mode='valid')
    locked = np.zeros(n, bool)
    for k, s in enumerate(stop_idx):
        lo, hi = max(0, s - flat), min(n, s + flat + 1)
        t[lo:hi] = stop_y[k] if stop_y is not None else round(float(np.median(g[lo:hi]))); locked[lo:hi] = True
    # ease into each platform: blend the target toward the platform height over 60 blocks either side
    for k, s in enumerate(stop_idx):
        for i in range(max(0, s - flat - 60), min(n, s + flat + 61)):
            if locked[i]: continue
            w = 1 - (min(abs(i - (s - flat)), abs(i - (s + flat))) / 60)
            t[i] = t[i] * (1 - max(0, w)) + t[s] * max(0, w)
    orth = np.zeros(n, bool)
    for i in range(1, n):
        orth[i] = cells[i][0] == cells[i - 1][0] or cells[i][1] == cells[i - 1][1]
    y = np.zeros(n, int); y[0] = int(round(t[0])); last = -99
    for i in range(1, n):
        y[i] = y[i - 1]
        d = t[i] - y[i - 1]
        if abs(d) >= 0.75 and orth[i] and i - last >= 3 and not locked[i] and not locked[i - 1]:
            # a slope must run straight through: the step before and after must be in the same direction
            straight = i + 1 >= n or _dir(cells[i - 1], cells[i]) == _dir(cells[i], cells[i + 1])
            straight &= i - 2 < 0 or _dir(cells[i - 2], cells[i - 1]) == _dir(cells[i - 1], cells[i])
            if straight: y[i] += 1 if d > 0 else -1; last = i
    return y


def profile_dp(cells, ground, stop_idx=(), flat=PLATFORM, stop_y=None, smooth_w=0.3, window=41, weight=None):
    """Track heights that follow the land as closely as the climbing rules allow, looking ahead (Mateo 2026-11-11:
    paths should climb the high ground, not cut ravines through it). Minimises the total |track - ground| (plus a
    little pull toward the smoothed ground) under the same rules as profile(): at most 1 block up or down per 3
    along, only on straight north/south/east/west steps, flat through every platform. weight[i] (default 1) scales
    how hard cell i is held to the ground, e.g. inside towns whose streets were planned on it."""
    g = np.asarray(ground, float) + 1
    n = len(cells)
    wt = np.ones(n) if weight is None else np.asarray(weight, float)
    k = window // 2
    t = np.convolve(np.pad(g, k, mode='edge'), np.ones(window) / window, mode='valid')
    fixed = np.full(n, -10**6, int)
    for j, s in enumerate(stop_idx):
        lo, hi = max(0, s - flat), min(n, s + flat + 1)
        fixed[lo:hi] = stop_y[j] if stop_y is not None else int(round(float(np.median(g[lo:hi]))))
    ok = np.zeros(n, bool)                    # may the track change height arriving at cell i?
    for i in range(1, n):
        if fixed[i] > -10**6 or fixed[i - 1] > -10**6: continue
        if not (cells[i][0] == cells[i - 1][0] or cells[i][1] == cells[i - 1][1]): continue
        st = i + 1 >= n or _dir(cells[i - 1], cells[i]) == _dir(cells[i], cells[i + 1])
        st &= i - 2 < 0 or _dir(cells[i - 2], cells[i - 1]) == _dir(cells[i - 1], cells[i])
        ok[i] = st
    lo_y = int(min(g.min(), fixed[fixed > -10**6].min() if (fixed > -10**6).any() else g.min())) - 30
    hi_y = int(max(g.max(), fixed.max())) + 10
    H = hi_y - lo_y + 1
    INF = 1e18
    def cell_cost(i):
        ys = np.arange(lo_y, hi_y + 1)
        c = wt[i] * np.abs(ys - g[i]) + smooth_w * np.abs(ys - t[i])
        if fixed[i] > -10**6: c = 4.0 * np.abs(ys - fixed[i])     # platforms: flat, pulled hard toward the stop height
        return c
    # state: (height, since) with since = blocks since the last change, capped at 2 (2 means a change may come next)
    cost = np.full((H, 3), INF); cost[:, 2] = cell_cost(0)
    back = np.zeros((n, H, 3), np.int8)        # 0 same height, 1 came from below, 2 came from above; since packed in
    prev_s = np.zeros((n, H, 3), np.int8)
    for i in range(1, n):
        cc = cell_cost(i)
        new = np.full((H, 3), INF); bk = np.zeros((H, 3), np.int8); ps = np.zeros((H, 3), np.int8)
        # no change: since grows (0->1, 1->2, 2->2)
        for s_from, s_to in ((0, 1), (1, 2), (2, 2)):
            v = cost[:, s_from]; better = v < new[:, s_to]
            new[better, s_to] = v[better]; bk[better, s_to] = 0; ps[better, s_to] = s_from
        if ok[i]:                              # a change arrives here from a state with since == 2
            up = np.full(H, INF); up[1:] = cost[:-1, 2]
            dn = np.full(H, INF); dn[:-1] = cost[1:, 2]
            for v, code in ((up, 1), (dn, 2)):
                better = v < new[:, 0]
                new[better, 0] = v[better]; bk[better, 0] = code; ps[better, 0] = 2
        cost = new + cc[:, None]; back[i] = bk; prev_s[i] = ps
    y = np.zeros(n, int)
    h, s_ = np.unravel_index(int(np.argmin(cost)), cost.shape)
    for i in range(n - 1, -1, -1):
        y[i] = h + lo_y
        if i == 0: break
        code = back[i, h, s_]; s_ = prev_s[i, h, s_]
        h = h - 1 if code == 1 else h + 1 if code == 2 else h
    return y


if __name__ == "__main__":
    pts = [(0, 0), (60, 10), (120, 60), (200, 70), (260, 140)]
    cells, si = trace(pts, [(0, 0, None), (120, 60, None), (260, 140, None)])
    for a, b in zip(cells, cells[1:]): assert max(abs(a[0] - b[0]), abs(a[1] - b[1])) == 1, (a, b)
    for a, b, c in zip(cells, cells[1:], cells[2:]): assert (_dir(b, c) - _dir(a, b)) % 8 in (0, 1, 7, 2, 6), (a, b, c)
    s = si[1]
    assert len({c[1] for c in cells[s - PLATFORM:s + PLATFORM + 1]}) == 1 or len({c[0] for c in cells[s - PLATFORM:s + PLATFORM + 1]}) == 1
    ground = [70 + 10 * math.sin(i / 40) for i in range(len(cells))]
    ys = profile(cells, ground, si)
    last = -9
    for i in range(1, len(ys)):
        if ys[i] != ys[i - 1]:
            assert abs(ys[i] - ys[i - 1]) == 1 and i - last >= 3; last = i
    ys2 = profile_dp(cells, ground, si)
    last = -9
    for i in range(1, len(ys2)):
        if ys2[i] != ys2[i - 1]:
            assert abs(ys2[i] - ys2[i - 1]) == 1 and i - last >= 3; last = i
    g1 = np.asarray(ground) + 1
    assert np.abs(ys2 - g1).sum() < np.abs(ys - g1).sum(), (np.abs(ys2 - g1).sum(), np.abs(ys - g1).sum())
    print("railplan: ALL OK", len(cells), "cells")
