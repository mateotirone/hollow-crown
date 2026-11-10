// Settlement walls: the levels and the ring geometry, as pure data and math (runs in Node too).
//
// The wall is a ring around the Plot Stone. It follows the ground: each stretch of wall stands on
// the ground under it and the wall-walk steps up and down a block at a time.
//
// Mateo approved these ten levels on 2026-11-10 (drawn by the textures thread). If they change,
// replace this table and nothing else needs to change.

export const WALLS = {
  radius: 56, // blocks from the Plot Stone to the outer face. The biggest hall (its back corners reach about 49) fits inside with room to walk. The map is flat to 60.
  landBeyond: 4, // your land reaches this far past the wall from the day it is raised
  spawnBeyond: 5, // raiders appear this far outside the wall
  reserve: 4, // nothing may be built this close to the line of the wall (either side)
  stations: 48, // how many points round the ring the ground is measured at
  maxStep: 6, // the ground may differ this much between neighbouring points before the wall refuses to span it
  perTick: 90, // blocks placed per tick while a wall rises
  auto: "map", // raise level 1 when a plot is claimed: "map" (only on a map with Plot Stones), "always", "off"
  gateWidth: 3, gateHeight: 4,
  tierCap: [3, 5, 8, 10],
  repair: { perBlock: 0.25, perCrack: 0.1, least: 1, perTick: 600 }, // price of a repair in lots (wallet.js): per missing block, per cracked block, and the least it costs. perTick = blocks looked at per tick. // the highest wall level a Hamlet, Town, City and Castle may raise
};

const cost = (...rows) => rows; // [label, amount, kind]: kind is matched to items in walls.js
// The ten levels follow the textures thread's design table (studio/art/build_walls.py, LEVELS), which is what
// Mateo sees in the Texture Studio. Keep the two in step. Not built from that table yet: sloped footings,
// overhanging battlements, tower roofs, gate arches and banners.
//   h = wall height above the ground. walk = height of a plank walkway behind a one-block wall (0 = none).
//   body / foot / cap / bands: "log", "fence" or a Castle Stone family kind; bands = { height: kind }.
//   towers = how many, r = half-width, up = how far they rise above the wall. gateArmor = reinforce state of the gate.
export const WALL_LEVELS = [
  null,
  { name: "Stake Fence", h: 1, thick: 1, body: "fence", gate: "open", cost: cost() },
  { name: "Palisade", h: 3, thick: 1, body: "log", gate: "castle_gate", gateH: 3, cost: cost(["logs", 128, "log"]) },
  { name: "Braced Palisade", h: 4, thick: 1, walk: 2, body: "log", foot: "cobbled", gate: "castle_gate", gateH: 3, cost: cost(["logs", 96, "log"], ["planks", 128, "plank"], ["Cobbled Castle Stone", 96, "cobbled"]) },
  { name: "Fieldstone Wall", h: 4, thick: 1, body: "cobbled", cap: "stone", gate: "castle_gate", gateH: 3, cost: cost(["Cobbled Castle Stone", 320, "cobbled"], ["Castle Stone", 96, "stone"]) },
  { name: "Stone Wall", h: 5, thick: 1, walk: 3, body: "stone", foot: "cobbled", battlements: true, gate: "castle_gate", gateH: 4, cost: cost(["Castle Stone", 384, "stone"], ["planks", 128, "plank"], ["iron ingots", 8, "iron"]) },
  { name: "Battlement Wall", h: 6, thick: 2, body: "stone", foot: "cobbled", bands: { 4: "bricks" }, battlements: true, gate: "castle_gate", gateArmor: 1, port: true, gateH: 4, cost: cost(["Castle Stone", 384, "stone"], ["Castle Stone Bricks", 128, "bricks"], ["iron ingots", 24, "iron"]) },
  { name: "Watch Wall", h: 7, thick: 2, body: "stone", foot: "cobbled", bands: { 5: "bricks" }, battlements: true, towers: 4, r: 2, up: 3, gate: "castle_gate", gateArmor: 1, port: true, gateH: 4, cost: cost(["Castle Stone", 384, "stone"], ["Castle Stone Bricks", 192, "bricks"], ["iron ingots", 32, "iron"]) },
  { name: "Curtain Wall", h: 9, thick: 3, body: "smooth", foot: "cobbled", footH: 2, bands: { 4: "bricks", 7: "bricks" }, battlements: true, towers: 8, r: 3, up: 4, gatehouse: true, gate: "castle_gate", gateArmor: 1, port: true, gateH: 5, cost: cost(["Smooth Castle Stone", 512, "smooth"], ["Castle Stone Bricks", 256, "bricks"], ["iron ingots", 64, "iron"]) },
  { name: "Great Curtain Wall", h: 11, thick: 3, body: "smooth", foot: "cobbled", footH: 2, bands: { 4: "bricks", 8: "bricks" }, battlements: true, towers: 8, r: 3, up: 5, gatehouse: true, gate: "castle_gate", gateArmor: 2, port: true, gateH: 5, cost: cost(["Smooth Castle Stone", 512, "smooth"], ["Castle Stone Bricks", 256, "bricks"], ["diamonds", 24, "diamond"]) },
  { name: "Crown Wall", h: 13, thick: 4, body: "smooth", foot: "cobbled", footH: 3, bands: { 5: "bricks", 9: "tiles", 10: "bricks" }, battlements: true, towers: 12, r: 3, up: 6, gatehouse: true, gate: "castle_gate", gateArmor: 3, port: true, gateH: 5, cost: cost(["Smooth Castle Stone", 640, "smooth"], ["Castle Stone Tiles", 192, "tiles"], ["Castle Stone Bricks", 256, "bricks"], ["netherite scrap", 8, "netherite"]) },
];
export const MAX_WALL = WALL_LEVELS.length - 1;

