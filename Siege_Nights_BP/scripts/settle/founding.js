// Founding a town from its layout. When a player picks one of the twelve map plots, the settlement gets one of
// that plot's three hand-made layouts (towns.js) and the Hamlet part of it is laid out over a few seconds:
// roads and levelled ground, lamps, the well, the Mason's Bench, the Hall Cornerstone, a plot marker on every
// open slot, and the Hamlet wall. Each new tier lays out its own band: the wall moves out (36, 46, 56, 66),
// that tier's roads, ground and fixtures go down, and its slots get markers.
//
// What other features can use:
//   townOf(owner) -> { plot, layout, x, y, z, tier, slots: { id: { building?, style?, rising? } } } | undefined
//   townSlots(owner) -> slotsOf(layout) with world boxes added
//   on("settleFixture", ({ owner, kind, species, size, rotation, at, tier }))   trees and windmills, for the tree
//     and windmill builders (a tree is not planted here; world trees come from the tree thread)
//   on("townLaidOut", ({ owner, tier }))   a tier's groundwork is down
//   lordTownAt(x, z), adoptTown(from, to)   Rival Lords build on the same layouts; a player can take one over
//   on("townAdopted", ({ from, owner }))
//   charterOf(owner) -> charterCheck result for the tier the town is at (charters.js)
// Charters: siege wins decide the tier, but a town only grows past a tier once that tier's charter
// (config.js CHARTERS) stands. Until then it waits, and grows by itself when the last building is finished.
// Test: /scriptevent siege:town [info | charter | found <plot> [layout 0-2] | tier <0-3> (skips the charter) | road (lay the road out again)]

import { HAMLET_WALLS } from "./hamlet_walls_data.js";
import { world, system, BlockPermutation } from "@minecraft/server";
import { isReady, keepOf, on, emit, moduleStore, TIERS, tierOf, getState, onTick } from "../siege/api.js";
import { CORNERSTONE, halls, saveHalls, beginBuild } from "../townhall/townhall.js";
import { buildFor } from "../townhall/build.js";
import { REGION_TO_STYLE, CONTENTS } from "./config.js";
import { styleOf } from "./plans.js";
import { wallOf, raiseWall, moveWall, adoptWall } from "./walls.js";
import { wallShape, radiusAt } from "./walldata.js";
import { charterCheck, charterText, charterKeeps, plotFit, oneEachTaken } from "./charters.js";
import { BUILDINGS } from "./buildings.js";
import { raisedCounts } from "./raised.js";
import { groundTop } from "./ground.js";
import { ROAD_BLOCKS, WEAK_ROAD, ROAD_JOIN_PATHY, gateDir, roadEnd, roadLine, joinRoute, routeSides, gradeRoute, joinSurface } from "./basedata.js";
import { ROAD_JOINS } from "./roadjoin_data.js";
import { PLOT_PLAN } from "../plots/config.js";
import { BLOCK_BUILDS } from "./blockdesigns.js";
import { idSpellings } from "../core/blockids.js";
import { planLaneLamps } from "./lanelamps.js";
import { townFor, pickLayout, slotsOf, groundwork, fixturesOf, wallRadius, seatOnSlot, TIER_NAMES } from "./towns.js";

export const PLOT_MARKER = "siege:plot_marker";
const OVERWORLD = "minecraft:overworld";
const SOFT = /(air|water|grass$|short_grass|tall_grass|fern|flower|snow_layer|leaves|vine|bush|sapling|tallgrass|dandelion|poppy|mushroom|deadbush|plot_stone)/;
const PER_TICK = 400; // blocks set per tick while laying out (the watchdog rule: no long work in one tick)

// towns: { owner: { plot, layout, x, y, z, tier, laid: [bool x4], slots: { id: {...} } } }   markers: { "x,y,z": { owner, slot } }
const store = moduleStore("siege:settle_towns", () => ({ towns: {}, markers: {} }));
const save = () => store.save();
export const townOf = (owner) => store.data.towns[owner];
export const allTowns = () => store.data.towns;
export const markerAt = (loc) => store.data.markers[`${loc.x},${loc.y},${loc.z}`];
export function registerMarker(at, owner, slot) { store.data.markers[keyOf(at)] = { owner, slot }; save(); }
export function forgetMarker(at) { delete store.data.markers[keyOf(at)]; save(); }
/** Every registered plot marker: [{ x, y, z, owner, slot }] */
export const allMarkers = () => Object.entries(store.data.markers).map(([k, m]) => { const [x, y, z] = k.split(",").map(Number); return { x, y, z, ...m }; });
const keyOf = (loc) => `${loc.x},${loc.y},${loc.z}`;

// The plot marker's board faces out of its slot, toward the street the slot's door opens on (slot.door). Set down
// with setType it took the block's default turn and often stood edge-on to the lane (Mateo, 2026-11-13).
export const markerFacing = (door) => (door?.x > 0 ? "east" : door?.x < 0 ? "west" : door?.z < 0 ? "north" : "south");
export function setMarkerBlock(block, door) {
  const dir = markerFacing(door);
  if (block.typeId === PLOT_MARKER && block.permutation.getState("minecraft:cardinal_direction") === dir) return;
  block.setPermutation(BlockPermutation.resolve(PLOT_MARKER, { "minecraft:cardinal_direction": dir }));
}
// A town keeps the layout it was laid out with. Layouts are re-exported now and then (a plot's list can change), so
// the town also remembers which one it got (template and seed): when its index now points at another layout, or past
// the end, the same layout is found by that key; a town saved before keys existed gets one the first time it is read.
export const layoutKey = (v) => (v ? `${v.template}|${v.seed ?? v.label}` : undefined);
export function layoutOf(town) {
  const variants = townFor(town?.plot)?.variants;
  if (!variants?.length) return undefined;
  if (town.layoutKey) {
    if (layoutKey(variants[town.layout]) === town.layoutKey) return variants[town.layout];
    const i = variants.findIndex((v) => layoutKey(v) === town.layoutKey);
    if (i >= 0) { town.layout = i; return variants[i]; }
  }
  const i = Number.isInteger(town.layout) && town.layout >= 0 && town.layout < variants.length ? town.layout : 0;
  if (!town.layoutKey || i !== town.layout) { town.layout = i; town.layoutKey = layoutKey(variants[i]); }
  return variants[i];
}

