// The Town Board: hand-written jobs from real people at real places (Mateo 2026-11-14). It replaces the old Rumor
// Board (jobs stitched from parts). The jobs are board_data.js, the rules board_rules.js, the job sites
// board_sites.js; this file is the game side: the board's menu, the givers, the steps out in the world, and pay.
//
// How a job runs
//   1. Take a notice at your hall's Town Board. The tracker says "Talk to <giver> about <thing>".
//   2. Click the giver (a townsperson or a town trader; they get the gold "!" when you are near). They tell you the
//      job in their own words; the job's place gets the minimap pin and a column of light, and its site (a camp,
//      opened barrows, lamp posts) is built at once, while you are far away, so it is standing when you arrive.
//   3. Do it. Then go back to the giver (the tracker says so) for the done line and the pay.
//   4. Once the job is over and you have gone, the site comes down and the place is as it was.
// One job at a time. Three notices a day. Pay as before: Renown and Regals by tier, a skill point every 3 jobs.
//
// Test commands (creative/op):
//   /scriptevent siege:board                 your board memory, today's notices and your job
//   /scriptevent siege:board take <job id>   take that job now (any region)
//   /scriptevent siege:board step            move your job on one step (as if you had done it)
//   /scriptevent siege:board drop            give your job up and take its site down
//   /scriptevent siege:board reset           forget everything the board knows about you

import { world, system, ItemStack } from "@minecraft/server";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import * as api from "../siege/api.js";
import { addFilter, applyFilter } from "../core/events.js";
import { heroOf, grantPoints, grantRenown } from "./hero.js";
import { payE } from "../economy/coins.js";
import { worth } from "../economy/rules.js";
import { regionAt } from "../minimap/data.js";
import { sfx } from "../core/sfx.js";
import { WARDS } from "../plots/config.js";
import { peopleOf, personTag } from "../townsfolk/rules.js";
import { GIVERS, PLACES, MOB_NAMES, ITEM_NAMES, REGIONS } from "./board_data.js";
import { isSiegeNight } from "../reach/api.js";
export { JOBS_PER_POINT } from "./board_rules.js";
import {
  JOBS_PER_POINT, KIND_MOOD, jobById, jobTier, foesAt, blankMemory, noticesFor, startJob, stepOf, lastStep, trackerStep,
  offerLine, noticeOf, finish, turnRounds, giverOf,
} from "./board_rules.js";
import { buildSiteFor, clearSiteFor, siteOf } from "./board_sites.js";

const MEM = "siege:board"; // player dynamic property
const OVERWORLD = "minecraft:overworld";
const FOE_TAG = "siege_board_foe";
const NPC_TAG = "siege_board_npc"; // a person a job brings out (the missing boy, the herb seller on the road)
const SHEEP_TAG = "siege_board_sheep";
// A Watch that keeps a flock (the job names `animal`) rather than lamps
const flockOf = (job) => job.animal ? `minecraft:${job.animal}` : undefined;
const FOLK_TYPE = "siege:townsfolk";
const TRADER_TYPE = "siege:job_npc";
const STORY_TYPE = "minecraft:npc"; // a story person (lore/npcs.js) who gives a story job: Tobin in your Longhouse
const SPAWN_NEAR = 72; // foes and people come out when you are this close (inside the loaded ground)
const LOOK_NEAR = 7;
const WATCH_NEAR = 28; // stay this close all night
const WATCH_LEAVE = 600; // ticks away from your post before the watch fails
const ESCORT_NEAR = 10;
const CLEAR_FAR = 112; // a finished job's site comes down once its player is this far off
const PILLAR_RANGE = 220;
const VALE = "Aldmere Vale";

const storyteller = () => typeof api.pickSeveral === "function" && typeof api.registerDeck === "function";
if (storyteller()) api.registerDeck("board", [...new Set(Object.values(KIND_MOOD))].map((id) => ({ id, kind: id })));

// ---------- memory ----------
const memCache = new Map();
export function memOf(player) {
  let m = memCache.get(player.id);
  if (m) return m;
  m = blankMemory();
  try {
    const raw = player.getDynamicProperty(MEM);
    if (typeof raw === "string") Object.assign(m, JSON.parse(raw));
  } catch { /* fresh */ }
  memCache.set(player.id, m);
  return m;
}
function saveMem(player) {
  try { player.setDynamicProperty(MEM, JSON.stringify(memOf(player))); } catch (e) { console.warn(`[Town Board] save: ${e}`); }
  api.emit("boardJob", { player });
}

