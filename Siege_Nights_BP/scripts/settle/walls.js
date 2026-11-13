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
import { ModalFormData } from "@minecraft/server-ui";
import { isReady, keepOf, tierOf, TIERS, onTick, moduleStore, on, emit, addFilter, addLandClaim, stoneId, STONE_KINDS, title, CASTLE_BLOCKS, WALL_HP, PORTCULLISES, GATES, regionalId, getState, isAlly, guardCount, setGate, openLeafAt } from "../siege/api.js";
import { applyFilter } from "../core/events.js";
import { STYLES } from "../townhall/styles.js";
import { PLOT_PLAN } from "../plots/config.js";
import { plotAt, mapMode } from "../plots/claims.js";
import { WALLS, WALL_LEVELS, MAX_WALL, bearingToAngle, wallShape, radiusAt, smoothGround, stationSpots, groundProblem, wallColumns, onWallLine, gateSpot, materialKind, wallArmor, columnKinds, wallSeed, WALL_STONES, WALL_TIMBER, WALL_STONE_IDS, WALL_LOG } from "./walldata.js";
import { styleOf } from "./plans.js";
import { sfx } from "../core/sfx.js";

const OVERWORLD = "minecraft:overworld";
const store = moduleStore("siege:settle_walls", () => ({ walls: {} }));
const walls = () => store.data.walls;
const save = () => store.save();

export const wallOf = (id) => walls()[id];
// Put back (or forget, with no record) a settlement's wall record as it was (the battle test, battletest/). Blocks stay.
export function setWallRecord(id, record) {
  if (jobs.has(id)) return false;
  if (record) walls()[id] = record; else delete walls()[id];
  save();
  return true;
}
export function wallRing(id) {
  const w = walls()[id];
  if (!w?.ground) return undefined;
  return { x: w.x, y: w.y, z: w.z, radius: w.radius, level: w.level, gate: gateSpot(w, w.gate, w.ground, w.radius) };
}

// ---------- cost (the town hall charges it) ----------
// Any stone pays for stonework (settlements are "everything free"): Castle Stone of any region, or any vanilla stone,
// brick, deepslate, tuff, sandstone, quartz, blackstone, mud brick, terracotta or concrete block.
const NOT_STONE = /(^minecraft:(nether_)?brick$|sword|pickaxe|_axe|shovel|_hoe|button|pressure_plate|redstone|glowstone|lodestone|grindstone|stonecutter|_wall$|_stairs$|_slab$|dust|_ore$)/;
export const isStoneBlock = (id) => !NOT_STONE.test(id) && (/^siege:(castle_|mossy_castle_stone|cracked_castle_stone)/.test(id)
  || /^minecraft:(.*stone.*|.*bricks?$|.*brick_block$|.*deepslate.*|.*tuff.*|andesite|diorite|granite|polished_.*|calcite|.*quartz.*|blackstone|basalt|smooth_basalt|.*terracotta|.*concrete|.*prismarine.*|packed_mud|mud_bricks|purpur_block|end_stone.*)$/.test(id));
const KIND = {
  log: (id) => /_log$|_stem$|^siege:palisade/.test(id), plank: (id) => id.endsWith("_planks") || id.endsWith(":planks") || id.startsWith("siege:wall_planks"),
  stone: isStoneBlock,
  iron: (id) => id === "minecraft:iron_ingot", diamond: (id) => id === "minecraft:diamond", netherite: (id) => id === "minecraft:netherite_scrap",
};
const STONEWORK = new Set(STONE_KINDS);
// The rows the town hall charges: stonework rows are joined into one "any stone" row (each row is checked on its own)
export function wallCost(level) {
  const rows = new Map();
  for (const [label, amount, kind] of WALL_LEVELS[level]?.cost ?? []) {
    const k = STONEWORK.has(kind) ? "stone" : kind;
    const row = rows.get(k) ?? [STONEWORK.has(kind) ? "stone blocks (any kind)" : label, 0, KIND[k]];
    row[1] += amount;
    rows.set(k, row);
  }
  return [...rows.values()];
}

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

