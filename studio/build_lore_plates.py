#!/usr/bin/env python3
"""The old paintings for The Unburned Library: eight "oil on panel" plates, painted by code and
then aged (brushwork, cracked varnish, yellowing). Run from the siege-nights folder:
    python3 studio/build_lore_plates.py
Writes lore-book/plates/plate_1.jpg ... plate_8.jpg. build_lore_book.py puts them in the PDF.
Needs Pillow and numpy."""
import math, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "lore-book", "plates")
os.makedirs(OUT, exist_ok=True)
W, H = 2200, 1600          # painted at double size, saved at half

PLATES = [
    ("Hollowmere, before", "The mere and the old town in summer, before the two worlds met. The only picture known of the land under its first name. Oil on oak. Painter unknown."),
    ("The Convergence", "The night the other shore arrived. The sun has been painted out by a later hand. There are two moons. Nobody has been able to say which one was added."),
    ("The Truce of the Third Night", "One of ours and five of theirs at a table of wet stone. The man holding the lamp is thought to be the mage Corvin Hale. Cut from its frame and hidden in a bell."),
    ("The King Is Put Down", "Painted from the wall of Crownhold, by someone who was there. The Order's inventory lists it as \"a hunting scene, burned\"."),
    ("Bellhollow", "The last ringing of the Founding Bell, and the breaking of the Hollow's host. The Order hung copies of this one in every chapterhouse. This is not a copy."),
    ("The Gate", "What the bell left behind: one wound in the rock, shut. Painted from memory. Look at the edges of the Crack. The painter went back and added the hands."),
    ("The Third Night", "A keep of Aldmere, on the night that is not ours. Painted within living memory. Count the moons."),
    ("The Forty-Second Portrait", "The Order burned forty-one portraits of one man. This is another. The face was scraped back to the board before it was hidden, and not by the Order."),
]

def fnoise(n, rng, octaves=6, rough=0.55):
    """1D fractal noise, n samples, about -1..1"""
    out = np.zeros(n); amp = 1.0; total = 0
    for o in range(octaves):
        k = 2 ** (o + 2)
        pts = rng.uniform(-1, 1, k + 2)
        x = np.linspace(0, k, n)
        i = np.floor(x).astype(int); f = x - i; f = f * f * (3 - 2 * f)
        out += amp * (pts[i] * (1 - f) + pts[i + 1] * f); total += amp; amp *= rough
    return out / total

