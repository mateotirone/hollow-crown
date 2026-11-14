// Settlement walls: the levels and the ring geometry, as pure data and math (runs in Node too).
//
// The wall is a ring around the Plot Stone whose line wanders in and out (wallShape). It follows the ground: each stretch of wall stands on
// the ground under it and the wall-walk steps up and down a block at a time.
//
// Mateo approved these ten levels on 2026-11-10 (drawn by the textures thread). If they change,
// replace this table and nothing else needs to change.

export const WALLS = {
  radius: 66, // the Castle ring: blocks from the Plot Stone to the outer face (Mateo 2026-11-12: rings 36, 46, 56, 66 by tier). Land ends at radius + landBeyond.
  landBeyond: 6, // your land reaches this far past the wall from the day it is raised (66 + 6 = 72, the map's land edge)
  spawnBeyond: 5, // raiders appear this far outside the wall
  reserve: 4, // nothing may be built this close to the line of the wall (either side)
  wobble: { out: 4, in: 2 }, // the wall line wanders: up to this many blocks out (at the Castle ring, less on smaller rings) and in
  // (in stays under the town layouts' 3-block clearance, so it never cuts a plot)
  stations: 48, // how many points round the ring the ground is measured at
  maxStep: 6, // the ground may differ this much between neighbouring points before the wall refuses to span it
  perTick: 90, // blocks placed per tick while a wall rises
  auto: "map", // raise level 1 when a plot is claimed: "map" (only on a map with Plot Stones), "always", "off"
  gateWidth: 3, gateHeight: 4, gateGreet: 4, // a friend this close to their own gate gets it opened by the guard
  tierCap: [3, 5, 8, 10],
  stairs: 4, // flights of steps up the inside of the wall: one either side of the gate, two more round the ring
  stairFromGate: 12, // blocks from the middle of the gate to the foot of the flights beside it
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
//   quoin = the kind of a tower's corner stones (dressed walls only).
//   towers = how many, r = half-width, up = how far they rise above the wall. gateArmor = reinforce state of the gate.
export const WALL_LEVELS = [
  null,
  { name: "Low Palisade", h: 2, thick: 1, body: "log", gate: "open", cost: cost() }, // Mateo 2026-11-11: a low wall like level 2, not a fence
  { name: "Palisade", h: 3, thick: 1, walk: 2, body: "log", gate: "castle_gate", gateH: 3, cost: cost(["logs", 128, "log"], ["planks", 96, "plank"]) }, // walk added 2026-11-12 (Mateo: guards need to stand on the wall)
  { name: "Braced Palisade", h: 4, thick: 1, walk: 2, body: "log", foot: "cobbled", gate: "castle_gate", gateH: 3, cost: cost(["logs", 96, "log"], ["planks", 128, "plank"], ["stone blocks", 96, "cobbled"]) },
  { name: "Fieldstone Wall", h: 4, thick: 1, walk: 3, body: "cobbled", cap: "stone", gate: "castle_gate", gateH: 3, cost: cost(["stone blocks", 320, "cobbled"], ["stone blocks", 96, "stone"], ["planks", 128, "plank"]) }, // walk added 2026-11-12
  { name: "Stone Wall", h: 5, thick: 1, walk: 3, body: "smooth", quoin: "stone", foot: "cobbled", battlements: true, gate: "castle_gate", gateH: 4, cost: cost(["stone blocks", 384, "smooth"], ["planks", 128, "plank"], ["iron ingots", 8, "iron"]) },
  { name: "Battlement Wall", h: 6, thick: 2, body: "smooth", quoin: "stone", foot: "cobbled", bands: { 4: "bricks" }, battlements: true, gate: "castle_gate", gateArmor: 1, port: true, gateH: 4, cost: cost(["stone blocks", 384, "smooth"], ["stone blocks", 128, "bricks"], ["iron ingots", 24, "iron"]) },
  { name: "Watch Wall", h: 7, thick: 2, body: "smooth", quoin: "stone", foot: "cobbled", bands: { 5: "bricks" }, battlements: true, towers: 4, r: 2, up: 3, gate: "castle_gate", gateArmor: 1, port: true, gateH: 4, cost: cost(["stone blocks", 384, "smooth"], ["stone blocks", 192, "bricks"], ["iron ingots", 32, "iron"]) },
  { name: "Curtain Wall", h: 9, thick: 3, body: "smooth", quoin: "stone", foot: "cobbled", footH: 2, bands: { 4: "bricks", 7: "bricks" }, battlements: true, towers: 8, r: 3, up: 4, gatehouse: true, gate: "castle_gate", gateArmor: 1, port: true, gateH: 5, cost: cost(["stone blocks", 512, "smooth"], ["stone blocks", 256, "bricks"], ["iron ingots", 64, "iron"]) },
  { name: "Great Curtain Wall", h: 11, thick: 3, body: "smooth", quoin: "stone", foot: "cobbled", footH: 2, bands: { 4: "bricks", 8: "bricks" }, battlements: true, towers: 8, r: 3, up: 5, gatehouse: true, gate: "castle_gate", gateArmor: 2, port: true, gateH: 5, cost: cost(["stone blocks", 512, "smooth"], ["stone blocks", 256, "bricks"], ["diamonds", 24, "diamond"]) },
  { name: "Crown Wall", h: 13, thick: 4, body: "smooth", quoin: "stone", foot: "cobbled", footH: 3, bands: { 5: "bricks", 9: "tiles", 10: "bricks" }, battlements: true, towers: 12, r: 3, up: 6, gatehouse: true, gate: "castle_gate", gateArmor: 3, port: true, gateH: 5, cost: cost(["stone blocks", 640, "smooth"], ["stone blocks", 192, "tiles"], ["stone blocks", 256, "bricks"], ["netherite scrap", 8, "netherite"]) },
];
export const MAX_WALL = WALL_LEVELS.length - 1;

// ---------- watchtowers (Mateo, 2026-11-13: "small watchtowers for the guards at the wall in the first wall level") ----------
// The levels before the Watch Wall have no towers of their own, so four small timber watchtowers (the building skill's
// design, settle/wallwatch_data.js from map/structures/review/specs/gen_wallwatch.py) stand astride the wall line,
// exactly where the Watch Wall's four stone towers will stand: at the Watch Wall they come down and the stone towers
// rise in their place. The wall leaves their 5 x 5 shaft open and butts against it; a guard keeps each lookout
// (guardposts/posts.js, posts "watch:<k>").
//   from/to = the wall levels that have them. half = half the shaft's width. back = blocks from the door's front step
//   (the design's origin) to the middle of the shaft. clear = blocks kept free in front of the door for the way in.
//   guardUp / guardOut = where the lookout's guard stands: feet this far above the ground under the tower, this far out
//   from the middle of the shaft (the design's "guard" mark; the self-test checks the two agree).
export const WATCH = { from: 1, to: 6, count: 4, half: 2, back: 3, clear: 2, guardUp: 11, guardOut: 1 };
export const hasWatch = (level) => level >= WATCH.from && level <= WATCH.to && !WALL_LEVELS[level]?.towers;

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
// Log walls (Palisade, Braced Palisade) are always the stripped log of the chosen timber (Mateo, 2026-11-11:
// "make all walls made of logs stripped"). Shared by the game (walls.js), the Mason and the 3D viewer.
export const WALL_LOG = {
  vale: "minecraft:stripped_spruce_log", frostmarch: "minecraft:stripped_dark_oak_log", saltreach: "minecraft:stripped_birch_log",
  emberwaste: "minecraft:stripped_acacia_log", blackfen: "minecraft:stripped_mangrove_log",
};

export const VARIATION = { weather: 0.22, slitEvery: 9, lightEvery: 14, postEvery: 8, towerBump: 2 };

// A repeatable number 0..1 for a block position
export function hash3(x, y, z, seed = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1274126177) ^ Math.imul(seed | 0, 1103515245);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export const wallSeed = (center) => (Math.imul(center.x | 0, 73856093) ^ Math.imul(center.z | 0, 19349663)) >>> 0;

// Rough walls weather in patches a few blocks across; dressed (smooth) stone and bands of brick and tile stay
// crisp, because patches of the darker Castle Stone on smooth walls read as camouflage, not age.
const WEATHERED = { cobbled: "stone" };
function weather(kind, x, y, z, seed) {
  if (!WEATHERED[kind]) return kind;
  const patch = hash3(Math.floor(x / 3), Math.floor(y / 2), Math.floor(z / 3), seed) < VARIATION.weather;
  return patch && hash3(x, y, z, seed + 1) < 0.7 ? WEATHERED[kind] : kind;
}
const every = (along, n, at) => ((Math.round(along) % n) + n) % n === at;

// Regions whose towers wear a pitched roof in their own roofing (like their town halls) instead of battlements
export const TOWER_ROOF = { vale: true, frostmarch: true, blackfen: true };

// Everything that stands above the ground in one column of wall: [[y, kind], ...] where kind is a
// material ("log", "fence", "plank", a Castle Stone kind) or "tooth", "light", "slit", "gate", "port",
// or on a roofed tower "roofb" (roof block) and "roof:<e|w|n|s>" (a roof stair rising that way).
// style = the region's style id; it only decides the towers' roofs.
export function columnKinds(L, col, seed = 0, style) {
  const { x, z, base } = col, out = [];
  let top = col.top;
  if (col.role === "stair") { // a step of a flight up the inside of the wall, on a solid footing
    const wood = L.body === "log" || L.body === "fence";
    for (let y = base + 1; y < top; y++) out.push([y, wood ? "plank" : "stone"]);
    if (top > base) out.push([top, `${wood ? "wstair" : "sstair"}:${col.dir}`]);
    return out;
  }
  if (col.role === "landing") { // the solid top of a flight, out to the walk
    const wood = L.body === "log" || L.body === "fence";
    for (let y = base + 1; y <= top; y++) out.push([y, wood ? "plank" : "stone"]);
    return out;
  }
  if (col.role === "ladder") { // up the inner face of a tower, from the ground to the top
    for (let y = base + 1; y <= top; y++) out.push([y, `ladder:${col.dir}`]);
    return out;
  }
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
    if (tower && col.corner && L.quoin && !L.bands?.[rel] && rel > (L.footH ?? (L.foot ? 1 : 0))) kind = L.quoin;
    // arrow slits: along the upper wall, and on each face of a tower
    if (!wood && col.d === 0 && L.h >= 5 && ((!tower && rel === L.h - 1 && every(along, VARIATION.slitEvery, 4)) || (tower && col.face && (rel === L.h + 1 || rel === 3)))) kind = "slit";
    out.push([y, kind]);
  }
  if (walk) return out;
  if (tower && TOWER_ROOF[style] && col.dx !== undefined) {
    // a pyramid roof: each ring in from the edge one block higher, stairs rising toward the middle
    const k = L.r - Math.max(Math.abs(col.dx), Math.abs(col.dz));
    for (let j = 1; j <= k; j++) out.push([top + j, "roofb"]);
    if (k === L.r) { out.push([top + k + 1, "roofb"]); out.push([top + k + 2, "light"]); return out; }
    const dir = Math.abs(col.dx) >= Math.abs(col.dz) ? (col.dx > 0 ? "w" : "e") : (col.dz > 0 ? "n" : "s");
    out.push([top + k + 1, `roof:${dir}`]);
    return out;
  }
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
  // A starter village wall (map/structures/starter.py) carries its whole outline: radii = blocks out at even angles,
  // worked out from the land and what the wall holds, for a ring of radiiAt. A bigger ring keeps the same outline, moved out.
  const radii = center?.radii;
  if (radii?.length) {
    const f = (turn(a) / TAU) * radii.length;
    const i = Math.floor(f) % radii.length, t = f - Math.floor(f);
    const r = radii[i] * (1 - t) + radii[(i + 1) % radii.length] * t + (radius - (center.radiiAt ?? radius));
    return Math.min(r, WALLS.radius + WALLS.landBeyond - 2);
  }
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

// Where the watchtowers stand round a wall line: [{ k, a, x, z, ground, forward, origin }]
//   x, z = the middle of the shaft (on the line the Watch Wall's towers use: one block in from the outer face).
//   forward = the way into the tower from its door (a wind, pointing out of the settlement: the door faces in).
//   origin = the door's front step at feet height, the design's (0, 1, 0) for the build engine (townhall/build.js).
export function watchSpots(center, radius, gateAngle, smooth) {
  return Array.from({ length: WATCH.count }, (_, k) => {
    const a = gateAngle + ((k + 0.5) / WATCH.count) * TAU;
    const r = radiusAt(center, radius, a);
    const x = Math.round(center.x + Math.cos(a) * (r - 1)), z = Math.round(center.z + Math.sin(a) * (r - 1));
    // the door faces in along the nearer of the two axes, unless the wall line runs across its way in there (a wavy
    // starter-village line at a tower set on the diagonal: the 2026-11-14 town audit found Dunehold's and Oakmere's
    // doors opening onto a palisade stake), then along the other one
    const ax = { x: Math.sign(Math.cos(a)), z: 0 }, az = { x: 0, z: Math.sign(Math.sin(a)) };
    const both = (Math.abs(Math.cos(a)) >= Math.abs(Math.sin(a)) ? [ax, az] : [az, ax]).filter((f) => f.x || f.z);
    const crossed = (f) => {
      let n = 0;
      for (let step = 0; step < WATCH.clear; step++) for (let side = -1; side <= 1; side++) {
        const cx = x - f.x * (WATCH.back + step) + side * f.z, cz = z - f.z * (WATCH.back + step) + side * f.x;
        const dx = cx - center.x, dz = cz - center.z;
        if (Math.hypot(dx, dz) > radiusAt(center, radius, Math.atan2(dz, dx)) - 2.5) n++;
      }
      return n;
    };
    const forward = both.reduce((best, f) => (crossed(f) < crossed(best) ? f : best));
    const ground = groundAt(smooth, a);
    return { k, a, x, z, ground, forward, origin: { x: x - forward.x * WATCH.back, y: ground + 1, z: z - forward.z * WATCH.back } };
  });
}
// Is a column inside a watchtower's shaft (pad = blocks round it too)?
export const inWatch = (spots, x, z, pad = 0) => spots.some((s) => Math.abs(x - s.x) <= WATCH.half + pad && Math.abs(z - s.z) <= WATCH.half + pad);
// Is a column on the way in to a watchtower's door (the step and the blocks in front of it, a block either side)?
export const onWatchPath = (spots, x, z) => spots.some((s) => {
  const along = (x - s.origin.x) * -s.forward.x + (z - s.origin.z) * -s.forward.z; // out from the door
  const side = (x - s.origin.x) * s.forward.z - (z - s.origin.z) * s.forward.x;
  return along >= 0 && along < WATCH.clear && Math.abs(side) <= 1;
});

// Every column of a wall: [{ x, z, base, top, role, d, a }] in the order it is built (round from the gate).
//   role: "wall" | "walk" (plank walkway behind a thin wall) | "tower" | "gate" and "port" (the gate and portcullis blocks) | "gap" (kept open)
//   d: 0 = outer face ... thick-1 = inner face (walls only). base/top: the y range of solid wall; the walk is at top.
export function wallColumns({ center, radius = WALLS.radius, level, gateAngle, smooth }) {
  const L = WALL_LEVELS[level];
  const cols = new Map();
  const watch = hasWatch(level) ? watchSpots(center, radius, gateAngle, smooth) : [];
  const put = (x, z, col) => {
    if (watch.length && inWatch(watch, x, z)) return; // a watchtower's shaft: the wall butts against it
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
      put(cx + dx, cz + dz, { role: "tower", base: g, top: g + L.h + L.up + bump, d: edge ? 0 : 1, a, mid: dx === 0 && dz === 0, tooth: edge && (dx + dz) % 2 === 0, face: edge && (dx === 0 || dz === 0), corner: Math.abs(dx) === L.r && Math.abs(dz) === L.r, dx, dz });
    }
  }
  // a ladder up the inner face of every tower, from the ground to its top
  for (const [a, bump] of towers) {
    const r = radiusAt(center, radius, a);
    const inward = { x: -Math.cos(a), z: -Math.sin(a) };
    const step = Math.abs(inward.x) >= Math.abs(inward.z) ? { x: Math.sign(inward.x), z: 0 } : { x: 0, z: Math.sign(inward.z) };
    const cx = Math.round(center.x + Math.cos(a) * (r - 1)), cz = Math.round(center.z + Math.sin(a) * (r - 1));
    const x = cx + step.x * (L.r + 1), z = cz + step.z * (L.r + 1);
    const g = groundAt(smooth, a);
    if (!cols.has(key(x, z))) cols.set(key(x, z), { x, z, role: "ladder", base: g, top: g + L.h + L.up + bump, d: 9, a, dir: CARD(step.x, step.z) });
  }
  // the top step must sit beside the walk: the flight hugs the wall, never through it, a tower or a ladder
  const flights = stairColumns({ center, radius, L, gateAngle, smooth, taken: (x, z) => cols.has(key(x, z)) || (watch.length > 0 && (inWatch(watch, x, z, 1) || onWatchPath(watch, x, z))) });
  for (const c of flights) cols.set(key(c.x, c.z), { ...c, d: 9 });
  // where a flight's top step doesn't quite touch the walk, a short solid landing carries on out to it
  const standOn = (x, z) => { const n = cols.get(key(x, z)); return n && (n.role === "walk" || (n.role === "wall" && !L.walk)); };
  const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const t of flights.filter((c) => c.last)) {
    let p = { x: t.x, z: t.z };
    for (let n = 0; n < 6 && !SIDES.some(([dx, dz]) => standOn(p.x + dx, p.z + dz)); n++) {
      const out = { x: p.x - center.x, z: p.z - center.z };
      const tries = Math.abs(out.x) >= Math.abs(out.z) ? [[Math.sign(out.x), 0], [0, Math.sign(out.z) || 1]] : [[0, Math.sign(out.z)], [Math.sign(out.x) || 1, 0]];
      const go = tries.find(([dx, dz]) => !cols.has(key(p.x + dx, p.z + dz)) || standOn(p.x + dx, p.z + dz));
      if (!go || standOn(p.x + go[0], p.z + go[1])) break;
      p = { x: p.x + go[0], z: p.z + go[1] };
      cols.set(key(p.x, p.z), { x: p.x, z: p.z, role: "landing", base: groundAt(smooth, t.a), top: t.top, d: 9, a: t.a });
    }
  }
  const order = (c) => turn(c.a - gateAngle);
  return [...cols.values()].sort((p, q) => order(p) - order(q) || p.d - q.d);
}

