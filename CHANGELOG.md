# Changelog

What changed in each version of The Hollow Crown, newest first. Written for players: say what they will notice, not which files moved.

How versions work is in [`docs/RELEASING.md`](docs/RELEASING.md).

## Unreleased

Everything merged to `main` since the last release goes here. Each pull request that changes what players see adds a line under one of these headings.

### Added
- A world currency backed by iron: the Regal and the Gold Regal (worth 64). The Moneyer swaps iron ingots for coins and back. Job NPCs (Farmer, Woodcutter, Quarryman, Smith, Fisher, Hunter, Herbalist) buy what you gather and sell supplies, with prices that differ by region. A Strongbox on the Keep Banner menu keeps coins safe. Sneak + use a Gold Regal to break it into 64 Regals, or a full stack of 64 to bind one.
- The Hollow Crown expansion on top of Siege Nights: plots, town hall and skill tree, horses and rails, lore tomes and dialogue, new mobs and bosses, the Undertow dimension, the Crown and Citadel. None of it has been played in a real game yet.

### Changed
- Everything is now paid for and paid out in Regals instead of emeralds: siege winnings, warlord and boss drops, guards, the Quartermaster, town hall upgrades, Rumor Board jobs, horses, the Throne's decrees and Treasury, Rival Lord spoils, the Hollow's ore, boats and permits, and the elytra refund. One old emerald is 8 Regals. Emeralds are no longer taken anywhere; the Moneyer buys them for 4 Regals each.
- The add-on is renamed from Siege Nights to The Hollow Crown. The install file is `hollow-crown.mcaddon`. Existing ids keep the `siege:` prefix.
- Needs Bedrock 26.30 or newer.

### Fixed
- The install guide and README now say the right Minecraft version: Bedrock 26.30 or newer.

### Known issues
- The keep's health is capped at 400, but the Castle tier is meant to have 600.

## 1.1.0 (behavior pack) / 1.0.0 (resource pack)

The versions in the pack manifests when the add-on moved into this repo on 2026-11-10. Not tagged as a release, because it has not been playtested.
