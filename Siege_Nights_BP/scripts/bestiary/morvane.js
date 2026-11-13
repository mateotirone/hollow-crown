// Morvane: the last fight. Seven stages, and at every health gate he drags everyone somewhere else.
// (Design: the "Design the Hollow as its own world" thread with Mateo. The Choir is its own fight before him.)
//
//   1 The Seat             sword and Crown. Every third blow is a Toll ring you jump. He blinks behind whoever
//                          hit him last. Tollmen answer the Crown.
//   2 The Standing Ranks   empty armour stands up. He is inside one suit and cannot be hurt until found.
//                          Tell: he fights LEFT-handed (his right hand took the splinter of the Crown and never
//                          served him again). His suit carries its light on the left hand, the dead on the right.
//   3 The Night It Ended   a memory. Lords of the old court come in three waves while he watches, untouchable.
//   4 The River            he is under the water. He surfaces to strike, and can only be hurt while he is up.
//                          Gloamwings harry you. Falling in hurts and sweeps you back; it does not kill.
//   5 The Rift             the overworld, outside the Rift cave. He fights like a siege and breaks settlement
//                          walls like a ram. He cannot die up here: enough damage drags everyone back.
//   6 The Fall             a memory. About 40 seconds on crumbling ledges. Fall and you are out until stage 7.
//     (the reveal)         a staged scene of about a minute: reveal.js. Who he was, without a name being said.
//   7 The Seat             the floor falls ring by ring. He cannot die while he wears the Hollow Crown:
//                          stagger him, knock it off, keep him from it, finish him.
//
// Rules for the whole fight: every big attack has a sound and about 1.5 s of warning. Each stage has a timer,
// and when it runs out he enrages. If everyone is down the stage restarts, twice; the third time it is back to
// stage 1. Alone, you get one second wind per stage. With friends, a fallen player waits until the stage changes.
//
// STORY RULE (Mateo): who Morvane was is never stated outright. Stage 6 is where it becomes plain without the name.
// Mateo (decision card, 2026-11-10): in stage 6 he says he was a king, their king, with no name.
// No line before stage 6 may say "king", and no line anywhere in the fight says "Oswin".
//
// ARENAS belong to the Hollow build thread (undertow/finale.js): the Seat, the Standing Ranks, the pockets
// for the Night, the River and the Fall, and the open Rift in the overworld. When the fight starts on the Seat
// it uses them. A stage whose arena is not ready (a pocket not built yet, a Rift never opened) is fought where
// the fight already is, and a fight started anywhere else (/scriptevent siege:bestiary_summon morvane) plays
// all seven stages on the spot, so it can be tested on any flat ground. setMorvanePlace() overrides a place.
// We tell them what is happening with script events:
//   siege:morvane_stage  {"stage" 1-7, "key", "x","y","z","dimension","restart"}
//   siege:morvane_floor  {"radius","x","y","z","dimension"}     stage 7: everything beyond radius should fall
// Testing: /scriptevent siege:morvane_skip 5   jumps a running fight to stage 5.

import { world, system } from "@minecraft/server";
import { addTests, assert, assertEqual, emit, hitWall, settlementAt, UNBREAKABLE } from "../siege/api.js";
import { UNDERTOW_ID } from "../undertow/layout.js";
import { SEAT, RANKS, FALL_SHAFTS, dropSeatBand, rebuildSeat, ranksSpots, ranksReady, pocket, pocketReady, requestPockets, overworldStage } from "../undertow/finale.js";
import { registerBoss, startBoss, fightOf, rebind, stack } from "./bossCore.js";
import { lance } from "./bosses.js";
import { playReveal } from "./reveal.js";
import { REVEAL } from "../lore/data/reveal.js";
import { spawnChampion } from "./champions.js";
import { announce, blockKind, effect, flat, footingNear, heal, healthOf, heroOf, hurt, particle, ring, shove, sound } from "./util.js";
import { sfx } from "../core/sfx.js";

export const MORVANE = {
  type: "siege:oswin_the_last", // the entity keeps its old id; players only ever see "Morvane"
  suit: "siege:oswin_reflection",
  radius: 32,
  points: 30,
  wipeRetries: 2, // a stage restarts this many times before the fight goes back to stage 1
  rage: 1.5, // damage multiplier once a stage's timer runs out
  suits: { base: 6, perPlayer: 2, max: 14, awake: 2, open: 240 }, // stage 2: `open` = ticks he can be hurt once found
  court: [["knight", "knight"], ["knight", "sorcerer", "retainer", "retainer"], ["lord", "knight", "sorcerer"]], // stage 3 waves
  river: { up: 100, fallDamage: 6, wings: 400, maxWings: 4 },
  rift: { wall: 12, raid: 500 },
  fall: { every: 80, damage: 9 },
  crown: { shieldAt: 0.12, hits: 5, hitsPerPlayer: 2, reach: 200, delayPerHit: 10, maxReach: 500, healBack: 0.06 },
  floor: { every: 500, warn: 120, step: 5, min: 9, damage: 6 },
};

// from/to are fractions of his health. A memory stage does not touch his health: it ends on its own terms.
export const STAGES = [
  { key: "seat", name: "The Seat", from: 1, to: 0.84, limit: 3000 },
  { key: "ranks", name: "The Standing Ranks", from: 0.84, to: 0.7, limit: 3000 },
  { key: "night", name: "The Night It Ended", from: 0.7, to: 0.7, limit: 4800, memory: true },
  { key: "river", name: "The River", from: 0.7, to: 0.52, limit: 3000 },
  { key: "rift", name: "The Rift", from: 0.52, to: 0.38, limit: 3000 },
  { key: "fall", name: "The Fall", from: 0.38, to: 0.38, limit: 800, memory: true },
  { key: "seat", name: "The Seat", from: 0.38, to: 0, limit: 4800 },
];

// ---------- pure rules (self-tested) ----------
// Where a wipe sends the fight: the same stage for the first two wipes there, then stage 1.
export const wipeTarget = (stage, wipesHere, retries = MORVANE.wipeRetries) => (wipesHere <= retries ? stage : 0);
// Has he taken enough in this stage to be dragged on?
export const gateReached = (stage, hpFraction) => !STAGES[stage].memory && stage < STAGES.length - 1 && hpFraction <= STAGES[stage].to;
export const suitCount = (players, round = 0) => Math.min(MORVANE.suits.max, MORVANE.suits.base + MORVANE.suits.perPlayer * Math.max(0, players - 1) + 2 * round);
export const crownHitsNeeded = (players) => MORVANE.crown.hits + MORVANE.crown.hitsPerPlayer * Math.max(0, players - 1);
// The rings the Seat's floor loses in stage 7, outermost first
export function floorRings(radius, step = MORVANE.floor.step, min = MORVANE.floor.min) {
  const out = [];
  for (let r = radius - step; r >= min; r -= step) out.push(r);
  return out;
}
// Each player gets their own spot around a centre, spread evenly
export function spreadSpots(center, count, distance) {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / Math.max(1, count)) * Math.PI * 2;
    return { x: center.x + Math.round(Math.cos(a) * distance) + 0.5, y: center.y, z: center.z + Math.round(Math.sin(a) * distance) + 0.5 };
  });
}

