// Small pointers at the moments a new player needs them (new-player audit, Mateo 2026-11-13):
//   - when the settlement grows a tier, say which hall can now be raised, where, and what it costs
//   - the first time each siege machine is placed, one action-bar line on how to work it

import { world, system } from "@minecraft/server";
import { on, addTests, assert } from "../siege/api.js";
import { HALL_COSTS } from "../townhall/townhall.js";
import { HALL_TIERS } from "../townhall/halls.js";

export function hallNudge(tierIndex) {
  const level = tierIndex + 1; // hall level = tier + 1 (Hamlet 0 -> Longhouse 1)
  const hall = HALL_TIERS[level], cost = HALL_COSTS[level];
  if (!hall || !cost) return undefined;
  return `§6Your town hall can grow into a ${hall.name}.§7 Raise it from the Town Board inside your hall: ${cost.map(([label, n]) => `${n} ${label}`).join(", ")}.`;
}

on("tierUp", ({ owner, after }) => {
  const idx = ["Hamlet", "Town", "City", "Castle"].indexOf(after?.name);
  const text = idx > 0 ? hallNudge(idx) : undefined;
  if (!text) return;
  system.runTimeout(() => { world.getPlayers().find((p) => p.id === owner)?.sendMessage(text); }, 120);
});

// Machines are placed as entities (items with entity_placer): hint the nearest player when one appears
export const MACHINE_HINTS = {
  "siege:ballista_engine": "Ballista: it aims and shoots by itself at monsters within 16 blocks. Sneak-click with an empty hand to pack it up.",
  "siege:trebuchet_engine": "Trebuchet: look where to throw and click it with cobblestone. Sneak-click to change the counterweight.",
  "siege:ram_engine": "Battering Ram: click to climb on, steer, and punch to swing the beam. Sneak to get off.",
};
world.afterEvents.entitySpawn.subscribe(({ entity }) => {
  let hint, at, dim;
  try { hint = MACHINE_HINTS[entity.typeId]; if (!hint) return; at = entity.location; dim = entity.dimension; } catch { return; }
  const key = `hc:hint_${entity.typeId.split(":")[1]}`;
  const player = dim.getPlayers({ location: at, maxDistance: 8 }).sort((a, b) =>
    Math.hypot(a.location.x - at.x, a.location.z - at.z) - Math.hypot(b.location.x - at.x, b.location.z - at.z))[0];
  if (!player || player.getDynamicProperty(key)) return;
  player.setDynamicProperty(key, true);
  system.runTimeout(() => { try { player.onScreenDisplay.setActionBar(`§6${hint}`); player.sendMessage(`§7${hint}`); } catch { /* left */ } }, 20);
});

addTests("newplayer nudges", {
  "a Town is told about the Stone Hall and its iron; a Castle about the Fortress": () => {
    assert(/Stone Hall/.test(hallNudge(1)) && /8 iron ingots/.test(hallNudge(1)), hallNudge(1));
    assert(/Fortress/.test(hallNudge(3)), hallNudge(3));
  },
});
