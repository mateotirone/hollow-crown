// Settlement walls: the levels and the ring geometry, as pure data and math (runs in Node too).
//
// The wall is a ring around the Plot Stone whose line wanders in and out (wallShape). It follows the ground: each stretch of wall stands on
// the ground under it and the wall-walk steps up and down a block at a time.
//
// Mateo approved these ten levels on 2026-11-10 (drawn by the textures thread). If they change,
// replace this table and nothing else needs to change.

export const WALLS = {
  radius: 56, // blocks from the Plot Stone to the outer face. The biggest hall (its back corners reach about 49) fits inside with room to walk. The map is flat to 60.
  landBeyond: 4, // your land reaches this far past the wall from the day it is raised
  spawnBeyond: 5, // raiders appear this far outside the wall
  reserve: 4, // nothing may be built this close to the line of the wall (either side)
  wobble: { out: 4, in: 2 }, // the wall line wanders: up to this many blocks out (at radius 56, less on smaller rings) and in
  // (in stays under the town layouts' 3-block clearance, so it never cuts a plot)
  stations: 48, // how many points round the ring the ground is measured at
  maxStep: 6, // the ground may differ this much between neighbouring points before the wall refuses to span it
  perTick: 90, // blocks placed per tick while a wall rises
  auto: "map", // raise level 1 when a plot is claimed: "map" (only on a map with Plot Stones), "always", "off"
  gateWidth: 3, gateHeight: 4,
  tierCap: [3, 5, 8, 10],
  repair: { perBlock: 0.25, perCrack: 0.1, least: 1, perTick: 600 }, // price of a repair in lots (wallet.js): per missing block, per cracked block, and the least it costs. perTick = blocks looked at per tick. // the highest wall level a Hamlet, Town, City and Castle may raise
};