// Story Mode unless the player chose Settlement Mode (newplayer/mode.js keeps it in "hc:mode")
const storyOn = (player) => { try { return player.getDynamicProperty("hc:mode") !== "settlement"; } catch { return true; } };
function ctxOf(player) {
  let raid = false;
  try { raid = isSiegeNight(); } catch { /* no siege state */ }
  // a story job that must come first (Act 2's family chest, newplayer/act2.js): offered alone while it is the step
  let firstJob;
  try { firstJob = storyOn(player) ? applyFilter("boardFirstJob", undefined, { player }) : undefined; } catch { /* no story */ }
  return { story: storyOn(player), siegesWon: heroOf(player).siegesHeld ?? 0, night: api.isNight(), raid, firstJob };
}
// Your home region: where your keep stands, else where you are; off the map, the Vale
function homeRegion(player) {
  let at = player.location;
  try { at = api.keepOf(api.homeOf(player.id) ?? player.id) ?? player.location; } catch { /* no keep */ }
  const r = regionAt(at.x, at.z);
  return REGIONS.includes(r) ? r : VALE;
}

// ---------- the board ----------
function notices(player) {
  const mem = memOf(player);
  const day = world.getDay();
  const ctx = ctxOf(player);
  if (mem.day !== day) {
    mem.day = day;
    mem.taken = [];
    mem.moods = storyteller() ? api.pickSeveral("board", player, 3).map((o) => o.id) : undefined;
    turnRounds(mem, ctx);
    saveMem(player);
  }
  return noticesFor(day, player.id, homeRegion(player), mem, ctx, mem.moods).filter((j) => !mem.taken.includes(j.id));
}

export function boardMenu(player) {
  const mem = memOf(player);
  const done = mem.jobsDone ?? 0;
  const form = new ActionFormData().title("Town Board");
  const actions = [];
  const head = `Jobs done: ${done}. Every ${JOBS_PER_POINT} jobs pay a skill point (next in ${JOBS_PER_POINT - (done % JOBS_PER_POINT)}).`;
  const run = mem.job, job = run && jobById(run.id);
  if (job) {
    const t = trackerStep(job, run);
    form.body(`${head}\n\n§lYour job: ${job.title}§r\n${noticeOf(job, mem).from}\n\n§6${t.title}§r\n${t.hint}`);
    form.button("Give up this job"); actions.push(() => { dropJob(player); player.sendMessage("§7You let the job go. Someone else may take it."); });
  } else {
    const offers = notices(player);
    form.body(offers.length ? `${head}\n\nNotices go up each morning. Take one at a time.` : `${head}\n\nNothing new pinned up today. Look again in the morning.`);
    for (const j of offers) {
      const n = noticeOf(j, mem);
      form.button(`${n.title}\n§8${n.from}`);
      actions.push(() => noticeMenu(player, j));
    }
  }
  form.button("Close");
  form.show(player).then((r) => { if (!r.canceled) actions[r.selection]?.(); }).catch(() => {});
}

function noticeMenu(player, job) {
  const n = noticeOf(job, memOf(player));
  const tier = jobTier(heroOf(player).level);
  const pay = startJob(job, memOf(player), tier, world.getDay());
  new MessageFormData().title(n.title).body(`"${n.text}"\n§8Pinned up by ${n.from}.§r\n\nPays ${pay.renown} Renown and ${worth(pay.emeralds)}.`)
    .button1("Take the notice").button2("Back")
    .show(player).then((r) => {
      if (r.canceled || r.selection !== 0) return boardMenu(player);
      takeJob(player, job);
    }).catch(() => {});
}

export function takeJob(player, job) {
  const mem = memOf(player);
  if (mem.job) return false;
  mem.job = startJob(job, mem, jobTier(heroOf(player).level), world.getDay());
  mem.taken = [...(mem.taken ?? []), job.id];
  saveMem(player);
  sfx(player, "random.orb");
  player.sendMessage(`§6Notice taken: ${job.title}.§7 ${trackerStep(job, mem.job).title}.`);
  return true;
}

function dropJob(player) {
  const mem = memOf(player);
  const run = mem.job;
  if (!run) return;
  removeOut(player, run);
  mem.job = null;
  mem.clear = true; // its site comes down once you have gone
  saveMem(player);
}

// ---------- talking to givers ----------
const say = (player, g, line) => player.sendMessage(`§f${g.name} §7(${g.trade})§f: §7${line}`);

