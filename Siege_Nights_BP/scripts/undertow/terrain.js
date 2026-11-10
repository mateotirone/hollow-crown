// The Undertow terrain generator. Custom dimensions on Bedrock are void only, so we build the
// land ourselves, one 16x16 chunk at a time, as players come near. Everything comes from a fixed
// seed, so the land is identical for every player and every rebuild.
//
// planChunk(cx, cz) is pure (no Minecraft calls): it returns a list of fill operations. The
// builder in index.js applies them a few at a time so the server never stalls.
// Look of the land follows Mateo's concept art: basalt plateaus and spires, giant hollow lattice
// trees, glowing pink and blue fungi, rivers of pale blue light, fog above and a far ceiling.

import { UNDERTOW_LAYOUT as L, COURT, pathX, stageAt } from "./layout.js";

export const B = {
  floor: "minecraft:blackstone",
  rock: "siege:veinstone",
  moss: "siege:undertow_moss",
  basalt: "minecraft:basalt",
  polished: "minecraft:polished_basalt",
  tuff: "minecraft:tuff",
  ceiling: "siege:veil_rock",
  lattice: "siege:hollowwood_lattice",
  core: "siege:hollowwood_core",
  veilcap: "siege:veilcap",
  glimbulb: "siege:glimbulb",
  flow: "siege:glimmerflow",
  water: "minecraft:water",
  ruin: "minecraft:mossy_stone_bricks",
  ruin2: "minecraft:cracked_stone_bricks",
  copper: "minecraft:oxidized_copper",
  glass: "minecraft:tinted_glass",
  seal: "siege:court_seal",
  ore: "siege:choir_ore",
};

const SEED = 7741;

