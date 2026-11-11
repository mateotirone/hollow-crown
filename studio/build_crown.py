#!/usr/bin/env python3
"""Builds every pack file the Crown feature needs (blocks, items, the Throne Seal, shapes, placeholder
textures, names). Safe to run again: it only adds or replaces its own entries.
Run from the siege-nights folder:   python3 studio/build_crown.py"""
import json, os, time
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BP, RP = os.path.join(ROOT, "Siege_Nights_BP"), os.path.join(ROOT, "Siege_Nights_RP")

def write(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf8") as f:
        json.dump(data, f, indent=2)
        f.write("\n")

def merge(path, key, entries):
    """Add our entries to a shared JSON file other features also write to (read it right before writing)."""
    with open(path, encoding="utf8") as f:
        data = json.load(f)
    target = data[key] if key else data
    target.update(entries)
    with open(path, "w", encoding="utf8") as f:
        json.dump(data, f, indent=2)
        f.write("\n")

# ---------------- Behavior pack ----------------

def block(name, components, category="items"):
    write(f"{BP}/blocks/{name}.json", {"format_version": "1.21.60", "minecraft:block": {
        "description": {"identifier": f"siege:{name}", "menu_category": {"category": category}},
        "components": {"minecraft:display_name": f"tile.siege:{name}.name", **components}}})

block("citadel_cornerstone", {
    "minecraft:geometry": "minecraft:geometry.full_block",
    "minecraft:material_instances": {"*": {"texture": "siege_cornerstone_side", "render_method": "opaque"},
                                     "up": {"texture": "siege_cornerstone_top", "render_method": "opaque"},
                                     "down": {"texture": "siege_cornerstone_top", "render_method": "opaque"}},
    "minecraft:destructible_by_mining": {"seconds_to_destroy": 1},
    "minecraft:destructible_by_explosion": {"explosion_resistance": 1200},
    "minecraft:light_emission": 7,
    "minecraft:map_color": "#c9a53a"})

block("throne", {
    "minecraft:geometry": "geometry.siege_throne",
    "minecraft:material_instances": {"*": {"texture": "siege_throne", "render_method": "alpha_test"}},
    "minecraft:destructible_by_mining": {"seconds_to_destroy": 30},
    "minecraft:destructible_by_explosion": {"explosion_resistance": 1200},
    "minecraft:light_dampening": 0,
    "minecraft:collision_box": {"origin": [-7, 0, -7], "size": [14, 16, 14]},
    "minecraft:selection_box": {"origin": [-7, 0, -7], "size": [14, 16, 14]},
    "minecraft:loot": "loot_tables/blocks/siege_nothing.json",
    "minecraft:map_color": "#c9a53a"}, category="construction")

block("fallen_shard", {
    "minecraft:geometry": "geometry.siege_fallen_shard",
    "minecraft:material_instances": {"*": {"texture": "siege_fallen_shard", "render_method": "alpha_test", "face_dimming": False, "ambient_occlusion": False}},
    "minecraft:destructible_by_mining": {"seconds_to_destroy": 2},
    "minecraft:destructible_by_explosion": {"explosion_resistance": 1200},
    "minecraft:light_emission": 12,
    "minecraft:light_dampening": 0,
    "minecraft:collision_box": {"origin": [-4, 0, -4], "size": [8, 14, 8]},
    "minecraft:selection_box": {"origin": [-4, 0, -4], "size": [8, 14, 8]},
    "minecraft:loot": "loot_tables/blocks/siege_fallen_shard.json",
    "minecraft:map_color": "#b9a6ff"}, category="construction")

write(f"{BP}/loot_tables/blocks/siege_fallen_shard.json", {"pools": [{"rolls": 1, "entries": [
    {"type": "item", "name": "siege:crown_shard", "weight": 1}]}]})

def item(name, components, category="equipment", group=None):
    cat = {"category": category}
    if group: cat["group"] = group
    write(f"{BP}/items/{name}.json", {"format_version": "1.21.60", "minecraft:item": {
        "description": {"identifier": f"siege:{name}", "menu_category": cat},
        "components": {"minecraft:icon": f"siege_{name}", "minecraft:display_name": {"value": f"item.siege:{name}.name"}, **components}}})

item("hollow_crown", {
    "minecraft:max_stack_size": 1,
    "minecraft:wearable": {"slot": "slot.armor.head", "protection": 3},
    "minecraft:glint": True,
    "minecraft:tags": {"tags": ["minecraft:is_armor"]}}, category="equipment")
# The victor's relic (Mateo's pick): a still-beating ember cut from the final boss
item("heart_of_the_hollow", {"minecraft:max_stack_size": 1, "minecraft:glint": True}, category="items")
item("crown_shard", {"minecraft:max_stack_size": 16, "minecraft:glint": True}, category="items")
item("gauntlet_of_challenge", {"minecraft:max_stack_size": 1})

write(f"{BP}/recipes/gauntlet_of_challenge.json", {"format_version": "1.20.10", "minecraft:recipe_shaped": {
    "description": {"identifier": "siege:gauntlet_of_challenge_recipe"}, "tags": ["siege_workshop"],
    "pattern": ["III", "IGI", " L "],
    "key": {"I": {"item": "minecraft:iron_ingot"}, "G": {"item": "minecraft:gold_ingot"}, "L": {"item": "minecraft:leather"}},
    "result": {"item": "siege:gauntlet_of_challenge", "count": 1}, "unlock": {"context": "AlwaysUnlocked"}}})

# The Throne Seal: like a keep heart, but only players on the claimant's side (tagged by the script) can hurt it
no = lambda cause: {"cause": cause, "deals_damage": "no"}
write(f"{BP}/entities/throne_seal.json", {"format_version": "1.21.60", "minecraft:entity": {
    "description": {"identifier": "siege:throne_seal", "is_spawnable": False, "is_summonable": True},
    "components": {
        "minecraft:type_family": {"family": ["throne_seal", "inanimate"]},
        "minecraft:health": {"value": 1000, "max": 1000},
        "minecraft:collision_box": {"width": 0.9, "height": 1.9},
        "minecraft:physics": {"has_gravity": False, "has_collision": False},
        "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": False},
        "minecraft:knockback_resistance": {"value": 1},
        "minecraft:movement": {"value": 0},
        "minecraft:persistent": {},
        "minecraft:fire_immune": {},
        "minecraft:nameable": {"always_show": True, "allow_name_tag_renaming": False},
        "minecraft:damage_sensor": {"triggers": [
            no("fall"), no("suffocation"), no("drowning"), no("fire"), no("fire_tick"), no("lava"), no("void"),
            {"on_damage": {"filters": {"all_of": [
                {"test": "is_family", "subject": "other", "value": "player"},
                {"test": "has_tag", "subject": "other", "value": "siege_crown_storm"}]}}, "deals_damage": "yes"},
            {"deals_damage": "no"}]}}}})

