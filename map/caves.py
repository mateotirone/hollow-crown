"""Vanilla-style caves for the base map (genworld.py). Mateo 2026-11-13: "generate all the caves correctly, same as
the vanilla game".

What Minecraft (1.18+) puts underground, and what this makes, by world position so tiles join up:
  * cheese caves      big caverns with stone pillars, from a 3D noise above a threshold (deep down, never near the top)
  * spaghetti caves   long winding tunnels where two 3D noises are both near zero (their zero sheets cross in a line)
  * noodle caves      the same, thin (1-3 wide), in patches
  * 2D spaghetti      long, mostly level tunnels that wander up and down with a low noise
  * entrances         spaghetti that is allowed to break the surface, in patches of open country (hillsides first)
  * carver caves      the old worm tunnels, some reach the surface as hillside holes
  * ravines           long, narrow, tall canyons; the ones on open country are open to the sky
  * aquifers          below the land, each wobbly cell holds water up to its own level (stone barriers between cells
                      with different levels, as vanilla does); all cave air at y -55 and below is lava
  * lush caves        under the Vale and Blackfen: moss, azalea, glow berries, spore blossoms, rooted dirt
  * dripstone caves   under the Emberwaste, Saltreach and Frostmarch: dripstone blocks, stalactites and stalagmites
  * glow lichen       a little everywhere, as in vanilla
  * large ore veins   copper in granite (y 0 to 50) and iron in tuff (y -60 to -8), with the odd raw block
  * starter caves     one real cave mouth near every plot and two near Kingsrest, a tunnel down past iron
                      (the new-player audit: iron before the day-5 siege)

Openings never touch towns, plots, roads, trails, rail lines, bridges, water, boss sites, wards or the Rift thin
places: genworld passes a cover map (blocks of solid ground every cave keeps under the surface per column, 0 where
it may open) and a no-cave map (nothing is carved there at any depth: towns, wards, boss sites and thin places,
whose own rooms and the Deep are built by the add-on).
"""
import math
import numpy as np

YMIN = -64
LAVA_Y = -55                 # cave air at this height and below is lava (vanilla's lava level)
STEP = 4                     # noise is worked out every 4 blocks and blended (vanilla's noise cells are 4 wide too)

# ---------------------------------------------------------------- noise (seeded, by world position)
_M = np.uint64(0xFFFFFFFF)


def _hash(ix, iy, iz, seed):
    """Integer lattice point -> float in [-1, 1)."""
    h = (np.asarray(ix, np.int64) * 374761393 + np.asarray(iy, np.int64) * 668265263
         + np.asarray(iz, np.int64) * 1440662683 + seed * 2654435761) & 0xFFFFFFFF
    h = h.astype(np.uint64)
    h = ((h ^ (h >> np.uint64(13))) * np.uint64(1274126177)) & _M
    h = (h ^ (h >> np.uint64(16))) & _M
    return (h.astype(np.float64) / 2147483648.0 - 1.0).astype(np.float32)


def _fade(t):
    return t * t * (3 - 2 * t)


_G = np.array([(1, 1, 0), (-1, 1, 0), (1, -1, 0), (-1, -1, 0), (1, 0, 1), (-1, 0, 1), (1, 0, -1), (-1, 0, -1),
               (0, 1, 1), (0, -1, 1), (0, 1, -1), (0, -1, -1), (1, 1, 0), (-1, 1, 0), (0, -1, 1), (0, -1, -1)], np.float32)


def _ghash(ix, iy, iz, seed):
    h = (np.asarray(ix, np.int64) * 374761393 + np.asarray(iy, np.int64) * 668265263
         + np.asarray(iz, np.int64) * 1440662683 + seed * 2654435761) & 0xFFFFFFFF
    h = h.astype(np.uint64)
    h = ((h ^ (h >> np.uint64(13))) * np.uint64(1274126177)) & _M
    h = (h ^ (h >> np.uint64(16))) & _M
    return (h & np.uint64(15)).astype(np.int64)


def _q(t):
    return t * t * t * (t * (t * 6 - 15) + 10)


