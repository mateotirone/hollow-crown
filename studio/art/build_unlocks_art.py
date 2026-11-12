"""Final art for the boss-unlock blocks (scripts/unlocks/), over the placeholder set from studio/build_unlocks.py.
Same file names, same symbols (the carved floor signs, the cairn beasts, the horn and the effigy are the placeholder
shapes, so every clue still reads the same), but painted the way the rest of the pack is: coursed stone, lit top-left,
clustered wear instead of per-pixel noise.
    python3 build_unlocks_art.py [repo root]      (re-run safe)
Drowned chapel: sea-green coursed stone, floor slabs with a cut sign, altar slab. Hallowmere cairns: stacked grey field
stone with a chalk beast. Faceless Vault: pale dressed sandstone, the bust, the seal socket. Root cradle: woven roots and
a moss bed. Millbrook: the stopped clocks and the well crank, in oak, iron and brass.
"""
import os, sys, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from texlib import Tex, R, bricks, planks, band
from palette import M, REGIONS, ramp

ROOT = (sys.argv[1] if len(sys.argv) > 1 else '/mnt/project-files/siege-nights').rstrip('/') + '/'
OUT = ROOT + 'Siege_Nights_RP/textures/blocks/unlocks/siege_'
SEA = ramp('#3f7c78', 0.10, 0.70, cool=0.16, warm=0.04, warm_hue=0.45); SEA_M = ramp('#1f4650', 0.07, 0.40)
PALE = ramp('#a8d8c8', 0.30, 0.92)                      # the cut sign catching light
FIELD = REGIONS['frostmarch']['stone']; FIELD_M = REGIONS['frostmarch']['mortar']
CHALK = [(150, 150, 146), (196, 196, 190), (226, 224, 216), (244, 242, 236)]
SAND = ramp('#d4c092', 0.34, 0.92, cool=0.10, warm=0.06); SAND_M = ramp('#a08a62', 0.24, 0.62)
ROOTW = REGIONS['blackfen']['wood']; MOSS = REGIONS['blackfen']['foliage']
OAK, IRON, GOLD, DIAL = M['dark_oak'], M['iron'], M['gold'], M['parchment']
INK = (34, 28, 40)
MASKS = {'cairn_fox': ['................',
               '................',
               '................',
               '................',
               '...#.....#......',
               '...##...##......',
               '...#######......',
               '....#####.......',
               '.....###........',
               '.....####.......',
               '....######......',
               '...#######.##...',
               '....#.#.#####...',
               '................',
               '................',
               '................'],
 'cairn_hare': ['................',
                '................',
                '................',
                '................',
                '.....#..#.......',
                '.....#..#.......',
                '.....#..#.......',
                '.....####.......',
                '....######......',
                '...#######......',
                '....######.#....',
                '.....#####.#....',
                '.....#...#......',
                '................',
                '................',
                '................'],
 'cairn_stag': ['................',
                '................',
                '................',
                '................',
                '...#.#...#.#....',
                '...#.#...#.#....',
                '....###.###.....',
                '......###.......',
                '......###.......',
                '.....#####......',
                '....#######.....',
                '....#.#.#.#.....',
                '....#.....#.....',
                '................',
                '................',
                '................'],
 'cairn_wolf': ['................',
                '................',
                '................',
                '................',
                '.....#...#......',
                '....###.###.....',
                '....#######.....',
                '.....#####......',
                '......###.......',
                '.....#####......',
                '....#######.....',
                '...########.#...',
                '....#.#.#.###...',
                '................',
                '................',
                '................'],
 'effigy': ['................',
            '................',
            '................',
            '................',
            '................',
            '.......##.......',
            '.......##.......',
            '.....######.....',
            '.......##.......',
            '.......##.......',
            '.......##.......',
            '......#..#......',
            '................',
            '................',
            '................',
            '................'],
 'floor_anchor': ['................',
                  '................',
                  '................',
                  '................',
                  '................',
                  '.......##.......',
                  '......#..#......',
                  '.......##.......',
                  '.......##.......',
                  '...#...##...#...',
                  '....#..##..#....',
                  '.....######.....',
                  '................',
                  '................',
                  '................',
                  '................'],
 'floor_fish': ['................',
                '................',
                '................',
                '................',
                '................',
                '................',
                '......####..#...',
                '....########....',
                '...##.######....',
                '....########....',
                '......####..#...',
                '................',
                '................',
                '................',
                '................',
                '................'],
 'floor_gull': ['................',
                '................',
                '................',
                '................',
                '................',
                '................',
                '...##......##...',
                '....##....##....',
                '.....##..##.....',
                '......####......',
                '.......##.......',
                '................',
                '................',
                '................',
                '................',
                '................'],
 'floor_star': ['................',
                '................',
                '................',
                '................',
                '................',
                '.......#........',
                '.......#........',
                '...#########....',
                '.....#####......',
                '....##...##.....',
                '...#.......#....',
                '................',
                '................',
                '................',
                '................',
                '................'],
 'horn': ['................',
          '................',
          '................',
          '................',
          '...........#....',
          '...........#....',
          '..........#.....',
          '.......####.....',
          '.....#####......',
          '....###.........',
          '................',
          '................',
          '................',
          '................',
          '................',
          '................']}


