// Horses: saved records. Each horse is its own world dynamic property ("siege:horses_r_<uid>"),
// so the roster can grow without hitting the 32 KB limit of one property.

import { world } from "@minecraft/server";
import { moduleStore, isAlly } from "../siege/api.js";
import { isTesting } from "../core/tests.js";
import { rosterCap } from "./data.js";

const PREFIX = "siege:horses_r_";
let records; // uid -> record (live objects; call saveRecord after changing one)

function load() {
  if (records) return records;
  records = new Map();
  for (const id of world.getDynamicPropertyIds()) {
    if (!id.startsWith(PREFIX)) continue;
    try {
      const rec = JSON.parse(world.getDynamicProperty(id));
      if (rec?.uid) records.set(rec.uid, rec);
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
  load().set(rec.uid, rec);
  if (!isTesting()) world.setDynamicProperty(PREFIX + rec.uid, JSON.stringify(rec));
}

export function deleteRecord(uid) {
  load().delete(uid);
  if (!isTesting()) world.setDynamicProperty(PREFIX + uid, undefined);
}

export const newUid = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

// stables: settlement owner id -> Stables level. posts: "x,y,z" -> breed key. bought: "x,y,z|playerId" -> time.
export const meta = moduleStore("siege:horses_meta", () => ({ stables: {}, posts: {}, bought: {} }));

// The best Stables this player can use: their own settlement's, or an ally's
export function stablesLevelFor(playerId) {
  let best = meta.data.stables[playerId] ?? 0;
  for (const [owner, level] of Object.entries(meta.data.stables)) {
    if (level > best && isAlly(owner, playerId)) best = level;
  }
  return best;
}

export const rosterRoom = (playerId, level = stablesLevelFor(playerId)) => rosterCap(level) - horsesOf(playerId).length;
