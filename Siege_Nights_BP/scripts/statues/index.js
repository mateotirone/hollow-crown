// The Faceless statues (entity siege:faceless_statue, models by studio/statues/build_statues.py).
//
// Mateo, 2026-11-13: the forty statues of King Oswin are 3D figures on block plinths, not built blocks. The map bakes
// the plinths; this file stands each figure on its plinth the first time a player comes near (spots_data.js, from
// map/statue-spots/*.json: 32 on Sunscar's avenue, 8 at the Faceless Gate). Statues have no AI and can't be hit,
// pushed or broken; a core of barrier blocks inside each one stops anyone walking through it. The Gate's 8 wait until
// the Faceless Vault's precinct is built (unlocks/seneschal.js lays their plinths with it). A figure is never stood
// on a plinth that still carries an old block statue (until the map is restamped), so nothing doubles up.
//
// Commands (creative):
//   /scriptevent siege:statue_status                        how many stand, and which spots are still blocked
//   /scriptevent siege:statue <age> [hold] [wear] [size]    stand one in front of you (age boy|youth|young_king|king|old_king,
//                                                           hold folded|staff|sword|bowl, wear whole|headless|armless|stump|fallen)
//   /scriptevent siege:statue_row                           every age and every break in a row in front of you
//   /scriptevent siege:statue_clear                         take away the statues within 48 blocks (the map's come back)

import { world, system, GameMode } from "@minecraft/server";
import { addTests, assert, assertEqual } from "../core/tests.js";
import { onTick } from "../core/loop.js";
import { mapMode } from "../plots/api.js";
import { siteBuilt } from "../unlocks/site.js";
import { SPOTS } from "./spots_data.js";
import { CORE } from "./model_data.js";

export const STATUE = "siege:faceless_statue";
export const AGES = ["boy", "youth", "young_king", "king", "old_king"];
export const HOLDS = ["folded", "staff", "sword", "bowl"];
export const WEARS = ["whole", "headless", "armless", "stump", "fallen"];
const YAW = { s: 0, w: 90, n: 180, e: -90 };
const STEP = { s: [0, 1], w: [-1, 0], n: [0, -1], e: [1, 0] }; // the way each facing looks
const NEAR = 72; // a statue is stood once a player is this close
const TAG = "siege_statue";
const TEST_TAG = "siege_statue_test";
const BARRIER = "minecraft:barrier";
const PLINTH_H = 2;
// Spots whose plinths the game itself lays as part of an unlock site: wait until that site is built
const AFTER_SITE = { faceless_gate: "seneschal" };

export const yawOf = (face) => YAW[face] ?? 0;

// Pure: the barrier boxes inside a statue standing at (x, y, z) (y = the block its feet are in), [x0, y0, z0, x1, y1, z1]
// inclusive. The skirt's width up to the shoulders (to the knees for a stump), one column on up through the head, and
// for a fallen one a row along its length on the ground. Every box stays inside the figure.
export function coreBoxes({ age, wear, size, face }, x, y, z) {
  const c = CORE[age];
  if (!c) return [];
  const b = (px) => (px * size) / 16; // model pixels -> blocks
  const half = Math.max(0, Math.floor(b(c.half) - 0.35));
  const deep = Math.max(0, Math.floor(b(c.depth) - 0.35));
  const [dx, dz] = STEP[face] ?? STEP.s;
  const across = dx !== 0 ? [deep, half] : [half, deep]; // [x half, z half]
  if (wear === "fallen") {
    const len = Math.max(1, Math.floor(b(c.top)) - 1);
    const hx = -dx * len, hz = -dz * len; // the head lies away from the way it faced
    return [[Math.min(x, x + hx), y, Math.min(z, z + hz), Math.max(x, x + hx), y, Math.max(z, z + hz)]];
  }
  const up = wear === "stump" ? Math.floor(b(c.knee)) : Math.floor(b(c.shoulder)) - 1;
  const boxes = [[x - across[0], y, z - across[1], x + across[0], y + Math.max(0, up - 1), z + across[1]]];
  if (wear !== "stump" && wear !== "headless") boxes.push([x, y + up, z, x, y + Math.floor(b(c.top)) - 2, z]);
  return boxes;
}

