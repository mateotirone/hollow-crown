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
  MODIFIERS, SETTINGS, title, overworld, ownerTag, pick, on, emit, addFilter,
  addPlanHook, addSiegeSkipHook, addKeepMenuButtons, onTick, moduleStore,
} from "../siege/api.js";
import { bestiaryStore } from "../bestiary/bossCore.js";
import * as troops from "../bestiary/spawns.js";
import {
  REACH, STAGES, LONG, AFTER, stage, stageFor, capReach, nightKind, isSiegeKind, profile, openTime, waveTime, waveRole, waveShare,
  hollowCount, tideLull, pressureMult, clock, nextSiege, duskLine, dayRoll, clamp, troopMix, WATCHER_FROM_REACH,
  WAVES, NEW_MODIFIERS, HOLLOW_TWISTS_FROM, HOUR_LINES, CAPTAIN_NAMES, CAPTAIN_TITLES,
} from "./rules.js";
import "./tests.js";

Object.assign(MODIFIERS, NEW_MODIFIERS); // so the war plan can name them

const store = moduleStore("siege:reach", () => ({
  reach: 0, stage: 1, salt: Math.floor(Math.random() * 1e6),
  bosses: {}, choir: false, source: false,
  pressure: 0, // the Long Night: up at every dusk and every dawn they stay, down when a night is broken
  glimpsed: false, // the first Hollow soldiers have been seen
  night: null, // tonight's siege, while it runs
  forced: null, // test command: { day, kind }
  remembered: null, // after the story: { by, stage } while a Remembered Night runs
  omen: "", lastDawn: -1, sky: false, last: null,
}));
export const reachData = () => store.data;

const HARD_TAG = "siege_reach_hard";
const RISEN_TAG = "siege_reach_risen";
const PICKET_TAG = "siege_reach_picket";
const FULL_NIGHTS = ["counted", "stolen", "long", "muster"];

const facts = () => ({ bosses: Object.keys(store.data.bosses).length, choir: store.data.choir, source: store.data.source });
const opts = () => ({ firstDay: SETTINGS.firstSiegeDay, every: SETTINGS.siegeEveryNNights, salt: store.data.salt });
const everyone = () => world.getPlayers();
const tell = (text) => { for (const p of everyone()) p.sendMessage(text); };
const sound = (player, id, options) => { try { player.playSound(id, options); } catch { /* cosmetic */ } };
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
    d.choir = true;
    d.reach = Math.max(d.reach, stage(LONG).from); // the Choir was the last thing holding the count
    return addReach(0, "choir");
  }
  if (REACH.bosses.includes(id) && !d.bosses[id]) {
    d.bosses[id] = true;
    addReach(REACH.gain.boss, `boss ${id}`);
  }
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
on("ready", syncBosses);
on("siege:boss_defeated", (data) => bossFell(data?.boss));
on("keepFallen", () => addReach(REACH.gain.keepFallen, "keep fallen"));

// ---------- Tonight's siege ----------

function beginNight(kind, stageId, offset = 0) {
  const d = store.data;
  const p = profile(kind, stageId, d.pressure);
  const now = world.getTimeOfDay();
  const onTime = p.clock && now <= openTime(kind, p.waves) + 400 && now >= REACH.nightTime;
  d.night = { day: world.getDay(), kind, stage: stageId, waves: p.waves, mult: p.mult, clock: onTime, warlord: p.warlord, offset, carried: false, nextTide: 0, kills: 0, glimpse: false };
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
  return n ? waveShare(waveOf(assault), n.waves) * room() : undefined;
});

addFilter("nextSiegeDay", (day) => {
  const d = store.data;
  if (d.stage <= 2) return undefined; // the count still holds
  const from = world.getDay() + (getState().lastSiegeDay === world.getDay() ? 1 : 0);
  return nextSiege(from, d.stage, opts()) ?? day;
});

