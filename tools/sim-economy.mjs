// Run from anywhere: node tools/sim-economy.mjs
// Drives the economy scripts through a pretend play session with a fake world.
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
const ROOT = join(import.meta.dirname, "..");
const { makeMock } = await import(pathToFileURL(ROOT + "/tools/mock-minecraft.mjs"));
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith(".json") ? [p] : []; });
const pack = { blocks: new Set(), items: new Set(), entities: new Set() };
for (const f of walk(ROOT + "/Siege_Nights_BP")) { try { const d = JSON.parse(readFileSync(f, "utf8")); const b = d["minecraft:block"]?.description?.identifier; if (b) pack.blocks.add(b); const i = d["minecraft:item"]?.description?.identifier; if (i) pack.items.add(i); const e = d["minecraft:entity"]?.description?.identifier; if (e) pack.entities.add(e);} catch {} }
const mock = makeMock(pack);
globalThis.__mc = mock;
const world = mock.lookup("world"), system = mock.lookup("system"), ItemStack = mock.lookup("ItemStack");
system.run = (fn) => { fn(); return 1; };
system.runTimeout = (fn) => { fn(); return 1; };
const walkJs = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walkJs(p) : p.endsWith(".js") ? [p] : []; });
const mcNames = [...new Set(walkJs(ROOT + "/Siege_Nights_BP/scripts").flatMap((f) => [...readFileSync(f, "utf8").matchAll(/import\s+\{([^}]*)\}\s+from\s+["']@minecraft\/[^"']+["']/g)].flatMap((m) => m[1].split(",").map((n) => n.trim().split(/\s+as\s+/)[0]).filter(Boolean))))];
const hooks = `export async function resolve(s,c,n){ if(s.startsWith("@minecraft/")) return {url:"mock:"+s, shortCircuit:true}; return n(s,c);} 
export async function load(u,c,n){ if(!u.startsWith("mock:")) return n(u,c); const names=${JSON.stringify(mcNames)}; return {format:"module", shortCircuit:true, source:names.map(n=>"export const "+n+" = globalThis.__mc.lookup("+JSON.stringify(n)+");").join("\\n")}; }`;
register("data:text/javascript," + encodeURIComponent(hooks), import.meta.url);
await import(pathToFileURL(ROOT + "/Siege_Nights_BP/scripts/main.js").href);
const E = ROOT + "/Siege_Nights_BP/scripts/economy/";
const coinsMod = await import(pathToFileURL(E + "coins.js").href);
const shops = await import(pathToFileURL(E + "shops.js").href);
const { JOBS } = await import(pathToFileURL(E + "config.js").href);

function mkPlayer(mode = "survival") {
  const inv = [], dyn = {}, cmds = [];
  const container = { size: 36, getItem: (i) => inv[i], setItem: (i, s) => { inv[i] = s; },
    addItem(s) { let left = s.amount; for (const x of inv) if (x?.typeId === s.typeId && x.amount < 64 && left > 0) { const n = Math.min(64 - x.amount, left); x.amount += n; left -= n; }
      for (let j = 0; j < 36 && left > 0; j++) if (!inv[j]) { const n = Math.min(64, left); inv[j] = { typeId: s.typeId, amount: n }; left -= n; } } };
  return { id: "p1", name: "Tester", typeId: "minecraft:player", inv, cmds, location: { x: 0, y: 64, z: 0 }, dimension: world.getDimension("overworld"),
    getGameMode: () => mode, getComponent: () => ({ container }), getDynamicProperty: (k) => dyn[k], setDynamicProperty: (k, v) => { dyn[k] = v; },
    runCommand: (c) => cmds.push(c), playSound() {}, sendMessage() {}, onScreenDisplay: { setActionBar() {} },
    count: (id) => inv.reduce((n, x) => n + (x?.typeId === id ? x.amount : 0), 0), give(id, n) { container.addItem({ typeId: id, amount: n }); } };
}
let step = 0;
const eq = (got, want, what) => { step++; if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`step ${step} ${what}: got ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`); console.log(`ok ${step}: ${what}`); };

const p = mkPlayer();
const wheat = JOBS.farmer.buys[0], iron = JOBS.moneyer.buys[0];
p.give("minecraft:wheat", 64);
eq(shops.sell(p, "farmer", undefined, wheat, 64), 24, "64 wheat sells for 24");
eq([p.count("minecraft:wheat"), coinsMod.carried(p)], [0, 24], "wheat gone, 24 coins carried");
p.give("minecraft:wheat", 16);
eq(shops.sell(p, "farmer", "Frostmarch", wheat, 16), 9, "16 wheat fetches 9 where farms are scarce");
p.give("minecraft:wheat", 1);
eq(shops.sell(p, "farmer", undefined, wheat, 1), 0, "one wheat is not worth a coin and is kept");
eq(p.count("minecraft:wheat"), 1, "the single wheat is still there");
p.give("minecraft:iron_ingot", 100);
eq(shops.sell(p, "moneyer", undefined, iron, 100), 64 * 8 + 36 * 4, "100 ingots: 64 at 8, 36 at 4");
eq(shops.sell(p, "moneyer", undefined, iron, 5), 0, "no ingots left to sell");
const total = 24 + 9 + 656;
eq(coinsMod.carried(p), total, "all of it is in the pockets");
eq([p.count("siege:gold_coin"), p.count("siege:coin")], [10, total - 640], "paid in Gold Regals and Regals");
eq(coinsMod.charge(p, 100), true, "paying 100 breaks gold for change");
eq(coinsMod.carried(p), total - 100, "exactly 100 left the pockets");
eq(coinsMod.charge(p, 5000), false, "cannot pay more than you have");
eq(coinsMod.carried(p), total - 100, "a refused charge takes nothing");
eq(coinsMod.deposit(p, 500), 500, "500 into the strongbox");
eq([coinsMod.banked(p), coinsMod.carried(p)], [500, total - 600], "strongbox and pockets add up");
eq(coinsMod.funds(p), total - 600, "away from home the strongbox is out of reach");
eq(coinsMod.withdraw(p, 9999), 500, "withdraw takes only what is there");
eq(coinsMod.carried(p), total - 100, "back in the pockets");
const c = mkPlayer(mock.lookup("GameMode").Creative);
eq(coinsMod.charge(c, 50), true, "Creative pays nothing");
c.give("minecraft:wheat", 32);
eq(shops.sell(c, "farmer", undefined, wheat, 32), 12, "a Creative sale still pays");
eq(c.cmds, ["clear @s minecraft:wheat -1 32"], "and clears the goods");
console.log(`\nALL ${step} STEPS OK`);
