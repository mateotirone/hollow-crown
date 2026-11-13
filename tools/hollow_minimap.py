"""Paint the Hollow's minimap tiles from its generated land.

    python3 tools/hollow_minimap.py

Runs tools/hollow_minimap_dump.mjs (node) for the land, then writes
    Siege_Nights_RP/textures/ui/hc/minimap/mhXXzZZ.png    one view per 64-block tile of the Hollow's grid
    Siege_Nights_BP/scripts/minimap/hollow_tiles.js       which tiles have a picture (the rest show "uncharted")
The grid is HOLLOW_MAP in scripts/minimap/hollow.js. Run it again whenever the Hollow's land, roads or sites change.
Same size, palette and night look as tools/minimap_tiles.py.
"""
import os, re, struct, subprocess, tempfile
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "Siege_Nights_RP", "textures", "ui", "hc", "minimap")
TILES_JS = os.path.join(ROOT, "Siege_Nights_BP", "scripts", "minimap", "hollow_tiles.js")
HOLLOW_JS = open(os.path.join(ROOT, "Siege_Nights_BP", "scripts", "minimap", "hollow.js")).read()
M = {k: int(v) for k, v in re.findall(r"(x0|z0|tile|cols|rows): (-?\d+)", HOLLOW_JS.split("HOLLOW_MAP")[1].split("}")[0])}
STEP, PX, PALETTE = 2, 24, 64
VOID = (14, 10, 20)

bin_path = os.path.join(tempfile.mkdtemp(), "hollow.bin")
subprocess.run(["node", os.path.join(ROOT, "tools", "hollow_minimap_dump.mjs"), bin_path], check=True)
raw = open(bin_path, "rb").read()
W, H = struct.unpack("<ii", raw[:8])
a = np.frombuffer(raw[8:], np.uint8).reshape(H, W, 2)
kind, h = a[..., 0], a[..., 1].astype(np.float32)

# colours: dark purple land, shaded by height and slope; glowing teal water; grey roads; pale site pads
COL = {0: VOID, 1: (70, 170, 190), 2: (120, 116, 128), 3: (150, 132, 150),
       4: (70, 52, 92), 5: (92, 86, 104), 6: (52, 70, 78), 7: (120, 108, 112)}
img = np.zeros((H, W, 3), np.float32)
for k, c in COL.items(): img[kind == k] = c
land = kind >= 2
shade = np.clip((h - 62) / 60, 0, 1)[..., None]
img = np.where(land[..., None], img * (0.75 + 0.5 * shade), img)
dx = np.zeros_like(h); dx[:, 1:] = h[:, 1:] - h[:, :-1]
img = np.where(land[..., None], img * np.clip(1 + dx[..., None] * 0.06, 0.7, 1.25), img)
pic = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
side_px = lambda n: n * PX
small = pic.resize((side_px(M["cols"] + 2), side_px(M["rows"] + 2)), Image.BOX)
# a touch of the overworld minimap's night look
s = np.asarray(small, np.float32)
s = (s * 0.85 + s.mean(axis=2, keepdims=True) * 0.15) * 0.92
small = Image.fromarray(np.clip(s, 0, 255).astype(np.uint8))

# named places: small pale squares (the sites in undertow/roads.js SITES with a name)
roads_js = open(os.path.join(ROOT, "Siege_Nights_BP", "scripts", "undertow", "roads.js")).read()
sites = [(int(x), int(z)) for x, z in re.findall(r'\{ id: "[a-z_]+", name: "[^"]+", x: (-?\d+), z: (-?\d+)', roads_js)]
sites.append((-380, 2160))  # the Needlehold (its SITES entry reads from stronghold.js)
d = ImageDraw.Draw(small)
def at(x, z): return ((x - (M["x0"] - M["tile"])) * PX / M["tile"], (z - (M["z0"] - M["tile"])) * PX / M["tile"])
for x, z in sites:
    cx, cy = at(x, z)
    d.rectangle([cx - 2, cy - 2, cx + 2, cy + 2], fill=(20, 18, 24)); d.rectangle([cx - 1, cy - 1, cx + 1, cy + 1], fill=(220, 200, 240))

def save(img, name):
    img = img.quantize(PALETTE, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    img.convert("RGBA").save(os.path.join(OUT, name), optimize=True)

for f in os.listdir(OUT):
    if re.fullmatch(r"mh\d\dz\d\d\.png", f): os.remove(os.path.join(OUT, f))
lit = []
kpt = M["tile"] // STEP
for tx in range(M["cols"]):
    for tz in range(M["rows"]):
        view = kind[tz * kpt:(tz + 3) * kpt, tx * kpt:(tx + 3) * kpt]     # the tile and its 8 neighbours (margin 1)
        if not (view > 0).any(): continue
        code = f"h{tx:02d}z{tz:02d}"
        save(small.crop((tx * PX, tz * PX, tx * PX + 3 * PX, tz * PX + 3 * PX)), f"m{code}.png")
        lit.append(code)
with open(TILES_JS, "w") as f:
    f.write("// Made by tools/hollow_minimap.py. Do not edit by hand: run the tool again.\n")
    f.write("// The Hollow's minimap tiles that have a picture (textures/ui/hc/minimap/m<code>.png).\n")
    f.write("export const HOLLOW_TILES = " + str(lit).replace("'", '"').replace(" ", "") + ";\n")
total = sum(os.path.getsize(os.path.join(OUT, f"m{c}.png")) for c in lit)
print(f"{len(lit)} Hollow tiles, {total / 1e6:.1f} MB")
small.save(os.path.join(tempfile.gettempdir(), "hollow_minimap_full.png"))
