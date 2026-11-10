"""Builds every pack file for the dragons: the siege:dragon entity (behavior, client entity, model,
animations, render controller, four placeholder skins), the Dragon Egg / Saddle / Horn items, the
Dragon Roost and Dragon Nest blocks, recipes, and the merges into the shared atlases and lang file.

Run from the siege-nights folder:   python3 studio/build_dragons.py [preview.png]
Existing textures are never overwritten (the textures thread paints over placeholders).
The speed / health tables here must match scripts/dragons/data.js."""
import json, os, random, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "bestiary"))
from PIL import Image
from models import Model

BP, RP = "Siege_Nights_BP/", "Siege_Nights_RP/"
rnd = random.Random(7)

GROUND_SPEED = [0.22, 0.24, 0.26, 0.28, 0.30, 0.32]      # walking, by Speed training 0..5
AIR_SPEED = [0.040, 0.045, 0.050, 0.055, 0.060, 0.066]   # flying (a happy ghast is 0.016)
HEALTH = [40, 50, 60, 70, 80, 100]                       # by Vigor training 0..5
STAGES = {"hatchling": 0.25, "fledgling": 0.6, "adult": 1.0}

def write(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    json.dump(data, open(path, "w"), indent=1)

# ---------------------------------------------------------------- behavior
NO = lambda cause: {"cause": cause, "deals_damage": "no"}
SEATS = [
    {"position": [0.0, 1.55, -0.2], "min_rider_count": 0, "max_rider_count": 2, "third_person_camera_radius": 7.0, "camera_relax_distance_smoothing": 6.0},
    {"position": [0.0, 1.55, 0.7], "min_rider_count": 1, "max_rider_count": 2, "third_person_camera_radius": 7.0, "camera_relax_distance_smoothing": 6.0},
]

def ground(speed):
    return {
        "minecraft:physics": {},
        "minecraft:movement": {"value": speed},
        "minecraft:movement.basic": {},
        "minecraft:navigation.walk": {"can_path_over_water": False, "avoid_water": True, "avoid_damage_blocks": True},
        "minecraft:jump.static": {},
        "minecraft:input_ground_controlled": {},
        "minecraft:variable_max_auto_step": {"base_value": 1.0625, "controlled_value": 1.0625, "jump_prevented_value": 0.5625},
    }

def air(speed):
    # The same set the vanilla happy ghast flies with: you fly where the camera looks, jump climbs.
    return {
        "minecraft:physics": {"has_gravity": False},
        "minecraft:can_fly": {},
        "minecraft:movement": {"value": speed},
        "minecraft:flying_speed": {"value": speed},
        "minecraft:navigation.float": {"can_path_over_water": True, "avoid_damage_blocks": True},
        "minecraft:jump.static": {},
        "minecraft:free_camera_controlled": {"strafe_speed_modifier": 0.6, "backwards_movement_modifier": 0.3},
        "minecraft:vertical_movement_action": {"vertical_velocity": 0.45},
    }

groups = {}
for stage, scale in STAGES.items():
    groups[f"siege:stage_{stage}"] = {"minecraft:scale": {"value": scale}, **({"minecraft:is_baby": {}} if stage == "hatchling" else {})}
for i, hp in enumerate(HEALTH):
    groups[f"siege:health_{i}"] = {"minecraft:health": {"value": hp, "max": hp}}
for i in range(6):
    groups[f"siege:ground_{i}"] = ground(GROUND_SPEED[i])
    groups[f"siege:air_{i}"] = air(AIR_SPEED[i])
groups["siege:order_follow"] = {
    "minecraft:behavior.follow_owner": {"priority": 4, "speed_multiplier": 1.2, "start_distance": 9, "stop_distance": 4, "can_teleport": True},
    "minecraft:behavior.random_stroll": {"priority": 7, "speed_multiplier": 0.8, "xz_dist": 6, "interval": 200},
}
groups["siege:order_stay"] = {}
groups["siege:saddled_on"] = {
    "minecraft:rideable": {"seat_count": 2, "family_types": ["player"], "crouching_skip_interact": True, "pull_in_entities": False,
                           "interact_text": "action.interact.ride.horse", "seats": SEATS},
    "minecraft:behavior.player_ride_tamed": {"priority": 1},
}
groups["siege:ds_normal"] = {"minecraft:damage_sensor": {"triggers": [NO("fall"), NO("suffocation"), NO("fire"), NO("fire_tick"), NO("lava")]}}
groups["siege:ds_protected"] = {"minecraft:damage_sensor": {"triggers": [NO("all")]}}

MODES = [f"siege:{m}_{i}" for m in ("ground", "air") for i in range(6)]
def swap(all_of, one, props=None):
    ev = {"sequence": [{"remove": {"component_groups": [g for g in all_of if g != one]}}, {"add": {"component_groups": [one]}}]}
    if props: ev["sequence"].append({"set_property": props})
    return ev

events = {"minecraft:entity_spawned": {"add": {"component_groups": ["siege:stage_adult", "siege:health_0", "siege:ground_0", "siege:order_stay", "siege:ds_normal"]}}}
for stage in STAGES:
    events[f"siege:stage_{stage}"] = swap([f"siege:stage_{s}" for s in STAGES], f"siege:stage_{stage}")
for i in range(6):
    events[f"siege:health_{i}"] = swap([f"siege:health_{j}" for j in range(6)], f"siege:health_{i}")
    events[f"siege:to_ground_{i}"] = swap(MODES, f"siege:ground_{i}", {"siege:flying": False})
    events[f"siege:to_air_{i}"] = swap(MODES, f"siege:air_{i}", {"siege:flying": True})
events["siege:order_follow"] = swap(["siege:order_follow", "siege:order_stay"], "siege:order_follow")
events["siege:order_stay"] = swap(["siege:order_follow", "siege:order_stay"], "siege:order_stay")
events["siege:saddle_on"] = {"add": {"component_groups": ["siege:saddled_on"]}, "set_property": {"siege:saddled": True}}
events["siege:saddle_off"] = {"remove": {"component_groups": ["siege:saddled_on"]}, "set_property": {"siege:saddled": False}}
events["siege:ds_normal"] = swap(["siege:ds_normal", "siege:ds_protected"], "siege:ds_normal")
events["siege:ds_protected"] = swap(["siege:ds_normal", "siege:ds_protected"], "siege:ds_protected")

write(BP + "entities/dragons/dragon.json", {"format_version": "1.26.30", "minecraft:entity": {
    "description": {
        "identifier": "siege:dragon", "is_spawnable": False, "is_summonable": True,
        "properties": {
            "siege:hue": {"type": "int", "range": [0, 3], "default": 0, "client_sync": True},
            "siege:flying": {"type": "bool", "default": False, "client_sync": True},
            "siege:saddled": {"type": "bool", "default": False, "client_sync": True},
            "siege:breath": {"type": "bool", "default": False, "client_sync": True},
        },
    },
    "component_groups": groups,
    "components": {
        "minecraft:type_family": {"family": ["siege_dragon", "mob"]},
        "minecraft:collision_box": {"width": 2.2, "height": 2.2},
        "minecraft:nameable": {},
        "minecraft:persistent": {},
        "minecraft:fire_immune": {},
        "minecraft:is_tamed": {},
        "minecraft:tameable": {"probability": 0.0, "tame_items": []},
        "minecraft:knockback_resistance": {"value": 0.7},
        "minecraft:pushable": {"is_pushable": True, "is_pushable_by_piston": True},
        "minecraft:breathable": {"total_supply": 15, "suffocate_time": 0},
        "minecraft:follow_range": {"value": 32, "max": 32},
        "minecraft:conditional_bandwidth_optimization": {},
        "minecraft:behavior.float": {"priority": 0},
        "minecraft:behavior.look_at_player": {"priority": 8, "look_distance": 8, "probability": 0.02},
        "minecraft:behavior.random_look_around": {"priority": 9},
    },
    "events": events,
}})

# ---------------------------------------------------------------- model + skins
HUES = {  # scales, belly, wing membrane, horn, eye
    "ember": ((122, 44, 34), (196, 142, 84), (164, 78, 44), (58, 46, 44), (255, 196, 70)),
    "ash": ((92, 90, 96), (160, 154, 150), (120, 110, 118), (40, 38, 42), (255, 150, 60)),
    "sand": ((176, 142, 84), (222, 200, 150), (198, 150, 96), (90, 66, 44), (120, 220, 200)),
    "obsidian": ((40, 34, 52), (96, 70, 110), (70, 48, 88), (20, 18, 26), (255, 110, 190)),
}
def palette(h):
    scale, belly, wing, horn, eye = HUES[h]
    return {"scale": {"c": scale, "style": "stone"}, "belly": {"c": belly, "style": "bone"}, "wing": {"c": wing, "style": "cloth"},
            "horn": {"c": horn, "style": "bone"}, "saddle": {"c": (112, 74, 44), "style": "cloth"}, "eye": eye}

def dragon(m):
    m.bone("root", [0, 0, 0])
    m.bone("body", [0, 14, 0], "root")
    m.box("body", [-6, 10, -10], [12, 10, 22], "scale")
    m.box("body", [-5, 9, -9], [10, 1, 20], "belly")
    for i in range(4): m.box("body", [-1, 20, -8 + i * 5], [2, 2, 3], "horn")
    m.bone("saddle", [0, 20, 0], "body")
    m.box("saddle", [-5, 20, -5], [10, 1, 9], "saddle")
    m.box("saddle", [-3, 21, 2], [6, 2, 2], "saddle")
    m.bone("neck", [0, 17, -10], "body")
    m.box("neck", [-3, 14, -17], [6, 7, 8], "scale")
    m.bone("neck2", [0, 20, -17], "neck")
    m.box("neck2", [-3, 18, -23], [6, 6, 7], "scale")
    m.bone("head", [0, 22, -23], "neck2")
    m.box("head", [-4, 20, -31], [8, 7, 9], "scale", face="glow")
    m.box("head", [-3, 22, -38], [6, 3, 7], "scale")
    m.box("head", [-4, 27, -26], [2, 2, 7], "horn")
    m.box("head", [2, 27, -26], [2, 2, 7], "horn")
    m.bone("jaw", [0, 21, -31], "head")
    m.box("jaw", [-3, 20, -37], [6, 2, 7], "belly")
    m.bone("tail", [0, 16, 12], "body")
    m.box("tail", [-4, 12, 12], [8, 7, 10], "scale")
    m.bone("tail2", [0, 16, 22], "tail")
    m.box("tail2", [-3, 13, 22], [6, 5, 10], "scale")
    m.bone("tail3", [0, 16, 32], "tail2")
    m.box("tail3", [-2, 14, 32], [4, 3, 10], "scale")
    m.box("tail3", [-4, 15, 41], [8, 1, 5], "horn")
    for name, x, z, w, h in (("leg_fl", 4, -9, 4, 11), ("leg_fr", -8, -9, 4, 11), ("leg_bl", 4, 5, 5, 12), ("leg_br", -9, 5, 5, 12)):
        m.bone(name, [x + w / 2, h, z + 3], "body")
        m.box(name, [x, 0, z], [w, h, 6], "scale")
    for side, s in (("l", 1), ("r", -1)):
        x0 = 6 if s > 0 else -22
        x1 = 22 if s > 0 else -38
        m.bone(f"wing_{side}", [6 * s, 19, -4], "body")
        m.box(f"wing_{side}", [x0, 18, -6], [16, 1, 14], "wing")
        m.box(f"wing_{side}", [x0, 18, -8], [16, 2, 2], "horn")
        m.bone(f"wing_{side}_tip", [22 * s, 19, -4], f"wing_{side}")
        m.box(f"wing_{side}_tip", [x1, 18, -6], [16, 1, 12], "wing")
        m.box(f"wing_{side}_tip", [x1, 18, -8], [16, 2, 2], "horn")

model = Model("dragon", palette("ember"), seed=11)
dragon(model)
geo = model.geometry("geometry.siege_dragon")
desc = geo["minecraft:geometry"][0]["description"]
desc.update({"visible_bounds_width": 12, "visible_bounds_height": 5, "visible_bounds_offset": [0, 1.5, 0]})
write(RP + "models/entity/dragons/dragon.geo.json", geo)
for hue in HUES:
    path = RP + f"textures/entity/siege/dragons/dragon_{hue}.png"
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if not os.path.exists(path):
        model.rnd = random.Random(11)
        model.texture(palette(hue)).save(path)

write(RP + "entity/dragons/dragon.entity.json", {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
    "identifier": "siege:dragon",
    "materials": {"default": "entity_alphatest"},
    "textures": {h: f"textures/entity/siege/dragons/dragon_{h}" for h in HUES},
    "geometry": {"default": "geometry.siege_dragon"},
    "animations": {"look": "animation.siege_dragon.look", "idle": "animation.siege_dragon.idle", "walk": "animation.siege_dragon.walk",
                   "fold": "animation.siege_dragon.fold", "fly": "animation.siege_dragon.fly", "breath": "animation.siege_dragon.breath"},
    "scripts": {"animate": ["look", "idle",
                            {"walk": "!query.property('siege:flying')"}, {"fold": "!query.property('siege:flying')"},
                            {"fly": "query.property('siege:flying')"}, {"breath": "query.property('siege:breath')"}]},
    "render_controllers": ["controller.render.siege_dragon"],
}}})

