#!/usr/bin/env python3
"""Train Carriage (The Hollow Crown): a four-seat wagon that rides the game's normal rails.
Writes the entity (BP + RP), a blocky placeholder model and texture, the item, its recipe and loot table,
and merges the names and icon into the shared files. Safe to run again; existing PNGs are never overwritten.
Run from anywhere:  python3 studio/build_carriage.py"""
import json, os, random
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + "/"
RP = ROOT + "Siege_Nights_RP/"; BP = ROOT + "Siege_Nights_BP/"
rnd = random.Random(11)
RAILS = ["minecraft:rail", "minecraft:golden_rail", "minecraft:detector_rail", "minecraft:activator_rail"]
MAX_SPEED = 0.6  # blocks per tick; a minecart's is 0.4. Must match CARRIAGE_SPEED in scripts/rails/data.js

def write(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2); f.write("\n")

def save_png(path, img):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if not os.path.exists(path):  # never paint a placeholder over final art
        img.save(path)

# ---------------------------------------------------------------- behavior
write(BP + "entities/carriage.json", {
    "format_version": "1.21.60",
    "minecraft:entity": {
        "description": {"identifier": "siege:carriage", "runtime_identifier": "minecraft:minecart",
                        "is_spawnable": False, "is_summonable": True},
        "components": {
            "minecraft:type_family": {"family": ["minecart", "siege_carriage", "inanimate"]},
            "minecraft:collision_box": {"width": 0.98, "height": 0.9},
            "minecraft:health": {"value": 12, "max": 12},
            "minecraft:physics": {},
            "minecraft:is_stackable": {},
            "minecraft:pushable": {"is_pushable": True, "is_pushable_by_piston": True},
            "minecraft:rail_movement": {"max_speed": MAX_SPEED},
            "minecraft:rail_sensor": {"eject_on_activate": True},
            "minecraft:rideable": {
                "seat_count": 4, "crouching_skip_interact": True, "pull_in_entities": False,
                "family_types": ["player"], "interact_text": "action.interact.ride.minecart",
                "seats": [
                    {"position": [-0.32, 0.05, 0.45], "min_rider_count": 0, "max_rider_count": 4},
                    {"position": [0.32, 0.05, 0.45], "min_rider_count": 2, "max_rider_count": 4},
                    {"position": [-0.32, 0.05, -0.5], "min_rider_count": 3, "max_rider_count": 4},
                    {"position": [0.32, 0.05, -0.5], "min_rider_count": 4, "max_rider_count": 4},
                ],
            },
            "minecraft:persistent": {},
            "minecraft:nameable": {},
            "minecraft:loot": {"table": "loot_tables/entities/carriage.json"},
            "minecraft:damage_sensor": {"triggers": [{"cause": "fall", "deals_damage": "no"}, {"cause": "drowning", "deals_damage": "no"}]},
        },
    },
})
write(BP + "loot_tables/entities/carriage.json", {"pools": [{"rolls": 1, "entries": [{"type": "item", "name": "siege:train_carriage", "weight": 1}]}]})
write(BP + "items/horses/train_carriage.json", {"format_version": "1.21.60", "minecraft:item": {
    "description": {"identifier": "siege:train_carriage", "menu_category": {"category": "equipment"}},
    "components": {"minecraft:icon": "siege_train_carriage", "minecraft:display_name": {"value": "item.siege:train_carriage.name"},
                   "minecraft:max_stack_size": 1, "minecraft:entity_placer": {"entity": "siege:carriage", "use_on": RAILS}}}})
write(BP + "recipes/horses/train_carriage.json", {"format_version": "1.20.10", "minecraft:recipe_shaped": {
    "description": {"identifier": "siege:train_carriage_recipe"}, "tags": ["siege_workshop"],
    "pattern": ["PLP", "PWP", "MIM"],
    "key": {"P": {"tag": "minecraft:planks"}, "L": {"item": "minecraft:lantern"}, "W": {"tag": "minecraft:wool"},
            "M": {"item": "minecraft:minecart"}, "I": {"item": "minecraft:iron_ingot"}},
    "result": {"item": "siege:train_carriage", "count": 1}, "unlock": {"context": "AlwaysUnlocked"}}})

# ---------------------------------------------------------------- model: an open passenger wagon, 30 long, 20 wide (1/16 blocks)
TILE = {"planks": (0, 0), "dark": (16, 0), "iron": (32, 0), "cloth": (48, 0), "wheel": (0, 16), "glow": (16, 16)}
def cube(origin, size, tile):
    u, v = TILE[tile]
    face = {"uv": [u, v], "uv_size": [16, 16]}
    return {"origin": origin, "size": size, "uv": {f: dict(face) for f in ("north", "south", "east", "west", "up", "down")}}
