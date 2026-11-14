// The wall watchtowers' plan for the build engine (Mateo, 2026-11-13: "small watchtowers for the guards at the wall in
// the first wall level"). Pure code (no Minecraft imports), so it loads in Node tests.
//
// Where they stand is walldata.js (WATCH, watchSpots); settle/walls.js raises them when a wall level that has them is
// built and takes them down when the Watch Wall's stone towers take their place or the wall moves out. The design is
// the building skill's (settle/wallwatch_data.js from map/structures/wallwatch_skill.py): its door's front step is the
// origin (local 0, 1, 0) and +z runs into the tower, out over the wall.

import { Plan, toWorld, frameFor } from "../townhall/halls.js";
import { drawData } from "../townhall/designs.js";
import { styleFor, spellings } from "./buildings.js";
import { WALLWATCH_DESIGNS } from "./wallwatch_data.js";
import { WATCH } from "./walldata.js";

export const watchRegion = (style) => (WALLWATCH_DESIGNS[style] ? style : "vale");

// The shaft in the design's frame: x -half..half, z 1..2*half+1 (the door in the wall at z 1)
export const SHAFT = { x0: -WATCH.half, x1: WATCH.half, z0: 1, z1: 2 * WATCH.half + 1, top: WATCH.guardUp - 2 };

const plans = new Map();
// The plan for one region's watchtower: the design, plus air through the inside of the shaft and the way in, so a
// palisade the tower now stands in, grass, or a bump of ground never stays inside it (the design's own cells win).
export function watchPlan(style) {
  const region = watchRegion(style);
  if (plans.has(region)) return plans.get(region);
  const st = styleFor(region);
  const d = WALLWATCH_DESIGNS[region];
  const prefix = `ww:${region}`;
  d.palette.forEach(([id], i) => { st.roles[`${prefix}:${i}`] = spellings(id); });
  const p = new Plan(st);
  drawData(p, d, prefix);
  for (let x = SHAFT.x0; x <= SHAFT.x1; x++) {
    for (let z = SHAFT.z0; z <= SHAFT.z1; z++) {
      for (let y = 1; y <= SHAFT.top; y++) if (!p.get(x, y, z)) p.set(x, y, z, "air");
    }
  }
  for (let x = -1; x <= 1; x++) for (let z = 1 - WATCH.clear; z <= 0; z++) for (let y = 1; y <= 3; y++) if (!p.get(x, y, z)) p.set(x, y, z, "air");
  p.region = region;
  p.design = d;
  plans.set(region, p);
  return p;
}

// Every block a standing watchtower takes up, in the world, for taking it down: [{ x, y, z, below }] where below = the
// block is at or under the tower's floor (filled with earth, not left as a hole). Air cells are left out.
export function watchCells(style, origin, forward) {
  const p = watchPlan(style), frame = frameFor(forward);
  const out = [];
  for (const c of p.cells.values()) {
    if (c.role === "air") continue;
    out.push({ ...toWorld(frame, origin, c.x, c.y, c.z), below: c.y <= 0 });
  }
  return out.sort((a, b) => b.y - a.y); // top down, so nothing is left hanging while it comes down
}
