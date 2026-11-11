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

# Ladders have 8 steps: step = training level (0..5) + 1 + the species' shift (-1, 0 or +1).
GROUND_SPEED = [0.20, 0.22, 0.24, 0.26, 0.28, 0.30, 0.32, 0.34]          # walking
AIR_SPEED = [0.035, 0.040, 0.045, 0.050, 0.055, 0.060, 0.066, 0.072]     # flying (a happy ghast is 0.016)
RESERVE = 30  # hidden health under every dragon: when only this is left it falls unconscious instead of dying
HEALTH = [h + RESERVE for h in (30, 40, 50, 60, 70, 80, 100, 120)]
N = 8
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
for i in range(N):
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

# Unconscious (or dead and lying there): can't move, can't be ridden, can't be hurt by the game. The script counts the blows.
groups["siege:downed"] = {
    "minecraft:physics": {},
    "minecraft:movement": {"value": 0.0},
    "minecraft:knockback_resistance": {"value": 1.0},
    "minecraft:damage_sensor": {"triggers": [NO("all")]},
}

MODES = [f"siege:{m}_{i}" for m in ("ground", "air") for i in range(N)]
def swap(all_of, one, props=None):
    ev = {"sequence": [{"remove": {"component_groups": [g for g in all_of if g != one]}}, {"add": {"component_groups": [one]}}]}
    if props: ev["sequence"].append({"set_property": props})
    return ev

events = {"minecraft:entity_spawned": {"add": {"component_groups": ["siege:stage_adult", "siege:health_1", "siege:ground_1", "siege:order_stay", "siege:ds_normal"]}}}
for stage in STAGES:
    events[f"siege:stage_{stage}"] = swap([f"siege:stage_{s}" for s in STAGES], f"siege:stage_{stage}")
for i in range(N):
    events[f"siege:health_{i}"] = swap([f"siege:health_{j}" for j in range(N)], f"siege:health_{i}")
    events[f"siege:to_ground_{i}"] = swap(MODES, f"siege:ground_{i}", {"siege:flying": False})
    events[f"siege:to_air_{i}"] = swap(MODES, f"siege:air_{i}", {"siege:flying": True})
events["siege:order_follow"] = swap(["siege:order_follow", "siege:order_stay"], "siege:order_follow")
events["siege:order_stay"] = swap(["siege:order_follow", "siege:order_stay"], "siege:order_stay")
events["siege:saddle_on"] = {"add": {"component_groups": ["siege:saddled_on"]}, "set_property": {"siege:saddled": True}}
events["siege:saddle_off"] = {"remove": {"component_groups": ["siege:saddled_on"]}, "set_property": {"siege:saddled": False}}
events["siege:go_down"] = {"sequence": [
    {"remove": {"component_groups": MODES + ["siege:saddled_on", "siege:order_follow", "siege:order_stay", "siege:ds_normal", "siege:ds_protected"]}},
    {"add": {"component_groups": ["siege:downed"]}}, {"set_property": {"siege:flying": False}}]}
events["siege:get_up"] = {"remove": {"component_groups": ["siege:downed"]}}  # the script then re-applies its record
events["siege:ds_normal"] = swap(["siege:ds_normal", "siege:ds_protected"], "siege:ds_normal")
events["siege:ds_protected"] = swap(["siege:ds_normal", "siege:ds_protected"], "siege:ds_protected")

