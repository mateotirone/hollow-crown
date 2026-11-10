#!/usr/bin/env python3
"""Pack files for the economy: the two coin items, placeholder icons, names, and the job NPC entity.
Run from the siege-nights folder:   python3 studio/build_economy.py
Safe to re-run: never overwrites a PNG that exists (the textures thread paints the real ones),
and only adds missing lines to the shared lang and texture-atlas files."""
import json, os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BP, RP = os.path.join(ROOT, "Siege_Nights_BP"), os.path.join(ROOT, "Siege_Nights_RP")

# id: (display name, stack, (rim, face, shine))   The display name is the only place the currency's name lives in the pack.
ITEMS = {
    "coin": ("Regal", 64, ((70, 74, 82), (150, 156, 166), (214, 219, 226))),
    "gold_coin": ("Gold Regal", 64, ((120, 84, 20), (214, 168, 52), (250, 226, 130))),
}

def item_json(name, stack):
    return {"format_version": "1.21.60", "minecraft:item": {
        "description": {"identifier": f"siege:{name}", "menu_category": {"category": "items"}},
        "components": {
            "minecraft:icon": f"siege_{name}",
            "minecraft:display_name": {"value": f"item.siege:{name}.name"},
            "minecraft:max_stack_size": stack,
        }}}

def coin_png(path, rim, face, shine):
    if os.path.exists(path):
        return False
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((2, 2, 13, 13), fill=rim)
    d.ellipse((3, 3, 12, 12), fill=face)
    # a crude crowned head in profile, so it reads as "the old king's coin"
    for x, y in [(6, 5), (8, 5), (10, 5), (6, 6), (7, 6), (8, 6), (9, 6), (10, 6)]:
        img.putpixel((x, y), rim + (255,))
    d.rectangle((7, 7, 9, 10), fill=rim)
    img.putpixel((10, 8), rim + (255,))
    for x, y in [(4, 5), (5, 4), (4, 6)]:
        img.putpixel((x, y), shine + (255,))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path)
    return True

def add_lang(path, lines):
    have = open(path, encoding="utf8").read() if os.path.exists(path) else ""
    keys = {l.split("=", 1)[0] for l in have.splitlines() if "=" in l}
    new = [f"{k}={v}" for k, v in lines.items() if k not in keys]
    if new:
        with open(path, "w", encoding="utf8") as f:
            f.write(have + ("" if have.endswith("\n") or not have else "\n") + "\n".join(new) + "\n")
    return len(new)

os.makedirs(os.path.join(BP, "items", "economy"), exist_ok=True)
for name, (label, stack, _) in ITEMS.items():
    with open(os.path.join(BP, "items", "economy", f"{name}.json"), "w", encoding="utf8") as f:
        json.dump(item_json(name, stack), f, indent=2)
        f.write("\n")

painted = [n for n, (_, _, c) in ITEMS.items() if coin_png(os.path.join(RP, "textures", "items", f"siege_{n}.png"), *c)]

atlas_path = os.path.join(RP, "textures", "item_texture.json")
atlas = json.load(open(atlas_path, encoding="utf8"))  # read just before writing: shared file
added = 0
for name in ITEMS:
    if f"siege_{name}" not in atlas["texture_data"]:
        atlas["texture_data"][f"siege_{name}"] = {"textures": f"textures/items/siege_{name}"}
        added += 1
if added:
    with open(atlas_path, "w", encoding="utf8") as f:
        json.dump(atlas, f, indent=2)
        f.write("\n")

# ---------- the job NPC: one entity, eight painted skins (textures/entity/siege/npc/job_<id>.png, studio/art/build_job_npcs.py) ----------
# The order is the value of the siege:job property and must match JOB_IDS in scripts/economy/config.js. Only ever add at the end.
JOB_SKINS = ["farmer", "woodcutter", "quarryman", "smith", "fisher", "hunter", "herbalist", "moneyer"]

