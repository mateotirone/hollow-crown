// Horses: saved records. Each horse is its own world dynamic property ("siege:horses_r_<uid>"),
// so the roster can grow without hitting the 32 KB limit of one property.
//
// Every record is stamped with a version (rec._v) so old worlds can be upgraded. When the SHAPE of a
// record changes (a field is renamed or restructured), raise RECORD_VERSION and add a step to
// upgradeRecord. Adding a new field needs no bump: give it a default in RECORD_DEFAULTS instead.

import { world } from "@minecraft/server";
import { moduleStore, isAlly } from "../siege/api.js";
import { isTesting } from "../core/tests.js";
import { rosterCap, countsToRoster } from "./data.js";

const PREFIX = "siege:horses_r_";
export const RECORD_VERSION = 1;
const META_VERSION = 1;

// Fields added after the first release, with the value an older record should get.
const RECORD_DEFAULTS = {};

// Shape changes: UPGRADES[1] takes a record from version 1 to 2, and so on.
const UPGRADES = {};

// Bring one saved record up to the current version. Pure, so it can be tested anywhere.
// Records saved before versioning have no _v and count as version 1.
export function upgradeRecord(rec, version = RECORD_VERSION, defaults = RECORD_DEFAULTS, steps = UPGRADES) {
  const from = rec._v ?? 1;
  for (let v = from; v < version; v++) steps[v]?.(rec);
  if (from > version) console.warn(`[Hollow Crown] horse ${rec.uid} was saved by a newer version of the pack (v${from}, this pack reads v${version}).`);
  for (const [key, value] of Object.entries(defaults)) if (rec[key] === undefined) rec[key] = copyOf(value);
  rec._v = Math.max(from, version);
  return rec;
}
const copyOf = (value) => (value && typeof value === "object" ? JSON.parse(JSON.stringify(value)) : value);

let records; // uid -> record (live objects; call saveRecord after changing one)

function load() {
  if (records) return records;
  records = new Map();
  for (const id of world.getDynamicPropertyIds()) {
    if (!id.startsWith(PREFIX)) continue;
    try {
      const rec = JSON.parse(world.getDynamicProperty(id));
      if (rec?.uid) records.set(rec.uid, upgradeRecord(rec));
    } catch (e) {
      console.warn(`[Horses] bad record ${id}: ${e}`);
    }
  }
  return records;
}

export const allRecords = () => [...load().values()];
export const recordOf = (uid) => (uid ? load().get(uid) : undefined);
export const horsesOf = (owner) => allRecords().filter((r) => r.owner === owner);

export function saveRecord(rec) {
  rec._v ??= RECORD_VERSION;
  load().set(rec.uid, rec);
  if (!isTesting()) world.setDynamicProperty(PREFIX + rec.uid, JSON.stringify(rec));
}

export function deleteRecord(uid) {
  load().delete(uid);
  if (!isTesting()) world.setDynamicProperty(PREFIX + uid, undefined);
}

export const newUid = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

// stables: settlement owner id -> Stables level. posts: "x,y,z" -> breed key. bought: "x,y,z|playerId" -> time.
export const meta = moduleStore("siege:horses_meta", () => ({ stables: {}, posts: {}, bought: {} }), { version: META_VERSION });

// The best Stables this player can use: their own settlement's, or an ally's
export function stablesLevelFor(playerId) {
  let best = meta.data.stables[playerId] ?? 0;
  for (const [owner, level] of Object.entries(meta.data.stables)) {
    if (level > best && isAlly(owner, playerId)) best = level;
  }
  return best;
}

// Horses that take a stall (a starter cob doesn't)
export const stalledOf = (owner) => horsesOf(owner).filter(countsToRoster);
export const rosterRoom = (playerId, level = stablesLevelFor(playerId)) => rosterCap(level) - stalledOf(playerId).length;
