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


# =====================================================================================================================
# Spell pass (2026-11-14, Mateo: "I see all the 'what's weak' notes, let's fix those"). Preview: the Ember Spellbook
# artifact. Adds the 3D effect objects (siege:arc_fx), the new particles, the Echo fog, the Crescendo move, the Marked
# layer on the player, and the "loud" hunting goal on Hollow creatures.
# =====================================================================================================================

# ---------- one effect entity, six forms: shard, ward plates, chains, bell, rift, afterimage ----------
# siege:form picks the model; siege:count shows 0-3 plates or chain loops. Scripts move and remove them
# (townhall/marked_fx.js); a timer clears any the script forgot (world closed mid-spell).
FORMS = ["shard", "ward", "chains", "bell", "rift", "ghost"]


def cube(origin, size, uv=(0, 0), rotation=None, pivot=None, inflate=0):
    c = {"origin": list(origin), "size": list(size), "uv": list(uv)}
    if rotation:
        c["rotation"] = list(rotation)
        c["pivot"] = list(pivot or [origin[0] + size[0] / 2, origin[1] + size[1] / 2, origin[2] + size[2] / 2])
    if inflate:
        c["inflate"] = inflate
    return c


def bone(name, pivot, cubes=(), parent=None, rotation=None):
    b = {"name": name, "pivot": list(pivot), "cubes": list(cubes)}
    if parent:
        b["parent"] = parent
    if rotation:
        b["rotation"] = list(rotation)
    return b


def geo(name, bones, w=128, h=128, vis=(3, 3, 0)):
    return {"description": {"identifier": f"geometry.siege.arc_{name}", "texture_width": w, "texture_height": h,
                            "visible_bounds_width": vis[0], "visible_bounds_height": vis[1], "visible_bounds_offset": [0, vis[2], 0]},
            "bones": bones}


A = (64, 0)  # second half of every arc_fx texture: the bright accent colour

GEOS = {}
# Ember shard: a long thin diamond with a bright core (flies along z)
GEOS["shard"] = geo("shard", [bone("shard", [0, 0, 0], [
    cube([-1, -1, -5], [2, 2, 10], rotation=[0, 0, 45], pivot=[0, 0, 0]),
    cube([-0.5, -0.5, -6.5], [1, 1, 13], A),
])], vis=(2, 2, 0))
# Ward: three bell-glass plates circling at chest height; plateN shows while siege:count >= N
plates = [bone("ring", [0, 18, 0])]
for i in range(3):
    plates.append(bone(f"plate{i + 1}", [0, 18, 0], [cube([-2.5, 14, 11.5], [5, 8, 0.4]), cube([-0.25, 15, 11.3], [0.5, 6, 0.2], A), cube([-1.75, 18.5, 11.3], [3.5, 0.5, 0.2], A)],
                       parent="ring", rotation=[0, i * 120, 0]))
GEOS["ward"] = geo("ward", plates, vis=(3, 3, 1))
# Bind: three loops of chain links at the feet, waist and chest
loops = [bone("chains", [0, 0, 0])]
for i, y in enumerate((3, 11, 19)):
    links = []
    for k in range(10):
        a = k / 10 * 360
        r = math.radians(a)
        x, z = math.sin(r) * 7, math.cos(r) * 7
        links.append(cube([x - 1, y - 1, z - 2], [2, 2, 4] if k % 2 else [1, 3, 4], A if k % 3 == 0 else (0, 0), rotation=[0, a, 0], pivot=[x, y, z]))
    loops.append(bone(f"loop{i + 1}", [0, y, 0], links, parent="chains"))
