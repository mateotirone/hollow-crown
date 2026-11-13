import { addTests, assert, assertEqual } from "../core/tests.js";
import { UPKEEP, upkeepOf, settle, breakdown } from "./data.js";

addTests("upkeep", {
  "a bare Hamlet owes nothing; a town pays for its size, its buildings and its guards": () => {
    assertEqual(upkeepOf({ tier: "Hamlet" }).total, 0);
    assertEqual(upkeepOf({ tier: "Town", buildings: 10, guards: 6 }), { town: 8, buildings: 20, guards: 18, total: 46 });
    const tiers = ["Hamlet", "Town", "City", "Castle"].map((tier) => upkeepOf({ tier }).total);
    for (let i = 1; i < tiers.length; i++) assert(tiers[i] > tiers[i - 1], "bigger towns cost more");
  },
  "it stays a drain, not a wall: a full Castle costs less than a day of an Ore Pit's iron": () => {
    // 30 buildings and 20 guards at Castle, against 16 raw iron smelted and sold at 8 Regals
    assert(upkeepOf({ tier: "Castle", buildings: 30, guards: 20 }).total <= 16 * 8 * 1.5, "too dear");
    assert(upkeepOf({ tier: "City", buildings: 20, guards: 12 }).total >= 80, "too cheap to notice");
  },
  "short of Regals: what there is is taken, never more, and the rest is forgiven": () => {
    assertEqual(settle(46, 100), { paid: 46, crown: 0, short: 0 });
    assertEqual(settle(46, 30), { paid: 30, crown: 0, short: 16 });
    assertEqual(settle(46, 0), { paid: 0, crown: 0, short: 46 });
  },
  "a crowned player takes a share of what was really paid": () => {
    assertEqual(settle(50, 100, { toCrown: true }).crown, Math.floor(50 * UPKEEP.crownShare));
    assertEqual(settle(50, 10, { toCrown: true }).crown, Math.floor(10 * UPKEEP.crownShare));
  },
  "the line on screen says what it was for": () => {
    const counts = { tier: "Town", buildings: 10, guards: 1 };
    assertEqual(breakdown(upkeepOf(counts), counts), "town 8, 10 buildings 20, 1 guard 3");
  },
});
