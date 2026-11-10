// Run from anywhere: node tools/sim-horses.mjs
// Drives the horses + rails scripts through a pretend play session with a fake world.
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
const ROOT = "/mnt/project-files/siege-nights";
const { makeMock } = await import(pathToFileURL(ROOT + "/tools/mock-minecraft.mjs"));
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith(".json") ? [p] : []; });
const pack = { blocks: new Set(), items: new Set(), entities: new Set() };
for (const f of walk(ROOT + "/Siege_Nights_BP")) { try { const d = JSON.parse(readFileSync(f, "utf8")); const b = d["minecraft:block"]?.description?.identifier; if (b) pack.blocks.add(b); const i = d["minecraft:item"]?.description?.identifier; if (i) pack.items.add(i); const e = d["minecraft:entity"]?.description?.identifier; if (e) pack.entities.add(e);} catch {} }
const mock = makeMock(pack);
globalThis.__mc = mock;
const world = mock.lookup("world"), system = mock.lookup("system"), ItemStack = mock.lookup("ItemStack");
system.run = (fn) => { fn(); return 1; };
system.runTimeout = (fn) => { fn(); return 1; };
let time = 100000; world.getAbsoluteTime = () => time;

const log = [];
let nextEid = 1;
const blocks = new Map(); // "x,y,z" -> typeId
const entities = [];
const dim = world.getDimension("overworld");
const mkBlock = (loc) => ({ location: loc, dimension: dim, isValid: true, get typeId() { return blocks.get(`${loc.x},${loc.y},${loc.z}`) ?? "minecraft:air"; },
  get isAir() { return this.typeId === "minecraft:air"; }, get isSolid() { return this.typeId !== "minecraft:air"; },
  above() { return mkBlock({ ...loc, y: loc.y + 1 }); }, below() { return mkBlock({ ...loc, y: loc.y - 1 }); },
  setType(t) { blocks.set(`${loc.x},${loc.y},${loc.z}`, t); }, permutation: { getState: () => 1 } });
dim.getBlock = (l) => mkBlock({ x: Math.floor(l.x), y: Math.floor(l.y), z: Math.floor(l.z) });
function mkEntity(typeId, location, extra = {}) {
  const e = { id: `e${nextEid++}`, typeId, location: { ...location }, dimension: dim, isValid: true, nameTag: "", props: {}, dyn: {}, events: [], effects: {}, tags: new Set(), comps: {}, commands: [],
    getDynamicProperty(k) { return this.dyn[k]; }, setDynamicProperty(k, v) { if (v === undefined) delete this.dyn[k]; else this.dyn[k] = v; },
    getProperty(k) { return this.props[k]; }, setProperty(k, v) { this.props[k] = v; }, triggerEvent(n) { this.events.push(n); },
    addEffect(n, d, o) { this.effects[n] = o?.amplifier ?? 0; }, removeEffect() {}, getComponent(n) { return this.comps[n]; },
    remove() { this.isValid = false; entities.splice(entities.indexOf(this), 1); }, teleport(l) { this.location = { ...l }; },
    getRotation: () => ({ x: 0, y: 90 }), setRotation() {}, getViewDirection: () => ({ x: 1, y: 0, z: 0 }), runCommand(c) { this.commands.push(c); },
    hasTag(t) { return this.tags.has(t); }, addTag(t) { this.tags.add(t); }, removeTag(t) { this.tags.delete(t); }, getTags() { return [...this.tags]; }, applyDamage(n) { this.hurt = (this.hurt ?? 0) + n; }, applyKnockback() {}, applyImpulse(v) { this.impulse = v; },
    getVelocity: () => ({ x: 0.4, y: 0, z: 0 }), ...extra };
  entities.push(e); return e;
}
dim.spawnEntity = (t, l) => mkEntity(t, l, t === "siege:steed" ? { comps: { "minecraft:health": { effectiveMax: 30, setCurrentValue() {} } } } : {});
dim.getEntities = (q = {}) => entities.filter((e) => (!q.type || e.typeId === q.type) && (!q.tags || q.tags.every((t) => e.tags.has(t))) && (!q.families || e.family === q.families[0]) && (!q.location || Math.hypot(e.location.x - q.location.x, e.location.z - q.location.z) <= (q.maxDistance ?? 1e9)));

