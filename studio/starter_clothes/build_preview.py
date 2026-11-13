"""Builds the starter clothes 3D preview (one self-contained HTML file), on the regional armour preview's page.

  python3 studio/art/build_starter_clothes.py && python3 tools/build_player_joints.py    # first
  python3 studio/starter_clothes/build_preview.py OUT.html [--local-three path/to/three.min.js]
"""
import base64, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE)) + '/'
RP = ROOT + 'Siege_Nights_RP/'
out = sys.argv[1] if len(sys.argv) > 1 else 'starter-clothes.html'

def uri(path): return 'data:image/png;base64,' + base64.b64encode(open(path, 'rb').read()).decode()
def geo(path): return json.load(open(path))['minecraft:geometry'][0]

REG = ['vale', 'frostmarch', 'saltreach', 'emberwaste', 'blackfen']
PIECES = ['helmet', 'chestplate', 'leggings', 'boots']
names = {}
for line in open(RP + 'texts/en_US.lang', encoding='utf-8'):
    if line.startswith('item.siege:') and '=' in line:
        k, v = line.strip().split('=', 1); names[k[len('item.siege:'):-len('.name')]] = v
sets, icons = {}, {}
for r in REG:
    for p in PIECES:
        k = f'starter_{r}_{p}'
        sets[k] = {"geo": geo(RP + f'models/entity/armor/{k}.geo.json'), "tex": uri(RP + f'textures/models/siege_armor/{k}.png')}
        icons[k] = uri(RP + f'textures/items/siege_{k}.png')
NOTES = {
    'vale': 'Farmhand. Straw hat, linen shirt under a red jerkin with a brass buckle, brown breeches and wool stockings, field shoes.',
    'frostmarch': 'Trapper. Wool hood with fur round the face and a fur ruff, quilted coat with a fur mantle and bone toggles, wool trousers with cross-gartered wrappings, fur boots.',
    'saltreach': "Deckhand. Teal knit cap, striped smock with a red neckerchief and rope belt, canvas trousers rolled up the shin, rope sandals.",
    'emberwaste': 'Caravaneer. Sun wrap with an eye slit, a mouth veil and a neck cloth, long sand tunic with a rust sash and skirts, loose trousers wrapped at the ankle, wrapped sandals.',
    'blackfen': 'Fen-walker. Oilskin hat with a wide brim and neck flap, long oilskin coat with a moss collar and bone toggles, patched trousers, thigh waders.',
}
def weapon(r):
    k = f'starter_{r}_weapon'
    return f'<br><img src="{uri(RP + f"textures/items/siege_{k}.png")}" style="width:48px;height:48px;image-rendering:pixelated;vertical-align:middle"> Starter weapon: <b>{names.get(k, k)}</b>'
payload = {
    "regions": REG, "body": geo(RP + 'models/entity/hc_jointed.geo.json'), "skin": uri(RP + 'textures/entity/looks/bram_meadows.png'),
    "sets": sets, "icons": icons, "names": {k: names.get(k, k) for k in sets},
    "regionNames": {'vale': 'Aldmere Vale', 'frostmarch': 'Frostmarch', 'saltreach': 'Saltreach', 'emberwaste': 'Emberwaste', 'blackfen': 'Blackfen'},
    "regionNotes": {r: NOTES[r] + weapon(r) for r in REG},
    "matNames": {'starter': 'Starter clothes'},
    "matNotes": {'starter': 'What a new player is dressed in when they land in their region (Kingsrest starts get the Vale set), with the region\'s working tool as a weapon. Leather-weak: protection 1/3/2/1, leather durability; the weapon hits like a wooden sword and lasts like a stone one. Pick one region to see its weapon.'},
}
tpl = open(ROOT + 'studio/regional_armor/template.html').read()
tpl = tpl.replace('mat: "iron"', 'mat: "starter"').replace('Regional player armour', 'Starter clothes')
html = tpl.replace('__DATA__', json.dumps(payload, separators=(',', ':')))
if '--local-three' in sys.argv:
    p = sys.argv[sys.argv.index('--local-three') + 1]
    html = html.replace('<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>', '<script>' + open(p).read() + '</script>')
    html = '<meta charset="utf-8">' + html
open(out, 'w').write(html); print(out, len(html) // 1024, 'KB')
