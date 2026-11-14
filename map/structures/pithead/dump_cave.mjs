// The plot cave as the game writes it one night (Siege_Nights_BP/scripts/plotcaves/data.js nightPlan), for the 3D
// preview: only what a player can see (every block that is not rock, and the rock that faces the open cave), with
// the game's Bedrock states turned back into the building skill's logical ones for the mesher.
//   node dump_cave.mjs OUT.json plot:region:tier[:fx,fz] ...
import fs from "fs";
import { plotCave } from "../../../Siege_Nights_BP/scripts/caves/cavegen.js";
import { nightPlan, splitBlock } from "../../../Siege_Nights_BP/scripts/plotcaves/data.js";

const N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const WEIRDO = ["e", "w", "s", "n"], FD = { 2: "n", 3: "s", 4: "w", 5: "e" }, CARD = { north: "n", south: "s", east: "e", west: "w" };
const ROCK = /^minecraft:(stone|deepslate|andesite|diorite|granite|tuff|calcite|packed_ice|sandstone|smooth_sandstone|red_sandstone|smooth_red_sandstone|\w*terracotta|packed_mud|mud_bricks|clay|cobbled_deepslate|smooth_basalt|basalt|blackstone|mossy_cobblestone|cobblestone|gravel|moss_block|dripstone_block)$/;
function logical(b) {
  const [id, st = {}] = splitBlock(b);
  const n = id.replace("minecraft:", "") === "chain" ? "iron_chain" : id.replace("minecraft:", "");
  const p = {};
  if (st.pillar_axis) p.axis = st.pillar_axis;
  if (st.weirdo_direction !== undefined) p.facing = WEIRDO[st.weirdo_direction];
  if (st.facing_direction !== undefined && FD[st.facing_direction]) p.facing = FD[st.facing_direction];
  if (st["minecraft:cardinal_direction"]) p.facing = CARD[st["minecraft:cardinal_direction"]];
  if (st["minecraft:vertical_half"]) p.half = st["minecraft:vertical_half"];
  if (st.hanging) p.hanging = true;
  return [n, p];
}
const [out, ...jobs] = process.argv.slice(2);
const result = {};
for (const job of jobs) {
  const [plot, region, tier, f = "0,1"] = job.split(":");
  const front = f.split(",").map(Number);
  const cave = plotCave(plot, { region, groundY: 70 });
  const plan = nightPlan(cave, { tierIndex: +tier, region, night: 3, plot, front });
  const pal = [], idx = new Map(), blocks = [];
  for (const [k, b] of plan.blocks) {
    if (b === "minecraft:air") continue;
    const [x, y, z] = k.split(",").map(Number);
    if (y >= 0) continue;
    const rock = ROCK.test(splitBlock(b)[0]);
    if (rock && !N6.some(([dx, dy, dz]) => plan.blocks.get(`${x + dx},${y + dy},${z + dz}`) === "minecraft:air")) continue;
    const l = logical(b), s = JSON.stringify(l);
    if (!idx.has(s)) { idx.set(s, pal.length); pal.push(l); }
    blocks.push([x, y, z, idx.get(s)]);
  }
  result[job] = { palette: pal, blocks, way: plan.way.map((c) => [c.x, c.y, c.z]), signs: plan.signs, rest: plan.rest, door: !!plan.tunnel };
}
fs.writeFileSync(out, JSON.stringify(result));
console.log("dumped", jobs.length);
