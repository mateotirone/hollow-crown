"""Builds every Undertow block, item, recipe, fog and placeholder texture.
Safe to run again: it only adds or replaces its own entries in the shared JSON and lang files.
Run from the siege-nights folder:  python3 studio/build_undertow.py
"""
import json, os, random
from PIL import Image

BP, RP = "Siege_Nights_BP", "Siege_Nights_RP"

def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")

# name: (display, map color, options)
BLOCKS = {
    "veinstone": ("Veinstone", "#2a2230", dict(hard=2.5, sound="deepslate")),
    "undertow_moss": ("Veilmoss", "#5a2f6e", dict(hard=0.8, sound="moss_block")),
    "veil_rock": ("Veil Rock", "#1c1622", dict(unbreakable=True, lets_light=True, sound="deepslate")),
    "hollowwood_lattice": ("Latticewood", "#7a4a8a", dict(hard=1.5, cutout=True, sound="nether_wood")),
    "hollowwood_core": ("Latticewood Core", "#ff9ad0", dict(hard=1.5, light=12, sound="nether_wood")),
    "veilcap": ("Veilcap", "#ff8fd0", dict(plant=True, light=9, sound="fungus")),
    "glimbulb": ("Glimbulb", "#a8e4ff", dict(plant=True, light=7, sound="fungus")),
    "glimmerflow": ("Glimmerflow", "#bfeaff", dict(ghost=True, light=13, unbreakable=True, sound="powder_snow")),
    "rift_seam": ("Strange Seam", "#2a2230", dict(unbreakable=True, light=2, sound="deepslate")),
    "rift_edge": ("Rift Edge", "#8a3fd0", dict(unbreakable=True, light=10, sound="amethyst_block")),
    "rift_veil": ("Rift Veil", "#c9a0ff", dict(ghost=True, light=15, unbreakable=True, no_select=True, sound="amethyst_block")),
    "waystone": ("Waystone", "#9ad8ff", dict(unbreakable=True, light=11, sound="amethyst_block")),
    "choir_ore": ("Choir Ore", "#b98cff", dict(ore=True, light=6, sound="amethyst_block")),
    # Hollow masonry and ground cover (art by the textures thread; ids agreed 2026-11-10)
    "veinstone_bricks": ("Veinstone Bricks", "#33263f", dict(hard=3, sound="deepslate_bricks")),
    "cracked_veinstone_bricks": ("Cracked Veinstone Bricks", "#2d2238", dict(hard=3, sound="deepslate_bricks")),
    "pale_ash": ("Pale Ash", "#b9b4c4", dict(hard=0.5, sound="sand")),
    "glint_cluster": ("Glint Cluster", "#6fc6ff", dict(plant=True, light=12, sound="amethyst_cluster")),
    # Giant Veilcaps and hanging moss (Hollow world thread, Mateo said yes 2026-11-10)
    "veilcap_cap": ("Veilcap Cap", "#ff9ad0", dict(hard=0.4, light=11, sound="fungus")),
    "veilcap_stem": ("Veilcap Stem", "#e6dcef", dict(hard=0.6, sound="fungus")),
    "veilmoss_strands": ("Veilmoss Strands", "#8a3f86", dict(plant=True, light=3, sound="fungus")),
    "court_seal": ("Court Seal", "#16323a", dict(unbreakable=True, sound="stone")),
}

