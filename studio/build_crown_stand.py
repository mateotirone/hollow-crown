#!/usr/bin/env python3
"""Builds the Crown Stand: when the Hollow Crown is dropped, it rests on a small floating stone stand
instead of lying on the ground as an item (Mateo's idea). Clicking the stand takes the Crown.
The script side is Siege_Nights_BP/scripts/undertow/crownkeep.js.

Writes: the entity (BP + RP), the stand's shape and the crown's shape on it, the bob-and-turn
animation, two render controllers (stone stand + the Crown's own texture), the stand texture and
its name. Safe to run again.   Run from the repo root:   python3 studio/build_crown_stand.py"""
import copy, json, os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BP, RP = os.path.join(ROOT, "Siege_Nights_BP"), os.path.join(ROOT, "Siege_Nights_RP")
ID = "siege:crown_stand"


def write(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf8") as f:
        json.dump(data, f, indent=2)
        f.write("\n")


# ---------------- Behavior pack: an unhurtable, unmovable, never-despawning stand ----------------
write(f"{BP}/entities/crown_stand.json", {"format_version": "1.21.60", "minecraft:entity": {
    "description": {"identifier": ID, "is_spawnable": False, "is_summonable": True},
    "components": {
        "minecraft:type_family": {"family": ["crown_stand", "inanimate"]},
        "minecraft:health": {"value": 20, "max": 20},
        "minecraft:collision_box": {"width": 0.8, "height": 1.5},
        "minecraft:physics": {"has_gravity": False, "has_collision": False},
        "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": False},
        "minecraft:knockback_resistance": {"value": 1},
        "minecraft:movement": {"value": 0},
        "minecraft:persistent": {},
        "minecraft:fire_immune": {},
        "minecraft:breathable": {"breathes_water": True, "breathes_air": True, "suffocate_time": -1},
        "minecraft:damage_sensor": {"triggers": [{"deals_damage": "no"}]},
    }}})

# ---------------- Resource pack ----------------
write(f"{RP}/entity/crown_stand.entity.json", {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
    "identifier": ID,
    "materials": {"default": "entity_alphatest"},
    "textures": {"stand": "textures/entity/siege_crown_stand", "crown": "textures/models/armor/siege_hollow_crown"},
    "geometry": {"stand": "geometry.siege_crown_stand", "crown": "geometry.siege_crown_stand_crown"},
    "animations": {"float": "animation.siege_crown_stand.float"},
    "scripts": {"animate": ["float"]},
    "render_controllers": ["controller.render.siege_crown_stand", "controller.render.siege_crown_stand_crown"],
}}})

write(f"{RP}/render_controllers/siege_crown_stand.render_controllers.json", {"format_version": "1.8.0", "render_controllers": {
    "controller.render.siege_crown_stand": {"geometry": "Geometry.stand", "materials": [{"*": "Material.default"}], "textures": ["Texture.stand"]},
    "controller.render.siege_crown_stand_crown": {"geometry": "Geometry.crown", "materials": [{"*": "Material.default"}], "textures": ["Texture.crown"]},
}})

# Both shapes share the "float" bone, so the stand and the Crown bob together; the Crown also turns slowly.
write(f"{RP}/animations/crown_stand.animation.json", {"format_version": "1.8.0", "animations": {
    "animation.siege_crown_stand.float": {"loop": True, "bones": {
        "float": {"position": [0, "math.sin(query.life_time * 60) * 1.2", 0]},
        "spin": {"rotation": [0, "query.life_time * 20", 0]},
    }}}})

bounds = {"visible_bounds_width": 2, "visible_bounds_height": 2.5, "visible_bounds_offset": [0, 1, 0]}

# The stand: a rough floating slab of dark stone with a lip, a short spike hanging under it, and
# four magenta shards hovering at its corners.
stand_cubes = [
    {"origin": [-5, 7, -5], "size": [10, 3, 10], "uv": [0, 0]},
    {"origin": [-4, 10, -4], "size": [8, 1, 8], "uv": [0, 13]},
    {"origin": [-3, 4, -3], "size": [6, 3, 6], "uv": [0, 22]},
    {"origin": [-1, 1, -1], "size": [2, 3, 2], "uv": [24, 22]},
]
shards = [{"origin": [x - 0.5, 9, z - 0.5], "size": [1, 3, 1], "uv": [28, 13]} for x, z in ((-6, -6), (6, -6), (-6, 6), (6, 6))]
write(f"{RP}/models/entity/crown_stand.geo.json", {"format_version": "1.12.0", "minecraft:geometry": [{
    "description": {"identifier": "geometry.siege_crown_stand", "texture_width": 64, "texture_height": 32, **bounds},
    "bones": [
        {"name": "float", "pivot": [0, 0, 0], "cubes": stand_cubes},
        {"name": "shards", "parent": "float", "pivot": [0, 10, 0], "rotation": [0, 0, 0], "cubes": shards},
    ]}]})

# The Crown on the stand: the worn Crown's own cubes, lowered from head height onto the stand top.
src = json.load(open(f"{RP}/models/entity/hollow_crown.geo.json", encoding="utf8"))["minecraft:geometry"][0]
cubes = [c for b in src["bones"] for c in b.get("cubes", [])]
low = min(c["origin"][1] for c in cubes)
drop = 11 - low  # crown rim sits on the stand's lip (top at y 11)
moved = []
for c in cubes:
    c = copy.deepcopy(c)
    c["origin"][1] += drop
    if "pivot" in c:
        c["pivot"][1] += drop
    moved.append(c)
write(f"{RP}/models/entity/crown_stand_crown.geo.json", {"format_version": "1.12.0", "minecraft:geometry": [{
    "description": {"identifier": "geometry.siege_crown_stand_crown", "texture_width": src["description"]["texture_width"],
                    "texture_height": src["description"]["texture_height"], **bounds},
    "bones": [
        {"name": "float", "pivot": [0, 0, 0]},
        {"name": "spin", "parent": "float", "pivot": [0, 11, 0], "cubes": moved},
    ]}]})

# Texture: dark cracked stone (the Crown's own colours) with magenta veins.
img = Image.new("RGBA", (64, 32), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
dark, mid, light, vein = (34, 26, 44, 255), (52, 40, 66, 255), (74, 60, 92, 255), (214, 64, 196, 255)
d.rectangle([0, 0, 39, 12], fill=mid)
d.rectangle([0, 13, 31, 21], fill=light)
d.rectangle([0, 22, 23, 31], fill=dark)
d.rectangle([24, 22, 31, 29], fill=dark)
d.rectangle([28, 13, 31, 17], fill=vein)
for i in range(0, 40, 3):
    img.putpixel((i, 3 + (i * 7) % 9), dark)
for x, y in ((2, 11), (5, 10), (8, 11), (14, 9), (17, 10), (22, 11), (27, 10), (33, 11), (36, 9)):
    img.putpixel((x, y), vein)
    img.putpixel((x, y - 1), vein)
for x in range(1, 31, 4):
    img.putpixel((x, 17), vein)
img.save(f"{RP}/textures/entity/siege_crown_stand.png")

# Name
lang = f"{RP}/texts/en_US.lang"
lines = open(lang, encoding="utf8").read().splitlines()
key = f"entity.{ID}.name="
lines = [l for l in lines if not l.startswith(key)] + [key + "The Hollow Crown"]
open(lang, "w", encoding="utf8").write("\n".join(lines) + "\n")
print("crown stand written")
