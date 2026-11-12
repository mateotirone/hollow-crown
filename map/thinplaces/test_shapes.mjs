// Checks for the thin places' land (run by tools/check.mjs): every place, on level ground, on a slope and on low
// wet ground, must hold its own water, keep water off its cave floor, and give the game enough probes to know it.
//   node map/thinplaces/test_shapes.mjs
import { shapeGrid } from "./shape_grid.mjs";

const SITES = { kings_barrow: "east", bellfounders_mine: "west", frostvein_hollow: "north", drowned_chapel: "west", witchroot_caves: "north", saltglass_grotto: "north", sunken_quarry: "east" };
const rad = 100, N = 2 * rad + 1;
const LANDS = {
  level: () => 80,
  "a slope": (dx, dz) => 80 + Math.round(dx * 0.06 - dz * 0.04),
  "rolling ground": (dx, dz) => 80 + Math.round(3 * Math.sin(dx / 17) + 2 * Math.cos(dz / 11)),
};
const problems = [];
for (const [id, facing] of Object.entries(SITES)) for (const [name, land] of Object.entries(LANDS)) {
  const heights = [], water = [], keep = [];
  for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) { heights.push(land(dx, dz)); water.push(-999); keep.push(0); }
  const o = shapeGrid({ id, facing, rad, heights, water, keep });
  const say = (m) => problems.push(`${id} on ${name}: ${m}`);
  const H = o.heights, W = o.water;
  // 1. water is held: no dry column lies under the water of a column beside it (it would pour out the first time a block changes)
  let spill = 0;
  for (let a = 1; a < N - 1; a++) for (let b = 1; b < N - 1; b++) { const i = a * N + b; if (W[i] > -999) continue; for (const j of [i + 1, i - 1, i + N, i - N]) if (W[j] > H[i]) { spill++; break; } }
  if (spill) say(`${spill} dry columns lie under the water next to them`);
  if (o.leaks > 40) say(`${o.leaks} columns had to be flooded to hold the water (the shape should hold it itself)`);
  // 2. the cave floor (one above `floor`) is never under water that stands near the mouth
  const [ox, oz] = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] }[facing];
  for (let u = -12; u <= 12; u++) for (let v = -30; v <= 14; v++) { const dx = u * oz + v * ox, dz = -u * ox + v * oz, w = W[(dx + rad) * N + dz + rad]; if (w > o.floor) { say(`water at ${w} stands over the cave (floor ${o.floor}) at u ${u}, v ${v}`); u = 99; break; } }
  // 3. the game can tell the shaped land from the old
  if (o.probes.length < 3) say(`only ${o.probes.length} probes`);
  // 4. every block has a name and sits inside the square
  for (const [dx, , dz, p] of o.blocks) if (!o.palette[p]?.name || Math.abs(dx) > rad || Math.abs(dz) > rad) { say("a bad block entry"); break; }
}
for (const p of problems) console.log(p);
if (problems.length) process.exit(1);
console.log(`${Object.keys(SITES).length} places on ${Object.keys(LANDS).length} kinds of ground: water held, cave floors dry, probes found`);
