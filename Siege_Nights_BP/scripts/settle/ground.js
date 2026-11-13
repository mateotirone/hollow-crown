// Every raised building stands on levelled ground, never half buried. By default the floor goes on the highest
// ground block the footprint covers, and every lower column is filled with the region's foundation stone down to
// the ground (the build engine's column stage does the filling, so it rises with the rest of the animation).
// With { terraform: true } (Mateo 2026-11-13, the one terraform pass, terraform.js) the floor balances cutting in
// against building up, at most 3 under the highest block, and a Groundwork stage cuts the pad and blends the land
// round it (a soft slope out to 6 blocks, a retaining wall where it can't meet) before the footings go in, and holds
// a landing 4 out and 3 wide in front of the door level with the floor.
//
//   levelSite(dim, plan, origin, forward, opts?) -> { origin, lift }   origin moved to the floor (lift = blocks up)
//   foundationColumns(plan) -> columns to add to a build job (every footprint column, filled down to ground)
//   new Groundwork(plan, origin, forward, region) -> a build job's ground stage (startBuild({ ..., ground }))

import { BlockPermutation } from "@minecraft/server";
import { frameFor, toWorld } from "../townhall/halls.js";
import { isNatural } from "../trains/routes.js";
import { padHeight, solve, blocks, site, REGION } from "./terraform.js";

const NOT_GROUND = /(air|water|lava|grass(?!_block|_path)|fern|flower|snow_layer|leaves|vine|bush|sapling|tallgrass|seagrass|kelp|dandelion|poppy|mushroom|lily|_log$|_wood$|deadbush|torch|lantern|sign|banner|carpet|rail)/;
export const MAX_LIFT = 12; // a cliff in the corner of a plot doesn't put the building on stilts in the sky

// The top ground block of a column, or undefined when it isn't loaded
export function groundTop(dim, x, z, from) {
  try {
    let block = from === undefined ? dim.getTopmostBlock({ x, z }) : dim.getBlock({ x, y: from, z });
    for (let i = 0; block && i < 64 && NOT_GROUND.test(block.typeId); i++) block = block.below();
    return block ? block.location.y : undefined;
  } catch {
    return undefined;
  }
}

// Plan footprint columns in plan coordinates (x, z over its bounds)
function* footprint(plan) {
  const b = plan.bounds();
  for (let x = b.x0; x <= b.x1; x++) for (let z = b.z0; z <= b.z1; z++) yield [x, z];
}

// The floor (plan y = 0, world origin.y - 1) goes on the highest ground block under the footprint
export function levelSite(dim, plan, origin, forward, { terraform = false } = {}) {
  const frame = frameFor(forward);
  const ceiling = origin.y - 1 + MAX_LIFT;
  let high;
  const tops = [];
  for (const [x, z] of footprint(plan)) {
    const at = toWorld(frame, origin, x, 0, z);
    const top = groundTop(dim, at.x, at.z, ceiling + 1);
    if (top !== undefined) tops.push(Math.min(ceiling, top));
    if (top !== undefined && (high === undefined || top > high)) high = top;
  }
  if (high === undefined) return { origin, lift: 0 };
  if (terraform) high = padHeight(tops) ?? high;
  high = Math.max(origin.y - 1 - MAX_LIFT, Math.min(ceiling, high));
  return { origin: { x: origin.x, y: high + 1, z: origin.z }, lift: high + 1 - origin.y };
}

// One foundation column per footprint cell, from the floor row down to the ground
export const foundationColumns = (plan) => [...footprint(plan)].map(([x, z]) => ({ x, z, top: 0, role: "foundation" }));

// ---------- the terraform stage ----------
const REACH = 9; // skirt (6) + feathering (3): how far round the footprint the land may move
const LANDING = 4; // flat blocks in front of the door, level with the floor (house rules: the door landing)
const permCache = new Map();
function perm(id) {
  if (!permCache.has(id)) {
    let p;
    for (const name of [id.includes(":") ? id : `minecraft:${id}`, "minecraft:dirt"]) {
      try { p = BlockPermutation.resolve(name); break; } catch { /* not in this game version: next */ }
    }
    permCache.set(id, p);
  }
  return permCache.get(id);
}

