// The build engine: raises a hall template block by block, in a regional style.
// Other features can reuse it for their own templates: startBuild({ ... plan ... }).

import { world, BlockPermutation, BlockVolume } from "@minecraft/server";
import { buildOrder, frameFor, toWorld, statesFor } from "./halls.js";
import { sfx } from "../core/sfx.js";

const permCache = new Map();
const CORNERSTONE = "siege:hall_cornerstone"; // a build never overwrites or clears it, wherever it stands

// First block id (and state spelling) the running game accepts for a style role
export function resolveRole(style, frame, role, o) {
  const key = `${style.name}|${role}|${JSON.stringify(o ?? {})}|${frame.F.x},${frame.F.z}`;
  if (permCache.has(key)) return permCache.get(key);
  let found;
  const ids = style.roles[role] ?? ["minecraft:air"];
  outer: for (const id of ids) {
    for (const states of statesFor(frame, role, o)) {
      try {
        found = BlockPermutation.resolve(id, states);
        if (found) break outer;
      } catch {
        // unknown block or state in this game version: try the next spelling
      }
    }
  }
  found ??= BlockPermutation.resolve("minecraft:air");
  permCache.set(key, found);
  return found;
}

const jobs = []; // running builds

// job: { id, dimensionId, origin, forward, plan, style, perTick, clearBox?: { min, max } (world coords, inclusive),
//        keep?: [{x,y,z}] (cornerstone spots the clear must not lose), remove?: [{x,y,z}] (world coords, taken down first), index?, onProgress?(fraction, done, total), onDone?() }
// clearBox: everything in it is taken down first (top layer first), except a Hall Cornerstone, so an old
// hall never leaves pieces behind.
export function startBuild(job) {
  job.frame = frameFor(job.forward);
  job.cells = buildOrder(job.plan);
  job.columns = [...job.plan.columns.values()];
  job.index ??= 0;
  job.layer = job.clearBox ? job.clearBox.max.y : undefined;
  job.stage = job.index ? "cells" : job.clearBox ? "clear" : job.remove?.length ? "remove" : "columns";
  job.cursor = 0;
  job.lastLayer = -1;
  job.waited = 0;
  jobs.push(job);
  return job;
}

export const buildFor = (id) => jobs.find((j) => j.id === id);
export const buildsRunning = () => jobs.length;

function setCell(dim, job, x, y, z, role, o) {
  const at = toWorld(job.frame, job.origin, x, y, z);
  if (at.x === job.origin.x && at.y === job.origin.y && at.z === job.origin.z) return true; // never the cornerstone
  const block = dim.getBlock(at);
  if (!block) return false; // chunk not loaded: wait
  if (block.typeId === CORNERSTONE) return true;
  const perm = resolveRole(job.style, job.frame, role, o);
  if (block.permutation !== perm) block.setPermutation(perm);
  return true;
}

const SOFT = /(air|water|lava|grass|fern|flower|snow_layer|leaves|vine|bush|sapling|tallgrass|seagrass|kelp|dandelion|poppy|mushroom|lily)/;

function fillColumn(dim, job, col) {
  const top = toWorld(job.frame, job.origin, col.x, col.top, col.z);
  const perm = resolveRole(job.style, job.frame, col.role, col.o);
  for (let d = 0; d < 16; d++) {
    const block = dim.getBlock({ x: top.x, y: top.y - d, z: top.z });
    if (!block) return d > 0; // unloaded right at the top: wait. Deeper: good enough.
    if (!SOFT.test(block.typeId) && block.typeId !== perm.type.id) return true; // reached solid ground
    if (block.permutation !== perm) block.setPermutation(perm);
  }
  return true;
}

function step(job) {
  const dim = world.getDimension(job.dimensionId);
  let budget = job.perTick;
  const air = BlockPermutation.resolve("minecraft:air");

  if (job.stage === "clear") {
    // take down the whole old hall, two layers a tick, top first
    const { min, max } = job.clearBox;
    for (let n = 0; n < 2 && job.layer >= min.y; n++) {
      if (!clearLayer(dim, min, max, job.layer, air, job.keep ?? [])) return false;
      job.layer--;
    }
    report(job);
    if (job.layer < min.y) { job.stage = job.remove?.length ? "remove" : "columns"; job.cursor = 0; }
    return true;
  }

  if (job.stage === "remove") {
    // take down listed blocks of an old build, top first
    while (budget-- > 0 && job.cursor < job.remove.length) {
      const at = job.remove[job.cursor];
      const block = dim.getBlock(at);
      if (!block) return false;
      if (!(at.x === job.origin.x && at.y === job.origin.y && at.z === job.origin.z) && block.typeId !== CORNERSTONE) block.setPermutation(air);
      job.cursor++;
    }
    if (job.cursor >= job.remove.length) { job.stage = "columns"; job.cursor = 0; }
    return true;
  }

  if (job.stage === "columns") {
    budget = Math.max(4, Math.floor(budget / 4));
    while (budget-- > 0 && job.cursor < job.columns.length) {
      if (!fillColumn(dim, job, job.columns[job.cursor])) return false;
      job.cursor++;
    }
    report(job);
    if (job.cursor >= job.columns.length) job.stage = "cells";
    return true;
  }

  while (budget-- > 0 && job.index < job.cells.length) {
    const c = job.cells[job.index];
    if (!setCell(dim, job, c.x, c.y, c.z, c.role, c.o)) return false;
    job.index++;
    if (c.y !== job.lastLayer) {
      job.lastLayer = c.y;
      const at = toWorld(job.frame, job.origin, 0, c.y, 4);
      try {
        sfx(dim, "dig.stone", at, { volume: 1, pitch: 0.7 + Math.random() * 0.3 });
        dim.spawnParticle("minecraft:knockback_roar_particle", at);
      } catch {
        // sounds and sparkles are optional
      }
    }
  }
  report(job);
  if (job.index >= job.cells.length) job.stage = "done";
  return true;
}

