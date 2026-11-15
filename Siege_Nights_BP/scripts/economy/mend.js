// Worn gear (Mateo 2026-11-15: "there isn't really a way to repair things").
//
//   - Any town's Smith mends anything that wears, worn or carried, for Regals: the price follows the wear and the
//     metal (mendPrice). It works on every item with durability, including the ones no anvil can mend (boss drops,
//     the Oathsworn Harness, the mythical weapons). The menu is in shops.js (mendMenu).
//   - The twelve mythical weapons and tools never break: once only DULL_LEFT durability is left they stop there
//     and go dull, and their powers rest until a Smith mends them (codex/rules.js MYTHIC, isDull; codex/state.js
//     gearOf hides a dull one from the powers).
//   - The first time a held item runs low, the Almanac's "Worn gear" tip points the player to the Smith (event gearWorn).
//
// Test: damage a tool, then click any Smith and pick "Mend gear".

import { world, EquipmentSlot } from "@minecraft/server";
import { onTick } from "../core/loop.js";
import { emit } from "../core/events.js";
import { sfx } from "../core/sfx.js";
import { addTests, assert, assertEqual } from "../core/tests.js";
import { ITEM, MYTHIC, DULL_LEFT, isDull, dullDamage } from "../codex/rules.js";

// Regals for mending a piece from broken to new; the price is this times how worn it is (at least 1 Regal)
export const MEND_BASE = [
  [(id) => MYTHIC.has(id), 40],
  [(id) => /choirsteel/.test(id), 32],
  [(id) => /netherite/.test(id), 24],
  [(id) => /diamond/.test(id), 12],
  [(id) => /^(minecraft|siege):(iron|chainmail|golden|stone|wooden|leather)_/.test(id), 4],
  [(id) => id.startsWith("siege:"), 16], // the rest of our own gear: Codex sets, guard armour, siege weapons, boss drops
  [() => true, 4],
];
export const mendBase = (id) => MEND_BASE.find(([is]) => is(String(id)))[1];
export function mendPrice(id, damage, max) {
  if (!(damage > 0) || !(max > 0)) return 0;
  return Math.max(1, Math.ceil(mendBase(id) * Math.min(1, damage / max)));
}
export const LOW_WEAR = 0.15; // a held item with less than this share left counts as "running low" for the tip

const wearOf = (stack) => {
  try { return stack?.getComponent("minecraft:durability"); } catch { return undefined; }
};

// Every piece a player wears or carries that a Smith could mend: { stack, worn, price, put(stack) }
const WORN = [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet, EquipmentSlot.Offhand];
export function mendable(player) {
  const found = [];
  const add = (stack, worn, put) => {
    const w = wearOf(stack);
    if (!w || w.damage <= 0) return;
    found.push({ stack, worn, price: mendPrice(stack.typeId, w.damage, w.maxDurability), share: w.damage / w.maxDurability, put });
  };
  const eq = player.getComponent("minecraft:equippable");
  for (const slot of WORN) {
    const stack = eq?.getEquipment(slot);
    if (stack) add(stack, true, (s) => eq.setEquipment(slot, s));
  }
  const inv = player.getComponent("minecraft:inventory")?.container;
  for (let i = 0; inv && i < inv.size; i++) {
    const stack = inv.getItem(i);
    if (stack) add(stack, false, (s) => inv.setItem(i, s));
  }
  return found;
}
// The same stack, good as new (a dull mythical wakes up again)
export function mended(stack) {
  const w = wearOf(stack);
  if (w) w.damage = 0;
  return stack;
}
export const gearName = (stack) => stack.nameTag || ITEM[stack.typeId]?.name || stack.typeId.replace(/^[a-z]+:/, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// ---------- the held item: mythicals stop at dull, and the first low item brings up the tip ----------
const toldDull = new Set(); // player ids told their mythical went dull (until they hold a sharp one again)
const toldLow = new Set(); // player ids that have had the gearWorn tip this session
function wearTick() {
  for (const p of world.getAllPlayers()) {
    try {
      const eq = p.getComponent("minecraft:equippable");
      const stack = eq?.getEquipment(EquipmentSlot.Mainhand);
      const w = wearOf(stack);
      if (!w || !w.maxDurability) continue;
      if (MYTHIC.has(stack.typeId)) {
        if (w.damage > w.maxDurability - DULL_LEFT) {
          w.damage = dullDamage(w.damage, w.maxDurability);
          eq.setEquipment(EquipmentSlot.Mainhand, stack);
        }
        if (isDull(w.damage, w.maxDurability)) {
          if (!toldDull.has(p.id)) {
            toldDull.add(p.id);
            sfx(p, "random.anvil_land", { volume: 0.4, pitch: 0.6 });
            p.sendMessage(`§6${gearName(stack)} has gone dull.§7 It will not break, but its power rests until a Smith in any town mends it.`);
          }
          continue;
        }
        toldDull.delete(p.id);
      }
      if (!toldLow.has(p.id) && (w.maxDurability - w.damage) / w.maxDurability < LOW_WEAR) {
        toldLow.add(p.id);
        emit("gearWorn", { player: p, item: stack.typeId });
      }
    } catch {
      // player gone
    }
  }
}
// every 5 ticks: a mythical loses at most a few points between looks, far less than DULL_LEFT, so it never breaks
onTick("economy_wear", 5, wearTick);

addTests("economy mending", {
  "mending: the price follows the wear and the metal, and a new piece costs nothing": () => {
    assertEqual(mendPrice("minecraft:iron_pickaxe", 0, 250), 0);
    assertEqual(mendPrice("minecraft:iron_pickaxe", 250, 250), 4);
    assertEqual(mendPrice("minecraft:iron_pickaxe", 1, 250), 1, "at least 1 Regal");
    assertEqual(mendPrice("minecraft:diamond_sword", 1561, 1561), 12);
    assertEqual(mendPrice("siege:diamond_vale_helmet", 363, 363), 12, "regional armour costs what the plain piece does");
    assertEqual(mendPrice("siege:iron_frostmarch_boots", 195, 195), 4);
    assertEqual(mendPrice("minecraft:netherite_axe", 1015, 2031), 12);
    assertEqual(mendPrice("siege:choirsteel_sword", 2000, 2000), 32);
    assertEqual(mendPrice("siege:minute_hand", 700, 1400), 8, "boss drops can be mended here");
    assertEqual(mendPrice("siege:hrodas_pick", 2300, 2400), 39);
    assert(mendPrice("siege:hrodas_pick", 9, 10) > mendPrice("siege:rime_axe", 9, 10), "a mythical costs most");
  },
  "mythicals: twelve of them, and they stop dull before they break": () => {
    assertEqual(MYTHIC.size, 12);
    for (const id of MYTHIC) assert(id.startsWith("siege:"), id);
    assert(!isDull(0, 2400) && !isDull(2299, 2400) && isDull(2300, 2400) && isDull(2399, 2400));
    assertEqual(dullDamage(2399, 2400), 2400 - DULL_LEFT);
    assertEqual(dullDamage(10, 2400), 10);
    assert(DULL_LEFT >= 50, "far more than a pick can lose in 5 ticks");
  },
});
