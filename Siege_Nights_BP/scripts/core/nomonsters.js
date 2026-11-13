// No vanilla monsters (Mateo, 2026-11-12 and 2026-11-13: "vanilla mobs shouldnt spawn", farm animals are fine).
// The Hollow Crown's own creatures (siege:*) are the monsters of this world.
//
// The main block is in the pack: spawn_rules/vanilla_*.json give each vanilla monster an empty spawn rule,
// so the game never picks it for a natural spawn, in the Overworld or the Hollow. This file is the backstop
// for anything that still slips through (structure spawns, mounts that bring a rider, rules a game update adds):
// a vanilla monster that appears on its own, far from every player, is removed a tick later.
//
// Left alone, so nothing breaks:
//   - anything our own code spawns: sieges, Rival Lords, rumor captors and the Choir's Echoes all tag or name theirs
//   - spawn eggs and /summon: those land next to the player, and the game never spawns a monster that close
//   - mobs loaded from the world or born/transformed from another mob

import { world, system } from "@minecraft/server";
import { addTests, assert } from "./tests.js";

export const MONSTERS = new Set([
  "zombie", "zombie_villager", "zombie_villager_v2", "husk", "drowned", "skeleton", "stray", "bogged", "parched",
  "creeper", "spider", "cave_spider", "enderman", "endermite", "silverfish", "witch", "slime", "phantom",
  "pillager", "vindicator", "evoker", "vex", "ravager", "guardian", "elder_guardian",
  "zombie_horse", "skeleton_horse", "camel_husk", "zombie_nautilus",
  "zombie_pigman", "piglin", "piglin_brute", "hoglin", "zoglin", "blaze", "ghast", "magma_cube", "wither_skeleton",
].map((id) => "minecraft:" + id));

const SPAWNED = "Spawned"; // EntityInitializationCause.Spawned: natural spawns, eggs, /summon and script spawns

// Natural spawns never land closer than this to a player; eggs, /summon and our scripts almost always do.
export const NEAR = 24;

// Pure: should this freshly spawned entity go?
export function shouldClear({ typeId, cause, tags = [], nameTag = "", nearestPlayer = Infinity }) {
  if (!MONSTERS.has(typeId)) return false;
  if (cause !== undefined && cause !== SPAWNED) return false;
  if (tags.length || nameTag) return false;
  return nearestPlayer >= NEAR;
}

function nearestPlayer(entity) {
  let best = Infinity;
  const at = entity.location;
  for (const p of entity.dimension.getPlayers({ location: at, maxDistance: NEAR + 1 })) {
    const l = p.location, d = Math.hypot(l.x - at.x, l.y - at.y, l.z - at.z);
    if (d < best) best = d;
  }
  return best;
}

world.afterEvents.entitySpawn.subscribe(({ entity, cause }) => {
  let typeId;
  try { typeId = entity.typeId; } catch { return; }
  if (!MONSTERS.has(typeId) || cause !== SPAWNED) return;
  system.run(() => { // a tick later, so whoever spawned it on purpose has put its tags and name on
    try {
      if (!entity.isValid) return;
      // a rider on one of our tagged mounts belongs to that mount
      const mount = entity.getComponent("minecraft:riding")?.entityRidingOn;
      if (mount && (mount.getTags().length || mount.nameTag)) return;
      if (shouldClear({ typeId, cause, tags: entity.getTags(), nameTag: entity.nameTag, nearestPlayer: nearestPlayer(entity) })) entity.remove();
    } catch { /* gone already, or its chunk unloaded */ }
  });
});

addTests("nomonsters", {
  "a lone vanilla monster far from players goes": () => {
    assert(shouldClear({ typeId: "minecraft:zombie", cause: SPAWNED, nearestPlayer: 40 }));
    assert(shouldClear({ typeId: "minecraft:creeper", cause: SPAWNED }), "no player in reach");
  },
  "our own mobs, farm animals and tagged or named monsters stay": () => {
    const S = SPAWNED;
    assert(!shouldClear({ typeId: "siege:rimewolf", cause: S }), "our creatures");
    assert(!shouldClear({ typeId: "minecraft:cow", cause: S }), "farm animals");
    assert(!shouldClear({ typeId: "minecraft:pillager", cause: S, tags: ["siege_raider"] }), "siege raiders");
    assert(!shouldClear({ typeId: "minecraft:vindicator", cause: S, nameTag: "Echo of the Siege" }), "named");
  },
  "spawn eggs, /summon and loaded mobs stay": () => {
    assert(!shouldClear({ typeId: "minecraft:zombie", cause: SPAWNED, nearestPlayer: 3 }), "egg next to a player");
    assert(!shouldClear({ typeId: "minecraft:zombie", cause: "Loaded", nearestPlayer: 60 }), "loaded from the world");
  },
});
