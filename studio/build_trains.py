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
with open(RP + "models/blocks/track.geo.json", "w") as f:  # one line per shape: 20 shapes of many small cubes
    f.write('{"format_version": "1.12.0", "minecraft:geometry": [\n' + ",\n".join(json.dumps(g, separators=(",", ":")) for g in geos) + "\n]}\n")

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
# The atlas is 128 x 64: 32 painted tiles of 16 x 16. Each face samples a tile; round parts (wheels, boiler front,
# smokebox door, spectacle windows) are built as stepped discs whose faces each take their own slice of a round tile,
# so the painting lines up across the steps.
TW, TH = 128, 64
TILES = ["body", "lined", "boiler", "smokebox", "metal", "brass", "beam", "wheel", "tread", "glass", "window", "wood",
         "glow", "roof", "coal", "door", "spectacle", "smokedoor", "floor", "seat", "rod", "louvre", "panel", "dark"]
TILE = {t: ((i % 8) * 16, (i // 8) * 16) for i, t in enumerate(TILES)}
FACES = ("north", "south", "east", "west", "up", "down")

def ecube(origin, size, tile, sub=None, faces=None, rot=None, pivot=None):
    """sub: {face: (u0, v0, du, dv)} slices of the tile in 0..16 units for those faces. faces: per-face tile override."""
    out = {}
    for f in FACES:
        t = (faces or {}).get(f, tile)
        u, v = TILE[t]
        su, sv, du, dv = (sub or {}).get(f, (0, 0, 16, 16))
        out[f] = {"uv": [round(u + su, 3), round(v + sv, 3)], "uv_size": [round(du, 3), round(dv, 3)]}
    c = {"origin": [round(o, 3) for o in origin], "size": [round(s, 3) for s in size], "uv": out}
    if rot: c["rotation"] = rot; c["pivot"] = pivot
    return c

def steps(r):
    """A pixel circle of radius r as 3 overlapping bands: [(half_width, half_height)]"""
    return [(r, r * 0.45), (r * 0.85, r * 0.8), (r * 0.45, r)]

def disc_x(x0, w, cy, cz, r, face_tile, edge_tile):
    """A disc facing east/west (a wheel): x from x0, thickness w, centre (cy, cz), radius r."""
    out = []
    for hw, hh in steps(r):
        sl = ((cz - hw - (cz - r)) / (2 * r) * 16, (r - hh) / (2 * r) * 16, hw / r * 16, hh / r * 16)
        out.append(ecube([x0, cy - hh, cz - hw], [w, 2 * hh, 2 * hw], edge_tile, sub={"east": sl, "west": sl},
                         faces={"east": face_tile, "west": face_tile}))
    return out

def cyl_z(cx, cy, r, z0, length, tile, front=None):
    """A cylinder along z (the boiler): front gets a round tile on its north face."""
    out = []
    for hw, hh in steps(r):
        sl = ((r - hw) / (2 * r) * 16, (r - hh) / (2 * r) * 16, hw / r * 16, hh / r * 16)
        out.append(ecube([cx - hw, cy - hh, z0], [2 * hw, 2 * hh, length], tile,
                         sub={"north": sl} if front else None, faces={"north": front} if front else None))
    return out

def box(x0, y0, z0, x1, y1, z1, tile, **k):
    return ecube([x0, y0, z0], [x1 - x0, y1 - y0, z1 - z0], tile, **k)

def mirror(cubes_fn):
    return cubes_fn(1) + cubes_fn(-1)

def xs(s, a, b):
    """x range a..b on side s (1 = +x, -1 = -x) as (x0, x1)"""
    return (a, b) if s > 0 else (-b, -a)

def buffers(z_face, out_dir):
    out = []
    for x in (-14, 14):
        z0 = z_face if out_dir > 0 else z_face - 3
        out.append(box(x - 1.5, 11.5, z0, x + 1.5, 14.5, z0 + 3, "metal"))
        z1 = z_face + 3 if out_dir > 0 else z_face - 4
        out.append(box(x - 3, 10, z1, x + 3, 16, z1 + 1, "metal"))
    return out

# Cars are 3 blocks wide and 7 long (48 x 112 px). The front is -z in the model (it faces where the train goes).
# ---- the engine: a side-tank engine, three coupled driving wheels a side, the cab at the back with a coal bunker
def engine_cubes():
    c = []
    # frames, footplate and valance
    c.append(box(-16, 8, -56, 16, 18, 56, "dark"))
    c.append(box(-23, 18, -56, 23, 20, 56, "metal"))
    c += mirror(lambda s: [box(*xs(s, 21, 23)[:1], 15, -56, *xs(s, 21, 23)[1:], 18, 56, "beam")])
    # buffer beams and buffers, front and back
    c.append(box(-23, 10, -58, 23, 18, -56, "beam")); c.append(box(-23, 10, 56, 23, 18, 58, "beam"))
    c += buffers(-58, -1) + buffers(58, 1)
    # driving wheels (22 across) and the trailing wheel under the bunker
    for zc in (-30, -6, 18):
        c += mirror(lambda s: disc_x(18 if s > 0 else -21, 3, 11, zc, 11, "wheel", "tread"))
    c += mirror(lambda s: disc_x(18 if s > 0 else -21, 3, 7, 43, 7, "wheel", "tread"))
    # coupling rods and cylinders
    c += mirror(lambda s: [box(*xs(s, 21, 22.5)[:1], 9, -32, *xs(s, 21, 22.5)[1:], 11, 20, "rod")])
    c += mirror(lambda s: [box(*xs(s, 15, 22)[:1], 8, -54, *xs(s, 15, 22)[1:], 18, -42, "metal"),
                           box(*xs(s, 21, 22.5)[:1], 11, -44, *xs(s, 21, 22.5)[1:], 13, -30, "rod")])
    # boiler and smokebox, with brass bands
    c += cyl_z(0, 34, 13, -42, 54, "boiler")
    c += cyl_z(0, 34, 13.5, -55, 13, "smokebox", front="smokedoor")
    for z in (-28, -12, 4):
        c += cyl_z(0, 34, 13.6, z, 1.5, "brass")
    c.append(box(-14, 20, -55, 14, 26, -42, "smokebox"))  # saddle under the smokebox
    # chimney, dome, safety valve
    c.append(box(-4, 47, -52, 4, 58, -44, "smokebox")); c.append(box(-6, 58, -54, 6, 61, -42, "smokebox"))
    c.append(box(-5, 46, -53, 5, 49, -43, "smokebox"))
    c.append(box(-5, 46, -22, 5, 51, -12, "brass")); c.append(box(-3.5, 51, -20.5, 3.5, 53, -13.5, "brass"))
    c.append(box(-1.5, 46, 2, 1.5, 51, 5, "brass"))
    # side tanks with lining, and the handrails along the boiler
    c += mirror(lambda s: [box(*xs(s, 12, 23)[:1], 20, -36, *xs(s, 12, 23)[1:], 38, 12, "lined", faces={"up": "body"})])
    c += mirror(lambda s: [box(*xs(s, 9, 10)[:1], 41, -52, *xs(s, 9, 10)[1:], 42, 12, "brass")])
    # the cab: front wall with spectacle windows, sides open at the doorway, a rounded roof
    c.append(box(-23, 20, 12, 23, 48, 14, "body"))
    for x in (-13, 13):
        c += [ecube([x - 4, 36, 11.8], [8, 8, 0.4], "body", faces={"north": "spectacle", "south": "spectacle"})]
    c += mirror(lambda s: [box(*xs(s, 21, 23)[:1], 20, 14, *xs(s, 21, 23)[1:], 30, 40, "lined"),
                           box(*xs(s, 21, 23)[:1], 30, 14, *xs(s, 21, 23)[1:], 48, 18, "body"),
                           box(*xs(s, 21, 23)[:1], 30, 34, *xs(s, 21, 23)[1:], 48, 40, "body"),
                           box(*xs(s, 21, 23)[:1], 44, 18, *xs(s, 21, 23)[1:], 48, 34, "body")])
    c.append(box(-23, 20, 38, 23, 48, 40, "body", faces={"south": "lined"}))
    c.append(box(-12, 36, 37.8, 12, 44, 38, "window"))
    c.append(box(-25, 48, 10, 25, 50, 42, "roof")); c.append(box(-21, 50, 10, 21, 52, 42, "roof")); c.append(box(-14, 52, 11, 14, 53, 41, "roof"))
    c.append(box(-21, 20, 14, 21, 21, 38, "floor"))
    c.append(box(-12, 21, 14.5, 12, 30, 20, "smokebox", faces={"south": "smokedoor"}))  # firebox backhead
    # coal bunker behind the cab
    c.append(box(-23, 20, 40, 23, 36, 56, "lined", faces={"up": "coal"}))
    c.append(box(-20, 36, 41, 20, 38, 54, "coal"))
    # lamps
    c.append(box(-2, 48, -56, 2, 53, -53, "glow", faces={"up": "metal", "down": "metal"}))
    for x in (-15, 15): c.append(box(x - 2, 18, -59.5, x + 2, 22, -57, "glow", faces={"up": "metal", "down": "metal"}))
    return c

# ---- the coach: panelled sides with seven windows each side, doors at both ends, a rounded roof and two bogies
def coach_cubes():
    c = []
    c.append(box(-20, 9, -55, 20, 14, 55, "dark"))
    c.append(box(-23, 14, -55, 23, 15, 55, "metal"))
    c.append(box(-23, 9, -57, 23, 15, -55, "beam")); c.append(box(-23, 9, 55, 23, 15, 57, "beam"))
    c += buffers(-57, -1) + buffers(57, 1)
    for zb in (-36, 36):
        c.append(box(-19, 5, zb - 12, 19, 9, zb + 12, "dark"))
        c += mirror(lambda s: [box(*xs(s, 19, 21)[:1], 7, zb - 13, *xs(s, 19, 21)[1:], 9, zb + 13, "metal")])
        for dz in (-7, 7):
            c += mirror(lambda s: disc_x(19.5 if s > 0 else -21.5, 2, 6, zb + dz, 6, "wheel", "tread"))
    c += mirror(lambda s: [box(*xs(s, 20, 22)[:1], 11, -20, *xs(s, 20, 22)[1:], 13, 20, "dark")])  # battery boxes
    # sides: lower panels, window band (pillars between windows), upper rail
    c += mirror(lambda s: [box(*xs(s, 22, 23)[:1], 15, -54, *xs(s, 22, 23)[1:], 28, 54, "lined")])
    c += mirror(lambda s: [box(*xs(s, 22, 23)[:1], 40, -54, *xs(s, 22, 23)[1:], 46, 54, "panel")])
    c += mirror(lambda s: [box(*xs(s, 22.3, 22.6)[:1], 28, -44, *xs(s, 22.3, 22.6)[1:], 40, 44, "window")])
    for z in range(-44, 45, 11):
        c += mirror(lambda s: [box(*xs(s, 22, 23)[:1], 28, z - 1.5, *xs(s, 22, 23)[1:], 40, z + 1.5, "body")])
    for zd in (-54, 44):  # end doors, with droplights
        c += mirror(lambda s: [box(*xs(s, 22, 23.2)[:1], 15, zd, *xs(s, 22, 23.2)[1:], 40, zd + 10, "door")])
    # ends: panel with a gangway door and windows
    for z0 in (-55, 54):
        c.append(box(-23, 15, z0, 23, 46, z0 + 1, "lined"))
        c.append(box(-5, 15, z0 - 0.3, 5, 40, z0 + 1.3, "door"))
        for x in (-16, 16): c.append(box(x - 4, 30, z0 - 0.2, x + 4, 38, z0 + 1.2, "window"))
    # roof: three steps and a rain strip, with lamp tops
    c.append(box(-24.5, 46, -56, 24.5, 47.5, 56, "roof", faces={"north": "panel", "south": "panel"}))
    c.append(box(-21, 47.5, -56, 21, 49.5, 56, "roof")); c.append(box(-14, 49.5, -55.5, 14, 51, 55.5, "roof"))
    for z in (-33, -11, 11, 33): c.append(box(-2, 51, z - 2, 2, 53, z + 2, "metal"))
    # inside: floor and three pairs of benches
    c.append(box(-22, 15, -54, 22, 16, 54, "floor"))
    for z in (-32, 0, 32):
        for zz in (z - 8, z + 4):
            c.append(box(-20, 16, zz, 20, 21, zz + 4, "seat"))
        c.append(box(-20, 21, z - 9, 20, 30, z - 8, "seat")); c.append(box(-20, 21, z + 8, 20, 30, z + 9, "seat"))
    # the steps under each door
    for zd in (-54, 44):
        c += mirror(lambda s: [box(*xs(s, 23, 25)[:1], 10, zd, *xs(s, 23, 25)[1:], 11, zd + 10, "metal")])
    return c

engine = engine_cubes()
coach = coach_cubes()
for name, cubes in (("engine", engine), ("coach", coach)):
    write(RP + f"models/entity/train_{name}.geo.json", {"format_version": "1.12.0", "minecraft:geometry": [{
        "description": {"identifier": f"geometry.siege_train_{name}", "texture_width": TW, "texture_height": TH,
                        "visible_bounds_width": 10, "visible_bounds_height": 6, "visible_bounds_offset": [0, 2, 0]},
        "bones": [{"name": "body", "pivot": [0, 0, 0], "cubes": cubes}]}]})

# Seats in entity space: +z is the front. Engine: driver and fireman in the cab. Coach: three rows of two.
SEATS = {
    "engine": [[0.7, 1.5, -1.625], [-0.7, 1.5, -1.625]],
    "coach": [[0.6, 1.1, 1.625], [-0.6, 1.1, 1.625], [0.6, 1.1, -0.375], [-0.6, 1.1, -0.375], [0.6, 1.1, -2.375], [-0.6, 1.1, -2.375]],
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

# ---------------------------------------------------------------- placeholder textures (painted tiles, one atlas per style)
def cl(c): return tuple(max(0, min(255, int(v))) for v in c)
def noisy(c, a=6):
    n = rnd.randint(-a, a); return cl([v + n for v in c]) + (255,)
def sh(c, k): return cl([v * k for v in c])
BEAM = {"vale": (150, 40, 32), "frostmarch": (40, 52, 72), "saltreach": (176, 60, 40), "emberwaste": (60, 40, 30), "blackfen": (110, 36, 30)}

def tiles_for(style):
    body, trim, roof, metal = PALETTE[style]
    beam = BEAM[style]
    dark = sh(metal, 0.55)
    def rd(x, y): return math.hypot(x - 7.5, y - 7.5)
    def lined(x, y):
        if x in (0, 15) or y in (0, 15): return sh(body, 0.7)
        if x in (2, 13) and 2 <= y <= 13 or y in (2, 13) and 2 <= x <= 13: return trim
        return body if y % 7 else sh(body, 0.94)
    def boiler(x, y):
        k = 1.15 - abs(y - 7.5) / 7.5 * 0.35  # light along the top of the barrel
        return sh(body, k) if x % 8 else sh(body, k * 0.9)
    def wheel(x, y):
        r = rd(x, y)
        if r > 8.1: return None
        if r > 6.6: return sh(metal, 0.7)                  # tyre
        if r < 1.6: return trim                            # hub
        a = math.atan2(y - 7.5, x - 7.5)
        if abs(math.sin(a * 5)) < 0.32: return body if r < 5.8 else sh(body, 0.8)  # spokes, painted like the body
        if r > 5.8: return sh(body, 0.75)
        return None                                        # see through between the spokes
    def smokedoor(x, y):
        r = rd(x, y)
        if r > 7.9: return sh(dark, 0.8)
        if r > 6.8: return sh(metal, 1.2)
        if r < 1.4: return trim
        if y == 7 and abs(x - 7.5) < 6: return sh(metal, 1.3)  # dart handle
        return dark
    def spectacle(x, y):
        r = rd(x, y)
        if r > 7.2: return body
        if r > 5.8: return trim
        return (150, 190, 210) if (x + y) % 9 else (210, 232, 240)
    def window(x, y):
        if x in (0, 15) or y in (0, 1, 15): return sh(trim, 0.85)
        return (190, 220, 232) if x - y in (3, 4, 9) else (120, 160, 184)
    def door(x, y):
        if x in (0, 15) or y in (0, 15): return sh(body, 0.65)
        if 3 <= x <= 12 and 2 <= y <= 6: return (120, 160, 184) if x - y != 1 else (190, 220, 232)
        if x == 12 and 9 <= y <= 10: return trim
        return lined(x, y)
    paint = {
        "body": lambda x, y: body if y % 7 else sh(body, 0.94),
        "lined": lined,
        "boiler": boiler,
        "smokebox": lambda x, y: dark if (x * 5 + y * 3) % 11 else sh(dark, 1.2),
        "metal": lambda x, y: sh(metal, 1.2) if (x * 3 + y) % 7 == 0 else metal,
        "brass": lambda x, y: sh(trim, 1.15) if y < 5 else trim if y < 11 else sh(trim, 0.8),
        "beam": lambda x, y: sh(beam, 0.75) if y in (0, 15) else beam,
        "wheel": wheel,
        "tread": lambda x, y: sh(metal, 0.7) if y % 3 else sh(metal, 0.9),
        "glass": lambda x, y: (150, 190, 210),
        "window": window,
        "wood": lambda x, y: (100, 72, 44) if y % 4 == 3 else (140, 104, 62),
        "glow": lambda x, y: (60, 56, 50) if x in (0, 15) or y in (0, 15) else (255, 222, 140) if rd(x, y) < 4 else (240, 190, 90),
        "roof": lambda x, y: sh(roof, 0.85) if x % 5 == 0 else roof,
        "coal": lambda x, y: (22, 22, 26) if (x * 7 + y * 5) % 5 else (58, 58, 66),
        "door": door,
        "spectacle": spectacle,
        "smokedoor": smokedoor,
        "floor": lambda x, y: (96, 70, 44) if y % 4 == 0 else (124, 92, 58),
        "seat": lambda x, y: sh(BEAM[style], 1.1) if (x + y) % 4 else sh(BEAM[style], 0.85),
        "rod": lambda x, y: (196, 198, 204) if y < 8 else (150, 152, 160),
        "louvre": lambda x, y: sh(metal, 0.6) if y % 3 == 0 else metal,
        "panel": lambda x, y: trim if y in (3, 12) else body,
        "dark": lambda x, y: dark if (x + y) % 5 else sh(dark, 1.25),
    }
    atlas = Image.new("RGBA", (TW, TH), (0, 0, 0, 0))
    for t, (u, v) in TILE.items():
        for y in range(16):
            for x in range(16):
                c = paint[t](x, y)
                if c is not None: atlas.putpixel((u + x, v + y), noisy(c, 4))
    return atlas

for name in ("engine", "coach"):
    for s in STYLES:
        save_png(RP + f"textures/entity/siege/trains/{name}_{s}.png", tiles_for(s))

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
