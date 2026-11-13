#!/usr/bin/env python3
"""The Codex items: every new armour set, weapon, tool, relic, charm and caravan good (Mateo, 2026-11-13,
thread "Add custom armor, items and a Codex"; proposal https://claude.ai/artifact/NZENzPP9D6kK7mpLQxciUK).

One list (SPEC below) makes everything:
  Siege_Nights_BP/items/codex/<id>.json                item files
  Siege_Nights_BP/scripts/codex/items_data.js          the same list for the scripts (names, hints, sources)
  Siege_Nights_RP/textures/items/codex/<id>.png        icons (stand-ins recoloured from an existing icon until
                                                       the texture thread paints the real one: an icon is only
                                                       written when the file is missing or still marked stand-in)
  Siege_Nights_RP/textures/models/siege_armor/<set>_<piece>.png + attachables/<set>_<piece>.json   worn armour
  Siege_Nights_RP/textures/item_texture.json, texts/en_US.lang (a marked block)
Rimeforged (Frostmarch) has finished art from the texture thread (studio/art/build_rimeforged.py): its icons,
3D models and attachables are left alone; only its item files and names are written here.

Run from anywhere:  python3 studio/build_codex.py
"""
import json, os, sys
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BP, RP = os.path.join(ROOT, "Siege_Nights_BP"), os.path.join(ROOT, "Siege_Nights_RP")
ICONS = os.path.join(RP, "textures/items")
STANDIN = os.path.join(ROOT, "studio/codex/standins.json")  # icons this script painted (the texture thread replaces them)

# ---------- palettes: dark -> light, for recolouring stand-in icons and worn sheets ----------
PAL = {
    "watch": ["#1d2430", "#3b4a5e", "#6f86a3", "#b8c8db", "#e9d48a"],
    "tide": ["#0d2a2e", "#1f5a5c", "#3f9590", "#8fd3c8", "#eaf6f2"],
    "sun": ["#3a1a08", "#7a3c12", "#c27424", "#eeb64a", "#fff0b8"],
    "fen": ["#141c12", "#2c3d22", "#4f6b33", "#94a85a", "#f4dc7a"],
    "oath": ["#1f1d22", "#4a4650", "#8a8494", "#c9c3cf", "#e8cf7a"],
    "gold": ["#2e1c06", "#6b4710", "#b88a24", "#efcf5c", "#fff5c4"],
    "bronze": ["#24150b", "#5a3418", "#97602c", "#d19a55", "#f6dcae"],
    "bell": ["#1c2a24", "#355446", "#5f8c6f", "#a3c9a0", "#e9d9a0"],
    "iron": ["#18191d", "#3a3c43", "#6c6f79", "#aeb1ba", "#e7e8ec"],
    "moon": ["#10142a", "#2a3466", "#5868b0", "#a7b4ee", "#f3f5ff"],
    "witch": ["#1a0f1e", "#3d2245", "#6e3f75", "#b07fb3", "#ead2e6"],
    "ash": ["#191512", "#3d342c", "#70645a", "#b3a798", "#efe6d8"],
    "red": ["#200a0a", "#561818", "#933030", "#d26a52", "#f7c9a8"],
    "glass": ["#14262c", "#2e5560", "#5f98a6", "#a9dde6", "#f1fbff"],
}

def hexrgb(h):
    h = h.lstrip("#"); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

def recolour(im, pal):
    stops = [hexrgb(c) for c in PAL[pal]]
    im = im.convert("RGBA"); out = im.copy(); px = out.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a == 0: continue
            t = min(0.999, (0.3 * r + 0.59 * g + 0.11 * b) / 255 * 1.08)
            f = t * (len(stops) - 1); i = int(f); k = f - i
            c = tuple(round(stops[i][j] * (1 - k) + stops[i + 1][j] * k) for j in range(3))
            px[x, y] = (*c, a)
    return out

# ---------- the list ----------
PIECES = [("helmet", "slot.armor.head", 3, 363, "armor_head"), ("chestplate", "slot.armor.chest", 8, 528, "armor_torso"),
          ("leggings", "slot.armor.legs", 6, 495, "armor_legs"), ("boots", "slot.armor.feet", 3, 429, "armor_feet")]
PIECE_NAME = {"helmet": "Helm", "chestplate": "Hauberk", "leggings": "Greaves", "boots": "Boots"}

SPEC = []
def add(**k): SPEC.append(k)

