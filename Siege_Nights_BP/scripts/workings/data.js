// Old Workings: the old king's mines, each just outside one settlement, whose ore grows back (Mateo 2026-11-12).
// The map is one fixed world, so ore dug out of the ground never comes back on its own; a Working refills
// on a rotation, so a forever Realm never runs dry. Each one is its town's strength:
//   iron: Frosthelm and Gullcliff   gold: Redmesa and Dunehold (the Emberwaste)   diamond: Wolfcairn
// No netherite Working: netherite comes from bosses and trading (bestiary/bossCore.js rank, economy EXCHANGE).
// Every number lives here. Pure functions only (they run in Node and in the self-tests).

import { PLOT_PLAN } from "../plots/config.js";

export const WORKINGS = [
  { id: "frosthelm", plot: "Frosthelm", name: "the Frosthelm Working", tier: "iron" },
  { id: "gullcliff", plot: "Gullcliff", name: "the Gullcliff Working", tier: "iron" },
  { id: "redmesa", plot: "Redmesa", name: "the Redmesa Working", tier: "gold" },
  { id: "dunehold", plot: "Dunehold", name: "the Dunehold Working", tier: "gold" },
  { id: "wolfcairn", plot: "Wolfcairn", name: "the Wolfcairn Deeps", tier: "diamond" },
];

// depth: blocks from the entrance down to the chamber floor (the stair is that long). r: chamber radii (odd sizes:
// 2r+1). slots: ore spots in the chamber walls. regrowDays: in-game days between refills. ores: [block, weight].
// jumpers: chance per check (every 30 s) that claim jumpers come while someone is inside, and how many.
export const TIERS = {
  iron: {
    name: "iron", depth: 12, r: { x: 6, y: 3, z: 6 }, slots: 48, regrowDays: 1, need: "a stone pickaxe",
    ores: [["coal_ore", 30], ["copper_ore", 25], ["iron_ore", 45]], jumpers: { chance: 0, count: 0 }, loot: ["minecraft:raw_iron", 2, 4],
  },
  gold: {
    name: "gold", depth: 24, r: { x: 7, y: 4, z: 7 }, slots: 44, regrowDays: 2, need: "an iron pickaxe",
    ores: [["gold_ore", 50], ["iron_ore", 20], ["redstone_ore", 15], ["coal_ore", 15]], jumpers: { chance: 0.04, count: 3 }, loot: ["minecraft:raw_gold", 2, 4],
  },
  diamond: {
    name: "diamond", depth: 48, r: { x: 8, y: 4, z: 8 }, slots: 40, regrowDays: 3, need: "an iron pickaxe and a steady nerve",
    ores: [["diamond_ore", 12], ["gold_ore", 20], ["lapis_ore", 20], ["redstone_ore", 23], ["iron_ore", 25]], jumpers: { chance: 0.08, count: 4 }, loot: ["minecraft:diamond", 1, 2],
  },
};

export const WORKS = {
  distance: 100, // entrance distance from the plot's centre: outside the plot (r80) and its tree clearing
  reach: 48, // a player this close to the entrance loads the chunks: build or refill then
  richEvery: 7, // in-game days: one Working runs rich for this long, then another
  richSlots: 1.5, // a rich Working refills this many times its slots (more ore than walls can hold is capped)
  richTop: 2, // and its best ore is this much more likely
  jumperCooldown: 6000, // ticks (5 min) between claim jumper bands at one Working
  version: 1, // raise to rebuild every Working's tunnel and chamber in old worlds
};

export const planOf = (w) => PLOT_PLAN.find((p) => p.name === w.plot);
export const tierOf = (w) => TIERS[w.tier];

// Compass bearing (0 north = -z, 90 east = +x) from a to b, the same way plots/config.js gives gates
export const bearing = (a, b) => ((Math.atan2(b.x - a.x, -(b.z - a.z)) * 180) / Math.PI + 360) % 360;
const apart = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

