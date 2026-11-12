// What lies under the Seat (Mateo, 2026-11-12: "a glowing chasm far below"). Where the land breaks off before the
// Seat there used to be nothing but void. Now there is a pit some 70 blocks down: a glowing pool over a bed of
// glimmerflow, shoals of rock standing out of it, light falling out of the cliffs in thin falls, and crooked crystal
// spires rising from the water, the tallest under the Seat itself.
//
// It is planned a column at a time (pure, from the fixed seed) and built a chunk at a time by builder.js, so it
// reaches worlds that built this end of the Hollow before it existed. heightAt() stays null over the chasm: it is
// not land, nothing grows on it, no road or river plans against it, and a fall into it still kills (index.js).

import { UNDERTOW_LAYOUT as L, HEART } from "./layout.js";
import { heightAt, heartEdge, HEART_EDGE_Z, B } from "./terrain.js";
import { hash, fbm, smooth } from "./noise.js";

export const CHASM = {
  x0: -L.halfWidth, x1: L.halfWidth, z0: HEART_EDGE_Z - 34, z1: L.zEnd - 1,
  water: 52, // the pool's surface
  floorMin: 43,
  killY: 66, // below this, over the chasm, a fall has gone too far to come back from
  spireTop: 84, // nothing rises higher: the lowest rock of the Seat's approach hangs at y 89, the Vault at y 101
  cell: 13, // one spire at most in each 13 x 13 cell
};
const AMETHYST = "minecraft:amethyst_block";

// The pit's own outer edge, where its floor ends over the void to the south and at the Spine's two sides: ragged
// like every edge here, never a straight line. How far each side is bitten in from the box above.
const biteS = (x) => Math.floor(fbm(x / 33, 2.2, 851) * 24 + fbm(x / 7, 5.1, 852) * 7 + hash(Math.floor(x / 2), 0, 853) * 3);
const biteX = (z, side) => Math.floor(fbm(z / 29, side * 3.7, 854) * 22 + fbm(z / 6, side * 1.3, 855) * 6 + hash(Math.floor(z / 2), side, 856) * 3);
// How many blocks inside that edge a column is (0 or less: outside).
export function rimDepth(x, z) {
  if (z < CHASM.z0) return 0;
  return Math.min(x - (CHASM.x0 + biteX(z, -1)), CHASM.x1 - biteX(z, 1) - x, CHASM.z1 - biteS(x) - z) + 1;
}
export const inChasm = (x, z) => rimDepth(x, z) > 0 && heightAt(x, z) === null;

// The pit's floor: rolling just above and below the pool's surface, deepest in the well under the Seat, heaped up
// as scree at the cliff's foot, and raised into a lip along the outer edges so the pool never pours into the void.
export function floorAt(x, z) {
  let h = 45 + fbm(x / 34, z / 34, 811) * 9 + fbm(x / 9, z / 9, 812) * 2;
  const r = Math.hypot(x - HEART.center.x, z - HEART.center.z);
  if (r < 36) h -= 5 * smooth(1 - r / 36);
  const foot = z - heartEdge(x);
  if (foot >= 0 && foot < 9) h += (9 - foot) * (0.6 + hash(x, 0, 813) * 0.5);
  // The rim: broken rock standing out of the water along the outer edge, higher and rougher toward the drop. Any
  // column with open void beside it stands above the water whatever the noise says.
  const rim = rimDepth(x, z);
  if (rim < 9) h = Math.max(h, CHASM.water - 3 + (9 - rim) * (0.5 + fbm(x / 6, z / 6, 814) * 1.1));
  if (rimDepth(x + 1, z) <= 0 || rimDepth(x - 1, z) <= 0 || rimDepth(x, z + 1) <= 0) h = Math.max(h, CHASM.water + 1 + hash(x, z, 815) * 3);
  return Math.max(CHASM.floorMin, Math.min(CHASM.killY - 5, Math.round(h)));
}

