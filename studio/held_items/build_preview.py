"""Builds the held-items 3D preview (one self-contained HTML file).

  python3 tools/build_player_joints.py && python3 tools/build_player_anims.py    # first
  python3 studio/held_items/build_preview.py OUT.html [--local-three path/to/three.min.js]

Shows a player (the jointed Looking Glass body) holding items in either hand, posed by the real
player action animations (animations/player_actions.animation.json, evaluated in the page).
Held items hang on rightItem/leftItem exactly as the geometry file says, so the page shows the
bone path the game uses. Item placement in the hand is an approximation of vanilla's.
"""
import base64, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE)) + '/'
RP = ROOT + 'Siege_Nights_RP/'
out = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else 'held-items.html'

def uri(path): return 'data:image/png;base64,' + base64.b64encode(open(path, 'rb').read()).decode()
def geo(path): return json.load(open(path))['minecraft:geometry'][0]

names = {}
for line in open(RP + 'texts/en_US.lang', encoding='utf-8'):
    if line.startswith('item.siege:') and '=' in line:
        k, v = line.strip().split('=', 1); names[k[len('item.siege:'):-len('.name')]] = v

# id, kind, icon path (None = painted in the page)
ITEMS = [
    ('longsword', 'blade', 'textures/items/siege_longsword.png'),
    ('oath_of_oswin', 'blade', 'textures/items/bestiary/oath_of_oswin.png'),
    ('warlords_brand', 'blade', 'textures/items/bestiary/warlords_brand.png'),
    ('minute_hand', 'blade', 'textures/items/bestiary/minute_hand.png'),
    ('choirsteel_sword', 'blade', 'textures/items/siege_choirsteel_sword.png'),
    ('warhammer', 'heavy', 'textures/items/siege_warhammer.png'),
    ('choirsteel_axe', 'heavy', 'textures/items/siege_choirsteel_axe.png'),
    ('rimefang_bow', 'bow', 'textures/items/bestiary/rimefang_bow.png'),
    ('almanac', 'book', 'textures/items/siege_almanac.png'),
    ('kings_journal', 'book', 'textures/items/siege_kings_journal.png'),
    ('lore_tome', 'book', 'textures/items/siege_lore_tome.png'),
    ('vault_key', 'flat', 'textures/items/vault/vault_key.png'),
    ('hollow_crown', 'flat', 'textures/items/siege_hollow_crown.png'),
    ('torch', 'light', None),
    ('seneschal_greatshield', 'shield', 'textures/items/bestiary/seneschal_greatshield.png'),
    ('shield', 'shield', None),
]
EXTRA_NAMES = {'torch': 'Torch', 'shield': 'Shield'}
items = []
for k, kind, p in ITEMS:
    items.append({"id": k, "kind": kind, "name": EXTRA_NAMES.get(k) or names.get(k, k), "icon": uri(RP + p) if p else None})

LOOKS = ['moss_sedgewick', 'ulric_thistlewood', 'ridley_icehewer', 'merle_spindrift', 'farron_sandys',
         'hawise_barleycorn', 'bram_meadows', 'ridley_stagg']
anims = json.load(open(RP + 'animations/player_actions.animation.json'))['animations']
payload = {
    "body": geo(RP + 'models/entity/hc_jointed.geo.json'),
    "looks": {k: uri(RP + f'textures/entity/looks/{k}.png') for k in LOOKS},
    "lookNames": {k: k.replace('_', ' ').title() for k in LOOKS},
    "items": items,
    "greatshield": {"geo": geo(RP + 'models/entity/siege_greatshield.geo.json'), "tex": uri(RP + 'textures/models/siege_greatshield.png')},
    "anims": {k.replace('animation.hc.player.', ''): v['bones'] for k, v in anims.items() if '.fp.' not in k},
}
html = open(HERE + '/template.html').read().replace('__DATA__', json.dumps(payload, separators=(',', ':')))
if '--local-three' in sys.argv:
    p = sys.argv[sys.argv.index('--local-three') + 1]
    html = html.replace('<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>', '<script>' + open(p).read() + '</script>')
    html = '<meta charset="utf-8">' + html
open(out, 'w').write(html); print(out, len(html) // 1024, 'KB')
