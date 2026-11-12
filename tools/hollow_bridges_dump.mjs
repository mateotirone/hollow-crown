// Dump every place a Hollow road or the story path is carried over a river or a valley (columnAt().under),
// with the columns around it, for tools/hollow_bridges.py. Pure: reads the terrain generator, no Minecraft.
//   node tools/hollow_bridges_dump.mjs OUT.json
import fs from "node:fs";
import { columnAt } from "../Siege_Nights_BP/scripts/undertow/terrain.js";
import { UNDERTOW_LAYOUT as L } from "../Siege_Nights_BP/scripts/undertow/layout.js";
import { RIVER_HALF_WIDTH } from "../Siege_Nights_BP/scripts/undertow/rivers.js";

const R = L.reach, Z1 = 2600, M = 10;
const under = [];
for (let z = -50; z < Z1; z++) for (let x = -R; x <= R; x++) {
  const c = columnAt(x, z);
  if (c && c.under !== undefined) under.push([x, z]);
}
// group 8-joined, then dump the box around each group with a margin
const key = (x, z) => `${x},${z}`, set = new Set(under.map(([x, z]) => key(x, z))), seen = new Set(), groups = [];
for (const [x0, z0] of under) {
  if (seen.has(key(x0, z0))) continue;
  const g = [], todo = [[x0, z0]]; seen.add(key(x0, z0));
  while (todo.length) {
    const [x, z] = todo.pop(); g.push([x, z]);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const k = key(x + a, z + b);
      if (set.has(k) && !seen.has(k)) { seen.add(k); todo.push([x + a, z + b]); }
    }
  }
  const xs = g.map((p) => p[0]), zs = g.map((p) => p[1]);
  const box = [Math.min(...xs) - M, Math.min(...zs) - M, Math.max(...xs) + M, Math.max(...zs) + M];
  const cells = [];
  for (let x = box[0]; x <= box[2]; x++) for (let z = box[1]; z <= box[3]; z++) {
    const c = columnAt(x, z);
    if (!c) continue;
    // [x, z, h, under|null, paved 0/1, on road 0/1, river water 0/1, narrow 0/1]
    cells.push([x, z, c.h, c.under ?? null, c.paved ? 1 : 0, c.road !== undefined ? 1 : 0, c.river <= RIVER_HALF_WIDTH ? 1 : 0, c.lamps === false ? 1 : 0]);
  }
  groups.push({ box, under: g.length, cells });
}
fs.writeFileSync(process.argv[2], JSON.stringify({ sea: L.seaY, groups }));
console.log(`${groups.length} crossings, ${under.length} carried columns`);
