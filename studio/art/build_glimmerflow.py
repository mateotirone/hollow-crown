"""Glimmerflow, the Hollow's light river, from Mateo's reference (art/reference/hollow-light-river.png):
deep blue-teal see-through water crossed by bright swirling threads of light, with a few lilac glints.
Writes a 16-frame vertical flipbook (16x256) and registers it in textures/flipbook_textures.json.
Tiles in every direction and loops seamlessly. Run: python3 build_glimmerflow.py"""
import json, math, os
from PIL import Image
RP = '/mnt/project-files/siege-nights/Siege_Nights_RP/'
N = 16
DEEP = [(22, 58, 104), (30, 84, 136), (44, 116, 168), (70, 152, 198)]            # body of the water, dark to light
THREAD = [(120, 200, 232), (176, 232, 250), (232, 250, 255)]                      # light threads, dim to core
LILAC = (196, 178, 255)
TAU = 2 * math.pi
def fields(x, y, t):
    u, v, p = x / 16 * TAU, y / 16 * TAU, t * TAU
    a = math.sin(u + 1.1 * math.sin(v + p))                                      # two long threads winding down the flow
    b = math.sin(v - u + 0.9 * math.sin(u + p) - p)                              # one fainter thread drifting across them
    body = 0.5 + 0.28 * math.sin(u - v + p) + 0.22 * math.sin(v + u - p)         # slow swell under the threads
    return a, b, body
strip = Image.new('RGBA', (16, 16 * N))
for f in range(N):
    for y in range(16):
        for x in range(16):
            a, b, body = fields(x + 0.5, y + 0.5, f / N)
            col = DEEP[max(0, min(3, int(body * 3.2)))]; alpha = 150 + int(body * 30)
            if abs(a) < 0.13: col, alpha = (THREAD[2] if a > 0 or (x + y) % 3 else THREAD[1]), 240
            elif abs(a) < 0.30: col, alpha = THREAD[0], 205
            elif abs(b) < 0.12: col, alpha = (LILAC if (x * 7 + y * 3 + f) % 13 == 0 else THREAD[1]), 215
            elif abs(b) < 0.22: col, alpha = DEEP[3], 190
            strip.putpixel((x, f * 16 + y), col + (alpha,))
strip.save(RP + 'textures/blocks/siege_glimmerflow.png')
p = RP + 'textures/flipbook_textures.json'
fb = json.load(open(p)) if os.path.exists(p) else []
fb = [e for e in fb if e.get('atlas_tile') != 'siege_glimmerflow'] + [{"flipbook_texture": "textures/blocks/siege_glimmerflow", "atlas_tile": "siege_glimmerflow", "ticks_per_frame": 4, "blend_frames": True}]
json.dump(fb, open(p, 'w'), indent=1)
print('glimmerflow done')
