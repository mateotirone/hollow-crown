#!/usr/bin/env node
// Nothing in a rigid landmark design may float (Mateo 2026-11-14: every story build has to be perfect). Every block
// must join, by a face or an edge, something that reaches the design's ground layer (y 0 and 1 stand on the ground
// the game fills under it). map/structures/export_landmarks.py drops such blocks; this fails if designs_data.js was
// written without it. Drape designs follow each column's own ground and are checked on a real world instead
// (tools/sim_landmarks.py).
//   node tools/landmark-float-check.mjs     one line per design with floating blocks, exit 1 if any
import { DESIGNS } from "../Siege_Nights_BP/scripts/landmarks/designs_data.js";
import { cellsOf } from "../Siege_Nights_BP/scripts/landmarks/plan.js";

const N18 = [];
for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) { const s = Math.abs(a) + Math.abs(b) + Math.abs(c); if (s > 0 && s < 3) N18.push([a, b, c]); }
let bad = 0;
for (const [id, d] of Object.entries(DESIGNS)) {
  if ((d.mode ?? "rigid") !== "rigid" || d.sea || d.dry) continue;
  const solid = new Set();
  for (const [x, y, z, i] of cellsOf(d)) { const n = d.palette[i][0]; if (n !== "minecraft:air" && !n.includes("water")) solid.add(`${x},${y},${z}`); }
  const seen = new Set([...solid].filter((k) => +k.split(",")[1] <= 1)), todo = [...seen];
  while (todo.length) {
    const [x, y, z] = todo.pop().split(",").map(Number);
    for (const [a, b, c] of N18) { const k = `${x + a},${y + b},${z + c}`; if (solid.has(k) && !seen.has(k)) { seen.add(k); todo.push(k); } }
  }
  const fl = [...solid].filter((k) => !seen.has(k));
  if (fl.length) { bad++; console.log(`${id}: ${fl.length} floating, e.g. ${fl.slice(0, 3).join(" ")} (rerun map/structures/export_landmarks.py)`); }
}
process.exit(bad ? 1 : 0);