// ---------- places ----------
// place = { dimension, center: {x,y,z}, radius, entry?: where players arrive, spots?: one arrival spot per player,
//           boss?: where he stands on arrival, suits?: spots for the ranks, gate?: where the fallen wait,
//           waterY?: river surface, bottom?: floor of the Fall, rings?: radii the Seat loses, drop?(r), rebuild?() }
const places = {};
export function setMorvanePlace(key, place) {
  if (!place?.center) delete places[key];
  else places[key] = place;
}
export const morvanePlace = (key) => places[key];

const seatCentre = () => ({ x: SEAT.center.x + 0.5, y: SEAT.center.y, z: SEAT.center.z + 0.5 });

// The real arenas, when the fight is the one on the Seat. Undefined = not ready, fight it where you are.
export function finalePlace(key, partySize = 1) {
  if (key === "seat") {
    return { center: seatCentre(), radius: SEAT.outerRadius + 2, ring: 14, rings: floorRings(SEAT.outerRadius + 1, MORVANE.floor.step, SEAT.innerRadius + 2), drop: dropSeatBand, rebuild: rebuildSeat };
  }
  if (key === "ranks") {
    // Their ground and armour are built after the Choir falls (builder.js ranksGround). Until then the stage is
    // fought where he is, never in the empty dark of unbuilt land (Mateo 2026-11-12: "the second stage is just dark").
    if (!ranksReady()) return undefined;
    const center = { x: RANKS.x + 0.5, y: RANKS.y + 1, z: RANKS.z + 0.5 };
    return { center, radius: RANKS.r, entry: { x: RANKS.x + 3.5, y: RANKS.y + 1, z: RANKS.z - 9.5 },
      suits: ranksSpots().sort((a, b) => flat(a, center) - flat(b, center)).filter((q) => flat(q, center) > 5) };
  }
  if (key === "night" || key === "river") {
    const p = pocket(key);
    if (!p || !pocketReady(key)) return undefined;
    const center = { x: p.entry.x, y: p.entry.y, z: (p.min.z + p.max.z) / 2 };
    return { center, radius: Math.ceil((p.max.z - p.min.z) / 2) + 4, entry: p.entry, boss: key === "river" ? p.entry : center };
  }
  if (key === "rift") {
    const s = overworldStage();
    return s ? { dimension: s.dimension, center: s.arrival, radius: 40, entry: s.arrival } : undefined;
  }
  if (key === "fall") {
    const shafts = [];
    for (let i = 0; i < FALL_SHAFTS && shafts.length < partySize; i++) if (pocketReady(`fall${i}`)) shafts.push(pocket(`fall${i}`));
    if (shafts.length < partySize) return undefined; // not one each: fight it where you are
    const first = shafts[0], last = shafts[shafts.length - 1];
    return { center: { x: first.entry.x, y: (first.min.y + first.max.y) / 2, z: first.entry.z }, boss: first.entry, spots: shafts.map((q) => q.entry),
      radius: Math.abs(last.entry.x - first.entry.x) + (first.max.y - first.min.y) / 2 + 10, bottom: first.min.y + 1 };
  }
  return undefined;
}

function placeFor(f, stage) {
  const key = STAGES[stage].key;
  let p = places[key];
  if (!p && f.m.atSeat) {
    try { p = finalePlace(key, Math.max(1, party(f).length)); } catch { /* arenas unavailable */ }
  }
  if (p) {
    try {
      return { ...p, dim: world.getDimension(p.dimension ?? UNDERTOW_ID), radius: p.radius ?? MORVANE.radius, real: true };
    } catch {
      // unknown dimension: fight it at home
    }
  }
  const h = f.m.home;
  return { dim: world.getDimension(h.dimension), center: h.center, radius: MORVANE.radius, real: false };
}

// ---------- small helpers ----------

// Where he can land near a spot (util.js footingNear): the first place from 2 up to 8 down with floor under it and two
// blocks of air for him, so he is never put inside the floor or dropped into the rock under the Seat. Mateo 2026-11-12:
// "Morvane is getting stuck in the void. He's lunging at me and falling through the cracks": he used to land exactly
// where you stood, so a player in the air or at the edge sent him into the drop.
// Move him to the nearest footing by a spot; if there is none (over the void) he stays where he is.
function moveTo(f, at, options) {
  // Stage 7: never past the edge of the floor that is left. On the real Seat there is nothing out there to land on;
  // on open ground (a test summon) there is, and he used to lunge out to where standing hurts and wait there.
  const safe = f.m?.stage === 6 ? f.m.s.safe : undefined;
  if (safe !== undefined && flat(at, f.center) > safe - 1.5) {
    const d = flat(at, f.center) || 1, k = Math.max(0, safe - 1.5) / d;
    at = { x: f.center.x + (at.x - f.center.x) * k, y: at.y, z: f.center.z + (at.z - f.center.z) * k };
  }
  const to = footingNear(at, blockKind(f.dim));
  if (!to) return false;
  try { f.entity.teleport(to, options); return true; } catch { return false; }
}
// Pulled back if he still falls (knocked off, or a floor gives under him): to the last ground he stood on.
function keepFooting(f) {
  const e = f.entity, m = f.m;
  try {
    if (e.isOnGround) { m.foot = { x: e.location.x, y: e.location.y, z: e.location.z }; return; }
    if (m.foot && STAGES[m.stage].key !== "fall" && e.location.y < m.foot.y - 10) {
      e.teleport(m.foot);
      particle(f.dim, "siege:vein_spark", e.getHeadLocation());
    }
  } catch { /* gone */ }
}
function party(f) {
  return world.getAllPlayers().filter((p) => f.m.party.has(p.id));
}
const per = (f, base, each) => base + each * Math.max(0, f.players().length - 1);
const dmg = (f, n) => Math.round(n * (f.m.raged ? MORVANE.rage : 1));
const stageIs = (...list) => (f) => !!f.m && list.includes(f.m.stage) && !f.m.moving;
const setHp = (entity, fraction) => {
  try {
    const hp = entity.getComponent("health");
    hp.setCurrentValue(Math.max(1, hp.effectiveMax * fraction));
  } catch {
    // boss gone
  }
};
const speak = (f, text) => { for (const p of party(f)) p.sendMessage(`§3${text}`); };
const hide = (f, on) => {
  f.shield(on);
  try {
    if (on) f.entity.addEffect("invisibility", 100000, { showParticles: false });
    else f.entity.removeEffect("invisibility");
  } catch {
    // boss gone
  }
};
// The Hollow Crown is part of his model. Knocked off, it is hidden (entity events siege:bare_on / siege:bare_off).
const bare = (f, on) => { try { f.entity.triggerEvent(on ? "siege:bare_on" : "siege:bare_off"); } catch { /* boss gone */ } };
const freeze = (e, on) => {
  try {
    if (on) { e.addEffect("slowness", 100000, { amplifier: 255, showParticles: false }); e.addEffect("weakness", 100000, { amplifier: 255, showParticles: false }); }
    else { e.removeEffect("slowness"); e.removeEffect("weakness"); }
  } catch {
    // gone
  }
};