// Is this entity the giver g? Townsfolk by their person tag, traders by job and town
const folkTag = (g) => { const p = peopleOf(g.town).find((x) => x.name === g.name); return p ? personTag(g.town, p.i) : undefined; };
const townTag = (town) => `siege_town_${town.toLowerCase().replace(/[^a-z]+/g, "_")}`;
export const giverTag = (key) => `siege_board_giver_${key}`;
function isGiver(entity, key) {
  const g = GIVERS[key];
  if (!g) return false;
  try {
    if (g.kind === "folk") return entity.typeId === FOLK_TYPE && entity.hasTag(folkTag(g) ?? "-");
    if (g.kind === "story") return entity.typeId === STORY_TYPE && entity.hasTag(g.tag);
    return entity.typeId === TRADER_TYPE && entity.hasTag(`siege_job_${g.job}`) && entity.hasTag(townTag(g.town));
  } catch { return false; }
}

function itemCount(player, id, named) {
  const inv = player.getComponent("minecraft:inventory")?.container;
  let n = 0;
  if (!inv) return 0;
  for (let i = 0; i < inv.size; i++) {
    const it = inv.getItem(i);
    if (it?.typeId === id && (!named || (it.nameTag ?? "").includes(named))) n += it.amount;
  }
  return n;
}
function takeNamed(player, id, named) {
  const inv = player.getComponent("minecraft:inventory")?.container;
  if (!inv) return false;
  for (let i = 0; i < inv.size; i++) {
    const it = inv.getItem(i);
    if (it?.typeId === id && (it.nameTag ?? "").includes(named)) { inv.setItem(i, it.amount > 1 ? Object.assign(it, { amount: it.amount - 1 }) : undefined); return true; }
  }
  return false;
}
function giveNamed(player, id, name, lore) {
  try {
    const it = new ItemStack(id, 1);
    it.nameTag = `§r§6${name}`;
    if (lore) it.setLore([`§7${lore}`]);
    const left = player.getComponent("minecraft:inventory")?.container?.addItem(it);
    if (left) player.dimension.spawnItem(left, player.location);
  } catch (e) { console.warn(`[Town Board] item ${id}: ${e}`); }
}
const thingName = (job) => job.thing.replace(/^the /, "").replace(/^./, (c) => c.toUpperCase());

// A click on a townsperson or a trader. Returns true when the board has business with them (the click is ours).
function clickedGiver(player, entity) {
  const mem = memOf(player);
  const run = mem.job, job = run && jobById(run.id);
  if (!job) return false;
  const step = stepOf(job, run);
  const g = giverOf(job);
  const mine = isGiver(entity, job.giver);
  if (step === "deliver" && job.to && isGiver(entity, job.to)) {
    const to = GIVERS[job.to];
    if (job.find && itemCount(player, job.find, thingName(job)) < 1) { say(player, to, "Have you brought something for me? I don't see it."); return true; }
    say(player, to, job.lines.at);
    next(player);
    return true;
  }
  if (!mine) return false;
  if (step === "talk") {
    say(player, g, offerLine(job, run));
    if (job.kind === "carry" && job.find) giveNamed(player, job.find, thingName(job), `For ${GIVERS[job.to]?.name}. From ${g.name}.`);
    next(player);
    return true;
  }
  if (step === "bring") {
    const have = itemCount(player, job.item);
    if (have < run.need) { say(player, g, `${job.lines.while?.[0] ?? ""} ${run.need} ${ITEM_NAMES[job.item] ?? "of them"}, mind. You've ${have}.`.trim()); return true; }
    api.takeItems(player, job.item, run.need);
    complete(player);
    return true;
  }
  if (step === "back") {
    if (job.kind === "carry" && job.find) takeNamed(player, job.find, thingName(job));
    if (job.kind === "recover" && job.find) {
      if (itemCount(player, job.find, thingName(job)) < 1) { say(player, g, `You haven't found it yet? ${PLACES[job.place].name}, it'll be.`); return true; }
      takeNamed(player, job.find, thingName(job));
    }
    complete(player);
    return true;
  }
  // a step out in the world: the giver reminds you
  say(player, g, job.lines.while?.[0] ?? `${trackerStep(job, run).title}.`);
  return true;
}

