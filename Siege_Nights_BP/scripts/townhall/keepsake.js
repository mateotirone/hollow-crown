// The sworn item: the Ember (or the Knight's Oath Banner) lives in the last hotbar slot for good.
//
// Mateo 2026-11-14: "the ember should be stuck in a specific item slot at all times, never lost on death", and
// the Oath Banner the same. Which item it is:
//   Marked            -> the Bound Ember
//   Knight            -> the Oath Banner
//   no path yet       -> the Hollow Ember, once picked up in Act 1 (so it can't be lost on the "Not yet" road)
// It sits in slot 9 (index 8), locked to that slot (can't be dropped, moved, or put in a chest) and kept on
// death. Once a second, and on every spawn, any loose copy is folded back into that slot, a missing one is
// given back, and whatever else was in slot 9 is moved into the pack (or set at your feet if the pack is full).
// When the Tree choice takes the Hollow Ember, it is cleared, and the new path's item takes the slot.
//
// Also here: double-tap sneak opens and closes the spell bar from anywhere (Bedrock has no custom keys).

import { world, system, ItemStack, ItemLockMode, InputButton, ButtonState } from "@minecraft/server";
import * as api from "../siege/api.js";
import { addTests, assertEqual } from "../core/tests.js";
import { heroOf } from "./hero.js";
import { EMBER, BOUND_EMBER, OATH_BANNER } from "./tree.js";

export const KEEP_SLOT = 8;
const HELD_EMBER = "hc:keepsake_ember"; // on the player: "1" once they have picked up the Hollow Ember

/** Which item belongs in slot 9, for a path and whether they have found the Hollow Ember. Pure, for the self-tests. */
export function keepsakeFor(path, foundEmber) {
  if (path === "marked") return BOUND_EMBER;
  if (path === "knight") return OATH_BANNER;
  if (path === "none" && foundEmber) return EMBER;
  return undefined;
}

const isSworn = (item) => item && item.lockMode === ItemLockMode.slot && item.keepOnDeath;

function sworn(typeId) {
  const item = new ItemStack(typeId, 1);
  try {
    item.lockMode = ItemLockMode.slot;
    item.keepOnDeath = true;
  } catch {
    // older engine: a plain item, still put back every second
  }
  return item;
}

/** Fold the player's sworn item into slot 9 and clear stray copies. Safe to call any time. */
export function settleKeepsake(player) {
  const c = player.getComponent("minecraft:inventory")?.container;
  if (!c) return;
  const hero = heroOf(player);
  let found = player.getDynamicProperty(HELD_EMBER) === "1";
  if (hero.path === "none" && !found && api.countItem(player, EMBER) > 0) {
    player.setDynamicProperty(HELD_EMBER, "1");
    found = true;
  }
  if (hero.path !== "none" && found) player.setDynamicProperty(HELD_EMBER, undefined);
  const want = keepsakeFor(hero.path, found);

  // a second copy of your sworn item is a stray; the Hollow Ember is gone once the Tree choice is made.
  // Another path's item (a creative tester's, say) is left alone: it only hums "not for you".
  for (let i = 0; i < c.size; i++) {
    const item = c.getItem(i);
    if (!item) continue;
    const stray = (item.typeId === want && !(i === KEEP_SLOT && isSworn(item))) || (item.typeId === EMBER && hero.path !== "none");
    if (stray) c.setItem(i, undefined);
  }
  if (!want) return;
  const there = c.getItem(KEEP_SLOT);
  if (there?.typeId === want && isSworn(there)) return;
  c.setItem(KEEP_SLOT, sworn(want));
  if (there && there.typeId !== want) {
    const left = c.addItem(there);
    if (left) player.dimension.spawnItem(left, player.location);
  }
}

api.onTick("townhall_keepsake", 20, () => {
  for (const player of world.getPlayers()) {
    try {
      settleKeepsake(player);
    } catch {
      // try again next second
    }
  }
});

world.afterEvents.playerSpawn.subscribe(({ player }) => {
  system.runTimeout(() => {
    if (player.isValid) settleKeepsake(player);
  }, 2);
});

// ---------- double-tap sneak: the spell bar from anywhere ----------

const DOUBLE_TAP = 8; // ticks between the two presses
const lastSneak = new Map(); // player id -> tick of the last sneak press
let toggleBar = () => {}; // set by spellbar.js (it imports this file, so no import loop)
export const onDoubleSneak = (fn) => (toggleBar = fn);

try {
  world.afterEvents.playerButtonInput.subscribe(({ player, button, newButtonState }) => {
    if (button !== InputButton.Sneak || newButtonState !== ButtonState.Pressed) return;
    const now = system.currentTick;
    const before = lastSneak.get(player.id) ?? -999;
    lastSneak.set(player.id, now);
    if (now - before > DOUBLE_TAP) return;
    lastSneak.delete(player.id);
    if (player.getComponent("minecraft:riding")) return; // sneak is "get off" on a horse or a dragon
    toggleBar(player);
  });
} catch {
  // an engine without button input: the Ember still opens the bar
}

addTests("townhall", {
  "the sworn item follows the path": () => {
    assertEqual(keepsakeFor("marked", false), BOUND_EMBER);
    assertEqual(keepsakeFor("knight", true), OATH_BANNER);
    assertEqual(keepsakeFor("none", true), EMBER);
    assertEqual(keepsakeFor("none", false), undefined);
    assertEqual(keepsakeFor("rider", true), undefined);
  },
});