// He follows the players to a new place a moment after them, once it has loaded round them. The players have just
// left where he is standing, and Minecraft stops keeping a place loaded once nobody is near it: if his chunk went
// before he was moved, he was left behind for good and the fight stopped. So the ground under him is held loaded
// until he has gone, and the move is tried again until it works (boss review 2026-11-13).
const HOLD = "hc_morvane_hold";
function holdGround(f, on) {
  try {
    const e = f.entity, d = e.dimension, l = e.location;
    d.runCommand(`tickingarea remove ${HOLD}`);
    if (on) d.runCommand(`tickingarea add circle ${Math.floor(l.x)} ${Math.floor(l.y)} ${Math.floor(l.z)} 1 ${HOLD} true`);
  } catch { /* he is not loaded: onLost looks for him */ }
}
function sendBoss(f, at, dim, delay, done) {
  const from = f.entity.dimension;
  holdGround(f, true);
  let tries = 0;
  const go = () => {
    let moved = false;
    try { f.entity.teleport({ x: at.x, y: at.y + 0.2, z: at.z }, { dimension: dim }); moved = true; } catch { /* not ready yet */ }
    if (!moved && ++tries < 15) return system.runTimeout(go, 20);
    try { from.runCommand(`tickingarea remove ${HOLD}`); } catch { /* nothing held */ }
    done?.(moved);
  };
  system.runTimeout(go, delay);
}

// Bring every party member who is alive and not already in the arena to the stage's place
function bringIn(f, place, everyone = false) {
  const inside = new Set(f.players().map((p) => p.id));
  const comers = party(f).filter((p) => healthOf(p).now > 0 && (everyone || !inside.has(p.id)));
  const spots = place.spots?.length ? place.spots : spreadSpots(place.entry ?? place.center, Math.max(comers.length, 3), place.entry ? 2 : place.ring ?? 6);
  comers.forEach((p, i) => {
    const s = spots[i % spots.length];
    try {
      p.teleport({ x: s.x, y: s.y + 0.2, z: s.z }, { dimension: place.dim, facingLocation: place.center });
      effect(p, "blindness", 25, 0);
      effect(p, "resistance", 60, 4); // nobody dies in the doorway
    } catch {
      // chunk not ready: they will be pulled in at the next stage
    }
  });
}

// ---------- moving between stages ----------
function enter(f, n, { restart = false, quiet = false } = {}) {
  const m = f.m, st = STAGES[n], place = placeFor(f, n);
  const moved = place.real || m.away; // only shuffle people about if there is somewhere real to go (or to come back from)
  m.stage = n; m.s = {}; m.started = f.tick; m.raged = false; m.down.clear(); m.wipeAt = undefined;
  f.timers = []; f.busyUntil = f.tick + 60;
  hide(f, false); freeze(f.entity, false); bare(f, false);
  try { for (const e of ["speed", "strength"]) f.entity.removeEffect(e); } catch { /* gone */ }
  if (restart) setHp(f.entity, st.from);
  f.moveTo(place.dim, place.center, place.radius);
  m.away = place.real;
  if (m.floorGone) { // the Seat's floor fell last time: put it back before anyone stands on it
    m.floorGone = false;
    try { placeFor(f, 0).rebuild?.(); } catch { /* arena unavailable */ }
  }
  if (moved || restart) {
    m.moving = true;
    bringIn(f, place, true);
    // He follows a moment later, once the place has loaded around the players
    sendBoss(f, place.boss ?? place.center, place.dim, 30, () => { m.moving = false; });
  }
  if (!quiet) {
    for (const p of party(f)) {
      try {
        p.onScreenDisplay.setTitle(`§5${st.name}`, { subtitle: `§7${n + 1} of ${STAGES.length}${restart ? "  ·  again" : ""}`, fadeInDuration: 5, stayDuration: 50, fadeOutDuration: 15 });
        sfx(p, "mob.wither.ambient", { pitch: 0.6, volume: 0.7 });
      } catch { /* offline */ }
    }
  }
  announce("siege:morvane_stage", { stage: n + 1, key: st.key, x: place.center.x, y: place.center.y, z: place.center.z, dimension: place.dim.id, restart });
  SETUP[n]?.(f, place);
}

// Each stage starts at its own health line. One very heavy blow used to carry on through the next gate, so the stage
// after it lasted a single tick and was never seen (the Standing Ranks could be skipped whole).
function advance(f) {
  const n = Math.min(STAGES.length - 1, f.m.stage + 1);
  if (f.hp() < STAGES[n].from) setHp(f.entity, STAGES[n].from);
  enter(f, n);
}

// ---------- stage set-up ----------
const SETUP = {
  0: (f) => { speak(f, "\"Sit, then. If you can take it from me.\""); voice(f, "seat"); },

  1: (f, place) => {
    speak(f, "The hall is lined with armour, rank on rank. He steps back among it and is gone. One by one, the suits stand up.");
    standRanks(f, place);
  },

  2: (f) => {
    hide(f, true); freeze(f.entity, true);
    f.m.s.wave = 0; f.m.s.nextWave = f.tick + 100;
    speak(f, "The stone is whole and the lamps are lit. A court stands here, feasting. Then, all at once, they turn.");
  },

  3: (f) => {
    hide(f, true); freeze(f.entity, true); // under the water he is not there to fight: he used to walk about unseen and hit people
    f.m.s.nextWings = f.tick + 200;
    speak(f, "Cold light runs under you like a river. He is somewhere in it.");
  },

  4: (f) => {
    f.m.s.nextRaid = f.tick + 100;
    speak(f, "Open air. Your own sky, gone the wrong colour. \"This was mine first. And thanks to you, it is mine again.\"");
    voice(f, "stage_sky", 30);
  },

  5: (f) => {
    hide(f, true); freeze(f.entity, true);
    f.m.s.said = 0; f.m.s.fallen = new Set();
  },

  6: (f, place) => {
    const s = f.m.s;
    s.crowned = true; s.hits = 0;
    s.rings = place.rings ?? floorRings(place.radius);
    s.ring = 0; s.safe = place.radius; s.nextFall = f.tick + MORVANE.floor.every;
    speak(f, "The Seat again. The floor is letting go. The Crown on his head is the only thing here that is not falling.");
  },
};

