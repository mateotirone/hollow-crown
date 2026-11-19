// What soldiers do when nobody needs them (Mateo, 2026-11-12).
//
// Day: an idle soldier (off duty, waiting at the Barracks) strolls: three times in four to a spot in the Barracks
// yard, otherwise somewhere in town, stands there a while, then picks the next spot. Night: they walk back into the
// Barracks and go to bed in its bunks, like villagers do (Mateo, 2026-11-15: "villagers can go inside and go to sleep"):
// at the door they step in and lie down in a free bunk until morning. A soldier with no bunk free rests standing by the
// Barracks. Nobody is ever hidden (Mateo saw an invisible guard with only its sword showing, 2026-11-14), so a resting
// soldier is never just a floating weapon. Anything that needs them wakes them at once: a siege night, a
// War Writ assault on their settlement, raiders or a Wanted player on their land. Stationed soldiers keep their
// watch (guardposts) and Archers hold the spot you put them on, as before; soldiers marching to war are left alone.
//
// The yard is what the Barracks building says (the "barracksYard" filter: yard_a / yard_b corners from its design),
// otherwise a ring round the Barracks block.

import { world, system } from "@minecraft/server";
import { isReady, onTick, keepOf, landRadius, settlementAt, underAttack, getState } from "../siege/api.js";
import { guardOwner, MARCHING_TAG } from "../siege/guards.js";
import { applyFilter } from "../core/events.js";
import { walkTo, isWalking, cancelWalk } from "../guardposts/walk.js";
import { standY } from "../guardposts/ground.js";

export const IDLE = {
  yardShare: 0.75,      // Mateo: 75% yard, 25% town
  yardMin: 3, yardMax: 8, // the ring round the Barracks block when it has no yard marks
  townShare: 0.6,       // town spots lie within this share of the land radius from the Keep
  restMin: 200, restMax: 700, // ticks a soldier stands before strolling on
  dusk: 12500, dawn: 23300,   // asleep between these (a little before nightfall, a little before sunrise)
  perTick: 12,          // soldiers looked at per second
};
const ASLEEP = "siege_asleep";
const SLEEPING = "siege:sleeping"; // bool entity property: the soldier's model lies down (studio/art/build_soldiers.py)
const BUNK = "siege:bunk";         // dynamic property: "x,y,z" of the bed head he sleeps in
const IDLE_PROP = "siege:idle"; // set while strolling away from the Barracks: siege/guards.js lets them be
const STROLLERS = new Set(["siege:man_at_arms", "siege:pikeman", "siege:shieldbearer", "siege:crossbowman", "siege:knight"]);
const OVERWORLD = "minecraft:overworld";
const dim = () => world.getDimension(OVERWORLD);
const next = new Map(); // guard id -> tick of its next stroll

// Pure: where to stroll. rand() in [0, 1). yard = { a, b } marks or undefined; barracks = { x, y, z }; keep, radius.
export function strollSpot(rand, { barracks, yard, keep, radius }) {
  if (rand() < IDLE.yardShare || !keep) {
    if (yard?.a && yard?.b) {
      return { x: Math.min(yard.a.x, yard.b.x) + rand() * Math.abs(yard.a.x - yard.b.x), z: Math.min(yard.a.z, yard.b.z) + rand() * Math.abs(yard.a.z - yard.b.z), where: "yard" };
    }
    const r = IDLE.yardMin + rand() * (IDLE.yardMax - IDLE.yardMin), a = rand() * Math.PI * 2;
    return { x: barracks.x + 0.5 + Math.cos(a) * r, z: barracks.z + 0.5 + Math.sin(a) * r, where: "yard" };
  }
  const r = Math.sqrt(rand()) * radius * IDLE.townShare, a = rand() * Math.PI * 2;
  return { x: keep.x + Math.cos(a) * r, z: keep.z + Math.sin(a) * r, where: "town" };
}

export const asleepTime = (tod) => tod >= IDLE.dusk && tod < IDLE.dawn;

