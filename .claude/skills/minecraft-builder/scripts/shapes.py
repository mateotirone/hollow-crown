"""Shape primitives as maths. Each shape answers inside(P) for an (N, 3) array of points and gives a
bounding box. Units are blocks.

Coordinates: x east, y up, z south. Block (i, j, k) is the cube x in [i-0.5, i+0.5], y in [j, j+1],
z in [k-0.5, k+0.5]: integer x and z are block CENTRES (so a radius n+0.5 spans an odd 2n+1 blocks),
integer y is the FLOOR of a layer (a shape at y=0 stands on the ground). Boxes use inclusive block
indices instead: box min [0,0,0] max [4,2,4] is exactly those 5 x 3 x 5 blocks.
"""
import math
import numpy as np


def _v(a, n=3):
    a = list(a) if isinstance(a, (list, tuple)) else [a] * n
    return np.array(a, dtype=float)


def _rot_matrix(deg):
    rx, ry, rz = [math.radians(d) for d in _v(deg)]
    cx, sx, cy, sy, cz, sz = math.cos(rx), math.sin(rx), math.cos(ry), math.sin(ry), math.cos(rz), math.sin(rz)
    Rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    Rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return Rz @ Ry @ Rx


def _axis_frame(P, at, axis):
    """Local coords (u, v, w) with w along `axis` measured from `at`."""
    d = P - at
    if axis == "y": return d[:, 0], d[:, 2], d[:, 1]
    if axis == "x": return d[:, 2], d[:, 1], d[:, 0]
    return d[:, 0], d[:, 1], d[:, 2]


