#!/usr/bin/env python3
"""Trains (The Hollow Crown): custom 3D Track and the trains that run on it.
Writes the Track block (20 shapes), the Train Engine and Train Coach entities (BP + RP), their parts,
items, recipes, placeholder textures in the five regional styles, and merges names and icons into
the shared files. Safe to run again; existing PNGs are never overwritten.
The shape list must match SHAPES in Siege_Nights_BP/scripts/trains/track.js.
Run from anywhere:  python3 studio/build_trains.py"""
import json, math, os, random
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + "/"
RP = ROOT + "Siege_Nights_RP/"; BP = ROOT + "Siege_Nights_BP/"
rnd = random.Random(23)

def write(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2); f.write("\n")

def save_png(path, img):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if not os.path.exists(path):  # never paint a placeholder over final art
        img.save(path)

# ================================================================ the Track
# Directions 0 N .. 7 NW. Minecraft north is -z, east is +x. Block geometry uses the same axes here
# (GX = 1). If diagonal pieces look mirrored in game, set GX = -1 and run again.
GX = 1
DX = [0, 1, 1, 1, 0, -1, -1, -1]; DZ = [-1, -1, 0, 1, 1, 1, 0, -1]
SHAPES = []
for d in range(4): SHAPES.append((0, d, (d, d + 4), None))
for i, d in enumerate([0, 2, 4, 6]):
    SHAPES.append((1, i * 2, (d, (d + 3) % 8), None)); SHAPES.append((1, i * 2 + 1, (d, (d + 5) % 8), None))
for i, d in enumerate([0, 2, 4, 6]): SHAPES.append((2, i, (d, (d + 2) % 8), None))
for i, d in enumerate([0, 2, 4, 6]): SHAPES.append((3, i, ((d + 4) % 8, d), d))

RAIL_Y = 2      # rails sit on the sleepers: sleepers 0-2 px, rails 2-4 px (RAIL_TOP 0.25 in track.js)
GAUGE = 7       # rail centres are 7 px either side of the middle (vanilla rails: about 5)

def face(mat):
    return {f: {"uv": [0, 0], "uv_size": [2, 2], "material_instance": mat} for f in ("north", "south", "east", "west", "up", "down")}

def cube(x, y, z, sx, sy, sz, mat):
    # (x, z) is the centre of the cube's footprint, y its bottom, all in pixels from the block centre
    return {"origin": [round(GX * x - sx / 2, 3), round(y, 3), round(z - sz / 2, 3)], "size": [sx, sy, sz], "uv": face(mat)}

def half_segment(d, rise=None):
    """Rails and sleepers from the block centre out to the edge (or corner) on side d.
    rise: None for flat, else (y at centre, y at edge) in pixels."""
    ux, uz = DX[d], DZ[d]
    diag = d % 2 == 1
    length = 8 * math.sqrt(2) if diag else 8
    n = math.hypot(ux, uz); ux, uz = ux / n, uz / n
    px, pz = -uz, ux  # across the track
    y_at = (lambda s: 0) if rise is None else (lambda s: rise[0] + (rise[1] - rise[0]) * s / length)
    cubes = []
    # sleepers
    for s in ((2.5, 7.0) if diag else (2.0, 6.0)):
        reach = 11 if diag else 12
        if diag:
            steps = 9
            for k in range(steps):
                a = -reach + 2 * reach * k / (steps - 1)
                cubes.append(cube(s * ux + a * px, y_at(s), s * uz + a * pz, 3, 2, 3, "sleeper"))
        else:
            sx, sz = (2 * reach, 3) if uz else (3, 2 * reach)
            cubes.append(cube(s * ux, y_at(s), s * uz, sx, 2, sz, "sleeper"))
    # rails
    for side in (-GAUGE, GAUGE):
        if diag or rise is not None:
            step = 1.5 if diag else 2.0
            k = 0
            while k * step < length + 0.01:
                s = min(k * step + step / 2, length - step / 2)
                cubes.append(cube(s * ux + side * px, RAIL_Y + y_at(s), s * uz + side * pz, 2, 2, 2, "rail"))
                k += 1
        else:
            sx, sz = (2, length) if uz else (length, 2)
            cubes.append(cube(length / 2 * ux + side * px, RAIL_Y, length / 2 * uz + side * pz, sx, 2, sz, "rail"))
    return cubes

