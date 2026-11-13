// The one terraform pass, game side (Mateo 2026-11-13, after Enshrouded's building terrain). A line-for-line copy of
// map/structures/terraform.py: the same pads, connectors, skirt and retaining walls, so a plot the game levels looks
// like a plot in a baked town. tools/check.mjs runs both against map/structures/terraform_cases.json.
//
//   padHeight(heights, connectors?) -> floor y (balances cutting in against building up, at most 3 under the top)
//   solve(h, sites, fixed?) -> { T, wall }      h: [i][j] land top y; sites: [{ pad: Map("i,j" -> y), connectors: Map, skirtMax }]
//   blocks(h, T, wall, sites, region, x0, z0, fixed?) -> [{ x, y, z, id }]   world blocks to set, in build order
//
// Pure maths: no world access here. ground.js reads the land round a plot and turns the result into a build stage.

export const K_SOFT = 0.5; // 1 block up for every 2 across
export const K_STEEP = 1.0; // only when the soft slope would reach past skirtMax
export const MAX_BELOW = 3; // a floor is never more than this under the highest block of its footprint
export const FEATHER = 3; // a small leftover step past skirtMax is eased over this many more blocks before it's a wall
const SQ2 = Math.sqrt(2);
const EPS = 1e-9;

export const REGION = {
  vale: { top: "grass_block", patch: ["coarse_dirt", 9], sub: "dirt", wall: ["cobblestone", "mossy_cobblestone"] },
  frostmarch: { top: "grass_block", patch: ["podzol", 11], sub: "dirt", wall: ["cobbled_deepslate", "deepslate_bricks"] },
  saltreach: { top: "grass_block", patch: ["gravel", 7], sub: "dirt", wall: ["stone_bricks", "cobblestone"] },
  emberwaste: { top: "red_sand", patch: ["coarse_dirt", 6], sub: "red_sandstone", wall: ["sandstone", "cut_sandstone"] },
  blackfen: { top: "grass_block", patch: ["moss_block", 5], sub: "mud", wall: ["mud_bricks", "packed_mud"] },
  hollow: { top: "coarse_dirt", patch: ["siege:pale_ash", 6], sub: "dirt", wall: ["polished_blackstone_bricks", "cracked_polished_blackstone_bricks"] },
};
const SOIL = 3;

const key = (i, j) => `${i},${j}`;
const unkey = (k) => k.split(",").map(Number);
const grid = (W, H, v) => Array.from({ length: W }, () => new Array(H).fill(v));

export function site({ pad = new Map(), connectors = new Map(), carve = 6, skirt = 4, skirtMax = 6, padFill = "stone", k = null } = {}) {
  return { pad, connectors, carve, skirt, skirtMax, padFill, k };
}

export function padHeight(hs, connectors = [], maxBelow = MAX_BELOW) {
  let top = -Infinity;
  for (const v of hs) top = Math.max(top, v);
  let best = null;
  for (let y = top - maxBelow; y <= top; y++) {
    if (connectors.some((c) => Math.abs(c - y) > 1)) continue;
    let cut = 0, fill = 0;
    for (const v of hs) { cut += Math.max(0, v - y); fill += Math.max(0, y - v); }
    const cost = Math.abs(cut - 1.3 * fill) + 0.25 * (cut + fill) + 0.5 * (top - y);
    if (best === null || cost < best[0]) best = [cost, y];
  }
  return best === null ? null : best[1];
}

// a binary heap of [v, d, i, j], popped in the same order as Python's heapq on tuples
const less = (a, b) => a[0] !== b[0] ? a[0] < b[0] : a[1] !== b[1] ? a[1] < b[1] : a[2] !== b[2] ? a[2] < b[2] : a[3] < b[3];
function push(q, e) {
  q.push(e);
  for (let n = q.length - 1; n > 0;) { const p = (n - 1) >> 1; if (!less(q[n], q[p])) break; [q[n], q[p]] = [q[p], q[n]]; n = p; }
}
function pop(q) {
  const top = q[0], last = q.pop();
  if (q.length) {
    q[0] = last;
    for (let n = 0; ;) {
      const a = 2 * n + 1, b = a + 1; let m = n;
      if (a < q.length && less(q[a], q[m])) m = a;
      if (b < q.length && less(q[b], q[m])) m = b;
      if (m === n) break;
      [q[n], q[m]] = [q[m], q[n]]; n = m;
    }
  }
  return top;
}

