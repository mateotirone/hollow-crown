"""Builds the 3D Undertow mockup page: real block textures + a slice of the real terrain generator.
1) node export_world.mjs (run next to copies of scripts/undertow/terrain.js and layout.js) -> world.json
2) python3 build_mockup.py <world.json> <out.html>
Vanilla blocks the terrain uses (blackstone, basalt, water, stone bricks) get stand-in textures painted here.
"""
import sys, os, io, json, base64, random
sys.path.insert(0, '/mnt/project-files/siege-nights/studio/art')
from PIL import Image
from palette import M, REGIONS, fixed
from texlib import *
B = '/mnt/project-files/siege-nights/Siege_Nights_RP/textures/blocks/'
world = open(sys.argv[1]).read()
blocks = json.loads(world)['blocks']
BAS = fixed('#1a181e', '#2a282e', '#3c3a42', '#504e56', '#66646c', '#807e86')
def basalt_side(seed, ramp_=BAS):
    t = Tex(); r = random.Random(seed)
    for x in range(16):
        tone = r.choice((1, 2, 2, 3))
        for y in range(16): t.set(x, y, R(ramp_, tone if r.random() > 0.12 else tone - 1))
    return t.im
def blackstone():
    t = Tex(); bricks(t, fixed('#0e0c12', '#1a181e', '#26242c', '#34323a', '#44424a', '#56545c'), fixed('#060508', '#0a090c', '#100e14', '#16141a', '#1c1a20', '#222026'), seed=5); return t.im
def stone_bricks(mossy):
    V = REGIONS['vale']; t = Tex(); bricks(t, V['stone'], V['mortar'], rows=((0, 8), (4, 12), (0, 8), (4, 12)), seed=8, tidy=True)
    r = random.Random(9)
    if mossy:
        for _ in range(26): t.set(r.randrange(16), r.randrange(16), R(V['foliage'], r.choice((1, 2, 3))))
    else:
        for p in line((3, 0), (6, 6)) + line((6, 6), (5, 11)) + line((11, 5), (13, 15)): t.set(*p, R(V['stone'], 0))
    return t.im
def water():
    t = Tex(); W = fixed('#0c1838', '#142a5c', '#1e4488', '#2e62b4', '#4c88d8', '#86b8f0')
    for y in range(16):
        for x in range(16): t.set(x, y, R(W, 2 + ((x + y * 3) % 7 == 0) + ((x * 2 + y) % 11 == 0)), 150)
    return t.im
def flat(c): return Image.new('RGBA', (16, 16), c + (255,))
STAND = {'minecraft:blackstone': blackstone, 'minecraft:basalt': lambda: basalt_side(3), 'minecraft:polished_basalt': lambda: basalt_side(4, fixed('#24222a', '#34323a', '#46444c', '#5a5860', '#706e76', '#8a8890')),
         'minecraft:tuff': lambda: basalt_side(6), 'minecraft:water': water, 'minecraft:mossy_stone_bricks': lambda: stone_bricks(True), 'minecraft:cracked_stone_bricks': lambda: stone_bricks(False),
         'minecraft:oxidized_copper': lambda: flat((78, 170, 140)), 'minecraft:tinted_glass': lambda: flat((44, 36, 52))}
tex = {}
for name in blocks:
    im = Image.open(B + 'siege_' + name.split(':')[1] + '.png').convert('RGBA') if name.startswith('siege:') else STAND[name]()
    buf = io.BytesIO(); im.save(buf, 'PNG'); tex[name] = 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()
tpl = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'mockup_template.html')).read()
open(sys.argv[2], 'w').write(tpl.replace('__WORLD__', world).replace('__TEX__', json.dumps(tex)))
print('ok', os.path.getsize(sys.argv[2]) // 1024, 'KB')
