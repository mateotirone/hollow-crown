#!/usr/bin/env node
// Lay a player's Hamlet out on a real map plot with the add-on's own code, in a block world cut from the baked map,
// and write the result for the town audit (tools/town_audit.py) and its 3D viewer.
//   node tools/sim-hamlet.mjs PLOT.json OUT.json [--ticks N]
// PLOT.json: tools/town_audit_dump.py with AUDIT_JSON=1 (the plot's blocks from the baked world, its Plot Stone).
// What runs is what the game runs when a player picks the plot in the welcome hall (plots/welcome.js emits
// plotChosen): settle/arrival.js founds the town, settle/founding.js lays out the Hamlet (groundwork, blend, road
// join, fixtures), the Longhouse rises (townhall/build.js), the wall goes up (settle/walls.js), and the starter
// buildings (mason's yard, library, founder's house) are raised by the plot engine (settle/plans.js).
// Every block the scripts set goes through BlockPermutation and Block like in game; ids and states are checked
// against the vanilla list (map/structures/bedrock_states.json) and the pack's own blocks.
import { register } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPTS = join(ROOT, "Siege_Nights_BP/scripts");
const [src, dst, ...rest] = process.argv.slice(2);
const TICKS = Number(rest[rest.indexOf("--ticks") + 1]) || 24000;
const { makeMock } = await import(pathToFileURL(join(ROOT, "tools/mock-minecraft.mjs")));
const walk = (d, ext) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p, ext) : p.endsWith(ext) ? [p] : []; });
const pack = { blocks: new Set(), items: new Set(), entities: new Set() };
for (const f of walk(join(ROOT, "Siege_Nights_BP"), ".json")) {
  try {
    const d = JSON.parse(readFileSync(f, "utf8"));
    for (const [k, set] of [["minecraft:block", pack.blocks], ["minecraft:item", pack.items], ["minecraft:entity", pack.entities]]) {
      const id = d[k]?.description?.identifier;
      if (id) set.add(id);
    }
  } catch { /* not ours */ }
}
const VANILLA = JSON.parse(readFileSync(join(ROOT, "map/structures/bedrock_states.json"), "utf8"));
const mock = makeMock(pack);
globalThis.__mc = mock;
globalThis.__siegeOffline = true;
const world = mock.lookup("world"), system = mock.lookup("system");
const notes = { unknownIds: new Map(), unknownStates: new Map(), warns: [], commands: new Map(), structures: [] };

// ---------------------------------------------------------------- permutations
const perms = new Map();
const canon = (id) => (id.includes(":") ? id : `minecraft:${id}`);
class Perm {
  constructor(id, states) { this.type = { id }; this.typeId = id; this._st = states; }
  getState(k) { return this._st[k]; }
  getAllStates() { return { ...this._st }; }
  withState(k, v) { return resolvePerm(this.type.id, { ...this._st, [k]: v }); }
  matches(id, st = {}) { return canon(id) === this.type.id && Object.entries(st).every(([k, v]) => this._st[k] === v); }
  getTags() { return []; }
  hasTag() { return false; }
  getItemStack() { return undefined; }
}
function resolvePerm(id, states = {}) {
  id = canon(String(id));
  const bareId = id.replace(/^minecraft:/, "");
  const vanilla = id.startsWith("minecraft:");
  if (vanilla && !(bareId in VANILLA.blocks)) {
    notes.unknownIds.set(id, (notes.unknownIds.get(id) ?? 0) + 1);
    throw new Error(`unknown block ${id}`);
  }
  if (!vanilla && !pack.blocks.has(id)) { notes.unknownIds.set(id, (notes.unknownIds.get(id) ?? 0) + 1); throw new Error(`unknown block ${id}`); }
  if (vanilla) {
    const ok = VANILLA.blocks[bareId];
    for (const k of Object.keys(states)) if (!ok.includes(k)) { notes.unknownStates.set(`${id} ${k}`, (notes.unknownStates.get(`${id} ${k}`) ?? 0) + 1); throw new Error(`bad state ${k} for ${id}`); }
  }
  const key = id + JSON.stringify(Object.entries(states).sort());
  if (!perms.has(key)) perms.set(key, new Perm(id, { ...states }));
  return perms.get(key);
}
const AIR = resolvePerm("minecraft:air");
const BlockPermutation = { resolve: (id, st) => resolvePerm(id, st ?? {}) };

