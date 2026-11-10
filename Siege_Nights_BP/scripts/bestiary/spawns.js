// Where the new mobs come from, beyond the natural spawns in spawn_rules/:
//   1. Sieges: as a settlement survives more sieges, the Choir's own raiders replace the vanilla ones.
//   2. Hollow things: they walk the night once the first boss has fallen, and haunt the Undertow.

import { world } from "@minecraft/server";
import { addRaiderTypeHook, keepOf, isNight, settlementAt, onTick, RAM_TAG, SAPPER_TAG, WARLORD_TAG, KING_TAG, addTests, assert, assertEqual } from "../siege/api.js";
import { UNDERTOW_ID } from "../undertow/layout.js";
import { bestiaryStore } from "./bossCore.js";
import { warlordBody } from "./bosses.js";
import { heroOf, pickOne } from "./util.js";

export const SPAWN_SETTINGS = {
  choirFromSiege: 3, // Choir raiders start appearing in a settlement's 3rd siege...
  choirPerSiege: 0.15, // ...and replace 15% more of the army each siege after that...
  choirMax: 0.85, // ...up to 85%
  hollowEverySeconds: 45, // how often each player gets a roll for a Hollow thing nearby
  hollowChanceNight: 0.12,
  hollowChanceUndertow: 0.5,
  hollowNearbyCap: 4,
};

// Which Choir raider takes which vanilla raider's place
const CHOIR = {
  "minecraft:zombie": ["siege:hollow_footman"],
  "minecraft:husk": ["siege:hollow_footman", "siege:torchbearer"],
  "minecraft:vindicator": ["siege:hollow_footman", "siege:shieldwall_brute"],
  "minecraft:skeleton": ["siege:hollow_footman", "siege:torchbearer"],
  "minecraft:stray": ["siege:torchbearer"],
  "minecraft:pillager": ["siege:hollow_footman", "siege:torchbearer"],
  "minecraft:witch": ["siege:bell_ringer"],
  "minecraft:evocation_illager": ["siege:crow_mage"],
  "minecraft:wither_skeleton": ["siege:shieldwall_brute"],
  "minecraft:ravager": ["siege:siege_ogre"],
};

export const choirShare = (sieges) => (sieges < SPAWN_SETTINGS.choirFromSiege ? 0
  : Math.min(SPAWN_SETTINGS.choirMax, (sieges - SPAWN_SETTINGS.choirFromSiege + 1) * SPAWN_SETTINGS.choirPerSiege));

// Pure, so the self-test can check it. `roll` is a random number from 0 to 1.
export function choirSwap(type, tags, sieges, roll = Math.random()) {
  const lord = warlordBody(type, tags);
  if (lord) return lord;
  if (tags.includes(SAPPER_TAG)) return undefined; // sappers keep their job (and their charge)
  const options = CHOIR[type];
  if (!options || roll >= choirShare(sieges)) return undefined;
  return options[Math.floor((roll / choirShare(sieges)) * options.length) % options.length];
}

addRaiderTypeHook((type, { tags = [] }) => {
  const owner = tags.find((t) => t.startsWith("siege_for_"))?.slice("siege_for_".length);
  return choirSwap(type, tags, keepOf(owner)?.sieges ?? 0);
});

// ---------- Hollow things ----------
const NIGHT_HOLLOW = ["siege:lost_villager", "siege:lost_villager", "siege:changeling", "siege:tolling_shade", "siege:wrongling", "siege:stone_vigil"];
const UNDERTOW_HOLLOW = ["siege:wrongling", "siege:stone_vigil", "siege:tolling_shade", "siege:mirror_knight", "siege:echo_hound", "siege:lost_villager", "siege:mirror_knight"];

