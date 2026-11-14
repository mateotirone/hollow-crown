// Pure helpers for the lore feature: no Minecraft imports, so they run in the offline check.

import { TOMES_A } from "./data/tomes_a.js";
import { TOMES_B } from "./data/tomes_b.js";
import { TOMES_C } from "./data/tomes_c.js";
import { LOCAL_TOMES, LOCAL_COLLECTIONS, LOCAL_THREADS } from "./data/plots.js";
import { COLLECTIONS, SITE_FEATURES, SITE_IDS, SURVEY_LINES, THREADS, MILESTONES } from "./data/world.js";

export const TOMES = [...TOMES_A, ...TOMES_B, ...TOMES_C];
// The 75 tomes are TOMES. Each settlement plot also has three local books (data/plots.js): they can be read,
// shelved and solved like any other, but they never count toward the 75, the 16 mysteries or Library rank.
export const ALL_TOMES = [...TOMES, ...LOCAL_TOMES];
export const ALL_THREADS = [...THREADS, ...LOCAL_THREADS];
export const isLocal = (id) => String(id).startsWith("loc_") || String(id).startsWith("local_");
export const TOME = Object.fromEntries(ALL_TOMES.map((t) => [t.id, t]));
export const COLLECTION = Object.fromEntries([...COLLECTIONS, ...LOCAL_COLLECTIONS].map((c) => [c.id, c]));
export const THREAD = Object.fromEntries(ALL_THREADS.map((t) => [t.id, t]));
export const tomesOf = (col) => ALL_TOMES.filter((t) => t.col === col).sort((a, b) => a.n - b.n);
export const CLUE_THREADS = {}; // clue id -> [thread ids]
for (const t of ALL_THREADS) for (const clue of Object.keys(t.clues)) (CLUE_THREADS[clue] ??= []).push(t.id);

// ---------- The Surveyor's notes ----------
export const surveyLine = (site, n) => SURVEY_LINES[n][SITE_FEATURES[site][n] ? 0 : 1];

// Which sites are still possible given the survey tomes (0-5) someone has read
export function sitesMatching(realSite, surveyNumbers) {
  return SITE_IDS.filter((id) => surveyNumbers.every((n) => SITE_FEATURES[id][n] === SITE_FEATURES[realSite][n]));
}

// ---------- Unreadable writing ----------
// Cipher: a fixed letter swap (Elias and Annet's wheel). Mirror: each line written backward.
const PLAIN = "abcdefghijklmnopqrstuvwxyz";
const WHEEL = "qhzmwtkbxnaysovflcdjpreugi";
export function encipher(text) {
  return text.replace(/[a-z]/gi, (ch) => {
    const out = WHEEL[PLAIN.indexOf(ch.toLowerCase())];
    return ch === ch.toLowerCase() ? out : out.toUpperCase();
  });
}
export const mirror = (text) => text.split("\n").map((line) => [...line].reverse().join("")).join("\n");

// Pages as this reader sees them. can = { cipher, mirror }
export function pagesFor(tome, site, can = {}) {
  let pages = tome.pages.map((p) => (p === "{SURVEY}" ? surveyLine(site, tome.survey) : p));
  if (tome.cipher && !can.cipher) pages = pages.map(encipher);
  if (tome.mirror && !can.mirror) pages = pages.map(mirror);
  return pages;
}
export const readable = (tome, can = {}) => !(tome.cipher && !can.cipher) && !(tome.mirror && !can.mirror);