// ---------------------------------------------------------------- the block world
// "--buildings STYLE": no plot, a flat grass field; every plot building and hall level of that style is raised on it
const FLAT = src === "--buildings";
const FLAT_STYLE = FLAT ? dst : undefined;
const OUT = FLAT ? rest[0] : dst;
const P = FLAT ? { meta: { kind: "buildings", name: `buildings_${FLAT_STYLE}`, region: FLAT_STYLE, x: 0, z: 0, r: 400, box: [-40, 60, -40, 640, 250, 520] }, pal: [], xyz: "", pid: "" }
  : JSON.parse(readFileSync(src, "utf8"));
const meta = P.meta;
const xyz = new Int32Array(Buffer.from(P.xyz, "base64").buffer.slice(0));
const pid = new Int32Array(Buffer.from(P.pid, "base64").buffer.slice(0));
const basePal = P.pal.map(([n, st]) => { try { return resolvePerm(n, st); } catch { return new Perm(canon(n), st); } });
const cells = new Map(); // "x,y,z" -> Perm
const K = (x, y, z) => `${x},${y},${z}`;
const [bx0, by0, bz0, bx1, by1, bz1] = meta.box;
for (let i = 0; i < pid.length; i++) cells.set(K(xyz[3 * i], xyz[3 * i + 1], xyz[3 * i + 2]), basePal[pid[i]]);
const STONE = resolvePerm("minecraft:stone");
const inBox = (x, z) => x >= bx0 && x <= bx1 && z >= bz0 && z <= bz1;
const GRASS = resolvePerm("minecraft:grass_block"), DIRT = resolvePerm("minecraft:dirt");
const permAt = FLAT
  ? (x, y, z) => cells.get(K(x, y, z)) ?? (changed.has(K(x, y, z)) ? AIR : y === 64 ? GRASS : y < 64 && y > 60 ? DIRT : y <= 60 ? STONE : AIR)
  : (x, y, z) => cells.get(K(x, y, z)) ?? (y < by0 ? STONE : inBox(x, z) ? AIR : (y <= 62 ? STONE : AIR));
