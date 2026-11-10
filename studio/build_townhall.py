#!/usr/bin/env python3
"""Town hall + Tree of Oaths assets: blocks, items, recipes, model, placeholder textures.
Run from the siege-nights folder:  python3 studio/build_townhall.py
Safe to run again. Shared files (texture lists, blocks.json, en_US.lang) are merged, not replaced.
Pass --keep-art to leave existing PNGs alone (use that once real art has replaced the placeholders)."""
import json, os, random, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BP, RP = os.path.join(ROOT, "Siege_Nights_BP"), os.path.join(ROOT, "Siege_Nights_RP")
KEEP_ART = "--keep-art" in sys.argv

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

# ---------------- textures ----------------
def tex(path, paint):
    full = os.path.join(RP, "textures", path + ".png")
    if KEEP_ART and os.path.exists(full):
        return
    os.makedirs(os.path.dirname(full), exist_ok=True)
    im = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    paint(im.load(), random.Random(path))
    im.save(full)

def noise(px, rnd, base, spread=10, box=(0, 0, 16, 16)):
    for x in range(box[0], box[2]):
        for y in range(box[1], box[3]):
            d = rnd.randint(-spread, spread)
            px[x, y] = tuple(max(0, min(255, c + d)) for c in base) + (255,)

def rect(px, x0, y0, x1, y1, color):
    for x in range(x0, x1 + 1):
        for y in range(y0, y1 + 1):
            px[x, y] = color + (255,) if len(color) == 3 else color

STONE, DARK, GOLD, BARK, LEAF = (126, 124, 118), (78, 76, 74), (214, 170, 62), (92, 66, 40), (66, 110, 52)
EMBERC, PALE, ROOT_ = (190, 150, 255), (236, 226, 255), (58, 50, 62)

def cornerstone_side(px, rnd):
    noise(px, rnd, STONE)
    rect(px, 0, 0, 15, 0, DARK); rect(px, 0, 15, 15, 15, DARK); rect(px, 0, 0, 0, 15, DARK); rect(px, 15, 0, 15, 15, DARK)
    # a little carved hall: roof and door
    for i in range(5):
        rect(px, 7 - i, 3 + i, 8 + i, 3 + i, GOLD)
    rect(px, 4, 8, 11, 12, DARK); rect(px, 7, 10, 8, 12, GOLD)

def cornerstone_top(px, rnd):
    noise(px, rnd, STONE)
    rect(px, 0, 0, 15, 0, DARK); rect(px, 0, 15, 15, 15, DARK); rect(px, 0, 0, 0, 15, DARK); rect(px, 15, 0, 15, 15, DARK)
    rect(px, 7, 3, 8, 12, GOLD); rect(px, 3, 7, 12, 8, GOLD)

def bark(px, rnd, base=BARK, vein=None):
    noise(px, rnd, base, 8)
    for x in (2, 6, 9, 13):
        for y in range(16):
            if rnd.random() < 0.7:
                px[x, y] = tuple(max(0, c - 22) for c in base) + (255,)
    if vein:
        x = 7
        for y in range(16):
            px[x, y] = vein + (255,)
            x = max(1, min(14, x + rnd.choice((-1, 0, 0, 1))))

def plinth(px, rnd):
    noise(px, rnd, STONE, 8)
    for y in (0, 8):
        rect(px, 0, y, 15, y, DARK)
    for x, y in ((4, 1), (11, 1), (0, 9), (8, 9)):
        rect(px, x, y, x, y + 6, DARK)
    rect(px, 6, 3, 9, 5, GOLD)

def crown_plain(px, rnd):
    noise(px, rnd, LEAF, 16)

def crown_knight(px, rnd):
    noise(px, rnd, LEAF, 14)
    for x0, col in ((1, (170, 40, 40)), (6, (40, 70, 160)), (11, (214, 170, 62))):
        rect(px, x0, 4, x0 + 3, 12, col)
        rect(px, x0 + 1, 13, x0 + 2, 13, col)
        rect(px, x0, 4, x0 + 3, 4, (240, 240, 240))

def crown_marked(px, rnd):
    noise(px, rnd, ROOT_, 8)
    for _ in range(5):
        x, y = rnd.randint(1, 14), 0
        while y < 16:
            px[x, y] = EMBERC + (255,)
            x = max(0, min(15, x + rnd.choice((-1, 0, 1)))); y += 1
    for _ in range(6):
        px[rnd.randint(1, 14), rnd.randint(1, 14)] = PALE + (255,)

def item_cornerstone(px, rnd):
    rect(px, 2, 6, 13, 13, STONE); rect(px, 2, 13, 13, 13, DARK); rect(px, 2, 6, 2, 13, DARK); rect(px, 13, 6, 13, 13, DARK)
    for i in range(4):
        rect(px, 7 - i, 2 + i, 8 + i, 2 + i, GOLD)
    rect(px, 7, 9, 8, 12, GOLD)

