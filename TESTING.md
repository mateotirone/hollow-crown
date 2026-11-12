# The Hollow Crown: first playtest

About 20 minutes. Go down the list, and for anything that doesn't happen the way it says, send me a screenshot or a sentence. "Nothing happened" is a useful answer too.

## 1. Install

You need Minecraft Bedrock **26.30 or newer** (the pack will not load on anything older).

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

✅ A grey line "Build 1.2.x. Running the self-test..." and then a green line starting "Self-test passed". The build number should match the one you were given.

If all you see is Minecraft's own "Script event ... has been sent" line, the world is running an old copy of the pack: delete every Hollow Crown pack in Settings > Storage, import the new file and make a new world.

If it's red, it lists what's wrong (for example a block the pack is missing). Send me that list and skip the rest. If nothing appears at all, the scripts didn't load: tell me your Minecraft version.

## 4. The showcase (the quick way)

Make the world **Flat** if you can, stand somewhere open, and type `/scriptevent siege:showcase`.

✅ A settlement appears south of you with everything in it, each with a sign:
- your Keep Banner, and one of every block in a labelled row (including reinforced and cracked Castle Stone, open gates)
- a piece of castle wall with battlements, arrow slits and a working portcullis
- a Ballista, a Trebuchet and a Battering Ram
- five Archers, one in each armor, a Man-at-Arms at the Barracks with two villagers to recruit, and a Quartermaster at his desk
- chests behind you with one of every item, plus coins, iron, diamonds, cobblestone and dyes

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
12. `/give @s siege:barracks`, place it, `/summon villager` next to it, then click the Barracks with coins in hand (`/scriptevent siege:economy_give 200`; a guard is 40 Regals). ✅ The villager becomes a Man-at-Arms.
13. Sneak + click the guard. ✅ He goes into your inventory. Place him on a wall. Repeat with sneak + coins in hand on the Barracks for an Archer.

**Siege**
14. `/time set 13000`, then `/give @s siege:war_horn` and use it. ✅ "Siege Night" title, then raiders arrive from one direction.
15. Watch for a while. ✅ Raiders head toward your banner, your archers shoot them, and men-at-arms run out.
16. `/gamemode s` and fight. Try to win (kill all three waves). ✅ You get Regals and a win message.

**Quartermaster**
17. `/give @s siege:quartermaster_desk`, place it, and `/summon villager` next to it. ✅ He becomes the Quartermaster and you can trade with him.

**Plots (The Hollow Crown map)** Do these last, in Creative, because they turn map mode on for this world.
- `/give @s siege:plot_stone`, place it. ✅ A message naming the plot (the nearest planned one) and "Map mode is on".
- Place a Keep Banner anywhere else. ✅ Refused: "Keep Banners can only be raised on a Plot Stone."
- Place a Keep Banner on top of the Plot Stone. ✅ "Settlement founded" and "You hold <plot>".
- Click the Plot Stone. ✅ A menu with the region, style and a Plot Atlas button.
- `/give @s elytra`. ✅ It crumbles within a second and you get 3 Gold Regals.
- Switch to Survival and try to mine the Plot Stone. ✅ It doesn't break.