// How strong a wall of this level is, as a Castle Stone armor tier (0 stone, 1 iron, 2 diamond, 3 netherite)
export const wallArmor = (level) => WALL_LEVELS[level]?.gateArmor ?? 0;

// Everything that stands above the ground in one column of wall: [[y, kind], ...] where kind is a
// material ("log", "fence", "plank", a Castle Stone kind) or "tooth", "light", "gate", "port".
export function columnKinds(L, col) {
  const { x, z, base } = col, out = [];
  let top = col.top;
  if (col.role === "gap" || col.role === "gate" || col.role === "port") {
    if (L.gate === "open") return out;
    const gateH = Math.min(L.gateH ?? WALLS.gateHeight, Math.max(2, L.h - (L.h > 3 ? 1 : 0)));
    for (let y = base + 1; y <= top; y++) {
      if (y > base + gateH) out.push([y, materialKind(L, y - base, y === top)]);
      else if (col.role !== "gap") out.push([y, col.role]);
    }
    return out;
  }
  const tower = col.role === "tower", walk = col.role === "walk";
  if (!tower && !walk && L.body === "log") top += (x + z) & 1;
  for (let y = base + 1; y <= top; y++) out.push([y, walk ? "plank" : materialKind(L, Math.max(1, y - base), y === top)]);
  if (tower) {
    if (col.tooth) out.push([top + 1, "tooth"]);
    if (col.mid) out.push([top + 1, "light"]);
  } else if (!walk && L.battlements && col.d === 0 && ((x + z) & 1) === 0) out.push([top + 1, "tooth"]);
  return out;
}

// What a wall or tower column is made of at a height above its ground: "log", "fence" or a Castle Stone kind
export function materialKind(L, rel, top) {
  if (L.bands?.[rel]) return L.bands[rel];
  if (L.foot && rel <= (L.footH ?? 1)) return L.foot;
  if (top && L.cap) return L.cap;
  return L.body;
}

const TAU = Math.PI * 2;
const key = (x, z) => `${x},${z}`;
const turn = (a) => ((a % TAU) + TAU) % TAU;
// degrees clockwise from north (0 = north, 90 = east) -> math angle where +x is 0 and +z (south) is a quarter turn
export const bearingToAngle = (deg) => turn(((deg - 90) * Math.PI) / 180);

// Smooth the measured ground a little so one odd block doesn't put a notch in the wall
export function smoothGround(ground) {
  const n = ground.length;
  return ground.map((_, i) => [ground[(i + n - 1) % n], ground[i], ground[(i + 1) % n]].sort((a, b) => a - b)[1]);
}

// Height of the ground under the wall at an angle, between the measured points
export function groundAt(smooth, angle) {
  const n = smooth.length;
  const f = (turn(angle) / TAU) * n;
  const i = Math.floor(f) % n, t = f - Math.floor(f);
  return Math.round(smooth[i] * (1 - t) + smooth[(i + 1) % n] * t);
}

// Where the ground is measured: [{ x, z }] round the ring
export function stationSpots(center, radius = WALLS.radius, count = WALLS.stations) {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * TAU;
    return { x: Math.round(center.x + Math.cos(a) * (radius - 1)), z: Math.round(center.z + Math.sin(a) * (radius - 1)) };
  });
}

// Why a wall can't be raised on this ground, or undefined
export function groundProblem(ground) {
  for (let i = 0; i < ground.length; i++) {
    const step = Math.abs(ground[i] - ground[(i + 1) % ground.length]);
    if (step > WALLS.maxStep) return `The ground drops ${step} blocks in one stretch of the wall line. It needs levelling first.`;
  }
  return undefined;
}

