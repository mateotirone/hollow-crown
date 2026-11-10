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

✅ A green line starting "Self-test passed".

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
- `/scriptevent siege:welcome build here` on flat ground (or `build` on the real map: it takes you to the hall's place high over Gull Bay). ✅ A round stone terrace with the Waystone in the middle and twelve pedestals round the rim, each with a sign.
- Click the Waystone. ✅ A menu with "How things stand", "Where you start" and "Choosing a home".
- Click a pedestal whose plot has a stone. ✅ The plot's region, land and style, and "Free". Pedestals for plots with no stone yet say "Not on this map yet".
- Switch to Survival, click a free pedestal, choose "Start in ...", confirm. ✅ You land beside that Plot Stone holding a Keep Banner, and everyone is told.
- `/scriptevent siege:welcome go` (Creative) and click the same pedestal. ✅ Its top has gone dark and it shows who chose it, their level and their settlement level.
- With a friend (or second account) in Survival with no keep: they join. ✅ They arrive in the hall, can't walk off it, and the taken plot can't be picked.
- `/scriptevent siege:welcome testarea`. ✅ A glass floor in the sky with the whole showcase laid out on it. Running it again just takes you back there.
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

0l. **The morning after the first sighting.** Run `/scriptevent siege:morning_after`. Three lines from your own townsfolk should appear a few seconds apart. Then talk to Sigrun, Brother Cael, Old Mag, Sir Aldous or Archivist Pell (after you have met them): each opens once with a new conversation about the tall thing at your wall, and never repeats it. In a real game this happens the dawn after the siege where the first Hollow soldiers appear.

0m. **The story spine.** `/scriptevent siege:local_lore <plot>` and read the first book: its last page, in a newer hand, should send you to Millbrook and Sister Wren, and Millbrook should appear as a lead in the Ledger. Solve the plot's mystery in the Ledger: the answer ends with a paragraph about your own region's boss and adds its place as a lead. Kill a regional boss (`/scriptevent siege:bestiary_summon reeve`): besides its book you get a line about a scrap and two new leads in two other regions. After the third regional boss, a purple line about a surveyor appears and the first Field Note is in your pack.

## Dragons (the Emberwaste's power)

Look first, without the game: the 3D viewer at https://claude.ai/artifact/D42qsWXjEcxWAbsYacsw4v shows all four species, every pose and every sound.

In game: Creative, cheats on. `/scriptevent siege:showcase` puts a Roost, a Nest, nine display dragons (the four species, a hatchling, a fledgling, one asleep, one unconscious, one dead) and **Cinder**, a grown Cinderwing that is yours, in the extras row behind you. Take a **Dragon Horn** from the chests, and `/give @s beef 16` and `/give @s golden_apple 4`.

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

**Raising one**: `/scriptevent siege:dragons_reset`, click the **Dragon Nest** ✅ an egg; click the Roost holding it ✅ "The egg settles"; `/scriptevent siege:dragons_grow` ✅ cracking sound, a tiny chirping hatchling of a random species that follows you. Run the grow command twice more ✅ Fledgling (walks with you on its back), then Adult (flies).

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
- **Arrival.** `/scriptevent siege:settle_arrive` lays out your settlement: the wall, a Longhouse rising behind the banner, a Mason at a bench, and a signpost on every spot where a building will go. On the real map this happens by itself when you pick a plot in the welcome hall.
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
- `/scriptevent hc:slip` gives a Slip, `/scriptevent hc:give_crown` gives the Hollow Crown (putting it on warns the whole server), `/scriptevent hc:regent_now` raises the NPC ruler.
- `/scriptevent hc:undertow_status` prints what has been built.

## The Hollow's mining villages, the Vault and the Latticewood Boat (scripts/hollowfolk/)

Not yet played in a real game. In a creative test world:

1. `/scriptevent hc:folk_go glimwade` takes you to the first mining village (also `lowseam`, `tollrest`, `highcut`). The village builds itself a few seconds after you arrive: cottages, mine mouths, a smithy, a fire, and a plank walk down to a dock on the light river.
2. Click a miner. While Morvane rules they are frightened and say little. `/scriptevent hc:folk_freed` frees them and their lines change.
3. Click the Foreman (blue name) to open the Tally. `/scriptevent hc:folk_dawn` runs one day of digging so there is ore to buy. Buy 1 or 8 with Regals, or buy a boat.
4. `/scriptevent hc:set_warden` makes you the ruler. Now the Foreman greets you as Crown-wearer, you can set the price, and each dawn half of every Tally goes to your Vault.
5. Robbing needs a second player: with the ruler online, "Rob the Tally" hands over ore and the ruler is brought to the village at once. With the ruler offline it is refused and only buying works.
6. `/scriptevent hc:folk_go vault` takes you to the Vault Stair near the Seat. Stand on the copper pad and sneak to go down. Click the dark block in the middle: the ruler collects, anyone else can try to break it open (20 seconds beside it).
7. Craft a Latticewood Boat from 5 Latticewood (boat shape) and put it on a light river. `/scriptevent hc:folk_status` prints every Tally and the Vault.

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

`/scriptevent siege:choirsteel_kit` gives the full set, the tools, 32 ingots and 8 Gloamquills.

- Recipes: in a crafting table, each piece is its netherite piece plus Choirsteel Ingots plus one Gloamquill (two for the Blade). Enchantments on the netherite piece are not carried over.
- Helm: you see in the dark. Greaves: slowness never sticks. Treads: jump off something high, you drift down and take no fall damage.
- Cuirass: let zombies hit you. About one hit in four rings and throws the attacker back.
- Full set: a chime, then Resistance and four extra hearts. Take one piece off and both go.
- Blade: hit one mob in a crowd four times. The fourth hit rings and hurts the others near it.
- Pick: break an ore next to other ore. A line of sparks points to the nearest one. It also mines Choir Ore whole.
- The first time you wear or hold each piece, chat tells you what it does.

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

### Village happenings (mining villages)

Walk into a mining village in the Hollow: at most once every 8 minutes something is going on, and it should never be the same thing, or the same kind of thing, twice in a row. `/scriptevent hc:folk_happen` while standing in a village forces the next one. Check: the rich seam adds 6 ore to that Tally; the half price shows in the Tally menu for 5 minutes; the nest spawns three endermites by the mine mouth; an errand names a place, and walking to that place pays 4 raw Choir Ore once. Before Morvane falls only the three quiet, frightened ones and the errands appear.
