import { addTests, assert, assertEqual } from "../core/tests.js";
import { STYLE_IDS } from "../townhall/styles.js";
import { LEVELS, MAX_LEVEL, IRONWORKS, DAY, produce, capOf, tierAtLeast, lootShare } from "./data.js";
import { drawIronworks, drawWorks, worksShape, WORKS_PLOT } from "./design.js";
import { BUILDINGS, BUILDING, WORKS, drawBuilding } from "../settle/buildings.js";
import { plotFit, opensAt } from "../settle/charters.js";
import { seatOnSlot, seatedBox } from "../settle/towns.js";
import { plotPrice } from "../settle/plotmarker.js";
import { REGION_RATES, regionRate } from "../economy/config.js";

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
  "Saltreach digs faster, Frostmarch much slower": () => {
    assert(produce(1, DAY, 0, undefined, regionRate("Saltreach", "iron")).raw === 32, "saltreach x2");
    assert(produce(1, DAY, 0, undefined, regionRate("Frostmarch", "iron")).raw === 4, "frostmarch x0.25");
    assert(produce(1, DAY, 0, undefined, regionRate("Aldmere Vale", "iron")).raw === 16, "vale x1");
  },
  "every region buff has a weakness, and nobody is buffed on netherite": () => {
    for (const [region, rates] of Object.entries(REGION_RATES)) {
      const v = Object.values(rates);
      assert(v.some((r) => r > 1) && v.some((r) => r < 1), `${region} needs a strength and a weakness`);
      assert(regionRate(region, "netherite") === 1, `${region} netherite`);
    }
  },
  "raiders take more the worse a siege goes": () => assert(lootShare("won") === 0 && lootShare("dawn") < lootShare("lost"), "loot"),
  "the Ironworks is a Works plot machine: only there, nothing else there, never from a Foundation Stone": () => {
    const works = { size: "W", tags: [] };
    assert(WORKS.some((w) => w.id === "ironworks") && BUILDING.ironworks, "registered");
    assert(!BUILDINGS.some((b) => b.id === "ironworks"), "not a Foundation Stone or plan building");
    assert(plotFit("ironworks", works).ok && opensAt("ironworks") === 0, "a Hamlet may raise it on a Works plot");
    for (const size of ["S", "M", "L", "G"]) assert(!plotFit("ironworks", { size, tags: [] }).ok, `not on a ${size} plot`);
    for (const b of BUILDINGS) assert(!plotFit(b.id, works).ok, `${b.id} must not take a Works plot`);
    assert(plotFit("ironworks", { size: "W", tags: ["water"] }).tagged, "a plot by water is the good spot");
    assertEqual(plotPrice("ironworks"), IRONWORKS.plotCost);
    assert(drawBuilding("ironworks", "vale") === drawWorks(1, "vale"), "the plot raises stage 1");
  },
  "on a Works plot: every stage in every region stays inside the plot whichever way it faces, known roles, its block in the yard": () => {
    const half = (WORKS_PLOT.wide - 1) / 2;
    assertEqual(WORKS_PLOT.wide % 2, 1); assertEqual(WORKS_PLOT.deep % 2, 1);
    for (const id of STYLE_IDS) {
      for (let lv = 1; lv <= MAX_LEVEL; lv++) {
        const p = drawWorks(lv, id);
        for (const c of p.cells.values()) {
          assert(p.style.roles[c.role] || c.role === "air", `level ${lv} (${id}) uses unknown role ${c.role}`);
          assert(Math.abs(c.x) <= half && c.z >= 1 && c.z <= WORKS_PLOT.deep - 1, `level ${lv} (${id}) leaves the plot at ${c.x},${c.z}`);
        }
        assert(!p.get(0, 1, 0), "the plot's front row stays clear");
        assert(worksShape(lv, id).top >= worksShape(Math.max(1, lv - 1), id).top, "it only grows");
      }
      const p1 = drawWorks(1, id), m = p1.marks.works;
      assertEqual(p1.style.roles[p1.get(m.x, m.y, m.z).role][0], "siege:ironworks");
      const b = p1.bounds();
      assert(b.x1 - b.x0 + 1 >= WORKS_PLOT.wide - 2 && b.z1 >= WORKS_PLOT.deep - 2, `${id}: stage 1 fences the whole plot`);
      assert(drawWorks(2, id).cells.size < p1.cells.size && drawWorks(3, id).cells.size < p1.cells.size, "an upgrade only adds, it never rebuilds the plot");
      assert(!drawWorks(2, id).get(m.x, m.y, m.z) && !drawWorks(3, id).get(m.x, m.y, m.z), "the block is never touched by an upgrade");
    }
    // seated on a 27 x 17 slot facing each way, the first stage sits inside it with room for the later ones
    for (const [side, door] of [["s", { x: 0, z: 1 }], ["n", { x: 0, z: -1 }], ["e", { x: 1, z: 0 }], ["w", { x: -1, z: 0 }]]) {
      const along = door.x ? "z" : "x";
      const box = along === "x" ? { x0: 10, z0: 20, x1: 10 + WORKS_PLOT.wide - 1, z1: 20 + WORKS_PLOT.deep - 1 } : { x0: 10, z0: 20, x1: 10 + WORKS_PLOT.deep - 1, z1: 20 + WORKS_PLOT.wide - 1 };
      const slot = { box, door, dy: 0 };
      const seat = seatOnSlot(slot, drawWorks(1, "vale").bounds());
      assert(seat, `fits a Works plot facing ${side}`);
      for (let lv = 1; lv <= MAX_LEVEL; lv++) for (const id of STYLE_IDS) {
        const sb = seatedBox(seat, drawWorks(lv, id).bounds());
        assert(sb.x0 >= box.x0 && sb.x1 <= box.x1 && sb.z0 >= box.z0 && sb.z1 <= box.z1, `level ${lv} (${id}) facing ${side} leaves the slot: ${JSON.stringify(sb)}`);
      }
    }
  },
  "the old hand-placed yard: each stage draws in every style, behind its block, odd sizes, known roles": () => {
    for (let lv = 1; lv <= MAX_LEVEL; lv++) for (const id of STYLE_IDS) {
      const p = drawIronworks(lv, id), b = p.bounds();
      for (const c of p.cells.values()) assert(p.style.roles[c.role], `level ${lv} (${id}) uses unknown role ${c.role}`);
      assert(b.z0 >= 0 && !p.get(0, 1, 0), "it must rise behind the block");
      assertEqual((b.x1 - b.x0 + 1) % 2, 1, "odd width");
      assertEqual((b.z1 - Math.max(1, b.z0) + 1) % 2, 1, "odd depth");
    }
  },
});