const STEPS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, SQ2], [1, -1, SQ2], [-1, 1, SQ2], [-1, -1, SQ2]];

// out[c] = min over seeds (sign * y + k * dist), out to radius; fixed cells don't pass it on
export function envelope(W, H, seeds, k, radius, sign, fixed) {
  const best = grid(W, H, Infinity);
  const q = [];
  for (const [kk, y] of seeds) {
    const [i, j] = unkey(kk); const v = sign * y;
    if (v < best[i][j]) { best[i][j] = v; push(q, [v, 0, i, j]); }
  }
  while (q.length) {
    const [v, d, i, j] = pop(q);
    if (v > best[i][j] + EPS) continue;
    if (fixed && fixed[i][j] && d > 0) continue;
    for (const [di, dj, c] of STEPS) {
      const a = i + di, b = j + dj;
      if (a < 0 || a >= W || b < 0 || b >= H) continue;
      const nd = d + c;
      if (nd > radius + EPS) continue;
      const nv = v + k * c;
      if (nv < best[a][b] - EPS) { best[a][b] = nv; push(q, [nv, nd, a, b]); }
    }
  }
  return best;
}

function seedsOf(s) {
  const m = new Map(s.connectors);
  for (const [kk, y] of s.pad) m.set(kk, y);
  return m;
}

function siteEnv(W, H, s, k, fixed) {
  const seeds = seedsOf(s);
  const U = envelope(W, H, seeds, k, s.skirtMax, +1, fixed);
  const L = envelope(W, H, seeds, k, s.skirtMax, -1, fixed).map((r) => r.map((v) => -v));
  return [U, L];
}

const clip = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
// numpy rounds halves to even
const roundEven = (v) => { const f = Math.floor(v), r = v - f; return r > 0.5 ? f + 1 : r < 0.5 ? f : f % 2 === 0 ? f : f + 1; };

function dilate(m) {
  const W = m.length, H = m[0].length, o = m.map((r) => r.slice());
  for (let i = 0; i < W; i++) for (let j = 0; j < H; j++) {
    if (!m[i][j]) continue;
    if (i > 0) o[i - 1][j] = true; if (i < W - 1) o[i + 1][j] = true;
    if (j > 0) o[i][j - 1] = true; if (j < H - 1) o[i][j + 1] = true;
  }
  return o;
}

// a minus the lowest of b and its 4-neighbours
export function edgeGap(a, b) {
  const W = a.length, H = a[0].length, o = grid(W, H, 0);
  for (let i = 0; i < W; i++) for (let j = 0; j < H; j++) {
    let lo = b[i][j];
    if (i > 0) lo = Math.min(lo, b[i - 1][j]); if (i < W - 1) lo = Math.min(lo, b[i + 1][j]);
    if (j > 0) lo = Math.min(lo, b[i][j - 1]); if (j < H - 1) lo = Math.min(lo, b[i][j + 1]);
    o[i][j] = a[i][j] - lo;
  }
  return o;
}

function feather(h, T, hard) {
  const W = T.length, H = T[0].length;
  T = T.map((r) => r.slice());
  for (let n = 0; n < FEATHER; n++) {
    const moved = T.map((r, i) => r.map((v, j) => v !== h[i][j]));
    let changed = false;
    for (let i = 0; i < W; i++) for (let j = 0; j < H; j++) {
      if (!moved[i][j]) continue;
      const t = T[i][j];
      for (const [a, b] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) {
        if (a < 0 || a >= W || b < 0 || b >= H || hard[a][b] || moved[a][b]) continue;
        const up = T[a][b] - t, down = t - T[a][b];
        if (up >= 2 && up <= 3) { T[a][b] = t + 1; changed = true; }
        else if (down >= 2 && down <= 3) { T[a][b] = t - 1; changed = true; }
      }
    }
    if (!changed) break;
  }
  return T;
}

