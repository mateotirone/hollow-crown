// What every new base raises with its groundwork, besides the hall and the library (Mateo's playtest 2026-11-12):
//   the Mason's Yard: the mason's workshop, with the Mason's Bench in its yard and the mason standing by it
//     ("the mason is still standing on top of his block ... his building needs to spawn with the rest").
//     On the layout's own "mason_yard" ground once the town generator reserves it, else on the Small plot nearest
//     the square. If neither fits, the bench goes where the layout put it, as before.
//   the founder's house: a cottage in the town's style on a Small plot, free, with a bed of the owner's own that
//     no settler ever takes ("does a house for me spawn ... cause I can't sleep"). On a map plot the starter village's
//     house tagged "founder" is that house (plotmarker.js raises it), so no cottage is added.
// Both are raised by the plot building engine (plans.js raise), so they rise like every other building.
// The founder's bed is checked every ten seconds while the owner is on (Mateo 2026-11-13: "my house doesn't have a
// bed in it"): a town with no founder's house adopts its finished house nearest the square (the starter village's
// "founder" one first), and a finished founder's house with no bed gets one, on the first spot free in the world.
// Test: /scriptevent siege:founder_bed   put your own bed back in your founder's house (and set your spawn there)

import { world, system, BlockPermutation } from "@minecraft/server";
import { on, emit, onTick } from "../siege/api.js";
import { frameFor, toWorld } from "../townhall/halls.js";
import { BENCH, registerBench } from "./mason.js";
import { drawBuilding } from "./buildings.js";
import { raiseOnSlot, risingAt } from "./plans.js";
import { townOf, allTowns, layoutOf, clearMarker, placeMarker, slotState, saveTowns } from "./founding.js";
import { slotsOf, fixturesOf } from "./towns.js";
import { seatInWorld } from "./plotmarker.js";
import { pickBaseSlot, bedSpots } from "./basedata.js";
import { HOMES } from "./config.js";

const OVERWORLD = "minecraft:overworld";
const DIRS = { s: { x: 0, z: 1 }, n: { x: 0, z: -1 }, e: { x: 1, z: 0 }, w: { x: -1, z: 0 } };
const takenSlots = (town) => new Set(Object.entries(town.slots).filter(([, s]) => s.building || s.base).map(([id]) => id));

// The bench as the layout placed it, for a town whose yard couldn't be raised
export function benchFallback(owner) {
  const town = townOf(owner);
  const at = town?.benchSpot;
  if (!at) return;
  try {
    const block = world.getDimension(OVERWORLD).getBlock(at);
    if (block && block.typeId !== BENCH) { block.setType(BENCH); registerBench(block, owner); }
  } catch { /* not loaded */ }
}

export function raiseBase(owner, id, slot, extra = {}) {
  const town = townOf(owner);
  const seat = seatInWorld(owner, slot, id);
  if (!seat) return false;
  clearMarker(owner, slot);
  const built = raiseOnSlot(owner, owner, seat.origin, seat.forward, id, town.style, slot.id, { quiet: true });
  if (!built) { placeMarker(owner, slot); return false; }
  Object.assign(slotState(owner, slot.id), { building: id, style: town.style, origin: seat.origin, forward: seat.forward, box: seat.box,
    top: seat.plan.bounds().y1 + Math.max(0, built.lift ?? 0), paid: 0, base: true, ...extra });
  saveTowns();
  return true;
}

