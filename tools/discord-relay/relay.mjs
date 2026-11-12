#!/usr/bin/env node
// The Hollow Crown: Discord relay. Carries the alerts the add-on queues (Siege_Nights_BP/scripts/dispatch/)
// to a Discord channel through a webhook. Setup: docs/DISCORD.md. UNTESTED against a live Realm so far.
//
//   node relay.mjs --realm          join the Realm as the relay account every few minutes, collect alerts, leave
//   bedrock_server | node relay.mjs --log      dedicated server: read alerts from the server's output
//   node relay.mjs --selftest       check the parsing and wording offline
//   add --dry to print instead of posting to Discord
//
// Settings live in config.json beside this file (copy config.example.json). Keep it private: the webhook
// link lets anyone post to the channel. The relay remembers the last alert number it posted in state.json,
// so alerts are never posted twice.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const HERE = dirname(fileURLToPath(import.meta.url));
const args = new Set(process.argv.slice(2));
const DRY = args.has("--dry");
const PREFIX = "HCA1|";
const LOG_PREFIX = "[HC-ALERT] ";

// ---------- reading alerts (same rule as dispatch/index.js decode) ----------
export function decode(line) {
  const s = String(line);
  let at = s.indexOf(PREFIX), skip = PREFIX.length;
  if (at < 0) { at = s.indexOf(LOG_PREFIX); skip = LOG_PREFIX.length; }
  if (at < 0) return null;
  try {
    const a = JSON.parse(s.slice(at + skip));
    return typeof a.n === "number" && typeof a.text === "string" ? a : null;
  } catch {
    return null;
  }
}

// The Discord message for an alert: the line, then @-mentions for linked players named in ping.
export function message(alert, links = {}) {
  const lower = Object.fromEntries(Object.entries(links).map(([k, v]) => [k.toLowerCase(), String(v)]));
  const ids = [...new Set((alert.ping ?? []).map((n) => lower[String(n).toLowerCase()]).filter(Boolean))];
  const content = ids.length ? `${alert.text}\n${ids.map((id) => `<@${id}>`).join(" ")}` : alert.text;
  return { content, username: "The Hollow Crown", allowed_mentions: { parse: [], users: ids } };
}

// ---------- state + config ----------
const STATE = join(HERE, "state.json");
const loadState = () => (existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : { last: 0 });
const saveState = (s) => writeFileSync(STATE, JSON.stringify(s, null, 2));
function loadConfig() {
  const file = join(HERE, "config.json");
  if (!existsSync(file)) throw new Error("No config.json. Copy config.example.json to config.json and fill it in (docs/DISCORD.md).");
  return JSON.parse(readFileSync(file, "utf8"));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(cfg, body) {
  if (DRY) return console.log(`[dry] ${body.content}`);
  for (let tries = 0; tries < 5; tries++) {
    const res = await fetch(cfg.webhook, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) return;
    if (res.status === 429) { await sleep(1000 * Number((await res.json().catch(() => ({}))).retry_after ?? 2)); continue; }
    throw new Error(`Discord said ${res.status}: ${await res.text()}`);
  }
}

// Post each new alert once, oldest first. Alert numbers restart only if the world's queue is wiped:
// a number far below the last one posted means a new world, so start counting again.
function makeSink(cfg) {
  const state = loadState();
  let chain = Promise.resolve();
  return (alert) => {
    chain = chain.then(async () => {
      if (alert.n <= state.last && state.last - alert.n < 1000) return;
      await post(cfg, message(alert, cfg.links));
      state.last = alert.n;
      saveState(state);
      console.log(`posted #${alert.n} ${alert.kind}`);
    }).catch((e) => console.error(`could not post #${alert.n}: ${e.message}`));
    return chain;
  };
}

// ---------- dedicated server: read the server's output ----------
async function runLog(cfg) {
  const sink = makeSink(cfg);
  for await (const line of createInterface({ input: process.stdin })) {
    process.stdout.write(line + "\n"); // keep the server console visible
    const a = decode(line);
    if (a) sink(a);
  }
}

// ---------- Realm: drop in, collect, leave ----------
async function visit(cfg, sink) {
  const { createClient } = await import("bedrock-protocol"); // npm install in this folder first
  return new Promise((resolve) => {
    const client = createClient({
      username: cfg.account ?? "relay",
      profilesFolder: join(HERE, "auth"), // Microsoft sign-in is cached here after the first run
      realms: cfg.realmInvite ? { realmInvite: cfg.realmInvite } : { pickRealm: (list) => list.find((r) => r.name === cfg.realmName) ?? list[0] },
      skipPing: true,
    });
    let done = false;
    const finish = (why) => {
      if (done) return;
      done = true;
      try { client.disconnect(); } catch { /* gone */ }
      console.log(`left the Realm (${why})`);
      resolve();
    };
    client.on("text", (p) => { const a = decode(p.message); if (a) sink(a); });
    client.on("spawn", () => { console.log("in the Realm"); setTimeout(() => finish("visit over"), (cfg.staySeconds ?? 60) * 1000); });
    client.on("error", (e) => { console.error(`relay error: ${e.message ?? e}`); finish("error"); });
    client.on("close", () => finish("closed"));
    setTimeout(() => finish("timed out"), ((cfg.staySeconds ?? 60) + 90) * 1000);
  });
}

async function runRealm(cfg) {
  const sink = makeSink(cfg);
  for (;;) {
    try { await visit(cfg, sink); } catch (e) { console.error(`visit failed: ${e.message}`); }
    await sleep((cfg.everyMinutes ?? 15) * 60000);
  }
}

// ---------- offline check ----------
function selftest() {
  const eq = (a, b, what) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${what}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`); };
  const a = { n: 3, t: 1, kind: "keepFallen", text: "Mateo's Keep has fallen.", ping: ["Mateo", "Nobody"] };
  eq(decode(`${PREFIX}${JSON.stringify(a)}`), a, "chat line");
  eq(decode(`[2026-11-12 14:00:00 INFO] [Scripting] ${LOG_PREFIX}${JSON.stringify(a)}`), a, "server log line");
  eq(decode("just chatting"), null, "ordinary chat");
  const m = message(a, { mateo: "123" });
  eq(m.content, "Mateo's Keep has fallen.\n<@123>", "mention");
  eq(m.allowed_mentions, { parse: [], users: ["123"] }, "only linked players are pinged");
  eq(message({ ...a, ping: [] }).content, a.text, "no ping");
  console.log("relay selftest OK");
}

if (args.has("--selftest")) selftest();
else if (args.has("--log")) runLog(loadConfig());
else if (args.has("--realm")) runRealm(loadConfig());
else console.log("Use --realm, --log or --selftest (see the top of this file).");