write(BP + "entities/dragons/dragon.json", {"format_version": "1.26.30", "minecraft:entity": {
    "description": {
        "identifier": "siege:dragon", "is_spawnable": False, "is_summonable": True,
        "properties": {
            "siege:species": {"type": "int", "range": [0, 3], "default": 0, "client_sync": True},
            "siege:pose": {"type": "int", "range": [0, 3], "default": 0, "client_sync": True},   # 0 awake, 1 asleep, 2 unconscious, 3 dead
            "siege:emote": {"type": "int", "range": [0, 5], "default": 0, "client_sync": True},  # 1 roar, 2 nuzzle, 3 snarl, 4 head tilt, 5 shake
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
        "minecraft:pushable_by_entity": {}, "minecraft:pushable_by_block": {},  # format 1.26.10+: "minecraft:pushable" is no longer parsed
        "minecraft:breathable": {"total_supply": 15, "suffocate_time": 0},
        "minecraft:follow_range": {"value": 32, "max": 32},
        "minecraft:conditional_bandwidth_optimization": {},
        "minecraft:behavior.float": {"priority": 0},
        "minecraft:behavior.look_at_player": {"priority": 8, "look_distance": 8, "probability": 0.02},
        "minecraft:behavior.random_look_around": {"priority": 9},
    },
    "events": events,
}})

# ---------------------------------------------------------------- species: models + skins
# Four species, all native to the Emberwaste. Same bone names everywhere so one set of animations drives them all.
SPECIES = {  # key: (name, scales, belly, wing membrane, horn, eye)
    "cinderwing": ("Cinderwing", (122, 44, 34), (196, 142, 84), (164, 78, 44), (58, 46, 44), (255, 196, 70)),
    "wyvern": ("Ashen Wyvern", (92, 90, 96), (160, 154, 150), (120, 110, 118), (40, 38, 42), (255, 150, 60)),
    "drake": ("Dune Drake", (176, 142, 84), (222, 200, 150), (198, 150, 96), (90, 66, 44), (120, 220, 200)),
    "wyrm": ("Glass Wyrm", (40, 34, 52), (96, 70, 110), (70, 48, 88), (20, 18, 26), (255, 110, 190)),
}
def palette(k):
    _, scale, belly, wing, horn, eye = SPECIES[k]
    return {"scale": {"c": scale, "style": "stone"}, "belly": {"c": belly, "style": "bone"}, "wing": {"c": wing, "style": "cloth"},
            "horn": {"c": horn, "style": "bone"}, "saddle": {"c": (112, 74, 44), "style": "cloth"}, "eye": eye}

def saddle(m, z=0):
    m.bone("saddle", [0, 20, z], "body")
    m.box("saddle", [-5, 20, z - 5], [10, 1, 9], "saddle")
    m.box("saddle", [-3, 21, z + 2], [6, 2, 2], "saddle")

def wings(m, root_x, y, z, inner, tip, name="wing"):
    """inner / tip = (length, depth). Left is +x. A bone spar runs along the front edge."""
    for side, s in (("l", 1), ("r", -1)):
        il, idp = inner; tl, td = tip
        x0 = root_x if s > 0 else -root_x - il
        x1 = root_x + il if s > 0 else -root_x - il - tl
        m.bone(f"{name}_{side}", [root_x * s, y + 1, z + 2], "body")
        m.box(f"{name}_{side}", [x0, y, z], [il, 1, idp], "wing")
        m.box(f"{name}_{side}", [x0, y, z - 2], [il, 2, 2], "horn")
        if tl:
            m.bone(f"{name}_{side}_tip", [(root_x + il) * s, y + 1, z + 2], f"{name}_{side}")
            m.box(f"{name}_{side}_tip", [x1, y, z], [tl, 1, td], "wing")
            m.box(f"{name}_{side}_tip", [x1, y, z - 2], [tl, 2, 2], "horn")

def legs(m, spec):
    for name, x, z, w, h, d in spec:
        m.bone(name, [x + w / 2, h, z + d / 2], "body")
        m.box(name, [x, 0, z], [w, h, d], "scale")

# The classic: four legs, broad wings, swept horns. The all-rounder with the hottest breath.
def cinderwing(m):
    m.bone("root", [0, 0, 0]); m.bone("body", [0, 14, 0], "root")
    m.box("body", [-6, 10, -10], [12, 10, 22], "scale"); m.box("body", [-5, 9, -9], [10, 1, 20], "belly")
    for i in range(4): m.box("body", [-1, 20, -8 + i * 5], [2, 2, 3], "horn")
    saddle(m)
    m.bone("neck", [0, 17, -10], "body"); m.box("neck", [-3, 14, -17], [6, 7, 8], "scale")
    m.bone("neck2", [0, 20, -17], "neck"); m.box("neck2", [-3, 18, -23], [6, 6, 7], "scale")
    m.bone("head", [0, 22, -23], "neck2")
    m.box("head", [-4, 20, -31], [8, 7, 9], "scale", face="glow"); m.box("head", [-3, 22, -38], [6, 3, 7], "scale")
    m.box("head", [-4, 27, -26], [2, 2, 7], "horn"); m.box("head", [2, 27, -26], [2, 2, 7], "horn")
    m.bone("jaw", [0, 21, -31], "head"); m.box("jaw", [-3, 20, -37], [6, 2, 7], "belly")
    m.bone("tail", [0, 16, 12], "body"); m.box("tail", [-4, 12, 12], [8, 7, 10], "scale")
    m.bone("tail2", [0, 16, 22], "tail"); m.box("tail2", [-3, 13, 22], [6, 5, 10], "scale")
    m.bone("tail3", [0, 16, 32], "tail2"); m.box("tail3", [-2, 14, 32], [4, 3, 10], "scale"); m.box("tail3", [-4, 15, 41], [8, 1, 5], "horn")
    legs(m, (("leg_fl", 4, -9, 4, 11, 6), ("leg_fr", -8, -9, 4, 11, 6), ("leg_bl", 4, 5, 5, 12, 6), ("leg_br", -9, 5, 5, 12, 6)))
    wings(m, 6, 18, -6, (16, 14), (16, 12))

# Two legs, wings for arms, long neck and whip tail. Lean and fast, breaks easily.
def wyvern(m):
    m.bone("root", [0, 0, 0]); m.bone("body", [0, 16, 0], "root")
    m.box("body", [-4, 12, -8], [8, 8, 18], "scale"); m.box("body", [-3, 11, -7], [6, 1, 16], "belly")
    for i in range(6): m.box("body", [-1, 20, -7 + i * 3], [1, 2, 2], "horn")
    saddle(m)
    m.bone("neck", [0, 17, -8], "body"); m.box("neck", [-2, 15, -16], [4, 5, 8], "scale")
    m.bone("neck2", [0, 19, -16], "neck"); m.box("neck2", [-2, 18, -24], [4, 5, 8], "scale")
    m.bone("head", [0, 21, -24], "neck2")
    m.box("head", [-3, 20, -32], [6, 5, 8], "scale", face="glow"); m.box("head", [-2, 21, -39], [4, 3, 7], "scale")
    m.box("head", [-1, 25, -29], [1, 3, 9], "horn")                      # one back-swept crest
    m.bone("jaw", [0, 20, -32], "head"); m.box("jaw", [-2, 19, -38], [4, 1, 7], "belly")
    m.bone("tail", [0, 17, 10], "body"); m.box("tail", [-3, 14, 10], [6, 5, 10], "scale")
    m.bone("tail2", [0, 17, 20], "tail"); m.box("tail2", [-2, 15, 20], [4, 4, 12], "scale")
    m.bone("tail3", [0, 17, 32], "tail2"); m.box("tail3", [-1, 16, 32], [2, 2, 14], "scale"); m.box("tail3", [-3, 16, 45], [6, 1, 5], "horn")
    legs(m, (("leg_bl", 3, 1, 3, 13, 5), ("leg_br", -6, 1, 3, 13, 5)))
    wings(m, 4, 18, -7, (20, 16), (20, 13))
    for s in (1, -1): m.box("wing_l" if s > 0 else "wing_r", [23 if s > 0 else -25, 15, -9], [2, 3, 2], "horn")  # wing claws it walks on

# Low, wide and armoured, with a club tail and stubby wings. Hard to kill, tires quickly in the air.
def drake(m):
    m.bone("root", [0, 0, 0]); m.bone("body", [0, 14, 0], "root")
    m.box("body", [-8, 8, -11], [16, 12, 24], "scale"); m.box("body", [-7, 7, -10], [14, 1, 22], "belly")
    for i in range(5): m.box("body", [-5, 20, -10 + i * 5], [10, 2, 3], "horn")   # back plates
    saddle(m)
    m.bone("neck", [0, 15, -11], "body"); m.box("neck", [-4, 11, -17], [8, 8, 6], "scale")
    m.bone("neck2", [0, 15, -17], "neck"); m.box("neck2", [-4, 12, -20], [8, 7, 3], "scale")
    m.bone("head", [0, 15, -20], "neck2")
    m.box("head", [-5, 12, -29], [10, 8, 9], "scale", face="glow"); m.box("head", [-4, 13, -34], [8, 5, 5], "scale")
    m.box("head", [-1, 18, -34], [2, 4, 2], "horn")                       # nose horn
    m.box("head", [-7, 16, -25], [2, 2, 5], "horn"); m.box("head", [5, 16, -25], [2, 2, 5], "horn")
    m.bone("jaw", [0, 13, -29], "head"); m.box("jaw", [-4, 11, -34], [8, 2, 9], "belly")
    m.bone("tail", [0, 14, 13], "body"); m.box("tail", [-5, 10, 13], [10, 8, 8], "scale")
    m.bone("tail2", [0, 14, 21], "tail"); m.box("tail2", [-4, 11, 21], [8, 6, 8], "scale")
    m.bone("tail3", [0, 14, 29], "tail2"); m.box("tail3", [-3, 12, 29], [6, 4, 6], "scale"); m.box("tail3", [-5, 10, 35], [10, 8, 6], "horn")
    legs(m, (("leg_fl", 6, -10, 6, 8, 7), ("leg_fr", -12, -10, 6, 8, 7), ("leg_bl", 6, 4, 6, 8, 7), ("leg_br", -12, 4, 6, 8, 7)))
    wings(m, 8, 18, -5, (12, 10), (10, 8))

# A long serpent with a raised, frilled head, two small forelegs and two pairs of narrow wings. Stays up longest, frail.
def wyrm(m):
    m.bone("root", [0, 0, 0]); m.bone("body", [0, 16, 0], "root")
    m.box("body", [-4, 12, -14], [8, 8, 30], "scale"); m.box("body", [-3, 11, -13], [6, 1, 28], "belly")
    saddle(m, -2)
    m.bone("neck", [0, 18, -14], "body"); m.box("neck", [-3, 16, -20], [6, 8, 6], "scale")
    m.bone("neck2", [0, 24, -20], "neck"); m.box("neck2", [-3, 22, -24], [6, 8, 5], "scale")
    m.bone("head", [0, 30, -24], "neck2")
    m.box("head", [-4, 28, -32], [8, 6, 9], "scale", face="glow"); m.box("head", [-3, 28, -38], [6, 4, 6], "scale")
    m.box("head", [-9, 27, -24], [5, 9, 1], "wing"); m.box("head", [4, 27, -24], [5, 9, 1], "wing")   # frill
    m.box("head", [-1, 34, -30], [2, 2, 2], "horn")
    m.bone("jaw", [0, 29, -32], "head"); m.box("jaw", [-3, 27, -37], [6, 1, 6], "belly")
    m.bone("tail", [0, 16, 16], "body"); m.box("tail", [-3, 12, 16], [6, 7, 12], "scale")
    m.bone("tail2", [0, 15, 28], "tail"); m.box("tail2", [-3, 12, 28], [6, 6, 12], "scale")
    m.bone("tail3", [0, 15, 40], "tail2"); m.box("tail3", [-2, 13, 40], [4, 4, 14], "scale"); m.box("tail3", [-1, 11, 46], [1, 9, 8], "wing")  # tail fin
    legs(m, (("leg_fl", 4, -11, 2, 12, 3), ("leg_fr", -6, -11, 2, 12, 3)))
    wings(m, 4, 19, -11, (18, 8), (16, 6))
    wings(m, 4, 19, 6, (14, 6), (0, 0), name="wing2")

BUILDERS = {"cinderwing": cinderwing, "wyvern": wyvern, "drake": drake, "wyrm": wyrm}
for old in ("ember", "ash", "sand", "obsidian", ""):   # the first version had one model in four colours
    for path in (RP + f"textures/entity/siege/dragons/dragon_{old}.png", RP + "models/entity/dragons/dragon.geo.json"):
        if os.path.exists(path): os.remove(path)
MODELS = {}
def separate(model):
    # No two cube faces may share a plane (it flickers in game and in the viewers): every cube gets its own tiny inflate.
    base = {"scale": 0.0, "belly": 0.1, "saddle": 0.2, "wing": 0.05, "horn": 0.15}
    n = 0
    for bone in model.bones:
        for c in bone["cubes"]:
            c["inflate"] = round(c.get("inflate", 0) + base.get(c.get("_mat"), 0.0) + 0.003 * n, 3)
            n += 1

for key, build in BUILDERS.items():
    model = Model(key, palette(key), seed=11)
    build(model)
    separate(model)
    geo = model.geometry(f"geometry.siege_dragon.{key}")
    geo["minecraft:geometry"][0]["description"].update({"visible_bounds_width": 14, "visible_bounds_height": 6, "visible_bounds_offset": [0, 1.5, 0]})
    write(RP + f"models/entity/dragons/{key}.geo.json", geo)
    path = RP + f"textures/entity/siege/dragons/{key}.png"
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if not os.path.exists(path): model.texture(palette(key)).save(path)
    MODELS[key] = (model, geo)

ANIMS = ["look", "idle", "walk", "fold", "fly", "breath", "sleep", "downed", "dead", "roar", "nuzzle", "snarl", "tilt", "shake"]
POSE = lambda n: f"query.property('siege:pose') == {n}"
EMOTE = lambda n: f"query.property('siege:pose') == 0 && query.property('siege:emote') == {n}"
write(RP + "entity/dragons/dragon.entity.json", {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
    "identifier": "siege:dragon",
    "materials": {"default": "entity_alphatest"},
    "textures": {k: f"textures/entity/siege/dragons/{k}" for k in SPECIES},
    "geometry": {k: f"geometry.siege_dragon.{k}" for k in SPECIES},
    "animations": {a: f"animation.siege_dragon.{a}" for a in ANIMS},
    "scripts": {"animate": [
        {"look": POSE(0)}, {"idle": POSE(0)},
        {"walk": POSE(0) + " && !query.property('siege:flying')"}, {"fold": "query.property('siege:pose') < 2 && !query.property('siege:flying')"},
        {"fly": "query.property('siege:flying')"}, {"breath": "query.property('siege:breath')"},
        {"sleep": POSE(1)}, {"downed": POSE(2)}, {"dead": POSE(3)},
        {"roar": EMOTE(1)}, {"nuzzle": EMOTE(2)}, {"snarl": EMOTE(3)}, {"tilt": EMOTE(4)}, {"shake": EMOTE(5)}]},
    "render_controllers": ["controller.render.siege_dragon"],
}}})

