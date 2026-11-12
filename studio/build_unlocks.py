"""Placeholder art for the boss unlocks (scripts/unlocks/): Millbrook's stopped clocks and the well crank.

    python3 studio/build_unlocks.py            writes the PNGs (never overwrites one that exists)
    python3 studio/build_unlocks.py --force    repaint them all

16x16, opaque, painted from studio/art/palette.py so they sit with the rest of the pack. The textures thread may
paint final art over them; keep the file names.
"""
import math
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "art"))
from palette import M  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "Siege_Nights_RP", "textures", "blocks", "unlocks")
FORCE = "--force" in sys.argv

GOLD, WOOD, IRON, DIAL = M["gold"], M["spruce"], M["iron"], M["parchment"]
INK = (34, 28, 40)


def blank(fill):
    return Image.new("RGBA", (16, 16), fill + (255,))


def planks(img):
    """Dark spruce boards with a brass corner at each corner."""
    px = img.load()
    for y in range(16):
        for x in range(16):
            board = (y // 4) % 2
            grain = (x * 3 + y * 7 + board * 5) % 11 == 0
            px[x, y] = WOOD[1 + board] + (255,) if not grain else WOOD[0] + (255,)
            if y % 4 == 3:
                px[x, y] = WOOD[0] + (255,)
    for cx, cy in ((0, 0), (15, 0), (0, 15), (15, 15)):
        for dx, dy in ((0, 0), (1 if cx == 0 else -1, 0), (0, 1 if cy == 0 else -1)):
            px[cx + dx, cy + dy] = GOLD[3] + (255,)
    return img


def line(px, x0, y0, angle, length, color):
    for i in range(int(length * 4) + 1):
        t = i / 4
        x = x0 + math.sin(angle) * t
        y = y0 - math.cos(angle) * t
        xi, yi = int(round(x)), int(round(y))
        if 0 <= xi < 16 and 0 <= yi < 16:
            px[xi, yi] = color


def clock_face(hour, minute, lit):
    img = planks(blank(WOOD[1]))
    px = img.load()
    c = 7.5
    for y in range(16):
        for x in range(16):
            d = math.hypot(x - c, y - c)
            if d <= 5.6:
                tone = DIAL[4] if lit else DIAL[3]
                if d > 4.8:
                    tone = DIAL[2]
                px[x, y] = tone + (255,)
            elif d <= 6.9:
                px[x, y] = (GOLD[4] if (x + y) % 3 == 0 else GOLD[2]) + (255,)
    for h in range(12):  # hour pips
        a = h / 12 * math.tau
        x, y = int(round(c + math.sin(a) * 4.4)), int(round(c - math.cos(a) * 4.4))
        px[x, y] = DIAL[1] + (255,)
    ma = minute / 60 * math.tau
    ha = (hour % 12 + minute / 60) / 12 * math.tau
    line(px, 8, 8, ha, 2.6, INK + (255,))
    line(px, 8, 8, ma, 4.2, INK + (255,))
    px[8, 8] = GOLD[1] + (255,)
    if lit:  # the struck clock: a hairline crack across the glass, from the minute that finally ended
        for x, y in ((3, 5), (4, 6), (4, 7), (5, 8)):
            px[x, y] = DIAL[5] + (255,)
    return img


def crank(face, wound):
    img = blank(WOOD[2])
    px = img.load()
    for y in range(16):
        for x in range(16):
            px[x, y] = (WOOD[2] if (x + (y // 3)) % 5 else WOOD[1]) + (255,)
            if y in (2, 13):
                px[x, y] = IRON[2] + (255,)  # iron bands
            if y in (1, 14):
                px[x, y] = IRON[1] + (255,)
    if face:
        for y in range(4, 12):  # a brass plate
            for x in range(4, 12):
                px[x, y] = (GOLD[3] if (x + y) % 4 else GOLD[4]) + (255,)
        for x in range(4, 12):
            px[x, 4] = GOLD[5] + (255,)
            px[x, 11] = GOLD[1] + (255,)
        if wound:  # the key sits in the hole, its bow standing out and glowing
            for x, y in ((7, 6), (8, 6), (6, 7), (9, 7), (6, 8), (9, 8), (7, 9), (8, 9)):
                px[x, y] = GOLD[5] + (255,)
            px[7, 7] = px[8, 7] = px[7, 8] = px[8, 8] = (255, 236, 160, 255)
        else:  # an empty keyhole
            for x, y in ((7, 6), (8, 6), (7, 7), (8, 7), (7, 8), (7, 9), (8, 9), (8, 8)):
                px[x, y] = INK + (255,)
    return img


def save(img, name):
    path = os.path.join(OUT, name + ".png")
    if os.path.exists(path) and not FORCE:
        return
    os.makedirs(OUT, exist_ok=True)
    img.save(path)
    print("wrote", os.path.relpath(path, ROOT))


save(planks(blank(WOOD[1])), "siege_stopped_clock_case")
save(clock_face(3, 17, False), "siege_stopped_clock_317")
save(clock_face(3, 18, True), "siege_stopped_clock_318")
save(crank(False, False), "siege_well_crank_side")
save(crank(True, False), "siege_well_crank_keyhole")
save(crank(True, True), "siege_well_crank_wound")
