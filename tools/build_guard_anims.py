#!/usr/bin/env python3
"""Writes the guards' own animations (tools/build_guard_anims.py). Run from the repo root.

The Man-at-Arms and the Archer used only the vanilla humanoid moves. Mateo's rule is that mobs get custom
animations, so they now have their own:
  march    a soldier's walk: steady legs, the sword arm held still, a little lean and bob when running
  idle     breathing, weight shifting from foot to foot, and a slow look round while nothing is happening
  ready    (Man-at-Arms) sword up and feet apart while it has a target, eased in and out
  slash    (Man-at-Arms) a wind-up over the shoulder and a diagonal cut with the body turning into it, and a step in
  aim      (Archer) side-on stance, feet apart, the string hand drawing back and trembling at full draw; the vanilla
           bow pose stays underneath so the bow still points at the target
  hurt     a flinch back when hit
  salute   hand to the right brow when sent to a post (played by scripts/guardposts/index.js)

Bones are the vanilla humanoid ones (geometry.humanoid.custom): head and arms hang off body, legs off root.
"""
import json, os, sys

ROOT = sys.argv[1] if len(sys.argv) > 1 else os.getcwd()
RP = os.path.join(ROOT, "Siege_Nights_RP")


def r(x=0, y=0, z=0):
    f = lambda v: v if isinstance(v, str) else float(v)
    return [f(x), f(y), f(z)]


MV = "variable.hc_mv"        # 0 standing .. 1 walking
ST = f"(1.0 - {MV})"          # standing
RDY = "variable.hc_rdy"       # eases to 1 while it has a target
W, S = "variable.hc_wind", "variable.hc_strike"
HURT = "math.clamp(query.hurt_time / 8.0, 0.0, 1.0)"
DRAW = "variable.hc_draw"     # archer's draw, 0..1 on a loop while aiming
T = "query.life_time"

A = {}
A["animation.hc.guard.march"] = {"loop": True, "bones": {
    "rightLeg": {"rotation": r("variable.tcos0 * 1.2", 0, 0)},
    "leftLeg": {"rotation": r("-variable.tcos0 * 1.2", 0, 0)},
    "rightArm": {"rotation": r(f"-variable.tcos0 * 0.45 - 6.0 * {MV}", 0, 0)},  # the weapon arm swings little
    "leftArm": {"rotation": r("variable.tcos0 * 0.9", 0, f"-2.0 * {MV}")},
    "body": {"rotation": r(f"query.modified_move_speed * 9.0", "-variable.tcos0 * 0.08", 0),
             "position": r(0, f"-math.abs(math.sin(query.modified_distance_moved * 38.17)) * 0.6 * {MV}", 0)},
    "head": {"rotation": r(f"-query.modified_move_speed * 7.0", "variable.tcos0 * 0.08", 0)},
}}
A["animation.hc.guard.idle"] = {"loop": True, "bones": {
    "body": {"position": r(0, f"(math.sin({T} * 95.0) + 1.0) * 0.12 * {ST}", 0),
             "rotation": r(0, 0, f"math.sin({T} * 36.0) * 1.2 * {ST}")},
    "head": {"rotation": r(f"math.sin({T} * 61.0) * 2.0 * {ST}", f"math.sin({T} * 23.0) * 22.0 * {ST} * (1.0 - {RDY})", 0)},
    "rightArm": {"rotation": r(f"math.sin({T} * 95.0) * 1.5 * {ST}", 0, f"(2.5 + math.sin({T} * 95.0) * 1.5) * {ST}")},
    "leftArm": {"rotation": r(f"-math.sin({T} * 95.0) * 1.5 * {ST}", 0, f"-(2.5 + math.sin({T} * 95.0) * 1.5) * {ST}")},
    "rightLeg": {"rotation": r(0, 0, f"(1.5 + math.sin({T} * 36.0) * 1.5) * {ST}")},
    "leftLeg": {"rotation": r(0, 0, f"(-1.5 + math.sin({T} * 36.0) * 1.5) * {ST}")},
}}
A["animation.hc.guard.ready"] = {"loop": True, "bones": {
    "rightArm": {"rotation": r(f"-42.0 * {RDY}", f"-12.0 * {RDY}", f"6.0 * {RDY}")},
    "leftArm": {"rotation": r(f"-22.0 * {RDY}", f"10.0 * {RDY}", f"-12.0 * {RDY}")},
    "body": {"rotation": r(f"6.0 * {RDY}", f"-8.0 * {RDY}", 0)},
    "head": {"rotation": r(f"-6.0 * {RDY}", f"8.0 * {RDY}", 0)},
    "rightLeg": {"rotation": r(f"-10.0 * {RDY} * {ST}", 0, f"4.0 * {RDY} * {ST}")},
    "leftLeg": {"rotation": r(f"8.0 * {RDY} * {ST}", 0, f"-4.0 * {RDY} * {ST}")},
}}
A["animation.hc.guard.slash"] = {"loop": True, "bones": {
    "rightArm": {"rotation": r(f"-115.0 * {W} + 145.0 * {S}", f"32.0 * {W} - 62.0 * {S}", f"12.0 * {W} - 6.0 * {S}")},
    "leftArm": {"rotation": r(f"-28.0 * {W} + 22.0 * {S}", f"-10.0 * {W}", f"-8.0 * {W}")},
    "body": {"rotation": r(f"-6.0 * {W} + 16.0 * {S}", f"22.0 * {W} - 44.0 * {S}", 0)},
    "head": {"rotation": r(f"6.0 * {W} - 12.0 * {S}", f"-15.0 * {W} + 30.0 * {S}", 0)},
    "rightLeg": {"rotation": r(f"-20.0 * {S}", 0, 0)},
    "leftLeg": {"rotation": r(f"10.0 * {S}", 0, 0)},
}}
A["animation.hc.guard.aim"] = {"loop": True, "bones": {
    "body": {"rotation": r(0, "-14.0", 0)},
    "head": {"rotation": r(0, "14.0", 0)},
    "rightArm": {"rotation": r(f"math.sin({T} * 1500.0) * 0.8 * {DRAW}", "14.0", 0)},
    "leftArm": {"rotation": r(f"{DRAW} * 6.0 + math.cos({T} * 1300.0) * 1.2 * {DRAW}", f"14.0 + {DRAW} * 24.0", f"-{DRAW} * 5.0")},
    "rightLeg": {"rotation": r("-6.0", 0, "5.0")},
    "leftLeg": {"rotation": r("4.0", 0, "-5.0")},
}}
A["animation.hc.guard.hurt"] = {"loop": True, "bones": {
    "body": {"rotation": r(f"-12.0 * {HURT}", 0, 0)},
    "head": {"rotation": r(f"-10.0 * {HURT}", 0, 0)},
    "rightArm": {"rotation": r(0, 0, f"12.0 * {HURT}")},
    "leftArm": {"rotation": r(0, 0, f"-12.0 * {HURT}")},
}}
A["animation.hc.guard.salute"] = {"loop": False, "animation_length": 1.3, "bones": {
    # hand up to the right brow (Mateo 2026-11-12: "more up towards the right corner of his head")
    "rightArm": {"rotation": {"0.0": r(), "0.3": r(-145, 10, 22), "0.95": r(-145, 10, 22), "1.3": r()}},
    "body": {"rotation": {"0.0": r(), "0.25": r(5, 0, 0), "0.95": r(5, 0, 0), "1.3": r()}},
    "head": {"rotation": {"0.0": r(), "0.25": r(12, 0, 0), "0.7": r(12, 0, 0), "1.0": r(-4, 0, 0), "1.3": r()}},
}}

