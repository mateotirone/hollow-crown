// The Hollow's terrain generator. Custom dimensions on Bedrock are void only, so we generate the
// land ourselves the way Minecraft does: from one fixed seed, one 16x16 chunk at a time, as players
// explore. The land is identical for every player and every rebuild.
//
// Shape of the world (about 1,400 x 2,500 blocks):
//   the Spine     the walled valley down the middle (|x| <= 150) that the story path follows
//   open country  everything else out to x = +-700: four kinds of land (REGIONS) that blend into
//                 each other, picked by slow noise, so nothing lines up or mirrors
//   light rivers  one boatable network at a single water level (rivers.js), carved into the land
//
// planChunk(cx, cz) is pure (no Minecraft calls): it returns a list of fill operations. The
// builder in index.js applies them a few at a time so the server never stalls.
// Look of the land follows Mateo's concept art: basalt plateaus and spires, giant hollow lattice
// trees, glowing pink and blue fungi, rivers of pale blue light, all under a low cave roof (ROOF).

import { UNDERTOW_LAYOUT as L, COURT, HEART, pathX, stageAt } from "./layout.js";
import { hash, fbm, smooth } from "./noise.js";
import { riverDistance, RIVER_HALF_WIDTH } from "./rivers.js";
import { SITES, ROADS, siteAt, roadAt, roadLines, SITE_SKIRT, ROAD_HALF_WIDTH, ROAD_SHOULDER } from "./roads.js";
import { SITE_DESIGNS, TOWER_DESIGNS } from "./sites_data.js";
import { HOLLOW_TREES } from "./trees_data.js";
import { HOLLOW_BRIDGES } from "./bridges_data.js";

export { hash, fbm } from "./noise.js";

export const B = {
  floor: "minecraft:blackstone",
  rock: "siege:veinstone",
  moss: "siege:undertow_moss",
  basalt: "minecraft:basalt",
  polished: "minecraft:polished_basalt",
  tuff: "minecraft:tuff",
  ceiling: "siege:veil_rock",
  mossDeep: "siege:undertow_moss_deep",
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
  road: "minecraft:coarse_dirt",
  cobble: "minecraft:cobbled_deepslate",
  post: "minecraft:cobbled_deepslate_wall",
  lantern: "minecraft:soul_lantern",
  deck: "siege:veinstone_bricks",
  deckCracked: "siege:cracked_veinstone_bricks",
  ash: "siege:pale_ash",
  glint: "siege:glint_cluster",
  budding: "minecraft:budding_amethyst",
  cap: "siege:veilcap_cap",
  stem: "siege:veilcap_stem",
  strands: "siege:veilmoss_strands",
  parapet: "minecraft:polished_blackstone_brick_wall",
};


const SEA = L.seaY;
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const inCourt = (x, z) => z >= 1540 && z < 1660;
// Where the land breaks off before the Seat (Mateo, 2026-11-12: not a straight, flat line). The Long Climb ends in
// a ragged, crumbling cliff: bays bitten up to 34 blocks back from z 2330, blunt spurs between them, single-block
// jags, and the story path running out to the edge on its own spur. The Seat's approach (hollow_arenas.py) starts there.
export const HEART_EDGE_Z = 2330;
export function heartEdge(x) {
  const ax = Math.abs(x);
  if (ax <= 5) return HEART_EDGE_Z; // the path's spur
  const jag = Math.floor(hash(Math.floor(x / 3), 0, 98) * 4) + (hash(x, 0, 99) < 0.3 ? 2 : 0);
  const bite = Math.min(34, 2 + fbm(x / 44, 4.2, 97) * 38 + fbm(x / 9, 8.6, 96) * 13 + jag);
  const reach = x < 0 ? 6 : 11; // the spur widens back into the cliff, more on one side than the other
  const spur = Math.max(0, 1 - (ax - 5) / reach);
  return HEART_EDGE_Z - Math.max(ax <= 7 ? 1 : 2, Math.round(bite * (1 - spur * spur * spur)));
}
const inHeart = (x, z) => z >= heartEdge(x);
const inSpine = (x) => Math.abs(x) <= L.halfWidth;
// No spires or pillars crowding the Drowned Court or the Seat's landing: they are meant to be seen from far off.
const arenaView = (x, z) => Math.hypot(x - COURT.center.x, z - COURT.center.z) < 70 || Math.hypot(x - HEART.center.x, z - HEART.center.z) < 110;
const nearPath = (x, z, d) => inSpine(x) && Math.abs(x - pathX(z)) <= d;

// ---- open country ----------------------------------------------------------------------
// Four kinds of land. Two slow noise fields pick between them, like temperature and humidity
// pick biomes in a normal world. (Bedrock allows the dimension only one real biome.)
export const REGIONS = {
  wood: "lattice groves on rolling ground",
  high: "basalt highlands: terraces, cliffs and spires",
  fen: "low glowing fens and pools",
  waste: "bare grey flats and dunes",
};
const CENTRES = [["high", 0.5, 0.45], ["wood", 0.35, -0.5], ["fen", -0.55, 0.4], ["waste", -0.45, -0.55]];
function regionWeights(x, z) {
  const t = (fbm(x / 330, z / 330, 91) - 0.5) * 4.2, m = (fbm(x / 290, z / 290, 92) - 0.5) * 4.2;
  const w = {};
  let sum = 0, best, bestW = -1;
  for (const [id, ct, cm] of CENTRES) {
    const d2 = (t - ct) * (t - ct) + (m - cm) * (m - cm);
    const v = 1 / (d2 * d2 + 0.02);
    w[id] = v; sum += v;
    if (v > bestW) { bestW = v; best = id; }
  }
  for (const id in w) w[id] /= sum;
  w.top = best;
  return w;
}

// How far inside the open country's ragged outer edge a column is (negative = void).
function margin(x, z) {
  const side = L.reach - Math.abs(x) - fbm(x / 40, z / 40, 71) * 60;
  const south = z - (-24 + fbm(x / 30, 0.5, 72) * 20);
  const north = 2290 + fbm(x / 30, 1.5, 73) * 40 - z;
  return Math.min(side, south, north);
}
function wild(x, z) {
  const mg = margin(x, z);
  if (mg < 0) return null;
  const w = regionWeights(x, z);
  const cont = fbm(x / 260, z / 260, 81);
  const terr = (v, step) => Math.floor(v / step) * step;
  let h = w.fen * (50 + cont * 10 + fbm(x / 50, z / 50, 82) * 12)
    + w.wood * (62 + cont * 24 + fbm(x / 45, z / 45, 83) * 12)
    + w.high * terr(80 + cont * 44 + fbm(x / 60, z / 60, 84) * 30, 5)
    + w.waste * (64 + cont * 14 + Math.sin(x / 11 + fbm(x / 30, z / 30, 9) * 4) * 2);
  if (mg < 12) h = Math.max(h, SEA + 2); // a lip at the world's edge so no water pours into the void
  return { h, region: w.top };
}