body = [
    cube([-10, 3, -15], [20, 2, 30], "dark"),      # floor
    cube([-10, 5, -15], [1, 8, 30], "planks"),     # left wall
    cube([9, 5, -15], [1, 8, 30], "planks"),       # right wall
    cube([-9, 5, -15], [18, 8, 1], "planks"),      # front wall
    cube([-9, 5, 14], [18, 8, 1], "planks"),       # back wall
    cube([-10.5, 12, -15.5], [21, 1, 1], "iron"), cube([-10.5, 12, 14.5], [21, 1, 1], "iron"),   # top rail, front and back
    cube([-10.5, 12, -14.5], [1, 1, 29], "iron"), cube([9.5, 12, -14.5], [1, 1, 29], "iron"),    # top rail, sides
    cube([-8, 5, -10], [16, 4, 5], "cloth"),       # front bench
    cube([-8, 5, 5], [16, 4, 5], "cloth"),         # back bench
    cube([-1, 13, -15], [2, 8, 1], "iron"),        # lantern post
    cube([-2, 21, -16.5], [4, 4, 4], "glow"),      # lantern
    cube([-9, 1, -12], [18, 2, 2], "iron"), cube([-9, 1, 10], [18, 2, 2], "iron"),               # axles
]
wheels = [cube([x, 0, z], [2, 6, 6], "wheel") for x in (-11, 9) for z in (-14, 8)]
write(RP + "models/entity/carriage.geo.json", {"format_version": "1.12.0", "minecraft:geometry": [{
    "description": {"identifier": "geometry.siege_carriage", "texture_width": 64, "texture_height": 64,
                    "visible_bounds_width": 4, "visible_bounds_height": 3, "visible_bounds_offset": [0, 1, 0]},
    "bones": [{"name": "body", "pivot": [0, 0, 0], "cubes": body}, {"name": "wheels", "pivot": [0, 3, 0], "cubes": wheels}]}]})
write(RP + "entity/carriage.entity.json", {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
    "identifier": "siege:carriage", "materials": {"default": "entity_alphatest"},
    "textures": {"default": "textures/entity/siege/carriage"}, "geometry": {"default": "geometry.siege_carriage"},
    "scripts": {"should_update_bones_and_effects_offscreen": "1.0"},
    "render_controllers": ["controller.render.default"]}}})

# ---------------------------------------------------------------- placeholder texture (64x64 atlas of 16x16 swatches) and icon
def cl(c): return tuple(max(0, min(255, int(v))) for v in c)
def noisy(c, a=6):
    n = rnd.randint(-a, a); return cl([v + n for v in c]) + (255,)
atlas = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
PAINT = {
    "planks": lambda x, y: (104, 76, 44) if y % 4 == 3 else (150, 112, 66),
    "dark": lambda x, y: (70, 50, 32) if x % 5 == 0 else (88, 64, 40),
    "iron": lambda x, y: (150, 152, 160) if (x + y) % 7 == 0 else (190, 192, 198),
    "cloth": lambda x, y: (130, 30, 34) if x in (0, 15) or y in (0, 15) else (161, 39, 34),
    "wheel": lambda x, y: (60, 60, 66) if abs(x - 7.5) + abs(y - 7.5) > 9 or abs(x - 7.5) + abs(y - 7.5) < 2 else (112, 82, 50),
    "glow": lambda x, y: (60, 56, 50) if x in (0, 15) or y in (0, 15) else (255, 214, 120),
}
for name, (u, v) in TILE.items():
    for y in range(16):
        for x in range(16):
            atlas.putpixel((u + x, v + y), noisy(PAINT[name](x, y)))
save_png(RP + "textures/entity/siege/carriage.png", atlas)

ICON = ["................", "................", ".......oo.......", ".......oGo......", ".......oo.......", "..oooooooooooo..", "..oPPPPPPPPPPo..",
        "..oPCCCPPCCCPo..", "..oPCCCPPCCCPo..", "..oPPPPPPPPPPo..", "..oDDDDDDDDDDo..", "..oooooooooooo..", "...oWWo..oWWo...", "...oWWo..oWWo...",
        "....oo....oo....", "................"]
icon = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
COL = {"o": (40, 28, 20), "P": (150, 112, 66), "C": (161, 39, 34), "D": (88, 64, 40), "W": (112, 82, 50), "G": (255, 214, 120)}
for y, row in enumerate(ICON):
    for x, ch in enumerate(row):
        if ch in COL: icon.putpixel((x, y), noisy(COL[ch], 4))
save_png(RP + "textures/items/horses/siege_train_carriage.png", icon)

# ---------------------------------------------------------------- shared files (read again right before writing)
p = RP + "textures/item_texture.json"
d = json.load(open(p)); d["texture_data"]["siege_train_carriage"] = {"textures": "textures/items/horses/siege_train_carriage"}; write(p, d)
LANG = {"item.siege:train_carriage.name": "Train Carriage", "entity.siege:carriage.name": "Train Carriage"}
for path in (BP + "texts/en_US.lang", RP + "texts/en_US.lang"):
    lines = open(path).read().splitlines()
    have = {l.split("=", 1)[0] for l in lines if "=" in l}
    lines += [f"{k}={v}" for k, v in LANG.items() if k not in have]
    open(path, "w").write("\n".join(lines) + "\n")
print("carriage: entity, model, item, recipe, loot table, 2 placeholder textures")
