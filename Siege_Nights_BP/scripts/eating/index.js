// Eating heals at once (Java-style saturation healing). The rule and its numbers: data.js. Mateo 2026-11-13.
// Respects the naturalRegeneration game rule. Test: eat on a full bar while hurt, the hearts come back in seconds.
import { world } from "@minecraft/server";
import { onTick } from "../siege/api.js";
import { EATING, fastHeal } from "./data.js";
import "./tests.js";

const value = (player, id) => player.getComponent(id);

onTick("eating", EATING.every, () => {
  if (world.gameRules?.naturalRegeneration === false) return;
  for (const player of world.getAllPlayers()) {
    try {
      if (!player.isValid) continue;
      const hunger = value(player, "minecraft:player.hunger"), saturation = value(player, "minecraft:player.saturation");
      const health = value(player, "minecraft:health");
      if (!hunger || !saturation || !health) continue;
      const step = fastHeal({ hunger: hunger.currentValue, saturation: saturation.currentValue, health: health.currentValue, max: health.effectiveMax });
      if (!step) continue;
      saturation.setCurrentValue(Math.max(0, saturation.currentValue - step.cost));
      health.setCurrentValue(Math.min(health.effectiveMax, health.currentValue + step.heal));
    } catch { /* the player left mid-tick */ }
  }
});
