// Guards walk to their posts (Mateo, 2026-11-12), and back to the Barracks when their watch ends.
//
// Bedrock gives scripts no "walk to this spot", so a walking guard chases a hidden marker (siege:post_marker) that
// this file keeps up to WALK.lead blocks ahead of it on the way, resting on the ground. Its walk group
// (tools/build_guard_walk.py) makes it target only its own marker. Every half second:
//   - arrived (within WALK.arrive): it is set exactly on the spot, faces out, and the walk ends
//   - an enemy within WALK.enemy blocks: it stops walking and fights from where it is (an Archer shoots, a
//     Man-at-Arms charges), and walks on WALK.calm seconds after the last enemy is gone
//   - a siege on its settlement: it runs (Speed), and a guard further than WALK.far blocks away is put on its spot
//     straight away so the wall is never bare
//   - no closer for WALK.stuck seconds (no way through): it is put on its spot
//   - a watchtower lookout (dest.climb): at the foot of the tower it is put up on the deck (the ladder is inside)
// No marker slot free (more than WALK.slots guards walking at once) also puts it straight on its spot.

import { world, system } from "@minecraft/server";
import { getState, underAttack, wanted, WANTED_TAG, onTick } from "../siege/api.js";
import { standY } from "./ground.js";

export const WALK = {
  slots: 24, // keep in step with WALK_SLOTS in tools/build_guard_walk.py
  lead: 14, // how far ahead of the guard the marker goes
  arrive: 1.3,
  enemy: 14,
  calm: 3,
  far: 80,
  stuck: 20,
  climb: 4.5, // a post up a ladder (a watchtower's lookout, dest.climb): this close to it on the ground, the guard climbs up
  every: 10, // ticks between checks
};

const MARKER = "siege:post_marker";
const walkers = new Map(); // guard id -> { owner, dest: { x, y, z, yaw }, slot, marker, best, bestTick, paused, calmAt, done }
const slotOwner = new Array(WALK.slots).fill(null);

const dim = () => world.getDimension("minecraft:overworld");
const entityById = (id) => { try { return world.getEntity(id); } catch { return undefined; } };
export const isWalking = (guard) => walkers.has(guard.id);
export const walkingCount = () => walkers.size;

// Pure: where the marker goes, `lead` blocks from the guard toward the destination (or the destination itself)
export function leadPoint(from, to, lead = WALK.lead) {
  const dx = to.x - from.x, dz = to.z - from.z, d = Math.hypot(dx, dz);
  if (d <= lead) return { x: to.x, z: to.z, last: true };
  return { x: from.x + (dx / d) * lead, z: from.z + (dz / d) * lead, last: false };
}

function setOn(guard, dest) {
  try { guard.teleport({ x: dest.x, y: dest.y, z: dest.z }, { rotation: { x: 0, y: dest.yaw ?? 0 } }); } catch { /* unloaded */ }
}

function stopWalking(guard, w, arrived) {
  walkers.delete(guard.id);
  if (w.slot >= 0) slotOwner[w.slot] = null;
  try { entityById(w.marker)?.remove(); } catch { /* gone */ }
  try {
    guard.setDynamicProperty("siege:walking", undefined);
    guard.triggerEvent("siege:fight");
    guard.removeEffect("speed");
  } catch { /* gone */ }
  if (arrived) {
    setOn(guard, w.dest);
    if (w.salute) try { guard.playAnimation("animation.hc.guard.salute", { blendOutTime: 0.3 }); } catch { /* older engine */ }
  }
  w.done?.(arrived);
}

// Send a guard walking to dest ({ x, y, z } = the middle of the block it stands on, feet height; yaw = facing on
// arrival). The caller has already set its post (siege:post) to dest. Returns false if it was put there at once.
// noJump (soldiers at war, warwrit/army.js): never put it there by teleport. With no slot free it doesn't start,
// and stuck or far it just stops where it is.
export function walkTo(guard, owner, dest, { salute = false, done, noJump = false } = {}) {
  const old = walkers.get(guard.id);
  if (old) stopWalking(guard, old, false);
  const loc = guard.location;
  const d = Math.hypot(loc.x - dest.x, loc.z - dest.z);
  if (d <= WALK.arrive + 0.5) { setOn(guard, dest); done?.(true); return false; }
  const slot = slotOwner.indexOf(null);
  const besieged = sieged(owner);
  if (noJump && slot < 0) return false;
  if (slot < 0 || (besieged && d > WALK.far && !noJump)) {
    setOn(guard, dest);
    if (salute) try { guard.playAnimation("animation.hc.guard.salute", { blendOutTime: 0.3 }); } catch { /* fine */ }
    done?.(true);
    return false;
  }
  let marker;
  try {
    marker = dim().spawnEntity(MARKER, { x: dest.x, y: dest.y, z: dest.z });
    marker.addTag(`siege_mark_${slot}`);
  } catch {
    setOn(guard, dest); done?.(true); return false;
  }
  slotOwner[slot] = guard.id;
  walkers.set(guard.id, { owner, dest, slot, marker: marker.id, best: d, bestTick: system.currentTick, paused: false, calmAt: 0, salute, done, noJump });
  guard.setDynamicProperty("siege:walking", 1);
  guard.triggerEvent(`siege:walk_${slot}`);
  return true;
}

