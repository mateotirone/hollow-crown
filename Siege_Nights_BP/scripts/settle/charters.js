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

// What a Rival Lord raises next in their town (the same plots and rules as a player): the charter for the tier
// they are at comes first, then every open plot is filled with something that suits it.
//   slots: the open, empty plots. counts: what stands. designs: ids that can be raised (ready-made designs).
//   fits(id, slot): can the design physically stand there (default yes). Returns { slot, id } or undefined.
export function lordPick(slots, tier, counts, designs, fits = () => true, seed = "") {
  if (!slots.length) return undefined;
  const free = new Set(slots.map(slotClass));
  const ok = (id, s) => designs.has(id) && opensAt(id) <= tier && plotFit(id, s, free).ok && fits(id, s);
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
