// Plot rules and tier charters, as plain functions (no game imports, so Node tests them).
// The numbers and lists are in config.js (OPENS_AT, PLOT_SIZE, PLOT_ALSO, PLOT_FALLBACK, PLOT_TAGS, CHARTERS).
//
//   slotClass(slot) -> "S" | "M" | "ML" | "L" | "G" | "W" (a Works plot: the machines, buildings.js WORKS)
//   plotFit(id, slot, freeClasses) -> { ok, tagged, why }   may this building go on this plot?
//   charterCheck(tier, counts, known) -> { met, lines: [{ what, have, need, skipped }] }
//   charterKeeps(free, tier, counts, known, slot, id) -> undefined, or { what, tier, ids } the plot is kept for

import { OPENS_AT, PLOT_SIZE, PLOT_ALSO, PLOT_FALLBACK, PLOT_MIN_BOX, PLOT_TAGS, TAG_WORDS, CHARTERS, WORK, ONE_EACH } from "./config.js";

export const CLASS_NAMES = { S: "Small", M: "Medium", ML: "long Medium", L: "Large", G: "Great", W: "Works" };

export const slotClass = (slot) => (slot.size === "M" && slot.long ? "ML" : slot.size);
// [width along the door side, depth] of a slot with a box and door (undefined without them)
export function slotDims(slot) {
  const b = slot?.box, d = slot?.door;
  if (!b || !d) return undefined;
  const wx = b.x1 - b.x0 + 1, wz = b.z1 - b.z0 + 1;
  return d.z ? [wx, wz] : [wz, wx];
}

export const opensAt = (id) => OPENS_AT[id] ?? 3;

// One of each per settlement (config.js ONE_EACH). counts: what stands or is going up in the settlement.
// -> undefined, or the words for a menu (ONE_EACH_WHY)
export const ONE_EACH_WHY = "already built here (one per settlement)";
export const oneEachTaken = (id, counts) => (ONE_EACH.includes(id) && (counts?.[id] ?? 0) >= 1 ? ONE_EACH_WHY : undefined);
// Said when a second one is asked for. move: how to have it somewhere else
export const oneEachMessage = (name, move = "take the old one down first") =>
  `§cYour settlement already has a ${name}.§7 Special buildings are one per settlement: to have it somewhere else, ${move}.`;

// freeClasses: a Set of the classes of the town's open, empty plots (for PLOT_FALLBACK)
export function plotFit(id, slot, freeClasses = new Set()) {
  const cls = slotClass(slot);
  const own = [PLOT_SIZE[id] ?? "S", ...(PLOT_ALSO[id] ?? [])];
  let ok = own.includes(cls);
  if (!ok && (PLOT_FALLBACK[id] ?? []).includes(cls)) ok = !own.some((c) => freeClasses.has(c));
  if (!ok) return { ok: false, tagged: false, why: `needs a ${CLASS_NAMES[PLOT_SIZE[id] ?? "S"]} plot` };
  const min = PLOT_MIN_BOX[id], dims = slotDims(slot);
  if (min && dims && (dims[0] < min[0] || dims[1] < min[1])) return { ok: false, tagged: false, why: `needs a deeper ${CLASS_NAMES[PLOT_SIZE[id] ?? "S"]} plot (${min[0]} x ${min[1]})` };
  const tags = slot.tags ?? [];
  const rule = PLOT_TAGS[id] ?? {};
  if (rule.needs && !rule.needs.some((t) => tags.includes(t))) return { ok: false, tagged: true, why: `needs a plot ${rule.needs.map((t) => TAG_WORDS[t] ?? t).join(" or ")}` };
  return { ok: true, tagged: !!rule.prefer?.some((t) => tags.includes(t)), why: "" };
}

// counts: { buildingId: how many stand }. known: a Set of the building ids the game can raise.
export function charterCheck(tier, counts, known) {
  const lines = [];
  const charter = CHARTERS[tier] ?? [];
  // the work buildings the charters up to this one name (only the ones that exist), for "more"; a building two
  // charters name (the Barracks: Hamlet and City) counts once, at the larger count
  const namedBy = new Map();
  for (let t = 0; t <= tier; t++) for (const l of CHARTERS[t] ?? []) {
    if (l.more || !l.ids.every((i) => WORK.includes(i)) || !l.ids.some((i) => known.has(i))) continue;
    const key = l.ids.join();
    namedBy.set(key, Math.max(namedBy.get(key) ?? 0, l.count ?? 1));
  }
  let named = 0;
  for (const n of namedBy.values()) named += n;
  for (const l of charter) {
    const live = l.ids.filter((i) => known.has(i));
    const have = live.reduce((n, i) => n + (counts[i] ?? 0), 0);
    const need = l.more ? named + l.more : l.count ?? 1;
    lines.push({ what: l.what, have: Math.min(have, need), need, skipped: !live.length, more: l.more ?? 0 });
  }
  return { met: lines.every((l) => l.skipped || l.have >= l.need), lines };
}

// One line per charter need, for a menu or chat
export const charterText = (check) => check.lines.map((l) => (l.skipped
  ? `§8${l.what}: not in the game yet, skipped`
  : `${l.have >= l.need ? "§a" : "§7"}${l.more ? `${l.more} ${l.what}` : l.what}: ${l.have}/${l.need}`));

