"""Dyed icons for dyeable items (the 64 Castle Guard pieces).
A dyeable custom item with a default_color never shows its "default" icon in the inventory: the game shows the "dyed"
texture instead and multiplies ALL of it by the dye colour (MCPE-237529 describes the two textures). So the dyed texture
has to be the whole piece, in greys. The first version (2026-11-11) wrote only the cloth pixels, which left boots and
leggings blank and the other pieces as a scrap of tabard.
This writes <icon>_dyed.png from the painted default icon: cloth (the red tabard) becomes near white, so it takes the
banner colour at full strength; everything else keeps its own light and dark, held below the cloth, so plate reads as
a darker shade of the same colour and the tiers stay apart (diamond lightest, netherite darkest).
    python3 build_dyed_icons.py [repo root]      (re-run safe: it reads only the default icons)
"""
import colorsys, glob, json, os, sys
from PIL import Image

ROOT = (sys.argv[1] if len(sys.argv) > 1 else '/mnt/project-files/siege-nights').rstrip('/') + '/'
BP, RP = ROOT + 'Siege_Nights_BP/', ROOT + 'Siege_Nights_RP/'
PLATE_MAX, BARE_MAX = 0.66, 0.84          # brightest non-cloth pixel, with and without cloth on the piece


def hls(c): return colorsys.rgb_to_hls(*(v / 255 for v in c[:3]))


def is_cloth(c):
    h, l, s = hls(c)
    return c[3] > 0 and s > 0.40 and (h < 0.03 or h > 0.93) and l > 0.12


def lum(c): return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255


def dyed(src):
    px = src.load(); out = Image.new('RGBA', src.size); o = out.load()
    pts = [(x, y) for y in range(src.height) for x in range(src.width) if px[x, y][3] > 0]
    cloth = [q for q in pts if is_cloth(px[q])]; top = max((hls(px[q])[1] for q in cloth), default=1)
    cap = PLATE_MAX if cloth else BARE_MAX
    for q in pts:
        if q in cloth: g = 0.74 + 0.26 * hls(px[q])[1] / top           # keep the folds, brightest fold = white
        else: g = min(cap, lum(px[q]) * cap / 0.86)
        g = int(255 * g); o[q] = (g, g, g, px[q][3])
    return out


def main():
    it_path = RP + 'textures/item_texture.json'; it = json.load(open(it_path)); data = it['texture_data']
    n = 0
    for f in sorted(glob.glob(BP + 'items/**/*.json', recursive=True)):
        d = json.load(open(f)); comp = d['minecraft:item']['components']
        if 'minecraft:dyeable' not in comp: continue
        icon = comp['minecraft:icon']
        key = icon if isinstance(icon, str) else icon['textures']['default']
        path = data[key]['textures']; path = path[0] if isinstance(path, list) else path
        dyed(Image.open(RP + path + '.png').convert('RGBA')).save(RP + path + '_dyed.png')
        if data.get(key + '_dyed') != {'textures': path + '_dyed'} or icon != {'textures': {'default': key, 'dyed': key + '_dyed'}}:
            data[key + '_dyed'] = {'textures': path + '_dyed'}
            comp['minecraft:icon'] = {'textures': {'default': key, 'dyed': key + '_dyed'}}
            json.dump(d, open(f, 'w'), indent=2); open(f, 'a').write('\n')
        n += 1
    json.dump(it, open(it_path, 'w'), indent=1); open(it_path, 'a').write('\n')
    print('dyeable icons', n)


main()