geos = []
for kind, dirn, (a, b), up in SHAPES:
    cubes = []
    if kind == 3:  # slope: a = low end (floor), b = high end (top of the block)
        cubes += half_segment(a, rise=(8, 0)) + half_segment(b, rise=(8, 16))
    else:
        cubes += half_segment(a) + half_segment(b)
    geos.append({"description": {"identifier": f"geometry.siege_track_{kind}_{dirn}", "texture_width": 16, "texture_height": 16},
                 "bones": [{"name": "track", "pivot": [0, 0, 0], "cubes": cubes}]})
write(RP + "models/blocks/track.geo.json", {"format_version": "1.12.0", "minecraft:geometry": geos})

perms = []
for kind, dirn, _, _ in SHAPES:
    comps = {"minecraft:geometry": f"geometry.siege_track_{kind}_{dirn}"}
    if kind == 3:
        comps["minecraft:selection_box"] = {"origin": [-8, 0, -8], "size": [16, 16, 16]}
    perms.append({"condition": f"q.block_state('siege:kind') == {kind} && q.block_state('siege:dir') == {dirn}", "components": comps})
write(BP + "blocks/trains/track.json", {"format_version": "1.21.60", "minecraft:block": {
    "description": {"identifier": "siege:track", "menu_category": {"category": "items"},
                    "states": {"siege:kind": [0, 1, 2, 3], "siege:dir": [0, 1, 2, 3, 4, 5, 6, 7]}},
    "components": {
        "minecraft:display_name": "tile.siege:track.name",
        "minecraft:geometry": "geometry.siege_track_0_0",
        "minecraft:material_instances": {
            "*": {"texture": "siege_track_rail", "render_method": "alpha_test"},
            "rail": {"texture": "siege_track_rail", "render_method": "alpha_test"},
            "sleeper": {"texture": "siege_track_sleeper", "render_method": "alpha_test"}},
        "minecraft:collision_box": False,
        "minecraft:selection_box": {"origin": [-8, 0, -8], "size": [16, 4, 16]},
        "minecraft:light_dampening": 0,
        "minecraft:map_color": "#6e6a66",
        "minecraft:destructible_by_mining": {"seconds_to_destroy": 0.7},
        "minecraft:destructible_by_explosion": {"explosion_resistance": 1},
        "minecraft:placement_filter": {"conditions": [{"allowed_faces": ["up"]}]},
    },
    "permutations": perms}})
write(BP + "recipes/trains/track.json", {"format_version": "1.20.10", "minecraft:recipe_shaped": {
    "description": {"identifier": "siege:track_recipe"}, "tags": ["crafting_table"],
    "pattern": ["I I", "LIL", "I I"],
    "key": {"I": {"item": "minecraft:iron_ingot"}, "L": {"tag": "minecraft:logs"}},
    "result": {"item": "siege:track", "count": 8}, "unlock": {"context": "AlwaysUnlocked"}}})

# ================================================================ the trains
STYLES = ["vale", "frostmarch", "saltreach", "emberwaste", "blackfen"]  # must match TRAIN_STYLES in trains/data.js
# body, trim, roof, metal: one colour set per region (placeholders until the art pass)
PALETTE = {
    "vale":       ((48, 92, 60), (196, 160, 72), (70, 52, 38), (60, 60, 66)),
    "frostmarch": ((70, 98, 130), (222, 228, 236), (90, 96, 110), (78, 84, 96)),
    "saltreach":  ((40, 92, 120), (232, 220, 190), (150, 110, 70), (90, 86, 80)),
    "emberwaste": ((140, 52, 32), (210, 150, 60), (60, 44, 36), (54, 46, 44)),
    "blackfen":   ((54, 66, 44), (120, 128, 90), (40, 36, 30), (50, 52, 46)),
}
TILE = {"body": (0, 0), "trim": (16, 0), "roof": (32, 0), "metal": (48, 0), "wheel": (0, 16), "glass": (16, 16), "wood": (32, 16), "glow": (48, 16)}

