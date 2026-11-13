// Builds the Undertow as players move through it: terrain chunks near players, plus the fixed
// set pieces (the Wound's return crack, waystones, the Drowned Court, the Choir's Heart).
// Work is spread over ticks with a block budget so the Realm never stalls.

import { world, BlockVolume, BlockPermutation } from "@minecraft/server";
import { UNDERTOW_ID, UNDERTOW_LAYOUT as L, COURT, HEART, pathX } from "./layout.js";
import { planChunk, planRoofSwap, chunkInRange, heightAt, columnAt, roofAt, heartEdge, HEART_EDGE_Z, B, ROOF, BACK } from "./terrain.js";
import { planCrack, placeCells } from "./rift.js";
import { planWound, planArrivalClear, WOUND } from "./wound.js";
import { ARRIVAL } from "./arrival.js";
import { SEAL_RIVER_X } from "./rivers.js";
import { SITES, signposts } from "./roads.js";
import { hash } from "./noise.js";
import { STRUCTURE_IDS, planStructure } from "./structures.js";
import { SITE_DESIGNS, TOWER_DESIGNS } from "./sites_data.js";
import { DROWNED_SPOTS } from "./drowned.js";
import { COURT_DESIGN, SEAT_DESIGN, APPROACH_DESIGN } from "./arenas_data.js";
import { stamp } from "./stamp.js";
import { chasmOps, chasmChunk, CHASM_CHUNKS } from "./chasm.js";
import { load, save, runCmd } from "./data.js";
import { sfx } from "../core/sfx.js";

const K_BUILT = "hc:undertow_built3"; // hex bitset of finished chunks
// Chunks finished by an older generator (before the roof, the new trees and ground, 2026-11-11). They
// are cleared from the ground up and built again the new way when someone comes near.
const K_BUILT_OLD = "hc:undertow_built2";
// Chunks that have the high roof (2026-11-12). A chunk built before it keeps its land and has only its
// low roof swapped (terrain.js planRoofSwap). A chunk built from scratch gets the high roof at once.
const K_ROOF = "hc:undertow_roof4";
const K_PIECES = "hc:undertow_pieces2"; // { wound, court, heart, waystones: [..] }
const K_PIECES_OLD = "hc:undertow_pieces"; // the armour stands of the Standing Ranks carry over (they are entities)
const CX_MIN = -44, CX_MAX = 43, CZ_MIN = -3, CZ_MAX = 153;
const ROW = CZ_MAX - CZ_MIN + 1;
const OPS_PER_TICK = 250;
// Mateo, 2026-11-12: "Why can't I see farther than this?" The Hollow only exists where this script has
// built it, and it used to build just 3 chunks round each player (a Realm keeps 4 loaded), so past
// about 48 blocks there was nothing but fog colour. Now:
//  - NEAR: the chunks round a player come first (always loaded, no ticking area needed);
//  - FAR: then land out to FAR chunks (about 200 blocks), nearest and in front of the player first;
//  - then the rest of the Hollow in the background while anyone is down here, until all of it exists.
// Far land is built one TILE x TILE block of chunks at a time, held loaded by one ticking area, so it
// never depends on the player's simulation distance (which a Realm locks at 4).
const RADIUS = 3; // NEAR: chunks round each player
const FAR = 13; // chunks: built before the background fill
const TILE = 5; // far tiles are 5x5 chunks (80x80 blocks, well under the 100-chunk ticking area cap)
const FAR_AREA = "hc_undertow_far";
const TX_MIN = Math.floor(CX_MIN / TILE), TX_MAX = Math.floor(CX_MAX / TILE);
const TZ_MIN = Math.floor(CZ_MIN / TILE), TZ_MAX = Math.floor(CZ_MAX / TILE);

export const WAYSTONE = "siege:waystone";
export const SEAL = "siege:court_seal";

