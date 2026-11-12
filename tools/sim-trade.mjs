// Run from the repo root: node tools/sim-trade.mjs
// Trade Outposts in a fake world: two players' Outposts (one online beside real barrels, one offline), a route
// between them run for days, a short crate pausing it, Kingsrest buying iron for Regals, a Rival Lord answering,
// and the works' Supply Line. Prints a log and ends with "SIM OK" or the problems.
import { register } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPTS = join(ROOT, "Siege_Nights_BP/scripts");
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
let seed = 12345;
Math.random = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648); // the same run every time
const mock = makeMock(pack);
globalThis.__mc = mock;
globalThis.__siegeOffline = true;
const world = mock.lookup("world"), system = mock.lookup("system");
const ItemStack = mock.lookup("ItemStack");

let abs = 5 * 24000 + 1000;
const timers = [];
world.getDay = () => Math.floor(abs / 24000);
world.getTimeOfDay = () => abs % 24000;
world.getAbsoluteTime = () => abs;
system.run = (fn) => { timers.push({ at: system.currentTick, fn }); return 1; };
system.runTimeout = (fn, t = 1) => { timers.push({ at: system.currentTick + t, fn }); return 1; };

const log = [];
const say = (kind, text) => log.push(`d${world.getDay()} ${String(abs % 24000).padStart(5)}  ${kind.padEnd(5)} ${String(text).replace(/§./g, "")}`);
const dim = world.getDimension("overworld");

// Every stretch of line is laid
const { ROUTES } = await import(pathToFileURL(join(SCRIPTS, "trains/routes_data.js")).href);
world.setDynamicProperty("siege:routes", JSON.stringify({ built: Object.fromEntries(ROUTES.segments.map((s) => [s.id, { by: "p1", at: 0 }])), laying: [], missed: {}, missedWorks: {}, _v: 1 }));
const stop = (id) => ROUTES.stops.find((s) => s.id === id);

// Two barrels beside player 1's Trade Board; everything else is unloaded
class Container {
  constructor() { this.size = 27; this.slots = new Array(27).fill(undefined); }
  getItem(i) { return this.slots[i]; }
  setItem(i, it) { this.slots[i] = it; }
  addItem(it) {
    let n = it.amount;
    for (let i = 0; i < 27 && n > 0; i++) { const s = this.slots[i]; if (s && s.typeId === it.typeId && s.amount < 64) { const k = Math.min(64 - s.amount, n); s.amount += k; n -= k; } }
    for (let i = 0; i < 27 && n > 0; i++) if (!this.slots[i]) { const k = Math.min(64, n); this.slots[i] = new ItemStack(it.typeId, k); n -= k; }
    return n > 0 ? new ItemStack(it.typeId, n) : undefined;
  }
  count(id) { return this.slots.reduce((s, it) => s + (it?.typeId === id ? it.amount : 0), 0); }
}
const g = stop("gullcliff");
const P1 = { board: { x: g.x + 3, y: 70, z: g.z + 8 }, exports: { x: g.x + 1, y: 70, z: g.z + 8 }, imports: { x: g.x + 5, y: 70, z: g.z + 8 } };
const barrels = { [`${P1.exports.x},${P1.exports.z}`]: new Container(), [`${P1.imports.x},${P1.imports.z}`]: new Container() };
const exBarrel = barrels[`${P1.exports.x},${P1.exports.z}`], imBarrel = barrels[`${P1.imports.x},${P1.imports.z}`];
const banners = new Set();
dim.getBlock = (l) => {
  if (banners.has(`${l.x},${l.y},${l.z}`)) return { location: l, dimension: dim, typeId: "siege:keep_banner", isValid: true, getComponent: () => undefined, setPermutation() {} };
  const c = barrels[`${l.x},${l.z}`];
  if (c && l.y === 70) return { location: l, dimension: dim, typeId: "minecraft:barrel", isValid: true, getComponent: () => ({ container: c }), setPermutation() {} };
  if (Math.hypot(l.x - g.x, l.z - g.z) < 30) return { location: l, dimension: dim, typeId: "minecraft:air", isValid: true, getComponent: () => undefined, setPermutation() {} };
  return undefined;
};

const player = { id: "p1", name: "Mateo", typeId: "minecraft:player", location: { x: P1.board.x, y: 70, z: P1.board.z - 2 }, dimension: dim, isValid: true, tags: new Set(),
  sendMessage: (t) => say("chat", t), playSound() {}, onScreenDisplay: { setTitle() {}, setActionBar: (t) => say("bar", t) },
  hasTag(t) { return this.tags.has(t); }, addTag(t) { this.tags.add(t); }, removeTag(t) { this.tags.delete(t); }, getTags() { return [...this.tags]; }, getDynamicProperty() {}, setDynamicProperty() {},
  getGameMode: () => "Creative", getComponent: () => ({ getEquipment() {}, container: { size: 0, getItem() {}, setItem() {}, addItem() {}, emptySlotsCount: 36 } }) };
