// What happens inside a finished wonder (Mateo 2026-11-13). Numbers and words: data.js SPIRE, FAIR, INSIDE_LINES.
//
//   Lantern Spire: lost travellers come in by its light each dawn and wait on the deck by the keeper. Anyone its
//     gift reaches (holder, allies, settlements in Blackfen) takes one on for nothing: a soldier goes to their
//     Barracks (army enlistFree), a settler to a free bed in their town (settleCensus, exact). First come, first served.
//   Great Horse Fair: ride the course (laps of the track, checkpoints in order, par time and the Fair's record) or
//     joust the Fair's champion in the ring, for an entry fee and a purse.
//   Every wonder: the custom items thread's forge (and the Sun Gate's caravan market) hang off the keeper's menu
//     when that module says it has one: applyFilter("codexForgeLabel" | "codexCaravanLabel") -> a label, and the
//     button emits "codexForge" { player, wonderId } | "codexCaravan" { player }.
//
// Saved: moduleStore "siege:wonders_inside" = { spire: { day, list: [{ k, type?, name, taken? }] }, fair: { record, recordName, day, pursed: { id: n } } }
// Events: emit("spireRecruit", { owner, kind, type? }), emit("fairRace", { player, seconds, record }), emit("fairJoust", { player, won })

import { world, system, GameMode } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { onTick, emit, moduleStore, getState } from "../siege/api.js";
import { applyFilter } from "../core/events.js";
import { charge, pay, coins } from "../economy/api.js";
import { enlistFree } from "../army/index.js";
import { SOLDIER } from "../army/roster.js";
import { nextArrival } from "../settle/settlers.js";
import { townOf } from "../settle/founding.js";
import { groundTop } from "../settle/ground.js";
import { WONDER, WONDER_BY_ID, SPIRE, FAIR, INSIDE_LINES } from "./data.js";
import { standing, specToWorld, travellersFor, raceStep, racePurse } from "./rules.js";
import { stateOf, heldFor, keeperSpot, near } from "./index.js";

const OVERWORLD = "minecraft:overworld";
const NPC_TYPE = "minecraft:npc";
const TRAVELLER = "siege_spire_traveller";
const CHAMPION = "siege_fair_champion";
const store = moduleStore("siege:wonders_inside", () => ({ spire: { day: -1, list: [] }, fair: { record: null, recordName: null, day: -1, pursed: {} } }));
const save = () => store.save();
const fill = (text, words) => text.replace(/\{(\w+)\}/g, (m, k) => words[k] ?? m);
const say = (player, who, line, words = {}) => { try { player.sendMessage(`§7${who}: §f${fill(INSIDE_LINES[line] ?? line, words)}`); } catch { /* left */ } };
const mountOf = (player) => { try { return player.getComponent("minecraft:riding")?.entityRidingOn; } catch { return undefined; } };
const SETTLER_NAMES = ["A tinker and his cart", "A widow and her boy", "A runaway apprentice", "A fen-cutter", "A pilgrim", "A drover", "A hedge-mason", "Two sisters from the coast"];

// whose settlement a player's recruits go to: their own keep, or the keep they are an ally of
function ownerFor(id) {
  const keeps = getState().keeps ?? {};
  if (keeps[id]) return id;
  return Object.keys(keeps).find((o) => keeps[o].allies?.includes(id));
}

// ---------- the keeper's extra buttons ----------

