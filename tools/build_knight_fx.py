#!/usr/bin/env python3
"""Writes the Knight's look: technique moves, particles, and the 3D objects. Run from the repo root.

    python3 tools/build_knight_fx.py

Mateo 2026-11-14, after the Knight pages in the Ember Spellbook: "fix the whats weak stuff". Safe to run twice. Writes:
  Siege_Nights_RP/animations/knight_moves.animation.json      one move per technique (played by script)
  Siege_Nights_RP/particles/kn_*.particle.json                the siege:kn_* particles
  Siege_Nights_RP/textures/particle/hc_knight.png             their sheet (80x16: pennant, dust, crack, spark, ring)
  siege:knight_fx (RP + BP entity, model, textures, animations):
    form 0  the Banner of the Keep, a 10-block war banner in the settlement's colour (siege:color 0-15)
    form 1  Crownbreaker's ghostly greatsword, three blocks long, falling point first

The script side is Siege_Nights_BP/scripts/townhall/knight_fx.js. Notes: docs/KNIGHT-FX.md.
"""
import json, math, os, sys

ROOT = sys.argv[1] if len(sys.argv) > 1 else os.getcwd()
RP = os.path.join(ROOT, "Siege_Nights_RP")
BP = os.path.join(ROOT, "Siege_Nights_BP")


def dump(path, data, indent=1):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=indent)
        f.write("\n")


# ---------- technique moves ----------
# Same axes as the Sorcerer's casts (tools/build_sorcerer_fx.py): arms -x raise forward, +y turns right, right arm +z
# outward, left arm -z outward. Played on their own controller (siege_knight), so they add on top of the PR #127 moves.
# In first person half the move shows, so the sword or shield comes up into view without filling the screen.
K = "(variable.is_first_person ? 0.5 : 1.0)"


def v(x, y=0, z=0):
    return [f"{x} * {K}" if x else 0.0, f"{y} * {K}" if y else 0.0, f"{z} * {K}" if z else 0.0]


def move(length, bones, positions=None):
    """bones: {bone: [(time, (x, y, z)), ...]} rotations; positions likewise. Every bone starts and ends at rest."""
    out = {}
    for kind, table in (("rotation", bones), ("position", positions or {})):
        for bone, keys in table.items():
            frames = {"0.0": v(0)}
            for t, rot in keys:
                frames[str(t)] = v(*rot)
            frames[str(length)] = v(0)
            out.setdefault(bone, {})[kind] = frames
    return {"animation_length": length, "bones": out}


def twist(keys):
    """waist turn with the head turning back by the same amount, so the aim stays put"""
    return {"waist": keys, "head": [(t, (-x, -y, -z)) for t, (x, y, z) in keys]}


