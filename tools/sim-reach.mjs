// Run from the siege-nights folder: node tools/sim-reach.mjs
// Plays siege nights at every stage of the Reach in a fake world (one player, one keep) and prints what happened:
// when the horn sounds, when each wave arrives, who came, and how the Long Night carries past dawn.
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
const reach = await import(pathToFileURL(join(SCRIPTS, "reach/index.js")).href);
const rules = await import(pathToFileURL(join(SCRIPTS, "reach/rules.js")).href);
const scriptEvent = (id, message = "") => { for (const s of mock.subscriptions) if (s.path === "system.afterEvents.scriptEventReceive") s.fn({ id, message, sourceEntity: undefined }); };

// ----- time -----
const STEP = 20;
let kill = () => false; // (raider) => true to have the defenders kill it this step
function step() {
  abs += STEP;
  mock.advance(STEP);
  for (const t of timers.splice(0).filter((t) => (t.at <= system.currentTick ? (t.fn(), false) : true))) timers.push(t);
  for (const i of mock.intervals) if (system.currentTick % i.ticks === 0) i.fn();
  for (const e of [...entities]) {
    if (!e.tags.has(api.RAIDER_TAG) || !kill(e)) continue;
    api.emit("raiderKilled", { entity: e, killer: player, owner: "p1" });
    e.remove();
  }
}
const runUntil = (time, day = world.getDay()) => { while (world.getDay() < day || (world.getDay() === day && world.getTimeOfDay() < time)) step(); };
const raiders = () => entities.filter((e) => e.tags.has(api.RAIDER_TAG));
const census = () => {
  const by = {};
  for (const e of raiders()) by[e.typeId.replace(/^(minecraft|siege):/, "")] = (by[e.typeId.replace(/^(minecraft|siege):/, "")] ?? 0) + 1;
  return Object.entries(by).map(([k, v]) => `${v} ${k}`).join(", ") || "nobody";
};

// one player with a keep that has seen a few sieges
step();
const st = api.getState();
st.keeps.p1 = { x: 0, y: 64, z: 0, name: "Mateo", color: 14, sieges: 6, wins: 4, streak: 2 };
api.on("assaultSpawned", ({ assault, total }) => say("WAVE", `${assault} of ${total}: on the field now: ${census()}`));
api.on("siegeStart", () => say("HORN", `threat ${st.plans.p1?.budget}, ${st.plans.p1?.modifiers.join("+") || "no twists"}${st.plans.p1?.warlord ? ", led by " + st.plans.p1.warlord : ""}`));
api.on("siegeEnd", ({ outcome }) => say("END", outcome));
api.on("reachStage", ({ stage, name }) => say("STAGE", `${stage} ${name}`));
api.on("firstGlimpse", () => say("GLIMPSE", "the first Hollow soldiers walk out"));

const problems = [];
const check = (ok, what) => { if (!ok) problems.push(what); };
function night(label, { killAfter = 300, holdDawn = false } = {}) {
  const from = log.length;
  const day = world.getDay();
  const born = new Map();
  kill = (e) => { if (!born.has(e.id)) born.set(e.id, system.currentTick); return system.currentTick - born.get(e.id) >= killAfter; };
  if (holdDawn) kill = () => false;
  runUntil(23900, day);
  console.log(`\n=== ${label} (day ${day}, stage ${reach.reachData().stage}, Reach ${reach.reachData().reach}, tonight: ${rules.nightKind(day, reach.reachData().stage, { salt: reach.reachData().salt }) ?? "quiet"})`);
  for (const line of log.slice(from)) console.log("  " + line);
  return log.slice(from);
}
const nextDayAt = (kind) => { // run forward to the morning of the next day whose night is `kind`
  for (let i = 0; i < 60; i++) {
    runUntil(1000, world.getDay() + (world.getTimeOfDay() >= 1000 ? 1 : 0));
    if (rules.nightKind(world.getDay(), reach.reachData().stage, { salt: reach.reachData().salt }) === kind) return true;
    kill = () => true;
  }
  return false;
};

