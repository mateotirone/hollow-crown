#!/usr/bin/env python3
"""Route the rail lines the way 19th-century railways were laid out (Mateo 2026-11-12): each line takes its own most
efficient way between stations, separate from the roads; it keeps its gradients gentle by following valleys and
winding along hillsides, takes long sweeping curves, and only cuts, embanks, bridges or tunnels where the land
leaves no cheaper way. Stations sit at the edge of a town, never through it.

Pure (numpy only). map/genworld.py calls route() per pair of neighbouring stops; railplan.trace() then rasters the
result with straight platforms and railplan.profile_dp() sets the heights.

    pts = route(H, wet, blocked, a, a_dir, b, b_dir)     # block (x, z) control points from a to b

H: ground height per cell (2D, index [x - X0, z - Z0]); wet: water mask; blocked: cells the line may not enter
(towns, plots, the sea); a, b: platform ends in grid cells; a_dir: unit (dx, dz) the line leaves a by; b_dir:
the direction it arrives at b in. Run this file to self-test.
"""
import heapq
import math
import numpy as np

G = 6                                   # coarse grid step in blocks
# 16 headings as small integer steps on the coarse grid; one step turns at most one heading (22.5 degrees), so the
# tightest curve has a radius of about 2.6 coarse steps (~40 blocks)
HEAD = [(0, -2), (1, -2), (1, -1), (2, -1), (2, 0), (2, 1), (1, 1), (1, 2),
        (0, 2), (-1, 2), (-1, 1), (-2, 1), (-2, 0), (-2, -1), (-1, -1), (-1, -2)]
RULING = 1 / 14                         # gradient the line may climb freely (gentle; tracks allow up to 1 in 3)
W_GRADE = 9.0                           # cost per block of climb beyond the ruling gradient (cutting / embankment)
W_WATER = 5.0                           # extra cost per block over water (bridge)
W_TURN = 2.5                            # cost per heading change (prefers long straights and gentle curves)


def head_of(d):
    """Nearest of the 16 headings to a direction (dx, dz)."""
    a = math.atan2(d[1], d[0])
    return min(range(16), key=lambda h: abs(math.remainder(a - math.atan2(HEAD[h][1], HEAD[h][0]), math.tau)))


def route(H, wet, blocked, a, a_dir, b, b_dir, g=G, max_nodes=600_000, with_cost=False):
    """Least-cost path from a to b on a coarse grid with heading in the state. Returns block cells [(x, z), ...] in
    grid coordinates (same indexing as H), from a to b."""
    SX, SZ = H.shape
    nx, nz = (SX + g - 1) // g, (SZ + g - 1) // g
    Hc = H[::g, ::g].astype(np.float32)[:nx, :nz]
    Wc = wet[::g, ::g][:nx, :nz]
    # a coarse cell is blocked if any block of it is
    Bp = np.pad(blocked, ((0, nx * g - SX), (0, nz * g - SZ)), constant_values=True)
    Bc = Bp.reshape(nx, g, nz, g).any(axis=(1, 3))
    sa = (int(round(a[0] / g)), int(round(a[1] / g))); sb = (int(round(b[0] / g)), int(round(b[1] / g)))
    ha, hb = head_of(a_dir), head_of(b_dir)
    for c in (sa, sb):                                          # the ends themselves are always enterable
        for dx in range(-2, 3):
            for dz in range(-2, 3):
                if 0 <= c[0] + dx < nx and 0 <= c[1] + dz < nz: Bc[c[0] + dx, c[1] + dz] = False
    L = [math.hypot(*HEAD[h]) * g for h in range(16)]
    def heur(c): return math.hypot(c[0] - sb[0], c[1] - sb[1]) * g
    start = (sa[0], sa[1], ha)
    best = {start: 0.0}; prev = {}
    pq = [(heur(sa), 0.0, start)]
    n = 0; goal = None
    while pq:
        f, cst, s = heapq.heappop(pq)
        if cst > best.get(s, 1e18) + 1e-9: continue
        x, z, h = s
        if (x, z) == sb and min((h - hb) % 16, (hb - h) % 16) <= 1: goal = s; break
        n += 1
        if n > max_nodes: break
        for dh in (-1, 0, 1):
            h2 = (h + dh) % 16; dx, dz = HEAD[h2]; x2, z2 = x + dx, z + dz
            if not (0 <= x2 < nx and 0 <= z2 < nz) or Bc[x2, z2]: continue
            # the cells crossed by this step (two coarse steps along a (2, 1) heading cross a middle cell too)
            mx, mz = x + (dx + (1 if dx > 0 else -1 if dx < 0 else 0)) // 2, z + (dz + (1 if dz > 0 else -1 if dz < 0 else 0)) // 2
            if Bc[mx, mz]: continue
            climb = abs(float(Hc[x2, z2]) - float(Hc[x, z]))
            over = max(0.0, climb - L[h2] * RULING)
            wetn = (int(Wc[x2, z2]) + int(Wc[mx, mz])) / 2
            c2 = cst + L[h2] + W_GRADE * over + W_WATER * wetn * L[h2] + W_TURN * abs(dh)
            s2 = (x2, z2, h2)
            if c2 < best.get(s2, 1e18):
                best[s2] = c2; prev[s2] = s
                heapq.heappush(pq, (c2 + heur((x2, z2)), c2, s2))
    if goal is None: return (None, math.inf) if with_cost else None
    cells = []
    s = goal
    while s in prev: cells.append((s[0] * g, s[1] * g)); s = prev[s]
    cells.append((s[0] * g, s[1] * g)); cells.reverse()
    pts = chaikin([tuple(a)] + cells[1:-1] + [tuple(b)], 2)
    return (pts, best[goal]) if with_cost else pts