export function townSlots(owner) {
  const town = townOf(owner);
  return slotsOf(layoutOf(town)).map((s) => ({
    ...s, world: { x0: town.x + s.box.x0, z0: town.z + s.box.z0, x1: town.x + s.box.x1, z1: town.z + s.box.z1 }, floorY: town.y + s.dy,
  }));
}

// The tier a settlement is at, 0..3 (from its keep's siege wins)
export function settlementTier(owner) {
  const keep = keepOf(owner);
  if (!keep) return 0;
  const t = tierOf(keep);
  return Math.max(0, TIERS.indexOf(t));
}

// ---------- blocks ----------

const perms = new Map();
function perm(id, states) {
  const key = `${id}${JSON.stringify(states ?? {})}`;
  if (!perms.has(key)) {
    let p;
    try { p = BlockPermutation.resolve(id, states); } catch { p = undefined; }
    for (const alt of idSpellings(id).slice(1)) if (!p) { try { p = BlockPermutation.resolve(alt, states); id = alt; } catch { p = undefined; } }
    // fence gates in the layouts spell their facing the old way (direction 0 south, 1 west, 2 north, 3 east); the game
    // now wants minecraft:cardinal_direction, and without it every gate stood facing south, across north-south fences
    if (!p && typeof states?.direction === "number") {
      const { direction, ...rest } = states;
      try { p = BlockPermutation.resolve(id, { ...rest, "minecraft:cardinal_direction": ["south", "west", "north", "east"][direction & 3] }); } catch { p = undefined; }
    }
    if (!p) { try { p = BlockPermutation.resolve(id); } catch { p = null; } }
    perms.set(key, p);
  }
  return perms.get(key);
}

function surfaceY(dim, x, z) {
  try {
    let block = dim.getTopmostBlock({ x, z });
    for (let i = 0; block && i < 40 && SOFT.test(block.typeId); i++) block = block.below();
    return block?.location.y;
  } catch {
    return undefined;
  }
}

// The real height of the town square at a Plot Stone: the median ground height round it
function squareY(dim, at) {
  const ys = [[2, 2], [-2, 2], [2, -2], [-2, -2], [3, 0], [-3, 0], [0, 3], [0, -3]]
    .map(([dx, dz]) => surfaceY(dim, at.x + dx, at.z + dz)).filter((y) => y !== undefined).sort((a, b) => a - b);
  return ys.length ? ys[ys.length >> 1] : undefined;
}

// ---------- laying out a tier ----------

const running = new Map(); // owner -> true while a job runs

function* layOutJob(owner, tier, done) {
  const town = townOf(owner);
  const layout = layoutOf(town);
  const dim = world.getDimension(OVERWORLD);
  const pal = layout.pal.map(([id, st]) => perm(id, st));
  const rests = layout.pal.map(([id, st]) => restsOn(id, st));
  let rows = groundwork(layout, tier);
  for (let pass = 0; pass < 60 && rows.length; pass++) { // unloaded chunks: try again a little later
    const later = [];
    let n = 0;
    for (const [dx, dy, dz, p] of rows) {
      if (++n % PER_TICK === 0) yield; // every row counts, set or not, so no tick does too many lookups
      const at = { x: town.x + dx, y: town.y + dy, z: town.z + dz };
      if (dx === 0 && dz === 0) continue; // the Plot Stone's column
      let block;
      try { block = dim.getBlock(at); } catch { block = undefined; }
      if (!block) { later.push([dx, dy, dz, p]); continue; }
      try { if (pal[p] && block.permutation !== pal[p]) block.setPermutation(pal[p]); } catch { /* protected block */ }
      if (pal[p] && rests[p]) fullUnder(dim, at);
    }
    rows = later;
    if (rows.length) for (let i = 0; i < 40; i++) yield; // ~2 s
  }
  yield;
  yield* blendGround(dim, town, layout, tier);
  if (tier === 0) yield* joinRoad(dim, town, layout, 0);
  for (const f of fixturesOf(layout, tier)) {
    try { placeFixture(owner, town, f); } catch (e) { console.warn(`[Hollow Crown] town fixture ${f.kind}: ${e}`); }
    yield;
  }
  // lamp posts wherever a lane inside the wall is still out of the lamps' reach (lanelamps.js)
  const taken = Object.values(town.slots ?? {}).map((s) => s.box).filter(Boolean)
    .map((b) => ({ x0: b.x0 - town.x, z0: b.z0 - town.z, x1: b.x1 - town.x, z1: b.z1 - town.z }));
  const w = wallOf(owner);
  const within = w?.radius ? (x, z) => Math.hypot(x, z) <= radiusAt(w, w.radius, Math.atan2(z, x)) - 2 : undefined; // the wall's own line
  for (const f of planLaneLamps(layout, tier, wallRadius(townFor(town.plot), tier), taken, within)) {
    try { placeFixture(owner, town, { kind: "lamp", ...f }); } catch (e) { console.warn(`[Hollow Crown] lane lamp: ${e}`); }
    yield;
  }
  placeMarkers(owner, tier);
  done();
}

// ---------- blending the groundwork into the land (Mateo's playtest 2026-11-12) ----------
// Nothing the groundwork lays may float, and its edge may not stand as a cliff over the land beside it: every column
// is filled down to the ground under its lowest block, and outside the edge the land is cut or built up so it never
// steps more than 1 block for every 2 outwards (the same rule the map's baked towns follow, map/genworld.py).
const NATURAL = /(grass_block|dirt|podzol|mycelium|stone$|^minecraft:(andesite|diorite|granite|tuff|deepslate|calcite|gravel|sand|red_sand|clay|mud|snow|snow_block|packed_ice|moss_block|sandstone|red_sandstone|terracotta|cobblestone)$|_terracotta$|coarse|rooted_dirt|short_grass|tall_grass|fern|flower|dandelion|poppy|snow_layer|deadbush|bush$)/;
const TAPER = 6; // how far out the land is shaped at most
const slope = (k) => Math.ceil(k / 2); // how far the land may stand above or below the edge, k blocks out
// The shaping passes yield by block lookups, not loop steps: one step can look at 20 or 30 blocks (the watchdog rule)
let lookups = 0;
const look = (dim, x, y, z) => { lookups++; try { return dim.getBlock({ x, y, z }); } catch { return undefined; } };
const topAt = (dim, x, z, from) => { lookups += 8; return groundTop(dim, x, z, from); };
const tired = () => { if (lookups < PER_TICK) return false; lookups = 0; return true; };

