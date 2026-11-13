// Where the new mobs come from, beyond the natural spawns in spawn_rules/:
//   1. Sieges: as a settlement survives more sieges, the Choir's own raiders replace the vanilla ones.
//   2. Hollow things: they walk the night once the first boss has fallen, and haunt the Undertow.

import { world, system } from "@minecraft/server";
import { addRaiderTypeHook, on, getState, keepOf, isNight, settlementAt, onTick, RAM_TAG, SAPPER_TAG, WARLORD_TAG, KING_TAG, addTests, assert, assertEqual } from "../siege/api.js";
import { UNDERTOW_ID } from "../undertow/layout.js";
import { bestiaryStore } from "./bossCore.js";
import { warlordBody } from "./bosses.js";
import { heroOf, pickOne } from "./util.js";
import { MOBS } from "./data.js";
import { shareFor } from "./gentle.js";
const MOBS_HAVE = (id) => !!MOBS[id];

export const SPAWN_SETTINGS = {
  choirFromSiege: 3, // Choir raiders start appearing in a settlement's 3rd siege...
  choirPerSiege: 0.15, // ...and replace 15% more of the army each siege after that...
  choirMax: 0.85, // ...up to 85%
  // First guesses only. The "Deepen the third-night siege raids" thread owns when each kind appears: setTroopPlan().
  greyFromSiege: 6, greyShare: 0.4, // the Grey Host: this share of the swapped raiders, from this siege on
  watcherSieges: 3, // for this many sieges before they come forward, one stands at the back of the raid and only watches
  watcherDistance: 30, watcherFlees: 9,
  hollowFromSiege: 10, hollowShare: 0.35, // soldiers of the Hollow itself: the first real look at what is down there
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

// The Grey Host: the army the Hollow swallowed three hundred years ago, sent back up
const GREY = {
  "minecraft:zombie": ["siege:grey_spearman"],
  "minecraft:husk": ["siege:grey_axeman", "siege:grey_bellcutter"],
  "minecraft:vindicator": ["siege:grey_axeman", "siege:grey_spearman", "siege:grey_serjeant"],
  "minecraft:skeleton": ["siege:grey_bowman"],
  "minecraft:stray": ["siege:grey_bowman"],
  "minecraft:pillager": ["siege:grey_bowman", "siege:grey_bellcutter"],
  "minecraft:witch": ["siege:grey_bellcutter"],
  "minecraft:evocation_illager": ["siege:grey_serjeant"],
  "minecraft:wither_skeleton": ["siege:grey_serjeant"],
};
// Soldiers of the Hollow itself: not men, and not copies of men
const HOLLOWKIN = {
  "minecraft:zombie": ["siege:veinsworn"],
  "minecraft:husk": ["siege:veinsworn"],
  "minecraft:vindicator": ["siege:veinsworn"],
  "minecraft:skeleton": ["siege:shardcaster"],
  "minecraft:stray": ["siege:shardcaster"],
  "minecraft:pillager": ["siege:veinsworn", "siege:shardcaster"],
  "minecraft:witch": ["siege:shardcaster"],
  "minecraft:evocation_illager": ["siege:shardcaster"],
  "minecraft:wither_skeleton": ["siege:veinsworn"],
  "minecraft:ravager": ["siege:gatebreaker"],
};
export const TROOPS = { choir: CHOIR, grey: GREY, hollow: HOLLOWKIN };

// How the swapped raiders are split between the three kinds: { grey, hollow } shares, the rest are Choir raiders.
export function defaultTroopMix(sieges) {
  return {
    grey: sieges >= SPAWN_SETTINGS.greyFromSiege ? SPAWN_SETTINGS.greyShare : 0,
    hollow: sieges >= SPAWN_SETTINGS.hollowFromSiege ? SPAWN_SETTINGS.hollowShare : 0,
  };
}
let troopPlan = ({ sieges }) => defaultTroopMix(sieges);
// The raids feature decides the story's pacing: setTroopPlan(({ sieges, owner }) => ({ grey: 0..1, hollow: 0..1, swap?: 0..1 }))
export function setTroopPlan(fn) { troopPlan = fn ?? (({ sieges }) => defaultTroopMix(sieges)); }
export const troopKind = (mix, pick) => (pick < (mix?.hollow ?? 0) ? "hollow" : pick < (mix?.hollow ?? 0) + (mix?.grey ?? 0) ? "grey" : "choir");

export const choirShare = (sieges) => (sieges < SPAWN_SETTINGS.choirFromSiege ? 0
  : Math.min(SPAWN_SETTINGS.choirMax, (sieges - SPAWN_SETTINGS.choirFromSiege + 1) * SPAWN_SETTINGS.choirPerSiege));

// Pure, so the self-test can check it. `roll` is a random number from 0 to 1.
// `pick` (0 to 1) and `mix` decide which kind of troop takes the place: Choir raider, Grey Host or Hollow soldier.
export function choirSwap(type, tags, sieges, roll = Math.random(), pick = Math.random(), mix = defaultTroopMix(sieges)) {
  // mix.swap overrides how much of the army is swapped at all. swap: 0 = swap nothing (after the story, only people raid).
  const share = typeof mix?.swap === "number" ? mix.swap : choirShare(sieges);
  if (mix?.swap === 0) return undefined;
  const lord = warlordBody(type, tags);
  if (lord) return lord;
  if (tags.includes(SAPPER_TAG)) return undefined; // sappers keep their job (and their charge)
  if (!CHOIR[type] || roll >= share) return undefined;
  const options = TROOPS[troopKind(mix, pick)][type] ?? CHOIR[type];
  return options[Math.floor((roll / share) * options.length) % options.length];
}

addRaiderTypeHook((type, { tags = [] }) => {
  const owner = tags.find((t) => t.startsWith("siege_for_"))?.slice("siege_for_".length);
  const sieges = keepOf(owner)?.sieges ?? 0;
  let mix;
  try { mix = troopPlan({ sieges, owner }); } catch { /* a broken plan falls back to ours */ }
  return choirSwap(type, tags, sieges, Math.random(), Math.random(), mix ?? defaultTroopMix(sieges));
});

// ---------- the Watcher ----------
// The first look at the Hollow's own soldiers (lore thread): a few raids before they come forward, one of them
// stands at the back of an ordinary raid. It does not attack. Walk up to it and it is not there any more.
const WATCHER_TAG = "siege_watcher";
export const watcherDue = (sieges, from = SPAWN_SETTINGS.hollowFromSiege, span = SPAWN_SETTINGS.watcherSieges) => sieges >= from - span && sieges < from;
// Where it stands: out past the fighting, on the side away from nothing in particular
export function watcherSpot(keep, angle, distance = SPAWN_SETTINGS.watcherDistance) {
  return { x: Math.floor(keep.x + Math.cos(angle) * distance) + 0.5, y: keep.y, z: Math.floor(keep.z + Math.sin(angle) * distance) + 0.5 };
}
let watcherPlan; // the raids feature can say when the Watcher stands: setWatcherPlan(() => true | false)
export function setWatcherPlan(fn) { watcherPlan = fn; }
function watcherTonight(keep) {
  if (watcherPlan) { try { return !!watcherPlan({ keep }); } catch { /* a broken plan falls back to ours */ } }
  return watcherDue(keep.sieges ?? 0);
}
function placeWatchers() {
  let dim, state;
  try { dim = world.getDimension("overworld"); state = getState(); } catch { return; }
  for (const owner of state.besieged ?? []) {
    const keep = keepOf(owner);
    if (!keep || !watcherTonight(keep)) continue;
    try {
      const spot = watcherSpot(keep, Math.random() * Math.PI * 2);
      const top = dim.getTopmostBlock({ x: spot.x, z: spot.z });
      const e = dim.spawnEntity("siege:veinsworn", { x: spot.x, y: (top?.y ?? keep.y) + 1, z: spot.z });
      e.addTag(WATCHER_TAG);
      e.addEffect("slowness", 100000, { amplifier: 255, showParticles: false });
      e.addEffect("weakness", 100000, { amplifier: 255, showParticles: false });
      e.addEffect("resistance", 100000, { amplifier: 255, showParticles: false });
      e.teleport(e.location, { facingLocation: { x: keep.x, y: keep.y + 2, z: keep.z } });
    } catch { /* not loaded: no watcher tonight */ }
  }
}
function watcherTick() {
  let dim;
  try { dim = world.getDimension("overworld"); } catch { return; }
  for (const e of dim.getEntities({ tags: [WATCHER_TAG] })) {
    try {
      if (!dim.getPlayers({ location: e.location, maxDistance: SPAWN_SETTINGS.watcherFlees }).length && isNight()) continue;
      dim.spawnParticle("minecraft:large_smoke_particle", { x: e.location.x, y: e.location.y + 1.5, z: e.location.z });
      e.remove(); // seen up close, or the night is over: it is simply gone
    } catch { /* unloaded */ }
  }
}
on("siegeStart", () => system.runTimeout(placeWatchers, 100));
onTick("bestiary_watcher", 10, watcherTick);

// ---------- Hollow things ----------
export const NIGHT_HOLLOW = ["siege:lost_villager", "siege:lost_villager", "siege:changeling", "siege:tolling_shade", "siege:wrongling", "siege:stone_vigil"];
export const UNDERTOW_HOLLOW = ["siege:wrongling", "siege:stone_vigil", "siege:tolling_shade", "siege:mirror_knight", "siege:echo_hound", "siege:lost_villager", "siege:mirror_knight"];

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
      if (kind === "night" && Math.random() >= shareFor(p)) continue; // a new player's first nights are left alone (gentle.js)
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
    assertEqual(choirSwap("minecraft:zombie", [], 10, 0.01, 0.99), "siege:hollow_footman");
    assertEqual(choirSwap("minecraft:zombie", [], 10, 0.99), undefined);
    assertEqual(choirSwap("minecraft:creeper", [], 10, 0), undefined);
  },
  "rams become ogres, sappers keep their job, warlords get their bodies": () => {
    assertEqual(choirSwap("minecraft:ravager", [RAM_TAG], 10, 0, 0.99), "siege:siege_ogre");
    assertEqual(choirSwap("minecraft:vindicator", [SAPPER_TAG], 10, 0), undefined);
    assertEqual(choirSwap("minecraft:vindicator", [WARLORD_TAG], 1, 0.99), "siege:hollow_warlord");
    assertEqual(choirSwap("minecraft:vindicator", [KING_TAG], 1, 0.99), "siege:warlord_king");
  },
  "the Grey Host comes later, and the Hollow's own soldiers later still": () => {
    assertEqual(defaultTroopMix(3), { grey: 0, hollow: 0 });
    assert(defaultTroopMix(6).grey > 0 && defaultTroopMix(6).hollow === 0);
    assert(defaultTroopMix(10).hollow > 0);
    assertEqual(troopKind({ grey: 0.4, hollow: 0.3 }, 0.1), "hollow");
    assertEqual(troopKind({ grey: 0.4, hollow: 0.3 }, 0.5), "grey");
    assertEqual(troopKind({ grey: 0.4, hollow: 0.3 }, 0.9), "choir");
    assertEqual(choirSwap("minecraft:skeleton", [], 10, 0.01, 0.5, { grey: 1, hollow: 0 }), "siege:grey_bowman");
    assertEqual(choirSwap("minecraft:ravager", [RAM_TAG], 10, 0, 0, { grey: 0, hollow: 1 }), "siege:gatebreaker");
    assertEqual(choirSwap("minecraft:ravager", [], 10, 0.01, 0.5, { grey: 1, hollow: 0 }), "siege:siege_ogre", "the Grey Host has no beast: a Choir raider fills in");
    assertEqual(choirSwap("minecraft:zombie", [], 1, 0, 0, { grey: 0, hollow: 1 }), undefined, "nothing is swapped before the third siege");
    for (const set of Object.values(TROOPS)) for (const list of Object.values(set)) for (const id of list) assert(MOBS_HAVE(id), `${id} is not a mob`);
  },
  "the raids feature can turn the swapping up, or off": () => {
    assertEqual(choirSwap("minecraft:zombie", [], 10, 0.01, 0.99, { grey: 0, hollow: 0, swap: 0 }), undefined);
    assertEqual(choirSwap("minecraft:vindicator", [WARLORD_TAG], 10, 0.01, 0.99, { swap: 0 }), undefined, "not even the warlord");
    assertEqual(choirSwap("minecraft:zombie", [], 1, 0.5, 0, { grey: 0, hollow: 1, swap: 1 }), "siege:veinsworn", "swap overrides the siege count");
  },
  "one of them watches for three sieges before they come forward": () => {
    assert(!watcherDue(6) && watcherDue(7) && watcherDue(9) && !watcherDue(10));
    assertEqual(watcherSpot({ x: 0, y: 64, z: 0 }, 0, 30), { x: 30.5, y: 64, z: 0.5 });
  },
  "Hollow things wait for the first boss, except for loud Marked players": () => {
    assertEqual(hollowFor({ undertow: false, marked: false, resonance: 0, awake: false, roll: 0 }), undefined);
    assertEqual(hollowFor({ undertow: false, marked: false, resonance: 0, awake: true, roll: 0 }), "night");
    assertEqual(hollowFor({ undertow: false, marked: true, resonance: 80, awake: false, roll: 0.1 }), "hound");
    assertEqual(hollowFor({ undertow: true, marked: false, resonance: 0, awake: false, roll: 0.1 }), "undertow");
    assert(hollowFor({ undertow: true, marked: false, resonance: 0, awake: true, roll: 0.9 }) === undefined);
  },
});
