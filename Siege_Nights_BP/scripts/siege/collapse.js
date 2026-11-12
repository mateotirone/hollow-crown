// Wall collapse: when siege damage knocks a block out, the stretch around it is checked with the rules in
// structure.js (the same ones the Siege Wall Lab runs). Blocks with nothing holding them up fall as whole
// chunks, block by block, tipping toward the open side, and shatter where they land into cobblestone and
// gravel that slides into slopes. Cracked blocks with too much weight on them crush.
//
// Realm-safe: reading the stretch runs in a system.runJob a few hundred blocks at a time, the rules work on at
// most MAX_CELLS blocks, and falling chunks move a limited number of blocks each tick.
// Nothing collapses in a settlement whose owner is offline: those blocks count as solid ground.
//
// Test in game: /scriptevent siege:collapse_test   builds a small wall in front of you and knocks its base out.

import { world, system } from "@minecraft/server";
import { CASTLE_BLOCKS, GATES, UNBREAKABLE } from "./constants.js";
import { MASONRY, blockStrength, groupChunks, settleJob, slideRubble, tipDirection } from "./structure.js";
import { addTests, assert, assertEqual } from "../core/tests.js";
import { sfx } from "../core/sfx.js";

export const COLLAPSE = {
  across: 14,        // blocks to each side of a hit that are checked
  up: 24, down: 8,   // and above / below it
  maxCells: 4000,    // never weigh more wall than this at once
  readsPerStep: 300, // blocks read per runJob step
  animateMax: 220,   // chunks bigger than this drop straight to rubble instead of falling block by block
  movesPerTick: 900, // block changes a falling chunk may make in one tick, all chunks together
  rubbleKept: 0.6,   // share of fallen blocks that stay as rubble (the rest is dust)
  crushDelay: 6,     // ticks between one round of crushing and the next look
};

// What counts as built wall. Natural ground (stone, dirt, logs of living trees) is never moved.
const BUILT = /^minecraft:(?!.*(door|trapdoor|fence_gate|pane|sign|banner|button|pressure_plate|lantern|torch|candle|chain|iron_bars|ladder|bed|chest|barrel|furnace|table|anvil|bell))(.*(brick|planks|cobble|_wall$|stripped_|slab|stairs|polished|smooth_|tiles|chiseled|cut_|concrete$|terracotta|glass$|quartz_block|fence$))/;
// Things that don't hold anything up and that a falling block passes straight through
export const PASSABLE = /air$|water|lava|short_grass|tall_grass|^minecraft:fern|large_fern|flower|tulip|poppy|dandelion|orchid|allium|bluet|daisy|cornflower|lily_of|rose_bush|peony|lilac|sunflower|torch|snow_layer|vine|sapling|carpet|rail|button|lever|sign|mushroom$|dead_?bush|seagrass|kelp|cobweb|fire$/;

// The add-on's own wall and building blocks (settlement wall planks, palisade, timber, roof shingles)
const OWN_BUILT = /^siege:(wall_planks|palisade|timber_frame|roof_shingles)/;
// Blocks that are wall in a settlement but natural rock out in the wild (several wall looks use them)
export const WALL_OR_ROCK = new Set([
  "minecraft:tuff", "minecraft:calcite", "minecraft:diorite", "minecraft:andesite", "minecraft:granite",
  "minecraft:sandstone", "minecraft:red_sandstone", "minecraft:packed_mud", "minecraft:blackstone",
  "minecraft:gilded_blackstone", "minecraft:stone", "minecraft:spruce_log",
]);

// inSettlement: the block stands on someone's settlement land (so a tuff wall or a log frame counts, a tuff hill or a wild tree doesn't)
export function isStructural(typeId, inSettlement = false) {
  return CASTLE_BLOCKS.includes(typeId) || GATES.includes(typeId) || BUILT.test(typeId) || OWN_BUILT.test(typeId)
    || (inSettlement && (WALL_OR_ROCK.has(typeId) || /^minecraft:\w+_(log|wood)$/.test(typeId)));
}

