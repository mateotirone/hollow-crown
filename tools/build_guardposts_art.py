#!/usr/bin/env python3
"""Paints the guard post markers (tools/build_guardposts_art.py). Run from the repo root.

  textures/particle/hc_post_ring.png     a glowing ring, white, tinted red or green by the particle
  textures/particle/hc_post_digits.png   0-9 in a row, 16 px each, white with a dark outline (post numbers)
  textures/ui/hc/post_empty.png          red marker icon for menu buttons (an empty post)
  textures/ui/hc/post_manned.png         green marker icon (a manned post)
  textures/ui/hc/post_wall.png           a wall icon for the wall's button

All RGBA (the minimap thread found palette PNGs don't show in game).
"""
import os, sys
from PIL import Image

ROOT = sys.argv[1] if len(sys.argv) > 1 else os.getcwd()
RP = os.path.join(ROOT, "Siege_Nights_RP")

FONT = {  # 5 wide, 7 tall
    "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
    "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
    "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
    "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
    "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
    "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
    "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
    "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
    "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
    "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
}


def digits():
    img = Image.new("RGBA", (160, 16), (0, 0, 0, 0))
    px = img.load()
    for d in range(10):
        on = set()
        for y, row in enumerate(FONT[str(d)]):
            for x, c in enumerate(row):
                if c == "1":
                    for sx in range(2):
                        for sy in range(2):
                            on.add((3 + x * 2 + sx, 1 + y * 2 + sy))
        for (x, y) in on:  # outline first
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    q = (x + dx, y + dy)
                    if q not in on and 0 <= q[0] < 16 and 0 <= q[1] < 16:
                        px[d * 16 + q[0], q[1]] = (20, 16, 24, 255)
        for (x, y) in on:
            px[d * 16 + x, y] = (255, 255, 255, 255)
    return img


def ring():
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    px = img.load()
    for x in range(16):
        for y in range(16):
            r = ((x - 7.5) ** 2 + (y - 7.5) ** 2) ** 0.5
            if 4.5 <= r <= 7.5:
                a = 255 if 5.2 <= r <= 6.8 else 150
                px[x, y] = (255, 255, 255, a)
            elif r < 3.0:
                px[x, y] = (255, 255, 255, 200)
    return img


def icon(rgb, dark):
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    px = img.load()
    for x in range(16):
        for y in range(16):
            r = ((x - 7.5) ** 2 + (y - 7.5) ** 2) ** 0.5
            if r <= 6.6:
                light = 1.0 - max(0.0, (x + y - 10) / 30)
                px[x, y] = tuple(int(c * light) for c in rgb) + (255,)
            elif r <= 7.6:
                px[x, y] = dark + (255,)
    for (x, y) in [(6, 5), (5, 6), (6, 6)]:  # a glint
        px[x, y] = (255, 255, 255, 220)
    return img


def wall():
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    px = img.load()
    for x in range(1, 15):
        for y in range(5, 15):
            mortar = y in (8, 11, 14) or (x + (3 if (y // 3) % 2 else 0)) % 6 == 0
            px[x, y] = (96, 92, 100, 255) if mortar else (150, 146, 154, 255)
    for x in range(1, 15):  # battlements
        if (x - 1) % 4 < 2:
            for y in range(2, 5):
                px[x, y] = (150, 146, 154, 255)
    return img


def save(img, *path):
    full = os.path.join(RP, *path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    img.save(full)
    print("wrote", os.path.relpath(full, ROOT))


if __name__ == "__main__":
    save(digits(), "textures", "particle", "hc_post_digits.png")
    save(ring(), "textures", "particle", "hc_post_ring.png")
    save(icon((214, 52, 52), (70, 10, 10)), "textures", "ui", "hc", "post_empty.png")
    save(icon((70, 200, 70), (12, 60, 12)), "textures", "ui", "hc", "post_manned.png")
    save(wall(), "textures", "ui", "hc", "post_wall.png")
