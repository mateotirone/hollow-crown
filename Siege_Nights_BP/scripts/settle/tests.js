import { addTests, assert, assertEqual } from "../core/tests.js";
import { BlockTypes } from "@minecraft/server";
import { drawHall } from "../townhall/halls.js";
import { STYLES, STYLE_IDS } from "../townhall/styles.js";
import { SETTLE, CATALOG, MASON_LINES } from "./config.js";
import { BUILDINGS, drawBuilding } from "./buildings.js";
import { hallReserve, hallReach, inBox, footprint, boxesTouch, placeVerdict, bill, priceOf, isCampKit } from "./rules.js";
import { localStock, stoneStock, niceName } from "./mason.js";
import { STONE_FAMILY, CASTLE_STONES, stoneId } from "../siege/api.js";
import { MATERIALS } from "./rules.js";

const base = { creative: false, overworld: true, typeId: "minecraft:stone_bricks", land: "me", mine: true, reserve: undefined, wildsClosed: true, hasKeep: true };

addTests("settle", {
  "the reserve covers every hall tier in every style": () => {
    for (const id of STYLE_IDS) {
      const reach = hallReach(id);
      assert(reach.side >= 4 && reach.deep >= 13 && reach.deep <= 70, `${id}: ${JSON.stringify(reach)}`);
      const box = hallReserve({ x: 0, y: 64, z: 0, fx: 0, fz: 1, style: id }, 0);
      for (let level = 1; level <= 5; level++) {
        const b = drawHall(level, STYLES[id]).bounds();
        assert(inBox(box, { x: b.x0, z: b.z0 }) && inBox(box, { x: b.x1, z: b.z1 }), `${id} tier ${level}`);
      }
    }
  },
  "the reserve turns with the hall": () => {
    const r = hallReach("vale");
    const south = hallReserve({ x: 100, y: 64, z: 100, fx: 0, fz: 1, style: "vale" }, 0);
    assertEqual(`${south.x0},${south.x1},${south.z0},${south.z1}`, `${100 - r.side},${100 + r.side},${100 - r.back},${100 + r.deep}`);
    const west = hallReserve({ x: 100, y: 64, z: 100, fx: -1, fz: 0, style: "vale" }, 0);
    assertEqual(`${west.x0},${west.x1},${west.z0},${west.z1}`, `${100 - r.deep},${100 + r.back},${100 - r.side},${100 + r.side}`);
    assert(inBox(hallReserve({ x: 100, y: 64, z: 100, fx: 0, fz: 1, style: "vale" }), { x: 100 + r.side + SETTLE.reserveMargin, z: 100 + r.deep + SETTLE.reserveMargin }), "margin");
  },
  "free-build ground takes anything": () => assertEqual(placeVerdict(base), undefined),
  "the reserve takes nothing but its own": () => {
    assertEqual(placeVerdict({ ...base, reserve: "your hall" }).zone, "reserve");
    assertEqual(placeVerdict({ ...base, reserve: "your hall", typeId: "siege:hall_cornerstone" }), undefined);
    assertEqual(placeVerdict({ ...base, reserve: "your hall", creative: true }), undefined);
  },
  "the wilds only take a camp": () => {
    const wild = { ...base, land: undefined, mine: false };
    assertEqual(placeVerdict(wild).zone, "wilds");
    assertEqual(placeVerdict({ ...wild, typeId: "minecraft:torch" }), undefined);
    assertEqual(placeVerdict({ ...wild, typeId: "minecraft:red_bed" }), undefined);
    assertEqual(placeVerdict({ ...wild, typeId: "siege:keep_banner" }), undefined);
    assertEqual(placeVerdict({ ...wild, wildsClosed: false }), undefined);
    assertEqual(placeVerdict({ ...wild, overworld: false }), undefined);
    assert(!isCampKit("minecraft:cobblestone"));
  },
  "someone else's land is left to Siege Nights": () => assertEqual(placeVerdict({ ...base, land: "them", mine: false }), undefined),
  "every building draws in every style with known roles": () => {
    for (const b of BUILDINGS) for (const id of STYLE_IDS) {
      const plan = drawBuilding(b.id, id);
      assert(plan.cells.size > 20, `${b.id} is empty`);
      for (const c of plan.cells.values()) assert(plan.style.roles[c.role], `${b.id} (${id}) uses unknown role ${c.role}`);
      const bounds = plan.bounds();
      assert(bounds.z0 >= 0 && !plan.get(0, 1, 0), `${b.id} must rise in front of its Foundation Stone`);
      const price = priceOf(plan);
      assert(price.timber >= 8 && price.stone >= 8 && price.timber + price.stone <= 320, `${b.id} price`);
    }
  },
  "footprints follow the way you face": () => {
    const b = { x0: -3, x1: 3, z0: 0, z1: 8 };
    const south = footprint({ x: 0, z: 0 }, { x: 0, z: 1 }, b), north = footprint({ x: 0, z: 0 }, { x: 0, z: -1 }, b);
    assertEqual(`${south.z0},${south.z1}`, "0,8");
    assertEqual(`${north.z0},${north.z1}`, "-8,0");
    assert(!boxesTouch(footprint({ x: 0, z: 1 }, { x: 0, z: 1 }, b), footprint({ x: 0, z: -1 }, { x: 0, z: -1 }, b)));
  },
  "the mason covers what you lack": () => {
    const due = bill({ timber: 64, stone: 48 }, { timber: 100, stone: 0 });
    assertEqual(due.use.timber, 64);
    assertEqual(due.short.stone, 48);
    assertEqual(due.emeralds, 2);
    assertEqual(bill({ timber: 8, stone: 8 }, { timber: 8, stone: 8 }).emeralds, 0);
  },
  "the stock list is sane": () => {
    const seen = new Set();
    for (const shelf of CATALOG) for (const [id, per] of shelf.stock) {
      assert(id.startsWith("minecraft:") && per >= 1 && per <= 64, id);
      assert(!seen.has(id), `${id} is listed twice`);
      seen.add(id);
    }
    assert(MASON_LINES.day.length && MASON_LINES.night.length && SETTLE.localBonus >= 1);
  },
  "every region has local materials at a better price": () => {
    for (const id of STYLE_IDS) {
      const local = localStock(id, () => true);
      assert(local.length >= 5, `${id} has ${local.length}`);
      assert(local.every(([, per]) => per >= 9), id);
    }
  },
});
addTests("settle", {
  "every region has its five Castle Stone blocks at the mason": () => {
    assertEqual(STONE_FAMILY.length, 25);
    assertEqual(CASTLE_STONES[0], "siege:castle_stone");
    assertEqual(stoneId("tiles", "frostmarch"), "siege:castle_tiles_frostmarch");
    for (const id of STYLE_IDS) {
      const stock = stoneStock(id, true, () => true);
      assertEqual(stock.length, 5, id);
      assert(stock.every(([block, per]) => STONE_FAMILY.includes(block) && per >= 8), id);
      assert(stoneStock(id, false, () => true)[0][1] < stock[0][1], "local stone is cheaper");
    }
    assertEqual(niceName("siege:castle_cobbled_blackfen"), "Blackfen Cobbled Castle Stone");
    assertEqual(niceName("siege:castle_tiles"), "Castle Stone Tiles");
    assert(MATERIALS.stone.match("siege:castle_bricks_saltreach") && !MATERIALS.timber.match("siege:castle_bricks_saltreach"));
  },
});
addTests("settle", {
  "the new blocks are in the pack": () => {
    for (const id of ["siege:mason_bench", "siege:foundation_stone", ...STONE_FAMILY]) assert(BlockTypes.get(id), `missing ${id}`);
  },
}, { gameOnly: true });
