# Town hall, Tree of Oaths and the two paths

Code: `Siege_Nights_BP/scripts/townhall/`. Pictures: `art/townhall/`. How to test: the last section of `TESTING.md`.

## The town hall

Craft a **Hall Cornerstone** at the Siege Workshop (3 logs over cobblestone, an iron ingot, cobblestone over 3 cobblestone). Place it inside your settlement where the front door should be, facing the way the hall should run. Click it to build. One hall per settlement.

| Hall | Needs settlement | Size (wide × deep × tall) | Cost | Gives |
|---|---|---|---|---|
| Longhouse | Hamlet | 11 × 15 × 12 | 48 planks, 32 building stone | Tree of Oaths, first ring of skills |
| Stone Hall | Town | 15 × 23 × 16 | 64 planks, 128 stone, 8 iron, 80 Regals | Second ring, Great Hall, Cartographer's Table, Sage |
| Keep | City | 21 × 27 × 21 | 256 stone, 16 iron, 240 Regals, 4 diamonds | Third ring, four towers, war room |
| Fortress | Castle | 31 × 37 × 30 | 384 stone, 32 iron, 512 Regals, 12 diamonds, 2 netherite scrap | Capstones, gatehouse, spires, throne room |
| Sovereign's Throne | Sovereign | 31 × 43 × 34 | 32 gold, 512 Regals, 16 diamonds, 2 netherite ingots | Crown Ring, gilded hall, crown vault |

"Building stone" is any of cobblestone, stone, stone bricks, cobbled deepslate, deepslate bricks, sandstone, mud bricks or calcite. Iron is vanilla iron. Each new hall replaces the old one in the same spot and **overwrites everything in its footprint** (the menu warns you). Raising a hall for the first time gives skill points equal to its tier.

**Regional styles.** Each region builds a different kind of hall, not the same hall in other materials. All five grow through the same five tiers and hold the same things inside (Tree of Oaths, Sage, war room, throne, vault), so the rest of the game does not care which one you have. The style is picked from the biome and can be changed in the menu for free.

| Region | Architecture | Drawn from | File |
|---|---|---|---|
| Vale (plains, forest) | Stone keep with square corner towers, timber upper floors, slate gables | Norman keeps, Tudor hall-houses | `halls.js` |
| Frostmarch (snow, taiga) | Mead hall with stacked steep roofs, a clerestory, crossed gable finials, turrets on the ridge, a stave chapel as vault | Borgund stave church, Viking longhouses, Meduseld | `halls_frost.js` |
| Saltreach (coast) | White basilica with an arcade across the front, flat roof carrying domes, a round lighthouse that gets taller each tier, a rotunda vault | St Mark's in Venice, Hagia Sophia, Dol Amroth | `halls_salt.js` |
| Emberwaste (desert, badlands) | Mud-brick kasbah growing into a stepped ziggurat: tapering towers with patterned crowns, roof beams poking out, a domed pavilion on top, obelisks at the door | Ait Benhaddou, the ziggurat of Ur, Dorne | `halls_ember.js` |
| Blackfen (swamp) | Stilt village: a round great hut under a mossy cone roof, side huts joined at the walls, a witch's tower with an overhanging top room | Lake-town, Ganvie, crannogs | `halls_fen.js` |

Materials are data in `styles.js` (each style names its architecture with `arch`); shared pieces (walls, domes, cones, round rooms, arcades, the furniture every hall needs) are in `hallparts.js`. A new region is one file exporting five builder functions.

## Renown and skill points

**Renown** is your level (1 to 50). Every hostile kill gives a little, sieges and halls give a lot. Each level gives 1 skill point, every 5th level gives 2.

Skill points also come straight from deeds: siege held +2, settlement tier up +2, warlord slain +2 (Warlord King +5), crowned Sovereign +5, each hall tier built +1 to +5, first kill of each kind of creature +1, and from the other systems (bosses +5, Lore Tome collections, quests).

## The Tree of Oaths

50 skills in four branches and five rings. A ring opens when your hall is big enough **and** your Renown is high enough (1 / 5 / 12 / 20 / 30).