// Every column of a wall: [{ x, z, base, top, role, d, a }] in the order it is built (round from the gate).
//   role: "wall" | "walk" (plank walkway behind a thin wall) | "tower" | "gate" and "port" (the gate and portcullis blocks) | "gap" (kept open)
//   d: 0 = outer face ... thick-1 = inner face (walls only). base/top: the y range of solid wall; the walk is at top.
export function wallColumns({ center, radius = WALLS.radius, level, gateAngle, smooth }) {
  const L = WALL_LEVELS[level];
  const cols = new Map();
  const put = (x, z, col) => {
    const k = key(x, z), old = cols.get(k);
    const rank = { gap: 6, gate: 5, port: 5, tower: 3, wall: 2, walk: 1 };
    if (!old || rank[col.role] > rank[old.role] || (col.role === old.role && col.d < old.d)) cols.set(k, { x, z, ...col });
  };
  const half = WALLS.gateWidth / 2;
  const steps = Math.ceil(TAU * radius * 1.6);
  const deep = L.thick + (L.walk ? 1 : 0); // a thin wall with a walkway has a column of planks behind it
  const gateD = Math.min(L.thick - 1, 1); // the gate hangs one block in from the face where the wall is thick enough
  for (let s = 0; s < steps; s++) {
    const a = (s / steps) * TAU;
    const g = groundAt(smooth, a);
    let off = turn(a - gateAngle); if (off > Math.PI) off -= TAU;
    const along = off * radius; // blocks along the wall from the middle of the gate
    for (let d = 0; d < deep; d++) {
      const x = Math.round(center.x + Math.cos(a) * (radius - d)), z = Math.round(center.z + Math.sin(a) * (radius - d));
      if (Math.abs(along) <= half) {
        const gg = groundAt(smooth, gateAngle);
        if (L.gate === "open") put(x, z, { role: "gap", base: gg, top: gg + L.h, d, a });
        else put(x, z, { role: d === gateD ? "gate" : d === 0 && L.port ? "port" : "gap", base: gg, top: gg + L.h, d, a });
      } else if (d >= L.thick) put(x, z, { role: "walk", base: g, top: g + L.walk, d, a });
      else put(x, z, { role: "wall", base: g, top: g + L.h, d, a });
    }
  }
  // towers, evenly spaced, the first pair either side of the gate
  const towers = [];
  for (let k = 0; k < (L.towers ?? 0); k++) towers.push(gateAngle + ((k + 0.5) / L.towers) * TAU);
  if (L.gatehouse) for (const side of [-1, 1]) towers.push(gateAngle + (side * (half + L.r + 1)) / radius);
  for (const a of towers) {
    const cx = Math.round(center.x + Math.cos(a) * (radius - 1)), cz = Math.round(center.z + Math.sin(a) * (radius - 1));
    const g = groundAt(smooth, a);
    for (let dx = -L.r; dx <= L.r; dx++) for (let dz = -L.r; dz <= L.r; dz++) {
      const edge = Math.abs(dx) === L.r || Math.abs(dz) === L.r;
      put(cx + dx, cz + dz, { role: "tower", base: g, top: g + L.h + L.up, d: edge ? 0 : 1, a, mid: dx === 0 && dz === 0, tooth: edge && (dx + dz) % 2 === 0 });
    }
  }
  const order = (c) => { let o = turn(c.a - gateAngle); return o; };
  return [...cols.values()].sort((p, q) => order(p) - order(q) || p.d - q.d);
}

// Is a spot on the line of the wall (within `reach` blocks of it)?
export const onWallLine = (center, location, radius = WALLS.radius, reach = WALLS.reserve) =>
  Math.abs(Math.hypot(location.x - (center.x + 0.5), location.z - (center.z + 0.5)) - (radius - 1)) <= reach;

// Where the gate stands (ground level, middle of the opening) and a spot just outside it
export function gateSpot(center, gateAngle, smooth, radius = WALLS.radius) {
  const y = groundAt(smooth, gateAngle);
  return {
    x: Math.round(center.x + Math.cos(gateAngle) * (radius - 1)), y, z: Math.round(center.z + Math.sin(gateAngle) * (radius - 1)),
    outside: { x: Math.round(center.x + Math.cos(gateAngle) * (radius + 8)), y, z: Math.round(center.z + Math.sin(gateAngle) * (radius + 8)) },
  };
}

// What a repair costs, in coins: nothing if nothing is wrong. lot = coins in a lot (wallet.js).
export function repairCost({ missing = 0, cracked = 0 }, lot = 1) {
  if (missing + cracked === 0) return 0;
  const R = WALLS.repair;
  return Math.max(R.least * lot, Math.ceil((missing * R.perBlock + cracked * R.perCrack) * lot));
}
