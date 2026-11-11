#!/usr/bin/env python3
"""Writes the player action animations (tools/build_player_anims.py). Run from the repo root.

Everything is additive on top of the vanilla player animations, so a Minecraft update that changes the
vanilla controller still works. Weapon swings and bow draws replace only the vanilla swing aliases.
"""
import json, os, sys

ROOT = sys.argv[1] if len(sys.argv) > 1 else os.getcwd()
RP = os.path.join(ROOT, "Siege_Nights_RP")

E, S = "variable.hc_e", "variable.hc_s"

def r(x=0.0, y=0.0, z=0.0):
    return [x if isinstance(x, str) else float(x), y if isinstance(y, str) else float(y), z if isinstance(z, str) else float(z)]

def neg(expr):
    return f"-({expr})"

def twist(x_expr, y_expr):
    """waist turn plus a head counter-turn so the player keeps looking where they look"""
    return {"waist": {"rotation": r(x_expr, y_expr, 0)}, "head": {"rotation": r(neg(x_expr) if x_expr != 0 else 0, neg(y_expr) if y_expr != 0 else 0, 0)}}

def anim(bones):
    return {"loop": True, "bones": bones}

A = {}

# ---------- third person: running, jumping, landing, breathing ----------
LEAN = "variable.hc_sprint * 9.0 + variable.hc_airb * 4.0 + variable.hc_land * 10.0"
TWIST = "-variable.tcos0 * 0.1"
ARMX = "variable.tcos0 * 0.35 * variable.hc_sprint"
AIRUP = "variable.hc_airb * (12.0 + variable.hc_fall * 20.0)"
AIROUT = "variable.hc_sprint * 5.0 + variable.hc_airb * (14.0 + variable.hc_fall * 25.0 + math.sin(query.life_time * 500.0) * variable.hc_fall * 6.0) + variable.hc_land * 8.0"
A["animation.hc.player.locomotion"] = anim({
    "waist": {"rotation": r(LEAN, TWIST, 0)},
    "head": {"rotation": r(f"-({LEAN}) * 0.8", f"-({TWIST})", 0)},
    "body": {"position": r(0, "-variable.hc_sprint * math.abs(math.sin(query.modified_distance_moved * 38.17)) * 0.6 - variable.hc_land * 1.5 - (math.sin(query.life_time * 100.0) + 1.0) * 0.06 * (1.0 - math.min(query.modified_move_speed * 4.0, 1.0))", 0)},
    "rightarm": {"rotation": r(f"(-{ARMX} - {AIRUP}) * variable.hc_free", 0, f"({AIROUT}) * variable.hc_free")},
    "leftarm": {"rotation": r(f"({ARMX} - {AIRUP}) * variable.hc_free", 0, f"-({AIROUT}) * variable.hc_free")},
    "rightleg": {"rotation": r("variable.tcos0 * 0.3 * variable.hc_sprint - variable.hc_airb * 20.0 * (1.0 - variable.hc_fall * 0.5)", 0, "variable.hc_airb * variable.hc_fall * 6.0")},
    "leftleg": {"rotation": r("-variable.tcos0 * 0.3 * variable.hc_sprint + variable.hc_airb * 12.0", 0, "-variable.hc_airb * variable.hc_fall * 6.0")},
})

# ---------- third person: bow ----------
# In Minecraft the right hand holds the bow and the left hand draws. The torso turns side-on and the
# arms turn back by the same amount so the aim does not move. A long hold makes the arms shake.
D = "variable.hc_draw"
SH = "variable.hc_shake"
A["animation.hc.player.bow_draw"] = anim({
    "waist": {"rotation": r(f"-{D} * 3.0", f"-{D} * 14.0", 0)},
    "head": {"rotation": r(f"{D} * 3.0", f"{D} * 14.0", 0)},
    "rightarm": {"rotation": r(f"math.sin(query.life_time * 1400.0) * {SH} * 1.2", f"{D} * 14.0", 0)},
    "leftarm": {"rotation": r(f"{D} * 4.0 + math.cos(query.life_time * 1300.0) * {SH} * 1.5", f"{D} * 26.0", f"-{D} * 4.0")},
})
REL = "variable.hc_release"
A["animation.hc.player.bow_release"] = anim({
    "rightarm": {"rotation": r(f"-{REL} * 80.0", f"{REL} * 6.0", 0)},
    "leftarm": {"rotation": r(f"-{REL} * 70.0", f"-{REL} * 25.0", f"-{REL} * 15.0")},
})

