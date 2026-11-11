// Clicking blocks: walls, gates, Keep Banner (dye or menu) and Barracks.
// Split from the original main.js; the code is unchanged apart from the event/hook calls.

import { world, system, GameMode } from "@minecraft/server";
import { BARRACKS, CASTLE_GATES, COLORS, KEEP_BANNER, PORTCULLISES } from "./constants.js";
import { recruitGuard } from "./guards.js";
import { barracksMenu, keepMenu } from "./menus.js";
import { SETTINGS } from "./settings.js";
import { saveState, state } from "./state.js";
import { colorTaken, foreignSettlement } from "./territory.js";
import { workOnWall } from "./walls.js";
import { sfx } from "../core/sfx.js";

// ---------- Clicking blocks: gates and banner dyeing ----------

export const GATE_SOUNDS = Object.fromEntries([
  ...PORTCULLISES.map((id) => [id, { open: "random.door_open", close: "random.anvil_land" }]),
  ...CASTLE_GATES.map((id) => [id, { open: "random.door_open", close: "random.door_close" }]),
]);


export const DYES = Object.fromEntries(COLORS.map((c, i) => [`minecraft:${c}_dye`, i]));
Object.assign(DYES, { "minecraft:ink_sac": 15, "minecraft:bone_meal": 0, "minecraft:lapis_lazuli": 11, "minecraft:cocoa_beans": 12 });

export const lastClick = new Map(); // stops one click from counting twice

world.afterEvents.playerInteractWithBlock.subscribe((event) => {
  const { block, player } = event;
  if (event.isFirstEvent === false) return;
  const now = system.currentTick;
  if (now - (lastClick.get(player.id) ?? -100) < 6) return;
  lastClick.set(player.id, now);

  if (workOnWall(block, player, event.itemStack)) return;
  if (GATE_SOUNDS[block.typeId]) {
    if (mayWorkGate(player, block)) toggleGate(block);
    else player.onScreenDisplay.setActionBar(`§cThe gate is barred. Only ${state.keeps[foreignSettlement(player, block.location, block.dimension.id)]?.name ?? "the owner"}'s people can open it.`);
  }
  else if (block.typeId === KEEP_BANNER) {
    if (DYES[event.itemStack?.typeId] !== undefined) dyeBanner(block, player, event.itemStack);
    else keepMenu(block, player);
  } else if (block.typeId === BARRACKS) {
    if (event.itemStack?.typeId === "siege:coin" || event.itemStack?.typeId === "siege:gold_coin") recruitGuard(block, player, event.itemStack);
    else barracksMenu(block, player);
  }
});

// A settlement's gates and portcullises answer only to its owner and their allies (Mateo, 2026-11-11);
// the owner's guards open them for friends (settle/walls.js). Anyone may work a gate out in the wild.
export function mayWorkGate(player, block) {
  if (player.getGameMode() === GameMode.Creative) return true;
  return !foreignSettlement(player, block.location, block.dimension.id);
}

export function toggleGate(block) {
  return setGate(block, !block.permutation.getState("siege:open"));
}

// Opens or shuts a whole gate (every touching block of the same kind). Returns false if it was already that way.
export function setGate(block, open) {
  const gateType = block.typeId;
  if (!GATE_SOUNDS[gateType] || block.permutation.getState("siege:open") === open) return false;
  // Find every gate block of the same kind touching this one, so a big gate moves as one piece
  const dim = block.dimension;
  const seen = new Set();
  const queue = [block.location];
  const gate = [];
  while (queue.length > 0 && gate.length < SETTINGS.gateMaxSize) {
    const loc = queue.shift();
    const key = `${loc.x},${loc.y},${loc.z}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const b = dim.getBlock(loc);
    if (!b || b.typeId !== gateType) continue;
    gate.push(b);
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      queue.push({ x: loc.x + dx, y: loc.y + dy, z: loc.z + dz });
    }
  }
  for (const b of gate) b.setPermutation(b.permutation.withState("siege:open", open));
  const sounds = GATE_SOUNDS[gateType];
  sfx(dim, open ? sounds.open : sounds.close, block.location, { volume: 0.6 });
  return true;
}

export function dyeBanner(block, player, item) {
  const color = item ? DYES[item.typeId] : undefined;
  if (color === undefined || block.permutation.getState("siege:color") === color) return;
  const keep = state.keeps[player.id];
  if (!keep || keep.x !== block.location.x || keep.y !== block.location.y || keep.z !== block.location.z) {
    return player.onScreenDisplay.setActionBar("§cOnly the owner can recolor a Keep Banner.");
  }
  if (colorTaken(color, player.id)) {
    return player.onScreenDisplay.setActionBar("§cAnother settlement already flies that color.");
  }
  keep.color = color;
  saveState();
  block.setPermutation(block.permutation.withState("siege:color", color));
  sfx(block.dimension, "dye.use", block.location);
  if (player.getGameMode() !== GameMode.Creative) {
    const inv = player.getComponent("minecraft:inventory").container;
    const held = inv.getItem(player.selectedSlotIndex);
    if (held && held.amount > 1) {
      held.amount -= 1;
      inv.setItem(player.selectedSlotIndex, held);
    } else {
      inv.setItem(player.selectedSlotIndex, undefined);
    }
  }
}