function masonYard(owner) {
  const town = townOf(owner);
  const layout = layoutOf(town);
  if (Object.values(town.slots).some((s) => s.building === "mason_yard")) return;
  // the layout's own ground for it (the town generator), facing the way the fixture says
  const f = fixturesOf(layout, 0).find((x) => x.kind === "mason_yard");
  if (f) {
    const out = DIRS[f.rotation] ?? DIRS.s; // the way the front faces; the yard runs the other way
    const slot = { id: "mason_yard", size: "S", tier: 0, tags: [], dy: f.dy ?? 0, side: f.rotation, door: out,
      box: { x0: f.x - 4, z0: f.z - 4, x1: f.x + 4, z1: f.z + 4 } };
    // a 9 x 9 box whose front middle is the fixture
    // (plus the row in front of it on the forecourt: a design's bounds always take in its z = 0 step row)
    slot.box = out.z ? { x0: f.x - 4, x1: f.x + 4, z0: out.z > 0 ? f.z - 8 : f.z - 1, z1: out.z > 0 ? f.z + 1 : f.z + 8 }
      : { z0: f.z - 4, z1: f.z + 4, x0: out.x > 0 ? f.x - 8 : f.x - 1, x1: out.x > 0 ? f.x + 1 : f.x + 8 };
    town.extraSlots = { ...(town.extraSlots ?? {}), mason_yard: slot };
    if (raiseBase(owner, "mason_yard", slot, { fixed: true })) return;
  }
  const slot = pickBaseSlot(slotsOf(layout), takenSlots(town), { x: 0, z: 0 });
  if (!slot || !raiseBase(owner, "mason_yard", slot, { fixed: true })) benchFallback(owner);
}

function founderHome(owner) {
  const town = townOf(owner);
  if (Object.values(town.slots).some((s) => s.founderHome)) return;
  const slot = pickBaseSlot(slotsOf(layoutOf(town)), takenSlots(town), { x: 0, z: 0 });
  if (slot) raiseBase(owner, "cottage", slot, { founderHome: true });
}

on("townLaidOut", ({ owner, tier }) => {
  const town = townOf(owner);
  if (tier !== 0 || !town || town.lord) return;
  // after the library has its plot (plotmarker.js, same event)
  system.runTimeout(() => { try { masonYard(owner); } catch (e) { console.warn(`[Hollow Crown] mason yard: ${e}`); benchFallback(owner); } }, 2);
  system.runTimeout(() => { try { founderHome(owner); } catch (e) { console.warn(`[Hollow Crown] founder home: ${e}`); } }, 4);
});

const bedDir = (f) => (f.z === 1 ? 0 : f.x === -1 ? 1 : f.z === -1 ? 2 : 3); // Bedrock: the way the head points

on("settleBuilt", ({ owner, building, forward, marks, slotId }) => {
  const town = townOf(owner);
  const st = slotId && town?.slots[slotId];
  if (!st) return;
  const dim = world.getDimension(OVERWORLD);
  if (building === "mason_yard" && marks?.bench) {
    // the bench in the yard, and the mason in front of it
    try {
      const block = dim.getBlock(marks.bench);
      if (block) {
        block.setType(BENCH);
        const stand = { x: marks.bench.x - forward.x, y: marks.bench.y, z: marks.bench.z - forward.z };
        registerBench(block, owner, stand);
      }
    } catch { benchFallback(owner); }
  }
  if (st.founderHome && !st.ownerBed) placeOwnerBed(owner, st); // a cottage, or the starter village's founder's house
});

// ---------- the founder's own bed ----------

const BED_FACE = ["south", "west", "north", "east"];
function bedPerm(direction, head) {
  try { return BlockPermutation.resolve("minecraft:bed", { direction, head_piece_bit: head }); } catch { /* newer state names */ }
  return BlockPermutation.resolve("minecraft:bed", { "minecraft:cardinal_direction": BED_FACE[direction], head_piece_bit: head });
}
const isAir = (b) => b && (b.isAir || b.typeId === "minecraft:air");