// Townsfolk and traders ask the board first (townsfolk/index.js, economy/shops.js: filter "npcClick").
// Runs in a before-event: only reads here, the answer runs a tick later.
addFilter("npcClick", (handled, { player, target }) => {
  if (handled) return true;
  const run = memOf(player).job, job = run && jobById(run.id);
  if (!job) return undefined;
  const step = stepOf(job, run);
  const ours = isGiver(target, job.giver) || (step === "deliver" && job.to && isGiver(target, job.to));
  if (!ours) return undefined;
  system.run(() => { try { if (target.isValid) clickedGiver(player, target); } catch (e) { console.warn(`[Town Board] click: ${e}`); } });
  return true;
});

// A giver someone needs stays out of doors at night (townsfolk/index.js filter "townsfolkKeepOut")
addFilter("townsfolkKeepOut", (set) => {
  const out = set ?? new Set();
  for (const p of world.getAllPlayers()) {
    const run = memOf(p).job, job = run && jobById(run.id);
    if (!job) continue;
    for (const key of [job.giver, job.to]) { const g = GIVERS[key]; if (g?.kind === "folk") { const t = folkTag(g); if (t) out.add(t); } }
  }
  return out;
});

// ---------- steps ----------
function next(player) {
  const mem = memOf(player);
  const run = mem.job, job = run && jobById(run.id);
  if (!job) return;
  if (lastStep(job, run)) return complete(player);
  run.step++;
  const step = stepOf(job, run);
  if (step === "go" || step === "escort") startOut(player, job, run);
  if (step === "back" || step === "home") run.outDone = true;
  saveMem(player);
  const t = trackerStep(job, run);
  player.sendMessage(`§6${t.title}.§7 ${t.hint}`);
}

// The place's site goes up now, while the player is far away
function startOut(player, job, run) {
  if (run.x === undefined) return;
  if (job.site) {
    run.building = true;
    buildSiteFor(player.id, job.site, run.x, run.z, (marks) => {
      const p = world.getAllPlayers().find((x) => x.id === player.id);
      const now = p && memOf(p).job;
      if (!now || now.id !== run.id) return;
      now.building = false;
      now.marks = marks ?? [];
      if (p) saveMem(p);
    });
  }
  if (job.kind === "escort") spawnPerson(player, job, run, player.location, giverOf(job));
}

function complete(player) {
  const mem = memOf(player);
  const run = mem.job, job = run && jobById(run.id);
  if (!job) return;
  const g = giverOf(job);
  say(player, g, job.lines.done);
  finish(mem, job, ctxOf(player));
  mem.job = null;
  mem.clear = true;
  removeOut(player, run);
  let renown = run.renown, emeralds = run.emeralds;
  if (job.keepsake && !(mem.keepsakes ?? []).includes(job.id)) {
    const [id, name, line] = job.keepsake;
    mem.keepsakes = [...(mem.keepsakes ?? []), job.id];
    giveNamed(player, id, name, `${line} §8(${g.name})`);
    player.sendMessage(`§6${g.name} gives you ${name}.§7 (${mem.keepsakes.length} keepsakes)`);
  } else if (storyteller() && api.maybePick?.("rumor_twists", player)?.id === "windfall") {
    emeralds *= 2;
    player.sendMessage(`§6${g.name} had more put by than they let on. The pay is doubled.`);
  } else if ((mem.jobsDone % 7) === 3) {
    renown = Math.round(renown * 1.5);
    player.sendMessage(`§6${g.name} tells it at every door for a week, and it grows in the telling.§7 More Renown.`);
  }
  saveMem(player);
  api.title(player, "§6Job done", `§7${job.title}`);
  sfx(player, "random.levelup");
  grantRenown(player, renown, "board", true);
  if (emeralds > 0) payE(player, emeralds, "board");
  if (mem.jobsDone % JOBS_PER_POINT === 0) grantPoints(player, 1, "word of your deeds spreads");
  if (storyteller()) api.note?.(player, KIND_MOOD[job.kind] ?? "quiet");
  // other features still listen for rumorDone (settle/planbook.js)
  api.emit("rumorDone", { player, job: { ...job, type: job.kind } });
  api.emit("boardJobDone", { player, job });
}

function fail(player, why) {
  const mem = memOf(player);
  const run = mem.job, job = run && jobById(run.id);
  if (!job) return;
  removeOut(player, run);
  mem.job = null;
  mem.clear = true;
  saveMem(player);
  api.title(player, "§cJob failed", `§7${why}`);
  player.sendMessage(`§7${job.title}: ${why} The notice will go up again another day.`);
}