export function solve(h, sites, fixed = null) {
  const W = h.length, H = h[0].length;
  let U = grid(W, H, Infinity), L = grid(W, H, -Infinity);
  for (const s of sites) {
    let k = s.k || K_SOFT;
    let [u, l] = siteEnv(W, H, s, k, fixed);
    if (s.k == null) {
      const reach = u.map((r) => r.map((v) => !Number.isFinite(v)));
      const out = dilate(reach);
      let worst = -1;
      for (let i = 0; i < W; i++) for (let j = 0; j < H; j++) {
        if (reach[i][j] || !out[i][j]) continue; // the outermost cells the skirt reaches
        const t0 = clip(h[i][j], Math.ceil(l[i][j] - EPS), Math.floor(u[i][j] + EPS));
        worst = Math.max(worst, Math.abs(t0 - h[i][j]));
      }
      if (worst > 2) { k = K_STEEP; [u, l] = siteEnv(W, H, s, k, fixed); }
    }
    s.k = k;
    for (let i = 0; i < W; i++) for (let j = 0; j < H; j++) { U[i][j] = Math.min(U[i][j], u[i][j]); L[i][j] = Math.max(L[i][j], l[i][j]); }
  }
  let T = h.map((r) => r.slice());
  for (let i = 0; i < W; i++) for (let j = 0; j < H; j++) {
    if (!Number.isFinite(U[i][j]) && !Number.isFinite(L[i][j])) continue;
    const lo = Math.ceil(L[i][j] - EPS), hi = Math.floor(U[i][j] + EPS);
    T[i][j] = lo <= hi ? clip(h[i][j], lo, hi) : roundEven((lo + hi) / 2);
  }
  const pad = grid(W, H, false), hard = grid(W, H, false);
  for (const s of sites) {
    for (const [kk, y] of seedsOf(s)) { const [i, j] = unkey(kk); T[i][j] = y; hard[i][j] = true; }
    for (const kk of s.pad.keys()) { const [i, j] = unkey(kk); pad[i][j] = true; }
  }
  if (fixed) for (let i = 0; i < W; i++) for (let j = 0; j < H; j++) if (fixed[i][j]) { T[i][j] = h[i][j]; hard[i][j] = true; }
  T = feather(h, T, hard);
  const gap = edgeGap(T, T), gh = edgeGap(h, h), near = dilate(T.map((r, i) => r.map((v, j) => v !== h[i][j])));
  const wall = gap.map((r, i) => r.map((g, j) => g >= 2 && g > gh[i][j] && near[i][j] && !pad[i][j]));
  return { T, wall };
}

function hash(x, z, s) {
  const v = Math.imul(x, 73856093) ^ Math.imul(z, 19349663) ^ Math.imul(s, 83492791);
  return (v & 0xffff) / 65536;
}

// World blocks for a solved ground, as [{ x, y, z, id }] (cell i, j is world x0 + i, z0 + j)
export function blocks(h, T, wall, sites, region = "vale", x0 = 0, z0 = 0, fixed = null) {
  const R = REGION[region] ?? REGION.vale, out = new Map();
  const set = (x, y, z, id) => out.set(`${x},${y},${z}`, { x, y, z, id });
  const pad = new Map(), carve = new Map();
  for (const s of sites) for (const [kk, y] of s.pad) { pad.set(kk, s.padFill); carve.set(kk, Math.max(carve.get(kk) ?? 0, y + s.carve)); }
  const W = T.length, H = T[0].length, gap = edgeGap(T, T);
  for (let i = 0; i < W; i++) for (let j = 0; j < H; j++) {
    if (fixed && fixed[i][j]) continue;
    const t = T[i][j], g = h[i][j], kk = key(i, j);
    if (t === g && !pad.has(kk) && !wall[i][j]) continue;
    const x = x0 + i, z = z0 + j;
    if (pad.has(kk)) {
      const fill = pad.get(kk);
      for (let y = g + 1; y <= t; y++) set(x, y, z, fill === "stone" ? R.wall[0] : R.sub);
      if (fill === "soil") set(x, t, z, R.top);
      for (let y = t + 1; y <= Math.max(g, carve.get(kk)); y++) set(x, y, z, "air");
      continue;
    }
    for (let y = g + 1; y < t; y++) set(x, y, z, t - y <= SOIL ? R.sub : "stone");
    for (let y = t + 1; y <= g; y++) set(x, y, z, "air");
    if (t < g) for (let y = Math.max(t - SOIL, t - (g - t)); y < t; y++) set(x, y, z, R.sub);
    set(x, t, z, hash(x >> 1, z >> 1, 3) * R.patch[1] < 1 ? R.patch[0] : R.top);
    if (wall[i][j]) for (let y = t - gap[i][j] + 1; y <= t; y++) set(x, y, z, hash(x, z + y, 7) < 0.25 ? R.wall[1] : R.wall[0]);
  }
  return [...out.values()];
}