world.getPlayers = () => [player];
world.getAllPlayers = () => [player];
dim.getPlayers = () => [player];
dim.getEntities = () => [];
dim.spawnEntity = () => ({ addTag() {}, remove() {} });

// load the add-on
const mcNames = {};
for (const f of walk(SCRIPTS, ".js")) {
  for (const m of readFileSync(f, "utf8").matchAll(/import\s+\{([^}]*)\}\s+from\s+["'](@minecraft\/[^"']+)["']/g)) {
    (mcNames[m[2]] ??= new Set());
    for (const n of m[1].split(",").map((s) => s.trim().split(/\s+as\s+/)[0]).filter(Boolean)) mcNames[m[2]].add(n);
  }
}
const names = [...new Set(Object.values(mcNames).flatMap((s) => [...s]))];
const hooks = `export async function resolve(s,c,n){ if(s.startsWith("@minecraft/")) return {url:"mock:"+s, shortCircuit:true}; return n(s,c);}
export async function load(u,c,n){ if(!u.startsWith("mock:")) return n(u,c); const names=${JSON.stringify(names)}; return {format:"module", shortCircuit:true, source:names.map(n=>"export const "+n+" = globalThis.__mc.lookup("+JSON.stringify(n)+");").join("\\n")}; }`;
register("data:text/javascript," + encodeURIComponent(hooks), import.meta.url);
const warned = [];
console.warn = (...a) => warned.push(a.join(" "));
await import(pathToFileURL(join(SCRIPTS, "main.js")).href);
const api = await import(pathToFileURL(join(SCRIPTS, "siege/api.js")).href);
const T = await import(pathToFileURL(join(SCRIPTS, "trade/index.js")).href);
const rivals = await import(pathToFileURL(join(SCRIPTS, "rivals/index.js")).href);
const { makeLord } = await import(pathToFileURL(join(SCRIPTS, "rivals/data.js")).href);

const STEP = 20;
function step(n = 1) {
  for (let k = 0; k < n; k++) {
    abs += STEP;
    mock.advance(STEP);
    for (const t of timers.splice(0).filter((t) => (t.at <= system.currentTick ? (t.fn(), false) : true))) timers.push(t);
    for (const i of mock.intervals) if (system.currentTick % i.ticks === 0) i.fn();
  }
}
const hours = (h) => step(Math.ceil((h * 1000) / STEP));
const problems = [];
const check = (ok, what) => { if (!ok) problems.push(what); else say("ok", what); };
const section = (name) => log.push(`\n=== ${name}`);
const IRON = "minecraft:iron_ingot", GOLD = "minecraft:gold_ingot", COIN = "siege:coin";

step();
const st = api.getState();
const r = stop("redmesa");
st.keeps.p1 = { x: g.x + 20, y: 70, z: g.z + 20, name: "Mateo", color: 14, wins: 3, allies: [] };
st.keeps.p2 = { x: r.x + 20, y: 70, z: r.z + 20, name: "Friend", color: 11, wins: 3, allies: [] };
for (const k of [st.keeps.p1, st.keeps.p2]) banners.add(`${k.x},${k.y},${k.z}`);
const S = T.S_ACCESS();
S.outposts["p:p1"] = { owner: "p1", wagons: 0, dim: "minecraft:overworld", ...P1, stage: "station", ex: {}, im: {}, exSnap: {}, imSnap: {} };
S.outposts["p:p2"] = { owner: "p2", wagons: 0, dim: "minecraft:overworld", board: { x: r.x, y: 70, z: r.z }, exports: { x: r.x + 1, y: 70, z: r.z }, imports: { x: r.x + 2, y: 70, z: r.z }, stage: "station", ex: { [GOLD]: 10 }, im: {}, exSnap: { [GOLD]: 10 }, imSnap: {} };
exBarrel.addItem(new ItemStack(IRON, 400));
exBarrel.addItem(new ItemStack(COIN, 300));

section("the board sees the barrels");
step(41);
check(S.outposts["p:p1"].ex[IRON] === 400 && S.outposts["p:p1"].ex[COIN] === 300, "player 1's Exports ledger matches the barrel");
const partners = T.partnersOf("p:p1").map((p) => p.party);
check(partners.includes("p:p2") && partners.includes(T.CAPITAL), `partners: ${partners.join(", ")}`);

section("an offer, a counter, an accept");
const offer = T.sendOffer("p:p1", "p:p2", { give: { id: IRON, n: 30 }, get: { id: GOLD, n: 4 }, every: "day", runs: 0 });
check(T.waitingFor("p:p2").length === 1, "player 2 has a request waiting");
T.counterOffer(offer, "p:p2", { id: IRON, n: 30 }, { id: GOLD, n: 3 });
check(T.waitingFor("p:p1").length === 1, "the counter comes back to player 1");
check(T.acceptOffer(offer, "p:p1") === undefined, "player 1 accepts the counter");
check(T.routesOf("p:p1").length === 1, "the route is live");

