// Living clocks (Mateo 2026-11-15: "clock entities that follow the game time, and in weird cases can stop or go
// backwards"). Design page: https://claude.ai/artifact/BUhnhHSW428pfzrDp8EPbe
//
// Every clock is a siege:clock entity standing in the air cell in front of its face, on an invisible clock mount
// (siege:clock_anchor: its states say the size 1/3/5/7, the face style, the habit and the way it looks). The
// building engine puts the mount there (the skill's clock_face part); this file stands the clock on it and keeps
// it there. The hands are turned on the client from the game's time of day, so a running clock costs nothing: the
// server only writes a clock's properties when the story changes it (logic.js has the sum).
//
// How the game finds the mounts: a mount placed by a script, a command or a player tells us itself (its onPlace
// and its slow block tick); the ones baked into the map file are listed in spots_data.js (tools/clock_spots.mjs
// reads them from map/*-blocks.json), and features add their own (the Reeve's square: addClockSpots).
//
// For the story (import from "../clocks/index.js"):
//   holdClocks("3:17", { near, r, dim, strain, id })  stop on a minute (strain: the hand keeps trying for the next)
//   stopClocks(opts)        stop each clock on the minute it shows now
//   reverseClocks(opts)     carry on backwards from where each one is, at the game's pace
//   runClocks(opts)         carry on forwards from where each one is (after a stop or a backward run)
//   spinClocks(rate, opts)  race (or crawl) at `rate` game minutes per minute
//   stepClocks(by, opts)    jump by minutes (-1: every clock ticks one minute back), keeping its rate
//   releaseClocks(idOrOpts) undo changes (by id, or every change covering a place, or all with no argument);
//                           released clocks go back to the real time (or their own habit)
//   addClockRule(name, fn)  a feature owns some clocks: fn(spot) -> state | undefined (Millbrook's held minute)
//   refreshClocks()         a rule's answer changed: re-apply every loaded clock now
// opts: near { x, z } and r (default 64) limit it to one place; dim a dimension id; ticks = undo by itself after.
//
// Commands (Creative):
//   /scriptevent siege:clocks status            mounts known, clocks standing, story changes in force
//   /scriptevent siege:clocks here [style] [size] [habit]   a test clock on the block you look at (style vale..royal)
//   /scriptevent siege:clocks row               every face in a row on the wall you look at, size 3
//   /scriptevent siege:clocks hold 3:17 [strain] | stop | back | run | spin 40 | step -1   (all within 64 of you)
//   /scriptevent siege:clocks night             the 3:17 night beat here: stop at 3:17, a tick back, then backwards
//   /scriptevent siege:clocks clear             undo every story change near you

import { world, system, BlockPermutation, GameMode } from "@minecraft/server";
import { onTick } from "../core/loop.js";
import { on } from "../core/events.js";
import { moduleStore } from "../core/store.js";
import { addTests, assert, assertEqual } from "../core/tests.js";
import { STYLES, SIZES, YAW, MIN_317, minuteOfTicks, parseTime, fmt, shown, resolve, props, spotKey, transform, natural, covers } from "./logic.js";
import { SPOTS } from "./spots_data.js";

export const CLOCK = "siege:clock";
export const MOUNT = "siege:clock_anchor";
const TAG = "siege_clock";
const AT = "siege:clock_at"; // entity dynamic property: the mount it stands on, "x,y,z"
const HABIT = "siege:clock_habit"; // entity dynamic property: the mount's own habit
const NEAR = 80;             // clocks are stood once a player is this close to their mount
const MAX_SPOTS = 900;       // learned mounts kept in the save (about 20 characters each)

const store = moduleStore("siege:clocks", () => ({
  spots: [],   // learned mounts, "dim|x,y,z"
  changes: [], // story changes in force: { id, kind, minute|rate|by, strain, near, r, dim, T, until }
}));

const rules = []; // [{ name, fn }]
export function addClockRule(name, fn) {
  const i = rules.findIndex((r) => r.name === name);
  if (i >= 0) rules[i] = { name, fn }; else rules.push({ name, fn });
}

