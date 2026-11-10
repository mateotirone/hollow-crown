// The omen ravens (Mateo: omens must be real things you see, not only text).
// This file only knows how to PUT ravens somewhere and take them away again. When they come, how many,
// and what they mean is the lore feature's business (lore/ravens.js).
//
//   perchRavens(dim, spots, { facing, owner })   one raven on each spot, all looking the same way.
//                                                facing: a yaw in degrees, or a point {x, z} they all look toward.
//                                                owner: any id (a keep's owner) so one settlement's birds can be cleared alone.
//   rowSpots(from, to, count, { gap })           evenly spaced spots along a wall top; gap leaves one place empty
//   clearRavens(owner?)                          they are gone (all of them, or one owner's)
//   ravensOf(dim, owner?)                        the ones perched now
//
// They do not move, make no sound, do not flee, cannot be hurt and drop nothing.
// They leave by themselves at dawn and the moment a siege starts.
// Test: /scriptevent siege:raven_row [count]   a row on the ground in front of you, facing north
//       /scriptevent siege:raven_clear

import { world, system } from "@minecraft/server";
import { on, onTick, addTests, assert, assertEqual } from "../siege/api.js";
import { activeDimensions, particle } from "./util.js";

export const RAVEN = "siege:omen_raven";
const TAG = "siege_omen_raven";
const YAW_PROP = "siege:raven_yaw";
const ownerTag = (owner) => `siege_omen_for_${String(owner).replace(/[^\w-]/g, "_")}`;

// Pure: the yaw (degrees, Minecraft's: 0 = south, 180 = north) that looks from a spot toward a point
export const yawToward = (from, to) => (Math.atan2(-(to.x - from.x), to.z - from.z) * 180) / Math.PI;
// Pure: count places from one end of a wall to the other, ends included. gap (0-based) is left empty: a place being kept.
export function rowSpots(from, to, count, { gap } = {}) {
  const spots = [];
  for (let i = 0; i < count; i++) {
    if (i === gap) continue;
    const t = count === 1 ? 0.5 : i / (count - 1);
    spots.push({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, z: from.z + (to.z - from.z) * t });
  }
  return spots;
}
// Pure: ravens are there from dusk and gone by day
export const ravensStay = (timeOfDay) => timeOfDay >= 11500 && timeOfDay < 23500;

export function perchRavens(dim, spots, { facing = 180, owner } = {}) {
  const made = [];
  for (const at of spots) {
    try {
      const yaw = typeof facing === "number" ? facing : yawToward(at, facing);
      const raven = dim.spawnEntity(RAVEN, at);
      raven.addTag(TAG);
      if (owner !== undefined) raven.addTag(ownerTag(owner));
      raven.setDynamicProperty(YAW_PROP, yaw);
      raven.setRotation({ x: 0, y: yaw });
      made.push(raven);
    } catch {
      // that spot isn't loaded: one fewer on the wall
    }
  }
  return made;
}

export function ravensOf(dim, owner) {
  try {
    return dim.getEntities({ type: RAVEN, tags: owner === undefined ? [TAG] : [TAG, ownerTag(owner)] });
  } catch {
    return [];
  }
}

export function clearRavens(owner) {
  let gone = 0;
  for (const dim of activeDimensions()) {
    for (const raven of ravensOf(dim, owner)) {
      try {
        const at = raven.location;
        particle(dim, "minecraft:basic_smoke_particle", { x: at.x, y: at.y + 0.3, z: at.z }); // no sound: they were never loud
        raven.remove();
        gone++;
      } catch {
        // already gone
      }
    }
  }
  return gone;
}

// They hold their heading (nothing turns them), and leave at dawn
onTick("bestiary_ravens", 40, () => {
  let time = 12000;
  try { time = world.getTimeOfDay(); } catch { /* world not ready */ }
  if (!ravensStay(time)) { clearRavens(); return; }
  for (const dim of activeDimensions()) {
    for (const raven of ravensOf(dim)) {
      try {
        if (raven.hasTag("siege_showcase")) continue;
        const yaw = raven.getDynamicProperty(YAW_PROP);
        if (typeof yaw === "number") raven.setRotation({ x: 0, y: yaw });
      } catch {
        // unloaded
      }
    }
  }
});
on("siegeStart", () => clearRavens());

system.afterEvents.scriptEventReceive.subscribe((event) => {
  const p = event.sourceEntity;
  if (event.id === "siege:raven_clear") { clearRavens(); return; }
  if (event.id !== "siege:raven_row" || p?.typeId !== "minecraft:player") return;
  const count = Math.max(1, Math.min(40, parseInt(event.message, 10) || 7));
  const v = p.getViewDirection(), l = p.location;
  const mid = { x: l.x + v.x * 5, y: l.y, z: l.z + v.z * 5 }, half = (count - 1) * 0.6;
  const from = { x: mid.x + v.z * half, y: l.y, z: mid.z - v.x * half }, to = { x: mid.x - v.z * half, y: l.y, z: mid.z + v.x * half };
  const made = perchRavens(p.dimension, rowSpots(from, to, count, { gap: count > 5 ? Math.floor(count / 2) : undefined }), { facing: 180, owner: "test" });
  p.sendMessage(`§8${made.length} ravens. They leave at dawn, when a siege starts, or with /scriptevent siege:raven_clear.`);
});

addTests("bestiary", {
  "ravens: a row is evenly spaced and can keep a place empty": () => {
    const row = rowSpots({ x: 0, y: 70, z: 0 }, { x: 8, y: 70, z: 0 }, 5);
    assertEqual(row.map((s) => s.x), [0, 2, 4, 6, 8]);
    assertEqual(rowSpots({ x: 0, y: 70, z: 0 }, { x: 8, y: 70, z: 0 }, 5, { gap: 2 }).map((s) => s.x), [0, 2, 6, 8]);
    assertEqual(rowSpots({ x: 0, y: 1, z: 0 }, { x: 4, y: 1, z: 0 }, 1), [{ x: 2, y: 1, z: 0 }]);
  },
  "ravens: they all face one way": () => {
    assertEqual(Math.abs(Math.round(yawToward({ x: 0, z: 0 }, { x: 0, z: -10 }))), 180, "north");
    assertEqual(Math.round(yawToward({ x: 0, z: 0 }, { x: 0, z: 10 })), 0, "south");
    assertEqual(Math.round(yawToward({ x: 0, z: 0 }, { x: -10, z: 0 })), 90, "west");
  },
  "ravens: there from dusk, gone by day": () => {
    assert(ravensStay(12000) && ravensStay(18000) && !ravensStay(1000) && !ravensStay(6000));
  },
});
