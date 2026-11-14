"""The refugee family's cart (Act 2, Mateo 2026-11-14: "Do we have 3D models of the cart?" ... "yes" to building one).

A two-wheeled farm cart piled with what a family could save from a hamlet that fell: grain sacks, a chest, a rolled
mattress, a birdcage, a cooking pot, a broom, and a lantern on a pole at the back. Two shafts run forward to the mule
(a vanilla mule is hitched in game; it is not part of this model). The wheels are their own bones (wheel_left,
wheel_right) so an animation can turn them while the cart rolls up the road.

Geometry is entity geometry: 16 units to a block, origin on the ground under the axle, the shafts point to -z (the
way the cart faces).

Writes:
  Siege_Nights_RP/models/entity/family_cart.geo.json     (geometry.siege_family_cart)
  Siege_Nights_RP/textures/entity/siege/family_cart.png  (64 x 64)

Run from the repo root:  python3 studio/art/build_family_cart.py
"""
import json
import math
import os
import random

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
GEO_OUT = os.path.join(ROOT, "Siege_Nights_RP/models/entity/family_cart.geo.json")
PNG_OUT = os.path.join(ROOT, "Siege_Nights_RP/textures/entity/siege/family_cart.png")

# ---------- texture atlas (u, v, w, h) ----------
PLANK = (0, 0, 16, 16)      # weathered oak boards, grain along u
DARK = (16, 0, 16, 16)      # the frame, shafts and spokes: darker, oiled
IRON = (32, 0, 8, 8)        # wheel tyres and straps
ROPE = (40, 0, 8, 8)
SACK = (48, 0, 16, 16)      # sacking, a stitched seam
CHEST = (0, 16, 16, 16)     # painted chest boards with an iron band
LID = (16, 16, 16, 8)
MATTRESS = (32, 16, 16, 16) # ticking stripes
CAGE = (48, 16, 16, 16)     # brass bars over the dark (the bird is gone)
POT = (16, 24, 8, 8)
LAMP = (24, 24, 8, 8)       # lantern glass with a warm glow
STRAW = (0, 32, 16, 16)     # the broom's head and straw under the load
CLOTH = (16, 32, 16, 16)    # a faded blue blanket thrown over the load

rnd = random.Random(11)


def shade(c, f):
    return tuple(max(0, min(255, int(v * f))) for v in c)


def fill(img, region, fn):
    u0, v0, w, h = region
    for y in range(h):
        for x in range(w):
            img.putpixel((u0 + x, v0 + y), fn(x, y) + (255,) if len(fn(x, y)) == 3 else fn(x, y))


