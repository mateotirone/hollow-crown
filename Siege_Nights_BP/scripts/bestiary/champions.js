// Champions: NPCs that stand in for players and fight like one.
//
// Four bodies (entities/bestiary/champion_*.json): Rival Knight, Rival Sorcerer, Rival Lord, Retainer.
// The entity data gives them a body, a walk and a sword swing. Everything a player would do on top of
// that is here, decided four times a second:
//   * sword up close, bow at range (Sorcerers throw Hollow bolts and mark the ground instead)
//   * shield: raised in cycles when you're close. Blades glance off, arrows stop. An AXE breaks the guard for 5 s.
//   * strafes around you, and hops back after landing a hit
//   * low on health: backs off and drinks a potion (2 seconds; hit them while they drink to spoil it)
//   * a golden apple once, an ender pearl to close the gap if you run or snipe from far away
//   * role powers: Knight war-cry and shield bash, Sorcerer blink, Lord calls retainers
// What they can't do: place or break blocks, so no pillaring, bridging or bucket saves.
//
// Other features use them like this:
//   import { spawnChampion, setStance } from "../bestiary/champions.js";
//   const lord = spawnChampion(dim, at, { role: "lord", tier: 3, name: "Lord Halvard", stance: "hostile", tags: ["rival_7"] });
// stance: "hostile" hunts players and guards, "realm" hunts monsters (an ally), "calm" only hits back.
// tier 1 to 5 sets health, potions and how sharp they are. They get tougher per extra player nearby, like bosses.
// When one dies we send script event siege:champion_defeated {"id","name","role","tier","tags","x","y","z","dimension","players"}.
// Test: /scriptevent siege:champion_summon knight 3 hostile

import { world, system } from "@minecraft/server";
import { onTick, addFilter, addTests, assert, assertEqual } from "../siege/api.js";
import { hitGivenBack } from "./bossCore.js";
import { activeDimensions, announce, effect, heal, healthOf, held, hurt, particle, ring, shove, sound } from "./util.js";

const STEP = 5;
const ROLES = { knight: "siege:champion_knight", sorcerer: "siege:champion_sorcerer", lord: "siege:champion_lord", retainer: "siege:champion_retainer" };
const ROLE_OF = Object.fromEntries(Object.entries(ROLES).map(([role, type]) => [type, role]));
const GUARD_TAG = "siege_champ_guard";
const TIER_PROP = "siege:champ_tier", STANCE_PROP = "siege:champ_stance", READY_PROP = "siege:champ_ready";
const FOREVER = 20000000;

// ---------- pure pieces (self-tested) ----------
export function tierStats(tier, role = "knight") {
  const t = Math.min(5, Math.max(1, Math.round(tier || 1)));
  const grunt = role === "retainer";
  return {
    tier: t,
    bonusHearts: grunt ? 0 : (t - 1) * 10, // extra hearts on top of the body's own health
    potions: grunt ? 0 : Math.min(3, Math.ceil(t / 2)),
    apple: !grunt && t >= 2,
    pearl: !grunt && t >= 2,
    shotEvery: Math.max(20, 50 - t * 6), // ticks between arrows or bolts
    guardUp: 30 + t * 6, guardDown: Math.max(16, 40 - t * 5), // ticks: the gap is your opening
    strength: t >= 5 ? 1 : t >= 3 ? 0 : -1,
  };
}

// What a champion does this moment. One decision, in the order a player would think about it.
export function championPlan({ role, distance, health, potions, drinking, canPearl, hasTarget }) {
  if (!hasTarget) return "rest";
  if (drinking) return "drink";
  if (health < 0.35 && potions > 0) return "drink";
  if (distance > 20 && canPearl) return "pearl";
  if (role === "sorcerer") return distance < 5 ? "blink" : "cast";
  if (role === "retainer") return "melee";
  return distance > 9 ? "shoot" : "melee";
}

export const guardIsUp = (clock, stats, brokenUntil) => clock >= brokenUntil && clock % (stats.guardUp + stats.guardDown) < stats.guardUp;
export const isAxe = (typeId) => !!typeId && typeId.endsWith("_axe");

// ---------- spawning ----------
export function setStance(entity, stance) {
  try {
    entity.triggerEvent(stance === "hostile" ? "siege:hostile" : stance === "realm" ? "siege:realm" : "siege:calm");
    entity.setDynamicProperty(STANCE_PROP, stance);
  } catch {
    // gone
  }
}

