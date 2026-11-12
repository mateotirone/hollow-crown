"""Texture for the Gravestone (siege:gravestone): weathered grey headstone, moss creeping up from the foot.
Run: python3 studio/art/build_gravestone.py   (writes Siege_Nights_RP/textures/blocks/graves/gravestone.png)

32x16: the left 16x16 is the front face, with a carved cross and a worn name panel; the right 16x16 is plain
stone for the sides, back, top and the plinth. UVs are in models/blocks/gravestone.geo.json.
"""
import os, random
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "Siege_Nights_RP", "textures", "blocks", "graves", "gravestone.png")

STONE = [(0x55, 0x56, 0x5a), (0x66, 0x67, 0x6a), (0x74, 0x74, 0x76), (0x82, 0x81, 0x80), (0x8f, 0x8d, 0x8a)]
MOSS = [(0x3c, 0x4a, 0x2a), (0x4c, 0x5e, 0x30), (0x5e, 0x70, 0x3a)]
CUT = (0x3a, 0x3a, 0x3e)      # the carving, in shadow
LIP = (0x9a, 0x98, 0x94)      # the lit lower edge of a cut


def stone(img, x0, seed):
    rnd = random.Random(seed)
    for y in range(16):
        for x in range(16):
            # broad clusters, lighter toward the top (rain-washed), darker at the foot (damp)
            n = rnd.random() * 1.6 + (15 - y) / 15 * 1.6 + (1 if (x // 4 + y // 5 + seed) % 3 == 0 else 0)
            img.putpixel((x0 + x, y), STONE[max(0, min(4, int(n)))])
    for y in range(11, 16):                       # moss climbing from the foot, thinning upward
        for x in range(16):
            if rnd.random() < (y - 10) / 7:
                img.putpixel((x0 + x, y), MOSS[rnd.randrange(3)])


def main():
    img = Image.new("RGBA", (32, 16))
    stone(img, 0, 3)
    stone(img, 16, 7)
    # front: a carved cross, its lower edges catching the light
    for y in range(2, 10):
        img.putpixel((7, y), CUT); img.putpixel((8, y), CUT)
    for x in range(5, 11):
        img.putpixel((x, 4), CUT)
    for x in range(5, 11):
        if x not in (7, 8): img.putpixel((x, 5), LIP)
    img.putpixel((7, 10), LIP); img.putpixel((8, 10), LIP)
    # a worn name panel, mostly rubbed away
    rnd = random.Random(11)
    for x in range(4, 12):
        if rnd.random() < 0.55: img.putpixel((x, 12), CUT)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    img.save(OUT)
    print("wrote", os.path.relpath(OUT, ROOT))


if __name__ == "__main__":
    main()
