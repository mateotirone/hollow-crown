"""Living clocks (Mateo 2026-11-15: "clock entities that follow the game time, and in weird cases can stop or go
backwards"). Every clock in the world is one entity, siege:clock, standing in the air cell in front of its face. Its
hands are turned on the client from the game's own time of day (query.time_of_day), so a clock costs the server
nothing while it runs: the script only writes four properties when a clock is stopped, run backwards or let go.

One model, seven faces (one per region, plus the royal face for Kingsrest and the capital's civic towers):
  vale     cream enamel, black Roman numerals, brass rim, blued spade hands, a moon-phase window
  frost    dark stave wood, white rune-staff marks, a birch rim with snow on top, iron hands rimed white
  salt     whitewash with a sea-green compass rose, a riveted brass porthole rim, navy hands, an anchor tail
  ember    sun-baked terracotta, gold sun and twelve rays, a gold sun hand, a sun-and-moon day window
  fen      flaking green paint on mangrove, lantern-yellow pips, moss on the rim, crooked iron hands
  hollow   black veinstone, thirteen scratched marks (the hands keep twelve), bone hands; runs backwards
  royal    night-blue with gold stars, a gold chapter ring and numerals, a gold sun hand, a moon-phase window

Geometry is one block across (16 units) with its centre half a block up and its back on the wall behind the cell
(model +z; the front, -z, looks out); the animation scales the root by the size property (1 for a post or a wall
clock, 3 for a house, 5 or 7 for a tower: build-instructions/towers/README.md, the clock). Bones: root > disc
(moon or sun disc behind the window), dial, bezel, snow, hour, minute, hub.

Writes:
  Siege_Nights_RP/models/entity/clock.geo.json                    geometry.siege_clock
  Siege_Nights_RP/textures/entity/siege/clock/<style>.png         256 x 256, one per face
  Siege_Nights_RP/entity/clock.entity.json, animations/clock.animation.json, render_controllers/siege_clock...

Run from the repo root:  python3 studio/art/build_clocks.py
"""
import json
import math
import os
import random

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RP = os.path.join(ROOT, "Siege_Nights_RP")
STYLES = ["vale", "frost", "salt", "ember", "fen", "hollow", "royal"]   # = siege:style 0..6 (scripts/clocks/logic.js)
SERIF = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"

# ---------- atlas (256 x 256) ----------
DIAL = (0, 0, 128, 128)      # the face, round, transparent outside the rim and in the window
DISC = (128, 0, 64, 64)      # the disc behind the window (two moons, or a sun and a moon)
HOUR = (192, 0, 16, 32)      # hour hand, pointing up, the hub 3/4 of the way down... see HAND_GEO
MINUTE = (208, 0, 16, 64)
HUB = (224, 0, 8, 8)
BEZEL = (224, 8, 16, 8)
SNOW = (224, 16, 16, 8)

# hand planes in model units: (width, length up from the hub, tail below the hub)
HAND_GEO = {"hour": (3.0, 4.5, 1.5), "minute": (2.25, 7.0, 2.0)}
DIAL_Z, DISC_Z, HOUR_Z, MIN_Z = 7.86, 7.96, 7.55, 7.40   # depths: the wall is at 8, the front looks to -z

C = lambda *v: tuple(int(x) for x in v)

