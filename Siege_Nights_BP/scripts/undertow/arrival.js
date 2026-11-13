// The arrival at the Wound: the ledge you land on and the way down from it.
//
// Mateo 2026-11-13, of the first one: "This needs a ton of work as well. Also, use stairs whenever applicable
// instead of just straight blocks. I mean, it looks temporary here ... It's one of the most important parts of the
// map." It was a box of one block 29 by 21 and 34 high, with a fin of rock down its front for a ramp that dropped
// two blocks at a step in places.
//
// Now the ledge is the top of a crag that stands out from the back cliff, and the way down is a stair the
// Hollow's miners built into it:
//   the ledge (y 100)                    rounded, no straight edge, a paved way from the cave mouth to the stair head
//   flight 1, five wide, straight out    eight steps down to
//   the terrace (y 92)                   a balcony 19 wide on a built wall with a lantern niche at its foot
//   flights 2, left and right            three wide, eleven steps down along the face to
//   the turns (y 81)                     a landing each side
//   flights 3, out from the cliff        eight steps down to the lower landings (y 73)
//   flights 4, back toward the middle    eight steps down into
//   the court (y 65)                     level with the valley, where the story path leaves
// Every step is a stair block; every open side has a kerb and a low wall; the crag falls away from all of it in
// short cliffs and benches (cragDrop).
//
// Pure, and no imports but the noise: terrain.js takes its heights from here, wound.js its blocks.

import { hash, fbm } from "./noise.js";

export const ARRIVAL = { top: 100, court: 65, x0: -70, x1: 70, z0: -10, z1: 66 };

// the ledge: a rounded slab with a wobbling edge. Its front reaches z 14 on the middle line.
export function onLedge(x, z) {
  if (z < ARRIVAL.z0) return false;
  const s = (Math.abs(x) / 15.5) ** 4 + ((z + 10) / 24.6) ** 4;
  return s <= 1 + (fbm(x / 5, z / 5, 201) - 0.5) * 0.22;
}