def block_json(name, display, color, o):
    comp = {
        "minecraft:display_name": f"tile.siege:{name}.name",
        "minecraft:map_color": color,
        "minecraft:geometry": "minecraft:geometry.cross" if o.get("plant") else "minecraft:geometry.full_block",
        "minecraft:material_instances": {"*": {
            "texture": f"siege_{name}",
            "render_method": "blend" if o.get("ghost") else "alpha_test" if (o.get("plant") or o.get("cutout")) else "opaque",
        }},
    }
    if o.get("ore"):
        # Slow by hand, quicker with a diamond or netherite pickaxe: mining it is a race against the Warden.
        comp["minecraft:destructible_by_mining"] = {"seconds_to_destroy": 30, "item_specific_speeds": [
            {"item": {"tags": "q.any_tag('minecraft:diamond_tier', 'minecraft:netherite_tier') && q.any_tag('minecraft:is_pickaxe')"}, "destroy_speed": 6}]}
        comp["minecraft:destructible_by_explosion"] = False
        comp["minecraft:loot"] = "loot_tables/blocks/siege_nothing.json"  # the script hands out the ore (yield, tithe)
    elif o.get("unbreakable"):
        comp["minecraft:destructible_by_mining"] = False
        comp["minecraft:destructible_by_explosion"] = False
    else:
        comp["minecraft:destructible_by_mining"] = {"seconds_to_destroy": 0 if o.get("plant") else o.get("hard", 1.5)}
        comp["minecraft:destructible_by_explosion"] = {"explosion_resistance": 6}
    if o.get("light"):
        comp["minecraft:light_emission"] = o["light"]
    if o.get("plant") or o.get("ghost") or o.get("cutout") or o.get("lets_light"):
        comp["minecraft:light_dampening"] = 0
    if o.get("plant") or o.get("ghost"):
        comp["minecraft:collision_box"] = False
        mi = comp["minecraft:material_instances"]["*"]
        mi["face_dimming"] = False
        mi["ambient_occlusion"] = False
    if o.get("plant"):
        comp["minecraft:selection_box"] = {"origin": [-5, 0, -5], "size": [10, 12, 10]}
    if o.get("no_select"):
        comp["minecraft:selection_box"] = False
    return {"format_version": "1.21.60", "minecraft:block": {
        "description": {"identifier": f"siege:{name}", "menu_category": {"category": "nature"}},
        "components": comp}}

ITEMS = {
    "tuning_fork": ("Tuning Fork", 1),
    "choir_shard": ("Faded Choir Shard", 16),  # the old one-size shard: scripts/bestiary/shards.js turns it into a boss's own
    "raw_choir_ore": ("Raw Choir Ore", 64),
    "choirsteel_ingot": ("Choirsteel Ingot", 64),
    "wardens_bell": ("The Deep Bell", 1),
}

def item_json(name, stack):
    return {"format_version": "1.21.60", "minecraft:item": {
        "description": {"identifier": f"siege:{name}", "menu_category": {"category": "items"}},
        "components": {
            "minecraft:icon": f"siege_{name}",
            "minecraft:display_name": {"value": f"item.siege:{name}.name"},
            "minecraft:max_stack_size": stack,
            "minecraft:glint": True,
        }}}

# One Choir Shard from each of the five regional bosses (studio/build_codex.py makes them), never two of the same
FORK_RECIPE = {"format_version": "1.20.10", "minecraft:recipe_shapeless": {
    "description": {"identifier": "siege:tuning_fork_recipe"},
    "tags": ["siege_workshop"],
    "ingredients": [{"item": f"siege:choir_shard_{b}"} for b in ("reeve", "huntsman", "bride", "seneschal", "mother")] + [{"item": "minecraft:amethyst_shard"}],
    "result": {"item": "siege:tuning_fork", "count": 1},
    "unlock": {"context": "AlwaysUnlocked"}}}

FOG = {"format_version": "1.16.100", "minecraft:fog_settings": {
    "description": {"identifier": "siege:undertow_fog"},
    "distance": {
        "air": {"fog_start": 6, "fog_end": 76, "fog_color": "#3b2360", "render_distance_type": "fixed"},
        "water": {"fog_start": 0, "fog_end": 18, "fog_color": "#2a3f7a", "render_distance_type": "fixed"},
        "weather": {"fog_start": 6, "fog_end": 76, "fog_color": "#3b2360", "render_distance_type": "fixed"},
    },
    "volumetric": {"density": {"air": {"max_density": 0.35, "uniform": True}}},
}}

# ---- placeholder textures (16x16) ---------------------------------------------------------
def tex(name, fn, folder="blocks"):
    random.seed(name)
    im = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    px = im.load()
    for y in range(16):
        for x in range(16):
            c = fn(x, y)
            if c: px[x, y] = c
    path = f"{RP}/textures/{folder}/siege_{name}.png"
    os.makedirs(os.path.dirname(path), exist_ok=True)
    # Never overwrite an existing texture: the textures thread paints final art over these
    # placeholders (studio/art/build_hollowcrown.py). Only brand-new assets get a placeholder.
    if os.path.exists(path): return
    im.save(path)

def jitter(c, n=10, a=255):
    d = random.randint(-n, n)
    return tuple(max(0, min(255, v + d)) for v in c) + (a,)

def veinstone(x, y):
    vein = (x * 3 + y * 5) % 17 == 0 or (x - y) % 13 == 0 and random.random() < 0.6
    return jitter((150, 70, 190), 15) if vein else jitter((40, 32, 46), 6)
