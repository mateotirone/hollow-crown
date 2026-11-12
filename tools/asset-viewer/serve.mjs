#!/usr/bin/env node
// The live asset viewer: every build and every 3D model of the add-on in one browser page that keeps
// itself up to date.
//
//   node tools/asset-viewer/serve.mjs            (or double-click start-viewer.command / start-viewer.bat)
//   then open http://localhost:4747
//
// It never touches your checkout. Every minute it runs `git fetch` and reads the packs straight out of
// git: main plus every branch that is not merged yet (the work threads are doing right now), newest
// change winning. When a thread pushes, the page refreshes by itself.
//
//   --port N         another port (default 4747)
//   --main-only      start with only what is merged into main
//   --every S        seconds between fetches (default 60)
//   --no-fetch       do not run git fetch (use what is already fetched)
//   --no-open        do not open the browser
//
// Everything it downloads or builds lives in .asset-viewer/ at the repo root (ignored by git).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import zlib from "node:zlib";
import { buildIndex } from "./model-index.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt; };
const PORT = Number(opt("--port", 4747));
const EVERY = Number(opt("--every", 60)) * 1000;
const FETCH = !args.includes("--no-fetch");
const RECENT_DAYS = 30;                       // unmerged branches older than this are left out (abandoned work)
const RP = "Siege_Nights_RP", BP_BLOCKS = "Siege_Nights_BP/blocks";
const CATALOGUE = "map/structures/build_full_catalogue.py";

const git = (...a) => {
  const r = spawnSync("git", a, { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error("git " + a.join(" ") + ": " + (r.stderr || "").trim());
  return r.stdout;
};
const ROOT = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd: HERE, encoding: "utf8" }).stdout.trim();
if (!ROOT) { console.error("Run this from inside the hollow-crown repo."); process.exit(1); }
const CACHE = path.join(ROOT, ".asset-viewer");
fs.mkdirSync(CACHE, { recursive: true });
const log = (...m) => console.log(new Date().toTimeString().slice(0, 8), ...m);

// ---------------------------------------------------------------- state
const state = {
  mode: args.includes("--main-only") ? "main" : "all",
  branches: [],          // [{ref, sha, time, subject}] oldest first, main first
  layers: { all: null, main: null },   // path -> {sha, ref}
  index: { all: null, main: null },
  version: 0,
  lastFetch: null, fetchError: null,
  builds: { status: "waiting", message: "", sources: [], version: 0 },
  deps: { textures: false, three: false, python: null, message: "" },
};
const clients = new Set();
function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const c of clients) c.write(msg);
}
const publicState = () => ({
  mode: state.mode, version: state.version, lastFetch: state.lastFetch, fetchError: state.fetchError,
  branches: state.branches.map(({ ref, time, subject }) => ({ ref, time, subject })),
  builds: state.builds, deps: state.deps,
});

// ---------------------------------------------------------------- git: blobs
// One long-lived `git cat-file --batch` answers blob reads; results are cached by blob id.
const blobCache = new Map();
let catFile = null, catQueue = [], catBuf = Buffer.alloc(0);
function startCatFile() {
  catFile = spawn("git", ["cat-file", "--batch"], { cwd: ROOT });
  catFile.stdout.on("data", (d) => { catBuf = Buffer.concat([catBuf, d]); drainCat(); });
  catFile.on("exit", () => { catFile = null; for (const q of catQueue) q.reject(new Error("git cat-file stopped")); catQueue = []; });
}
function drainCat() {
  while (catQueue.length) {
    const nl = catBuf.indexOf(10);
    if (nl < 0) return;
    const head = catBuf.slice(0, nl).toString();
    if (head.endsWith("missing")) { catBuf = catBuf.slice(nl + 1); catQueue.shift().reject(new Error(head)); continue; }
    const size = Number(head.split(" ")[2]);
    if (catBuf.length < nl + 1 + size + 1) return;
    const body = catBuf.slice(nl + 1, nl + 1 + size);
    catBuf = catBuf.slice(nl + 1 + size + 1);
    catQueue.shift().resolve(body);
  }
}
function readBlob(sha) {
  if (blobCache.has(sha)) return Promise.resolve(blobCache.get(sha));
  if (!catFile) startCatFile();
  return new Promise((resolve, reject) => {
    catQueue.push({ resolve: (b) => { blobCache.set(sha, b); resolve(b); }, reject });
    catFile.stdin.write(sha + "\n");
  });
}

