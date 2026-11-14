// The old mine dug into every plot cave (Mateo 2026-11-14: "Let's retexture the mine and redo the 3D build of the
// mine too. Right now, it's boring."). The cave itself is the shared generator's (caves/cavegen.js); this is what the
// old miners left in it, written back every night with the rest of the cave (data.js nightPlanJob):
//   - the shaft: a ladder on the wall facing the Plot Stone, timber rings every 4, a lantern in a niche every 8, and
//     the rope from the headframe's sheave hanging down the middle with a lantern on its end
//   - the pit bottom: a timbered 7 x 7 station under the shaft, plank floor, beams, lanterns
//   - the miners' rest: a 7 x 5 room dug off the station, bunks, a stove, barrels, a table and the last shift's note
//   - the haulage way: a dug road from the station to the far end of the open level, 3 wide and 3 high, rails on a
//     gravel bed, a timber set every 4 blocks and a lantern every 8; it is filled under where it crosses low ground and
//     carried on trestles over deep hollows. It ends where the tier's open level ends (at the old fall), and at
//     Castle it runs to the sealed door
// The surface (collar, headframe, winding house) is the building skill's pithead (map/structures/pithead/spec.py).
// Pure functions only: they run in Node, the self-tests and the 3D preview.

import { SHAFT_DEPTH } from "../caves/cavegen.js";

// Each region's mine timber: the same wood as its pithead (map/structures/machine_regions.py THEMES)
export const WOOD = { vale: "spruce", frostmarch: "spruce", saltreach: "birch", emberwaste: "acacia", blackfen: "mangrove" };
export const MINE_LOG = { vale: "minecraft:stripped_spruce_log", frostmarch: "minecraft:dark_oak_log", saltreach: "minecraft:stripped_birch_log",
  emberwaste: "minecraft:stripped_acacia_log", blackfen: "minecraft:mangrove_log" };
export const STATION = { floor: -SHAFT_DEPTH - 3, half: 3, height: 4 }; // walking level y -30, rows -30..-27, ceiling -26
export const REST = { wide: 7, deep: 5 };
export const SET_EVERY = 4; // a timber set every 4 blocks of the haulage way, a lantern on every second one
export const NOTE = "The ore comes back\nevery night.\nNobody knows why.\n- the last shift";

