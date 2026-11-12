#!/usr/bin/env python3
"""Writes the Sorcerer's cast animations, cast particles and their particle sheet. Run from the repo root.

    python3 tools/build_sorcerer_fx.py

Safe to run twice. Writes:
  Siege_Nights_RP/animations/sorcerer_cast.animation.json     one move per power (played by script)
  Siege_Nights_RP/particles/<name>.particle.json             the siege:arc_* particles
  Siege_Nights_RP/textures/particle/hc_arcana.png            their sheet (64x16, four 16x16 sprites)

The script side is Siege_Nights_BP/scripts/townhall/marked_fx.js. Notes: docs/SORCERER-FX.md.
"""
import json, math, os, sys

ROOT = sys.argv[1] if len(sys.argv) > 1 else os.getcwd()
RP = os.path.join(ROOT, "Siege_Nights_RP")


def dump(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=1)
        f.write("\n")


# ---------- cast animations ----------
# Played with player.playAnimation() on their own controller, so they add on top of the vanilla moves
# and the PR #127 moves. Arms: -x raises forward, +x swings back; right arm +z is outward, left arm -z is
# outward; +y turns toward the player's right. In first person only a quarter of the move shows, so the
# arm in view gives a small push instead of flying around the screen.
K = "(variable.is_first_person ? 0.25 : 1.0)"


def v(x, y=0, z=0):
    return [f"{x} * {K}" if x else 0.0, f"{y} * {K}" if y else 0.0, f"{z} * {K}" if z else 0.0]


def move(length, bones):
    """bones: {bone: [(time, (x, y, z)), ...]}; every bone starts and ends at rest."""
    out = {}
    for bone, keys in bones.items():
        frames = {"0.0": v(0)}
        for t, rot in keys:
            frames[str(t)] = v(*rot)
        frames[str(length)] = v(0)
        out[bone] = {"rotation": frames}
    return {"animation_length": length, "bones": out}


def twist(keys):
    """waist turn with the head turning back by the same amount, so the aim stays put"""
    return {"waist": keys, "head": [(t, (-x, -y, -z)) for t, (x, y, z) in keys]}


CAST = {
    # Ember Bolt: pull the Ember to the chest, then throw the hand forward
    "bolt": move(0.5, {
        "rightarm": [(0.08, (-40, 35, 0)), (0.16, (-100, -5, 0)), (0.28, (-85, 0, 0))],
        "leftarm": [(0.08, (-20, 0, -10)), (0.16, (15, 0, -15))],
        **twist([(0.08, (0, 16, 0)), (0.16, (4, -12, 0))]),
    }),
    # Ward: cross both arms over the chest, then fling them wide
    "ward": move(0.8, {
        "rightarm": [(0.15, (-75, -45, 0)), (0.25, (-75, -45, 0)), (0.4, (-30, 0, 75))],
        "leftarm": [(0.15, (-75, 45, 0)), (0.25, (-75, 45, 0)), (0.4, (-30, 0, -75))],
        **twist([(0.15, (8, 0, 0)), (0.4, (-8, 0, 0))]),
    }),
    # Blink: drop the arms back and lean in, as if pulled forward
    "blink": move(0.4, {
        "rightarm": [(0.1, (35, 0, 15))],
        "leftarm": [(0.1, (35, 0, -15))],
        **twist([(0.1, (14, 0, 0))]),
    }),
    # Echo Sight: two fingers to the temple, the other hand low and open, head lifts to listen
    "echo": move(0.9, {
        "rightarm": [(0.25, (-135, -40, 0)), (0.6, (-135, -40, 0))],
        "leftarm": [(0.25, (-20, 0, -35)), (0.6, (-20, 0, -35))],
        "head": [(0.25, (-12, 0, 6)), (0.6, (-12, 0, 6))],
    }),
    # Bind: both hands out, close, and yank back
    "bind": move(0.7, {
        "rightarm": [(0.15, (-90, 5, 0)), (0.35, (-90, 5, 0)), (0.45, (-45, 15, 0))],
        "leftarm": [(0.15, (-80, -5, 0)), (0.35, (-80, -5, 0)), (0.45, (-40, -15, 0))],
        **twist([(0.35, (2, 0, 0)), (0.45, (-8, 0, 0))]),
    }),
    # Halfstep: arms sweep down and back, a low lean, like slipping under a curtain
    "step": move(0.6, {
        "rightarm": [(0.2, (40, 0, 25))],
        "leftarm": [(0.2, (40, 0, -25))],
        **twist([(0.2, (14, 0, 0))]),
    }),
    # Veilstep: both hands raised high and torn apart
    "hollowstep": move(1.2, {
        "rightarm": [(0.3, (-170, 0, -10)), (0.5, (-170, 0, -10)), (0.75, (-155, 0, 45))],
        "leftarm": [(0.3, (-170, 0, 10)), (0.5, (-170, 0, 10)), (0.75, (-155, 0, -45))],
        **twist([(0.3, (-6, 0, 0)), (0.75, (-10, 0, 0))]),
    }),
    # Choir's Call: raise the Ember high and bring it down like ringing a bell
    "choir": move(1.0, {
        "rightarm": [(0.3, (-175, 0, 0)), (0.45, (-60, 0, 0)), (0.6, (-70, 0, 0))],
        "leftarm": [(0.3, (-20, 0, -20)), (0.45, (10, 0, -10))],
        **twist([(0.3, (-6, 0, 0)), (0.45, (10, 0, 0))]),
    }),
    # Overwhelmed: the Choir is too loud; hands to the head, doubled over
    "overwhelmed": move(1.4, {
        "rightarm": [(0.2, (-150, -55, 0)), (1.0, (-150, -55, 0))],
        "leftarm": [(0.2, (-150, 55, 0)), (1.0, (-150, 55, 0))],
        "waist": [(0.2, (22, 0, 0)), (1.0, (22, 0, 0))],
        "head": [(0.2, (10, 0, 0)), (0.6, (10, 8, 0)), (1.0, (10, -8, 0))],
    }),
}

