// What the new mobs do beyond walking and biting. Their bodies, health and targets are data
// (entities/bestiary/*.json, generated from studio/bestiary/roster.py); the tricks are here.
//
// Every 10 ticks we look at each "scripted" mob near a player and run its trick.

import { world } from "@minecraft/server";
import { onTick, addTests, assert } from "../siege/api.js";
import { MOBS } from "./data.js";
import { activeDimensions, addToPlayerList, alive, announce, effect, flat, heal, heroOf, hurt, isLookingAt, particle, pickOne, ring, shove, sound, watchedBy } from "./util.js";

const STEP = 10;
let clock = 0;
const every = (ticks, entity) => (clock + (entity.id.charCodeAt(entity.id.length - 1) % 4) * STEP) % ticks < STEP; // staggered per mob
const FLAMMABLE = /planks|log|wood|wool|fence|hay|bookshelf|leaves|carpet|door|trapdoor|timber/;
const LOUD = 70; // a Marked player's Resonance at or above this is "loud" (town hall thread's number)

const TRICKS = {
  // Rings its bell: raiders nearby march faster and hit harder. It runs from you (that part is data).
  "siege:bell_ringer": (e, dim) => {
    if (!every(60, e)) return;
    sound(dim, "block.bell.hit", e.location, 1.2, 1.5);
    particle(dim, "minecraft:note_particle", { x: e.location.x, y: e.location.y + 2.6, z: e.location.z });
    for (const r of dim.getEntities({ families: ["siege_raider"], location: e.location, maxDistance: 10 })) {
      if (r.id === e.id) continue;
      effect(r, "speed", 100, 0, true); effect(r, "strength", 100, 0, true);
    }
  },

  // Sets fire to wooden things it walks past
  "siege:torchbearer": (e, dim) => {
    if (!every(40, e)) return;
    const v = e.getViewDirection();
    for (const reach of [1, 2]) {
      const at = { x: Math.floor(e.location.x + v.x * reach), y: Math.floor(e.location.y), z: Math.floor(e.location.z + v.z * reach) };
      for (const dy of [0, 1]) {
        const block = dim.getBlock({ ...at, y: at.y + dy });
        if (!block || !FLAMMABLE.test(block.typeId)) continue;
        const above = block.above();
        if (above?.isAir) { above.setType("minecraft:fire"); return; }
      }
    }
  },

  // Calls Hollow Crows while a player is in range
  "siege:crow_mage": (e, dim, players) => {
    if (!every(160, e) || !players.some((p) => flat(p.location, e.location) < 18)) return;
    if (dim.getEntities({ type: "siege:hollow_crow", location: e.location, maxDistance: 20 }).length >= 6) return;
    ring(dim, e.location, 1.2, "minecraft:basic_smoke_particle", 10);
    for (let i = 0; i < 2; i++) dim.spawnEntity("siege:hollow_crow", { x: e.location.x, y: e.location.y + 2.5, z: e.location.z });
  },

  // Harmless while you watch it. Look away and it is closer. Let it reach you unseen and it strikes.
  "siege:lost_villager": (e, dim, players) => {
    const near = players.filter((p) => flat(p.location, e.location) < 14);
    if (!near.length) return;
    if (watchedBy(e, near)) return effect(e, "slowness", 15, 255);
    const prey = near.reduce((a, b) => (flat(a.location, e.location) < flat(b.location, e.location) ? a : b));
    const d = flat(prey.location, e.location);
    if (d < 1.8) {
      hurt(prey, 6, "entityAttack", e); effect(prey, "darkness", 60, 0);
      sound(dim, "mob.villager.no", e.location, 0.5);
      return;
    }
    const step = Math.min(1.2, d - 1.2);
    const to = { x: e.location.x + ((prey.location.x - e.location.x) / d) * step, y: e.location.y, z: e.location.z + ((prey.location.z - e.location.z) / d) * step };
    try {
      if (dim.getBlock({ x: Math.floor(to.x), y: Math.floor(to.y), z: Math.floor(to.z) })?.isAir) e.teleport(to, { facingLocation: prey.location });
    } catch {
      // can't step there
    }
  },

  // Passes for a villager until you turn your back within a few blocks (or hit it)
  "siege:changeling": (e, dim, players) => {
    if (e.getComponent("variant")?.value !== 0) return;
    const near = players.filter((p) => flat(p.location, e.location) < 5);
    if (near.length && !watchedBy(e, near) && every(40, e)) {
      e.triggerEvent("siege:reveal");
      sound(dim, "mob.villager.death", e.location, 0.4);
    }
  },

  // Only moves when nobody is looking. Watched, it is stone: frozen, and very hard to hurt.
  "siege:wrongling": (e, dim, players) => {
    const watcher = watchedBy(e, players, 40);
    if (watcher) {
      effect(e, "slowness", 15, 255); effect(e, "weakness", 15, 255);
      e.addTag("siege_watched");
    } else if (e.hasTag("siege_watched")) {
      e.removeTag("siege_watched");
    }
  },

  // A carved mourner. Stone while anyone can see it; a player who has been blinded doesn't count as looking.
  "siege:stone_vigil": (e, dim, players) => {
    const watcher = watchedBy(e, players.filter(canSee), 48);
    if (watcher) {
      effect(e, "slowness", 15, 255); effect(e, "weakness", 15, 255);
      e.addTag("siege_watched");
    } else {
      if (e.hasTag("siege_watched")) e.removeTag("siege_watched");
      if (every(20, e) && players.some((p) => flat(p.location, e.location) < 24)) sound(dim, "step.stone", e.location, 0.9, 0.5); // stone dragging on stone, somewhere behind you
    }
  },

  // Blind. Hunts the hum of a loud Marked player from far away.
  "siege:echo_hound": (e, dim, players) => {
    if (!every(20, e)) return;
    let prey, best = 64;
    for (const p of players) {
      const hero = heroOf(p);
      if (hero.path !== "marked" || (hero.resonance ?? 0) < LOUD) continue;
      const d = flat(p.location, e.location);
      if (d < best) { best = d; prey = p; }
    }
    if (!prey || best < 9) return; // close enough: its own nose takes over
    try { e.applyImpulse({ x: ((prey.location.x - e.location.x) / best) * 0.45, y: 0, z: ((prey.location.z - e.location.z) / best) * 0.45 }); } catch { /* unloaded */ }
    effect(e, "speed", 40, 1);
  },

  // Its bell is the Choir's toll: slows you and darkens the world
  "siege:tolling_shade": (e, dim, players) => {
    if (!every(100, e)) return;
    const near = players.filter((p) => flat(p.location, e.location) < 9);
    if (!near.length) return;
    sound(dim, "block.bell.hit", e.location, 0.5, 1.5);
    ring(dim, e.location, 3, "minecraft:sculk_soul_particle", 12);
    for (const p of near) { effect(p, "slowness", 80, 0); effect(p, "darkness", 60, 0); }
  },

  // Feels your footsteps. Keep moving and it erupts under you; stand still (or sneak) and it loses you.
  "siege:dune_wyrm": (e, dim, players) => {
    if (!every(240, e)) return;
    const prey = players.find((p) => {
      const d = flat(p.location, e.location);
      const v = p.getVelocity();
      return d > 5 && d < 22 && Math.hypot(v.x, v.z) > 0.05 && !p.isSneaking;
    });
    if (!prey) return;
    const at = { ...prey.location };
    prey.onScreenDisplay.setActionBar("§6The sand is moving under you...");
    wyrmStrikes.push({ wyrm: e, dim, at, when: clock + 30 });
  },

  // Lays a hex on the nearest player
  "siege:bog_hag": (e, dim, players) => {
    if (!every(200, e)) return;
    const prey = players.find((p) => flat(p.location, e.location) < 12);
    if (!prey) return;
    effect(prey, pickOne(["weakness", "hunger", "nausea", "mining_fatigue"]), 140, 0, true);
    particle(dim, "minecraft:villager_angry", prey.getHeadLocation());
    sound(dim, "mob.witch.celebrate", e.location, 0.8);
  },

  // Tongue: yanks you in from up to six blocks
  "siege:mire_toad": (e, dim, players) => {
    if (!every(80, e)) return;
    const prey = players.find((p) => { const d = flat(p.location, e.location); return d > 2 && d < 6.5; });
    if (!prey) return;
    shove(prey, e.location.x - prey.location.x, e.location.z - prey.location.z, 1.3, 0.25);
    sound(dim, "mob.frog.tongue", e.location, 0.7);
  },

  // Anti-magic aura: Marked players nearby are silenced (the spell code reads the tag)
  "siege:inquisitor": (e, dim, players) => {
    for (const p of players) {
      if (flat(p.location, e.location) > 10 || heroOf(p).path !== "marked") continue;
      silenced.set(p.id, clock + 60);
      if (!p.hasTag("siege_silenced")) {
        p.addTag("siege_silenced");
        p.onScreenDisplay.setActionBar("§7An Inquisitor is near. The Ember goes quiet.");
      }
    }
  },
};

