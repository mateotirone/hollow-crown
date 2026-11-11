# Changelog

What changed in each version of The Hollow Crown, newest first. Written for players: say what they will notice, not which files moved.

How versions work is in [`docs/RELEASING.md`](docs/RELEASING.md).

## Unreleased

Everything merged to `main` since the last release goes here. Each pull request that changes what players see adds a line under one of these headings.

### Added
- Every role's story now runs to the end. At the fourth rank each mentor tells you what their tradition has always known and never said: Ysolt's last page about the night the grey army went, the bell moulds the Order hid, the back pages of the Debt Book, the old water in the fen. At the top rank each gives you your part in the last fight, and after Morvane falls each has a last scene. A new Knight-Commander names the Order, or keeps the old name.
- Each top-rank role helps at one stage of the Morvane fight: the Forgemaster's bell breaks the Standing Ranks' step, a Knight-Commander's knights hold the wall in the Night It Ended, the Captain's forty row you down the River, a Dragonlord on the wing burns him at the Rift, the Fen Mother's fen slows your fall, and a Sorcerer's blows land harder at the Seat. Alone, the mentors' students stand in (all but the Sorcerer).
- The Cinder Roost has a roll of the fallen: every rider whose dragon dies is added, and Kesh reads it to you. Three cadets go through the trial beside you, and not all of them come back. When your dragon's bond fills, she gives you two points for the Wing branch.
- Four new signature sounds with stand-ins until the recordings exist: the bell-tongue, the roll drum, the forty rowing and the fen collecting (prompts in SOUND-LIST.md).
- The four regional roles have their own stories now. Each has a mentor who finds you before you can earn it: Kesh Cinder at the Cinder Roost above Sunscar (Dragon Rider: cross the Span over the gorge, walk calmly into the nesting field, then hatch your egg), Ulla Deepforge at the Deepforge above Rimehold (Forgemaster: haul iron and coal for her side-hearth, ring Hroda's Hand-bell on the ice at night, bring down the Pale Huntsman), Harbourmistress Holt at Gull's Rest (Captain: pay your share of Holt's Debt, raise a crew of three, lay the Drowned Bride to rest) and Nell Sedge past Mirelight (Witch: drink the cup, kneel at Goody Sedge's three graves, end the Mother of Changelings). The role is offered at the Tree of Oaths when the trial is done; a boss felled early still counts. The Tree has a "Role trials" page that shows your steps.
- Before you choose at the Ember, the Tree now lists the four regional roles and says plainly that taking the Ember's road closes them. Keeping the Ember and deciding later is fine. If a regional deed happens after you already hold a role, you are told why nothing was offered.
- Your mentor speaks to you every time you rise a rank, in all six roles. Old Mag sits you down when you become a Listener and again as an Adept. A Knight is asked by Sir Aldous to stand on someone else's besieged wall (or hold their own as if it were someone else's, when alone), after which the last knights of the Ashen Gate come to them one by one until all eleven stand together.
- A minimap in the top-right corner: a north-up map of the real world around you (about 190 blocks across) with an arrow that turns as you look, gold dots for the twelve plots, pale squares for towns, and the name of the settlement or region you are in. It moves in steps rather than smoothly. Away from the map and in other dimensions it just says "Uncharted". Type `/siege:minimap` to hide or show it (anyone can, cheats off).
- Every region has its own Castle Gate, Portcullis, Palisade, Wall Planks and Roof Shingles, craftable at the Siege Workshop. Settlement walls are built from them: a Blackfen palisade no longer looks like a Vale one, and each region's gate and portcullis match its wall. Flat roofs and snowy ridges on settlement buildings use the region's shingles.
- Clue Sense works: while you carry the Ledger of Whispers, it whispers on the action bar (with a soft page turn) when a Dusty Tome you have not copied, or a Lore Tome lying on the ground, is within 16 blocks, and says which way.
- Every skill on the Tree of Oaths shows its own painted icon: on the tree screen for skills you hold or can swear now, and on every row of the plain lists.
- Steeds wear their own painted coats: one for each of the five regional breeds, a piebald coat for crossbreds, a see-through Glimstrider, plate barding on the Knight Warhorse, and a proper cloth Caparison in your banner color. Horses you already own change over by themselves.
- Sound has its own voice now. The bell, the horns and about 25 other sounds are lower, softer and layered wherever the game uses them, and nothing is heard twice exactly the same. The 3:17 toll, the siege horn, the first glimpse, a storm tide and every boss's arrival each have their own sound. These are stand-ins built from vanilla sounds until the real recordings are made: `SOUND-LIST.md` has the list and the prompts, `sounds-inbox/` is where the files go, and `/scriptevent siege:sound` opens a sound board in game. No music yet.
- Siege omens now happen around you, not only in grey text: animals turn to face one wall, flames lean, open doors shut, water trembles, dogs bolt, a far bell, something small runs past. One each hour of a siege evening, never the same twice in a night.
- Ravens are now a real bird in the world: small, black, silent and perfectly still. They cannot be hurt, drop nothing, do not move for you, and leave at dawn or the moment a siege starts. (The omen that puts them on your wall at dusk is wired up separately.)
- Seeps now come in five kinds, chosen by the Storyteller to contrast with what you did lately: guarded (as before), hungry (opens wide, guards come fast), still (no guards, it murmurs to you), drifting (it slips away until cornered) and weeping (harmless, closes by itself).
- Pretenders: after Morvane falls, claimants rise at the empty Seat in the Hollow every week or so. Each is generated (a name, one of three bodies, four powers out of nine, and a claim that changes how you must fight it) and the same one never comes twice. While one sits unchallenged the seep surges in the overworld. Each drops a Claimant's Seal with its name on it, plus Choirsteel.
- The shape of a siege night now follows what the world has been through lately: after a run of hard fights the next night is likelier to be a strange or a waiting one. The story chapter now moves past chapter 2 as bosses fall.
- The Rumor Board now takes its three daily jobs and its twists from the Storyteller, so jobs contrast with what you have been doing lately (quiet work after a fight, a mystery after a run of bounties) and twists turn up more evenly.
- Dragons: hatching your first dragon opens the Dragon Rider path at the Tree of Oaths.
- Dragons: an empty hand now always pets a dragon, whether you click it or punch it (no damage, it nuzzles you). To climb onto a saddled dragon, click it holding any item. Folded wings now tuck down along the flanks instead of lying flat.
- Choirsteel gear, made from the Hollow's ore: Helm, Cuirass, Greaves, Treads, Blade, Pick, Axe, Spade and Hoe. Each is crafted from its netherite piece, Choirsteel Ingots and a Gloamquill. Armour protects like netherite and lasts half again as long, and each piece does something of its own; the full set makes you Resonant (a fifth of all damage turned aside, four more hearts). The Blade's every fourth hit rings through nearby enemies. The Pick shows you the next ore, and can mine Choir Ore.
- Bosses never use the same attack twice running while another is ready, and a boss you have already beaten comes back in one of five tempers (Hasty, Relentless, Unquiet, Attended, Wary), never the one it wore last time. Beating a temper for the first time gives a named keepsake.
- The Clockwork Reeve (the minute runs backwards), the Pale Huntsman (snares under the snow) and the Mother of Changelings (a lullaby you must look away from) each have a new attack.
- About one raider in seven is a named veteran with a trait (Fleet, Stubborn, Cruel, Leaping, Ashen). The Grey Warlord now drops loot. `/scriptevent siege:variety` shows what you have met most.
- The Hollow: four new blocks. Veinstone Bricks and Cracked Veinstone Bricks now build the Seat, the bridges, the Truce Hall and the Far Door; Pale Ash covers the waste regions; glowing blue Glint Clusters grow in the highlands and thickly on the climb to the Seat. Their textures are placeholders until the art pass lands.
- The Hollow Crown expansion on top of Siege Nights: plots, town hall and skill tree, horses and rails, lore tomes and dialogue, new mobs and bosses, the Undertow dimension, the Crown and Citadel. None of it has been played in a real game yet.
- In the welcome hall, a plot run by a Rival Lord can be chosen by a newcomer, who takes it over as it stands.
- The map keeps three sealed ways out for later updates (the Shut Pass, the Far Shore, the Horizon Isles). Nothing is behind them yet.
- Sieges escalate with the story (the Reach): every third night at first, then nights nobody can predict, then every night, then the Long Night that dawn does not end, until Morvane falls. A siege night runs on the clock, one wave an hour, the last at 3:17.
- No two sieges in a row play out the same way: seven night shapes (The Feint, The Hammer, The Ring, The Held Breath and more), a different army each time, and omens that do not repeat.
- A captain who reaches your wall and survives comes back for you by name, up to three times. Captains you bring down are listed at your Keep Banner.
- Night honours: 16 named things to earn once from siege nights, each worth a skill point, shown under "The night watch" at the Keep Banner.
- A player who takes over a Rival Lord's settlement starts where the lord left off: the same tier, town hall, buildings and wall. A newcomer can pick a lord's plot and the lord steps down. Everything inherited can be changed or pulled down.
- Rival Lords build on the same mapped layout as players, facing the plot's gate, and raise settlement walls that keep pace with their tier.
- Rival Lords are active neighbours. Every other day one of them acts, and never does the same kind of thing twice running: they declare war and join the next siege night at your settlement (never the same way twice running), feud with each other until one kneels, demand tribute, send gifts and rumours, offer a truce or an alliance, and put new goods up for trade. From a lord's menu you can trade, send gifts, back them in a feud, buy off a march, and swear or break an oath. A sworn ally sends soldiers to your wall on siege nights. Nothing happens to a player who is offline.
- Settlement walls vary: stone weathers in patches, towers stand at different heights, arrow slits and lanterns break up long runs, palisade stakes are uneven. Each settlement's wall is its own, and a rebuilt or repaired wall comes out the same.
- Story characters greet you in four different ways instead of one, the dusk ravens have eight lines for each state, moon doors four, and traders have twelve more rumors. No line of lore is heard twice running.

