// Horses: the steed entity. Turns a saved record into a living horse and back again.

import { world, system } from "@minecraft/server";
import { DIMENSIONS, COLORS, DYE_RGB, keepOf, isOnline } from "../siege/api.js";
import { effectiveStats, hasTrait, hasPerk, SHOES } from "./data.js";
import { recordOf, saveRecord } from "./store.js";

export const STEED = "siege:steed";
export const UID = "siege:horses_uid";
const GEN = "siege:horses_gen";

const live = new Map(); // uid -> loaded entity
const shield = new Map(); // uid -> last damage-sensor state we set

export const valid = (e) => {
  try {
    return !!e && (typeof e.isValid === "function" ? e.isValid() : e.isValid);
  } catch {
    return false;
  }
};

export function entityOf(rec) {
  const e = live.get(rec.uid);
  if (valid(e)) return e;
  live.delete(rec.uid);
  return undefined;
}

export const uidOf = (entity) => {
  try {
    return entity.getDynamicProperty(UID);
  } catch {
    return undefined;
  }
};
export const recordOfEntity = (entity) => (entity?.typeId === STEED ? recordOf(uidOf(entity)) : undefined);

function fire(entity, event) {
  try {
    entity.triggerEvent(event);
  } catch (e) {
    console.warn(`[Horses] ${event}: ${e}`);
  }
}

function setProp(entity, id, value) {
  try {
    entity.setProperty(id, value);
  } catch (e) {
    console.warn(`[Horses] ${id}: ${e}`);
  }
}

const damageState = (rec) => (!isOnline(rec.owner) ? "protected"
  : hasTrait(rec, "surefooted") || rec.special === "hollow" ? "nofall" : "none");

// Makes the entity match its record: stats, size, traits, looks, name
export function applyRecord(entity, rec) {
  if (!valid(entity)) return;
  entity.setDynamicProperty(UID, rec.uid);
  entity.setDynamicProperty(GEN, rec.gen);
  const eff = effectiveStats(rec);
  fire(entity, `siege:speed_${eff.speed}`);
  fire(entity, `siege:jump_${eff.jump}`);
  fire(entity, `siege:health_${eff.health}`);
  fire(entity, rec.foal ? "siege:become_foal" : "siege:grow_up");
  fire(entity, rec.foal ? "siege:scale_foal" : rec.special === "warhorse" ? "siege:scale_war"
    : hasTrait(rec, "surefooted") ? "siege:scale_pony" : "siege:scale_normal");
  const fireproof = hasTrait(rec, "dunestrider") || SHOES[rec.shoes]?.fireproof || rec.special === "hollow";
  fire(entity, fireproof ? "siege:fireproof_on" : "siege:fireproof_off");
  fire(entity, hasTrait(rec, "tideborn") ? "siege:tideborn_on" : "siege:tideborn_off");
  fire(entity, hasPerk(rec, "fearless") ? "siege:calm" : "siege:skittish");
  const state = damageState(rec);
  fire(entity, `siege:ds_${state}`);
  shield.set(rec.uid, state);

  setProp(entity, "siege:coat", rec.coat);
  setProp(entity, "siege:mark", rec.mark);
  setProp(entity, "siege:breed", rec.prop ?? 0); // which painted coat it wears (0 = a common horse's own coat)
  setProp(entity, "siege:special", rec.special === "warhorse" ? 1 : rec.special === "hollow" ? 2 : 0);
  setProp(entity, "siege:cap", rec.caparison > 0);
  if (rec.caparison > 0) {
    const [r, g, b] = DYE_RGB[COLORS[rec.caparison - 1]] ?? [255, 255, 255];
    setProp(entity, "siege:cap_r", r / 255);
    setProp(entity, "siege:cap_g", g / 255);
    setProp(entity, "siege:cap_b", b / 255);
  }
  entity.nameTag = rec.name;
}

// The Caparison takes the owner's Keep Banner color (white if they have no keep yet). Stored as color + 1.
export function bannerColorOf(playerId) {
  const color = keepOf(playerId)?.color;
  return (typeof color === "number" && color >= 0 && color < 16 ? color : 0) + 1;
}

export function readGear(entity) {
  let saddle = false, armor = null;
  try {
    const box = entity.getComponent("minecraft:inventory")?.container;
    saddle = box?.getItem(0)?.typeId === "minecraft:saddle";
    armor = box?.getItem(1)?.typeId ?? null;
  } catch {
    // no container on this version: fall through
  }
  if (!saddle) {
    try {
      saddle = !!entity.getComponent("minecraft:is_saddled");
    } catch {
      // leave it
    }
  }
  return { saddle, armor };
}

