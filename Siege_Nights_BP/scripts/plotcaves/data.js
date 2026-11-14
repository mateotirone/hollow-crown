// Plot caves: every plot has a mine shaft down to its own cave (Mateo 2026-11-13). The cave's shape comes from the
// one cave generator (caves/cavegen.js). This file turns a generated cave into the blocks the game writes:
//   - which part of the cave is open, by the plot's tier (a deeper level opens at Town, City and Castle; the levels
//     below are filled with rock, with a cave-in of rubble where they meet the open part)
//   - tonight's ore (Mateo picked 12 iron a night at Hamlet), rolled into new places every night
//   - the old mine dug into it (mine.js): the shaft's ladder, rings, lanterns and rope, the timbered pit bottom, the
//     miners' rest, and the haulage way with its rails, timber sets and lanterns; the rock retextured by region
//   (the collar, headframe and winding house on the surface are the building skill's pithead, raised once: index.js)
//   - the sealed door at the deep end, the dark tunnel behind it, and the tunnel's mouth beside the Rift's tear
//     (Mateo 2026-11-13: "a way to the Rift ... an underground tunnel shortcut")
// Pure functions only: they run in Node, the self-tests and the 3D preview.
//
// Coordinates are the generator's: local to the shaft top, (0,0,0) is the ground block the shaft goes down through.

import { SHAFT_DEPTH, rollOre } from "../caves/cavegen.js";
import { mineLayout, strataAt, MINE_LOG } from "./mine.js";

export const CAVE = {
  shaftR: 76, // the shaft stands this far from the plot's stone: inside the plot's land, outside the Castle wall (r66)
  footprint: 3, // and needs dry, natural ground for 3 blocks round it (the headframe is 5 x 5)
  reach: 64, // a player this close to the shaft loads the cave's chunks: choose, build and reset then
  nightStarts: 13000, // a cave's night (its ore roll) changes at this time of day
  version: 2, // raise to rebuild every cave in old worlds (2: the old mine and the new pithead, 2026-11-14)
  doorReach: 5, // the sealed door opens for a player who may pass, this close
};

// Each tier opens the cave down to this height (local y). Below it the cave is rock, until the settlement grows.
export const LEVELS = [
  { tier: "Hamlet", floor: -34 },
  { tier: "Town", floor: -42 },
  { tier: "City", floor: -50 },
  { tier: "Castle", floor: -999 },
];

// Ore in the open cave each night, by tier. Iron is Mateo's pick (12 a night at Hamlet). Gold opens at City and
// diamond at Castle, diamond only in the Castle level (below the City floor).
export const ORE = [
  { iron: 12, coal: 20, copper: 8 },
  { iron: 16, coal: 20, copper: 8 },
  { iron: 20, coal: 20, copper: 8, gold: 6 },
  { iron: 24, coal: 20, copper: 8, gold: 8, diamond: 3 },
];
// Each region's strength tilts its gold and diamond (economy REGION_RATES), never its iron (Mateo's rate is per plot).
export const TILTED = ["gold", "diamond"];

export const REGION_KEY = { "Aldmere Vale": "vale", Frostmarch: "frostmarch", Saltreach: "saltreach", Emberwaste: "emberwaste", Blackfen: "blackfen" };
export const LOG = MINE_LOG;
export const RUBBLE = ["minecraft:cobblestone", "minecraft:gravel", "minecraft:cobblestone", "minecraft:tuff", "minecraft:mossy_cobblestone"];
export const DOOR = "minecraft:chiseled_deepslate";
export const DARK = "minecraft:black_concrete"; // the tunnel's far end: no wall you can see, just dark

