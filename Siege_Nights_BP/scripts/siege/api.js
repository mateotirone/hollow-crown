// THE PUBLIC API of Siege Nights. New features import from here, never from the other siege/ files,
// so those can be reorganised without breaking anyone. See MODULES.md for how to use each piece.

import { addFilter } from "../core/events.js";

// ----- state -----
export { isReady, getState, saveState, saveTracked } from "./state.js";

// ----- settlements -----
export { settlementAt, tierOf, TIERS, MAX_RADIUS, isAlly, foreignSettlement, colorTaken, freeColor, recordWin } from "./territory.js";
export { keepCenter, keepBlock, keepHealth, heartsOf, raiseKeepHeart, keepFallen } from "./keep.js";
import { getState } from "./state.js";
export const keepOf = (owner) => getState().keeps[owner];

// ----- sieges -----
export { isNight, startSiege, endSiege, spawnRaider, raidersLeft, nextSiegeDay } from "./siege.js";
export { FACTIONS, MODIFIERS, planSiege } from "./warplan.js";

// ----- walls -----
export { hitWall, blastDamage, wallHp, armorOf, lightCharge, offlineSafe, damageMap, saveDamage, blockKey, WALL_HP } from "./walls.js";

// ----- guards -----
export { guardTag, guardOwner, guardCount, guardLimit, isGuard, markWanted, GUARD_ARMOR, armorTier, equipGuard } from "./guards.js";

// ----- shared helpers and ids -----
export { title, overworld, ownerTag, ownerOf, isOnline, pick, countItem, takeItems, consumeHeld } from "./util.js";
export * from "./constants.js";
export { SETTINGS } from "./settings.js";

// ----- events -----
export { on, emit } from "../core/events.js";

// ----- hooks (with none registered, Siege Nights behaves exactly as before) -----
export { addFilter };

// (location) => ownerId | undefined. Extra land; the id must own a keep.
export const addLandClaim = (fn) => addFilter("landOwner", (owner, { location }) => owner ?? fn(location));

// (player, block, oldKeep) => refusal message | undefined. Checked first when a Keep Banner is placed.
export const addFoundingCheck = (fn) => addFilter("foundCheck", (msg, { player, block, old }) => msg ?? fn(player, block, old));

// (owner, keep) => true to leave this settlement out of tonight's siege (no keep heart, no plan, no raiders)
export const addSiegeSkipHook = (fn) => addFilter("skipSiege", (skip, { owner, keep }) => skip || !!fn(owner, keep));

// (plan, owner, keep) => void. Edit the war plan right after it is made.
export const addPlanHook = (fn) => addFilter("plan", (plan, { owner, keep }) => { fn(plan, owner, keep); return plan; });

// (type, { tags, name }) => newType | undefined. Swap a raider's entity type as it spawns.
export const addRaiderTypeHook = (fn) => addFilter("raiderType", (type, context) => fn(type, context));

// ({ player, emeralds, threat }) => newEmeralds. Change a defender's siege pay before it is handed out.
// The number is in the old unit: it is paid out in coins at 8 to one (economy/config.js perEmerald).
export const addRewardHook = (fn) => addFilter("siegeReward", (emeralds, { player, threat }) => fn({ player, emeralds, threat }));

// (owner, base) => number. Change how many guards a settlement can keep.
export const addGuardLimitHook = (fn) => addFilter("guardLimit", (limit, { owner }) => fn(owner, limit));

// (owner, base) => number. Change the keep heart's health (the keep_heart entity's max health still caps it).
export const addKeepHealthHook = (fn) => addFilter("keepHealth", (hp, { owner }) => fn(owner, hp));

// ({ player, keep, owner, mine }) => [{ label, icon?, action }]. Extra Keep Banner menu buttons, above Close.
export const addKeepMenuButtons = (fn) => addFilter("keepMenuButtons", (buttons, context) => [...buttons, ...(fn(context) ?? [])]);

// ----- core tools, re-exported for convenience -----
export { onTick } from "../core/loop.js";
export { moduleStore } from "../core/store.js";
export { addTests, assert, assertEqual } from "../core/tests.js";
export { addJoinStep, wait } from "../core/firstjoin.js";
