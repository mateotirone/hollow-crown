# Builds every bestiary file from roster.py + items.py:
#   BP: entities, loot tables, spawn rules, items, scripts/bestiary/data.js
#   RP: client entities, geometry, placeholder textures, animations, render controllers, item icons, lang
# Run:  python3 studio/bestiary/build.py   (from siege-nights/). Safe to re-run.
import json, os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from models import Model
import roster, items
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")) + "/"
RP = ROOT + "Siege_Nights_RP/"; BP = ROOT + "Siege_Nights_BP/"

def write(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        if isinstance(data, str): f.write(data)
        else: json.dump(data, f, indent=1)

FAMILIES = {
    "raider": ["monster", "mob", "hollow", "siege_raider"], "hollow": ["monster", "mob", "hollow"], "summon": ["monster", "mob", "hollow"],
    "wild": ["mob", "beast"], "wild_hostile": ["monster", "mob", "beast"], "undead": ["monster", "undead", "mob", "hollow"],
    "order": ["mob", "ashen_order"], "boss": ["monster", "mob", "hollow", "siege_boss"], "boss_add": ["monster", "mob", "hollow", "siege_boss_add"],
    "boss_prop": ["inanimate", "siege_boss_prop"], "omen": ["inanimate", "siege_omen"], "seep": ["inanimate", "siege_seep"], "champion": ["mob", "siege_champion"], "projectile": ["inanimate"],
}
# mobs whose abilities are run by scripts/bestiary/mobs.js
SCRIPTED = {"bell_ringer", "torchbearer", "crow_mage", "lost_villager", "changeling", "wrongling", "stone_vigil", "echo_hound", "tolling_shade",
            "dune_wyrm", "bog_hag", "mire_toad", "inquisitor"}
DROPS = {
    "hollow_footman": [("siege:hollow_ash", 0, 2, 1), ("minecraft:iron_nugget", 0, 3, 1)],
    "bell_ringer": [("siege:hollow_ash", 1, 2, 1), ("minecraft:gold_nugget", 2, 5, 1), ("minecraft:bell", 1, 1, 0.05)],
    "shieldwall_brute": [("siege:hollow_ash", 1, 3, 1), ("minecraft:iron_ingot", 0, 2, 1)],
    "torchbearer": [("minecraft:coal", 0, 2, 1), ("minecraft:torch", 1, 3, 1)],
    "siege_ogre": [("siege:coin", 16, 40, 1), ("minecraft:leather", 2, 4, 1), ("siege:hollow_ash", 2, 4, 1)],
    "crow_mage": [("minecraft:feather", 1, 3, 1), ("minecraft:amethyst_shard", 0, 2, 1), ("siege:hollow_ash", 1, 2, 1)],
    "lost_villager": [("siege:hollow_ash", 0, 1, 1), ("siege:coin", 0, 8, 1)],
    "changeling": [("siege:changeling_ichor", 1, 1, 0.5), ("siege:hollow_ash", 0, 2, 1)],
    "wrongling": [("siege:hollow_ash", 2, 4, 1), ("minecraft:ender_pearl", 1, 1, 0.3)],
    "stone_vigil": [("siege:hollow_ash", 2, 4, 1), ("minecraft:quartz", 1, 3, 1), ("minecraft:amethyst_shard", 1, 2, 0.4)],
    "seep": [("siege:hollow_ash", 4, 8, 1), ("minecraft:amethyst_shard", 2, 4, 1), ("minecraft:echo_shard", 1, 1, 0.25)],
    "grey_spearman": [("siege:hollow_ash", 0, 2, 1), ("minecraft:iron_nugget", 1, 4, 1)],
    "grey_axeman": [("siege:hollow_ash", 0, 2, 1), ("minecraft:iron_nugget", 1, 4, 1), ("minecraft:iron_axe", 1, 1, 0.04)],
    "grey_bowman": [("siege:hollow_ash", 0, 2, 1), ("minecraft:arrow", 2, 6, 1), ("minecraft:packed_ice", 0, 1, 0.5)],
    "grey_bellcutter": [("siege:hollow_ash", 1, 2, 1), ("minecraft:copper_ingot", 1, 3, 1), ("minecraft:shears", 1, 1, 0.08)],
    "grey_serjeant": [("siege:hollow_ash", 2, 4, 1), ("minecraft:iron_ingot", 1, 3, 1), ("siege:coin", 16, 40, 1), ("minecraft:white_banner", 1, 1, 0.25)],
    "veinsworn": [("siege:hollow_ash", 2, 3, 1), ("minecraft:amethyst_shard", 1, 2, 1)],
    "shardcaster": [("siege:hollow_ash", 1, 3, 1), ("minecraft:amethyst_shard", 2, 4, 1), ("minecraft:echo_shard", 1, 1, 0.1)],
    "gatebreaker": [("siege:hollow_ash", 4, 8, 1), ("minecraft:amethyst_shard", 3, 6, 1), ("minecraft:echo_shard", 1, 1, 0.5), ("minecraft:diamond", 1, 2, 0.5)],
    "hollow_warlord": [("siege:hollow_ash", 4, 8, 1), ("minecraft:iron_ingot", 3, 6, 1), ("minecraft:gold_ingot", 1, 3, 1), ("minecraft:white_banner", 1, 1, 1), ("minecraft:diamond", 1, 1, 0.25)],
    "champion_knight": [("siege:gold_coin", 1, 1, 1), ("siege:coin", 0, 32, 1), ("minecraft:iron_ingot", 3, 6, 1), ("minecraft:golden_apple", 1, 1, 0.5), ("minecraft:arrow", 4, 12, 1)],
    "champion_sorcerer": [("siege:gold_coin", 1, 1, 1), ("siege:coin", 0, 32, 1), ("siege:hollow_ash", 4, 8, 1), ("minecraft:amethyst_shard", 2, 5, 1), ("minecraft:golden_apple", 1, 1, 0.5)],
    "champion_lord": [("siege:gold_coin", 1, 3, 1), ("minecraft:gold_ingot", 3, 6, 1), ("minecraft:golden_apple", 1, 2, 1), ("minecraft:diamond", 1, 2, 0.5)],
    "champion_retainer": [("siege:coin", 0, 16, 1), ("minecraft:iron_nugget", 2, 6, 1), ("minecraft:arrow", 0, 4, 1)],
    "gloamwing": [("siege:gloamquill", 1, 1, 1), ("siege:hollow_ash", 0, 1, 1)],
    "echo_hound": [("minecraft:bone", 1, 2, 1), ("siege:hollow_ash", 0, 2, 1)],
    "mirror_knight": [("minecraft:iron_ingot", 1, 3, 1), ("minecraft:amethyst_shard", 1, 2, 1)],
    "tolling_shade": [("siege:hollow_ash", 2, 3, 1), ("minecraft:gold_nugget", 1, 4, 1)],
    "frost_stag": [("siege:pale_antler", 1, 2, 1), ("minecraft:leather", 1, 2, 1)],
    "rimewolf": [("siege:rime_pelt", 1, 1, 0.5), ("minecraft:bone", 0, 2, 1)],
    "brine_lurker": [("siege:brine_scale", 1, 2, 1), ("minecraft:cod", 0, 2, 1), ("minecraft:prismarine_shard", 1, 1, 0.4)],
    "ash_scarab": [("siege:ash_glass", 1, 1, 0.25)],
    "dune_wyrm": [("siege:wyrm_scale", 3, 6, 1), ("siege:ash_glass", 2, 4, 1), ("minecraft:diamond", 1, 1, 0.5)],
    "bog_hag": [("siege:toad_venom", 1, 1, 0.5), ("minecraft:glowstone_dust", 0, 2, 1), ("minecraft:redstone", 0, 2, 1), ("minecraft:glass_bottle", 0, 2, 1)],
    "mire_toad": [("siege:toad_venom", 1, 1, 0.5), ("minecraft:slime_ball", 0, 2, 1)],
    "barrow_wight": [("siege:wight_dust", 1, 2, 1), ("minecraft:bone", 0, 2, 1), ("minecraft:iron_ingot", 1, 1, 0.3), ("minecraft:gold_nugget", 0, 3, 1)],
    "ashen_squire": [("minecraft:iron_nugget", 2, 5, 1)],
    "ashen_knight": [("minecraft:iron_ingot", 1, 3, 1), ("siege:coin", 0, 16, 1)],
    "inquisitor": [("minecraft:arrow", 2, 6, 1), ("siege:coin", 8, 24, 1), ("minecraft:crossbow", 1, 1, 0.05)],
}
self_tag = lambda v: {"test": "has_tag", "subject": "self", "value": v}

def sensor_for(m):
    t = []
    mid = m["id"]
    if m.get("boss") or m.get("family") == "boss_add":
        t.append({"on_damage": {"filters": self_tag("siege_boss_shielded")}, "deals_damage": "no"})
        t.append({"cause": "fall", "deals_damage": "no"}); t.append({"cause": "suffocation", "deals_damage": "no"})
    if mid == "ash_seneschal":
        t.append({"on_damage": {"filters": self_tag("siege_stance_melee")}, "cause": "entity_attack", "damage_multiplier": 0.35})
        t.append({"on_damage": {"filters": self_tag("siege_stance_ranged")}, "cause": "projectile", "damage_multiplier": 0.15})
    if mid in ("oswin_the_last", "oswin_reflection"):
        t.append({"on_damage": {"filters": self_tag("siege_parry")}, "cause": "entity_attack", "deals_damage": "no"})
    if mid == "wrongling":
        t.append({"on_damage": {"filters": self_tag("siege_watched")}, "damage_multiplier": 0.25})
    if mid == "stone_vigil":   # while it is being watched it is solid stone: only a pickaxe bites
        picks = [{"test": "has_equipment", "subject": "other", "domain": "hand", "operator": "not", "value": f"minecraft:{k}_pickaxe"} for k in ("wooden", "stone", "copper", "iron", "golden", "diamond", "netherite")]
        t.append({"on_damage": {"filters": {"all_of": [self_tag("siege_watched")] + picks}}, "deals_damage": "no"})
    if mid == "seep":   # it can't be closed while the things that came through it are still standing guard
        t.append({"on_damage": {"filters": self_tag("siege_seep_fed")}, "deals_damage": "no"})
    if m.get("family") == "champion":   # shield up: blades glance off, arrows stop dead (an axe breaks the guard, in the script)
        t.append({"on_damage": {"filters": self_tag("siege_champ_guard")}, "cause": "entity_attack", "damage_multiplier": 0.15})
        t.append({"on_damage": {"filters": self_tag("siege_champ_guard")}, "cause": "projectile", "deals_damage": "no"})
        t.append({"cause": "fall", "damage_multiplier": 0.4})
    if mid == "mirror_knight":
        t.append({"on_damage": {"filters": self_tag("siege_mirror_melee")}, "cause": "entity_attack", "damage_multiplier": 0.25})
        t.append({"on_damage": {"filters": self_tag("siege_mirror_ranged")}, "cause": "projectile", "damage_multiplier": 0.1})
    if mid == "changeling":
        t.append({"on_damage": {"filters": {"test": "is_variant", "subject": "self", "value": 0}, "event": "siege:reveal"}, "deals_damage": "yes"})
    if m.get("unbreakable"): t.append({"cause": "all", "deals_damage": "no"})
    if m.get("static"): t.append({"cause": "fall", "deals_damage": "no"})
    r = m.get("resist") or {}
    extra = roster.resist(**r).get("minecraft:damage_sensor", {}).get("triggers", []) if r else []
    if m.get("swim") or m.get("fly"): extra.append({"cause": "drowning", "deals_damage": "no"})
    if m.get("fly"): extra.append({"cause": "fall", "deals_damage": "no"})
    t += [x for x in extra if x not in t]
    return {"minecraft:damage_sensor": {"triggers": t}} if t else {}

def entity_bp(m):
    mid = m["id"]; fam = "boss" if m.get("boss") else m["family"]
    families = list(FAMILIES[fam])
    if m.get("raider"): families.append("siege_raider")
    if mid in SCRIPTED: families.append("siege_scripted")
    w, h = m.get("collision", (0.6, 1.9)); sc = m.get("scale", 1)
    desc = {"identifier": "siege:" + mid, "is_spawnable": bool(m.get("egg")), "is_summonable": True, "is_experimental": False}
    if m.get("projectile"):
        return {"format_version": "1.21.60", "minecraft:entity": {"description": desc, "components": {
            "minecraft:collision_box": {"width": 0.3, "height": 0.3},
            "minecraft:projectile": {"on_hit": {"impact_damage": {"damage": 4, "knockback": True, "destroy_on_hit": True},
                "mob_effect": {"effect": "blindness", "durationeasy": 60, "durationnormal": 80, "durationhard": 100, "amplifier": 0}, "remove_on_hit": {}},
                "power": 1.2, "gravity": 0.0, "inertia": 1, "liquid_inertia": 1, "uncertainty_base": 4, "uncertainty_multiplier": 0, "anchor": 1, "offset": [0, -0.1, 0], "reflect_on_hurt": False},
            "minecraft:physics": {}, "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": False},
            "minecraft:conditional_bandwidth_optimization": {"default_values": {"max_optimized_distance": 80, "max_dropped_ticks": 7, "use_motion_prediction_hints": True}}}}}
    c = {
        "minecraft:type_family": {"family": families},
        "minecraft:health": {"value": m["hp"], "max": m["hp"]},
        "minecraft:collision_box": {"width": w, "height": h},  # minecraft:scale grows the hitbox too
        "minecraft:nameable": {},
        "minecraft:physics": {},
        "minecraft:pushable": {"is_pushable": not m.get("static") and not m.get("boss"), "is_pushable_by_piston": not m.get("static")},
        "minecraft:knockback_resistance": {"value": 1 if m.get("static") else m.get("kb", 0)},
    }
    if sc != 1: c["minecraft:scale"] = {"value": sc}
    c.update(sensor_for(m))
    groups = {}; events = {}
    if m.get("static"):
        c["minecraft:movement"] = {"value": 0}; c["minecraft:persistent"] = {}
        if not m.get("no_loot") and mid in DROPS: c["minecraft:loot"] = {"table": f"loot_tables/entities/bestiary/{mid}.json"}
        if mid == "chapel_bell":
            groups["siege:ringing"] = {"minecraft:is_charged": {}}
            events["siege:ring"] = {"add": {"component_groups": ["siege:ringing"]}}
            events["siege:quiet"] = {"remove": {"component_groups": ["siege:ringing"]}}
        return {"format_version": "1.21.60", "minecraft:entity": {"description": desc, "component_groups": groups, "components": c, "events": events}}
    c["minecraft:movement"] = {"value": m["speed"]}
    c["minecraft:experience_reward"] = {"on_death": f"query.last_hit_by_player ? {max(3, m['hp'] // 4) if not m.get('boss') else 150} : 0"}
    c["minecraft:behavior.look_at_player"] = {"priority": 8, "look_distance": 8}
    c["minecraft:behavior.random_look_around"] = {"priority": 9}
    c["minecraft:behavior.hurt_by_target"] = {"priority": 1, "alert_same_type": fam in ("wild", "wild_hostile", "order")}
    if m.get("fly"):
        c.update(roster.flying(m["fly"]))
    elif m.get("swim"):
        c.update(roster.swimmer()); c["minecraft:jump.static"] = {}
        c["minecraft:behavior.random_stroll"] = {"priority": 7, "speed_multiplier": 0.8}
    else:
        c["minecraft:navigation.walk"] = {"can_path_over_water": True, "avoid_water": True, "can_open_doors": fam in ("raider", "order", "champion"), "can_pass_doors": True, "avoid_damage_blocks": True}
        c["minecraft:movement.basic"] = {}; c["minecraft:jump.static"] = {}
        c["minecraft:behavior.float"] = {"priority": 0}
        c["minecraft:behavior.random_stroll"] = {"priority": 7, "speed_multiplier": 0.8}
    # who it fights
    filt = None
    if fam in ("raider",) or m.get("raider"): filt = roster.RAIDER_TARGETS
    elif fam in ("hollow", "summon"):  # Hollow things leave the Hollow's ruler alone (player tag siege_hollow_ruler, set by whoever builds that feature)
        filt = roster.any_of({"all_of": [roster.fam("player"), {"test": "has_tag", "subject": "other", "operator": "!=", "value": "siege_hollow_ruler"}]}, roster.fam("siege_guard"))
    elif fam in ("wild_hostile", "undead", "boss", "boss_add"): filt = roster.any_of(roster.fam("player"), roster.fam("siege_guard"))
    elif fam == "order": filt = roster.any_of(roster.MARKED, {"all_of": [roster.fam("monster"), roster.fam("creeper", "!=")]})
    dist = 40 if m.get("boss") else 24
    if mid == "echo_hound": dist = 10
    tgt = roster.targets(filt, dist) if filt else {}
    fight = {}
    if m.get("ranged_def"):
        fight.update(roster.ranged(m["ranged_def"][0], aux=m["ranged_def"][1], radius=18 if m.get("boss") else 14))
        fight["minecraft:attack"] = {"damage": m["dmg"]}
    elif mid == "crow_mage" or m.get("hollow_bolts"):
        fight.update(roster.ranged("siege:hollow_bolt", interval=(2.5, 4), radius=16)); fight["minecraft:attack"] = {"damage": m["dmg"]}
    else:
        fight.update(roster.melee(m["dmg"], 1.25, m.get("effect")))
    if m.get("flees"):
        c["minecraft:behavior.avoid_mob_type"] = {"priority": 2, "entity_types": [{"filters": roster.any_of(roster.fam("player"), roster.fam("siege_guard")), "max_dist": 7, "walk_speed_multiplier": 1.2, "sprint_speed_multiplier": 1.4}]}
        c["minecraft:attack"] = {"damage": m["dmg"]}
    elif mid == "lost_villager":
        c["minecraft:attack"] = {"damage": m["dmg"]}          # never attacks by itself: mobs.js moves and strikes while unseen
    elif mid == "changeling":
        groups["siege:disguised"] = {"minecraft:variant": {"value": 0}}
        groups["siege:revealed"] = {"minecraft:variant": {"value": 1}, **tgt, **fight, "minecraft:movement": {"value": 0.34}}
        events["minecraft:entity_spawned"] = {"add": {"component_groups": ["siege:disguised"]}}
        events["siege:reveal"] = {"remove": {"component_groups": ["siege:disguised"]}, "add": {"component_groups": ["siege:revealed"]}}
    else:
        c.update(tgt); c.update(fight)
    if m.get("burns"): c["minecraft:burns_in_daylight"] = {}
    if m.get("rideable"): c["minecraft:rideable"] = {"seat_count": 1, "family_types": ["siege_boss"], "seats": {"position": [0, 2.7, 0.3]}}
    if m.get("lifetime"):
        c["minecraft:timer"] = {"time": m["lifetime"], "looping": False, "time_down_event": {"event": "siege:fade"}}
        groups["siege:gone"] = {"minecraft:instant_despawn": {}}; events["siege:fade"] = {"add": {"component_groups": ["siege:gone"]}}
    if m.get("bare_flag"):   # a part of the model that can be taken off: event siege:bare_on / siege:bare_off (the Hollow Crown, knocked from his head)
        groups["siege:bare"] = {"minecraft:is_charged": {}}
        events["siege:bare_on"] = {"add": {"component_groups": ["siege:bare"]}}; events["siege:bare_off"] = {"remove": {"component_groups": ["siege:bare"]}}
    if mid == "stone_vigil":   # mapmakers: /event entity @e[type=siege:stone_vigil,r=4] siege:place makes one stay for good
        groups["siege:placed"] = {"minecraft:persistent": {}}; events["siege:place"] = {"add": {"component_groups": ["siege:placed"]}}
    if fam == "champion":
        # NPC stand-ins for players (scripts/bestiary/champions.js drives them). Who they fight is a stance, set by event:
        #   siege:hostile  hunts players and guards     siege:realm  hunts monsters     siege:calm  only hits back
        # Three flags the script flips, which the animation reads: bow out (charged), shield up (saddled), drinking (ignited).
        monsters = {"all_of": [roster.fam("monster"), roster.fam("creeper", "!=")]}
        groups["siege:stance_hostile"] = roster.targets(roster.any_of(roster.fam("player"), roster.fam("siege_guard")), 32)
        groups["siege:stance_realm"] = roster.targets(monsters, 20)
        events["siege:hostile"] = {"remove": {"component_groups": ["siege:stance_realm"]}, "add": {"component_groups": ["siege:stance_hostile"]}}
        events["siege:realm"] = {"remove": {"component_groups": ["siege:stance_hostile"]}, "add": {"component_groups": ["siege:stance_realm"]}}
        events["siege:calm"] = {"remove": {"component_groups": ["siege:stance_hostile", "siege:stance_realm"]}}
        for flag, comp in (("bow", "minecraft:is_charged"), ("guard", "minecraft:is_saddled"), ("drink", "minecraft:is_ignited")):
            groups[f"siege:{flag}"] = {comp: {}}
            events[f"siege:{flag}_on"] = {"add": {"component_groups": [f"siege:{flag}"]}}; events[f"siege:{flag}_off"] = {"remove": {"component_groups": [f"siege:{flag}"]}}
        c["minecraft:persistent"] = {}; c.pop("minecraft:despawn", None)
    if m.get("boss"):
        c["minecraft:boss"] = {"should_darken_sky": False, "hud_range": 48}; c["minecraft:persistent"] = {}
        c["minecraft:fire_immune"] = {}
    elif fam in ("boss_add", "raider"): c["minecraft:persistent"] = {}
    elif fam != "champion": c["minecraft:despawn"] = {"despawn_from_distance": {}}
    if not m.get("no_loot") and mid in DROPS: c["minecraft:loot"] = {"table": f"loot_tables/entities/bestiary/{mid}.json"}
    if m.get("glider"):   # flies the way a phantom does: circles high over its target, then swoops
        for k in list(c):
            if k.startswith(("minecraft:navigation", "minecraft:movement.", "minecraft:jump", "minecraft:behavior.")) and k not in ("minecraft:behavior.nearest_attackable_target", "minecraft:behavior.hurt_by_target"): c.pop(k)
        c.update({"minecraft:physics": {"has_gravity": False}, "minecraft:can_fly": {}, "minecraft:flying_speed": {"value": 0.2},
                  "minecraft:movement.glide": {"start_speed": 0.1, "speed_when_turning": 0.2}, "minecraft:attack": {"damage": m["dmg"]},
                  "minecraft:behavior.swoop_attack": {"priority": 2, "damage_reach": 0.3, "speed_multiplier": 1.0, "delay_range": [8.0, 16.0]},
                  "minecraft:behavior.circle_around_anchor": {"priority": 3, "radius_change": 1.0, "radius_adjustment_chance": 0.004, "height_adjustment_chance": 0.002857,
                      "goal_radius": 1.0, "angle_change": 15.0, "radius_range": [5.0, 15.0], "height_offset_range": [-4.0, 5.0], "height_above_target_range": [8.0, 14.0]},
                  "minecraft:persistent": {}})
        c["minecraft:damage_sensor"] = {"triggers": [{"cause": "fall", "deals_damage": "no"}, {"cause": "suffocation", "deals_damage": "no"}]}
        c.pop("minecraft:despawn", None)
    return {"format_version": "1.21.60", "minecraft:entity": {"description": desc, "component_groups": groups, "components": c, "events": events}}