def item_ember(px, rnd, core=PALE, glow=EMBERC, ring=None):
    for x in range(16):
        for y in range(16):
            d = ((x - 7.5) ** 2 + (y - 8) ** 2) ** 0.5
            if d < 2.2: px[x, y] = core + (255,)
            elif d < 4.2: px[x, y] = glow + (255,)
            elif d < 5.4 and (x + y) % 2 == 0: px[x, y] = glow + (150,)
    if ring:
        for x in range(4, 12):
            px[x, 13] = ring + (255,); px[x, 3] = ring + (255,)
        for y in range(4, 13):
            px[3, y] = ring + (255,); px[12, y] = ring + (255,)

def item_banner(px, rnd):
    rect(px, 3, 1, 3, 15, BARK)
    rect(px, 4, 2, 12, 9, (170, 40, 40))
    rect(px, 4, 2, 12, 2, GOLD)
    rect(px, 7, 4, 9, 7, GOLD); rect(px, 8, 3, 8, 8, GOLD)
    for x in (4, 6, 8, 10, 12):
        px[x, 10] = (170, 40, 40, 255)

tex("blocks/siege_hall_cornerstone_side", cornerstone_side)
tex("blocks/siege_hall_cornerstone_top", cornerstone_top)
tex("blocks/siege_oath_tree_bark", bark)
tex("blocks/siege_oath_tree_bark_marked", lambda px, rnd: bark(px, rnd, ROOT_, EMBERC))
tex("blocks/siege_oath_tree_plinth", plinth)
tex("blocks/siege_oath_tree_crown", crown_plain)
tex("blocks/siege_oath_tree_crown_knight", crown_knight)
tex("blocks/siege_oath_tree_crown_marked", crown_marked)
tex("items/siege_hall_cornerstone", item_cornerstone)
tex("items/siege_hollow_ember", item_ember)
tex("items/siege_bound_ember", lambda px, rnd: item_ember(px, rnd, PALE, (150, 90, 230), (90, 60, 40)))
tex("items/siege_oath_banner", item_banner)

BLOCK_TEX = ["siege_hall_cornerstone_side", "siege_hall_cornerstone_top", "siege_oath_tree_bark", "siege_oath_tree_bark_marked",
             "siege_oath_tree_plinth", "siege_oath_tree_crown", "siege_oath_tree_crown_knight", "siege_oath_tree_crown_marked"]
ITEM_TEX = ["siege_hall_cornerstone", "siege_hollow_ember", "siege_bound_ember", "siege_oath_banner"]

merge_json(os.path.join(RP, "textures", "terrain_texture.json"),
           lambda d: d["texture_data"].update({t: {"textures": f"textures/blocks/{t}"} for t in BLOCK_TEX}))
merge_json(os.path.join(RP, "textures", "item_texture.json"),
           lambda d: d["texture_data"].update({t: {"textures": f"textures/items/{t}"} for t in ITEM_TEX}))
merge_json(os.path.join(RP, "blocks.json"),
           lambda d: d.update({"siege:hall_cornerstone": {"sound": "stone"}, "siege:tree_of_oaths": {"sound": "wood"}}))

# ---------------- Tree of Oaths model ----------------
def cube(origin, size, material=None):
    w, h, d = size
    def face(u, v, fw, fh):
        f = {"uv": [u, v], "uv_size": [fw, fh]}
        if material:
            f["material_instance"] = material
        return f
    side_w = lambda n: min(16, n)
    return {"origin": origin, "size": size, "uv": {
        "north": face(0, 16 - min(16, h), side_w(w), min(16, h)), "south": face(0, 16 - min(16, h), side_w(w), min(16, h)),
        "east": face(0, 16 - min(16, h), side_w(d), min(16, h)), "west": face(0, 16 - min(16, h), side_w(d), min(16, h)),
        "up": face(0, 0, side_w(w), side_w(d)), "down": face(0, 0, side_w(w), side_w(d))}}

cubes = [
    cube([-7, 0, -7], [14, 2, 14], "plinth"),
    cube([-5, 2, -5], [10, 1, 10], "plinth"),
    cube([-2, 3, -2], [4, 7, 4]),            # trunk
    cube([-4, 3, -1], [2, 2, 2]),            # roots
    cube([2, 3, -1], [2, 2, 2]),
    cube([-1, 3, 2], [2, 2, 2]),
    cube([-1, 3, -4], [2, 2, 2]),
    cube([-7, 10, -7], [14, 4, 14], "crown"),
    cube([-5, 14, -5], [10, 2, 10], "crown"),
    cube([-5, 8, -5], [10, 2, 10], "crown"),
]
write_json(os.path.join(RP, "models", "blocks", "tree_of_oaths.geo.json"), {
    "format_version": "1.12.0",
    "minecraft:geometry": [{
        "description": {"identifier": "geometry.siege_tree_of_oaths", "texture_width": 16, "texture_height": 16},
        "bones": [{"name": "block", "pivot": [0, 0, 0], "cubes": cubes}],
    }],
})

# ---------------- blocks ----------------
def mats(bark_t, crown_t):
    return {"minecraft:material_instances": {
        "*": {"texture": bark_t, "render_method": "opaque"},
        "plinth": {"texture": "siege_oath_tree_plinth", "render_method": "opaque"},
        "crown": {"texture": crown_t, "render_method": "opaque"}}}

