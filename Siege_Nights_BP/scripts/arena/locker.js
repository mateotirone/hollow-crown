// Keeping a fighter's own things safe.
//
// Taking the arena kit: everything the player carries and wears goes into a locker (an invisible, unbreakable
// siege:grave_keeper with 54 slots, the same chest-entity the gravestones use) under their room's floor, slot
// for slot, so it comes back exactly where it was: inventory 0-35, armour 36-39, off hand 40. Moving items
// between containers keeps everything about them (enchantments, names, wear, contents).
//
// Falling in a fight: what drops beside the body is swept up a tick later, before the gravestones look (they
// sweep at 2 and 20 ticks, we sweep at 1, 10 and 19), so no grave is dug in the arena. Arena kit pieces are
// thrown away; anything of the player's own goes into their locker.
//
// Giving it back: the kit is taken off them, then the locker empties into the same slots. A slot they've
// filled since (something picked up) gets the item in the first free slot instead, and if there is no room
// at all it is dropped at their feet. The locker is removed when empty.
// The record of who has a locker is saved (index.js), so a player who logs off or a world that restarts
// mid-fight still gets everything back the next time they're in.

import { ItemStack, EquipmentSlot } from "@minecraft/server";
import { KIT, KIT_LORE } from "./config.js";
import { LOCKER_SLOTS, armorLockerSlot } from "./rules.js";

export const LOCKER = "siege:grave_keeper";
export const LOCKER_TAG = "hc_arena_locker";
export const lockerTag = (playerId) => `hc_arena_locker_${playerId}`;

const ARMOR = LOCKER_SLOTS.armor.map((s) => EquipmentSlot[s]);

export const isKit = (stack) => {
  try { return !!stack && stack.getLore().includes(KIT_LORE); } catch { return false; }
};

// The locker for this player near `at` (their room), or undefined.
export function findLocker(dim, playerId, at) {
  try {
    return dim.getEntities({ type: LOCKER, tags: [lockerTag(playerId)], location: at, maxDistance: 6 })[0];
  } catch {
    return undefined;
  }
}

// Make (or find) the locker for this player, sunk two blocks under `at`.
export function lockerFor(dim, playerId, at) {
  const spot = { x: Math.floor(at.x) + 0.5, y: Math.floor(at.y) - 2, z: Math.floor(at.z) + 0.5 };
  const found = findLocker(dim, playerId, spot);
  if (found) return found;
  const e = dim.spawnEntity(LOCKER, spot);
  e.addTag(LOCKER_TAG);
  e.addTag(lockerTag(playerId));
  return e;
}

const bagOf = (e) => e?.getComponent("minecraft:inventory")?.container;

// Put everything the player has into their locker. Returns how many stacks were stored.
export function stash(player, dim, at) {
  const locker = lockerFor(dim, player.id, at);
  const bag = bagOf(locker);
  if (!bag) throw new Error("the locker has no room");
  const inv = player.getComponent("minecraft:inventory").container;
  const eq = player.getComponent("minecraft:equippable");
  let n = 0;
  for (let i = 0; i < Math.min(inv.size, LOCKER_SLOTS.inventory); i++) {
    if (!inv.getItem(i)) continue;
    if (bag.getItem(i)) { // already holds something from a fall earlier: keep both
      const left = bag.addItem(inv.getItem(i));
      inv.setItem(i, left);
    } else inv.moveItem(i, i, bag);
    n++;
  }
  ARMOR.forEach((slot, k) => {
    const item = eq?.getEquipment(slot);
    if (!item) return;
    const to = armorLockerSlot(LOCKER_SLOTS.armor[k]);
    if (bag.getItem(to)) bag.addItem(item); else bag.setItem(to, item);
    eq.setEquipment(slot, undefined);
    n++;
  });
  const off = eq?.getEquipment(EquipmentSlot.Offhand);
  if (off) {
    if (bag.getItem(LOCKER_SLOTS.offhand)) bag.addItem(off); else bag.setItem(LOCKER_SLOTS.offhand, off);
    eq.setEquipment(EquipmentSlot.Offhand, undefined);
    n++;
  }
  return n;
}

const kitStack = (id, count = 1) => {
  const s = new ItemStack(id, count);
  s.setLore([KIT_LORE]);
  return s;
};

