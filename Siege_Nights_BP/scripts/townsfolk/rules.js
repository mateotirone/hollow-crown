// Townsfolk: the plain rules (no game calls, so the offline check tests them). The game side is index.js,
// the people and their lines are data.js, where they stand is spots_data.js (tools/townsfolk_spots.py).

import { TOWNSFOLK, REGION_SKINS } from "./data.js";
import { TOWNSFOLK_SPOTS } from "./spots_data.js";

export const FOLK = {
  linesEach: 5, // Mateo, 2026-11-12: "Each of them should have five things that they say"
  reach: 96, // a player this close to a town's centre wakes its townsfolk
  talkTicks: 70, // how long a townsperson stops and gestures after you click them
  homeQuietRange: 20, // at night they go indoors only once nobody is this close (nobody sees them vanish)
  missingChecks: 3, // a townsperson must be missing this many checks running before a new one is placed (entities load late)
  maxLineLength: 170,
};

// Words a townsperson must never say: the story reveals these, people in the street don't know them
// (lore reveal rules, LORE-BIBLE.md "Keeping it secret"). Checked by a self-test.
export const NEVER_SAID = ["hollow", "morvane", "oswin", "undertow", "edda", "truce", "corvin", "returned", "choir", "rift", "gate formed"];

export const townKey = (name) => name.toLowerCase().replace(/[^a-z]+/g, "_").replace(/^_|_$/g, "");
export const personTag = (town, i) => `siege_tf_${townKey(town)}_${i}`;
export const TOWN_TAG = "siege_townsfolk";

// The people who actually live in a town: one per street spot, in order
export function peopleOf(town) {
  const t = TOWNSFOLK[town];
  const spots = TOWNSFOLK_SPOTS[town] ?? [];
  if (!t) return [];
  return t.people.slice(0, spots.length).map((p, i) => ({ ...p, i, town, spot: spots[i], skin: skinIndex(t.region, p.skin) }));
}

// The texture index (entity property siege:skin) for a region's n-th skin
export function skinIndex(region, n) {
  const base = REGION_SKINS.indexOf(region);
  return Math.max(0, base) * 8 + (((n ?? 0) % 8) + 8) % 8;
}

// Which of their five lines a player hears on this click: they go through all five in order, then start again
export const lineNumber = (heard) => (Math.max(0, heard | 0)) % FOLK.linesEach;

// What appears in chat (same look as a settler's line in settle/settlers.js)
export const speech = (p, line, townName) => `§f${p.name} §7(${p.trade})§f: §7${line.replace(/\{town\}/g, townName)}`;

// Places to try standing a townsperson, nearest their spot first: [dx, dz] then dy from +3 down to -3
export const STAND_TRIES = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1], [2, 0], [-2, 0], [0, 2], [0, -2]];
export const DY_TRIES = [1, 0, 2, -1, 3, -2, -3];

// Can a person stand with feet in `feet`? below must hold them, feet and head must be open. Pure on block ids.
export function canStand(below, feet, head) {
  const open = (id) => id === "minecraft:air" || id === undefined || /short_grass|tall_grass|fern|flower|torch|carpet|snow_layer/.test(id ?? "");
  if (!below || below === "minecraft:air" || /water|lava|leaves|fence|wall|farmland|wheat|potatoes|carrots|beetroot/.test(below)) return false;
  return open(feet) && open(head);
}

export const towns = () => Object.keys(TOWNSFOLK);