- The Vault under the Seat has a sealed door in its north wall. It does not open yet.
- The Tree of Oaths opens as a real skill tree screen: skills in rings with lines between them. A button on its first page switches back to plain lists.
- Rumor Board jobs no longer repeat: the board never offers the kind of job you just did, and one job in three ends with a twist. Ten named keepsakes to collect.
- First join now runs in order: look picker, then the welcome hall, then the journal. After you pick a plot the last line in chat is your next step.
- Four regional roles, each with its own branch of nine skills and five ranks: Dragon Rider (Emberwaste), Forgemaster (Frostmarch), Captain (Saltreach) and Witch (Blackfen). Raise a Stone Hall in a region's style and its role is offered to you at the Tree of Oaths.
- The Old King's Journal now arrives after the look picker and the welcome hall instead of at the same moment: once you have read "How things stand" on the Waystone, or after about 20 seconds.
- Mining villages in the Hollow now have something different going on each time you walk in: a rich seam, a Foreman's half price, a seat by the fire, a nest broken open in the mine, or a miner asking you to go and look at a place for them. The game's Storyteller picks, so the same thing never comes up twice running. Miners no longer repeat the line they said last.


- The story now has one spine from any of the twelve plots: your plot's first book sends you to Sister Wren in Millbrook, your plot's mystery leads to your own region's boss, each regional boss leaves two leads in other regions, and the third one down points you at the Surveyor's Field Notes.
- The four regional roles (Dragon Rider, Forgemaster, Captain, Witch) each have a history, and their top four powers show a line of it in the Tree of Oaths.
- A world currency backed by iron: the Regal and the Gold Regal (worth 64). The Moneyer swaps iron ingots for coins and back. Job NPCs (Farmer, Woodcutter, Quarryman, Smith, Fisher, Hunter, Herbalist) buy what you gather and sell supplies, with prices that differ by region. A Strongbox on the Keep Banner menu keeps coins safe. Sneak + use a Gold Regal to break it into 64 Regals, or a full stack of 64 to bind one.
- The story now has one spine from any of the twelve plots: your plot's first book sends you to Sister Wren in Millbrook, your plot's mystery leads to your own region's boss, each regional boss leaves two leads in other regions, and the third one down points you at the Surveyor's Field Notes.
- The four regional roles (Dragon Rider, Forgemaster, Captain, Witch) each have a history, and their top four powers show a line of it in the Tree of Oaths.

