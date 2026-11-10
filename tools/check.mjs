#!/usr/bin/env node
// Offline check for Siege Nights. Run from the siege-nights folder:   node tools/check.mjs
//
//  1. every pack JSON file parses
//  2. every script import points at a real file
//  3. (if `npm install` was run in tools/) no undefined names and no unused imports in the scripts
//  4. the whole script loads in Node with a fake Minecraft (catches crashes at startup)
//  5. every loop task runs a few times in an empty world without an error
//  6. all self-tests pass (the in-game-only ones are skipped here)
//
// Exit code 0 and "ALL OK" means it's safe to build the .mcaddon.

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { register, createRequire } from "node:module";
import { makeMock } from "./mock-minecraft.mjs";

const TOOLS = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(TOOLS, "..");
const BP = join(ROOT, "Siege_Nights_BP");
const RP = join(ROOT, "Siege_Nights_RP");
const SCRIPTS = join(BP, "scripts");

const problems = [];
const warnings = [];
const fail = (msg) => problems.push(msg);
const step = (name) => console.log(`\n== ${name}`);

const walk = (dir, ext) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p, ext) : p.endsWith(ext) ? [p] : [];
});
const rel = (p) => relative(ROOT, p);

// Bedrock tolerates comments in JSON; strip them (outside strings) if strict parsing fails
function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const noComments = text.replace(/("(?:[^"\\]|\\.)*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (m, str) => str ?? "");
    return JSON.parse(noComments.replace(/,(\s*[}\]])/g, "$1"));
  }
}

// ---------- 1. JSON ----------
step("Pack JSON");
const pack = { blocks: new Set(), items: new Set(), entities: new Set() };
let jsonCount = 0;
for (const root of [BP, RP]) {
  if (!existsSync(root)) { fail(`missing folder ${rel(root)}`); continue; }
  for (const file of walk(root, ".json")) {
    jsonCount++;
    let data;
    try {
      data = parseJson(readFileSync(file, "utf8").replace(/^﻿/, ""));
    } catch (e) {
      fail(`${rel(file)}: bad JSON (${e.message})`);
      continue;
    }
    if (root !== BP) continue;
    const id = data?.["minecraft:block"]?.description?.identifier;
    if (id) pack.blocks.add(id);
    const item = data?.["minecraft:item"]?.description?.identifier;
    if (item) pack.items.add(item);
    const ent = data?.["minecraft:entity"]?.description?.identifier;
    if (ent) pack.entities.add(ent);
  }
}
console.log(`${jsonCount} files, ${pack.blocks.size} blocks, ${pack.items.size} items, ${pack.entities.size} entities`);

const manifest = parseJson(readFileSync(join(BP, "manifest.json"), "utf8"));
const scriptModule = manifest.modules.find((m) => m.type === "script");
const entry = join(BP, scriptModule.entry);
if (!existsSync(entry)) fail(`manifest entry ${scriptModule.entry} does not exist`);
const mcVersion = manifest.dependencies.find((d) => d.module_name === "@minecraft/server")?.version;
console.log(`entry ${scriptModule.entry}, @minecraft/server ${mcVersion}, min engine ${manifest.header.min_engine_version.join(".")}`);

// keep heart health vs. the biggest tier is a known thing to watch
try {
  const heart = parseJson(readFileSync(join(BP, "entities/keep_heart.json"), "utf8"));
  const max = heart["minecraft:entity"].components["minecraft:health"]?.max;
  const territory = readFileSync(join(SCRIPTS, "siege/territory.js"), "utf8");
  const biggest = Math.max(...[...territory.matchAll(/keepHealth:\s*(\d+)/g)].map((m) => +m[1]));
  if (max && biggest > max) warnings.push(`keep_heart max health is ${max}, but a tier asks for ${biggest} (the entity caps it at ${max})`);
} catch {
  // files moved; not important
}