class Shape:
    def __init__(self, s):
        self.s = s
        self.kind = s["shape"]
        self.at = _v(s.get("at", [0, 0, 0]))
        self.R = _rot_matrix(s["rotate"]) if s.get("rotate") else None
        self.thick = s.get("thickness")
        self.lo, self.hi = self._bounds()
        if self.R is not None:   # rotated: bound by the sphere round the box
            c = (self.lo + self.hi) / 2; r = np.linalg.norm(self.hi - self.lo) / 2
            piv = self.at
            c2 = piv + self.R @ (c - piv)
            self.lo, self.hi = c2 - r, c2 + r

    # ---- bounds (continuous coords)
    def _bounds(self):
        s, a = self.s, self.at
        k = self.kind
        if k == "sphere": r = s["r"]; return a - r, a + r
        if k == "ellipsoid": r = _v(s["r"]); return a - r, a + r
        if k == "egg":
            R, H = s["R"], s["H"]; kk = s.get("k", 0.2); m = R * (1 + abs(kk)) * 1.1
            return a - [m, H, m], a + [m, H, m]
        if k in ("cylinder", "cone", "lathe"):
            ax = s.get("axis", "y")
            if k == "lathe":
                prof = s["profile"]; r = max(p[1] for p in prof); h0 = min(p[0] for p in prof); h1 = max(p[0] for p in prof)
            else:
                r = max(s["r"], s.get("r2", s["r"]) if k == "cylinder" else s["r"]); h0, h1 = 0, s["h"]
            lo, hi = np.array([-r, -r, -r]), np.array([r, r, r])
            i = "xyz".index(ax); lo[i], hi[i] = h0, h1
            return a + lo, a + hi
        if k == "torus":
            R, r = s["R"], s["r"]; ax = s.get("axis", "y")
            lo, hi = -np.array([R + r] * 3), np.array([R + r] * 3); i = "xyz".index(ax); lo[i], hi[i] = -r, r
            return a + lo, a + hi
        if k in ("box", "rounded_box"):
            mn, mx = _v(s["min"]), _v(s["max"])
            return mn - [0.5, 0, 0.5], mx + [0.5, 1, 0.5]
        if k == "arch":
            w, h, d = s["width"], s["height"], s.get("depth", 1); ax = s.get("axis", "x")
            if ax == "x": return a - [w / 2, 0, d / 2], a + [w / 2, h, d / 2]
            return a - [d / 2, 0, w / 2], a + [d / 2, h, w / 2]
        if k == "extrude":
            pts = np.array(s["points"], dtype=float); ax = s.get("axis", "z"); f, t = s["from"], s["to"]
            u0, v0 = pts.min(0); u1, v1 = pts.max(0)
            if ax == "z": return np.array([u0, v0, f - 0.5]), np.array([u1, v1, t + 0.5])
            if ax == "x": return np.array([f - 0.5, v0, u0]), np.array([t + 0.5, v1, u1])
            return np.array([u0, f, v0]), np.array([u1, t + 1, v1])
        if k == "plane": return np.array([-1e4] * 3), np.array([1e4] * 3)
        raise ValueError(f"unknown shape '{k}'")

    # ---- inside test
    def inside(self, P):
        if self.R is not None: P = self.at + (P - self.at) @ self.R   # inverse rotation (R orthonormal)
        m = self._inside(P)
        if self.thick:
            t = float(self.thick)
            dirs = np.array([[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
                             [1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1], [-1, 1, 1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1]], float)
            dirs /= np.linalg.norm(dirs, axis=1)[:, None]
            core = m.copy()
            for d in dirs:
                core &= self._inside(P + d * t)
            m = m & ~core
        return m

    def _inside(self, P):
        s, a, k = self.s, self.at, self.kind
        if k == "sphere": return np.sum((P - a) ** 2, 1) <= s["r"] ** 2
        if k == "ellipsoid": return np.sum(((P - a) / _v(s["r"])) ** 2, 1) <= 1
        if k == "egg":
            # r(t) = R * sqrt(1 - t^2) * (1 - k t), t = (y - centre) / H; k > 0 makes the bottom fatter
            R, H, kk = s["R"], s["H"], s.get("k", 0.2)
            t = (P[:, 1] - a[1]) / H
            rr = R * np.sqrt(np.clip(1 - t * t, 0, None)) * (1 - kk * t)
            return (np.abs(t) <= 1) & ((P[:, 0] - a[0]) ** 2 + (P[:, 2] - a[2]) ** 2 <= rr ** 2)
        if k in ("cylinder", "cone"):
            u, v, w = _axis_frame(P, a, s.get("axis", "y"))
            h = s["h"]; r0 = s["r"]; r1 = 0.0 if k == "cone" else s.get("r2", r0)
            t = np.clip(w / h, 0, 1); rr = r0 + (r1 - r0) * t
            return (w >= 0) & (w <= h) & (u * u + v * v <= rr * rr)
        if k == "lathe":
            u, v, w = _axis_frame(P, a, s.get("axis", "y"))
            prof = sorted(s["profile"]); ys = [p[0] for p in prof]; rs = [p[1] for p in prof]
            rr = np.interp(w, ys, rs, left=-1, right=-1)
            return (rr >= 0) & (u * u + v * v <= rr * rr)
        if k == "torus":
            u, v, w = _axis_frame(P, a, s.get("axis", "y"))
            q = np.sqrt(u * u + v * v) - s["R"]
            return q * q + w * w <= s["r"] ** 2
        if k == "box":
            return np.all((P >= self.lo) & (P <= self.hi), 1)
        if k == "rounded_box":
            c = (self.lo + self.hi) / 2; h = (self.hi - self.lo) / 2; r = s.get("radius", 1.0)
            q = np.abs(P - c) - (h - r)
            return np.linalg.norm(np.maximum(q, 0), axis=1) + np.minimum(q.max(1), 0) <= r
        if k == "arch":
            # the OPENING of an arch (subtract it from a wall): straight jambs, round or pointed head
            w, h, d = s["width"], s["height"], s.get("depth", 1); ax = s.get("axis", "x")
            dx = P[:, 0] - a[0] if ax == "x" else P[:, 2] - a[2]
            dz = P[:, 2] - a[2] if ax == "x" else P[:, 0] - a[0]
            y = P[:, 1] - a[1]; hw = w / 2
            inslab = np.abs(dz) <= d / 2
            if s.get("profile", "round") == "pointed":
                spring = h - hw * 1.6
                rr = hw * 1.6   # two arcs from points inside the opposite jamb
                left = (dx + hw - rr) ** 2 + (y - spring) ** 2 <= rr ** 2
                right = (dx - hw + rr) ** 2 + (y - spring) ** 2 <= rr ** 2
                head = (y >= spring) & left & right
            else:
                spring = h - hw
                head = (y >= spring) & (dx ** 2 + (y - spring) ** 2 <= hw ** 2)
            body = (y >= 0) & (y < spring) & (np.abs(dx) <= hw)
            return inslab & (body | head)
        if k == "extrude":
            pts = np.array(s["points"], dtype=float); ax = s.get("axis", "z"); f, t = s["from"], s["to"]
            if ax == "z": u, v, w, lo, hi = P[:, 0], P[:, 1], P[:, 2], f - 0.5, t + 0.5
            elif ax == "x": u, v, w, lo, hi = P[:, 2], P[:, 1], P[:, 0], f - 0.5, t + 0.5
            else: u, v, w, lo, hi = P[:, 0], P[:, 2], P[:, 1], f, t + 1
            return (w >= lo) & (w <= hi) & _in_poly(u, v, pts)
        if k == "plane":
            n = _v(s["normal"]); return (P - a) @ n <= 0
        raise ValueError(k)


def _in_poly(x, y, poly):
    inside = np.zeros(len(x), bool)
    n = len(poly)
    for i in range(n):
        x0, y0 = poly[i]; x1, y1 = poly[(i + 1) % n]
        cond = ((y0 > y) != (y1 > y))
        xi = (x1 - x0) * (y - y0) / ((y1 - y0) if y1 != y0 else 1e-12) + x0
        inside ^= cond & (x < xi)
    return inside
