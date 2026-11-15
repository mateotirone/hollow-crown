"""The Tree of Oaths as its own object (Mateo 2026-11-14: "Can the tree be bigger than one block" ... "the table it's
on sucks, let's make the entire thing its own object").

An old, gnarled tree that stands on its own roots on the hall floor: no plinth, no table. Roots spread over a 3 x 3,
the trunk twists up about two and a half blocks, three limbs carry a glowing crown, and pale oath-ribbons with brass
tags hang from the lower limbs (everyone who swore here tied one on). About four and a half blocks tall.

Three looks share one layout: the plain tree, a Knight's hall (red-and-gold banner ribbons, a brighter crown) and a
Marked hall (dark bark split by ember cracks, a dusk-violet crown, black ribbons).

Entity geometry, 16 units to a block, origin on the floor under the middle of the trunk. Bones: roots, trunk, limb_*
(parent trunk), crown (parent trunk, sways), ribbons (parent trunk, sway).

Writes:
  Siege_Nights_RP/models/entity/oath_tree.geo.json            (geometry.siege_oath_tree)
  Siege_Nights_RP/textures/entity/siege/oath_tree.png         (64 x 64; and _knight, _marked)

Run from the repo root:  python3 studio/art/build_oath_tree.py
"""
import json
import math
import os
import random

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
GEO_OUT = os.path.join(ROOT, "Siege_Nights_RP/models/entity/oath_tree.geo.json")
PNG_OUT = os.path.join(ROOT, "Siege_Nights_RP/textures/entity/siege/oath_tree{}.png")

# ---------- texture atlas (u, v, w, h) ----------
BARK = (0, 0, 16, 16)       # deep vertical furrows
RINGS = (16, 0, 16, 16)     # the cut ends: rings
ROOT_ = (32, 0, 16, 16)     # roots: bark with moss in the cracks
RIBBON = (48, 0, 8, 16)     # cloth strips
TAG = (56, 0, 8, 8)         # brass tags
KNOT = (56, 8, 8, 8)        # a burl
LEAF = (0, 16, 16, 16)      # the crown, outer
LEAF2 = (16, 16, 16, 16)    # the crown, deeper
GLOW = (32, 16, 16, 16)     # light caught in the leaves
MOSS = (48, 16, 16, 16)

LOOKS = {
    "": {"bark": (96, 66, 42), "crack": (52, 34, 22), "leaf": (112, 150, 64), "leaf2": (78, 116, 46), "glow": (246, 226, 150),
         "ribbon": [(232, 226, 210), (214, 204, 182)], "moss": (88, 112, 52)},
    "_knight": {"bark": (96, 66, 42), "crack": (52, 34, 22), "leaf": (128, 162, 70), "leaf2": (90, 128, 52), "glow": (255, 214, 110),
                "ribbon": [(176, 38, 34), (222, 178, 60)], "moss": (88, 112, 52)},
    "_marked": {"bark": (60, 44, 70), "crack": (255, 128, 40), "leaf": (82, 62, 112), "leaf2": (56, 40, 82), "glow": (255, 150, 70),
                "ribbon": [(34, 30, 38), (120, 40, 30)], "moss": (70, 52, 88)},
}


def shade(c, f):
    return tuple(max(0, min(255, int(v * f))) for v in c)


def fill(img, region, fn):
    u0, v0, w, h = region
    for y in range(h):
        for x in range(w):
            c = fn(x, y)
            img.putpixel((u0 + x, v0 + y), c if len(c) == 4 else c + (255,))


