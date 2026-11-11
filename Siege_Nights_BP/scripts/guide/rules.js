// The Almanac's rules, with no Minecraft in them: what counts as meeting a page, which pages a player
// can see, and how a player's marks are saved. index.js is the game side.

import { CHAPTERS, ENTRIES } from "./data.js";

export const KINDS = ["place", "click", "hit", "use", "carry", "talk", "near", "event"];

// Game events that concern everyone online (the rest name one player)
export const WORLD_EVENTS = new Set(["siegeStart", "crowned", "shardfall"]);

// Chapters allowed to name the place itself (they only open once a player has been there, or
// someone holds the Heart). Everywhere else the word stays out, except in "the Hollow Crown".
export const NAMING_CHAPTERS = new Set(["beyond", "throne"]);
export const namesTheHollow = (text) => /\bHollow\b(?! Crown)/.test(text ?? "");

export const ENTRY = Object.fromEntries(ENTRIES.map((e) => [e.id, e]));

// "carry:siege:coin" -> { kind: "carry", what: "siege:coin" }
export function parseWhen(spec) {
  const at = spec.indexOf(":");
  return { kind: spec.slice(0, at), what: spec.slice(at + 1) };
}

// Build lookups once: kind -> { exact: Map(what -> [ids]), prefix: [[stem, id]] }
export function buildIndex(entries = ENTRIES) {
  const index = Object.fromEntries(KINDS.map((k) => [k, { exact: new Map(), prefix: [] }]));
  for (const e of entries) {
    for (const spec of e.when ?? []) {
      const { kind, what } = parseWhen(spec);
      const slot = index[kind];
      if (!slot) continue;
      if (what.endsWith("*")) slot.prefix.push([what.slice(0, -1), e.id]);
      else {
        if (!slot.exact.has(what)) slot.exact.set(what, []);
        slot.exact.get(what).push(e.id);
      }
    }
  }
  return index;
}

// Every entry id one of these things meets (names: typeIds, or "tag:<tag>" strings)
export function entriesFor(index, kind, names) {
  const slot = index[kind];
  if (!slot) return [];
  const out = new Set();
  for (const name of names) {
    for (const id of slot.exact.get(name) ?? []) out.add(id);
    for (const [stem, id] of slot.prefix) if (name.startsWith(stem)) out.add(id);
  }
  return [...out];
}

// ---------- a player's marks ----------
// Saved as one small JSON string: { m: [met ids], r: [read ids], off: tips off }

export function readMarks(raw) {
  try {
    const d = typeof raw === "string" ? JSON.parse(raw) : undefined;
    return { m: Array.isArray(d?.m) ? d.m : [], r: Array.isArray(d?.r) ? d.r : [], off: !!d?.off };
  } catch {
    return { m: [], r: [], off: false };
  }
}

export const writeMarks = (marks) => JSON.stringify({ m: marks.m, r: marks.r, ...(marks.off ? { off: 1 } : {}) });

// exists(id) says whether the build has a block, item or entity (for entries with `needs`)
export function visible(entry, marks, exists = () => true) {
  if (entry.needs && !exists(entry.needs)) return false;
  return !entry.hidden || marks.m.includes(entry.id);
}

export const isNew = (entry, marks) => marks.m.includes(entry.id) && !marks.r.includes(entry.id);

export function chapterPages(chapterId, marks, exists) {
  return ENTRIES.filter((e) => e.ch === chapterId && visible(e, marks, exists));
}

export function chapterList(marks, exists) {
  return CHAPTERS.map((c) => {
    const pages = chapterPages(c.id, marks, exists);
    return { ...c, pages, fresh: pages.filter((e) => isNew(e, marks)).length };
  }).filter((c) => c.pages.length > 0);
}
