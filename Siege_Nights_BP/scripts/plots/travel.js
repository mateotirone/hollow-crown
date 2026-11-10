// Travel rules for The Hollow Crown map: no elytra (rails and horses instead), and a map edge.

import { world, system, ItemStack, EquipmentSlot, GameMode } from "@minecraft/server";
import { onTick } from "../core/loop.js";
import { moduleStore } from "../core/store.js";
import { MAP, OVERWORLD, WARDS, EXPANSION } from "./config.js";
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

// Zones an update has opened are remembered in the world (v = layout of this saved data, for later upgrades)
const zones = moduleStore("siege:plots_zones", () => ({ v: 1, open: [] }));
const openIds = () => {
  try {
    return zones.data.open;
  } catch {
    return []; // world not ready yet
  }
};
export const zoneOpen = (id) => openIds().includes(id);

/** Open a sealed expansion zone for good: the map edge then lets players into its land. For updates to call. */
export function openZone(id) {
  if (!EXPANSION.some((z) => z.id === id) || zoneOpen(id)) return false;
  zones.data.open.push(id);
  zones.save();
  return true;
}

export function outsideMap(loc, open = openIds()) {
  if (!MAP.mapHalfSize) return false;
  if (Math.max(Math.abs(loc.x - MAP.mapCenter.x), Math.abs(loc.z - MAP.mapCenter.z)) <= MAP.mapHalfSize) return false;
  return !EXPANSION.some((z) => open.includes(z.id) && loc.x >= z.beyond.x0 && loc.x <= z.beyond.x1 && loc.z >= z.beyond.z0 && loc.z <= z.beyond.z1);
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

// ---------- Wards: towns and landmarks can't be dug up ----------
// The map's hand-built places stay as built. Creative players (the builders) can still edit them.

export function wardAt(loc) {
  return WARDS.find((w) => Math.hypot(loc.x - w.x, loc.z - w.z) <= w.r);
}

function guardWard(event, block, player) {
  if (!mapMode() || block.dimension.id !== OVERWORLD || player.getGameMode() === GameMode.Creative) return;
  const ward = wardAt(block.location);
  if (!ward) return;
  event.cancel = true;
  system.run(() => player.onScreenDisplay.setActionBar(`§7${ward.name} is protected. Nothing here can be broken or built.`));
}

world.beforeEvents.playerBreakBlock.subscribe((event) => guardWard(event, event.block, event.player));
world.beforeEvents.playerPlaceBlock?.subscribe((event) => guardWard(event, event.block, event.player));
world.beforeEvents.explosion?.subscribe((event) => {
  if (!mapMode() || event.dimension.id !== OVERWORLD) return;
  const blocks = event.getImpactedBlocks();
  const safe = blocks.filter((b) => !wardAt(b.location));
  if (safe.length !== blocks.length) event.setImpactedBlocks(safe);
});

onTick("plots_elytra", 10, () => {
  if (MAP.noElytra) elytraTick();
});
onTick("plots_map_edge", 20, () => {
  if (mapMode()) mapEdgeTick();
});