function mkPlayer(id, name) {
  const inv = [];
  const container = { size: 36, getItem: (i) => inv[i], setItem: (i, s) => { inv[i] = s; }, addItem(s) { const i = inv.findIndex((x) => x?.typeId === s.typeId); if (i >= 0) inv[i].amount += s.amount; else { let j = 0; while (inv[j]) j++; inv[j] = s; } } };
  const p = mkEntity("minecraft:player", { x: 0, y: 64, z: 0 }, { id, name, isSneaking: false, selectedSlotIndex: 0, msgs: [], bar: "",
    sendMessage(m) { this.msgs.push(m); log.push(`[${name}] ${m}`); }, playSound() {}, getGameMode: () => p.mode ?? "Survival",
    onScreenDisplay: { setActionBar(t) { p.bar = t; }, setTitle(t, o) { log.push(`[${name}] TITLE ${t} / ${o?.subtitle ?? ""}`); } } });
  p.comps["minecraft:inventory"] = { container };
  p.give = (t, n) => container.addItem(new ItemStack(t, n));
  p.count = (t) => inv.filter((s) => s?.typeId === t).reduce((a, s) => a + s.amount, 0);
  entities.splice(entities.indexOf(p), 1);
  return p;
}
const players = [];
world.getPlayers = () => players; world.getAllPlayers = () => players;

// scripted form answers
const answers = [];
for (const cls of ["ActionFormData", "MessageFormData", "ModalFormData"]) {
  const C = mock.lookup(cls);
  const wrap = (m) => { const orig = C.prototype[m]; C.prototype[m] = function (...a) { (this._b ??= []).push(m === "button" || m === "button1" || m === "button2" ? a[0] : null); (this._all ??= []).push([m, ...a]); return orig.apply(this, a); }; };
  for (const m of ["button", "button1", "button2", "body", "title", "textField", "dropdown"]) if (C.prototype[m]) wrap(m);
  C.prototype.show = function () {
    const labels = (this._b ?? []).filter((x) => x !== null).map((l) => String(l).replace(/§./g, ""));
    const want = answers.shift();
    if (want === undefined) return Promise.resolve({ canceled: true });
    if (cls === "ModalFormData") return Promise.resolve({ canceled: false, formValues: want });
    const idx = typeof want === "number" ? want : labels.findIndex((l) => l.includes(want));
    if (idx < 0) throw new Error(`no button "${want}" in [${labels.join(" | ")}]`);
    return Promise.resolve({ canceled: false, selection: idx });
  };
}

const walkJs = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walkJs(p) : p.endsWith(".js") ? [p] : []; });
const mcNames = [...new Set(walkJs(ROOT + "/Siege_Nights_BP/scripts").flatMap((f) => [...readFileSync(f, "utf8").matchAll(/import\s+\{([^}]*)\}\s+from\s+["']@minecraft\/[^"']+["']/g)].flatMap((m) => m[1].split(",").map((n) => n.trim().split(/\s+as\s+/)[0]).filter(Boolean))))];
const hooks = `export async function resolve(s,c,n){ if(s.startsWith("@minecraft/")) return {url:"mock:"+s, shortCircuit:true}; return n(s,c);} 
export async function load(u,c,n){ if(!u.startsWith("mock:")) return n(u,c); const names=${JSON.stringify(mcNames)}; return {format:"module", shortCircuit:true, source:names.map(n=>"export const "+n+" = globalThis.__mc.lookup("+JSON.stringify(n)+");").join("\\n")}; }`;
register("data:text/javascript," + encodeURIComponent(hooks), import.meta.url);
await import(pathToFileURL(ROOT + "/Siege_Nights_BP/scripts/main.js").href);
const api = await import(pathToFileURL(ROOT + "/Siege_Nights_BP/scripts/siege/api.js").href);
const store = await import(pathToFileURL(ROOT + "/Siege_Nights_BP/scripts/horses/store.js").href);
const fireEv = (path, ev) => { for (const s of mock.subscriptions) if (s.path === path) s.fn(ev); };
const tick = (n = 1) => { for (let i = 0; i < n; i++) { mock.advance(1); time++; for (const t of mock.intervals) if (system.currentTick % t.ticks === 0) t.fn(); } };
const settle = () => new Promise((r) => setTimeout(r, 5));
const ok = (c, m) => { if (!c) { console.log(log.slice(-12).join("\n")); throw new Error("FAILED: " + m); } console.log("ok  " + m); };