# The Heart of the Hollow, lying where the Choir fell until someone reaches for it. Nothing can hurt it.
write(f"{BP}/entities/resting_heart.json", {"format_version": "1.21.60", "minecraft:entity": {
    "description": {"identifier": "siege:resting_heart", "is_spawnable": False, "is_summonable": True},
    "components": {
        "minecraft:type_family": {"family": ["resting_heart", "inanimate"]},
        "minecraft:health": {"value": 20, "max": 20},
        "minecraft:collision_box": {"width": 0.8, "height": 1.0},
        "minecraft:physics": {"has_gravity": False, "has_collision": False},
        "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": False},
        "minecraft:knockback_resistance": {"value": 1},
        "minecraft:movement": {"value": 0},
        "minecraft:persistent": {},
        "minecraft:fire_immune": {},
        "minecraft:nameable": {"always_show": True, "allow_name_tag_renaming": False},
        "minecraft:damage_sensor": {"triggers": [{"deals_damage": "no"}]}}}})

# ---------------- Resource pack ----------------

write(f"{RP}/entity/resting_heart.entity.json", {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
    "identifier": "siege:resting_heart", "materials": {"default": "entity_alphatest"},
    "textures": {"default": "textures/entity/siege_resting_heart"}, "geometry": {"default": "geometry.siege_resting_heart"},
    "render_controllers": ["controller.render.default"]}}})