const key = (x, y, z) => `${x},${y},${z}`;
const unkey = (k) => k.split(",").map(Number);
const N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const H4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const hash = (a, b, c) => { let h = Math.imul(a ^ 0x9e3779b9, 73856093) ^ Math.imul(b, 19349663) ^ Math.imul(c, 83492791); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

export const levelOf = (tierIndex) => LEVELS[Math.max(0, Math.min(LEVELS.length - 1, tierIndex | 0))];

/** Tonight's ore counts for a tier in a region. rate(region, metal) is economy regionRate. */
export function oreBudget(tierIndex, region, rate = () => 1) {
  const base = ORE[Math.max(0, Math.min(ORE.length - 1, tierIndex | 0))], out = {};
  for (const [k, n] of Object.entries(base)) out[k] = TILTED.includes(k) ? Math.max(1, Math.round(n * rate(region, k))) : n;
  return out;
}

/** The cave's night number at an absolute time: it changes at nightfall, so every night has its own ore. */
export const nightAt = (absoluteTime) => Math.floor((absoluteTime - CAVE.nightStarts) / 24000);

// ---------------------------------------------------------------- the open part of the cave
/** The air a tier opens: every cave block above the tier's floor that you can walk to from the shaft. */
export function openAir(cave, tierIndex) {
  const floor = levelOf(tierIndex).floor, start = key(0, -SHAFT_DEPTH, 0);
  const open = new Set([start]), todo = [start];
  while (todo.length) {
    const [x, y, z] = unkey(todo.pop());
    for (const [dx, dy, dz] of N6) {
      const k = key(x + dx, y + dy, z + dz);
      if (y + dy < floor || open.has(k) || !cave.air.has(k)) continue;
      open.add(k); todo.push(k);
    }
  }
  return open;
}

const rockAt = (groundY, y) => (groundY + y < 0 ? "minecraft:deepslate" : "minecraft:stone");

// ---------------------------------------------------------------- the door, the tunnel and its mouth
// The deep mark is a floor block at the cave's far end. The door goes in the wall beside it, on the side with the
// most rock behind it; the tunnel runs straight in for 6, turns, and runs on 7 into the dark. Walking into the
// last 4 of the second leg takes you to the Rift; coming back you step out where the turn is.
export function tunnelPlan(cave, open) {
  const m = cave.marks.deep;
  if (!m || !open.has(key(m.x, m.y, m.z))) return null;
  // the deep mark first, then other floor blocks near it, nearest first, until one has room for the tunnel
  const floorAt = (x, y, z) => open.has(key(x, y, z)) && !cave.air.has(key(x, y - 1, z)) && open.has(key(x, y + 1, z)) && open.has(key(x, y + 2, z));
  const tries = [];
  for (let dx = -12; dx <= 12; dx++) for (let dz = -12; dz <= 12; dz++) for (let dy = -4; dy <= 4; dy++) {
    if (floorAt(m.x + dx, m.y + dy, m.z + dz)) tries.push({ x: m.x + dx, y: m.y + dy, z: m.z + dz, r: dx * dx + dz * dz + dy * dy * 2 });
  }
  tries.sort((a, b) => a.r - b.r);
  for (const d of [m, ...tries]) {
    const plan = tunnelFrom(cave, d);
    if (plan) return plan;
  }
  // none: any floor block in the deepest open part, furthest from the shaft first
  const far = [];
  for (const k of open) {
    const [x, y, z] = unkey(k);
    if (y < m.y + 6 && floorAt(x, y, z)) far.push({ x, y, z, r: x * x + z * z });
  }
  far.sort((a, b) => b.r - a.r);
  for (let i = 0; i < far.length && i < 600; i += 3) {
    const plan = tunnelFrom(cave, far[i]);
    if (plan) return plan;
  }
  return null;
}

function tunnelFrom(cave, d) {
  const solid = (x, y, z) => !cave.air.has(key(x, y, z));
  let best = null;
  for (const [fx, fz] of H4) {
    // the door's plane is the first wall block along this way at floor height
    let k0 = 1;
    while (k0 < 6 && !solid(d.x + fx * k0, d.y, d.z + fz * k0)) k0++;
    if (k0 >= 6) continue;
    const ux = -fz, uz = fx;
    let run = 0;
    for (let k = k0; k < k0 + 14; k++) {
      let ok = true;
      for (let u = -2; u <= 2 && ok; u++) for (let h = -1; h <= 4 && ok; h++) ok = solid(d.x + fx * k + ux * u, d.y + h, d.z + fz * k + uz * u);
      if (!ok) break;
      run++;
    }
    if (!best || run > best.run) best = { fx, fz, ux, uz, k0, run };
  }
  if (!best || best.run < 4) return null;
  const { fx, fz, ux, uz, k0 } = best;
  // which way the second leg turns: towards the side with more rock
  const side = (s) => { let n = 0; for (let k = 1; k <= 8; k++) for (let h = 0; h < 4; h++) if (solid(d.x + fx * (k0 + 5) + ux * s * k, d.y + h, d.z + fz * (k0 + 5) + uz * s * k)) n++; return n; };
  const turn = side(1) >= side(-1) ? 1 : -1;
  const door = [], tunnel = [], trigger = [];
  const at = (k, u, h) => key(d.x + fx * k + ux * u, d.y + h, d.z + fz * k + uz * u);
  for (let u = -1; u <= 1; u++) for (let h = 0; h < 4; h++) door.push(at(k0, u, h));
  const frame = [], lamps = [at(k0 - 1, -2, 0), at(k0 - 1, 2, 0)];
  for (const u of [-2, 2]) for (let h = 0; h < 5; h++) frame.push(at(k0, u, h));
  for (let u = -1; u <= 1; u++) frame.push(at(k0, u, 4));
  for (let k = k0 + 1; k <= k0 + 6; k++) for (let u = -1; u <= 1; u++) for (let h = 0; h < 4; h++) tunnel.push(at(k, u, h));
  // second leg: from the end of the first, sideways
  const end = { x: d.x + fx * (k0 + 5), z: d.z + fz * (k0 + 5) };
  const leg = (s, w, h) => key(end.x + ux * turn * s + fx * w, d.y + h, end.z + uz * turn * s + fz * w);
  for (let s = 2; s <= 8; s++) for (let w = -1; w <= 1; w++) for (let h = 0; h < 4; h++) (s >= 5 ? trigger : tunnel).push(leg(s, w, h));
  const dark = [];
  for (let w = -1; w <= 1; w++) for (let h = 0; h < 4; h++) dark.push(leg(9, w, h));
  const landing = { x: end.x + ux * turn * 2 + 0.5, y: d.y, z: end.z + uz * turn * 2 + 0.5, look: { x: d.x + 0.5, y: d.y + 1, z: d.z + 0.5 } };
  return { door, frame, lamps, tunnel, trigger, dark, landing, front: { x: d.x, y: d.y, z: d.z }, facing: [-fx, -fz] };
}

// The tunnel's other end: a mouth cut into the Rift cave's wall, beside the tear. The game tries spots along the
// wall (mouthSpots) and keeps the first whose front is open and whose back is rock.
// rift: { x, y, z, facing } (the seam's wall block at floor level, facing = the way the wall's face points)
export const FACING_V = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };
export function mouthSpots(rift) {
  const [fx, fz] = FACING_V[rift.facing] ?? FACING_V.south, ux = -fz, uz = fx;
  return [10, -10, 12, -12, 14, -14, 8, -8, 16, -16].map((u) => ({ x: rift.x + ux * u, y: rift.y, z: rift.z + uz * u, fx, fz, ux, uz }));
}
/** The blocks of a mouth: front (must be open), cut (made air), dark (the far end), frame (timbers), trigger cells. */
export function mouthPlan(spot, log = LOG.vale) {
  const { x, y, z, fx, fz, ux, uz } = spot;
  const at = (k, u, h) => ({ x: x - fx * k + ux * u, y: y + h, z: z - fz * k + uz * u });
  const front = [], cut = [], dark = [], frame = [], trigger = [];
  for (let u = -1; u <= 1; u++) for (let h = 0; h < 3; h++) front.push(at(-1, u, h));
  for (let k = 0; k <= 6; k++) for (let u = -1; u <= 1; u++) for (let h = 0; h < 4; h++) (k >= 4 ? trigger : cut).push(at(k, u, h));
  for (let u = -1; u <= 1; u++) for (let h = 0; h < 4; h++) dark.push(at(7, u, h));
  for (const k of [0, 3]) { for (const u of [-2, 2]) for (let h = 0; h < 4; h++) frame.push({ ...at(k, u, h), block: log }); for (let u = -2; u <= 2; u++) frame.push({ ...at(k, u, 4), block: log }); }
  const landing = { ...at(2, 0, 0), look: at(-4, 0, 1) };
  landing.x += 0.5; landing.z += 0.5;
  return { front, cut, dark, frame, trigger, landing };
}