dump(os.path.join(RP, "animations", "sorcerer_cast.animation.json"), {
    "format_version": "1.10.0",
    "animations": {f"animation.siege.player.cast.{k}": a for k, a in CAST.items()},
})


# ---------- particle sheet ----------
# Four 16x16 sprites, white on clear so tinting gives the colour: glow, spark, ring, shard.
SHEET = os.path.join(RP, "textures", "particle", "hc_arcana.png")
try:
    from PIL import Image

    img = Image.new("RGBA", (64, 16), (0, 0, 0, 0))
    px = img.load()
    for y in range(16):
        for x in range(16):
            dx, dy = x - 7.5, y - 7.5
            d = math.hypot(dx, dy)
            # 0 glow: soft round falloff with a hot core
            a = max(0.0, 1 - d / 8) ** 1.6
            px[x, y] = (255, 255, 255, int(255 * a))
            # 1 spark: a four-point star
            s = max(0.0, 1 - (abs(dx) * abs(dy)) / 3.0 - d / 9) if d < 8 else 0
            px[16 + x, y] = (255, 255, 255, int(255 * min(1, max(0, s)) ** 1.2))
            # 2 ring: a thin bright ring with a faint inside
            r = max(0.0, 1 - abs(d - 6.2) / 1.3) + (0.12 if d < 6 else 0)
            px[32 + x, y] = (255, 255, 255, int(255 * min(1, r)))
            # 3 shard: a tall thin diamond, a crack of light
            h = max(0.0, 1 - abs(dx) / 2.2 - abs(dy) / 8)
            px[48 + x, y] = (255, 255, 255, int(255 * min(1, h * 1.4)))
    img.save(SHEET)
except ImportError:
    if not os.path.exists(SHEET):
        sys.exit("needs Pillow (pip install pillow) to draw the particle sheet the first time")

SPRITE = {"glow": 0, "spark": 16, "ring": 32, "shard": 48}

# House colours: Choirsteel purple, magenta veins, the Crown's blue gems.
VIOLET = [0.62, 0.32, 0.95]
MAGENTA = [0.95, 0.28, 0.78]
GEMBLUE = [0.38, 0.55, 1.0]
INDIGO = [0.32, 0.22, 0.7]
PALE = [0.88, 0.8, 1.0]


def particle(name, *, sprite, size, life, count=1, shape=None, speed=0.0, accel=(0, 0, 0), drag=0.0,
             colors=(VIOLET,), steady=None, facing="lookat_xyz", grow=None, spin=0.0):
    c = {}
    if steady:
        c["minecraft:emitter_rate_steady"] = {"spawn_rate": steady[0], "max_particles": steady[1]}
        c["minecraft:emitter_lifetime_once"] = {"active_time": steady[2]}
    else:
        c["minecraft:emitter_rate_instant"] = {"num_particles": count}
        c["minecraft:emitter_lifetime_once"] = {"active_time": 0.05}
    if shape is None:
        c["minecraft:emitter_shape_point"] = {}
    else:
        kind, args = shape
        c[f"minecraft:emitter_shape_{kind}"] = args
    c["minecraft:particle_lifetime_expression"] = {"max_lifetime": life if isinstance(life, str) else f"{life} * (0.8 + math.random(0, 0.4))"}
    c["minecraft:particle_initial_speed"] = speed
    c["minecraft:particle_motion_dynamic"] = {"linear_acceleration": list(accel), "linear_drag_coefficient": drag}
    if spin:
        c["minecraft:particle_initial_spin"] = {"rotation": "math.random(0, 360)", "rotation_rate": spin}
    t = "variable.particle_age / variable.particle_lifetime"
    sz = grow or f"{size} * (1 - {t} * 0.6)"
    c["minecraft:particle_appearance_billboard"] = {
        "size": [sz, sz],
        "facing_camera_mode": facing,
        "uv": {"texture_width": 64, "texture_height": 16, "uv": [SPRITE[sprite], 0], "uv_size": [16, 16]},
    }
    if len(colors) == 1:
        tint = {"color": [*colors[0], f"1 - {t}"]}
    else:
        stops = {f"{i / (len(colors) - 1):.2f}": [*col, 1.0] for i, col in enumerate(colors)}
        tint = {"color": {"interpolant": t, "gradient": stops}}
    c["minecraft:particle_appearance_tinting"] = tint
    return {
        "format_version": "1.10.0",
        "particle_effect": {
            "description": {"identifier": f"siege:{name}", "basic_render_parameters": {"material": "particles_add", "texture": "textures/particle/hc_arcana"}},
            "components": c,
        },
    }


