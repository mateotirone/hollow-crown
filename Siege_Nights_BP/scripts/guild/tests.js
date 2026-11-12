import { addTests, assert, assertEqual } from "../core/tests.js";
import { JOBS, REGIONS, ECON } from "../economy/config.js";
import { GOODS, GUILD, ordersFor, payIn, valueOf } from "./data.js";

addTests("guild", {
  "every region has goods, and a town never orders its own": () => {
    for (const r of REGIONS) assert(GOODS[r]?.length >= 3, `${r} goods`);
    for (const r of REGIONS) for (let day = 0; day < 20; day++) {
      const orders = ordersFor("kingsrest", r, day);
      assertEqual(orders.length, GUILD.perDay);
      assert(orders.every((o) => o.from !== r), "own region");
      assertEqual(new Set(orders.map((o) => o.from)).size, GUILD.perDay);
    }
  },
  "the same orders all day, new ones at dawn": () => {
    assertEqual(ordersFor("a", REGIONS[0], 5), ordersFor("a", REGIONS[0], 5));
    assert(JSON.stringify(ordersFor("a", REGIONS[0], 5)) !== JSON.stringify(ordersFor("a", REGIONS[0], 6)), "dawn");
  },
  "pay is metal: diamond and gold first, the rest in iron": () => {
    assertEqual(payIn(300), [["minecraft:diamond", 1], ["minecraft:gold_ingot", 1], ["minecraft:iron_ingot", 1]]);
    assertEqual(payIn(3), [["minecraft:iron_ingot", 1]]);
    assertEqual(valueOf(payIn(296)), 296);
  },
  "buying the goods from a trader to fill an order never pays": () => {
    for (const [region, goods] of Object.entries(GOODS)) for (const [item, count, worth] of goods) for (const job of Object.values(JOBS)) {
      const sold = job.sells.find((g) => g.id === item);
      if (!sold) continue;
      for (const size of GUILD.sizes) {
        const cheapest = (sold.price / sold.lot) * count * size * ECON.homeCharges; // at the lowest regional price
        const pay = valueOf(payIn(worth * size * GUILD.bonus)); // its metal at full ladder value, more than any trader pays
        assert(pay < cheapest, `${item}: costs ${cheapest} from the ${job.name}, pays ${pay}`);
      }
    }
  },
});