# Regional sets: (set id, region key, region name, set name, palette, base regional sheet, wonder, forge name, alloy, hint place)
SETS = [
    ("rimeforged", "frostmarch", "Frostmarch", "Rimeforged", None, None, "rimeforge_hall", "the Rime Anvil", "rime_steel",
     "Forged at a great anvil in the snow, for those who call Frostmarch home.",
     "Attackers who hit you are slowed. You are immune to freezing and powder snow.",
     "Full set: frost walking, and the Rime Ward: a short shield after a big hit."),
    ("watchward", "vale", "Aldmere Vale", "Watchward", "watch", "netherite_vale", "high_watch", "the Armoury", "watchsteel",
     "Made in the armoury of a tall watchtower in the Vale, for those who live in the Vale.",
     "Knockback resistance. Sneak to make hostile creatures within 24 blocks glow.",
     "Full set: the Watch. When you are hit, allies within 8 blocks gain Resistance for 5 seconds."),
    ("tidewrought", "saltreach", "Saltreach", "Tidewrought", "tide", "netherite_saltreach", "great_lighthouse", "the Lamp Room", "tidesteel",
     "Made in the lamp room of a white tower on the north cliffs, for those who live in Saltreach.",
     "Swim faster and mine at full speed under water. The helm lets you breathe water.",
     "Full set: regeneration in water or rain, and attackers near water are dragged down."),
    ("sunscale", "emberwaste", "Emberwaste", "Sunscale", "sun", "netherite_emberwaste", "sun_gate", "the Caravan Smithy", "sunsteel",
     "Made at a smithy under the great sun-arch, for those who live in the Emberwaste.",
     "Walk fast on sand. Attackers catch fire.",
     "Full set: fire immunity, and your dragon flies faster while you ride it."),
    ("fenlight", "blackfen", "Blackfen", "Fenlight", "fen", "netherite_blackfen", "lantern_spire", "the Lamplighter's Kiln", "bogsilver",
     "Made in a kiln beneath a spire of lamps over the fen, for those who live in Blackfen.",
     "Immune to poison. No slowdown in mud or shallow water.",
     "Full set: night vision in the dark, and at night you vanish from sight while you sneak."),
]
SET_WEAPONS = {
    "rimeforged": [("rime_axe", "Rime Axe", "axe", 8, "siege_rime_axe.png", "Hits slow and frost the target."),
                   ("rime_spear", "Rime Spear", "spear", 7, "siege_rime_spear.png", "Use it to hurl a frost strike: what it hits is frozen in place for 2 seconds.")],
    "watchward": [("watchmans_glaive", "Watchman's Glaive", "sword", 8, "siege_longsword.png", "A wide sweep: every hit also strikes everything in front of you."),
                  ("watch_crossbow", "Watch Crossbow", "bow", 0, "bestiary/rimefang_bow.png", "Bolts go through and hit a second target behind the first.")],
    "tidewrought": [("lighthouse_harpoon", "Lighthouse Harpoon", "spear", 7, "siege_rime_spear.png", "Use it to hurl a strike that makes what it hits glow."),
                    ("tidesteel_cutlass", "Tidesteel Cutlass", "sword", 7, "siege_choirsteel_sword.png", "Hits harder in water or rain.")],
    "sunscale": [("sunbrand_sabre", "Sunbrand Sabre", "sword", 8, "siege_choirsteel_sword.png", "Sets foes alight, and hits harder in daylight."),
                 ("sunscale_bow", "Sunscale Bow", "bow", 0, "bestiary/rimefang_bow.png", "Arrows burst into flame where they land.")],
    "fenlight": [("wisp_bow", "Wisp Bow", "bow", 0, "bestiary/rimefang_bow.png", "Arrows make the target glow for 10 seconds."),
                 ("bogsilver_sickle", "Bogsilver Sickle", "sword", 7, "siege_choirsteel_hoe.png", "Hits poison the target.")],
}
ALLOYS = {"rime_steel": ("Rime Steel", None), "watchsteel": ("Watchsteel", "watch"), "tidesteel": ("Tidesteel", "tide"),
          "sunsteel": ("Sunsteel", "sun"), "bogsilver": ("Bogsilver", "fen")}

for sid, rkey, rname, sname, pal, sheet, wonder, forge, alloy, hint, piece_does, full in SETS:
    for piece, slot, prot, dur, ench in PIECES:
        add(id=f"{sid}_{piece}", name=f"{sname} {PIECE_NAME[piece]}", kind="armor", piece=piece, slot=slot, protection=prot,
            durability=dur + 150, enchant=ench, chapter="regions", set=sid, region=rname, wonder=wonder, forge=forge, alloy=alloy,
            icon=None if sid == "rimeforged" else f"siege_choirsteel_{piece}.png", pal=pal, sheet=sheet and f"{sheet}_{piece}",
            does=f"{piece_does} {full}", hint=hint, source=f"Forged at {forge}.")
    for wid, wname, wkind, dmg, base, does in SET_WEAPONS[sid]:
        add(id=wid, name=wname, kind=wkind, damage=dmg, durability=1800, chapter="regions", set=sid, region=rname, wonder=wonder,
            forge=forge, alloy=alloy, icon=None if sid == "rimeforged" else base, pal=pal, does=does, hint=hint, source=f"Forged at {forge}.")
for aid, (aname, apal) in ALLOYS.items():
    add(id=aid, name=aname, kind="material", chapter=None, icon=None if apal is None else "siege_rime_steel.png", pal=apal,
        does="An alloy smelted at a wonder's forge.", hint="", source="")

