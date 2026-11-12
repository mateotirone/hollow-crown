#!/usr/bin/env python3
"""The Ironworks block (The Hollow Crown): block JSON, Siege Workshop recipe, textures, and its lines in the shared
files (terrain_texture.json, blocks.json, en_US.lang), without touching anyone else's entries. Safe to run again;
never paints over a texture that already exists (delete the PNG to repaint it).
Run from anywhere:  python3 studio/build_ironworks.py   (scripts: Siege_Nights_BP/scripts/ironworks/)"""
import json, os, random, re
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + "/"
RP = ROOT + "Siege_Nights_RP/"; BP = ROOT + "Siege_Nights_BP/"
rnd = random.Random(31)

def write(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2); f.write("\n")

def merge(path, key, entries):
    with open(path) as f:
        text = f.read()
    data = json.loads(text)
    (data[key] if key else data).update(entries)
    with open(path, "w") as f:  # keep the shared file's own one-space layout so the diff stays small
        json.dump(data, f, indent=1); f.write("\n")

write(BP + "blocks/settle/ironworks.json", {"format_version": "1.21.90", "minecraft:block": {
    "description": {"identifier": "siege:ironworks", "menu_category": {"category": "items"}},
    "components": {
        "minecraft:display_name": "tile.siege:ironworks.name",
        "minecraft:geometry": "minecraft:geometry.full_block",
        "minecraft:material_instances": {
            "*": {"texture": "siege_ironworks_side", "render_method": "opaque"},
            "up": {"texture": "siege_ironworks_top", "render_method": "opaque"},
            "down": {"texture": "siege_ironworks_bottom", "render_method": "opaque"}},
        "minecraft:map_color": "#5a5450",
        "minecraft:light_emission": 4,
        "minecraft:destructible_by_mining": {"seconds_to_destroy": 3.5},
        "minecraft:destructible_by_explosion": {"explosion_resistance": 8},
        "siege:clickable": {}}}})

write(BP + "recipes/settle/ironworks.json", {"format_version": "1.20.10", "minecraft:recipe_shaped": {
    "description": {"identifier": "siege:ironworks_recipe"}, "tags": ["siege_workshop"],
    "pattern": ["SPS", "IFI", "SBS"],
    "key": {"S": {"item": "minecraft:cobblestone"}, "P": {"item": "minecraft:iron_pickaxe"}, "I": {"item": "minecraft:iron_ingot"},
            "F": {"item": "minecraft:furnace"}, "B": {"item": "minecraft:barrel"}},
    "result": {"item": "siege:ironworks", "count": 1}, "unlock": {"context": "AlwaysUnlocked"}}})

# ---------------------------------------------------------------- textures (16x16, vanilla-plus, top-left light)
cl = lambda c: tuple(max(0, min(255, int(v))) for v in c)
def noisy(c, a=6):
    n = rnd.randint(-a, a); return cl([v + n for v in c])
def tex(path, paint):
    if os.path.exists(path):
        return
    img = Image.new("RGBA", (16, 16))
    for y in range(16):
        for x in range(16):
            img.putpixel((x, y), noisy(paint(x, y)) + (255,))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path)

ST, SL, SD, MORT = (112, 108, 106), (138, 134, 130), (78, 74, 74), (60, 56, 56)
IRON, IRD, EMB, EML, SOOT = (198, 198, 204), (120, 120, 128), (214, 96, 30), (250, 170, 60), (40, 36, 36)
WOOD, WDD = (120, 86, 52), (84, 58, 34)
def brick(x, y):
    row = y // 4; off = 4 if row % 2 else 0
    if y % 4 == 3 or (x + off) % 8 == 7: return MORT
    return SL if (y % 4 == 0 or (x + off) % 8 == 0) else ST
def side(x, y):
    if x in (0, 15) or y in (0, 15): return SD
    if 5 <= x <= 10 and 8 <= y <= 13:  # furnace mouth with a glow inside
        if y == 8 or x in (5, 10): return SOOT
        return EML if (y >= 11 and 7 <= x <= 8) else EMB if y >= 10 else SOOT
    if 3 <= y <= 5 and 3 <= x <= 12:  # an iron band with rivets
        return IRD if y in (3, 5) else (SOOT if x % 3 == 0 else IRON)
    return brick(x, y)
def top(x, y):  # an anvil seen from above on a stone slab
    if x in (0, 15) or y in (0, 15): return SD
    if 3 <= y <= 6 and 2 <= x <= 13: return IRON if y < 5 else IRD
    if 7 <= y <= 9 and 5 <= x <= 10: return IRD
    if 10 <= y <= 12 and 3 <= x <= 12: return IRON if y == 10 else IRD
    return brick(x, y)
def bottom(x, y):
    return SD if x in (0, 15) or y in (0, 15) else (WDD if y % 4 == 3 else WOOD)
T = RP + "textures/blocks/settle/"
tex(T + "siege_ironworks_side.png", side)
tex(T + "siege_ironworks_top.png", top)
tex(T + "siege_ironworks_bottom.png", bottom)

merge(RP + "textures/terrain_texture.json", "texture_data", {
    f"siege_ironworks_{k}": {"textures": f"textures/blocks/settle/siege_ironworks_{k}"} for k in ("side", "top", "bottom")})
merge(RP + "blocks.json", None, {"siege:ironworks": {"sound": "stone"}})
lang = RP + "texts/en_US.lang"
with open(lang) as f:
    text = f.read()
if "tile.siege:ironworks.name=" not in text:
    with open(lang, "a") as f:
        f.write(("" if text.endswith("\n") else "\n") + "tile.siege:ironworks.name=Ironworks\n")
print("ironworks: block, recipe, textures and shared entries written")
