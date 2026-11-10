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
  (script event `siege:undertow_rift_opened`), not when the Choir falls. Reach answers the `nextSiegeLine` filter with a hint at stage 3 and after the story.
  Filter `hollowSoldier` (type, { role, glimpse }) picks the soldier it adds. **Sieges are no longer simply every third night**: ask `isSiegeNight()`
  instead of doing `day % 3`. It also added hooks to `siege/siege.js` that anyone may use: filters `siegeDue`, `assaultCount`, `assaultDelay`,
  `assaultShare`, `dawnEndsSiege`, `nextSiegeDay`, and events `assaultIncoming` / `assaultSpawned` `{ assault, total }`.

## Checking and building

- `node tools/check.mjs` (from `siege-nights/`): parses every pack JSON, checks item icons and texture files exist, checks imports, finds undefined names,
  loads everything with a fake Minecraft, runs every loop task and all self-tests. Files main.js doesn't load
  yet only produce notes, so you can run it while your feature is half done.
- `python3 tools/build.py`: runs the check, then builds `hollow-crown.mcaddon` (only scripts main.js loads are packed).
- In game: `/scriptevent siege:selftest`. It also runs at world load and tells players if something failed.
- `archive/main-before-split.js` is the original single file, for reference.
  Storyteller: reach reports the facts `bossesFallen`, `choirFallen`, `morvaneFallen` and owns the deck `siege_shapes` (seven night
  shapes, each with a kind; picked for subject `"world"`). It notes `quiet` for keep owners on the first night after a siege on which nothing came.