// ---- the stair: every cell a player walks on, by hand ------------------------------------------------
// walk: Map "x,z" -> { h, kind: "stair" | "landing" | "court", climb?: "n" | "s" | "e" | "w" } (h = the top block's y;
// a stair block IS the top block of its column; climb = the way you face going up it)
let PLAN;
function plan() {
  if (PLAN) return PLAN;
  const walk = new Map(), key = (x, z) => `${x},${z}`;
  const set = (x, z, c) => walk.set(key(x, z), c);
  const T = ARRIVAL.top;
  // flight 1: z 15..22, straight out from the ledge
  for (let i = 0; i < 8; i++) for (let x = -2; x <= 2; x++) set(x, 15 + i, { h: T - i, kind: "stair", climb: "n" });
  // the terrace
  for (let x = -9; x <= 9; x++) for (let z = 23; z <= 28; z++) set(x, z, { h: T - 8, kind: "landing" });
  for (const s of [-1, 1]) {
    // flights 2: along the face, outward
    for (let i = 0; i < 11; i++) for (let z = 26; z <= 28; z++) set(s * (10 + i), z, { h: T - 8 - i, kind: "stair", climb: s > 0 ? "w" : "e" });
    // the turns
    for (let a = 21; a <= 24; a++) for (let z = 26; z <= 32; z++) set(s * a, z, { h: T - 19, kind: "landing" });
    // flights 3: out from the cliff
    for (let i = 0; i < 8; i++) for (let a = 22; a <= 24; a++) set(s * a, 33 + i, { h: T - 19 - i, kind: "stair", climb: "n" });
    // the lower landings
    for (let a = 21; a <= 24; a++) for (let z = 41; z <= 44; z++) set(s * a, z, { h: T - 27, kind: "landing" });
    // flights 4: back toward the middle
    for (let i = 0; i < 8; i++) for (let z = 42; z <= 44; z++) set(s * (20 - i), z, { h: T - 27 - i, kind: "stair", climb: s > 0 ? "e" : "w" });
  }
  // the court: level ground between the foot of the terrace wall and the valley, its outer edge uneven
  for (let x = -12; x <= 12; x++) for (let z = 30; z <= 52; z++) {
    if (z > 46 + Math.round(fbm(x / 4, 0.7, 205) * 5) - Math.abs(x) * 0.2) continue;
    set(x, z, { h: ARRIVAL.court, kind: "court" });
  }
  // kerbs: a full block beside every stair and landing cell that is not itself walked on, as high as the highest
  // walked cell it touches, carrying the low wall
  const kerb = new Map();
  for (const [k, c] of walk) {
    if (c.kind === "court") continue;
    const [x, z] = k.split(",").map(Number);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const n = key(x + dx, z + dz);
      if (walk.has(n) || onLedge(x + dx, z + dz)) continue;
      kerb.set(n, Math.max(kerb.get(n) ?? -999, c.h));
    }
  }
  // seeds for the crag: the rim of everything that stands (ledge, stair, kerb), with the height the rock falls from
  const solid = (x, z) => { const k = key(x, z), w = walk.get(k); return (w && w.kind !== "court") || kerb.has(k) || onLedge(x, z); };
  const seeds = [];
  for (let x = ARRIVAL.x0; x <= ARRIVAL.x1; x++) for (let z = ARRIVAL.z0; z <= ARRIVAL.z1; z++) {
    if (!solid(x, z)) continue;
    if (solid(x + 1, z) && solid(x - 1, z) && solid(x, z + 1) && (z === ARRIVAL.z0 || solid(x, z - 1))) continue;
    const k = key(x, z);
    seeds.push([x, z, walk.get(k)?.h ?? kerb.get(k) ?? ARRIVAL.top]);
  }
  PLAN = { walk, kerb, seeds };
  return PLAN;
}
export const walkAt = (x, z) => plan().walk.get(`${x},${z}`) ?? null;
export const kerbAt = (x, z) => plan().kerb.get(`${x},${z}`) ?? null;
export const walkCells = () => plan().walk;
export const kerbCells = () => plan().kerb;

// How far the rock has fallen d blocks out from a rim: a short sheer face, a bench that slopes a little, another
// face, and so on, the benches wider or narrower from place to place. Never a smooth slope and never one wall.
export function cragDrop(d, x, z) {
  const t = d + (fbm(x / 7, z / 7, 203) - 0.5) * 3 - 1;
  if (t <= 0) return 1;
  const P = 4 + fbm(x / 11, z / 11, 204) * 3.5, k = Math.floor(t / P), u = t - k * P;
  return Math.round(1 + k * 9 + (u < 1.5 ? (u / 1.5) * 8 : 8 + (u - 1.5) * 0.4) + (hash(x, z, 206) < 0.2 ? 1 : 0));
}

// The arrival's own height at a column, or null where it has nothing to say (the valley's ground stands):
//   { h, exact: true }   the ledge, the stair, a kerb, the court: exactly this high
//   { h, exact: false }  the crag: at least this high
const cragCache = new Map();
export function arrivalAt(x, z) {
  if (x < ARRIVAL.x0 || x > ARRIVAL.x1 || z < ARRIVAL.z0 || z > ARRIVAL.z1) return null;
  const k = `${x},${z}`, P = plan();
  const w = P.walk.get(k);
  if (w) return { h: w.h, exact: true };
  if (P.kerb.has(k)) return { h: P.kerb.get(k), exact: true };
  if (onLedge(x, z)) return { h: ARRIVAL.top, exact: true };
  let c = cragCache.get(k);
  if (c === undefined) {
    let best = Infinity, y0 = 0;
    for (const [sx, sz, sh] of P.seeds) { const d = (sx - x) ** 2 + (sz - z) ** 2; if (d < best) { best = d; y0 = sh; } }
    const d = Math.sqrt(best);
    c = d > 34 ? null : y0 - cragDrop(d, x, z);
    cragCache.set(k, c);
  }
  return c === null ? null : { h: c, exact: false };
}
