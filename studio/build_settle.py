#!/usr/bin/env python3
"""Settlement building assets: Mason's Bench, Foundation Stone and Plot Marker (blocks, recipes, names, placeholder textures).
Run from the siege-nights folder:  python3 studio/build_settle.py
Safe to run again. Shared files (terrain_texture.json, blocks.json, en_US.lang) are merged, not replaced,
and a PNG that already exists is never overwritten (the textures thread paints over the placeholders)."""
import json, os, random
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BP, RP = os.path.join(ROOT, "Siege_Nights_BP"), os.path.join(ROOT, "Siege_Nights_RP")

def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf8") as f:
        json.dump(data, f, indent=2)
        f.write("\n")

def merge_json(path, edit):
    with open(path, encoding="utf8") as f:
        data = json.load(f)
    edit(data)
    write_json(path, data)

def tex(name, paint):
    full = os.path.join(RP, "textures", "blocks", name + ".png")
    if os.path.exists(full):
        return
    im = Image.new("RGBA", (16, 16), (0, 0, 0, 255))
    px, rnd = im.load(), random.Random(name)
    paint(px, rnd)
    im.save(full)

def noise(px, rnd, base, spread=9):
    for x in range(16):
        for y in range(16):
            d = rnd.randint(-spread, spread)
            px[x, y] = tuple(max(0, min(255, c + d)) for c in base) + (255,)

def rect(px, x0, y0, x1, y1, c):
    for x in range(x0, x1 + 1):
        for y in range(y0, y1 + 1):
            px[x, y] = c + (255,)

STONE, DARK, WOOD, WOODD, PALE, IRON, GREEN = (128, 126, 120), (74, 72, 70), (122, 90, 56), (84, 60, 38), (196, 192, 180), (170, 174, 180), (86, 150, 84)

def bench_side(px, rnd):
    noise(px, rnd, WOOD)
    rect(px, 0, 0, 15, 2, WOODD)                      # thick top
    rect(px, 1, 3, 3, 15, WOODD); rect(px, 12, 3, 14, 15, WOODD)  # legs
    rect(px, 5, 9, 10, 15, STONE); rect(px, 5, 9, 10, 9, PALE)    # a dressed block under the bench
    rect(px, 7, 4, 8, 7, IRON)                         # hanging chisel

def bench_top(px, rnd):
    noise(px, rnd, WOOD)
    for y in (4, 9, 13): rect(px, 0, y, 15, y, WOODD)
    rect(px, 2, 5, 7, 8, PALE); rect(px, 2, 5, 7, 5, STONE)       # stone being cut
    rect(px, 10, 2, 11, 7, IRON); rect(px, 9, 8, 12, 9, WOODD)    # mallet
    rect(px, 4, 11, 12, 11, IRON)                      # square

def stone_side(px, rnd):
    noise(px, rnd, STONE)
    for x in (0, 15): rect(px, x, 0, x, 15, DARK)
    rect(px, 0, 0, 15, 0, DARK); rect(px, 0, 15, 15, 15, DARK)
    rect(px, 3, 11, 12, 12, GREEN)                     # a marked-out line
    for x in (3, 12): rect(px, x, 6, x, 12, GREEN)
    for i in range(5): rect(px, 7 - i if i < 4 else 4, 2 + i, 8 + i if i < 4 else 11, 2 + i, PALE)  # roof chalked on

def stone_top(px, rnd):
    noise(px, rnd, STONE)
    for x in (0, 15): rect(px, x, 0, x, 15, DARK)
    rect(px, 0, 0, 15, 0, DARK); rect(px, 0, 15, 15, 15, DARK)
    rect(px, 3, 3, 12, 3, GREEN); rect(px, 3, 12, 12, 12, GREEN); rect(px, 3, 3, 3, 12, GREEN); rect(px, 12, 3, 12, 12, GREEN)
    rect(px, 7, 7, 8, 8, PALE)