tick(2);
const P = mkPlayer("p1", "Mateo"); players.push(P);
blocks.set("0,64,0", "siege:keep_banner");
api.getState().keeps.p1 = { x: 0, y: 64, z: 0, name: "Mateo", color: 14, wins: 0, allies: [] };

// 1. Halter a tamed vanilla horse
const wild = mkEntity("minecraft:horse", { x: 3, y: 64, z: 3 });
wild.comps = { "minecraft:is_tamed": {}, "minecraft:movement": { defaultValue: 0.31 }, "minecraft:health": { effectiveMax: 26 }, "minecraft:variant": { value: 4 }, "minecraft:mark_variant": { value: 2 },
  "minecraft:inventory": { container: { getItem: (i) => (i === 0 ? { typeId: "minecraft:saddle" } : { typeId: "minecraft:horsearmoriron" }) } } };
wild.nameTag = "Shadowfax";
fireEv("world.beforeEvents.playerInteractWithEntity", { player: P, target: wild, itemStack: { typeId: "siege:halter" } });
let rec = store.horsesOf("p1")[0];
ok(rec && rec.name === "Shadowfax" && rec.stats.speed === 5 && rec.stats.health === 3 && rec.coat === 4, `halter registers the horse: ${JSON.stringify(rec?.stats)}`);
let steed = entities.find((e) => e.typeId === "siege:steed");
ok(steed && !wild.isValid && steed.events.includes("siege:speed_5") && steed.props["siege:coat"] === 4, "vanilla horse replaced by a steed with matching stats");
ok(steed.commands.some((c) => c.includes("slot.saddle")) && steed.commands.some((c) => c.includes("horsearmoriron")), "saddle and barding carried over");
ok(store.horsesOf("p1").length === 1, "one horse on the roster");

// second horse without a Stables is refused
const wild2 = mkEntity("minecraft:horse", { x: 3, y: 64, z: 3 }); wild2.comps = wild.comps;
fireEv("world.beforeEvents.playerInteractWithEntity", { player: P, target: wild2, itemStack: { typeId: "siege:halter" } });
ok(store.horsesOf("p1").length === 1 && P.bar.includes("stalls are full"), "roster cap of 1 without a Stables");

// a stranger can't ride it
const Q = mkPlayer("p2", "Rival"); players.push(Q);
const ev = { player: Q, target: steed, itemStack: undefined, cancel: false };
fireEv("world.beforeEvents.playerInteractWithEntity", ev);
ok(ev.cancel && Q.bar.includes("belongs to Mateo"), "strangers are refused");

// 2. Ride: XP, gallop, stamina
P.comps["minecraft:riding"] = { entityRidingOn: steed };
tick(5);
for (let i = 0; i < 400; i++) { steed.location.x += 2.5; P.location = { ...steed.location }; tick(5); }
ok(rec.level > 1 && rec.tp === rec.level - 1, `riding 1000 blocks: level ${rec.level}, ${rec.tp} training points`);
fireEv("world.afterEvents.itemUse", { source: P, itemStack: { typeId: "siege:riding_crop" } });
tick(5);
ok(steed.effects.speed === 1 && P.bar.includes("GALLOP"), "the crop starts a gallop (Speed II)");
let n = 0; while (P.bar.includes("GALLOP") && n < 200) { tick(5); n++; }
ok(n * 5 === 90 || Math.abs(n * 5 - 90) <= 5, `stamina 1 gallop lasts ${n * 5} ticks`);
fireEv("world.afterEvents.itemUse", { source: P, itemStack: { typeId: "siege:riding_crop" } });
ok(P.bar.includes("winded"), "can't gallop again while winded");

