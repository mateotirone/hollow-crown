"""The Archive Shelf as a real 3D bookcase (Mateo 2026-11-14: "custom 3d library shelves that you can take and place
books on and off", then "2 tall, 1 wide (12 books)"). An open oak case two blocks high, made like a door from two
blocks (siege:half lower / upper). Each half has two boards and six book slots, three on each board; every slot's books
are one bone, shown or hidden by the block states siege:slot_0 .. siege:slot_5 (lore/library.js sets them).

Slots in each half, as the player sees the bookcase from the front: 0 1 2 on the upper board, 3 4 5 on the lower,
left to right. The lower half carries the plinth board and the board between the halves; the upper half carries the
cornice.

Writes:
  Siege_Nights_RP/models/blocks/archive_shelf.geo.json        (geometry.siege_archive_shelf and ..._upper)
  Siege_Nights_RP/textures/blocks/siege_archive_shelf.png   (64 x 32 atlas: wood, back, top, six spines, pages, covers)

Run from the repo root:  python3 studio/art/build_archive_shelf.py
"""
import json
import os
import random

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TEX_SRC = os.path.join(ROOT, "Siege_Nights_RP/textures/blocks")
GEO_OUT = os.path.join(ROOT, "Siege_Nights_RP/models/blocks/archive_shelf.geo.json")
PNG_OUT = os.path.join(TEX_SRC, "siege_archive_shelf.png")

# ---------- texture atlas ----------
# (u, v, w, h) regions
SIDE, TOP, BACK = (0, 0, 16, 16), (16, 0, 16, 16), (32, 0, 16, 16)
EDGE = (48, 0, 16, 16)  # board fronts and top: the darker plank
SPINE = [(i * 8, 16, 8, 16) for i in range(6)]
PAGES, COVER = (48, 16, 8, 16), (56, 16, 8, 16)

# Six cloth bindings: muted, slightly uneasy, never bright
CLOTH = [(116, 34, 38), (46, 76, 54), (42, 52, 92), (150, 106, 44), (84, 46, 88), (40, 88, 92)]
GOLD = (196, 164, 82)


def shade(c, f):
    return tuple(max(0, min(255, int(v * f))) for v in c)


