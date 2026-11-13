// The Town Upgrade Simulator's data, taken from the add-on's own code (nothing here is a copy of a rule):
// one settlement plot on its real map ground, founded as a Hamlet and grown to a Castle, with every block the game
// would set, in the order the game's build jobs set them.
//
//   node studio/town_sim/dump.mjs [plot=oakmere] [layout=0] [out=studio/town_sim/out/sim.json]
//
// The scripts are loaded in Node with a fake @minecraft/server (tools/mock-minecraft.mjs), so these are the real
// functions: towns.js (layout, groundwork, slots, seats), founding.js's founding order, blendGround and fixtures
// (ported below: they read the world), buildings.js / townhall halls (plans and buildOrder), build.js resolveRole
// (block ids and states), walldata.js + walls.js (ring, levels, palette), trains/stations.js (Halt to Grand Station),
// charters.js + config.js (plot rules and charters; shipped to the page as source so its auto-builder is the game's).
// mesh.py then turns the palette into real block shapes and Mojang textures, and mkpage.py writes the page.
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..", "..");
const SCRIPTS = path.join(ROOT, "Siege_Nights_BP", "scripts");
const [PLOT = "oakmere", LAYOUT = "0", OUT = path.join(import.meta.dirname, "out", "sim.json")] = process.argv.slice(2);
const HEIGHTS = process.env.HEIGHTS ?? "/mnt/project-files/siege-nights/map/hollow-crown-full-map-heights-pretown.npy";
const MAP_ORIGIN = -1264; // the heights array starts here on both axes (map/structures/slice_heights.py)
const HALF = 132; // blocks shown each way from the Plot Stone (the station post stands ~95 out)

// ---------- loading the game scripts in Node ----------
const { makeMock } = await import(pathToFileURL(path.join(ROOT, "tools/mock-minecraft.mjs")));
const walkFiles = (d, ext) => fs.readdirSync(d).flatMap((f) => { const p = path.join(d, f); return fs.statSync(p).isDirectory() ? walkFiles(p, ext) : p.endsWith(ext) ? [p] : []; });
const pack = { blocks: new Set(), items: new Set(), entities: new Set() };
for (const f of walkFiles(path.join(ROOT, "Siege_Nights_BP"), ".json")) {
  try { const d = JSON.parse(fs.readFileSync(f, "utf8")); const b = d["minecraft:block"]?.description?.identifier; if (b) pack.blocks.add(b); } catch { /* not a block */ }
}
const mock = makeMock(pack);
// Block permutations as plain records; an id the game doesn't have throws, as BlockPermutation.resolve does
// Vanilla ids and state names are checked against Mojang's block list (map/structures/bedrock_states.json), so a
// spelling the game would refuse is refused here too and the next spelling is tried, as in the game.
const BEDROCK = JSON.parse(fs.readFileSync(path.join(ROOT, "map/structures/bedrock_states.json"), "utf8"));
const BlockPermutation = {
  resolve(id, states) {
    if (id.startsWith("minecraft:")) {
      const props = BEDROCK.blocks[id.slice(10)];
      if (!props) throw new Error(`unknown block ${id}`);
      for (const [k, v] of Object.entries(states ?? {})) {
        if (!props.includes(k)) throw new Error(`${id} has no state ${k}`);
        const allowed = BEDROCK.properties[k]?.values;
        if (allowed && !allowed.includes(v)) throw new Error(`${id} ${k}=${v}`);
      }
    } else if (!pack.blocks.has(id)) throw new Error(`unknown block ${id}`);
    return { id, typeId: id, type: { id }, states: states ?? {} };
  },
};
globalThis.__mc = { lookup: (n) => (n === "BlockPermutation" ? BlockPermutation : mock.lookup(n)) };
const mcNames = [...new Set(walkFiles(SCRIPTS, ".js").flatMap((f) => [...fs.readFileSync(f, "utf8").matchAll(/import\s+\{([^}]*)\}\s+from\s+["']@minecraft\/[^"']+["']/g)]
  .flatMap((m) => m[1].split(",").map((n) => n.trim().split(/\s+as\s+/)[0]).filter(Boolean))))];
const hooks = `export async function resolve(s,c,n){ if(s.startsWith("@minecraft/")) return {url:"mock:"+s, shortCircuit:true}; return n(s,c);}
export async function load(u,c,n){ if(!u.startsWith("mock:")) return n(u,c); const names=${JSON.stringify(mcNames)}; return {format:"module", shortCircuit:true, source:names.map(n=>"export const "+n+" = globalThis.__mc.lookup("+JSON.stringify(n)+");").join("\\n")}; }`;
register("data:text/javascript," + encodeURIComponent(hooks), import.meta.url);
const imp = (p) => import(pathToFileURL(path.join(SCRIPTS, p)).href);
await imp("main.js"); // registers everything (the Works machines, block builds) the way the game does
mock.endEarly();

