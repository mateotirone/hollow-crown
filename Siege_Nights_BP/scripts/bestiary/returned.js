// The hidden Returned (Mateo, 2026-11-10): an ordinary villager in an ordinary village that is secretly one of
// the Returned. It looks, trades and wanders exactly like any other villager: it IS a vanilla villager, marked
// only in data the player cannot see. You catch it by its tells (from the lore):
//
//   It faces the Hollow   When it thinks nobody is looking, it stops and stands facing the wall, toward the Rift.
//                         Look at it and it goes back to being a villager. Watch from the corner of your eye.
//   Dogs won't know it    A tamed wolf near one growls and will not settle.
//   It can't stand bells  Ring a bell near one and it flinches, drops the act and starts walking back to the Hollow.
//                         Sometimes it takes people with it: nearby villagers fall in behind.
//
// (The lore's fourth tell, "uses the wrong hand", cannot be shown on a vanilla villager. If the lore thread wants
// it, it needs a custom villager model.)
//
// Once it is walking you can cut it down (it leaves Veil Ash, and the people it took wake and go home), or let it go.
// If it walks far enough it is gone, and so is everyone following it.
//
// For other features (the lore thread writes named villagers whose families ask you to find out):
//   import { markReturned, isReturned } from "../bestiary/returned.js"   markReturned(villager, { name, quest })
//   script events out:  siege:returned_exposed {"id","name","quest","x","y","z","dimension","player"}
//                       siege:returned_slain   {"id","name","quest","exposed","saved","x","y","z","dimension","player"}
//                       siege:returned_gone    {"id","name","quest","taken","x","y","z","dimension"}
// Testing: /scriptevent siege:returned_mark     marks the villager nearest you
//          /scriptevent siege:returned_spawn    spawns a marked villager beside you
//          /scriptevent siege:returned_reveal   shows a beam on every Returned within 48 blocks (cheat)

import { world, system } from "@minecraft/server";
import { onTick, addTests, assert, assertEqual, isNight } from "../siege/api.js";
import { getRift } from "../undertow/source.js";
import { bestiaryStore } from "./bossCore.js";
import { announce, effect, flat, makeItem, particle, sound, watchedBy } from "./util.js";

export const RETURNED = {
  type: "minecraft:villager_v2",
  watchRange: 48, // a player this close and looking at it keeps it acting normal
  bellRange: 16,
  wolfRange: 8,
  takeRange: 7, // villagers this close when the bell rings may fall in behind
  takeChance: 0.35,
  maxTaken: 2,
  walkBlocks: 64, // how far it walks before it is gone
  gentle: false, // the truce holds (lore/truce.js, setReturnedGentle): a Returned walks home alone and takes nobody
  walkSeconds: 90,
  seedEveryTicks: 2400, // a village is looked at this often
  seedChance: 0.08, // chance per look that one more villager did not come back the same
  seedMinVillagers: 5, // a real village, not a trading hall of two
  seedMaxNear: 1, // only one per village at a time
  ash: 2,
};
const PROP = "siege:returned";
const WALK_TAG = "siege_returned_walking";
const TAKEN_TAG = "siege_returned_taken";

// ---------- pure rules (self-tested) ----------
// Minecraft yaw (degrees) that faces from one spot toward another: 0 = south (+z), 90 = west (-x)
export const yawToward = (from, to) => (Math.atan2(-(to.x - from.x), to.z - from.z) * 180) / Math.PI;
// A unit step from one spot toward another, flat
export function stepToward(from, to) {
  const dx = to.x - from.x, dz = to.z - from.z, d = Math.hypot(dx, dz) || 1;
  return { x: dx / d, z: dz / d };
}
// Does one more villager here turn out to be Returned?
export const shouldSeed = ({ awake, villagers, returnedNear, roll }) =>
  !!awake && villagers >= RETURNED.seedMinVillagers && returnedNear < RETURNED.seedMaxNear && roll < RETURNED.seedChance;
