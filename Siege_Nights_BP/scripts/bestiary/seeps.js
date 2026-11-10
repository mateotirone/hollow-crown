// Seep sites: places in the overworld where the Hollow pushes through.
//
// Once the Hollow is awake (the first boss has fallen anywhere), a Seep opens now and then somewhere
// near a player, day or night, whether one person is online or ten. Hollow things climb out of it and
// stand guard. While any guard is close it can't be harmed; kill them, then break the Seep to close it.
// Left alone it widens (levels 1 to 3: more guards, tougher ones), and a level 3 Seep splits off a new one.
// This is the part of the game that never runs out: it needs no story progress and no other players.
//
// The Seep itself is an entity (siege:seep), so nothing is written into the map and no blocks change.

import { world } from "@minecraft/server";
import { on, onTick, settlementAt, addTests, assert, assertEqual } from "../siege/api.js";
import { bestiaryStore } from "./bossCore.js";
import { announce, effect, flat, healthOf, heal, particle, pickOne, ring, sound } from "./util.js";

export const SEEP_SETTINGS = {
  everySeconds: 600, // each player gets a roll this often...
  chance: 0.35, // ...with this chance of a Seep opening near them
  nearbyCap: 2, // never more than this many within 160 blocks of a player
  minDistance: 36, maxDistance: 60, // how far from the player it opens (close enough to be loaded, far enough to go looking)
  widenSeconds: 900, // loaded time before it grows a level
  guardRadius: 12,
};
const SEEP = "siege:seep";
const FED_TAG = "siege_seep_fed";
const GUARD_TAG = "siege_seep_guard";
const AGE_PROP = "siege:seep_age", LEVEL_PROP = "siege:seep_level";
const STEP = 40;
const GUARDS = [
  ["siege:lost_villager", "siege:lost_villager", "siege:changeling"],
  ["siege:lost_villager", "siege:changeling", "siege:wrongling", "siege:tolling_shade"],
  ["siege:wrongling", "siege:tolling_shade", "siege:stone_vigil", "siege:mirror_knight", "siege:echo_hound"],
];

// Pure pieces, so the self-tests can check them
export const seepLevel = (ageSeconds) => Math.min(3, 1 + Math.floor(ageSeconds / SEEP_SETTINGS.widenSeconds));
export const guardsWanted = (level, playerCount) => level + 1 + Math.min(3, Math.max(0, playerCount - 1));
export function shouldOpen({ awake, nearby, roll }) {
  return awake && nearby < SEEP_SETTINGS.nearbyCap && roll < SEEP_SETTINGS.chance;
}

function openSeep(dim, at, level = 1) {
  const seep = dim.spawnEntity(SEEP, at);
  seep.setDynamicProperty(LEVEL_PROP, level);
  seep.setDynamicProperty(AGE_PROP, (level - 1) * SEEP_SETTINGS.widenSeconds);
  sound(dim, "ambient.cave", at, 1, 0.6);
  for (const p of dim.getPlayers({ location: at, maxDistance: 96 })) {
    p.sendMessage("§5Something gives way nearby. §7The Hollow is seeping through.");
  }
  announce("siege:seep_opened", { x: Math.floor(at.x), y: Math.floor(at.y), z: Math.floor(at.z), dimension: dim.id, level });
  return seep;
}

function groundNear(dim, from, min, max) {
  const a = Math.random() * Math.PI * 2, d = min + Math.random() * (max - min);
  const x = Math.floor(from.x + Math.cos(a) * d), z = Math.floor(from.z + Math.sin(a) * d);
  const ground = dim.getTopmostBlock({ x, z });
  if (!ground || ground.isLiquid) return undefined;
  const at = { x: x + 0.5, y: ground.location.y + 1, z: z + 0.5 };
  return settlementAt(at) ? undefined : at; // never inside someone's walls
}

