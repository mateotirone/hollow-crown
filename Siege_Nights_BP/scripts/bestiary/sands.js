// The sands stay sparse (Mateo, playtest 2026-11-14: "Too many sand worms spawn").
//
// The Emberwaste's two wild monsters, the Dune Wyrm and the Ash Scarab, spawn by day as well as by night, and with
// vanilla monsters switched off they were the only things filling the desert's monster cap. So they were constant.
// The spawn rules now ask for fewer and smaller groups (studio/bestiary/roster.py), and this thins what is left:
//   1. Only a share of the herds the game rolls are kept (SANDS.keep). A herd is kept or dropped whole.
//   2. Near a road, a railway or a settlement/town (SANDS.calmRadius / SANDS.roadRadius) far fewer are kept
//      (SANDS.keepNearFolk): the roads are where people travel, the deep dunes are where the wyrms hunt.
//   3. A local cap: no new wyrm within SANDS.wyrmGap of another, no new scarab herd where SANDS.scarabCap are already about.
//
// Every region, not just the sands (Mateo 2026-11-14: "and the spawn rates?"): with vanilla monsters off, each
// region's own wild monsters fill its whole monster cap the same way, so the same thinning now covers all seven
// (SANDS.keep), with the same calm near roads and settlements and a local cap per kind (SANDS.wildCap).
// Inside walls nothing wild spawns at all (sheltered.js). Tagged or named ones (rumor jobs, bosses, the showcase),
// spawn eggs and /summon are never touched. Runs after spawning, a tick later, like gentle.js and sheltered.js.

import { world, system } from "@minecraft/server";
import { settlementAt, addTests, assert, assertEqual } from "../siege/api.js";
import { WARDS } from "../plots/config.js";
import { mapMode } from "../plots/claims.js";
import { WILD } from "./gentle.js";

export const WYRM = "siege:dune_wyrm", SCARAB = "siege:ash_scarab";
export const SANDS = {
  // share of herds kept out in the open wild (every type in gentle.js WILD has a line)
  keep: { [WYRM]: 0.4, [SCARAB]: 0.5, "siege:rimewolf": 0.5, "siege:brine_lurker": 0.5, "siege:barrow_wight": 0.5, "siege:bog_hag": 0.5, "siege:mire_toad": 0.5 },
  keepNearFolk: 0.1, // share kept near roads, rails, settlements and towns
  roadRadius: 12, // a road or rail this close counts as "near a road"
  calmRadius: 48, // this far beyond a settlement's or town's edge is still "near folk"
  wyrmGap: 64, // no second wyrm inside this
  scarabCap: 4, // no new herd where this many scarabs already are, inside scarabGap
  scarabGap: 40,
  wildCap: 4, // the other regions' creatures: no new herd where this many of the same kind are already about, inside wildGap
  wildGap: 40,
};
// What the map's roads, trails, town streets and rail beds are made of (map/genworld.py road surface, the regions' street slabs)
export const ROAD_TOPS = /^minecraft:(grass_path|dirt_path|cobblestone|mossy_cobblestone|cobblestone_slab|stone_bricks|smooth_sandstone_slab|smooth_red_sandstone_slab|cut_red_sandstone_slab|cut_sandstone_slab|rail|golden_rail|detector_rail|activator_rail)$/;
const PLACED_REACH = 2; // /summon ~ puts it right on the player
const EGG_TICKS = 20;

// Pure: is this ground under someone's road? (a single block id)
export const isRoadTop = (typeId) => ROAD_TOPS.test(typeId ?? "");

// Pure: how many of this kind of herd to keep, 0 to 1
export function keepShare(typeId, { nearFolk = false } = {}, s = SANDS) {
  const base = s.keep[typeId];
  if (base === undefined) return 1;
  return nearFolk ? Math.min(base, s.keepNearFolk) : base;
}

// Pure: would one more of these crowd the spot? others = how many untagged ones of the same kind are already in range
export function crowded(typeId, others, s = SANDS) {
  if (typeId === WYRM) return others >= 1;
  if (typeId === SCARAB) return others >= s.scarabCap;
  if (s.keep[typeId] !== undefined) return others >= s.wildCap;
  return false;
}

// Pure: is this spot inside a town's ward or within `margin` of it?
export const nearTownWard = (location, margin = SANDS.calmRadius, wards = WARDS.filter((w) => !w.thin)) =>
  wards.some((w) => Math.hypot(location.x - w.x, location.z - w.z) <= w.r + margin);

function nearSettlement(location) {
  const m = SANDS.calmRadius;
  for (const [dx, dz] of [[0, 0], [m, 0], [-m, 0], [0, m], [0, -m], [m * 0.7, m * 0.7], [-m * 0.7, m * 0.7], [m * 0.7, -m * 0.7], [-m * 0.7, -m * 0.7]]) {
    if (settlementAt({ x: location.x + dx, z: location.z + dz })) return true;
  }
  return mapMode() && nearTownWard(location);
}