def ecube(origin, size, tile):
    u, v = TILE[tile]
    f = {"uv": [u, v], "uv_size": [16, 16]}
    return {"origin": origin, "size": size, "uv": {k: dict(f) for k in ("north", "south", "east", "west", "up", "down")}}

# Cars are 3 blocks wide and 7 long (48 x 112 px). The front is -z in the model (it faces where the train goes).
W, L = 48, 112
def bogies():
    out = []
    for z0 in (-44, 36):
        out.append(ecube([-20, 2, z0], [40, 3, 8], "metal"))
        for x in (-23, 19):
            for dz in (-2, 6):
                out.append(ecube([x, 0, z0 + dz - 2], [4, 8, 8], "wheel"))
    return out

engine = bogies() + [
    ecube([-22, 8, -56], [44, 3, 112], "metal"),           # frame
    ecube([-15, 11, -54], [30, 22, 66], "body"),           # boiler
    ecube([-16, 11, -55], [32, 2, 2], "trim"), ecube([-16, 31, -55], [32, 2, 2], "trim"),
    ecube([-5, 33, -48], [10, 14, 10], "metal"),           # chimney
    ecube([-7, 47, -50], [14, 3, 14], "trim"),
    ecube([-4, 33, -24], [8, 6, 8], "trim"),               # dome
    ecube([-22, 11, 12], [44, 30, 44], "body"),            # cab
    ecube([-22, 41, 10], [44, 3, 48], "roof"),
    ecube([-22.5, 26, 20], [1, 10, 26], "glass"), ecube([21.5, 26, 20], [1, 10, 26], "glass"),
    ecube([-12, 26, 11.5], [24, 10, 1], "glass"),
    ecube([-4, 14, -58], [8, 8, 2], "glow"),               # lamp
    ecube([-24, 8, -58], [48, 4, 2], "trim"),              # buffer beam
]
coach = bogies() + [
    ecube([-22, 8, -56], [44, 3, 112], "metal"),
    ecube([-23, 11, -54], [46, 6, 108], "body"),            # lower sides
    ecube([-23, 17, -54], [2, 18, 108], "wood"), ecube([21, 17, -54], [2, 18, 108], "wood"),
    ecube([-21, 17, -54], [42, 18, 2], "wood"), ecube([-21, 17, 52], [42, 18, 2], "wood"),
    ecube([-23.5, 22, -46], [1, 10, 92], "glass"), ecube([22.5, 22, -46], [1, 10, 92], "glass"),
    ecube([-24, 35, -56], [48, 3, 112], "roof"),
    ecube([-24, 16, -55], [48, 2, 110], "trim"),
    ecube([-18, 11, -36], [36, 6, 8], "trim"), ecube([-18, 11, -4], [36, 6, 8], "trim"), ecube([-18, 11, 28], [36, 6, 8], "trim"),  # benches
]
for name, cubes in (("engine", engine), ("coach", coach)):
    write(RP + f"models/entity/train_{name}.geo.json", {"format_version": "1.12.0", "minecraft:geometry": [{
        "description": {"identifier": f"geometry.siege_train_{name}", "texture_width": 64, "texture_height": 32,
                        "visible_bounds_width": 10, "visible_bounds_height": 5, "visible_bounds_offset": [0, 1.5, 0]},
        "bones": [{"name": "body", "pivot": [0, 0, 0], "cubes": cubes}]}]})

