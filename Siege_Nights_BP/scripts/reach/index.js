// The Reach: how the every-third-night sieges grow into a siege that never ends.
// Rules and numbers are in rules.js (start there). This file is the game side.
//
//   The Reach (0-100, one number for the whole world) picks a stage:
//     1 The Counted Nights   every third night, an army of men
//     2 The Leaning          the same nights, heavier; the first Hollow soldiers; knocks in between
//     3 The Miscount         two nights in three
//     4 The Uncounted Nights every night
//     5 The Long Night       dawn no longer ends it (begins when the Choir falls)
//     6 The Quiet After      the source is rectified: ordinary raids, now and then
//
//   A siege night runs on the clock: omens from 18:00, the horn 45 seconds before the first wave,
//   one wave an hour at seventeen past, the last at 3:17.
//
// Test commands (need cheats):
//   /scriptevent siege:reach                 what stage, what tonight is
//   /scriptevent siege:reach_set <0-100>     set the Reach (story gates still apply)
//   /scriptevent siege:reach_stage <1-6>     force a stage, gates ignored
//   /scriptevent siege:reach_night [kind]    make tonight a siege night (counted, stolen, probe, long, muster) and jump to just before the horn
//   /scriptevent siege:reach_toll            jump to 3:16
//   /scriptevent siege:reach_boss <id>       pretend a boss fell (reeve ... choir, morvane)
//   /scriptevent siege:reach_glimpse         let the first Hollow soldiers arrive again
//   /scriptevent siege:reach_reset           back to the start

import { world, system, WeatherType } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { applyFilter } from "../core/events.js";
import {
  isReady, getState, saveState, keepOf, keepCenter, settlementAt, isNight, startSiege, endSiege, spawnRaider, raidersLeft,
  MODIFIERS, FACTIONS, SETTINGS, title, overworld, ownerTag, pick, on, emit, addFilter,
  addPlanHook, addSiegeSkipHook, addKeepMenuButtons, onTick, moduleStore,
  provideFact, registerDeck, storyPick, note,
} from "../siege/api.js";
import { bestiaryStore } from "../bestiary/bossCore.js";
import * as troops from "../bestiary/spawns.js";
import * as rivals from "../rivals/index.js";
import * as riftSite from "../undertow/source.js";
import {
  REACH, STAGES, LONG, AFTER, stage, stageFor, capReach, nightKind, isSiegeKind, profile, openTime, waveTime, waveRole, waveShare,
  hollowCount, tideLull, pressureMult, clock, nextSiege, duskLine, dayRoll, clamp, troopMix, WATCHER_FROM_REACH,
  musterGap, duskSpeed, watchHint, hourOmen, omenSide, DUSK_ACT,
  WAVES, SHAPES, pickShape, HONOURS, NEMESIS, NEW_MODIFIERS, HOLLOW_TWISTS_FROM, CAPTAIN_NAMES, CAPTAIN_TITLES,
} from "./rules.js";
import { performOmen, ACTS } from "./omens.js";
import "./tests.js";
import { sfx } from "../core/sfx.js";

Object.assign(MODIFIERS, NEW_MODIFIERS); // so the war plan can name them

const store = moduleStore("siege:reach", () => ({
  lastShape: null, // the shape of the last full night, so the next one is different
  keeps: {}, // owner -> { faction, twists, nemesis: { name, escapes }, roll: [captains slain], seen: full nights, glimpsed }
  perKeepGlimpse: false, // the world-wide first glimpse has been handed on to the keeps that stood then
  rift: false, // the Rift has been opened: the Long Night has begun
  musterDay: -1, musterGap: 0, musterLord: null, // after the story: the night the next rival town comes, and who came last
  honours: {}, // player id -> [honour keys]
  reach: 0, stage: 1, salt: Math.floor(Math.random() * 1e6),
  bosses: {}, choir: false, source: false,
  pressure: 0, // the Long Night: up at every dusk and every dawn they stay, down when a night is broken
  glimpsed: false, // the first Hollow soldiers have been seen
  night: null, // tonight's siege, while it runs
  forced: null, // test command: { day, kind }
  remembered: null, // after the story: { by, stage } while a Remembered Night runs
  omen: "", lastDawn: -1, sky: false, last: null,
  quietNoted: true, // the Storyteller has been told about the quiet since the last siege
}));
// New saved fields get their defaults from moduleStore. A siege that was running when the pack was updated is topped up here.
export function reachData() {
  const d = store.data;
  if (d.night && !Array.isArray(d.night.glimpse)) d.night.glimpse = [];
  if (d.night && !d.night.captains) Object.assign(d.night, { shape: d.night.shape ?? "old", captains: {}, slain: {}, tolled: false, sawDawn: false });
  return d;
}
const keepNotes = (owner) => {
  const d = reachData();
  const notes = (d.keeps[owner] ??= { roll: [] });
  return notes;
};
const hasGlimpsed = (owner) => !!keepNotes(owner).glimpsed;

// A named honour: earned once, kept for good, worth a skill point
function honour(player, key) {
  const d = reachData();
  const mine = (d.honours[player.id] ??= []);
  if (mine.includes(key) || !HONOURS[key]) return;
  mine.push(key);
  store.save();
  player.sendMessage(`§6Night honour: §f${HONOURS[key]}`);
  try {
    system.sendScriptEvent("siege:award_skill_points", JSON.stringify({ player: player.id, points: 1, renown: 10, reason: `night honour: ${HONOURS[key]}` }));
  } catch { /* the town hall isn't listening */ }
}

const HARD_TAG = "siege_reach_hard";
const RISEN_TAG = "siege_reach_risen";
const PICKET_TAG = "siege_reach_picket";
const FULL_NIGHTS = ["counted", "stolen", "long", "muster"];

// ---------- the Storyteller: story facts the Reach owns, and the night shapes as a deck ----------
const saved = () => { try { return reachData(); } catch { return undefined; } };
provideFact("bossesFallen", () => Object.keys(saved()?.bosses ?? {}).length);
provideFact("choirFallen", () => !!saved()?.choir);
provideFact("morvaneFallen", () => !!saved()?.source);
try { provideFact("riftOpened", () => !!saved()?.rift || (saved()?.stage ?? 1) >= LONG); } catch { /* the Storyteller does not ask for this one yet */ }
// The deck carries no from/to: a shape opens with a Reach stage and a wave count, which chooseShape checks itself.
registerDeck("siege_shapes", Object.entries(SHAPES).map(([id, sh]) => ({ id, kind: sh.kind, stage: sh.from, min: sh.min })));

