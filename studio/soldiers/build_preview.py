"""Builds the soldiers' 3D preview page (one self-contained HTML file).

  python3 studio/art/build_soldiers.py        # first: models, skins, animations, studio/soldiers/data.json
  python3 studio/soldiers/build_preview.py OUT.html [--local-three path/to/three.min.js]

The page shows every type in every region, banner colour and armour tier, and plays the real animations from
Siege_Nights_RP/animations (a small Molang reader in the page). --local-three swaps the cdnjs script for a local
copy, for testing where cdnjs is blocked.
"""
import base64, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE)) + '/'
RP = ROOT + 'Siege_Nights_RP/'
out = sys.argv[1] if len(sys.argv) > 1 else 'soldiers.html'

def uri(path):
    return 'data:image/png;base64,' + base64.b64encode(open(path, 'rb').read()).decode()

data = json.load(open(HERE + '/data.json'))
skins = {k: [uri(RP + f'textures/entity/soldiers/{k}/{rg}_{c}.png') for rg in data['regions'] for c in data['colors']] for k in data['types']}
anims = {}
for f in ('guards.animation.json', 'soldiers.animation.json'):
    anims.update(json.load(open(RP + 'animations/' + f))['animations'])
armor = {t: [json.load(open(RP + f'models/entity/guard_armor/tier{t}_{p}.geo.json'))['minecraft:geometry'][0]
             for p in ('leggings', 'boots', 'chestplate', 'helmet')] for t in range(1, 5)}
armor_tex = {t: uri(RP + f'textures/models/siege_guard_armor/tier{t}.png') for t in range(1, 5)}
horse = json.load(open(ROOT + 'studio/vmobs/geo_horse_v2.json'))['geometry.horse.v2']
horse['texturewidth'] = horse['textureheight'] = 64
horse_tex = [uri(RP + f'textures/entity/siege/steed_{rg}.png') for rg in data['regions']]
ent = {k: json.load(open(RP + f'entity/{k}.entity.json'))['minecraft:client_entity']['description'] for k in data['types']}
payload = {
    "types": data['types'], "colors": data['colors'], "regions": data['regions'], "skins": skins, "anims": anims,
    "armor": armor, "armorTex": armor_tex, "horse": {"geo": horse, "tex": horse_tex},
    "pre": ent['pikeman']['scripts']['pre_animation'],
    "animate": {k: e['scripts']['animate'] for k, e in ent.items()},
    "common": {k: v for k, v in ent['pikeman']['animations'].items() if k.startswith('hc_') or k.startswith('humanoid') or k in ('holding', 'look_at_target_default')},
}
for k, e in ent.items():
    payload['types'][k]['anims'] = e['animations']

# Stand-ins for what Minecraft adds on its own in game, so the preview matches what players see:
#  * held vanilla items (sword, bow, crossbow) as simple shapes on the rightItem bone
#  * the vanilla poses those items use. "reset" bones start from zero like vanilla's "- this".
HELD = {
    'man_at_arms': [([-6.5, 12, -3.5], [1, 1, 3], [64, 60]), ([-8, 11.5, -4.5], [4, 2, 1], [72, 60]), ([-6.5, 12, -14.5], [1, 1, 10], [80, 60])],
    'archer': [([-6.5, 11.5, -1], [1, 3, 1], [64, 60]), ([-6.5, 12, -8], [1, 1, 7], [64, 60]), ([-6.5, 12, 1], [1, 1, 7], [64, 60]),
               ([-6.5, 13, -8], [1, 1, 1], [72, 60]), ([-6.5, 13, 7], [1, 1, 1], [72, 60])],
    'crossbowman': [([-6.5, 3, -0.5], [1, 11, 1], [64, 60]), ([-12.5, 3, -0.5], [13, 1, 1], [80, 60]), ([-7, 1, -0.5], [2, 2, 1], [72, 60])],
}
for k, cubes in HELD.items():
    for b in payload['types'][k]['geo']['bones']:
        if b['name'] == 'rightItem':
            b['cubes'] = [{"origin": o, "size": sz, "uv": [0, 0], "proxy": col} for o, sz, col in cubes]
anims['animation.humanoid.holding'] = {"loop": True, "bones": {"rightArm": {"rotation": [-18, 0, 0]}}}
anims['animation.humanoid.bow_and_arrow'] = {"loop": True, "reset": ["rightArm", "leftArm"], "bones": {
    "rightArm": {"rotation": [-90, -5.73, 0]}, "leftArm": {"rotation": [-90, 28.65, 0]}}}
payload['common']['holding'] = 'animation.humanoid.holding'
html = open(HERE + '/template.html').read().replace('__DATA__', json.dumps(payload, separators=(',', ':')))
if '--local-three' in sys.argv:
    p = sys.argv[sys.argv.index('--local-three') + 1]
    html = html.replace('<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>',
                        '<script>' + open(p).read() + '</script>')
    html = '<meta charset="utf-8">' + html
open(out, 'w').write(html)
print('wrote', out, f'{len(html) / 1e6:.1f} MB')