const key = (x, y, z) => `${x},${y},${z}`;
const unkey = (k) => k.split(",").map(Number);
const S = (id, st) => (st ? `${id}${JSON.stringify(st)}` : id);
const BARREL = S("minecraft:barrel", { facing_direction: 1 });
const N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const CARD = { "1,0": "east", "-1,0": "west", "0,1": "south", "0,-1": "north" };
const FACING = { north: 2, south: 3, west: 4, east: 5 };
const hash = (a, b, c) => { let h = Math.imul(a ^ 0x9e3779b9, 73856093) ^ Math.imul(b, 19349663) ^ Math.imul(c, 83492791); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const facing = (dx, dz) => FACING[CARD[`${dx},${dz}`]];
const log = (region, axis = "y") => S(MINE_LOG[region] ?? MINE_LOG.vale, { pillar_axis: axis });
const axisOf = (dx, dz) => (dx ? "x" : "z");
const planks = (region) => `minecraft:${WOOD[region] ?? "spruce"}_planks`;

// rail_direction: 0 north-south, 1 east-west, 2..5 ascending east, west, north, south, 6..9 curves SE, SW, NW, NE
const ASCEND = { "1,0": 2, "-1,0": 3, "0,-1": 4, "0,1": 5 };
const CURVE = { "0,1|1,0": 6, "0,1|-1,0": 7, "0,-1|-1,0": 8, "0,-1|1,0": 9 };
function railState(a, b, p, prev, next) {
  // a, b: unit steps to the previous and next cell (either may be null); p, prev, next: heights
  const dirs = [a, b].filter(Boolean);
  if (next !== undefined && b && next === p + 1) return ASCEND[`${b[0]},${b[1]}`];
  if (prev !== undefined && a && prev === p + 1) return ASCEND[`${a[0]},${a[1]}`];
  if (dirs.length === 2 && (dirs[0][0] !== -dirs[1][0] || dirs[0][1] !== -dirs[1][1])) {
    const zs = dirs.find((d) => d[1] !== 0), xs = dirs.find((d) => d[0] !== 0);
    if (zs && xs) return CURVE[`${zs[0]},${zs[1]}|${xs[0]},${xs[1]}`];
  }
  return dirs[0][0] !== 0 ? 1 : 0;
}

// ---------------------------------------------------------------- the haulage way's route
/** Shortest walk through the open cave from the shaft foot, to the target: the sealed door's spot at Castle, else
 *  the floor block furthest from the shaft. Returns the cells, foot first. */
export function routeTo(cave, open, castle) {
  const start = key(0, -SHAFT_DEPTH, 0);
  if (!open.has(start)) return [];
  const from = new Map([[start, null]]), dist = new Map([[start, 0]]);
  let todo = [start];
  while (todo.length) {
    const next = [];
    for (const k of todo) {
      const [x, y, z] = unkey(k);
      for (const [dx, dy, dz] of N6) {
        const n = key(x + dx, y + dy, z + dz);
        if (!open.has(n) || from.has(n)) continue;
        from.set(n, k); dist.set(n, dist.get(k) + 1); next.push(n);
      }
    }
    todo = next;
  }
  const floor = (k) => { const [x, y, z] = unkey(k); return !open.has(key(x, y - 1, z)) && open.has(key(x, y + 1, z)); };
  let target = null;
  const deep = cave.marks.deep;
  if (castle && deep && from.has(key(deep.x, deep.y, deep.z))) target = key(deep.x, deep.y, deep.z);
  if (!target) {
    let far = -1;
    for (const [k, d] of dist) if (d > far && floor(k)) { far = d; target = k; }
  }
  const out = [];
  for (let k = target; k; k = from.get(k)) out.push(unkey(k));
  return out.reverse();
}

/** The dug road: straight runs and square turns through waypoints taken off the route, every cell { x, z, y, d }
 *  where y is the walking level and d the step to the next cell. The heights follow the cave floor, but climb at
 *  most one block a step and stay level through every turn (so the rails can curve). */
export function haulage(cave, open, { castle = false, front = [0, -1] } = {}) {
  const route = routeTo(cave, open, castle);
  if (route.length < 8) return [];
  const floorY = ([x, y, z]) => { let f = y; while (open.has(key(x, f - 1, z)) && f > y - 12) f--; return f; };
  const H = STATION.half, SF = STATION.floor;
  // waypoints: every 9th cell of the route once clear of the station, and the end
  const pts = route.filter(([x, , z]) => Math.max(Math.abs(x), Math.abs(z)) > H + 2);
  if (!pts.length) return [];
  const way = [];
  for (let i = 8; i < pts.length; i += 9) way.push(pts[i]);
  if (!way.length || way[way.length - 1] !== pts[pts.length - 1]) way.push(pts[pts.length - 1]);
  const first = way[0];
  // the station side the road leaves by: the one facing the first waypoint, never the ladder's side
  let side = null, best = -Infinity;
  for (const [sx, sz] of SIDES) {
    if (sx === front[0] && sz === front[1]) continue;
    const dot = sx * first[0] + sz * first[2];
    if (dot > best) { best = dot; side = [sx, sz]; }
  }
  // cells: from the station's middle out through its side, then square runs to each waypoint
  const cells = [], at = new Map(), target = new Map(); // target: index -> wanted walking level
  const push = (x, z) => {
    const k = `${x},${z}`;
    if (at.has(k)) { // the road would cross itself: cut the loop out
      const i = at.get(k);
      for (const c of cells.splice(i + 1)) at.delete(`${c.x},${c.z}`);
      for (const j of [...target.keys()]) if (j > i) target.delete(j);
      return;
    }
    at.set(k, cells.length); cells.push({ x, z });
  };
  for (let k = 0; k <= H + 1; k++) push(side[0] * k, side[1] * k);
  target.set(0, SF); target.set(cells.length - 1, SF);
  let cx = side[0] * (H + 1), cz = side[1] * (H + 1);
  for (const w of way) {
    const [wx, , wz] = w;
    const alongFirst = side[0] ? Math.abs(wx - cx) >= Math.abs(wz - cz) : Math.abs(wz - cz) < Math.abs(wx - cx);
    const legs = alongFirst ? [["x", wx], ["z", wz]] : [["z", wz], ["x", wx]];
    for (const [ax, to] of legs) {
      while ((ax === "x" ? cx : cz) !== to) {
        if (ax === "x") cx += Math.sign(to - cx); else cz += Math.sign(to - cz);
        push(cx, cz);
      }
    }
    target.set(cells.length - 1, floorY(w));
  }
  // heights: interpolate between the waypoints, then climb at most one a step and hold level through the turns
  const idx = [...target.keys()].sort((a, b) => a - b);
  const want = cells.map((_, i) => {
    let a = idx[0], b = idx[idx.length - 1];
    for (const j of idx) { if (j <= i) a = j; if (j >= i) { b = j; break; } }
    return b === a ? target.get(a) : Math.round(target.get(a) + ((target.get(b) - target.get(a)) * (i - a)) / (b - a));
  });
  for (let i = 0; i < cells.length; i++) {
    const n = cells[i + 1] ?? null, p = cells[i - 1] ?? null;
    cells[i].d = n ? [n.x - cells[i].x, n.z - cells[i].z] : p ? [cells[i].x - p.x, cells[i].z - p.z] : side;
  }
  const turn = (i) => i > 0 && i < cells.length - 1 && (cells[i - 1].d[0] !== cells[i].d[0] || cells[i - 1].d[1] !== cells[i].d[1]);
  const level = (i) => turn(i) || turn(i - 1) || turn(i + 1) || Math.max(Math.abs(cells[i].x), Math.abs(cells[i].z)) <= H + 2;
  cells[0].y = SF;
  for (let i = 1; i < cells.length; i++) {
    const py = cells[i - 1].y;
    cells[i].y = level(i) ? py : Math.max(py - 1, Math.min(py + 1, want[i]));
  }
  // and back from the far end, so the road arrives at the end's own floor (the sealed door's sill at Castle)
  const last = cells.length - 1, near = (i) => Math.max(Math.abs(cells[i].x), Math.abs(cells[i].z)) <= H + 2;
  cells[last].y = want[last];
  for (let i = last - 1; i >= 0 && !near(i); i--) {
    const ny = cells[i + 1].y;
    cells[i].y = level(i + 1) ? ny : Math.max(ny - 1, Math.min(ny + 1, cells[i].y));
  }
  return cells;
}

// ---------------------------------------------------------------- everything the old miners left
/**
 * The mine's blocks over the cave: { blocks: Map(key -> block), carve: Set (cells dug to air, open from now on),
 * way: the haulage way's cells, signs: [{ x, y, z, text }], rest: { side } }. Later entries in blocks win; the
 * caller writes them over the cave's rock, air and ore.
 */
export function mineLayout(cave, open, { region = "vale", front = [0, -1], tierIndex = 0, castleTier = 3 } = {}) {
  const blocks = new Map(), carve = new Set(), signs = [];
  const air = (k) => open.has(k) || carve.has(k);
  const set = (x, y, z, b) => blocks.set(key(x, y, z), b);
  const dig = (x, y, z) => { const k = key(x, y, z); carve.add(k); blocks.set(k, "minecraft:air"); };
  const H = STATION.half, SF = STATION.floor, CEIL = SF + STATION.height;
  const P = planks(region), wood = WOOD[region] ?? "spruce";
  const way = haulage(cave, open, { castle: tierIndex >= castleTier, front });
  const inStation = (x, z, m = 0) => Math.abs(x) <= H + m && Math.abs(z) <= H + m;

  // the haulage way: dig 3 wide and 3 high, a gravel bed under the rails, fill or trestles where it crosses low ground
  const bed = (x, y, z) => { const h = hash(x, y, z); return h < 0.55 ? "minecraft:gravel" : h < 0.8 ? "minecraft:tuff" : "minecraft:cobblestone"; };
  const fill = (x, y, z) => { const h = hash(x, y * 3, z); return h < 0.5 ? "minecraft:cobblestone" : h < 0.8 ? "minecraft:tuff" : "minecraft:stone"; };
  const wayCells = new Set();
  way.forEach((c, i) => {
    const perps = [[-c.d[1], c.d[0]]];
    if (i > 0) { const p = way[i - 1].d; if (p[0] !== c.d[0] || p[1] !== c.d[1]) perps.push([-p[1], p[0]]); }
    for (const [ux, uz] of perps) for (let w = -1; w <= 1; w++) {
      const x = c.x + ux * w, z = c.z + uz * w;
      wayCells.add(`${x},${z}`);
      for (let h = 0; h < 3; h++) dig(x, c.y + h, z);
      // the bed: what is under it stays (rock or fill); open ground under it is filled, deep hollows get a deck on trestles
      let depth = 0;
      while (depth < 24 && air(key(x, c.y - 2 - depth, z)) && !carve.has(key(x, c.y - 2 - depth, z))) depth++;
      const over = air(key(x, c.y - 1, z));
      if (over && depth > 6) {
        set(x, c.y - 1, z, P);
        if (w !== 0 && i % 3 === 0) for (let d = 0; d <= depth; d++) set(x, c.y - 2 - d, z, log(region));
      } else {
        set(x, c.y - 1, z, bed(x, c.y - 1, z));
        if (over) for (let d = 0; d < depth; d++) set(x, c.y - 2 - d, z, fill(x, c.y - 2 - d, z));
      }
    }
  });
  // timber sets and lanterns along the straight runs, clear of the station
  const centre = new Set(way.map((c) => `${c.x},${c.z}`));
  way.forEach((c, i) => {
    if (i % SET_EVERY !== 2 || inStation(c.x, c.z, 2)) return;
    if ([-1, 1].some((w) => centre.has(`${c.x - c.d[1] * w},${c.z + c.d[0] * w}`))) return; // the road doubles back here: keep it clear
    const p = way[i - 1], n = way[i + 1];
    if (!p || !n || p.d[0] !== c.d[0] || p.d[1] !== c.d[1] || n.d[0] !== c.d[0] || n.d[1] !== c.d[1]) return;
    const [ux, uz] = [-c.d[1], c.d[0]];
    for (const w of [-1, 1]) for (let h = 0; h < 3; h++) set(c.x + ux * w, c.y + h, c.z + uz * w, log(region));
    for (let w = -1; w <= 1; w++) set(c.x + ux * w, c.y + 3, c.z + uz * w, log(region, axisOf(ux, uz)));
    if ((i / SET_EVERY | 0) % 2 === 0) set(c.x, c.y + 2, c.z, S("minecraft:lantern", { hanging: true }));
  });
  // no stretch goes dark: through turns and open halls, where there is no set, a lantern every 7 blocks at most,
  // hung from the rock over the road, or else standing on the bed at its side; and one at the road's end
  let since = 0;
  way.forEach((c, i) => {
    if (inStation(c.x, c.z, 1)) { since = 0; return; }
    if (blocks.get(key(c.x, c.y + 2, c.z))?.includes("lantern")) { since = 0; return; }
    if (++since < 7 && i < way.length - 1) return;
    const [ux, uz] = [-c.d[1], c.d[0]];
    const solidOver = !air(key(c.x, c.y + 3, c.z)) && !blocks.get(key(c.x, c.y + 3, c.z))?.includes("air");
    if (solidOver) { set(c.x, c.y + 2, c.z, S("minecraft:lantern", { hanging: true })); since = 0; return; }
    for (const w of [1, -1]) {
      const x = c.x + ux * w, z = c.z + uz * w, b = blocks.get(key(x, c.y, z));
      if (b === "minecraft:air") { set(x, c.y, z, "minecraft:lantern"); since = 0; return; }
    }
    if (i === way.length - 1) set(c.x, c.y, c.z, "minecraft:lantern"); // the end of the track
  });

  // the pit bottom: a 7 x 7 room under the shaft, plank floor on a log border, posts at the corners, beams and boards over
  for (let x = -H; x <= H; x++) for (let z = -H; z <= H; z++) {
    for (let y = SF; y < CEIL; y++) dig(x, y, z);
    const edge = Math.abs(x) === H || Math.abs(z) === H;
    set(x, SF - 1, z, edge ? log(region, Math.abs(x) === H ? "z" : "x") : P);
    for (let y = SF - 3; y < SF - 1; y++) if (air(key(x, y, z))) set(x, y, z, fill(x, y, z));
    if (Math.abs(x) <= 1 && Math.abs(z) <= 1) continue; // the shaft goes on up through the boards
    set(x, CEIL, z, edge ? log(region, Math.abs(x) === H ? "z" : "x") : P);
  }
  for (const x of [-H, H]) for (const z of [-H, H]) for (let y = SF; y < CEIL; y++) set(x, y, z, log(region));
  // the road's mouth through the station's wall stays open; the other walls are rock, or timber where the cave broke in
  for (const [sx, sz] of SIDES) for (let u = -H; u <= H; u++) for (let y = SF; y < CEIL; y++) {
    const x = sx * (H + 1) + -sz * u, z = sz * (H + 1) + sx * u;
    if (wayCells.has(`${x},${z}`) || !air(key(x, y, z))) continue;
    if (Math.abs(u) === H || u === 0) set(x, y, z, log(region)); else set(x, y, z, P);
  }
  for (const [sx, sz] of SIDES) for (let u = -H; u <= H; u++) {
    const x = sx * (H + 1) + -sz * u, z = sz * (H + 1) + sx * u;
    if (!wayCells.has(`${x},${z}`) && air(key(x, CEIL, z))) set(x, CEIL, z, P);
    if (!wayCells.has(`${x},${z}`) && air(key(x, SF - 1, z))) set(x, SF - 1, z, fill(x, SF - 1, z));
  }
  set(2, CEIL - 1, 2, S("minecraft:lantern", { hanging: true }));
  set(-2, CEIL - 1, -2, S("minecraft:lantern", { hanging: true }));

  // the miners' rest: off the side with the most rock, never the road's side or where the road runs
  const roadSide = way.length ? [Math.sign(way[H + 1]?.x ?? 0), Math.sign(way[H + 1]?.z ?? 0)] : null;
  let rest = null, score = -Infinity;
  for (const [sx, sz] of SIDES) {
    if (roadSide && sx === roadSide[0] && sz === roadSide[1]) continue;
    let rock = 0, hit = 0;
    for (let k = H + 1; k <= H + 2 + REST.deep + 1; k++) for (let u = -4; u <= 4; u++) {
      const x = sx * k - sz * u, z = sz * k + sx * u;
      if (wayCells.has(`${x},${z}`)) hit++;
      for (let y = SF - 1; y <= CEIL; y++) if (!cave.air.has(key(x, y, z))) rock++;
    }
    const s = rock - hit * 1000;
    if (s > score) { score = s; rest = { side: [sx, sz], hit }; }
  }
  if (rest && rest.hit === 0) restRoom(rest.side);

  function restRoom([sx, sz]) {
    const at = (k, u) => [sx * k - sz * u, sz * k + sx * u];
    const k0 = H + 1, k1 = k0 + 1, k9 = k1 + REST.deep - 1, uw = (REST.wide - 1) / 2;
    const cardIn = CARD[`${-sx},${-sz}`];
    // shell: planks with logs at the corners, floor boards, beams across the ceiling
    for (let k = k0; k <= k9 + 1; k++) for (let u = -uw - 1; u <= uw + 1; u++) {
      const [x, z] = at(k, u);
      const wall = k === k0 || k === k9 + 1 || Math.abs(u) === uw + 1;
      for (let y = SF - 1; y <= CEIL; y++) {
        if (y === SF - 1) { set(x, y, z, wall ? log(region) : P); continue; }
        if (y === CEIL) { set(x, y, z, k % 2 === 0 && !wall ? log(region, axisOf(-sz, sx)) : P); continue; }
        if (!wall) { dig(x, y, z); continue; }
        const corner = (k === k0 || k === k9 + 1) && Math.abs(u) === uw + 1;
        set(x, y, z, corner ? log(region) : P);
      }
      for (let y = SF - 3; y < SF - 1; y++) if (air(key(x, y, z))) set(x, y, z, fill(x, y, z));
      if (air(key(x, CEIL + 1, z))) set(x, CEIL + 1, z, fill(x, CEIL + 1, z));
    }
    // the doorway from the station, framed in logs
    for (let y = SF; y < SF + 3; y++) { const [x, z] = at(k0, 0); dig(x, y, z); }
    for (const u of [-1, 1]) for (let y = SF; y < SF + 3; y++) { const [x, z] = at(k0, u); set(x, y, z, log(region)); }
    { const [x, z] = at(k0, 0); set(x, SF + 3, z, log(region, axisOf(-sz, sx))); }
    // furniture (u across the room, k from the door)
    const put = (k, u, y, b) => { const [x, z] = at(k, u); set(x, SF + y, z, b); };
    put(k9, -3, 0, BARREL); put(k9, -3, 1, BARREL); put(k9, -2, 0, BARREL);
    put(k9, -1, 0, "minecraft:crafting_table");
    put(k9, 1, 0, S("minecraft:furnace", { "minecraft:cardinal_direction": cardIn }));
    put(k9, 2, 0, S("minecraft:smoker", { "minecraft:cardinal_direction": cardIn }));
    put(k9, 3, 0, S("minecraft:chest", { "minecraft:cardinal_direction": cardIn }));
    // two bunks against the left wall: a bedroll on a plank frame, a lantern-lit shelf between
    for (const k of [k1, k1 + 2]) {
      put(k, -3, 0, S(`minecraft:${wood}_slab`, { "minecraft:vertical_half": "top" }));
      put(k, -3, 1, "minecraft:brown_carpet");
    }
    put(k1 + 1, -3, 0, BARREL); put(k1 + 1, -3, 1, "minecraft:lantern");
    // the table and its stools in the middle, under the lamp
    put(k1 + 2, 1, 0, `minecraft:${wood}_fence`); put(k1 + 2, 1, 1, S(`minecraft:${wood}_pressure_plate`));
    put(k1 + 1, 1, 0, S(`minecraft:${wood}_stairs`, { weirdo_direction: dirNum(-sx, -sz) }));
    put(k1 + 3, 1, 0, S(`minecraft:${wood}_stairs`, { weirdo_direction: dirNum(sx, sz) }));
    put(k1 + 2, 0, 3, S("minecraft:lantern", { hanging: true }));
    // tools and the last shift's note on the right wall
    put(k1, 3, 0, "minecraft:cauldron"); put(k1 + 1, 3, 0, "minecraft:grindstone");
    const [nx, nz] = at(k1 + 2, 3);
    const signFace = facing(sz, -sx); // away from the right-hand wall, into the room
    set(nx, SF + 1, nz, S(`minecraft:${wood}_wall_sign`, { facing_direction: signFace }));
    signs.push({ x: nx, y: SF + 1, z: nz, text: NOTE });
  }

  // the shaft: ladder on the front wall, a post for it through the station, timber rings, lantern niches, the rope
  const [fx, fz] = front;
  const ladder = S("minecraft:ladder", { facing_direction: facing(-fx, -fz) });
  for (let y = 0; y >= SF; y--) set(fx, y, fz, ladder);
  for (let y = SF; y < CEIL; y++) set(2 * fx, y, 2 * fz, log(region));
  for (let y = -4; y > CEIL; y -= 4) for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) {
    if (Math.max(Math.abs(x), Math.abs(z)) === 2) set(x, y, z, log(region, Math.abs(x) === 2 ? "z" : "x"));
  }
  for (let y = -7; y > CEIL; y -= 8) set(-2 * fx, y, -2 * fz, "minecraft:lantern");
  for (let y = 0; y >= -6; y--) set(0, y, 0, S("minecraft:chain", { pillar_axis: "y" }));
  set(0, -7, 0, S("minecraft:lantern", { hanging: true }));

  // rails last, on the road's own cells (they lie in the station too, out to its middle under the shaft)
  way.forEach((c, i) => {
    const p = way[i - 1], n = way[i + 1];
    if (c.x === fx && c.z === fz) return; // never on the ladder's foot
    if (blocks.get(key(c.x, c.y, c.z)) === "minecraft:lantern") return;
    const a = p ? [p.x - c.x, p.z - c.z] : null, b = n ? [n.x - c.x, n.z - c.z] : null;
    set(c.x, c.y, c.z, S("minecraft:rail", { rail_direction: railState(a, b, c.y, p?.y, n?.y) }));
  });
  return { blocks, carve, way, signs, rest };
}

