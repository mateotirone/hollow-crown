// Act V, pure rules: no Minecraft here, so everything can be self-tested offline.

import { HOUSES } from "./data/houses.js";
import { FIRST, FAMILY, WHEN, ASK, SEEK, TWIST, KEEPSAKE } from "./data/homecomings.js";

export const AFTER = {
  standingMin: 0,
  standingMax: 10,
  fallCost: 2, // a house loses this when its champion is put down
  backerGain: 1, // each house backed by a player who helped put a champion down gains this
  satGain: 3, // a champion who sits unchallenged long enough wins its house this much
  switchCost: 1, // a house you stop backing resents it
  envoyMemory: 2, // an envoy's house is never one of the last this many to visit
  homecomingGapMin: 5, // days between strangers
  homecomingGapMax: 9,
  homecomingFirstAfterDays: 3, // after Morvane falls
  strangerWaitDays: 4, // a stranger nobody helps gives up and leaves
  nameMemory: 40, // a name is not used again until this many strangers later
};

export const HOUSE_IDS = HOUSES.map((h) => h.id);
export const houseOf = (id) => HOUSES.find((h) => h.id === id);

// A small seeded dice roll (same as the Pretenders'), so a stranger can be rebuilt from a number.
export function dice(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (n) => Math.max(AFTER.standingMin, Math.min(AFTER.standingMax, n));

// ---------- the Five Chairs ----------

// Starting standings for a new world: 3-6 each, from a roll per house.
export const startStandings = (rolls) => Object.fromEntries(HOUSE_IDS.map((id, i) => [id, 3 + Math.floor((rolls[i] ?? 0.5) * 4)]));

// Who holds the seat: the highest standing; a tie keeps the house that already holds it, else the earliest in the list.
export function seatOf(standing, current) {
  let best;
  for (const id of HOUSE_IDS) if (best === undefined || standing[id] > standing[best]) best = id;
  if (current && standing[current] === standing[best]) return current;
  return best;
}

// Which house a new Pretender rises for: never the seat holder (it has nothing to claim) and never the house
// whose champion rose last. Hungrier houses (lower standing) send champions more often.
export function houseForPretender(standing, seat, last, roll) {
  const pool = HOUSE_IDS.filter((id) => id !== seat && id !== last);
  const weights = pool.map((id) => 1 + AFTER.standingMax - standing[id]);
  let r = roll * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r < 0) return pool[i];
  }
  return pool[pool.length - 1];
}

// A champion is put down. `backed` = the houses backed by the players who did it (duplicates allowed).
export function afterFall(standing, house, backed = []) {
  const next = { ...standing };
  if (house && next[house] !== undefined) next[house] = clamp(next[house] - AFTER.fallCost);
  for (const id of new Set(backed)) if (id !== house && next[id] !== undefined) next[id] = clamp(next[id] + AFTER.backerGain);
  return next;
}

// A champion sat unchallenged for its march days: its house gains.
export const afterSat = (standing, house) => (standing[house] === undefined ? standing : { ...standing, [house]: clamp(standing[house] + AFTER.satGain) });

// A player changes which house they back.
export function afterSwitch(standing, from, to) {
  if (!from || from === to || standing[from] === undefined) return standing;
  return { ...standing, [from]: clamp(standing[from] - AFTER.switchCost) };
}

// Which house sends tonight's envoy: never one of the last few to visit.
export function envoyHouse(recent, roll) {
  const pool = HOUSE_IDS.filter((id) => !recent.slice(-AFTER.envoyMemory).includes(id));
  return pool[Math.floor(roll * pool.length)] ?? HOUSE_IDS[0];
}

// A line from a pool, never the one given last time.
export function freshLine(pool, last, roll) {
  if (pool.length < 2) return 0;
  const i = Math.floor(roll * (pool.length - 1));
  return last !== undefined && i >= last ? i + 1 : i;
}

// A third night, by the old count (after the story the Reach no longer keeps one).
export const isThirdNight = (day, every = 3) => day >= 1 && day % every === 0;

// ---------- the Homecomings ----------

// Everything about a stranger from its seed. `history` = { names: [...], last: { when, ask, twist } }:
// no name from the last AFTER.nameMemory, and no repeat of the last stranger's way down, ask or twist.
export function makeStranger(seed, history = {}) {
  const names = new Set(history.names ?? []), last = history.last ?? {};
  for (let turn = 0; turn < 40; turn++) {
    const roll = dice(seed + turn * 7919);
    const pick = (list) => list[Math.floor(roll() * list.length)];
    const first = pick(FIRST), family = pick(FAMILY), when = pick(WHEN), ask = pick(ASK), twist = pick(TWIST);
    const seek = Math.floor(roll() * SEEK.length), keepsake = Math.floor(roll() * KEEPSAKE.length);
    let first2 = pick(FIRST);
    if (first2 === first) first2 = FIRST[(FIRST.indexOf(first) + 1) % FIRST.length];
    const name = `${first} ${family}`;
    if (names.has(name) || when.id === last.when || ask.id === last.ask || twist === last.twist) continue;
    return { seed, name, first, family, first2, when: when.id, ask: ask.id, twist, seek, keepsake };
  }
  return makeStranger(seed + 1, { names: history.names }); // very unlucky: drop the "not like the last" rule
}

export const whenOf = (s) => WHEN.find((w) => w.id === s.when);
export const askOf = (s) => ASK.find((a) => a.id === s.ask);

// Fill {NAME} {FAMILY} {FIRST2} {SETTLEMENT} in a line.
export const fill = (text, s, extra = {}) =>
  text.replace(/\{NAME\}/g, s.name).replace(/\{FAMILY\}/g, s.family).replace(/\{FIRST2\}/g, s.first2).replace(/\{SETTLEMENT\}/g, extra.settlement ?? "Millbrook");

// The stranger's opening words, all in one go.
export function strangerStory(s) {
  const w = whenOf(s), a = askOf(s);
  return [
    `"My name is ${s.name}. I ${w.how}."`,
    `"${w.long}"`,
    `"${fill(SEEK[s.seek], s)}"`,
    `"${a.line}"`,
  ];
}

export const nextHomecoming = (day, roll) => day + AFTER.homecomingGapMin + Math.floor(roll * (AFTER.homecomingGapMax - AFTER.homecomingGapMin + 1));