GEOS["chains"] = geo("chains", loops, vis=(3, 3, 1))
# Choir's Call: a ghostly bell, 2.5 blocks across, hung from its crown (the toll swings it)
GEOS["bell"] = geo("bell", [bone("bell", [0, 44, 0], [
    cube([-4, 38, -4], [8, 5, 8]), cube([-7, 31, -7], [14, 7, 14]), cube([-10, 22, -10], [20, 9, 20]),
    cube([-13, 17, -13], [26, 5, 26]), cube([-14, 15, -14], [28, 2, 28], A), cube([-1, 43, -1], [2, 3, 2], A),
]), bone("clapper", [0, 38, 0], [cube([-1, 18, -1], [2, 20, 2], A), cube([-2.5, 15, -2.5], [5, 4, 5], A)], parent="bell")], vis=(4, 4, 1.5))
# Veilstep: a tall jagged slit of dark with a pale edge, facing the way you looked
rift = []
for k in range(12):
    y = k * 4
    w = round(math.sin((k + 0.5) / 12 * math.pi) * 9 + 1, 1)
    jag = 1.5 if k % 2 else -1.5
    rift.append(cube([-w / 2 + jag, y, -0.25], [w, 4, 0.5]))
    rift.append(cube([-w / 2 + jag - 1, y, -0.35], [1, 4, 0.7], A))
    rift.append(cube([w / 2 + jag, y, -0.35], [1, 4, 0.7], A))
GEOS["rift"] = geo("rift", [bone("rift", [0, 0, 0], rift)], vis=(3, 4, 1.5))
# Blink: your afterimage, leaning in with the arms swept back (the Blink move)
GEOS["ghost"] = geo("ghost", [
    bone("ghost", [0, 0, 0]),
    bone("legs", [0, 12, 0], [cube([-4, 0, -2], [4, 12, 4]), cube([0, 0, -2], [4, 12, 4])], parent="ghost"),
    bone("body", [0, 12, 0], [cube([-4, 12, -2], [8, 12, 4]), cube([-4, 24, -4], [8, 8, 8])], parent="ghost", rotation=[14, 0, 0]),
    bone("rarm", [-5, 22, 0], [cube([-8, 12, -2], [4, 12, 4])], parent="body", rotation=[35, 0, 15]),
    bone("larm", [5, 22, 0], [cube([4, 12, -2], [4, 12, 4])], parent="body", rotation=[35, 0, -15]),
    bone("cracks", [0, 12, 0], [cube([-0.25, 2, -2.2], [0.5, 28, 0.2], A), cube([-3, 16, -2.2], [6, 0.5, 0.2], A)], parent="body"),
], vis=(2, 3, 1))

dump(os.path.join(RP, "models", "entity", "siege_arc_fx.geo.json"), {"format_version": "1.12.0", "minecraft:geometry": [GEOS[f] for f in FORMS]})

# textures: left half the body colour, right half the bright accent; alpha blended
TEX = {  # form -> (body rgba, accent rgba)
    "shard": ((215, 180, 255, 210), (255, 245, 255, 255)),
    "ward": ((120, 140, 255, 90), (230, 215, 255, 230)),
    "chains": ((70, 60, 95, 255), (190, 150, 255, 255)),
    "bell": ((170, 140, 255, 70), (235, 220, 255, 180)),
    "rift": ((10, 4, 20, 245), (235, 215, 255, 240)),
    "ghost": ((165, 120, 255, 95), (240, 225, 255, 200)),
}
try:
    from PIL import Image
    import random
    rng = random.Random(7)
    for form, (body, accent) in TEX.items():
        img = Image.new("RGBA", (128, 128))
        px = img.load()
        for y in range(128):
            for x in range(128):
                base = body if x < 64 else accent
                n = rng.randint(-10, 10)
                px[x, y] = (max(0, min(255, base[0] + n)), max(0, min(255, base[1] + n)), max(0, min(255, base[2] + n)), base[3])
        img.save(os.path.join(RP, "textures", "entity", f"siege_arc_{form}.png"))
except ImportError:
    pass

