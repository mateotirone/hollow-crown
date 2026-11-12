"""Builds the regional player armour 3D preview (one self-contained HTML file).

  python3 studio/art/build_regional_armor.py && python3 tools/build_player_joints.py    # first
  python3 studio/regional_armor/build_preview.py OUT.html [--local-three path/to/three.min.js]

Shows every material in all five regions on a player body (the jointed player model with a Looking Glass skin).
"""
import base64, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE)) + '/'
RP = ROOT + 'Siege_Nights_RP/'
sys.path.insert(0, ROOT + 'studio/art')
out = sys.argv[1] if len(sys.argv) > 1 else 'regional-armor.html'

def uri(path): return 'data:image/png;base64,' + base64.b64encode(open(path, 'rb').read()).decode()
def geo(path): return json.load(open(path))['minecraft:geometry'][0]

REG = ['vale', 'frostmarch', 'saltreach', 'emberwaste', 'blackfen']
MATS = ['iron', 'chainmail', 'diamond', 'netherite', 'choirsteel']
PIECES = ['helmet', 'chestplate', 'leggings', 'boots']
names = {}
for line in open(RP + 'texts/en_US.lang', encoding='utf-8'):
    if line.startswith('item.siege:') and '=' in line:
        k, v = line.strip().split('=', 1); names[k[len('item.siege:'):-len('.name')]] = v
sets, icons = {}, {}
for m in MATS:
    for r in REG:
        for p in PIECES:
            k = f'{m}_{r}_{p}'
            sets[k] = {"geo": geo(RP + f'models/entity/armor/{k}.geo.json'), "tex": uri(RP + f'textures/models/siege_armor/{k}.png')}
            icons[k] = uri(RP + f'textures/items/siege_{k}.png')
payload = {
    "regions": REG, "body": geo(RP + 'models/entity/hc_jointed.geo.json'), "skin": uri(RP + 'textures/entity/looks/bram_meadows.png'),
    "sets": sets, "icons": icons, "names": {k: names.get(k, k) for k in sets},
    "regionNames": {'vale': 'Aldmere Vale', 'frostmarch': 'Frostmarch', 'saltreach': 'Saltreach', 'emberwaste': 'Emberwaste', 'blackfen': 'Blackfen'},
    "regionNotes": {
        'vale': 'Plain bright iron, gold trim, a red surcoat with a gold cross. Kettle hat brim, riveted leather pauldrons, steel toe caps.',
        'frostmarch': 'Blued steel, ice-pale trim, slate-blue quilting with a star. Fur ruff and spike on the helm, fur pauldrons and boot cuffs.',
        'saltreach': 'Salt-bleached steel, sea-glass trim, a sail-canvas surcoat with an anchor. Sallet with a visor slit and tail, fin crest, scale pauldrons.',
        'emberwaste': 'Smoke-darkened, sand-burnished steel, rust-red cloth with a flame, face veil. A ridge of ember spikes, spiked pauldrons.',
        'blackfen': 'Blackened lamellar laced with fen-green, bone toggles, a peat-dark surcoat with a watching eye. Hood down the back, wide laced pauldrons.',
    },
    "matNames": {'iron': 'Iron', 'chainmail': 'Chainmail', 'diamond': 'Diamond', 'netherite': 'Netherite', 'choirsteel': 'Choirsteel'},
    "matNotes": {
        'iron': "Each region's own finish on the iron, the same finish its soldiers wear.",
        'chainmail': 'Fine one-pixel mail over the same regional cut, so it reads as thin rings, not plate.',
        'diamond': 'Diamond stays diamond-blue so you can always tell the tier. Adds knee guards and a second shoulder plate.',
        'netherite': 'Netherite black with the region\'s trim, plus a cape in the region\'s cloth.',
        'choirsteel': 'Choirsteel violet in the region\'s cut, with the cape. Keeps all of Choirsteel\'s powers.',
    },
}
html = open(HERE + '/template.html').read().replace('__DATA__', json.dumps(payload, separators=(',', ':')))
if '--local-three' in sys.argv:
    p = sys.argv[sys.argv.index('--local-three') + 1]
    html = html.replace('<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>', '<script>' + open(p).read() + '</script>')
    html = '<meta charset="utf-8">' + html
open(out, 'w').write(html); print(out, len(html) // 1024, 'KB')
