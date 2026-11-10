// Horses: everything that happens in the saddle. Horse XP, gallop and stamina, terrain traits,
// Trample, the Warhorse Charge and the Hollow Steed's Undertow Step.

import { world, system, EntityDamageCause } from "@minecraft/server";
import { GUARD_TYPES, guardTag, isAlly, RAIDER_TAG } from "../siege/api.js";
import { HORSE_SETTINGS as S, TERRAIN, addXp, effectiveStats, gallopTicks, hasPerk, hasTrait, bar } from "./data.js";
import { recordOf, saveRecord } from "./store.js";
import { STEED, uidOf, valid } from "./steed.js";

const TICK = 5; // this file's loop runs every 5 ticks
const rides = new Map(); // horse uid -> { stamina, galloping, burstUntil, last, carry, hit: Map, rallyAt, stepAt, dirty }

export const mountOf = (player) => {
  try {
    const mount = player.getComponent("minecraft:riding")?.entityRidingOn;
    return mount?.typeId === STEED ? mount : undefined;
  } catch {
    return undefined;
  }
};

function rideOf(rec) {
  let ride = rides.get(rec.uid);
  if (!ride) {
    ride = { stamina: gallopTicks(effectiveStats(rec).stamina), galloping: false, burstUntil: 0, last: null, carry: 0, hit: new Map(), rallyAt: 0, stepAt: 0, dirty: false };
    rides.set(rec.uid, ride);
  }
  return ride;
}

export const isGalloping = (player) => {
  const mount = mountOf(player);
  return !!mount && !!rides.get(uidOf(mount))?.galloping;
};

function announceLevel(player, rec, gained) {
  player.onScreenDisplay.setTitle(`§6${rec.name} reached level ${rec.level}`, {
    subtitle: `§7+${gained.levels} training point${gained.levels === 1 ? "" : "s"}${gained.perks ? " · §e+1 perk point" : ""}§7 · spend them at your Stables`,
    fadeInDuration: 10, stayDuration: 60, fadeOutDuration: 20,
  });
  player.playSound("random.levelup");
}

export function giveXp(player, rec, amount) {
  const gained = addXp(rec, amount);
  rideOf(rec).dirty = true;
  if (gained.levels) {
    saveRecord(rec);
    announceLevel(player, rec, gained);
  }
}

function onTerrain(mount, rec) {
  const traits = rec.traits.filter((t) => TERRAIN[t]);
  if (!traits.length) return false;
  try {
    const at = mount.location;
    const feet = mount.dimension.getBlock({ x: Math.floor(at.x), y: Math.floor(at.y), z: Math.floor(at.z) });
    const ids = [feet?.typeId, feet?.below()?.typeId];
    return traits.some((t) => ids.some((id) => TERRAIN[t].includes(id)));
  } catch {
    return false;
  }
}

function knock(target, dir, strength, lift) {
  try {
    target.applyKnockback({ x: dir.x * strength, z: dir.z * strength }, lift);
  } catch {
    try {
      target.applyImpulse({ x: dir.x * strength * 0.5, y: lift, z: dir.z * strength * 0.5 });
    } catch {
      // some mobs can't be pushed
    }
  }
}

// Trample and the Warhorse Charge: run hostile mobs down while galloping
function runDown(player, mount, rec, ride) {
  const charge = rec.special === "warhorse";
  if (!charge && !hasPerk(rec, "trample")) return;
  const view = mount.getViewDirection();
  const flat = Math.hypot(view.x, view.z) || 1;
  const dir = { x: view.x / flat, z: view.z / flat };
  const at = mount.location;
  const ahead = { x: at.x + dir.x * 1.6, y: at.y + 0.5, z: at.z + dir.z * 1.6 };
  const now = system.currentTick;
  let struck = false;
  for (const target of mount.dimension.getEntities({ location: ahead, maxDistance: 2.4, families: ["monster"] })) {
    if ((ride.hit.get(target.id) ?? 0) > now) continue;
    ride.hit.set(target.id, now + 20);
    target.applyDamage(charge ? 7 : 4, { cause: EntityDamageCause.entityAttack, damagingEntity: player });
    knock(target, dir, charge ? 3 : 1.5, charge ? 0.6 : 0.35);
    struck = true;
  }
  if (ride.hit.size > 40) for (const [id, until] of ride.hit) if (until < now) ride.hit.delete(id);
  if (!struck) return;
  mount.dimension.playSound("mob.horse.angry", at);
  if (charge && now >= ride.rallyAt) {
    ride.rallyAt = now + 600;
    let rallied = 0;
    for (const type of Object.keys(GUARD_TYPES)) {
      for (const guard of mount.dimension.getEntities({ type, tags: [guardTag(rec.owner)], location: at, maxDistance: S.chargeRallyRange })) {
        guard.addEffect("speed", 200, { amplifier: 1, showParticles: false });
        guard.addEffect("strength", 200, { amplifier: 0, showParticles: false });
        rallied++;
      }
    }
    if (rallied) player.sendMessage(`§6${rec.name}'s charge rallies ${rallied} of your guards!`);
  }
}

function flush(rec, ride) {
  if (!ride.dirty) return;
  ride.dirty = false;
  saveRecord(rec);
}