# ---------- third person: weapon swings ----------
# hc_e is 0 -> 1 -> 0 over the swing, hc_s goes 0 -> 1 through the strike. Positive y turns to the player's right.
def swing(right, left=None, wx=0, wy=0, legs=None):
    b = {"rightarm": {"rotation": r(*right)}}
    if left: b["leftarm"] = {"rotation": r(*left)}
    b.update(twist(wx, wy))
    if legs: b.update(legs)
    return anim(b)

A["animation.hc.player.attack.blade_forehand"] = swing(
    (f"-{E} * (150.0 - 95.0 * {S})", f"{E} * (25.0 - 80.0 * {S})", f"{E} * (20.0 - 30.0 * {S})"),
    (f"{E} * 15.0 * {S}", 0, f"-{E} * 10.0"),
    f"{E} * {S} * 6.0", f"{E} * (18.0 - 40.0 * {S})")
A["animation.hc.player.attack.blade_backhand"] = swing(
    (f"-{E} * 85.0", f"{E} * (-60.0 + 110.0 * {S})", f"{E} * (-5.0 + 30.0 * {S})"),
    (f"{E} * 10.0", 0, f"-{E} * 12.0 * {S}"),
    f"{E} * {S} * 4.0", f"{E} * (-22.0 + 50.0 * {S})")
A["animation.hc.player.attack.blade_thrust"] = swing(
    (f"-{E} * (35.0 + 60.0 * {S})", f"{E} * (20.0 - 25.0 * {S})", f"{E} * (10.0 - 10.0 * {S})"),
    (f"{E} * 20.0 * {S}", 0, f"-{E} * 8.0"),
    f"{E} * {S} * 10.0", f"{E} * (22.0 - 34.0 * {S})",
    {"rightleg": {"rotation": r(f"-{E} * {S} * 12.0", 0, 0)}, "leftleg": {"rotation": r(f"{E} * {S} * 8.0", 0, 0)}})
A["animation.hc.player.attack.heavy_chop"] = swing(
    (f"-{E} * (170.0 - 140.0 * {S})", f"-{E} * 10.0 * {S}", f"{E} * 5.0"),
    (f"-{E} * (160.0 - 125.0 * {S})", f"{E} * 35.0", 0),
    f"{E} * (-8.0 + 24.0 * {S})", f"{E} * (8.0 - 14.0 * {S})")
A["animation.hc.player.attack.heavy_sweep"] = swing(
    (f"-{E} * 80.0", f"{E} * (55.0 - 115.0 * {S})", f"{E} * 10.0"),
    (f"-{E} * 70.0", f"{E} * (75.0 - 95.0 * {S})", 0),
    f"{E} * {S} * 6.0", f"{E} * (35.0 - 70.0 * {S})")
GUARD = (f"-{E} * 45.0", f"{E} * 30.0", 0)
A["animation.hc.player.attack.fist_jab"] = swing(
    (f"-{E} * (25.0 + 65.0 * {S})", f"{E} * (10.0 - 18.0 * {S})", 0), GUARD,
    0, f"{E} * (14.0 - 30.0 * {S})")
A["animation.hc.player.attack.fist_hook"] = swing(
    (f"-{E} * 80.0", f"{E} * (45.0 - 90.0 * {S})", f"{E} * 25.0"), GUARD,
    0, f"{E} * (24.0 - 50.0 * {S})")