function restoreGear(entity, rec) {
  try {
    if (rec.gearSaddle) entity.runCommand("replaceitem entity @s slot.saddle 0 saddle");
    if (rec.gearArmor) entity.runCommand(`replaceitem entity @s slot.armor 0 ${rec.gearArmor.replace("minecraft:", "")}`);
  } catch (e) {
    console.warn(`[Horses] gear: ${e}`);
  }
}

// Brings a record into the world as a living horse. Any older copy removes itself when it next loads.
export function spawnSteed(rec, dimension, location, rotationY) {
  const entity = dimension.spawnEntity(STEED, location);
  rec.gen = (rec.gen ?? 0) + 1;
  rec.status = "out";
  live.set(rec.uid, entity);
  applyRecord(entity, rec);
  if (rotationY !== undefined) {
    try {
      entity.setRotation({ x: 0, y: rotationY });
    } catch {
      // not important
    }
  }
  saveRecord(rec);
  // Again a moment later: the entity's own spawn event can land after ours, and the saddle needs the horse settled
  system.runTimeout(() => {
    if (!valid(entity)) return;
    applyRecord(entity, rec);
    restoreGear(entity, rec);
    try {
      const health = entity.getComponent("minecraft:health");
      health?.setCurrentValue(health.effectiveMax);
    } catch {
      // full health is a nicety
    }
  }, 5);
  return entity;
}

// Puts a living horse away: it leaves the world and its record waits in the stalls
export function stallSteed(rec, entity) {
  if (valid(entity)) {
    const gear = readGear(entity);
    rec.gearSaddle = gear.saddle;
    rec.gearArmor = gear.armor;
    entity.remove();
  }
  live.delete(rec.uid);
  rec.status = "stabled";
  rec.gen = (rec.gen ?? 0) + 1;
  saveRecord(rec);
}

// A fresh look at one horse after its record changed (training, gear, perks)
export function refresh(rec) {
  const entity = entityOf(rec);
  if (entity) applyRecord(entity, rec);
  saveRecord(rec);
}

// Every 2 seconds: find loaded steeds, clear out stale copies, grow foals, shield horses of offline owners
export function scanSteeds(onGrown) {
  const now = world.getAbsoluteTime();
  for (const dimId of DIMENSIONS) {
    let found;
    try {
      found = world.getDimension(dimId).getEntities({ type: STEED });
    } catch {
      continue;
    }
    for (const entity of found) {
      const uid = uidOf(entity);
      if (!uid) continue; // a wild or summoned steed nobody has haltered yet
      const rec = recordOf(uid);
      if (!rec) {
        entity.setDynamicProperty(UID, undefined); // its record is gone: it's a free horse again
        continue;
      }
      if (rec.status !== "out" || entity.getDynamicProperty(GEN) !== rec.gen) {
        entity.remove(); // an old copy: the real horse is in a stall, fallen, or was called elsewhere
        live.delete(uid);
        continue;
      }
      live.set(uid, entity);
      const at = entity.location;
      if (!rec.pos || rec.pos.dim !== dimId || Math.hypot(rec.pos.x - at.x, rec.pos.z - at.z) > 24) {
        rec.pos = { x: Math.floor(at.x), y: Math.floor(at.y), z: Math.floor(at.z), dim: dimId };
        saveRecord(rec);
      }
      if (rec.foal && now >= rec.grownAt) {
        rec.foal = false;
        applyRecord(entity, rec);
        saveRecord(rec);
        onGrown?.(rec, entity);
      }
      try {
        if (entity.getProperty("siege:breed") !== (rec.prop ?? 0)) setProp(entity, "siege:breed", rec.prop ?? 0); // horses from before the painted coats
      } catch { /* not loaded far enough yet */ }
      const state = damageState(rec);
      if (shield.get(uid) !== state) {
        fire(entity, `siege:ds_${state}`);
        shield.set(uid, state);
      }
      if (rec.special === "hollow") {
        try {
          entity.dimension.spawnParticle("minecraft:soul_particle", { x: at.x, y: at.y + 1, z: at.z });
        } catch {
          // particle name differs on this version
        }
      }
    }
  }
}
