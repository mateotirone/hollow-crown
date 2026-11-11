"""Tree grower: a species card + a size + a seed -> a Blueprint of one tree.

Built bottom to top in the stages of build-instructions/10-trees/README.md:
ground and roots -> trunk (core + bark depth) -> limbs (logs -> walls -> fences) ->
canopy (leaf clumps at the limb tips, mixed leaves) -> drape (hanging leaves, vines, moss) -> snow.

Coordinates as in map/structures/bp.py: x east, y up, z south, y = 0 is the ground surface,
the tree stands on it from y = 1, the trunk centre is x = z = 0.
"""
import math, os, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "structures"))
from bp import Blueprint, DIRS, OPP

H4 = [("e", 1, 0), ("w", -1, 0), ("s", 0, 1), ("n", 0, -1)]
VINE_BIT = {"s": 1, "w": 2, "n": 4, "e": 8}      # the face of the vine's own cell it clings to


def unit(v):
    n = math.sqrt(sum(c * c for c in v)) or 1.0
    return [c / n for c in v]


def axis_of(d):
    ax, ay, az = abs(d[0]), abs(d[1]), abs(d[2])
    if ay >= 0.55 * math.sqrt(ax * ax + ay * ay + az * az): return "y"
    return "x" if ax >= az else "z"


