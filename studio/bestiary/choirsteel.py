# Choirsteel gear: the armour, weapons and tools made from the Hollow's ore (siege:choirsteel_ingot).
# Made like netherite gear (Mateo, 2026-11-11): at a smithing table, a netherite piece + a Choirsteel
# Upgrade template + Tempered Choirsteel (4 ingots and a Gloamquill). The template is found only at the
# Cold Forge in the Hollow (scripts/undertow/forge.js) and is copied at a crafting table with 7 netherite
# ingots and a block of Veinstone, the way vanilla copies its templates with diamonds.
# Writes items, recipes, attachables, placeholder icons and armour layers, lang lines.
# What the gear DOES (set bonus, Chord, Sounding) is in scripts/bestiary/choirsteel.js.
# Run:  python3 studio/bestiary/choirsteel.py   (from the repo root). Safe to re-run.
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from build import write, save_tex, merge_lang, armor_tex, RP, BP

# id, name, kind, netherite base, stats
ARMOUR = [
    ("helmet", "Choirsteel Helm", "head", "armor_head", 3, 610),
    ("chestplate", "Choirsteel Cuirass", "chest", "armor_torso", 8, 890),
    ("leggings", "Choirsteel Greaves", "legs", "armor_legs", 6, 830),
    ("boots", "Choirsteel Treads", "feet", "armor_feet", 3, 720),
]
TOOLS = [  # id, name, damage, enchant slot, item tag, block tag it digs
    ("sword", "Choirsteel Blade", 9, "sword", "minecraft:is_sword", None),
    ("pickaxe", "Choirsteel Pick", 7, "pickaxe", "minecraft:is_pickaxe", "minecraft:is_pickaxe_item_destructible"),
    ("axe", "Choirsteel Axe", 8, "axe", "minecraft:is_axe", "minecraft:is_axe_item_destructible"),
    ("shovel", "Choirsteel Spade", 6, "shovel", "minecraft:is_shovel", "minecraft:is_shovel_item_destructible"),
    ("hoe", "Choirsteel Hoe", 5, "hoe", "minecraft:is_hoe", "minecraft:is_hoe_item_destructible"),
]
TEMPLATE, TEMPERED = "siege:choirsteel_upgrade_template", "siege:tempered_choirsteel"
# The two new materials: id, name, icon key, item tags (the smithing table only takes items tagged for it)
MATERIALS = [
    (TEMPLATE, "Choirsteel Upgrade", "siege_choirsteel_upgrade_template", ["minecraft:transform_templates"]),
    (TEMPERED, "Tempered Choirsteel", "siege_choirsteel_tempered", ["minecraft:transform_materials"]),
]
TOOL_DURABILITY, DIG_SPEED, ENCHANT = 3000, 11, 22  # netherite: 2031, 9, 15
REPAIR = {"repair_items": [{"items": ["siege:choirsteel_ingot"], "repair_amount": "q.max_durability * 0.25"}]}

def base(iid, group):
    return {"minecraft:icon": "siege_choirsteel_" + iid, "minecraft:display_name": {"value": f"item.siege:choirsteel_{iid}.name"},
            "minecraft:max_stack_size": 1, "minecraft:repairable": REPAIR, "minecraft:glint": False}, \
           {"identifier": "siege:choirsteel_" + iid, "menu_category": {"category": "equipment", "group": f"minecraft:itemGroup.name.{group}"}}

def item(desc, comp):
    return {"format_version": "1.21.60", "minecraft:item": {"description": desc, "components": comp}}

def recipe(iid, netherite):
    # Smithing table, like the netherite upgrade: template + the netherite piece + Tempered Choirsteel.
    # Enchantments and the item's name carry over, as they do for netherite.
    return {"format_version": "1.20.10", "minecraft:recipe_smithing_transform": {
        "description": {"identifier": f"siege:choirsteel_{iid}_recipe"}, "tags": ["smithing_table"],
        "template": TEMPLATE, "base": netherite, "addition": TEMPERED, "result": "siege:choirsteel_" + iid}}

def material_recipes():
    tempered = {"format_version": "1.20.10", "minecraft:recipe_shapeless": {
        "description": {"identifier": "siege:tempered_choirsteel_recipe"}, "tags": ["crafting_table"],
        "ingredients": [{"item": "siege:choirsteel_ingot", "count": 4}, {"item": "siege:gloamquill"}],
        "result": {"item": TEMPERED, "count": 1}, "unlock": [{"item": "siege:choirsteel_ingot"}]}}
    # Vanilla copies a netherite template with 7 diamonds and netherrack; ours takes 7 netherite ingots and Veinstone.
    copy = {"format_version": "1.20.10", "minecraft:recipe_shaped": {
        "description": {"identifier": "siege:choirsteel_upgrade_template_copy"}, "tags": ["crafting_table"],
        "pattern": ["NTN", "NVN", "NNN"],
        "key": {"N": {"item": "minecraft:netherite_ingot"}, "T": {"item": TEMPLATE}, "V": {"item": "siege:veinstone"}},
        "result": {"item": TEMPLATE, "count": 2}, "unlock": [{"item": TEMPLATE}]}}
    return {"tempered_choirsteel": tempered, "choirsteel_upgrade_template_copy": copy}

