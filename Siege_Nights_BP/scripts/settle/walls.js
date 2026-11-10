// Settlement walls in the world. When a plot is claimed a Palisade rises in a ring round it, with a
// gate; the ring follows the ground. The wall has levels (walldata.js), each replacing the last on
// the same line. The town hall owns the upgrade menu, payment and fly-by; this file raises the wall.
//
// What other features can use:
//   wallOf(id) -> { x, y, z, radius, level, style, gate, building? } | undefined      id = owner (or "npc:<lord>")
//   wallRing(id) -> { x, y, z, radius, level, gate: { x, y, z, outside: { x, y, z } } }   for cameras and paths
//   wallCost(level) -> [[label, amount, match(itemTypeId)], ...]     same shape as the hall costs
//   raiseWall(id, level, { center?, style?, bearing? }) -> true | "why not"     does not charge
//   WALL_LEVELS, MAX_WALL (walldata.js)   wallCap(owner) -> highest level this settlement may raise
//   answers the town hall's "wallInfo" and "wallUpgrade" events (contract in townhall/flyby.js)
//   on("wallProgress", ({ id, level, done, total }))   on("wallBuilt", ({ id, level, first }))
// Test: /scriptevent siege:wall <1-10> [style]     raise that level round your keep (or where you stand)

import { world, system, BlockPermutation } from "@minecraft/server";
import { isReady, keepOf, tierOf, TIERS, onTick, moduleStore, on, emit, addFilter, addLandClaim, stoneId, STONE_KINDS, title } from "../siege/api.js";
import { STYLES } from "../townhall/styles.js";
import { PLOT_PLAN } from "../plots/config.js";
import { plotAt } from "../plots/claims.js";
import { WALLS, WALL_LEVELS, MAX_WALL, bearingToAngle, smoothGround, stationSpots, groundProblem, wallColumns, onWallLine, gateSpot, materialKind } from "./walldata.js";
import { styleOf } from "./plans.js";

const OVERWORLD = "minecraft:overworld";
const store = moduleStore("siege:settle_walls", () => ({ walls: {} }));
const walls = () => store.data.walls;
const save = () => store.save();

export const wallOf = (id) => walls()[id];
export function wallRing(id) {
  const w = walls()[id];
  if (!w?.ground) return undefined;
  return { x: w.x, y: w.y, z: w.z, radius: w.radius, level: w.level, gate: gateSpot(w, w.gate, w.ground, w.radius) };
}

// ---------- cost (the town hall charges it) ----------
const family = (kind) => (id) => new RegExp(`^siege:castle_${kind}(_|$)`).test(id);
const KIND = {
  log: (id) => /_log$|_stem$/.test(id), plank: (id) => id.endsWith("_planks") || id.endsWith(":planks"),
  stone: family("stone"), cobbled: family("cobbled"), bricks: family("bricks"), tiles: family("tiles"), smooth: family("smooth"),
  iron: (id) => id === "minecraft:iron_ingot", diamond: (id) => id === "minecraft:diamond", netherite: (id) => id === "minecraft:netherite_scrap",
};
export const wallCost = (level) => (WALL_LEVELS[level]?.cost ?? []).map(([label, amount, kind]) => [label, amount, KIND[kind]]);

// ---------- blocks ----------
const perms = new Map();
function perm(id, states) {
  const key = `${id}|${JSON.stringify(states ?? {})}`;
  if (!perms.has(key)) {
    let found;
    for (const attempt of [states, undefined]) {
      try {
        found = BlockPermutation.resolve(id, attempt);
        break;
      } catch {
        // unknown state in this version: try without
      }
    }
    perms.set(key, found);
  }
  return perms.get(key);
}
const first = (ids) => ids.map((id) => perm(id)).find(Boolean) ?? perm("minecraft:cobblestone");

function palette(style, L) {
  const roles = (STYLES[style] ?? STYLES.vale).roles;
  const kinds = {
    log: first(roles.beam ?? ["minecraft:spruce_log"]),
    fence: first(roles.rail ?? ["minecraft:spruce_fence"]),
    plank: first(roles.floor ?? ["minecraft:spruce_planks"]),
  };
  for (const kind of STONE_KINDS) {
    kinds[kind] = perm(stoneId(kind, style), kind === "stone" ? { "siege:armor": 0, "siege:cracks": 0 } : undefined) ?? perm("minecraft:stone_bricks");
  }
  const gateStates = (dir) => ({ "minecraft:cardinal_direction": dir, "siege:armor": L.gateArmor ?? 0 });
  return {
    kinds,
    body: kinds[L.body],
    tooth: perm("siege:battlement") ?? kinds[L.body],
    light: perm("minecraft:lantern"),
    air: perm("minecraft:air"),
    gate: (dir) => (L.gate === "open" ? undefined : perm(`siege:${L.gate}`, gateStates(dir))),
    port: (dir) => perm("siege:portcullis", gateStates(dir)),
  };
}

