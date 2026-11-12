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
import { spawnSync } from "node:child_process";
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

// ---------- 1b. Icons and textures ----------
// An item whose icon key is missing from item_texture.json, or a texture path with no image
// file behind it, shows up in game as a black and purple square. Bedrock does not report either.
step("Icons and textures");
{
  const readJson = (file) => {
    try { return parseJson(readFileSync(file, "utf8").replace(/^﻿/, "")); } catch { return null; }
  };
  const IMAGE_EXT = [".png", ".tga", ".jpg", ".jpeg"];
  const hasImage = (path) => IMAGE_EXT.some((ext) => existsSync(join(RP, path + ext))) || existsSync(join(RP, path));
  // Textures that ship with the base game, so this pack has no file for them. Anything else that
  // is missing is a mistake. Using another base-game texture on purpose? Add it here.
  const VANILLA_TEXTURES = ["textures/misc/", "textures/entity/horse2/", "textures/entity/steve", "textures/entity/cape_invisible"];
  // vanilla block textures that the tree-only blocks point at (written by studio/build_tree_blocks.py, checked there against Mojang's textures)
  const vanillaListFile = join(TOOLS, "vanilla_block_textures.json");
  if (existsSync(vanillaListFile)) for (const t of readJson(vanillaListFile) ?? []) VANILLA_TEXTURES.push("textures/blocks/" + t);
  const isVanillaPath = (path) => VANILLA_TEXTURES.some((v) => (v.endsWith("/") ? path.startsWith(v) : path === v));

  // every texture path one atlas entry points at (string, list, or { path } objects, with variations)
  const atlasPaths = (entry) => {
    const out = [];
    const add = (v) => {
      if (typeof v === "string") out.push(v);
      else if (Array.isArray(v)) v.forEach(add);
      else if (v && typeof v === "object") { add(v.path); add(v.variations); add(v.textures); }
    };
    add(entry?.textures);
    return out;
  };

  let checked = 0;
  const missingFile = (where, path) => {
    checked++;
    if (typeof path !== "string" || !path.startsWith("textures/")) return;
    if (hasImage(path) || isVanillaPath(path)) return;
    fail(`${where}: texture "${path}" has no image file in ${rel(RP)}`);
  };

  const atlases = {};
  for (const [name, file] of [["item", "textures/item_texture.json"], ["terrain", "textures/terrain_texture.json"]]) {
    const full = join(RP, file);
    const data = existsSync(full) ? readJson(full) : null;
    atlases[name] = data?.texture_data ?? {};
    if (!data) { fail(`${rel(full)} is missing or unreadable`); continue; }
    for (const [key, entry] of Object.entries(atlases[name])) {
      for (const path of atlasPaths(entry)) missingFile(`${file} "${key}"`, path);
    }
  }

  const flip = join(RP, "textures/flipbook_textures.json");
  if (existsSync(flip)) for (const f of readJson(flip) ?? []) missingFile("textures/flipbook_textures.json", f?.flipbook_texture);

  for (const folder of ["entity", "attachables"]) {
    const dir = join(RP, folder);
    if (!existsSync(dir)) continue;
    for (const file of walk(dir, ".json")) {
      const d = readJson(file);
      const desc = (d?.["minecraft:client_entity"] ?? d?.["minecraft:attachable"])?.description;
      for (const path of Object.values(desc?.textures ?? {})) missingFile(rel(file), path);
    }
  }

  // item icons: the key must be in item_texture.json
  const iconKeys = (icon) => (typeof icon === "string" ? [icon] : icon?.textures ? Object.values(icon.textures) : icon?.texture ? [icon.texture] : []);
  let icons = 0;
  for (const file of walk(join(BP, "items"), ".json")) {
    const item = readJson(file)?.["minecraft:item"];
    if (!item) continue;
    for (const key of iconKeys(item.components?.["minecraft:icon"])) {
      icons++;
      if (!(key in atlases.item)) fail(`${rel(file)}: icon "${key}" is not in textures/item_texture.json`);
    }
  }
  console.log(`${icons} item icons, ${checked} texture paths`);
}