// One layer of a clear box to air, keeping any Hall Cornerstone. False if part of it is not loaded yet.
// keep: spots that may hold a cornerstone; put back if the fill took them anyway
function clearLayer(dim, min, max, y, air, keep) {
  const volume = new BlockVolume({ x: min.x, y, z: min.z }, { x: max.x, y, z: max.z });
  try {
    const stones = keep.filter((k) => k.y === y && dim.getBlock(k)?.typeId === CORNERSTONE);
    dim.fillBlocks(volume, air, { blockFilter: { excludeTypes: [CORNERSTONE] } });
    for (const k of stones) if (dim.getBlock(k)?.typeId !== CORNERSTONE) dim.getBlock(k)?.setType(CORNERSTONE);
    return true;
  } catch {
    // unloaded, or this game has no filter: go block by block
  }
  for (let x = min.x; x <= max.x; x++)
    for (let z = min.z; z <= max.z; z++) {
      const block = dim.getBlock({ x, y, z });
      if (!block) return false;
      if (block.typeId !== "minecraft:air" && block.typeId !== CORNERSTONE) block.setPermutation(air);
    }
  return true;
}

// Progress over the whole job (clearing, footings, walls), 0 to 1, so the bar never sits still
export function progressOf(job) {
  const layers = job.clearBox ? job.clearBox.max.y - job.clearBox.min.y + 1 : 0;
  const cleared = job.clearBox ? (job.stage === "clear" ? job.clearBox.max.y - job.layer : layers) : 0;
  const cols = job.stage === "clear" || job.stage === "remove" ? 0 : job.stage === "columns" ? job.cursor : job.columns.length;
  // weights: a layer cleared ~ 20 cells, a footing ~ 4 cells
  const total = layers * 20 + job.columns.length * 4 + job.cells.length;
  return total ? Math.min(1, (cleared * 20 + cols * 4 + job.index) / total) : 1;
}

function report(job) {
  job.onProgress?.(progressOf(job), job.index, job.cells.length);
}

export function buildTick() {
  for (let i = jobs.length - 1; i >= 0; i--) {
    const job = jobs[i];
    let ok = false;
    try {
      ok = step(job);
    } catch (e) {
      console.warn(`[Town Hall] build ${job.id}: ${e}`);
    }
    job.waited = ok ? 0 : job.waited + 1;
    if (job.stage === "done") {
      jobs.splice(i, 1);
      try {
        job.onDone?.();
      } catch (e) {
        console.warn(`[Town Hall] build ${job.id} finish: ${e}`);
      }
    }
  }
}

// The space a standing hall takes up above the ground, a block wider at the sides, back and top so nothing
// of it is left behind (inclusive world coords). The front is not padded: the path in stays.
export function clearBoxFor(plan, origin, forward, pad = 1) {
  const frame = frameFor(forward);
  const b = plan.bounds();
  const corners = [[b.x0 - pad, b.z0], [b.x1 + pad, b.z0], [b.x0 - pad, b.z1 + pad], [b.x1 + pad, b.z1 + pad]].map(([x, z]) => toWorld(frame, origin, x, 1, z));
  return {
    min: { x: Math.min(...corners.map((c) => c.x)), y: origin.y, z: Math.min(...corners.map((c) => c.z)) },
    max: { x: Math.max(...corners.map((c) => c.x)), y: origin.y - 1 + b.y1 + pad, z: Math.max(...corners.map((c) => c.z)) },
  };
}

// World positions of every cell of a plan
export function worldCells(plan, origin, forward) {
  const frame = frameFor(forward);
  const out = [...plan.cells.values()].filter((c) => c.role !== "air").map((c) => toWorld(frame, origin, c.x, c.y, c.z));
  // stilts standing above the ground count too
  for (const col of plan.columns.values()) for (let y = 1; y <= col.top; y++) out.push(toWorld(frame, origin, col.x, y, col.z));
  return out;
}

export function worldMarks(plan, origin, forward) {
  const frame = frameFor(forward);
  return Object.fromEntries(Object.entries(plan.marks).map(([k, m]) => [k, toWorld(frame, origin, m.x, m.y, m.z)]));
}

export function worldBox(plan, origin, forward) {
  const frame = frameFor(forward);
  const b = plan.bounds();
  const corners = [[b.x0, b.z0], [b.x1, b.z0], [b.x0, b.z1], [b.x1, b.z1]].map(([x, z]) => toWorld(frame, origin, x, 0, z));
  return {
    corners,
    min: { x: Math.min(...corners.map((c) => c.x)), y: origin.y - 1, z: Math.min(...corners.map((c) => c.z)) },
    max: { x: Math.max(...corners.map((c) => c.x)), y: origin.y - 1 + b.y1, z: Math.max(...corners.map((c) => c.z)) },
    width: b.x1 - b.x0 + 1, depth: b.z1 - b.z0 + 1, height: b.y1 + 1,
  };
}

export { system } from "@minecraft/server";
