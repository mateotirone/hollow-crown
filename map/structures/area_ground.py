"""Shaping the real map ground for a whole area (a boss site, a story place): the map is one fixed world, so an area is
drawn against the ground that is actually there (genworld's heights and water) and its edges blend into it.

    G = Ground(cx, cz, y0)          # y0: the world y the area's offsets count from (the site plan's centre y)
    G.real(x, z), G.water(x, z)     # the map ground / water surface at offset (x, z), relative to y0 (water None if dry)
    T = shape(d, G, R0, R, target, top, sub)

shape() raises or cuts every column within R towards target(x, z, real) (relative y of the new top block): fully
inside R0, fading to the untouched map at R. It fills under raised ground, carves air over cut ground, keeps the
map's water where the new top is below it, and returns {(x, z): top y} for set dressing.

Heights: HC_HEIGHTS (default the project's hollow-crown-full-map-heights-pretown.npy, int16 [x, z], origin -1264).
Water: HC_WATER (same grid, the water surface y, -999 where dry).
"""
import math, os

import numpy as np

MAPDIR = "/mnt/project-files/siege-nights/map"
HEIGHTS = os.environ.get("HC_HEIGHTS", os.path.join(MAPDIR, "hollow-crown-full-map-heights-pretown.npy"))
WATER = os.environ.get("HC_WATER", os.path.join(MAPDIR, "hollow-crown-full-map-water.npy"))
ORIGIN = 1264
_cache = {}


def _load():
    if not _cache:
        _cache["h"] = np.load(HEIGHTS)
        _cache["w"] = np.load(WATER)
    return _cache["h"], _cache["w"]


def available():
    return os.path.exists(HEIGHTS) and os.path.exists(WATER)


class Ground:
    def __init__(self, cx, cz, y0):
        self.cx, self.cz, self.y0 = cx, cz, y0
        self.h, self.w = _load()

    def world(self, x, z):
        return int(self.h[self.cx + x + ORIGIN, self.cz + z + ORIGIN])

    def real(self, x, z):
        return self.world(x, z) - self.y0

    def water(self, x, z):
        w = int(self.w[self.cx + x + ORIGIN, self.cz + z + ORIGIN])
        return None if w <= -999 else w - self.y0


def smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def shape(d, G, R0, R, target, top, sub, skip=None, depth=3):
    """top(x, y, z) / sub(x, y, z) -> block name. skip(x, z) -> True leaves a column alone (another plan owns it)."""
    T = {}
    n = int(R) + 1
    for x in range(-n, n + 1):
        for z in range(-n, n + 1):
            r = math.hypot(x, z)
            if r > R or (skip and skip(x, z)): continue
            real = G.real(x, z)
            wgt = 1.0 if r <= R0 else smooth((R - r) / (R - R0))
            t = target(x, z, real)
            if t is None: continue
            y = round(real + wgt * (t - real))
            if y > real:
                for k in range(min(real, y - depth), y): d.put(x, k, z, sub(x, k, z))
            elif y < real:
                wl = G.water(x, z)
                for k in range(y + 1, real + 1):
                    if wl is not None and k <= wl: d.put(x, k, z, "water")   # never an air pocket under the sea
                    else: d.air(x, k, z)
                for k in range(y - depth + 1, y): d.put(x, k, z, sub(x, k, z))
            else:
                if wgt < 0.25: T[(x, z)] = y; continue
                for k in range(y - 1, y): d.put(x, k, z, sub(x, k, z))
            d.put(x, y, z, top(x, y, z))
            wl = G.water(x, z)
            if wl is not None and wl > y and wgt < 0.999:
                for k in range(y + 1, wl + 1): d.put(x, k, z, "water")
            T[(x, z)] = y
    return T
