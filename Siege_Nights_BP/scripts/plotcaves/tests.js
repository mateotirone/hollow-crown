import { addTests, assert, assertEqual } from "../core/tests.js";
import { plotCave, SHAFT_DEPTH } from "../caves/cavegen.js";
import { CAVE, LEVELS, ORE, oreBudget, nightAt, openAir, nightPlan, dressBlock, splitBlock, mouthSpots, mouthPlan, insideBox } from "./data.js";

const unkey = (k) => k.split(",").map(Number);
const N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

addTests("plot caves", {
  "iron is Mateo's 12 a night at Hamlet and grows each tier; gold from City, diamond only at Castle": () => {
    assertEqual(ORE[0].iron, 12);
    for (let t = 1; t < ORE.length; t++) assert(ORE[t].iron > ORE[t - 1].iron, `tier ${t} iron`);
    assert(!ORE[0].gold && !ORE[1].gold && ORE[2].gold, "gold opens at City");
    assert(ORE.slice(0, 3).every((o) => !o.diamond) && ORE[3].diamond, "diamond opens at Castle");
    assertEqual(LEVELS.length, 4);
    for (let t = 1; t < LEVELS.length; t++) assert(LEVELS[t].floor < LEVELS[t - 1].floor, "each tier goes deeper");
  },
  "a region's strength tilts gold and diamond, never iron": () => {
    const rate = (region, metal) => ({ Frostmarch: { diamond: 2.5, iron: 0.25 }, Emberwaste: { gold: 3, diamond: 0.25 } })[region]?.[metal] ?? 1;
    assertEqual(oreBudget(3, "Frostmarch", rate).iron, ORE[3].iron);
    assertEqual(oreBudget(3, "Frostmarch", rate).diamond, Math.round(ORE[3].diamond * 2.5));
    assertEqual(oreBudget(3, "Emberwaste", rate).diamond, 1);
    assertEqual(oreBudget(2, "Emberwaste", rate).gold, ORE[2].gold * 3);
  },
  "a cave's night changes at nightfall, once a day": () => {
    assertEqual(nightAt(CAVE.nightStarts), 0);
    assertEqual(nightAt(CAVE.nightStarts - 1), -1);
    assertEqual(nightAt(CAVE.nightStarts + 23999), 0);
    assertEqual(nightAt(CAVE.nightStarts + 24000), 1);
  },
  "the generator's plants and blocks become real blocks with states": () => {
    assertEqual(splitBlock(dressBlock("minecraft:glow_lichen:up")), ["minecraft:glow_lichen", { multi_face_direction_bits: 2 }]);
    assertEqual(splitBlock(dressBlock("minecraft:pointed_dripstone:tip:h")), ["minecraft:pointed_dripstone", { dripstone_thickness: "tip", hanging: true }]);
    assertEqual(dressBlock("minecraft:moss_carpet"), "minecraft:moss_carpet");
    assertEqual(splitBlock("minecraft:stone"), ["minecraft:stone", undefined]);
  },
  "the tunnel mouth beside the Rift is cut into the wall, with open cave in front and a dark end": () => {
    const spots = mouthSpots({ x: 100, y: 40, z: 100, facing: "south" });
    assert(spots.every((s) => s.z === 100 && Math.abs(s.x - 100) >= 8), "spots run along the wall, clear of the tear");
    const m = mouthPlan(spots[0]);
    assert(m.front.every((c) => c.z === 101), "front is in the cave");
    assert([...m.cut, ...m.trigger, ...m.dark].every((c) => c.z <= 100), "the cut goes into the wall");
    assert(Math.max(...m.dark.map((c) => 100 - c.z)) > Math.max(...m.trigger.map((c) => 100 - c.z)), "dark beyond the trigger");
    assert(!m.trigger.some((c) => Math.floor(m.landing.x) === c.x && m.landing.y === c.y && Math.floor(m.landing.z) === c.z), "landing is not on the trigger");
  },
  "the inside box covers the cave but not the ground above": () => {
    const box = { min: { x: -40, y: -60, z: -40 }, max: { x: 40, y: 8, z: 40 } };
    assert(insideBox(box, { x: 0, y: -20, z: 0 }) && !insideBox(box, { x: 0, y: 5, z: 0 }) && !insideBox(box, { x: 60, y: -20, z: 0 }));
  },
  // slow (it generates a whole cave): offline only
  "a plot cave: each tier opens more, all of it reached from the shaft, ore only on open faces, a door at Castle": () => {
    const cave = plotCave("Oakmere", { region: "vale", groundY: 70 });
    let last = 0;
    for (let t = 0; t < LEVELS.length; t++) {
      const open = openAir(cave, t);
      assert(open.size > last, `tier ${t} opens more`);
      last = open.size;
      const plan = nightPlan(cave, { tierIndex: t, region: "vale", night: 5, plot: "Oakmere" });
      for (const [k, b] of plan.blocks) if (b === "minecraft:air" && !k.startsWith("0,") && cave.air.has(k)) assert(plan.open.has(k), `shut air left open at ${k}`);
      const kinds = {};
      for (const [k, b] of plan.ore) {
        const [x, y, z] = unkey(k);
        assert(N6.some(([a, c, d]) => plan.open.has(`${x + a},${y + c},${z + d}`)) || N6.some(([a, c, d]) => N6.some(([e, f, g]) => plan.open.has(`${x + a + e},${y + c + f},${z + d + g}`))), `ore ${k} is not by the open cave`);
        assert(!(Math.abs(x) <= 2 && Math.abs(z) <= 2 && y > -SHAFT_DEPTH), `ore ${k} in the shaft wall`);
        const kind = b.replace(/minecraft:(deepslate_)?/, "").replace("_ore", "");
        kinds[kind] = (kinds[kind] ?? 0) + 1;
        if (kind === "diamond") assert(y < LEVELS[2].floor, "diamond only in the Castle level");
      }
      assertEqual(kinds.iron, ORE[t].iron, `tier ${t} iron`);
      assertEqual(!!plan.tunnel, t === LEVELS.length - 1, `tier ${t} door`);
    }
    const plan = nightPlan(cave, { tierIndex: 3, night: 5, plot: "Oakmere" }), again = nightPlan(cave, { tierIndex: 3, night: 6, plot: "Oakmere" });
    assert([...plan.ore.keys()].filter((k) => again.ore.has(k)).length < plan.ore.size / 2, "the next night's ore is somewhere else");
  },
});