const { townFor, slotsOf, groundwork, fixturesOf, wallRadius, seatOnSlot, seatedBox, hallBox, TIER_NAMES } = await imp("settle/towns.js");
const { BUILDINGS, BUILDING, WORKS, drawBuilding: drawPlotBuilding, styleFor } = await imp("settle/buildings.js");
// the Barracks is raised from its own block (settle/blockdesigns.js guardhouse), not from a plot design
const { BLOCK_BUILDS } = await imp("settle/blockdesigns.js");
const drawBuilding = (id, st) => (id === "barracks" ? BLOCK_BUILDS["siege:barracks"].draw(st) : drawPlotBuilding(id, st));
const NAMES = { barracks: "Barracks" };
const { buildOrder, frameFor, toWorld, drawHall, HALL_TIERS } = await imp("townhall/halls.js");
const { STYLES } = await imp("townhall/styles.js");
const { resolveRole, clearBoxFor } = await imp("townhall/build.js");
const { foundationColumns } = await imp("settle/ground.js");
const { WALLS, WALL_LEVELS, wallColumns, columnKinds, wallSeed, wallShape, bearingToAngle, stationSpots, smoothGround, materialKind } = await imp("settle/walldata.js");
const { palette: wallPalette, permFor } = await imp("settle/walls.js");
const { REGION_TO_STYLE, SETTLE } = await imp("settle/config.js");
const { plotFit, opensAt, slotClass, CLASS_NAMES } = await imp("settle/charters.js");
const { plotPrice } = await imp("settle/plotmarker.js");
const { pickBaseSlot, roadLine, gradeLine, gateDir, roadEnd } = await imp("settle/basedata.js");
const { STAGES, STAGE_NAMES, TIER_STAGE, stationPlan, lineBlocks, loopBlocks, STATION } = await imp("trains/stations.js");
const { ROUTES } = await imp("trains/routes_data.js");
// the dead end at a terminus (game branch claude/terminus-buffer-stops; a through station on code without it)
const { deadEndAt = () => 0 } = await imp("trains/routes.js");
const { PLOT_PLAN: PLOTS } = await imp("plots/config.js");
const { takenAt } = await imp("settle/hallmove.js");

const tw = townFor(PLOT);
if (!tw) throw new Error(`no town layout for ${PLOT}`);
const layout = tw.variants[Number(LAYOUT)];
const plotCfg = (PLOTS ?? []).find((p) => p.name.toLowerCase() === PLOT);
const STYLE = REGION_TO_STYLE[plotCfg?.region] ?? "vale";
const CX = plotCfg?.x ?? 0, CZ = plotCfg?.z ?? 0, BASE = layout.base;

// ---------- the palette: every block the page can show ----------
const pal = [], palIdx = new Map();
const keyOf = (id, st) => JSON.stringify([id, Object.fromEntries(Object.entries(st ?? {}).sort())]);
function pid(id, st) {
  if (!id || id === "minecraft:air") return 0;
  const k = keyOf(id, st);
  if (!palIdx.has(k)) { palIdx.set(k, pal.length); pal.push([id, Object.fromEntries(Object.entries(st ?? {}).sort())]); }
  return palIdx.get(k);
}
pid("minecraft:air"); pal[0] = ["minecraft:air", {}]; palIdx.set(keyOf("minecraft:air", {}), 0);
const permId = (p) => (p ? pid(p.id ?? p.typeId, p.states) : 0);
const P = { grass: pid("minecraft:grass_block"), dirt: pid("minecraft:dirt"), stone: pid("minecraft:stone"), cobble: pid("minecraft:cobblestone") };

// ---------- the ground: the map's own heights (before towns), as a block world ----------
function readNpy(file) {
  const fd = fs.openSync(file, "r");
  const head = Buffer.alloc(256); fs.readSync(fd, head, 0, 256, 0);
  const hlen = head.readUInt16LE(8), text = head.toString("latin1", 10, 10 + hlen);
  const shape = /\((\d+),\s*(\d+)\)/.exec(text).slice(1).map(Number);
  if (!/<i2/.test(text) || /True/.test(text)) throw new Error(`unexpected npy header ${text}`);
  return { fd, shape, off: 10 + hlen };
}
const N = HALF * 2 + 1, X0 = CX - HALF, Z0 = CZ - HALF;
const ground = new Int16Array(N * N);
{
  const npy = readNpy(HEIGHTS), row = Buffer.alloc(N * 2);
  for (let i = 0; i < N; i++) {
    const ax = X0 + i - MAP_ORIGIN, az = Z0 - MAP_ORIGIN;
    fs.readSync(npy.fd, row, 0, N * 2, npy.off + (ax * npy.shape[1] + az) * 2);
    for (let j = 0; j < N; j++) ground[i * N + j] = row.readInt16LE(j * 2);
  }
}
const inArea = (x, z) => x >= X0 && x < X0 + N && z >= Z0 && z < Z0 + N;
const groundAtXZ = (x, z) => (inArea(x, z) ? ground[(x - X0) * N + (z - Z0)] : BASE);
const vox = new Map(); // "x,y,z" -> palette index (0 = air); anything not here is the untouched ground
const vk = (x, y, z) => `${x},${y},${z}`;
function natural(x, y, z) { const h = groundAtXZ(x, z); return y > h ? 0 : y === h ? P.grass : y >= h - 3 ? P.dirt : P.stone; }
const get = (x, y, z) => { const k = vk(x, y, z); return vox.has(k) ? vox.get(k) : natural(x, y, z); };
const idOf = (p) => pal[p][0];
const SOFT = /(air|water|grass$|short_grass|tall_grass|fern|flower|snow_layer|leaves|vine|bush|sapling|tallgrass|dandelion|poppy|mushroom|plot_stone)/;
const NATURAL = /(grass_block|dirt|podzol|mycelium|stone$|^minecraft:(andesite|diorite|granite|tuff|deepslate|calcite|gravel|sand|red_sand|clay|mud|snow|snow_block|packed_ice|moss_block|sandstone|red_sandstone|terracotta|cobblestone)$|_terracotta$)/;
const WALL_SOFT = /(air|water|grass(?!_block|_path)|fern|flower|snow_layer|leaves|vine|bush|sapling|tallgrass|seagrass|dandelion|poppy|mushroom|_log$|deadbush)/;
const WALL_NATURAL = /^minecraft:(dirt|coarse_dirt|rooted_dirt|grass_block|podzol|mycelium|mud|clay|gravel|sand|red_sand|sandstone|red_sandstone|stone|granite|diorite|andesite|deepslate|tuff|calcite|dripstone_block|moss_block|snow|packed_ice|ice|terracotta|\w+_terracotta|grass_path|dirt_path|farmland)$/;
function topY(x, z, softRe = SOFT) { // founding.js surfaceY / walls.js groundY: the top block, skipping soft ones
  let y = groundAtXZ(x, z) + 48;
  while (y > groundAtXZ(x, z) - 20 && (get(x, y, z) === 0 || softRe.test(idOf(get(x, y, z))))) y--;
  return y;
}