# ---------- animations ----------
WALK = "math.cos(query.modified_distance_moved*38.17)*query.modified_move_speed"
def anim_for(m, model):
    names = {b["name"] for b in model.bones}; plan = m.get("plan", "biped"); b = {}
    def rot(bone, x="0", y="0", z="0"):
        if bone in names: b.setdefault(bone, {})["rotation"] = [x, y, z]
    if plan != "none" and "head" in names: rot("head", "query.target_x_rotation", "query.target_y_rotation")
    if plan in ("biped", "float"):
        k = 45 if plan == "biped" else 8
        rot("leg_r", f"{WALK}*{k}"); rot("leg_l", f"-{WALK}*{k}")
        idle = "math.sin(query.life_time*90)*3"
        raised = "-80+" if m["id"] in ("lost_villager", "wrongling", "drowned_bride", "tolling_shade", "mother_echo", "mother_of_changelings") and m["id"] not in ("wrongling", "lost_villager") else ""
        rot("arm_r", f"{raised}-{WALK}*35 - math.sin(variable.attack_time*180)*95 + {idle}"); rot("arm_l", f"{raised}{WALK}*35 - {idle}")
    if plan == "float" and "body" in names: b.setdefault("body", {})["position"] = ["0", "math.sin(query.life_time*120)*1.5", "0"]
    if plan == "quad":
        for n, s in (("leg_fr", ""), ("leg_bl", ""), ("leg_fl", "-"), ("leg_br", "-")): rot(n, f"{s}{WALK}*40")
        rot("tail", "0", "math.sin(query.life_time*300)*12")
    if plan == "bird":
        rot("wing_r", z="math.sin(query.life_time*1400)*45"); rot("wing_l", z="-math.sin(query.life_time*1400)*45")
    if plan == "bug":
        for bn in names:
            if bn.startswith("leg_"): rot(bn, y=f"math.sin(query.life_time*900+{ord(bn[-1])*40})*20*query.modified_move_speed")
    if plan == "wyrm":
        for i in range(6): rot(f"seg{i}", y=f"math.sin(query.life_time*200-{i*45})*9", x=f"math.cos(query.life_time*150-{i*45})*3")
    for bone, ch, val in m.get("anim_extra", []):
        if bone in names: b.setdefault(bone, {})[ch] = val
    # An empty "bones" object is a content-log error in game; a still model needs no bones entry
    return {"loop": True, "bones": b} if b else {"loop": True, "animation_length": 1.0}