// ---------- out in the world ----------
const jobTagOf = (player) => `siege_board_${player.id}`;
function outOf(player, tag, near) {
  try { return player.dimension.getEntities({ tags: [jobTagOf(player), tag], location: near, maxDistance: 128 }); } catch { return []; }
}
function removeOut(player, run) {
  if (run?.x === undefined) return;
  const at = { x: run.x, y: player.location.y, z: run.z };
  for (const tag of [FOE_TAG, NPC_TAG, SHEEP_TAG]) for (const e of outOf(player, tag, at)) try { e.remove(); } catch { /* gone */ }
  for (const e of outOf(player, NPC_TAG, player.location)) try { e.remove(); } catch { /* gone */ }
}

function groundAt(dim, x, z, fallback) {
  try { const t = dim.getTopmostBlock({ x, z }); if (t) return t.location.y + 1; } catch { /* unloaded */ }
  return fallback;
}
function spawnAt(player, type, at, name, tag) {
  const dim = player.dimension;
  try {
    const e = dim.spawnEntity(type, { x: at.x + 0.5, y: at.y ?? groundAt(dim, at.x, at.z, player.location.y), z: at.z + 0.5 });
    e.addTag(jobTagOf(player));
    e.addTag(tag);
    if (name) e.nameTag = name; // named mobs don't despawn
    return e;
  } catch { return undefined; }
}
const marksOf = (run, kind) => (run.marks ?? []).filter((m) => m.kind === kind);
const ring = (run, n, i, r) => ({ x: Math.round(run.x + Math.cos((i / n) * Math.PI * 2) * r), z: Math.round(run.z + Math.sin((i / n) * Math.PI * 2) * r) });

function spawnFoes(player, job, run, list, r = 4) {
  const spots = marksOf(run, "foe");
  let made = 0, i = 0;
  const total = list.reduce((a, [, n]) => a + n, 0);
  for (const [type, n] of list) for (let k = 0; k < n; k++, i++) {
    const at = spots.length ? spots[i % spots.length] : ring(run, total, i, r);
    if (spawnAt(player, type, at, job.kind === "hunt" ? "Marked" : i === 0 && type === "siege:shieldwall_brute" ? "Camp Sergeant" : "Raider", FOE_TAG)) made++;
  }
  return made;
}

// A person the job brings out (the herb seller on the road, the missing boy): a townsperson body, held still by
// slowness and walked along behind the player by script (trail of crumbs), so they never wander off
function spawnPerson(player, job, run, at, who) {
  const p = peopleOf(who?.town ?? "Kingsrest").find((x) => x.name === who?.name);
  const e = spawnAt(player, FOLK_TYPE, { x: Math.floor(at.x) + 1, y: at.y, z: Math.floor(at.z) }, who?.name ?? job.thing, NPC_TAG);
  if (!e) return undefined;
  try { e.setProperty("siege:skin", p?.skin ?? 3); } catch { /* skin is looks only */ }
  try { e.addEffect("slowness", 20000000, { amplifier: 255, showParticles: false }); } catch { /* fine */ }
  run.trail = [];
  return e;
}
function walkBehind(player, e, run) {
  const p = player.location, t = run.trail;
  const last = t[t.length - 1];
  if (!last || Math.hypot(p.x - last.x, p.z - last.z) > 1.5) t.push({ x: p.x, y: p.y, z: p.z });
  if (t.length > 40) t.splice(0, t.length - 40);
  const here = e.location;
  const d = Math.hypot(p.x - here.x, p.z - here.z);
  if (d > 40) { try { e.teleport({ x: p.x - 1, y: p.y, z: p.z - 1 }); } catch { /* unloaded */ } run.trail = []; return; }
  if (d < 2.5 || t.length < 3) return;
  const target = t[0];
  const dx = target.x - here.x, dz = target.z - here.z, dd = Math.hypot(dx, dz);
  if (dd < 0.8) { t.shift(); return; }
  const step = Math.min(0.9, dd);
  const nx = here.x + (dx / dd) * step, nz = here.z + (dz / dd) * step;
  const ny = groundAt(e.dimension, Math.floor(nx), Math.floor(nz), target.y);
  try { e.teleport({ x: nx, y: Math.abs(ny - here.y) <= 2 ? ny : target.y, z: nz }, { facingLocation: { x: target.x, y: target.y + 1.6, z: target.z } }); } catch { /* unloaded */ }
}

