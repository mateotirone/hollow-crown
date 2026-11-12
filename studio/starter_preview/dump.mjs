// The starter village, block for block, for the 3D preview: the layout and graded ground from
// map/structures/starter.py, and on top of it the hall, the buildings and the wall drawn by the
// add-on's own code (townhall/halls.js, settle/buildings.js, settle/walldata.js).
//   node dump.mjs starter.json out.json
// Coordinates stay relative to the Plot Stone (x east, z south), y is world height.
import fs from "node:fs";
const S = new URL("../../Siege_Nights_BP/scripts/", import.meta.url).href;
const { drawHall, frameFor, toWorld, statesFor } = await import(S + "townhall/halls.js");
const { STYLES } = await import(S + "townhall/styles.js");
const { drawBuilding, styleFor } = await import(S + "settle/buildings.js");
const { WALLS, WALL_LEVELS, WALL_LOG, wallColumns, columnKinds } = await import(S + "settle/walldata.js");
const { REGION_TO_STYLE } = await import(S + "settle/config.js");

const [src, dst = "starter_view.json"] = process.argv.slice(2);
const P = JSON.parse(fs.readFileSync(src, "utf8"));
const styleId = REGION_TO_STYLE[P.region] ?? "vale";
const short = (id) => id.replace("minecraft:", "");
const grid = new Map(); // "x,y,z" -> [name, props]
const K = (x, y, z) => `${x},${y},${z}`;
const set = (x, y, z, name, props = {}) => { if (name === "air") grid.delete(K(x, y, z)); else grid.set(K(x, y, z), [short(name), props]); };

// 1. terrain: each column's top block and enough below it to close the steps between columns
const top = new Map();
for (const [dx, dz, t] of P.columns) top.set(`${dx},${dz}`, t);
const SURF = P.region === "Emberwaste" ? "sand" : "grass_block";
for (const [dx, dz, t, old, water] of P.columns) {
  let low = t;
  for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) low = Math.min(low, top.get(`${dx + ax},${dz + az}`) ?? t - 3);
  for (let y = Math.min(low - 1, t - 2); y <= t; y++) set(dx, y, dz, y === t ? SURF : y > t - 4 ? "dirt" : "stone");
  if (water > t) for (let y = t + 1; y <= water; y++) set(dx, y, dz, "water");
}
// 2. the starter village's own blocks (paths, levelled ground, yards, fences, lamps...)
for (const [x, y, z, n, p] of P.blocks) set(x, y, z, n, p);

// 3. buildings, from the game's designs
function props(st) {
  const p = {};
  if (!st) return p;
  if (st["minecraft:cardinal_direction"]) p.facing = String(st["minecraft:cardinal_direction"])[0]; // n/s/e/w, as the mesher wants
  if (st.weirdo_direction !== undefined) p.weirdo = st.weirdo_direction;
  if (st.upside_down_bit) p.half = "top";
  if (st.pillar_axis) p.axis = st.pillar_axis;
  if (st["minecraft:vertical_half"]) p.half = st["minecraft:vertical_half"];
  if (st.hanging) p.hanging = true;
  return p;
}
function stamp(plan, style, origin, forward) {
  const frame = frameFor({ x: forward[0], z: forward[1] });
  const block = (role) => short((style.roles[role] ?? ["minecraft:air"])[0]);
  for (const c of plan.cells.values()) {
    const w = toWorld(frame, origin, c.x, c.y, c.z);
    if (c.role === "air") { set(w.x, w.y, w.z, "air"); continue; }
    const b = block(c.role); if (b === "air") continue;
    const sts = statesFor(frame, c.role, c.o) ?? [];
    set(w.x, w.y, w.z, b, props(sts[1] ?? sts[0]));
  }
  for (const c of plan.columns.values()) {
    const w0 = toWorld(frame, origin, c.x, 0, c.z);
    // foundation: down to whatever ground is there
    for (let y = -1; y > -12; y--) { const w = toWorld(frame, origin, c.x, y, c.z); if (grid.has(K(w.x, w.y, w.z)) && !/slab|grass$|flower|poppy|dandelion/.test(grid.get(K(w.x, w.y, w.z))[0])) break; set(w.x, w.y, w.z, block(c.role)); }
    for (let y = 0; y <= c.top; y++) { const w = toWorld(frame, origin, c.x, y, c.z); set(w.x, w.y, w.z, block(c.role)); }
    void w0;
  }
}
const st = styleFor(styleId);
function labelFor(label, plan, at, forward) {
  const b = plan.bounds(), w = toWorld(frameFor({ x: forward[0], z: forward[1] }), { x: at[0], y: at[1], z: at[2] }, Math.round((b.x0 + b.x1) / 2), 0, Math.round((b.z0 + b.z1) / 2));
  return { label, at: [w.x, at[1], w.z], h: b.y1 + 2 };
}
const placed = [];
const corner = P.fixtures.find((f) => f.kind === "hall_cornerstone");
const hallPlan = drawHall(1, STYLES[styleId]);
stamp(hallPlan, STYLES[styleId], { x: corner.at[0], y: corner.at[1], z: corner.at[2] }, P.frame.ahead);
placed.push(labelFor("Longhouse (hall level 1)", hallPlan, corner.at, P.frame.ahead));
for (const b of P.buildings) {
  const plan = drawBuilding(b.design, styleId);
  stamp(plan, st, { x: b.origin[0], y: b.origin[1], z: b.origin[2] }, b.forward);
  placed.push(labelFor(b.label, plan, b.origin, b.forward));
}

