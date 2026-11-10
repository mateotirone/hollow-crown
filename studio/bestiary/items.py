# Bestiary items: materials, boss summoning keys, and the named boss weapons/relics.
# kind decides the placeholder icon shape; abilities live in scripts/bestiary/relics.js.
MATERIALS = [
    ("hollow_ash", "Veil Ash", (120, 130, 150), "Grey ash that hums. Dropped by anything the Choir has touched."),
    ("pale_antler", "Pale Antler", (200, 226, 240), "From a Frost Stag. Stables masters pay well for it."),
    ("rime_pelt", "Rime Pelt", (190, 210, 224), "A Rimewolf pelt, always cold to the touch."),
    ("brine_scale", "Brine Scale", (60, 110, 100), "A Brine Lurker scale. It never dries."),
    ("ash_glass", "Ash Glass", (230, 140, 60), "Desert glass fused in an Emberwaste fire."),
    ("wyrm_scale", "Wyrm Scale", (196, 160, 100), "A plate from a Dune Wyrm, hard as iron."),
    ("toad_venom", "Toad Venom", (130, 170, 50), "Scraped off a Mire Toad. Handle with gloves."),
    ("wight_dust", "Wight Dust", (130, 220, 170), "What a Barrow Wight leaves behind. It still glows."),
    ("clockwork_cog", "Clockwork Cog", (218, 176, 70), "A cog from the Clockwork Reeve. It ticks on its own."),
    ("drowned_pearl", "Drowned Pearl", (200, 240, 236), "A pearl from the Bride's veil."),
    ("gloamquill", "Gloamquill", (124, 64, 156), "A Gloamwing's flight quill. It never quite stops trembling."),
    ("pretender_seal", "Claimant's Seal", (160, 70, 190), "Pressed by someone who meant to rule the Hollow. Every one is different, because every one of them was."),
    ("changeling_ichor", "Changeling Ichor", (230, 220, 80), "Shifts colour while you look at it."),
]
# boss summoning keys: what the regional puzzles hand out
SIGILS = [
    ("stopped_clock_key", "Stopped Clock Key", "clockwork_reeve", (218, 176, 70), "Wind it in Millbrook's well and the Reeve comes to collect."),
    ("pale_horn", "Pale Horn", "pale_huntsman", (220, 230, 240), "Blow it on the frozen lake. Something hears."),
    ("drowned_ring", "Drowned Wedding Ring", "drowned_bride", (160, 230, 220), "Her ring. She wants it back."),
    ("faceless_seal", "Faceless Seal", "ash_seneschal", (150, 60, 30), "The Seneschal's seal, with no face on it."),
    ("mire_effigy", "Mire Effigy", "mother_of_changelings", (90, 120, 60), "A doll of sticks and hair. Mirelight's mother answers it."),
]
# (id, name, kind, color, stats, lore)
RELICS = [
    ("minute_hand", "Minute Hand", "sword", (218, 176, 70), dict(damage=8, durability=1400), "From the Clockwork Reeve. Each hit slows time around the target."),
    ("rimefang_bow", "Rimefang Bow", "bow", (200, 226, 240), dict(durability=900), "From the Pale Huntsman. Its arrows root targets in ice."),
    ("widows_veil", "Widow's Veil", "helmet", (220, 236, 240), dict(protection=3, durability=420), "From the Drowned Bride. Breathe water, see in the dark, and see things from the Hollow for what they are."),
    ("seneschal_greatshield", "Seneschal's Greatshield", "shield", (120, 100, 80), dict(durability=1200), "From the Ash Seneschal. Hold it in your offhand and sneak to brace: big resistance and you throw attackers back."),
    ("faceless_crown_shard", "Faceless Crown Shard", "shard", (200, 190, 170), dict(), "A sliver of something that was once worn. It whispers when you hold it."),
    ("mire_heart", "Mire Heart", "charm", (130, 160, 60), dict(), "From the Mother of Changelings. Hold it in your offhand: at night, your hits heal you."),
    ("warlords_brand", "The Warlord's Brand", "sword", (180, 40, 30), dict(damage=9, durability=1600), "From the Warlord King. Sets foes alight; every fifth hit lets out a war-cry shockwave."),
    ("oath_of_oswin", "The Kept Oath", "sword", (150, 190, 200), dict(damage=10, durability=2400), "Knight path. A king's oath-blade, still keeping its oath. Executes foes below a fifth of their health and rallies your guards."),
    ("crownless_mantle", "Crownless Mantle", "chest", (40, 60, 80), dict(protection=8, durability=600), "Marked path. Woven from the dark under the crown. Hits sometimes pass straight through you."),
]
