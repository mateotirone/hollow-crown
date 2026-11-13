// Townsfolk for Rival Lords' towns. A lord has nobody online to count beds for, so this does it: when a player
// comes near a lord's town on a day it hasn't been counted, the lord's crew first puts beds in any finished home
// that has none (players furnish their own; lords furnish theirs), then the same bed count and arrivals as a
// player's town run (register.js, settlers.js), with a few newcomers at once for the dawns nobody saw.
//
//   countLordTown(owner, arrivals) -> Promise   beds into bare homes, then the count
//   on("lordHomeBuilt", ({ owner, slot }))   rivals/index.js, when a lord's crew finishes a home on a plot

import { world, system, BlockPermutation } from "@minecraft/server";
import { isReady, onTick, on } from "../siege/api.js";
import { HOMES, SETTLERS } from "./config.js";
import { tally, bedCap, bedPlaces, lordArrivals } from "./census.js";
import { townOf, allTowns, saveTowns } from "./founding.js";
import { plotRegistry, scanCells, countNow } from "./register.js";

const OVERWORLD = "minecraft:overworld";

function setBed(dim, at, dir, head) {
  const b = dim.getBlock(at);
  if (!b?.isAir) return false;
  b.setPermutation(BlockPermutation.resolve("minecraft:bed", { direction: dir, head_piece_bit: head }));
  return true;
}

// Beds in one finished home, up to its cap. Resolves true when done (or nothing to do), false if not loaded.
function furnish(owner, slotId) {
  const town = townOf(owner);
  const st = town?.slots?.[slotId];
  const plot = plotRegistry(owner).find((p) => p.id === slotId);
  if (!st || !plot || st.furnished || !HOMES.includes(st.building) || st.done === false) return Promise.resolve(true);
  const dim = world.getDimension(OVERWORLD);
  return new Promise((resolve) => {
    system.runJob((function* job() {
      let ok = false;
      try {
        const cells = yield* scanCells(dim, plot.box, plot.floorY);
        if (cells) {
          const t = tally(cells);
          const places = bedPlaces(cells, bedCap(t) - (t.groups.bed ?? 0));
          for (const p of places) {
            const w = (q) => ({ x: plot.box.x0 + q.x, y: plot.floorY + q.y, z: plot.box.z0 + q.z });
            if (setBed(dim, w(p.head), p.dir, true)) setBed(dim, w(p.foot), p.dir, false);
            yield;
          }
          st.furnished = true;
          saveTowns();
          ok = true;
        }
      } catch (e) {
        console.warn(`[Hollow Crown] lord beds: ${e}`);
      }
      resolve(ok);
    })());
  });
}

async function furnishAll(owner) {
  const town = townOf(owner);
  for (const [id, st] of Object.entries(town?.slots ?? {})) if (HOMES.includes(st.building) && !st.furnished) await furnish(owner, id);
}

// Beds first, then the count (also the test command's way in)
export const countLordTown = (owner, arrivals) => furnishAll(owner).then(() => countNow(owner, arrivals));

on("lordHomeBuilt", ({ owner, slot }) => { furnish(owner, slot).catch(() => {}); });

const busy = new Set();
onTick("settle_lordfolk", 200, () => {
  if (!isReady()) return;
  const day = world.getDay();
  const players = world.getPlayers().filter((p) => p.dimension.id === OVERWORLD);
  if (!players.length) return;
  for (const [owner, town] of Object.entries(allTowns())) {
    if (!town.lord || town.lastDawn === day || busy.has(owner)) continue;
    if (!players.some((p) => Math.hypot(p.location.x - town.x, p.location.z - town.z) <= SETTLERS.lordRange)) continue;
    const arrivals = lordArrivals(town.lastDawn, day);
    town.lastDawn = day;
    saveTowns();
    busy.add(owner);
    countLordTown(owner, arrivals)
      .catch((e) => console.warn(`[Hollow Crown] lord townsfolk: ${e}`))
      .finally(() => busy.delete(owner));
  }
});