// Every change is an op, in the order the game makes it. Kinds (the page plays them):
//   [0, x, y, z, p]                      set a block (p 0 = air)
//   [1, x, y, z, p]                      fill down from y while the block is soft (footings, foundation columns)
//   [2, x0, y0, z0, x1, y1, z1]          clear a box to air (an old hall, a plot before its building)
// Coordinates in the page are from the Plot Stone (x - CX, z - CZ) so the numbers stay small.
const rel = (x, z) => [x - CX, z - CZ];
function set(ops, x, y, z, p) { vox.set(vk(x, y, z), p); const [a, b] = rel(x, z); ops.push([0, a, y, b, p]); }
function fill(ops, x, y, z, p, soft = SOFT) {
  const [a, b] = rel(x, z);
  ops.push([1, a, y, b, p]);
  for (let d = 0; d < 16; d++) { const q = get(x, y - d, z); if (q !== 0 && !soft.test(idOf(q)) && q !== p) break; vox.set(vk(x, y - d, z), p); }
}

// ---------- plans (buildings, halls, stations) to ops ----------
// One job of build.js startBuild: clear box, columns (fillColumn), cells in buildOrder, each resolved by resolveRole
function planOps(plan, style, origin, forward, { clearBox, extraColumns = [], removeFirst } = {}) {
  const ops = [], frame = frameFor(forward);
  if (removeFirst) for (const at of removeFirst) if (!(at.x === origin.x && at.y === origin.y && at.z === origin.z)) set(ops, at.x, at.y, at.z, 0);
  if (clearBox) {
    const { min, max } = clearBox; const [a0, b0] = rel(min.x, min.z), [a1, b1] = rel(max.x, max.z);
    ops.push([2, a0, min.y, b0, a1, max.y, b1]);
    for (let x = min.x; x <= max.x; x++) for (let z = min.z; z <= max.z; z++) for (let y = min.y; y <= max.y; y++) if (get(x, y, z) !== 0 && idOf(get(x, y, z)) !== "siege:hall_cornerstone") vox.set(vk(x, y, z), 0);
  }
  for (const col of [...extraColumns, ...plan.columns.values()]) {
    const top = toWorld(frame, origin, col.x, col.top, col.z);
    fill(ops, top.x, top.y, top.z, permId(resolveRole(style, frame, col.role, col.o)), /(air|water|lava|grass(?!_block|_path)|fern|flower|snow_layer|leaves|vine|bush|sapling|tallgrass|seagrass|kelp|dandelion|poppy|mushroom|lily)/);
  }
  for (const c of buildOrder(plan)) {
    const at = toWorld(frame, origin, c.x, c.y, c.z);
    if (at.x === origin.x && at.y === origin.y && at.z === origin.z) continue; // never the cornerstone / stone spot
    if (idOf(get(at.x, at.y, at.z)) === "siege:hall_cornerstone") continue;
    set(ops, at.x, at.y, at.z, permId(resolveRole(style, frame, c.role, c.o)));
  }
  return ops;
}

// A building design, as the page needs it: local cells for each way it can face (states turn with it)
const designs = {};
function designFor(id, forward) {
  const fk = `${forward.x},${forward.z}`;
  const d = (designs[id] ??= { id, name: BUILDING[id]?.name ?? NAMES[id] ?? id, faces: {} });
  if (d.faces[fk]) return d;
  const plan = drawBuilding(id, STYLE), style = styleFor(STYLE), frame = frameFor(forward);
  const b = plan.bounds();
  d.bounds = b;
  const cols = [...foundationColumns(plan), ...plan.columns.values()].map((c) => [c.x, c.top, c.z, permId(resolveRole(style, frame, c.role, c.o))]);
  const cells = buildOrder(plan).map((c) => [c.x, c.y, c.z, permId(resolveRole(style, frame, c.role, c.o))]);
  d.faces[fk] = { cols, cells };
  d.top = b.y1;
  return d;
}

// ---------- the settlement ----------
const slots = slotsOf(layout);
const allClasses = new Set(slots.map(slotClass));
const events = []; // the founding and growing, in the game's order: { id, label, group, ops, after? }
const ev = (id, label, group, ops, extra = {}) => { events.push({ id, label, group, ops, ...extra }); return ops; };

// Plot Stone (the map builder's) at the square
vox.set(vk(CX, BASE, CZ), pid("siege:plot_stone"));
const initial = [[0, 0, BASE, 0, pid("siege:plot_stone")]];

