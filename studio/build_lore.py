#!/usr/bin/env python3
"""Lore feature assets: Lore Tome / Ledger / Cipher Wheel / Tide Glass items, the Archive Shelf and
Dusty Tome blocks, their placeholder textures, names, and the NPC dialogue scenes file.

Run from the siege-nights folder:   python3 studio/build_lore.py
Safe to run again: it only rewrites its own files and its own keys in the shared JSON files.
The dialogue scenes are generated from Siege_Nights_BP/scripts/lore/data/dialogue.js, so run this
after editing what a character says. Pass --no-art to leave the PNGs alone (once real art exists)."""
import json, os, subprocess, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BP, RP = os.path.join(ROOT, "Siege_Nights_BP"), os.path.join(ROOT, "Siege_Nights_RP")
ART = "--no-art" not in sys.argv

def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")

def patch_json(path, fn):
    with open(path, encoding="utf8") as f:
        data = json.load(f)
    fn(data)
    write_json(path, data)

def patch_lang(path, entries):
    with open(path, encoding="utf8") as f:
        lines = f.read().split("\n")
    keys = {l.split("=", 1)[0]: i for i, l in enumerate(lines) if "=" in l}
    for k, v in entries.items():
        if k in keys: lines[keys[k]] = f"{k}={v}"
        else:
            if lines and lines[-1] == "": lines.insert(len(lines) - 1, f"{k}={v}")
            else: lines.append(f"{k}={v}")
    with open(path, "w", encoding="utf8") as f:
        f.write("\n".join(lines))

# ---------------------------------------------------------------- items
ITEMS = {
    "lore_tome": ("Lore Tome", "siege_lore_tome", "items"),
    "ledger": ("Ledger of Whispers", "siege_ledger", "items"),
    "cipher_wheel": ("Cipher Wheel", "siege_cipher_wheel", "items"),
    "mirror_glass": ("Tide Glass", "siege_mirror_glass", "items"),
    "kings_journal": ("The Old King's Journal", "siege_kings_journal", "items"),
}
for name, (label, icon, cat) in ITEMS.items():
    write_json(os.path.join(BP, "items", f"{name}.json"), {
        "format_version": "1.21.60",
        "minecraft:item": {
            "description": {"identifier": f"siege:{name}", "menu_category": {"category": cat}},
            "components": {
                "minecraft:icon": icon,
                "minecraft:display_name": {"value": f"item.siege:{name}.name"},
                "minecraft:max_stack_size": 1,
            },
        },
    })

# ---------------------------------------------------------------- blocks
FILL = list(range(7))
ROT = {"north": 0, "west": 90, "south": 180, "east": -90}
shelf_perms = [
    {"condition": f"q.block_state('minecraft:cardinal_direction') == '{d}'",
     "components": {"minecraft:transformation": {"rotation": [0, r, 0]}}} for d, r in ROT.items()
] + [
    {"condition": f"q.block_state('siege:fill') == {n}",
     "components": {"minecraft:material_instances": {
         "*": {"texture": "siege_shelf_side", "render_method": "opaque"},
         "up": {"texture": "siege_shelf_top", "render_method": "opaque"},
         "down": {"texture": "siege_shelf_top", "render_method": "opaque"},
         "north": {"texture": f"siege_shelf_front_{n}", "render_method": "opaque"},
     }}} for n in FILL
]
write_json(os.path.join(BP, "blocks", "archive_shelf.json"), {
    "format_version": "1.21.60",
    "minecraft:block": {
        "description": {
            "identifier": "siege:archive_shelf",
            "menu_category": {"category": "items"},
            "states": {"siege:fill": FILL},
            "traits": {"minecraft:placement_direction": {"enabled_states": ["minecraft:cardinal_direction"], "y_rotation_offset": 180}},
        },
        "components": {
            "minecraft:display_name": "tile.siege:archive_shelf.name",
            "minecraft:geometry": "minecraft:geometry.full_block",
            "minecraft:material_instances": {
                "*": {"texture": "siege_shelf_side", "render_method": "opaque"},
                "up": {"texture": "siege_shelf_top", "render_method": "opaque"},
                "down": {"texture": "siege_shelf_top", "render_method": "opaque"},
                "north": {"texture": "siege_shelf_front_0", "render_method": "opaque"},
            },
            "minecraft:destructible_by_mining": {"seconds_to_destroy": 2},
            "minecraft:destructible_by_explosion": {"explosion_resistance": 3},
            "minecraft:flammable": {"catch_chance_modifier": 5, "destroy_chance_modifier": 20},
            "minecraft:map_color": "#7a5a34",
        },
        "permutations": shelf_perms,
    },
})
write_json(os.path.join(BP, "blocks", "tome_cache.json"), {
    "format_version": "1.21.60",
    "minecraft:block": {
        "description": {
            "identifier": "hc:tome_cache",
            "menu_category": {"category": "items"},
            "traits": {"minecraft:placement_direction": {"enabled_states": ["minecraft:cardinal_direction"]}},
        },
        "components": {
            "minecraft:display_name": "tile.hc:tome_cache.name",
            "minecraft:geometry": "geometry.hc_tome_cache",
            "minecraft:material_instances": {"*": {"texture": "hc_tome_cache", "render_method": "alpha_test"}},
            "minecraft:collision_box": {"origin": [-5, 0, -4], "size": [10, 3, 8]},
            "minecraft:selection_box": {"origin": [-5, 0, -4], "size": [10, 3, 8]},
            "minecraft:light_dampening": 0,
            "minecraft:destructible_by_mining": False,
            "minecraft:destructible_by_explosion": False,
            "minecraft:map_color": "#5a3a22",
        },
        "permutations": [
            {"condition": f"q.block_state('minecraft:cardinal_direction') == '{d}'",
             "components": {"minecraft:transformation": {"rotation": [0, r, 0]}}} for d, r in ROT.items()
        ],
    },
})
write_json(os.path.join(RP, "models", "blocks", "tome_cache.geo.json"), {
    "format_version": "1.12.0",
    "minecraft:geometry": [{
        "description": {"identifier": "geometry.hc_tome_cache", "texture_width": 32, "texture_height": 16},
        "bones": [{"name": "book", "pivot": [0, 0, 0], "rotation": [0, 20, 0], "cubes": [
            {"origin": [-5, 0, -4], "size": [10, 3, 8], "uv": [0, 0]},
        ]}],
    }],
})
write_json(os.path.join(BP, "recipes", "archive_shelf.json"), {
    "format_version": "1.20.10",
    "minecraft:recipe_shaped": {
        "description": {"identifier": "siege:archive_shelf_recipe"},
        "tags": ["siege_workshop"],
        "pattern": ["PPP", "BCB", "PPP"],
        "key": {"P": {"tag": "minecraft:planks"}, "B": {"item": "minecraft:book"}, "C": {"item": "siege:castle_stone"}},
        "result": {"item": "siege:archive_shelf", "count": 2},
        "unlock": {"context": "AlwaysUnlocked"},
    },
})