// ---- deterministic noise ---------------------------------------------------------------
export function hash(x, z, salt = 0) {
  let h = (x * 374761393 + z * 668265263 + (SEED + salt) * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296; // 0..1
}
const smooth = (t) => t * t * (3 - 2 * t);
function value(x, z, salt) {
  const x0 = Math.floor(x), z0 = Math.floor(z);
  const fx = smooth(x - x0), fz = smooth(z - z0);
  const a = hash(x0, z0, salt), b = hash(x0 + 1, z0, salt);
  const c = hash(x0, z0 + 1, salt), d = hash(x0 + 1, z0 + 1, salt);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}
export function fbm(x, z, salt = 0) {
  return value(x, z, salt) * 0.55 + value(x * 2.1, z * 2.1, salt + 11) * 0.3 + value(x * 4.3, z * 4.3, salt + 23) * 0.15;
}

const inCourt = (x, z) => z >= 1540 && z < 1660;
const inHeart = (z) => z >= 2330;
const nearPath = (x, z, d) => Math.abs(x - pathX(z)) <= d;
const inValley = (x, z) => Math.abs(x) <= L.halfWidth && z >= L.zStart && z < L.zEnd;

// Ground height at a column, or null for void.
export function heightAt(x, z) {
  if (!inValley(x, z)) return null;
  if (inHeart(z)) return null; // the final arena floats in the fog; built separately

  // The Wound: a ledge at y 100 with a wall behind it and a ramp down along the path.
  if (z < 40) {
    if (z < -10) return Math.abs(x) <= 24 ? 126 - Math.floor(fbm(x / 9, z / 9, 5) * 6) : null;
    if (Math.abs(x) <= 14 && z <= 10) return L.woundLedgeY;
    if (Math.abs(x) <= 3 && z > 10) {
      const foot = heightAt(pathX(40), 40); // ramp lands exactly on the valley floor
      return Math.round(L.woundLedgeY - ((z - 10) / 30) * (L.woundLedgeY - foot));
    }
  }
  if (inCourt(x, z)) return COURT.floorY - 2;

  const n = fbm(x / 90, z / 90, 1);
  const stage = stageAt(z)?.id;
  // Each stage has its own shape; the 60 blocks before a boundary blend into the next one.
  let h = stageHeight(stage, x, z, n);
  for (const [edge, next] of BLENDS) {
    if (z >= edge - 60 && z < edge) h += (stageHeight(next, x, z, n) - h) * smooth((z - (edge - 60)) / 60);
  }
  if (z >= 1660 && z < 1720) h = COURT.floorY - 2 + (h - (COURT.floorY - 2)) * smooth((z - 1660) / 60);
  const d0 = Math.abs(x - pathX(z));
  // The Shallows flood below y 66: a lip at the near end holds the water in, and the path is a causeway.
  if (z >= 36 && z < 56) h = Math.max(h, 68);
  if (stage === "shallows" && d0 <= 2) h = Math.max(h, 67);

  // Terraces and cliffs away from the path; the path itself stays walkable.
  const step = stage === "mirror" ? 5 : 3;
  const terraced = Math.floor(h / step) * step;
  const d = Math.abs(x - pathX(z));
  if (d > 7) h = terraced;
  else if (d > 4) h = Math.round(h + (terraced - h) * ((d - 4) / 3));
  else h = Math.round(h);

  // The valley rim: cliffs that rise, then drop away into fog.
  const edge = L.halfWidth - Math.abs(x);
  if (edge < 22) h += Math.round((22 - edge) * 1.8 + fbm(x / 7, z / 7, 3) * 6);
  return Math.max(L.floorY + 4, Math.min(L.ceilingY - 30, h));
}

const BLENDS = [[500, "mirror"], [1000, "bells"], [1540, "court"]];
function stageHeight(stage, x, z, n) {
  if (stage === "court") return COURT.floorY - 2;
  if (stage === "wound" || stage === "shallows") return 58 + n * 22; // low and flooded
  if (stage === "mirror") return 70 + n * 30; // high basalt terraces
  if (stage === "bells") return 68 + n * 16 + Math.sin(x / 11) * 2 * fbm(x / 30, z / 30, 9); // dunes
  const t = Math.min(1, Math.max(0, (z - 1660) / 640)); // the Long Climb rises toward the Heart
  return 86 + t * 30 + n * 12;
}

export const oreChance = (z) => (z < 60 ? 0 : 0.015 + 0.05 * Math.min(1, z / 2300));

export function isRiver(x, z) {
  if (z < 40 || inCourt(x, z) || z > 2250) return false;
  if (Math.abs(x) > L.halfWidth - 24) return false;
  const r = fbm(x / 70, z / 110, 41);
  return Math.abs(r - 0.5) < 0.032;
}

// ---- the plan for one chunk ------------------------------------------------------------
export function planChunk(cx, cz) {
  const ops = [];
  const fill = (x1, y1, z1, x2, y2, z2, block) => {
    if (y2 < y1) return;
    ops.push({ a: [x1, y1, z1], b: [x2, y2, z2], block });
  };
  const set = (x, y, z, block) => ops.push({ a: [x, y, z], b: [x, y, z], block });
  const X0 = cx * 16, Z0 = cz * 16;

  // Heights for the chunk plus a 1-block border (for cliff detection).
  const H = [];
  for (let i = -1; i <= 16; i++) {
    H[i + 1] = [];
    for (let j = -1; j <= 16; j++) H[i + 1][j + 1] = heightAt(X0 + i, Z0 + j);
  }
  const h = (i, j) => H[i + 1][j + 1];

  let minH = Infinity, any = false;
  for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) {
    const v = h(i, j);
    if (v !== null) { any = true; minH = Math.min(minH, v); }
  }

  // Ceiling over the whole valley width (also above the Heart, where there is no ground).
  if (Math.abs(X0 + 8) <= L.halfWidth + 8 && Z0 + 16 > L.zStart && Z0 < L.zEnd) {
    const x1 = Math.max(X0, -L.halfWidth), x2 = Math.min(X0 + 15, L.halfWidth);
    const z1 = Math.max(Z0, L.zStart), z2 = Math.min(Z0 + 15, L.zEnd - 1);
    if (x1 <= x2 && z1 <= z2) fill(x1, L.ceilingY, z1, x2, L.ceilingY + L.ceilingThickness - 1, z2, B.ceiling);
    // Hanging basalt spires
    for (let i = 0; i < 16; i += 2) for (let j = 0; j < 16; j += 2) {
      const x = X0 + i, z = Z0 + j;
      if (x < x1 || x > x2 || z < z1 || z > z2) continue;
      const r = hash(x, z, 77);
      if (r < 0.03) fill(x, L.ceilingY - 4 - Math.floor(hash(x, z, 78) * 22), z, x, L.ceilingY - 1, z, B.basalt);
    }
  }
  // The sealed wall across the whole valley behind the Drowned Court (gate opens when Oswin dies).
  if (COURT.gateZ >= Z0 && COURT.gateZ <= Z0 + 15 && X0 + 15 >= -L.halfWidth && X0 <= L.halfWidth) {
    fill(Math.max(X0, -L.halfWidth), L.floorY, COURT.gateZ, Math.min(X0 + 15, L.halfWidth), L.ceilingY + L.ceilingThickness - 1, COURT.gateZ, B.seal);
  }
  if (!any) return ops;

  // Solid base for the whole chunk in one fill where every column has ground.
  const full = H.slice(1, 17).every((row) => row.slice(1, 17).every((v) => v !== null));
  const baseTop = minH - 4;
  if (full && baseTop > L.floorY) fill(X0, L.floorY, Z0, X0 + 15, baseTop, Z0 + 15, B.floor);

  const stage = stageAt(Z0 + 8)?.id;
  for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) {
    const x = X0 + i, z = Z0 + j, top = h(i, j);
    if (top === null) continue;
    const start = full && baseTop > L.floorY ? baseTop + 1 : L.floorY;
    let drop = 0;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = h(i + di, j + dj);
      drop = Math.max(drop, n === null ? 99 : top - n);
    }
    const cliff = drop >= 3;
    const wound = z < 40;
    if (cliff && !wound) {
      fill(x, start, z, x, top, z, stage === "mirror" ? B.polished : B.basalt);
      // Choir ore shows in the cliff faces, richer the deeper into the Hollow you go.
      if (hash(x, z, 301) < oreChance(z)) set(x, top - 1 - Math.floor(hash(x, z, 302) * 3), z, B.ore);
      continue;
    }
    fill(x, start, z, x, top - 1, z, B.rock);
    if (isRiver(x, z) && !nearPath(x, z, 1)) {
      // A channel of pale blue light: you sink in one block and wade.
      set(x, top, z, B.flow);
      continue;
    }
    set(x, top, z, wound ? B.rock : B.moss);

    // Shallows: low ground floods.
    if (stage === "shallows" && z >= 56 && top < 66) fill(x, top + 1, z, x, 66, z, B.water);

    // Plants and spires (never on the path)
    if (nearPath(x, z, 3) || wound) continue;
    const r = hash(x, z, 5);
    if (r < 0.006 && stage !== "shallows") {
      const tall = 8 + Math.floor(hash(x, z, 6) * 22);
      fill(x, top + 1, z, x, top + tall, z, stage === "mirror" ? B.glass : B.basalt);
    } else if (r < 0.06 && !(stage === "shallows" && top < 66)) {
      set(x, top + 1, z, hash(x, z, 7) < 0.6 ? B.veilcap : B.glimbulb);
    }
  }

  // One landmark per chunk at most, kept inside the chunk.
  const cxm = X0 + 8, czm = Z0 + 8, ch = h(8, 8);
  if (ch === null || czm < 40 || inCourt(cxm, czm) || nearPath(cxm, czm, 12)) return ops;
  const roll = hash(cx, cz, 101);
  // Nudge each landmark off the chunk's middle so they don't line up in a grid (still inside the chunk).
  const nudge = (max, salt) => Math.round((hash(cx, cz, salt) - 0.5) * 2 * max);
  const at = (max) => {
    const x = cxm + nudge(max, 105), z = czm + nudge(max, 106);
    return [x, heightAt(x, z), z];
  };
  if (roll < 0.17) { const [x, y, z] = at(1); if (y !== null) latticeTree(ops, x, y + 1, z, cx, cz); }
  else if (stage === "shallows" && roll < 0.4) { const [x, y, z] = at(4); if (y !== null) ruin(ops, x, y, z, cx, cz); }
  else if (stage === "bells" && roll < 0.35) { const [x, y, z] = at(2); if (y !== null) brokenBell(ops, x, y + 1, z, cx, cz); }
  else if (roll > 0.93) { const [x, , z] = at(3); island(ops, x, 150 + Math.floor(hash(cx, cz, 103) * 25), z, cx, cz); }
  return ops;
}

