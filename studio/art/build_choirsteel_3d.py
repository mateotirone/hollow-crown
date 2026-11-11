"""Choirsteel armour in 3D (Mateo, 2026-11-11: "make it more 3D"), built the way studio/build_varmor.py
builds the vanilla sets: the flat armour layers become the base boxes, and extra boxes stand off them.

  Helm      a crest of three Choir crystals, and a Gloamquill plume on the right
  Cuirass   angular pauldrons, each with a crystal shard rising from it
  Greaves   knee cops with a blue gem
  Treads    quill fins at the heels (you fall like a quill)

Writes textures/models/siege_armor/choirsteel.png (128x64: layer 1 at the top, layer 2 below, the extras
from x 64), models/entity/armor/choirsteel_<piece>.geo.json, and repoints attachables/choirsteel_<piece>.json.
Run from the repo root:  python3 studio/art/build_choirsteel_3d.py   (re-run safe; reads the painted layers).
"""
import json, random
from PIL import Image
RP = 'Siege_Nights_RP/'
rnd = random.Random(11)
hx = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
CHOIR = [hx(h) for h in ('#120a22', '#22123f', '#3a1f6a', '#552f94', '#7446b8', '#9a72d6')]   # darker ramp, as darken_choirsteel.py
BLUE = [hx(h) for h in ('#2a3a78', '#5a5aa8', '#8494d8', '#a9c4ed', '#d4e6fa', '#f4faff')]
QUILL, VEIN = [hx(h) for h in ('#120a22', '#2a1640', '#3e2260', '#5a3484')], hx('#ff5fd0')

def faces(u, v, w, h, d):
    return {"up": (u + d, v, w, d), "down": (u + d + w, v, w, d), "east": (u, v + d, d, h), "north": (u + d, v + d, w, h),
            "west": (u + d + w, v + d, d, h), "south": (u + 2 * d + w, v + d, w, h)}
def cube(o, s, uv, inf=0, mir=False):
    c = {"origin": o, "size": s, "uv": uv}
    if inf: c["inflate"] = inf
    if mir: c["mirror"] = True
    return c
PIV = {"head": [0, 24, 0], "body": [0, 24, 0], "rightArm": [-5, 22, 0], "leftArm": [5, 22, 0], "rightLeg": [-1.9, 12, 0], "leftLeg": [1.9, 12, 0]}
BASE = {
    "helmet": {"head": [cube([-4, 24, -4], [8, 8, 8], [0, 0], 1)]},
    "chestplate": {"body": [cube([-4, 12, -2], [8, 12, 4], [16, 16], 1.01)],
                   "rightArm": [cube([-8, 12, -2], [4, 12, 4], [40, 16], 1)], "leftArm": [cube([4, 12, -2], [4, 12, 4], [40, 16], 1, True)]},
    "leggings": {"body": [cube([-4, 12, -2], [8, 12, 4], [16, 48], 0.5)],
                 "rightLeg": [cube([-3.9, 0, -2], [4, 12, 4], [0, 48], 0.5)], "leftLeg": [cube([-0.1, 0, -2], [4, 12, 4], [0, 48], 0.5, True)]},
    "boots": {"rightLeg": [cube([-3.9, 0, -2], [4, 12, 4], [0, 16], 1)], "leftLeg": [cube([-0.1, 0, -2], [4, 12, 4], [0, 16], 1, True)]},
}
# Extra boxes and where their pixels live (x 64 and up). Odd sizes where it matters, per Mateo's "work in odd numbers".
EXTRAS = {
    "helmet": {"head": [cube([-2.5, 33, 0.5], [1, 3, 1], [64, 0]), cube([-0.5, 33, 0.5], [1, 5, 1], [64, 0]), cube([1.5, 33, 0.5], [1, 3, 1], [64, 0]),   # crystal crest
                        cube([5, 29, -0.5], [1, 7, 3], [72, 0])]},                                                                                         # Gloamquill plume
    "chestplate": {"rightArm": [cube([-10, 21.5, -3.5], [7, 3, 7], [64, 16]), cube([-7.5, 24.5, -0.5], [1, 3, 1], [92, 16])],
                   "leftArm": [cube([3, 21.5, -3.5], [7, 3, 7], [64, 16], 0, True), cube([6.5, 24.5, -0.5], [1, 3, 1], [92, 16], 0, True)]},  # pauldrons + shards
    "leggings": {"rightLeg": [cube([-3.4, 6, -3.6], [3, 3, 1], [64, 32])], "leftLeg": [cube([0.4, 6, -3.6], [3, 3, 1], [64, 32], 0, True)]},     # knee cops
    "boots": {"rightLeg": [cube([-2.4, 0.5, 3], [1, 3, 3], [64, 40])], "leftLeg": [cube([1.4, 0.5, 3], [1, 3, 3], [64, 40], 0, True)]},          # heel fins
}

