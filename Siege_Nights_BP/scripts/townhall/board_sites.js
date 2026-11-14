// Town Board job sites: a raider camp, opened barrows, a row of lamps, a peg nest in an elm. Each is a design made
// with the minecraft-builder skill (map/structures/board_sites.py, exported into board_sites_data.js), stamped on
// the job's place the moment the job is given, while the player is still far off, and taken down once the job is
// over and the player has gone, putting back exactly what stood there.
//
// How it is built: the ground round the spot is held loaded with a ticking area (as the landmarks are), the box the
// design will touch is saved first as a world structure (structureManager), then the design is planned onto the real
// ground (landmarks/plan.js: rigid or drape, eased into the land, nothing left floating) and placed a few dozen blocks
// a tick. Clearing places the saved structure back and deletes it. One site builds at a time.
//
// A design's marks ([dx, dy, dz, kind]) come back as world spots: where the foes stand, the lamps, the sheep, the
// lost thing, the person you are looking for. board.js uses them.
//
// Saved (world): hc:board_sites = { "<player id>": { key, x, z, G, box, snap, marks, state: "building"|"up"|"clearing" } }

import { world, system, BlockPermutation, StructureSaveMode } from "@minecraft/server";
import { load, save, runCmd } from "../undertow/data.js";
import { planPiece, settleOps, AIR, KEEP_TOP, BUILT_TOP } from "../landmarks/plan.js";
import { clearTrees, treeClearBoxes, clearLooseBranches } from "../core/clearing.js";
import { BOARD_SITES } from "./board_sites_data.js";

const OVERWORLD = "minecraft:overworld";
const K_SITES = "hc:board_sites";
const AREA = "hc_board_site";
const PER_STEP = 40;
const SOFT = /leaves|grass(?!_block)|fern|flower|tulip|poppy|dandelion|bush|snow_layer|log|vine|sapling|mushroom|azalea|dead_bush|torch|reeds|sugar_cane|kelp|seagrass|lily|wood|fence/;

const sites = () => load(K_SITES, {});
const keep = (all) => save(K_SITES, all);
export const siteOf = (playerId) => sites()[playerId];
export const designOf = (key) => BOARD_SITES[key];

function groundY(dim, x, z) {
  let b;
  try { b = dim.getTopmostBlock({ x, z }); } catch { return undefined; }
  let y = b?.location?.y;
  if (y === undefined) return undefined;
  for (let i = 0; i < 48; i++) {
    const here = dim.getBlock({ x, y, z });
    if (!here) return undefined;
    if (!here.isAir && !here.isLiquid && !SOFT.test(here.typeId)) return y;
    y--;
  }
  return y;
}
function waterY(dim, x, z) {
  try {
    const b = dim.getTopmostBlock({ x, z });
    return b && b.typeId.includes("water") ? b.location.y : undefined;
  } catch { return undefined; }
}
function loaded(dim, x0, z0, x1, z1) {
  for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1], [(x0 + x1) >> 1, (z0 + z1) >> 1]]) {
    try { if (!dim.getBlock({ x, y: 64, z })) return false; } catch { return false; }
  }
  return true;
}
const permCache = new Map();
function perm(id, states) {
  const k = id + JSON.stringify(states);
  if (!permCache.has(k)) {
    let p;
    try { p = BlockPermutation.resolve(id, states); } catch { try { p = BlockPermutation.resolve(id); } catch { p = undefined; } }
    permCache.set(k, p);
  }
  return permCache.get(k);
}

let busy = false;
const queue = []; // [{ playerId, key, x, z, done }]

// Ask for a site. done(marks) is called once it stands (marks: [{ kind, x, y, z }]), or done(undefined) if it can't.
export function buildSiteFor(playerId, key, x, z, done = () => {}) {
  const d = designOf(key);
  if (!d) { done([]); return; } // no design: the job runs on the bare place
  const have = siteOf(playerId);
  if (have?.state === "up" && have.key === key && have.x === x && have.z === z) { done(have.marks); return; }
  queue.push({ playerId, key, x, z, done });
  pump();
}

// Take a player's site down (when the job is over and they have gone): the saved ground goes back
export function clearSiteFor(playerId) {
  const all = sites();
  const s = all[playerId];
  if (!s) return true;
  const dim = world.getDimension(OVERWORLD);
  try {
    if (s.snap) {
      world.structureManager.place(s.snap, dim, s.from, { includeEntities: false });
      world.structureManager.delete(s.snap);
    }
  } catch (e) {
    if (String(e).includes("not loaded") || String(e).includes("Unloaded")) return false; // try again when it is loaded
    console.warn(`[Town Board] clearing ${s.key}: ${e}`);
  }
  delete all[playerId];
  keep(all);
  return true;
}