add(id="fair_champions_barding", name="Fair Champion's Barding", kind="barding", chapter="regions", wonder="great_horse_fair",
    forge="the Fair's harness-maker", icon="horses/siege_caparison.png", pal="gold",
    does="Use it on your horse: better armour than diamond barding, and the horse jumps higher.",
    hint="Fitted at the ring where the best horses in the land change hands.", source="Fitted at the Great Horse Fair.")

# The Oathsworn Harness: one piece per regional boss, first kill
OATH = [("helmet", "clockwork_reeve", "Clockwork Reeve", "I was told to look away."),
        ("leggings", "pale_huntsman", "Pale Huntsman", "I did not."),
        ("chestplate", "drowned_bride", "Drowned Bride", "He would not draw, so neither did I."),
        ("boots", "ash_seneschal", "Ash Seneschal", "They took him to the Crack.")]
for piece, boss, bname, line in OATH:
    p = next(x for x in PIECES if x[0] == piece)
    add(id=f"oathsworn_{piece}", name=f"Oathsworn {PIECE_NAME[piece]}", kind="armor", piece=piece, slot=p[1], protection=p[2],
        durability=p[3] + 200, enchant=p[4], chapter="oathsworn", set="oathsworn", boss=f"siege:{boss}",
        icon=f"siege_choirsteel_{piece}.png", pal="oath", sheet=f"diamond_vale_{piece}", line=line,
        does=f"\"{line}\" Two pieces: extra toughness. Four: as strong as netherite. All five: once a day a killing blow leaves you on 1 heart.",
        hint=f"Guarded by the {bname}.", source=f"The {bname}, first time it fell.")
add(id="oathsworn_sword", name="Oathsworn Sword", kind="sword", damage=8, durability=2000, chapter="oathsworn", set="oathsworn",
    boss="siege:mother_of_changelings", icon="siege_longsword.png", pal="oath", line="I kept the oath he made. Someone should.",
    does="\"I kept the oath he made. Someone should.\" Counts as the fifth piece of the Oathsworn Harness.",
    hint="Guarded by the Mother of Changelings.", source="The Mother of Changelings, first time she fell.")

# Boss and champion drops (first kill)
DROPS = [
    ("usurpers_edge", "Usurper's Edge", "sword", 8, "siege_choirsteel_sword.png", "red", "siege:pretender_blade", "boss",
     "Each kill gives a stack of speed for 10 seconds, up to three.", "Carried by a claimant to an empty throne."),
    ("seers_glass", "Seer's Glass", "offhand", 0, "siege_mirror_glass.png", "moon", "siege:pretender_seer", "boss",
     "Held in the offhand: disguised things near you show their true shape (they glow).", "Carried by a claimant who sees too much."),
    ("claimants_mace", "Claimant's Mace", "mace", 9, "siege_warhammer.png", "red", "siege:pretender_brute", "boss",
     "Sneak and hit: the ground slams and throws back everything near you (every 6 seconds).", "Carried by the biggest of the claimants."),
    ("lists_gauntlet", "Lists Gauntlet", "offhand", 0, "siege_gauntlet_of_challenge.png", "iron", "champion_knight", "champion",
     "Held in the offhand: your hits knock back further and stun shields.", "Won from a rival knight in a fair fight."),
    ("hex_lantern", "Hex Lantern", "offhand", 0, "siege_hollow_ember.png", "witch", "champion_sorcerer", "champion",
     "Held in the offhand: potions you drink last half as long again.", "Won from a rival sorcerer."),
    ("lords_signet", "Lord's Signet", "offhand", 0, "bestiary/drowned_ring.png", "gold", "champion_lord", "champion",
     "Held in the offhand: siege wins pay 10% more Regals.", "Won from a rival lord."),
    ("cairn_helm", "Cairn-Helm of the Thane", "helm", 0, "siege_choirsteel_helmet.png", "ash", "siege:warlord_king", "boss3",
     "Weak siege raiders near you hesitate and fall back.", "The one who leads the third-night marches, beaten three times."),
    ("regents_seal_ring", "Regent's Seal-Ring", "offhand", 0, "bestiary/drowned_ring.png", "moon", "regent", "regent",
     "Held in the offhand: permits to mine the ore below cost half.", "Taken from a ruler of the ore, overthrown."),
]
for did, name, kind, dmg, base, pal, by, how, does, hint in DROPS:
    k = dict(id=did, name=name, kind="armor" if kind == "helm" else kind, damage=dmg, durability=2000, chapter="relics",
             by=by, how=how, icon=base, pal=pal, does=does, hint=hint, source=hint)
    if kind == "helm":
        k.update(piece="helmet", slot="slot.armor.head", protection=3, durability=480, enchant="armor_head", sheet="netherite_frostmarch_helmet")
    add(**k)