const key = (x, y, z) => `${x},${y},${z}`;
const pending = new Map(); // dimension id -> [{x, y, z}]
let hooks = { damageShare: () => 0, tierOf: () => 0, canFall: () => true, onRemoved: () => {}, crushHit: () => {}, inSettlement: () => false };

// walls.js wires this up (damage map, tiers, offline land), so this file never imports walls.js
export function setCollapseHooks(h) { hooks = { ...hooks, ...h }; }

// A block was knocked out at loc: look at the wall around it a moment later (hits in one blast are batched).
// typeId: what stood there, so the check can tell what was holding what before the hit.
export function queueCollapse(dim, loc, typeId) {
  const id = dim.id;
  if (!pending.has(id)) {
    pending.set(id, []);
    system.runTimeout(() => {
      const origins = pending.get(id) ?? [];
      pending.delete(id);
      if (origins.length) startCheck(world.getDimension(id), origins);
    }, 3);
  }
  pending.get(id).push({ x: Math.floor(loc.x), y: Math.floor(loc.y), z: Math.floor(loc.z), typeId: typeId ?? loc.typeId });
}

function startCheck(dim, origins) {
  system.runJob(checkJob(dim, origins));
}

function* checkJob(dim, origins) {
  const lo = { x: Infinity, y: Infinity, z: Infinity }, hi = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const o of origins) for (const a of ["x", "y", "z"]) { lo[a] = Math.min(lo[a], o[a]); hi[a] = Math.max(hi[a], o[a]); }
  const box = {
    x0: lo.x - COLLAPSE.across, x1: hi.x + COLLAPSE.across, z0: lo.z - COLLAPSE.across, z1: hi.z + COLLAPSE.across,
    y0: lo.y - COLLAPSE.down, y1: hi.y + COLLAPSE.up,
  };
  const inBox = (x, y, z) => x >= box.x0 && x <= box.x1 && y >= box.y0 && y <= box.y1 && z >= box.z0 && z <= box.z1;
  const edge = (x, y, z) => x === box.x0 || x === box.x1 || z === box.z0 || z === box.z1 || y === box.y0 || y === box.y1;

  // 1. Flood out from the hits through built blocks
  const cells = new Map();
  const solidBelow = new Set(); // cells with non-wall solid ground right under them
  const seen = new Set();
  const queue = [];
  const visit = (x, y, z) => { const k = key(x, y, z); if (!seen.has(k) && inBox(x, y, z)) { seen.add(k); queue.push([x, y, z]); } };
  for (const o of origins) for (const [dx, dy, dz] of N6) visit(o.x + dx, o.y + dy, o.z + dz);
  let reads = 0;
  for (let i = 0; i < queue.length && cells.size < COLLAPSE.maxCells; i++) {
    const [x, y, z] = queue[i];
    if (++reads % COLLAPSE.readsPerStep === 0) yield;
    let block;
    try { block = dim.getBlock({ x, y, z }); } catch { block = undefined; }
    if (!block || UNBREAKABLE.includes(block.typeId)) continue;
    if (!isStructural(block.typeId) && !(isStructural(block.typeId, true) && hooks.inSettlement(block))) continue;
    // Out at the edge of what we look at, unloaded, or on an absent owner's land: treat it as solid ground
    if (edge(x, y, z) || !hooks.canFall(block)) continue;
    cells.set(key(x, y, z), {
      x, y, z, gate: GATES.includes(block.typeId), typeId: block.typeId, perm: block.permutation,
      tier: hooks.tierOf(block), share: hooks.damageShare(block),
    });
    for (const [dx, dy, dz] of N6) visit(x + dx, y + dy, z + dz);
  }
  if (cells.size >= COLLAPSE.maxCells) return; // too big to judge safely in one go: leave it standing
  yield;
  for (const c of cells.values()) {
    if (cells.has(key(c.x, c.y - 1, c.z))) continue;
    if (++reads % COLLAPSE.readsPerStep === 0) yield;
    let below;
    try { below = dim.getBlock({ x: c.x, y: c.y - 1, z: c.z }); } catch { below = undefined; }
    if (!below || !PASSABLE.test(below.typeId)) solidBelow.add(c); // unloaded counts as solid
  }
  yield;

  // 2. Weigh it, before and after the hit
  const removed = origins.filter((o) => o.typeId && isStructural(o.typeId, true)).map((o) => ({ x: o.x, y: o.y, z: o.z, gate: GATES.includes(o.typeId) }));
  const result = yield* judgeJob(cells, solidBelow, removed);
  yield;

  // 3. Crush the worst overloaded blocks first, then look again
  if (result.crushed.length) {
    result.crushed.sort((a, b) => b.stress - a.stress);
    const now = result.crushed.slice(0, Math.max(1, Math.ceil(result.crushed.length / 3)));
    sfx(dim, "block.scaffolding.break", now[0], { volume: 1, pitch: 0.5 });
    system.runTimeout(() => {
      for (const c of now) crush(dim, c);
    }, COLLAPSE.crushDelay);
  }
  // 4. Drop the loose chunks, nearest the hit first
  for (const group of groupChunks(result.loose)) {
    let dist = Infinity;
    for (const c of group) for (const o of origins) dist = Math.min(dist, Math.abs(c.x - o.x) + Math.abs(c.y - o.y) + Math.abs(c.z - o.z));
    const delay = 2 + Math.min(40, Math.round(dist * 1.5 + group.length / 10));
    system.runTimeout(() => startFall(dim, group), delay);
  }
}