// ---------------------------------------------------------------- git: branches and layers
function listBranches() {
  const out = git("for-each-ref", "--format=%(refname:short)\t%(objectname)\t%(committerdate:unix)\t%(subject)", "refs/remotes/origin");
  const all = out.trim().split("\n").filter(Boolean).map((l) => { const [ref, sha, time, subject] = l.split("\t"); return { ref, sha, time: Number(time), subject }; })
    .filter((b) => b.ref !== "origin/HEAD" && b.ref !== "origin");
  const main = all.find((b) => b.ref === "origin/main");
  if (!main) throw new Error("no origin/main: is this the hollow-crown repo?");
  const unmerged = new Set(git("for-each-ref", "--no-merged=origin/main", "--format=%(refname:short)", "refs/remotes/origin").trim().split("\n"));
  const cutoff = Date.now() / 1000 - RECENT_DAYS * 86400;
  const wip = all.filter((b) => unmerged.has(b.ref) && b.time > cutoff).sort((a, b) => a.time - b.time);
  return [main, ...wip];
}

function tree(rev, paths, ref) {
  const m = new Map();
  for (const l of git("ls-tree", "-r", "--full-tree", rev, "--", ...paths).split("\n")) {
    const t = l.indexOf("\t"); if (t < 0) continue;
    const [, type, sha] = l.slice(0, t).split(" ");
    if (type === "blob") m.set(l.slice(t + 1), { sha, ref });
  }
  return m;
}

// main's files, then each unmerged branch's own changes on top (oldest first, so the newest change wins).
function layersFor(branches, paths) {
  const [main, ...wip] = branches;
  const m = tree(main.sha, paths, main.ref);
  for (const b of wip) {
    let base;
    try { base = git("merge-base", main.sha, b.sha).trim(); } catch { continue; }
    for (const l of git("diff", "--raw", "--no-abbrev", "--no-renames", base, b.sha, "--", ...paths).split("\n")) {
      const t = l.indexOf("\t"); if (t < 0) continue;
      const f = l.slice(0, t).split(" "), p = l.slice(t + 1);
      if (f[4] === "D") m.delete(p); else m.set(p, { sha: f[3], ref: b.ref });
    }
  }
  return m;
}

let refreshing = false;
async function refresh(reason) {
  if (refreshing) return; refreshing = true;
  try {
    if (FETCH) {
      const r = spawnSync("git", ["fetch", "origin", "--prune", "--quiet"], { cwd: ROOT, encoding: "utf8", timeout: 120000 });
      state.fetchError = r.status === 0 ? null : (r.stderr || "git fetch failed").trim().split("\n").pop();
    }
    state.lastFetch = Date.now();
    const branches = listBranches();
    const key = (bs) => bs.map((b) => b.ref + b.sha).join();
    if (state.layers.all && key(branches) === key(state.branches)) { broadcast("state", publicState()); return; }
    state.branches = branches;
    for (const mode of ["all", "main"]) {
      const bs = mode === "main" ? branches.slice(0, 1) : branches;
      const layer = layersFor(bs, [RP, BP_BLOCKS]);
      state.layers[mode] = layer;
      state.index[mode] = await buildIndex(layer, readBlob, vanilla);
    }
    state.version++;
    log(`models: ${reason}, ${branches.length - 1} branches in progress, ${state.index.all.entities.length} mobs, ${state.index.all.attachables.length} armour/attachables, ${state.index.all.blocks.length} blocks`);
    broadcast("models", { version: state.version });
    broadcast("state", publicState());
    queueBuilds();
  } catch (e) {
    state.fetchError = String(e.message || e); log("refresh failed:", state.fetchError);
    broadcast("state", publicState());
  } finally { refreshing = false; }
}

// ---------------------------------------------------------------- dependencies (downloaded once into .asset-viewer/deps)
const DEPS = path.join(CACHE, "deps");
const SAMPLES = path.join(DEPS, "bedrock-samples");
const TEXTURES = path.join(SAMPLES, "resource_pack", "textures", "blocks");
const THREE = path.join(DEPS, "node_modules", "three");
const vanilla = { root: path.join(SAMPLES, "resource_pack"), ready: false };

function run(cmd, a, cwd, extra = {}) {
  return new Promise((resolve) => {
    // PYTHONHASHSEED: some builders seed their dressing from hash(name), which Python changes every run;
    // fixed, the same code always gives the same build, so only real changes show as new
    const p = spawn(cmd, a, { cwd, shell: process.platform === "win32" && cmd === "npm", env: { ...process.env, PYTHONHASHSEED: "0" }, ...extra });
    let out = "";
    p.stdout?.on("data", (d) => { out += d; });
    p.stderr?.on("data", (d) => { out += d; });
    p.on("error", (e) => resolve({ code: -1, out: String(e) }));
    p.on("exit", (code) => resolve({ code, out }));
  });
}

