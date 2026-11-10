"""Skins for the eight job NPCs (Farmer, Woodcutter, Quarryman, Smith, Fisher, Hunter, Herbalist, Moneyer).
64x64 in the vanilla villager / NPC layout (head 8x10x8, nose, body, long robe overlay, crossed arms, legs), so they fit
geometry.villager.v1.8 and the NPC model.   python3 build_job_npcs.py [repo root]      Sheet: art/job-npcs.png
Not wired yet: the economy thread decides how the job NPCs pick these up (they use stock NPC skins by index today)."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
import skinlib
ROOT = (sys.argv[1] if len(sys.argv) > 1 else '/mnt/project-files/siege-nights').rstrip('/') + '/'
OUT = ROOT + 'Siege_Nights_RP/textures/entity/siege/npc/'
def faces(u, v, w, h, d):
    return {'up': (u + d, v, w, d), 'down': (u + d + w, v, w, d), 'east': (u, v + d, d, h), 'north': (u + d, v + d, w, h),
            'west': (u + d + w, v + d, d, h), 'south': (u + 2 * d + w, v + d, w, h)}
PARTS = dict(head=faces(0, 0, 8, 10, 8), nose=faces(24, 0, 2, 4, 2), body=faces(16, 20, 8, 12, 6), robe=faces(0, 38, 8, 18, 6),
             arms=faces(44, 22, 4, 8, 4), armmid=faces(40, 38, 8, 4, 4), legs=faces(0, 22, 4, 12, 4))
def P_(c, style='plain'): return {'c': c, 'style': style}
SKIN = [(196, 150, 120), (176, 126, 96), (214, 170, 138), (150, 104, 78)]

def npc(name, skin, shirt, robe, legs, hat, hair, trim, emblem, hat_rows=3, brim=False, beard=False, apron=None):
    pal = dict(skin=P_(skin), shirt=P_(shirt, 'cloth'), robe=P_(robe, 'cloth'), legs=P_(legs, 'cloth'), hat=P_(hat[0], hat[1]), hair=P_(hair, 'fur'))
    im = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    def put(r, x, y, c):
        if 0 <= x < r[2] and 0 <= y < r[3]: im.putpixel((r[0] + x, r[1] + y), tuple(c[:3]) + (255,))
    def dark(r, x, y, k=0.7):
        if 0 <= x < r[2] and 0 <= y < r[3]:
            c = im.getpixel((r[0] + x, r[1] + y)); im.putpixel((r[0] + x, r[1] + y), tuple(int(v * k) for v in c[:3]) + (c[3],))
    for part, mat in (('head', 'skin'), ('nose', 'skin'), ('body', 'shirt'), ('robe', 'robe'), ('arms', 'shirt'), ('armmid', 'skin'), ('legs', 'legs')):
        for f, r in PARTS[part].items():
            for y in range(r[3]):
                for x in range(r[2]): put(r, x, y, skinlib.paint(None, pal, mat, None, f, x, y, r[2], r[3]))
    H = PARTS['head']
    for f in ('north', 'south', 'east', 'west'):                      # hat or hair round the head
        r = H[f]; rows = hat_rows + (2 if f == 'south' else 0)
        for y in range(rows):
            for x in range(r[2]):
                m = 'hat' if y < hat_rows else 'hair'
                put(r, x, y, skinlib.paint(None, pal, m, None, f, x, y, r[2], rows))
        if brim:
            for x in range(r[2]): dark(r, x, hat_rows, 0.72)          # shadow under a brim
        if f in ('east', 'west') and hair:
            for y in range(hat_rows, hat_rows + 3): put(r, 0 if f == 'east' else r[2] - 1, y, skinlib.paint(None, pal, 'hair', None, f, 0, y, 8, 10)) if False else None
    for y in range(8):
        for x in range(8): put(H['up'], x, y, skinlib.paint(None, pal, 'hat', None, 'up', x, y, 8, 8))
    n = H['north']                                                    # face
    for x in (1, 2, 5, 6): dark(n, x, hat_rows + 1, 0.62)             # one heavy brow each side
    for x in (2, 5): put(n, x, hat_rows + 2, (36, 30, 34))
    for x in (1, 6): put(n, x, hat_rows + 2, (236, 232, 226))
    for x in (3, 4): dark(n, x, 8, 0.7)                               # mouth under the nose
    if beard:
        for y in (7, 8, 9):
            for x in range(1 if y > 7 else 0, 7 if y > 7 else 8):
                if not (y == 7 and 2 <= x <= 5): put(n, x, y, skinlib.paint(None, pal, 'hair', None, 'north', x, y, 8, 10))
    R = PARTS['robe']
    for f in ('north', 'south', 'east', 'west'):
        r = R[f]
        for x in range(r[2]): put(r, x, r[3] - 1, trim); put(r, x, 5, tuple(int(v * 0.55) for v in trim))   # hem and belt
    r = R['north']
    put(r, 3, 5, trim); put(r, 4, 5, trim)                            # buckle
    if apron:
        for y in range(6, 15):
            for x in range(1, 7): put(r, x, y, tuple(int(v * (1.0 if x not in (1, 6) else 0.85) * (0.92 if y % 4 == 0 else 1)) for v in apron))
    for (x, y, c) in emblem: put(r, x, y, c)
    B = PARTS['body']['north']
    for x in (3, 4): put(B, x, 0, skin)                               # open collar
    put(B, 3, 1, tuple(int(v * .8) for v in skin))
    A = PARTS['arms']
    for f in ('north', 'south', 'east', 'west'):
        for x in range(A[f][2]): put(A[f], x, A[f][3] - 1, trim)      # cuffs
    L = PARTS['legs']
    for f in ('north', 'south', 'east', 'west'):
        for y in range(9, 12):
            for x in range(L[f][2]): put(L[f], x, y, (52 - (y - 9) * 6, 38 - (y - 9) * 4, 30 - (y - 9) * 3))   # boots
    os.makedirs(OUT, exist_ok=True); im.save(OUT + f'job_{name}.png'); return im

W, K, G, S_, Bz = (236, 230, 214), (30, 26, 30), (214, 170, 60), (168, 172, 184), (150, 104, 50)
JOBS = [
 ('farmer', SKIN[0], (188, 170, 128), (96, 122, 60), (92, 70, 48), ((212, 182, 96), 'wood'), (120, 82, 44), (150, 116, 52),
  [(3, 9, G), (4, 9, G), (3, 10, G), (4, 8, G), (3, 11, (96, 122, 60)), (3, 12, (70, 96, 44))], dict(brim=True)),                       # straw hat, wheat ear
 ('woodcutter', SKIN[1], (150, 52, 44), (74, 58, 44), (60, 52, 46), ((84, 60, 40), 'fur'), (84, 60, 40), (40, 32, 28),
  [(2, 9, Bz), (3, 10, Bz), (4, 11, Bz), (5, 12, Bz), (4, 8, S_), (5, 8, S_), (5, 9, S_)], dict(hat_rows=2, beard=True)),                # red shirt, axe
 ('quarryman', SKIN[3], (120, 120, 126), (86, 88, 96), (70, 66, 64), ((98, 78, 56), 'cloth'), (40, 34, 32), (58, 58, 64),
  [(2, 12, Bz), (3, 11, Bz), (4, 10, Bz), (3, 9, S_), (4, 9, S_), (5, 9, S_), (6, 10, S_), (2, 10, S_)], dict(apron=(136, 132, 128))),   # dusty apron, pick
 ('smith', SKIN[1], (70, 64, 66), (52, 46, 48), (46, 42, 44), ((36, 30, 32), 'cloth'), (30, 26, 28), (150, 80, 36),
  [(3, 9, S_), (4, 9, S_), (5, 9, S_), (4, 10, Bz), (4, 11, Bz), (4, 12, Bz), (2, 13, (240, 130, 40)), (6, 8, (240, 170, 60))],
  dict(hat_rows=2, beard=True, apron=(92, 62, 40))),                                                                                      # leather apron, hammer, sparks
 ('fisher', SKIN[2], (70, 110, 140), (52, 86, 110), (84, 78, 66), ((196, 176, 96), 'wood'), (200, 196, 190), (226, 222, 206),
  [(3, 9, S_), (4, 9, (200, 206, 216)), (5, 9, S_), (6, 8, S_), (6, 10, S_), (2, 9, K)], dict(brim=True)),                               # sea blue, fish
 ('hunter', SKIN[3], (86, 104, 62), (58, 74, 46), (74, 58, 42), ((58, 74, 46), 'cloth'), (60, 40, 28), (120, 84, 50),
  [(2, 8, Bz), (2, 9, Bz), (3, 10, Bz), (3, 11, Bz), (2, 12, Bz), (2, 13, Bz), (4, 10, W), (5, 10, W), (6, 10, S_)], dict(hat_rows=4)),   # green hood, bow and arrow
 ('herbalist', SKIN[0], (150, 132, 150), (84, 64, 96), (70, 60, 74), ((84, 64, 96), 'cloth'), (150, 140, 136), (150, 190, 110),
  [(3, 12, (70, 110, 50)), (3, 11, (70, 110, 50)), (2, 10, (110, 160, 70)), (4, 10, (110, 160, 70)), (3, 9, (190, 120, 200)), (3, 10, (110, 160, 70))],
  dict(hat_rows=3, apron=(196, 186, 164))),                                                                                                # mauve shawl, sprig
 ('moneyer', SKIN[2], (60, 44, 70), (40, 36, 52), (40, 36, 44), ((40, 36, 52), 'cloth'), (120, 116, 120), G,
  [(3, 9, S_), (4, 9, S_), (3, 10, S_), (4, 10, (120, 124, 136)), (5, 12, G), (2, 12, S_), (3, 7, G), (4, 7, G)], dict(hat_rows=2, beard=True)),  # dark coat, gold chain, coins
]
ims = []
for (name, skin, shirt, robe, legs, hat, hair, trim, emb, kw) in JOBS: ims.append(npc(name, skin, shirt, robe, legs, hat, hair, trim, emb, **kw))
sh = Image.new('RGBA', (4 * 264 + 8, 2 * 264 + 8), (38, 34, 46, 255))
for i, im in enumerate(ims): sh.alpha_composite(im.resize((256, 256), Image.NEAREST), (8 + (i % 4) * 264, 8 + (i // 4) * 264))
sh.save(ROOT + 'art/job-npcs.png'); print('ok')