function openTick() {
  for (const p of world.getPlayers()) {
    try {
      const dim = p.dimension;
      if (dim.id !== "minecraft:overworld") continue;
      const nearby = dim.getEntities({ type: SEEP, location: p.location, maxDistance: 160 }).length;
      if (!shouldOpen({ awake: bestiaryStore.data.hollowAwake, nearby, roll: Math.random() })) continue;
      const at = groundNear(dim, p.location, SEEP_SETTINGS.minDistance, SEEP_SETTINGS.maxDistance);
      if (at) openSeep(dim, at);
    } catch {
      // that spot wasn't loaded
    }
  }
}
onTick("bestiary_seep_open", SEEP_SETTINGS.everySeconds * 20, openTick);

function seepTick() {
  let dim;
  try {
    dim = world.getDimension("overworld");
  } catch {
    return;
  }
  let seeps = [];
  try {
    seeps = dim.getEntities({ type: SEEP });
  } catch {
    return;
  }
  for (const seep of seeps) {
    try {
      if (seep.hasTag("siege_showcase")) continue;
      const at = seep.location;
      const players = dim.getPlayers({ location: at, maxDistance: 48 });
      const age = (seep.getDynamicProperty(AGE_PROP) ?? 0) + STEP / 20;
      seep.setDynamicProperty(AGE_PROP, age);
      const was = seep.getDynamicProperty(LEVEL_PROP) ?? 1, level = seepLevel(age);
      if (level > was) {
        seep.setDynamicProperty(LEVEL_PROP, level);
        heal(seep, 1000);
        for (const p of players) p.sendMessage("§5The Seep widens.");
        sound(dim, "mob.warden.heartbeat", at, 1.5, 0.6);
      }
      // a Seep that has been wide open for a whole further stretch splits, once
      if (level === 3 && !seep.hasTag("siege_seep_split") && age > SEEP_SETTINGS.widenSeconds * 3) {
        seep.addTag("siege_seep_split");
        const bud = groundNear(dim, at, 24, 40);
        if (bud) openSeep(dim, bud);
      }
      particle(dim, "minecraft:portal_directional", { x: at.x, y: at.y + 1.2, z: at.z });
      if (!players.length) continue;
      ring(dim, at, 1.5 + level, "minecraft:sculk_soul_particle");
      // guards: the things that came through
      const guards = dim.getEntities({ tags: [GUARD_TAG], location: at, maxDistance: SEEP_SETTINGS.guardRadius });
      const fed = guards.length > 0;
      if (fed !== seep.hasTag(FED_TAG)) fed ? seep.addTag(FED_TAG) : seep.removeTag(FED_TAG);
      const due = (seep.getDynamicProperty("siege:seep_next") ?? 0) <= age;
      if (due && guards.length < guardsWanted(level, players.length)) {
        const a = Math.random() * Math.PI * 2;
        const g = dim.spawnEntity(pickOne(GUARDS[level - 1]), { x: at.x + Math.cos(a) * 3, y: at.y, z: at.z + Math.sin(a) * 3 });
        g.addTag(GUARD_TAG);
        sound(dim, "mob.endermen.portal", at, 0.7, 0.5);
        seep.setDynamicProperty("siege:seep_next", age + (guards.length ? 20 : 4)); // quick first guard, then one every 20 seconds
      }
      // standing in it is a bad idea
      for (const p of players) if (flat(p.location, at) < 2.5 && healthOf(p).now > 0) effect(p, "darkness", 60, 0);
    } catch {
      // unloaded mid-tick
    }
  }
}
onTick("bestiary_seeps", STEP, seepTick);

// Closing one
world.afterEvents.entityHurt.subscribe((event) => {
  if (event.hurtEntity.typeId !== SEEP || !event.hurtEntity.hasTag(FED_TAG)) return;
  const by = event.damageSource.damagingEntity;
  if (by?.typeId === "minecraft:player") by.onScreenDisplay?.setActionBar("§5It won't close while its guards are standing.");
});

