// Bodies on the battlefield.
//
// When one of our mobs, bosses, raiders or NPC fighters dies it doesn't puff into smoke. It falls
// where it stood and lies there. Bodies stay while the fight is still going on around them, then
// sink slowly into the ground. Ghosts and shades leave nothing: there was never a body.
//
// A body is one light entity (siege:body) wearing the dead mob's shape and skin. It has no mind, can't
// be hurt and doesn't block anyone. To keep big sieges smooth there is a cap: past it, the oldest go first.
//
// Each shape lies down its own way (studio/bestiary/build.py POSES): two-legged things fall on their backs,
// four-legged and long things roll onto their side, flyers like the Gloamwing drop flat with their wings slack,
// beetles end on their backs. The dead mob itself is NOT removed: the engine finishes its death as usual
// (loot, XP, every other script that hears the death can still read it), and its client entity hides the
// model the moment it stops being alive (animation.siege_b.dead_hide), so only the body is seen.

import { world, system } from "@minecraft/server";
import { onTick, addTests, assert, assertEqual } from "../siege/api.js";
import { BODIES } from "./data.js";
import { activeDimensions } from "./util.js";

export const BODY_SETTINGS = {
  restSeconds: 45, // a body always lies at least this long
  quietRadius: 24, // "the fight is over" = no monsters or hostile fighters this close
  maxSeconds: 480, // even in an endless fight, bodies go after 8 minutes
  cap: 48, // most bodies per dimension; the oldest sink first when it's passed
  sinkSeconds: 5,
};
const BODY = "siege:body";
const BORN = "siege:body_born", SINK = "siege:body_sink";
const now = () => system.currentTick / 20;

export const POSE = { back: 0, side: 1, flat: 2, belly_up: 3 };

// Pure: which way the body faces. Things that roll onto their side land on a random side, so a field of
// fallen wolves doesn't look stamped out of one mould.
export function bodyYaw(yaw, pose, roll) {
  return pose === POSE.side && roll < 0.5 ? ((yaw + 360) % 360) - 180 : yaw;
}

// Pure: should this body start sinking? `olderThanCap` = it is among the oldest past the cap.
export function shouldSink({ age, fightNearby, olderThanCap }) {
  if (olderThanCap || age >= BODY_SETTINGS.maxSeconds) return true;
  return age >= BODY_SETTINGS.restSeconds && !fightNearby;
}

// Lays `entity`'s body where it stands. Returns the body, or undefined for things that leave none.
export function layBody(entity) {
  const info = BODIES[entity.typeId];
  if (!info || entity.hasTag("siege_showcase")) return undefined;
  const dim = entity.dimension, at = entity.location;
  const pose = info.pose ?? POSE.back;
  const body = dim.spawnEntity(BODY, at);
  body.setProperty("siege:kind", info.kind);
  body.setProperty("siege:size", info.size ?? 1);
  body.setProperty("siege:pose", pose);
  body.setProperty("siege:lift", info.lift ?? 1);
  body.setDynamicProperty(BORN, now());
  body.teleport(at, { rotation: { x: 0, y: bodyYaw(entity.getRotation().y, pose, Math.random()) } });
  if (entity.nameTag) body.nameTag = entity.nameTag.replace(/§./g, "");
  return body;
}

world.afterEvents.entityDie.subscribe((event) => {
  const dead = event.deadEntity;
  try {
    if (!layBody(dead) || !dead.nameTag) return;
    // the dying mob is invisible now; take its name off too so it doesn't hang over the body (next tick,
    // after every other death listener has had its look)
    system.run(() => {
      try { dead.nameTag = ""; } catch { /* already gone */ }
    });
  } catch {
    // died somewhere unloaded, or the engine had already taken it
  }
});

function bodyTick() {
  const t = now();
  for (const dim of activeDimensions()) {
    let bodies = [];
    try {
      bodies = dim.getEntities({ type: BODY });
    } catch {
      continue;
    }
    if (!bodies.length) continue;
    const born = (b) => b.getDynamicProperty(BORN) ?? 0;
    bodies.sort((a, b) => born(a) - born(b));
    const lying = bodies.filter((b) => b.getDynamicProperty(SINK) === undefined);
    const overflow = Math.max(0, lying.length - BODY_SETTINGS.cap);
    for (const b of bodies) {
      try {
        const sinkAt = b.getDynamicProperty(SINK);
        if (sinkAt !== undefined) {
          if (t - sinkAt >= BODY_SETTINGS.sinkSeconds) b.remove();
          continue;
        }
        const fightNearby = dim.getEntities({ location: b.location, maxDistance: BODY_SETTINGS.quietRadius, families: ["monster"] }).length > 0;
        if (!shouldSink({ age: t - born(b), fightNearby, olderThanCap: lying.indexOf(b) < overflow })) continue;
        b.setDynamicProperty(SINK, t);
        b.setProperty("siege:fading", true);
        b.nameTag = "";
      } catch {
        // unloaded
      }
    }
  }
}
onTick("bestiary_bodies", 40, bodyTick);

addTests("bestiary", {
  "bodies stay while the fight goes on, then sink": () => {
    assert(!shouldSink({ age: 5, fightNearby: false, olderThanCap: false }), "always lies a while");
    assert(!shouldSink({ age: 200, fightNearby: true, olderThanCap: false }), "stays during the fight");
    assert(shouldSink({ age: 60, fightNearby: false, olderThanCap: false }), "sinks once it's quiet");
    assert(shouldSink({ age: BODY_SETTINGS.maxSeconds, fightNearby: true, olderThanCap: false }), "never forever");
    assert(shouldSink({ age: 1, fightNearby: true, olderThanCap: true }), "the cap wins");
  },
  "solid mobs leave bodies, ghosts and props don't": () => {
    assert(BODIES["siege:hollow_footman"] && BODIES["siege:clockwork_reeve"] && BODIES["siege:champion_knight"], "bodies");
    assert(!BODIES["siege:tolling_shade"] && !BODIES["siege:seep"] && !BODIES["siege:chapel_bell"] && !BODIES["siege:hollow_crow"], "no bodies");
    assertEqual(new Set(Object.values(BODIES).map((b) => b.kind)).size, Object.keys(BODIES).length);
  },
  "each body lies down the way its shape should": () => {
    // tipping a flat or four-legged thing over backwards stood it up on its tail (the Gloamwing bug)
    assertEqual(BODIES["siege:gloamwing"].pose, POSE.flat, "Gloamwings drop flat");
    for (const id of ["siege:echo_hound", "siege:frost_stag", "siege:rimewolf", "siege:brine_lurker", "siege:mire_toad", "siege:dune_wyrm"])
      assertEqual(BODIES[id].pose, POSE.side, `${id} rolls onto its side`);
    assertEqual(BODIES["siege:ash_scarab"].pose, POSE.belly_up, "scarabs end on their backs");
    assertEqual(BODIES["siege:hollow_footman"].pose, POSE.back, "two-legged things fall on their backs");
    for (const [id, b] of Object.entries(BODIES)) assert(typeof b.lift === "number" && b.lift > -16 && b.lift < 32, `${id} has a lift in range`);
    assertEqual(bodyYaw(30, POSE.back, 0.1), 30);
    assertEqual(bodyYaw(30, POSE.side, 0.9), 30);
    assertEqual(bodyYaw(30, POSE.side, 0.1), -150);
  },
});