// Tonight's shape. The Storyteller picks among the shapes this stage and wave count allow, leaning on what the
// world has seen lately; the Reach's own rule (never last night's shape) has the last word.
function chooseShape(day, d, stageId, waves) {
  const unfit = Object.keys(SHAPES).filter((id) => SHAPES[id].from > stageId || SHAPES[id].min > waves);
  try {
    const id = storyPick("siege_shapes", "world", { exclude: unfit })?.id;
    if (id && SHAPES[id] && id !== d.lastShape) return id;
  } catch { /* the Storyteller isn't ready: fall back to the day's own roll */ }
  return pickShape(day, d.salt, stageId, waves, d.lastShape);
}
const storyNote = (player, kind) => { try { note(player, kind); } catch { /* not ready */ } };

const facts = () => ({ bosses: Object.keys(store.data.bosses).length, choir: store.data.choir, rift: store.data.rift, source: store.data.source });
const opts = () => ({ firstDay: SETTINGS.firstSiegeDay, every: SETTINGS.siegeEveryNNights, salt: store.data.salt, musterDay: store.data.musterDay });
const everyone = () => world.getPlayers();
const tell = (text) => { for (const p of everyone()) p.sendMessage(text); };
const sound = (player, id, options) => { try { sfx(player, id, options); } catch { /* cosmetic */ } };
const anyKeeps = () => Object.keys(getState().keeps).length > 0;

export function tonightKind(day = world.getDay()) {
  const d = store.data;
  if (d.forced?.day === day) return d.forced.kind;
  return nightKind(day, d.stage, opts());
}

// ---------- The Reach and its stages ----------

const STAGE_NEWS = {
  2: ["§8Something has changed about the third night. You could not say what."],
  3: ["§8You have lost count. That has never happened to you before."],
  4: ["§8There is no count any more."],
  5: ["§4The Long Night", "§7Dawn will not send them home"],
  6: ["§fThe knocking has stopped", "§7The first quiet night in three hundred years"],
};

function checkStage() {
  const d = store.data;
  const next = stageFor(d.reach, facts(), d.stage);
  if (next === d.stage) return;
  const before = d.stage;
  d.stage = next;
  if (next === LONG) d.pressure = 0;
  if (next === AFTER) scheduleMuster(world.getDay());
  const news = STAGE_NEWS[next];
  for (const p of everyone()) {
    if (news?.[1]) title(p, news[0], news[1]);
    else if (news) p.sendMessage(news[0]);
    sound(p, next === AFTER ? "random.levelup" : "ambient.cave", { volume: 1 });
  }
  emit("reachStage", { stage: next, before, name: stage(next).name });
}

export function addReach(amount, why) {
  const d = store.data;
  if (d.stage === AFTER) return;
  const before = d.reach;
  d.reach = capReach(d.reach + amount, facts());
  checkStage();
  store.save();
  if (d.reach !== before) emit("reachChanged", { reach: d.reach, before, why });
}

function bossFell(id) {
  const d = store.data;
  if (id === REACH.source) return rectify();
  if (id === REACH.choir && !d.choir) {
    d.choir = true; // met inside the Long Night: its fall makes them press harder
    if (d.stage === LONG) d.pressure = clamp(d.pressure + REACH.long.choirPressure, 0, REACH.long.maxPressure);
    return store.save();
  }
  if (REACH.bosses.includes(id) && !d.bosses[id]) {
    d.bosses[id] = true;
    addReach(REACH.gain.boss, `boss ${id}`);
  }
}

// The Rift is opened: the count is over and the Long Night begins (Mateo's call; it used to wait for the Choir)
export function riftOpened() {
  const d = store.data;
  if (d.rift || d.source) return;
  d.rift = true;
  d.reach = Math.max(d.reach, stage(LONG).from);
  addReach(0, "rift");
}
function syncRift() {
  try { if (riftSite.getRift?.()?.open) riftOpened(); } catch { /* the Hollow has nothing saved yet */ }
}

// After the story: the next night a rival town comes. Random, and never the same wait twice running.
function scheduleMuster(fromDay) {
  const d = store.data;
  d.musterGap = musterGap(fromDay, d.salt, d.musterGap);
  d.musterDay = fromDay + d.musterGap;
}
// Which rival lord sends tonight's army: the grasping and the proud more often, anyone who dislikes a
// besieged player more often still, and never the lord who came last time if there is another.
function musterLord() {
  let all = [];
  try { all = rivals.rivalLords?.() ?? []; } catch { /* no rival towns in this world */ }
  if (!all.length) return undefined;
  const d = store.data;
  const pool = all.length > 1 ? all.filter((l) => l.id !== d.musterLord) : all;
  const owners = Object.keys(getState().keeps);
  const weight = (l) => ({ grasping: 3, proud: 2, steady: 1, kindly: 0.5 }[l.temperament] ?? 1)
    * (1 + owners.reduce((worst, o) => Math.max(worst, -(l.relations?.[o] ?? 0)), 0) / 50);
  let roll = Math.random() * pool.reduce((sum, l) => sum + weight(l), 0);
  for (const l of pool) { roll -= weight(l); if (roll <= 0) return l; }
  return pool[pool.length - 1];
}

// The source is rectified: everything the Hollow sent stops where it stands
export function rectify() {
  const d = store.data;
  if (d.source) return;
  d.source = true;
  d.pressure = 0;
  checkStage();
  store.save();
  try {
    for (const e of overworld().getEntities({ tags: [PICKET_TAG] })) e.remove();
    if (getState().active) endSiege("won");
  } catch { /* nothing loaded */ }
  skyTick();
}

