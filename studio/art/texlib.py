"""Painting helpers shared by every Siege Nights texture script.

Style rules (see art/STYLE-GUIDE.md):
  * light comes from the top-left: top/left edges +1 tone, bottom/right edges -1 tone
  * paint with ramp indices, never raw colours, so regional variants are a ramp swap
  * texture comes from clustered tone changes, not per-pixel noise
  * no pure black, no pure white
"""
import random
from PIL import Image

T = (0, 0, 0, 0)

class Tex:
    def __init__(self, w=16, h=16, fill=T, seed=1):
        self.im = Image.new('RGBA', (w, h), fill); self.px = self.im.load(); self.w, self.h = w, h
        self.r = random.Random(seed)
    @classmethod
    def from_image(cls, im, seed=1):
        t = cls(im.width, im.height, seed=seed); t.im = im.convert('RGBA').copy(); t.px = t.im.load(); return t
    def set(self, x, y, c, a=255):
        if 0 <= x < self.w and 0 <= y < self.h: self.px[x, y] = tuple(c[:3]) + (a,)
    def get(self, x, y): return self.px[x % self.w, y % self.h]
    def rect(self, x0, y0, x1, y1, c, a=255):       # inclusive
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): self.set(x, y, c, a)
    def save(self, path): self.im.save(path)
    def copy(self):
        t = Tex(self.w, self.h); t.im = self.im.copy(); t.px = t.im.load(); t.r = random.Random(self.r.random()); return t

def clampi(i, n=6): return max(0, min(n - 1, i))
def R(ramp, i): return ramp[clampi(i, len(ramp))]

def lerp(a, b, t): return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))
def brighten(c, k): return tuple(max(0, min(255, round(v * k))) for v in c[:3])

def line(a, b):
    (x0, y0), (x1, y1) = a, b; n = max(abs(x1 - x0), abs(y1 - y0)) or 1
    return [(round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n)) for i in range(n + 1)]

# ---------------- materials ----------------
def bricks(t, stone, mortar, rows=((0, 8), (4, 11), (1, 9), (5, 12)), rh=4, base=(2, 3), seed=0, tidy=False):
    """Staggered stone courses, tileable. rows = split x positions per course."""
    r = random.Random(seed)
    for ri, splits in enumerate(rows):
        y0 = ri * rh
        for y in range(y0, y0 + rh):
            for x in range(16): t.set(x, y, R(mortar, 2))
        sp = sorted(s % 16 for s in splits)
        for k, s in enumerate(sp):
            e = sp[(k + 1) % len(sp)]; w = (e - s) % 16 or 16
            tone = r.choice(base)
            cells = [((s + i) % 16) for i in range(w - 1)]          # last column = mortar
            for yy in range(y0, y0 + rh - 1):                       # last row = mortar
                for i, x in enumerate(cells):
                    v = tone
                    if yy == y0: v += 1                              # lit top
                    if i == 0 and yy > y0: v += 1 if tone < 3 else 0  # lit left
                    if yy == y0 + rh - 2: v -= 1                     # shaded bottom
                    if i == len(cells) - 1 and yy < y0 + rh - 2: v -= 0 if tidy else 1
                    t.set(x, yy, R(stone, v))
            # clustered wear: a 2px darker pit and a chipped corner on some bricks
            if not tidy and w > 3:
                if r.random() < 0.7:
                    px = cells[r.randrange(1, len(cells) - 1)]; py = y0 + 1
                    t.set(px, py, R(stone, tone - 1)); t.set((px + 1) % 16, py, R(stone, tone - 1)) if r.random() < .5 else None
                if r.random() < 0.4: t.set(cells[-1], y0, R(stone, tone - 1))
            # a light fleck on bigger bricks breaks up the flat face
            if not tidy and w > 4 and r.random() < 0.6:
                fx = cells[r.randrange(1, len(cells) - 1)]; t.set(fx, y0 + 2 if rh > 3 else y0 + 1, R(stone, tone + 1))
            # mortar under the brick is in shadow, right of the brick gets its lighter lip
            for i, x in enumerate(cells + [(s + w - 1) % 16]):
                t.set(x, y0 + rh - 1, R(mortar, 1 if i < len(cells) else 2))
            for yy in range(y0, y0 + rh - 1): t.set((s + w - 1) % 16, yy, R(mortar, 2 if yy == y0 else 1))
    return t

def planks(t, wood, vertical=True, widths=(4, 4, 4, 4), seed=0, nails=True, grain=True):
    r = random.Random(seed); pos = 0
    for k, w in enumerate(widths):
        tone = r.choice((2, 3, 3))
        for a in range(pos, pos + w):
            for b in range(16):
                v = tone
                if a == pos: v += 1
                if a == pos + w - 1: v = 0 if True else v                 # seam
                if a == pos + w - 2 and w > 2: v -= 0
                x, y = (a, b) if vertical else (b, a)
                t.set(x, y, R(wood, v))
        if grain:   # grain streaks run along the board
            for _ in range(2):
                a = r.randrange(pos + 1, pos + w - 1) if w > 2 else pos
                b0 = r.randrange(16); L = r.randrange(3, 7)
                for b in range(b0, b0 + L):
                    x, y = (a, b % 16) if vertical else (b % 16, a)
                    t.set(x, y, R(wood, tone - 1))
            if r.random() < 0.6:  # a knot
                a = pos + w // 2 - (1 if w > 3 else 0); b = r.randrange(2, 14)
                x, y = (a, b) if vertical else (b, a); t.set(x, y, R(wood, tone - 2)); x2, y2 = (a, b + 1) if vertical else (b + 1, a); t.set(x2, y2, R(wood, tone - 1))
        pos += w
    return t

