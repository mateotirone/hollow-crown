// Wonder rules as plain functions (no game imports, so Node tests them). Numbers and words: data.js.
//
//   forwardOf(face) -> { x, z }          the build engine's forward for a front that looks `face` (front = local -z)
//   stageRows(design, stage) -> rows      the rows of one stage (1 to 6), cut by height
//   perTickFor(blocks)                    blocks a tick so a stage rises in about WONDER.stageSeconds
//   claimProblem({ tier, rising })        why a settlement can't claim a free wonder, or null
//   payProblem(w, { tier })               why the next stage can't be paid for now, or null
//   standing(w)                           every stage built: the effect is on
//   heldBy(states, id, isAlly, home)      ids of finished wonders whose effect reaches `id`: holder, ally, or a
//                                         settlement in the wonder's home region (`home` = id's region)
//   adjustCharge(amount, reason, held)    a price after the wonders' discounts
//   adjustPay(amount, isJobSale, held)    a sale's coins after the wonders' bonus
//   extraArrivals(held)                   newcomers added at a dawn census
//   keepBonus(hp, held)                   keep heart health after the wonders
//   lordDue(start, day)                   stages a Rival Lord's crew has finished by `day`
//   challengeProblem(w, { by, tier, day, holderHere, ally })   why `by` can't challenge now, or null
//   defendersFor(built)                   soldiers who answer a challenge
//   reachOf(design)                       blocks the wonder reaches from its centre (any facing)
//   guardOf(w, design)                    the guarded half width: the wonder, its graded ring and a margin
//   inGuard(site, loc, r)                 inside the ground nobody digs up (half width r)
//   levelOf(heights)                      the ground level a wonder is graded to: the median of the ground under it
//   gradeTarget(G, r, out, w?)            where a column's ground goes: G under the wonder, eased back to r round it

import { WONDER, WONDER_BY_ID } from "./data.js";

const FACE = { n: { x: 0, z: -1 }, s: { x: 0, z: 1 }, e: { x: 1, z: 0 }, w: { x: -1, z: 0 } };
export const forwardOf = (face) => ({ x: -FACE[face].x, z: -FACE[face].z });

export function stageRows(d, stage) {
  const lo = stage <= 1 ? -Infinity : d.stages[stage - 2];
  const hi = stage >= WONDER.stages ? Infinity : d.stages[stage - 1];
  return d.rows.filter((r) => r[0] >= lo && r[0] < hi);
}

export const stageBlocks = (d, stage) => stageRows(d, stage).reduce((n, r) => n + r[3], 0);

export const perTickFor = (blocks) => Math.max(1, Math.ceil(blocks / (WONDER.stageSeconds * 20)));

export function claimProblem({ tier = 0, rising = false } = {}) {
  if (tier < WONDER.minTier) return "needCity";
  if (rising) return "oneAtATime";
  return null;
}

export function payProblem(w, { tier = 0 } = {}) {
  if ((w?.paid ?? 0) >= WONDER.stages) return "done";
  if ((w?.built ?? 0) < (w?.paid ?? 0)) return "rising";
  if (tier < WONDER.minTier) return "needCity";
  return null;
}

export const standing = (w) => (w?.built ?? 0) >= WONDER.stages;
export const rising = (w) => !!w?.holder && !standing(w);

export function heldBy(states, id, isAlly = () => false, home = undefined) {
  return Object.entries(states ?? {}).filter(([k, w]) => w?.holder && standing(w) &&
    (w.holder === id || isAlly(w.holder, id) || (home !== undefined && WONDER_BY_ID[k]?.home === home))).map(([k]) => k);
}

const effects = (held) => held.map((k) => WONDER_BY_ID[k]?.effect).filter(Boolean);

export function adjustCharge(amount, reason, held) {
  let by = 0;
  for (const e of effects(held)) if (e.kind === "charge" && e.reasons.includes(reason)) by = Math.max(by, e.by);
  return by ? Math.max(1, Math.ceil(amount * (1 - by) - 1e-9)) : amount;
}

export function adjustPay(amount, isJobSale, held) {
  let by = 0;
  for (const e of effects(held)) if (e.kind === "pay" && e.jobs && isJobSale) by = Math.max(by, e.by);
  return by ? Math.floor(amount * (1 + by) + 1e-9) : amount;
}

export const extraArrivals = (held) => effects(held).filter((e) => e.kind === "arrivals").reduce((n, e) => n + e.add, 0);

export function keepBonus(hp, held) {
  const by = effects(held).filter((e) => e.kind === "keep").reduce((n, e) => n + e.by, 0);
  return by ? Math.round(hp * (1 + by)) : hp;
}

export const lordDue = (start, day) => Math.max(0, Math.min(WONDER.stages, 1 + Math.floor((day - start) / WONDER.lordDaysPerStage)));

export function challengeProblem(w, { by, tier = 0, day = 0, holderHere = false, ally = false } = {}) {
  if (!w?.holder || (w.built ?? 0) < 1) return "nothingToTake";
  if (w.holder === by || ally) return "yours";
  if (tier < WONDER.minTier) return "needCity";
  if (day < (w.restUntil ?? -1)) return "resting";
  if (!String(w.holder).startsWith("npc:") && !holderHere) return "holderAway";
  return null;
}

export const defendersFor = (built) => WONDER.defenders[Math.max(0, Math.min(WONDER.defenders.length, built) - 1)];

export const reachOf = (d) => Math.max(-d.box.x0, d.box.x1, -d.box.z0, d.box.z1);
export const guardOf = (w, d) => reachOf(d) + (w.ground === "water" ? 0 : WONDER.ease) + WONDER.guardMargin;
export const inGuard = (site, loc, r) => Math.abs(loc.x - site.x) <= r && Math.abs(loc.z - site.z) <= r;

export function levelOf(heights) {
  const s = heights.filter(Number.isFinite).sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : undefined;
}

// out = blocks outside the wonder's rectangle (0 inside). Inside, the ground is cut or filled to G; round it the
// ground eases back to its own height r over WONDER.ease blocks, never filled up more than WONDER.easeFill there.
export function gradeTarget(G, r, out) {
  if (out <= 0) return G;
  if (out > WONDER.ease) return r;
  const t = Math.round(G + (r - G) * (out / (WONDER.ease + 1)));
  return t > r ? Math.min(t, r + WONDER.easeFill) : t;
}