function syncBosses() {
  try {
    for (const id of Object.keys(bestiaryStore.data.defeated ?? {})) bossFell(id);
  } catch { /* the bestiary has nothing saved yet */ }
}
on("ready", () => {
  const d = reachData();
  syncBosses();
  syncRift();
  // worlds from before each settlement had its own first glimpse: the one the world saw counts for the keeps standing now
  if (!d.perKeepGlimpse) {
    if (d.glimpsed) for (const owner of Object.keys(getState().keeps)) keepNotes(owner).glimpsed = true;
    d.perKeepGlimpse = true;
    store.save();
  }
  if (d.stage === AFTER && d.musterDay < world.getDay()) scheduleMuster(world.getDay());
});
on("siege:boss_defeated", (data) => bossFell(data?.boss));
on("keepFallen", () => addReach(REACH.gain.keepFallen, "keep fallen"));

// ---------- Tonight's siege ----------

function beginNight(kind, stageId, offset = 0) {
  const d = store.data;
  const p = profile(kind, stageId, d.pressure);
  const now = world.getTimeOfDay();
  const onTime = p.clock && now <= openTime(kind, p.waves) + 400 && now >= REACH.nightTime;
  const lord = kind === "muster" ? musterLord() : undefined;
  if (lord) d.musterLord = lord.id;
  const shape = FULL_NIGHTS.includes(kind) ? chooseShape(world.getDay(), d, stageId, p.waves) : "old";
  d.night = { day: world.getDay(), kind, stage: stageId, waves: p.waves, mult: p.mult, clock: onTime, warlord: p.warlord, offset, shape,
    carried: false, sawDawn: false, nextTide: 0, kills: 0, glimpse: [], captains: {}, slain: {}, tolled: false,
    lord: lord ? { id: lord.id, name: lord.name, plot: lord.plot } : undefined };
  store.save();
  return d.night;
}

addFilter("siegeDue", (due, { day }) => {
  const kind = tonightKind(day);
  if (!kind) return false;
  const now = world.getTimeOfDay();
  const open = openTime(kind, profile(kind, store.data.stage, store.data.pressure).waves, day, store.data.salt);
  if (kind === "probe") return now >= open && now <= open + 1500; // a knock you slept through is a knock you missed
  return now >= open;
});

addFilter("assaultCount", (count, { provokedBy }) => {
  const d = store.data;
  if (provokedBy && d.remembered?.by === provokedBy) return beginNight("counted", d.remembered.stage).waves;
  d.remembered = null;
  return beginNight(provokedBy ? "horn" : tonightKind() ?? "horn", d.stage).waves;
});

// How much room is left on the field: 1 when it is empty, down to almost nothing at the cap
const liveCap = () => REACH.liveCap * Math.max(1, Object.keys(getState().plans).length);
const room = () => clamp(1 - raidersLeft().length / liveCap(), 0, 1);

const waveOf = (assault) => assault - (store.data.night?.offset ?? 0);

addFilter("assaultDelay", (delay, { assault }) => {
  const n = store.data.night;
  if (!n?.clock) return undefined;
  const wave = waveOf(assault);
  if (wave < 1 || wave > n.waves) return undefined;
  return Math.max(40, waveTime(wave, n.waves) - world.getTimeOfDay() - 20); // the siege loop looks every 2 seconds
});

addFilter("assaultShare", (share, { assault }) => {
  const n = store.data.night;
  return n ? waveShare(waveOf(assault), n.waves, n.shape) * room() : undefined;
});

addFilter("nextSiegeDay", (day) => {
  const d = store.data;
  if (d.stage <= 3) return undefined; // the count still holds; in the Miscount it is the one night anyone is sure of
  const from = world.getDay() + (getState().lastSiegeDay === world.getDay() ? 1 : 0);
  return nextSiege(from, d.stage, opts()) ?? day;
});

// Once the count can't be trusted (the Miscount, and after the story) the watch gives a feeling, never a date
const hinting = () => store.data.stage === 3 || store.data.stage === AFTER;
function nightsUntilSiege(day = world.getDay()) {
  if (isSiegeKind(tonightKind(day)) && getState().lastSiegeDay !== day) return 0;
  const next = nextSiege(day + 1, store.data.stage, opts());
  return next === undefined ? undefined : next - day;
}
// The Keep Banner's own "Next siege" line (siege/menus.js) says the same as the night watch
addFilter("nextSiegeLine", (line) => (hinting() ? watchHint(nightsUntilSiege(), world.getDay()) : line));

addSiegeSkipHook((owner) => !!store.data.remembered && store.data.remembered.by !== owner); // a Remembered Night is only for whoever rang it

addPlanHook((plan, owner) => {
  const n = store.data.night;
  if (!n) return;
  const s = stage(n.stage);
  const notes = keepNotes(owner);
  const free = !plan.grand && !plan.decreed && !plan.npcStorm; // nobody else has already decided who is coming
  plan.budget = Math.max(4, Math.round(plan.budget * n.mult));
  // never the same army two sieges running
  if (free && FACTIONS[plan.faction]?.name === notes.faction) {
    const others = Object.keys(FACTIONS).filter((f) => f !== "grand" && FACTIONS[f].name !== notes.faction);
    if (others.length) plan.faction = pick(others);
  }
  if (!n.warlord && !plan.grand) plan.warlord = undefined;
  if (s.captain && FULL_NIGHTS.includes(n.kind) && !plan.warlord) plan.warlord = `${pick(CAPTAIN_NAMES)} ${pick(CAPTAIN_TITLES)}`;
  // a captain who got away last time comes back to finish it
  if (free && n.warlord && FULL_NIGHTS.includes(n.kind) && notes.nemesis) {
    plan.warlord = notes.nemesis.name;
    plan.returning = notes.nemesis.escapes;
    plan.budget = Math.round(plan.budget * (1 + NEMESIS.perEscape * Math.min(notes.nemesis.escapes, NEMESIS.maxEscapes)));
  }
  if (n.kind !== "probe") {
    const hollowOk = n.stage >= HOLLOW_TWISTS_FROM && n.stage !== AFTER;
    const added = [];
    for (let i = 0; i < s.twists; i++) {
      const open = Object.keys(MODIFIERS).filter((m) => !plan.modifiers.includes(m) && (hollowOk || !NEW_MODIFIERS[m]));
      const fresh = open.filter((m) => !(notes.twists ?? []).includes(m)); // and not the twists from last time, if there is a choice
      const pool = fresh.length ? fresh : open;
      if (pool.length) { added.push(pick(pool)); plan.modifiers.push(added[added.length - 1]); }
    }
    notes.twists = added;
  }
  if (n.lord && !plan.grand) plan.warlord = n.lord.name; // a rival town's army is led by its lord, by name
  if (FULL_NIGHTS.includes(n.kind)) notes.faction = FACTIONS[plan.faction]?.name;
  if (plan.warlord && !plan.grand) n.captains[owner] = plan.warlord;
  plan.reach = { kind: n.kind, stage: n.stage };
  plan.baseSides = [...plan.sides];
  plan.baseModifiers = [...plan.modifiers];
});