def client_entity(m, tex_w=None):
    mid = m["id"]
    d = {"identifier": "siege:" + mid, "materials": {"default": m.get("material", "entity_alphatest")},
         "textures": {"default": f"textures/entity/siege/bestiary/{mid}"},
         "geometry": {"default": f"geometry.siege_b.{m.get('geo', mid)}"},
         "animations": {"main": f"animation.siege_b.{mid}"}, "scripts": {"animate": ["main"]},
         "render_controllers": ["controller.render.siege_bestiary"]}
    if m.get("variants"):
        d["textures"]["alt"] = f"textures/entity/siege/bestiary/{mid}_alt"; d["render_controllers"] = ["controller.render.siege_bestiary_variant"]
    if m.get("egg"): d["spawn_egg"] = {"base_color": m["egg"][0], "overlay_color": m["egg"][1]}
    return {"format_version": "1.10.0", "minecraft:client_entity": {"description": d}}

def loot(drops):
    pools = []
    for name, lo, hi, chance in drops:
        p = {"rolls": 1, "entries": [{"type": "item", "name": name, "weight": 1, "functions": [{"function": "set_count", "count": {"min": lo, "max": hi}}]}]}
        conds = [{"condition": "killed_by_player"}] if name in ("siege:coin", "siege:gold_coin") else []  # no coins from mob farms
        if chance < 1: conds.append({"condition": "random_chance", "chance": chance})
        if conds: p["conditions"] = conds
        pools.append(p)
    return {"pools": pools}