- **Keep** (everyone): Hearthwarden, Stonewright, Muster Roll, Messenger (also buyable for 100 Regals; scripts/townhall/messenger.js), Masonry Wards, Watchfire, Spoils of War, Plunder, Rally the Walls, Master Builder, The Unbreakable Keep, Sovereign's Court.
- **Wayfarer** (everyone): Fleetfoot, Forager, Clue Sense, Horse Whisperer, Pathfinder, Silver Tongue, Night Eyes, Mapwright, Tidewalker, Roadwise, The Long Road Home.
- **Blade** (Knights): Shield Bash, Lunge, Iron Constitution, Riposte, Rallying Cry, Armor Mastery, Guard Captain, Execution, Warhorse Charge, Banner of the Keep, Second Wind, Oathsworn Champion, Crownbreaker.
- **Arcana** (Marked): Ember Bolt, Ward, Quiet Mind, Blink, Echo Sight, Bind, Ashen Skin, Halfstep, Choir's Call, Resonant Soul, Choirborn, Veilstep, Crownless, The Last Art.

Exact numbers are in `skills.js`, one line per skill. You can unbind everything and get the points back for 160 Regals (80 from Renown 10).

## The two paths

After your first siege win the **Ember** falls near your keep. Use it to take it into your hand (Marked), or carry it to the Tree and swear the Squire's Oath (Knight). Permanent.

- **Knight (Oathsworn):** Squire, Man-at-Arms, Knight, Banneret, Knight-Commander, by points sworn in Blade (0 / 3 / 8 / 15 / 26). Techniques trigger from how you fight: sneak + hit with a shield, sprint + hit, being hit while guarding. The **Oath Banner** item rallies (use) or is planted (sneak + use).
- **Marked:** Touched, Listener, Adept, Hollowborn, Sorcerer. Use the **Bound Ember** to swap the hotbar for the magic hotbar (one spell icon per power, the Ember in slot 9); use a spell icon to cast it, the Ember again (or sneak + use a spell) to swap back (`townhall/spellbar.js`). Each cast adds **Resonance**. It fades after 3 quiet seconds. At 70 you are "loud" (Hollow mobs can track you, and Resonant Soul makes powers stronger). At 100 you are Overwhelmed: sick, blind and silenced for 8 seconds. With the Hollowborn capstone, 100 instead starts a 10 second Crescendo of free casting, then a crash.

## Not built yet