function findPython() {
  for (const c of process.platform === "win32" ? ["py", "python", "python3"] : ["python3", "python"]) {
    const r = spawnSync(c, ["-c", "import sys; print(sys.version_info[0])"], { encoding: "utf8" });
    if (r.status === 0 && r.stdout.trim() === "3") return c;
  }
  return null;
}

async function ensureDeps() {
  fs.mkdirSync(DEPS, { recursive: true });
  if (!fs.existsSync(path.join(SAMPLES, ".git"))) {
    state.deps.message = "Downloading Mojang's block textures and vanilla models (once, about 25 MB)";
    broadcast("state", publicState()); log(state.deps.message);
    const r = await run("git", ["clone", "--quiet", "--depth", "1", "--filter=blob:none", "--sparse", "https://github.com/Mojang/bedrock-samples.git", SAMPLES], DEPS);
    if (r.code !== 0) { state.deps.message = "Could not download Mojang's textures: " + r.out.trim().split("\n").pop(); log(state.deps.message); return; }
  }
  await run("git", ["sparse-checkout", "set", "--no-cone", "resource_pack/textures/blocks/**", "resource_pack/models/**", "resource_pack/textures/models/armor/**"], SAMPLES);
  state.deps.textures = fs.existsSync(TEXTURES);
  vanilla.ready = fs.existsSync(path.join(vanilla.root, "models"));
  if (!fs.existsSync(THREE)) {
    state.deps.message = "Installing three.js for the build renderer (once)"; broadcast("state", publicState()); log(state.deps.message);
    fs.writeFileSync(path.join(DEPS, "package.json"), JSON.stringify({ private: true, name: "asset-viewer-deps" }));
    await run("npm", ["install", "--silent", "--no-audit", "--no-fund", "three@0.170.0"], DEPS);
  }
  state.deps.three = fs.existsSync(THREE);
  state.deps.python = await ensurePython();
  state.deps.message = "";
  broadcast("state", publicState());
}

// The build renderer is Python (Pillow + numpy). A private virtual env keeps those off the system Python.
async function ensurePython() {
  const venv = path.join(DEPS, "venv");
  const vpy = process.platform === "win32" ? path.join(venv, "Scripts", "python.exe") : path.join(venv, "bin", "python3");
  const ok = (py) => spawnSync(py, ["-c", "import PIL, numpy"], { encoding: "utf8" }).status === 0;
  if (fs.existsSync(vpy) && ok(vpy)) return vpy;
  const sys = findPython();
  if (!sys) { state.deps.message = "Python 3 is not installed, so the Builds tab cannot be made. Models still work."; return null; }
  if (ok(sys)) return sys;
  state.deps.message = "Installing Pillow and numpy for the build renderer (once)"; broadcast("state", publicState()); log(state.deps.message);
  const base = sys === "py" ? ["-3"] : [];
  let r = await run(sys, [...base, "-m", "venv", venv], DEPS);
  if (r.code === 0) r = await run(vpy, ["-m", "pip", "install", "--quiet", "pillow", "numpy"], DEPS);
  if (r.code === 0 && ok(vpy)) return vpy;
  state.deps.message = "Could not install Pillow and numpy: " + r.out.trim().split("\n").pop();
  return null;
}

