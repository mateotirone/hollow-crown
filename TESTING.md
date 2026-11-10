# The Hollow Crown: first playtest

About 20 minutes. Go down the list, and for anything that doesn't happen the way it says, send me a screenshot or a sentence. "Nothing happened" is a useful answer too.

## 1. Install

You need Minecraft Bedrock **1.21.90 or newer**.

- **Windows PC:** double-click `hollow-crown.mcaddon`. Minecraft opens and says it imported two packs.
- **Android:** download the file, open it from your Downloads or Files app, and pick Minecraft.
- **iPhone / iPad:** save it to the Files app, tap it, then use Share → Minecraft.
- **Xbox / PlayStation / Switch:** consoles can't open add-on files. Import it on a phone or PC first, add it to a world there, then upload that world to a **Realm** and play the Realm on your console.

## 2. Make a test world

1. Create a new world, **Creative** mode, and turn **Cheats** on.
2. Under **Behavior Packs**, activate **The Hollow Crown**. The resource pack turns on with it.
3. Create the world.

## 3. Self-test first

As soon as you're in the world, type `/scriptevent siege:selftest` in chat.

✅ A green line starting "Self-test passed".

If it's red, it lists what's wrong (for example a block the pack is missing). Send me that list and skip the rest. If nothing appears at all, the scripts didn't load: tell me your Minecraft version.

## 4. The showcase (the quick way)

Make the world **Flat** if you can, stand somewhere open, and type `/scriptevent siege:showcase`.

✅ A settlement appears south of you with everything in it, each with a sign:
- your Keep Banner, and one of every block in a labelled row (including reinforced and cracked Castle Stone, open gates)
- a piece of castle wall with battlements, arrow slits and a working portcullis
- a Ballista, a Trebuchet and a Battering Ram
- five Archers, one in each armor, a Man-at-Arms at the Barracks with two villagers to recruit, and a Quartermaster at his desk
- chests behind you with one of every item, plus emeralds, iron, diamonds, cobblestone and dyes

Then type `/scriptevent siege:showcase siege` to make it night and start a siege on it.

Walk around, click things, and tell me what looks wrong or does nothing. The list below is the same things done by hand, if you want to check a step on its own.

## 5. Test list by hand

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

**Plots (The Hollow Crown map)** Do these last, in Creative, because they turn map mode on for this world.
- `/give @s siege:plot_stone`, place it. ✅ A message naming the plot (the nearest planned one) and "Map mode is on".
- Place a Keep Banner anywhere else. ✅ Refused: "Keep Banners can only be raised on a Plot Stone."
- Place a Keep Banner on top of the Plot Stone. ✅ "Settlement founded" and "You hold <plot>".
- Click the Plot Stone. ✅ A menu with the region, style and a Plot Atlas button.
- `/give @s elytra`. ✅ It crumbles within a second and you get 24 emeralds.
- Switch to Survival and try to mine the Plot Stone. ✅ It doesn't break.

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

## Town hall, skill tree and paths (The Hollow Crown)

Needs a settlement first (place a Keep Banner). Cheats on for the `/scriptevent` lines.

1. **Cornerstone.** `/give @s siege:hall_cornerstone`, stand where the front door should be, face the way the hall should run, place it. A message names the style it picked from the land around you.
2. **Raise a hall.** Click the cornerstone, then "Raise the Longhouse" (48 planks + 32 cobblestone, free in Creative). It should rise layer by layer in about 10 seconds with the Tree of Oaths at the back. Check the door is open and faces you.
3. **Bigger halls without the grind.** `/scriptevent siege:townhall_build 2` up to `5`, or with a style: `/scriptevent siege:townhall_build 3 frostmarch` (vale, frostmarch, saltreach, emberwaste, blackfen). Each should replace the last one cleanly. Tell me about anything left floating, stairs or logs facing the wrong way, or missing blocks.
4. **Tree of Oaths.** Click the tree. `/scriptevent siege:award_skill_points 20` and `/scriptevent siege:townhall_renown 3000` give you points and levels. Learn a few Keep and Wayfarer skills and check they work (Fleetfoot speed, Stonewright haste in your land).
5. **The Ember.** `/scriptevent siege:townhall_ember` makes it fall near your keep (in a real game it falls after your first siege win). Pick it up. Using it offers the Marked path; carrying it to the Tree offers both.
6. **Marked.** Learn Ember Bolt, hold the Bound Ember, use it on a mob. Sneak + use picks another power. Watch the Resonance bar; push it to 100 and see what happens.
7. **Knight.** `/scriptevent siege:townhall_path knight` switches you for testing. Learn Shield Bash (sneak + hit with a shield in the off hand), Lunge (sprint + hit), Rallying Cry (use the Oath Banner).
8. `/scriptevent siege:townhall_path none` clears your path, `/scriptevent siege:townhall_reset` wipes your progress.