// A column of light over the job's place, so it shows from a long way off
function pillar(player, run) {
  const d = Math.hypot(run.x - player.location.x, run.z - player.location.z);
  if (d > PILLAR_RANGE) return;
  const y0 = groundAt(player.dimension, run.x, run.z, player.location.y);
  for (let y = 0; y < 36; y += 3) {
    try { player.spawnParticle("minecraft:villager_happy", { x: run.x + 0.5, y: y0 + y, z: run.z + 0.5 }); } catch { return; }
  }
}

function lampsLit(player, run) {
  let lit = 0;
  for (const m of marksOf(run, "lamp")) { try { if (player.dimension.getBlock(m)?.typeId === "minecraft:lantern") lit++; } catch { lit++; } }
  return lit;
}

function tickOne(player) {
  const mem = memOf(player);
  const run = mem.job, job = run && jobById(run.id);
  if (!job) {
    // a finished job's site comes down once its player is well away
    if (mem.clear) {
      const s = siteOf(player.id);
      if (!s) { mem.clear = false; saveMem(player); }
      else if (Math.hypot(s.x - player.location.x, s.z - player.location.z) > CLEAR_FAR && clearSiteFor(player.id)) { mem.clear = false; saveMem(player); }
    }
    return;
  }
  if (player.dimension.id !== OVERWORLD || run.x === undefined) return;
  const step = stepOf(job, run);
  const dist = Math.hypot(run.x - player.location.x, run.z - player.location.z);
  if (step === "go" || step === "escort") pillar(player, run);
  const ctx = ctxOf(player);
  const near = { x: run.x, y: player.location.y, z: run.z };

  if (step === "escort" || step === "home") {
    const e = outOf(player, NPC_TAG, player.location)[0];
    if (!e) { if (step === "home") return fail(player, `You lost ${job.thing} on the road.`); spawnPerson(player, job, run, player.location, giverOf(job)); return; }
    walkBehind(player, e, run);
    if (step === "escort") {
      const left = outOf(player, FOE_TAG, near).length;
      if (dist < 48 && !run.spawned) { run.spawned = true; spawnFoes(player, job, run, foesAt(job, run.tier)); saveMem(player); player.sendMessage(`§c${job.lines.while?.[1] ?? "They've seen you."}`); }
      if (run.spawned && left === 0 && Math.hypot(e.location.x - run.x, e.location.z - run.z) < ESCORT_NEAR) complete(player);
    } else {
      const g = giverOf(job), w = WARDS.find((x) => x.name === g.town);
      if (w && Math.hypot(e.location.x - w.x, e.location.z - w.z) < w.r) complete(player);
    }
    return;
  }
  if (step !== "go" || run.building) return;

  switch (job.kind) {
    case "hunt": {
      if (job.when?.night && !ctx.night) return;
      if (!run.spawned && dist < SPAWN_NEAR) {
        const pack = [[job.mob, Math.max(0, run.need - run.have)], ...foesAt(job, run.tier)];
        if (spawnFoes(player, job, run, pack) > 0) { run.spawned = true; saveMem(player); player.sendMessage(`§c${job.lines.while?.[0] ?? "They're close."}`); }
      }
      return;
    }
    case "camp": {
      if (!run.spawned && dist < SPAWN_NEAR) {
        const made = spawnFoes(player, job, run, foesAt(job, run.tier));
        if (made > 0) { run.spawned = true; run.left = made; saveMem(player); player.sendMessage(`§c${job.lines.while?.[0] ?? "You smell smoke."}`); }
        return;
      }
      if (run.spawned && dist < 80) {
        const left = outOf(player, FOE_TAG, near).length;
        if (left !== run.left) { run.left = left; saveMem(player); }
        if (left === 0) { player.sendMessage("§aThe camp is broken."); next(player); }
      }
      return;
    }
    case "look": {
      if (job.when?.night && !ctx.night) return;
      const spot = marksOf(run, "look")[0] ?? near;
      if (Math.hypot(spot.x - player.location.x, spot.z - player.location.z) < LOOK_NEAR) {
        player.sendMessage(`§7${job.lines.seen}`);
        next(player);
      }
      return;
    }
    case "recover": {
      const spot = marksOf(run, "find")[0] ?? near;
      const d = Math.hypot(spot.x - player.location.x, spot.z - player.location.z);
      if (!run.spawned && d < 24) {
        try {
          const it = new ItemStack(job.find, 1);
          it.nameTag = `§r§6${thingName(job)}`;
          player.dimension.spawnItem(it, { x: spot.x + 0.5, y: (spot.y ?? groundAt(player.dimension, spot.x, spot.z, player.location.y)) + 0.2, z: spot.z + 0.5 });
          run.spawned = true; saveMem(player);
        } catch { /* not loaded yet */ }
      }
      if (run.spawned && itemCount(player, job.find, thingName(job)) > 0) {
        if (job.lines.seen) player.sendMessage(`§7${job.lines.seen}`);
        next(player);
      }
      return;
    }
    case "missing": {
      const spot = marksOf(run, "person")[0] ?? near;
      if (!run.spawned && dist < SPAWN_NEAR) { if (spawnPerson(player, job, run, spot, { name: job.thing, town: giverOf(job).town })) { run.spawned = true; saveMem(player); } return; }
      const e = outOf(player, NPC_TAG, near)[0];
      if (e && Math.hypot(e.location.x - player.location.x, e.location.z - player.location.z) < 4) {
        player.sendMessage(`§f${job.thing}§f: §7${job.lines.found}`);
        next(player);
      }
      return;
    }
    case "watch": {
      if (dist > WATCH_NEAR) {
        if (run.watching) { run.away = (run.away ?? 0) + 20; if (run.away > WATCH_LEAVE) return fail(player, "You left your post."); if (run.away % 200 === 20) player.sendMessage("§cGet back to your post before it's too late."); }
        return;
      }
      run.away = 0;
      if (!ctx.night) {
        if (run.watching) { // the dawn bell
          const kept = flockOf(job) ? outOf(player, SHEEP_TAG, near).length : lampsLit(player, run);
          if (kept >= run.need) { player.sendMessage("§aThe dawn bell. Your watch is over."); for (const e of outOf(player, FOE_TAG, near)) try { e.remove(); } catch { /* gone */ } next(player); }
          else fail(player, "Morning came, and too much was lost.");
        } else if (!run.told) { run.told = true; saveMem(player); player.sendMessage("§7Nothing to do here till dusk. Come back as the sun goes down."); }
        return;
      }
      if (ctx.raid) return;
      if (!run.watching) {
        run.watching = true; run.wave = 0; run.nextWave = system.currentTick + 400;
        if (flockOf(job)) for (const m of marksOf(run, "sheep")) spawnAt(player, flockOf(job), m, undefined, SHEEP_TAG);
        saveMem(player);
        player.sendMessage(`§7${job.lines.while?.[0] ?? "The watch begins."}`);
      }
      if (system.currentTick >= run.nextWave && run.wave < 4) {
        run.wave++; run.nextWave = system.currentTick + 2400;
        spawnFoes(player, job, { ...run, marks: [] }, foesAt(job, run.tier).map(([t, n]) => [t, n]), 15); // out of the dark, beyond the fold wall and the lamps
        saveMem(player);
      }
      // what the foes go for: a lamp goes dark, a sheep goes down
      for (const f of outOf(player, FOE_TAG, near)) {
        if (flockOf(job)) {
          for (const s of outOf(player, SHEEP_TAG, near)) if (Math.hypot(s.location.x - f.location.x, s.location.z - f.location.z) < 1.8) try { s.kill(); } catch { /* gone */ }
        } else {
          for (const m of marksOf(run, "lamp")) if (Math.hypot(m.x + 0.5 - f.location.x, m.z + 0.5 - f.location.z) < 2) try { const b = player.dimension.getBlock(m); if (b?.typeId === "minecraft:lantern") b.setType("minecraft:air"); } catch { /* unloaded */ }
        }
      }
      return;
    }
    default: return;
  }
}

