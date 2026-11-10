// Bodies on the battlefield.
//
// When one of our mobs, bosses, raiders or NPC fighters dies it doesn't puff into smoke. It falls
// where it stood and lies there. Bodies stay while the fight is still going on around them, then
// sink slowly into the ground. Ghosts and shades leave nothing: there was never a body.
//
// A body is one light entity (siege:body) wearing the dead mob's shape and skin. It has no mind, can't
// be hurt and doesn't block anyone. To keep big sieges smooth there is a cap: past it, the oldest go first.

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

// Pure: should this body start sinking? `olderThanCap` = it is among the oldest past the cap.
export function shouldSink({ age, fightNearby, olderThanCap }) {
  if (olderThanCap || age >= BODY_SETTINGS.maxSeconds) return true;
  return age >= BODY_SETTINGS.restSeconds && !fightNearby;
}

world.afterEvents.entityDie.subscribe((event) => {
  const dead = event.deadEntity;
  try {
    const info = BODIES[dead.typeId];
    if (!info || dead.hasTag("siege_showcase")) return;
    const dim = dead.dimension, at = dead.location;
    const yaw = dead.getRotation().y;
    const body = dim.spawnEntity(BODY, at);
    body.setProperty("siege:kind", info.kind);
    body.setProperty("siege:size", info.size ?? 1);
    body.setDynamicProperty(BORN, now());
    body.teleport(at, { rotation: { x: 0, y: yaw } });
    if (dead.nameTag) body.nameTag = dead.nameTag.replace(/§./g, "");
    dead.remove(); // skip the vanilla tip-over and smoke; its loot and XP have already dropped
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
});