// 4. the wall, level 1, standing on the graded ground column by column
const center = { x: 0, y: P.center.y, z: 0, radii: P.wall.radii, radiiAt: P.wall.radiiAt ?? 36 };
const smooth = new Array(WALLS.stations).fill(P.center.y);
const kinds = {
  log: short(WALL_LOG[styleId] ?? WALL_LOG.vale), // log walls are always the stripped log, as walls.js builds them
  fence: short((st.roles.rail ?? ["minecraft:spruce_fence"])[0]),
  plank: short((st.roles.floor ?? ["minecraft:spruce_planks"])[0]), stone: "stone_bricks", tiles: "chiseled_stone_bricks", bricks: "polished_andesite", cobbled: "cobblestone", smooth: "smooth_stone",
  tooth: "stone_brick_wall", light: "lantern", gate: "spruce_fence_gate", port: "iron_bars", slit: "stone_bricks",
};
const level = Number(process.env.WALL_LEVEL ?? 1);
const L = WALL_LEVELS[level];
let wallBlocks = 0;
for (const col of wallColumns({ center, radius: P.wall.radiiAt ?? 36, level, gateAngle: P.wall.gateAngle, smooth })) {
  const g = top.get(`${col.x},${col.z}`);
  if (g === undefined) continue;
  const lift = g - col.base;
  const c2 = { ...col, base: g, top: col.top + lift };
  for (const [y, kind] of columnKinds(L, c2, 0, styleId)) { set(col.x, y, col.z, kinds[kind] ?? kind, kind === "log" ? { axis: "y" } : {}); wallBlocks++; }
}

// 5. out: a palette and the voxels, only those that can be seen (something open beside them)
const OPEN = /^(water|.*_slab|.*_stairs|.*fence.*|.*leaves|lantern|short_grass|poppy|dandelion|cornflower|oxeye_daisy|azure_bluet|wheat|carrots|potatoes|beetroot|.*glass.*|.*door.*|.*trapdoor.*|.*wall$|iron_bars|.*sign.*|torch|.*banner.*|chain|.*button|ladder|flower_pot|.*carpet)$/;
const solid = (k) => { const v = grid.get(k); return v && !OPEN.test(v[0]); };
const pal = [], palIx = new Map(), vox = [];
for (const [k, [n, p]] of grid) {
  const [x, y, z] = k.split(",").map(Number);
  if (solid(k) && solid(K(x + 1, y, z)) && solid(K(x - 1, y, z)) && solid(K(x, y + 1, z)) && solid(K(x, y, z + 1)) && solid(K(x, y, z - 1)) && solid(K(x, y - 1, z))) continue;
  const key = n + (p.half ? ":" + p.half : "") + (p.facing !== undefined ? ":f" + p.facing : "") + (p.axis ? ":a" + p.axis : "");
  if (!palIx.has(key)) { palIx.set(key, pal.length); pal.push([n, p]); }
  vox.push(x, y, z, palIx.get(key));
}
const out = { plot: P.plot, region: P.region, style: styleId, center: P.center, gate: P.gate, frame: P.frame, areas: P.areas, wall: { ...P.wall, level, name: L.name }, placed, pal, vox };
fs.writeFileSync(dst, JSON.stringify(out));
console.log(`${P.plot}: ${vox.length / 4} visible blocks, ${pal.length} kinds, wall ${wallBlocks} blocks (${L.name})`);