write(RP + "render_controllers/siege_dragon.render_controllers.json", {"format_version": "1.8.0", "render_controllers": {
    "controller.render.siege_dragon": {
        "arrays": {"textures": {"Array.skins": [f"Texture.{k}" for k in SPECIES]}, "geometries": {"Array.geos": [f"Geometry.{k}" for k in SPECIES]}},
        "geometry": "Array.geos[query.property('siege:species')]",
        "materials": [{"*": "Material.default"}],
        "textures": ["Array.skins[query.property('siege:species')]"],
        "part_visibility": [{"*": True}, {"saddle": "query.property('siege:saddled')"}],
    }}})

# Animations. Everything is a rotation [x, y, z] in degrees (or a position / scale) written as Molang, so the
# 3D viewer can play the very same numbers. T = query.life_time.
SWING = "math.cos(query.modified_distance_moved*30)*query.modified_move_speed*35"
T = "query.life_time"
rot = lambda *v: {"rotation": [str(x) for x in v]}
LIMP_WINGS = {"wing_l": rot(0, 25, -22), "wing_l_tip": rot(0, -40, 30), "wing_r": rot(0, -25, 22), "wing_r_tip": rot(0, 40, -30),
              "wing2_l": rot(0, 30, -20), "wing2_r": rot(0, -30, 20)}