function* blendGround(dim, town, layout, tier) {
  const cols = new Map(); // "dx,dz" -> { lo, hi } of the blocks this tier lays (air rows don't count)
  const member = new Set();
  for (let t = 0; t <= tier; t++) for (const [dx, dy, dz, p] of groundwork(layout, t)) {
    const k = `${dx},${dz}`;
    member.add(k);
    if (t !== tier || layout.pal[p]?.[0] === "minecraft:air") continue;
    const c = cols.get(k);
    if (!c) cols.set(k, { dx, dz, lo: dy, hi: dy });
    else { c.lo = Math.min(c.lo, dy); c.hi = Math.max(c.hi, dy); }
  }
  const dirt = perm("minecraft:dirt"), stone = perm("minecraft:stone"), grass = perm("minecraft:grass_block"), air = perm("minecraft:air");
  const get = (x, y, z) => look(dim, x, y, z);
  // 1. fill under every column down to the ground
  for (const c of cols.values()) {
    const x = town.x + c.dx, z = town.z + c.dz;
    for (let y = town.y + c.lo - 1, k = 0; k < 16; y--, k++) {
      if (tired()) yield;
      const b = get(x, y, z);
      if (!b || !/air|water|lava|short_grass|tall_grass|fern|flower|snow_layer|leaves/.test(b.typeId)) break;
      try { b.setPermutation(k < 3 ? dirt : stone); } catch { break; }
    }
  }
  // 2. shape the land outside the edge
  for (const c of cols.values()) {
    const h = town.y + c.hi; // the top of the edge column
    for (const [ux, uz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (member.has(`${c.dx + ux},${c.dz + uz}`)) continue;
      for (let k = 1; k <= TAPER; k++) {
        if (member.has(`${c.dx + ux * k},${c.dz + uz * k}`)) break;
        if (tired()) yield;
        const x = town.x + c.dx + ux * k, z = town.z + c.dz + uz * k;
        const top = topAt(dim, x, z, h + 24);
        if (top === undefined) break;
        const hiOk = h + slope(k), loOk = h - slope(k);
        if (top > hiOk) {
          let natural = true;
          for (let y = top; y > hiOk; y--) {
            const b = get(x, y, z);
            if (!b || (!NATURAL.test(b.typeId) && b.typeId !== "minecraft:air")) { natural = false; break; }
          }
          if (!natural) break; // something built stands there: leave it
          for (let y = top + 1; y > hiOk; y--) get(x, y, z)?.setPermutation(air); // + the snow or grass on top
          const b = get(x, hiOk, z);
          if (b && /dirt$|stone$|gravel|andesite|diorite|granite|tuff/.test(b.typeId)) b.setPermutation(grass);
        } else if (top < loOk) {
          const surface = get(x, top, z);
          const cap = surface && NATURAL.test(surface.typeId) && !/stone$|andesite|diorite|granite|tuff|cobble/.test(surface.typeId) ? surface.permutation : grass;
          for (let y = top + 1; y <= loOk; y++) get(x, y, z)?.setPermutation(y === loOk ? cap : dirt);
          if (surface?.typeId === "minecraft:grass_block") surface.setPermutation(dirt);
        } else break; // the land is already within the slope from here on
      }
    }
  }
  // 3. no snow or plant left on air: where the groundwork cut the land lower (or a pond under it), the snow layer that
  // lay on the old ground stayed a block up in the air (the 2026-11-14 town audit: dozens in each Frostmarch Hamlet)
  const tops = new Map();
  for (let t = 0; t <= tier; t++) for (const [dx, dy, dz] of groundwork(layout, t)) {
    const k = `${dx},${dz}`;
    if ((tops.get(k)?.dy ?? -999) < dy) tops.set(k, { dx, dy, dz });
  }
  for (const c of tops.values()) {
    const x = town.x + c.dx, z = town.z + c.dz;
    for (let y = town.y + c.dy + 1, k = 0; k < 4; y++, k++) {
      if (tired()) yield;
      const b = get(x, y, z);
      if (!b || !LOOSE.test(b.typeId)) continue;
      const under = get(x, y - 1, z);
      if (under && /air$|water|lava|snow_layer|short_grass|tall_grass|fern|flower/.test(under.typeId)) try { b.setPermutation(air); } catch { /* protected */ }
    }
  }
}
const LOOSE = /snow_layer|short_grass|tall_grass|fern$|flower|dandelion|poppy|tulip|daisy|cornflower|bluet|orchid|allium|lily_of_the_valley|deadbush|dead_bush/;

// ---------- joining the gate road to the map's roads (Mateo's playtests 2026-11-12 and 2026-11-13) ----------
// The settlement's road runs out through the gate and then must carry on to the map's own roads. Each map plot's
// route is worked out on the map itself (tools/export_road_joins.mjs -> roadjoin_data.js): straight out along the
// gate line to the edge of the settlement land, then round water and steep ground to the nearest road. Before that
// the game only looked 48 blocks straight ahead, and at four plots no road is that close, so the road stopped dead
// in the grass ("My path just ends"). A plot with no route (a test town) still looks ahead for a road as before.
// The road is 5 wide like the gate road, graded to the ground at most 1 a block, in the map roads' own block mix:
// natural ground above it is cut away, air and water below it filled, built things left alone, and the land either
// side stepped to it by at most 1. Only ground the town has already laid out is kept off; the later tiers' gate road
// lies on the route's straight part and is laid over it when the town grows (the old joiner kept off that too, which
// left a gap of ten or more blocks between the town and the road). The far end of the route is held loaded with a
// ticking area while it is worked, so it gets laid even with nobody standing out there.
// Towns founded before (or whose road never joined) get their road on the next start: settle_roadjoin below.
const ROAD_REACH = 48;
const JOIN_VERSION = 2; // towns whose road was joined by an older joiner get it again
const JOIN_AREA = "hc_road_join";
const JOIN_PIECE = 40; // route cells worked under one ticking area (well inside the ticking area size limit)
const JOIN_HALF = 2; // 5 wide

function* holdLoaded(dim, cells, town) {
  const xs = cells.map((c) => town.x + c.x), zs = cells.map((c) => town.z + c.z);
  const x0 = Math.min(...xs) - 8, x1 = Math.max(...xs) + 8, z0 = Math.min(...zs) - 8, z1 = Math.max(...zs) + 8;
  try { dim.runCommand(`tickingarea remove ${JOIN_AREA}`); } catch { /* none yet */ }
  try { dim.runCommand(`tickingarea add ${x0} 0 ${z0} ${x1} 0 ${z1} ${JOIN_AREA} true`); } catch { /* the area may be held by players anyway */ }
  const probe = [[x0 + 8, z0 + 8], [x1 - 8, z1 - 8], [x0 + 8, z1 - 8], [x1 - 8, z0 + 8]];
  for (let t = 0; t < 600; t += 10) {
    if (probe.every(([x, z]) => { try { return !!dim.getBlock({ x, y: town.y, z }); } catch { return false; } })) return true;
    for (let i = 0; i < 10; i++) yield;
  }
  return false;
}
const dropLoaded = (dim) => { try { dim.runCommand(`tickingarea remove ${JOIN_AREA}`); } catch { /* gone */ } };

// The laid-out ground of the town (tiers 0..upTo) and the Hamlet gate road's end
function townPaths(layout, upTo) {
  const member = new Set(), tops = new Map();
  for (let t = 0; t <= upTo; t++) for (const [dx, dy, dz, p] of groundwork(layout, t)) {
    member.add(`${dx},${dz}`);
    if (t !== 0) continue;
    const id = layout.pal[p]?.[0] ?? "";
    const k = `${dx},${dz}`;
    if (id !== "minecraft:air" && (!tops.has(k) || tops.get(k).dy < dy)) tops.set(k, { x: dx, z: dz, dy, id });
  }
  return { member, paths: [...tops.values()].filter((c) => ROAD_JOIN_PATHY.test(c.id)) };
}

// No worked-out route (a town on a plot the map doesn't have): the nearest map road ahead, as before
function* lookAhead(dim, town, end, dir, member, h0) {
  const get = (x, y, z) => look(dim, x, y, z);
  let found, best = Infinity;
  const side = { x: -dir.z, z: dir.x };
  for (let r = 3; r <= ROAD_REACH && r < best; r++) {
    for (let s = -r; s <= r; s++) {
      if (tired()) yield;
      const lx = end.x + dir.x * r + side.x * s, lz = end.z + dir.z * r + side.z * s;
      if (member.has(`${lx},${lz}`)) continue;
      const x = town.x + lx, z = town.z + lz;
      const y = topAt(dim, x, z, h0 + 24);
      if (y === undefined) continue;
      const b = get(x, y, z);
      if (!b || !ROAD_BLOCKS.test(b.typeId)) continue;
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([ax, az]) => ROAD_BLOCKS.test(get(x + ax, y, z + az)?.typeId ?? "")).length;
      if (near < 2) continue;
      const d = Math.hypot(r, s) + (WEAK_ROAD.test(b.typeId) ? 12 : 0);
      if (d < best) { best = d; found = { x: lx, z: lz }; }
    }
  }
  return found;
}