// Stage 2: the ranks. All suits stand frozen but a few; one frozen suit is his.
function standRanks(f, place) {
  const s = f.m.s;
  for (const e of f.adds(MORVANE.suit)) { try { e.remove(); } catch { /* gone */ } }
  hide(f, true); freeze(f.entity, true);
  try { f.entity.teleport({ x: place.center.x, y: place.center.y + 0.2, z: place.center.z }); } catch { /* moving */ }
  const n = suitCount(f.players().length, s.round ?? 0);
  const spots = place.suits?.length >= n ? place.suits : spreadSpots(place.center, n, Math.min(13, place.radius - 6));
  const truth = Math.floor(Math.random() * n);
  s.awake = new Set(); s.trueId = undefined; s.open = 0;
  let toWake = per(f, MORVANE.suits.awake, 1);
  for (let i = 0; i < n; i++) {
    const e = f.place(MORVANE.suit, spots[i]);
    if (!e) continue;
    try { e.nameTag = "§7Standing Rank"; } catch { /* cosmetic */ }
    if (i === truth) { // his suit holds the blade in its LEFT hand; the empty ones hold theirs in the right
      s.trueId = e.id; freeze(e, true);
      try { e.triggerEvent("siege:bare_on"); } catch { /* the light on the hand still gives him away */ }
      continue;
    }
    if (toWake > 0) { toWake--; s.awake.add(e.id); } else freeze(e, true);
  }
}

function foundHim(f, suit) {
  const s = f.m.s, at = { ...suit.location };
  try { suit.remove(); } catch { /* gone */ }
  for (const e of f.adds(MORVANE.suit)) { freeze(e, true); }
  s.awake = new Set(); s.trueId = undefined;
  hide(f, false); freeze(f.entity, false);
  try { f.entity.teleport(at); } catch { /* blocked */ }
  f.stun(60);
  s.open = f.tick + MORVANE.suits.open;
  f.say("§dThe suit splits open. He is in it. Now!");
  sound(f.dim, "random.anvil_land", at, 0.7, 1);
}

// Stage 3: the next wave of the old court
function courtWave(f) {
  const s = f.m.s, wave = MORVANE.court[s.wave];
  const extra = Math.max(0, f.players().length - 1);
  const roles = [...wave, ...Array(extra).fill(s.wave === 2 ? "knight" : "retainer")];
  const names = { knight: "§7Knight of the Old Court", sorcerer: "§7Counsellor of the Old Court", lord: "§7Lord of the Old Court", retainer: "§7Man-at-arms" };
  for (const role of roles) {
    const at = f.spot(8, Math.min(14, (f.radius ?? MORVANE.radius) - 4));
    try {
      spawnChampion(f.dim, { x: at.x, y: at.y + 0.2, z: at.z }, { role, tier: 2, name: names[role], stance: "hostile", tags: [f.addTag, "siege_morvane_court"] });
      particle(f.dim, "minecraft:knockback_roar_particle", at);
    } catch {
      // champions unavailable: the wave is smaller
    }
  }
  s.wave++;
  f.bar(`§5The old court stands against you  ·  ${s.wave} of ${MORVANE.court.length}`);
}

// Stage 7: the Crown
function uncrown(f) {
  const s = f.m.s;
  s.crowned = false; s.hits = 0;
  bare(f, true); // the Crown is off his head for everyone to see
  s.crownAt = f.spot(6, Math.max(7, Math.min(12, s.safe - 3)));
  s.uncrownedAt = f.tick; s.reach = f.tick + MORVANE.crown.reach;
  f.shield(false);
  // Above the line he could always be hurt, so "he can die now" would be a lie there (boss walkthrough, Mateo 2026-11-13)
  f.say(f.hp() <= MORVANE.crown.shieldAt
    ? "§dThe Hollow Crown rings off across the floor. He can die now. Keep him from it!"
    : "§dThe Hollow Crown rings off across the floor. Without it he bleeds. Hurt him, and keep him from it!");
  sound(f.dim, "block.bell.hit", f.entity.location, 0.5, 1);
}

function recrown(f) {
  const s = f.m.s;
  try { f.entity.teleport(s.crownAt); } catch { /* blocked */ }
  s.crowned = true; s.crownAt = undefined;
  bare(f, false);
  heal(f.entity, healthOf(f.entity).max * MORVANE.crown.healBack);
  f.say("§5He has it again. Stagger him and strike it off.");
  sound(f.dim, "mob.wither.spawn", f.entity.location, 0.8, 0.6);
}

