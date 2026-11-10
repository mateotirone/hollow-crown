// The four regional roles: Dragon Rider (Emberwaste), Forgemaster (Frostmarch), Captain (Saltreach), Witch (Blackfen).
// Their skills are in skills.js (branches wing, forge, helm, hex). This file makes the skills do things.
//
// How a player gets one: raising a Stone Hall (tier 2) or better in a region's style has that region's role
// offered at the Tree of Oaths. Any feature can also offer or grant one from the story:
//   emit("offerRole", { player, role: "rider" | "forgemaster" | "captain" | "witch" })
//   emit("grantRole", { player, role })

import { world, system, EntityDamageCause, EquipmentSlot } from "@minecraft/server";
import * as api from "../siege/api.js";
import { heroOf, playerById } from "./hero.js";
import { ROLES } from "./skills.js";
import { guardsNear, inCombat } from "./progress.js";

const fx = (entity, effect, ticks, amplifier = 0) => {
  try { entity.addEffect(effect, ticks, { amplifier, showParticles: false }); } catch { /* gone this tick */ }
};
const unfx = (entity, effect) => { try { entity.removeEffect(effect); } catch { /* not there */ } };
const heal = (entity, amount) => {
  try {
    const h = entity.getComponent("minecraft:health");
    if (h && h.currentValue > 0) h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + amount));
  } catch { /* gone */ }
};
const held = (player) => { try { return player.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Mainhand); } catch { return undefined; } };
const mountOf = (player) => { try { return player.getComponent("minecraft:riding")?.entityRidingOn; } catch { return undefined; } };
const isDragon = (entity) => !!entity && /dragon/.test(entity.typeId);
const hostile = (player, e) => e.id !== player.id && e.typeId !== "minecraft:player" && !api.isGuard(e) && e.typeId !== api.KEEP_HEART && !/villager|golem|horse|wolf|cat|dragon|npc|item|arrow|xp_orb/.test(e.typeId);
const near = (player, at, range) => { try { return player.dimension.getEntities({ location: at, maxDistance: range }).filter((e) => hostile(player, e)); } catch { return []; } };
const wet = (player) => {
  try { if (player.isInWater) return true; } catch { /* fall through */ }
  try { const w = player.dimension.getWeather?.(); return !!w && String(w).toLowerCase() !== "clear"; } catch { return false; }
};

let striking = false; // true while a skill deals its own damage, so it cannot set itself off
function bonus(player, target, amount) {
  striking = true;
  try { target.applyDamage(amount, { cause: EntityDamageCause.entityAttack, damagingEntity: player }); } catch { /* gone */ } finally { striking = false; }
}

const lastUse = new Map();
const ready = (player, key, ticks) => {
  const k = `${player.id}:${key}`;
  if (system.currentTick - (lastUse.get(k) ?? -1e9) < ticks) return false;
  lastUse.set(k, system.currentTick);
  return true;
};