// ---------- Answers ----------
export const normalize = (text) => String(text ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
export function answerIsRight(thread, given) {
  if (thread.kind === "choice") return given === thread.answer;
  if (thread.kind === "text") return thread.accept.map(normalize).includes(normalize(given));
  return false;
}

// ---------- Player progress (plain object, saved by player.js) ----------
export const blankProgress = () => ({
  read: [], // tome ids read to the last page
  got: [], // tome ids received from a cache, drop or NPC (each is given once)
  clues: [], // clue ids in the Ledger
  leads: [], // place ids in the Ledger
  flags: [], // dialogue and reward flags
  solved: [], // thread ids
  claimed: [], // "col:<id>" and "mile:<n>" rewards taken
  once: [], // effects already applied ("npc|node|i")
  locks: {}, // thread id -> world day the next answer is allowed
});

export const hasReadAll = (p, col) => tomesOf(col).every((t) => p.read.includes(t.id));

// Dialogue conditions. ctx = { path, resonance, night, shelved }
export function holds(cond, p, ctx = {}) {
  if (cond.startsWith("!")) return !holds(cond.slice(1), p, ctx);
  const [kind, value] = [cond.slice(0, cond.indexOf(":")), cond.slice(cond.indexOf(":") + 1)];
  if (cond === "night") return !!ctx.night;
  if (cond === "raided") return ctx.raided !== false; // Act 1: this player's first raid is behind them (unknown counts as yes)
  switch (kind) {
    case "flag": return p.flags.includes(value);
    case "read": return p.read.includes(value);
    case "clue": return p.clues.includes(value);
    case "solved": return p.solved.includes(value);
    case "col": return hasReadAll(p, value);
    case "path": return ctx.path === value || (value === "marked" && ctx.path === "sorcerer"); // the magic role, either name
    case "resonance": return (ctx.resonance ?? 0) >= Number(value);
    case "shelved": return (ctx.shelved ?? 0) >= Number(value);
    case "act1": return ctx.act1 === value; // newplayer/act1_rules.js act1Stage
    case "mode": return (ctx.mode ?? "story") === value; // newplayer/mode_rules.js: "story" | "settlement"
    default: return false;
  }
}

export function startNode(npc, p, ctx) {
  for (const [conds, node] of npc.start) if (conds.every((c) => holds(c, p, ctx))) return node;
  return npc.start[npc.start.length - 1][1];
}

// Where a button leads: a node id, "end", "start", or a list of [conditions, node] like start
export function nextNode(next, p, ctx) {
  if (!Array.isArray(next)) return next;
  return (next.find(([conds]) => conds.every((c) => holds(c, p, ctx))) ?? next[next.length - 1])[1];
}
export const nextNodes = (next) => (Array.isArray(next) ? next.map(([, node]) => node) : [next]);

// ---------- Saved data versions ----------
// Lore saves three things outside moduleStore(), because their keys are per player or per settlement: a player's
// progress, each settlement's shelves, and the map builder's marked places. Each is stamped with _v when saved.
// To change the SHAPE of one (rename or restructure a field), raise its version here and add a step to UPGRADES.
// Adding a new field with a default needs no bump. Saves from before versions existed count as version 1.
export const SAVE_VERSION = { progress: 1, library: 1, places: 1 };
const UPGRADES = { progress: [], library: [], places: [] }; // UPGRADES.progress[0] takes v1 data to v2, and so on
export function loadSaved(kind, raw, upgrades = UPGRADES[kind]) {
  if (typeof raw !== "string") return undefined;
  let { _v: from = 1, ...data } = JSON.parse(raw);
  for (let v = from; v < SAVE_VERSION[kind] && upgrades[v - 1]; v++) data = upgrades[v - 1](data) ?? data;
  return data;
}
export const stampSaved = (kind, data) => JSON.stringify({ ...data, _v: SAVE_VERSION[kind] });

export const sceneTag = (npcId, node) => `siege_lore_${npcId}_${node}`;
// Nodes a player returns to (every "hub") carry greets: other wordings of the same node. Mateo, 2026-11-10: the game
// "should never, ever, ever get repetitive". pickGreet never gives the same wording twice running.
export const greetCount = (node) => 1 + (node?.greets?.length ?? 0);
export function pickGreet(count, last, roll) {
  if (count <= 1) return 0;
  const v = Math.floor(roll * count) % count;
  return v === last ? (v + 1) % count : v;
}
export const variantTag = (npcId, node, v) => sceneTag(npcId, node) + (v ? `__${v}` : "");
// The same idea for one-line omens: a pool, picked so the last one heard is never repeated
export function pickLine(pool, last, roll) { return pool[pickGreet(pool.length, pool.indexOf(last), roll)]; }

// Adds clues to a progress object; returns the names of threads that gained a clue
export function addClues(p, clues) {
  const touched = new Set();
  for (const clue of clues) {
    if (p.clues.includes(clue)) continue;
    p.clues.push(clue);
    for (const id of CLUE_THREADS[clue] ?? []) touched.add(THREAD[id].name);
  }
  return [...touched];
}

// Enough clues, including any the thread insists on
export const canAnswer = (p, thread) =>
  cluesFound(p, thread).length >= thread.need && (thread.must ?? []).every((c) => p.clues.includes(c));

export const cluesFound = (p, thread) => Object.keys(thread.clues).filter((c) => p.clues.includes(c));

export function libraryRank(count) {
  return [...MILESTONES].reverse().find((m) => count >= m.at);
}
