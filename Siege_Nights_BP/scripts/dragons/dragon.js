// Dragons: saved records (one per player) and the living entity that matches a record.

import { world, system, GameMode } from "@minecraft/server";
import { moduleStore, isOnline, isAlly, keepOf, emit } from "../siege/api.js";
import { mapMode, plotOf, allPlots, holderOf } from "../plots/claims.js";
import { DRAGON_SETTINGS as S, DRAGON, STAGES, earnedStage, groundStep, airStep, healthStep, newMind } from "./data.js";

// dragons: owner id -> record. nests: "x,y,z" -> time the next egg is ready. mourning: owner id -> time they may take an egg again.
export const store = moduleStore("siege:dragons", () => ({ dragons: {}, nests: {}, mourning: {} }));
export const dragonOf = (playerId) => store.data.dragons[playerId];
export const save = () => store.save();

const OWNER = "siege:dragons_owner";
const GEN = "siege:dragons_gen";
const live = new Map(); // owner id -> loaded entity

export const valid = (e) => {
  try {
    return !!e && e.isValid;
  } catch {
    return false;
  }
};
export const ownerIdOf = (entity) => {
  try {
    return entity.getDynamicProperty(OWNER);
  } catch {
    return undefined;
  }
};
export const recordOfEntity = (entity) => (entity?.typeId === DRAGON ? dragonOf(ownerIdOf(entity)) : undefined);
export function entityOf(rec) {
  const e = live.get(rec.owner);
  if (valid(e)) return e;
  live.delete(rec.owner);
  return undefined;
}

export const isBuilder = (player) => {
  try {
    return player.getGameMode() === GameMode.Creative;
  } catch {
    return false;
  }
};

// Dragons are the home region's power: you can raise and fly one if your plot (or an ally's plot) is there.
// Before the map has plots (a test world), and for builders in Creative, everyone counts.
export function canHarness(player) {
  try {
    if (isBuilder(player) || !mapMode()) return true;
    if (plotOf(player.id)?.region === S.homeRegion) return true;
    return allPlots().some((p) => p.region === S.homeRegion && holderOf(p) && isAlly(holderOf(p), player.id));
  } catch {
    return true;
  }
}

function fire(entity, event) {
  try {
    entity.triggerEvent(event);
  } catch (e) {
    console.warn(`[Hollow Crown] dragon ${event}: ${e}`);
  }
}
function setProp(entity, id, value) {
  try {
    entity.setProperty(id, value);
  } catch (e) {
    console.warn(`[Hollow Crown] dragon ${id}: ${e}`);
  }
}

export { fire, setProp };
export function setFlying(entity, rec, flying) {
  fire(entity, flying ? `siege:to_air_${airStep(rec)}` : `siege:to_ground_${groundStep(rec)}`);
}
export const isFlying = (entity) => {
  try {
    return !!entity.getProperty("siege:flying");
  } catch {
    return false;
  }
};

// Makes the entity match its record: size, health, speed, saddle, orders, colour, name
export function applyRecord(entity, rec, { keepMode = false } = {}) {
  if (!valid(entity)) return;
  rec.mind ??= newMind();
  setProp(entity, "siege:species", rec.species ?? 0);
  if (rec.down) {
    // unconscious: it just lies there until it is tended, finished off, or bleeds out
    entity.setDynamicProperty(OWNER, rec.owner);
    entity.setDynamicProperty(GEN, rec.gen);
    fire(entity, "siege:go_down");
    setProp(entity, "siege:pose", 2);
    entity.nameTag = rec.name;
    return;
  }
  entity.setDynamicProperty(OWNER, rec.owner);
  entity.setDynamicProperty(GEN, rec.gen);
  fire(entity, `siege:stage_${STAGES.includes(rec.stage) ? rec.stage : "hatchling"}`);
  if (entity.getDynamicProperty("siege:dragons_hs") !== healthStep(rec)) {
    // only when it changes: swapping the health group refills its health
    entity.setDynamicProperty("siege:dragons_hs", healthStep(rec));
    fire(entity, `siege:health_${healthStep(rec)}`);
  }
  setFlying(entity, rec, keepMode && isFlying(entity));
  fire(entity, rec.saddled && rec.stage !== "hatchling" ? "siege:saddle_on" : "siege:saddle_off");
  fire(entity, rec.order === "stay" ? "siege:order_stay" : "siege:order_follow");
  fire(entity, isOnline(rec.owner) ? "siege:ds_normal" : "siege:ds_protected");
  if (!rec.asleep) setProp(entity, "siege:pose", 0);
  entity.nameTag = rec.name;
  try {
    const owner = world.getPlayers().find((p) => p.id === rec.owner);
    const tame = entity.getComponent("minecraft:tameable");
    if (owner && tame && tame.tamedToPlayerId !== owner.id) tame.tame(owner); // so it follows its owner
  } catch {
    // following is a nicety
  }
}