// ---------------------------------------------------------------- one night's blocks
/**
 * Everything the game writes for one night: Map("x,y,z" -> block) where block is "id" or "id{states json}".
 * Order matters only in that later entries win; the game writes the map in one pass.
 * Returns { blocks, open, ore, tunnel, box }.
 */
export function nightPlan(cave, opts) {
  const it = nightPlanJob(cave, opts);
  for (;;) { const s = it.next(); if (s.done) return s.value; }
}
/** The same, as a generator for system.runJob: it yields between steps. */
export function* nightPlanJob(cave, { tierIndex = 0, region = "vale", night = 0, plot = "plot", groundY = 70, rate, front = [0, -1] } = {}) {
  const open = openAir(cave, tierIndex);
  yield;
  // the old mine: what it digs is open cave from now on
  const mine = mineLayout(cave, open, { region, front, tierIndex, castleTier: LEVELS.length - 1 });
  for (const k of mine.carve) open.add(k);
  yield;
  const blocks = new Map();
  // the rock skin, and every cave block the tier keeps shut, as rock; rubble where shut meets open
  for (const [k, b] of cave.skin) blocks.set(k, b);
  for (const k of cave.air) {
    if (open.has(k)) continue;
    const [x, y, z] = unkey(k);
    const face = N6.some(([dx, dy, dz]) => open.has(key(x + dx, y + dy, z + dz)));
    let b = face ? RUBBLE[Math.floor(hash(x, y, z) * RUBBLE.length)] : rockAt(groundY, y);
    if (b === "minecraft:gravel" && open.has(key(x, y - 1, z))) b = "minecraft:cobblestone"; // nothing falls out of a cave-in's roof
    blocks.set(k, b);
  }
  // a skin of rock round everything the mine dug, so a wall mined out of it comes back too
  for (const k of mine.carve) {
    const [x, y, z] = unkey(k);
    for (const [dx, dy, dz] of N6) {
      const n = key(x + dx, y + dy, z + dz);
      if (!open.has(n) && !blocks.has(n) && y + dy < 0) blocks.set(n, rockAt(groundY, y + dy));
    }
  }
  for (const k of open) blocks.set(k, "minecraft:air");
  yield;
  // the cave's plants, only in the open part
  for (const [k, b] of cave.dress) if (open.has(k) && !mine.carve.has(k)) blocks.set(k, dressBlock(b));
  for (const [k, b] of cave.skin) if (b === "minecraft:moss_block" || b === "minecraft:dripstone_block") blocks.set(k, b);
  // tonight's ore, in rock that shows on the open part (and a little behind it), never where the mine has built
  const budget = oreBudget(tierIndex, region, rate);
  const near = nearRock(cave, open, blocks);
  for (const k of mine.blocks.keys()) near.delete(k);
  yield;
  const { diamond = 0, ...rest } = budget;
  const ore = new Map(rollOre({ air: open, skin: near }, `${plot}:${night}`, rest, groundY));
  if (diamond) {
    const floorCity = LEVELS[2].floor, deepRock = new Map([...near].filter(([k]) => +k.split(",")[1] < floorCity));
    for (const [k, b] of rollOre({ air: open, skin: deepRock }, `${plot}:${night}:deep`, { diamond }, groundY)) if (!ore.has(k)) ore.set(k, b);
  }
  // the rock in its region's strata (ore goes in after, so the ore stays Mateo's count)
  for (const [k, b] of blocks) {
    if (b !== "minecraft:stone" && b !== "minecraft:deepslate") continue;
    const [x, y, z] = unkey(k);
    blocks.set(k, strataAt(region, b, x, y, z, groundY));
  }
  for (const [k, b] of ore) blocks.set(k, b);
  yield;
  for (const [k, b] of mine.blocks) blocks.set(k, b);
  // the door and the tunnel behind it: only once the Castle level is open
  const tunnel = tierIndex >= LEVELS.length - 1 ? tunnelPlan(cave, open) : null;
  yield;
  if (tunnel) {
    const wall = new Set();
    const cells = [...tunnel.tunnel, ...tunnel.trigger];
    for (const k of cells) {
      const [x, y, z] = unkey(k);
      for (const [dx, dy, dz] of N6) { const n = key(x + dx, y + dy, z + dz); if (!cave.air.has(n) && !mine.carve.has(n)) wall.add(n); }
    }
    for (const k of wall) blocks.set(k, strataAt(region, rockAt(groundY, +k.split(",")[1]), ...unkey(k), groundY));
    for (const k of cells) blocks.set(k, "minecraft:air");
    for (const k of tunnel.dark) blocks.set(k, DARK);
    // the old king's door: chiseled deepslate in a frame of polished deepslate, a soul lantern either side
    for (const k of tunnel.frame) if (!open.has(k)) blocks.set(k, "minecraft:polished_deepslate");
    for (const k of tunnel.door) blocks.set(k, DOOR);
    for (const k of tunnel.lamps) { const [x, y, z] = unkey(k); if (open.has(k) && !open.has(key(x, y - 1, z))) blocks.set(k, "minecraft:soul_lantern"); }
  }
  let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (const k of blocks.keys()) { const p = unkey(k); mn = mn.map((v, i) => Math.min(v, p[i])); mx = mx.map((v, i) => Math.max(v, p[i])); }
  return { blocks, open, ore, tunnel, way: mine.way, signs: mine.signs, rest: mine.rest, box: { min: { x: mn[0], y: mn[1], z: mn[2] }, max: { x: mx[0], y: mx[1], z: mx[2] } } };
}

