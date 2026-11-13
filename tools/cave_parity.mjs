// The one cave generator has two halves: map/caves.py (the base map) and Siege_Nights_BP/scripts/caves/cavegen.js
// (caves the game builds: plot caves, later the Rift's rock). This checks both make the same noise.
// Run: node tools/cave_parity.mjs   (after changing either noise, refresh map/caves_parity.json from caves.py)
import { readFileSync } from "fs";
import { noise3, fbm3 } from "../Siege_Nights_BP/scripts/caves/cavegen.js";
const { points } = JSON.parse(readFileSync(new URL("../map/caves_parity.json", import.meta.url)));
let bad = 0;
for (const [x, y, z, s, n, f] of points) {
  const a = noise3(x / 37, y / 29, z / 37, s), b = fbm3(x / 37, y / 29, z / 37, s, 3);
  if (Math.abs(a - n) > 1e-4 || Math.abs(b - f) > 1e-4) { bad++; console.log("differs at", x, y, z, s, a, n, b, f); }
}
console.log(bad ? `CAVE PARITY FAILED (${bad} of ${points.length})` : `CAVE PARITY OK (${points.length} points)`);
process.exit(bad ? 1 : 0);