// --- groundwork of one tier (founding.js layOutJob), then blendGround, then the fixtures
function groundworkOps(tier) {
  const ops = [];
  for (const [dx, dy, dz, p] of groundwork(layout, tier)) {
    if (dx === 0 && dz === 0) continue;
    const [id, st] = layout.pal[p];
    set(ops, CX + dx, BASE + dy, CZ + dz, pid(id, st));
  }
  return ops;
}
const TAPER = 6, slope = (k) => Math.ceil(k / 2);
function blendOps(tier) { // founding.js blendGround on this world
  const ops = [], cols = new Map(), member = new Set();
  for (let t = 0; t <= tier; t++) for (const [dx, dy, dz, p] of groundwork(layout, t)) {
    const k = `${dx},${dz}`; member.add(k);
    if (t !== tier || layout.pal[p]?.[0] === "minecraft:air") continue;
    const c = cols.get(k);
    if (!c) cols.set(k, { dx, dz, lo: dy, hi: dy }); else { c.lo = Math.min(c.lo, dy); c.hi = Math.max(c.hi, dy); }
  }
  for (const c of cols.values()) {
    const x = CX + c.dx, z = CZ + c.dz;
    for (let y = BASE + c.lo - 1, k = 0; k < 16; y--, k++) {
      const b = idOf(get(x, y, z));
      if (!/air|water|lava|short_grass|tall_grass|fern|flower|snow_layer|leaves/.test(b)) break;
      set(ops, x, y, z, k < 3 ? P.dirt : P.stone);
    }
  }
  for (const c of cols.values()) {
    const h = BASE + c.hi;
    for (const [ux, uz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (member.has(`${c.dx + ux},${c.dz + uz}`)) continue;
      for (let k = 1; k <= TAPER; k++) {
        if (member.has(`${c.dx + ux * k},${c.dz + uz * k}`)) break;
        const x = CX + c.dx + ux * k, z = CZ + c.dz + uz * k;
        const top = topY(x, z, /(air)/);
        const hiOk = h + slope(k), loOk = h - slope(k);
        if (top > hiOk) {
          let nat = true;
          for (let y = top; y > hiOk; y--) { const b = idOf(get(x, y, z)); if (!NATURAL.test(b) && b !== "minecraft:air") { nat = false; break; } }
          if (!nat) break;
          for (let y = top; y > hiOk; y--) set(ops, x, y, z, 0);
          if (/dirt$|stone$|gravel|andesite|diorite|granite|tuff/.test(idOf(get(x, hiOk, z)))) set(ops, x, hiOk, z, P.grass);
        } else if (top < loOk) {
          const s = get(x, top, z), sid = idOf(s);
          const cap = NATURAL.test(sid) && !/stone$|andesite|diorite|granite|tuff|cobble/.test(sid) ? s : P.grass;
          for (let y = top + 1; y <= loOk; y++) set(ops, x, y, z, y === loOk ? cap : P.dirt);
          if (sid === "minecraft:grass_block") set(ops, x, top, z, P.dirt);
        } else break;
      }
    }
  }
  return ops;
}
const trees = []; // asked of mesh.py (the tree thread's grower): { species, size, rotation, x, y, z, tier }
let hallSpot;
function fixtureOps(tier) { // founding.js placeFixture
  const ops = [];
  for (const f of fixturesOf(layout, tier)) {
    const x = CX + f.x, z = CZ + f.z;
    const g = f.dy !== undefined && f.dy !== null ? BASE + f.dy : topY(x, z);
    const y = g + 1;
    if (f.kind === "lamp") {
      set(ops, x, y, z, pid("minecraft:spruce_fence")); set(ops, x, y + 1, z, pid("minecraft:spruce_fence")); set(ops, x, y + 2, z, pid("minecraft:lantern", { hanging: false }));
    } else if (f.kind === "well") {
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        if (dx || dz) set(ops, x + dx, y, z + dz, pid("minecraft:stone_bricks"));
        else { set(ops, x, g, z, pid("minecraft:water")); set(ops, x, y, z, 0); }
      }
      for (const [dx, dz] of [[-1, -1], [1, 1]]) for (let h = 1; h <= 2; h++) set(ops, x + dx, y + h, z + dz, pid("minecraft:spruce_fence"));
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) set(ops, x + dx, y + 3, z + dz, pid("minecraft:spruce_slab", { "minecraft:vertical_half": "bottom" }));
    } else if (f.kind === "hall_cornerstone") {
      set(ops, x, y, z, pid("siege:hall_cornerstone"));
      const box = layout.hall[0];
      const hx = CX + (box[0] + box[2]) / 2, hz = CZ + (box[1] + box[3]) / 2;
      const fx = Math.abs(hx - x) >= Math.abs(hz - z) ? Math.sign(hx - x) : 0;
      const fz = fx ? 0 : Math.sign(hz - z) || 1;
      hallSpot = { x, y, z, forward: { x: fx, z: fz } };
    } else if (f.kind === "tree") {
      trees.push({ species: f.species, size: f.size, rotation: f.rotation ?? 0, x: f.x, y, z: f.z, tier });
    }
  }
  return ops;
}

