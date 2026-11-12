# Siege Nights script layout (for everyone adding code)

The old 89 KB `scripts/main.js` is split into small files. Siege Nights gameplay is unchanged.
New Hollow Crown features each live in **their own folder** and only touch the rest through
`scripts/siege/api.js`. That keeps parallel work from colliding.

```
Siege_Nights_BP/scripts/
  main.js              entry: imports core, siege, then each feature folder, then starts the loop
  core/                engine pieces any feature can use (no gameplay)
    loop.js            onTick(): the shared main loop
    events.js          on()/emit() events, and hooks
    store.js           moduleStore(): a saved JSON blob per feature
    firstjoin.js       addJoinStep(): the one ordered sequence that greets a joining player
    tests.js           addTests(): self-tests, run at world load and by /scriptevent siege:selftest
    sfx.js             sfx(): play a sound. Use it instead of playSound (see "Sounds" below)
  siege/               the original Siege Nights, split by topic (keep, siege, warplan, walls ...)
    settings.js        SETTINGS: the numbers Mateo tweaks
    api.js             THE PUBLIC API. Import from here, not from the other siege/ files
  bestiary/  lore/  undertow/  crown/  plots/  horses/  townhall/ ...   one folder per feature
tools/check.mjs        offline check: loads every script in Node with a fake Minecraft, runs the tests
```

## Adding a feature

1. Make `scripts/<feature>/index.js`. It may import its own files, `../core/*.js` and `../siege/api.js`.
2. Add **one line** to `scripts/main.js` in the "Features" block: `import "./<feature>/index.js";`
   Only add it once your index.js exists and loads: a missing or broken import stops the whole pack.
3. Run `node tools/check.mjs` from the `siege-nights/` folder. It must say `ALL OK`.

## Rules

- **Namespaces:** blocks, items, entities `siege:` (or `hc:` if your thread already uses it). Tags
  `siege_<feature>_*`. Dynamic properties `<ns>:<feature>_*`. Scriptevent ids `siege:<feature>_*`.
- **Startup:** at load time only subscribe to events and register things. Do not call
  `world.getDimension`, `world.getDynamicProperty` or `getState()` at the top level: the world isn't
  ready yet. Do it inside an event handler, a tick, or `on("ready", ...)`.
- **Ticks:** use `onTick(name, everyTicks, fn)` from `core/loop.js` instead of your own
  `system.runInterval`. Each task gets its own error guard, so a crash in yours can't stop sieges.
- **Your saved data:** use `moduleStore("<ns>:<feature>", () => defaults)` (or your own prefixed
  dynamic properties). Do not add fields to the Siege Nights state blob. One dynamic property holds
  about 32 KB, so split big data across keys.
- **Siege Nights state:** `getState()` returns the live object. Mutate it and call `saveState()`.
  Never keep a copy, or your write and Siege Nights' next save will overwrite each other.
- **Event handlers:** `world.afterEvents.*.subscribe` directly, as usual. If the handler reads Siege
  Nights state, start with `if (!isReady()) return;`.
- **Tests:** add a few with `addTests("<feature>", { "name": () => { assert(...) } })`. Pure ones run
  in Node and in game; pass `{ gameOnly: true }` for ones that need the real world.

## Sounds: `sfx`

Play every sound with `sfx()` from `core/sfx.js`, not `playSound`. It takes the same arguments with the target first:

```js
import { sfx } from "../core/sfx.js";
sfx(player, "random.levelup");                               // only that player hears it
sfx(dimension, "block.bell.hit", location, { pitch: 0.5 });  // everyone near that spot
```

A vanilla id with a recipe in `core/sfx_cues.js` comes out reworked (lower, layered, a little different each time); your pitch
and volume still apply on top. A named cue such as `"sig.toll_317"` plays Mateo's recording once it is installed
(`python3 tools/install_sounds.py`) and a vanilla stand-in until then. Any other id is played as it is. `sfx` never throws.
`SOUND-LIST.md` is generated from those files by `node tools/sound-list.mjs`; the check fails if it is stale, so run it
after you add or remove a sound.

