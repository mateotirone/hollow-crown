// Every block of the welcome hall (the cloud miniature over Gull Bay), as the game would build it, written to JSON so
// the hall can be built into a playtest world ahead of time. The game then finds its Waystone standing and takes the
// hall as it is (plots/welcome.js hallBakedAt) instead of building it while a newcomer waits.
//
//   node tools/hall_blocks.mjs OUT.json
// OUT.json: { origin: {x,y,z}, blocks: [[x, y, z, "id", {states} | null], ...] }  (later entries win)
import { writeFileSync } from "node:fs";
import { miniatureBlocks, miniSpot } from "../Siege_Nights_BP/scripts/plots/miniature.js";
import { PLOT_PLAN, REGION_BLOCK, WELCOME } from "../Siege_Nights_BP/scripts/plots/config.js";

const out = process.argv[2];
if (!out) throw new Error("usage: node tools/hall_blocks.mjs OUT.json");
const o = { ...WELCOME.hall };
const markers = PLOT_PLAN.map((plan) => {
  const s = miniSpot(plan);
  return { dx: s.dx, dz: s.dz, pedestal: REGION_BLOCK[plan.region] ?? "minecraft:stone_bricks" };
});
const blocks = [];
for (const _ of miniatureBlocks((x, y, z, id, states) => { blocks.push([x, y, z, id, states ?? null]); }, o, markers)) { /* each step */ }
writeFileSync(out, JSON.stringify({ origin: o, blocks }));
console.log(`${blocks.length} blocks, origin ${o.x} ${o.y} ${o.z}`);
