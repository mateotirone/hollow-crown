import { addTests, assert, assertEqual } from "../core/tests.js";
import { ItemTypes } from "@minecraft/server";
import { ECON, JOBS, JOB_IDS, LINES, REGIONS, COIN, GOLD, TOWNS, TOWN_RING, EXCHANGE } from "./config.js";
import { WARDS } from "../plots/config.js";
import { armourOf, plainArmour, reforgeTarget, reforgePrice, armourName, ARMOUR_MATERIALS, ARMOUR_REGIONS, ARMOUR_PIECES, REGION_KEY } from "./regional_armor.js";
import { regional, appetite, payout, cost, asCoins, coins, worth, fromEmeralds, loopholes, stopAt } from "./rules.js";

const iron = JOBS.moneyer.buys.find((g) => g.id === "minecraft:iron_ingot");
const wheat = JOBS.farmer.buys.find((g) => g.id === "minecraft:wheat");

addTests("economy", {
  "regional player armour: every Smith reforges any armour into his region's look, never into the same one": () => {
    for (const region of REGIONS) assert(REGION_KEY[region], `${region} has a key`);
    assertEqual(reforgeTarget("minecraft:iron_helmet", "Frostmarch"), "siege:iron_frostmarch_helmet");
    assertEqual(reforgeTarget("siege:diamond_vale_boots", "Blackfen"), "siege:diamond_blackfen_boots");
    assertEqual(reforgeTarget("siege:choirsteel_chestplate", "Aldmere Vale"), "siege:choirsteel_vale_chestplate");
    assertEqual(reforgeTarget("siege:netherite_saltreach_leggings", "Saltreach"), undefined);
    assertEqual(reforgeTarget("minecraft:golden_helmet", "Saltreach"), undefined);
    assertEqual(reforgeTarget("siege:guard_vale_helmet", "Saltreach"), undefined, "guard sets have their own regional line");
    assertEqual(reforgeTarget("minecraft:iron_helmet", undefined), undefined);
    assertEqual(plainArmour("siege:chainmail_emberwaste_chestplate"), "minecraft:chainmail_chestplate");
    assertEqual(armourName("siege:choirsteel_frostmarch_helmet"), "Frostmarch Choirsteel Helm");
    for (const mat of ARMOUR_MATERIALS) for (const region of ARMOUR_REGIONS) for (const piece of ARMOUR_PIECES) {
      const id = `siege:${mat}_${region}_${piece}`;
      assertEqual(armourOf(id)?.region, region, id);
      assert(reforgePrice(id) > 0, id);
      if (ItemTypes.get("siege:castle_stone")) assert(ItemTypes.get(id), `${id} is in the pack`);
    }
  },
  "farms can't print coins: every trader stops buying a good for the day": () => {
    for (const job of Object.values(JOBS)) for (const good of job.buys) {
      if (good === iron) continue; // iron has no limit: golems are gone, so it only comes from mining (golems.js)
      const stop = stopAt(good);
      assert(stop > (good.want ?? good.lot * ECON.wantLots), `${good.id}: the stop comes after the full-price share`);
      assertEqual(appetite(good, stop - 1), good.floor ?? ECON.floor);
    }
  },
  // the job's place in this list is its skin (siege:job on siege:job_npc, written by studio/build_economy.py): only add at the end
  "each region's Smith sells its own Castle Guard set, a little over the plain one": () => {
    const guard = (good) => good.id.startsWith("siege:guard_");
    for (const region of REGIONS) assertEqual(JOBS.smith.sells.filter((good) => good.region === region && guard(good)).length, 4);
    const plain = { helmet: 40, chestplate: 72, leggings: 56, boots: 40 }; // Quartermaster, trading/quartermaster_trades.json
    for (const good of JOBS.smith.sells.filter((g) => g.region && guard(g))) {
      const piece = good.id.split("_").pop();
      assert(good.flat && good.price > plain[piece] && good.price <= plain[piece] * 1.5, good.id);
    }
  },
  "each region's Hunter sells its starter clothes and its Smith its starter weapon, cheap": () => {
    for (const region of REGIONS) {
      assertEqual(JOBS.hunter.sells.filter((good) => good.region === region && good.id.startsWith("siege:starter_")).length, 4);
      assertEqual(JOBS.smith.sells.filter((good) => good.region === region && good.id.endsWith("_weapon")).length, 1);
    }
    for (const good of [...JOBS.hunter.sells, ...JOBS.smith.sells].filter((g) => g.id.startsWith("siege:starter_"))) assert(good.flat && good.price <= 10, good.id);
  },
  "every town of the map has traders, inside the town, and a Moneyer at his counter": () => {
    for (const town of TOWNS) {
      const ward = WARDS.find((w) => w.name === town.name);
      assert(ward, `${town.name} is a town on the map`);
      assert(REGIONS.includes(town.region), `${town.name} region`);
      assert(town.jobs.length && town.jobs.every((j) => JOBS[j]), `${town.name} jobs`);
      assertEqual(new Set(town.jobs).size, town.jobs.length);
      assert(TOWN_RING + 2 < ward.r, `${town.name}: traders stand inside the protected town`);
    }
    // every town has a Moneyer (Mateo 2026-11-14); outside Kingsrest he stands behind the counter of his house
    for (const town of TOWNS) {
      assert(town.jobs.includes("moneyer"), `${town.name} has a Moneyer`);
      const ward = WARDS.find((w) => w.name === town.name);
      for (const [job, at] of Object.entries(town.at ?? {})) {
        assert(town.jobs.includes(job), `${town.name}: ${job} has a spot but no job`);
        assert([at.x, at.y, at.z, at.yaw].every(Number.isInteger), `${town.name}: ${job} spot is whole blocks`);
        assert(Math.hypot(at.x - ward.x, at.z - ward.z) < ward.r, `${town.name}: ${job} stands inside the protected town`);
      }
      for (const s of town.signs ?? []) assert(s.text && Math.hypot(s.x - ward.x, s.z - ward.z) < ward.r, `${town.name}: sign`);
    }
    assertEqual(TOWNS.filter((t) => !t.at?.moneyer).map((t) => t.name), ["Kingsrest"]);
  },
  "the trade-up ladder only goes up, and buying iron to climb it and selling the top never pays": () => {
    const order = ["minecraft:iron_ingot", "minecraft:gold_ingot", "minecraft:diamond", "minecraft:netherite_scrap"];
    EXCHANGE.forEach((step, i) => { assertEqual(step.from, order[i]); assertEqual(step.to, order[i + 1]); assert(step.n > 1, "a step up costs more than one"); });
    let iron = 1; // ingots of iron behind one unit of each tier
    for (const step of EXCHANGE) {
      iron *= step.n;
      for (const job of Object.values(JOBS)) for (const good of job.buys.filter((g) => g.id === step.to)) {
        const best = (good.price / good.lot) * ECON.scarcePays;
        assert(best < iron * ECON.ironSells, `${step.to}: ${job.name} pays ${best}, the iron behind it costs ${iron * ECON.ironSells}`);
      }
    }
  },
  "job order matches the painted skins": () =>
    assertEqual(JOB_IDS.join(","), "farmer,woodcutter,quarryman,smith,fisher,hunter,herbalist,moneyer,factor"),
  "the coin is backed by iron: 8 in, 10 out": () => {
    assertEqual(payout(iron, 1), 8);
    assertEqual(cost(JOBS.moneyer.sells[0], 1), 10);
    assert(ECON.ironSells > ECON.ironBuys, "the Mint must charge more than it pays");
  },
  "the Mint buys every ingot at full price, with no daily limit": () => {
    assertEqual(stopAt(iron), Infinity);
    assertEqual(payout(iron, 64, 64), 64 * 8);
    assertEqual(payout(iron, 1, 5000), 8);
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
      assert(job.guild || job.buys.length > 0, `${id} buys nothing`);
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
