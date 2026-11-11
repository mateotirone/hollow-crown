"""Two-layer icons for dyeable items (playtest 2026-11-11: all 64 dyeable Castle Guard pieces showed as blank slots).
A dyeable custom item's minecraft:icon needs a "dyed" texture next to "default". For each item with minecraft:dyeable this
writes <icon>_dyed.png: only the cloth pixels (the red tabard painted in the default dye colour), turned to light grey so
the game tints them with the dye. The default icon stays as painted. Then it points the item at both textures.
    python3 build_dyed_icons.py [repo root]      (re-run safe)
"""
import colorsys, glob, json, os, sys
from PIL import Image

ROOT = (sys.argv[1] if len(sys.argv) > 1 else '/mnt/project-files/siege-nights').rstrip('/') + '/'
BP, RP = ROOT + 'Siege_Nights_BP/', ROOT + 'Siege_Nights_RP/'


def is_cloth(c):
    h, l, s = colorsys.rgb_to_hls(*(v / 255 for v in c[:3]))
    return c[3] > 0 and s > 0.40 and (h < 0.03 or h > 0.93) and l > 0.12


def main():
    it_path = RP + 'textures/item_texture.json'; it = json.load(open(it_path)); data = it['texture_data']
    n = 0
    for f in sorted(glob.glob(BP + 'items/**/*.json', recursive=True)):
        d = json.load(open(f)); comp = d['minecraft:item']['components']
        if 'minecraft:dyeable' not in comp: continue
        icon = comp['minecraft:icon']
        key = icon if isinstance(icon, str) else icon['textures']['default']
        path = data[key]['textures']; path = path[0] if isinstance(path, list) else path
        src = Image.open(RP + path + '.png').convert('RGBA'); px = src.load()
        out = Image.new('RGBA', src.size); o = out.load()
        cloth = [(x, y) for y in range(src.height) for x in range(src.width) if is_cloth(px[x, y])]
        if cloth:
            ls = [colorsys.rgb_to_hls(*(v / 255 for v in px[q][:3]))[1] for q in cloth]; top = max(ls)
            for (x, y), l in zip(cloth, ls):                                  # keep the folds: brightest cloth pixel = near white
                g = int(255 * min(1, 0.55 + 0.45 * l / top)); o[x, y] = (g, g, g, 255)
        out.save(RP + path + '_dyed.png')
        data[key + '_dyed'] = {'textures': path + '_dyed'}
        comp['minecraft:icon'] = {'textures': {'default': key, 'dyed': key + '_dyed'}}
        json.dump(d, open(f, 'w'), indent=2); open(f, 'a').write('\n')
        n += 1
    json.dump(it, open(it_path, 'w'), indent=1); open(it_path, 'a').write('\n')
    print('dyeable icons', n)


main()
