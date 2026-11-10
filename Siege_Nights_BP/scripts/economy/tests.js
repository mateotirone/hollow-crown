import { addTests, assert, assertEqual } from "../core/tests.js";
import { ItemTypes } from "@minecraft/server";
import { ECON, JOBS, JOB_IDS, LINES, REGIONS, COIN, GOLD } from "./config.js";
import { regional, appetite, payout, cost, asCoins, coins, worth, fromEmeralds, loopholes } from "./rules.js";

const iron = JOBS.moneyer.buys.find((g) => g.id === "minecraft:iron_ingot");
const wheat = JOBS.farmer.buys.find((g) => g.id === "minecraft:wheat");

addTests("economy", {
  // the job's place in this list is its skin (siege:job on siege:job_npc, written by studio/build_economy.py): only add at the end
  "job order matches the painted skins": () =>
    assertEqual(JOB_IDS.join(","), "farmer,woodcutter,quarryman,smith,fisher,hunter,herbalist,moneyer"),
  "the coin is backed by iron: 8 in, 10 out": () => {
    assertEqual(payout(iron, 1), 8);
    assertEqual(cost(JOBS.moneyer.sells[0], 1), 10);
    assert(ECON.ironSells > ECON.ironBuys, "the Mint must charge more than it pays");
  },
  "the Mint pays half past the daily limit": () => {
    assertEqual(payout(iron, 64), 64 * 8);
    assertEqual(payout(iron, 64, 64), 64 * 4);
    assertEqual(payout(iron, 128), 64 * 8 + 64 * 4);
    assertEqual(payout(iron, 1, 5000), 4);
  },
  "an old emerald is 8 coins, the same as an iron ingot": () => assertEqual(fromEmeralds(1), payout(iron, 1)),
  "wheat pays 6 a lot and less once the farmer has plenty": () => {
    assertEqual(payout(wheat, 16), 6);
    assertEqual(payout(wheat, 16 * 8), 48);
    assertEqual(appetite(wheat, 16 * 8), 0.9);
    assert(payout(wheat, 16, 16 * 8) < 6, "past the appetite");
    assertEqual(appetite(wheat, 1e6), ECON.floor);
  },
  "regions shift prices: cheap at home, dear where scarce": () => {
    assert(regional(JOBS.farmer, "Aldmere Vale").pays < 1 && regional(JOBS.farmer, "Frostmarch").pays > 1, "farmer");
    assertEqual(regional(JOBS.farmer, "Saltreach").pays, 1);
    assertEqual(regional(JOBS.moneyer, "Frostmarch").pays, 1, "iron is the same price everywhere");
    assertEqual(regional(JOBS.farmer, undefined).charges, 1);
    assert(payout(wheat, 64, 0, regional(JOBS.farmer, "Frostmarch").pays) > payout(wheat, 64, 0, regional(JOBS.farmer, "Aldmere Vale").pays), "hauling pays");
  },
  "nothing can be bought and sold straight back at a profit": () => assertEqual(loopholes(), []),
  "coins make change": () => {
    assertEqual(asCoins(200), { gold: 3, coin: 8 });
    assertEqual(asCoins(63), { gold: 0, coin: 63 });
    assertEqual(coins(1), `1 ${ECON.one}`);
    assertEqual(coins(2), `2 ${ECON.many}`);
  },
  "every job has goods, prices and lines": () => {
    for (const id of JOB_IDS) {
      const job = JOBS[id];
      assert(job.buys.length > 0, `${id} buys nothing`);
      for (const good of [...job.buys, ...job.sells]) assert(good.lot >= 1 && good.price >= 1 && /^[a-z]+:[a-z_]+$/.test(good.id), `${id}: ${JSON.stringify(good)}`);
      for (const region of [...job.home, ...job.scarce]) assert(REGIONS.includes(region), `${id}: ${region}`);
      assert(LINES[id]?.day.length && LINES[id]?.night.length, `${id} has nothing to say`);
      assert(cost(job.sells[0] ?? { price: 1, lot: 1 }, 3, 0.01) >= 3, "never free");
    }
  },
  "old emerald prices read as coins": () => {
    assertEqual(worth(5), `40 ${ECON.many}`);
    assertEqual(fromEmeralds(24), 3 * ECON.goldWorth, "an elytra, or a foal, is 3 Gold Regals");
  },
  "the coin items exist": () => assert(ItemTypes.get(COIN) && ItemTypes.get(GOLD), "siege:coin / siege:gold_coin missing from the pack"),
});
