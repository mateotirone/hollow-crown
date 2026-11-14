// How the Knight's techniques look and sound: the technique moves, the siege:kn_* particles, the kn.* sounds and
// the 3D objects (the Banner of the Keep, Crownbreaker's greatsword). Pack files come from tools/build_knight_fx.py;
// notes in docs/KNIGHT-FX.md. Everything here is cosmetic and never throws, so a technique still works without it.

import { system } from "@minecraft/server";
import { sfx } from "../core/sfx.js";
import { puff } from "./marked_fx.js";

/** Play a technique move (third person in full, half of it in first person). */
export function knightMove(player, key) {
  try {
    player.playAnimation(`animation.siege.player.knight.${key}`, { controller: "siege_knight", blendOutTime: 0.15, stopExpression: "query.any_animation_finished" });
  } catch {
    // an engine without playAnimation: the technique still works
  }
}

/** Flat facing (x, z) of a player's view. */
export function facing(player) {
  const v = player.getViewDirection();
  const flat = Math.hypot(v.x, v.z) || 1;
  return { x: v.x / flat, z: v.z / flat };
}

/** Grit thrown one way: off the shield face, or back off your heels on a dash. */
export const grit = (dim, at, dir) => puff(dim, "siege:kn_grit", at, { "variable.dx": dir.x, "variable.dz": dir.z });

/** A gold ring rolling out over the ground to `radius` blocks. */
export const goldRing = (dim, at, radius) => puff(dim, "siege:kn_ring", { x: at.x, y: at.y + 0.15, z: at.z }, { "variable.ring_size": radius });

/** Where the off-hand shield sits, roughly: in front and to the left at chest height. */
export function shieldSpot(player) {
  const f = facing(player);
  // facing +z the left hand is toward +x: left = (fz, -fx)
  return { x: player.location.x + f.x * 0.7 + f.z * 0.3, y: player.location.y + 1.1, z: player.location.z + f.z * 0.7 - f.x * 0.3 };
}

/** Where the sword hand is, roughly. */
export function swordSpot(player) {
  const f = facing(player);
  return { x: player.location.x + f.x * 0.4 - f.z * 0.38, y: player.location.y + (player.isSneaking ? 0.85 : 1.1), z: player.location.z + f.z * 0.4 + f.x * 0.38 };
}

// ---------- siege:knight_fx: the Banner of the Keep (form 0) and the falling greatsword (form 1) ----------
export const KNIGHT_FX = "siege:knight_fx";

function spawn(dim, form, at, yaw) {
  try {
    const e = dim.spawnEntity(`${KNIGHT_FX}<siege:form_${form}>`, at);
    if (yaw !== undefined) e.setRotation({ x: 0, y: yaw });
    return e;
  } catch {
    return undefined; // unloaded chunk, or a world without the pack: the technique still works
  }
}

export function play(e, animation) {
  try {
    if (e?.isValid) e.playAnimation(animation);
  } catch {
    // older engine
  }
}

export function remove(e) {
  try {
    if (e?.isValid) e.remove();
  } catch {
    // gone already
  }
}

/** The 10-block war banner, in the settlement's colour (0-15, siege/constants.js COLORS), facing `yaw`. */
export function plantBanner(dim, at, yaw, color = 14) {
  const e = spawn(dim, "banner", at, yaw);
  try {
    e?.setProperty("siege:color", Math.max(0, Math.min(15, color | 0)));
  } catch {
    // older pack
  }
  // it drops in from above (0.3 s) and slams down: dust thrown out from the foot, cracks round it
  system.runTimeout(() => {
    puff(dim, "siege:kn_dust", at);
    puff(dim, "siege:kn_cracks", { x: at.x, y: at.y + 0.05, z: at.z }, { "variable.ring_size": 1.6 });
  }, 6);
  return e;
}

/** The cloth furls, then the pole sinks back into the ground. */
export function strikeBanner(e, dim, at) {
  play(e, "animation.siege.knight_fx.banner_furl");
  sfx(dim, "kn.furl", at);
  system.runTimeout(() => play(e, "animation.siege.knight_fx.banner_sink"), 14);
  system.runTimeout(() => remove(e), 40);
}

/** Crownbreaker: a ghostly greatsword falls point first onto `at`; `land` runs as it strikes (6 ticks). */
export function dropGreatsword(dim, at, yaw, land) {
  const e = spawn(dim, "sword", at, yaw);
  system.runTimeout(() => {
    puff(dim, "siege:kn_cracks", { x: at.x, y: at.y + 0.05, z: at.z }, { "variable.ring_size": 1.5 });
    puff(dim, "siege:kn_parry", { x: at.x, y: at.y + 0.4, z: at.z });
    puff(dim, "siege:kn_parry", { x: at.x, y: at.y + 0.4, z: at.z });
    sfx(dim, "kn.crown", at);
    try {
      land();
    } catch {
      // the fight moved on
    }
  }, 6);
  system.runTimeout(() => play(e, "animation.siege.knight_fx.sword_fade"), 24);
  system.runTimeout(() => remove(e), 42);
  return e;
}