def chaikin(pts, n):
    """Round the corners of a polyline (keeps both ends)."""
    for _ in range(n):
        out = [pts[0]]
        for p, q in zip(pts, pts[1:]):
            out += [(0.75 * p[0] + 0.25 * q[0], 0.75 * p[1] + 0.25 * q[1]), (0.25 * p[0] + 0.75 * q[0], 0.25 * p[1] + 0.75 * q[1])]
        out.append(pts[-1]); pts = out
    return pts


PLATFORM = 23


def _disc(mask, X0, Z0, x, z, r):
    S0, S1 = mask.shape
    a0, a1 = max(0, x - r - X0), min(S0, x + r - X0 + 1); c0, c1 = max(0, z - r - Z0), min(S1, z + r - Z0 + 1)
    if a0 >= a1 or c0 >= c1: return
    gx, gz = np.meshgrid(np.arange(a0, a1) + X0, np.arange(c0, c1) + Z0, indexing="ij")
    mask[a0:a1, c0:c1] |= (gx - x) ** 2 + (gz - z) ** 2 <= r * r


def plan_network(H, wet, land, X0, Z0, stops, seq, towns, avoid, log=print, termini=()):
    """Place the stations and route every line.

    stops: {sid: {"x", "z"}}; seq: {line: [sid, ...]} in travel order; towns: [(sid, x, z, R)] towns whose station
    goes on their edge (R = how far out their buildings reach; nothing of the line comes inside R); avoid: [(x, z, r)]
    more discs the line keeps out of (plots, story sites). Every other stop keeps its spot and only picks its platform
    axis. termini: stops where every line comes and goes from the same platform end (axis "+x", "-x", "+z" or "-z":
    the direction trains leave by); buffer stops close the other end. Returns (pos {sid: (x, z, axis)}, lines {line: [(x, z), ...] control points through every stop}).
    """
    S0, S1 = H.shape
    blocked = ~land
    for _, x, z, r in towns: _disc(blocked, X0, Z0, x, z, r)
    for x, z, r in avoid: _disc(blocked, X0, Z0, x, z, r)
    def h(x, z): return float(H[min(max(x - X0, 0), S0 - 1), min(max(z - Z0, 0), S1 - 1)])
    def free_platform(x, z, ax, m=3):
        for t in range(-PLATFORM - 3, PLATFORM + 4):
            for w in range(-m, m + 1):
                qx, qz = (x + t, z + w) if ax == "x" else (x + w, z + t)
                i, k = qx - X0, qz - Z0
                if not (0 <= i < S0 and 0 <= k < S1) or blocked[i, k] or wet[i, k]: return False
        return True
    def plat_cost(x, z, ax):
        hs = [h(x + t, z) if ax == "x" else h(x, z + t) for t in range(-PLATFORM, PLATFORM + 1)]
        return float(np.std(hs)) * 15 + (max(hs) - min(hs)) * 3
    cand = {}
    tmap = {sid: (x, z, r) for sid, x, z, r in towns}
    for sid, st in stops.items():
        if sid in tmap:                                     # a station on the town's edge, its platform clear of it
            tx, tz, r = tmap[sid]; cs = []
            for a in range(0, 360, 15):
                th = math.radians(a)
                for ax in "xz":
                    for rr in range(r + 4, r + 60, 3):
                        x, z = int(tx + rr * math.cos(th)), int(tz + rr * math.sin(th))
                        if free_platform(x, z, ax): cs.append((plat_cost(x, z, ax) + (rr - r) * 1.5, (x, z, ax))); break
            cs.sort(); cand[sid] = [c for _, c in cs[:24]] or [(st["x"], st["z"], "x")]
            if sid in termini: cand[sid] = [(x, z, sg + ax) for x, z, ax in cand[sid][:12] for sg in "+-"]
        else:
            cand[sid] = [(st["x"], st["z"], ax) for ax in "xz"]
    def unit(ax): return (1, 0) if ax == "x" else (0, 1)
    def travel(ln, i, pos):
        q = seq[ln]; x, z, ax = pos[q[i]]
        if len(ax) == 2:                                    # a terminus: leave by its open end, arrive into it
            u = unit(ax[1]); u = u if ax[0] == "+" else (-u[0], -u[1])
            return u if i == 0 else (-u[0], -u[1])
        u = unit(ax)
        p = pos[q[i - 1]] if i > 0 else (x, z); n = pos[q[i + 1]] if i < len(q) - 1 else (x, z)
        return u if (n[0] - p[0]) * u[0] + (n[1] - p[1]) * u[1] >= 0 else (-u[0], -u[1])
    cache = {}
    def seg(pa, ua, pb, ub):
        key = (pa, ua, pb, ub)
        if key not in cache:
            A = (pa[0] + ua[0] * (PLATFORM + 2) - X0, pa[1] + ua[1] * (PLATFORM + 2) - Z0)
            B = (pb[0] - ub[0] * (PLATFORM + 2) - X0, pb[1] - ub[1] * (PLATFORM + 2) - Z0)
            if not all(0 <= q[0] < S0 and 0 <= q[1] < S1 for q in (A, B)): cache[key] = (None, 1e9)
            else:
                pts, c = route(H, wet, blocked, A, ua, B, ub, with_cost=True)
                cache[key] = (pts, c if pts else 1e9)
        return cache[key]
    def total(pos, lines):
        return sum(seg(pos[seq[ln][i]], travel(ln, i, pos), pos[seq[ln][i + 1]], travel(ln, i + 1, pos))[1]
                   for ln in lines for i in range(len(seq[ln]) - 1))
    pos = {s: c[0] for s, c in cand.items()}
    for it in range(4):                                     # each station in turn takes its cheapest spot
        changed = 0
        for sid in cand:
            lines = [ln for ln, q in seq.items() if sid in q]
            was = pos[sid]; best = (total(pos, lines), was)
            for c in cand[sid]:
                pos[sid] = c; t = total(pos, lines)
                if t < best[0] - 1e-6: best = (t, c)
            changed += best[1] != was; pos[sid] = best[1]
        log("rail network pass", it, "cost", round(total(pos, seq)), "stations moved", changed)
        if not changed: break
    lines = {}
    for ln, q in seq.items():
        pts = []
        for i in range(len(q) - 1):
            pa, pb = pos[q[i]], pos[q[i + 1]]
            r, c = seg(pa, travel(ln, i, pos), pb, travel(ln, i + 1, pos))
            if r is None: log("rail: no route", ln, q[i], q[i + 1]); r = []
            part = [pa[:2]] + [(x + X0, z + Z0) for x, z in r] + [pb[:2]]
            pts += part if not pts else part[1:]
        lines[ln] = pts
    return pos, lines