export function insideActions(player, w) {
  const out = [];
  const up = standing(stateOf(w.id));
  if (w.id === "lantern_spire") {
    const waiting = up ? today().list.filter((t) => !t.taken).length : 0;
    out.push([up ? `Meet the travellers (${waiting} waiting)` : "Ask about the lamps", () => (up ? spireMenu(player) : say(player, w.keeper, "spireNotYet"))]);
  }
  if (w.id === "great_horse_fair") {
    if (!up) out.push(["Ask about the racing", () => say(player, w.keeper, "fairNotYet")]);
    else {
      out.push([`Ride the course (${coins(FAIR.raceEntry)})${store.data.fair.record ? `\n§8record ${store.data.fair.record}s, ${store.data.fair.recordName}` : ""}`, () => startRace(player, w)]);
      out.push([`Joust the champion (${coins(FAIR.joustEntry)})`, () => startJoust(player, w)]);
    }
  }
  if (up) {
    let forge, caravan;
    try { forge = applyFilter("codexForgeLabel", null, { wonderId: w.id, player }); } catch { forge = null; }
    if (forge) out.push([forge, () => emit("codexForge", { player, wonderId: w.id })]);
    if (w.id === "sun_gate") {
      try { caravan = applyFilter("codexCaravanLabel", null, { player }); } catch { caravan = null; }
      if (caravan) out.push([caravan, () => emit("codexCaravan", { player })]);
    }
  }
  return out;
}

// ---------- the Lantern Spire's travellers ----------

function today() {
  const sp = store.data.spire, day = world.getDay();
  if (sp.day !== day) {
    sp.day = day;
    sp.list = travellersFor(day).map((t, i) => ({ ...t, name: t.k === "soldier" ? `A lost ${SOLDIER[t.type]?.name ?? "soldier"}` : SETTLER_NAMES[(day * 3 + i) % SETTLER_NAMES.length] }));
    save();
  }
  return sp;
}

function spireMenu(player) {
  const w = WONDER_BY_ID.lantern_spire;
  const list = today().list;
  const open = list.map((t, i) => [t, i]).filter(([t]) => !t.taken);
  if (!open.length) return say(player, w.keeper, "spireNone");
  const form = new ActionFormData().title("Lost travellers")
    .body("§7They came in through the fen last night, following the Spire's lamps. Anyone the light shines for can take them on, and they ask nothing for it.");
  for (const [t] of open) form.button(`${t.name}\n§8${t.k === "soldier" ? "will serve as a soldier" : "looking for a home"}`);
  form.button("Close");
  form.show(player).then((res) => {
    if (res.canceled || res.selection === undefined || res.selection >= open.length) return;
    recruit(player, open[res.selection][1]);
  }).catch(() => {});
}

function recruit(player, i) {
  const w = WONDER_BY_ID.lantern_spire;
  const t = today().list[i];
  if (!t || t.taken) return say(player, w.keeper, "spireNone");
  if (!standing(stateOf(w.id))) return say(player, w.keeper, "spireNotYet");
  if (!heldFor(player.id).includes(w.id)) return say(player, w.keeper, "spireNotYours");
  const owner = ownerFor(player.id);
  if (!owner) return say(player, w.keeper, t.k === "soldier" ? "spireNoBarracks" : "spireNoTown");
  if (t.k === "soldier") {
    const problem = enlistFree(owner, t.type);
    if (problem) return say(player, w.keeper, { noKeep: "spireNoBarracks", locked: "spireLocked", full: "spireFull", unknown: "spireNone" }[problem]);
    player.sendMessage(`§6${t.name.replace(/^A lost /, "The ")} will serve you. He's on his way to your Barracks.`);
  } else {
    if (!townOf(owner)) return say(player, w.keeper, "spireNoTown");
    if (!nextArrival(owner)) return say(player, w.keeper, "spireNoBed");
    emit("settleCensus", { owner, arrivals: 1, exact: true });
    player.sendMessage(`§6${t.name} will make a home in your town.`);
  }
  t.taken = player.id;
  save();
  emit("spireRecruit", { owner, kind: t.k, type: t.type });
  removeTraveller(i);
}

function removeTraveller(i) {
  try {
    for (const e of world.getDimension(OVERWORLD).getEntities({ type: NPC_TYPE, tags: [`${TRAVELLER}_${i}`] })) e.remove();
  } catch { /* unloaded */ }
}

