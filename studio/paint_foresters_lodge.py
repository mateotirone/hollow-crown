"""Paints the Forester's Lodge block (16x16 side and top) in the Stables block's style. Run from the repo root."""
from PIL import Image
FRAME, FRAME_D, DARK = (92, 58, 32), (66, 40, 22), (34, 26, 22)
BARK, BARK_D, RING, RING_D, CORE = (98, 70, 44), (72, 50, 30), (196, 156, 98), (160, 120, 70), (128, 92, 52)
STEEL, STEEL_D, HAFT, LEAF, LEAF_D = (200, 200, 196), (140, 140, 138), (150, 104, 60), (88, 140, 52), (58, 100, 36)


def frame(px):
    for i in range(16):
        for j in (0, 15): px[i, j] = FRAME_D; px[j, i] = FRAME_D
        for j in (1, 14): px[i, j] = FRAME; px[j, i] = FRAME
    for i in range(1, 15): px[i, 8] = FRAME; px[i, 9] = FRAME_D


def log_end(px, cx, cy):
    for dx in range(-2, 3):
        for dy in range(-2, 3):
            d = abs(dx) + abs(dy)
            if d > 3: continue
            px[cx + dx, cy + dy] = BARK_D if d == 3 else RING if d == 2 else RING_D if d == 1 else CORE


side = Image.new("RGBA", (16, 16), DARK); px = side.load(); frame(px)
# upper bay: an axe hung on the wall and a sapling in a pot
for y in range(3, 8): px[5, y] = HAFT
for (x, y) in [(3, 3), (4, 3), (3, 4), (4, 4), (4, 2), (6, 3)]: px[x, y] = STEEL
px[3, 5] = STEEL_D
for (x, y, c) in [(10, 7, BARK_D), (11, 7, BARK_D), (12, 7, BARK_D), (11, 6, HAFT), (11, 5, HAFT), (10, 4, LEAF), (12, 4, LEAF), (11, 3, LEAF_D), (10, 3, LEAF_D), (12, 5, LEAF), (9, 5, LEAF_D)]: px[x, y] = c
# lower bay: a stack of cut logs, end grain out
for (cx, cy) in [(4, 12), (8, 12), (12, 12)]: log_end(px, cx, cy)
side.save("Siege_Nights_RP/textures/blocks/forestry/siege_foresters_lodge_side.png")

top = Image.new("RGBA", (16, 16), BARK); px = top.load()
for x in range(16):
    for y in range(16):
        d = max(abs(x - 7.5), abs(y - 7.5))
        px[x, y] = BARK_D if d > 7 else BARK if d > 6 else RING if int(d) % 2 == 0 else RING_D
for (x, y) in [(7, 7), (8, 7), (7, 8), (8, 8)]: px[x, y] = CORE
for i in range(4, 12): px[i, 11 - (i - 4) // 2] = STEEL_D   # an axe cut across the stump
top.save("Siege_Nights_RP/textures/blocks/forestry/siege_foresters_lodge_top.png")
