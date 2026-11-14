#!/usr/bin/env node
// The build catalog: every build in the game, designed or not (builds/catalog.json).
//   node tools/build-catalog.mjs           check the catalog and rewrite builds/CATALOG.md
//   node tools/build-catalog.mjs --check   check only; exit 1 if anything is wrong or CATALOG.md is stale
// Rules checked: unique ids, known status/region/thread, a source path on main must exist (unless the entry
// waits in an open PR), and every asset viewer EXTRAS section must be named by some entry's "viewer".
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "builds/catalog.json");
const OUT = join(ROOT, "builds/CATALOG.md");
const SERVE = join(ROOT, "tools/asset-viewer/serve.mjs");

export function loadCatalog() { return JSON.parse(readFileSync(DATA, "utf8")); }

export function checkCatalog(c) {
  const errs = [];
  const seen = new Set();
  const FIELDS = new Set(["id", "name", "group", "region", "status", "viewer", "thread", "source", "pr", "variants", "notes", "new"]);
  for (const b of c.builds ?? []) {
    const at = `build ${b.id ?? "(no id)"}`;
    if (!b.id || !/^[a-z0-9-]+$/.test(b.id)) errs.push(`${at}: id must be lower-case-with-dashes`);
    if (seen.has(b.id)) errs.push(`${at}: duplicate id`);
    seen.add(b.id);
    for (const k of Object.keys(b)) if (!FIELDS.has(k)) errs.push(`${at}: unknown field "${k}"`);
    for (const k of ["name", "group"]) if (!b[k]) errs.push(`${at}: missing ${k}`);
    if (!(b.status in c.statuses)) errs.push(`${at}: status "${b.status}" is not one of ${Object.keys(c.statuses).join(", ")}`);
    if (!(b.region in c.regions)) errs.push(`${at}: unknown region "${b.region}"`);
    if (!(b.thread in c.threads)) errs.push(`${at}: unknown thread "${b.thread}" (add it to "threads")`);
    if (b.source && !b.pr && !existsSync(join(ROOT, b.source))) errs.push(`${at}: source ${b.source} does not exist`);
    if ((b.status === "in viewer") && !b.viewer) errs.push(`${at}: status "in viewer" needs a viewer section`);
    if (b.status === "not started" && b.source) errs.push(`${at}: "not started" but has a source`);
  }
  // every extra section of the asset viewer must be in the catalog
  if (existsSync(SERVE)) {
    const src = readFileSync(SERVE, "utf8");
    const block = src.slice(src.indexOf("const EXTRAS = ["), src.indexOf("];", src.indexOf("const EXTRAS = [")));
    const named = new Set((c.builds ?? []).map((b) => b.viewer).filter(Boolean));
    for (const [, id] of block.matchAll(/\{\s*id:\s*"([^"]+)"/g)) {
      if (!named.has(id)) errs.push(`asset viewer section "${id}" (tools/asset-viewer/serve.mjs EXTRAS) has no catalog entry with viewer "${id}"`);
    }
  }
  return errs;
}

const ORDER = ["not started", "designed", "in viewer", "in game"];
const esc = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");

export function renderCatalog(c) {
  const L = [];
  L.push("# Build catalog", "");
  L.push("<!-- Generated from builds/catalog.json by node tools/build-catalog.mjs. Edit the JSON, not this file. -->", "");
  L.push(c.about, "");
  const counts = Object.fromEntries(ORDER.map((s) => [s, 0]));
  for (const b of c.builds) counts[b.status]++;
  L.push(`**${c.builds.length} builds:** ` + ORDER.map((s) => `${counts[s]} ${s}`).join(", ") + ".", "");
  L.push("Statuses:", "");
  for (const [k, v] of Object.entries(c.statuses)) L.push(`- **${k}**: ${v}`);
  L.push("", "A ★ marks builds that no earlier list had (added in the 2026-11-12 audit).", "");
  const groups = [...new Set(c.builds.map((b) => b.group))];
  for (const g of groups) {
    L.push(`## ${g}`, "");
    L.push("| Build | Region | Status | Viewer | Owner thread | Source | Notes |");
    L.push("|---|---|---|---|---|---|---|");
    for (const b of c.builds.filter((x) => x.group === g)) {
      const name = (b.new ? "★ " : "") + b.name + (b.variants ? ` (${b.variants})` : "");
      const src = b.source ? `\`${b.source}\`` : "";
      const notes = [b.pr ? `Waiting in PR #${b.pr}.` : "", b.notes ?? ""].filter(Boolean).join(" ");
      L.push(`| ${esc(name)} | ${esc(c.regions[b.region])} | ${b.status} | ${esc(b.viewer ?? "")} | ${esc(c.threads[b.thread][0])} | ${esc(src)} | ${esc(notes)} |`);
    }
    L.push("");
  }
  return L.join("\n");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const c = loadCatalog();
  const errs = checkCatalog(c);
  for (const e of errs) console.log(`catalog: ${e}`);
  const md = renderCatalog(c);
  if (process.argv.includes("--check")) {
    const stale = !existsSync(OUT) || readFileSync(OUT, "utf8") !== md;
    if (stale) console.log("builds/CATALOG.md is out of date: run  node tools/build-catalog.mjs");
    process.exit(errs.length || stale ? 1 : 0);
  }
  writeFileSync(OUT, md);
  console.log(`builds/CATALOG.md: ${c.builds.length} builds${errs.length ? `, ${errs.length} problem(s)` : ""}`);
  process.exit(errs.length ? 1 : 0);
}