// the travellers stand on the deck either side of the keeper while someone is near
onTick("wonders_spire", 100, () => {
  const w = WONDER_BY_ID.lantern_spire;
  if (!standing(stateOf(w.id)) || !near(w.site, WONDER.keeperRange).length) return;
  const sp = today();
  const dim = world.getDimension(OVERWORLD);
  const k = keeperSpot(w);
  const side = specToWorld(w.face, { x: 0, z: 0 }, 1, 0); // one block along the front
  try {
    for (const e of dim.getEntities({ type: NPC_TYPE, tags: [TRAVELLER], location: { x: w.site.x, y: 64, z: w.site.z }, maxDistance: 128 })) {
      const day = Number(e.getTags().find((tg) => tg.startsWith(`${TRAVELLER}_day_`))?.slice(TRAVELLER.length + 5));
      const i = Number(e.getTags().find((tg) => /_\d+$/.test(tg) && tg.startsWith(`${TRAVELLER}_`) && !tg.includes("day"))?.slice(TRAVELLER.length + 1));
      if (day !== sp.day || sp.list[i]?.taken) e.remove();  // yesterday's, or already taken on: they've gone
    }
    sp.list.forEach((t, i) => {
      if (t.taken || i >= SPIRE.standOut.length) return;
      if (dim.getEntities({ type: NPC_TYPE, tags: [`${TRAVELLER}_${i}`, `${TRAVELLER}_day_${sp.day}`] }).length) return;
      const x = k.x + side.x * SPIRE.standOut[i], z = k.z + side.z * SPIRE.standOut[i];
      const top = groundTop(dim, x, z);
      if (top === undefined) return;
      const e = dim.spawnEntity(NPC_TYPE, { x: x + 0.5, y: top + 1, z: z + 0.5 });
      for (const tg of [TRAVELLER, `${TRAVELLER}_${i}`, `${TRAVELLER}_day_${sp.day}`]) e.addTag(tg);
      e.nameTag = `${t.name}\n§7free to take on`;
    });
  } catch {
    // not loaded yet
  }
});

world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
  const { player, target } = event;
  if (target.typeId !== NPC_TYPE || !target.hasTag(TRAVELLER)) return;
  if (player.isSneaking && player.getGameMode() === GameMode.Creative) return;
  event.cancel = true;
  system.run(() => spireMenu(player));
});

// ---------- the Great Horse Fair: racing ----------

const races = new Map(); // player id -> run
let joust = null;        // { by, until, champion }

function pursedToday(id) {
  const f = store.data.fair, day = world.getDay();
  if (f.day !== day) { f.day = day; f.pursed = {}; }
  return f.pursed[id] ?? 0;
}

function startRace(player, w) {
  if (!standing(stateOf(w.id))) return say(player, w.keeper, "fairNotYet");
  if (!mountOf(player)) return say(player, w.keeper, "fairMount");
  if (races.has(player.id)) return say(player, w.keeper, "fairStart", { laps: FAIR.laps });
  if (!charge(player, FAIR.raceEntry, "fair")) return player.sendMessage(`§7${w.keeper}: §fThe entry is ${coins(FAIR.raceEntry)}.`);
  const points = FAIR.checkpoints.map(([x, z]) => { const p = specToWorld(w.face, w.site, x, z); return [p.x + 0.5, p.z + 0.5]; });
  races.set(player.id, { points, next: 0, until: system.currentTick + FAIR.raceMinutes * 1200 });
  say(player, w.keeper, "fairStart", { laps: FAIR.laps });
}

function finishRace(player, run) {
  const w = WONDER_BY_ID.great_horse_fair;
  const f = store.data.fair;
  const r = racePurse(run.seconds, f.record ?? undefined, pursedToday(player.id));
  if (r.purse) { pay(player, r.purse, "fair"); f.pursed[player.id] = pursedToday(player.id) + 1; }
  if (r.record) {
    f.record = r.time; f.recordName = player.name;
    for (const p of world.getPlayers()) if (p.id !== player.id) p.sendMessage(`§6${player.name} has set a new record at the Great Horse Fair: ${r.time} seconds.`);
  }
  save();
  say(player, w.keeper, r.line, { time: `${r.time} seconds`, par: `${FAIR.par} seconds`, purse: coins(r.purse) });
  emit("fairRace", { player, seconds: r.time, record: r.record });
}