// ---------- every second ----------
let second = 0;
export function rolesTick() {
  second++;
  let state;
  try { state = api.getState(); } catch { return; }
  for (const player of world.getPlayers()) {
    const hero = heroOf(player);
    if (!ROLES[hero.path]?.region) continue;
    const s = hero.skills;
    const mount = mountOf(player), dragon = isDragon(mount), fighting = inCombat(player);

    // Wing
    if (s.wing_heat) fx(player, "fire_resistance", 60);
    if (s.wing_bond && dragon) fx(mount, "regeneration", 60, s.wing_bond - 1);
    if (s.wing_fall) {
      let vy = 0; try { vy = player.getVelocity().y; } catch { /* fine */ }
      if (vy < -0.6 && !mount) fx(player, "slow_falling", 40);
      if (s.wing_fall >= 2 && !mount) fx(player, "jump_boost", 60, 1);
    }
    if (s.wing_scale && mount) { fx(player, "resistance", 60, s.wing_scale >= 3 ? 1 : 0); if (s.wing_scale >= 2 && dragon) fx(mount, "resistance", 60, 0); }
    if (s.wing_eye && mount) fx(player, "night_vision", 300);
    if (s.wing_heart) { fx(player, "health_boost", 100, 1); if (dragon) { fx(player, "strength", 60, 0); fx(mount, "strength", 60, 0); } }

    // Forge
    const tool = held(player)?.typeId ?? "";
    if (s.forge_deep) { fx(player, "haste", 60, 1); fx(player, "resistance", 60, 0); }
    else if (s.forge_arm && /pickaxe|_axe|hammer/.test(tool)) fx(player, "haste", 60, s.forge_arm - 1);
    if (s.forge_temper && !fighting && second % 30 === 0) fx(player, "absorption", 700, s.forge_temper - 1);
    if (s.forge_cold) { unfx(player, "slowness"); unfx(player, "mining_fatigue"); }
    if (s.forge_mend && second % (s.forge_mend >= 2 ? 10 : 20) === 0) mendHeld(player);
    if (s.forge_stance && player.isSneaking) fx(player, "resistance", 40, s.forge_stance - 1);
    if (s.forge_guardsteel) for (const g of guardsNear(player, 16)) { fx(g, "resistance", 60, 0); if (s.forge_guardsteel >= 2) fx(g, "strength", 60, 0); }

    // Helm
    if (s.helm_legs) { fx(player, "water_breathing", 60); if (s.helm_legs >= 2 && wet(player)) fx(player, "speed", 60, s.helm_legs - 2); }
    if (s.helm_voice) for (const g of guardsNear(player, [0, 12, 16, 24][s.helm_voice])) fx(g, "speed", 60, 0);
    if (s.helm_storm && wet(player) && !player.isInWater) { fx(player, "strength", 60, 0); fx(player, "regeneration", 60, 0); }
    if (s.helm_fleet && state.active) for (const g of guardsNear(player, 24)) { fx(g, "strength", 60, 0); fx(g, "regeneration", 60, 0); }

    // Hex
    if (s.hex_blood) { unfx(player, "poison"); if (s.hex_blood >= 2) unfx(player, "wither"); }
    if (s.hex_eyes) fx(player, "night_vision", 300);
  }
}

function mendHeld(player) {
  try {
    const gear = player.getComponent("minecraft:equippable");
    const item = gear?.getEquipment(EquipmentSlot.Mainhand);
    const wear = item?.getComponent("minecraft:durability");
    if (!wear || wear.damage <= 0) return;
    wear.damage = Math.max(0, wear.damage - 4);
    gear.setEquipment(EquipmentSlot.Mainhand, item);
  } catch { /* not a tool */ }
}

// ---------- hits, hurts and kills ----------
const hurtBefore = new Set(); // entity ids that have already been hit once (for Boarding Action)