// look = { stone, timber } from the wall record (the owner's choice); without one, the region's own Castle Stone and timber
export function palette(style, L, look = {}) {
  const timber = WALL_TIMBER.includes(look.timber) ? look.timber : style;
  const roles = (STYLES[timber] ?? STYLES.vale).roles;
  const kinds = {
    // log walls are the timber's stripped log (WALL_LOG); wall planks with that region's timber behind them in case the block is missing
    log: first([WALL_LOG[timber] ?? WALL_LOG.vale, ...(roles.beam ?? []), "minecraft:spruce_log"]),
    fence: first(roles.rail ?? ["minecraft:spruce_fence"]),
    plank: perm(regionalId("wall_planks", timber)) ?? first(roles.floor ?? ["minecraft:spruce_planks"]),
  };
  const stone = WALL_STONES[look.stone] ?? WALL_STONES.castle;
  const region = stone.castle === true ? style : stone.castle;
  for (const kind of STONE_KINDS) {
    kinds[kind] = (stone.kinds ? first([...stone.kinds[kind], "minecraft:stone_bricks"])
      : perm(stoneId(kind, region), kind === "stone" ? { "siege:armor": 0, "siege:cracks": 0 } : undefined)) ?? perm("minecraft:stone_bricks");
  }
  style = timber; // gates and portcullis match the timber
  const gateStates = (dir) => ({ "minecraft:cardinal_direction": dir, "siege:armor": L.gateArmor ?? 0 });
  return {
    kinds,
    body: kinds[L.body],
    tooth: perm("siege:battlement") ?? kinds[L.body],
    light: perm("minecraft:lantern"),
    air: perm("minecraft:air"),
    // a roofed tower (TOWER_ROOF) in the region's own roofing; the stair's high side faces the way it rises
    roofb: first(roles.roofBlock ?? ["minecraft:dark_oak_planks"]),
    roof: (dir) => {
      const id = (roles.roofStair ?? ["minecraft:dark_oak_stairs"]).find((r) => perm(r)) ?? "minecraft:dark_oak_stairs";
      return perm(id, { weirdo_direction: { e: 0, w: 1, s: 2, n: 3 }[dir], upside_down_bit: false });
    },
    gate: (dir) => (L.gate === "open" ? undefined : perm(regionalId(L.gate, style), gateStates(dir)) ?? perm(`siege:${L.gate}`, gateStates(dir))),
    port: (dir) => perm(regionalId("portcullis", style), gateStates(dir)) ?? perm("siege:portcullis", gateStates(dir)),
    // steps up the inside of the wall rise toward dir; wood walls use the timber's stairs, stone walls stone brick stairs
    stair: (dir, wood) => {
      const id = (wood ? [...(roles.seat ?? []), "minecraft:spruce_stairs"] : ["minecraft:stone_brick_stairs"]).find((r) => perm(r)) ?? "minecraft:stone_brick_stairs";
      return perm(id, { weirdo_direction: { e: 0, w: 1, s: 2, n: 3 }[dir], upside_down_bit: false });
    },
    // a ladder on a tower's inner face, facing into the town
    ladder: (dir) => perm("minecraft:ladder", { facing_direction: { n: 2, s: 3, w: 4, e: 5 }[dir] }),
    // an arrow slit looks out along the way its stretch of wall faces (angle 0 = east, a quarter turn = south)
    slit: (angle) => perm("siege:arrow_slit", { "minecraft:cardinal_direction": ["east", "south", "west", "north"][((Math.round(angle / (Math.PI / 2)) % 4) + 4) % 4] }) ?? kinds[L.body],
  };
}

// What a wall or tower column is made of at a height above its ground
function materialAt(L, P, rel, top) {
  return P.kinds[materialKind(L, rel, top)];
}

const SOFT = /(air|water|grass(?!_block|_path)|fern|flower|snow_layer|leaves|vine|bush|sapling|tallgrass|seagrass|dandelion|poppy|mushroom|_log$|deadbush)/;

// Natural ground (never wall or building blocks), for finding where the real ground runs above the measured line
const NATURAL = /^minecraft:(dirt|coarse_dirt|rooted_dirt|grass_block|podzol|mycelium|mud|clay|gravel|sand|red_sand|sandstone|red_sandstone|stone|granite|diorite|andesite|deepslate|tuff|calcite|dripstone_block|moss_block|snow|packed_ice|ice|terracotta|\w+_terracotta|grass_path|dirt_path|farmland)$/;

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
export const wallRising = (id) => jobs.has(id);

