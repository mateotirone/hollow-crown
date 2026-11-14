// The Barracks and the Quartermaster's Desk raise their building when placed on your land (designs in
// blockdesigns.js), in your settlement's style, running away from where you stood. Free: the block is the
// price. No room (land edge, ground kept for your hall, another building rising)? The block still works on
// its own and says why. A build cut short by the world closing carries on when it loads again.
// A yard (the Barracks) fits the ground it lands on (Mateo 2026-11-12: "it doesn't have to be a perfect square,
// match the landscaping where the paths are"): where a town path already crosses the yard wall, that stretch of
// wall is left out so the path runs in, and the path's own surface is kept through the yard floor.
//
// Test: /scriptevent siege:block_build guardhouse|armoury [style]   raise one where you stand

import { world, system, GameMode, ItemStack } from "@minecraft/server";
import { onTick, on, isReady, settlementAt, moduleStore, addTests, assert, emit, addFilter, keepOf, trackMachine } from "../siege/api.js";
import { COLORS } from "../siege/constants.js";
import { startBuild, buildFor, worldMarks } from "../townhall/build.js";
import { STYLES, STYLE_IDS } from "../townhall/styles.js";
import { styleFor } from "./buildings.js";
import { siteProblem, styleOf } from "./plans.js";
import { footprint } from "./rules.js";
import { levelSite, foundationColumns, groundTop, Groundwork } from "./ground.js";
import { frameFor, toWorld } from "../townhall/halls.js";
import { BLOCK_BUILDS } from "./blockdesigns.js";

const OVERWORLD = "minecraft:overworld";
// pending: { "x,y,z": { type, fx, fz, style, owner } }   built: the same, once standing, plus box (its footprint)
const store = moduleStore("siege:settle_raised", () => ({ pending: {}, built: {} }));
// The raised buildings that stand: [{ at: {x, y, z}, type, name, forward: {x, z}, box: {x0, z0, x1, z1}, floor }]
// (guard posts use these; a building whose block was broken drops out when the block is gone)
export function raisedBuildings() {
  return Object.entries(store.data.built ?? {}).map(([key, b]) => ({
    at: locOf(key), type: b.type, name: BLOCK_BUILDS[b.type]?.name ?? "building", forward: { x: b.fx, z: b.fz }, box: b.box, floor: locOf(key).y + (b.lift ?? 0),
  }));
}
export function forgetRaised(key) { if (store.data.built?.[key]) { delete store.data.built[key]; store.save(); } }

// Finished block buildings on a settlement's land, by building id ("siege:barracks" -> "barracks").
// rising: count the ones still going up too (the one-of-each rule, oneeach.js)
export function raisedCounts(owner, { rising = false } = {}) {
  const out = {};
  const all = [...Object.values(store.data.built ?? {}), ...(rising ? Object.values(store.data.pending ?? {}) : [])];
  for (const b of all) if (b.owner && b.owner === owner && !b.plot) { // (a plot-built one counts as its plot)
    const id = b.type.replace(/^siege:/, ""); out[id] = (out[id] ?? 0) + 1; }
  return out;
}
// The raising blocks of this type on a settlement's land, built or going up: ["x,y,z"] (oneeach.js checks they still stand)
export const raisedKeys = (owner, type) => ["built", "pending"].flatMap((k) => Object.entries(store.data[k] ?? {})
  .filter(([, b]) => b.owner === owner && b.type === type && !b.plot).map(([key]) => key));
// A raising block that is gone without a break event (blown up, /setblock): forget it
export function forgetRaisedBlock(key) {
  let changed = false;
  for (const k of ["built", "pending"]) if (store.data[k]?.[key]) { delete store.data[k][key]; changed = true; }
  if (changed) store.save();
}
const keyOf = (l) => `${l.x},${l.y},${l.z}`;
const locOf = (k) => { const [x, y, z] = k.split(",").map(Number); return { x, y, z }; };
const cardinal = (v) => (Math.abs(v.x) > Math.abs(v.z) ? { x: Math.sign(v.x) || 1, z: 0 } : { x: 0, z: Math.sign(v.z) || 1 });

const plans = new Map();
const planFor = (type, style) => {
  const key = `${type}|${style}`;
  if (!plans.has(key)) plans.set(key, BLOCK_BUILDS[type].draw(style));
  return plans.get(key);
};

// A path surface on the ground: town streets are sunken slabs, lanes and verges dirt path or gravel
export const PATH_TOP = /^minecraft:(grass_path|dirt_path|gravel|\w+_slab)$/;