class Grower:
    # wood ranks: 4 thick (trunk/limb sphere), 3 one-block log, 2 wall, 1 fence
    def __init__(self, card, size, seed):
        self.c = card; self.s = dict(card["sizes"][size]); self.size = size
        self.rg = np.random.default_rng(seed)
        self.wood = {}      # cell -> [rank, part, axis]
        self.leaf = {}      # cell -> leaf block name
        self.deco = {}      # cell -> (name, props)  bark, roots, drape, ground
        self.tips = []      # limb tips (for clumps)

    # ------------------------------------------------------------------ helpers
    def r(self, a, b): return a + (b - a) * self.rg.random()

    def put_wood(self, cell, rank, part, axis):
        if cell[1] < 0: return
        old = self.wood.get(cell)
        if old is None or rank > old[0] or (rank == old[0] and part == "trunk"):
            self.wood[cell] = [rank, part, axis]

    def segment(self, p0, p1, r0, r1, part):
        """Rasterise a tapered limb. Thick parts are filled spheres of log; thin parts are a single
        6-connected line of log, wall or fence, so walls and fences always join up."""
        d = [p1[i] - p0[i] for i in range(3)]; L = math.sqrt(sum(c * c for c in d)) or 1e-6
        ax = axis_of(d); n = max(1, int(math.ceil(L / 0.2))); prev = None
        for i in range(n + 1):
            t = i / n; P = [p0[k] + d[k] * t for k in range(3)]; rad = r0 + (r1 - r0) * t
            if rad >= 0.75:
                R = int(math.ceil(rad + 0.2))
                for dx in range(-R, R + 1):
                    for dy in range(-R, R + 1):
                        for dz in range(-R, R + 1):
                            c = (round(P[0]) + dx, round(P[1]) + dy, round(P[2]) + dz)
                            if math.dist(c, P) <= rad + 0.1: self.put_wood(c, 4, part, ax if part != "trunk" else "y")
                prev = (round(P[0]), round(P[1]), round(P[2])); continue
            rank = 3 if rad >= 0.45 else (2 if rad >= 0.28 else 1)
            c = (round(P[0]), round(P[1]), round(P[2]))
            if prev is not None and c != prev:
                # step one axis at a time (horizontal first) so there are no diagonal-only joins
                cur = list(prev)
                for k in (0, 2, 1):
                    while cur[k] != c[k]:
                        cur[k] += 1 if c[k] > cur[k] else -1
                        self.put_wood(tuple(cur), rank, part, ax)
            else: self.put_wood(c, rank, part, ax)
            prev = c

    # ------------------------------------------------------------------ trunk
    def trunk(self):
        s, c = self.s, self.c
        H = s["h"]; ht = int(round(H * s.get("trunk", 0.6)))
        lean = unit([self.r(-1, 1), 0, self.r(-1, 1)]); lean_amt = s.get("lean", 0.0) * self.r(0.4, 1.0)
        x = z = 0.0; pts = []
        for y in range(1, ht + 1):
            t = (y - 1) / max(1, ht - 1)
            if y > 2:
                x += lean[0] * lean_amt + self.r(-1, 1) * s.get("wander", 0.15)
                z += lean[2] * lean_amt + self.r(-1, 1) * s.get("wander", 0.15)
            r = s["r0"] + (s["r1"] - s["r0"]) * t + s.get("flare", 0.0) * max(0.0, 1 - (y - 1) / 2.5)
            pts.append(([x, y, z], r))
        for (p0, r0), (p1, r1) in zip(pts, pts[1:]): self.segment(p0, p1, r0, r1, "trunk")
        if len(pts) == 1: self.segment(pts[0][0], pts[0][0], pts[0][1], pts[0][1], "trunk")
        self.trunk_pts = pts; self.ht = ht

    def trunk_at(self, y):
        best = min(self.trunk_pts, key=lambda q: abs(q[0][1] - y))
        return list(best[0]), best[1]

    # ------------------------------------------------------------------ broadleaf limbs
    def limb(self, P, d, L, r, depth):
        s = self.s; seg = s.get("seg", 2.0); left = L
        while left > 0.3:
            step = min(seg, left)
            d = unit([d[0] + self.r(-1, 1) * s.get("wobble", 0.25), d[1] + s.get("curve", 0.12) + self.r(-1, 1) * s.get("wobble", 0.25) * 0.5,
                      d[2] + self.r(-1, 1) * s.get("wobble", 0.25)])
            Q = [P[k] + d[k] * step for k in range(3)]
            r1 = max(0.12, r * (1 - step / max(L, 1e-6) * s.get("taper", 0.75)))
            self.segment(P, Q, r, r1, "limb")
            left -= step; P, r = Q, r1
            if depth < s.get("depth", 2) and left > 1.5 and self.rg.random() < s.get("fork", 0.5):
                a = math.radians(self.r(25, 55)) * (1 if self.rg.random() < 0.5 else -1)
                cd = [d[0] * math.cos(a) - d[2] * math.sin(a), d[1] + self.r(-0.1, 0.3), d[0] * math.sin(a) + d[2] * math.cos(a)]
                self.limb(list(P), unit(cd), left * self.r(0.5, 0.8), r * 0.7, depth + 1)
        self.tips.append((P, depth))

    def broadleaf(self):
        s = self.s; H = s["h"]
        n = s["limbs"]; base = self.r(0, 6.28)
        for i in range(n):
            az = base + i * 2.39996 + self.r(-0.3, 0.3)                      # golden angle spread
            y0 = self.ht * self.r(s.get("split", 0.55), 1.0)
            P, rt = self.trunk_at(y0)
            el = math.radians(self.r(*s.get("elev", (20, 50))))
            d = [math.cos(az) * math.cos(el), math.sin(el), math.sin(az) * math.cos(el)]
            L = s["reach"] * self.r(0.75, 1.1)
            self.limb(P, d, L, max(0.3, rt * s.get("limb_r", 0.7)), 0)
        # a leader keeps the crown's middle full
        P, rt = self.trunk_at(self.ht)
        self.limb(P, unit([self.r(-0.2, 0.2), 1, self.r(-0.2, 0.2)]), (H - self.ht) * 0.8 + 1, max(0.3, rt * 0.6), 1)
        cr = s["clump"]
        for P, depth in self.tips:
            self.clump(P, cr * self.r(0.8, 1.15) * (1 if depth < 2 else 0.85))
        # small clumps along the outer half of every limb so the crown reads as many clumps, not one ball
        for (x, y, z), (rank, part, ax) in list(self.wood.items()):
            if part == "limb" and rank <= 2 and self.rg.random() < s.get("twig_leaf", 0.12):
                self.clump([x, y, z], max(1.0, cr * 0.5))

    def clump(self, P, cr):
        s, c = self.s, self.c
        rx = cr; ry = max(1.0, cr * s.get("flat", 0.6)); cy = P[1] + ry * 0.35
        R = int(math.ceil(cr + 1)); jit = s.get("jitter", 0.35)
        for dx in range(-R, R + 1):
            for dy in range(-int(ry) - 1, int(ry) + 2):
                for dz in range(-R, R + 1):
                    cell = (round(P[0]) + dx, round(cy) + dy, round(P[2]) + dz)
                    ryy = ry if cell[1] >= cy else ry * s.get("under", 0.6)
                    q = math.sqrt(((cell[0] - P[0]) / rx) ** 2 + ((cell[1] - cy) / ryy) ** 2 + ((cell[2] - P[2]) / rx) ** 2)
                    if q + (self.rg.random() - 0.5) * jit * 2 < 1.0 and cell[1] >= 2:
                        self.leaf[cell] = self.pick_leaf((cell[1] - cy) / ry)

    def pick_leaf(self, rel):
        """rel = -1 bottom .. +1 top of a clump: light leaves on top, dark below, accents scattered."""
        L = self.c["leaves"]; u = self.rg.random()
        if "accent" in L and u < L.get("accent_p", 0.06): return L["accent"]
        if "light" in L and rel + self.r(-0.35, 0.35) > 0.45: return L["light"]
        if "dark" in L and rel + self.r(-0.35, 0.35) < -0.45: return L["dark"]
        return L["main"]

    # ------------------------------------------------------------------ conifer (whorls and tiers)
    def conifer(self):
        s = self.s; H = s["h"]; top = H
        # trunk carries on as a thin leader to the top
        P, rt = self.trunk_at(self.ht)
        self.segment(P, [P[0], top - 1, P[2]], max(0.3, rt), 0.45, "trunk")
        y = H * s.get("crown", 0.35); gap = s.get("whorl", 2.0)
        while y < top - 1.5:
            t = (y - H * s.get("crown", 0.35)) / max(1e-6, top - H * s.get("crown", 0.35))   # 0 bottom of crown .. 1 top
            reach = s["reach"] * (1 - t) ** s.get("cone", 1.0) + 1.0
            C, rr = self.trunk_at(y); C = [C[0], y, C[2]]
            if s.get("disc"):
                dr = reach * s["disc"]; R = int(math.ceil(dr))
                for dx in range(-R, R + 1):
                    for dz in range(-R, R + 1):
                        q = math.hypot(dx, dz)
                        if q <= dr + self.rg.random() * 0.9 - 0.3:
                            cell = (round(C[0]) + dx, round(y), round(C[2]) + dz)
                            self.leaf[cell] = self.pick_leaf(0.3)
                            if q < dr * 0.55: self.leaf[(cell[0], cell[1] + 1, cell[2])] = self.pick_leaf(0.8)
                            elif q > dr - 1.2 and self.rg.random() < 0.45: self.leaf[(cell[0], cell[1] - 1, cell[2])] = self.pick_leaf(-0.8)
            k = s.get("arms", 5); a0 = self.r(0, 6.28)
            for i in range(k):
                az = a0 + i * 6.283 / k + self.r(-0.35, 0.35); L = reach * self.r(0.7, 1.1)
                if L < 1.2: continue
                droop = s.get("droop", 0.25)
                d = unit([math.cos(az), self.r(-0.05, 0.15), math.sin(az)])
                Pm = [C[k2] + d[k2] * L * 0.6 for k2 in range(3)]
                Q = [C[0] + d[0] * L, C[1] + d[1] * L - droop * L * 0.5, C[2] + d[2] * L]
                self.segment(C, Pm, max(0.3, rr * 0.55), 0.3, "limb"); self.segment(Pm, Q, 0.3, 0.15, "limb")
                self.pad(C, Pm, Q)
            y += gap * self.r(0.85, 1.25)
        # spire
        for dy in range(s.get("spire", 2)):
            self.leaf[(round(P[0]), top + dy, round(P[2]))] = self.pick_leaf(1)
        self.leaf[(round(P[0]), top - 1, round(P[2]))] = self.pick_leaf(1)
        for (_, dx, dz) in H4:
            if self.rg.random() < 0.8: self.leaf[(round(P[0]) + dx, top - 1, round(P[2]) + dz)] = self.pick_leaf(0.6)

    def pad(self, C, Pm, Q):
        """Leaves along a conifer branch: a flat spray, thicker toward the trunk, drooping at the tip."""
        s = self.s; n = 12; w = s.get("pad", 1.4)
        for i in range(n + 1):
            t = i / n
            P = [C[k] + (Pm[k] - C[k]) * min(1, t * 2) if t < 0.5 else Pm[k] + (Q[k] - Pm[k]) * (t * 2 - 1) for k in range(3)]
            rad = w * (1.15 - 0.6 * t)
            R = int(math.ceil(rad))
            for dx in range(-R, R + 1):
                for dz in range(-R, R + 1):
                    if dx * dx + dz * dz <= rad * rad + self.rg.random() * 0.8:
                        cell = (round(P[0]) + dx, round(P[1]), round(P[2]) + dz)
                        self.leaf[cell] = self.pick_leaf(0.2 if t > 0.6 else -0.2)
                        if t < 0.45 and self.rg.random() < s.get("thick", 0.35):
                            self.leaf[(cell[0], cell[1] + 1, cell[2])] = self.pick_leaf(0.7)
            if t > 0.75 and self.rg.random() < 0.5:
                self.leaf[(round(P[0]), round(P[1]) - 1, round(P[2]))] = self.pick_leaf(-0.8)

    # ------------------------------------------------------------------ detail stages
    def bark(self):
        """Bark depth: the region's matching stone (walls and stairs) hugging the trunk, plus knots."""
        c, s = self.c, self.s; b = c.get("bark")
        if not b: return
        top = self.ht * s.get("bark_h", 0.7)
        for (x, y, z), (rank, part, ax) in list(self.wood.items()):
            if part != "trunk" or y > top or y < 1: continue
            for f, dx, dz in H4:
                n = (x + dx, y, z + dz)
                if n in self.wood or n in self.deco: continue
                u = self.rg.random()
                if u < s.get("bark_wall", 0.10) * (1.3 - y / max(top, 1)): self.deco[n] = (b["wall"], {})
                elif u < s.get("bark_wall", 0.10) + s.get("bark_stair", 0.06) and "stairs" in b:
                    self.deco[n] = (b["stairs"], {"facing": OPP[f], "half": "top" if self.rg.random() < 0.5 else "bottom"})

    def roots(self):
        c, s = self.c, self.s; k = s.get("roots", 0)
        if not k: return
        base = [(x, z) for (x, y, z), w in self.wood.items() if y == 1 and w[1] == "trunk"]
        if not base: return
        rmax = max(math.hypot(x, z) for x, z in base)
        a0 = self.r(0, 6.28)
        for i in range(k):
            az = a0 + i * 6.283 / k + self.r(-0.4, 0.4); d = (math.cos(az), math.sin(az))
            L = s.get("root_len", 3) * self.r(0.6, 1.2)
            f = "e" if abs(d[0]) >= abs(d[1]) and d[0] > 0 else "w" if abs(d[0]) >= abs(d[1]) else ("s" if d[1] > 0 else "n")
            steps = int(round(rmax + L)); prev = None
            for j in range(int(math.floor(rmax)) + 1, steps + 1):
                cell = (round(d[0] * j), 1, round(d[1] * j))
                if cell == prev or cell in self.wood: continue
                frac = (j - rmax) / max(L, 1)
                if frac < 0.45: self.put_wood(cell, 3, "root", "x" if f in "ew" else "z")
                elif frac < 0.85 and c.get("root_stairs"): self.deco[cell] = (c["root_stairs"], {"facing": OPP[f]})
                else:
                    self.deco[(cell[0], 0, cell[2])] = (c.get("root_ground", "dirt_with_roots"), {})
                prev = cell
            # sunk part of the root in the ground
            for j in range(int(rmax) + 1, int(rmax + L * 0.8) + 1):
                self.deco.setdefault((round(d[0] * j), 0, round(d[1] * j)), (c.get("root_ground", "dirt_with_roots"), {}))

    def drape(self):
        c, s = self.c, self.s; D = c.get("drape")
        if not D: return
        for (x, y, z) in list(self.leaf):
            if (x, y - 1, z) in self.leaf or (x, y - 1, z) in self.wood: continue
            if self.rg.random() > D.get("p", 0.2): continue
            n = int(self.rg.integers(1, D.get("len", 3) + 1)); yy = y - 1; last = None
            for _ in range(n):
                cell = (x, yy, z)
                if yy < 2 or cell in self.wood or cell in self.leaf: break
                if D.get("hang"):   # hanging plant (pale moss, roots), not leaves
                    self.deco[cell] = (D["hang"], {}); last = cell; yy -= 1; continue
                self.leaf[cell] = self.pick_leaf(-1); last = cell; yy -= 1
            if last and D.get("vines", 0) and self.rg.random() < D["vines"] and not D.get("hang"):
                f, dx, dz = H4[int(self.rg.integers(0, 4))]
                vx, vz = last[0] + dx, last[2] + dz
                for k in range(int(self.rg.integers(1, 4))):
                    vc = (vx, last[1] - k + 1, vz)
                    if vc in self.leaf or vc in self.wood or vc in self.deco or vc[1] < 2: break
                    self.deco[vc] = ("vine", {"raw": {"vine_direction_bits": VINE_BIT[OPP[f]]}})
            if D.get("hang") and last:
                self.deco[last] = (D["hang"], {"raw": {"tip": True}} if D["hang"] == "pale_hanging_moss" else {})

    def ground(self):
        c, s = self.c, self.s; G = c.get("ground")
        if not G: return
        R = s.get("ground_r", 2.5); names = [g for g, _ in G]; w = np.array([v for _, v in G], float); w /= w.sum()
        Ri = int(math.ceil(R))
        for x in range(-Ri, Ri + 1):
            for z in range(-Ri, Ri + 1):
                dd = math.hypot(x, z)
                if dd + self.rg.random() * 1.2 > R + 0.6: continue
                cell = (x, 0, z)
                if cell in self.deco or cell in self.wood: continue
                self.deco[cell] = (names[int(self.rg.choice(len(names), p=w))], {})
        L = c.get("litter")
        if L:
            leaves_xz = {(x, z) for x, y, z in self.leaf}
            for (x, z) in leaves_xz:
                if self.rg.random() < L.get("p", 0.08) and (x, 1, z) not in self.wood and (x, 1, z) not in self.deco and (x, 1, z) not in self.leaf:
                    self.deco[(x, 1, z)] = (L["block"], {"raw": {"growth": int(self.rg.integers(0, 4))}} if L["block"] == "leaf_litter" else {})

    def snow(self):
        if not self.c.get("snow"): return
        tops = {}
        for (x, y, z) in list(self.leaf):
            if (x, y + 1, z) not in self.leaf and (x, y + 1, z) not in self.wood:
                if self.rg.random() < self.c["snow"]: self.deco.setdefault((x, y + 1, z), ("snow_layer", {}))

    # ------------------------------------------------------------------ assemble
    def grow(self):
        self.trunk()
        (self.conifer if self.c["form"] == "conifer" else self.broadleaf)()
        self.roots(); self.bark(); self.drape(); self.ground(); self.snow()
        return self.blueprint()

    def blueprint(self):
        c = self.c; W = c["wood"]
        bp = Blueprint(f'{c["id"]}_{self.size}')
        for cell, (name, p) in self.deco.items():
            if cell in self.wood: continue
            bp.set(*cell, name, **p)
        for cell, name in self.leaf.items():
            if cell in self.wood: continue
            bp.set(*cell, name)
        trunk_cells = [k for k, v in self.wood.items() if v[1] == "trunk"]
        for cell, (rank, part, ax) in self.wood.items():
            if rank >= 3:
                if part == "trunk":
                    above = self.wood.get((cell[0], cell[1] + 1, cell[2]))
                    open_top = not above or above[0] < 3
                    name = W["log"] if self.rg.random() > c.get("knots", 0.12) and not open_top else W["wood"]
                    bp.set(*cell, name, axis="y")
                else: bp.set(*cell, W["wood"] if part != "root" else W.get("root", W["wood"]), axis=ax)
            elif rank == 2:
                if ax != "y" and W.get("slab"):          # thin level limb: a run of slabs (top/bottom by height)
                    bp.set(*cell, W["slab"], half="top" if self.rg.random() < 0.5 else "bottom")
                else: bp.set(*cell, W["wall"])
            else: bp.set(*cell, W["fence"])
        # trapdoors clinging to the sides of single-log limbs (thin vertical branches, knots)
        if W.get("trapdoor"):
            for cell, (rank, part, ax) in self.wood.items():
                if part != "limb" or rank != 3: continue
                for f, dx, dz in H4:
                    n = (cell[0] + dx, cell[1], cell[2] + dz)
                    if n in self.wood or bp.get(*n)[0] not in ("keep",) and not bp.get(*n)[0].endswith("_leaves"): continue
                    if self.rg.random() < c.get("trapdoors", 0.18):
                        bp.set(*n, W["trapdoor"], facing=f, open=True)
        bp.finish()
        bp.species = c["id"]; bp.size = self.size
        return bp


def grow(card, size, seed):
    return Grower(card, size, seed).grow()