// 3. Gear
delete P.comps["minecraft:riding"];
P.give("siege:horseshoes_iron", 1);
fireEv("world.beforeEvents.playerInteractWithEntity", { player: P, target: steed, itemStack: { typeId: "siege:horseshoes_iron" } });
ok(rec.shoes === "iron" && steed.events.at(-1) !== undefined && steed.events.includes("siege:speed_6") && P.count("siege:horseshoes_iron") === 0, "iron horseshoes fitted: speed 6");
P.give("siege:caparison", 1);
fireEv("world.beforeEvents.playerInteractWithEntity", { player: P, target: steed, itemStack: { typeId: "siege:caparison" } });
ok(rec.caparison === 15 && steed.props["siege:cap"] === true && Math.abs(steed.props["siege:cap_r"] - 161 / 255) < 0.01, "caparison takes the red keep banner color");

// 4. Stables: place, train, stall, bring out
blocks.set("5,64,5", "siege:stables");
const stables = mkBlock({ x: 5, y: 64, z: 5 });
fireEv("world.afterEvents.playerPlaceBlock", { block: stables, player: P });
ok(store.meta.data.stables.p1 === 1, "stables registered at level 1");
P.give("minecraft:hay_block", 64); P.give("minecraft:golden_carrot", 64); P.give("minecraft:golden_apple", 20); P.give("siege:gold_coin", 8);
steed.location = { x: 6, y: 64, z: 6 };
answers.push("Shadowfax", "Train Jump to 3");
fireEv("world.beforeEvents.playerInteractWithBlock", { block: stables, player: P }); await settle();
ok(rec.stats.jump === 3 && steed.events.includes("siege:jump_3") && P.count("minecraft:hay_block") === 56, "trained Jump to 3 for 8 hay + 4 golden carrots");
answers.push("Shadowfax", "Put in the stalls");
fireEv("world.beforeEvents.playerInteractWithBlock", { block: stables, player: P }); await settle();
ok(rec.status === "stabled" && !steed.isValid && !entities.some((e) => e.typeId === "siege:steed"), "horse put in the stalls");

// second horse now allowed (cap 3), then breed
const before2 = wild2.isValid;
fireEv("world.beforeEvents.playerInteractWithEntity", { player: P, target: wild2, itemStack: { typeId: "siege:halter" } });
ok(before2 && store.horsesOf("p1").length === 2, "second horse registered with a Stables");
const mare = store.horsesOf("p1")[1];
answers.push("Breed two horses", "Shadowfax", mare.name);
fireEv("world.beforeEvents.playerInteractWithBlock", { block: stables, player: P }); await settle();
const foal = store.horsesOf("p1")[2];
ok(foal?.foal && foal.sire === "Shadowfax" && entities.some((e) => e.dyn["siege:horses_uid"] === foal.uid && e.events.includes("siege:become_foal")), `a foal is born: ${foal?.name} ${JSON.stringify(foal?.stats)}`);
ok(P.count("minecraft:golden_apple") === 18, "breeding cost paid");
time += 24001; tick(40);
ok(!foal.foal, "the foal grows up after a day");