def pts(name): return [(x, y) for y, row in enumerate(MASKS[name]) for x, ch in enumerate(row) if ch == '#']


def save(t, name): t.save(OUT + name + '.png')


def slab(stone, mortar, seed, inset=True):
    """One big dressed slab: bevelled edge, a few clustered pits."""
    t = Tex(seed=seed); r = t.r
    t.rect(0, 0, 15, 15, R(stone, 2))
    for i in range(16):
        t.set(i, 0, R(stone, 3)); t.set(0, i, R(stone, 3)); t.set(i, 15, R(mortar, 2)); t.set(15, i, R(mortar, 2))
    if inset:
        for i in range(1, 15): t.set(i, 14, R(stone, 1)); t.set(14, i, R(stone, 1))
    for _ in range(5):                                   # wear in small clusters
        x, y = r.randrange(2, 13), r.randrange(2, 13); v = r.choice((1, 1, 3))
        t.set(x, y, R(stone, v)); t.set(x + 1, y, R(stone, v))
        if r.random() < 0.5: t.set(x, y + 1, R(stone, v))
    return t


def cut(t, name, stone, light):
    """A sign inlaid in the slab in pale stone, with the cut's shadow on its lower right."""
    p = set(pts(name))
    for (x, y) in p:
        if (x + 1, y + 1) not in p and x < 14 and y < 14: t.set(x + 1, y + 1, R(stone, 0))
    for (x, y) in p: t.set(x, y, light if ((x - 1, y) in p or (x, y - 1) in p) else R(PALE, 4))
    return t