const NIGHT_NEWS = {
  counted: (n) => `§8The third night. ${n.waves} waves, one an hour${n.clock ? ", the last at 3:17" : ""}.`,
  stolen: (n) => `§8This is not the third night, and they have come anyway. ${n.waves} waves.`,
  probe: () => "§8Something is trying the walls. It is not a siege night.",
  long: (n) => `§8${n.waves} waves before 3:17. Dawn will not help. Break them, or they stay.`,
  muster: (n) => (n.lord ? `§7The banners of ${n.lord.name}, out of ${n.lord.plot}. ${n.waves} waves.` : `§7Somebody's army, come for what you have. ${n.waves} waves.`),
  horn: () => "§8You called, and they heard.",
};

on("siegeStart", () => {
  const d = store.data;
  const n = d.night;
  if (!n) return;
  if (n.kind === "long") d.pressure = clamp(d.pressure + 1, 0, REACH.long.maxPressure);
  store.save();
  tell(NIGHT_NEWS[n.kind]?.(n) ?? "");
  if (n.lord) emit("lordRaid", { lord: n.lord.id, name: n.lord.name, plot: n.lord.plot, owners: [...getState().besieged] });
  for (const p of everyone()) {
    const plan = getState().plans[p.id];
    if (plan?.returning) p.sendMessage(`§8${plan.warlord} has come back. ${plan.returning > 1 ? "Again." : "You let that one walk away."}`);
  }
});

on("warlordSlain", ({ owner, king }) => {
  const n = store.data.night;
  if (!n || king || !n.captains[owner]) return;
  n.slain[owner] = true;
  const notes = keepNotes(owner);
  const returning = notes.nemesis?.name === n.captains[owner];
  notes.roll = [...(notes.roll ?? []), { name: n.captains[owner], day: world.getDay() }].slice(-20);
  if (returning) notes.nemesis = undefined;
  store.save();
  for (const p of everyone()) {
    if (settlementAt(p.location) !== owner && p.id !== owner) continue;
    honour(p, "captain_slain");
    if (returning) honour(p, "nemesis_slain");
  }
});

// Each wave has a job. Set the war plans up for it just before it spawns.
on("assaultIncoming", ({ assault }) => {
  const n = store.data.night;
  if (!n) return;
  const role = n.kind === "probe" ? "knock" : waveRole(waveOf(assault), n.waves, n.shape);
  n.role = role;
  if (role === "toll") n.tolled = true;
  const st = getState();
  for (const plan of Object.values(st.plans)) {
    if (!plan.baseSides) continue;
    plan.sides = [...plan.baseSides];
    plan.modifiers = [...plan.baseModifiers];
    const turn = (Math.random() < 0.5 ? 1 : -1) * (Math.PI / 2);
    if (role === "flank") plan.sides = plan.baseSides.map((a) => a + turn);
    if (role === "feint") plan.sides = plan.baseSides.map((a) => a + Math.PI); // the wall they do not mean to take
    if (role === "ring") plan.sides = [0, 1, 2, 3].map((q) => q * (Math.PI / 2));
    if (role === "breach") for (const m of ["sappers", "siegeTrain"]) if (!plan.modifiers.includes(m)) plan.modifiers.push(m);
    if (role === "dark" || (role === "toll" && n.stage >= 4)) plan.sides = [0, 1, 2, 3].map((q) => q * (Math.PI / 2));
    if (role === "tide") {
      plan.sides = [Math.floor(Math.random() * 4) * (Math.PI / 2)];
      plan.warlord = undefined; // the captain came at 3:17; tides have no leader
    }
  }
  // every settlement gets its own first glimpse: the keeps besieged tonight that have not had theirs
  n.glimpse = role === "toll" && n.stage >= 2 && n.stage !== AFTER && FULL_NIGHTS.includes(n.kind) ? st.besieged.filter((o) => !hasGlimpsed(o)) : [];
  if (role !== "tide" && n.kind === "long") storm();
  const line = n.clock || role === "tide" ? WAVES[role].line : waveOf(assault) >= n.waves ? "§7The last of them." : "§7They come again.";
  system.runTimeout(() => {
    for (const p of everyone()) {
      if (role === "toll" && n.clock) {
        title(p, "§43:17", n.glimpse.includes(settlementAt(p.location) ?? p.id) ? "§7 " : n.kind === "muster" ? "§7The last of them" : "§7Everything that was waiting, comes");
        sound(p, "sig.toll_317");
      } else {
        p.onScreenDisplay.setActionBar(line);
        if (role === "tide") sound(p, "sig.storm_tide");
      }
      if (role === "dark" && settlementAt(p.location)) {
        try { p.addEffect("darkness", 120, { showParticles: false }); } catch { /* cosmetic */ }
      }
    }
  }, 30);
});

const sideSpot = (owner, keep, angle, extra = 0) => {
  const c = keepCenter(keep);
  const d = applyFilter("spawnDistance", SETTINGS.spawnDistance, { owner, keep }) + extra + Math.random() * 4;
  const a = angle + (Math.random() - 0.5) * 0.4;
  return [Math.floor(c.x + Math.cos(a) * d), Math.floor(c.z + Math.sin(a) * d), c.y];
};

// Hollow soldiers the Reach adds on top of the ordinary army. The "hollowSoldier" filter can change the type.
const soldierType = (role, glimpse) =>
  applyFilter("hollowSoldier", glimpse || Math.random() < 0.7 ? "siege:veinsworn" : "siege:shardcaster", { role, glimpse });