// ---------- the mounts ----------
const known = new Map(); // "dim|x,y,z" -> { x, y, z, dim }
let loadedSaved = false;
function learn(dim, x, y, z, save = true) {
  const k = `${dim}|${spotKey(x, y, z)}`;
  if (known.has(k)) return;
  known.set(k, { x, y, z, dim });
  if (!save) return;
  const d = store.data;
  if (!d.spots.includes(k)) {
    d.spots.push(k);
    if (d.spots.length > MAX_SPOTS) d.spots.splice(0, d.spots.length - MAX_SPOTS);
    store.save();
  }
}
function forget(dim, x, y, z) {
  const k = `${dim}|${spotKey(x, y, z)}`;
  known.delete(k);
  const i = store.data.spots.indexOf(k);
  if (i >= 0) { store.data.spots.splice(i, 1); store.save(); }
}
function loadSpots() {
  if (loadedSaved) return;
  loadedSaved = true;
  for (const [x, y, z] of SPOTS) learn("minecraft:overworld", x, y, z, false);
  for (const k of store.data.spots) {
    const [dim, xyz] = k.split("|");
    const [x, y, z] = xyz.split(",").map(Number);
    known.set(k, { x, y, z, dim });
  }
}
/** A feature's own mounts (world block positions), e.g. the Reeve's square once it is built or adopted. */
export function addClockSpots(list, dim = "minecraft:overworld") {
  for (const p of list) learn(dim, p.x, p.y, p.z);
}

/** What a mount block says about its clock. */
function mountInfo(block) {
  const st = (n, d) => { try { return block.permutation.getState(n) ?? d; } catch { return d; } };
  const style = st("siege:style", 0);
  return { size: st("siege:size", 1), style, habit: st("siege:habit", STYLES[style] === "hollow" ? 2 : 0), face: st("minecraft:cardinal_direction", "south") };
}

// ---------- the clocks ----------
const applied = new Map(); // entity id -> JSON of the props last written
function stateFor(x, y, z, dim, habit) {
  return resolve({ x, y, z, dim, habit }, { rules: rules.map((r) => r.fn), changes: store.data.changes });
}
function write(e, s) {
  const p = props(s);
  const key = JSON.stringify(p);
  if (applied.get(e.id) === key) return;
  for (const [k, v] of Object.entries(p)) e.setProperty(k, v);
  applied.set(e.id, key);
}
function standClock(dim, block) {
  const info = mountInfo(block);
  const { x, y, z } = block.location;
  const at = { x: x + 0.5, y, z: z + 0.5 };
  const e = dim.spawnEntity(CLOCK, at);
  e.setProperty("siege:style", Math.max(0, Math.min(6, info.style)));
  e.setProperty("siege:size", Math.max(1, info.size));
  e.teleport(at, { dimension: dim, rotation: { x: 0, y: YAW[info.face] ?? 0 } });
  e.addTag(TAG);
  e.setDynamicProperty(AT, spotKey(x, y, z));
  e.setDynamicProperty(HABIT, info.habit);
  write(e, stateFor(x, y, z, dim.id, info.habit));
  return e;
}
function clockOn(dim, x, y, z) {
  try {
    return dim.getEntities({ type: CLOCK, location: { x: x + 0.5, y, z: z + 0.5 }, maxDistance: 0.75 });
  } catch { return []; }
}
/** Make sure the mount at this block has exactly one clock on it. */
function ensure(dim, block) {
  const { x, y, z } = block.location;
  const found = clockOn(dim, x, y, z);
  for (const extra of found.slice(1)) try { extra.remove(); } catch { /* gone */ }
  if (found[0]) return found[0];
  return standClock(dim, block);
}

// A mount tells us itself when a script, a command or a player puts it down, and again every 10-20 s while loaded
system.beforeEvents.startup.subscribe((ev) => {
  ev.blockComponentRegistry?.registerCustomComponent("siege:clock", {
    onPlace({ block, dimension }) {
      system.run(() => { try { learn(dimension.id, block.location.x, block.location.y, block.location.z); ensure(dimension, block); } catch { /* not ready */ } });
    },
    onTick({ block, dimension }) {
      try { learn(dimension.id, block.location.x, block.location.y, block.location.z); ensure(dimension, block); } catch { /* not ready */ }
    },
  });
});