// What a wall or tower column is made of at a height above its ground
function materialAt(L, P, rel, top) {
  return P.kinds[materialKind(L, rel, top)];
}

const SOFT = /(air|water|grass|fern|flower|snow_layer|leaves|vine|bush|sapling|tallgrass|seagrass|dandelion|poppy|mushroom|_log$|deadbush)/;

// The y of the top solid block of real ground at a spot (trees and plants don't count), or undefined if not loaded
function groundY(dim, x, z) {
  try {
    let block = dim.getTopmostBlock({ x, z });
    for (let i = 0; block && i < 40 && SOFT.test(block.typeId); i++) block = block.below();
    return block?.location.y;
  } catch {
    return undefined;
  }
}

// ---------- raising ----------
const jobs = new Map(); // id -> { cols, index, palette, L, level }

function setBlock(dim, x, y, z, p) {
  const block = dim.getBlock({ x, y, z });
  if (!block) return false;
  if (p && block.permutation !== p) block.setPermutation(p);
  return true;
}

// One column of wall. Returns blocks placed, or -1 if the chunk isn't loaded.
function placeColumn(dim, w, job, col) {
  const { L, palette: P } = job;
  const { x, z, base } = col;
  let top = col.top, n = 0;
  if (!dim.getBlock({ x, y: base, z })) return -1;
  if (col.role === "gap" || col.role === "gate" || col.role === "port") {
    setBlock(dim, x, base, z, dim.getBlock({ x, y: base, z }).isAir ? P.kinds.cobbled : undefined); // something to walk on
    const leaf = col.role === "gate" ? P.gate(w.gateDir) : col.role === "port" ? P.port(w.gateDir) : undefined;
    const open = L.gate === "open";
    const gateH = Math.min(L.gateH ?? WALLS.gateHeight, Math.max(2, L.h - (L.h > 3 ? 1 : 0)));
    for (let y = base + 1; y <= (open ? top + 2 : top); y++) {
      const inGate = y <= base + gateH;
      setBlock(dim, x, y, z, inGate ? leaf ?? P.air : open ? P.air : materialAt(L, P, y - base, y === top));
      n++;
    }
    return n;
  }
  const tower = col.role === "tower";
  const walk = col.role === "walk";
  if (!tower && !walk && L.body === "log") top += (x + z) & 1; // a palisade's uneven points
  // down to solid ground (the measured ground can sit a little above a dip), up to the top
  for (let y = top; y >= base - 8; y--) {
    const block = dim.getBlock({ x, y, z });
    if (!block) return -1;
    if (y <= base && !SOFT.test(block.typeId)) break;
    const p = walk ? P.kinds.plank : materialAt(L, P, Math.max(1, y - base), y === top);
    if (block.permutation !== p) block.setPermutation(p);
    n++;
  }
  if (tower) {
    if (col.tooth) setBlock(dim, x, top + 1, z, P.tooth);
    if (col.mid) setBlock(dim, x, top + 1, z, P.light);
    return n + 1;
  }
  if (!walk && L.battlements && col.d === 0 && ((x + z) & 1) === 0) { setBlock(dim, x, top + 1, z, P.tooth); n++; }
  return n;
}

function measure(dim, w) {
  const ground = [];
  for (const spot of stationSpots(w, w.radius)) {
    const y = groundY(dim, spot.x, spot.z);
    if (y === undefined) return undefined;
    ground.push(y);
  }
  return smoothGround(ground);
}