const RULER_TAG = "siege_hollow_ruler"; // set on whoever rules the Hollow (that feature is not built yet)
const HOLLOW_TRICKS = ["siege:lost_villager", "siege:changeling", "siege:wrongling", "siege:stone_vigil", "siege:echo_hound", "siege:tolling_shade"];
const wyrmStrikes = [];

function canSee(player) {
  try {
    return !player.getEffect("blindness") && !player.getEffect("darkness");
  } catch {
    return true;
  }
}

// Where a Stone Vigil's touch puts you: solid ground with headroom, 10 to 20 blocks off. Pure, so it can be tested.
export function castAwaySpot(from, isSolid, rolls) {
  for (let i = 0; i + 1 < rolls.length; i += 2) {
    const a = rolls[i] * Math.PI * 2, d = 10 + rolls[i + 1] * 10;
    const x = Math.floor(from.x + Math.cos(a) * d), z = Math.floor(from.z + Math.sin(a) * d);
    for (let dy = 5; dy >= -5; dy--) {
      const y = Math.floor(from.y) + dy;
      if (isSolid(x, y - 1, z) && !isSolid(x, y, z) && !isSolid(x, y + 1, z)) return { x: x + 0.5, y, z: z + 0.5 };
    }
  }
  return undefined;
}

function castAway(player, vigil) {
  const dim = player.dimension;
  const solid = (x, y, z) => {
    try {
      const b = dim.getBlock({ x, y, z });
      return !b || (!b.isAir && !b.isLiquid); // unloaded counts as solid, so we never throw anyone into it
    } catch {
      return true;
    }
  };
  const spot = castAwaySpot(player.location, solid, Array.from({ length: 16 }, Math.random));
  effect(player, "darkness", 100, 0);
  if (!spot) return;
  particle(dim, "minecraft:large_smoke", player.getHeadLocation());
  player.teleport(spot, { dimension: dim, facingLocation: vigil.location });
  sound(dim, "block.bell.hit", spot, 0.5, 0.4);
}
const silenced = new Map(); // player id -> clock when the silence lifts