// ---------------------------------------------------------------- the world

const SOFT = /air|leaves|grass(?!_block)|fern|flower|bush|snow_layer|vine|sapling|dead_bush|torch|barrier|light_block/;
function solidTop(dim, x, z) {
  let b;
  try { b = dim.getTopmostBlock({ x, z }); } catch { return undefined; }
  let y = b?.location?.y;
  if (y === undefined) return undefined;
  for (let i = 0; i < 64; i++, y--) {
    const here = dim.getBlock({ x, y, z });
    if (!here) return undefined;
    if (!here.isAir && !here.isLiquid && !SOFT.test(here.typeId)) return y;
  }
  return undefined;
}

// Where the figure's feet go, or { blocked } when an old block statue still stands on the plinth (or lies there)
function standAt(dim, s) {
  if (s.y !== undefined) return { y: s.y + 1 };
  const top = solidTop(dim, s.x, s.z);
  if (top === undefined) return undefined;
  const off = s.plinth > 0 ? s.plinth + 1 : 6;
  const around = [[off, 0], [-off, 0], [0, off], [0, -off]].map(([a, b]) => solidTop(dim, s.x + a, s.z + b)).filter((v) => v !== undefined);
  if (!around.length) return undefined;
  const ground = Math.min(...around);
  if (top - ground > (s.plinth > 0 ? PLINTH_H + 2 : 2)) return { blocked: true };
  return { y: top + 1 };
}

function setCore(dim, spot, at, fill) {
  for (const [x0, y0, z0, x1, y1, z1] of coreBoxes(spot, at.x, at.y, at.z)) {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
      try {
        const here = dim.getBlock({ x, y, z });
        if (!here) continue;
        if (fill && here.isAir) here.setType(BARRIER);
        else if (!fill && here.typeId === BARRIER) here.setType("minecraft:air");
      } catch { /* unloaded */ }
    }
  }
}

export function standStatue(dim, spot, at, tags = []) {
  const e = dim.spawnEntity(STATUE, { x: at.x + 0.5, y: at.y, z: at.z + 0.5 });
  e.setProperty("siege:age", Math.max(0, AGES.indexOf(spot.age)));
  e.setProperty("siege:hold", Math.max(0, HOLDS.indexOf(spot.hold)));
  e.setProperty("siege:wear", Math.max(0, WEARS.indexOf(spot.wear)));
  e.setProperty("siege:size", spot.size);
  e.teleport({ x: at.x + 0.5, y: at.y, z: at.z + 0.5 }, { dimension: dim, rotation: { x: 0, y: yawOf(spot.face) } });
  for (const t of [TAG, ...tags]) e.addTag(t);
  e.setDynamicProperty("siege:statue", JSON.stringify({ ...spot, at }));
  setCore(dim, spot, at, true);
  return e;
}

function removeStatue(e) {
  try {
    const d = JSON.parse(e.getDynamicProperty("siege:statue") ?? "null");
    if (d?.at) setCore(e.dimension, d, d.at, false);
  } catch { /* no record */ }
  e.remove();
}

const standing = new Set(); // spot ids seen standing this session
const blocked = new Set();  // spot ids with an old block statue still on them
let queue = [], busy = false;

const loadedAt = new Map(); // spot id -> tick its ground was first seen loaded (entities can arrive a moment after blocks)
function present(dim, id) {
  let found = [];
  try { found = dim.getEntities({ type: STATUE, tags: [`${TAG}_${id}`] }); } catch { return false; }
  for (const extra of found.slice(1)) extra.remove(); // never two on one plinth
  return found.length > 0;
}

