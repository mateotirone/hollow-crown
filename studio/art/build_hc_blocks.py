"""Final-style blocks for Hollow Crown features from other threads: Citadel, town hall / Tree of Oaths,
library shelves, horses and rail. Run: python3 build_hc_blocks.py
Sheets tied to a 3D shape (throne, fallen shard, dusty tome) keep their layout and are restyled instead.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from palette import M, REGIONS, fixed, ramp
from texlib import *
import build_restyle as RS
TB = '/mnt/project-files/siege-nights/Siege_Nights_RP/textures/blocks/'
V = REGIONS['vale']; ST, MO = V['stone'], V['mortar']; G, OAK, DOAK, IRON, BS = M['gold'], M['oak'], M['dark_oak'], M['iron'], M['blacksteel']
VIOLET = fixed('#2a1250', '#4a1e88', '#7234c4', '#a05cf0', '#c896ff', '#ecd8ff')
HAY = fixed('#5a4210', '#8a6a1a', '#b8922a', '#d8b444', '#eccf6a', '#f8e8a0')
LEAF = V['foliage']
def sv(t, n): (t.im if isinstance(t, Tex) else t).save(TB + n + '.png')
def slab(seed, ramp_=ST, rim=True):
    t = Tex(); r = random.Random(seed)
    for y in range(16):
        for x in range(16): t.set(x, y, R(ramp_, 2))
    for _ in range(9):
        x, y = r.randrange(1, 14), r.randrange(1, 14); t.set(x, y, R(ramp_, 3)); t.set(x + 1, y, R(ramp_, 3)); t.set(x + 1, y + 1, R(ramp_, 1))
    if rim: frame(t, ramp_, 0, 1)
    return t
def stamp(t, rows, x0, y0, legend):
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch in legend: t.set(x0 + i, y0 + j, legend[ch])
GL = {'g': R(G, 4), 'G': R(G, 2), 'h': R(G, 5), 'd': R(G, 1)}

# ---- Citadel Cornerstone
t = Tex(); bricks(t, ST, MO, rows=((0, 8), (4, 12), (0, 8), (4, 12)), seed=51, tidy=True)
band(t, G, 6, rivets=(3, 8, 13), h=3); sv(t, 'siege_cornerstone_side')
t = slab(52); stamp(t, ["h.h..h.h", "hghgghgh", "gggggggg", "gGGGGGGG", ".dddddd."], 4, 5, GL); sv(t, 'siege_cornerstone_top')

# ---- Hall Cornerstone
t = slab(53); stamp(t, ["...hh...", "..hggG..", ".hggggG.", "hggggggG", ".gGddGG.", ".gGddGG.", ".gGddGG."], 4, 4, GL); sv(t, 'siege_hall_cornerstone_side')
t = slab(54); stamp(t, ["...hG...", "...gG...", "...gG...", "hggggggG", "GGGgGGGG", "...gG...", "...gG...", "...GG..."], 4, 4, GL); sv(t, 'siege_hall_cornerstone_top')

# ---- Tree of Oaths
def bark(ramp_, seed):
    t = Tex(); r = random.Random(seed)
    for x in range(16):
        tone = r.choice((1, 2, 2, 3))
        for y in range(16): t.set(x, y, R(ramp_, tone))
    for _ in range(12):
        x = r.randrange(16); y0 = r.randrange(16); n = r.randrange(3, 9)
        for y in range(y0, y0 + n): t.set(x, y % 16, R(ramp_, 4)); t.set((x + 1) % 16, y % 16, R(ramp_, 0))
    return t
sv(bark(DOAK, 55), 'siege_oath_tree_bark')
t = bark(fixed('#0e0a12', '#18121c', '#241a28', '#322436', '#423046', '#544058'), 56)      # Marked: ashen bark split by light
for path in ([(8, 0), (7, 3), (9, 6), (8, 9), (6, 12), (7, 15)], [(9, 6), (12, 8), (13, 11)]):
    for a, b in zip(path, path[1:]):
        for (x, y) in line(a, b): t.set(x, y, R(VIOLET, 4)); t.set(x + 1, y, R(VIOLET, 1))
t.set(9, 6, R(VIOLET, 5)); sv(t, 'siege_oath_tree_bark_marked')
def leaves(ramp_, seed):
    t = Tex(); r = random.Random(seed)
    for y in range(16):
        for x in range(16): t.set(x, y, R(ramp_, 1))
    for _ in range(40):   # leaf clumps: lit top-left, shaded bottom-right
        x, y = r.randrange(16), r.randrange(16); k = r.choice((2, 3, 3, 4))
        t.set(x, y, R(ramp_, k + 1)); t.set((x + 1) % 16, y, R(ramp_, k)); t.set(x, (y + 1) % 16, R(ramp_, k)); t.set((x + 1) % 16, (y + 1) % 16, R(ramp_, k - 1))
    return t
sv(leaves(LEAF, 57), 'siege_oath_tree_crown')
t = leaves(LEAF, 58)      # Knight: oath pennants hang among the leaves
for x0, rp in ((1, M['blood_red']), (6, M['royal_blue']), (11, G)):
    for y in range(4, 13):
        for dx in range(4):
            if y == 12 and dx in (1, 2): continue
            t.set(x0 + dx, y, R(rp, 4 if dx == 0 else 2 if dx == 3 else 3))
    for dx in range(4): t.set(x0 + dx, 3, R(PLASTER := fixed('#8a806c', '#b0a68e', '#cfc6ae', '#e2dac4', '#efe9d8', '#f8f4ea'), 4))
sv(t, 'siege_oath_tree_crown_knight')
t = leaves(fixed('#0c0814', '#1a1226', '#2a1c3c', '#3c2a54', '#52386e', '#6c4a8c'), 59)      # Marked: dark leaves, glowing veins
r = random.Random(60)
for _ in range(7):
    x, y = r.randrange(16), r.randrange(16)
    for i in range(r.randrange(3, 6)): t.set((x + i) % 16, (y + i // 2 + (i % 2)) % 16, R(VIOLET, 4 if i != 1 else 5))
sv(t, 'siege_oath_tree_crown_marked')
t = Tex(); bricks(t, ST, MO, rows=((0, 8), (0, 8)), rh=8, seed=61, tidy=True)
t.rect(6, 3, 9, 5, R(G, 3)); t.set(6, 3, R(G, 5)); t.set(9, 5, R(G, 1)); sv(t, 'siege_oath_tree_plinth')

# ---- Archive Shelf
SPINES = [M['blood_red'], M['royal_blue'], fixed('#0e2a12', '#1a4420', '#2a6230', '#3e8244', '#5ea262', '#8ac48c'), M['purple'], ramp('#b07a1e', 0.14, 0.7), ramp('#1e7a80', 0.1, 0.66)]
def shelf(n):
    t = Tex(); planks(t, OAK, False, (4, 4, 4, 4), seed=62); frame(t, DOAK, 0, 1)
    for row in range(2):
        y0 = 2 + row * 7
        t.rect(2, y0, 13, y0 + 5, R(M['coal'], 1)); 
        for x in range(2, 14): t.set(x, y0, R(M['coal'], 0)); t.set(x, y0 + 6, R(DOAK, 3)) if y0 + 6 < 15 else None
        for s in range(3):
            k = row * 3 + s
            if k >= n: continue
            sp = SPINES[k]; x0 = 3 + s * 4 - (1 if s == 0 else 0) + (0 if s < 2 else 0); x0 = 2 + s * 4 + (1 if s else 0)
            h = (5, 4, 5, 4, 5, 5)[k]; yy = y0 + 6 - h
            for y in range(yy, y0 + 6):
                for dx in range(3): t.set(x0 + dx, y, R(sp, 4 if dx == 0 else 3 if dx == 1 else 1))
            for dx in range(3): t.set(x0 + dx, yy + 1, R(G, 4 if dx < 2 else 2)); t.set(x0 + dx, y0 + 4, R(G, 3 if dx < 2 else 1))
            for dx in range(3): t.set(x0 + dx, yy, R(sp, 5 if dx < 2 else 2))
    return t
for n in range(7): sv(shelf(n), f'siege_shelf_front_{n}')
t = Tex(); planks(t, OAK, True, (4, 4, 4, 4), seed=63); frame(t, DOAK, 0, 1); sv(t, 'siege_shelf_side')
t = Tex(); planks(t, DOAK, False, (4, 4, 4, 4), seed=64); sv(t, 'siege_shelf_top')

# ---- Horses and rail
def hay(seed):
    t = Tex(); r = random.Random(seed)
    for y in range(16):
        for x in range(16): t.set(x, y, R(HAY, 2 + ((x + y * 2) % 5 == 0) - ((x * 3 + y) % 7 == 0)))
    for _ in range(18):
        x, y = r.randrange(16), r.randrange(16)
        for i in range(r.randrange(2, 5)): t.set((x + i) % 16, (y + (i // 2)) % 16, R(HAY, r.choice((4, 4, 5, 1))))
    return t
def timber_wall(seed):
    t = Tex(); planks(t, OAK, True, (4, 4, 4, 4), seed=seed); frame(t, DOAK, 0, 2); return t
t = timber_wall(65)   # Stables: a stall, hay piled behind the half door
h = hay(66)
for y in range(8, 14):
    for x in range(2, 14): t.set(x, y, h.get(x, y)[:3])
for x in range(2, 14): t.set(x, 7, R(DOAK, 4)); t.set(x, 8, R(DOAK, 1))
for (x, y) in line((2, 9), (7, 13)) + line((13, 9), (8, 13)): t.set(x, y, R(DOAK, 2))
t.rect(2, 2, 13, 6, R(M['coal'], 1)); stamp(t, [".hh..", "hgGh.", "hgggG", ".gGG.", ".gG.."], 5, 2, {'h': R(OAK, 5), 'g': R(OAK, 3), 'G': R(OAK, 1)})   # horse head in the dark
sv(t, 'travel/siege_stables_side'); sv(hay(67), 'travel/siege_stables_top')
t = timber_wall(68)   # Rail Depot: iron-strapped timber with a rail sign
band(t, BS, 3, rivets=(3, 12)); band(t, BS, 11, rivets=(3, 12))
for x in range(4, 12): t.set(x, 6, R(IRON, 4)); t.set(x, 9, R(IRON, 4))
for x in (5, 8, 10): t.set(x, 7, R(OAK, 5)); t.set(x, 8, R(OAK, 5))
sv(t, 'travel/siege_rail_depot_side')
t = Tex(); bricks(t, ST, MO, seed=69)
for x in range(16):
    if x % 4 == 1:
        for y in range(1, 15): t.set(x, y, R(DOAK, 3)); t.set(x + 1, y, R(DOAK, 1))
for y in (4, 11):
    for x in range(16): t.set(x, y, R(IRON, 4)); t.set(x, y + 1, R(IRON, 1))
sv(t, 'travel/siege_rail_depot_top')
t = slab(70)          # Station Post: gold-framed name plate
t.rect(3, 5, 12, 10, R(G, 3)); t.rect(4, 6, 11, 9, R(BS, 1))
for x in range(3, 13): t.set(x, 5, R(G, 5)); t.set(x, 10, R(G, 1))
for x in (5, 6, 7, 9, 10): t.set(x, 7, R(M['parchment'], 4))
for x in (5, 6, 8, 9): t.set(x, 8, R(M['parchment'], 2))
sv(t, 'travel/siege_station_post_side')
t = slab(71); t.rect(7, 7, 8, 8, R(G, 4)); t.set(8, 8, R(G, 2)); t.set(6, 7, R(G, 2)); t.set(9, 8, R(G, 2)); t.set(7, 6, R(G, 2)); t.set(8, 9, R(G, 2)); sv(t, 'travel/siege_station_post_top')
t = timber_wall(72)   # Breeder's Post: a notice with a horse on it
P = M['parchment']; t.rect(4, 3, 11, 12, R(P, 3))
for i in range(4, 12): t.set(i, 3, R(P, 5)); t.set(i, 12, R(P, 1))
stamp(t, ["..kk..", ".kkkk.", "kkkkk.", "k.kkk.", "..kkk.", "..kkkk"], 5, 4, {'k': R(DOAK, 1)}); t.set(7, 2, R(IRON, 5))
for x in (5, 6, 8, 9): t.set(x, 11, R(DOAK, 3))
sv(t, 'travel/siege_breeder_post_side')
t = Tex(); planks(t, OAK, False, (4, 4, 4, 4), seed=73); frame(t, DOAK, 0, 1)
stamp(t, [".gggg.", "gG..Gg", "g....g", "g....g", "gG..Gg", "dd..dd"], 5, 5, {'g': R(IRON, 4), 'G': R(IRON, 2), 'd': R(IRON, 1)}); sv(t, 'travel/siege_breeder_post_top')

# ---- sheets tied to 3D shapes: keep layout, restyle
RS.SRC = '/mnt/project-files/siege-nights/art/placeholder-backup-hc/'
RS.RAMPS['violet'] = VIOLET; RS.RAMPS['stone'] = ST; RS.RAMPS['oak'] = OAK
RS.restyle('blocks/siege_throne.png', ramps=RS.pick('gold', 'blood_red', 'stone', 'blacksteel'))
RS.restyle('blocks/siege_fallen_shard.png', ramps=RS.pick('violet'))
RS.restyle('blocks/hc_tome_cache.png', ramps=RS.pick('leather', 'linen', 'gold', 'dark_oak'))
print('hc blocks done')
