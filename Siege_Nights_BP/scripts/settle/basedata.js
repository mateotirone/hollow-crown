// What every new base gets besides its plots, as plain functions (Node-tested; basebuilds.js uses them).
//   pickBaseSlot(slots, taken, near, size) -> the tier-0 slot of that size closest to `near` that isn't taken
//   bedSpot(plan) -> { x, y, z } local foot of a bed (head toward +z) on a free spot of the ground floor, or undefined
//   bedSpots(plan) -> every such spot on the lowest floor that has one, best first (the first may be taken in the
//     world by something the player put there)

export function pickBaseSlot(slots, taken, near, size = "S") {
  const free = slots.filter((s) => s.tier === 0 && s.size === size && !taken.has(s.id) && !(s.tags ?? []).includes("library"));
  const mid = (s) => ({ x: (s.box.x0 + s.box.x1) / 2, z: (s.box.z0 + s.box.z1) / 2 });
  const d = (s) => Math.hypot(mid(s).x - near.x, mid(s).z - near.z) - ((s.tags ?? []).includes("square") ? 6 : 0);
  return free.sort((a, b) => d(a) - d(b))[0];
}

// A bed needs floor under both halves, two clear blocks over each, and walls round it (it is indoors); the spot
// furthest from the door wins, so the walk in stays clear.
export const bedSpot = (plan) => bedSpots(plan)[0];

export function bedSpots(plan) {
  const solid = new Set();
  for (const c of plan.cells.values()) if (c.role !== "air") solid.add(`${c.x},${c.y},${c.z}`);
  const has = (x, y, z) => solid.has(`${x},${y},${z}`);
  const b = plan.bounds();
  // the ground floor: the lowest level with room (a building on stilts or a plinth stands its floor higher)
  for (let f = 0; f <= 5; f++) {
    const walled = (x, z) => [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dz]) => {
      for (let k = 1; k <= 8; k++) if (has(x + dx * k, f + 1, z + dz * k) || has(x + dx * k, f + 2, z + dz * k)) return true;
      return false;
    });
    const ok = (x, z) => has(x, f, z) && !has(x, f + 1, z) && !has(x, f + 2, z) && walled(x, z);
    const found = [];
    for (let z = b.z1; z >= Math.max(b.z0, 2); z--) for (let x = b.x0; x <= b.x1; x++) {
      if (!ok(x, z) || !ok(x, z + 1)) continue;
      if (!ok(x - 1, z) && !ok(x + 1, z)) continue; // keep a block free beside it so it can be walked to
      found.push({ x, y: f + 1, z, score: z * 10 - Math.abs(x) });
    }
    if (found.length) return found.sort((a, b2) => b2.score - a.score).map(({ x, y, z }) => ({ x, y, z }));
  }
  return [];
}

// ---------- joining the settlement road to the map's roads (Mateo's playtest 2026-11-12) ----------
//   gateDir(bearing) -> { x, z } the cardinal way out through the gate (bearings in degrees, 0 = north, 90 = east)
//   roadEnd(paths, dir) -> { x, z } the path column furthest out that way (paths: [{x, z}] path tops of the groundwork)
//   roadLine(a, b) -> [{x, z}] every column from a to b, one block at a time, a and b included
//   gradeLine(h0, h1, n) -> n + 1 heights from h0 to h1, as even as the drop allows (never more than 1 a block
//     when |h1 - h0| <= n)
export const ROAD_BLOCKS = /^minecraft:(grass_path|dirt_path|cobblestone|mossy_cobblestone|gravel|coarse_dirt|sandstone|smooth_sandstone)$/;
export const WEAK_ROAD = /gravel|coarse_dirt|sandstone/; // also found wild, so only taken when nothing better is near
// the groundwork blocks that count as a town's paths (the gate road's end is the one furthest out the gate's way)
export const ROAD_JOIN_PATHY = /grass_path|dirt_path|gravel|cobble|sandstone|planks|_slab|brick|coarse_dirt|packed_mud|mud_bricks/;

export const gateDir = (bearing) => {
  const b = ((Number(bearing) || 0) * Math.PI) / 180;
  return { x: Math.round(Math.sin(b)), z: Math.round(-Math.cos(b)) };
};

export function roadEnd(paths, dir) {
  let best, score = -Infinity;
  for (const p of paths) {
    const s = (p.x * dir.x + p.z * dir.z) * 4 - Math.abs(p.x * dir.z - p.z * dir.x); // far out, near the middle line
    if (s > score) { score = s; best = p; }
  }
  return best;
}