// Dress the player in the arena kit (their own things must be in the locker first).
export function giveKit(player) {
  const inv = player.getComponent("minecraft:inventory").container;
  const eq = player.getComponent("minecraft:equippable");
  for (const [slot, id] of Object.entries(KIT.armor)) eq?.setEquipment(EquipmentSlot[slot], kitStack(id));
  if (KIT.offhand) eq?.setEquipment(EquipmentSlot.Offhand, kitStack(KIT.offhand));
  for (const [id, count] of KIT.items) inv.addItem(kitStack(id, count));
}

// Take every arena kit piece off the player (inventory, armour, off hand). Returns how many.
export function stripKit(player) {
  let n = 0;
  const inv = player.getComponent("minecraft:inventory")?.container;
  const eq = player.getComponent("minecraft:equippable");
  if (inv) for (let i = 0; i < inv.size; i++) if (isKit(inv.getItem(i))) { inv.setItem(i, undefined); n++; }
  for (const slot of [...ARMOR, EquipmentSlot.Offhand]) {
    if (isKit(eq?.getEquipment(slot))) { eq.setEquipment(slot, undefined); n++; }
  }
  return n;
}

// Empty the locker back onto the player. Returns true if a locker was found (and is now gone).
export function restore(player, dim, at) {
  const locker = findLocker(dim, player.id, { x: Math.floor(at.x) + 0.5, y: Math.floor(at.y) - 2, z: Math.floor(at.z) + 0.5 });
  const bag = bagOf(locker);
  if (!bag) return false;
  const inv = player.getComponent("minecraft:inventory").container;
  const eq = player.getComponent("minecraft:equippable");
  const spill = [];
  const put = (stack) => { const left = inv.addItem(stack); if (left) spill.push(left); };
  for (let i = 0; i < bag.size; i++) {
    const item = bag.getItem(i);
    if (!item) continue;
    if (i < LOCKER_SLOTS.inventory && i < inv.size && !inv.getItem(i)) {
      bag.moveItem(i, i, inv);
      continue;
    }
    const k = i - 36;
    if (k >= 0 && k < ARMOR.length && eq && !eq.getEquipment(ARMOR[k])) eq.setEquipment(ARMOR[k], item);
    else if (i === LOCKER_SLOTS.offhand && eq && !eq.getEquipment(EquipmentSlot.Offhand)) eq.setEquipment(EquipmentSlot.Offhand, item);
    else put(item);
    bag.setItem(i, undefined);
  }
  for (const s of spill) {
    try { player.dimension.spawnItem(s, player.location); } catch { /* nowhere to drop it */ }
  }
  try { locker.remove(); } catch { /* gone */ }
  return true;
}

// Sweep what a fallen fighter dropped: kit pieces vanish, their own things go into their locker. Returns counts.
// `since` = the tick they fell; only items that appeared after it are touched (fresh: id -> first tick seen).
export function sweepDrops(dim, at, playerId, lockerAt, fresh, since) {
  let items;
  try {
    items = dim.getEntities({ type: "minecraft:item", location: at, maxDistance: 4 });
  } catch {
    return { kept: 0, removed: 0 };
  }
  let bag, kept = 0, removed = 0;
  for (const e of items) {
    if ((fresh.get(e.id) ?? -1) < since) continue;
    try {
      const stack = e.getComponent("minecraft:item")?.itemStack;
      if (!stack) continue;
      if (!isKit(stack)) {
        bag ??= bagOf(lockerFor(dim, playerId, lockerAt));
        if (!bag || bag.addItem(stack)) continue; // full: leave it on the floor
        kept++;
      } else removed++;
      e.remove();
    } catch { /* picked up or gone */ }
  }
  return { kept, removed };
}

// Throw away kit pieces lying anywhere on the floor (dropped on purpose during the fight).
export function clearLooseKit(dim, center, radius) {
  let items;
  try {
    items = dim.getEntities({ type: "minecraft:item", location: center, maxDistance: radius });
  } catch {
    return;
  }
  for (const e of items) {
    try { if (isKit(e.getComponent("minecraft:item")?.itemStack)) e.remove(); } catch { /* gone */ }
  }
}
