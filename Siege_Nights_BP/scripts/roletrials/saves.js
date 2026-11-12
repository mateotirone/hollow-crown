// Where the role trials keep each player's progress, and how they read the town hall's hero record.
// Shared by index.js, stand.js and thirdnight.js.

import { world } from "@minecraft/server";
import { loadTrials } from "./logic.js";

const PROP = "hc:role_trials";
const HERO_PROP = "siege:townhall_hero"; // written by the town hall

const cache = new Map(); // player id -> trials
export function trialsOf(player) {
  let t = cache.get(player.id);
  if (t) return t;
  let saved;
  try {
    const raw = player.getDynamicProperty(PROP);
    if (typeof raw === "string") saved = JSON.parse(raw);
  } catch { /* unreadable: start fresh, never throw */ }
  t = loadTrials(saved);
  cache.set(player.id, t);
  return t;
}
export function save(player) {
  try { player.setDynamicProperty(PROP, JSON.stringify(trialsOf(player))); } catch { /* left the game */ }
}
// Replace a player's trials outright (the reset command)
export function resetTrials(player, t) {
  cache.set(player.id, t);
  save(player);
}
world.afterEvents.playerLeave.subscribe(({ playerId }) => cache.delete(playerId));

export function heroOf(player) {
  try {
    const raw = player.getDynamicProperty(HERO_PROP);
    if (typeof raw === "string") return JSON.parse(raw) ?? {};
  } catch { /* no hero yet */ }
  return {};
}
export const pathOf = (player) => heroOf(player).path ?? "none";