def attachable(iid):
    # 3D since 2026-11-11: geometry and the 128x64 texture come from studio/art/build_choirsteel_3d.py
    var = {"helmet": "helmet", "chestplate": "chest", "leggings": "leg", "boots": "boot"}[iid]
    return {"format_version": "1.10.0", "minecraft:attachable": {"description": {"identifier": "siege:choirsteel_" + iid,
        "materials": {"default": "armor", "enchanted": "armor_enchanted"},
        "textures": {"default": "textures/models/siege_armor/choirsteel", "enchanted": "textures/misc/enchanted_actor_glint"},
        "geometry": {"default": f"geometry.siege_choirsteel_{iid}"}, "scripts": {"parent_setup": f"variable.{var}_layer_visible = 0.0;"},
        "render_controllers": ["controller.render.armor"]}}}

# ---------- placeholder icons (the textures thread paints the real ones) ----------
PAL = {"o": (30, 16, 58), "d": (84, 44, 150), "m": (132, 84, 208), "h": (196, 160, 250), "g": (150, 232, 255), "s": (70, 52, 44), "t": (112, 86, 66)}
ICONS = {
 "helmet": ["................", "................", "....oooooooo....", "...ohhhmmmmdo...", "..ohhmmmmmmddo..", "..ohmmmggmmddo..", "..ommmmggmmddo..", "..ommdooooddmo..",
            "..ommo....omdo..", "..omdo....oddo..", "..oddo....oddo..", "...oo......oo...", "................", "................", "................", "................"],
 "chestplate": ["................", ".ooo......ooo...", "ohhmo....ommdo..", "ohmmmoooommmdo..", "ommmmmmmmmmddo..", ".oommmggmmddoo..", "..ohmmggmmddo...", "..ohmmmmmmddo...",
                "..ommmmmmmddo...", "..ommmmmmdddo...", "..ommmmmddddo...", "..omddddddddo...", "...oooooooooo...", "................", "................", "................"],
 "leggings": ["................", "...oooooooooo...", "..ohhmmggmmddo..", "..ohmmmmmmmddo..", "..ommmmmmmmddo..", "..ommmdoodmmdo..", "..ommdo..omddo..", "..ommdo..omddo..",
              "..ommdo..omddo..", "..ommdo..omddo..", "..omddo..odddo..", "..omddo..odddo..", "..oddo....oddo..", "...oo......oo...", "................", "................"],
 "boots": ["................", "................", "................", "................", "..oooo....oooo..", "..ohmo....ohmo..", "..ommo....ommo..", "..ommo....ommo..",
           "..ogmo....ogmo..", "..ommoo...ommoo.", "..ommmdo..ommmdo", "..omdddo..omdddo", "..oooooo..oooooo", "................", "................", "................"],
 "sword": ["................", ".............ooo", "............ohho", "...........ohgmo", "..........ohgmo.", ".........ohgmo..", "........ohgmo...", ".......ohgmo....",
           "..oo..ohgmo.....", "..omoohmmo......", "...omdmmo.......", "....oddo........", "...otsodo.......", "..otso.omo......", ".oddo...oo......", ".ooo............"],
 "pickaxe": ["................", "....oooooooo....", "...ohhhmmmmmdo..", "..ohmoooooommdo.", "..oo.....otoomdo", ".........otso.oo", "........otso....", ".......otso.....",
             "......otso......", ".....otso.......", "....otso........", "...otso.........", "..otso..........", ".ogso...........", ".ooo............", "................"],
 "axe": ["................", "......oooo......", ".....ohhmmoo....", "....ohhmmmmto...", "...ohhmmmmotso..", "...ohmmmmotso...", "...ommmdotso....", "....oddotso.....",
         ".....ootso......", "......otso......", ".....otso.......", "....otso........", "...otso.........", "..ogso..........", "..ooo...........", "................"],
 "shovel": ["................", "...........ooo..", "..........ohhmo.", ".........ohmmmo.", ".........ommmdo.", "........otomdo..", ".......otsooo...", "......otso......",
            ".....otso.......", "....otso........", "...otso.........", "..otso..........", ".ogso...........", ".ooo............", "................", "................"],
 "hoe": ["................", "......ooooooo...", ".....ohhmmmmdo..", ".....ooootomdo..", "........otsooo..", ".......otso.....", "......otso......", ".....otso.......",
         "....otso........", "...otso.........", "..otso..........", ".ogso...........", ".ooo............", "................", "................", "................"],
}
# The template is a slate tablet like vanilla's, with a violet cuirass cut into it; Tempered Choirsteel is a folded plate.
PAL.update({"k": (24, 20, 30), "l": (52, 46, 62), "r": (78, 70, 90), "w": (232, 222, 255)})
MAT_ICONS = {
 "siege_choirsteel_upgrade_template": ["................", "...kkkkkkkkkk...", "..klllrrrrlllk..", "..klrrrrrrrrlk..", "..krrodrrdorrk..", "..krohmddmmork..", "..krommggmmork..", "..krrommmmmork..",
     "..krrommmmorrk..", "..krroddddorrk..", "..krrroooorrrk..", "..klrrrrrrrrlk..", "..kllrrrrrrllk..", "...kkkkkkkkkk...", "................", "................"],
 "siege_choirsteel_tempered": ["................", "................", "................", "................", "....oooooooo....", "...ohwhhhhhmo...", "..ohhmmggmmmdo..", "..ohmmmmmmmddo..",
     ".ohmmmmmmmmddo..", ".ommmmmmmmdddo..", ".oddddddddddo...", "..oooooooooo....", "................", "................", "................", "................"],
}