# Seats in entity space: +z is the front. Engine: driver and fireman in the cab. Coach: three rows of two.
SEATS = {
    "engine": [[0.6, 0.9, -1.8], [-0.6, 0.9, -1.8]],
    "coach": [[0.55, 0.85, 2.0], [-0.55, 0.85, 2.0], [0.55, 0.85, 0.0], [-0.55, 0.85, 0.0], [0.55, 0.85, -2.0], [-0.55, 0.85, -2.0]],
}
for name, seats in SEATS.items():
    ident = f"siege:train_{name}"
    write(BP + f"entities/trains/train_{name}.json", {"format_version": "1.21.60", "minecraft:entity": {
        "description": {"identifier": ident, "is_spawnable": False, "is_summonable": True,
                        "properties": {"siege:style": {"type": "int", "range": [0, len(STYLES) - 1], "default": 0, "client_sync": True}}},
        "components": {
            "minecraft:type_family": {"family": ["siege_train", f"siege_train_{name}", "inanimate"]},
            "minecraft:collision_box": {"width": 2.6, "height": 2.4},
            "minecraft:health": {"value": 100, "max": 100},
            "minecraft:physics": {"has_gravity": False, "has_collision": False},
            "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": False},
            "minecraft:knockback_resistance": {"value": 1},
            "minecraft:fire_immune": True,
            "minecraft:damage_sensor": {"triggers": [{"cause": "all", "deals_damage": "no"}]},
            "minecraft:persistent": {},
            "minecraft:conditional_bandwidth_optimization": {"default_values": {"max_optimized_distance": 0, "max_dropped_ticks": 0, "use_motion_prediction_hints": True}},
            "minecraft:rideable": {
                "seat_count": len(seats), "crouching_skip_interact": True, "pull_in_entities": False,
                "family_types": ["player"], "interact_text": "action.interact.ride.minecart",
                "seats": [{"position": p, "min_rider_count": 0, "max_rider_count": len(seats)} for p in seats]},
        }}})
    write(RP + f"entity/train_{name}.entity.json", {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
        "identifier": ident, "materials": {"default": "entity_alphatest"},
        "textures": {s: f"textures/entity/siege/trains/{name}_{s}" for s in STYLES},
        "geometry": {"default": f"geometry.siege_train_{name}"},
        "scripts": {"should_update_bones_and_effects_offscreen": "1.0"},
        "render_controllers": ["controller.render.siege_train"]}}})
write(RP + "render_controllers/siege_train.render_controllers.json", {"format_version": "1.8.0", "render_controllers": {
    "controller.render.siege_train": {
        "arrays": {"textures": {"Array.styles": [f"Texture.{s}" for s in STYLES]}},
        "geometry": "Geometry.default", "materials": [{"*": "Material.default"}],
        "textures": ["Array.styles[query.has_property('siege:style') ? query.property('siege:style') : 0]"]}}})

# ---------------------------------------------------------------- placeholder textures
def cl(c): return tuple(max(0, min(255, int(v))) for v in c)
def noisy(c, a=6):
    n = rnd.randint(-a, a); return cl([v + n for v in c]) + (255,)
for name in ("engine", "coach"):
    for s in STYLES:
        body, trim, roof, metal = PALETTE[s]
        paint = {
            "body": lambda x, y: cl([v * 0.85 for v in body]) if y % 8 == 7 else body,
            "trim": lambda x, y: cl([v * 0.8 for v in trim]) if (x + y) % 6 == 0 else trim,
            "roof": lambda x, y: cl([v * 0.8 for v in roof]) if x % 4 == 0 else roof,
            "metal": lambda x, y: cl([v * 1.2 for v in metal]) if (x * 3 + y) % 7 == 0 else metal,
            "wheel": lambda x, y: (40, 40, 44) if abs(x - 7.5) + abs(y - 7.5) > 9 or abs(x - 7.5) + abs(y - 7.5) < 2 else cl([v * 1.3 for v in metal]),
            "glass": lambda x, y: (60, 70, 80) if x in (0, 15) or y in (0, 15) else (150, 190, 210),
            "wood": lambda x, y: (100, 72, 44) if y % 4 == 3 else (140, 104, 62),
            "glow": lambda x, y: (60, 56, 50) if x in (0, 15) or y in (0, 15) else (255, 214, 120),
        }
        atlas = Image.new("RGBA", (64, 32), (0, 0, 0, 0))
        for tile, (u, v) in TILE.items():
            for y in range(16):
                for x in range(16):
                    atlas.putpixel((u + x, v + y), noisy(paint[tile](x, y)))
        save_png(RP + f"textures/entity/siege/trains/{name}_{s}.png", atlas)