// ---- the Spine -------------------------------------------------------------------------
const BLENDS = [[500, "mirror"], [1000, "bells"], [1540, "court"]];
function stageHeight(stage, x, z, n) {
  if (stage === "court") return COURT.floorY - 2;
  if (stage === "wound") return 60 + n * 20;
  if (stage === "shallows") return 52 + n * 22; // low: most of it lies under the water
  if (stage === "mirror") return 70 + n * 30; // high basalt terraces
  if (stage === "bells") return 68 + n * 16 + Math.sin(x / 11) * 2 * fbm(x / 30, z / 30, 9); // dunes
  const t = Math.min(1, Math.max(0, (z - 1660) / 640)); // the Long Climb rises toward the Heart
  return 86 + t * 30 + n * 12;
}
// The Spine's rim: a wall of cliffs with natural gaps (passes) out into the open country.
// No gaps beside the Wound, the Court, or where there is only void outside.
// Where the rim stands: it wanders in and out so the Spine is not a straight-sided box.
function rimAt(x, z) {
  const wander = fbm(z / 110, x < 0 ? 7.7 : 3.1, 62) * 46 * smooth(clamp01((z - 30) / 60));
  return L.halfWidth - wander;
}
function rimWall(x, z) {
  const side = x < 0 ? -1 : 1;
  if (z < 60 || (z > 1500 && z < 1700) || margin(side * (L.halfWidth + 45), z) < 0) return 1;
  return smooth(clamp01((fbm(z / 70, side * 3.3, 61) - 0.4) / 0.14));
}
function spine(x, z, first = false) {
  if (z < L.zStart || z >= L.zEnd || inHeart(x, z)) return null; // the final arena floats in the fog; built separately

  // The Wound: a ledge at y 100 with a wall behind it and a ramp down along the path.
  if (z < 40) {
    if (z < -10 && first) return Math.abs(x) <= 24 ? 126 - Math.floor(fbm(x / 9, z / 9, 5) * 6) : null; // the first back wall: a slab, the void either side
    if (Math.abs(x) <= 14 && z <= 10) return L.woundLedgeY;
    if (Math.abs(x) <= 3 && z > 10) {
      const foot = spine(pathX(40), 40); // ramp lands exactly on the valley floor
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
  const d = Math.abs(x - pathX(z));
  // The path is a causeway just above the water through the Shallows.
  if (z >= 36 && z < 56) h = Math.max(h, SEA + 2);
  if (stage === "shallows" && d <= 2) h = Math.max(h, SEA + 1);

  // Terraces and cliffs away from the path; the path itself stays walkable.
  const step = stage === "mirror" ? 5 : 3;
  const terraced = Math.floor(h / step) * step;
  if (d > 7) h = terraced;
  else if (d > 4) h = Math.round(h + (terraced - h) * ((d - 4) / 3));
  else h = Math.round(h);

  const edge = rimAt(x, z) - Math.abs(x);
  if (edge < 22) h += Math.round(((22 - edge) * 1.8 + fbm(x / 7, z / 7, 3) * 6) * rimWall(x, z));
  return Math.max(L.floorY + 4, Math.min(L.ceilingY - 30, h));
}

// The cliff at the Hollow's near end, behind the Wound (Mateo 2026-11-12, of a screenshot of the first one: "This
// definitely needs a lot of work"). It was a flat slab 49 wide with the void on both sides and above it, so the sky
// showed round it. Now it is a cliff right across the valley and out past both rims: its foot wanders, its top
// steps back in broken ledges, it is laid in beds of mixed rock (backRock), and its last rows are built up into
// the roof so nothing shows behind it. The Wound's cave is cut into it (wound.js).
export const BACK = { z: -10, reach: L.halfWidth + 45, seal: -44 };
export const backFace = (x) => { const ax = Math.abs(x); return ax <= 26 ? BACK.z : BACK.z - Math.round(fbm(x / 21, 0.5, 171) * 9 * smooth(clamp01((ax - 26) / 12))); };
function backWall(x, z) {
  if (z >= BACK.z || z < L.zStart || Math.abs(x) > BACK.reach) return null;
  const d = backFace(x) - z; // blocks in behind the face
  if (d <= 0) return null; // in front of it: the valley's own ground
  let h = 136 + fbm(x / 23, z / 23, 5) * 26 + Math.min(d, 30) * 0.7 - 14 * Math.max(0, 1 - d / 5) * fbm(x / 9, 3.3, 172);
  h = Math.max(h, natural(x, z, true)?.h ?? 0); // never lower than the land that stood here first, so an old world only gains rock
  return Math.round(Math.min(L.ceilingY - 30, h));
}
const BACK_ROCK = ["minecraft:blackstone", "minecraft:deepslate", "siege:veinstone", "minecraft:deepslate", "minecraft:basalt", "minecraft:tuff", "minecraft:cobbled_deepslate", "minecraft:blackstone"];
// The rock of the back cliff at a cell: beds three blocks thick that rise and dip along the face. Pure.
export function backRock(x, y, z) {
  const r = hash(x + y * 7, z - y * 3, 175);
  if (r < 0.012) return "minecraft:crying_obsidian";
  if (r < 0.07) return "siege:veinstone";
  return BACK_ROCK[Math.floor((y + fbm(x / 17, z / 17, 173) * 12) / 3 + 400 + hash(Math.floor(x / 4), Math.floor(z / 4), 174) * 1.4) % BACK_ROCK.length];
}
// The land the roof is hung over. Behind the Wound it is still the first wall, so the roof stays exactly where
// every world already built it.
const roofLand = (x, z) => natural(x, z, true)?.h ?? null;

// The land before the rivers cut into it: { h, region } or null for void. first: as it was before the back cliff.
function natural(x, z, first = false) {
  if (z < L.zStart || z >= L.zEnd) return null;
  const back = first ? null : backWall(x, z);
  if (back !== null) return { h: back, region: "wound" };
  const ax = Math.abs(x);
  const rimX = ax <= L.halfWidth + 45 ? rimAt(x, z) : L.halfWidth;
  if (ax <= rimX) {
    const h = spine(x, z, first);
    return h === null ? null : { h, region: stageAt(z)?.id ?? "wound" };
  }
  const w = wild(x, z);
  if (w === null) return null;
  if (ax < rimX + 40) { // the outer foot of the rim eases into the open country
    const rim = spine(x < 0 ? -rimX : rimX, z, first);
    if (rim !== null) w.h = rim + (w.h - rim) * smooth((ax - rimX) / 40);
  }
  w.h = Math.max(L.floorY + 4, Math.min(L.ceilingY - 30, w.h));
  return w;
}

// How low a river lets the land stand at this distance from its middle: bed, bank, then a valley side.
function riverLimit(d) {
  if (d <= RIVER_HALF_WIDTH) return SEA - 2;
  if (d <= RIVER_HALF_WIDTH + 2) return SEA + 1;
  if (d < 40) return SEA + 1 + (d - RIVER_HALF_WIDTH - 2) * 0.8;
  return SEA + 1 + (40 - RIVER_HALF_WIDTH - 2) * 0.8 + (d - 40) * 2;
}

// A column before any road is laid: rivers carved, village sites flattened.
function beforeRoads(x, z) {
  const n = natural(x, z);
  if (n === null) return null;
  const river = (inSpine(x) && (z < 60 || inCourt(x, z))) ? Infinity : riverDistance(x, z);
  let h = Math.round(n.h), under;
  if (river !== Infinity) {
    const lim = Math.round(riverLimit(river));
    if (lim < h) {
      if (!nearPath(x, z, 3)) h = lim;
      else if (h - lim >= 4) under = lim; // the path carries on across as a bridge
    }
  }
  const c = { h, region: n.region, river, under };
  const st = siteAt(x, z);
  if (st && river > RIVER_HALF_WIDTH + 2) {
    if (st.d <= st.site.r + 2) c.site = st.site.id;
    if (st.site.y !== undefined) c.h = Math.round(st.site.y + (h - st.site.y) * smooth(clamp01((st.d - st.site.r) / SITE_SKIRT)));
  }
  return c;
}
const groundBeforeRoads = (x, z) => beforeRoads(x, z)?.h ?? null;

// One column of the finished land:
//   h       ground height            region  kind of land (a Spine stage or one of REGIONS)
//   river   distance to a light river's middle (Infinity when far)
//   under   set where the story path bridges a river: the river bed's height beneath the deck
//   site    id of the village site this column is inside
//   road    distance to the middle of a road or the story path, when on or beside one; paved = on it
//   roadS   blocks along that road (for spacing lantern posts)
export function columnAt(x, z) {
  const c = beforeRoads(x, z);
  if (c === null) return null;
  if (inSpine(x) && z > 10 && z < HEART_EDGE_Z && !inCourt(x, z)) {
    const d = Math.abs(x - pathX(z));
    if (d <= 4) { c.road = d; c.roadS = z; c.paved = d <= ROAD_HALF_WIDTH; return c; }
  }
  if (c.site || c.under !== undefined) return c;
  const r = roadAt(x, z, groundBeforeRoads, SEA + 1);
  if (r) {
    c.road = r.d; c.roadS = r.s; c.lamps = r.lamps;
    if (r.d <= r.half + 0.5) {
      // High over the land (a river valley): a bridge deck, the ground staying as it is beneath.
      if (r.y - c.h >= 3) c.under = c.h;
      else if (c.river <= RIVER_HALF_WIDTH + 2) { c.road = undefined; return c; } // never fill a river in
      c.h = r.y; c.paved = r.d <= r.half;
    } else if (r.y - c.h < 3 && c.river > RIVER_HALF_WIDTH + 2) {
      c.h = Math.round(r.y + (c.h - r.y) * smooth((r.d - r.half - 0.5) / (ROAD_SHOULDER - r.half - 0.5)));
    }
  }
  return c;
}

// Ground height at a column, or null for void.
export function heightAt(x, z) {
  const c = columnAt(x, z);
  return c === null ? null : c.h;
}
export function regionAt(x, z) {
  return columnAt(x, z)?.region;
}

export const oreChance = (z) => (z < 60 ? 0 : 0.015 + 0.05 * Math.min(1, z / 2300));

// True on the water of a light river.
export function isRiver(x, z) {
  const c = columnAt(x, z);
  return c !== null && c.river <= RIVER_HALF_WIDTH && c.under === undefined;
}

// How likely a blue crystal cluster is: sparse in the highlands, denser the nearer the Seat.
const glintChance = (kind, z) => (kind === "high" ? 0.012 : 0) + (z > 1900 ? 0.03 * Math.min(1, (z - 1900) / 400) : 0);

// Shard beds (Mateo, 2026-11-10: "add amethyst shards into the dimension as a naturally occurring
// plant"). Vanilla amethyst growing out of the ground in patches: a budding amethyst block set into
// the rock with a growth on top, at mixed stages. Because the root is real budding amethyst, a
// harvested growth grows back by itself, and a full cluster drops vanilla amethyst shards.
export const SHARD_STAGES = ["minecraft:small_amethyst_bud", "minecraft:medium_amethyst_bud", "minecraft:large_amethyst_bud", "minecraft:amethyst_cluster"];
const SHARD_BED = { wood: 0.1, fen: 0.05, high: 0.16, waste: 0.08 }; // share of 8x8 patches that are beds
// The growth stage (0 to 3) standing on this column, or -1 for none. Pure.
export function shardAt(x, z, kind) {
  const px = Math.floor(x / 8), pz = Math.floor(z / 8);
  if (hash(px, pz, 311) >= (SHARD_BED[kind] ?? 0.08)) return -1;
  if (hash(x, z, 312) >= 0.22) return -1;
  return Math.min(3, Math.floor(hash(x, z, 313) * 4.6)); // a little more often full grown
}

// Giant Veilcaps (Mateo, 2026-11-10, from his picture of the Hollow): the pink mushrooms grown to
// the size of trees, glowing caps on pale stems. Commonest in the fens, common in the groves.
const GIANT_CAP = { wood: 0.0016, fen: 0.004, high: 0.0003, waste: 0.0002 };
// The shape of the giant Veilcap rooted on this column, or undefined. Pure.
export function giantCapAt(x, z, kind) {
  if (hash(x, z, 321) >= (GIANT_CAP[kind] ?? 0.001)) return undefined;
  return { tall: 4 + Math.floor(hash(x, z, 322) * 6), wide: hash(x, z, 323) < 0.4 ? 3 : 2 };
}
// Veilmoss hanging over a ledge: how many blocks of strands hang down this side, 0 for none. Pure.
export function strandsAt(x, z, side, drop, kind) {
  if (kind === "waste" || drop < 3) return 0;
  if (hash(x, z, 331 + side) >= (kind === "high" ? 0.15 : 0.4)) return 0;
  return 1 + Math.floor(hash(x, z, 341 + side) * Math.min(3, drop - 1));
}

const landmarkNearRoad = (cx, cz, col) => {
  for (let i = 0; i < 16; i += 3) for (let j = 0; j < 16; j += 3) if (col(i, j)?.road !== undefined && !inSpine(cx * 16 + i)) return true;
  return false;
};

// ---- bridges -----------------------------------------------------------------------------------
// Where a road or the story path crosses a light river, a lake or a valley, a real bridge from the one
// bridge generator (minecraft-builder skill; tools/hollow_bridges.py writes bridges_data.js): black pointed
// arches on piers with cutwaters, veinstone, a humped deck in cobbled deepslate, parapets and soul lanterns,
// at whatever angle the road crosses. Its columns are listed as covered so the old flat deck is left out.
let BRIDGED;
export function bridged(x, z) {
  if (!BRIDGED) {
    BRIDGED = new Set();
    for (const list of Object.values(HOLLOW_BRIDGES.covered)) for (let k = 0; k < list.length; k += 2) BRIDGED.add(list[k] * 4096 + list[k + 1]);
  }
  return BRIDGED.has(x * 4096 + z);
}
function planBridges(ops, cx, cz) {
  const runs = HOLLOW_BRIDGES.chunks[`${cx},${cz}`];
  if (!runs) return;
  for (const [x, z, y0, y1, i] of runs) {
    const [block, states] = HOLLOW_BRIDGES.palette[i];
    ops.push(Object.keys(states).length ? { a: [x, y0, z], b: [x, y1, z], block, states } : { a: [x, y0, z], b: [x, y1, z], block });
  }
}

// ---- the plan for one chunk ------------------------------------------------------------
const PLANTS = { wood: 0.08, fen: 0.1, high: 0.02, waste: 0.012 };
const SPIRES = { wood: 0.002, fen: 0.002, high: 0.012, waste: 0.004 };

export function planChunk(cx, cz) {
  const ops = planLand(cx, cz);
  const X0 = cx * 16, Z0 = cz * 16;
  planBridges(ops, cx, cz);
  // The sealed wall across the whole Hollow behind the Court (its gates open when the Court's boss dies).
  // Added last, so nothing in the chunk overwrites it.
  if (COURT.gateZ >= Z0 && COURT.gateZ <= Z0 + 15 && X0 + 15 >= -L.reach && X0 <= L.reach) {
    ops.push({ a: [Math.max(X0, -L.reach), L.floorY, COURT.gateZ], b: [Math.min(X0 + 15, L.reach), ROOF.top, COURT.gateZ], block: B.seal });
  }
  return ops;
}

function planLand(cx, cz) {
  const ops = [];
  const fill = (x1, y1, z1, x2, y2, z2, block) => {
    if (y2 < y1) return;
    ops.push({ a: [x1, y1, z1], b: [x2, y2, z2], block });
  };
  const set = (x, y, z, block) => ops.push({ a: [x, y, z], b: [x, y, z], block });
  const X0 = cx * 16, Z0 = cz * 16;

  // Columns for the chunk plus a 1-block border (for cliff detection).
  const C = [];
  for (let i = -1; i <= 16; i++) {
    C[i + 1] = [];
    for (let j = -1; j <= 16; j++) C[i + 1][j + 1] = columnAt(X0 + i, Z0 + j);
  }
  const col = (i, j) => C[i + 1][j + 1];
  // A bridge column with the ordinary road (not bridge) right beside it: the bridge's end.
  const bridgeEnd = (i, j) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => { const n = col(i + a, j + b); return n && n.road !== undefined && n.under === undefined; });
  const h = (i, j) => { const c = col(i, j); return c === null ? null : c.under ?? c.h; };

  let minH = Infinity, any = false, full = true;
  for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) {
    const v = h(i, j);
    if (v !== null) { any = true; minH = Math.min(minH, v); } else full = false;
  }

  // The roof: a low cave ceiling over the whole Hollow (also above the Heart, where there is no ground).
  // Added first, so everything under it (spires, pillars, trees) is built into it.
  planRoof(ops, cx, cz, col);
  if (!any) return ops;

  // Solid ground under the whole chunk in two fills where every column has ground.
  let start = L.floorY;
  if (full && minH - 1 > L.floorY) {
    const stoneTop = Math.max(L.floorY, minH - 5);
    fill(X0, L.floorY, Z0, X0 + 15, stoneTop, Z0 + 15, B.floor);
    fill(X0, stoneTop + 1, Z0, X0 + 15, minH - 1, Z0 + 15, B.rock);
    start = minH;
  }

  for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) {
    const c = col(i, j);
    if (c === null) continue;
    const x = X0 + i, z = Z0 + j, top = c.under ?? c.h;
    const spineCol = inSpine(x), kind = c.region;
    const onWater = c.river <= RIVER_HALF_WIDTH;
    let drop = 0;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = h(i + di, j + dj);
      drop = Math.max(drop, n === null ? 99 : top - n);
    }
    const wound = spineCol && z < 40;
    // A faint glow over the land (invisible light blocks), so under the roof it is dark but never
    // pitch black. Pushed first in the column so anything built here later takes its place.
    if (top + 2 > SEA && ambientLightAt(x, z)) ops.push({ a: [x, top + 2, z], b: [x, top + 2, z], block: AMBIENT.block, optional: true, ifAir: true });
    const backCol = kind === "wound" && z < BACK.z && Math.abs(x) <= BACK.reach && top > L.woundLedgeY;
    if (backCol) {
      // the back cliff: beds of mixed rock wherever the face shows, plain rock inside
      const from = drop >= 3 ? Math.max(start, top - Math.min(drop, 110) - 2) : top - 1;
      fill(x, start, z, x, from - 1, z, B.rock);
      const upTo = z <= BACK.seal ? ROOF.shell - 1 : top; // the last rows are built up into the roof: nothing shows behind the cliff
      for (let y = from, y0 = from, b0 = backRock(x, from, z); y <= upTo + 1; y++) {
        const b = y <= upTo ? backRock(x, y, z) : null;
        if (b !== b0) { fill(x, y0, z, x, y - 1, z, b0); y0 = y; b0 = b; }
      }
      continue;
    }
    if (drop >= 3 && !wound && !onWater) {
      fill(x, start, z, x, top, z, kind === "mirror" || kind === "high" ? B.polished : B.basalt);
      // Choir ore shows in the cliff faces, richer the deeper into the Hollow you go.
      if (hash(x, z, 301) < oreChance(z)) set(x, top - 1 - Math.floor(hash(x, z, 302) * 3), z, B.ore);
      // Blue crystal clusters on the ledges of the highlands, and thick on the climb to the Seat.
      if (c.road === undefined && !c.site && hash(x, z, 303) < glintChance(kind, z) * 2) set(x, top + 1, z, B.glint);
      // Veilmoss spills over the ledge and hangs down the cliff face.
      if (c.road === undefined && !c.site && top >= SEA) {
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([di, dj], side) => {
          const n = h(i + di, j + dj);
          if (n === null || i + di < 0 || i + di > 15 || j + dj < 0 || j + dj > 15) return; // stay inside the chunk
          const len = strandsAt(x, z, side, top - n, kind);
          if (!len) return;
          set(x, top, z, B.moss);
          fill(x + di, top - len + 1, z + dj, x + di, top, z + dj, B.strands);
        });
      }
    } else {
      const ashy = kind === "waste" && !c.paved && top >= SEA && !onWater;
      fill(x, start, z, x, ashy ? top - 2 : top - 1, z, B.rock);
      if (ashy) fill(x, Math.max(start, top - 1), z, x, top - 1, z, B.ash); // pale ash lies a layer or two deep on the wastes
      if (onWater) set(x, top, z, B.flow); // the glowing bed of a light river
      else if (top < SEA) set(x, top, z, B.tuff);
      else if (c.paved) set(x, top, z, hash(x, z, 401) < (c.road < 1.2 ? 0.8 : 0.4) ? B.cobble : B.road); // cobbles, worn away to dirt at the edges
      else set(x, top, z, groundAt(x, z, wound ? "wound" : kind, drop, c.river));
    }
    // Everything below the water line is under water: one level across the whole Hollow, so nothing spills.
    if (top < SEA) fill(x, top + 1, z, x, SEA, z, B.water);
    // A real bridge stands here (planBridges): the land beneath stays as it is, under the bridge.
    if (c.under !== undefined && bridged(x, z)) continue;
    // Where the story path crosses a river: a stone deck with the river running beneath.
    if (c.under !== undefined) {
      // The underside is an arch: thin over the water, thickening to solid stone at the banks,
      // and on long bridges a row of arches on piers every 10 blocks.
      const overWater = c.river <= 6;
      let depth = overWater ? 1 + Math.round(4 * (c.river / 6) ** 2) : 99;
      if (!overWater && c.h - top > 12) {
        const t = ((Math.floor(c.roadS) % 10) + 10) % 10;
        depth = t < 2 ? 99 : 1 + Math.round(4 * (1 - Math.sin((Math.PI * (t - 2)) / 8)) ** 2);
      }
      fill(x, Math.max(top + 1, c.h - depth), z, x, c.h - 1, z, hash(x, z, 403) < 0.2 ? B.deckCracked : B.deck);
      set(x, c.h, z, c.paved ? (hash(x, z, 401) < 0.3 ? B.cobble : B.deck) : B.deck);
      if (!c.paved) {
        set(x, c.h + 1, z, B.parapet); // low walls along both sides
        // Soul lanterns on the parapet at both ends of the bridge (Mateo, 2026-11-12) and every 12 blocks along it.
        if (bridgeEnd(i, j) || Math.floor(c.roadS) % 12 === 0) set(x, c.h + 2, z, B.lantern);
      }
      continue;
    }
    // A lantern post beside the road about every 24 blocks.
    if (c.road !== undefined && !c.paved && c.lamps !== false && c.road < ROAD_HALF_WIDTH + 1.6 && top >= SEA && Math.floor(c.roadS) % 24 === 0) {
      if (!c.site) { fill(x, top + 1, z, x, top + 2, z, B.post); set(x, top + 3, z, B.lantern); }
      continue;
    }
    if (c.road !== undefined || c.site) continue; // nothing grows on a road's verge or in a village

    // Plants and spires (never on the path, in the water, or on a river bank)
    if (top < SEA || drop >= 3 || wound || nearPath(x, z, 3) || c.river < RIVER_HALF_WIDTH + 3) continue;
    const giant = i >= 3 && i <= 12 && j >= 3 && j <= 12 ? giantCapAt(x, z, kind) : undefined; // whole cap inside the chunk
    if (giant) {
      const y = top + giant.tall, w = giant.wide;
      fill(x, top + 1, z, x, y, z, B.stem);
      for (let a = -w; a <= w; a++) for (let b = -w; b <= w; b++) {
        const d = Math.hypot(a, b);
        if (d <= w - 0.6) set(x + a, y + 1, z + b, B.cap); // the crown of the cap
        else if (d <= w + 0.3) set(x + a, y, z + b, B.cap); // the rim, one lower, so the cap domes
      }
      continue;
    }
    const r = hash(x, z, 5);
    if (r < (arenaView(x, z) ? 0 : spineCol ? (kind === "shallows" ? 0 : 0.006) : SPIRES[kind])) {
      const tall = 8 + Math.floor(hash(x, z, 6) * 22);
      fill(x, top + 1, z, x, top + tall, z, kind === "mirror" ? B.glass : B.basalt);
    } else if (r < (spineCol ? 0.06 : PLANTS[kind])) {
      set(x, top + 1, z, hash(x, z, 7) < (kind === "fen" ? 0.3 : 0.6) ? B.veilcap : B.glimbulb);
    } else if (hash(x, z, 304) < glintChance(kind, z)) {
      set(x, top + 1, z, B.glint);
    } else {
      const stage = shardAt(x, z, kind);
      if (stage >= 0) {
        set(x, top, z, B.budding);
        ops.push({ a: [x, top + 1, z], b: [x, top + 1, z], block: SHARD_STAGES[stage], states: { "minecraft:block_face": "up" } });
      }
    }
  }

  // Veins of Choir ore inside the rock, more of them the deeper into the Hollow you go.
  if (full && Z0 >= 60) {
    const veins = Math.floor(hash(cx, cz, 310) * (2 + 5 * Math.min(1, Z0 / 2300)));
    for (let v = 0; v < veins; v++) {
      const i = 1 + Math.floor(hash(cx, cz, 311 + v) * 13), j = 1 + Math.floor(hash(cx, cz, 331 + v) * 13);
      const roof = Math.min(h(i, j), h(i + 1, j), h(i, j + 1), h(i + 1, j + 1)) - 4;
      if (roof <= L.floorY + 2) continue;
      const y = L.floorY + 1 + Math.floor(hash(cx, cz, 351 + v) * (roof - L.floorY - 1));
      fill(X0 + i, y, Z0 + j, X0 + i + 1, y + (hash(cx, cz, 371 + v) < 0.5 ? 1 : 0), Z0 + j + 1, B.ore);
    }
  }

  // Groves and fens get a few more trees than the one landmark below.
  extraTrees(ops, cx, cz, col);

  // One landmark per chunk at most, kept inside the chunk.
  const cxm = X0 + 8, czm = Z0 + 8, mid = col(8, 8);
  if (mid === null || mid.h < SEA || mid.river < 16 || siteAt(cxm, czm) || landmarkNearRoad(cx, cz, col) || (inSpine(cxm) && (czm < 40 || inCourt(cxm, czm) || nearPath(cxm, czm, 12)))) return ops;
  const roll = hash(cx, cz, 101), kind = mid.region;
  // Nudge each landmark off the chunk's middle so they don't line up in a grid (still inside the chunk).
  const nudge = (max, salt) => Math.round((hash(cx, cz, salt) - 0.5) * 2 * max);
  const at = (max) => {
    const x = cxm + nudge(max, 105), z = czm + nudge(max, 106);
    const y = heightAt(x, z);
    return [x, y !== null && y >= SEA ? y : null, z];
  };
  const tree = () => { const [x, y, z] = at(1); if (y !== null) hollowTree(ops, x, y, z, treeKind(x, z, kind), hash(cx, cz, 107)); };
  const bell = () => { const [x, y, z] = at(2); if (y !== null) brokenBell(ops, x, y + 1, z, cx, cz); };
  const isle = () => {
    // A rock island hanging under the roof, with room above the land beneath it.
    const [x, , z] = at(3), y = roofAt(x, z).bottom - 9 - Math.floor(hash(cx, cz, 103) * 8);
    if (y >= (groundBeforeRoads(x, z) ?? L.floorY) + 18) island(ops, x, y, z, cx, cz);
  };
  if (Math.hypot(cxm - 330, czm - 250) < 120 && !inSpine(cxm)) { if (roll < 0.85) tree(); } // the Lattice Wood: thick forest
  else if (kind === "wood") { if (roll < 0.5) tree(); else if (roll > 0.97) isle(); }
  else if (kind === "fen") { if (roll < 0.1) tree(); else if (roll > 0.95) isle(); }
  else if (kind === "high") { if (roll < 0.05) tree(); else if (roll > 0.82) isle(); }
  else if (kind === "waste") { if (roll < 0.03) tree(); else if (roll < 0.13) bell(); else if (roll > 0.97) isle(); }
  else if (roll < 0.17) tree();
  else if (kind === "shallows" && roll < 0.4) { const [x, y, z] = at(4); if (y !== null) ruin(ops, x, y, z, cx, cz); }
  else if (kind === "bells" && roll < 0.35) bell();
  else if (roll > 0.93) isle();
  return ops;
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
  return x0 + 15 >= -L.reach && x0 <= L.reach && z0 + 15 >= L.zStart && z0 < L.zEnd;
}

