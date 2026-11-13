"""Regional player armour (Mateo 2026-11-12: "custom armor textures per region for each type of armor").

Every player armour type comes in each of the five regions' looks: iron, chainmail, diamond, netherite and
Choirsteel x Aldmere Vale, Frostmarch, Saltreach, Emberwaste and Blackfen. Same protection, durability,
enchanting and repair as the plain piece; only the look changes.

The look is built from the parts the game already has, so the regions read the same everywhere:
- the cut of each region (helm, body, arms, boots, emblem) is the regional Castle Guard set's
  (studio/art/build_regional_guard.py), and its raised 3D parts are the same as theirs (studio/art/build_armor3d.py:
  kettle brim, fur ruff, fin crest, ember spikes, fen hood; knee guards from diamond up, a cape from netherite up);
- the metal finish and trim per region are the soldiers' (studio/art/build_soldiers.py, PR #210): blued steel in
  Frostmarch, salt-bleached in Saltreach, lacquered in Emberwaste, blackened in Blackfen, plain in the Vale;
- the surcoat is the region's own colour (not the banner dye: these are the player's, not the guards');
- chainmail is fine one-pixel mail (Mateo asked for thinner mail), diamond, netherite and Choirsteel keep their
  own metal so you can always tell what a piece is made of.

How a player gets one (scripts/economy/regional_armor.js): any region's Smith reforges a piece in that region's
style and keeps its enchantments, wear and name; or at the Workshop, the piece + that region's Castle Stone
(Vale: plain Castle Stone). Diamond to netherite and netherite to Choirsteel upgrade at the smithing table and keep
the region.

    python3 studio/art/build_regional_armor.py [repo root]

Writes, for every <material>_<region>_<piece>:
  RP textures/models/siege_armor/<id>.png, models/entity/armor/<id>.geo.json, attachables/<id>.json,
     textures/items/siege_<id>.png, item_texture.json keys, en_US.lang names
  BP items/regional_armor/<id>.json, recipes/regional_armor/ (workshop + smithing)
  art/regional-player-armor.png (contact sheet)
Then run python3 tools/build_player_joints.py (elbows and knees), as for every armour builder.
"""
import json, os, re, sys, tempfile
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
ROOT = (sys.argv[1].rstrip('/') + '/') if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(HERE)) + '/'
sys.argv[1:] = [ROOT]                       # the two imported builders read the root from argv
import build_regional_guard as G            # noqa: E402  (regional cut and icons)
import build_armor3d as A                   # noqa: E402  (3D parts, packing, writing)
from palette import M, fixed, ramp          # noqa: E402

RP, BP = ROOT + 'Siege_Nights_RP/', ROOT + 'Siege_Nights_BP/'
REG = ['vale', 'frostmarch', 'saltreach', 'emberwaste', 'blackfen']
NAME = {'vale': 'Vale', 'frostmarch': 'Frostmarch', 'saltreach': 'Saltreach', 'emberwaste': 'Emberwaste', 'blackfen': 'Blackfen'}
STONE = {'vale': 'siege:castle_stone', **{r: f'siege:castle_stone_{r}' for r in REG[1:]}}
PIECES = ['helmet', 'chestplate', 'leggings', 'boots']

