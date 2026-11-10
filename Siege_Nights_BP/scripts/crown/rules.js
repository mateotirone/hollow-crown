// The rules of the Crown as plain functions: no Minecraft in here, so they can be tested anywhere.

import { CROWN } from "./config.js";

export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// ---------- The Hunger ----------

export const HOLLOW_STAGES = [
  { at: 0, name: "Crowned", color: "§6" },
  { at: 25, name: "Whispering", color: "§e" },
  { at: 50, name: "Hollowing", color: "§d" },
  { at: 75, name: "Hollow Monarch", color: "§5" },
  { at: 100, name: "The New Source", color: "§4" },
];

export const hollowStage = (hollowing) => [...HOLLOW_STAGES].reverse().find((s) => hollowing >= s.at);

// How much Claim a challenger needs: a Hollow ruler is easier to challenge
export function claimNeeded(hollowing) {
  if (hollowing >= 100) return CROWN.claimNeeded / 4;
  if (hollowing >= 75) return CROWN.claimNeeded / 2;
  return CROWN.claimNeeded;
}

// Hollowing and Unrest after one siege night
export function nightfall({ hollowing, unrest, tithe }) {
  const steps = Math.floor(tithe / 10);
  return {
    hollowing: clamp(hollowing + CROWN.hollowPerNight + steps, 0, 100),
    unrest: Math.max(0, unrest + steps - 1),
  };
}

// ---------- Money ----------

// Split a defender's siege pay between them and the Crown
export function tithed(emeralds, tithePercent) {
  const cut = Math.floor((emeralds * tithePercent) / 100);
  return { kept: emeralds - cut, cut };
}

// ---------- Who gets the Crown ----------
// takers: ids who chose "Take the Crown". votes: voter id -> taker id. fighters: everyone in the
// fight, nearest to the throne first. roll: 0..1, used only to break a tied vote.
export function resolveCrown({ takers, votes = {}, fighters, roll = 0 }) {
  if (takers.length === 1) return { winner: takers[0], how: "alone" };
  if (takers.length === 0) return { winner: fighters[0], how: "nearest" };
  const tally = Object.fromEntries(takers.map((t) => [t, 0]));
  for (const choice of Object.values(votes)) if (choice in tally) tally[choice] += 1;
  const best = Math.max(...Object.values(tally));
  const tied = takers.filter((t) => tally[t] === best);
  if (tied.length === 1) return { winner: tied[0], how: "vote", tally };
  return { winner: tied[Math.min(tied.length - 1, Math.floor(roll * tied.length))], how: "chosen", tally };
}

// ---------- The Storm ----------

// Can this player throw down the Gauntlet right now? Returns a refusal message, or undefined if they can.
export function gauntletProblem({ ruler, playerId, isCourt, claim, challenge, siegeNumber, graceUntil }) {
  if (!ruler) return "No one wears the Crown. There is nothing to challenge.";
  if (ruler.id === playerId) return "You already wear the Crown.";
  if (isCourt) return "You are in the ruler's Court. Leave it before you turn on them.";
  if (challenge) return challenge.claimant === playerId ? "Your Gauntlet is already down." : `${challenge.name} has already thrown down the Gauntlet.`;
  if (siegeNumber < graceUntil) {
    const n = graceUntil - siegeNumber;
    return `The ruler is under grace for ${n} more siege night${n === 1 ? "" : "s"}.`;
  }
  const need = claimNeeded(ruler.hollowing);
  if (claim < need) return `Your Claim is ${claim} of ${need}. Bind Crown Shards and win sieges to raise it.`;
  return undefined;
}

// What a pending challenge does when a siege night begins
export function stormAtNightfall({ challenge, rulerOnline, claimantOnline }) {
  if (!challenge) return "none";
  if (rulerOnline && claimantOnline) return "storm";
  if (rulerOnline) return challenge.missed + 1 >= CROWN.claimantMisses ? "lapse" : "claimantMissed";
  return "wait"; // ruler away: nobody gets robbed in their sleep
}

export const abandoned = (challenge, nowMs) =>
  !!challenge && !challenge.stormed && nowMs - challenge.declaredMs >= CROWN.abandonDays * 86400000;

// ---------- The Long Road Back ----------

export const EXILE_STAGES = [
  { name: "Ashes and Oaths", goal: "Raise a new Keep Banner on free land.", claim: 0, emeralds: 16 },
  { name: "The Loyalists", goal: "Recruit 2 guards on your new land.", claim: 10, emeralds: 10 },
  { name: "Hold the Line", goal: "Win a siege at your new settlement.", claim: 15, emeralds: 0 },
  { name: "The Underground", goal: "Bind a Crown Shard.", claim: 10, emeralds: 0 },
  { name: "The Return", goal: "Throw down the Gauntlet and win the Storm.", claim: 0, emeralds: 0 },
];

// Compass words for "a shard fell to the north-east"
export function compass(from, to) {
  const dx = to.x - from.x, dz = to.z - from.z;
  const dist = Math.hypot(dx, dz);
  const names = ["east", "south-east", "south", "south-west", "west", "north-west", "north", "north-east"];
  const dir = names[((Math.round(Math.atan2(dz, dx) / (Math.PI / 4)) % 8) + 8) % 8];
  const far = dist < 120 ? "close by" : dist < 300 ? "some way" : "far";
  return { dir, dist: Math.round(dist), text: dist < 24 ? "right here" : `${far} to the ${dir}` };
}