MOVES = {
    # Shield Bash: the shield arm punches forward with a step in, the sword arm held back
    "bash": move(0.5, {
        "leftarm": [(0.08, (-30, -40, 0)), (0.18, (-85, 10, 0)), (0.32, (-80, 5, 0))],
        "rightarm": [(0.12, (25, 0, 10))],
        **twist([(0.08, (4, -20, 0)), (0.18, (12, 15, 0))]),
        "leftleg": [(0.18, (-25, 0, 0))],
    }),
    # Lunge: a short crouch, then a straight thrust at the end of the dash
    "thrust": move(0.55, {
        "rightarm": [(0.1, (30, 0, 10)), (0.32, (-92, 0, 0)), (0.42, (-92, 0, 0))],
        "leftarm": [(0.32, (25, 0, -10))],
        **twist([(0.1, (18, 10, 0)), (0.32, (14, -8, 0))]),
        "rightleg": [(0.32, (-30, 0, 0))],
        "leftleg": [(0.32, (20, 0, 0))],
    }),
    # Riposte: a fast backhand out from behind the shield
    "backhand": move(0.35, {
        "rightarm": [(0.06, (-80, -60, -10)), (0.2, (-70, 50, 20))],
        "leftarm": [(0.06, (-65, -35, 0)), (0.2, (-40, -20, 0))],
        **twist([(0.06, (0, -25, 0)), (0.2, (4, 25, 0))]),
    }),
    # Rallying Cry: the Oath Banner raised high overhead and held
    "raise": move(1.4, {
        "rightarm": [(0.25, (-172, 0, -8)), (1.1, (-172, 0, -8))],
        "leftarm": [(0.25, (-20, 0, -25)), (1.1, (-20, 0, -25))],
        "head": [(0.25, (-18, 0, 0)), (1.1, (-18, 0, 0))],
        "waist": [(0.25, (-6, 0, 0)), (1.1, (-6, 0, 0))],
    }),
    # Banner of the Keep: both hands drive the banner down into the ground
    "plant": move(1.0, {
        "rightarm": [(0.25, (-160, 0, 0)), (0.45, (-40, 0, 0)), (0.8, (-40, 0, 0))],
        "leftarm": [(0.25, (-150, 0, 0)), (0.45, (-35, 0, 0)), (0.8, (-35, 0, 0))],
        "waist": [(0.25, (-6, 0, 0)), (0.45, (22, 0, 0)), (0.8, (22, 0, 0))],
    }),
    # Warhorse Charge: the weapon arm comes down level, like a lance (played again while at speed)
    "lance": move(1.6, {
        "rightarm": [(0.2, (-80, 0, 0)), (1.4, (-80, 0, 0))],
        "waist": [(0.2, (12, 0, 0)), (1.4, (12, 0, 0))],
    }),
    # Execution: an overhead chop
    "chop": move(0.5, {
        "rightarm": [(0.15, (-175, 0, 0)), (0.28, (-20, 0, 0))],
        "leftarm": [(0.15, (-160, 0, 0)), (0.28, (-25, 0, 0))],
        "waist": [(0.15, (-8, 0, 0)), (0.28, (18, 0, 0))],
    }),
    # Second Wind: drop to one knee for a breath, then rise
    "kneel": move(1.4, {
        "waist": [(0.15, (26, 0, 0)), (0.7, (26, 0, 0)), (1.1, (4, 0, 0))],
        "rightarm": [(0.15, (-40, 0, 15)), (0.7, (-40, 0, 15))],
        "head": [(0.15, (18, 0, 0)), (0.7, (18, 0, 0)), (1.0, (-10, 0, 0))],
        "leftleg": [(0.15, (-80, 0, 0)), (0.8, (-80, 0, 0))],
        "rightleg": [(0.15, (10, 0, 0)), (0.8, (10, 0, 0))],
    }, positions={"root": [(0.15, (0, -5, 0)), (0.8, (0, -5, 0))]}),
}
dump(os.path.join(RP, "animations", "knight_moves.animation.json"), {
    "format_version": "1.10.0",
    "animations": {f"animation.siege.player.knight.{k}": a for k, a in MOVES.items()},
})

