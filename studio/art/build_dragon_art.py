"""Dragon items and blocks plus the Gloamquill, in the shared style. Dragon skins come from geoskin.py.
Run: python3 build_dragon_art.py"""
import os, sys, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from palette import M, REGIONS, fixed
from texlib import *
RPT = '/mnt/project-files/siege-nights/Siege_Nights_RP/textures/'
G, L, BS = M['gold'], M['leather'], M['blacksteel']
ST, MO = REGIONS['vale']['stone'], REGIONS['vale']['mortar']
EGG = fixed('#2a0808', '#501010', '#7a1c18', '#a83424', '#d8643a', '#ffb060')
BONE = fixed('#4a4234', '#7a705a', '#a89e84', '#cec6ac', '#e8e2ce', '#f8f6ea')
HAY = fixed('#4a3410', '#7a5a1c', '#a8842c', '#cca844', '#e6c868', '#f6e49c')
SAND = fixed('#4a3414', '#7a5a22', '#a88236', '#cca852', '#e6ca7c', '#f8e8b4')
QUILL = fixed('#150c1e', '#2a1838', '#402654', '#583670', '#744c90', '#9670b2')
DL = fixed('#140c08', '#2a1a10', '#40281a', '#583824', '#704a30', '#8c6040')
MAG = (255, 96, 204, 255)
def grid(rows, path, r1, r2=None, r3=None, extra=None):
    t = Tex(); m1 = dict(zip('osdmlh', range(6))); m2 = dict(zip('OSDMLH', range(6)))
    for y, row in enumerate(rows):
        assert len(row) == 16, (path, y, len(row))
        for x, ch in enumerate(row):
            if ch in m1: t.set(x, y, r1[m1[ch]])
            elif ch in m2 and r2: t.set(x, y, r2[m2[ch]])
            elif ch.isdigit() and r3: t.set(x, y, r3[int(ch)])
            elif extra and ch in extra: t.set(x, y, extra[ch])
    t.save(RPT + path + '.png'); return t
grid(["................", "......oooo......", ".....osddlo.....", "....osdmdmlo....", "...osdmdmlmho...", "...odmdmdmlho...", "..osmdmdmlmlho..", "..odmdmdmdlhho..",
      "..osdmdmdmlmho..", "..oddmdmdmdlho..", "..ossdmdmdmllo..", "...osdsdmdmlo...", "...ossdsdmdmo...", "....ossddddo....", ".....oooooo.....", "................"], 'items/dragons/siege_dragon_egg', EGG)
grid(["................", "................", "....oooooooo....", "...olllmmmmdo...", "..olhlmmmmmddo..", ".olmmmmmmmddddo.", ".ommmGLGLGddddo.", ".odddddddddddso.",
      ".osso......osso.", ".o3o........o3o.", ".o4o........o4o.", ".o3o........o3o.", ".o43o......o34o.", "..o3433443343o..", "...oooooooooo...", "................"], 'items/dragons/siege_dragon_saddle', DL, G, M['iron'])
grid(["................", "..........oo....", ".........ohlo...", "........ohlmo...", ".......ohlmdo...", "......ohlmdo....", ".....ohllmdo....", "....ohllmdo.....",
      "...ohllmddo.....", "...ollmmdso.....", "..oOllmddso.....", ".oHLOmddso......", ".oLMDOsso.......", "..oMDoo.........", "...oo...........", "................"], 'items/dragons/siege_dragon_horn', BONE, G)
grid(["................", "............ooo.", "...........ohlo.", "..........ohvlo.", ".........ohvmdo.", "........olvmdo..", ".......olvmdso..", "......olvmdso...",
      ".....omvmdso....", "....odvmdso.....", "....ovddso......", "...ovosso.......", "..olo.oo........", ".olo............", ".oo.............", "................"], 'items/bestiary/gloamquill', QUILL, extra={'v': MAG})