// What a Rival Lord raises next in their town (the same plots and rules as a player): the charter for the tier
// they are at comes first, then every open plot is filled with something that suits it.
//   slots: the open, empty plots. counts: what stands. designs: ids that can be raised (ready-made designs).
//   fits(id, slot): can the design physically stand there (default yes). Returns { slot, id } or undefined.
//   coming: every empty plot, open or opening later (for charterKeeps; default the open ones)
export function lordPick(slots, tier, counts, designs, fits = () => true, seed = "", coming = slots) {
  if (!slots.length) return undefined;
  const free = new Set(slots.map(slotClass));
  const ok = (id, s) => designs.has(id) && opensAt(id) <= tier && !oneEachTaken(id, counts) && plotFit(id, s, free).ok && fits(id, s) && !charterKeeps(coming, tier, counts, designs, s, id);
  // this tier's charter, then a look ahead to the next one, so plots aren't spent on wells while homes are short
  // (the look ahead only takes Small plots: a house there would spend a Medium the next charter's Mint needs)
  for (const t of [tier, tier + 1]) {
    const check = charterCheck(t, counts, designs);
    for (const [i, line] of (CHARTERS[t] ?? []).entries()) {
      const l = check.lines[i];
      if (!l || l.skipped || l.have >= l.need) continue;
      for (const id of line.ids) {
        if (t > tier && (PLOT_SIZE[id] ?? "S") !== "S") continue;
        const s = slots.find((x) => ok(id, x) && plotFit(id, x, free).tagged) ?? slots.find((x) => ok(id, x));
        if (s) return { slot: s, id };
      }
    }
  }
  // filling up: a plot bigger than Small stays empty while a later charter still needs a building of its size
  // (the 2026-11-13 layouts open few Medium and Large plots before the City)
  const needed = laterNeeds(tier, counts, designs);
  for (const s of slots) {
    if (slotClass(s) !== "S" && needed.has(slotClass(s))) continue;
    const options = [...designs].filter((id) => ok(id, s));
    if (!options.length) continue;
    const good = options.filter((id) => plotFit(id, s, free).tagged);
    const from = good.length ? good : options;
    return { slot: s, id: from[Math.floor(hash01(`${seed}|${s.id}`) * from.length)] };
  }
  return undefined;
}

// Keeping plots for the charters (2026-11-13, the placement thread's rule, for players and lords alike): a plot is
// kept when putting building `id` there would leave this tier's or the next tier's charter with no plot it could
// still be met on. Each unmet charter need is matched to a free plot that opens by that charter's tier and that a
// building of the need fits (a small bipartite matching); `id` is allowed when the needs still all match after it.
//   free: the open-or-coming empty plots ({ id, size, long, tier, tags }), counts: what stands, known: ids that
//   count, slot: the plot asked about, id: the building. -> undefined (allowed) or { what, tier, ids } (kept for it)
// When the needs can't all be matched even now, nothing is kept (keeping plots then would only block the player).
export function charterKeeps(free, tier, counts, known, slot, id) {
  const before = charterUnits(tier, counts, known);
  if (!before.length || !matchUnits(before, free)) return undefined;
  const after = charterUnits(tier, { ...counts, [id]: (counts[id] ?? 0) + 1 }, known);
  const rest = free.filter((s) => s.id !== slot.id);
  if (matchUnits(after, rest)) return undefined;
  // name the need this plot is kept for: one that this plot could hold, and without which the rest would still fit
  const holds = (u) => !u.ids.includes(id) && u.ids.some((i) => plotFit(i, slot).ok);
  const kept = after.find((u, i) => holds(u) && matchUnits(after.filter((_, j) => j !== i), rest)) ?? after.find(holds) ?? after[0];
  return { what: kept.what, tier: kept.tier, ids: kept.ids.filter((i) => plotFit(i, slot).ok) };
}

// The unmet needs of this tier's and the next tier's charters, one unit per building still wanted
function charterUnits(tier, counts, known) {
  const units = [], made = new Map();
  for (const t of [tier, tier + 1]) {
    if (t >= CHARTERS.length) continue;
    const check = charterCheck(t, counts, known);
    for (const [i, line] of CHARTERS[t].entries()) {
      const l = check.lines[i];
      if (!l || l.skipped || l.have >= l.need) continue;
      const key = line.ids.join(",");
      const already = made.get(key) ?? 0; // the next tier's homes include this tier's
      const want = l.need - l.have - already;
      for (let k = 0; k < want; k++) units.push({ what: line.what, tier: t, ids: line.ids.filter((x) => known.has(x)) });
      made.set(key, already + Math.max(0, want));
    }
  }
  return units;
}

// Can every unit have a plot of its own? (augmenting paths; a town has a few dozen plots at most)
function matchUnits(units, free) {
  const owner = new Map(); // plot id -> unit index
  const fits = (u, s) => s.tier <= u.tier && u.ids.some((i) => plotFit(i, s).ok);
  const tryUnit = (ui, seen) => {
    for (const s of free) {
      if (seen.has(s.id) || !fits(units[ui], s)) continue;
      seen.add(s.id);
      if (!owner.has(s.id) || tryUnit(owner.get(s.id), seen)) { owner.set(s.id, ui); return true; }
    }
    return false;
  };
  return units.every((u, ui) => tryUnit(ui, new Set()));
}

// The plot classes the charters after this tier still need for lines not yet met
function laterNeeds(tier, counts, designs) {
  const out = new Set();
  for (let t = tier + 1; t < CHARTERS.length; t++) {
    const check = charterCheck(t, counts, designs);
    for (const [i, line] of CHARTERS[t].entries()) {
      const l = check.lines[i];
      if (!l || l.skipped || l.have >= l.need) continue;
      for (const id of line.ids) if (designs.has(id)) for (const c of [PLOT_SIZE[id] ?? "S", ...(PLOT_ALSO[id] ?? [])]) out.add(c);
    }
  }
  return out;
}

function hash01(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}
