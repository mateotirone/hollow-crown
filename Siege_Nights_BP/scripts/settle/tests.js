import { addTests, assert, assertEqual } from "../core/tests.js";
import { BlockTypes } from "@minecraft/server";
import { drawHall } from "../townhall/halls.js";
import { STYLES, STYLE_IDS } from "../townhall/styles.js";
import { SETTLE, CATALOG, MASON_LINES } from "./config.js";
import { BUILDINGS, BUILDING, drawBuilding, styleFor } from "./buildings.js";
import { hallReserve, hallReach, inBox, footprint, boxesTouch, placeVerdict, bill, priceOf, isCampKit } from "./rules.js";
import { localStock, stoneStock, wallStock, niceName } from "./mason.js";
import { STONE_FAMILY, STONE_KINDS, CASTLE_STONES, stoneId, regionalId, GATES, PORTCULLISES, REINFORCEABLE, CASTLE_BLOCKS, isStructural } from "../siege/api.js";
import { MATERIALS } from "./rules.js";
import { HALL, MASON, SLOTS, place, slotsFor } from "./layout.js";
import { wallCost, nearGate, gateGuardStep } from "./walls.js";
import { wallShape, radiusAt } from "./walldata.js";
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
  "the guard opens the gate once as you arrive, and a gate you shut by hand stays shut": () => {
    assertEqual(gateGuardStep({ friendNear: true, greeted: false, opened: false, guards: 2 }), "open");
    assertEqual(gateGuardStep({ friendNear: true, greeted: true, opened: false, guards: 2 }), "wait", "you shut it yourself: he leaves it");
    assertEqual(gateGuardStep({ friendNear: true, greeted: true, opened: true, guards: 2 }), "wait");
    assertEqual(gateGuardStep({ friendNear: false, greeted: true, opened: true, guards: 2 }), "shut");
    assertEqual(gateGuardStep({ friendNear: true, greeted: false, opened: false, guards: 0 }), "wait", "no guard, no doorman");
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
        if (c.role === "stair" || c.role === "ladder" || c.role === "landing") continue; // steps, landings and ladders stand inside the ring
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
        assert(BUILDING[slot.building], slot.building); // the old fixed layout still names the retired plot Storehouse
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

// ---------- town layouts (towns.js) ----------
import { TOWNS } from "./towns_data.js";
import { townFor, townNames, pickLayout, slotsOf, groundwork, fixturesOf, wallRadius, seatOnSlot, seatedBox, hallBox } from "./towns.js";

addTests("settle towns", {
  "the wall line wanders but stays clear of the plots and inside the land": () => {
    for (const name of ["Dunehold", "Frosthelm", "x:1,2"]) {
      const shape = wallShape(name);
      assertEqual(shape.length, 72);
      assertEqual(JSON.stringify(shape), JSON.stringify(wallShape(name)));
      assert(Math.max(...shape) - Math.min(...shape) > 0.8, `${name}: too round`);
      const center = { x: 0, y: 64, z: 0, shape };
      for (const r of [36, 46, 56, 66]) {
        let lo = 99, hi = 0;
        for (let i = 0; i < 360; i++) { const R = radiusAt(center, r, (i / 360) * Math.PI * 2); lo = Math.min(lo, R - r); hi = Math.max(hi, R - r); }
        assert(lo >= -WALLS.wobble.in - 1e-9 && hi <= WALLS.wobble.out + 1e-9, `${name} r${r}: ${lo}..${hi}`);
        assert(hi - lo > 1.5, `${name} r${r}: barely wanders`);
        assert(r + hi <= WALLS.radius + WALLS.landBeyond - 2 + 1e-9, `${name} r${r}: reaches ${r + hi}, past the land`);
      }
      const cols = wallColumns({ center, radius: 66, level: 1, gateAngle: 0, smooth: Array(48).fill(64) });
      for (const c of cols) assert(Math.hypot(c.x, c.z) <= 66 + WALLS.wobble.out + 1 && Math.hypot(c.x, c.z) >= 66 - WALLS.wobble.in - 4, `${c.x},${c.z}`);
    }
    assertEqual(radiusAt({ x: 0, z: 0 }, 40, 1), 40); // old walls without a shape stay round
  },
  "every building has a price on a town plot": () => {
    for (const b of BUILDINGS) assert(SETTLE.plotPrices[b.id] > 0, b.id);
  },
  "every map plot has three town layouts, with walls at 36, 54, 60 and 66 that follow its starter village's outline": () => {
    assertEqual(townNames().length, 12);
    for (const [key, town] of Object.entries(TOWNS)) {
      assertEqual(town.variants.length, 3, key);
      assertEqual(town.walls.join(","), "36,54,60,66", key); // the Town ring moved out so its plots fit round the village (Mateo 2026-11-13)
      assert(town.outline?.radii?.length >= 48 && town.outline.radiiAt === 36, `${key} has the starter village's wall outline`);
      assertEqual(wallRadius(town, 0), 36);
      assertEqual(wallRadius(town, 9), 66);
      assertEqual(wallRadius(town, 3), WALLS.radius); // the Castle ring is the biggest wall the land is sized for
      assert(townFor(town.name) === town, key);
    }
  },
  "a settlement keeps its layout pick, and picks are spread over the layouts that pass the charters": () => {
    const town = townFor("Dunehold");
    assertEqual(pickLayout(town, "player-1:Dunehold"), pickLayout(town, "player-1:Dunehold"));
    const passing = town.variants.filter((v) => v.charter !== false).length || town.variants.length;
    const seen = new Set();
    for (let i = 0; i < 60; i++) seen.add(pickLayout(town, `p${i}:Dunehold`));
    assertEqual(seen.size, passing);
    assertEqual(pickLayout(undefined, "x"), -1);
    const fake = { variants: [{ charter: false }, { charter: true }, { charter: false }] };
    for (let i = 0; i < 20; i++) assertEqual(pickLayout(fake, `p${i}`), 1);
    const none = { variants: [{ charter: false }, { charter: false }] };
    assert([0, 1].includes(pickLayout(none, "x")));
  },
  "groundwork decodes into rows near the plot, in each tier": () => {
    for (const [key, town] of Object.entries(TOWNS)) {
      for (const layout of town.variants) {
        let rows = 0;
        for (let t = 0; t < 4; t++) {
          for (const [dx, dy, dz, p] of groundwork(layout, t)) {
            assert(Math.abs(dx) <= WALLS.radius + WALLS.landBeyond && Math.abs(dz) <= WALLS.radius + WALLS.landBeyond && Math.abs(dy) < 32, `${key}: ${dx},${dy},${dz}`);
            assert(p >= 0 && p < layout.pal.length, `${key}: palette ${p}`);
            rows++;
          }
        }
        assert(rows > 1000, `${key} ${layout.label}: only ${rows} rows`);
      }
    }
  },
  "slots open by tier, have a door side and stand inside the Castle wall": () => {
    for (const [key, town] of Object.entries(TOWNS)) {
      for (const layout of town.variants) {
        const slots = slotsOf(layout);
        assert(slots.some((s) => s.tier === 0), `${key} ${layout.label}: no Hamlet slots`);
        for (const s of slots) {
          assert(s.tier >= 0 && s.tier <= 3 && s.door, `${key} ${s.id}`);
          for (const [x, z] of [[s.box.x0, s.box.z0], [s.box.x1, s.box.z1], [s.box.x0, s.box.z1], [s.box.x1, s.box.z0]]) {
            const wall = town.outline ? radiusAt(town.outline, wallRadius(town, s.tier), Math.atan2(z, x)) : wallRadius(town, s.tier);
            assert(Math.hypot(x, z) < wall, `${key} ${layout.label} ${s.id} reaches past its tier's wall`);
          }
        }
      }
    }
  },
  "a building seated on a slot stays inside it, front on the door side": () => {
    const layout = townFor("Dunehold").variants[0];
    let seated = 0;
    for (const slot of slotsOf(layout)) {
      for (const b of BUILDINGS) {
        const bounds = drawBuilding(b.id, "vale").bounds();
        const seat = seatOnSlot(slot, bounds);
        if (!seat) continue;
        seated++;
        const box = seatedBox(seat, bounds);
        assert(box.x0 >= slot.box.x0 && box.x1 <= slot.box.x1 && box.z0 >= slot.box.z0 && box.z1 <= slot.box.z1, `${slot.id} ${b.id}`);
        const front = { n: box.z0 === slot.box.z0, s: box.z1 === slot.box.z1, e: box.x1 === slot.box.x1, w: box.x0 === slot.box.x0 }[slot.side];
        assert(front, `${slot.id} ${b.id}: not against the door side`);
        assertEqual(seat.forward.x, -slot.door.x);
        assertEqual(seat.forward.z, -slot.door.z);
      }
    }
    assert(seated > 20, `only ${seated} fits`);
    assertEqual(seatOnSlot({ ...slotsOf(layout)[0], box: { x0: 0, z0: 0, x1: 2, z1: 2 } }, drawBuilding("cottage", "vale").bounds()), undefined);
  },
  "every layout has a Hamlet slot the library fits, and its hall box grows": () => {
    const lib = drawBuilding("library", "vale").bounds();
    for (const [key, town] of Object.entries(TOWNS)) {
      for (const layout of town.variants) {
        assert(slotsOf(layout).some((s) => s.tier === 0 && seatOnSlot(s, lib)), `${key} ${layout.label}`);
        const a = hallBox(layout, 1), b = hallBox(layout, 5);
        assert((b.x1 - b.x0) * (b.z1 - b.z0) > (a.x1 - a.x0) * (a.z1 - a.z0), key);
        assert(fixturesOf(layout, 0).some((f) => f.kind === "hall_cornerstone") && fixturesOf(layout, 0).some((f) => f.kind === "mason_bench"), key);
      }
    }
  },
});

import { levelSite, foundationColumns, MAX_LIFT, Groundwork } from "./ground.js";

addTests("settle ground", {
  "a building's floor goes on the highest ground under it, and every footprint column gets foundation": () => {
    // ground at y 64, with a hump to 67 in one corner of where the cottage goes, and a tree trunk that doesn't count
    const ground = (x, z) => (x >= 3 && z >= 3 ? 67 : 64);
    const fake = {
      getBlock: ({ x, y, z }) => {
        const top = ground(x, z);
        const typeId = y <= top ? "minecraft:dirt" : x === 0 && z === 2 && y <= 75 ? "minecraft:oak_log" : "minecraft:air";
        return { typeId, location: { x, y, z }, below() { return fake.getBlock({ x, y: y - 1, z }); } };
      },
      getTopmostBlock: ({ x, z }) => fake.getBlock({ x, y: 75, z }),
    };
    const plan = drawBuilding("cottage", "vale");
    const { origin, lift } = levelSite(fake, plan, { x: 0, y: 65, z: 0 }, { x: 0, z: 1 });
    assertEqual(origin.y, 68);
    assertEqual(lift, 3);
    const flat = levelSite({ ...fake, getBlock: ({ x, y, z }) => fake.getBlock({ x: -99, y, z }) }, plan, { x: 0, y: 65, z: 0 }, { x: 0, z: 1 });
    assertEqual(flat.lift, 0);
    const b = plan.bounds();
    assertEqual(foundationColumns(plan).length, (b.x1 - b.x0 + 1) * (b.z1 - b.z0 + 1));
    assert(MAX_LIFT >= 4);
  },
  "terraform: a floor on a slope cuts in at most 3, and the groundwork blends the land round it": () => {
    // a 1 in 1 slope rising to the east
    const ground = (x) => 64 + Math.max(-6, Math.min(12, x));
    const set = new Map();
    const fake = {
      getBlock: ({ x, y, z }) => {
        const k = `${x},${y},${z}`;
        const typeId = set.has(k) ? set.get(k) : y <= ground(x) ? "minecraft:grass_block" : "minecraft:air";
        return { typeId, location: { x, y, z }, permutation: null, below() { return fake.getBlock({ x, y: y - 1, z }); },
          setPermutation(p) { set.set(k, String(p)); } };
      },
      getTopmostBlock: ({ x, z }) => fake.getBlock({ x, y: ground(x), z }),
    };
    const plan = drawBuilding("cottage", "vale");
    const b = plan.bounds();
    const { origin } = levelSite(fake, plan, { x: 0, y: 65, z: 0 }, { x: 0, z: 1 }, { terraform: true });
    const high = Math.max(...[b.x0, b.x1].map((x) => ground(-x))); // forward +z: plan x runs to world -x
    assert(origin.y - 1 <= high && origin.y - 1 >= high - 3, `floor ${origin.y - 1}, high ${high}`);
    const g = new Groundwork(plan, origin, { x: 0, z: 1 }, "vale");
    let r, n = 0;
    while ((r = g.step(fake, 400)) !== "done" && n++ < 200) assert(r !== "wait");
    assertEqual(r, "done");
    assert(g.todo.length > 0, "nothing regraded on a slope");
    assert(g.todo.every((t) => Math.abs(t.x) <= 20 && Math.abs(t.z) <= 20), "regraded too far out");
    // the door landing: 4 out and 3 wide in front of the door (world -z here), level with the floor
    assertEqual(g.landing.length, 12);
    assert(g.landing.every(([x, z]) => z < 0 && Math.abs(x) <= 1), "landing not in front of the door");
    for (const [x, z] of g.landing) assertEqual(g.T[x - g.x0][z - g.z0], g.floor, `landing ${x},${z}`);
  },
  "the level 1 wall is a low log palisade, not a fence": () => {
    assertEqual(WALL_LEVELS[1].body, "log");
    assert(WALL_LEVELS[1].h >= 2);
  },
});

// ---------- plot rules and charters (charters.js, config.js) ----------
import { plotFit, charterCheck, charterKeeps, slotClass, opensAt } from "./charters.js";
import { PLOT_SIZE as PSIZE, CHARTERS as CHARTER_LIST } from "./config.js";
import { townNames as allTownNames, townFor as townByName, slotsOf as slotsOfLayout } from "./towns.js";
import { BLOCK_BUILDS as BLOCK_BUILD_LIST } from "./blockdesigns.js";

addTests("settle charters", {
  "every plot building has a size class and an opening tier"() {
    for (const b of BUILDINGS) {
      assert(["S", "M", "ML", "L", "G"].includes(PSIZE[b.id]), `${b.id} has no PLOT_SIZE`);
      assert(opensAt(b.id) >= 0 && opensAt(b.id) <= 3, `${b.id} opens at ${opensAt(b.id)}`);
    }
  },
  "buildings go on plots of their own size, with the market and barracks exceptions"() {
    const S = { size: "S", tags: [] }, M = { size: "M", tags: [] }, ML = { size: "M", long: true, tags: [] }, L = { size: "L", tags: [] };
    assertEqual(slotClass(ML), "ML");
    assert(plotFit("cottage", S).ok && !plotFit("cottage", M).ok, "cottage takes Small only");
    assert(plotFit("market", L).ok && plotFit("market", ML).ok && !plotFit("market", M).ok, "market: Large or long Medium");
    assert(!plotFit("barracks", M, new Set(["M", "S"])).ok && !plotFit("barracks", ML).ok, "barracks: never a Medium (the guardhouse is 15 x 17)");
    const deep = { size: "L", tags: [], box: { x0: 0, z0: 0, x1: 14, z1: 16 }, door: { x: 0, z: -1 } };
    const flat = { size: "L", tags: [], box: { x0: 0, z0: 0, x1: 14, z1: 14 }, door: { x: 0, z: -1 } };
    const side = { size: "L", tags: [], box: { x0: 0, z0: 0, x1: 16, z1: 14 }, door: { x: -1, z: 0 } };
    assert(plotFit("barracks", deep).ok && plotFit("barracks", side).ok, "barracks on a 15 x 17 Large, either way round");
    assert(!plotFit("barracks", flat).ok && plotFit("market", flat).ok, "a 15 x 15 Large is too shallow for the barracks only");
    assert(plotFit("library", ML).ok, "library on the long Medium");
  },
  "location tags: the watchtower needs the wall, good spots are marked"() {
    const bare = plotFit("watchtower", { size: "S", tags: ["square"] });
    assert(!bare.ok && bare.tagged && /wall/.test(bare.why), `watchtower off the wall: ${JSON.stringify(bare)}`);
    assert(plotFit("watchtower", { size: "S", tags: ["wall"] }).ok, "watchtower by the wall");
    assert(plotFit("well", { size: "S", tags: ["square"] }).tagged, "well on the square is a good spot");
  },
  "charters: Hamlet free, Town needs homes and a market, missing designs are skipped"() {
    const known = new Set(["cottage", "market", "barracks", "smithy"]);
    assert(charterCheck(0, {}, known).met, "Hamlet charter is empty");
    const short = charterCheck(1, { cottage: 2, market: 1 }, known);
    assert(!short.met, "two homes are not enough");
    assert(short.lines.find((l) => l.what === "Mint").skipped, "the Mint is skipped until it exists");
    assert(charterCheck(1, { cottage: 3, market: 1 }, known).met, "three homes and a market");
    const city = charterCheck(2, { cottage: 6, market: 1, barracks: 1 }, known);
    assert(!city.met, "City needs one more work building");
    assertEqual(city.lines.find((l) => l.more).need, 3);
    assert(charterCheck(2, { cottage: 6, market: 1, barracks: 1, smithy: 1 }, known).met, "one more work building of any size");
    assertEqual(CHARTER_LIST.length, 4);
  },
  "every building has a plot it may take in every charter-passing layout"() {
    const known = new Set([...BUILDINGS.map((b) => b.id), ...Object.keys(BLOCK_BUILD_LIST).map((t) => t.replace(/^siege:/, ""))]);
    for (const name of allTownNames()) {
      const town = townByName(name);
      for (const [i, v] of town.variants.entries()) {
        if (v.charter === false) continue;
        const slots = slotsOfLayout(v);
        for (const b of BUILDINGS) {
          if (!known.has(b.id)) continue;
          assert(slots.some((s) => plotFit(b.id, s, new Set()).ok || plotFit(b.id, s, new Set(["none"])).ok), `${name} layout ${i}: nowhere for the ${b.id}`);
        }
      }
    }
  },
});

// ---------- your own builds and beds (census.js) ----------
import { tally, matches, bedCap, bedsCounted } from "./census.js";

// A hand-built hut: floor 7x7 at y 0, walls to y 3, a roof at y 4, with what's passed in inside
function hut(extra = [], { roof = true } = {}) {
  const cells = [];
  for (let x = 0; x < 7; x++) for (let z = 0; z < 7; z++) {
    cells.push({ x, y: 0, z, id: "minecraft:spruce_planks" });
    if (roof) cells.push({ x, y: 4, z, id: "minecraft:spruce_slab" });
    if (x === 0 || z === 0 || x === 6 || z === 6) for (let y = 1; y <= 3; y++) cells.push({ x, y, z, id: "minecraft:cobblestone" });
  }
  return [...cells, ...extra];
}

addTests("settle census", {
  "a hut with a bed and a door counts as a home"() {
    const t = tally(hut([
      { x: 2, y: 1, z: 2, id: "minecraft:bed", head: true }, { x: 2, y: 1, z: 3, id: "minecraft:bed" },
      { x: 3, y: 1, z: 0, id: "minecraft:spruce_door" }, { x: 3, y: 2, z: 0, id: "minecraft:spruce_door", upper: true },
      { x: 4, y: 1, z: 4, id: "minecraft:spruce_trapdoor" },
    ]));
    assertEqual(t.groups.bed, 1);
    assertEqual(t.groups.door, 1);
    assert(matches(t).find((m) => m.id === "cottage").ok, "home");
    assertEqual(bedCap(t), 2); // 25 covered floor inside the walls / 12
    assertEqual(bedsCounted(t), 1);
  },
  "no roof, no home; and it says what's missing"() {
    const t = tally(hut([{ x: 2, y: 1, z: 2, id: "minecraft:bed", head: true }, { x: 3, y: 1, z: 0, id: "minecraft:wooden_door" }], { roof: false }));
    const m = matches(t).find((x) => x.id === "cottage");
    assert(!m.ok && m.missing.includes("more roof"), JSON.stringify(m));
    assertEqual(bedsCounted(t), 0);
  },
  "bookshelves make a library, an anvil and furnace a smithy"() {
    const books = Array.from({ length: 8 }, (_, i) => ({ x: 1 + (i % 5), y: 1 + Math.floor(i / 5), z: 1, id: "minecraft:bookshelf" }));
    assert(matches(tally(hut(books))).find((m) => m.id === "library").ok, "library");
    const forge = [{ x: 2, y: 1, z: 2, id: "minecraft:anvil" }, { x: 3, y: 1, z: 2, id: "minecraft:furnace" }];
    assert(matches(tally(hut(forge))).find((m) => m.id === "smithy").ok, "smithy");
    assert(!matches(tally(hut())).some((m) => m.ok && m.id !== "well"), "an empty hut is nothing");
  },
});

addTests("settle census", {
  "an inn, a farmhouse and a mint can be built by hand"() {
    const beds = [0, 2, 4].map((x) => ({ x: 1 + x, y: 1, z: 2, id: "minecraft:bed", head: true }));
    const chests = [{ x: 2, y: 1, z: 5, id: "minecraft:chest" }, { x: 3, y: 1, z: 5, id: "minecraft:barrel" }];
    assert(matches(tally(hut([...beds, ...chests]))).find((m) => m.id === "inn").ok, "inn");
    const farm = [{ x: 1, y: 1, z: 1, id: "minecraft:composter" }, ...Array.from({ length: 9 }, (_, i) => ({ x: 1 + (i % 5), y: 0.5, z: 3 + Math.floor(i / 5), id: "minecraft:farmland" }))];
    assert(matches(tally(hut(farm))).find((m) => m.id === "farmhouse").ok, "farmhouse");
    assert(matches(tally(hut([...chests, { x: 4, y: 1, z: 4, id: "minecraft:anvil" }]))).find((m) => m.id === "mint").ok, "mint");
  },
});

// ---------- a lord's crew furnishes the homes it finishes (census.js bedPlaces) ----------
import { bedPlaces } from "./census.js";
addTests("settle census", {
  "a lord's crew fits beds that count, clear of the door and of each other"() {
    const door = [{ x: 3, y: 1, z: 0, id: "minecraft:spruce_door" }, { x: 3, y: 2, z: 0, id: "minecraft:spruce_door", upper: true }];
    const cells = hut(door);
    const cap = bedCap(tally(cells));
    const beds = bedPlaces(cells, cap);
    assertEqual(beds.length, cap);
    const placed = beds.flatMap((b) => [{ ...b.head, id: "minecraft:bed", head: true }, { ...b.foot, id: "minecraft:bed" }]);
    assertEqual(bedsCounted(tally([...cells, ...placed])), cap, "every bed it places counts");
    const STEP = [[0, 1], [-1, 0], [0, -1], [1, 0]];
    for (const b of beds) {
      assertEqual(b.head.x - b.foot.x, STEP[b.dir][0]); assertEqual(b.head.z - b.foot.z, STEP[b.dir][1]);
      for (const p of [b.foot, b.head]) assert(Math.abs(p.x - 3) > 2 || Math.abs(p.z) > 2, "clear of the door");
    }
    const cellsOf = beds.flatMap((b) => [b.foot, b.head]);
    for (let i = 0; i < beds.length; i++) for (let j = i + 1; j < beds.length; j++)
      for (const p of [beds[i].foot, beds[i].head]) for (const q of [beds[j].foot, beds[j].head]) assert(Math.abs(p.x - q.x) + Math.abs(p.z - q.z) > 1, "beds don't touch");
    assertEqual(new Set(cellsOf.map((p) => `${p.x},${p.z}`)).size, cellsOf.length);
  },
  "no roof or no room, no beds"() {
    assertEqual(bedPlaces(hut([], { roof: false }), 2).length, 0);
    assertEqual(bedPlaces(hut(), 0).length, 0);
  },
});

// ---------- townsfolk in Rival Lords' towns (folk.js, census.js lordArrivals) ----------
import { lineFor } from "./folk.js";
import { lordArrivals } from "./census.js";
import { SETTLER_LINES, SETTLERS as FOLK } from "./config.js";
addTests("settle settlers", {
  "a lord's townsfolk talk the lord's way, and every temper has lines"() {
    for (const t of ["proud", "grasping", "devout", "wary", "bold", "kind", "steady"]) assert(SETTLER_LINES.lord[t]?.length >= 2, t);
    const proud = new Set(Array.from({ length: 9 }, (_, d) => lineFor({ n: 1 }, { day: d, temper: "proud" })));
    assert([...proud].some((l) => SETTLER_LINES.lord.proud.includes(l)), "proud lines heard");
    assert(SETTLER_LINES.lord.steady.includes(lineFor({ n: 1 }, { day: 1, temper: "who knows" })) || SETTLER_LINES.day.includes(lineFor({ n: 1 }, { day: 1, temper: "who knows" })));
    assert(SETTLER_LINES.wary.includes(lineFor({ n: 2 }, { day: 3, temper: "kind", wary: true })), "wary after a takeover");
    assertEqual(lineFor({ n: 2, idle: true }, { temper: "kind" }), SETTLER_LINES.idle);
    assert(SETTLER_LINES.night.includes(lineFor({ n: 4 }, { night: true, temper: "bold" })), "night is night everywhere");
  },
  "a lord's town takes one newcomer a dawn it missed, up to the catch-up cap"() {
    assertEqual(lordArrivals(undefined, 10), 1);
    assertEqual(lordArrivals(9, 10), 1);
    assertEqual(lordArrivals(8, 10), 2);
    assertEqual(lordArrivals(0, 40), FOLK.lordCatchUp);
    assertEqual(lordArrivals(10, 10), 1);
  },
});

// ---------- town events and settler requests (events_rules.js) ----------
import { OPENS_AT } from "./config.js";
import { eventsFor, requestsFor, gap, quietDay, buildDone, fill } from "./events_rules.js";
import { TOWN_EVENTS, REQUESTS, SITE_EVENTS, EVENTS } from "./events_data.js";
addTests("settle events", {
  "events and requests: unique ids, a kind each, words for each"() {
    const kinds = new Set(["fight", "mystery", "journey", "quiet", "social", "build"]);
    for (const list of [TOWN_EVENTS, REQUESTS, SITE_EVENTS]) assertEqual(new Set(list.map((e) => e.id)).size, list.length);
    for (const e of TOWN_EVENTS) assert(kinds.has(e.kind) && e.name && e.start, e.id);
    for (const r of REQUESTS) {
      assert(kinds.has(r.kind) && r.ask && r.thanks && ["build", "bring", "bed"].includes(r.type), r.id);
      if (r.type === "bring") assert(r.item && r.count > 0, r.id);
      if (r.type === "build") assert(r.ids.every((id) => OPENS_AT[id] !== undefined), r.id);
    }
    for (const t of [...TOWN_EVENTS.map((e) => e.start), ...REQUESTS.map((r) => r.ask)]) assert(!/hollow/i.test(t), "nothing names the Hollow");
  },
  "what can happen depends on the town"() {
    const bare = { tier: 0, counts: {}, settlers: 0, freeBeds: 0 };
    const ev = eventsFor(bare);
    assert(ev.includes("market_fair") && !ev.includes("wedding") && !ev.includes("harvest_day"), ev.join());
    const busy = { tier: 2, counts: { farmhouse: 1, library: 1 }, settlers: 4, freeBeds: 1 };
    assert(["wedding", "harvest_day", "lost_traveller", "supper_miscount"].every((id) => eventsFor(busy).includes(id)));
    const lord = eventsFor({ ...busy, lord: true });
    assert(lord.includes("market_fair") && !lord.includes("harvest_day"), "lords get the public ones");
    assertEqual(requestsFor({ ...busy, lord: true }).length, 0);
    const asks = requestsFor(bare, (id) => OPENS_AT[id] ?? 3);
    assert(asks.includes("well_square") && !asks.includes("watchtower") && !asks.includes("kin") && !asks.includes("book"), asks.join());
    assert(requestsFor(busy, (id) => OPENS_AT[id] ?? 3).includes("book"), "book once there's a library");
  },
  "pacing: gaps in range, quiet round sieges, build requests need one more"() {
    for (let i = 0; i < 20; i++) { const g = gap(EVENTS.eventGap, () => i / 20); assert(g >= EVENTS.eventGap[0] && g <= EVENTS.eventGap[1], g); }
    assert(quietDay(10, { siegeTonight: true }));
    assert(quietDay(10, { lastSiege: 9 }));
    assert(!quietDay(10, { lastSiege: 7 }));
    const well = REQUESTS.find((r) => r.id === "well_square");
    assert(!buildDone(well, { well: 1 }, { well: 1 }));
    assert(buildDone(well, { well: 1 }, { well: 2 }));
    assertEqual(fill("{a} in {town} {x}", { a: "Maud", town: "Oakmere" }), "Maud in Oakmere {x}");
  },
});

// ---------- the level-4 and level-5 halls take their plots (hallmove.js) ----------
import { HALL_TAKES_AT, takenAt } from "./hallmove.js";
addTests("settle charters", {
  "layouts have hall4 and hall5 plots, and the hall takes them at levels 4 and 5"() {
    assertEqual(HALL_TAKES_AT, 4);
    assertEqual(takenAt({ tags: ["hall4"] }), 4);
    assertEqual(takenAt({ tags: ["corner", "hall5"] }), 5);
    assertEqual(takenAt({ tags: ["corner"] }), undefined);
    const total = { 4: 0, 5: 0 };
    for (const name of allTownNames()) for (const v of townByName(name).variants) {
      if (v.charter === false) continue;
      for (const s of slotsOfLayout(v)) if (takenAt(s)) total[takenAt(s)]++;
    }
    assert(total[4] > 0 && total[5] > 0, "some passing layouts have hall4 and hall5 plots");
  },
  "a plot that is the last one a charter need can use is kept for it, for players and lords alike"() {
    const known = new Set(BUILDINGS.map((b) => b.id));
    const v = townByName("gullcliff").variants.find((x) => x.charter !== false);
    const slots = slotsOfLayout(v);
    // just the plots the Town charter needs, one each, from a real layout: then the Mint's Medium is the last it can use
    const used = new Set(slots.filter((s) => s.start || s.tags.includes("library")).map((s) => s.id)); // standing from the start
    const take = (id) => { const s = slots.find((q) => q.tier <= 1 && !used.has(q.id) && plotFit(id, q).ok); if (s) used.add(s.id); return s; };
    const farm = take("farmhouse"), mint = take("mint"), market = take("market"), homes = [take("cottage"), take("cottage"), take("cottage")];
    assert(farm && mint && market && homes.every(Boolean), "gullcliff has a plot for each Town charter building");
    const free = [farm, mint, market, ...homes];
    const counts = { library: 1, house: 2 };
    const kept = charterKeeps(free, 0, counts, known, mint, "house");
    assert(kept, "a house on the Mint's only Medium would leave the Town charter without a plot");
    assert(kept.ids.length && kept.ids.every((id) => plotFit(id, mint).ok), "it names what may go there");
    assert(!charterKeeps(free, 0, counts, known, mint, kept.ids[0]), "the building it is kept for is allowed");
    assert(!charterKeeps([...free, ...slots.filter((s) => s.size === "S" && !used.has(s.id))], 0, counts, known, homes[0], "cottage"), "a cottage on a Small plot is fine");
    assert(!charterKeeps(free, 0, { ...counts, cottage: 9, farmhouse: 1, mint: 1, market: 1, inn: 1, barracks: 1, smithy: 1 }, known, mint, "house"), "nothing is kept once the charters are met");
  },
  "every passing layout reserves a Mason's yard by the forecourt"() {
    for (const name of allTownNames()) for (const v of townByName(name).variants) {
      if (v.charter === false) continue;
      const f = fixturesOf(v, 0).find((x) => x.kind === "mason_yard");
      assert(f && "nsew".includes(f.rotation), `${name} ${v.label} has a mason_yard fixture with a side`);
    }
  },
});

addTests("settle walls", {
  // Siege collapse (siege/collapse.js) only moves blocks it knows are wall: every wall level, look and timber must count
  "every block a wall can be built from counts as wall for collapse": () => {
    const ids = new Set(Object.values(WALL_LOG));
    for (const look of Object.values(WALL_STONES)) for (const list of Object.values(look.kinds ?? {})) list.forEach((id) => ids.add(id));
    for (const style of STYLE_IDS) {
      ids.add(regionalId("wall_planks", style));
      for (const role of ["beam", "rail", "floor"]) (STYLES[style]?.roles?.[role] ?? []).forEach((id) => ids.add(id));
      for (const kind of STONE_KINDS) ids.add(stoneId(kind, style));
      ids.add(regionalId("castle_gate", style)); ids.add(regionalId("portcullis", style));
    }
    for (const id of ["minecraft:stone_bricks", "minecraft:spruce_log", "minecraft:spruce_fence", "minecraft:spruce_planks", "siege:battlement", "siege:arrow_slit"]) ids.add(id);
    const missing = [...ids].filter((id) => !isStructural(id, true));
    assertEqual(missing.join(", "), "");
  },
});

// ---------- Rival Lords on the same plots (charters.js lordPick) ----------
import { lordPick, oneEachTaken, oneEachMessage } from "./charters.js";
import { ONE_EACH } from "./config.js";
addTests("settle charters", {
  "a lord fills every layout's plots and meets each charter with the designs there are"() {
    const designs = new Set(BUILDINGS.map((b) => b.id));
    for (const name of allTownNames()) for (const v of townByName(name).variants) {
      if (v.charter === false) continue;
      const slots = slotsOfLayout(v);
      const counts = {};
      const taken = new Set(); const dbg = [];
      for (let tier = 0; tier <= 3; tier++) {
        for (let n = 0; n < 80; n++) {
          const open = slots.filter((s) => s.tier <= tier && !taken.has(s.id));
          const pick = lordPick(open, tier, counts, designs, () => true, name, slots.filter((s) => !taken.has(s.id)));
          if (!pick) break;
          taken.add(pick.slot.id);
          counts[pick.id] = (counts[pick.id] ?? 0) + 1; dbg.push(pick.slot.id + ":" + pick.id);
        }
        if (tier < 3) assert(charterCheck(tier, counts, designs).met, `${name} ${v.label}: lord stuck at ${tier} with ${JSON.stringify(counts)} (picks ${dbg.join(" ")})`);
      }
      assert((counts.cottage ?? 0) >= 3, `${name}: a lord's town has homes`);
      for (const id of ONE_EACH) assert((counts[id] ?? 0) <= 1, `${name} ${v.label}: a lord raised ${counts[id]} of the one-of-each ${id}`);
    }
  },
  "one of each special building per settlement (config.js ONE_EACH)"() {
    for (const id of ["library", "mint", "inn", "barracks", "quartermaster_desk", "dragon_roost"]) assert(ONE_EACH.includes(id), `${id} is one per settlement`);
    for (const id of HOMES) assert(!ONE_EACH.includes(id), `${id} stays unlimited`);
    assert(!oneEachTaken("mint", {}) && !oneEachTaken("mint", { mint: 0 }), "the first Mint is allowed");
    assert(oneEachTaken("mint", { mint: 1 }), "a second Mint is refused");
    assert(!oneEachTaken("cottage", { cottage: 9 }), "homes are unlimited");
    assert(/already has a Mint/.test(oneEachMessage("Mint")), "the refusal names the building");
  },
});

// ---------- the Plan Book (plandata.js) ----------
import { knownPlans, planChoices, unknownOf, planKey, parsePlan, planCards, whereFrom } from "./plandata.js";
import { PLANS as PLAN_RULES, HOMES, CHARTERS } from "./config.js";
import { planCardsHash } from "./plancards.js";
import { CARDS_DRAWN_FROM } from "./plancards_data.js";
const TIER_NAMES_T = ["Hamlet", "Town", "City", "Castle"];
addTests("settle plans", {
  "the Hamlet's basics are known, the hall teaches more, Creative knows everything"() {
    const designs = BUILDINGS.map((b) => b.id);
    const start = knownPlans({ hallLevel: 1 });
    for (const id of PLAN_RULES.basics) assert(start.has(id), `${id} is a basic`);
    assert(!start.has("smithy"), "the smithy has to be learned");
    assert(knownPlans({ hallLevel: 3 }).has("smithy"), "a level 3 hall teaches the smithy");
    assert(designs.every((id) => knownPlans({ creative: true, designs }).has(id)), "Creative knows every plan");
  },
  "plans in other regions' styles are offered separately, and only once"() {
    const designs = BUILDINGS.map((b) => b.id);
    const known = knownPlans({ stored: [planKey("smithy", "frostmarch"), planKey("cottage", "vale")], hallLevel: 1 });
    const offers = planChoices(known, "vale", designs);
    assert(offers.some((o) => o.id === "smithy" && o.style === "frostmarch" && o.foreign), "foreign smithy");
    assertEqual(offers.filter((o) => o.id === "cottage").length, 1);
    assert(!offers.some((o) => o.id === "smithy" && !o.foreign), "no home-style smithy without its plan");
    assertEqual(parsePlan("smithy@frostmarch").style, "frostmarch");
    assertEqual(unknownOf(known, [{ id: "cottage", style: "vale" }, { id: "stable", style: "vale" }], "vale").map((p) => p.id).join(), "stable");
  },
  "every home and every building a charter needs is taught by the hall in time, never only by luck"() {
    const by = (lvl) => knownPlans({ hallLevel: lvl });
    // each home is taught by the time it opens (hall level = the tier it opens at + 1), and one home is a basic
    for (const id of HOMES) assert(by(opensAt(id) + 1).has(id), `${id} is a home, so a level ${opensAt(id) + 1} hall must teach it`);
    assert(HOMES.some((id) => by(0).has(id)), "at least one home is a basic plan");
    CHARTERS.forEach((lines, tier) => {
      const known = by(tier + 1); // the hall can reach level tier + 1 at this tier
      const named = new Set(lines.filter((l) => !l.more).flatMap((l) => l.ids));
      for (const line of lines) {
        // "n more of any of these": enough of them, besides the ones the charter names, must be taught
        if (line.more) {
          const spare = line.ids.filter((id) => !named.has(id) && (known.has(id) || PLAN_RULES.noPlan.includes(id)));
          assert(spare.length >= line.more, `the ${TIER_NAMES_T[tier]} charter's "${line.what}" needs ${line.more} more taught by a level ${tier + 1} hall`);
          continue;
        }
        for (const id of line.ids) {
        if (PLAN_RULES.noPlan.includes(id)) continue;
        assert(known.has(id), `the ${TIER_NAMES_T[tier]} charter needs ${id}, so a level ${tier + 1} hall (or the basics) must teach it`);
        }
      }
    });
  },
  "the Plan Book card pictures match the buildings as they are designed now"() {
    assertEqual(planCardsHash(), CARDS_DRAWN_FROM, "a building design changed: run  python3 studio/build_plans.py  to redraw the Plan Book cards");
  },
  "the Plan Book cards: bright when found, greyed with a hint when not"() {
    const designs = BUILDINGS.map((b) => b.id);
    const styles = ["vale", "frostmarch", "saltreach", "emberwaste", "blackfen"];
    const known = knownPlans({ stored: [planKey("smithy", "frostmarch")], hallLevel: 1 });
    const cards = planCards(known, "saltreach", designs, styles);
    assertEqual(cards.length, designs.length);
    const by = Object.fromEntries(cards.map((c) => [c.id, c]));
    assert(by.cottage.home && by.cottage.texture.endsWith("cottage_saltreach"), "a basic shows bright in the town's style");
    assert(!by.smithy.home && by.smithy.known && by.smithy.texture.endsWith("smithy_frostmarch"), "a foreign-only plan shows in its own style");
    assert(!by.stable.known && by.stable.texture.endsWith("stable_saltreach_dim"), "an unfound plan is greyed");
    assertEqual(whereFrom("stable").short, "Hall level 3");
    assert(whereFrom("cottage").short.length <= 14, "card hints are short");
  },
});

import { buildOrder, ATTACHED, blockOf } from "../townhall/halls.js";
import { pickBaseSlot, bedSpot, bedSpots, gateDir, roadEnd, roadLine, gradeLine, joinRoute, gradeRoute, joinSurface, routeSides, ROAD_BLOCKS as JOIN_ROAD_BLOCKS, ROAD_JOIN_PATHY } from "./basedata.js";
import { ROAD_JOINS } from "./roadjoin_data.js";
import { PLOT_PLAN as JOIN_PLOTS, SETTLEMENT as JOIN_SETTLEMENT } from "../plots/config.js";
import { needsRoad } from "./founding.js";
import { REGION_TO_STYLE as REGION_TO_STYLE_T } from "./config.js";
import { MASON_DESIGNS } from "./mason_data.js";


addTests("settle base", {
  "attached blocks go in after every solid block, and door halves go in together"() {
    const plan = drawBuilding("cottage", "vale");
    const order = buildOrder(plan);
    const kinds = order.map((c) => ATTACHED.test(String(blockOf(plan, c))));
    const firstAttached = kinds.indexOf(true);
    assert(firstAttached > 0, "the cottage has a door or a lantern");
    assert(!kinds.slice(firstAttached).includes(false), "no solid block is placed after an attached one");
    for (let i = 0; i < order.length; i++) if (order[i].pair) {
      const a = order[i], b = order[i + 1];
      assert(b && b.x === a.x && b.z === a.z && b.y === a.y + 1, "a door's upper half follows its lower half");
    }
  },
  "every region has a 9 x 9 Mason's Yard with a bench in its front yard"() {
    for (const region of ["vale", "frostmarch", "saltreach", "emberwaste", "blackfen"]) {
      const b = MASON_DESIGNS[region].box;
      assert(b.x1 - b.x0 + 1 === 9 && b.z1 - b.z0 + 1 === 9 && b.z0 === 1, `${region} Mason's Yard is 9 x 9 behind its front row (${JSON.stringify(b)})`);
      assert(drawBuilding("mason_yard", region).bounds().y1 > 4, `${region} Mason's Yard draws its design`);
      assert(MASON_DESIGNS[region]?.marks?.bench, `${region} Mason's Yard marks the bench`);
      assert(!BUILDINGS.some((x) => x.id === "mason_yard"), "the Mason's Yard is never offered on a plot");
    }
  },
  "the founder's cottage has room for a bed indoors"() {
    for (const region of ["vale", "frostmarch", "saltreach", "emberwaste", "blackfen"]) {
      for (const id of ["cottage", "house", "townhouse", "farmhouse"]) {
        const at = bedSpot(drawBuilding(id, region));
        assert(at && at.z >= 2, `${region} ${id} has a bed spot away from the door`);
        const all = bedSpots(drawBuilding(id, region));
        assert(all.length >= 2 && all[0].x === at.x && all[0].z === at.z, `${region} ${id} has a second spot for when the first is taken`);
      }
    }
  },
  "the base buildings take the nearest free Small plot, never the library's"() {
    const slots = [
      { id: "a", size: "S", tier: 0, tags: ["library"], box: { x0: 0, z0: 0, x1: 8, z1: 8 } },
      { id: "b", size: "S", tier: 0, tags: [], box: { x0: 20, z0: 0, x1: 28, z1: 8 } },
      { id: "c", size: "S", tier: 0, tags: [], box: { x0: 40, z0: 0, x1: 48, z1: 8 } },
      { id: "d", size: "S", tier: 1, tags: [], box: { x0: 2, z0: 0, x1: 10, z1: 8 } },
    ];
    assertEqual(pickBaseSlot(slots, new Set(), { x: 0, z: 0 })?.id, "b");
    assertEqual(pickBaseSlot(slots, new Set(["b"]), { x: 0, z: 0 })?.id, "c");
  },
  "the road out to the map's roads: the way out, the end, a joined line, an even grade"() {
    assertEqual(JSON.stringify(gateDir(0)), JSON.stringify({ x: 0, z: -1 }));
    assertEqual(gateDir(90).x, 1);
    assertEqual(roadEnd([{ x: 3, z: 0 }, { x: 30, z: 1 }, { x: 30, z: 9 }], { x: 1, z: 0 }).z, 1);
    const line = roadLine({ x: 0, z: 0 }, { x: 7, z: -4 });
    assertEqual(line.length, 12);
    for (let i = 1; i < line.length; i++) assertEqual(Math.abs(line[i].x - line[i - 1].x) + Math.abs(line[i].z - line[i - 1].z), 1, "each step joins along a side");
    const h = gradeLine(70, 64, 11);
    for (let i = 1; i < h.length; i++) assert(Math.abs(h[i] - h[i - 1]) <= 1, "never more than 1 a block");
    assertEqual(h[0], 70); assertEqual(h[11], 64);
  },
  "the worked-out road out: corner to corner along sides, graded to the ground at most 1 a block, in the map's road blocks"() {
    const join = { from: [0, -49], path: [[0, -49], [0, -72], [-20, -80]] };
    const cells = joinRoute(join, { x: 0, z: -49 });
    assertEqual(JSON.stringify(cells[0]), JSON.stringify({ x: 0, z: -49 }));
    assertEqual(JSON.stringify(cells[cells.length - 1]), JSON.stringify({ x: -20, z: -80 }));
    for (let i = 1; i < cells.length; i++) assertEqual(Math.abs(cells[i].x - cells[i - 1].x) + Math.abs(cells[i].z - cells[i - 1].z), 1, "each step joins along a side");
    const moved = joinRoute(join, { x: 2, z: -47 });
    assertEqual(JSON.stringify(moved[0]), JSON.stringify({ x: 2, z: -47 }), "a gate road ending elsewhere is led to the route first");
    assertEqual(JSON.stringify(routeSides(cells, 5)), JSON.stringify({ x: 1, z: 0 }), "across a road running north is east-west");
    const ground = [70, 70, 75, 76, 74, 66, 65, 65, 64, 64, 64, 64];
    const g = gradeRoute(ground, 70, 64);
    assertEqual(g[0], 70); assertEqual(g[g.length - 1], 64);
    for (let i = 1; i < g.length; i++) assert(Math.abs(g[i] - g[i - 1]) <= 1, "never more than 1 a block");
    for (const region of ["Aldmere Vale", "Frostmarch", "Saltreach", "Emberwaste", "Blackfen", undefined]) for (let x = 0; x < 30; x++) {
      assert(JOIN_ROAD_BLOCKS.test(joinSurface(region, x, x * 7)), `${region} road block ${joinSurface(region, x, x * 7)} is one the joiner knows as road`);
    }
    assert(needsRoad({ laid: [true], roadJoined: "none" }), "a town whose road never joined gets it");
    assert(needsRoad({ laid: [true], roadJoined: { x: 1, z: 2, length: 30 } }), "a road joined the old way (with its gap) is laid again");
    assert(!needsRoad({ laid: [false] }), "not before the Hamlet is laid out");
  },
  "every map plot has a road out from its gate to the map's roads, starting where each layout's gate road ends"() {
    for (const plot of JOIN_PLOTS) {
      const key = plot.name.toLowerCase(), join = ROAD_JOINS[key], tw = townByName(key);
      assert(join, `${plot.name} has a road out`);
      const dir = gateDir(tw.gate);
      for (const v of tw.variants) {
        const tops = new Map();
        for (const [dx, dy, dz, p] of groundwork(v, 0)) { const id = v.pal[p]?.[0] ?? "", k = `${dx},${dz}`; if (id !== "minecraft:air" && (!tops.has(k) || tops.get(k).dy < dy)) tops.set(k, { x: dx, z: dz, dy, id }); }
        const end = roadEnd([...tops.values()].filter((c) => ROAD_JOIN_PATHY.test(c.id)), dir);
        assertEqual(`${end.x},${end.z}`, join.from.join(), `${plot.name} ${v.label}: the route starts at the gate road's end`);
      }
      const cells = joinRoute(join);
      const far = cells[cells.length - 1];
      assert(Math.hypot(far.x, far.z) >= JOIN_SETTLEMENT.landRadius - 4, `${plot.name}: the road reaches past the settlement land (${far.x},${far.z})`);
      assert(join.wet === 0, `${plot.name}: the road keeps out of water`);
      // straight out along the gate line first, so the later tiers' gate road lies on it
      const side = { x: -dir.z, z: dir.x };
      for (const c of cells) if (Math.hypot(c.x, c.z) < JOIN_SETTLEMENT.landRadius - 2) assert(Math.abs(c.x * side.x + c.z * side.z) <= 2, `${plot.name}: inside the settlement land the road keeps to the gate line`);
    }
  },
});

import { layoutOf as townLayoutOf, layoutKey } from "./founding.js";
addTests("settle layouts saved", {
  "a saved town keeps its layout when the layouts are re-exported, and a bad index falls back"() {
    const vs = townByName("dunehold").variants;
    const last = vs.length - 1;
    const moved = { plot: "dunehold", layout: 0, layoutKey: layoutKey(vs[last]) };
    assertEqual(townLayoutOf(moved), vs[last], "found again by its key");
    assertEqual(moved.layout, last, "and its index is put right");
    const past = { plot: "dunehold", layout: 99 };
    assertEqual(townLayoutOf(past), vs[0], "an index past the end falls back to the first layout");
    assertEqual(past.layoutKey, layoutKey(vs[0]), "and remembers it from then on");
    const old = { plot: "dunehold", layout: 1 };
    assertEqual(townLayoutOf(old), vs[1], "a town saved before keys keeps its index");
    assert(new Set(vs.map(layoutKey)).size === vs.length, "every layout of a plot has its own key");
  },
});

import { STOREHOUSE_DESIGNS } from "./storehouse_data.js";
import { STORE, levelFor, levelOf, storeId, chestOrder, fixtureBox, pickStoreSlot, crateSpot } from "./storehouse_rules.js";
import { SETTLERS as SETTLER_CFG } from "./config.js";

addTests("settle storehouse", {
  "every settlement's Storehouse has four levels in every region, each holding more chests than the last": () => {
    for (const region of STYLE_IDS.filter((s) => STOREHOUSE_DESIGNS[s])) {
      let last = 0;
      for (let level = 1; level <= STORE.levels; level++) {
        const d = STOREHOUSE_DESIGNS[region][storeId(level)];
        assert(d, `${region} level ${level}`);
        const n = chestOrder(d).length;
        assertEqual(n, d.chests, `${region} level ${level}: chest count`);
        assert(n > last, `${region} level ${level}: ${n} chests, not more than ${last}`);
        assert(d.marks.goods, `${region} level ${level}: the goods spot`);
        last = n;
      }
    }
    assertEqual(Object.keys(STOREHOUSE_DESIGNS).length, 5);
  },
  "a level follows the town's tier and is raised as a fixed building with a Storekeeper": () => {
    assertEqual([0, 1, 2, 3, 9].map(levelFor).join(), "1,2,3,4,4");
    assertEqual(levelOf("storehouse_3"), 3); assertEqual(levelOf("storehouse"), 0); assertEqual(levelOf(undefined), 0);
    for (let level = 1; level <= STORE.levels; level++) {
      assert(BUILDING[storeId(level)], storeId(level));
      assert(!BUILDINGS.some((b) => b.id === storeId(level)), "never offered on a plot");
      assertEqual(SETTLER_CFG.workers[storeId(level)], "Storekeeper");
    }
    assert(!BUILDINGS.some((b) => b.id === "storehouse") && BUILDING.storehouse, "the old plot Storehouse is retired, not forgotten");
  },
  "every level sits on the village's 15 x 15 ground with its front on the walk, whichever way the door faces": () => {
    for (const [side, out] of Object.entries({ s: { x: 0, z: 1 }, n: { x: 0, z: -1 }, e: { x: 1, z: 0 }, w: { x: -1, z: 0 } })) {
      const f = { x: 30, z: -10 };
      const box = fixtureBox(f, out);
      const slot = { id: "storehouse", size: "L", tier: 0, dy: 0, door: out, box };
      const origins = new Set();
      for (const region of Object.keys(STOREHOUSE_DESIGNS)) {
        for (let level = 1; level <= STORE.levels; level++) {
          const plan = drawBuilding(storeId(level), region);
          const seat = seatOnSlot(slot, plan.bounds());
          assert(seat, `${side} ${region} level ${level} doesn't fit the ground`);
          origins.add(`${seat.origin.dx},${seat.origin.dz}`);
          const sb = seatedBox(seat, plan.bounds());
          assert(sb.x0 >= box.x0 && sb.x1 <= box.x1 && sb.z0 >= box.z0 && sb.z1 <= box.z1, `${side} ${region} level ${level} spills`);
        }
      }
      assertEqual(origins.size, 1, `${side}: every level stands on the same spot, so a rebuild covers the last one`);
    }
  },
  "chests keep their order across a rebuild: the old level's chests are the first of the new one's count": () => {
    const d = STOREHOUSE_DESIGNS.vale.storehouse_2;
    const a = chestOrder(d), b = chestOrder(d);
    assertEqual(JSON.stringify(a), JSON.stringify(b));
    for (let i = 1; i < a.length; i++) assert(a[i - 1][1] < a[i][1] || (a[i - 1][1] === a[i][1] && (a[i - 1][2] < a[i][2] || (a[i - 1][2] === a[i][2] && a[i - 1][0] < a[i][0]))), "sorted");
  },
  "with no Storehouse ground it takes a free long Medium before a Large, never the Barracks' deep Large": () => {
    const s = (id, size, w, d, tier = 0, x = 20) => ({ id, size, tier, box: { x0: x, z0: 0, x1: x + w - 1, z1: d - 1 } });
    const slots = [s("deep", "L", 15, 17), s("big", "L", 15, 15, 0, 10), s("long", "ML", 13, 15, 0, 40), s("later", "ML", 13, 15, 1, 5)];
    assertEqual(pickStoreSlot(slots, new Set(), 0).id, "long");
    assertEqual(pickStoreSlot(slots, new Set(["long"]), 0).id, "big");
    assertEqual(pickStoreSlot(slots, new Set(["long", "big"]), 0), undefined);
    assertEqual(pickStoreSlot(slots, new Set(["long", "big"]), 1).id, "later");
  },
  "a station's Goods Crate goes beside the post, away from the track first": () => {
    const post = { x: 10, y: 64, z: 10 }, forward = { x: 0, z: 1 };
    assertEqual(JSON.stringify(crateSpot(post, forward, () => true)), JSON.stringify({ x: 10, y: 64, z: 11 }));
    assertEqual(JSON.stringify(crateSpot(post, forward, (p) => p.z === 10)), JSON.stringify({ x: 9, y: 64, z: 10 }));
    assertEqual(crateSpot(post, forward, () => false), undefined);
  },
  // Mateo 2026-11-13: the Barracks unlocks with the Hamlet and goes on a plot that fits it (no crafting)
  "every layout's Hamlet has a plot the Barracks seats on"() {
    assertEqual(opensAt("barracks"), 0, "opens with the Hamlet");
    assert(BUILDING.barracks && PLAN_RULES.noPlan.includes("barracks"), "a plot building that needs no plan");
    for (const [name, town] of Object.entries(TOWNS)) {
      for (const [i, v] of town.variants.entries()) {
        const style = REGION_TO_STYLE_T[townFor(name).region] ?? "vale";
        const b = drawBuilding("barracks", style).bounds();
        const ok = slotsOf(v).some((s) => s.tier === 0 && plotFit("barracks", s).ok && seatOnSlot(s, b));
        assert(ok, `${name} layout ${i}: no Hamlet plot fits the Barracks`);
      }
    }
  },
});