BLOCKS = {
    "mason_bench": ("Mason's Bench", "wood", "#7a5a38", 2, bench_side, bench_top),
    "foundation_stone": ("Foundation Stone", "stone", "#807e78", 1.5, stone_side, stone_top),
}

for name, (title, sound, color, seconds, side, top) in BLOCKS.items():
    tex(f"siege_{name}_side", side)
    tex(f"siege_{name}_top", top)
    write_json(os.path.join(BP, "blocks", "settle", f"{name}.json"), {
        "format_version": "1.21.60",
        "minecraft:block": {
            "description": {"identifier": f"siege:{name}", "menu_category": {"category": "items"}},
            "components": {
                "minecraft:display_name": f"tile.siege:{name}.name",
                "minecraft:geometry": "minecraft:geometry.full_block",
                "minecraft:material_instances": {
                    "*": {"texture": f"siege_{name}_side", "render_method": "opaque"},
                    "up": {"texture": f"siege_{name}_top", "render_method": "opaque"},
                    "down": {"texture": f"siege_{name}_top", "render_method": "opaque"},
                },
                "minecraft:destructible_by_mining": {"seconds_to_destroy": seconds},
                "minecraft:destructible_by_explosion": False,
                "minecraft:map_color": color,
            },
        },
    })

def recipe(name, pattern, key):
    write_json(os.path.join(BP, "recipes", "settle", f"{name}.json"), {
        "format_version": "1.20.10",
        "minecraft:recipe_shaped": {
            "description": {"identifier": f"siege:{name}_recipe"},
            "tags": ["siege_workshop"],
            "pattern": pattern, "key": key,
            "result": {"item": f"siege:{name}", "count": 1},
            "unlock": {"context": "AlwaysUnlocked"},
        },
    })

recipe("mason_bench", ["PPP", "LEL", "SSS"], {"P": {"tag": "minecraft:planks"}, "L": {"tag": "minecraft:logs"}, "E": {"item": "minecraft:emerald"}, "S": {"item": "minecraft:cobblestone"}})
recipe("foundation_stone", ["SPS", "PSP", "SPS"], {"S": {"item": "minecraft:cobblestone"}, "P": {"tag": "minecraft:planks"}})

def terrain(data):
    for name in BLOCKS:
        for part in ("side", "top"):
            data["texture_data"][f"siege_{name}_{part}"] = {"textures": f"textures/blocks/siege_{name}_{part}"}
merge_json(os.path.join(RP, "textures", "terrain_texture.json"), terrain)

def sounds(data):
    for name, spec in BLOCKS.items():
        data[f"siege:{name}"] = {"sound": spec[1]}
merge_json(os.path.join(RP, "blocks.json"), sounds)

lang = os.path.join(RP, "texts", "en_US.lang")
text = open(lang, encoding="utf8").read()
for name, spec in BLOCKS.items():
    line = f"tile.siege:{name}.name={spec[0]}"
    if line not in text:
        text = text.rstrip("\n") + "\n" + line + "\n"
open(lang, "w", encoding="utf8").write(text)

# ---------- the Plot Marker: a post with a sign at the front of every town slot ----------
# Texture 32x32: stone foot (0,0)-(15,15), timber post (16,0)-(23,15), sign board (0,16)-(31,31)