// ---------- 2. imports ----------
step("Script imports");
const scripts = walk(SCRIPTS, ".js");
const reachable = new Set(); // files main.js actually loads; the rest are work in progress
(function visit(file) {
  if (reachable.has(file) || !existsSync(file)) return;
  reachable.add(file);
  for (const [, , spec] of readFileSync(file, "utf8").matchAll(/import\s+(?:([\w$*\s{},]+?)\s+from\s+)?["']([^"']+)["']/g)) {
    if (spec.startsWith(".")) visit(resolve(dirname(file), spec));
  }
})(entry);
const failIn = (file, msg) => (reachable.has(file) ? fail(msg) : warnings.push(`(not loaded by main.js yet) ${msg}`));
const mcNames = new Map(); // module -> Set(names)
const importRe = /import\s+(?:([\w$*\s{},]+?)\s+from\s+)?["']([^"']+)["']/g;
for (const file of scripts) {
  const src = readFileSync(file, "utf8");
  for (const [, what, spec] of src.matchAll(importRe)) {
    if (spec.startsWith("@minecraft/")) {
      if (!mcNames.has(spec)) mcNames.set(spec, new Set());
      const names = (what ?? "").match(/\{([^}]*)\}/)?.[1] ?? "";
      for (const n of names.split(",")) {
        const name = n.trim().split(/\s+as\s+/)[0];
        if (name) mcNames.get(spec).add(name);
      }
    } else if (spec.startsWith(".")) {
      const target = resolve(dirname(file), spec);
      if (!existsSync(target)) failIn(file, `${rel(file)} imports "${spec}", which does not exist`);
      else if (!spec.endsWith(".js")) failIn(file, `${rel(file)} imports "${spec}": Minecraft needs the full file name ending in .js`);
    } else {
      failIn(file, `${rel(file)} imports "${spec}": only @minecraft/* and relative files work in Minecraft`);
    }
  }
}
for (const [spec, names] of mcNames) console.log(`${spec}: ${[...names].sort().join(", ")}`);
const allowed = new Set(Object.keys(manifest.dependencies.reduce((o, d) => (d.module_name ? { ...o, [d.module_name]: 1 } : o), {})));
for (const spec of mcNames.keys()) if (!allowed.has(spec)) fail(`scripts import ${spec}, but manifest.json has no dependency on it`);
console.log(`${scripts.length} script files, ${reachable.size} loaded by main.js`);