def noisy(c, amt=5):
    n = rnd.randint(-amt, amt); return tuple(max(0, min(255, x + n)) for x in c)
def bevel(f, x, y, w, h, ramp=CHOIR, mid=3):
    if f == "up": i = mid + 1
    elif f == "down": i = mid - 2
    elif y == 0 or x == 0: i = mid + 2
    elif x == w - 1 or y == h - 1: i = mid - 2
    else: i = mid
    return noisy(ramp[max(0, min(len(ramp) - 1, i))]) + (255,)

def extra_px(uv, f, x, y, w, h):
    if uv == [64, 0] or uv == [92, 16]:                     # crystals: pale at the tip, deep at the root
        return BLUE[max(1, 5 - y)] + (255,) if f not in ("up", "down") else BLUE[5 if f == "up" else 1] + (255,)
    if uv == [72, 0]:                                       # the quill: dark vane, magenta vein down the middle
        if f in ("east", "west") and x == 1: return VEIN + (255,)
        return QUILL[1 + (x + y) % 3] + (255,) if f not in ("up", "down") else QUILL[0] + (255,)
    if uv == [64, 16]:                                      # pauldrons: plate with a blue band at the hem
        if f not in ("up", "down") and y == h - 1: return BLUE[4 if x % 2 else 3] + (255,)
        return bevel(f, x, y, w, h)
    if uv == [64, 32]:                                      # knee cop with a gem
        if f == "north": return (BLUE[3] if (x, y) == (1, 1) else CHOIR[4] if y == 0 else CHOIR[3]) + (255,)
        return bevel(f, x, y, w, h)
    if uv == [64, 40]:                                      # heel fin, quill-dark with a blue edge
        if f in ("east", "west") and y == 0: return BLUE[4] + (255,)
        return QUILL[2 + (x % 2)] + (255,)

def texture():
    im = Image.new('RGBA', (128, 64), (0, 0, 0, 0))
    im.paste(Image.open(RP + 'textures/models/armor/choirsteel_layer_1.png').convert('RGBA'), (0, 0))
    im.paste(Image.open(RP + 'textures/models/armor/choirsteel_layer_2.png').convert('RGBA'), (0, 32))
    px = im.load()
    for bones in EXTRAS.values():
        for cs in bones.values():
            for c in cs:
                w, h, d = c["size"]
                for f, (x0, y0, fw, fh) in faces(c["uv"][0], c["uv"][1], w, h, d).items():
                    for y in range(fh):
                        for x in range(fw): px[x0 + x, y0 + y] = extra_px(c["uv"], f, x, y, fw, fh)
    return im

VIS = {"helmet": "variable.helmet_layer_visible = 0.0;", "chestplate": "variable.chest_layer_visible = 0.0;",
       "leggings": "variable.leg_layer_visible = 0.0;", "boots": "variable.boot_layer_visible = 0.0;"}
def geometry(piece):
    bones = {k: list(v) for k, v in BASE[piece].items()}
    for b, cs in EXTRAS[piece].items(): bones.setdefault(b, []).extend(cs)
    return {"format_version": "1.12.0", "minecraft:geometry": [{"description": {"identifier": f"geometry.siege_choirsteel_{piece}",
            "texture_width": 128, "texture_height": 64, "visible_bounds_width": 3, "visible_bounds_height": 3, "visible_bounds_offset": [0, 1.5, 0]},
            "bones": [{"name": n, "pivot": PIV[n], "cubes": cs} for n, cs in bones.items()]}]}

if __name__ == '__main__':
    texture().save(RP + 'textures/models/siege_armor/choirsteel.png')
    for piece in BASE:
        json.dump(geometry(piece), open(RP + f'models/entity/armor/choirsteel_{piece}.geo.json', 'w'), indent=1)
        p = RP + f'attachables/choirsteel_{piece}.json'; att = json.load(open(p)); d = att["minecraft:attachable"]["description"]
        d["textures"]["default"] = "textures/models/siege_armor/choirsteel"; d["geometry"]["default"] = f"geometry.siege_choirsteel_{piece}"
        d["scripts"]["parent_setup"] = VIS[piece]
        json.dump(att, open(p, 'w'), indent=1)
    print('Choirsteel 3D: texture, 4 geos, 4 attachables')
