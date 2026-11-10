"""Hollow Crown menu skin (Mateo, 2026-11-10: "What about UI textures?"). PROPOSAL, not wired into the game yet.
Paints nine-slice UI pieces to Siege_Nights_RP/textures/ui/hc/ and three mock-up screens to art/ui/
(Mason shop, town hall menu, NPC conversation) at 3x GUI scale for the Texture Studio.
Run: python3 build_ui.py"""
import os, sys, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw, ImageFont
from palette import M, REGIONS, fixed
RP = '/mnt/project-files/siege-nights/Siege_Nights_RP/'
UI = RP + 'textures/ui/hc/'; OUT = '/mnt/project-files/siege-nights/art/ui/'
SLATE = fixed('#120d18', '#1d1526', '#2a2036', '#3a2d4a', '#4d3e60', '#66567c')      # dark violet slate
BS = M['blacksteel']; GOLD = M['gold']; PARCH = M['parchment']
VEIN = fixed('#5a1848', '#8a2a6e', '#c040a0', '#e66ac4', '#f6a4de', '#ffe0f6')       # magenta glow
ICE = fixed('#3a2a6a', '#5a5aa8', '#8494d8', '#a9c4ed', '#d4e6fa', '#f4faff')
def c(r, i): return tuple(r[max(0, min(len(r) - 1, i))][:3]) + (255,)

def panel(w=48, h=48, seed=1):
    """Slate slab in a blacksteel frame, lit top-left, faint veins creeping in from two corners."""
    im = Image.new('RGBA', (w, h), c(SLATE, 2)); p = im.load(); r = random.Random(seed)
    for _ in range(w * h // 40):                                   # soft clustered mottling
        x, y = r.randrange(3, w - 4), r.randrange(3, h - 4); t = r.choice((1, 3))
        for dx in range(r.randrange(2, 5)): p[x + dx if x + dx < w - 3 else x, y] = c(SLATE, t)
    for i in range(w):
        for d, (a, b) in enumerate(((BS, 1), (BS, 4), (BS, 2))):
            p[i, d] = c(a, b if d != 1 else 4); p[i, h - 1 - d] = c(a, (0, 1, 2)[d])
    for j in range(h):
        for d in range(3):
            p[d, j] = c(BS, (1, 4, 2)[d]) if d <= j < h - d else p[d, j]
            p[w - 1 - d, j] = c(BS, (0, 1, 2)[d]) if d <= j < h - d else p[w - 1 - d, j]
    for i in range(3, w - 3): p[i, 3] = c(SLATE, 0)
    for j in range(3, h - 3): p[3, j] = c(SLATE, 0)
    for (x, y) in ((1, 1), (w - 2, 1), (1, h - 2), (w - 2, h - 2)): p[x, y] = c(GOLD, 4)   # corner rivets
    for (x0, y0, sx, sy) in ((4, h - 5, 1, -1), (w - 5, 4, -1, 1)):                         # veins
        x, y = x0, y0
        for k in range(9):
            p[x, y] = c(VEIN, 2 if k < 6 else 1)
            if r.random() < .5: x += sx
            else: y += sy
    return im

def plaque(w=32, h=16, hot=False):
    im = Image.new('RGBA', (w, h), c(SLATE, 4 if not hot else 3)); p = im.load()
    for i in range(w): p[i, 0] = c(SLATE, 5); p[i, h - 1] = c(SLATE, 0); p[i, h - 2] = c(SLATE, 2)
    for j in range(h): p[0, j] = c(SLATE, 5); p[w - 1, j] = c(SLATE, 1)
    if hot:
        for i in range(w): p[i, 0] = c(VEIN, 3); p[i, h - 1] = c(VEIN, 1)
        for j in range(h): p[0, j] = c(VEIN, 3); p[w - 1, j] = c(VEIN, 1)
        for (x, y) in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)): p[x, y] = c(VEIN, 5)
    return im

def tile(s=22, hot=False):
    im = Image.new('RGBA', (s, s), c(SLATE, 1)); p = im.load()
    for i in range(s): p[i, 0] = c(SLATE, 0); p[0, i] = c(SLATE, 0); p[i, s - 1] = c(SLATE, 4); p[s - 1, i] = c(SLATE, 4)
    if hot:
        for i in range(s): p[i, 0] = p[0, i] = p[i, s - 1] = p[s - 1, i] = c(VEIN, 3)
    return im