// ---- the roof ------------------------------------------------------------------------------
// Mateo, 2026-11-11: "needs to be much darker and no sun, what if we boxed the entire thing in" and
// "the roof cant just be flat either". The Hollow is one enormous cave. Its roof follows the land
// about 30 to 50 blocks overhead (close enough to always be drawn, so no sky and no sun show), with
// broad domes and vaults, lumps, hanging rock, amethyst drips, curtains of glowing Veilmoss, a few
// weeping crying-obsidian stars, and now and then a basalt pillar holding it up. Its rock is a mix
// like the ground's. The vanilla rock blocks the daylight; the Hollow is lit by what glows in it,
// plus the faint AMBIENT glow below.
export const ROOF = {
  top: 203, // the roof's upper face (the old ceiling's top, inside the dimension's height range)
  shell: 200, // an unbreakable Veil Rock shell from here up to top, so nobody digs out to the sky
  maxBottom: 196, // the underside never higher than this (at least 4 rock under the shell)
  clearance: 36, // the underside's base height above the highest land within WINDOW blocks
  cell: 24, // the base height is worked out on a 24-block grid and blended in between
  window: 32,
  step: 8,
  heartFloor: 132, // the Choir's Heart floats with no land under it: treat it as land this high
};
const ROOF_ROCK = [
  [0.34, "minecraft:blackstone"],
  [0.48, "minecraft:deepslate"],
  [0.6, "minecraft:basalt"],
  [0.72, "minecraft:tuff"],
  [1.01, "minecraft:cobbled_deepslate"],
];
// Tall things the roof must clear: hand-designed sites and the drowned city's towers.
let tall;
function tallThings() {
  if (tall) return tall;
  tall = [];
  const top = (d) => d.rows.reduce((m, r) => Math.max(m, r[0]), 0);
  for (const s of SITES) if (SITE_DESIGNS[s.id] && s.y !== undefined) tall.push({ x: s.x, z: s.z, r: s.r, y: s.y + top(SITE_DESIGNS[s.id]) });
  const towers = Object.values(TOWER_DESIGNS).reduce((m, d) => Math.max(m, top(d)), 0);
  tall.push({ x: -165, z: 1465, r: 60, y: 68 + towers }); // Hallowmere's drowned city (drowned.js DROWNED_AREA)
  return tall;
}
const roofNodes = new Map();
// Base height of the roof's underside at a grid node: the highest land near it, plus the clearance.
function roofNode(gx, gz) {
  const key = gx + "," + gz;
  let v = roofNodes.get(key);
  if (v !== undefined) return v;
  const x0 = gx * ROOF.cell, z0 = gz * ROOF.cell, W = ROOF.window;
  let m = -Infinity;
  for (let dx = -W; dx <= W; dx += ROOF.step) for (let dz = -W; dz <= W; dz += ROOF.step) {
    const n = roofLand(x0 + dx, z0 + dz);
    if (n !== null) m = Math.max(m, n);
  }
  if (z0 + W >= HEART.center.z - HEART.outerRadius - 40) m = Math.max(m, ROOF.heartFloor);
  for (const t of tallThings()) if (Math.hypot(x0 - t.x, z0 - t.z) <= t.r + W) m = Math.max(m, t.y - 20);
  if (m === -Infinity) m = 110; // over the void past the edge
  v = Math.min(ROOF.maxBottom, m + ROOF.clearance);
  if (roofNodes.size > 20000) roofNodes.clear();
  roofNodes.set(key, v);
  return v;
}
// The roof over one column: { bottom, block } (the rock runs from bottom up to the shell). Pure.
export function roofAt(x, z) {
  const fx = x / ROOF.cell, fz = z / ROOF.cell, gx = Math.floor(fx), gz = Math.floor(fz), tx = fx - gx, tz = fz - gz;
  const base = (roofNode(gx, gz) * (1 - tx) + roofNode(gx + 1, gz) * tx) * (1 - tz)
    + (roofNode(gx, gz + 1) * (1 - tx) + roofNode(gx + 1, gz + 1) * tx) * tz;
  const vault = (fbm(x / 70, z / 70, 601) - 0.5) * 30; // broad domes and low sags
  const lumps = (fbm(x / 17, z / 17, 602) - 0.5) * 9 + (hash(x, z, 603) < 0.2 ? 1 : 0);
  const bottom = Math.round(Math.min(ROOF.maxBottom, Math.max(base - 6, base + 4 + vault + lumps)));
  const p = spread(fbm(x / 13, z / 13, 611));
  let block = ROOF_ROCK.find(([t]) => p < t)[1];
  const r = hash(x, z, 612);
  if (r < 0.006) block = "minecraft:crying_obsidian"; // weeping purple specks overhead
  else if (r < 0.05) block = B.rock; // veinstone
  return { bottom, block };
}