function setBlock(dim, x, y, z, p) {
  const block = dim.getBlock({ x, y, z });
  if (!block) return false;
  if (p && block.permutation !== p) block.setPermutation(p);
  return true;
}

// The block for one cell of wall (kinds come from columnKinds in walldata.js)
export function permFor(P, w, kind, col) {
  if (kind === "tooth") return P.tooth;
  if (kind === "light") return P.light;
  if (kind === "gate") return P.gate(w.gateDir);
  if (kind === "port") return P.port(w.gateDir);
  if (kind === "slit") return P.slit(col?.a ?? 0);
  if (kind === "roofb") return P.roofb;
  if (kind.startsWith("roof:")) return P.roof(kind.slice(5));
  if (kind.startsWith("wstair:") || kind.startsWith("sstair:")) return P.stair(kind.slice(7), kind[0] === "w");
  if (kind.startsWith("ladder:")) return P.ladder(kind.slice(7));
  return P.kinds[kind];
}

// One column of wall. Returns blocks placed, or -1 if the chunk isn't loaded.
function placeColumn(dim, w, job, col) {
  const { L, palette: P } = job;
  const { x, z, base } = col;
  const ground = dim.getBlock({ x, y: base, z });
  if (!ground) return -1;
  const cells = new Map(columnKinds(L, col, wallSeed(w), w.style));
  let n = 0;
  if (col.role === "gap" || col.role === "gate" || col.role === "port") {
    if (ground.isAir) setBlock(dim, x, base, z, P.kinds.cobbled); // something to walk on
    for (let y = base + 1; y <= col.top + (L.gate === "open" ? 2 : 0); y++) {
      setBlock(dim, x, y, z, cells.has(y) ? permFor(P, w, cells.get(y), col) : P.air); // the gateway is cleared
      n++;
    }
    return n;
  }
  // The ground is measured at stations round the ring and filled in between, so it can run a block or two above
  // that line here: stand the column on the real ground instead of burying its foot.
  // Measured once per column and kept on the wall record (w.lifts), so later levels, repairs and taking the ring
  // down all use the same height.
  const lk = `${x},${z}`;
  let lift = col.role === "stair" || col.role === "ladder" ? 0 : w.lifts?.[lk]; // steps and ladders keep their measured heights
  if (lift === undefined) {
    lift = 0;
    while (lift < 4 && NATURAL.test(dim.getBlock({ x, y: base + 1 + lift, z })?.typeId ?? "")) lift++;
    if (lift) { (w.lifts ??= {})[lk] = lift; job.liftsChanged = true; }
  }
  for (const [y, kind] of cells) {
    if (!setBlock(dim, x, y + lift, z, permFor(P, w, kind, col))) return -1;
    n++;
  }
  // down to solid ground (the measured ground can sit a little above a dip)
  const footing = col.role === "walk" ? P.kinds.plank : materialAt(L, P, 1, false);
  for (let y = base; y >= base - 8; y--) {
    const block = dim.getBlock({ x, y, z });
    if (!block) return -1;
    if (!SOFT.test(block.typeId)) break;
    if (block.permutation !== footing) block.setPermutation(footing);
    n++;
  }
  return n;
}

// A new level's steps and tower ladders don't always stand where the old level's did: take down the old ones that
// the new wall won't build over (a few hundred blocks at most)
const STEP_ROLES = new Set(["stair", "landing", "ladder"]);
function clearOldSteps(dim, w, job) {
  if (!(w.level > 0) || w.level === job.level || !WALL_LEVELS[w.level]) return;
  const keep = new Set(job.cols.map((c) => `${c.x},${c.z}`));
  const air = perm("minecraft:air");
  for (const col of wallColumns({ center: w, radius: w.radius, level: w.level, gateAngle: w.gate, smooth: w.ground })) {
    if (!STEP_ROLES.has(col.role) || keep.has(`${col.x},${col.z}`)) continue;
    for (const [y] of columnKinds(WALL_LEVELS[w.level], col, wallSeed(w))) {
      try { setBlock(dim, col.x, y, col.z, air); } catch { /* not loaded */ }
    }
  }
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
    clearOldSteps(dim, w, job);
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
    sfx(player, "ui.toast.challenge_complete");
  }
}