// 5. Rails: builder places two stations, player discovers and travels
const B = mkPlayer("b1", "Builder"); B.mode = "Creative"; players.push(B);
blocks.set("100,64,0", "hc:station_post"); blocks.set("102,64,0", "minecraft:rail");
answers.push(["Kingsrest", 5]);
fireEv("world.afterEvents.playerPlaceBlock", { block: mkBlock({ x: 100, y: 64, z: 0 }), player: B }); await settle();
blocks.set("600,64,0", "hc:station_post");
answers.push(["Millbrook", 0]);
fireEv("world.afterEvents.playerPlaceBlock", { block: mkBlock({ x: 600, y: 64, z: 0 }), player: B }); await settle();
const rails = await import(pathToFileURL(ROOT + "/Siege_Nights_BP/scripts/rails/index.js").href);
ok(rails.allStations().length === 2 && rails.allStations()[0].name === "Kingsrest" && rails.allStations()[0].region === "Kingsrest", "two stations on the network");
blocks.set("7,64,7", "siege:rail_depot");
fireEv("world.afterEvents.playerPlaceBlock", { block: mkBlock({ x: 7, y: 64, z: 7 }), player: P });
ok(rails.allStations().some((s) => s.name === "Mateo's Depot" && s.owner === "p1"), "Rail Depot joins as Mateo's Depot");
P.location = { x: 600, y: 64, z: 3 }; tick(20);
P.location = { x: 101, y: 64, z: 1 }; tick(20);
ok(JSON.parse(P.dyn["siege:rails_found"]).length === 3, "stations discovered by walking up to them");
answers.push("Choose a destination", "Millbrook");
fireEv("world.beforeEvents.playerInteractWithBlock", { block: mkBlock({ x: 100, y: 64, z: 0 }), player: P }); await settle();
ok(P.dyn["siege:rails_dest"] === 2, "destination set to Millbrook");
answers.push("Call a minecart");
fireEv("world.beforeEvents.playerInteractWithBlock", { block: mkBlock({ x: 100, y: 64, z: 0 }), player: P }); await settle();
const cart = entities.find((e) => e.typeId === "minecraft:minecart");
ok(cart && cart.location.x === 102.5, "a cart is put on the nearest rail");
for (let x = 102; x < 110; x++) blocks.set(`${x},64,0`, "minecraft:rail");
P.comps["minecraft:riding"] = { entityRidingOn: cart }; cart.comps["minecraft:rideable"] = { getRiders: () => [P] };
P.location = { x: 103, y: 64, z: 0 }; cart.location = { x: 103.5, y: 64.1, z: 0.5 }; tick(20);
ok(P.bar.includes("Millbrook") && P.bar.includes("E"), `the bar shows the way: ${P.bar.replace(/§./g, "")}`);
ok(cart.impulse?.x > 0, "express track pushes the cart on straight rail");
// horse by rail: stable at Kingsrest... (Shadowfax is already stabled) collect at Millbrook
P.location = { x: 600, y: 64, z: 1 }; cart.location = { ...P.location }; tick(20);
ok(P.dyn["siege:rails_dest"] === undefined && log.some((l) => l.includes("You have arrived")), "arrival clears the destination");
delete P.comps["minecraft:riding"];
answers.push("Horse stalls", "Shadowfax", "Bring out of the stalls");
fireEv("world.beforeEvents.playerInteractWithBlock", { block: mkBlock({ x: 600, y: 64, z: 0 }), player: P }); await settle();
steed = entities.find((e) => e.dyn["siege:horses_uid"] === rec.uid);
ok(rec.status === "out" && steed && steed.location.x === 600.5 && steed.events.includes("siege:speed_6"), "the horse is collected at the far station with its stats and gear");

// 6. Whistle, death, revive
steed.location = { x: 630, y: 64, z: 0 };
fireEv("world.afterEvents.itemUse", { source: P, itemStack: { typeId: "siege:horse_whistle" } });
ok(steed.location.x === 600, "the whistle calls a horse within 64 blocks");
tick(40);
fireEv("world.afterEvents.entityDie", { deadEntity: steed, damageSource: {} });
ok(rec.status === "fallen", "a dead horse is marked fallen, not deleted");
steed.remove(); tick(40);

// 7. Warhorse rite and charge (tag-based path)
P.tags.add("siege_path_knight");
store.meta.data.stables.p1 = 3; rec.status = "stabled"; rec.level = 16; rec.stats.health = 4;
P.give("minecraft:gold_block", 4); P.give("minecraft:iron_block", 8); P.give("minecraft:diamond_block", 1);
P.location = { x: 6, y: 64, z: 6 };
answers.push("Shadowfax", "Rite: Knight Warhorse", "Perform the rite");
fireEv("world.beforeEvents.playerInteractWithBlock", { block: stables, player: P }); await settle();
ok(rec.special === "warhorse" && P.count("minecraft:gold_block") === 0, "the Warhorse rite is performed");
answers.push("Shadowfax", "Bring out");
fireEv("world.beforeEvents.playerInteractWithBlock", { block: stables, player: P }); await settle();
steed = entities.find((e) => e.dyn["siege:horses_uid"] === rec.uid);
ok(steed.events.includes("siege:scale_war") && steed.props["siege:special"] === 1, "the warhorse is bigger and flagged for its look");
P.comps["minecraft:riding"] = { entityRidingOn: steed }; tick(5);
const zombie = mkEntity("minecraft:zombie", { x: steed.location.x + 1.5, y: 64, z: steed.location.z }); zombie.family = "monster";
const guard = mkEntity("siege:man_at_arms", { x: steed.location.x + 5, y: 64, z: steed.location.z }); guard.tags.add(api.guardTag("p1"));
fireEv("world.afterEvents.itemUse", { source: P, itemStack: { typeId: "siege:riding_crop" } }); tick(5);
ok(zombie.hurt === 7 && guard.effects.strength === 0, "Warhorse Charge: 7 damage and the guards rally");