def parchment(w=48, h=32, seed=2):
    im = Image.new('RGBA', (w, h), c(PARCH, 4)); p = im.load(); r = random.Random(seed)
    for _ in range(w * h // 30):
        x, y = r.randrange(2, w - 4), r.randrange(2, h - 2)
        for dx in range(r.randrange(2, 4)): p[x + dx, y] = c(PARCH, 3)
    for i in range(w): p[i, 0] = c(PARCH, 5); p[i, h - 1] = c(PARCH, 1); p[i, h - 2] = c(PARCH, 2)
    for j in range(h): p[0, j] = c(PARCH, 5); p[w - 1, j] = c(PARCH, 1)
    for (x, y) in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (1, h - 1), (w - 1, h - 2)): p[x, y] = (0, 0, 0, 0)   # worn corners
    return im

def coin():
    g = ['..oooo..', '.oYYYYo.', 'oYyYYyYo', 'oYYccYYo', 'oYYccYYo', 'oYyYYydo', '.oYYddo.', '..oooo..']
    I_ = M['iron']; k = {'o': c(I_, 0), 'Y': c(I_, 4), 'y': c(I_, 5), 'c': c(I_, 2), 'd': c(I_, 2), '.': (0, 0, 0, 0)}   # the everyday iron coin
    im = Image.new('RGBA', (8, 8)); [im.putpixel((x, y), k[ch]) for y, row in enumerate(g) for x, ch in enumerate(row)]; return im

def nine(dst, src, box, m):
    """Draw src as a nine-slice into box=(x,y,w,h) with margin m (centre and edges tile)."""
    x0, y0, w, h = box; sw, sh = src.size
    xs = [(0, m, x0, m), (m, sw - m, x0 + m, w - 2 * m), (sw - m, sw, x0 + w - m, m)]
    ys = [(0, m, y0, m), (m, sh - m, y0 + m, h - 2 * m), (sh - m, sh, y0 + h - m, m)]
    for (sa, sb, dx, dw) in xs:
        for (ta, tb, dy, dh) in ys:
            piece = src.crop((sa, ta, sb, tb)); pw, ph = piece.size
            for yy in range(0, dh, ph):
                for xx in range(0, dw, pw):
                    dst.alpha_composite(piece.crop((0, 0, min(pw, dw - xx), min(ph, dh - yy))), (dx + xx, dy + yy))

FONT = ImageFont.load_default()
def text(im, xy, s, col, shadow=None):
    d = ImageDraw.Draw(im); d.fontmode = '1'
    if shadow: d.text((xy[0] + 1, xy[1] + 1), s, fill=shadow, font=FONT)
    d.text(xy, s, fill=col, font=FONT)
def tw(s): return int(ImageDraw.Draw(Image.new('RGBA', (1, 1))).textlength(s, font=FONT))
def icon(path, size=16):
    im = Image.open(RP + path).convert('RGBA')
    if im.height > im.width: im = im.crop((0, 0, im.width, im.width))
    return im.resize((size, size), Image.NEAREST)
WHITE = (236, 228, 240, 255); DIM = (150, 138, 168, 255); INK = (58, 40, 30, 255); PINK = c(VEIN, 4); SH = c(SLATE, 0)

def backdrop(w, h, rk='vale'):
    """A dimmed bit of world behind the menu, so it reads as an in-game screen."""
    st = Image.open(RP + 'textures/blocks/siege_castle_stone.png').convert('RGBA')
    im = Image.new('RGBA', (w, h))
    for y in range(0, h, 16):
        for x in range(0, w, 16): im.paste(st, (x, y))
    return Image.alpha_composite(im, Image.new('RGBA', (w, h), (10, 6, 16, 190)))

