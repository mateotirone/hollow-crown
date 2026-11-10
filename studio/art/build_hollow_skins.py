"""Skins for the last unpainted entity models (2026-11-10 audit): the Choir's Conductor and Singer, the NPC ruler of the
Hollow, the Latticewood Boat, the Throne Seal and the resting Heart of the Hollow. Painted straight from each box-UV geo
with skinlib, so rerun after any model change.   python3 build_hollow_skins.py
Palette: Mateo's Hollow reference (violet stone, magenta veins, pale blue light)."""
import json, os, sys, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
import skinlib
from geoskin import faces
RP = '/mnt/project-files/siege-nights/Siege_Nights_RP/'
VEIN = (216, 96, 190); BLUE = (170, 200, 240); DARK = (10, 6, 14)

def paint(geo, out, pal, mats, extra=None):
    """mats: {(bone, cube index): material or (material, face style)}; extra(im, bone, i, facerects) adds details."""
    g = json.load(open(RP + geo))['minecraft:geometry'][0]; W, H = g['description']['texture_width'], g['description']['texture_height']
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); todo = []
    for b in g['bones']:
        for i, c in enumerate(b.get('cubes', [])):
            m = mats.get((b['name'], i), mats.get(b['name'], 'main')); face = None
            if isinstance(m, tuple): m, face = m
            fr = faces(c)
            for f, (x0, y0, w, h) in fr.items():
                for y in range(h):
                    for x in range(w):
                        if 0 <= x0 + x < W and 0 <= y0 + y < H: im.putpixel((x0 + x, y0 + y), skinlib.paint(None, pal, m, face, f, x, y, w, h))
            todo.append((b['name'], i, fr))
    for nm, i, fr in todo:
        if extra: extra(im, nm, i, fr)
    im.save(RP + out); return im

