// Town halls in the map kit's style (map/structures/settle_halls.py), raised by the same build engine
// and fly-by as the older hall templates. Pure code, loads in Node too.
//
// The data (designs_data.js) holds each hall as a palette of [block id, logical props] and rows
// run-length coded along x, already in the hall's local frame. Here each palette entry becomes a style
// role ("hd:<arch>:<level>:<n>") on every style of that arch, and each block's facing becomes the
// local-frame options statesFor() understands, so the hall turns to face any way like the old ones.

import { HALL_DESIGNS } from "./designs_data.js";
import { STYLES } from "./styles.js";

// design facing (the design's front faces the player, so its "n" is into the hall) -> local direction
const DIR = { n: "+z", s: "-z", e: "+x", w: "-x" };

export function optionsFor(name, p) {
  const o = {};
  if (p.facing) o.dir = DIR[p.facing];
  if (p.axis) o.axis = p.axis;
  if (p.half) o.half = p.half;
  if (p.hanging) o.hanging = true;
  const st = {};
  if (name.endsWith("_door")) { st.upper_block_bit = !!p.upper; st.door_hinge_bit = !!p.hinge; st.open_bit = !!p.open; }
  if (name.endsWith("trapdoor")) { o.trap = true; st.open_bit = !!p.open; st.upside_down_bit = p.half === "top"; }
  if (name.endsWith("_slab") && p.half) { delete o.dir; }
  if (p.raw) Object.assign(st, p.raw); // add-on block states, passed through as they are (the vault's Regal Safe part)
  if (Object.keys(st).length) o.st = st;
  return Object.keys(o).length ? o : undefined;
}

const registered = new Set();
function register(arch, level) {
  const key = `${arch}:${level}`;
  if (registered.has(key)) return;
  registered.add(key);
  const d = HALL_DESIGNS[arch][level];
  for (const style of Object.values(STYLES)) {
    if (style.arch !== arch) continue;
    d.palette.forEach(([id], i) => { style.roles[`hd:${key}:${i}`] = [id]; });
  }
}

export const hasDesign = (arch, level) => !!HALL_DESIGNS[arch]?.[level];

// Lay a design's blocks into a Plan as roles "<prefix>:<palette index>" (the caller registers those roles
// on the style): cells, foundation columns under stone and wood that reach the ground, and the marks.
export function drawData(p, d, prefix) {
  const opts = d.palette.map(([id, props]) => optionsFor(id, props));
  const lowest = new Map(); // "x,z" -> [y, palette index] of the lowest block, for foundation columns
  for (const [y, z, x0, n, i] of d.rows) {
    const role = `${prefix}:${i}`;
    const air = d.palette[i][0] === "minecraft:air";
    for (let x = x0; x < x0 + n; x++) {
      p.set(x, y, z, air ? "air" : role, opts[i]);
      if (air) continue;
      const k = `${x},${z}`, l = lowest.get(k);
      if (!l || y < l[0]) lowest.set(k, [y, i]);
    }
  }
  // stone and wood that reaches the ground keeps going down to it on uneven land
  for (const [k, [y, i]] of lowest) {
    if (y > 0) continue;
    const [x, z] = k.split(",").map(Number);
    p.columns.set(k, { x, z, top: y - 1, role: `${prefix}:${i}` });
  }
  for (const [name, [x, y, z]] of Object.entries(d.marks)) p.marks[name] = { x, y, z };
}

// Fill a Plan with the designed hall. Returns the box the old builders returned.
export function drawDesign(p, arch, level) {
  register(arch, level);
  const d = HALL_DESIGNS[arch][level];
  drawData(p, d, `hd:${arch}:${level}`);
  // the Tree of Oaths keeps its own role: other code finds it by role at the "tree" mark
  const t = p.marks.tree;
  if (t) p.set(t.x, t.y, t.z, "tree");
  p.marks.door = { x: d.door[0], y: d.door[1], z: d.door[2] };
  return { x0: d.box.x0, x1: d.box.x1, z0: d.box.z0, z1: d.box.z1 };
}
