// Guards that hold their own against wild creatures (Mateo's playtest 2026-11-14: two Ash Scarabs killed his guards).
//
// What went wrong: a stationed guard was pulled back to its post every two seconds whenever no siege was on, so a
// Man-at-Arms chasing a scarab two blocks away was teleported off it before it could swing, and an Archer had no
// blade at all for a scarab at its feet. Now:
//   1. Fighting: a guard with a creature near it may leave its post as far as GUARD_CARE.chase to finish the fight
//      (siege/guards.js asks fightingNear before pulling it back).
//   2. Riposte: a guard struck in melee by a creature strikes straight back with a short blade, at most once a second.
//      That's how an Archer deals with a scarab under its bow.
//   3. Mending: a guard that hasn't been hurt for GUARD_CARE.calm seconds heals GUARD_CARE.mend health every guard
//      tick (two seconds), so a guard that won one fight starts the next one whole.
//   4. Health: the Man-at-Arms and Archer have twice the health they had (entities/man_at_arms.json, archer.json).
//   5. Each creature's blow on a guard: guarddamage_data.js has a line for every creature that fights guards, and
//      the damage it does to a guard (any guard or soldier) is scaled to that line. Players take the full blow.
// Ash Scarab burns stay for players only (bestiary/mobs.js).

import { world, system } from "@minecraft/server";
import { GUARD_TYPES } from "./constants.js";
import { addTests, assert, assertEqual } from "../core/tests.js";
import { GUARD_DAMAGE } from "./guarddamage_data.js";

export const GUARD_CARE = {
  chase: 12, // how far from its post a guard may go while a creature is near it
  watch: 16, // a creature this close counts as a fight
  riposte: { "siege:archer": 4, default: 3 }, // the strike-back, in health
  riposteReach: 3.5, // only for blows from this close (a melee hit, not an arrow)
  riposteGap: 20, // ticks between one guard's ripostes
  calm: 8, // seconds since the last hurt before a guard mends
  mend: 2, // health healed every guard tick while calm
};

const isGuardType = (typeId) => typeId in GUARD_TYPES;
const lastHurt = new Map(); // guard id -> tick it was last hurt
const lastRiposte = new Map(); // guard id -> tick it last struck back

// A creature a guard would fight: any monster except a creeper (same as the guards' own targeting)
export const isFoe = (entity) => {
  try {
    return entity.typeId !== "minecraft:creeper" && entity.typeId !== "minecraft:player" && !isGuardType(entity.typeId)
      && !!entity.matches?.({ families: ["monster"] });
  } catch {
    return false;
  }
};

export function fightingNear(guard) {
  try {
    return guard.dimension.getEntities({ location: guard.location, maxDistance: GUARD_CARE.watch, families: ["monster"] })
      .some((e) => e.typeId !== "minecraft:creeper" && !isGuardType(e.typeId));
  } catch {
    return false;
  }
}

// How far a guard may be from its post before it's brought back. base is the usual leash; a fight stretches it.
export const leashFor = (base, fighting) => (fighting ? Math.max(base, GUARD_CARE.chase) : base);

export const riposteFor = (typeId) => GUARD_CARE.riposte[typeId] ?? GUARD_CARE.riposte.default;

// Should this hurt make the guard strike back? (pure, for the tests)
export function shouldRiposte({ guardType, foe, distance, now, last }) {
  if (!isGuardType(guardType) || !foe) return false;
  if (distance > GUARD_CARE.riposteReach) return false;
  return last === undefined || now - last >= GUARD_CARE.riposteGap;
}

export const calmFor = (now, hurtAt) => hurtAt === undefined || now - hurtAt >= GUARD_CARE.calm * 20;

// What a blow of `damage` from this creature does to a guard (pure). Creatures without a line hit as usual.
export function guardBlow(attackerType, damage) {
  const line = GUARD_DAMAGE[attackerType];
  if (!line || !(damage > 0) || !(line.base > 0)) return damage;
  return Math.max(0.5, Math.round((damage * line.guard) / line.base * 2) / 2);
}

// Where the game lets a script change a blow before it lands, change it there; otherwise give the difference back after.
let scaledBefore = false;
try {
  world.beforeEvents.entityHurt?.subscribe((event) => {
    try {
      if (!isGuardType(event.hurtEntity.typeId)) return;
      const by = event.damageSource?.damagingEntity;
      if (by && GUARD_DAMAGE[by.typeId]) event.damage = guardBlow(by.typeId, event.damage);
    } catch { /* gone */ }
  });
  scaledBefore = !!world.beforeEvents.entityHurt;
} catch {
  scaledBefore = false; // older script engine
}

