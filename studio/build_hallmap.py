#!/usr/bin/env python3
"""Art for the Hall Map (scripts/townhall/hallmap.js): the painted realm and the marks laid over it.

  textures/ui/hc/map/realm.png        the 2,500 x 2,500 playable map, parchment-toned, 16 x 16 cells
  textures/ui/hc/map/fog.png, clear   a cell nobody from the settlement has walked / an open cell
  textures/ui/hc/map/<mark>[_f].png   marks: y_<dye> your settlement, b_<dye> another, npc, town, place, plot;
                                      "_f" is the same mark on fog (settlements and towns show through fog)

Source: the in-game render of the world map in the shared folder. Rerun after the world is regenerated:
    python3 studio/build_hallmap.py [preview.png]
The UI that draws all this is in studio/build_tree_ui.py (server_form.json).
"""
import os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "Siege_Nights_RP", "textures", "ui", "hc", "map")
PREVIEW = sys.argv[1] if len(sys.argv) > 1 else "/mnt/project-files/siege-nights/map/hollow-crown-full-map-preview.png"
PREVIEW_ORIGIN = -1264      # world x/z of the preview's top-left pixel (as tools/minimap_tiles.py)
ORIGIN, SPAN, GRID = -1250, 2500, 16   # must match hallmap.js
CELL_PX = 24                # art pixels per cell (the UI draws a cell 12 px wide, so art is 2x)
SIDE = GRID * CELL_PX
DYES = {  # siege/constants.js DYE_RGB
    "white": (233, 236, 236), "orange": (240, 118, 19), "magenta": (189, 68, 179), "light_blue": (58, 175, 217),
    "yellow": (248, 197, 39), "lime": (112, 185, 25), "pink": (237, 141, 172), "gray": (62, 68, 71),
    "light_gray": (142, 142, 134), "cyan": (21, 137, 145), "purple": (121, 42, 172), "blue": (53, 57, 157),
    "brown": (114, 71, 40), "green": (84, 109, 27), "red": (161, 39, 34), "black": (29, 29, 33),
}
INK = (34, 24, 14, 255)
os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------- the realm
pre = Image.open(PREVIEW).convert("RGB")
o = ORIGIN - PREVIEW_ORIGIN
big = pre.crop((o, o, o + SPAN, o + SPAN)).resize((SIDE, SIDE), Image.LANCZOS)
a = np.asarray(big, np.float32) / 255
grey = a.mean(axis=2, keepdims=True)
parch = np.array([0.93, 0.86, 0.70])
a = (a * 0.55 + grey * 0.45) * 0.72 + parch * 0.28
a *= np.array([1.0, 0.97, 0.88])
yy, xx = np.mgrid[0:SIDE, 0:SIDE] / (SIDE - 1) - 0.5           # darker toward the edges, like old paper
a *= (1 - 0.35 * np.clip((xx ** 2 + yy ** 2) * 2.2 - 0.25, 0, 1))[..., None]
realm = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).convert("RGBA")
d = ImageDraw.Draw(realm)
d.rectangle([0, 0, SIDE - 1, SIDE - 1], outline=INK, width=2)
realm.save(os.path.join(OUT, "realm.png"), optimize=True)

# ---------------------------------------------------------------- cells
def fog():
    im = Image.new("RGBA", (CELL_PX, CELL_PX), (74, 60, 44, 178))
    d = ImageDraw.Draw(im)
    for i in range(-CELL_PX, CELL_PX, 6):
        d.line([(i, CELL_PX), (i + CELL_PX, 0)], fill=(58, 46, 33, 200), width=1)
    return im

def clear():
    return Image.new("RGBA", (CELL_PX, CELL_PX), (0, 0, 0, 0))

S = 4  # marks are drawn big and shrunk so the edges stay smooth
def mark(draw_fn):
    im = Image.new("RGBA", (CELL_PX * S, CELL_PX * S), (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(im), CELL_PX * S)
    return im.resize((CELL_PX, CELL_PX), Image.LANCZOS)

def banner(rgb, ring):
    def f(d, n):
        if ring:
            d.ellipse([n * .04, n * .04, n * .96, n * .96], outline=(206, 160, 52, 255), width=int(n * .09))
        x0, x1, y0, y1 = n * .28, n * .72, n * .18, n * .66
        d.polygon([(x0, y0), (x1, y0), (x1, y1), (n / 2, n * .82), (x0, y1)], fill=rgb + (255,), outline=INK, width=int(n * .07))
        d.line([(n * .22, y0), (n * .78, y0)], fill=INK, width=int(n * .08))
    return mark(f)

def town(d, n):
    d.rectangle([n * .26, n * .40, n * .74, n * .76], fill=(239, 228, 200, 255), outline=INK, width=int(n * .07))
    d.polygon([(n * .20, n * .42), (n / 2, n * .16), (n * .80, n * .42)], fill=(150, 62, 40, 255), outline=INK)
    d.rectangle([n * .45, n * .58, n * .55, n * .76], fill=INK)

def place(d, n):
    d.polygon([(n / 2, n * .16), (n * .80, n * .76), (n * .20, n * .76)], fill=(107, 74, 138, 255), outline=INK, width=int(n * .07))

def plot(d, n):
    for k in range(12):  # a dashed ring: a plot nobody holds
        a0 = k * 30
        d.arc([n * .24, n * .24, n * .76, n * .76], a0, a0 + 16, fill=INK, width=int(n * .08))

def npc(d, n):
    banner_rgb = (92, 24, 24)
    x0, x1, y0, y1 = n * .28, n * .72, n * .18, n * .66
    d.polygon([(x0, y0), (x1, y0), (x1, y1), (n / 2, n * .82), (x0, y1)], fill=banner_rgb + (255,), outline=INK, width=int(n * .07))
    d.line([(n * .36, n * .28), (n * .64, n * .58)], fill=(225, 210, 180, 255), width=int(n * .06))
    d.line([(n * .64, n * .28), (n * .36, n * .58)], fill=(225, 210, 180, 255), width=int(n * .06))

marks = {"town": mark(town), "place": mark(place), "plot": mark(plot), "npc": mark(npc)}
for dye, rgb in DYES.items():
    marks["b_" + dye] = banner(rgb, False)
    marks["y_" + dye] = banner(rgb, True)

fog().save(os.path.join(OUT, "fog.png"))
clear().save(os.path.join(OUT, "clear.png"))
for name, im in marks.items():
    im.save(os.path.join(OUT, name + ".png"))
    on_fog = fog(); on_fog.alpha_composite(im); on_fog.save(os.path.join(OUT, name + "_f.png"))
print(f"hall map: realm.png {SIDE}px, {len(marks) * 2 + 2} cell pictures in {OUT}")

# the frame a cell shows under the pointer
hover = Image.new("RGBA", (CELL_PX, CELL_PX), (255, 230, 150, 40))
ImageDraw.Draw(hover).rectangle([0, 0, CELL_PX - 1, CELL_PX - 1], outline=(240, 196, 80, 255), width=2)
hover.save(os.path.join(OUT, "hover.png"))