let bits, oldBits, roofBits; // Uint8Array
let dirty = false;
const readBits = (key) => {
  const n = Math.ceil(((CX_MAX - CX_MIN + 1) * ROW) / 8);
  const out = new Uint8Array(n);
  const hex = load(key, "");
  for (let i = 0; i < n && i * 2 < hex.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16) || 0;
  return out;
};
function loadBits() {
  bits = readBits(K_BUILT);
  oldBits = readBits(K_BUILT_OLD);
  roofBits = readBits(K_ROOF);
}
// True if this chunk still holds the old generator's land (so it must be cleared before building).
function builtOld(cx, cz) {
  if (!bits) loadBits();
  if (cx < CX_MIN || cx > CX_MAX || cz < CZ_MIN || cz > CZ_MAX) return false;
  const i = idx(cx, cz);
  return (oldBits[i >> 3] >> (i & 7)) & 1;
}
// Clearing ops for an old chunk: air from its lowest ground up to the roof (two fills, each under the
// game's 32,768-block limit). The new plan fills every column back from that height.
export function clearOps(cx, cz, lowest) {
  const X0 = cx * 16, Z0 = cz * 16, y0 = Math.max(L.floorY, lowest), y2 = ROOF.top, mid = Math.floor((y0 + y2) / 2);
  return [
    { a: [X0, y0, Z0], b: [X0 + 15, mid, Z0 + 15], block: "minecraft:air" },
    { a: [X0, mid + 1, Z0], b: [X0 + 15, y2, Z0 + 15], block: "minecraft:air" },
  ];
}
const idx = (cx, cz) => (cx - CX_MIN) * ROW + (cz - CZ_MIN);
export function isBuilt(cx, cz) {
  if (!bits) loadBits();
  if (cx < CX_MIN || cx > CX_MAX || cz < CZ_MIN || cz > CZ_MAX) return true;
  const i = idx(cx, cz);
  return (bits[i >> 3] >> (i & 7)) & 1;
}
// True if this chunk still has the low roof of 2026-11-11 over its land.
function lowRoof(cx, cz) {
  if (!isBuilt(cx, cz)) return false;
  if (cx < CX_MIN || cx > CX_MAX || cz < CZ_MIN || cz > CZ_MAX) return false;
  const i = idx(cx, cz);
  return !((roofBits[i >> 3] >> (i & 7)) & 1);
}
// Work left in this chunk: not built at all, or built under the low roof.
const needsWork = (cx, cz) => chunkInRange(cx, cz) && (!isBuilt(cx, cz) || lowRoof(cx, cz) || toRedo(cx, cz));
function markBuilt(cx, cz) {
  const i = idx(cx, cz);
  bits[i >> 3] |= 1 << (i & 7);
  roofBits[i >> 3] |= 1 << (i & 7);
  dirty = true;
}
const hex = (b) => Array.from(b, (v) => v.toString(16).padStart(2, "0")).join("");
function flushBits() {
  if (!dirty) return;
  save(K_BUILT, hex(bits));
  save(K_ROOF, hex(roofBits));
  dirty = false;
}

export const pieces = () => load(K_PIECES, undefined) ?? { wound: false, court: false, heart: false, waystones: [], ranks: !!load(K_PIECES_OLD, {}).ranks };
const savePieces = (p) => save(K_PIECES, p);

const dim = () => world.getDimension(UNDERTOW_ID);

// Block states resolved once each (trees use a few dozen).
const perms = new Map();
function permOf(block, states) {
  const key = block + JSON.stringify(states);
  if (!perms.has(key)) {
    let perm;
    try { perm = BlockPermutation.resolve(block, states); } catch { perm = null; }
    perms.set(key, perm);
  }
  return perms.get(key);
}

// Apply one fill op. Returns false if its area isn't loaded (try again later). An op marked optional
// (a light block, a tree, an amethyst drip) never holds a chunk up: if it fails, it is skipped.
function apply(d, op) {
  const [x1, y1, z1] = op.a, [x2, y2, z2] = op.b;
  if (op.onlyIf) {
    // Clear only the blocks that are still op.onlyIf (what hung from the old low roof).
    try {
      for (let x = x1; x <= x2; x++) for (let y = y1; y <= y2; y++) for (let z = z1; z <= z2; z++) {
        const b = d.getBlock({ x, y, z });
        if (!b) return false;
        if (b.typeId === op.onlyIf) b.setType(op.block);
      }
      return true;
    } catch { return false; }
  }
  if (op.optional) {
    // Only skip a failure in a loaded area: an unloaded one is tried again later like any other op.
    let at;
    try { at = d.getBlock({ x: x1, y: y1, z: z1 }); } catch { return false; }
    if (!at) return false;
    if (op.ifAir && !at.isAir) return true; // a light never replaces something already built there
  }
  try {
    const one = x1 === x2 && y1 === y2 && z1 === z2;
    // Blocks with states (an amethyst growth pointing up, a tree's stairs). If the game does not know
    // the state, place the plain block rather than stalling the chunk.
    const perm = op.states ? permOf(op.block, op.states) : null;
    if (perm) {
      if (one) d.setBlockPermutation({ x: x1, y: y1, z: z1 }, perm);
      else d.fillBlocks(new BlockVolume({ x: x1, y: y1, z: z1 }, { x: x2, y: y2, z: z2 }), perm);
    } else if (one) d.setBlockType({ x: x1, y: y1, z: z1 }, op.block);
    else d.fillBlocks(new BlockVolume({ x: x1, y: y1, z: z1 }, { x: x2, y: y2, z: z2 }), op.block);
    return true;
  } catch {
    return !!op.optional;
  }
}

let job; // { cx, cz, ops, i } for a chunk, or { ops, i, done, fail } for a set piece
const extra = []; // set pieces waiting their turn
let woundQueued = false;
// Chunks built before a change to the land that only ADDS rock are planned again over what stands there. They stay
// "built" (their land is there) but are not settled until that is done, so nothing is cut into them first.
const K_AGAIN = "hc:undertow_again1"; // [chunk index]
let again;
const againSet = () => again ?? (again = new Set(load(K_AGAIN, [])));
const toRedo = (cx, cz) => cx >= CX_MIN && cx <= CX_MAX && cz >= CZ_MIN && cz <= CZ_MAX && againSet().has(idx(cx, cz));
function planAgain(x1, z1, x2, z2) {
  for (let cx = Math.floor(x1 / 16); cx <= Math.floor(x2 / 16); cx++) for (let cz = Math.floor(z1 / 16); cz <= Math.floor(z2 / 16); cz++) {
    if (cx < CX_MIN || cx > CX_MAX || cz < CZ_MIN || cz > CZ_MAX || !isBuilt(cx, cz)) continue;
    againSet().add(idx(cx, cz));
  }
  doneTiles.clear();
  save(K_AGAIN, [...againSet()]);
}