// Put the founder's bed in their house, on the first spot the design leaves free that is still free in the world, and
// make it their spawn. true once it is in; false when the house isn't loaded or every spot is taken.
export function placeOwnerBed(owner, st) {
  if (!st?.origin || !st.forward || !st.building) return false;
  const dim = world.getDimension(OVERWORLD);
  const frame = frameFor(st.forward);
  const direction = bedDir(st.forward);
  for (const spot of bedSpots(drawBuilding(st.building, st.style))) {
    const foot = toWorld(frame, st.origin, spot.x, spot.y, spot.z), head = toWorld(frame, st.origin, spot.x, spot.y, spot.z + 1);
    let fb, hb;
    try { fb = dim.getBlock(foot); hb = dim.getBlock(head); } catch { return false; }
    if (!fb || !hb) return false; // not loaded
    if (!isAir(fb) || !isAir(hb)) continue; // something the player put there
    try {
      fb.setPermutation(bedPerm(direction, false));
      hb.setPermutation(bedPerm(direction, true));
    } catch (e) { console.warn(`[Hollow Crown] founder bed: ${e}`); return false; }
    if (dim.getBlock(foot)?.typeId !== "minecraft:bed") continue;
    st.ownerBed = foot;
    st.ownerHead = head;
    saveTowns();
    const player = world.getPlayers().find((p) => p.id === owner);
    if (player) {
      try { player.setSpawnPoint({ dimension: dim, x: foot.x, y: foot.y, z: foot.z }); } catch { /* the bed still works when slept in */ }
      player.sendMessage(`§6Your own house is ready by the square (${foot.x}, ${foot.z}).§7 The bed in it is yours: you wake there, and it is never given to a settler.`);
    }
    emit("settleCharter", { owner });
    return true;
  }
  return false;
}

// The founder's house of a town: the slot marked for it, else (a town founded before it was marked) the finished home
// nearest the square, the starter village's "founder" house first. Marks it. [slotId, state] or undefined.
function founderSlot(owner, town) {
  const own = Object.entries(town.slots).find(([, s]) => s.founderHome);
  if (own) return own;
  const layout = slotsOf(layoutOf(town));
  const tagged = new Set(layout.filter((s) => (s.tags ?? []).includes("founder")).map((s) => s.id));
  const mid = (id) => { const b = layout.find((s) => s.id === id)?.box; return b ? Math.hypot((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2) : 1e9; };
  const homes = Object.entries(town.slots).filter(([, s]) => HOMES.includes(s.building) && s.origin && s.done !== false && !s.broken)
    .sort(([a], [b]) => (tagged.has(b) - tagged.has(a)) || mid(a) - mid(b));
  if (!homes.length) return undefined;
  homes[0][1].founderHome = true;
  saveTowns();
  return homes[0];
}

function checkFounderBed(owner, town) {
  if (town.lord || String(owner).startsWith("npc:") || !town.laid?.[0]) return;
  const found = founderSlot(owner, town);
  if (!found) {
    if (!town.founderCottageTried) { town.founderCottageTried = true; saveTowns(); founderHome(owner); }
    return;
  }
  const [, st] = found;
  if (st.ownerBed || risingAt(st.origin)) return;
  placeOwnerBed(owner, st);
}

onTick("settle_founder_bed", 200, () => {
  const online = new Set(world.getPlayers().map((p) => p.id));
  for (const [owner, town] of Object.entries(allTowns() ?? {})) {
    if (!online.has(owner)) continue;
    try { checkFounderBed(owner, town); } catch (e) { console.warn(`[Hollow Crown] founder bed: ${e}`); }
  }
});

system.afterEvents.scriptEventReceive.subscribe((e) => {
  if (e.id !== "siege:founder_bed") return;
  const player = e.sourceEntity;
  if (player?.typeId !== "minecraft:player") return;
  const town = townOf(player.id);
  const found = town && founderSlot(player.id, town);
  if (!found) return player.sendMessage("§7You have no founder's house yet. Found a settlement first.");
  const st = found[1];
  st.ownerBed = undefined; st.ownerHead = undefined;
  if (!placeOwnerBed(player.id, st)) player.sendMessage("§7No free spot for a bed in your house (or it isn't loaded). Clear a 1 x 2 patch of floor and try again.");
});