section("runs while player 2 is away");
hours(2);
const route = T.routesOf("p:p1")[0]; if (!route) { console.log(log.join("\n")); console.log(JSON.stringify(S.routes), JSON.stringify(S.notices), warned.slice(-5)); process.exit(1); }
check(!!route.onLine || route.done === 1, "the first run left");
check(exBarrel.count(IRON) === 370, `iron left the real Exports barrel (${exBarrel.count(IRON)})`);
check(exBarrel.count(COIN) === 300, `no freight taken: the Regals are untouched (${exBarrel.count(COIN)})`);
hours(3);
check(imBarrel.count(GOLD) === 3, `gold arrived in the real Imports barrel (${imBarrel.count(GOLD)})`);
check(S.outposts["p:p2"].im[IRON] === 30 && S.outposts["p:p2"].ex[GOLD] === 7, "player 2's ledgers moved while their station is unloaded");
hours(24 * 3);
check(S.outposts["p:p2"].ex[GOLD] === 1, `player 2 sent gold three more times (${S.outposts["p:p2"].ex[GOLD]})`);
check(route.state === "paused" && route.why?.short === "b", `the route paused on player 2's gold (${route.state})`);
check(T.noticesOf("p:p2").some((n) => /out of gold/.test(n.text)), "player 2 was told");
S.outposts["p:p2"].ex[GOLD] = 20;
hours(3);
check(route.state === "live", "refilled, it runs again");

section("Kingsrest buys iron for Regals");
const k = T.sendOffer("p:p1", T.CAPITAL, { give: { id: IRON, n: 8 }, get: { id: COIN, n: 56 }, every: "day", runs: 2 });
step(5);
check(T.routesOf("p:p1").some((x) => x.b === T.CAPITAL), "the Exchequer accepted at its price");
exBarrel.addItem(new ItemStack(IRON, 64));
const coinsBefore = imBarrel.count(COIN);
hours(24 * 2 + 6);
check(imBarrel.count(COIN) - coinsBefore === 112, `two runs paid 112 Regals into Imports (${imBarrel.count(COIN) - coinsBefore})`);
check(!T.routesOf("p:p1").some((x) => x.b === T.CAPITAL), "the two-run route closed by itself");

section("a Rival Lord answers");
const lords = rivals.rivalLords();
const { PLOT_PLAN } = await import(pathToFileURL(join(SCRIPTS, "plots/config.js")).href);
const plot = PLOT_PLAN.find((p) => p.name === "Dunehold") ?? PLOT_PLAN[0];
const lord = makeLord({ ...plot, y: 64 }, "sim", []);
lord.temperament = "kindly"; lord.tier = 1;
lords.push(lord);
S.outposts["p:p1"].stage = "grand";
T.sendOffer("p:p1", `l:${lord.id}`, { give: { id: IRON, n: 20 }, get: { id: GOLD, n: 6 }, every: "day", runs: 0 });
hours(4);
const answered = T.routesOf("p:p1").some((x) => x.b === `l:${lord.id}`) || T.waitingFor("p:p1").length > 0 || T.noticesOf("p:p1").some((n) => /turned down/.test(n.text));
check(answered, `${lord.name} (${lord.region}, ${lord.temperament}) answered`);

section("the works' Supply Line");
const need = T.routesOf("p:p1").reduce((n, x) => n + (x.a === "p:p1" && x.give.id === IRON ? x.give.n : x.b === "p:p1" && x.get.id === IRON ? x.get.n : 0), 0);
const have = S.outposts["p:p1"].ex[IRON] ?? 0;
const took = T.supplyExports("p1", IRON, 500);
check(took === Math.max(0, Math.min(500, need * 3 - have)), `the Outpost took ${took} of 500 iron (routes need ${need} a run, ${have} in store)`);
S.outposts["p:p1"].ex[IRON] = 0;
const took2 = T.supplyExports("p1", IRON, 500);
check(took2 === need * 3 && took2 > 0, `with Exports empty it took ${took2}: three runs' worth`);
step(41);
check(exBarrel.count(IRON) >= took2, `the supplied iron reached the real barrel (${exBarrel.count(IRON)})`);
check(T.supplyExports("nobody", IRON, 10) === 0, "no Outpost, nothing taken");

console.log(log.join("\n"));
if (warned.some((w) => /trade/i.test(w))) problems.push(...warned.filter((w) => /trade/i.test(w)));
console.log(problems.length ? `\n${problems.length} PROBLEM(S):\n - ${problems.join("\n - ")}` : "\nSIM OK");
process.exit(problems.length ? 1 : 0);