// Brings the record into the world. Any older copy removes itself at the next scan.
export function spawnDragon(rec, dimension, location) {
  const entity = dimension.spawnEntity(DRAGON, location);
  rec.gen = (rec.gen ?? 0) + 1;
  rec.status = "out";
  live.set(rec.owner, entity);
  applyRecord(entity, rec);
  save();
  system.runTimeout(() => {
    if (!valid(entity)) return;
    applyRecord(entity, rec); // again once the entity's own spawn event has run
    try {
      const health = entity.getComponent("minecraft:health");
      health?.setCurrentValue(health.effectiveMax);
    } catch {
      // full health is a nicety
    }
  }, 5);
  return entity;
}

// Sends it home: the entity leaves the world and waits at its Roost
export function roostDragon(rec, status = "roosted") {
  const entity = entityOf(rec);
  if (entity) entity.remove();
  live.delete(rec.owner);
  rec.status = status;
  rec.gen = (rec.gen ?? 0) + 1;
  save();
}

export function refresh(rec) {
  const entity = entityOf(rec);
  if (entity) applyRecord(entity, rec, { keepMode: true });
  // Other features hear once when a bond fills (the role trials give the rider a gift for it)
  if (rec.bond >= 100 && !rec.bondFullSent) {
    rec.bondFullSent = true;
    try { emit("dragonBondFull", { owner: rec.owner, name: rec.name }); } catch { /* nobody listening */ }
  }
  save();
}

// Every 2 seconds: find loaded dragons, clear stale copies, grow the young, shield dragons of offline owners.
// Dragons can't exist outside the Overworld: one found elsewhere goes back to its Roost.
export function scanDragons(onGrown) {
  const now = world.getAbsoluteTime();
  for (const dimId of ["minecraft:overworld", "minecraft:nether", "minecraft:the_end", "siege:undertow"]) {
    let found;
    try {
      found = world.getDimension(dimId).getEntities({ type: DRAGON });
    } catch {
      continue;
    }
    for (const entity of found) {
      const owner = ownerIdOf(entity);
      if (!owner) continue; // a display dragon (showcase) or one summoned by command
      const rec = dragonOf(owner);
      if (!rec || rec.status !== "out" || entity.getDynamicProperty(GEN) !== rec.gen) {
        entity.remove();
        continue;
      }
      if (dimId !== "minecraft:overworld") {
        roostDragon(rec);
        world.getPlayers().find((p) => p.id === owner)?.sendMessage(`§7${rec.name} would not stay here. It has gone back to its Roost.`);
        continue;
      }
      live.set(owner, entity);
      if (rec.down) continue;
      const stage = earnedStage(rec, now);
      if (stage !== rec.stage) {
        rec.stage = stage;
        applyRecord(entity, rec, { keepMode: true });
        save();
        onGrown?.(rec, entity);
      }
      const shield = isOnline(rec.owner) ? "siege:ds_normal" : "siege:ds_protected";
      if (entity.getDynamicProperty("siege:dragons_ds") !== shield) {
        entity.setDynamicProperty("siege:dragons_ds", shield);
        fire(entity, shield);
      }
    }
  }
}

export const roostName = (rec) => keepOf(rec.owner)?.name ?? "its Roost";