function step(id, job) {
  const w = walls()[id];
  if (!w) return jobs.delete(id);
  const dim = world.getDimension(OVERWORLD);
  if (!job.cols) {
    // the first wall on this line measures the ground; later levels stand on the same line
    w.ground ??= measure(dim, w);
    if (!w.ground) return; // not loaded yet: wait for someone to come near
    const problem = groundProblem(w.ground);
    if (problem) {
      w.ground = undefined;
      w.building = undefined;
      jobs.delete(id);
      save();
      return world.getPlayers().find((p) => p.id === id)?.sendMessage(`§cThe wall can't be raised: ${problem}`);
    }
    job.cols = wallColumns({ center: w, radius: w.radius, level: job.level, gateAngle: w.gate, smooth: w.ground });
    job.index = Math.min(w.building?.index ?? 0, job.cols.length);
    save();
  }
  let budget = WALLS.perTick;
  while (budget > 0 && job.index < job.cols.length) {
    const n = placeColumn(dim, w, job, job.cols[job.index]);
    if (n < 0) break; // that stretch isn't loaded: wait
    budget -= Math.max(1, n);
    job.index++;
  }
  if (system.currentTick % 20 === 0) {
    emit("wallProgress", { id, level: job.level, done: job.index, total: job.cols.length });
    world.getPlayers().find((p) => p.id === id)?.onScreenDisplay.setActionBar(`§6${job.L.name} rising §f${Math.floor((job.index / job.cols.length) * 100)}%`);
    if (job.index - (w.building?.index ?? 0) > 150) { w.building.index = job.index; save(); }
  }
  if (job.index < job.cols.length) return;
  jobs.delete(id);
  const firstTime = job.level > (w.best ?? 0);
  w.level = job.level;
  w.best = Math.max(w.best ?? 0, job.level);
  w.building = undefined;
  save();
  try {
    dim.runCommand(`tickingarea remove ${areaName(id)}`);
  } catch {
    // it was never added
  }
  emit("wallBuilt", { id, level: job.level, first: firstTime });
  const player = world.getPlayers().find((p) => p.id === id);
  if (player) {
    title(player, `§6${job.L.name} complete`, "§7Your land now reaches a little past your wall");
    player.playSound("ui.toast.challenge_complete");
  }
}

const areaName = (id) => `siege_wall_${String(id).replace(/[^a-zA-Z0-9]/g, "").slice(-12)}`;
const CARDINALS = [[0, "north"], [90, "east"], [180, "south"], [270, "west"]];

// Raise (or upgrade to) a wall level. center/style/bearing are only needed for the first wall.
export function raiseWall(id, level, { center, style, bearing } = {}) {
  const L = WALL_LEVELS[level];
  if (!L) return `There is no wall level ${level}.`;
  if (jobs.has(id)) return "A wall is already rising.";
  let w = walls()[id];
  const moved = w && center && (w.x !== center.x || w.z !== center.z);
  if (!w || moved) {
    if (!center) return "There is no wall line here yet.";
    // gates face one of the four winds so the gate blocks hang straight
    const [deg, dir] = CARDINALS.reduce((best, c) => (Math.abs(((bearing ?? 180) - c[0] + 540) % 360 - 180) < Math.abs(((bearing ?? 180) - best[0] + 540) % 360 - 180) ? c : best));
    w = walls()[id] = { x: center.x, y: center.y, z: center.z, radius: WALLS.radius, level: 0, best: 0, style: style ?? "vale", gate: bearingToAngle(deg), gateDir: dir };
  }
  if (style) w.style = style;
  w.building = { level, index: 0 };
  save();
  try {
    world.getDimension(OVERWORLD).runCommand(`tickingarea add circle ${w.x} ${w.y} ${w.z} 4 ${areaName(id)}`); // keeps the ring loaded while it rises
  } catch {
    // out of ticking areas: the wall rises as players come near
  }
  jobs.set(id, { level, L, palette: palette(w.style, L), index: 0 });
  return true;
}

onTick("settle_walls", 1, () => {
  if (!isReady()) return;
  for (const [id, job] of jobs) {
    try {
      step(id, job);
    } catch (e) {
      console.warn(`[Hollow Crown] wall ${id}: ${e}`);
    }
  }
});

// Walls that were rising when the world closed carry on
on("ready", () => {
  for (const [id, w] of Object.entries(walls())) {
    if (!w.building || jobs.has(id)) continue;
    const { level, index } = w.building;
    if (raiseWall(id, level) === true) walls()[id].building.index = index;
  }
});

// ---------- what a wall changes ----------

const wallAround = (location, extra) => Object.entries(walls()).find(([, w]) => w.level > 0 || w.building
  ? Math.hypot(location.x - (w.x + 0.5), location.z - (w.z + 0.5)) <= w.radius + extra : false);

// Your land reaches a little past your wall from the day it stands
addLandClaim((location) => {
  const found = wallAround(location, WALLS.landBeyond);
  return found && keepOf(found[0]) ? found[0] : undefined;
});