# Mythical weapons and tools (once per player, from a place or a mystery; they go dull instead of breaking)
MYTH = [
    ("maelis_clapper", "Maelis's Clapper", "mace", 8, "siege_warhammer.png", "bell", "Queen Maelis, from the Founding Bell",
     "Every hit rings: creatures that don't belong in this world are stunned for a second. Sneak and hit: a ringing wave throws everything near back.",
     "Forty tons of copper went into a bell. Some of it is still down the mine.", "bellfounders_mine", "frosthelm"),
    ("cairn_axe", "The Cairn Axe", "axe", 8, "siege_rime_axe.png", "ash", "Thane Vorlund, before he sailed",
     "Use it to hurl it: it strikes and returns. Each hit on the same target in a row does more damage.",
     "Six thousand and four stones. Count them, and look underneath.", "wolfcairn", "wolfcairn"),
    ("holts_debt", "Holt's Debt", "sword", 8, "siege_choirsteel_sword.png", "glass", "Merrin Holt, who burned forty boats",
     "Every kill pays 1 Regal towards the debt. At 1,000 kills the debt is marked paid and the blade burns.",
     "Forty boats burned off the coast. One wreck still has something aboard.", "holt_wreck", None),
    ("ysolts_lance", "Ysolt's Lance", "spear", 8, "siege_rime_spear.png", "sun", "Ysolt Cinder, the first Dragon Rider",
     "Use it while riding a dragon: dive and hit everything below. On foot, use it to thrust far ahead.",
     "The oldest nest in the Roost keeps it for whoever has raised a dragon.", "cinder_roost", None),
    ("sedges_thorn", "Sedge's Thorn", "sword", 7, "siege_choirsteel_shovel.png", "witch", "Goody Sedge, who has three graves",
     "Hits wither the target. Kills heal you two hearts.", "She has three graves. Only one of them is hers.", "sedge_graves", None),
    ("second_moon_bow", "The Second-Moon Bow", "bow", 0, "bestiary/rimefang_bow.png", "moon", "Nobody knows",
     "Arrows curve toward the nearest hostile creature.", "Behind a door carved with a moon, on a night with two of them.", "moon_door", None),
    ("eddas_mercy", "Edda's Mercy", "sword", 9, "siege_longsword.png", "ash", "Princess Edda, Saint Ashe",
     "Strikes go through armour (a third of each hit ignores it).", "Sealed under a house of exiled copyists. It will not open yet.", "dunehold", "dunehold"),
    ("hrodas_pick", "Hroda's Pick", "pick", 6, "siege_choirsteel_pickaxe.png", "bronze", "Hroda Deepforge, bellfounder",
     "Breaks a 3x3 square, and the ore around the block you strike comes out smelted.", "The deepest door in your own mine. Only a Castle digs that far.", "plot_mine", None),
    ("sextons_spade", "The Sexton's Spade", "shovel", 5, "siege_choirsteel_shovel.png", "iron", "The gravedigger of Bellhollow",
     "Digs three blocks deep at once, and now and then turns up an old coin.", "A churchyard where every bell was rung at once.", "bellhollow", None),
    ("aldrics_sickle", "Aldric's Sickle", "hoe", 4, "siege_choirsteel_hoe.png", "gold", "King Aldric, in his garden",
     "Tilling one block tills a 3x3 square, and crops near you grow faster while you hold it.", "An old king's lodge has a second cellar.", "oakmere", "oakmere"),
    ("wennas_line", "Wenna's Line", "rod", 0, "horses/siege_riding_crop.png", "glass", "Wenna Sedge, gone eleven years",
     "Sometimes catches things from somewhere else: lost coins, old keepsakes, now and then a page.", "A loose board at Lanternbog, where someone was gone eleven years.", "lanternbog", "lanternbog"),
    ("corvins_lodestone", "Corvin's Lodestone", "compass", 0, "siege_tuning_fork.png", "moon", "Corvin Hale",
     "Use it: it points to the nearest thing in the Codex you haven't found.", "A voice in the water gives it, late in the story.", "corvin", None),
]
for mid, name, kind, dmg, base, pal, whose, does, hint, site, plot in MYTH:
    add(id=mid, name=name, kind=kind, damage=dmg, durability=2400, chapter="mythical", whose=whose, site=site, plot=plot,
        icon=base, pal=pal, does=does, hint=hint, source=f"Once belonged to {whose}.", mythical=True)

# Thin-place charms
CHARMS = [("chapel_clapper", "Chapel Clapper", "drowned_chapel", "the Drowned Chapel", "See clearly under water.", "bell"),
          ("founders_slag", "Founder's Slag", "bellfounders_mine", "the Bellfounders' Mine", "Mine faster below sea level.", "bronze"),
          ("barrow_coin", "Barrow Coin", "kings_barrow", "King's Barrow", "The undead hit you for less.", "gold"),
          ("saltglass_prism", "Saltglass Prism", "saltglass_grotto", "the Saltglass Grotto", "You get hungry half as fast.", "glass"),
          ("frostvein_shard", "Frostvein Shard", "frostvein_hollow", "Frostvein Gap", "No fall damage onto snow or ice.", "tide"),
          ("quarry_mark", "Quarry Mark", "sunken_quarry", "the Sunken Quarry", "Stone and ore break faster.", "iron"),
          ("witchroot_knot", "Witchroot Knot", "witchroot_caves", "the Witchroot Caves", "No knockback while sneaking.", "fen")]