export function spawnChampion(dim, at, { role = "knight", tier = 2, name, stance = "calm", tags = [] } = {}) {
  const e = dim.spawnEntity(ROLES[role] ?? ROLES.knight, at);
  e.setDynamicProperty(TIER_PROP, tierStats(tier).tier);
  if (name) e.nameTag = name;
  for (const t of tags) e.addTag(t);
  setStance(e, stance);
  return e;
}

// The settlement feature asks for a rival lord's soldiers through this filter, so it never has to import us.
addFilter("rivalSoldier", (entity, { dim, at, role, tier, name, tags, stance } = {}) => {
  if (entity) return entity;
  try {
    return spawnChampion(dim, at, { role, tier, name, stance: stance ?? "hostile", tags: tags ?? [] }); // "realm" = a lord's soldiers sent to help a player
  } catch {
    return undefined; // they fall back to pillagers
  }
});

// ---------- the fight ----------
const minds = new Map(); // entity id -> what it is in the middle of
let clock = 0;
const pending = []; // delayed things: marked ground going off, pearls landing

function mindOf(e) {
  let m = minds.get(e.id);
  if (m) return m;
  const role = ROLE_OF[e.typeId];
  const stats = tierStats(e.getDynamicProperty(TIER_PROP) ?? 2, role);
  m = { role, stats, potions: stats.potions, apple: stats.apple, nextShot: 0, nextPower: clock + 100, nextPearl: 0, brokenUntil: 0,
        drinkUntil: 0, drinkBlocked: 0, strafe: 1, called: 0, bow: false, guard: false, offset: Math.floor(Math.random() * 40) };
  minds.set(e.id, m);
  if (!e.getDynamicProperty(READY_PROP)) { // first time we meet it: give it its tier
    e.setDynamicProperty(READY_PROP, true);
    if (stats.bonusHearts) effect(e, "health_boost", FOREVER, stats.bonusHearts / 2 - 1);
    system.runTimeout(() => heal(e, 1000), 2);
    const stance = e.getDynamicProperty(STANCE_PROP);
    if (stance === undefined && role !== "retainer") setStance(e, "calm");
  }
  if (stats.strength >= 0) effect(e, "strength", FOREVER, stats.strength);
  return m;
}

function flag(e, m, name, on) {
  if (m[name] === on) return;
  m[name] = on;
  try {
    e.triggerEvent(`siege:${name}_${on ? "on" : "off"}`);
    if (name === "guard") on ? e.addTag(GUARD_TAG) : e.removeTag(GUARD_TAG);
  } catch {
    // gone
  }
}

function loose(e, target, type, speed) {
  const head = e.getHeadLocation(), aim = target.getHeadLocation?.() ?? target.location;
  const dx = aim.x - head.x, dy = aim.y - head.y - 0.3, dz = aim.z - head.z, d = Math.hypot(dx, dy, dz) || 1;
  const v = target.getVelocity?.() ?? { x: 0, y: 0, z: 0 };
  const lead = d / (speed * 20); // seconds of flight: aim where you'll be, the way a player leads a shot
  const tx = dx + v.x * 20 * lead * 0.6, tz = dz + v.z * 20 * lead * 0.6;
  const n = Math.hypot(tx, dy, tz) || 1;
  const shot = e.dimension.spawnEntity(type, { x: head.x + (tx / n) * 0.8, y: head.y, z: head.z + (tz / n) * 0.8 });
  const p = shot.getComponent("projectile");
  if (!p) return;
  p.owner = e;
  p.shoot({ x: (tx / n) * speed, y: (dy / n) * speed + (type === "minecraft:arrow" ? d * 0.012 : 0), z: (tz / n) * speed }, { uncertainty: 1.5 });
}

function blinkTo(e, around, distance) {
  const dim = e.dimension;
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * Math.PI * 2;
    const x = Math.floor(around.x + Math.cos(a) * distance), z = Math.floor(around.z + Math.sin(a) * distance);
    for (let dy = 3; dy >= -3; dy--) {
      const y = Math.floor(around.y) + dy;
      try {
        const feet = dim.getBlock({ x, y, z }), below = dim.getBlock({ x, y: y - 1, z }), head = dim.getBlock({ x, y: y + 1, z });
        if (!feet || !below || !head || !feet.isAir || !head.isAir || below.isAir || below.isLiquid) continue;
        particle(dim, "minecraft:ender_explosion_particle", e.getHeadLocation());
        e.teleport({ x: x + 0.5, y, z: z + 0.5 }, { facingLocation: around });
        sound(dim, "mob.endermen.portal", { x, y, z }, 1, 0.8);
        return true;
      } catch {
        // not loaded
      }
    }
  }
  return false;
}