write(RP + "render_controllers/siege_dragon.render_controllers.json", {"format_version": "1.8.0", "render_controllers": {
    "controller.render.siege_dragon": {
        "arrays": {"textures": {"Array.hues": [f"Texture.{h}" for h in HUES]}},
        "geometry": "Geometry.default",
        "materials": [{"*": "Material.default"}],
        "textures": ["Array.hues[query.property('siege:hue')]"],
        "part_visibility": [{"*": True}, {"saddle": "query.property('siege:saddled')"}],
    }}})

SWING = "math.cos(query.modified_distance_moved*30)*query.modified_move_speed*35"
FLAP = "math.sin(query.life_time*300)"
write(RP + "animations/dragon.animation.json", {"format_version": "1.8.0", "animations": {
    "animation.siege_dragon.look": {"loop": True, "bones": {"head": {"rotation": ["query.target_x_rotation*0.6", "query.target_y_rotation*0.5", "0"]}}},
    "animation.siege_dragon.idle": {"loop": True, "bones": {
        "tail": {"rotation": ["-6", "math.sin(query.life_time*50)*8", "0"]},
        "tail2": {"rotation": ["-4", "math.sin(query.life_time*50-40)*10", "0"]},
        "tail3": {"rotation": ["0", "math.sin(query.life_time*50-80)*12", "0"]},
        "neck": {"rotation": ["-18+math.sin(query.life_time*40)*2", "0", "0"]},
        "neck2": {"rotation": ["-14", "0", "0"]},
        "head": {"rotation": ["30", "0", "0"]}}},
    "animation.siege_dragon.walk": {"loop": True, "bones": {
        "leg_fl": {"rotation": [SWING, "0", "0"]}, "leg_br": {"rotation": [SWING, "0", "0"]},
        "leg_fr": {"rotation": ["-" + SWING, "0", "0"]}, "leg_bl": {"rotation": ["-" + SWING, "0", "0"]}}},
    "animation.siege_dragon.fold": {"loop": True, "bones": {
        "wing_l": {"rotation": ["0", "62", "-12"]}, "wing_l_tip": {"rotation": ["0", "-150", "0"]},
        "wing_r": {"rotation": ["0", "-62", "12"]}, "wing_r_tip": {"rotation": ["0", "150", "0"]}}},
    "animation.siege_dragon.fly": {"loop": True, "bones": {
        "wing_l": {"rotation": ["0", "0", f"{FLAP}*32"]}, "wing_l_tip": {"rotation": ["0", "0", "math.sin(query.life_time*300-50)*28"]},
        "wing_r": {"rotation": ["0", "0", f"-{FLAP}*32"]}, "wing_r_tip": {"rotation": ["0", "0", "-math.sin(query.life_time*300-50)*28"]},
        "body": {"position": ["0", f"{FLAP}*-1.5", "0"]},
        "leg_fl": {"rotation": ["40", "0", "0"]}, "leg_fr": {"rotation": ["40", "0", "0"]},
        "leg_bl": {"rotation": ["55", "0", "0"]}, "leg_br": {"rotation": ["55", "0", "0"]}}},
    "animation.siege_dragon.breath": {"loop": True, "bones": {"jaw": {"rotation": ["28", "0", "0"]}}},
}})