function pump() {
  if (busy || !queue.length) return;
  const q = queue.shift();
  const d = designOf(q.key);
  busy = true;
  const dim = world.getDimension(OVERWORLD);
  system.runJob((function* () {
    let marks;
    try {
      const pad = (d.ease ?? 3) + 2;
      const R = Math.max(-d.box.x0, d.box.x1, -d.box.z0, d.box.z1) + pad + 2;
      runCmd(dim, `tickingarea remove ${AREA}`);
      runCmd(dim, `tickingarea add ${q.x - R} 0 ${q.z - R} ${q.x + R} 0 ${q.z + R} ${AREA} true`);
      let waited = 0;
      while (!loaded(dim, q.x - R + 2, q.z - R + 2, q.x + R - 2, q.z + R - 2) && waited < 1200) { waited++; yield; }
      if (waited >= 1200) throw new Error("ground never loaded");
      // read the ground round it
      const heights = new Map(), waters = new Map(), tops = new Map();
      for (let x = q.x + d.box.x0 - pad; x <= q.x + d.box.x1 + pad; x++) {
        for (let z = q.z + d.box.z0 - pad; z <= q.z + d.box.z1 + pad; z++) {
          const y = groundY(dim, x, z);
          if (y === undefined) continue;
          heights.set(x * 4096 + z, y);
          const w = waterY(dim, x, z);
          if (w !== undefined) waters.set(x * 4096 + z, w);
          try { tops.set(x * 4096 + z, dim.getBlock({ x, y, z })?.permutation); } catch { /* unloaded */ }
        }
        yield;
      }
      const hAt = (x, z) => heights.get(x * 4096 + z);
      const planned = planPiece(d, q.x, q.z, hAt, (x, z) => waters.get(x * 4096 + z), (x, z) => BUILT_TOP.test(tops.get(x * 4096 + z)?.type?.id ?? ""));
      const G = planned.G;
      if (G === undefined) throw new Error("no ground");
      const ops = yield* settleOps(planned.ops, d, hAt);
      // save everything the build may touch, so it can be put back exactly
      let y0 = Infinity, y1 = -Infinity, x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const [x, y, z] of ops) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
      const snap = `hc_board:${q.playerId.replace(/[^0-9a-z-]/gi, "")}`;
      const from = { x: x0, y: y0, z: z0 };
      try { world.structureManager.delete(snap); } catch { /* none */ }
      world.structureManager.createFromWorld(snap, dim, from, { x: x1, y: Math.max(y1, G + (d.clearTo ?? d.box.y1) + 2), z: z1 }, { includeEntities: false, saveMode: StructureSaveMode.World });
      const all = sites();
      all[q.playerId] = { key: q.key, x: q.x, z: q.z, G, snap, from, state: "building" };
      keep(all);
      // clear any map tree out of its space, then place
      if (d.clearTrees !== false) yield* clearTrees(dim, { x0: q.x + d.box.x0, z0: q.z + d.box.z0, x1: q.x + d.box.x1, z1: q.z + d.box.z1, y0: G + Math.min(0, d.box.y0), y1: G + d.box.y1 });
      const pal = d.palette.map(([id, st]) => perm(id, st));
      const AIRP = perm("minecraft:air", {});
      let n = 0;
      for (const [x, y, z, i] of ops) {
        try {
          if (i === AIR) { const b = dim.getBlock({ x, y, z }); if (b && !b.isAir) b.setPermutation(AIRP); }
          else { const pm = i === KEEP_TOP ? tops.get(x * 4096 + z) ?? tops.get(q.x * 4096 + q.z) : pal[i]; if (pm) dim.setBlockPermutation({ x, y, z }, pm); }
        } catch { /* a block that would not go */ }
        if (++n % PER_STEP === 0) yield;
      }
      if (d.clearTrees !== false) yield* clearLooseBranches(dim, treeClearBoxes({ x0: q.x + d.box.x0, z0: q.z + d.box.z0, x1: q.x + d.box.x1, z1: q.z + d.box.z1, y0: G, y1: G + d.box.y1 }));
      const yAt = (dx, dy, dz) => (d.mode === "drape" ? (hAt(q.x + dx, q.z + dz) ?? G) : G) + dy;
      marks = (d.marks ?? []).map(([dx, dy, dz, kind]) => ({ kind, x: q.x + dx, y: yAt(dx, dy, dz), z: q.z + dz }));
      const done = sites();
      if (done[q.playerId]) { done[q.playerId].state = "up"; done[q.playerId].marks = marks; keep(done); }
    } catch (e) {
      console.warn(`[Town Board] site ${q.key} at ${q.x} ${q.z}: ${e}`);
      marks = undefined;
    }
    runCmd(dim, `tickingarea remove ${AREA}`);
    busy = false;
    try { q.done(marks); } catch (e) { console.warn(`[Town Board] after building: ${e}`); }
    pump();
  })());
}
