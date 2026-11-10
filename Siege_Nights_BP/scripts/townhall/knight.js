// The Knight path: techniques of the Blade branch.

import { world, system, EquipmentSlot, EntityDamageCause } from "@minecraft/server";
import * as api from "../siege/api.js";
import { heroOf } from "./hero.js";
import { recover, guardsNear } from "./progress.js";
import { OATH_BANNER } from "./tree.js";

const isKnight = (player) => player?.typeId === "minecraft:player" && heroOf(player).path === "knight";
const rank = (player, id) => heroOf(player).skills[id] ?? 0;
const fx = (entity, effect, ticks, amplifier = 0) => {
  try {
    entity.addEffect(effect, ticks, { amplifier, showParticles: false });
  } catch {
    // gone
  }
};

// ---------- cooldowns ----------
const cooldowns = new Map(); // "playerId:skill" -> tick it is ready
const quick = (player) => (rank(player, "blade_champion") ? 0.7 : 1);
function ready(player, key, ticks, quiet = true) {
  const k = `${player.id}:${key}`;
  const wait = (cooldowns.get(k) ?? 0) - system.currentTick;
  if (wait > 0) {
    if (!quiet) player.onScreenDisplay.setActionBar(`§7Ready in ${Math.ceil(wait / 20)}s`);
    return false;
  }
  cooldowns.set(k, system.currentTick + Math.round(ticks * quick(player)));
  return true;
}

const hasShield = (player) => player.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Offhand)?.typeId === "minecraft:shield";
const isBoss = (entity) => {
  try {
    return entity.hasTag("siege_boss") || entity.hasTag(api.WARLORD_TAG) || (entity.getComponent("minecraft:health")?.effectiveMax ?? 0) >= 150;
  } catch {
    return false;
  }
};
const friendly = (player, entity) =>
  entity.id === player.id || entity.typeId === "minecraft:player" || api.isGuard(entity) || entity.typeId === api.KEEP_HEART || /villager|golem|horse|wolf|cat|quartermaster|item|xp_orb|arrow/.test(entity.typeId);

function push(from, target, strength, up = 0.3) {
  const dx = target.location.x - from.location.x, dz = target.location.z - from.location.z;
  const d = Math.hypot(dx, dz) || 1;
  try {
    target.applyKnockback({ x: (dx / d) * strength, z: (dz / d) * strength }, up);
  } catch {
    // can't be pushed
  }
}

let striking = false; // true while a technique deals its own damage, so it can't trigger itself

function bonusDamage(player, target, amount) {
  striking = true;
  try {
    target.applyDamage(amount, { cause: EntityDamageCause.entityAttack, damagingEntity: player });
  } catch {
    // target died first
  } finally {
    striking = false;
  }
}

// ---------- on-hit techniques ----------
world.afterEvents.entityHitEntity.subscribe((event) => {
  const player = event.damagingEntity;
  const target = event.hitEntity;
  if (striking || !isKnight(player) || !target?.isValid || friendly(player, target)) return;
  const s = heroOf(player).skills;

  if (s.blade_bash && player.isSneaking && hasShield(player) && ready(player, "bash", [0, 120, 100, 80][s.blade_bash])) {
    push(player, target, 2.2, 0.35);
    fx(target, "slowness", 20 * (1 + s.blade_bash), 3);
    player.dimension.playSound("item.shield.block", player.location, { pitch: 0.7 });
    player.onScreenDisplay.setActionBar("§6Shield Bash");
  } else if (s.blade_lunge && player.isSprinting && ready(player, "lunge", 100)) {
    const view = player.getViewDirection();
    const flat = Math.hypot(view.x, view.z) || 1;
    try {
      player.applyKnockback({ x: (view.x / flat) * 1.6, z: (view.z / flat) * 1.6 }, 0.1);
    } catch {
      // older game
    }
    bonusDamage(player, target, 1 + s.blade_lunge);
    player.onScreenDisplay.setActionBar("§6Lunge");
  }

  const health = target.isValid ? target.getComponent("minecraft:health") : undefined;
  if (s.blade_execution && health && health.currentValue > 0 && health.currentValue < health.effectiveMax * 0.2) {
    bonusDamage(player, target, isBoss(target) ? 4 : 8);
    player.dimension.playSound("random.anvil_land", target.location, { volume: 0.5, pitch: 1.5 });
  }

  if (s.blade_crownbreaker && Math.random() < 0.15 && target.isValid) {
    const at = target.location;
    player.dimension.playSound("block.bell.hit", at, { volume: 2, pitch: 0.6 });
    try {
      player.dimension.spawnParticle("minecraft:critical_hit_emitter", { x: at.x, y: at.y + 1, z: at.z });
    } catch {
      // optional
    }
    for (const e of player.dimension.getEntities({ location: at, maxDistance: 3 })) if (!friendly(player, e)) bonusDamage(player, e, 6);
  }
});

// ---------- when you are hit ----------
const ARMOR_OK = /^minecraft:(iron|diamond|netherite)_|^siege:guard_/;
const ARMOR_SLOTS = [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet];