world.afterEvents.entityDie.subscribe((event) => {
  const seep = event.deadEntity;
  if (seep.typeId !== SEEP) return;
  try {
    const at = seep.location, dim = seep.dimension;
    const level = seep.getDynamicProperty(LEVEL_PROP) ?? 1;
    const players = dim.getPlayers({ location: at, maxDistance: 32 });
    sound(dim, "random.glass", at, 1.2, 0.5);
    particle(dim, "minecraft:large_explosion", { x: at.x, y: at.y + 1, z: at.z });
    for (const p of players) {
      p.sendMessage("§dThe Seep closes. §7The air here is ordinary again.");
      announce("siege:award_skill_points", { player: p.id, points: level >= 3 ? 1 : 0, renown: 25 * level, reason: "seep_closed" });
    }
    announce("siege:seep_closed", { x: Math.floor(at.x), y: Math.floor(at.y), z: Math.floor(at.z), dimension: dim.id, level, players: players.map((p) => p.id) });
  } catch {
    // closed out of sight
  }
});

// ---------- the Hollow's guardians ----------
// When nobody who rules the Hollow can answer in person (an NPC ruler, or a player ruler who is offline),
// the Hollow answers for them: guardians step out beside a thief at the ore, or around anyone who
// raises a hand to the NPC ruler. The Hollow thread sends these events (undertow/warden.js, regent.js).
const GUARDIANS = ["siege:mirror_knight", "siege:wrongling", "siege:tolling_shade", "siege:stone_vigil"];
const lastGuardians = new Map(); // player id -> Date.now() of the last wave sent at them
export const guardiansFor = (playerCount, attackOnRuler) => (attackOnRuler ? 3 : 2) + Math.min(3, Math.max(0, playerCount - 1));

function sendGuardians(playerRef, at, attackOnRuler) {
  try {
    const player = typeof playerRef === "string" ? world.getPlayers().find((p) => p.id === playerRef || p.name === playerRef) : playerRef;
    if (!player) return;
    const now = Date.now();
    if (now - (lastGuardians.get(player.id) ?? 0) < (attackOnRuler ? 25000 : 60000)) return;
    lastGuardians.set(player.id, now);
    const dim = player.dimension, centre = at ?? player.location;
    const count = guardiansFor(dim.getPlayers({ location: centre, maxDistance: 32 }).length, attackOnRuler);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random();
      const g = dim.spawnEntity(pickOne(GUARDIANS), { x: centre.x + Math.cos(a) * 5, y: centre.y + 0.2, z: centre.z + Math.sin(a) * 5 });
      g.addTag("siege_hollow_guardian");
    }
    sound(dim, "mob.warden.nearby_close", centre, 1.2, 0.7);
    player.onScreenDisplay.setActionBar(attackOnRuler ? "§5The Hollow rises to defend its ruler." : "§5The Hollow has noticed you.");
  } catch {
    // player left or the spot isn't loaded
  }
}
on("oreAlarm", (e) => {
  if (e?.regent || e?.wardenOnline === false) sendGuardians(e.miner, e.x === undefined ? undefined : { x: e.x + 0.5, y: e.y, z: e.z + 0.5 }, false);
});
on("regentAttacked", (e) => sendGuardians(e?.player, undefined, true));

addTests("bestiary", {
  "the Hollow sends guardians sized to the party": () => {
    assertEqual(guardiansFor(1, false), 2);
    assertEqual(guardiansFor(1, true), 3);
    assertEqual(guardiansFor(10, true), 6);
  },
  "Seeps wait for the Hollow to wake and never crowd a player": () => {
    assert(!shouldOpen({ awake: false, nearby: 0, roll: 0 }), "asleep");
    assert(shouldOpen({ awake: true, nearby: 0, roll: 0 }), "awake");
    assert(!shouldOpen({ awake: true, nearby: SEEP_SETTINGS.nearbyCap, roll: 0 }), "capped");
    assert(!shouldOpen({ awake: true, nearby: 0, roll: 0.99 }), "unlucky");
  },
  "a Seep widens with time and is still closable alone": () => {
    assertEqual(seepLevel(0), 1);
    assertEqual(seepLevel(SEEP_SETTINGS.widenSeconds), 2);
    assertEqual(seepLevel(SEEP_SETTINGS.widenSeconds * 50), 3);
    assertEqual(guardsWanted(1, 1), 2);
    assertEqual(guardsWanted(3, 1), 4);
    assertEqual(guardsWanted(3, 10), 7);
  },
});