CHARM_BASE = ["siege_crown_shard.png", "bestiary/ash_glass.png", "siege_coin.png", "bestiary/ash_glass.png", "siege_crown_shard.png", "bestiary/clockwork_cog.png", "bestiary/mire_effigy.png"]
for (cid, name, site, place, does, pal), base in zip(CHARMS, CHARM_BASE):
    add(id=cid, name=name, kind="offhand", chapter="charms", site=site, place=place, icon=base, pal=pal,
        does=f"Held in the offhand: {does[0].lower()}{does[1:]}", hint=f"Left at one of the seven thin places.", source=f"Found at {place}.")

# Sun Gate caravan goods
GOODS = [("wayfarers_compass", "Wayfarer's Compass", "tool", 40, "siege_tuning_fork.png", "bronze", "Use it: it points to your home keep."),
         ("sandglass_of_nights", "Sandglass of Nights", "tool", 30, "siege_mirror_glass.png", "sun", "Use it: shows how many days until the next third night."),
         ("caravan_saddle", "Caravan Saddle", "tool", 60, "horses/siege_saddle_cavalry.png", "sun", "Use it on your horse: it runs faster on roads and paths."),
         ("ember_tea", "Ember Tea", "food", 8, "bestiary/toad_venom.png", "red", "Drink it: 3 minutes of fire resistance, and it fills you up."),
         ("far_coast_seeds", "Far-Coast Seeds", "seeds", 25, "bestiary/wight_dust.png", "fen", "Plant them on farmland: a far-coast melon vine springs up overnight, fruit and all."),
         ("hatching_brazier", "Hatching Brazier", "place", 120, "siege_hollow_ember.png", "sun", "Place it next to a dragon egg: the egg hatches twice as fast."),
         ("map_of_lost_things", "Map of Lost Things", "tool", 50, "siege_plan_scroll.png", "bronze", "Use it: marks where one thin-place charm you haven't found lies."),
         ("caravan_rations", "Caravan Rations", "food", 12, "siege_plan_scroll.png", "sun", "Eat it: fills you right up, and you don't get hungry for 2 minutes."),
         ("ashglass_lantern", "Ashglass Lantern", "place", 20, "siege_hollow_ember.png", "glass", "Place it: a lantern that stays lit in rain and under water."),
         ("desert_rose", "Desert Rose", "tool", 15, "bestiary/changeling_ichor.png", "red", "Give it to a townsperson (use it on them): they like you more."),
         ("mirage_flask", "Mirage Flask", "tool", 45, "siege_mirror_glass.png", "glass", "Use it: creatures chasing you lose you for 5 seconds."),
         ("caravan_banner", "Caravan Banner", "tool", 150, "siege_oath_banner.png", "bronze", "Use it at your keep: a caravan trader visits your town once a week.")]
for gid, name, kind, price, base, pal, does in GOODS:
    add(id=gid, name=name, kind=kind, price=price, chapter="caravan", icon=base, pal=pal, does=does,
        hint="Sometimes on the stalls at the Sun Gate.", source="Bought at the Sun Gate caravan market.")

add(id="codex", name="The Codex", kind="book", chapter=None, icon="siege_almanac.png", pal="bronze",
    does="Every item worth finding, and the ones you haven't yet.", hint="", source="")