- The ravens are on your wall for real: at dusk on a siege night they perch in a row on the stretch of wall nearest you, as many as the message counts, and leave when the siege starts.
- The morning after the first Hollow soldiers appear is now told settlement by settlement, to the people of the settlement that saw them, instead of to everyone in the world at once.
- The Choir fight shows rings of violet light: at the feet of every Singer during the Hymn, around the Conductor as it winds up an attack, and with each Toll.
- Amethyst grows wild in the Hollow: patches of purple crystal at every stage of growth rise out of the ground, thickest in the basalt highlands. Break a full cluster for amethyst shards and it grows back in time.
- Giant Veilcaps: the Hollow's pink mushrooms now also grow to the size of trees, with glowing caps on pale stems, mostly in the fens and groves. Veilmoss spills over ledges and hangs down cliff faces in strands.
- The Hollow's air moves: spores drift from Veilcaps, moss drips, crystals glint, ash lifts off the wastes, sparks run along the veined stone and pale motes float around you.
- The water of the Blackfen is black: near-opaque on the surface and almost blind underwater. (It follows the mangrove swamp biome, which only the Blackfen uses on the map.)

- The eighth old painting, the Forty-Second Portrait, is kept for the Burned Archive, and what its caption says changes once the story is over.
- Regional Castle Guard armor: Vale, Frostmarch, Saltreach, Emberwaste and Blackfen sets with the same stats as the Castle Guard armor and their own look (kettle hat and brigandine, fur hood and quilted wool, bleached sallet and rope belt, blackened scale with a veil, laced leather lamellar). Each keeps the banner-colour tabard. Make one at the siege workshop from a Castle Guard piece and that region's Castle Stone.