function* joinRoad(dim, town, layout, upTo = 0) {
  const tw = townFor(town.plot);
  if (!tw) return;
  const dir = gateDir(tw.gate);
  const { member, paths } = townPaths(layout, upTo);
  const end = roadEnd(paths, dir);
  if (!end) return;
  const h0 = town.y + end.dy;
  const region = PLOT_PLAN.find((p) => p.name.toLowerCase() === town.plot)?.region;
  const join = ROAD_JOINS[town.plot];
  let cells;
  if (join) cells = joinRoute(join, { x: end.x, z: end.z });
  else {
    const found = yield* lookAhead(dim, town, end, dir, member, h0);
    if (!found) { town.roadJoined = { v: JOIN_VERSION, none: true }; save(); return; }
    cells = roadLine({ x: end.x, z: end.z }, found);
  }
  const get = (x, y, z) => look(dim, x, y, z);
  const pieces = [];
  for (let i = 0; i < cells.length; i += JOIN_PIECE) pieces.push([i, Math.min(cells.length, i + JOIN_PIECE + 1)]);
  // 1. the ground along the route, and the map road's own height where it ends
  const ground = new Array(cells.length).fill(undefined);
  let h1, lost = false;
  for (const [a, b] of pieces) {
    if (!(yield* holdLoaded(dim, cells.slice(a, b), town))) { lost = true; break; }
    for (let i = a; i < b; i++) {
      if (tired()) yield;
      ground[i] = groundTop(dim, town.x + cells[i].x, town.z + cells[i].z);
    }
  }
  if (!lost) {
    const last = cells[cells.length - 1];
    for (let r = 0; r <= 3 && h1 === undefined; r++) for (let ox = -r; ox <= r && h1 === undefined; ox++) for (let oz = -r; oz <= r; oz++) {
      const x = town.x + last.x + ox, z = town.z + last.z + oz, y = groundTop(dim, x, z);
      if (y !== undefined && ROAD_BLOCKS.test(get(x, y, z)?.typeId ?? "")) { h1 = y; break; }
    }
  }
  if (lost) {
    dropLoaded(dim);
    town.roadJoined = { v: JOIN_VERSION, tries: (town.roadJoined?.tries ?? 0) + 1, waiting: true };
    save();
    return;
  }
  const heights = gradeRoute(ground, h0, h1 ?? ground[ground.length - 1]);
  // 2. the road, a piece at a time
  const air = perm("minecraft:air"), dirt = perm("minecraft:dirt"), grass = perm("minecraft:grass_block");
  const laid = new Set();
  for (const [a, b] of pieces) {
    if (!(yield* holdLoaded(dim, cells.slice(a, b), town))) { lost = true; break; }
    for (let i = Math.max(1, a); i < b; i++) {
      const { x: lx, z: lz } = cells[i], y = heights[i];
      const side = routeSides(cells, i);
      for (let w = -JOIN_HALF; w <= JOIN_HALF; w++) {
        const cx = lx + side.x * w, cz = lz + side.z * w;
        if (member.has(`${cx},${cz}`) || laid.has(`${cx},${cz}`)) continue;
        laid.add(`${cx},${cz}`);
        if (tired()) yield;
        const x = town.x + cx, z = town.z + cz;
        const here = get(x, y, z);
        if (!here || (!NATURAL.test(here.typeId) && !here.isAir && !SOFT.test(here.typeId) && !ROAD_BLOCKS.test(here.typeId))) continue; // built: leave it
        // cut natural ground (and plants) above the road, 4 high, so it stays open to the sky
        let open = true;
        for (let k = 1; k <= 4; k++) {
          const bl = get(x, y + k, z);
          if (!bl || bl.isAir) continue;
          if (!NATURAL.test(bl.typeId) && !SOFT.test(bl.typeId)) { open = false; break; }
        }
        if (!open) continue;
        for (let k = 1; k <= 6; k++) { const bl = get(x, y + k, z); if (bl && !bl.isAir && (NATURAL.test(bl.typeId) || SOFT.test(bl.typeId))) bl.setPermutation(air); }
        // fill below, so nothing floats
        for (let k = 1; k <= 12; k++) {
          const bl = get(x, y - k, z);
          if (!bl || !/air|water|short_grass|tall_grass|fern|flower|snow_layer|leaves/.test(bl.typeId)) break;
          bl.setPermutation(dirt);
        }
        const surface = perm(joinSurface(region, x, z));
        if (surface) here.setPermutation(surface);
      }
    }
    // the land either side steps down or up to the road by at most 1 a block
    for (let i = Math.max(1, a); i < b; i++) {
      const { x: lx, z: lz } = cells[i], y = heights[i];
      const side = routeSides(cells, i);
      for (const sgn of [-1, 1]) for (let k = JOIN_HALF + 1; k <= JOIN_HALF + 3; k++) {
        const cx = lx + side.x * sgn * k, cz = lz + side.z * sgn * k;
        if (member.has(`${cx},${cz}`) || laid.has(`${cx},${cz}`)) break;
        if (tired()) yield;
        const x = town.x + cx, z = town.z + cz;
        const top = topAt(dim, x, z, y + 12);
        if (top === undefined) break;
        const lim = k - JOIN_HALF;
        if (top > y + lim) {
          let natural = true;
          for (let yy = top; yy > y + lim; yy--) { const bl = get(x, yy, z); if (!bl || (!NATURAL.test(bl.typeId) && !bl.isAir)) { natural = false; break; } }
          if (!natural) break;
          for (let yy = top; yy > y + lim; yy--) get(x, yy, z)?.setPermutation(air);
          const bl = get(x, y + lim, z);
          if (bl && /dirt$|stone$|gravel|andesite|diorite|granite|tuff/.test(bl.typeId)) bl.setPermutation(grass);
        } else if (top < y - lim) {
          for (let yy = top + 1; yy <= y - lim; yy++) get(x, yy, z)?.setPermutation(yy === y - lim ? grass : dirt);
        } else break;
      }
    }
  }
  dropLoaded(dim);
  const last = cells[cells.length - 1];
  town.roadJoined = lost
    ? { v: JOIN_VERSION, tries: (town.roadJoined?.tries ?? 0) + 1, waiting: true }
    : { v: JOIN_VERSION, x: town.x + last.x, z: town.z + last.z, length: cells.length };
  save();
}