def spawn_rule(m):
    s = m["spawn"]; cond = {"minecraft:spawns_on_surface": {}, "minecraft:weight": {"default": s["weight"]},
        "minecraft:herd": {"min_size": s["herd"][0], "max_size": s["herd"][1]}, "minecraft:density_limit": {"surface": 4},
        "minecraft:biome_filter": {"any_of": [{"test": "has_biome_tag", "operator": "==", "value": b} for b in s["biomes"]]}}
    if s["light"] is not None: cond["minecraft:brightness_filter"] = {"min": 0, "max": s["light"], "adjust_for_weather": True}
    if s["pop"] == "monster": cond["minecraft:difficulty_filter"] = {"min": "easy", "max": "hard"}
    return {"format_version": "1.8.0", "minecraft:spawn_rules": {"description": {"identifier": "siege:" + m["id"], "population_control": s["pop"]}, "conditions": [cond]}}

# ---------- locked textures: never overwrite art someone has painted ----------
import fnmatch
def _locked():
    f = os.path.join(os.path.dirname(os.path.abspath(__file__)), "locked.txt")
    return [l.strip() for l in open(f) if l.strip() and not l.startswith("#")] if os.path.exists(f) else []
LOCKED = _locked(); SKIPPED = []
def save_tex(im, path):
    rel = path[len(RP):]
    if os.path.exists(path) and any(fnmatch.fnmatch(rel, pat) for pat in LOCKED): SKIPPED.append(rel); return
    os.makedirs(os.path.dirname(path), exist_ok=True); im.save(path)

