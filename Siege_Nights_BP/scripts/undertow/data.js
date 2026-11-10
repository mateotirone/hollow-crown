// Small saved-data helpers. All of the Hollow's world data lives in world dynamic properties starting
// "hc:" (one per subject: hc:rift, hc:undertow_progress, hc:hollow_warden, ...). Always save through
// here, never straight to the world.
//
// Saved data is versioned so worlds survive updates. One number, hc:undertow_version, covers every
// "hc:" property. When you change the SHAPE of anything saved (rename a property, rename or
// restructure a field), raise DATA_VERSION and add a step to UPGRADES that brings old data forward.
// Adding a new field that has a default needs no bump.
import { world } from "@minecraft/server";

export const DATA_VERSION = 1;
const K_VERSION = "hc:undertow_version";

// { to: 2, run() { ...read the old properties, write the new ones (use readRaw/writeRaw below)... } }
// Steps run once per old world, in order, the first time anything is loaded or saved.
const UPGRADES = [];

// Which steps an old world needs. Pure, so the self-test can check it.
export function upgradeSteps(from, to = DATA_VERSION, steps = UPGRADES) {
  return steps.filter((s) => s.to > from && s.to <= to).sort((a, b) => a.to - b.to);
}

export const readRaw = (key) => world.getDynamicProperty(key);
export const writeRaw = (key, value) => world.setDynamicProperty(key, value);

let current = false;
function bringUpToDate() {
  if (current) return;
  let from;
  try { from = readRaw(K_VERSION); } catch { return; } // the world is not ready yet: try again next time
  current = true;
  if (from === undefined) return; // a world with no stamp yet is at version 1, the first shape
  if (from > DATA_VERSION) return void console.warn(`[Hollow Crown] The Hollow's data was saved by a newer version of the pack (v${from}, this pack reads v${DATA_VERSION}).`);
  for (const step of upgradeSteps(from)) step.run();
  if (from < DATA_VERSION) writeRaw(K_VERSION, DATA_VERSION);
}
let stamped = false;
function stamp() {
  if (stamped) return;
  stamped = true;
  if ((readRaw(K_VERSION) ?? 0) < DATA_VERSION) writeRaw(K_VERSION, DATA_VERSION);
}

export function load(key, fallback) {
  try {
    bringUpToDate();
    const raw = readRaw(key);
    return raw === undefined ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  bringUpToDate();
  stamp();
  writeRaw(key, JSON.stringify(value));
}

// For the few values saved as plain text or numbers instead of JSON.
export function loadPlain(key) {
  try { bringUpToDate(); return readRaw(key); } catch { return undefined; }
}
export function savePlain(key, value) {
  bringUpToDate();
  stamp();
  writeRaw(key, value);
}

// Facing names -> unit vectors (x, z). "facing" is the way the wall's face points, toward the player.
export const FACING = {
  north: [0, -1],
  south: [0, 1],
  east: [1, 0],
  west: [-1, 0],
};

export function say(player, text) {
  try {
    player.sendMessage(text);
  } catch {}
}

export function runCmd(dim, cmd) {
  try {
    return dim.runCommand(cmd);
  } catch {
    return undefined;
  }
}