## Greeting a player who joins: `addJoinStep`

Do not subscribe to `playerSpawn` to greet, teleport, open a form or hand out an item. Add a step to the join
conductor (`core/firstjoin.js`, also exported from `siege/api.js`). Steps run one after another, each awaited, so
nothing lands on top of anything else.

```js
addJoinStep(20, "welcome hall", async (player, { first, wait }) => {
  // teleport, title, message ...
  await wait(60);                // ticks; hold the next step back for 3 seconds
}, { when: "first" });           // "first" | "returning" | "always" (default); timeout: seconds (default 30)
```

| order | step | owner | when |
|---|---|---|---|
| 10 | look picker (reserved looks just apply) | looks | first |
| 15 | waits (up to 85 s, action-bar line) while a fresh Hollow Crown map sets itself up | opening | first |
| 20 | welcome hall teleport, title and message (map mode only) | plots | first |
| 30 | journal handed over (after "How things stand", or about 20 s; about 3 s after the picker with no hall) | lore | first |
| 40+ | returning-player notices: unspent skill points and so on | town hall and others | returning |

- Return (or resolve) only when the player is done with your step, for example after `form.show()` resolves.
- After `timeout` seconds the conductor moves on without you, so a form left open can't stall the rest.
- The sequence starts 3 seconds after the player spawns. If they leave midway it starts over next time.
- `on("joined", ({ player, first }) => ...)` fires when every step has run.
- Quiet housekeeping on spawn (restoring state, re-applying an effect) can stay on `playerSpawn`.

## `scripts/siege/api.js`

```js
import {
  // state
  isReady, getState, saveState,
  // settlements
  settlementAt,      // (location) -> owner player id or undefined. Overworld locations only.
  keepOf,            // (ownerId) -> keep { x, y, z, name, color, wins, allies, sovereign, ... } or undefined
  tierOf, TIERS,     // tierOf(keep) -> { name, wins, radius, keepHealth }
  keepCenter, keepBlock, keepHealth, isOnline, isAlly, ownerTag, ownerOf, keepFallen, recordWin,
  // sieges
  spawnRaider,       // (dim, type, x, z, fallbackY, tags[], name?) -> entity or undefined
  isNight, startSiege, endSiege, raidersLeft, nextSiegeDay, planSiege, FACTIONS, MODIFIERS,
  RAIDER_TAG, RAM_TAG, SAPPER_TAG, WARLORD_TAG, KING_TAG,      // and every other id in siege/constants.js
  // walls
  hitWall, blastDamage, wallHp, lightCharge,
  // guards
  guardTag, guardOwner, guardCount, guardLimit, isGuard, markWanted, GUARD_TYPES, GUARD_ARMOR, armorTier, equipGuard,
  // shared helpers
  title, overworld, takeItems, countItem, consumeHeld, pick, SETTINGS,
  // events and hooks
  on, emit, addFilter,
  addLandClaim, addFoundingCheck, addSiegeSkipHook, addPlanHook, addRaiderTypeHook,
  addRewardHook, addGuardLimitHook, addKeepHealthHook, addKeepMenuButtons,
  // core tools (same as importing from ../core/*.js)
  onTick, moduleStore, addTests, assert, assertEqual,
} from "../siege/api.js";
```

### Events: `on(name, (data) => ...)`