# ---------------------------------------------------------------- items, blocks, recipes
ITEMS = {  # key: (name, stack)
    "dragon_egg": ("Dragon Egg", 1),
    "dragon_saddle": ("Dragon Saddle", 1),
    "dragon_horn": ("Dragon Horn", 1),
}
for key, (name, stack) in ITEMS.items():
    write(BP + f"items/dragons/{key}.json", {"format_version": "1.21.60", "minecraft:item": {
        "description": {"identifier": f"siege:{key}", "menu_category": {"category": "equipment"}},
        "components": {"minecraft:icon": f"siege_{key}", "minecraft:display_name": {"value": f"item.siege:{key}.name"},
                       "minecraft:max_stack_size": stack, **({"minecraft:glint": True} if key == "dragon_egg" else {})}}})

BLOCKS = {  # id: (name, texture key, map color, light)
    "siege:dragon_roost": ("Dragon Roost", "siege_dragon_roost", "#7a4a34", 7),
    "hc:dragon_nest": ("Dragon Nest", "siege_dragon_nest", "#b08a54", 4),
}
for ident, (name, tex, color, light) in BLOCKS.items():
    write(BP + f"blocks/dragons/{ident.split(':')[1]}.json", {"format_version": "1.21.60", "minecraft:block": {
        "description": {"identifier": ident, "menu_category": {"category": "items"}},
        "components": {
            "minecraft:display_name": f"tile.{ident}.name",
            "minecraft:geometry": "minecraft:geometry.full_block",
            "minecraft:material_instances": {"*": {"texture": f"{tex}_side", "render_method": "opaque"},
                                             "up": {"texture": f"{tex}_top", "render_method": "opaque"},
                                             "down": {"texture": f"{tex}_side", "render_method": "opaque"}},
            "minecraft:map_color": color,
            "minecraft:light_emission": light,
            "minecraft:destructible_by_mining": {"seconds_to_destroy": 3.0},
            "minecraft:destructible_by_explosion": {"explosion_resistance": 30},
        }}})

