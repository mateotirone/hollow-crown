// No iron golems (Mateo, 2026-11-12). Iron backs the Regal and the Moneyer buys every ingot with no daily limit,
// so iron must only come out of the ground: no golem farms.
//   - Any iron golem that appears is removed, unless our own code tagged it (KEEP_TAG, e.g. a Rival Lord's soldier).
//   - A golem that dies anyway leaves no iron behind.

import { world, system } from "@minecraft/server";

export const KEEP_TAG = "siege_keep_golem";
const GOLEM = "minecraft:iron_golem";

world.afterEvents.entitySpawn.subscribe(({ entity }) => {
  try {
    if (entity.typeId !== GOLEM || entity.hasTag(KEEP_TAG)) return;
    entity.remove();
  } catch {
    // already gone
  }
});

world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
  let dim, at;
  try {
    if (deadEntity.typeId !== GOLEM) return;
    dim = deadEntity.dimension;
    at = { ...deadEntity.location };
  } catch {
    return;
  }
  // loot lands a tick or so after death
  system.runTimeout(() => {
    try {
      for (const item of dim.getEntities({ type: "minecraft:item", location: at, maxDistance: 4 })) {
        const stack = item.getComponent("minecraft:item")?.itemStack;
        if (stack?.typeId === "minecraft:iron_ingot") item.remove();
      }
    } catch {
      // chunk unloaded
    }
  }, 2);
});
