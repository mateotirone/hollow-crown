// World defaults the game wants. Each rule is set once per world, the first time anyone spawns after it was added
// here, so an admin who turns a rule back on keeps it.
//  - mobGriefing, doInsomnia (Mateo, 2026-11-12 playtest): mobs don't grief, and no phantoms.
//  - showDeathMessages, sendCommandFeedback (Mateo, 2026-11-13, "Duplicate messages"): every death is told once, by the
//    Crier (news/), which says where and never names what is hidden; and a /gamemode no longer prints two lines.
//    An admin who wants command replies back: /gamerule sendcommandfeedback true (it stays on).
// Vanilla hostile mobs never spawn naturally: Siege_Nights_BP/spawn_rules/vanilla_*.json.

import { world } from "@minecraft/server";
import { moduleStore } from "./store.js";

export const DEFAULTS = { mobGriefing: false, doInsomnia: false, showDeathMessages: false, sendCommandFeedback: false };
// done: rule -> true once set. Worlds from before the list grew stored { set: true } for the first two rules.
const store = moduleStore("siege:gamerules", () => ({ done: {} }));

world.afterEvents.playerSpawn.subscribe(() => {
  const d = store.data;
  d.done ??= {};
  if (d.set) { d.done.mobGriefing = d.done.doInsomnia = true; delete d.set; }
  const todo = Object.keys(DEFAULTS).filter((rule) => !d.done[rule]);
  if (!todo.length) return;
  for (const rule of todo) {
    try { world.gameRules[rule] = DEFAULTS[rule]; } catch (e) { console.warn(`[Hollow Crown] could not set gamerule ${rule}: ${e}`); }
    d.done[rule] = true;
  }
  store.save();
});
