# Explaining the game to players: audit and coverage

Mateo, 2026-11-11: "every mechanic in this game [must be] explained well so people know what they're doing."

This file is the audit behind `scripts/guide/` (the Settler's Almanac). It lists every player-facing mechanic, what a player was told about it in game before the Almanac, and which Almanac page now covers it. Read from `main` at 3f699b1 plus the open pull requests #83 to #101. Nothing here has been checked in Minecraft yet.

## How the game explains things now

1. **A one-line tip** the first time a player meets a mechanic: places a block, clicks a block or NPC, carries an item, sees a creature, or lives through an event (siege night, first hall, the pale fire, entering the other world). Gold `[Almanac]` line in chat, delayed 1.5 s so it never lands on a menu opening, at most one every 6 s per player, never repeated. Can be switched off.
2. **The Settler's Almanac**, a book every player gets on their first join (join step 35, after the journal), with ten chapters. `/siege:guide` opens it for anyone (cheats off); the Keep menu has a button; a book and a feather craft another.
3. **Menus that already explain themselves** stay as they were (the Keep menu, Tree of Oaths, Stables, Station Posts, the Mason, traders, lords, the welcome hall's Waystone). The Almanac points to them instead of repeating them.
4. **Floating "click" labels** (PR #96) mark everything that opens a menu. The Almanac and the labels work together: the label says *that* you can click, the tip and page say *why*.

## Secrets stay secret

- No page names the Hollow except in the chapters **Beyond the seam** and **The High Throne**, which stay hidden until the player has been there (`hollowEntered`) or someone holds the Heart (`crowned`, an Oath Shard, a Gauntlet). The self-test `guide: no page names the Hollow before the story does` enforces this.
- No page at all for things meant to be found: the Cold Forge and the Choirsteel template (PR #83), thin places and the Rift, moon doors, the hidden Returned, the hidden third ending (PR #99), Name the Thin Place, the Tuning Fork, Corvin Hale, the Vault Stair.
- Pages a newcomer shouldn't see yet are `hidden` until met: the pale fire and the two paths, roles by deed, calling a boss, Seeps, the Stone Vigil, Dragons, books in cipher.

## The audit

"Before" is what a player could learn in game without the README. **None** means nothing in game told them.

| Mechanic | Before | Almanac page |
|---|---|---|
| What to do first (plot, banner, workshop, walls, first siege) | Waystone pages explain choosing a plot; nothing after landing | First days: What to do first |
| Land, borders, protection, offline safety, wilds camp kit, hall reserve | Border particles and enter/leave messages; refusals when building fails | First days: Land and protection |
| Siege Workshop and what it makes | One line when the banner is raised | First days: The Siege Workshop |
| No elytra, map edge | Elytra crumble with a message; edge: none | First days: No wings |
| Minimap and `/siege:minimap` | None | First days: The minimap |
| When siege nights come, waves, 3:17, winning, dawn | Keep menu "next siege" line, sidebar during a siege | Siege nights: How siege nights work |
| Keep health, banner falling, held plot, banner theft | Health over the banner | Siege nights: Holding the keep |
| Rams, sappers, defusing charges | Action-bar shout when a charge is planted | Siege nights: Rams, sappers and charges |
| Reinforcing walls (iron, diamond, scrap), patching with stone bricks, mending | **None** (only refusals once you try) | Siege nights: Walls |
| Ballista, trebuchet aim and range, driving the ram, packing up | **None** | Siege nights: Siege machines |
| War Horn | **None** | Siege nights: The War Horn |
| Warlords, adapting raiders, Grand Siege, Sovereign | Titles when they happen | Siege nights: Warlords and the Grand Siege |
| Keep menu, banner colour and dye, tiers by wins | Founding message mentions dye | Your settlement: The Keep Banner and its menu |
| Writ of Alliance | **None** | Your settlement: Allies |
| Hall Cornerstone, town hall, Town Board | Hall menu text | Your settlement: The town hall; Growing: The Town Board |
| Settlement wall levels and mending | Hall menu "Settlement wall" | Your settlement: The settlement wall |
| Mason, Mason's Bench, Foundation Stones | Mason's own lines; Foundation Stone menu | Your settlement: The Mason and ready-made buildings |
| Barracks, recruiting, placing guards, armour upgrades, Wanted, guard limits | One line when the Barracks is placed | Your settlement: Guards and the Barracks |
| Guard posts: stationing guards on the wall and by buildings, the sky view, red/green posts | Tip the first time you click your guard or the Barracks | Your settlement: Guard posts |
| Quartermaster | One line when the desk is placed | Your settlement: The Quartermaster |
| Forester's Lodge (PR #94) | Lodge menu | Your settlement: The Forester's Lodge (`needs` until merged) |
| Map trees can't be felled (PR #94) | **None** (the block just won't break) | Your settlement: The old trees (`needs` until merged) |
| Regals, Gold Regals, breaking them, strongbox | Strongbox menu text | Coin and trade: Regals |
| Traders, regional prices, daily appetite, Moneyer | Trader menus | Coin and trade: Traders |
| Halter, steed levels, crop, whistle, gear, horse sheet | **None** until you try the Halter | Roads: Steeds |
| Stables training, breeding, horse count | Stables menu | Roads: Stables and breeding |
| Breeder's Posts | Post menu | Roads: Breeder's Posts |
| Station Posts, Rail Depot, carriages | Station menu | Roads: Stations and carriages |
| Track, Engine, Coach, driving (PR #88) | **None** | Roads: Trains and Track (`needs` until merged) |
| Extend the line, stations growing (PR #88) | Station menu | Roads: Laying the lines (`needs` until merged) |
| Renown, where skill points come from | Join notice about unspent points | Growing: Renown and skill points |
| Tree of Oaths | Tree screens | Growing: The Tree of Oaths |
| The pale fire: Marked or Knight | Fall message, path screens | Growing: The pale fire (hidden until it falls) |
| Roles by deed | Offer message | Growing: Roles earned by deeds (hidden until offered) |
| Looking Glass and changing your look | Picker on first join | Growing: Your look |
| Journal | Message when given | Books: The old journal |
| Lore Tomes, Dusty Tomes | Tome reader | Books: Lore Tomes and Dusty Tomes |
| Archive Shelves, catalog, Library rewards | Catalog text | Books: Archive Shelves |
| Ledger, answering mysteries, wrong-answer lockout | Ledger text | Books: The Ledger |
| Cipher Wheel, Tide Glass | **None** | Books: Books you can't read (hidden until carried) |
| Talking to characters, portraits | Their own lines | Books: People and portraits |
| Bodies that stay and sink | **None** | The wild: The fallen |
| Regional trophies | **None** | The wild: Beasts and trophies |
| Boss keys, scaling, relics, tempers | One action-bar line if there's no room | The wild: Calling a boss (hidden until carried) |
| Seeps | **None** | The wild: Seeps (hidden until seen) |
| Stone Vigil | **None** | The wild: The Stone Vigil (hidden until seen) |
| Dragons: egg, roost, bond, saddle, petting, mounting, shot down, permadeath | Dragon menus | The wild: Dragons (hidden until met) |
| Rival Lords, their deeds, besieging them | Lord menu | The wild: Rival Lords |
| The other world: rivers, Gloamwings, safe villages | **None** | Beyond the seam: The Hollow (hidden) |
| Choir Ore, the ruler's ping, permits, half yield offline, guardians | Alarm messages when it happens | Beyond the seam: Choir Ore (hidden) |
| Mining villages, Tally, boats | Foreman menu | Beyond the seam: The mining villages (hidden) |
| Throne, decrees, tithe, Unrest, Court | Throne menu | High Throne: The Heart and the High Throne (hidden) |
| Claim, Oath Shards | Shardfall message | High Throne: Earning a Claim (hidden) |
| Gauntlet, Storm, banishment, Exile road | Messages when they happen | High Throne: The Gauntlet and the Storm (hidden) |

## Not covered yet, and why

- **Story beats** (PR #97 opening, #98 middle stretch, #100 road to the Rift, #101 Five Chairs and Homecomings, the six role storylines): the story explains itself through hand-written characters and is meant to be followed, not read about. If playtesters get lost, add a page for the *mechanic* (for example "envoys come on third nights") without the plot.
- **Gates that only open for your people** (PR #95): the Walls page says gates open with one click. When #95 merges, add one line: only the owner, allies and guards can work them, and every gate slams shut when a siege starts.
- **Walls in any stone** (PR #90): when it merges, add to the Mason page that any stone pays for a wall level and the Mason lets you choose what it is built in.
- **Buildings raised by Stables, Barracks and Quartermaster's Desk** (PR #84): a line each on those pages once merged.
- **Building placement rehaul** (plot markers, Plan Book, builders): not built yet. It must add its own pages.
- **Sorcerer powers and Knight techniques** in detail: the Tree of Oaths describes each skill already.
- **Builder and test commands** (`/scriptevent ...`) are deliberately left out of the book.

## Keeping it complete

Every pull request that adds or changes something players do adds or edits its entry in `scripts/guide/data.js` (rules in MODULES.md, "The Almanac"). The self-tests check that every block, item and entity a page names exists (or is listed as waiting on its PR), that hidden pages can be reached, and that no page names the Hollow too early.
