// The Trade Outpost wing: the station's Trade House design (settle/station_data.js, from map/structures/stations.py),
// raised on the station's trade_join mark, with marks for the Trade Board and the two crates. Pure, so it loads in Node.

import { Plan } from "../townhall/halls.js";
import { drawData } from "../townhall/designs.js";
import { styleFor } from "../settle/buildings.js";
import { TRADE_HOUSE_DESIGNS } from "../settle/station_data.js";
import { WING_SPOTS } from "./data.js";

const plans = new Map();
const regionOf = (style) => (TRADE_HOUSE_DESIGNS[style] ? style : "vale");

export function wingPlan(style, stage) {
  const region = regionOf(style);
  if (!TRADE_HOUSE_DESIGNS[region][stage]) stage = "halt";
  const key = `${region}|${stage}`;
  if (plans.has(key)) return plans.get(key);
  const st = styleFor(region);
  const d = TRADE_HOUSE_DESIGNS[region][stage];
  const prefix = `th:${region}:${stage}`;
  d.palette.forEach(([id], i) => { st.roles[`${prefix}:${i}`] = [id]; });
  const p = new Plan(st);
  drawData(p, d, prefix);
  for (const [name, at] of Object.entries(WING_SPOTS)) {
    const m = at(d.box);
    p.set(m.x, m.y, m.z, "air"); // kept clear: the board and crates go in after the build
    p.mark(name, m.x, m.y, m.z);
  }
  p.design = d;
  plans.set(key, p);
  return p;
}

// Where the wing's own origin (its local (0, 1, 0)) goes, given the station's trade_join mark in the world
export const wingOrigin = (joinMark) => ({ x: joinMark.x, y: joinMark.y + 1, z: joinMark.z });
