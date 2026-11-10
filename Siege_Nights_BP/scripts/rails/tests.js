// Rails self-tests (pure ones run offline too).

import { BlockTypes } from "@minecraft/server";
import { addTests, assert, assertEqual } from "../siege/api.js";
import { heading, distance, nearestStation, networkLines, nextId, expressAxis, RAIL_SETTINGS } from "./data.js";

const S = (id, name, x, z, extra = {}) => ({ id, name, region: "Aldmere Vale", x, y: 64, z, dim: "minecraft:overworld", ...extra });

addTests("rails", {
  "headings follow the Minecraft compass": () => {
    const o = { x: 0, z: 0 };
    assertEqual([heading(o, { x: 0, z: -10 }), heading(o, { x: 10, z: 0 }), heading(o, { x: 0, z: 10 }), heading(o, { x: -10, z: 0 })], ["N", "E", "S", "W"]);
    assertEqual(heading(o, { x: 10, z: -10 }), "NE");
    assertEqual(distance(o, { x: 30, z: 40 }), 50);
  },
  "the nearest station respects range and dimension": () => {
    const list = [S(1, "A", 0, 0), S(2, "B", 100, 0), S(3, "Nether", 5, 0, { dim: "minecraft:nether" })];
    assertEqual(nearestStation(list, { x: 90, y: 64, z: 0 }, "minecraft:overworld").id, 2);
    assertEqual(nearestStation(list, { x: 50, y: 64, z: 0 }, "minecraft:overworld", 12), undefined);
    assertEqual(nextId(list), 4);
  },
  "the network map hides stations you haven't found": () => {
    const lines = networkLines([S(1, "Kingsrest", 0, 0), S(2, "Hollowfast", 0, -400), S(3, "Mateo's Depot", 9, 9, { owner: "p" })], [1, 3], { x: 0, z: 0 });
    assert(lines.some((l) => l.includes("Kingsrest")), "found one is named");
    assert(lines.some((l) => l.includes("???")) && !lines.some((l) => l.includes("Hollowfast")), "unfound one is hidden");
    assert(lines.some((l) => l.includes("Depots")), "depots get their own group");
  },
  "express only pushes on straight, flat track": () => {
    assertEqual(expressAxis({ x: 0.4, y: 0, z: 0 })?.railDirection, 1);
    assertEqual(expressAxis({ x: 0, y: 0, z: -0.4 })?.z, -1);
    assertEqual(expressAxis({ x: 0.3, y: 0, z: 0.3 }), undefined);
    assertEqual(expressAxis({ x: 0.4, y: 0.2, z: 0 }), undefined);
    assertEqual(expressAxis({ x: 0.05, y: 0, z: 0 }), undefined);
    assert(RAIL_SETTINGS.expressSpeed > 0.4, "express is faster than vanilla");
  },
  "the pack has the station blocks": () => {
    for (const id of ["hc:station_post", "siege:rail_depot"]) assert(BlockTypes.get(id), id);
  },
});