const changed = new Set();
function setAt(x, y, z, p) {
  if (y < -64 || y > 319) return;
  if (p === AIR || p.type.id === "minecraft:air") cells.delete(K(x, y, z)); else cells.set(K(x, y, z), p);
  changed.add(K(x, y, z));
}
let dim;
class Blk {
  constructor(x, y, z) { this.x = x; this.y = y; this.z = z; this.location = { x, y, z }; this.dimension = dim; }
  get permutation() { return permAt(this.x, this.y, this.z); }
  get typeId() { return this.permutation.type.id; }
  get type() { return this.permutation.type; }
  get isAir() { return this.typeId === "minecraft:air"; }
  get isLiquid() { return /water|lava/.test(this.typeId); }
  get isValid() { return true; }
  get isWaterlogged() { return false; }
  setPermutation(p) { if (!(p instanceof Perm)) throw new Error("not a permutation"); setAt(this.x, this.y, this.z, p); }
  setType(t) { setAt(this.x, this.y, this.z, resolvePerm(typeof t === "string" ? t : t.id)); }
  setWaterlogged() {}
  below(n = 1) { return new Blk(this.x, this.y - n, this.z); }
  above(n = 1) { return new Blk(this.x, this.y + n, this.z); }
  north(n = 1) { return new Blk(this.x, this.y, this.z - n); }
  south(n = 1) { return new Blk(this.x, this.y, this.z + n); }
  east(n = 1) { return new Blk(this.x + n, this.y, this.z); }
  west(n = 1) { return new Blk(this.x - n, this.y, this.z); }
  offset(o) { return new Blk(this.x + o.x, this.y + o.y, this.z + o.z); }
  center() { return { x: this.x + 0.5, y: this.y + 0.5, z: this.z + 0.5 }; }
  bottomCenter() { return { x: this.x + 0.5, y: this.y, z: this.z + 0.5 }; }
  getComponent() { return undefined; }
  getTags() { return []; }
  hasTag() { return false; }
  matches(id, st) { return this.permutation.matches(id, st); }
  canPlace() { return true; }
  isSolid() { return !/air|water|lava/.test(this.typeId); }
  getRedstonePower() { return 0; }
  getItemStack() { return undefined; }
}
const realDim = world.getDimension("overworld");
dim = Object.assign(realDim, {
  id: "minecraft:overworld",
  heightRange: { min: -64, max: 320 },
  getBlock: (l) => new Blk(Math.floor(l.x), Math.floor(l.y), Math.floor(l.z)),
  getTopmostBlock: (l, min) => {
    const x = Math.floor(l.x), z = Math.floor(l.z);
    for (let y = 250; y >= (min ?? -64); y--) if (permAt(x, y, z).type.id !== "minecraft:air") return new Blk(x, y, z);
    return undefined;
  },
  fillBlocks(vol, perm, opts = {}) {
    const p = typeof perm === "string" ? resolvePerm(perm) : perm;
    const ex = new Set(opts?.blockFilter?.excludeTypes ?? []);
    const a = vol.from ?? vol.min ?? vol.__from, b = vol.to ?? vol.max ?? vol.__to;
    for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++)
      for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y++)
        for (let z = Math.min(a.z, b.z); z <= Math.max(a.z, b.z); z++) if (!ex.has(permAt(x, y, z).type.id)) setAt(x, y, z, p);
    return { getCapacity: () => 0 };
  },
  runCommand(cmd) {
    const verb = String(cmd).split(" ")[0];
    notes.commands.set(verb, (notes.commands.get(verb) ?? 0) + 1);
    const m = /^(?:setblock) (-?\d+) (-?\d+) (-?\d+) (\S+)/.exec(cmd);
    if (m) { try { setAt(+m[1], +m[2], +m[3], resolvePerm(m[4])); } catch { /* bad id */ } }
    const f = /^fill (-?\d+) (-?\d+) (-?\d+) (-?\d+) (-?\d+) (-?\d+) (\S+)/.exec(cmd);
    if (f) { try { dim.fillBlocks({ from: { x: +f[1], y: +f[2], z: +f[3] }, to: { x: +f[4], y: +f[5], z: +f[6] } }, resolvePerm(f[7])); } catch { /* bad id */ } }
    if (/^structure load/.test(cmd)) notes.structures.push(cmd);
    return { successCount: 1 };
  },
  runCommandAsync(cmd) { return Promise.resolve(this.runCommand(cmd)); },
  getEntities: () => [],
  getEntitiesAtBlockLocation: () => [],
  getPlayers: () => [player],
  spawnEntity: (t, l) => mkEntity(t, l),
  spawnItem: () => ({}),
  spawnParticle() {},
  playSound() {},
  setWeather() {},
  isChunkLoaded: () => true,
});
class BlockVolume { constructor(from, to) { this.from = from; this.to = to; } getCapacity() { return 0; } }

