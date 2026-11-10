# Detail pass on reinforced wall textures (textures only; block JSON stays as build_walls.py left it)
import random
from PIL import Image
TB = "/mnt/project-files/siege-nights/Siege_Nights_RP/textures/blocks"
rnd = random.Random(11)
def cl(c): return tuple(max(0, min(255, int(v))) for v in c)
def sh(c, k): return cl([v * k for v in c])
def nz(c, a=6):
    n = rnd.randint(-a, a); return cl([v + n for v in c])
STEEL = [(212, 216, 222), (165, 170, 178), (110, 114, 122), (62, 64, 70)]   # light, mid, dark, outline
GOLD = [(250, 220, 120), (214, 172, 62), (150, 112, 36)]
GEM = [(200, 255, 250), (90, 225, 215), (30, 140, 140)]
NETH = (86, 78, 82)
base = Image.open(f"{TB}/siege_castle_stone.png").convert("RGBA")

def strap_h(px, y, colors=STEEL, rivets=(2, 7, 13)):
    for x in range(16):
        px[x, y - 1] = colors[3] + (255,)        # shadow line above (outline)
        px[x, y] = nz(colors[0], 4) + (255,)
        px[x, y + 1] = nz(colors[1], 4) + (255,)
        px[x, y + 2] = colors[3] + (255,)
    for x in rivets:
        px[x, y] = colors[0] + (255,); px[x, y + 1] = colors[2] + (255,)
def strap_v(px, x, y0, y1, colors=STEEL):
    for y in range(y0, y1):
        px[x - 1, y] = colors[3] + (255,); px[x, y] = nz(colors[0], 4) + (255,); px[x + 1, y] = nz(colors[1], 4) + (255,); px[x + 2, y] = colors[3] + (255,)

def iron(img):
    px = img.load()
    strap_h(px, 2); strap_h(px, 11)
    return img

def diamond(img):
    px = img.load()
    # steel frame round the face, corner brackets, a cut-diamond boss in the middle
    for i in range(16):
        for (x, y) in [(i, 0), (0, i)]: px[x, y] = STEEL[0] + (255,)
        for (x, y) in [(i, 15), (15, i)]: px[x, y] = STEEL[2] + (255,)
    for cx, cy in [(1, 1), (12, 1), (1, 12), (12, 12)]:
        for dx in range(3):
            for dy in range(3):
                if dx == 0 or dy == 0 or (dx, dy) == (1, 1): px[cx + dx, cy + dy] = (STEEL[1] if (dx, dy) != (1, 1) else GEM[1]) + (255,)
    diamond_px = {(7, 5): 0, (8, 5): 0, (6, 6): 0, (7, 6): 1, (8, 6): 1, (9, 6): 2, (5, 7): 0, (6, 7): 1, (7, 7): 0, (8, 7): 1, (9, 7): 1, (10, 7): 2,
                  (5, 8): 1, (6, 8): 1, (7, 8): 1, (8, 8): 2, (9, 8): 2, (10, 8): 2, (6, 9): 1, (7, 9): 2, (8, 9): 2, (9, 9): 2, (7, 10): 2, (8, 10): 2}
    ring = {(x + dx, y + dy) for (x, y) in diamond_px for dx in (-1, 0, 1) for dy in (-1, 0, 1)} - set(diamond_px)
    for p in ring: px[p] = STEEL[1] + (255,)
    for p, k in diamond_px.items(): px[p] = GEM[k] + (255,)
    return img

def netherite(img):
    px = img.load()
    # dark plates laid like bricks, bevelled, with gold rivets and a gold band at top and bottom
    for y in range(16):
        row = y // 4; off = 4 if row % 2 else 0
        for x in range(16):
            u = (x + off) % 8; v = y % 4
            if v == 3 or u == 7:
                px[x, y] = nz((40, 34, 38), 3) + (255,)      # seams
                continue
            k = 1.35 if v == 0 or u == 0 else 0.8 if v == 2 or u == 6 else 1.0
            px[x, y] = nz(sh(NETH, k), 4) + (255,)
    for x in range(16):
        px[x, 0] = GOLD[0] + (255,); px[x, 1] = GOLD[2] + (255,)
        px[x, 14] = GOLD[1] + (255,); px[x, 15] = GOLD[2] + (255,)
    for x, y in [(3, 5), (11, 5), (7, 9), (15, 9), (3, 13 - 1)]: px[x, y] = GOLD[0] + (255,)
    return img

