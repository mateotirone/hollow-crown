// Wingmen: dragons flown by NPC riders (Mateo's rule: a stand-in for every player role, fighting like players).
// Other features ask for one by event and keep it alive by asking again; the dragons feature does the flying.
//
//   emit("npcDragonFly", { key, name, species, dimension, center | follow, radius, height, every, damage, targetType, ttl })
//     key         one wingman per key; asking again with the same key updates it and keeps it in the air
//     follow      a Player to circle (else `center`, a fixed point)
//     targetType  only burn this entity type (e.g. a boss); otherwise the nearest monster within 24 blocks
//     every       ticks between breaths;  damage  per breath;  ttl  ticks it stays up without being asked again
//   emit("npcDragonLand", { key })   it climbs away and is gone
//
// These dragons have no owner, so the rest of the dragons feature treats them as display dragons: no record,
// no taming, no shooting down. They are tagged, and any left over after a reload are cleared.

import { world, system, EntityDamageCause } from "@minecraft/server";
import { on, onTick, isReady, addTests, assert, assertEqual } from "../siege/api.js";
import { sfx } from "../core/sfx.js";
import { SPECIES } from "./data.js";

const DRAGON = "siege:dragon";
const TAG = "siege_npc_dragon";
const STEP = 2; // ticks between moves
const wing = new Map(); // key -> { entity, ask, angle, breathAt, leaving }

// Where a wingman should be: on a circle round the anchor, a little above it
export function orbitPoint(anchor, angle, radius, height) {
  return { x: anchor.x + Math.cos(angle) * radius, y: anchor.y + height, z: anchor.z + Math.sin(angle) * radius };
}

const alive = (e) => { try { return !!e?.isValid; } catch { return false; } };
const speciesIndex = (key) => Math.max(0, SPECIES.findIndex((s) => s.key === key));

function anchorOf(ask) {
  if (ask.follow) return alive(ask.follow) ? ask.follow.location : undefined;
  return ask.center;
}

function spawnWingman(ask, at) {
  const dim = world.getDimension(ask.dimension ?? "minecraft:overworld");
  const entity = dim.spawnEntity(DRAGON, at);
  entity.addTag(TAG);
  entity.nameTag = ask.name ?? "";
  try { entity.setProperty("siege:species", speciesIndex(ask.species)); } catch { /* old pack */ }
  entity.triggerEvent("siege:to_air_4");
  for (const [effect, ticks, amplifier] of [["resistance", 20000000, 4], ["fire_resistance", 20000000, 0]]) {
    try { entity.addEffect(effect, ticks, { amplifier, showParticles: false }); } catch { /* fine */ }
  }
  return entity;
}

on("npcDragonFly", (ask) => {
  if (!ask?.key) return;
  if ((ask.dimension ?? "minecraft:overworld") !== "minecraft:overworld") return; // dragons never leave the Overworld
  const now = system.currentTick;
  const w = wing.get(ask.key);
  const until = now + (ask.ttl ?? 100);
  if (w && !w.leaving) { w.ask = { ...w.ask, ...ask }; w.until = until; return; }
  const anchor = anchorOf(ask);
  if (!anchor) return;
  const angle = Math.random() * Math.PI * 2;
  try {
    const entity = spawnWingman(ask, orbitPoint(anchor, angle, ask.radius ?? 8, (ask.height ?? 4) + 6));
    wing.set(ask.key, { entity, ask, angle, breathAt: now + 40, until, leaving: 0 });
  } catch (e) {
    console.warn(`[Dragons] wingman ${ask.key}: ${e}`); // unloaded ground: try again next time we are asked
  }
});

on("npcDragonLand", ({ key }) => {
  const w = wing.get(key);
  if (w && !w.leaving) w.leaving = system.currentTick;
});

function targetFor(w) {
  const { entity, ask } = w;
  try {
    const query = { location: entity.location, maxDistance: 24, closest: 1 };
    if (ask.targetType) query.type = ask.targetType;
    else query.families = ["monster"];
    return entity.dimension.getEntities(query)[0];
  } catch { return undefined; }
}

function breathe(w, target) {
  const { entity, ask } = w;
  const from = { x: entity.location.x, y: entity.location.y + 1.5, z: entity.location.z };
  const to = { x: target.location.x, y: target.location.y + 1, z: target.location.z };
  const dim = entity.dimension;
  try {
    entity.setProperty("siege:breath", true);
    system.runTimeout(() => { try { entity.setProperty("siege:breath", false); } catch { /* gone */ } }, 20);
    const dist = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z) || 1;
    for (let d = 1.5; d < dist; d += 1.5) {
      const f = d / dist;
      dim.spawnParticle("minecraft:mobflame_single", { x: from.x + (to.x - from.x) * f, y: from.y + (to.y - from.y) * f, z: from.z + (to.z - from.z) * f });
    }
    sfx(dim, "mob.blaze.shoot", from, { pitch: 0.6, volume: 0.8 });
  } catch { /* looks only */ }
  try {
    target.applyDamage(ask.damage ?? 6, { cause: EntityDamageCause.fire, damagingEntity: entity });
    target.setOnFire(4, true);
  } catch { /* target gone or can't be hurt right now */ }
}

function wingTick() {
  const now = system.currentTick;
  for (const [key, w] of wing) {
    if (!alive(w.entity)) { wing.delete(key); continue; }
    const anchor = anchorOf(w.ask);
    if (!w.leaving && (now > w.until || !anchor)) w.leaving = now;
    if (w.leaving) {
      // climb away, then go
      if (now - w.leaving > 60) { try { w.entity.remove(); } catch { /* gone */ } wing.delete(key); continue; }
      const l = w.entity.location;
      try { w.entity.teleport({ x: l.x, y: l.y + 0.8, z: l.z }); } catch { /* unloaded */ }
      continue;
    }
    const radius = w.ask.radius ?? 8;
    w.angle += (0.35 * STEP) / Math.max(4, radius); // about 7 blocks a second round the circle
    const at = orbitPoint(anchor, w.angle, radius, w.ask.height ?? 4);
    const ahead = orbitPoint(anchor, w.angle + 0.3, radius, w.ask.height ?? 4);
    try { w.entity.teleport(at, { facingLocation: ahead }); } catch { /* unloaded */ }
    if (now >= w.breathAt) {
      w.breathAt = now + (w.ask.every ?? 80);
      const target = targetFor(w);
      if (target) breathe(w, target);
    }
  }
}

// After a reload the map is empty: any tagged dragon still standing about is a leftover
let swept = false;
function sweep() {
  for (const dimId of ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"]) {
    try {
      for (const e of world.getDimension(dimId).getEntities({ type: DRAGON, tags: [TAG] })) {
        if (![...wing.values()].some((w) => w.entity === e)) e.remove();
      }
    } catch { /* not loaded */ }
  }
}

onTick("dragons_wingmen", STEP, () => {
  if (!isReady()) return;
  if (!swept) { swept = true; sweep(); }
  if (wing.size) wingTick();
});
onTick("dragons_wingmen_sweep", 600, () => isReady() && sweep());

addTests("dragons", {
  "a wingman circles its anchor at the right height": () => {
    const p = orbitPoint({ x: 10, y: 64, z: -5 }, 0, 8, 4);
    assertEqual(p, { x: 18, y: 68, z: -5 });
    const q = orbitPoint({ x: 0, y: 0, z: 0 }, Math.PI / 2, 6, 3);
    assert(Math.abs(q.x) < 1e-9 && Math.abs(q.z - 6) < 1e-9 && q.y === 3);
  },
});
