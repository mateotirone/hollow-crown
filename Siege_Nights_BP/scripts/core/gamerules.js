// World defaults the game wants (Mateo, 2026-11-12 playtest): mobs don't grief, and no phantoms.
// Mateo 2026-11-13: farms grow faster, so randomTickSpeed is 3 (vanilla 1). Everything on random ticks speeds up
// with it: crops, saplings, sugar cane, grass and vine spread, leaf decay, ice melting and fire spread.
// Mateo 2026-11-13, "Duplicate messages": showDeathMessages and sendCommandFeedback off. Every death is told once,
// by the Crier (news/), which says where and never names what is hidden; a /gamemode no longer prints two lines.
// An admin who wants command replies back: /gamerule sendcommandfeedback true (it stays on).
// Each rule is set once per world, the first time anyone spawns after it is added here, so an admin who changes a
// rule back keeps it. Vanilla hostile mobs never spawn naturally: Siege_Nights_BP/spawn_rules/vanilla_*.json.

import { world } from "@minecraft/server";
import { moduleStore } from "./store.js";
import { addTests, assertEqual } from "./tests.js";

export const DEFAULTS = { mobGriefing: false, doInsomnia: false, randomTickSpeed: 3, showDeathMessages: false, sendCommandFeedback: false };
const FIRST = ["mobGriefing", "doInsomnia"]; // what a world with the old `set: true` already has
const store = moduleStore("siege:gamerules", () => ({ set: false, applied: [] }));

// The rules a world still needs: those not set on it yet (a world saved before `applied` had the first two)
export function rulesToApply(data) {
  const done = new Set([...(data.applied ?? []), ...(data.set ? FIRST : [])]);
  return Object.keys(DEFAULTS).filter((r) => !done.has(r));
}

world.afterEvents.playerSpawn.subscribe(() => {
  const left = rulesToApply(store.data);
  if (!left.length) return;
  for (const rule of left) {
    try { world.gameRules[rule] = DEFAULTS[rule]; } catch (e) { console.warn(`[Hollow Crown] could not set gamerule ${rule}: ${e}`); }
  }
  store.data.applied = [...new Set([...(store.data.applied ?? []), ...(store.data.set ? FIRST : []), ...left])];
  store.data.set = true;
  store.save();
});

addTests("gamerules", {
  "a new world gets every rule, an old one only the new rules, a done one none": () => {
    assertEqual(rulesToApply({ set: false }).join(","), "mobGriefing,doInsomnia,randomTickSpeed,showDeathMessages,sendCommandFeedback");
    assertEqual(rulesToApply({ set: true }).join(","), "randomTickSpeed,showDeathMessages,sendCommandFeedback");
    assertEqual(rulesToApply({ set: true, applied: Object.keys(DEFAULTS) }).join(","), "");
  },
});
