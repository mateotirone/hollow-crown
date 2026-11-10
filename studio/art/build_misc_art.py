"""Final-style art for the last placeholder icons and blocks (2026-11-10 audit): King's Journal, The Fourteen Arts,
Mason's Bench, Foundation Stone, Looking Glass, Latticewood Boat icon. Descriptions from TEXTURE-LIST.md.
Run: python3 build_misc_art.py"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from palette import M, REGIONS, fixed
from texlib import *
RP = '/mnt/project-files/siege-nights/Siege_Nights_RP/textures/'
V = REGIONS['vale']; U = REGIONS['undertow']
RED = fixed('#2e0c0c', '#50161a', '#782228', '#9a3434', '#b85048', '#d47a68')
GREY = fixed('#2c3430', '#46524a', '#647264', '#84927e', '#a4b09a', '#c6d0ba')
PAPER = M['parchment']; GOLD = M['gold']; OAK = M['dark_oak']; IRON = M['iron']; BRASS = fixed('#4a3410', '#7a5a1c', '#a8822e', '#caa648', '#e4c870', '#f6e6a8')
GLASS = fixed('#5a7884', '#7c9ca6', '#a0c0c8', '#c0dce0', '#dcf0f0', '#f4fcfc')

def book(cover, strap=None, seal=None, label=None, flame=False, scraped=False):
    t = Tex()
    for y in range(2, 15):
        for x in range(3, 13):
            v = 3 + (1 if x == 3 or y == 2 else 0) - (1 if x == 12 or y == 14 else 0); t.set(x, y, R(cover, v))
    for y in range(2, 15): t.set(3, y, R(cover, 1)); t.set(4, y, R(cover, 4))                     # spine
    for y in range(3, 15): t.set(13, y, R(PAPER, 3 if y % 2 else 4))                               # page edge
    for x in range(4, 14): t.set(x, 15, R(PAPER, 2))
    for (x, y) in ((6, 5), (9, 9), (7, 12), (10, 4)): t.set(x, y, R(cover, 2))                     # cracks in the leather
    t.set(7, 6, R(cover, 2)); t.set(10, 10, R(cover, 1))
    if scraped: [t.set(x, 4, R(cover, 5)) for x in (6, 7, 9, 10)]; t.set(8, 4, R(cover, 4))        # where the name was
    if seal: [t.set(x, y, R(seal, 4 if (x + y) % 2 == 0 else 3)) for x in (7, 8, 9) for y in (7, 8, 9)]; t.set(8, 8, R(seal, 5)); t.set(9, 9, R(seal, 1))
    if strap: [t.set(x, 11, R(strap, 2)) for x in range(3, 14)]; t.set(12, 11, R(GOLD, 4))
    if label: [t.set(x, y, R(PAPER, 4)) for x in range(6, 11) for y in (4, 5, 6)]; [t.set(x, 5, R(cover, 1)) for x in (7, 8, 9)]
    if flame: t.set(8, 10, (236, 244, 232, 255)); t.set(8, 9, (214, 232, 226, 255)); t.set(8, 11, (190, 214, 206, 255)); t.set(7, 11, R(cover, 4)); t.set(9, 11, R(cover, 4))
    return t

def mason_bench_side():
    t = Tex(seed=3); planks(t, OAK, True, (4, 4, 4, 4), seed=3)
    for x in range(16): t.set(x, 0, R(OAK, 4)); t.set(x, 1, R(OAK, 3)); t.set(x, 2, R(OAK, 1)); t.set(x, 3, R(OAK, 0))     # thick top
    for y in range(4, 16): t.set(0, y, R(OAK, 3)); t.set(1, y, R(OAK, 2)); t.set(14, y, R(OAK, 2)); t.set(15, y, R(OAK, 0))  # legs
    for y in range(4, 16):
        for x in range(2, 14): t.set(x, y, R(OAK, 0) if y < 9 else R(V['stone'], 3 - (1 if y == 15 or x == 13 else 0) + (1 if y == 9 or x == 3 else 0)) if 3 <= x <= 12 else R(OAK, 0))
    for (x, y) in ((6, 11), (7, 11), (10, 13)): t.set(x, y, R(V['stone'], 2))
    for y in range(4, 8): t.set(11, y, R(IRON, 3))                                                 # chisel hanging on the side
    t.set(11, 4, R(OAK, 4)); t.set(11, 8, R(IRON, 5)); return t
def mason_bench_top():
    t = Tex(seed=5); planks(t, OAK, False, (4, 4, 4, 4), seed=5)
    for y in range(4, 11):
        for x in range(2, 9): t.set(x, y, R(V['stone'], 3 + (1 if y == 4 or x == 2 else 0) - (1 if y == 10 or x == 8 else 0)))
    for y in range(4, 11): t.set(5, y, R(V['mortar'], 1)) if y < 8 else None                       # the half-finished cut
    for x in range(10, 14): t.set(x, 5, R(OAK, 4)); t.set(x, 6, R(OAK, 2))                         # mallet
    for y in range(4, 8): t.set(13, y, R(OAK, 5)); t.set(14, y, R(OAK, 3))
    for i in range(4): t.set(10 + i, 10 + i, R(IRON, 4)); t.set(11 + i, 10 + i, R(IRON, 2))        # iron square
    return t
def foundation_side():
    t = Tex(seed=7); bricks(t, V['stone'], V['mortar'], rows=((0,), (0,), (0,), (0,)), seed=7, tidy=True)
    for y in range(16):
        for x in range(16): t.set(x, y, R(V['stone'], 3 + (1 if y == 0 or x == 0 else 0) - (1 if y == 15 or x == 15 else 0)))
    for (x, y) in ((3, 12), (4, 12), (11, 3), (12, 13), (2, 5)): t.set(x, y, R(V['stone'], 2))
    chalk = (232, 230, 220, 255)
    for (x, y) in [(8, 4), (7, 5), (9, 5), (6, 6), (10, 6), (5, 7), (11, 7)] + [(6, y) for y in range(8, 12)] + [(10, y) for y in range(8, 12)] + [(x, 11) for x in range(6, 11)] + [(8, 10), (8, 9)]:
        t.set(x, y, chalk)                                                                         # a small chalked house
    return t
def foundation_top():
    t = Tex(seed=8)
    for y in range(16):
        for x in range(16): t.set(x, y, R(V['stone'], 3 + (1 if y == 0 or x == 0 else 0) - (1 if y == 15 or x == 15 else 0)))
    G = V['foliage']
    for i in range(3, 13):
        for (x, y) in ((i, 3), (i, 12), (3, i), (12, i)): t.set(x, y, R(G, 4 if (x + y) % 3 else 3))
    for (x, y) in ((3, 3), (12, 3), (3, 12), (12, 12)): t.set(x, y, R(G, 5))
    for (x, y) in ((7, 7), (8, 8), (6, 9), (9, 6)): t.set(x, y, R(V['stone'], 2))
    return t
def glass_side():
    t = Tex(seed=9)
    for y in range(16):
        for x in range(16): t.set(x, y, R(OAK, 3 + (1 if y == 0 or x == 0 else 0) - (1 if y == 15 or x == 15 else 0)))
    for y in range(2, 14):
        for x in range(2, 14):
            edge = x in (2, 13) or y in (2, 13); t.set(x, y, R(BRASS, 4 if (x == 2 or y == 2) else 2) if edge else R(GLASS, 2 + (1 if x + y < 12 else 0) - (1 if x + y > 20 else 0)))
    for (x, y) in ((4, 6), (5, 5), (6, 4), (5, 6)): t.set(x, y, R(GLASS, 5))                       # one glint
    t.set(11, 11, R(GLASS, 1)); t.set(10, 11, R(GLASS, 1)); return t
def glass_top():
    t = Tex(seed=10); planks(t, OAK, False, (4, 4, 4, 4), seed=10)
    for i in range(16): t.set(i, 0, R(OAK, 4)); t.set(0, i, R(OAK, 4)); t.set(i, 15, R(OAK, 0)); t.set(15, i, R(OAK, 0))
    return t
def boat_icon():
    t = Tex(); wd = U['stone']; vn = U['glow_pink']; ac = U['accent']
    hull = {9: range(2, 13), 10: range(1, 14), 11: range(2, 14), 12: range(3, 13)}
    for y, xs in hull.items():
        for x in xs: t.set(x, y, R(wd, 4 if y == 9 else 3 if y == 10 else 2 if y == 11 else 1))
    for x in (4, 7, 10): t.set(x, 10, R(vn, 3)); t.set(x + 1, 11, R(vn, 2))                        # magenta veins in the wood
    for (x, y) in ((13, 8), (14, 7), (14, 6), (13, 5)): t.set(x, y, R(wd, 4))                      # raised prow
    t.set(13, 4, R(ac, 4)); t.set(13, 3, R(ac, 5)); t.set(12, 4, R(ac, 2)); t.set(14, 4, R(ac, 2))  # the light it carries
    for x in range(1, 15, 2): t.set(x, 13, R(ac, 2))                                               # pale water
    return t

def build():
    os.makedirs(RP + 'blocks/looks', exist_ok=True); os.makedirs(RP + 'items/hollowfolk', exist_ok=True)
    book(RED, strap=M['leather'], seal=GOLD, scraped=True).im.save(RP + 'items/siege_kings_journal.png')
    book(GREY, label=True, flame=True).im.save(RP + 'items/siege_fourteen_arts.png')
    mason_bench_side().im.save(RP + 'blocks/siege_mason_bench_side.png'); mason_bench_top().im.save(RP + 'blocks/siege_mason_bench_top.png')
    foundation_side().im.save(RP + 'blocks/siege_foundation_stone_side.png'); foundation_top().im.save(RP + 'blocks/siege_foundation_stone_top.png')
    glass_side().im.save(RP + 'blocks/looks/hc_looking_glass_side.png'); glass_top().im.save(RP + 'blocks/looks/hc_looking_glass_top.png')
    boat_icon().im.save(RP + 'items/hollowfolk/siege_lattice_boat.png')
    ns = ['items/siege_kings_journal', 'items/siege_fourteen_arts', 'blocks/siege_mason_bench_side', 'blocks/siege_mason_bench_top', 'blocks/siege_foundation_stone_side', 'blocks/siege_foundation_stone_top',
          'blocks/looks/hc_looking_glass_side', 'blocks/looks/hc_looking_glass_top', 'items/hollowfolk/siege_lattice_boat']
    s = Image.new('RGBA', (len(ns) * 18 + 2, 20), (40, 36, 46, 255))
    for i, n in enumerate(ns): s.alpha_composite(Image.open(RP + n + '.png').convert('RGBA'), (2 + i * 18, 2))
    s.resize((s.width * 10, s.height * 10), Image.NEAREST).save('/mnt/project-files/siege-nights/art/misc-art.png')
if __name__ == '__main__': build()