const N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
// faces and edges: stair-stepped roofs touch the course below only along an edge
const N18 = [];
for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
  const n = Math.abs(dx) + Math.abs(dy) + Math.abs(dz);
  if (n === 1 || n === 2) N18.push([dx, dy, dz]);
}

// The pure part of a check, so the self-tests can run it.
// Only what the hit changed comes down. Anything that already stood "against the rules" before the hit
// (a roof, an overhang, a wide gateway with its gate open) was built that way and stays up as long as it is
// still joined to standing wall; once the wall it hangs from falls, it goes too.
// removed: the blocks the hit knocked out [{ x, y, z, gate }].
export function judge(cells, solidBelow, removed = []) {
  const job = judgeJob(cells, solidBelow, removed);
  for (;;) { const step = job.next(); if (step.done) return step.value; }
}

export function* judgeJob(cells, solidBelow, removed = []) {
  const rules = {
    reach: (c) => MASONRY.reach[c.tier ?? 0],
    strength: (c) => blockStrength(c.tier ?? 0, c.share ?? 0),
    hang: MASONRY.hang,
  };
  const before = new Map(cells), ghosts = new Set();
  for (const r of removed) {
    const k = key(r.x, r.y, r.z);
    if (before.has(k)) continue;
    before.set(k, { x: r.x, y: r.y, z: r.z, gate: !!r.gate, tier: 0, share: 0 });
    ghosts.add(k); // it stood before the hit, so it was standing on something
  }
  const pre = yield* settleJob(before, rules, (x, y, z) => ghosts.has(key(x, y, z)) || solidBelow.has(cells.get(key(x, y, z))));
  const preLoose = new Set(pre.loose.map((c) => key(c.x, c.y, c.z)));
  const preCrushed = new Set(pre.crushed.map((c) => key(c.x, c.y, c.z)));

  yield;
  const post = yield* settleJob(cells, rules, (x, y, z) => solidBelow.has(cells.get(key(x, y, z))));
  const looseNow = new Set(post.loose.map((c) => key(c.x, c.y, c.z)));
  // built overhangs: kept while joined (through each other) to wall that still stands
  const designed = new Map(post.loose.filter((c) => preLoose.has(key(c.x, c.y, c.z))).map((c) => [key(c.x, c.y, c.z), c]));
  const kept = new Set();
  const queue = [];
  for (const [k, c] of designed) {
    for (const [dx, dy, dz] of N18) {
      const nk = key(c.x + dx, c.y + dy, c.z + dz);
      if (cells.has(nk) && !looseNow.has(nk)) { kept.add(k); queue.push(c); break; }
    }
  }
  for (let i = 0; i < queue.length; i++) {
    const c = queue[i];
    for (const [dx, dy, dz] of N18) {
      const nk = key(c.x + dx, c.y + dy, c.z + dz);
      if (designed.has(nk) && !kept.has(nk)) { kept.add(nk); queue.push(designed.get(nk)); }
    }
  }
  const loose = post.loose.filter((c) => !kept.has(key(c.x, c.y, c.z)));
  // a tall build that always carried a lot only crushes once it is cracked
  const crushed = post.crushed.filter((c) => (c.share ?? 0) > 0 || !preCrushed.has(key(c.x, c.y, c.z)));
  for (const c of crushed) c.stress = post.load.get(c) / rules.strength(c);
  return { loose, crushed, load: post.load, held: post.held };
}