PAL = {
    "vale":   dict(dial=C(236, 226, 200), ring=C(226, 214, 184), ink=C(30, 28, 30), rim=C(176, 136, 58), rim2=C(120, 88, 34),
                   hand=C(34, 40, 64), hand2=C(70, 84, 120), hub=C(176, 136, 58), sky=C(32, 44, 92), moon=C(240, 226, 170), window=True),
    "frost":  dict(dial=C(74, 50, 32), ring=C(64, 42, 26), ink=C(232, 236, 240), rim=C(214, 202, 168), rim2=C(150, 138, 110),
                   hand=C(150, 160, 172), hand2=C(236, 244, 250), hub=C(110, 116, 124), sky=C(26, 34, 56), moon=C(226, 236, 246), window=True),
    "salt":   dict(dial=C(234, 238, 234), ring=C(220, 228, 224), ink=C(40, 60, 92), rim=C(190, 150, 70), rim2=C(130, 96, 40),
                   hand=C(38, 56, 90), hand2=C(70, 110, 150), hub=C(190, 150, 70), sky=C(40, 74, 108), moon=C(246, 240, 214),
                   rose=C(70, 150, 140), rose2=C(40, 110, 104), window=True),
    "ember":  dict(dial=C(212, 156, 96), ring=C(196, 136, 78), ink=C(110, 50, 24), rim=C(116, 62, 30), rim2=C(232, 182, 64),
                   hand=C(232, 182, 64), hand2=C(255, 226, 120), hub=C(232, 182, 64), sky=C(120, 170, 220), sky2=C(28, 30, 70),
                   sun=C(255, 210, 80), moon=C(236, 232, 214), window=True),
    "fen":    dict(dial=C(86, 106, 70), ring=C(74, 94, 60), ink=C(240, 214, 120), rim=C(70, 52, 40), rim2=C(96, 132, 56),
                   hand=C(36, 34, 30), hand2=C(80, 76, 66), hub=C(60, 54, 44), sky=C(22, 34, 30), moon=C(214, 230, 170),
                   wood=C(92, 62, 44), window=True),
    "hollow": dict(dial=C(30, 26, 36), ring=C(24, 20, 30), ink=C(190, 184, 170), rim=C(16, 14, 20), rim2=C(150, 90, 210),
                   hand=C(222, 214, 194), hand2=C(160, 150, 130), hub=C(150, 90, 210), vein=C(170, 100, 235), window=False),
    "royal":  dict(dial=C(30, 44, 98), ring=C(206, 164, 64), ink=C(240, 204, 96), rim=C(214, 172, 70), rim2=C(150, 112, 40),
                   hand=C(236, 196, 84), hand2=C(255, 232, 150), hub=C(236, 196, 84), sky=C(14, 18, 50), moon=C(246, 236, 190),
                   star=C(240, 210, 120), window=True),
}
ROMAN = ["XII", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI"]

S = 4          # supersampling
N = 128 * S    # the dial drawn at 512, then shrunk


def noise(img, amt, seed, box=None):
    rnd = random.Random(seed)
    px = img.load()
    x0, y0, x1, y1 = box or (0, 0, img.width, img.height)
    for y in range(y0, y1):
        for x in range(x0, x1):
            p = px[x, y]
            if len(p) == 4 and p[3] == 0: continue
            d = rnd.randint(-amt, amt)
            px[x, y] = tuple(max(0, min(255, c + d)) for c in p[:3]) + p[3:]


def _and(a, b):
    from PIL import ImageChops
    return ImageChops.multiply(a, b)


def polar(r, deg, cx=N / 2, cy=N / 2):
    a = math.radians(deg)
    return cx + r * math.sin(a), cy - r * math.cos(a)


def dial(style):
    P = PAL[style]
    R = N / 2
    im = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    rnd = random.Random(STYLES.index(style) * 31 + 7)
    d.ellipse([0, 0, N - 1, N - 1], fill=P["rim"] + (255,))
    d.ellipse([R * 0.07, R * 0.07, N - R * 0.07, N - R * 0.07], fill=P["rim2"] + (255,))
    d.ellipse([R * 0.10, R * 0.10, N - R * 0.10, N - R * 0.10], fill=P["ring"] + (255,))
    inner = 0.70
    d.ellipse([R * (1 - inner), R * (1 - inner), R * (1 + inner), R * (1 + inner)], fill=P["dial"] + (255,))

    if style == "frost":                              # stave grain: dark vertical planks, kept inside the rim
        layer = Image.new("RGBA", (N, N), (0, 0, 0, 0)); g = ImageDraw.Draw(layer)
        for i in range(12):
            x = R * 0.1 + i * (N * 0.8 / 12)
            g.line([x, R * 0.1, x, N - R * 0.1], fill=C(52, 34, 22) + (255,), width=S)
        for i in range(120):
            x = rnd.uniform(R * 0.1, N - R * 0.1); y = rnd.uniform(R * 0.1, N - R * 0.1)
            g.line([x, y, x + rnd.uniform(-2, 2) * S, y + rnd.uniform(6, 16) * S], fill=C(88, 60, 40) + (255,), width=S // 2 or 1)
        m = Image.new("L", (N, N), 0); ImageDraw.Draw(m).ellipse([R * 0.11, R * 0.11, N - R * 0.11, N - R * 0.11], fill=255)
        im.paste(layer, (0, 0), _and(layer.getchannel("A"), m))
    if style == "fen":                                # paint flaking off the wood
        for i in range(60):
            x = rnd.uniform(R * 0.2, N - R * 0.2); y = rnd.uniform(R * 0.2, N - R * 0.2)
            if math.hypot(x - R, y - R) > R * 0.86: continue
            w = rnd.uniform(3, 9) * S; h = rnd.uniform(2, 5) * S
            d.ellipse([x, y, x + w, y + h], fill=P["wood"] + (255,))
    if style == "hollow":                             # veins through the stone
        for i in range(9):
            a = rnd.uniform(0, 360); r0 = rnd.uniform(0.2, 0.5) * R
            pts = [polar(r0, a)]
            for k in range(6):
                a += rnd.uniform(-25, 25); r0 += R * 0.09
                pts.append(polar(min(r0, R * 0.88), a))
            d.line(pts, fill=P["vein"] + (255,), width=S)
    if style == "royal":                              # stars on the night blue
        for i in range(70):
            r0 = rnd.uniform(0.12, 0.66) * R; a = rnd.uniform(0, 360)
            x, y = polar(r0, a); s = rnd.choice([1, 1, 2]) * S * 0.6
            d.ellipse([x - s, y - s, x + s, y + s], fill=P["star"] + (255,))
    if style == "salt":                               # the compass rose
        for k in range(8):
            big = k % 2 == 0
            L = R * (0.52 if big else 0.34); W = R * (0.09 if big else 0.06)
            a = k * 45
            tip = polar(L, a); l = polar(W, a - 90); r = polar(W, a + 90)
            d.polygon([tip, l, (R, R)], fill=(P["rose"] if big else P["rose2"]) + (255,))
            d.polygon([tip, r, (R, R)], fill=(P["rose2"] if big else P["rose"]) + (255,))
    if style == "ember":                              # the sun with twelve rays
        for k in range(12):
            a = k * 30 + 15
            tip = polar(R * 0.62, a); l = polar(R * 0.30, a - 9); r = polar(R * 0.30, a + 9)
            d.polygon([tip, l, r], fill=C(234, 186, 90) + (255,))
        d.ellipse([R - R * 0.30, R - R * 0.30, R + R * 0.30, R + R * 0.30], fill=C(240, 196, 92) + (255,))
        d.ellipse([R - R * 0.24, R - R * 0.24, R + R * 0.24, R + R * 0.24], fill=C(250, 214, 110) + (255,))

    # the chapter ring: minute ticks, then the hours
    tick = P["ink"] + (255,)
    marks = 13 if style == "hollow" else 12
    for m in range(60):
        if style == "hollow": break
        a = m * 6
        r1, r2 = (R * 0.80, R * 0.88) if m % 5 else (R * 0.76, R * 0.89)
        d.line([polar(r1, a), polar(r2, a)], fill=tick, width=int(S * (1.6 if m % 5 == 0 else 0.8)) or 1)
    if style in ("vale", "royal"):
        font = ImageFont.truetype(SERIF, int(R * 0.13))
        for h in range(12):
            x, y = polar(R * 0.62, h * 30)
            t = ROMAN[h]
            bb = d.textbbox((0, 0), t, font=font)
            d.text((x - (bb[2] + bb[0]) / 2, y - (bb[3] + bb[1]) / 2), t, font=font, fill=tick)
    elif style == "frost":                            # rune staves: a stroke with a little branch
        for h in range(12):
            a = h * 30
            p1, p2 = polar(R * 0.52, a), polar(R * 0.70, a)
            d.line([p1, p2], fill=tick, width=int(S * 2.2))
            q1 = polar(R * 0.62, a); q2 = polar(R * 0.69, a + (12 if h % 2 else -12))
            d.line([q1, q2], fill=tick, width=int(S * 1.6))
    elif style == "salt":
        for h in range(12):
            x, y = polar(R * 0.64, h * 30); s = R * (0.06 if h % 3 == 0 else 0.035)
            d.ellipse([x - s, y - s, x + s, y + s], fill=tick)
    elif style == "ember":
        for h in range(12):
            a = h * 30
            tip = polar(R * 0.70, a); l = polar(R * 0.78, a - 4); r = polar(R * 0.78, a + 4)
            d.polygon([tip, l, r], fill=tick)
    elif style == "fen":
        for h in range(12):
            x, y = polar(R * 0.64, h * 30 + rnd.uniform(-2, 2)); s = R * (0.055 if h % 3 == 0 else 0.035)
            d.ellipse([x - s, y - s, x + s, y + s], fill=tick)
    elif style == "hollow":                           # thirteen scratches; the hands still keep twelve
        for h in range(marks):
            a = h * (360 / marks)
            d.line([polar(R * 0.70, a + rnd.uniform(-2, 2)), polar(R * 0.88, a + rnd.uniform(-3, 3))], fill=tick, width=int(S * 1.8))
            d.line([polar(R * 0.74, a + 3), polar(R * 0.84, a - 2)], fill=tick, width=int(S * 0.8))

    if style == "fen":                                # moss on the rim
        for i in range(40):
            a = rnd.uniform(-70, 250) if rnd.random() < 0.7 else rnd.uniform(0, 360)
            x, y = polar(R * rnd.uniform(0.9, 0.99), a); s = rnd.uniform(2, 5) * S
            d.ellipse([x - s, y - s, x + s, y + s], fill=rnd.choice([C(88, 124, 52), C(110, 146, 60), C(70, 100, 44)]) + (255,))
    if style == "salt":                               # rivets in the porthole rim
        for k in range(16):
            x, y = polar(R * 0.965, k * 22.5 + 11.25); s = R * 0.022
            d.ellipse([x - s, y - s, x + s, y + s], fill=C(232, 200, 120) + (255,))

    if P["window"]:                                   # the window over the hub, between the 10 and the 2
        win = Image.new("L", (N, N), 0)
        w = ImageDraw.Draw(win)
        w.pieslice([R - R * 0.42, R - R * 0.42, R + R * 0.42, R + R * 0.42], 270 - 32, 270 + 32, fill=255)
        w.ellipse([R - R * 0.20, R - R * 0.20, R + R * 0.20, R + R * 0.20], fill=0)
        frame = Image.new("RGBA", (N, N), (0, 0, 0, 0))
        f = ImageDraw.Draw(frame)
        f.pieslice([R - R * 0.46, R - R * 0.46, R + R * 0.46, R + R * 0.46], 270 - 36, 270 + 36, fill=P["rim"] + (255,))
        f.ellipse([R - R * 0.17, R - R * 0.17, R + R * 0.17, R + R * 0.17], fill=(0, 0, 0, 0))
        im.alpha_composite(frame)
        a = im.getchannel("A")
        a.paste(0, mask=win)
        im.putalpha(a)
    return im


def disc(style):
    P = PAL[style]
    M = 64 * S; R = M / 2
    im = Image.new("RGBA", (M, M), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if style == "ember":                              # day sky on top (the sun), night below (the moon)
        d.pieslice([0, 0, M - 1, M - 1], 180, 360, fill=P["sky"] + (255,))
        d.pieslice([0, 0, M - 1, M - 1], 0, 180, fill=P["sky2"] + (255,))
        x, y = R, R * 0.40; s = R * 0.16
        d.ellipse([x - s, y - s, x + s, y + s], fill=P["sun"] + (255,))
        x, y = R, R * 1.60; s = R * 0.13
        d.ellipse([x - s, y - s, x + s, y + s], fill=P["moon"] + (255,))
    elif P["window"]:
        d.ellipse([0, 0, M - 1, M - 1], fill=P["sky"] + (255,))
        rnd = random.Random(5)
        for i in range(30):
            x, y = rnd.uniform(0, M), rnd.uniform(0, M)
            if math.hypot(x - R, y - R) > R * 0.95: continue
            s = S * 0.6
            d.ellipse([x - s, y - s, x + s, y + s], fill=(230, 230, 210, 255))
        for y in (R * 0.40, R * 1.60):                # two moons, a lunar month a half turn
            s = R * 0.16
            d.ellipse([R - s, y - s, R + s, y + s], fill=P["moon"] + (255,))
            d.ellipse([R - s * 0.4, y - s * 0.5, R - s * 0.05, y - s * 0.15], fill=tuple(int(c * 0.86) for c in P["moon"]) + (255,))
    return im.resize((64, 64), Image.LANCZOS)


def hand(style, which):
    P = PAL[style]
    w, h = (16, 32) if which == "hour" else (16, 64)
    W, H = w * S * 2, h * S * 2
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    width, up, tail = HAND_GEO[which]
    hub_y = H * up / (up + tail)                     # pixel row of the hub
    cx = W / 2
    k = W / width                                     # pixels per model unit across
    col, col2 = P["hand"] + (255,), P["hand2"] + (255,)
    shaft = (0.32 if which == "hour" else 0.22) * k
    tip_y = H * 0.02
    d.rectangle([cx - shaft, tip_y + (H * 0.18 if which == "hour" else H * 0.06), cx + shaft, H - H * 0.02], fill=col)
    if style in ("vale", "royal", "frost"):           # spade / arrow
        if which == "hour":
            sw = 1.2 * k; sy = H * 0.18
            d.polygon([(cx, tip_y), (cx - sw, sy + H * 0.06), (cx, sy + H * 0.16), (cx + sw, sy + H * 0.06)], fill=col)
            d.ellipse([cx - 0.45 * k, sy + H * 0.02, cx + 0.45 * k, sy + H * 0.10], fill=(0, 0, 0, 0))
        else:
            d.polygon([(cx, tip_y), (cx - 0.8 * k, H * 0.10), (cx + 0.8 * k, H * 0.10)], fill=col)
        if style == "frost":
            d.line([(cx - shaft, tip_y + H * 0.1), (cx - shaft, hub_y)], fill=col2, width=int(k * 0.12))
    elif style == "salt":
        if which == "hour":                           # an anchor's flukes on the tail
            d.polygon([(cx, tip_y), (cx - 0.9 * k, H * 0.22), (cx + 0.9 * k, H * 0.22)], fill=col)
            d.arc([cx - 1.2 * k, H - H * 0.32, cx + 1.2 * k, H - H * 0.02], 20, 160, fill=col, width=int(k * 0.35))
        else:
            d.polygon([(cx, tip_y), (cx - 0.7 * k, H * 0.09), (cx + 0.7 * k, H * 0.09)], fill=col)
    elif style == "ember":                            # a sun on the hour hand
        if which == "hour":
            s = 1.2 * k; y = H * 0.20
            for a in range(0, 360, 45):
                d.polygon([polar(s * 1.25, a, cx, y), polar(s * 0.6, a - 18, cx, y), polar(s * 0.6, a + 18, cx, y)], fill=col)
            d.ellipse([cx - s * 0.7, y - s * 0.7, cx + s * 0.7, y + s * 0.7], fill=col2)
        else:
            d.polygon([(cx, tip_y), (cx - 0.6 * k, H * 0.08), (cx + 0.6 * k, H * 0.08)], fill=col)
    elif style == "fen":                              # crooked: the top third bent off line
        d.rectangle([cx - shaft, 0, cx + shaft, H], fill=(0, 0, 0, 0))
        bend = H * 0.38
        d.line([(cx, H - H * 0.02), (cx, bend)], fill=col, width=int(shaft * 2))
        d.line([(cx, bend), (cx + 0.5 * k, tip_y + H * 0.04)], fill=col, width=int(shaft * 2))
        d.polygon([(cx + 0.55 * k, tip_y), (cx + 0.05 * k, tip_y + H * 0.10), (cx + 0.95 * k, tip_y + H * 0.08)], fill=col)
    elif style == "hollow":                           # bone: knobbed both ends
        d.rectangle([cx - shaft * 0.8, tip_y, cx + shaft * 0.8, H], fill=col)
        for y in (tip_y + 0.5 * k, H - 0.6 * k):
            for dx in (-0.4, 0.4):
                d.ellipse([cx + dx * k - 0.38 * k, y - 0.38 * k, cx + dx * k + 0.38 * k, y + 0.38 * k], fill=col)
        d.line([(cx + shaft * 0.3, tip_y + k), (cx + shaft * 0.3, H - k)], fill=col2, width=max(1, int(k * 0.08)))
    # the counterweight on the tail
    if style not in ("salt", "hollow", "fen"):
        s = 0.55 * k
        d.ellipse([cx - s, H - H * 0.10 - s, cx + s, H - H * 0.10 + s], fill=col)
    im = im.resize((w, h), Image.LANCZOS)
    a = im.getchannel("A").point(lambda v: 255 if v >= 110 else 0)
    im.putalpha(a)
    return im


def flat(size, col, seed, amt=8):
    im = Image.new("RGBA", size, col + (255,))
    noise(im, amt, seed)
    return im


def texture(style):
    P = PAL[style]
    atlas = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
    dl = dial(style).resize((128, 128), Image.LANCZOS)
    a = dl.getchannel("A").point(lambda v: 255 if v >= 128 else 0)
    dl.putalpha(a)
    noise(dl, 5, STYLES.index(style))
    atlas.paste(dl, DIAL[:2])
    atlas.paste(disc(style), DISC[:2])
    atlas.paste(hand(style, "hour"), HOUR[:2])
    atlas.paste(hand(style, "minute"), MINUTE[:2])
    atlas.paste(flat((8, 8), P["hub"], 3), HUB[:2])
    atlas.paste(flat((16, 8), P["rim"], 4, 10), BEZEL[:2])
    atlas.paste(flat((16, 8), C(240, 246, 250), 5, 6), SNOW[:2])
    return atlas


# ---------- geometry ----------
def uvn(region):
    u, v, w, h = region
    return {"north": {"uv": [u, v], "uv_size": [w, h]}}


def geometry():
    cy = 8.0
    bones = [{"name": "root", "pivot": [0, cy, 8]}]
    bones.append({"name": "disc", "parent": "root", "pivot": [0, cy, 8],
                  "cubes": [{"origin": [-4.6, cy - 4.6, DISC_Z], "size": [9.2, 9.2, 0], "uv": uvn(DISC)}]})
    bones.append({"name": "dial", "parent": "root", "pivot": [0, cy, 8],
                  "cubes": [{"origin": [-8, cy - 8, DIAL_Z], "size": [16, 16, 0], "uv": uvn(DIAL)}]})
    ring = []                                         # a raised bezel: sixteen staves round the rim
    for k in range(16):
        ring.append({"origin": [-1.55, cy + 7.15, 7.25], "size": [3.1, 0.8, 0.6], "pivot": [0, cy, 8], "rotation": [0, 0, k * 22.5],
                     "uv": {"north": {"uv": list(BEZEL[:2]), "uv_size": [16, 4]}, "up": {"uv": [BEZEL[0], BEZEL[1] + 4], "uv_size": [16, 4]},
                            "down": {"uv": [BEZEL[0], BEZEL[1] + 4], "uv_size": [16, 4]}}})
    bones.append({"name": "bezel", "parent": "root", "pivot": [0, cy, 8], "cubes": ring})
    bones.append({"name": "snow", "parent": "root", "pivot": [0, cy, 8],
                  "cubes": [{"origin": [-3.4, cy + 7.9, 7.0], "size": [6.8, 0.6, 1.0],
                             "uv": {k: {"uv": list(SNOW[:2]), "uv_size": [16, 8]} for k in ("north", "up", "east", "west")}},
                            {"origin": [-5.4, cy + 6.2, 7.0], "size": [2.0, 0.5, 1.0], "pivot": [0, cy, 8], "rotation": [0, 0, -24],
                             "uv": {k: {"uv": list(SNOW[:2]), "uv_size": [16, 8]} for k in ("north", "up")}},
                            {"origin": [3.4, cy + 6.2, 7.0], "size": [2.0, 0.5, 1.0], "pivot": [0, cy, 8], "rotation": [0, 0, 24],
                             "uv": {k: {"uv": list(SNOW[:2]), "uv_size": [16, 8]} for k in ("north", "up")}}]})
    for name, region, z in (("hour", HOUR, HOUR_Z), ("minute", MINUTE, MIN_Z)):
        w, up, tail = HAND_GEO[name]
        bones.append({"name": name, "parent": "root", "pivot": [0, cy, 8],
                      "cubes": [{"origin": [-w / 2, cy - tail, z], "size": [w, up + tail, 0], "uv": uvn(region)}]})
    bones.append({"name": "hub", "parent": "root", "pivot": [0, cy, 8],
                  "cubes": [{"origin": [-0.7, cy - 0.7, 7.0], "size": [1.4, 1.4, 0.95],
                             "uv": {k: {"uv": list(HUB[:2]), "uv_size": [8, 8]} for k in ("north", "east", "west", "up", "down")}}]})
    return {"format_version": "1.12.0", "minecraft:geometry": [{
        "description": {"identifier": "geometry.siege_clock", "texture_width": 256, "texture_height": 256,
                        "visible_bounds_width": 10, "visible_bounds_height": 10, "visible_bounds_offset": [0, 0.5, 0]},
        "bones": bones}]}


# ---------- the client side: hands from the time of day ----------
# v.m = the minute the clock shows (0..1439, midnight 0): base + rate x (minutes since t0), wrapped.
#   habit 1 (Harrowford's chapel clock): stops at 3:17 every night until the warden winds it at six in the evening.
#   habit 2 (the Hollow): shows the time backwards.
# The minute hand sits on its minute and jumps to the next in the last tenth of it (a tick, about 0.08 s);
# strain makes a held minute hand jerk at the next minute every few seconds and fall back (Millbrook's clocks).
PRE = [
    "v.tod = q.time_of_day * 1440.0;",
    "v.m = q.property('siege:base') + q.property('siege:rate') * math.mod(v.tod - q.property('siege:t0') + 1440.0, 1440.0);",
    "v.m = q.property('siege:habit') == 2 ? 1440.0 - v.m : v.m;",
    "v.m = math.mod(math.mod(v.m, 1440.0) + 1440.0, 1440.0);",
    "v.m = (q.property('siege:habit') == 1 && v.m >= 197.0 && v.m < 1080.0) ? 197.0 : v.m;",
    "v.mi = math.floor(v.m);",
    "v.step = v.mi + math.clamp((v.m - v.mi - 0.9) * 10.0, 0.0, 1.0);",
    "v.strain = (q.property('siege:strain') && math.mod(q.life_time + q.property('siege:t0') * 0.37, 4.3) < 0.16) ? 3.0 : 0.0;",
    "v.mn = math.mod(v.step, 60.0) * 6.0 + v.strain;",
    "v.hr = math.mod(v.step, 720.0) * 0.5;",
    "v.disc = q.property('siege:style') == 3 ? v.tod * 0.25 + 180.0 : q.moon_phase * 22.5;",
]
# Bedrock turns a bone with a positive z rotation clockwise as seen from the model's front (the humanoid bob swings
# the right arm out with +z), so the hands take the angles as they are.
ANIM = {"format_version": "1.8.0", "animations": {"animation.siege_clock.hands": {"loop": True, "bones": {
    "root": {"scale": "math.max(1, q.property('siege:size'))"},
    "hour": {"rotation": [0, 0, "v.hr"]},
    "minute": {"rotation": [0, 0, "v.mn"]},
    "disc": {"rotation": [0, 0, "v.disc"]}}}}}

CLIENT = {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
    "identifier": "siege:clock",
    "materials": {"default": "entity_alphatest"},
    "textures": {s: f"textures/entity/siege/clock/{s}" for s in STYLES},
    "geometry": {"default": "geometry.siege_clock"},
    "animations": {"hands": "animation.siege_clock.hands"},
    "scripts": {"pre_animation": PRE, "animate": ["hands"]},
    "render_controllers": ["controller.render.siege_clock"]}}}

RC = {"format_version": "1.8.0", "render_controllers": {"controller.render.siege_clock": {
    "arrays": {"textures": {"Array.faces": [f"Texture.{s}" for s in STYLES]}},
    "geometry": "Geometry.default",
    "materials": [{"*": "Material.default"}],
    "textures": ["Array.faces[q.property('siege:style')]"],
    "part_visibility": [{"*": True},
                        {"disc": "q.property('siege:style') != 5"},
                        {"snow": "q.property('siege:style') == 1"}]}}}


def dump(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(obj, f, indent=1)
        f.write("\n")


def main():
    out = os.path.join(RP, "textures/entity/siege/clock")
    os.makedirs(out, exist_ok=True)
    for s in STYLES:
        texture(s).save(os.path.join(out, f"{s}.png"))
    geo = geometry()
    dump(os.path.join(RP, "models/entity/clock.geo.json"), geo)
    dump(os.path.join(RP, "entity/clock.entity.json"), CLIENT)
    dump(os.path.join(RP, "animations/clock.animation.json"), ANIM)
    dump(os.path.join(RP, "render_controllers/siege_clock.render_controllers.json"), RC)
    print("clocks:", ", ".join(STYLES))


if __name__ == "__main__":
    main()