// Towns laid out before this joiner (or whose road could not be worked yet) get their road: one town at a time,
// never during a siege, a few tries each.
export const needsRoad = (town) => !!town?.laid?.[0] && !(town.roadJoined?.v === JOIN_VERSION && !town.roadJoined.waiting) && (town.roadJoined?.tries ?? 0) < 5;
let joining = false;
onTick("settle_roadjoin", 200, () => {
  if (joining || !isReady() || getState().active) return;
  const owner = Object.keys(store.data.towns).find((k) => needsRoad(store.data.towns[k]) && !running.get(k));
  if (!owner) return;
  const town = store.data.towns[owner], layout = layoutOf(town);
  if (!layout) return;
  joining = true;
  running.set(owner, true);
  const upTo = Math.max(0, town.laid.lastIndexOf(true));
  system.runJob((function* () {
    try { yield* joinRoad(world.getDimension(OVERWORLD), town, layout, upTo); } catch (e) { console.warn(`[Hollow Crown] road join ${town.plot}: ${e}`); town.roadJoined = { v: JOIN_VERSION, tries: (town.roadJoined?.tries ?? 0) + 1, waiting: true }; save(); }
    running.delete(owner);
    joining = false;
  })());
});

// What's underneath (Mateo 2026-11-14: "under it is ____ but it's a slab so it's floating. Needs to be a full block"):
// nothing rests on a bottom slab. The square's sunk-slab paving under a bench, a table or a lamp post becomes its
// double slab, so the piece stands on a full block instead of half a block of air.
const NOT_RESTING = /(:air$|water|lava|chain$|leaves|trapdoor|vine|snow_layer|scaffolding|ladder|_button$|wall_sign|frame$|_slab$|torch)/;
export const restsOn = (id, states) => !NOT_RESTING.test(id) && !(id.endsWith("lantern") && states?.hanging) && !states?.upside_down_bit
  && states?.half !== "top" && !states?.upper_block_bit;
export const fullSlab = (id) => (id.endsWith("_slab") && !id.includes("double") ? id.replace(/_slab$/, "_double_slab") : undefined);
function fullUnder(dim, at) {
  let below;
  try { below = dim.getBlock({ x: at.x, y: at.y - 1, z: at.z }); } catch { return; }
  const full = below && fullSlab(below.typeId);
  if (!full) return;
  let half;
  try { half = below.permutation.getState("minecraft:vertical_half"); } catch { half = undefined; }
  if (half !== "bottom") return;
  const p = perm(full, {});
  if (p) try { below.setPermutation(p); } catch { /* protected block */ }
}

function setAt(dim, at, id, states) {
  const p = perm(id, states);
  const block = dim.getBlock(at);
  if (p && block) block.setPermutation(p);
  if (p && restsOn(id, states)) fullUnder(dim, at);
}