# ---- region finish, trim and surcoat (finish and trim are the soldiers' ramps, build_soldiers.py METAL / TRIM)
FINISH = {
    'vale': M['iron'],
    'frostmarch': fixed('#2a3242', '#4a5870', '#72849e', '#9cb0c8', '#c8d8ea', '#eef6ff'),     # blued steel
    'saltreach': fixed('#2c3434', '#4c5858', '#76807e', '#a2aca8', '#ccd4d0', '#eef2ee'),      # salt-bleached
    'emberwaste': None,                                                                         # see below
    'blackfen': fixed('#141416', '#222326', '#33353a', '#474a50', '#5e6268', '#7a7e84'),       # blackened against the damp
}
# Emberwaste: the soldiers' lacquer, mixed half and half with steel, so player iron still reads as iron and not bronze
_LACQUER = fixed('#3a2618', '#664630', '#94704c', '#bc9a6c', '#dcc296', '#f6e6c4')
FINISH['emberwaste'] = [tuple((a + b) // 2 for a, b in zip(l, st)) for l, st in zip(_LACQUER, M['steel'])]
TRIM = {
    'vale': M['gold'],
    'frostmarch': fixed('#3b4a5c', '#5e7488', '#8aa4b8', '#b4cede', '#d8ecf6', '#f4fbff'),
    'saltreach': fixed('#0e4c4a', '#17706a', '#2f9a90', '#5cc4b4', '#9ce4d4', '#dcfff6'),
    'emberwaste': ramp('#c06a2a', 0.12, 0.72),
    'blackfen': fixed('#2a2c1a', '#44482a', '#686c3e', '#8c9258', '#b2b67a', '#d6d8a4'),
}
SURCOAT = {
    'vale': M['blood_red'],                              # the Vale's red, gold cross
    'frostmarch': ramp('#3e4c5e', 0.09, 0.55),           # slate-blue wool, ice star
    'saltreach': ramp('#d6ccb0', 0.30, 0.90, sat=0.7),   # sail canvas, sea-glass anchor
    'emberwaste': ramp('#9a3a24', 0.10, 0.60),           # rust-red cloth, ember flame
    'blackfen': ramp('#3e4a32', 0.08, 0.50),             # peat-dark olive, bone-green eye
}

# ---- materials: the metal ramp, and the tier whose extra 3D parts it gets (knee guards from diamond, cape from netherite)
CHOIR = fixed('#120a22', '#22123f', '#3a1f6a', '#552f94', '#7446b8', '#9a72d6')   # studio/art/build_choirsteel.py
MATS = {
    'iron':       dict(name='Iron', tier='', metal=None),            # None: the region's finish
    'chainmail':  dict(name='Chainmail', tier='', metal=None, mail=True),
    'diamond':    dict(name='Diamond', tier='diamond', metal=M['diamond']),
    'netherite':  dict(name='Netherite', tier='netherite', metal=M['netherite']),
    'choirsteel': dict(name='Choirsteel', tier='netherite', metal=CHOIR),
}
def metal(mat, reg): return MATS[mat]['metal'] or FINISH[reg]
def trim_of(mat, reg):
    if reg == 'emberwaste' and mat in ('netherite', 'choirsteel'): return M['gold']   # dark on dark wants a gold edge
    return TRIM[reg]

# ---- stats: the same as the plain piece (vanilla numbers; Choirsteel from items/bestiary/choirsteel_*.json)
STATS = {
    'iron':       dict(prot=(2, 6, 5, 2), dur=(165, 240, 225, 195), ench=9, repair='minecraft:iron_ingot'),
    'chainmail':  dict(prot=(1, 5, 4, 1), dur=(165, 240, 225, 195), ench=12, repair='minecraft:iron_ingot'),
    'diamond':    dict(prot=(3, 8, 6, 3), dur=(363, 528, 495, 429), ench=10, repair='minecraft:diamond'),
    'netherite':  dict(prot=(3, 8, 6, 3), dur=(407, 592, 555, 481), ench=15, repair='minecraft:netherite_ingot', fire=True),
    'choirsteel': dict(prot=(3, 8, 6, 3), dur=(610, 890, 830, 720), ench=22, repair='siege:choirsteel_ingot', fire=True,
                       tags=['siege:choirsteel'], noglint=True),
}
SLOT = {'helmet': ('slot.armor.head', 'armor_head'), 'chestplate': ('slot.armor.chest', 'armor_torso'),
        'leggings': ('slot.armor.legs', 'armor_legs'), 'boots': ('slot.armor.feet', 'armor_feet')}
PIECE_NAME = {'helmet': 'Helmet', 'chestplate': 'Chestplate', 'leggings': 'Leggings', 'boots': 'Boots'}
CHOIR_NAME = {'helmet': 'Helm', 'chestplate': 'Cuirass', 'leggings': 'Greaves', 'boots': 'Treads'}
def base_id(mat, piece): return f'siege:choirsteel_{piece}' if mat == 'choirsteel' else f'minecraft:{mat}_{piece}'
def rid(mat, reg, piece): return f'{mat}_{reg}_{piece}'
def display(mat, reg, piece):
    return f"{NAME[reg]} {MATS[mat]['name']} {(CHOIR_NAME if mat == 'choirsteel' else PIECE_NAME)[piece]}"


# ---- flat sheets: the regional cut, re-coloured for one material
def mail_tone(x, y, t):
    """Fine mail: one-pixel rings in staggered rows, a step either side of the painted tone (t), so it reads as
    thin rings over the shading instead of a chequerboard."""
    t = max(1, min(4, t))
    return t + (1 if (x + y) % 2 == 0 else (-1 if y % 2 == 0 else 0))


def recolour(im, reg, mat, src):
    met0, trim0, _ = src
    met, trim, cloth = metal(mat, reg), trim_of(mat, reg), SURCOAT[reg]
    look_met = {tuple(c): i for i, c in enumerate(met0)}
    look_trim = {tuple(c): i for i, c in enumerate(trim0)}
    look_wool = {tuple(c): i for i, c in enumerate(G.WOOL)}      # Frostmarch's quilting takes the metal too
    look_cloth = {tuple(c): i for i, c in enumerate(G.CLOTH)}
    out = im.copy(); px = out.load()
    for y in range(out.size[1]):
        for x in range(out.size[0]):
            c = px[x, y]
            if not c[3]: continue
            rgb = c[:3]
            if c[3] == 255 and rgb in look_cloth:                 # banner cloth on the guards: the region's surcoat here
                px[x, y] = tuple(cloth[look_cloth[rgb]]) + (255,); continue
            if rgb in look_met or rgb in look_wool:
                t = look_met[rgb] if rgb in look_met else max(0, look_wool[rgb] - 1)
                if MATS[mat].get('mail'): t = mail_tone(x, y, t)
                px[x, y] = tuple(met[t]) + (255,); continue
            if rgb in look_trim:
                px[x, y] = tuple(trim[look_trim[rgb]]) + (255,); continue
            px[x, y] = rgb + (255,)                               # leather, fur, rope, bone: as painted
    return out


# ---- icons: the regional guard icon's shape, re-coloured the same way
def icon(reg, mat, piece, src):
    met, trim = metal(mat, reg), trim_of(mat, reg)
    ic = G.icon(reg, piece, (met, trim, src[2]))
    px = ic.load()
    import colorsys
    look_met = {tuple(c) for c in met}
    for y in range(16):
        for x in range(16):
            c = px[x, y]
            if not c[3]: continue
            h, l, s = colorsys.rgb_to_hls(*(v / 255 for v in c[:3]))
            if s > 0.45 and (h < 0.03 or h > 0.93):                  # the guard's red cloth: the region's surcoat
                px[x, y] = tuple(SURCOAT[reg][max(1, min(5, int(l * 6.4)))]) + (255,)
            elif MATS[mat].get('mail') and c[:3] in look_met and (x + y) % 2:
                i = [tuple(v) for v in met].index(c[:3]); px[x, y] = tuple(met[max(0, i - 2)]) + (255,)
    return ic


# ---- 3D: the guard set's raised parts in this material, painted without the banner trick
def parts_for(reg, mat):
    met, trim = metal(mat, reg), trim_of(mat, reg)
    tier = MATS[mat]['tier']
    keep = (A.RAMPS[reg], A.DIAMOND, A.NETHERITE, A.CLOTH)
    A.RAMPS[reg] = (met, trim, A.RAMPS[reg][2])
    A.DIAMOND = A.NETHERITE = met
    A.CLOTH = SURCOAT[reg]
    try:
        parts, styles = A.guard_parts(reg, tier)
    finally:
        A.RAMPS[reg], A.DIAMOND, A.NETHERITE, _ = keep
    for st in styles.values():
        if MATS[mat].get('mail') and st.ramp is met:
            st.pat = lambda f, x, y, w, h: 1 if f == 'down' else mail_tone(x, y, 3 + (y == 0) - (y == h - 1))
    return parts, styles


def write(path, data, indent=2):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f: json.dump(data, f, indent=indent); f.write('\n')


def item_json(mat, reg, piece):
    st, i = STATS[mat], PIECES.index(piece)
    ident = 'siege:' + rid(mat, reg, piece)
    comp = {
        "minecraft:icon": 'siege_' + rid(mat, reg, piece),
        "minecraft:display_name": {"value": f"item.{ident}.name"},
        "minecraft:max_stack_size": 1,
        "minecraft:wearable": {"slot": SLOT[piece][0], "protection": st['prot'][i]},
        "minecraft:durability": {"max_durability": st['dur'][i]},
        "minecraft:repairable": {"repair_items": [{"items": [st['repair']], "repair_amount": "q.max_durability * 0.25"}]},
        "minecraft:enchantable": {"slot": SLOT[piece][1], "value": st['ench']},
        "minecraft:tags": {"tags": ["minecraft:is_armor", "minecraft:trimmable_armors", "siege:regional_armor"] + st.get('tags', [])},
    }
    if st.get('fire'): comp["minecraft:fire_resistant"] = {}
    if st.get('noglint'): comp["minecraft:glint"] = False
    return {"format_version": "1.21.60", "minecraft:item": {
        "description": {"identifier": ident, "menu_category": {"category": "equipment", "group": f"minecraft:itemGroup.name.{piece}"}},
        "components": comp}}


def attachable_stub(mat, reg, piece):
    return {"format_version": "1.10.0", "minecraft:attachable": {"description": {
        "identifier": 'siege:' + rid(mat, reg, piece),
        "materials": {"default": "armor", "enchanted": "armor_enchanted"},
        "textures": {"default": "", "enchanted": "textures/misc/enchanted_actor_glint"},
        "geometry": {"default": ""}, "scripts": {"parent_setup": ""},
        "render_controllers": ["controller.render.armor"]}}}


# A recipe nobody unlocks by playing (structure void can't be picked up): only /recipe give shows it in the book
REGION_LOCKED = [{"item": "minecraft:structure_void"}]


def recipes():
    out = {}
    for mat in MATS:
        for reg in REG:
            for piece in PIECES:
                ident = 'siege:' + rid(mat, reg, piece)
                out[f'workshop/{rid(mat, reg, piece)}.json'] = {"format_version": "1.20.10", "minecraft:recipe_shapeless": {
                    "description": {"identifier": f"{ident}_recipe"}, "tags": ["siege_workshop"],
                    "ingredients": [{"item": base_id(mat, piece)}, {"item": STONE[reg]}],
                    # shown in the recipe book only in the region you stand in: scripts/recipebook/ gives and takes it
                    "result": {"item": ident}, "unlock": REGION_LOCKED}}
    for reg in REG:   # upgrades keep the region: diamond -> netherite (vanilla template), netherite -> Choirsteel
        for piece in PIECES:
            for frm, to, template, addition in (('diamond', 'netherite', 'minecraft:netherite_upgrade_smithing_template', 'minecraft:netherite_ingot'),
                                                ('netherite', 'choirsteel', 'siege:choirsteel_upgrade_template', 'siege:tempered_choirsteel')):
                ident = 'siege:' + rid(to, reg, piece)
                out[f'smithing/{rid(to, reg, piece)}.json'] = {"format_version": "1.20.10", "minecraft:recipe_smithing_transform": {
                    "description": {"identifier": f"{ident}_upgrade"}, "tags": ["smithing_table"],
                    "template": template, "base": 'siege:' + rid(frm, reg, piece), "addition": addition, "result": ident}}
    return out


def update_lang(names):
    path = RP + 'texts/en_US.lang'
    lines = [l for l in open(path, encoding='utf-8').read().split('\n') if not re.match(r'item\.siege:(%s)_(%s)_' % ('|'.join(MATS), '|'.join(REG)), l)]
    while lines and lines[-1] == '': lines.pop()
    lines += ['', '## Regional player armour (studio/art/build_regional_armor.py)'] if '## Regional player armour (studio/art/build_regional_armor.py)' not in lines else []
    lines += [f'item.siege:{k}.name={v}' for k, v in names.items()]
    open(path, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')


def update_item_textures(keys):
    path = RP + 'textures/item_texture.json'
    d = json.load(open(path))
    for k in keys: d['texture_data'][k] = {"textures": f"textures/items/{k}"}
    write(path, d, indent=1)


def main():
    tmp = tempfile.mkdtemp()
    names, keys = {}, []
    sheet = Image.new('RGBA', (8 + len(REG) * 216, 8 + len(MATS) * 156), (38, 34, 46, 255))
    for reg in REG:
        l1g, l2g, src = G.build(reg)
        for m, mat in enumerate(MATS):
            l1, l2 = recolour(l1g, reg, mat, src), recolour(l2g, reg, mat, src)
            p1, p2 = f'{tmp}/{mat}_{reg}_1.png', f'{tmp}/{mat}_{reg}_2.png'
            l1.save(p1); l2.save(p2)
            for piece in PIECES:
                write(RP + f'attachables/{rid(mat, reg, piece)}.json', attachable_stub(mat, reg, piece))
            parts, styles = parts_for(reg, mat)
            A.CLOTH = SURCOAT[reg]
            A.build(f'{mat}_{reg}', parts, styles, p1, p2, PIECES, lambda p, n=f'{mat}_{reg}': f'{n}_{p}', False)
            i = REG.index(reg)
            sheet.alpha_composite(l1.resize((128, 64), Image.NEAREST), (8 + i * 216, 8 + m * 156))
            sheet.alpha_composite(l2.resize((64, 32), Image.NEAREST), (140 + i * 216, 8 + m * 156))
            for j, piece in enumerate(PIECES):
                ic = icon(reg, mat, piece, src)
                key = 'siege_' + rid(mat, reg, piece)
                ic.save(RP + f'textures/items/{key}.png'); keys.append(key)
                sheet.alpha_composite(ic.resize((48, 48), Image.NEAREST), (8 + i * 216 + j * 52, 80 + m * 156))
                write(BP + f'items/regional_armor/{rid(mat, reg, piece)}.json', item_json(mat, reg, piece))
                names[rid(mat, reg, piece)] = display(mat, reg, piece)
    A.CLOTH = M['cloth']
    for rel, data in recipes().items(): write(BP + f'recipes/regional_armor/{rel}', data)
    update_lang(names)
    update_item_textures(keys)
    os.makedirs(ROOT + 'art', exist_ok=True)
    sheet.save(ROOT + 'art/regional-player-armor.png')
    print(f'{len(names)} pieces ({len(MATS)} materials x {len(REG)} regions x 4). Now run: python3 tools/build_player_joints.py')


if __name__ == '__main__':
    main()
