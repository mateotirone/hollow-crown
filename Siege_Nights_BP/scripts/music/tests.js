import { addTests, assert, assertEqual } from "../siege/api.js";
import { INSTALLED_MUSIC } from "./installed.js";
import { REGION_POOLS, HOLLOW_POOL, FIGHT_TRACKS, SIEGE_TRACK, MAIN_THEME, soundId, poolFor, overrideFor, pickTrack, isNight } from "./data.js";

const all = (...names) => Object.fromEntries(names.map((n) => [soundId(n), { seconds: 100 }]));

addTests("music", {
  "every region on the minimap has a pool for day and night": () => {
    for (const r of ["Aldmere Vale", "Frostmarch", "Saltreach", "Blackfen", "Emberwaste"]) {
      assert(REGION_POOLS[r]?.day.length >= 2 && REGION_POOLS[r]?.night.length >= 2, `${r} needs at least two pieces by day and by night`);
    }
  },
  "night and day pick different pools": () => {
    assert(isNight(18000) && !isNight(6000));
    assertEqual(poolFor({ region: "Frostmarch", timeOfDay: 18000 }), REGION_POOLS.Frostmarch.night);
    assertEqual(poolFor({ region: "Frostmarch", timeOfDay: 6000 }), REGION_POOLS.Frostmarch.day);
    assertEqual(poolFor({ hollow: true, region: "", timeOfDay: 6000 }), HOLLOW_POOL);
  },
  "a fight beats a siege, and a siege does not reach the Hollow": () => {
    assertEqual(overrideFor({ fightBoss: "bride", siege: true }), FIGHT_TRACKS.bride);
    assertEqual(overrideFor({ fightBoss: "some_pretender" }), SIEGE_TRACK);
    assertEqual(overrideFor({ siege: true, hollow: false }), SIEGE_TRACK);
    assertEqual(overrideFor({ siege: true, hollow: true }), undefined);
    assertEqual(overrideFor({}), undefined);
  },
  "never the same piece twice running, and only installed pieces": () => {
    const installed = all("a", "b");
    for (let i = 0; i < 20; i++) assertEqual(pickTrack(["a", "b", "c"], "a", installed, i / 20), "b");
    assertEqual(pickTrack(["a"], "a", installed, 0.5), "a"); // a pool of one may repeat
    assertEqual(pickTrack(["c"], undefined, installed, 0.5), undefined);
  },
  "every installed piece is one the soundtrack knows": () => {
    const known = new Set([...Object.values(REGION_POOLS).flatMap((p) => [...p.day, ...p.night]), ...HOLLOW_POOL, ...Object.values(FIGHT_TRACKS), SIEGE_TRACK, MAIN_THEME].map(soundId));
    for (const id of Object.keys(INSTALLED_MUSIC)) assert(known.has(id), `${id} is installed but nothing plays it`);
  },
});
