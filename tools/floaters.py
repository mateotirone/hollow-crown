"""Floating blocks in a built world (Mateo 2026-11-13, Millbrook: "a bunch of stuff is floating"): every block that
does not reach the ground through other blocks (touching sideways, up, down or diagonally, the way a stair roof
steps). Water holds what floats on it (lily pads). Run after a map rebuild on each town and boss site:

    python tools/floaters.py WORLD x0 z0 x1 z1 [y0 y1]        (with an amulet-core Python)

Prints how many, by block, and a sample of where. Leaves cut by a stamp and the Antler Crown's chains are known.
"""
import sys, numpy as np, amulet
w, x0, z0, x1, z1 = sys.argv[1], *map(int, sys.argv[2:6])
y0, y1 = (int(sys.argv[6]), int(sys.argv[7])) if len(sys.argv) > 7 else (60, 130)
lv = amulet.load_level(w)
W, D, H = x1 - x0, z1 - z0, y1 - y0
ids = np.zeros((W, H, D), np.int32)
pal = lv.block_palette
for cx in range(x0 >> 4, ((x1 - 1) >> 4) + 1):
    for cz in range(z0 >> 4, ((z1 - 1) >> 4) + 1):
        try: ch = lv.get_chunk(cx, cz, "minecraft:overworld")
        except Exception: continue
        a = np.asarray(ch.blocks[:, y0:y1, :])
        for lx in range(16):
            gx = cx * 16 + lx - x0
            if not 0 <= gx < W: continue
            for lz in range(16):
                gz = cz * 16 + lz - z0
                if 0 <= gz < D: ids[gx, :, gz] = a[lx, :, lz]
names = {i: pal[i].base_name for i in np.unique(ids)}
air = np.isin(ids, [i for i, n in names.items() if n in ("air", "cave_air", "short_grass", "tall_grass", "fern", "snow_layer")])
solid = ~air
water = np.isin(ids, [i for i, n in names.items() if n in ("water", "flowing_water", "lava")])
g = np.zeros_like(solid); g[:, 0, :] = solid[:, 0, :]; g[0] |= solid[0]; g[-1] |= solid[-1]; g[:, :, 0] |= solid[:, :, 0]; g[:, :, -1] |= solid[:, :, -1]
while True:
    d = g.copy()                                           # 26-neighbours: a stair roof steps diagonally
    d[1:] |= d[:-1].copy(); d[:-1] |= d[1:].copy()
    d[:, 1:] |= d[:, :-1].copy(); d[:, :-1] |= d[:, 1:].copy()
    d[:, :, 1:] |= d[:, :, :-1].copy(); d[:, :, :-1] |= d[:, :, 1:].copy()
    d &= solid
    if (d == g).all(): break
    g = d
fl = solid & ~g & ~water
pts = np.argwhere(fl)
import collections
cnt = collections.Counter(names[ids[tuple(p)]] for p in pts)
print(len(pts), "floating blocks", cnt.most_common(25))
for p in pts[:: max(1, len(pts) // 30)]: print(x0 + p[0], y0 + p[1], z0 + p[2], names[ids[tuple(p)]])
lv.close()