function readBlock(dim, x, y, z) {
  try { return dim.getBlock({ x, y, z }); } catch { return undefined; }
}
const isFree = (block) => !!block && PASSABLE.test(block.typeId);

function crush(dim, c) {
  const block = readBlock(dim, c.x, c.y, c.z);
  if (!block || block.typeId !== c.typeId) return;
  block.setType("minecraft:air");
  hooks.onRemoved(c);
  dim.spawnParticle("minecraft:large_explosion", { x: c.x + 0.5, y: c.y + 0.5, z: c.z + 0.5 });
  sfx(dim, "dig.stone", c, { volume: 1, pitch: 0.6 });
  if (Math.random() < COLLAPSE.rubbleKept) dropRubble(dim, c.x, c.y, c.z);
  queueCollapse(dim, c, c.typeId);
}

// ---------- Falling chunks ----------
const falls = [];
let fallLoop;

function startFall(dim, group) {
  // only what is still standing where we left it
  const cells = group.filter((c) => readBlock(dim, c.x, c.y, c.z)?.typeId === c.typeId);
  if (!cells.length) return;
  if (cells.length > COLLAPSE.animateMax) return system.runJob(dropAll(dim, cells));
  const [dx, dz] = tipDirection(cells, (x, y, z) => isFree(readBlock(dim, x, y, z)));
  const height = Math.max(...cells.map((c) => c.y)) - Math.min(...cells.map((c) => c.y)) + 1;
  sfx(dim, "block.scaffolding.break", cells[0], { volume: 1, pitch: 0.4 });
  falls.push({ dim, cells, dx, dz, drop: 0, tipsLeft: height >= 3 ? Math.ceil(height / 3) : 0, wait: 0 });
  fallLoop ??= system.runInterval(fallTick, 1);
}

function fallTick() {
  let budget = COLLAPSE.movesPerTick;
  for (let i = falls.length - 1; i >= 0; i--) {
    const f = falls[i];
    if (budget <= 0) break;
    try {
      // falls faster the longer it drops: 1 block a tick, then 2, then 3
      const steps = Math.min(3, 1 + Math.floor(f.drop / 3));
      let landed = false;
      for (let s = 0; s < steps && !landed; s++) {
        if (!move(f, 0, -1, 0)) { landed = true; break; }
        f.drop++;
        budget -= f.cells.length * 2;
        // tall chunks lean out as they go, one block sideways every third block down
        if (f.tipsLeft > 0 && f.drop % 3 === 0 && move(f, f.dx, 0, f.dz)) f.tipsLeft--;
      }
      if (landed) { falls.splice(i, 1); land(f); }
    } catch {
      falls.splice(i, 1); // fell into unloaded land
    }
  }
  if (!falls.length) { system.clearRun(fallLoop); fallLoop = undefined; }
}

