"""Settlement wall levels (Mateo, 2026-11-10: the wall is generated around your plot when you claim it, and upgraded at
the town hall; "I want to see every level wall. I think we should do a lot.").
LEVELS is the design table (shared with the settlement thread's scripts/settle/walls.js). section(n) turns one level
into a 17 block wide sample section with a gate, used by the Texture Studio ("build" model).
Also paints the two wooden wall textures the early levels need, per region:
  textures/blocks/regional/siege_palisade_<region>.png, siege_wall_planks_<region>.png
Run: python3 build_walls.py"""
import os, sys, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from palette import REGIONS
from texlib import *
TB = '/mnt/project-files/siege-nights/Siege_Nights_RP/textures/blocks/'
WALL_REGIONS = ('vale', 'frostmarch', 'saltreach', 'emberwaste', 'blackfen')

LEVELS = [
 dict(n=1, name='Stake Fence', kind='fence', walk=0, height=1, thick=1, body='log', gate='open', note='Marks the claim. Keeps animals out, nothing else.'),
 dict(n=2, name='Palisade', kind='palisade', walk=0, height=3, thick=1, body='log', gate='wood', note='Sharpened logs three high and a plank gate.'),
 dict(n=3, name='Braced Palisade', kind='palisade', walk=2, height=4, thick=1, body='log', foot='cobbled', gate='wood', platform=True, note='Cobbled footing, a plank walkway behind and a lookout platform.'),
 dict(n=4, name='Fieldstone Wall', kind='stone', walk=0, height=4, thick=1, body='cobbled', cap='stone', gate='gate', gate_h=3, note='The first stone: cobbled, four high, with a real Castle Gate.'),
 dict(n=5, name='Stone Wall', kind='stone', walk=3, height=5, thick=1, body='stone', foot='cobbled', battlements=True, gate='gate', gate_h=4, arch=True, note='Castle Stone with battlements and a wooden walkway for archers.'),
 dict(n=6, name='Battlement Wall', kind='stone', walk=6, height=6, thick=2, body='stone', foot='cobbled', bands={4: 'bricks'}, battlements=True, gate='gate', tier='iron', port=True, gate_h=4, arch=True, note='Two blocks thick so you walk on the wall itself. Iron gate and a portcullis.'),
 dict(n=7, name='Watch Wall', kind='stone', walk=7, height=7, thick=2, body='stone', foot='cobbled', bands={5: 'bricks'}, battlements=True, towers=4, tower_h=10, gate='gate', tier='iron', port=True, gate_h=4, arch=True, gate_rise=2, note='Four corner towers with arrow slits, and the wall rises over the gate.'),
 dict(n=8, name='Curtain Wall', kind='stone', walk=9, height=9, thick=3, body='smooth', foot='cobbled', foot_h=2, batter=True, bands={4: 'bricks', 7: 'bricks'}, battlements=True, towers=8, tower_h=13, roof=True, gatehouse=12, gate='gate', tier='iron', port=True, gate_h=5, arch=True, note='Smooth faced and three thick with a sloped base. Eight roofed towers and a twin tower gatehouse.'),
 dict(n=9, name='Great Curtain Wall', kind='stone', walk=11, height=11, thick=3, body='smooth', foot='cobbled', foot_h=2, batter=True, bands={4: 'bricks', 8: 'bricks'}, battlements=True, mach=True, towers=8, tower_h=16, roof=True, gatehouse=15, gate='gate', tier='diamond', port=True, gate_h=5, arch=True, rein='iron', banners=True, note='Overhanging battlements to drop things on raiders, iron-bound gatehouse, diamond gate, banners.'),
 dict(n=10, name='Crown Wall', kind='stone', walk=13, height=13, thick=4, body='smooth', foot='cobbled', foot_h=3, batter=True, bands={5: 'bricks', 9: 'tiles', 10: 'bricks'}, battlements=True, mach=True, towers=12, tower_h=19, roof=True, gatehouse=18, gate='gate', tier='netherite', port=True, gate_h=5, arch=True, rein='diamond', banners=True, keep_tower=True, note='The top. Four thick, twelve towers, a great gatehouse, netherite gate and portcullis.'),
]

# ------------------------------------------------------------------ textures
def palisade(rk, seed):
    """Two upright logs side by side: bark with a lit left edge, a dark seam between."""
    w = REGIONS[rk]['wood']; t = Tex(seed=seed); r = random.Random(seed)
    for x in range(16):
        k = x % 8; v = (3, 4, 3, 3, 2, 2, 1, 0)[k]
        for y in range(16): t.set(x, y, R(w, v))
    for _ in range(9):                                   # bark furrows
        x = r.choice((1, 2, 3, 4, 5, 9, 10, 11, 12, 13)); y0 = r.randrange(16); L = r.randrange(3, 6)
        for y in range(y0, y0 + L): t.set(x, y % 16, R(w, 1))
    for x0 in (2, 11):                                   # a knot on each log
        y = r.randrange(3, 12); t.set(x0, y, R(w, 0)); t.set(x0 + 1, y, R(w, 1)); t.set(x0, y + 1, R(w, 1))
    return t