// How near a chunk is to a player, counting chunks in front of them as nearer (up to 2.5x), so the
// land you are looking at is built first.
function nearness(players, cx, cz) {
  let best = Infinity;
  for (const p of players) {
    const dx = cx + 0.5 - p.location.x / 16, dz = cz + 0.5 - p.location.z / 16;
    const d2 = dx * dx + dz * dz;
    let dot = 0;
    try {
      const v = p.getViewDirection(), len = Math.hypot(v.x, v.z), dl = Math.sqrt(d2);
      if (len > 0.01 && dl > 0.01) dot = (v.x * dx + v.z * dz) / (len * dl);
    } catch { /* no view: plain distance */ }
    best = Math.min(best, d2 * (1.6 - 0.6 * dot)); // in front: 1.0x, behind: 2.2x
  }
  return best;
}

let far; // { tx, tz, readyAt, recheckAt, fails } the tile held loaded by the ticking area
const doneTiles = new Set(); // tiles found fully built (skipped by later searches)

function tileOpen(tx, tz) {
  if (doneTiles.has(tx * 1000 + tz)) return false;
  for (let i = 0; i < TILE; i++) for (let j = 0; j < TILE; j++) {
    const cx = tx * TILE + i, cz = tz * TILE + j;
    if (needsWork(cx, cz)) return true;
  }
  doneTiles.add(tx * 1000 + tz);
  return false;
}

function releaseFar(d) {
  if (!far) return;
  runCmd(d, `tickingarea remove ${FAR_AREA}`);
  far = undefined;
}

// The next tile to hold loaded: the nearest unfinished one within FAR, else the nearest anywhere.
function pickTile(players) {
  let best, bestD = Infinity;
  for (let tx = TX_MIN; tx <= TX_MAX; tx++) for (let tz = TZ_MIN; tz <= TZ_MAX; tz++) {
    const n = nearness(players, tx * TILE + TILE / 2 - 0.5, tz * TILE + TILE / 2 - 0.5);
    if (n < bestD && tileOpen(tx, tz)) { bestD = n; best = [tx, tz]; }
  }
  return best;
}

function nextChunk(players, d) {
  // Wound chunks first, then the nearest unbuilt chunk round any player in the Undertow.
  let best, bestD = Infinity;
  const consider = (cx, cz, n) => {
    if (!needsWork(cx, cz)) return;
    if (n < bestD) { bestD = n; best = [cx, cz]; }
  };
  for (let cx = -2; cx <= 1; cx++) for (let cz = -3; cz <= 2; cz++) consider(cx, cz, -1);
  if (best) return best;
  for (const p of players) {
    const pcx = Math.floor(p.location.x / 16), pcz = Math.floor(p.location.z / 16);
    for (let dx = -RADIUS; dx <= RADIUS; dx++) for (let dz = -RADIUS; dz <= RADIUS; dz++) consider(pcx + dx, pcz + dz, nearness(players, pcx + dx, pcz + dz));
  }
  if (best) return best;
  if (!players.length) { releaseFar(d); return undefined; } // nobody down here: let the far land rest
  // Far land. Move the ticking area on when its tile is done, or is now far behind a closer open tile.
  if (far && (!tileOpen(far.tx, far.tz) || far.fails > 30)) releaseFar(d);
  if (far && tickNo >= far.recheckAt) {
    far.recheckAt = tickNo + 100;
    const t = pickTile(players);
    if (t && (t[0] !== far.tx || t[1] !== far.tz) && nearness(players, far.tx * TILE + 2, far.tz * TILE + 2) > FAR * FAR) releaseFar(d);
  }
  if (!far) {
    const t = pickTile(players);
    if (!t) return undefined; // the whole Hollow is built
    const [tx, tz] = t, x0 = tx * TILE * 16, z0 = tz * TILE * 16;
    runCmd(d, `tickingarea remove ${FAR_AREA}`);
    runCmd(d, `tickingarea add ${x0} 0 ${z0} ${x0 + TILE * 16 - 1} 0 ${z0 + TILE * 16 - 1} ${FAR_AREA} true`);
    far = { tx, tz, readyAt: tickNo + 40, recheckAt: tickNo + 100, fails: 0 };
  }
  if (tickNo < far.readyAt) return undefined; // the tile is still loading
  for (let i = 0; i < TILE; i++) for (let j = 0; j < TILE; j++) {
    const cx = far.tx * TILE + i, cz = far.tz * TILE + j;
    consider(cx, cz, nearness(players, cx, cz));
  }
  return best;
}