// The spire of one grid cell, or null: { x, z, base (the floor it stands on), top, r (its radius at the foot),
// cut (where its upper part steps one block off true), lx, lz (which way) }. Taller and closer set near the Seat.
export function spireOf(i, j) {
  const x = i * CHASM.cell + 2 + Math.floor(hash(i, j, 821) * (CHASM.cell - 4)), z = j * CHASM.cell + 2 + Math.floor(hash(i, j, 822) * (CHASM.cell - 4));
  const r = Math.hypot(x - HEART.center.x, z - HEART.center.z), near = r < 52;
  if (hash(i, j, 823) > (near ? 0.8 : 0.3)) return null;
  for (let dx = -3; dx <= 3; dx += 3) for (let dz = -3; dz <= 3; dz += 3) if (!inChasm(x + dx, z + dz)) return null;
  const base = floorAt(x, z);
  const tall = 9 + Math.floor(hash(i, j, 824) * 22) + (near ? 12 : 0);
  const top = Math.min(CHASM.spireTop - Math.floor(hash(i, j, 825) * 7), base + tall);
  const a = Math.floor(hash(i, j, 826) * 4);
  return { x, z, base, top, r: 2.1 + hash(i, j, 827) * 2.2 + (near ? 0.7 : 0), cut: base + Math.round((top - base) * 0.58), lx: [1, -1, 0, 0][a], lz: [0, 0, 1, -1][a] };
}
// The spire's stone in one column: [[y0, y1, block], ...], the upper part one block off true in one clean step.
function spireIn(s, x, z, floor) {
  const out = [], H = s.top - s.base;
  const part = (dx, dz, y0, y1) => {
    const d = Math.hypot(dx, dz);
    if (d > s.r) return;
    // the height at which the taper has narrowed to this distance from the middle
    const reach = d < 0.5 ? s.top : Math.floor(s.base + H * (1 - Math.pow(d / s.r, 1.25)));
    const a = y0, b = Math.min(y1, reach);
    if (b < a) return;
    const crystal = Math.max(a, s.top - Math.round(H * 0.34));
    if (crystal > a) out.push([a, Math.min(b, crystal - 1), hash(x, z, 828) < 0.3 ? B.floor : B.rock]);
    if (b >= crystal) out.push([crystal, b, AMETHYST]);
  };
  part(x - s.x, z - s.z, Math.min(floor, s.base) + 1, s.cut - 1);
  part(x - s.x - s.lx, z - s.z - s.lz, s.cut, s.top);
  return out;
}

// A fall of light out of the cliff, or null: { mouth (the y it springs from) }. One or two blocks wide, in the first
// open column off the rock, well clear of the path's spur.
export function fallAt(x) {
  if (Math.abs(x) < 12 || x < CHASM.x0 + 3 || x > CHASM.x1 - 3) return null;
  const k = Math.floor(x / 19), first = k * 19 + 3 + Math.floor(hash(k, 0, 831) * 12), wide = hash(k, 0, 832) < 0.4 ? 2 : 1;
  if (x < first || x >= first + wide || hash(k, 0, 833) < 0.2) return null;
  const z = heartEdge(x), top = heightAt(x, z - 1);
  if (top === null || top < 104 || heightAt(x, z) !== null) return null; // only off the high cliffs
  return { z, mouth: top - 7 - Math.floor(hash(k, 0, 834) * 20) };
}

// Everything the chasm puts in one column, bottom up: [[y0, y1, block], ...]. Empty outside the chasm.
export function chasmColumn(x, z) {
  if (!inChasm(x, z)) return [];
  const f = floorAt(x, z), out = [[L.floorY, f - 1, f - L.floorY > 6 && hash(x, z, 841) < 0.5 ? B.rock : B.floor]];
  const wet = f < CHASM.water;
  if (wet) out.push([f, f, hash(x, z, 842) < 0.82 ? B.flow : B.rock], [f + 1, CHASM.water, B.water]);
  else {
    const t = hash(x, z, 843);
    out.push([f, f, t < 0.45 ? B.rock : t < 0.7 ? B.tuff : t < 0.9 ? B.moss : B.cobble]);
    if (hash(x, z, 844) < 0.035) out.push([f + 1, f + 1, B.glint]);
  }
  const i = Math.floor(x / CHASM.cell), j = Math.floor(z / CHASM.cell);
  for (let a = i - 1; a <= i + 1; a++) for (let b = j - 1; b <= j + 1; b++) {
    const s = spireOf(a, b);
    if (s) out.push(...spireIn(s, x, z, f));
  }
  const fall = fallAt(x);
  if (fall && fall.z === z) out.push([Math.max(f, CHASM.water) + 1, fall.mouth, B.water]);
  return out;
}

// The chunks the chasm touches.
export const CHASM_CHUNKS = { cx0: Math.floor(CHASM.x0 / 16), cx1: Math.floor(CHASM.x1 / 16), cz0: Math.floor(CHASM.z0 / 16), cz1: Math.floor(CHASM.z1 / 16) };
export const chasmChunk = (cx, cz) => cx >= CHASM_CHUNKS.cx0 && cx <= CHASM_CHUNKS.cx1 && cz >= CHASM_CHUNKS.cz0 && cz <= CHASM_CHUNKS.cz1;

// Fill ops for one chunk (never reaching outside it). The mouth of each fall is cut into the cliff behind it: a
// source block in the rock with glimmerflow glowing above, and more down the face behind the falling water.
export function chasmOps(cx, cz) {
  const ops = [];
  if (!chasmChunk(cx, cz)) return ops;
  for (let x = cx * 16; x < cx * 16 + 16; x++) for (let z = cz * 16; z < cz * 16 + 16; z++) {
    for (const [y0, y1, block] of chasmColumn(x, z)) ops.push({ a: [x, y0, z], b: [x, y1, z], block });
    const fall = fallAt(x);
    if (fall && fall.z - 1 === z) {
      ops.push({ a: [x, fall.mouth, z], b: [x, fall.mouth, z], block: B.water }, { a: [x, fall.mouth + 1, z], b: [x, fall.mouth + 1, z], block: B.flow });
      for (let y = fall.mouth - 5; y > CHASM.water + 8; y -= 7) ops.push({ a: [x, y, z], b: [x, y, z], block: B.flow });
    }
  }
  return ops;
}