// stairs: weirdo_direction 0 east, 1 west, 2 south, 3 north (the way the stair climbs up to)
function dirNum(dx, dz) { return dx > 0 ? 0 : dx < 0 ? 1 : dz > 0 ? 2 : 3; }

// ---------------------------------------------------------------- the rock, retextured by region
// Mateo 2026-11-14 ("retexture the mine"): the cave's rock is no longer plain stone. Every region has its own strata,
// bands a few blocks deep that wave with the ground, each band one rock mixed with a little of the next (house rules,
// texturing: one material in a few shades, gradients over speckle). Nothing that falls (no sand or gravel) so no
// ceiling ever drops. Ore is rolled first and written over the bands, so the ore count stays Mateo's.
export const STRATA = {
  vale: ["minecraft:stone", "minecraft:andesite", "minecraft:stone", "minecraft:tuff", "minecraft:stone", "minecraft:andesite", "minecraft:mossy_cobblestone"],
  frostmarch: ["minecraft:stone", "minecraft:calcite", "minecraft:diorite", "minecraft:stone", "minecraft:packed_ice", "minecraft:andesite", "minecraft:calcite"],
  saltreach: ["minecraft:sandstone", "minecraft:stone", "minecraft:diorite", "minecraft:smooth_sandstone", "minecraft:calcite", "minecraft:stone"],
  emberwaste: ["minecraft:red_sandstone", "minecraft:orange_terracotta", "minecraft:terracotta", "minecraft:red_terracotta", "minecraft:yellow_terracotta", "minecraft:brown_terracotta", "minecraft:smooth_red_sandstone"],
  blackfen: ["minecraft:tuff", "minecraft:packed_mud", "minecraft:stone", "minecraft:mud_bricks", "minecraft:tuff", "minecraft:clay", "minecraft:andesite"],
};
export const DEEP_STRATA = {
  default: ["minecraft:deepslate", "minecraft:tuff", "minecraft:deepslate", "minecraft:cobbled_deepslate", "minecraft:deepslate", "minecraft:smooth_basalt"],
  emberwaste: ["minecraft:deepslate", "minecraft:blackstone", "minecraft:deepslate", "minecraft:basalt", "minecraft:smooth_basalt", "minecraft:blackstone"],
};
const wave = (x, z) => {
  const a = Math.sin(x * 0.21 + z * 0.07) * 1.3 + Math.sin(z * 0.17 - x * 0.05) * 1.1;
  return a + (hash(x >> 2, 7, z >> 2) - 0.5) * 1.2;
};
/** The rock at a cave cell: rock is "minecraft:stone" or "minecraft:deepslate" as the cave had it */
export function strataAt(region, rock, x, y, z, groundY = 70) {
  const deep = rock === "minecraft:deepslate";
  const bands = deep ? (DEEP_STRATA[region] ?? DEEP_STRATA.default) : (STRATA[region] ?? STRATA.vale);
  const t = (groundY + y + wave(x, z)) / 3;
  const i = ((Math.floor(t) % bands.length) + bands.length) % bands.length;
  const frac = t - Math.floor(t), h = hash(x, y, z);
  // the band's top third mixes into the band above, its bottom into the one below
  if (frac > 0.75 && h < 0.35) return bands[(i + 1) % bands.length];
  if (frac < 0.2 && h < 0.25) return bands[(i + bands.length - 1) % bands.length];
  const b = bands[i];
  return b === "minecraft:basalt" ? `${b}{"pillar_axis":"y"}` : b;
}