// ---------------------------------------------------------------- time and the player
const timers = [];
const jobs = [];
let abs = 1 * 24000 + 1000;
world.getDay = () => Math.floor(abs / 24000);
world.getTimeOfDay = () => abs % 24000;
world.getAbsoluteTime = () => abs;
system.run = (fn) => { timers.push({ at: system.currentTick, fn }); return timers.length; };
system.runTimeout = (fn, t = 1) => { timers.push({ at: system.currentTick + Math.max(1, t), fn }); return timers.length; };
system.runJob = (gen) => { jobs.push(gen); return jobs.length; };
const entities = [];
let eid = 1;
function mkEntity(typeId, location) {
  const e = { id: `e${eid++}`, typeId, location: { ...location }, dimension: dim, isValid: true, nameTag: "", tags: new Set(),
    addEffect() {}, removeEffect() {}, getComponent: () => undefined, remove() { this.isValid = false; },
    hasTag(t) { return this.tags.has(t); }, addTag(t) { this.tags.add(t); }, removeTag(t) { this.tags.delete(t); }, getTags() { return [...this.tags]; },
    teleport(l) { this.location = { ...l }; }, triggerEvent() {}, setProperty() {}, getProperty() {}, getDynamicProperty() {}, setDynamicProperty() {},
    playAnimation() {}, setRotation() {}, getRotation: () => ({ x: 0, y: 0 }), lookAt() {}, applyImpulse() {}, clearVelocity() {} };
  entities.push(e);
  return e;
}
// the Plot Stone: baked into the map, or (a fresh map) set by the game on the ground at the plot's spot
let stone = FLAT ? [0, 65, 0] : meta.stone;
if (!stone) {
  let y = 250;
  while (y > by0 && !/grass_block|dirt|sand|stone|snow|mud|gravel|terracotta|podzol|moss|path|slab|planks|bricks|cobble/.test(permAt(meta.x, y, meta.z).type.id)) y--;
  stone = [meta.x, y + 1, meta.z];
  cells.set(K(stone[0], stone[1], stone[2]), resolvePerm("siege:plot_stone"));
}
const player = { id: "-4294967295", name: "Mateo", typeId: "minecraft:player", location: { x: stone[0] + 0.5, y: stone[1] + 1, z: stone[2] + 3.5 }, dimension: dim, isValid: true, tags: new Set(),
  sendMessage() {}, playSound() {}, addEffect() {}, addExperience() {}, applyKnockback() {}, teleport(l) { this.location = { ...l }; }, setSpawnPoint() {},
  onScreenDisplay: { setTitle() {}, setActionBar() {}, updateSubtitle() {} },
  hasTag(t) { return this.tags.has(t); }, addTag(t) { this.tags.add(t); }, removeTag(t) { this.tags.delete(t); }, getTags() { return [...this.tags]; },
  getDynamicProperty() {}, setDynamicProperty() {}, runCommand() { return { successCount: 1 }; }, runCommandAsync() { return Promise.resolve({ successCount: 1 }); },
  getGameMode: () => "Creative", getRotation: () => ({ x: 0, y: 0 }), getViewDirection: () => ({ x: 0, y: 0, z: 1 }),
  getComponent: (id) => (/inventory/.test(id) ? { container: { size: 36, emptySlotsCount: 36, addItem() {}, getItem() {}, setItem() {} } } : undefined),
  getBlockFromViewDirection: () => undefined, isSneaking: false };
world.getPlayers = () => [player];
world.getAllPlayers = () => [player];
world.getEntity = (id) => (id === player.id ? player : entities.find((e) => e.id === id));

// ---------------------------------------------------------------- load the add-on
const mcNames = new Set();
for (const f of walk(SCRIPTS, ".js")) {
  for (const m of readFileSync(f, "utf8").matchAll(/import\s+\{([^}]*)\}\s+from\s+["'](@minecraft\/[^"']+)["']/g)) {
    for (const n of m[1].split(",").map((s) => s.trim().split(/\s+as\s+/)[0]).filter(Boolean)) mcNames.add(n);
  }
}
const names = [...mcNames];
const overrides = { BlockPermutation, BlockVolume };
const lookup0 = mock.lookup;
mock.lookup = (n) => (n in overrides ? overrides[n] : lookup0(n));
const hooks = `export async function resolve(s,c,n){ if(s.startsWith("@minecraft/")) return {url:"mock:"+s, shortCircuit:true}; return n(s,c);}
export async function load(u,c,n){ if(!u.startsWith("mock:")) return n(u,c); const names=${JSON.stringify(names)}; return {format:"module", shortCircuit:true, source:names.map(n=>"export const "+n+" = globalThis.__mc.lookup("+JSON.stringify(n)+");").join("\\n")}; }`;
register("data:text/javascript," + encodeURIComponent(hooks), import.meta.url);
const realWarn = console.warn, realLog = console.log;
console.warn = (...a) => notes.warns.push(a.join(" "));
console.log = (...a) => notes.warns.push(a.join(" "));
await import(pathToFileURL(join(SCRIPTS, "main.js")).href);
mock.endEarly();
const api = await import(pathToFileURL(join(SCRIPTS, "siege/api.js")).href);
const { PLOT_PLAN } = await import(pathToFileURL(join(SCRIPTS, "plots/config.js")).href);

