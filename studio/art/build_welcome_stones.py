"""Textures for the welcome hall's miniature map: the Map Stones (one per plot, three states) and the hall Waystone.
Run: python3 studio/art/build_welcome_stones.py    (writes Siege_Nights_RP/textures/blocks/welcome/ and a preview sheet)

Map Stone: a small dressed-stone marker. Each side has a carved frame with a glowing cut gem set in it and two
surveyor's ticks; the top has a compass star round the gem. Green = free, amber = run by a lord, dark = taken
(the gem is unlit, the carving filled with soot). Waystone: older, weathered stone with a pale blue spiral rune
running up each face and a ring of light on top.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from palette import M, REGIONS, fixed, ramp
from texlib import Tex, R, line, frame, sheet
import random

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "Siege_Nights_RP", "textures", "blocks", "welcome")
os.makedirs(OUT, exist_ok=True)

STONE = ramp('#6f6b70', 0.12, 0.70, cool=0.16, warm=0.08, sat=0.6)      # cool dressed slate
OLD = ramp('#7e7a72', 0.13, 0.72, cool=0.12, warm=0.10, sat=0.7)        # weathered waystone grey
GEMS = {
    "free": fixed('#0b3a1c', '#14662e', '#24a046', '#52d46a', '#a4f2a0', '#e6ffd8'),
    "lord": fixed('#4a2a08', '#80500e', '#c08418', '#eeb83a', '#fadc78', '#fff4c8'),
    "taken": fixed('#141218', '#1e1b23', '#2a2630', '#38333f', '#4a4452', '#5e5866'),
}
GLOW = fixed('#0c2a3c', '#14506a', '#2a86a6', '#56c0dc', '#a2e6f4', '#e2fbff')   # pale Hollow-ish blue, kept calm


def dressed(seed, ramp_=STONE):
    """Dressed stone: broad tone clusters, a few 2-3 px chips, light from the top-left."""
    t = Tex(seed=seed); r = random.Random(seed)
    for y in range(16):
        for x in range(16):
            v = 2 + (1 if (x // 4 + y // 5 + seed) % 3 == 0 else 0)
            t.set(x, y, R(ramp_, v))
    for _ in range(4):
        x, y = r.randrange(2, 13), r.randrange(2, 13)
        t.set(x, y, R(ramp_, 1)); t.set(x + 1, y, R(ramp_, 1)); t.set(x, y + 1, R(ramp_, 4))
    frame(t, ramp_, 0, 1)
    return t


def gem(t, cx, cy, g, w=2, h=4, lit=True):
    """A cut gem: a lozenge with a bright facet top-left and a dark one bottom-right."""
    for y in range(cy - h, cy + h + 1):
        span = round(w * (1 - abs(y - cy) / (h + 1)) + 0.4)
        for x in range(cx - span, cx + span + 1):
            v = 3
            if x < cx and y < cy: v = 4
            if x > cx and y > cy: v = 2
            if x - cx == -span or abs(y - cy) == h: v = 1
            t.set(x, y, R(g, v))
    t.set(cx - 1, cy - 2, R(g, 5 if lit else 3))
    if lit: t.set(cx, cy - 1, R(g, 5))


def map_stone(state):
    g = GEMS[state]
    lit = state != "taken"
    soot = R(STONE, 0)
    # side: an inner carved frame, the gem, a tick above and below
    t = dressed(51)
    for i in range(3, 13):
        for (x, y) in ((i, 2), (i, 13), (2, i), (13, i)):
            t.set(x, y, R(STONE, 1) if lit else soot)
        t.set(i, 3, R(STONE, 4)); t.set(3, i, R(STONE, 4))          # lit lip inside the cut (top-left light)
    t.set(2, 2, R(STONE, 1)); t.set(13, 13, R(STONE, 1))
    gem(t, 8, 8, g, 2, 4, lit)
    for y in (4, 12):
        t.set(8, y, R(g, 2) if lit else soot)
    for x in (5, 11):
        t.set(x, 8, R(g, 1) if lit else soot)
    if lit:   # a faint glow on the stone round the gem
        for (x, y) in ((6, 6), (10, 10), (6, 10), (10, 6)):
            t.set(x, y, R(g, 1))
    t.save(os.path.join(OUT, f"map_stone_side_{state}.png"))
    # top: a compass star cut round a round gem
    t = dressed(52)
    for i in range(2, 14):
        t.set(i, 7, R(g, 2) if lit else soot); t.set(7, i, R(g, 2) if lit else soot)
        t.set(i, 8, R(STONE, 1)); t.set(8, i, R(STONE, 1))
    for d in range(2, 5):
        for sx, sy in ((1, 1), (-1, 1), (1, -1), (-1, -1)):
            t.set(7 + sx * d + (1 if sx > 0 else 0), 7 + sy * d + (1 if sy > 0 else 0), R(STONE, 1) if lit else soot)
    for y in range(5, 11):
        for x in range(5, 11):
            d = ((x - 7.5) ** 2 + (y - 7.5) ** 2) ** 0.5
            if d < 2.9:
                t.set(x, y, R(g, 4 if x + y < 15 else 3 if d < 2 else 2))
    t.set(6, 6, R(g, 5 if lit else 3))
    t.set(7, 1, R(g, 4) if lit else soot)        # north mark
    t.save(os.path.join(OUT, f"map_stone_top_{state}.png"))


def waystone():
    # side: weathered stone, a spiral rune climbing the face
    t = dressed(61, OLD)
    r = random.Random(61)
    for _ in range(5):      # moss and lichen flecks low down
        x, y = r.randrange(1, 15), r.randrange(11, 15)
        t.set(x, y, R(REGIONS['vale']['foliage'], 2))
    path = [(8, 14), (5, 12), (5, 9), (8, 8), (11, 7), (11, 4), (8, 2)]
    for a, b in zip(path, path[1:]):
        for (x, y) in line(a, b):
            t.set(x, y, R(GLOW, 3)); t.set(x + 1, y, R(OLD, 1))
    for (x, y) in ((8, 14), (8, 8), (8, 2)):
        t.set(x, y, R(GLOW, 5))
    t.save(os.path.join(OUT, "hall_waystone_side.png"))
    # top: a ring of light round a dark centre
    t = dressed(62, OLD)
    for y in range(16):
        for x in range(16):
            d = ((x - 7.5) ** 2 + (y - 7.5) ** 2) ** 0.5
            if 4.6 <= d < 5.8: t.set(x, y, R(GLOW, 4 if x + y < 15 else 3))
            elif 3.6 <= d < 4.6: t.set(x, y, R(OLD, 1))
            elif d < 1.6: t.set(x, y, R(GLOW, 2))
    t.save(os.path.join(OUT, "hall_waystone_top.png"))


for s in GEMS:
    map_stone(s)
waystone()
names = [f"map_stone_{f}_{s}.png" for s in GEMS for f in ("side", "top")] + ["hall_waystone_side.png", "hall_waystone_top.png"]
sh = sheet([os.path.join(OUT, n) for n in names], scale=12, cols=4, labels=[n[:-4].replace("_", " ") for n in names])
prev = "/mnt/project-files/siege-nights/miniature/stone-textures.png"
os.makedirs(os.path.dirname(prev), exist_ok=True)
sh.save(prev)
print("wrote", len(names), "textures and", prev)
