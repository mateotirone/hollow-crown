// Hallowmere's drowned city: leaning towers standing in the marsh beside the light river where it ends
// at the Court landing, in view of the path to the Court. The towers are designed in
// map/structures/hollow_kit.py (TOWERS) and stamped by builder.js; here is only where they stand.
// Pure maths, no Minecraft calls.

import { UNDERTOW_LAYOUT as L } from "./layout.js";
import { heightAt } from "./terrain.js";
import { riverDistance } from "./rivers.js";
import { roadLines, siteAt } from "./roads.js";
import { hash } from "./noise.js";

// Where each tower stands: x, z, y = the ground (or water) top block under it, design = index into
// TOWER_DESIGNS. Off the water (boats must pass), off the roads, on low ground, never two close together.
export const DROWNED_SPOTS = [
  { x: -206, y: 68, z: 1452, design: 0 },
  { x: -188, y: 68, z: 1473, design: 1 },
  { x: -170, y: 68, z: 1470, design: 2 },
  { x: -209, y: 68, z: 1476, design: 3 },
  { x: -176, y: 66, z: 1449, design: 4 },
  { x: -134, y: 66, z: 1452, design: 5 },
  { x: -119, y: 68, z: 1476, design: 6 },
];

export const DROWNED_AREA = { x1: -215, z1: 1425, x2: -115, z2: 1505 };

function roadDistance(x, z) {
  let best = Infinity;
  for (const line of roadLines()) for (let i = 0; i + 1 < line.length; i++) {
    const [x1, z1] = line[i], [x2, z2] = line[i + 1], dx = x2 - x1, dz = z2 - z1;
    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(x - (x1 + dx * t), z - (z1 + dz * t)));
  }
  return best;
}

// No water under a tower's foot or its corbels (4 blocks round the middle): boats must still pass.
const dryFoot = (x, z) => {
  for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) if (riverDistance(x + dx, z + dz) < 4.5) return false;
  return true;
};

// The ground height a tower could stand on at x, z, or undefined when it may not stand there.
export function spotGround(x, z) {
  const h = heightAt(x, z);
  if (!(riverDistance(x, z) <= 20) || h == null || h > L.seaY + 6 || siteAt(x, z) || roadDistance(x, z) < 12 || !dryFoot(x, z)) return undefined;
  return Math.max(h, L.seaY);
}

let cache;
// The search behind DROWNED_SPOTS (about 40 ms, so the game uses the saved list and a test checks it): { x, y, z, design } with y the ground (or water) layer under it. Off the
// water (boats must pass), off the roads, on low ground, never two close together.
export function findDrownedSpots() {
  if (cache) return cache;
  const A = DROWNED_AREA, out = [];
  const cand = [];
  for (let x = A.x1; x <= A.x2; x += 3) for (let z = A.z1; z <= A.z2; z += 3) {
    const h = spotGround(x, z);
    if (h !== undefined) cand.push({ x, z, h, k: hash(x, z, 1212) });
  }
  cand.sort((a, b) => a.k - b.k);
  for (const c of cand) {
    if (out.some((o) => Math.hypot(o.x - c.x, o.z - c.z) < 13)) continue;
    out.push({ x: c.x, y: c.h, z: c.z, design: out.length });
    if (out.length >= 7) break;
  }
  cache = out;
  return out;
}