world.afterEvents.entityHurt.subscribe((event) => {
  const player = event.hurtEntity;
  if (!isKnight(player) || !player.isValid) return;
  const s = heroOf(player).skills;
  const attacker = event.damageSource.damagingEntity;

  if (s.blade_riposte && attacker?.isValid && attacker.id !== player.id && event.damageSource.cause === EntityDamageCause.entityAttack
    && player.isSneaking && hasShield(player) && ready(player, "riposte", 40)) {
    bonusDamage(player, attacker, s.blade_riposte === 2 ? 5 : 3);
    fx(player, "strength", 60, 0);
    player.onScreenDisplay.setActionBar("§6Riposte");
  }

  if (s.blade_mastery) {
    const gear = player.getComponent("minecraft:equippable");
    if (gear && ARMOR_SLOTS.every((slot) => ARMOR_OK.test(gear.getEquipment(slot)?.typeId ?? ""))) recover(player, event.damage, 0.05 + 0.05 * s.blade_mastery);
  }

  const health = player.getComponent("minecraft:health");
  if (s.blade_secondwind && health && health.currentValue > 0 && health.currentValue < 4 && ready(player, "secondwind", 6000 / quick(player))) {
    health.setCurrentValue(Math.min(health.effectiveMax, 12));
    fx(player, "resistance", 80, 1);
    player.playSound("random.totem", { volume: 0.6 });
    api.title(player, "§6Second Wind", "§7Not today");
  }
});

// ---------- the Oath Banner: Rallying Cry (use) and Banner of the Keep (sneak + use) ----------
const banners = new Map(); // player id -> { dim, at, until, rank }

world.afterEvents.itemUse.subscribe((event) => {
  const player = event.source;
  if (event.itemStack?.typeId !== OATH_BANNER) return;
  if (!isKnight(player)) return player.onScreenDisplay.setActionBar("§7The banner hangs limp. It answers only to the Oathsworn.");
  const s = heroOf(player).skills;

  if (player.isSneaking) {
    if (!s.blade_banner) return player.onScreenDisplay.setActionBar("§7Learn Banner of the Keep at the Tree of Oaths to plant this.");
    if (!ready(player, "banner", 1800, false)) return;
    banners.set(player.id, { dim: player.dimension.id, at: { ...player.location }, until: system.currentTick + (s.blade_banner === 2 ? 600 : 400) });
    player.dimension.playSound("raid.horn", player.location, { volume: 4 });
    return api.title(player, "§6Banner planted", "§7Hold this ground");
  }

  if (!s.blade_rally) return player.onScreenDisplay.setActionBar("§7Learn Rallying Cry at the Tree of Oaths to use this.");
  if (!ready(player, "rally", 900, false)) return;
  const heal = 2 + 2 * s.blade_rally;
  const mine = api.settlementAt(player.location);
  for (const e of player.dimension.getEntities({ location: player.location, maxDistance: 10 })) {
    const ally = e.id === player.id || (api.isGuard(e) && api.guardOwner(e) === player.id)
      || (e.typeId === "minecraft:player" && (api.isAlly(player.id, e.id) || api.isAlly(e.id, player.id) || (mine && mine === e.id)));
    if (!ally) continue;
    const health = e.getComponent("minecraft:health");
    if (health) health.setCurrentValue(Math.min(health.effectiveMax, health.currentValue + heal));
    fx(e, "strength", 160, 0);
    if (s.blade_champion && api.isGuard(e)) fx(e, "speed", 160, 1);
  }
  player.dimension.playSound("raid.horn", player.location, { volume: 4, pitch: 1.3 });
  player.onScreenDisplay.setActionBar("§6Rallying Cry!");
});

// ---------- every second ----------
const trampled = new Map(); // entity id -> tick

export function knightTick() {
  const now = system.currentTick;
  for (const player of world.getPlayers()) {
    if (!isKnight(player)) continue;
    const s = heroOf(player).skills;

    if (s.blade_constitution) {
      const have = player.getEffect("health_boost");
      if (!have || have.amplifier !== s.blade_constitution - 1 || have.duration < 200) fx(player, "health_boost", 72000, s.blade_constitution - 1);
    }
    if (s.blade_champion) fx(player, "strength", 60, 0);
    if (s.blade_captain) for (const g of guardsNear(player, 16)) { fx(g, "strength", 60, 0); if (s.blade_captain > 1) fx(g, "resistance", 60, 0); }

    const b = banners.get(player.id);
    if (b) {
      if (now > b.until) banners.delete(player.id);
      else {
        const dim = world.getDimension(b.dim);
        for (let h = 0; h < 5; h++) {
          try {
            dim.spawnParticle("minecraft:villager_happy", { x: b.at.x, y: b.at.y + h, z: b.at.z });
          } catch {
            break;
          }
        }
        for (const e of dim.getEntities({ location: b.at, maxDistance: 10 })) {
          if (e.typeId === "minecraft:player" || api.isGuard(e)) { fx(e, "strength", 60, 0); fx(e, "resistance", 60, 0); } else if (!friendly(player, e)) fx(e, "weakness", 60, 0);
        }
      }
    }
  }
}

// Warhorse Charge: checked 4 times a second while riding
export function chargeTick() {
  const now = system.currentTick;
  for (const player of world.getPlayers()) {
    if (!isKnight(player)) continue;
    const r = rank(player, "blade_charge");
    const horse = r ? player.getComponent("minecraft:riding")?.entityRidingOn : undefined;
    if (!horse || !/horse|donkey|mule|camel/.test(horse.typeId)) continue;
    const v = horse.getVelocity();
    if (Math.hypot(v.x, v.z) < 0.22) continue;
    for (const e of horse.dimension.getEntities({ location: horse.location, maxDistance: 2.2 })) {
      if (e.id === horse.id || friendly(player, e) || !e.getComponent("minecraft:health")) continue;
      if (now - (trampled.get(e.id) ?? -99) < 40) continue;
      trampled.set(e.id, now);
      bonusDamage(player, e, r === 2 ? 7 : 4);
      push(horse, e, 2.5, 0.5);
      horse.dimension.playSound("mob.horse.gallop", horse.location, { volume: 2 });
    }
  }
  if (trampled.size > 200) trampled.clear();
}