CRACKS = {1: [[(2, 0), (3, 2), (5, 3), (4, 6), (6, 8)], [(13, 15), (12, 13), (12, 10)]],
          2: [[(6, 8), (8, 7), (10, 9), (12, 9), (15, 8)], [(0, 11), (2, 12), (3, 14), (5, 15)], [(9, 0), (8, 2), (10, 4)]]}
def line(a, b):
    (x0, y0), (x1, y1) = a, b; n = max(abs(x1 - x0), abs(y1 - y0)) or 1
    return [(round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n)) for i in range(n + 1)]
def crack(img, level):
    img = img.copy(); px = img.load()
    paths = CRACKS[1] + (CRACKS[2] if level >= 2 else []) if level else []
    for path in paths:
        for a, b in zip(path, path[1:]):
            for (x, y) in line(a, b):
                if 0 <= x < 16 and 0 <= y < 16:
                    px[x, y] = (24, 22, 24, 255)
                    if x + 1 < 16 and y + 1 < 16 and px[x + 1, y + 1][:3] != (24, 22, 24):
                        px[x + 1, y + 1] = sh(px[x + 1, y + 1][:3], 1.25) + (255,)   # lit edge gives the crack depth
    if level >= 2:  # chipped corners and loose bits
        for x, y in [(0, 0), (1, 0), (0, 1), (15, 15), (14, 15), (15, 14), (11, 3), (4, 10)]: px[x, y] = sh(px[x, y][:3], 0.55) + (255,)
    return img

TIERS = {"stone": lambda i: i, "iron": iron, "diamond": diamond, "netherite": netherite}
for t, fn in TIERS.items():
    plain = fn(base.copy())
    for c in range(3): crack(plain, c).save(f"{TB}/siege_castle_stone_{t}_{c}.png")

# Gates: bars take the tier's metal, with shading kept from the original, plus studs where bars cross
RAMP = {"iron": STEEL[:3], "diamond": [(205, 238, 242), (140, 192, 202), (78, 122, 132)], "netherite": [sh(NETH, 1.5), NETH, sh(NETH, 0.6)]}
STUD = {"iron": STEEL[0], "diamond": GEM[1], "netherite": GOLD[1]}
for tex in ["siege_portcullis", "siege_castle_gate"]:
    src = Image.open(f"{TB}/{tex}.png").convert("RGBA"); sp = src.load()
    for t in ["iron", "diamond", "netherite"]:
        im = src.copy(); px = im.load()
        for y in range(16):
            for x in range(16):
                r, g, b, a = sp[x, y]
                if not a or not (abs(r - g) < 20 and abs(g - b) < 20): continue   # only the grey metal parts
                lum = (r + g + b) / 3
                c = RAMP[t][0] if lum > 150 else RAMP[t][1] if lum > 90 else RAMP[t][2]
                px[x, y] = nz(c, 3) + (a,)
        full_rows = [y for y in range(16) if sum(1 for x in range(16) if sp[x, y][3]) >= 14]
        full_cols = [x for x in range(16) if sum(1 for y in range(16) if sp[x, y][3]) >= 12]
        for y in range(16):
            for x in range(16):
                r, g, b, a = sp[x, y]
                grey = a and abs(r - g) < 20 and abs(g - b) < 20
                rivet = grey and tex == "siege_castle_gate" and (r + g + b) / 3 > 150
                crossing = tex == "siege_portcullis" and y in full_rows and (y - 1) not in full_rows and x in full_cols and (x - 1) not in full_cols
                if rivet or crossing: px[x, y] = STUD[t] + (255,)
        im.save(f"{TB}/{tex}_{t}.png")

names = [f"siege_castle_stone_{t}_{c}" for t in TIERS for c in range(3)] + [f"{g}_{t}" for g in ["siege_portcullis", "siege_castle_gate"] for t in ["iron", "diamond", "netherite"]]
sheet = Image.new("RGBA", (len(names) * 84, 84), (225, 225, 225, 255))
for i, n in enumerate(names):
    im = Image.open(f"{TB}/{n}.png").convert("RGBA").resize((80, 80), Image.NEAREST); sheet.paste(im, (i * 84, 2), im)
sheet.save("/tmp/claude-0/-home-user/062b6f0f-3bda-5216-b2d8-5f2576882c90/scratchpad/walls_new.png")
print("ok")