function step() {
  abs += 1;
  mock.advance(1);
  for (const t of timers.splice(0).filter((t) => (t.at <= system.currentTick ? (safe(t.fn), false) : true))) timers.push(t);
  for (const i of mock.intervals) if (system.currentTick % i.ticks === 0) safe(i.fn);
  for (let j = jobs.length - 1; j >= 0; j--) {
    let n = 0;
    try {
      while (n++ < 400) { const r = jobs[j].next(); if (r.done) { jobs.splice(j, 1); break; } }
    } catch (e) { notes.warns.push(`job threw: ${e?.stack ?? e}`); jobs.splice(j, 1); }
  }
}
function safe(fn) { try { fn(); } catch (e) { notes.warns.push(`threw: ${e?.stack ?? e}`); } }

// the world is ready (the add-on waits for it), then the player picks the plot
for (const s of mock.subscriptions) if (/worldLoad|worldInitialize/.test(s.path)) safe(() => s.fn({}));
for (let i = 0; i < 40; i++) step();
const placed = [];
if (FLAT) {
  const { startBuild } = await import(pathToFileURL(join(SCRIPTS, "townhall/build.js")).href);
  const { drawBuilding, styleFor, BUILDING } = await import(pathToFileURL(join(SCRIPTS, "settle/buildings.js")).href);
  const { drawHall } = await import(pathToFileURL(join(SCRIPTS, "townhall/halls.js")).href);
  const { STYLES } = await import(pathToFileURL(join(SCRIPTS, "townhall/styles.js")).href);
  const todo = [];
  for (const id of Object.keys(BUILDING)) todo.push({ id, plan: () => drawBuilding(id, FLAT_STYLE), style: () => styleFor(FLAT_STYLE) });
  for (let level = 1; level <= 5; level++) todo.push({ id: `hall_${level}`, plan: () => drawHall(level, STYLES[FLAT_STYLE]), style: () => STYLES[FLAT_STYLE] });
  let gx = 0, gz = 0, rowDeep = 0;
  for (const t of todo) {
    let plan, style;
    try { plan = t.plan(); style = t.style(); } catch (e) { notes.warns.push(`${t.id}: can't draw (${e})`); continue; }
    if (!plan?.cells?.size) { notes.warns.push(`${t.id}: empty plan`); continue; }
    const b = plan.bounds();
    const w = b.x1 - b.x0 + 1, d = b.z1 - b.z0 + 1;
    if (gx + w + 8 > 600) { gx = 0; gz += rowDeep + 10; rowDeep = 0; }
    // forward south (+z): local x runs west (R = -F.z, F.x) ... place so the build's box starts at (gx, gz)
    const origin = { x: gx + 4 + b.x1, y: 65, z: gz + 4 - b.z0 };
    rowDeep = Math.max(rowDeep, d + 4);
    gx += w + 10;
    try {
      startBuild({ id: `sim:${t.id}`, dimensionId: "minecraft:overworld", origin, forward: { x: 0, z: 1 }, plan, style, perTick: 4000 });
      placed.push({ id: t.id, origin, box: [origin.x - b.x1, origin.z + b.z0, origin.x - b.x0, origin.z + b.z1], y1: 65 + b.y1 });
    } catch (e) { notes.warns.push(`${t.id}: ${e}`); }
  }
} else {
  const plan = PLOT_PLAN.find((p) => p.name === meta.name);
  const plot = { ...plan, y: stone[1] };
  api.emit("plotChosen", { player, plot });
}
let last = -1, quiet = 0, t = 0;
for (; t < TICKS; t++) {
  step();
  if (t % 200 === 0) {
    if (changed.size === last) { if (++quiet >= 6) break; } else quiet = 0;
    last = changed.size;
  }
}
console.warn = realWarn; console.log = realLog;