I = lambda item: {"item": item}
def shaped(key, pattern, keys, result):
    write(BP + f"recipes/dragons/{key}.json", {"format_version": "1.20.10", "minecraft:recipe_shaped": {
        "description": {"identifier": f"siege:{key}_recipe"}, "tags": ["siege_workshop"], "pattern": pattern, "key": keys,
        "result": {"item": result, "count": 1}, "unlock": {"context": "AlwaysUnlocked"}}})
shaped("dragon_roost", ["BGB", "HMH", "SSS"], {"B": I("minecraft:blaze_rod"), "G": I("minecraft:gold_block"), "H": I("minecraft:hay_block"),
                                               "M": I("minecraft:magma"), "S": I("minecraft:stone_bricks")}, "siege:dragon_roost")
shaped("dragon_saddle", ["LSL", "CIC", "L L"], {"L": I("minecraft:leather"), "S": I("minecraft:saddle"), "C": I("minecraft:chain"),
                                               "I": I("minecraft:iron_ingot")}, "siege:dragon_saddle")
shaped("dragon_horn", [" GB", " BB", "S  "], {"G": I("minecraft:gold_ingot"), "B": I("minecraft:bone"), "S": I("minecraft:string")}, "siege:dragon_horn")

# ---------------------------------------------------------------- placeholder icons and block faces
def cl(c): return tuple(max(0, min(255, int(v))) for v in c)
def noisy(c, a=6):
    n = rnd.randint(-a, a); return cl([v + n for v in c])