// Raiders come at a walled settlement from outside the wall
addFilter("spawnDistance", (distance, { owner }) => {
  const w = walls()[owner];
  return w && w.level > 0 ? Math.max(distance, w.radius + WALLS.spawnBeyond) : distance;
});

// Nothing else may be built on the line of the wall
addFilter("settleReservedAt", (found, { owner, location }) => {
  if (found) return found;
  const w = walls()[owner];
  return w && onWallLine(w, location, w.radius) ? { label: "your wall" } : undefined;
});

// ---------- a claimed plot gets its first wall ----------

export function bearingFor(center) {
  try {
    const plot = plotAt(center);
    const planned = PLOT_PLAN.find((p) => p.name === plot?.name);
    if (typeof planned?.gate === "number") return planned.gate;
  } catch {
    // no plots here
  }
  return 180; // south
}

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "siege:wall") return;
  const player = event.sourceEntity;
  if (player?.typeId !== "minecraft:player" || !isReady()) return;
  const [n, style] = event.message.trim().split(/\s+/);
  const level = Number(n);
  if (!WALL_LEVELS[level]) {
    return player.sendMessage(WALL_LEVELS.slice(1).map((L, i) => `§6${i + 1}§r ${L.name}`).join("\n") + `\n§7/scriptevent siege:wall <1-${MAX_WALL}> [style]`);
  }
  const keep = keepOf(player.id);
  const center = keep ? { x: keep.x, y: keep.y, z: keep.z } : { x: Math.floor(player.location.x), y: Math.floor(player.location.y), z: Math.floor(player.location.z) };
  const result = raiseWall(player.id, level, { center, style: STYLES[style] ? style : undefined, bearing: bearingFor(center) });
  player.sendMessage(result === true ? `§6${WALL_LEVELS[level].name} rising, ${WALLS.radius} blocks out from ${keep ? "your keep" : "where you stand"}.` : `§c${result}`);
});

// ---------- the town hall's wall menu ----------
// The hall asks through events (it may not import this folder); see the contract in townhall/flyby.js.

// The highest wall a settlement may raise: Hamlet 3, Town 5, City 8, Castle 10
export function wallCap(owner) {
  const keep = keepOf(owner);
  if (!keep) return 0;
  return WALLS.tierCap[Math.max(0, TIERS.indexOf(tierOf(keep)))] ?? MAX_WALL;
}

function blockedReason(owner, level) {
  if (jobs.has(owner)) return "A wall is already rising.";
  if (level > wallCap(owner)) {
    const need = TIERS[WALLS.tierCap.findIndex((cap) => cap >= level)];
    return `Your settlement must be a ${need?.name ?? "greater one"} first.`;
  }
  return undefined;
}

on("wallInfo", (q) => {
  const w = walls()[q.owner];
  q.level = w?.level ?? 0;
  q.max = MAX_WALL;
  q.name = WALL_LEVELS[q.level]?.name ?? "No wall";
  const next = q.level + 1;
  if (WALL_LEVELS[next]) q.next = { level: next, name: WALL_LEVELS[next].name, cost: wallCost(next), blocked: blockedReason(q.owner, next) };
  q.handled = true;
});

on("wallUpgrade", (q) => {
  const blocked = blockedReason(q.owner, q.level);
  if (blocked) { q.refused = blocked; return; }
  const keep = keepOf(q.owner);
  const center = keep ? { x: keep.x, y: keep.y, z: keep.z } : undefined;
  const style = walls()[q.owner]?.style ?? (keep ? styleOf(q.owner, undefined) : undefined);
  const result = raiseWall(q.owner, q.level, walls()[q.owner] ? {} : { center, style, bearing: center ? bearingFor(center) : undefined });
  if (result !== true) { q.refused = result; return; }
  const w = walls()[q.owner];
  const L = WALL_LEVELS[q.level];
  const blocks = Math.PI * 2 * w.radius * 1.3 * (L.thick * (L.h + 2) + (L.walk ? L.walk + 1 : 0)) + (L.towers ?? 0) * (2 * (L.r ?? 0) + 1) ** 2 * (L.h + (L.up ?? 0) + 2);
  q.center = { x: w.x, y: w.y, z: w.z };
  q.radius = w.radius;
  q.seconds = Math.ceil(blocks / WALLS.perTick / 20) + 2;
  q.handled = true;
});