# ---------- first person ----------
# Vanilla's first-person swing turns the arm along (-60, 40, 20); positions: x toward the middle, y up, z forward.
def fp(pos, f=None, vec=(-60.0, 40.0, 20.0), extra_rot=None):
    bone = {"position": r(*pos)}
    if f is not None:
        bone["rotation"] = r(*[f"({f}) * {v}" for v in vec])
    if extra_rot:
        bone["rotation"] = r(*extra_rot)
    return anim({"rightarm": bone})

A["animation.hc.player.fp.blade_forehand"] = fp((f"{E} * (3.0 - 15.0 * {S})", f"{E} * (5.0 - 12.0 * {S})", f"{E} * {S} * 2.0"), f"{E} * (-1.0 + 2.4 * {S})")
A["animation.hc.player.fp.blade_backhand"] = fp((f"{E} * (-12.0 + 16.0 * {S})", f"{E} * (-2.0 + 4.0 * {S})", f"{E} * {S} * 2.0"), f"{E} * (1.2 - 2.4 * {S}) * 0.6")
A["animation.hc.player.fp.blade_thrust"] = fp((f"-{E} * 3.0 * {S}", f"{E} * (1.5 - 2.0 * {S})", f"{E} * (-4.0 + 10.0 * {S})"), extra_rot=(f"{E} * (10.0 - 25.0 * {S})", 0, 0))
A["animation.hc.player.fp.heavy_chop"] = fp((f"{E} * (-2.0 - 4.0 * {S})", f"{E} * (9.0 - 22.0 * {S})", 0), f"{E} * (-1.3 + 2.8 * {S})", (-60.0, 20.0, 10.0))
A["animation.hc.player.fp.heavy_sweep"] = fp((f"{E} * (7.0 - 20.0 * {S})", f"{E} * (1.0 - 4.0 * {S})", 0), f"{E} * (-1.0 + 2.2 * {S})", (-40.0, 60.0, 25.0))
A["animation.hc.player.fp.fist_jab"] = fp((f"-{E} * 3.0 * {S}", f"{E} * (1.0 - 2.0 * {S})", f"{E} * (-2.0 + 9.0 * {S})"), f"{E} * {S} * 0.3")
A["animation.hc.player.fp.fist_hook"] = fp((f"{E} * (5.0 - 13.0 * {S})", 0, f"{E} * 4.0 * {S}"), f"{E} * (-0.6 + 1.2 * {S})", (-20.0, 50.0, 10.0))

WD = "-query.walk_distance * 180.0"
A["animation.hc.player.fp.motion"] = anim({
    "rightarm": {
        "position": r(f"math.sin({WD}) * variable.hc_sprint * 1.6", f"-math.abs(math.cos({WD})) * variable.hc_sprint * 1.8 - variable.hc_land * 3.0 + variable.hc_airb * variable.hc_fall * 1.5", 0),
        "rotation": r(0, 0, f"math.sin({WD}) * variable.hc_sprint * 4.0"),
    }
})
A["animation.hc.player.fp.bow"] = anim({
    "rightitem": {
        "position": r(f"math.sin(query.life_time * 1400.0) * {SH} * 0.3", f"math.cos(query.life_time * 1250.0) * {SH} * 0.3", 0),
        "rotation": r(0, 0, f"-{D} * 6.0"),
    }
})