FX_ANIMS = {
    "animation.siege.arc_fx.spin": {"loop": True, "animation_length": 0.5, "bones": {"shard": {"rotation": {"0.0": [0, 0, 0], "0.5": [0, 0, 360]}}}},
    "animation.siege.arc_fx.orbit": {"loop": True, "animation_length": 4.0, "bones": {"ring": {"rotation": {"0.0": [0, 0, 0], "4.0": [0, 360, 0]}, "position": [0, "math.sin(query.life_time * 120) * 0.6", 0]}}},
    "animation.siege.arc_fx.bind": {"loop": "hold_on_last_frame", "animation_length": 0.4, "bones": {
        "chains": {"position": {"0.0": [0, -14, 0], "0.25": [0, 0, 0]}, "scale": {"0.0": [1.4, 1, 1.4], "0.25": [1.1, 1, 1.1], "0.4": [0.9, 1, 0.9]}}}},
    "animation.siege.arc_fx.chain_turn": {"loop": True, "animation_length": 6.0, "bones": {
        "loop1": {"rotation": {"0.0": [0, 0, 0], "6.0": [0, 60, 0]}}, "loop2": {"rotation": {"0.0": [0, 0, 0], "6.0": [0, -60, 0]}}, "loop3": {"rotation": {"0.0": [0, 0, 0], "6.0": [0, 60, 0]}}}},
    "animation.siege.arc_fx.bell_form": {"loop": "hold_on_last_frame", "animation_length": 0.5, "bones": {"bell": {"scale": {"0.0": [0.1, 0.1, 0.1], "0.5": [1, 1, 1]}}}},
    "animation.siege.arc_fx.toll": {"animation_length": 1.4, "bones": {
        "bell": {"rotation": {"0.0": [0, 0, 0], "0.15": [0, 0, 18], "0.45": [0, 0, -12], "0.75": [0, 0, 7], "1.05": [0, 0, -3], "1.4": [0, 0, 0]}},
        "clapper": {"rotation": {"0.0": [0, 0, 0], "0.2": [0, 0, -26], "0.5": [0, 0, 16], "0.8": [0, 0, -8], "1.4": [0, 0, 0]}}}},
    "animation.siege.arc_fx.rift_open": {"loop": "hold_on_last_frame", "animation_length": 0.35, "bones": {
        "rift": {"scale": {"0.0": [0.02, 0.3, 1], "0.2": [0.4, 1, 1], "0.35": [1, 1, 1]}}}},
    "animation.siege.arc_fx.rift_breathe": {"loop": True, "animation_length": 1.0, "bones": {"rift": {"scale": [ "1 + math.sin(query.life_time * 900) * 0.04", 1, 1]}}},
    "animation.siege.arc_fx.rift_close": {"loop": "hold_on_last_frame", "animation_length": 0.3, "bones": {"rift": {"scale": {"0.0": [1, 1, 1], "0.3": [0.02, 0.6, 1]}}}},
    "animation.siege.arc_fx.ghost_fade": {"loop": "hold_on_last_frame", "animation_length": 1.0, "bones": {
        "ghost": {"position": {"0.0": [0, 0, 0], "1.0": [0, -6, 0]}, "scale": {"0.0": [1, 1, 1], "0.6": [0.96, 0.9, 0.96], "1.0": [0.6, 0.2, 0.6]}}}},
}
dump(os.path.join(RP, "animations", "siege_arc_fx.animation.json"), {"format_version": "1.10.0", "animations": FX_ANIMS})

