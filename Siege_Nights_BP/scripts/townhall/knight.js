// The Knight path: techniques of the Blade branch.
//
// Knight pass (Mateo 2026-11-14, "fix the whats weak stuff", preview: the Knight pages of the Ember Spellbook): every
// technique has its own move, particles and sound (townhall/knight_fx.js, tools/build_knight_fx.py). Lunge now closes
// the gap first (sprint + jump at an enemy within 5 blocks) and strikes at the end of the dash. The Banner of the Keep
// is a 10-block war banner in your settlement's colour, with its reach drawn on the ground. No raid horn anywhere: that
// is the siege horn.

import { world, system, EquipmentSlot, EntityDamageCause, InputButton, ButtonState } from "@minecraft/server";
import * as api from "../siege/api.js";
import { heroOf } from "./hero.js";
import { recover, guardsNear } from "./progress.js";
import { OATH_BANNER } from "./tree.js";
import { sfx } from "../core/sfx.js";
import { addTests, assertEqual } from "../core/tests.js";
import { puff, yawToward } from "./marked_fx.js";
import { knightMove, facing, grit, goldRing, shieldSpot, swordSpot, plantBanner, strikeBanner, dropGreatsword } from "./knight_fx.js";

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

/** Run `fn` every `every` ticks, `times` times (for effects that linger: a glow, settling grit). */
function linger(every, times, fn) {
  let n = 0;
  const id = system.runInterval(() => {
    try {
      if (n++ >= times || fn(n) === false) system.clearRun(id);
    } catch {
      system.clearRun(id);
    }
  }, every);
}

const centre = (e, up = 1) => ({ x: e.location.x, y: e.location.y + up, z: e.location.z });

// A Lunge strikes with your weapon, not a punch: roughly what the weapon in hand deals. Pure, for the self-tests.
const WEAPON_DAMAGE = [[/netherite_(sword|axe)/, 8], [/diamond_(sword|axe)/, 7], [/iron_(sword|axe)/, 6], [/stone_(sword|axe)/, 5],
  [/(wooden|golden)_(sword|axe)/, 4], [/^siege:.*(sword|axe|hammer|spear|blade|mace)/, 6]];
export const weaponDamage = (typeId) => (typeId ? WEAPON_DAMAGE.find(([re]) => re.test(typeId))?.[1] ?? 1 : 1);

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

  const dim = player.dimension;

  // Shield Bash: the shield punches forward, grit off its face, and the slow shows as grit settling on the creature
  if (s.blade_bash && player.isSneaking && hasShield(player) && ready(player, "bash", [0, 120, 100, 80][s.blade_bash])) {
    knightMove(player, "bash");
    grit(dim, shieldSpot(player), facing(player));
    push(player, target, 2.2, 0.35);
    const slow = 20 * (1 + s.blade_bash);
    fx(target, "slowness", slow, 3);
    linger(12, Math.floor(slow / 12), () => (target.isValid ? puff(target.dimension, "siege:kn_settle", target.location) : false));
    sfx(dim, "kn.bash", player.location);
    player.onScreenDisplay.setActionBar("§6Shield Bash");
  }

  // Execution: the hit becomes an overhead chop, sparks fly and the view dips
  const health = target.isValid ? target.getComponent("minecraft:health") : undefined;
  if (s.blade_execution && health && health.currentValue > 0 && health.currentValue < health.effectiveMax * 0.2) {
    knightMove(player, "chop");
    bonusDamage(player, target, isBoss(target) ? 4 : 8);
    if (target.isValid) {
      puff(dim, "siege:kn_parry", centre(target));
      puff(dim, "siege:kn_parry", centre(target, 1.3));
      grit(dim, centre(target, 0.3), facing(player));
    }
    try {
      player.runCommand("camerashake add @s 0.2 0.15 positional");
    } catch {
      // cosmetic
    }
    sfx(dim, "kn.execute", target.location);
  }

  // Crownbreaker: a ghostly greatsword falls point first onto the creature, and strikes all within 3 blocks
  if (s.blade_crownbreaker && Math.random() < 0.15 && target.isValid) {
    const at = { ...target.location };
    sfx(dim, "block.bell.hit", at, { volume: 1.5, pitch: 0.6 }); // the call; the landing has its own sound
    dropGreatsword(dim, at, yawToward(player.location, at), () => {
      for (const e of dim.getEntities({ location: at, maxDistance: 3 })) if (!friendly(player, e) && e.getComponent("minecraft:health")) bonusDamage(player, e, 6);
    });
  }
});

// ---------- Lunge: sprint and jump at an enemy within 5 blocks in front: the dash first, then the thrust ----------
const LUNGE_REACH = 5;
const lunging = new Set(); // player ids mid-dash