- The Sage is a menu on the cornerstone, not a walking NPC (the hall saves where the Sage, throne, war room and vault are, so story NPCs can be placed there).
- Clue Sense and Mapwright rank 2 are flags for the lore and map systems to read.
- "Villagers refuse to talk to a loud Marked player" needs the NPC dialogue system.
- Quartermaster discounts are impossible (trade prices can't be scripted), so that skill became Spoils of War.
- The other plot buildings (Smithy, Stables, Library, Watchtower, Apothecary, Market). The build engine is ready for them.

## Ruling the Hollow (Marked endgame)

- **Veilstep** (Arcana, capstone ring, after Halfstep): cast it anywhere to step into the Hollow, cast it there to step back to where you left. The Undertow code does the travel; until it answers, the power says the Hollow does not open and costs nothing.
- **The Last Art** (Arcana, Crown Ring, after Veilstep): the peak of the Marked path. Learning it is what lets a player claim the Hollow's throne and rule it (the ore, the alerts when someone mines it, the prices). Those ruling systems live with the Undertow and Crown features and read `skills.arc_warden`.

## Roles are earned, not picked

Everyone starts as a plain human (`path: "none"`) with the shared Keep and Wayfarer branches. A role opens one branch of its own. Built so far: Knight (Blade) and Marked (Arcana, top rank **Sorcerer**). The Ember is the one moment that makes you Marked. Other roles are offered by the story (`emit("offerRole", ...)`) and sworn at the Tree of Oaths, one role per player. More roles (Dragon Rider and others, not confirmed yet) slot in as data: an entry in `ROLES`, a branch, a rank ladder and an effects file.

## The victor's offer

Whoever defeats the Hollow can't wear its crown, but is offered the Sorcerer's path with a head start (the Crown feature sends `hollowVictor`). Accepting at the Tree of Oaths gives 15 skill points, opens every Arcana ring without the Renown requirement (the hall tier still applies), and makes powers cost 25% less Resonance. A Knight who accepts lays down the Knight's oath: Blade points are refunded and the Order rank is lost. Someone already on the magic path gets the head start at once.

## The Town Board (hand-written jobs from the people round about)

Open it from the Town Hall menu once any hall stands. Every job is pinned up by a real person who stands somewhere in the
world (a townsperson of `townsfolk/data.js` or a town trader) and happens at a real, named place on the map. Three notices a
day, from three different people, never the kind of job you just did; you hold one job at a time, and the quest tracker
says "Talk to <who> about <what>". Everything works alone, and story-only jobs stay out of Settlement Mode.

About sixteen jobs a region (Aldmere Vale 18, Frostmarch 17, Saltreach 16, Emberwaste 17, Blackfen 17), in nine kinds:
Hunt, Camp (a raider camp to break), Supply, Carry, Escort, Watch (keep lamps lit or a flock alive till dawn), Missing,
Recover and Look. Hunt, Camp, Supply, Carry, Escort and Watch come back once the region's pool has gone round once, with an
"again" line; the rest happen once. When a region's own jobs run out for the round, the board also draws from the regions
next to it (Mateo, 2026-11-14).

Ten shared jobs (`SHARED_JOBS`) travel the whole realm. Every town has a smith, a farmer and a factor, so a shared job names
a role and is given by that role in the region's own town (`ROLE_TOWN`); a Carry goes to the same role in a neighbouring
region. Each lives in one region at a time and moves on whenever one of your rounds turns (`sharedHome`), so it never
holds a region's round back, and a shared job done anywhere counts as done everywhere (`doneKey`).

Camps, dens, pens, lamps, ruins and the rest are 3D builds made with the minecraft-builder skill
(`map/structures/board_sites.py` -> `townhall/board_sites_data.js`). A job's site is stamped on its place when the job is
given, while you are still far off; the ground it covers is saved first and put back once the job is over and you have
gone (`townhall/board_sites.js`).

Pay grows with your Renown, and every third job also pays one skill point. Code: `townhall/board_data.js` (jobs, people,
places), `board_rules.js` (picking, rounds, pay, tracker words; pure, self-tested), `board.js` (the game side). Test:
`/scriptevent siege:board take <job id>|step|drop|reset`. Other features hear `boardJobDone` (and the old `rumorDone`).

## Regional roles

Besides Knight and Marked there are four regional roles, each with a branch of nine skills (rings 1 to 5) and five ranks. A player holds one role only.

| Role | Region | Branch | What it is good at | Ranks |
|---|---|---|---|---|
| Dragon Rider (`rider`) | Emberwaste | Wing | Fireproof, heals and shields the dragon you ride, hits harder from the saddle | Fledgling, Rider, Wing-Sworn, Drake-Captain, Dragonlord |
| Forgemaster (`forgemaster`) | Frostmarch | Forge | Faster with tools, sharper weapons, self-mending gear, better-armed guards | Apprentice, Journeyman, Smith, Master Smith, Forgemaster |
| Captain (`captain`) | Saltreach | Helm | Commands guards, stronger arrows, more siege pay, fights best in rain | Deckhand, Bosun, Mate, Captain, Admiral |
| Witch (`witch`) | Blackfen | Hex | Immune to poison, poisons and rots enemies, heals from kills, curses attackers | Bog-Touched, Herbwife, Witch, Crone, Fen Mother |

Data is in `townhall/skills.js` (ROLES, RANKS, BRANCHES, skills `wing_*`, `forge_*`, `helm_*`, `hex_*`); effects are in `townhall/roles.js`. A role is earned by a deed in its region (`ROLE_DEEDS` in `roles.js`; Mateo's ruling of 2026-11-10): Forgemaster for felling the Pale Huntsman, Captain for the Drowned Bride, Witch for the Mother of Changelings (offered to every player without a role within 64 blocks when the boss dies), and Dragon Rider when the dragons feature reports a first hatching. Hall level no longer offers a role. The story can also offer one with `emit("offerRole", { player, role })` / `emit("grantRole", ...)`. Test: `/scriptevent siege:townhall_path rider` (or forgemaster, captain, witch, none). Names and powers are proposals until Mateo confirms them. Not played in the game yet.


## Town Board

Once a hall stands its Hall Cornerstone is taken away (Mateo, 2026-11-12) and the Town Hall menu opens from the **Town Board** (`siege:hall_board`), a wide notice board placed by `boardSpot()` in `halls.js`: just inside the front door, two to six blocks off the aisle, on the floor, under the roof, facing the way in. Every style and level has one (self-test). Halls built earlier get theirs from `addBoard()` on load or when the Town Hall menu opens. To move a hall, use "Move the town hall" in the menu.
