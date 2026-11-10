# Changelog

What changed in each version of The Hollow Crown, newest first. Written for players: say what they will notice, not which files moved.

How versions work is in [`docs/RELEASING.md`](docs/RELEASING.md).

## Unreleased

Everything merged to `main` since the last release goes here. Each pull request that changes what players see adds a line under one of these headings.

### Added
- A world currency backed by iron: the Regal and the Gold Regal (worth 64). The Moneyer swaps iron ingots for coins and back. Job NPCs (Farmer, Woodcutter, Quarryman, Smith, Fisher, Hunter, Herbalist) buy what you gather and sell supplies, with prices that differ by region. A Strongbox on the Keep Banner menu keeps coins safe. Sneak + use a Gold Regal to break it into 64 Regals, or a full stack of 64 to bind one.
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

- The Old King's Journal now arrives after the look picker and the welcome hall instead of at the same moment: once you have read "How things stand" on the Waystone, or after about 20 seconds.

### Changed
- Everything is now paid for and paid out in Regals instead of emeralds: siege winnings, warlord and boss drops, guards, the Quartermaster, town hall upgrades, Rumor Board jobs, horses, the Throne's decrees and Treasury, Rival Lord spoils, the Hollow's ore, boats and permits, and the elytra refund. One old emerald is 8 Regals. Emeralds are no longer taken anywhere; the Moneyer buys them for 4 Regals each.
- The High Throne no longer repeats itself: each whisper the Heart gives is heard once per reign, a rival lord brings a different and bigger army every time they come back, a ruling lord never sends the same host twice running, Oath Shard news is worded differently each time, and a ruler banished a second time walks a shorter road back.
- The "Who steps off the coach?" character menu is now the first thing a new player sees, and the welcome and the journal wait until it is answered or closed.
- The add-on is renamed from Siege Nights to The Hollow Crown. The install file is `hollow-crown.mcaddon`. Existing ids keep the `siege:` prefix.
- Needs Bedrock 26.30 or newer.

### Fixed
- Joining for the first time now happens in one ordered sequence (look picker, welcome hall, journal) instead of several things appearing at once. Each part moves onto it as its own change lands.
- The install guide and README now say the right Minecraft version: Bedrock 26.30 or newer.

### Known issues
- The keep's health is capped at 400, but the Castle tier is meant to have 600.

## 1.1.0 (behavior pack) / 1.0.0 (resource pack)

The versions in the pack manifests when the add-on moved into this repo on 2026-11-10. Not tagged as a release, because it has not been playtested.