function mobTick() {
  clock += STEP;
  for (const dim of activeDimensions()) {
    let mobs = [];
    try {
      mobs = dim.getEntities({ families: ["siege_scripted"] });
    } catch {
      continue;
    }
    if (!mobs.length) continue;
    const players = dim.getPlayers().filter((p) => p.getGameMode?.() !== "Spectator");
    const prey = players.filter((p) => !p.hasTag(RULER_TAG)); // Hollow things leave the Hollow's ruler alone
    for (const e of mobs) {
      try {
        if (!e.hasTag("siege_showcase")) TRICKS[e.typeId]?.(e, dim, HOLLOW_TRICKS.includes(e.typeId) ? prey : players); // showcase statues stay put
      } catch {
        // mob unloaded mid-trick
      }
    }
  }
  // Wyrm eruptions that were telegraphed 1.5 seconds ago
  for (const s of wyrmStrikes.splice(0)) {
    if (s.when > clock) { wyrmStrikes.push(s); ring(s.dim, s.at, 3, "minecraft:basic_smoke_particle"); continue; }
    if (!alive(s.wyrm)) continue;
    try {
      s.wyrm.teleport(s.at);
      particle(s.dim, "minecraft:large_explosion", s.at);
      sound(s.dim, "mob.ravager.roar", s.at, 0.6);
      for (const p of s.dim.getPlayers({ location: s.at, maxDistance: 3.2 })) { hurt(p, 8, "entityAttack", s.wyrm); shove(p, 0, 0, 0, 0.9); }
    } catch {
      // spot unloaded
    }
  }
  // Path tags the Order's mobs target by, and the Inquisitor's silence wearing off
  for (const p of world.getPlayers()) {
    try {
      const marked = heroOf(p).path === "marked";
      if (marked !== p.hasTag("siege_marked")) marked ? p.addTag("siege_marked") : p.removeTag("siege_marked");
      if (p.hasTag("siege_silenced") && (silenced.get(p.id) ?? 0) <= clock) { p.removeTag("siege_silenced"); silenced.delete(p.id); }
    } catch {
      // player leaving
    }
  }
}
onTick("bestiary_mobs", STEP, mobTick);