// Who the ordinary army is made of follows the stage (the bestiary swaps the raiders; we tell it the mix)
troops.setTroopPlan?.(({ owner } = {}) => troopMix(store.data.stage, owner ? hasGlimpsed(owner) : store.data.glimpsed));
// The bestiary's Watcher (one Hollow soldier at the back who only watches) belongs to the nights just before the
// first glimpse. It follows this once the bestiary has a setWatcherPlan(); until then it keeps its own timing.
export const watcherDueNow = (owner) => {
  const d = store.data;
  const seen = owner ? hasGlimpsed(owner) : Object.keys(getState().keeps).every((o) => hasGlimpsed(o));
  return !seen && d.stage !== AFTER && d.reach >= WATCHER_FROM_REACH;
};
const ownerOfKeep = (keep) => Object.keys(getState().keeps).find((o) => getState().keeps[o] === keep);
troops.setWatcherPlan?.(({ keep } = {}) => watcherDueNow(keep && ownerOfKeep(keep)));

function sendSoldiers(count, role, glimpse, owners) {
  const st = getState();
  let sent = 0;
  if (!glimpse && raidersLeft().length >= liveCap()) return sent;
  for (const owner of owners ?? st.besieged) {
    const keep = keepOf(owner), plan = st.plans[owner];
    if (!keep || !plan) continue;
    for (let i = 0; i < count; i++) {
      const [x, z, y] = sideSpot(owner, keep, plan.sides[i % plan.sides.length], glimpse ? 6 : 0);
      if (spawnRaider(overworld(), soldierType(role, glimpse), x, z, y, [ownerTag(owner), HARD_TAG])) sent++;
    }
  }
  return sent;
}

// A settlement's first time: its army of men stops and looks back, and something else walks up through it
function firstGlimpse(owners) {
  const d = store.data;
  d.glimpsed = true; // somebody in the world has seen them
  for (const owner of owners) keepNotes(owner).glimpsed = true;
  store.save();
  const there = (p) => owners.includes(settlementAt(p.location)) || owners.includes(p.id);
  for (const p of everyone()) if (owners.includes(settlementAt(p.location))) honour(p, "glimpse");
  for (const raider of raidersLeft()) {
    try {
      if (owners.some((o) => raider.hasTag(ownerTag(o)))) raider.addEffect("slowness", 200, { amplifier: 6, showParticles: false });
    } catch { /* gone */ }
  }
  for (const p of everyone()) {
    if (!there(p)) continue;
    p.sendMessage("§8The army has stopped. All of them. They are looking back the way they came.");
    if (settlementAt(p.location)) {
      try { p.addEffect("darkness", 100, { showParticles: false }); } catch { /* cosmetic */ }
    }
  }
  system.runTimeout(() => {
    if (!getState().active) return;
    sendSoldiers(3, "toll", true, owners);
    for (const p of everyone()) {
      if (!there(p)) continue;
      p.sendMessage("§8Something is walking up between them. It is not one of them.");
      sound(p, "sig.first_glimpse");
    }
    emit("firstGlimpse", { owners: [...owners] });
  }, 120);
}

function harden(level) {
  if (!level) return;
  for (const raider of raidersLeft()) {
    try {
      if (raider.hasTag(HARD_TAG)) continue;
      raider.addTag(HARD_TAG);
      raider.addEffect("health_boost", 20 * 900, { amplifier: level - 1, showParticles: false });
      raider.addEffect("instant_health", 1, { amplifier: 3, showParticles: false });
      if (level >= 2) raider.addEffect("resistance", 20 * 900, { amplifier: 0, showParticles: false });
      if (level >= 3) raider.addEffect("strength", 20 * 900, { amplifier: 0, showParticles: false });
    } catch { /* gone */ }
  }
}

on("assaultSpawned", () => {
  const n = store.data.night;
  if (!n) return;
  harden(stage(n.stage).harden);
  if (n.kind === "probe" || n.kind === "horn") return;
  const first = n.glimpse ?? [];
  if (first.length) firstGlimpse(first);
  // the keeps that have already had their night get the Hollow's soldiers as the stage sends them
  const known = getState().besieged.filter((o) => hasGlimpsed(o) && !first.includes(o));
  if (known.length) sendSoldiers(hollowCount(n.stage, n.role), n.role, false, known);
});

on("raiderKilled", ({ entity, owner }) => {
  const n = store.data.night;
  if (!n) return;
  n.kills += 1;
  try {
    const plan = getState().plans[owner];
    if (!plan?.modifiers.includes("risen") || entity.hasTag(RISEN_TAG) || Math.random() >= REACH.risenChance) return;
    const at = entity.location;
    system.runTimeout(() => {
      if (getState().active) spawnRaider(overworld(), "minecraft:husk", Math.floor(at.x), Math.floor(at.z), at.y, [ownerTag(owner), RISEN_TAG]);
    }, 60);
  } catch { /* the body was already gone */ }
});

on("siegeEnd", ({ outcome, besieged }) => {
  const d = store.data;
  const n = d.night;
  const rang = !!d.remembered;
  d.night = null;
  d.remembered = null;
  if (!n) return store.save();
  const full = FULL_NIGHTS.includes(n.kind);
  const won = outcome === "won";
  if (n.kind === "long" && won) d.pressure = clamp(d.pressure - 2, 0, REACH.long.maxPressure); // +1 at dusk, so a broken night is a net -1
  if (full) d.lastShape = n.shape;
  if (full) for (const owner of besieged ?? []) keepNotes(owner).seen = (keepNotes(owner).seen ?? 0) + 1;
  if (n.kind === "muster") scheduleMuster(n.day);
  d.quietNoted = false;
  d.last = { day: n.day, kind: n.kind, outcome, kills: n.kills, waves: getState().assaultsTotal ?? n.waves, shape: full ? n.shape : undefined };
  // a captain who reached the wall and was not killed remembers the way
  for (const owner of besieged) {
    const name = n.captains[owner];
    if (!name || !n.tolled || n.slain[owner]) continue;
    const notes = keepNotes(owner);
    const escapes = (notes.nemesis?.name === name ? notes.nemesis.escapes : 0) + 1;
    notes.nemesis = escapes > NEMESIS.maxEscapes ? undefined : { name, escapes }; // after that they stop coming, and you never learn why
  }
  store.save();
  for (const p of everyone()) {
    if (!besieged.includes(p.id)) continue;
    p.sendMessage(`§8The count: ${d.last.waves} wave${d.last.waves === 1 ? "" : "s"}, ${n.kills} fallen at the walls${won ? "" : ". They were not beaten"}.`);
    if (full) p.sendMessage(`§8${SHAPES[n.shape].about}`);
    if (keepNotes(p.id).nemesis && n.captains[p.id] && !n.slain[p.id] && n.tolled) p.sendMessage(`§8${n.captains[p.id]} walked away from your wall. That one will be back.`);
    if (n.kind === "long" && won) p.sendMessage("§7You broke them. It is quiet until dusk.");
    if (!won) continue;
    if (n.kind === "counted") honour(p, "first_held");
    if (n.kind === "stolen") honour(p, "stolen_held");
    if (n.kind === "probe") honour(p, "knock_answered");
    if (n.kind === "long") honour(p, n.sawDawn ? "long_carried" : "long_broken");
    if (rang) honour(p, "remembered");
    if (full) honour(p, `shape_${n.shape}`);
  }
  if (full && outcome === "won") addReach(REACH.gain.nightHeld, "night held");
});