// A giant hollow lattice tree: open lattice trunk with a glowing core, arching boughs, lacy canopy.
function latticeTree(ops, x, y, z, cx, cz) {
  const fill = (a, b, block) => ops.push({ a, b, block });
  const tall = 12 + Math.floor(hash(cx, cz, 111) * 6);
  // Trunk: a 3x3 lattice shell with a glowing core inside
  fill([x - 1, y, z - 1], [x + 1, y + tall, z + 1], B.lattice);
  fill([x, y + 1, z], [x, y + tall - 1, z], B.core);
  // Roots flaring out
  for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) fill([x + dx, y, z + dz], [x + dx, y + 2, z + dz], B.lattice);
  // Boughs: arcs out to the canopy
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
    for (let s = 1; s <= 6; s++) {
      const bx = x + dx * s, bz = z + dz * s, by = y + tall + Math.round(Math.sin((s / 6) * Math.PI) * 3);
      fill([bx, by, bz], [bx, by, bz], B.lattice);
    }
  }
  // Canopy: a lacy disc with holes, glowing pockets here and there
  const cy = y + tall + 2;
  for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++) {
    const d2 = dx * dx + dz * dz;
    if (d2 > 36 || d2 < 4) continue;
    const r = hash(x + dx, z + dz, 113);
    if (r < 0.35) continue;
    fill([x + dx, cy, z + dz], [x + dx, cy, z + dz], r > 0.95 ? B.core : B.lattice);
  }
}

