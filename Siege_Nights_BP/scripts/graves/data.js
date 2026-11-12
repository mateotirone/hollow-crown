// Gravestones: the numbers and the pure rules (no Minecraft calls, so the self-tests run in Node too).
// The game side is index.js; the build itself comes from map/structures/gravestone_build.py (design_data.js).

import { GRAVE_PARTS } from "./design_data.js";

export { GRAVE_PARTS } from "./design_data.js";

// How long a grave stays sealed to everyone but its owner when they did not die to another player.
// Real minutes, so it keeps counting across a restart. A player-killed player's grave is never sealed.
export const LOCK_MINUTES = 10;
export const LOCK_MS = LOCK_MINUTES * 60 * 1000;

export const KEEPER = "siege:grave_keeper";
export const STONE = "siege:gravestone";
export const keeperTag = (id) => `hc_grave_${id}`;

// Items lying this close to where a player died, that appeared since the death, are theirs.
export const SWEEP_RADIUS = 3.5;
export const SWEEP_TICKS = [2, 20]; // look twice: at once, and once the death animation is over
export const SEARCH_RADIUS = 4; // how far from the death spot a grave may stand
export const SEARCH_DY = [0, 1, -1, 2, -2, 3, -3];

// Blocks a grave part may replace: air and the small plants that grow over everything.
export const REPLACEABLE = new Set([
  "minecraft:air", "minecraft:short_grass", "minecraft:fern", "minecraft:snow_layer", "minecraft:short_dry_grass",
  "minecraft:tall_dry_grass", "minecraft:leaf_litter", "minecraft:deadbush", "minecraft:dead_bush",
  "minecraft:dandelion", "minecraft:poppy", "minecraft:wildflowers", "minecraft:bush", "minecraft:firefly_bush",
]);

const FORWARD = { north: { x: 0, z: -1 }, south: { x: 0, z: 1 }, east: { x: 1, z: 0 }, west: { x: -1, z: 0 } };

/** Which way a grave faces for a player looking this way (degrees, Minecraft yaw): the way they were looking. */
export function facingOf(yaw) {
  const a = (((yaw ?? 0) % 360) + 360) % 360;
  if (a >= 45 && a < 135) return "west";
  if (a >= 135 && a < 225) return "north";
  if (a >= 225 && a < 315) return "east";
  return "south";
}

/** The design's cells in the world: local +z runs the way the grave faces, local +x to its right as built. */
export function partsAt(origin, facing) {
  const F = FORWARD[facing] ?? FORWARD.south;
  const R = { x: F.z, z: -F.x };
  return GRAVE_PARTS.map(([x, y, z, id, role]) => ({
    x: origin.x + x * R.x + z * F.x, y: origin.y + y, z: origin.z + x * R.z + z * F.z, id, role,
  }));
}

/**
 * Where the headstone goes: the nearest free cell with solid ground under it, close to the death spot.
 * kindAt(x, y, z) says what is there: "free" (air or a plant), "solid", "liquid" or "other". Pure.
 */
export function findSpot(start, kindAt, taken = () => false, radius = SEARCH_RADIUS) {
  const sx = Math.floor(start.x), sy = Math.floor(start.y), sz = Math.floor(start.z);
  for (let r = 0; r <= radius; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue; // this ring only
        for (const dy of SEARCH_DY) {
          const x = sx + dx, y = sy + dy, z = sz + dz;
          if (taken(x, y, z)) continue;
          if (kindAt(x, y, z) === "free" && kindAt(x, y - 1, z) === "solid") return { x, y, z };
        }
      }
    }
  }
  return undefined;
}

/** Who may open a grave right now. */
export function mayOpen(grave, playerId, now) {
  return grave.owner === playerId || !grave.openAt || now >= grave.openAt;
}

/** "4 min 05 s" style countdown. */
export function waitText(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m} min ${String(s % 60).padStart(2, "0")} s` : `${s} s`;
}

/** Which armour slot an item goes back into when its owner gathers it (by the vanilla naming), if any. */
export function armorSlotOf(typeId) {
  if (typeof typeId !== "string") return undefined;
  if (/_helmet$|_cap$/.test(typeId) || typeId === "minecraft:turtle_helmet") return "Head";
  if (/_chestplate$|_tunic$/.test(typeId)) return "Chest";
  if (/_leggings$|_pants$/.test(typeId)) return "Legs";
  if (/_boots$/.test(typeId)) return "Feet";
  return undefined;
}

/** Was this death another player's doing (not their own)? damagingEntity is the shooter for arrows and the like. */
export function killerOf(deadId, damagingEntity) {
  if (!damagingEntity || damagingEntity.typeId !== "minecraft:player" || damagingEntity.id === deadId) return undefined;
  return damagingEntity;
}

/** The record saved for a new grave. */
export function newGrave(id, { owner, name, dim, at, facing, cells, killer, now }) {
  return {
    id, owner, name, dim, x: at.x, y: at.y, z: at.z, facing, cells,
    openAt: killer ? 0 : now + LOCK_MS, killer: killer ?? undefined, made: now,
  };
}

export const DIM_NAMES = { "minecraft:overworld": "", "minecraft:nether": " in the Nether", "minecraft:the_end": " in the End", "siege:undertow": " beyond the seam" };
