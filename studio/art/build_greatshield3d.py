"""Seneschal's Greatshield, held like a real shield (Mateo 2026-11-11: "im still just holding the shield").

Until now the Greatshield had no model, so the game showed its flat icon held out like any item. This gives it a
shield attachable copied from the vanilla shield (minecraft:shield in Mojang's bedrock-samples): the vanilla shield
model shape and the vanilla shield animations, so it sits on the arm in the off hand exactly like a vanilla shield
in first and third person. Custom items cannot truly block, so instead of the vanilla "blocking" query the raised
pose follows sneaking, which is what triggers the shield's brace (resistance and knockback, bestiary/relics.js).

    python3 studio/art/build_greatshield3d.py [repo root]

Writes textures/models/siege_greatshield.png (64x64, vanilla shield layout), models/entity/siege_greatshield.geo.json,
attachables/seneschal_greatshield.json and animation_controllers/siege_greatshield.animation_controllers.json (the
vanilla shield controller with query.blocking swapped for sneaking).
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from palette import M, fixed
from texlib import Tex, R

ROOT = (sys.argv[1].rstrip('/') + '/') if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) + '/'
RP = ROOT + 'Siege_Nights_RP/'
ASH = fixed('#16141a', '#2a282e', '#44424a', '#62606a', '#86848e', '#aeacb4')   # same ramps as the icon
EMBER, IRON, OAK = M['ember'], M['iron'], M['dark_oak']

# vanilla shield layout: plate 12x22x1 at uv 0,0 (front face x1-12 y1-22, back x14-25 y1-22), handle 2x6x6 at 26,0
t = Tex(64, 64)
W, H = 12, 22
for y in range(H):
    for x in range(W):
        rim = x in (0, W - 1) or y in (0, H - 1)
        if rim:
            c = R(ASH, 5 if x == 0 or y == 0 else 2)                       # lit top-left rim, shadowed bottom-right
        else:
            v = 3 + (1 if x == 1 or y == 1 else 0) - (1 if x == W - 2 or y == H - 2 else 0)
            v += (1 if (x * 3 + y * 5) % 11 == 0 else 0) - (1 if (x * 7 + y * 3) % 13 == 0 else 0)   # hammered face
            c = R(ASH, v)
            if x in (5, 6) and 2 <= y <= H - 3 or y in (7, 8) and 2 <= x <= W - 3:          # the ember cross
                c = R(EMBER, 4 if x == 5 or y == 7 else 3)
            if 4 <= x <= 7 and 6 <= y <= 9 and (x in (4, 7) or y in (6, 9)):                 # iron boss ring
                c = R(ASH, 5 if x == 4 or y == 6 else 2)
            if (x, y) in ((5, 7), (6, 8)): c = R(EMBER, 5)
        t.set(1 + x, 1 + y, c)
        # back: dark oak planks with two iron bands
        b = R(OAK, 2 + (1 if x % 4 == 0 else 0) - (1 if x % 4 == 3 else 0))
        if y in (4, 5, 16, 17): b = R(IRON, 3 if y in (4, 16) else 1)
        if rim: b = R(ASH, 2)
        t.set(14 + x, 1 + y, b)
for x in range(W):
    t.set(1 + x, 0, R(ASH, 4)); t.set(13 + x, 0, R(ASH, 1))                 # top and bottom edges
for y in range(H):
    t.set(0, 1 + y, R(ASH, 3)); t.set(13, 1 + y, R(ASH, 2))                 # side edges
for y in range(12):                                                          # leather-wrapped handle
    for x in range(26, 42): t.set(x, y, R(M['leather'], 2 + (1 if y % 3 == 0 else 0)))
os.makedirs(RP + 'textures/models', exist_ok=True)
t.save(RP + 'textures/models/siege_greatshield.png')

geo = {"format_version": "1.16.0", "minecraft:geometry": [{
    "description": {"identifier": "geometry.siege_greatshield", "texture_width": 64, "texture_height": 64},
    "bones": [{"name": "shield", "binding": "q.item_slot_to_bone_name(c.item_slot)", "pivot": [1.0, 15.5, 3.0],
               "cubes": [{"origin": [0.0, 25.0, 0.0], "size": [2.0, 6.0, 6.0], "uv": [26, 0]},
                         {"origin": [-5.0, 17.0, -1.0], "size": [12.0, 22.0, 1.0], "uv": [0, 0]}]}]}]}
with open(RP + 'models/entity/siege_greatshield.geo.json', 'w') as f: json.dump(geo, f, indent=2); f.write('\n')

ID = 'siege:seneschal_greatshield'
att = {"format_version": "1.10.0", "minecraft:attachable": {"description": {
    "identifier": ID,
    "materials": {"default": "entity_alphatest", "enchanted": "entity_alphatest_glint"},
    "textures": {"default": "textures/models/siege_greatshield", "enchanted": "textures/misc/enchanted_item_glint"},
    "geometry": {"default": "geometry.siege_greatshield"},
    "animations": {   # all vanilla shield animations
        "wield": "controller.animation.siege_greatshield.wield",
        "wield_main_hand_first_person": "animation.shield.wield_main_hand_first_person",
        "wield_off_hand_first_person": "animation.shield.wield_off_hand_first_person",
        "wield_main_hand_first_person_block": "animation.shield.wield_main_hand_first_person_blocking",
        "wield_off_hand_first_person_block": "animation.shield.wield_off_hand_first_person_blocking",
        "wield_third_person": "animation.shield.wield_third_person"},
    "scripts": {
        "initialize": [   # vanilla shield values
            "variable.main_hand_first_person_pos_x = 5.3;", "variable.main_hand_first_person_pos_y = 26.0;",
            "variable.main_hand_first_person_pos_z = 0.4;", "variable.main_hand_first_person_rot_x = 91.0;",
            "variable.main_hand_first_person_rot_y = 65.0;", "variable.main_hand_first_person_rot_z = -43.0;",
            "variable.off_hand_first_person_pos_x = -13.5;", "variable.off_hand_first_person_pos_y = -5.8;",
            "variable.off_hand_first_person_pos_z = 5.1;", "variable.off_hand_first_person_with_bow_pos_z = -25.0;",
            "variable.off_hand_first_person_rot_x = 1.0;", "variable.off_hand_first_person_rot_y = 176.0;",
            "variable.off_hand_first_person_rot_z = -2.5;"],
        "pre_animation": [   # braced (raised) while sneaking, like the vanilla shield in Bedrock
            f"variable.is_blocking_main_hand = query.is_sneaking && !query.is_item_name_any('slot.weapon.offhand', '{ID}') && query.is_item_name_any('slot.weapon.mainhand', '{ID}');",
            f"variable.is_blocking_off_hand = query.is_sneaking && query.is_item_name_any('slot.weapon.offhand', '{ID}');",
            "variable.is_using_bow = (query.get_equipped_item_name == 'bow') && (query.main_hand_item_use_duration > 0.0f);"],
        "animate": ["wield"]},
    "render_controllers": ["controller.render.item_default"]}}}
with open(RP + 'attachables/seneschal_greatshield.json', 'w') as f: json.dump(att, f, indent=2); f.write('\n')
BR = "query.is_sneaking"
ctrl = {"format_version": "1.10.0", "animation_controllers": {"controller.animation.siege_greatshield.wield": {
    "initial_state": "default", "states": {
        "default": {"animations": [{"wield_main_hand_first_person": "c.item_slot == 'main_hand'"},
                                   {"wield_off_hand_first_person": "c.item_slot != 'main_hand'"}],
                    "transitions": [{"blocking": BR}, {"third_person": "!c.is_first_person"}]},
        "blocking": {"animations": [{"wield_main_hand_first_person": "!variable.is_blocking_main_hand && c.item_slot == 'main_hand'"},
                                    {"wield_main_hand_first_person_block": "variable.is_blocking_main_hand && c.item_slot == 'main_hand'"},
                                    {"wield_off_hand_first_person": "!variable.is_blocking_off_hand && c.item_slot == 'off_hand'"},
                                    {"wield_off_hand_first_person_block": "variable.is_blocking_off_hand && c.item_slot == 'off_hand'"}],
                     "transitions": [{"default": "!" + BR}, {"third_person": "!c.is_first_person"}]},
        "third_person": {"animations": ["wield_third_person"], "transitions": [{"default": "c.is_first_person"}]}}}}}
os.makedirs(RP + 'animation_controllers', exist_ok=True)
with open(RP + 'animation_controllers/siege_greatshield.animation_controllers.json', 'w') as f: json.dump(ctrl, f, indent=2); f.write('\n')
print('ok')