def vnoise3(x, y, z, seed):
    """Gradient (Perlin) noise at lattice-unit coordinates, about -1..1; arrays broadcast."""
    xi = np.floor(x); yi = np.floor(y); zi = np.floor(z)
    fx = (x - xi).astype(np.float32); fy = (y - yi).astype(np.float32); fz = (z - zi).astype(np.float32)
    ux, uy, uz = _q(fx), _q(fy), _q(fz)
    xi = xi.astype(np.int64); yi = yi.astype(np.int64); zi = zi.astype(np.int64)
    out = 0
    for dx in (0, 1):
        wx = ux if dx else 1 - ux
        for dy in (0, 1):
            wy = uy if dy else 1 - uy
            for dz in (0, 1):
                wz = uz if dz else 1 - uz
                g = _G[_ghash(xi + dx, yi + dy, zi + dz, seed)]
                dot = g[..., 0] * (fx - dx) + g[..., 1] * (fy - dy) + g[..., 2] * (fz - dz)
                out = out + dot * (wx * wy * wz)
    return out


def fbm3(x, y, z, seed, octaves=2):
    v = 0; amp = 1.0; tot = 0
    for o in range(octaves):
        v = v + vnoise3(x, y, z, seed + 101 * o) * amp
        tot += amp; amp *= 0.5; x = x * 2.03; y = y * 2.03; z = z * 2.03
    return v / tot


def vnoise2(x, z, seed):
    return vnoise3(x, np.zeros(1, np.float32) + 0.5, z, seed)