const cost = (...rows) => rows; // [label, amount, kind]: kind is matched to items in walls.js
// Settlements are "everything free, no exceptions" (Mateo, 2026-11-11): a wall's stonework can be paid in any
// stone and built in any stone. The cost rows still name a kind ("stone", "bricks"...) because that is the wall's
// shape, but wallCost() accepts any stone block for all of them and adds the rows together.
// The ten levels follow the textures thread's design table (studio/art/build_walls.py, LEVELS), which is what
// Mateo sees in the Texture Studio. Keep the two in step. Not built from that table yet: sloped footings,
// overhanging battlements, tower roofs, gate arches and banners.
//   h = wall height above the ground. walk = height of a plank walkway behind a one-block wall (0 = none).
//   body / foot / cap / bands: "log", "fence" or a stonework kind (stone, tiles, bricks, cobbled, smooth); bands = { height: kind }.
//   Which real blocks those kinds are is the owner's choice: WALL_STONES and WALL_TIMBER below.
//   towers = how many, r = half-width, up = how far they rise above the wall. gateArmor = reinforce state of the gate.
export const WALL_LEVELS = [
  null,
  { name: "Stake Fence", h: 1, thick: 1, body: "fence", gate: "open", cost: cost() },
  { name: "Palisade", h: 3, thick: 1, body: "log", gate: "castle_gate", gateH: 3, cost: cost(["logs", 128, "log"]) },
  { name: "Braced Palisade", h: 4, thick: 1, walk: 2, body: "log", foot: "cobbled", gate: "castle_gate", gateH: 3, cost: cost(["logs", 96, "log"], ["planks", 128, "plank"], ["stone blocks", 96, "cobbled"]) },
  { name: "Fieldstone Wall", h: 4, thick: 1, body: "cobbled", cap: "stone", gate: "castle_gate", gateH: 3, cost: cost(["stone blocks", 320, "cobbled"], ["stone blocks", 96, "stone"]) },
  { name: "Stone Wall", h: 5, thick: 1, walk: 3, body: "stone", foot: "cobbled", battlements: true, gate: "castle_gate", gateH: 4, cost: cost(["stone blocks", 384, "stone"], ["planks", 128, "plank"], ["iron ingots", 8, "iron"]) },
  { name: "Battlement Wall", h: 6, thick: 2, body: "stone", foot: "cobbled", bands: { 4: "bricks" }, battlements: true, gate: "castle_gate", gateArmor: 1, port: true, gateH: 4, cost: cost(["stone blocks", 384, "stone"], ["stone blocks", 128, "bricks"], ["iron ingots", 24, "iron"]) },
  { name: "Watch Wall", h: 7, thick: 2, body: "stone", foot: "cobbled", bands: { 5: "bricks" }, battlements: true, towers: 4, r: 2, up: 3, gate: "castle_gate", gateArmor: 1, port: true, gateH: 4, cost: cost(["stone blocks", 384, "stone"], ["stone blocks", 192, "bricks"], ["iron ingots", 32, "iron"]) },
  { name: "Curtain Wall", h: 9, thick: 3, body: "smooth", foot: "cobbled", footH: 2, bands: { 4: "bricks", 7: "bricks" }, battlements: true, towers: 8, r: 3, up: 4, gatehouse: true, gate: "castle_gate", gateArmor: 1, port: true, gateH: 5, cost: cost(["stone blocks", 512, "smooth"], ["stone blocks", 256, "bricks"], ["iron ingots", 64, "iron"]) },
  { name: "Great Curtain Wall", h: 11, thick: 3, body: "smooth", foot: "cobbled", footH: 2, bands: { 4: "bricks", 8: "bricks" }, battlements: true, towers: 8, r: 3, up: 5, gatehouse: true, gate: "castle_gate", gateArmor: 2, port: true, gateH: 5, cost: cost(["stone blocks", 512, "smooth"], ["stone blocks", 256, "bricks"], ["diamonds", 24, "diamond"]) },
  { name: "Crown Wall", h: 13, thick: 4, body: "smooth", foot: "cobbled", footH: 3, bands: { 5: "bricks", 9: "tiles", 10: "bricks" }, battlements: true, towers: 12, r: 3, up: 6, gatehouse: true, gate: "castle_gate", gateArmor: 3, port: true, gateH: 5, cost: cost(["stone blocks", 640, "smooth"], ["stone blocks", 192, "tiles"], ["stone blocks", 256, "bricks"], ["netherite scrap", 8, "netherite"]) },
];
export const MAX_WALL = WALL_LEVELS.length - 1;

// How strong a wall of this level is, as a Castle Stone armor tier (0 stone, 1 iron, 2 diamond, 3 netherite)
export const wallArmor = (level) => WALL_LEVELS[level]?.gateArmor ?? 0;