def build_png():
    atlas = Image.new("RGBA", (64, 32), (0, 0, 0, 0))
    side = Image.open(os.path.join(TEX_SRC, "siege_shelf_side.png")).convert("RGBA")
    top = Image.open(os.path.join(TEX_SRC, "siege_shelf_top.png")).convert("RGBA")
    atlas.paste(side, SIDE[:2])
    atlas.paste(top, TOP[:2])
    atlas.paste(top, EDGE[:2])
    # back panel: dark boards with faint seams, so the empty slots read as a deep shelf
    rnd = random.Random(7)
    for y in range(16):
        for x in range(16):
            base = (30, 25, 26) if (x // 4) % 2 == 0 else (26, 22, 24)
            if x % 4 == 0:
                base = (18, 15, 17)
            atlas.putpixel((BACK[0] + x, BACK[1] + y), shade(base, 0.92 + rnd.random() * 0.12) + (255,))
    # spines: cloth with two gold bands and a darker hinge at each edge
    for i, cloth in enumerate(CLOTH):
        u, v = SPINE[i][:2]
        for y in range(16):
            for x in range(8):
                c = cloth
                if x in (0, 7):
                    c = shade(cloth, 0.7)
                if y == 1 or y == 4:
                    c = GOLD if x not in (0, 7) else shade(GOLD, 0.7)
                if y == 2 and x in (3, 4):
                    c = shade(GOLD, 0.85)  # a title stamp between the bands
                c = shade(c, 0.94 + rnd.random() * 0.1)
                atlas.putpixel((u + x, v + y), c + (255,))
    # page edges (top of a book): cream with fine lines
    for y in range(16):
        for x in range(8):
            c = (226, 212, 176) if y % 2 else (206, 192, 156)
            atlas.putpixel((PAGES[0] + x, PAGES[1] + y), c + (255,))
    # cover sides: dark leather
    for y in range(16):
        for x in range(8):
            atlas.putpixel((COVER[0] + x, COVER[1] + y), shade((58, 40, 32), 0.9 + rnd.random() * 0.15) + (255,))
    atlas.save(PNG_OUT)


# ---------- geometry ----------
def face(region, w, h, du=0, dv=0):
    u, v, rw, rh = region
    return {"uv": [u + du, v + dv], "uv_size": [min(w, rw), min(h, rh)]}


def case_cube(origin, size, inner_back=False, board=False):
    x, y, z = size
    f = {
        "north": face(EDGE if board else SIDE, x, y),
        "south": face(SIDE, x, y),
        "east": face(SIDE, z, y),
        "west": face(SIDE, z, y),
        "up": face(EDGE if board else TOP, x, z),
        "down": face(EDGE if board else TOP, x, z),
    }
    if inner_back:
        f["north"] = face(BACK, x, y)
    return {"origin": origin, "size": size, "uv": f}


def book_cube(i, origin, size, lean=0):
    x, y, z = size
    cube = {
        "origin": origin,
        "size": size,
        "uv": {
            "north": face(SPINE[i], x, y, du=1 if x < 6 else 0),
            "south": face(COVER, x, y),
            "east": face(COVER, z, y),
            "west": face(COVER, z, y),
            "up": face(PAGES, x, z),
            "down": face(COVER, x, z),
        },
    }
    if lean:
        cube["pivot"] = [origin[0] + (0 if lean > 0 else size[0]), origin[1], origin[2] + size[2] / 2]
        cube["rotation"] = [0, 0, lean]
    return cube


# Bedrock block geometry: -z is the front (north, the face the block's front texture used to sit on). Geometry x is
# mirrored against the world's, so for a player facing the front, their left-to-right runs from -x to +x in geometry.
# (If a playtest shows the books mirrored, flip SLOT_MIRROR in lore/library.js, not this file.)
# The books, in slot order: (row y, distance of the player's-right edge from the middle, width, height, depth, lean)
TOP_Y, BOTTOM_Y = 8, 1
# Each slot holds one tome, drawn as a run of three volumes so a full shelf looks like a real one:
# (row y, the slot's player's-left edge in geometry x, base height, lean of the last volume)
SLOTS = [
    (TOP_Y, -6.6, 6.0, 0), (TOP_Y, -2.2, 5.4, -7), (TOP_Y, 2.2, 6.2, 0),
    (BOTTOM_Y, -6.6, 5.4, 0), (BOTTOM_Y, -2.2, 5.0, 0), (BOTTOM_Y, 2.2, 5.6, 6),
]
VOLUMES = [(1.4, 0.0), (1.2, -0.8), (1.5, -0.3)]  # (width, height offset) left to right
DEPTH = 5.5


def slot_cubes(i, upper=False):
    y, left, base, lean = SLOTS[i]
    if upper and y == BOTTOM_Y:
        y = 0  # the upper half's lower books stand on the lower half's top board
    cubes, x = [], left
    for k, (w, dh) in enumerate(VOLUMES):
        h = round(base + dh, 2)
        colour = (i * 3 + k * 2 + (1 if upper else 0)) % len(CLOTH)
        cubes.append(book_cube(colour, [round(x, 2), y, -7.0], [w, h, DEPTH], lean if k == 2 else 0))
        x += w + 0.05
    return cubes


def half_geo(upper):
    case = [
        case_cube([-8, 0, 7], [16, 16, 1], inner_back=True),  # back
        case_cube([-8, 0, -8], [1, 16, 15]),  # side
        case_cube([7, 0, -8], [1, 16, 15]),  # side
        case_cube([-7, 15, -8], [14, 1, 15], board=True),  # top board (the lower half's is the board between halves)
        case_cube([-7, 7, -8], [14, 1, 15], board=True),  # middle board
    ]
    if upper:
        case.append(case_cube([-8.5, 16, -8.5], [17, 1, 16.5], board=True))  # cornice, a half pixel proud all round
        case.append(case_cube([-5, 17, -8.2], [10, 1, 1], board=True))  # a low crest along the front
    else:
        case.append(case_cube([-7, 0, -8], [14, 1, 15], board=True))  # plinth board
    bones = [{"name": "case", "pivot": [0, 0, 0], "cubes": case}]
    for i in range(6):
        bones.append({"name": f"book_{i}", "parent": "case", "pivot": [0, 0, 0], "cubes": slot_cubes(i, upper)})
    return {
        "description": {
            "identifier": "geometry.siege_archive_shelf" + ("_upper" if upper else ""),
            "texture_width": 64,
            "texture_height": 32,
            "visible_bounds_width": 2,
            "visible_bounds_height": 2,
            "visible_bounds_offset": [0, 0.5, 0],
        },
        "bones": bones,
    }


def build_geo():
    geo = {"format_version": "1.12.0", "minecraft:geometry": [half_geo(False), half_geo(True)]}
    with open(GEO_OUT, "w", newline="\n") as fh:
        json.dump(geo, fh, indent=2)
        fh.write("\n")


if __name__ == "__main__":
    build_png()
    build_geo()
    print("wrote", os.path.relpath(GEO_OUT, ROOT), "and", os.path.relpath(PNG_OUT, ROOT))
