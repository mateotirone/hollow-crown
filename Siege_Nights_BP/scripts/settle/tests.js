import { addTests, assert, assertEqual } from "../core/tests.js";
import { BlockTypes } from "@minecraft/server";
import { drawHall } from "../townhall/halls.js";
import { STYLES, STYLE_IDS } from "../townhall/styles.js";
import { SETTLE, CATALOG, MASON_LINES } from "./config.js";
import { BUILDINGS, drawBuilding, styleFor } from "./buildings.js";
import { hallReserve, hallReach, inBox, footprint, boxesTouch, placeVerdict, bill, priceOf, isCampKit } from "./rules.js";
import { localStock, stoneStock, wallStock, niceName } from "./mason.js";
import { STONE_FAMILY, STONE_KINDS, CASTLE_STONES, stoneId, regionalId, GATES, PORTCULLISES, REINFORCEABLE, CASTLE_BLOCKS } from "../siege/api.js";
import { MATERIALS } from "./rules.js";
import { HALL, MASON, SLOTS, place, slotsFor } from "./layout.js";
import { wallCost, nearGate } from "./walls.js";
import { WALLS, WALL_LEVELS, MAX_WALL, smoothGround, groundProblem, wallColumns, onWallLine, bearingToAngle, columnKinds, repairCost, wallArmor, wallSeed, VARIATION, WALL_STONES, WALL_STONE_IDS, WALL_TIMBER, WALL_LOG } from "./walldata.js";

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
addTests("settle walls", {
  "the guard opens the gate for someone close, not someone on the wall above or far off": () => {
    const g = { x: 0, y: 64, z: 0 };
    assert(nearGate(g, { x: 3, y: 64, z: 1 }, WALLS.gateGreet));
    assert(!nearGate(g, { x: 9, y: 64, z: 0 }, WALLS.gateGreet));
    assert(!nearGate(g, { x: 0, y: 72, z: 0 }, WALLS.gateGreet));
  },
  "log walls are stripped logs in every timber": () => {
    for (const t of WALL_TIMBER) assert(/^minecraft:stripped_\w+_log$/.test(WALL_LOG[t] ?? ""), `${t} log wall is ${WALL_LOG[t]}`);
  },
  "a wall is paid for in any stone, and the stone rows are added together": () => {
    for (let level = 1; level <= MAX_WALL; level++) {
      const rows = wallCost(level);
      assert(rows.filter(([label]) => label.startsWith("stone")).length <= 1, `level ${level} checks stone twice`);
      const raw = (WALL_LEVELS[level].cost ?? []).filter(([, , k]) => STONE_KINDS.includes(k)).reduce((n, [, a]) => n + a, 0);
      assertEqual(rows.find(([label]) => label.startsWith("stone"))?.[1] ?? 0, raw, `level ${level}`);
    }
    const [, , anyStone] = wallCost(4).find(([label]) => label.startsWith("stone"));
    for (const id of ["siege:castle_stone", "siege:castle_bricks_blackfen", "minecraft:cobblestone", "minecraft:deepslate_tiles", "minecraft:tuff_bricks",
      "minecraft:cut_sandstone", "minecraft:white_concrete", "minecraft:orange_terracotta", "minecraft:quartz_bricks", "minecraft:mud_bricks", "minecraft:blackstone"]) assert(anyStone(id), id);
    for (const id of ["minecraft:stone_sword", "minecraft:brick", "minecraft:redstone", "minecraft:stone_brick_stairs", "minecraft:oak_planks", "minecraft:glowstone"]) assert(!anyStone(id), id);
  },
  "every wall look names a block for every kind of stonework": () => {
    for (const id of WALL_STONE_IDS) {
      const look = WALL_STONES[id];
      assert(look.name && (look.castle || STONE_KINDS.every((k) => look.kinds[k]?.length)), id);
    }
    assert(WALL_STONES.castle.castle === true, "the default is still the region's Castle Stone");
  },
  "every region has its own gate, portcullis, palisade, planks and shingles": () => {
    assertEqual(regionalId("palisade"), "siege:palisade");
    assertEqual(regionalId("castle_gate", "blackfen"), "siege:castle_gate_blackfen");
    assertEqual(GATES.length, 10);
    assert(GATES.includes("siege:portcullis") && GATES.includes("siege:castle_gate"), "the Vale's gates keep their old ids");
    for (const id of GATES) assert(REINFORCEABLE.includes(id), `${id} cannot be reinforced`);
    for (const id of PORTCULLISES) assert(CASTLE_BLOCKS.includes(id), `${id} has no wall health`);
    for (const style of STYLE_IDS) assert(styleFor(style).roles.roofBlock[0].startsWith("siege:roof_shingles"), style);
    assertEqual(wallStock("saltreach", () => true).map(([id]) => id), ["minecraft:stripped_birch_log", "siege:wall_planks_saltreach", "siege:roof_shingles_saltreach", "siege:castle_gate_saltreach", "siege:portcullis_saltreach"]);
  },
  "ten levels, each at least as tall and thick as the last": () => {
    assertEqual(MAX_WALL, 10);
    for (let n = 2; n <= MAX_WALL; n++) {
      const a = WALL_LEVELS[n - 1], b = WALL_LEVELS[n];
      assert(b.h >= a.h && b.thick >= a.thick && (b.towers ?? 0) >= (a.towers ?? 0), `${b.name} is smaller than ${a.name}`);
      assert(b.name && b.cost.length, `${b.name} needs a cost`);
      for (const [, amount, kind] of b.cost) assert(amount > 0 && ["log", "plank", "stone", "cobbled", "bricks", "tiles", "smooth", "iron", "diamond", "netherite"].includes(kind), `${b.name}: ${kind}`);
      for (const kind of [b.body, b.foot, b.cap, ...Object.values(b.bands ?? {})]) assert(!kind || ["log", "fence", "stone", "cobbled", "bricks", "tiles", "smooth"].includes(kind), `${b.name}: ${kind}`);
    }
  },
  "the ring has no holes, one gate, and follows the ground": () => {
    const smooth = smoothGround(Array.from({ length: WALLS.stations }, (_, i) => 64 + Math.round(2 * Math.sin(i / 7))));
    assertEqual(groundProblem(smooth), undefined);
    for (const level of [1, 4, 10]) {
      const cols = wallColumns({ center: { x: 0, z: 0 }, level, gateAngle: bearingToAngle(180), smooth });
      const at = new Set(cols.map((c) => `${c.x},${c.z}`));
      for (const c of cols) {
        let near = 0;
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if ((dx || dz) && at.has(`${c.x + dx},${c.z + dz}`)) near++;
        assert(near >= 2, `level ${level}: a hole at ${c.x},${c.z}`);
        assert(c.top - c.base === WALL_LEVELS[level].h || c.role === "tower" || c.role === "walk", "height");
      }
      const open = cols.filter((c) => c.role === "gap" || c.role === "gate" || c.role === "port");
      assert(open.length >= WALLS.gateWidth && open.every((c) => c.z > 40 && Math.abs(c.x) <= 2), `level ${level}: the gate should be due south`);
      assert(cols.every((c) => Math.hypot(c.x, c.z) <= WALLS.radius + 5), "inside the ring");
    }
  },
  "steep ground is refused, the wall line is reserved": () => {
    assert(groundProblem([64, 64, 75, 64]));
    assert(onWallLine({ x: 0, z: 0 }, { x: WALLS.radius - 1, z: 0 }) && !onWallLine({ x: 0, z: 0 }, { x: 20, z: 0 }));
    assertEqual(Math.round(Math.cos(bearingToAngle(90))), 1); // east is +x
    assertEqual(Math.round(Math.sin(bearingToAngle(0))), -1); // north is -z
  },
  "every slot is clear of the hall, the wall and the other slots, whichever way the gate faces": () => {
    for (const gateDir of ["north", "east", "south", "west"]) {
      const center = { x: 1000, y: 64, z: -500 };
      const hallAt = place(center, gateDir, HALL);
      const boxes = STYLE_IDS.map((style) => hallReserve({ x: hallAt.x, z: hallAt.z, fx: hallAt.forward.x, fz: hallAt.forward.z, style }, 1));
      assert(!boxes.some((b) => inBox(b, center)), `${gateDir}: the hall would cover the Keep Banner`);
      for (const slot of SLOTS) {
        assert(BUILDINGS.some((b) => b.id === slot.building), slot.building);
        const at = place(center, gateDir, slot);
        const box = footprint(at, at.forward, drawBuilding(slot.building, "vale").bounds());
        for (const hall of boxes) assert(!boxesTouch(box, hall), `${gateDir}: ${slot.id} stands where the hall grows`);
        for (const c of [{ x: box.x0, z: box.z0 }, { x: box.x1, z: box.z0 }, { x: box.x0, z: box.z1 }, { x: box.x1, z: box.z1 }]) {
          assert(Math.hypot(c.x - center.x, c.z - center.z) < WALLS.radius - WALLS.reserve - 3, `${gateDir}: ${slot.id} reaches the wall`);
        }
        assert(!inBox(box, center), `${slot.id} covers the banner`);
        boxes.push(box);
      }
      const bench = place(center, gateDir, MASON);
      assert(!boxes.some((b) => inBox(b, bench)), `${gateDir}: the mason's bench is in the way`);
    }
    assert(slotsFor(0).length >= 2 && slotsFor(3).length === SLOTS.length);
  },
  "the biggest hall fits inside the wall": () => {
    for (const id of STYLE_IDS) {
      const r = hallReach(id);
      assert(Math.hypot(r.side, HALL.ahead + r.deep) < WALLS.radius - 3, `${id}: hall reaches ${Math.round(Math.hypot(r.side, HALL.ahead + r.deep))}`);
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
    for (const id of ["siege:mason_bench", "siege:foundation_stone", ...STONE_FAMILY, ...GATES, ...STYLE_IDS.flatMap((s) => wallStock(s, () => true).map(([id]) => id))]) assert(BlockTypes.get(id), `missing ${id}`);
  },
}, { gameOnly: true });
addTests("settle walls", {
  "repair: every level lists what should stand, and the price follows the damage": () => {
    const smooth = new Array(WALLS.stations).fill(64);
    let last = 0;
    for (let level = 1; level <= MAX_WALL; level++) {
      const L = WALL_LEVELS[level];
      let n = 0, gates = 0;
      for (const col of wallColumns({ center: { x: 0, y: 64, z: 0 }, level, gateAngle: bearingToAngle(180), smooth })) {
        for (const [y, kind] of columnKinds(L, col)) {
          assert(y > 64 && typeof kind === "string", `level ${level}: bad cell`);
          n++;
          if (kind === "gate") gates++;
        }
      }
      assert(n > last * 0.5 && n > 300, `level ${level} has ${n} blocks`);
      assert(level === 1 ? gates === 0 : gates >= 6, `level ${level}: gate leaves ${gates}`);
      last = n;
    }
    assertEqual(repairCost({ missing: 0, cracked: 0 }), 0);
    assertEqual(repairCost({ missing: 1, cracked: 0 }), WALLS.repair.least);
    assert(repairCost({ missing: 200, cracked: 100 }) > repairCost({ missing: 100, cracked: 100 }), "more holes cost more");
    assert(repairCost({ missing: 40, cracked: 0 }) > repairCost({ missing: 0, cracked: 40 }), "a hole costs more than a crack");
  },
  "a higher wall is a stronger wall": () => {
    assertEqual(wallArmor(1), 0);
    assertEqual(wallArmor(10), 3);
    for (let level = 2; level <= MAX_WALL; level++) assert(wallArmor(level) >= wallArmor(level - 1), `level ${level} is weaker than the one before`);
  },
});
addTests("settle walls", {
  "walls vary along their length and from one settlement to the next, the same way every time": () => {
    const smooth = new Array(WALLS.stations).fill(64);
    const wall = (center, level) => {
      const out = [];
      for (const col of wallColumns({ center, level, gateAngle: bearingToAngle(180), smooth })) {
        for (const [y, kind] of columnKinds(WALL_LEVELS[level], col, wallSeed(center))) out.push(`${col.x - center.x},${y},${col.z - center.z},${kind}`);
      }
      return out;
    };
    const here = { x: 100, y: 64, z: -300 }, there = { x: -820, y: 64, z: 415 };
    for (const level of [2, 5, 8, 10]) {
      const a = wall(here, level);
      assertEqual(a.join("|"), wall(here, level).join("|"), `level ${level} must rebuild exactly the same`);
      assert(a.join("|") !== wall(there, level).join("|"), `level ${level}: two settlements have the same wall`);
    }
    const kinds = (level) => new Set(wall(here, level).map((c) => c.split(",")[3]));
    assert(kinds(8).has("slit") && kinds(8).has("light") && kinds(8).has("stone") && kinds(8).has("smooth"), "a Curtain Wall has slits, lanterns and weathered stone");
    const weathered = wall(here, 8).filter((c) => c.endsWith(",stone")).length / wall(here, 8).length;
    assert(weathered > 0.03 && weathered < VARIATION.weather, `weathering should be a little, got ${weathered}`);
  },
});
