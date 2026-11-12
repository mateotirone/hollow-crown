import { addTests, assert, assertEqual } from "../core/tests.js";
import { STYLE_IDS } from "../townhall/styles.js";
import { LEVELS, MAX_LEVEL, IRONWORKS, DAY, produce, capOf, tierAtLeast, lootShare } from "./data.js";
import { drawIronworks } from "./design.js";

addTests("ironworks", {
  "three stages, each needing a bigger settlement, more Regals and making more": () => {
    assertEqual(MAX_LEVEL, 3);
    for (let lv = 2; lv <= MAX_LEVEL; lv++) {
      assert(LEVELS[lv].perDay > LEVELS[lv - 1].perDay && LEVELS[lv].cost > LEVELS[lv - 1].cost, `level ${lv}`);
      assert(tierAtLeast(LEVELS[lv].tier, LEVELS[lv - 1].tier) && LEVELS[lv].tier !== LEVELS[lv - 1].tier, `level ${lv} tier`);
    }
    assert(LEVELS[3].water, "the Forge needs water");
  },
  "the Ore Pit digs raw ore; the Bloomery smelts it while there is charcoal, then falls back to digging": () => {
    assertEqual(produce(1, DAY, 0), { raw: 16, ingots: 0, fuel: 0 });
    assertEqual(produce(2, DAY, 100), { raw: 0, ingots: 40, fuel: 10 });
    const half = produce(2, DAY, 5); // charcoal for 20 ingots, then a half day of digging
    assertEqual(half, { raw: 8, ingots: 20, fuel: 5 });
    assertEqual(produce(3, DAY, 0), { raw: 16, ingots: 0, fuel: 0 });
  },
  "the storeroom fills up, and then the workers wait": () => {
    assertEqual(produce(1, DAY * 10, 0).raw, capOf(1));
    assertEqual(produce(1, DAY, 0, { raw: capOf(1), ingots: 0 }).raw, 0);
    const full = produce(3, DAY * 10, 9999);
    assertEqual(full.ingots, capOf(3));
    assertEqual(full.fuel, Math.ceil(capOf(3) / LEVELS[3].fuelEvery)); // no charcoal burnt for nothing
  },
  "an iron Old Working next door makes it faster": () => assert(produce(1, DAY, 0, undefined, IRONWORKS.workingBonus).raw > 16, "bonus"),
  "raiders take more the worse a siege goes": () => assert(lootShare("won") === 0 && lootShare("dawn") < lootShare("lost"), "loot"),
  "each stage draws in every style, behind its block, odd sizes, known roles": () => {
    for (let lv = 1; lv <= MAX_LEVEL; lv++) for (const id of STYLE_IDS) {
      const p = drawIronworks(lv, id), b = p.bounds();
      for (const c of p.cells.values()) assert(p.style.roles[c.role], `level ${lv} (${id}) uses unknown role ${c.role}`);
      assert(b.z0 >= 0 && !p.get(0, 1, 0), "it must rise behind the block");
      assertEqual((b.x1 - b.x0 + 1) % 2, 1, "odd width");
      assertEqual((b.z1 - Math.max(1, b.z0) + 1) % 2, 1, "odd depth");
    }
  },
});
