"""3D held models for the player's weapons (Mateo, 2026-11-10: "What about weapons for players?").
For each weapon: a geo (models/entity/weapons/<id>.geo.json, per-face UV, 2 texels per unit), a painted texture
(textures/entity/siege/weapons/<id>.png) and an attachable so the model replaces the flat icon in the hand.
Model space: grip at the origin, blade up (+Y). The hold animations (animations/siege_weapons.animation.json) are a
first guess and UNTESTED in game: tune the offsets there, not in the geos.
Run: python3 build_weapons3d.py"""
import os, sys, json, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from palette import M, fixed
RP = '/mnt/project-files/siege-nights/Siege_Nights_RP/'
ICE = fixed('#2c4a66', '#4a7696', '#78a8c4', '#a8d0e4', '#d4ecf6', '#f4fcff')
BONE = fixed('#5a5244', '#857a66', '#b0a48c', '#d0c6ae', '#e8e0cc', '#f8f4e8')
BRAND = fixed('#1a0a0a', '#3a1210', '#5e1c16', '#84281c', '#a83a26', '#d05a3a')
OATH = fixed('#34485a', '#56707e', '#7e9aa6', '#a6c2ca', '#cde2e6', '#eef8f8')
MAT = dict(steel=M['steel'], iron=M['iron'], gold=M['gold'], leather=M['leather'], wood=M['dark_oak'], black=M['blacksteel'], ember=M['ember'], ice=ICE, bone=BONE, brand=BRAND, oath=OATH,
           string=fixed('#8a8474', '#a8a290', '#c4beac', '#dcd6c6', '#eee8dc', '#fbf8f0'))
S = 2   # texels per model unit

class Weapon:
    def __init__(s, wid): s.id = wid; s.cubes = []
    def box(s, x, y, z, w, h, d, mat, tone=0, rot=None, pivot=None):
        """Centred on x and z: box spans x-w/2..x+w/2, y..y+h, z-d/2..z+d/2."""
        s.cubes.append(dict(o=[x - w / 2, y, z - d / 2], s=[w, h, d], mat=mat, tone=tone, rot=rot, pivot=pivot)); return s
    def build(s):
        r = random.Random(sum(map(ord, s.id))); TW = TH = 64
        while True:                                         # shelf-pack every face; grow the sheet until it fits
            im = Image.new('RGBA', (TW, TH)); px = im.load(); x = y = rowh = 0; ok = True; out = []
            for c in s.cubes:
                w, h, d = c['s']; uv = {}; ramp = MAT[c['mat']]
                for face, (fw, fh) in dict(north=(w, h), south=(w, h), east=(d, h), west=(d, h), up=(w, d), down=(w, d)).items():
                    pw, ph = max(1, round(fw * S)), max(1, round(fh * S))
                    if x + pw > TW: x = 0; y += rowh; rowh = 0
                    if y + ph > TH: ok = False; break
                    base = 3 + c['tone'] + dict(north=0, south=-1, east=-1, west=0, up=1, down=-2)[face]
                    for j in range(ph):
                        for i in range(pw):
                            v = base + (1 if (i == 0 or j == 0) and pw > 2 and ph > 2 else 0) - (1 if (i == pw - 1 or j == ph - 1) and pw > 2 and ph > 2 else 0)
                            if pw > 3 and ph > 3 and r.random() < .12: v -= 1
                            px[x + i, y + j] = tuple(ramp[max(0, min(5, v))][:3]) + (255,)
                    uv[face] = {"uv": [x, y], "uv_size": [pw, ph]}; x += pw; rowh = max(rowh, ph)
                if not ok: break
                cube = {"origin": c['o'], "size": c['s'], "uv": uv}
                if c['rot']: cube["rotation"] = c['rot']; cube["pivot"] = c['pivot'] or [c['o'][0] + w / 2, c['o'][1] + h / 2, c['o'][2] + d / 2]
                out.append(cube)
            if ok: break
            TW *= 2; TH *= 2
        geo = {"format_version": "1.12.0", "minecraft:geometry": [{"description": {"identifier": f"geometry.siege_weapon_{s.id}", "texture_width": TW, "texture_height": TH,
               "visible_bounds_width": 3, "visible_bounds_height": 3, "visible_bounds_offset": [0, 1, 0]},
               "bones": [{"name": "weapon", "binding": "q.item_slot_to_bone_name(c.item_slot)", "pivot": [0, 24, 0], "cubes": out}]}]}
        json.dump(geo, open(RP + f'models/entity/weapons/{s.id}.geo.json', 'w'), indent=1)
        im.save(RP + f'textures/entity/siege/weapons/{s.id}.png')
        att = {"format_version": "1.10.0", "minecraft:attachable": {"description": {"identifier": "siege:" + s.id,
               "materials": {"default": "entity_alphatest", "enchanted": "entity_alphatest_glint"},
               "textures": {"default": f"textures/entity/siege/weapons/{s.id}", "enchanted": "textures/misc/enchanted_item_glint"},
               "geometry": {"default": f"geometry.siege_weapon_{s.id}"},
               "animations": {"first": "animation.siege_weapon.first_person", "third": "animation.siege_weapon.third_person"},
               "scripts": {"animate": [{"first": "c.is_first_person"}, {"third": "!c.is_first_person"}]},
               "render_controllers": ["controller.render.item_default"]}}}
        if HELD_3D: json.dump(att, open(RP + f'attachables/weapon_{s.id}.json', 'w'), indent=1)

# 2026-11-11: off. Two playtests showed the 3D held models in the wrong place (at the hip, then through the neck).
# Mateo wants weapons held exactly like vanilla, so the items use their flat icon with hand_equipped and no attachable.
# The models and textures are still written for the Texture Studio. Only turn this back on with an in-game test.
HELD_3D = False

