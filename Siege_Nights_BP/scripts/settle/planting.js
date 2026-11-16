// Planting the plots: the last stage of the town's build order (plots, paths, wall, blending, then planting).
// Mateo 2026-11-16: "if buildings dont take up the entire plot it should fill the rest with grass or trees etc.
// same with empty space around buildings".
//
// A plot's groundwork cuts it down to the floor and lays no top, so every plot showed bare dirt a block under the
// floor. Here every open plot gets its region's ground back, and once a building stands on it the ground it leaves
// free is planted: grass and flowers, a bush or two, and a young tree of the region's grove where there is room
// (breakable wood, the Forester's Lodge's trees, never the map's unbreakable ones). What and where: planting_rules.js.
//
// When it happens: when a building on a plot is finished (settleBuilt), when a tier is ready (townReady: its plots,
// paths, ground and fixtures are laid and its wall stands on its line), and a slow catch-up for plots that weren't loaded then or were dressed
// by an older version (PLANT_VERSION). When a building is knocked down (settleCleared) its planting is taken up
// first, so the next building's clear box never leaves half a tree, then the plot gets its bare ground back.
// A few blocks a tick (runJob); nothing is set in a chunk that isn't loaded (that plot is tried again later).

import { world, system, BlockPermutation, BlockVolume } from "@minecraft/server";
import { isReady, on, onTick, moduleStore } from "../siege/api.js";
import { townOf, allTowns, layoutOf, slotClosed } from "./founding.js";
import { slotsOf, townFor, groundwork, fixturesOf } from "./towns.js";
import { wallOf } from "./walls.js";
import { WALLS, onWallLine, radiusAt } from "./walldata.js";
import { plantPlan, openGround, groundFor, localGround, canGrow, BARE, GROUND, PLANT_VERSION } from "./planting_rules.js";
import { GROVE_DESIGNS } from "../forestry/grove_data.js";

const OVERWORLD = "minecraft:overworld";
// plots: { "owner|slot": { v, b: building id or "", box, origin, forward } } what each plot was dressed for
// open: { owner: { v, ready } } the tier whose open ground between plots was last planted
const store = moduleStore("siege:settle_planting", () => ({ plots: {}, open: {} }));
const plots = () => store.data.plots;
const keyOf = (owner, slotId) => `${owner}|${slotId}`;
const NO_TREES = /^hall[45]$/; // ground the hall takes later
const AIRY = /air$|short_grass|fern$|flower|dandelion|poppy|daisy|cornflower|bluet|orchid|allium|lily_of|deadbush|dry_grass|moss_carpet|snow_layer|leaf_litter/;

const permCache = new Map();
function perm(id) {
  if (!permCache.has(id)) {
    let p;
    try { p = BlockPermutation.resolve(id, /leaves$/.test(id) ? { persistent_bit: true } : undefined); } catch { p = undefined; }
    permCache.set(id, p);
  }
  return permCache.get(id);
}

// Where nothing climbable may stand: within WALLS.reserve of the wall line, at this ring and every bigger one the town
// will have, so a bush planted now is never beside a wall that comes later (an old line inside becomes a ring road)
function nearWallFor(owner, town) {
  const w = wallOf(owner);
  if (!w) return () => false;
  const rings = new Set([w.radius, ...(townFor(town.plot)?.walls ?? [])].filter((r) => Number.isFinite(r) && r >= w.radius));
  return (dx, dz) => [...rings].some((r) => onWallLine(w, { x: town.x + dx, z: town.z + dz }, r, WALLS.reserve));
}
// Until a town has its wall, nothing is planted (the wall goes round what each tier laid, town build order PR #474,
// so once it stands the plots inside are free ground; nearWallFor keeps anything climbable off its line)
function inBandFor(owner) {
  return wallOf(owner) ? () => false : () => true;
}

// What a plot is dressed for now: its building once it stands, else nothing (bare ground)
function dressFor(town, slot) {
  const st = town.slots?.[slot.id];
  if (!st?.building || st.done === false || !st.box || !st.origin) return { b: "" };
  return {
    b: st.building,
    box: { x0: st.box.x0 - town.x, z0: st.box.z0 - town.z, x1: st.box.x1 - town.x, z1: st.box.z1 - town.z },
    origin: { dx: st.origin.x - town.x, dz: st.origin.z - town.z },
    forward: st.forward,
  };
}

