// Route finding for marching soldiers (pure, no Minecraft). army.js feeds it the ground.
//
// Mateo (2026-11-12): soldiers look for openings and bridges, never go straight through water unless there is
// nothing else, and never run into a wall following you through a gate. They follow the leader's own trail (so
// a gate the leader rode through is the gate they use); where that trail crosses water, findPath plans a way round
// on a coarse grid: water costs a lot, steep steps are walls, and only if nothing else reaches do they swim.

export const ROUTE = {
  cell: 2,          // grid step in blocks
  water: 40,        // cost of a water cell (a dry cell costs 1)
  climb: 0.5,       // extra cost per block of height change
  maxStep: 1,       // a step higher than this between neighbouring cells can't be taken (horses jump 1)
  pad: 48,          // how far round the gap the search may go
  maxNodes: 6000,   // give up after this many cells
  crumb: 2,         // the leader leaves a crumb every 2 blocks
};

// A* over cells. ground(x, z) -> { y, water } or undefined (unloaded or no footing). Returns a list of
// { x, y, z } block positions from start to goal, or undefined. A generator: yield every so often so a caller
// can spread the work over ticks (system.runJob); run() below drives it in one go for tests.
export function* findPath(start, goal, ground, opts = {}) {
  const o = { ...ROUTE, ...opts };
  const c = o.cell;
  const key = (i, j) => `${i},${j}`;
  const si = Math.round(start.x / c), sj = Math.round(start.z / c), gi = Math.round(goal.x / c), gj = Math.round(goal.z / c);
  const minI = Math.min(si, gi) - Math.ceil(o.pad / c), maxI = Math.max(si, gi) + Math.ceil(o.pad / c);
  const minJ = Math.min(sj, gj) - Math.ceil(o.pad / c), maxJ = Math.max(sj, gj) + Math.ceil(o.pad / c);
  const cache = new Map();
  const at = (i, j) => {
    const k = key(i, j);
    if (!cache.has(k)) cache.set(k, ground(i * c, j * c) ?? null);
    return cache.get(k);
  };
  const h = (i, j) => { const di = Math.abs(i - gi), dj = Math.abs(j - gj); return Math.max(di, dj) + 0.414 * Math.min(di, dj); };
  const open = [[h(si, sj), 0, si, sj]];
  const best = new Map([[key(si, sj), 0]]);
  const from = new Map();
  let seen = 0;
  while (open.length) {
    // the open list stays small enough (a few thousand) for a linear pick
    let bi = 0;
    for (let n = 1; n < open.length; n++) if (open[n][0] < open[bi][0]) bi = n;
    const [, g, i, j] = open[bi];
    open[bi] = open[open.length - 1];
    open.pop();
    if (g > (best.get(key(i, j)) ?? Infinity)) continue;
    if (i === gi && j === gj) {
      const path = [];
      for (let k = key(i, j); k; k = from.get(k)) {
        const [pi, pj] = k.split(",").map(Number);
        const cell = at(pi, pj);
        path.push({ x: pi * c, y: cell?.y ?? start.y, z: pj * c });
      }
      return path.reverse();
    }
    if (++seen > o.maxNodes) return undefined;
    if (seen % 64 === 0) yield;
    const here = at(i, j);
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      if (!di && !dj) continue;
      const ni = i + di, nj = j + dj;
      if (ni < minI || ni > maxI || nj < minJ || nj > maxJ) continue;
      const next = at(ni, nj);
      if (!next) continue;
      const dy = here ? Math.abs(next.y - here.y) : 0;
      if (dy > o.maxStep * c && !(here?.water || next.water)) continue; // a cliff or a wall
      const step = (di && dj ? 1.414 : 1) * (next.water ? o.water : 1) + dy * o.climb;
      const ng = g + step, nk = key(ni, nj);
      if (ng < (best.get(nk) ?? Infinity)) {
        best.set(nk, ng);
        from.set(nk, key(i, j));
        open.push([ng + h(ni, nj), ng, ni, nj]);
      }
    }
  }
  return undefined;
}

// Drive a generator to its end (tests, small searches)
export function run(gen) {
  let r = gen.next();
  while (!r.done) r = gen.next();
  return r.value;
}

// Where the trail crosses water: [first wet index, last wet index] runs, given crumbs { x, y, z, wet }
export function wetRuns(trail) {
  const runs = [];
  let start = -1;
  trail.forEach((p, n) => {
    if (p.wet && start < 0) start = n;
    if (!p.wet && start >= 0) { runs.push([start, n - 1]); start = -1; }
  });
  if (start >= 0) runs.push([start, trail.length - 1]);
  return runs;
}

// Swims a path takes (cells in water): a detour that still swims as much as the trail is no better
export const swims = (path, ground) => path.filter((p) => ground(p.x, p.z)?.water).length;

// A point `back` blocks behind position `n` along the trail (for spacing soldiers out behind the leader)
export function behind(trail, n, back) {
  let left = back;
  for (let k = n; k > 0; k--) {
    const a = trail[k], b = trail[k - 1];
    const d = Math.hypot(a.x - b.x, a.z - b.z);
    if (d >= left) { const t = left / d; return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t, n: k }; }
    left -= d;
  }
  return { ...trail[0], n: 0 };
}