// rock within two blocks of the open air (where ore may go)
function nearRock(cave, open, blocks) {
  const out = new Map();
  let frontier = [...open];
  for (let layer = 0; layer < 2; layer++) {
    const next = [];
    for (const k of frontier) {
      const [x, y, z] = unkey(k);
      for (const [dx, dy, dz] of N6) {
        const n = key(x + dx, y + dy, z + dz);
        if (open.has(n) || out.has(n)) continue;
        const b = blocks.get(n);
        if (b !== "minecraft:stone" && b !== "minecraft:deepslate") continue;
        if (Math.abs(x + dx) <= 2 && Math.abs(z + dz) <= 2 && y + dy > -SHAFT_DEPTH) continue; // never the shaft walls
        out.set(n, b); next.push(n);
      }
    }
    frontier = next;
  }
  return out;
}

/** The generator's dressing names as blocks with states. */
export function dressBlock(name) {
  const [, id, ...rest] = name.split(":");
  if (id === "glow_lichen") return `minecraft:glow_lichen${JSON.stringify({ multi_face_direction_bits: rest[0] === "up" ? 2 : 1 })}`;
  if (id === "pointed_dripstone") return `minecraft:pointed_dripstone${JSON.stringify({ dripstone_thickness: rest[0], hanging: rest[1] === "h" })}`;
  return `minecraft:${id}`;
}

/** "id" or "id{json}" -> [id, states] */
export function splitBlock(b) {
  const i = b.indexOf("{");
  return i < 0 ? [b, undefined] : [b.slice(0, i), JSON.parse(b.slice(i))];
}

/** Is a local position inside the cave's box (with a margin)? */
export const insideBox = (box, p, m = 2) => p.x >= box.min.x - m && p.x <= box.max.x + 1 + m && p.y >= box.min.y - m && p.y <= -1 + m && p.z >= box.min.z - m && p.z <= box.max.z + 1 + m;
