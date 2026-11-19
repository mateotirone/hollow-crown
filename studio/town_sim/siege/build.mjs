// Packs the add-on itself for the siege simulator. Nothing here is a copy of a rule: it is the pack's own files.
//
//   node studio/town_sim/siege/build.mjs [outDir=studio/town_sim/out/siege]
//
// Writes:
//   game.js    every script the game runs (Siege_Nights_BP/scripts/main.js and all it imports), bundled into one file.
//              "@minecraft/server" and "@minecraft/server-ui" are taken from globalThis.__mc.lookup(name), which
//              engine.mjs provides. The bundle also hands out the modules the simulator sets a siege up with (SIM).
//   pack.json  the behaviour pack's data the engine reads: blocks (states, collision), entities, armour, names.
//   look.json  the resource pack's data the page draws with: client entities, geometry, animations, controllers,
//              render controllers, and each texture (PNG, base64).
//   game.txt   game.js gzipped, in base64 (what the page fetches).
//   engine.js  night.mjs and all it uses (engine.mjs, ai.mjs, setup.mjs, models.mjs) as one script for the page:
//              it defines SiegeEngine.
// Run it again after any change to the add-on and the simulator plays the new code.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { createRequire } from "node:module";

const HERE = import.meta.dirname;
const ROOT = path.join(HERE, "..", "..", "..");
const BP = path.join(ROOT, "Siege_Nights_BP"), RP = path.join(ROOT, "Siege_Nights_RP"), SCRIPTS = path.join(BP, "scripts");
const OUT = process.argv[2] ?? path.join(HERE, "..", "out", "siege");
const require = createRequire(path.join(ROOT, "tools", "package.json"));
let esbuild;
try { esbuild = require("esbuild"); } catch { console.error("esbuild is missing: run `npm ci` in tools/ first."); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });

const walk = (d, ext) => (fs.existsSync(d) ? fs.readdirSync(d).flatMap((f) => { const p = path.join(d, f); return fs.statSync(p).isDirectory() ? walk(p, ext) : p.endsWith(ext) ? [p] : []; }) : []);
const readJson = (f) => { const s = fs.readFileSync(f, "utf8").replace(/^﻿/, ""); try { return JSON.parse(s); } catch { return JSON.parse(s.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "")); } };