# ---------- controllers ----------
TP = "!variable.is_first_person && !variable.is_paperdoll && !variable.map_face_icon"
FPC = "variable.is_first_person && !variable.is_paperdoll"
C = {
    # third-person swing: replaces the vanilla "attack.rotations" alias; tools and blocks keep the vanilla swing
    "controller.animation.hc.player.attack": {"initial_state": "default", "states": {"default": {"animations": [
        {"hc_attack_vanilla": "variable.hc_kind == 0"},
        {"hc_attack_blade_forehand": "variable.hc_kind == 1 && variable.hc_combo == 0"},
        {"hc_attack_blade_backhand": "variable.hc_kind == 1 && variable.hc_combo == 1"},
        {"hc_attack_blade_thrust": "variable.hc_kind == 1 && variable.hc_combo == 2"},
        {"hc_attack_heavy_chop": "variable.hc_kind == 2 && variable.hc_combo != 1"},
        {"hc_attack_heavy_sweep": "variable.hc_kind == 2 && variable.hc_combo == 1"},
        {"hc_attack_fist_jab": "variable.hc_kind == 3 && variable.hc_combo != 2"},
        {"hc_attack_fist_hook": "variable.hc_kind == 3 && variable.hc_combo == 2"},
    ]}}},
    # first-person swing: replaces the vanilla "first_person_attack_rotation" alias (VR keeps its own)
    "controller.animation.hc.player.fp_attack": {"initial_state": "default", "states": {"default": {"animations": [
        {"hc_fp_attack_vanilla": "variable.hc_kind == 0"},
        {"hc_fp_blade_forehand": "variable.hc_kind == 1 && variable.hc_combo == 0"},
        {"hc_fp_blade_backhand": "variable.hc_kind == 1 && variable.hc_combo == 1"},
        {"hc_fp_blade_thrust": "variable.hc_kind == 1 && variable.hc_combo == 2"},
        {"hc_fp_heavy_chop": "variable.hc_kind == 2 && variable.hc_combo != 1"},
        {"hc_fp_heavy_sweep": "variable.hc_kind == 2 && variable.hc_combo == 1"},
        {"hc_fp_fist_jab": "variable.hc_kind == 3 && variable.hc_combo != 2"},
        {"hc_fp_fist_hook": "variable.hc_kind == 3 && variable.hc_combo == 2"},
    ]}}},
    # everything else, layered after the vanilla root controller
    "controller.animation.hc.player.actions": {"initial_state": "default", "states": {"default": {"animations": [
        {"hc_locomotion": f"{TP} && variable.hc_live"},
        {"hc_bow_pose": f"{TP} && variable.hc_drawing && variable.hc_rimefang"},
        {"hc_bow_draw": f"{TP} && variable.hc_drawing"},
        {"hc_bow_release": f"{TP} && variable.hc_release > 0.0"},
        {"hc_fp_motion": FPC},
        {"hc_fp_bow": f"{FPC} && variable.hc_drawing"},
    ]}}},
}

ALIASES = {
    "attack.rotations": "controller.animation.hc.player.attack",
    "first_person_attack_rotation": "controller.animation.hc.player.fp_attack",
    "hc_actions": "controller.animation.hc.player.actions",
    "hc_attack_vanilla": "animation.player.attack.rotations",
    "hc_fp_attack_vanilla": "animation.player.first_person.attack_rotation",
    "hc_bow_pose": "animation.player.bow_equipped",
    "hc_locomotion": "animation.hc.player.locomotion",
    "hc_bow_draw": "animation.hc.player.bow_draw",
    "hc_bow_release": "animation.hc.player.bow_release",
    "hc_fp_motion": "animation.hc.player.fp.motion",
    "hc_fp_bow": "animation.hc.player.fp.bow",
}
for k in ["blade_forehand", "blade_backhand", "blade_thrust", "heavy_chop", "heavy_sweep", "fist_jab", "fist_hook"]:
    ALIASES[f"hc_attack_{k}"] = f"animation.hc.player.attack.{k}"
    ALIASES[f"hc_fp_{k}"] = f"animation.hc.player.fp.{k}"

# ---------- per-frame state (pre_animation) ----------
ACTOR = "query.has_property('hc:look')"  # false on the menu paper doll, which has no actor to ask about items
MH = "'slot.weapon.mainhand', 0"
HEAVY = ["siege:warhammer", "siege:choirsteel_axe", "minecraft:mace"] + [f"minecraft:{m}_axe" for m in ["wooden", "stone", "copper", "iron", "golden", "diamond", "netherite"]]
BLADE = ["siege:longsword", "siege:minute_hand", "siege:warlords_brand", "siege:oath_of_oswin", "siege:choirsteel_sword"] + [f"minecraft:{m}_sword" for m in ["wooden", "stone", "copper", "iron", "golden", "diamond", "netherite"]]
names = lambda xs: ", ".join(f"'{x}'" for x in xs)

