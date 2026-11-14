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
  if (p.facing && /(ladder|_wall_sign|^minecraft:(glow_)?frame|_button)$/.test(name)) o.wallHung = true; // facing_direction (halls.js statesFor)
  if (p.facing && /(:bed|_bed|:bell|decorated_pot|grindstone)$/.test(name)) o.legacyDir = true; // direction
  if (p.axis) o.axis = p.axis;
  if (p.half) o.half = p.half;
  if (p.hanging) o.hanging = true;
  const st = {};
  if (/(:bed|_bed)$/.test(name)) st.head_piece_bit = !!p.head; // the two halves of a bed (emit.py)
  if (name.endsWith(":bell")) st.attachment = p.attach ?? "hanging";
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
  holdHung(p, d, prefix, opts);
}

// Nothing hangs on air (house rules, "Nothing floats"; town audit 2026-11-14). The designs were drawn with a few
// lanterns hung under a vaulted roof with open rows above them (the Blackfen, Frostmarch and Saltreach halls at every
// level, stables, smithies), and some ladders facing into their wall (the watchtowers): in game those lanterns hung
// from nothing and dropped as the hall rose ("lanterns falling from high up"), and the ladders popped off. Here every
// hanging lantern gets a chain up to whatever is over it (or is left out when nothing is), and a ladder, wall sign,
// item frame or button with no wall behind it is turned to face away from the wall next to it, or left out.
const SOLID_BEHIND = /(lantern|chain|ladder|_sign|frame|_button|torch|carpet|_pane|iron_bars|fence|trapdoor|_door|_slab|stairs|_wall$|banner|candle|flower|grass|fern|leaves|:air$|vine|rail|bed$)/;
const HUNG_ON_WALL = /(ladder|_wall_sign|:(glow_)?frame|_button)$/;
const FLIP = { "+x": "-x", "-x": "+x", "+z": "-z", "-z": "+z" };
const STEP = { "+x": [1, 0], "-x": [-1, 0], "+z": [0, 1], "-z": [0, -1] };
function holdHung(p, d, prefix, opts) {
  const idOf = (c) => (c && c.role.startsWith(`${prefix}:`) ? d.palette[Number(c.role.slice(prefix.length + 1))]?.[0] ?? "" : c ? "minecraft:other" : "");
  // leaves hold a wall sign (Mateo's window boxes: leaves boxed in by signs), as tools/hung-check.mjs allows
  const holds = (c, sign) => !!c && c.role !== "air" && (!SOLID_BEHIND.test(idOf(c)) || (sign && /leaves/.test(idOf(c))));
  // a design drawn a part at a time (a wonder's stages) passes its whole rows as d.whole, so a lantern or sign hung
  // from a part raised earlier still finds what holds it
  let whole;
  if (d.whole && d.whole !== d.rows) {
    whole = new Map();
    for (const [y, z, x0, n, i] of d.whole) {
      if (d.palette[i][0] === "minecraft:air") continue;
      for (let x = x0; x < x0 + n; x++) whole.set(`${x},${y},${z}`, { x, y, z, role: `${prefix}:${i}` });
    }
  }
  const at = (x, y, z) => p.cells.get(`${x},${y},${z}`) ?? whole?.get(`${x},${y},${z}`);
  let chainRole;
  for (const c of [...p.cells.values()]) {
    const id = idOf(c);
    if (/lantern$/.test(id) && c.o?.hanging) {
      const up = at(c.x, c.y + 1, c.z);
      if (up && up.role !== "air") continue;
      let top = 0;
      for (let dy = 1; dy <= 12; dy++) { const a = at(c.x, c.y + dy, c.z); if (a && a.role !== "air") { top = dy; break; } }
      if (!top) { p.cells.delete(`${c.x},${c.y},${c.z}`); continue; }
      if (!chainRole) {
        chainRole = `${prefix}:chain`;
        p.style.roles[chainRole] = ["minecraft:iron_chain", "minecraft:chain"];
      }
      for (let dy = 1; dy < top; dy++) if ((p.cells.get(`${c.x},${c.y + dy},${c.z}`)?.role ?? "air") === "air") p.cells.set(`${c.x},${c.y + dy},${c.z}`, { x: c.x, y: c.y + dy, z: c.z, role: chainRole, o: { axis: "y" } });
    } else if (HUNG_ON_WALL.test(id) && c.o?.dir && STEP[c.o.dir]) {
      const sign = /_sign$/.test(id);
      const [bx, bz] = STEP[FLIP[c.o.dir]];
      if (holds(at(c.x + bx, c.y, c.z + bz), sign)) continue;
      const dir = Object.keys(STEP).find((k) => { const [sx, sz] = STEP[FLIP[k]]; return holds(at(c.x + sx, c.y, c.z + sz), sign); });
      if (dir) c.o = { ...c.o, dir };
      else p.cells.delete(`${c.x},${c.y},${c.z}`); // nothing to hang on at all (a window box whose leaves were cleared)
    }
  }
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
