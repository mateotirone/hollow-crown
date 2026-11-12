# Town hall, Tree of Oaths and the two paths

Code: `Siege_Nights_BP/scripts/townhall/`. Pictures: `art/townhall/`. How to test: the last section of `TESTING.md`.

## The town hall

Craft a **Hall Cornerstone** at the Siege Workshop (3 logs over cobblestone, emerald, cobblestone over 3 cobblestone). Place it inside your settlement where the front door should be, facing the way the hall should run. Click it to build. One hall per settlement.

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

- **Keep** (everyone): Hearthwarden, Stonewright, Muster Roll, Masonry Wards, Watchfire, Spoils of War, Plunder, Rally the Walls, Master Builder, The Unbreakable Keep, Sovereign's Court.
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

## The Rumor Board (jobs that never run out)

Open it from the Town Hall menu once any hall stands. Three rumors arrive each in-game day, built from parts (who tells it, where, why), and you hold one job at a time. Everything works alone.

| Job | What you do | Pays (grows with Renown) |
|---|---|---|
| Bounty | Kill a number of one kind of monster | 55+ Renown, 16+ Regals |
| Raider camp | Travel 70 to 200 blocks, find the camp, kill every raider | 80+ Renown, 16+ Regals |
| Missing traveller | Find the captive, kill the captors, keep the traveller alive | 80+ Renown, 16+ Regals |
| Supplies | Bring food, arrows, iron or the like to the board | 40+ Renown, 24+ Regals |

Every third job also pays one skill point, so the board is a steady trickle that never beats story rewards. Jobs get bigger every 8 Renown levels. Code: `scripts/townhall/rumors.js`. Other features can add flavour lines with `emit("rumorParts", { givers, places, reasons })` and hear `rumorDone`.

Not built yet from the same proposal: escorts, tome hunts and lord favors (they need the story NPCs and Lore Tomes), story beats gated by tier, sieges and rank, and the Legacy/heir option.

## The Rumor Board (jobs that never run out)

Open it from the Town Hall menu once any hall stands. Three rumors arrive each in-game day, built from parts (who tells it, where, why), and you hold one job at a time. Everything works alone.

| Job | What you do | Pays (grows with Renown) |
|---|---|---|
| Bounty | Kill a number of one kind of monster | 55+ Renown, 16+ Regals |
| Raider camp | Travel 70 to 200 blocks, find the camp, kill every raider | 80+ Renown, 16+ Regals |
| Missing traveller | Find the captive, kill the captors, keep the traveller alive | 80+ Renown, 16+ Regals |
| Supplies | Bring food, arrows, iron or the like to the board | 40+ Renown, 24+ Regals |

Every third job also pays one skill point, so the board is a steady trickle that never beats story rewards. Jobs get bigger every 8 Renown levels. Code: `scripts/townhall/rumors.js`. Other features can add flavour lines with `emit("rumorParts", { givers, places, reasons })` and hear `rumorDone`.

Not built yet from the same proposal: escorts, tome hunts and lord favors (they need the story NPCs and Lore Tomes), story beats gated by tier, sieges and rank, and the Legacy/heir option.

## Who's online

One screen listing every player in the world with their role, rank, Renown level and where they are (overworld, the Hollow, the Nether), sorted by Renown. The top lines say whether the Hollow's ruler and the High Throne's ruler are online right now, since the Hollow's ruler can only be robbed or besieged while online. Everyone also gets a quiet chat line when the Hollow's ruler joins or leaves.

Open it from the Town Hall menu, the keep menu, or anywhere with `/scriptevent siege:who`. Code: `townhall/roster.js`. Other features add a line under a player by listening for `rosterNotes` and calling `notes.add(playerId, "text")`. Rulers are learned from the `wardenChanged`, `crowned` and `stormEnd` events.

## The Hall Map

Every hall has a painted map of the realm (Mateo, 2026-11-12). Open it from the hall's Cartographer's Table (a vanilla cartography table inside a raised hall; sneak-click for the vanilla screen) or "Hall map" in the Town Hall menu. Code: `townhall/hallmap.js`.

