"""Missing art, batch 2 (2026-11-10 audit): regional roof shingles,
a particle sprite sheet with four particle effects, and an uneasy moon.   python3 build_missing2.py [repo root]"""
import os, sys, json, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from palette import ramp, fixed, REGIONS
from texlib import *
ROOT = (sys.argv[1] if len(sys.argv) > 1 else '/mnt/project-files/siege-nights').rstrip('/') + '/'
RP = ROOT + 'Siege_Nights_RP/'

# ---- 1. roof shingles per region
def shingles(sl, seed=7, mossy=None, ragged=False):
    t = Tex(); r = random.Random(seed)
    for row in range(4):
        y0 = row * 4; off = 2 if row % 2 else 0
        for k in range(4):
            x0 = (k * 4 + off) % 16; tone = r.choice((2, 3, 3))
            for dy in range(4):
                for dx in range(4):
                    x = (x0 + dx) % 16; y = y0 + dy
                    v = tone + (1 if dy == 0 else 0) - (1 if dx == 3 else 0) - (1 if dy == 3 else 0)
                    if dy == 3 and dx in (0, 3): v = 0
                    if ragged and dy == 3 and r.random() < 0.3: v = 0
                    t.set(x, y, R(sl, v))
            t.set((x0 + 1) % 16, y0 + 3, R(sl, 1))
            if mossy and r.random() < 0.45: t.set((x0 + r.randrange(3)) % 16, y0 + r.randrange(1, 3), R(mossy, r.choice((2, 3))))
    return t
ROOFS = {'vale': (ramp('#4e5466', 0.08, 0.62, cool=0.06, warm=0.04), {}),                                  # blue slate, the default look
         'frostmarch': (ramp('#3a4252', 0.06, 0.58, cool=0.10, warm=0.02), dict(mossy=fixed('#8a96a8', '#a8b4c4', '#c8d2de', '#e4eaf0', '#f2f6fa', '#ffffff'))),   # dark slate, frost in the laps
         'saltreach': (ramp('#8a8474', 0.10, 0.70), dict(ragged=True)),                                     # silvered driftwood shakes
         'emberwaste': (ramp('#b0603a', 0.10, 0.70, warm=0.12), {}),                                        # fired clay
         'blackfen': (ramp('#4a4030', 0.06, 0.50), dict(mossy=REGIONS['blackfen']['foliage'], ragged=True))}  # dark thatch-shingle with moss
os.makedirs(RP + 'textures/blocks/regional', exist_ok=True); roofs = []
for i, (reg, (rp, kw)) in enumerate(ROOFS.items()):
    t = shingles(rp, seed=7 + i, **kw); t.save(RP + f'textures/blocks/regional/siege_roof_shingles_{reg}.png'); roofs.append(t.im.copy())

# ---- 2. Mateo's paintings: already in the game as textures/entity/portrait/plate_1..8.png (lore thread,
# studio/build_lore_portraits.py). Only shown on the sheet here, nothing is written.
plates = [Image.open(RP + f'textures/entity/portrait/plate_{n}.png').convert('RGBA') for n in range(1, 9)
          if os.path.exists(RP + f'textures/entity/portrait/plate_{n}.png')]