// ---------------------------------------------------------------- builds (the 3D building catalogue)
// Every branch in view that has the catalogue builder is built in its own worktree; the merged catalogue
// takes each build from the newest branch that has it, so stations, towns and walls from different threads
// all show at once.
const WT = path.join(CACHE, "worktrees"), BOUT = path.join(CACHE, "builds");
const RECIPE = "r3";         // bump when the way builds are made changes, so builds kept from an earlier run are redone
const built = new Map();     // slug -> {sha, ref, time, ok, index, tpl, error}
let buildTimer = null, building = false, buildAgain = false;
const slug = (ref) => ref.replace(/^origin\//, "").replace(/[^A-Za-z0-9._-]+/g, "_");

function catalogueSources() {
  const bs = state.mode === "main" ? state.branches.slice(0, 1) : state.branches;
  return bs.filter((b) => { try { git("cat-file", "-e", `${b.sha}:${CATALOGUE}`); return true; } catch { return false; } });
}
function queueBuilds() { clearTimeout(buildTimer); buildTimer = setTimeout(runBuilds, 500); }

async function runBuilds() {
  if (building) { buildAgain = true; return; }
  building = true;
  try {
    const py = state.deps.python;
    const sources = catalogueSources();
    state.builds.sources = sources.map((b) => b.ref);
    if (!sources.length) { setBuilds("none", "No branch has the building catalogue yet."); return; }
    if (!py || !state.deps.textures) { setBuilds("blocked", state.deps.message || "Waiting for downloads"); return; }
    const newest = sources[sources.length - 1], imp = importsFingerprint();
    for (const b of [...sources].reverse()) {          // newest first, so the freshest builds show soonest
      const s = slug(b.ref), prev = built.get(s);
      const fp = RECIPE + (b === newest ? ";imports:" + imp : "");   // the newest catalogue branch also runs the imported builders
      if (prev && prev.sha === b.sha && (prev.fp || "") === fp) continue;
      setBuilds("building", `Building ${b.ref.replace("origin/", "")} (${b.subject.slice(0, 70)})`);
      const res = await buildBranch(b, py, b === newest);
      built.set(s, { ...b, ...res, fp });
      if (!res.ok) log("build failed on", b.ref, res.error);
      publishBuilds(sources);
    }
    publishBuilds(sources);
    const bad = sources.filter((b) => built.get(slug(b.ref)) && !built.get(slug(b.ref)).ok);
    setBuilds("ready", bad.length ? `Could not build ${bad.map((b) => b.ref.replace("origin/", "")).join(", ")}` : "");
  } finally {
    building = false;
    if (buildAgain) { buildAgain = false; queueBuilds(); }
  }
}
function setBuilds(status, message) { state.builds.status = status; state.builds.message = message; broadcast("state", publicState()); }

async function buildBranch(b, py, withImports) {
  const s = slug(b.ref), wt = path.join(WT, s), out = path.join(BOUT, s);
  fs.mkdirSync(WT, { recursive: true });
  if (!fs.existsSync(path.join(wt, ".git"))) {
    spawnSync("git", ["worktree", "prune"], { cwd: ROOT });
    const r = await run("git", ["worktree", "add", "--detach", "--force", wt, b.sha], ROOT);
    if (r.code !== 0) return { ok: false, error: r.out.trim() };
  } else {
    const r = await run("git", ["checkout", "--quiet", "--detach", "--force", b.sha], wt);
    if (r.code !== 0) return { ok: false, error: r.out.trim() };
  }
  const ms = path.join(wt, "map", "structures");
  fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
  const t0 = Date.now();
  let r = await run(process.execPath, ["settle_dump.mjs", path.join(out, "settle.json")], ms);
  if (r.code !== 0) return { ok: false, error: "settle_dump: " + r.out.trim().split("\n").slice(-3).join(" ") };
  const pyArgs = py === "py" ? ["-3"] : [];
  r = await run(py, [...pyArgs, CATALOGUE.split("/").pop(), path.join(out, "settle.json"), path.join(out, "cards"),
    "--textures", TEXTURES, "--three", THREE, "--viewer3d", path.join(out, "v3d")], ms);
  if (r.code !== 0) return { ok: false, error: "catalogue: " + r.out.trim().split("\n").slice(-3).join(" ") };
  const tpl = fs.readFileSync(path.join(ms, "render", "viewer3d.tpl.html"), "utf8");
  const html = fs.readFileSync(path.join(out, "v3d", "index.html"), "utf8");
  const [a, z] = tpl.split("__INDEX__");
  const index = JSON.parse(html.slice(a.length, html.length - z.length));
  await buildExtras(wt, out, py, pyArgs, index, withImports);
  log(`built ${index.length} builds from ${b.ref} in ${Math.round((Date.now() - t0) / 1000)} s`);
  fs.writeFileSync(path.join(out, "meta.json"), JSON.stringify({ sha: b.sha, ref: b.ref, index, tpl, fp: RECIPE + (withImports ? ";imports:" + importsFingerprint() : "") }));
  return { ok: true, index, tpl };
}

// builds made on an earlier run are kept, so a restart does not rebuild what has not changed
for (const s of fs.existsSync(BOUT) ? fs.readdirSync(BOUT) : []) {
  try { const m = JSON.parse(fs.readFileSync(path.join(BOUT, s, "meta.json"), "utf8")); built.set(s, { ...m, ok: true }); } catch { /* not finished */ }
}

// Other 3D builders whose preview scenes join the catalogue as their own section. Each runs in the branch's
// worktree; every OUT/**/scene.json it leaves (Blueprint.save_logical) becomes a build in the viewer.
const readNames = (out) => { try { return JSON.parse(fs.readFileSync(path.join(out, "names.json"), "utf8")); } catch { return {}; } };
const EXTRAS = [
  { id: "trees", title: "Trees", marker: "map/trees/build_trees.py",
    args: (out) => [out, "--variants", "1", "--render", "--shots", "", "--textures", TEXTURES, "--three", THREE],
    names: (out) => { try { const t = JSON.parse(fs.readFileSync(path.join(out, "trees.json"), "utf8")).species; return Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v.name])); } catch { return {}; } },
    label: { all: "Every tree, side by side" } },
  { id: "landmarks", title: "Landmarks and story places", marker: "map/structures/landmark_scenes.py",
    args: (out) => [out],
    names: (out) => { try { return JSON.parse(fs.readFileSync(path.join(out, "names.json"), "utf8")); } catch { return {}; } } },
  { id: "world_props", title: "World props: signposts, wells, fields, windmills, scaffolds", marker: "map/structures/world_props.py",
    args: (out) => [out],
    names: (out) => { try { return JSON.parse(fs.readFileSync(path.join(out, "names.json"), "utf8")); } catch { return {}; } } },
  { id: "vault", title: "Vault strongrooms", marker: "map/structures/vault_rooms.py",
    args: (out) => [out],
    names: (out) => { try { return JSON.parse(fs.readFileSync(path.join(out, "names.json"), "utf8")); } catch { return {}; } } },
  { id: "miniature", title: "Welcome hall miniature", marker: "map/structures/miniature_scene.py",
    args: (out) => [out],
    label: { miniature: "The whole map in miniature, on its cloud (welcome hall)" } },
  // The material-loop machines come in every region's look: names.json gives each build {title, sub}, so a
  // stage is one row with a chip per region (machine_regions.py).
  { id: "ironworks", title: "Ironworks", marker: "map/structures/ironworks_builds.py",
    args: (out) => [out], names: (out) => readNames(out) },
  { id: "goldsluice", title: "Gold Sluice", marker: "map/structures/goldsluice_builds.py",
    args: (out) => [out], names: (out) => readNames(out) },
  { id: "deepshaft", title: "Deep Shaft", marker: "map/structures/deepshaft_builds.py",
    args: (out) => [out], names: (out) => readNames(out) },
  { id: "trade_outpost", title: "Trade Outposts", marker: "map/structures/trade_outpost.py",
    args: (out) => [out],
    names: (out) => { try { return JSON.parse(fs.readFileSync(path.join(out, "names.json"), "utf8")); } catch { return {}; } } },
  { id: "graves", title: "Gravestone", marker: "map/structures/gravestone_build.py",
    args: (out) => [out],
    label: { gravestone: "Gravestone (where a player fell; candle lit while sealed)" } },
  { id: "bridges", title: "Bridges", marker: "map/structures/bridges_gallery.py",
    args: (out) => [out] },
];
// Builder scripts that live on a branch without the kit: copied from the newest branch that has them into
// the newest catalogue branch's map/structures and run there.
const IMPORTS = [
  { id: "houses", title: "Build-instruction test houses", dir: "build-instructions/examples", match: /^test_house.*\.py$/,
    support: ["build-instructions/texturing/doctrine.py", "build-instructions/texturing/doctrine.json"],
    args: (out) => [out, "--textures", TEXTURES, "--three", THREE],
    title1: (script, stage) => `Test house ${script === "test_house" ? "v1" : script.replace("test_house_", "")} · stage ${stage.replace(/-/g, " ")}` },
];
function importSource(x) {
  const bs = state.mode === "main" ? state.branches.slice(0, 1) : state.branches;
  for (const b of [...bs].reverse()) {
    let names = [];
    try { names = git("ls-tree", "--name-only", b.sha, x.dir + "/").split("\n").map((f) => f.split("/").pop()).filter((f) => x.match.test(f)); } catch { /* not there */ }
    if (names.length) return { ref: b.ref, sha: b.sha, files: names };
  }
  return null;
}
const importsFingerprint = () => IMPORTS.map((x) => importSource(x)?.sha || "-").join(",");

