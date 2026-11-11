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
// trees, glowing pink and blue fungi, rivers of pale blue light, fog above and a far ceiling.

import { UNDERTOW_LAYOUT as L, COURT, pathX, stageAt } from "./layout.js";
import { hash, fbm, smooth } from "./noise.js";
import { riverDistance, RIVER_HALF_WIDTH } from "./rivers.js";
import { siteAt, roadAt, SITE_SKIRT, ROAD_HALF_WIDTH, ROAD_SHOULDER } from "./roads.js";

export { hash, fbm } from "./noise.js";

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
const inHeart = (z) => z >= 2330;
const inSpine = (x) => Math.abs(x) <= L.halfWidth;
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
function spine(x, z) {
  if (z < L.zStart || z >= L.zEnd || inHeart(z)) return null; // the final arena floats in the fog; built separately

  // The Wound: a ledge at y 100 with a wall behind it and a ramp down along the path.
  if (z < 40) {
    if (z < -10) return Math.abs(x) <= 24 ? 126 - Math.floor(fbm(x / 9, z / 9, 5) * 6) : null;
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

// The land before the rivers cut into it: { h, region } or null for void.
function natural(x, z) {
  if (z < L.zStart || z >= L.zEnd) return null;
  const ax = Math.abs(x);
  const rimX = ax <= L.halfWidth + 45 ? rimAt(x, z) : L.halfWidth;
  if (ax <= rimX) {
    const h = spine(x, z);
    return h === null ? null : { h, region: stageAt(z)?.id ?? "wound" };
  }
  const w = wild(x, z);
  if (w === null) return null;
  if (ax < rimX + 40) { // the outer foot of the rim eases into the open country
    const rim = spine(x < 0 ? -rimX : rimX, z);
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
  if (inSpine(x) && z > 10 && z < 2330 && !inCourt(x, z)) {
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

// ---- the plan for one chunk ------------------------------------------------------------
const PLANTS = { wood: 0.08, fen: 0.1, high: 0.02, waste: 0.012 };
const SPIRES = { wood: 0.002, fen: 0.002, high: 0.012, waste: 0.004 };

export function planChunk(cx, cz) {
  const ops = planLand(cx, cz);
  const X0 = cx * 16, Z0 = cz * 16;
  // The sealed wall across the whole Hollow behind the Court (its gates open when the Court's boss dies).
  // Added last, so nothing in the chunk overwrites it.
  if (COURT.gateZ >= Z0 && COURT.gateZ <= Z0 + 15 && X0 + 15 >= -L.reach && X0 <= L.reach) {
    ops.push({ a: [Math.max(X0, -L.reach), L.floorY, COURT.gateZ], b: [Math.min(X0 + 15, L.reach), L.ceilingY + L.ceilingThickness - 1, COURT.gateZ], block: B.seal });
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
  const h = (i, j) => { const c = col(i, j); return c === null ? null : c.under ?? c.h; };

  let minH = Infinity, any = false, full = true;
  for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) {
    const v = h(i, j);
    if (v !== null) { any = true; minH = Math.min(minH, v); } else full = false;
  }

  // Ceiling over the whole Hollow (also above the Heart, where there is no ground).
  {
    const x1 = Math.max(X0, -L.reach), x2 = Math.min(X0 + 15, L.reach);
    const z1 = Math.max(Z0, L.zStart), z2 = Math.min(Z0 + 15, L.zEnd - 1);
    if (x1 <= x2 && z1 <= z2) {
      fill(x1, L.ceilingY, z1, x2, L.ceilingY + L.ceilingThickness - 1, z2, B.ceiling);
      // Hanging basalt spires
      for (let i = 0; i < 16; i += 2) for (let j = 0; j < 16; j += 2) {
        const x = X0 + i, z = Z0 + j;
        if (x < x1 || x > x2 || z < z1 || z > z2) continue;
        if (hash(x, z, 77) < 0.03) fill(x, L.ceilingY - 4 - Math.floor(hash(x, z, 78) * 22), z, x, L.ceilingY - 1, z, B.basalt);
      }
    }
  }
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
      else set(x, top, z, wound ? B.rock : kind === "waste" ? B.ash : B.moss);
    }
    // Everything below the water line is under water: one level across the whole Hollow, so nothing spills.
    if (top < SEA) fill(x, top + 1, z, x, SEA, z, B.water);
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
      if (!c.paved) set(x, c.h + 1, z, B.parapet); // low walls along both sides
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
    if (r < (spineCol ? (kind === "shallows" ? 0 : 0.006) : SPIRES[kind])) {
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
  const tree = () => { const [x, y, z] = at(1); if (y !== null) latticeTree(ops, x, y + 1, z, cx, cz); };
  const bell = () => { const [x, y, z] = at(2); if (y !== null) brokenBell(ops, x, y + 1, z, cx, cz); };
  const isle = () => { const [x, , z] = at(3); island(ops, x, 150 + Math.floor(hash(cx, cz, 103) * 25), z, cx, cz); };
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
  return x0 + 15 >= -L.reach && x0 <= L.reach && z0 + 15 >= L.zStart && z0 < L.zEnd;
}