# ---- 3. particle sheet: 8 sprites of 8x8 on a 32x16 sheet
VI = fixed('#2a1250', '#4a1e88', '#7234c4', '#a05cf0', '#c896ff', '#ecd8ff'); MG = fixed('#3a0c38', '#6a1660', '#a0248c', '#d040b4', '#f078d4', '#ffc0ee')
BL = REGIONS['undertow']['accent']; PK = REGIONS['undertow']['glow_pink']; AS = fixed('#5c5468', '#6e6679', '#807889', '#928a9a', '#a59dab', '#bab3be')
SPR = {
 'mote':  (VI, ["........", "........", "...45...", "..4554..", "..3543..", "...33...", "........", "........"]),
 'spark': (MG, ["........", "...5....", "...4....", ".54554..", "...4....", "...3....", "........", "........"]),
 'glint': (BL, ["...5....", "...5....", "..454...", "5545455.", "..454...", "...5....", "...5....", "........"]),
 'ash':   (AS, ["........", "........", "..45....", "..345...", "...33...", "........", "........", "........"]),
 'spore': (PK, ["........", "..344...", ".34554..", ".35553..", ".34543..", "..333...", "........", "........"]),
 'ring':  (VI, ["..4444..", ".4....4.", "4......4", "4......4", "4......4", "4......4", ".4....4.", "..3333.."]),
 'ember': (fixed('#3a0606', '#701010', '#a82018', '#dc4024', '#f8843c', '#ffd070'), ["........", "........", "...5....", "..454...", "..343...", "...3....", "........", "........"]),
 'drip':  (MG, ["...4....", "...4....", "...4....", "..454...", "..454...", "..353...", "...3....", "........"]),
}
sheet = Image.new('RGBA', (32, 16), (0, 0, 0, 0)); UV = {}
for i, (k, (rp, rows)) in enumerate(SPR.items()):
    ox, oy = (i % 4) * 8, (i // 4) * 8; UV[k] = [ox, oy]
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != '.': sheet.putpixel((ox + x, oy + y), rp[int(ch)] + (255,))
os.makedirs(RP + 'textures/particle', exist_ok=True); sheet.save(RP + 'textures/particle/hc_particles.png')
def effect(name, sprite, life, size, speed, accel, rate, radius, fade=True):
    return {"format_version": "1.10.0", "particle_effect": {
        "description": {"identifier": f"siege:{name}", "basic_render_parameters": {"material": "particles_blend", "texture": "textures/particle/hc_particles"}},
        "components": {
            "minecraft:emitter_rate_instant": {"num_particles": rate},
            "minecraft:emitter_lifetime_once": {"active_time": 1},
            "minecraft:emitter_shape_sphere": {"radius": radius, "direction": "outwards"},
            "minecraft:particle_lifetime_expression": {"max_lifetime": life},
            "minecraft:particle_initial_speed": speed,
            "minecraft:particle_motion_dynamic": {"linear_acceleration": accel, "linear_drag_coefficient": 0.6},
            "minecraft:particle_appearance_billboard": {"size": [size, size], "facing_camera_mode": "lookat_xyz",
                "uv": {"texture_width": 32, "texture_height": 16, "uv": UV[sprite], "uv_size": [8, 8]}},
            "minecraft:particle_appearance_tinting": {"color": [1, 1, 1, "1 - variable.particle_age / variable.particle_lifetime" if fade else 1]}}}}
EFFECTS = [('hollow_mote', 'mote', "math.random(2, 4)", 0.08, 0.15, [0, 0.12, 0], 6, 1.5),      # drifts upward anywhere in the Hollow
           ('vein_spark', 'spark', "math.random(0.4, 0.9)", 0.10, 1.4, [0, -1.5, 0], 8, 0.2),  # Choir Ore struck, veins cracking
           ('glint', 'glint', "math.random(0.8, 1.6)", 0.09, 0.05, [0, 0, 0], 3, 0.6),         # crystals, Choirsteel, the Tuning Fork
           ('pale_ash', 'ash', "math.random(4, 7)", 0.07, 0.1, [0.15, -0.25, 0.05], 10, 3.0),   # falling ash in the wastes
           ('veil_spore', 'spore', "math.random(3, 6)", 0.10, 0.08, [0, 0.05, 0], 4, 1.2),     # under giant Veilcaps
           ('choir_ring', 'ring', "1.2", 0.35, 0.0, [0, 0.3, 0], 1, 0.0),                     # one note, sung
           ('moss_drip', 'drip', "math.random(0.8, 1.4)", 0.08, 0.0, [0, -4, 0], 1, 0.3, )]     # under hanging Veilmoss
os.makedirs(RP + 'particles', exist_ok=True)
for e in EFFECTS:
    json.dump(effect(*e), open(RP + f'particles/{e[0]}.particle.json', 'w'), indent=1)

# ---- 4. an uneasy moon: vanilla layout moon_phases (4 columns x 2 rows of 32x32), a hairline violet crack that grows toward the full moon
MOON = fixed('#3c3a4c', '#7c7a8c', '#aeb0be', '#d0d2dc', '#e8eaf0', '#f8f8fc')
mp = Image.new('RGBA', (128, 64), (0, 0, 0, 0))
CRACK = [(16, 9), (17, 11), (16, 13), (15, 15), (16, 17), (18, 19), (17, 21), (16, 23)]
for ph in range(8):
    ox, oy = (ph % 4) * 32, (ph // 4) * 32; lit = 1 - abs(ph - 0) / 4 if ph <= 4 else (ph - 4) / 4       # phase 0 full, 4 new
    for y in range(32):
        for x in range(32):
            dx, dy = x - 15.5, y - 15.5; d = math.hypot(dx, dy)
            if d > 10.5: continue
            edge = math.sqrt(max(0, 10.5 ** 2 - dy ** 2)); k = (1 - 2 * lit) * edge                           # terminator
            on = (dx > k) if ph <= 4 else (dx < -k)
            if not on:
                mp.putpixel((ox + x, oy + y), MOON[0] + (90,)); continue
            v = 4 - (1 if d > 8.5 else 0) - (1 if ((x * 7 + y * 13) % 23 < 3) else 0) + (1 if (dx < -3 and dy < -3 and d < 7) else 0)
            if (x // 3 + y // 3) % 5 == 0 and d < 8: v -= 1                                                    # maria
            mp.putpixel((ox + x, oy + y), MOON[max(1, min(5, v))] + (255,))
    n = round(len(CRACK) * lit)
    for (x, y) in CRACK[:n]:
        if mp.getpixel((ox + x, oy + y))[3] == 255: mp.putpixel((ox + x, oy + y), VI[3] + (255,))
os.makedirs(RP + 'textures/environment', exist_ok=True); mp.save(RP + 'textures/environment/moon_phases.png')

# ---- sheet
sh = Image.new('RGBA', (820, 560), (30, 28, 40, 255))
for i, im in enumerate(roofs): sh.alpha_composite(im.resize((96, 96), Image.NEAREST), (8 + i * 104, 8))
for i, im in enumerate(plates): sh.alpha_composite(im.resize((im.width * 2, im.height * 2), Image.NEAREST), (8 + (i % 4) * 200, 112 + (i // 4) * 136))
sh.alpha_composite(sheet.resize((256, 128), Image.NEAREST), (540, 8) if False else (8, 412))
sh.alpha_composite(mp.resize((512, 256), Image.NEAREST).crop((0, 0, 512, 140)), (290, 412))
sh.save(ROOT + 'art/missing-art-2.png'); print('ok', len(plates))