function planRoof(ops, cx, cz, col) {
  const X0 = cx * 16, Z0 = cz * 16;
  const x1 = Math.max(X0, -L.reach), x2 = Math.min(X0 + 15, L.reach);
  const z1 = Math.max(Z0, L.zStart), z2 = Math.min(Z0 + 15, L.zEnd - 1);
  if (x1 > x2 || z1 > z2) return;
  ops.push({ a: [x1, ROOF.shell, z1], b: [x2, ROOF.top, z2], block: B.ceiling });
  const R = [];
  for (let x = x1; x <= x2; x++) for (let z = z1; z <= z2; z++) {
    const rf = roofAt(x, z);
    R.push([x, z, rf]);
    ops.push({ a: [x, rf.bottom, z], b: [x, ROOF.shell - 1, z], block: rf.block });
  }
  // What hangs from it, kept inside the chunk and well above the land.
  for (const [x, z, rf] of R) {
    const i = x - X0, j = z - Z0;
    const ground = col(i, j)?.h ?? L.floorY;
    const room = rf.bottom - ground - 14; // never hang lower than 14 blocks over the land
    const r = hash(x, z, 621);
    if (i >= 2 && i <= 13 && j >= 2 && j <= 13 && r < 0.012 && room > 4) {
      // Hanging rock: a cone, three wide at the root, tapering to a point, often tipped with amethyst.
      const len = Math.min(room, 4 + Math.floor(hash(x, z, 622) ** 2 * 20));
      const root = Math.max(1, Math.floor(len * 0.4));
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) ops.push({ a: [x + di, rf.bottom - root, z + dj], b: [x + di, rf.bottom - 1, z + dj], block: rf.block });
      ops.push({ a: [x, rf.bottom - len, z], b: [x, rf.bottom - 1, z], block: rf.block });
      if (hash(x, z, 623) < 0.6) ops.push({ a: [x, rf.bottom - len - 1, z], b: [x, rf.bottom - len - 1, z], block: "minecraft:amethyst_cluster", states: { "minecraft:block_face": "down" }, optional: true });
    } else if (r < 0.022 && room > 2) {
      ops.push({ a: [x, rf.bottom - 1, z], b: [x, rf.bottom - 1, z], block: "minecraft:amethyst_cluster", states: { "minecraft:block_face": "down" }, optional: true });
    } else if (r < 0.04 && room > 6) {
      const len = 2 + Math.floor(hash(x, z, 624) * 5); // a curtain of glowing Veilmoss
      ops.push({ a: [x, rf.bottom - len, z], b: [x, rf.bottom - 1, z], block: B.strands });
    }
  }
  // Now and then a great basalt pillar from the land to the roof.
  const pi = 4 + Math.floor(hash(cx, cz, 631) * 8), pj = 4 + Math.floor(hash(cx, cz, 632) * 8);
  const c = col(pi, pj), px = X0 + pi, pz = Z0 + pj;
  if (hash(cx, cz, 633) < 0.05 && c && c.h >= SEA && c.road === undefined && !c.site && c.river > RIVER_HALF_WIDTH + 6
    && !siteAt(px, pz) && !(inSpine(px) && (pz < 60 || inCourt(px, pz) || nearPath(px, pz, 10)))
    && !arenaView(px, pz)) { // keep the arenas' views clear
    const roofY = roofAt(px, pz).bottom;
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) {
      const d = a * a + b * b;
      if (d > 5) continue;
      const cc = col(pi + a, pj + b);
      if (!cc) continue;
      const foot = (cc.under ?? cc.h) - 2;
      if (d <= 2) ops.push({ a: [px + a, foot, pz + b], b: [px + a, roofY, pz + b], block: d === 0 ? B.basalt : B.polished });
      else { // the flare at foot and head
        ops.push({ a: [px + a, foot, pz + b], b: [px + a, foot + 4 + Math.floor(hash(px + a, pz + b, 634) * 4), pz + b], block: B.basalt });
        ops.push({ a: [px + a, roofY - 3 - Math.floor(hash(px + a, pz + b, 635) * 4), pz + b], b: [px + a, roofY, pz + b], block: B.basalt });
      }
    }
  }
}