function nearRoad(dim, location) {
  const r = SANDS.roadRadius, step = r / 2;
  for (let dx = -r; dx <= r; dx += step) {
    for (let dz = -r; dz <= r; dz += step) {
      try {
        const b = dim.getTopmostBlock({ x: Math.floor(location.x + dx), z: Math.floor(location.z + dz) });
        if (b && isRoadTop(b.typeId)) return true;
      } catch { /* not loaded */ }
    }
  }
  return false;
}

// A herd arrives in one tick at one spot: the first member rolls for the lot, the rest follow it
const herdRolls = new Map(); // "type:tick:cx:cz" -> keep?

const eggUse = new Map(); // player id -> tick a spawn egg was used
const noteEgg = ({ source, itemStack }) => { try { if (itemStack?.typeId?.endsWith("_spawn_egg")) eggUse.set(source.id, system.currentTick); } catch { /* gone */ } };
world.afterEvents.itemUseOn?.subscribe?.(noteEgg);
world.afterEvents.itemUse?.subscribe?.(noteEgg);
function placed(entity) {
  const at = entity.location;
  for (const p of entity.dimension.getPlayers({ location: at, maxDistance: 8 })) {
    const l = p.location;
    if (Math.hypot(l.x - at.x, l.y - at.y, l.z - at.z) <= PLACED_REACH) return true;
    if (system.currentTick - (eggUse.get(p.id) ?? -1e9) <= EGG_TICKS) return true;
  }
  return false;
}

const born = new Map(); // entity id -> tick it spawned (to tell herd mates from earlier arrivals)

world.afterEvents.entitySpawn.subscribe(({ entity, cause }) => {
  let typeId;
  try { typeId = entity.typeId; } catch { return; }
  if (SANDS.keep[typeId] === undefined) return;
  if (cause !== undefined && cause !== "Spawned") return; // loaded from the world, bred, etc.
  const tick = system.currentTick;
  try { born.set(entity.id, tick); } catch { return; }
  system.run(() => { // a tick later, so whoever spawned it on purpose has put its tags and name on
    try {
      if (!entity.isValid || entity.getTags().length || entity.nameTag || placed(entity)) return;
      const key = `${typeId}:${tick}:${Math.floor(entity.location.x / 16)}:${Math.floor(entity.location.z / 16)}`;
      let keep = herdRolls.get(key);
      if (keep === undefined) {
        const dim = entity.dimension;
        const nearFolk = nearSettlement(entity.location) || nearRoad(dim, entity.location);
        keep = Math.random() < keepShare(typeId, { nearFolk });
        if (keep) {
          let n = 0;
          for (const e of dim.getEntities({ type: typeId, location: entity.location, maxDistance: typeId === WYRM ? SANDS.wyrmGap : typeId === SCARAB ? SANDS.scarabGap : SANDS.wildGap })) {
            if (e.id === entity.id || born.get(e.id) === tick) continue; // itself and its herd mates
            try { if (e.getTags().length || e.nameTag) continue; } catch { continue; }
            n++;
          }
          keep = !crowded(typeId, n);
        }
        herdRolls.set(key, keep);
      }
      if (!keep) entity.remove();
    } catch { /* gone already, or its chunk unloaded */ }
  });
  if (herdRolls.size > 200) herdRolls.clear();
  if (born.size > 500) born.clear();
});

addTests("bestiary", {
  "the sands keep only some herds, and far fewer by the roads and towns": () => {
    assertEqual(keepShare(WYRM), 0.4);
    assertEqual(keepShare(SCARAB), 0.5);
    assertEqual(keepShare(WYRM, { nearFolk: true }), SANDS.keepNearFolk);
    assert(keepShare(SCARAB, { nearFolk: true }) < keepShare(SCARAB), "rarer near folk");
    assertEqual(keepShare("siege:rimewolf"), 0.5, "every region is thinned now");
    assertEqual(keepShare("siege:rimewolf", { nearFolk: true }), SANDS.keepNearFolk);
    assertEqual(keepShare("siege:frost_stag"), 1, "animals untouched");
    for (const id of WILD) assert(SANDS.keep[id] !== undefined, `${id} has a keep share`);
  },
  "one wyrm to a stretch of dunes, and scarab swarms don't stack": () => {
    assert(!crowded(WYRM, 0));
    assert(crowded(WYRM, 1));
    assert(!crowded(SCARAB, 3));
    assert(crowded(SCARAB, 4));
    assert(!crowded("siege:rimewolf", 3));
    assert(crowded("siege:rimewolf", SANDS.wildCap));
  },
  "roads, streets and rails count as roads; sand and gravel don't": () => {
    for (const id of ["minecraft:grass_path", "minecraft:cobblestone", "minecraft:smooth_red_sandstone_slab", "minecraft:rail"]) assert(isRoadTop(id), id);
    for (const id of ["minecraft:sand", "minecraft:red_sand", "minecraft:gravel", "minecraft:sandstone", undefined]) assert(!isRoadTop(id), String(id));
  },
  "Sunscar's outskirts are near folk, the open Emberwaste is not": () => {
    assert(nearTownWard({ x: 850, z: 450 }), "in Sunscar");
    assert(nearTownWard({ x: 850 + 80 + 40, z: 450 }), "just outside Sunscar's ward");
    assert(!nearTownWard({ x: 850 + 80 + 100, z: 450 }), "out in the dunes");
  },
});