# ---------------------------------------------------------------- shared files
def terrain(data):
    t = data["texture_data"]
    for name in ["siege_shelf_side", "siege_shelf_top"] + [f"siege_shelf_front_{n}" for n in FILL] + ["hc_tome_cache"]:
        t[name] = {"textures": f"textures/blocks/{name}"}
patch_json(os.path.join(RP, "textures", "terrain_texture.json"), terrain)
def item_tex(data):
    for _, (_, icon, _) in ITEMS.items():
        data["texture_data"][icon] = {"textures": f"textures/items/{icon}"}
patch_json(os.path.join(RP, "textures", "item_texture.json"), item_tex)
def sounds(data):
    data["siege:archive_shelf"] = {"sound": "wood"}
    data["hc:tome_cache"] = {"sound": "wood"}
patch_json(os.path.join(RP, "blocks.json"), sounds)
NAMES = {f"item.siege:{n}.name": label for n, (label, _, _) in ITEMS.items()}
NAMES["tile.siege:archive_shelf.name"] = "Archive Shelf"
NAMES["tile.hc:tome_cache.name"] = "Dusty Tome"
for pack in (BP, RP):
    patch_lang(os.path.join(pack, "texts", "en_US.lang"), NAMES)

# ---------------------------------------------------------------- dialogue scenes
dump = subprocess.run(
    ["node", "--input-type=module", "-e",
     "import('file://' + process.argv[1]).then(m => console.log(JSON.stringify(m.NPCS)))",
     os.path.join(BP, "scripts", "lore", "data", "dialogue.js")],
    capture_output=True, text=True, check=True).stdout
scenes = []
for npc in json.loads(dump):
    for node_id, node in npc["nodes"].items():
        assert len(node["opts"]) <= 6, f"{npc['id']}/{node_id}: more than 6 buttons"
        scenes.append({
            "scene_tag": f"siege_lore_{npc['id']}_{node_id}",
            "npc_name": npc["name"],
            "text": node["text"],
            "buttons": [{"name": opt[0], "commands": [f"/scriptevent siege:lore_say {npc['id']} {node_id} {i}"]}
                        for i, opt in enumerate(node["opts"])],
        })
write_json(os.path.join(BP, "dialogue", "siege_lore.json"),
           {"format_version": "1.17", "minecraft:npc_dialogue": {"scenes": scenes}})
print(f"dialogue: {len(scenes)} scenes")