/** Re-apply every loaded clock's state (after a story change or a rule's answer changes). */
export function refreshClocks() {
  for (const dimId of new Set(world.getAllPlayers().map((p) => p.dimension.id))) {
    let list = [];
    try { list = world.getDimension(dimId).getEntities({ type: CLOCK }); } catch { continue; }
    for (const e of list) {
      try {
        const [x, y, z] = String(e.getDynamicProperty(AT) ?? "").split(",").map(Number);
        if (!Number.isFinite(x)) continue;
        write(e, stateFor(x, y, z, dimId, Number(e.getDynamicProperty(HABIT) ?? 0)));
      } catch { /* gone */ }
    }
  }
}

// The keeper: stand missing clocks near players, take away clocks whose mount is gone, let lapsed changes go
onTick("clocks", 100, () => {
  loadSpots();
  const T = system.currentTick;
  const d = store.data;
  const live = d.changes.filter((c) => !(c.until && c.until <= T));
  if (live.length !== d.changes.length) { d.changes = live; store.save(); refreshClocks(); }
  const players = world.getAllPlayers();
  if (!players.length) return;
  const byDim = new Map();
  for (const p of players) { try { (byDim.get(p.dimension.id) ?? byDim.set(p.dimension.id, []).get(p.dimension.id)).push(p.location); } catch { /* joining */ } }
  for (const [dimId, spots] of byDim) {
    let dim;
    try { dim = world.getDimension(dimId); } catch { continue; }
    let standing = [];
    try { standing = dim.getEntities({ type: CLOCK }); } catch { continue; }
    const on = new Set();
    for (const e of standing) {
      const k = String(e.getDynamicProperty(AT) ?? "");
      const [x, y, z] = k.split(",").map(Number);
      let b;
      try { b = Number.isFinite(x) ? dim.getBlock({ x, y, z }) : undefined; } catch { continue; } // unloaded: leave it
      if (Number.isFinite(x) && b === undefined) continue;
      if (!b || b.typeId !== MOUNT || on.has(k)) { try { e.remove(); } catch { /* gone */ } if (b && b.typeId !== MOUNT) forget(dimId, x, y, z); continue; }
      on.add(k);
    }
    let made = 0;
    for (const s of known.values()) {
      if (s.dim !== dimId || on.has(spotKey(s.x, s.y, s.z))) continue;
      if (!spots.some((p) => Math.hypot(p.x - s.x, p.z - s.z) <= NEAR)) continue;
      let b;
      try { b = dim.getBlock(s); } catch { continue; }
      if (!b) continue; // not loaded yet
      if (b.typeId !== MOUNT) { forget(dimId, s.x, s.y, s.z); continue; }
      try { standClock(dim, b); } catch { continue; }
      if (++made >= 12) break; // a few a pass, never a long tick
    }
  }
});

// ---------- the story's controls ----------
const nowMinute = () => { try { return Math.floor(minuteOfTicks(world.getTimeOfDay())); } catch { return 0; } };
let seq = 0;
function change(kind, fields, opts = {}) {
  const c = { id: opts.id ?? `c${system.currentTick}_${seq++}`, kind, ...fields, T: nowMinute() };
  if (opts.near) { c.near = { x: Math.round(opts.near.x), z: Math.round(opts.near.z) }; c.r = opts.r ?? 64; }
  if (opts.dim) c.dim = opts.dim;
  if (opts.ticks) c.until = system.currentTick + opts.ticks;
  const d = store.data;
  if (opts.id) d.changes = d.changes.filter((x) => x.id !== opts.id);
  d.changes.push(c);
  if (d.changes.length > 40) d.changes.splice(0, d.changes.length - 40);
  store.save();
  refreshClocks();
  return c.id;
}
export const holdClocks = (time, opts = {}) => change("hold", { minute: parseTime(time) ?? MIN_317, strain: !!opts.strain }, opts);
export const stopClocks = (opts) => change("rate", { rate: 0 }, opts);
export const reverseClocks = (opts) => change("rate", { rate: -1 }, opts);
export const runClocks = (opts) => change("rate", { rate: 1 }, opts);
export const spinClocks = (rate, opts) => change("rate", { rate }, opts);
export const stepClocks = (by, opts) => change("step", { by }, opts);
export function releaseClocks(which) {
  const d = store.data;
  const before = d.changes.length;
  if (which === undefined) d.changes = [];
  else if (typeof which === "string") d.changes = d.changes.filter((c) => c.id !== which);
  else if (which.near) d.changes = d.changes.filter((c) => !covers(c, which.near.x, which.near.z, which.dim));
  if (d.changes.length !== before) { store.save(); refreshClocks(); }
  return before - d.changes.length;
}
/** What a clock at this place shows right now (for dialogue, the Ledger, tests in game). */
export function clockReads(x, z, dim = "minecraft:overworld", habit = 0) {
  return fmt(shown(stateFor(x, 0, z, dim, habit), minuteOfTicks(world.getTimeOfDay())));
}

