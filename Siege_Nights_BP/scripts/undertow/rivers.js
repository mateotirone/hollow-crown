// The light rivers: one connected network of real, boatable water that links the Wound, the four
// mining villages, the Court approach and the Seat approach. Every river is at the same water
// level (UNDERTOW_LAYOUT.seaY), so there are no drops and a boat can go from any landing to any other.
// Pure maths, no Minecraft calls. The terrain generator carves the land down to these lines.
//
// Other threads: put things on the banks with RIVER_NODES (the landings) and riverNear(x, z).

import { value } from "./noise.js";

// Landings. The village names are the Hollow world thread's; they build the villages on the banks.
export const RIVER_NODES = [
  { id: "wound", name: "The Wound landing", x: -60, z: 130 },
  { id: "glimwade", name: "Glimwade", x: -380, z: 330, village: true },
  { id: "lowseam", name: "Lowseam", x: 390, z: 540, village: true },
  { id: "tollrest", name: "Tollrest", x: -400, z: 1180, village: true },
  { id: "highcut", name: "Highcut", x: 440, z: 1250, village: true },
  { id: "court", name: "The Court approach", x: -100, z: 1470 },
  { id: "seat", name: "The Seat approach", x: -95, z: 2230 },
  // Bends and forks (no landing)
  { id: "j_west", x: -260, z: 650 },
  { id: "j_east", x: 250, z: 655 },
  { id: "j_bells", x: -310, z: 1440 },
  { id: "seal_s", x: -420, z: 1560 },
  { id: "seal_n", x: -420, z: 1700 },
  { id: "j_climb", x: -340, z: 2040 },
];

// [from, to, how far the river may wander off the straight line]
const EDGES = [
  ["wound", "glimwade", 26],
  ["glimwade", "j_west", 34],
  ["j_west", "j_east", 10], // crosses the Spine under a bridge on the story path
  ["j_east", "lowseam", 22],
  ["lowseam", "highcut", 40],
  ["j_west", "tollrest", 40],
  ["tollrest", "j_bells", 26],
  ["j_bells", "court", 16],
  ["j_bells", "seal_s", 12],
  ["seal_s", "seal_n", 0], // straight through the sealed wall (a water gate opens with the Court gate)
  ["seal_n", "j_climb", 30],
  ["j_climb", "seat", 20],
];
export const SEAL_RIVER_X = -420;

export const RIVER_HALF_WIDTH = 3.5; // 7 blocks of water across
const REACH = 96; // past this distance a river no longer shapes the land

const node = (id) => RIVER_NODES.find((n) => n.id === id);
const SEGS = [];
EDGES.forEach(([a, b, amp], e) => {
  const A = node(a), Bn = node(b);
  const dx = Bn.x - A.x, dz = Bn.z - A.z, len = Math.hypot(dx, dz);
  const n = Math.max(1, Math.ceil(len / 20));
  const px = -dz / len, pz = dx / len; // sideways
  let prev = [A.x, A.z];
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const off = amp * Math.sin(Math.PI * t) * (value(i / 2.5, e * 7.3, 500) - 0.5) * 2;
    const p = [A.x + dx * t + px * off, A.z + dz * t + pz * off];
    SEGS.push([prev[0], prev[1], p[0], p[1]]);
    prev = p;
  }
});
export const riverSegments = () => SEGS;

// Segments close enough to matter, remembered per 32x32 area so a lookup only checks a handful.
const near = new Map();
function segsNear(x, z) {
  const gx = x >> 5, gz = z >> 5, key = gx * 4096 + gz;
  let list = near.get(key);
  if (list) return list;
  const mx = gx * 32 + 16, mz = gz * 32 + 16, r = REACH + 24;
  list = SEGS.filter(([x1, z1, x2, z2]) => Math.min(x1, x2) - r <= mx && Math.max(x1, x2) + r >= mx && Math.min(z1, z2) - r <= mz && Math.max(z1, z2) + r >= mz);
  if (near.size > 400) near.clear();
  near.set(key, list);
  return list;
}

// Distance from a block to the middle of the nearest river, or Infinity when none is near.
export function riverDistance(x, z) {
  let best = Infinity;
  for (const [x1, z1, x2, z2] of segsNear(x, z)) {
    const dx = x2 - x1, dz = z2 - z1;
    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / (dx * dx + dz * dz)));
    const d = Math.hypot(x - (x1 + dx * t), z - (z1 + dz * t));
    if (d < best) best = d;
  }
  return best <= REACH ? best : Infinity;
}

// For placing things on the banks: how far the water is, and the nearest landing.
export function riverNear(x, z) {
  let landing, far = Infinity;
  for (const n of RIVER_NODES) {
    if (!n.name) continue;
    const d = Math.hypot(x - n.x, z - n.z);
    if (d < far) { far = d; landing = n; }
  }
  return { distance: riverDistance(x, z), landing, landingDistance: far };
}