world.afterEvents.entityHurt.subscribe((event) => {
  if (striking || !api.isReady()) return;
  const { hurtEntity: target, damageSource: source } = event;
  const attacker = source?.damagingEntity;

  // a role-holder hit something
  if (attacker?.typeId === "minecraft:player" && target?.isValid !== false && target.id !== attacker.id) {
    const hero = heroOf(attacker), s = hero.skills;
    if (ROLES[hero.path]?.region && hostile(attacker, target)) {
      const shot = !!source.damagingProjectile, melee = !shot;
      const mounted = !!mountOf(attacker), weapon = held(attacker)?.typeId ?? "";
      let extra = 0;
      if (s.wing_dive && mounted) extra += [0, 3, 5, 8][s.wing_dive];
      if (s.wing_brand && melee) { try { target.setOnFire(s.wing_brand * 3, true); } catch { /* fireproof */ } }
      if (s.forge_edge && melee && /sword|_axe|hammer/.test(weapon)) extra += s.forge_edge;
      if (s.forge_master && melee && Math.random() < 0.2) { extra += 6; fx(target, "slowness", 40, 1); }
      if (s.helm_volley && shot) extra += s.helm_volley + 1;
      if (s.helm_boarding && melee && !hurtBefore.has(target.id)) extra += s.helm_boarding === 2 ? 7 : 4;
      if (s.hex_touch) {
        let poisoned = false; try { poisoned = !!target.getEffect("poison"); } catch { /* fine */ }
        if (s.hex_rot && poisoned) fx(target, "wither", s.hex_rot === 2 ? 100 : 60, 0);
        fx(target, "poison", (s.hex_touch + 1) * 20, 0);
        if (s.hex_contagion) for (const e of near(attacker, target.location, 4)) if (e.id !== target.id) fx(e, "poison", (s.hex_touch + 1) * 20, 0);
      }
      hurtBefore.add(target.id);
      if (hurtBefore.size > 400) hurtBefore.clear();
      if (extra > 0) bonus(attacker, target, extra);
    }
  }

  // a role-holder was hit
  if (target?.typeId === "minecraft:player") {
    const hero = heroOf(target), s = hero.skills;
    if (!ROLES[hero.path]?.region) return;
    if (s.hex_eye && attacker && attacker.id !== target.id) { fx(attacker, "weakness", 80, 0); if (s.hex_eye >= 2) fx(attacker, "slowness", 80, 0); }
    if (s.hex_slip && Math.random() < (s.hex_slip === 2 ? 0.25 : 0.15)) { fx(target, "invisibility", 60, 0); fx(target, "speed", 60, 1); }
    if (s.helm_tide) {
      let hp = 20; try { hp = target.getComponent("minecraft:health").currentValue; } catch { /* fine */ }
      if (hp > 0 && hp < 6 && ready(target, "tide", 6000)) {
        for (const g of guardsNear(target, 24)) heal(g, 1000);
        fx(target, "absorption", 400, 3);
        target.sendMessage("§3The tide turns.§7 Your crew rallies.");
        try { target.playSound("raid.horn", { volume: 0.6 }); } catch { /* fine */ }
      }
    }
  }
});

world.afterEvents.entityDie.subscribe((event) => {
  if (!api.isReady()) return;
  const killer = event.damageSource?.damagingEntity, dead = event.deadEntity;
  if (killer?.typeId !== "minecraft:player" || !dead) return;
  const hero = heroOf(killer), s = hero.skills;
  if (!ROLES[hero.path]?.region) return;
  let hostileDead = false, at;
  try { hostileDead = hostile(killer, dead); at = dead.location; } catch { return; }
  if (!hostileDead) return;
  if (s.hex_leech) heal(killer, s.hex_leech);
  if (s.hex_bane && !striking) for (const e of near(killer, at, 4)) if (e.id !== dead.id) bonus(killer, e, 6);
  const mount = mountOf(killer);
  if (s.wing_wyrmfire && mount) { heal(killer, 6); heal(mount, 6); fx(killer, "speed", 100, 1); fx(mount, "speed", 100, 1); }
});

// Harbor Purse and Press Gang
const rankOfSkill = (player, id) => (player ? heroOf(player).skills[id] ?? 0 : 0);
api.addRewardHook(({ player, emeralds }) => emeralds + rankOfSkill(player, "helm_purse"));
const crews = new Map(); // owner id -> Press Gang rank, remembered after they log off
api.addGuardLimitHook((owner, limit) => {
  const p = playerById(owner);
  if (p) crews.set(owner, rankOfSkill(p, "helm_crew"));
  return limit + (crews.get(owner) ?? 0);
});

// ---------- how a role is offered ----------
// A region's people offer their role once you have raised a real hall among them.
export const roleForStyle = (style) => Object.keys(ROLES).find((id) => ROLES[id].region === style);

api.on("hallBuilt", ({ owner, level, style }) => {
  const role = roleForStyle(style);
  const player = playerById(owner);
  if (!role || !player || level < 2) return;
  const hero = heroOf(player);
  if (hero.path !== "none" || hero.offers.includes(role)) return;
  api.emit("offerRole", { player, role });
});