const sceneFiles = (dir) => !fs.existsSync(dir) ? [] : fs.readdirSync(dir, { withFileTypes: true })
  .flatMap((e) => e.isDirectory() ? sceneFiles(path.join(dir, e.name)) : e.name === "scene.json" ? [path.join(dir, e.name)] : []).sort();
const nice = (s) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// one section: run the scripts (render and screenshot calls skipped), mesh every scene they leave, add it
async function addSection(wt, out, py, pyArgs, index, id, title, jobs, titleOf) {
  const v3d = path.join(out, "v3d"), xo = path.join(out, "extra-" + id);
  fs.rmSync(xo, { recursive: true, force: true });
  const list = [];
  for (const j of jobs) {
    const jo = path.join(xo, j.name);
    const r = await run(py, [...pyArgs, path.join(HERE, "run_scenes.py"), j.script, ...j.args(jo)], path.dirname(j.script));
    const scenes = sceneFiles(jo);
    if (!scenes.length) { log(`${title} (${j.name}): no scenes`, r.out.trim().split("\n").slice(-2).join(" ")); continue; }
    for (const f of scenes) {
      const k = path.basename(path.dirname(f)), t = titleOf(j, k, jo);   // a title, or {title, sub} for a build with several looks
      list.push({ key: `${id}-${j.name}-${k}`, title: typeof t === "object" ? t.title : t, sub: typeof t === "object" ? t.sub || "" : "", group: j.group || "", scene: f });
    }
  }
  if (!list.length) return;
  fs.writeFileSync(path.join(xo, "scenes.json"), JSON.stringify(list));
  const m = await run(py, [...pyArgs, path.join(HERE, "mesh_scenes.py"), path.join(wt, "map", "structures"), TEXTURES, path.join(xo, "mesh"), "x-" + id, title, path.join(xo, "scenes.json")], wt);
  if (m.code !== 0) { log(`${title}: could not mesh`, m.out.trim().split("\n").slice(-2).join(" ")); return; }
  fs.copyFileSync(path.join(xo, "mesh", "data", "x-" + id + ".txt"), path.join(v3d, "data", "x-" + id + ".txt"));
  const tex = JSON.parse(fs.readFileSync(path.join(v3d, "tex.json"), "utf8"));
  Object.assign(tex, JSON.parse(fs.readFileSync(path.join(xo, "mesh", "tex.json"), "utf8")));
  fs.writeFileSync(path.join(v3d, "tex.json"), JSON.stringify(tex));
  const add = JSON.parse(fs.readFileSync(path.join(xo, "mesh", "index.json"), "utf8"));
  index.push(...add);
  log(`${title}: ${add.length} added`);
}

