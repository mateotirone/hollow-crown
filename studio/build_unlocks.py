"""Placeholder art for the boss unlocks (scripts/unlocks/): Millbrook's clocks and well crank, the Hallowmere cairns,
the drowned chapel's stones and altar, the Faceless Vault's statues and seal, and the root cradle.

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


# ---------------------------------------------------------------- the other four bosses
STONE, SAND, MOSS, ROOTS, SEA = M["iron"], M["parchment"], [(40, 58, 34), (58, 82, 44), (84, 112, 58), (112, 140, 72), (150, 172, 96), (190, 205, 140)], WOOD, [(20, 40, 52), (30, 64, 76), (44, 98, 104), (70, 132, 130), (110, 170, 160), (170, 214, 200)]


def noise_fill(ramp, lo=1, hi=3, seed=1):
    img = blank(ramp[2])
    px = img.load()
    for y in range(16):
        for x in range(16):
            v = ((x * 73 + y * 151 + seed * 37) ^ (x * y + seed)) % 7
            px[x, y] = ramp[lo + v % (hi - lo + 1)] + (255,)
    return img


def stamp(img, pts, color):
    px = img.load()
    for x, y in pts:
        if 0 <= x < 16 and 0 <= y < 16:
            px[x, y] = color + (255,)
    return img


def outline_shape(img, rows, color, ox=0, oy=0):
    """rows: list of strings, '#' marks a pixel."""
    pts = [(ox + x, oy + y) for y, r in enumerate(rows) for x, ch in enumerate(r) if ch == "#"]
    return stamp(img, pts, color)


BEAST_ART = {
    "hare": ["..#..#....", "..#..#....", "..#..#....", "..####....", ".######...", "#######...", ".######.#.", "..#####.#.", "..#...#..."],
    "fox": ["#.....#...", "##...##...", "#######...", ".#####....", "..###.....", "..####....", ".######...", "#######.##", ".#.#.#####"],
    "stag": ["#.#...#.#.", "#.#...#.#.", ".###.###..", "...###....", "...###....", "..#####...", ".#######..", ".#.#.#.#..", ".#.....#.."],
    "wolf": ["..#...#...", ".###.###..", ".#######..", "..#####...", "...###....", "..#####...", ".#######..", "########.#", ".#.#.#.###"],
}


def cairn_face(beast):
    img = noise_fill(STONE, 1, 3, seed=len(beast))
    return outline_shape(img, BEAST_ART[beast], STONE[5], 3, 4)


def cairn_top(horn):
    img = noise_fill(STONE, 1, 3, seed=9)
    stamp(img, [(x, 8) for x in range(4, 12)] + [(x, 7) for x in range(5, 11)], STONE[0])
    if horn:
        stamp(img, [(4, 9), (5, 8), (6, 8), (7, 7), (8, 7), (9, 7), (10, 6), (11, 5), (11, 4)], (236, 232, 214))
        stamp(img, [(5, 9), (6, 9), (7, 8), (8, 8), (9, 8), (10, 7)], (200, 194, 172))
    return img


CARVING_ART = {
    "gull": ["..........", "##......##", ".##....##.", "..##..##..", "...####...", "....##...."],
    "anchor": ["....##....", "...#..#...", "....##....", "....##....", "#...##...#", ".#..##..#.", "..######.."],
    "fish": ["..........", "...####..#", ".########.", "##.######.", ".########.", "...####..#"],
    "star": ["....#.....", "....#.....", "#########.", "..#####...", ".##...##..", "#.......#."],
}


def floor_stone(carving):
    img = noise_fill(SEA, 1, 3, seed=len(carving or "") + 3)
    if carving is None:
        img = blank(SEA[0])
        stamp(img, [(x, y) for x in range(3, 13) for y in range(3, 13)], (10, 18, 24))
        return img
    return outline_shape(img, CARVING_ART[carving], SEA[5], 3, 5)


def altar(top, ring):
    img = noise_fill(SEA, 1, 3, seed=21)
    if top:
        stamp(img, [(x, 1) for x in range(16)] + [(x, 14) for x in range(16)], SEA[4])
        if ring:
            stamp(img, [(7, 6), (8, 6), (6, 7), (9, 7), (6, 8), (9, 8), (7, 9), (8, 9)], GOLD[4])
            stamp(img, [(8, 5)], (220, 236, 255))
    else:
        stamp(img, [(x, 3) for x in range(16)] + [(x, 12) for x in range(16)], SEA[0])
    return img


def bust(face):
    img = noise_fill(SAND, 2, 4, seed=5)
    if face:  # a face chiselled flat: rough scar where the features were
        stamp(img, [(x, y) for x in range(4, 12) for y in range(4, 13) if (x * 3 + y) % 4 == 0], SAND[1])
        stamp(img, [(x, 3) for x in range(4, 12)], SAND[5])
    return img


def vault_seal(pressed):
    img = noise_fill(SAND, 2, 4, seed=8)
    for y in range(16):
        for x in range(16):
            d = math.hypot(x - 7.5, y - 7.5)
            if 4.5 <= d <= 6:
                img.putpixel((x, y), GOLD[2] + (255,))
            elif d < 4.5:
                img.putpixel((x, y), (GOLD[1] if pressed else SAND[5]) + (255,))
    if pressed:  # a steward's crown, no face under it
        stamp(img, [(5, 6), (7, 5), (9, 6), (5, 7), (6, 7), (7, 7), (8, 7), (9, 7), (10, 6), (10, 7)], GOLD[4])
    return img


def cradle(top, laid):
    img = noise_fill(ROOTS, 0, 2, seed=11)
    px = img.load()
    for y in range(16):
        for x in range(16):
            if (x + y * 2) % 5 == 0:
                px[x, y] = ROOTS[3] + (255,)
    if top:
        stamp(img, [(x, y) for x in range(4, 12) for y in range(4, 12)], MOSS[2])
        if laid:  # the doll of sticks and hair
            stamp(img, [(7, 5), (8, 5), (7, 6), (8, 6)], (150, 120, 80))
            stamp(img, [(x, 7) for x in range(5, 11)] + [(7, y) for y in range(7, 11)] + [(8, y) for y in range(7, 11)], (110, 82, 50))
            stamp(img, [(6, 11), (9, 11)], (110, 82, 50))
    return img


for b in BEAST_ART:
    save(cairn_face(b), f"siege_hunt_cairn_{b}")
save(noise_fill(STONE, 1, 3, seed=4), "siege_cairn_stone")
save(cairn_top(False), "siege_hunters_cairn_top")
save(cairn_top(True), "siege_hunters_cairn_top_horn")
for c in CARVING_ART:
    save(floor_stone(c), f"siege_carved_floor_{c}")
save(floor_stone(None), "siege_carved_floor_lifted")
save(noise_fill(SEA, 1, 3, seed=2), "siege_chapel_stone")
save(altar(False, False), "siege_drowned_altar_side")
save(altar(True, False), "siege_drowned_altar_top")
save(altar(True, True), "siege_drowned_altar_top_ring")
save(bust(False), "siege_faceless_bust_side")
save(bust(True), "siege_faceless_bust_face")
save(noise_fill(SAND, 2, 4, seed=6), "siege_vault_sandstone")
save(vault_seal(False), "siege_vault_seal_blank")
save(vault_seal(True), "siege_vault_seal_pressed")
save(cradle(False, False), "siege_root_cradle_side")
save(cradle(True, False), "siege_root_cradle_top")
save(cradle(True, True), "siege_root_cradle_top_laid")