export function roadLine(a, b) {
  const out = [];
  let x = a.x, z = a.z;
  const dx = Math.abs(b.x - x), dz = -Math.abs(b.z - z), sx = x < b.x ? 1 : -1, sz = z < b.z ? 1 : -1;
  let err = dx + dz;
  for (;;) {
    out.push({ x, z });
    if (x === b.x && z === b.z) return out;
    const e2 = 2 * err;
    // one axis at a time, so the road never joins only at a corner
    if (e2 >= dz && (e2 <= dx ? Math.abs(err + dz) <= Math.abs(err + dx) : true)) { err += dz; x += sx; }
    else { err += dx; z += sz; }
  }
}

export function gradeLine(h0, h1, n) {
  const out = [];
  for (let i = 0; i <= n; i++) out.push(n ? Math.round(h0 + ((h1 - h0) * i) / n) : h0);
  return out;
}

// ---------- the worked-out route to the map road (Mateo's playtest 2026-11-13, "My path just ends") ----------
//   joinRoute(join, end) -> [{x, z}] every column of a plot's road out (roadjoin_data.js), corner to corner; when the
//     town's own gate road ends somewhere else than the route's `from` (a re-exported layout), a line from there first
//   routeSides(cells, i) -> { x, z } the way across the road at cell i (perpendicular to the way it runs there)
//   gradeRoute(ground, h0, h1) -> heights for the cells: following the ground (smoothed), never more than 1 a block,
//     starting at h0 (the gate road) and ending at h1 (the map road) wherever the distance allows
//   joinSurface(region, x, z) -> the block for that road column, in the map's own road mix (map/genworld.py)
export function joinRoute(join, end) {
  const out = [];
  const add = (c) => { const l = out[out.length - 1]; if (!l || l.x !== c.x || l.z !== c.z) out.push(c); };
  const from = { x: join.from[0], z: join.from[1] };
  if (end && (end.x !== from.x || end.z !== from.z)) for (const c of roadLine(end, from)) add(c);
  const corners = join.path.map(([x, z]) => ({ x, z }));
  if (!corners.length) return out;
  add(corners[0]);
  for (let k = 0; k + 1 < corners.length; k++) for (const c of roadLine(corners[k], corners[k + 1])) add(c);
  return out;
}

export function routeSides(cells, i) {
  const a = cells[Math.max(0, i - 2)], b = cells[Math.min(cells.length - 1, i + 2)];
  return Math.abs(b.x - a.x) >= Math.abs(b.z - a.z) ? { x: 0, z: 1 } : { x: 1, z: 0 };
}

export function gradeRoute(ground, h0, h1) {
  const n = ground.length;
  if (!n) return [];
  const g = ground.map((y, i) => {
    const w = [];
    for (let k = Math.max(0, i - 2); k <= Math.min(n - 1, i + 2); k++) if (Number.isFinite(ground[k])) w.push(ground[k]);
    return w.length ? w.sort((a, b) => a - b)[w.length >> 1] : h0;
  });
  const out = new Array(n);
  out[0] = h0;
  for (let i = 1; i < n; i++) out[i] = Math.max(out[i - 1] - 1, Math.min(out[i - 1] + 1, g[i]));
  if (Number.isFinite(h1)) {
    out[n - 1] = Math.max(out[n - 1] - (n - 1), Math.min(out[n - 1] + (n - 1), h1));
    for (let i = n - 2; i >= 1; i--) out[i] = Math.max(out[i + 1] - 1, Math.min(out[i + 1] + 1, out[i]));
    // the backward pass can pull the start out of reach of h0 only when the ends are too far apart in height
    for (let i = 1; i < n; i++) out[i] = Math.max(out[i - 1] - 1, Math.min(out[i - 1] + 1, out[i]));
  }
  return out;
}

const SURFACE_MIX = {
  // genworld.py: grass_path 45, gravel 25, cobblestone 18, mossy cobblestone 12; frozen ground swaps grass_path for
  // gravel; the Emberwaste lays sandstone 60, gravel 40
  default: [["minecraft:grass_path", 45], ["minecraft:gravel", 25], ["minecraft:cobblestone", 18], ["minecraft:mossy_cobblestone", 12]],
  Frostmarch: [["minecraft:gravel", 70], ["minecraft:cobblestone", 18], ["minecraft:mossy_cobblestone", 12]],
  Emberwaste: [["minecraft:sandstone", 60], ["minecraft:gravel", 40]],
};
export function joinSurface(region, x, z) {
  const mix = SURFACE_MIX[region] ?? SURFACE_MIX.default;
  let r = (Math.imul(x, 73856093) ^ Math.imul(z, 19349663)) >>> 0;
  r = (Math.imul(r ^ (r >>> 13), 1274126177) >>> 0) % 100;
  for (const [id, w] of mix) { if (r < w) return id; r -= w; }
  return mix[0][0];
}