write(f"{RP}/entity/throne_seal.entity.json", {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
    "identifier": "siege:throne_seal", "materials": {"default": "entity_alphatest"},
    "textures": {"default": "textures/entity/siege_throne_seal"}, "geometry": {"default": "geometry.siege_throne_seal"},
    "render_controllers": ["controller.render.default"]}}})

def faces(u, v, w, h, d):
    """Per-face UVs for a cube, all sampled from one patch of a small texture."""
    side = {"uv": [u, v], "uv_size": [w, h]}
    return {"north": side, "south": side, "east": {"uv": [u, v], "uv_size": [d, h]}, "west": {"uv": [u, v], "uv_size": [d, h]},
            "up": {"uv": [u, v], "uv_size": [w, d]}, "down": {"uv": [u, v], "uv_size": [w, d]}}

def cube(origin, size, uv=(0, 0)):
    w, h, d = [min(16, max(1, round(s))) for s in size]
    return {"origin": origin, "size": size, "uv": faces(uv[0], uv[1], min(w, 16 - uv[0]), min(h, 16 - uv[1]), min(d, 16 - uv[0]))}

def geo(path, ident, cubes, tex=(16, 16), bones=None):
    write(path, {"format_version": "1.12.0", "minecraft:geometry": [{
        "description": {"identifier": ident, "texture_width": tex[0], "texture_height": tex[1],
                        "visible_bounds_width": 3, "visible_bounds_height": 3, "visible_bounds_offset": [0, 1.5, 0]},
        "bones": bones or [{"name": "block", "pivot": [0, 0, 0], "cubes": cubes}]}]})

# Throne: a stone seat with a tall gold-trimmed back and two arm rests (the back is to the north; it reads fine from any side)
geo(f"{RP}/models/blocks/throne.geo.json", "geometry.siege_throne", [
    cube([-7, 0, -7], [14, 6, 14], (0, 8)),      # plinth
    cube([-6, 6, -5], [12, 2, 11], (2, 0)),      # cushion
    cube([-7, 6, -7], [2, 6, 13], (0, 0)),       # arm
    cube([5, 6, -7], [2, 6, 13], (0, 0)),        # arm
    cube([-6, 6, -7], [12, 16, 2], (0, 0)),      # back
    cube([-7, 20, -7], [3, 5, 2], (12, 0)),      # finial
    cube([4, 20, -7], [3, 5, 2], (12, 0)),       # finial
    cube([-2, 22, -7], [4, 5, 2], (12, 0)),      # crest
])
geo(f"{RP}/models/blocks/fallen_shard.geo.json", "geometry.siege_fallen_shard", [
    cube([-2, 0, -2], [4, 13, 4], (0, 0)),
    cube([-4, 0, -1], [3, 7, 3], (8, 4)),
    cube([1, 0, 1], [3, 9, 3], (8, 0)),
    cube([-1, 0, -4], [2, 5, 2], (4, 8)),
])
geo(f"{RP}/models/entity/throne_seal.geo.json", "geometry.siege_throne_seal", [
    {"origin": [-5, 4, -5], "size": [10, 10, 10], "uv": [0, 0]},
    {"origin": [-2, 0, -2], "size": [4, 4, 4], "uv": [0, 20]},
    {"origin": [-7, 14, -7], "size": [14, 2, 14], "uv": [0, 32]},
], tex=(64, 64), bones=[{"name": "seal", "pivot": [0, 0, 0], "cubes": [
    {"origin": [-5, 6, -5], "size": [10, 10, 10], "uv": [0, 0]},
    {"origin": [-2, 0, -2], "size": [4, 6, 4], "uv": [0, 20]},
    {"origin": [-7, 16, -7], "size": [14, 2, 14], "uv": [0, 32]}]}])