// ---------- hits: things that happen when one of them lands a blow or takes one ----------
world.afterEvents.entityHurt.subscribe((event) => {
  const victim = event.hurtEntity, by = event.damageSource.damagingEntity;
  const cause = event.damageSource.cause;
  try {
    switch (by?.typeId) {
      case "siege:torchbearer": victim.setOnFire(4, true); break;
      case "siege:ash_scarab": victim.setOnFire(2, true); break;
      case "siege:barrow_wight": heal(by, 3); particle(by.dimension, "minecraft:villager_happy", by.getHeadLocation()); break; // every hit feeds it
      case "siege:stone_vigil": // its touch puts you somewhere else, in the dark
        if (victim.typeId === "minecraft:player") castAway(victim, by);
        break;
      case "siege:brine_lurker":
        effect(victim, "slowness", 60, 1);
        if (victim.isInWater) victim.applyImpulse?.({ x: 0, y: -0.6, z: 0 }); // drags you under
        break;
    }
    switch (victim.typeId) {
      case "siege:mire_toad": // its skin is poison
        if (cause === "entityAttack" && by) effect(by, "poison", 60, 0, true);
        break;
      case "siege:mirror_knight": { // learns whatever you hit it with last
        const ranged = cause === "projectile";
        victim.removeTag(ranged ? "siege_mirror_melee" : "siege_mirror_ranged");
        victim.addTag(ranged ? "siege_mirror_ranged" : "siege_mirror_melee");
        if (by && event.damage < 2.5) hurt(by, 3, ranged ? "projectile" : "thorns", victim); // a hit it already knows comes back
        break;
      }
      case "siege:ashen_squire": case "siege:ashen_knight": case "siege:inquisitor": // attack the Order and it remembers
        if (by?.typeId === "minecraft:player") by.addTag("siege_order_enemy");
        break;
    }
  } catch {
    // one of them is already gone
  }
});

// ---------- kills: first kills, the skill point trickle, and the lore thread's drops ----------
const TOME_MOBS = ["barrow_wight", "inquisitor", "ashen_knight", "lost_villager", "changeling", "tolling_shade"];
const TRICKLE_EVERY = 25;
export const countsForBestiary = (typeId) => !!MOBS[typeId] && !["boss", "boss_add", "boss_prop", "projectile", "summon"].includes(MOBS[typeId].family);