async function buildExtras(wt, out, py, pyArgs, index, withImports) {
  for (const x of EXTRAS) {
    if (!fs.existsSync(path.join(wt, x.marker))) continue;
    const job = { name: "all", script: path.join(wt, x.marker), args: x.args };
    await addSection(wt, out, py, pyArgs, index, x.id, x.title, [job], (j, k, jo) => (x.names?.(jo) || {})[k] || x.label?.[k] || nice(k));
  }
  if (!withImports) return;
  for (const x of IMPORTS) {
    const src = importSource(x);
    if (!src) continue;
    const kit = path.join(wt, "map", "structures"), jobs = [];
    for (const f of x.support || []) { try { fs.writeFileSync(path.join(kit, f.split("/").pop()), git("show", `${src.sha}:${f}`)); } catch { /* not on that branch */ } }
    for (const f of src.files) {
      fs.writeFileSync(path.join(kit, f), git("show", `${src.sha}:${x.dir}/${f}`));
      const name = f.replace(/\.py$/, "");
      jobs.push({ name, script: path.join(kit, f), args: x.args, group: name });
    }
    await addSection(wt, out, py, pyArgs, index, x.id, x.title, jobs, (j, k) => x.title1(j.name, k));
  }
}

let merged = { html: null, tex: null, index: null };
// A fingerprint of each build's meshes, so the side list can mark only the builds a branch really changed: every
// branch carries main's builds too. Texture names hold the branch's worktree path, so that part is taken out.
function buildHashes(s, r) {
  if (r.hashes) return r.hashes;
  const h = {}, bufs = {};
  for (const e of r.index) {
    try {
      const b = bufs[e.bundle] ??= Buffer.from(fs.readFileSync(path.join(BOUT, s, "v3d", "data", e.bundle + ".txt"), "utf8").trim(), "base64");
      const json = zlib.gunzipSync(b.subarray(e.at[0], e.at[0] + e.at[1])).toString("utf8").replaceAll("_worktrees_" + s + "_", "_worktrees_");
      h[e.key] = crypto.createHash("sha1").update(json).digest("hex");
    } catch { /* bundle missing: never marked */ }
  }
  return (r.hashes = h);
}
function publishBuilds(sources) {
  const have = sources.map((b) => ({ b, r: built.get(slug(b.ref)) })).filter((x) => x.r && x.r.ok && x.r.sha === x.b.sha);
  if (!have.length) return;
  const byKey = new Map(), tex = {};
  const onMain = have.find((x) => x.b.ref === "origin/main"), mainHash = onMain ? buildHashes(slug(onMain.b.ref), onMain.r) : null;
  for (const { b, r } of have) {           // oldest first: a newer branch's build replaces an older one
    Object.assign(tex, JSON.parse(fs.readFileSync(path.join(BOUT, slug(b.ref), "v3d", "tex.json"), "utf8")));
    for (const e of r.index) {
      byKey.delete(e.key);
      const imported = IMPORTS.some((x) => e.key.startsWith(x.id + "-"));   // only ever built on the newest branch
      const fresh = !!mainHash && b !== onMain.b && !imported && mainHash[e.key] !== buildHashes(slug(b.ref), r)[e.key];
      byKey.set(e.key, { ...e, bundle: slug(b.ref) + "/" + e.bundle, sub: e.sub, from: b.ref.replace("origin/", ""), fresh });
    }
  }
  // keep the newest branch's section order
  const newest = have[have.length - 1].r;
  const order = new Map(); newest.index.forEach((e, i) => order.set(e.section, i));
  const index = [...byKey.values()].sort((x, y) => (order.get(x.section) ?? 1e9) - (order.get(y.section) ?? 1e9));
  merged.html = injectReload(newest.tpl.replace("__INDEX__", JSON.stringify(index)));
  merged.tex = JSON.stringify(tex);
  merged.index = JSON.stringify({ version: state.builds.version + 1, index: index.map(({ key, title, section, group, sub, from, fresh }) => ({ key, title, section, group: group || "", sub: sub || "", from, fresh })) });
  state.builds.count = index.length;
  state.builds.version++;
  broadcast("builds", { version: state.builds.version, count: index.length });
}