const planOf = (owner, town, slot, rec) => plantPlan({
  slot, region: town.style, seed: owner, nearWall: nearWallFor(owner, town), inBand: inBandFor(owner),
  building: rec.b ? { box: rec.box, origin: rec.origin, forward: rec.forward } : undefined,
  noTrees: (slot.tags ?? []).some((t) => NO_TREES.test(t)),
});

// The top ground block of a plot column, near its floor (y of the block, or undefined when not loaded or not bare)
function groundAt(dim, x, z, floor) {
  for (let y = floor + 1; y >= floor - 3; y--) {
    let b;
    try { b = dim.getBlock({ x, y, z }); } catch { return undefined; }
    if (!b) return undefined;
    if (b.isAir || AIRY.test(b.typeId)) continue;
    return { y, block: b };
  }
  return null; // a hole: leave it
}

const busy = new Set();
// Dress one plot: its ground, then (with a building) its planting. -> false when it can't start now
function dress(owner, slot) {
  const town = townOf(owner);
  const key = keyOf(owner, slot.id);
  if (!town || busy.has(key)) return false;
  const rec = { v: PLANT_VERSION, ...dressFor(town, slot) };
  const old = plots()[key];
  const plan = planOf(owner, town, slot, rec);
  const floor = town.y + slot.dy;
  busy.add(key);
  system.runJob((function* () {
    const dim = world.getDimension(OVERWORLD);
    try {
      if (old && (old.b !== rec.b || old.v !== rec.v)) { // what was planted for the old building comes up first
        if (!(yield* undress(dim, owner, town, slot, old))) return;
      }
      // the land round the plot decides its ground (Redmesa's town ground is pale sand, not the region's red sand)
      const counts = {};
      let n = 0;
      for (let r = 2; r <= 3; r++) for (let dx = slot.box.x0 - r; dx <= slot.box.x1 + r; dx++) for (let dz = slot.box.z0 - r; dz <= slot.box.z1 + r; dz++) {
        if (dx > slot.box.x0 - r && dx < slot.box.x1 + r && dz > slot.box.z0 - r && dz < slot.box.z1 + r) continue; // the ring only
        if (++n % 48 === 0) yield;
        const g = groundAt(dim, town.x + dx, town.z + dz, floor);
        if (g === undefined) return;
        if (g) counts[g.block.typeId] = (counts[g.block.typeId] ?? 0) + 1;
      }
      const top = localGround(counts, town.style);
      for (const [dx, dz] of plan.surface) {
        if (++n % 48 === 0) yield;
        const x = town.x + dx, z = town.z + dz;
        const g = groundAt(dim, x, z, floor);
        if (g === undefined) return; // not loaded: tried again later
        if (!g || g.y > floor || !BARE.test(g.block.typeId)) continue; // a floor, a path, a border log: not ours
        const want = groundFor(town.style, x, z, top);
        if (g.block.typeId !== want) { const p = perm(want); if (p) g.block.setPermutation(p); }
      }
      for (const [dx, dz, id] of plan.plants) {
        if (++n % 48 === 0) yield;
        const x = town.x + dx, z = town.z + dz;
        const g = groundAt(dim, x, z, floor);
        if (g === undefined) return;
        if (!g || g.y > floor || !BARE.test(g.block.typeId) || !canGrow(id, g.block.typeId)) continue;
        const above = g.block.above();
        if (!above?.isAir) continue;
        const p = perm(id);
        if (p) try { above.setPermutation(p); } catch { /* a plant this ground won't hold */ }
      }
      for (const t of plan.trees) {
        yield;
        const x = town.x + t.dx, z = town.z + t.dz;
        const g = groundAt(dim, x, z, floor);
        if (g === undefined) return;
        if (!g || g.y > floor) continue;
        const d = GROVE_DESIGNS[`${t.sid}_${t.stage}_${t.v}`];
        try { world.structureManager.place(`siege_grove:${t.sid}_${t.stage}_${t.v}`, dim, { x: x + d.lo[0], y: g.y + d.lo[1], z: z + d.lo[2] }); }
        catch (e) { console.warn(`[Hollow Crown] planting: no tree on ${slot.id}: ${e}`); }
      }
      plots()[key] = rec;
      store.save();
    } finally {
      busy.delete(key);
    }
  })());
  return true;
}