FORM_Q = "query.property('siege:form')"
COUNT_Q = "query.property('siege:count')"
dump(os.path.join(RP, "entity", "arc_fx.entity.json"), {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
    "identifier": "siege:arc_fx",
    "materials": {"default": "entity_alphablend"},
    "textures": {f: f"textures/entity/siege_arc_{f}" for f in FORMS},
    "geometry": {f: f"geometry.siege.arc_{f}" for f in FORMS},
    "animations": {"spin": "animation.siege.arc_fx.spin", "orbit": "animation.siege.arc_fx.orbit", "bind": "animation.siege.arc_fx.bind",
                   "chain_turn": "animation.siege.arc_fx.chain_turn", "bell_form": "animation.siege.arc_fx.bell_form",
                   "rift_open": "animation.siege.arc_fx.rift_open", "rift_breathe": "animation.siege.arc_fx.rift_breathe", "ghost_fade": "animation.siege.arc_fx.ghost_fade"},
    "scripts": {"animate": [{"spin": f"{FORM_Q} == 0"}, {"orbit": f"{FORM_Q} == 1"}, {"bind": f"{FORM_Q} == 2"}, {"chain_turn": f"{FORM_Q} == 2"},
                            {"bell_form": f"{FORM_Q} == 3"}, {"rift_open": f"{FORM_Q} == 4"}, {"rift_breathe": f"{FORM_Q} == 4"}, {"ghost_fade": f"{FORM_Q} == 5"}]},
    "render_controllers": ["controller.render.siege_arc_fx"],
}}})
dump(os.path.join(RP, "render_controllers", "siege_arc_fx.render_controllers.json"), {"format_version": "1.8.0", "render_controllers": {"controller.render.siege_arc_fx": {
    "arrays": {"geometries": {"Array.geo": [f"Geometry.{f}" for f in FORMS]}, "textures": {"Array.tex": [f"Texture.{f}" for f in FORMS]}},
    "geometry": f"Array.geo[{FORM_Q}]", "textures": [f"Array.tex[{FORM_Q}]"], "materials": [{"*": "Material.default"}],
    "part_visibility": [{"plate1": f"{COUNT_Q} >= 1"}, {"plate2": f"{COUNT_Q} >= 2"}, {"plate3": f"{COUNT_Q} >= 3"},
                        {"loop1": f"{COUNT_Q} >= 1"}, {"loop2": f"{COUNT_Q} >= 2"}, {"loop3": f"{COUNT_Q} >= 3"}],
}}})
dump(os.path.join(BP, "entities", "arc_fx.json"), {"format_version": "1.21.60", "minecraft:entity": {
    "description": {"identifier": "siege:arc_fx", "is_spawnable": False, "is_summonable": True,
                    "properties": {"siege:form": {"type": "int", "range": [0, 7], "default": 0, "client_sync": True},
                                   "siege:count": {"type": "int", "range": [0, 3], "default": 3, "client_sync": True}}},
    "component_groups": {"siege:gone": {"minecraft:instant_despawn": {}}},
    "components": {
        "minecraft:type_family": {"family": ["arc_fx", "inanimate"]},
        "minecraft:health": {"value": 1, "max": 1},
        "minecraft:collision_box": {"width": 0.01, "height": 0.01},
        "minecraft:physics": {"has_gravity": False, "has_collision": False},
        "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": False},
        "minecraft:knockback_resistance": {"value": 1},
        "minecraft:fire_immune": {},
        "minecraft:breathable": {"breathes_water": True, "breathes_air": True, "breathes_lava": True, "breathes_solids": True},
        "minecraft:damage_sensor": {"triggers": [{"cause": "all", "deals_damage": "no"}]},
        "minecraft:timer": {"time": 30, "looping": False, "time_down_event": {"event": "siege:fade"}},
        "minecraft:nameable": {"always_show": False, "allow_name_tag_renaming": False},
    },
    # spawned as "siege:arc_fx<siege:form_bell>" so the right model shows from the first frame
    "events": {"siege:fade": {"add": {"component_groups": ["siege:gone"]}},
               **{f"siege:form_{f}": {"set_property": {"siege:form": i}} for i, f in enumerate(FORMS)}},
}})

# ---------- particles for the pass ----------
PARTICLES2 = {
    # Ember Bolt: the smear behind the shard, the brand that flashes on a hit, Paleburn's cold flames
    "arc_streak": particle("arc_streak", sprite="glow", size=0.4, life=0.18, colors=(PALE, MAGENTA, VIOLET)),
    "arc_brand": particle("arc_brand", sprite="spark", size=0.75, life=0.45, colors=(PALE, MAGENTA, INDIGO), spin=90),
    "arc_paleburn": particle("arc_paleburn", sprite="shard", size=0.28, life=0.6, count=4, shape=("box", {"offset": [0, 0.9, 0], "half_dimensions": [0.3, 0.8, 0.3], "direction": "outwards"}),
                             speed=0.2, accel=(0, 1.6, 0), colors=([1, 1, 1], PALE, VIOLET)),
    # Ward plates and Bind chains breaking
    "arc_shatter": particle("arc_shatter", sprite="shard", size=0.3, life=0.7, count=16, shape=("sphere", {"offset": [0, 1.1, 0], "radius": 0.4, "direction": "outwards"}),
                            speed=3.0, drag=2.0, accel=(0, -6, 0), colors=(PALE, GEMBLUE, VIOLET), spin=300),
    # Halfstep: the faint outline others see
    "arc_shimmer": particle("arc_shimmer", sprite="glow", size=0.12, life=0.6, count=10, shape=("box", {"offset": [0, 0.9, 0], "half_dimensions": [0.35, 0.9, 0.35], "surface_only": True, "direction": "outwards"}),
                            speed=0.05, accel=(0, 0.2, 0), colors=(PALE, VIOLET)),
    # Choir's Call: the cracked note over a turned raider, and the thread to the one it hates
    "arc_note": particle("arc_note", sprite="spark", size=0.3, life=1.0, accel=(0, 0.5, 0), drag=1.0, colors=(MAGENTA, INDIGO), spin=120),
    "arc_thread": particle("arc_thread", sprite="glow", size=0.09, life=0.5, colors=(PALE, VIOLET)),
    # Echo Sight: a door that hums, a ring of sound off its face
    "arc_hum": particle("arc_hum", sprite="ring", size=1, life="0.9", colors=(PALE, MAGENTA, INDIGO),
                        grow="0.2 + 0.9 * variable.particle_age / variable.particle_lifetime"),
    # The Crescendo: a crown of sparks circling the head
    "arc_crown": particle("arc_crown", sprite="spark", size=0.14, life=0.5, count=8, shape=("disc", {"radius": 0.45, "surface_only": True, "direction": "outwards"}),
                          speed=0.02, colors=(PALE, MAGENTA)),
}
for name, p in PARTICLES2.items():
    dump(os.path.join(RP, "particles", f"{name}.particle.json"), p)