### Changed
- Six bosses are resized to Mateo's heights (a player is 1.8 blocks): the Clockwork Reeve stands 7 blocks tall, the Pale Huntsman 5, the Warlord King 4, the Ash Seneschal and the Mother of Changelings (and her masks) 3; the Drowned Bride stays 2.2. Their hitboxes, melee reach and bodies after the fight scale with them.
- The northern town is now called Rimehold wherever it shows (its protected-area message, the map and the character creator), and its frozen lake Hallowmere, following the naming pass. The Frostmarch plot once called Rimeholt is now Frosthelm, so the two are no longer one letter apart.
- The moon has a hairline violet crack that shows more the fuller it is.
- The Hollow bolt is a violet shard with a white-hot heart instead of a flat colour.
- A few late-story figures and the Standing Rank got a hand-detail pass on their skins.
- In the Standing Ranks stage of Morvane's fight, the suit he is really in now holds its blade in the left hand while the empty suits hold theirs in the right, as well as the light on the hand.
- In the Standing Ranks stage of Morvane's fight, the suit he is really in now holds its blade in the left hand while the empty suits hold theirs in the right, as well as the light on the hand.
- The northern town is now called Rimehold wherever it shows (its protected-area message, the map and the character creator), and its frozen lake Hallowmere, following the naming pass. The Frostmarch plot once called Rimeholt is now Frosthelm, so the two are no longer one letter apart.
- The moon has a hairline violet crack that shows more the fuller it is.
- The Hollow bolt is a violet shard with a white-hot heart instead of a flat colour.
- The Choirsteel chestplate now covers the whole arm (vambrace and cuff under the shoulder plate), not just the shoulders.
- On the map a settlement's land is full size (60 blocks) from the day you arrive, and siege wins no longer grow it. Tiers still unlock wall levels, buildings and keep health. A Castle's keep now really has 600 health.
- Regional roles are now earned by a deed in their region instead of by raising a Stone Hall there: Forgemaster for bringing down the Pale Huntsman, Captain for the Drowned Bride, Witch for the Mother of Changelings, and Dragon Rider when your first dragon hatches.
- The endless siege (the Long Night) now begins when the Rift is opened, not when the Choir falls. Thunderstorms roll in with each wave of it and clear between them.
- Every settlement gets its own night when the army stops at 3:17 and something else walks out. It is no longer once per world.
- The evening before a siege is long for a settlement's first three sieges, then shortens, and shortens again after six.
- After the story, raids are sent by the rival towns at random, at their own hour, led by the lord by name.
- Once the count can't be trusted, the night watch gives a hint ("The watch is uneasy tonight") and never a date.
- The Warlord King's crown is no longer called the Hollow Crown anywhere. It is an iron crown with a shard of the Hollow set in it; his later phases are "On foot, the shard burning" and "The shard wakes".
- Holding the Heart of the Hollow is now whispers only: the Heartbearer hears things and a few patches of grass die near the throne, but nothing ever harms them, changes them or makes them easier to unseat.
- Each ruler names their own Citadel when they raise it or take it. Leave the name empty and it is Aldspire.
- The Hollow looks less busy: Veinstone is quieter and comes in four mixed variants, Choir Ore shows big bright crystals, Latticewood is an uneven honeycomb and Veilmoss grows in soft clumps. Veinstone Bricks, Pale Ash and the Glint Cluster have their real art.
- The High Throne no longer repeats itself: each whisper the Heart gives is heard once per reign, a rival lord brings a different and bigger army every time they come back, a ruling lord never sends the same host twice running, Oath Shard news is worded differently each time, and a ruler banished a second time walks a shorter road back.
- The "Who steps off the coach?" character menu is now the first thing a new player sees, and the welcome and the journal wait until it is answered or closed.
- The add-on is renamed from Siege Nights to The Hollow Crown. The install file is `hollow-crown.mcaddon`. Existing ids keep the `siege:` prefix.
- Needs Bedrock 26.30 or newer.
- Everything is now paid for and paid out in Regals instead of emeralds: siege winnings, warlord and boss drops, guards, the Quartermaster, town hall upgrades, Rumor Board jobs, horses, the Throne's decrees and Treasury, Rival Lord spoils, the Hollow's ore, boats and permits, and the elytra refund. One old emerald is 8 Regals. Emeralds are no longer taken anywhere; the Moneyer buys them for 4 Regals each.
- The eight job NPCs (Farmer, Woodcutter, Quarryman, Smith, Fisher, Hunter, Herbalist, Moneyer) now wear their own painted clothes instead of a stock NPC look. Ones already placed in a world change over the first time someone clicks them.
- Each region's Smith sells that region's Castle Guard armor set for Regals (helmet 50, chestplate 90, leggings 70, boots 50), a little over the plain set at the Quartermaster. The sets appear once the regional armor is in the pack.
- On a mapped world, the job NPCs now stand ready in the map's six towns the first time a player comes near: all eight plus the Moneyer in Kingsrest, four to six in each regional town. Map builders can move them, and `/scriptevent siege:economy_towns` lists or resets them.
- Farms can no longer print Regals forever. Each trader stops buying a good from you for the day once its price has bottomed out (the Moneyer at 128 iron ingots a day), and monsters drop coins only when a player kills them.

