#!/usr/bin/env node
// Offline check for Siege Nights. Run from the siege-nights folder:   node tools/check.mjs
//
//  1. every pack JSON file parses
//  2. every script import points at a real file
//  3. no undefined names and no unused imports in the scripts (needs `npm ci` in tools/ once; a problem if it can't run)
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

  // 3c. Held items: every geometry the player entity uses must keep vanilla's bone path to the item bones
  // (rightItem under rightArm, rightArm under body). Bedrock floats held items at the chest or face otherwise
  // (playtest 1.2.1116: items under the forearm). See docs/PLAYER-ANIMATIONS.md.
  {
    const ep = join(RP, "entity/player.entity.json");
    const pgeo = new Set(Object.values(readJson(ep)?.["minecraft:client_entity"]?.description?.geometry ?? {}));
    // Held items are placed from the DEFAULT geometry, so while a look is drawn the hidden item carrier
    // (default geometry, every part hidden) must be drawn too, or items stay still while the arm moves.
    const prc = readJson(ep)?.["minecraft:client_entity"]?.description?.render_controllers ?? [];
    const names = prc.map((e) => (typeof e === "string" ? e : Object.keys(e)[0]));
    const firstLook = names.findIndex((n) => n.startsWith("controller.render.hc_look.") && n !== "controller.render.hc_look.item_carrier");
    const carrier = names.indexOf("controller.render.hc_look.item_carrier");
    if (firstLook >= 0 && (carrier < 0 || carrier > firstLook)) fail(`${rel(ep)}: the hidden item carrier must come before the look render controllers; run python3 tools/build_player_joints.py`);
    const PATH = { rightItem: "rightArm", leftItem: "leftArm", rightArm: "body", leftArm: "body" };
    for (const file of walk(join(RP, "models/entity"), ".json")) {
      for (const g of readJson(file)?.["minecraft:geometry"] ?? []) {
        if (!pgeo.has(g?.description?.identifier)) continue;
        for (const b of g.bones ?? []) {
          const want = PATH[b.name];
          if (want && b.parent !== want) fail(`${rel(file)}: ${b.name} hangs on "${b.parent}", must hang on "${want}" or held items float (vanilla bone path)`);
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

// ---------- 2b2. no vanilla monsters ----------
// Rule (Mateo 2026-11-13): vanilla monsters never spawn; our own creatures (siege:*) are this world's monsters.
// So no script may hand a vanilla monster straight to spawnEntity() or summon(), as a string or through a const.
// (Sieges plan with vanilla ids and spawnRaider() swaps every one for ours: see bestiary/spawns.js.)
step("No vanilla monsters spawned");
{
  const MONSTER = /^minecraft:(zombie|zombie_villager(_v2)?|husk|drowned|skeleton|stray|bogged|parched|creeper|spider|cave_spider|enderman|endermite|silverfish|witch|slime|phantom|pillager|vindicator|evoker|evocation_illager|vex|ravager|guardian|elder_guardian|zombie_horse|skeleton_horse|camel_husk|zombie_nautilus|zombie_pigman|piglin|piglin_brute|hoglin|zoglin|blaze|ghast|magma_cube|wither_skeleton)$/;
  let bad = 0;
  for (const file of scripts) {
    const src = readFileSync(file, "utf8");
    const consts = Object.fromEntries([...src.matchAll(/const\s+(\w+)\s*=\s*["'`]([^"'`]+)["'`]/g)].map((m) => [m[1], m[2]]));
    for (const m of src.matchAll(/(?:spawnEntity|\.summon)\(/g)) {
      // the first argument: up to the first comma or close bracket outside brackets (a ternary counts too)
      let i = m.index + m[0].length, depth = 0, arg = "";
      for (; i < src.length && arg.length < 300; i++) {
        const c = src[i];
        if ("([{".includes(c)) depth++;
        else if (")]}".includes(c)) { if (!depth) break; depth--; } else if (c === "," && !depth) break;
        arg += c;
      }
      const ids = [...arg.matchAll(/["'`]([^"'`]+)["'`]/g)].map((x) => x[1]).concat([...arg.matchAll(/\b([A-Z_][A-Z0-9_]*)\b/g)].map((x) => consts[x[1]]).filter(Boolean));
      for (const id of ids) if (MONSTER.test(id)) { bad++; failIn(file, `${rel(file)}: spawns the vanilla monster ${id}. Use one of our own creatures (siege:*).`); }
    }
  }
  console.log(bad ? `${bad} vanilla monster spawn(s)` : "no script spawns a vanilla monster");
}

// ---------- 2b4. safe inside the walls ----------
// Rule (Mateo 2026-11-13): hostile mobs never spawn inside a settlement's walls or a town, only out in the wild.
// Natural spawns are caught by bestiary/sheltered.js, which knows the wild monsters from gentle.js WILD. So every
// creature with a "monster" spawn rule must be in WILD, or it could spawn inside the walls unseen.
step("Hostile mobs stay out of settlements");
{
  const gentle = readFileSync(join(SCRIPTS, "bestiary/gentle.js"), "utf8");
  const wild = new Set([...(gentle.match(/export const WILD = \[([^\]]*)\]/)?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1]));
  const dir = join(BP, "spawn_rules");
  let bad = 0, monsters = 0;
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    let rule;
    try { rule = parseJson(readFileSync(join(dir, f), "utf8"))["minecraft:spawn_rules"]; } catch { continue; } // step 1 reports it
    const id = rule?.description?.identifier;
    if (!id || id.startsWith("minecraft:") || !(rule.conditions ?? []).length) continue; // vanilla: core/nomonsters.js
    if (rule.description.population_control !== "monster") continue;
    monsters++;
    if (!wild.has(id)) { bad++; fail(`spawn_rules/${f}: ${id} spawns as a monster but is not in bestiary/gentle.js WILD, so it could spawn inside a settlement's walls (bestiary/sheltered.js).`); }
  }
  for (const id of wild) if (!existsSync(join(dir, `bestiary_${id.replace(/^siege:/, "")}.json`))) { bad++; fail(`bestiary/gentle.js WILD lists ${id}, which has no spawn rule.`); }
  if (!/shelteredAt\(at, dim\.id\)/.test(readFileSync(join(SCRIPTS, "bestiary/spawns.js"), "utf8"))) { bad++; fail("bestiary/spawns.js: Hollow things must ask shelteredAt() before they spawn."); }
  // the sweep (bestiary/sheltered.js) finds strays with families: ["monster"], so every wild hostile body must carry it
  const { MOBS } = await import(pathToFileURL(join(SCRIPTS, "bestiary/data.js")).href);
  const wildFamilies = ["wild_hostile", "undead", "hollow"];
  for (const [id, m] of Object.entries(MOBS)) {
    if (!wildFamilies.includes(m.family) && !wild.has(id)) continue;
    const file = join(BP, "entities/bestiary", `${id.replace(/^siege:/, "")}.json`);
    if (!existsSync(file)) continue;
    const fam = parseJson(readFileSync(file, "utf8"))?.["minecraft:entity"]?.components?.["minecraft:type_family"]?.family ?? [];
    if (!fam.includes("monster")) { bad++; fail(`${rel(file)}: ${id} is a wild hostile but lacks the "monster" family, so the walls sweep can't find it.`); }
  }
  console.log(bad ? `${bad} problem(s)` : `${monsters} wild monster spawn rule(s), all kept out of settlements and towns`);
}

// ---------- 2b5. creatures take knockback ----------
// Rule (Mateo 2026-11-13: "When you hit a mob they should knock back like vanilla"). Bedrock rolls
// minecraft:knockback_resistance as a chance per hit, so anything between 0 and 1 means some blows do nothing at all.
// Every creature is 0, except bosses (siege_boss) and heavy creatures (siege_heavy), which are 1 and rock back a little
// by script (bestiary/stagger.js), and creatures built not to move (movement 0). NPCs, guards, mounts, dragons and
// props are not creatures you fight, so they are left alone.
step("Creatures take knockback");
{
  const NOT_FOES = ["npc", "villager", "inanimate", "siege_dragon", "horse", "player", "siege_guard"];
  const stagger = existsSync(join(SCRIPTS, "bestiary/stagger.js")) ? readFileSync(join(SCRIPTS, "bestiary/stagger.js"), "utf8") : "";
  let bad = 0, foes = 0, resisting = 0;
  for (const f of walk(join(BP, "entities"), ".json")) {
    let ent;
    try { ent = parseJson(readFileSync(f, "utf8"))["minecraft:entity"]; } catch { continue; } // step 1 reports it
    const c = ent?.components ?? {};
    const fam = c["minecraft:type_family"]?.family ?? [];
    if (!fam.includes("mob") || fam.some((x) => NOT_FOES.includes(x))) continue;
    foes++;
    const allowed = fam.includes("siege_boss") || fam.includes("siege_heavy") || c["minecraft:movement"]?.value === 0;
    const kbs = [c, ...Object.values(ent.component_groups ?? {})].map((g) => g["minecraft:knockback_resistance"]?.value).filter((v) => v !== undefined);
    for (const kb of kbs) {
      if (kb > 0 && kb < 1) { bad++; fail(`${rel(f)}: knockback_resistance ${kb} is a dice roll in Bedrock (some hits don't move it at all). Use 0, or 1 for a boss or siege_heavy creature.`); }
      else if (kb >= 1 && !allowed) { bad++; fail(`${rel(f)}: ${ent.description?.identifier} shrugs off all knockback. Ordinary creatures take vanilla knockback (0); only siege_boss or siege_heavy creatures resist (studio/bestiary/build.py HEAVY).`); }
      else if (kb >= 1) resisting++;
    }
  }
  for (const fam of ["siege_boss", "siege_heavy"]) if (!stagger.includes(`"${fam}"`)) { bad++; fail(`bestiary/stagger.js must give ${fam} creatures their small stagger, or they never react to a hit.`); }
  console.log(bad ? `${bad} problem(s)` : `${foes} creatures take vanilla knockback or a stagger (${resisting} bosses and heavy ones stagger)`);
}

// ---------- 2b6. every creature that fights guards has its own guard damage ----------
// Rule (Mateo 2026-11-14: "We need to have custom damage parameters for each mob"). scripts/siege/guarddamage_data.js
// has a line for each: its ordinary blow (base) and what it does to a guard. base must match the entity file's attack.
step("Every creature has its own damage against guards");
{
  const { GUARD_DAMAGE } = await import(pathToFileURL(join(SCRIPTS, "siege/guarddamage_data.js")).href);
  let bad = 0, n = 0;
  for (const f of walk(join(BP, "entities"), ".json")) {
    let ent;
    try { ent = parseJson(readFileSync(f, "utf8"))["minecraft:entity"]; } catch { continue; }
    const id = ent?.description?.identifier;
    const c = ent?.components ?? {};
    const fam = c["minecraft:type_family"]?.family ?? [];
    if (fam.includes("siege_guard") || !JSON.stringify(ent).includes("\"siege_guard\"")) continue; // doesn't fight guards
    const attack = [c, ...Object.values(ent.component_groups ?? {})].map((g) => g["minecraft:attack"]?.damage).find((d) => typeof d === "number");
    if (!attack) continue; // no blow of its own (scripted only)
    n++;
    const line = GUARD_DAMAGE[id];
    if (!line) { bad++; fail(`${rel(f)}: ${id} fights guards but has no line in scripts/siege/guarddamage_data.js (how hard it hits a guard).`); }
    else if (line.base !== attack) { bad++; fail(`scripts/siege/guarddamage_data.js: ${id} base ${line.base}, but its entity file's attack is ${attack}. Update base (and guard if it should change too).`); }
  }
  console.log(bad ? `${bad} problem(s)` : `${n} creatures that fight guards, each with its own guard damage`);
}

// ---------- 2b3. every NPC has its own skin ----------
// Rule (Mateo 2026-11-13: "make sure everyone has a skin"): no NPC shows Bedrock's default skin. Our packs replace the
// built-in NPC's skins with ours (core/npc_skins_data.js, painted by studio/art/build_npc_skins.py), every script that
// spawns minecraft:npc dresses it with dressNpc(), nobody sets skinIndex by hand, and every NPC-family entity of our
// own has its pictures. 2026-11-14 ("make sure every NPC has a skin", again): spawns through constants exported from
// other files and runCommand("summon ...") count too, no .mcfunction summons people, a script that spawns a vanilla
// villager or wandering trader must say why on that line ("// vanilla villager on purpose: ..."), and a skin picked by
// an entity property can never point past the end of its list.
step("Every NPC has a skin");
{
  let bad = 0;
  const no = (file, msg) => { bad++; file ? failIn(file, msg) : fail(msg); };
  const dataFile = join(SCRIPTS, "core/npc_skins_data.js");
  const keys = existsSync(dataFile)
    ? [...readFileSync(dataFile, "utf8").split("NPC_SKINS = [")[1].split("];")[0].replace(/\/\/[^\n]*/g, "").matchAll(/"([a-z0-9_]+)"/g)].map((m) => m[1])
    : [];
  if (!keys.length) no(null, "core/npc_skins_data.js is missing or lists no NPC skins");
  for (const k of keys) if (!existsSync(join(RP, `textures/entity/siege/npc_skins/${k}.png`))) no(null, `NPC skin "${k}" has no picture: run python3 studio/art/build_npc_skins.py`);
  const read = (f) => (existsSync(f) ? parseJson(readFileSync(f, "utf8")) : undefined);
  const ce = read(join(RP, "entity/npc.entity.json"))?.["minecraft:client_entity"]?.description;
  const rc = read(join(RP, "render_controllers/siege_npc.render_controllers.json"))?.render_controllers?.["controller.render.siege_npc"];
  const bp = read(join(BP, "entities/npc.json"))?.["minecraft:entity"];
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  if (ce?.identifier !== "minecraft:npc" || !same(Object.keys(ce?.textures ?? {}), keys)) no(null, "Siege_Nights_RP/entity/npc.entity.json does not match core/npc_skins_data.js: run python3 studio/art/build_npc_skins.py");
  if (!same(rc?.arrays?.textures?.["Array.skins"], keys.map((k) => `Texture.${k}`))) no(null, "the siege_npc render controller does not match core/npc_skins_data.js: run python3 studio/art/build_npc_skins.py");
  const list = bp?.components?.["minecraft:npc"]?.npc_data?.skin_list ?? [];
  if (bp?.description?.identifier !== "minecraft:npc" || !same(list.map((x) => x.variant), keys.map((_, i) => i))) no(null, "Siege_Nights_BP/entities/npc.json skin_list does not match core/npc_skins_data.js: run python3 studio/art/build_npc_skins.py");
  // story people, wonder keepers: each has a key
  try {
    const { NPCS } = await import(pathToFileURL(join(SCRIPTS, "lore/data/dialogue.js")).href);
    for (const n of NPCS) if (!keys.includes(`lore_${n.id}`)) no(null, `story NPC "${n.id}" has no skin: add "lore_${n.id}" to the end of core/npc_skins_data.js and a look in build_npc_skins.py`);
    const { WONDERS } = await import(pathToFileURL(join(SCRIPTS, "wonders/data.js")).href);
    for (const w of WONDERS ?? []) if (!keys.includes(`keeper_${w.id}`)) no(null, `wonder keeper "${w.id}" has no skin: add "keeper_${w.id}"`);
  } catch (e) { no(null, `could not read the NPC lists for the skin check: ${e}`); }
  // What each spawnEntity() / summon in our scripts makes. A type can be a literal, a const in the file, a const
  // exported from any other script, or an object field (RETURNED.type -> type: "...").
  const PEOPLE_VANILLA = ["minecraft:villager_v2", "minecraft:villager", "minecraft:wandering_trader"];
  const ON_PURPOSE = /vanilla villager on purpose:/;
  const srcOf = new Map(scripts.map((f) => [f, readFileSync(f, "utf8")]));
  const exported = {};
  for (const src of srcOf.values()) for (const m of src.matchAll(/export\s+const\s+(\w+)\s*=\s*["'`]([^"'`]+)["'`]/g)) exported[m[1]] = m[2];
  for (const [file, src] of srcOf) {
    const r = rel(file);
    if (/\.skinIndex\s*=(?!=)/.test(src) && !r.endsWith("core/npc_skins.js")) no(file, `${r}: sets skinIndex by hand. Use dressNpc(entity, key) from core/npc_skins.js.`);
    const consts = { ...exported, ...Object.fromEntries([...src.matchAll(/const\s+(\w+)\s*=\s*["'`]([^"'`]+)["'`]/g)].map((m) => [m[1], m[2]])) };
    const lines = src.split("\n");
    const made = []; // { type, line }
    lines.forEach((ln, i) => {
      for (const m of ln.matchAll(/spawnEntity\(\s*(?:["'`]([^"'`]+)["'`]|([A-Za-z_][\w.]*))\s*,/g)) {
        let type = m[1];
        if (!type && m[2]) {
          const parts = m[2].split(".");
          const body = parts.length === 2 ? src.match(new RegExp(`const\\s+${parts[0]}\\s*=\\s*\\{([\\s\\S]*?)\\n\\};?`))?.[1] : undefined;
          type = parts.length === 1 ? consts[parts[0]] : body?.match(new RegExp(`\\b${parts[1]}\\s*:\\s*["'\`]([^"'\`]+)["'\`]`))?.[1];
        }
        if (type) made.push({ type, line: i });
      }
      for (const m of ln.matchAll(/\bsummon\s+((?:minecraft:)?[a-z0-9_]+)\b/g)) if (/runCommand|["'`]/.test(ln)) made.push({ type: m[1].includes(":") ? m[1] : `minecraft:${m[1]}`, line: i });
    });
    if (made.some((x) => x.type === "minecraft:npc") && !/\bdressNpc\(/.test(src)) no(file, `${r}: spawns minecraft:npc but never calls dressNpc(), so it would wear no skin of ours`);
    // A person in a vanilla villager's coat is the default look too: talking people are minecraft:npc (dressNpc) or one
    // of our own entities. Only villagers that must pass for any vanilla villager (the Returned) may stay, marked so.
    for (const x of made) {
      if (!PEOPLE_VANILLA.includes(x.type)) continue;
      if (ON_PURPOSE.test(lines[x.line]) || ON_PURPOSE.test(lines[x.line - 1] ?? "")) continue;
      no(file, `${r}:${x.line + 1}: spawns ${x.type}, which wears Bedrock's own villager look. Spawn minecraft:npc and dressNpc() it, or mark the line "// vanilla villager on purpose: <why>"`);
    }
  }
  // no .mcfunction summons an NPC or a villager: nothing there can dress it
  for (const f of [join(BP, "functions"), join(ROOT, "map")].filter((d) => existsSync(d)).flatMap((d) => walk(d, ".mcfunction"))) {
    const src = readFileSync(f, "utf8");
    if (/\bsummon\s+(minecraft:)?(npc|villager_v2|villager|wandering_trader)\b/.test(src)) no(null, `${rel(f)}: summons an NPC or villager from a function, where it gets no skin of ours. Spawn it from a script with dressNpc().`);
  }
  // our own people (job NPCs, townsfolk, soldiers, champions, quartermaster, ...) have a client entity with real
  // pictures, and a skin picked by a property never points past the end of its list
  const PEOPLE = ["npc", "villager", "siege_guard", "siege_townsfolk", "siege_champion", "quartermaster", "ashen_order", "siege_arena_crowd"];
  const clients = new Map();
  for (const f of walk(join(RP, "entity"), ".json")) { const d = read(f)?.["minecraft:client_entity"]?.description; if (d?.identifier) clients.set(d.identifier, d); }
  const rcs = {};
  for (const f of walk(join(RP, "render_controllers"), ".json")) Object.assign(rcs, read(f)?.render_controllers ?? {});
  let people = 0;
  for (const f of walk(join(BP, "entities"), ".json")) {
    const e = read(f)?.["minecraft:entity"];
    const id = e?.description?.identifier;
    if (!id || id.startsWith("minecraft:") || !(e.components?.["minecraft:type_family"]?.family ?? []).some((x) => PEOPLE.includes(x))) continue;
    people++;
    const d = clients.get(id);
    const tex = Object.values(d?.textures ?? {});
    if (!tex.length) { no(null, `${id} is a person with no skin (no client entity textures)`); continue; }
    for (const t of tex) if (/textures\/entity\/(npc|villager|villager2|wandering_trader|steve|alex)\b/.test(t) || !["png", "tga"].some((x) => existsSync(join(RP, `${t}.${x}`)))) no(null, `${id}: skin ${t} is missing or a vanilla one`);
    for (const rcName of (d.render_controllers ?? []).map((x) => (typeof x === "string" ? x : Object.keys(x)[0]))) {
      const rc = rcs[rcName];
      for (const t of rc?.textures ?? []) {
        const m = /^(Array\.\w+)\[q(?:uery)?\.property\('([\w:]+)'\)\]$/.exec(t);
        if (!m) continue;
        const n = rc.arrays?.textures?.[m[1]]?.length ?? 0;
        const range = e.description.properties?.[m[2]]?.range;
        if (!range || range[0] !== 0 || range[1] !== n - 1) no(null, `${id}: property ${m[2]} runs ${JSON.stringify(range)} but ${m[1]} has ${n} skins, so some would show no skin`);
        for (const x of rc.arrays?.textures?.[m[1]] ?? []) if (!(x.split(".")[1] in (d.textures ?? {}))) no(null, `${id}: ${x} is in ${m[1]} but not in the client entity's textures`);
      }
    }
  }
  console.log(bad ? `${bad} NPC skin problem(s)` : `${keys.length} NPC skins; every NPC spawner dresses its NPCs; ${people} kinds of our own people have their skins; no stray vanilla villagers`);
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
  const weather = spawnSync(process.execPath, [join(TOOLS, "weather_assets.mjs"), "--check"]);
  if (weather.status !== 0) fail("the weather fogs and particles are out of date: run  node tools/weather_assets.mjs");
  console.log(`${Object.keys(defs).length} custom sounds defined, ${installed} recordings installed, ${direct} direct playSound calls`);
}

// ---------- 2c. the land at the thin places ----------
// map/thinplaces shapes the map at the seven thin places. Each place must hold its own water and keep it off the
// cave floor (water written beside lower dry ground pours out in the game the first time a block changes).
step("Thin place land");
{
  const r = spawnSync(process.execPath, [join(ROOT, "map/thinplaces/test_shapes.mjs")], { encoding: "utf8" });
  if (r.status !== 0) for (const line of ((r.stdout || "") + (r.stderr || "")).split("\n").filter(Boolean).slice(0, 12)) fail(`thin place land: ${line}`);
  else console.log((r.stdout || "").trim());
}

// ---------- 2c2. wall-hung blocks in the baked world files ----------
// Item frames, ladders, buttons and wall signs need a wall behind them, or they drop off (tools/hung-check.mjs).
step("Wall-hung blocks have a wall");
{
  const r = spawnSync(process.execPath, [join(TOOLS, "hung-check.mjs")], { encoding: "utf8" });
  for (const line of ((r.stdout || "") + (r.stderr || "")).split("\n").filter(Boolean).slice(0, 20)) fail(`hung on nothing: ${line}`);
  if (r.status === 0) console.log("every item frame, ladder, button and wall sign has a wall");
}

// ---------- 2c3. nothing floats in a landmark design ----------
step("Landmark designs have nothing floating");
{
  const r = spawnSync(process.execPath, [join(TOOLS, "landmark-float-check.mjs")], { encoding: "utf8" });
  for (const line of ((r.stdout || "") + (r.stderr || "")).split("\n").filter(Boolean).slice(0, 20)) fail(`floating: ${line}`);
  if (r.status === 0) console.log("every rigid landmark design stands on its ground");
}

// ---------- 2d. build catalog ----------
// Every build, designed or not, is listed in builds/catalog.json (tools/build-catalog.mjs).
step("Build catalog");
{
  const r = spawnSync(process.execPath, [join(TOOLS, "build-catalog.mjs"), "--check"], { encoding: "utf8" });
  for (const line of (r.stdout || "").split("\n").filter(Boolean)) fail(line);
  if (r.status !== 0 && !(r.stdout || "").trim()) fail("tools/build-catalog.mjs --check failed: " + (r.stderr || "").trim().split("\n").pop());
  if (r.status === 0) console.log(`${JSON.parse(readFileSync(join(ROOT, "builds/catalog.json"), "utf8")).builds.length} builds listed, CATALOG.md up to date`);
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
    // not optional any more: a name used without its import (getRift in the veil gate, PR #225) passed every other check
    console.log("could not run");
    fail("the undefined-name check could not run: run `npm ci` in tools/ once, then check again");
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
  mock.endEarly();
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

// ---------- 6b. every building on a plot (Mateo 2026-11-14) ----------
// No building is placed with a block, every stage building has a plot (the self-tests seat them on every layout),
// you level up by building all of your stage, and the story sends you to each one (settle/config.js STAGES).
if (loaded) {
  step("Every building on a plot, in a stage, with a story step");
  const C = await import(pathToFileURL(join(SCRIPTS, "settle/config.js")).href);
  const { ACT_STEPS, parseStep } = await import(pathToFileURL(join(SCRIPTS, "quests/acts.js")).href);
  const entries = C.STAGES.flatMap((s) => s.build.map((b) => ({ ...b, stage: s.name })));
  const byId = new Map(entries.map((b) => [b.id, b]));
  for (const file of walk(join(BP, "recipes"), ".json")) {
    let out = [];
    try {
      const r = Object.values(parseJson(readFileSync(file, "utf8")))[1] ?? {};
      out = [r.result].flat().filter(Boolean).map((x) => (typeof x === "string" ? x : x.item));
    } catch { continue; }
    for (const id of out) {
      if (!(id in C.RAISING_BLOCKS)) continue;
      const entry = byId.get(C.RAISING_BLOCKS[id]);
      if (entry?.pending) warnings.push(`${rel(file)} still crafts ${id}: the ${entry.name} waits for ${entry.pending}`);
      else if (C.CRAFT_LEFT[id]) warnings.push(`${rel(file)} still crafts ${id}: ${C.CRAFT_LEFT[id]}`);
      else fail(`${rel(file)} crafts ${id}, a block that raises a building: buildings are only picked at a Plot Marker`);
    }
  }
  const toWrite = {};
  for (const b of entries) {
    const st = parseStep(b.step);
    if (st && !ACT_STEPS[st.act]) (toWrite[st.act] ??= []).push(`${b.name} (${b.stage}, from ${b.from})`);
    if (b.pending) warnings.push(`${b.stage} stage: the ${b.name} has no plot yet (${b.pending}); the level-up skips it until it does`);
  }
  for (const [act, list] of Object.entries(toWrite)) warnings.push(`${act} is not written yet; it must send the player to build: ${list.join(", ")}`);
  const ex = spawnSync(process.execPath, [join(TOOLS, "export_stages.mjs"), "--check"], { encoding: "utf8" });
  if (ex.status !== 0) fail((ex.stdout || ex.stderr || "tools/export_stages.mjs --check failed").trim());
  console.log(`${entries.length} stage buildings, ${entries.filter((b) => b.pending).length} waiting for a plot, ${Object.values(toWrite).flat().length} story steps still to write`);
}

// ---------- 7. terraform: the game's copy gives the same ground as the map's ----------
{
  step("Terraform: settle/terraform.js against map/structures/terraform_cases.json");
  const TF = await import(pathToFileURL(join(SCRIPTS, "settle/terraform.js")).href);
  const cases = JSON.parse(readFileSync(join(ROOT, "map/structures/terraform_cases.json"), "utf8"));
  const roundEven = (v) => { const f = Math.floor(v), r = v - f; return r > 0.5 ? f + 1 : r < 0.5 ? f : f % 2 === 0 ? f : f + 1; };
  const LAND = { // terraform_test.py land()
    flat: () => 64, slope2: (i) => 64 + Math.floor(i / 2), slope1: (i) => 60 + i,
    bumpy: (i, j) => 64 + roundEven(3 * Math.sin(i / 3) + 2 * Math.cos(j / 4)), cliff: (i) => (i < 15 ? 64 : 72),
  };
  let bad = 0;
  for (const c of cases) {
    const n = 31, h = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => LAND[c.land](i, j)));
    const sites = c.sites.map(({ box: [x0, z0, w, d], fill = "stone", door = true }) => {
      const cells = [];
      for (let i = x0; i < x0 + w; i++) for (let j = z0; j < z0 + d; j++) cells.push([i, j]);
      const y = TF.padHeight(cells.map(([i, j]) => h[i][j]));
      const con = new Map();
      if (door) for (const s of [-1, 0, 1]) for (let t = 0; t < 4; t++) con.set(`${x0 + (w >> 1) + s},${z0 + d + t}`, y);
      return TF.site({ pad: new Map(cells.map(([i, j]) => [`${i},${j}`, y])), connectors: con, padFill: fill });
    });
    const { T } = TF.solve(h, sites);
    if (JSON.stringify(T) !== JSON.stringify(c.expect)) { bad++; fail(`terraform.js: case "${c.name}" gives different ground from terraform.py`); }
  }
  if (!bad) console.log(`${cases.length} cases match`);
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
