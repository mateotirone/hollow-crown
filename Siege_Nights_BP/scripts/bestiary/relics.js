// The named boss weapons and relics, and the keys that summon the regional bosses.
// The items themselves are data (items/bestiary/*.json); what makes them special is here.

import { world, EquipmentSlot } from "@minecraft/server";
import { onTick, isNight, addTests, assert, assertEqual } from "../siege/api.js";
import { ITEMS, SIGILS, MOBS } from "./data.js";
import { bossDefs, startBoss, activeFights } from "./bossCore.js";
import { effect, flat, heal, healthOf, held, heroOf, hurt, particle, ring, shove, sound } from "./util.js";

const offhand = (p) => held(p, EquipmentSlot.Offhand);
const worn = (p, slot) => held(p, slot);
const isBoss = (e) => ["boss", "boss_add", "boss_prop"].includes(MOBS[e.typeId]?.family);
const brandHits = new Map(); // player id -> hits with the Warlord's Brand
const rallyAt = new Map(); // player id -> tick of the last Oath rally
let clock = 0;

world.afterEvents.entityHurt.subscribe((event) => {
  const victim = event.hurtEntity, by = event.damageSource.damagingEntity;
  const cause = event.damageSource.cause;
  try {
    // ----- hits you land -----
    if (by?.typeId === "minecraft:player" && cause === "entityAttack") {
      const weapon = held(by);
      if (weapon === "siege:minute_hand") { // time slows around whatever it cuts
        effect(victim, "slowness", 50, isBoss(victim) ? 1 : 3, true);
        particle(victim.dimension, "minecraft:endrod", victim.getHeadLocation());
      }
      if (weapon === "siege:warlords_brand") {
        victim.setOnFire(4, true);
        const n = (brandHits.get(by.id) ?? 0) + 1;
        brandHits.set(by.id, n);
        if (n % 5 === 0) { // every fifth hit: a war-cry shockwave
          ring(by.dimension, by.location, 4, "minecraft:basic_flame_particle");
          sound(by.dimension, "mob.ravager.roar", by.location, 1.2, 0.6);
          for (const e of by.dimension.getEntities({ location: by.location, maxDistance: 4.5, families: ["monster"] })) {
            hurt(e, 5, "entityAttack", by); shove(e, e.location.x - by.location.x, e.location.z - by.location.z, 1.4, 0.4);
          }
        }
      }
      if (weapon === "siege:oath_of_oswin") {
        const hp = healthOf(victim);
        if (isBoss(victim)) hurt(victim, 4, "magic");
        else if (hp.now > 0 && hp.now / hp.max <= 0.2) { // execution
          hurt(victim, 1000, "magic");
          particle(by.dimension, "minecraft:totem_particle", victim.location);
        }
        if (clock - (rallyAt.get(by.id) ?? -999) >= 200) { // rally your guards, at most every 10 seconds
          rallyAt.set(by.id, clock);
          for (const g of by.dimension.getEntities({ location: by.location, maxDistance: 12, families: ["siege_guard"] })) {
            effect(g, "strength", 120, 0, true); effect(g, "regeneration", 120, 0, true);
          }
        }
      }
      if (offhand(by) === "siege:mire_heart" && isNight()) heal(by, Math.max(1, event.damage * 0.15)); // lifesteal at night
    }
    // ----- hits you take -----
    if (victim.typeId === "minecraft:player") {
      if (offhand(victim) === "siege:seneschal_greatshield" && victim.isSneaking && by && cause === "entityAttack") {
        shove(by, by.location.x - victim.location.x, by.location.z - victim.location.z, 1.8, 0.4); // braced: throw them back
        sound(victim.dimension, "item.shield.block", victim.location);
      }
      if (worn(victim, EquipmentSlot.Chest) === "siege:crownless_mantle" && Math.random() < 0.2 && healthOf(victim).now > 0) {
        heal(victim, event.damage); // the blow passes through you
        particle(victim.dimension, "minecraft:sculk_soul_particle", victim.getHeadLocation());
        victim.onScreenDisplay.setActionBar("§5The blow passes through you.");
      }
    }
  } catch {
    // one of them is already gone
  }
});