// ---------- per-stage ticking ----------
const TICK = {
  1: (f) => {
    const s = f.m.s, place = placeFor(f, 1);
    if (s.open) {
      if (f.tick < s.open) return f.bar(`§dHe is out of the armour: ${Math.ceil((s.open - f.tick) / 20)}`);
      s.round = (s.round ?? 0) + 1;
      f.say("§5He steps back into the ranks. More of them are standing now.");
      return standRanks(f, place);
    }
    if (f.tick % 40) return;
    // the tell: his suit holds its blade left-handed (model), and a cold light sits on that hand; on the right hand of the empty ones
    for (const e of f.adds(MORVANE.suit)) {
      try {
        const v = e.getViewDirection(), side = e.id === s.trueId ? 1 : -1; // +1 is the entity's left
        particle(f.dim, "minecraft:blue_flame_particle", { x: e.location.x + v.z * 0.9 * side, y: e.location.y + 1.5, z: e.location.z - v.x * 0.9 * side });
      } catch { /* gone */ }
    }
    f.bar("§7He is in one of them. Look at their hands.");
  },

  2: (f) => {
    const s = f.m.s;
    const left = f.adds().filter((e) => e.hasTag("siege_morvane_court")).length;
    if (f.m.raged && s.wave < MORVANE.court.length) {
      f.say("§4The memory will not wait any longer. The rest of the old court stands at once.");
      while (s.wave < MORVANE.court.length) courtWave(f);
      return;
    }
    if (left) return;
    if (s.wave >= MORVANE.court.length) {
      speak(f, "The lamps go out one at a time. The last thing you see is a chair, pulled out from under someone.");
      return advance(f);
    }
    if (s.nextWave === undefined) s.nextWave = f.tick + 60;
    if (f.tick >= s.nextWave) { s.nextWave = undefined; courtWave(f); }
  },

  3: (f, players) => {
    const s = f.m.s, place = placeFor(f, 3);
    if (s.up && f.tick >= s.up) { s.up = 0; hide(f, true); freeze(f.entity, true); f.say("§3He goes under."); }
    if (f.tick >= s.nextWings) {
      s.nextWings = f.tick + MORVANE.river.wings;
      const have = f.adds("siege:gloamwing").length;
      const want = Math.min(MORVANE.river.maxWings - have, 1 + Math.floor(players.length / 2));
      for (let i = 0; i < want; i++) {
        const at = f.spot(6, 14);
        f.summon("siege:gloamwing", 1, 1, { x: at.x, y: at.y + 10, z: at.z });
      }
    }
    if (f.tick % 20) return;
    for (const p of players) {
      const wet = place.waterY !== undefined ? p.location.y < place.waterY : p.isInWater;
      if (!wet) continue;
      hurt(p, Math.min(MORVANE.river.fallDamage, Math.max(0, healthOf(p).now - 1)), "magic"); // it hurts; it does not kill
      const back = place.entry ?? place.spots?.[0] ?? place.center;
      try { p.teleport({ x: back.x, y: back.y + 0.2, z: back.z }); } catch { /* blocked */ }
      p.onScreenDisplay.setActionBar("§3The river takes you and puts you back where you started.");
    }
  },

  4: (f) => {
    const s = f.m.s;
    if (f.tick >= s.nextRaid && f.adds().length < 10) {
      s.nextRaid = f.tick + MORVANE.rift.raid;
      f.summon("siege:hollow_footman", per(f, 3, 1), 8);
      if (!s.ringer) { s.ringer = true; f.summon("siege:bell_ringer", 1, 8); }
      f.bar("§5Tollmen come out of the cave behind him.");
    }
    // He goes through settlement walls the way a ram does
    if (f.tick % 40) return;
    try {
      const v = f.entity.getViewDirection(), at = f.entity.location;
      for (let up = 0; up <= 2; up++) {
        const block = f.dim.getBlock({ x: Math.floor(at.x + v.x * 1.6), y: Math.floor(at.y) + up, z: Math.floor(at.z + v.z * 1.6) });
        if (!block || block.isAir || block.isLiquid || UNBREAKABLE.includes(block.typeId) || !settlementAt(block.location)) continue;
        hitWall(block, MORVANE.rift.wall);
        sound(f.dim, "random.anvil_land", at, 0.5, 0.8);
      }
    } catch {
      // unloaded
    }
  },

  5: (f, players) => {
    // Lines from the lore thread. The third stops short of his old name on purpose (Mateo: never stated outright).
    const s = f.m.s, t = f.tick - f.m.started;
    // His words here are the lore thread's (REVEAL.fall): five on the way down, the sixth as the stage breaks.
    const at = [40, 180, 340, 500, 650];
    if (s.said < at.length && t >= at[s.said]) sayFall(f, s.said++);
    f.bar(`§7The ledge is going. Keep moving: ${Math.max(0, Math.ceil((STAGES[5].limit - t) / 20))}`);
    const place = placeFor(f, 5);
    if (place.bottom !== undefined) {
      for (const p of players) {
        if (s.fallen.has(p.id) || p.location.y > place.bottom + 8) continue;
        s.fallen.add(p.id);
        p.sendMessage("§7You hit the bottom. You are out of it until he moves on.");
      }
      if (players.length && players.every((p) => s.fallen.has(p.id))) return wipe(f, players);
    }
    if (t % MORVANE.fall.every === 0) {
      for (const p of players) {
        if (s.fallen.has(p.id)) continue;
        f.zone({ x: p.location.x, y: p.location.y, z: p.location.z }, 2.5, 32, (q) => {
          hurt(q, MORVANE.fall.damage, "magic");
          shove(q, Math.random() - 0.5, Math.random() - 0.5, 0.9, 0.3); // the ledge goes: it throws you
        }, "minecraft:falling_dust_gravel_particle");
      }
    }
    if (t >= STAGES[5].limit) reveal(f);
  },

  6: (f, players) => {
    const s = f.m.s, hp = f.hp();
    // the floor
    if (s.ring < s.rings.length) {
      const left = s.nextFall - f.tick, r = s.rings[s.ring];
      if (left <= MORVANE.floor.warn && left > 0 && left % 20 === 0) ring(f.dim, { x: f.center.x, y: f.center.y + 0.2, z: f.center.z }, r, "minecraft:basic_flame_particle", r * 4);
      if (left === MORVANE.floor.warn) f.say("§cThe floor beyond the flames is about to fall. Move in!");
      if (left <= 0) {
        s.safe = r; s.ring++; s.nextFall = f.tick + MORVANE.floor.every;
        f.m.floorGone = true;
        try { placeFor(f, 6).drop?.(r); } catch { /* arena unavailable */ }
        announce("siege:morvane_floor", { radius: r, x: f.center.x, y: f.center.y, z: f.center.z, dimension: f.dim.id });
        for (const p of players) sound(f.dim, "random.explode", p.location, 0.5, 1);
      }
    }
    if (f.tick % 20 === 0) {
      for (const p of players) {
        if (flat(p.location, f.center) <= s.safe + 0.5) continue;
        hurt(p, dmg(f, MORVANE.floor.damage), "void");
        shove(p, f.center.x - p.location.x, f.center.z - p.location.z, 1.2, 0.5);
        p.onScreenDisplay.setActionBar("§cThere is nothing under you out here.");
      }
    }
    // the Crown
    if (s.crowned) {
      const staggered = (s.stagger ?? 0) > f.tick;
      // Under the line he cannot be hurt while crowned, staggered or not: the stagger is for striking the Crown off,
      // and a strong party used to kill him through it with the Crown still on (boss walkthrough 2026-11-12)
      f.shield(hp <= MORVANE.crown.shieldAt);
      if (staggered) f.bar(`§dHe staggers. Strike the Crown!  ${s.hits} / ${crownHitsNeeded(players.length)}`);
      else if (hp <= MORVANE.crown.shieldAt && f.tick % 40 === 0) f.bar("§5He cannot die while he wears the Hollow Crown.");
      return;
    }
    particle(f.dim, "minecraft:endrod", { x: s.crownAt.x, y: s.crownAt.y + 0.6, z: s.crownAt.z });
    if (f.tick % 10 === 0) ring(f.dim, s.crownAt, 1.2, "minecraft:villager_happy", 8);
    effect(f.entity, "slowness", 20, 2);
    f.bar(`§dHe reaches for the Crown: ${Math.max(0, Math.ceil((s.reach - f.tick) / 20))}  ·  every blow holds him back`);
    if (f.tick >= s.reach) recrown(f);
  },
};

// Everyone is down. Alone, the first time in a stage is a second wind. Otherwise the stage starts again,
// and after too many of those, the whole fight does.
function wipe(f, ps) {
  const m = f.m, n = m.stage;
  m.wipeAt = undefined;
  if (m.party.size === 1 && !m.wind[n]) {
    m.wind[n] = true; m.down.clear();
    if (m.s.fallen) m.s.fallen = new Set();
    for (const p of ps) p.sendMessage("§dSecond wind. He waits for you, this once. (One per stage when you fight alone.)");
    return bringIn(f, placeFor(f, n), true);
  }
  m.tries[n] = (m.tries[n] ?? 0) + 1;
  const back = wipeTarget(n, m.tries[n]);
  if (back !== n) { m.tries = {}; m.wind = {}; }
  for (const p of ps) p.sendMessage(back === n ? `§c${STAGES[n].name} begins again. (${m.tries[n]} of ${MORVANE.wipeRetries} before he starts over.)` : "§4He sits back down. It begins again from the Seat.");
  enter(f, back, { restart: true });
}

