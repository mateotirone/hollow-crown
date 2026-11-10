// Travel rules for The Hollow Crown map: no elytra (rails and horses instead), and a map edge.

import { world, ItemStack, EquipmentSlot } from "@minecraft/server";
import { onTick } from "../core/loop.js";
import { MAP, OVERWORLD } from "./config.js";
import { mapMode } from "./claims.js";

// ---------- No elytra ----------
// Any elytra a player gets (End ships, chests, trades) crumbles and pays out instead.

function payForElytra(player) {
  for (const r of MAP.elytraReward) {
    const leftover = player.getComponent("minecraft:inventory").container.addItem(new ItemStack(r.item, r.count));
    if (leftover) player.dimension.spawnItem(leftover, player.location);
  }
  const what = MAP.elytraReward.map((r) => `${r.count} ${r.item.replace("minecraft:", "").replaceAll("_", " ")}`).join(" and ");
  player.sendMessage(`§6The wings crumble to dust. Nobody flies in this land, but you get ${what} for them.`);
  player.playSound("random.break");
}

function elytraTick() {
  for (const player of world.getPlayers()) {
    const gear = player.getComponent("minecraft:equippable");
    for (const slot of [EquipmentSlot.Chest, EquipmentSlot.Offhand]) {
      if (gear?.getEquipment(slot)?.typeId !== "minecraft:elytra") continue;
      gear.setEquipment(slot, undefined);
      payForElytra(player);
    }
    const inv = player.getComponent("minecraft:inventory")?.container;
    if (!inv) continue;
    for (let i = 0; i < inv.size; i++) {
      if (inv.getItem(i)?.typeId !== "minecraft:elytra") continue;
      inv.setItem(i, undefined);
      payForElytra(player);
    }
  }
}

// ---------- Map edge ----------
// The hand-built map is a square around Kingsrest. Past its edge you're put back where you were.

const lastInside = new Map(); // player id -> last spot inside the edge

export function outsideMap(loc) {
  if (!MAP.mapHalfSize) return false;
  return Math.max(Math.abs(loc.x - MAP.mapCenter.x), Math.abs(loc.z - MAP.mapCenter.z)) > MAP.mapHalfSize;
}

function mapEdgeTick() {
  for (const player of world.getPlayers()) {
    if (player.dimension.id !== OVERWORLD) continue;
    const loc = player.location;
    if (!outsideMap(loc)) {
      lastInside.set(player.id, { x: loc.x, y: loc.y, z: loc.z });
      continue;
    }
    const clamp = (v, c) => Math.max(c - MAP.mapHalfSize + 4, Math.min(c + MAP.mapHalfSize - 4, v));
    const back = lastInside.get(player.id) ?? { x: clamp(loc.x, MAP.mapCenter.x), y: loc.y, z: clamp(loc.z, MAP.mapCenter.z) };
    const mount = player.getComponent("minecraft:riding")?.entityRidingOn;
    try {
      (mount ?? player).teleport(back); // bring the horse back too
    } catch {
      // try again next tick
    }
    player.onScreenDisplay.setActionBar("§7The mists close in. The map ends here.");
  }
}

onTick("plots_elytra", 10, () => {
  if (MAP.noElytra) elytraTick();
});
onTick("plots_map_edge", 20, () => {
  if (mapMode()) mapEdgeTick();
});
