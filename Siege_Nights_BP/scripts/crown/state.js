// The Crown's saved data, and small helpers every crown/ file shares.

import { world } from "@minecraft/server";
import { moduleStore, getState, keepOf, isAlly, overworld } from "../siege/api.js";
import { CROWN } from "./config.js";

const fresh = () => ({
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
  lords: null, // rival lords: [{ key, name, title, pace, claim }] (filled from config the first time)
  npcKeep: null, // while a lord rules: the keep they took { x, y, z, wins, ... }, handed to whoever unseats them
  resting: null, // the Heart lying untaken where the Choir fell: { x, y, z, dim }
  vacant: false, // the Crown is back in the Undertow, waiting to be won again
});
const store = moduleStore("siege:crown", fresh);

export const crown = () => store.data;
export const saveCrown = () => store.save();

// Test worlds only: back to a world where nobody has ever held the Heart. Goes through the store like every other write.
export function resetCrown() {
  const data = store.data;
  for (const key of Object.keys(data)) if (!key.startsWith("_")) delete data[key];
  Object.assign(data, fresh());
  store.save();
}

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

// The rival lords, and the one behind an id like "npc:ashgrave"
export function lords() {
  const c = crown();
  c.lords ??= CROWN.lords.map((l) => ({ ...l, claim: 0 }));
  return c.lords;
}
export const lordOf = (id) => lords().find((l) => `npc:${l.key}` === id);

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
  if (c.ruler?.npc) return c.npcKeep ? { x: c.npcKeep.x, y: c.npcKeep.y, z: c.npcKeep.z } : undefined;
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
