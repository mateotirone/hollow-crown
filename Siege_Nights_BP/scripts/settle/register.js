// The plot register, buildings you build yourself, and the bed count.
//
// What other features can use:
//   plotRegistry(owner) -> [{ id, cls, tags, tier, open, box (world), floorY, status, building, hand, beds }]
//       status: "closed" (the level-5 hall took it) | "locked" (later tier) | "empty" | "marked" (outline up) | "rising" | "built" | "broken"
//   plotAtBlock(location) -> { owner, slot } | undefined   the town plot a block stands in
//   scanPlot(dim, box, floorY, height) -> generator; its return value is a census.js tally, or undefined
//       when part of the plot isn't loaded. Run it with system.runJob (see runScan).
//   runScan(owner, slotId) -> Promise<tally | undefined>
// Every dawn the homes are counted for beds (state.beds, state.bedSpots) and buildings registered by hand are
// checked again: one that no longer has what it needs is "broken" and stops counting until it is fixed.

import { world, system } from "@minecraft/server";
import { isReady, onTick, emit } from "../siege/api.js";
import { HOMES } from "./config.js";
import { tally, matches, bedsCounted } from "./census.js";
import { slotClass } from "./charters.js";
import { townOf, allTowns, layoutOf, saveTowns } from "./founding.js";
import { slotsOf } from "./towns.js";

const OVERWORLD = "minecraft:overworld";
export const SCAN_HEIGHT = 28;

const worldBox = (town, s) => ({ x0: town.x + s.box.x0, z0: town.z + s.box.z0, x1: town.x + s.box.x1, z1: town.z + s.box.z1 });
// The floor a plot's building stands on: a raised building's lifted floor, else the plot's graded ground
export const floorOf = (town, s, st) => (st?.origin && !st.hand ? st.origin.y + (st.lift ?? 0) : town.y + s.dy);

export function plotRegistry(owner) {
  const town = townOf(owner);
  if (!town) return [];
  return slotsOf(layoutOf(town)).map((s) => {
    const st = town.slots[s.id] ?? {};
    const open = s.tier <= town.tier;
    const status = st.closed && !st.building ? "closed" : !open ? "locked" : st.broken ? "broken" : st.building ? (st.done === false ? "rising" : "built") : st.pick ? "marked" : "empty";
    return { id: s.id, cls: slotClass(s), tags: s.tags, tier: s.tier, open, box: worldBox(town, s), floorY: floorOf(town, s, st), status, building: st.building, hand: !!st.hand, beds: st.beds ?? 0 };
  });
}

export function plotAtBlock(loc) {
  for (const [owner, town] of Object.entries(allTowns())) {
    if (Math.abs(loc.x - town.x) > 80 || Math.abs(loc.z - town.z) > 80) continue;
    for (const s of slotsOf(layoutOf(town))) {
      const b = worldBox(town, s);
      if (loc.x >= b.x0 && loc.x <= b.x1 && loc.z >= b.z0 && loc.z <= b.z1) return { owner, slot: s };
    }
  }
  return undefined;
}

// Every non-air block in the plot from the floor up, yielding as it goes
export function* scanPlot(dim, box, floorY, height = SCAN_HEIGHT) {
  const cells = [];
  let n = 0;
  for (let x = box.x0; x <= box.x1; x++) for (let z = box.z0; z <= box.z1; z++) for (let y = 0; y <= height; y++) {
    if (++n % 250 === 0) yield;
    let b;
    try { b = dim.getBlock({ x, y: floorY + y, z }); } catch { b = undefined; }
    if (!b) return undefined; // not loaded
    if (b.isAir) continue;
    const id = b.typeId;
    let head = false, upper = false;
    if (/bed$/.test(id)) try { head = !!b.permutation.getState("head_piece_bit"); } catch { /* no state */ }
    if (/door$/.test(id)) try { upper = !!b.permutation.getState("upper_block_bit"); } catch { /* no state */ }
    cells.push({ x: x - box.x0, y, z: z - box.z0, id, head, upper });
  }
  const t = tally(cells);
  t.beds = t.beds.map((p) => ({ x: p.x + box.x0, y: p.y + floorY, z: p.z + box.z0 }));
  return t;
}

export function runScan(owner, slotId) {
  const town = townOf(owner);
  const s = slotsOf(layoutOf(town)).find((x) => x.id === slotId);
  if (!s) return Promise.resolve(undefined);
  const gen = scanPlot(world.getDimension(OVERWORLD), worldBox(town, s), floorOf(town, s, town.slots[s.id]));
  return new Promise((resolve) => {
    system.runJob((function* wrap() {
      let r;
      try { r = yield* gen; } catch (e) { console.warn(`[Hollow Crown] plot scan: ${e}`); }
      resolve(r);
    })());
  });
}

// ---------- the dawn count ----------

// Homes: how many beds count. Hand-built buildings: still what they were registered as?
async function census(owner) {
  const town = townOf(owner);
  if (!town) return;
  let changed = false;
  for (const s of slotsOf(layoutOf(town))) {
    const st = town.slots[s.id];
    if (!st?.building || st.done === false) continue;
    const home = HOMES.includes(st.building);
    if (!home && !st.hand) continue;
    const t = await runScan(owner, s.id);
    if (!t) continue; // not loaded: keep the last count
    if (home) {
      const beds = bedsCounted(t);
      if (beds !== st.beds) changed = true;
      st.beds = beds;
      st.bedSpots = t.beds.slice(0, beds);
    }
    if (st.hand) {
      const ok = matches(t).find((m) => m.id === st.building)?.ok ?? false;
      if (ok === !!st.broken) { st.broken = !ok; changed = true; }
    }
  }
  saveTowns();
  if (changed) emit("settleCharter", { owner });
  emit("settleCensus", { owner });
}

export const countNow = (owner) => census(owner);

let lastDay = -1;
onTick("settle_census", 100, () => {
  if (!isReady()) return;
  const time = world.getTimeOfDay(); // 0 is sunrise
  const day = world.getDay();
  if (time > 2000 || day === lastDay) return;
  lastDay = day;
  const online = new Set(world.getPlayers().map((p) => p.id));
  for (const owner of Object.keys(allTowns())) if (online.has(owner)) census(owner).catch((e) => console.warn(`[Hollow Crown] census: ${e}`));
});
