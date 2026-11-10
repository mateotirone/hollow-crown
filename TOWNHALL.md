# Town hall, Tree of Oaths and the two paths

Code: `Siege_Nights_BP/scripts/townhall/`. Pictures: `art/townhall/`. How to test: the last section of `TESTING.md`.

## The town hall

Craft a **Hall Cornerstone** at the Siege Workshop (3 logs over cobblestone, emerald, cobblestone over 3 cobblestone). Place it inside your settlement where the front door should be, facing the way the hall should run. Click it to build. One hall per settlement.

| Hall | Needs settlement | Size (wide × deep × tall) | Cost | Gives |
|---|---|---|---|---|
| Longhouse | Hamlet | 11 × 15 × 12 | 48 planks, 32 building stone | Tree of Oaths, first ring of skills |
| Stone Hall | Town | 15 × 23 × 16 | 64 planks, 128 stone, 8 iron, 10 emeralds | Second ring, Great Hall, Cartographer's Table, Sage |
| Keep | City | 21 × 27 × 21 | 256 stone, 16 iron, 30 emeralds, 4 diamonds | Third ring, four towers, war room |
| Fortress | Castle | 31 × 37 × 30 | 384 stone, 32 iron, 64 emeralds, 12 diamonds, 2 netherite scrap | Capstones, gatehouse, spires, throne room |
| Sovereign's Throne | Sovereign | 31 × 43 × 34 | 32 gold, 64 emeralds, 16 diamonds, 2 netherite ingots | Crown Ring, gilded hall, crown vault |

"Building stone" is any of cobblestone, stone, stone bricks, cobbled deepslate, deepslate bricks, sandstone, mud bricks or calcite. Iron is vanilla iron. Each new hall replaces the old one in the same spot and **overwrites everything in its footprint** (the menu warns you). Raising a hall for the first time gives skill points equal to its tier.

**Regional styles.** The same five halls in five sets of materials: Vale (stone brick, timber frame, slate), Frostmarch (deepslate, dark oak, steep snowy roofs), Saltreach (calcite, quartz, prismarine roofs), Emberwaste (sandstone, flat crenellated roofs), Blackfen (mangrove on stilts, moss). The style is picked from the biome and can be changed in the menu for free. Styles are data in `styles.js`; halls are drawn by code in `halls.js`, so adding a style is about 25 lines and it applies to every hall.

## Renown and skill points

**Renown** is your level (1 to 50). Every hostile kill gives a little, sieges and halls give a lot. Each level gives 1 skill point, every 5th level gives 2.

Skill points also come straight from deeds: siege held +2, settlement tier up +2, warlord slain +2 (Warlord King +5), crowned Sovereign +5, each hall tier built +1 to +5, first kill of each kind of creature +1, and from the other systems (bosses +5, Lore Tome collections, quests).

## The Tree of Oaths

50 skills in four branches and five rings. A ring opens when your hall is big enough **and** your Renown is high enough (1 / 5 / 12 / 20 / 30).

- **Keep** (everyone): Hearthwarden, Stonewright, Muster Roll, Masonry Wards, Watchfire, Spoils of War, Plunder, Rally the Walls, Master Builder, The Unbreakable Keep, Sovereign's Court.
- **Wayfarer** (everyone): Fleetfoot, Forager, Clue Sense, Horse Whisperer, Pathfinder, Silver Tongue, Night Eyes, Mapwright, Tidewalker, Roadwise, The Long Road Home.
- **Blade** (Knights): Shield Bash, Lunge, Iron Constitution, Riposte, Rallying Cry, Armor Mastery, Guard Captain, Execution, Warhorse Charge, Banner of the Keep, Second Wind, Oathsworn Champion, Crownbreaker.
- **Arcana** (Marked): Ember Bolt, Ward, Quiet Mind, Blink, Echo Sight, Bind, Ashen Skin, Undertow Step, Choir's Call, Resonant Soul, Hollowborn, Hollow Step, Crownless, Voice of the Hollow.

Exact numbers are in `skills.js`, one line per skill. You can unbind everything and get the points back for 20 emeralds (10 from Renown 10).

## The two paths

After your first siege win the **Hollow Ember** falls near your keep. Use it to take it into your hand (Marked), or carry it to the Tree and swear the Squire's Oath (Knight). Permanent.

- **Knight (Oathsworn):** Squire, Man-at-Arms, Knight, Banneret, Knight-Commander, by points sworn in Blade (0 / 3 / 8 / 15 / 26). Techniques trigger from how you fight: sneak + hit with a shield, sprint + hit, being hit while guarding. The **Oath Banner** item rallies (use) or is planted (sneak + use).
- **Marked:** Touched, Listener, Adept, Hollowborn, Sorcerer. Hold the **Bound Ember**: use casts, sneak + use picks the power. Each cast adds **Resonance**. It fades after 3 quiet seconds. At 70 you are "loud" (Hollow mobs can track you, and Resonant Soul makes powers stronger). At 100 you are Overwhelmed: sick, blind and silenced for 8 seconds. With the Hollowborn capstone, 100 instead starts a 10 second Crescendo of free casting, then a crash.

## Not built yet

- The Sage is a menu on the cornerstone, not a walking NPC (the hall saves where the Sage, throne, war room and vault are, so story NPCs can be placed there).
- Clue Sense and Mapwright rank 2 are flags for the lore and map systems to read.
- "Villagers refuse to talk to a loud Marked player" needs the NPC dialogue system.
- Quartermaster discounts are impossible (trade prices can't be scripted), so that skill became Spoils of War.
- The other plot buildings (Smithy, Stables, Library, Watchtower, Apothecary, Market). The build engine is ready for them.

## Ruling the Hollow (Marked endgame)

- **Hollow Step** (Arcana, capstone ring, after Undertow Step): cast it anywhere to step into the Hollow, cast it there to step back to where you left. The Undertow code does the travel; until it answers, the power says the Hollow does not open and costs nothing.
- **Voice of the Hollow** (Arcana, Crown Ring, after Hollow Step): the peak of the Marked path. Learning it is what lets a player claim the Hollow's throne and rule it (the ore, the alerts when someone mines it, the prices). Those ruling systems live with the Undertow and Crown features and read `skills.arc_warden`.

## Roles are earned, not picked

Everyone starts as a plain human (`path: "none"`) with the shared Keep and Wayfarer branches. A role opens one branch of its own. Built so far: Knight (Blade) and Marked (Arcana, top rank **Sorcerer**). The Ember is the one moment that makes you Marked. Other roles are offered by the story (`emit("offerRole", ...)`) and sworn at the Tree of Oaths, one role per player. More roles (Dragon Rider and others, not confirmed yet) slot in as data: an entry in `ROLES`, a branch, a rank ladder and an effects file.

## The victor's offer

Whoever defeats the Hollow can't wear its crown, but is offered the Sorcerer's path with a head start (the Crown feature sends `hollowVictor`). Accepting at the Tree of Oaths gives 15 skill points, opens every Arcana ring without the Renown requirement (the hall tier still applies), and makes powers cost 25% less Resonance. A Knight who accepts lays down the Knight's oath: Blade points are refunded and the Order rank is lost. Someone already on the magic path gets the head start at once.