def cloud(rng, scale, w=W, h=H):
    small = (rng.random((h // scale + 2, w // scale + 2)) * 255).astype(np.uint8)
    im = Image.fromarray(small).resize((w, h), Image.BICUBIC).filter(ImageFilter.GaussianBlur(scale / 3))
    return np.asarray(im, dtype=np.float32) / 255 - 0.5

class Painting:
    def __init__(self, seed):
        self.rng = np.random.default_rng(seed)
        self.a = np.zeros((H, W, 3), np.float32)
        self.yy, self.xx = np.mgrid[0:H, 0:W].astype(np.float32)

    def sky(self, top, bottom, horizon=0.6):
        t = np.clip(self.yy / (H * horizon), 0, 1)[..., None] ** 1.3
        self.a[:] = np.array(top, np.float32) * (1 - t) + np.array(bottom, np.float32) * t
        self.a += (cloud(self.rng, 260)[..., None] * 34 + cloud(self.rng, 90)[..., None] * 16) * (1 - t * 0.6)

    def fill(self, color):
        self.a[:] = np.array(color, np.float32)
        self.a += cloud(self.rng, 200)[..., None] * 26 + cloud(self.rng, 50)[..., None] * 12

    def mask(self, draw_fn, blur=0):
        m = Image.new("L", (W, H), 0)
        draw_fn(ImageDraw.Draw(m))
        if blur: m = m.filter(ImageFilter.GaussianBlur(blur))
        return np.asarray(m, dtype=np.float32)[..., None] / 255

    def paint(self, m, color, alpha=1.0, mottle=10):
        col = np.array(color, np.float32) + cloud(self.rng, 36)[..., None] * mottle
        self.a = self.a * (1 - m * alpha) + col * m * alpha

    def poly(self, pts, color, alpha=1.0, blur=2, mottle=10):
        pts = [(x * W, y * H) for x, y in pts]
        self.paint(self.mask(lambda d: d.polygon(pts, fill=255), blur), color, alpha, mottle)

    def ellipse(self, cx, cy, rx, ry, color, alpha=1.0, blur=2, mottle=6):
        box = [(cx - rx) * W, (cy - ry) * H, (cx + rx) * W, (cy + ry) * H]
        self.paint(self.mask(lambda d: d.ellipse(box, fill=255), blur), color, alpha, mottle)

    def line(self, pts, color, width=4, alpha=1.0, blur=1):
        pts = [(x * W, y * H) for x, y in pts]
        self.paint(self.mask(lambda d: d.line(pts, fill=255, width=width, joint="curve"), blur), color, alpha, 0)

    def ridge(self, y, amp, color, rough=0.55, alpha=1.0, blur=3):
        h = (y + fnoise(W, self.rng, rough=rough) * amp) * H
        m = (self.yy > h[None, :]).astype(np.float32)[..., None]
        if blur: m = np.asarray(Image.fromarray((m[..., 0] * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(blur)), dtype=np.float32)[..., None] / 255
        depth = np.clip((self.yy - h[None, :]) / (H * 0.25), 0, 1)[..., None]
        col = np.array(color, np.float32) * (1 - depth * 0.25) + cloud(self.rng, 60)[..., None] * 14
        self.a = self.a * (1 - m * alpha) + col * m * alpha
        return h / H

    def glow(self, cx, cy, r, color, strength=1.0, squash=1.0):
        d = np.hypot((self.xx - cx * W), (self.yy - cy * H) * squash) / (r * W)
        self.a += (np.exp(-d * d) * strength)[..., None] * np.array(color, np.float32)

    def fog(self, y0, y1, color, alpha=0.6):
        band = np.clip(1 - np.abs((self.yy / H - (y0 + y1) / 2) / ((y1 - y0) / 2)), 0, 1) ** 1.2
        wisp = np.clip(0.55 + cloud(self.rng, 180) * 1.6 + cloud(self.rng, 40) * 0.5, 0, 1)
        m = (band * wisp * alpha)[..., None]
        self.a = self.a * (1 - m) + np.array(color, np.float32) * m

    def water(self, y0, y1, color, streak=(255, 240, 200), amount=0.25, sx=0.5, spread=0.25):
        m = ((self.yy >= y0 * H) & (self.yy < y1 * H)).astype(np.float32)
        rows = (self.rng.random((H, 1)) > 0.55).astype(np.float32)
        lines = np.asarray(Image.fromarray((np.repeat(rows, W, 1) * (self.rng.random((H, W)) > 0.35) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3)), dtype=np.float32) / 255
        near = np.exp(-((self.xx / W - sx) / spread) ** 2)
        col = np.array(color, np.float32)[None, None, :] * (1 - 0.25 * (self.yy / H - y0)[..., None] / max(y1 - y0, .01))
        col = col + cloud(self.rng, 120)[..., None] * 12
        col = col + (lines * near * amount)[..., None] * (np.array(streak, np.float32) - col)
        self.a = self.a * (1 - m[..., None]) + col * m[..., None]

    def tower(self, x, base, w, h, color, roof=None, lean=0.0, windows=None):
        top = base - h; dx = lean * h
        self.poly([(x - w / 2, base), (x + w / 2, base), (x + w / 2 + dx, top), (x - w / 2 + dx, top)], color, blur=1.5)
        self.poly([(x + w * 0.1, base), (x + w / 2, base), (x + w / 2 + dx, top), (x + w * 0.1 + dx, top)], [c * 0.72 for c in color], blur=1.5, alpha=0.8)
        if roof: self.poly([(x - w * 0.62 + dx, top), (x + w * 0.62 + dx, top), (x + dx * 1.2, top - w * 1.25)], roof, blur=1.5)
        if windows:
            for i in range(1, 4):
                yy = base - h * i / 4.2
                self.ellipse(x - w * 0.12 + lean * (base - yy), yy, w * 0.07, w * 0.14, windows, blur=1, mottle=0)

    def figure(self, x, feet, h, color, crown=None, arm=None, lean=0.0):
        hw = h * 0.16
        head_y = feet - h * 0.9
        self.poly([(x - hw * 1.25, feet), (x + hw * 1.25, feet), (x + hw * 0.7 + lean * h, feet - h * 0.78), (x - hw * 0.7 + lean * h, feet - h * 0.78)], color, blur=1.5, mottle=6)
        self.ellipse(x + lean * h, head_y, h * 0.075 * H / W * 1.35, h * 0.085, [min(255, c * 1.15 + 14) for c in color], blur=1.2)
        if arm:
            self.line([(x + lean * h, feet - h * 0.68), (x + arm[0] * h, feet - h * 0.68 + arm[1] * h)], color, width=max(3, int(h * H * 0.07)))
        if crown:
            cy = head_y - h * 0.085
            self.poly([(x - hw * 0.5, cy + h * .02), (x + hw * 0.5, cy + h * .02), (x + hw * 0.5, cy - h * .04), (x + hw * .25, cy - h * .01), (x, cy - h * .05), (x - hw * .25, cy - h * .01), (x - hw * 0.5, cy - h * .04)], crown, blur=0.8, mottle=0)

    def jagged(self, x0, y0, x1, y1, n, wobble, seed):
        r = np.random.default_rng(seed)
        return [(x0 + (x1 - x0) * i / n + (r.uniform(-wobble, wobble) if 0 < i < n else 0), y0 + (y1 - y0) * i / n) for i in range(n + 1)]

    def crack(self, x, y0, y1, width, color, glow, seed=3, glow_r=0.07, glow_strength=0.9):
        left = self.jagged(x, y0, x, y1, 14, 0.03, seed)
        pts = [(px - width * math.sin(math.pi * i / 14) * (0.6 + 0.4 * ((i * 7) % 3) / 2), py) for i, (px, py) in enumerate(left)]
        pts += [(px + width * math.sin(math.pi * i / 14) * (0.6 + 0.4 * ((i * 5) % 3) / 2), py) for i, (px, py) in reversed(list(enumerate(left)))]
        for (px, py) in left[2:-2:2]: self.glow(px, py, glow_r, glow, glow_strength * 0.35)
        self.poly(pts, color, blur=2.5, mottle=0)
        return left

    def torches(self, pts, r=0.006, color=(255, 190, 90)):
        for x, y in pts:
            self.glow(x, y, r * 3.2, (120, 60, 14), 0.5)
            self.ellipse(x, y, r * 0.55, r * 1.1, color, blur=1.5, mottle=0)

    def finish(self, path, darkness=0.9, warmth=(1.0, 0.92, 0.70)):
        rng = self.rng
        im = Image.fromarray(np.clip(self.a, 0, 255).astype(np.uint8)).filter(ImageFilter.MedianFilter(9))
        a = np.asarray(im, dtype=np.float32)
        strokes = np.asarray(Image.fromarray((rng.random((H // 3, W // 40)) * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC), dtype=np.float32) / 255 - 0.5
        dabs = cloud(rng, 10) * 0.9 + cloud(rng, 26) * 0.6
        a *= (1 + strokes * 0.14 + dabs * 0.16)[..., None]
        weave = (np.sin(self.xx * 1.9) * np.sin(self.yy * 1.9)) * 0.018
        a *= (1 + weave)[..., None]
        # cracked varnish: fine dark lines where two noise fields cross zero
        cr = np.zeros((H, W), np.float32)
        for scale, width, weight in ((34, 0.020, 0.6), (70, 0.012, 0.55), (150, 0.007, 0.5)):
            n = cloud(rng, scale)
            cr = np.maximum(cr, np.exp(-(n / width) ** 2) * weight)
        cr *= np.clip(0.55 + cloud(rng, 300) * 2.2, 0, 1)
        a *= (1 - cr * 0.55)[..., None]
        a = a * np.array(warmth, np.float32) * darkness + np.array([16, 9, 2], np.float32)
        vign = np.clip(np.hypot((self.xx - W / 2) / (W * 0.62), (self.yy - H / 2) / (H * 0.62)), 0, 1.4) ** 2.6
        a *= (1 - vign * 0.5)[..., None]
        for _ in range(26):                                   # flake losses and fly-specks
            cx, cy, r = rng.uniform(0, W), rng.uniform(0, H), rng.uniform(2, 7)
            a -= (np.exp(-(np.hypot(self.xx - cx, self.yy - cy) / r) ** 2) * rng.uniform(20, 55))[..., None]
        out = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).resize((W // 2, H // 2), Image.LANCZOS)
        out.save(path, "JPEG", quality=86)

def town(p, x0, base, tone, roof, n=7, scale=1.0, lean=0.0, windows=None, seed=1):
    r = np.random.default_rng(seed)
    for i in range(n):
        x = x0 + i * 0.034 * scale + r.uniform(-0.008, 0.008)
        h = r.uniform(0.07, 0.2) * scale
        w = r.uniform(0.022, 0.034) * scale
        shade = r.uniform(0.85, 1.1)
        p.tower(x, base + r.uniform(0, 0.012), w, h, [c * shade for c in tone], roof if r.random() > 0.25 else None, lean * r.uniform(0.5, 1.4) * (1 if r.random() > 0.3 else -0.6), windows)
    p.poly([(x0 - 0.03 * scale, base + 0.012), (x0 + n * 0.034 * scale, base + 0.012), (x0 + n * 0.034 * scale, base - 0.035 * scale), (x0 - 0.03 * scale, base - 0.03 * scale)], [c * 0.8 for c in tone], blur=2)

def reeds(p, y, color, n=120, seed=5):
    r = np.random.default_rng(seed)
    for _ in range(n):
        x = r.uniform(0, 1); h = r.uniform(0.03, 0.09); yb = y + r.uniform(0, 0.12)
        p.line([(x, yb), (x + r.uniform(-0.012, 0.012), yb - h)], [c * r.uniform(0.6, 1.2) for c in color], width=int(r.uniform(3, 7)))

# ------------------------------------------------------------------ 1. Hollowmere, before
def plate_1(p):
    p.sky((112, 150, 178), (246, 214, 150), 0.52)
    p.glow(0.66, 0.40, 0.16, (110, 86, 30), 1.0); p.ellipse(0.66, 0.41, 0.022, 0.03, (255, 244, 200), blur=5, mottle=0)
    for cx, cy, s in ((0.2, 0.16, 1.0), (0.48, 0.1, 0.8), (0.85, 0.2, 0.7)):
        for k in range(5): p.ellipse(cx + k * 0.035 * s, cy + (k % 2) * 0.012, 0.06 * s, 0.028 * s, (250, 240, 220), alpha=0.5, blur=18)
    p.ridge(0.44, 0.07, (128, 150, 170), rough=0.5); p.ridge(0.50, 0.05, (104, 132, 128), rough=0.5)
    p.ridge(0.535, 0.02, (96, 124, 84), rough=0.4)
    p.water(0.55, 1.0, (120, 150, 150), (255, 236, 170), 0.6, sx=0.66, spread=0.16)
    p.poly([(0, 0.6), (0.18, 0.565), (0.44, 0.575), (0.5, 0.6), (0.4, 0.625), (0.1, 0.65), (0, 0.66)], (104, 122, 70), blur=3)
    town(p, 0.09, 0.588, (206, 186, 150), (164, 70, 48), n=9, seed=4)
    p.tower(0.30, 0.59, 0.04, 0.27, (214, 196, 160), (150, 62, 44))
    p.ellipse(0.30, 0.375, 0.009, 0.014, (200, 150, 60), blur=1, mottle=0)                       # the bell
    for x, y in ((0.56, 0.66), (0.72, 0.72), (0.62, 0.8)):                                        # boats
        p.poly([(x - 0.03, y), (x + 0.03, y), (x + 0.02, y + 0.014), (x - 0.02, y + 0.014)], (70, 48, 32), blur=1.5)
        p.poly([(x, y), (x, y - 0.06), (x + 0.028, y - 0.008)], (236, 226, 200), blur=1.5)
    p.poly([(0.55, 1), (1, 0.86), (1, 1)], (72, 96, 52), blur=4); p.poly([(0, 0.9), (0.3, 1), (0, 1)], (64, 88, 48), blur=4)
    reeds(p, 0.88, (88, 110, 52), 150)
    for x, y in ((0.4, 0.26), (0.43, 0.24), (0.47, 0.27), (0.78, 0.3), (0.8, 0.285)):
        p.line([(x - 0.008, y - 0.004), (x, y), (x + 0.008, y - 0.005)], (60, 54, 50), width=3)
    p.figure(0.845, 0.93, 0.08, (120, 60, 44)); p.figure(0.875, 0.935, 0.055, (190, 170, 120))

# ------------------------------------------------------------------ 2. The Convergence
def plate_2(p):
    p.sky((26, 36, 44), (84, 104, 104), 0.55)
    p.poly([(0.52, 0), (0.6, 0), (0.585, 0.2), (0.6, 0.36), (0.575, 0.5), (0.565, 0.36), (0.55, 0.2)], (214, 236, 226), alpha=0.85, blur=10, mottle=0)   # the seam in the sky
    p.glow(0.575, 0.25, 0.12, (60, 84, 78), 1.0, squash=0.35)
    p.ellipse(0.2, 0.2, 0.012, 0.03, (236, 232, 210), blur=2, mottle=0); p.ellipse(0.206, 0.2, 0.012, 0.03, (40, 52, 58), blur=2, mottle=0)       # our thin moon
    p.glow(0.86, 0.43, 0.09, (70, 86, 80), 0.8); p.ellipse(0.86, 0.43, 0.05, 0.068, (206, 220, 204), blur=3)                                    # theirs: full, low
    p.ridge(0.46, 0.07, (44, 58, 64), rough=0.5); p.ridge(0.52, 0.05, (36, 48, 50), rough=0.5)
    p.water(0.55, 1.0, (26, 34, 38), (190, 214, 204), 0.5, sx=0.6, spread=0.2)
    p.poly([(0, 0.6), (0.18, 0.565), (0.44, 0.575), (0.5, 0.6), (0.4, 0.625), (0.1, 0.65), (0, 0.66)], (34, 42, 34), blur=3)
    town(p, 0.09, 0.588, (70, 66, 58), (60, 36, 30), n=9, seed=4, windows=(240, 180, 90))
    p.tower(0.30, 0.59, 0.04, 0.27, (78, 72, 62), (62, 36, 30)); p.glow(0.30, 0.375, 0.03, (120, 84, 20), 0.9)
    town(p, 0.62, 0.70, (120, 136, 132), None, n=9, scale=1.5, lean=0.16, seed=9)                 # the other shore, come aground in the mere
    p.fog(0.56, 0.86, (150, 170, 164), 0.75); p.fog(0.44, 0.62, (120, 140, 136), 0.4)
    for i in range(12): p.figure(0.14 + i * 0.022, 0.67 + (i % 3) * 0.006, 0.04, (22, 22, 22))
    p.torches([(0.15 + i * 0.044, 0.632) for i in range(6)], 0.004)
    reeds(p, 0.9, (30, 40, 30), 110, seed=6)

# ------------------------------------------------------------------ 3. The Truce
def plate_3(p):
    p.fill((22, 24, 28))
    for k in range(9): p.poly([(k * 0.125 - 0.03, 0), (k * 0.125 + 0.07, 0), (k * 0.125 + 0.02 + (k % 3) * 0.01, 0.12 + (k * 37 % 11) * 0.02)], (38, 40, 44), blur=4)   # stalactites
    p.glow(0.23, 0.42, 0.2, (120, 78, 26), 1.0)                                                   # the lamp
    p.glow(0.5, 0.56, 0.1, (70, 96, 92), 0.9)                                                     # their crown
    p.water(0.78, 1.0, (10, 12, 16), (150, 150, 130), 0.35, sx=0.3, spread=0.25)
    p.poly([(0.3, 0.63), (0.7, 0.63), (0.74, 0.69), (0.26, 0.69)], (84, 88, 86), blur=2.5)        # table of wet stone
    p.poly([(0.33, 0.69), (0.67, 0.69), (0.62, 0.82), (0.38, 0.82)], (44, 46, 48), blur=3)
    p.poly([(0.47, 0.625), (0.53, 0.625), (0.535, 0.585), (0.515, 0.605), (0.5, 0.575), (0.485, 0.605), (0.465, 0.585)], (150, 162, 158), blur=1.2, mottle=0)   # the grey crown
    p.figure(0.17, 0.84, 0.3, (64, 44, 34), arm=(0.2, -0.26)); p.ellipse(0.232, 0.5, 0.012, 0.02, (255, 214, 120), blur=3, mottle=0)                 # Corvin and the lamp
    p.figure(0.3, 0.86, 0.36, (126, 40, 34), crown=(226, 184, 80), arm=(0.22, 0.0))                # the king
    for i, x in enumerate((0.60, 0.67, 0.74, 0.81, 0.88)):                                        # five of theirs: tall, thin, pale
        p.figure(x, 0.86 - (i % 2) * 0.015, 0.47 + (i % 3) * 0.03, (128, 140, 138), lean=0.0)
        p.ellipse(x, 0.86 - (i % 2) * 0.015 - (0.47 + (i % 3) * 0.03) * 0.9, 0.012, 0.022, (196, 208, 200), blur=2, mottle=0)
    p.fog(0.7, 0.95, (70, 84, 84), 0.4)

# ------------------------------------------------------------------ 4. The King Is Put Down
def plate_4(p):
    p.sky((18, 20, 34), (60, 44, 50), 0.6)
    p.ellipse(0.5, 0.14, 0.03, 0.041, (220, 220, 200), blur=3); p.glow(0.5, 0.14, 0.07, (50, 50, 44), 0.8)
    p.ridge(0.5, 0.05, (30, 30, 40), rough=0.5)
    p.poly([(0, 0.52), (0.6, 0.52), (0.6, 1), (0, 1)], (58, 54, 54), blur=2)                      # the wall walk
    for k in range(10): p.poly([(k * 0.064, 0.52), (k * 0.064 + 0.036, 0.52), (k * 0.064 + 0.036, 0.47), (k * 0.064, 0.47)], (64, 60, 60), blur=1.5)
    p.tower(0.06, 0.52, 0.1, 0.3, (60, 56, 58), (40, 30, 34))
    p.poly([(0.6, 0.44), (1, 0.3), (1, 1), (0.6, 1)], (40, 40, 46), blur=3)                       # the rock
    p.crack(0.79, 0.36, 0.98, 0.03, (206, 236, 226), (60, 110, 100), seed=11, glow_r=0.08, glow_strength=1.2)
    p.glow(0.3, 0.6, 0.25, (110, 56, 14), 0.9)
    r = np.random.default_rng(2)
    for i in range(26): p.figure(0.04 + r.uniform(0, 0.42), 0.8 + r.uniform(-0.04, 0.12), 0.2 + r.uniform(-0.02, 0.04), [r.uniform(24, 60)] * 3)
    p.torches([(0.06 + i * 0.05 + (i % 2) * 0.01, 0.56 + (i % 3) * 0.02) for i in range(9)], 0.007)
    p.figure(0.55, 0.8, 0.24, (150, 150, 146), arm=(0.42, -0.1))                                  # the daughter, arm out
    p.figure(0.7, 0.72, 0.22, (126, 40, 34), crown=(226, 184, 80), lean=0.28)                     # the king, going backward. No sword drawn.
    p.fog(0.8, 1.0, (60, 60, 70), 0.4)

# ------------------------------------------------------------------ 5. Bellhollow
def plate_5(p):
    p.sky((30, 30, 44), (150, 108, 70), 0.62)
    for k in range(7): p.ellipse(0.1 + k * 0.14, 0.12 + (k % 3) * 0.05, 0.16, 0.07, (38, 36, 48), alpha=0.7, blur=30)
    p.line(p.jagged(0.84, 0.0, 0.8, 0.5, 9, 0.025, 4), (230, 240, 236), width=7, blur=2); p.glow(0.82, 0.25, 0.1, (60, 70, 70), 0.8)
    p.ridge(0.58, 0.05, (56, 52, 56), rough=0.5)
    p.poly([(0.22, 0.75), (0.42, 0.47), (0.5, 0.44), (0.58, 0.47), (0.78, 0.75)], (52, 54, 44), blur=4)   # the hill
    p.tower(0.5, 0.46, 0.06, 0.24, (96, 90, 84), (60, 40, 36))
    for i in range(1, 7):                                                                         # the ringing
        box = [(0.5 - i * 0.075) * W, (0.3 - i * 0.075 * W / H) * H, (0.5 + i * 0.075) * W, (0.3 + i * 0.075 * W / H) * H]
        p.paint(p.mask(lambda d: d.arc(box, 180, 360, fill=255, width=9), 3), (255, 226, 150), alpha=0.7 / i ** 0.7, mottle=0)
    p.glow(0.5, 0.3, 0.09, (150, 110, 40), 1.2); p.ellipse(0.5, 0.3, 0.014, 0.024, (255, 226, 140), blur=2, mottle=0)
    p.poly([(0, 0.7), (1, 0.7), (1, 1), (0, 1)], (40, 40, 34), blur=6)
    r = np.random.default_rng(8)
    for i in range(34): p.figure(r.uniform(0.02, 0.46), 0.82 + r.uniform(-0.06, 0.16), 0.11 + r.uniform(0, 0.05), (r.uniform(50, 80), r.uniform(30, 44), 30))
    p.torches([(r.uniform(0.03, 0.45), r.uniform(0.66, 0.8)) for _ in range(14)], 0.006)
    for i in range(30): p.figure(r.uniform(0.56, 0.99), 0.84 + r.uniform(-0.06, 0.15), 0.17 + r.uniform(0, 0.08), [r.uniform(110, 150)] * 3, lean=r.uniform(0.05, 0.3))
    p.fog(0.62, 0.9, (130, 146, 142), 0.5)
    for x in (0.1, 0.2, 0.31): p.line([(x, 0.78), (x, 0.58)], (30, 26, 24), width=5); 
    for x in (0.1, 0.2, 0.31): p.poly([(x, 0.58), (x + 0.045, 0.595), (x, 0.625)], (150, 50, 40), blur=1.5)

# ------------------------------------------------------------------ 6. The Gate
def plate_6(p):
    p.fill((30, 30, 34))
    for k in range(8): p.poly([(k * 0.14 - 0.04, 0), (k * 0.14 + 0.08, 0), (k * 0.14 + 0.03, 0.1 + (k * 53 % 13) * 0.018)], (44, 44, 50), blur=5)
    p.glow(0.52, 0.45, 0.2, (40, 76, 70), 1.2, squash=0.5)
    spine = p.crack(0.52, 0.06, 0.84, 0.035, (220, 244, 234), (70, 120, 110), seed=5)
    for i, (x, y) in enumerate(spine[2:-2]):                                                      # side cracks
        s = 1 if i % 2 else -1
        p.line([(x, y), (x + s * 0.05, y - 0.03), (x + s * 0.09, y - 0.02 + (i % 3) * 0.02)], (150, 200, 190), width=5, alpha=0.8, blur=2)
    for i, (x, y) in enumerate(spine[3:-3:2]):                                                    # the hands, added later
        s = 1 if i % 2 else -1
        hx = x + s * 0.035
        p.ellipse(hx, y, 0.008, 0.014, (176, 196, 190), alpha=0.75, blur=2, mottle=0)
        for f in range(4): p.line([(hx, y), (hx + s * 0.012, y - 0.03 + f * 0.012)], (176, 196, 190), width=3, alpha=0.7)
    p.poly([(0, 0.84), (1, 0.82), (1, 1), (0, 1)], (36, 34, 34), blur=5)
    # the Founding Bell, down and split
    p.poly([(0.14, 0.9), (0.2, 0.7), (0.3, 0.64), (0.4, 0.7), (0.46, 0.9)], (150, 106, 50), blur=3, mottle=18)
    p.poly([(0.3, 0.64), (0.4, 0.7), (0.46, 0.9), (0.34, 0.9)], (104, 72, 36), blur=3, alpha=0.85)
    p.line(p.jagged(0.29, 0.66, 0.33, 0.9, 6, 0.012, 2), (22, 16, 12), width=8)
    p.glow(0.32, 0.72, 0.06, (60, 40, 10), 0.8)
    p.figure(0.76, 0.93, 0.13, (20, 20, 22))                                                      # someone, for scale
    p.fog(0.8, 1.0, (60, 80, 78), 0.4)

# ------------------------------------------------------------------ 7. The Third Night
def plate_7(p):
    p.sky((14, 18, 30), (50, 62, 70), 0.6)
    r = np.random.default_rng(3)
    for _ in range(90): p.a[int(r.uniform(0, H * 0.5)), int(r.uniform(0, W))] += 150
    p.ellipse(0.86, 0.12, 0.013, 0.032, (236, 232, 210), blur=2, mottle=0); p.ellipse(0.867, 0.12, 0.013, 0.032, (18, 24, 34), blur=2, mottle=0)
    p.glow(0.16, 0.47, 0.13, (60, 76, 70), 0.9); p.ellipse(0.16, 0.47, 0.075, 0.103, (200, 214, 196), blur=3, mottle=14)
    p.ridge(0.54, 0.06, (26, 32, 40), rough=0.5)
    p.poly([(0.38, 0.72), (0.52, 0.5), (0.78, 0.5), (0.95, 0.72)], (30, 34, 34), blur=5)
    for x, h in ((0.55, 0.2), (0.75, 0.2), (0.65, 0.3)): p.tower(x, 0.52, 0.06, h, (64, 62, 62), (44, 34, 36), windows=(250, 190, 96))
    p.poly([(0.55, 0.52), (0.75, 0.52), (0.75, 0.4), (0.55, 0.4)], (58, 56, 56), blur=2)
    for k in range(7): p.poly([(0.555 + k * 0.028, 0.4), (0.572 + k * 0.028, 0.4), (0.572 + k * 0.028, 0.38), (0.555 + k * 0.028, 0.38)], (58, 56, 56), blur=1)
    p.glow(0.65, 0.42, 0.1, (90, 54, 14), 0.8)
    p.poly([(0, 0.7), (1, 0.7), (1, 1), (0, 1)], (20, 24, 24), blur=6)
    path = [(0.02 + i * 0.03, 0.9 - 0.15 * math.sin(i * 0.22) - i * 0.004) for i in range(16)]
    for i, (x, y) in enumerate(path): p.figure(x, y + 0.04, 0.07 + (i % 3) * 0.008, (16, 16, 18))
    p.torches([(x, y - 0.035) for x, y in path[::2]], 0.005, (200, 236, 224))                     # their lights are the wrong colour
    p.fog(0.6, 0.86, (90, 110, 108), 0.55)

# ------------------------------------------------------------------ 8. The Forty-Second Portrait
def plate_8(p):
    p.fill((44, 32, 24))
    p.glow(0.5, 0.36, 0.3, (60, 40, 20), 1.0)
    p.poly([(0.33, 1), (0.33, 0.2), (0.4, 0.1), (0.6, 0.1), (0.67, 0.2), (0.67, 1)], (70, 30, 26), blur=4, mottle=16)       # the chair
    p.poly([(0.36, 1), (0.36, 0.24), (0.42, 0.15), (0.58, 0.15), (0.64, 0.24), (0.64, 1)], (96, 40, 32), blur=4, mottle=16)
    p.poly([(0.2, 1), (0.3, 0.6), (0.42, 0.5), (0.58, 0.5), (0.7, 0.6), (0.8, 1)], (40, 44, 60), blur=5, mottle=14)         # robes
    p.poly([(0.42, 0.5), (0.58, 0.5), (0.54, 1), (0.46, 1)], (150, 130, 96), blur=5, alpha=0.8)                               # ermine front
    p.ellipse(0.5, 0.36, 0.062, 0.115, (196, 160, 128), blur=3)                                                                # the head
    p.poly([(0.43, 0.3), (0.57, 0.3), (0.585, 0.19), (0.54, 0.25), (0.5, 0.17), (0.46, 0.25), (0.415, 0.19)], (214, 172, 70), blur=2, mottle=12)   # his own crown, gold
    p.ellipse(0.31, 0.78, 0.035, 0.04, (190, 154, 124), blur=3)                                                                # left hand, on the sword
    p.line([(0.31, 0.74), (0.3, 1.0)], (170, 170, 176), width=14); p.line([(0.27, 0.75), (0.35, 0.75)], (190, 150, 60), width=12)
    p.ellipse(0.69, 0.8, 0.033, 0.036, (190, 154, 124), blur=3)
    p.ellipse(0.69, 0.76, 0.022, 0.012, (150, 162, 158), blur=1.5, mottle=0)                                                   # something small and grey in the right
    p.glow(0.69, 0.76, 0.03, (30, 50, 46), 0.9)
    # the face, scraped back to the board
    r = np.random.default_rng(12)
    scrape = p.mask(lambda d: [d.line([(W * (0.45 + r.uniform(-0.012, 0.012)), H * (0.28 + i * 0.012)), (W * (0.55 + r.uniform(-0.012, 0.012)), H * (0.285 + i * 0.012 + r.uniform(-0.01, 0.01)))], fill=255, width=int(r.uniform(14, 30))) for i in range(13)], 2)
    p.paint(scrape, (168, 138, 96), alpha=0.95, mottle=22)
    for i in range(16):
        y = 0.28 + r.uniform(0, 0.15)
        p.line([(0.44 + r.uniform(0, 0.02), y), (0.56 - r.uniform(0, 0.02), y + r.uniform(-0.012, 0.012))], (104, 80, 52), width=3, alpha=0.7)

PAINTERS = [plate_1, plate_2, plate_3, plate_4, plate_5, plate_6, plate_7, plate_8]
FINISH = [dict(darkness=0.97, warmth=(1.0, 0.95, 0.76)), {}, {}, {}, {}, {}, {}, dict(darkness=0.95)]

if __name__ == "__main__":
    for i, fn in enumerate(PAINTERS):
        p = Painting(100 + i)
        fn(p)
        path = os.path.join(OUT, f"plate_{i + 1}.jpg")
        p.finish(path, **FINISH[i])
        print(path, os.path.getsize(path) // 1024, "KB")