// ---------- commands ----------
const STEP = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };
const OPP = { north: "south", south: "north", east: "west", west: "east" };
function facingOf(player) {
  const r = player.getRotation().y; // yaw: 0 south, 90 west, 180/-180 north, -90 east
  const a = ((r % 360) + 360) % 360;
  return a < 45 || a >= 315 ? "south" : a < 135 ? "west" : a < 225 ? "north" : "east";
}
function mountPerm(face, style, size, habit) {
  return BlockPermutation.resolve(MOUNT, { "minecraft:cardinal_direction": face, "siege:style": style, "siege:size": size, "siege:habit": habit });
}
function testClock(player, style, size, habit, along = 0) {
  const hit = player.getBlockFromViewDirection({ maxDistance: 24 });
  if (!hit) return player.sendMessage("§7Look at a wall first.");
  const look = OPP[facingOf(player)]; // the clock looks back at you
  const [fx, fz] = STEP[look];
  const [ax, az] = [-fz, fx];
  const b = hit.block.location;
  const at = { x: b.x + fx + ax * along, y: b.y, z: b.z + fz + az * along };
  const dim = player.dimension;
  dim.getBlock(at)?.setPermutation(mountPerm(look, style, size, habit));
  learn(dim.id, at.x, at.y, at.z);
  return at;
}

system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity: player }) => {
  if (id !== "siege:clocks" || player?.typeId !== "minecraft:player") return;
  if (player.getGameMode() !== GameMode.Creative) return player.sendMessage("§7Clock commands are for Creative.");
  const [cmd = "status", a, b, c] = (message ?? "").trim().split(/\s+/);
  const here = { near: { x: player.location.x, z: player.location.z }, r: 64, dim: player.dimension.id };
  const say = (t) => player.sendMessage(t);
  loadSpots();
  switch (cmd) {
    case "status": {
      let standing = 0;
      try { standing = player.dimension.getEntities({ type: CLOCK }).length; } catch { /* none */ }
      return say(`§7Clocks: §f${known.size}§7 mounts known (${SPOTS.length} from the map), §f${standing}§7 clocks loaded here, §f${store.data.changes.length}§7 story changes in force. Game time ${fmt(nowMinute())}.`);
    }
    case "here": {
      const style = Math.max(0, STYLES.indexOf(a ?? "vale"));
      const size = SIZES.includes(Number(b)) ? Number(b) : 3;
      const at = testClock(player, style, size, Number(c) || (STYLES[style] === "hollow" ? 2 : 0));
      return at && say(`§7A ${STYLES[style]} clock, size ${size}, at ${at.x} ${at.y} ${at.z}.`);
    }
    case "row":
      STYLES.forEach((s, i) => testClock(player, i, 3, s === "hollow" ? 2 : 0, (i - 3) * 4));
      return say("§7Every face, size 3, on that wall.");
    case "hold": holdClocks(a ?? "3:17", { ...here, strain: b === "strain" }); return say(`§7Clocks near you held at ${fmt(parseTime(a ?? "3:17") ?? MIN_317)}.`);
    case "stop": stopClocks(here); return say("§7Clocks near you stopped.");
    case "back": reverseClocks(here); return say("§7Clocks near you run backwards.");
    case "run": runClocks(here); return say("§7Clocks near you run forwards from where they are.");
    case "spin": spinClocks(Number(a) || 40, here); return say(`§7Clocks near you race at ${Number(a) || 40}x.`);
    case "step": stepClocks(Number(a) || -1, here); return say(`§7Clocks near you jump ${Number(a) || -1} minute(s).`);
    case "night": {
      const opts = { ...here, id: "clocks_test_night" };
      holdClocks("3:17", opts);
      system.runTimeout(() => stepClocks(-1, { ...here, id: "clocks_test_night_step" }), 70);
      system.runTimeout(() => reverseClocks({ ...here, id: "clocks_test_night_back" }), 130);
      system.runTimeout(() => releaseClocks(here), 600);
      return say("§7The 3:17 night, here: they stop at 3:17, tick one back, run backwards, then let go after 30 s.");
    }
    case "clear": return say(`§7${releaseClocks(here)} story change(s) undone near you.`);
    default: return say("§7/scriptevent siege:clocks status | here [style] [size] [habit] | row | hold 3:17 [strain] | stop | back | run | spin N | step N | night | clear");
  }
});