// Called every tick from index.js.
let waitUntil = 0, tickNo = 0;
export function buildTick(players) {
  if (++tickNo < waitUntil) return;
  const d = dim();
  if (!job && extra.length) job = extra.shift(); // a set piece too big for one tick (the Wound's cave)
  if (!job) {
    const next = nextChunk(players, d);
    if (next) {
      const swap = lowRoof(next[0], next[1]), redo = toRedo(next[0], next[1]);
      // planned again: the old low roof (if it is still there) is taken away first, then the whole chunk is planned over the land that stands
      // (and at the arrival, the first ledge's box and ramp and the trees that stood where the stair is now)
      const ops = redo ? [...(swap ? planRoofSwap(next[0], next[1]).filter((o) => o.block === "minecraft:air") : []), ...planArrivalClear(next[0], next[1]), ...planChunk(next[0], next[1])]
        : swap ? planRoofSwap(next[0], next[1]) : planChunk(next[0], next[1]);
      if (!swap && builtOld(next[0], next[1])) ops.unshift(...clearOps(next[0], next[1], lowestGround(next[0], next[1])));
      job = { cx: next[0], cz: next[1], ops, i: 0 };
    }
  }
  if (job) {
    let budget = OPS_PER_TICK;
    while (budget-- > 0 && job.i < job.ops.length) {
      if (!apply(d, job.ops[job.i])) { // not loaded yet: retry in 2 s
        if (far && Math.floor(job.cx / TILE) === far.tx && Math.floor(job.cz / TILE) === far.tz) far.fails++;
        job.fail?.(); job = undefined; waitUntil = tickNo + 40; return;
      }
      job.i++;
    }
    if (job.i >= job.ops.length) {
      if (job.done) job.done();
      else { markBuilt(job.cx, job.cz); if (toRedo(job.cx, job.cz)) { againSet().delete(idx(job.cx, job.cz)); save(K_AGAIN, [...againSet()]); } }
      job = undefined;
    }
  } else chasmTick(d, players);
}

// ---- the chasm under the Seat (chasm.js) ----------------------------------------------------
// Built a chunk at a time near players, after that chunk's own land, whenever no land is waiting to be built. Its
// own list of finished chunks, so a world that built this end of the Hollow before the chasm existed gets it too.
const K_CHASM = "hc:undertow_chasm1";
let chasmDone, chasmJob, chasmDirty = false;
const chasmKey = (cx, cz) => (cx - CHASM_CHUNKS.cx0) * 64 + (cz - CHASM_CHUNKS.cz0);
function nextChasmChunk(players) {
  if (!chasmDone) chasmDone = new Set(load(K_CHASM, []));
  let best, bestD = Infinity;
  for (const p of players) {
    const pcx = Math.floor(p.location.x / 16), pcz = Math.floor(p.location.z / 16);
    if (!chasmChunk(Math.max(CHASM_CHUNKS.cx0, Math.min(CHASM_CHUNKS.cx1, pcx)), Math.max(CHASM_CHUNKS.cz0, Math.min(CHASM_CHUNKS.cz1, pcz + RADIUS)))) continue;
    for (let dx = -RADIUS; dx <= RADIUS; dx++) for (let dz = -RADIUS; dz <= RADIUS; dz++) {
      const cx = pcx + dx, cz = pcz + dz, d = dx * dx + dz * dz;
      if (d >= bestD || !chasmChunk(cx, cz) || chasmDone.has(chasmKey(cx, cz)) || !isBuilt(cx, cz)) continue;
      // The chunks along the cliff wait until an old world's straight edge has been cut back (buildApproach).
      if (cz * 16 < HEART_EDGE_Z && !edgeCut()) continue;
      bestD = d; best = [cx, cz];
    }
  }
  return best;
}
let edgeIsCut = false;
const edgeCut = () => edgeIsCut || (edgeIsCut = (pieces().approachV ?? 0) >= 1);
function chasmTick(d, players) {
  if (!chasmJob) {
    const next = nextChasmChunk(players);
    if (!next) return;
    chasmJob = { cx: next[0], cz: next[1], ops: chasmOps(next[0], next[1]), i: 0 };
  }
  let budget = OPS_PER_TICK;
  while (budget-- > 0 && chasmJob.i < chasmJob.ops.length) {
    if (!apply(d, chasmJob.ops[chasmJob.i])) { chasmJob = undefined; waitUntil = tickNo + 40; return; }
    chasmJob.i++;
  }
  if (chasmJob.i >= chasmJob.ops.length) { chasmDone.add(chasmKey(chasmJob.cx, chasmJob.cz)); chasmDirty = true; chasmJob = undefined; }
}

export function flush() {
  flushBits();
  if (chasmDirty) { save(K_CHASM, [...chasmDone]); chasmDirty = false; }
}

// The lowest ground in a chunk (where clearing an old chunk starts).
function lowestGround(cx, cz) {
  let low = Infinity;
  for (let i = 0; i < 16; i += 3) for (let j = 0; j < 16; j += 3) {
    const h = heightAt(cx * 16 + i, cz * 16 + j);
    if (h !== null) low = Math.min(low, h);
  }
  for (const [i, j] of [[15, 15], [15, 0], [0, 15]]) { const h = heightAt(cx * 16 + i, cz * 16 + j); if (h !== null) low = Math.min(low, h); }
  return low === Infinity ? L.floorY : low - 1;
}

// ---- set pieces ---------------------------------------------------------------------------

