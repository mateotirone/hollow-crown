// Horses self-tests (pure ones run offline too).

import { EntityTypes, ItemTypes, BlockTypes } from "@minecraft/server";
import { addTests, assert, assertEqual } from "../siege/api.js";
import { upgradeRecord, RECORD_VERSION } from "./store.js";
import {
  HORSE_SETTINGS as S, BREEDS, REGIONAL_BREEDS, TRAITS, PERKS, SHOES, SADDLES, SPECIALS, STATS, MAX_EFFECTIVE, SPEED_VALUES,
  TRAIN_COST, STABLES_LEVELS, GEAR_ITEMS, HALTER, WHISTLE, CROP, CAPARISON,
  newRecord, effectiveStats, addXp, xpToNext, breedFoal, levelFromValue, gallopTicks, rosterCap, trainCap,
} from "./data.js";

const horse = (breed = "common", stats) => newRecord({ uid: "t", owner: "p", ownerName: "P", breed, stats, name: "Test" });
const seeded = (...values) => {
  let i = 0;
  return () => values[i++ % values.length];
};

addTests("horses", {
  "old horse records are upgraded when they load": () => {
    const old = { uid: "a", name: "Bramble", stats: { speed: 3 } };
    assertEqual(upgradeRecord({ ...old }), { ...old, _v: RECORD_VERSION }, "a record saved before versioning counts as version 1 and keeps its data");
    const steps = { 1: (r) => { r.title = r.name; delete r.name; } };
    const seen = upgradeRecord({ ...old }, 2, { mood: "calm" }, steps);
    assertEqual(seen, { uid: "a", stats: { speed: 3 }, title: "Bramble", mood: "calm", _v: 2 }, "renamed field moves over and a new field gets its default");
    assertEqual(upgradeRecord({ ...seen, mood: "bold" }, 2, { mood: "calm" }, steps).mood, "bold", "an up to date record is left alone");
  },
  "every breed has a real trait and coat": () => {
    for (const key of REGIONAL_BREEDS) {
      const b = BREEDS[key];
      assert(TRAITS[b.trait], `${key} trait`);
      assert(b.coat >= 0 && b.coat <= 6 && b.mark >= 0 && b.mark <= 4, `${key} coat`);
      assertEqual(Object.values(b.bonus), [1], `${key} bonus`);
    }
  },
  "breed, gear and perks stack into effective stats": () => {
    const rec = horse("courser", { speed: 5, jump: 1, health: 1, stamina: 1 });
    assertEqual(effectiveStats(rec).speed, 6);
    rec.shoes = "netherite";
    rec.perks.push("fleet");
    assertEqual(effectiveStats(rec).speed, MAX_EFFECTIVE.speed);
    rec.saddle = "royal";
    assertEqual(effectiveStats(rec).stamina, 4);
  },
  "effective stats never leave the tables": () => {
    const rec = horse("destrier", { speed: 5, jump: 5, health: 5, stamina: 5 });
    Object.assign(rec, { shoes: "netherite", saddle: "royal", special: "warhorse", perks: Object.keys(PERKS) });
    const eff = effectiveStats(rec);
    for (const s of STATS) assert(eff[s] >= 1 && eff[s] <= MAX_EFFECTIVE[s], `${s} = ${eff[s]}`);
  },
  "level 20 gives 19 training points and 4 perk points": () => {
    const rec = horse();
    let total = 0;
    for (let l = 1; l < S.maxLevel; l++) total += xpToNext(l);
    addXp(rec, total + 5000);
    assertEqual([rec.level, rec.tp, rec.pp, rec.xp], [20, 19, 4, 0]);
  },
  "a foal takes after its parents": () => {
    const sire = horse("courser", { speed: 5, jump: 3, health: 3, stamina: 3 });
    const dam = horse("destrier", { speed: 3, jump: 3, health: 5, stamina: 1 });
    const foal = breedFoal(sire, dam, seeded(0.1, 0.9, 0.2, 0.6));
    assertEqual(foal.breed, "crossbred");
    assertEqual(foal.bonus, { speed: 1, health: 1 });
    assert(foal.traits.length >= 1 && foal.traits.every((t) => TRAITS[t]), "traits");
    assert(foal.stats.speed >= 3 && foal.stats.speed <= 4, `speed ${foal.stats.speed}`);
    for (const s of STATS) assert(foal.stats[s] >= 1 && foal.stats[s] <= 5, s);
    assertEqual(breedFoal(sire, sire).breed, "courser");
  },
  "a vanilla horse's speed maps onto levels 1 to 5": () => {
    assertEqual(levelFromValue(0.1125, SPEED_VALUES), 1);
    assertEqual(levelFromValue(0.3375, SPEED_VALUES), 5);
    assertEqual(levelFromValue(0.25, SPEED_VALUES), 3);
  },
  "costs and stables levels are complete": () => {
    for (let l = 2; l <= 5; l++) assert(TRAIN_COST[l]?.length, `train cost ${l}`);
    assertEqual([rosterCap(0), rosterCap(1), rosterCap(2), rosterCap(3)], [1, 3, 5, 8]);
    assertEqual([trainCap(0), trainCap(1), trainCap(3)], [0, 3, 5]);
    assert(STABLES_LEVELS[2].cost && STABLES_LEVELS[3].cost, "upgrade costs");
    assert(gallopTicks(1) < gallopTicks(9), "stamina grows");
    for (const s of Object.values(SPECIALS)) if (s.path) assert(s.cost.length && s.needs.level, s.name);
  },
  "the pack has every horse item, block and entity": () => {
    assert(EntityTypes.get("siege:steed"), "siege:steed");
    for (const id of [HALTER, WHISTLE, CROP, CAPARISON, ...Object.keys(GEAR_ITEMS)]) assert(ItemTypes.get(id), id);
    for (const id of ["siege:stables", "hc:breeder_post"]) assert(BlockTypes.get(id), id);
    assertEqual(Object.keys(GEAR_ITEMS).length, Object.keys(SHOES).length + Object.keys(SADDLES).length - 2);
  },
});
