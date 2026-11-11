// Builds the Undertow as players move through it: terrain chunks near players, plus the fixed
// set pieces (the Wound's return crack, waystones, the Drowned Court, the Choir's Heart).
// Work is spread over ticks with a block budget so the Realm never stalls.

import { world, BlockVolume, BlockPermutation } from "@minecraft/server";
import { UNDERTOW_ID, UNDERTOW_LAYOUT as L, COURT, HEART, pathX } from "./layout.js";
import { planChunk, chunkInRange, heightAt, B, ROOF } from "./terrain.js";
import { planCrack, placeCells } from "./rift.js";
import { SEAL_RIVER_X } from "./rivers.js";
import { SITES } from "./roads.js";
import { hash } from "./noise.js";
import { STRUCTURE_IDS, planStructure } from "./structures.js";
import { SITE_DESIGNS, TOWER_DESIGNS } from "./sites_data.js";
import { DROWNED_SPOTS } from "./drowned.js";
import { stamp } from "./stamp.js";
import { load, save } from "./data.js";
import { sfx } from "../core/sfx.js";

const K_BUILT = "hc:undertow_built3"; // hex bitset of finished chunks
// Chunks finished by an older generator (before the roof, the new trees and ground, 2026-11-11). They
// are cleared from the ground up and built again the new way when someone comes near.
const K_BUILT_OLD = "hc:undertow_built2";
const K_PIECES = "hc:undertow_pieces2"; // { wound, court, heart, waystones: [..] }
const K_PIECES_OLD = "hc:undertow_pieces"; // the armour stands of the Standing Ranks carry over (they are entities)
const CX_MIN = -44, CX_MAX = 43, CZ_MIN = -3, CZ_MAX = 153;
const ROW = CZ_MAX - CZ_MIN + 1;
const OPS_PER_TICK = 250;
const RADIUS = 3; // chunks around each player (Realms only keep 4 loaded)

export const WAYSTONE = "siege:waystone";
export const SEAL = "siege:court_seal";

