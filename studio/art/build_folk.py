"""Folk: our own villagers (Mateo 2026-11-15: "every single thing needs a skin"), so no vanilla villager is ever seen.

siege:folk is a plain walking person who can be hurt: the homecoming strangers, the Returned-case suspects, a
Quartermaster who has lost his desk, and every Returned. Each folk wears one of SKINS (six looks per region, painted with
the NPC painter in build_npc_skins.py). A Returned wears the same skin with a TELL (Mateo: "something slightly
different that could be noticeable by the player, but it's a little weird"):
  - the wrong hand: everyone wears a pouch on the right hip and rolls up the right sleeve; a Returned does it on the
    left (arms swapped and the body mirrored, so belt, apron and buckle sit wrong too)
  - the eyes look a little past you (pupils at the outer corners)
  - the hem and boots are still dark with water
Writes
  Siege_Nights_RP/textures/entity/siege/folk/<key>.png and tell_<key>.png
  Siege_Nights_RP/entity/folk.entity.json, render_controllers/siege_folk.render_controllers.json
  Siege_Nights_BP/entities/folk.json                 properties siege:skin (0..n-1) and siege:tell (bool)
  Siege_Nights_BP/scripts/folk/skins_data.js         FOLK_SKINS (order = siege:skin), by region
Run: python3 studio/art/build_folk.py [sheet.png]
"""
import json, os, random, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
import build_npc_skins as N
from build_townsfolk import front_view

ROOT = N.ROOT
OUT = os.path.join(ROOT, 'Siege_Nights_RP/textures/entity/siege/folk/')
TEX = 'textures/entity/siege/folk/'
REGIONS = ['vale', 'frostmarch', 'saltreach', 'emberwaste', 'blackfen']
PER_REGION = 6
# region palettes: tunics, overs, legs, heads, and the clothes people wear there
PAL = {
    'vale': (['#7a5a3a', '#5a7a34', '#8a3a26', '#6a4a5a', '#4e5868', '#b08a3a'], ['#cdc2a6', '#7a4e2c', '#e2d9c0'],
             ['#4a3e30', '#3a3428', '#5a4a36'], ['apron', 'vest', 'none', 'sash'], ['short', 'long', 'cap', 'kerchief']),
    'frostmarch': (['#3a4e62', '#5a6878', '#7a2424', '#4a4a52', '#2e4a5a', '#6a6058'], ['#d8d4cc', '#8a7a6a', '#c8c4bc'],
                   ['#2e2a28', '#3a3632'], ['fur', 'fur', 'vest', 'coat'], ['fur', 'hood', 'long', 'short']),
    'saltreach': (['#d8d0b8', '#2a4e6a', '#e2e6e8', '#2f8f88', '#c8b890', '#3a5a7a'], ['#2a3e6a', '#e2e6e8', '#8a3a26'],
                  ['#3a3e4a', '#4a4a52'], ['stripes', 'apron', 'sash', 'vest'], ['kerchief', 'short', 'cap', 'long']),
    'emberwaste': (['#e0c890', '#c8a060', '#a8482a', '#d8c8a0', '#b0402a', '#8a6a4a'], ['#b0402a', '#e0b040', '#2a5a7a'],
                   ['#8a6a4a', '#6a4a3a'], ['sash', 'sash', 'vest', 'none'], ['wrap', 'wrap', 'kerchief', 'short']),
    'blackfen': (['#4a4a2a', '#3a3a2a', '#5a4632', '#4a5a2a', '#5a4a5a', '#3e4a34'], ['#5a4632', '#8a7a4a', '#6a6a3a'],
                 ['#2e2a24', '#24221e'], ['shawl', 'vest', 'apron', 'coat'], ['hood', 'hood', 'kerchief', 'long']),
}


