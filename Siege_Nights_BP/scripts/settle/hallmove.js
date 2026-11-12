// The level-5 town hall needs more ground than levels 1-4. The town layouts keep the hall's ground for levels
// 1-4 free; plots on level 5's extra ground carry the tag "hall5" (about one per layout). Mateo's rule
// (2026-11-12): when the hall goes up to level 5, a building on a hall5 plot comes down with its FULL price
// back, the owner gets a free plot of the same size (the next building they raise on a plot of that size costs
// nothing: town.credits), and the hall5 plot closes for good.
//
// It runs when the hall starts rising to level 5 ("hallBuildStarted", if the town hall sends it) or, failing
// that, when it is finished ("hallBuilt"). Blocks that are part of the new hall are never cleared.

import { world } from "@minecraft/server";
import { on, emit } from "../siege/api.js";
import { hallOf } from "../townhall/townhall.js";
import { worldCells } from "../townhall/build.js";
import { drawHall } from "../townhall/halls.js";
import { STYLES } from "../townhall/styles.js";
import { slotClass, CLASS_NAMES } from "./charters.js";
import { townOf, layoutOf, slotState, saveTowns, clearMarker, forgetMarker, PLOT_MARKER } from "./founding.js";
import { slotsOf } from "./towns.js";
import { demolish } from "./plotmarker.js";
import { BUILDING } from "./buildings.js";
import { HAND_NAMES } from "./config.js";

const OVERWORLD = "minecraft:overworld";
export const HALL_TAKES_AT = 5;
const nameOf = (id) => BUILDING[id]?.name ?? HAND_NAMES[id] ?? id;

// The cells of the hall at this level, so clearing a plot never touches it
function hallCells(owner, level, style) {
  const hall = hallOf(owner);
  if (!hall) return new Set();
  try {
    const plan = drawHall(level, STYLES[style ?? hall.style]);
    return new Set(worldCells(plan, { x: hall.x, y: hall.y, z: hall.z }, { x: hall.fx, z: hall.fz }).map((c) => `${c.x},${c.y},${c.z}`));
  } catch {
    return new Set();
  }
}

// Close every hall5 plot of this town; a building on one comes down, paid back in full, with a free plot owed
export function hallTakesPlots(owner, level, style) {
  const town = townOf(owner);
  if (!town || level < HALL_TAKES_AT) return [];
  const player = world.getPlayers().find((p) => p.id === owner);
  const keep = hallCells(owner, level, style);
  const moved = [];
  for (const slot of slotsOf(layoutOf(town))) {
    if (!(slot.tags ?? []).includes("hall5")) continue;
    const state = slotState(owner, slot.id);
    if (state.closed && !state.building) continue;
    if (state.building && state.done === false) { state.closeWhenDone = true; continue; } // still rising: when it's done
    if (!state.building) {
      clearMarker(owner, slot);
      for (const k of Object.keys(state)) delete state[k];
      state.closed = true;
      continue;
    }
    const cls = slotClass(slot);
    const name = nameOf(state.building);
    const paid = state.paid ?? 0;
    town.credits ??= {};
    town.credits[cls] = (town.credits[cls] ?? 0) + 1;
    moved.push({ slot: slot.id, building: state.building, cls, paid });
    if (state.hand) { // built by hand: it was never paid for, but it still has to make way
      const spot = state.marker;
      if (spot) { forgetMarker(spot); try { const b = world.getDimension(OVERWORLD).getBlock(spot); if (b?.typeId === PLOT_MARKER) b.setType("minecraft:air"); } catch { /* not loaded */ } }
    }
    const origin = state.origin ?? { x: town.x + slot.box.x0, y: town.y + slot.dy, z: town.z + slot.box.z0 };
    const box = state.box ?? { x0: town.x + slot.box.x0, z0: town.z + slot.box.z0, x1: town.x + slot.box.x1, z1: town.z + slot.box.z1 };
    const top = state.top ?? 24;
    demolish(owner, slot, { ...state, origin, box, top, paid }, player, {
      back: paid, keep, after: () => { const st = slotState(owner, slot.id); for (const k of Object.keys(st)) delete st[k]; st.closed = true; saveTowns(); },
    });
    for (const k of Object.keys(state)) delete state[k];
    state.closed = true;
    player?.sendMessage(`§6The town hall needs the ground your ${name} stood on.§7 It comes down${paid ? ` and the full ${paid} is paid back` : ""}. Your next building on a ${CLASS_NAMES[cls]} plot is free.`);
  }
  saveTowns();
  if (moved.length) { emit("settleCharter", { owner }); emit("hallTookPlots", { owner, moved }); }
  return moved;
}

on("hallBuildStarted", ({ owner, level, style }) => { if (level >= HALL_TAKES_AT) hallTakesPlots(owner, level, style); });
on("hallBuilt", ({ owner, level, style }) => { if (level >= HALL_TAKES_AT) hallTakesPlots(owner, level, style); });

// A building that was still rising on a hall5 plot when the hall took it makes way as soon as it is done
on("settleBuilt", ({ owner, slotId }) => {
  if (!slotId) return;
  const st = townOf(owner)?.slots?.[slotId];
  if (!st?.closeWhenDone) return;
  delete st.closeWhenDone;
  const hall = hallOf(owner);
  hallTakesPlots(owner, Math.max(HALL_TAKES_AT, hall?.level ?? 0), hall?.style);
});
