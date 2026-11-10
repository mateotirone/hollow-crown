# Changelog

What changed in each version of The Hollow Crown, newest first. Written for players: say what they will notice, not which files moved.

How versions work is in [`docs/RELEASING.md`](docs/RELEASING.md).

## Unreleased

Everything merged to `main` since the last release goes here. Each pull request that changes what players see adds a line under one of these headings.

### Added
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

### Changed
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

### Fixed
- Lanternbog's local mystery no longer asks you to type the name of the place below in the first chapter.
- Joining for the first time now happens in one ordered sequence (look picker, welcome hall, journal) instead of several things appearing at once. Each part moves onto it as its own change lands.
- The install guide and README now say the right Minecraft version: Bedrock 26.30 or newer.

### Known issues
- The keep's health is capped at 400, but the Castle tier is meant to have 600.

## 1.1.0 (behavior pack) / 1.0.0 (resource pack)

The versions in the pack manifests when the add-on moved into this repo on 2026-11-10. Not tagged as a release, because it has not been playtested.
