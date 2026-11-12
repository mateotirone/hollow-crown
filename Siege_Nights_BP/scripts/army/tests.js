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
