"""Paint the minimap: cut the top-down picture of the generated world into HUD map tiles.

    python3 tools/minimap_tiles.py [preview.png] [terrain.npz]

Defaults are the files map/genworld.py and map/draw_map.py write in the shared folder:
    /mnt/project-files/siege-nights/map/hollow-crown-full-map-preview.png   (1 px = 1 block, from x,z = -1264)
    /mnt/project-files/siege-nights/map/terrain.npz                          (region of every spot)

Run it again whenever the world map is regenerated, then commit the changed files.

Writes:
    Siege_Nights_RP/textures/ui/hc/minimap/mXXZZ.png   one view per 64-block tile: that tile and its 8 neighbours
    Siege_Nights_RP/textures/ui/hc/minimap/mnone.png   "uncharted" (off the map, other dimensions)
    Siege_Nights_RP/textures/ui/hc/minimap/a0..a7.png  the player's arrow, north-up, turning clockwise
    Siege_Nights_RP/textures/ui/hc/minimap/frame.png   the border
    Siege_Nights_BP/scripts/minimap/regions.js         which region each 32-block cell is in (for the place label)

The numbers here must match scripts/minimap/data.js (TILE, TILES, ORIGIN) and the layout in
Siege_Nights_RP/ui/hud_screen.json (made by tools/minimap_ui.py).
"""
import os, re, sys, math
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHARED = "/mnt/project-files/siege-nights/map"
PREVIEW = sys.argv[1] if len(sys.argv) > 1 else os.path.join(SHARED, "hollow-crown-full-map-preview.png")
TERRAIN = sys.argv[2] if len(sys.argv) > 2 else os.path.join(SHARED, "terrain.npz")
OUT = os.path.join(ROOT, "Siege_Nights_RP", "textures", "ui", "hc", "minimap")
REGIONS_JS = os.path.join(ROOT, "Siege_Nights_BP", "scripts", "minimap", "regions.js")
CONFIG = os.path.join(ROOT, "Siege_Nights_BP", "scripts", "plots", "config.js")

PREVIEW_ORIGIN = -1264      # world x/z of the preview's top-left pixel
ORIGIN = -1280              # world x/z where tile 0 starts
TILE = 64                   # blocks per tile
TILES = 40                  # tiles per side (-1280 .. 1280)
PX = 24                     # pixels per tile in the textures; a view is 3 x 3 tiles = 72 px
CELL = 32                   # region cells for the label
UNCHARTED = (38, 34, 44)
PALETTE = 64

os.makedirs(OUT, exist_ok=True)
os.makedirs(os.path.dirname(REGIONS_JS), exist_ok=True)

# ---------------------------------------------------------------- the whole map, downscaled once
pre = Image.open(PREVIEW).convert("RGB")
pad = PREVIEW_ORIGIN - (ORIGIN - TILE)                   # the canvas starts one tile before tile 0
side = (TILES + 2) * TILE
canvas = Image.new("RGB", (side, side), UNCHARTED)
canvas.paste(pre, (pad, pad))
small = canvas.resize(((TILES + 2) * PX,) * 2, Image.BOX)

# night-ish look: a touch darker and cooler than the daylight render, so it sits on the HUD quietly
a = np.asarray(small, np.float32)
grey = a.mean(axis=2, keepdims=True)
a = (a * 0.8 + grey * 0.2) * 0.88 + np.array([0, 2, 8], np.float32)
small = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))

# settlements: plots (gold) and towns (pale), from the add-on's own config
cfg = open(CONFIG).read()
plots = [(int(x), int(z)) for x, z in re.findall(r'\{ name: "[^"]+", region: "[^"]+", x: (-?\d+), z: (-?\d+)', cfg)]
wards = [(n, int(x), int(z), rest) for n, x, z, rest in re.findall(r'\{ name: "([^"]+)", x: (-?\d+), z: (-?\d+), r: \d+([^}]*)\}', cfg)]
towns = [(x, z) for n, x, z, rest in wards if "thin: true" not in rest and n != "the Shut Pass"]
d = ImageDraw.Draw(small)
def at(x, z): return ((x - (ORIGIN - TILE)) * PX / TILE, (z - (ORIGIN - TILE)) * PX / TILE)
for x, z in towns:
    cx, cy = at(x, z)
    d.rectangle([cx - 2, cy - 2, cx + 2, cy + 2], fill=(20, 18, 24)); d.rectangle([cx - 1, cy - 1, cx + 1, cy + 1], fill=(232, 228, 214))
