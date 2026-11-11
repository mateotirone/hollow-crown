// Founding a town from its layout. When a player picks one of the twelve map plots, the settlement gets one of
// that plot's three hand-made layouts (towns.js) and the Hamlet part of it is laid out over a few seconds:
// roads and levelled ground, lamps, the well, the Mason's Bench, the Hall Cornerstone, a plot marker on every
// open slot, and the Hamlet wall. Each new tier lays out its own band: the wall moves out (32, 40, 48, 56),
// that tier's roads, ground and fixtures go down, and its slots get markers.
//
// What other features can use:
//   townOf(owner) -> { plot, layout, x, y, z, tier, slots: { id: { building?, style?, rising? } } } | undefined
//   townSlots(owner) -> slotsOf(layout) with world boxes added
//   on("settleFixture", ({ owner, kind, species, size, rotation, at, tier }))   trees and windmills, for the tree
//     and windmill builders (a tree is not planted here; world trees come from the tree thread)
//   on("townLaidOut", ({ owner, tier }))   a tier's groundwork is down
// Test: /scriptevent siege:town [info | found <plot> [layout 0-2] | tier <0-3>]

import { world, system, BlockPermutation } from "@minecraft/server";
import { isReady, keepOf, on, emit, moduleStore, TIERS, tierOf } from "../siege/api.js";
import { CORNERSTONE, halls, saveHalls, beginBuild } from "../townhall/townhall.js";
import { buildFor } from "../townhall/build.js";
import { REGION_TO_STYLE } from "./config.js";
import { BENCH, registerBench } from "./mason.js";
import { styleOf } from "./plans.js";
import { wallOf, raiseWall, moveWall } from "./walls.js";
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
const keyOf = (loc) => `${loc.x},${loc.y},${loc.z}`;
export const layoutOf = (town) => townFor(town?.plot)?.variants?.[town.layout];

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
    try { p = BlockPermutation.resolve(id, states); } catch { try { p = BlockPermutation.resolve(id); } catch { p = null; } }
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
  let rows = groundwork(layout, tier);
  for (let pass = 0; pass < 60 && rows.length; pass++) { // unloaded chunks: try again a little later
    const later = [];
    let n = 0;
    for (const [dx, dy, dz, p] of rows) {
      const at = { x: town.x + dx, y: town.y + dy, z: town.z + dz };
      if (dx === 0 && dz === 0) continue; // the Plot Stone's column
      let block;
      try { block = dim.getBlock(at); } catch { block = undefined; }
      if (!block) { later.push([dx, dy, dz, p]); continue; }
      try { if (pal[p] && block.permutation !== pal[p]) block.setPermutation(pal[p]); } catch { /* protected block */ }
      if (++n % PER_TICK === 0) yield;
    }
    rows = later;
    if (rows.length) for (let i = 0; i < 40; i++) yield; // ~2 s
  }
  yield;
  for (const f of fixturesOf(layout, tier)) {
    try { placeFixture(owner, town, f); } catch (e) { console.warn(`[Hollow Crown] town fixture ${f.kind}: ${e}`); }
    yield;
  }
  placeMarkers(owner, tier);
  done();
}

function setAt(dim, at, id, states) {
  const p = perm(id, states);
  const block = dim.getBlock(at);
  if (p && block) block.setPermutation(p);
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
    const block = dim.getBlock({ x, y, z });
    if (block && block.typeId !== BENCH) { block.setType(BENCH); registerBench(block, owner); }
  } else if (f.kind === "hall_cornerstone") {
    foundHall(owner, town, { x, y, z });
  } else if (f.kind === "tree" || f.kind === "windmill") {
    emit("settleFixture", { owner, kind: f.kind, species: f.species, size: f.size, rotation: f.rotation ?? 0, stamp: f.stamp, at: { x, y, z }, tier: f.tier });
  }
}

// The Longhouse, already paid for, growing away from the gate
function foundHall(owner, town, at) {
  const old = halls()[owner];
  if ((old && !old.lost) || buildFor(owner)) return;
  const box = layoutOf(town).hall[0];
  const cx = town.x + (box[0] + box[2]) / 2, cz = town.z + (box[1] + box[3]) / 2;
  const fx = Math.abs(cx - at.x) >= Math.abs(cz - at.z) ? Math.sign(cx - at.x) : 0;
  const fz = fx ? 0 : Math.sign(cz - at.z) || 1;
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

export function placeMarker(owner, slot) {
  const town = townOf(owner);
  const at = markerSpot(town, slot);
  try {
    const block = world.getDimension(OVERWORLD).getBlock(at);
    if (!block) return false;
    if (block.typeId !== PLOT_MARKER) block.setType(PLOT_MARKER);
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
export function foundTown(owner, plot, at, { style, layout } = {}) {
  const tw = townFor(plot?.name);
  if (!tw) return "This plot has no town layout.";
  const dim = world.getDimension(OVERWORLD);
  if (!dim.getBlock(at)) return "That ground is not loaded yet.";
  const old = townOf(owner);
  if (old && old.plot === plot.name.toLowerCase() && old.x === at.x && old.z === at.z) return "already";
  const y = squareY(dim, at);
  if (y === undefined) return "That ground is not loaded yet.";
  const pick = layout ?? pickLayout(tw, `${owner}:${plot.name}`);
  store.data.towns[owner] = {
    plot: plot.name.toLowerCase(), layout: pick, x: at.x, y, z: at.z, tier: 0, laid: [false, false, false, false], slots: {},
    style: style ?? REGION_TO_STYLE[plot.region] ?? styleOf(owner, dim.getBlock(at)),
  };
  save();
  const town = townOf(owner);
  if (!wallOf(owner) || wallOf(owner).x !== at.x || wallOf(owner).z !== at.z) {
    raiseWall(owner, 1, { center: { x: at.x, y: at.y, z: at.z }, style: town.style, bearing: tw.gate, radius: wallRadius(tw, 0) });
  }
  layOutTier(owner, 0);
  return true;
}

// Bring a town up to tier t: lay out every band up to it and move the wall out
export function growTown(owner, tier) {
  const town = townOf(owner);
  if (!town) return "No town layout here.";
  const tw = townFor(town.plot);
  tier = Math.max(0, Math.min(3, tier));
  if (tier <= town.tier) return "already";
  town.tier = tier;
  save();
  // the old ring comes down first, so the ring road laid where it stood isn't knocked out again
  moveWall(owner, wallRadius(tw, tier), () => { for (let t = 1; t <= tier; t++) layOutTier(owner, t); });
  return true;
}

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
  if (cmd === "tier") {
    const result = growTown(player.id, Number(arg ?? (town?.tier ?? 0) + 1));
    return player.sendMessage(result === true ? `§6The town grows to ${tierName(townOf(player.id).tier)}.` : `§7${result}`);
  }
  player.sendMessage("§7/scriptevent siege:town [info | found <plot> [layout 0-2] | tier <0-3>]");
});