function think(e) {
  const m = mindOf(e);
  let target;
  try {
    target = e.target;
  } catch {
    target = undefined;
  }
  const hp = healthOf(e), health = hp.now / hp.max;
  const d = target ? Math.hypot(target.location.x - e.location.x, target.location.y - e.location.y, target.location.z - e.location.z) : 0;
  const plan = championPlan({ role: m.role, distance: d, health, potions: clock >= m.drinkBlocked ? m.potions : 0, drinking: m.drinkUntil > 0,
    canPearl: m.stats.pearl && clock >= m.nextPearl, hasTarget: !!target });

  if (plan === "rest") {
    flag(e, m, "guard", false); flag(e, m, "bow", false);
    if (health < 1 && clock % 40 < STEP) heal(e, 2); // patches itself up between fights, like you would
    return;
  }
  const dx = target.location.x - e.location.x, dz = target.location.z - e.location.z;

  // a golden apple, once, when the fight turns
  if (m.apple && health < 0.6) {
    m.apple = false;
    effect(e, "absorption", 2400, 1); effect(e, "regeneration", 100, 1);
    sound(e.dimension, "random.eat", e.location, 1, 1);
  }

  if (plan === "drink") {
    flag(e, m, "guard", false); flag(e, m, "bow", false);
    if (!m.drinkUntil) {
      m.drinkUntil = clock + 40;
      flag(e, m, "drink", true);
      effect(e, "speed", 60, 1);
      sound(e.dimension, "random.drink", e.location, 1, 1);
    } else if (clock >= m.drinkUntil) {
      m.drinkUntil = 0; m.potions--;
      flag(e, m, "drink", false);
      heal(e, hp.max * 0.4);
      particle(e.dimension, "minecraft:heart_particle", e.getHeadLocation());
      sound(e.dimension, "random.glass", e.location, 1.4, 0.5);
    }
    if (d < 9) shove(e, -dx, -dz, 0.35, 0); // backs away while drinking
    return;
  }

  if (plan === "pearl") {
    m.nextPearl = clock + 240;
    sound(e.dimension, "random.bow", e.location, 0.5, 1);
    const who = target;
    pending.push({ at: clock + 15, run: () => blinkTo(e, who.location, 3) });
    return;
  }

  if (plan === "shoot" || plan === "cast") {
    flag(e, m, "guard", false);
    if (m.role !== "sorcerer") { flag(e, m, "bow", true); effect(e, "slowness", STEP + 2, 1); } // plants its feet to draw
    if (clock >= m.nextShot) {
      m.nextShot = clock + m.stats.shotEvery;
      if (m.role === "sorcerer") {
        loose(e, target, "siege:hollow_bolt", 1.3);
        sound(e.dimension, "mob.evocation_illager.cast_spell", e.location, 1.3, 0.8);
        if (clock >= m.nextPower) { // marks the ground under you: two seconds to move
          m.nextPower = clock + 160;
          const spot = { ...target.location }, dim = e.dimension;
          for (let t = 0; t < 40; t += 10) pending.push({ at: clock + t, run: () => ring(dim, spot, 3, "minecraft:sculk_soul_particle") });
          pending.push({ at: clock + 40, run: () => {
            particle(dim, "minecraft:large_explosion", { x: spot.x, y: spot.y + 0.5, z: spot.z });
            for (const p of dim.getPlayers({ location: spot, maxDistance: 3 })) { hurt(p, 6 + m.stats.tier, "magic", e); effect(p, "darkness", 60, 0); }
          } });
        }
        if (d > 14) shove(e, dx, dz, 0.2, 0); else if (d < 9) shove(e, -dx, -dz, 0.3, 0); // keeps its distance
      } else {
        loose(e, target, "minecraft:arrow", 1.9);
        sound(e.dimension, "random.bow", e.location, 1, 1);
      }
    }
    return;
  }

  if (plan === "blink") { // a Sorcerer you've cornered steps through the air
    if (clock >= m.nextPearl) {
      m.nextPearl = clock + 120;
      if (blinkTo(e, target.location, 10)) return;
    }
    // no room to blink: fights with the staff below
  }

  // ----- melee: guard, strafe, role powers -----
  flag(e, m, "bow", false);
  const hasShield = m.role !== "sorcerer";
  flag(e, m, "guard", hasShield && d < 6 && guardIsUp(clock + m.offset, m.stats, m.brokenUntil));
  if (d < 4.5) {
    if ((clock + m.offset) % 30 < STEP) m.strafe = Math.random() < 0.5 ? 1 : -1;
    shove(e, -dz * m.strafe, dx * m.strafe, 0.22, 0);
  }
  if (clock < m.nextPower || d > 6) return;
  if (m.role === "knight" || m.role === "lord") {
    m.nextPower = clock + 240;
    if (m.guard && d < 3.2) { // shield bash
      shove(target, dx, dz, 1.3, 0.35); effect(target, "slowness", 40, 2); hurt(target, 3, "entityAttack", e);
      sound(e.dimension, "item.shield.block", e.location, 0.7, 1);
    } else { // war-cry: itself and its own side hit harder for a while
      sound(e.dimension, "raid.horn", e.location, 1.4, 0.6);
      for (const ally of e.dimension.getEntities({ families: ["siege_champion"], location: e.location, maxDistance: 12 })) {
        effect(ally, "strength", 120, Math.max(0, m.stats.strength + 1), true); effect(ally, "speed", 120, 0, true);
      }
    }
  }
  if (m.role === "lord" && m.called < 2 && health < (m.called ? 0.3 : 0.65)) { // calls for help twice
    m.called++;
    sound(e.dimension, "raid.horn", e.location, 1, 1);
    const stance = e.getDynamicProperty(STANCE_PROP) ?? "calm";
    for (let i = 0; i < 2; i++) {
      try {
        const r = e.dimension.spawnEntity(ROLES.retainer, { x: e.location.x + (i ? 2 : -2), y: e.location.y, z: e.location.z + 1 });
        r.setDynamicProperty(TIER_PROP, 1);
        setStance(r, stance === "calm" ? "hostile" : stance); // a calm lord who is fighting has been attacked
        r.addTag("siege_champ_called");
        for (const t of e.getTags()) if (!t.startsWith("siege_champ")) r.addTag(t); // they belong to whoever their lord belongs to
      } catch {
        // no room
      }
    }
  }
}