# Existing items that join the Codex (no files written for them, only Codex entries)
EXISTING = [
    ("minute_hand", "Minute Hand", "mythical", "Each hit slows time around the target.", "The Clockwork Reeve, first time it fell.", "Carried by the keeper of a stopped clock."),
    ("rimefang_bow", "Rimefang Bow", "mythical", "Its arrows root what they hit in ice.", "The Pale Huntsman, first time he fell.", "Carried by a hunter on a frozen lake."),
    ("warlords_brand", "The Warlord's Brand", "mythical", "Sets foes alight; every fifth hit lets out a war-cry.", "The Warlord King.", "Carried by the one who leads the third-night marches."),
    ("oath_of_oswin", "The Kept Oath", "mythical", "Executes foes below a fifth of their health and rallies your guards.", "The last fight, on the Knight's path.", "Taken from whoever sits in the chair below. Spoken of last."),
    ("widows_veil", "Widow's Veil", "relics", "Breathe water, see in the dark, and see things for what they are.", "The Drowned Bride.", "Worn by a bride under the sea."),
    ("seneschal_greatshield", "Seneschal's Greatshield", "relics", "Sneak with it in the offhand to brace and throw attackers back.", "The Ash Seneschal.", "Guarded in a vault where every statue lost its face."),
    ("faceless_crown_shard", "Faceless Crown Shard", "relics", "It whispers when you hold it.", "The Ash Seneschal.", "Guarded in a vault where every statue lost its face."),
    ("mire_heart", "Mire Heart", "relics", "Held in the offhand: at night, your hits heal you.", "The Mother of Changelings.", "Something in the Witchroot Caves keeps it."),
    ("last_note", "The Last Note", "relics", "Held in the offhand: things from below falter near you.", "The Hollow Choir.", "The end of a song you hear on third nights."),
    ("crownless_mantle", "Crownless Mantle", "relics", "Hits sometimes pass straight through you.", "The last fight, on the Marked path.", "Woven from the dark under a crown. Spoken of last."),
    ("choirsteel_helmet", "Choirsteel Helmet", "wonders", "The best armour there is.", "Smithed from netherite with a Choirsteel template.", "A template sung into a cold coffer, far below."),
    ("choirsteel_chestplate", "Choirsteel Chestplate", "wonders", "The best armour there is.", "Smithed from netherite with a Choirsteel template.", "A template sung into a cold coffer, far below."),
    ("choirsteel_leggings", "Choirsteel Leggings", "wonders", "The best armour there is.", "Smithed from netherite with a Choirsteel template.", "A template sung into a cold coffer, far below."),
    ("choirsteel_boots", "Choirsteel Boots", "wonders", "The best armour there is.", "Smithed from netherite with a Choirsteel template.", "A template sung into a cold coffer, far below."),
    ("choirsteel_sword", "Choirsteel Sword", "wonders", "The best sword there is.", "Smithed from netherite with a Choirsteel template.", "A template sung into a cold coffer, far below."),
    ("choirsteel_pickaxe", "Choirsteel Pickaxe", "wonders", "The best pickaxe there is.", "Smithed from netherite with a Choirsteel template.", "A template sung into a cold coffer, far below."),
    ("choirsteel_axe", "Choirsteel Axe", "wonders", "The best axe there is.", "Smithed from netherite with a Choirsteel template.", "A template sung into a cold coffer, far below."),
    ("choirsteel_shovel", "Choirsteel Shovel", "wonders", "The best shovel there is.", "Smithed from netherite with a Choirsteel template.", "A template sung into a cold coffer, far below."),
    ("choirsteel_hoe", "Choirsteel Hoe", "wonders", "The best hoe there is.", "Smithed from netherite with a Choirsteel template.", "A template sung into a cold coffer, far below."),
    ("everwake_wings", "Everwake Wings", "keepsakes", "Glide like a bird.", "The very end, far above the clouds.", "Given at the very end, far above the clouds."),
    ("hollow_crown", "The Hollow Crown", "keepsakes", "It kills anyone who wears it, but one.", "The Seat.", "Worn by whoever rules what lies beyond the Gate."),
    ("dragon_saddle", "Dragon Saddle", "keepsakes", "Lets you ride a dragon you raised.", "The Dragon Keeper.", "Sold where dragons are raised."),
    ("dragon_horn", "Dragon Horn", "keepsakes", "Calls your dragon to you.", "The Dragon Keeper.", "Sold where dragons are raised."),
    ("starter_vale_chestplate", "Vale Smock", "keepsakes", "What a Vale settler arrives in.", "Your first day, if you settled in the Vale.", "What settlers of the Vale arrive wearing."),
    ("starter_frostmarch_chestplate", "Frostmarch Furs", "keepsakes", "What a Frostmarch settler arrives in.", "Your first day, if you settled in Frostmarch.", "What settlers of Frostmarch arrive wearing."),
    ("starter_saltreach_chestplate", "Saltreach Oilskin", "keepsakes", "What a Saltreach settler arrives in.", "Your first day, if you settled in Saltreach.", "What settlers of Saltreach arrive wearing."),
    ("starter_emberwaste_chestplate", "Emberwaste Robe", "keepsakes", "What an Emberwaste settler arrives in.", "Your first day, if you settled in the Emberwaste.", "What settlers of the Emberwaste arrive wearing."),
    ("starter_blackfen_chestplate", "Blackfen Wrap", "keepsakes", "What a Blackfen settler arrives in.", "Your first day, if you settled in Blackfen.", "What settlers of Blackfen arrive wearing."),
]

CHAPTERS = [("regions", "Arms of the Regions"), ("oathsworn", "The Oathsworn Harness"), ("mythical", "Mythical Weapons and Tools"),
            ("relics", "Relics of the Bosses"), ("wonders", "Choirsteel"), ("caravan", "Caravan Goods"),
            ("charms", "Charms of the Thin Places"), ("keepsakes", "Keepsakes")]

# ---------- writers ----------
def icon_key(s): return f"siege_cx_{s['id']}" if s.get("icon") else f"siege_{s['id']}"