// --- the wall (walls.js raiseWall / moveWall), on this world's ground
const CARD = [[0, "north"], [90, "east"], [180, "south"], [270, "west"]];
const [gateDeg, gateDirName] = CARD.reduce((best, c) => (Math.abs(((tw.gate ?? 180) - c[0] + 540) % 360 - 180) < Math.abs(((tw.gate ?? 180) - best[0] + 540) % 360 - 180) ? c : best));
const wall = { x: CX, y: BASE, z: CZ, shape: wallShape(tw.name), radius: wallRadius(tw, 0), level: 0, style: STYLE, gate: bearingToAngle(gateDeg), gateDir: gateDirName, ground: undefined, lifts: {} };
function measureWall() {
  wall.ground = smoothGround(stationSpots(wall, wall.radius).map((s) => topY(s.x, s.z, WALL_SOFT)));
}
function wallCols(level) { return wallColumns({ center: wall, radius: wall.radius, level, gateAngle: wall.gate, smooth: wall.ground }); }
function wallOps(level) { // raiseWall -> step -> placeColumn
  if (!wall.ground) measureWall();
  const ops = [], L = WALL_LEVELS[level], Pw = wallPalette(STYLE, L, {});
  const cols = wallCols(level);
  if (wall.level > 0 && wall.level !== level) { // clearOldSteps
    const keep = new Set(cols.map((c) => `${c.x},${c.z}`));
    for (const col of wallCols(wall.level)) {
      if (!["stair", "landing", "ladder"].includes(col.role) || keep.has(`${col.x},${col.z}`)) continue;
      for (const [y] of columnKinds(WALL_LEVELS[wall.level], col, wallSeed(wall))) set(ops, col.x, y, col.z, 0);
    }
  }
  for (const col of cols) {
    const { x, z, base } = col;
    const cells = new Map(columnKinds(L, col, wallSeed(wall), wall.style));
    if (col.role === "gap" || col.role === "gate" || col.role === "port") {
      if (get(x, base, z) === 0) set(ops, x, base, z, permId(Pw.kinds.cobbled));
      for (let y = base + 1; y <= col.top + (L.gate === "open" ? 2 : 0); y++) set(ops, x, y, z, cells.has(y) ? permId(permFor(Pw, wall, cells.get(y), col)) : 0);
      continue;
    }
    const lk = `${x},${z}`;
    let lift = col.role === "stair" || col.role === "ladder" ? 0 : wall.lifts[lk];
    if (lift === undefined) {
      lift = 0;
      while (lift < 4 && WALL_NATURAL.test(idOf(get(x, base + 1 + lift, z)))) lift++;
      if (lift) wall.lifts[lk] = lift;
    }
    for (const [y, kind] of cells) set(ops, x, y + lift, z, permId(permFor(Pw, wall, kind, col)));
    const footing = col.role === "walk" ? Pw.kinds.plank : Pw.kinds[materialKind(L, 1, false)];
    fill(ops, x, base, z, permId(footing), WALL_SOFT);
  }
  wall.level = level;
  return ops;
}
function wallDownOps() { // moveWall's takeDown of the old ring
  const ops = [], L = WALL_LEVELS[wall.level];
  for (const col of wallCols(wall.level)) {
    const lift = wall.lifts[`${col.x},${col.z}`] ?? 0;
    for (const [y] of columnKinds(L, col, wallSeed(wall))) set(ops, col.x, y + lift, col.z, 0);
  }
  return ops;
}

// --- plot markers (founding.js placeMarkers)
const markerSpot = (s) => { const seat = seatOnSlot(s, { x0: 0, x1: 0, y0: 0, y1: 0, z0: 0, z1: 0 }); return [seat.origin.dx, BASE + s.dy + 1, seat.origin.dz]; };
const MARKER = pid("siege:plot_marker");
function markerOps(tier) {
  const ops = [];
  for (const s of slots) if (s.tier === tier) { const [dx, y, dz] = markerSpot(s); set(ops, CX + dx, y, CZ + dz, MARKER); }
  return ops;
}

// --- the plot buildings: where each design sits on each plot (plotmarker.js seatInWorld / choicesFor)
const offerIds = [...new Set([...BUILDINGS.map((b) => b.id), ...WORKS.map((w) => w.id), "barracks"])];
function seatFor(slot, id) {
  const plan = drawBuilding(id, STYLE);
  const seat = seatOnSlot(slot, plan.bounds());
  if (!seat) return undefined;
  const origin = { x: CX + seat.origin.dx, y: BASE + seat.origin.dy, z: CZ + seat.origin.dz };
  const cb = clearBoxFor(plan, origin, seat.forward, 0);
  designFor(id, seat.forward);
  return { o: [seat.origin.dx, BASE + seat.origin.dy, seat.origin.dz], f: [seat.forward.x, seat.forward.z],
    clear: [cb.min.x - CX, cb.min.y, cb.min.z - CZ, cb.max.x - CX, cb.max.y, cb.max.z - CZ] };
}
const slotOut = slots.map((s) => {
  const offers = [];
  for (const id of offerIds) {
    // offered wherever it could ever go, a fallback size too (the page checks plotFit again with the plots free then)
    const rule = plotFit(id, s, new Set());
    if (!rule.ok && !rule.tagged) continue;
    const seat = seatFor(s, id);
    if (!seat) continue;
    offers.push({ id, ok: rule.ok, tagged: rule.tagged, why: rule.why, opens: opensAt(id), price: plotPrice(id), ...seat });
  }
  return { id: s.id, size: s.size, cls: slotClass(s), long: s.long, box: s.box, dy: s.dy, side: s.side, tier: s.tier, tags: s.tags, step: s.step,
    marker: markerSpot(s), takenAt: takenAt(s) ?? null, offers };
});

// ---------- the wall rings: every level on every ring, measured on the ground as it is when the ring goes up ----------
function ringOps(tier) {
  wall.radius = wallRadius(tw, tier); wall.ground = undefined; wall.lifts = {}; wall.level = 0;
  measureWall();
  const snap = new Map(vox), restore = () => { vox.clear(); for (const [k, v] of snap) vox.set(k, v); };
  // the page raises level L over level L-1 and takes down what L no longer has (old steps, ladders)
  const ring = { radius: wall.radius, fresh: {} };
  for (let L = 1; L < WALL_LEVELS.length; L++) {
    restore(); wall.level = 0; wall.lifts = {};
    ring.fresh[L] = wallOps(L);
  }
  restore(); wall.level = 0; wall.lifts = {};
  return ring;
}
const rings = [ringOps(0)];

// ---------- the founding (foundTown), in order ----------
ev("gw0", "Hamlet groundwork: roads and levelled plots", "ground", groundworkOps(0));
ev("blend0", "The land blended into the new ground", "ground", blendOps(0));
ev("fix0", "Lamps, the well and the Hall Cornerstone", "ground", fixtureOps(0));
ev("markers0", "A Plot Marker on every Hamlet plot", "markers", markerOps(0));

