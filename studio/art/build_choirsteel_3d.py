"""Choirsteel armour in 3D (Mateo, 2026-11-11: "make it more 3D"), built the way studio/build_varmor.py
builds the vanilla sets: the flat armour layers become the base boxes, and extra boxes stand off them.

  Helm      a crest of three Choir crystals, and a Gloamquill plume on the right
  Cuirass   angular pauldrons, each with a crystal shard rising from it
  Greaves   knee cops with a blue gem
  Treads    quill fins at the heels (you fall like a quill)

Armour trims (Mateo: any trim, any colour, on Choirsteel): the game lays a trim's 64x32 texture over the
model by UV, so both textures keep the vanilla 64x32 armour layout exactly and the extra boxes are tucked into
the corners vanilla leaves empty (the hat area, and x 56-63 beside the arms). A 128x64 sheet would put every
trim in the wrong place. The items carry minecraft:trimmable_armors (studio/bestiary/choirsteel.py).

Writes textures/models/siege_armor/choirsteel_1.png (helm, cuirass, treads) and choirsteel_2.png (greaves),
models/entity/armor/choirsteel_<piece>.geo.json, and repoints attachables/choirsteel_<piece>.json.
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
    "leggings": {"body": [cube([-4, 12, -2], [8, 12, 4], [16, 16], 0.5)],
                 "rightLeg": [cube([-3.9, 0, -2], [4, 12, 4], [0, 16], 0.5)], "leftLeg": [cube([-0.1, 0, -2], [4, 12, 4], [0, 16], 0.5, True)]},
    "boots": {"rightLeg": [cube([-3.9, 0, -2], [4, 12, 4], [0, 16], 1)], "leftLeg": [cube([-0.1, 0, -2], [4, 12, 4], [0, 16], 1, True)]},
}
# Extra boxes and where their pixels live, in the corners the 64x32 armour layout leaves empty.
# Odd sizes where it matters, per Mateo's "work in odd numbers".
CREST, PLUME, PAULDRON, SHARD, FIN, KNEE = [32, 10], [56, 16], [32, 0], [36, 10], [40, 10], [32, 0]
EXTRAS = {
    "helmet": {"head": [cube([-2.5, 33, 0.5], [1, 3, 1], CREST), cube([-0.5, 33, 0.5], [1, 5, 1], CREST), cube([1.5, 33, 0.5], [1, 3, 1], CREST),   # crystal crest
                        cube([5, 29, -0.5], [1, 7, 3], PLUME)]},                                                                                    # Gloamquill plume
    "chestplate": {"rightArm": [cube([-10, 21.5, -3.5], [7, 3, 7], PAULDRON), cube([-7.5, 24.5, -0.5], [1, 3, 1], SHARD)],
                   "leftArm": [cube([3, 21.5, -3.5], [7, 3, 7], PAULDRON, 0, True), cube([6.5, 24.5, -0.5], [1, 3, 1], SHARD, 0, True)]},  # pauldrons + shards
    "leggings": {"rightLeg": [cube([-3.4, 6, -3.6], [3, 3, 1], KNEE)], "leftLeg": [cube([0.4, 6, -3.6], [3, 3, 1], KNEE, 0, True)]},     # knee cops
    "boots": {"rightLeg": [cube([-2.4, 0.5, 3], [1, 3, 3], FIN)], "leftLeg": [cube([1.4, 0.5, 3], [1, 3, 3], FIN, 0, True)]},          # heel fins
}
LAYER = {"helmet": 1, "chestplate": 1, "boots": 1, "leggings": 2}

def noisy(c, amt=5):
    n = rnd.randint(-amt, amt); return tuple(max(0, min(255, x + n)) for x in c)
def bevel(f, x, y, w, h, ramp=CHOIR, mid=3):
    if f == "up": i = mid + 1
    elif f == "down": i = mid - 2
    elif y == 0 or x == 0: i = mid + 2
    elif x == w - 1 or y == h - 1: i = mid - 2
    else: i = mid
    return noisy(ramp[max(0, min(len(ramp) - 1, i))]) + (255,)

def extra_px(piece, uv, f, x, y, w, h):
    if piece == "leggings":                                 # knee cop with a gem
        if f == "north": return (BLUE[3] if (x, y) == (1, 1) else CHOIR[4] if y == 0 else CHOIR[3]) + (255,)
        return bevel(f, x, y, w, h)
    if uv in (CREST, SHARD):                     # crystals: pale at the tip, deep at the root
        return BLUE[max(1, 5 - y)] + (255,) if f not in ("up", "down") else BLUE[5 if f == "up" else 1] + (255,)
    if uv == PLUME:                                      # the quill: dark vane, magenta vein down the middle
        if f in ("east", "west") and x == 1: return VEIN + (255,)
        return QUILL[1 + (x + y) % 3] + (255,) if f not in ("up", "down") else QUILL[0] + (255,)
    if uv == PAULDRON:                                     # pauldrons: plate with a blue band at the hem
        if f not in ("up", "down") and y == h - 1: return BLUE[4 if x % 2 else 3] + (255,)
        return bevel(f, x, y, w, h)
    if uv == FIN:                                     # heel fin, quill-dark with a blue edge
        if f in ("east", "west") and y == 0: return BLUE[4] + (255,)
        return QUILL[2 + (x % 2)] + (255,)

def texture(layer):
    im = Image.open(RP + f'textures/models/armor/choirsteel_layer_{layer}.png').convert('RGBA'); px = im.load()
    assert im.size == (64, 32)
    painted = set()
    for piece, bones in EXTRAS.items():
        if LAYER[piece] != layer: continue
        for cs in bones.values():
            for c in cs:
                w, h, d = c["size"]
                for f, (x0, y0, fw, fh) in faces(c["uv"][0], c["uv"][1], w, h, d).items():
                    for y in range(fh):
                        for x in range(fw):
                            at = (x0 + x, y0 + y)
                            assert at in painted or px[at][3] == 0, f"extra box would paint over the armour layer at {at}"
                            px[at] = extra_px(piece, c["uv"], f, x, y, fw, fh); painted.add(at)
    return im

VIS = {"helmet": "variable.helmet_layer_visible = 0.0;", "chestplate": "variable.chest_layer_visible = 0.0;",
       "leggings": "variable.leg_layer_visible = 0.0;", "boots": "variable.boot_layer_visible = 0.0;"}
def geometry(piece):
    bones = {k: list(v) for k, v in BASE[piece].items()}
    for b, cs in EXTRAS[piece].items(): bones.setdefault(b, []).extend(cs)
    return {"format_version": "1.12.0", "minecraft:geometry": [{"description": {"identifier": f"geometry.siege_choirsteel_{piece}",
            "texture_width": 64, "texture_height": 32, "visible_bounds_width": 3, "visible_bounds_height": 3, "visible_bounds_offset": [0, 1.5, 0]},
            "bones": [{"name": n, "pivot": PIV[n], "cubes": cs} for n, cs in bones.items()]}]}

if __name__ == '__main__':
    for layer in (1, 2): texture(layer).save(RP + f'textures/models/siege_armor/choirsteel_{layer}.png')
    for piece in BASE:
        json.dump(geometry(piece), open(RP + f'models/entity/armor/choirsteel_{piece}.geo.json', 'w'), indent=1)
        p = RP + f'attachables/choirsteel_{piece}.json'; att = json.load(open(p)); d = att["minecraft:attachable"]["description"]
        d["textures"]["default"] = f"textures/models/siege_armor/choirsteel_{LAYER[piece]}"; d["geometry"]["default"] = f"geometry.siege_choirsteel_{piece}"
        d["scripts"]["parent_setup"] = VIS[piece]
        json.dump(att, open(p, 'w'), indent=1)
    print('Choirsteel 3D: texture, 4 geos, 4 attachables')
