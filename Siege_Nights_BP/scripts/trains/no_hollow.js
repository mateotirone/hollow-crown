// Mateo, 2026-11-12: there is no train system in the Hollow. No Track, stations, depots or minecart rails go down
// there, for anyone (builders too): the placement is refused before it happens, or undone just after.
import { world, system } from "@minecraft/server";
import { UNDERTOW_ID } from "../undertow/layout.js";
import { TRACK } from "./data.js";

export const NO_RAIL_BLOCKS = new Set([TRACK, "hc:station_post", "siege:rail_depot", "minecraft:rail", "minecraft:golden_rail", "minecraft:detector_rail", "minecraft:activator_rail"]);
export const railRefused = (dimId, typeId) => dimId === UNDERTOW_ID && NO_RAIL_BLOCKS.has(typeId);
const SAY = "§7No rail runs in the Hollow.";

world.beforeEvents.playerPlaceBlock?.subscribe((event) => {
  const typeId = (event.permutationToPlace ?? event.permutationBeingPlaced)?.type.id;
  if (!railRefused(event.block.dimension.id, typeId)) return;
  event.cancel = true;
  const player = event.player;
  system.run(() => player.onScreenDisplay.setActionBar(SAY));
});

// where the game can't refuse it beforehand, take it back up
world.afterEvents.playerPlaceBlock.subscribe(({ block, player }) => {
  if (!railRefused(block.dimension.id, block.typeId)) return;
  block.setType("minecraft:air");
  player.onScreenDisplay.setActionBar(SAY);
});