// ---- light -----------------------------------------------------------------------------------
// The roof shuts out the day, so a faint glow hangs a couple of blocks over the land: invisible light
// blocks on a staggered grid. Ground between them sits at light 1 to 4, so it reads as dark, things
// that glow stand out, and nothing ever sits at light 0 (where vanilla monsters would spawn).
export const AMBIENT = { block: "minecraft:light_block_5", spacing: 6 };
export function ambientLightAt(x, z) {
  const s = AMBIENT.spacing, mx = ((x % s) + s) % s, mz = ((z % s) + s) % s;
  return (mx === 0 && mz === 0) || (mx === s / 2 && mz === s / 2);
}

// ---- ground ----------------------------------------------------------------------------------
// Mateo, 2026-11-11: the ground "cant just be one solid block". Every kind of land mixes several
// blocks: broad patches from slow noise, smaller ones inside them, a scatter of single blocks, and
// bare rock where the ground slopes.
// fbm() bunches up around 0.5; this spreads it to roughly even over 0 to 1, so patch thresholds read as shares.
const spread = (p) => clamp01((p - 0.3) / 0.4);
const LAND_STYLE = { wound: "wound", shallows: "fen", court: "fen", mirror: "high", climb: "high", bells: "waste", heart: "high" };
export const GROUND = {
  //        broad patches by noise (upper limits), small patches, scatter, slopes
  wood: { patches: [[0.3, B.mossDeep], [0.66, B.moss], [0.8, "minecraft:mycelium"], [1.01, B.moss]], small: [0.9, "minecraft:soul_soil"], scatter: [0.04, "minecraft:blackstone"], slope: "minecraft:tuff" },
  fen: { patches: [[0.38, B.mossDeep], [0.62, B.moss], [0.76, "minecraft:mud"], [1.01, B.mossDeep]], small: [0.88, "minecraft:sculk"], scatter: [0.04, "minecraft:soul_soil"], slope: "minecraft:mud" },
  high: { patches: [[0.3, "minecraft:blackstone"], [0.5, B.moss], [0.68, "minecraft:tuff"], [0.84, "minecraft:smooth_basalt"], [1.01, B.mossDeep]], small: [0.86, B.mossDeep], scatter: [0.05, "minecraft:cobbled_deepslate"], slope: "minecraft:blackstone" },
  waste: { patches: [[0.24, "minecraft:tuff"], [0.66, B.ash], [0.8, "minecraft:gravel"], [1.01, B.ash]], small: [0.9, "minecraft:calcite"], scatter: [0.04, "minecraft:smooth_basalt"], slope: "minecraft:tuff" },
  wound: { patches: [[0.4, "minecraft:blackstone"], [1.01, B.rock]], small: [0.88, B.mossDeep], scatter: [0.03, "minecraft:cobbled_deepslate"], slope: B.rock },
};
// The top block of a column of open land. Pure.
export function groundAt(x, z, kind, slope = 0, river = Infinity) {
  const g = GROUND[LAND_STYLE[kind] ?? kind] ?? GROUND.wood;
  if (slope >= 2 && hash(x, z, 513) < 0.7) return g.slope;
  if (hash(x, z, 514) < g.scatter[0]) return g.scatter[1];
  if (spread(fbm(x / 6, z / 6, 512)) > g.small[0]) return g.small[1];
  const p = spread(fbm(x / 16, z / 16, 511)) + (river < 14 ? -0.15 : 0); // the banks lean to the damp end of the list
  return g.patches.find(([t]) => p < t)[1];
}