export function hollowFor({ undertow, marked, resonance, awake, roll }) {
  if (undertow) return roll < SPAWN_SETTINGS.hollowChanceUndertow ? "undertow" : undefined;
  if (marked && resonance >= 70) return roll < 0.5 ? "hound" : undefined; // loud Marked players are always hunted
  if (!awake) return undefined;
  return roll < SPAWN_SETTINGS.hollowChanceNight * (marked ? 2 : 1) ? "night" : undefined;
}

function hollowTick() {
  for (const p of world.getPlayers()) {
    try {
      const dim = p.dimension;
      const undertow = dim.id === UNDERTOW_ID;
      if (!undertow && (dim.id !== "minecraft:overworld" || !isNight())) continue;
      const hero = heroOf(p);
      const kind = hollowFor({ undertow, marked: hero.path === "marked", resonance: hero.resonance ?? 0, awake: bestiaryStore.data.hollowAwake, roll: Math.random() });
      if (!kind) continue;
      if (dim.getEntities({ families: ["hollow"], location: p.location, maxDistance: 48 }).length >= SPAWN_SETTINGS.hollowNearbyCap) continue;
      const a = Math.random() * Math.PI * 2, d = 18 + Math.random() * 10;
      const x = Math.floor(p.location.x + Math.cos(a) * d), z = Math.floor(p.location.z + Math.sin(a) * d);
      const ground = dim.getTopmostBlock({ x, z });
      if (!ground || ground.isLiquid) continue;
      const at = { x: x + 0.5, y: ground.location.y + 1, z: z + 0.5 };
      if (!undertow && settlementAt(at)) continue; // never inside someone's walls
      const type = kind === "hound" ? "siege:echo_hound" : pickOne(kind === "undertow" ? UNDERTOW_HOLLOW : NIGHT_HOLLOW);
      dim.spawnEntity(type, at);
      if (kind === "hound") dim.spawnEntity(type, at); // they hunt in pairs
    } catch {
      // that spot wasn't loaded
    }
  }
}
onTick("bestiary_hollow", SPAWN_SETTINGS.hollowEverySeconds * 20, hollowTick);

addTests("bestiary", {
  "early sieges stay vanilla, later ones turn Hollow": () => {
    assertEqual(choirShare(1), 0);
    assertEqual(choirShare(3), 0.15);
    assertEqual(choirShare(40), 0.85);
    assertEqual(choirSwap("minecraft:zombie", [], 1, 0), undefined);
    assertEqual(choirSwap("minecraft:zombie", [], 10, 0.01), "siege:hollow_footman");
    assertEqual(choirSwap("minecraft:zombie", [], 10, 0.99), undefined);
    assertEqual(choirSwap("minecraft:creeper", [], 10, 0), undefined);
  },
  "rams become ogres, sappers keep their job, warlords get their bodies": () => {
    assertEqual(choirSwap("minecraft:ravager", [RAM_TAG], 10, 0), "siege:siege_ogre");
    assertEqual(choirSwap("minecraft:vindicator", [SAPPER_TAG], 10, 0), undefined);
    assertEqual(choirSwap("minecraft:vindicator", [WARLORD_TAG], 1, 0.99), "siege:hollow_warlord");
    assertEqual(choirSwap("minecraft:vindicator", [KING_TAG], 1, 0.99), "siege:warlord_king");
  },
  "Hollow things wait for the first boss, except for loud Marked players": () => {
    assertEqual(hollowFor({ undertow: false, marked: false, resonance: 0, awake: false, roll: 0 }), undefined);
    assertEqual(hollowFor({ undertow: false, marked: false, resonance: 0, awake: true, roll: 0 }), "night");
    assertEqual(hollowFor({ undertow: false, marked: true, resonance: 80, awake: false, roll: 0.1 }), "hound");
    assertEqual(hollowFor({ undertow: true, marked: false, resonance: 0, awake: false, roll: 0.1 }), "undertow");
    assert(hollowFor({ undertow: true, marked: false, resonance: 0, awake: true, roll: 0.9 }) === undefined);
  },
});