// Bearings to try for the entrance, best first: as far as possible from the gate (roads, rails, station) and the
// plot's landmark. The world builder tries them in order until one stands on dry ground.
export function entranceBearings(plan, step = 15) {
  const avoid = [plan.gate, bearing(plan, plan.relic)];
  const all = [];
  for (let b = 0; b < 360; b += step) all.push({ b, score: Math.min(...avoid.map((x) => apart(b, x))) });
  return all.sort((p, q) => q.score - p.score || p.b - q.b).map((p) => p.b);
}

export function spotAt(plan, b, distance = WORKS.distance) {
  const r = (b * Math.PI) / 180;
  return { x: Math.round(plan.x + Math.sin(r) * distance), z: Math.round(plan.z - Math.cos(r) * distance) };
}

// The stair runs away from the plot, along whichever axis is closest to that bearing: {x, z} unit step
export function digDirection(b) {
  const r = (b * Math.PI) / 180, dx = Math.sin(r), dz = -Math.cos(r);
  return Math.abs(dx) >= Math.abs(dz) ? { x: Math.sign(dx), z: 0 } : { x: 0, z: Math.sign(dz) };
}

// Where the chamber sits for an entrance at (x, y0, z) digging along d
export function chamberOf(tier, at, d) {
  const T = TIERS[tier];
  const floor = at.y - T.depth;
  const ahead = T.depth + T.r.x + 1; // the stair ends at the chamber's near wall
  return { x: at.x + d.x * ahead, y: floor + T.r.y, z: at.z + d.z * ahead, floor };
}

// A small seeded dice, so every world lays the same Working the same way
export function dice(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const seedOf = (id) => [...id].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);

// Inside the chamber (open air): an ellipsoid above a flat floor
export function inChamber(c, r, x, y, z) {
  if (y < c.floor) return false;
  const k = ((x - c.x) / (r.x + 0.5)) ** 2 + ((y - c.y) / (r.y + 0.5)) ** 2 + ((z - c.z) / (r.z + 0.5)) ** 2;
  return k <= 1;
}

// Ore spots: blocks of wall that touch the open chamber (so ore always shows), never the floor under the stair
export function slotsOf(working, c, at) {
  const T = tierOf(working), r = T.r, roll = dice(seedOf(working.id));
  const wall = [];
  for (let x = c.x - r.x - 1; x <= c.x + r.x + 1; x++)
    for (let y = c.floor; y <= c.y + r.y + 1; y++)
      for (let z = c.z - r.z - 1; z <= c.z + r.z + 1; z++) {
        if (inChamber(c, r, x, y, z)) continue;
        const open = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].some(([a, b, e]) => inChamber(c, r, x + a, y + b, z + e));
        if (!open || y === c.floor && Math.hypot(x - at.x, z - at.z) < T.depth + 3) continue;
        wall.push({ x, y, z });
      }
  for (let i = wall.length - 1; i > 0; i--) { const j = Math.floor(roll() * (i + 1)); [wall[i], wall[j]] = [wall[j], wall[i]]; }
  return wall.slice(0, Math.min(wall.length, Math.ceil(T.slots * WORKS.richSlots)));
}

// Which ore grows in a spot (y < 0 gets the deepslate kind)
export function oreFor(tier, roll, y, rich = false) {
  const ores = TIERS[tier].ores.map(([id, w], i) => [id, rich && i === topOre(tier) ? w * WORKS.richTop : w]);
  const total = ores.reduce((s, [, w]) => s + w, 0);
  let t = roll * total;
  for (const [id, w] of ores) {
    if ((t -= w) < 0) return `minecraft:${y < 0 ? `deepslate_${id}` : id}`;
  }
  return `minecraft:${ores[ores.length - 1][0]}`;
}
// The tier's best ore: the one the tier is named for
export const topOre = (tier) => TIERS[tier].ores.findIndex(([id]) => id.startsWith(tier));

// Is a refill due? day = world.getDay()
export const regrowDue = (tier, lastDay, day) => lastDay === undefined || day - lastDay >= TIERS[tier].regrowDays;

// Which Working runs rich this week: every one in turn, in a shuffled order that differs each round
export function richFor(day) {
  const week = Math.floor(day / WORKS.richEvery);
  const round = Math.floor(week / WORKINGS.length);
  const order = WORKINGS.map((w) => w.id);
  const roll = dice(round * 977 + 13);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(roll() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  return order[week % order.length];
}
