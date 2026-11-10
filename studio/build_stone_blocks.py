#!/usr/bin/env python3
"""The Castle Stone family as blocks (Mateo, 2026-11-10): every region gets Castle Stone, Tiles, Bricks, Cobbled and
Smooth. Vale's Castle Stone is the original siege:castle_stone; this adds the other 24 blocks, their recipes and names,
and points them at the textures painted by studio/art/build_stone_family.py (it never touches a PNG).
Ids: siege:castle_<kind> for the Vale, siege:castle_<kind>_<region> elsewhere; kind = stone | tiles | bricks | cobbled | smooth.
Run from the siege-nights folder:  python3 studio/build_stone_blocks.py     (safe to run again)"""
import copy, json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BP, RP = os.path.join(ROOT, "Siege_Nights_BP"), os.path.join(ROOT, "Siege_Nights_RP")
REGIONS = {"vale": "", "frostmarch": "Frostmarch ", "saltreach": "Saltreach ", "emberwaste": "Emberwaste ", "blackfen": "Blackfen "}
KINDS = {"stone": "Castle Stone", "tiles": "Castle Stone Tiles", "bricks": "Castle Stone Bricks", "cobbled": "Cobbled Castle Stone", "smooth": "Smooth Castle Stone"}
MAP = {"vale": "#707070", "frostmarch": "#5a6270", "saltreach": "#c8ccc8", "emberwaste": "#c09a64", "blackfen": "#5c6450"}
# what a region's Castle Stone is cut from (8 around 1 iron ingot makes 16, like the Vale's)
QUARRY = {"frostmarch": "minecraft:cobbled_deepslate", "saltreach": "minecraft:calcite", "emberwaste": "minecraft:sandstone", "blackfen": "minecraft:mud_bricks"}

def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf8") as f:
        json.dump(data, f, indent=2)
        f.write("\n")

def load(path):
    with open(path, encoding="utf8") as f:
        return json.load(f)

block_id = lambda kind, region: f"siege:castle_{kind}" + ("" if region == "vale" else f"_{region}")
tex = lambda kind, region: f"siege_castle_{kind}" + ("" if region == "vale" else f"_{region}")
tex_path = lambda name, region: "textures/blocks/" + ("" if region == "vale" else "regional/") + name

textures, names, ids = {}, {}, []
original = load(os.path.join(BP, "blocks", "castle_stone.json"))

for region, prefix in REGIONS.items():
    for kind, title in KINDS.items():
        if region == "vale" and kind == "stone":
            continue  # the original block
        bid, base = block_id(kind, region), tex(kind, region)
        ids.append(bid)
        names[bid] = prefix + title
        if kind == "stone":
            # the same reinforcing and crack states as the Vale's Castle Stone, with this region's textures
            data = json.loads(json.dumps(copy.deepcopy(original)).replace("siege_castle_stone", base).replace("siege:castle_stone", bid))
            for tier in ("stone", "iron", "diamond", "netherite"):
                for n in range(3):
                    textures[f"{base}_{tier}_{n}"] = tex_path(f"{base}_{tier}_{n}", region)
            data["minecraft:block"]["components"]["minecraft:map_color"] = MAP[region]
        else:
            data = {"format_version": "1.21.60", "minecraft:block": {
                "description": {"identifier": bid, "menu_category": {"category": "construction"}, "states": {"siege:cracks": [0, 1, 2]}},
                "components": {
                    "minecraft:display_name": f"tile.{bid}.name",
                    "minecraft:destructible_by_mining": {"seconds_to_destroy": 2.5},
                    "minecraft:destructible_by_explosion": {"explosion_resistance": 30},
                    "minecraft:geometry": "minecraft:geometry.full_block",
                    "minecraft:material_instances": {"*": {"texture": base, "render_method": "opaque"}},
                    "minecraft:map_color": MAP[region],
                },
                "permutations": [{"condition": f"q.block_state('siege:cracks') == {n}", "components": {
                    "minecraft:material_instances": {"*": {"texture": f"{base}_stone_{n}", "render_method": "opaque"}}}} for n in range(3)],
            }}
            for n in range(3):
                textures[f"{base}_stone_{n}"] = tex_path(f"{base}_stone_{n}", region)
        data["minecraft:block"]["components"]["minecraft:display_name"] = f"tile.{bid}.name"
        textures[base] = tex_path(base, region)
        write_json(os.path.join(BP, "blocks", "stone", bid.split(":")[1] + ".json"), data)

def recipe(name, pattern, key, result, count):
    write_json(os.path.join(BP, "recipes", "stone", name + ".json"), {"format_version": "1.20.10", "minecraft:recipe_shaped": {
        "description": {"identifier": f"siege:{name}_recipe"}, "tags": ["siege_workshop"], "pattern": pattern, "key": key,
        "result": {"item": result, "count": count}, "unlock": {"context": "AlwaysUnlocked"}}})

for region in REGIONS:
    stone = block_id("stone", region)
    short = lambda kind: block_id(kind, region).split(":")[1]
    if region != "vale":
        recipe(short("stone"), ["SSS", "SIS", "SSS"], {"S": {"item": QUARRY[region]}, "I": {"item": "minecraft:iron_ingot"}}, stone, 16)
    recipe(short("bricks"), ["SS", "SS"], {"S": {"item": stone}}, block_id("bricks", region), 4)
    recipe(short("tiles"), ["BB", "BB"], {"B": {"item": block_id("bricks", region)}}, block_id("tiles", region), 4)
    recipe(short("smooth"), ["SSS"], {"S": {"item": stone}}, block_id("smooth", region), 3)
    recipe(short("cobbled"), ["S", "S"], {"S": {"item": stone}}, block_id("cobbled", region), 2)

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
for bid in ids:
    data[bid] = {"sound": "stone"}
write_json(path, data)

lang = os.path.join(RP, "texts", "en_US.lang")
text = open(lang, encoding="utf8").read()
for bid, title in names.items():
    line = f"tile.{bid}.name={title}"
    if f"tile.{bid}.name=" not in text:
        text = text.rstrip("\n") + "\n" + line + "\n"
open(lang, "w", encoding="utf8").write(text)
print(f"{len(ids)} Castle Stone family blocks written, {len(textures)} textures wired.")