// Something needs them: a siege night on this settlement, raiders, a Wanted player, or a War Writ assault
function alarm(owner) {
  if (underAttack(owner)) return true;
  try { if (getState()?.active) return true; } catch { /* fine */ }
  return !!applyFilter("openToAttack", false, { owner });
}

// Bedrock bed "direction": the way from the foot to the head (0 south, 1 west, 2 north, 3 east)
export const BED_DIRS = [{ x: 0, z: 1 }, { x: -1, z: 0 }, { x: 0, z: -1 }, { x: 1, z: 0 }];

// Pure: where a soldier stands to lie in the bed whose head block is at `head` (block corner coords) pointing `dir`.
// He stands on the foot end of the mattress facing out of the bed; his sleeping pose tips him back onto it, so his
// body runs from the foot of the bed to the pillow.
export function bedPose(head, dir) {
  const d = BED_DIRS[dir] ?? BED_DIRS[0];
  const foot = { x: head.x - d.x + 0.5, z: head.z - d.z + 0.5 };
  return { x: foot.x - d.x * 0.45, y: head.y + 0.5625, z: foot.z - d.z * 0.45, yaw: (Math.atan2(d.x, -d.z) * 180) / Math.PI };
}

const keyOf = (l) => `${l.x},${l.y},${l.z}`;
const claims = new Map(); // bed head "x,y,z" -> guard id

// The bed heads of this Barracks still standing in the world: [{ x, y, z, dir }]
function bunksAt(owner, barracks) {
  let cells = [];
  try { cells = applyFilter("barracksBunks", [], { owner, barracks }) ?? []; } catch { return []; }
  const out = [];
  for (const c of cells) {
    try {
      const b = dim().getBlock(c);
      if (b?.typeId !== "minecraft:bed" || !b.permutation.getState("head_piece_bit")) continue;
      out.push({ x: c.x, y: c.y, z: c.z, dir: Number(b.permutation.getState("direction") ?? 0) });
    } catch { /* unloaded */ }
  }
  return out;
}

const sleepingIn = (id, key) => { try { const g = world.getEntity(id); return !!g?.isValid && g.hasTag(ASLEEP) && g.getDynamicProperty(BUNK) === key; } catch { return false; } };

// A free bunk for this soldier, claimed for him, or undefined (all taken, or a Barracks with no beds)
function claimBunk(guard, owner, barracks) {
  for (const bed of bunksAt(owner, barracks)) {
    const k = keyOf(bed), who = claims.get(k);
    if (who && who !== guard.id && sleepingIn(who, k)) continue;
    claims.set(k, guard.id);
    return bed;
  }
  return undefined;
}

function sleep(guard, bed) {
  try {
    guard.addTag(ASLEEP);
    guard.addEffect("slowness", 20000000, { amplifier: 255, showParticles: false });
    guard.addEffect("resistance", 20000000, { amplifier: 4, showParticles: false });
    if (bed) {
      const at = bedPose(bed, bed.dir);
      guard.teleport({ x: at.x, y: at.y, z: at.z }, { rotation: { x: 0, y: at.yaw } });
      guard.setDynamicProperty(BUNK, keyOf(bed));
      guard.setProperty(SLEEPING, true);
    }
  } catch { /* gone */ }
}

export function wake(guard) {
  if (!guard.hasTag(ASLEEP)) return;
  try {
    guard.removeTag(ASLEEP);
    for (const e of ["invisibility", "slowness", "resistance"]) guard.removeEffect(e);
    const bunk = guard.getDynamicProperty(BUNK);
    if (bunk !== undefined) {
      guard.setDynamicProperty(BUNK, undefined);
      claims.delete(bunk);
      const post = postOf(guard); // out of bed and back out of the door
      if (post) guard.teleport({ x: post.x + 0.5, y: post.y + 1, z: post.z + 0.5 });
    }
    try { guard.setProperty(SLEEPING, false); } catch { /* an older model */ }
  } catch { /* gone */ }
}