def icon(key, rows, pal):
    path = RP + f"textures/items/dragons/siege_{key}.png"
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if os.path.exists(path): return
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    for y, row in enumerate(rows):
        for x, ch in enumerate(row[:16]):
            if ch in pal: img.putpixel((x, y), noisy(pal[ch], 5) + (255,))
    img.save(path)

icon("dragon_egg", [
    "................", "......oooo......", ".....oEEEEo.....", "....oEEhEEEo....", "....oEhEEsEo....", "...oEEEEEEEEo...", "...oEEsEEEEEo...",
    "...oEEEEEhEEo...", "...oEsEEEEEEo...", "...oEEEEsEEEo...", "...oEEEEEEEso...", "....oEEsEEEo....", "....oEEEEEEo....", ".....oooooo.....",
    "................", "................"], {"o": (40, 20, 18), "E": (122, 44, 34), "h": (220, 120, 60), "s": (84, 30, 26)})
icon("dragon_saddle", [
    "................", "................", "....oooooooo....", "...oCCCCCCCCo...", "..oCCTTTTTTCCo..", "..oCTTTTTTTTCo..", "..oCCCCCCCCCCo..",
    "..oLLLLLLLLLLo..", "..oLLoooooLLLo..", "...oLo...oLLo...", "...oSo...oSSo...", "...oSo....oo....", "...oSo..........", "....o...........",
    "................", "................"], {"o": (30, 20, 16), "C": (84, 50, 34), "T": (164, 60, 40), "L": (64, 40, 28), "S": (150, 150, 156)})
icon("dragon_horn", [
    "................", "............oo..", "...........oGGo.", "..........oBGo..", ".........oBBo...", "........oBBo....", ".......oBBo.....",
    "......oBDBo.....", ".....oBBBo......", "....oBDBBo......", "...oBBBBo.......", "..oBBBBo........", "..oMMMo.........", "...ooo..........",
    "................", "................"], {"o": (36, 28, 22), "B": (214, 200, 170), "D": (160, 144, 116), "G": (222, 180, 70), "M": (58, 46, 44)})