// Take up what a record planted (only blocks still as planted), its trees too. Returns false if not loaded.
function* undress(dim, owner, town, slot, rec) {
  if (!rec?.b) return true;
  const plan = planOf(owner, town, slot, rec);
  const floor = town.y + slot.dy;
  let n = 0;
  for (const [dx, dz, id] of plan.plants) {
    if (++n % 48 === 0) yield;
    for (let y = floor - 2; y <= floor + 1; y++) {
      let b;
      try { b = dim.getBlock({ x: town.x + dx, y, z: town.z + dz }); } catch { return false; }
      if (!b) return false;
      if (b.typeId === id) { b.setType("minecraft:air"); break; }
    }
  }
  for (const t of plan.trees) {
    yield;
    const d = GROVE_DESIGNS[`${t.sid}_${t.stage}_${t.v}`];
    if (!d) continue;
    const x = town.x + t.dx, z = town.z + t.dz;
    try {
      dim.fillBlocks(new BlockVolume({ x: x + d.lo[0], y: floor - 2 + d.lo[1], z: z + d.lo[2] }, { x: x + d.hi[0], y: floor + 1 + d.hi[1], z: z + d.hi[2] }),
        "minecraft:air", { blockFilter: { includeTypes: d.types } });
    } catch { return false; }
  }
  return true;
}

// Plots of a town that are open, laid out and not taken by the hall. With the town build order (town.ready: the last
// tier whose plots, paths, ground, fixtures and wall are all down), only plots of a ready tier; before it, laid ones.
function openSlots(owner, town, upTo = town.tier ?? 0) {
  const done = (t) => (town.ready !== undefined ? t <= town.ready : town.laid?.[t] !== false);
  return slotsOf(layoutOf(town)).filter((s) => s.tier <= upTo && done(s.tier) && !slotClosed(owner, s));
}
// Does this plot need dressing (never dressed, an older version, or a different building since)?
function stale(owner, town, slot) {
  const st = town.slots?.[slot.id];
  if (st?.building && st.done === false) return false; // still rising: settleBuilt dresses it
  const rec = plots()[keyOf(owner, slot.id)];
  return !rec || rec.v !== PLANT_VERSION || rec.b !== dressFor(town, slot).b;
}

on("settleBuilt", ({ owner, slotId }) => {
  if (!slotId) return;
  system.runTimeout(() => { const town = townOf(owner); const s = town && slotsOf(layoutOf(town)).find((x) => x.id === slotId); if (s) dress(owner, s); }, 20);
});
on("settleCleared", ({ owner, slotId }) => {
  const town = townOf(owner);
  const s = town && slotsOf(layoutOf(town)).find((x) => x.id === slotId);
  if (s) dress(owner, s); // the record says what stood: it comes up, then the plot gets its bare ground
});
// townReady: the town build order's last stage before planting (plots, paths, ground, fixtures, then the wall on its line)
on("townReady", ({ owner, tier }) => system.runTimeout(() => {
  const town = townOf(owner);
  if (town) for (const s of openSlots(owner, town, tier)) if (stale(owner, town, s)) dress(owner, s);
}, 20));
// Catch-up: one plot at a time, for plots not loaded before and worlds dressed by an older version. A plot tried in
// the last minute waits its turn, so one that isn't loaded never holds up the rest.
const tried = new Map(); // key -> tick
onTick("settle_planting", 100, () => {
  if (!isReady() || busy.size) return;
  const now = system.currentTick;
  for (const [owner, town] of Object.entries(allTowns())) {
    for (const s of openSlots(owner, town)) {
      const key = keyOf(owner, s.id);
      if (now - (tried.get(key) ?? -1e9) < 1200 || !stale(owner, town, s)) continue;
      tried.set(key, now);
      if (dress(owner, s)) return;
    }
  }
});