const chunksBuilt = (x1, z1, x2, z2) => {
  for (let cx = Math.floor(x1 / 16); cx <= Math.floor(x2 / 16); cx++)
    for (let cz = Math.floor(z1 / 16); cz <= Math.floor(z2 / 16); cz++) if (!isBuilt(cx, cz) || toRedo(cx, cz)) return false;
  return true;
};

export function waystoneSpot(i) {
  const z = L.waystoneZ[i];
  const x = pathX(z) + 3; // just beside the path
  const h = heightAt(x, z) ?? heightAt(pathX(z), z) ?? 90;
  return { x, y: h + 1, z };
}

// Where the armour stands of the Standing Ranks go (pure: the same every time).
export function ranksSpots() {
  const s = SITES.find((x) => x.id === "standing_ranks"), out = [];
  for (let i = -5; i <= 5; i++) for (let j = -5; j <= 5; j++) {
    const x = s.x + i * 6 + Math.round((hash(i, j, 701) - 0.5) * 2), z = s.z + j * 6 + Math.round((hash(i, j, 702) - 0.5) * 3);
    if (Math.hypot(x - s.x, z - s.z) > s.r - 5 || hash(i, j, 703) < 0.12) continue; // a few gaps in the rows
    out.push({ x: x + 0.5, y: s.y + 1, z: z + 0.5 });
  }
  return out;
}

export function piecesTick() {
  const d = dim();
  const p = pieces();
  let changed = false;

  // The Wound: the cave behind the arrival ledge with the tear at the back of it (wound.js). A world that built the
  // first one (a crack on a flat wall, before 2026-11-12) has the back cliff planned again, which only adds rock,
  // and the cave cut into it.
  const woundV = p.woundV ?? (p.wound ? 1 : 0);
  if (woundV < WOUND.v) {
    if (!p.arrivalRedo) {
      // land built before the cave (v1) or before the stair (v1, v2) is planned again; a new world has none built yet
      if (woundV === 1 && !p.woundRedo) planAgain(-BACK.reach, L.zStart, BACK.reach, BACK.z);
      planAgain(ARRIVAL.x0 - 6, ARRIVAL.z0, ARRIVAL.x1 + 6, ARRIVAL.z1 + 6);
      p.waystones = p.waystones.filter((i) => i !== 0); // the first waystone stood on the old ramp: it is set again on the ledge
      p.woundRedo = true; p.arrivalRedo = true; changed = true;
    } else if (!woundQueued && chunksBuilt(...WOUND.box)) {
      woundQueued = true;
      extra.push({ ops: planWound(), i: 0, fail: () => { woundQueued = false; }, done: () => { const q = pieces(); q.wound = true; q.woundV = WOUND.v; savePieces(q); woundQueued = false; } });
    }
  }

  // Waystones, each once its chunk is built.
  L.waystoneZ.forEach((z, i) => {
    if (p.waystones.includes(i)) return;
    const s = waystoneSpot(i);
    if (!chunksBuilt(s.x - 2, s.z - 2, s.x + 2, s.z + 2)) return;
    const ok = apply(d, { a: [s.x - 1, s.y - 1, s.z - 1], b: [s.x + 1, s.y - 1, s.z + 1], block: "minecraft:polished_blackstone_bricks" })
      && apply(d, { a: [s.x - 1, s.y, s.z - 1], b: [s.x + 1, s.y + 3, s.z + 1], block: "minecraft:air" })
      && apply(d, { a: [s.x, s.y, s.z], b: [s.x, s.y, s.z], block: WAYSTONE });
    if (ok) { p.waystones.push(i); changed = true; }
  });

  // Signposts at both ends of every road, each once its ground is built.
  signposts().forEach((s, i) => {
    if ((p.signs ?? []).includes(i) || !chunksBuilt(s.x, s.z, s.x, s.z)) return;
    if (placeSignpost(d, s)) { p.signs = [...(p.signs ?? []), i]; changed = true; }
  });

  // The Standing Ranks: rows of empty armour, each a little out of line, all facing the Seat.
  const ranks = SITES.find((s) => s.id === "standing_ranks");
  if (!p.ranks && chunksBuilt(ranks.x - ranks.r, ranks.z - ranks.r, ranks.x + ranks.r, ranks.z + ranks.r)) {
    try {
      for (const at of ranksSpots()) d.spawnEntity("minecraft:armor_stand", at).setRotation({ x: 0, y: 0 });
      p.ranks = true; changed = true;
    } catch { /* not loaded yet: try again when someone is near */ }
  }

  // What stands at each hand-designed place, once its ground is built.
  // A site whose design has a newer version than the one this world built is stamped again over the old look.
  for (const id of STRUCTURE_IDS) {
    const built = (p.sites ?? []).includes(id), design = SITE_DESIGNS[id];
    if (built && !siteOutdated(p, id)) continue;
    const s = SITES.find((x) => x.id === id), reach = Math.max(s.r + 4, design?.reach ?? 0);
    if (!chunksBuilt(s.x - reach, s.z - reach, s.x + reach, s.z + reach)) continue;
    if (design) {
      stampOnce(d, `site:${id}`, built ? withClearing(design) : design, s, (q) => {
        q.sites = [...new Set([...(q.sites ?? []), id])];
        if (design.v) q.siteV = { ...(q.siteV ?? {}), [id]: design.v };
      });
      continue;
    }
    if (fillAll(d, planStructure(id))) { p.sites = [...(p.sites ?? []), id]; changed = true; }
  }

  // Hallowmere's drowned city: leaning towers on the marsh banks by the Court landing.
  DROWNED_SPOTS.forEach((t, i) => {
    if ((p.drowned ?? []).includes(i) || !chunksBuilt(t.x - 8, t.z - 8, t.x + 8, t.z + 8)) return;
    stampOnce(d, `tower:${i}`, TOWER_DESIGNS[t.design], t, (q) => { q.drowned = [...(q.drowned ?? []), i]; });
  });

  // The Drowned Court and the sealed wall across the valley.
  // A world that built the first, plain look (before 2026-11-12) has it cleared and the new one stamped over it.
  const courtOld = p.court && (p.courtV ?? 1) < COURT_DESIGN.v;
  if ((!p.court || courtOld) && chunksBuilt(-COURT.radius - 2, COURT.center.z - COURT.radius - 12, COURT.radius + 2, COURT.gateZ + 14)) buildCourt(d, courtOld);

  // The Seat (the Choir's Heart in the code). Nobody can stand near enough to build the chunks it hangs in,
  // so they are built for it (seatEnd below) as soon as anyone comes up the Long Climb.
  const heartOld = p.heart && (p.heartV ?? 1) < SEAT_DESIGN.v;
  const heartDue = !p.heart || heartOld, approachDue = (p.approachV ?? 0) < APPROACH_DESIGN.v;
  seatEnd(d, heartDue || approachDue);
  ranksGround(d, p);
  if (heartDue && chunksBuilt(-40, 2300, 40, 2440)) buildHeart(d, heartOld);
  // The way across to it, once the cliff it leaves from and the air it hangs in are built.
  if (approachDue && chunksBuilt(SEAT_BOX.x1, SEAT_BOX.z1, SEAT_BOX.x2, HEART_EDGE_Z + 40)) buildApproach(d);
  carveRest(d);
  if (changed) savePieces(p);
}

