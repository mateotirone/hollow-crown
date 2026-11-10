// Placing blocks: founding settlements, building rights, and machine blocks.
// Split from the original main.js; the code is unchanged apart from the event/hook calls.

import { world, ItemStack, GameMode } from "@minecraft/server";
import { emit, applyFilter } from "../core/events.js";
import { CHARGE, DESK, KEEP_BANNER, REINFORCEABLE } from "./constants.js";
import { markWanted } from "./guards.js";
import { keepBlock } from "./keep.js";
import { placeBefore, placementAllowed } from "./protection.js";
import { saveState, saveTracked, state, tracked } from "./state.js";
import { MAX_RADIUS, freeColor, isAlly, settlementAt, tierOf } from "./territory.js";
import { overworld, title } from "./util.js";
import { blockKey, damageMap, lightCharge, saveDamage } from "./walls.js";

// ---------- Placing blocks: settlements and building rights ----------

export const PLACE_MESSAGES = {
  [DESK]: "§7Quartermaster's desk set up. Bring an unemployed villager to it and they'll take the job.",
  "siege:barracks": "§7Barracks built. Bring an unemployed villager here and click it with coins in hand (40 Regals) to recruit a Man-at-Arms (sneak + click for an Archer).",
};

// Undo a placement and hand the block back
export function refuse(player, block, message) {
  const typeId = block.typeId;
  block.setType("minecraft:air");
  if (player.getGameMode() !== GameMode.Creative) {
    const leftover = player.getComponent("minecraft:inventory").container.addItem(new ItemStack(typeId, 1));
    if (leftover) player.dimension.spawnItem(leftover, player.location);
  }
  player.onScreenDisplay.setActionBar(message);
}

export function foundSettlement(player, block) {
  const problem = applyFilter("foundCheck", undefined, { player, block, old: state.keeps[player.id] }); // addFoundingCheck
  if (problem) return refuse(player, block, problem);
  if (block.dimension.id !== "minecraft:overworld") {
    return refuse(player, block, "§cA Keep Banner can only be raised in the Overworld.");
  }
  if (state.active && state.keeps[player.id]) {
    return refuse(player, block, "§cYou can't move your keep during a siege!");
  }
  const loc = block.location;
  for (const [owner, keep] of Object.entries(state.keeps)) {
    if (owner === player.id) continue;
    if (Math.hypot(loc.x - keep.x, loc.z - keep.z) < MAX_RADIUS * 2) {
      return refuse(player, block, `§cToo close to ${keep.name}'s settlement.`);
    }
  }

  const old = state.keeps[player.id];
  if (old && keepBlock(old)) overworld().runCommand(`setblock ${old.x} ${old.y} ${old.z} air destroy`);
  const color = old?.color ?? freeColor(block.permutation.getState("siege:color"));
  block.setPermutation(block.permutation.withState("siege:color", color));
  state.keeps[player.id] = { x: loc.x, y: loc.y, z: loc.z, name: player.name, color, wins: old?.wins ?? 0, allies: old?.allies ?? [] };
  saveState();
  title(player, old ? "§6Settlement moved" : "§6Settlement founded",
    `§7Your ${tierOf(state.keeps[player.id]).name} reaches ${tierOf(state.keeps[player.id]).radius} blocks from your banner`);
  player.playSound("random.levelup");
  if (!old) player.sendMessage("§6Your Keep is raised! Craft a Siege Workshop to make castle blocks. Raiders will march on this banner on siege nights. Use dye on it to change its color.");
  emit("keepFounded", { player, keep: state.keeps[player.id], moved: !!old });
}

world.afterEvents.playerPlaceBlock.subscribe((event) => {
  const { block, player } = event;
  if (!state) return;

  // Fallback for game versions without the "before place" event: undo building on someone else's land
  if (!placeBefore && !placementAllowed(player, block, block.typeId)) {
    let refund;
    try {
      refund = block.getItemStack(1);
    } catch {
      refund = undefined;
    }
    block.setType("minecraft:air");
    if (refund && player.getGameMode() !== GameMode.Creative) {
      player.getComponent("minecraft:inventory").container.addItem(refund);
    }
    player.onScreenDisplay.setActionBar("§cYou can't build on someone else's land.");
    return;
  }

  if (!block.typeId.startsWith("siege:")) return;
  if (REINFORCEABLE.includes(block.typeId) && damageMap()[blockKey(block)]) {
    delete damageMap()[blockKey(block)]; // fresh block, no leftover damage
    saveDamage();
  }
  if (block.typeId === KEEP_BANNER) return foundSettlement(player, block);
  if (block.typeId === CHARGE) {
    const view = player.getViewDirection();
    const flat = Math.hypot(view.x, view.z) || 1;
    player.onScreenDisplay.setActionBar("§6Charge lit! Stand back!");
    if (block.dimension.id === "minecraft:overworld") markWanted(player, settlementAt(block.location));
    return lightCharge(block, { x: view.x / flat, y: 0, z: view.z / flat });
  }

  // Every other Siege Nights block can only be placed on your own or allied land
  const land = block.dimension.id === "minecraft:overworld" ? settlementAt(block.location) : undefined;
  const yours = land && (land === player.id || isAlly(land, player.id));
  if (!yours) {
    return refuse(player, block, state.keeps[player.id]
      ? "§cYou can only build this inside your settlement."
      : "§cRaise a Keep Banner first to found your settlement.");
  }

  if (!tracked[block.typeId]) return;
  tracked[block.typeId].push({ dim: block.dimension.id, x: block.location.x, y: block.location.y, z: block.location.z });
  saveTracked();
  player.sendMessage(PLACE_MESSAGES[block.typeId]);
});

// Runs `work` on every loaded machine of one type, and forgets machines that were broken
export function forEachMachine(typeId, work) {
  let changed = false;
  tracked[typeId] = tracked[typeId].filter((t) => {
    const dim = world.getDimension(t.dim);
    let block;
    try {
      block = dim.getBlock(t);
    } catch {
      return true; // chunk not loaded right now; keep it
    }
    if (!block) return true;
    if (block.typeId !== typeId) {
      changed = true; // it was broken or blown up
      return false;
    }
    work(block, dim);
    return true;
  });
  if (changed) saveTracked();
}