// At the Barracks door at night: in to a free bunk, or rest standing by the door
function turnIn(guard, owner, post) {
  guard.setDynamicProperty(IDLE_PROP, undefined);
  sleep(guard, claimBunk(guard, owner, post));
}

// Soldiers put to sleep by an older build still carry a long invisibility effect: take it off
function unhide(guard) {
  try { if (guard.getEffect("invisibility")) guard.removeEffect("invisibility"); } catch { /* gone */ }
}

const postOf = (g) => { try { return JSON.parse(g.getDynamicProperty("siege:post") ?? "null"); } catch { return null; } };
// The Barracks building can name its yard: addFilter("barracksYard", (yard, { owner, barracks }) => ({ a, b }))
const yardOf = (owner, barracks) => { try { return applyFilter("barracksYard", null, { owner, barracks }); } catch { return null; } };

function think(guard, now, night) {
  if (guard.hasTag(ASLEEP)) unhide(guard);
  const owner = guardOwner(guard);
  if (!owner || guard.hasTag(MARCHING_TAG)) return;
  const post = postOf(guard);
  if (!post || post.stand || guard.getDynamicProperty("siege:station")) return; // stationed: keeps its watch
  const home = { x: post.x + 0.5, y: post.y + 1, z: post.z + 0.5 };
  if (alarm(owner)) { // everyone up: guards.js sends them at the trouble
    wake(guard);
    if (guard.getDynamicProperty(IDLE_PROP)) { guard.setDynamicProperty(IDLE_PROP, undefined); if (isWalking(guard)) cancelWalk(guard.id); }
    return;
  }
  if (night) {
    if (guard.hasTag(ASLEEP)) return;
    const d = Math.hypot(guard.location.x - home.x, guard.location.z - home.z);
    if (d < 2.5) { turnIn(guard, owner, post); return; }
    if (!isWalking(guard)) {
      guard.setDynamicProperty(IDLE_PROP, 1);
      walkTo(guard, owner, home, { noJump: true, done: (ok) => { if (ok) { try { turnIn(guard, owner, post); } catch { /* gone */ } } } });
    }
    return;
  }
  if (guard.hasTag(ASLEEP)) { wake(guard); next.set(guard.id, now + Math.floor(Math.random() * 200)); return; } // morning
  if (isWalking(guard) || now < (next.get(guard.id) ?? 0)) return;
  next.set(guard.id, now + IDLE.restMin + Math.floor(Math.random() * (IDLE.restMax - IDLE.restMin)));
  const keep = keepOf(owner);
  const spot = strollSpot(Math.random, { barracks: post, yard: yardOf(owner, post), keep, radius: keep ? landRadius(keep, owner) : 0 });
  const x = Math.floor(spot.x), z = Math.floor(spot.z);
  if (keep && settlementAt({ x, y: post.y, z }) !== owner) return; // off their land: try again later
  const y = standY(x, z, post.y + 12);
  if (y === undefined || Math.abs(y - post.y) > 16) return;
  guard.setDynamicProperty(IDLE_PROP, 1);
  walkTo(guard, owner, { x: x + 0.5, y, z: z + 0.5, yaw: Math.random() * 360 }, { noJump: true });
}

let cursor = 0;
onTick("army-idle", 20, () => {
  if (!isReady()) return;
  const now = system.currentTick, night = asleepTime(world.getTimeOfDay());
  let all = [];
  try { all = dim().getEntities({ families: ["siege_guard"] }).filter((g) => STROLLERS.has(g.typeId)); } catch { /* fine */ }
  if (!all.length) return;
  for (let k = 0; k < Math.min(IDLE.perTick, all.length); k++) {
    const g = all[(cursor + k) % all.length];
    try { think(g, now, night); } catch { /* unloaded */ }
  }
  cursor = (cursor + IDLE.perTick) % Math.max(1, all.length);
});