export function cancelWalk(guardId) {
  const w = walkers.get(guardId);
  if (!w) return;
  const guard = entityById(guardId);
  if (guard) stopWalking(guard, w, false);
  else { walkers.delete(guardId); if (w.slot >= 0) slotOwner[w.slot] = null; try { entityById(w.marker)?.remove(); } catch { /* gone */ } }
}

const sieged = (owner) => { const s = getState(); return !!(s?.active && s.besieged?.includes(owner)); };

// Anything a guard would fight, near it
function enemyNear(guard, owner) {
  const at = guard.location;
  try {
    const hostile = guard.dimension.getEntities({ location: at, maxDistance: WALK.enemy, families: ["monster"] })
      .some((e) => e.typeId !== "minecraft:creeper");
    if (hostile) return true;
    return guard.dimension.getPlayers({ location: at, maxDistance: WALK.enemy, tags: [WANTED_TAG] })
      .some((p) => wanted.get(p.id)?.owner === owner);
  } catch {
    return false;
  }
}

function step(id, w) {
  const guard = entityById(id);
  if (!guard) { // unloaded or gone: the guard's own post brings it back when it loads (see walk restart in index.js)
    walkers.delete(id);
    if (w.slot >= 0) slotOwner[w.slot] = null;
    try { entityById(w.marker)?.remove(); } catch { /* gone */ }
    return;
  }
  const loc = guard.location, now = system.currentTick;
  const d = Math.hypot(loc.x - w.dest.x, loc.z - w.dest.z);
  if (d <= WALK.arrive && Math.abs(loc.y - w.dest.y) < 2.5) return stopWalking(guard, w, true);
  const besieged = sieged(w.owner);
  if (besieged && d > WALK.far && !w.noJump) return stopWalking(guard, w, true);
  // trouble on the way: fight first, then walk on
  if (enemyNear(guard, w.owner)) {
    w.calmAt = now + WALK.calm * 20;
    if (!w.paused) { w.paused = true; try { guard.triggerEvent("siege:fight"); } catch { /* fine */ } }
    return;
  }
  if (w.paused) {
    if (now < w.calmAt) return;
    w.paused = false;
    w.best = d; w.bestTick = now;
    try { guard.triggerEvent(`siege:walk_${w.slot}`); } catch { /* fine */ }
  }
  if (besieged || underAttack(w.owner)) try { guard.addEffect("speed", WALK.every + 10, { amplifier: 1, showParticles: false }); } catch { /* fine */ }
  // at the foot of a watchtower: up the ladder and out through the hatch onto the lookout
  if (w.dest.climb && d <= WALK.climb && w.dest.y - loc.y > 2.5) return stopWalking(guard, w, true);
  if (d < w.best - 1) { w.best = d; w.bestTick = now; }
  else if (now - w.bestTick > WALK.stuck * 20) return stopWalking(guard, w, !w.noJump);
  // keep the marker ahead, on the ground
  const p = leadPoint(loc, w.dest);
  let y = w.dest.y;
  if (!p.last) {
    const gy = standY(Math.floor(p.x), Math.floor(p.z), Math.max(Math.floor(loc.y), Math.floor(w.dest.y)) + 6);
    if (gy !== undefined) y = gy;
  }
  try { entityById(w.marker)?.teleport({ x: p.last ? w.dest.x : Math.floor(p.x) + 0.5, y: y + 0.1, z: p.last ? w.dest.z : Math.floor(p.z) + 0.5 }); } catch { /* fine */ }
}

onTick("guard_walk", WALK.every, () => {
  for (const [id, w] of [...walkers]) {
    try { step(id, w); } catch (e) { console.warn(`[Hollow Crown] guard walk: ${e}`); }
  }
});

// Markers left over from before a restart: nobody is chasing them
export function sweepMarkers() {
  try {
    const live = new Set([...walkers.values()].map((w) => w.marker));
    for (const m of dim().getEntities({ type: MARKER })) if (!live.has(m.id)) m.remove();
  } catch { /* fine */ }
}