// Shift a whole chunk one block if every spot it moves into is free. Returns false if it can't.
function move(f, dx, dy, dz) {
  const mine = new Set(f.cells.map((c) => key(c.x, c.y, c.z)));
  for (const c of f.cells) {
    const k = key(c.x + dx, c.y + dy, c.z + dz);
    if (mine.has(k)) continue;
    if (!isFree(readBlock(f.dim, c.x + dx, c.y + dy, c.z + dz))) return false;
  }
  const moved = f.cells.map((c) => ({ ...c, x: c.x + dx, y: c.y + dy, z: c.z + dz }));
  const next = new Set(moved.map((c) => key(c.x, c.y, c.z)));
  for (const c of f.cells) {
    hooks.onRemoved(c);
    if (!next.has(key(c.x, c.y, c.z))) readBlock(f.dim, c.x, c.y, c.z)?.setType("minecraft:air");
  }
  for (const c of moved) readBlock(f.dim, c.x, c.y, c.z)?.setPermutation(c.perm);
  f.cells = moved;
  return true;
}

function land(f) {
  const { dim, cells } = f;
  const n = cells.length;
  const bottom = Math.min(...cells.map((c) => c.y));
  const centre = { x: 0, y: bottom, z: 0 };
  for (const c of cells) { centre.x += c.x / n; centre.z += c.z / n; }
  sfx(dim, n > 12 ? "random.explode" : "dig.stone", centre, { volume: Math.min(1, 0.3 + n / 40), pitch: 0.5 });
  // whatever it came down on takes a knock, and anyone underneath gets hurt
  const hitDamage = Math.min(4, 1 + n / 8 + f.drop / 6);
  for (const c of cells) {
    if (c.y !== bottom) continue;
    const under = readBlock(dim, c.x, c.y - 1, c.z);
    if (under && isStructural(under.typeId, hooks.inSettlement(under))) hooks.crushHit(under, hitDamage);
  }
  if (f.drop >= 2) {
    try {
      for (const e of dim.getEntities({ location: { x: centre.x + 0.5, y: bottom, z: centre.z + 0.5 }, maxDistance: 1.5 + Math.sqrt(n) })) {
        if (e.typeId === "minecraft:item") continue;
        e.applyDamage(Math.round(2 + n / 6 + f.drop), { cause: "fallingBlock" });
      }
    } catch {
      // nothing there to hurt
    }
  }
  system.runJob(shatter(dim, cells, f.drop));
}

// The chunk breaks up where it lands: blocks become dust or rubble, lowest first
function* shatter(dim, cells, drop) {
  const sorted = [...cells].sort((a, b) => a.y - b.y);
  let i = 0;
  for (const c of sorted) {
    const block = readBlock(dim, c.x, c.y, c.z);
    if (block && block.typeId === c.typeId) {
      block.setType("minecraft:air");
      hooks.onRemoved(c);
      if (i % 3 === 0) dim.spawnParticle("minecraft:large_explosion", { x: c.x + 0.5, y: c.y + 0.5, z: c.z + 0.5 });
      // a short drop leaves more of it in one piece
      if (Math.random() < (drop < 2 ? 0.85 : COLLAPSE.rubbleKept)) dropRubble(dim, c.x, c.y, c.z);
    }
    if (++i % 40 === 0) yield;
  }
}