# ---------- item icons ----------
def icon(kind, col):
    im = Image.new("RGBA", (16, 16), (0, 0, 0, 0)); px = im.load()
    def p(x, y, k=1.0):
        if 0 <= x < 16 and 0 <= y < 16: px[x, y] = tuple(max(0, min(255, int(c * k))) for c in col) + (255,)
    dark = (40, 30, 26, 255)
    if kind == "sword":
        for i in range(10): p(13 - i, 2 + i, 1.1); p(12 - i, 2 + i, 0.8)
        for i in range(-2, 3): px[4 + i, 11 + i] = (90, 70, 40, 255) if False else dark
        px[2, 13] = px[3, 12] = (110, 78, 46, 255); px[1, 14] = (218, 176, 70, 255)
    elif kind == "bow":
        for i in range(12):
            x = 3 + int(round(5 * math.sin(i / 11 * math.pi))); p(x + 4, 2 + i, 1.0); px[4, 2 + i] = (230, 230, 230, 255)
    elif kind == "helmet":
        for y in range(4, 12):
            for x in range(3, 13):
                if y < 8 or x < 5 or x > 10: p(x, y, 1.1 - (y - 4) * 0.05)
    elif kind == "chest":
        for y in range(3, 14):
            for x in range(2, 14):
                if (y > 5 or x < 5 or x > 10) and (y < 8 or 4 <= x <= 11): p(x, y, 1.1 - (y - 3) * 0.04)
    elif kind == "shield":
        for y in range(2, 15):
            half = 5 if y < 9 else max(0, 5 - (y - 8))
            for x in range(8 - half, 8 + half): p(x, y, 0.75 if x in (8 - half, 8 + half - 1) or y == 2 else 1.0)
        px[7, 6] = px[8, 6] = px[7, 7] = px[8, 7] = (218, 176, 70, 255)
    elif kind == "charm":
        for y in range(4, 13):
            for x in range(3, 13):
                if (x - 5.5) ** 2 + (y - 6) ** 2 < 7 or (x - 9.5) ** 2 + (y - 6) ** 2 < 7 or (y >= 7 and abs(x - 7.5) <= 12 - y): p(x, y, 1.15 - (y - 4) * 0.06)
    elif kind == "shard":
        for y in range(2, 15):
            for x in range(4, 12):
                if abs(x - 8) + abs(y - 8) * 0.5 < 3.6: p(x, y, 1.2 - abs(x - 6) * 0.1)
    elif kind == "sigil":
        for y in range(16):
            for x in range(16):
                r = ((x - 7.5) ** 2 + (y - 7.5) ** 2) ** 0.5
                if 4.2 < r < 6.2: p(x, y, 0.8)
                elif r < 2.6: p(x, y, 1.2)
    else:  # gem / material
        for y in range(16):
            for x in range(16):
                if abs(x - 7.5) + abs(y - 8) < 5.6: p(x, y, 1.25 - (x + y) * 0.03)
    return im

