// Build plans for the wonders, one per stage (pure: Node tests it). Used by index.js with the build engine.
//   wonderPlan(id, stage) -> Plan   stage 0 = the whole wonder (for its bounds), 1 to 6 = one stage's rows

import { Plan } from "../townhall/halls.js";
import { drawData } from "../townhall/designs.js";
import { styleFor } from "../settle/buildings.js";
import { WONDER_DESIGNS } from "./designs_data.js";
import { WONDER_BY_ID } from "./data.js";
import { stageRows } from "./rules.js";

const plans = new Map();
const styles = new Map();
function styleOf(w) {
  if (styles.has(w.id)) return styles.get(w.id);
  const base = styleFor(w.style);
  const st = { ...base, name: `wonder:${w.id}`, roles: { ...base.roles } };
  WONDER_DESIGNS[w.id].palette.forEach(([id], i) => { st.roles[`wd:${w.id}:${i}`] = [id]; });
  styles.set(w.id, st);
  return st;
}
// stage 0 = the whole wonder (for its bounds); 1 to 6 = one stage's rows. Foundation columns only with stage 1.
export function wonderPlan(id, stage) {
  const key = `${id}|${stage}`;
  if (plans.has(key)) return plans.get(key);
  const w = WONDER_BY_ID[id], d = WONDER_DESIGNS[id];
  const st = styleOf(w);
  const p = new Plan(st);
  drawData(p, { ...d, rows: stage ? stageRows(d, stage) : d.rows, marks: {} }, `wd:${id}`);
  if (stage > 1) p.columns.clear();
  p.wonderStyle = st;
  plans.set(key, p);
  return p;
}