# ---------- Echo Sight: a dim violet fog, so you see shapes, not daylight ----------
dump(os.path.join(RP, "fogs", "siege_arc_echo.json"), {"format_version": "1.16.100", "minecraft:fog_settings": {
    "description": {"identifier": "siege:arc_echo"},
    "distance": {"air": {"fog_start": 3, "fog_end": 30, "fog_color": "#1b1030", "render_distance_type": "fixed"},
                 "weather": {"fog_start": 3, "fog_end": 26, "fog_color": "#1b1030", "render_distance_type": "fixed"}}}})

# ---------- moves: the Crescendo, and casts that show in first person ----------
CAST2 = {
    # Crescendo: head back, arms opened wide and a little raised, held (the script plays it again every 2 s)
    "crescendo": move(2.0, {
        "rightarm": [(0.35, (-35, 0, 70)), (1.65, (-40, 0, 75))],
        "leftarm": [(0.35, (-35, 0, -70)), (1.65, (-40, 0, -75))],
        "head": [(0.35, (-28, 0, 0)), (1.65, (-30, 0, 0))],
        "waist": [(0.35, (-7, 0, 0)), (1.65, (-8, 0, 0))],
    }),
}
moves_path = os.path.join(RP, "animations", "sorcerer_cast.animation.json")
anims = json.load(open(moves_path))
for k, a in CAST2.items():
    anims["animations"][f"animation.siege.player.cast.{k}"] = a
# first person: half the move instead of a quarter, so the Ember hand comes up into view
text = json.dumps(anims, indent=1).replace("variable.is_first_person ? 0.25 : 1.0", "variable.is_first_person ? 0.5 : 1.0")
open(moves_path, "w").write(text + "\n")

# ---------- the Marked layer: palm mark, veins that climb with Resonance, eyes at full ----------
# Player property hc:mark: 0 not Marked, 1-5 the stage (set by townhall/marked.js). The overlay glows
# (entity_emissive_alpha: mark pixels at alpha 140 render as light; clear pixels are cut).
MARK_SRC = os.path.join(ROOT, "art", "marked_layer")
mark_tex = []
for s in range(5):
    src = os.path.join(MARK_SRC, f"stage_{s}.png")
    dst = os.path.join(RP, "textures", "entity", "hc_marked", f"stage_{s}.png")
    if os.path.exists(src):
        try:
            from PIL import Image
            img = Image.open(src).convert("RGBA")
            px = img.load()
            for y in range(img.size[1]):
                for x in range(img.size[0]):
                    r, g, b, a = px[x, y]
                    px[x, y] = (r, g, b, 140 if a > 20 else 0)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            img.save(dst)
        except ImportError:
            pass
    mark_tex.append(f"hc_mark_{s + 1}")

PLAYER_RP = os.path.join(RP, "entity", "player.entity.json")
pe = json.load(open(PLAYER_RP))
d = pe["minecraft:client_entity"]["description"]
d["materials"]["hc_mark"] = "entity_emissive_alpha"
for s in range(5):
    d["textures"][f"hc_mark_{s + 1}"] = f"textures/entity/hc_marked/stage_{s}"