// Stage 1: the counted night
check(nextDayAt("counted"), "no counted night found at stage 1");
let lines = night("Stage 1, the third night");
check(lines.filter((l) => l.includes("WAVE")).length === 3, "stage 1 should have 3 waves");
check(lines.some((l) => /03:1[678]  WAVE/.test(l)), "stage 1 last wave should land at 3:17");
check(lines.some((l) => l.includes("END    won")), "stage 1 night should be won");
check(!lines.some((l) => /veinsworn|shardcaster/.test(l)), "no Hollow soldiers at stage 1");

// Stage 2: the first glimpse
scriptEvent("siege:reach_boss", "reeve");
scriptEvent("siege:reach_set", "25");
check(reach.reachData().stage === 2, "one boss and Reach 25 should be stage 2");
check(nextDayAt("counted"), "no counted night at stage 2");
lines = night("Stage 2, the third night: the first glimpse");
check(lines.filter((l) => l.includes("WAVE")).length === 4, "stage 2 should have 4 waves");
check(lines.some((l) => l.includes("GLIMPSE")), "the first glimpse should happen at stage 2");

// Stage 3: a stolen night
for (const b of ["huntsman", "bride"]) scriptEvent("siege:reach_boss", b);
scriptEvent("siege:reach_set", "45");
check(reach.reachData().stage === 3, "three bosses and Reach 45 should be stage 3");
check(nextDayAt("stolen"), "no stolen night at stage 3");
lines = night("Stage 3, a night that is not owed");
check(lines.some((l) => l.includes("HORN")), "a stolen night should have a siege");

// Stage 4
for (const b of ["seneschal", "mother"]) scriptEvent("siege:reach_boss", b);
scriptEvent("siege:reach_set", "70");
check(reach.reachData().stage === 4, "five bosses and Reach 70 should be stage 4");
check(nextDayAt("counted"), "no counted night at stage 4");
lines = night("Stage 4, every night (this one is a third night)");
check(lines.filter((l) => l.includes("WAVE")).length === 5, "stage 4 should have 5 waves");

// Stage 5: the Long Night. First night the defenders can't clear it: it must carry through the day.
scriptEvent("siege:reach_boss", "warlord_king");
scriptEvent("siege:reach_boss", "choir");
check(reach.reachData().stage === 5, "the Choir falling should start the Long Night");
runUntil(1000, world.getDay() + 1);
lines = night("Stage 5, the Long Night: a night the defenders do not break", { holdDawn: true });
check(!lines.some((l) => l.includes("END")), "the Long Night must not end at dawn");
const dayStart = log.length;
kill = () => false;
runUntil(11000, world.getDay() + 1);
check(entities.filter((e) => e.tags.has(api.RAIDER_TAG)).length <= 80, "the field should stay under the cap however long it goes on");
console.log("\n=== The day after: they stay");
for (const line of log.slice(dayStart)) console.log("  " + line);
check(st.active, "the siege should still be running the next day");
check(log.slice(dayStart).filter((l) => l.includes("WAVE")).length >= 2, "daytime tides should keep coming");
const second = log.length;
runUntil(17000); // past the second dusk with nobody beaten
lines = [...log.slice(second), ...night("Stage 5, the second night on top of the first, and this time they are broken", { killAfter: 200 })];
check(lines.some((l) => l.includes("END    won")), "a broken Long Night should end as won");
check(lines.some((l) => l.includes("Dusk again")), "the second dusk should add to the siege already running");

// Rectified
runUntil(15000, world.getDay() + 1);
const before = log.length;
scriptEvent("siege:reach_boss", "morvane");
check(reach.reachData().stage === 6, "Morvane falling should end it");
console.log("\n=== The source is rectified");
for (const line of log.slice(before)) console.log("  " + line);
check(nextDayAt("muster"), "no muster night after the story");
lines = night("Stage 6, the Quiet After: a muster");
check(lines.filter((l) => l.includes("WAVE")).length === 4, "a muster should have 4 waves");
check(!lines.some((l) => /veinsworn|shardcaster|gatebreaker/.test(l)), "no Hollow soldiers after the story");

console.warn = realWarn;
const mine = warned.filter((w) => /reach|siege"|assault/i.test(w));
if (mine.length) console.log("\nwarnings:\n  " + mine.join("\n  "));
console.log(problems.length ? `\n${problems.length} PROBLEM(S):\n - ${problems.join("\n - ")}` : "\nSIM OK");
process.exit(problems.length ? 1 : 0);