const areaName = (id) => `siege_wall_${String(id).replace(/[^a-zA-Z0-9]/g, "").slice(-12)}`;
const CARDINALS = [[0, "north"], [90, "east"], [180, "south"], [270, "west"]];

// Raise (or upgrade to) a wall level. center/style/bearing are only needed for the first wall.
// radius: where a new wall line goes (default WALLS.radius); a town layout starts it at its Hamlet radius.
// outline: { radii, radiiAt } from a map plot's starter village (towns_data.js): the wall follows that line at every ring.
export function raiseWall(id, level, { center, style, bearing, radius, shape, outline } = {}) {
  const L = WALL_LEVELS[level];
  if (!L) return `There is no wall level ${level}.`;
  if (jobs.has(id)) return "A wall is already rising.";
  let w = walls()[id];
  if (w?.level > 0 && w.ground) setWallGate(id, w, false); // a swung-open gate shuts before the wall is rebuilt round it
  const moved = w && center && (w.x !== center.x || w.z !== center.z);
  if (!w || moved) {
    if (!center) return "There is no wall line here yet.";
    // gates face one of the four winds so the gate blocks hang straight
    const [deg, dir] = CARDINALS.reduce((best, c) => (Math.abs(((bearing ?? 180) - c[0] + 540) % 360 - 180) < Math.abs(((bearing ?? 180) - best[0] + 540) % 360 - 180) ? c : best));
    w = walls()[id] = { x: center.x, y: center.y, z: center.z, shape: shape ?? wallShape(`${id}:${center.x},${center.z}`), radius: radius ?? WALLS.radius, level: 0, best: 0, style: style ?? "vale", gate: bearingToAngle(deg), gateDir: dir };
    if (outline?.radii?.length) Object.assign(w, { radii: outline.radii, radiiAt: outline.radiiAt }); // walldata.js radiusAt reads them
  }
  if (style) w.style = style;
  w.building = { level, index: 0 };
  save();
  if (!String(id).startsWith("npc:")) try { // a lord's wall only rises while players are near, so it needs no ticking area
    world.getDimension(OVERWORLD).runCommand(`tickingarea add circle ${w.x} ${w.y} ${w.z} 4 ${areaName(id)}`); // keeps the ring loaded while it rises
  } catch {
    // out of ticking areas: the wall rises as players come near
  }
  jobs.set(id, { level, L, palette: palette(w.style, L, w.look), index: 0 });
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

// Move a wall line out (a town growing a tier): the old ring comes down a stretch at a time, then the same level
// rises on the new line. down() runs once the old ring is gone. Free: the town paid for the level already.
export function moveWall(id, radius, down = () => {}) {
  const w = walls()[id];
  if (!w) { down(); return "There is no wall to move."; }
  if (w.radius === radius) { down(); return "already"; }
  if (jobs.has(id)) { system.runTimeout(() => moveWall(id, radius, down), 100); return "waiting"; }
  const level = Math.max(1, w.level || w.building?.level || 1);
  if (w.level > 0 && w.ground) setWallGate(id, w, false); // shut the gate before its wall comes down
  const old = { ...w };
  const cols = old.ground && old.level > 0 ? wallColumns({ center: old, radius: old.radius, level: old.level, gateAngle: old.gate, smooth: old.ground }) : [];
  w.radius = radius;
  w.ground = undefined;
  w.lifts = undefined; // a new line measures its own ground
  w.building = undefined;
  w.moving = true; // if the world closes before the new ring starts, it starts on the next load (the old one may stay)
  save();
  const L = WALL_LEVELS[old.level] ?? WALL_LEVELS[level];
  const air = perm("minecraft:air");
  system.runJob((function* takeDown() {
    const dim = world.getDimension(OVERWORLD);
    let n = 0;
    for (const col of cols) {
      for (let tries = 0; tries < 30; tries++) {
        if (dim.getBlock({ x: col.x, y: col.base, z: col.z })) break;
        for (let i = 0; i < 20; i++) yield; // not loaded: wait a second
      }
      const lift = old.lifts?.[`${col.x},${col.z}`] ?? 0;
      for (const [y] of columnKinds(L, col, wallSeed(old))) {
        try { setBlock(dim, col.x, y + lift, col.z, air); } catch { /* not loaded */ }
        if (++n % 300 === 0) yield;
      }
    }
    down();
    delete walls()[id]?.moving;
    raiseWall(id, level);
  })());
  return true;
}

// Walls raised before they had steps (2026-11-12) get their flights, tower ladders and (Palisade and Fieldstone Wall)
// their new walkway added once, a little at a time
const STEPS_VERSION = 1;
function addSteps(id) {
  const w = walls()[id];
  if (!w || !(w.level > 0) || !w.ground || (w.steps ?? 0) >= STEPS_VERSION || jobs.has(id)) return;
  const L = WALL_LEVELS[w.level];
  const job = { L, palette: palette(w.style, L, w.look) };
  const want = (c) => STEP_ROLES.has(c.role) || (c.role === "walk" && (w.level === 2 || w.level === 4));
  const cols = wallColumns({ center: w, radius: w.radius, level: w.level, gateAngle: w.gate, smooth: w.ground }).filter(want);
  system.runJob((function* () {
    const dim = world.getDimension(OVERWORLD);
    for (const col of cols) {
      for (let tries = 0; tries < 60 && placeColumn(dim, w, job, col) < 0; tries++) for (let i = 0; i < 20; i++) yield; // wait for it to load
      yield;
    }
    w.steps = STEPS_VERSION;
    save();
  })());
}
on("wallBuilt", ({ id }) => { const w = walls()[id]; if (w) { w.steps = STEPS_VERSION; save(); } });

// Walls that were rising when the world closed carry on
on("ready", () => {
  system.runTimeout(() => { for (const id of Object.keys(walls())) addSteps(id); }, 200);
  for (const [id, w] of Object.entries(walls())) {
    if (w.moving && !jobs.has(id)) { delete w.moving; raiseWall(id, Math.max(1, w.level || 1)); continue; }
    if (!w.building || jobs.has(id)) continue;
    const { level, index } = w.building;
    if (raiseWall(id, level) === true) walls()[id].building.index = index;
  }
});

// ---------- the gate: barred to outsiders, opened by the guard for friends ----------
// Mateo, 2026-11-11: only the owner, their allies and their guards open a settlement's gates; gates
// shut when a siege starts. Clicking is checked in siege/block_clicks.js (mayWorkGate). Here, when the
// owner or an ally walks up to their own gate and the settlement keeps guards, the guard opens the gate
// and portcullis, and shuts them again once nobody friendly is near. No guard opens anything mid-siege.
const gateBlocks = new Map(); // `${id}|${level}` -> [{ x, y, z }] one block of each gate and portcullis
const guardOpened = new Set(); // wall ids whose gate a guard opened
const gateGreeted = new Set(); // wall ids whose guard has already opened up for the friend standing there
// Pure: what the guard does this step. He opens only on the step a friend arrives.
export const gateGuardStep = ({ friendNear, greeted, opened, guards }) => (friendNear && !greeted && !opened && guards > 0 ? "open" : friendNear ? "wait" : opened ? "shut" : "idle");
function findGateBlocks(id, w) {
  const key = `${id}|${w.level}`;
  if (gateBlocks.has(key)) return gateBlocks.get(key);
  const g = gateSpot(w, w.gate, w.ground, w.radius), dim = world.getDimension(OVERWORLD), found = [], kinds = new Set();
  try {
    for (let dy = 0; dy <= 6; dy++) for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
      const b = dim.getBlock({ x: g.x + dx, y: g.y + dy, z: g.z + dz });
      if (b && (GATES.includes(b.typeId) || PORTCULLISES.includes(b.typeId)) && !kinds.has(b.typeId)) { kinds.add(b.typeId); found.push(b.location); }
    }
  } catch {
    return []; // not loaded: look again next time
  }
  if (found.length) gateBlocks.set(key, found);
  return found;
}
function setWallGate(id, w, open) {
  const dim = world.getDimension(OVERWORLD);
  const awayFrom = gateSpot(w, w.gate, w.ground, w.radius).outside; // the gate swings in, away from the road
  let moved = false;
  for (const loc of findGateBlocks(id, w)) {
    try {
      const b = dim.getBlock(loc);
      // a remembered spot that is no gate and no gateway of a swung-open gate: look for the gate again next time
      if (b && !GATES.includes(b.typeId) && !openLeafAt(dim, loc)) gateBlocks.delete(`${id}|${w.level}`);
      if (b && setGate(b, open, { awayFrom })) moved = true;
    } catch {
      // not loaded
    }
  }
  return moved;
}
const friendOf = (owner, playerId) => playerId === owner || isAlly(owner, playerId);
export const nearGate = (g, p, reach) => Math.hypot(p.x - (g.x + 0.5), p.z - (g.z + 0.5)) <= reach && Math.abs(p.y - g.y) <= 4;