def looks():
    out = {}
    for region in REGIONS:
        tun, ovr, leg, oks, hks = PAL[region]
        rnd = random.Random(f'folk-{region}')
        for n in range(PER_REGION):
            ok, hk = rnd.choice(oks), rnd.choice(hks)
            lk = 'skirt' if n % 2 else 'breeches'
            sk = rnd.choice([0, 1, 2, 3] if region in ('emberwaste', 'saltreach') else [0, 0, 1, 1, 2])
            h = rnd.choice(ovr) if hk in ('cap', 'kerchief', 'hood', 'wrap', 'fur') else None
            out[f'{region}_{n}'] = N.S(tun[n % len(tun)], rnd.choice(ovr), rnd.choice(leg), h, ok, hk, lk, sk=sk,
                                      hair=rnd.randrange(7), beard=(n % 2 == 0 and rnd.random() < 0.4), cuffs=rnd.random() < 0.3)
    return out


def handed(im):
    """Everyone carries something on one side: a pouch on the right hip and the right sleeve rolled up. The tell flips it."""
    px = im.load()
    skin = px[9, 13]                                                                # a cheek pixel
    leather = (92, 62, 40, 255)
    for (x, y) in ((25, 28), (26, 28), (25, 29), (26, 29), (26, 30)):               # pouch, front of the body, right hip
        px[x, y] = leather if (x, y) != (26, 30) else (64, 42, 28, 255)
    for x in range(40, 56):                                                         # right arm (40,16 box): sleeve rolled to the elbow
        for y in range(16 + 4 + 6, 16 + 4 + 9):
            if px[x, y][3]: px[x, y] = skin
        if px[x, 16 + 4 + 5][3]: px[x, 16 + 4 + 5] = tuple(int(v * 0.8) for v in px[x, 16 + 4 + 5][:3]) + (255,)   # the roll
    return im


def tell(im):
    """The same person, slightly wrong: the wrong hand, eyes that look past you, a wet hem."""
    t = im.copy()
    ra, la = im.crop((40, 16, 56, 32)), im.crop((32, 48, 48, 64))
    t.paste(la, (40, 16)); t.paste(ra, (32, 48))                                   # arms swapped
    t.paste(im.crop((20, 20, 28, 32)).transpose(Image.FLIP_LEFT_RIGHT), (20, 20))  # body front mirrored
    t.paste(im.crop((32, 20, 40, 32)).transpose(Image.FLIP_LEFT_RIGHT), (32, 20))  # and its back
    px = t.load()
    y = 12                                                                          # eye row of the face
    for a, b in ((9, 10), (13, 14)):
        pa, pb = px[a, y], px[b, y]
        if a == 9: px[a, y], px[b, y] = pb, pa                                       # left pupil to the outside
        else: px[a, y], px[b, y] = pb, pa                                            # right pupil to the outside
    for (u, v) in ((0, 16), (16, 48)):                                              # legs: the last rows wet
        for x in range(u, u + 16):
            for yy in range(v + 12, v + 16):
                r, g, b, a = px[x, yy]
                if a: px[x, yy] = (int(r * 0.62), int(g * 0.66), int(b * 0.78), a)
    return t


def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f: json.dump(data, f, indent=2); f.write('\n')