def moss(x, y): return jitter((98, 48, 120), 14) if random.random() < 0.8 else jitter((190, 110, 210), 10)
def veil_rock(x, y): return jitter((26, 20, 32), 5)
def lattice(x, y):
    cx, cy = (x % 8) - 3.5, (y % 8) - 3.5
    return None if cx * cx + cy * cy < 6.5 else jitter((120, 72, 140), 12)
def core(x, y):
    cx, cy = (x % 8) - 3.5, (y % 8) - 3.5
    return jitter((255, 160, 200), 10) if cx * cx + cy * cy < 6.5 else jitter((120, 72, 140), 12)
def veilcap(x, y):
    if y >= 8: return (240, 200, 235, 255) if x in (7, 8) else None
    w = [0, 3, 5, 6, 7, 7, 6, 2][y]
    return jitter((255, 140, 205), 14) if abs(x - 7.5) < w else None
def glimbulb(x, y):
    for sx, top in ((3, 6), (8, 2), (12, 8)):
        if abs(x - sx) <= 1 and abs(y - top) <= 1: return (200, 240, 255, 255)
        if x == sx and y > top: return (150, 170, 200, 255)
    return None
def bricks(x, y, cracked=False):
    row = y // 4
    mortar = y % 4 == 3 or (x + (4 if row % 2 else 0)) % 8 == 7
    if mortar: return jitter((24, 18, 30), 4)
    if cracked and ((x * 5 + y * 3) % 11 == 0 or (x - y * 2) % 13 == 0): return jitter((150, 70, 190), 18)
    return jitter((58, 42, 72), 7)
def cracked_bricks(x, y): return bricks(x, y, True)
def ash(x, y): return jitter((188, 183, 198), 9) if random.random() < 0.9 else jitter((140, 132, 156), 8)
def glint(x, y):
    for sx, top, wide in ((4, 7, 1), (8, 2, 2), (12, 9, 1)):
        if y >= top and abs(x - sx) <= (wide if y > top + 1 else 0): return jitter((120, 205, 255), 22) if x != sx else (215, 245, 255, 255)
    return None
def cap(x, y):
    spot = ((x * 7 + y * 13) % 11 == 0) or ((x * 5 + y * 3) % 17 == 0)
    return jitter((255, 214, 236), 8) if spot else jitter((238, 132, 190), 14) if (x + y * 2) % 5 else jitter((214, 104, 168), 10)
def stem(x, y):
    return jitter((206, 190, 222), 8) if x % 4 == 0 else jitter((236, 226, 244), 7)
def strands(x, y):
    length = [11, 0, 14, 7, 0, 16, 9, 0, 12, 15, 0, 6, 13, 0, 10, 16][x]
    if y >= length: return None
    return jitter((220, 120, 200), 12) if y == length - 1 else jitter((138, 63, 134), 14)