world.afterEvents.entityHurt.subscribe((event) => {
  const guard = event.hurtEntity;
  try {
    if (!isGuardType(guard.typeId)) return;
    const now = system.currentTick;
    lastHurt.set(guard.id, now);
    const hitter = event.damageSource.damagingEntity;
    if (!scaledBefore && hitter && GUARD_DAMAGE[hitter.typeId]) {
      const back = event.damage - guardBlow(hitter.typeId, event.damage);
      const hp = guard.getComponent("minecraft:health");
      if (back > 0 && hp && hp.currentValue > 0) hp.setCurrentValue(Math.min(hp.effectiveMax, hp.currentValue + back));
    }
    const by = event.damageSource.damagingEntity;
    if (!by || event.damageSource.cause !== "entityAttack") return;
    const a = guard.location, b = by.location;
    const distance = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    if (!shouldRiposte({ guardType: guard.typeId, foe: isFoe(by), distance, now, last: lastRiposte.get(guard.id) })) return;
    lastRiposte.set(guard.id, now);
    by.applyDamage(riposteFor(guard.typeId), { cause: "entityAttack", damagingEntity: guard });
  } catch {
    // guard or attacker gone
  }
});

// Called for each guard from siege/guards.js guardTick (every two seconds)
export function mendGuard(guard) {
  try {
    if (!calmFor(system.currentTick, lastHurt.get(guard.id))) return;
    const hp = guard.getComponent("minecraft:health");
    if (hp && hp.currentValue > 0 && hp.currentValue < hp.effectiveMax) hp.setCurrentValue(Math.min(hp.effectiveMax, hp.currentValue + GUARD_CARE.mend));
  } catch {
    // guard gone
  }
}

world.afterEvents.entityDie.subscribe((event) => {
  const id = event.deadEntity?.id;
  if (id) { lastHurt.delete(id); lastRiposte.delete(id); }
});

addTests("guards", {
  "a guard in a fight may chase further than its post's leash": () => {
    assertEqual(leashFor(2.5, false), 2.5, "standing post, quiet");
    assertEqual(leashFor(2.5, true), GUARD_CARE.chase, "standing post, fighting");
    assertEqual(leashFor(5, true), GUARD_CARE.chase, "Barracks guard, fighting");
    assertEqual(leashFor(80, true), 80, "never shortens a longer leash");
    assert(GUARD_CARE.chase >= 10, "far enough to catch a scarab");
  },
  "a guard bitten by a creature strikes back, at most once a second": () => {
    const hit = { guardType: "siege:archer", foe: true, distance: 1.2, now: 100, last: undefined };
    assert(shouldRiposte(hit), "first bite");
    assert(!shouldRiposte({ ...hit, last: 90 }), "too soon");
    assert(shouldRiposte({ ...hit, last: 100 - GUARD_CARE.riposteGap }), "a second later");
    assert(!shouldRiposte({ ...hit, foe: false }), "not at players or friends");
    assert(!shouldRiposte({ ...hit, distance: 10 }), "not at an archer far away");
    assert(!shouldRiposte({ ...hit, guardType: "siege:ash_scarab" }), "only guards");
    assert(riposteFor("siege:archer") >= 4 && riposteFor("siege:man_at_arms") >= 3, "a scarab dies in two");
  },
  "each creature hits a guard by its own line": () => {
    assertEqual(guardBlow("siege:ash_scarab", 2), 1, "a scarab bite is half on a guard");
    assertEqual(guardBlow("siege:ash_scarab", 3), 1.5, "and still half on Hard");
    assertEqual(guardBlow("siege:pretender_brute", 13), 13, "bosses hit full");
    assertEqual(guardBlow("minecraft:vindicator", 13), 7, "vanilla axes brought into line");
    assertEqual(guardBlow("siege:not_listed", 5), 5, "no line: as usual");
    assertEqual(guardBlow("siege:hollow_crow", 0.4), 0.5, "never less than half a heart");
    for (const [id, l] of Object.entries(GUARD_DAMAGE)) assert(l.base > 0 && l.guard > 0 && l.guard <= l.base * 1.5, id);
  },
  "a guard mends once it's been left alone a while": () => {
    assert(calmFor(1000, undefined));
    assert(!calmFor(1000, 1000 - 20));
    assert(calmFor(1000, 1000 - GUARD_CARE.calm * 20));
  },
});
