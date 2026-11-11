"""Builds the Hollow Choir entities (Conductor + Singer): behavior, client entity, model, placeholder skin.
Run from the siege-nights folder:  python3 studio/build_undertow_choir.py
Existing textures are never overwritten (the textures thread paints over placeholders)."""
import json, os, random
from PIL import Image

BP, RP = "Siege_Nights_BP", "Siege_Nights_RP"

def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    json.dump(data, open(path, "w"), indent=1)

SHIELD = {"on_damage": {"filters": {"test": "has_tag", "subject": "self", "value": "siege_boss_shielded"}}, "deals_damage": "no"}
NO = lambda cause: {"cause": cause, "deals_damage": "no"}

def behavior(name, hp, w, h, families, boss):
    comp = {
        "minecraft:type_family": {"family": families},
        "minecraft:health": {"value": hp, "max": hp},
        "minecraft:collision_box": {"width": w, "height": h},
        "minecraft:nameable": {},
        "minecraft:physics": {"has_gravity": False},
        "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": False},
        "minecraft:knockback_resistance": {"value": 1.0},
        "minecraft:movement": {"value": 0},
        "minecraft:damage_sensor": {"triggers": [SHIELD, NO("fall"), NO("suffocation"), NO("drowning"), NO("lightning"), NO("void")]},
        "minecraft:behavior.look_at_player": {"priority": 8, "look_distance": 32},
        "minecraft:persistent": {},
        "minecraft:fire_immune": {},
        "minecraft:experience_reward": {"on_death": "query.last_hit_by_player ? %d : 0" % (500 if boss else 20)},
    }
    if boss:
        comp["minecraft:boss"] = {"name": "The Choir", "should_darken_sky": False, "hud_range": 64}  # "name" is the bar title (else "Unknown")
    return {"format_version": "1.21.60", "minecraft:entity": {
        "description": {"identifier": f"siege:{name}", "is_spawnable": False, "is_summonable": True, "is_experimental": False},
        "component_groups": {}, "components": comp, "events": {}}}

def client(name):
    return {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
        "identifier": f"siege:{name}",
        "materials": {"default": "entity_alphatest"},
        "textures": {"default": f"textures/entity/siege/undertow/{name}"},
        "geometry": {"default": f"geometry.siege_u.{name}"},
        "render_controllers": ["controller.render.siege_bestiary"]}}}

def cube(origin, size, uv, inflate=0):
    c = {"origin": origin, "size": size, "uv": uv}
    if inflate: c["inflate"] = inflate
    return c

def geo(name, bones, w, h):
    return {"format_version": "1.12.0", "minecraft:geometry": [{
        "description": {"identifier": f"geometry.siege_u.{name}", "texture_width": 64, "texture_height": 64,
                        "visible_bounds_width": w, "visible_bounds_height": h, "visible_bounds_offset": [0, h / 2, 0]},
        "bones": bones}]}

# The Conductor: a tall hollow robe with no face, a ring-crown, long arms spread, a baton.
CONDUCTOR = [
    {"name": "root", "pivot": [0, 0, 0]},
    {"name": "robe", "parent": "root", "pivot": [0, 0, 0], "cubes": [
        cube([-7, 0, -5], [14, 14, 10], [0, 0]),      # skirt
        cube([-5, 14, -4], [10, 16, 8], [0, 24]),     # torso
    ]},
    {"name": "head", "parent": "root", "pivot": [0, 30, 0], "cubes": [
        cube([-4, 30, -4], [8, 9, 8], [0, 48]),       # hood
        cube([-5, 39, -5], [10, 2, 10], [24, 52]),    # crown ring
    ]},
    {"name": "arm_left", "parent": "root", "pivot": [5, 28, 0], "rotation": [0, 0, -55], "cubes": [cube([5, 12, -1.5], [3, 18, 3], [48, 0])]},
    {"name": "arm_right", "parent": "root", "pivot": [-5, 28, 0], "rotation": [0, 0, 55], "cubes": [
        cube([-8, 12, -1.5], [3, 18, 3], [48, 0]),
        cube([-7, 2, -0.5], [1, 10, 1], [60, 0]),     # baton
    ]},
]
# A Singer: a narrow robed figure, head tipped back, mouth a dark hollow.
SINGER = [
    {"name": "root", "pivot": [0, 0, 0]},
    {"name": "robe", "parent": "root", "pivot": [0, 0, 0], "cubes": [
        cube([-4, 0, -3], [8, 12, 6], [0, 0]),
        cube([-3, 12, -2], [6, 10, 4], [0, 18]),
    ]},
    {"name": "head", "parent": "root", "pivot": [0, 22, 0], "rotation": [-25, 0, 0], "cubes": [
        cube([-3, 22, -3], [6, 7, 6], [0, 32]),
        cube([-1.5, 23, -3.2], [3, 4, 1], [24, 32]),  # the open mouth
    ]},
]