def hay(seed, ramp_=HAY):
    t = Tex(); r = random.Random(seed)
    for y in range(16):
        for x in range(16): t.set(x, y, R(ramp_, 2 + ((x + y * 2) % 5 == 0) - ((x * 3 + y) % 7 == 0)))
    for _ in range(18):
        x, y = r.randrange(16), r.randrange(16)
        for i in range(r.randrange(2, 5)): t.set((x + i) % 16, (y + (i // 2)) % 16, R(ramp_, r.choice((4, 4, 5, 1))))
    return t
# Roost: a stone brick hearth with a gold band; top is scorched straw around an ember bed
t = Tex(); bricks(t, ST, MO, seed=81, tidy=True); band(t, G, 2, rivets=(3, 8, 12))
for x in range(5, 11):
    for y in range(9, 14): t.set(x, y, R(M['coal'], 1 if (x + y) % 3 else 0))
for (x, y, k) in [(6, 12, 3), (7, 11, 4), (8, 12, 5), (9, 11, 3), (7, 13, 2), (9, 13, 4)]: t.set(x, y, R(M['ember'], k))
t.save(RPT + 'blocks/dragons/siege_dragon_roost_side.png')
t = hay(82, fixed('#1c140a', '#3a2a12', '#5a441c', '#7e6228', '#a4843a', '#c8a856'))
for y in range(16):
    for x in range(16):
        d = max(abs(x - 7.5), abs(y - 7.5))
        if d > 6.6: t.set(x, y, R(ST, 2 if (x + y) % 4 else 3))
        elif d < 3.6: t.set(x, y, R(M['coal'], 1 + ((x * 5 + y * 3) % 4 == 0)))
        elif d < 4.6: t.set(x, y, R(M['coal'], 2))
for (x, y, k) in [(6, 6, 4), (8, 7, 5), (9, 9, 3), (6, 9, 2), (7, 8, 4), (9, 6, 2), (5, 8, 3), (8, 10, 4)]: t.set(x, y, R(M['ember'], k))
t.save(RPT + 'blocks/dragons/siege_dragon_roost_top.png')
# The Dragon Nest is a 9x9 model now: studio/build_dragon_nest.py paints its textures
print('dragon art done')

# ---- Train Carriage (model by the rails thread): 64x64 atlas of 16x16 swatches + item icon
def build_carriage():
    from PIL import Image
    OAK, DOAK, IRON = M['oak'], M['dark_oak'], M['iron']
    RED = M['blood_red']
    at = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    t = Tex(); planks(t, OAK, True, (4, 4, 4, 4), seed=91); at.paste(t.im, (0, 0))                       # body planks
    t = Tex(); planks(t, DOAK, False, (4, 4, 4, 4), seed=92); at.paste(t.im, (16, 0))                    # dark floor
    t = Tex()                                                                                             # blacksteel plate with rivets
    for y in range(16):
        for x in range(16): t.set(x, y, R(BS, 3 - (y % 8 == 7) + (y % 8 == 0) - ((x * 5 + y * 3) % 13 == 0)))
    for (x, y) in [(2, 2), (13, 2), (2, 10), (13, 10)]: t.set(x, y, R(BS, 5)); t.set(x, y + 1, R(BS, 0))
    at.paste(t.im, (32, 0))
    t = Tex()                                                                                             # bench cloth: quilted red
    for y in range(16):
        for x in range(16): t.set(x, y, R(RED, 3 + ((x + y) % 8 == 0) - ((x - y) % 8 == 0) - (y == 15) + (y == 0)))
    for (x, y) in [(4, 4), (12, 4), (4, 12), (12, 12)]: t.set(x, y, R(G, 4))
    at.paste(t.im, (48, 0))
    t = Tex()                                                                                             # wheel: iron rim, spokes, hub
    for y in range(16):
        for x in range(16):
            d = ((x - 7.5) ** 2 + (y - 7.5) ** 2) ** 0.5
            if d < 7.6: t.set(x, y, R(BS, 4 if d > 6.2 and x + y < 15 else 1 if d > 6.2 else 0))
            if d <= 6.2 and (abs(x - 7.5) < 1 or abs(y - 7.5) < 1 or abs(abs(x - 7.5) - abs(y - 7.5)) < 0.8): t.set(x, y, R(IRON, 3 if x + y < 15 else 2))
            if d < 2.2: t.set(x, y, R(IRON, 5 if d < 1.2 else 4))
    at.paste(t.im, (0, 16))
    t = Tex()                                                                                             # lantern glow
    FL = M['flame']
    for y in range(16):
        for x in range(16):
            d = max(abs(x - 7.5), abs(y - 7.5))
            t.set(x, y, R(FL, 5 if d < 2 else 4 if d < 4 else 3 if d < 6 else 2))
            if x in (0, 15) or y in (0, 15) or x in (7, 8) and d > 5 or y in (7, 8) and d > 5: t.set(x, y, R(BS, 1))
    at.paste(t.im, (16, 16))
    at.save(RPT + 'entity/siege/carriage.png')
    grid(["................", "................", ".oooooooooooooo.", ".oLLMMLLMMLLMMo.", ".oooooooooooooo.", ".ol.hm.hm.hm.do.", ".ol.hm.hm.hm.do.", ".olmmmmmmmmmmdo.",
          ".ollmlmlmlmlmdo.", ".olmdmdmdmdmddo.", ".osssssssssssso.", "..o33o....o33o..", ".o3443o..o3443o.", ".o3443o..o3443o.", "..o33o....o33o..", "................"], 'items/horses/siege_train_carriage', M['oak'], G, BS)
build_carriage()
print('carriage done')