LYING = {"leg_fl": rot(-70, 0, -25), "leg_fr": rot(-70, 0, 25), "leg_bl": rot(75, 0, -25), "leg_br": rot(75, 0, 25),
         "neck": rot(28, 12, 0), "neck2": rot(14, 14, 0), "tail": rot(6, -14, 0), "tail2": rot(4, -18, 0), "tail3": rot(0, -20, 0)}
ANIMATIONS = {
    "look": {"head": rot("query.target_x_rotation*0.6", "query.target_y_rotation*0.5", 0)},
    "idle": {"tail": rot(-6, f"math.sin({T}*50)*8", 0), "tail2": rot(-4, f"math.sin({T}*50-40)*10", 0), "tail3": rot(0, f"math.sin({T}*50-80)*12", 0),
             "neck": rot(f"-18+math.sin({T}*40)*2", 0, 0), "neck2": rot(-14, 0, 0), "head": rot(30, 0, 0),
             "body": {"scale": ["1", f"1+math.sin({T}*70)*0.012", "1"]}},
    "walk": {"leg_fl": rot(SWING, 0, 0), "leg_br": rot(SWING, 0, 0), "leg_fr": rot("-" + SWING, 0, 0), "leg_bl": rot("-" + SWING, 0, 0)},
    # Folded: the arm swings back along the flank, the membrane hangs down from it, and the outer half folds flat over the inner.
    "fold": {"wing_l": rot(-100, -80, 0), "wing_l_tip": rot(0, 0, 170), "wing_r": rot(-100, 80, 0), "wing_r_tip": rot(0, 0, -170),
             "wing2_l": rot(-100, -74, 0), "wing2_r": rot(-100, 74, 0)},
    "fly": {"wing_l": rot(0, 0, f"math.sin({T}*300)*32"), "wing_l_tip": rot(0, 0, f"math.sin({T}*300-50)*28"),
            "wing_r": rot(0, 0, f"-math.sin({T}*300)*32"), "wing_r_tip": rot(0, 0, f"-math.sin({T}*300-50)*28"),
            "wing2_l": rot(0, 0, f"math.sin({T}*300-90)*26"), "wing2_r": rot(0, 0, f"-math.sin({T}*300-90)*26"),
            "body": {"position": ["0", f"math.sin({T}*300)*-1.5", "0"]},
            "leg_fl": rot(40, 0, 0), "leg_fr": rot(40, 0, 0), "leg_bl": rot(55, 0, 0), "leg_br": rot(55, 0, 0)},
    "breath": {"jaw": rot(28, 0, 0)},
    # Asleep: curled, slow deep breathing
    "sleep": {**LYING, "body": {"position": ["0", "-7", "0"], "scale": ["1", f"1+math.sin({T}*45)*0.035", "1"]},
              "neck": rot(30, 35, 0), "neck2": rot(18, 40, 0), "head": rot(-6, 30, 0), "tail": rot(6, 30, 0), "tail2": rot(4, 40, 0), "tail3": rot(0, 45, 0),
              "wing_l": rot(50, 0, 0), "wing_r": rot(50, 0, 0), "wing2_l": rot(50, 0, 0), "wing2_r": rot(50, 0, 0)},   # wings mantle out over the ground
    # Unconscious: sprawled on its side, wings limp, shallow fast breathing you can see
    "downed": {**LYING, **LIMP_WINGS, "root": rot(0, 0, 14), "body": {"position": ["0", "-8", "0"], "scale": ["1", f"1+math.sin({T}*110)*0.03", "1"]},
               "head": rot(-10, 10, 20), "jaw": rot(f"6+math.sin({T}*110)*4", 0, 0)},
    # Dead: the same sprawl, rolled further, jaw slack, nothing moves
    "dead": {**LYING, **LIMP_WINGS, "wing_r": rot(0, -30, -50), "wing_r_tip": rot(0, 60, -40), "wing2_r": rot(0, -30, -50), "root": rot(0, 0, 32), "body": {"position": ["0", "-9", "0"]},
             "head": rot(-4, 18, 38), "jaw": rot(22, 0, 0), "neck": rot(34, 20, 0), "tail3": rot(0, -34, 0)},
    "roar": {"neck": rot(-40, 0, 0), "neck2": rot(-25, 0, 0), "head": rot(f"-20+math.sin({T}*900)*3", 0, 0), "jaw": rot(34, 0, 0),
             "wing_l": rot(80, 45, 0), "wing_r": rot(80, -45, 0), "wing_l_tip": rot(0, 0, -130), "wing_r_tip": rot(0, 0, 130),
             "wing2_l": rot(80, 40, 0), "wing2_r": rot(80, -40, 0)},   # on top of the fold: wings flare half open
    "nuzzle": {"neck": rot(34, 0, 0), "neck2": rot(18, 0, 0), "head": rot(f"10+math.sin({T}*240)*8", 0, f"math.sin({T}*120)*6")},
    "snarl": {"neck": rot(14, 0, 0), "head": rot(18, f"math.sin({T}*500)*4", 0), "jaw": rot(14, 0, 0), "tail": rot(0, f"math.sin({T}*400)*14", 0)},
    "tilt": {"head": rot(0, 0, f"22*math.sin({T}*90)")},
    "shake": {"head": rot(0, f"math.sin({T}*700)*24", 0), "body": {"rotation": ["0", "0", f"math.sin({T}*700)*4"]}},
}
write(RP + "animations/dragon.animation.json", {"format_version": "1.8.0", "animations": {
    f"animation.siege_dragon.{k}": {"loop": True, "bones": v} for k, v in ANIMATIONS.items()}})

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

