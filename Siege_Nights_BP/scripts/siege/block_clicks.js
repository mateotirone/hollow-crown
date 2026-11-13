// Clicking blocks: walls, gates, Keep Banner (dye or menu) and Barracks.
// Split from the original main.js; the code is unchanged apart from the event/hook calls.

import { world, system, GameMode } from "@minecraft/server";
import { BARRACKS, CASTLE_GATES, COLORS, KEEP_BANNER, PORTCULLISES } from "./constants.js";
import { recruitGuard } from "./guards.js";
import { barracksMenu, keepMenu } from "./menus.js";
import { moveGate } from "./gates.js";
import { saveState, state } from "./state.js";
import { colorTaken, foreignSettlement } from "./territory.js";
import { workOnWall } from "./walls.js";
import { sfx } from "../core/sfx.js";

// ---------- Clicking blocks: gates and banner dyeing ----------

export const GATE_SOUNDS = Object.fromEntries([
  ...PORTCULLISES.map((id) => [id, { open: "sig.portcullis_open", close: "sig.portcullis_close" }]),
  ...CASTLE_GATES.map((id) => [id, { open: "sig.gate_open", close: "sig.gate_close" }]),
]);


export const DYES = Object.fromEntries(COLORS.map((c, i) => [`minecraft:${c}_dye`, i]));
Object.assign(DYES, { "minecraft:ink_sac": 15, "minecraft:bone_meal": 0, "minecraft:lapis_lazuli": 11, "minecraft:cocoa_beans": 12 });

export const lastClick = new Map(); // stops one click from counting twice

// Gates and portcullises: a click always works the gate and never places the held block (Mateo's playtest
// rule, 2026-11-11), so the click is cancelled before Minecraft can place anything and handled a tick later.
// Reinforcing (iron, diamond, netherite) and patching (stone bricks) still work as before.
world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  const { block, player } = event;
  if (!GATE_SOUNDS[block.typeId]) return;
  event.cancel = true; // every repeat of a held click too, or holding the button would place blocks
  if (event.isFirstEvent === false) return;
  const now = system.currentTick;
  if (now - (lastClick.get(player.id) ?? -100) < 6) return;
  lastClick.set(player.id, now);
  const item = event.itemStack;
  const dim = block.dimension, at = { ...block.location };
  system.run(() => {
    if (!state) return;
    const here = dim.getBlock(at);
    if (!here || !GATE_SOUNDS[here.typeId]) return;
    if (workOnWall(here, player, item)) return;
    if (mayWorkGate(player, here)) toggleGate(here, player);
    else player.onScreenDisplay.setActionBar(`§cThe gate is barred. Only ${state.keeps[foreignSettlement(player, here.location, here.dimension.id)]?.name ?? "the owner"}'s people can open it.`);
  });
});

world.afterEvents.playerInteractWithBlock.subscribe((event) => {
  const { block, player } = event;
  if (event.isFirstEvent === false) return;
  if (GATE_SOUNDS[block.typeId]) return; // handled above
  const now = system.currentTick;
  if (now - (lastClick.get(player.id) ?? -100) < 6) return;
  lastClick.set(player.id, now);

  if (workOnWall(block, player, event.itemStack)) return;
  if (block.typeId === KEEP_BANNER) {
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

export function toggleGate(block, player) {
  return setGate(block, !block.permutation.getState("siege:open"), { awayFrom: player?.location, player });
}

// Opens or shuts a whole gate (every touching block of the same kind moves as one piece; see gates.js).
// block may also be the empty gateway an open gate swung out of. opts: { awayFrom, player }.
// Returns false if it was already that way or could not move.
export function setGate(block, open, opts = {}) {
  const gateType = block?.typeId;
  const moved = moveGate(block, open, opts);
  if (moved) {
    const sounds = GATE_SOUNDS[gateType] ?? GATE_SOUNDS[CASTLE_GATES[0]];
    sfx(block.dimension, open ? sounds.open : sounds.close, block.location, { volume: 0.6 });
  }
  return moved;
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