| name | data | when |
|---|---|---|
| `ready` | `{}` | once, on the first tick after the world and saved state are loaded |
| `siegeStart` | `{ provokedBy }` | a siege night begins (after plans are made) |
| `discordAlert` | `{ kind, text, ping?, hollow? }` | emit it to post a line to the group's Discord through the relay (docs/DISCORD.md); `hollow: true` holds it back until someone has entered the Hollow |
| `siegeEnd` | `{ outcome, besieged }` | outcome is `"won"`, `"dawn"` or `"empty"` |
| `siegeReward` | `{ player, emeralds, threat }` | (`emeralds` is the old unit: 8 coins each) a defender was just paid for holding their keep (after `addRewardHook`) |
| `keepFounded` | `{ player, keep, moved }` | a Keep Banner founded (or moved) a settlement |
| `keepFallen` | `{ owner, keep }` | a keep fell during a siege |
| `tierUp` | `{ owner, before, after }` | Hamlet → Town → City → Castle |
| `warlordSlain` | `{ owner, name, king }` | a warlord (or the Warlord King) died |
| `raiderKilled` | `{ entity, killer, owner }` | any siege raider died during a siege |
| `sovereignCrowned` | `{ owner }` | a Castle beat the Grand Siege |
| `chapter` | `{ player, from, to, name }` | a player reached a new story chapter (see The Storyteller) |

Listeners run inside a try/catch, so a broken listener only logs a warning.

### Hooks (change Siege Nights behaviour; with none registered it behaves exactly as before)

| hook | your function | effect |
|---|---|---|
| `addLandClaim` | `(location) => ownerId \| undefined` | Extra land. `settlementAt` asks these after the keeps, so protection, borders and building rights follow. The id **must own a keep**. |
| `addFoundingCheck` | `(player, block, oldKeep) => message \| undefined` | Checked first when a Keep Banner is placed. A message refuses the banner and hands it back. |
| `addSiegeSkipHook` | `(owner, keep) => true` | Leave that settlement out of the siege: no keep heart, no plan, no raiders. |
| `addPlanHook` | `(plan, owner, keep) => void` | Edit the war plan right after it is made (`faction`, `budget`, `modifiers`, `warlord`, `sides`). |
| `addRaiderTypeHook` | `(type, { tags, name }) => newType \| undefined` | Swap a raider's entity type as it spawns. Tags carry the role: `siege_ram`, `siege_sapper`, `siege_warlord`, `siege_warlord_king`, plus the owner tag. Tags, name and buffs are applied to your entity as usual. |
| `addRewardHook` | `({ player, emeralds, threat }) => newEmeralds` | Change a defender's pay before it is handed out. |
| `addGuardLimitHook` | `(owner, base) => number` | Change how many guards a settlement can keep. |
| `addKeepHealthHook` | `(owner, base) => number` | Change keep heart health. The `siege:keep_heart` entity's max health (400 today) still caps it. |
| `addKeepMenuButtons` | `({ player, keep, owner, mine }) => [{ label, icon?, action }]` | Extra buttons on the Keep Banner menu, above "Close". |
| filter `nextSiegeLine` | `addFilter("nextSiegeLine", (line, { until, day, owner, keep }) => newLine)` | Replace the "Next siege: in N days" line on the Keep Banner menu, for when the count can't be trusted. |

Anything else: `addFilter(name, (value, context) => newValue)` is the general form these are built on.

Not possible: Quartermaster prices. They are a fixed trade table (`trading/quartermaster_trades.json`), and scripts cannot change or observe villager trades.

Need another hook? Ask the "Prepare Siege Nights code for parallel work" thread rather than editing `siege/` files yourself.

## The Storyteller (`core/storyteller.js`): pacing and the story chapter