// Where a path meets the yard: { cells: Set("x,y,z" world), cols: Set("x,z" plan) } of the yard wall columns and
// yard floor blocks to leave out. Only on a level site (lift 0 or 1): a raised yard can't meet the path anyway.
// isPath(x, z) -> true when the world column's top ground is a path (worldTop, from the plan's floor row up 3).
export function yardGaps(plan, origin, forward, lift, isPath) {
  const cells = new Set(), cols = new Set();
  if (!plan.yard || Math.abs(lift ?? 0) > 1) return { cells, cols };
  const frame = frameFor(forward);
  const at = (x, y, z) => { const w = toWorld(frame, origin, x, y, z); return `${w.x},${w.y},${w.z}`; };
  for (const [x, z] of plan.yard.wall) {
    const w = toWorld(frame, origin, x, 0, z);
    if (!isPath(w.x, w.z)) continue;
    cols.add(`${x},${z}`);
    for (const c of plan.cells.values()) if (c.x === x && c.z === z) cells.add(at(c.x, c.y, c.z));
  }
  for (const [x, z] of plan.yard.floor) {
    const w = toWorld(frame, origin, x, 0, z);
    if (isPath(w.x, w.z)) { cols.add(`${x},${z}`); cells.add(at(x, 0, z)); }
  }
  return { cells, cols };
}

function pathAt(dim, from) {
  return (x, z) => {
    const y = groundTop(dim, x, z, from);
    if (y === undefined) return false;
    try { return PATH_TOP.test(dim.getBlock({ x, y, z })?.typeId ?? ""); } catch { return false; }
  };
}

// The banner over the gate and the keep's flags are white wool in the design; once the building stands they take
// the settlement's banner colour (the Keep Banner's, the same index the soldiers wear).
export const woolFor = (color) => (Number.isInteger(color) && COLORS[color] ? `minecraft:${COLORS[color]}_wool` : undefined);
function colourCloth(dim, plan, origin, forward, owner) {
  const wool = woolFor(owner ? keepOf(owner)?.color : undefined);
  if (!wool || wool === "minecraft:white_wool") return;
  const frame = frameFor(forward);
  for (const c of plan.cells.values()) {
    if (c.role === "air") continue;
    try {
      const b = dim.getBlock(toWorld(frame, origin, c.x, c.y, c.z));
      if (b?.typeId === "minecraft:white_wool") b.setType(wool);
    } catch { /* unloaded: stays white */ }
  }
}

function start(key, job) {
  if (buildFor(`raised:${key}`)) return;
  const plan = planFor(job.type, job.style);
  const at = locOf(key);
  const forward = { x: job.fx, z: job.fz };
  // on a terraformed pad, never half buried (ground.js); measured once so a restart keeps the height (and skips
  // the regrading, which was done the first time).
  // The block itself stays where it was placed and the building leaves it alone.
  const dim = world.getDimension(OVERWORLD);
  const fresh = !Number.isFinite(job.lift);
  if (fresh) { job.lift = levelSite(dim, plan, at, forward, { terraform: true }).lift; store.save(); }
  const origin = { ...at, y: at.y + job.lift };
  const gaps = yardGaps(plan, origin, forward, job.lift, pathAt(dim, origin.y + 2));
  const b = startBuild({
    id: `raised:${key}`, dimensionId: OVERWORLD, origin: { ...at, y: at.y + job.lift }, forward,
    plan, style: styleFor(job.style), perTick: Math.max(4, Math.ceil(plan.cells.size / 300)),
    ...(fresh ? { ground: new Groundwork(plan, origin, forward, job.style) } : {}),
    skip: (x, y, z) => (x === at.x && y === at.y && z === at.z) || gaps.cells.has(`${x},${y},${z}`),
    onDone() {
      colourCloth(dim, plan, origin, forward, job.owner);
      delete store.data.pending[key];
      (store.data.built ??= {})[key] = { ...job, box: footprint(at, forward, plan.bounds()) };
      store.save();
      if (job.owner) emit("settleCharter", { owner: job.owner });
    },
  });
  b.columns.unshift(...foundationColumns(plan));
  if (gaps.cols.size) b.columns = b.columns.filter((c) => !gaps.cols.has(`${c.x},${c.z}`));
}

// A Barracks raised on a plot from its Plot Marker (or a Foundation Stone): the working Barracks block goes at its
// front, where a placed block would have stood, and the guardhouse is remembered like a block-raised one (its yard
// for the off-duty soldiers, guard posts) without counting twice for the charter (plot: the plot counts it).
on("settleBuilt", ({ owner, building, style, origin, forward, box }) => {
  if (building !== "barracks") return;
  const dim = world.getDimension(OVERWORLD);
  try { dim.getBlock(origin)?.setType("siege:barracks"); } catch { return; }
  trackMachine(OVERWORLD, origin, "siege:barracks");
  (store.data.built ??= {})[keyOf(origin)] = { type: "siege:barracks", fx: forward.x, fz: forward.z, style, owner, box, lift: 0, plot: true };
  store.save();
  const player = world.getPlayers().find((p) => p.id === owner);
  player?.sendMessage("§6Your Barracks stands.§7 Click the Barracks block at its front and choose §fTrain soldiers§7: 40 Regals each, and a Hamlet keeps 4.");
});

