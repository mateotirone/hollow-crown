#!/usr/bin/env python3
"""Regional gates, portcullises, palisades, wall planks and roof shingles as blocks (Mateo, 2026-11-10: "we need all of
that"). The textures are painted under textures/blocks/regional/ by the textures feature; this only wires them up: block
files, recipes (Siege Workshop), names, terrain_texture.json and blocks.json. It never touches a PNG.
Ids: the Vale's have no region in their id (siege:castle_gate and siege:portcullis are the originals); elsewhere
siege:<name>_<region>. name = castle_gate | portcullis | palisade | wall_planks | roof_shingles.
Run from the repo root:  python3 studio/build_regional_blocks.py     (safe to run again)"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BP, RP = os.path.join(ROOT, "Siege_Nights_BP"), os.path.join(ROOT, "Siege_Nights_RP")
REGIONS = {"vale": "", "frostmarch": "Frostmarch ", "saltreach": "Saltreach ", "emberwaste": "Emberwaste ", "blackfen": "Blackfen "}
# the wood each region builds in (the same as its town hall style)
LOG = {"vale": "spruce_log", "frostmarch": "dark_oak_log", "saltreach": "birch_log", "emberwaste": "acacia_log", "blackfen": "mangrove_log"}
PLANKS = {r: l.replace("_log", "_planks") for r, l in LOG.items()}
WOOD_MAP = {"vale": "#7a5a34", "frostmarch": "#4a3420", "saltreach": "#c8b88a", "emberwaste": "#a8562e", "blackfen": "#6a3a34"}
ROOF_MAP = {"vale": "#3c3f4a", "frostmarch": "#3a2a1c", "saltreach": "#3c6a62", "emberwaste": "#b06a3a", "blackfen": "#4a5a34"}

def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf8") as f:
        json.dump(data, f, indent=2)
        f.write("\n")

def load(path):
    with open(path, encoding="utf8") as f:
        return json.load(f)

bid = lambda name, region: f"siege:{name}" + ("" if region == "vale" else f"_{region}")
textures, names, sounds, written = {}, {}, {}, 0

def recipe(name, pattern, key, result, count):
    write_json(os.path.join(BP, "recipes", "regional", name + ".json"), {"format_version": "1.20.10", "minecraft:recipe_shaped": {
        "description": {"identifier": f"siege:{name}_recipe"}, "tags": ["siege_workshop"], "pattern": pattern, "key": key,
        "result": {"item": result, "count": count}, "unlock": {"context": "AlwaysUnlocked"}}})

def full_block(block, texture, title, seconds, blast, colour, sound, flammable):
    global written
    components = {
        "minecraft:display_name": f"tile.{block}.name",
        "minecraft:destructible_by_mining": {"seconds_to_destroy": seconds},
        "minecraft:destructible_by_explosion": {"explosion_resistance": blast},
        "minecraft:geometry": "minecraft:geometry.full_block",
        "minecraft:material_instances": {"*": {"texture": texture, "render_method": "opaque"}},
        "minecraft:map_color": colour,
    }
    if flammable:
        components["minecraft:flammable"] = {"catch_chance_modifier": 5, "destroy_chance_modifier": 20}
    write_json(os.path.join(BP, "blocks", "regional", block.split(":")[1] + ".json"), {"format_version": "1.21.60", "minecraft:block": {
        "description": {"identifier": block, "menu_category": {"category": "construction"}}, "components": components}})
    textures[texture] = f"textures/blocks/regional/{texture}"
    names[block], sounds[block] = title, sound
    written += 1

for region, prefix in REGIONS.items():
    stone = "siege:castle_stone" + ("" if region == "vale" else f"_{region}")
    tiles = "siege:castle_tiles" + ("" if region == "vale" else f"_{region}")
    palisade, planks, shingles = bid("palisade", region), bid("wall_planks", region), bid("roof_shingles", region)
    full_block(palisade, f"siege_palisade_{region}", prefix + "Palisade", 2.5, 4, WOOD_MAP[region], "wood", True)
    full_block(planks, f"siege_wall_planks_{region}", prefix + "Wall Planks", 2, 3, WOOD_MAP[region], "wood", True)
    full_block(shingles, f"siege_roof_shingles_{region}", prefix + "Roof Shingles", 2, 20, ROOF_MAP[region], "stone", False)
    recipe(palisade.split(":")[1], ["LL", "LL"], {"L": {"item": f"minecraft:{LOG[region]}"}}, palisade, 4)
    recipe(planks.split(":")[1], ["PP", "PP"], {"P": {"item": f"minecraft:{PLANKS[region]}"}}, planks, 4)
    recipe(shingles.split(":")[1], ["TT"], {"T": {"item": tiles}}, shingles, 2)
    if region == "vale":
        continue  # siege:castle_gate and siege:portcullis are the Vale's
    # gates and portcullises: the originals with this region's textures (same states, armor and opening)
    for name, tex in (("castle_gate", "siege_castle_gate"), ("portcullis", "siege_portcullis")):
        block = bid(name, region)
        raw = json.dumps(load(os.path.join(BP, "blocks", name + ".json")))
        raw = raw.replace(f'"{tex}', f'"{tex}_{region}').replace(f"siege:{name}", block)
        write_json(os.path.join(BP, "blocks", "regional", block.split(":")[1] + ".json"), json.loads(raw))
        for suffix in ("", "_open", "_iron", "_diamond", "_netherite"):
            textures[f"{tex}_{region}{suffix}"] = f"textures/blocks/regional/{tex}_{region}{suffix}"
        names[block] = prefix + ("Castle Gate" if name == "castle_gate" else "Portcullis")
        sounds[block] = "wood" if name == "castle_gate" else "metal"
        written += 1
    recipe(f"castle_gate_{region}", ["PNP", "PPP", "PNP"], {"P": {"item": planks}, "N": {"item": "minecraft:iron_nugget"}}, bid("castle_gate", region), 4)
    recipe(f"portcullis_{region}", ["BBB", "BSB", "BBB"], {"B": {"item": "minecraft:iron_bars"}, "S": {"item": stone}}, bid("portcullis", region), 4)

missing = [p for p in textures.values() if not os.path.exists(os.path.join(RP, p + ".png"))]
if missing:
    print("WARNING, textures not painted yet:", ", ".join(missing))

path = os.path.join(RP, "textures", "terrain_texture.json")
data = load(path)
for name, p in textures.items():
    data["texture_data"][name] = {"textures": p}
write_json(path, data)

path = os.path.join(RP, "blocks.json")
data = load(path)
for block, sound in sounds.items():
    data[block] = {"sound": sound}
write_json(path, data)

lang = os.path.join(RP, "texts", "en_US.lang")
text = open(lang, encoding="utf8").read()
for block, title in names.items():
    if f"tile.{block}.name=" not in text:
        text = text.rstrip("\n") + f"\ntile.{block}.name={title}\n"
open(lang, "w", encoding="utf8").write(text)
print(f"{written} regional blocks written, {len(textures)} textures wired.")