INIT = [
    "variable.hc_last_t = 0.0;", "variable.hc_combo = 0.0;", "variable.hc_swing_at = -10.0;", "variable.hc_kind = 0.0;",
    "variable.hc_draw_start = 0.0;", "variable.hc_was_drawing = 0.0;", "variable.hc_release_at = -10.0;", "variable.hc_release_pow = 0.0;",
    "variable.hc_sprint = 0.0;", "variable.hc_airb = 0.0;", "variable.hc_was_air = 0.0;", "variable.hc_air_start = 0.0;",
    "variable.hc_land_at = -10.0;", "variable.hc_land_pow = 0.0;", "variable.hc_freeb = 1.0;",
]
PRE = [
    # what is in the main hand
    f"variable.hc_heavy = {ACTOR} ? query.is_item_name_any({MH}, {names(HEAVY)}) : 0.0;",
    f"variable.hc_blade = {ACTOR} ? (query.is_item_name_any({MH}, {names(BLADE)}) || query.equipped_item_any_tag('slot.weapon.mainhand', 'minecraft:is_sword')) : 0.0;",
    f"variable.hc_weapon = !({ACTOR} ? query.is_item_equipped(0) : 1.0) ? 3.0 : (variable.hc_heavy ? 2.0 : (variable.hc_blade ? 1.0 : 0.0));",
    f"variable.hc_rimefang = {ACTOR} ? query.is_item_name_any({MH}, 'siege:rimefang_bow') : 0.0;",
    f"variable.hc_bow = variable.hc_rimefang || ({ACTOR} ? query.is_item_name_any({MH}, 'minecraft:bow') : 0.0);",
    # swings: each new swing moves the combo on (forehand, backhand, thrust...); a pause of 1.2 s starts it over
    "variable.hc_t = math.clamp(variable.attack_time, 0.0, 1.0);",
    "variable.hc_new_swing = variable.attack_time > 0.0 && (variable.hc_last_t <= 0.0 || variable.attack_time < variable.hc_last_t);",
    "variable.hc_combo = variable.hc_new_swing ? ((query.life_time - variable.hc_swing_at > 1.2) ? 0.0 : math.mod(variable.hc_combo + 1.0, 3.0)) : variable.hc_combo;",
    "variable.hc_swing_at = variable.hc_new_swing ? query.life_time : variable.hc_swing_at;",
    "variable.hc_kind = variable.hc_new_swing ? variable.hc_weapon : variable.hc_kind;",
    "variable.hc_last_t = variable.attack_time;",
    "variable.hc_r = math.clamp((variable.hc_t - 0.65) / 0.35, 0.0, 1.0);",
    "variable.hc_e = variable.attack_time > 0.0 ? math.sin(math.min(variable.hc_t / 0.2, 1.0) * 90.0) * (1.0 - variable.hc_r * variable.hc_r * (3.0 - 2.0 * variable.hc_r)) : 0.0;",
    "variable.hc_q = math.clamp((variable.hc_t - 0.2) / 0.35, 0.0, 1.0);",
    "variable.hc_s = variable.hc_q * variable.hc_q * (3.0 - 2.0 * variable.hc_q);",
    # bow: how far drawn (full at 1 s), shaking after 1.5 s, and a short follow-through after letting go
    "variable.hc_drawing = variable.hc_bow && variable.item_use_normalized > 0.0 && variable.item_use_normalized < 1.0;",
    "variable.hc_draw_start = (variable.hc_drawing && !variable.hc_was_drawing) ? query.life_time : variable.hc_draw_start;",
    "variable.hc_release_pow = (!variable.hc_drawing && variable.hc_was_drawing) ? math.clamp(query.life_time - variable.hc_draw_start, 0.0, 1.0) : variable.hc_release_pow;",
    "variable.hc_release_at = (!variable.hc_drawing && variable.hc_was_drawing) ? query.life_time : variable.hc_release_at;",
    "variable.hc_was_drawing = variable.hc_drawing;",
    "variable.hc_draw = variable.hc_drawing ? math.clamp(query.life_time - variable.hc_draw_start, 0.0, 1.0) : 0.0;",
    "variable.hc_shake = variable.hc_drawing ? math.clamp((query.life_time - variable.hc_draw_start - 1.5) / 3.0, 0.0, 1.0) : 0.0;",
    "variable.hc_release = (variable.hc_release_pow > 0.3 && variable.hc_bow) ? math.clamp(1.0 - (query.life_time - variable.hc_release_at) / 0.35, 0.0, 1.0) * variable.hc_release_pow : 0.0;",
    # in the air, landing after a fall, sprinting (all eased so nothing snaps)
    "variable.hc_in_air = !query.is_on_ground && !query.is_riding && !query.is_in_water && variable.swim_amount <= 0.0 && !query.is_gliding;",
    "variable.hc_landed = !variable.hc_in_air && variable.hc_was_air && query.life_time - variable.hc_air_start > 0.35;",
    "variable.hc_land_pow = variable.hc_landed ? math.clamp((query.life_time - variable.hc_air_start) / 1.2, 0.35, 1.0) : variable.hc_land_pow;",
    "variable.hc_land_at = variable.hc_landed ? query.life_time : variable.hc_land_at;",
    "variable.hc_air_start = (variable.hc_in_air && !variable.hc_was_air) ? query.life_time : variable.hc_air_start;",
    "variable.hc_was_air = variable.hc_in_air;",
    "variable.hc_land = variable.hc_land_pow * math.clamp(1.0 - (query.life_time - variable.hc_land_at) / 0.3, 0.0, 1.0);",
    "variable.hc_k = math.min(1.0, query.delta_time * 8.0);",
    "variable.hc_sprint = variable.hc_sprint + ((query.is_sprinting && query.is_on_ground && !query.is_riding) - variable.hc_sprint) * variable.hc_k;",
    "variable.hc_airb = variable.hc_airb + ((variable.hc_in_air && query.life_time - variable.hc_air_start > 0.15) - variable.hc_airb) * variable.hc_k;",
    "variable.hc_fall = math.clamp(-query.vertical_speed / 20.0, 0.0, 1.0);",
    "variable.hc_freeb = variable.hc_freeb + ((variable.attack_time <= 0.0 && !variable.hc_drawing && !query.blocking && variable.hc_release <= 0.0) - variable.hc_freeb) * math.min(1.0, query.delta_time * 12.0);",
    "variable.hc_free = variable.hc_freeb;",
    "variable.hc_live = !query.is_sleeping && !query.is_emoting && !query.is_riding && !query.is_crawling && variable.swim_amount <= 0.0;",
]

def dump(path, data):
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")

dump(os.path.join(RP, "animations/player_actions.animation.json"), {"format_version": "1.10.0", "animations": A})
dump(os.path.join(RP, "animation_controllers/player_actions.animation_controllers.json"), {"format_version": "1.10.0", "animation_controllers": C})

# wire into the player entity (idempotent: old hc_ lines are replaced)
ep = os.path.join(RP, "entity/player.entity.json")
ent = json.load(open(ep))
d = ent["minecraft:client_entity"]["description"]
sc = d["scripts"]
sc["initialize"] = [l for l in sc["initialize"] if not l.startswith("variable.hc_")] + INIT
sc["pre_animation"] = [l for l in sc["pre_animation"] if not l.startswith("variable.hc_")] + PRE
sc["animate"] = [a for a in sc["animate"] if a != "hc_actions"] + ["hc_actions"]
d["animations"].update(ALIASES)
dump(ep, ent)
print(f"{len(A)} animations, {len(C)} controllers, {len(PRE)} per-frame lines")