# ---------------------------------------------------------------- cave plan for the whole map
class Caves:
    def __init__(self, Y, X0, Z0, cover, nocave, reg, mouth_ok, starts, sea=62, seed=4242, log=print,
                 regions=(0, 1, 2, 3, 4), deep_only=None):
        """Y: ground height per column (whole written square). cover: float blocks of solid ground every cave keeps
        under the surface (0 = may open). nocave: no carving at any depth. mouth_ok: open country where a ravine may
        be open to the sky. starts: [(name, x, z)] places that get a starter cave mouth nearby."""
        self.Y = Y; self.X0 = X0; self.Z0 = Z0; self.SIZE = Y.shape[0]
        self.cover = cover.astype(np.float32); self.nocave = nocave; self.reg = reg; self.mouth_ok = mouth_ok
        self.sea = sea; self.seed = seed; self.log = log
        self.deep_only = deep_only if deep_only is not None else np.zeros(Y.shape, bool)   # plot land: no caverns within 40
        self.VALE, self.FROST, self.SALT, self.FEN, self.EMBER = regions
        self.rg = np.random.default_rng(seed)
        self.points = []         # (x, y, z, r, hh, open) carver points: worms, ravines, starters
        self.ore_spots = []      # (x, y, z, kind) iron/coal on starter cave walls
        self.mouths = []         # (x, y, z, kind) every surface opening made by a carver, for the preview / report
        self._aquifer_plan()
        self._worms()
        self._ravines()
        self._starters(starts)
        P = np.array(self.points, np.float32) if self.points else np.zeros((0, 6), np.float32)
        self.P = P
        log("caves: carver points", len(P), "ravines", self.n_ravines, "open", self.n_open_ravines, "starter mouths", self.n_starters)

    # -- helpers on the whole map
    def _col(self, x, z):
        i = min(max(int(round(x)) - self.X0, 0), self.SIZE - 1); k = min(max(int(round(z)) - self.Z0, 0), self.SIZE - 1)
        return i, k

    def ground(self, x, z):
        i, k = self._col(x, z); return int(self.Y[i, k])

    # -- aquifers: a level per wobbly 64-block cell, never closer than 10 blocks under the lowest ground near it
    AQ = 64

    def _aquifer_plan(self):
        n = self.SIZE // self.AQ + 4
        self.aq_o = (int(math.floor(self.X0 / self.AQ)) - 2, int(math.floor(self.Z0 / self.AQ)) - 2)
        lv = np.full((n, n), LAVA_Y, np.int32)       # dry cell: air down to the lava
        r = np.random.default_rng(self.seed + 7)
        pick = r.random((n, n)); lvl = r.uniform(-50, 12, (n, n))
        for a in range(n):
            for b in range(n):
                cx0 = (self.aq_o[0] + a - 1) * self.AQ - self.X0; cz0 = (self.aq_o[1] + b - 1) * self.AQ - self.Z0
                i0, i1 = max(0, cx0), min(self.SIZE, cx0 + 3 * self.AQ); k0, k1 = max(0, cz0), min(self.SIZE, cz0 + 3 * self.AQ)
                if i0 >= i1 or k0 >= k1: continue
                lo = int(self.Y[i0:i1, k0:k1].min())
                cap = min(lo - 10, self.sea - 4)
                if pick[a, b] < 0.4 and lvl[a, b] < cap: lv[a, b] = int(lvl[a, b])
        self.aq_lv = lv

    def aquifer_levels(self, wx, wz):
        """Per column (world x, z arrays, 2D): this cell's level, and the cell id (for barriers)."""
        ox = vnoise2(wx / 90.0, wz / 90.0, self.seed + 11) * 14; oz = vnoise2(wx / 90.0, wz / 90.0, self.seed + 12) * 14
        ca = np.floor((wx + ox) / self.AQ).astype(np.int64) - self.aq_o[0]; cb = np.floor((wz + oz) / self.AQ).astype(np.int64) - self.aq_o[1]
        ca = np.clip(ca, 0, self.aq_lv.shape[0] - 1); cb = np.clip(cb, 0, self.aq_lv.shape[1] - 1)
        return self.aq_lv[ca, cb], ca * 100000 + cb

    # -- carver caves (worms): the old tunnels; in open country they may come out on a hillside
    def _worms(self):
        rg = self.rg; S = self.SIZE
        for _ in range(int((S / 48) ** 2 * 1.4)):
            x = self.X0 + rg.random() * S; z = self.Z0 + rg.random() * S; y = rg.uniform(-55, 70)
            yaw = rg.random() * 6.283; pitch = rg.uniform(-0.3, 0.3); rad = rg.uniform(1.5, 3.0)
            big = rg.random() < 0.08
            for s in range(int(rg.integers(60, 180))):
                x += math.cos(yaw) * math.cos(pitch) * 1.4; z += math.sin(yaw) * math.cos(pitch) * 1.4; y += math.sin(pitch) * 1.2
                yaw += rg.normal(0, 0.18); pitch = pitch * 0.85 + rg.normal(0, 0.12)
                r = rad + math.sin(s * 0.21) * 0.6 + (2.5 if big and 20 < s < 50 else 0)
                i, k = self._col(x, z)
                top = self.Y[i, k] - self.cover[i, k] - r * 1.0 + (1.2 if self.cover[i, k] < 0.5 else 0)   # pop out in open country
                yy = max(min(y, top), -58)
                if self.nocave[i, k]: continue
                self.points.append((x, yy, z, r, r / 1.3, 0))

    # -- ravines: 1 in ~100 chunks, as vanilla's canyon carver; open to the sky where the whole run is open country
    def _ravines(self):
        rg = self.rg; S = self.SIZE; self.n_ravines = 0; self.n_open_ravines = 0
        for _ in range(int((S / 16) ** 2 / 100)):
            x = self.X0 + rg.random() * S; z = self.Z0 + rg.random() * S
            yaw = rg.random() * 6.283; L = int(rg.integers(80, 170)); Wd = rg.uniform(2.5, 5.0); tall = rg.uniform(2.2, 3.2)
            path = []
            for s in range(L):
                x += math.cos(yaw); z += math.sin(yaw); yaw += rg.normal(0, 0.05)
                path.append((x, z))
            cols = [self._col(px, pz) for px, pz in path]
            if any(self.nocave[i, k] for i, k in cols): continue
            is_open = all(self.mouth_ok[i, k] for i, k in cols)
            self.n_ravines += 1; self.n_open_ravines += is_open
            deep_y = rg.uniform(-40, 40)
            for s, ((px, pz), (i, k)) in enumerate(zip(path, cols)):
                rw = Wd * math.sin(math.pi * (s + 0.5) / L) ** 0.6 * (1 + 0.15 * math.sin(s * 0.31))
                if rw < 1.0: continue
                hh = rw * tall + 2
                g = float(self.Y[i, k])
                if is_open: cy = g - hh * 0.55
                else: cy = min(deep_y, g - self.cover[i, k] - hh - 1)
                cy = max(cy, -56 + hh * 0.3)
                self.points.append((px, cy, pz, rw, hh, 2 if is_open else 1))
            if is_open:
                i, k = cols[L // 2]; self.mouths.append((path[L // 2][0], int(self.Y[i, k]), path[L // 2][1], "ravine"))

    # -- starter caves: a real mouth on a hillside near each start, a tunnel down past iron
    def _starters(self, starts):
        self.n_starters = 0
        gy, gx = np.gradient(self.Y.astype(np.float32), axis=1), np.gradient(self.Y.astype(np.float32), axis=0)
        for name, sx, sz, count in starts:
            got = []
            for rad in range(90, 300, 8):
                for a in range(0, 360, 6):
                    th = math.radians(a + (hash(name) % 60)); x = sx + rad * math.cos(th); z = sz + rad * math.sin(th)
                    i, k = self._col(x, z)
                    if not (0 < i < self.SIZE - 1 and 0 < k < self.SIZE - 1): continue
                    if not self.mouth_ok[i, k]: continue
                    sl = math.hypot(gx[i, k], gy[i, k])
                    if sl < 0.45: continue                                        # a hillside, so the mouth is in a face
                    if any(math.hypot(x - ox, z - oz) < 60 for ox, oz in got): continue
                    got.append((x, z))
                    self._starter_tunnel(x, z, math.atan2(gy[i, k], gx[i, k]))    # into the hill (uphill direction)
                    if len(got) >= count: break
                if len(got) >= count: break
            self.n_starters += len(got)
            if len(got) < count: self.log(f"caves: only {len(got)} starter mouths near {name}")

    def _starter_tunnel(self, x, z, yaw):
        rg = self.rg
        i, k = self._col(x, z); y = float(self.Y[i, k]) - 1.0
        self.mouths.append((x, int(self.Y[i, k]), z, "starter"))
        target = max(-8.0, min(y - 28, 24.0))
        pitch = 0.0
        for s in range(150):
            if s < 6: pitch = 0.0
            elif y > target: pitch = max(-0.55, pitch - 0.05)
            else: pitch = pitch * 0.8 + rg.normal(0, 0.08)
            x += math.cos(yaw) * math.cos(pitch) * 1.2; z += math.sin(yaw) * math.cos(pitch) * 1.2; y += math.sin(pitch) * 1.2
            yaw += rg.normal(0, 0.12)
            i, k = self._col(x, z)
            if self.nocave[i, k]: break
            r = 2.1 + 0.5 * math.sin(s * 0.3) + (1.2 if 60 < s < 75 else 0)
            if s >= 22:                                                           # past the mouth: keep the usual cover
                y = min(y, self.Y[i, k] - max(self.cover[i, k], 4) - r - 1)
            self.points.append((x, y, z, r, r / 1.2, 2 if s < 22 else 0))
            if s % 7 == 3 and y < 72:                                             # iron (and the odd coal) on the walls
                a = rg.random() * 6.283
                self.ore_spots.append((x + math.cos(a) * (r + 0.6), y + rg.uniform(-0.8, 1.2), z + math.sin(a) * (r + 0.6),
                                       "coal" if s % 21 == 3 and y > 30 else "iron"))

    # ---------------------------------------------------------------- one tile
    def opened(self, wx0, wz0, Yt, YR):
        """Columns whose top block a cave takes (for trees and plants, worked out before any tile is written)."""
        cv, _ = self.tile(wx0, wz0, Yt, YR, None, ylo=int(Yt.min()) - 2)
        W, D = Yt.shape
        return cv[np.arange(W)[:, None], Yt - YMIN, np.arange(D)[None, :]]

    def tile(self, wx0, wz0, Yt, YR, solid_ids, ylo=None):
        """Carve mask (W, YR, D) bool for the tile whose (0,0) column is world (wx0, wz0), plus the per-column aquifer
        level (W, D). Only y up to the tile's highest ground is worked out."""
        W, D = Yt.shape
        a0, b0 = wx0 - self.X0, wz0 - self.Z0
        cov = self.cover[a0:a0 + W, b0:b0 + D]; noc = self.nocave[a0:a0 + W, b0:b0 + D]
        ytop = int(Yt.max()) + 2; yb = YMIN if ylo is None else max(YMIN, ylo)
        carve = np.zeros((W, YR, D), bool)
        # coarse grid, every STEP blocks on world multiples, then blended (trilinear) to every block
        gx0 = (wx0 // STEP) * STEP; gz0 = (wz0 // STEP) * STEP; gy0 = (yb // STEP) * STEP
        cx = np.arange(gx0, wx0 + W + STEP + 1, STEP, dtype=np.float32); cz = np.arange(gz0, wz0 + D + STEP + 1, STEP, dtype=np.float32)
        cy = np.arange(gy0, ytop + STEP + 1, STEP, dtype=np.float32)
        X = cx[:, None, None]; Yc = cy[None, :, None]; Z = cz[None, None, :]
        fx = (np.arange(wx0, wx0 + W) - gx0) / STEP; ix = fx.astype(int); tx = (fx - ix).astype(np.float32)
        fz = (np.arange(wz0, wz0 + D) - gz0) / STEP; iz = fz.astype(int); tz = (fz - iz).astype(np.float32)
        fy = (np.arange(yb, ytop) - gy0) / STEP; iy = fy.astype(int); ty = (fy - iy).astype(np.float32)

        def up(G):
            A = G[ix] * (1 - tx)[:, None, None] + G[ix + 1] * tx[:, None, None]
            A = A[:, :, iz] * (1 - tz)[None, None, :] + A[:, :, iz + 1] * tz[None, None, :]
            return A[:, iy, :] * (1 - ty)[None, :, None] + A[:, iy + 1, :] * ty[None, :, None]

        s = self.seed
        yv = np.arange(yb, ytop, dtype=np.float32)[None, :, None]
        Ye = Yt[:, None, :].astype(np.float32); Ce = cov[:, None, :]
        depth = Ye - yv                                                 # blocks under the surface
        f = np.clip((Ye - Ce - yv + 0.5) / np.maximum(Ce * 1.5, 0.5), 0, 1)   # 1 = free, 0 = at the cover line
        # cheese: deep caverns, never within 12 blocks of the top, fewer high up
        ch = up(fbm3(X / 96, Yc / 64, Z / 96, s + 1, 3))
        thr = 0.23 + np.clip((yv - 0) / 160, 0, 0.5) + 0.3 * (1 - np.clip((depth - 12) / 10, 0, 1))
        m = (ch > thr) & ~(self.deep_only[a0:a0 + W, b0:b0 + D][:, None, :] & (depth < 40))
        del ch
        # spaghetti (3D): two noises both near zero, width wobbling along the way
        a = up(fbm3(X / 72, Yc / 54, Z / 72, s + 2, 2)); b = up(fbm3(X / 72, Yc / 54, Z / 72, s + 3, 2))
        wob = up(vnoise3(X / 40, Yc / 40, Z / 40, s + 4)) * 0.012
        sp = np.maximum(np.abs(a), np.abs(b)) < (0.04 + wob) * f
        m |= sp & (yv > -60)
        # entrances: spaghetti that comes up to the surface, carved only where the cover lets it (open country)
        a = up(fbm3(X / 60, Yc / 70, Z / 60, s + 5, 2)); b = up(fbm3(X / 60, Yc / 70, Z / 60, s + 6, 2))
        ent = (np.maximum(np.abs(a), np.abs(b)) < 0.06 * f) & (yv > -10) & (Ce < 2.5)
        m |= ent
        # noodles: thin, in patches
        tog = up(vnoise3(X / 110, Yc / 110, Z / 110, s + 7))
        a = up(vnoise3(X / 26, Yc / 26, Z / 26, s + 8)); b = up(vnoise3(X / 26, Yc / 26, Z / 26, s + 9))
        m |= (tog > 0.1) & (np.maximum(np.abs(a), np.abs(b)) < 0.05 * f) & (yv > -60) & (yv < 130)
        del a, b, tog, wob, sp, ent
        # 2D spaghetti: long level tunnels whose height wanders
        wx = np.arange(wx0, wx0 + W, dtype=np.float32)[:, None]; wz = np.arange(wz0, wz0 + D, dtype=np.float32)[None, :]
        n2 = vnoise2(wx / 80, wz / 80, s + 10) * 0.7 + vnoise2(wx / 31, wz / 31, s + 13) * 0.3
        el = vnoise2(wx / 220, wz / 220, s + 14) * 60 + 5 + vnoise2(wx / 50, wz / 50, s + 15) * 8
        th = (2.2 + vnoise2(wx / 60, wz / 60, s + 16) * 1.2)
        m |= ((np.abs(n2) < 0.035)[:, None, :] & (np.abs(yv - el[:, None, :]) < th[:, None, :] * f)) & (yv > -58)
        # the hard cover line and the no-cave places
        m &= (yv <= Ye - Ce) & ~noc[:, None, :]
        carve[:, yb - YMIN + 1:ytop - YMIN, :] = m[:, 1:, :]
        del m, f, depth
        # carvers: worms, ravines, starter tunnels
        P = self.P
        if len(P):
            sel = (P[:, 0] >= wx0 - 9) & (P[:, 0] < wx0 + W + 9) & (P[:, 2] >= wz0 - 9) & (P[:, 2] < wz0 + D + 9)
            for px, py, pz, r, hh, op in P[sel]:
                lx, ly, lz = px - wx0, py - YMIN, pz - wz0; ri = int(math.ceil(r)) + 1; hi = int(math.ceil(hh)) + 1
                i0, i1 = max(0, int(lx) - ri), min(W, int(lx) + ri + 2); k0, k1 = max(0, int(lz) - ri), min(D, int(lz) + ri + 2)
                j0, j1 = max(1, int(ly) - hi), min(YR, int(ly) + hi + 2)
                if i0 >= i1 or k0 >= k1 or j0 >= j1: continue
                ii, jj, kk = np.ogrid[i0:i1, j0:j1, k0:k1]
                if op >= 1 and hh > r * 1.5:                                       # ravine: steep walls
                    sm = ((ii - lx) ** 2 + (kk - lz) ** 2) / (r * r) + ((jj - ly) / hh) ** 4 <= 1
                else:
                    sm = ((ii - lx) ** 2 + (kk - lz) ** 2) / (r * r) + ((jj - ly) / hh) ** 2 <= 1
                if op < 2:                                                         # sealed: keep the cover
                    lim = (Yt[i0:i1, k0:k1] - cov[i0:i1, k0:k1])[:, None, :] - YMIN
                    sm &= jj <= lim
                else:                                                              # open: up through the surface
                    sm &= jj <= Yt[i0:i1, k0:k1][:, None, :] - YMIN + 1
                sm &= ~noc[i0:i1, k0:k1][:, None, :]
                carve[i0:i1, j0:j1, k0:k1] |= sm
        # aquifers: where two cells with different levels meet, rock stays between their levels (vanilla's barrier),
        # so water never stands beside open air or lava
        lv, cid = self.aquifer_levels(wx, wz)
        lo = np.full((W, D), 9999, np.int32); hi = np.full((W, D), -9999, np.int32)
        for dx, dz in ((2, 0), (-2, 0), (0, 2), (0, -2)):
            sh = np.roll(np.roll(cid, dx, 0), dz, 1); shl = np.roll(np.roll(lv, dx, 0), dz, 1)
            diff = (sh != cid) & (shl != lv)
            lo = np.where(diff, np.minimum(lo, np.minimum(lv, shl)), lo); hi = np.where(diff, np.maximum(hi, np.maximum(lv, shl)), hi)
        yy = np.arange(YMIN, YMIN + YR)[None, :, None]
        carve &= ~((yy > lo[:, None, :]) & (yy <= hi[:, None, :] + 1))
        carve[:, 0, :] = False
        return carve, lv

    # ---------------------------------------------------------------- large ore veins
    def veins(self, wx0, wz0, W, D, YR):
        """(copper_mask, iron_mask, raw_mask, filler_mask) for the tile; vanilla's ore veins."""
        ylo, yhi = -62, 52
        j0, j1 = ylo - YMIN, yhi - YMIN
        gx0 = (wx0 // STEP) * STEP; gz0 = (wz0 // STEP) * STEP; gy0 = (ylo // STEP) * STEP
        cx = np.arange(gx0, wx0 + W + STEP + 1, STEP, dtype=np.float32)[:, None, None]
        cz = np.arange(gz0, wz0 + D + STEP + 1, STEP, dtype=np.float32)[None, None, :]
        cy = np.arange(gy0, yhi + STEP + 1, STEP, dtype=np.float32)[None, :, None]
        fx = (np.arange(wx0, wx0 + W) - gx0) / STEP; ix = fx.astype(int); tx = (fx - ix).astype(np.float32)
        fz = (np.arange(wz0, wz0 + D) - gz0) / STEP; iz = fz.astype(int); tz = (fz - iz).astype(np.float32)
        fy = (np.arange(ylo, yhi) - gy0) / STEP; iy = fy.astype(int); ty = (fy - iy).astype(np.float32)

        def up(G):
            A = G[ix] * (1 - tx)[:, None, None] + G[ix + 1] * tx[:, None, None]
            A = A[:, :, iz] * (1 - tz)[None, None, :] + A[:, :, iz + 1] * tz[None, None, :]
            return A[:, iy, :] * (1 - ty)[None, :, None] + A[:, iy + 1, :] * ty[None, :, None]
        s = self.seed + 50
        tog = up(vnoise3(cx / 80, cy / 80, cz / 80, s))
        a = up(vnoise3(cx / 18, cy / 18, cz / 18, s + 1)); b = up(vnoise3(cx / 18, cy / 18, cz / 18, s + 2))
        body = (np.abs(a) < 0.07) & (np.abs(b) < 0.07)
        yv = np.arange(ylo, yhi)[None, :, None]
        cop = body & (tog > 0.32) & (yv >= 0) & (yv <= 50)
        iro = body & (tog < -0.32) & (yv >= -60) & (yv <= -8)
        r = np.random.default_rng(int((wx0 * 31 + wz0 * 17 + 5) & 0x7FFFFFFF)).random(body.shape, dtype=np.float32)
        out = []
        for m_ in (cop & (r < 0.28), iro & (r < 0.28), (cop | iro) & (r > 0.985), (cop | iro) & (r >= 0.28) & (r <= 0.985)):
            full = np.zeros((W, YR, D), bool); full[:, j0:j1, :] = m_; out.append(full)
        copper, iron, raw, fill = out
        return copper, iron, raw, fill, cop.any()

    # ---------------------------------------------------------------- dressing: lush and dripstone caves, glow lichen
    def dress(self, vol, carve, Yt, wx0, wz0, reg_t, ids, AIR, water, lava, solid_ok, rng):
        """Writes the cave plants and stones into vol in place. ids: dict of block ids (may lack some)."""
        W, YR, D = vol.shape
        yy = np.arange(YMIN, YMIN + YR)[None, :, None]
        air = carve & (vol == AIR) & (yy < Yt[:, None, :] - 2)
        if not air.any(): return {}
        sol = np.isin(vol, solid_ok)
        floor = np.zeros_like(air); floor[:, 1:, :] = air[:, 1:, :] & sol[:, :-1, :]
        ceil = np.zeros_like(air); ceil[:, :-1, :] = air[:, :-1, :] & sol[:, 1:, :]
        wx = np.arange(wx0, wx0 + W, dtype=np.float32)[:, None]; wz = np.arange(wz0, wz0 + D, dtype=np.float32)[None, :]
        zn = vnoise2(wx / 180, wz / 180, self.seed + 30) * 0.7 + vnoise2(wx / 60, wz / 60, self.seed + 31) * 0.3
        lushc = (np.isin(reg_t, [self.VALE, self.FEN]) & (zn > 0.12))[:, None, :] & (yy > -40) & (yy < 56)
        dripc = (np.isin(reg_t, [self.EMBER, self.SALT, self.FROST]) & (zn > 0.10))[:, None, :] & (yy > -50) & (yy < 60)
        stats = {}

        def put(mask, name, p=1.0, dy=0):
            if name not in ids: return 0
            i, j, k = np.nonzero(mask)
            if p < 1:
                keep = rng.random(len(i)) < p; i, j, k = i[keep], j[keep], k[keep]
            j = j + dy; ok = (j >= 1) & (j < YR); i, j, k = i[ok], j[ok], k[ok]
            vol[i, j, k] = ids[name]; stats[name] = stats.get(name, 0) + len(i); return len(i)

        def hang(mask, names_fn, p, maxlen, down):
            """Columns of blocks hanging down (down=True) from a ceiling cell or standing up from a floor cell."""
            i, j, k = np.nonzero(mask)
            keep = rng.random(len(i)) < p; i, j, k = i[keep], j[keep], k[keep]
            want = rng.integers(1, maxlen + 1, len(i)); n = np.zeros(len(i), int)
            st = -1 if down else 1
            for q in range(maxlen):
                jj = j + st * q; ok = (n == q) & (q < want) & (jj >= 1) & (jj < YR)
                ok[ok] &= air[i[ok], jj[ok], k[ok]]
                n[ok] += 1
            for q in range(maxlen):
                sel = n > q
                if not sel.any(): continue
                names = names_fn(q, n[sel])
                jj = j[sel] + st * q
                for nm in set(names):
                    if nm not in ids: continue
                    mm = names == nm; vol[i[sel][mm], jj[mm], k[sel][mm]] = ids[nm]
                    stats[nm] = stats.get(nm, 0) + int(mm.sum())

        # lush caves: moss on floor and roof, carpets and azaleas, glow berries hanging, spore blossoms, rooted dirt
        lf = floor & lushc; lc = ceil & lushc
        put(lf, "moss_block", 0.9, -1); put(lc, "moss_block", 0.55, 1)
        put(lc, "dirt_with_roots", 0.08, 1)
        put(lf, "moss_carpet", 0.28); put(lf, "azalea", 0.025); put(lf, "flowering_azalea", 0.02)
        put(lf, "clay", 0.03, -1)
        hang(lc, lambda q, n: np.where(q == n - 1, np.where(rng.random(len(n)) < 0.35, "cave_vines_head_with_berries", "cave_vines"),
                                       np.where(rng.random(len(n)) < 0.25, "cave_vines_body_with_berries", "cave_vines")), 0.13, 5, True)
        put(lc & (vol == AIR), "spore_blossom", 0.006)
        if "dirt_with_roots" in ids:
            under_roots = np.zeros_like(lc); under_roots[:, :-1, :] = vol[:, 1:, :] == ids["dirt_with_roots"]
            put(lc & under_roots & (vol == AIR), "hanging_roots", 0.6)
        # dripstone caves: dripstone blocks, stalactites from the roof, stalagmites from the floor
        df = floor & dripc; dc = ceil & dripc
        put(df, "dripstone_block", 0.7, -1); put(dc, "dripstone_block", 0.7, 1)

        def drip(hanging):
            def fn(q, n):
                left = n - 1 - q          # 0 at the tip
                out = np.where(left == 0, "pd_tip", np.where(left == 1, "pd_frustum", np.where(q == 0, "pd_base", "pd_middle")))
                return np.array([s_ + ("_h" if hanging else "_u") for s_ in out])
            return fn
        hang(dc & (vol == AIR), drip(True), 0.09, 4, True)
        hang(df & (vol == AIR), drip(False), 0.06, 3, False)
        # glow lichen, a little everywhere else
        plain = ~lushc & ~dripc
        put(floor & plain & (vol == AIR), "glow_lichen_down", 0.006)
        put(ceil & plain & (vol == AIR), "glow_lichen_up", 0.006)
        return stats


def no_falling(vol, AIR, pairs):
    """Sand, red sand and gravel never hang over air (nothing falls or floats): turn them to their stone."""
    below_air = np.zeros(vol.shape, bool); below_air[:, 1:, :] = vol[:, :-1, :] == AIR
    n = 0
    for frm, to in pairs:
        m = below_air & (vol == frm); n += int(m.sum()); vol[m] = to
    return n
