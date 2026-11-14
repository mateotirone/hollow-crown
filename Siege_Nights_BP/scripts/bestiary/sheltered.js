// Safe inside the walls (Mateo, 2026-11-13: "The hostile mobs can't spawn inside your walls. Only outside in the wild";
// 2026-11-14 after playtest: "The mobs spawning inside the walls are so annoying").
//
// Nothing hostile and wild is ever inside a player's settlement land or one of the map's lived-in towns.
// Sieges and raids are the deliberate exception: they come from outside (raiders spawn past the land's edge,
// siege/siege.js "spawnDistance") and march in, and everything our scripts send is tagged or named, so it is never touched.
//
// Three layers:
//   1. Our own spawners (Hollow things at night, Seeps, the long march's pickets) ask shelteredAt() before they pick a spot.
//   2. Natural spawns from spawn_rules/ can't be told where not to go (Bedrock spawn rules have no position filter),
//      so a wild creature the game spawns on sheltered ground is removed a tick later.
//   3. The sweep: every two seconds, round each player standing inside walls, any wild hostile (untagged, unnamed) on
//      sheltered ground fades away. This catches what the first two can't: herd members the game drops close to a
//      player, and night things or wolves that spawned just outside and walked in through the gate.
//   Spawn eggs and /summon are left alone. Vanilla monsters never spawn anywhere (core/nomonsters.js).
//   Cost: one Set lookup per spawned entity; the sweep is one entity query per player inside walls, every 40 ticks.

import { world, system } from "@minecraft/server";
import { settlementAt, onTick, addTests, assert } from "../siege/api.js";
import { WARDS } from "../plots/config.js";
import { mapMode } from "../plots/claims.js";
import { WILD } from "./gentle.js";
import { MOBS } from "./data.js";

// The map's lived-in places (plots/config.js WARDS): the six towns and the Order's two houses.
// The thin places, Bellhollow, Crownhold and the Shut Pass are wild ground and keep their monsters.
export const SHELTERED_WARDS = ["Kingsrest", "Millbrook", "Rimehold", "Gull's Rest", "Sunscar", "Mirelight", "the Ashen Gate Chapterhouse", "the Ashen Watch"];
const TOWN_WARDS = WARDS.filter((w) => SHELTERED_WARDS.includes(w.name));

export const OVERWORLD_ID = "minecraft:overworld";
// Every wild hostile: the region creatures (gentle.js WILD), the barrow wights and the Hollow things that walk the night.
// Gloamwings live only in the Hollow. Raiders, bosses, champions and the Order are never wild: they come on purpose.
export const WILD_FAMILIES = ["wild_hostile", "undead", "hollow"];
export const WILD_HOSTILE = new Set([...WILD, ...Object.keys(MOBS).filter((id) => WILD_FAMILIES.includes(MOBS[id].family) && id !== "siege:gloamwing")]);
const SPAWNED = "Spawned"; // EntityInitializationCause.Spawned
export const SWEEP = { every: 40, radius: 48 };
// A spawn egg puts its mob within this of the player who used it, in the same moment; /summon ~ right on them
export const EGG_REACH = 8, EGG_TICKS = 20, SUMMON_REACH = 2;

// Pure: is this spot inside one of the towns' wards?
export const townWardAt = (location, wards = TOWN_WARDS) => wards.find((w) => Math.hypot(location.x - w.x, location.z - w.z) <= w.r);

// Is this spot inside someone's walls (their settlement land) or a town? Only the overworld has either.
export function shelteredAt(location, dimensionId = OVERWORLD_ID) {
  if (dimensionId !== OVERWORLD_ID) return false;
  if (settlementAt(location)) return true;
  return mapMode() && !!townWardAt(location);
}

// Pure: is this a wild hostile that has no business inside the walls?
export function strayInside({ typeId, tags = [], nameTag = "", sheltered, placed = false }) {
  if (!WILD_HOSTILE.has(typeId)) return false;
  if (tags.length || nameTag) return false; // ours on purpose: sieges, bosses, rumor jobs, seep guards, the showcase
  if (placed) return false; // a spawn egg or /summon
  return !!sheltered;
}
// Pure: should this freshly spawned creature go?
export function bornInside({ cause, ...rest }) {
  if (cause !== undefined && cause !== SPAWNED) return false; // loaded, born, bred, transformed
  return strayInside(rest);
}

// Spawn eggs: who used one, and when
const eggUse = new Map(); // player id -> tick
world.afterEvents.itemUseOn?.subscribe?.(({ source, itemStack }) => {
  try { if (itemStack?.typeId?.endsWith("_spawn_egg")) eggUse.set(source.id, system.currentTick); } catch { /* gone */ }
});
world.afterEvents.itemUse?.subscribe?.(({ source, itemStack }) => {
  try { if (itemStack?.typeId?.endsWith("_spawn_egg")) eggUse.set(source.id, system.currentTick); } catch { /* gone */ }
});
function placedByPlayer(entity) {
  const at = entity.location;
  for (const p of entity.dimension.getPlayers({ location: at, maxDistance: EGG_REACH })) {
    const l = p.location, d = Math.hypot(l.x - at.x, l.y - at.y, l.z - at.z);
    if (d <= SUMMON_REACH) return true;
    if (system.currentTick - (eggUse.get(p.id) ?? -1e9) <= EGG_TICKS) return true;
  }
  return false;
}

function fade(entity) {
  try { entity.dimension.spawnParticle("minecraft:large_smoke_particle", { x: entity.location.x, y: entity.location.y + 1, z: entity.location.z }); } catch { /* fine */ }
  entity.remove();
}