// ---------- variation ----------
// No two stretches of wall are quite alike, and no two settlements' walls are the same: stone weathers
// in patches, towers stand at slightly different heights, arrow slits and lanterns break up the long
// runs, and a palisade's stakes are uneven. It is all worked out from the position (and the wall's
// centre), never at random, so a wall rebuilt or repaired comes out exactly as it was.
// ---------- what a wall is built in: the owner's choice ----------
// Castle Stone is one colour option per region, not a requirement (Mateo, 2026-11-11, "everything free").
// Each stone look names the block for every stonework kind, with fallbacks for older game versions.
// "castle" means the settlement's own region's Castle Stone; castle_<region> picks another region's.
const mc = (...ids) => ids.map((id) => (id.includes(":") ? id : `minecraft:${id}`));
const castleLook = (region) => ({
  name: region ? `${region[0].toUpperCase()}${region.slice(1)} Castle Stone` : "Castle Stone of your region", castle: region ?? true,
});
export const WALL_STONES = {
  castle: castleLook(),
  castle_vale: castleLook("vale"), castle_frostmarch: castleLook("frostmarch"), castle_saltreach: castleLook("saltreach"),
  castle_emberwaste: castleLook("emberwaste"), castle_blackfen: castleLook("blackfen"),
  grey: { name: "Grey stone brick", kinds: { stone: mc("stone_bricks"), tiles: mc("chiseled_stone_bricks", "stone_bricks"), bricks: mc("polished_andesite"), cobbled: mc("cobblestone"), smooth: mc("smooth_stone", "stone") } },
  deepslate: { name: "Deepslate", kinds: { stone: mc("deepslate_bricks"), tiles: mc("deepslate_tiles"), bricks: mc("polished_deepslate"), cobbled: mc("cobbled_deepslate"), smooth: mc("polished_deepslate") } },
  tuff: { name: "Tuff", kinds: { stone: mc("tuff_bricks", "stone_bricks"), tiles: mc("chiseled_tuff_bricks", "chiseled_tuff", "stone_bricks"), bricks: mc("polished_tuff", "andesite"), cobbled: mc("tuff"), smooth: mc("polished_tuff", "smooth_stone") } },
  sandstone: { name: "Sandstone", kinds: { stone: mc("cut_sandstone"), tiles: mc("chiseled_sandstone"), bricks: mc("cut_red_sandstone"), cobbled: mc("sandstone"), smooth: mc("smooth_sandstone") } },
  white: { name: "White stone", kinds: { stone: mc("calcite"), tiles: mc("quartz_bricks"), bricks: mc("polished_diorite"), cobbled: mc("diorite"), smooth: mc("smooth_quartz") } },
  red_brick: { name: "Red brick", kinds: { stone: mc("brick_block"), tiles: mc("mud_bricks"), bricks: mc("polished_granite"), cobbled: mc("cobblestone"), smooth: mc("brick_block") } },
  mud: { name: "Mud brick", kinds: { stone: mc("mud_bricks"), tiles: mc("packed_mud"), bricks: mc("brick_block"), cobbled: mc("mossy_cobblestone"), smooth: mc("packed_mud") } },
  blackstone: { name: "Blackstone", kinds: { stone: mc("polished_blackstone_bricks"), tiles: mc("chiseled_polished_blackstone"), bricks: mc("gilded_blackstone", "polished_blackstone"), cobbled: mc("blackstone"), smooth: mc("polished_blackstone") } },
};
export const WALL_STONE_IDS = Object.keys(WALL_STONES);
export const WALL_TIMBER = ["vale", "frostmarch", "saltreach", "emberwaste", "blackfen"]; // palisade, walkway planks and gates: any region's

export const VARIATION = { weather: 0.22, slitEvery: 9, lightEvery: 14, postEvery: 8, towerBump: 2 };

// A repeatable number 0..1 for a block position
export function hash3(x, y, z, seed = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1274126177) ^ Math.imul(seed | 0, 1103515245);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export const wallSeed = (center) => (Math.imul(center.x | 0, 73856093) ^ Math.imul(center.z | 0, 19349663)) >>> 0;

const WEATHERED = { smooth: "stone", stone: "cobbled", cobbled: "stone" };
// Stone weathers in patches a few blocks across; bands of brick and tile stay crisp
function weather(kind, x, y, z, seed) {
  if (!WEATHERED[kind]) return kind;
  const patch = hash3(Math.floor(x / 3), Math.floor(y / 2), Math.floor(z / 3), seed) < VARIATION.weather;
  return patch && hash3(x, y, z, seed + 1) < 0.7 ? WEATHERED[kind] : kind;
}
const every = (along, n, at) => ((Math.round(along) % n) + n) % n === at;