PRE = [
    "variable.tcos0 = (Math.cos(query.modified_distance_moved * 38.17) * query.modified_move_speed / 1.0) * 57.3;",
    "variable.hc_mv = math.min(query.modified_move_speed * 4.0, 1.0);",
    "variable.hc_rdy = math.lerp(variable.hc_rdy ?? 0.0, query.has_target ? 1.0 : 0.0, 0.12);",
    "variable.hc_wind = variable.attack_time > 0.0 ? math.clamp(variable.attack_time / 0.3, 0.0, 1.0) : 0.0;",
    "variable.hc_strike = variable.attack_time > 0.3 ? math.clamp((variable.attack_time - 0.3) / 0.4, 0.0, 1.0) : 0.0;",
    "variable.hc_draw = math.clamp(math.mod(query.life_time, 2.0) / 1.5, 0.0, 1.0);",
]

ENTITIES = {
    "man_at_arms": {
        "animate": ["humanoid_base_pose", "look_at_target_default", "holding", "hc_march", "hc_idle", "hc_ready",
                    {"hc_slash": "variable.attack_time > 0.0"}, {"hc_hurt": "query.hurt_time > 0"}],
        "animations": {"hc_ready": "animation.hc.guard.ready", "hc_slash": "animation.hc.guard.slash"},
    },
    "archer": {
        "animate": ["humanoid_base_pose", "look_at_target_default", "holding", "hc_march", "hc_idle",
                    {"bow_and_arrow": "query.has_target"}, {"hc_aim": "query.has_target"}, {"hc_hurt": "query.hurt_time > 0"}],
        "animations": {"bow_and_arrow": "animation.humanoid.bow_and_arrow", "hc_aim": "animation.hc.guard.aim"},
    },
}
COMMON = {
    "humanoid_base_pose": "animation.humanoid.base_pose",
    "look_at_target_default": "animation.humanoid.look_at_target.default",
    "holding": "animation.humanoid.holding",
    "hc_march": "animation.hc.guard.march",
    "hc_idle": "animation.hc.guard.idle",
    "hc_hurt": "animation.hc.guard.hurt",
    "hc_salute": "animation.hc.guard.salute",
}


def main():
    path = os.path.join(RP, "animations", "guards.animation.json")
    with open(path, "w") as f:
        json.dump({"format_version": "1.8.0", "animations": A}, f, indent=1)
    print("wrote", os.path.relpath(path, ROOT))
    for name, spec in ENTITIES.items():
        p = os.path.join(RP, "entity", f"{name}.entity.json")
        with open(p) as f:
            data = json.load(f)
        d = data["minecraft:client_entity"]["description"]
        d["scripts"]["pre_animation"] = PRE
        d["scripts"]["animate"] = spec["animate"]
        d["animations"] = {**COMMON, **spec["animations"]}
        with open(p, "w") as f:
            json.dump(data, f, indent=2)
            f.write("\n")
        print("wrote", os.path.relpath(p, ROOT))


if __name__ == "__main__":
    main()
