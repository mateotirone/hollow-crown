// Where a player comes back to life (Mateo 2026-11-15): the world spawn is the welcome hall island; once you have
// a plot, your spawn point is your town hall, and a Writ of Alliance gives a friend the same, at your hall.
// (The playtest world file sets the world spawn on the island's quay; plots/welcome.js sets it again once the hall
// stands, and sets your spawn when you choose a plot in the hall.)
import { world } from "@minecraft/server";
import { on } from "../siege/api.js";
import { state } from "../siege/state.js";
import { plotOf } from "./claims.js";
import { arrivalSpot } from "./welcome.js";
import { OVERWORLD } from "./config.js";

/** The spot by an owner's town hall where they (and their writ allies) come back: beside the Plot Stone, toward the gate. */
export function homeSpot(owner) {
  const plot = plotOf(owner);
  if (plot) return arrivalSpot(plot);
  const keep = state.keeps?.[owner];
  return keep ? { x: keep.x + 0.5, y: keep.y + 1, z: keep.z + 3.5 } : undefined;
}

function spawnAt(player, owner) {
  try {
    const at = owner && homeSpot(owner);
    if (at) player.setSpawnPoint({ dimension: world.getDimension(OVERWORLD), x: Math.floor(at.x), y: Math.floor(at.y), z: Math.floor(at.z) });
    else player.setSpawnPoint(); // back to the world spawn (the island)
  } catch (e) {
    console.warn(`[Hollow Crown] spawn point for ${player.name}: ${e}`);
  }
}

on("keepFounded", ({ player }) => spawnAt(player, player.id));
on("allianceChanged", ({ owner, ally, allied }) => {
  if (allied) return spawnAt(ally, owner);
  // their own hall if they have one, else another settlement they are allied with, else the island
  const other = state.keeps?.[ally.id] ? ally.id : Object.keys(state.keeps ?? {}).find((o) => state.keeps[o].allies?.includes(ally.id));
  spawnAt(ally, other);
});
