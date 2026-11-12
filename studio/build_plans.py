#!/usr/bin/env python3
"""The Plan Book and Plan Scroll items (scripts/settle/planbook.js): item files, 16x16 icons, atlas lines,
names and the Plan Book recipe (a book and a paper at a crafting table).
Run from the repo root:  python3 studio/build_plans.py
Safe to run again. Shared files are merged, and an icon that already exists is never overwritten."""
import json, os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BP, RP = os.path.join(ROOT, "Siege_Nights_BP"), os.path.join(ROOT, "Siege_Nights_RP")


def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf8") as f:
        json.dump(data, f, indent=2)
        f.write("\n")


def item(name, icon, stack):
    write_json(os.path.join(BP, "items", "settle", f"{name}.json"), {
        "format_version": "1.21.60",
        "minecraft:item": {
            "description": {"identifier": f"siege:{name}", "menu_category": {"category": "items"}},
            "components": {
                "minecraft:icon": icon,
                "minecraft:display_name": {"value": f"item.siege:{name}.name"},
                "minecraft:max_stack_size": stack,
                "minecraft:use_modifiers": {"use_duration": 0.05, "movement_modifier": 1.0},
            },
        },
    })


# palette
INK, LEATHER, LEATHER_D, PAGE, PAGE_D, GOLD, RED, CORD = (40, 34, 30), (112, 70, 40), (78, 46, 26), (232, 220, 190), (196, 180, 146), (214, 170, 60), (150, 40, 34), (120, 96, 60)


def icon(name, rows, colors):
    path = os.path.join(RP, "textures", "items", f"{name}.png")
    if os.path.exists(path):
        return
    im = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    px = im.load()
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in colors:
                px[x, y] = colors[ch] + (255,)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path)


# A leather book with a gold house outline on the cover and pale page edges
icon("siege_plan_book", [
    "................",
    "..kkkkkkkkkkk...",
    ".kLLLLLLLLLLLk..",
    ".kLLLLLgLLLLLpk.",
    ".kLLLLgLgLLLLpk.",
    ".kLLLgLLLgLLLpk.",
    ".kLLgggggggLLpk.",
    ".kLLgLLLLLgLLpk.",
    ".kLLgLgggLgLLpk.",
    ".kLLgLgLgLgLLpk.",
    ".kLLgggLgggLLpk.",
    ".kDLLLLLLLLLLpk.",
    ".kDDLLLLLLLLLpk.",
    "..kkkkkkkkkkkkk.",
    "................",
    "................",
], {"k": INK, "L": LEATHER, "D": LEATHER_D, "g": GOLD, "p": PAGE})

# A rolled plan tied with a red cord, a blue-ink plan showing
icon("siege_plan_scroll", [
    "................",
    "....dddddddd....",
    "...dPPPPPPPPd...",
    "...dPbbbbbbPd...",
    "...dPbPPPPbPd...",
    "...dPbPbbPbPd...",
    "...dPbbbbbbPd...",
    "...dPPPPPPPPd...",
    "...dPbbPPbbPd...",
    "...dPPPPPPPPd...",
    "..cdddddddddd...",
    "..crrrrrrrrrrc..",
    "...cPPPPPPPPc...",
    "....cccccccc....",
    "................",
    "................",
], {"d": PAGE_D, "P": PAGE, "b": (52, 84, 150), "c": CORD, "r": RED})

item("plan_book", "siege_plan_book", 1)
item("plan_scroll", "siege_plan_scroll", 1)  # one per stack: each scroll carries its own plan

path = os.path.join(RP, "textures", "item_texture.json")
data = json.load(open(path, encoding="utf8"))
data["texture_data"].update({
    "siege_plan_book": {"textures": "textures/items/siege_plan_book"},
    "siege_plan_scroll": {"textures": "textures/items/siege_plan_scroll"},
})
with open(path, "w", encoding="utf8") as f:  # the atlas keeps the one-space indent the other builders use
    json.dump(data, f, indent=1)
    f.write("\n")

names = {"item.siege:plan_book.name": "Plan Book", "item.siege:plan_scroll.name": "Plan Scroll"}
for pack in (BP, RP):
    p = os.path.join(pack, "texts", "en_US.lang")
    lines = open(p, encoding="utf8").read().splitlines()
    keep = [l for l in lines if l.split("=", 1)[0] not in names]
    keep += [f"{k}={v}" for k, v in names.items()]
    with open(p, "w", encoding="utf8") as f:
        f.write("\n".join(keep) + "\n")

write_json(os.path.join(BP, "recipes", "settle", "plan_book.json"), {
    "format_version": "1.20.10",
    "minecraft:recipe_shapeless": {
        "description": {"identifier": "siege:plan_book_recipe"},
        "tags": ["crafting_table"],
        "ingredients": [{"item": "minecraft:book"}, {"item": "minecraft:paper"}],
        "result": {"item": "siege:plan_book", "count": 1},
        "unlock": {"context": "AlwaysUnlocked"},
    },
})
print("plan book and scroll written")
