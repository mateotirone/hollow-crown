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
  if (CROWN.hunger !== "full") return CROWN.claimNeeded;
  if (hollowing >= 100) return CROWN.claimNeeded / 4;
  if (hollowing >= 75) return CROWN.claimNeeded / 2;
  return CROWN.claimNeeded;
}

// Hollowing and Unrest after one siege night
export function nightfall({ hollowing, unrest, tithe }) {
  const steps = Math.floor(tithe / 10);
  return {
    hollowing: CROWN.hunger === "off" ? hollowing : clamp(hollowing + CROWN.hollowPerNight + steps, 0, 100),
    unrest: Math.max(0, unrest + steps - 1),
  };
}

// ---------- The Citadel's name ----------

// What a ruler typed, made safe to show everyone: no color codes or line breaks, one line, not too long. Blank = the default.
export function cleanCitadelName(text) {
  const name = String(text ?? "").replace(/§./g, "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, CROWN.citadelNameMax).trim();
  return name || CROWN.citadelName;
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

// Why a hand comes off the resting Heart, or undefined while the reach holds
export function reachProblem({ here, distance }) {
  if (!here) return "is gone";
  if (distance > CROWN.reachRange) return "stepped away from it";
  return undefined;
}

// ---------- The Storm ----------

// Can this player throw down the Gauntlet right now? Returns a refusal message, or undefined if they can.
export function gauntletProblem({ ruler, playerId, isCourt, claim, challenge, siegeNumber, graceUntil }) {
  if (!ruler) return "The throne is empty. There is nothing to challenge.";
  if (ruler.id === playerId) return "You already hold the throne.";
  if (isCourt) return "You are in the ruler's Court. Leave it before you turn on them.";
  if (challenge) return challenge.claimant === playerId ? "Your Gauntlet is already down." : `${challenge.name} has already thrown down the Gauntlet.`;
  if (siegeNumber < graceUntil) {
    const n = graceUntil - siegeNumber;
    return `The ruler is under grace for ${n} more siege night${n === 1 ? "" : "s"}.`;
  }
  const need = claimNeeded(ruler.hollowing);
  if (claim < need) return `Your Claim is ${claim} of ${need}. Bind ${CROWN.shard}s and win sieges to raise it.`;
  return undefined;
}

// What a pending challenge does when a siege night begins
export function stormAtNightfall({ challenge, rulerOnline, claimantOnline }) {
  if (!challenge) return "none";
  if (challenge.npc) return "wait"; // a lord's army comes as a siege on the ruler's keep (usurp.js)
  if (rulerOnline && claimantOnline) return "storm";
  if (rulerOnline) return challenge.missed + 1 >= CROWN.claimantMisses ? "lapse" : "claimantMissed";
  return "wait"; // ruler away: nobody gets robbed in their sleep
}

// ---------- Rival lords (computer-run claimants) ----------

export const lordId = (key) => `npc:${key}`;
export const isNpc = (id) => typeof id === "string" && id.startsWith("npc:");

// A lord's Claim after one more siege night under a player ruler. roll: 0..1
export const lordGain = (lord, unrest, roll = 0) => lord.claim + lord.pace + unrest + Math.floor(roll * 4);

// The lord who throws down the Gauntlet tonight, if any: the strongest Claim that is strong enough
export function lordChallenger(lords, { need, challenge, siegeNumber, graceUntil }) {
  if (challenge || siegeNumber < graceUntil) return undefined;
  return [...lords].sort((a, b) => b.claim - a.claim).find((l) => l.claim >= need);
}

// Who a ruling lord sends the raiders against: never the same settlement twice in a row. roll: 0..1
export function npcDecreeTarget(owners, lastTarget, roll = 0) {
  const open = owners.filter((o) => o !== lastTarget);
  return open.length ? open[Math.min(open.length - 1, Math.floor(roll * open.length))] : undefined;
}

// ---------- Never the same twice (Mateo's rule: nothing may get repetitive) ----------

// An index 0..count-1 that isn't in `used`, or -1 once everything has been used. roll: 0..1
export function freshPick(count, used = [], roll = 0) {
  const open = [...Array(count).keys()].filter((i) => !used.includes(i));
  return open.length ? open[Math.min(open.length - 1, Math.floor(roll * open.length))] : -1;
}

// How a rival lord comes at the throne on their 1st, 2nd, 3rd... attempt: a different army every time, and a bigger one
export const LORD_APPROACHES = [
  { modifiers: [], line: "They come the old way: banners up, straight at the gate." },
  { modifiers: ["siegeTrain"], line: "This time they have brought rams from the first horn." },
  { modifiers: ["sappers", "march"], line: "This time they come fast and low, with twice the sappers." },
  { modifiers: ["shields", "bloodlust"], line: "This time every soldier is armored, and they have been promised your walls." },
  { modifiers: ["siegeTrain", "shields", "march"], line: "This time they have brought everything they own." },
];
export function lordApproach(tries) {
  const base = LORD_APPROACHES[Math.min(tries, LORD_APPROACHES.length - 1)];
  const extra = Math.max(0, tries - (LORD_APPROACHES.length - 1)); // past the last approach, only the size keeps growing
  return { ...base, threat: Math.min(3, CROWN.npcStormThreat + 0.15 * tries + 0.1 * extra) };
}

// A banished ruler who has walked the Long Road before doesn't walk the middle of it again
export const nextExileStage = (stage, timesExiled) => (stage === 0 && timesExiled > 1 ? 3 : stage + 1);

export const abandoned = (challenge, nowMs) =>
  !!challenge && !challenge.stormed && nowMs - challenge.declaredMs >= CROWN.abandonDays * 86400000;

// ---------- The Long Road Back ----------

export const EXILE_STAGES = [
  { name: "Ashes and Oaths", goal: "Raise a new Keep Banner on free land.", claim: 0, emeralds: 16 }, // emeralds: old unit, paid as 8 coins each
  { name: "The Loyalists", goal: "Recruit 2 guards on your new land.", claim: 10, emeralds: 10 },
  { name: "Hold the Line", goal: "Win a siege at your new settlement.", claim: 15, emeralds: 0 },
  { name: "The Underground", goal: `Bind an ${CROWN.shard}.`, claim: 10, emeralds: 0 },
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