// ---------- the scripts ----------
// What the simulator calls to set the table (a settlement that already stands) and to read the result. Everything
// else it does through the world, as a player would.
const SIM = {
  state: "siege/state.js", siege: "siege/siege.js", keep: "siege/keep.js", guards: "siege/guards.js", api: "siege/api.js", constants: "siege/constants.js",
  settings: "siege/settings.js", warplan: "siege/warplan.js", territory: "siege/territory.js", wallsHp: "siege/walls.js", breachers: "siege/breachers.js",
  walls: "settle/walls.js", walldata: "settle/walldata.js", founding: "settle/founding.js", towns: "settle/towns.js", settleConfig: "settle/config.js",
  guardposts: "guardposts/index.js", claims: "plots/claims.js", plotsConfig: "plots/config.js", events: "core/events.js", tests: "core/tests.js",
  armoury: "army/armoury.js", region: "army/region.js", coins: "economy/coins.js",
};
const entry = `import "./main.js";\n${Object.entries(SIM).filter(([, f]) => fs.existsSync(path.join(SCRIPTS, f))).map(([k, f]) => `import * as ${k} from "./${f}";`).join("\n")}\nglobalThis.__game = { ${Object.keys(SIM).filter((k) => fs.existsSync(path.join(SCRIPTS, SIM[k]))).join(", ")} };\n`;
const mcNames = new Map(); // module -> names imported from it anywhere in the scripts
for (const f of walk(SCRIPTS, ".js")) for (const m of fs.readFileSync(f, "utf8").matchAll(/import\s+(?:\*\s+as\s+(\w+)|\{([^}]*)\})\s+from\s+["'](@minecraft\/[^"']+)["']/g)) {
  const set = mcNames.get(m[3]) ?? mcNames.set(m[3], new Set()).get(m[3]);
  if (m[2]) for (const n of m[2].split(",").map((x) => x.trim().split(/\s+as\s+/)[0]).filter(Boolean)) set.add(n);
}
const built = await esbuild.build({
  stdin: { contents: entry, resolveDir: SCRIPTS, sourcefile: "sim_entry.js" },
  bundle: true, format: "iife", minify: true, write: false, target: "es2022", legalComments: "none", logLevel: "warning",
  plugins: [{ name: "minecraft", setup(b) {
    b.onResolve({ filter: /^@minecraft\// }, (a) => ({ path: a.path, namespace: "mc" }));
    b.onLoad({ filter: /.*/, namespace: "mc" }, (a) => ({ contents: [...(mcNames.get(a.path) ?? [])].map((n) => `export const ${n} = globalThis.__mc.lookup(${JSON.stringify(n)});`).join("\n") || "export {};" }));
  } }],
});
fs.writeFileSync(path.join(OUT, "game.js"), built.outputFiles[0].text);
// the same, gzipped and in base64, for the page to fetch (a published text file may not be as big as game.js is)
fs.writeFileSync(path.join(OUT, "game.txt"), zlib.gzipSync(built.outputFiles[0].text, { level: 9 }).toString("base64"));

const eng = await esbuild.build({ entryPoints: [path.join(HERE, "night.mjs")], bundle: true, format: "iife", globalName: "SiegeEngine", minify: true, write: false, target: "es2022", legalComments: "none" });
fs.writeFileSync(path.join(OUT, "engine.js"), eng.outputFiles[0].text);

// ---------- the behaviour pack ----------
const blocks = {};
for (const f of walk(path.join(BP, "blocks"), ".json")) {
  const b = readJson(f)["minecraft:block"];
  if (!b) continue;
  const states = {};
  for (const [k, v] of Object.entries(b.description.states ?? {})) states[k] = Array.isArray(v) ? v : Array.from({ length: v.values.max - v.values.min + 1 }, (_, i) => v.values.min + i);
  for (const [k, t] of Object.entries(b.description.traits ?? {})) {
    for (const s of t.enabled_states ?? []) {
      states[s] = s === "minecraft:cardinal_direction" ? ["north", "south", "east", "west"] : s === "minecraft:facing_direction" ? ["down", "up", "north", "south", "east", "west"]
        : s === "minecraft:block_face" ? ["down", "up", "north", "south", "east", "west"] : s === "minecraft:vertical_half" ? ["bottom", "top"] : [];
    }
    void k;
  }
  const col = (c) => (c === undefined ? undefined : typeof c === "boolean" ? c : { origin: c.origin, size: c.size });
  const perms = (b.permutations ?? []).filter((p) => p.components?.["minecraft:collision_box"] !== undefined).map((p) => [p.condition, col(p.components["minecraft:collision_box"])]);
  blocks[b.description.identifier] = { states, col: col(b.components?.["minecraft:collision_box"]), ...(perms.length ? { perms } : {}) };
}
const entities = {};
for (const f of walk(path.join(BP, "entities"), ".json")) { const e = readJson(f)["minecraft:entity"]; if (e) entities[e.description.identifier] = e; }
const VANILLA_ARMOR = { leather: [1, 3, 2, 1], chainmail: [2, 5, 4, 1], iron: [2, 6, 5, 2], golden: [2, 5, 3, 1], diamond: [3, 8, 6, 3], netherite: [3, 8, 6, 3] };
const items = {}, itemIds = [];
for (const [m, v] of Object.entries(VANILLA_ARMOR)) ["helmet", "chestplate", "leggings", "boots"].forEach((p, i) => { items[`minecraft:${m}_${p}`] = { armor: v[i] }; });
for (const f of walk(path.join(BP, "items"), ".json")) {
  const it = readJson(f)["minecraft:item"];
  if (!it) continue;
  itemIds.push(it.description.identifier);
  const w = it.components?.["minecraft:wearable"], d = it.components?.["minecraft:damage"];
  if (w?.protection || d) items[it.description.identifier] = { ...(w?.protection ? { armor: w.protection } : {}), ...(d ? { damage: typeof d === "number" ? d : d.value } : {}) };
}
const lang = {};
for (const dir of [RP, BP]) { const f = path.join(dir, "texts", "en_US.lang"); if (fs.existsSync(f)) for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const i = line.indexOf("="); if (i > 0 && !line.startsWith("#")) lang[line.slice(0, i).trim()] = line.slice(i + 1).replace(/\t?#.*$/, "").trim(); } }
const names = Object.fromEntries(Object.entries(lang).filter(([k]) => /^(entity\..*\.name|item\..*|tile\..*\.name|action\.)/.test(k)));
const vanilla = readJson(path.join(ROOT, "map", "structures", "bedrock_states.json"));
const pack = { blocks, entities, items, itemIds, lang: names, vanilla: { blocks: vanilla.blocks, properties: vanilla.properties } };
fs.writeFileSync(path.join(OUT, "pack.json"), JSON.stringify(pack));

// ---------- the resource pack ----------
const client = {}, geos = {}, anims = {}, ctrls = {}, renders = {}, tex = {};
for (const f of walk(path.join(RP, "entity"), ".json")) { const d = readJson(f)["minecraft:client_entity"]?.description; if (d) client[d.identifier] = d; }
for (const f of walk(path.join(RP, "models"), ".json")) for (const g of readJson(f)["minecraft:geometry"] ?? []) geos[g.description.identifier] = g;
for (const f of walk(path.join(RP, "animations"), ".json")) Object.assign(anims, readJson(f).animations ?? {});
for (const f of walk(path.join(RP, "animation_controllers"), ".json")) Object.assign(ctrls, readJson(f).animation_controllers ?? {});
for (const f of walk(path.join(RP, "render_controllers"), ".json")) Object.assign(renders, readJson(f).render_controllers ?? {});
// vanilla pieces the pack's entities borrow (an arrow, a player skin): from Mojang's bedrock-samples when it is there
const SAMPLES = process.env.BEDROCK_SAMPLES;
const wantGeo = new Set(), wantTex = new Set();
for (const d of Object.values(client)) { for (const g of Object.values(d.geometry ?? {})) wantGeo.add(g); for (const t of Object.values(d.textures ?? {})) wantTex.add(t); }
for (const t of ["textures/entity/arrows", "textures/entity/steve"]) wantTex.add(t);
for (const t of wantTex) {
  const f = [path.join(RP, t + ".png"), SAMPLES && path.join(SAMPLES, "resource_pack", t + ".png")].find((p) => p && fs.existsSync(p));
  if (f) tex[t] = fs.readFileSync(f).toString("base64");
}
const usedGeo = Object.fromEntries([...wantGeo].filter((g) => geos[g]).map((g) => [g, geos[g]]));
// a geometry may build on another ("geometry.a:geometry.b")
for (const [id, g] of Object.entries(geos)) { const base = id.split(":")[0]; if (wantGeo.has(base) && !usedGeo[base]) usedGeo[base] = { ...g, description: { ...g.description, identifier: base } }; }
const look = { client, geos: usedGeo, anims, ctrls, renders, tex };
fs.writeFileSync(path.join(OUT, "look.json"), JSON.stringify(look));

const mb = (f) => (fs.statSync(path.join(OUT, f)).size / 1e6).toFixed(1);
console.log(`game.js ${mb("game.js")} MB, engine.js ${mb("engine.js")} MB, pack.json ${mb("pack.json")} MB (${Object.keys(blocks).length} blocks, ${Object.keys(entities).length} entities), look.json ${mb("look.json")} MB (${Object.keys(client).length} client entities, ${Object.keys(usedGeo).length} models, ${Object.keys(tex).length}/${wantTex.size} textures)`);
const missingGeo = [...wantGeo].filter((g) => !usedGeo[g]), missingTex = [...wantTex].filter((t) => !tex[t]);
if (missingGeo.length) console.log("models not in the pack (vanilla):", missingGeo.join(", "));
if (missingTex.length) console.log("textures not in the pack (vanilla):", missingTex.join(", "));