// ---------- The Long Night: dawn does not end it ----------

addFilter("dawnEndsSiege", () => {
  const d = store.data;
  const n = d.night;
  if (d.stage !== LONG || n?.kind !== "long") return undefined;
  if (!n.carried) {
    n.carried = true;
    n.sawDawn = true;
    n.nextTide = system.currentTick + tideLull(d.pressure);
    d.pressure = clamp(d.pressure + 1, 0, REACH.long.maxPressure);
    store.save();
    for (const p of everyone()) {
      title(p, "§7Dawn", "§8They do not leave");
      sound(p, "ambient.cave", { volume: 1 });
    }
  }
  return false;
});

function longTick() {
  const d = store.data;
  const n = d.night;
  const st = getState();
  if (!st.active || n?.kind !== "long") return;
  const now = world.getTimeOfDay();
  if (!isNight()) {
    // by day: stragglers nobody is near give up, and a fresh tide comes whenever the last one is spent
    for (const raider of raidersLeft()) {
      try {
        if (raider.dimension.getPlayers({ location: raider.location, maxDistance: REACH.long.strayRange }).length === 0) raider.remove();
      } catch { /* unloaded */ }
    }
    if (n.carried && st.assaultsLeft === 0 && system.currentTick >= n.nextTide && raidersLeft().length > 0) {
      st.assaultsTotal = (st.assaultsTotal ?? n.waves) + 1;
      st.assaultsLeft = 1;
      st.nextAssaultTick = system.currentTick;
      n.nextTide = system.currentTick + tideLull(d.pressure);
      storm();
      saveState();
      store.save();
    }
    return;
  }
  // dusk came round and they are still here: tonight's waves join the ones already at the wall
  const today = world.getDay();
  if (n.day !== today && now >= openTime("long", stage(LONG).waves)) {
    const oldMult = n.mult;
    d.pressure = clamp(d.pressure + 1, 0, REACH.long.maxPressure);
    const p = profile("long", LONG, d.pressure);
    Object.assign(n, { day: today, offset: st.assaultsTotal ?? n.waves, waves: p.waves, mult: p.mult, clock: true, carried: false });
    for (const plan of Object.values(st.plans)) {
      plan.budget = Math.round((plan.budget / oldMult) * p.mult);
      if (!plan.grand) plan.warlord = `${pick(CAPTAIN_NAMES)} ${pick(CAPTAIN_TITLES)}`; // a new captain for the new night
    }
    st.assaultsTotal = n.offset + p.waves;
    st.assaultsLeft += p.waves;
    st.nextAssaultTick = system.currentTick + Math.max(40, waveTime(1, p.waves) - now);
    st.lastSiegeDay = today;
    saveState();
    store.save();
    tell("§8Dusk again. They never left.");
  }
}

// The Long Night's weather: a thunderstorm rolls in with each wave and tide and eases between them,
// so the sky says when to brace.
let stormUntil = 0;
function storm() {
  const d = store.data;
  stormUntil = system.currentTick + REACH.long.stormHold;
  try { overworld().setWeather(WeatherType.Thunder, REACH.long.stormHold + 400); } catch { /* weather is cosmetic */ }
  if (!d.sky) { d.sky = true; store.save(); }
}
function skyTick() {
  const d = store.data;
  if (!d.sky) return;
  if (d.stage === LONG && getState().active && system.currentTick < stormUntil) return;
  try { overworld().setWeather(WeatherType.Clear); } catch { /* weather is cosmetic */ }
  d.sky = false;
  store.save();
}

// In the Long Night the roads are not safe either
function picketTick() {
  const d = store.data;
  if (d.stage !== LONG) return;
  for (const p of everyone()) {
    try {
      const dim = p.dimension;
      if (dim.id !== "minecraft:overworld" || settlementAt(p.location) || Math.random() >= REACH.long.picketChance) continue;
      for (const e of dim.getEntities({ tags: [PICKET_TAG] })) {
        if (dim.getPlayers({ location: e.location, maxDistance: 64 }).length === 0) e.remove();
      }
      if (dim.getEntities({ tags: [PICKET_TAG], location: p.location, maxDistance: 64 }).length >= REACH.long.picketCap) continue;
      const a = Math.random() * Math.PI * 2;
      for (let i = 0; i < 3; i++) {
        const x = Math.floor(p.location.x + Math.cos(a) * 22) + i, z = Math.floor(p.location.z + Math.sin(a) * 22);
        const ground = dim.getTopmostBlock({ x, z });
        if (!ground || ground.isLiquid || settlementAt(ground.location)) continue;
        dim.spawnEntity(soldierType("picket", false), { x: x + 0.5, y: ground.location.y + 1, z: z + 0.5 }).addTag(PICKET_TAG);
      }
    } catch { /* that spot wasn't loaded */ }
  }
}

// ---------- Omens, the dawn drift, beds ----------