// ---------- the open ground between plots ----------
// Planted when a tier is ready (its plots, paths, ground, fixtures and wall all down), inside the wall that stands,
// on ground no tier of the layout ever claims (openGroundPlan). Nothing within OPEN_WALL of this ring's line or a bigger
// one's, so the wall's steps, lookouts and the ground a later wall stands on stay bare.
const OPEN_WALL = WALLS.reserve + 2;
const openBusy = new Set();
function dressOpen(owner) {
  const town = townOf(owner), w = wallOf(owner), layout = town && layoutOf(town);
  if (!town || !w || !layout || town.ready === undefined || openBusy.has(owner)) return false;
  const rings = [...new Set([w.radius, ...(townFor(town.plot)?.walls ?? [])].filter((r) => Number.isFinite(r) && r >= w.radius))];
  const rel = (dx, dz) => { const x = town.x + dx - (w.x + 0.5), z = town.z + dz - (w.z + 0.5); return { d: Math.hypot(x, z), a: Math.atan2(z, x) }; };
  const { plants: plan, trees } = openGround({
    layout, region: town.style, seed: owner,
    groundworkOf: (t) => groundwork(layout, t), slots: slotsOf(layout),
    fixtures: [0, 1, 2, 3].flatMap((t) => fixturesOf(layout, t)),
    inside: (dx, dz) => { const { d, a } = rel(dx, dz); return d < radiusAt(w, w.radius, a) - 1; },
    nearWall: (dx, dz) => rings.some((r) => onWallLine(w, { x: town.x + dx, z: town.z + dz }, r, OPEN_WALL)),
  });
  const ready = town.ready;
  openBusy.add(owner);
  system.runJob((function* () {
    const dim = world.getDimension(OVERWORLD);
    try {
      // the top of a column near the town's height: a block, null when nothing is there, undefined when not loaded
      const topAt = (x, z) => {
        for (let y = town.y + 16; y >= town.y - 16; y--) {
          let b;
          try { b = dim.getBlock({ x, y, z }); } catch { return undefined; }
          if (!b) return undefined;
          if (b.isAir || AIRY.test(b.typeId)) continue;
          return b;
        }
        return null;
      };
      // plain ground only: a path, a field, a wall or a tree is not open ground
      const plain = (b) => b && GROUND.test(b.typeId) && !/dirt$|gravel/.test(b.typeId);
      let n = 0;
      for (const t of trees) {
        yield;
        const x = town.x + t.dx, z = town.z + t.dz, g = topAt(x, z);
        if (g === undefined) return;
        if (!plain(g) || !canGrow("tree", g.typeId)) continue;
        const d = GROVE_DESIGNS[`${t.sid}_${t.stage}_${t.v}`];
        try { world.structureManager.place(`siege_grove:${t.sid}_${t.stage}_${t.v}`, dim, { x: x + d.lo[0], y: g.location.y + d.lo[1], z: z + d.lo[2] }); }
        catch (e) { console.warn(`[Hollow Crown] planting: no tree on the open ground: ${e}`); }
      }
      for (const [dx, dz, id] of plan) {
        if (++n % 40 === 0) yield;
        const x = town.x + dx, z = town.z + dz, g = topAt(x, z);
        if (g === undefined) return;
        if (!plain(g) || !canGrow(id, g.typeId)) continue;
        const above = g.above();
        if (!above?.isAir) continue;
        const p = perm(id);
        if (p) try { above.setPermutation(p); } catch { /* a plant this ground won't hold */ }
      }
      store.data.open[owner] = { v: PLANT_VERSION, ready };
      store.save();
    } finally {
      openBusy.delete(owner);
    }
  })());
  return true;
}
const openStale = (owner, town) => town.ready !== undefined && (store.data.open?.[owner]?.v !== PLANT_VERSION || store.data.open[owner].ready !== town.ready);
on("townReady", ({ owner }) => system.runTimeout(() => { const town = townOf(owner); if (town && openStale(owner, town)) dressOpen(owner); }, 60));
const openTried = new Map();
onTick("settle_planting_open", 400, () => {
  if (!isReady() || openBusy.size) return;
  const now = system.currentTick;
  for (const [owner, town] of Object.entries(allTowns())) {
    if (now - (openTried.get(owner) ?? -1e9) < 2400 || !openStale(owner, town)) continue;
    openTried.set(owner, now);
    if (dressOpen(owner)) return;
  }
});