# variable.ring_size, set by the script (MolangVariableMap), is how wide a ring grows; 0 means the default.
RING = "(variable.ring_size > 0 ? variable.ring_size : {d}) * math.min(1, variable.particle_age / variable.particle_lifetime * 1.6)"

PARTICLES = {
    # Ember Bolt: the beads of the bolt's path, and the burst where it lands
    "arc_trail": particle("arc_trail", sprite="glow", size=0.32, life=0.35, colors=(PALE, MAGENTA, VIOLET), accel=(0, 0.4, 0)),
    "arc_burst": particle("arc_burst", sprite="spark", size=0.22, life=0.5, count=14, shape=("sphere", {"radius": 0.15, "direction": "outwards"}),
                          speed=4.0, drag=4.0, colors=(PALE, MAGENTA, INDIGO), spin=180),
    # Ward: motes settle onto a shell around you
    "arc_ward": particle("arc_ward", sprite="glow", size=0.2, life=0.9, count=36, shape=("sphere", {"offset": [0, 1, 0], "radius": 1.1, "surface_only": True, "direction": "inwards"}),
                         speed=0.3, accel=(0, 0.25, 0), drag=1.0, colors=(GEMBLUE, VIOLET)),
    # Blink: a short crack of light where you were and where you land
    "arc_tear": particle("arc_tear", sprite="shard", size=0.9, life=0.45, count=5, shape=("box", {"offset": [0, 1, 0], "half_dimensions": [0.25, 0.7, 0.25], "direction": "inwards"}),
                         speed=0.6, colors=(PALE, VIOLET, INDIGO), facing="rotate_y"),
    # a ring that spreads over the ground: Echo Sight, Choir's Call, the Crescendo
    "arc_ring": particle("arc_ring", sprite="ring", size=1, life="1.1", facing="emitter_transform_xz", colors=(PALE, VIOLET, INDIGO),
                         grow=RING.format(d=8)),
    # Echo Sight: a small mark rising over each creature you can sense
    "arc_mark": particle("arc_mark", sprite="spark", size=0.28, life=1.0, accel=(0, 0.6, 0), drag=1.5, colors=(MAGENTA, VIOLET), spin=90),
    # Bind: dark links along the line, and a snare closing at the feet
    "arc_link": particle("arc_link", sprite="shard", size=0.3, life=0.6, colors=(INDIGO, VIOLET), spin=240),
    "arc_snare": particle("arc_snare", sprite="ring", size=1, life="0.6", facing="emitter_transform_xz", colors=(VIOLET, INDIGO),
                          grow="2.4 * (1 - variable.particle_age / variable.particle_lifetime * 0.8)"),
    # Halfstep: you peel away in flakes
    "arc_peel": particle("arc_peel", sprite="glow", size=0.18, life=1.0, count=24, shape=("box", {"offset": [0, 1, 0], "half_dimensions": [0.35, 0.9, 0.35], "direction": "outwards"}),
                         speed=0.4, accel=(0, 0.8, 0), drag=1.2, colors=(VIOLET, INDIGO)),
    # Veilstep: the world tears open, motes spiral into the gap
    "arc_rift": particle("arc_rift", sprite="shard", size=0.5, life=0.8, steady=(70, 120, 0.9),
                         shape=("disc", {"offset": [0, 1.1, 0], "radius": 1.3, "plane_normal": "x", "surface_only": True, "direction": "inwards"}),
                         speed=1.4, drag=0.5, colors=(PALE, MAGENTA, INDIGO), spin=120),
    # The Ember in your hand: a faint drift of sparks, more of them as Resonance climbs (count set by script)
    "arc_smoulder": particle("arc_smoulder", sprite="glow", size=0.1, life=0.8, steady=("variable.ember_rate > 0 ? variable.ember_rate : 3", 20, 1.0),
                             shape=("sphere", {"radius": 0.08, "direction": "outwards"}), speed=0.05, accel=(0, 0.35, 0), colors=(MAGENTA, VIOLET)),
    # Loud: the halo of a Sorcerer the Hollow can hear
    "arc_halo": particle("arc_halo", sprite="spark", size=0.16, life=1.0, count=6, shape=("disc", {"radius": 0.35, "surface_only": True, "direction": "outwards"}),
                         speed=0.05, accel=(0, 0.15, 0), colors=(MAGENTA, INDIGO), spin=60),
}