def header(im, box, title):
    x, y, w, h = box
    cr = icon('textures/items/siege_hollow_crown.png'); im.alpha_composite(cr, (x + w // 2 - 8, y - 9))
    text(im, (x + (w - tw(title)) // 2, y + 9), title, WHITE, SH)
    d = ImageDraw.Draw(im); d.line((x + 10, y + 22, x + w - 11, y + 22), fill=c(SLATE, 0)); d.line((x + 10, y + 23, x + w - 11, y + 23), fill=c(SLATE, 4))

def mason():
    W, H = 340, 220; im = backdrop(W, H); P = panel(); box = (40, 18, 260, 190); nine(im, P, box, 14); header(im, box, 'Mason of the Vale')
    text(im, (54, 46), '"Good stone outlasts good kings."', DIM)
    im.alpha_composite(coin(), (238, 47)); text(im, (249, 46), '42', c(M['iron'], 5), SH)
    tabs = ['Stone', 'Floors', 'Gates', 'Timber']; x = 54
    for i, t in enumerate(tabs):
        w = tw(t) + 12; nine(im, plaque(hot=i == 0), (x, 62, w, 15), 3); text(im, (x + 6, 64), t, WHITE if i == 0 else DIM, SH); x += w + 4
    stock = [('siege_castle_stone', 'Stone', 8), ('siege_castle_bricks', 'Bricks', 8), ('siege_castle_tiles', 'Tiles', 8), ('siege_castle_cobbled', 'Cobbled', 12), ('siege_castle_smooth', 'Smooth', 6),
             ('siege_mossy_castle_stone', 'Mossy', 8), ('siege_cracked_castle_stone', 'Cracked', 12), ('siege_roof_shingles', 'Shingles', 8), ('siege_timber_frame', 'Timber', 8), ('regional/siege_castle_gate_vale', 'Gate', 1)]
    for i, (f, nm, per) in enumerate(stock):
        tx, ty = 56 + (i % 5) * 47, 86 + (i // 5) * 44; hot = i == 1
        im.alpha_composite(tile(hot=hot), (tx + 6, ty)); im.alpha_composite(icon(f'textures/blocks/{f}.png'), (tx + 9, ty + 3))
        text(im, (tx + 17 - tw(nm) // 2, ty + 22), nm, WHITE if hot else DIM)
        text(im, (tx + 30, ty + 5), f'x{per}', c(M['iron'], 5) if hot else DIM)
    nine(im, plaque(hot=False), (54, 180, 150, 18), 3); im.alpha_composite(icon('textures/blocks/siege_foundation_stone_side.png', 12), (58, 183)); text(im, (74, 183), 'Foundation Stone', WHITE, SH)
    im.alpha_composite(coin(), (176, 185)); text(im, (186, 183), '25', c(M['iron'], 5), SH)
    nine(im, plaque(hot=True), (212, 180, 74, 18), 3); text(im, (212 + (74 - tw('Buy 8 for 1')) // 2, 183), 'Buy 8 for 1', WHITE, SH)
    return im

def townhall():
    W, H = 340, 220; im = backdrop(W, H); box = (70, 18, 200, 190); nine(im, panel(), box, 14); header(im, box, 'Town Hall')
    text(im, (84, 46), 'Millbrook   Wall level 5', DIM)
    rows = [('textures/blocks/siege_castle_stone.png', 'Raise the wall', 'Battlement Wall', True), ('textures/blocks/siege_oath_tree_crown.png', 'Tree of Oaths', '2 points to spend', False),
            ('textures/items/siege_ledger.png', 'Roster', '3 townsfolk', False), ('textures/items/siege_writ.png', 'Rumor Board', '1 new rumor', False), ('textures/items/siege_war_horn.png', 'Defences', 'Siege in 2 nights', False)]
    for i, (ic, a, b, hot) in enumerate(rows):
        y = 62 + i * 27; nine(im, plaque(hot=hot), (84, y, 172, 23), 3); im.alpha_composite(tile(18), (88, y + 2)); im.alpha_composite(icon(ic, 14), (90, y + 4))
        text(im, (112, y + 1), a, WHITE, SH); text(im, (112, y + 11), b, PINK if hot else DIM)
        if hot: im.alpha_composite(coin(), (226, y + 7)); text(im, (236, y + 6), '60', c(M['iron'], 5), SH)
    return im

def npc():
    W, H = 340, 220; im = backdrop(W, H)
    nine(im, parchment(), (30, 120, 280, 62), 4)
    nine(im, panel(40, 40, 3), (38, 92, 46, 46), 6)
    face = Image.open(RP + 'textures/entity/siege/man_at_arms_red.png').convert('RGBA').crop((8, 8, 16, 16)).resize((32, 32), Image.NEAREST); im.alpha_composite(face, (45, 99))
    nine(im, plaque(), (90, 108, tw('Brother Aldous') + 14, 15), 3); text(im, (97, 110), 'Brother Aldous', WHITE, SH)
    for i, ln in enumerate(['The bell rang twice last night. Nobody', 'was in the tower. I have stopped asking', 'who pulls the rope.']): text(im, (92, 128 + i * 12), ln, INK)
    for i, (t, hot) in enumerate((('Tell me about the bell.', True), ('I should go.', False))):
        w = 132; x = 34 + i * 140; nine(im, plaque(hot=hot), (x, 188, w, 18), 3); text(im, (x + (w - tw(t)) // 2, 191), t, WHITE, SH)
    return im

def build():
    os.makedirs(UI, exist_ok=True); os.makedirs(OUT, exist_ok=True)
    panel().save(UI + 'panel.png'); plaque().save(UI + 'button.png'); plaque(hot=True).save(UI + 'button_hover.png'); tile().save(UI + 'slot.png'); tile(hot=True).save(UI + 'slot_hover.png')
    parchment().save(UI + 'parchment.png'); coin().save(UI + 'coin.png')
    for nm, fn in (('mason', mason), ('townhall', townhall), ('npc', npc)):
        im = fn(); im.save(OUT + f'mockup_{nm}_1x.png'); im.resize((im.width * 3, im.height * 3), Image.NEAREST).save(OUT + f'mockup_{nm}.png')
    a = [Image.open(OUT + f'mockup_{n}.png') for n in ('mason', 'townhall', 'npc')]
    s = Image.new('RGBA', (a[0].width * 3 + 40, a[0].height), (20, 16, 24, 255))
    for i, im in enumerate(a): s.paste(im, (i * (im.width + 20), 0))
    s.save(OUT + 'mockups.png')

# ------------------------------------------------------------------ skill tree screens
import re
def skills():
    src = open('/mnt/project-files/siege-nights/Siege_Nights_BP/scripts/townhall/skills.js').read(); out = []
    for m in re.finditer(r'S\("(\w+)", "(\w+)", (\d), "([^"]+)", (\d), (\d), \["([^"]*)"\](?:, \{([^}]*)\})?', src):
        nd = re.search(r'needs: "(\w+)"', m.group(8) or '')
        out.append(dict(id=m.group(1), branch=m.group(2), ring=int(m.group(3)), name=m.group(4), max=int(m.group(5)), cost=int(m.group(6)), desc=m.group(7), needs=nd and nd.group(1), power='power: true' in (m.group(8) or '')))
    return out
STEEL = M['steel']; GREEN = fixed('#1c3a1c', '#2c5a2a', '#44843c', '#66ac52', '#96d07a', '#d0f0b4')
def rune(seed, col):
    """A small symmetric 7x7 sign standing in for a skill icon that is not painted yet."""
    r = random.Random(seed); im = Image.new('RGBA', (7, 7))
    for y in range(7):
        for x in range(4):
            if r.random() < (.62 if x == 3 else .42): im.putpixel((x, y), col); im.putpixel((6 - x, y), col)
    return im
def node(state, accent):
    """20x20 round socket. state: locked, open, some, full, unknown."""
    im = Image.new('RGBA', (20, 20)); p = im.load()
    rim = {'locked': c(SLATE, 4), 'open': c(GREEN, 3), 'some': c(accent, 3), 'full': c(GOLD, 4), 'unknown': c(SLATE, 3)}[state]
    for y in range(20):
        for x in range(20):
            d = ((x - 9.5) ** 2 + (y - 9.5) ** 2) ** .5
            if d < 7.6: p[x, y] = c(SLATE, 0 if state in ('locked', 'unknown') else 1)
            elif d < 9.6: p[x, y] = rim if (x + y) < 20 or state == 'locked' else tuple(int(v * .7) for v in rim[:3]) + (255,)
    return im
def tree_screen(branch, title, sub, accent, have, selected, unknown=()):
    W, H = 340, 220; im = backdrop(W, H); box = (8, 14, 324, 198); nine(im, panel(), box, 14); header(im, box, title)
    text(im, (22, 40), sub, DIM); pts = 'Skill points  3'; text(im, (318 - tw(pts), 40), pts, c(ICE, 3), SH)
    sk = [s for s in skills() if s['branch'] == branch]; pos = {}; d = ImageDraw.Draw(im)
    X0, X1, Y0 = 20, 212, 180
    for ring in range(1, 6):
        row = [s for s in sk if s['ring'] == ring]; y = Y0 - (ring - 1) * 30
        text(im, (X0 - 4, y - 4), ('I', 'II', 'III', 'IV', 'V')[ring - 1], c(SLATE, 5))
        for i, s_ in enumerate(row): pos[s_['id']] = (X0 + 24 + int((i + .5) * (X1 - X0 - 24) / len(row)), y)
    ring_open = 3                                                    # sample hero: hall tier 3
    def state(s_):
        if s_['id'] in unknown: return 'unknown'
        n = have.get(s_['id'], 0)
        if n >= s_['max']: return 'full'
        if n: return 'some'
        if s_['ring'] <= ring_open and (not s_['needs'] or have.get(s_['needs'])): return 'open'
        return 'locked'
    for s_ in sk:                                                    # links first, under the sockets
        if s_['needs'] in pos:
            (x1, y1), (x2, y2) = pos[s_['needs']], pos[s_['id']]; lit = have.get(s_['needs']) and state(s_) != 'unknown'
            col = c(accent, 2) if lit else c(SLATE, 4); my = (y1 + y2) // 2
            d.line((x1, y1, x1, my), fill=col); d.line((x1, my, x2, my), fill=col); d.line((x2, my, x2, y2), fill=col)
    for s_ in sk:
        x, y = pos[s_['id']]; st = state(s_); im.alpha_composite(node(st, accent), (x - 10, y - 10))
        if st == 'unknown': text(im, (x - 3, y - 6), '?', c(SLATE, 5))
        else:
            col = {'locked': c(SLATE, 4), 'open': WHITE, 'some': c(accent, 4), 'full': c(GOLD, 5)}[st]
            im.alpha_composite(rune(hash(s_['id']) % 9973 if False else sum(map(ord, s_['id'])), col), (x - 4, y - 4))
        if st in ('some', 'full'):
            t = f"{have[s_['id']]}/{s_['max']}"; text(im, (x + 7, y + 3), t, c(GOLD, 4) if st == 'full' else WHITE, SH)
        if s_['id'] == selected:
            d.rectangle((x - 12, y - 12, x + 11, y + 11), outline=c(VEIN, 3))
    # detail card
    s_ = next(q for q in sk if q['id'] == selected); st = state(s_); bx = (220, 54, 102, 148); nine(im, parchment(), bx, 4)
    nm = 'Unknown' if st == 'unknown' else s_['name']; text(im, (226, 58), nm, INK)
    text(im, (226, 70), f"Ring {('I', 'II', 'III', 'IV', 'V')[s_['ring'] - 1]}" + ('   Power' if s_['power'] and st != 'unknown' else ''), (120, 96, 70, 255))
    body = 'Something answers when you reach for it. You have not found where this comes from yet. Look for it out in the world.' if st == 'unknown' else s_['desc']
    words = body.split(); lines = ['']
    for w_ in words:
        if tw(lines[-1] + ' ' + w_) > 84: lines.append(w_)
        else: lines[-1] = (lines[-1] + ' ' + w_).strip()
    for i, ln in enumerate(lines[:8]): text(im, (226, 84 + i * 11), ln + (' ...' if i == 7 and len(lines) > 8 else ''), INK)
    lab = 'Not found yet' if st == 'unknown' else 'Mastered' if st == 'full' else f"Learn  {s_['cost']} point" + ('s' if s_['cost'] > 1 else '') if st in ('open', 'some') else 'Locked'
    nine(im, plaque(hot=st in ('open', 'some')), (226, 180, 90, 17), 3); text(im, (226 + (90 - tw(lab)) // 2, 183), lab, WHITE if st in ('open', 'some') else DIM, SH)
    return im

def oaths():
    W, H = 340, 220; im = backdrop(W, H); box = (30, 14, 280, 198); nine(im, panel(), box, 14); header(im, box, 'Tree of Oaths')
    text(im, (46, 40), 'Renown 14   Banneret', DIM); d = ImageDraw.Draw(im)
    d.rectangle((46, 54, 293, 59), fill=c(SLATE, 0)); d.rectangle((47, 55, 47 + 150, 58), fill=c(GREEN, 3)); text(im, (46, 62), 'Renown 20: Capstones open', DIM)
    pts = 'Skill points  3'; text(im, (294 - tw(pts), 40), pts, c(ICE, 3), SH)
    cards = [('Keep', 'Walls and guards', '7 sworn', 'textures/items/siege_writ.png', GREEN, True), ('Wayfarer', 'Road and horse', '4 sworn', 'textures/items/horses/siege_halter.png', ICE, True),
             ('Blade', 'Knights only', '9 sworn', 'textures/items/siege_longsword.png', STEEL, True), ('Arcana', 'Marked only', 'closed', 'textures/items/siege_hollow_ember.png', VEIN, False)]
    for i, (nm, blurb, sp, ic, acc, open_) in enumerate(cards):
        x = 44 + i * 64; nine(im, plaque(hot=i == 2), (x, 78, 60, 96), 3)
        im.alpha_composite(node('some' if open_ else 'locked', acc).resize((40, 40), Image.NEAREST), (x + 10, 84))
        try: icn = icon(ic, 16)
        except Exception: icn = icon('textures/items/siege_war_horn.png', 16)
        if not open_: icn = Image.eval(icn.convert('LA').convert('RGBA'), lambda v: v)
        im.alpha_composite(icn, (x + 22, 96))
        text(im, (x + (60 - tw(nm)) // 2, 128), nm, WHITE if open_ else DIM, SH)
        for k, ln in enumerate(blurb.replace(' and ', ' and|').split('|')): text(im, (x + (60 - tw(ln)) // 2, 140 + k * 10), ln.strip(), DIM)
        text(im, (x + (60 - tw(sp)) // 2, 162), sp, c(acc, 4) if open_ else c(SLATE, 5))
    for i, t in enumerate(('Recent deeds', 'Unbind skills', 'Close')):
        x = 44 + i * 86; nine(im, plaque(), (x, 184, 80, 17), 3); text(im, (x + (80 - tw(t)) // 2, 187), t, WHITE, SH)
    return im

def build_trees():
    kn = dict(blade_bash=3, blade_lunge=2, blade_constitution=3, blade_riposte=1, blade_mastery=2, blade_rally=1)
    so = dict(arc_bolt=3, arc_ward=2, arc_quiet=1, arc_blink=2, arc_bind=1, arc_ashen=1)
    shots = [('oaths', oaths()), ('knight', tree_screen('blade', 'Blade', 'Oathsworn   Squire of the Ashen Gate', STEEL, kn, 'blade_charge')),
             ('sorcerer', tree_screen('arcana', 'Arcana', 'Marked   Resonance 34', VEIN, so, 'arc_step', unknown=('arc_echo', 'arc_step', 'arc_choir', 'arc_hollowstep', 'arc_warden')))]
    for nm, im in shots:
        im.save(OUT + f'mockup_{nm}_1x.png'); im.resize((im.width * 3, im.height * 3), Image.NEAREST).save(OUT + f'mockup_{nm}.png')
    a = [im.resize((im.width * 3, im.height * 3), Image.NEAREST) for _, im in shots]
    s_ = Image.new('RGBA', (a[0].width * 3 + 40, a[0].height), (20, 16, 24, 255))
    for i, im in enumerate(a): s_.paste(im, (i * (im.width + 20), 0))
    s_.save(OUT + 'mockups_trees.png')
    for st in ('locked', 'open', 'some', 'full', 'unknown'): node(st, VEIN).save(UI + f'node_{st}.png')

if __name__ == '__main__': build(); build_trees()