onTick("settle_gates", 10, () => {
  if (!isReady() || getState().active) return;
  const players = world.getDimension(OVERWORLD).getPlayers();
  for (const [id, w] of Object.entries(walls())) {
    if (!(w.level > 0) || w.building || WALL_LEVELS[w.level]?.gate === "open" || id.startsWith("npc:")) continue;
    if (applyFilter("gatesBarred", false, { owner: id })) { // a War Writ is out on them: no guard opens the gate
      if (guardOpened.has(id)) { setWallGate(id, w, false); guardOpened.delete(id); }
      continue;
    }
    const g = gateSpot(w, w.gate, w.ground, w.radius);
    const opened = guardOpened.has(id);
    const greeted = gateGreeted.has(id);
    const friendNear = players.some((p) => friendOf(id, p.id) && nearGate(g, p.location, opened || greeted ? 6 : WALLS.gateGreet));
    // The guard opens the gate once, as a friend arrives. After that the gate is the friend's to work: shut it by
    // hand and it stays shut until they have walked away and come back (it used to swing open again at once).
    if (gateGuardStep({ friendNear, greeted, opened, guards: guardCount(id) }) === "open") {
      gateGreeted.add(id);
      if (setWallGate(id, w, true)) guardOpened.add(id);
    } else if (!friendNear) {
      gateGreeted.delete(id);
      if (opened) { setWallGate(id, w, false); guardOpened.delete(id); }
    }
  }
});

