#!/usr/bin/env python3
"""Horses and rail network pack files (The Hollow Crown).
Writes the steed entity (BP + RP), items, blocks, recipes and placeholder textures, then merges the
names and texture entries into the shared files (terrain_texture.json, item_texture.json, blocks.json,
sounds.json, en_US.lang) without touching anyone else's entries. Safe to run again.
Run from anywhere:  python3 studio/build_horses.py
The stat numbers must match Siege_Nights_BP/scripts/horses/data.js."""
import json, os, random
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + "/"
RP = ROOT + "Siege_Nights_RP/"; BP = ROOT + "Siege_Nights_BP/"
rnd = random.Random(7)

SPEED = [0.19, 0.22, 0.25, 0.28, 0.31, 0.335, 0.36, 0.385, 0.41]
JUMP = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1]
HEALTH = [18, 22, 26, 30, 34, 40, 46]

def write(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")

# ---------------------------------------------------------------- the steed entity (behavior)
groups, events = {}, {}

def ladder(prefix, values, component):
    names = [f"siege:{prefix}_{i + 1}" for i in range(len(values))]
    for name, value in zip(names, values):
        groups[name] = {component: {"value": value, "max": value} if prefix == "health" else {"value": value}}
        events[name] = {"sequence": [{"remove": {"component_groups": [n for n in names if n != name]}}, {"add": {"component_groups": [name]}}]}

ladder("speed", SPEED, "minecraft:movement")
ladder("jump", JUMP, "minecraft:horse.jump_strength")
ladder("health", HEALTH, "minecraft:health")

def choice(prefix, options):
    """Mutually exclusive groups: event siege:<prefix>_<key> turns one on and the rest off."""
    names = {k: f"siege:{prefix}_{k}" for k in options}
    for k, comps in options.items():
        if comps is not None:
            groups[names[k]] = comps
        others = [names[o] for o in options if o != k and options[o] is not None]
        seq = [{"remove": {"component_groups": others}}] if others else []
        if comps is not None:
            seq.append({"add": {"component_groups": [names[k]]}})
        events[names[k]] = {"sequence": seq} if seq else {}

choice("scale", {
    "normal": {"minecraft:scale": {"value": 1.0}},
    "foal": {"minecraft:scale": {"value": 0.5}},
    "pony": {"minecraft:scale": {"value": 0.9}},
    "war": {"minecraft:scale": {"value": 1.12}},
})
choice("ds", {
    "none": None,
    "nofall": {"minecraft:damage_sensor": {"triggers": [{"cause": "fall", "deals_damage": "no"}]}},
    "protected": {"minecraft:damage_sensor": {"triggers": [{"cause": "all", "deals_damage": "no"}]}},
})

def toggle(key, comps, on, off):
    groups[f"siege:{key}"] = comps
    events[on] = {"add": {"component_groups": [f"siege:{key}"]}}
    events[off] = {"remove": {"component_groups": [f"siege:{key}"]}}

toggle("fireproof", {"minecraft:fire_immune": {}}, "siege:fireproof_on", "siege:fireproof_off")
toggle("tideborn", {
    "minecraft:buoyant": {"base_buoyancy": 1.0, "apply_gravity": False, "simulate_waves": False,
                          "liquid_blocks": ["minecraft:water", "minecraft:flowing_water"]},
    "minecraft:breathable": {"total_supply": 90, "suffocate_time": 0},
    "minecraft:behavior.float": {"priority": 0, "time_under_water_to_dismount_passengers": 600.0},
}, "siege:tideborn_on", "siege:tideborn_off")
toggle("nervous", {"minecraft:behavior.panic": {"priority": 3, "speed_multiplier": 1.2}}, "siege:skittish", "siege:calm")

groups["siege:foal"] = {"minecraft:is_baby": {}}
groups["siege:adult"] = {
    "minecraft:rideable": {
        "seat_count": 1, "crouching_skip_interact": True, "family_types": ["player"],
        "interact_text": "action.interact.ride.horse", "seats": [{"position": [0.0, 1.1, -0.2]}],
    },
}
groups["siege:saddled"] = {
    "minecraft:is_saddled": {}, "minecraft:input_ground_controlled": {}, "minecraft:can_power_jump": {},
    "minecraft:behavior.player_ride_tamed": {},
}
events["siege:become_foal"] = {"sequence": [{"remove": {"component_groups": ["siege:adult"]}}, {"add": {"component_groups": ["siege:foal"]}}]}
events["siege:grow_up"] = {"sequence": [{"remove": {"component_groups": ["siege:foal"]}}, {"add": {"component_groups": ["siege:adult"]}}]}
events["siege:on_saddled"] = {"add": {"component_groups": ["siege:saddled"]}}
events["siege:on_unsaddled"] = {"remove": {"component_groups": ["siege:saddled"]}}
events["minecraft:entity_spawned"] = {"add": {"component_groups": ["siege:adult", "siege:nervous"]}}

ARMOR = ["horsearmorleather", "horsearmoriron", "horsearmorgold", "horsearmordiamond",
         "minecraft:copper_horse_armor", "minecraft:netherite_horse_armor"]
steed = {
    "format_version": "1.21.60",
    "minecraft:entity": {
        "description": {
            "identifier": "siege:steed", "runtime_identifier": "minecraft:horse",
            "is_spawnable": False, "is_summonable": True,
            "properties": {
                "siege:coat": {"type": "int", "range": [0, 6], "default": 3, "client_sync": True},
                "siege:mark": {"type": "int", "range": [0, 4], "default": 0, "client_sync": True},
                "siege:special": {"type": "int", "range": [0, 2], "default": 0, "client_sync": True},
                "siege:cap": {"type": "bool", "default": False, "client_sync": True},
                "siege:cap_r": {"type": "float", "range": [0.0, 1.0], "default": 1.0, "client_sync": True},
                "siege:cap_g": {"type": "float", "range": [0.0, 1.0], "default": 1.0, "client_sync": True},
                "siege:cap_b": {"type": "float", "range": [0.0, 1.0], "default": 1.0, "client_sync": True},
            },
        },
        "component_groups": groups,
        "components": {
            "minecraft:is_hidden_when_invisible": {},
            "minecraft:type_family": {"family": ["horse", "siege_steed", "mob"]},
            "minecraft:is_tamed": {},
            "minecraft:persistent": {},
            "minecraft:collision_box": {"width": 1.4, "height": 1.6},
            "minecraft:breathable": {"total_supply": 15, "suffocate_time": 0},
            "minecraft:health": {"value": HEALTH[0], "max": HEALTH[0]},
            "minecraft:movement": {"value": SPEED[0]},
            "minecraft:horse.jump_strength": {"value": JUMP[0]},
            "minecraft:navigation.walk": {"can_path_over_water": True, "avoid_water": True, "avoid_damage_blocks": True},
            "minecraft:movement.basic": {},
            "minecraft:jump.static": {},
            "minecraft:nameable": {},
            "minecraft:leashable": {},
            "minecraft:physics": {},
            "minecraft:pushable": {"is_pushable": True, "is_pushable_by_piston": True},
            "minecraft:hurt_on_condition": {"damage_conditions": [
                {"filters": {"test": "in_lava", "subject": "self"}, "cause": "lava", "damage_per_tick": 4}]},
            "minecraft:inventory": {"inventory_size": 2, "container_type": "horse"},
            "minecraft:equippable": {"slots": [
                {"slot": 0, "item": "saddle", "accepted_items": ["saddle"],
                 "on_equip": {"event": "siege:on_saddled"}, "on_unequip": {"event": "siege:on_unsaddled"}},
                {"slot": 1, "item": "horsearmoriron", "accepted_items": ARMOR},
            ]},
            "minecraft:healable": {"items": [
                {"item": "wheat", "heal_amount": 2}, {"item": "sugar", "heal_amount": 1}, {"item": "hay_block", "heal_amount": 20},
                {"item": "apple", "heal_amount": 3}, {"item": "carrot", "heal_amount": 3}, {"item": "golden_carrot", "heal_amount": 4},
                {"item": "golden_apple", "heal_amount": 10}]},
            "minecraft:behavior.float": {"priority": 0},
            "minecraft:behavior.tempt": {"priority": 5, "speed_multiplier": 1.2, "items": ["golden_apple", "golden_carrot"]},
            "minecraft:behavior.random_stroll": {"priority": 6, "speed_multiplier": 0.7},
            "minecraft:behavior.look_at_player": {"priority": 7, "look_distance": 6.0, "probability": 0.02},
            "minecraft:behavior.random_look_around": {"priority": 8},
        },
        "events": events,
    },
}
write(BP + "entities/steed.json", steed)

# ---------------------------------------------------------------- the steed entity (resources)
write(RP + "entity/steed.entity.json", {
    "format_version": "1.10.0",
    "minecraft:client_entity": {"description": {
        "identifier": "siege:steed",
        "min_engine_version": "1.17.10",
        "materials": {"default": "horse_leather_armor"},
        "textures": {
            "base_white": "textures/entity/horse2/horse_white", "base_creamy": "textures/entity/horse2/horse_creamy",
            "base_chestnut": "textures/entity/horse2/horse_chestnut", "base_brown": "textures/entity/horse2/horse_brown",
            "base_black": "textures/entity/horse2/horse_black", "base_gray": "textures/entity/horse2/horse_gray",
            "base_darkbrown": "textures/entity/horse2/horse_darkbrown",
            "markings_none": "textures/entity/horse2/horse_markings_none", "markings_white": "textures/entity/horse2/horse_markings_white",
            "markings_whitefield": "textures/entity/horse2/horse_markings_whitefield",
            "markings_whitedots": "textures/entity/horse2/horse_markings_whitedots",
            "markings_blackdots": "textures/entity/horse2/horse_markings_blackdots",
            "armor_none": "textures/entity/horse2/armor/horse_armor_none", "armor_leather": "textures/entity/horse2/armor/horse_armor_leather",
            "armor_iron": "textures/entity/horse2/armor/horse_armor_iron", "armor_gold": "textures/entity/horse2/armor/horse_armor_gold",
            "armor_diamond": "textures/entity/horse2/armor/horse_armor_diamond", "armor_copper": "textures/entity/horse2/armor/horse_armor_copper",
            "armor_netherite": "textures/entity/horse2/armor/horse_armor_netherite",
            "caparison": "textures/entity/horse2/armor/horse_armor_leather",
        },
        "geometry": {"default": "geometry.horse.v3"},
        "animations": {
            "walk": "animation.horse.v3.walk", "eat": "animation.horse.v3.eat", "rear": "animation.horse.v3.rear",
            "tail": "animation.horse.v3.tail", "look_at_player": "animation.horse.v3.look_at_player",
        },
        "scripts": {
            "initialize": ["variable.eat_anim = 0.0;"],
            "pre_animation": [
                "variable.armor_texture_slot = query.armor_texture_slot(4);",
                "variable.eat_anim = math.clamp(variable.eat_anim + (query.is_grazing ? ((1.0 - variable.eat_anim) * 0.4 + 0.05) : -variable.eat_anim * 0.4 - 0.05) * query.delta_time * 20.0, 0.0, 1.0);",
                "variable.head_x_rot = query.target_x_rotation + (query.modified_move_speed > 0.2 ? (math.cos(query.modified_distance_moved * 11.46) * 11.46 * query.modified_move_speed + query.modified_move_speed * 11.46) : 0.0);",
                "variable.inverse_max_stand_eat = (1.0 - math.max(variable.stand_anim, variable.eat_anim));",
                "variable.leg_stand_factor = math.cos((query.modified_distance_moved * 38.38) + 180.0);",
                "variable.leg_x_rot_anim = variable.leg_stand_factor * 45.8 * query.modified_move_speed;",
            ],
            "animate": ["walk", "look_at_player", {"rear": "variable.stand_anim > 0.0"}, {"eat": "!query.is_standing"}, {"tail": "variable.shake_tail"}],
        },
        "render_controllers": ["controller.render.siege_steed"],
    }},
})
CAP = "query.property('siege:cap')"
write(RP + "render_controllers/siege_steed.render_controllers.json", {
    "format_version": "1.8.0",
    "render_controllers": {"controller.render.siege_steed": {
        "part_visibility": [
            {"Saddle": "query.is_saddled"}, {"Bit*": "query.is_saddled"}, {"Bridle": "query.is_saddled"},
            {"Reins*": "query.is_saddled && query.has_rider"}, {"Bag*": False}, {"MuleEar*": False},
        ],
        "arrays": {"textures": {
            "Array.base": ["Texture.base_white", "Texture.base_creamy", "Texture.base_chestnut", "Texture.base_brown",
                           "Texture.base_black", "Texture.base_gray", "Texture.base_darkbrown"],
            "Array.markings": ["Texture.markings_none", "Texture.markings_white", "Texture.markings_whitefield",
                               "Texture.markings_whitedots", "Texture.markings_blackdots"],
            "Array.armor": ["Texture.armor_none", "Texture.armor_leather", "Texture.armor_iron", "Texture.armor_gold",
                            "Texture.armor_diamond", "Texture.armor_copper", "Texture.armor_netherite"],
        }},
        "geometry": "Geometry.default",
        "materials": [{"*": "Material.default"}],
        "textures": [
            "Array.base[query.property('siege:coat')]",
            "Array.markings[query.property('siege:mark')]",
            f"variable.armor_texture_slot ? Array.armor[variable.armor_texture_slot] : ({CAP} ? Texture.caparison : Texture.armor_none)",
        ],
        "color": {
            "r": f"variable.armor_texture_slot ? query.armor_color_slot(4, 0) : ({CAP} ? query.property('siege:cap_r') : this)",
            "g": f"variable.armor_texture_slot ? query.armor_color_slot(4, 1) : ({CAP} ? query.property('siege:cap_g') : this)",
            "b": f"variable.armor_texture_slot ? query.armor_color_slot(4, 2) : ({CAP} ? query.property('siege:cap_b') : this)",
            "a": f"variable.armor_texture_slot ? query.armor_color_slot(4, 3) : this",
        },
        # The Glimstrider: a pale, ghostly wash until it gets its own texture
        "overlay_color": {"r": "0.72", "g": "0.95", "b": "1.0", "a": "query.property('siege:special') == 2 ? 0.55 : 0.0"},
    }},
})

# ---------------------------------------------------------------- items
ITEMS = {
    "halter": ("Halter", 1), "horse_whistle": ("Horse Whistle", 1), "riding_crop": ("Riding Crop", 1),
    "horseshoes_iron": ("Iron Horseshoes", 16), "horseshoes_diamond": ("Diamond Horseshoes", 16),
    "horseshoes_netherite": ("Netherite Horseshoes", 16),
    "saddlecloth_padded": ("Padded Saddlecloth", 16), "saddle_cavalry": ("Cavalry Saddle Kit", 16),
    "saddle_royal": ("Royal Saddle Kit", 16), "caparison": ("Caparison", 16),
}
for key, (name, stack) in ITEMS.items():
    comps = {"minecraft:icon": f"siege_{key}", "minecraft:display_name": {"value": f"item.siege:{key}.name"},
             "minecraft:max_stack_size": stack}
    if key == "horseshoes_netherite":
        comps["minecraft:fire_resistant"] = {}
    write(BP + f"items/horses/{key}.json", {"format_version": "1.21.60", "minecraft:item": {
        "description": {"identifier": f"siege:{key}", "menu_category": {"category": "equipment"}}, "components": comps}})

# ---------------------------------------------------------------- blocks
BLOCKS = {
    "siege:stables": ("Stables", "siege_stables", "wood", 2.5, "#8a6a3a"),
    "siege:rail_depot": ("Rail Depot", "siege_rail_depot", "wood", 2.5, "#6b5a4a"),
    "hc:station_post": ("Station Post", "siege_station_post", "stone", None, "#b08a3a"),
    "hc:breeder_post": ("Breeder's Post", "siege_breeder_post", "wood", None, "#9a7a4a"),
}
for ident, (name, tex, sound, seconds, color) in BLOCKS.items():
    short = ident.split(":")[1]
    comps = {
        "minecraft:display_name": f"tile.{ident}.name",
        "minecraft:geometry": "minecraft:geometry.full_block",
        "minecraft:material_instances": {
            "*": {"texture": f"{tex}_side", "render_method": "opaque"},
            "up": {"texture": f"{tex}_top", "render_method": "opaque"},
            "down": {"texture": f"{tex}_top", "render_method": "opaque"},
        },
        "minecraft:map_color": color,
    }
    if seconds is None:  # placed by the map builder: survival players can't break it
        comps["minecraft:destructible_by_mining"] = False
        comps["minecraft:destructible_by_explosion"] = False
        comps["minecraft:light_emission"] = 6
    else:
        comps["minecraft:destructible_by_mining"] = {"seconds_to_destroy": seconds}
        comps["minecraft:destructible_by_explosion"] = {"explosion_resistance": 6}
    write(BP + f"blocks/travel/{short}.json", {"format_version": "1.21.60", "minecraft:block": {
        "description": {"identifier": ident, "menu_category": {"category": "items"}}, "components": comps}})

# ---------------------------------------------------------------- recipes (all at the Siege Workshop)
I = lambda item: {"item": item}
def shaped(key, pattern, keys, result, count=1):
    write(BP + f"recipes/horses/{key}.json", {"format_version": "1.20.10", "minecraft:recipe_shaped": {
        "description": {"identifier": f"siege:{key}_recipe"}, "tags": ["siege_workshop"], "pattern": pattern,
        "key": keys, "result": {"item": result, "count": count}, "unlock": {"context": "AlwaysUnlocked"}}})
def shapeless(key, ingredients, result):
    write(BP + f"recipes/horses/{key}.json", {"format_version": "1.20.10", "minecraft:recipe_shapeless": {
        "description": {"identifier": f"siege:{key}_recipe"}, "tags": ["siege_workshop"], "ingredients": ingredients,
        "result": {"item": result, "count": 1}, "unlock": {"context": "AlwaysUnlocked"}}})

PLANKS = {"tag": "minecraft:planks"}
shaped("halter", ["LSL", "L L", " N "], {"L": I("minecraft:leather"), "S": I("minecraft:string"), "N": I("minecraft:iron_nugget")}, "siege:halter")
shaped("horse_whistle", [" BN", " BB", "S  "], {"B": I("minecraft:bamboo"), "N": I("minecraft:iron_nugget"), "S": I("minecraft:string")}, "siege:horse_whistle")
shaped("riding_crop", ["  L", " S ", "S  "], {"L": I("minecraft:leather"), "S": I("minecraft:stick")}, "siege:riding_crop")
shaped("horseshoes_iron", ["I I", "I I", " N "], {"I": I("minecraft:iron_ingot"), "N": I("minecraft:iron_nugget")}, "siege:horseshoes_iron")
shapeless("horseshoes_diamond", [I("siege:horseshoes_iron"), I("minecraft:diamond"), I("minecraft:diamond")], "siege:horseshoes_diamond")
shapeless("horseshoes_netherite", [I("siege:horseshoes_diamond"), I("minecraft:netherite_ingot")], "siege:horseshoes_netherite")
shaped("saddlecloth_padded", ["WWW", "L L"], {"W": {"tag": "minecraft:wool"}, "L": I("minecraft:leather")}, "siege:saddlecloth_padded")
shapeless("saddle_cavalry", [I("siege:saddlecloth_padded"), I("minecraft:leather")] + [I("minecraft:iron_ingot")] * 4, "siege:saddle_cavalry")
shapeless("saddle_royal", [I("siege:saddle_cavalry")] + [I("minecraft:diamond")] * 2 + [I("minecraft:gold_ingot")] * 2, "siege:saddle_royal")
shaped("caparison", ["WBW", "WSW"], {"W": {"tag": "minecraft:wool"}, "B": I("minecraft:banner"), "S": I("minecraft:string")}, "siege:caparison")
shaped("stables", ["HHH", "FSF", "PPP"], {"H": I("minecraft:hay_block"), "F": I("minecraft:oak_fence"),
                                             "S": I("minecraft:saddle"), "P": PLANKS}, "siege:stables")
shaped("rail_depot", ["RCR", "PIP", "PPP"], {"R": I("minecraft:rail"), "C": I("minecraft:minecart"), "I": I("minecraft:iron_ingot"), "P": PLANKS}, "siege:rail_depot")

# ---------------------------------------------------------------- placeholder textures (real art comes in the texture pass)
def cl(c): return tuple(max(0, min(255, int(v))) for v in c)
def shade(c, k): return cl([v * k for v in c])
def noisy(c, a=8):
    n = rnd.randint(-a, a); return cl([v + n for v in c])

def icon(path, rows, palette):
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in palette:
                img.putpixel((x, y), noisy(palette[ch], 5) + (255,))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if not os.path.exists(path):  # never paint a placeholder over final art
        img.save(path)

SHOE = ["................", "...oooo..oooo...", "..oMMMo..oMMMo..", "..oMhMo..oMhMo..", "..oMhMo..oMhMo..", "..oMhMo..oMhMo..",
        "..oMhMo..oMhMo..", "..oMhMo..oMhMo..", "..oMhMoooooMhMo.".ljust(16, "."), "..oMhMMMMMMhMo..", "..oMMhhhhhhMMo..", "...oMMMMMMMMo...",
        "....oooooooo....", "................", "................", "................"]
SHOE = [r[:16] for r in SHOE]
for tier, metal in {"iron": (198, 198, 204), "diamond": (110, 222, 214), "netherite": (74, 66, 72)}.items():
    icon(RP + f"textures/items/horses/siege_horseshoes_{tier}.png", SHOE, {"o": shade(metal, 0.45), "M": metal, "h": shade(metal, 1.2)})

SADDLE = ["................", "................", "....oooooooo....", "...oCCCCCCCCo...", "..oCCTTTTTTCCo..", "..oCTTTTTTTTCo..",
          "..oCCCCCCCCCCo..", "..oLLLLLLLLLLo..", "..oLLoooooLLLo..".ljust(16, "."), "...oLo...oLLo...", "...oSo...oSSo...", "...oSo....oo....",
          "...oSo..........", "....o...........", "................", "................"]
SADDLE = [r[:16] for r in SADDLE]
for key, (cloth, trim) in {"saddlecloth_padded": ((176, 150, 110), (150, 120, 84)), "saddle_cavalry": ((120, 78, 44), (190, 190, 196)),
                           "saddle_royal": ((124, 38, 46), (228, 190, 72))}.items():
    icon(RP + f"textures/items/horses/siege_{key}.png", SADDLE, {"o": (40, 28, 20), "C": cloth, "T": trim, "L": (112, 74, 44), "S": (190, 190, 196)})

icon(RP + "textures/items/horses/siege_halter.png", [
    "................", "....oooooo......", "...oLLLLLLo.....", "..oLo....oLo....", "..oLo....oLo....", "..oLo....oLoo...", "..oLLo..oLLLLo..",
    "...oLLooLLooLo..", "....oLLLLo.oLo..", ".....oLLo..oMo..", "......oLo.oMMo..", "......oLo..oo...", "......oMo.......", ".......o........",
    "................", "................"], {"o": (40, 28, 20), "L": (124, 82, 48), "M": (198, 198, 204)})
icon(RP + "textures/items/horses/siege_horse_whistle.png", [
    "................", "................", "...........ooo..", "..........oMMMo.", ".........oBBMo..", "........oBBBo...", ".......oBDBo....",
    "......oBBBo.....", ".....oBDBo......", "....oBBBo.......", "...oSBBo........", "..oS.oo.........", "..oS............", "...o............",
    "................", "................"], {"o": (50, 44, 24), "B": (196, 178, 96), "D": (120, 104, 50), "M": (198, 198, 204), "S": (230, 230, 226)})
icon(RP + "textures/items/horses/siege_riding_crop.png", [
    "................", "............ooo.", "...........oLLLo", "...........oLLo.", "..........oSoo..", ".........oSo....", "........oSo.....",
    ".......oSo......", "......oSo.......", ".....oSo........", "....oSo.........", "...oHo..........", "..oHHo..........", "..oHo...........",
    "...o............", "................"], {"o": (30, 22, 16), "S": (92, 62, 38), "L": (140, 92, 54), "H": (60, 40, 28)})
icon(RP + "textures/items/horses/siege_caparison.png", [
    "................", "..oooooooooooo..", ".oWWWWWWWWWWWWo.", ".oWRRRWWWWRRRWo.", ".oWRRRWWWWRRRWo.", ".oWWWWWWWWWWWWo.", ".oWWWGGGGGGWWWo.",
    ".oWWWGWWWWGWWWo.", ".oWWWGGGGGGWWWo.", ".oWWWWWWWWWWWWo.", ".oWoWWoWWoWWoWo.", ".oW.oW.oW.oW.o..", "..o..o..o..o....", "................",
    "................", "................"], {"o": (60, 56, 56), "W": (232, 230, 222), "R": (161, 39, 34), "G": (222, 180, 70)})

def block_tex(path, paint):
    img = Image.new("RGBA", (16, 16))
    for y in range(16):
        for x in range(16):
            img.putpixel((x, y), noisy(paint(x, y), 6) + (255,))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if not os.path.exists(path):  # never paint a placeholder over final art
        img.save(path)

PL, PD, HAY, HD = (150, 112, 66), (104, 76, 44), (204, 170, 60), (160, 128, 40)
STONE, SD, IRON, GOLDC = (126, 126, 130), (86, 86, 92), (198, 198, 204), (222, 180, 70)
plank = lambda x, y: PD if y % 4 == 3 or (x + (y // 4) * 5) % 8 == 0 else PL
T = RP + "textures/blocks/travel/"
block_tex(T + "siege_stables_side.png", lambda x, y: (PD if x in (0, 15) or y in (0, 15) else HD if (x + y) % 3 == 0 and 3 < y < 12 else HAY if 3 < y < 12 else plank(x, y)))
block_tex(T + "siege_stables_top.png", lambda x, y: PD if x in (0, 15) or y in (0, 15) else HD if (x * 3 + y) % 4 == 0 else HAY)
block_tex(T + "siege_rail_depot_side.png", lambda x, y: (PD if x in (0, 15) or y in (0, 15) else IRON if y in (5, 10) and 2 < x < 13 else SD if x in (4, 8, 12) and 4 < y < 12 else plank(x, y)))
block_tex(T + "siege_rail_depot_top.png", lambda x, y: (PD if x in (0, 15) or y in (0, 15) else IRON if x in (5, 10) else PD if y % 4 == 1 else STONE))
block_tex(T + "siege_station_post_side.png", lambda x, y: (SD if x in (0, 15) or y in (0, 15) else GOLDC if 4 <= y <= 9 and 3 <= x <= 12 and (y in (4, 9) or x in (3, 12)) else (40, 44, 60) if 4 < y < 9 and 3 < x < 12 else STONE))
block_tex(T + "siege_station_post_top.png", lambda x, y: (SD if x in (0, 15) or y in (0, 15) else GOLDC if abs(x - 7.5) + abs(y - 7.5) < 3 else STONE))
block_tex(T + "siege_breeder_post_side.png", lambda x, y: (PD if x in (0, 15) or y in (0, 15) else (236, 226, 200) if 3 < x < 12 and 3 < y < 11 and not (5 < x < 10 and 5 < y < 9) else (124, 82, 48) if 5 < x < 10 and 5 < y < 9 else plank(x, y)))
block_tex(T + "siege_breeder_post_top.png", lambda x, y: PD if x in (0, 15) or y in (0, 15) else HAY if (x + y) % 5 < 2 else plank(x, y))

# ---------------------------------------------------------------- merge into the shared files (read again right before writing)
def merge_json(path, change, default):
    data = json.load(open(path)) if os.path.exists(path) else default
    change(data)
    write(path, data)

def terrain(d):
    for _, tex, *_ in BLOCKS.values():
        for face in ("side", "top"):
            d["texture_data"][f"{tex}_{face}"] = {"textures": f"textures/blocks/travel/{tex}_{face}"}
merge_json(RP + "textures/terrain_texture.json", terrain, {"resource_pack_name": "siege_nights", "texture_name": "atlas.terrain", "texture_data": {}})

def item_tex(d):
    for key in ITEMS:
        d["texture_data"][f"siege_{key}"] = {"textures": f"textures/items/horses/siege_{key}"}
merge_json(RP + "textures/item_texture.json", item_tex, {"resource_pack_name": "siege_nights", "texture_name": "atlas.items", "texture_data": {}})

def block_sounds(d):
    for ident, (_, _, sound, *_ ) in BLOCKS.items():
        d[ident] = {"sound": sound}
merge_json(RP + "blocks.json", block_sounds, {"format_version": "1.21.40"})

def sounds(d):
    d.setdefault("entity_sounds", {}).setdefault("entities", {})["siege:steed"] = {
        "volume": 1.0, "pitch": [0.8, 1.2],
        "events": {"ambient": "mob.horse.idle", "armor": "mob.horse.armor", "breathe": "mob.horse.breathe", "death": "mob.horse.death",
                   "eat": "mob.horse.eat", "hurt": "mob.horse.hit", "jump": "mob.horse.jump", "land": "mob.horse.land",
                   "mad": "mob.horse.angry", "saddle": "mob.horse.leather", "step": "mob.horse.wood"},
    }
merge_json(RP + "sounds.json", sounds, {})

LANG = {f"item.siege:{k}.name": v[0] for k, v in ITEMS.items()}
LANG.update({f"tile.{ident}.name": v[0] for ident, v in BLOCKS.items()})
LANG["entity.siege:steed.name"] = "Steed"
for path in (BP + "texts/en_US.lang", RP + "texts/en_US.lang"):
    lines = open(path).read().splitlines()
    have = {l.split("=", 1)[0] for l in lines if "=" in l}
    lines += [f"{k}={v}" for k, v in LANG.items() if k not in have]
    open(path, "w").write("\n".join(lines) + "\n")

print(f"horses + rails: 1 entity, {len(ITEMS)} items, {len(BLOCKS)} blocks, 12 recipes, {len(ITEMS) + 2 * len(BLOCKS)} placeholder textures")