geo(f"{RP}/models/entity/resting_heart.geo.json", "geometry.siege_resting_heart", [
    {"origin": [-3, 4, -3], "size": [6, 7, 6], "uv": [0, 0]},
], tex=(32, 32), bones=[{"name": "heart", "pivot": [0, 0, 0], "cubes": [
    {"origin": [-3, 5, -3], "size": [6, 7, 6], "uv": [0, 0]},
    {"origin": [-4, 7, -2], "size": [8, 4, 4], "uv": [0, 14]},
    {"origin": [-1, 12, -1], "size": [2, 2, 2], "uv": [0, 24]}]}])

# The Hollow Crown, worn: a gold band sitting on the head with six tall points
band = [{"origin": [-4.5, 31, -4.5], "size": [9, 2, 9], "uv": [0, 0]}]
points = [{"origin": [x, 33, z], "size": [w, h, d], "uv": [0, 12]} for x, z, w, d, h in [
    (-4.5, -4.5, 1, 1, 3), (3.5, -4.5, 1, 1, 3), (-4.5, 3.5, 1, 1, 3), (3.5, 3.5, 1, 1, 3),
    (-1, -4.5, 2, 1, 4), (-1, 3.5, 2, 1, 2), (-4.5, -1, 1, 2, 2), (3.5, -1, 1, 2, 2)]]
gem = [{"origin": [-0.5, 31.5, -5], "size": [1, 1, 1], "uv": [8, 12]}]
# The worn Hollow Crown model is final art from studio/art/build_crown_art.py: only write a stand-in if it is missing
if not os.path.exists(f"{RP}/models/entity/hollow_crown.geo.json"): geo(f"{RP}/models/entity/hollow_crown.geo.json", "geometry.siege_hollow_crown", None, tex=(64, 32),
    bones=[{"name": "head", "pivot": [0, 24, 0], "cubes": band + points + gem}])
write(f"{RP}/attachables/hollow_crown.json", {"format_version": "1.8.0", "minecraft:attachable": {"description": {
    "identifier": "siege:hollow_crown", "materials": {"default": "armor", "enchanted": "armor_enchanted"},
    "textures": {"default": "textures/models/armor/siege_hollow_crown", "enchanted": "textures/misc/enchanted_actor_glint"},
    "geometry": {"default": "geometry.siege_hollow_crown"},
    "render_controllers": ["controller.render.armor"]}}})

# ---------------- Placeholder textures (final art comes in the all-textures pass) ----------------

GOLD = [(74, 48, 22), (122, 84, 28), (176, 128, 36), (214, 170, 58), (240, 206, 96), (252, 236, 160)]
STONE = [(40, 38, 48), (62, 60, 70), (86, 84, 92), (110, 108, 114), (134, 132, 136), (160, 158, 158)]
VOID = [(30, 18, 52), (58, 36, 98), (96, 66, 160), (140, 110, 214), (186, 166, 250), (228, 220, 255)]
STEEL = [(44, 46, 58), (78, 82, 96), (118, 124, 138), (160, 166, 178), (198, 204, 212), (232, 236, 240)]

def tex(path, size, paint):
    if os.path.exists(path):
        return  # never put a placeholder back over art that is already there (the textures thread paints the final ones)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    paint(ImageDraw.Draw(img), img)
    img.save(path)

def shaded(d, box, ramp):
    x1, y1, x2, y2 = box
    d.rectangle(box, fill=ramp[2])
    d.line([(x1, y1), (x2, y1)], fill=ramp[4]); d.line([(x1, y1), (x1, y2)], fill=ramp[3])
    d.line([(x1, y2), (x2, y2)], fill=ramp[1]); d.line([(x2, y1), (x2, y2)], fill=ramp[1])

B, I, A = f"{RP}/textures/blocks", f"{RP}/textures/items", f"{RP}/textures/models/armor"

def cornerstone_side(d, img):
    shaded(d, (0, 0, 15, 15), STONE)
    d.rectangle((0, 6, 15, 9), fill=GOLD[2]); d.line([(0, 6), (15, 6)], fill=GOLD[4]); d.line([(0, 9), (15, 9)], fill=GOLD[1])
    for x in (3, 8, 12): d.point((x, 3), fill=STONE[1]); d.point((x + 1, 12), fill=STONE[1])