write_json(os.path.join(BP, "blocks", "hall_cornerstone.json"), {
    "format_version": "1.21.60",
    "minecraft:block": {
        "description": {"identifier": "siege:hall_cornerstone", "menu_category": {"category": "items"}},
        "components": {
            "minecraft:display_name": "tile.siege:hall_cornerstone.name",
            "minecraft:geometry": "minecraft:geometry.full_block",
            "minecraft:material_instances": {
                "*": {"texture": "siege_hall_cornerstone_side", "render_method": "opaque"},
                "up": {"texture": "siege_hall_cornerstone_top", "render_method": "opaque"},
                "down": {"texture": "siege_hall_cornerstone_top", "render_method": "opaque"}},
            "minecraft:destructible_by_mining": {"seconds_to_destroy": 3},
            "minecraft:destructible_by_explosion": False,
            "minecraft:map_color": "#7e7c76"}}})

write_json(os.path.join(BP, "loot_tables", "blocks", "siege_nothing.json"), {"pools": []})
write_json(os.path.join(BP, "blocks", "tree_of_oaths.json"), {
    "format_version": "1.21.60",
    "minecraft:block": {
        "description": {"identifier": "siege:tree_of_oaths", "menu_category": {"category": "none"},
                        "states": {"siege:look": [0, 1, 2]}},
        "components": {
            "minecraft:display_name": "tile.siege:tree_of_oaths.name",
            "minecraft:geometry": "geometry.siege_tree_of_oaths",
            **mats("siege_oath_tree_bark", "siege_oath_tree_crown"),
            "minecraft:light_emission": 10,
            "minecraft:light_dampening": 0,
            "minecraft:loot": "loot_tables/blocks/siege_nothing.json",
            "minecraft:destructible_by_mining": {"seconds_to_destroy": 8},
            "minecraft:destructible_by_explosion": False,
            "minecraft:collision_box": {"origin": [-7, 0, -7], "size": [14, 16, 14]},
            "minecraft:selection_box": {"origin": [-7, 0, -7], "size": [14, 16, 14]},
            "minecraft:map_color": "#42803a"},
        "permutations": [
            {"condition": "q.block_state('siege:look') == 1", "components": mats("siege_oath_tree_bark", "siege_oath_tree_crown_knight")},
            {"condition": "q.block_state('siege:look') == 2", "components": {**mats("siege_oath_tree_bark_marked", "siege_oath_tree_crown_marked"), "minecraft:light_emission": 14}},
        ]}})

# ---------------- items ----------------
def item(name, icon, extra=None, category="items"):
    comps = {"minecraft:icon": icon, "minecraft:display_name": {"value": f"item.siege:{name}.name"}, "minecraft:max_stack_size": 1}
    comps.update(extra or {})
    write_json(os.path.join(BP, "items", f"{name}.json"), {
        "format_version": "1.21.60",
        "minecraft:item": {"description": {"identifier": f"siege:{name}", "menu_category": {"category": category}}, "components": comps}})

item("hollow_ember", "siege_hollow_ember", {"minecraft:glint": True})
item("bound_ember", "siege_bound_ember", {"minecraft:glint": True, "minecraft:hand_equipped": False}, "equipment")
item("oath_banner", "siege_oath_banner", {"minecraft:hand_equipped": True}, "equipment")

# ---------------- recipe: Hall Cornerstone at the Siege Workshop ----------------
write_json(os.path.join(BP, "recipes", "hall_cornerstone.json"), {
    "format_version": "1.20.10",
    "minecraft:recipe_shaped": {
        "description": {"identifier": "siege:hall_cornerstone_recipe"},
        "tags": ["siege_workshop"],
        "pattern": ["LLL", "SES", "SSS"],
        "key": {"L": {"tag": "minecraft:logs"}, "S": {"item": "minecraft:cobblestone"}, "E": {"item": "minecraft:emerald"}},
        "result": {"item": "siege:hall_cornerstone", "count": 1},
        "unlock": {"context": "AlwaysUnlocked"}}})

# ---------------- names ----------------
NAMES = {
    "tile.siege:hall_cornerstone.name": "Hall Cornerstone",
    "tile.siege:tree_of_oaths.name": "Tree of Oaths",
    "item.siege:hollow_ember.name": "The Ember",
    "item.siege:bound_ember.name": "Bound Ember",
    "item.siege:oath_banner.name": "Oath Banner",
}
for pack in (BP, RP):
    path = os.path.join(pack, "texts", "en_US.lang")
    if not os.path.exists(path):
        continue
    with open(path, encoding="utf8") as f:
        lines = f.read().splitlines()
    have = {l.split("=", 1)[0] for l in lines if "=" in l}
    lines += [f"{k}={v}" for k, v in NAMES.items() if k not in have]
    with open(path, "w", encoding="utf8") as f:
        f.write("\n".join(lines) + "\n")

print("Town hall assets written.")