function placeFixture(owner, town, f) {
  const dim = world.getDimension(OVERWORLD);
  const x = town.x + f.x, z = town.z + f.z;
  const ground = f.dy !== undefined && f.dy !== null ? town.y + f.dy : surfaceY(dim, x, z);
  if (ground === undefined) return;
  const y = ground + 1;
  if (f.kind === "lamp") {
    setAt(dim, { x, y, z }, "minecraft:spruce_fence");
    setAt(dim, { x, y: y + 1, z }, "minecraft:spruce_fence");
    setAt(dim, { x, y: y + 2, z }, "minecraft:lantern");
  } else if (f.kind === "well") {
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      if (dx || dz) setAt(dim, { x: x + dx, y, z: z + dz }, "minecraft:stone_bricks");
      else { setAt(dim, { x, y: ground, z }, "minecraft:water"); setAt(dim, { x, y, z }, "minecraft:air"); }
    }
    for (const [dx, dz] of [[-1, -1], [1, 1]]) for (let h = 1; h <= 2; h++) setAt(dim, { x: x + dx, y: y + h, z: z + dz }, "minecraft:spruce_fence");
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) setAt(dim, { x: x + dx, y: y + 3, z: z + dz }, "minecraft:spruce_slab", { "minecraft:vertical_half": "bottom" });
  } else if (f.kind === "mason_bench") {
    if (town.lord) return; // a lord's town has no mason for players
    // the bench goes in the Mason's Yard (basebuilds.js); this spot is kept for when the yard can't be raised
    town.benchSpot = { x, y, z };
    save();
  } else if (f.kind === "hall_cornerstone") {
    if (town.lord) town.hallSeat = { x, y, z, ...hallFacing(town, { x, z }) }; // the lord raises it (rivals/index.js)
    else foundHall(owner, town, { x, y, z });
  } else if (f.kind === "tree" || f.kind === "windmill") {
    emit("settleFixture", { owner, kind: f.kind, species: f.species, size: f.size, rotation: f.rotation ?? 0, stamp: f.stamp, at: { x, y, z }, tier: f.tier });
  }
}

// Which way the hall grows from its cornerstone: into the layout's hall ground
function hallFacing(town, at) {
  const box = layoutOf(town).hall[0];
  const cx = town.x + (box[0] + box[2]) / 2, cz = town.z + (box[1] + box[3]) / 2;
  const fx = Math.abs(cx - at.x) >= Math.abs(cz - at.z) ? Math.sign(cx - at.x) : 0;
  const fz = fx ? 0 : Math.sign(cz - at.z) || 1;
  return { fx, fz };
}

// The Longhouse, already paid for, growing away from the gate
function foundHall(owner, town, at) {
  const old = halls()[owner];
  if ((old && !old.lost) || buildFor(owner)) return;
  const { fx, fz } = hallFacing(town, at);
  world.getDimension(OVERWORLD).getBlock(at)?.setType(CORNERSTONE);
  halls()[owner] = { x: at.x, y: at.y, z: at.z, fx, fz, level: 0, paid: Math.max(1, old?.paid ?? 0), best: old?.best ?? 0, style: old?.style ?? town.style, building: null, marks: {} };
  saveHalls();
  beginBuild(owner, 1, halls()[owner].style);
}

// Where a slot's marker stands: the middle of its front row, on the floor, where the door will be
export function markerSpot(town, slot) {
  const seat = seatOnSlot(slot, { x0: 0, x1: 0, y0: 0, y1: 0, z0: 0, z1: 0 });
  return { x: town.x + seat.origin.dx, y: town.y + slot.dy + 1, z: town.z + seat.origin.dz };
}

// A plot that is gone for good: the level-4 or level-5 town hall took its ground (hallmove.js)
// Where a player should go to raise building `id` (the first-nights tracker's pin): its plot if one is rising or
// stands, else the nearest open, empty plot it fits. -> { x, z, state: "free" | "rising" | "built", slotId } or undefined.
// x, z: the plot's door step, where its Plot Marker stands.
export function plotFor(owner, id) {
  const town = townOf(owner);
  if (!town) return undefined;
  const slots = slotsOf(layoutOf(town));
  const at = (s, state) => ({ x: town.x + s.step.x, z: town.z + s.step.z, state, slotId: s.id });
  const mine = slots.find((s) => town.slots?.[s.id]?.building === id && !town.slots[s.id].broken);
  if (mine) return at(mine, town.slots[mine.id].done === false ? "rising" : "built");
  const free = slots.filter((s) => s.tier <= (town.tier ?? 0) && !town.slots?.[s.id]?.building && !town.slots?.[s.id]?.base && !slotClosed(owner, s) && plotFit(id, s).ok);
  free.sort((a, b) => Math.hypot(a.step.x, a.step.z) - Math.hypot(b.step.x, b.step.z));
  return free[0] && at(free[0], "free");
}

export function slotClosed(owner, slot) {
  const town = townOf(owner);
  if (town?.slots[slot.id]?.closed) return true;
  const tags = slot.tags ?? [], level = halls()[owner]?.level ?? 0;
  return (tags.includes("hall4") && level >= 4) || (tags.includes("hall5") && level >= 5);
}

export function placeMarker(owner, slot) {
  const town = townOf(owner);
  if (slotClosed(owner, slot)) return false;
  const at = markerSpot(town, slot);
  try {
    const block = world.getDimension(OVERWORLD).getBlock(at);
    if (!block) return false;
    setMarkerBlock(block, slot.door);
  } catch {
    return false;
  }
  store.data.markers[keyOf(at)] = { owner, slot: slot.id };
  save();
  return true;
}

export function clearMarker(owner, slot) {
  const town = townOf(owner);
  const at = markerSpot(town, slot);
  delete store.data.markers[keyOf(at)];
  save();
  try {
    const block = world.getDimension(OVERWORLD).getBlock(at);
    if (block?.typeId === PLOT_MARKER) block.setType("minecraft:air");
  } catch {
    // not loaded: the build replaces it
  }
}

function placeMarkers(owner, tier) {
  const town = townOf(owner);
  if (town.lord) return; // nobody buys plots in a lord's town
  for (const slot of slotsOf(layoutOf(town))) {
    if (slot.tier !== tier || town.slots[slot.id]?.building) continue;
    placeMarker(owner, slot);
  }
}

// Lay out one tier (once). done(ok) runs when it is finished.
export function layOutTier(owner, tier, done = () => {}) {
  const town = townOf(owner);
  if (!town || !layoutOf(town)) return done(false);
  if (town.laid[tier]) return done(true);
  if (running.get(owner)) return system.runTimeout(() => layOutTier(owner, tier, done), 40);
  running.set(owner, true);
  system.runJob(layOutJob(owner, tier, () => {
    running.delete(owner);
    town.laid[tier] = true;
    save();
    emit("townLaidOut", { owner, tier });
    done(true);
  }));
}

// ---------- founding and growing ----------