# ---------------------------------------------------------------- voices (synthesised here, so they are ours)
# Every species has its own throat: pitch, roughness, how much hiss. Files are small mono .ogg.
import numpy as np, subprocess, wave, tempfile
SR = 22050
VOICES = {  # key: (pitch Hz, rasp Hz, hiss 0..1, formants Hz, second voice ratio or 0)
    "cinderwing": (78, 31, 0.25, (420, 900, 2100), 0),
    "wyvern": (150, 46, 0.55, (700, 1700, 3300), 0),
    "drake": (52, 22, 0.15, (300, 650, 1500), 0),
    "wyrm": (104, 12, 0.45, (520, 1250, 2800), 1.5),   # two tones a fifth apart: it never sounds like one animal
}

def shape(x, formants, width=0.35):
    """Push the sound through a throat: boost bands around the formants (done in the frequency domain)."""
    spec = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    gain = np.full_like(f, 0.05)
    for fm in formants: gain += np.exp(-0.5 * ((f - fm) / (fm * width)) ** 2)
    gain *= 1 / (1 + (f / 5200) ** 4)
    return np.fft.irfft(spec * gain, len(x))

def env(n, attack, release, hold=1.0):
    t = np.linspace(0, 1, n)
    return np.clip(t / max(attack, 1e-3), 0, 1) ** 1.5 * np.clip((1 - t) / max(release, 1e-3), 0, 1) ** 1.2 * hold