export function ridingTick() {
  const ridden = new Set();
  for (const player of world.getPlayers()) {
    const mount = mountOf(player);
    if (!mount) continue;
    const rec = recordOf(uidOf(mount));
    if (!rec) continue;
    ridden.add(rec.uid);
    const ride = rideOf(rec);
    const eff = effectiveStats(rec);
    const maxStamina = gallopTicks(eff.stamina);
    const now = system.currentTick;
    rec.lastRidden = world.getAbsoluteTime();

    // Horse XP for distance, for the owner and their allies
    const at = mount.location;
    if (ride.last && (player.id === rec.owner || isAlly(rec.owner, player.id))) {
      const moved = Math.hypot(at.x - ride.last.x, at.z - ride.last.z);
      if (moved < 30) ride.carry += moved * (ride.galloping ? S.gallopXpMultiplier : 1);
      const xp = Math.floor(ride.carry / S.blocksPerXp);
      if (xp > 0) {
        ride.carry -= xp * S.blocksPerXp;
        giveXp(player, rec, xp);
      }
    }
    ride.last = { x: at.x, z: at.z };

    // Stamina
    if (ride.galloping) {
      ride.stamina -= TICK;
      if (ride.stamina <= 0) {
        ride.stamina = 0;
        ride.galloping = false;
        player.playSound("mob.horse.breathe");
      }
    } else {
      ride.stamina = Math.min(maxStamina, ride.stamina + TICK * (hasPerk(rec, "second_wind") ? 1 : 0.5));
    }

    // Speed: +1 step on home terrain, +2 galloping, +2 more during a Sprint Burst
    const steps = (onTerrain(mount, rec) ? 1 : 0) + (ride.galloping ? 2 : 0) + (ride.galloping && now < ride.burstUntil ? 2 : 0);
    if (steps > 0) mount.addEffect("speed", 12, { amplifier: steps - 1, showParticles: false });

    if (hasPerk(rec, "fearless")) {
      for (const effect of ["slowness", "weakness", "blindness"]) {
        try {
          mount.removeEffect(effect);
        } catch {
          // not affected
        }
      }
    }
    if (ride.galloping) runDown(player, mount, rec, ride);

    const state = ride.galloping ? " §6GALLOP" : ride.stamina < maxStamina * 0.2 ? " §cwinded" : "";
    player.onScreenDisplay.setActionBar(`§f${rec.name} §7Lv ${rec.level}  §7Stamina ${bar(ride.stamina, maxStamina, 20)}${state}`);
    if (now % 100 < TICK) flush(rec, ride);
  }

  // Horses nobody is riding any more: rest and save
  for (const [uid, ride] of rides) {
    if (ridden.has(uid)) continue;
    const rec = recordOf(uid);
    if (rec) flush(rec, ride);
    rides.delete(uid);
  }
}

// Riding Crop: start or stop a gallop
export function useCrop(player) {
  const mount = mountOf(player);
  const rec = mount && recordOf(uidOf(mount));
  if (!rec) return player.onScreenDisplay.setActionBar("§7Use the Riding Crop while riding your steed to gallop.");
  const ride = rideOf(rec);
  if (ride.galloping) {
    ride.galloping = false;
    return;
  }
  const maxStamina = gallopTicks(effectiveStats(rec).stamina);
  if (ride.stamina < maxStamina * 0.2) {
    return player.onScreenDisplay.setActionBar(`§c${rec.name} is winded. Give it a moment.`);
  }
  ride.galloping = true;
  if (hasPerk(rec, "sprint_burst")) ride.burstUntil = system.currentTick + 40;
  mount.dimension.playSound("mob.horse.gallop", mount.location);
}

const passable = (block) => {
  try {
    return !!block && (block.isAir || !block.isSolid);
  } catch {
    return false;
  }
};

// Hollow Steed: blink ahead with your rider, through walls. Returns true if it handled the whistle.
export function undertowStep(player) {
  const mount = mountOf(player);
  const rec = mount && recordOf(uidOf(mount));
  if (!rec || rec.special !== "hollow") return false;
  const ride = rideOf(rec);
  const now = system.currentTick;
  if (now < ride.stepAt) {
    player.onScreenDisplay.setActionBar(`§7The Undertow is still settling (${Math.ceil((ride.stepAt - now) / 20)}s).`);
    return true;
  }
  const view = player.getViewDirection();
  const flat = Math.hypot(view.x, view.z) || 1;
  const dir = { x: view.x / flat, z: view.z / flat };
  const from = mount.location;
  const dim = mount.dimension;
  for (let dist = S.stepDistance; dist >= 3; dist--) {
    for (const dy of [0, 1, -1, 2, -2, 3, -3]) {
      const spot = { x: Math.floor(from.x + dir.x * dist), y: Math.floor(from.y) + dy, z: Math.floor(from.z + dir.z * dist) };
      let feet;
      try {
        feet = dim.getBlock(spot);
      } catch {
        continue;
      }
      if (!feet || !passable(feet) || !passable(feet.above()) || passable(feet.below())) continue;
      try {
        dim.spawnParticle("minecraft:soul_particle", { x: from.x, y: from.y + 1, z: from.z });
      } catch {
        // particle name differs on this version
      }
      mount.teleport({ x: spot.x + 0.5, y: spot.y, z: spot.z + 0.5 }, { dimension: dim });
      dim.playSound("mob.endermen.portal", { x: spot.x, y: spot.y, z: spot.z });
      ride.stepAt = now + S.stepCooldownTicks;
      ride.last = null; // the blink doesn't count as distance ridden
      return true;
    }
  }
  player.onScreenDisplay.setActionBar("§7There is nowhere to step to that way.");
  return true;
}

// Killing a raider from the saddle is worth horse XP
world.afterEvents.entityDie.subscribe((event) => {
  const killer = event.damageSource?.damagingEntity;
  if (killer?.typeId !== "minecraft:player" || !valid(event.deadEntity)) return;
  let raider = false;
  try {
    raider = event.deadEntity.hasTag(RAIDER_TAG);
  } catch {
    return;
  }
  if (!raider) return;
  const mount = mountOf(killer);
  const rec = mount && recordOf(uidOf(mount));
  if (rec) giveXp(killer, rec, S.raiderKillXp);
});