// the gate road out to the station (founding.js joinRoad lays it to the nearest map road: here the line's own halt)
const stop = ROUTES.stops.find((s) => s.id === PLOT) ?? ROUTES.stops.find((s) => s.plot?.toLowerCase() === PLOT);
const track = [];
for (const seg of ROUTES.segments) for (const [x, y, z, kind, dir] of seg.blocks) if (inArea(x, z)) track.push([x - CX, y, z - CZ, kind, dir]);

// the station site (station_sites.js / stations.js siteFor): straight track next to the stop, building toward the town
let station;
if (stop) {
  const near = track.filter((t) => t[3] === 0 && t[4] % 2 === 0).map((t) => ({ t, d: (t[0] + CX - stop.x) ** 2 + (t[2] + CZ - stop.z) ** 2 })).sort((a, b) => a.d - b.d)[0];
  const at = near ? { x: near.t[0] + CX, y: near.t[1], z: near.t[2] + CZ, dir: near.t[4] } : { x: stop.x, y: stop.y, z: stop.z, dir: 0 };
  const forward = at.dir === 2 ? { x: 0, z: Math.sign(CZ - at.z) || 1 } : { x: Math.sign(CX - at.x) || 1, z: 0 };
  station = { origin: { x: at.x, y: at.y, z: at.z }, forward };
  station.end = deadEndAt(ROUTES, station.origin, forward);
}
const TRACK_PID = (kind, dir) => pid("siege:track", { "siege:kind": kind, "siege:dir": dir });
function stationOps(stage, prevStage) {
  const plan = stationPlan(STYLE, stage, station.end), style = plan.style ?? styleFor(STYLE);
  const removeFirst = prevStage ? (() => {
    const old = stationPlan(STYLE, prevStage, station.end), fr = frameFor(station.forward), out = [];
    for (const c of old.cells.values()) if (c.role !== "air") out.push(toWorld(fr, station.origin, c.x, c.y, c.z));
    for (const col of old.columns.values()) for (let y = 1; y <= col.top; y++) out.push(toWorld(fr, station.origin, col.x, y, col.z));
    return out;
  })() : undefined;
  const ops = planOps(plan, style, station.origin, station.forward, { removeFirst });
  for (const b of lineBlocks(plan, station.origin, station.forward)) set(ops, b.x, b.y, b.z, TRACK_PID(0, b.dir));
  for (const b of loopBlocks(plan, station.origin, station.forward)) set(ops, b.x, b.y, b.z, TRACK_PID(b.kind, b.dir));
  return ops;
}
// the map's own line through the area, on its bed, before anything is founded
const trackOps = [];
for (const [x, y, z, kind, dir] of track) {
  set(trackOps, x + CX, y - 1, z + CZ, pid("minecraft:gravel"));
  for (let k = 1; k <= 3; k++) if (get(x + CX, y + k, z + CZ) !== 0) set(trackOps, x + CX, y + k, z + CZ, 0);
  set(trackOps, x + CX, y, z + CZ, TRACK_PID(kind, dir));
}
for (const op of trackOps) initial.push(op);

function roadOps() { // founding.js joinRoad, to the station's platform end instead of a map road
  if (!station) return [];
  const dir = gateDir(tw.gate);
  const tops = new Map(), member = new Set();
  for (let t = 0; t <= 3; t++) for (const [dx, dy, dz, p] of groundwork(layout, t)) {
    member.add(`${dx},${dz}`);
    if (t !== 0) continue;
    const id = layout.pal[p]?.[0] ?? "", k = `${dx},${dz}`;
    if (id !== "minecraft:air" && (!tops.has(k) || tops.get(k).dy < dy)) tops.set(k, { x: dx, z: dz, dy, id });
  }
  const paths = [...tops.values()].filter((c) => /grass_path|dirt_path|gravel|cobble|sandstone|planks|_slab|brick|coarse_dirt|packed_mud|mud_bricks/.test(c.id));
  const end = roadEnd(paths, dir);
  if (!end) return [];
  const target = { x: station.origin.x - CX + station.forward.x * 3, z: station.origin.z - CZ + station.forward.z * 3 };
  const line = roadLine({ x: end.x, z: end.z }, target);
  const h0 = BASE + end.dy, h1 = station.origin.y - 1;
  const heights = gradeLine(h0, h1, line.length - 1);
  // the road is laid in the town street's own full blocks (joinRoad copies the map road it meets; here that is the street)
  const STREET = ["minecraft:cobblestone", "minecraft:mossy_cobblestone", "minecraft:andesite", "minecraft:gravel", "minecraft:cobblestone"].map((id) => pid(id));
  const side = { x: -dir.z, z: dir.x }, ops = [], laid = new Set();
  const surfaceAt = (x, z) => STREET[(((x * 73856093) ^ (z * 19349663)) >>> 0) % STREET.length];
  for (let i = 1; i < line.length; i++) {
    const { x: lx, z: lz } = line[i], y = heights[i];
    for (let w = -1; w <= 1; w++) {
      const cx = lx + side.x * w, cz = lz + side.z * w;
      if (member.has(`${cx},${cz}`) || laid.has(`${cx},${cz}`)) continue;
      laid.add(`${cx},${cz}`);
      const x = CX + cx, z = CZ + cz;
      for (let k = 1; k <= 6; k++) if (get(x, y + k, z) !== 0 && NATURAL.test(idOf(get(x, y + k, z)))) set(ops, x, y + k, z, 0);
      for (let k = 1; k <= 12; k++) { if (get(x, y - k, z) !== 0) break; set(ops, x, y - k, z, P.dirt); }
      set(ops, x, y, z, surfaceAt(x, z));
    }
  }
  // joinRoad: the land either side steps down or up to the road by at most 1 a block (a second pass, so the
  // whole road is down before its banks are shaped)
  for (let i = 1; i < line.length; i++) {
    const { x: lx, z: lz } = line[i], y = heights[i];
    for (const sgn of [-1, 1]) for (let k = 2; k <= 4; k++) {
      const cx = lx + side.x * sgn * k, cz = lz + side.z * sgn * k;
      if (member.has(`${cx},${cz}`) || laid.has(`${cx},${cz}`)) break;
      const x = CX + cx, z = CZ + cz, top = topY(x, z, /(air)/), lim = k - 1;
      if (top > y + lim) {
        let nat = true;
        for (let yy = top; yy > y + lim; yy--) { const b = idOf(get(x, yy, z)); if (!NATURAL.test(b) && b !== "minecraft:air") { nat = false; break; } }
        if (!nat) break;
        for (let yy = top; yy > y + lim; yy--) set(ops, x, yy, z, 0);
        if (/dirt$|stone$|gravel|andesite|diorite|granite|tuff/.test(idOf(get(x, y + lim, z)))) set(ops, x, y + lim, z, P.grass);
      } else if (top < y - lim) {
        for (let yy = top + 1; yy <= y - lim; yy++) set(ops, x, yy, z, yy === y - lim ? P.grass : P.dirt);
      } else break;
    }
  }
  return ops;
}
ev("road0", "The gate road out to the railway", "ground", roadOps());

