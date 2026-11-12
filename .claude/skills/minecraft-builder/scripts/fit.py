"""Voxelize shapes and fit the best block to every cell.

Each block is supersampled with q x q x q points (q = 4 by default: 2 x 2 x 2 per octant). The sample
pattern is compared with the masks of every block form: air, full, bottom/top slab, stairs (4 facings,
upright or upside down, straight or inner/outer corner) and, for thin edges, trapdoors (flat or
standing) and posts (wall / fence). The form with the fewest mismatching samples wins, with a small
penalty per form so ties go to the simpler block (stairs win ties against slabs, so 45-degree faces read
as stairs). Then interior full blocks are dropped to leave a hollow shell.
"""
import numpy as np
from shapes import Shape

DIRS = {"n": (0, 0, -1), "s": (0, 0, 1), "e": (1, 0, 0), "w": (-1, 0, 0)}
LEFT = {"n": "w", "w": "s", "s": "e", "e": "n"}
OPP = {"n": "s", "s": "n", "e": "w", "w": "e"}


def _side_mask(q, f):
    a = np.arange(q)
    X, Y, Z = np.meshgrid(a, a, a, indexing="ij")
    h = q // 2
    return {"n": Z < h, "s": Z >= h, "e": X >= h, "w": X < h}[f], Y


def candidates(q, thin=True):
    """[(name, kind, props, mask(q^3 bool), penalty)]"""
    a = np.arange(q); X, Y, Z = np.meshgrid(a, a, a, indexing="ij"); h = q // 2
    lower, upper = Y < h, Y >= h
    side = {"n": Z < h, "s": Z >= h, "e": X >= h, "w": X < h}
    out = [("air", "air", {}, np.zeros_like(lower), 0.0), ("full", "full", {}, np.ones_like(lower), 0.0),
           ("slab_b", "slab", {"half": "bottom"}, lower, 1.0), ("slab_t", "slab", {"half": "top"}, upper, 1.0)]
    for f in "nsew":
        L = LEFT[f]
        for half, base, cap in (("bottom", lower, upper), ("top", upper, lower)):
            out.append((f"stairs_{f}_{half}", "stairs", {"facing": f, "half": half}, base | (cap & side[f]), 0.5))
            out.append((f"outer_l_{f}_{half}", "stairs", {"facing": f, "half": half, "corner": "outer_left"}, base | (cap & side[f] & side[L]), 0.9))
            out.append((f"outer_r_{f}_{half}", "stairs", {"facing": f, "half": half, "corner": "outer_right"}, base | (cap & side[f] & side[OPP[L]]), 0.9))
            out.append((f"inner_l_{f}_{half}", "stairs", {"facing": f, "half": half, "corner": "inner_left"}, base | (cap & (side[f] | side[L])), 0.9))
            out.append((f"inner_r_{f}_{half}", "stairs", {"facing": f, "half": half, "corner": "inner_right"}, base | (cap & (side[f] | side[OPP[L]])), 0.9))
    if thin:
        t = max(1, q // 4)
        out.append(("trap_b", "trapdoor", {"half": "bottom"}, Y < t, 3.0))
        out.append(("trap_t", "trapdoor", {"half": "top"}, Y >= q - t, 3.0))
        for f, m in (("s", Z < t), ("n", Z >= q - t), ("w", X >= q - t), ("e", X < t)):   # open: panel opposite the facing
            out.append((f"trap_o_{f}", "trapdoor", {"open": True, "facing": f}, m, 3.0))
        c0, c1 = q // 4, q - q // 4
        out.append(("post", "post", {}, (X >= c0) & (X < c1) & (Z >= c0) & (Z < c1), 3.0))
    return out


def voxelize(ops, q=4, thin=True, hollow=1, log=None, vertical_tol=0.2, smooth=True):
    """ops: list of {'op': add|sub|intersect|paint, 'shape': ..., 'material': name}.
    Returns {(x,y,z): {'kind', 'props', 'mat'}}."""
    shapes = [(o.get("op", "add"), Shape(o), o.get("material")) for o in ops]
    adds = [s for op, s, _ in shapes if op == "add"]
    if not adds: return {}
    lo = np.min([s.lo for s in adds], 0); hi = np.max([s.hi for s in adds], 0)
    x0, x1 = int(np.floor(lo[0] + 0.5)), int(np.ceil(hi[0] - 0.5))
    z0, z1 = int(np.floor(lo[2] + 0.5)), int(np.ceil(hi[2] - 0.5))
    y0, y1 = int(np.floor(lo[1])), int(np.ceil(hi[1])) - 1
    mats = {}
    for _, _, m in shapes:
        if m and m not in mats: mats[m] = len(mats) + 1
    inv = {v: k for k, v in mats.items()}
    cand = candidates(q, thin)
    M = np.stack([c[3].reshape(-1) for c in cand]).astype(np.float32)        # C x q^3
    pen = np.array([c[4] for c in cand], np.float32)
    nx, nz = x1 - x0 + 1, z1 - z0 + 1
    off = (np.arange(q) + 0.5) / q
    eps = np.array([1.3e-3, 0.7e-3, 1.1e-3])         # keep samples off exact shape boundaries
    gx, gz = np.arange(x0, x1 + 1), np.arange(z0, z1 + 1)
    # sample points for one layer: (nx, nz, qx, qy, qz)
    PX = gx[:, None, None, None, None] - 0.5 + off[None, None, :, None, None]
    PZ = gz[None, :, None, None, None] - 0.5 + off[None, None, None, None, :]
    shape5 = (nx, nz, q, q, q)
    PX = np.broadcast_to(PX, shape5).reshape(-1); PZ = np.broadcast_to(PZ, shape5).reshape(-1)
    OY = np.broadcast_to(off[None, None, None, :, None], shape5).reshape(-1)
    cells = {}
    frac = {}
    for y in range(y0, y1 + 1):
        P = np.stack([PX, y + OY, PZ], 1) + eps
        mat = np.zeros(len(P), np.int16)
        for op, s, m in shapes:
            if s.hi[1] < y or s.lo[1] > y + 1:
                if op == "intersect": mat[:] = 0
                continue
            ins = s.inside(P)
            if op == "add": mat[ins] = mats[m]
            elif op == "sub": mat[ins] = 0
            elif op == "intersect": mat[~ins] = 0
            elif op == "paint" and m: mat[ins & (mat > 0)] = mats[m]
        occ = (mat > 0).reshape(nx * nz, q * q * q).astype(np.float32)
        nfill = occ.sum(1)
        live = np.nonzero(nfill > 0)[0]
        if len(live) == 0: continue
        o = occ[live]
        err = o.sum(1, keepdims=True) + M.sum(1)[None, :] - 2 * o @ M.T + pen[None, :]
        best = err.argmin(1)
        # A fill that does not change from the lower half to the upper half is a vertical face: stairs or
        # slabs there only add ledges and holes. Those cells are full or air by how full they are.
        oy = o.reshape(-1, q, q, q)
        fb = oy[:, :, : q // 2, :].reshape(len(o), -1).mean(1); ft = oy[:, :, q // 2:, :].reshape(len(o), -1).mean(1)
        vert = np.abs(fb - ft) < vertical_tol
        if vert.any():
            best[vert] = np.where(o[vert].mean(1) >= 0.5, 1, 0)      # index 1 = full, 0 = air
        fill = o.mean(1)
        for j, (li, b) in enumerate(zip(live, best)):
            c = cand[b]
            ix, iz = divmod(int(li), nz)
            key = (x0 + ix, y, z0 + iz)
            mv = mat.reshape(nx * nz, -1)[li]
            mv = mv[mv > 0]
            mname = inv[int(np.bincount(mv).argmax())] if len(mv) else None
            frac[key] = (float(fill[j]), float(fb[j]), float(ft[j]), mname)
            if c[1] == "air": continue
            cells[key] = {"kind": c[1], "props": dict(c[2]), "mat": mname, "src": "shape"}
    if smooth: _smooth_surfaces(cells, frac, log)
    full_mask = {k: True for k, v in cells.items() if v["kind"] == "full"}
    if hollow:
        n = int(hollow)
        solid = set(full_mask)
        core = set()
        for (x, y, z) in solid:
            if all((x + dx, y + dy, z + dz) in solid for dx, dy, dz in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1))):
                core.add((x, y, z))
        for _ in range(n - 1):     # thicker shell: peel the core back further
            core = {c for c in core if all((c[0] + dx, c[1] + dy, c[2] + dz) in core for dx, dy, dz in
                                           ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)))}
        for c in core: del cells[c]
        if log is not None: log.append(f"hollow: {len(core)} interior blocks left out")
    return cells


