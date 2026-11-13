// The Codex's rules, with no Minecraft in them (Node runs them in tools/check.mjs).
//
//   entries()                       every Codex entry in book order: { id, name, chapter, hint, does, source, ... }
//   chapterCounts(found)            [{ id, name, total, found }]
//   milestonesFor(before, after)    the 10s crossed when the found count goes from before to after
//   mayWear(itemRegion, home, writs, playerId)    the region lock
//   penaltyStage(seconds)           0 warning, 1 slowed, 2 hurt
//   forgeRecipes(wonderId)          what a wonder's forge makes, with costs
//   alloyRecipe(alloyId)            what one alloy ingot takes
//   caravanStock(day)               the four goods on the Sun Gate stalls that day (changes every 3 days)
//   pricesFor(base, lordHeld)       a forge price, doubled when a Rival Lord holds the wonder

import { CHAPTERS, ITEMS, EXISTING } from "./items_data.js";

export const CODEX = {
  bookId: "siege:codex",
  milestoneEvery: 10,
  milestoneRegals: 50,
  caravanDays: 3, // the stalls change every this many days
  caravanStall: 4, // goods on sale at once
  warnSeconds: 10, // the lock: seconds of warning before the land turns on you
  slowSeconds: 20, // then this long slowed before it hurts
  hurtEvery: 3, // seconds between hurts
  scanTicks: 40, // how often pockets are checked for new finds
  findRadius: 12, // blocks from a find's spot
};

export const ITEM = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
export const REGION_NAMES = ["Aldmere Vale", "Frostmarch", "Saltreach", "Emberwaste", "Blackfen"];

// Book order: chapter by chapter, new items first in each chapter in list order, the existing ones after
export function entries() {
  const all = [...ITEMS.filter((i) => i.chapter), ...EXISTING];
  return CHAPTERS.flatMap((c) => all.filter((e) => e.chapter === c.id));
}
export const ENTRY_IDS = new Set(entries().map((e) => e.id));
export const isEntry = (id) => ENTRY_IDS.has(id);

export function chapterCounts(found) {
  const has = found instanceof Set ? found : new Set(found ?? []);
  const list = entries();
  return CHAPTERS.map((c) => {
    const mine = list.filter((e) => e.chapter === c.id);
    return { id: c.id, name: c.name, total: mine.length, found: mine.filter((e) => has.has(e.id)).length };
  });
}

export function milestonesFor(before, after, every = CODEX.milestoneEvery) {
  const out = [];
  for (let n = (Math.floor(before / every) + 1) * every; n <= after; n += every) out.push(n);
  return out;
}

// ---------- the region lock ----------
// itemRegion: the region the gear belongs to ("Frostmarch"); home: the region of the player's settlement (or undefined);
// writs: { "Frostmarch": [playerId, ...] }
export function mayWear(itemRegion, home, writs, playerId) {
  if (!itemRegion) return true;
  if (home === itemRegion) return true;
  return !!writs?.[itemRegion]?.includes(playerId);
}
export function penaltyStage(seconds) {
  if (seconds < CODEX.warnSeconds) return 0;
  if (seconds < CODEX.warnSeconds + CODEX.slowSeconds) return 1;
  return 2;
}
export const PENALTY = {
  Frostmarch: { name: "Creeping cold", slow: "slowness", hurt: "freezing", says: "The cold of Frostmarch knows this gear is not yours." },
  "Aldmere Vale": { name: "The watch shuns you", slow: "weakness", hurt: "magic", says: "The Vale's watch knows this gear is not yours." },
  Saltreach: { name: "The sea pulls", slow: "mining_fatigue", hurt: "drowning", says: "The sea knows this gear is not yours." },
  Emberwaste: { name: "The sun bakes you", slow: "hunger", hurt: "fire", says: "The sun of the Waste knows this gear is not yours." },
  Blackfen: { name: "Fen sickness", slow: "nausea", hurt: "magic", says: "The fen knows this gear is not yours." },
};

// ---------- forges ----------
export const ALLOY_RECIPES = {
  "siege:rime_steel": [["minecraft:diamond", 1], ["minecraft:packed_ice", 4]],
  "siege:watchsteel": [["minecraft:diamond", 1], ["siege:wight_dust", 2]],
  "siege:tidesteel": [["minecraft:diamond", 1], ["siege:brine_scale", 2], ["siege:drowned_pearl", 1]],
  "siege:sunsteel": [["minecraft:diamond", 1], ["siege:wyrm_scale", 2], ["siege:ash_glass", 1]],
  "siege:bogsilver": [["minecraft:diamond", 1], ["siege:toad_venom", 2], ["siege:changeling_ichor", 1]],
};
export const alloyRecipe = (id) => ALLOY_RECIPES[id];
const BASE_PIECE = { helmet: "minecraft:diamond_helmet", chestplate: "minecraft:diamond_chestplate", leggings: "minecraft:diamond_leggings", boots: "minecraft:diamond_boots" };
const PIECE_PRICE = { helmet: 40, chestplate: 60, leggings: 50, boots: 40 };
const WEAPON_BASE = { sword: "minecraft:diamond_sword", axe: "minecraft:diamond_axe", spear: "minecraft:diamond_sword", bow: "minecraft:bow" };
// The trophy a wonder keeper takes for a Kin-Writ when you play alone (10 of it)
export const FAVOUR = { Frostmarch: "siege:rime_pelt", "Aldmere Vale": "siege:wight_dust", Saltreach: "siege:brine_scale", Emberwaste: "siege:wyrm_scale", Blackfen: "siege:toad_venom" };
export const FAVOUR_COUNT = 10;

export function forgeRecipes(wonderId) {
  if (wonderId === "great_horse_fair") {
    return [{ out: "siege:fair_champions_barding", name: ITEM["siege:fair_champions_barding"].name, cost: [["minecraft:diamond_horse_armor", 1], ["siege:pale_antler", 2]], regals: 80 }];
  }
  const gear = ITEMS.filter((i) => i.wonder === wonderId && i.set);
  if (!gear.length) return [];
  const alloy = `siege:${gear[0].alloy}`;
  const out = [{ out: alloy, name: ITEM[alloy]?.name ?? alloy, cost: ALLOY_RECIPES[alloy], regals: 0, alloy: true }];
  for (const g of gear) {
    const base = g.kind === "armor" ? BASE_PIECE[g.piece] : WEAPON_BASE[g.kind];
    out.push({ out: g.id, name: g.name, cost: [[base, 1], [alloy, 4]], regals: g.kind === "armor" ? PIECE_PRICE[g.piece] : 50, region: g.region });
  }
  return out;
}
export const pricesFor = (base, lordHeld) => (lordHeld ? base * 2 : base);

// ---------- the Sun Gate caravan ----------
export const CARAVAN = ITEMS.filter((i) => i.chapter === "caravan");
// A fixed shuffle per stock period, so every player sees the same stalls on the same day
export function caravanStock(day, list = CARAVAN, size = CODEX.caravanStall) {
  const period = Math.floor(Math.max(0, day) / CODEX.caravanDays);
  let seed = (period * 2654435761 + 97) >>> 0;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
  const order = list.map((g) => [rnd(), g]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  return order.slice(0, size);
}

// ---------- sets ----------
// Pieces of a set worn: the count, and whether it is the full four (the Oathsworn sword counts as a fifth)
export function setCount(wornIds, setId) {
  return wornIds.filter((id) => ITEM[id]?.set === setId && ITEM[id]?.kind === "armor").length;
}
export const regionOf = (id) => ITEM[id]?.region;
