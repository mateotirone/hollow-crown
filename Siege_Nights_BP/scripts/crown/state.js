// The Crown's saved data, and small helpers every crown/ file shares.

import { world } from "@minecraft/server";
import { moduleStore, getState, keepOf, isAlly, overworld } from "../siege/api.js";

const store = moduleStore("siege:crown", () => ({
  ruler: null, // { id, name, title, sinceDay, hollowing, restored }
  citadel: null, // { x, y, z (its Keep Banner), kx, ky, kz (the Great Keep), gate, color, built, next, retry }
  cornerstone: null, // { x, y, z } placed and waiting for the ruler to confirm
  treasury: 0,
  unrest: 0,
  tithe: 0,
  decrees: { siege: null, peace: null, lastTarget: null },
  claims: {}, // player id -> Claim points
  names: {}, // player id -> last known name (for players who are offline)
  shards: [], // fallen Crown Shards: { x, z, y, placed }
  challenge: null, // { claimant, name, declaredMs, missed, stormed }
  storm: null, // { claimant, deaths, rulerAway, claimantAway }
  graceUntil: 0, // siege number before which nobody can throw down the Gauntlet
  exiles: {}, // player id -> { name, stage, until, pending }
  annals: [], // finished reigns
  pendingCrown: null, // { id, name, untilDay, others }
  formerRulers: [], // their Royal Guard and machines at the Citadel pass to the Crown
  strays: [], // guards left at a new ruler's old plot, to be paid off: { id, x, z }
  purifiedDay: -1,
  vacant: false, // the Crown is back in the Undertow, waiting to be won again
}));

export const crown = () => store.data;
export const saveCrown = () => store.save();

export const playerById = (id) => world.getPlayers().find((p) => p.id === id);
export const ruler = () => crown().ruler;
export const isRuler = (id) => crown().ruler?.id === id;
export const rulerLabel = (r = crown().ruler) => (r ? `${r.title} ${r.name}` : "no one");

// The Court: the ruler's Writ allies
export const isCourt = (id) => {
  const r = crown().ruler;
  return !!r && r.id !== id && !!keepOf(r.id) && isAlly(r.id, id);
};

export const claimOf = (id) => crown().claims[id] ?? 0;

export function addClaim(player, amount, why) {
  const c = crown();
  c.claims[player.id] = Math.max(0, claimOf(player.id) + amount);
  c.names[player.id] = player.name;
  saveCrown();
  if (amount > 0) player.sendMessage(`§5+${amount} Claim §7(${why}). Your Claim on the throne: §5${c.claims[player.id]}`);
}

export function announce(text, sound) {
  for (const p of world.getPlayers()) {
    p.sendMessage(text);
    if (sound) p.playSound(sound);
  }
}

export function giveItem(player, stack) {
  const left = player.getComponent("minecraft:inventory")?.container?.addItem(stack);
  if (left) player.dimension.spawnItem(left, player.location);
}

// The ruler's seat: the Citadel's Keep Banner, or their own keep until the Citadel is raised
export function seat() {
  const c = crown();
  if (c.citadel) return { x: c.citadel.x, y: c.citadel.y, z: c.citadel.z };
  const keep = c.ruler && keepOf(c.ruler.id);
  return keep ? { x: keep.x, y: keep.y, z: keep.z } : undefined;
}

// The surface at a spot, or undefined if that land isn't loaded
export function surfaceY(x, z) {
  try {
    return overworld().getTopmostBlock({ x, z })?.location.y;
  } catch {
    return undefined;
  }
}

export const siegeNumber = () => getState().siegeNumber;