// The ground stage of a build job: survey the land round the footprint a few columns a tick, solve it with
// terraform.js (the plot a pad at the floor, the land round it blended), then set the blocks a few a tick.
// Columns that aren't natural ground (another building, a path, a wall) or aren't loaded are left alone.
// Saved jobs don't keep it: a build picked up after a restart goes on without regrading.
export class Groundwork {
  constructor(plan, origin, forward, region = "vale") {
    const frame = frameFor(forward);
    this.floor = origin.y - 1;
    this.region = REGION[region] ? region : "vale";
    this.pad = [];
    for (const [x, z] of footprint(plan)) { const at = toWorld(frame, origin, x, 0, z); this.pad.push([at.x, at.z]); }
    const xs = this.pad.map((c) => c[0]), zs = this.pad.map((c) => c[1]);
    this.x0 = Math.min(...xs) - REACH; this.z0 = Math.min(...zs) - REACH;
    this.W = Math.max(...xs) + REACH - this.x0 + 1; this.H = Math.max(...zs) + REACH - this.z0 + 1;
    this.h = Array.from({ length: this.W }, () => new Array(this.H).fill(this.floor));
    this.fixed = Array.from({ length: this.W }, () => new Array(this.H).fill(false));
    this.cursor = 0; this.todo = null; this.keep = { x: origin.x, z: origin.z };
    // the door landing (Mateo 2026-11-13, "make sure every building generates like this"): the door is at plan x = 0
    // facing -z, the stone just in front of it at z = 0; 4 blocks out from there, 3 wide, the ground is held level with
    // the floor so the door never opens onto a drop, and the skirt blends the land to it like the rest of the pad
    const inPad = new Set(this.pad.map(([x, z]) => `${x},${z}`));
    this.landing = [];
    for (let z = -1; z >= -LANDING; z--) for (let x = -1; x <= 1; x++) {
      const at = toWorld(frame, origin, x, 0, z);
      if (!inPad.has(`${at.x},${at.z}`)) this.landing.push([at.x, at.z]);
    }
  }

  survey(dim, budget) {
    const n = this.W * this.H;
    for (; budget-- > 0 && this.cursor < n; this.cursor++) {
      const i = Math.floor(this.cursor / this.H), j = this.cursor % this.H;
      const x = this.x0 + i, z = this.z0 + j;
      const top = groundTop(dim, x, z, this.floor + MAX_LIFT + 4);
      if (top === undefined) { this.fixed[i][j] = true; continue; }
      this.h[i][j] = top;
      try {
        if (!isNatural(dim.getBlock({ x, y: top, z }).typeId) || /water|lava/.test(dim.getBlock({ x, y: top + 1, z }).typeId)) this.fixed[i][j] = true;
      } catch { this.fixed[i][j] = true; }
    }
    return this.cursor >= n;
  }

  plan() {
    const pad = new Map();
    for (const [x, z] of this.pad) { const i = x - this.x0, j = z - this.z0; pad.set(`${i},${j}`, this.floor); this.fixed[i][j] = false; }
    const connectors = new Map();
    for (const [x, z] of this.landing) {
      const i = x - this.x0, j = z - this.z0;
      if (!this.fixed[i][j]) connectors.set(`${i},${j}`, this.floor);   // a path or a wall already there stays
    }
    const sites = [site({ pad, connectors, carve: 0 })];
    const { T, wall } = solve(this.h, sites, this.fixed);
    this.T = T;
    // the pad's own columns: only the cut (air above the floor); the footings fill under it
    this.todo = blocks(this.h, T, wall, sites, this.region, this.x0, this.z0, this.fixed)
      .filter((b) => !(b.x === this.keep.x && b.z === this.keep.z && b.y >= this.floor - 1))
      .filter((b) => b.id === "air" || !pad.has(`${b.x - this.x0},${b.z - this.z0}`))
      .sort((a, b) => (a.id === "air") === (b.id === "air") ? (a.id === "air" ? b.y - a.y : a.y - b.y) : a.id === "air" ? -1 : 1);
    this.cursor = 0;
  }

  step(dim, budget) {
    if (!this.todo) {
      if (!this.survey(dim, Math.max(16, budget))) return "more";
      this.plan();
      return "more";
    }
    for (; budget-- > 0 && this.cursor < this.todo.length; this.cursor++) {
      const b = this.todo[this.cursor];
      const block = dim.getBlock(b);
      if (!block) return "wait";
      const p = b.id === "air" ? perm("air") : perm(b.id);
      if (p && block.permutation !== p) block.setPermutation(p);
    }
    return this.cursor >= this.todo.length ? "done" : "more";
  }
}