// Asked before a placed block raises anything: (owner, typeId, "x,y,z") -> why not, or undefined (oneeach.js: one of
// each special building per settlement). Refused, the block comes back out and goes back in the player's pack.
let raiseCheck = () => undefined;
export const useRaiseCheck = (fn) => { raiseCheck = fn; };

world.afterEvents.playerPlaceBlock.subscribe(({ block, player }) => {
  const build = BLOCK_BUILDS[block.typeId];
  if (!build || !isReady() || block.dimension.id !== OVERWORLD) return;
  const owner = settlementAt(block.location);
  if (!owner) return; // Siege Nights has already refused it off your land
  const refused = raiseCheck(owner, block.typeId, keyOf(block.location));
  if (refused) {
    const typeId = block.typeId;
    block.setType("minecraft:air");
    if (player.getGameMode() !== GameMode.Creative) player.getComponent("minecraft:inventory")?.container?.addItem(new ItemStack(typeId, 1));
    return player.sendMessage(refused);
  }
  const f = cardinal(player.getViewDirection());
  let style = "vale";
  try { style = styleOf(owner, block); } catch { /* no hall or plot: Vale */ }
  const key = keyOf(block.location);
  const box = footprint(block.location, f, planFor(block.typeId, style).bounds());
  const problem = siteProblem(owner, box);
  if (problem) {
    const bb = planFor(block.typeId, style).bounds();
    return player.sendMessage(`§7No room for a ${build.name} here: ${problem} §7It needs open ground ${bb.x1 - bb.x0 + 1} wide and ${bb.z1 - bb.z0 + 1} deep beyond the block, the way you face. Break it and set it down somewhere clearer. §8The block works on its own meanwhile.`);
  }
  store.data.pending[key] = { type: block.typeId, fx: f.x, fz: f.z, style, owner };
  store.save();
  start(key, store.data.pending[key]);
  player.sendMessage(`§6A ${build.name} is going up behind it.`);
});

// The Barracks yard in world coordinates, for the army's off-duty soldiers (army/idle.js applies "barracksYard"):
// the design's yard_a and yard_b marks turned the way this Barracks was raised. barracks = the block's position.
export function yardOf(barracks) {
  const b = store.data.built?.[keyOf(barracks)] ?? store.data.pending?.[keyOf(barracks)];
  if (!b || !BLOCK_BUILDS[b.type]) return undefined;
  const plan = planFor(b.type, b.style);
  if (!plan.marks.yard_a || !plan.marks.yard_b) return undefined;
  const m = worldMarks(plan, { ...barracks, y: barracks.y + (b.lift ?? 0) }, { x: b.fx, z: b.fz });
  return { a: { x: m.yard_a.x, z: m.yard_a.z }, b: { x: m.yard_b.x, z: m.yard_b.z }, muster: m.muster };
}
addFilter("barracksYard", (yard, { barracks } = {}) => (barracks && yardOf(barracks)) || yard);

// Breaking the block takes the building off the charter count (the walls stay, it is only a house then)
world.afterEvents.playerBreakBlock.subscribe(({ block, brokenBlockPermutation }) => {
  if (!BLOCK_BUILDS[brokenBlockPermutation?.type?.id]) return;
  const key = keyOf(block.location);
  if (!store.data.built?.[key]) return;
  delete store.data.built[key];
  store.save();
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
  "a path crossing the Barracks yard wall opens a gap there, and only on a level site"() {
    const plan = BLOCK_BUILDS["siege:barracks"].draw("vale");
    assert(plan.yard?.wall?.length && plan.yard.floor.length, "the Barracks design carries its yard columns");
    const origin = { x: 0, y: 64, z: 0 }, forward = { x: 0, z: 1 };
    const [wx, wz] = plan.yard.wall[0];
    const frame = frameFor(forward), w = toWorld(frame, origin, wx, 0, wz);
    const isPath = (x, z) => x === w.x && z === w.z;
    const g = yardGaps(plan, origin, forward, 0, isPath);
    assert(g.cols.has(`${wx},${wz}`) && g.cells.size > 0, "the wall column on the path is left out");
    assert(yardGaps(plan, origin, forward, 4, isPath).cells.size === 0, "a raised yard keeps its whole wall");
    assert(yardGaps(plan, origin, forward, 0, () => false).cells.size === 0, "no path, no gap");
  },
  "the gate banner takes the settlement colour"() {
    assert(woolFor(14) === "minecraft:red_wool" && woolFor(0) === "minecraft:white_wool" && woolFor(undefined) === undefined, "colour index to wool");
  },
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