export function boardTick() {
  for (const player of world.getAllPlayers()) {
    try { tickOne(player); } catch (e) { console.warn(`[Town Board] ${player.name}: ${e}`); }
  }
}

// A lamp put out on a watch can be lit again: click its post (the block under the lamp's spot)
world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  const { player, block } = event;
  const run = memOf(player).job;
  if (!run?.watching) return;
  const m = marksOf(run, "lamp").find((l) => l.x === block.location.x && l.z === block.location.z && block.location.y === l.y - 1);
  if (!m) return;
  event.cancel = true;
  system.run(() => { try { const b = player.dimension.getBlock(m); if (b?.isAir) { b.setType("minecraft:lantern"); sfx(player, "fire.ignite"); } } catch { /* unloaded */ } });
});

// Kills for a Hunt: any of the hunted kind killed by the player counts, wherever
world.afterEvents.entityDie.subscribe((event) => {
  const killer = event.damageSource.damagingEntity;
  if (killer?.typeId !== "minecraft:player") return;
  const run = memOf(killer).job, job = run && jobById(run.id);
  if (job?.kind !== "hunt" || stepOf(job, run) !== "go") return;
  let type;
  try { type = event.deadEntity.typeId; } catch { return; }
  if (type !== job.mob) return;
  run.have++;
  if (run.have >= run.need) { killer.sendMessage(`§aThat's ${run.need}.`); return next(killer); }
  saveMem(killer);
  killer.onScreenDisplay.setActionBar(`§6${job.title}: ${run.have}/${run.need} ${MOB_NAMES[job.mob] ?? ""}`);
});