function tick() {
  clock += STEP;
  for (const job of pending.splice(0)) {
    if (job.at > clock) { pending.push(job); continue; }
    try { job.run(); } catch { /* target gone */ }
  }
  for (const dim of activeDimensions()) {
    let all = [];
    try {
      all = dim.getEntities({ families: ["siege_champion"] });
    } catch {
      continue;
    }
    for (const e of all) {
      try {
        if (!e.hasTag("siege_showcase")) think(e);
      } catch {
        // unloaded mid-thought
      }
    }
  }
  if (clock % 1200 === 0) for (const id of minds.keys()) if (!world.getEntity(id)) minds.delete(id);
}
onTick("bestiary_champions", STEP, tick);

// ---------- hits ----------
world.afterEvents.entityHurt.subscribe((event) => {
  const victim = event.hurtEntity, by = event.damageSource.damagingEntity;
  try {
    if (ROLE_OF[by?.typeId] && event.damageSource.cause === "entityAttack") { // it landed a hit: hop back out of reach
      shove(by, by.location.x - victim.location.x, by.location.z - victim.location.z, 0.5, 0.1);
    }
    if (!ROLE_OF[victim.typeId] || victim.hasTag("siege_showcase")) return;
    const m = mindOf(victim);
    const melee = event.damageSource.cause === "entityAttack";
    if (m.guard) {
      sound(victim.dimension, "item.shield.block", victim.location, 1, 1);
      if (melee && by?.typeId === "minecraft:player" && isAxe(held(by))) { // an axe splits the guard, as it would on a player
        m.brokenUntil = clock + m.offset + 100;
        flag(victim, m, "guard", false);
        sound(victim.dimension, "random.break", victim.location, 0.8, 1);
        by.onScreenDisplay.setActionBar("§eGuard broken!");
      }
    }
    if (m.drinkUntil && event.damage > 0) { // caught drinking: the potion is spoiled, and it won't try again for a few seconds
      m.drinkUntil = 0; m.drinkBlocked = clock + 80;
      flag(victim, m, "drink", false);
    }
    // tougher per extra player nearby, the same way bosses are
    const crowd = victim.dimension.getPlayers({ location: victim.location, maxDistance: 24 }).length;
    const back = hitGivenBack(event.damage, crowd);
    if (back > 0 && healthOf(victim).now > 0) heal(victim, back);
  } catch {
    // one of them is gone
  }
});

