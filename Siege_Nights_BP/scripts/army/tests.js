import { addTests, assert, assertEqual } from "../core/tests.js";
import { SOLDIERS, SOLDIER, unlocked, priceOf, retrainOf, trainTicks, upgradeCost, bill, BARRACKS } from "./roster.js";

addTests("army", {
  "nine soldier types, the two we have first, each with a price, unlock and job": () => {
    assertEqual(SOLDIERS.length, 9);
    assertEqual(SOLDIERS[0].id, "siege:man_at_arms");
    for (const s of SOLDIERS) assert(s.cost > 0 && s.unlock && s.job && (s.at === "barracks" || s.at === "workshop"), s.id);
  },
  "unlocks follow the settlement tier": () => {
    assert(unlocked(SOLDIER["siege:pikeman"], "Hamlet"));
    assert(!unlocked(SOLDIER["siege:knight"], "Town"));
    assert(unlocked(SOLDIER["siege:knight"], "Castle"));
  },
  "a better Barracks is cheaper and faster; retraining is half price": () => {
    const m = SOLDIER["siege:man_at_arms"];
    assertEqual(priceOf(m, 1), 40);
    assert(priceOf(m, 5) < priceOf(m, 3) && priceOf(m, 3) < 40);
    assertEqual(retrainOf(m, 1), 20);
    assert(trainTicks(5) < trainTicks(1));
    assertEqual(upgradeCost(1), BARRACKS.upgrade[2]);
    assertEqual(upgradeCost(BARRACKS.maxLevel), undefined);
  },
  "an order's bill counts price and slots (a Knight takes two)": () => {
    assertEqual(bill({ "siege:man_at_arms": 2, "siege:knight": 1 }), { total: 200, slots: 4 });
    assertEqual(bill({}), { total: 0, slots: 0 });
  },
});

import { strollSpot, asleepTime, IDLE } from "./idle.js";

addTests("army-idle", {
  "three strolls in four stay in the Barracks yard, the rest go into town": () => {
    let seed = 7;
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const where = { yard: 0, town: 0 };
    const barracks = { x: 100, y: 64, z: 100 }, keep = { x: 0, y: 64, z: 0 };
    for (let n = 0; n < 2000; n++) {
      const s = strollSpot(rand, { barracks, keep, radius: 60 });
      where[s.where]++;
      if (s.where === "yard") assert(Math.hypot(s.x - 100.5, s.z - 100.5) <= IDLE.yardMax + 0.01, "yard spots stay near the Barracks");
      else assert(Math.hypot(s.x, s.z) <= 60 * IDLE.townShare + 0.01, "town spots stay in town");
    }
    assert(Math.abs(where.yard / 2000 - 0.75) < 0.04, `yard share ${where.yard / 2000}`);
  },
  "with yard marks the yard is the box between them": () => {
    const s = strollSpot(() => 0.1, { barracks: { x: 0, y: 0, z: 0 }, yard: { a: { x: 10, z: 10 }, b: { x: 20, z: 16 } }, keep: { x: 0, z: 0 }, radius: 50 });
    assert(s.where === "yard" && s.x >= 10 && s.x <= 20 && s.z >= 10 && s.z <= 16);
  },
  "soldiers sleep from dusk to just before sunrise": () => {
    assert(!asleepTime(6000));
    assert(asleepTime(18000));
    assert(!asleepTime(23500));
  },
});

import { armouryCost } from "./armoury.js";

addTests("army-armoury", {
  "upgrading a type costs the tier's price per soldier, at least one": () => {
    const c = armouryCost(0, 5);
    assertEqual(c.tier, 1);
    assertEqual(c.amount, 30, "6 iron ingots for each of 5");
    assertEqual(armouryCost(2, 0).amount, 4, "4 diamonds even with none trained yet");
    assertEqual(armouryCost(4, 3), undefined, "nothing beyond Royal Guard Plate");
  },
});