def _selftest():
    # a ridge between a and b with a low pass to the south: the line should take the pass, not climb the ridge
    S = 240
    H = np.full((S, S), 64.0)
    xs = np.arange(S)
    for z in range(S):
        H[110:130, z] = 64 + 40 * (abs(z - 180) > 12)
    wet = np.zeros((S, S), bool); blocked = np.zeros((S, S), bool)
    pts = route(H, wet, blocked, (20, 60), (1, 0), (220, 60), (1, 0))
    assert pts is not None
    zs_at_ridge = [p[1] for p in pts if 110 <= p[0] <= 130]
    assert min(zs_at_ridge) > 160, zs_at_ridge                 # went round through the pass
    # flat ground: nearly straight
    H2 = np.full((S, S), 64.0)
    pts = route(H2, wet, blocked, (20, 60), (1, 0), (220, 60), (1, 0))
    assert max(abs(p[1] - 60) for p in pts) <= 6
    # a blocked town in the way is skirted
    bl = np.zeros((S, S), bool); yy, xx = np.mgrid[0:S, 0:S]; bl[((xx - 60) ** 2 + (yy - 120) ** 2).T < 40 ** 2] = True
    pts = route(H2, wet, bl, (20, 60), (1, 0), (220, 60), (1, 0))
    assert not any(bl[int(round(x)), int(round(z))] for x, z in pts)
    print("railroute: ALL OK")


if __name__ == "__main__":
    _selftest()