def build_png(suffix, look):
    rnd = random.Random(7)
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    bark, crack = look["bark"], look["crack"]
    marked = suffix == "_marked"
    furrow = [rnd.randrange(16) for _ in range(5)]

    def bark_px(x, y):
        c = shade(bark, 0.88 + rnd.random() * 0.2)
        for f in furrow:
            if abs(x - (f + (y // 5) % 2)) == 0:
                c = crack if marked and (y + f) % 7 < 3 else shade(bark, 0.55)
        return c
    fill(img, BARK, bark_px)

    def rings(x, y):
        r = math.hypot(x - 7.5, y - 7.5)
        if r > 7.6:
            return shade(bark, 0.7)
        return shade(bark, 1.25 if int(r) % 2 else 1.08) if not marked or int(r) % 3 else crack
    fill(img, RINGS, rings)

    def root(x, y):
        c = bark_px(x, y)
        if rnd.random() < 0.04 + 0.012 * y:
            c = shade(look["moss"], 0.85 + rnd.random() * 0.25)
        return c
    fill(img, ROOT_, root)
    a, b = look["ribbon"]
    fill(img, RIBBON, lambda x, y: shade(a if (x < 4) != (y % 8 < 1) else b, 0.92 + rnd.random() * 0.1) if y < 15 or x % 2 else (0, 0, 0, 0))
    fill(img, TAG, lambda x, y: shade((214, 168, 72) if 0 < x < 7 and 0 < y < 7 else (140, 100, 40), 0.9 + rnd.random() * 0.15))
    fill(img, KNOT, lambda x, y: shade(bark, 0.6 + 0.5 * abs(math.sin(math.hypot(x - 3.5, y - 3.5)))))

    def leaf(base, holes):
        def px(x, y):
            if rnd.random() < holes:
                return shade(base, 0.55)
            c = shade(base, 0.8 + rnd.random() * 0.35)
            if rnd.random() < 0.06:
                c = look["glow"]
            return c
        return px
    fill(img, LEAF, leaf(look["leaf"], 0.08))
    fill(img, LEAF2, leaf(look["leaf2"], 0.14))
    fill(img, GLOW, lambda x, y: shade(look["glow"], 0.85 + 0.15 * math.cos(math.hypot(x - 7.5, y - 7.5) / 2)))
    fill(img, MOSS, lambda x, y: shade(look["moss"], 0.8 + rnd.random() * 0.3))
    os.makedirs(os.path.dirname(PNG_OUT), exist_ok=True)
    img.save(PNG_OUT.format(suffix))


# ---------- geometry ----------
def face(region, w, h):
    u, v, rw, rh = region
    return {"uv": [u, v], "uv_size": [max(1, min(round(w), rw)), max(1, min(round(h), rh))]}


def cube(origin, size, region, side=None, top=None, pivot=None, rotation=None, inflate=0):
    x, y, z = size
    s, t = side or region, top or region
    c = {"origin": [round(v, 3) for v in origin], "size": [round(v, 3) for v in size], "uv": {
        "north": face(region, x, y), "south": face(region, x, y),
        "east": face(s, z, y), "west": face(s, z, y),
        "up": face(t, x, z), "down": face(t, x, z)}}
    if pivot:
        c["pivot"] = [round(v, 3) for v in pivot]
        c["rotation"] = [round(v, 2) for v in rotation]
    if inflate:
        c["inflate"] = inflate
    return c


def box_at(cx, y, cz, w, h, d, region, **kw):
    return cube([cx - w / 2, y, cz - d / 2], [w, h, d], region, **kw)


rnd = random.Random(23)

# the trunk: stacked, each a little narrower and a little off-centre, so it twists as it climbs
TRUNK = [(0, 0, 15, 4), (0.4, 0.2, 13, 6), (1.0, 0.6, 11, 8), (1.6, 1.4, 10, 8), (1.2, 2.2, 9, 8), (0.2, 2.6, 9, 7), (-0.6, 2.0, 8, 6)]  # (dx, dz, width, height)


def trunk_bone():
    cubes, y = [], 0
    for dx, dz, w, h in TRUNK:
        cubes.append(box_at(dx, y, dz, w, h, w, BARK, top=RINGS))
        y += h
    # ridges: buttresses running up the lower trunk, and two burls
    for ang, length in ((20, 16), (110, 12), (200, 18), (290, 13)):
        a = math.radians(ang)
        r = 6.2
        cubes.append(box_at(math.cos(a) * r, 0, math.sin(a) * r, 3, length, 3, BARK, top=RINGS, pivot=[math.cos(a) * r, 0, math.sin(a) * r], rotation=[0, -ang, 0]))
    cubes.append(box_at(5.4, 14, 1.5, 3, 4, 4, KNOT))
    cubes.append(box_at(-2.5, 24, -5.2, 4, 3, 3, KNOT))
    return {"name": "trunk", "pivot": [0, 0, 0], "cubes": cubes}, y


def roots_bone():
    """Six roots spread from the foot of the trunk over a 3 x 3, sinking into the floor as they go."""
    cubes = []
    for i, ang in enumerate((15, 75, 130, 195, 250, 315)):
        reach = 23 if i % 2 == 0 else 20
        a = math.radians(ang)
        steps = [(6, 9, 7), (10, 6.5, 6), (14, 4.5, 5), (18, 3, 4), (reach, 1.6, 3)]
        prev = 5
        for r, h, w in steps:
            mid = (prev + r) / 2
            length = r - prev + 1.5
            x, z = math.cos(a) * mid, math.sin(a) * mid
            cubes.append(cube([x - length / 2, 0, z - w / 2], [length, h, w], ROOT_, top=ROOT_, pivot=[x, 0, z], rotation=[0, -ang, 0]))
            prev = r
        # a moss tuft in the crook
        x, z = math.cos(a) * 7, math.sin(a) * 7
        cubes.append(box_at(x, 0, z, 4, 1, 4, MOSS))
        # a knuckle where the root bends into the floor
        x, z = math.cos(a) * 12, math.sin(a) * 12
        cubes.append(box_at(x, 0, z, 4, 5.5, 4, ROOT_, pivot=[x, 0, z], rotation=[0, -ang, 0]))
    return {"name": "roots", "pivot": [0, 0, 0], "cubes": cubes}


def limb(name, base, ang, tilt, length, width):
    """A limb from the trunk at height base, leaning out toward compass angle ang by tilt degrees."""
    a = math.radians(ang)
    bx, bz = math.cos(a) * 2.5, math.sin(a) * 2.5
    piv = [bx, base, bz]
    # lean out: rotate about the axis across the limb's direction
    rot = [math.sin(a) * tilt, 0, -math.cos(a) * tilt]
    upper = width - 2
    cubes = [cube([bx - width / 2, base, bz - width / 2], [width, length, width], BARK, top=RINGS, pivot=piv, rotation=rot)]
    # the end of the limb, where the crown sits
    tip_r = math.sin(math.radians(tilt)) * length
    tx, tz = bx + math.cos(a) * tip_r, bz + math.sin(a) * tip_r
    ty = base + math.cos(math.radians(tilt)) * length
    cubes.append(cube([tx - upper / 2, ty - 2, tz - upper / 2], [upper, 8, upper], BARK, top=RINGS,
                      pivot=[tx, ty - 2, tz], rotation=[math.sin(a) * tilt * 0.4, 0, -math.cos(a) * tilt * 0.4]))
    return {"name": name, "parent": "trunk", "pivot": piv, "cubes": cubes}, (tx, ty + 4, tz)


def crown_bone(tips, top):
    cubes = []
    # the heart of the crown over the trunk, and a cap
    cubes.append(box_at(0.4, top + 9, 1, 22, 10, 22, LEAF2))
    cubes.append(box_at(2, top + 16, -1.5, 18, 8, 16, LEAF))
    cubes.append(box_at(-3, top + 17, 3, 14, 8, 14, LEAF))
    cubes.append(box_at(0, top + 23, 0.5, 10, 5, 10, LEAF))
    # a cluster over each limb end, hanging a little below it
    for i, (x, y, z) in enumerate(tips):
        w = 14 if i % 2 == 0 else 12
        cubes.append(box_at(x, y - 1, z, w, 9, w, LEAF))
        cubes.append(box_at(x * 1.08, y + 5, z * 1.08, w - 5, 5, w - 4, LEAF))      # a lump on top, off-centre
        cubes.append(box_at(x * 0.85, y - 3, z * 0.85, w - 4, 2, w - 4, LEAF2))     # the underside, darker
        # leaves hanging down off the outer edge
        for k in range(3):
            ang = math.atan2(z, x) + (k - 1) * 0.45
            r = math.hypot(x, z) + w / 2 - 1
            hx, hz = math.cos(ang) * r, math.sin(ang) * r
            cubes.append(box_at(hx, y - 4 - k, hz, 3, 4 + k, 3, LEAF2))
    # light caught in the leaves: small bright motes standing out of the surface
    for _ in range(22):
        ang = rnd.random() * math.tau
        r = 8 + rnd.random() * 11
        y = top + 6 + rnd.random() * 18
        cubes.append(box_at(math.cos(ang) * r, y, math.sin(ang) * r, 1, 1, 1, GLOW, inflate=0.15))
    return {"name": "crown", "parent": "trunk", "pivot": [0, top, 0], "cubes": cubes}


def ribbons_bone(tips, top):
    """Oath-ribbons tied to the lower limbs, each with a brass tag at the end."""
    cubes = []
    for i, (x, y, z) in enumerate(tips):
        for k in range(4):
            f = 0.4 + 0.15 * k
            rx, rz = x * f + (k - 1) * 1.5, z * f + (1 - k) * 1.2
            ry = top - 2 + (y - top) * f * 0.4
            length = 9 + (i * 3 + k * 5) % 7
            yaw = math.degrees(math.atan2(z, x)) + 90
            cubes.append(cube([rx - 1.5, ry - length, rz], [3, length, 0], RIBBON, pivot=[rx, ry, rz], rotation=[0, -yaw, 0]))
            cubes.append(box_at(rx, ry - length - 1.5, rz, 1.5, 1.5, 0.5, TAG, pivot=[rx, ry, rz], rotation=[0, -yaw, 0]))
    return {"name": "ribbons", "parent": "trunk", "pivot": [0, top, 0], "cubes": cubes}


def build_geo():
    trunk, top = trunk_bone()
    bones = [roots_bone(), trunk]
    tips = []
    for name, base, ang, tilt, length, width in (("limb_a", top - 10, 30, 48, 24, 6), ("limb_b", top - 6, 150, 44, 23, 6),
                                                  ("limb_c", top - 12, 260, 50, 22, 5), ("limb_d", top - 3, 330, 30, 18, 5)):
        b, tip = limb(name, base, ang, tilt, length, width)
        bones.append(b)
        tips.append(tip)
    bones.append(crown_bone(tips, top))
    bones.append(ribbons_bone(tips[:3], top))
    geo = {"format_version": "1.12.0", "minecraft:geometry": [{
        "description": {"identifier": "geometry.siege_oath_tree", "texture_width": 64, "texture_height": 64,
                        "visible_bounds_width": 4, "visible_bounds_height": 6, "visible_bounds_offset": [0, 2.5, 0]},
        "bones": bones}]}
    os.makedirs(os.path.dirname(GEO_OUT), exist_ok=True)
    with open(GEO_OUT, "w") as fh:
        json.dump(geo, fh, indent=1)
    hi = max(c["origin"][1] + c["size"][1] for b in bones for c in b["cubes"])
    wide = max(max(abs(c["origin"][0]), abs(c["origin"][0] + c["size"][0]), abs(c["origin"][2]), abs(c["origin"][2] + c["size"][2])) for b in bones for c in b["cubes"])
    return hi, wide


if __name__ == "__main__":
    for suffix, look in LOOKS.items():
        build_png(suffix, look)
    hi, wide = build_geo()
    print(f"oath tree: {hi / 16:.1f} blocks tall, reaches {wide / 16:.2f} blocks from the trunk")