The rule from the design doc is "a director, not a dice roll". Anything that would otherwise pick with
`Math.random()` what a player gets next (a rumor, a siege shape, a seep, a Rival Lord's move, a twist) asks the
Storyteller instead. It remembers what each player did and was offered lately and picks for **contrast**: quiet after a
siege, a mystery after a run of fights, a journey after days at home. From one deck it never gives the same option, or
the same kind of option, twice running, and it favours what the player has seen least.

```js
import { registerDeck, storyPick, pickSeveral, maybePick, note, markDone, chapterOf } from "../siege/api.js";

registerDeck("rumors", [                                    // at load time, once. Deck name = your feature's
  { id: "bounty_wolves", kind: "fight", from: 1 },          // from / to: story chapters it fits (default: all)
  { id: "lost_child", kind: "mystery", weight: 2 },         // weight: how common (default 1)
  { id: "escort_salt", kind: "journey", from: 2, to: 6 },
  { id: "founders_grave", kind: "mystery", once: true },    // never again once markDone
  // any other fields are yours; you get the same object back
]);

const job = storyPick("rumors", player);          // one option, or undefined if nothing fits
const board = pickSeveral("rumors", player, 3);   // three different ones, kinds mixed
const twist = maybePick("rumor_twists", player);  // usually undefined; likelier the longer since the last
note(player, "journey");                          // the player really DID this kind of thing
markDone(player, "rumors", job.id);               // things stay done
```

- **Kinds** (fixed, saved in worlds): `fight`, `mystery`, `journey`, `quiet`, `social`, `build`. Pick the one that says
  how the beat *feels* to the player.
- **Subject**: a player, or an id string for something that is not one (`"lord:" + lord.id`, `"world"`). A lord's own
  memory keeps a lord from making the same move twice; pass `{ chapter: chapterOf(player) }` to pick at a player's level.
- **Options are data.** An update adds rows with `addOptions("rumors", [...])`. Option ids are saved, so never rename or
  reuse one. A deck used with `storyPick` needs at least 3 options of 2 kinds (a self-test fails otherwise); decks for
  `maybePick` are registered with `{ chance: 0.25 }` and may be small.
- **Tell it what happened.** It already notes `fight` after a siege and `build` when a keep is founded or grows. Call
  `note()` for the rest: a boss or lord fought, a long ride finished, a mystery solved, a trade or talk (`social`),
  a night nothing came (`quiet`).
- `storyPick(deck, subject, { peek: true })` looks without counting. `{ exclude: [ids] }` leaves some out.
  (In `core/storyteller.js` the function is called `pick`; api.js already had a `pick`.)
- **Measuring:** `/scriptevent siege:storyteller` shows your chapter, what you did lately, what each deck would give you
  next, and anything served more than four times (`overserved(player)`). Content on that list needs more variants.

### Story chapters

The one shared chapter number, from the story spine. A chapter begins when a fact becomes true, never after a count of
days. `chapterOf(player)` never goes backwards. `worldChapter()` is the furthest the world has gone (chapters 3 and up).
`on("chapter", ({ player, from, to, name }) => ...)` fires once per player per step.

| # | name | begins when | fact | reported by |
|---|---|---|---|---|
| 0 | Arrival | first join | | |
| 1 | The Counted Nights | the player raises a Keep Banner | `keepRaised` | siege |
| 2 | The Ember | the player wins a first siege | `siegesWon` | siege |
| 3 | The Leaning | the first regional boss falls | `bossesFallen` >= 1 | reach |
| 4 | The Miscount | three bosses have fallen | `bossesFallen` >= 3 | reach |
| 5 | The Thin Place | five bosses have fallen | `bossesFallen` >= 5 | reach |
| 6 | The Long Night | the Rift is opened (the Choir falling stands in until `riftOpened` is reported) | `riftOpened` | reach |
| 7 | The Quiet After | Morvane falls | `morvaneFallen` | reach |

The feature that owns a fact reports it once at load: `provideFact("bossesFallen", () => count)`. Until it does, the
fact counts as not yet true, and `/scriptevent siege:storyteller` lists it as missing.

## Feature APIs

A feature that other features need to read exposes its own `scripts/<feature>/api.js`. Import from that file only.
Add a line here when you publish one.

- **plots** (`scripts/plots/api.js`): `allPlots, plotAt, holderOf, npcOf, isFree, plotOf, freePlots, giveToNpc, releaseNpc,
  mapMode, outsideMap, wardAt, MAP, PLOT_PLAN, WARDS, WELCOME, pickOf, statusOf, hallBuilt`. Towns and landmarks are "wards"
  (`plots/config.js` WARDS): in map mode Survival players can't break or place there. The welcome hall (`plots/welcome.js`)
  emits **`plotChosen` `{ player, plot }`** when a new player picks their starting plot, just before they are set down beside
  its Plot Stone: listen for it to raise their first building. `pickOf(plot)` is who a plot is being kept for.
  `EXPANSION` lists the sealed zones kept for later updates; an update calls `openZone(id)` to let players past the map
  edge into that zone's land. Zone ids are saved in worlds, so never rename or reuse one.
  Also `registerPlot(planName, loc)` (record a Plot Stone placed by script), `raiseHall(o, then)` (build the welcome hall,
  spread over ticks) and `setKingsrestArrival(spot)`; event **`startedHomeless` `{ player }`** when a newcomer starts in Kingsrest with no plot.

- **opening** (`scripts/opening/`): the story opening with no builder commands. The first time the generated map loads
  (`map/genworld.py` leaves a gold block on the Kingsrest square, each plot marker and each town square) it puts Plot Stones
  on the twelve markers, builds the welcome hall and stands Sister Wren on a porch on the Millbrook square, a few places at a
  time with ticking areas `hc_open_0..3`. Worlds without the Kingsrest gold block are left alone. Event `openingSetUp {}` when done.
  Builder commands: `/scriptevent siege:opening status|setup`, and `/scriptevent siege:wren` moves Wren to where you stand.

- **landmarks** (`scripts/landmarks/`): fixed old things on the map (each plot's relic now; story sites next) that build
  themselves the first time a player comes within 96 blocks, on any map world (map mode only), one site at a time with the
  ticking area `hc_landmark`. Designs are minecraft-builder skill specs in `map/structures/landmarks.py`, exported by
  `export_landmarks.py` to `designs_data.js` (Bedrock ids + states, rows). Placement on the land is `landmarks/plan.js`
  (pure): `rigid` designs stand at the median ground and are graded in, `drape` designs follow the ground column by column
  (`rise`: posts stand up out of water). Pieces that need a shore or cliff edge seek it; their spots are worked out from the
  map by `map/structures/landmark_preview.mjs` (also writes preview scenes) into `spots_data.js`. Add a site in `sites.js`;
  raise its `version` to rebuild it in old worlds. Event **`landmarkFound` `{ player, site }`** when someone stands at a
  built one. Builder commands: `/scriptevent hc:landmark_status`, `hc:landmark_tp <id>`, `hc:landmark_build <id>`.

- **looks** (`scripts/looks/index.js`): `lookOf(player)`, `setLook(player, look)`, `chooseLook(player)`, `looksFor(name)`. The add-on now ships
  `entities/player.json` (BP) and `entity/player.entity.json` (RP), both written by `studio/build_looks.mjs` from vanilla copies
  in `studio/looks/vanilla/`. **Need to change the player entity? Add it to that script, not to the JSON**, or the next run undoes it.

- **economy** (`scripts/economy/api.js`): the world currency (iron-backed coin; item ids `siege:coin`, `siege:gold_coin` = 64).
  `funds(player)`, `charge(player, n, why?)` (false if short, free in Creative), `pay(player, n, why?)`, `coins(n)` for menu text,
  `fromEmeralds(e)` (x8), `worth(e)` for text, `chargeE`/`payE`/`fundsE` for prices still written in the old unit, `dropCoins`, `coinStacks`, `WALLET` for the Mason's `setWallet`, `spawnJobNpc(dim, loc, jobId, region?)`, `regionAt(loc)`.
  Events `coinsPaid`, `coinsSpent`, `goodsSold`. **Pricing something? Charge with `charge()`, not emeralds**; an old emerald price is 8 coins.

- **reach** (`scripts/reach/api.js`): how sieges escalate. One world number, the Reach (0-100), picks a stage 1-6 (`reach/rules.js` STAGES:
  Counted Nights, Leaning, Miscount, Uncounted Nights, Long Night, Quiet After). `reachStage()`, `reachValue()`, `stageInfo()`,
  `tonightKind()` ("counted" | "stolen" | "probe" | "long" | "muster" | undefined), `isSiegeNight()`, `hollowShareNow()`, `addReach(n, why)`,
  `rectify()` (the source is dealt with), `LONG` = 5, `AFTER` = 6. Events `reachStage { stage, before, name }`, `reachChanged`,
  `firstGlimpse { owners }` (now once per settlement, so it fires more than once per world; `owners` are the keeps having theirs tonight),
  `lordRaid { lord, name, plot, owners }` (after the story a Rival Lord's army has come). The Long Night starts when the Rift opens
  (script event `siege:undertow_rift_opened`), not when the Choir falls. Omens are acts in the world (`reach/omens.js`: `ACTS`, `SOUNDS` to swap sounds, `performOmen(id, player, keepCentre, side)`), one per hour line. Reach answers the `nextSiegeLine` filter with a hint at stage 3 and after the story.
  Filter `hollowSoldier` (type, { role, glimpse }) picks the soldier it adds. **Sieges are no longer simply every third night**: ask `isSiegeNight()`
  instead of doing `day % 3`. It also added hooks to `siege/siege.js` that anyone may use: filters `siegeDue`, `assaultCount`, `assaultDelay`,
  `assaultShare`, `dawnEndsSiege`, `nextSiegeDay`, and events `assaultIncoming` / `assaultSpawned` `{ assault, total }`.

- **guardposts** (`scripts/guardposts/index.js`): guards stationed at fixed posts on the wall and round buildings, picked from
  a sky view (camera straight down, red/green numbered rings drawn as per-player particles `siege:post_ring` / `siege:post_digit`).
  `sitesFor(owner)`, `openPosts(player, owner, guard?)`, `station(guard, owner, post)`, `unstation(guard, owner)`.
  **A building that should be guarded (a storeroom, the Ironworks...) adds its posts** with
  `addFilter("guardPostSites", (sites, { owner }) => [...sites, { id, name, box, front, floor }])` (or `posts: [{ key, label, x, z, from, out? }]`);
  town slot buildings, the hall, the Barracks/armoury and the wall already have them. Events `guardStationed { owner, guard, post }`,
  `guardOrders { player, guard }`; siege/ hooks it uses: filters `guardMenu` (plain click on a guard, the guard list) and
  `barracksButtons`, event `guardRemoved { id, owner }`, `setPost` with `{ x, y, z, stand: true }` posts (STATION_LEASH).
  Guard animations: `tools/build_guard_anims.py` (rewrites both guard client entities). Marker art: `tools/build_guardposts_art.py`.
  Walking (`guardposts/walk.js`): a walking guard chases a hidden `siege:post_marker` kept up to 14 blocks ahead, through one of
  24 walk groups (`tools/build_guard_walk.py` patches both guard BP entities; archers' shooting lives in group `siege:fight`).
  `walkTo(guard, owner, dest)`, `cancelWalk(id)`. While walking a guard has dynamic property `siege:walking` and siege/guards.js
  leaves it alone. Watch: `POSTS.watch` in posts.js ("dusk" | "always" | "shifts"). Wall steps: `stairColumns` in settle/walldata.js
  (roles stair/landing/ladder in `wallColumns`).

## The minimap and titles

`scripts/minimap/` draws a HUD minimap by sending each player hidden titles that start with `hcm:`
(`Siege_Nights_RP/ui/hud_screen.json` hides those from the normal title box). Keep using
`player.onScreenDisplay.setTitle` (or `title()` from api.js) as usual: the minimap notices real titles and waits
until they have faded before it sends again. Never start a real title with `hcm:`. Map pictures:
`python3 tools/minimap_tiles.py` after the world map changes; HUD layout: `python3 tools/minimap_ui.py`.

## Menu labels: `addMenuLabel`

Anything that opens a menu when clicked gets a floating label so players know it is clickable
(`core/labels.js`; the table of existing assets is `scripts/labels/index.js`). **When you add a block or NPC
that opens a menu, register it**, either with one line in that table or from your own folder:

```js
import { addMenuLabel } from "../siege/api.js";
addMenuLabel({ block: "hc:station_post", name: "Station Post", hint: "Click: trains" });   // gold name over a grey hint
addMenuLabel({ entity: "minecraft:npc", tag: "siege_mason", hint: "Click: buy blocks" });  // hint above the NPC's own name
addMenuLabel({ entity: "minecraft:npc", match: (e) => ..., hint: "Click to talk" });       // any test you like
```

Optional: `lift` (label height over the block's bottom or the entity's feet; defaults in `LABEL`), `where(block)` for a
block id that only sometimes opens a menu, `name` on an entity with no nameTag. Labels appear within 10 blocks of a
player and vanish a few seconds after everyone walks away; nothing is saved. Don't label things meant to be found
(Dusty Tomes, hidden doors). `/scriptevent siege:labels` lists what is labelled; `off` / `on` switch them all.

## Checking and building

- `node tools/check.mjs` (from `siege-nights/`): parses every pack JSON, checks item icons and texture files exist, checks imports, finds undefined names,
  loads everything with a fake Minecraft, runs every loop task and all self-tests. Files main.js doesn't load
  yet only produce notes, so you can run it while your feature is half done.
- `python3 tools/build.py`: runs the check, then builds `hollow-crown.mcaddon` (only scripts main.js loads are packed).
- In game: `/scriptevent siege:selftest`. It also runs at world load and tells players if something failed.
- `archive/main-before-split.js` is the original single file, for reference.
  Storyteller: reach reports the facts `bossesFallen`, `choirFallen`, `morvaneFallen` and owns the deck `siege_shapes` (seven night
  shapes, each with a kind; picked for subject `"world"`). It notes `quiet` for keep owners on the first night after a siege on which nothing came.
## The Almanac (explaining mechanics to players)

`scripts/guide/` is the in-game guide: the Settler's Almanac book (`/siege:guide` opens it too) and a one-line chat tip the first time a player meets each mechanic. **Every new player-facing mechanic adds an entry to `scripts/guide/data.js`**: a page, a tip, and `when` triggers such as `place:<block>`, `click:<block>`, `carry:<item>`, `talk:tag:<tag>`, `near:<entity>` or `event:<name>` (format notes at the top of the file). Use `hidden: true` for things a newcomer should not know about yet and `needs: "<id>"` while the feature's block or item is still on an unmerged branch. Never name the Hollow outside the `beyond` and `throne` chapters (the self-test fails). Things meant to be found get no entry. The audit of what is covered is `docs/GUIDE.md`.

## Role trials

`scripts/roletrials/` gives the four regional roles their mentors' trials (words in `lore/data/mentors.js`), sends each mentor's line on every rank-up, and runs the Knight's Stand the Wall and the Eleven. It hooks in through filters, so other features keep working without it:
`addFilter("roleOffer", (allowed, { player, role }) => ...)` (town hall asks before offering a role; false holds it),
`addFilter("dragonNestTake", (refusal, { player, block }) => ...)` (dragons: a returned string refuses the egg and is shown),
`addFilter("dragonCanFly", (reason, { player, rec, entity, flying }) => ...)` (dragons: a returned string grounds her, on take-off or once a second in the air, and is shown),
`addFilter("treeButtons", (list, { player }) => [...list, { label, icon, open(player, back) }])` (extra pages at the Tree of Oaths), and
`emit("loreSetFlag", { player, flag })` (lore: set a story flag from another feature).