def item_json(s):
    ident = f"siege:{s['id']}"
    c = {"minecraft:icon": icon_key(s), "minecraft:display_name": {"value": f"item.{ident}.name"}, "minecraft:max_stack_size": 1}
    k = s["kind"]; cat = "equipment"; tags = ["siege:codex"]
    if s.get("mythical"): c["minecraft:glint"] = True; tags.append("siege:mythical")
    if s.get("region"): tags.append("siege:regional_" + s["set"])
    if k == "armor":
        c["minecraft:wearable"] = {"slot": s["slot"], "protection": s["protection"]}
        c["minecraft:durability"] = {"max_durability": s["durability"]}
        c["minecraft:enchantable"] = {"slot": s["enchant"], "value": 15}
        tags += ["minecraft:is_armor", "minecraft:trimmable_armors"]
        if s.get("alloy"): c["minecraft:repairable"] = {"repair_items": [{"items": [f"siege:{s['alloy']}"], "repair_amount": "q.max_durability * 0.25"}]}
    elif k in ("sword", "axe", "spear", "mace", "pick", "shovel", "hoe"):
        c["minecraft:hand_equipped"] = True
        c["minecraft:damage"] = s["damage"]
        c["minecraft:durability"] = {"max_durability": s["durability"]}
        slot = {"sword": "sword", "spear": "sword", "mace": "sword", "axe": "axe", "pick": "pickaxe", "shovel": "shovel", "hoe": "hoe"}[k]
        c["minecraft:enchantable"] = {"slot": slot, "value": 15}
        tags += ["minecraft:is_tool", "minecraft:diamond_tier"] + {"sword": ["minecraft:is_sword"], "spear": ["minecraft:is_sword"], "mace": ["minecraft:is_sword"],
                 "axe": ["minecraft:is_axe"], "pick": ["minecraft:is_pickaxe"], "shovel": ["minecraft:is_shovel"], "hoe": ["minecraft:is_hoe"]}[k]
        if k == "pick": c["minecraft:digger"] = {"use_efficiency": True, "destroy_speeds": [{"block": {"tags": "q.any_tag('stone', 'metal', 'diamond_pick_diggable')"}, "speed": 8}]}
        if k == "shovel": c["minecraft:digger"] = {"use_efficiency": True, "destroy_speeds": [{"block": {"tags": "q.any_tag('dirt', 'sand', 'gravel', 'grass', 'snow')"}, "speed": 8}]}
        if k == "axe": c["minecraft:digger"] = {"use_efficiency": True, "destroy_speeds": [{"block": {"tags": "q.any_tag('wood', 'pumpkin', 'plant')"}, "speed": 8}]}
        if k == "hoe": c["minecraft:digger"] = {"use_efficiency": True, "destroy_speeds": [{"block": {"tags": "q.any_tag('plant', 'crop')"}, "speed": 8}]}
        if k in ("spear", "axe") and s["id"] in ("rime_spear", "lighthouse_harpoon", "ysolts_lance", "cairn_axe"):
            c["minecraft:cooldown"] = {"category": "siege_hurl", "duration": 1.5}
        if s.get("alloy"): c["minecraft:repairable"] = {"repair_items": [{"items": [f"siege:{s['alloy']}"], "repair_amount": "q.max_durability * 0.25"}]}
    elif k == "bow":
        c.update({"minecraft:hand_equipped": True, "minecraft:durability": {"max_durability": 1200},
                  "minecraft:use_modifiers": {"use_duration": 72000, "movement_modifier": 0.35}, "minecraft:use_animation": "bow",
                  "minecraft:enchantable": {"slot": "bow", "value": 15},
                  "minecraft:shooter": {"ammunition": [{"item": "minecraft:arrow", "use_offhand": True, "search_inventory": True, "use_in_creative": True}],
                                        "max_draw_duration": 1.0, "scale_power_by_draw_duration": True, "charge_on_draw": False}})
    elif k == "offhand":
        c["minecraft:allow_off_hand"] = True; c["minecraft:glint"] = True
    elif k == "rod":
        c.update({"minecraft:hand_equipped": True, "minecraft:durability": {"max_durability": 600}, "minecraft:cooldown": {"category": "siege_rod", "duration": 1.0}})
    elif k == "food":
        c["minecraft:max_stack_size"] = 16
        c["minecraft:food"] = {"nutrition": 6, "saturation_modifier": 0.8, "can_always_eat": True}
        c["minecraft:use_modifiers"] = {"use_duration": 1.6}
        c["minecraft:use_animation"] = "drink"
        cat = "items"
    elif k == "seeds":
        c["minecraft:max_stack_size"] = 64
        c["minecraft:block_placer"] = {"block": "minecraft:melon_stem", "use_on": ["minecraft:farmland"]}
        cat = "nature"
    elif k == "place":
        c["minecraft:max_stack_size"] = 16
        c["minecraft:block_placer"] = {"block": "minecraft:soul_lantern" if s["id"] == "ashglass_lantern" else "minecraft:campfire"}
        cat = "items"
    elif k in ("tool", "compass", "book", "barding"):
        c["minecraft:cooldown"] = {"category": "siege_codex_use", "duration": 0.5}
        cat = "items"
    elif k == "material":
        c["minecraft:max_stack_size"] = 64
        cat = "items"
    c["minecraft:tags"] = {"tags": tags}
    return {"format_version": "1.21.60", "minecraft:item": {"description": {"identifier": ident, "menu_category": {"category": cat}}, "components": c}}

