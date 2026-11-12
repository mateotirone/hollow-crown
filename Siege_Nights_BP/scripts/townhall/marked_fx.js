// How the Sorcerer's powers look and sound: the cast moves, the siege:arc_* particles and the cast.* sounds.
// Pack files come from tools/build_sorcerer_fx.py; notes in docs/SORCERER-FX.md. Everything here is cosmetic
// and never throws, so a power still works if a particle or an animation is missing.

import { MolangVariableMap } from "@minecraft/server";
import { sfx } from "../core/sfx.js";

// skill id -> short key used by the animation, sound and spell icon names
export const POWER_KEY = {
  arc_bolt: "bolt", arc_ward: "ward", arc_blink: "blink", arc_echo: "echo",
  arc_bind: "bind", arc_step: "step", arc_choir: "choir", arc_hollowstep: "hollowstep",
};

export const castAnimation = (key) => `animation.siege.player.cast.${key}`;
export const castSound = (key) => `cast.${key}`;

/** Play a cast move on the player (third person in full, a small push in first person). */
export function castMove(player, key) {
  try {
    player.playAnimation(castAnimation(key), { controller: "siege_cast", blendOutTime: 0.15, stopExpression: "query.any_animation_finished" });
  } catch {
    // an engine without playAnimation: the power still works
  }
}

/** Move + sound for a power, heard by everyone nearby. */
export function castFx(player, key, at = player.location) {
  castMove(player, key);
  sfx(player.dimension, castSound(key), at);
}

export function puff(dim, id, at, floats) {
  try {
    if (floats) {
      const vars = new MolangVariableMap();
      for (const [name, value] of Object.entries(floats)) vars.setFloat(name, value);
      dim.spawnParticle(id, at, vars);
    } else dim.spawnParticle(id, at);
  } catch {
    // unloaded chunk, or the particle is missing
  }
}

/** Beads of a particle from one spot to another. */
export function beads(dim, from, to, id, step = 0.5) {
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  const len = Math.hypot(dx, dy, dz);
  for (let d = 0.8; d < len; d += step) puff(dim, id, { x: from.x + (dx / len) * d, y: from.y + (dy / len) * d, z: from.z + (dz / len) * d });
}

/** A ring spreading over the ground to `size` blocks across. */
export const ring = (dim, at, size) => puff(dim, "siege:arc_ring", { x: at.x, y: at.y + 0.15, z: at.z }, { "variable.ring_size": size });

/** Where the Ember sits in the right hand, roughly (for the smoulder). */
export function handSpot(player) {
  const v = player.getViewDirection();
  const flat = Math.hypot(v.x, v.z) || 1;
  const fx = v.x / flat, fz = v.z / flat;
  // facing +z the right hand is toward -x: right = (-fz, fx)
  return { x: player.location.x - fz * 0.38 + fx * 0.35, y: player.location.y + (player.isSneaking ? 0.85 : 1.1), z: player.location.z + fx * 0.38 + fz * 0.35 };
}

/** One second of sparks off the Ember in hand: more of them, the louder you are. */
export const smoulder = (player, resonance) => puff(player.dimension, "siege:arc_smoulder", handSpot(player), { "variable.ember_rate": 2 + resonance / 8 });