// the hall (townhall.js foundHall -> beginBuild(1)); later levels clear the old hall first (clearBoxFor pad 1)
let hallLevel = 0;
function hallOps(level) {
  const st = STYLES[STYLE];
  const plan = drawHall(level, st);
  const clearBox = hallLevel > 0 ? clearBoxFor(drawHall(hallLevel, st), hallSpot, hallSpot.forward) : undefined;
  const ops = planOps(plan, st, hallSpot, hallSpot.forward, { clearBox });
  hallLevel = level;
  return ops;
}
ev("hall1", `Town hall level 1: the ${HALL_TIERS[1].name}`, "hall", hallOps(1), { hall: 1 });

// the library, the Mason's Yard and the founder's cottage (plotmarker.js + basebuilds.js, on townLaidOut)
const taken = new Set();
const baseBuilds = [];
{
  const ok = slots.filter((s) => s.tier === 0 && seatFor(s, "library"));
  const s = ok.find((x) => x.tags.includes("library")) ?? ok.find((x) => x.tags.includes("square")) ?? ok[0];
  if (s) { taken.add(s.id); baseBuilds.push({ slot: s.id, id: "library", why: "Every town starts with its library" }); }
}
let masonSlot;
{
  const f = fixturesOf(layout, 0).find((x) => x.kind === "mason_yard");
  const DIRS = { s: { x: 0, z: 1 }, n: { x: 0, z: -1 }, e: { x: 1, z: 0 }, w: { x: -1, z: 0 } };
  if (f) {
    const out = DIRS[f.rotation] ?? DIRS.s;
    const box = out.z ? { x0: f.x - 4, x1: f.x + 4, z0: out.z > 0 ? f.z - 8 : f.z - 1, z1: out.z > 0 ? f.z + 1 : f.z + 8 }
      : { z0: f.z - 4, z1: f.z + 4, x0: out.x > 0 ? f.x - 8 : f.x - 1, x1: out.x > 0 ? f.x + 1 : f.x + 8 };
    masonSlot = { id: "mason_yard", size: "S", tier: 0, tags: [], dy: f.dy ?? 0, side: f.rotation, door: out, box };
  } else {
    const s = pickBaseSlot(slots, taken, { x: 0, z: 0 });
    if (s) { masonSlot = s; taken.add(s.id); }
  }
}
const masonSeat = masonSlot && seatFor(masonSlot, "mason_yard");
if (masonSeat) baseBuilds.push({ slot: masonSlot.id, id: "mason_yard", why: "The Mason's Yard every new base gets", seat: masonSeat });
{
  const s = pickBaseSlot(slots, taken, { x: 0, z: 0 });
  if (s) { taken.add(s.id); baseBuilds.push({ slot: s.id, id: "cottage", why: "Your own house by the square" }); }
}

// the Halt (station_sites.js: the claim takes the nearest Station Post and raises its stage)
const stationEvents = [];
if (station) {
  let prev;
  for (const stage of STAGES) { stationEvents.push({ stage, name: STAGE_NAMES[stage], ops: stationOps(stage, prev) }); prev = stage; }
}

// ---------- growing (growTown): the old ring comes down, the new ring rises, each tier lays its band ----------
const tiers = [];
for (let tier = 0; tier <= 3; tier++) {
  const t = { tier, name: TIER_NAMES[tier], radius: wallRadius(tw, tier), cap: WALLS.tierCap[tier], hallMax: tier + 1, stage: TIER_STAGE[TIER_NAMES[tier]] };
  if (tier > 0) {
    rings[tier] = ringOps(tier);
    t.ground = groundworkOps(tier);
    t.blend = blendOps(tier);
    t.fixtures = fixtureOps(tier);
    t.markers = markerOps(tier);
  }
  t.ring = rings[tier];
  tiers.push(t);
}

// hall levels 2..5 (each clears the one before)
const halls = [null, { level: 1, name: HALL_TIERS[1].name, ops: events.find((e) => e.id === "hall1").ops }];
for (let l = 2; l <= 5; l++) halls.push({ level: l, name: HALL_TIERS[l].name, settlement: HALL_TIERS[l].settlement, ops: hallOps(l) });