def armor_tex(col, alpha=255):
    im = Image.new("RGBA", (64, 32), (0, 0, 0, 0)); px = im.load()
    import random; r = random.Random(4)
    for y in range(32):
        for x in range(64):
            n = r.randint(-8, 8); px[x, y] = tuple(max(0, min(255, c + n)) for c in col) + (alpha,)
    return im

def item_json(iid, name, kind, st):
    comp = {"minecraft:icon": "siege_b_" + iid, "minecraft:display_name": {"value": f"item.siege:{iid}.name"}, "minecraft:max_stack_size": 64}
    cat = {"category": "items"}
    if kind in ("sword", "bow", "helmet", "chest", "shield", "charm", "shard", "sigil"): comp["minecraft:max_stack_size"] = 1
    if kind in ("sword", "bow", "helmet", "chest", "shield", "charm", "shard"): comp["minecraft:glint"] = True; cat = {"category": "equipment"}
    if st.get("durability"): comp["minecraft:durability"] = {"max_durability": st["durability"]}
    if kind == "sword":
        comp.update({"minecraft:hand_equipped": True, "minecraft:damage": st["damage"], "minecraft:can_destroy_in_creative": False,
                     "minecraft:enchantable": {"slot": "sword", "value": 18}, "minecraft:tags": {"tags": ["minecraft:is_sword"]}})
    if kind == "bow":
        comp.update({"minecraft:hand_equipped": True, "minecraft:use_modifiers": {"use_duration": 72000, "movement_modifier": 0.35}, "minecraft:use_animation": "bow",
                     "minecraft:enchantable": {"slot": "bow", "value": 18},
                     "minecraft:shooter": {"ammunition": [{"item": "minecraft:arrow", "use_offhand": True, "search_inventory": True, "use_in_creative": True}],
                                           "max_draw_duration": 1.0, "scale_power_by_draw_duration": True, "charge_on_draw": False}})
    if kind == "helmet": comp.update({"minecraft:wearable": {"slot": "slot.armor.head", "protection": st["protection"]}, "minecraft:enchantable": {"slot": "armor_head", "value": 18}, "minecraft:tags": {"tags": ["minecraft:is_armor"]}})
    if kind == "chest": comp.update({"minecraft:wearable": {"slot": "slot.armor.chest", "protection": st["protection"]}, "minecraft:enchantable": {"slot": "armor_torso", "value": 18}, "minecraft:tags": {"tags": ["minecraft:is_armor"]}})
    if kind in ("shield", "charm"): comp["minecraft:allow_off_hand"] = True
    if kind == "shield": comp["minecraft:hand_equipped"] = True
    return {"format_version": "1.21.60", "minecraft:item": {"description": {"identifier": "siege:" + iid, "menu_category": cat}, "components": comp}}