world.afterEvents.entitySpawn.subscribe(({ entity, cause }) => {
  let typeId;
  try { typeId = entity.typeId; } catch { return; }
  if (!WILD_HOSTILE.has(typeId) || cause !== SPAWNED) return;
  system.run(() => { // a tick later, so whoever spawned it on purpose has put its tags and name on
    try {
      if (!entity.isValid) return;
      const dim = entity.dimension;
      if (dim.id !== OVERWORLD_ID) return;
      const sheltered = shelteredAt(entity.location, dim.id);
      if (!sheltered) return;
      if (bornInside({ typeId, cause, tags: entity.getTags(), nameTag: entity.nameTag, sheltered, placed: placedByPlayer(entity) })) entity.remove();
    } catch { /* gone already, or its chunk unloaded */ }
  });
});

// The sweep, round players who are inside walls
const seenPlaced = new Set(); // entity ids left alone because a player put them there (eggs, /summon)
world.afterEvents.entitySpawn.subscribe(({ entity }) => {
  try { if (WILD_HOSTILE.has(entity.typeId)) system.run(() => { try { if (entity.isValid && placedByPlayer(entity)) seenPlaced.add(entity.id); } catch { /* gone */ } }); } catch { /* gone */ }
});
onTick("sheltered_sweep", SWEEP.every, () => {
  let dim;
  try { dim = world.getDimension(OVERWORLD_ID); } catch { return; }
  const done = new Set();
  for (const p of dim.getPlayers()) {
    try {
      if (!shelteredAt(p.location, OVERWORLD_ID)) continue;
      for (const e of dim.getEntities({ location: p.location, maxDistance: SWEEP.radius, families: ["monster"] })) {
        if (done.has(e.id)) continue;
        done.add(e.id);
        if (!WILD_HOSTILE.has(e.typeId) || seenPlaced.has(e.id)) continue;
        if (strayInside({ typeId: e.typeId, tags: e.getTags(), nameTag: e.nameTag, sheltered: shelteredAt(e.location, OVERWORLD_ID) })) fade(e);
      }
    } catch { /* that spot wasn't loaded */ }
  }
  if (seenPlaced.size > 500) seenPlaced.clear();
});

addTests("sheltered", {
  "every sheltered place is a real ward on the map": () => {
    for (const name of SHELTERED_WARDS) assert(WARDS.some((w) => w.name === name), `${name} is in WARDS`);
    assert(!SHELTERED_WARDS.some((n) => WARDS.find((w) => w.name === n)?.thin), "the thin places stay wild");
  },
  "a wild monster the game spawns inside the walls goes": () => {
    assert(bornInside({ typeId: "siege:rimewolf", cause: SPAWNED, sheltered: true }));
    assert(bornInside({ typeId: "siege:ash_scarab", cause: SPAWNED, sheltered: true }), "Emberwaste by day too");
    assert(bornInside({ typeId: "siege:lost_villager", cause: SPAWNED, sheltered: true }), "Hollow things");
  },
  "out in the wild, it stays": () => {
    assert(!bornInside({ typeId: "siege:rimewolf", cause: SPAWNED, sheltered: false }));
  },
  "siege raiders, rumor quarry, eggs, animals and loaded mobs stay": () => {
    const S = SPAWNED;
    assert(!bornInside({ typeId: "siege:rimewolf", cause: S, tags: ["siege_raider"], sheltered: true }), "tagged");
    assert(!bornInside({ typeId: "siege:bog_hag", cause: S, nameTag: "Old Gammer Reed", sheltered: true }), "named");
    assert(!bornInside({ typeId: "siege:rimewolf", cause: S, sheltered: true, placed: true }), "spawn egg or /summon");
    assert(!bornInside({ typeId: "siege:frost_stag", cause: S, sheltered: true }), "animals");
    assert(!bornInside({ typeId: "siege:hollow_footman", cause: S, sheltered: true }), "siege troops are not wild spawns");
    assert(!bornInside({ typeId: "siege:rimewolf", cause: "Loaded", sheltered: true }), "loaded from the world");
  },
  "the sweep clears wild things that walked in, and nothing that came on purpose": () => {
    assert(strayInside({ typeId: "siege:dune_wyrm", sheltered: true }), "a wyrm that walked in through the gate");
    assert(strayInside({ typeId: "siege:barrow_wight", sheltered: true }));
    assert(!strayInside({ typeId: "siege:dune_wyrm", sheltered: false }), "outside the walls it stays");
    assert(!strayInside({ typeId: "siege:wrongling", tags: ["siege_seep_guard"], sheltered: true }), "tagged");
    assert(!strayInside({ typeId: "siege:veinsworn", sheltered: true }), "siege troops");
    assert(!strayInside({ typeId: "siege:grey_spearman", sheltered: true }), "siege troops");
    assert(!strayInside({ typeId: "siege:gloamwing", sheltered: true }), "Hollow-only flyers are not overworld wild");
    for (const id of WILD) assert(WILD_HOSTILE.has(id), `${id} is wild`);
  },
  "towns are sheltered, the wild between them is not": () => {
    assert(townWardAt({ x: -150, z: -150 })?.name === "Kingsrest");
    assert(townWardAt({ x: 850, z: 450 })?.name === "Sunscar");
    assert(!townWardAt({ x: 120, z: 520 }), "King's Barrow is a thin place, wild");
    assert(!townWardAt({ x: 300, z: 300 }), "open country");
  },
});
