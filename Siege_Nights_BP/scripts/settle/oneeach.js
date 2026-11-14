// One of each special building per settlement (Mateo 2026-11-14; the list is config.js ONE_EACH). The plot side is
// in plotmarker.js (the menu greys a second one out) and charters.js (Rival Lords skip it); this file stops a second
// raising block (the Barracks, the Quartermaster's Desk, the Dragon Roost) going down on the same settlement's land.
// It holds in Creative too, so a playtest sees the rule. Writ allies building on a shared settlement share it: the
// count is the settlement's, not the player's.
//
// Test: on your land place a Quartermaster's Desk, then a second one: the second is refused and given back.

import { world, system } from "@minecraft/server";
import { isReady, settlementAt } from "../siege/api.js";
import { ONE_EACH } from "./config.js";
import { BLOCK_BUILDS } from "./blockdesigns.js";
import { BUILDING } from "./buildings.js";
import { oneEachTaken, oneEachMessage } from "./charters.js";
import { townOf } from "./founding.js";
import { raisedKeys, forgetRaisedBlock, useRaiseCheck } from "./raised.js";

const OVERWORLD = "minecraft:overworld";
const NAMES = { "siege:barracks": "Barracks", "siege:quartermaster_desk": "Quartermaster's Desk", "siege:dragon_roost": "Dragon Roost" };
const idOf = (typeId) => typeId.replace(/^siege:/, "");
const locOf = (k) => { const [x, y, z] = k.split(",").map(Number); return { x, y, z }; };

// The raising blocks of this type that still stand on the settlement's land (unloaded ones are taken to stand),
// and the ones that are gone without a break event
function standing(owner, typeId, except) {
  const dim = world.getDimension(OVERWORLD);
  const live = [], gone = [];
  for (const key of raisedKeys(owner, typeId)) {
    if (except && key === except) continue;
    let there = true;
    try { const b = dim.getBlock(locOf(key)); there = !b || b.typeId === typeId; } catch { /* not loaded */ }
    (there ? live : gone).push(key);
  }
  return { live, gone };
}

// Why this raising block can't go down here, or undefined. except: the "x,y,z" of the block itself (after placing)
export function blockProblem(owner, typeId, except) {
  if (!owner || !BLOCK_BUILDS[typeId] || !ONE_EACH.includes(idOf(typeId))) return { problem: undefined, gone: [] };
  const { live, gone } = standing(owner, typeId, except);
  const counts = { [idOf(typeId)]: live.length };
  // the Barracks also stands as a plot building (raised from a Plot Marker; its block counts as its plot)
  for (const st of Object.values(townOf(owner)?.slots ?? {})) if (st.building === idOf(typeId)) counts[st.building]++;
  const name = NAMES[typeId] ?? BUILDING[idOf(typeId)]?.name ?? "building";
  return { problem: oneEachTaken(idOf(typeId), counts) && oneEachMessage(name, "break the old block first (or knock its building down at its Plot Marker)"), gone };
}

const before = world.beforeEvents.playerPlaceBlock;
if (before) {
  before.subscribe((event) => {
    if (!isReady() || event.block.dimension.id !== OVERWORLD) return;
    const typeId = (event.permutationToPlace ?? event.permutationBeingPlaced)?.type.id;
    if (!typeId || !BLOCK_BUILDS[typeId]) return;
    const owner = settlementAt(event.block.location);
    const { problem, gone } = blockProblem(owner, typeId);
    const player = event.player;
    if (gone.length) system.run(() => gone.forEach(forgetRaisedBlock)); // (no writes in a before event)
    if (!problem) return;
    event.cancel = true;
    system.run(() => player.sendMessage(problem));
  });
}
// Game versions without the "before place" event (and a second line of defence): raised.js asks before it raises
// anything, and takes a refused block back out and returns it
useRaiseCheck((owner, typeId, key) => {
  const { problem, gone } = blockProblem(owner, typeId, key);
  gone.forEach(forgetRaisedBlock);
  return problem;
});