// Pages served from here reload themselves when their content changes.
const RELOAD = (event) => `<script>(()=>{const es=new EventSource("/events");let v=null;es.addEventListener(${JSON.stringify(event)},e=>{const d=JSON.parse(e.data);if(v!==null&&d.version!==v)location.reload();v=d.version;});})();</script>`;
// Inside the viewer page the side list does the picking, so the build page hides its own drop-down there and
// tells the list which build it is showing (its Prev/Next and arrow keys move the list too).
const EMBED = `<style>.embedded #pick{display:none}</style><script>(()=>{if(window.parent===window)return;document.documentElement.classList.add("embedded");
const t=document.getElementById("title");if(!t)return;const say=()=>parent.postMessage({av:"build",key:decodeURIComponent(location.hash.slice(1))},location.origin);
new MutationObserver(say).observe(t,{childList:true,characterData:true,subtree:true});say();})();</script>`;
function injectReload(html) { return html.replaceAll("https://cdn.jsdelivr.net/npm/three@0.170.0/", "/three/").replace("</body>", EMBED + RELOAD("builds") + "</body>"); }

// ---------------------------------------------------------------- http
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".png": "image/png", ".txt": "text/plain", ".css": "text/css", ".tga": "image/x-tga" };
const type = (p) => TYPES[path.extname(p).toLowerCase()] || "application/octet-stream";
function send(res, code, body, t = "text/plain; charset=utf-8") { res.writeHead(code, { "content-type": t, "cache-control": "no-store" }); res.end(body); }
function sendFile(res, file) {
  fs.readFile(file, (err, buf) => err ? send(res, 404, "not found") : send(res, 200, buf, type(file)));
}
const inside = (base, rel) => { const p = path.resolve(base, rel); return p.startsWith(path.resolve(base) + path.sep) ? p : null; };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const p = decodeURIComponent(url.pathname);
  try {
    if (p === "/events") {
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
      res.write(`event: state\ndata: ${JSON.stringify(publicState())}\n\n`);
      res.write(`event: models\ndata: ${JSON.stringify({ version: state.version })}\n\n`);
      res.write(`event: builds\ndata: ${JSON.stringify({ version: state.builds.version, count: state.builds.count || 0 })}\n\n`);
      clients.add(res); req.on("close", () => clients.delete(res)); return;
    }
    if (p === "/api/state") return send(res, 200, JSON.stringify(publicState()), TYPES[".json"]);
    if (p === "/api/mode" && req.method === "POST") {
      const m = url.searchParams.get("m"); if (m === "all" || m === "main") { state.mode = m; state.version++; broadcast("models", { version: state.version }); broadcast("state", publicState()); queueBuilds(); }
      return send(res, 200, "ok");
    }
    if (p === "/api/refresh" && req.method === "POST") { refresh("asked from the page"); return send(res, 200, "ok"); }
    if (p === "/api/models") {
      const idx = state.index[state.mode];
      return idx ? send(res, 200, JSON.stringify({ ...idx, version: state.version }), TYPES[".json"]) : send(res, 503, "still reading the packs");
    }
    if (p.startsWith("/pack/")) {          // a pack file, from whichever branch has its newest version
      const f = state.layers[state.mode]?.get(p.slice(6));
      if (!f) return send(res, 404, "not in the packs: " + p.slice(6));
      return send(res, 200, await readBlob(f.sha), type(p));
    }
    if (p.startsWith("/vanilla/")) {       // Mojang's vanilla models and armour textures
      const f = inside(vanilla.root, p.slice(9)); return f ? sendFile(res, f) : send(res, 404, "no");
    }
    if (p === "/builds/" || p === "/builds/index.html") {
      return merged.html ? send(res, 200, merged.html, TYPES[".html"]) : send(res, 200, waitingPage(), TYPES[".html"]);
    }
    if (p === "/api/builds") return merged.index ? send(res, 200, merged.index, TYPES[".json"]) : send(res, 503, "still building");
    if (p === "/builds/tex.json") return merged.tex ? send(res, 200, merged.tex, TYPES[".json"]) : send(res, 404, "not built");
    if (p.startsWith("/builds/data/")) {
      const [s, bundle] = p.slice(13).split("/");
      const f = inside(path.join(BOUT, s || "_", "v3d", "data"), bundle || ""); return f ? sendFile(res, f) : send(res, 404, "no");
    }
    if (p.startsWith("/three/")) {         // three.js from the local install, the CDN until that is there
      const f = inside(THREE, p.slice(7));
      if (f && fs.existsSync(f)) return sendFile(res, f);
      res.writeHead(302, { location: "https://cdn.jsdelivr.net/npm/three@0.170.0/" + p.slice(7) }); return res.end();
    }
    if (p === "/") return sendFile(res, path.join(HERE, "public", "index.html"));
    const f = inside(path.join(HERE, "public"), p.slice(1));
    return f ? sendFile(res, f) : send(res, 404, "not found");
  } catch (e) { send(res, 500, String(e.stack || e)); }
});