def icon(rows, col, path):
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in col: img.putpixel((x, y), noisy(col[ch], 4))
    save_png(path, img)
C = {"o": (36, 30, 26), "B": (48, 92, 60), "T": (196, 160, 72), "M": (70, 70, 76), "W": (112, 82, 50), "G": (150, 190, 210), "L": (255, 214, 120), "P": (140, 104, 62), "R": (60, 60, 66), "S": (92, 66, 44), "I": (190, 192, 198)}
icon(["................", "................", "..oo............", "..MM.......oooo.", ".oMMo......oGGo.", ".oooooooooooGGo.", ".oLBBBBBBBoBBBo.", ".oBBBBBBBBoBBBo.", ".oTTTTTTTTTTTTo.",
      ".oMMMMMMMMMMMMo.", "..oWWo..oWWoWo..", "..oWWo..oWWoWo..", "...oo....oo.o...", "................", "................", "................"],
     C, RP + "textures/items/trains/train_engine.png")
icon(["................", "................", "................", ".oooooooooooooo.", ".oRRRRRRRRRRRRo.", ".oPPPPPPPPPPPPo.", ".oPGGPGGPGGPGGo.", ".oPGGPGGPGGPGGo.", ".oPPPPPPPPPPPPo.",
      ".oBBBBBBBBBBBBo.", ".oMMMMMMMMMMMMo.", "..oWWo....oWWo..", "..oWWo....oWWo..", "...oo......oo...", "................", "................"],
     C, RP + "textures/items/trains/train_coach.png")
icon(["................", "................", "................", "................", "...oooooooooo...", "...oMMMMMMMMo...", "..ooooooooooo...", ".oWWo.oMo.oWWo..", ".oWWWooMooWWWo..",
      ".oWWWo...oWWWo..", ".oWWo.....oWWo..", "..oo.......oo...", "................", "................", "................", "................"],
     C, RP + "textures/items/trains/train_bogie.png")
icon(["................", "................", "....oooooooo....", "...oMMMMMMMMo...", "..oMIMMMMMMIMo..", "..oMMMMMMMMMMo..", "..oTTTTTTTTTTo..", "..oMMMMLLMMMMo..", "..oMMMLLLLMMMo..",
      "..oMMMMLLMMMMo..", "..oTTTTTTTTTTo..", "..oMMMMMMMMMMo..", "...oMMMMMMMMo...", "....oooooooo....", "................", "................"],
     C, RP + "textures/items/trains/train_boiler.png")
# track textures: worn steel rails and tarred oak sleepers
rail = Image.new("RGBA", (16, 16)); sleeper = Image.new("RGBA", (16, 16))
for y in range(16):
    for x in range(16):
        rail.putpixel((x, y), noisy((176, 178, 186) if y < 5 else (112, 106, 102) if y < 12 else (86, 72, 64), 5))
        sleeper.putpixel((x, y), noisy((58, 42, 30) if (x + y * 3) % 11 == 0 else (82, 60, 40) if y % 5 else (66, 48, 32), 5))
save_png(RP + "textures/blocks/trains/track_rail.png", rail)
save_png(RP + "textures/blocks/trains/track_sleeper.png", sleeper)