world.afterEvents.entityDie.subscribe((event) => {
  const dead = event.deadEntity;
  try {
    const role = ROLE_OF[dead.typeId];
    if (!role) return;
    minds.delete(dead.id);
    if (role === "retainer") return;
    const at = dead.location, dim = dead.dimension;
    const players = dim.getPlayers({ location: at, maxDistance: 32 }).map((p) => p.id);
    const tier = dead.getDynamicProperty(TIER_PROP) ?? 2;
    announce("siege:champion_defeated", { id: dead.id, name: dead.nameTag || undefined, role, tier, tags: dead.getTags(),
      x: Math.floor(at.x), y: Math.floor(at.y), z: Math.floor(at.z), dimension: dim.id, players });
    for (const id of players) announce("siege:award_skill_points", { player: id, points: tier >= 3 ? 1 : 0, renown: 30 * tier, reason: `champion:${role}` });
  } catch {
    // died out of sight
  }
});

// /scriptevent siege:champion_summon <knight|sorcerer|lord|retainer> [tier 1-5] [hostile|realm|calm]
system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "siege:champion_summon") return;
  const src = event.sourceEntity;
  if (!src) return;
  const [role = "knight", tier = "2", stance = "hostile"] = event.message.trim().split(/\s+/);
  try {
    const v = src.getViewDirection();
    spawnChampion(src.dimension, { x: src.location.x + v.x * 6, y: src.location.y, z: src.location.z + v.z * 6 }, { role, tier: Number(tier) || 2, stance });
  } catch (e) {
    src.sendMessage?.(`§cCouldn't summon a champion: ${e}`);
  }
});

addTests("bestiary", {
  "a champion thinks like a player": () => {
    const base = { role: "knight", distance: 3, health: 1, potions: 2, drinking: false, canPearl: true, hasTarget: true };
    assertEqual(championPlan({ ...base, hasTarget: false }), "rest");
    assertEqual(championPlan(base), "melee");
    assertEqual(championPlan({ ...base, distance: 14 }), "shoot");
    assertEqual(championPlan({ ...base, distance: 30 }), "pearl");
    assertEqual(championPlan({ ...base, distance: 30, canPearl: false }), "shoot");
    assertEqual(championPlan({ ...base, health: 0.2 }), "drink");
    assertEqual(championPlan({ ...base, health: 0.2, potions: 0 }), "melee");
    assertEqual(championPlan({ ...base, role: "sorcerer", distance: 12 }), "cast");
    assertEqual(championPlan({ ...base, role: "sorcerer", distance: 3 }), "blink");
    assertEqual(championPlan({ ...base, role: "retainer", distance: 14 }), "melee");
  },
  "tiers make champions tougher, and retainers stay simple": () => {
    assertEqual(tierStats(1).bonusHearts, 0);
    assertEqual(tierStats(5).bonusHearts, 40);
    assertEqual(tierStats(99).tier, 5);
    assertEqual(tierStats(1).potions, 1);
    assertEqual(tierStats(5).potions, 3);
    assertEqual(tierStats(4, "retainer").potions, 0);
    assert(tierStats(5).shotEvery < tierStats(1).shotEvery, "sharper shots");
  },
  "the shield comes down on a rhythm, and an axe breaks it": () => {
    const s = tierStats(2);
    assert(guardIsUp(0, s, 0), "starts raised");
    assert(!guardIsUp(s.guardUp, s, 0), "then an opening");
    assert(guardIsUp(s.guardUp + s.guardDown, s, 0), "then up again");
    assert(!guardIsUp(0, s, 50), "broken");
    assert(isAxe("minecraft:iron_axe") && !isAxe("minecraft:iron_pickaxe") && !isAxe(undefined));
  },
});