addSiegeSkipHook((owner) => !!store.data.remembered && store.data.remembered.by !== owner); // a Remembered Night is only for whoever rang it

addPlanHook((plan) => {
  const n = store.data.night;
  if (!n) return;
  const s = stage(n.stage);
  plan.budget = Math.max(4, Math.round(plan.budget * n.mult));
  if (!n.warlord && !plan.grand) plan.warlord = undefined;
  if (s.captain && FULL_NIGHTS.includes(n.kind) && !plan.warlord) plan.warlord = `${pick(CAPTAIN_NAMES)} ${pick(CAPTAIN_TITLES)}`;
  if (n.kind !== "probe") {
    const hollowOk = n.stage >= HOLLOW_TWISTS_FROM && n.stage !== AFTER;
    for (let i = 0; i < s.twists; i++) {
      const pool = Object.keys(MODIFIERS).filter((m) => !plan.modifiers.includes(m) && (hollowOk || !NEW_MODIFIERS[m]));
      if (pool.length) plan.modifiers.push(pick(pool));
    }
  }
  plan.reach = { kind: n.kind, stage: n.stage };
  plan.baseSides = [...plan.sides];
  plan.baseModifiers = [...plan.modifiers];
});

const NIGHT_NEWS = {
  counted: (n) => `§8The third night. ${n.waves} waves, one an hour${n.clock ? ", the last at 3:17" : ""}.`,
  stolen: (n) => `§8This is not the third night, and they have come anyway. ${n.waves} waves.`,
  probe: () => "§8Something is trying the walls. It is not a siege night.",
  long: (n) => `§8${n.waves} waves before 3:17. Dawn will not help. Break them, or they stay.`,
  muster: (n) => `§7Somebody's army, come for what you have. ${n.waves} waves.`,
  horn: () => "§8You called, and they heard.",
};

on("siegeStart", () => {
  const d = store.data;
  const n = d.night;
  if (!n) return;
  if (n.kind === "long") d.pressure = clamp(d.pressure + 1, 0, REACH.long.maxPressure);
  store.save();
  tell(NIGHT_NEWS[n.kind]?.(n) ?? "");
});