function reachTick() {
  const d = reachData();
  const st = getState();
  const day = world.getDay();
  if (d.lastDawn !== day) {
    const passed = d.lastDawn < 0 ? 0 : clamp(day - d.lastDawn, 0, 3);
    d.lastDawn = day;
    if (d.forced && d.forced.day < day) d.forced = null;
    if (d.stage === AFTER && d.musterDay < day) scheduleMuster(day - 1); // nobody was home, or it was beaten: roll the next one
    // The first night after a siege on which nothing came is a quiet beat, said once so the quiet nights don't drown the rest
    if (!d.quietNoted && passed > 0 && !st.active && st.lastSiegeDay < day - 1) {
      d.quietNoted = true;
      for (const p of everyone()) if (keepOf(p.id)) storyNote(p, "quiet");
    }
    store.save();
    if (passed > 0 && day >= SETTINGS.firstSiegeDay) addReach(REACH.gain.dawn * passed, "dawn");
  }
  longTick();
  if (st.active || !anyKeeps() || st.lastSiegeDay === day) return;
  const kind = tonightKind(day);
  if (!isSiegeKind(kind)) return;
  const now = world.getTimeOfDay();
  const open = openTime(kind, profile(kind, d.stage, d.pressure).waves, day, d.salt);
  if (now < REACH.duskTime || now >= open) return;
  // Long at first, shorter later: once every settlement has seen a few sieges the evening hurries to the horn.
  // The greenest settlement sets the pace, so nobody's first sieges are cut short.
  const speed = duskSpeed(Math.min(...Object.keys(st.keeps).map((o) => keepNotes(o).seen ?? 0)), open);
  if (speed > 1 && open - now > 60) {
    try { world.setTimeOfDay(Math.min(open - 40, Math.floor(now + (speed - 1) * REACH_TICK))); } catch { /* the clock is not ours tonight */ }
  }
  const hour = Math.floor((now - REACH.duskTime) / REACH.hour);
  const key = `${day}:${hour}`;
  if (d.omen === key) return;
  d.omen = key;
  store.save();
  for (const p of everyone()) {
    if (p.dimension.id !== "minecraft:overworld") continue;
    // the omen happens around anyone standing in a settlement; its line is the backup, and all anyone elsewhere gets
    const home = keepOf(settlementAt(p.location));
    const here = home ? keepCenter(home) : undefined;
    if (hour === 0) {
      p.sendMessage(duskLine(kind, d.stage, day));
      if (kind !== "muster") performOmen(DUSK_ACT, p, here, omenSide(day, d.salt));
    } else if (kind !== "muster") {
      const omen = hourOmen(day, d.salt, hour);
      p.onScreenDisplay.setActionBar(omen.line);
      if (!performOmen(omen.id, p, here, omenSide(day, d.salt))) sound(p, "ambient.cave", { volume: 0.4 });
    }
  }
}

const REACH_TICK = 40;

function pullTick() {
  const st = getState();
  if (!st.active || raidersLeft().length === 0) return;
  for (const p of everyone()) {
    try {
      const owner = settlementAt(p.location);
      const plan = owner && st.plans[owner];
      if (!plan?.modifiers.includes("pull")) continue;
      const a = plan.sides[0];
      p.applyKnockback({ x: Math.cos(a) * 0.9, z: Math.sin(a) * 0.9 }, 0.15);
      p.onScreenDisplay.setActionBar("§8Something leans on you.");
    } catch { /* cosmetic */ }
  }
}

onTick("reach", REACH_TICK, reachTick);
onTick("reach pull", REACH.pullEvery, pullTick);
onTick("reach sky", 200, skyTick);
onTick("reach pickets", REACH.long.picketEvery, picketTick);

// Nobody sleeps through a siege night, even before the horn
world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  if (!isReady() || event.block.typeId !== "minecraft:bed") return;
  const st = getState();
  if (st.active || !isNight() || !anyKeeps() || st.lastSiegeDay === world.getDay() || !isSiegeKind(tonightKind())) return;
  event.cancel = true;
  const player = event.player;
  system.run(() => player.onScreenDisplay.setActionBar("§8You lie down. You do not sleep. Not tonight."));
});

// ---------- The Keep Banner: the night watch, and Remembered Nights ----------

const KIND_WORDS = {
  counted: "Tonight is the third night. They will come.",
  stolen: "Tonight is not the third night. They will come anyway.",
  long: "They will come tonight. They come every night.",
  muster: "The watch has seen smoke on the road. Expect an army tonight.",
};

function watchMenu(player, mine) {
  const d = store.data;
  const s = stage(d.stage);
  const day = world.getDay();
  const kind = tonightKind(day);
  const next = nextSiege(day + 1, d.stage, opts());
  const coming = nightsUntilSiege(day);
  const notes = keepOf(player.id) ? keepNotes(player.id) : undefined;
  const earned = (d.honours[player.id] ?? []).filter((k) => HONOURS[k]);
  const lines = [
    `§l${s.name}§r`,
    s.about,
    "",
    d.stage === AFTER ? `Sieges: ${s.rhythm.toLowerCase()}. ${s.waves} waves, at whatever hour suits them.`
      : `Sieges: ${s.rhythm.toLowerCase()}. ${s.waves} waves on a full night, one an hour, the last at ${clock(REACH.tollTime)}.`,
    getState().active ? "§cA siege is under way." : hinting() ? watchHint(coming, day) : KIND_WORDS[kind] ?? (next === undefined ? "The watch expects a quiet night." : `The watch expects a quiet night. The next siege they are sure of is in ${next - day} day${next - day === 1 ? "" : "s"}.`),
    d.stage === 2 ? "§7Not every night that is quiet at dusk stays quiet." : "",
    d.stage === LONG ? `§7Their strength: ${Math.round(pressureMult(d.pressure) * 100)}% of an ordinary army. Break a night to wear them down.` : "",
    d.last ? `Last time (day ${d.last.day}): ${d.last.shape ? SHAPES[d.last.shape].name + ", " : ""}${d.last.waves} waves, ${d.last.kills} fallen, ${d.last.outcome === "won" ? "§aheld§r" : "§cnot beaten§r"}.` : "",
    notes?.nemesis ? `§c${notes.nemesis.name} walked away from this wall${notes.nemesis.escapes > 1 ? ` ${notes.nemesis.escapes} times` : ""} and will be back.§r` : "",
    notes?.roll?.length ? `Captains brought down here: ${notes.roll.map((c) => c.name).slice(-6).join(", ")}${notes.roll.length > 6 ? ` and ${notes.roll.length - 6} more` : ""}.` : "",
    "",
    `Your night honours (${earned.length} of ${Object.keys(HONOURS).length}): ${earned.length ? earned.map((k) => HONOURS[k]).join(", ") : "none yet"}.`,
  ].filter((l, i, all) => l || (i > 0 && all[i - 1]));
  const form = new ActionFormData().title("The night watch").body(lines.join("\n"));
  const actions = [];
  if (mine && d.stage === AFTER) {
    for (const old of STAGES.slice(0, 5)) {
      form.button(`Ring a Remembered Night\n§8${old.name}`);
      actions.push(() => rememberedNight(player, old.id));
    }
  }
  form.button("Close");
  form.show(player).then((r) => { if (!r.canceled) actions[r.selection]?.(); }).catch(() => {});
}