def chapel():
    save(bricks(Tex(), SEA, SEA_M, seed=21), 'chapel_stone')
    for k, s in enumerate(('anchor', 'fish', 'gull', 'star')):
        save(cut(slab(SEA, SEA_M, 30 + k), 'floor_' + s, SEA, R(PALE, 3)), 'carved_floor_' + s)
    t = Tex(); t.rect(0, 0, 15, 15, R(SEA_M, 0))        # the lifted stone: a dark shaft with a stone rim
    for i in range(16):
        for d in range(2):
            t.set(i, d, R(SEA, 3 - d)); t.set(d, i, R(SEA, 3 - d)); t.set(i, 15 - d, R(SEA, 1 + d)); t.set(15 - d, i, R(SEA, 1 + d))
    for i in range(2, 14): t.set(i, 2, (8, 14, 20)); t.set(2, i, (8, 14, 20))
    for (x, y) in ((5, 12), (6, 12), (10, 11), (11, 12), (8, 13)): t.set(x, y, R(SEA_M, 2))     # a glint of water far down
    save(t, 'carved_floor_lifted')
    t = bricks(Tex(), SEA, SEA_M, rows=((0, 8), (4, 12), (0, 8), (4, 12)), seed=5, tidy=True)   # altar side: a table slab on coursed stone
    for x in range(16):
        t.set(x, 0, R(SEA, 4)); t.set(x, 1, R(SEA, 3)); t.set(x, 2, R(SEA, 2)); t.set(x, 3, R(SEA_M, 0))
    for x in range(2, 14, 3): t.set(x, 1, R(SEA, 2))
    save(t, 'drowned_altar_side')
    for name, ring in (('drowned_altar_top', False), ('drowned_altar_top_ring', True)):
        t = slab(SEA, SEA_M, 44)
        for i in range(3, 13):                           # a shallow dish cut in the top
            t.set(i, 3, R(SEA, 0)); t.set(3, i, R(SEA, 0)); t.set(i, 12, R(SEA, 4)); t.set(12, i, R(SEA, 4))
        t.rect(4, 4, 11, 11, R(SEA, 1)); t.set(4, 4, R(SEA, 0)); t.set(11, 11, R(SEA, 2))
        if ring:
            for (x, y) in ((7, 6), (8, 6), (6, 7), (9, 7), (6, 8), (9, 8), (7, 9), (8, 9)): t.set(x, y, R(GOLD, 3))
            t.set(7, 6, R(GOLD, 5)); t.set(6, 7, R(GOLD, 4)); t.set(9, 8, R(GOLD, 1)); t.set(8, 9, R(GOLD, 1)); t.set(8, 5, (220, 236, 255))
        save(t, name)


def field_stone(seed):
    return bricks(Tex(), FIELD, FIELD_M, rows=((0, 6, 11), (3, 9), (0, 5, 12), (2, 8)), seed=seed)


