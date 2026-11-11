// Pure rules for the role trials: what is done, what comes next, when the role can be offered.
// No Minecraft imports, so the self-tests run in Node too.

import { TRIALS, TRIAL_ROLES, ELEVEN, RANK_LINES } from "./data.js";

export const SAVE_VERSION = 1;

// One player's trials. Saved as JSON in the player dynamic property "hc:role_trials".
export function blankTrials() {
  const roles = {};
  for (const role of TRIAL_ROLES) roles[role] = { started: false, done: [], deed: false, offered: false, washUntil: 0, burnUntil: 0, graves: [], spanFrom: -1 };
  return { v: SAVE_VERSION, roles, knightWall: false, eleven: 1 };
}

// Anything older or partial gets the missing fields filled in, never thrown away.
export function loadTrials(saved) {
  const base = blankTrials();
  if (!saved || typeof saved !== "object") return base;
  for (const role of TRIAL_ROLES) base.roles[role] = { ...base.roles[role], ...(saved.roles?.[role] ?? {}) };
  base.knightWall = !!saved.knightWall;
  base.eleven = Math.max(1, Math.min(ELEVEN.length, saved.eleven ?? 1));
  return base;
}

export const stepsOf = (role) => TRIALS[role]?.steps ?? [];
export const stepById = (role, id) => stepsOf(role).find((s) => s.id === id);
export const roleOfStep = (id) => TRIAL_ROLES.find((role) => stepById(role, id));

// The first step still to do (the deed counts as done once it has happened)
export function nextStep(role, t) {
  return stepsOf(role).find((s) => !(s.how === "deed" ? t.deed : t.done.includes(s.id)));
}

// Every step before the deed is done
export const trialReady = (role, t) => stepsOf(role).every((s) => s.how === "deed" || t.done.includes(s.id));

// The whole trial, deed included
export const trialComplete = (role, t) => trialReady(role, t) && t.deed;

// Mark a step done. true if it was not done before. A step of a trial not yet started is refused,
// except that a hatched dragon has plainly chosen you, so the deed also settles the Choosing.
export function markStep(role, t, id) {
  const step = stepById(role, id);
  if (!step || step.how === "deed" || !t.started || t.done.includes(id)) return false;
  t.done.push(id);
  return true;
}

// The deed happened. Returns what to do: "offer" (the trial is ready), or "wait" (the mentor will send word).
export function markDeed(role, t) {
  t.deed = true;
  if (role === "rider" && t.started && !t.done.includes("choosing")) t.done.push("choosing");
  return t.started && trialReady(role, t) ? "offer" : "wait";
}

// Should the role be offered right now? (deed done, steps done, not offered already)
export const shouldOffer = (role, t) => t.deed && !t.offered && t.started && trialReady(role, t);

// The town hall asks before offering a regional role. true = go ahead.
export function gateOffer(role, t) {
  if (!TRIALS[role]) return true; // not one of ours
  return t.started && trialReady(role, t);
}

// Graves: distinct marker indices. Returns how many are now visited.
export function visitGrave(t, index) {
  if (!t.graves.includes(index)) t.graves.push(index);
  return t.graves.length;
}

// The Span: you must set off from one end and arrive at the other. ends = [start, end].
export function spanProgress(t, atEnd) {
  if (atEnd === 0 || atEnd === 1) {
    if (t.spanFrom === -1) { t.spanFrom = atEnd; return "set off"; }
    if (t.spanFrom !== atEnd) return "across";
  }
  return "";
}

// Is a point on the Span's walkway (near the line between the two ends)? Returns
// { along: 0..1, off: sideways distance, below: how far under the line } or undefined if beyond the ends.
export function spanPosition(start, end, at) {
  const dx = end.x - start.x, dz = end.z - start.z;
  const len2 = dx * dx + dz * dz;
  if (!len2) return undefined;
  const along = ((at.x - start.x) * dx + (at.z - start.z) * dz) / len2;
  if (along < 0 || along > 1) return undefined;
  const px = start.x + dx * along, pz = start.z + dz * along, py = start.y + (end.y - start.y) * along;
  return { along, off: Math.hypot(at.x - px, at.z - pz), below: py - at.y };
}

// Weapons the dragons take offence at
export const isWeapon = (typeId = "") => /sword|_axe$|trident|bow$|crossbow|mace|spear/.test(typeId);

// The mentor's line for a rank, if there is one
export const rankLine = (path, rank) => RANK_LINES[path]?.[rank];

// A safe lore flag name for a rank: rank_marked_listener, rank_knight_man_at_arms
export const rankFlag = (path, rank) => `rank_${path}_${String(rank).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}`;

// Text for the "Your trial" page
export function trialPage(role, t) {
  const trial = TRIALS[role];
  if (!t.started) return "";
  const next = nextStep(role, t);
  const lines = stepsOf(role).map((s) => {
    const done = s.how === "deed" ? t.deed : t.done.includes(s.id);
    return `${done ? "§a[done]§r" : s === next ? "§e[now]§r" : "§8[ ]§r"} ${s.title}${s === next ? `\n§7   ${s.hint}§r` : ""}`;
  });
  return lines.join("\n") + (trialComplete(role, t) ? `\n\n§7Swear the oath at the Tree of Oaths when you are ready.` : `\n\n§8Your mentor waits at ${trial.where}.`);
}

// The next knight of the Eleven to come, or undefined when all have come
export function nextKnight(t) {
  if (!t.knightWall || t.eleven >= ELEVEN.length) return undefined;
  return ELEVEN[t.eleven];
}