// Everything that stands above the ground in one column of wall: [[y, kind], ...] where kind is a
// material ("log", "fence", "plank", a Castle Stone kind) or "tooth", "light", "slit", "gate", "port".
export function columnKinds(L, col, seed = 0) {
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
  const wood = L.body === "log" || L.body === "fence";
  const along = col.along ?? 0;
  if (!tower && !walk && L.body === "log") {
    top += (x + z) & 1; // a palisade's uneven points
    if (every(along, VARIATION.postEvery, 0)) top += 1; // a taller post now and then
    else if (hash3(x, 0, z, seed) < 0.1) top -= 1; // and the odd short stake
  }
  for (let y = base + 1; y <= top; y++) {
    if (walk) { out.push([y, "plank"]); continue; }
    const rel = Math.max(1, y - base);
    let kind = materialKind(L, rel, y === top);
    if (!wood && !L.bands?.[rel]) kind = weather(kind, x, y, z, seed);
    // arrow slits: along the upper wall, and on each face of a tower
    if (!wood && col.d === 0 && L.h >= 5 && ((!tower && rel === L.h - 1 && every(along, VARIATION.slitEvery, 4)) || (tower && col.face && (rel === L.h + 1 || rel === 3)))) kind = "slit";
    out.push([y, kind]);
  }
  if (walk) return out;
  if (tower) {
    if (col.tooth) out.push([top + 1, "tooth"]);
    if (col.mid) out.push([top + 1, "light"]);
    return out;
  }
  const tooth = L.battlements && col.d === 0 && ((x + z) & 1) === 0;
  if (tooth) out.push([top + 1, "tooth"]);
  else if (col.d === 0 && L.body !== "log" && every(along, L.body === "fence" ? VARIATION.lightEvery + 2 : VARIATION.lightEvery, 7) && (L.h >= 4 || L.body === "fence")) out.push([top + 1, "light"]); // a lantern on the wall top
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

// The wall is not a perfect circle (Mateo, 2026-11-11): its line wanders in and out with a few slow waves,
// different for every settlement and the same every time. shape = 72 numbers from -1 to 1, one every 5 degrees.
export function wallShape(seedText) {
  let a = 2166136261;
  for (const c of String(seedText)) a = Math.imul(a ^ c.charCodeAt(0), 16777619);
  const rnd = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const waves = [2, 3, 5, 7].map((k) => ({ k, amp: (0.05 + rnd() * 0.17) / (1 + 0.15 * k), ph: rnd() * TAU }));
  const raw = Array.from({ length: 72 }, (_, i) => waves.reduce((f, w) => f + w.amp * Math.cos(w.k * (i / 72) * TAU + w.ph), 0));
  const top = Math.max(...raw.map(Math.abs)) || 1;
  return raw.map((v) => Math.round((v / top) * 100) / 100);
}

// How far out the wall stands at angle a (radians): its ring radius, wandered by center.shape (if it has one)
export function radiusAt(center, radius, a) {
  const shape = center?.shape;
  if (!shape?.length) return radius;
  const f = (turn(a) / TAU) * shape.length;
  const i = Math.floor(f) % shape.length, t = f - Math.floor(f);
  const g = shape[i] * (1 - t) + shape[(i + 1) % shape.length] * t;
  // outward it stays 2 blocks inside the land (WALLS.radius + landBeyond), so the outer ring never meets the border
  const out = Math.min(WALLS.wobble.out * Math.min(1, radius / WALLS.radius), WALLS.radius + WALLS.landBeyond - 2 - radius);
  return radius + (g > 0 ? g * Math.max(0, out) : g * WALLS.wobble.in);
}

// Where the ground is measured: [{ x, z }] round the ring
export function stationSpots(center, radius = WALLS.radius, count = WALLS.stations) {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * TAU;
    const r = radiusAt(center, radius, a);
    return { x: Math.round(center.x + Math.cos(a) * (r - 1)), z: Math.round(center.z + Math.sin(a) * (r - 1)) };
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
  const steps = Math.ceil(TAU * (radius + WALLS.wobble.out) * 1.6);
  const deep = L.thick + (L.walk ? 1 : 0); // a thin wall with a walkway has a column of planks behind it
  const gateD = Math.min(L.thick - 1, 1); // the gate hangs one block in from the face where the wall is thick enough
  for (let s = 0; s < steps; s++) {
    const a = (s / steps) * TAU;
    const g = groundAt(smooth, a);
    let off = turn(a - gateAngle); if (off > Math.PI) off -= TAU;
    const along = off * radius; // blocks along the wall from the middle of the gate
    const r = radiusAt(center, radius, a);
    for (let d = 0; d < deep; d++) {
      const x = Math.round(center.x + Math.cos(a) * (r - d)), z = Math.round(center.z + Math.sin(a) * (r - d));
      if (Math.abs(along) <= half) {
        const gg = groundAt(smooth, gateAngle);
        if (L.gate === "open") put(x, z, { role: "gap", base: gg, top: gg + L.h, d, a });
        else put(x, z, { role: d === gateD ? "gate" : d === 0 && L.port ? "port" : "gap", base: gg, top: gg + L.h, d, a });
      } else if (d >= L.thick) put(x, z, { role: "walk", base: g, top: g + L.walk, d, a, along });
      else put(x, z, { role: "wall", base: g, top: g + L.h, d, a, along });
    }
  }
  // towers, evenly spaced, the first pair either side of the gate
  // each tower stands a little taller or shorter than its neighbours; the gatehouse pair match and stand proud
  const seed = wallSeed(center);
  const towers = [];
  for (let k = 0; k < (L.towers ?? 0); k++) towers.push([gateAngle + ((k + 0.5) / L.towers) * TAU, Math.floor(hash3(k, 7, 0, seed) * (VARIATION.towerBump + 1))]);
  if (L.gatehouse) for (const side of [-1, 1]) towers.push([gateAngle + (side * (half + L.r + 1)) / radius, 1]);
  for (const [a, bump] of towers) {
    const r = radiusAt(center, radius, a);
    const cx = Math.round(center.x + Math.cos(a) * (r - 1)), cz = Math.round(center.z + Math.sin(a) * (r - 1));
    const g = groundAt(smooth, a);
    for (let dx = -L.r; dx <= L.r; dx++) for (let dz = -L.r; dz <= L.r; dz++) {
      const edge = Math.abs(dx) === L.r || Math.abs(dz) === L.r;
      put(cx + dx, cz + dz, { role: "tower", base: g, top: g + L.h + L.up + bump, d: edge ? 0 : 1, a, mid: dx === 0 && dz === 0, tooth: edge && (dx + dz) % 2 === 0, face: edge && (dx === 0 || dz === 0) });
    }
  }
  const order = (c) => turn(c.a - gateAngle);
  return [...cols.values()].sort((p, q) => order(p) - order(q) || p.d - q.d);
}

// Is a spot on the line of the wall (within `reach` blocks of it)?
export function onWallLine(center, location, radius = WALLS.radius, reach = WALLS.reserve) {
  const dx = location.x - (center.x + 0.5), dz = location.z - (center.z + 0.5);
  return Math.abs(Math.hypot(dx, dz) - (radiusAt(center, radius, Math.atan2(dz, dx)) - 1)) <= reach;
}

// Where the gate stands (ground level, middle of the opening) and a spot just outside it
export function gateSpot(center, gateAngle, smooth, radius = WALLS.radius) {
  const y = groundAt(smooth, gateAngle);
  const r = radiusAt(center, radius, gateAngle);
  return {
    x: Math.round(center.x + Math.cos(gateAngle) * (r - 1)), y, z: Math.round(center.z + Math.sin(gateAngle) * (r - 1)),
    outside: { x: Math.round(center.x + Math.cos(gateAngle) * (r + 8)), y, z: Math.round(center.z + Math.sin(gateAngle) * (r + 8)) },
  };
}

// What a repair costs, in coins: nothing if nothing is wrong. lot = coins in a lot (wallet.js).
export function repairCost({ missing = 0, cracked = 0 }, lot = 1) {
  if (missing + cracked === 0) return 0;
  const R = WALLS.repair;
  return Math.max(R.least * lot, Math.ceil((missing * R.perBlock + cracked * R.perCrack) * lot));
}