function work() {
  if (busy || !queue.length) return;
  busy = true;
  const dim = world.getDimension("overworld");
  system.runJob((function* () {
    while (queue.length) {
      const s = queue.shift();
      try {
        if (!dim.getBlock({ x: s.x, y: 64, z: s.z })) { loadedAt.delete(s.id); continue; } // not loaded: queued again later
        if (!loadedAt.has(s.id)) loadedAt.set(s.id, system.currentTick);
        if (system.currentTick - loadedAt.get(s.id) < 60) continue; // give its entities time to load first
        if (present(dim, s.id)) { standing.add(s.id); continue; }
        const at = standAt(dim, s);
        yield;
        if (!at) continue;
        if (at.blocked) { blocked.add(s.id); continue; }
        blocked.delete(s.id);
        standStatue(dim, s, { x: s.x, y: at.y, z: s.z }, [`${TAG}_${s.id}`]);
        standing.add(s.id);
      } catch (e) {
        console.warn(`[Hollow Crown] statues: ${s.id}: ${e}`);
      }
      yield;
    }
    busy = false;
  })());
}

function check() {
  if (!mapMode() || busy) return;
  const players = world.getAllPlayers().filter((p) => p.dimension.id === "minecraft:overworld");
  if (!players.length) return;
  for (const s of SPOTS) {
    if (standing.has(s.id) || queue.includes(s)) continue;
    if (AFTER_SITE[s.site] && !siteBuilt(AFTER_SITE[s.site])) continue;
    if (players.some((p) => Math.hypot(p.location.x - s.x, p.location.z - s.z) < NEAR)) queue.push(s);
  }
  work();
}
onTick("statues", 100, () => check());

// ---------------------------------------------------------------- commands

function inFront(player, dist) {
  const v = player.getViewDirection(); const l = Math.hypot(v.x, v.z) || 1;
  return { x: Math.floor(player.location.x + (v.x / l) * dist), y: Math.floor(player.location.y), z: Math.floor(player.location.z + (v.z / l) * dist), dx: v.x / l, dz: v.z / l };
}
const faceToward = (dx, dz) => (Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? "w" : "e") : dz > 0 ? "n" : "s"); // looking back at the player

system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity: player }) => {
  if (!id.startsWith("siege:statue") || player?.typeId !== "minecraft:player") return;
  const args = (message ?? "").trim().split(/\s+/).filter(Boolean);
  if (id === "siege:statue_status") {
    const near = SPOTS.filter((s) => Math.hypot(player.location.x - s.x, player.location.z - s.z) < NEAR);
    return player.sendMessage(`§7Faceless statues: §f${standing.size}§7 of ${SPOTS.length} standing this session, ${blocked.size} blocked by an old block statue` +
      (blocked.size ? ` (${[...blocked].slice(0, 6).join(", ")}${blocked.size > 6 ? "…" : ""}: the map needs restamping there)` : "") +
      `, ${near.length} spots near you.`);
  }
  if (player.getGameMode() !== GameMode.Creative) return player.sendMessage("§cOnly a builder in creative can do that.");
  const dim = player.dimension;
  if (id === "siege:statue_clear") {
    let n = 0;
    for (const e of dim.getEntities({ type: STATUE, location: player.location, maxDistance: 48 })) { removeStatue(e); n++; }
    standing.clear();
    return player.sendMessage(`§aTook away ${n} statue${n === 1 ? "" : "s"}. The map's own come back when you are near them again.`);
  }
  if (id === "siege:statue_row") {
    const f = inFront(player, 8); const face = faceToward(f.dx, f.dz); const [ax, az] = [-f.dz, f.dx]; // along the row
    const row = [...AGES.map((age, i) => ({ age, hold: HOLDS[i % 4], wear: "whole" })), ...WEARS.slice(1).map((wear) => ({ age: "king", hold: "staff", wear }))];
    row.forEach((r, i) => {
      const k = (i - (row.length - 1) / 2) * 6;
      standStatue(dim, { ...r, size: 3, face }, { x: Math.round(f.x + ax * k), y: f.y, z: Math.round(f.z + az * k) }, [TEST_TAG]);
    });
    return player.sendMessage(`§aStood ${row.length} statues at size 3: the five ages, then headless, armless, stump and fallen. /scriptevent siege:statue_clear takes them away.`);
  }
  if (id === "siege:statue") {
    const [age = "king", hold = "folded", wear = "whole", size = "3"] = args;
    if (!AGES.includes(age) || !HOLDS.includes(hold) || !WEARS.includes(wear) || !(Number(size) >= 0.5 && Number(size) <= 12)) {
      return player.sendMessage(`§cUse: /scriptevent siege:statue <${AGES.join("|")}> [${HOLDS.join("|")}] [${WEARS.join("|")}] [size 0.5-12]`);
    }
    const f = inFront(player, 4 + Number(size));
    standStatue(dim, { age, hold, wear, size: Number(size), face: faceToward(f.dx, f.dz) }, f, [TEST_TAG]);
    return player.sendMessage(`§aA ${age.replace("_", " ")} statue (${hold}, ${wear}, size ${size}).`);
  }
});

