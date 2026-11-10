#!/usr/bin/env python3
"""Pack files for the Hollow's mining villages (scripts/hollowfolk/): the Latticewood Boat.

Run from siege-nights/:  python3 studio/build_hollowfolk.py
Writes the boat entity, item, recipe, model and placeholder art, and adds its names and icon to the
shared lists. Textures that already exist are left alone (the textures thread paints the final ones).
"""
import json, os
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
BP, RP = os.path.join(ROOT, "Siege_Nights_BP"), os.path.join(ROOT, "Siege_Nights_RP")


def write(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")


# ---- behaviour: a real boat (vanilla boat physics and paddling) with our own look ----------------
write(f"{BP}/entities/hollowfolk/lattice_boat.json", {
    "format_version": "1.21.0",
    "minecraft:entity": {
        "description": {
            "identifier": "siege:lattice_boat",
            "runtime_identifier": "minecraft:boat",
            "is_spawnable": False, "is_summonable": True,
        },
        "components": {
            "minecraft:type_family": {"family": ["boat", "inanimate", "siege_lattice_boat"]},
            "minecraft:collision_box": {"width": 1.4, "height": 0.455},
            "minecraft:is_stackable": {},
            "minecraft:physics": {},
            "minecraft:pushable": {"is_pushable": True, "is_pushable_by_piston": True},
            "minecraft:rideable": {
                "seat_count": 2,
                "controlling_seat": 0,
                "crouching_skip_interact": True,
                "family_types": ["player"],
                "interact_text": "action.interact.ride.boat",
                "pull_in_entities": False,
                "seats": [
                    {"position": [0.0, -0.2, 0.0], "min_rider_count": 0, "max_rider_count": 1, "rotate_rider_by": -90, "lock_rider_rotation": 90},
                    {"position": [0.2, -0.2, 0.0], "min_rider_count": 2, "max_rider_count": 2, "rotate_rider_by": "query.has_any_family('blaze', 'creeper', 'enderman', 'illager', 'magmacube', 'piglin', 'player', 'skeleton', 'slime', 'villager', 'wandering_trader', 'witch', 'zombie', 'zombie_pigman') ? -90 : 0", "lock_rider_rotation": 90},
                    {"position": [-0.6, -0.2, 0.0], "min_rider_count": 2, "max_rider_count": 2, "rotate_rider_by": -90, "lock_rider_rotation": 90},
                ],
            },
        },
    },
})

write(f"{BP}/items/hollowfolk/lattice_boat.json", {
    "format_version": "1.21.60",
    "minecraft:item": {
        "description": {"identifier": "siege:lattice_boat", "menu_category": {"category": "items"}},
        "components": {
            "minecraft:icon": "siege_lattice_boat",
            "minecraft:display_name": {"value": "item.siege:lattice_boat.name"},
            "minecraft:max_stack_size": 1,
            "minecraft:entity_placer": {"entity": "siege:lattice_boat"},
        },
    },
})

# Five Latticewood in a boat shape. Works at a plain crafting table too, because you need it in the Hollow.
write(f"{BP}/recipes/hollowfolk/lattice_boat.json", {
    "format_version": "1.20.10",
    "minecraft:recipe_shaped": {
        "description": {"identifier": "siege:lattice_boat_recipe"},
        "tags": ["crafting_table", "siege_workshop"],
        "pattern": ["L L", "LLL"],
        "key": {"L": {"item": "siege:hollowwood_lattice"}},
        "result": {"item": "siege:lattice_boat", "count": 1},
        "unlock": {"context": "AlwaysUnlocked"},
    },
})

# ---- look: a long low hull with a raised prow and a glim lantern on it ----------------------------
def cube(origin, size, uv):
    return {"origin": origin, "size": size, "uv": uv}

write(f"{RP}/models/entity/hollowfolk/lattice_boat.geo.json", {
    "format_version": "1.12.0",
    "minecraft:geometry": [{
        "description": {"identifier": "geometry.siege_lattice_boat", "texture_width": 64, "texture_height": 64,
                        "visible_bounds_width": 4, "visible_bounds_height": 2, "visible_bounds_offset": [0, 0.5, 0]},
        "bones": [
            {"name": "root", "pivot": [0, 0, 0]},
            {"name": "hull", "parent": "root", "pivot": [0, 0, 0], "cubes": [
                cube([-7, 0, -13], [14, 2, 26], [0, 0]),      # bottom
                cube([-9, 2, -13], [2, 5, 26], [0, 28]),      # left side
                cube([7, 2, -13], [2, 5, 26], [0, 28]),       # right side
                cube([-7, 2, -15], [14, 5, 2], [0, 59]),      # stern
                cube([-7, 2, 13], [14, 5, 2], [0, 59]),       # bow
            ]},
            {"name": "prow", "parent": "hull", "pivot": [0, 7, 14], "cubes": [
                cube([-1, 7, 13], [2, 6, 2], [32, 59]),
                cube([-2, 13, 12], [4, 3, 4], [44, 50]),      # the lantern
            ]},
        ],
    }],
})

write(f"{RP}/entity/hollowfolk/lattice_boat.entity.json", {
    "format_version": "1.10.0",
    "minecraft:client_entity": {
        "description": {
            "identifier": "siege:lattice_boat",
            "materials": {"default": "entity_alphatest"},
            "textures": {"default": "textures/entity/hollowfolk/lattice_boat"},
            "geometry": {"default": "geometry.siege_lattice_boat"},
            "render_controllers": ["controller.render.default"],
        },
    },
})

WOOD = [(58, 36, 74), (70, 44, 88), (48, 30, 62), (82, 52, 100)]
VEIN, GLIM = (196, 70, 170), (150, 220, 255)


def paint_skin(path):
    if os.path.exists(path):
        return
    im = Image.new("RGBA", (64, 64))
    for y in range(64):
        for x in range(64):
            c = WOOD[(x // 3 + (y // 5) * 2) % 4] if (x * 7 + y * 13) % 11 else WOOD[2]
            if (x + y * 3) % 23 == 0:
                c = VEIN
            im.putpixel((x, y), c + (255,))
    for y in range(50, 64):  # lantern faces
        for x in range(44, 64):
            im.putpixel((x, y), GLIM + (255,))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path)


def paint_icon(path):
    if os.path.exists(path):
        return
    im = Image.new("RGBA", (16, 16))
    for x in range(2, 14):
        for y in range(8, 12):
            if (y == 11 and x in (2, 13)) or (y >= 10 and x in (2, 13) and y == 11):
                continue
            im.putpixel((x, y), (WOOD[1] if y == 8 else WOOD[0] if y < 11 else WOOD[2]) + (255,))
    for x in range(4, 12):
        im.putpixel((x, 9), VEIN + (255,)) if x % 3 == 0 else None
    for y in range(4, 8):
        im.putpixel((13, y), WOOD[3] + (255,))
    for x, y in ((12, 3), (13, 3), (12, 4), (13, 2)):
        im.putpixel((x, y), GLIM + (255,))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path)


paint_skin(f"{RP}/textures/entity/hollowfolk/lattice_boat.png")
paint_icon(f"{RP}/textures/items/hollowfolk/siege_lattice_boat.png")

# ---- shared lists: add our lines once -----------------------------------------------------------
p = f"{RP}/textures/item_texture.json"
it = json.load(open(p))
it["texture_data"]["siege_lattice_boat"] = {"textures": "textures/items/hollowfolk/siege_lattice_boat"}
write(p, it)

NAMES = ["item.siege:lattice_boat.name=Latticewood Boat", "entity.siege:lattice_boat.name=Latticewood Boat"]
for pack in (BP, RP):
    p = f"{pack}/texts/en_US.lang"
    text = open(p).read()
    add = [n for n in NAMES if n.split("=")[0] + "=" not in text]
    if add:
        with open(p, "a") as f:
            f.write(("" if text.endswith("\n") else "\n") + "\n".join(add) + "\n")

p = f"{ROOT}/TEXTURE-LIST.md"
text = open(p).read()
if "lattice_boat" not in text:
    with open(p, "a") as f:
        f.write("\n## The Hollow's mining villages (scripts/hollowfolk/)\n\n| What | File | State |\n|---|---|---|\n"
                "| Latticewood Boat skin (64×64, for `models/entity/hollowfolk/lattice_boat.geo.json`: long low hull of dark purple Latticewood with magenta veins, raised prow carrying a pale blue glim lantern) | `textures/entity/hollowfolk/lattice_boat.png` | Placeholder |\n"
                "| Latticewood Boat icon (16×16) | `textures/items/hollowfolk/siege_lattice_boat.png` | Placeholder |\n"
                "\nNo other new art: miners and foremen use Bedrock's built-in NPC skins for now. If they should have their own look (hooded, lantern-carrying, as in Mateo's mining village picture), that is a new 64×64 skin each (not started).\n")
print("hollowfolk pack files written")