// A siege bars every gate: anything open slams shut (the owner and allies can still open it by hand to sally out)
on("siegeStart", () => {
  guardOpened.clear();
  for (const [id, w] of Object.entries(walls())) if (w.level > 0 && WALL_LEVELS[w.level]?.gate !== "open") setWallGate(id, w, false);
});

// One settlement's gates slam shut (a War Writ declared on it, warwrit/index.js)
export function barGates(owner) {
  const w = walls()[owner];
  if (!(w?.level > 0) || WALL_LEVELS[w.level]?.gate === "open") return;
  guardOpened.delete(owner);
  setWallGate(owner, w, false);
}

// ---------- what a wall changes ----------

const wallAround = (location, extra) => Object.entries(walls()).find(([, w]) => {
  if (!(w.level > 0 || w.building)) return false;
  const dx = location.x - (w.x + 0.5), dz = location.z - (w.z + 0.5);
  return Math.hypot(dx, dz) <= radiusAt(w, w.radius, Math.atan2(dz, dx)) + extra;
});

// Your land reaches a little past your wall from the day it stands
addLandClaim((location) => {
  const found = wallAround(location, WALLS.landBeyond);
  return found && keepOf(found[0]) ? found[0] : undefined;
});

// On the map a settlement's land is full size from the day you arrive: just past the wall ring, and siege
// wins do not grow it (Mateo, 2026-11-10). Off the map the old rule stays: land grows with the tier.
addFilter("landRadius", (radius) => {
  try {
    return mapMode() ? WALLS.radius + WALLS.landBeyond : radius;
  } catch {
    return radius;
  }
});

// Raiders come at a walled settlement from outside the wall
addFilter("spawnDistance", (distance, { owner }) => {
  const w = walls()[owner];
  return w && w.level > 0 ? Math.max(distance, w.radius + WALLS.wobble.out + WALLS.spawnBeyond) : distance;
});

// A settlement wall is as strong as its level: the whole Castle Stone family on the line of a
// level 6+ wall takes hits like reinforced Castle Stone (iron, then diamond at 9, netherite at 10)
addFilter("wallHp", (hp, { block }) => {
  // any stonework on the line counts (the owner may build it in any stone); timber, gates and portcullis keep their own
  if (PORTCULLISES.includes(block.typeId) || GATES.includes(block.typeId) || !(CASTLE_BLOCKS.includes(block.typeId) || isStoneBlock(block.typeId))) return hp;
  for (const w of Object.values(walls())) {
    if (w.level > 0 && onWallLine(w, block.location, w.radius)) return Math.max(hp, WALL_HP.castle[wallArmor(w.level)]);
  }
  return hp;
});