function waitingPage() {
  return `<!doctype html><meta charset="utf-8"><style>body{background:#16131c;color:#cfc6dc;font:15px system-ui;display:grid;place-items:center;height:100vh;margin:0}</style>
<div id="m">Building the catalogue. This page opens by itself when it is ready.</div>
<script>const es=new EventSource("/events");es.addEventListener("state",e=>{const b=JSON.parse(e.data).builds;document.getElementById("m").textContent=b.message||"Building the catalogue. This page opens by itself when it is ready."});
es.addEventListener("builds",e=>{if(JSON.parse(e.data).count)location.reload()});</script>`;
}

server.on("error", (e) => {
  if (e.code === "EADDRINUSE") { console.error(`Port ${PORT} is busy. Is the viewer already running? Open http://localhost:${PORT} or start with --port 4748.`); process.exit(1); }
  throw e;
});
server.listen(PORT, "127.0.0.1", async () => {
  const link = `http://localhost:${PORT}`;
  console.log(`\n  The Hollow Crown asset viewer is running at  ${link}\n  Leave this window open. Press Ctrl+C to stop.\n`);
  if (!args.includes("--no-open")) {
    const opener = process.platform === "darwin" ? ["open", [link]] : process.platform === "win32" ? ["cmd", ["/c", "start", "", link]] : ["xdg-open", [link]];
    spawn(opener[0], opener[1], { stdio: "ignore", detached: true }).on("error", () => {}).unref();
  }
  await refresh("first look");
  await ensureDeps();
  if (vanilla.ready) { state.layers.all = null; refreshing = false; await refresh("vanilla models ready"); }
  queueBuilds();
  setInterval(() => refresh("fetch"), EVERY);
});