def growl(voice, seconds, bend=(1.0, 1.0), rough=1.0, hiss_mul=1.0, seed=0, vibrato=0.0):
    pitch, rasp, hiss, formants, second = VOICES[voice]
    r = np.random.default_rng(seed); n = int(SR * seconds); t = np.arange(n) / SR
    f0 = pitch * np.linspace(bend[0], bend[1], n) * (1 + 0.03 * np.cumsum(r.normal(0, 1, n)) / np.sqrt(n)) * (1 + vibrato * np.sin(2 * np.pi * 5.5 * t))
    ph = 2 * np.pi * np.cumsum(f0) / SR
    tone = sum(np.sin(ph * k) / k for k in range(1, 14))                       # a buzzy, saw-like throat
    if second: tone = tone * 0.6 + 0.5 * sum(np.sin(ph * second * k) / k for k in range(1, 9))
    tone *= 1 - rough * 0.5 * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * rasp * t + r.uniform(0, 6))))   # the rasp: the throat rattles
    x = shape(tone, formants) + hiss * hiss_mul * shape(r.normal(0, 1, n), [f * 2.2 for f in formants], 0.6) * 0.5
    return x

def noise(seconds, lo, hi, seed=0):
    r = np.random.default_rng(seed); n = int(SR * seconds)
    spec = np.fft.rfft(r.normal(0, 1, n)); f = np.fft.rfftfreq(n, 1 / SR)
    spec *= np.exp(-0.5 * ((f - (lo + hi) / 2) / ((hi - lo) / 2)) ** 2)
    return np.fft.irfft(spec, n)