// A town for owner round the Plot Stone at `at`, on map plot `plot` (its config entry). Returns a reason or true.
// lord: true for a Rival Lord's town (owner is the lord's key, "npc:<plot id>"): no plot markers, no mason, and
// the hall is left to the lord. A player founding on a plot where a lord's town stands takes that town over.
export function foundTown(owner, plot, at, { style, layout, lord = false } = {}) {
  const tw = townFor(plot?.name);
  if (!tw) return "This plot has no town layout.";
  if (!lord) {
    const left = lordTownAt(at.x, at.z);
    if (left) return adoptTown(left, owner) ? true : "That settlement already has a holder.";
    if (townOf(owner)?.from && townOf(owner).x === at.x && townOf(owner).z === at.z) return true; // already taken over
  }
  const dim = world.getDimension(OVERWORLD);
  if (!dim.getBlock(at)) return "That ground is not loaded yet.";
  const old = townOf(owner);
  if (old && old.plot === plot.name.toLowerCase() && old.x === at.x && old.z === at.z) return "already";
  const live = squareY(dim, at);
  if (live === undefined) return "That ground is not loaded yet.";
  const pick = layout ?? pickLayout(tw, `${owner}:${plot.name}`);
  // the layout was planned on the map's own heights: lay it from the square's planned height, so it meets the land
  // it was drawn for (a live median was a block or two off and left shelves and floating paths, playtest 2026-11-12);
  // a world whose ground was changed (more than 2 off) falls back to the live height
  const base = tw.variants[pick]?.base;
  const y = Number.isFinite(base) && Math.abs(base - live) <= 2 ? base : live;
  store.data.towns[owner] = {
    plot: plot.name.toLowerCase(), layout: pick, layoutKey: layoutKey(tw.variants[pick]), x: at.x, y, z: at.z, tier: 0, laid: [false, false, false, false], slots: {}, ...(lord ? { lord: true } : {}),
    style: style ?? REGION_TO_STYLE[plot.region] ?? styleOf(owner, dim.getBlock(at)),
  };
  save();
  const town = townOf(owner);
  if (!wallOf(owner) || wallOf(owner).x !== at.x || wallOf(owner).z !== at.z) {
    raiseWall(owner, 1, { center: { x: at.x, y: at.y, z: at.z }, style: town.style, bearing: tw.gate, radius: wallRadius(tw, 0), shape: wallShape(tw.name), outline: { ...tw.outline, tight: HAMLET_WALLS[plot.name.toLowerCase()] } });
  }
  layOutTier(owner, 0);
  return true;
}

// ---------- a lord's town changes hands ----------

// The key of a Rival Lord's town standing round this Plot Stone, if any
export function lordTownAt(x, z) {
  return Object.keys(store.data.towns).find((k) => store.data.towns[k].lord && store.data.towns[k].x === x && store.data.towns[k].z === z);
}

// A player takes over a lord's town as it stands: layout, roads, every building on its plot, the tier its
// buildings and wall reached. Its empty open plots get markers. The wall is handed over by rivals/index.js
// (adoptWall). Returns false if there was nothing to take, or the player already has a town elsewhere.
export function adoptTown(from, to) {
  const town = store.data.towns[from];
  if (!town || from === to) return false;
  const mine = store.data.towns[to];
  if (mine && !(mine.x === town.x && mine.z === town.z)) return false; // they keep the town they already have
  delete store.data.towns[from];
  delete town.lord;
  delete town.hallSeat;
  delete town.heldTier;
  delete town.pendingTier;
  town.from = from;
  store.data.towns[to] = town;
  for (const m of Object.values(store.data.markers)) if (m.owner === from) m.owner = to;
  adoptWall(from, to); // the lord's wall (rivals/index.js does it too; whichever runs first wins)
  save();
  for (let t = 0; t <= town.tier; t++) if (town.laid[t]) placeMarkers(to, t);
  emit("townAdopted", { from, owner: to });
  return true;
}

// ---------- charters ----------

// Every building the game can raise (plot designs and block buildings), for skipping charter lines not built yet
// (designs, block buildings, and anything that can be built by hand and registered: config.js CONTENTS)
const KNOWN = new Set([...BUILDINGS.map((b) => b.id), ...Object.keys(BLOCK_BUILDS).map((t) => t.replace(/^siege:/, "")), ...CONTENTS.map((c) => c.id)]);

// What stands in a town: finished plot buildings plus finished block buildings on its land
export function builtCounts(owner) {
  const counts = { ...raisedCounts(owner) };
  for (const st of Object.values(townOf(owner)?.slots ?? {})) if (st.building && st.done !== false && !st.broken) counts[st.building] = (counts[st.building] ?? 0) + 1;
  return counts;
}
// What stands or is going up in a town, for the one-of-each rule (config.js ONE_EACH): plot buildings rising,
// finished or hand-built (a hand-built one missing something still stands), and block buildings rising or finished
export function standingCounts(owner) {
  const counts = { ...raisedCounts(owner, { rising: true }) };
  for (const st of Object.values(townOf(owner)?.slots ?? {})) if (st.building) counts[st.building] = (counts[st.building] ?? 0) + 1;
  return counts;
}
// Why `id` can't be raised again in this settlement, or undefined
export const oneEachProblem = (owner, id) => oneEachTaken(id, standingCounts(owner));

// A Rival Lord can only raise ready-made designs, so their charter skips what has none yet
const DESIGNED = new Set(BUILDINGS.map((b) => b.id));
export const charterOf = (owner, tier = townOf(owner)?.tier ?? 0) => charterCheck(tier, builtCounts(owner), townOf(owner)?.lord ? DESIGNED : KNOWN);

// Is this plot kept for a charter need, so `id` may not go there? (charters.js charterKeeps; the same rule the
// Rival Lords follow.) -> undefined, or the words for the plot menu: "Kept for the Mint (Town charter)"
export function keptFor(owner, slot, id) {
  const town = townOf(owner);
  if (!town) return undefined;
  const counts = { ...raisedCounts(owner) };
  for (const st of Object.values(town.slots ?? {})) if (st.building && !st.broken) counts[st.building] = (counts[st.building] ?? 0) + 1; // rising ones too
  const free = slotsOf(layoutOf(town)).filter((s) => !town.slots[s.id]?.building && !slotClosed(owner, s));
  const k = charterKeeps(free, town.tier ?? 0, counts, town.lord ? DESIGNED : KNOWN, slot, id);
  return k && `Kept for the ${k.what} (${tierName(k.tier)} charter)`;
}