def icon(rows):
    im = Image.new("RGBA", (16, 16), (0, 0, 0, 0)); px = im.load()
    for y, row in enumerate(rows):
        for x, ch in enumerate(row[:16]):
            if ch in PAL: px[x, y] = PAL[ch] + (255,)
    return im

def main():
    lang, tex = [], {}
    for mid, name, key, tags in MATERIALS:
        write(BP + f"items/bestiary/{mid.split(':')[1]}.json", item({"identifier": mid, "menu_category": {"category": "items"}},
              {"minecraft:icon": key, "minecraft:display_name": {"value": f"item.{mid}.name"}, "minecraft:max_stack_size": 64,
               "minecraft:tags": {"tags": tags}}))
        lang.append(f"item.{mid}.name={name}")
    for rid, r in material_recipes().items(): write(BP + f"recipes/bestiary/{rid}.json", r)
    for iid, name, slot, ench, prot, dur in ARMOUR:
        comp, desc = base(iid, iid)
        comp.update({"minecraft:wearable": {"slot": f"slot.armor.{slot}", "protection": prot}, "minecraft:durability": {"max_durability": dur},
                     "minecraft:enchantable": {"slot": ench, "value": ENCHANT}, "minecraft:tags": {"tags": ["minecraft:is_armor", "minecraft:trimmable_armors", "siege:choirsteel"]}})
        write(BP + f"items/bestiary/choirsteel_{iid}.json", item(desc, comp))
        write(BP + f"recipes/bestiary/choirsteel_{iid}.json", recipe(iid, "minecraft:netherite_" + iid))
        write(RP + f"attachables/choirsteel_{iid}.json", attachable(iid))
        lang.append(f"item.siege:choirsteel_{iid}.name={name}")
    for iid, name, dmg, ench, tag, digs in TOOLS:
        comp, desc = base(iid, iid)
        comp.update({"minecraft:hand_equipped": True, "minecraft:damage": dmg, "minecraft:durability": {"max_durability": TOOL_DURABILITY},
                     "minecraft:enchantable": {"slot": ench, "value": ENCHANT}, "minecraft:can_destroy_in_creative": iid != "sword",
                     "minecraft:tags": {"tags": [tag, "minecraft:is_tool", "minecraft:netherite_tier", "siege:choirsteel"]}})
        if digs: comp["minecraft:digger"] = {"use_efficiency": True, "destroy_speeds": [{"block": {"tags": f"q.any_tag('{digs}')"}, "speed": DIG_SPEED}]}
        else: comp["minecraft:digger"] = {"use_efficiency": True, "destroy_speeds": [{"block": "minecraft:web", "speed": 15}, {"block": "minecraft:bamboo", "speed": 10}]}
        write(BP + f"items/bestiary/choirsteel_{iid}.json", item(desc, comp))
        write(BP + f"recipes/bestiary/choirsteel_{iid}.json", recipe(iid, "minecraft:netherite_" + iid))
        lang.append(f"item.siege:choirsteel_{iid}.name={name}")
    for iid, rows in ICONS.items():
        assert len(rows) == 16, iid
        save_tex(icon(rows), RP + f"textures/items/siege_choirsteel_{iid}.png")
        tex["siege_choirsteel_" + iid] = {"textures": f"textures/items/siege_choirsteel_{iid}"}
    for key, rows in MAT_ICONS.items():
        assert len(rows) == 16 and all(len(r) == 16 for r in rows), key
        save_tex(icon(rows), RP + f"textures/items/{key}.png")
        tex[key] = {"textures": f"textures/items/{key}"}
    for layer in (1, 2): save_tex(armor_tex((132, 84, 208)), RP + f"textures/models/armor/choirsteel_layer_{layer}.png")
    p = RP + "textures/item_texture.json"; it = json.load(open(p)); it["texture_data"].update(tex); write(p, it)
    merge_lang(RP + "texts/en_US.lang", lang)
    if os.path.exists(BP + "texts/en_US.lang"): merge_lang(BP + "texts/en_US.lang", lang)
    print(len(ARMOUR) + len(TOOLS) + len(MATERIALS), "Choirsteel items")

if __name__ == "__main__": main()