// Rimefang Bow: its arrows root what they hit in ice
world.afterEvents.projectileHitEntity.subscribe((event) => {
  const shooter = event.source, hit = event.getEntityHit()?.entity;
  if (!hit || shooter?.typeId !== "minecraft:player" || held(shooter) !== "siege:rimefang_bow") return;
  effect(hit, "slowness", isBoss(hit) ? 30 : 70, isBoss(hit) ? 2 : 255, true);
  ring(hit.dimension, hit.location, 0.8, "minecraft:snowflake_particle", 10);
  sound(hit.dimension, "random.glass", hit.location, 1.4, 0.6);
});

const WHISPERS = ["...hold the ground...", "...the bell is under you...", "...there is a chair for you...", "...wear me...", "...someone always wears it..."];

function relicTick() {
  clock += 20;
  for (const p of world.getPlayers()) {
    try {
      if (offhand(p) === "siege:seneschal_greatshield" && p.isSneaking) effect(p, "resistance", 30, 1);
      if (worn(p, EquipmentSlot.Head) === "siege:widows_veil") {
        effect(p, "water_breathing", 300, 0); effect(p, "night_vision", 300, 0);
        // See Hollow things for what they are: a mark over each one that only the wearer sees
        for (const e of p.dimension.getEntities({ location: p.location, maxDistance: 24, families: ["hollow"] })) {
          p.spawnParticle("minecraft:sculk_soul_particle", { x: e.location.x, y: e.location.y + 2.4, z: e.location.z });
        }
      }
      if (held(p) === "siege:faceless_crown_shard" && clock % 400 === 0) p.onScreenDisplay.setActionBar(`§8§o${WHISPERS[Math.floor(Math.random() * WHISPERS.length)]}`);
    } catch {
      // player leaving
    }
  }
}
onTick("bestiary_relics", 20, relicTick);

// ---------- Boss keys: use one to call its boss where you stand ----------
// The regional puzzles hand these out. Until the map's arenas exist, the fight starts right here.
world.afterEvents.itemUse.subscribe((event) => {
  const type = SIGILS[event.itemStack?.typeId];
  const player = event.source;
  if (!type || player?.typeId !== "minecraft:player") return;
  const def = bossDefs().find((d) => d.type === type);
  if (!def) return;
  if (activeFights().some((f) => f.def.id === def.id && f.dim.id === player.dimension.id && flat(f.center, player.location) < 96)) {
    return player.onScreenDisplay.setActionBar(`§7${def.name} is already here.`);
  }
  const v = player.getViewDirection();
  const d = Math.hypot(v.x, v.z) || 1;
  const at = { x: player.location.x + (v.x / d) * 6, y: player.location.y, z: player.location.z + (v.z / d) * 6 };
  try {
    startBoss(def.id, player.dimension, at);
  } catch {
    return player.onScreenDisplay.setActionBar("§7Nothing answers. Try somewhere more open.");
  }
  if (player.getGameMode?.() !== "Creative") {
    const eq = player.getComponent("equippable");
    const stack = eq.getEquipment(EquipmentSlot.Mainhand);
    if (stack?.typeId === event.itemStack.typeId) eq.setEquipment(EquipmentSlot.Mainhand, stack.amount > 1 ? (stack.amount--, stack) : undefined);
  }
});

export const pathRelic = (player) => (heroOf(player).path === "marked" ? "siege:crownless_mantle" : "siege:oath_of_oswin");

addTests("bestiary", {
  "every boss key calls a boss that exists": () => {
    assertEqual(Object.keys(SIGILS).length, 5);
    for (const [item, type] of Object.entries(SIGILS)) {
      assert(ITEMS[item], `${item} is not an item`);
      assert(bossDefs().some((d) => d.type === type), `${item} points at ${type}, which has no fight`);
    }
  },
});
