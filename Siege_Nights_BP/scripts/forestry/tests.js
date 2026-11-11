// Forester's Lodge self-tests (pure, run offline too).

import { addTests, assert, assertEqual } from "../siege/api.js";
import { GROVE, GROVE_PLOTS, GROVE_STAGES, GROVE_VARIANTS, GROVE_DESIGNS } from "./grove_data.js";
import { FORESTRY, YARD, LODGE_LEVELS, MAX_LEVEL, plotsAt, designOf, newPlot, toWorld, fellYield, ticksToNext } from "./data.js";

const STYLES = ["vale", "frostmarch", "saltreach", "emberwaste", "blackfen"];

addTests("forestry", {
  "every settlement style has three grove trees with every stage built": () => {
    for (const style of STYLES) {
      assertEqual(GROVE[style]?.length, 3, `${style} grove species`);
      for (const sid of GROVE[style]) for (const stage of GROVE_STAGES) for (let v = 0; v < GROVE_VARIANTS; v++) {
        const d = designOf(sid, stage, v);
        assert(d, `${sid} ${stage} ${v} is built`);
        assert(d.types.length > 0 && d.lo[1] >= 1, `${sid} ${stage} ${v} sits on the ground, not in it`);
      }
    }
  },
  "grown grove trees have a trunk to chop and give logs": () => {
    for (const [name, d] of Object.entries(GROVE_DESIGNS)) {
      assert(d.wood.some(([x, y, z]) => x === 0 && y === 1 && z === 0), `${name} has its trunk at the bottom centre`);
      if (!name.includes("_mature_")) continue;
      const got = Object.values(fellYield(d, d.wood.length, "mature")).reduce((a, b) => a + b, 0);
      assert(got >= FORESTRY.minLogs && got <= FORESTRY.maxLogs, `${name} gives ${got} logs`);
    }
  },
  "a half-chopped tree gives back only what is left": () => {
    const d = { wood: new Array(20).fill([0, 1, 0]), drops: { "minecraft:oak_log": 20 } };
    assertEqual(fellYield(d, 20, "mature"), { "minecraft:oak_log": 20 }, "whole tree");
    assertEqual(fellYield(d, 10, "mature"), { "minecraft:oak_log": 10 }, "half left");
    assertEqual(fellYield(d, 20, "young"), { "minecraft:oak_log": 10 }, "young tree gives half");
    assertEqual(fellYield(d, 0, "mature"), {}, "nothing left");
  },
  "plots fit inside the yard and levels open more of them": () => {
    assertEqual(GROVE_PLOTS.length, LODGE_LEVELS[MAX_LEVEL].plots, "one spot per plot");
    assert((YARD.x1 - YARD.x0 + 1) % 2 === 1 && (YARD.z1 - YARD.z0 + 1) % 2 === 1, "odd yard");
    for (const [x, z] of GROVE_PLOTS) assert(x - 2 > YARD.x0 && x + 2 < YARD.x1 && z - 2 > YARD.z0 && z + 2 < YARD.z1, `plot ${x},${z} inside the fence`);
    for (let l = 2; l <= MAX_LEVEL; l++) assert(plotsAt(l) > plotsAt(l - 1), `level ${l} opens plots`);
  },
  "the lodge frame turns with the player": () => {
    const o = { x: 100, y: 64, z: 100 };
    assertEqual(toWorld(o, { x: 0, z: 1 }, 0, 0, 5), { x: 100, y: 64, z: 105 }, "facing south, +z ahead");
    assertEqual(toWorld(o, { x: 1, z: 0 }, 0, 0, 5), { x: 105, y: 64, z: 100 }, "facing east");
    assertEqual(toWorld(o, { x: 0, z: 1 }, 3, 0, 0), { x: 97, y: 64, z: 100 }, "right of a player facing south is west");
  },
  "saplings grow in two steps": () => {
    const p = newPlot("vale", 0, "sapling", 1000);
    assertEqual(ticksToNext(p, 1000), FORESTRY.growTicks.sapling, "a fresh sapling waits a day");
    assertEqual(ticksToNext({ ...p, stage: "mature" }, 1000), Infinity, "a grown tree is done");
  },
});