// The showcase: every face on a stone post, a living clock each
on("showcase", ({ dim, nextSpot, label }) => {
  STYLES.forEach((style, i) => {
    const at = nextSpot();
    try {
      for (let dy = 0; dy <= 2; dy++) dim.getBlock({ x: at.x, y: at.y + dy, z: at.z })?.setType("minecraft:stone_bricks");
      const m = { x: at.x, y: at.y + 1, z: at.z - 1 };
      dim.getBlock(m)?.setPermutation(mountPerm("north", i, 1, style === "hollow" ? 2 : 0));
      learn(dim.id, m.x, m.y, m.z);
      label(at, `Living Clock\n${["Vale", "Frostmarch", "Saltreach", "Emberwaste", "Blackfen", "The Hollow", "Royal"][i]}`);
    } catch { /* the showcase carries on */ }
  });
});

// ---------- tests ----------
addTests("clocks", {
  "a live clock shows the time of day": () => {
    assertEqual(fmt(shown(natural(), 197)), "3:17");
    assertEqual(fmt(minuteOfTicks(21283)), "3:16"); // 21283 ticks is 3:16.98 (the toll reads 3:17 a moment later)
    assertEqual(fmt(minuteOfTicks(0)), "6:00");
  },
  "a stop holds the minute it showed, a reverse runs back from it": () => {
    const s = transform(natural(), { kind: "rate", rate: 0 }, 600);
    assertEqual(fmt(shown(s, 900)), "10:00");
    const b = transform(natural(), { kind: "rate", rate: -1 }, 600);
    assertEqual(fmt(shown(b, 610)), "9:50");
  },
  "the 3:17 night: hold, one tick back, then backwards": () => {
    const spot = { x: 0, y: 0, z: 0, dim: "minecraft:overworld", habit: 0 };
    const changes = [{ kind: "hold", minute: 197, T: 197 }, { kind: "step", by: -1, T: 198 }, { kind: "rate", rate: -1, T: 200 }];
    assertEqual(fmt(shown(resolve(spot, { changes: changes.slice(0, 1) }), 199)), "3:17");
    assertEqual(fmt(shown(resolve(spot, { changes: changes.slice(0, 2) }), 205)), "3:16");
    assertEqual(fmt(shown(resolve(spot, { changes }), 210)), "3:06");
  },
  "Harrowford's chapel clock stops at 3:17 until six in the evening": () => {
    const h = natural(1);
    assertEqual(fmt(shown(h, 150)), "2:30");
    assertEqual(fmt(shown(h, 600)), "3:17");
    assertEqual(fmt(shown(h, 1100)), "18:20");
  },
  "a Hollow clock runs backwards": () => {
    assertEqual(fmt(shown(natural(2), 60)), "23:00");
  },
  "a change near one place leaves clocks elsewhere alone": () => {
    const c = { kind: "rate", rate: 0, near: { x: 0, z: 0 }, r: 10, T: 100 };
    assert(covers(c, 3, 4));
    assert(!covers(c, 30, 4));
    assertEqual(resolve({ x: 30, z: 4, habit: 0 }, { changes: [c] }).rate, 1);
  },
  "a feature's rule wins over the clock's habit": () => {
    const rule = (s) => (s.x < 5 ? { base: 197, t0: 0, rate: 0, strain: true } : undefined);
    const s = resolve({ x: 0, z: 0, habit: 1 }, { rules: [rule] });
    assertEqual(fmt(shown(s, 800)), "3:17");
    assert(s.strain);
  },
});