// ---- the end of the Long Climb -------------------------------------------------------------
// Mateo, 2026-11-12: "i got to the end of the path and what now?" The path ran out at the cliff with nothing
// past it. The Seat and the way across waited for every chunk round them to be built, but land is only built
// round players: the Seat hangs over the void where nobody can stand, and the way across also waited for the
// whole 300-block cliff edge. Now, whenever someone comes up the end of the Long Climb and either is still
// missing, the box they stand in (SEAT_BOX) is held loaded by a ticking area and its chunks are built one by
// one; then both are stamped. The rest of the cliff edge is carved on its own, as its land gets built.
export const SEAT_BOX = { x1: -64, z1: HEART_EDGE_Z - 40, x2: 68, z2: HEART.center.z + HEART.outerRadius + 10 };
export const SEAT_NEAR = 160; // how close to the cliff end (blocks) a player must be for the Seat to be built
// The chunks of a box not built yet, in rows from its low-z side. Pure on isBuilt.
export function boxChunksLeft(box, built = isBuilt) {
  const out = [];
  for (let cz = Math.floor(box.z1 / 16); cz <= Math.floor(box.z2 / 16); cz++)
    for (let cx = Math.floor(box.x1 / 16); cx <= Math.floor(box.x2 / 16); cx++)
      if (chunkInRange(cx, cz) && !built(cx, cz)) out.push([cx, cz]);
  return out;
}
export const seatChunksLeft = (built = isBuilt) => boxChunksLeft(SEAT_BOX, built);
// Is anyone near enough to the end of the Long Climb to need the Seat? Pure.
export const nearSeatEnd = (locs) => locs.some((l) => Math.abs(l.x) < L.halfWidth + 40 && l.z > HEART_EDGE_Z - SEAT_NEAR);

// Hold a box loaded with a ticking area while it is wanted, and build its chunks one at a time.
const held = {}; // area name -> true/false (undefined until the first check this session: a leftover area is cleared)
function holdAndBuild(d, area, box, want) {
  const cmd = (c) => { try { d.runCommand(c); } catch { /* no area by that name, or the command is busy */ } };
  if (!want) {
    if (held[area] !== false) { cmd(`tickingarea remove ${area}`); held[area] = false; }
    return;
  }
  if (!held[area]) {
    cmd(`tickingarea remove ${area}`);
    cmd(`tickingarea add ${box.x1} 0 ${box.z1} ${box.x2} 0 ${box.z2} ${area} true`);
    held[area] = true;
  }
  if (job) return; // the builder is busy: next time
  const next = boxChunksLeft(box)[0];
  if (!next) return;
  const ops = planChunk(next[0], next[1]);
  if (builtOld(next[0], next[1])) ops.unshift(...clearOps(next[0], next[1], lowestGround(next[0], next[1])));
  job = { cx: next[0], cz: next[1], ops, i: 0 }; // buildTick carries it out (an unloaded chunk is simply tried again)
}

const hollowLocs = () => world.getAllPlayers().filter((pl) => pl.dimension.id === UNDERTOW_ID).map((pl) => pl.location);
function seatEnd(d, due) {
  holdAndBuild(d, "hc_undertow_seat", SEAT_BOX, due && nearSeatEnd(hollowLocs()));
}