// ---------- the tracker ----------
// The quest tracker's step for a running job: { id, title, hint, target, npc } (quests/rules.js shows it). A story
// job's step is the story's main step instead (newplayer/act2.js reads boardStep), so it is not shown twice.
export function boardQuest(player) {
  const run = memOf(player).job, job = run && jobById(run.id);
  if (!job || job.story) return undefined;
  return boardStep(player);
}
// The running job's step, story or not: { id, job, step, title, hint, target, npc }
export function boardStep(player) {
  const run = memOf(player).job, job = run && jobById(run.id);
  if (!job) return undefined;
  const t = trackerStep(job, run);
  const step = stepOf(job, run);
  const g = giverOf(job), to = job.to && GIVERS[job.to];
  const person = step === "deliver" ? to : step === "talk" || step === "back" || step === "bring" ? g : undefined;
  const town = person && WARDS.find((w) => w.name === person.town);
  const target = person
    ? (town ? { name: person.town, x: town.x, z: town.z, dim: OVERWORLD } : undefined)
    : run.x !== undefined ? { name: PLACES[job.place]?.name ?? job.title, x: run.x, z: run.z, dim: OVERWORLD } : undefined;
  return { id: `board_${job.id}_${run.step}`, job: job.id, step, title: t.title, hint: t.hint, target, npc: person ? { tag: giverTag(person === g ? job.giver : job.to), name: person.name } : undefined };
}

// The quest marks find people by one tag: givers a player needs get theirs while that player is near
api.onTick("board_giver_tags", 40, () => {
  for (const player of world.getAllPlayers()) {
    const run = memOf(player).job, job = run && jobById(run.id);
    if (!job) continue;
    for (const key of [job.giver, job.to].filter(Boolean)) {
      const g = GIVERS[key];
      const type = g.kind === "folk" ? FOLK_TYPE : g.kind === "story" ? STORY_TYPE : TRADER_TYPE;
      let list = [];
      try { list = player.dimension.getEntities({ type, location: player.location, maxDistance: 96 }); } catch { continue; }
      for (const e of list) if (isGiver(e, key) && !e.hasTag(giverTag(key))) try { e.addTag(giverTag(key)); } catch { /* gone */ }
    }
  }
});

// ---------- test command ----------
system.afterEvents.scriptEventReceive.subscribe((e) => {
  if (e.id !== "siege:board") return;
  const player = e.sourceEntity;
  if (player?.typeId !== "minecraft:player") return;
  const [cmd, arg] = (e.message ?? "").trim().split(/\s+/);
  const mem = memOf(player);
  if (cmd === "take") {
    const job = jobById(arg);
    if (!job) return player.sendMessage(`§cNo job "${arg}".`);
    if (mem.job) dropJob(player);
    takeJob(player, job);
    return;
  }
  if (cmd === "step") { next(player); return; }
  if (cmd === "drop") { dropJob(player); player.sendMessage("§7Job dropped."); return; }
  if (cmd === "reset") { removeOut(player, mem.job); clearSiteFor(player.id); memCache.set(player.id, blankMemory()); saveMem(player); player.sendMessage("§7Board memory cleared."); return; }
  const run = mem.job, job = run && jobById(run.id);
  const today = notices(player).map((j) => `${j.id} (${j.kind}, ${GIVERS[j.giver].name})`).join(", ");
  player.sendMessage(`§6Town Board§7 home ${homeRegion(player)}, rounds ${JSON.stringify(mem.round)}, done ${Object.keys(mem.done).length} kinds of job, ${mem.jobsDone ?? 0} jobs.\nToday: ${today || "nothing"}\nJob: ${job ? `${job.id}, ${trackerStep(job, run).title}` : "none"}`);
});

world.afterEvents.playerLeave.subscribe(({ playerId }) => memCache.delete(playerId));
