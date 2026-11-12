// What every new base raises with its groundwork, besides the hall and the library (Mateo's playtest 2026-11-12):
//   the Mason's Yard: the mason's workshop, with the Mason's Bench in its yard and the mason standing by it
//     ("the mason is still standing on top of his block ... his building needs to spawn with the rest").
//     On the layout's own "mason_yard" ground once the town generator reserves it, else on the Small plot nearest
//     the square. If neither fits, the bench goes where the layout put it, as before.
//   the founder's house: a cottage in the town's style on a Small plot, free, with a bed of the owner's own that
//     no settler ever takes ("does a house for me spawn ... cause I can't sleep").
// Both are raised by the plot building engine (plans.js raise), so they rise like every other building.

import { world, system, BlockPermutation } from "@minecraft/server";
import { on, emit } from "../siege/api.js";
import { frameFor, toWorld } from "../townhall/halls.js";
import { BENCH, registerBench } from "./mason.js";
import { drawBuilding } from "./buildings.js";
import { raiseOnSlot } from "./plans.js";
import { townOf, layoutOf, clearMarker, placeMarker, slotState, saveTowns } from "./founding.js";
import { slotsOf, fixturesOf } from "./towns.js";
import { seatInWorld } from "./plotmarker.js";
import { pickBaseSlot, bedSpot } from "./basedata.js";

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

function raiseBase(owner, id, slot, extra = {}) {
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

on("settleBuilt", ({ owner, building, style, origin, forward, marks, slotId }) => {
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
  if (building === "cottage" && st.founderHome && !st.ownerBed) {
    const spot = bedSpot(drawBuilding("cottage", style));
    if (!spot) return;
    const frame = frameFor(forward);
    const foot = toWorld(frame, origin, spot.x, spot.y, spot.z), head = toWorld(frame, origin, spot.x, spot.y, spot.z + 1);
    const direction = bedDir(forward);
    try {
      dim.getBlock(foot)?.setPermutation(BlockPermutation.resolve("minecraft:bed", { direction, head_piece_bit: false }));
      dim.getBlock(head)?.setPermutation(BlockPermutation.resolve("minecraft:bed", { direction, head_piece_bit: true }));
      st.ownerBed = foot;
      saveTowns();
      world.getPlayers().find((p) => p.id === owner)?.sendMessage("§6Your own house is ready by the square.§7 The bed in it is yours: sleep there and you wake there.");
      emit("settleCharter", { owner });
    } catch { /* not loaded: the house still stands */ }
  }
});