// The Standing Ranks are stage 2 of Morvane's fight, but they stand out in the open country east of the Spine,
// where someone who kept to the path has never been, so nothing was built there and the stage was just dark
// (Mateo, 2026-11-12). Once the Choir is silenced, while anyone is in the Hollow, their ground is built.
export const RANKS_SITE = SITES.find((s) => s.id === "standing_ranks");
export const RANKS_BOX = { x1: RANKS_SITE.x - RANKS_SITE.r - 4, z1: RANKS_SITE.z - RANKS_SITE.r - 4, x2: RANKS_SITE.x + RANKS_SITE.r + 4, z2: RANKS_SITE.z + RANKS_SITE.r + 4 };
export const ranksReady = () => !!pieces().ranks && boxChunksLeft(RANKS_BOX).length === 0;
function ranksGround(d, p) {
  const want = !!load("hc:undertow_progress", {}).choir && !(p.ranks && boxChunksLeft(RANKS_BOX).length === 0) && hollowLocs().length > 0;
  holdAndBuild(d, "hc_undertow_ranks", RANKS_BOX, want);
}

// The cliff edge outside SEAT_BOX: carved column by column once the land at that column is built.
// A few columns per call, going round the edge, so a column that is built but not loaded never holds up the rest.
const carvedThisSession = new Set();
let restX = -L.halfWidth;
function carveRest(d) {
  for (let n = 0; n < 8; n++) {
    const x = restX;
    restX = restX >= L.halfWidth ? -L.halfWidth : restX + 1;
    if ((x >= SEAT_BOX.x1 && x <= SEAT_BOX.x2) || carvedThisSession.has(x)) continue;
    if (!chunksBuilt(x, HEART_EDGE_Z - 36, x, HEART_EDGE_Z)) continue;
    if (carveColumn(d, x)) carvedThisSession.add(x);
  }
}

// True when this world built an older version of a site's design (no saved version means version 1).
export function siteOutdated(p, id) {
  const v = SITE_DESIGNS[id]?.v;
  return !!v && (p.siteV?.[id] ?? 1) < v;
}

// A rebuilt design plus air on every cell its first version stood on that the new one leaves empty.
export function withClearing(design) {
  if (!design.clear?.length) return design;
  const air = design.palette.length;
  return { palette: [...design.palette, ["minecraft:air", {}]], rows: [...design.clear.map(([y, z, x0, n]) => [y, z, x0, n, air]), ...design.rows] };
}

// Designed buildings (map/structures/hollow_kit.py) go down a block a tick; each is marked done in the
// saved pieces only when its last block is placed, so an unloaded area is simply tried again later.
const stamping = new Set();
function stampOnce(d, key, design, at, mark) {
  if (stamping.has(key)) return;
  stamping.add(key);
  stamp(d, design, { x: at.x, y: at.y, z: at.z }, (ok) => {
    stamping.delete(key);
    if (!ok) return;
    const q = pieces();
    mark(q);
    savePieces(q);
  });
}

// A dark oak post with a standing sign on top. Returns true once done (or if there is no ground for it:
// such a post is simply left out), false if the area is not loaded yet.
export function signpostOps(s, c) {
  if (!c || c.paved || c.river <= 5 || c.under !== undefined) return null;
  const y = c.h + 1;
  return [
    { a: [s.x, y, s.z], b: [s.x, y + 1, s.z], block: "minecraft:air" },
    { a: [s.x, y, s.z], b: [s.x, y, s.z], block: "minecraft:dark_oak_fence" },
    { a: [s.x, y + 1, s.z], b: [s.x, y + 1, s.z], block: "minecraft:darkoak_standing_sign", states: { ground_sign_direction: s.rot } },
  ];
}
function placeSignpost(d, s) {
  const ops = signpostOps(s, columnAt(s.x, s.z));
  if (!ops) return true;
  if (!fillAll(d, ops)) return false;
  try {
    const sign = d.getBlock({ x: s.x, y: ops[2].a[1], z: s.z })?.getComponent("minecraft:sign");
    if (sign) { sign.setText(s.text); sign.setWaxed(true); }
  } catch { /* a sign without words is still a post */ }
  return true;
}

function fillAll(d, ops) {
  for (const op of ops) if (!apply(d, op)) return false;
  return true;
}

// Oswin's flooded throne hall (map/structures/hollow_arenas.py): a round drowned hall of veinstone and dark
// prismarine, pilasters and lancet niches, eight columns, knee-deep channels, the throne on its dais before the
// sealed gate. The hall's air is dug first, then the design goes down a block at a time (stamp.js).
function buildCourt(d, over) {
  if (stamping.has("court")) return;
  const { x: cx, z: cz } = COURT.center, f = COURT.floorY, r = COURT.radius - 2;
  const ops = [];
  for (let dx = -r; dx <= r; dx++) {
    const h = Math.floor(Math.sqrt(r * r - dx * dx));
    ops.push({ a: [cx + dx, f, cz - h], b: [cx + dx, f + 16, Math.min(cz + h, COURT.gateZ - 3)], block: "minecraft:air" });
  }
  // A causeway behind the gate so the climb starts cleanly
  ops.push({ a: [cx - 3, f - 1, COURT.gateZ + 1], b: [cx + 3, f - 1, COURT.gateZ + 12], block: "minecraft:polished_blackstone_bricks" });
  if (!fillAll(d, ops)) return;
  stampOnce(d, "court", over ? withClearing(COURT_DESIGN) : COURT_DESIGN, { x: cx, y: f, z: cz }, (q) => { q.court = true; q.courtV = COURT_DESIGN.v; });
}

