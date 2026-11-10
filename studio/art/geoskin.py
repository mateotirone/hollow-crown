"""Paint an entity skin straight from its box-UV geo, in the shared art style, so the skin can be regenerated
whenever the model changes. Used for the four dragons:  python3 geoskin.py   (repaints all four)
Each cube gets a material from its bone and shape (hide, belly, horn, membrane, saddle), then skinlib shading."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
import skinlib
RP = '/mnt/project-files/siege-nights/Siege_Nights_RP/'

def faces(c):
    (u, v), (w, h, d) = c['uv'], [max(1, int(-(-s // 1))) for s in c['size']]
    return {'up': (u + d, v, w, d), 'down': (u + d + w, v, w, d), 'east': (u, v + d, d, h), 'north': (u + d, v + d, w, h),
            'west': (u + d + w, v + d, d, h), 'south': (u + d + w + d, v + d, w, h)}

def material(bone, i, c, main):
    w, h, d = c['size']; thin = min(w, h, d) <= 1; small = w * h * d <= 0.12 * main[0] * main[1] * main[2]
    if bone == 'saddle': return 'saddle' if i == 0 else 'strap'
    if bone.startswith('wing'): return 'membrane' if thin else 'hide'
    if bone == 'body':
        if i == 0: return 'hide'
        return 'belly' if (h <= 1 and c['origin'][1] < main[3]) else 'horn'
    if bone == 'head': return 'hide' if i == 0 or not small else 'horn'
    if bone == 'tail3' and i > 0: return 'membrane' if thin else 'horn'
    return 'hide'

def paint(geo_path, out, pal, eye):
    g = json.load(open(geo_path))['minecraft:geometry'][0]
    W, H = g['description']['texture_width'], g['description']['texture_height']
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    body = next(b for b in g['bones'] if b['name'] == 'body')['cubes'][0]
    main = list(body['size']) + [body['origin'][1] + 1]
    for b in g['bones']:
        for i, c in enumerate(b.get('cubes', [])):
            if not isinstance(c.get('uv'), list): continue
            mat = material(b['name'], i, c, main if b['name'] == 'body' else list(b['cubes'][0]['size']) + [0])
            for f, (x0, y0, w, h) in faces(c).items():
                m = 'belly' if (mat == 'hide' and f == 'down' and b['name'] in ('body', 'neck', 'neck2', 'jaw', 'tail', 'tail2', 'tail3')) else mat
                for y in range(h):
                    for x in range(w):
                        if not (0 <= x0 + x < W and 0 <= y0 + y < H): continue
                        col = skinlib.paint(None, pal, m, None, f, x, y, w, h)
                        if m == 'membrane' and f in ('up', 'down') and x % 5 == 0: col = skinlib.paint(None, pal, 'hide', None, f, x, y, w, h)[:3] + (255,)   # wing fingers
                        if m == 'hide' and f == 'up' and b['name'] in ('body', 'neck', 'neck2', 'tail', 'tail2') and abs(x - (w - 1) / 2) < 1: col = skinlib.paint(None, pal, 'horn', None, f, x, y, w, h)  # dorsal ridge
                        im.putpixel((x0 + x, y0 + y), col)
            if b['name'] == 'head' and i == 0:                                   # eyes on both sides of the skull
                for f in ('east', 'west'):
                    x0, y0, w, h = faces(c)[f]; ey = y0 + max(1, h // 3)
                    ex = x0 + (max(1, w // 4) if f == 'west' else w - 2 - max(1, w // 4))
                    for dx in (0, 1): im.putpixel((ex + dx, ey), tuple(eye) + (255,)); im.putpixel((ex + dx, ey - 1), skinlib.ramp_of(pal['hide']['c'])[0] + (255,))
                    im.putpixel((ex + (1 if f == 'west' else 0), ey), (16, 10, 16, 255))
    im.save(out)

DRAGONS = {
    'cinderwing': (dict(hide={'c': (150, 52, 40), 'style': 'scale'}, belly={'c': (206, 170, 120), 'style': 'plain'}, horn={'c': (64, 46, 46), 'style': 'bone'},
                        membrane={'c': (190, 92, 52), 'style': 'plain'}, saddle={'c': (110, 72, 44), 'style': 'cloth'}, strap={'c': (70, 48, 32), 'style': 'plain'}), (255, 180, 40)),
    'wyvern': (dict(hide={'c': (124, 124, 130), 'style': 'scale'}, belly={'c': (196, 196, 190), 'style': 'plain'}, horn={'c': (72, 68, 74), 'style': 'bone'},
                    membrane={'c': (92, 88, 98), 'style': 'plain'}, saddle={'c': (110, 72, 44), 'style': 'cloth'}, strap={'c': (70, 48, 32), 'style': 'plain'}), (255, 130, 30)),
    'drake': (dict(hide={'c': (198, 160, 84), 'style': 'scale'}, belly={'c': (234, 220, 178), 'style': 'plain'}, horn={'c': (138, 102, 56), 'style': 'stone'},
                   membrane={'c': (174, 126, 70), 'style': 'plain'}, saddle={'c': (96, 60, 40), 'style': 'cloth'}, strap={'c': (60, 40, 28), 'style': 'plain'}), (40, 200, 190)),
    'wyrm': (dict(hide={'c': (46, 32, 68), 'style': 'scale'}, belly={'c': (82, 58, 116), 'style': 'plain'}, horn={'c': (124, 92, 176), 'style': 'bone'},
                  membrane={'c': (156, 96, 208, 170), 'style': 'plain'}, saddle={'c': (60, 44, 60), 'style': 'cloth'}, strap={'c': (40, 30, 44), 'style': 'plain'}), (255, 130, 210)),
}
if __name__ == '__main__':
    for k, (pal, eye) in DRAGONS.items():
        paint(RP + f'models/entity/dragons/{k}.geo.json', RP + f'textures/entity/siege/dragons/{k}.png', pal, eye); print(k, 'painted')