let bits, oldBits; // Uint8Array
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
function markBuilt(cx, cz) {
  const i = idx(cx, cz);
  bits[i >> 3] |= 1 << (i & 7);
  dirty = true;
}
function flushBits() {
  if (!dirty) return;
  save(K_BUILT, Array.from(bits, (b) => b.toString(16).padStart(2, "0")).join(""));
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

let job; // { cx, cz, ops, i }

function nextChunk(players) {
  // Nearest unbuilt chunk to any player in the Undertow, Wound chunks first.
  let best, bestD = Infinity;
  const consider = (cx, cz, d) => {
    if (!chunkInRange(cx, cz) || isBuilt(cx, cz)) return;
    if (d < bestD) { bestD = d; best = [cx, cz]; }
  };
  for (let cx = -2; cx <= 1; cx++) for (let cz = -3; cz <= 2; cz++) consider(cx, cz, -1);
  if (best) return best;
  for (const p of players) {
    const pcx = Math.floor(p.location.x / 16), pcz = Math.floor(p.location.z / 16);
    for (let dx = -RADIUS; dx <= RADIUS; dx++) for (let dz = -RADIUS; dz <= RADIUS; dz++) consider(pcx + dx, pcz + dz, dx * dx + dz * dz);
  }
  return best;
}

// Called every tick from index.js.
let waitUntil = 0, tickNo = 0;
export function buildTick(players) {
  if (++tickNo < waitUntil) return;
  const d = dim();
  if (!job) {
    const next = nextChunk(players);
    if (next) {
      const ops = planChunk(next[0], next[1]);
      if (builtOld(next[0], next[1])) ops.unshift(...clearOps(next[0], next[1], lowestGround(next[0], next[1])));
      job = { cx: next[0], cz: next[1], ops, i: 0 };
    }
  }
  if (job) {
    let budget = OPS_PER_TICK;
    while (budget-- > 0 && job.i < job.ops.length) {
      if (!apply(d, job.ops[job.i])) { job = undefined; waitUntil = tickNo + 40; return; } // not loaded yet: retry in 2 s
      job.i++;
    }
    if (job.i >= job.ops.length) {
      markBuilt(job.cx, job.cz);
      job = undefined;
    }
  }
}

export function flush() { flushBits(); }

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
    for (let cz = Math.floor(z1 / 16); cz <= Math.floor(z2 / 16); cz++) if (!isBuilt(cx, cz)) return false;
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

  // The Wound: return crack in the back wall, waystone 0 on the ledge.
  if (!p.wound && chunksBuilt(-24, -48, 24, 40)) {
    const rc = L.returnCrack;
    if (placeCells(d, planCrack(rc, rc.facing))) { p.wound = true; changed = true; }
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

  // The Standing Ranks: rows of empty armour, each a little out of line, all facing the Seat.
  const ranks = SITES.find((s) => s.id === "standing_ranks");
  if (!p.ranks && chunksBuilt(ranks.x - ranks.r, ranks.z - ranks.r, ranks.x + ranks.r, ranks.z + ranks.r)) {
    try {
      for (const at of ranksSpots()) d.spawnEntity("minecraft:armor_stand", at).setRotation({ x: 0, y: 0 });
      p.ranks = true; changed = true;
    } catch { /* not loaded yet: try again when someone is near */ }
  }

  // What stands at each hand-designed place, once its ground is built.
  for (const id of STRUCTURE_IDS) {
    if ((p.sites ?? []).includes(id)) continue;
    const s = SITES.find((x) => x.id === id), reach = s.r + 4;
    if (!chunksBuilt(s.x - reach, s.z - reach, s.x + reach, s.z + reach)) continue;
    if (SITE_DESIGNS[id]) { stampOnce(d, `site:${id}`, SITE_DESIGNS[id], s, (q) => { q.sites = [...(q.sites ?? []), id]; }); continue; }
    if (fillAll(d, planStructure(id))) { p.sites = [...(p.sites ?? []), id]; changed = true; }
  }

  // Hallowmere's drowned city: leaning towers on the marsh banks by the Court landing.
  DROWNED_SPOTS.forEach((t, i) => {
    if ((p.drowned ?? []).includes(i) || !chunksBuilt(t.x - 8, t.z - 8, t.x + 8, t.z + 8)) return;
    stampOnce(d, `tower:${i}`, TOWER_DESIGNS[t.design], t, (q) => { q.drowned = [...(q.drowned ?? []), i]; });
  });

  // The Drowned Court and the sealed wall across the valley.
  if (!p.court && chunksBuilt(-COURT.radius - 2, COURT.center.z - COURT.radius - 2, COURT.radius + 2, COURT.gateZ + 14)) {
    if (buildCourt(d)) { p.court = true; changed = true; }
  }

  // The Choir's Heart.
  if (!p.heart && chunksBuilt(-40, 2300, 40, 2440)) {
    if (buildHeart(d)) { p.heart = true; changed = true; }
  }
  if (changed) savePieces(p);
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

function fillAll(d, ops) {
  for (const op of ops) if (!apply(d, op)) return false;
  return true;
}

// Oswin's flooded throne hall: a round hall of dark prismarine, knee-deep water channels,
// pillars, a throne at the far end, and the sealed gate onward in the back wall.
function buildCourt(d) {
  const { x: cx, z: cz } = COURT.center, f = COURT.floorY, r = COURT.radius;
  const ops = [];
  const op = (a, b, block) => ops.push({ a, b, block });
  for (let dx = -r; dx <= r; dx++) {
    for (let dz = -r; dz <= r; dz++) {
      const dd = Math.sqrt(dx * dx + dz * dz);
      const x = cx + dx, z = cz + dz;
      if (z > COURT.gateZ) continue;
      if (dd <= r - 1) {
        op([x, f - 2, z], [x, f - 1, z], "minecraft:dark_prismarine");
        op([x, f, z], [x, f + 16, z], "minecraft:air");
        if (Math.abs(dx) % 8 === 4 && dd < r - 4) op([x, f - 1, z], [x, f, z], B.water); // water channels
      } else if (dd <= r + 0.5) {
        const door = dz < 0 && Math.abs(dx) <= 3; // entrance on the near side
        op([x, f - 2, z], [x, f - 1, z], "minecraft:dark_prismarine");
        op([x, f, z], [x, f + 17, z], door ? "minecraft:air" : "minecraft:prismarine_bricks");
        if (door) op([x, f + 8, z], [x, f + 17, z], "minecraft:prismarine_bricks");
      }
    }
  }
  // Pillars with lanterns of sea light
  for (let a = 0; a < 8; a++) {
    const px = cx + Math.round(Math.cos((a * Math.PI) / 4) * (r - 7)), pz = cz + Math.round(Math.sin((a * Math.PI) / 4) * (r - 7));
    op([px, f, pz], [px, f + 14, pz], "minecraft:prismarine_bricks");
    op([px, f + 15, pz], [px, f + 15, pz], "minecraft:sea_lantern");
  }
  // The throne, against the back wall, either side of the gate
  const tz = cz + r - 6;
  op([cx - 2, f, tz], [cx + 2, f + 1, tz + 2], "minecraft:dark_prismarine");
  op([cx - 1, f + 2, tz + 2], [cx + 1, f + 6, tz + 2], "minecraft:dark_prismarine");
  op([cx, f + 7, tz + 2], [cx, f + 7, tz + 2], "minecraft:sea_lantern");
  // A causeway behind the gate so the climb starts cleanly
  op([cx - 3, f - 1, COURT.gateZ + 1], [cx + 3, f - 1, COURT.gateZ + 12], "minecraft:polished_blackstone_bricks");
  return fillAll(d, ops);
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

// The Choir's Heart: a ring cathedral floating in the fog, 7 Singer pillars, a central disc,
// and stepping islands leading up from the end of the climb.
function buildHeart(d) {
  const { x: cx, y: cy, z: cz } = HEART.center;
  const ops = [];
  const op = (a, b, block) => ops.push({ a, b, block });
  for (let dx = -HEART.outerRadius; dx <= HEART.outerRadius; dx++) for (let dz = -HEART.outerRadius; dz <= HEART.outerRadius; dz++) {
    const dd = Math.sqrt(dx * dx + dz * dz);
    const x = cx + dx, z = cz + dz;
    if (dd <= HEART.innerRadius) op([x, cy - 3, z], [x, cy - 1, z], dd < 2 ? B.core : hash(x, z, 404) < 0.2 ? B.deckCracked : B.deck);
    else if (dd >= HEART.innerRadius + 4 && dd <= HEART.outerRadius) op([x, cy - 2, z], [x, cy - 1, z], dd > HEART.outerRadius - 1.2 ? B.lattice : hash(x, z, 404) < 0.2 ? B.deckCracked : B.deck);
  }
  // Bridges from the ring to the disc, at the four corners
  for (const [ux, uz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    for (let s = HEART.innerRadius; s <= HEART.innerRadius + 5; s++) {
      const x = cx + Math.round(ux * s * 0.707), z = cz + Math.round(uz * s * 0.707);
      op([x - 1, cy - 1, z - 1], [x + 1, cy - 1, z + 1], B.deck);
    }
  }
  // 7 Singer pillars with lattice arches
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const px = cx + Math.round(Math.cos(a) * HEART.singerRadius), pz = cz + Math.round(Math.sin(a) * HEART.singerRadius);
    op([px - 1, cy, pz - 1], [px + 1, cy + 2, pz + 1], "minecraft:polished_basalt");
    op([px, cy + 3, pz], [px, cy + 14, pz], B.lattice);
    op([px, cy + 15, pz], [px, cy + 15, pz], B.core);
  }
  // Stepping islands from the end of the climb (about z 2330) up to the ring's near edge
  const startY = (heightAt(0, 2328) ?? 115) + 1;
  for (let k = 0; k < 6; k++) {
    const z = 2334 + k * 6, y = Math.round(startY + ((cy - 1 - startY) * (k + 1)) / 7), x = Math.round(Math.sin(k) * 3);
    op([x - 1, y - 1, z - 1], [x + 1, y, z + 1], B.basalt);
    op([x, y, z], [x, y, z], B.moss);
  }
  return fillAll(d, ops);
}

// Put the Heart back as new (after a failed attempt, or once the fight is won).
export function rebuildHeart() {
  try { buildHeart(dim()); } catch { /* not loaded: the next attempt rebuilds it */ }
}

// The Fall: everything in the Heart at or beyond this radius drops away into the fog.
export function dropHeartBand(radius) {
  const { x: cx, y: cy, z: cz } = HEART.center, d = dim(), R = HEART.outerRadius + 1;
  for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) {
    const dd = Math.sqrt(dx * dx + dz * dz);
    if (dd < radius || dd > R) continue;
    apply(d, { a: [cx + dx, cy - 3, cz + dz], b: [cx + dx, cy + 16, cz + dz], block: "minecraft:air" });
  }
}