// ---------------------------------------------------------------- write it out (blocks in the plot's box)
const pal = [], pidx = new Map(), outXYZ = [], outPid = [];
if (FLAT) {   // the field itself, round each building (the world above leaves it implicit)
  for (const b of placed) for (let x = b.box[0] - 6; x <= b.box[2] + 6; x++) for (let z = b.box[1] - 6; z <= b.box[3] + 6; z++)
    for (let y = 61; y <= 64; y++) { const k = K(x, y, z); if (!cells.has(k) && !changed.has(k)) cells.set(k, permAt(x, y, z)); }
}
for (const [k, p] of cells) {
  const [x, y, z] = k.split(",").map(Number);
  if (!inBox(x, z) || y < by0) continue;
  const key = p.type.id + JSON.stringify(p._st);
  if (!pidx.has(key)) { pidx.set(key, pal.length); pal.push([p.type.id, p._st]); }
  outXYZ.push(x, y, z); outPid.push(pidx.get(key));
}
const town = FLAT ? null : (await import(pathToFileURL(join(SCRIPTS, "settle/founding.js")).href)).townOf(player.id);
// the wall's own line (a Hamlet's is drawn tight round the village): its radius at 72 angles, for the audit's streets
const wallLine = await (async () => {
  if (!town) return undefined;
  const W = await import(pathToFileURL(join(SCRIPTS, "settle/walls.js")).href), D = await import(pathToFileURL(join(SCRIPTS, "settle/walldata.js")).href);
  const w = W.wallOf(player.id);
  return w?.radius ? Array.from({ length: 72 }, (_, i) => Math.round(D.radiusAt(w, w.radius, (i / 72) * Math.PI * 2) * 10) / 10) : undefined;
})();
const wallR = town ? (await import(pathToFileURL(join(SCRIPTS, "settle/towns.js")).href)).wallRadius((await import(pathToFileURL(join(SCRIPTS, "settle/towns.js")).href)).townFor(town.plot), town.tier ?? 0) : undefined;
const out = {
  meta: { ...meta, kind: FLAT ? "buildings" : "hamlet", placed, name: meta.name, sq: town ? [town.x, town.z - 8] : [meta.x, meta.z], sqy: town?.y, wall: wallR, wall_line: wallLine, town: town ? { x: town.x, y: town.y, z: town.z, layout: town.layout, style: town.style, tier: town.tier, slots: town.slots } : null,
    ticks: t, changed: changed.size },
  pal,
  xyz: Buffer.from(new Int32Array(outXYZ).buffer).toString("base64"),
  pid: Buffer.from(new Int32Array(outPid).buffer).toString("base64"),
  notes: { unknownIds: Object.fromEntries(notes.unknownIds), unknownStates: Object.fromEntries(notes.unknownStates), commands: Object.fromEntries(notes.commands),
    structures: notes.structures.slice(0, 50), warns: [...new Set(notes.warns)].slice(0, 80) },
};
writeFileSync(OUT, JSON.stringify(out));
realLog(`${meta.name}: ${t} ticks, ${changed.size} blocks changed, town ${town ? `at ${town.x},${town.y},${town.z} (${town.style})` : "NOT founded"}; unknown ids ${notes.unknownIds.size}, warnings ${notes.warns.length}`);
process.exit(0);