// Nothing else may be built on the line of the wall
addFilter("settleReservedAt", (found, { owner, location }) => {
  if (found) return found;
  const w = walls()[owner];
  return w && onWallLine(w, location, w.radius) ? { label: "your wall" } : undefined;
});

// ---------- a claimed plot gets its first wall ----------

// Which side of a plot its gate is on: "north" | "east" | "south" | "west"
export const gateDirFor = (center) => CARDINALS.find((c) => c[0] === ((Math.round(bearingFor(center) / 90) * 90) % 360 + 360) % 360)?.[1] ?? "south";

// Hand a wall from one holder to another (a Rival Lord's wall to the player who takes the settlement over)
export function adoptWall(fromId, toId) {
  const w = walls()[fromId];
  if (!w || walls()[toId]) return false;
  walls()[toId] = w;
  delete walls()[fromId];
  if (jobs.has(fromId)) { jobs.set(toId, jobs.get(fromId)); jobs.delete(fromId); } // a wall still rising carries on for its new holder
  save();
  return true;
}

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
  if (n === "look") { // /scriptevent siege:wall look   or   look <stone> [timber]
    if (!style) return void chooseWallLook(player).catch(() => {});
    const timber = event.message.trim().split(/\s+/)[2];
    const done = setWallLook(player.id, { stone: style, timber });
    return player.sendMessage(done === true ? `§6Wall look: ${WALL_STONES[style].name}${timber ? `, ${timber} timber` : ""}. §7Run /scriptevent siege:wall_repair free to re-face it now.` : `§c${done}§7 Stones: ${WALL_STONE_IDS.join(", ")}. Timber: ${WALL_TIMBER.join(", ")}.`);
  }
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
  q.repair = true; // emit "wallRepair" { owner, player } and repair.js surveys, prices, charges and mends
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

// ---------- the owner chooses what the wall is built in ----------
// Settlements are "everything free" (Mateo, 2026-11-11): Castle Stone of any region, or plain stone, deepslate,
// tuff, sandstone, white stone, brick, mud brick or blackstone; palisade and gates from any region's timber.
// The choice is kept on the wall record (w.look) and used for every later raise and repair. Re-facing the
// standing wall in the new look is free (the masons swap it over), but not while a siege is on.
export function setWallLook(owner, { stone, timber } = {}) {
  const w = walls()[owner];
  if (!w) return "There is no wall here yet. Raise one from the town hall first.";
  if (stone !== undefined && !WALL_STONES[stone]) return `There is no stone called ${stone}.`;
  if (timber !== undefined && !WALL_TIMBER.includes(timber)) return `There is no timber called ${timber}.`;
  w.look = { ...(w.look ?? {}), ...(stone !== undefined ? { stone } : {}), ...(timber !== undefined ? { timber } : {}) };
  save();
  emit("wallLookChanged", { owner, look: w.look });
  return true;
}

export async function chooseWallLook(player, owner = player.id) {
  const w = walls()[owner];
  if (!w) return player.sendMessage("§7Mason: §fRaise a wall at the town hall first, then tell me what to build it in.");
  const stones = WALL_STONE_IDS;
  const look = w.look ?? {};
  const form = new ModalFormData().title("What the wall is built in")
    .dropdown("Stonework", stones.map((id) => WALL_STONES[id].name), { defaultValueIndex: Math.max(0, stones.indexOf(look.stone ?? "castle")) })
    .dropdown("Palisade, walkway and gates", WALL_TIMBER.map((r) => `${r[0].toUpperCase()}${r.slice(1)} timber`), { defaultValueIndex: Math.max(0, WALL_TIMBER.indexOf(look.timber ?? w.style)) })
    .toggle("Re-face the standing wall now (free)", { defaultValue: true });
  const res = await form.show(player);
  if (res.canceled || !res.formValues) return;
  const [s, t, now] = res.formValues;
  const done = setWallLook(owner, { stone: stones[s], timber: WALL_TIMBER[t] });
  if (done !== true) return player.sendMessage(`§c${done}`);
  if (!now || !w.level) return player.sendMessage("§6The masons will build in it from the next raise or repair.");
  emit("wallReface", { owner, player });
}