def build_png():
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    oak, dark = (138, 104, 66), (86, 62, 40)
    # boards: grain runs along u, a seam every 4 rows, nail heads at the ends
    def plank(x, y):
        c = oak if (y // 4) % 2 == 0 else shade(oak, 0.93)
        if y % 4 == 3:
            c = shade(oak, 0.62)
        if (x in (1, 14)) and y % 4 == 1:
            c = (70, 66, 64)
        return shade(c, 0.9 + rnd.random() * 0.14)
    fill(img, PLANK, plank)
    fill(img, DARK, lambda x, y: shade(dark if (x + y // 3) % 5 else shade(dark, 0.8), 0.9 + rnd.random() * 0.15))
    fill(img, IRON, lambda x, y: shade((78, 76, 78) if (x + y) % 3 else (58, 56, 60), 0.92 + rnd.random() * 0.12))
    fill(img, ROPE, lambda x, y: shade((176, 150, 102) if (x + y) % 4 < 2 else (140, 116, 76), 0.95 + rnd.random() * 0.08))
    def sack(x, y):
        c = (190, 170, 128) if (x + y) % 2 else (176, 156, 116)
        if x == 8:
            c = (120, 100, 70)  # the seam
        if y in (2, 3) and 3 < x < 13:
            c = (150, 128, 90)  # the tie
        return shade(c, 0.93 + rnd.random() * 0.1)
    fill(img, SACK, sack)
    def chest(x, y):
        c = (92, 70, 54) if (y // 5) % 2 == 0 else (84, 64, 50)
        if y in (7, 8):
            c = (66, 64, 66)    # iron band
        if 6 <= x <= 9 and 6 <= y <= 9:
            c = (176, 150, 70)  # the lock plate
        return shade(c, 0.92 + rnd.random() * 0.1)
    fill(img, CHEST, chest)
    fill(img, LID, lambda x, y: shade((100, 76, 58) if y else (70, 54, 42), 0.92 + rnd.random() * 0.1))
    fill(img, MATTRESS, lambda x, y: shade((214, 206, 188) if (x // 2) % 3 else (78, 96, 128), 0.93 + rnd.random() * 0.08))
    def cage(x, y):
        if x % 3 == 0 or y in (0, 15):
            return shade((180, 146, 70), 0.9 + rnd.random() * 0.15)
        return (0, 0, 0, 0)   # see through the bars
    u0, v0, w, h = CAGE
    for y in range(h):
        for x in range(w):
            c = cage(x, y)
            img.putpixel((u0 + x, v0 + y), c if len(c) == 4 else c + (255,))
    fill(img, POT, lambda x, y: shade((52, 50, 54) if y else (90, 88, 92), 0.9 + rnd.random() * 0.15))
    def lamp(x, y):
        if x in (0, 7) or y in (0, 7):
            return (40, 38, 40)
        return shade((255, 196, 104), 0.9 + 0.12 * (1 - abs(x - 3.5) / 4))
    fill(img, LAMP, lamp)
    fill(img, STRAW, lambda x, y: shade((206, 178, 96) if (x * 3 + y) % 4 else (170, 140, 70), 0.92 + rnd.random() * 0.1))
    def cloth(x, y):
        c = (74, 92, 120) if (x // 4 + y // 4) % 2 else (66, 82, 108)
        if y in (14, 15):
            c = (150, 130, 96)  # a worn hem
        return shade(c, 0.92 + rnd.random() * 0.1)
    fill(img, CLOTH, cloth)
    os.makedirs(os.path.dirname(PNG_OUT), exist_ok=True)
    img.save(PNG_OUT)


# ---------- geometry ----------
def face(region, w, h):
    u, v, rw, rh = region
    return {"uv": [u, v], "uv_size": [max(1, min(round(w), rw)), max(1, min(round(h), rh))]}


def cube(origin, size, region, side=None, top=None, pivot=None, rotation=None, inflate=0):
    x, y, z = size
    s, t = side or region, top or region
    c = {"origin": [round(v, 3) for v in origin], "size": size, "uv": {
        "north": face(region, x, y), "south": face(region, x, y),
        "east": face(s, z, y), "west": face(s, z, y),
        "up": face(t, x, z), "down": face(t, x, z)}}
    if pivot:
        c["pivot"] = [round(v, 3) for v in pivot]
        c["rotation"] = rotation
    if inflate:
        c["inflate"] = inflate
    return c


AXLE_Y = 10          # wheel radius 10: a wheel a little taller than a block
BED_Y = 13           # the bed floor sits just above the axle
BED_W, BED_L = 18, 30
HALF_W = BED_W / 2
WHEEL_X = HALF_W + 1  # the wheels run just outside the bed


def wheel(side):
    """A spoked wheel: an eight-sided iron-tyred rim, four spokes across, a hub. Turns about its axle (x)."""
    x0 = WHEEL_X if side > 0 else -WHEEL_X - 2
    piv = [x0 + 1, AXLE_Y, 0]
    cubes = []
    seg = 2 * 10 * math.tan(math.pi / 8)  # one side of an octagon round radius 10
    for k in range(8):
        a = k * 45
        cubes.append(cube([x0, AXLE_Y + 8, -seg / 2], [2, 2, round(seg + 0.4, 2)], IRON, side=DARK, top=IRON,
                          pivot=piv, rotation=[a, 0, 0]))
    for k in range(4):
        cubes.append(cube([x0 + 0.5, AXLE_Y - 9, -0.5], [1, 18, 1], DARK, pivot=piv, rotation=[k * 45, 0, 0]))
    cubes.append(cube([x0 - 0.5, AXLE_Y - 2, -2], [3, 4, 4], DARK))  # hub
    return {"name": f"wheel_{'right' if side > 0 else 'left'}", "parent": "cart", "pivot": piv, "cubes": cubes}


def cart_bones():
    z0, z1 = -BED_L / 2, BED_L / 2
    body = [
        cube([-HALF_W, BED_Y, z0], [BED_W, 1, BED_L], PLANK),                        # the bed
        cube([-HALF_W - 1, BED_Y - 2, z0], [2, 2, BED_L], DARK),                     # frame rails
        cube([HALF_W - 1, BED_Y - 2, z0], [2, 2, BED_L], DARK),
        cube([-WHEEL_X - 1, AXLE_Y - 1, -1], [2 * WHEEL_X + 2, 2, 2], DARK),         # the axle
        cube([-HALF_W, BED_Y + 1, z0], [1, 5, BED_L], PLANK),                         # side boards
        cube([HALF_W - 1, BED_Y + 1, z0], [1, 5, BED_L], PLANK),
        cube([-HALF_W + 1, BED_Y + 1, z0], [BED_W - 2, 4, 1], PLANK),                 # front board
        cube([-HALF_W + 1, BED_Y + 1, z1 - 1], [BED_W - 2, 3, 1], PLANK),             # low tailboard
        cube([-HALF_W - 0.5, BED_Y + 1, z0 + 6], [1.0, 6, 1], DARK),                  # stakes
        cube([HALF_W - 0.5, BED_Y + 1, z0 + 6], [1.0, 6, 1], DARK),
        cube([-HALF_W - 0.5, BED_Y + 1, z1 - 7], [1.0, 6, 1], DARK),
        cube([HALF_W - 0.5, BED_Y + 1, z1 - 7], [1.0, 6, 1], DARK),
        cube([-6, BED_Y - 6, z1 - 3], [1, 6, 1], DARK),                               # a prop leg at the back
    ]
    # the shafts run forward and down to the mule's flanks
    shafts = []
    for sx in (-HALF_W + 1, HALF_W - 2):
        shafts.append(cube([sx, BED_Y - 1, z0 - 30], [1.2, 1.2, 32], DARK, pivot=[sx + 0.6, BED_Y - 0.4, z0], rotation=[-9, 0, 0]))
    shafts.append(cube([-HALF_W + 1, BED_Y - 4.6, z0 - 22], [BED_W - 2, 1, 1], DARK))  # the cross bar
    load_y = BED_Y + 1
    load = [
        cube([-HALF_W + 1, load_y, z0 + 1], [BED_W - 2, 1, BED_L - 2], STRAW),          # straw under it all
        cube([-7, load_y + 1, z0 + 2], [8, 7, 6], CHEST, side=CHEST, top=LID),          # the family chest
        cube([-7.2, load_y + 7.6, z0 + 1.8], [8.4, 1.4, 6.4], LID),                      # its lid
        cube([2, load_y + 1, z0 + 2], [6, 6, 6], SACK, pivot=[5, load_y + 1, z0 + 5], rotation=[0, 12, 0]),
        cube([2.4, load_y + 7, z0 + 3], [5, 5, 5], SACK, pivot=[5, load_y + 7, z0 + 5], rotation=[0, -20, 6]),
        cube([1, load_y + 1, z0 + 9], [7, 6, 7], SACK, pivot=[4.5, load_y + 1, z0 + 12.5], rotation=[0, 30, 0]),
        cube([-8, load_y + 1, z0 + 10], [15, 5, 5], MATTRESS, side=MATTRESS, top=MATTRESS),   # rolled mattress
        cube([-8.3, load_y + 2.2, z0 + 11], [15.6, 1, 3], ROPE),                              # tied with rope
        cube([-7.5, load_y + 6, z0 + 9], [13, 1, 9], CLOTH, pivot=[0, load_y + 6, z0 + 13], rotation=[4, 0, -5]),  # blanket thrown over
        cube([-6, load_y + 1, z0 + 17], [5, 7, 5], CAGE),                                 # the empty birdcage
        cube([-4.5, load_y + 8, z0 + 18.5], [2, 1, 2], CAGE),                             # its ring
        cube([1, load_y + 1, z0 + 18], [5, 4, 5], POT),                                   # cooking pot
        cube([0.6, load_y + 5, z0 + 17.6], [5.8, 1, 5.8], POT),
        cube([-7, load_y + 1, z0 + 24], [1, 1, 12], DARK, pivot=[-6.5, load_y + 1, z0 + 24], rotation=[-25, 8, 0]),  # broom handle
        cube([-7.8, load_y + 0.5, z0 + 34], [2.6, 2, 4], STRAW, pivot=[-6.5, load_y + 1, z0 + 24], rotation=[-25, 8, 0]),
    ]
    lantern = [
        cube([HALF_W - 1.5, BED_Y + 1, z1 - 2], [1, 18, 1], DARK),                        # the pole at the tail
        cube([HALF_W - 3.5, BED_Y + 18, z1 - 2], [3, 1, 1], DARK),                        # its arm
        cube([HALF_W - 4.5, BED_Y + 13.5, z1 - 3], [3, 4, 3], LAMP),                      # the lantern, lit
        cube([HALF_W - 3.5, BED_Y + 17.5, z1 - 2], [1, 1, 1], IRON),
    ]
    return [
        {"name": "cart", "pivot": [0, 0, 0], "cubes": body + shafts},
        wheel(-1), wheel(1),
        {"name": "load", "parent": "cart", "pivot": [0, load_y, 0], "cubes": load},
        {"name": "lantern", "parent": "cart", "pivot": [HALF_W - 3, BED_Y + 18, z1 - 1.5], "cubes": lantern},
    ]


def build_geo():
    geo = {"format_version": "1.12.0", "minecraft:geometry": [{
        "description": {"identifier": "geometry.siege_family_cart", "texture_width": 64, "texture_height": 64,
                        "visible_bounds_width": 4, "visible_bounds_height": 3, "visible_bounds_offset": [0, 1, 0]},
        "bones": cart_bones()}]}
    os.makedirs(os.path.dirname(GEO_OUT), exist_ok=True)
    with open(GEO_OUT, "w", newline="\n") as fh:
        json.dump(geo, fh, indent=2)
        fh.write("\n")


if __name__ == "__main__":
    build_png()
    build_geo()
    print("wrote", os.path.relpath(GEO_OUT, ROOT), "and", os.path.relpath(PNG_OUT, ROOT))