function lungeTarget(player) {
  try {
    for (const hit of player.getEntitiesFromViewDirection({ maxDistance: LUNGE_REACH })) {
      const e = hit.entity;
      if (e?.isValid && !friendly(player, e) && e.getComponent("minecraft:health")) return { e, d: hit.distance };
    }
  } catch {
    // older engine
  }
  return undefined;
}

function lunge(player) {
  const r = rank(player, "blade_lunge");
  if (!r || lunging.has(player.id) || player.getComponent("minecraft:riding")) return;
  const found = lungeTarget(player);
  if (!found || !ready(player, "lunge", 100)) return;
  const { e: target } = found;
  const f = facing(player);
  lunging.add(player.id);
  knightMove(player, "thrust"); // a short crouch, then the arm drives forward as you arrive
  sfx(player.dimension, "kn.lunge", player.location);
  system.runTimeout(() => {
    try {
      player.applyKnockback({ x: f.x * Math.min(2.4, 0.55 * found.d), z: f.z * Math.min(2.4, 0.55 * found.d) }, 0.12);
    } catch {
      // older game
    }
  }, 2);
  let t = 0;
  linger(1, 12, () => {
    t++;
    if (!player.isValid || !target.isValid) return lunging.delete(player.id) && false;
    if (t >= 2 && t <= 6) grit(player.dimension, player.location, { x: -f.x, z: -f.z }); // grit off your heels
    const d = Math.hypot(target.location.x - player.location.x, target.location.z - player.location.z);
    if (t >= 3 && d <= 2.6) {
      const hand = player.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Mainhand)?.typeId;
      bonusDamage(player, target, weaponDamage(hand) + 1 + r);
      push(player, target, 0.5, 0.1);
      if (target.isValid) puff(target.dimension, "siege:kn_parry", centre(target));
      sfx(player.dimension, "kn.thrust", target.location);
      player.onScreenDisplay.setActionBar("§6Lunge");
      lunging.delete(player.id);
      return false;
    }
    if (t >= 12) {
      cooldowns.delete(`${player.id}:lunge`); // fell short: no cooldown spent
      lunging.delete(player.id);
    }
    return true;
  });
}

try {
  world.afterEvents.playerButtonInput.subscribe(({ player, button, newButtonState }) => {
    if (button !== InputButton.Jump || newButtonState !== ButtonState.Pressed) return;
    if (!player.isSprinting || !isKnight(player)) return;
    lunge(player);
  });
} catch {
  // an engine without button input: no Lunge
}

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
    // the shield rings with a gold-white spark, the attacker is knocked back half a step, and a backhand answers
    knightMove(player, "backhand");
    puff(player.dimension, "siege:kn_parry", shieldSpot(player));
    push(player, attacker, 0.5, 0.1);
    bonusDamage(player, attacker, s.blade_riposte === 2 ? 5 : 3);
    fx(player, "strength", 60, 0);
    linger(5, 12, () => (player.isValid ? puff(player.dimension, "siege:kn_glow", swordSpot(player)) : false)); // the 3 s of Strength
    sfx(player.dimension, "kn.parry", player.location);
    player.onScreenDisplay.setActionBar("§6Riposte");
  }

  if (s.blade_mastery) {
    const gear = player.getComponent("minecraft:equippable");
    if (gear && ARMOR_SLOTS.every((slot) => ARMOR_OK.test(gear.getEquipment(slot)?.typeId ?? ""))) {
      recover(player, event.damage, 0.05 + 0.05 * s.blade_mastery);
      puff(player.dimension, "siege:kn_glow", centre(player, 1.2)); // a small spark off the armour as it gives health back
      sfx(player.dimension, "kn.mastery", player.location);
    }
  }

  const health = player.getComponent("minecraft:health");
  if (s.blade_secondwind && health && health.currentValue > 0 && health.currentValue < 4 && ready(player, "secondwind", 6000 / quick(player))) {
    health.setCurrentValue(Math.min(health.effectiveMax, 12));
    fx(player, "resistance", 80, 1);
    // down on one knee for a breath, then up; the Resistance shows as a faint gold shell, a ring as you stand
    knightMove(player, "kneel");
    linger(10, 8, () => (player.isValid ? puff(player.dimension, "siege:kn_shell", player.location) : false));
    system.runTimeout(() => {
      if (player.isValid) goldRing(player.dimension, player.location, 3);
    }, 18);
    sfx(player.dimension, "kn.secondwind", player.location);
    api.title(player, "§6Second Wind", "§7Not today");
  }
});

