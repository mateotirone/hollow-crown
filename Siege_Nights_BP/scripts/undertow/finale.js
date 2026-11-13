// Everything the last fight needs from the Hollow, in one import for the boss code (mobs thread).
// Confirmed by Mateo 2026-11-10: the Choir holds the Court; Morvane waits at the Seat and throws
// players between places:
//   1 the Seat   2 the Standing Ranks (a real place)   3 The Night It Ended (pocket)
//   4 the River (pocket)   5 the overworld, at the open Rift's cave   6 The Fall (a pocket shaft each)
//   7 the Seat again, its floor dropping ring by ring
//
// Events: this code sends scriptevent siege:undertow_arena_ready with message "morvane" when a
// player walks onto the Seat after the Choir is dead. When siege:boss_defeated {boss:"morvane"}
// arrives, the Hollow Crown is left in a chest at the middle of the Seat.

import { world } from "@minecraft/server";
import { UNDERTOW_ID, HEART } from "./layout.js";
import { SITES } from "./roads.js";
import { getRift } from "./source.js";
import { FACING } from "./data.js";

export { HEART as SEAT } from "./layout.js";
export { rebuildHeart as rebuildSeat, dropHeartBand as dropSeatBand, ranksSpots, ranksReady } from "./builder.js";
export { POCKETS, FALL_SHAFTS, pocket, pocketReady, requestPockets, enterPocket, dressRoom, ROOM_LOOKS } from "./pockets.js";

const hollow = () => world.getDimension(UNDERTOW_ID);
const send = (player, at, face, dimension) => {
  try { player.teleport(at, { dimension, facingLocation: face }); return true; } catch { return false; }
};

// Stage 1 and 7, and the way back from anywhere: onto the Seat's ring, spread around its middle.
export function toSeat(players) {
  const c = HEART.center;
  players.forEach((p, i) => {
    const a = (i / Math.max(1, players.length)) * Math.PI * 2;
    send(p, { x: c.x + 0.5 + Math.cos(a) * 14, y: c.y, z: c.z + 0.5 + Math.sin(a) * 14 }, { x: c.x, y: c.y + 1, z: c.z }, hollow());
  });
}

// Stage 2: the Standing Ranks, in among the armour.
export const RANKS = SITES.find((s) => s.id === "standing_ranks");
export function toRanks(players) {
  players.forEach((p, i) => send(p, { x: RANKS.x + 3.5 + (i % 5) * 6, y: RANKS.y + 1, z: RANKS.z - 9.5 + Math.floor(i / 5) * 6 }, { x: RANKS.x, y: RANKS.y + 1, z: RANKS.z + 30 }, hollow()));
}

// Stage 5: the overworld at the open Rift. rift = the bottom of the crack; arrival = a spot 8 blocks
// out in front of it (inside the cave, facing the crack). Undefined if the Rift has never been opened.
export function overworldStage() {
  const r = getRift();
  if (!r?.open) return undefined;
  const [fx, fz] = FACING[r.facing] ?? FACING.south;
  return {
    dimension: "minecraft:overworld", site: r.site,
    rift: { x: r.x, y: r.y, z: r.z, facing: r.facing },
    arrival: { x: r.x + fx * 8 + 0.5, y: r.y, z: r.z + fz * 8 + 0.5 },
  };
}
export function toOverworld(players) {
  const s = overworldStage();
  if (!s) return false;
  const [fx, fz] = FACING[s.rift.facing] ?? FACING.south;
  const dim = world.getDimension(s.dimension);
  players.forEach((p, i) => {
    const side = (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 1.5; // fan out across the cave, not stacked
    send(p, { x: s.arrival.x - fz * side, y: s.arrival.y, z: s.arrival.z + fx * side }, s.rift, dim);
  });
  return true;
}