def block_tex(name, paint):
    path = RP + f"textures/blocks/dragons/{name}.png"
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if os.path.exists(path): return
    img = Image.new("RGBA", (16, 16))
    for y in range(16):
        for x in range(16): img.putpixel((x, y), noisy(paint(x, y)) + (255,))
    img.save(path)

STONE, SD, EMB, GOLD, HAY, HD = (112, 104, 100), (70, 62, 60), (226, 110, 40), (222, 180, 70), (190, 156, 84), (140, 110, 56)
brick = lambda x, y: SD if y % 4 == 3 or (x + (y // 4) * 4) % 8 == 0 else STONE
block_tex("siege_dragon_roost_side", lambda x, y: GOLD if y == 1 and 1 < x < 14 else EMB if 6 < y < 11 and 5 < x < 10 and (x + y) % 2 else brick(x, y))
block_tex("siege_dragon_roost_top", lambda x, y: SD if x in (0, 15) or y in (0, 15) else EMB if abs(x - 7.5) + abs(y - 7.5) < 3 else HD if (x * 3 + y) % 4 == 0 else HAY)
block_tex("siege_dragon_nest_side", lambda x, y: HD if (x + y * 2) % 5 == 0 or y > 12 else (150, 96, 60) if (x * 2 + y) % 7 == 0 else HAY)
block_tex("siege_dragon_nest_top", lambda x, y: HD if x in (0, 1, 14, 15) or y in (0, 1, 14, 15) else (122, 44, 34) if (x - 7.5) ** 2 + (y - 7.5) ** 2 < 9 else (96, 70, 44) if (x + y) % 3 == 0 else HAY)

# ---------------------------------------------------------------- merge into the shared files (read again right before writing)
def merge_json(path, change, default):
    data = json.load(open(path)) if os.path.exists(path) else default
    change(data)
    write(path, data)

def terrain(d):
    for _, tex, *_ in BLOCKS.values():
        for face in ("side", "top"):
            d["texture_data"][f"{tex}_{face}"] = {"textures": f"textures/blocks/dragons/{tex}_{face}"}
merge_json(RP + "textures/terrain_texture.json", terrain, {"resource_pack_name": "siege_nights", "texture_name": "atlas.terrain", "texture_data": {}})

def item_tex(d):
    for key in ITEMS: d["texture_data"][f"siege_{key}"] = {"textures": f"textures/items/dragons/siege_{key}"}
merge_json(RP + "textures/item_texture.json", item_tex, {"resource_pack_name": "siege_nights", "texture_name": "atlas.items", "texture_data": {}})

def block_sounds(d):
    d["siege:dragon_roost"] = {"sound": "stone"}
    d["hc:dragon_nest"] = {"sound": "grass"}
merge_json(RP + "blocks.json", block_sounds, {"format_version": "1.21.40"})

def sounds(d):
    d.setdefault("entity_sounds", {}).setdefault("entities", {})["siege:dragon"] = {
        "volume": 1.0, "pitch": [0.6, 0.8],
        "events": {"ambient": "mob.ravager.ambient", "hurt": "mob.ravager.hurt", "death": "mob.ravager.death", "step": "mob.ravager.step"}}
merge_json(RP + "sounds.json", sounds, {})

LANG = {f"item.siege:{k}.name": v[0] for k, v in ITEMS.items()}
LANG.update({f"tile.{ident}.name": v[0] for ident, v in BLOCKS.items()})
LANG["entity.siege:dragon.name"] = "Dragon"
p = RP + "texts/en_US.lang"
lines = [l for l in open(p).read().splitlines() if l.split("=")[0] not in LANG] + [f"{k}={v}" for k, v in LANG.items()]
open(p, "w").write("\n".join(lines) + "\n")

# ---------------------------------------------------------------- optional preview sheet (cube rotations ignored: wings shown spread)
if len(sys.argv) > 1:
    import render
    tiles = [render.render({"id": "dragon", "pal": palette(h), "model": dragon}, size=420) for h in HUES]
    sheet = Image.new("RGBA", (840, 840), (36, 38, 44, 255))
    for i, t in enumerate(tiles): sheet.alpha_composite(t, ((i % 2) * 420, (i // 2) * 420))
    sheet.save(sys.argv[1])
print("Dragons built.")