def cornerstone_top(d, img):
    shaded(d, (0, 0, 15, 15), STONE)
    for x, y in [(7, 3), (8, 3), (5, 5), (10, 5), (5, 6), (10, 6), (5, 7), (6, 7), (7, 7), (8, 7), (9, 7), (10, 7), (5, 9), (6, 9), (7, 9), (8, 9), (9, 9), (10, 9), (5, 10), (10, 10)]:
        d.point((x, y), fill=GOLD[3])
def throne(d, img):
    shaded(d, (0, 0, 11, 7), GOLD)          # back / arms / cushion patch
    d.rectangle((2, 1, 9, 6), fill=(132, 30, 34)); d.line([(2, 1), (9, 1)], fill=(170, 52, 50))
    shaded(d, (12, 0, 15, 7), GOLD)         # finials
    shaded(d, (0, 8, 15, 15), STONE)        # plinth
    d.line([(0, 8), (15, 8)], fill=GOLD[3])
def fallen_shard(d, img):
    d.rectangle((0, 0, 15, 15), fill=VOID[2])
    for i in range(0, 16, 3):
        d.line([(i, 0), (i - 5, 15)], fill=VOID[4]); d.line([(i + 1, 0), (i - 4, 15)], fill=VOID[1])
    d.line([(0, 0), (15, 0)], fill=VOID[5])
tex(f"{B}/siege_cornerstone_side.png", (16, 16), cornerstone_side)
tex(f"{B}/siege_cornerstone_top.png", (16, 16), cornerstone_top)
tex(f"{B}/siege_throne.png", (16, 16), throne)
tex(f"{B}/siege_fallen_shard.png", (16, 16), fallen_shard)

def px(d, rows, ramp_of):
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != ".": d.point((x, y), fill=ramp_of[ch])
G = {str(i): GOLD[i] for i in range(6)}; G["r"] = (150, 34, 38); G["v"] = VOID[3]; G["V"] = VOID[5]
S = {str(i): STEEL[i] for i in range(6)}; S["g"] = GOLD[3]; S["l"] = (104, 70, 40); S["L"] = (70, 46, 28)
P = {str(i): VOID[i] for i in range(6)}
tex(f"{I}/siege_hollow_crown.png", (16, 16), lambda d, img: px(d, [
    "................", "................", "................",
    ".0.....00.....0.", ".40...0450...04.", ".340..0340..043.", ".2340.0230.0432.",
    ".2234023320432 .".replace(" ", "1"), ".22332v3V2v3321.", ".1222222222221 .".replace(" ", "0"),
    ".0r11r11r11r110.", ".01111111111100.", "..000000000000..",
    "................", "................", "................"], G))
H = {"0": (46, 14, 40), "1": (92, 24, 62), "2": (150, 40, 84), "3": (206, 70, 104), "4": (244, 128, 140), "5": (255, 206, 200), "v": VOID[3], "V": VOID[5]}
tex(f"{I}/siege_heart_of_the_hollow.png", (16, 16), lambda d, img: px(d, [
    "................", "......v..v......", ".....0v00v0.....", "...00320032000..", "..0345300345320.",
    "..0344322344320.", "..03433V3343210.", "..023332V332210.", "...0233V233210..", "...0223322V210..",
    "....02232V210...", ".....022V210....", "......02210.....", ".......010......", "........0.......", "................"], H))
tex(f"{I}/siege_crown_shard.png", (16, 16), lambda d, img: px(d, [
    "................", ".......00.......", "......0450......", "......04350.....", ".....043320.....",
    ".....0433210....", "....04332210....", "....04322110....", "...043322110....", "...04322110.....",
    "...0322110......", "....032110......", "....02110.......", ".....010........", "......0.........", "................"], P))