def cairns():
    save(field_stone(7), 'cairn_stone')
    for k, s in enumerate(('fox', 'hare', 'stag', 'wolf')):
        t = field_stone(7); p = pts('cairn_' + s); ps = set(p)
        for (x, y) in p:                                 # chalk rubbed on rough stone: thinner at the edges, thick in the middle
            n = sum((x + dx, y + dy) in ps for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            t.set(x, y, CHALK[min(3, n)] if (x * 3 + y * 5) % 11 else CHALK[1])
        save(t, 'hunt_cairn_' + s)
    for name, horn in (('hunters_cairn_top', False), ('hunters_cairn_top_horn', True)):
        t = slab(FIELD, FIELD_M, 9)
        for x in range(4, 12):                           # the rest worn for the horn
            t.set(x, 7, R(FIELD, 0)); t.set(x, 8, R(FIELD, 1)); t.set(x, 9, R(FIELD, 4))
        if horn:
            bone = [(200, 194, 172), (236, 232, 214), (250, 248, 238)]; p = pts('horn')
            for (x, y) in p: t.set(x, y, bone[1])
            for (x, y) in p:
                if (x, y - 1) not in p: t.set(x, y, bone[2])
                if (x, y + 1) not in p and (x, y - 1) in p: t.set(x, y, bone[0])
            t.set(4, 9, R(GOLD, 3)); t.set(5, 9, R(GOLD, 2))      # the brass mouthpiece
        save(t, name)


def vault():
    save(bricks(Tex(), SAND, SAND_M, rows=((0, 8), (4, 12), (0, 8), (4, 12)), seed=3), 'vault_sandstone')
    def bust(face):
        t = Tex(); t.rect(0, 0, 15, 15, R(SAND, 2))      # a head and shoulders cut from one block
        for y in range(16):
            for x in range(16):
                if (x + y * 3) % 9 == 0: t.set(x, y, R(SAND, 1))
        for x in range(16): t.set(x, 0, R(SAND, 4)); t.set(x, 15, R(SAND_M, 1))
        head = [(x, y) for y in range(2, 10) for x in range(4, 12) if not ((x in (4, 11)) and y in (2, 9))]
        for (x, y) in head: t.set(x, y, R(SAND, 3))
        for y in range(2, 10): t.set(4 if y not in (2, 9) else 5, y, R(SAND, 4)); t.set(11 if y not in (2, 9) else 10, y, R(SAND, 1))
        for x in range(5, 11): t.set(x, 2, R(SAND, 5)); t.set(x, 9, R(SAND, 1))
        for x in range(6, 10): t.set(x, 10, R(SAND, 1)); t.set(x, 11, R(SAND, 2))           # neck
        for x in range(2, 14): t.set(x, 12, R(SAND, 4)); t.set(x, 13, R(SAND, 3))           # shoulders
        t.set(1, 13, R(SAND, 3)); t.set(14, 13, R(SAND, 1)); t.set(13, 12, R(SAND, 1))
        if face:                                        # the face was chiselled away: smooth, no features, a few chisel nicks
            for (x, y) in ((6, 4), (9, 5), (7, 7)): t.set(x, y, R(SAND, 2))
            t.set(8, 6, R(SAND, 4))
        else:
            for y in range(3, 9): t.set(7, y, R(SAND, 2))                                  # back of the head: a plain seam
        return t
    save(bust(True), 'faceless_bust_face'); save(bust(False), 'faceless_bust_side')
    for name, pressed in (('vault_seal_blank', False), ('vault_seal_pressed', True)):
        t = slab(SAND, SAND_M, 12)
        for y in range(16):
            for x in range(16):
                d = (x - 7.5) ** 2 + (y - 7.5) ** 2
                if 20 < d <= 34: t.set(x, y, R(GOLD, 4 if x + y < 14 else 2 if x + y < 18 else 1))     # the brass ring
                elif d <= 20: t.set(x, y, R(SAND_M, 0 if x + y < 13 else 1) if not pressed else R(GOLD, 3 if x + y < 14 else 2))
        if pressed:
            for (x, y) in ((6, 6), (7, 5), (8, 6), (9, 6), (6, 7), (7, 7), (8, 7), (9, 7)): t.set(x, y, R(GOLD, 5))     # a crown without a face under it
            for x in range(6, 10): t.set(x, 9, R(GOLD, 1)); t.set(x, 10, R(GOLD, 1))
        save(t, name)


def cradle():
    def weave(seed):
        t = Tex(seed=seed); t.rect(0, 0, 15, 15, R(ROOTW, 0))
        for k in range(4):                               # thick roots over and under each other
            for i in range(16):
                y = (k * 4 + (1 if (i // 4 + k) % 2 else 0)) % 16
                over = (i // 4 + k) % 2 == 0
                t.set(i, y, R(ROOTW, 4 if over else 2)); t.set(i, (y + 1) % 16, R(ROOTW, 3 if over else 2)); t.set(i, (y + 2) % 16, R(ROOTW, 1))
        for x in (3, 11):
            for y in range(16):
                if (y // 4 + x) % 2: t.set(x, y, R(ROOTW, 3)); t.set(x + 1, y, R(ROOTW, 1))
        return t
    save(weave(1), 'root_cradle_side')
    for name, laid in (('root_cradle_top', False), ('root_cradle_top_laid', True)):
        t = weave(2); r = random.Random(4)
        for y in range(3, 13):
            for x in range(3, 13):
                if (x in (3, 12)) and (y in (3, 12)): continue
                t.set(x, y, R(MOSS, 2))
        for i in range(4, 12): t.set(i, 3, R(MOSS, 1)); t.set(3, i, R(MOSS, 1)); t.set(i, 12, R(MOSS, 3)); t.set(12, i, R(MOSS, 3))
        for _ in range(7):
            x, y = r.randrange(4, 11), r.randrange(4, 11); v = r.choice((1, 3, 3)); t.set(x, y, R(MOSS, v)); t.set(x + 1, y, R(MOSS, v))
        if laid:
            twig = [(86, 62, 36), (126, 96, 58), (160, 130, 84)]; p = pts('effigy')
            for (x, y) in p: t.set(x, y, twig[1]); t.set(x + 1, y + 1, R(MOSS, 0)) if (x + 1, y + 1) not in p and (x + 1, y) not in p else None
            for (x, y) in p:
                if (x - 1, y) not in p and (x, y - 1) not in p: t.set(x, y, twig[2])
                if (x + 1, y) not in p and (x, y + 1) not in p: t.set(x, y, twig[0])
            t.set(7, 8, (150, 40, 40)); t.set(8, 8, (120, 30, 34))                  # the red thread that binds it
        save(t, name)


def millbrook():
    def case():
        t = planks(Tex(), OAK, vertical=False, seed=6)
        for (x, y) in ((0, 0), (1, 0), (0, 1), (15, 0), (14, 0), (15, 1), (0, 15), (1, 15), (0, 14), (15, 15), (14, 15), (15, 14)):
            t.set(x, y, R(GOLD, 3 if y < 8 else 2))
        t.set(0, 0, R(GOLD, 5)); t.set(15, 15, R(GOLD, 1))
        return t
    save(case(), 'stopped_clock_case')
    for name, minute in (('stopped_clock_317', ((9, 9), (10, 9), (11, 10), (12, 10))), ('stopped_clock_318', ((9, 9), (10, 10), (11, 10), (12, 11)))):
        t = case()
        for y in range(16):
            for x in range(16):
                d = (x - 7.5) ** 2 + (y - 7.5) ** 2
                if 34 < d <= 50: t.set(x, y, R(GOLD, 4 if x + y < 13 else 2 if x + y < 19 else 1))
                elif d <= 34: t.set(x, y, R(DIAL, 4 if x + y < 13 else 3))
        for (x, y) in ((7, 2), (8, 2), (13, 7), (13, 8), (7, 13), (8, 13), (2, 7), (2, 8)): t.set(x, y, R(DIAL, 0))     # the hour marks
        for (x, y) in ((8, 8), (9, 8), (10, 8)): t.set(x, y, INK)                # hour hand at three
        for (x, y) in minute: t.set(x, y, R(OAK, 0))                             # minute hand, a hair apart between the two clocks
        t.set(7, 7, R(GOLD, 5)); t.set(8, 7, R(GOLD, 3)); t.set(7, 8, R(GOLD, 3))
        save(t, name)
    def crank(plate):
        t = planks(Tex(), OAK, vertical=True, seed=8); band(t, IRON, 2); band(t, IRON, 12)
        if plate:
            t.rect(5, 5, 10, 10, R(GOLD, 3))
            for i in range(5, 11): t.set(i, 5, R(GOLD, 5)); t.set(5, i, R(GOLD, 4)); t.set(i, 10, R(GOLD, 1)); t.set(10, i, R(GOLD, 1))
            for (x, y) in ((5, 5), (10, 5), (5, 10), (10, 10)): t.set(x, y, R(IRON, 1))                 # corner pins
            if plate == 'keyhole':
                for (x, y) in ((7, 6), (8, 6), (7, 7), (8, 7), (7, 8), (8, 8), (7, 9)): t.set(x, y, INK)
                t.set(8, 9, R(GOLD, 1))
            else:                                       # wound: the key is in and turned
                for (x, y) in ((7, 7), (8, 7), (7, 8), (8, 8)): t.set(x, y, R(GOLD, 5))
                for (x, y) in ((6, 7), (9, 8), (7, 6), (8, 9)): t.set(x, y, R(GOLD, 4))
                t.set(8, 8, R(GOLD, 2))
        return t
    save(crank(None), 'well_crank_side'); save(crank('keyhole'), 'well_crank_keyhole'); save(crank('wound'), 'well_crank_wound')


chapel(); cairns(); vault(); cradle(); millbrook(); print('unlock blocks', len(os.listdir(os.path.dirname(OUT))))
