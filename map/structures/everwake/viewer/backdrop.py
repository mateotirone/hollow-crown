"""Aldmere far below Everwake: a block-scale height field cut from the map's own terrain (map/draw_map.py's
terrain.npz), as compact arrays the viewer meshes into textured blocks (tops, cliff sides, water, trees).
python3 backdrop.py terrain.npz textures_dir out.json CX CZ SIZE CITY_Y
  CX, CZ: the world point under the city's centre; CITY_Y: world Y of the city's local y 0 (255)."""
import sys, json, base64, io
import numpy as np
from PIL import Image
npz, texdir, out = sys.argv[1:4]; CX, CZ, SIZE, CITY_Y = map(int, sys.argv[4:8])
d = np.load(npz); H = int(d["H"]); N = int(d["N"])
def sample(a, xs, zs):                                     # bilinear, world -> grid
    gx = (xs + H) / (2 * H) * (N - 1); gz = (zs + H) / (2 * H) * (N - 1)
    x0 = np.clip(np.floor(gx).astype(int), 0, N - 2); z0 = np.clip(np.floor(gz).astype(int), 0, N - 2)
    fx = gx - x0; fz = gz - z0
    a = a.astype(np.float32)
    return (a[z0, x0] * (1 - fx) * (1 - fz) + a[z0, x0 + 1] * fx * (1 - fz) + a[z0 + 1, x0] * (1 - fx) * fz + a[z0 + 1, x0 + 1] * fx * fz)
xs = np.arange(CX - SIZE // 2, CX + SIZE // 2); zs = np.arange(CZ - SIZE // 2, CZ + SIZE // 2)
X, Z = np.meshgrid(xs, zs)
Y = sample(d["Y"], X, Z); land = sample(d["land"], X, Z) > 0.5; river = sample(d["river"], X, Z); forest = sample(d["forest"], X, Z)
road = np.maximum(sample(d["road"], X, Z), sample(d["trail"], X, Z))
reg = d["reg"]
gx = np.clip(((X + H) / (2 * H) * (N - 1)).round().astype(int), 0, N - 1); gz = np.clip(((Z + H) / (2 * H) * (N - 1)).round().astype(int), 0, N - 1)
R = reg[gz, gx]
top = np.round(Y).astype(int)
SEA = 62
water = np.zeros_like(top) - 999
sea = ~land | (top < SEA)
water[sea] = SEA; top[sea] = np.minimum(top[sea], SEA - 2)
riv = (river > 0.12) & ~sea
water[riv] = top[riv]; top[riv] = top[riv] - 2
# types: 0 grass, 1 sand, 2 stone, 3 snow, 4 gravel, 5 path, 6 dirt
T = np.zeros_like(top, dtype=np.uint8)
gy, gxx = np.gradient(Y)
steep = np.hypot(gy, gxx) > 1.3
T[steep | (top > 135)] = 2
T[top > 175] = 3
near = np.zeros_like(sea)
for dx, dz in ((3, 0), (-3, 0), (0, 3), (0, -3), (2, 2), (-2, -2), (2, -2), (-2, 2)):
    near |= np.roll(np.roll(sea | riv, dx, 1), dz, 0)
T[(near & ~sea & ~riv & (top < SEA + 3))] = 1
T[sea] = 1; T[riv] = 4
T[(road > 0.5) & (T == 0)] = 5
rng = np.random.default_rng(3)
trees = []
cand = np.argwhere((T == 0) & (forest > 0.15) & (rng.random(T.shape) < 0.012 + 0.03 * np.clip(forest, 0, 1)))
for (k, j) in cand:
    trees += [int(j), int(top[k, j]) + 1 - CITY_Y, int(k)]
pack = lambda a, t: base64.b64encode(np.ascontiguousarray(a, dtype=t).tobytes()).decode()
def tex(name, tint=None, alpha=None):
    im = Image.open(f"{texdir}/{name}.png").convert("RGBA")
    if im.height > im.width: im = im.crop((0, 0, im.width, im.width))
    im = im.resize((16, 16), Image.NEAREST)
    if tint:
        px = im.load()
        for i in range(16):
            for j in range(16):
                r, g, b, a = px[i, j]; px[i, j] = (r * tint[0] // 255, g * tint[1] // 255, b * tint[2] // 255, alpha if alpha else a)
    buf = io.BytesIO(); im.save(buf, "PNG"); return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
TEX = {"bd_grass": tex("grass_carried"), "bd_grass_side": tex("grass_side_carried"), "bd_sand": tex("sand"), "bd_stone": tex("stone"),
       "bd_snow": tex("snow"), "bd_gravel": tex("gravel"), "bd_path": tex("grass_path_top"), "bd_dirt": tex("dirt"),
       "bd_water": tex("water_still_grey", (63, 118, 228), 190), "bd_leaves": tex("leaves_oak_opaque", (0x6A, 0x9E, 0x3A)), "bd_log": tex("log_oak")}
json.dump({"x0": int(xs[0] - CX), "z0": int(zs[0] - CZ), "w": SIZE, "d": SIZE, "h": pack(top - CITY_Y, "<i2"), "t": pack(T, "u1"),
           "water": pack(np.where(water > -999, water - CITY_Y, -999), "<i2"), "trees": pack(trees, "<i2"), "tex": TEX,
           "types": ["grass", "sand", "stone", "snow", "gravel", "path", "dirt"]}, open(out, "w"))
print("trees", len(trees) // 3, "top", int(top.min()), int(top.max()))
