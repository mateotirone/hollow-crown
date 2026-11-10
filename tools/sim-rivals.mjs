// Run from the repo root: node tools/sim-rivals.mjs
// Three Rival Lords and one player in a fake world: every kind of deed, a march through a real siege night, a feud, the menu.
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
  } catch { /* not ours to check */ }
}
const mock = makeMock(pack);
globalThis.__mc = mock;
globalThis.__siegeOffline = true;
const world = mock.lookup("world"), system = mock.lookup("system");

// ----- a tiny world -----
let abs = 5 * 24000 + 6000; // absolute time; day = floor(abs / 24000), time of day = abs % 24000
const timers = [];
world.getDay = () => Math.floor(abs / 24000);
world.getTimeOfDay = () => abs % 24000;
world.getAbsoluteTime = () => abs;
world.setTimeOfDay = (t) => { abs = Math.floor(abs / 24000) * 24000 + t; };
system.run = (fn) => { timers.push({ at: system.currentTick, fn }); return 1; };
system.runTimeout = (fn, t = 1) => { timers.push({ at: system.currentTick + t, fn }); return 1; };

const log = [];
const clock = () => { const m = Math.floor((((abs % 24000) + 6000) % 24000) / 1000 * 60); return `d${world.getDay()} ${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; };
const say = (kind, text) => log.push(`${clock()}  ${kind.padEnd(6)} ${String(text).replace(/§./g, "")}`);
const entities = [];
const dim = world.getDimension("overworld");
let eid = 1;
function mkEntity(typeId, location) {
  const e = { id: `e${eid++}`, typeId, location: { ...location }, dimension: dim, isValid: true, nameTag: "", tags: new Set(), effects: {},
    addEffect(n, d, o) { this.effects[n] = o?.amplifier ?? 0; }, removeEffect() {},
    getComponent: () => ({ currentValue: 300, effectiveMax: 400, setCurrentValue() {} }),
    remove() { this.isValid = false; const i = entities.indexOf(this); if (i >= 0) entities.splice(i, 1); },
    hasTag(t) { return this.tags.has(t); }, addTag(t) { this.tags.add(t); }, removeTag(t) { this.tags.delete(t); }, getTags() { return [...this.tags]; },
    applyImpulse() {}, applyKnockback() {}, teleport() {}, triggerEvent() {}, setProperty() {}, getProperty() {}, getDynamicProperty() {}, setDynamicProperty() {}, playAnimation() {} };
  entities.push(e);
  return e;
}
const player = { id: "p1", name: "Mateo", typeId: "minecraft:player", location: { x: 2, y: 65, z: 2 }, dimension: dim, isValid: true, tags: new Set(),
  sendMessage: (t) => say("chat", t), playSound() {}, addEffect(n) { say("effect", n); }, addExperience() {}, applyKnockback() {},
  onScreenDisplay: { setTitle: (t, o) => say("TITLE", `${t}${o?.subtitle ? " / " + o.subtitle : ""}`), setActionBar: (t) => { if (!/Raiders remaining/.test(t)) say("bar", t); } },
  hasTag(t) { return this.tags.has(t); }, addTag(t) { this.tags.add(t); }, getTags() { return [...this.tags]; }, getDynamicProperty() {}, setDynamicProperty() {},
  getGameMode: () => "Survival", getComponent: () => undefined };
world.getPlayers = () => [player];
world.getAllPlayers = () => [player];
dim.getPlayers = () => [player];
dim.getBlock = (l) => ({ location: l, typeId: l.x === 0 && l.z === 0 && l.y === 64 ? "siege:keep_banner" : "minecraft:air", isValid: true });
dim.getTopmostBlock = ({ x, z }) => ({ location: { x, y: 63, z }, x, y: 63, z, isLiquid: false, typeId: "minecraft:grass_block" });
dim.spawnEntity = (t, l) => mkEntity(t, l);
dim.spawnItem = (stack) => say("loot", `${stack.amount} x ${stack.typeId}`);
dim.setWeather = () => {};
dim.getEntities = (q = {}) => entities.filter((e) => (!q.type || e.typeId === q.type) && (!q.tags || q.tags.every((t) => e.tags.has(t))) && !q.families);

// ----- load the add-on's scripts -----
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
const realWarn = console.warn;
const warned = [];
console.warn = (...a) => warned.push(a.join(" "));
await import(pathToFileURL(join(SCRIPTS, "main.js")).href);
const api = await import(pathToFileURL(join(SCRIPTS, "siege/api.js")).href);

const scriptEvent = (message) => { for (const s of mock.subscriptions) if (s.path === "system.afterEvents.scriptEventReceive") s.fn({ id: "siege:rivals", message, sourceEntity: player }); };
const rivals = await import(pathToFileURL(join(SCRIPTS, "rivals/index.js")).href);
const { makeLord } = await import(pathToFileURL(join(SCRIPTS, "rivals/data.js")).href);
const { PLOT_PLAN } = await import(pathToFileURL(join(SCRIPTS, "plots/config.js")).href);
const { applyFilter } = await import(pathToFileURL(join(SCRIPTS, "core/events.js")).href);

const STEP = 20;
let kill = () => false;
function step() {
  abs += STEP;
  mock.advance(STEP);
  for (const t of timers.splice(0).filter((t) => (t.at <= system.currentTick ? (t.fn(), false) : true))) timers.push(t);
  for (const i of mock.intervals) if (system.currentTick % i.ticks === 0) i.fn();
  for (const e of [...entities]) if (e.tags.has(api.RAIDER_TAG) && kill(e)) e.remove();
}
const flush = async () => { for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r)); };
const problems = [];
const check = (ok, what) => { if (!ok) problems.push(what); };
const section = (name) => log.push(`\n=== ${name}`);

// a player in Creative (so prices are waived and the fake inventory is never asked), with a keep
player.getGameMode = () => mock.lookup("GameMode").Creative;
player.removeTag = () => {};
player.getComponent = () => ({ getEquipment() {}, container: { size: 0, getItem() {}, setItem() {}, addItem() {}, emptySlotsCount: 36 } });
step();
const st = api.getState();
st.keeps.p1 = { x: 0, y: 64, z: 0, name: "Mateo", color: 14, sieges: 6, wins: 4, streak: 2 };
const lords = rivals.rivalLords();
for (let i = 0; i < 3; i++) lords.push(makeLord({ ...PLOT_PLAN[i], y: 64 }, "sim", lords.map((l) => l.name)));
lords[0].tier = 2; lords[0].wins = 7;
const [a, b, c] = lords;
const menu = (lord) => applyFilter("rivalMenu", [], { lord, player });
const press = async (lord, start) => { const btn = menu(lord).find((x) => x.label.startsWith(start)); check(!!btn, `no "${start}" button for ${lord.id}`); await btn?.action(); await flush(); };
api.on("siegeEnd", ({ outcome }) => say("END", outcome));

section("two months of deeds");
const kinds = [];
api.on("rivalDeed", ({ lord, kind }) => { kinds.push(kind); say("DEED", `${lord.name}: ${kind}`); });
for (let d = 0; d < 60; d++) {
  const day = world.getDay();
  while (world.getDay() === day) { world.setTimeOfDay(6000); abs += 24000 - 6000 - 200; for (let n = 0; n < 12; n++) step(); } // hop a day, skipping the nights
  for (const l of lords) if (l.march) { l.lastManner = l.march.manner; delete l.march; } // wars are tested below
}
check(kinds.length >= 20, `only ${kinds.length} deeds in 30 days`);
check(new Set(kinds).size >= 5, `only saw ${[...new Set(kinds)].join(", ")}`);
for (const l of lords) { delete l.demands; delete l.offers; delete l.peace; delete l.grudge; delete l.pacts; l.relations = {}; }

section("a march, beaten off");
scriptEvent(`deed march ${a.id}`);
check(a.march?.target === "p1" && a.march.state === "declared", "the march was not declared");
check(menu(a).some((x) => x.label.startsWith("Pay them to turn back")), "no buy-off button");
world.setTimeOfDay(13000);
api.startSiege();
check(a.march?.state === "marching" && st.plans.p1?.rival === a.id, "the march did not join the siege plan");
kill = () => false;
let host = 0;
for (let n = 0; n < 900 && st.active; n++) {
  step();
  host = Math.max(host, entities.filter((e) => /Man-at-arms|Captain/.test(e.nameTag)).length);
  if (st.assaultsLeft === 0) kill = () => true;
}
say("sim", `the lord's own soldiers on the field: ${host}`);
check(host >= 3, `only ${host} of the lord's soldiers came`);
check(!a.march && (a.peace?.p1 ?? -1) >= world.getDay() && a.routs === 1, "beating the march off left nothing behind");

section("a march, bought off");
delete a.peace; a.lastDeed = undefined;
scriptEvent(`deed march ${a.id}`);
const second = a.march?.manner;
await press(a, "Pay them to turn back");
check(!a.march && a.peace?.p1 >= world.getDay(), "the buy-off did not end the march");

section("a feud, with the player backing a side");
world.setTimeOfDay(6000);
rivals.rivalData().court.feud = null;
for (const l of lords) delete l.liege;
scriptEvent(`deed feud ${b.id}`);
const feud = rivals.rivalData().court.feud;
check(!!feud, "no feud");
if (feud) {
  const backed = rivals.rivalById(feud.b);
  await press(backed, "Back them against");
  check(rivals.relationOf(backed, "p1") >= 15, "backing won no thanks");
  let ended;
  api.on("rivalFeudEnded", (e) => { ended = e; });
  scriptEvent("feud_end");
  check(ended && (ended.freed ? !ended.winner.liege : ended.loser.liege === ended.winner.id), "the feud left nothing behind");
}

section("tribute, a gift, an oath, trade");
scriptEvent(`deed demand ${c.id}`);
check(!!c.demands?.p1, "no demand");
await press(c, "Refuse the tribute");
check(c.grudge?.p1 && rivals.relationOf(c, "p1") <= -20, "refusing cost nothing");
scriptEvent(`relation ${c.id} 80`);
scriptEvent(`deed pact ${c.id}`);
check(!!c.offers?.p1, "no pact offered");
await press(c, "Swear the");
check(!!c.pacts?.p1, "the oath was not sworn");
scriptEvent(`deed wares ${c.id}`);
check(c.wares?.sell.length === 3, "no wares");
check(menu(c).some((x) => x.label === "Trade") && menu(c).some((x) => x.label === "Gifts and oaths"), "trade or oaths missing from the menu");
check(applyFilter("rivalTalkLines", [], { lord: c, player }).some((t) => /Sworn to you/.test(t)), "the oath is not shown");

section("an ally sends soldiers");
c.pacts.p1 = "alliance";
world.setTimeOfDay(13000); abs += 24000;
api.startSiege();
kill = () => false;
let aid = 0;
for (let n = 0; n < 900 && st.active; n++) { step(); aid = Math.max(aid, entities.filter((e) => /Sworn Sword/.test(e.nameTag)).length); if (st.assaultsLeft === 0) kill = () => true; }
check(aid >= 1, "no sworn swords came");
check(!entities.some((e) => /Sworn Sword/.test(e.nameTag)), "the sworn swords did not go home");

section("breaking an oath by laying siege");
api.emit("rivalBesieged", { lord: c, player });
check(!c.pacts.p1 && rivals.rivalData().court.oaths.p1 === 1, "the oath was not broken");

console.log(log.join("\n"));
for (const w of new Set(warned.filter((w) => /rival/i.test(w)))) console.log("warn:", w);
console.log(problems.length ? `\nPROBLEMS:\n- ${problems.join("\n- ")}` : "\nALL OK");
process.exit(problems.length ? 1 : 0);