// ---------- the Oath Banner: Rallying Cry (use) and Banner of the Keep (sneak + use) ----------
const banners = new Map(); // player id -> { dim, at, until, banner }
const BANNER_REACH = 10;
const bannerColor = (player) => api.keepOf(player.id)?.color ?? api.keepOf(api.settlementAt(player.location))?.color ?? 14;

world.afterEvents.itemUse.subscribe((event) => {
  const player = event.source;
  if (event.itemStack?.typeId !== OATH_BANNER) return;
  if (!isKnight(player)) return player.onScreenDisplay.setActionBar("§7The banner hangs limp. It answers only to the Oathsworn.");
  const s = heroOf(player).skills;

  if (player.isSneaking) {
    if (!s.blade_banner) return player.onScreenDisplay.setActionBar("§7Learn Banner of the Keep at the Tree of Oaths to plant this.");
    if (!ready(player, "banner", 1800, false)) return;
    // both hands drive it down; a 10-block war banner in your settlement's colour drops in a little in front of you
    const f = facing(player);
    const at = { x: player.location.x + f.x * 1.2, y: player.location.y, z: player.location.z + f.z * 1.2 };
    knightMove(player, "plant");
    const banner = plantBanner(player.dimension, at, yawToward(player.location, at), bannerColor(player));
    system.runTimeout(() => sfx(player.dimension, "kn.plant", at), 6);
    banners.set(player.id, { dim: player.dimension.id, at, until: system.currentTick + (s.blade_banner === 2 ? 600 : 400), banner });
    return api.title(player, "§6Banner planted", "§7Hold this ground");
  }

  if (!s.blade_rally) return player.onScreenDisplay.setActionBar("§7Learn Rallying Cry at the Tree of Oaths to use this.");
  if (!ready(player, "rally", 900, false)) return;
  const heal = 2 + 2 * s.blade_rally;
  const mine = api.settlementAt(player.location);
  const dim = player.dimension;
  // the banner raised high overhead; a gold ring rolls out to the true 10 blocks
  knightMove(player, "raise");
  goldRing(dim, player.location, 10);
  const reached = [];
  for (const e of dim.getEntities({ location: player.location, maxDistance: 10 })) {
    const ally = e.id === player.id || (api.isGuard(e) && api.guardOwner(e) === player.id)
      || (e.typeId === "minecraft:player" && (api.isAlly(player.id, e.id) || api.isAlly(e.id, player.id) || (mine && mine === e.id)));
    if (!ally) continue;
    const health = e.getComponent("minecraft:health");
    if (health) health.setCurrentValue(Math.min(health.effectiveMax, health.currentValue + heal));
    fx(e, "strength", 160, 0);
    puff(dim, "siege:kn_rise", e.location); // gold motes rise on everyone it reached
    reached.push(e);
    if (s.blade_champion && api.isGuard(e)) {
      fx(e, "speed", 160, 1);
      chargeAtNearest(player, e);
    }
  }
  // the 8 s of Strength: a faint gold glow about each of them
  linger(10, 16, () => {
    for (const e of reached) if (e.isValid) puff(e.dimension, "siege:kn_glow", centre(e, 1.1));
  });
  sfx(dim, "kn.rally", player.location);
  player.onScreenDisplay.setActionBar("§6Rallying Cry!");
});

