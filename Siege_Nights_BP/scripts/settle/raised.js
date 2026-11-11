// The Barracks and the Quartermaster's Desk raise their building when placed on your land (designs in
// blockdesigns.js), in your settlement's style, running away from where you stood. Free: the block is the
// price. No room (land edge, ground kept for your hall, another building rising)? The block still works on
// its own and says why. A build cut short by the world closing carries on when it loads again.
//
// Test: /scriptevent siege:block_build guardhouse|armoury [style]   raise one where you stand

import { world, system } from "@minecraft/server";
import { onTick, isReady, settlementAt, moduleStore, addTests, assert } from "../siege/api.js";
import { startBuild, buildFor } from "../townhall/build.js";
import { STYLES, STYLE_IDS } from "../townhall/styles.js";
import { styleFor } from "./buildings.js";
import { siteProblem, styleOf } from "./plans.js";
import { footprint } from "./rules.js";
import { levelSite, foundationColumns } from "./ground.js";
import { BLOCK_BUILDS } from "./blockdesigns.js";

const OVERWORLD = "minecraft:overworld";
// pending: { "x,y,z": { type, fx, fz, style } }
const store = moduleStore("siege:settle_raised", () => ({ pending: {} }));
const keyOf = (l) => `${l.x},${l.y},${l.z}`;
const locOf = (k) => { const [x, y, z] = k.split(",").map(Number); return { x, y, z }; };
const cardinal = (v) => (Math.abs(v.x) > Math.abs(v.z) ? { x: Math.sign(v.x) || 1, z: 0 } : { x: 0, z: Math.sign(v.z) || 1 });

const plans = new Map();
const planFor = (type, style) => {
  const key = `${type}|${style}`;
  if (!plans.has(key)) plans.set(key, BLOCK_BUILDS[type].draw(style));
  return plans.get(key);
};

function start(key, job) {
  if (buildFor(`raised:${key}`)) return;
  const plan = planFor(job.type, job.style);
  const at = locOf(key);
  const forward = { x: job.fx, z: job.fz };
  // on the highest ground under it, never half buried (ground.js); measured once so a restart keeps the height.
  // The block itself stays where it was placed and the building leaves it alone.
  if (!Number.isFinite(job.lift)) { job.lift = levelSite(world.getDimension(OVERWORLD), plan, at, forward).lift; store.save(); }
  startBuild({
    id: `raised:${key}`, dimensionId: OVERWORLD, origin: { ...at, y: at.y + job.lift }, forward,
    plan, style: styleFor(job.style), perTick: Math.max(4, Math.ceil(plan.cells.size / 300)),
    skip: (x, y, z) => x === at.x && y === at.y && z === at.z,
    onDone() { delete store.data.pending[key]; store.save(); },
  }).columns.unshift(...foundationColumns(plan));
}

world.afterEvents.playerPlaceBlock.subscribe(({ block, player }) => {
  const build = BLOCK_BUILDS[block.typeId];
  if (!build || !isReady() || block.dimension.id !== OVERWORLD) return;
  const owner = settlementAt(block.location);
  if (!owner) return; // Siege Nights has already refused it off your land
  const f = cardinal(player.getViewDirection());
  let style = "vale";
  try { style = styleOf(owner, block); } catch { /* no hall or plot: Vale */ }
  const key = keyOf(block.location);
  const box = footprint(block.location, f, planFor(block.typeId, style).bounds());
  const problem = siteProblem(owner, box);
  if (problem) return player.sendMessage(`§7No room for a ${build.name} here: ${problem} §8The block works on its own.`);
  store.data.pending[key] = { type: block.typeId, fx: f.x, fz: f.z, style };
  store.save();
  start(key, store.data.pending[key]);
  player.sendMessage(`§6A ${build.name} is going up behind it.`);
});

onTick("settle_raised", 200, () => {
  if (!isReady()) return;
  for (const [key, job] of Object.entries(store.data.pending)) start(key, job);
});

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "siege:block_build") return;
  const player = event.sourceEntity;
  if (player?.typeId !== "minecraft:player" || !isReady()) return;
  const [name, style = "vale"] = event.message.trim().split(/\s+/);
  const type = Object.keys(BLOCK_BUILDS).find((t) => BLOCK_BUILDS[t].name === name);
  if (!type || !STYLES[style]) return player.sendMessage(`§7Builds: ${Object.values(BLOCK_BUILDS).map((b) => b.name).join(", ")}. Styles: ${STYLE_IDS.join(", ")}.`);
  const at = { x: Math.floor(player.location.x), y: Math.floor(player.location.y), z: Math.floor(player.location.z) };
  startBuild({ id: `raised:test:${keyOf(at)}`, dimensionId: player.dimension.id, origin: at, forward: cardinal(player.getViewDirection()),
    plan: planFor(type, style), style: styleFor(style), perTick: 40 });
});

addTests("settle", {
  "the Barracks and Quartermaster's buildings draw in every style behind their block": () => {
    for (const type of Object.keys(BLOCK_BUILDS)) for (const id of STYLE_IDS) {
      const plan = BLOCK_BUILDS[type].draw(id);
      for (const c of plan.cells.values()) assert(plan.style.roles[c.role], `${type} (${id}) uses unknown role ${c.role}`);
      assert(!plan.get(0, 1, 0), `${type} must leave its block's spot free`);
      const b = plan.bounds();
      assert((b.x1 - b.x0 + 1) % 2 === 1, `${type} has an odd width`);
    }
  },
});