onTick("wonders_fair", 2, () => {
  if (!races.size && !joust) return;
  const t = system.currentTick / 20;
  for (const [id, run] of [...races]) {
    const player = world.getPlayers().find((p) => p.id === id);
    if (!player) { races.delete(id); continue; }
    const keeper = WONDER_BY_ID.great_horse_fair.keeper;
    if (!mountOf(player)) { races.delete(id); say(player, keeper, "fairOff"); continue; }
    if (system.currentTick > run.until) { races.delete(id); say(player, keeper, "fairSlow"); continue; }
    const next = raceStep(run, player.location, t);
    if (next.done) { races.delete(id); finishRace(player, next); continue; }
    races.set(id, next);
    const [cx, cz] = next.points[next.next];
    try {
      if (system.currentTick % 6 === 0) player.dimension.spawnParticle("minecraft:villager_happy", { x: cx, y: player.location.y + 1.5, z: cz });
      player.onScreenDisplay.setActionBar(next.start === undefined ? "§eRide to the start line" : `§eLap ${Math.min(FAIR.laps, (next.lap ?? 0) + 1)}/${FAIR.laps}  §f${(t - next.start).toFixed(1)}s`);
    } catch { /* left */ }
  }
  if (joust) joustTick();
});

// ---------- the Great Horse Fair: the joust ----------

function startJoust(player, w) {
  if (!standing(stateOf(w.id))) return say(player, w.keeper, "fairNotYet");
  if (!mountOf(player)) return say(player, w.keeper, "fairMount");
  if (joust) return say(player, w.keeper, "fairBusy");
  if (!charge(player, FAIR.joustEntry, "fair")) return player.sendMessage(`§7${w.keeper}: §fThe entry is ${coins(FAIR.joustEntry)}.`);
  const dim = world.getDimension(OVERWORLD);
  const c = specToWorld(w.face, w.site, FAIR.champion.x, FAIR.champion.z);
  const top = groundTop(dim, c.x, c.z);
  const at = { x: c.x + 0.5, y: (top ?? Math.floor(player.location.y)) + 1, z: c.z + 0.5 };
  let champion;
  try { champion = applyFilter("rivalSoldier", undefined, { dim, at, role: "knight", tier: 3, name: "Champion of the Fair", tags: [CHAMPION] }); } catch { champion = undefined; }
  if (!champion) {
    try { champion = dim.spawnEntity("siege:shieldwall_brute", at); champion.addTag(CHAMPION); champion.nameTag = "Champion of the Fair"; } catch { champion = undefined; }
  }
  if (!champion) { pay(player, FAIR.joustEntry, "fair"); return say(player, w.keeper, "fairBusy"); }
  joust = { by: player.id, until: system.currentTick + FAIR.joustMinutes * 1200, champion };
  say(player, w.keeper, "joustStart", { mins: FAIR.joustMinutes });
}

function joustTick() {
  const w = WONDER_BY_ID.great_horse_fair;
  const player = world.getPlayers().find((p) => p.id === joust.by);
  let alive = false;
  try { alive = joust.champion.isValid && (joust.champion.getComponent("minecraft:health")?.currentValue ?? 1) > 0; } catch { alive = false; }
  const end = (won) => {
    try { if (alive) joust.champion.remove(); } catch { /* gone */ }
    joust = null;
    if (!player) return;
    if (won && pursedToday(player.id) < FAIR.pursesPerDay) {
      pay(player, FAIR.joustPurse, "fair");
      store.data.fair.pursed[player.id] = pursedToday(player.id) + 1;
      save();
      say(player, w.keeper, "joustWon", { purse: coins(FAIR.joustPurse) });
    } else if (won) say(player, w.keeper, "fairPursed", { time: "Well ridden" });
    else say(player, w.keeper, "joustLost");
    emit("fairJoust", { player, won });
  };
  if (!player || Math.hypot(player.location.x - w.site.x, player.location.z - w.site.z) > WONDER.challengeRange) return end(false);
  if (!alive) return end(true);
  if (!mountOf(player)) { say(player, w.keeper, "fairOff"); return end(false); }
  if (system.currentTick > joust.until) return end(false);
}