// Mistakes the game reports in its content log when a world loads (first playtest, 2026-11-11).
step("Content log rules");
{
  const readJson = (file) => {
    try { return parseJson(readFileSync(file, "utf8").replace(/^﻿/, "")); } catch { return null; }
  };
  const verNum = (v) => (typeof v === "string" ? v.split(".").map(Number) : []);
  const atLeast = (v, min) => {
    const a = verNum(v), b = verNum(min);
    for (let i = 0; i < b.length; i++) if ((a[i] ?? 0) !== b[i]) return (a[i] ?? 0) > b[i];
    return true;
  };
  const vstr = (v) => (Array.isArray(v) ? v.join(".") : String(v));

  // 1. Both packs carry one version, and each one's link to the other names that exact version.
  const mans = {};
  for (const [name, root] of [["behavior", BP], ["resource", RP]]) mans[name] = readJson(join(root, "manifest.json"));
  const [bpm, rpm] = [mans.behavior, mans.resource];
  if (bpm && rpm) {
    if (vstr(bpm.header.version) !== vstr(rpm.header.version)) fail(`manifest versions differ: behavior ${vstr(bpm.header.version)}, resource ${vstr(rpm.header.version)} (docs/RELEASING.md: one version for both)`);
    for (const [name, m, other] of [["behavior", bpm, rpm], ["resource", rpm, bpm]]) {
      for (const mod of m.modules ?? []) if (vstr(mod.version) !== vstr(m.header.version)) fail(`${name} manifest: module ${mod.type} is ${vstr(mod.version)}, header is ${vstr(m.header.version)}`);
      const dep = (m.dependencies ?? []).find((d) => d.uuid === other.header.uuid);
      if (dep && vstr(dep.version) !== vstr(other.header.version)) fail(`${name} manifest depends on the other pack at ${vstr(dep.version)}, but it is ${vstr(other.header.version)}: the game cannot match them`);
    }
  }

  // 2. Entity components the game no longer parses at the file's format version (the entity then fails to load).
  const REMOVED = [["minecraft:pushable", "1.26.10", 'use "minecraft:pushable_by_entity": {} and/or "minecraft:pushable_by_block": {}']];
  let entities = 0;
  for (const file of walk(join(BP, "entities"), ".json")) {
    const d = readJson(file);
    const e = d?.["minecraft:entity"];
    if (!e) continue;
    entities++;
    const groups = [e.components ?? {}, ...Object.values(e.component_groups ?? {})];
    for (const [comp, since, fix] of REMOVED) {
      if (atLeast(d.format_version, since) && groups.some((g) => comp in g)) fail(`${rel(file)}: "${comp}" is not parsed at format_version ${d.format_version}, so the entity fails to load (${fix})`);
    }
  }

  // 3. Animations: an empty "bones" object is an error ("Required child not found").
  let anims = 0;
  for (const file of walk(join(RP, "animations"), ".json")) {
    for (const [id, a] of Object.entries(readJson(file)?.animations ?? {})) {
      anims++;
      if (a && typeof a.bones === "object" && !Array.isArray(a.bones) && Object.keys(a.bones).length === 0) fail(`${rel(file)}: ${id} has an empty "bones" object (leave "bones" out instead)`);
    }
  }

  // 3b. Every animation and controller a client entity names exists, and every animation a controller state plays
  //     is one of that entity's own short names (else the game logs an error and the mob stands frozen).
  const animIds = new Set(), ctrlDefs = new Map();
  for (const file of walk(join(RP, "animations"), ".json")) for (const id of Object.keys(readJson(file)?.animations ?? {})) animIds.add(id);
  for (const file of walk(join(RP, "animation_controllers"), ".json")) for (const [id, c] of Object.entries(readJson(file)?.animation_controllers ?? {})) ctrlDefs.set(id, c);
  for (const file of walk(join(RP, "entity"), ".json")) {
    const desc = readJson(file)?.["minecraft:client_entity"]?.description;
    if (!desc?.animations) continue;
    for (const [short, id] of Object.entries(desc.animations)) {
      if (id.startsWith("controller.animation.")) {
        const c = ctrlDefs.get(id);
        if (!c) { if (id.startsWith("controller.animation.siege")) fail(`${rel(file)}: "${short}" names controller ${id}, which is not defined`); continue; } // vanilla ones live in the game
        for (const st of Object.values(c.states ?? {})) for (const a of st.animations ?? []) {
          const name = typeof a === "string" ? a : Object.keys(a)[0];
          if (!(name in desc.animations)) fail(`${rel(file)}: controller ${id} plays "${name}", which the entity does not list in its animations`);
        }
      } else if (id.startsWith("animation.siege") && !animIds.has(id)) fail(`${rel(file)}: "${short}" names ${id}, which is not defined`);
    }
    for (const a of desc.scripts?.animate ?? []) {
      const name = typeof a === "string" ? a : Object.keys(a)[0];
      if (!(name in desc.animations)) fail(`${rel(file)}: animate lists "${name}", which is not in its animations`);
    }
  }

  // 3b. Elbows and knees: armour cubes must be cut at the joint (tools/build_player_joints.py) so they bend with it.
  {
    const JOINT = { rightArm: 18, leftArm: 18, rightLeg: 6, leftLeg: 6 };
    for (const file of walk(join(RP, "models/entity"), ".json")) {
      if (file.includes(`${"/"}bestiary${"/"}`)) continue;
      for (const g of readJson(file)?.["minecraft:geometry"] ?? []) {
        if (!String(g?.description?.identifier ?? "").startsWith("geometry.siege_")) continue;
        for (const b of g.bones ?? []) {
          const cut = JOINT[b.name];
          if (cut === undefined) continue;
          if ((b.cubes ?? []).some((c) => !c.rotation && c.size?.[1] > 0 && c.origin?.[1] < cut - 1e-6)) {
            fail(`${rel(file)}: ${b.name} has armour below the ${b.name.endsWith("Arm") ? "elbow" : "knee"}; run python3 tools/build_player_joints.py`);
            break;
          }
        }
      }
    }
  }

  // 4. Blocks: custom geometry must exist in the resource pack, and one block's materials can't mix opaque with see-through.
  const geometries = new Set();
  for (const file of walk(join(RP, "models"), ".json")) {
    const d = readJson(file);
    for (const g of d?.["minecraft:geometry"] ?? []) if (g?.description?.identifier) geometries.add(g.description.identifier);
    for (const k of Object.keys(d ?? {})) if (k.startsWith("geometry.")) geometries.add(k.split(":")[0]);
  }
  let blocks = 0;
  const mixedReported = new Set();
  for (const file of walk(join(BP, "blocks"), ".json")) {
    const b = readJson(file)?.["minecraft:block"];
    if (!b) continue;
    blocks++;
    const sets = [b.components ?? {}, ...(b.permutations ?? []).map((p) => p.components ?? {})];
    for (const c of sets) {
      const geo = c["minecraft:geometry"];
      const id = typeof geo === "string" ? geo : geo?.identifier;
      if (id && !id.startsWith("minecraft:") && !geometries.has(id)) fail(`${rel(file)}: geometry "${id}" is not defined in ${rel(RP)}/models`);
      const mi = c["minecraft:material_instances"];
      if (mi) {
        const methods = new Set(Object.values(mi).filter((v) => v && typeof v === "object").map((v) => v.render_method ?? "opaque"));
        if (methods.size > 1 && !mixedReported.has(file) && mixedReported.add(file)) fail(`${rel(file)}: material_instances mix render methods (${[...methods].join(", ")}); the game needs one per block`);
      }
    }
  }
  // 5. Player render molang: the menu paper doll has no actor, so query.property needs a query.has_property guard.
  const playerFiles = [join(RP, "entity/player.entity.json"), ...walk(join(RP, "render_controllers"), ".json")].filter(existsSync);
  for (const file of playerFiles) {
    const text = readFileSync(file, "utf8");
    if (file.endsWith("player.entity.json") || /player|hc_looks/.test(file)) {
      for (const m of text.matchAll(/"([^"\n]*query\.property\('([^']+)'\)[^"\n]*)"/g)) {
        if (!m[1].includes(`query.has_property('${m[2]}')`)) fail(`${rel(file)}: query.property('${m[2]}') without query.has_property('${m[2]}') (errors on the menu paper doll)`);
      }
    }
  }
  console.log(`${entities} entities, ${anims} animations, ${blocks} blocks, ${geometries.size} geometries`);
}

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