def flow(x, y): return jitter((170, 225, 255), 18, 150 + ((x + y * 2) % 5) * 12)
def seam(x, y):
    mid = 7 + (1 if (y // 3) % 2 else 0)
    if x == mid: return (190, 120, 255, 255)
    if abs(x - mid) == 1 and y % 4 == 1: return (110, 60, 160, 255)
    return veinstone(x, y) if random.random() < 0.15 else jitter((40, 32, 46), 6)
def edge(x, y): return jitter((150, 70, 230), 25) if (x + y) % 4 else jitter((225, 180, 255), 10)
def veil(x, y): return jitter((200, 160, 255), 25, 110 + ((x * 3 + y) % 6) * 14)
def waystone(x, y):
    rune = (x in (5, 10) and 3 <= y <= 12) or (y in (3, 8, 12) and 5 <= x <= 10)
    return (160, 225, 255, 255) if rune else jitter((52, 46, 60), 6)
def seal(x, y): return (70, 150, 160, 255) if (x % 8 == 0 or y % 8 == 0) else jitter((24, 54, 62), 5)
def fork(x, y):
    d = x + y
    if d == 15 and 2 <= x <= 8: return (150, 110, 60, 255)       # handle
    if (x - y) in (5, 9) and 12 >= x >= 8 and d < 20: return (215, 190, 255, 255)  # tines
    if d == 15 and 8 < x <= 10: return (215, 190, 255, 255)
    return None
def ore(x, y):
    cx, cy = (x % 8) - 3.5, (y % 8) - 3.5
    return jitter((200, 150, 255), 25) if abs(cx) + abs(cy) < 2.6 and (x // 8 + y // 8) % 2 == 0 else veinstone(x, y)
def raw_ore(x, y):
    return jitter((190, 140, 255), 30) if (x - 7.5) ** 2 + (y - 8) ** 2 < 22 + (x * 7 + y * 3) % 9 else None
def ingot(x, y):
    return jitter((215, 185, 255), 14) if 5 <= y <= 10 and 2 + (10 - y) // 2 <= x <= 12 + (10 - y) // 2 else None
def bell(x, y):
    if y < 3: return (150, 110, 60, 255) if x in (7, 8) else None
    w = [0, 0, 0, 2, 3, 3, 4, 4, 5, 5, 5, 6, 6, 0, 0, 0][y]
    if y == 13 and x in (7, 8): return (90, 60, 140, 255)
    return jitter((170, 120, 240), 16) if w and abs(x - 7.5) < w else None
def shard(x, y):
    inside = abs(x - 7.5) + abs(y - 7.5) * 0.55 < 4.5
    return jitter((185, 130, 255), 30) if inside else None

if __name__ == "__main__":
    for name, (display, color, o) in BLOCKS.items():
        write_json(f"{BP}/blocks/{name}.json", block_json(name, display, color, o))
    for name, (display, stack) in ITEMS.items():
        write_json(f"{BP}/items/{name}.json", item_json(name, stack))
    write_json(f"{BP}/recipes/tuning_fork.json", FORK_RECIPE)
    write_json(f"{RP}/fogs/undertow_fog.json", FOG)

    for name, fn in dict(veinstone=veinstone, undertow_moss=moss, veil_rock=veil_rock, hollowwood_lattice=lattice,
                         hollowwood_core=core, veilcap=veilcap, glimbulb=glimbulb, glimmerflow=flow, rift_seam=seam,
                         rift_edge=edge, rift_veil=veil, waystone=waystone, court_seal=seal, choir_ore=ore,
                         veinstone_bricks=bricks, cracked_veinstone_bricks=cracked_bricks, pale_ash=ash, glint_cluster=glint,
                         veilcap_cap=cap, veilcap_stem=stem, veilmoss_strands=strands).items():
        tex(name, fn)
    tex("tuning_fork", fork, "items")
    tex("choir_shard", shard, "items")
    tex("raw_choir_ore", raw_ore, "items")
    tex("choirsteel_ingot", ingot, "items")
    tex("wardens_bell", bell, "items")
    write_json(f"{BP}/loot_tables/blocks/siege_nothing.json", {"pools": []})
    write_json(f"{BP}/recipes/choirsteel_ingot.json", {"format_version": "1.20.10", "minecraft:recipe_furnace": {
        "description": {"identifier": "siege:choirsteel_ingot_smelt"}, "tags": ["blast_furnace"],
        "input": "siege:raw_choir_ore", "output": "siege:choirsteel_ingot"}})

    # Shared files: re-read right before writing, touch only our keys.
    p = f"{RP}/textures/terrain_texture.json"; d = json.load(open(p))
    # setdefault: the textures thread may have replaced an entry with variants; leave theirs alone.
    for name in BLOCKS: d["texture_data"].setdefault(f"siege_{name}", {"textures": f"textures/blocks/siege_{name}"})
    write_json(p, d)
    p = f"{RP}/textures/item_texture.json"; d = json.load(open(p))
    before = json.dumps(d)
    for name in ITEMS: d["texture_data"].setdefault(f"siege_{name}", {"textures": f"textures/items/siege_{name}"})
    if json.dumps(d) != before: write_json(p, d)  # shared file: leave it byte for byte alone unless we add something
    p = f"{RP}/blocks.json"; d = json.load(open(p))
    for name, (_, _, o) in BLOCKS.items(): d[f"siege:{name}"] = {"sound": o["sound"]}
    write_json(p, d)
    for pack in (BP, RP):
        p = f"{pack}/texts/en_US.lang"
        if not os.path.exists(p): continue
        lines = open(p).read().splitlines()
        want = {f"tile.siege:{n}.name": v[0] for n, v in BLOCKS.items()}
        want.update({f"item.siege:{n}.name": v[0] for n, v in ITEMS.items()})
        # Shared file: change our lines in place and only append what is new, so nothing is reordered.
        have = {l.split("=")[0] for l in lines}
        lines = [f"{l.split('=')[0]}={want[l.split('=')[0]]}" if l.split("=")[0] in want else l for l in lines]
        lines += [f"{k}={v}" for k, v in want.items() if k not in have]
        open(p, "w").write("\n".join(lines) + "\n")
    print("Undertow content built.")