## The High Throne, the Citadel and usurping (The Hollow Crown)

Needs a settlement (place a Keep Banner on flat, open land) and cheats on. Best with a second player for steps 6 to 9.

**The quick way:** after `/scriptevent siege:showcase`, run `/scriptevent siege:crown_showcase`. It makes you the Heartbearer and raises the whole Citadel around the showcase in about 30 seconds, with the Great Keep just south of the exhibits. Then skip to step 3. (While you hold the Heart, raiders leave you alone, so do your `showcase siege` test first.)

1. **Become the Heartbearer.** `/scriptevent siege:crown_me`. You should get a title menu, a server-wide "All hail", the Heart of the Hollow and a Citadel Cornerstone. Try to drop the Heart: it shouldn't leave your inventory. (`/scriptevent siege:crown_offer` shows the real scene instead, where the game warns you off the Hollow Crown.)
2. **Raise the Citadel.** Place the Cornerstone 15 to 40 blocks from your banner. A gold outline shows the Great Keep's square. Click the stone and confirm. Over about 3 minutes the walls, towers, gatehouse and Great Keep should rise. Tell me about: holes in the wall, towers floating or buried, anything that never finished (a message tells you if pieces are waiting), and how bad the lag was.
3. **Walk it.** Gate opens when clicked? Wall walk goes through the towers? Ladder in the Great Keep reaches the roof? Throne on the dais facing the door?
4. **Throne menu.** Click the Throne. Set a tithe, make a Decree of Siege on another settlement, check the Treasury line.
5. **The Heart.** Use it near mobs (Kneel), sneak + use (Rally), look straight up + use away from home (Return to the Throne).
6. **Second player earns a Claim.** They run `/scriptevent siege:crown_claim 100` and `/scriptevent siege:crown_gauntlet`, then use the Gauntlet. If it says you're under grace, run `/scriptevent siege:crown_grace`.
7. **The Storm.** `/time set 12900` on a siege day (or set `siegeEveryNNights: 1` in `siege/settings.js`). When the siege starts, the Storm should begin: a Throne Seal appears in front of the throne. Check the ruler can't hurt it and the claimant can.
8. **Change hands.** Break the Seal (or `/scriptevent siege:crown_usurp`). The claimant should get the Heart and the title, the hangings should change color, and the old ruler should land outside the gate, marked [Exile], with a Keep Banner, unable to walk back in.
9. **Exile.** As the old ruler, open any Keep Banner menu and press "The High Throne" to see the Long Road Back.
10. **Shards.** `/scriptevent siege:crown_shardfall` drops one 6 blocks east of you. Mine it, use it.

## Lore, Library and Ledger (The Hollow Crown)

Run the showcase first (`/scriptevent siege:showcase`): the back row has four Archive Shelves, a Dusty Tome and the eight characters, and you are given a Ledger, a Cipher Wheel, a Tide Glass and four tomes.