def skin(name, base, glow):
    path = f"{RP}/textures/entity/siege/undertow/{name}.png"
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if os.path.exists(path): return
    random.seed(name)
    im = Image.new("RGBA", (64, 64)); px = im.load()
    for y in range(64):
        for x in range(64):
            d = random.randint(-8, 8)
            c = glow if (x + y * 3) % 23 == 0 else base
            px[x, y] = tuple(max(0, min(255, v + d)) for v in c) + (255,)
    im.save(path)

if __name__ == "__main__":
    write_json(f"{BP}/entities/undertow/choir_conductor.json", behavior("choir_conductor", 600, 1.4, 3.4, ["monster", "mob", "hollow", "siege_boss"], True))
    write_json(f"{BP}/entities/undertow/choir_singer.json", behavior("choir_singer", 60, 0.8, 2.4, ["monster", "mob", "hollow", "siege_choir_singer"], False))
    write_json(f"{RP}/entity/undertow/choir_conductor.entity.json", client("choir_conductor"))
    write_json(f"{RP}/entity/undertow/choir_singer.entity.json", client("choir_singer"))
    write_json(f"{RP}/models/entity/undertow/choir_conductor.geo.json", geo("choir_conductor", CONDUCTOR, 5, 4))
    write_json(f"{RP}/models/entity/undertow/choir_singer.geo.json", geo("choir_singer", SINGER, 2, 3))
    # The NPC ruler of the Hollow: a Sorcerer in a dark robe wearing the Hollow Crown. Stands still; players talk to it.
    reg = behavior("hollow_regent", 300, 0.8, 2.4, ["npc", "mob", "hollow", "siege_hollow_regent"], False)
    reg["minecraft:entity"]["components"]["minecraft:boss"] = {"name": "The Hollow Crown", "should_darken_sky": False, "hud_range": 24}
    write_json(f"{BP}/entities/undertow/hollow_regent.json", reg)
    write_json(f"{RP}/entity/undertow/hollow_regent.entity.json", client("hollow_regent"))
    regent_bones = json.loads(json.dumps(SINGER))
    regent_bones[2]["rotation"] = [0, 0, 0]
    regent_bones[2]["cubes"] = [cube([-3, 22, -3], [6, 7, 6], [0, 32]), cube([-3.5, 28, -3.5], [7, 2, 7], [24, 40])]  # head + crown
    write_json(f"{RP}/models/entity/undertow/hollow_regent.geo.json", geo("hollow_regent", regent_bones, 2, 3))
    skin("hollow_regent", (45, 30, 70), (230, 200, 120))
    skin("choir_conductor", (70, 40, 110), (200, 160, 255))
    skin("choir_singer", (150, 130, 170), (255, 150, 210))
    p = f"{RP}/texts/en_US.lang"
    lines = open(p).read().splitlines()
    want = {"entity.siege:choir_conductor.name": "The Choir", "entity.siege:choir_singer.name": "Singer", "entity.siege:hollow_regent.name": "The Hollow Crown"}
    lines = [l for l in lines if l.split("=")[0] not in want] + [f"{k}={v}" for k, v in want.items()]
    open(p, "w").write("\n".join(lines) + "\n")
    print("Hollow Choir entities built.")