**Welcome hall and test area (in the sky)** Creative, after at least one Plot Stone is placed.
- `/scriptevent siege:welcome build here` on flat ground (or `build` on the real map: it takes you to the hall's place high over Gull Bay). ✅ After a few seconds, a 101 x 101 block miniature of the whole map (coast, mountains, rivers, towns, forests) with a stone rim. You stand on a quay out in its sea beside the Waystone, and twelve green glowing Map Stones stand on the plots' real spots, each with its name floating over it when you are close.
- Click the Waystone with an empty hand. ✅ A menu with "How things stand", "Where you start" and "Choosing a home".
- Walk over to a Map Stone and click it with an empty hand. ✅ The plot's region, land and style, and "Free". Stones for plots with no Plot Stone yet say "Not on this map yet".
- Switch to Survival, click a free Map Stone, choose "Start in ...", confirm. ✅ You land beside that Plot Stone holding a Keep Banner, and everyone is told.
- `/scriptevent siege:welcome go` (Creative) and click the same Map Stone. ✅ It has gone dark and it shows who chose it, their level and their settlement level.
- With a friend (or second account) in Survival with no keep: they join. ✅ They arrive on the quay, can walk all over the miniature but can't walk off it, and the taken plot can't be picked.
- `/scriptevent siege:welcome testarea`. ✅ A glass floor in the sky with the whole showcase laid out on it. Running it again just takes you back there.
- On a world that already had the old round hall: load it. ✅ The miniature goes up in its place (a little lower in the sky), anyone waiting is moved to the quay, then the old terrace disappears.
- `/scriptevent siege:welcome release <name>` frees someone's pick; `status` lists all twelve.

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

## The story opening on the real map (scripts/opening/)

Use `hollow-crown-full-map.mcworld`, not a flat test world. That file is saved in **Creative**, so switch the world (or the Realm) to **Survival** before anyone joins for the first time: Creative players count as builders and skip the hall. Time is stopped in the file; the setup starts the day/night cycle.
1. Join a fresh copy of the map. You should stand on the Kingsrest square for a few seconds ("The road is long. One moment...") while the map sets itself up.
2. You are lifted to the welcome hall. Click the Waystone, read "How things stand", and check the journal turns up in your pack.
3. All twelve rim stones should be lit (free). Pick one: you land next to its Plot Stone with a Keep Banner, are told what stood there, and about 20 seconds later get the plot's first book. Its last page sends you to Sister Wren in Millbrook.
4. Ride or walk to Millbrook (north-east of Kingsrest). Wren stands under a small porch on the north side of the square. Ask her "Why is it always night?", then "Which clock was first?": she is cut off and you Slip.
5. With a second player, choose "Start in Kingsrest without a home" instead: about 30 seconds later a carter should point you to Wren and Millbrook is added to your Ledger.
6. Builder check: `/scriptevent siege:opening status` should say `map` and 16 of 16 done.

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


### The tree screen (new: please check this one first)

1. Run `/scriptevent siege:showcase`, walk into the hall and click the Tree of Oaths. Pick **Arcana** or **Keep**.
2. ✅ A wide dark panel opens with the branch name in gold, your skill points under it, and the skills laid out in rows (first ring at the top) with lines joining them. Each skill is a small round badge with its name under it. Empty spots are empty.
3. Click a skill. ✅ Its page opens with what it does and a button to swear it. Go back: the badge has changed.
4. Open a normal menu (the Town Hall menu, the Rumor Board). ✅ These still look like ordinary Minecraft menus.

If step 2 shows a blank or broken screen, press Escape, open the Tree again and choose **Show branches as plain lists** on its first page. Everything works from the lists. Send me a screenshot of what the broken screen looked like.

### The four regional roles

For each of `rider`, `forgemaster`, `captain`, `witch`: type `/scriptevent siege:townhall_path none`, then `/scriptevent siege:townhall_path <role>`, then `/scriptevent siege:townhall_renown 5000`.

1. ✅ A title shows the role name, and chat says the role's branch is open.
2. Open the Tree of Oaths. ✅ The first page shows your role and rank, and one extra branch (Wing, Forge, Helm or Hex). The other three roles' branches are not listed.
3. Swear a first-ring skill and check it: Witch's Touch poisons what you hit, Emberblood lets you stand in fire, Hammer Arm gives Haste with a pickaxe in hand, Sea Legs lets you breathe underwater.
4. To see the offer the normal way: `/scriptevent siege:townhall_path none`, then kill the Mother of Changelings (summon `siege:mother_of_changelings` and fell her while standing within 64 blocks). ✅ Chat says a path has opened, and "Choose your path" at the Tree offers Witch. The Pale Huntsman offers Forgemaster and the Drowned Bride offers Captain the same way. Building a hall no longer offers a role.

### Rumor Board variety

Take and finish a few jobs from the Rumor Board over several in-game days. ✅ The board never offers the kind of job you just did, the three jobs come from three different people, and about one job in three ends with a surprise: a named keepsake, double pay, extra Renown, or someone who cannot pay and stands with your walls instead.

## The High Throne, the Citadel and usurping (The Hollow Crown)

Needs a settlement (place a Keep Banner on flat, open land) and cheats on. Best with a second player for steps 6 to 9.

**The quick way:** after `/scriptevent siege:showcase`, run `/scriptevent siege:crown_showcase`. It makes you the Heartbearer and raises the whole Citadel around the showcase in about 30 seconds, with the Great Keep just south of the exhibits. Then skip to step 3. (While you hold the Heart, raiders leave you alone, so do your `showcase siege` test first.)

1. **Become the Heartbearer.** `/scriptevent siege:crown_me`. You should get a title menu, a server-wide "All hail", the Heart of the Hollow and a Citadel Cornerstone. Try to drop the Heart: it shouldn't leave your inventory. For the real scene, run `/scriptevent siege:crown_offer` first instead: the Heart should appear at your feet with a warning about the Hollow Crown in chat. Click it. Everyone should see "is reaching for the Heart", a 10 second countdown should run, and then it is yours. Try again (`siege:crown_reset`, reload) and this time walk away or take damage during the countdown (jump off something, or have a friend hit you): the reach should break and the Heart should stay put.
2. **Raise the Citadel.** Place the Cornerstone 15 to 40 blocks from your banner. A gold outline shows the Great Keep's square. Click the stone, type a name for your Citadel (or leave it empty for Aldspire) and press Raise it. The name you typed should appear in the announcement and when you walk across the border. Over about 3 minutes the walls, towers, gatehouse and Great Keep should rise. Tell me about: holes in the wall, towers floating or buried, anything that never finished (a message tells you if pieces are waiting), and how bad the lag was.
3. **Walk it.** Gate opens when clicked? Wall walk goes through the towers? Ladder in the Great Keep reaches the roof? Throne on the dais facing the door?
4. **Throne menu.** Click the Throne. Set a tithe, make a Decree of Siege on another settlement, check the Treasury line.
5. **The Heart.** Use it near mobs (Kneel), sneak + use (Rally), look straight up + use away from home (Return to the Throne).
6. **Second player earns a Claim.** They run `/scriptevent siege:crown_claim 100` and `/scriptevent siege:crown_gauntlet`, then use the Gauntlet. If it says you're under grace, run `/scriptevent siege:crown_grace`.
7. **The Storm.** `/time set 12900` on a siege day (or set `siegeEveryNNights: 1` in `siege/settings.js`). When the siege starts, the Storm should begin: a Throne Seal appears in front of the throne. Check the ruler can't hurt it and the claimant can.
8. **Change hands.** Break the Seal (or `/scriptevent siege:crown_usurp`). The claimant should get the Heart and the title, the hangings should change color, and the old ruler should land outside the gate, marked [Exile], with a Keep Banner, unable to walk back in.
9. **Exile.** As the old ruler, open any Keep Banner menu and press "The High Throne" to see the Long Road Back.
10. **Shards.** `/scriptevent siege:crown_shardfall` drops one 6 blocks east of you. Mine it, use it.

**Alone (rival lords).** No second player needed for any of this.

11. **A lord challenges you.** As the Heartbearer, run `/scriptevent siege:crown_rival`. Lord Corwin Ashgrave should throw down the Gauntlet. Start a siege night (`/time set 12900` on a siege day). Raiders should march on you even though you hold the Heart, with a bigger army, and Lord Corwin Ashgrave should take the field in the last assault. Win the siege and you should see "holds the throne".
12. **A lord takes the throne.** `/scriptevent siege:crown_lord`. You should lose the Heart, land outside as an [Exile] with a Keep Banner, and the throne menu should say Lord Corwin Ashgrave rules. Your siege winnings should be tithed at 20%, and after a siege night the lord should decree a siege on you (every other night when you're the only settlement).
13. **Take it back.** Found a new keep away from the old one (it should refuse close by), then `/scriptevent siege:crown_claim 100`, `/scriptevent siege:crown_grace`, use a Gauntlet (`/scriptevent siege:crown_gauntlet`) and start a siege night. A Throne Seal should stand in the throne room (or beside your old banner spot if there's no Citadel) guarded by the lord and six soldiers. Break the Seal: the Heart, the keep and the lord's Treasury should be yours.

## Lore, Library and Ledger (The Hollow Crown)

Run the showcase first (`/scriptevent siege:showcase`): the back row has four Archive Shelves, a Dusty Tome and the twelve characters, and you are given the Old King's Journal, a Ledger, a Cipher Wheel, a Tide Glass and four tomes.

0. Use the Old King's Journal. **Expect:** a cover page, then 12 entries; after the last, "Ledger updated: The Old King's Journal". In a brand new world you should get the journal by yourself about 5 seconds after first joining, with the message "There is an old journal in your pack." Show it to Sister Wren ("I have an old journal").
0c. Run `/scriptevent siege:hum`. **Expect:** a low held note for about 7 seconds (placeholder sound). Then stand in the Hollow, or wait for a third night, or spawn a Returned with `/scriptevent siege:returned_spawn` and stand next to it: the same note, quietly, with no gaps. `/scriptevent siege:hum off` should silence it for you only.
0d. Run `/scriptevent siege:journal_last_page`, then read the journal to the end. **Expect:** "The old journal in your pack is heavier than it was", and a 13th page in another hand, signed.
0e. Hidden Returned: `/scriptevent siege:lore_case harl` then ring a bell within 16 blocks. **Expect:** Harl Dunn stops and walks off, and talking to Nessa afterwards gets her "after" scene. `siege:lore_case bram` and a bell: nothing happens (he is himself). Ring a bell beside Hesper (not the showcase one): she speaks, walks off and is gone.
0f. Talk to Brother Cael ("The portraits you burned"), Sigrun ("Why did the Grey Host come?", "Is it still being rung?", "Say it outdoors, then.") and Old Mag ("The day they took the king."). Then talk to Archivist Pell. **Expect:** he opens with three "cards" and will not say the name.
0g. Local books: `/scriptevent siege:local_lore harrowford`. **Expect:** what stood at Harrowford, a builder note, and three books in your pack; reading two of them opens the Ledger page "The Field Without Bones", which accepts 3:17. On a real plot, picking it at the welcome hall should tell you its past after a few seconds, and the Library should have one book on its bottom shelf.
0h. Portraits: in creative, look at the side of a wall block from close up and run `/scriptevent siege:portrait gallery`. **Expect:** eight paintings in a row along the wall to your right (seven wide, one tall), flat against it and facing you. `/scriptevent siege:portrait wrenfield` hangs three portraits. Click one in survival: a name, a role and a line. Punch one in creative: it comes down. PLEASE CHECK which way they face and whether they sit flush; this has never run in a real game.
0i. Ravens: `/scriptevent siege:ravens`. **Expect:** one grey line about ravens on your wall. In play it appears by itself at dusk on a raid day.
0j. Moon door: in creative, build a 2 by 3 wall of any blocks, look at its bottom-left block and run `/scriptevent siege:moon_door full`, then `/scriptevent siege:moon_door test`. **Expect:** the six blocks vanish for 30 seconds and come back exactly as they were. `/time set midnight` on a new-moon day should open it too, and dawn should close it. Walk up to it: a line says which moon is carved there.
0k. Corvin: `/scriptevent siege:corvin` plays his first three lines. As a Sorcerer with a skill learned and the flag set, a remark about that art follows within ten seconds. `/scriptevent siege:lore_npc corvin`: as a Knight you get only "the pool is singing"; as a Sorcerer he talks.
0b. Use The Fourteen Arts (given in the showcase; in play, Old Mag hands it over once you are a Sorcerer and she believes you). **Expect:** a cover, 14 pages and a last page. A page for a power you have sworn ends with an extra purple line. Reading a Field Note, finishing the First Slip, asking Sigrun "Why did the Grey Host come?", and naming the thin place should each show "Something you did not understand before makes sense now."
1. Use a tome. **Expect:** a book screen with Next page, and on the last page "Ledger updated".
2. Hold a tome and click the empty shelf. **Expect:** the tome leaves your hand and a spine appears on the shelf front. Six fill a shelf.
3. Click a shelf with an empty hand. **Expect:** the catalog, The Oswin Chronicles at 12 / 12, and missing tomes in other collections showing a hint.
4. Read all 12 chronicles from the catalog. **Expect:** "Claim rewards" appears, and skill points arrive.
5. Use the Ledger. Open The Saint of the Gate once it has 2 clues and type `edda`. **Expect:** "Mystery solved". A wrong answer on another locks it for a day.
6. Switch to survival and click the Dusty Tome. **Expect:** a ciphered letter, once. Drop the Cipher Wheel and read it: scrambled. Pick the wheel up: plain.
7. Click Sister Wren in survival. **Expect:** her greeting with buttons, and a different greeting next time. Ask "Why is it always night?" then "Which clock was first?". **Expect:** she is cut off, you Slip into the Hollow for a few seconds (or black out, if the Hollow isn't set up), and when you click her again she reacts. If dialogue buttons do nothing, tell me: that's the one part I could not check offline.
8. `/scriptevent siege:lore_give survey`, read and shelve notes I to VI, then "Name the Thin Place" in the catalog.

0k2. **Ravens on the wall.** Stand inside your settlement and run `/scriptevent siege:ravens`. Besides the message, that many ravens should be sitting in a row on top of the wall nearest you (or in a ring near the keep if you have no wall), all facing outward. Check they sit on the wall top and not inside it or in the air.

0l. **The morning after the first sighting.** Run `/scriptevent siege:morning_after`. Three lines from your own townsfolk should appear a few seconds apart. Then talk to Sigrun, Brother Cael, Old Mag, Sir Aldous or Archivist Pell (after you have met them): each opens once with a new conversation about the tall thing at your wall, and never repeats it. In a real game this happens the dawn after the siege where the first Hollow soldiers appear.

0m. **The story spine.** `/scriptevent siege:local_lore <plot>` and read the first book: its last page, in a newer hand, should send you to Millbrook and Sister Wren, and Millbrook should appear as a lead in the Ledger. Solve the plot's mystery in the Ledger: the answer ends with a paragraph about your own region's boss and adds its place as a lead. Kill a regional boss (`/scriptevent siege:bestiary_summon reeve`): besides its book you get a line about a scrap and two new leads in two other regions. After the third regional boss, a purple line about a surveyor appears and the first Field Note is in your pack.

0n. **The hidden third ending (the truce).** In the Hollow, with Morvane beaten (`/scriptevent siege:reach_stage 6` makes the story count as over), run `/scriptevent siege:truce_know`, then walk to the middle of the Seat. **Expect:** a box: "The Seat is empty...", with a line to type in. Type something else: a grey line, nothing happens, and it asks again a minute later. Type `Hallowmere`: darkness, then six lines from the Choir one after another, then a purple line in chat for everyone, and a few seconds later a "The Truce Holds" panel explaining Guest Nights, trading and the bell (once per player; `/scriptevent siege:truce_explain` shows it again). A player who has solved only "The Name We Were" gets "Find the rest of it" instead. `/scriptevent siege:truce_status` says `kept`.
   - Guest Night: `/scriptevent siege:truce_guests` (it turns the time to night). **Expect:** two guests by every keep, three at Reedmoor's Even Market (ring of posts), and two next to you. Click one: a line and two trades (honey, iron nuggets, sugar cane or amethyst for a Glimbulb, Latticewood, raw Choir Ore or a mend of the thing in your hand). The Market keeper has all four. At dawn they are gone, with a grey line. On a real third night they come by themselves at dusk.
   - In the Hollow while it holds, Gloamwings should leave you alone. A Returned rung out by a bell walks home and takes nobody.
   - Ring a bell inside Bellhollow (155, -100). **Expect:** a box asking whether to ring it. "Ring it": red lines for everyone, guests vanish, a "The Truce Is Broken" panel explains what changed, status says `broken`. The next third night is a full siege again with Hollow soldiers (`/scriptevent siege:reach_night oathbroken` to force one now). Trying the Seat again within 9 days gets "Not yet"; after that it works, and the Choir says something different the second time.

## Dragons (the Emberwaste's power)

Look first, without the game: the 3D viewer at https://claude.ai/artifact/D42qsWXjEcxWAbsYacsw4v shows all four species, every pose and every sound.

In game: Creative, cheats on. `/scriptevent siege:showcase` puts a Roost, nine display dragons (the four species, a hatchling, a fledgling, one asleep, one unconscious, one dead) and **Cinder**, a grown Cinderwing that is yours, in the extras row behind you, and a whole 9x9 **Dragon Nest** west of that row. Take a **Dragon Horn** from the chests, and `/give @s beef 16` and `/give @s golden_apple 4`.

**Looks and flying**
1. Walk along the display dragons. ✅ Four clearly different animals (four-legged Cinderwing, two-legged Ashen Wyvern, squat armoured Dune Drake, long frilled Glass Wyrm). Wings tucked down along the flanks, the outer half folded over the inner (not sticking out sideways or lying flat). The sleeper breathes slowly, the unconscious one breathes fast and drips red, the dead one lies rolled over and does not move.
2. Click Cinder with an empty hand. ✅ It nuzzles you and you do not climb on. Left-click (punch) it with an empty hand ✅ the same nuzzle, no damage, no red flash. Now click it holding anything (the Dragon Horn). ✅ You sit on its back and can walk it with WASD. The action bar shows a green Flight bar.
3. Press jump. ✅ It lifts off, wings flap with a wingbeat sound. You fly where the camera looks; jump climbs, looking down descends. The bar drains (about 54 seconds).
4. Fly low over flat ground without holding jump. ✅ It lands by itself and the bar slowly refills.
5. Stay up until the bar is empty. ✅ "is spent and glides down", no fall damage.
6. In the air, `/summon zombie` below you, face it and use the Dragon Horn. ✅ A line of flame and a roar of fire; the zombie burns. No blocks catch fire.
7. In the air, sneak to jump off. ✅ You both float down.
8. `/scriptevent siege:dragons_species 1` (then 2, 3, 0). ✅ Cinder changes species. Each breath is different: 1 ash (blinds), 2 sand (throws back), 3 glass (slows and weakens).

**Its mind**
9. Sneak + click Cinder with an empty hand. ✅ Its sheet shows a temperament, a mood and "Favourite food: not found yet". Choose "Pet it". ✅ It nuzzles, purrs, and a grey italic line describes what it does.
10. Feed it beef, then other raw meats and fish a minute apart. ✅ One of them gets "You have found its favourite". Offer rotten flesh ✅ a proud or well-fed dragon spits it back.
11. `/scriptevent siege:dragons_hungry`, then stand near it holding beef. ✅ Within a few seconds: "It is staring at the beef in your hand". Put the beef away near some sheep ✅ it takes one for itself.
12. `/summon zombie ~12 ~ ~`. ✅ Within a few seconds it snarls and you are told which compass direction it is staring.
13. Get off, switch to Survival and let a zombie hit you. ✅ Cinder throws itself at the zombie ("puts itself between you and it").
14. Hit Cinder yourself with a sword or any item in hand. ✅ "It flinches away from you", bond drops. With a second player: they hit it with an item, then try to pet or ride it ✅ it snarls and refuses them, and its sheet says it holds a grudge.
15. `/time set midnight`, tell it "Stay here" and walk 20 blocks away. ✅ It curls up asleep. Walk back ✅ "opens one eye at your footsteps".
16. Use the horn from 30 blocks away. ✅ It comes, roaring. (When it is sulking or sullen it may refuse.)

**Down, not dead**
17. `/scriptevent siege:dragons_down`. ✅ Cinder collapses on its side, breathing fast (you can hear it), dripping red. You can't ride it. Title: "Cinder is down. It is still breathing".
18. Click it with a golden apple. ✅ "You tend its wounds", bleeding stops, breathing slows; a minute later it wakes and won't fly for two minutes.
19. Knock it down again and, as a second player who is not your ally, hit it five times. ✅ It dies: rolled over, jaw slack, no breathing, no name. The body stays about five minutes (longer during a siege), then crumbles to ash. The owner sees "Cinder is dead".
20. Shot down: fly over a second player's settlement with a Ballista. ✅ Bolts knock the Flight bar down a quarter each; at empty you get "Shot down", it falls, and it hits the ground unconscious.

**The nest**: walk to the 9x9 nest west of the extras row ✅ a round nest of woven branches sunk into the ground, rim two to three blocks high with twigs flaring off the top, a straw floor with a bone, ribs, scales or a skull here and there, and three big dark red eggs in the middle. Try to break any part of it in Survival ✅ nothing breaks; set off TNT next to it ✅ it stays. Place a **Dragon Nest** from the creative menu in Creative ✅ a whole nest grows round it; in Survival ✅ it vanishes ("only grow in the wild").

**Raising one**: `/scriptevent siege:dragons_reset`, click the eggs in the **Dragon Nest** ✅ an egg, and the clutch turns to broken shell; click the Roost holding it ✅ "The egg settles"; `/scriptevent siege:dragons_grow` ✅ cracking sound, a tiny chirping hatchling of a random species that follows you. Run the grow command twice more ✅ Fledgling (walks with you on its back), then Adult (flies).

Things I could not check without the game, so please look closely: flying actually steers by camera, flying speed feels right, the hatchling follows you, the sounds are any good in game, and the unconscious dragon really can't be killed by one more hit.

## Settlement building: zones, the Mason and pre-designed buildings (The Hollow Crown)

The showcase (`/scriptevent siege:showcase`) puts a Mason's Bench with its mason and a Foundation Stone in the row behind you, and raises all eight pre-designed buildings in a line to the east, each in a different regional style. Switch to Survival for steps 1 to 4, because Creative ignores the build rules and pays nothing.

1. **Build zones.** `/scriptevent siege:settle_zone` says which zone you stand in. On your land away from the hall you should be able to place anything. Hold any block and walk toward the town hall: a line of blue flame marks the ground kept clear for the hall to grow into, and placing a block inside it should be refused with a message.
2. **The wilds.** In a test world with no Plot Stones, building outside your land is still allowed. `/scriptevent siege:settle_wilds on` turns the real rule on: outside your land you should only be able to place camp things (torch, bed, chest, crafting table, furnace, campfire, ladder, sapling). `off` and `map` switch back.
3. **The Mason.** Click the mason. Buy a few blocks with Regals (the Supplies chest has 8 Gold Regals). The first shelf is your region's own materials at a better price. Check the slider, that the blocks arrive, and that the coins go.
4. **A pre-designed building.** Take the Foundation Stone (or buy one from the mason for 32 Regals), place it on open ground on your land while facing the way the building should run, click it and pick a building. A green outline shows where it will stand. Click the stone again to see the price (planks and building stone you carry, emeralds for what you lack) and raise it. The stone should come back to your pack when it is done. Try placing one so the outline crosses the hall reserve or your border: it should refuse.
5. **Any building, free.** `/scriptevent siege:settle_build cottage frostmarch` raises one in front of you (cottage, smithy, stable, storehouse, watchtower, market, well, garden; vale, frostmarch, saltreach, emberwaste, blackfen). Tell me about stairs facing the wrong way, anything floating, and which designs look too plain.
6. **A town mason.** `/scriptevent siege:settle_mason` puts a mason where you stand, with no bench (for Kingsrest and villages).

### Walls, Castle Stone and the laid-out plot

- **Wall round your plot.** With a Keep Banner up, run `/scriptevent siege:wall 1`. A stake fence should rise in a ring 56 blocks out, with a gap facing the gate side. Try `/scriptevent siege:wall 5`, then `8`, then `10`, and tell me if each one follows hills cleanly, if the gate and portcullis hang straight, and how long level 10 takes to rise. Add a region to see its stone: `/scriptevent siege:wall 6 frostmarch`.
- **Raiders outside the wall.** Start a siege with a wall up. Raiders should appear just outside the ring and walk in. If they stand still out there, tell me: that means they are too far for the Realm to move them.
- **Build your wall in any stone.** Raise a level 3 or 4 wall from the town hall paying in plain cobblestone or sandstone: it should be accepted. Then click the Mason and choose "Choose what the wall is built in", pick Deepslate and Blackfen timber, leave "Re-face" on: the standing wall should change over without charging you. Raise the next level: it should come out in deepslate. Tell me if a raider still breaks a deepslate wall faster than a Castle Stone one.
- **Regional wall blocks.** In `/scriptevent siege:showcase` there are five stacks, one per region: palisade, wall planks, roof shingles, a gate and a portcullis. Each should have its own look, and each gate and portcullis should open on a click and take iron, diamond and netherite like the Vale's. Then `/scriptevent siege:wall 1` in two different regions: the palisades should differ. Tell me if any block shows as pink and black, or a gate does not open.
- **Arrival.** `/scriptevent siege:settle_arrive` lays out your settlement: the wall, a Longhouse rising behind the banner, a Mason at a bench, and a signpost on every spot where a building will go. On the real map this happens by itself when you pick a plot in the welcome hall.
- **Town layouts and Plot Markers.** On flat, open ground (Creative is fine for looking, Survival for paying) run `/scriptevent siege:town found dunehold`. ✅ Over a few seconds roads, the town square, lamps and a well appear round you, a Longhouse starts rising, a Mason's Bench stands by the square, a low log palisade rises 36 blocks out (standing on the ground everywhere, never sunk into it), the library goes up on a square plot, and a Plot Marker (a post with a sign) stands at the front of every open plot. Use a marker. ✅ Only buildings that fit that plot are listed; ones your tier has not opened are greyed. Pick one: a green outline shows on the plot. Use the marker again, pay, and it rises; when it is done the marker moves beside its door, and using it offers the owner (not allies) to knock the building down (half the price back to the owner). Then `/scriptevent siege:town tier 1`. ✅ The fence comes down and a new one rises 46 blocks out, the old line becomes a ring road, and new markers appear. `tier 2` and `tier 3` take it to 56 and 66. During a siege `tier` says the town grows when it ends, and it does. `/scriptevent siege:town info` says which layout you got. Try `found harrowford 2` for another layout. On the real map this happens by itself when you pick a plot in the welcome hall. Tell me if the roads float or sink against the real ground, and if a marker ends up somewhere silly.
- **Plot sizes and charters.** In a fresh town, use markers on plots of different sizes. ✅ A Small plot offers cottage, well, garden; a Medium the smithy; a long Medium the library, stable, storehouse and (from Town) the market; a watchtower is greyed with "needs a plot by the wall" unless the plot touches the wall. Good spots say "(good spot)". `/scriptevent siege:town charter` lists what your tier needs. Win sieges until the keep would be a City while you have fewer than 3 cottages or no market. ✅ Chat says the settlement has won enough but lists the charter, and the wall stays put. Finish the missing buildings. ✅ When the last one is done the town grows by itself. Farmhouse, Mint and Inn have no ready-made design yet: build them by hand and register them (Farmhouse: a composter, 9 farmland and a roof; Mint: 2 chests or barrels and an anvil under a roof; Inn: 3 beds and 2 chests under a roof). `tier N` still skips the charter for testing. When a building finishes, ✅ its marker stands on grass beside the door, not on the road or door step.
- **Your own builds and settlers.** On an empty Small plot, build a little hut by hand: walls, a roof, a door and a bed. Use the plot's marker and pick "I built here myself". ✅ It counts as a Cottage and the marker moves beside the door. Try it first without the bed: ✅ it says what is missing. Raise or build a cottage with a bed, then `/scriptevent siege:settlers dawn`. ✅ A settler appears at the door and chat says who moved in. Build a smithy (or register one with an anvil and furnace) and a second bed, `dawn` again: ✅ a Smith arrives. `/scriptevent siege:settlers dusk` sends them to bed, `list` shows everyone and the free beds. Talk to one: ✅ a hand-written line. Knock the smithy down and run `dawn`: ✅ the Smith shows "(idle)". Break a bed and run `dawn`: ✅ its settler moves to another free bed, or stays one more dawn and then leaves if there is still none. Tell me if a settler stands somewhere silly.
- **The level-5 hall takes its ground.** In a town, find a plot whose menu says "on ground the hall will need at level 5", raise a building on a plot tagged hall5, then take the hall to level 5 (`/scriptevent siege:townhall_build 5`). ✅ When it starts (or at the latest when it is done) chat says the hall needs that ground, the building is cleared except where the hall stands, the full price comes back, and the next building you raise on a plot of that size says it is free. ✅ The old plot has no marker any more.
- **Castle Stone family.** Ask the Mason for Castle Stone, Tiles, Bricks, Cobbled and Smooth. In your own region you get your region's stone at the local price; the other regions' stone costs more.
- **Wall damage and repair.** The generated wall takes damage like any Siege Nights wall: rams and blasts wear blocks down, the stone shows two stages of cracks, then breaks. From level 6 up the wall is as tough as iron-reinforced Castle Stone, level 9 as diamond, level 10 as netherite. Stand by your wall and run `/scriptevent siege:wall_repair break` to rough it up, then talk to the Mason and pick **Mend the wall**: he names a price that follows the damage and the wall is made whole. `/scriptevent siege:wall_repair free` mends without paying. The masons refuse during a siege; patching one block by hand with stone bricks still works then, now on Tiles, Bricks, Cobbled and Smooth too.
- **Library.** `/scriptevent siege:settle_arrive` (or picking a plot on the real map) now also raises the town's Library near the gate: two storeys of bookshelves, a reading table, a lectern and eight Archive Shelves on the back wall. Click an Archive Shelf with a Lore Tome to check it works. To see just the building: `/scriptevent siege:settle_build library frostmarch`.
- **Taking over a lord's settlement.** With a Rival Lord settled (`/scriptevent siege:rivals settle`, then `grow <id>` a couple of times and stand near while it builds), topple them and raise your Keep Banner on their Plot Stone. You should become the same tier they were, with their hall, buildings and wall now yours. Tell me if anything of theirs is missing or cannot be changed.
- **Wall variation.** Walk a level 8 wall (`/scriptevent siege:wall 8`): look for patches of rougher stone, arrow slits, lanterns on the wall top and towers of different heights. Break a stretch, mend it at the Mason, and check it comes back looking the same.
- See the whole thing in 3D first: https://claude.ai/artifact/McgJY7tPcd84szWCqsJzoK

## Rival Lords: NPC neighbours for single-player (The Hollow Crown)

Rival Lords only settle on a map with Plot Stones. Place three or four Plot Stones in Creative at least 160 blocks apart (two are always left free for players).

1. `/scriptevent siege:rivals all` then `/scriptevent siege:rivals settle` (repeat `settle` for each new lord; normally one arrives per day). `/scriptevent siege:rivals list` shows who holds what.
2. Walk to a lord's Plot Stone. Their longhouse, a cottage and a well should rise near it, and the lord stands by the stone. In Survival you should not be able to break or place blocks on their land, or raise your own banner on their stone.
3. `/scriptevent siege:rivals grow <id>` moves a lord up a tier (the id is in the list); more buildings rise. `/scriptevent siege:rivals night` plays one siege night for all of them.
4. Click the lord and choose "Lay siege" (you need your own settlement). Kill every soldier within 10 minutes: the lord falls, you get Regals, and the plot with its buildings is free to claim. Die or walk away and they hold.
5. `/scriptevent siege:rivals none` removes them all.

**Lords as active neighbours.** Needs your own settlement and at least two lords. Normally one lord acts every other day; these commands make it happen now. `/scriptevent siege:rivals court` shows where everything stands.

6. **War.** `/scriptevent siege:rivals deed march <id>`. You should get a title and a message saying how they will come. Click the lord: "Pay them to turn back" should be the first button. Leave it, and start a siege night: the lord's Men-at-arms should come with the first assault and their Captain with the last, on top of the usual army. Win and you should get coins and a promise of peace; lose the keep and they take coins and grow. Tell me if the lord's soldiers do not attack, or do not count as raiders.
7. **Never the same twice.** Run `deed march <id>` again after the peace ends (or `deed` alone a few times): the same lord should not do the same kind of thing twice running, and a second march should come a different way.
8. **Feud.** `/scriptevent siege:rivals deed feud <id>`. Everyone is told who rides against whom. Click either lord and back them with coin, then `/scriptevent siege:rivals feud_end`: one lord should kneel to the other (shown in their menu), and if you backed the winner you get a share.
9. **Tribute.** `deed demand <id>`, then click the lord and pay or refuse. Refusing should make them colder and likelier to march.
10. **Trade.** Click a lord and choose Trade: three goods for coins and one thing they want to buy (four lots only). `deed wares <id>` changes the goods. With `/scriptevent siege:rivals relation <id> -60` they should refuse to trade.
11. **Oaths.** `relation <id> 50`, then "Gifts and oaths": swear a truce, seal an alliance (costs coins). With an alliance, start a siege night: their Sworn Swords should appear by your keep, fight the raiders, and leave at the end. Tell me if they attack you or your guards. Then lay siege to that lord, or choose "Break your alliance": every lord should think less of you.
12. **Land.** On the map, stand 58 blocks from your Plot Stone as a new Hamlet: it should count as your land, and winning sieges should not move the border.

## Mobs, bosses and NPC fighters (The Hollow Crown)

1. Run `/scriptevent siege:showcase` and walk the row of statues: every mob and boss should stand there, labelled, with its weapon in its hand.
2. Spawn a **Stone Vigil** from its egg in survival. Look at it: it must not move and only a pickaxe should hurt it. Turn around: it should close in. Let it touch you: you should land somewhere nearby in the dark.
3. `/scriptevent siege:champion_summon knight 3 hostile`. It should shoot arrows from range, switch to its sword up close, raise a shield (hit it with an axe: "Guard broken!"), and back off to drink when low. Try `sorcerer` and `lord` too.
4. Kill any of our mobs. It should fall over and lie there, not puff into smoke, then sink into the ground about 45 seconds after the area is quiet.
**Grey Host and Hollow soldiers.** Spawn eggs: Grey Host Shield-bearer, Axeman, Bowman, Bell-cutter, Vorlund's Guard, and Veinsworn, Shardcaster, Gatebreaker. Check each attacks you and guards, the Bowman and Shardcaster shoot from range, and the Gatebreaker is slow and very tough. In sieges they replace some raiders from a keep's 6th siege (Grey Host) and 10th (Hollow soldiers). On the 7th, 8th and 9th one Veinsworn should stand about 30 blocks from the keep, facing it, doing nothing; walk within 9 blocks and it vanishes in smoke.

**Hidden Returned (a villager that is secretly one of them).** In a village run `/scriptevent siege:returned_mark` (marks the nearest villager) or `/scriptevent siege:returned_spawn`. It should look and trade like any villager.

- Walk away and look elsewhere, then glance back: it should be standing still, facing toward the Rift (west if the world has no Rift yet). Stare at it and it should wander off like normal.
- Bring a tamed wolf within 8 blocks: the wolf should growl and show angry puffs.
- Ring a bell within 16 blocks: it should stop, turn and walk toward the Hollow, sometimes with one or two villagers following.
- Kill it while it walks: Veil Ash drops and the followers stay. Let it go about 64 blocks: it and its followers vanish.
- `/scriptevent siege:returned_reveal` puts a beam on every Returned near you if you lose track.
- On their own, villages of five or more get one at night once the first boss is dead (slowly: a small chance every two minutes, one per village).

**Boss Summons (creative menu).** In creative, open the Equipment tab and find the fold-out group "Hollow Crown: Boss Summons": nine sealed writs. Use the Reeve's on flat ground: the Reeve appears 6 blocks in front of you and its fight starts (name, intro line, boss sound), and the writ stays in your hand. Use it again while the fight runs: "already here". The Choir's writ takes you to the Court of the Hollow and wakes the Choir a few seconds later (or says the Court isn't built). The Pretender's rolls a new claimant. Also check the Construction tab has a "Hollow Crown: Locked World Trees" group and the Equipment tab a "Hollow Crown: Guard-only Armour" group, and that the Throne, Fallen Oath Shard, Tree of Oaths, Hollow Crown and Heart of the Hollow can be found with the creative search.

**Morvane, the last fight (seven stages).** On flat open ground run `/scriptevent siege:bestiary_summon morvane`. Away from the Seat all seven stages play on the spot, which is the quick way to check the mechanics. `/scriptevent siege:morvane_skip 4` jumps a running fight to stage 4 (any number 1 to 7).

- Stage 1: two warned blows then a Toll ring you jump; he appears behind whoever hit him last; Tollmen arrive.
- Stage 2: suits stand in a ring, a few attack. Blue light on the left hand marks his suit, on the right hand an empty one. Hit his: he should be open for 12 seconds, then hide again with more suits.
- Stage 3: three waves of old court fighters while he cannot be seen or hurt.
- Stage 4: he only appears to strike; hit him in the 5 seconds he is up. Stand in water: it should hurt and put you back, never kill.
- Stage 5: he lances, shakes the ground and calls Tollmen. Near a settlement wall he should crack it like a ram. He should not die here.
- Stage 6: about 40 seconds of the ground giving way under you while he talks. This is the only place he says who he was.
- The reveal (between stages 6 and 7): `/scriptevent siege:reveal_test` plays it alone on open ground, 8 blocks in front of you. Your controls should lock and the screen go black with one bell. Then: a boy at a desk seen from behind, a line of the journal appearing word by word at the bottom of the screen, the camera swinging round to his face and right hand, a slow push in while the boy becomes a king and then Morvane, one line of speech, a page-turn sound (the journal gains its last page), bells and a server-wide line, black, and your controls back. About a minute. Run it again and you should get the short version (black and his one line). `/scriptevent siege:reveal_forget` makes you a first-time viewer again. Tell me about: the camera clipping through walls, seeing your own armour in shot, text running off the screen, or controls not coming back.
- Stage 7: rings of fire mark floor that is about to go; standing outside hurts. Dodge the overhead blow, hit him while he staggers until the Crown comes off, then keep hitting to hold him back from it and finish him.
- Die alone: the first death in a stage should bring you straight back (second wind); the next two restart the stage; the one after that restarts the whole fight.
- The real thing: beat the Choir, step onto the Seat. Each stage should move everyone to its own place and bring them back. Tell me about anyone left behind, him not arriving, or anyone falling into nothing.

5. `/scriptevent siege:bestiary_summon reeve` alone, then with a friend. With two of you the boss should take noticeably longer to wear down.
6. After any boss has died once, wait near open ground: a **Seep** should open within 10 to 30 minutes ("Something gives way nearby"). Kill its guards, then break it.
7. Stay in the Hollow for 5 minutes: a **Gloamwing** should arrive, and another every 2 minutes. Leave the Hollow and come back: the count should start again.

Tell me which of these did not happen, and anything that looked wrong (weapons floating, bodies standing upright, missing textures).

## The Hollow: the world below (The Hollow Crown)

A map of the generated world is in `docs-hollow/hollow-map.png`.

- `/scriptevent hc:undertow_go` takes you to the Wound, the arrival ledge. The land builds itself around you as you walk; give it a few seconds when you first arrive.
- Walk the gold path down the valley, or leave it through a gap in the cliffs into the open country. Look for: four kinds of land (lattice groves, basalt highlands, glowing fens, grey flats), nothing lined up in rows, no holes in the ground.
- Light rivers: from the Wound walk to about x -60, z 130. Put a boat in the pale blue water and follow it. It should never drop or dead-end, and the story path should cross it on a bridge near z 650.
- Choir ore shows in cliff faces and in veins inside the rock. It needs a diamond or netherite pickaxe.
- `/scriptevent hc:slip` gives a Slip, `/scriptevent hc:give_crown` gives the Hollow Crown (putting it on warns the whole server): it should appear on a small floating stand at your feet, with a "Click: take the Hollow Crown" label. Click it to take it; drop it (Q) and it should go onto a new stand where it lands. Leave a stand for more than 5 minutes and it should still be there. After Morvane has fallen, throw it over lava: chat should say it was called home, and it should be back in the chest at the Seat, `/scriptevent hc:regent_now` raises the NPC ruler.
- `/scriptevent hc:undertow_status` prints what has been built.
- **The road to the Rift (thin places).** `/scriptevent hc:thin_status` lists the seven thin places. `/scriptevent hc:thin_tp kings_barrow` (or any id it lists) takes you to one; the cave builds itself a few seconds after you arrive. Check: a rock hill with a cave mouth facing south, a tall chamber, a purple seam in the back wall, Fennick's tent outside with a Dusty Tome inside (click it for the Field Note). The Drowned Chapel, the Sunken Quarry and the Witchroot Caves need a short swim; the Bellfounders' Mine and Frostvein Gap have ice and snow; the Saltglass Grotto and the Drowned Chapel have white salt crust; King's Barrow and the Witchroot Caves have hanging roots; the Bellfounders' Mine and the Drowned Chapel have a fallen bell. Then, in survival, hit the seam with a Tuning Fork: with fewer than five bosses down it should only hum; on a wrong seam it should go dull for three days and stay in your hand.

## The Hollow's mining villages, the Vault and the Latticewood Boat (scripts/hollowfolk/)

Not yet played in a real game. In a creative test world:

1. `/scriptevent hc:folk_go glimwade` takes you to the first mining village (also `lowseam`, `tollrest`, `highcut`). The village builds itself a few seconds after you arrive: cottages, mine mouths, a smithy, a fire, and a plank walk down to a dock on the light river.
2. Click a miner. While Morvane rules they are frightened and say little. `/scriptevent hc:folk_freed` frees them and their lines change.
3. Click the Foreman (blue name) to open the Tally. `/scriptevent hc:folk_dawn` runs one day of digging so there is ore to buy. Buy 1 or 8 with Regals, or buy a boat.
4. `/scriptevent hc:set_warden` makes you the ruler. Now the Foreman greets you as Crown-wearer, you can set the price, and each dawn half of every Tally goes to your Vault.
5. Robbing needs a second player: with the ruler online, "Rob the Tally" hands over ore and the ruler is brought to the village at once. With the ruler offline it is refused and only buying works.
6. `/scriptevent hc:folk_go vault` takes you to the Vault Stair near the Seat. Stand on the copper pad and sneak to go down. Click the dark block in the middle: the ruler collects, anyone else can try to break it open (20 seconds beside it).
7. Craft a Latticewood Boat from 5 Latticewood (boat shape) and put it on a light river. `/scriptevent hc:folk_status` prints every Tally and the Vault.
8. Site finds: open the chest in the Wound landing's boat shed, the Lattice Wood lodge, Pilgrim's Cross shrine, the Cartmeet tally-house and the Seams winch house. Each hands you its find once (a boat, the Woodcutter's Axe, 12 Regals and a Pilgrim's Lantern, 8 raw Choir Ore, the Seamcutter pick); opening it again gives nothing. `/scriptevent hc:finds_reset` lets you collect them again.

Things to look for: villages sitting badly on the bank or in the water, mine mouths hanging in the air, the boat's look and whether it paddles like a normal boat, and what it drops when broken.

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

## Currency and job NPCs

One coin for the whole world, backed by iron. None of this has run in a real game yet.

1. `/scriptevent siege:showcase` puts one of each job NPC in the row (Farmer, Woodcutter, Quarryman, Smith, Fisher, Hunter, Herbalist, Moneyer) and gives you 200 Regals. Anywhere else: `/scriptevent siege:economy_npc farmer` (add a region name, such as `Frostmarch`, for that region's prices).
2. In Survival, carry some wheat and click the **Farmer**. Choose Sell: 16 wheat should fetch 6 Regals at plain prices, less in Aldmere Vale, more in Frostmarch or Emberwaste. Sell more than 8 lots in a day and the price should start to drop; it recovers the next morning.
3. Click the **Moneyer** with iron ingots: 8 Regals each for the first 64 a day, then 4. Buy one back for 10. "Change coins" swaps 64 Regals for a Gold Regal and back.
4. Buy something that costs more Regals than you carry in small coins while holding a Gold Regal: you should get the right change.
5. Click your Keep Banner: the menu has **Strongbox**. Put coins in, walk off your land and check a shop no longer counts them, come home and check it does.
6. `/scriptevent siege:economy_give 500` gives coins, `/scriptevent siege:economy_stats` shows how many coins the world has paid out and taken in.

Things to look for: whether the NPC skins suit the jobs, whether the sell list is readable on a phone screen, and whether any price feels too generous. Every number is in `scripts/economy/config.js`. Every shop and reward in the add-on now uses Regals: sieges, guards, the Quartermaster, the Mason, town hall costs, horses, the Throne and the Hollow. Sneak + use a Gold Regal to break it into 64 Regals, and sneak + use a full stack of 64 to bind one. The Quartermaster is a villager trade and cannot make change, so check that paying him with a mix of Gold Regals and Regals feels fine. Emeralds are no longer taken anywhere; the Moneyer buys them for 4 Regals.

## Siege nights and the Reach (scripts/reach/)

The plan for Mateo is the Claude Doc "The Third Night: siege plan". Offline, `node tools/sim-reach.mjs` plays a night at every stage and prints it.

In game (cheats on, a settlement founded, or `/scriptevent siege:showcase` first):

1. `/scriptevent siege:reach` shows the Reach, the stage and what tonight is.
2. `/scriptevent siege:reach_night` makes tonight a siege night and jumps to just before the horn. Expect: the horn and war plan, then one wave an
   hour at seventeen past, the last at 3:17 with a bell and "3:17" on screen. `/scriptevent siege:reach_toll` jumps to 3:16.
3. `/scriptevent siege:reach_stage 2` then `reach_night`: four waves, and at 3:17 the army stops and three Hollow soldiers walk out. Every settlement
   gets this once, on its own night; only players at that settlement are told. `/scriptevent siege:reach_glimpse` lets it happen again.
4. `/scriptevent siege:reach_stage 3` and `4`: check the Keep Banner's "The night watch" button (at stage 3 and after the story it gives a
   hint such as "The watch is uneasy tonight", never a day), the stolen nights (`reach_night stolen`), the knock
   (`reach_night probe`), the twists "The Fallen Rise" and "The Pull".
5. `/scriptevent siege:reach_rift` (or opening the Rift for real) starts the Long Night; the Choir falling no longer does. Then `reach_night`. Leave
   raiders alive past 5:00: "Dawn. They do not leave", then a tide every two minutes. Kill everything between tides to break it. A thunderstorm
   should roll in with each wave and tide and clear about a minute later. Patrols should find you outside the settlement.
6. `/scriptevent siege:reach_boss morvane`: everything stops ("The knocking has stopped"). After the story a rival town raids at random, two to
   nine nights apart, at an hour of its own (no 3:17); `/scriptevent siege:reach` shows the day, `reach_night muster` forces one. With a Rival
   Lord in the world the raid names them ("The banners of Ser Bram Holt, out of Wrenfield"). The night watch now offers Remembered Nights.
9. The wait before the horn: a settlement's first three full sieges keep the whole evening of omens (about five minutes for three waves). After
   that the evening visibly hurries (the sky moves faster) to about three minutes, and after six sieges to about ninety seconds. With several
   settlements the newest one sets the pace.
8. Variety: play three siege nights in a row (`reach_night` each evening). Each should have a different shape (named in chat after the
   night, and under "The night watch") and a different army. Let a captain live through a night you lose: the next full night it returns by name.
   Honours you earn appear in chat as "Night honour: ..." and under "The night watch".
   `/scriptevent siege:storyteller` should list no missing facts from reach, and show the next `siege_shapes` pick.
7. `/scriptevent siege:reach_reset` puts it all back. `/scriptevent siege:reach_boss <reeve|huntsman|bride|seneschal|mother|warlord_king|choir>` and
   `/scriptevent siege:reach_set <0-100>` move the story by hand.

10. Omens you can see and hear: stand inside a settlement with torches, a door left open, some water, a few farm animals and a dog nearby, then
   `/scriptevent siege:reach_omen <name>` plays one at once (no name: a random one, and it lists them all). Names: pets_hide, stillness, humming,
   torches_lean, far_bell, animals_face, gate_creak, ticking, voices, water_trembles, arrows, cellar, doors_shut, guards_quiet, small_thing,
   light_changes, torches_gutter. On a real siege evening one happens each in-game hour from dusk, with its grey line, and never twice in an evening.
   All of them point at the same wall for the night.

Things I could not check offline (every omen is in this list: none of them can be seen in the simulator): whether a dusk-to-midnight wait feels right, whether Hollow soldiers march on the keep heart like raiders do,
the darkness and knockback effects, the storms, and how the hurried evening looks in the sky.

## Choirsteel gear (bestiary)

`/scriptevent siege:choirsteel_kit` gives the full set, the tools, 32 ingots, 8 Gloamquills, 2 templates and 4 Tempered Choirsteel.

- Recipes: Tempered Choirsteel is 4 Choirsteel Ingots and a Gloamquill in a crafting table. At a smithing table, a Choirsteel Upgrade template + a netherite piece + Tempered Choirsteel gives the Choirsteel piece (all nine: four armour, five tools). Check the template and Tempered Choirsteel go into their slots at all (custom smithing items need their tags), and that enchantments and a renamed name carry over.
- Copying: template in the top middle, Veinstone in the centre, 7 netherite ingots around them in a crafting table gives 2 templates.
- The Cold Forge (the Hollow, x 592 z 1080, on the high terraces east of the Seams, no road): an open veinstone smithy with a tall chimney and soul fire on top. The chest at the back holds one template on your first visit. Take it: anvils ring and two Veinsworn and a Stone Vigil come out. Come back three in-game days later and there is a new one. `/scriptevent hc:forge_restock` refills it now.
- Trims: put each Choirsteel armour piece in a smithing table with any armour trim template and any trim material. The trim should show in its colour, in the same place it sits on netherite, and the crystals, plume, pauldrons, knee cops and fins should stay plain.
- The first time you carry a Choirsteel Ingot, chat tells you where the forge is.
- The test world (`/scriptevent siege:showcase`) has a smithing table and a crafting table with chests of everything needed.
- Helm: you see in the dark. Greaves: slowness never sticks. Treads: jump off something high, you drift down and take no fall damage.
- Cuirass: let zombies hit you. About one hit in four rings and throws the attacker back.
- Full set: a chime, then Resistance and four extra hearts. Take one piece off and both go.
- Blade: hit one mob in a crowd four times. The fourth hit rings and hurts the others near it.
- Pick: break an ore next to other ore. A line of sparks points to the nearest one. It also mines Choir Ore whole.
- The first time you wear or hold each piece, chat tells you what it does.

## Mob and boss animations (bestiary)

1. In the showcase world the statues stay in place but now breathe and fidget (the Reeve ticks, Hollow folk twitch). Then spawn a few live mobs with eggs (Tollman, Shieldwall Brute, Grey Host Bowman, Lost Villager, Rimewolf) in Survival. ✅ Each walks differently, leans in when it runs, and swings its own way when it hits you. The Bowman raises and draws its bow while it has you as a target. Every mob flinches when you hit it.
2. Watch a Lost Villager standing still for 10 seconds. ✅ Its head hangs crooked and now and then snaps sideways.
3. `/scriptevent siege:bestiary_summon reeve` in Survival. ✅ When a warning comes up he holds a wind-up pose (both arms raised for the time stop, arm drawn back for a cog) and swings through when it lands. At 60% health he rears back with his arms spread. Do the same for the Huntsman, Bride, Seneschal, Mother, Warlord King and Morvane. Anything that looks broken (a limb bending the wrong way, a pose that never lets go): note the boss and the attack name from the warning.

## Never the same fight twice (bestiary)

- Beat any regional boss once, then summon it again (`/scriptevent siege:bestiary_summon reeve`): its name carries a temper (for example "The Clockwork Reeve, Unquiet") and the fight has one extra problem. Beat it again and you get a named echo shard for that temper. The next rematch wears a different temper.
- Watch a boss for a minute: it should not use the same warned attack twice in a row when it has another ready.
- New attacks to look for: the Reeve puts you back where you stood ("The hands turn back"), the Huntsman lays snares, the Mother hums (look away).
- In a siege from the third on, roughly one raider in seven has a yellow name such as "Fleet Grey Host Axeman" and behaves to match.
- `/scriptevent siege:variety` lists what you have killed most and flags anything met more than 40 times per variant.

## Seep kinds (bestiary)

Seeps open near players once the first boss has fallen; which kind opens is the Storyteller's pick (`/scriptevent siege:storyteller` shows what it would give you next for the deck "seeps").

- Guarded: guards climb out, kill them, break it. Hungry (chapter 4 on): opens already widened, guards every 10 seconds.
- Still: nothing comes out. Stand within 6 blocks and it murmurs a line in grey every 30 seconds. Break it to close it.
- Drifting (chapter 2 on): walk up to it and it slips away, three times, a shorter hop each time. Then it stays and guards come.
- Weeping (chapter 2 on): harmless. Stay near for 4 minutes and it closes by itself and leaves Veil Ash.

## Pretenders (bestiary)

In the real game the first claimant comes 5 days after Morvane falls, then one every 6 to 11 days, standing at the Seat in the Hollow.

- `/scriptevent siege:pretender_rise` makes one rise now, standing where you are. Add a number (`siege:pretender_rise 42`) to get the same one again. Chat names it and its claim.
- `/scriptevent siege:pretender_status` shows its claim, its four powers, how long it has sat and how much the seep is surging.
- Fight it. Every warned attack should be one of the four listed powers, never the same twice running. The claim should hold: Unbled heals when nobody is within 6 blocks, Mirrored sends arrows back, Followed calls a shade at each fifth of its life, Hungering heals when it hits you, Twinned is unhurtable at half life until its twin dies.
- Kill it: chat tells everyone, you get a "Seal of <its name>", and the next `siege:pretender_rise` gives a different body, claim and name.
- Leave one alive for 5 in-game days: a message says the seep is everywhere, and Seeps open more often.

## After Morvane: the Five Chairs and the Homecomings (scripts/after/)

Nothing here happens until Morvane has fallen (`/scriptevent siege:bestiary_summon morvane` and win, or test the pieces with the commands; they work any time in creative).

- `/scriptevent siege:chairs_envoy salt` puts an envoy of House Vesk beside you (also `bell`, `lamp`, `root`, `tide`). Click them: they ask for your backing. Back them, ask about the truce table, open the board, or send them away. Each house should sound different, and you should not hear the same pitch twice running.
- `/scriptevent siege:chairs` shows the five standings and who holds the seat. `/scriptevent siege:chairs_stand lamp 10` moves one; the seat changes hands and everyone is told. If a Regent rules below (`hc:regent_now`), their title and prices change to the new house's temper.
- Back the house that holds the seat, then talk to the Regent: it should say your house has its ear, and Choir ore mines with no alarm.
- After Morvane, a Pretender's announcement names its house, and its name tag shows it. Kill it: its house loses ground and the house you back gains.
- On a third night after dark one envoy comes to one player in the overworld; at dawn they leave. The keep menu has "The Five Chairs" board.
- `/scriptevent siege:homecoming_now` puts a stranger beside you. Click them: who they were, how they went down, who they look for, what they want. Bring it and their story ends one of four ways. Use a number (`siege:homecoming_now 42`) to get the same stranger again. If they are a copy, ring a bell near them: they should turn and walk away.
- `/scriptevent siege:homecoming` shows who is here and when the next comes.

### Village happenings (mining villages)

Walk into a mining village in the Hollow: at most once every 8 minutes something is going on, and it should never be the same thing, or the same kind of thing, twice in a row. `/scriptevent hc:folk_happen` while standing in a village forces the next one. Check: the rich seam adds 6 ore to that Tally; the half price shows in the Tally menu for 5 minutes; the nest spawns three endermites by the mine mouth; an errand names a place, and walking to that place pays 4 raw Choir Ore once. Before Morvane falls only the three quiet, frightened ones and the errands appear.

### The Hollow's air (particles)

Stand in the Hollow near Veilcaps, Glint Clusters, hanging moss, pale ash and plain veined ground: each should give off its own small effect now and then, and a few pale motes should drift near you everywhere. It needs the particle effects from the art pull request (#57); without them nothing shows and nothing breaks. `/scriptevent hc:hollow_air off` stops it, `on` starts it again. Watch for lag with several players in the Hollow.
## Horses, horse upgrading and the Train Carriage (scripts/horses/, scripts/rails/)

In game: Creative, cheats on. `/scriptevent siege:showcase` puts eight steeds in the extras row behind you that are already yours (one of each of the five breeds, **Valiant** the Knight Warhorse, **Whisper** the Glimstrider and **Sprout** the foal), a Breeder's Post, and two Station Posts with a short powered rail line and a Train Carriage on it. Your Stables counts as level 3 there, so every menu option is open, and in Creative nothing costs anything. Take a **Riding Crop** and a **Horse Whistle** from the item chests.

**Looks and riding**
1. Walk along the steeds. ✅ Eight horses with name tags and signs, the foal small. Each breed has its own painted coat: chestnut with a white blaze (Courser), heavy white-grey with feathered legs (Destrier), dapple grey (Runner), pale gold (Sandstrider), shaggy black-brown (Mire-Pony). All of them still show a saddle. The Courser wears cloth in your banner color, the Destrier wears diamond horse armor, and Valiant is bigger with plate on its head and neck. Whisper is pale blue-white and you can see through it. Sprout is piebald.
2. Sneak + click any of them with an empty hand. ✅ Its sheet opens: breed, trait, level, Speed, Jump, Health and Stamina, and "Training points 5" on the breed horses.
3. Climb on a breed horse and ride. ✅ It steers like a normal horse, with the jump bar. A stamina bar shows above your hotbar.
4. Use the Riding Crop while riding. ✅ A gallop sound and it is clearly faster; the stamina bar drains. Use the crop again ✅ it slows back down. Gallop until the bar is empty ✅ it drops out of the gallop by itself, and using the crop straight away says it is winded.
5. Try to climb on Sprout. ✅ You can't ride a foal.
6. Ride Valiant at a gallop into `/summon zombie`. ✅ The zombie is knocked aside and hurt (Trample).

**Upgrading**
7. Click the **Stables** in the block row (or place `/give @s siege:stables` inside the settlement). ✅ A list of your horses, plus "Breed two horses".
8. Pick a breed horse and train Speed. ✅ "Speed is now 3", one training point fewer, and it really is faster when you ride it. Train Jump ✅ it clears a higher wall. Train Health ✅ more hearts when you sit on it.
9. On the same horse choose "Choose a perk". ✅ A list of perks with one line each; picking one says the horse learned it.
10. Hold **Horseshoes** (`/give @s siege:horseshoes_iron`) and click your horse. ✅ They are fitted and its sheet shows the bonus. Same with a **Caparison** ✅ it wears cloth in your banner color.
11. "Breed two horses", pick two grown horses. ✅ "A foal is born" with a name, a breed and traits, and a small foal stands by the Stables.
12. On a horse choose "Put in the stalls". ✅ It disappears and the list shows it as stabled. "Bring out of the stalls" ✅ it is back, with its saddle and armor still on.
13. Walk 40 blocks from your horses and use the Horse Whistle. ✅ A flute note, and the nearest one appears beside you ("comes running").
14. Ride Whisper and use the Horse Whistle while riding. ✅ The Veilstep: you and the horse blink about 10 blocks ahead, even through a wall. Use it again at once ✅ "The Veil is still settling".
15. Switch to Survival and kill one of your horses. ✅ "has fallen", and the Stables offers "Revive" for it.

**Getting a horse the normal way**
16. `/summon horse`, tame it, then use a **Halter** (`/give @s siege:halter`) on it. ✅ "is now your steed", it keeps its coat, and it shows up at the Stables.
17. Click the Breeder's Post. ✅ It offers a Sandstrider foal for 192 Regals (free in Creative), and buying gives you a named foal.

**Rails and the Train Carriage**
18. Click the Train Carriage on the line to board, then push forward. ✅ You sit inside, it rolls along the rails faster than a minecart. With friends: up to four people can sit in it.
19. Click the nearer Station Post (**Showcase Halt**). ✅ A Station menu: "Call a carriage", "Call a minecart", "Choose a destination", "Network map", "Horse stalls".
20. "Call a carriage". ✅ A fresh carriage appears on the rail by the post. "Call a minecart" ✅ a plain minecart instead.
21. Walk to the second post. ✅ Title "Far Platform, Station discovered · 2 of 2". Go back, "Choose a destination", pick Far Platform, and ride there. ✅ The bar shows the direction and distance while you ride, and "You have arrived" when you get there.
22. `/give @s siege:train_carriage` and use it on any rail. ✅ Your own carriage. Sneak + click it with an empty hand ✅ it packs back into the item.
23. Leave a called carriage empty for a minute or two. ✅ It tidies itself away.

Things I could not check without the game, so please look closely: that the steeds look and ride like real horses (saddle, armor and jump bar all there), that the painted coats line up on the horse with no patches of a different color showing through, that the caparison color only tints the cloth, that the Glimstrider really is see-through, that four people really fit in the carriage and it faces the right way on the rail, and whether the carriage speed feels right.
Things I could not check without the game, so please look closely: that the steeds look and ride like real horses (saddle, armor and jump bar all there), that the caparison color only tints the cloth, how the Glimstrider's glow looks, that four people really fit in the carriage and it faces the right way on the rail, and whether the carriage speed feels right.
## Trains and Track (scripts/trains/), first test

`/scriptevent siege:showcase`, then walk about 70 blocks west: a loop of Track with an Engine and a Coach on it.

1. **Riding (the big question).** Climb into the engine (click it). Hold forward: does it pull away and speed up? Hold back: does it brake, stop and then reverse slowly? Is the ride smooth, or do you see the train or yourself jitter? Try it on the Realm too, with a friend in the coach.
2. If it jitters, type `/scriptevent siege:trains mode teleport` and try again, then tell me which felt better. (`mode velocity` switches back.)
3. If holding forward does nothing at all, tell me: the train then only drives itself at half speed.
4. **Corners.** The loop has gentle bends. Does the train look right going round them, and do both cars stay on the track?
5. **Laying track.** Take Track from the Every item chest. Lay a line, then turn it diagonally and back, make a sharp corner, and climb a slope one block up. Do the pieces join up the way you expect? **If diagonal pieces look mirrored (rails pointing the wrong way), tell me**, it's a one-line fix.
6. Place an Engine on your own track (at least 8 blocks), then a Coach right behind it. Sneak and click a car with an empty hand to put the whole train away.
7. Region looks: an engine put on track inside a Frostmarch (or other region) settlement should come out in that region's colours. The colours are placeholders.
8. `/scriptevent siege:trains` lists every train.
9. **Stations.** Stand on flat open ground, face where the building should go and type `/scriptevent siege:trains station halt` (then `station`, `junction`, `grand`, each somewhere new; add a region such as `frostmarch` to pick its look). The building should rise a few blocks at a time in front of you, with a line of Track through your feet along the platform. Is anything built on the track side, or does the platform sit at the wrong height?
10. **Your own station.** In your settlement, place a Rail Depot a few blocks from a straight line of Track (or on open ground, facing where the building should go). A Halt should rise lined up with that track, and the depot should end up on its platform. Win sieges until the settlement becomes a Town: the Halt should come down and a Station rise in its place.
11. A claim near a Station Post placed by the map builder (within about 140 blocks of the banner) should raise a Halt by that post.
12. **Buying the line.** Once the world has its planned railway, `/scriptevent siege:trains routes` should list the stops and say which is your home stop. Click any Station Post: "Extend the line" should only offer stretches that start at a stop you can already reach (at first just the ones out of your home stop). Buy one: the Track should lay itself along the graded bed over a few seconds, and everyone should see "The line from ... to ... is laid". Stretches past it should now show up in the menu.

## Sounds (scripts/sound/, SOUND-LIST.md)

Nothing here has been heard in the game yet, so your ears are the test.

1. Run `/scriptevent siege:sound`. **Expect:** a "Sound board" menu with three groups. Pick "Signature sounds" and click a few: each plays, and the action bar names it and says "stand-in" (or "recording" once you have installed one).
2. Run `/scriptevent siege:sound signature`. **Expect:** the signature sounds one after another, about 8 seconds apart, each named on screen. The Rift and the Hollow's ambience are silent here until their recordings exist.
3. Ring a vanilla bell, then run `/scriptevent siege:sound block.bell.hit`. **Expect:** ours is the same bell with a deeper note under it and a slightly sour edge.
4. Open any menu that buys or confirms something. **Expect:** the "done" sound is lower and quieter than the vanilla level-up jingle.
5. Start a siege (`/scriptevent siege:reach_night`). **Expect:** a low doubled horn with a far thunder under it, not the plain raid horn.
6. After installing a recording (see SOUND-LIST.md), rebuild, reload the world and run step 1 again. **Expect:** that sound says "recording" and plays your file.

Tell me about: anything too loud, too quiet, silent, or that made you jump. Nothing should.
## Omen ravens (bestiary)

- At dusk or night, `/scriptevent siege:raven_row 9` puts nine ravens in a row in front of you, all facing north, with one place left empty. `/scriptevent siege:raven_clear` removes them.
- Walk up to them, hit them, push them: nothing happens and they do not turn. They make no sound.
- Wait for morning, or start a siege: they are gone.


### Clue Sense
1. `/scriptevent siege:townhall_renown 30`, learn Clue Sense in the Wayfarer branch, and carry the Ledger of Whispers.
2. Walk toward a Dusty Tome you have not clicked (the showcase has some). ✅ Within 16 blocks a page turns softly and the action bar says "Your Ledger whispers: something written, N blocks <direction>". After you copy the tome it goes quiet.
3. Drop a Lore Tome and walk away and back. ✅ It is sensed the same way. Without the Ledger in your pack nothing happens.

## The Settler's Almanac (scripts/guide/)

Best on the real world map with a fresh player (or `/scriptevent siege:guide reset` first).

1. Join for the first time. ✅ After the journal, chat says a clerk has given you the Settler's Almanac, and it is in your pack. Use it. ✅ A cover page, chapters with page counts, a "Tips in chat" switch. "First days" opens on "This book", "What to do first", "Land and protection" and more.
2. Read a page, go back. ✅ The gold dot on it is gone and the chapter's "new" count drops.
3. Raise your Keep Banner. ✅ A second or two later one gold "[Almanac]" line in chat (not on top of a menu), then another a few seconds after, never a burst.
4. Pick up a Regal, place a Siege Workshop, click the Mason, click a Station Post, carry a Halter. ✅ One tip each, the first time only. Doing it again says nothing.
5. Turn tips off on the first page and pick up something new. ✅ Silent, but its page still gets its gold dot.
6. Click your Keep Banner. ✅ An "Almanac" button on the Keep menu. Type `/siege:guide` with cheats off. ✅ The book opens.
7. Craft one at a normal crafting table: a book and a feather.
8. Check the secrets stay secret: with a fresh player, no chapter called "Beyond the seam" or "The High Throne", and no page mentions the Hollow. `/scriptevent siege:guide all` shows them all (for proof-reading).
9. `/scriptevent siege:guide tip <id>` repeats any page's tip.

Tell me: any tip that came at a bad moment or said something wrong, any mechanic you had to ask about that the book doesn't cover, and whether the tips feel like too many or too few.
### Settlement gates and stripped log walls
1. `/scriptevent siege:wall 3 saltreach` round your keep. ✅ The stakes are stripped birch, not bark birch. Try `vale`, `frostmarch`, `emberwaste`, `blackfen`: always the stripped log.
2. With a second player who is not your ally, have them click your gate or portcullis. ✅ It stays shut and the action bar says "The gate is barred. Only <name>'s people can open it." You (and an ally) can open it by clicking.
3. Recruit a guard at the Barracks, shut the gate, walk up to it from outside. ✅ The gate (and portcullis from level 6) opens by itself; walk 7+ blocks away and it shuts.
4. Leave the gate open and start a siege. ✅ It slams shut, and it does not open by itself until the siege ends.
## Role trials (scripts/roletrials/)

Build the showcase (`/scriptevent siege:showcase`) in a flat Creative world, then switch to Survival. Kesh, Ulla, Holt and Nell stand with the other story characters. A short Span and three graves are 60 blocks behind the exhibit rows.

1. Open the Tree of Oaths with no role: "Choose your path" lists the four regional roles and their deeds. The Tree has a "Role trials" page naming each mentor and where they are.
2. Talk to Kesh and choose "I want to ride", then "Sign me in". Walk the Span from the near pillar to the far one: cracked stones fall a second after you step on them and come back later, and wind pushes you sideways. Arrive and Kesh's line appears. Fall off and you are "Washed out" for 3 days (use `/time add 72000` to skip).
3. Hold a sword and click a Dragon Nest: you are set on fire and get no egg until tomorrow. Empty-handed and walking: you get the egg and the Choosing is done. When the egg hatches, the Tree offers Dragon Rider.
4. Talk to Ulla, choose "Do you need help?", "I'll haul for you". Talk to her again carrying 16 iron ingots and 16 coal: they are taken and you get "Hroda's Hand-bell". At night, place the bell on ice or snow: the Pale Huntsman rises. Kill it and the Tree offers Forgemaster.
5. Talk to Holt, "Do you need captains?", "Give me the articles". Talk again with 32 Regals on you: they are taken. With three guards sworn to your keep, talk again: the crew step is done. `/scriptevent siege:bestiary_summon bride` and kill it: the Tree offers Captain.
6. Talk to Nell, "What does a witch do?", "I'd like to learn", "Drink": darkness and slowness for about two minutes. Sneak at each of the three graves: the third gives you something. Kill the Mother of Changelings and the Tree offers Witch.
7. Kill a regional boss before talking to its mentor: you get a message from the mentor, no offer. Start that trial and finish its steps: the offer comes as the last step lands.
8. As a Knight (`/scriptevent siege:townhall_path knight`): talk to Sir Aldous, answer "I'll stand on their wall", then win a siege at a friend's keep (or your own, alone in the world). Aldous thanks you. Each siege or boss after that brings one of the Eleven.
9. Rank up in any role (`/scriptevent siege:townhall_renown`, then spend points in your branch): the mentor's line appears a few seconds later. As a Sorcerer, Mag has a new scene at Listener and Adept.

Shortcuts: `/scriptevent siege:role_trial <rider|forgemaster|captain|witch> [step]` starts a trial or finishes one step; `siege:role_trial reset` forgets them. On the real map, the map builder marks the Span (`/scriptevent siege:role_mark span_start` and `span_end`) and the graves (`siege:role_mark grave`).
10. Turns and stands: reach rank 4 and rank 5 in a regional role (spend points in its branch) and talk to the mentor each time: a new scene each. A Knight reaching Knight-Commander gets a box to name the Order.
11. The Morvane fight with roles: `/scriptevent siege:bestiary_summon morvane`, then `/scriptevent siege:morvane_skip N` for N = 2 to 7. Alone with no role, a named student is announced at stages 2 to 6 (knights spawn at 3, the river buffs at 4, burns every 16 s at 5, slow falling at 6). With a top-rank role, your name is announced instead.
12. Ask Kesh "Read me the roll": three names to start, Bram Tallow's after the first hatching in the world, and every dragon that dies after that. Fill a dragon's bond (`/scriptevent siege:dragons_grow`): two Wing points arrive.
## The Hollow's middle stretch (lore/hollow.js, undertow/story.js)

Mateo approved the beats 2026-11-11 (doc "The Hollow's middle stretch: story beats"). Words: `lore/data/hollow_story.js` and the Carter in `lore/data/dialogue.js`. Places, the Carter's position, the Court door: `undertow/story.js`.

1. Go to the Hollow (`/scriptevent hc:undertow_go`) and walk to the Wound landing dock. A scene plays and the Carter stands on the dock (`/scriptevent hc:carter_go` takes you to her). Talk to her.
2. Walk to Glimwade: its scene plays, and the Carter moves to where the road comes into the village. Her hub has five buttons plus Goodbye; "I've been walking your country" reacts to the places you have seen, one at a time.
3. Visit the Truce Hall (you get *The Name We Were*), the Standing Ranks, the Far Door, the top stone of the Drift (the scene must NOT play at the foot), and the Seams (a two-button choice appears; close it and walk out and back in to be asked again).
4. After the third of those five, a line says the Carter will know. Talk to her: she teaches the Cartsong and moves to the Court's south door.
5. In survival, walk into the Court without the Cartsong: you are pushed back out with a message, and the Choir does not wake. With it (or standing next to someone who has it) the fight starts. If you chose to wreck the cart, phantom raids come every 40 s instead of 20 s.
6. After the Choir falls, everyone in the Hollow sees the "Court is quiet" scene, and the Carter asks to be named (Lark, Morrow or Dawn). If you let the cart go at the Seams, Tally ore costs you half once Morvane has fallen.

Shortcuts: `/scriptevent siege:hollow_beat <id>` replays one scene, `siege:hollow_story` lists what you have heard, `siege:cartsong` gives you the Cartsong. Creative players are never pushed out of the Court.
## Menu labels (core/labels.js, scripts/labels/)

1. `/scriptevent siege:showcase`, then walk around it. ✅ Within about 10 blocks, every menu block there (the full list is in scripts/labels/index.js: Keep Banner, Barracks, Hall Cornerstone, Tree of Oaths, Foundation Stone, Plot Stone, Stables, Breeder's Post, Station Post, Rail Depot, Looking Glass, Archive Shelf, Dragon Roost, Throne, Citadel Cornerstone) has a gold name with a grey "Click: ..." line floating just above it. Decorations, walls and gates have none.
2. Stand by a Mason, a trader, a rival lord or a story NPC. ✅ A yellow "Click to trade" / "Click to talk" floats above the NPC's own name, not on top of it.
3. Walk 20 blocks away. ✅ Within about 3 seconds the labels are gone (`/scriptevent siege:labels` says how many are showing).
4. Break a labelled block. ✅ Its label disappears within a few seconds.
5. `/scriptevent siege:labels off`. ✅ All labels vanish; `on` brings them back.

Tell me about: a label sitting inside the block or too high above it, a label covering an NPC's name, or anything clickable with no label.

### Town hall build animation
1. Stand at your cornerstone with a Longhouse built and run `/scriptevent siege:townhall_build 3`.
2. ✅ The title "The Keep rises" shows once, the camera circles, and the action bar shows only a bar with a percentage that climbs steadily.
3. ✅ The old Longhouse is gone completely before the Keep goes up: no leftover walls, roof or posts in or beside it.
4. ✅ It is finished in about 15 seconds, and the Hall Cornerstone is gone once the hall stands. The Tree of Oaths' first page has a "Town Hall" button that opens the Town Hall menu (so does the Keep menu).
5. Town Hall menu → "Move the town hall" → "Move it". ✅ You get a Hall Cornerstone back, the Tree sleeps, and placing the stone elsewhere starts a new hall. Placing a second cornerstone while a hall stands is refused with a message.
