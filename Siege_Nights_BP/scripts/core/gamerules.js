// World defaults the game wants (Mateo, 2026-11-12 playtest): mobs don't grief, and no phantoms.
// Set once per world, the first time anyone spawns, so an admin who turns a rule back on keeps it.
// Vanilla hostile mobs never spawn naturally: Siege_Nights_BP/spawn_rules/vanilla_*.json.

import { world } from "@minecraft/server";
import { moduleStore } from "./store.js";

const DEFAULTS = { mobGriefing: false, doInsomnia: false };
const store = moduleStore("siege:gamerules", () => ({ set: false }));

world.afterEvents.playerSpawn.subscribe(() => {
  if (store.data.set) return;
  for (const [rule, value] of Object.entries(DEFAULTS)) {
    try { world.gameRules[rule] = value; } catch (e) { console.warn(`[Hollow Crown] could not set gamerule ${rule}: ${e}`); }
  }
  store.data.set = true;
  store.save();
});
