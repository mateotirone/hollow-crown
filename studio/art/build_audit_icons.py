"""Icons from the 2026-11-12 item audit.
Guard tiers: the four guard-only armour tiers all used the plain Castle Guard icons. Each tier now has its own set,
retoned from the guard icon: 1 dark mail, 2 brigandine leather with studs, 3 bright half plate, 4 plate with gold trim.
Vault key: repainted with the brass ramp, an outline and a proper bow and bit, like the other keys.
    python3 build_audit_icons.py [repo root]      (re-run safe: reads only the plain guard icons)
"""
import colorsys, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from palette import M
ROOT = (sys.argv[1] if len(sys.argv) > 1 else '/mnt/project-files/siege-nights').rstrip('/') + '/'
BP, RP = ROOT + 'Siege_Nights_BP/', ROOT + 'Siege_Nights_RP/'
MAIL = [(40, 42, 50), (62, 65, 74), (86, 90, 100), (112, 116, 126), (140, 144, 152), (168, 172, 180)]
TIERS = {1: MAIL, 2: M['leather'], 3: M['steel'], 4: M['steel']}


def is_metal(c):
    h, l, s = colorsys.rgb_to_hls(*(v / 255 for v in c[:3]))
    return c[3] > 0 and s < 0.22 and l > 0.2


def guard_tiers():
    it_path = RP + 'textures/item_texture.json'; it = json.load(open(it_path)); data = it['texture_data']
    for piece in ('helmet', 'chestplate', 'leggings', 'boots'):
        src = Image.open(RP + f'textures/items/siege_guard_{piece}.png').convert('RGBA')
        for t, ramp in TIERS.items():
            im = src.copy(); px = im.load()
            for y in range(im.height):
                for x in range(im.width):
                    c = px[x, y]
                    if not is_metal(c): continue
                    l = (c[0] + c[1] + c[2]) / 765; i = min(5, int(l * 6.2))
                    if t == 1 and (x + y) % 2 and 1 < i < 5: i -= 1                 # the links of the mail
                    col = ramp[i]
                    if t == 2 and i >= 3 and x % 3 == 0 and y % 3 == 0: col = M['gold'][4]   # brigandine studs
                    if t == 4 and i >= 4: col = M['gold'][i]                        # gilded edges
                    px[x, y] = tuple(col) + (c[3],)
            key = f'siege_guardgear_{t}_{piece}'
            im.save(RP + f'textures/items/{key}.png'); data[key] = {'textures': f'textures/items/{key}'}
            f = BP + f'items/guardgear_{t}_{piece}.json'; d = json.load(open(f))
            d['minecraft:item']['components']['minecraft:icon'] = key
            json.dump(d, open(f, 'w'), indent=2); open(f, 'a').write('\n')
    json.dump(it, open(it_path, 'w'), indent=1); open(it_path, 'a').write('\n')


def vault_key():
    G = M['gold']; O = (58, 36, 14); im = Image.new('RGBA', (16, 16)); p = {}
    for y in range(1, 7):                                    # the bow: a ring, top left
        for x in range(1, 7):
            d = (x - 3.5) ** 2 + (y - 3.5) ** 2
            if 1.5 < d <= 7: p[(x, y)] = G[5 if x + y < 6 else 3 if x + y < 9 else 2]
    for k in range(6, 14): p[(k, k)] = G[3]; p[(k + 1, k)] = G[4]; p[(k, k + 1)] = G[1]      # the shaft, down to the right
    for q in ((10, 13), (10, 14), (11, 14), (12, 15), (12, 16 - 1), (13, 15)): p[q] = G[2]   # the bit
    p[(10, 14)] = G[1]; p[(14, 14)] = G[2]; p[(6, 6)] = G[2]
    for (x, y), c in p.items():
        if 0 <= x < 16 and 0 <= y < 16: im.putpixel((x, y), tuple(c) + (255,))
    for y in range(16):                                      # dark outline, as on every item
        for x in range(16):
            if (x, y) in p: continue
            if any((x + dx, y + dy) in p for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))): im.putpixel((x, y), O + (255,))
    im.putpixel((3, 3), (0, 0, 0, 0)); im.putpixel((4, 4), (0, 0, 0, 0)); im.putpixel((3, 4), (0, 0, 0, 0)); im.putpixel((4, 3), (0, 0, 0, 0))
    im.save(RP + 'textures/items/vault/vault_key.png')


guard_tiers(); vault_key(); print('ok')