def attachable(iid, kind):
    piece = "helmet" if kind == "helmet" else "chestplate"; var = "helmet_layer_visible" if kind == "helmet" else "chest_layer_visible"
    return {"format_version": "1.8.0", "minecraft:attachable": {"description": {"identifier": "siege:" + iid,
        "materials": {"default": "armor", "enchanted": "armor_enchanted"},
        "textures": {"default": f"textures/models/armor/siege_b_{iid}", "enchanted": "textures/misc/enchanted_actor_glint"},
        "geometry": {"default": f"geometry.humanoid.armor.{piece}"}, "scripts": {"parent_setup": f"variable.{var} = 0.0;"},
        "render_controllers": ["controller.render.armor"]}}}

def merge_lang(path, lines):
    old = open(path).read().splitlines() if os.path.exists(path) else []
    keys = {l.split("=")[0] for l in lines}
    out = [l for l in old if l.split("=")[0] not in keys] + lines
    write(path, "\n".join(out) + "\n")

# ---------- bodies: what a mob leaves on the field when it dies ----------
# One entity (siege:body) wears any mob's shape and skin, picked by its siege:kind property, so a
# battlefield of bodies costs one cheap entity each: no AI, no collisions with players, no ticking parts.
NO_BODY_FAMILIES = ("boss_prop", "projectile", "summon", "seep", "omen")
def write_bodies(built):
    kinds = [mid for mid, (m, model) in built.items() if m.get("family", "boss") not in NO_BODY_FAMILIES
             and m.get("material", "entity_alphatest") == "entity_alphatest"      # ghosts and shades leave nothing behind
             and any(b["name"] == "root" for b in model.bones)]
    assert len(kinds) <= 64, "raise the siege:kind range"
    geo = {f"g{i}": f"geometry.siege_b.{k}" for i, k in enumerate(kinds)}; tex = {f"t{i}": f"textures/entity/siege/bestiary/{k}" for i, k in enumerate(kinds)}
    write(BP + "entities/bestiary/body.json", {"format_version": "1.21.60", "minecraft:entity": {
        "description": {"identifier": "siege:body", "is_spawnable": False, "is_summonable": True, "is_experimental": False, "properties": {
            "siege:kind": {"type": "int", "range": [0, 63], "default": 0, "client_sync": True},
            "siege:size": {"type": "float", "range": [0.2, 4.0], "default": 1.0, "client_sync": True},
            "siege:fading": {"type": "bool", "default": False, "client_sync": True}}},
        "component_groups": {"siege:gone": {"minecraft:instant_despawn": {}}},
        "components": {
            "minecraft:type_family": {"family": ["inanimate", "siege_body"]},
            "minecraft:collision_box": {"width": 0.5, "height": 0.3},
            "minecraft:health": {"value": 1, "max": 1},
            "minecraft:damage_sensor": {"triggers": [{"cause": "all", "deals_damage": "no"}]},
            "minecraft:physics": {}, "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": True},
            "minecraft:knockback_resistance": {"value": 1},
            "minecraft:timer": {"time": 900, "looping": False, "time_down_event": {"event": "siege:gone"}}},   # failsafe: never outlives 15 minutes
        "events": {"siege:gone": {"add": {"component_groups": ["siege:gone"]}}}}})
    write(RP + "entity/bestiary/body.entity.json", {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
        "identifier": "siege:body", "materials": {"default": "entity_alphatest"}, "textures": tex, "geometry": geo,
        "animations": {"fall": "animation.siege_b.body.fall", "down": "animation.siege_b.body.down", "sink": "animation.siege_b.body.sink", "size": "animation.siege_b.body.size",
                       "life": "controller.animation.siege_b.body"},
        "scripts": {"animate": ["life", "size"]}, "render_controllers": ["controller.render.siege_body"]}}})
    write(RP + "animations/bestiary_body.animation.json", {"format_version": "1.8.0", "animations": {
        # tips over backwards, hits the ground, settles
        "animation.siege_b.body.fall": {"loop": "hold_on_last_frame", "animation_length": 0.7, "bones": {"root": {
            "rotation": {"0.0": [0, 0, 0], "0.15": [-12, 0, 2], "0.45": [-94, 0, 4], "0.55": [-86, 0, 3], "0.7": [-90, 0, 3]},
            "position": {"0.0": [0, 0, 0], "0.45": [0, 1, 0], "0.55": [0, 2.5, 0], "0.7": [0, 1, 0]}}}},
        "animation.siege_b.body.down": {"loop": True, "bones": {"root": {"rotation": [-90, 0, 3]}}},
        # sinks into the ground over five seconds
        "animation.siege_b.body.sink": {"loop": "hold_on_last_frame", "animation_length": 5.0, "bones": {"root": {
            "position": {"0.0": [0, 1, 0], "5.0": [0, -9, 0]}, "scale": {"0.0": [1, 1, 1], "5.0": [0.9, 0.9, 0.55]}}}},
        "animation.siege_b.body.size": {"loop": True, "bones": {"root": {"scale": "query.property('siege:size')"}}}}})
    write(RP + "animation_controllers/bestiary_body.animation_controllers.json", {"format_version": "1.10.0", "animation_controllers": {
        "controller.animation.siege_b.body": {"initial_state": "lying", "states": {
            "lying": {"animations": ["fall"], "transitions": [{"fading": "query.property('siege:fading')"}]},
            "fading": {"animations": ["down", "sink"]}}}}})
    write(RP + "render_controllers/siege_body.render_controllers.json", {"format_version": "1.8.0", "render_controllers": {
        "controller.render.siege_body": {"arrays": {"geometries": {"Array.shapes": [f"Geometry.g{i}" for i in range(len(kinds))]},
                                                    "textures": {"Array.skins": [f"Texture.t{i}" for i in range(len(kinds))]}},
            "geometry": "Array.shapes[query.property('siege:kind')]", "materials": [{"*": "Material.default"}],
            "textures": ["Array.skins[query.property('siege:kind')]"]}}})
    return {"siege:" + k: {"kind": i, "size": built[k][0].get("scale", 1)} for i, k in enumerate(kinds)}