def _smooth_surfaces(cells, frac, log=None):
    """Roof-like surfaces (domes, cones, roofs, egg tops and bottoms) as a height field, the way builders
    smooth them: per column, the surface height inside the top cell decides full / slab / stairs, and
    stairs face the higher neighbouring column (inner corners in hollows, outer corners on ridges).
    Undersides get the same treatment upside down."""
    F = lambda x, y, z: frac.get((x, y, z), (0.0,))[0]
    changed = 0
    for (x, y, z), (f, fb, ft, m) in list(frac.items()):
        if f < 0.05: continue
        top = F(x, y + 1, z) < 0.15 and fb - ft >= 0.2          # an upward-facing surface cell
        bot = F(x, y - 1, z) < 0.15 and ft - fb >= 0.2          # a downward-facing one
        if not (top or bot): continue
        col = lambda a, b: sum(F(a, y + k, b) for k in (-1, 0, 1))
        if top:
            h = col(x, z)
            hi = {d: col(x + dx, z + dz) - h for d, (dx, _, dz) in zip("nsew", ((0, 0, -1), (0, 0, 1), (1, 0, 0), (-1, 0, 0)))}
            fr = f
        else:
            h = col(x, z)
            hi = {d: col(x + dx, z + dz) - h for d, (dx, _, dz) in zip("nsew", ((0, 0, -1), (0, 0, 1), (1, 0, 0), (-1, 0, 0)))}
            fr = f
        half = "bottom" if top else "top"
        if fr >= 0.8: new = ("full", {})
        elif fr < 0.2: new = None
        else:
            up = [d for d, v in sorted(hi.items(), key=lambda kv: -kv[1]) if v >= 0.35]
            if not up: new = ("slab", {"half": half})
            else:
                f0 = up[0]; corner = "none"
                if len(up) >= 2 and up[1] != OPP[f0]:
                    corner = "inner_left" if up[1] == LEFT[f0] else "inner_right"
                else:
                    # outer corner: the higher side, and one neighbour along it is clearly lower
                    side = [d for d in (LEFT[f0], OPP[LEFT[f0]]) if hi[d] <= -0.35]
                    if len(side) == 1: corner = "outer_right" if side[0] == LEFT[f0] else "outer_left"
                new = ("stairs", {"facing": f0, "half": half, "corner": corner})
        old = cells.get((x, y, z))
        if new is None:
            if old: del cells[(x, y, z)]; changed += 1
            continue
        if old is None or old["kind"] != new[0] or old["props"] != new[1]:
            cells[(x, y, z)] = {"kind": new[0], "props": new[1], "mat": m, "src": "shape"}; changed += 1
    if log is not None and changed: log.append(f"smoothed {changed} surface cells as a height field")