for name, p in PARTICLES.items():
    dump(os.path.join(RP, "particles", f"{name}.particle.json"), p)

print(f"{len(CAST)} cast moves, {len(PARTICLES)} particles, sheet {os.path.relpath(SHEET, ROOT)}")


# ---------- the magic hotbar: one spell icon per power, and the hidden satchel ----------
# Opening the magic hotbar packs your nine hotbar slots into a satchel entity that follows you (it has no
# model and no collision) and puts these icons in their place. The scripts: townhall/spellbar.js.
BP = os.path.join(ROOT, "Siege_Nights_BP")
SPELLS = {  # key -> (skill id, name)
    "bolt": ("arc_bolt", "Ember Bolt"), "ward": ("arc_ward", "Ward"), "blink": ("arc_blink", "Blink"),
    "echo": ("arc_echo", "Echo Sight"), "bind": ("arc_bind", "Bind"), "step": ("arc_step", "Halfstep"),
    "choir": ("arc_choir", "Choir's Call"), "hollowstep": ("arc_hollowstep", "Veilstep"),
}
for key, (skill, name) in SPELLS.items():
    dump(os.path.join(BP, "items", "arcana", f"spell_{key}.json"), {
        "format_version": "1.21.60",
        "minecraft:item": {
            "description": {"identifier": f"siege:spell_{key}", "menu_category": {"category": "equipment"}},
            "components": {
                "minecraft:icon": f"siege_spell_{key}",
                "minecraft:display_name": {"value": f"item.siege:spell_{key}.name"},
                "minecraft:max_stack_size": 1,
                "minecraft:glint": True,
                "minecraft:hand_equipped": False,
                # the grey sweep over the icon while the power cools down (started by the script)
                "minecraft:cooldown": {"category": f"siege_spell_{key}", "duration": 0.05},
            },
        },
    })

dump(os.path.join(BP, "entities", "spell_satchel.json"), {
    "format_version": "1.21.60",
    "minecraft:entity": {
        "description": {"identifier": "siege:spell_satchel", "is_spawnable": False, "is_summonable": True},
        "components": {
            "minecraft:type_family": {"family": ["spell_satchel", "inanimate"]},
            "minecraft:inventory": {"container_type": "inventory", "inventory_size": 9, "private": True},
            "minecraft:health": {"value": 1, "max": 1},
            "minecraft:collision_box": {"width": 0.01, "height": 0.01},
            "minecraft:physics": {"has_gravity": False, "has_collision": False},
            "minecraft:knockback_resistance": {"value": 1},
            "minecraft:persistent": {},
            "minecraft:fire_immune": {},
            "minecraft:breathable": {"breathes_water": True, "breathes_air": True, "breathes_lava": True, "breathes_solids": True},
            "minecraft:damage_sensor": {"triggers": [{"cause": "all", "deals_damage": "no"}]},
        },
    },
})

dump(os.path.join(RP, "entity", "spell_satchel.entity.json"), {
    "format_version": "1.10.0",
    "minecraft:client_entity": {"description": {"identifier": "siege:spell_satchel"}},
})

# icons reuse the skill tree glyphs
ITX = os.path.join(RP, "textures", "item_texture.json")
itx = json.load(open(ITX))
for key, (skill, _) in SPELLS.items():
    itx["texture_data"][f"siege_spell_{key}"] = {"textures": f"textures/ui/hc/skill/{skill}"}
dump(ITX, itx)

LANG = os.path.join(RP, "texts", "en_US.lang")
lines = open(LANG, encoding="utf-8").read().splitlines()
lines = [l for l in lines if not l.startswith("item.siege:spell_") and not l.startswith("entity.siege:spell_satchel")]
lines += [f"item.siege:spell_{key}.name={name}" for key, (_, name) in SPELLS.items()]
lines.append("entity.siege:spell_satchel.name=Sorcerer's Satchel")
open(LANG, "w", encoding="utf-8").write("\n".join(lines) + "\n")

print(f"{len(SPELLS)} spell icons, satchel entity")