MARK = "(query.has_property('hc:mark') ? query.property('hc:mark') : 0)"
LOOK = "(query.has_property('hc:look') ? query.property('hc:look') : 0)"
want = [
    {"controller.render.hc_marked": f"!variable.is_first_person && !variable.map_face_icon && !query.is_spectator && !query.is_invisible && {MARK} >= 1 && {LOOK} < 1"},
    {"controller.render.hc_marked_look": f"!variable.is_first_person && !variable.map_face_icon && !query.is_spectator && !query.is_invisible && {MARK} >= 1 && {LOOK} >= 1"},
    {"controller.render.hc_marked_hand": f"variable.is_first_person && !query.is_spectator && !query.is_invisible && {MARK} >= 1"},
]
rcs = [r for r in d["render_controllers"] if not (isinstance(r, dict) and any(k.startswith("controller.render.hc_marked") for k in r))]
d["render_controllers"] = rcs + want
open(PLAYER_RP, "w").write(json.dumps(pe, indent=2) + "\n")  # keep the file's own 2-space layout
MARK_ARR = {"textures": {"Array.mark": [f"Texture.{t}" for t in mark_tex]}}
MIDX = f"math.clamp({MARK} - 1, 0, 4)"
dump(os.path.join(RP, "render_controllers", "hc_marked.render_controllers.json"), {"format_version": "1.8.0", "render_controllers": {
    "controller.render.hc_marked": {"arrays": MARK_ARR, "geometry": "Geometry.default", "materials": [{"*": "Material.hc_mark"}], "textures": [f"Array.mark[{MIDX}]"]},
    "controller.render.hc_marked_look": {"arrays": MARK_ARR, "geometry": "Geometry.hc_look", "materials": [{"*": "Material.hc_mark"}], "textures": [f"Array.mark[{MIDX}]"]},
    "controller.render.hc_marked_hand": {"arrays": MARK_ARR, "geometry": "Geometry.default", "materials": [{"*": "Material.hc_mark"}], "textures": [f"Array.mark[{MIDX}]"],
                                         "part_visibility": [{"*": False}, {"rightArm": True}, {"rightSleeve": True}]},
}})
PLAYER_BP = os.path.join(BP, "entities", "player.json")
pb = json.load(open(PLAYER_BP))
pb["minecraft:entity"]["description"].setdefault("properties", {})["hc:mark"] = {"type": "int", "range": [0, 5], "default": 0, "client_sync": True}
open(PLAYER_BP, "w").write(json.dumps(pb, indent=2) + "\n")

# ---------- loud means something: Hollow creatures hunt a loud Sorcerer first ----------
# Player tag siege_resonant (Resonance 70+, townhall/marked.js). Every Hollow creature that picks its own fights
# (not bosses and their adds, whose fights are scripted) gets a goal one step above its usual one: a loud
# Sorcerer within 32 blocks, seen or not. studio/bestiary/build.py writes the same goal, so a rebuild keeps it.
LOUD_GOAL = {"priority": 2, "must_see": False, "reselect_targets": True, "within_radius": 32, "entity_types": [{"filters": {"all_of": [
    {"test": "is_family", "subject": "other", "operator": "==", "value": "player"},
    {"test": "has_tag", "subject": "other", "operator": "==", "value": "siege_resonant"},
    {"test": "has_tag", "subject": "other", "operator": "!=", "value": "siege_hollow_ruler"}]}, "max_dist": 32, "priority": 0}]}
loud_count = 0
for folder in ("bestiary", "hollowfolk"):
    base = os.path.join(BP, "entities", folder)
    if not os.path.isdir(base):
        continue
    for fn in sorted(os.listdir(base)):
        path = os.path.join(base, fn)
        try:
            ent = json.load(open(path))
        except (ValueError, IsADirectoryError):
            continue
        c = ent.get("minecraft:entity", {}).get("components", {})
        fam = c.get("minecraft:type_family", {}).get("family", [])
        nat = c.get("minecraft:behavior.nearest_attackable_target")
        if "hollow" not in fam or not nat or "siege_boss" in fam or "siege_boss_add" in fam:
            continue
        c["minecraft:behavior.nearest_prioritized_attackable_target"] = LOUD_GOAL
        nat["priority"] = max(nat.get("priority", 2), 3)
        dump(path, ent)
        loud_count += 1

print(f"spell pass: {len(FORMS)} effect forms, {len(PARTICLES2)} particles, Echo fog, Crescendo move, Marked layer, loud goal on {loud_count} creatures")