// How high the place a guard (or a player) stands on the wall is above the ground: the walk, or the top of a thick
// stone wall. 0 = nothing to stand on (the Low Palisade), so no steps.
export function standHeight(L) {
  if (!L) return 0;
  if (L.walk) return L.walk;
  if (L.body === "log" || L.body === "fence") return 0;
  return L.h;
}

const CARD = (dx, dz) => (Math.abs(dx) >= Math.abs(dz) ? (dx > 0 ? "e" : "w") : (dz > 0 ? "s" : "n"));

// Flights of steps up the inside of the wall (Mateo, 2026-11-12: guards and players need a way up). Each flight hugs
// the inner face, one block in from the innermost wall or walk column, and follows the curve of the ring, rising a
// block per step until it is level with the walk. Steps always touch side by side (never only at a corner).
// Returns columns like wallColumns: { x, z, base, top, role: "stair", dir, a } where dir is the way the step rises.
export function stairColumns({ center, radius, L, gateAngle, smooth, taken = () => false }) {
  const H = standHeight(L);
  if (!H) return [];
  const deep = L.thick + (L.walk ? 1 : 0);
  const out = [];
  const used = new Set();
  const flights = [];
  const fromGate = WALLS.stairFromGate / radius;
  flights.push([gateAngle + fromGate, 1], [gateAngle - fromGate, -1]);
  for (let k = 1; k <= WALLS.stairs - 2; k++) flights.push([gateAngle + (k / (WALLS.stairs - 1)) * TAU, k % 2 ? 1 : -1]);
  // the path of one flight from angle a0, `inset` blocks in from the innermost wall column
  const trace = (a0, way, inset) => {
    const cells = [];
    const want = (a) => radiusAt(center, radius, a) - deep - inset;
    const cellAt = (a) => ({ x: Math.round(center.x + Math.cos(a) * want(a)), z: Math.round(center.z + Math.sin(a) * want(a)), a });
    let a = a0, last;
    for (let guard = 0; cells.length < H + 1 && guard < 400; guard++) {
      const c = cellAt(a);
      a += (way * 0.4) / Math.max(10, radius - deep);
      if (last && c.x === last.x && c.z === last.z) continue;
      if (last && c.x !== last.x && c.z !== last.z) {
        // a corner: put in the cell between that lies nearer the line, so the steps touch side by side
        const opts = [{ x: c.x, z: last.z }, { x: last.x, z: c.z }];
        const off = (p) => Math.abs(Math.hypot(p.x - center.x, p.z - center.z) - want(c.a));
        cells.push({ ...(off(opts[0]) <= off(opts[1]) ? opts[0] : opts[1]), a: c.a });
        if (cells.length >= H + 1) break;
      }
      cells.push(c);
      last = c;
    }
    return cells;
  };
  for (const [a, way] of flights) {
    // slide the flight along the wall (and a little further in) until no step lands on the wall or a tower
    let cells;
    for (const inset of [0, 1, 2]) {
      for (const slide of [0, 3, -3, 6, -6, 9, -9, 12, -12, 16, -16]) {
        const c = trace(a + (way * slide) / radius, way, inset);
        if (c.length >= H + 1 && c.every((p) => !taken(p.x, p.z) && !used.has(`${p.x},${p.z}`))) { cells = c; break; }
      }
      if (cells) break;
    }
    if (!cells) continue;
    const g0 = groundAt(smooth, cells[0].a);
    for (let i = 0; i < H; i++) {
      const c = cells[i], next = cells[i + 1];
      used.add(`${c.x},${c.z}`);
      out.push({ x: c.x, z: c.z, base: groundAt(smooth, c.a), top: g0 + i + 1, role: "stair", dir: CARD(next.x - c.x, next.z - c.z), a: c.a, ...(i === H - 1 ? { last: true } : {}) });
    }
  }
  return out;
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
