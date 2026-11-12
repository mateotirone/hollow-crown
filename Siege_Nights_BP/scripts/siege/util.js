// Small helpers used everywhere.
// Split from the original main.js; the code is unchanged apart from the event/hook calls.

import { world, GameMode } from "@minecraft/server";
import { applyFilter } from "../core/events.js";

export const title = (player, text, subtitle) =>
  player.onScreenDisplay.setTitle(text, { subtitle, fadeInDuration: 10, stayDuration: 60, fadeOutDuration: 20 });

export const ownerTag = (owner) => `siege_for_${owner}`;
export const overworld = () => world.getDimension("overworld");

export function ownerOf(entity) {
  const tag = entity.getTags().find((t) => t.startsWith("siege_for_"));
  return tag?.slice("siege_for_".length);
}

export const pick = (list) => list[Math.floor(Math.random() * list.length)];

export const isOnline = (owner) => world.getPlayers().some((p) => p.id === owner);
// Can this settlement be attacked right now? While its owner is online, or while a feature opens it to attack
// with addFilter("openToAttack", (open, { owner }) => ...) (an away keeper's vault window, vault/index.js).
// Its walls, gates, guards and engines follow this; carrying off the Keep Banner still needs the owner online.
export const attackable = (owner) => isOnline(owner) || !!applyFilter("openToAttack", false, { owner });

export function consumeHeld(player) {
  if (player.getGameMode() === GameMode.Creative) return;
  const inv = player.getComponent("minecraft:inventory").container;
  const held = inv.getItem(player.selectedSlotIndex);
  if (held && held.amount > 1) {
    held.amount -= 1;
    inv.setItem(player.selectedSlotIndex, held);
  } else {
    inv.setItem(player.selectedSlotIndex, undefined);
  }
}

export function countItem(player, typeId) {
  const inv = player.getComponent("minecraft:inventory").container;
  let have = 0;
  for (let i = 0; i < inv.size; i++) if (inv.getItem(i)?.typeId === typeId) have += inv.getItem(i).amount;
  return have;
}

// Takes `amount` of an item from anywhere in the inventory; false (and takes nothing) if there isn't enough
export function takeItems(player, typeId, amount) {
  if (player.getGameMode() === GameMode.Creative) return true;
  if (countItem(player, typeId) < amount) return false;
  const inv = player.getComponent("minecraft:inventory").container;
  let owed = amount;
  for (let i = 0; i < inv.size && owed > 0; i++) {
    const stack = inv.getItem(i);
    if (stack?.typeId !== typeId) continue;
    const take = Math.min(owed, stack.amount);
    owed -= take;
    if (take === stack.amount) inv.setItem(i, undefined);
    else {
      stack.amount -= take;
      inv.setItem(i, stack);
    }
  }
  return true;
}
