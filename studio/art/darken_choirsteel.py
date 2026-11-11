"""Choirsteel a darker purple (Mateo, 2026-11-11: "I want it to be a darker shade of purple").
Swaps the old pale-violet ramp for the darker one, colour for colour, in the nine item icons and the
two worn armour sheets; the blue gems and grips are left alone. Safe to re-run (already-dark files
have nothing to swap). build_choirsteel.py paints with the dark ramp from now on.
Run from the repo root:  python3 studio/art/darken_choirsteel.py
"""
from PIL import Image
OLD = ['#241640', '#42287a', '#6a44b0', '#9a74dc', '#c4a8f4', '#ece0ff']
NEW = ['#120a22', '#22123f', '#3a1f6a', '#552f94', '#7446b8', '#9a72d6']
hx = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
SWAP = {hx(a): hx(b) for a, b in zip(OLD, NEW)}
T = 'Siege_Nights_RP/textures/'
FILES = [f'items/siege_choirsteel_{k}.png' for k in ('helmet', 'chestplate', 'leggings', 'boots', 'sword', 'pickaxe', 'axe', 'shovel', 'hoe')] \
      + [f'models/armor/choirsteel_layer_{n}.png' for n in (1, 2)]
for f in FILES:
    im = Image.open(T + f).convert('RGBA'); px = im.load(); n = 0
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a and (r, g, b) in SWAP: px[x, y] = SWAP[(r, g, b)] + (a,); n += 1
    im.save(T + f); print(f, n, 'pixels')