// Each wave has a job. Set the war plans up for it just before it spawns.
on("assaultIncoming", ({ assault }) => {
  const n = store.data.night;
  if (!n) return;
  const role = n.kind === "probe" ? "knock" : waveRole(waveOf(assault), n.waves);
  n.role = role;
  const st = getState();
  for (const plan of Object.values(st.plans)) {
    if (!plan.baseSides) continue;
    plan.sides = [...plan.baseSides];
    plan.modifiers = [...plan.baseModifiers];
    const turn = (Math.random() < 0.5 ? 1 : -1) * (Math.PI / 2);
    if (role === "flank") plan.sides = plan.baseSides.map((a) => a + turn);
    if (role === "breach") for (const m of ["sappers", "siegeTrain"]) if (!plan.modifiers.includes(m)) plan.modifiers.push(m);
    if (role === "dark" || (role === "toll" && n.stage >= 4)) plan.sides = [0, 1, 2, 3].map((q) => q * (Math.PI / 2));
    if (role === "tide") {
      plan.sides = [Math.floor(Math.random() * 4) * (Math.PI / 2)];
      plan.warlord = undefined; // the captain came at 3:17; tides have no leader
    }
  }
  n.glimpse = role === "toll" && !store.data.glimpsed && n.stage >= 2 && n.stage !== AFTER && FULL_NIGHTS.includes(n.kind);
  const line = n.clock || role === "tide" ? WAVES[role].line : waveOf(assault) >= n.waves ? "§7The last of them." : "§7They come again.";
  system.runTimeout(() => {
    for (const p of everyone()) {
      if (role === "toll" && n.clock) {
        title(p, "§43:17", n.glimpse ? "§7 " : n.kind === "muster" ? "§7The last of them" : "§7Everything that was waiting, comes");
        sound(p, "block.bell.hit", { pitch: 0.5, volume: 1 });
      } else {
        p.onScreenDisplay.setActionBar(line);
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
troops.setTroopPlan?.(() => troopMix(store.data.stage, store.data.glimpsed));
// The bestiary's Watcher (one Hollow soldier at the back who only watches) belongs to the nights just before the
// first glimpse. It follows this once the bestiary has a setWatcherPlan(); until then it keeps its own timing.
export const watcherDueNow = () => {
  const d = store.data;
  return !d.glimpsed && d.stage !== AFTER && d.reach >= WATCHER_FROM_REACH;
};
troops.setWatcherPlan?.(() => watcherDueNow());

function sendSoldiers(count, role, glimpse) {
  const st = getState();
  let sent = 0;
  if (!glimpse && raidersLeft().length >= liveCap()) return sent;
  for (const owner of st.besieged) {
    const keep = keepOf(owner), plan = st.plans[owner];
    if (!keep || !plan) continue;
    for (let i = 0; i < count; i++) {
      const [x, z, y] = sideSpot(owner, keep, plan.sides[i % plan.sides.length], glimpse ? 6 : 0);
      if (spawnRaider(overworld(), soldierType(role, glimpse), x, z, y, [ownerTag(owner), HARD_TAG])) sent++;
    }
  }
  return sent;
}

// The first time: the army of men stops and looks back, and something else walks up through it
function firstGlimpse() {
  const d = store.data;
  d.glimpsed = true;
  store.save();
  for (const raider of raidersLeft()) {
    try { raider.addEffect("slowness", 200, { amplifier: 6, showParticles: false }); } catch { /* gone */ }
  }
  for (const p of everyone()) {
    p.sendMessage("§8The army has stopped. All of them. They are looking back the way they came.");
    if (settlementAt(p.location)) {
      try { p.addEffect("darkness", 100, { showParticles: false }); } catch { /* cosmetic */ }
    }
  }
  system.runTimeout(() => {
    if (!getState().active) return;
    sendSoldiers(3, "toll", true);
    for (const p of everyone()) {
      p.sendMessage("§8Something is walking up between them. It is not one of them.");
      sound(p, "ambient.cave", { volume: 1 });
    }
    emit("firstGlimpse", { owners: [...getState().besieged] });
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
  if (n.glimpse) return firstGlimpse();
  if (store.data.glimpsed) sendSoldiers(hollowCount(n.stage, n.role), n.role, false);
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
  d.night = null;
  d.remembered = null;
  if (!n) return store.save();
  const full = FULL_NIGHTS.includes(n.kind);
  if (n.kind === "long" && outcome === "won") d.pressure = clamp(d.pressure - 2, 0, REACH.long.maxPressure); // +1 at dusk, so a broken night is a net -1
  d.last = { day: n.day, kind: n.kind, outcome, kills: n.kills, waves: getState().assaultsTotal ?? n.waves };
  store.save();
  for (const p of everyone()) {
    if (!besieged.includes(p.id)) continue;
    p.sendMessage(`§8The count: ${d.last.waves} wave${d.last.waves === 1 ? "" : "s"}, ${n.kills} fallen at the walls${outcome === "won" ? "" : ". They were not beaten"}.`);
    if (n.kind === "long" && outcome === "won") p.sendMessage("§7You broke them. It is quiet until dusk.");
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

function skyTick() {
  const d = store.data;
  const want = REACH.long.greySky && d.stage === LONG;
  try {
    if (want) overworld().setWeather(WeatherType.Rain, 2400);
    else if (d.sky) overworld().setWeather(WeatherType.Clear);
  } catch { /* weather is cosmetic */ }
  if (d.sky !== want) { d.sky = want; store.save(); }
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
  const d = store.data;
  const st = getState();
  const day = world.getDay();
  if (d.lastDawn !== day) {
    const passed = d.lastDawn < 0 ? 0 : clamp(day - d.lastDawn, 0, 3);
    d.lastDawn = day;
    if (d.forced && d.forced.day < day) d.forced = null;
    store.save();
    if (passed > 0 && day >= SETTINGS.firstSiegeDay) addReach(REACH.gain.dawn * passed, "dawn");
  }
  longTick();
  if (st.active || !anyKeeps() || st.lastSiegeDay === day) return;
  const kind = tonightKind(day);
  if (!isSiegeKind(kind)) return;
  const now = world.getTimeOfDay();
  const open = openTime(kind, profile(kind, d.stage, d.pressure).waves);
  if (now < REACH.duskTime || now >= open) return;
  const hour = Math.floor((now - REACH.duskTime) / REACH.hour);
  const key = `${day}:${hour}`;
  if (d.omen === key) return;
  d.omen = key;
  store.save();
  for (const p of everyone()) {
    if (p.dimension.id !== "minecraft:overworld") continue;
    if (hour === 0) p.sendMessage(duskLine(kind, d.stage, day));
    else if (kind !== "muster") {
      p.onScreenDisplay.setActionBar(HOUR_LINES[Math.floor(dayRoll(day, d.salt, 20 + hour) * HOUR_LINES.length)]);
      sound(p, "ambient.cave", { volume: 0.4 });
    }
  }
}

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

onTick("reach", 40, reachTick);
onTick("reach pull", REACH.pullEvery, pullTick);
onTick("reach sky", 1200, skyTick);
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
  const lines = [
    `§l${s.name}§r`,
    s.about,
    "",
    `Sieges: ${s.rhythm.toLowerCase()}. ${s.waves} waves on a full night, one an hour, the last at ${clock(REACH.tollTime)}.`,
    getState().active ? "§cA siege is under way." : KIND_WORDS[kind] ?? (next === undefined ? "The watch expects a quiet night." : `The watch expects a quiet night. The next siege they are sure of is in ${next - day} day${next - day === 1 ? "" : "s"}.`),
    d.stage === 2 || d.stage === 3 ? "§7Not every night that is quiet at dusk stays quiet." : "",
    d.stage === LONG ? `§7Their strength: ${Math.round(pressureMult(d.pressure) * 100)}% of an ordinary army. Break a night to wear them down.` : "",
    d.last ? `Last time (day ${d.last.day}): ${d.last.waves} waves, ${d.last.kills} fallen, ${d.last.outcome === "won" ? "§aheld§r" : "§cnot beaten§r"}.` : "",
  ].filter(Boolean);
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
    `§6The Reach: ${d.reach}/100, stage ${d.stage} (${s.name}). Bosses fallen ${f.bosses}/6, Choir ${f.choir ? "fallen" : "standing"}, source ${f.source ? "rectified" : "not rectified"}.`,
    `§7Tonight (day ${world.getDay()}): ${kind ?? "quiet"}${kind ? `, horn at ${clock(openTime(kind, profile(kind, d.stage, d.pressure).waves, world.getDay(), d.salt))}` : ""}. Now ${clock(world.getTimeOfDay())}.`,
    `§7Long Night pressure ${d.pressure}. First Hollow soldiers seen: ${d.glimpsed ? "yes" : "no"}. ${d.night ? `Siege running: ${d.night.kind}, ${d.night.waves} waves.` : ""}`,
  ].join("\n"));
}

system.afterEvents.scriptEventReceive.subscribe((event) => {
  const id = event.id;
  if (!id.startsWith("siege:")) return;
  let data;
  try { data = JSON.parse(event.message); } catch { data = undefined; }
  if (id === "siege:boss_defeated") return bossFell(data?.boss);
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
      d.stage = want;
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
      break;
    case "siege:reach_reset":
      Object.assign(d, { reach: 0, stage: 1, bosses: {}, choir: false, source: false, pressure: 0, glimpsed: false, night: null, forced: null, remembered: null, last: null });
      skyTick();
      break;
    default:
      break;
  }
  store.save();
  if (player) status(player);
});