# ---------------------------------------------------------------- placeholder art
if ART:
    def img(w=16, h=16, fill=(0, 0, 0, 0)): return Image.new("RGBA", (w, h), fill)
    def save(im, *path):
        p = os.path.join(RP, "textures", *path)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        im.save(p)
    WOOD = [(58, 40, 28), (84, 59, 38), (110, 79, 50), (134, 99, 62), (156, 120, 78)]
    def planks(dark=False):
        im = img(fill=WOOD[2] + (255,))
        px = im.load()
        for y in range(16):
            for x in range(16):
                tone = 2 + (1 if (x * 7 + y // 4 * 5) % 11 == 0 else 0) - (1 if y % 4 == 3 else 0)
                if dark: tone -= 1
                px[x, y] = WOOD[max(0, min(4, tone))] + (255,)
        return im
    save(planks(), "blocks", "siege_shelf_side.png")
    save(planks(True), "blocks", "siege_shelf_top.png")
    SPINES = [(142, 44, 40), (52, 84, 128), (64, 110, 62), (120, 86, 150), (176, 132, 48), (60, 120, 124)]
    for n in FILL:
        im = planks()
        px = im.load()
        for row, y0 in enumerate((2, 9)):
            for y in range(y0, y0 + 5):
                for x in range(2, 14): px[x, y] = (34, 24, 20, 255)  # recess
            for slot in range(3):
                if row * 3 + slot >= n: continue
                c = SPINES[row * 3 + slot]
                x0 = 2 + slot * 4
                for y in range(y0 + (slot + row) % 2, y0 + 5):
                    for x in range(x0, x0 + 3):
                        shade = 1.15 if x == x0 else 0.8 if x == x0 + 2 else 1
                        px[x, y] = tuple(min(255, int(v * shade)) for v in c) + (255,)
                px[x0 + 1, y0 + 2] = (222, 190, 96, 255)  # gilt band
        save(im, "blocks", f"siege_shelf_front_{n}.png")
    cache = img(32, 16, (104, 70, 44, 255))
    px = cache.load()
    for y in range(16):
        for x in range(32):
            if y < 3 or (8 <= y < 11): px[x, y] = (226, 214, 180, 255) if x % 2 else (204, 190, 156, 255)  # page edges
            if (x + y * 3) % 13 == 0: px[x, y] = (80, 54, 34, 255)
    save(cache, "blocks", "hc_tome_cache.png")

    def book(cover, trim, extra=None):
        im = img()
        px = im.load()
        for y in range(2, 14):
            for x in range(3, 13):
                px[x, y] = cover + (255,)
        for y in range(2, 14):
            px[3, y] = tuple(int(v * 0.6) for v in cover) + (255,)
            px[12, y] = (226, 214, 180, 255)
        for x in range(4, 12):
            px[x, 13] = (204, 190, 156, 255)
        for x in range(5, 11):
            px[x, 5] = trim + (255,); px[x, 9] = trim + (255,)
        if extra: extra(px)
        return im
    save(book((104, 62, 38), (222, 190, 96)), "items", "siege_lore_tome.png")
    def feather(px):
        for i in range(6): px[9 + i // 2, 1 + i] = (236, 236, 228, 255)
    save(book((46, 78, 62), (190, 200, 190), feather), "items", "siege_ledger.png")
    wheel = img(); px = wheel.load()
    for y in range(16):
        for x in range(16):
            d = ((x - 7.5) ** 2 + (y - 7.5) ** 2) ** 0.5
            if 5 <= d < 7.2: px[x, y] = (198, 156, 62, 255) if (x + y) % 3 else (120, 88, 30, 255)
            elif 2 <= d < 4: px[x, y] = (226, 190, 96, 255) if (x * 2 + y) % 3 else (150, 110, 40, 255)
            elif d < 1.2: px[x, y] = (90, 64, 24, 255)
    save(wheel, "items", "siege_cipher_wheel.png")
    glass = img(); px = glass.load()
    for y in range(2, 14):
        for x in range(4 + abs(7 - y) // 3, 12 - abs(8 - y) // 2):
            px[x, y] = (190, 226, 236, 255) if (x - y) % 4 else (240, 250, 255, 255)
    for y in range(2, 14): px[4 + abs(7 - y) // 3, y] = (96, 140, 160, 255)
    save(glass, "items", "siege_mirror_glass.png")
    print("placeholder art written")
print("lore assets done")

# The Old King's Journal icon: drawn only if it does not exist yet, so real art is never overwritten.
_journal = os.path.join(RP, "textures", "items", "siege_kings_journal.png")
if not os.path.exists(_journal):
    im = Image.new("RGBA", (16, 16), (0, 0, 0, 0)); px = im.load()
    RED, DARK, PAGE, GOLD = (122, 36, 30), (74, 22, 20), (222, 208, 172), (214, 176, 84)
    for y in range(2, 14):
        for x in range(3, 13):
            px[x, y] = (RED if (x * 5 + y * 3) % 7 else (104, 30, 26)) + (255,)
        px[3, y] = DARK + (255,); px[12, y] = PAGE + (255,)
    for x in range(4, 12): px[x, 13] = (198, 184, 150, 255)
    for x, y in [(7, 4), (8, 4), (6, 5), (9, 5), (7, 6), (8, 6), (7, 5), (8, 5)]: px[x, y] = GOLD + (255,)   # the seal
    for x in range(5, 11): px[x, 9] = (150, 74, 60, 255)                                                    # the scraped name
    px[6, 9] = px[9, 9] = (170, 100, 84, 255)
    for y in range(2, 14): px[10, y] = tuple(int(v * 0.8) for v in px[10, y][:3]) + (255,)                  # strap
    im.save(_journal)
    print("journal icon written")