// ---------- 2c. sounds ----------
// Every custom sound has its file, every installed recording is wired in, and scripts play sounds through sfx().
step("Sounds");
{
  const defsFile = join(RP, "sounds/sound_definitions.json");
  const defs = existsSync(defsFile) ? parseJson(readFileSync(defsFile, "utf8")).sound_definitions ?? {} : {};
  for (const [id, def] of Object.entries(defs)) {
    for (const s of def.sounds ?? []) {
      const name = typeof s === "string" ? s : s.name;
      if (name?.startsWith("sounds/siege/") && !["ogg", "wav", "fsb"].some((ext) => existsSync(join(RP, `${name}.${ext}`)))) fail(`sound ${id}: no file at ${name}.ogg`);
    }
  }
  const installedFile = join(SCRIPTS, "core/sfx_installed.js");
  let installed = 0;
  if (existsSync(installedFile)) {
    for (const [, id] of readFileSync(installedFile, "utf8").matchAll(/^\s*"([^"]+)":/gm)) {
      installed++;
      if (!defs[id]) fail(`core/sfx_installed.js lists ${id}, but sound_definitions.json does not define it (run python3 tools/install_sounds.py)`);
    }
  }
  let direct = 0;
  for (const file of walk(SCRIPTS, ".js")) {
    if (rel(file).endsWith("core/sfx.js") || rel(file).endsWith("dragons/voice.js")) continue;
    const n = (readFileSync(file, "utf8").match(/\.playSound\??\.?\(/g) ?? []).length;
    if (n) { direct += n; warnings.push(`${rel(file)}: ${n} direct playSound call(s). Use sfx() from core/sfx.js so the sound gets the house treatment (SOUND-LIST.md).`); }
  }
  // every sound id the game is asked to play must exist: Bedrock plays nothing (and says nothing) for an unknown id
  const vanillaFile = join(TOOLS, "vanilla_sounds.json");
  if (existsSync(vanillaFile)) {
    const known = new Set([...(parseJson(readFileSync(vanillaFile, "utf8")) ?? []), ...Object.keys(defs)]);
    const cuesSrc = readFileSync(join(SCRIPTS, "core/sfx_cues.js"), "utf8");
    const cueNames = new Set([...cuesSrc.matchAll(/^\s*(?:\[BELL\]|"([^"]+)"):\s*\{/gm)].map((m) => m[1] ?? "block.bell.hit"));
    for (const [, id] of cuesSrc.matchAll(/\[\s*"([a-z0-9_.]+)"\s*,\s*[\d.]+/g)) if (!known.has(id)) fail(`core/sfx_cues.js: a layer plays "${id}", which is not a Bedrock sound`);
    for (const file of walk(SCRIPTS, ".js")) {
      for (const [, id] of readFileSync(file, "utf8").matchAll(/\bsfx\([^,()]+,\s*"([a-z0-9_.]+)"/g)) {
        if (!known.has(id) && !cueNames.has(id)) fail(`${rel(file)}: sfx(..., "${id}") is not a Bedrock sound or a cue in core/sfx_cues.js`);
      }
    }
    const sj = join(RP, "sounds.json");
    const ents = existsSync(sj) ? parseJson(readFileSync(sj, "utf8"))?.entity_sounds?.entities ?? {} : {};
    for (const [ent, e] of Object.entries(ents)) {
      for (const [ev, s] of Object.entries(e.events ?? {})) {
        const id = typeof s === "string" ? s : s?.sound;
        if (id && !known.has(id)) fail(`sounds.json: ${ent} ${ev} plays "${id}", which is not a Bedrock sound (studio/bestiary/voices.py)`);
      }
    }
  }
  const listed = spawnSync(process.execPath, [join(TOOLS, "sound-list.mjs"), "--check"]);
  if (listed.status !== 0) fail("SOUND-LIST.md is out of date: run  node tools/sound-list.mjs");
  console.log(`${Object.keys(defs).length} custom sounds defined, ${installed} recordings installed, ${direct} direct playSound calls`);
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
  const asts = new Map();
  for (const file of scripts) {
    try { asts.set(file, acorn.parse(readFileSync(file, "utf8"), { ecmaVersion: "latest", sourceType: "module", locations: true, ranges: true })); } catch { /* reported below */ }
  }
  // What each file exports (names), following `export * from` and `export { x } from`.
  const exportCache = new Map();
  const exportsOf = (file, seen = new Set()) => {
    if (exportCache.has(file)) return exportCache.get(file);
    if (seen.has(file)) return new Set();
    seen.add(file);
    const out = new Set();
    for (const n of asts.get(file)?.body ?? []) {
      if (n.type === "ExportNamedDeclaration") {
        if (n.declaration?.id) out.add(n.declaration.id.name);
        for (const d of n.declaration?.declarations ?? []) {
          const names = (p) => (p.type === "Identifier" ? [p.name] : p.type === "ObjectPattern" ? p.properties.flatMap((q) => names(q.value ?? q.argument)) : p.type === "ArrayPattern" ? p.elements.filter(Boolean).flatMap(names) : p.type === "AssignmentPattern" ? names(p.left) : p.type === "RestElement" ? names(p.argument) : []);
          names(d.id).forEach((x) => out.add(x));
        }
        for (const s of n.specifiers ?? []) out.add(s.exported.name ?? s.exported.value);
      } else if (n.type === "ExportDefaultDeclaration") out.add("default");
      else if (n.type === "ExportAllDeclaration") {
        if (n.exported) out.add(n.exported.name);
        else for (const x of exportsOf(resolve(dirname(file), n.source.value), seen)) if (x !== "default") out.add(x);
      }
    }
    exportCache.set(file, out);
    return out;
  };
  for (const [file, ast] of asts) {
    const imported = new Set();
    for (const n of ast.body) {
      if ((n.type === "ImportDeclaration" || (n.type === "ExportNamedDeclaration" && n.source)) && n.source.value.startsWith(".")) {
        const target = resolve(dirname(file), n.source.value);
        if (!asts.has(target)) continue;
        const have = exportsOf(target);
        for (const s of n.specifiers) {
          const name = n.type === "ImportDeclaration" ? (s.type === "ImportDefaultSpecifier" ? "default" : s.type === "ImportNamespaceSpecifier" ? null : s.imported.name) : s.local.name;
          if (name && !have.has(name)) failIn(file, `${rel(file)}:${n.loc.start.line} imports "${name}" from "${n.source.value}", which does not export it (Minecraft stops loading every script: "Could not find export")`);
        }
      }
      if (n.type === "ImportDeclaration") for (const s of n.specifiers) imported.add(s.local.name);
    }
    // Minecraft's script engine can fail to link `import { x } from "a"; export { x };` when modules import each other
    // in a circle (first playtest: "Could not find export 'AFTER'"). Write it as `export { x } from "a";` instead.
    for (const n of ast.body) {
      if (n.type === "ExportNamedDeclaration" && !n.source && !n.declaration) {
        for (const s of n.specifiers) if (imported.has(s.local.name)) failIn(file, `${rel(file)}:${n.loc.start.line} re-exports the imported "${s.local.name}" with a plain export list; write export { ${s.local.name} } from "..." instead`);
      }
    }
  }
  for (const file of scripts) {
    const ast = asts.get(file);
    if (!ast) {
      try { acorn.parse(readFileSync(file, "utf8"), { ecmaVersion: "latest", sourceType: "module" }); } catch (e) { failIn(file, `${rel(file)}: syntax error ${e.message}`); }
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
  const { runTests, OFFLINE_ONLY, testNames } = await import(pathToFileURL(join(SCRIPTS, "core/tests.js")).href);
  // A test that is slow here is many times slower inside Minecraft, where one long test makes the watchdog
  // shut the world down. Slow tests must be listed in OFFLINE_ONLY (core/tests.js) so the game skips them.
  const SLOW_MS = 15;
  const timings = new Map();
  let result = runTests({ inGame: false, slow: (name, ms) => timings.set(name, ms) });
  const suspects = [...timings].filter(([name, ms]) => ms >= SLOW_MS && !OFFLINE_ONLY.has(name)).map(([name]) => name);
  if (suspects.length) { // time them once more, so a one-off pause on this machine is not blamed on a test
    const again = new Map();
    result = runTests({ inGame: false, slow: (name, ms) => again.set(name, ms) });
    for (const name of suspects) if (again.get(name) >= SLOW_MS) fail(`self-test "${name}" takes ${again.get(name)} ms here, too slow to run inside Minecraft: add it to OFFLINE_ONLY in core/tests.js (or make it lighter)`);
  }
  const known = new Set(testNames());
  for (const name of OFFLINE_ONLY) if (!known.has(name)) fail(`core/tests.js OFFLINE_ONLY lists "${name}", but no test has that name`);
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