1. Use a tome. **Expect:** a book screen with Next page, and on the last page "Ledger updated".
2. Hold a tome and click the empty shelf. **Expect:** the tome leaves your hand and a spine appears on the shelf front. Six fill a shelf.
3. Click a shelf with an empty hand. **Expect:** the catalog, The Oswin Chronicles at 12 / 12, and missing tomes in other collections showing a hint.
4. Read all 12 chronicles from the catalog. **Expect:** "Claim rewards" appears, and skill points arrive.
5. Use the Ledger. Open The Saint of the Gate once it has 2 clues and type `edda`. **Expect:** "Mystery solved". A wrong answer on another locks it for a day.
6. Switch to survival and click the Dusty Tome. **Expect:** a ciphered letter, once. Drop the Cipher Wheel and read it: scrambled. Pick the wheel up: plain.
7. Click Sister Wren in survival. **Expect:** her greeting with buttons, and a different greeting next time. Ask "Why is it always night?" then "Which clock was first?". **Expect:** she is cut off, you Slip into the Hollow for a few seconds (or black out, if the Hollow isn't set up), and when you click her again she reacts. If dialogue buttons do nothing, tell me: that's the one part I could not check offline.
8. `/scriptevent siege:lore_give survey`, read and shelve notes I to VI, then "Name the Thin Place" in the catalog.

## Dragons (the Emberwaste's power)

Creative, cheats on. The showcase (`/scriptevent siege:showcase`) puts a Roost, a Nest, three display dragons and **Cinder**, a grown dragon that is yours, in the extras row behind you. Take a **Dragon Horn** and some raw beef from the chests (`/give @s beef 16`).

1. Look at Cinder and the three display dragons. ✅ Blocky dragons in four colours, small / medium / large, wings folded back along the body (not sticking forward or straight out). Cinder wears a saddle, the others don't.
2. Click Cinder. ✅ You sit on its back and can walk it around with WASD like a horse. The action bar shows a green Flight bar.
3. Press jump. ✅ It lifts off and the wings flap. You fly toward wherever the camera looks; jump climbs, looking down descends. The Flight bar drains (about 54 seconds).
4. Fly low over flat ground without holding jump. ✅ It lands by itself and the bar slowly refills.
5. Take off again and stay up until the bar is empty. ✅ "is spent and glides down": it sinks slowly, you take no fall damage.
6. In the air, `/summon zombie` below you, face it and use the Dragon Horn. ✅ A line of flame, the zombie burns. No blocks catch fire.
7. In the air, sneak to jump off. ✅ You float down slowly, and so does Cinder.
8. Walk 30 blocks away and use the Dragon Horn. ✅ Cinder appears next to you.
9. Sneak + click Cinder with an empty hand. ✅ Its sheet: bond, level, training. Try "Stay here" and "Go to your Roost".
10. Click the Dragon Roost. ✅ Menu with Train (Cinder has 4 points), Wake it / Send it to roost, Rename. Train Wings and check the sheet says Flight 57s.
11. Raising one from an egg: `/scriptevent siege:dragons_reset`, click the **Dragon Nest** ✅ you get a Dragon Egg; click the Roost holding it ✅ "The egg settles"; then `/scriptevent siege:dragons_grow` ✅ a tiny hatchling that follows you. Feed it beef ✅ hearts, "Bond 8/100", and it refuses a second piece for a minute. Run the grow command twice more ✅ Fledgling (rideable on foot only), then Adult (flies).
12. Shot down: with a second player's settlement that has a Ballista, fly over it. ✅ The ballista turns and fires, "ballista hits", the Flight bar drops by a quarter per bolt, and at empty you get "Shot down" and can't take off for 30 seconds. Over your own or an ally's settlement nothing shoots.

Things I could not check without the game, so please look closely: the wings fold backward (step 1), flying actually steers by camera (step 3), flying speed feels right (faster than a horse's walk, not absurd), and the hatchling follows you.

## Settlement building: zones, the Mason and pre-designed buildings (The Hollow Crown)

The showcase (`/scriptevent siege:showcase`) puts a Mason's Bench with its mason and a Foundation Stone in the row behind you, and raises all eight pre-designed buildings in a line to the east, each in a different regional style. Switch to Survival for steps 1 to 4, because Creative ignores the build rules and pays nothing.

1. **Build zones.** `/scriptevent siege:settle_zone` says which zone you stand in. On your land away from the hall you should be able to place anything. Hold any block and walk toward the town hall: a line of blue flame marks the ground kept clear for the hall to grow into, and placing a block inside it should be refused with a message.
2. **The wilds.** In a test world with no Plot Stones, building outside your land is still allowed. `/scriptevent siege:settle_wilds on` turns the real rule on: outside your land you should only be able to place camp things (torch, bed, chest, crafting table, furnace, campfire, ladder, sapling). `off` and `map` switch back.
3. **The Mason.** Click the mason. Buy a few blocks with emeralds (the Supplies chest has 64). The first shelf is your region's own materials at a better price. Check the slider, that the blocks arrive, and that the emeralds go.
4. **A pre-designed building.** Take the Foundation Stone (or buy one from the mason for 4 emeralds), place it on open ground on your land while facing the way the building should run, click it and pick a building. A green outline shows where it will stand. Click the stone again to see the price (planks and building stone you carry, emeralds for what you lack) and raise it. The stone should come back to your pack when it is done. Try placing one so the outline crosses the hall reserve or your border: it should refuse.
5. **Any building, free.** `/scriptevent siege:settle_build cottage frostmarch` raises one in front of you (cottage, smithy, stable, storehouse, watchtower, market, well, garden; vale, frostmarch, saltreach, emberwaste, blackfen). Tell me about stairs facing the wrong way, anything floating, and which designs look too plain.
6. **A town mason.** `/scriptevent siege:settle_mason` puts a mason where you stand, with no bench (for Kingsrest and villages).

### Walls, Castle Stone and the laid-out plot

- **Wall round your plot.** With a Keep Banner up, run `/scriptevent siege:wall 1`. A stake fence should rise in a ring 56 blocks out, with a gap facing the gate side. Try `/scriptevent siege:wall 5`, then `8`, then `10`, and tell me if each one follows hills cleanly, if the gate and portcullis hang straight, and how long level 10 takes to rise. Add a region to see its stone: `/scriptevent siege:wall 6 frostmarch`.
- **Raiders outside the wall.** Start a siege with a wall up. Raiders should appear just outside the ring and walk in. If they stand still out there, tell me: that means they are too far for the Realm to move them.
- **Arrival.** `/scriptevent siege:settle_arrive` lays out your settlement: the wall, a Longhouse rising behind the banner, a Mason at a bench, and a signpost on every spot where a building will go. On the real map this happens by itself when you pick a plot in the welcome hall.
- **Castle Stone family.** Ask the Mason for Castle Stone, Tiles, Bricks, Cobbled and Smooth. In your own region you get your region's stone at the local price; the other regions' stone costs more.
- **Wall damage and repair.** The generated wall takes damage like any Siege Nights wall: rams and blasts wear blocks down, the stone shows two stages of cracks, then breaks. From level 6 up the wall is as tough as iron-reinforced Castle Stone, level 9 as diamond, level 10 as netherite. Stand by your wall and run `/scriptevent siege:wall_repair break` to rough it up, then talk to the Mason and pick **Mend the wall**: he names a price that follows the damage and the wall is made whole. `/scriptevent siege:wall_repair free` mends without paying. The masons refuse during a siege; patching one block by hand with stone bricks still works then, now on Tiles, Bricks, Cobbled and Smooth too.
- See the whole thing in 3D first: https://claude.ai/artifact/McgJY7tPcd84szWCqsJzoK

## Rival Lords: NPC neighbours for single-player (The Hollow Crown)

Rival Lords only settle on a map with Plot Stones. Place three or four Plot Stones in Creative at least 160 blocks apart (two are always left free for players).

1. `/scriptevent siege:rivals all` then `/scriptevent siege:rivals settle` (repeat `settle` for each new lord; normally one arrives per day). `/scriptevent siege:rivals list` shows who holds what.
2. Walk to a lord's Plot Stone. Their longhouse, a cottage and a well should rise near it, and the lord stands by the stone. In Survival you should not be able to break or place blocks on their land, or raise your own banner on their stone.
3. `/scriptevent siege:rivals grow <id>` moves a lord up a tier (the id is in the list); more buildings rise. `/scriptevent siege:rivals night` plays one siege night for all of them.
4. Click the lord and choose "Lay siege" (you need your own settlement). Kill every soldier within 10 minutes: the lord falls, you get emeralds, and the plot with its buildings is free to claim. Die or walk away and they hold.
5. `/scriptevent siege:rivals none` removes them all.