- Shows every settlement on a plot in its Keep Banner colour with its holder (your own ringed in gold), rival lords, free plots, the six towns, and found places. Never players.
- Places: Crownhold, the Ashen Gate Chapterhouse and the Ashen Watch (from `plots/config.js` WARDS), plus the lore's **charted** places once the builder marks them (`/scriptevent siege:lore_mark_place`). Mystery places (`charted: false`, thin places, Bellhollow) are never marked, as the Ledger rule says.
- Fog: the map is 16 x 16 cells of about 156 blocks. A player charts every cell within 96 blocks of where they walk on the overworld. A settlement knows what its owner and allies have charted and found (saved per player in `siege:hallmap`).
- Screen: forms titled with `§h§m` are drawn by `ui/server_form.json` as the realm picture with a 16 x 16 grid of cell buttons over it (no other buttons; it closes with its X). Hover shows a mark's name; clicking a mark opens its details. Art: `textures/ui/hc/map/` from `studio/build_hallmap.py` (rerun after the world map is regenerated); UI from `studio/build_tree_ui.py`.

## The upgrade fly-by, and walls

When a hall is raised or upgraded, the owner's camera lifts off and circles the hall while it rises, then returns (sneak to return early). Code: `townhall/flyby.js`, `flyby(player, { center, radius, height, seconds, title })`, usable by any feature.

**Settlement wall.** The Town Hall menu has a "Settlement wall" entry that shows the current wall level, the next level and its cost, and raises it with the same fly-by round the whole wall. The town hall owns the menu and the camera; the feature that owns walls answers `wallInfo` and `wallUpgrade` (the contract is at the top of `flyby.js`). Until something answers, the entry says the masons have not surveyed a wall yet.

## Levels, and who can see them

- **Player level** is Renown, 1 to 50, earned from kills, sieges, Rumor Board jobs and upgrades. On top of it sits the rank on your path (Squire to Knight-Commander, Touched to Sorcerer).
- **Settlement level** is the settlement tier (Hamlet, Town, City, Castle, Sovereign) and the hall that goes with it.
- Everyone can see both on the Who's online screen. Levels are remembered for players who are away: any feature can ask with `emit("levelsQuery", q = { playerId })` and read `q.level`, `q.rank`, `q.role`, `q.settlement`, `q.tier`, `q.hall`, `q.online`.

**Castle Stone.** Every region's stonework comes from its own Castle Stone family: cobbled for foundations, castle stone for the lower walls, bricks for walls, smooth for daises, tiles for flat roofs and domes (Saltreach, Emberwaste). Blackfen keeps wooden walls and stilts on a castle stone footing. Roof stairs, slabs and crenels stay vanilla until the family has those shapes. Castle Stone also counts as "building stone" when paying for a hall.

## Power origins

Every Arcana power has an origin written by the lore feature (`scripts/lore/data/powers.js`, book `siege:fourteen_arts`). The Tree shows one line of it under each power. Four powers stay locked until the player finds where they come from: Echo Sight, Halfstep, Choir's Call and Veilstep. The lore feature sends `powerOriginInfo` (hints and lines) and `powerOrigin` ({ player, skill }) when one is found; the town hall remembers it on the player.

## The tree screen

Each branch opens as a graphical tree: a 6 by 6 grid of nodes, one row per ring, with connector lines behind them. The script sends an ordinary button form whose title starts with an invisible flag (`TREE_FLAG` in `townhall/tree_layout.js`); `Siege_Nights_RP/ui/server_form.json` draws any flagged form as the tree and leaves every other form alone. Buttons are sent in grid order and a button named `-` is an empty cell. Node pictures are `textures/ui/hc/node_*.png`; the lines are `tree_<branch>.png`.

`python3 studio/build_tree_ui.py` writes the screen file and the line art from the layout, so rerun it when skills are added or moved. Players can switch to plain lists from the Tree's first page (saved per player as `plainTree`). This screen has not been seen in the game yet.

## Rumor Board variety

`rumorsFor(day, playerId, level, memory)` never offers the kind of job the player did last and avoids givers, places, reasons and targets they saw recently. One job in three carries a twist that shows when it is finished: a keepsake (ten named items, each given once), double pay, extra Renown, or a debt (no pay, one more guard on your walls, up to three). A self-test plays 120 days and fails if a job repeats.

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
