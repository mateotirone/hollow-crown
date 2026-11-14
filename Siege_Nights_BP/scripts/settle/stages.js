// The stage table (config.js STAGES) against the town layouts: does every layout have a plot, open by the right
// tier, for every building a stage asks for, all at once? Pure (no Minecraft): the self-tests and tools/check.mjs
// both use it. Mateo 2026-11-14: "every place able building needs a plot", "you need to place every building for
// the settlement stage you're on in order to level up".
//
//   stageUnits(tier) -> [{ id | ids, what, tier }]   everything the stages up to `tier` ask to have standing
//   seatStages(layout, fits?) -> [{ tier, what }]     what finds no plot of its own in this layout (empty = all fit)
//   stageEntries() -> every build entry with its tier, for the checks

import { STAGES, HOMES } from "./config.js";
import { plotFit } from "./charters.js";
import { slotsOf } from "./towns.js";

export const stageEntries = () => STAGES.flatMap((s) => s.build.map((b) => ({ ...b, tier: s.tier, stage: s.name })));

// Everything standing by the end of stage `tier`: each building once, and the homes as many units as the stage
// asks for in all (the two houses every Hamlet starts with count toward them)
export function stageUnits(tier, { startHomes = 0 } = {}) {
  const units = [];
  let homes = startHomes;
  for (const s of STAGES) {
    if (s.tier > tier) break;
    for (const b of s.build) if (!b.pending) units.push({ ids: [b.id], what: b.name, tier: s.tier, region: b.region });
    for (; homes < (s.homes ?? 0); homes++) units.push({ ids: HOMES, what: "a home", tier: s.tier });
  }
  return units;
}

// A plot a stage may count on: open by then, not standing from the start (the Library and the starting houses),
// and not one the hall takes at that level (hall4 at the Castle; settle/hallmove.js)
const usable = (slot, tier) => slot.tier <= tier && !slot.start && !(slot.tags ?? []).includes("library")
  && !(tier >= 3 && (slot.tags ?? []).includes("hall4"));

// fits(id, slot): may this design stand on this plot (default: the plot rules, charters.js plotFit)
export function seatStages(layout, { fits = (id, s) => plotFit(id, s, new Set(["none"])).ok, region } = {}) {
  const slots = slotsOf(layout);
  const startHomes = slots.filter((s) => s.tier === 0 && HOMES.includes(s.start)).length;
  const missing = [];
  for (const s of STAGES) {
    const units = stageUnits(s.tier, { startHomes }).filter((u) => !u.region || !region || u.region === region);
    const open = slots.filter((x) => usable(x, s.tier));
    const owner = new Map();
    const tryUnit = (ui, seen) => {
      for (const slot of open) {
        if (seen.has(slot.id) || !units[ui].ids.some((id) => fits(id, slot))) continue;
        seen.add(slot.id);
        if (!owner.has(slot.id) || tryUnit(owner.get(slot.id), seen)) { owner.set(slot.id, ui); return true; }
      }
      return false;
    };
    for (const [ui, u] of units.entries()) if (!tryUnit(ui, new Set())) missing.push({ tier: s.tier, stage: s.name, what: u.what });
  }
  return missing;
}
