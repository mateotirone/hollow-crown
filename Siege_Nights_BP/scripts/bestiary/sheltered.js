// Safe inside the walls (Mateo, 2026-11-13: "The hostile mobs can't spawn inside your walls. Only outside in the wild").
//
// No hostile creature comes into being inside a player's settlement land or inside one of the map's lived-in towns.
// They are born out in the wild and stay a wild thing: one that walks in on its own is a fight, not a spawn.
// Sieges and raids are the deliberate exception: they come from outside (raiders spawn past the land's edge,
// siege/siege.js "spawnDistance") and march in, and everything our scripts send is tagged or named, so it is never touched.
//
// Two halves:
//   1. Our own spawners (Hollow things at night, Seeps, the long march's pickets) ask shelteredAt() before they pick a spot.
//   2. Natural spawns from spawn_rules/ can't be told where not to go (Bedrock spawn rules have no position filter),
//      so a wild monster (gentle.js WILD) that the game spawns on sheltered ground is removed a tick later.
//      Cheap: one Set lookup per spawned entity, and the land test only for our seven wild monsters.
//   Vanilla monsters never spawn anywhere (core/nomonsters.js), so they need nothing here.

import { world, system } from "@minecraft/server";
import { settlementAt, addTests, assert } from "../siege/api.js";
import { WARDS } from "../plots/config.js";
import { mapMode } from "../plots/claims.js";
import { WILD } from "./gentle.js";

// The map's lived-in places (plots/config.js WARDS): the six towns and the Order's two houses.
// The thin places, Bellhollow, Crownhold and the Shut Pass are wild ground and keep their monsters.
export const SHELTERED_WARDS = ["Kingsrest", "Millbrook", "Rimehold", "Gull's Rest", "Sunscar", "Mirelight", "the Ashen Gate Chapterhouse", "the Ashen Watch"];
const TOWN_WARDS = WARDS.filter((w) => SHELTERED_WARDS.includes(w.name));

export const OVERWORLD_ID = "minecraft:overworld";
const WILD_SET = new Set(WILD);
const SPAWNED = "Spawned"; // EntityInitializationCause.Spawned
// Natural spawns never land closer than this to a player; spawn eggs and /summon land right next to one
export const NEAR = 24;

// Pure: is this spot inside one of the towns' wards?
export const townWardAt = (location, wards = TOWN_WARDS) => wards.find((w) => Math.hypot(location.x - w.x, location.z - w.z) <= w.r);

// Is this spot inside someone's walls (their settlement land) or a town? Only the overworld has either.
export function shelteredAt(location, dimensionId = OVERWORLD_ID) {
  if (dimensionId !== OVERWORLD_ID) return false;
  if (settlementAt(location)) return true;
  return mapMode() && !!townWardAt(location);
}

// Pure: should this freshly spawned creature go?
export function bornInside({ typeId, cause, tags = [], nameTag = "", nearestPlayer = Infinity, sheltered }) {
  if (!WILD_SET.has(typeId)) return false;
  if (cause !== undefined && cause !== SPAWNED) return false; // loaded, born, bred, transformed
  if (tags.length || nameTag) return false; // ours on purpose: sieges, bosses, rumor jobs, the showcase
  if (nearestPlayer < NEAR) return false; // a spawn egg or /summon
  return !!sheltered;
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
  if (!WILD_SET.has(typeId) || cause !== SPAWNED) return;
  system.run(() => { // a tick later, so whoever spawned it on purpose has put its tags and name on
    try {
      if (!entity.isValid) return;
      const dim = entity.dimension;
      if (dim.id !== OVERWORLD_ID) return;
      const sheltered = shelteredAt(entity.location, dim.id);
      if (!sheltered) return;
      if (bornInside({ typeId, cause, tags: entity.getTags(), nameTag: entity.nameTag, nearestPlayer: nearestPlayer(entity), sheltered })) entity.remove();
    } catch { /* gone already, or its chunk unloaded */ }
  });
});

addTests("sheltered", {
  "every sheltered place is a real ward on the map": () => {
    for (const name of SHELTERED_WARDS) assert(WARDS.some((w) => w.name === name), `${name} is in WARDS`);
    assert(!SHELTERED_WARDS.some((n) => WARDS.find((w) => w.name === n)?.thin), "the thin places stay wild");
  },
  "a wild monster the game spawns inside the walls goes": () => {
    assert(bornInside({ typeId: "siege:rimewolf", cause: SPAWNED, nearestPlayer: 40, sheltered: true }));
    assert(bornInside({ typeId: "siege:mire_toad", cause: SPAWNED, sheltered: true }), "no player in reach");
  },
  "out in the wild, it stays": () => {
    assert(!bornInside({ typeId: "siege:rimewolf", cause: SPAWNED, nearestPlayer: 40, sheltered: false }));
  },
  "siege raiders, rumor quarry, eggs, animals and loaded mobs stay": () => {
    const S = SPAWNED;
    assert(!bornInside({ typeId: "siege:rimewolf", cause: S, tags: ["siege_raider"], sheltered: true }), "tagged");
    assert(!bornInside({ typeId: "siege:bog_hag", cause: S, nameTag: "Old Gammer Reed", sheltered: true }), "named");
    assert(!bornInside({ typeId: "siege:rimewolf", cause: S, nearestPlayer: 3, sheltered: true }), "spawn egg");
    assert(!bornInside({ typeId: "siege:frost_stag", cause: S, sheltered: true }), "animals");
    assert(!bornInside({ typeId: "siege:hollow_footman", cause: S, sheltered: true }), "siege troops are not wild spawns");
    assert(!bornInside({ typeId: "siege:rimewolf", cause: "Loaded", sheltered: true }), "loaded from the world");
  },
  "towns are sheltered, the wild between them is not": () => {
    assert(townWardAt({ x: -150, z: -150 })?.name === "Kingsrest");
    assert(townWardAt({ x: 850, z: 450 })?.name === "Sunscar");
    assert(!townWardAt({ x: 120, z: 520 }), "King's Barrow is a thin place, wild");
    assert(!townWardAt({ x: 300, z: 300 }), "open country");
  },
});