def save_sound(name, x, volume=0.9):
    path = RP + f"sounds/siege/dragon/{name}.ogg"
    if os.path.exists(path): return
    os.makedirs(os.path.dirname(path), exist_ok=True)
    x = x / (np.max(np.abs(x)) + 1e-9) * volume
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp: wav = tmp.name
    with wave.open(wav, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((x * 32767).astype("<i2").tobytes())
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-c:a", "libvorbis", "-q:a", "3", path], check=True)
    os.remove(wav)

VOICED = ["idle", "roar", "hurt", "purr", "snarl", "whimper", "death", "chirp"]
for i, v in enumerate(VOICES):
    save_sound(f"{v}_idle", growl(v, 1.6, (0.9, 0.8), 0.9, seed=i) * env(int(SR * 1.6), 0.25, 0.5), 0.6)
    save_sound(f"{v}_roar", growl(v, 2.4, (1.0, 1.9), 0.6, 1.6, seed=i + 10)[: int(SR * 2.4)] * env(int(SR * 2.4), 0.08, 0.55)
               + np.pad(growl(v, 1.2, (1.9, 1.2), 0.8, seed=i + 11) * env(int(SR * 1.2), 0.3, 0.6) * 0.5, (int(SR * 1.2), 0)))
    save_sound(f"{v}_hurt", growl(v, 0.6, (2.2, 1.3), 0.4, 1.8, seed=i + 20) * env(int(SR * 0.6), 0.03, 0.7))
    purr_t = np.arange(int(SR * 2.2)) / SR
    save_sound(f"{v}_purr", growl(v, 2.2, (0.55, 0.55), 1.0, 0.2, seed=i + 30) * (0.55 + 0.45 * np.sin(2 * np.pi * 1.1 * purr_t)) * env(len(purr_t), 0.2, 0.3), 0.5)
    save_sound(f"{v}_snarl", growl(v, 1.1, (1.1, 1.4), 1.0, 2.0, seed=i + 40) * env(int(SR * 1.1), 0.1, 0.35), 0.8)
    save_sound(f"{v}_whimper", growl(v, 0.9, (2.6, 1.9), 0.1, 0.3, seed=i + 50, vibrato=0.04) * env(int(SR * 0.9), 0.2, 0.6), 0.45)
    save_sound(f"{v}_death", growl(v, 3.0, (1.5, 0.45), 0.7, 1.2, seed=i + 60) * env(int(SR * 3.0), 0.05, 0.85))
    chirp = np.concatenate([growl(v, 0.16, (5.0, 7.0), 0.0, 0.2, seed=i + 70 + k) * env(int(SR * 0.16), 0.15, 0.6) for k in range(3)])
    save_sound(f"{v}_chirp", chirp, 0.5)
n = int(SR * 0.55)
save_sound("flap", noise(0.55, 60, 900, 1) * env(n, 0.25, 0.6) + 0.5 * np.pad(noise(0.2, 300, 2500, 2) * env(int(SR * 0.2), 0.1, 0.8), (int(SR * 0.3), n - int(SR * 0.3) - int(SR * 0.2))), 0.7)
n = int(SR * 1.8)
save_sound("fire", (noise(1.8, 200, 3800, 3) * (0.8 + 0.2 * np.sin(2 * np.pi * 27 * np.arange(n) / SR)) + 0.6 * noise(1.8, 40, 220, 4)) * env(n, 0.06, 0.5))
n = int(SR * 2.6)
save_sound("breathe", noise(2.6, 150, 1100, 5) * (np.sin(np.pi * np.arange(n) / n) ** 2) * (0.7 + 0.3 * np.sin(2 * np.pi * 19 * np.arange(n) / SR)), 0.35)   # one slow breath in and out
save_sound("egg_crack", np.concatenate([noise(0.07, 1500, 6000, 6 + k) * env(int(SR * 0.07), 0.02, 0.9) * (1 - k * 0.2) for k in range(4)]), 0.7)

def sound_defs(d):
    d.setdefault("format_version", "1.14.0")
    defs = d.setdefault("sound_definitions", {})
    for v in VOICES:
        for kind in VOICED:
            defs[f"siege.dragon.{v}.{kind}"] = {"category": "neutral", "max_distance": 64 if kind in ("roar", "death") else 24,
                                               "sounds": [{"name": f"sounds/siege/dragon/{v}_{kind}", "volume": 1.0}]}
    for kind in ("flap", "fire", "breathe", "egg_crack"):
        defs[f"siege.dragon.{kind}"] = {"category": "neutral", "max_distance": 32, "sounds": [{"name": f"sounds/siege/dragon/{kind}", "volume": 1.0}]}
merge_json(RP + "sounds/sound_definitions.json", sound_defs, {})

def sounds(d):
    # Voices are played by the script (they depend on species, age and mood), so the entity itself only has footsteps
    d.setdefault("entity_sounds", {}).setdefault("entities", {})["siege:dragon"] = {"volume": 1.0, "pitch": [0.7, 0.9], "events": {"step": "mob.ravager.step"}}
merge_json(RP + "sounds.json", sounds, {})

LANG = {f"item.siege:{k}.name": v[0] for k, v in ITEMS.items()}
LANG.update({f"tile.{ident}.name": v[0] for ident, v in BLOCKS.items()})
LANG["entity.siege:dragon.name"] = "Dragon"
p = RP + "texts/en_US.lang"
lines = [l for l in open(p).read().splitlines() if l.split("=")[0] not in LANG] + [f"{k}={v}" for k, v in LANG.items()]
open(p, "w").write("\n".join(lines) + "\n")

# ---------------------------------------------------------------- data for the 3D viewer (studio/dragon_viewer.py turns it into a page)
import base64
def b64(path): return "data:image/png;base64," + base64.b64encode(open(path, "rb").read()).decode()
viewer = {"species": [{"key": k, "name": SPECIES[k][0], "geo": MODELS[k][1]["minecraft:geometry"][0],
                       "texture": b64(RP + f"textures/entity/siege/dragons/{k}.png")} for k in SPECIES],
          "animations": ANIMATIONS, "stages": STAGES,
          "blocks": {name: {"side": b64(RP + f"textures/blocks/dragons/{tex}_side.png"), "top": b64(RP + f"textures/blocks/dragons/{tex}_top.png")}
                     for name, tex in (("Dragon Roost", "siege_dragon_roost"), ("Dragon Nest", "siege_dragon_nest"))},
          "items": {ITEMS[k][0]: b64(RP + f"textures/items/dragons/siege_{k}.png") for k in ITEMS}}
os.makedirs("studio/dragon_viewer", exist_ok=True)
json.dump(viewer, open("studio/dragon_viewer/data.json", "w"))

# ---------------------------------------------------------------- optional preview sheet (cube rotations ignored: wings shown spread)
if len(sys.argv) > 1:
    import render
    tiles = [render.render({"id": k, "pal": palette(k), "model": BUILDERS[k]}, size=420) for k in SPECIES]
    sheet = Image.new("RGBA", (840, 840), (36, 38, 44, 255))
    for i, t in enumerate(tiles): sheet.alpha_composite(t, ((i % 2) * 420, (i // 2) * 420))
    sheet.save(sys.argv[1])
print("Dragons built.")