def frame(t, wood, inset=0, w=2, light=True):
    """Thick timber frame round the edge of a face (lit top-left)."""
    for i in range(inset, 16 - inset):
        for d in range(w):
            t.set(i, inset + d, R(wood, 3 if d == 0 else 2)); t.set(inset + d, i, R(wood, 3 if d == 0 else 2))
            t.set(i, 15 - inset - d, R(wood, 1 if d == 0 else 2)); t.set(15 - inset - d, i, R(wood, 1 if d == 0 else 2))
    for i in range(inset + w, 16 - inset - w):           # inner shadow line
        t.set(i, inset + w, R(wood, 0)); t.set(inset + w, i, R(wood, 0))

def band(t, metal, y, rivets=(2, 7, 13), h=2):
    for x in range(16):
        t.set(x, y - 1, R(metal, 0)); t.set(x, y, R(metal, 4))
        for d in range(1, h): t.set(x, y + d, R(metal, 2))
        t.set(x, y + h, R(metal, 0))
    for x in rivets: t.set(x, y, R(metal, 5)); t.set(x, y + h - 1, R(metal, 1)) if h > 1 else None

def outline_alpha(t, color):
    """Add a 1px outline around opaque pixels (for items)."""
    src = t.im.copy(); sp = src.load()
    for y in range(t.h):
        for x in range(t.w):
            if sp[x, y][3]: continue
            if any(0 <= x + dx < t.w and 0 <= y + dy < t.h and sp[x + dx, y + dy][3] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                t.set(x, y, color)

# ---------------- damage model ----------------
# Same crack paths as the original Siege Nights damage model (build_walls2.py), so every wall block
# breaks the same way: stage 0 clean, 1 light cracks, 2 heavy cracks + chipped corners.
CRACKS = {1: [[(2, 0), (3, 2), (5, 3), (4, 6), (6, 8)], [(13, 15), (12, 13), (12, 10)]],
          2: [[(6, 8), (8, 7), (10, 9), (12, 9), (15, 8)], [(0, 11), (2, 12), (3, 14), (5, 15)], [(9, 0), (8, 2), (10, 4)]]}
CHIPS = [(0, 0), (1, 0), (0, 1), (15, 15), (14, 15), (15, 14), (11, 3), (4, 10)]

CHUNKS = [[(10, 12), (11, 12), (10, 13), (11, 13), (12, 13)], [(3, 6), (4, 6), (3, 7)], [(13, 4), (14, 4), (14, 5)]]

def damage(img, level, crack=(24, 20, 26)):
    """Return a copy of a 16x16 block texture at damage stage 0, 1 or 2.
    Stage 1: dark splits you can read from across a courtyard. Stage 2: more splits, broken corners and missing chunks."""
    im = img.copy(); px = im.load()
    if not level: return im
    crack = brighten(crack, 0.6)
    paths = CRACKS[1] + (CRACKS[2] if level >= 2 else [])
    cr = set()
    for path in paths:
        pts = [p for a, b in zip(path, path[1:]) for p in line(a, b)]
        for i, (x, y) in enumerate(pts):
            cr.add((x, y))
            if i % 3 == 1 or level >= 2 and i % 2 == 0: cr.add((x + 1, y))      # the split widens along its length
    cr = {p for p in cr if 0 <= p[0] < 16 and 0 <= p[1] < 16}
    for (x, y) in cr:
        if px[x, y][3]: px[x, y] = crack + (255,)
    for (x, y) in cr:   # lit lower-right lip and a shadow on the upper-left: reads as a split, not a drawn line
        for (dx, dy, k) in ((1, 1, 1.18), (-1, -1, 0.72)):
            q = (x + dx, y + dy)
            if 0 <= q[0] < 16 and 0 <= q[1] < 16 and q not in cr and px[q][3]:
                px[q] = brighten(px[q], k) + (px[q][3],)
    if level >= 2:
        for (x, y) in CHIPS:
            if px[x, y][3]: px[x, y] = brighten(px[x, y], 0.45) + (px[x, y][3],)
        for chunk in CHUNKS:                                                     # pieces knocked out of the face
            for (x, y) in chunk:
                if px[x, y][3] and (x, y) not in cr: px[x, y] = brighten(px[x, y], 0.5) + (px[x, y][3],)
            for (x, y) in chunk:
                q = (x, y + 1)
                if q[1] < 16 and q not in chunk and q not in cr and px[q][3]: px[q] = brighten(px[q], 1.15) + (px[q][3],)
    return im

def damage_set(img, crack=(24, 20, 26)):
    return [damage(img, i, crack) for i in range(3)]

# ---------------- preview ----------------
def sheet(paths_or_imgs, scale=6, cols=8, tile=1, bg=(58, 58, 64), labels=None):
    ims = [Image.open(p).convert('RGBA') if isinstance(p, str) else p for p in paths_or_imgs]
    cw = max(i.width for i in ims) * tile * scale + 6; ch = max(i.height for i in ims) * tile * scale + 6
    rows = (len(ims) + cols - 1) // cols
    W = Image.new('RGBA', (cols * cw, rows * ch), bg + (255,))
    for k, im in enumerate(ims):
        big = Image.new('RGBA', (im.width * tile, im.height * tile))
        for a in range(tile):
            for b in range(tile): big.paste(im, (a * im.width, b * im.height))
        big = big.resize((big.width * scale, big.height * scale), Image.NEAREST)
        W.alpha_composite(big, ((k % cols) * cw + 3, (k // cols) * ch + 3))
    return W