job_entity = {"format_version": "1.21.60", "minecraft:entity": {
    "description": {"identifier": "siege:job_npc", "is_spawnable": False, "is_summonable": True, "is_experimental": False,
                    "properties": {"siege:job": {"type": "int", "range": [0, len(JOB_SKINS) - 1], "default": 0, "client_sync": True}}},
    "components": {
        "minecraft:type_family": {"family": ["npc", "siege_job", "mob"]},
        "minecraft:health": {"value": 20, "max": 20},
        "minecraft:collision_box": {"width": 0.6, "height": 1.9},
        "minecraft:damage_sensor": {"triggers": [{"cause": "all", "deals_damage": "no"}]},
        "minecraft:knockback_resistance": {"value": 1},
        "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": False},
        "minecraft:physics": {},
        "minecraft:persistent": {},
        "minecraft:nameable": {"always_show": False, "allow_name_tag_renaming": False},
        "minecraft:fire_immune": {},
        "minecraft:breathable": {"total_supply": 15, "suffocate_time": 0, "breathes_water": True},
        "minecraft:interact": {"interactions": [{"interact_text": "action.interact.trade",
                                                 "on_interact": {"filters": {"test": "is_family", "subject": "other", "value": "player"}}}]},
        "minecraft:behavior.look_at_player": {"priority": 1, "look_distance": 8, "probability": 1},
        "minecraft:behavior.random_look_around": {"priority": 2},
    }}}
job_client = {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
    "identifier": "siege:job_npc",
    "materials": {"default": "villager"},
    "textures": {n: f"textures/entity/siege/npc/job_{n}" for n in JOB_SKINS},
    "geometry": {"default": "geometry.villager.v1.8"},
    "scripts": {"scale": "0.9375", "animate": ["look_at_target"]},
    "animations": {"look_at_target": "animation.common.look_at_target"},
    "render_controllers": ["controller.render.siege_job_npc"],
}}}
job_render = {"format_version": "1.8.0", "render_controllers": {"controller.render.siege_job_npc": {
    "arrays": {"textures": {"Array.job": [f"Texture.{n}" for n in JOB_SKINS]}},
    "geometry": "Geometry.default",
    "materials": [{"*": "Material.default"}],
    "textures": ["Array.job[query.property('siege:job')]"],
}}}
for path, data in ((os.path.join(BP, "entities", "economy", "job_npc.json"), job_entity),
                   (os.path.join(RP, "entity", "economy", "job_npc.entity.json"), job_client),
                   (os.path.join(RP, "render_controllers", "siege_job_npc.render_controllers.json"), job_render)):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf8") as f:
        json.dump(data, f, indent=2)
        f.write("\n")
missing_skins = [n for n in JOB_SKINS if not os.path.exists(os.path.join(RP, "textures", "entity", "siege", "npc", f"job_{n}.png"))]
if missing_skins:
    print("economy: WARNING, no skin painted for: " + ", ".join(missing_skins) + " (run studio/art/build_job_npcs.py)")

names = {f"item.siege:{n}.name": label for n, (label, _, _) in ITEMS.items()}
names["entity.siege:job_npc.name"] = "Tradesman"
langs = sum(add_lang(os.path.join(p, "texts", "en_US.lang"), names) for p in (BP, RP))

todo = os.path.join(ROOT, "TEXTURE-LIST.md")
if "## Economy" not in open(todo, encoding="utf8").read():
    with open(todo, "a", encoding="utf8") as f:
        f.write("\n## Economy (2026-11-10)\nWritten by `studio/build_economy.py` (never overwrites a PNG that exists).\n"
                "- `textures/items/siege_coin.png` (the Regal: iron-grey coin with the old king's crowned head): placeholder\n"
                "- `textures/items/siege_gold_coin.png` (the Gold Regal, worth 64): placeholder\n"
                "- Job NPCs (Farmer, Woodcutter, Quarryman, Smith, Fisher, Hunter, Herbalist, Moneyer) use built-in NPC skins for now: own skins wanted\n")

print(f"economy: job NPC entity with {len(JOB_SKINS)} skins,", end=" ")
print(f"{len(ITEMS)} items, {len(painted)} placeholder icons painted, {added} atlas entries, {langs} lang lines")
