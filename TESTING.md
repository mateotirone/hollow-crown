# Siege Nights: first playtest

About 20 minutes. Go down the list, and for anything that doesn't happen the way it says, send me a screenshot or a sentence. "Nothing happened" is a useful answer too.

## 1. Install

You need Minecraft Bedrock **1.21.90 or newer**.

- **Windows PC:** double-click `siege-nights.mcaddon`. Minecraft opens and says it imported two packs.
- **Android:** download the file, open it from your Downloads or Files app, and pick Minecraft.
- **iPhone / iPad:** save it to the Files app, tap it, then use Share → Minecraft.
- **Xbox / PlayStation / Switch:** consoles can't open add-on files. Import it on a phone or PC first, add it to a world there, then upload that world to a **Realm** and play the Realm on your console.

## 2. Make a test world

1. Create a new world, **Creative** mode, and turn **Cheats** on.
2. Under **Behavior Packs**, activate **Siege Nights**. The resource pack turns on with it.
3. Create the world.

## 3. Self-test first

As soon as you're in the world, type `/scriptevent siege:selftest` in chat.

✅ A green line: "Self-test passed: 24 checks, 10 loop tasks running."

If it's red, it lists what's wrong (for example a block the pack is missing). Send me that list and skip the rest. If nothing appears at all, the scripts didn't load: tell me your Minecraft version.

## 4. Test list

Type the commands in chat (`/` opens it).

**Settlement**
1. `/give @s siege:keep_banner` and place it. ✅ A "Settlement founded" title, and a health name above the banner.
2. Click the banner with red dye. ✅ The banner turns red.
3. Walk about 32 blocks away. ✅ A line of colored particles at the border, and an "Entering the wilds" message.

**Building**
4. `/give @s siege:workshop`, place it, and open it. ✅ A crafting screen called Siege Workshop with Siege Nights recipes.
5. `/give @s siege:castle_stone 64` and build a short wall. Click a block with an iron ingot. ✅ It changes look (reinforced).
6. `/give @s siege:portcullis 4`, place two stacked, and click one. ✅ Both raise and lower together.

**Armor** (switch to Survival with `/gamemode s` to see armor properly)
7. `/give @s siege:guard_chestplate` and wear it. ✅ The cloth parts are your banner color (red), not brown leather.

**Battering Ram**
8. `/give @s siege:battering_ram` and click the ground. ✅ A wooden ram appears.
9. Click it to climb on, drive with WASD, face your wall, and punch the wall. ✅ The beam swings and the wall cracks, and breaks after a few hits.

**Siege machines**
10. `/give @s siege:ballista`, place it inside your settlement, then `/summon zombie ~ ~ ~10`. ✅ The ballista turns to face the zombie, the arms snap and it gets hit.
11. `/give @s siege:trebuchet` and `/give @s cobblestone 16`. Place it, look at a spot about 30 blocks away, and click the trebuchet holding cobblestone. ✅ It turns, the arm swings over, and a boulder smashes a crater.

**Guards**
12. `/give @s siege:barracks`, place it, `/summon villager` next to it, then click the Barracks holding 5 emeralds (`/give @s emerald 20`). ✅ The villager becomes a Man-at-Arms.
13. Sneak + click the guard. ✅ He goes into your inventory. Place him on a wall. Repeat with sneak + emeralds on the Barracks for an Archer.

**Siege**
14. `/time set 13000`, then `/give @s siege:war_horn` and use it. ✅ "Siege Night" title, then raiders arrive from one direction.
15. Watch for a while. ✅ Raiders head toward your banner, your archers shoot them, and men-at-arms run out.
16. `/gamemode s` and fight. Try to win (kill all three waves). ✅ You get emeralds and a win message.

**Quartermaster**
17. `/give @s siege:quartermaster_desk`, place it, and `/summon villager` next to it. ✅ He becomes the Quartermaster and you can trade with him.

## What I most want to know

- Click your Keep Banner with an empty hand, and a Barracks with an empty hand. Do the menus open, and does the info look right?
- During a siege, does the sidebar on the right show waves, raiders and keep health?
- Did the armor cloth take your banner color?
- Did raiders actually walk to your banner, or wander around?
- Could you drive the ram and swing it?
- Do the trebuchet and ballista look right, and do they animate?
- Click a guard holding 6 iron ingots. Does he put on a nasal helm and mail? Then try 12 iron, 4 diamonds and a netherite ingot.
- Put on full iron, diamond and netherite armor (`/give @s diamond_helmet` and so on). Do the new 3D shapes show, and do they move with you?
- Did guards hold their posts and fight?
- Was the siege too easy, too hard, or about right?

## Character looks (pick your person)

The add-on carries character skins made on the creator page and draws each player as the one they picked. Nobody imports a skin.

1. Join the world for the first time. After a few seconds a menu asks "Who steps off the coach?". Pick a character.
2. Press F5. You should see that character's skin on your own body. Check that armor, a held item and a cape (if you have one) still show.
3. Have a second player join and pick someone else. Each of you should see the other's character.
4. `/scriptevent siege:showcase` places a **Looking Glass**. Click it to change look, and pick "My own skin" to go back.
5. Click your Keep Banner: the menu has "Change my look".

Things to watch for, because none of this has run in a real game yet:
- If a player with a slim-arm or Character Creator skin looks broken after picking a look, tell Claude: the look is drawn on the plain wide-arm model.
- If nothing changes when you pick, the world is not using the add-on's player file (another add-on that also changes the player would win or lose depending on pack order).

To add a friend's character: `node studio/build_looks.mjs add "<their creator link>" TheirGamertag`, then `python3 tools/build.py`. With a gamertag the look is theirs alone and is put on automatically when they join.