for x, z in plots:
    cx, cy = at(x, z)
    d.ellipse([cx - 2.5, cy - 2.5, cx + 2.5, cy + 2.5], fill=(20, 18, 24)); d.ellipse([cx - 1.5, cy - 1.5, cx + 1.5, cy + 1.5], fill=(236, 190, 70))

# ---------------------------------------------------------------- tiles
def save(img, name):
    img.quantize(PALETTE, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(os.path.join(OUT, name), optimize=True)

for f in os.listdir(OUT):                                # drop tiles from an older, differently sized map
    if re.fullmatch(r"m\d{4}\.png", f): os.remove(os.path.join(OUT, f))
for tx in range(TILES):
    for tz in range(TILES):
        save(small.crop((tx * PX, tz * PX, tx * PX + 3 * PX, tz * PX + 3 * PX)), f"m{tx:02d}{tz:02d}.png")

none = Image.new("RGB", (3 * PX, 3 * PX), UNCHARTED)
nd = ImageDraw.Draw(none)
for i in range(-3 * PX, 3 * PX, 6): nd.line([(i, 3 * PX), (i + 3 * PX, 0)], fill=(46, 41, 54))
none.save(os.path.join(OUT, "mnone.png"), optimize=True)

# ---------------------------------------------------------------- arrow: drawn big, turned, shrunk
BIG, ARROW = 120, 12
base = Image.new("RGBA", (BIG, BIG), (0, 0, 0, 0))
bd = ImageDraw.Draw(base)
tip, left, notch, right = (60, 4), (14, 112), (60, 88), (106, 112)
bd.polygon([tip, left, notch, right], fill=(16, 12, 20, 255))
k = 0.6; c = (60, 70)
inner = [(c[0] + (p[0] - c[0]) * k, c[1] + (p[1] - c[1]) * k) for p in (tip, left, notch, right)]
bd.polygon(inner, fill=(255, 248, 225, 255))
for i in range(8):
    base.rotate(-45 * i, resample=Image.BICUBIC, center=(60, 60)).resize((ARROW, ARROW), Image.BOX).save(os.path.join(OUT, f"a{i}.png"), optimize=True)

# ---------------------------------------------------------------- frame: dark iron rim with a thin brass line
F = 3 * PX + 8
frame = Image.new("RGBA", (F, F), (0, 0, 0, 0))
fd = ImageDraw.Draw(frame)
fd.rectangle([0, 0, F - 1, F - 1], fill=(28, 25, 32, 255))
fd.rectangle([1, 1, F - 2, F - 2], outline=(70, 62, 74, 255))
fd.rectangle([3, 3, F - 4, F - 4], outline=(150, 118, 64, 255))
frame.save(os.path.join(OUT, "frame.png"), optimize=True)

# ---------------------------------------------------------------- regions for the label
t = np.load(TERRAIN)
H = int(t["H"]); N = int(t["N"]); S = N / (2 * H)
reg, land = t["reg"], t["land"]
n = TILES * TILE // CELL
rows = []
for j in range(n):
    row = ""
    for i in range(n):
        x = ORIGIN + i * CELL + CELL / 2; z = ORIGIN + j * CELL + CELL / 2
        if abs(x) > H or abs(z) > H: row += " "; continue
        gx = min(N - 1, int((x + H) * S)); gz = min(N - 1, int((z + H) * S))
        row += str(int(reg[gz, gx])) if land[gz, gx] else "."
    rows.append(row)
with open(REGIONS_JS, "w") as f:
    f.write("// Made by tools/minimap_tiles.py from map/terrain.npz. Do not edit by hand: run the tool again.\n")
    f.write(f"// One row per {CELL} blocks of z from {ORIGIN}, one character per {CELL} blocks of x:\n")
    f.write("// 0 Aldmere Vale, 1 Frostmarch, 2 Saltreach, 3 Blackfen, 4 Emberwaste, . sea, space off the map.\n")
    f.write(f"export const REGION_CELL = {CELL};\nexport const REGION_ROWS = [\n")
    for r in rows: f.write(f'  "{r}",\n')
    f.write("];\n")

total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
print(f"{TILES * TILES} tiles + extras in {os.path.relpath(OUT, ROOT)}, {total / 1e6:.1f} MB; regions {n}x{n}")