### Fixed
- Lanternbog's local mystery no longer asks you to type the name of the place below in the first chapter.
- Joining for the first time now happens in one ordered sequence (look picker, welcome hall, journal) instead of several things appearing at once. Each part moves onto it as its own change lands.
- The install guide and README now say the right Minecraft version: Bedrock 26.30 or newer.
- The self-test command no longer freezes or crashes the game: in a world it now only checks that the pack's blocks, items and entities loaded, and it says which build is running.
- First playtest load errors: dragons load again, the Keep Banner and brazier no longer mix material types, and eight still models (Stone Vigil, Rime Pillar, Seep, Omen Raven, Hollow Bolt and the three reveal figures) no longer log animation errors.
- The six 3D weapons (Longsword, Warhammer, Minute Hand, Oath of Oswin, Warlord's Brand, Rimefang Bow) sit in the hand like the vanilla trident instead of floating at the hip pointing backwards.
- The self-test now runs a few checks per tick instead of all at once when the world loads, so it can't stall a world or a Realm on startup. `/scriptevent siege:selftest` says it is running, then reports.
- The world no longer shuts down a few seconds after loading ("Multiplayer Connection Failed"): the 17 heaviest self-tests, which froze the game long enough for its watchdog to close the world, now run only in the offline check.
- Scripts load again on Minecraft: one module re-exported names it had imported, which Minecraft's script engine could not link ("Could not find export 'AFTER'"), so no script ran at all.
- The character look no longer logs errors on the menu paper doll.
- Both packs are now version 1.2 and point at each other's real version, and every install file carries its own build number, so re-importing a new build replaces the old one instead of being skipped.

### Known issues
- The keep's health is capped at 400, but the Castle tier is meant to have 600.

## 1.1.0 (behavior pack) / 1.0.0 (resource pack)

The versions in the pack manifests when the add-on moved into this repo on 2026-11-10. Not tagged as a release, because it has not been playtested.