// The highest tier the town may reach towards `tier`: it stops at the first tier whose charter isn't met
function charterCap(owner, from, tier) {
  for (let t = from; t < tier; t++) if (!charterOf(owner, t).met) return t;
  return tier;
}

function tellCharter(owner, at, wanted) {
  const player = world.getPlayers().find((p) => p.id === owner);
  if (!player) return;
  player.sendMessage(`§6Your settlement has won enough to be a ${tierName(wanted)}§7, but a ${tierName(at)} needs these standing first:`);
  for (const line of charterText(charterOf(owner, at))) player.sendMessage(`  ${line}`);
}

// Bring a town up to tier t: lay out every band up to it and move the wall out.
// force skips the charter (test command only).
export function growTown(owner, tier, { force = false } = {}) {
  const town = townOf(owner);
  if (!town) return "No town layout here.";
  const tw = townFor(town.plot);
  tier = Math.max(0, Math.min(3, tier));
  if (tier <= town.tier) return "already";
  if (!force) {
    const cap = charterCap(owner, town.tier, tier);
    if (cap < tier) {
      if (town.heldTier !== tier) { town.heldTier = tier; save(); tellCharter(owner, cap, tier); }
      if (cap <= town.tier) return `The ${tierName(town.tier)} charter isn't met yet: /scriptevent siege:town charter`;
      tier = cap;
    }
  }
  if (getState().active) { // the wall never moves during a siege: it grows when the siege ends
    town.pendingTier = Math.max(town.pendingTier ?? 0, tier);
    save();
    return "The town grows when the siege ends: the wall never moves during one.";
  }
  delete town.pendingTier;
  if ((town.heldTier ?? 0) <= tier) delete town.heldTier;
  town.tier = tier;
  save();
  // the old ring comes down first, so the ring road laid where it stood isn't knocked out again
  moveWall(owner, wallRadius(tw, tier), () => { for (let t = 1; t <= tier; t++) layOutTier(owner, t); });
  return true;
}

// A building finished (or a block building raised): a town held back by its charter may grow now
on("settleCharter", ({ owner }) => {
  const town = townOf(owner);
  if (!town?.heldTier || town.heldTier <= town.tier) return;
  if (!charterOf(owner).met) return;
  system.runTimeout(() => {
    const held = townOf(owner)?.heldTier;
    if (held && growTown(owner, held) === true) {
      const player = world.getPlayers().find((p) => p.id === owner);
      player?.sendMessage(`§6The charter is met. Your settlement grows to a ${tierName(townOf(owner).tier)}.`);
    }
  }, 40);
});

on("siegeEnd", () => {
  system.runTimeout(() => {
    for (const [owner, town] of Object.entries(allTowns())) if (town.pendingTier) growTown(owner, town.pendingTier);
  }, 100);
});

on("tierUp", ({ owner, after }) => {
  if (!townOf(owner)) return;
  system.runTimeout(() => growTown(owner, Math.max(0, TIERS.indexOf(after))), 20);
});

// Picking the slot a building can go on: callers ask which designs fit
export const slotOpen = (owner, slot) => slot.tier <= (townOf(owner)?.tier ?? 0);
export function slotState(owner, id) {
  const town = townOf(owner);
  if (!town) return {};
  return (town.slots[id] ??= {});
}
export const saveTowns = save;
export const tierName = (t) => TIER_NAMES[t] ?? "later";

// ---------- test command ----------

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "siege:town") return;
  const player = event.sourceEntity;
  if (player?.typeId !== "minecraft:player" || !isReady()) return;
  const [cmd = "info", arg] = event.message.trim().split(/\s+/);
  const town = townOf(player.id);
  if (cmd === "info") {
    if (!town) return player.sendMessage("§7You have no town layout. /scriptevent siege:town found <plot name> lays one out where you stand.");
    const layout = layoutOf(town);
    const slots = slotsOf(layout);
    return player.sendMessage(`§6${townFor(town.plot).name}§7, layout ${layout.label}, tier ${tierName(town.tier)}. Slots open: ${slots.filter((s) => s.tier <= town.tier).length} of ${slots.length}. Laid out: ${town.laid.map((l, i) => (l ? tierName(i) : "")).filter(Boolean).join(", ") || "nothing yet"}.`);
  }
  if (cmd === "found") {
    const [, name = "dunehold", which] = event.message.trim().split(/\s+/);
    const tw = townFor(name);
    if (!tw) return player.sendMessage("§7Unknown plot. Try dunehold, harrowford, frosthelm, ...");
    const at = { x: Math.floor(player.location.x), y: Math.floor(player.location.y), z: Math.floor(player.location.z) };
    delete store.data.towns[player.id];
    const result = foundTown(player.id, { name: tw.name }, at, { layout: /^[0-2]$/.test(which ?? "") ? Number(which) : undefined });
    return player.sendMessage(result === true ? `§6Laying out ${tw.name} round you.` : `§c${result}`);
  }
  if (cmd === "charter") {
    if (!town) return player.sendMessage("§7You have no town layout.");
    const check = charterOf(player.id);
    player.sendMessage(town.tier >= 3 ? "§6The full Castle charter:" : `§6To grow past ${tierName(town.tier)}${check.met ? " §a(met)" : ""}:`);
    const lines = charterText(check);
    if (!lines.length) player.sendMessage("  §7nothing beyond the library");
    for (const line of lines) player.sendMessage(`  ${line}`);
    return;
  }
  if (cmd === "road") { // lay the road out to the map's roads again (the next start of settle_roadjoin, within 10 s)
    if (!town) return player.sendMessage("§7You have no town layout.");
    delete town.roadJoined;
    save();
    return player.sendMessage(`§6The road out of ${townFor(town.plot).name} will be laid again in a few seconds.`);
  }
  if (cmd === "tier") {
    const result = growTown(player.id, Number(arg ?? (town?.tier ?? 0) + 1), { force: true });
    return player.sendMessage(result === true ? `§6The town grows to ${tierName(townOf(player.id).tier)}.` : `§7${result}`);
  }
  player.sendMessage("§7/scriptevent siege:town [info | charter | found <plot> [layout 0-2] | tier <0-3> | road]");
});