// ---------- the boss ----------
function tollRing(f, damage) {
  const c = { ...f.entity.location }, reach = (f.radius ?? MORVANE.radius) + 2;
  for (let step = 0; step * 2 + 3 <= reach; step++) {
    f.after(step * 5, () => {
      const r = step * 2 + 3;
      ring(f.dim, { x: c.x, y: c.y + 0.3, z: c.z }, r, "minecraft:sonic_explosion", Math.max(6, r));
      particle(f.dim, "siege:choir_ring", { x: c.x, y: c.y + 0.4, z: c.z });
      for (const p of f.players()) {
        if (Math.abs(flat(p.location, c) - r) > 1.6 || !p.isOnGround) continue;
        hurt(p, damage, "magic");
        shove(p, p.location.x - c.x, p.location.z - c.z, 1, 0.4);
      }
    });
  }
}

const canSwing = stageIs(0, 6);

registerBoss({
  id: "morvane", type: MORVANE.type, name: "Morvane", radius: MORVANE.radius, points: MORVANE.points,
  noTemper: true, // a story fight, fought once: it has its own seven shapes
  intro: "rises from the Seat. \"You came all this way to sit down.\"",
  attacks: [
    // Stages 1 and 7: two blows, then the Toll
    { id: "toll", every: 40, windup: 30, rest: 40, warn: "The third blow is the Toll. Jump the ring!", sound: "block.bell.hit",
      when: (f) => canSwing(f) && (f.m.s.blows ?? 0) >= 2,
      hit: (f) => { f.m.s.blows = 0; tollRing(f, dmg(f, 9)); } },
    { id: "blow", every: 70, windup: 30, rest: 10, warn: "Morvane draws back his blade. Step away!",
      when: canSwing,
      start: (f) => { const t = f.target(); return t ? { x: t.location.x, y: t.location.y, z: t.location.z } : undefined; },
      show: (f, at) => at && ring(f.dim, at, 3.2, "minecraft:redstone_wire_dust_particle", 16),
      hit: (f, at) => {
        f.m.s.blows = (f.m.s.blows ?? 0) + 1;
        if (!at) return;
        moveTo(f, at);
        for (const p of f.players()) if (flat(p.location, at) <= 3.2) hurt(p, dmg(f, 10), "entityAttack", f.entity);
      } },
    { id: "blink", every: 180, windup: 30, rest: 20, warn: "He is gone. Move, he comes up behind you!", sound: "mob.endermen.portal",
      when: canSwing,
      start: (f) => {
        const ps = f.players();
        const t = ps.find((p) => p.id === f.m.lastHit) ?? ps[0];
        if (!t) return undefined;
        effect(f.entity, "invisibility", 30, 0);
        return { id: t.id, at: { ...t.location } };
      },
      hit: (f, c) => {
        const t = c && f.players().find((p) => p.id === c.id);
        if (!t) return;
        const v = t.getViewDirection();
        particle(f.dim, "siege:vein_spark", f.entity.getHeadLocation()); // where he was
        moveTo(f, { x: t.location.x - v.x * 1.6, y: t.location.y, z: t.location.z - v.z * 1.6 }, { facingLocation: t.location });
        particle(f.dim, "siege:vein_spark", f.entity.getHeadLocation()); // where he is
        if (flat(t.location, c.at) < 3) hurt(t, dmg(f, 10), "entityAttack", f.entity);
      } },
    { id: "tollmen", every: 600, windup: 20, warn: "The Crown tolls. Tollmen answer!", sound: "block.bell.hit",
      when: (f) => stageIs(0)(f) && f.adds().length < 8,
      hit: (f) => f.summon("siege:hollow_footman", per(f, 2, 1), 6) },

    // Stage 4: he comes up out of the river to strike, and is only open while he is up
    { id: "surface", every: 120, windup: 30, rest: 10, warn: "The water bulges under you. Get clear!", sound: "mob.elderguardian.curse",
      when: (f) => stageIs(3)(f) && !f.m.s.up,
      start: (f) => { const t = f.target(); return t ? { x: t.location.x, y: t.location.y, z: t.location.z } : undefined; },
      show: (f, at) => at && ring(f.dim, at, 3, "minecraft:water_splash_particle_manual", 18),
      hit: (f, at) => {
        if (!at) return;
        try { f.entity.teleport(at); } catch { /* blocked */ }
        hide(f, false); freeze(f.entity, false);
        f.m.s.up = f.tick + MORVANE.river.up;
        for (const p of f.players()) {
          if (flat(p.location, at) > 3) continue;
          hurt(p, dmg(f, 10), "entityAttack", f.entity);
          shove(p, p.location.x - at.x, p.location.z - at.z, 1.4, 0.5);
        }
        f.bar("§dHe is up. Hit him before he goes under!");
      } },

    // Stage 5: at the Rift he fights like a siege
    { id: "lance", every: 120, windup: 30, warn: "Morvane levels his blade. Sidestep!", when: stageIs(4, 6),
      ...lance(18, 10, (f, c) => {
        const reach = Math.max(0, c.reach - 4);
        moveTo(f, { x: c.from.x + c.dir.x * reach, y: c.from.y, z: c.from.z + c.dir.z * reach });
      }) },
    { id: "quake", every: 200, windup: 30, rest: 30, warn: "The ground heaves. Be in the air!", sound: "mob.ravager.roar",
      when: stageIs(4),
      hit: (f) => {
        ring(f.dim, f.entity.location, 12, "minecraft:large_explosion", 24);
        for (const p of f.players()) if (p.isOnGround && flat(p.location, f.entity.location) <= 12) hurt(p, dmg(f, 9), "magic");
      } },

    // Stage 7: the blow that leaves him open
    { id: "overhead", every: 240, windup: 30, rest: 10, warn: "He lifts the blade over his head. Get out from under it!", sound: "mob.wither.shoot",
      // Only once he is down to the line, so striking the Crown off is the finishing move (Mateo 2026-11-13)
      when: (f) => stageIs(6)(f) && f.m.s.crowned && f.hp() <= MORVANE.crown.shieldAt,
      start: (f) => { const t = f.target(); return t ? { x: t.location.x, y: t.location.y, z: t.location.z } : undefined; },
      show: (f, at) => at && ring(f.dim, at, 4, "minecraft:redstone_wire_dust_particle", 20),
      hit: (f, at) => {
        if (!at) return;
        moveTo(f, at);
        for (const p of f.players()) if (flat(p.location, at) <= 4) hurt(p, dmg(f, 14), "entityAttack", f.entity);
        f.m.s.stagger = f.tick + 80; f.m.s.hits = 0;
        f.stun(80); if (f.hp() > MORVANE.crown.shieldAt) f.shield(false);
        f.say("§dThe blade bites the floor and sticks. He staggers. Strike the Crown!");
      } },
  ],

  onStart: (f, fresh) => {
    if (f.m && !fresh) return;
    // The real fight is the one on the Seat. (After a reload he may be standing in any of its places: send him home.)
    let atSeat = false, lost = false;
    try {
      const rift = overworldStage();
      atSeat = (f.dim.id === UNDERTOW_ID && (flat(f.center, SEAT.center) < 40 || !fresh)) || (!fresh && !!rift && f.dim.id.endsWith("overworld") && flat(f.center, rift.arrival) < 80);
      lost = atSeat && !(f.dim.id === UNDERTOW_ID && flat(f.center, SEAT.center) < 40);
    } catch { /* arenas unavailable: fight where he stands */ }
    const home = f.m?.home ?? (atSeat ? { dimension: UNDERTOW_ID, center: seatCentre() } : { dimension: f.dim.id, center: { ...f.center } });
    // whoever is standing there when he rises is in the fight from his first word (his opening line used to be said to nobody)
    const here = new Set([...(f.m?.party ?? []), ...f.players().map((p) => p.id)]);
    f.m = { home, atSeat, party: here, down: new Set(), tries: {}, wind: {}, stage: 0, s: {}, started: 0, away: lost, floorGone: f.m?.floorGone };
    if (atSeat) { try { requestPockets(); } catch { /* arenas unavailable */ } }
    enter(f, 0, { quiet: true, restart: lost });
  },

  // After he falls, point the way on: the Deep Door under the Court opens now (after/deep.js)
  onDeath: (f, players) => {
    system.runTimeout(() => {
      for (const p of players) {
        try { p.sendMessage("§8Far off, under the Court, in the Vault of the Hollow, a seal that has hummed one note for three hundred years goes quiet. The Deep Door will open now."); } catch { /* gone */ }
      }
    }, 260);
  },

  // The framework's own reset (everyone walked away): put him back on the Seat
  onReset: (f) => {
    const h = f.m?.home;
    if (!h) return;
    try {
      const dim = world.getDimension(h.dimension);
      f.moveTo(dim, h.center, undefined);
      f.entity.teleport(h.center, { dimension: dim });
    } catch { /* unloaded */ }
    f.m.away = false; f.m.party = new Set();
  },

  // Everyone is down: hold the fight, then restart the stage (or the whole thing)
  whileEmpty: (f) => {
    const m = f.m;
    if (!m) return false;
    if (m.scene) return true; // the reveal is playing
    const ps = party(f);
    if (!ps.length || !ps.every((p) => m.down.has(p.id))) return false; // they left: the usual reset applies
    if (ps.some((p) => healthOf(p).now <= 0)) return true; // still on the death screen
    m.wipeAt ??= f.tick + 60;
    if (f.tick < m.wipeAt) return true;
    wipe(f, ps);
    return true;
  },

  // He came out of a move as a new entity, or has not loaded yet: find him where the fight now is
  onLost: (f) => {
    try {
      const found = f.dim.getEntities({ type: MORVANE.type, location: f.center, maxDistance: 96 }).find((e) => !e.hasTag("siege_showcase"));
      if (found) rebind(f, found);
    } catch { /* not loaded yet */ }
  },

  onStruck: (f, attacker) => {
    if (attacker?.typeId !== "minecraft:player" || !f.m) return;
    f.m.lastHit = attacker.id;
    const s = f.m.s;
    if (f.m.stage !== 6) return;
    if (s.crowned && (s.stagger ?? 0) > f.tick) {
      s.hits++;
      sound(f.dim, "block.bell.hit", f.entity.location, 1.8, 0.6);
      if (s.hits >= crownHitsNeeded(f.players().length)) uncrown(f);
    } else if (!s.crowned) {
      s.reach = Math.min(s.reach + MORVANE.crown.delayPerHit, s.uncrownedAt + MORVANE.crown.maxReach);
    }
  },

  // Stage 2: touching a suit that is still standing to attention
  onPropHit: (f, prop, player) => {
    const s = f.m?.s;
    if (f.m?.stage !== 1 || prop.typeId !== MORVANE.suit || s.open || s.awake?.has(prop.id)) return;
    if (prop.id === s.trueId) return foundHim(f, prop);
    s.awake.add(prop.id);
    freeze(prop, false);
    effect(prop, "speed", 600, 0);
    hurt(player, dmg(f, 6), "magic");
    player.onScreenDisplay.setActionBar("§cEmpty. And now it is awake.");
  },

  tick: (f, players) => {
    const m = f.m;
    if (!m || m.moving) return;
    for (const p of players) m.party.add(p.id);
    keepFooting(f);
    const st = STAGES[m.stage];
    if (!m.raged && f.tick - m.started > st.limit && !st.memory) {
      m.raged = true;
      effect(f.entity, "speed", 100000, 1); effect(f.entity, "strength", 100000, 1);
      f.say("§4You have taken too long. He stops holding back.");
    } else if (!m.raged && m.stage === 2 && f.tick - m.started > st.limit) m.raged = true;
    TICK[m.stage]?.(f, players);
    if (f.m.stage === m.stage && gateReached(m.stage, f.hp())) {
      if (m.stage === 4) { speak(f, "\"Not here. Not under this sky.\" The ground opens and takes all of you back down."); voice(f, "stage_sky_out"); }
      advance(f);
    }
  },

  // Knights take his oath-blade, the Marked take the mantle. (No path yet: the blade.)
  loot: (f, p, first) => (first ? [stack(heroOf(p).path === "marked" ? "siege:crownless_mantle" : "siege:oath_of_oswin")] : [])
    .concat([stack("siege:hollow_ash", first ? 16 : 6), stack("minecraft:diamond", first ? 4 : 1)]),
  hoard: (f, players) => [stack("minecraft:netherite_ingot", 2 + players.length), stack("siege:gold_coin", 8), stack("minecraft:diamond", 8 + players.length), stack("minecraft:enchanted_golden_apple", 2)],
});