// Chunks too big to animate: straight to rubble where they would land
function* dropAll(dim, cells) {
  sfx(dim, "random.explode", cells[0], { volume: 1, pitch: 0.4 });
  let i = 0;
  for (const c of [...cells].sort((a, b) => a.y - b.y)) {
    const block = readBlock(dim, c.x, c.y, c.z);
    if (block && block.typeId === c.typeId) {
      block.setType("minecraft:air");
      hooks.onRemoved(c);
      if (i % 4 === 0) dim.spawnParticle("minecraft:large_explosion", { x: c.x + 0.5, y: c.y + 0.5, z: c.z + 0.5 });
      if (Math.random() < COLLAPSE.rubbleKept) dropRubble(dim, c.x, c.y, c.z);
    }
    if (++i % 40 === 0) yield;
  }
}

// One block of rubble falls from (x, y, z) to the ground and slides into a slope
function dropRubble(dim, x, y, z) {
  const top = (cx, cz) => {
    for (let cy = y; cy > y - 32; cy--) {
      const b = readBlock(dim, cx, cy - 1, cz);
      if (!b || !isFree(b)) return cy;
    }
    return y - 32;
  };
  const spot = slideRubble(x, z, top, (bx, by, bz) => !isFree(readBlock(dim, bx, by, bz)));
  const block = readBlock(dim, spot.x, spot.y, spot.z);
  if (!block || !isFree(block) || spot.y > y) return;
  block.setType(Math.random() < 0.6 ? "minecraft:cobblestone" : "minecraft:gravel");
}

// ---------- In-game test ----------
system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "siege:collapse_test") return;
  const player = event.sourceEntity;
  if (player?.typeId !== "minecraft:player") return;
  // a 9 long, 7 high, 2 thick stone brick wall 6 blocks in front, then its middle base is knocked out
  const v = player.getViewDirection();
  const along = Math.abs(v.x) > Math.abs(v.z) ? { x: 0, z: 1 } : { x: 1, z: 0 };
  const out = Math.abs(v.x) > Math.abs(v.z) ? { x: Math.sign(v.x), z: 0 } : { x: 0, z: Math.sign(v.z) };
  const base = { x: Math.floor(player.location.x) + out.x * 6, y: Math.floor(player.location.y), z: Math.floor(player.location.z) + out.z * 6 };
  const dim = player.dimension;
  system.runJob((function* () {
    for (let i = -4; i <= 4; i++) for (let y = 0; y < 7; y++) for (let t = 0; t < 2; t++) {
      dim.getBlock({ x: base.x + along.x * i + out.x * t, y: base.y + y, z: base.z + along.z * i + out.z * t })?.setType("minecraft:stone_bricks");
    }
    yield;
    player.sendMessage("§7Test wall built. Knocking out its base in 2 seconds...");
    system.runTimeout(() => {
      for (let i = -2; i <= 2; i++) for (let y = 0; y < 3; y++) for (let t = 0; t < 2; t++) {
        const at = { x: base.x + along.x * i + out.x * t, y: base.y + y, z: base.z + along.z * i + out.z * t };
        dim.getBlock(at)?.setType("minecraft:air");
        queueCollapse(dim, at, "minecraft:stone_bricks");
      }
    }, 40);
  })());
});

// ---------- Self-tests ----------
function wall(len, high, thick = 2) {
  const cells = new Map(), solidBelow = new Set();
  for (let x = 0; x < len; x++) for (let y = 0; y < high; y++) for (let z = 0; z < thick; z++) {
    const c = { x, y, z, gate: false, tier: 0, share: 0 };
    cells.set(key(x, y, z), c);
    if (y === 0) solidBelow.add(c);
  }
  return { cells, solidBelow };
}
function cut(w, pred) {
  const removed = [];
  for (const [k, c] of [...w.cells]) if (pred(c)) { w.cells.delete(k); w.solidBelow.delete(c); removed.push({ x: c.x, y: c.y, z: c.z }); }
  return removed;
}

