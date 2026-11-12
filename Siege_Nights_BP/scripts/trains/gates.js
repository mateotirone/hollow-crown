// Rail gates: whatever stands across the track (a town wall's gate bars, a portcullis, a wall built over the line)
// opens for a train and shuts again behind it. A player on foot never gets through (Mateo, 2026-11-12).
// The train runner calls openAhead() for the end of a moving train that's leading; every half second closeBehind()
// puts back the blocks of any gate no train is near any more, exactly as they were.

import { world, BlockPermutation } from "@minecraft/server";
import { moduleStore, onTick, isReady } from "../siege/api.js";
import { advance } from "./track.js";
import { TRACK } from "./data.js";

export const GATE = {
  lookAhead: 4, // blocks ahead of the train checked at a crawl; more when it's faster (speed x lookTicks)
  lookTicks: 10,
  height: 5, // cells from the track block up that the train needs clear (the engine with its chimney)
  closeDistance: 9, // a gate shuts once no car is this close to it
};

// gates: { "dim|x,y,z": { dim, cells: [{ x, y, z, id, states }] } } (keyed by the track block they stand over)
const store = moduleStore("siege:rail_gates", () => ({ gates: {} }));
const gates = () => store.data.gates;
const keyOf = (dimId, p) => `${dimId}|${p.x},${p.y},${p.z}`;

const clear = (b) => !b || b.isAir || b.isLiquid || b.typeId === TRACK;

// Open whatever stands in the train's way over the next few blocks of track ahead of cursor `c`
export function openAhead(dim, c, v, get) {
  const look = Math.min(24, Math.max(GATE.lookAhead, Math.ceil(Math.abs(v) * GATE.lookTicks)));
  const seen = new Set();
  for (let k = 1; k <= look; k++) {
    const r = advance(c, k, get);
    const p = r.cursor;
    const key = keyOf(dim.id, p);
    if (seen.has(key)) { if (r.blocked) break; continue; }
    seen.add(key);
    if (gates()[key]) continue; // already open
    const cells = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        for (let dy = 0; dy < GATE.height; dy++) {
          if (!dx && !dz && !dy) continue;
          let b;
          try {
            b = dim.getBlock({ x: p.x + dx, y: p.y + dy, z: p.z + dz });
          } catch {
            continue;
          }
          if (clear(b)) continue;
          cells.push({ x: b.location.x, y: b.location.y, z: b.location.z, id: b.typeId, states: b.permutation.getAllStates(), block: b });
        }
      }
    }
    if (cells.length) {
      for (const cell of cells) cell.block.setPermutation(BlockPermutation.resolve("minecraft:air"));
      gates()[key] = { dim: dim.id, cells: cells.map(({ block, ...rest }) => rest) };
      store.save();
    }
    if (r.blocked) break;
  }
}

// Close every gate with no train car near it, putting its blocks back
function closeBehind(cars) {
  let changed = false;
  for (const [key, g] of Object.entries(gates())) {
    const c = g.cells[0];
    if (cars.some((e) => e.dim === g.dim && Math.hypot(e.x - c.x, e.y - c.y, e.z - c.z) < GATE.closeDistance)) continue;
    let dim;
    try {
      dim = world.getDimension(g.dim);
    } catch {
      continue;
    }
    let done = true;
    for (const cell of g.cells) {
      try {
        const b = dim.getBlock(cell);
        if (!b) { done = false; continue; }
        if (b.isAir) b.setPermutation(BlockPermutation.resolve(cell.id, cell.states));
      } catch {
        done = false;
      }
    }
    if (done) { delete gates()[key]; changed = true; }
  }
  if (changed) store.save();
}

export const openGates = () => Object.keys(gates()).length;

// carsOf() -> [{ dim, x, y, z }] of every loaded train car: set by the runner (index.js) so this file needs no trains import
let carsOf = () => [];
export const watchCars = (fn) => { carsOf = fn; };
onTick("rail_gates", 10, () => {
  if (isReady() && Object.keys(gates()).length) closeBehind(carsOf());
});