// One of his stage 6 lines, to each player by name
function sayFall(f, i) {
  const line = REVEAL.fall?.[i];
  if (!line) return;
  for (const p of party(f)) { try { p.sendMessage(`§3"${line.replace(/\{name\}/g, p.name)}"`); } catch { /* offline */ } }
  voice(f, `fall_${i + 1}`);
}

// His spoken voice for a line the fight has just printed (lore/morvane_voice.js plays it, if it is recorded)
function voice(f, id, delay = 0) {
  emit("morvaneSays", { players: party(f), id, delay });
}

// ---------- the reveal ----------
// Between the Fall and the last stage: the staged scene in reveal.js (camera taken, controls locked, about a minute).
// The fight holds still while it plays, follows the players to the room, and stage 7 begins when it ends.
function reveal(f) {
  const m = f.m;
  if (m.scene) return;
  m.scene = true; m.moving = true;
  sayFall(f, 5);
  f.timers = []; f.zones = [];
  let went = false;
  playReveal(party(f).filter((p) => healthOf(p).now > 0), {
    dim: f.dim, center: f.center, openGround: !m.away,
    onStage: (stage) => {
      if (!stage.park) return;
      went = true;
      holdGround(f, true); // the players are about to be taken to the room: keep him loaded until he has followed
      f.moveTo(stage.dim, stage.park, 48);
      sendBoss(f, stage.park, stage.dim, 1);
    },
    done: () => {
      m.scene = false; m.moving = false;
      if (went) m.away = true;
      enter(f, 6);
    },
  });
}