// After the story: fight one of the old nights again, on your own keep only, whenever you like
function rememberedNight(player, stageId) {
  const st = getState();
  if (!keepOf(player.id)) return player.sendMessage("§7You need a settlement first.");
  if (st.active) return player.sendMessage("§7Not while a siege is under way.");
  if (!isNight()) return player.sendMessage("§7Ring it after dark.");
  store.data.remembered = { by: player.id, stage: stageId };
  store.save();
  tell(`§8${player.name} rings a bell on purpose. Something remembers the way to ${keepOf(player.id).name}.`);
  startSiege(player.id);
}

addKeepMenuButtons(({ player, mine }) => [{ label: "The night watch", icon: "textures/items/clock_item", action: () => watchMenu(player, mine) }]);

on("showcase", ({ player }) => {
  player.sendMessage("§6Sieges and the Reach:§7 /scriptevent siege:reach_stage <1-6>, then /scriptevent siege:reach_night to jump to a siege night. /scriptevent siege:reach shows where things stand.");
});

// ---------- Test commands and messages from other features ----------

function status(player) {
  const d = store.data;
  const s = stage(d.stage);
  const kind = tonightKind();
  const f = facts();
  player.sendMessage([
    `§6The Reach: ${d.reach}/100, stage ${d.stage} (${s.name}). Bosses fallen ${f.bosses}/6, Rift ${f.rift ? "open" : "shut"}, Choir ${f.choir ? "fallen" : "standing"}, source ${f.source ? "rectified" : "not rectified"}.`,
    `§7Tonight (day ${world.getDay()}): ${kind ?? "quiet"}${kind ? `, horn at ${clock(openTime(kind, profile(kind, d.stage, d.pressure).waves, world.getDay(), d.salt))}` : ""}. Now ${clock(world.getTimeOfDay())}.`,
    `§7Long Night pressure ${d.pressure}. First glimpse had by ${Object.keys(getState().keeps).filter((o) => hasGlimpsed(o)).length} of ${Object.keys(getState().keeps).length} settlements.${d.stage === AFTER ? ` Next rival raid: day ${d.musterDay}.` : ""} ${d.night ? `Siege running: ${d.night.kind}, ${d.night.waves} waves.` : ""}`,
  ].join("\n"));
}

system.afterEvents.scriptEventReceive.subscribe((event) => {
  const id = event.id;
  if (!id.startsWith("siege:")) return;
  let data;
  try { data = JSON.parse(event.message); } catch { data = undefined; }
  if (id === "siege:boss_defeated") return bossFell(data?.boss);
  if (id === "siege:undertow_rift_opened") return riftOpened();
  if (id === "siege:seep_opened") return addReach(REACH.gain.seepOpened, "seep opened");
  if (id === "siege:seep_closed") return addReach(REACH.gain.seepClosed, "seep closed");
  if (!id.startsWith("siege:reach")) return;
  const d = store.data;
  const player = event.sourceEntity;
  const word = event.message.trim();
  const say = (text) => player?.sendMessage?.(text);
  switch (id) {
    case "siege:reach_set":
      d.reach = capReach(Number(word) || 0, facts());
      checkStage();
      break;
    case "siege:reach_stage": {
      const want = clamp(Math.round(Number(word)) || 1, 1, 6);
      d.source = want === AFTER;
      d.rift = want >= LONG;
      d.stage = want;
      if (want === AFTER) scheduleMuster(world.getDay());
      d.reach = want === AFTER ? d.reach : Math.max(stage(want).from, want === 1 ? 0 : d.reach);
      if (want === 1) d.reach = 0;
      if (want !== LONG) d.pressure = 0;
      skyTick();
      break;
    }
    case "siege:reach_night": {
      const kind = ["counted", "stolen", "probe", "long", "muster"].includes(word) ? word : tonightKind() ?? (d.stage === LONG ? "long" : d.stage === AFTER ? "muster" : "counted");
      d.forced = { day: world.getDay(), kind };
      getState().lastSiegeDay = -1;
      const open = openTime(kind, profile(kind, d.stage, d.pressure).waves, world.getDay(), d.salt);
      world.setTimeOfDay(Math.max(REACH.nightTime, open - 100));
      say(`§7Tonight is now a "${kind}" night. The horn sounds at ${clock(open)}.`);
      break;
    }
    case "siege:reach_toll":
      world.setTimeOfDay(REACH.tollTime - 60);
      break;
    case "siege:reach_boss":
      bossFell(word);
      break;
    case "siege:reach_glimpse":
      d.glimpsed = false;
      for (const notes of Object.values(d.keeps)) notes.glimpsed = false;
      break;
    case "siege:reach_omen": {
      // play one omen around you now (stand in a settlement): /scriptevent siege:reach_omen torches_lean, or no name for a random one
      const ids = Object.keys(ACTS);
      const id = ids.includes(word) ? word : ids[Math.floor(Math.random() * ids.length)];
      const home = player && keepOf(settlementAt(player.location));
      if (!home) { say("§7Stand inside a settlement first."); return; }
      performOmen(id, player, keepCenter(home), omenSide(world.getDay(), d.salt));
      say(`§7Omen: ${id}. All of them: ${ids.join(", ")}`);
      return;
    }
    case "siege:reach_rift":
      riftOpened();
      break;
    case "siege:reach_reset":
      Object.assign(d, { reach: 0, stage: 1, bosses: {}, choir: false, rift: false, source: false, pressure: 0, glimpsed: false, musterDay: -1, musterGap: 0, musterLord: null, night: null, forced: null, remembered: null, last: null, lastShape: null, keeps: {} });
      skyTick();
      break;
    default:
      break;
  }
  store.save();
  if (player) status(player);
});