// Which of the nearby villagers fall in behind it (rolls = one random number per villager)
export function whoFollows(count, rolls) {
  if (RETURNED.gentle) return Array.from({ length: count }, () => false);
  let taken = 0;
  return Array.from({ length: count }, (_, i) => rolls[i] < RETURNED.takeChance && taken < RETURNED.maxTaken && ++taken > 0);
}
export const setReturnedGentle = (on) => { RETURNED.gentle = !!on; };
export const walkOver = (blocks, seconds) => blocks >= RETURNED.walkBlocks || seconds >= RETURNED.walkSeconds;

// ---------- marking ----------
function dataOf(e) {
  try {
    const raw = e.getDynamicProperty(PROP);
    return typeof raw === "string" ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}
export const isReturned = (e) => !!dataOf(e);
export function markReturned(villager, { name, quest } = {}) {
  try {
    villager.setDynamicProperty(PROP, JSON.stringify({ name, quest }));
    return true;
  } catch {
    return false;
  }
}

// Where the Hollow is from here: the Rift if the world has one, otherwise the old road west
function hollowFrom(loc) {
  let rift;
  try { rift = getRift(); } catch { /* no Hollow data yet */ }
  return rift && Number.isFinite(rift.x) ? { x: rift.x, y: rift.y, z: rift.z } : { x: loc.x - 1000, y: loc.y, z: loc.z };
}

const facts = (e, d) => ({ id: e.id, name: d?.name, quest: d?.quest, x: Math.floor(e.location.x), y: Math.floor(e.location.y), z: Math.floor(e.location.z), dimension: e.dimension.id });
const villagersNear = (dim, loc, range) => {
  try { return dim.getEntities({ type: RETURNED.type, location: loc, maxDistance: range }); } catch { return []; }
};

// ---------- the tells ----------
const walkers = new Map(); // entity id -> { from, started, taken: [ids], by }

function tellsTick() {
  const seen = new Set();
  for (const player of world.getAllPlayers()) {
    const dim = player.dimension;
    if (!dim.id.endsWith("overworld")) continue;
    const players = dim.getPlayers({ location: player.location, maxDistance: 96 });
    for (const v of villagersNear(dim, player.location, 64)) {
      if (seen.has(v.id) || !isReturned(v)) continue;
      seen.add(v.id);
      if (v.hasTag(WALK_TAG)) continue;
      // It faces the Hollow when it thinks it is alone
      if (!watchedBy(v, players, RETURNED.watchRange)) {
        try {
          v.setRotation({ x: 0, y: yawToward(v.location, hollowFrom(v.location)) });
          effect(v, "slowness", 30, 255);
        } catch { /* unloaded */ }
      }
      // A dog won't know it
      try {
        for (const wolf of dim.getEntities({ type: "minecraft:wolf", location: v.location, maxDistance: RETURNED.wolfRange })) {
          if (!wolf.getComponent("is_tamed")) continue;
          if (system.currentTick % 80 < 20) sound(dim, "mob.wolf.growl", wolf.location, 0.9, 0.8);
          particle(dim, "minecraft:villager_angry", { x: wolf.location.x, y: wolf.location.y + 0.9, z: wolf.location.z });
        }
      } catch { /* none */ }
    }
  }
}

// ---------- the bell ----------
function expose(v, player) {
  const dim = v.dimension, d = dataOf(v);
  v.addTag(WALK_TAG);
  try { v.removeEffect("slowness"); } catch { /* fine */ }
  const others = villagersNear(dim, v.location, RETURNED.takeRange).filter((o) => o.id !== v.id && !isReturned(o) && !o.hasTag(TAKEN_TAG));
  const follow = whoFollows(others.length, others.map(() => Math.random()));
  const taken = others.filter((_, i) => follow[i]);
  for (const o of taken) o.addTag(TAKEN_TAG);
  walkers.set(v.id, { from: { ...v.location }, started: system.currentTick, taken: taken.map((o) => o.id), by: player?.id });
  sound(dim, "mob.villager.no", v.location, 0.5, 1);
  particle(dim, "minecraft:knockback_roar_particle", { x: v.location.x, y: v.location.y + 1, z: v.location.z });
  for (const p of dim.getPlayers({ location: v.location, maxDistance: 24 })) {
    p.sendMessage(`§7At the sound of the bell ${d?.name ? `§f${d.name}§7` : "one of them"} stops, quite still. Then it turns away from you all and starts to walk.` + (taken.length ? " §7It is not walking alone." : ""));
  }
  announce("siege:returned_exposed", { ...facts(v, d), player: player?.id });
}

world.afterEvents.playerInteractWithBlock.subscribe((event) => {
  if (event.block?.typeId !== "minecraft:bell") return;
  const at = event.block.location, dim = event.block.dimension;
  for (const v of villagersNear(dim, at, RETURNED.bellRange)) if (isReturned(v) && !v.hasTag(WALK_TAG)) expose(v, event.player);
});

function nudge(e, toward, speed) {
  const s = stepToward(e.location, toward);
  try {
    e.setRotation({ x: 0, y: yawToward(e.location, toward) });
    const vel = e.getVelocity();
    const stuck = Math.hypot(vel.x, vel.z) < 0.02 && e.isOnGround;
    e.applyImpulse({ x: s.x * speed, y: stuck ? 0.42 : 0, z: s.z * speed }); // hop anything in the way
  } catch { /* unloaded */ }
}

function walkTick() {
  for (const [id, w] of walkers) {
    const v = world.getEntity(id);
    if (!v?.isValid) continue; // unloaded or dead: the death handler tidies up
    const dim = v.dimension, hollow = hollowFrom(w.from);
    nudge(v, hollow, 0.09);
    const followers = w.taken.map((t) => world.getEntity(t)).filter((o) => o?.isValid);
    for (const o of followers) if (flat(o.location, v.location) > 2.5) nudge(o, v.location, 0.1);
    if (system.currentTick % 20 === 0) particle(dim, "minecraft:soul_particle", { x: v.location.x, y: v.location.y + 2.1, z: v.location.z });
    if (!walkOver(flat(v.location, w.from), (system.currentTick - w.started) / 20)) continue;
    // Gone, and everyone following with it
    walkers.delete(id);
    const d = dataOf(v);
    announce("siege:returned_gone", { ...facts(v, d), taken: followers.length });
    for (const p of dim.getPlayers({ location: v.location, maxDistance: 48 })) p.sendMessage(followers.length ? "§7They walk into the dark together, and are not there any more." : "§7It walks into the dark and is not there any more.");
    for (const e of [v, ...followers]) {
      try { particle(dim, "minecraft:large_smoke_particle", { x: e.location.x, y: e.location.y + 1, z: e.location.z }); e.remove(); } catch { /* gone */ }
    }
  }
}

// Cut down: it leaves ash, and the people it took wake up
world.afterEvents.entityDie.subscribe((event) => {
  const dead = event.deadEntity;
  if (dead.typeId !== RETURNED.type) return;
  const d = dataOf(dead);
  if (!d) return;
  const w = walkers.get(dead.id);
  walkers.delete(dead.id);
  let saved = 0;
  for (const t of w?.taken ?? []) {
    const o = world.getEntity(t);
    if (!o?.isValid) continue;
    o.removeTag(TAKEN_TAG);
    saved++;
  }
  const by = event.damageSource.damagingEntity;
  try {
    const dim = dead.dimension, at = dead.location;
    const ash = makeItem("siege:hollow_ash", RETURNED.ash);
    if (ash) dim.spawnItem(ash, at);
    particle(dim, "minecraft:soul_particle", { x: at.x, y: at.y + 1, z: at.z });
    if (by?.typeId === "minecraft:player") by.sendMessage(saved ? `§7It comes apart like wet paper. Behind it, ${saved === 1 ? "someone blinks and looks" : "people blink and look"} around as if woken.` : "§7It comes apart like wet paper. There is nothing inside but ash.");
    announce("siege:returned_slain", { ...facts(dead, d), exposed: !!w, saved, player: by?.typeId === "minecraft:player" ? by.id : undefined });
  } catch { /* unloaded */ }
});

// ---------- how a village gets one ----------
function seedTick() {
  if (!bestiaryStore.data.hollowAwake) return; // nothing comes back until the Hollow is awake
  const looked = [];
  for (const player of world.getAllPlayers()) {
    const dim = player.dimension;
    if (!dim.id.endsWith("overworld") || looked.some((l) => flat(l, player.location) < 96)) continue;
    looked.push(player.location);
    const all = villagersNear(dim, player.location, 64);
    const returnedNear = all.filter(isReturned).length;
    if (!shouldSeed({ awake: true, villagers: all.length, returnedNear, roll: Math.random() })) continue;
    // one nobody is looking at, and only in the dark: nobody sees it happen
    if (!isNight()) continue;
    const players = dim.getPlayers({ location: player.location, maxDistance: 96 });
    const pick = all.find((v) => !isReturned(v) && !v.nameTag && !watchedBy(v, players, 64));
    if (pick) markReturned(pick);
  }
}

onTick("bestiary_returned_tells", 20, tellsTick);
onTick("bestiary_returned_walk", 4, walkTick);
onTick("bestiary_returned_seed", RETURNED.seedEveryTicks, seedTick);

// ---------- testing ----------
system.afterEvents.scriptEventReceive.subscribe((event) => {
  const src = event.sourceEntity;
  if (!src || !event.id.startsWith("siege:returned_")) return;
  const dim = src.dimension;
  if (event.id === "siege:returned_mark") {
    const v = villagersNear(dim, src.location, 16).sort((a, b) => flat(a.location, src.location) - flat(b.location, src.location))[0];
    if (v && markReturned(v, { name: v.nameTag || undefined })) src.sendMessage?.("§7The nearest villager is now one of the Returned. It will not look any different.");
  } else if (event.id === "siege:returned_spawn") {
    try { markReturned(dim.spawnEntity(RETURNED.type, src.location)); src.sendMessage?.("§7A villager has come back. It will not look any different."); } catch { /* no room */ }
  } else if (event.id === "siege:returned_reveal") {
    for (const v of villagersNear(dim, src.location, 48)) {
      if (!isReturned(v)) continue;
      for (let y = 2; y < 12; y++) particle(dim, "minecraft:endrod", { x: v.location.x, y: v.location.y + y, z: v.location.z });
    }
  }
});

addTests("bestiary", {
  "a Returned turns to face the Hollow": () => {
    assertEqual(Math.round(yawToward({ x: 0, z: 0 }, { x: 0, z: 10 })), 0);
    assertEqual(Math.round(yawToward({ x: 0, z: 0 }, { x: -10, z: 0 })), 90);
    assertEqual(Math.round(yawToward({ x: 0, z: 0 }, { x: 10, z: 0 })), -90);
    assertEqual(stepToward({ x: 0, z: 0 }, { x: 0, z: -5 }), { x: 0, z: -1 });
  },
  "villages only get one, only once the Hollow is awake": () => {
    assert(shouldSeed({ awake: true, villagers: 8, returnedNear: 0, roll: 0.01 }));
    assert(!shouldSeed({ awake: false, villagers: 8, returnedNear: 0, roll: 0.01 }), "asleep");
    assert(!shouldSeed({ awake: true, villagers: 3, returnedNear: 0, roll: 0.01 }), "not a village");
    assert(!shouldSeed({ awake: true, villagers: 8, returnedNear: 1, roll: 0.01 }), "one already");
    assert(!shouldSeed({ awake: true, villagers: 8, returnedNear: 0, roll: 0.5 }), "not this time");
  },
  "it takes at most two people with it": () => {
    assertEqual(whoFollows(4, [0.1, 0.9, 0.2, 0.05]), [true, false, true, false]);
    assertEqual(whoFollows(2, [0.9, 0.9]), [false, false]);
    assert(walkOver(64, 1) && walkOver(3, 90) && !walkOver(30, 30));
  },
});
