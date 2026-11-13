"""Diamond and netherite tiers of the regional Castle Guard armour (Mateo 2026-11-11). Writes the item, attachable
and Siege Workshop recipe files and adds lang and icon lines. The pictures come from studio/art/build_regional_guard.py.

    python3 studio/build_regional_guard_tiers.py [repo root]

Ids: siege:guard_<region>_<tier>_<piece>. The iron tier is the original siege:guard_<region>_<piece>.
Recipes: iron piece + diamonds -> diamond piece; diamond piece + netherite ingot + the region's boss material -> netherite.
"""
import json, os, sys

ROOT = (sys.argv[1].rstrip('/') + '/') if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
BP, RP = ROOT + 'Siege_Nights_BP/', ROOT + 'Siege_Nights_RP/'
REG = {'vale': 'Vale', 'frostmarch': 'Frostmarch', 'saltreach': 'Saltreach', 'emberwaste': 'Emberwaste', 'blackfen': 'Blackfen'}
# what each region's boss leaves behind, needed for the top tier
BOSS_MATERIAL = {'vale': 'siege:clockwork_cog', 'frostmarch': 'siege:pale_antler', 'saltreach': 'siege:drowned_pearl',
                 'emberwaste': 'siege:ash_glass', 'blackfen': 'siege:changeling_ichor'}
PIECES = {  # slot, enchant slot, group, vanilla protection and durability per tier, diamonds to upgrade
    'helmet':     ('slot.armor.head', 'armor_head', 'helmet', {'diamond': (3, 363), 'netherite': (3, 407)}, 3, 'Helmet'),
    'chestplate': ('slot.armor.chest', 'armor_torso', 'chestplate', {'diamond': (8, 528), 'netherite': (8, 592)}, 4, 'Chestplate'),
    'leggings':   ('slot.armor.legs', 'armor_legs', 'leggings', {'diamond': (6, 495), 'netherite': (6, 555)}, 4, 'Leggings'),
    'boots':      ('slot.armor.feet', 'armor_feet', 'boots', {'diamond': (3, 429), 'netherite': (3, 481)}, 2, 'Boots'),
}
TIERS = {'diamond': ('Diamond', 'minecraft:diamond', 10), 'netherite': ('Netherite', 'minecraft:netherite_ingot', 15)}


def write(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f: json.dump(data, f, indent=2); f.write('\n')


lang, icons = [], {}
for reg, rname in REG.items():
    for tier, (tname, repair, ench) in TIERS.items():
        for piece, (slot, eslot, group, stats, diamonds, pname) in PIECES.items():
            iid = f'guard_{reg}_{tier}_{piece}'
            prot, dur = stats[tier]
            comps = {
                'minecraft:icon': {'textures': {'default': f'siege_{iid}', 'dyed': f'siege_{iid}_dyed'}},   # dyed layer: studio/art/build_dyed_icons.py
                'minecraft:display_name': {'value': f'item.siege:{iid}.name'},
                'minecraft:max_stack_size': 1,
                'minecraft:wearable': {'slot': slot, 'protection': prot},
                'minecraft:durability': {'max_durability': dur},
                'minecraft:repairable': {'repair_items': [{'items': [repair], 'repair_amount': 'q.max_durability * 0.25'}]},
                'minecraft:enchantable': {'slot': eslot, 'value': ench},
                'minecraft:tags': {'tags': ['minecraft:is_armor', 'minecraft:trimmable_armors']},
                'minecraft:dyeable': {'default_color': '#841E22'},
            }
            if tier == 'netherite': comps['minecraft:fire_resistant'] = {}
            write(BP + f'items/regional_guard/{iid}.json', {'format_version': '1.21.60', 'minecraft:item': {
                'description': {'identifier': f'siege:{iid}', 'menu_category': {'category': 'equipment', 'group': f'minecraft:itemGroup.name.{group}'}},
                'components': comps}})
            layer = 2 if piece == 'leggings' else 1
            setup = {'helmet': 'variable.helmet_layer_visible = 0.0;', 'chestplate': 'variable.chest_layer_visible = 0.0;',
                     'leggings': 'variable.leg_layer_visible = 0.0;', 'boots': 'variable.boot_layer_visible = 0.0;'}[piece]
            write(RP + f'attachables/{iid}.json', {'format_version': '1.10.0', 'minecraft:attachable': {'description': {
                'identifier': f'siege:{iid}', 'materials': {'default': 'armor_leather', 'enchanted': 'armor_leather_enchanted'},
                'textures': {'default': f'textures/models/armor/guard_{reg}_{tier}_layer_{layer}', 'enchanted': 'textures/misc/enchanted_actor_glint'},
                'geometry': {'default': f'geometry.humanoid.armor.{piece}'}, 'scripts': {'parent_setup': setup},
                'render_controllers': ['controller.render.armor']}}})
            base = f'siege:guard_{reg}_{piece}' if tier == 'diamond' else f'siege:guard_{reg}_diamond_{piece}'
            ings = [{'item': base}] + ([{'item': 'minecraft:diamond'}] * diamonds if tier == 'diamond'
                                       else [{'item': 'minecraft:netherite_ingot'}, {'item': BOSS_MATERIAL[reg]}])
            write(BP + f'recipes/regional_guard/{iid}.json', {'format_version': '1.20.10', 'minecraft:recipe_shapeless': {
                'description': {'identifier': f'siege:{iid}_recipe'}, 'tags': ['siege_workshop'], 'ingredients': ings,
                'result': {'item': f'siege:{iid}'}, 'unlock': [{'item': 'minecraft:structure_void'}]}})  # region-locked in the book: scripts/recipebook/
            lang.append(f'item.siege:{iid}.name={rname} {tname} Guard {pname}')
            icons[f'siege_{iid}'] = {'textures': f'textures/items/siege_{iid}'}
            icons[f'siege_{iid}_dyed'] = {'textures': f'textures/items/siege_{iid}_dyed'}

# shared files: add only what is missing, at the end
p = RP + 'texts/en_US.lang'
have = open(p, encoding='utf-8').read()
new = [l for l in lang if l.split('=', 1)[0] + '=' not in have]
if new:
    with open(p, 'a', encoding='utf-8') as f: f.write(('' if have.endswith('\n') else '\n') + '\n'.join(new) + '\n')
p = RP + 'textures/item_texture.json'
d = json.load(open(p))
for k, v in icons.items(): d['texture_data'].setdefault(k, v)
with open(p, 'w') as f: json.dump(d, f, indent=1, ensure_ascii=False); f.write('\n')
print(f'{len(icons) // 2} items; now run studio/art/build_dyed_icons.py for the dyed icon layers')