addTests("siege", {
  "collapse: a whole wall stands and nothing crushes": () => {
    const w = wall(20, 9);
    const r = judge(w.cells, w.solidBelow);
    assertEqual(r.loose.length, 0);
    assertEqual(r.crushed.length, 0);
  },
  "collapse: a narrow hole leaves the stone above it standing": () => {
    const w = wall(20, 9);
    const removed = cut(w, (c) => c.x >= 9 && c.x <= 10 && c.y <= 1);
    assertEqual(judge(w.cells, w.solidBelow, removed).loose.length, 0);
  },
  "collapse: a wide breach drops a stepped triangle and the top arches over": () => {
    const w = wall(24, 12);
    const removed = cut(w, (c) => c.x >= 8 && c.x <= 15 && c.y <= 1);
    const loose = judge(w.cells, w.solidBelow, removed).loose;
    assert(loose.length > 0, "something falls");
    assert(loose.every((c) => c.x >= 8 && c.x <= 15), "only over the hole");
    assert(!loose.some((c) => c.y === 11), "the top course still arches over");
    const lowRow = loose.filter((c) => c.y === 2).length, highRow = loose.filter((c) => c.y === 4).length;
    assert(highRow < lowRow, `narrower higher up (${lowRow} then ${highRow})`);
  },
  "collapse: a block held out by mortar alone with a tall stack on it tears away": () => {
    const w = wall(4, 12, 1);
    const removed = cut(w, (c) => c.x >= 2 && c.y <= 1); // the last two columns lose their base: x2 sits on a shoulder, x3 hangs
    const loose = judge(w.cells, w.solidBelow, removed).loose;
    assert(loose.some((c) => c.x === 3), "the hanging column comes down");
  },
  "collapse: cracked blocks under a heavy load crush, whole ones don't": () => {
    const w = wall(1, 40, 1);
    assertEqual(judge(w.cells, w.solidBelow).crushed.length, 0);
    w.cells.get(key(0, 0, 0)).share = 0.9;
    assertEqual(judge(w.cells, w.solidBelow).crushed.length, 1);
  },
  "collapse: a roof or overhang that was built that way stays up after a hit somewhere else": () => {
    const w = wall(12, 5, 1);
    for (let x = 0; x < 12; x++) w.cells.set(key(x, 5, 1), { x, y: 5, z: 1, gate: false, tier: 0, share: 0 }); // eave
    for (let x = 0; x < 12; x++) w.cells.set(key(x, 6, 2), { x, y: 6, z: 2, gate: false, tier: 0, share: 0 }); // stepped out again
    w.cells.delete(key(0, 0, 0)); w.solidBelow.forEach((c) => { if (c.x === 0 && c.y === 0) w.solidBelow.delete(c); });
    assertEqual(judge(w.cells, w.solidBelow, [{ x: 0, y: 0, z: 0 }]).loose.length, 0);
  },
  "collapse: ...but it comes down once the wall it hangs from is gone": () => {
    const w = wall(3, 5, 1);
    for (let x = 0; x < 3; x++) w.cells.set(key(x, 5, 1), { x, y: 5, z: 1, gate: false, tier: 0, share: 0 });
    for (let x = 0; x < 3; x++) w.cells.set(key(x, 6, 2), { x, y: 6, z: 2, gate: false, tier: 0, share: 0 });
    const removed = cut(w, (c) => c.z === 0 && c.y <= 1);
    const loose = judge(w.cells, w.solidBelow, removed).loose;
    assert(loose.some((c) => c.z === 2), "the overhang falls with the wall");
  },
  "collapse: what counts as built wall": () => {
    assert(isStructural("minecraft:stone_bricks") && isStructural("minecraft:cobblestone_wall") && isStructural("minecraft:stripped_oak_log"));
    assert(!isStructural("minecraft:stone") && !isStructural("minecraft:oak_log") && !isStructural("minecraft:dirt") && !isStructural("minecraft:oak_door"));
    assert(!isStructural("minecraft:grass_block") && !isStructural("minecraft:glass_pane"));
    assert(isStructural("siege:wall_planks_vale") && isStructural("siege:castle_gate"));
  },
});