// ---------------------------------------------------------------- self-tests

addTests("statues", {
  "statues: forty spots, every one a real age, hold and break, each id once": () => {
    assertEqual(SPOTS.length, 40);
    assertEqual(new Set(SPOTS.map((s) => s.id)).size, SPOTS.length);
    for (const s of SPOTS) {
      assert(AGES.includes(s.age) && HOLDS.includes(s.hold) && WEARS.includes(s.wear), s.id);
      assert(s.face in YAW && s.size >= 0.5 && s.size <= 12 && Number.isInteger(s.x) && Number.isInteger(s.z), s.id);
      assert(s.wear === "fallen" ? s.plinth === 0 : s.plinth >= 2, `${s.id}: a standing statue has a plinth`);
    }
    assertEqual(SPOTS.filter((s) => s.site === "sunscar").length, 32);
    assertEqual(SPOTS.filter((s) => s.site === "faceless_gate").length, 8);
    for (const age of AGES) assert(CORE[age], `model data for ${age}`);
  },
  "statues: facing turns the figure the right way (yaw 0 south, 90 west)": () => {
    assertEqual([yawOf("s"), yawOf("w"), yawOf("n"), yawOf("e")], [0, 90, 180, -90]);
  },
  "statues: the barrier core stays inside the figure, and a stump's and a fallen one's stay low": () => {
    const box = (age, wear, face = "s", size = 5) => coreBoxes({ age, wear, size, face }, 0, 70, 0);
    const [king] = box("king", "whole");
    assertEqual([king[0], king[3]], [-1, 1]); // 3 wide at size 5
    assert(king[4] <= 70 + 9 && king[4] >= 70 + 6, `king core to the shoulders, got top ${king[4]}`);
    const [boy] = box("boy", "whole");
    assertEqual([boy[0], boy[3]], [0, 0]); // a boy's is one column
    assert(box("king", "stump")[0][4] <= 70 + 4 && box("king", "stump").length === 1);
    assertEqual(box("king", "headless").length, 1);
    const [lie] = box("old_king", "fallen", "s", 7.3);
    assertEqual([lie[1], lie[4]], [70, 70]);
    assert(lie[2] < -15 && lie[5] === 0 && lie[0] === 0 && lie[3] === 0, "a fallen one's head lies to the north when it faced south");
    for (const s of SPOTS) {
      for (const [x0, y0, z0, x1, y1, z1] of coreBoxes(s, s.x, 70, s.z)) {
        assert(x0 <= x1 && y0 <= y1 && z0 <= z1, s.id);
        if (s.wear !== "fallen") assert(Math.max(x1 - s.x, s.x - x0, z1 - s.z, s.z - z0) < s.plinth, `${s.id}: core inside its plinth`);
      }
    }
  },
});
