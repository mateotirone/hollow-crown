// Plot rules and tier charters, as plain functions (no game imports, so Node tests them).
// The numbers and lists are in config.js (OPENS_AT, PLOT_SIZE, PLOT_ALSO, PLOT_FALLBACK, PLOT_TAGS, CHARTERS).
//
//   slotClass(slot) -> "S" | "M" | "ML" | "L" | "G"
//   plotFit(id, slot, freeClasses) -> { ok, tagged, why }   may this building go on this plot?
//   charterCheck(tier, counts, known) -> { met, lines: [{ what, have, need, skipped }] }

import { OPENS_AT, PLOT_SIZE, PLOT_ALSO, PLOT_FALLBACK, PLOT_TAGS, TAG_WORDS, CHARTERS, WORK } from "./config.js";

export const CLASS_NAMES = { S: "Small", M: "Medium", ML: "long Medium", L: "Large", G: "Great" };

export const slotClass = (slot) => (slot.size === "M" && slot.long ? "ML" : slot.size);

export const opensAt = (id) => OPENS_AT[id] ?? 3;

// freeClasses: a Set of the classes of the town's open, empty plots (for PLOT_FALLBACK)
export function plotFit(id, slot, freeClasses = new Set()) {
  const cls = slotClass(slot);
  const own = [PLOT_SIZE[id] ?? "S", ...(PLOT_ALSO[id] ?? [])];
  let ok = own.includes(cls);
  if (!ok && (PLOT_FALLBACK[id] ?? []).includes(cls)) ok = !own.some((c) => freeClasses.has(c));
  if (!ok) return { ok: false, tagged: false, why: `needs a ${CLASS_NAMES[PLOT_SIZE[id] ?? "S"]} plot` };
  const tags = slot.tags ?? [];
  const rule = PLOT_TAGS[id] ?? {};
  if (rule.needs && !rule.needs.some((t) => tags.includes(t))) return { ok: false, tagged: true, why: `needs a plot ${rule.needs.map((t) => TAG_WORDS[t] ?? t).join(" or ")}` };
  return { ok: true, tagged: !!rule.prefer?.some((t) => tags.includes(t)), why: "" };
}

// counts: { buildingId: how many stand }. known: a Set of the building ids the game can raise.
export function charterCheck(tier, counts, known) {
  const lines = [];
  const charter = CHARTERS[tier] ?? [];
  // the work buildings the charters up to this one name (only the ones that exist), for "more"
  let named = 0;
  for (let t = 0; t <= tier; t++) for (const l of CHARTERS[t] ?? []) if (!l.more && l.ids.every((i) => WORK.includes(i)) && l.ids.some((i) => known.has(i))) named += l.count ?? 1;
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