def longsword():
    w = Weapon('longsword')
    w.box(0, -3, 0, 1, 6, 1, 'leather').box(0, -5, 0, 2, 2, 2, 'iron').box(0, 3, 0, 7, 1, 1.5, 'iron').box(-3.5, 2.5, 0, 1, 2, 1.5, 'iron', -1).box(3.5, 2.5, 0, 1, 2, 1.5, 'iron', -1)
    w.box(0, 4, 0, 2, 17, 1, 'steel').box(0, 4, 0, .6, 14, 1.2, 'steel', -1).box(0, 21, 0, 1, 2, 1, 'steel', 1); return w
def warhammer():
    w = Weapon('warhammer')
    w.box(0, -6, 0, 1, 23, 1, 'wood').box(0, -7, 0, 1.6, 1.5, 1.6, 'iron').box(0, -1, 0, 1.4, 4, 1.4, 'leather').box(0, 12, 0, 1.6, 1, 1.6, 'iron')
    w.box(0, 13, 0, 4, 5, 5, 'iron').box(0, 13.5, 3.5, 5, 4, 2, 'iron', 1).box(0, 14.5, -3.5, 2, 2, 2, 'iron', -1).box(0, 15, -5, 1, 1, 1, 'iron', 1).box(0, 18, 0, 1.6, 1.5, 1.6, 'iron'); return w
def minute_hand():
    """A sword made from the long hand of a great clock: gear for a guard, a spade-shaped swell, a needle point."""
    w = Weapon('minute_hand')
    w.box(0, -3, 0, 1, 6, 1, 'black').box(0, -5, 0, 2, 2, 2, 'gold').box(0, 3, 0, 5, 1, 5, 'gold')
    for x, z in ((3, 0), (-3, 0), (0, 3), (0, -3)): w.box(x, 3, z, 1, 1, 1, 'gold', -1)
    w.box(0, 4, 0, 1.4, 8, 1, 'gold').box(0, 12, 0, 3, 2, 1, 'gold').box(0, 14, 0, 4.5, 3, 1, 'gold', 1).box(0, 17, 0, 3, 2, 1, 'gold').box(0, 15, 0, 1.5, 1.5, 1.2, 'black')
    w.box(0, 19, 0, 1.6, 4, 1, 'gold').box(0, 23, 0, 1, 3, .8, 'gold', 1); return w
def kept_oath():
    w = Weapon('oath_of_oswin')
    w.box(0, -3.5, 0, 1.2, 7, 1.2, 'leather', -1).box(0, -5.5, 0, 2.4, 2, 2.4, 'gold').box(0, 3.5, 0, 9, 1.2, 1.6, 'gold').box(-4.5, 2.5, 0, 1.2, 1.5, 1.6, 'gold', -1).box(4.5, 2.5, 0, 1.2, 1.5, 1.6, 'gold', -1)
    w.box(0, 3.3, 0, 1.6, 1.6, 2, 'ice', 1)                                                    # the stone in the guard
    w.box(0, 4.7, 0, 3, 18, 1, 'oath').box(0, 4.7, 0, 1, 16, 1.25, 'oath', -2).box(0, 22.7, 0, 2, 2, 1, 'oath', 1).box(0, 24.7, 0, 1, 1.5, 1, 'oath', 2); return w
def warlords_brand():
    w = Weapon('warlords_brand')
    w.box(0, -3, 0, 1.4, 6, 1.4, 'black').box(0, -5, 0, 2.5, 2, 2.5, 'iron', -1).box(0, 3, 0, 6, 1.5, 2, 'black', 1)
    w.box(0, 4.5, 0, 4, 15, 1, 'brand').box(1.8, 5, 0, .8, 14, 1.2, 'ember', 1)                 # the cutting edge still glows
    for y in (8, 12, 16): w.box(-2.2, y, 0, .8, 1.5, 1, 'brand', -2)                            # notches on the back
    w.box(.5, 19.5, 0, 3, 2, 1, 'brand').box(1, 21.5, 0, 2, 1.5, 1, 'ember'); return w
def rimefang_bow():
    w = Weapon('rimefang_bow')
    w.box(0, -2, 0, 1.4, 4, 1.4, 'leather')
    for sgn in (1, -1):
        for i, (z, y, h) in enumerate(((0.6, 2, 3), (1.6, 4.5, 3), (2.8, 7, 3), (4.2, 9.5, 2.5))):
            w.box(0, (y if sgn > 0 else -y - h), -z, 1, h, 1.2, 'ice', (0, 0, 1, 1)[i])
        w.box(0, (12 if sgn > 0 else -13.5), -5.4, .8, 1.5, 1, 'bone', 1); w.box(0, (13 if sgn > 0 else -14.5), -6.6, .8, 1.5, .8, 'bone')
    w.box(0, -13, -5.6, .3, 26, .3, 'string'); return w

def animations():
    a = {"format_version": "1.8.0", "animations": {
        # Bound to the hand slot like the vanilla trident (pivot 24, grip near y 0); same pose numbers as its wield animations.
        # The first playtest showed the old unbound version floating at the hip, pointing backwards.
        "animation.siege_weapon.first_person": {"loop": True, "bones": {"weapon": {"position": [-7, -3, -2], "rotation": [152, -9, 25]}}},
        "animation.siege_weapon.third_person": {"loop": True, "bones": {"weapon": {"position": [1.5, -2.5, -10.5], "rotation": [97, -1.5, -49]}}}}}
    json.dump(a, open(RP + 'animations/siege_weapons.animation.json', 'w'), indent=1)

if __name__ == '__main__':
    for f in (longsword, warhammer, minute_hand, kept_oath, warlords_brand, rimefang_bow): f().build()
    if HELD_3D: animations()
    print('6 weapons')