// ---------- the fallen wait ----------
world.afterEvents.entityDie.subscribe((event) => {
  const dead = event.deadEntity;
  if (dead.typeId !== "minecraft:player") return;
  const f = fightOf("morvane");
  if (!f?.m?.party.has(dead.id)) return;
  f.m.down.add(dead.id);
  try {
    dead.sendMessage(f.m.party.size > 1 ? "§7You are out of it until he moves on. The others fight without you." : "§7He waits.");
  } catch { /* gone */ }
});

world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
  if (initialSpawn) return;
  const f = fightOf("morvane");
  if (!f?.m?.down.has(player.id)) return;
  const place = placeFor(f, f.m.stage);
  if (!place.gate) return; // no waiting place built yet: they wait wherever they woke
  try { player.teleport(place.gate, { dimension: place.dim }); } catch { /* not loaded */ }
});

// ---------- starting, places and testing by script event ----------
system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id === "siege:morvane_place") {
    // {"key":"river","dimension":"siege:undertow","center":{x,y,z},"radius":24,...}
    try { const p = JSON.parse(event.message); setMorvanePlace(p.key, p); } catch { /* bad message */ }
    return;
  }
  if (event.id === "siege:morvane_skip") {
    const f = fightOf("morvane"), n = Math.max(1, Math.min(STAGES.length, parseInt(event.message) || 1)) - 1;
    if (f?.m) { setHp(f.entity, STAGES[n].from); enter(f, n); }
    return;
  }
  // The Hollow build thread says someone has stepped onto the Seat with the Choir dead (and the throne empty)
  if (event.id !== "siege:undertow_arena_ready" || !event.message.includes("morvane")) return;
  if (fightOf("morvane")) return;
  try {
    const seat = places.seat;
    const dim = world.getDimension(seat?.dimension ?? UNDERTOW_ID);
    if (dim.getEntities({ type: MORVANE.type }).some((e) => !e.hasTag("siege_showcase"))) return;
    startBoss("morvane", dim, seat?.center ?? seatCentre());
  } catch (e) {
    console.warn(`[Bestiary] Morvane could not rise: ${e}`);
  }
});

addTests("bestiary", {
  "Morvane has seven stages and his health only ever goes down through them": () => {
    assertEqual(STAGES.length, 7);
    for (let i = 1; i < STAGES.length; i++) assertEqual(STAGES[i].from, STAGES[i - 1].to, `stage ${i + 1} starts where ${i} ended`);
    assertEqual(STAGES[0].from, 1);
    assertEqual(STAGES[6].to, 0);
    assert(STAGES[2].memory && STAGES[5].memory, "the two memories do not touch his health");
  },
  "a wipe restarts the stage twice, then the whole fight": () => {
    assertEqual(wipeTarget(4, 1), 4);
    assertEqual(wipeTarget(4, 2), 4);
    assertEqual(wipeTarget(4, 3), 0);
    assertEqual(wipeTarget(0, 9), 0);
  },
  "he is dragged on at each gate, but never by a memory and never out of the last stage": () => {
    assert(gateReached(0, 0.84) && !gateReached(0, 0.9));
    assert(!gateReached(2, 0.1), "the Night ends when the court is beaten");
    assert(!gateReached(5, 0.1), "the Fall ends on its timer");
    assert(gateReached(4, 0.38), "he cannot die at the Rift: he is dragged back first");
    assert(!gateReached(6, 0), "the last stage ends when he dies");
  },
  "the ranks and the Crown grow with the party": () => {
    assertEqual(suitCount(1), 6);
    assertEqual(suitCount(3), 10);
    assertEqual(suitCount(1, 2), 10);
    assertEqual(suitCount(10, 5), 14);
    assertEqual(crownHitsNeeded(1), 5);
    assertEqual(crownHitsNeeded(4), 11);
  },
  "he lands on floor near you, never in the air or over the void (Mateo 2026-11-12)": () => {
    const floor = (x, y, z) => (y <= 119 && Math.hypot(x, z) <= 30 ? "solid" : "open"); // a disc, void round it
    const to = footingNear({ x: 3.5, y: 126, z: 0.5 }, floor); // a player hovering 6 over the Seat
    assert(to && to.y === 120, "he comes down onto the floor under a flying player");
    assert(footingNear({ x: 40.5, y: 120, z: 0.5 }, floor) === undefined, "past the edge there is nowhere: he stays put");
    assert(footingNear({ x: 3.5, y: 140, z: 0.5 }, floor) === undefined, "far above the floor: he does not jump up after you");
    assert(footingNear({ x: 3.5, y: 120, z: 0.5 }, () => undefined) === undefined, "not loaded: stays put");
    const layered = (x, y, z) => (y === 119 || y === 110 ? "solid" : "open"); // the floor, and rock 9 under it
    assert(footingNear({ x: 0.5, y: 120, z: 0.5 }, layered).y === 120, "on the top floor, not the rock under it");
    const slab = (x, y, z) => (y <= 120 ? "solid" : "open"); // you stand on a slab at 120: he lands on top of it
    assert(footingNear({ x: 0.5, y: 120.5, z: 0.5 }, slab).y === 121, "never inside the block you stand on");
    assert(footingNear({ x: 0.5, y: 120, z: 0.5 }, (x, y, z) => (y <= 119 ? "solid" : "liquid")) === undefined, "water is not room to land in");
  },
  "the Seat's floor falls from the outside in and leaves a last stand": () => {
    assertEqual(floorRings(32), [27, 22, 17, 12]);
    assert(finalePlace("seat").rings.length >= 3 && Math.min(...finalePlace("seat").rings) > SEAT.innerRadius, "the Seat keeps its last stand");
    assertEqual(floorRings(10), []);
    assertEqual(spreadSpots({ x: 0, y: 5, z: 0 }, 4, 6).length, 4);
    assertEqual(spreadSpots({ x: 0, y: 5, z: 0 }, 2, 6)[0], { x: 6.5, y: 5, z: 0.5 });
  },
  "no line before the Fall says who he was": () => {
    const early = [0, 1, 2, 3, 4, 6].map((n) => String(SETUP[n])).join(" ") + String(TICK[2]) + String(TICK[4]);
    assert(!/oswin|\bking\b/i.test(early), "an early stage names him");
    assert(REVEAL.fall?.length === 6, "six lines for the Fall");
    assert(!/oswin/i.test(REVEAL.fall.join(" ")), "in the Fall he may say he was a king (Mateo), but never the name");
  },
});