world.afterEvents.entityDie.subscribe((event) => {
  const dead = event.deadEntity;
  let typeId;
  try {
    typeId = dead.typeId;
  } catch {
    return;
  }
  if (!countsForBestiary(typeId)) return;
  const killer = event.damageSource.damagingEntity?.typeId === "minecraft:player" ? event.damageSource.damagingEntity : undefined;
  const short = typeId.slice("siege:".length);
  if (TOME_MOBS.includes(short)) {
    let at = { x: 0, y: 0, z: 0 }, dimension = "minecraft:overworld";
    try { at = dead.location; dimension = dead.dimension.id; } catch { /* already unloaded */ }
    announce("siege:mob_killed", { mob: short, x: Math.floor(at.x), y: Math.floor(at.y), z: Math.floor(at.z), dimension, ...(killer ? { killer: killer.id } : {}) });
  }
  if (!killer) return;
  if (addToPlayerList(killer, "siege:bestiary_seen", short)) {
    killer.sendMessage(`§6New foe: §f${MOBS[typeId].name}§7. ${MOBS[typeId].lore}`);
    announce("siege:award_skill_points", { player: killer.id, points: 1, renown: 20, reason: `first_kill:${typeId}` });
  }
  const kills = (killer.getDynamicProperty("siege:bestiary_kills") ?? 0) + 1;
  killer.setDynamicProperty("siege:bestiary_kills", kills);
  if (kills % TRICKLE_EVERY === 0) announce("siege:award_skill_points", { player: killer.id, points: 1, reason: "mob_trickle" });
  else announce("siege:award_skill_points", { player: killer.id, points: 0, renown: 5, reason: "mob_kill" });
});

addTests("bestiary", {
  "every scripted trick belongs to a real mob": () => {
    for (const id of Object.keys(TRICKS)) assert(MOBS[id], `${id} has a trick but no entity`);
  },
  "looking at something is about direction, not distance": () => {
    const eye = { x: 0, y: 1.6, z: 0 }, north = { x: 0, y: 0, z: -1 };
    assert(isLookingAt(eye, north, { x: 0, y: 1.6, z: -20 }), "straight ahead");
    assert(isLookingAt(eye, north, { x: 3, y: 1.6, z: -10 }), "a little to the side");
    assert(!isLookingAt(eye, north, { x: 0, y: 1.6, z: 10 }), "behind you");
    assert(!isLookingAt(eye, north, { x: 10, y: 1.6, z: 0 }), "beside you");
  },
  "a Stone Vigil's touch only ever lands you on solid ground with headroom": () => {
    const floor = (x, y, z) => y <= 63; // flat world, ground at 63
    const spot = castAwaySpot({ x: 0.5, y: 64, z: 0.5 }, floor, [0.25, 0.5]);
    assert(spot && spot.y === 64, "lands on the ground");
    const far = Math.hypot(spot.x - 0.5, spot.z - 0.5);
    assert(far >= 9 && far <= 21, "10 to 20 blocks away");
    assert(castAwaySpot({ x: 0, y: 64, z: 0 }, () => false, [0.1, 0.9, 0.6, 0.2]) === undefined, "open void: stay put");
    assert(castAwaySpot({ x: 0, y: 64, z: 0 }, () => true, [0.1, 0.9]) === undefined, "solid rock: stay put");
  },
  "bosses and fight props don't count as bestiary kills": () => {
    assert(countsForBestiary("siege:wrongling") && countsForBestiary("siege:frost_stag"));
    assert(!countsForBestiary("siege:clockwork_reeve") && !countsForBestiary("siege:chapel_bell") && !countsForBestiary("minecraft:zombie"));
  },
});
