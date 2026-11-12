// The Trade Outpost wing: the goods hall built with the minecraft-builder skill (outpost_data.js, from
// map/structures/trade_outpost.py), in the region's style and the station's stage, raised on the station's trade_join
// mark, with marks for the Trade Board and the two crates. Pure, so it loads in Node.

import { Plan } from "../townhall/halls.js";
import { drawData } from "../townhall/designs.js";
import { styleFor } from "../settle/buildings.js";
import { TRADE_OUTPOST_DESIGNS } from "./outpost_data.js";

const plans = new Map();
const regionOf = (style) => (TRADE_OUTPOST_DESIGNS[style] ? style : "vale");
// the design's marks -> the names the Outpost uses
const SPOTS = { board: "board", exports: "export", imports: "import" };

export function wingPlan(style, stage) {
  const region = regionOf(style);
  if (!TRADE_OUTPOST_DESIGNS[region][stage]) stage = "halt";
  const key = `${region}|${stage}`;
  if (plans.has(key)) return plans.get(key);
  const st = styleFor(region);
  const d = TRADE_OUTPOST_DESIGNS[region][stage];
  const prefix = `to:${region}:${stage}`;
  d.palette.forEach(([id], i) => { st.roles[`${prefix}:${i}`] = [id]; });
  const p = new Plan(st);
  drawData(p, d, prefix);
  for (const [name, key] of Object.entries(SPOTS)) {
    const [x, y, z] = d.marks[key];
    p.set(x, y, z, "air"); // kept clear: the board and crates go in after the build
    p.mark(name, x, y, z);
  }
  p.design = d;
  plans.set(key, p);
  return p;
}

// Where the wing's own origin (its local (0, 1, 0)) goes, given the station's trade_join mark in the world
export const wingOrigin = (joinMark) => ({ x: joinMark.x, y: joinMark.y + 1, z: joinMark.z });
