// Design bounds of the starter village's buildings in every region, for map/structures/starter.py --sizes.
//   node sizes.mjs sizes.json      -> { "<region name>": { "<design>": [x0, x1, z0, z1] } }
import fs from "node:fs";
const S = new URL("../../Siege_Nights_BP/scripts/", import.meta.url).href;
const { drawBuilding } = await import(S + "settle/buildings.js");
const { REGION_TO_STYLE } = await import(S + "settle/config.js");
const out = {};
for (const [region, style] of Object.entries(REGION_TO_STYLE)) {
  out[region] = {};
  for (const id of ["cottage", "house", "library", "well"]) {
    try { const b = drawBuilding(id, style).bounds(); out[region][id] = [b.x0, b.x1, b.z0, b.z1]; } catch { /* not in this build */ }
  }
}
fs.writeFileSync(process.argv[2] ?? "sizes.json", JSON.stringify(out));
console.log(JSON.stringify(out.Saltreach));