def pack(keys):
    n = len(keys)
    tex = {**{k: TEX + k for k in keys}, **{f'tell_{k}': TEX + f'tell_{k}' for k in keys}}
    write_json(os.path.join(ROOT, 'Siege_Nights_RP/entity/folk.entity.json'), {
        "format_version": "1.10.0",
        "minecraft:client_entity": {"description": {
            "identifier": "siege:folk",
            "materials": {"default": "entity_alphatest"},
            "textures": tex,
            "geometry": {"default": "geometry.humanoid.custom"},
            "scripts": {
                "pre_animation": ["variable.tcos0 = (Math.cos(query.modified_distance_moved * 38.17) * query.modified_move_speed / 1.0) * 57.3;"],
                "animate": ["humanoid_base_pose", "look_at_target_default", "move"]},
            "animations": {
                "humanoid_base_pose": "animation.humanoid.base_pose",
                "look_at_target_default": "animation.humanoid.look_at_target.default",
                "move": "animation.humanoid.move"},
            "render_controllers": ["controller.render.siege_folk"],
            "spawn_egg": {"base_color": "#7a5a3a", "overlay_color": "#cdc2a6"}}}})
    write_json(os.path.join(ROOT, 'Siege_Nights_RP/render_controllers/siege_folk.render_controllers.json'), {
        "format_version": "1.8.0",
        "render_controllers": {"controller.render.siege_folk": {
            "arrays": {"textures": {"Array.skins": [f"Texture.{k}" for k in keys] + [f"Texture.tell_{k}" for k in keys]}},
            "geometry": "Geometry.default",
            "materials": [{"*": "Material.default"}],
            "textures": [f"Array.skins[query.property('siege:skin') + (query.property('siege:tell') ? {n} : 0)]"]}}})
    write_json(os.path.join(ROOT, 'Siege_Nights_BP/entities/folk.json'), {
        "format_version": "1.21.60",
        "minecraft:entity": {
            "description": {"identifier": "siege:folk", "is_spawnable": True, "is_summonable": True, "is_experimental": False,
                            "properties": {
                                "siege:skin": {"type": "int", "range": [0, n - 1], "default": 0, "client_sync": True},
                                "siege:tell": {"type": "bool", "default": False, "client_sync": True}}},
            "components": {
                "minecraft:type_family": {"family": ["villager", "siege_folk", "mob"]},
                "minecraft:health": {"value": 20, "max": 20},
                "minecraft:collision_box": {"width": 0.6, "height": 1.8},
                "minecraft:physics": {},
                "minecraft:pushable": {"is_pushable": True, "is_pushable_by_piston": True},
                "minecraft:persistent": {},
                "minecraft:nameable": {"always_show": False, "allow_name_tag_renaming": False},
                "minecraft:breathable": {"total_supply": 15, "suffocate_time": 0},
                "minecraft:movement": {"value": 0.5},
                "minecraft:movement.basic": {},
                "minecraft:jump.static": {},
                "minecraft:navigation.walk": {"can_path_over_water": False, "avoid_water": True, "avoid_damage_blocks": True,
                                              "can_open_doors": True, "can_pass_doors": True},
                "minecraft:loot": {"table": "loot_tables/empty.json"},
                "minecraft:interact": {"interactions": [{"interact_text": "action.interact.siege.talk",
                                                         "on_interact": {"filters": {"test": "is_family", "subject": "other", "value": "player"}}}]},
                "minecraft:behavior.float": {"priority": 0},
                "minecraft:behavior.panic": {"priority": 1, "speed_multiplier": 0.6},
                "minecraft:behavior.look_at_player": {"priority": 3, "look_distance": 6, "probability": 0.04},
                "minecraft:behavior.random_stroll": {"priority": 6, "speed_multiplier": 0.5, "xz_dist": 5, "y_dist": 2, "interval": 200},
                "minecraft:behavior.random_look_around": {"priority": 8}}}})
    by_region = {r: [k for k in keys if k.startswith(r + '_')] for r in REGIONS}
    js = ('// Written by studio/art/build_folk.py: do not edit by hand. The place of a key is the siege:folk siege:skin value.\n'
          f'export const FOLK_SKINS = {json.dumps(keys)};\n'
          f'export const FOLK_BY_REGION = {json.dumps({r: [keys.index(k) for k in v] for r, v in by_region.items()})};\n')
    path = os.path.join(ROOT, 'Siege_Nights_BP/scripts/folk/skins_data.js')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'w').write(js)


if __name__ == '__main__':
    L = looks()
    keys = list(L)
    N.LOOKS.update(L)
    os.makedirs(OUT, exist_ok=True)
    sheet = Image.new('RGBA', (PER_REGION * 2 * 110, len(REGIONS) * 210), (58, 58, 64, 255))
    for n, k in enumerate(keys):
        im = handed(N.person(k, 500 + n).im)
        im.save(OUT + f'{k}.png')
        t = tell(im)
        t.save(OUT + f'tell_{k}.png')
        r, c = divmod(n, PER_REGION)
        for j, x in enumerate((im, t)):
            fv = front_view(x)
            sheet.paste(fv, ((c * 2 + j) * 110 + 7, r * 210 + 9), fv)
    pack(keys)
    if len(sys.argv) > 1: sheet.save(sys.argv[1])
    print(f'{len(keys)} folk skins (and their tells) done')
