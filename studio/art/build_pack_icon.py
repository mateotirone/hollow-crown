"""Pack icon (256x256, drawn at 32x32): the Hollow Crown over a cracked castle wall at night."""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from palette import M, REGIONS, fixed
from texlib import *
U = REGIONS['undertow']; G = M['gold']
VIOLET = fixed('#2a1250', '#4a1e88', '#7234c4', '#a05cf0', '#c896ff', '#ecd8ff')
NIGHT = fixed('#0c0814', '#140e20', '#1c142e', '#261a3e', '#32224e', '#402c60')
WALL = fixed('#14121c', '#24222e', '#363442', '#4a4858', '#605e70', '#7a7888')
t = Tex(32, 32)
for y in range(32):                                   # night sky, glow rising from behind the wall
    for x in range(32):
        d = math.hypot(x - 15.5, (y - 19) * 1.3)
        k = 5 if d < 5 else 4 if d < 8 else 3 if d < 11 else 2 if d < 15 else 1 if d < 19 else 0
        if (x + y) % 2 and d % 4 < 1.2 and k > 0: k -= 1
        t.set(x, y, R(NIGHT, k))
for (x, y) in [(3, 3), (27, 5), (6, 10), (24, 12), (29, 1), (11, 2)]: t.set(x, y, R(U['accent'], 3))
# castle wall with battlements
for y in range(20, 32):
    for x in range(32):
        merlon = (x // 4) % 2 == 0
        if y < 23 and not merlon: continue
        row = (y - 20) // 3; off = 3 if row % 2 else 0
        u = (x + off) % 6; v = (y - 20) % 3
        k = 0 if (v == 2 or u == 5) else 3 if v == 0 else 2
        if y == 20 and merlon: k = 4
        if y == 23 and not merlon: k = 4
        t.set(x, y, R(WALL, k))
# the crack: violet light splitting the wall
crack = [(16, 21), (15, 23), (16, 25), (14, 27), (15, 29), (13, 31)]
for a, b in zip(crack, crack[1:]):
    for (x, y) in line(a, b):
        t.set(x, y, R(VIOLET, 5)); t.set(x - 1, y, R(VIOLET, 3)); t.set(x + 1, y, R(VIOLET, 2))
for (x, y) in [(17, 26), (18, 27), (12, 28), (11, 29)]: t.set(x, y, R(VIOLET, 3))
# the crown: violet cracked stone, magenta veins, blue gems, amethyst in the tall centre spike (Mateo's reference)
CROWN = ["...........oo...........", "..........oaao..........", "....o.....oaAo.....o....", "...oPo...oPAApo...oPo...", ".o.oPo..oPp..pdo..oPo.o.", "oPooPpo.oPp.w.pdo.opdoPo",
         "oPdoPpdooPv.b.vdoopddoPd", "oPpdPvpdoPpv.vpdopvpdppd", "oPpppvppPpvpvpvpdppvpppd", "oPbppvvpbppvbvppbpvvppbd", "opppppvppppvpvppppvppppd", ".dddddddddddddddddddddd."]
ST = fixed('#150c1e', '#2a1838', '#402654', '#583670', '#744c90', '#9670b2')
CL = {'o': R(ST, 0), 'd': R(ST, 1), 'p': R(ST, 3), 'P': R(ST, 5), 'v': (255, 96, 204, 255), 'a': R(VIOLET, 5), 'A': R(VIOLET, 3), 'b': (184, 226, 248, 255), 'w': (255, 255, 255, 255)}
for j, row in enumerate(CROWN):
    assert len(row) == 24
    for i, ch in enumerate(row):
        if ch in CL: t.set(4 + i, 5 + j, CL[ch])
outline = t.im.copy()
big = t.im.resize((256, 256), Image.NEAREST).convert('RGBA')
for p in ('/mnt/project-files/siege-nights/Siege_Nights_RP/pack_icon.png', '/mnt/project-files/siege-nights/Siege_Nights_BP/pack_icon.png'): big.save(p)
print('pack icon done')