def wall_planks(rk, seed):
    t = Tex(seed=seed); planks(t, REGIONS[rk]['wood'], False, (4, 4, 4, 4), seed=seed); return t

def build_textures():
    os.makedirs(TB + 'regional/', exist_ok=True)
    for i, rk in enumerate(WALL_REGIONS):
        palisade(rk, 20 + i).im.save(TB + f'regional/siege_palisade_{rk}.png')
        wall_planks(rk, 30 + i).im.save(TB + f'regional/siege_wall_planks_{rk}.png')

# ------------------------------------------------------------------ sample sections
SECTION_W = {7: 23, 8: 29, 9: 31, 10: 35}   # sample section width per level (default 17); the gate sits in the middle
def section(L):
    full = {}; out = []
    for b in _section(L):
        if len(b) == 4: full[(b[0], b[1], b[2])] = b[3]
        else: out.append(b)
    return [[x, y, z, r] for (x, y, z), r in full.items()] + out

def _section(L):
    """-> list of [x, y, z, role] or [x, y, z, role, [x1,y1,z1,x2,y2,z2]] (sub-box in block fractions). z=0 is the outer face,
    z grows inward; negative z sticks out toward the attacker."""
    B = []; W = SECTION_W.get(L['n'], 17); g0 = W // 2 - 1; GX = (g0, g0 + 1, g0 + 2)
    def put(x, y, z, role, box=None): B.append([x, y, z, role] + ([box] if box else []))
    kind = L['kind']; h = L['height']
    if kind == 'fence':
        for x in range(W):
            if x in GX: continue
            if x % 2 == 0 or x in (g0 - 1, g0 + 3):
                put(x, 0, 0, 'log', [.3, 0, .3, .7, 1, .7]); put(x, 1, 0, 'log', [.3, 0, .3, .7, .4, .7])
            for yy in (.3, .75):
                put(x, 0, 0, 'planks', [0, yy, .44, 1, yy + .16, .56])
        return B
    if kind == 'palisade':
        foot = 1 if L.get('foot') else 0
        for x in range(W):
            if x in GX: continue
            hh = h + (1 if x in (g0 - 1, g0 + 3) else 0)
            for y in range(hh): put(x, y, 0, L['foot'] if y < foot else 'log')
            put(x, hh, 0, 'log', [.25, 0, .25, .75, .5, .75])
        for x in GX:                                           # plank gate, lintel
            for y in range(3): put(x, y, 0, 'gate', [0, 0, .4, 1, 1, .6])
            put(x, 3, 0, 'log', [0, .1, .25, 1, .6, .75])
        if L.get('walk'):
            wy = L['walk']
            for x in range(W):
                if x in GX: continue
                put(x, wy, 1, 'planks', [0, .5, 0, 1, 1, 1])
                if x % 4 == 0:
                    for y in range(wy): put(x, y, 1, 'log', [.35, 0, .55, .65, 1, .85])
                    put(x, wy, 1, 'log', [.35, 0, .55, .65, .5, .85])
        if L.get('platform'):
            for x in range(0, 3):
                for z in (1, 2): put(x, h, z, 'planks', [0, .5, 0, 1, 1, 1])
            for (x, z) in ((0, 2), (2, 2)):
                for y in range(h + 3): put(x, y, z, 'log', [.35, 0, .35, .65, 1, .65])
            for x in range(-1, 4):
                for z in (0, 1, 2, 3): put(x, h + 3, z, 'planks', [0, 0, 0, 1, .25, 1])
        return B
    # ---- stone levels
    T_ = L['thick']; foot_h = L.get('foot_h', 1) if L.get('foot') else 0; bands = L.get('bands', {}); gh = L['gate_h']
    rise = L.get('gate_rise', 0); mach = L.get('mach'); front = -1 if mach else 0
    def role_at(y, z):
        if y < foot_h: return L['foot']
        if y in bands and z == 0: return bands[y]
        if y == h - 1 and L.get('cap') and z == 0: return L['cap']
        if y == h - 1 and z > 0: return 'tiles'
        return L['body'] if z == 0 else 'stone'
    def over_gate(x): return rise and g0 - 2 <= x <= g0 + 4
    for x in range(W):
        top = h + (rise if over_gate(x) else 0)
        for z in range(T_):
            for y in range(top):
                if x in GX and y < gh: continue
                r_ = role_at(min(y, h - 1) if y >= h else y, z)
                if L.get('rein') and g0 - 2 <= x <= g0 + 4 and z == 0 and y >= foot_h and (x in (g0 - 1, g0 + 3) or y in (gh, gh + 1)): r_ = 'rein'
                elif L.get('arch') and z == 0 and ((y == gh and g0 - 1 <= x <= g0 + 3) or (x in (g0 - 1, g0 + 3) and y < gh)): r_ = 'bricks'
                put(x, y, z, r_)
        if L.get('batter') and x not in GX:
            for y in range(foot_h): put(x, y, -1, L['foot'], [0, 0, 1 - (foot_h - y) / (foot_h + 1), 1, 1, 1])
        if mach:
            put(x, top - 1, -1, 'bricks')
            if x % 2 == 0: put(x, top - 2, -1, 'bricks', [.2, .3, .3, .8, 1, 1])
        if L.get('battlements'):
            if x % 2 == 0: put(x, top, front, L['body'] if L['body'] != 'cobbled' else 'stone')
            else: put(x, top, front, 'stone', [0, 0, 0, 1, .4, 1]) if T_ > 1 else None
            if T_ >= 3: put(x, top, T_ - 1, 'stone', [0, 0, .5, 1, .5, 1])       # inner parapet
        if L['walk'] and T_ == 1 and x not in GX:
            put(x, L['walk'], 1, 'planks', [0, .5, 0, 1, 1, 1])
            if x % 4 == 0:
                for y in range(L['walk']): put(x, y, 1, 'log', [.35, 0, .55, .65, 1, .85])
                put(x, L['walk'], 1, 'log', [.35, 0, .55, .65, .5, .85])
    gz = min(T_ - 1, 1)
    for x in GX:
        for y in range(gh): put(x, y, gz, 'gate', [0, 0, .4, 1, 1, .6])
        if L.get('port'):
            for y in range(2, gh): put(x, y, 0, 'port', [0, 0, .15, 1, 1, .27])
    def tower(x0, w, th, z0, z1, roof, slit=True):
        cx = x0 + w // 2
        for x in range(x0, x0 + w):
            for z in range(z0, z1 + 1):
                edge = x in (x0, x0 + w - 1) or z in (z0, z1)
                for y in range(th):
                    if x in GX and y < gh + 1: continue
                    r_ = L['foot'] if y < foot_h else 'bricks' if (y % 4 == 3) else L['body'] if z == z0 or x in (x0, x0 + w - 1) else 'stone'
                    if y == th - 1 and not edge: r_ = 'tiles'
                    if slit and z == z0 and x == cx and y in (th - 3, th - 7) and y > gh + 1:
                        put(x, y, z, r_, [0, 0, 0, .36, 1, 1]); put(x, y, z, r_, [.64, 0, 0, 1, 1, 1]); put(x, y, z, 'stone', [.3, 0, .7, .7, 1, 1]); continue
                    put(x, y, z, r_)
                if edge and not roof and ((x + z) % 2 == 0): put(x, th, z, L['body'])
                elif edge and not roof: put(x, th, z, 'stone', [0, 0, 0, 1, .4, 1])
        if roof:
            k = 0
            while True:
                xa, xb, za, zb = x0 - 1 + k, x0 + w - k, z0 - 1 + k, z1 + 1 - k
                if xa > xb or za > zb: break
                for x in range(xa, xb + 1):
                    for z in range(za, zb + 1):
                        if k == 0: put(x, th, z, 'roof', [0, .5, 0, 1, 1, 1])
                        else: put(x, th + 2 * k - 1, z, 'roof'); put(x, th + 2 * k, z, 'roof')
                k += 1
            return th + 2 * k
        return th + 1
    if L.get('towers') and not L.get('gatehouse'):
        tower(0, 3, L['tower_h'], -1, max(T_, 2), L.get('roof'))
    if L.get('gatehouse'):
        g_h = L['gatehouse']; zb = max(T_, 3)
        tower(g0 - 3, 3, g_h, -2, zb, L.get('roof')); tower(g0 + 3, 3, g_h, -2, zb, L.get('roof'))
        for x in GX:                                            # bridge between the gate towers
            for z in range(-1, zb):
                for y in range(gh + 1, g_h - 3):
                    put(x, y, z, 'rein' if L.get('rein') and z == -1 and y < gh + 3 else 'bricks' if y % 4 == 3 else L['body'] if z == -1 else 'stone')
            put(x, g_h - 3, -1, L['body']) if x != g0 + 1 else put(x, g_h - 3, -1, 'stone', [0, 0, 0, 1, .4, 1])
        tower(0 if not L.get('keep_tower') else -1, 3 if not L.get('keep_tower') else 4, L['tower_h'], -1 if not L.get('keep_tower') else -2, max(T_, 2), L.get('roof'))
        tower(W - 3, 3, L['tower_h'] - (2 if L.get('keep_tower') else 0), -1, max(T_, 2), L.get('roof'))
    if L.get('banners'):
        zf = -2 if L.get('gatehouse') else front
        for x in (g0 - 2, g0 + 4):
            top = L['gatehouse'] - 2
            for y in range(top - 3, top): put(x, y, zf - 1, 'banner', [.15, 0, .86, .85, 1, .94])
        if L['n'] >= 10:
            for x in (7, W - 8):
                for y in range(h - 4, h - 1): put(x, y, front - 1, 'banner', [.15, 0, .86, .85, 1, .94])
    return B

if __name__ == '__main__':
    build_textures()
    for L in LEVELS: print(L['n'], L['name'], len(section(L)), 'pieces')