# ---------- particle sheet: pennant, dust, crack, spark (white on clear, tinted by each particle) ----------
SHEET = os.path.join(RP, "textures", "particle", "hc_knight.png")
SPRITE = {"pennant": 0, "dust": 16, "crack": 32, "spark": 48, "ring": 64}
try:
    from PIL import Image, ImageDraw
    img = Image.new("RGBA", (80, 16), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # pennant: a staff and a swallow-tailed flag
    d.line([(3, 1), (3, 15)], fill=(200, 200, 200, 255))
    d.polygon([(4, 2), (14, 4), (10, 6), (14, 8), (4, 10)], fill=(255, 255, 255, 255))
    # dust: a soft round puff
    for y in range(16):
        for x in range(16):
            r = math.hypot(x - 7.5, y - 7.5) / 7.5
            if r < 1:
                img.putpixel((16 + x, y), (255, 255, 255, int(220 * (1 - r) ** 1.4)))
    # crack: a jagged line with a fork
    d.line([(33, 2), (37, 6), (35, 9), (40, 13), (46, 14)], fill=(255, 255, 255, 255), width=1)
    d.line([(37, 6), (42, 5), (45, 2)], fill=(255, 255, 255, 230), width=1)
    # spark: a four-pointed star
    d.polygon([(55.5, 0), (57, 6.5), (63, 8), (57, 9.5), (55.5, 16), (54, 9.5), (48, 8), (54, 6.5)], fill=(255, 255, 255, 255))
    # ring: a thin bright edge with a soft inner fade (rings over the ground)
    for y in range(16):
        for x in range(16):
            r = math.hypot(x - 7.5, y - 7.5)
            a = max(0.0, 1 - abs(r - 7.0) / 1.2) * 255 + (max(0.0, 1 - (7 - r) / 3) * 60 if r < 7 else 0)
            if a > 0:
                img.putpixel((64 + x, y), (255, 255, 255, min(255, int(a))))
    img.save(SHEET)
except ImportError:
    pass

GOLD = [1.0, 0.82, 0.38]
EMBER = [0.95, 0.55, 0.15]
DEEP = [0.55, 0.28, 0.06]
WHITE = [1.0, 0.97, 0.88]
GRIT = [0.55, 0.5, 0.42]
GRIT2 = [0.33, 0.3, 0.26]
ASH = [0.38, 0.38, 0.41]
CRACK = [0.12, 0.1, 0.09]
T = "variable.particle_age / variable.particle_lifetime"


def particle(name, *, sprite, size, life, count=1, shape=None, speed=0.0, accel=(0, 0, 0), drag=0.0, colors=(GOLD,),
             facing="lookat_xyz", grow=None, spin=0.0, blend="add", alpha=None, direction=None):
    c = {"minecraft:emitter_rate_instant": {"num_particles": count}, "minecraft:emitter_lifetime_once": {"active_time": 0.05}}
    if shape is None:
        c["minecraft:emitter_shape_point"] = {"direction": direction} if direction else {}
    else:
        kind, args = shape
        c[f"minecraft:emitter_shape_{kind}"] = args
    c["minecraft:particle_lifetime_expression"] = {"max_lifetime": life if isinstance(life, str) else f"{life} * (0.8 + math.random(0, 0.4))"}
    c["minecraft:particle_initial_speed"] = speed
    c["minecraft:particle_motion_dynamic"] = {"linear_acceleration": list(accel), "linear_drag_coefficient": drag}
    if spin:
        c["minecraft:particle_initial_spin"] = {"rotation": "math.random(0, 360)", "rotation_rate": spin}
    sz = grow or f"{size} * (1 - {T} * 0.5)"
    c["minecraft:particle_appearance_billboard"] = {
        "size": [sz, sz], "facing_camera_mode": facing,
        "uv": {"texture_width": 80, "texture_height": 16, "uv": [SPRITE[sprite], 0], "uv_size": [16, 16]},
    }
    if len(colors) == 1:
        c["minecraft:particle_appearance_tinting"] = {"color": [*colors[0], alpha or f"1 - {T}"]}
    else:
        stops = {f"{i / (len(colors) - 1):.2f}": [*col, 1.0] for i, col in enumerate(colors)}
        c["minecraft:particle_appearance_tinting"] = {"color": {"interpolant": T, "gradient": stops}}
    return {"format_version": "1.10.0", "particle_effect": {
        "description": {"identifier": f"siege:{name}", "basic_render_parameters": {
            "material": "particles_add" if blend == "add" else "particles_alpha", "texture": "textures/particle/hc_knight"}},
        "components": c}}


# variable.ring_size (MolangVariableMap) is the ring's radius in blocks; 0 means the default
RING = "(variable.ring_size > 0 ? variable.ring_size : {d})"
# variable.dx / variable.dz: the way the spray goes (the shield face, the dash), set by the script
CONE = ["variable.dx + math.random(-0.45, 0.45)", "math.random(0.05, 0.45)", "variable.dz + math.random(-0.45, 0.45)"]

PARTICLES = {
    # Shield Bash and Lunge: grit and dust thrown off the shield face, or kicked up behind the dash
    "kn_grit": particle("kn_grit", sprite="dust", size=0.16, life=0.8, count=18, direction=CONE, speed=4.5, drag=3.0,
                        accel=(0, -7, 0), colors=(GRIT, GRIT2), blend="alpha"),
    # the slow on a bashed creature: grit settling down over it
    "kn_settle": particle("kn_settle", sprite="dust", size=0.12, life=1.0, count=5,
                          shape=("box", {"offset": [0, 2.1, 0], "half_dimensions": [0.4, 0.1, 0.4], "direction": "outwards"}),
                          accel=(0, -1.8, 0), colors=(GRIT,), blend="alpha"),
    # Riposte, Charge, Execution: gold-white sparks off steel
    "kn_parry": particle("kn_parry", sprite="spark", size=0.22, life=0.35, count=14, shape=("sphere", {"radius": 0.1, "direction": "outwards"}),
                         speed=5.0, drag=6.0, colors=(WHITE, GOLD, EMBER), spin=240),
    # Rallying Cry: a column of gold motes on everyone it reached
    "kn_rise": particle("kn_rise", sprite="dust", size=0.1, life=1.2, count=14,
                        shape=("box", {"offset": [0, 0.2, 0], "half_dimensions": [0.35, 0.1, 0.35], "direction": "outwards"}),
                        speed=0.1, accel=(0, 1.6, 0), colors=(GOLD, EMBER)),
    # Strength showing on an arm or a blade: a faint ember glow
    "kn_glow": particle("kn_glow", sprite="dust", size=0.09, life=0.5, count=2, shape=("sphere", {"radius": 0.12, "direction": "outwards"}),
                        speed=0.05, accel=(0, 0.3, 0), colors=(GOLD, EMBER)),
    # a gold ring rolling out over the ground to its true size (Rallying Cry, Second Wind)
    "kn_ring": particle("kn_ring", sprite="ring", size=1, life="1.1", facing="emitter_transform_xz", colors=(WHITE, GOLD, DEEP),
                        grow=RING.format(d=10) + f" * math.min(1, {T} * 1.6)"),
    # the Banner's reach: a faint gold edge on the ground, held at its true size (respawned every second)
    "kn_reach": particle("kn_reach", sprite="ring", size=1, life="1.05", facing="emitter_transform_xz", colors=(GOLD,),
                         grow=RING.format(d=10), alpha=f"0.32 * (1 - {T} * 0.4)"),
    # Banner planted: a ring of dust thrown out from the foot
    "kn_dust": particle("kn_dust", sprite="dust", size=0.38, life=1.2, count=40,
                        shape=("disc", {"radius": 0.6, "plane_normal": "y", "direction": "outwards"}),
                        speed=4.0, drag=2.5, accel=(0, 0.35, 0), colors=(GRIT, GRIT2), blend="alpha"),
    # cracks round the foot of the banner, or where the greatsword lands (variable.ring_size = how far out)
    "kn_cracks": particle("kn_cracks", sprite="crack", size=0.5, life="2.0", count=16, facing="emitter_transform_xz",
                          shape=("disc", {"radius": RING.format(d=1.5), "plane_normal": "y", "surface_only": True}),
                          colors=(CRACK,), blend="alpha", spin=0.0, alpha=f"0.9 * (1 - {T} * {T})"),
    # Weakness inside the Banner's reach: a grey haze about the creature
    "kn_haze": particle("kn_haze", sprite="dust", size=0.3, life=1.2, count=3,
                        shape=("box", {"offset": [0, 1, 0], "half_dimensions": [0.4, 0.8, 0.4], "direction": "outwards"}),
                        speed=0.05, accel=(0, 0.1, 0), colors=(ASH,), blend="alpha", alpha=f"0.55 * (1 - {T})"),
    # Execution: a thin red-gold crack mark over a creature below a fifth of its health (only you see it)
    "kn_mark": particle("kn_mark", sprite="crack", size=0.3, life=0.9, count=2,
                        shape=("box", {"offset": [0, 1.2, 0], "half_dimensions": [0.3, 0.5, 0.3]}),
                        accel=(0, 0.2, 0), colors=([1.0, 0.35, 0.2], EMBER)),
    # Second Wind: the Resistance as a faint gold shell
    "kn_shell": particle("kn_shell", sprite="dust", size=0.1, life=0.6, count=22,
                         shape=("sphere", {"offset": [0, 1, 0], "radius": 1.0, "surface_only": True}), colors=(GOLD, DEEP)),
    # Warhorse Charge: dust streaming off the hooves at charging speed
    "kn_hooves": particle("kn_hooves", sprite="dust", size=0.28, life=0.9, count=6,
                          shape=("box", {"offset": [0, 0.1, 0], "half_dimensions": [0.5, 0.05, 0.8], "direction": "outwards"}),
                          speed=0.6, drag=1.5, accel=(0, 0.5, 0), colors=(GRIT, GRIT2), blend="alpha"),
    # Guard Captain: a small gold pennant over each guard you are leading
    "kn_pennant": particle("kn_pennant", sprite="pennant", size=0.22, life="1.05", colors=(GOLD,), alpha="1"),
}
for name, p in PARTICLES.items():
    dump(os.path.join(RP, "particles", f"{name}.particle.json"), p)


# ---------- siege:knight_fx: the Banner of the Keep and the falling greatsword ----------
def face_uv(uv, size, faces=("north", "south", "east", "west", "up", "down")):
    return {f: {"uv": list(uv), "uv_size": list(size)} for f in faces}


def cube(origin, size, uv, rotation=None, pivot=None, sides=None):
    """uv: one (u, v, w, h) region for every face, or `sides` = {face: (u, v, w, h)} on top of it"""
    faces = face_uv(uv[:2], uv[2:])
    for f, r in (sides or {}).items():
        faces[f] = {"uv": list(r[:2]), "uv_size": list(r[2:])}
    c = {"origin": list(origin), "size": list(size), "uv": faces}
    if rotation:
        c["rotation"] = list(rotation)
        c["pivot"] = list(pivot or [origin[0] + size[0] / 2, origin[1] + size[1] / 2, origin[2] + size[2] / 2])
    return c


def bone(name, pivot, cubes=(), parent=None):
    b = {"name": name, "pivot": list(pivot), "cubes": list(cubes)}
    if parent:
        b["parent"] = parent
    return b


# Banner texture, 128x192: the cloth (40x90) at 0,0, then the wood, iron and gold strips.
CLOTH = (0, 0)
WOOD = (48, 0, 4, 160)     # pole: a long vertical grain strip
BAR = (56, 0, 44, 3)       # crossbar: horizontal grain
IRON = (56, 8, 8, 8)
BRASS = (68, 8, 8, 8)
SEG = 18                   # each of the five cloth bones is 18 px tall: 90 px of cloth
banner = [
    bone("banner", [0, 0, 0]),
    bone("pole", [0, 0, 0], [
        cube([-1.5, 0, -1.5], [3, 152, 3], WOOD),
        cube([-2.5, 0, -2.5], [5, 4, 5], IRON),                    # iron shoe at the foot
        cube([-2.5, 140, -2.5], [5, 3, 5], IRON),                  # collar under the crossbar
        cube([-1, 152, -1], [2, 6, 2], IRON),                      # spike
        cube([-0.5, 158, -0.5], [1, 3, 1], BRASS),
        cube([-22, 143, -1], [44, 2.5, 2], BAR),                   # crossbar
        cube([-23, 142.5, -1.5], [2, 3.5, 3], BRASS), cube([21, 142.5, -1.5], [2, 3.5, 3], BRASS),
    ], parent="banner"),
]
top = 143
parent = "pole"
for i in range(5):
    y1 = top - (i + 1) * SEG
    face = (CLOTH[0], CLOTH[1] + i * SEG, 40, SEG)
    edge = (CLOTH[0], CLOTH[1] + i * SEG, 1, SEG)
    banner.append(bone(f"cloth{i + 1}", [0, y1 + SEG, 2], [
        cube([-20, y1, 1.75], [40, SEG, 0.5], face, sides={"east": edge, "west": edge, "up": (0, 0, 40, 1), "down": (0, 89, 40, 1)}),
    ], parent=parent))
    parent = f"cloth{i + 1}"

# Greatsword texture, 64x64: ghost steel, a bright edge, the gold guard
G_BLADE = (0, 0, 8, 8)
G_EDGE = (8, 0, 8, 8)
G_GOLD = (16, 0, 8, 8)
G_GRIP = (24, 0, 8, 8)
sword = [
    bone("sword", [0, 0, 0]),
    bone("blade", [0, 0, 0], [
        cube([-1, 0, -0.5], [2, 5, 1], G_EDGE),
        cube([-2, 5, -0.5], [4, 30, 1], G_BLADE),
        cube([-0.5, 5, -0.6], [1, 30, 1.2], G_EDGE),
        cube([-7, 35, -1.5], [14, 2.5, 3], G_GOLD),
        cube([-1, 37.5, -1], [2, 8, 2], G_GRIP),
        cube([-1.5, 45.5, -1.5], [3, 3, 3], G_GOLD),
    ], parent="sword"),
]
GEO = {"format_version": "1.12.0", "minecraft:geometry": [
    {"description": {"identifier": "geometry.siege.knight_banner", "texture_width": 128, "texture_height": 192,
                     "visible_bounds_width": 4, "visible_bounds_height": 12, "visible_bounds_offset": [0, 5.5, 0]}, "bones": banner},
    {"description": {"identifier": "geometry.siege.knight_sword", "texture_width": 64, "texture_height": 64,
                     "visible_bounds_width": 2, "visible_bounds_height": 10, "visible_bounds_offset": [0, 4, 0]}, "bones": sword},
]}
dump(os.path.join(RP, "models", "entity", "siege_knight_fx.geo.json"), GEO)

COLORS = ["white", "orange", "magenta", "light_blue", "yellow", "lime", "pink", "gray",
          "light_gray", "cyan", "purple", "blue", "brown", "green", "red", "black"]  # siege/constants.js COLORS
DYE_RGB = {  # siege/constants.js DYE_RGB
    "white": (233, 236, 236), "orange": (240, 118, 19), "magenta": (189, 68, 179), "light_blue": (58, 175, 217),
    "yellow": (248, 197, 39), "lime": (112, 185, 25), "pink": (237, 141, 172), "gray": (62, 68, 71),
    "light_gray": (142, 142, 134), "cyan": (21, 137, 145), "purple": (121, 42, 172), "blue": (53, 57, 157),
    "brown": (114, 71, 40), "green": (84, 109, 27), "red": (161, 39, 34), "black": (29, 29, 33),
}
try:
    from PIL import Image
    import random
    rng = random.Random(11)

    def shade(rgb, f):
        return tuple(max(0, min(255, int(c * f))) for c in rgb)

    def noisy(px, x0, y0, w, h, rgb, amt=10, a=255):
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                n = rng.randint(-amt, amt)
                px[x, y] = (*(max(0, min(255, c + n)) for c in rgb), a)

    for ci, cname in enumerate(COLORS):
        cloth = DYE_RGB[cname]
        mark = (217, 164, 65) if cname not in ("yellow", "orange") else (60, 40, 25)  # the Oath mark: gold, dark on gold cloth
        img = Image.new("RGBA", (128, 192), (0, 0, 0, 0))
        px = img.load()
        # cloth: woven noise, a darker hem at the top, a border, the Oath mark (a sword over a crown), a fringe
        noisy(px, 0, 0, 40, 90, cloth, 9)
        for x in range(40):
            for y in range(0, 3):
                px[x, y] = (*shade(cloth, 0.62), 255)
        for y in range(3, 84):
            for x in (0, 1, 38, 39):
                px[x, y] = (*mark, 255)
        for x in range(19, 21):          # blade
            for y in range(14, 52):
                px[x, y] = (*mark, 255)
        for x in range(13, 27):          # guard
            for y in range(20, 22):
                px[x, y] = (*mark, 255)
        for x in range(18, 22):          # pommel
            for y in range(11, 14):
                px[x, y] = (*mark, 255)
        for x in range(11, 29):          # crown band
            for y in range(56, 60):
                px[x, y] = (*mark, 255)
        for x0 in (11, 18, 25):          # crown points
            for y in range(50, 56):
                for x in range(x0 + (56 - y) // 3, x0 + 4 - (56 - y) // 3):
                    px[x, y] = (*mark, 255)
        for y in range(84, 90):          # fringe: gold tassels, clear between
            for x in range(40):
                px[x, y] = (*mark, 255) if x % 3 != 2 else (0, 0, 0, 0)
        noisy(px, 48, 0, 4, 160, (59, 42, 28), 8)          # dark oak pole
        for y in range(0, 160, 7):
            px[48 + rng.randint(0, 3), y] = (40, 28, 18, 255)
        noisy(px, 56, 0, 44, 3, (66, 47, 31), 8)           # crossbar
        noisy(px, 56, 8, 8, 8, (154, 158, 164), 12)        # iron
        noisy(px, 68, 8, 8, 8, (205, 160, 70), 12)         # brass
        img.save(os.path.join(RP, "textures", "entity", f"siege_knight_banner_{cname}.png"))

    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    px = img.load()
    noisy(px, 0, 0, 8, 8, (243, 223, 168), 8, 120)   # ghost steel
    noisy(px, 8, 0, 8, 8, (255, 248, 225), 6, 210)   # bright edge
    noisy(px, 16, 0, 8, 8, (230, 170, 70), 8, 190)   # gold guard and pommel
    noisy(px, 24, 0, 8, 8, (150, 110, 70), 8, 150)   # grip
    img.save(os.path.join(RP, "textures", "entity", "siege_knight_sword.png"))
except ImportError:
    pass

# animations: the banner drops in and slams down, the cloth moves in the wind, then furls and sinks into the ground;
# the greatsword falls point first, then fades down into the earth
cloth_wave = {}
for i in range(5):
    amp = 3 + i * 2.2
    cloth_wave[f"cloth{i + 1}"] = {"rotation": [f"math.sin(query.life_time * 140 + {i * 38}) * {amp:.1f}",
                                                f"math.sin(query.life_time * 90 + {i * 25}) * {amp * 0.4:.1f}", 0]}
FX_ANIMS = {
    "animation.siege.knight_fx.banner_drop": {"loop": "hold_on_last_frame", "animation_length": 0.6, "bones": {"banner": {
        "position": {"0.0": [0, 180, 0], "0.3": [0, 0, 0], "0.4": [0, 2, 0], "0.6": [0, 0, 0]},
        "rotation": {"0.0": [8, 0, 0], "0.3": [0, 0, 0], "0.4": [-2, 0, 0], "0.6": [0, 0, 0]}}}},
    "animation.siege.knight_fx.banner_wave": {"loop": True, "animation_length": 8.0, "bones": cloth_wave},
    # the lower cloth hangs from the top one, so shrinking the top bone rolls the whole cloth up to the crossbar
    "animation.siege.knight_fx.banner_furl": {"loop": "hold_on_last_frame", "animation_length": 0.7, "bones": {
        "cloth1": {"scale": {"0.0": [1, 1, 1], "0.7": [0.4, 0.15, 1]}}}},
    "animation.siege.knight_fx.banner_sink": {"loop": "hold_on_last_frame", "animation_length": 1.2, "bones": {"banner": {
        "position": {"0.0": [0, 0, 0], "1.2": [0, -168, 0]}}}},
    "animation.siege.knight_fx.sword_fall": {"loop": "hold_on_last_frame", "animation_length": 0.5, "bones": {"sword": {
        "position": {"0.0": [0, 112, 0], "0.3": [0, -6, 0], "0.5": [0, -6, 0]},
        "scale": {"0.0": [0.8, 0.8, 0.8], "0.3": [1, 1, 1]}}}},
    "animation.siege.knight_fx.sword_fade": {"loop": "hold_on_last_frame", "animation_length": 0.8, "bones": {"sword": {
        "position": {"0.0": [0, -6, 0], "0.8": [0, -40, 0]}, "scale": {"0.0": [1, 1, 1], "0.8": [0.4, 1, 0.4]}}}},
}
dump(os.path.join(RP, "animations", "siege_knight_fx.animation.json"), {"format_version": "1.10.0", "animations": FX_ANIMS})

FORMS = ["banner", "sword"]
FORM_Q = "query.property('siege:form')"
COLOR_Q = "query.property('siege:color')"
dump(os.path.join(RP, "entity", "knight_fx.entity.json"), {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
    "identifier": "siege:knight_fx",
    "materials": {"banner": "entity_alphatest", "sword": "entity_alphablend"},
    "textures": {**{f"banner_{c}": f"textures/entity/siege_knight_banner_{c}" for c in COLORS}, "sword": "textures/entity/siege_knight_sword"},
    "geometry": {"banner": "geometry.siege.knight_banner", "sword": "geometry.siege.knight_sword"},
    "animations": {"drop": "animation.siege.knight_fx.banner_drop", "wave": "animation.siege.knight_fx.banner_wave",
                   "fall": "animation.siege.knight_fx.sword_fall"},
    "scripts": {"animate": [{"drop": f"{FORM_Q} == 0"}, {"wave": f"{FORM_Q} == 0"}, {"fall": f"{FORM_Q} == 1"}]},
    "render_controllers": ["controller.render.siege_knight_fx"],
}}})
dump(os.path.join(RP, "render_controllers", "siege_knight_fx.render_controllers.json"), {"format_version": "1.8.0", "render_controllers": {
    "controller.render.siege_knight_fx": {
        "arrays": {"geometries": {"Array.geo": ["Geometry.banner", "Geometry.sword"]},
                   "materials": {"Array.mat": ["Material.banner", "Material.sword"]},
                   "textures": {"Array.tex": [*(f"Texture.banner_{c}" for c in COLORS), "Texture.sword"]}},
        "geometry": f"Array.geo[{FORM_Q}]",
        "materials": [{"*": f"Array.mat[{FORM_Q}]"}],
        "textures": [f"Array.tex[{FORM_Q} == 1 ? 16 : {COLOR_Q}]"],
    }}})
