// The bosses' own site plan (unlocks/plans.js) run on the real map ground, for boss_area_preview.py.
//   node map/structures/boss_area_plans.mjs HEIGHTS WATER site > plan.json
import { readFileSync } from "node:fs";
const [hp, wp, site] = process.argv.slice(2);
const U = new URL("../../Siege_Nights_BP/scripts/unlocks", import.meta.url).href;
const P = await import(U + "/plans.js"), Z = await import(U + "/puzzles.js");
function npy(path) { const b = readFileSync(path); const hl = b.readUInt16LE(8); const hd = b.toString("latin1", 10, 10 + hl);
  const shape = hd.match(/\((\d+), (\d+)\)/).slice(1).map(Number); const data = new Int16Array(b.buffer.slice(b.byteOffset + 10 + hl, b.byteOffset + b.length));
  return (x, z) => data[(x + 1264) * shape[1] + (z + 1264)]; }
const H = npy(hp), W = npy(wp);
const probe = (x, z) => { const g = H(x, z), w = W(x, z); return { top: w > -999 ? w : g, ground: g, water: w > -999 ? w : undefined }; };
const run = (gen) => { let r; do { r = gen.next(); } while (!r.done); return r.value; };
if (site === "reeve") { process.stdout.write(JSON.stringify({ center: [-60, 79, -470], info: null, ops: [] })); process.exit(0); }   // Millbrook square (reeve.js builds the well itself)
const A = { huntsman: [60, -1130], bride: [-690, 130], seneschal: [850, 590], mother: [-120, 1060], mirelight: [-60, 900] }[site];
const anchor = { x: A[0], z: A[1] };
const r = { huntsman: () => P.huntPlan(probe, anchor, Z.makeHunt(7)), bride: () => P.chapelPlan(probe, anchor, Z.makePews(7)),
  seneschal: () => P.vaultPlan(probe, anchor), mother: () => P.cradlePlan(probe, anchor), mirelight: () => P.mirelightPlan(probe, anchor, Z.VILLAGERS) }[site];
const v = run(r());
process.stdout.write(JSON.stringify({ center: [v.center.x, v.center.y, v.center.z], info: v.info ?? null, ops: v.ops.map((o) => [o.dx, o.dy, o.dz, o.block.replace("minecraft:", ""), o.states ?? null]) }));
