// The settlement windmill's plan and site for the build engine (settle/windmill.js raises it). Pure code (no Minecraft
// imports), so it loads in Node tests. Designs: windmill_data.js (map/structures/export_buildings.py windmill); sites:
// the layouts' "windmill" fixtures (map/structures/windmill_sites.py, through tools/export_towns.py).

import { Plan } from "../townhall/halls.js";
import { drawData } from "../townhall/designs.js";
import { styleFor, spellings } from "./buildings.js";
import { WINDMILL_DESIGNS } from "./windmill_data.js";
import { fixturesOf } from "./towns.js";

export const DIRS = { s: { x: 0, z: 1 }, n: { x: 0, z: -1 }, e: { x: 1, z: 0 }, w: { x: -1, z: 0 } };
export const SAILS = ["back", "left", "right"];

export const windmillRegion = (style) => (WINDMILL_DESIGNS[style] ? style : "vale");
export const windmillDesign = (style, sails = "back") => WINDMILL_DESIGNS[windmillRegion(style)][SAILS.includes(sails) ? sails : "back"];

// The layout's windmill fixture (one per layout), or undefined
export function windmillFixture(layout) {
  for (let t = 0; t < 4; t++) {
    const f = fixturesOf(layout, t).find((x) => x.kind === "windmill");
    if (f) return f;
  }
  return undefined;
}

const plans = new Map();
// The plan: the design, air over its floor
// and the walk out to the path: `walk` = [[k, dy]], k blocks out from the step, dy its height over the floor
export function windmillPlan(style, sails = "back", walk = []) {
  const region = windmillRegion(style);
  const key = `${region}|${sails}|${JSON.stringify(walk)}`;
  if (plans.has(key)) return plans.get(key);
  const st = styleFor(region);
  const d = windmillDesign(region, sails);
  const prefix = `wm:${region}:${sails}`;
  d.palette.forEach(([id], i) => { st.roles[`${prefix}:${i}`] = spellings(id); });
  const p = new Plan(st);
  drawData(p, d, prefix);
  // air over the floor inside the tower, so crops, grass or a bump of ground under it never stay standing in it
  for (const [y, z, x0, n] of d.rows) {
    if (y !== 0) continue;
    for (let x = x0; x < x0 + n; x++) for (let yy = 1; yy <= 3; yy++) if (!p.get(x, yy, z)) p.set(x, yy, z, "air");
  }
  // the walk: paved 3 wide at its own height (the ground it replaces is under it), cleared 3 high
  for (const [k, dy] of walk) {
    for (let x = -1; x <= 1; x++) {
      const z = -k;
      if (!p.get(x, dy, z)) p.set(x, dy, z, "path");
      for (let y = dy + 1; y <= dy + 3; y++) if (!p.get(x, y, z)) p.set(x, y, z, "air");
    }
  }
  p.region = region;
  p.design = d;
  plans.set(key, p);
  return p;
}

// Where the mill stands in the world: origin = the door step (feet height), forward = from the step into the mill
export function windmillSpot(town, f) {
  const out = DIRS[f.side] ?? DIRS.s;
  const origin = { x: town.x + f.x, y: town.y + (f.dy ?? 0) + 1, z: town.z + f.z };
  const walk = (f.walk ?? []).map(([, , dy], k) => [k, (dy ?? f.dy ?? 0) - (f.dy ?? 0)]);
  return { origin, forward: { x: -out.x, z: -out.z }, walk };
}