// ---------- 2b. saved data must be versioned ----------
// Rule: every saved store carries a version and an upgrade step, so worlds survive updates.
// moduleStore() does this for you. Saving straight to the world is only OK if the blob has its own version.
step("Saved data versions");
{
  let raw = 0;
  for (const file of scripts) {
    const name = rel(file);
    if (name.endsWith("core/store.js") || name.endsWith("siege/state.js")) continue;
    const src = readFileSync(file, "utf8");
    if (!/world\.setDynamicProperty\(/.test(src)) continue;
    if (/\b_v\b|\bversion\b|STORE_VERSION|SAVE_VERSION/i.test(src)) continue; // carries its own version
    raw++;
    warnings.push(`${name} saves to the world without a version. Use moduleStore() from core/store.js, or put a version field in the saved data and upgrade old saves when you load.`);
  }
  for (const file of scripts) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(/moduleStore\(\s*["'`]([^"'`]+)["'`][\s\S]{0,400}?version:\s*(\d+)/g)) {
      if (+m[2] > 1 && !/upgrade\s*[(:]/.test(src)) failIn(file, `${rel(file)}: store "${m[1]}" is at version ${m[2]} but has no upgrade step`);
    }
  }
  console.log(raw ? `${raw} file(s) save unversioned data (see notes)` : "every saved store is versioned");
}

// ---------- 3. deep check (optional) ----------
step("Undefined names and unused imports");
await deepCheck();

async function deepCheck() {
  let acorn, eslintScope;
  try {
    const require = createRequire(join(TOOLS, "package.json"));
    acorn = await import(pathToFileURL(require.resolve("acorn")));
    eslintScope = await import(pathToFileURL(require.resolve("eslint-scope")));
  } catch {
    console.log("skipped (run `npm install` in siege-nights/tools once to turn this on)");
    return;
  }
  const globals = new Set(["console", "JSON", "Math", "Object", "Array", "Map", "Set", "WeakMap", "Number", "String",
    "Boolean", "Promise", "Error", "Date", "Symbol", "Infinity", "NaN", "undefined", "globalThis", "isNaN", "parseInt",
    "parseFloat", "RegExp", "Reflect", "Proxy", "BigInt", "TypeError", "RangeError", "encodeURIComponent", "decodeURIComponent",
    "Uint8Array", "Uint16Array", "Uint32Array", "Int8Array", "Int16Array", "Int32Array", "Float32Array", "Float64Array", "ArrayBuffer", "WeakSet", "isFinite", "SyntaxError"]);
  let count = 0;
  for (const file of scripts) {
    const src = readFileSync(file, "utf8");
    let ast;
    try {
      ast = acorn.parse(src, { ecmaVersion: "latest", sourceType: "module", locations: true, ranges: true });
    } catch (e) {
      failIn(file, `${rel(file)}: syntax error ${e.message}`);
      continue;
    }
    const manager = eslintScope.analyze(ast, { ecmaVersion: 2022, sourceType: "module" });
    for (const ref of manager.globalScope.through) {
      if (globals.has(ref.identifier.name)) continue;
      failIn(file, `${rel(file)}:${ref.identifier.loc.start.line} uses "${ref.identifier.name}", which is never defined or imported`);
      count++;
    }
    const moduleScope = manager.scopes.find((s) => s.type === "module");
    for (const v of moduleScope?.variables ?? []) {
      if (v.defs[0]?.type === "ImportBinding" && v.references.length === 0) {
        warnings.push(`${rel(file)}: "${v.name}" is imported but never used`);
      }
    }
  }
  console.log(count ? `${count} undefined names` : "none");
}

// ---------- 4. load ----------
step("Load the scripts with a fake Minecraft");
const mock = makeMock(pack);
globalThis.__mc = mock;
globalThis.__siegeOffline = true;
const exportsFor = Object.fromEntries([...mcNames].map(([k, v]) => [k, [...v]]));
const hooks = `
  let exportsFor = {};
  export async function initialize(data) { exportsFor = data; }
  export async function resolve(spec, ctx, next) {
    if (spec.startsWith("@minecraft/")) return { url: "mock:" + spec, shortCircuit: true };
    return next(spec, ctx);
  }
  export async function load(url, ctx, next) {
    if (!url.startsWith("mock:")) return next(url, ctx);
    const names = exportsFor[url.slice(5)] ?? [];
    const source = names.map((n) => "export const " + n + " = globalThis.__mc.lookup(" + JSON.stringify(n) + ");").join("\\n");
    return { format: "module", source, shortCircuit: true };
  }`;
register("data:text/javascript," + encodeURIComponent(hooks), { parentURL: import.meta.url, data: exportsFor });

const warned = [];
const realWarn = console.warn;
console.warn = (...args) => warned.push(args.join(" "));
let loaded = false;
try {
  await import(pathToFileURL(entry).href);
  loaded = true;
  console.log(`loaded: ${mock.subscriptions.length} event subscriptions, ${mock.intervals.length} loop tasks`);
} catch (e) {
  fail(`the script crashed while loading: ${e?.stack ?? e}`);
}

// ---------- 5. run the loop ----------
if (loaded) {
  step("Run every loop task in an empty world");
  for (const s of mock.subscriptions.filter((x) => x.path === "system.beforeEvents.startup")) {
    try { s.fn({ blockComponentRegistry: { registerCustomComponent() {} }, itemComponentRegistry: { registerCustomComponent() {} }, dimensionRegistry: new Proxy({}, { get: () => () => {} }) }); } catch (e) { warned.push(`startup handler: ${e}`); }
  }
  for (let round = 0; round < 3; round++) {
    mock.advance(40);
    for (const t of mock.intervals) t.fn();
  }
  if (warned.length) for (const w of warned) fail(`warning while running: ${w}`);
  else console.log(`${mock.intervals.length} tasks ran 3 times each, no errors`);
}
console.warn = realWarn;

// ---------- 6. self-tests ----------
if (loaded) {
  step("Self-tests");
  const { runTests } = await import(pathToFileURL(join(SCRIPTS, "core/tests.js")).href);
  const result = runTests({ inGame: false });
  console.log(`${result.passed} passed, ${result.failed.length} failed, ${result.skipped} in-game only (skipped here)`);
  for (const f of result.failed) fail(`test failed: ${f.group}: ${f.name} (${f.error})`);
}

// ---------- result ----------
console.log("");
for (const w of warnings) console.log(`note: ${w}`);
if (problems.length) {
  console.log(`\n${problems.length} PROBLEM${problems.length === 1 ? "" : "S"}:`);
  for (const p of problems) console.log(` - ${p}`);
  process.exit(1);
}
console.log("ALL OK");