def marker_tex():
    full = os.path.join(RP, "textures", "blocks", "siege_plot_marker.png")
    if os.path.exists(full):
        return
    im = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    px, rnd = im.load(), random.Random("plot_marker")
    for x in range(16):
        for y in range(16):
            d = rnd.randint(-10, 10); px[x, y] = (STONE[0] + d, STONE[1] + d, STONE[2] + d, 255)
    for x in range(16, 24):
        for y in range(16):
            d = rnd.randint(-8, 8); c = WOODD if x in (16, 23) else WOOD; px[x, y] = (c[0] + d, c[1] + d, c[2] + d, 255)
    for x in range(32):
        for y in range(16, 32):
            d = rnd.randint(-7, 7); c = WOODD if y in (16, 31) or x in (0, 31) or (y - 16) % 5 == 0 else WOOD
            px[x, y] = (c[0] + d, c[1] + d, c[2] + d, 255)
    for x in range(8, 24):            # a chalked plot outline with a little roof: "build here"
        px[x, 28] = PALE + (255,); px[x, 21] = PALE + (255,)
    for y in range(21, 29):
        px[8, y] = PALE + (255,); px[23, y] = PALE + (255,)
    for i in range(6):
        px[15 - i, 19 - i // 2] = GREEN + (255,); px[16 + i, 19 - i // 2] = GREEN + (255,)
    im.save(full)

def box(origin, size, u, v, w, h):
    faces = {f: {"uv": [u, v], "uv_size": [w, h]} for f in ("north", "south", "east", "west", "up", "down")}
    return {"origin": origin, "size": size, "uv": faces}

marker_tex()
write_json(os.path.join(RP, "models", "blocks", "plot_marker.geo.json"), {
    "format_version": "1.12.0",
    "minecraft:geometry": [{
        "description": {"identifier": "geometry.siege_plot_marker", "texture_width": 32, "texture_height": 32,
                        "visible_bounds_width": 2, "visible_bounds_height": 2, "visible_bounds_offset": [0, 0.5, 0]},
        "bones": [{"name": "block", "pivot": [0, 0, 0], "cubes": [
            box([-4, 0, -4], [8, 3, 8], 0, 0, 16, 16),       # stone foot
            box([-1, 3, -1], [2, 13, 2], 16, 0, 8, 16),      # post
            box([-6, 8, -1.5], [12, 7, 1], 0, 16, 32, 16),   # sign board across the post
        ]}],
    }],
})
write_json(os.path.join(BP, "blocks", "settle", "plot_marker.json"), {
    "format_version": "1.21.60",
    "minecraft:block": {
        "description": {"identifier": "siege:plot_marker", "menu_category": {"category": "none"},
                        "traits": {"minecraft:placement_direction": {"enabled_states": ["minecraft:cardinal_direction"]}}},
        "components": {
            "minecraft:display_name": "tile.siege:plot_marker.name",
            "minecraft:geometry": "geometry.siege_plot_marker",
            "minecraft:material_instances": {"*": {"texture": "siege_plot_marker", "render_method": "alpha_test"}},
            "minecraft:collision_box": {"origin": [-4, 0, -4], "size": [8, 16, 8]},
            "minecraft:selection_box": {"origin": [-6, 0, -4], "size": [12, 16, 8]},
            "minecraft:destructible_by_mining": False,
            "minecraft:destructible_by_explosion": False,
            "minecraft:light_dampening": 0,
            "minecraft:map_color": "#7a5a38",
        },
        # the board turns to face the street (settle/founding.js setMarkerBlock)
        "permutations": [
            {"condition": f"q.block_state('minecraft:cardinal_direction') == '{d}'",
             "components": {"minecraft:transformation": {"rotation": [0, r, 0]}}}
            for d, r in (("north", 0), ("west", 90), ("south", 180), ("east", 270))
        ],
    },
})
def marker_terrain(data):
    data["texture_data"]["siege_plot_marker"] = {"textures": "textures/blocks/siege_plot_marker"}
merge_json(os.path.join(RP, "textures", "terrain_texture.json"), marker_terrain)
def marker_sound(data):
    data["siege:plot_marker"] = {"sound": "wood"}
merge_json(os.path.join(RP, "blocks.json"), marker_sound)
text = open(lang, encoding="utf8").read()
if "tile.siege:plot_marker.name=" not in text:
    open(lang, "w", encoding="utf8").write(text.rstrip("\n") + "\ntile.siege:plot_marker.name=Plot Marker\n")

print("Settlement building assets written.")