// Ruined houses of the village that was pulled under.
function ruin(ops, x, y, z, cx, cz) {
  for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
    if (Math.abs(dx) !== 3 && Math.abs(dz) !== 3) continue;
    const wall = 1 + Math.floor(hash(x + dx, z + dz, 121) * 4);
    if (hash(x + dx, z + dz, 122) < 0.2) continue; // gaps
    const block = hash(x + dx, z + dz, 123) < 0.5 ? B.ruin : B.ruin2;
    ops.push({ a: [x + dx, y + 1, z + dz], b: [x + dx, y + wall, z + dz], block });
  }
}

// A giant bell, cracked and half sunk into the moss.
function brokenBell(ops, x, y, z, cx, cz) {
  for (let dy = 0; dy <= 6; dy++) {
    const r = Math.round(5 - dy * 0.55);
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < r - 0.8 || d > r + 0.3) continue;
      if (dx > 1 && dz > -1 && dy < 4) continue; // the crack
      ops.push({ a: [x + dx, y + dy - 2, z + dz], b: [x + dx, y + dy - 2, z + dz], block: B.copper });
    }
  }
}

// A small rock island hanging in the fog.
function island(ops, x, y, z, cx, cz) {
  for (let dy = 0; dy < 5; dy++) {
    const r = 4 - dy;
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      if (dx * dx + dz * dz > r * r + 1) continue;
      ops.push({ a: [x + dx, y - dy, z + dz], b: [x + dx, y - dy, z + dz], block: dy === 0 ? B.moss : B.basalt });
    }
  }
  ops.push({ a: [x, y + 1, z], b: [x, y + 1, z], block: B.glimbulb });
}

// Chunks the generator covers.
export function chunkInRange(cx, cz) {
  const x0 = cx * 16, z0 = cz * 16;
  return x0 + 15 >= -L.halfWidth && x0 <= L.halfWidth && z0 + 15 >= L.zStart && z0 < L.zEnd;
}
