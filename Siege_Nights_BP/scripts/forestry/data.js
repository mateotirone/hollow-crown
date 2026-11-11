// Forester's Lodge: numbers and pure helpers (no Minecraft imports, so it loads in Node tests).
// Mateo: the numbers you might want to tweak are in FORESTRY at the top.
// The trees themselves come from map/trees (build_grove.py writes grove_data.js and the structures).

import { GROVE, GROVE_PLOTS, GROVE_SPECIES, GROVE_DESIGNS, GROVE_VARIANTS } from "./grove_data.js";

export const LODGE = "siege:foresters_lodge";

export const FORESTRY = {
  day: 24000, // ticks in a Minecraft day
  growTicks: { sapling: 24000, young: 48000 }, // sapling -> young after 1 day, young -> mature after 2 more
  minLogs: 12, // a felled mature tree gives at least this many logs ...
  maxLogs: 48, // ... and at most this many (the baobab alone has over a hundred)
  youngShare: 0.5, // a young tree felled early gives half what its wood would
  checkEvery: 100, // ticks between growth checks
};

// Yard size in the lodge's frame: the block at (0, 1, 0), +z runs into the yard. Odd: 41 x 29.
export const YARD = { x0: -20, x1: 20, z0: 1, z1: 29 };

export const LODGE_LEVELS = [
  null,
  { level: 1, plots: 2, cost: null },
  { level: 2, plots: 4, cost: [{ item: "minecraft:iron_ingot", count: 16 }, { item: "coins", count: 128 }] },
  { level: 3, plots: 6, cost: [{ item: "minecraft:iron_ingot", count: 32 }, { item: "coins", count: 320 }] },
];
export const MAX_LEVEL = LODGE_LEVELS.length - 1;
export const plotsAt = (level) => LODGE_LEVELS[Math.max(1, Math.min(MAX_LEVEL, level))].plots;

export const STAGE_NAMES = { sapling: "sapling", young: "young tree", mature: "full grown" };
export const NEXT_STAGE = { sapling: "young", young: "mature" };

export const speciesFor = (style) => GROVE[style] ?? GROVE.vale;
export const speciesName = (sid) => GROVE_SPECIES[sid]?.name ?? sid;
export const designName = (sid, stage, v) => `${sid}_${stage}_${v % GROVE_VARIANTS}`;
export const designOf = (sid, stage, v) => GROVE_DESIGNS[designName(sid, stage, v)];
export const structureId = (sid, stage, v) => `siege_grove:${designName(sid, stage, v)}`;

// A new plot record: plot i grows the style's species in turn
export function newPlot(style, i, stage = "sapling", now = 0) {
  const list = speciesFor(style);
  return { sid: list[i % list.length], v: i % GROVE_VARIANTS, stage, at: now };
}

// Lodge frame -> world: x runs to the right of someone facing +z (same as settle/rules.js footprint)
export function toWorld(origin, forward, x, y, z) {
  const F = { x: Math.sign(forward.x), z: Math.sign(forward.z) };
  const R = { x: -F.z, z: F.x };
  return { x: origin.x + x * R.x + z * F.x, y: origin.y + y, z: origin.z + x * R.z + z * F.z };
}
export const plotCentre = (origin, forward, i) => toWorld(origin, forward, GROVE_PLOTS[i][0], 0, GROVE_PLOTS[i][1]);

// Logs a felled tree gives back: { item: count }, from the wood cells still standing
export function fellYield(design, standing, stage) {
  const total = design.wood.length;
  if (!total || standing <= 0) return {};
  let want = stage === "mature" ? Math.max(FORESTRY.minLogs, Math.min(FORESTRY.maxLogs, total)) : Math.round(total * FORESTRY.youngShare);
  want = Math.round((want * standing) / total);
  const out = {};
  const kinds = Object.entries(design.drops).sort((a, b) => b[1] - a[1]);
  let left = want;
  for (const [item, n] of kinds) {
    const share = Math.min(left, Math.round((want * n) / total));
    if (share > 0) out[item] = share;
    left -= share;
  }
  if (left > 0 && kinds.length) out[kinds[0][0]] = (out[kinds[0][0]] ?? 0) + left;
  return out;
}

// Time until a plot's next stage, in ticks (0 = due now, Infinity = full grown)
export function ticksToNext(plot, now) {
  const need = FORESTRY.growTicks[plot.stage];
  return need === undefined ? Infinity : Math.max(0, plot.at + need - now);
}

export const costText = (cost) => cost.map((c) => (c.item === "coins" ? `${c.count} coins` : `${c.count} ${c.item.replace(/^\w+:/, "").replaceAll("_", " ")}`)).join(", ");
export const daysText = (ticks) => (ticks <= 0 ? "any moment" : ticks < FORESTRY.day ? "before tomorrow" : `in ${Math.ceil(ticks / FORESTRY.day)} days`);