/** Oathsworn Champion: a guard reached by the Cry charges the nearest enemy (a lunge toward it, grit off its heels). */
function chargeAtNearest(player, guard) {
  let best, bestD = 16;
  for (const e of guard.dimension.getEntities({ location: guard.location, maxDistance: 16 })) {
    if (friendly(player, e) || !e.getComponent("minecraft:health")) continue;
    const d = Math.hypot(e.location.x - guard.location.x, e.location.z - guard.location.z);
    if (d < bestD) (best = e), (bestD = d);
  }
  if (!best) return;
  const dx = best.location.x - guard.location.x, dz = best.location.z - guard.location.z;
  const d = Math.hypot(dx, dz) || 1;
  try {
    guard.applyKnockback({ x: (dx / d) * Math.min(1.6, d * 0.3), z: (dz / d) * Math.min(1.6, d * 0.3) }, 0.25);
  } catch {
    // can't be pushed
  }
  linger(2, 4, () => (guard.isValid ? grit(guard.dimension, guard.location, { x: -dx / d, z: -dz / d }) : false));
}

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
    if (s.blade_champion) {
      fx(player, "strength", 60, 0);
      puff(player.dimension, "siege:kn_glow", swordSpot(player)); // a faint ember edge on the blade
    }
    if (s.blade_captain) {
      for (const g of guardsNear(player, 16)) {
        fx(g, "strength", 60, 0);
        if (s.blade_captain > 1) fx(g, "resistance", 60, 0);
        puff(g.dimension, "siege:kn_pennant", centre(g, 2.5)); // a small gold pennant over each guard you lead
      }
    }
    // Execution: a thin red-gold crack mark over anything below a fifth of its health, seen only by you
    if (s.blade_execution) {
      for (const e of player.dimension.getEntities({ location: player.location, maxDistance: 12 })) {
        if (friendly(player, e)) continue;
        const h = e.getComponent("minecraft:health");
        if (!h || h.currentValue <= 0 || h.currentValue >= h.effectiveMax * 0.2) continue;
        try {
          player.spawnParticle("siege:kn_mark", e.location);
        } catch {
          // older engine, or unloaded
        }
      }
    }
  }

  // the Banners of the Keep: reach drawn on the ground, Weakness as a grey haze, the cloth furls when time is up
  for (const [id, b] of banners) {
    const dim = world.getDimension(b.dim);
    if (now > b.until) {
      banners.delete(id);
      strikeBanner(b.banner, dim, b.at);
      continue;
    }
    puff(dim, "siege:kn_reach", { x: b.at.x, y: b.at.y + 0.1, z: b.at.z }, { "variable.ring_size": BANNER_REACH });
    try {
      for (const e of dim.getEntities({ location: b.at, maxDistance: BANNER_REACH })) {
        if (e.typeId === "minecraft:player" || api.isGuard(e)) { fx(e, "strength", 60, 0); fx(e, "resistance", 60, 0); }
        else if (!friendly({ id }, e) && e.getComponent("minecraft:health")) {
          fx(e, "weakness", 60, 0);
          puff(dim, "siege:kn_haze", e.location);
        }
      }
    } catch {
      // unloaded
    }
  }
}

// Warhorse Charge: checked 4 times a second while riding
const lanced = new Map(); // player id -> tick the lance move last started

export function chargeTick() {
  const now = system.currentTick;
  for (const player of world.getPlayers()) {
    if (!isKnight(player)) continue;
    const r = rank(player, "blade_charge");
    const horse = r ? player.getComponent("minecraft:riding")?.entityRidingOn : undefined;
    if (!horse || !/horse|donkey|mule|camel/.test(horse.typeId)) continue;
    const v = horse.getVelocity();
    if (Math.hypot(v.x, v.z) < 0.22) continue;
    // at charging speed: dust streams off the hooves, the hooves get heavier, the weapon arm comes down level
    puff(horse.dimension, "siege:kn_hooves", horse.location);
    const last = lanced.get(player.id) ?? -99;
    if (now - last >= 30) {
      lanced.set(player.id, now);
      knightMove(player, "lance");
    }
    if ((now - last) % 10 < 5) sfx(horse.dimension, "kn.gallop", horse.location); // every other check
    for (const e of horse.dimension.getEntities({ location: horse.location, maxDistance: 2.2 })) {
      if (e.id === horse.id || friendly(player, e) || !e.getComponent("minecraft:health")) continue;
      if (now - (trampled.get(e.id) ?? -99) < 40) continue;
      trampled.set(e.id, now);
      bonusDamage(player, e, r === 2 ? 7 : 4);
      push(horse, e, 2.5, 0.6); // thrown up and aside
      if (!e.isValid) continue;
      puff(e.dimension, "siege:kn_parry", centre(e));
      grit(e.dimension, centre(e, 0.4), { x: v.x, z: v.z });
      if (e.typeId !== "minecraft:player") {
        let yaw = e.getRotation().y;
        linger(1, 8, () => {
          if (!e.isValid) return false;
          yaw += 45; // a spin as it goes
          e.setRotation({ x: 0, y: yaw });
        });
      }
      sfx(horse.dimension, "kn.trample", e.location);
    }
  }
  if (trampled.size > 200) trampled.clear();
  if (lanced.size > 50) lanced.clear();
}

world.afterEvents.playerLeave.subscribe(({ playerId }) => {
  const b = banners.get(playerId);
  if (b) {
    banners.delete(playerId);
    strikeBanner(b.banner, world.getDimension(b.dim), b.at);
  }
  lunging.delete(playerId);
});

addTests("townhall", {
  "a Lunge strikes with the weapon in hand": () => {
    assertEqual(weaponDamage("minecraft:iron_sword"), 6);
    assertEqual(weaponDamage("minecraft:netherite_axe"), 8);
    assertEqual(weaponDamage("minecraft:wooden_sword"), 4);
    assertEqual(weaponDamage(undefined), 1);
    assertEqual(weaponDamage("minecraft:bread"), 1);
  },
});