// 7b. Train Carriage: called at a station, four seats, shows the way, packs up
P.location = { x: 101, y: 64, z: 1 };
for (const e of entities.filter((x) => x.typeId === "minecraft:minecart")) e.remove();
answers.push("Call a carriage");
fireEv("world.beforeEvents.playerInteractWithBlock", { block: mkBlock({ x: 100, y: 64, z: 0 }), player: P }); await settle();
const carriage = entities.find((e) => e.typeId === "siege:carriage");
ok(carriage && carriage.tags.has("siege_rails_cart"), "a station calls a Train Carriage onto the rail");
P.dyn["siege:rails_dest"] = 2; P.comps["minecraft:riding"] = { entityRidingOn: carriage }; carriage.comps["minecraft:rideable"] = { getRiders: () => [P] };
P.location = { x: 110, y: 64, z: 0 }; tick(20);
ok(P.bar.includes("Millbrook"), "riding a carriage counts as riding the line");
delete P.comps["minecraft:riding"]; P.dyn["siege:rails_dest"] = undefined;
const own = mkEntity("siege:carriage", { x: 105, y: 64, z: 0 }); own.comps["minecraft:rideable"] = { getRiders: () => [] };
P.isSneaking = true;
fireEv("world.beforeEvents.playerInteractWithEntity", { player: P, target: own, itemStack: undefined });
fireEv("world.beforeEvents.playerInteractWithEntity", { player: P, target: carriage, itemStack: undefined });
P.isSneaking = false;
ok(!own.isValid && P.count("siege:train_carriage") === 1 && carriage.isValid, "your own carriage packs up; a station carriage does not");
const cfg = JSON.parse(readFileSync(ROOT + "/Siege_Nights_BP/entities/carriage.json", "utf8"))["minecraft:entity"].components;
const railsData = await import(pathToFileURL(ROOT + "/Siege_Nights_BP/scripts/rails/data.js").href);
ok(cfg["minecraft:rail_movement"].max_speed === railsData.CARRIAGE_SPEED && cfg["minecraft:rideable"].seat_count === 4, "carriage: 4 seats, top speed 0.6 on rails");

// 8. The test world exhibits
const ev2 = await import(pathToFileURL(ROOT + "/Siege_Nights_BP/scripts/core/events.js").href);
let spot = 0; const signs = [];
const T = mkPlayer("t1", "Tester"); T.mode = "Creative"; players.push(T);
for (let run = 0; run < 2; run++) {
  spot = 0;
  for (const e of entities.filter((x) => x.tags.has("siege_showcase"))) e.remove();
  ev2.emit("showcase", { player: T, dim, origin: { x: 2000, y: 64, z: 0 }, nextSpot: () => ({ x: 2000 + spot++ * 3, y: 64, z: -8 }), label: (at, text) => signs.push(text) });
}
const shown = store.horsesOf("t1");
ok(shown.length === 8 && shown.filter((r) => r.special !== "none").length === 2 && shown.some((r) => r.foal && r.breed === "crossbred"), "showcase: 8 steeds (5 breeds, Warhorse, Glimstrider, foal), no duplicates on a second run");
ok(entities.filter((e) => e.typeId === "siege:steed" && e.tags.has("siege_showcase")).length === 8 && store.meta.data.stables.t1 === 3, "showcase horses are in the world with a level 3 Stables");
const halt = rails.allStations().find((s) => s.name === "Showcase Halt");
ok(rails.allStations().filter((s) => s.showcase).length === 2 && blocks.get(`${halt.x},64,-8`) === "hc:station_post" && blocks.get(`${halt.x},64,-10`)?.includes("rail"), "showcase: two stations on a powered line");
ok(Object.values(store.meta.data.posts).includes("sandstrider"), "showcase: a Breeder's Post selling Sandstriders");
console.log("\nSIMULATION PASSED");
