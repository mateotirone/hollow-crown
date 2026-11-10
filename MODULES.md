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
| `siegeReward` | `{ player, emeralds, threat }` | a defender was just paid for holding their keep (after `addRewardHook`) |
| `keepFounded` | `{ player, keep, moved }` | a Keep Banner founded (or moved) a settlement |
| `keepFallen` | `{ owner, keep }` | a keep fell during a siege |
| `tierUp` | `{ owner, before, after }` | Hamlet → Town → City → Castle |
| `warlordSlain` | `{ owner, name, king }` | a warlord (or the Warlord King) died |
| `raiderKilled` | `{ entity, killer, owner }` | any siege raider died during a siege |
| `sovereignCrowned` | `{ owner }` | a Castle beat the Grand Siege |

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

Anything else: `addFilter(name, (value, context) => newValue)` is the general form these are built on.

Not possible: Quartermaster prices. They are a fixed trade table (`trading/quartermaster_trades.json`), and scripts cannot change or observe villager trades.

Need another hook? Ask the "Prepare Siege Nights code for parallel work" thread rather than editing `siege/` files yourself.

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
  `fromEmeralds(e)` (x8), `WALLET` for the Mason's `setWallet`, `spawnJobNpc(dim, loc, jobId, region?)`, `regionAt(loc)`.
  Events `coinsPaid`, `coinsSpent`, `goodsSold`. **Pricing something? Charge with `charge()`, not emeralds**; an old emerald price is 8 coins.

- **reach** (`scripts/reach/api.js`): how sieges escalate. One world number, the Reach (0-100), picks a stage 1-6 (`reach/rules.js` STAGES:
  Counted Nights, Leaning, Miscount, Uncounted Nights, Long Night, Quiet After). `reachStage()`, `reachValue()`, `stageInfo()`,
  `tonightKind()` ("counted" | "stolen" | "probe" | "long" | "muster" | undefined), `isSiegeNight()`, `hollowShareNow()`, `addReach(n, why)`,
  `rectify()` (the source is dealt with), `LONG` = 5, `AFTER` = 6. Events `reachStage { stage, before, name }`, `reachChanged`, `firstGlimpse { owners }`.
  Filter `hollowSoldier` (type, { role, glimpse }) picks the soldier it adds. **Sieges are no longer simply every third night**: ask `isSiegeNight()`
  instead of doing `day % 3`. It also added hooks to `siege/siege.js` that anyone may use: filters `siegeDue`, `assaultCount`, `assaultDelay`,
  `assaultShare`, `dawnEndsSiege`, `nextSiegeDay`, and events `assaultIncoming` / `assaultSpawned` `{ assault, total }`.

## Checking and building

- `node tools/check.mjs` (from `siege-nights/`): parses every pack JSON, checks imports, finds undefined names,
  loads everything with a fake Minecraft, runs every loop task and all self-tests. Files main.js doesn't load
  yet only produce notes, so you can run it while your feature is half done.
- `python3 tools/build.py`: runs the check, then builds `hollow-crown.mcaddon` (only scripts main.js loads are packed).
- In game: `/scriptevent siege:selftest`. It also runs at world load and tells players if something failed.
- `archive/main-before-split.js` is the original single file, for reference.
