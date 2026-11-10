"""Hollow bolt projectile (3x3x3 cube, 64x32): a violet shard with a white-hot heart.  python3 build_bolt.py [repo root]"""
import sys
from PIL import Image
ROOT = (sys.argv[1] if len(sys.argv) > 1 else '/mnt/project-files/siege-nights').rstrip('/') + '/'
V = [(74, 30, 136), (160, 92, 240), (200, 150, 255), (244, 232, 255)]
im = Image.new('RGBA', (64, 32), (0, 0, 0, 0))
for (u, v) in ((3, 0), (6, 0), (0, 3), (3, 3), (6, 3), (9, 3)):          # up, down, east, north, west, south of a 3x3x3 box at uv 0,0
    for y in range(3):
        for x in range(3):
            d = abs(x - 1) + abs(y - 1)
            im.putpixel((u + x, v + y), V[3 if d == 0 else 2 if d == 1 else 1 if (x + y) % 4 == 0 else 0] + (255,))
im.save(ROOT + 'Siege_Nights_RP/textures/entity/siege/bestiary/hollow_bolt.png'); print('ok')