// ---- trees -----------------------------------------------------------------------------------
// The Hollow's own species from the tree database (map/trees, exported by tools/hollow_trees.py):
// Latticewood, the Veilmoss Tree and Ashen Deadwood, in three sizes with several shapes each.
const TREE_MIX = {
  forest: [[0.7, "hollow_latticewood"], [1.01, "hollow_veilmoss_tree"]],
  wood: [[0.55, "hollow_latticewood"], [1.01, "hollow_veilmoss_tree"]],
  fen: [[0.8, "hollow_veilmoss_tree"], [1.01, "hollow_latticewood"]],
  high: [[0.5, "hollow_latticewood"], [1.01, "hollow_ash_dead"]],
  waste: [[1.01, "hollow_ash_dead"]],
};
const inLatticeWood = (x, z) => Math.hypot(x - 330, z - 250) < 120 && !inSpine(x);
export function treeKind(x, z, kind) {
  if (inLatticeWood(x, z)) return "forest";
  const s = LAND_STYLE[kind] ?? kind;
  return TREE_MIX[s] ? s : "wood";
}
// Which tree grows here: { species, size, variant }. Pure.
export function pickTree(kindOfLand, roll, big = true) {
  const mix = TREE_MIX[kindOfLand] ?? TREE_MIX.wood;
  const species = mix.find(([t]) => roll < t)[1];
  const r2 = hash(Math.floor(roll * 1e6), 7, 141);
  const size = !big ? (r2 < 0.55 ? "young" : "mature") : r2 < (kindOfLand === "forest" ? 0.5 : 0.35) ? "ancient" : r2 < 0.85 ? "mature" : "young";
  const list = HOLLOW_TREES[species][size];
  return { species, size, variant: Math.floor(hash(Math.floor(roll * 1e6), 9, 142) * list.length) };
}
// One tree with its trunk standing on the ground block at (x, y, z).
function hollowTree(ops, x, y, z, kindOfLand, roll, big = true) {
  const { species, size, variant } = pickTree(kindOfLand, roll, big);
  const t = HOLLOW_TREES[species][size][variant];
  for (const [dx, dz, y0, y1, i] of t.runs) {
    const [block, states] = t.palette[i];
    ops.push({ a: [x + dx, y + y0, z + dz], b: [x + dx, y + y1, z + dz], block, states, optional: true });
  }
}
// A few more, smaller trees in the groves, the Lattice Wood and the fens, away from the chunk's middle.
const EXTRA = { forest: 3, wood: 2, fen: 1 };
function extraTrees(ops, cx, cz, col) {
  for (const [qi, qj, salt] of [[3, 3, 151], [12, 4, 152], [4, 12, 153]]) {
    const i = qi + Math.round((hash(cx, cz, salt) - 0.5) * 2), j = qj + Math.round((hash(cx, cz, salt + 10) - 0.5) * 2);
    const c = col(i, j);
    if (!c || c.h < SEA + 1 || c.road !== undefined || c.site || c.river < RIVER_HALF_WIDTH + 6 || c.under !== undefined) continue;
    const x = cx * 16 + i, z = cz * 16 + j;
    if (inSpine(x) && (z < 40 || inCourt(x, z) || nearPath(x, z, 8))) continue;
    if (siteAt(x, z)) continue;
    const k = treeKind(x, z, c.region), n = EXTRA[k] ?? 0;
    if (hash(cx, cz, salt + 20) * 3 >= n) continue;
    hollowTree(ops, x, c.h, z, k, hash(cx, cz, salt + 30), k === "forest");
  }
}