tex(f"{I}/siege_gauntlet_of_challenge.png", (16, 16), lambda d, img: px(d, [
    "................", "....0.0.0.0.....", "...0404040400...", "...0303030300...", "...03030303040..",
    "...02323232330..", "...023333333300.", "...023333332340.", "...012333332330.", "....0123332220..",
    "....0gggggggg0..", "....0122222210..", "....0L2222221L..".replace("L", "0"), ".....01111110...", ".....0llllll0...", "......000000...."], S))

def crown_worn(d, img):  # 64x32: band at 0,0 (9x2x9 box layout), points at 0,12, gem at 8,12
    d.rectangle((0, 0, 35, 10), fill=GOLD[2]); d.line([(0, 9), (35, 9)], fill=GOLD[4]); d.line([(0, 10), (35, 10)], fill=GOLD[1])
    for x in range(2, 36, 5): d.point((x, 9), fill=(150, 34, 38))
    d.rectangle((0, 12, 7, 18), fill=GOLD[3]); d.line([(0, 14), (7, 14)], fill=GOLD[5])
    d.rectangle((8, 12, 11, 13), fill=VOID[4])
tex(f"{A}/siege_hollow_crown.png", (64, 32), crown_worn)

def seal(d, img):  # 64x64, a pale violet seal-stone
    d.rectangle((0, 0, 63, 63), fill=VOID[2])
    for y in range(0, 64, 6): d.line([(0, y), (63, y)], fill=VOID[3])
    for x in range(3, 64, 10): d.rectangle((x, 6, x + 3, 12), fill=VOID[5])
    d.rectangle((0, 32, 55, 47), fill=GOLD[2]); d.line([(0, 32), (55, 32)], fill=GOLD[4])
tex(f"{RP}/textures/entity/siege_throne_seal.png", (64, 64), seal)

def resting_heart(d, img):  # 32x32, dark flesh with pale veins
    d.rectangle((0, 0, 31, 31), fill=VOID[1])
    for y in range(2, 32, 5): d.line([(0, y), (31, y - 2)], fill=VOID[4])
    d.rectangle((0, 24, 7, 27), fill=GOLD[3])
tex(f"{RP}/textures/entity/siege_resting_heart.png", (32, 32), resting_heart)

# ---------------- Shared lists ----------------

merge(f"{RP}/textures/terrain_texture.json", "texture_data", {n: {"textures": f"textures/blocks/{n}"} for n in
      ["siege_cornerstone_side", "siege_cornerstone_top", "siege_throne", "siege_fallen_shard"]})
merge(f"{RP}/textures/item_texture.json", "texture_data", {f"siege_{n}": {"textures": f"textures/items/siege_{n}"} for n in
      ["hollow_crown", "heart_of_the_hollow", "crown_shard", "gauntlet_of_challenge"]})
merge(f"{RP}/blocks.json", None, {"siege:citadel_cornerstone": {"sound": "stone"}, "siege:throne": {"sound": "stone"},
                                   "siege:fallen_shard": {"sound": "amethyst_block"}})

NAMES = {
    "tile.siege:citadel_cornerstone.name": "Citadel Cornerstone",
    "tile.siege:throne.name": "The Throne",
    "tile.siege:fallen_shard.name": "Fallen Oath Shard",
    "item.siege:hollow_crown.name": "The Hollow Crown",
    "item.siege:heart_of_the_hollow.name": "The Heart of the Hollow",
    "item.siege:crown_shard.name": "Oath Shard",
    "item.siege:gauntlet_of_challenge.name": "Gauntlet of Challenge",
    "entity.siege:throne_seal.name": "Throne Seal",
    "entity.siege:resting_heart.name": "The Heart of the Hollow",
}
for pack in (BP, RP):
    path = f"{pack}/texts/en_US.lang"
    text = open(path, encoding="utf8").read()
    add = [f"{k}={v}" for k, v in NAMES.items() if f"{k}=" not in text]
    if add:
        with open(path, "a", encoding="utf8") as f:
            f.write(("" if text.endswith("\n") else "\n") + "\n".join(add) + "\n")
print("Crown pack files written.")
