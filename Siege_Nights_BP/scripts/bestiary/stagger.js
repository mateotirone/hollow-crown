// Stagger: bosses and heavy creatures still react a little when you hit them.
//
// Mateo 2026-11-13: "When you hit a mob they should knock back like vanilla". Ordinary creatures get vanilla knockback
// straight from the engine (minecraft:knockback_resistance 0). Bedrock rolls that number as a chance, not a fraction
// (0.6 = six hits in ten don't move it at all), so a partial value feels broken. Bosses (family siege_boss) and the big
// ones (siege_heavy: Siege Ogre, Gatebreaker, Dune Wyrm, Shieldwall Brute, Stone Vigil, Standing Rank) are set to 1
// instead, and this file gives them a small, steady shove away from whoever hit them in melee: they rock back, they
// don't fly. studio/bestiary/build.py writes the families; tools/check.mjs holds the rule for new creatures.

import { world } from "@minecraft/server";
import { addTests, assert } from "../siege/api.js";

// horizontal shove (blocks/tick) and lift; vanilla knockback is about 0.4 across and 0.4 up
export const STAGGER = { heavy: { across: 0.16, up: 0.05 }, boss: { across: 0.1, up: 0.03 } };
const SKIP_TAGS = ["siege_showcase", "siege_watched"]; // exhibits stay put; a watched Stone Vigil is stone

export function staggerKind(families) {
  if (families.includes("siege_boss")) return "boss";
  if (families.includes("siege_heavy")) return "heavy";
  return undefined;
}

// the impulse that pushes `target` away from `from`
export function staggerPush(from, target, kind) {
  const s = STAGGER[kind];
  if (!s) return undefined;
  let dx = target.x - from.x, dz = target.z - from.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.01) { dx = 1; dz = 0; } else { dx /= d; dz /= d; }
  return { x: dx * s.across, y: s.up, z: dz * s.across };
}

function familiesOf(e) {
  try { return e.getComponent("minecraft:type_family")?.getTypeFamilies?.() ?? []; } catch { return []; }
}

world.afterEvents.entityHurt.subscribe((event) => {
  const victim = event.hurtEntity, by = event.damageSource.damagingEntity;
  if (event.damageSource.cause !== "entityAttack" || by?.typeId !== "minecraft:player") return;
  try {
    if (!victim?.isValid || !victim.typeId.startsWith("siege:")) return;
    const kind = staggerKind(familiesOf(victim));
    if (!kind || SKIP_TAGS.some((t) => victim.hasTag(t))) return;
    if (victim.getComponent("minecraft:movement")?.currentValue === 0) return; // rooted: slowed to a stop or built not to move
    const push = staggerPush(by.location, victim.location, kind);
    if (push) victim.applyImpulse(push);
  } catch {
    // gone, or can't be moved right now
  }
});

addTests("bestiary", {
  "stagger: bosses and heavy creatures, nothing else": () => {
    assert(staggerKind(["monster", "mob", "hollow", "siege_boss"]) === "boss", "boss");
    assert(staggerKind(["monster", "mob", "siege_raider", "siege_heavy"]) === "heavy", "heavy");
    assert(staggerKind(["monster", "mob", "hollow", "siege_raider"]) === undefined, "ordinary creatures get the engine's knockback");
  },
  "stagger: pushes away from the hitter, gently": () => {
    const p = staggerPush({ x: 0, y: 64, z: 0 }, { x: 3, y: 64, z: 4 }, "heavy");
    assert(p.x > 0 && p.z > 0 && Math.abs(Math.hypot(p.x, p.z) - STAGGER.heavy.across) < 1e-9, "away, at heavy strength");
    assert(STAGGER.boss.across < STAGGER.heavy.across && STAGGER.heavy.across < 0.4, "bosses move least, both less than vanilla");
    const same = staggerPush({ x: 1, y: 0, z: 1 }, { x: 1, y: 0, z: 1 }, "boss");
    assert(Number.isFinite(same.x) && Number.isFinite(same.z), "standing on top of it still gives a direction");
  },
});