def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f: json.dump(data, f, indent=1); f.write("\n")

def main():
    standins = set(json.load(open(STANDIN))) if os.path.exists(STANDIN) else set()
    items_dir = os.path.join(BP, "items/codex"); os.makedirs(items_dir, exist_ok=True)
    for f in os.listdir(items_dir):
        if f.endswith(".json"): os.remove(os.path.join(items_dir, f))
    texture_data = {}
    for s in SPEC:
        write_json(os.path.join(items_dir, f"{s['id']}.json"), item_json(s))
        if s.get("icon"):
            rel = f"textures/items/codex/{s['id']}"
            out = os.path.join(RP, rel + ".png")
            if not os.path.exists(out) or rel in standins:
                im = Image.open(os.path.join(ICONS, s["icon"]))
                os.makedirs(os.path.dirname(out), exist_ok=True)
                (recolour(im, s["pal"]) if s.get("pal") else im).save(out)
                standins.add(rel)
            texture_data[icon_key(s)] = {"textures": rel}
        if s["kind"] == "armor" and s.get("sheet"):
            sheet = os.path.join(RP, "textures/models/siege_armor", s["sheet"] + ".png")
            out_rel = f"textures/models/siege_armor/codex_{s['id']}"
            out = os.path.join(RP, out_rel + ".png")
            if not os.path.exists(out) or out_rel in standins:
                recolour(Image.open(sheet), s["pal"]).save(out); standins.add(out_rel)
            # the texture thread's own model, once painted (models/entity/armor/codex_<id>.geo.json), else the stand-in's
            own = os.path.join(RP, "models/entity/armor", f"codex_{s['id']}.geo.json")
            geo = f"geometry.siege_codex_{s['id']}" if os.path.exists(own) else "geometry.siege_" + s["sheet"]
            write_json(os.path.join(RP, "attachables/codex", f"{s['id']}.json"), {"format_version": "1.10.0", "minecraft:attachable": {"description": {
                "identifier": f"siege:{s['id']}", "materials": {"default": "armor", "enchanted": "armor_enchanted"},
                "textures": {"default": out_rel, "enchanted": "textures/misc/enchanted_actor_glint"}, "geometry": {"default": geo},
                "scripts": {"parent_setup": f"variable.{ {'helmet': 'helmet', 'chestplate': 'chest', 'leggings': 'leg', 'boots': 'boot'}[s['piece']] }_layer_visible = 0.0;"},
                "render_controllers": ["controller.render.armor"]}}})
    # item_texture.json
    itp = os.path.join(RP, "textures/item_texture.json")
    it = json.load(open(itp))
    for k in [k for k in it["texture_data"] if k.startswith("siege_cx_")]: del it["texture_data"][k]
    it["texture_data"].update(texture_data)
    write_json(itp, it)
    # lang
    lp = os.path.join(RP, "texts/en_US.lang")
    text = open(lp).read()
    a, b = "## codex items (studio/build_codex.py)", "## end codex items"
    if a in text: text = text[:text.index(a)] + text[text.index(b) + len(b):].lstrip("\n")
    lines = [a] + [f"item.siege:{s['id']}.name={'§6' if s.get('mythical') else ''}{s['name']}" for s in SPEC] + [b]
    text = text.rstrip("\n") + "\n" + "\n".join(lines) + "\n"
    open(lp, "w").write(text)
    os.makedirs(os.path.dirname(STANDIN), exist_ok=True)
    json.dump(sorted(standins), open(STANDIN, "w"), indent=1)
    # the scripts' copy
    keep = ("id", "name", "kind", "chapter", "set", "region", "wonder", "forge", "alloy", "piece", "boss", "by", "how", "site", "plot", "place",
            "price", "does", "hint", "source", "whose", "line", "mythical")
    entries = [{k: s[k] for k in keep if k in s and s[k] is not None} for s in SPEC]
    for e in entries: e["id"] = "siege:" + e["id"]
    existing = [{"id": f"siege:{i}", "name": n, "chapter": ch, "does": d, "source": src, "hint": h, "existing": True} for i, n, ch, d, src, h in EXISTING]
    js = ("// Generated by studio/build_codex.py from its SPEC list. Do not edit by hand: change the script and run it again.\n"
          "// Every Codex item: new ones (with item files in items/codex/) and existing ones that join the book.\n\n"
          f"export const CHAPTERS = {json.dumps([{'id': i, 'name': n} for i, n in CHAPTERS], indent=1)};\n\n"
          f"export const ITEMS = {json.dumps(entries, indent=1, ensure_ascii=False)};\n\n"
          f"export const EXISTING = {json.dumps(existing, indent=1, ensure_ascii=False)};\n")
    write_json  # (keeps linters quiet)
    os.makedirs(os.path.join(BP, "scripts/codex"), exist_ok=True)
    open(os.path.join(BP, "scripts/codex/items_data.js"), "w").write(js)
    print(f"{len(SPEC)} items, {len(texture_data)} icons, {len(EXISTING)} existing entries")

if __name__ == "__main__":
    main()