dump(os.path.join(BP, "entities", "knight_fx.json"), {"format_version": "1.21.60", "minecraft:entity": {
    "description": {"identifier": "siege:knight_fx", "is_spawnable": False, "is_summonable": True,
                    "properties": {"siege:form": {"type": "int", "range": [0, 3], "default": 0, "client_sync": True},
                                   "siege:color": {"type": "int", "range": [0, 15], "default": 14, "client_sync": True}}},
    "component_groups": {"siege:gone": {"minecraft:instant_despawn": {}}},
    "components": {
        "minecraft:type_family": {"family": ["knight_fx", "inanimate"]},
        "minecraft:health": {"value": 1, "max": 1},
        "minecraft:collision_box": {"width": 0.01, "height": 0.01},
        "minecraft:physics": {"has_gravity": False, "has_collision": False},
        "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": False},
        "minecraft:knockback_resistance": {"value": 1},
        "minecraft:fire_immune": {},
        "minecraft:breathable": {"breathes_water": True, "breathes_air": True, "breathes_lava": True, "breathes_solids": True},
        "minecraft:damage_sensor": {"triggers": [{"cause": "all", "deals_damage": "no"}]},
        # the banner stands 20 or 30 s; anything the script forgot (world closed mid-technique) goes after 40
        "minecraft:timer": {"time": 40, "looping": False, "time_down_event": {"event": "siege:fade"}},
        "minecraft:nameable": {"always_show": False, "allow_name_tag_renaming": False},
    },
    # spawned as "siege:knight_fx<siege:form_sword>" so the right model shows from the first frame
    "events": {"siege:fade": {"add": {"component_groups": ["siege:gone"]}},
               **{f"siege:form_{f}": {"set_property": {"siege:form": i}} for i, f in enumerate(FORMS)}},
}})

print(f"{len(MOVES)} knight moves, {len(PARTICLES)} particles, knight_fx with {len(FORMS)} forms and {len(COLORS)} banner colours")