def main():
    lang = []; anims = {}; data_mobs = {}; built = {}
    for m in roster.MOBS:
        mid = m["id"]
        model = Model(mid, m["pal"], seed=sum(map(ord, mid))); m["model"](model)
        write(RP + f"models/entity/bestiary/{mid}.geo.json", model.geometry(f"geometry.siege_b.{mid}"))
        os.makedirs(RP + "textures/entity/siege/bestiary", exist_ok=True)
        save_tex(model.texture(), RP + f"textures/entity/siege/bestiary/{mid}.png")
        if m.get("variants"): save_tex(model.texture(m["pal_alt"]), RP + f"textures/entity/siege/bestiary/{mid}_alt.png")
        anims[f"animation.siege_b.{mid}"] = anim_for(m, model)
        write(RP + f"entity/bestiary/{mid}.entity.json", client_entity(m))
        write(BP + f"entities/bestiary/{mid}.json", entity_bp(m))
        if not m.get("no_loot") and mid in DROPS: write(BP + f"loot_tables/entities/bestiary/{mid}.json", loot(DROPS[mid]))
        if m.get("spawn"): write(BP + f"spawn_rules/bestiary_{mid}.json", spawn_rule(m))
        lang.append(f"entity.siege:{mid}.name={m['name']}")
        if m.get("egg"): lang.append(f"item.spawn_egg.entity.siege:{mid}.name={m['name']} Spawn Egg")
        fam = "boss" if m.get("boss") else m["family"]
        data_mobs["siege:" + mid] = {"name": m["name"], "family": fam, "hp": m["hp"], "lore": m["lore"], **({"region": m["region"]} if m.get("region") else {})}
        built[mid] = (m, model)
    write(RP + "animations/bestiary.animation.json", {"format_version": "1.8.0", "animations": anims})
    write(RP + "render_controllers/siege_bestiary.render_controllers.json", {"format_version": "1.8.0", "render_controllers": {
        "controller.render.siege_bestiary": {"geometry": "Geometry.default", "materials": [{"*": "Material.default"}], "textures": ["Texture.default"]},
        "controller.render.siege_bestiary_variant": {"arrays": {"textures": {"Array.skins": ["Texture.default", "Texture.alt"]}},
            "geometry": "Geometry.default", "materials": [{"*": "Material.default"}], "textures": ["Array.skins[query.variant]"]}}})
    bodies = write_bodies(built)
    # items
    all_items = [(i, n, "gem", c, {}, l) for i, n, c, l in items.MATERIALS] + [(i, n, "sigil", c, {}, l) for i, n, _, c, l in items.SIGILS] + list(items.RELICS)
    tex = {}; data_items = {}
    for iid, name, kind, col, st, lore_text in all_items:
        write(BP + f"items/bestiary/{iid}.json", item_json(iid, name, kind, st))
        os.makedirs(RP + "textures/items/bestiary", exist_ok=True)
        save_tex(icon(kind, col), RP + f"textures/items/bestiary/{iid}.png")
        tex["siege_b_" + iid] = {"textures": f"textures/items/bestiary/{iid}"}
        lang.append(f"item.siege:{iid}.name={name}")
        data_items["siege:" + iid] = {"name": name, "lore": lore_text}
        if kind in ("helmet", "chest"):
            write(RP + f"attachables/bestiary_{iid}.json", attachable(iid, kind))
            save_tex(armor_tex(col, 200 if kind == "helmet" else 255), RP + f"textures/models/armor/siege_b_{iid}.png")
    # shared files: read again right before writing (other threads edit them too)
    it_path = RP + "textures/item_texture.json"; it = json.load(open(it_path)); it["texture_data"].update(tex); write(it_path, it)
    merge_lang(RP + "texts/en_US.lang", lang)
    if os.path.exists(BP + "texts/en_US.lang"): merge_lang(BP + "texts/en_US.lang", lang)
    sig = {"siege:" + i: "siege:" + b for i, _, b, _, _ in items.SIGILS}
    write(BP + "scripts/bestiary/data.js", "// GENERATED by studio/bestiary/build.py from roster.py and items.py. Do not edit by hand.\n"
          + "export const MOBS = " + json.dumps(data_mobs, indent=1) + ";\n\nexport const ITEMS = " + json.dumps(data_items, indent=1)
          + ";\n\nexport const SIGILS = " + json.dumps(sig, indent=1)
          + ";\n\n// Which fallen body each mob leaves (see bodies.js): kind picks its shape and skin, size is its scale.\nexport const BODIES = " + json.dumps(bodies, indent=1) + ";\n")
    print(len(roster.MOBS), "entities,", len(all_items), "items")
    return built

if __name__ == "__main__": main()