export function openCourtGate(silent = false) {
  const { x: cx } = COURT.center, f = COURT.floorY;
  const d = dim();
  apply(d, { a: [cx - 3, f, COURT.gateZ], b: [cx + 3, f + 8, COURT.gateZ], block: "minecraft:air" });
  // The water gate where the light river runs through the wall (only if that part is built yet;
  // riverGateTick opens it later otherwise).
  openRiverGate();
  if (!silent) try { sfx(d, "block.end_portal.spawn", { x: cx, y: f + 2, z: COURT.gateZ }, { volume: 2, pitch: 0.6 }); } catch {}
}

// The river's way through the sealed wall. Safe to call again and again.
export function openRiverGate() {
  const d = dim(), x = SEAL_RIVER_X, y = L.seaY;
  if (!isBuilt(Math.floor(x / 16), Math.floor(COURT.gateZ / 16))) return false;
  return apply(d, { a: [x - 3, y - 1, COURT.gateZ], b: [x + 3, y, COURT.gateZ], block: "minecraft:water" })
    && apply(d, { a: [x - 3, y + 1, COURT.gateZ], b: [x + 3, y + 5, COURT.gateZ], block: "minecraft:air" });
}

// The Seat (map/structures/hollow_arenas.py): a floating ring of veinstone in the fog, seven Singer pillars with
// crystal crowns, the central disc with its root hanging below and the throne.
function buildHeart(d, over) {
  stampOnce(d, "heart", over ? withClearing(SEAT_DESIGN) : SEAT_DESIGN, HEART.center, (q) => { q.heart = true; q.heartV = SEAT_DESIGN.v; });
}

// The cliff the Long Climb ends in was a straight line at z 2330 until 2026-11-12. A world that built it that way has
// the bays of the new ragged edge (terrain.js heartEdge) dug out of it: for one x, air from the new edge to the old
// one, the whole height of the land. Pure. Empty where the edge has not moved or there was never land.
export function edgeCarveOps(x) {
  const z0 = heartEdge(x), ops = [];
  let from;
  for (let z = z0; z <= HEART_EDGE_Z; z++) {
    const open = z < HEART_EDGE_Z && heightAt(x, z) === null;
    if (open && from === undefined) from = z;
    if (!open && from !== undefined) {
      let top = ROOF.maxBottom;
      for (let k = from; k < z; k++) top = Math.min(top, roofAt(x, k).bottom);
      ops.push({ a: [x, L.floorY, from], b: [x, top - 1, z - 1], block: "minecraft:air" });
      from = undefined;
    }
  }
  return ops;
}
// Dig one column of the old straight edge back to the ragged one; false if it is not loaded yet.
function carveColumn(d, x) {
  for (const op of edgeCarveOps(x)) {
    let rock;
    try { rock = d.getBlock({ x, y: 100, z: op.a[2] }); } catch { return false; }
    if (!rock) return false;
    if (!rock.isAir && !apply(d, op)) return false;
  }
  return true;
}
let carveX = SEAT_BOX.x1;
// A few columns each call, across the way to the Seat (the rest of the edge is carveRest's); true once done.
// Only old rock is dug: a column that is already open 20 blocks down (a world built with the new edge) is left
// alone, so the moss hanging over its cliffs stays.
function carveEdge(d) {
  for (let n = 0; n < 8 && carveX <= SEAT_BOX.x2; n++) {
    if (!carveColumn(d, carveX)) return false;
    carveX++;
  }
  return carveX > SEAT_BOX.x2;
}

// The way to the Seat (hollow_arenas.py approach()): the Last Step's broken gate on a shelf off the cliff, five
// floating rocks joined by hollowwood roots, broken rock adrift in the fog round them. It replaces the six stepping
// stones worlds had before 2026-11-12 (its clear list takes those away).
function buildApproach(d) {
  if (stamping.has("approach") || !carveEdge(d)) return;
  stampOnce(d, "approach", withClearing(APPROACH_DESIGN), HEART.center, (q) => { q.approachV = APPROACH_DESIGN.v; });
}

// Put the Seat back as new (after a failed attempt, or once the fight is won).
export function rebuildHeart() {
  try { buildHeart(dim(), false); } catch { /* not loaded: the next attempt rebuilds it */ }
}

// The Fall: everything in the Heart at or beyond this radius drops away into the fog.
export function dropHeartBand(radius) {
  const { x: cx, y: cy, z: cz } = HEART.center, d = dim(), R = HEART.outerRadius + 1;
  for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) {
    const dd = Math.sqrt(dx * dx + dz * dz);
    if (dd < radius || dd > R) continue;
    apply(d, { a: [cx + dx, cy - 8, cz + dz], b: [cx + dx, cy + 34, cz + dz], block: "minecraft:air" });
  }
}
