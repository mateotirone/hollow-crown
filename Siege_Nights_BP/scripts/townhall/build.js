// The build engine: raises a hall template block by block, in a regional style.
// Other features can reuse it for their own templates: startBuild({ ... plan ... }).

import { world, system, BlockPermutation } from "@minecraft/server";
import { buildOrder, frameFor, toWorld, statesFor } from "./halls.js";

const permCache = new Map();

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

// job: { id, dimensionId, origin, forward, plan, style, perTick, skip(x,y,z)?, remove?: [{x,y,z}] (world coords),
//        index?, onProgress?(done, total), onDone?() }
export function startBuild(job) {
  job.frame = frameFor(job.forward);
  job.cells = buildOrder(job.plan);
  job.columns = [...job.plan.columns.values()];
  job.index ??= 0;
  job.stage = job.remove?.length ? "clear" : "columns";
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
    // take down what is left of the old hall, top first
    while (budget-- > 0 && job.cursor < job.remove.length) {
      const at = job.remove[job.cursor];
      const block = dim.getBlock(at);
      if (!block) return false;
      if (!(at.x === job.origin.x && at.y === job.origin.y && at.z === job.origin.z)) block.setPermutation(air);
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
        dim.playSound("dig.stone", at, { volume: 1, pitch: 0.7 + Math.random() * 0.3 });
        dim.spawnParticle("minecraft:knockback_roar_particle", at);
      } catch {
        // sounds and sparkles are optional
      }
    }
  }
  job.onProgress?.(job.index, job.cells.length);
  if (job.index >= job.cells.length) job.stage = "done";
  return true;
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

// World positions of every cell of a plan (used to clear an old hall before a new one rises)
export function worldCells(plan, origin, forward) {
  const frame = frameFor(forward);
  return [...plan.cells.values()].filter((c) => c.role !== "air").map((c) => toWorld(frame, origin, c.x, c.y, c.z));
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

export { system };