def veins(im, rect, seed, col=VEIN, n=3, down=True):
    x0, y0, w, h = rect; r = random.Random(seed)
    for _ in range(n):
        x = r.randrange(w); y = h - 1 if down else 0
        for _ in range(r.randrange(max(2, h // 3), max(3, h * 2 // 3))):
            if 0 <= x < w and 0 <= y < h and x0 + x < im.width and y0 + y < im.height: im.putpixel((x0 + x, y0 + y), col + (255,))
            y += -1 if down else 1; x += r.choice((-1, 0, 0, 1))
def P_(c, style='cloth'): return {'c': c, 'style': style}

def choir():
    pal = dict(main=P_((196, 190, 204)), under=P_((120, 110, 140)), skin=P_((214, 208, 216), 'plain'), ring=P_((84, 60, 110), 'stone'), baton=P_((230, 224, 236), 'bone'), eye=DARK)
    def conductor(im, nm, i, fr):
        if nm == 'robe': veins(im, fr['north'], 11 + i, (150, 120, 180), 4); veins(im, fr['south'], 21 + i, (150, 120, 180), 4)
        if nm == 'head' and i == 0:                       # faceless: only the suggestion of where a face was
            x0, y0, w, h = fr['north']
            for x in range(2, w - 2): im.putpixel((x0 + x, y0 + 3), (186, 178, 194, 255))
            for y in range(4, 7): im.putpixel((x0 + w // 2, y0 + y), (190, 182, 198, 255))
        if nm == 'head' and i == 1:
            for f in ('north', 'south', 'east', 'west'):
                x0, y0, w, h = fr[f]
                for x in range(1, w, 3): im.putpixel((x0 + x, y0), BLUE + (255,))
    paint('models/entity/undertow/choir_conductor.geo.json', 'textures/entity/siege/undertow/choir_conductor.png', pal,
          {('robe', 0): 'main', ('robe', 1): 'main', ('head', 0): 'skin', ('head', 1): 'ring', 'arm_left': 'main', ('arm_right', 0): 'main', ('arm_right', 1): 'baton'}, conductor)
    def singer(im, nm, i, fr):
        if nm == 'robe': veins(im, fr['north'], 31 + i, (160, 140, 184), 2)
        if nm == 'head' and i == 0:
            x0, y0, w, h = fr['north']
            for x in (1, 4): im.putpixel((x0 + x, y0 + 2), (150, 140, 160, 255))        # closed eyes
    paint('models/entity/undertow/choir_singer.geo.json', 'textures/entity/siege/undertow/choir_singer.png',
          dict(main=P_((206, 200, 210)), skin=P_((220, 214, 222), 'plain'), mouth=P_((16, 10, 20), 'plain')), {'robe': 'main', ('head', 0): 'skin', ('head', 1): 'mouth'}, singer)

def regent():
    pal = dict(main=P_((52, 34, 74)), skin=P_((176, 168, 180), 'plain'), crown=P_((60, 44, 84), 'stone'), eye=BLUE)
    def ex(im, nm, i, fr):
        if nm == 'robe':
            for f in ('north', 'south'): veins(im, fr[f], 41 + i + len(f), VEIN, 3)
            if i == 1:
                x0, y0, w, h = fr['north']
                for y in range(h): im.putpixel((x0 + w // 2, y0 + y), (88, 62, 120, 255))        # robe seam
                im.putpixel((x0 + w // 2, y0 + 1), BLUE + (255,))                                # clasp
        if nm == 'head' and i == 1:
            for f in ('north', 'south', 'east', 'west'):
                x0, y0, w, h = fr[f]
                for x in range(0, w, 2): im.putpixel((x0 + x, y0), (92, 70, 124, 255))           # spikes
                im.putpixel((x0 + w // 2, y0 + 1), BLUE + (255,)); im.putpixel((x0 + 1, y0 + 1), VEIN + (255,))
    paint('models/entity/undertow/hollow_regent.geo.json', 'textures/entity/siege/undertow/hollow_regent.png', pal, {'robe': 'main', ('head', 0): ('skin', 'glow'), ('head', 1): 'crown'}, ex)

def boat():
    pal = dict(main=P_((60, 44, 84), 'wood'), prow=P_((74, 54, 100), 'wood'), light=P_((190, 214, 246), 'glow'))
    def ex(im, nm, i, fr):
        if nm == 'hull':
            for f in ('east', 'west', 'north', 'south', 'up'): veins(im, fr[f], 51 + i * 7 + len(f), VEIN, 3 if f != 'up' else 6, down=f != 'up')
    paint('models/entity/hollowfolk/lattice_boat.geo.json', 'textures/entity/hollowfolk/lattice_boat.png', pal, {'hull': 'main', ('prow', 0): 'prow', ('prow', 1): 'light'}, ex)

def seal():
    pal = dict(main=P_((58, 42, 80), 'stone'), stem=P_((40, 30, 58), 'stone'), cap=P_((74, 56, 100), 'stone'))
    def ex(im, nm, i, fr):
        if i == 0:
            for f in ('north', 'south', 'east', 'west'):
                x0, y0, w, h = fr[f]; veins(im, fr[f], 61 + len(f) * 3, VEIN, 3)
                for (x, y) in ((4, 3), (5, 3), (3, 4), (6, 4), (3, 5), (6, 5), (4, 6), (5, 6)): im.putpixel((x0 + x, y0 + y), BLUE + (255,))     # the ring of the seal
                im.putpixel((x0 + 4, y0 + 4), (236, 244, 255, 255)); im.putpixel((x0 + 5, y0 + 5), (120, 150, 210, 255))
        if i == 2: veins(im, fr['up'], 71, VEIN, 6, down=False)
    paint('models/entity/throne_seal.geo.json', 'textures/entity/siege_throne_seal.png', pal, {('seal', 0): 'main', ('seal', 1): 'stem', ('seal', 2): 'cap'}, ex)

def heart():
    pal = dict(main=P_((120, 40, 64), 'plain'), lobe=P_((140, 52, 76), 'plain'), stem=P_((70, 30, 50), 'plain'))
    def ex(im, nm, i, fr):
        for f in ('north', 'south', 'east', 'west', 'up'): veins(im, fr[f], 81 + i * 5 + len(f), (190, 160, 230), 2, down=f != 'up')
        if i == 0:
            x0, y0, w, h = fr['north']; im.putpixel((x0 + 2, y0 + 3), (255, 150, 120, 255)); im.putpixel((x0 + 3, y0 + 3), (255, 200, 160, 255)); im.putpixel((x0 + 3, y0 + 4), (230, 110, 100, 255))   # the ember still in it
    paint('models/entity/resting_heart.geo.json', 'textures/entity/siege_resting_heart.png', pal, {('heart', 0): 'main', ('heart', 1): 'lobe', ('heart', 2): 'stem'}, ex)

if __name__ == '__main__':
    choir(); regent(); boat(); seal(); heart(); print('painted 6 skins')