# ---------------------------------------------------------------- items and recipes (trains are made at a Workshop, and they cost a lot)
ITEMS = {
    "train_engine": ("Train Engine", "equipment", 1),
    "train_coach": ("Train Coach", "equipment", 1),
    "train_bogie": ("Train Bogie", "items", 16),
    "train_boiler": ("Train Boiler", "items", 16),
}
for key, (_, cat, stack) in ITEMS.items():
    write(BP + f"items/trains/{key}.json", {"format_version": "1.21.60", "minecraft:item": {
        "description": {"identifier": f"siege:{key}", "menu_category": {"category": cat}},
        "components": {"minecraft:icon": f"siege_{key}", "minecraft:display_name": {"value": f"item.siege:{key}.name"},
                       "minecraft:max_stack_size": stack}}})
RECIPES = {
    # 4 iron blocks + 4 ingots: 40 iron a bogie
    "train_bogie": (["IBI", "B B", "IBI"], {"I": {"item": "minecraft:iron_ingot"}, "B": {"item": "minecraft:iron_block"}}),
    # 7 iron blocks and a blast furnace: 63 iron and then some
    "train_boiler": (["BBB", "BFB", "BCB"], {"B": {"item": "minecraft:iron_block"}, "F": {"item": "minecraft:blast_furnace"}, "C": {"item": "minecraft:copper_block"}}),
    # boiler + 2 bogies + cab: about 160 iron
    "train_engine": (["PLP", "GXG", "Q Q"], {"P": {"tag": "minecraft:planks"}, "L": {"item": "minecraft:lantern"}, "G": {"item": "minecraft:glass_pane"},
                                             "X": {"item": "siege:train_boiler"}, "Q": {"item": "siege:train_bogie"}}),
    # 2 bogies + a carriage body: about 80 iron
    "train_coach": (["GGG", "WPW", "Q Q"], {"G": {"item": "minecraft:glass_pane"}, "W": {"tag": "minecraft:wool"}, "P": {"tag": "minecraft:planks"},
                                            "Q": {"item": "siege:train_bogie"}}),
}
for key, (pattern, keymap) in RECIPES.items():
    write(BP + f"recipes/trains/{key}.json", {"format_version": "1.20.10", "minecraft:recipe_shaped": {
        "description": {"identifier": f"siege:{key}_recipe"}, "tags": ["siege_workshop"], "pattern": pattern, "key": keymap,
        "result": {"item": f"siege:{key}", "count": 1}, "unlock": {"context": "AlwaysUnlocked"}}})

# ---------------------------------------------------------------- shared files (read again right before writing)
p = RP + "textures/item_texture.json"
d = json.load(open(p))
for key in ITEMS: d["texture_data"][f"siege_{key}"] = {"textures": f"textures/items/trains/{key}"}
with open(p, "w") as f:  # this file is indented by one space; keep it that way
    json.dump(d, f, indent=1); f.write("\n")
p = RP + "textures/terrain_texture.json"
d = json.load(open(p))
d["texture_data"]["siege_track_rail"] = {"textures": "textures/blocks/trains/track_rail"}
d["texture_data"]["siege_track_sleeper"] = {"textures": "textures/blocks/trains/track_sleeper"}
write(p, d)
p = RP + "blocks.json"
d = json.load(open(p)); d["siege:track"] = {"sound": "metal"}; write(p, d)
LANG = {"tile.siege:track.name": "Track", "entity.siege:train_engine.name": "Train Engine", "entity.siege:train_coach.name": "Train Coach"}
LANG.update({f"item.siege:{k}.name": v[0] for k, v in ITEMS.items()})
for path in (BP + "texts/en_US.lang", RP + "texts/en_US.lang"):
    lines = open(path).read().splitlines()
    have = {l.split("=", 1)[0] for l in lines if "=" in l}
    lines += [f"{k}={v}" for k, v in LANG.items() if k not in have]
    open(path, "w").write("\n".join(lines) + "\n")
print(f"trains: Track block ({len(SHAPES)} shapes), engine and coach in {len(STYLES)} styles, 4 parts, 5 recipes")