// ---------- siege nights, played by the game's own siege code (siege_night.mjs) ----------
const { runSieges } = await import(pathToFileURL(path.join(import.meta.dirname, "siege_night.mjs")).href);
const LANG = fs.readFileSync(path.join(ROOT, "Siege_Nights_RP/texts/en_US.lang"), "utf8");
const entityName = (id) => new RegExp(`^entity\\.${id.replace(/[.:]/g, (c) => "\\" + c)}\\.name=(.*)$`, "m").exec(LANG)?.[1]?.trim()
  ?? id.replace(/^\w+:/, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const sieges = await runSieges({
  imp, mock, CX, CZ, BASE, gateAngle: wall.gate, radii: [0, 1, 2, 3].map((t) => wallRadius(tw, t)),
  homes: [1, 3, 6, 10], // a villager for each home the tier's charter asks for (planSiege counts villagers)
  wallLevels: WALLS.tierCap,
});
sieges.names = Object.fromEntries([...new Set(Object.values(sieges.nights).flatMap((n) => n?.waves.flat().map((e) => e.type) ?? []))].map((t) => [t, entityName(t)]));

// ---------- the page's copy of the plot rules and charters (the game's own source) ----------
const cfg = await imp("settle/config.js");
const chartersSrc = fs.readFileSync(path.join(SCRIPTS, "settle/charters.js"), "utf8").replace(/^import .*$/m, "").replace(/^export /gm, "");
const rules = `const { OPENS_AT, PLOT_SIZE, PLOT_ALSO, PLOT_FALLBACK, PLOT_TAGS, TAG_WORDS, CHARTERS, WORK } = ${JSON.stringify({
  OPENS_AT: cfg.OPENS_AT, PLOT_SIZE: cfg.PLOT_SIZE, PLOT_ALSO: cfg.PLOT_ALSO, PLOT_FALLBACK: cfg.PLOT_FALLBACK, PLOT_TAGS: cfg.PLOT_TAGS, TAG_WORDS: cfg.TAG_WORDS, CHARTERS: cfg.CHARTERS, WORK: cfg.WORK })};\n${chartersSrc}`;

const soft = pal.map(([id]) => (SOFT.test(id) || id === "siege:plot_marker" ? 1 : 0));
const out = {
  plot: tw.name, region: plotCfg?.region, style: STYLE, layout: layout.label, layoutIndex: Number(LAYOUT), center: [CX, CZ], base: BASE, half: HALF,
  gate: gateDirName, tierNames: TIER_NAMES, walls: tw.walls, wallLevelNames: WALL_LEVELS.map((l) => l?.name ?? null), tierCap: WALLS.tierCap,
  hallTiers: HALL_TIERS, stageNames: STAGE_NAMES, stages: STAGES, buildings: { ...Object.fromEntries(Object.entries(BUILDING).map(([k, b]) => [k, { name: b.name, blurb: b.blurb ?? "" }])), barracks: { name: "Barracks", blurb: "The guardhouse a Barracks block raises: Men-at-Arms wait in it and come out to fight." } },
  ground: { x0: X0 - CX, z0: Z0 - CZ, n: N, h: Array.from(ground) },
  palette: pal, soft, initial, events, tiers, halls, stations: stationEvents, slots: slotOut, baseBuilds, masonSlot: masonSlot?.id === "mason_yard" ? { ...masonSlot, seat: masonSeat } : null,
  designs, trees, rules, sieges, keepHealth: [200, 300, 400, 600], hallTakes: slotOut.filter((s) => s.takenAt).map((s) => [s.id, s.takenAt]),
  station: station ? { origin: [station.origin.x - CX, station.origin.y, station.origin.z - CZ], forward: [station.forward.x, station.forward.z] } : null,
  charterNames: cfg.CHARTERS.map((c) => c.map((l) => l.what)),
  // how fast each kind of job runs in the game (blocks a tick), so the page can play at the game's own pace
  pace: { groundwork: 400, wall: WALLS.perTick, station: STATION.perTick, riseTicks: SETTLE.riseTicks,
    hallRise: JSON.parse(/RISE_TICKS = (\[[^\]]*\])/.exec(fs.readFileSync(path.join(SCRIPTS, "townhall/townhall.js"), "utf8"))[1]) },
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out));
const nOps = (o) => (o ?? []).length;
console.log(`${tw.name} (${layout.label}) style ${STYLE}, base y ${BASE}, ${slots.length} plots, ${pal.length} block kinds, ${Object.keys(designs).length} designs, ${trees.length} trees`);
console.log("events:", events.map((e) => `${e.id}:${nOps(e.ops)}`).join(" "));
console.log("tiers:", tiers.map((t) => `${t.name} r${t.radius} gw${nOps(t.ground)} wall L1 ${nOps(t.ring.fresh[1])} L10 ${nOps(t.ring.fresh[10])}`).join(" | "));
console.log("halls:", halls.slice(1).map((h) => `${h.name}:${nOps(h.ops)}`).join(" "), "stations:", stationEvents.map((s) => `${s.stage}:${nOps(s.ops)}`).join(" "));
{ const ks = Object.keys(sieges.nights), w = ks.map((k) => sieges.nights[k]?.waves ?? []); console.log("sieges:", ks.length, "nights, waves", w.map((x) => x.length).join(""), "first", JSON.stringify(sieges.nights["1|0|none"]).slice(0, 300)); }
console.log("base builds:", baseBuilds.map((b) => `${b.id}@${b.slot}`).join(" "), "size", (fs.statSync(OUT).size / 1e6).toFixed(1), "MB");
