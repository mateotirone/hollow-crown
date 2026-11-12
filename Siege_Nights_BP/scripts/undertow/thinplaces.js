// The seven thin places, built by script so the road to the Rift works on a freshly generated map.
//
// Each thin place (plots/config.js WARDS with thin: true and a lore `site` id) gets a cave of its own (CAVES):
// its own way in (straight, winding, a 45 degree stair, a drowned stretch) and its own chamber (a domed room, a
// squared hall, a tall shaft). Two things are the same in all seven: the back wall where the Rift seam stands, and
// that wall rising the chamber's full height, so the crack runs from the floor to the ceiling. The land always
// covers the cave. The cave is built to match
// Brother Fennick's six features for that site (lore/data/world.js SITE_FEATURES), so his Field Notes really do
// single out one cave in the world:
//   water   the way in dips under water and you swim a few blocks      (else: dry all the way)
//   bell    a cracked bronze bell lies near the mouth                   (else: no bell at all)
//   worked  cut stone lining, a framed mouth, pillars                   (else: raw rock only)
//   cold    ice at the mouth, snow outside                              (else: none)
//   salt    salt crust (calcite) on walls and floor                     (else: none)
//   roots   rooted ceiling with hanging roots                           (else: none)
// Outside each mouth is Fennick's camp (tent, dead fire, lantern on a post) with that site's Field Note lying in
// the tent as a Dusty Tome every player can copy once.
//
// Building starts the first time a player comes within BUILD_NEAR blocks, runs as a system.runJob a few dozen
// blocks per step (never a long tick), and retries later if part of it was not loaded. A site a builder already
// marked by hand (/scriptevent hc:mark_source_site) is left alone.
//
// Commands (creative/op):
//   /scriptevent hc:thin_tp <site id>       go to a thin place's camp
//   /scriptevent hc:thin_build <site id>    build (or rebuild) that site now; you must be near it
//   /scriptevent hc:thin_status             which sites are built

import { world, system, BlockPermutation } from "@minecraft/server";
import { WARDS } from "../plots/config.js";
import { SITE_FEATURES } from "../lore/data/world.js";
import { placeCache } from "../lore/caches.js";
import { markPlace } from "../lore/ledger.js";
import { hash, fbm } from "./noise.js";
import { load, save, say, runCmd, FACING } from "./data.js";
import { getSites, recordSite } from "./source.js";
import { SEAM, CRACK_DEPTH } from "./rift.js";

const OVERWORLD = "minecraft:overworld";
const K_BUILT = "hc:thin_built"; // { siteId: true }
const BUILD_NEAR = 110; // past the reach of the build, so nobody stands in it as it goes up
const PER_STEP = 96; // blocks placed per runJob step

// face / off come from the ward (picked against the generated map: downhill, off the paths, back from cliff edges).
export const THIN_PLACES = WARDS.filter((w) => w.thin && w.site).map((w) => ({ id: w.site, name: w.name, x: w.x + (w.off?.[0] ?? 0), z: w.z + (w.off?.[1] ?? 0), r: w.r, facing: w.face ?? "south" }));

// Which Field Note lies in each camp. Notes I to VI each state one feature; VII is Fennick's last report.
export const CAMP_TOME = {
  sunken_quarry: "surv_01",
  bellfounders_mine: "surv_02",
  kings_barrow: "surv_03",
  frostvein_hollow: "surv_04",
  saltglass_grotto: "surv_05",
  witchroot_caves: "surv_06",
  drowned_chapel: "surv_07",
};

// Rock per site: raw rock, cut stone (for worked sites), floor, and the outcrop's top.
const LOOK = {
  drowned_chapel: { raw: ["stone", "andesite", "diorite", "cobblestone"], cut: ["stone_bricks", "cracked_stone_bricks", "mossy_stone_bricks"], floor: "polished_andesite", top: "grass_block", pillar: "chiseled_stone_bricks" },
  bellfounders_mine: { raw: ["stone", "andesite", "cobblestone", "copper_ore"], cut: ["stone_bricks", "cracked_stone_bricks", "stone_bricks"], floor: "cobblestone", top: "stone", pillar: "stripped_spruce_log" },
  kings_barrow: { raw: ["tuff", "mossy_cobblestone", "dirt", "coarse_dirt"], cut: ["tuff_bricks", "polished_tuff", "tuff_bricks"], floor: "polished_tuff", top: "grass_block", pillar: "chiseled_tuff" },
  saltglass_grotto: { raw: ["smooth_sandstone", "sandstone", "calcite"], cut: ["cut_sandstone"], floor: "calcite", top: "sand", pillar: "sandstone" },
  frostvein_hollow: { raw: ["stone", "packed_ice", "andesite", "stone"], cut: ["stone_bricks"], floor: "stone", top: "stone", pillar: "stone" },
  sunken_quarry: { raw: ["red_sandstone", "terracotta", "orange_terracotta", "red_sandstone"], cut: ["cut_red_sandstone", "smooth_red_sandstone", "cut_red_sandstone"], floor: "smooth_red_sandstone", top: "red_sand", pillar: "chiseled_red_sandstone" },
  witchroot_caves: { raw: ["tuff", "packed_mud", "mossy_cobblestone", "tuff"], cut: ["mud_bricks"], floor: "packed_mud", top: "moss_block", pillar: "mud_bricks" },
};

// Local coordinates: u = to the right of the mouth, v = out of the mouth, y above the ground block G.
// Where Fennick's camp goes when no level ground is found nearer (see the camp step of the planner).
export const SHAPE = { camp: { u: 10, v: 13 } };
// Each hill has its own silhouette. rx: half width; rzN / rzS: reach north / south of cv; peak: height;
// round: <1 flattens the top (barrow, mesa), >1 sharpens it; rough: surface noise; wobble: outline noise; terrace: bench height.
export const HILL = {
  kings_barrow: { cv: -10, rx: 19, rzN: 24, rzS: 13, peak: 16, round: 0.45, rough: 0.04, wobble: 0.08, terrace: 0 },
  bellfounders_mine: { cv: -10, rx: 23, rzN: 23, rzS: 10, peak: 20, round: 0.85, rough: 0.32, wobble: 0.25, terrace: 0 },
  frostvein_hollow: { cv: -11, rx: 25, rzN: 24, rzS: 9, peak: 22, round: 0.95, rough: 0.38, wobble: 0.3, terrace: 0 },
  drowned_chapel: { cv: -10, rx: 21, rzN: 22, rzS: 11, peak: 17, round: 0.7, rough: 0.22, wobble: 0.2, terrace: 0 },
  witchroot_caves: { cv: -10, rx: 23, rzN: 22, rzS: 13, peak: 15, round: 0.55, rough: 0.14, wobble: 0.32, terrace: 0 },
  saltglass_grotto: { cv: -10, rx: 25, rzN: 22, rzS: 10, peak: 16, round: 0.3, rough: 0.08, wobble: 0.22, terrace: 3 },
  sunken_quarry: { cv: -10, rx: 23, rzN: 22, rzS: 9, peak: 16, round: 0.3, rough: 0.05, wobble: 0.15, terrace: 4 },
};

const pick = (list, a, b, c) => list[Math.floor(hash(a * 7 + c, b * 13 - c, 911) * list.length) % list.length];

// The hill's height over the ground at (u, v), 0 where there is no hill. Pure; exported for the self-test.
// Rocky outcrop, not a dome (Mateo 2026-11-12: "just a damn grass ball"): a few overlapping lobes of different
// sizes, a ridged-noise skin so the top breaks into knolls and gullies, gentle feet that run out into the land,
// and a curved cliff face across the front where the mouth opens out of bare rock.
const SALT = (id) => [...id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 9973;
export function lobes(id) {
  const H = HILL[id], salt = SALT(id), out = [[0, H.cv, H.rx, H.rzN, 1]];
  for (let i = 0; i < 3; i++) {
    out.push([(hash(i, salt, 11) - 0.5) * H.rx * 1.3, H.cv - 4 - hash(i, salt, 12) * H.rzN * 0.7,
      H.rx * (0.4 + 0.3 * hash(i, salt, 13)), H.rzN * (0.4 + 0.3 * hash(i, salt, 14)), 0.55 + 0.4 * hash(i, salt, 15)]);
  }
  return out;
}
let HILLS = true;
export const setHills = (b) => { HILLS = b; };
export const cliffLine = (u) => 1 + 0.045 * u * u; // the front face curves back on both sides of the mouth
export function hillHeight(id, u, v) {
  const H = HILL[id], salt = SALT(id);
  let h = 0;
  for (const [lu, lv, rx, rz, k] of lobes(id)) {
    const wob = 1 + 0.35 * (fbm(u * 0.08, v * 0.08, salt + 3) - 0.5) * 2;
    const d2 = (((u - lu) / rx) ** 2 + ((v - lv) / rz) ** 2) / wob;
    if (d2 < 1) { const t = 1 - d2; h = Math.max(h, H.peak * k * t * t * (3 - 2 * t)); }
  }
  if (!HILLS) h = 0;
  if (h > 0) {
    const ridge = 1 - Math.abs(fbm(u * 0.06, v * 0.06, salt + 9) * 2 - 1);
    h *= 0.6 + 0.6 * ridge;
    h += (fbm(u * 0.25, v * 0.25, salt + 5) - 0.5) * 2.5 * Math.min(1, h / 4);
    const cl = cliffLine(u);
    if (v > cl) h *= Math.max(0, 1 - (v - cl) / 2); // the cliff: rock drops away within two blocks
    if (H.terrace && h > 0) h = Math.max(1, Math.round(h / H.terrace) * H.terrace);
  }
  // enough rock over the cave: the chamber roof, the wall the crack eats into, the covered part of the way in
  return Math.round(h);
}
// Bare rock for cliffs and steep slopes, per site, laid in rough beds so faces show strata.
const FACE = {
  kings_barrow: ["tuff", "andesite", "tuff", "stone", "mossy_cobblestone"],
  bellfounders_mine: ["stone", "andesite", "stone", "cobblestone", "copper_ore"],
  frostvein_hollow: ["stone", "andesite", "stone", "packed_ice"],
  drowned_chapel: ["stone", "andesite", "diorite", "stone", "mossy_cobblestone"],
  witchroot_caves: ["tuff", "stone", "mossy_cobblestone", "packed_mud"],
  saltglass_grotto: ["smooth_sandstone", "sandstone", "calcite", "sandstone"],
  sunken_quarry: ["red_sandstone", "terracotta", "orange_terracotta", "red_sandstone"],
};
// What grows on the outcrop's gentle ground: [block, chance] pairs, plus whether small trees stand on it.
const GROWTH = {
  kings_barrow: { plants: [["short_grass", 0.12], ["fern", 0.05], ["azalea_leaves", 0.03]], tree: "oak" },
  bellfounders_mine: { plants: [["short_grass", 0.14], ["fern", 0.03], ["azalea_leaves", 0.02]], tree: "oak" },
  frostvein_hollow: { plants: [["snow_layer", 0.6]], tree: "spruce" },
  drowned_chapel: { plants: [["short_grass", 0.16], ["fern", 0.04]], tree: "oak" },
  witchroot_caves: { plants: [["short_grass", 0.1], ["fern", 0.08], ["azalea_leaves", 0.05]], tree: "mangrove" },
  saltglass_grotto: { plants: [["dead_bush", 0.03]], tree: null },
  sunken_quarry: { plants: [["dead_bush", 0.04]], tree: null },
};

// Local (u along the mouth's right, v out of the mouth) to world offsets, for a mouth facing `facing`.
export function toWorld(u, v, facing = "south") {
  const [ox, oz] = FACING[facing] ?? FACING.south;
  return [u * oz + v * ox, -u * ox + v * oz];
}

// Each cave is its own (Mateo 2026-11-12: "it doesn't always have to be the same model ... be creative").
// Only two things are the same everywhere: the back wall where the Rift tears, and the crack running the full
// height of that wall, floor to ceiling. The way in is a list of legs walked from the mouth (local v = 6,
// floor y 1) toward -v: n blocks long, w = half width (0 = one block), h = clear height, drop = blocks down per
// block (1 = a 45 degree stair), bend = blocks sideways per block, sump = a drowned stretch you swim under,
// props = "timber" (mine sets) or "stones" (standing stones down a passage grave). Then the chamber:
// kind "round" (an oval room with a domed roof), "hall" (a squared hall, pillars if worked), "shaft" (a tall
// round column), rx / rz half sizes, h clear height at the middle.
export const CAVES = {
  kings_barrow: { legs: [{ n: 4, w: 2, h: 5 }, { n: 16, w: 1, h: 4, props: "stones" }, { n: 4, w: 1, h: 4, drop: 1 }], chamber: { kind: "round", rx: 4, rz: 4, h: 12, corbel: true } },
  bellfounders_mine: { legs: [{ n: 11, w: 1, h: 4, props: "timber" }, { n: 9, w: 1, h: 5, drop: 1, props: "timber" }, { n: 5, w: 1, h: 4, bend: 0.4, props: "timber" }], chamber: { kind: "hall", rx: 7, rz: 7, h: 10 } },
  frostvein_hollow: { legs: [{ n: 6, w: 1, h: 9, wob: 1 }, { n: 9, w: 0, h: 12, wob: 2 }, { n: 6, w: 1, h: 8, drop: 1 }], chamber: { kind: "shaft", rx: 5, rz: 5, h: 26 } },
  drowned_chapel: { legs: [{ n: 3, w: 1, h: 5 }, { n: 8, w: 1, h: 5, drop: 1 }, { n: 5, w: 1, h: 4, sump: true }, { n: 4, w: 2, h: 6 }], chamber: { kind: "hall", rx: 6, rz: 6, h: 11 } },
  witchroot_caves: { legs: [{ n: 6, w: 2, h: 4 }, { n: 9, w: 1, h: 3, drop: 0.5, bend: 0.34 }, { n: 4, w: 1, h: 3, sump: true }, { n: 6, w: 1, h: 3, drop: 0.5, bend: -0.5 }], chamber: { kind: "round", rx: 9, rz: 7, h: 7 } },
  saltglass_grotto: { legs: [{ n: 5, w: 3, h: 3 }, { n: 7, w: 2, h: 3, drop: 0.5 }], chamber: { kind: "round", rx: 7, rz: 8, h: 18 } },
  sunken_quarry: { legs: [{ n: 4, w: 2, h: 6 }, { n: 3, w: 1, h: 4, sump: true }, { n: 3, w: 2, h: 6 }], chamber: { kind: "hall", rx: 5, rz: 9, h: 15 } },
};
export const MOUTH_V = 6;

// Pure geometry of one cave in local coordinates. Returns air / water cell keys, the route (floor cells from the
// mouth inward), the chamber, the props, and the crack height (floor to the ceiling at the back wall).
export function caveGeometry(id) {
  const cave = CAVES[id], key = (u, y, v) => `${u},${y},${v}`;
  const air = new Set(), wet = new Set(), route = [], props = [];
  let u = 0, v = MOUTH_V, acc = 0, ua = 0;
  for (const L of cave.legs) {
    for (let i = 0; i < L.n; i++) {
      const fy = 1 - Math.floor(acc);
      const uc = Math.round(ua + (L.wob ? Math.sin((v + i) * 0.9) * L.wob : 0));
      if (L.sump) {
        for (let du = -L.w; du <= L.w; du++) {
          for (let y = fy - 4; y <= fy - 1; y++) wet.add(key(uc + du, y, v));
          const roof = i === 0 || i === L.n - 1 ? fy + L.h : fy - 1; // open shafts at each end, drowned between
          for (let y = fy; y < roof; y++) air.add(key(uc + du, y, v));
        }
      } else {
        for (let du = -L.w; du <= L.w; du++) for (let y = fy; y < fy + L.h + (Math.abs(du) < L.w || L.w === 0 ? 0 : -1); y++) air.add(key(uc + du, y, v));
        if (L.props === "timber" && i % 3 === 1) props.push(["set", uc, fy, v, L.w, L.h]);
        if (L.props === "stones" && i % 2 === 0) props.push(["stones", uc, fy, v, L.w, L.h]);
      }
      route.push([uc, fy, v, L.w, L.sump ? 1 : 0]);
      v -= 1; acc += L.drop ?? 0; ua += L.bend ?? 0;
    }
  }
  const C = cave.chamber, F = 1 - Math.floor(acc), uc = Math.round(ua), vc = v - C.rz;
  const inside = (a, b) => {
    const du = (a - uc) / (C.rx + 0.5), dv = (b - vc) / (C.rz + 0.5);
    if (C.kind === "hall") return Math.abs(a - uc) <= C.rx && Math.abs(b - vc) <= C.rz && !(Math.abs(a - uc) === C.rx && Math.abs(b - vc) === C.rz);
    return du * du + dv * dv <= 1;
  };
  const top = (a, b) => {
    const du = (a - uc) / (C.rx + 0.5), dv = (b - vc) / (C.rz + 0.5), d = Math.min(1, Math.sqrt(du * du + dv * dv));
    if (C.kind === "hall") return F + C.h - 1 - Math.round(3 * du * du) - Math.round(2 * dv * dv);
    if (C.kind === "shaft") return F + C.h - 1 - Math.round(4 * d * d) + Math.round(Math.sin(a * 1.3 + b) * 1.2);
    if (C.corbel) return F + Math.round((C.h - 1) * (1 - d ** 1.4)) + 2; // a corbelled beehive vault
    return F + Math.max(2, Math.round((C.h - 1) * Math.sqrt(1 - d * d)));
  };
  const wallV = vc - C.rz - 1;
  // the back wall rises the chamber's full height round the crack (a tall slot, like an apse), so the crack
  // always runs from the floor to the ceiling whatever the chamber's shape
  const roof = (a, b) => { let t = top(a, b); const du = Math.abs(a - uc), dv = b - wallV; if (du <= 3 && dv <= 4) t = Math.max(t, F + C.h - 1 - (du === 3 ? 1 : 0) - Math.max(0, dv - 2)); return t; };
  for (let a = uc - C.rx - 1; a <= uc + C.rx + 1; a++) for (let b = vc - C.rz - 1; b <= vc + C.rz + 1; b++) {
    if (!inside(a, b) && !(Math.abs(a - uc) <= 2 && b === wallV + 1)) continue;
    for (let y = F; y <= roof(a, b); y++) air.add(key(a, y, b));
  }
  const crackH = roof(uc, wallV + 1) - F + 1;
  return { air, wet, route, props, chamber: { kind: C.kind, uc, vc, rx: C.rx, rz: C.rz, F, wallV, inside, top: roof }, crackH };
}

// Pure: every block for one site, given ground height G (the top solid block at the build centre).
// opts.facing: which way the mouth opens. opts.ground(dx, dz): the real ground's top block at that world offset,
// relative to G (flat 0 when left out), so the hill sits on slopes and the way in meets the real ground.
// Returns { ops, seam, tome, mouth, camp, route, chamber, crackH } (route and chamber in local coordinates).
export function planThinPlace(id, cx, cz, G, opts = {}) {
  const facing = opts.facing ?? "south";
  const groundW = opts.ground ?? (() => 0);
  const gAt = new Map();
  const ground = (u, v) => { const k = `${u},${v}`; if (!gAt.has(k)) gAt.set(k, Math.round(groundW(...toWorld(u, v, facing)) ?? 0)); return gAt.get(k); };
  const f = SITE_FEATURES[id];
  const look = LOOK[id];
  if (!f || !look || !HILL[id] || !CAVES[id]) throw new Error(`planThinPlace: unknown site ${id}`);
  const [water, bell, worked, cold, salt, roots] = f;
  const cells = new Map();
  const key = (u, y, v) => `${u},${y},${v}`;
  const put = (u, y, v, block, layer = 0, states) => { cells.delete(key(u, y, v)); cells.set(key(u, y, v), { u, y, v, block, layer, states }); };
  const at = (u, y, v) => cells.get(key(u, y, v));
  const raw = (u, y, v) => pick(look.raw, u + y * 3, v - y, 1);
  const cut = (u, y, v) => pick(look.cut, u + y, v + y * 5, 2);
  const H = HILL[id];
  const geo = caveGeometry(id), CH = geo.chamber, F = CH.F;
  const routeAt = new Map(geo.route.map((r) => [r[2], r])); // v -> [u, floor, v, w]
  const floorAtV = (v) => (routeAt.get(v) ?? [0, 1])[1];
  const DEEP = CRACK_DEPTH + 1; // the crack's void runs this far back into the wall
  const COVER = 26; // far enough for the tallest chamber's cover to run out to the ground

  // 1. the hill: the outcrop, and always enough rock over every part of the cave (the chamber, the wall the crack
  // eats into, the covered part of the way in), two blocks thick and two blocks out to the sides
  const colTop = new Map();
  const mark = (u, v, y) => { const k = `${u},${v}`; colTop.set(k, Math.max(colTop.get(k) ?? -999, y)); };
  for (const k of geo.air) { const [u, y, v] = k.split(",").map(Number); if (v <= 0) mark(u, v, y); }
  for (let u = CH.uc - 4; u <= CH.uc + 4; u++) for (let v = CH.wallV - DEEP; v <= CH.wallV; v++) mark(u, v, F + geo.crackH);
  const need = new Map();
  // ...and that rock is a hill, not a box (Mateo 2026-11-12: "a big square rock on top"): full height for two
  // blocks out, then falling away about a block per block, so the land rises over the cave and runs out gently
  for (const [k, y] of colTop) {
    const [u, v] = k.split(",").map(Number);
    for (let du = -COVER; du <= COVER; du++) for (let dv = -COVER; dv <= COVER; dv++) {
      const d = Math.hypot(du, dv); if (d > COVER) continue;
      const h = y + 2 - Math.round(Math.max(0, d - 2) * 0.9 + (d > 2 ? 0.025 * d * d : 0));
      if (h < -8) continue;
      const kk = `${u + du},${v + dv}`;
      if (h > (need.get(kk) ?? -999)) need.set(kk, h);
    }
  }
  const heightOf = new Map();
  const consider = (u, v) => {
    // the cover stops at the cliff line like the outcrop does, so it never stands in front of the mouth
    // (the tall first legs at Frostvein Gap and the Sunken Quarry used to wall their own way in)
    let cover = need.get(`${u},${v}`) ?? 0;
    const cl = cliffLine(u);
    if (cover > 0 && v > cl) cover *= Math.max(0, 1 - (v - cl) / 2);
    const h = Math.max(hillHeight(id, u, v), cover);
    if (h < 1 || h <= ground(u, v)) return;
    heightOf.set(`${u},${v}`, Math.round(h));
  };
  for (let u = -H.rx - 6; u <= H.rx + 6; u++) for (let v = H.cv - H.rzN - 6; v <= H.cv + H.rzS + 6; v++) consider(u, v);
  for (const k of need.keys()) if (!heightOf.has(k)) { const [u, v] = k.split(",").map(Number); consider(u, v); }
  const face = FACE[id] ?? look.raw;
  const salt2 = SALT(id);
  const bed = (u, y, v) => face[Math.floor(Math.abs(y + 40 + Math.round(fbm(u * 0.15, v * 0.15, salt2) * 3)) / 2 + hash(Math.floor(u / 3), Math.floor(v / 3), 931) * 1.5) % face.length];
  const slopeOf = new Map();
  for (const [k, h] of heightOf) {
    const [u, v] = k.split(",").map(Number);
    const g = ground(u, v);
    let sl = 0;
    for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) sl = Math.max(sl, h - Math.max(heightOf.get(`${u + du},${v + dv}`) ?? 0, ground(u + du, v + dv)));
    slopeOf.set(k, sl);
    const rocky = sl >= 3 || (sl === 2 && hash(u, v, 933) < 0.7) || hash(Math.floor(u / 2), Math.floor(v / 2), 935) < 0.08;
    for (let y = Math.min(g + 1, F - 2); y <= h; y++) {
      if (y <= g && y < F - 2) continue;
      if (rocky) put(u, y, v, bed(u, y, v));
      else put(u, y, v, y === h ? look.top : y >= h - 2 && !/sand|stone/.test(look.top) ? "dirt" : bed(u, y, v));
    }
  }
  const hillAt = (u, v) => heightOf.get(`${u},${v}`) ?? 0;

  // 2. carve the cave, and where the way in meets higher ground outside, an open trench
  const carved = new Set();
  const carve = (u, y, v) => { put(u, y, v, "air"); carved.add(key(u, y, v)); };
  for (const k of geo.air) { const [u, y, v] = k.split(",").map(Number); carve(u, y, v); }
  for (const k of geo.wet) { const [u, y, v] = k.split(",").map(Number); put(u, y, v, "water", 1); carved.add(k); }
  const m0 = geo.route[0], mw = m0[3];
  for (let v = MOUTH_V + 1; v <= MOUTH_V + 24; v++) {
    let high = false;
    for (let u = -mw; u <= mw; u++) { const g = ground(u, v); if (g >= 1) { high = true; for (let y = 1; y <= g + 1; y++) carve(u, y, v); } }
    if (!high) break;
  }
  // footing: where the ground outside is lower than the way in, fill under it
  for (const [ru, fy, v, w] of geo.route) for (let u = ru - w - 1; u <= ru + w + 1; u++) for (let y = ground(u, v) + 1; y < fy; y++) if (!carved.has(key(u, y, v))) put(u, y, v, raw(u, y, v));
  for (let v = MOUTH_V + 1; v <= MOUTH_V + 24; v++) { if (!carved.has(key(0, 1, v))) continue; for (let u = -mw - 1; u <= mw + 1; u++) for (let y = ground(u, v) + 1; y < 1; y++) if (!carved.has(key(u, y, v))) put(u, y, v, raw(u, y, v)); }

  // 4. lining: every block touching the cave (underground, or inside the hill) is set, so the cave is sealed
  const inRock = (u, y, v) => y <= ground(u, v) || y <= hillAt(u, v);
  const lining = new Map();
  for (const k of carved) {
    const [u, y, v] = k.split(",").map(Number);
    for (const [du, dy, dv] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const n = key(u + du, y + dy, v + dv);
      if (carved.has(n) || !inRock(u + du, y + dy, v + dv)) continue;
      const c = cells.get(n);
      if (c && c.layer !== 0) continue;
      lining.set(n, [u + du, y + dy, v + dv, dy === -1]);
    }
  }
  for (const [, [u, y, v, isFloor]] of lining) {
    let block = worked ? (isFloor ? look.floor : cut(u, y, v)) : raw(u, y, v);
    if (salt && hash(u * 3 + y, v * 5 - y, 917) < (isFloor ? 0.6 : 0.45)) block = "calcite";
    if (roots && !isFloor && !(Math.abs(u - CH.uc) <= 3 && v <= CH.wallV + 4) && carved.has(key(u, y - 1, v)) && hash(u + y, v, 919) < 0.35 && at(u, y - 1, v)?.block === "air") block = "rooted_dirt";
    if (!salt && block === "calcite") block = "stone";
    if (y > 0 && y === hillAt(u, v)) block = at(u, y, v)?.block ?? look.top;
    put(u, y, v, block);
  }

  // 5. props along the way in: mine sets (two posts and a cap of stripped spruce) and passage-grave stones
  for (const [kind, u, fy, v, w, h] of geo.props) {
    if (kind === "set") {
      for (let y = fy; y < fy + h - 1; y++) for (const du of [-w, w]) put(u + du, y, v, "stripped_spruce_log", 2);
      for (let du = -w; du <= w; du++) put(u + du, fy + h - 1, v, "stripped_spruce_log", 2);
    } else {
      for (const du of [-w - 1, w + 1]) for (let y = fy; y < fy + h; y++) put(u + du, y, v, hash(u + du, y, v) < 0.5 ? "polished_andesite" : "andesite");
      for (let du = -w - 1; du <= w + 1; du++) put(u + du, fy + h, v, "andesite");
    }
  }
  //    worked: a framed mouth where the way in meets the hill, pillars in a hall
  if (worked) {
    const r = routeAt.get(1) ?? geo.route[0], [ru, fy, , w] = r, hT = 4;
    for (let y = fy - 1; y <= fy + hT; y++) for (const du of [-w - 1, w + 1]) put(ru + du, y, 1, look.pillar);
    for (let du = -w - 1; du <= w + 1; du++) put(ru + du, fy + hT, 1, look.pillar);
    if (CH.kind === "hall") for (const du of [-CH.rx + 2, CH.rx - 2]) for (const dv of [-CH.rz + 2, CH.rz - 2]) for (let y = F; y <= CH.top(CH.uc + du, CH.vc + dv); y++) put(CH.uc + du, y, CH.vc + dv, look.pillar);
  }

  // 6. cold: ice where the way in starts, snow outside and on the hill, icicles of ice down the shaft walls
  if (cold) {
    for (let v = 0; v <= MOUTH_V; v++) { const r = routeAt.get(v); if (!r) continue; for (let u = r[0] - r[3]; u <= r[0] + r[3]; u++) put(u, r[1] - 1, v, "packed_ice"); }
    for (let u = -14; u <= 14; u++) {
      for (let v = 0; v <= MOUTH_V + 14; v++) { const g = ground(u, v) + 1; if (!at(u, g, v) && !hillAt(u, v) && !carved.has(key(u, g, v)) && hash(u, v, 921) < 0.85) put(u, g, v, "snow_layer", 2); }
    }
    for (const [k, h] of heightOf) {
      const [u, v] = k.split(",").map(Number);
      if (!carved.has(key(u, h + 1, v)) && !carved.has(key(u, h, v))) put(u, h + 1, v, "snow_layer", 2);
    }
    for (const [, [u, y, v, isFloor]] of lining) if (!isFloor && CH.inside(u, v) === false && Math.abs(u - CH.uc) <= CH.rx + 1 && Math.abs(v - CH.vc) <= CH.rz + 1 && hash(u, y, v + 7) < 0.35) put(u, y, v, hash(u, y, v) < 0.5 ? "packed_ice" : "blue_ice");
  }

  // 7. roots hang from every rooted ceiling block
  if (roots) {
    for (const c of [...cells.values()]) if (c.block === "rooted_dirt" && at(c.u, c.y - 1, c.v)?.block === "air") put(c.u, c.y - 1, c.v, "hanging_roots", 2);
  }

  // 8. bell: green, cracked, fallen just inside the mouth
  if (bell) {
    const r = routeAt.get(2) ?? geo.route[0], [ru, fy, bv, w] = r;
    put(ru + w, fy, bv, "bell", 2, { attachment: "standing" });
    if (w >= 2) put(ru + w - 1, fy, bv, "oxidized_cut_copper_slab", 2); // never in the middle of a narrow way
    const r2 = routeAt.get(3); if (r2) put(r2[0] + r2[3], r2[1], 3, "oxidized_cut_copper_slab", 2);
  }

  // 9. every thin place hums: a few amethyst clusters on the chamber floor
  for (let i = 0; i < 6; i++) {
    const u = CH.uc + Math.round((hash(i, 3, 923) - 0.5) * (CH.rx * 2 - 2));
    const v = CH.vc + Math.round((hash(i, 7, 925) - 0.5) * (CH.rz * 2 - 2));
    if (Math.abs(u - CH.uc) <= 2 && v <= CH.wallV + 4) continue; // keep the seam clear
    if (at(u, F, v)?.block === "air" && at(u, F - 1, v)?.block !== "water") put(u, F, v, "amethyst_cluster", 2);
  }

  // 10. the seam (4 tall) in the back wall, with solid rock behind and around for the crack, full wall height
  for (let u = CH.uc - 4; u <= CH.uc + 4; u++) for (let v = CH.wallV - 4; v <= CH.wallV; v++) for (let y = F - 1; y <= F + geo.crackH; y++) {
    if (!carved.has(key(u, y, v))) put(u, y, v, y > 0 && y === hillAt(u, v) ? look.top : worked ? cut(u, y, v) : raw(u, y, v));
  }
  for (let y = F; y < F + 4; y++) put(CH.uc, y, CH.wallV, SEAM);

  // 10b. the outcrop's skin: boulders round its feet, plants and a few small trees on its gentle ground
  const grow = GROWTH[id];
  const free = (u, y, v) => !at(u, y, v) && !carved.has(key(u, y, v));
  for (let u = -H.rx - 6; u <= H.rx + 6; u++) for (let v = H.cv - H.rzN - 6; v <= H.cv + H.rzS + 6; v++) {
    if (Math.abs(u) <= mw + 2 && v >= -2 && v <= MOUTH_V + 4) continue;
    const k = `${u},${v}`, h = heightOf.get(k), g = ground(u, v);
    if (h === undefined) {
      if (hash(u, v, 941) < 0.012 && free(u, g + 1, v)) {
        const r = hash(u, v, 943) < 0.5 ? 1 : 2;
        for (let a = 0; a < r; a++) for (let b = 0; b < r; b++) { put(u + a, g + 1, v + b, bed(u + a, 3, v + b)); if (r === 2 && hash(a, b, 945) < 0.5) put(u + a, g + 2, v + b, bed(u + a, 5, v + b)); }
      }
      continue;
    }
    if ((slopeOf.get(k) ?? 9) > 1 || !free(u, h + 1, v) || at(u, h, v)?.block !== look.top) continue;
    if (grow.tree && hash(u, v, 947) < 0.012 && h >= 4) {
      const log = grow.tree === "spruce" ? "spruce_log" : grow.tree === "mangrove" ? "mangrove_log" : "oak_log";
      const leaf = grow.tree === "spruce" ? "spruce_leaves" : grow.tree === "mangrove" ? "mangrove_leaves" : "oak_leaves";
      const th = 3 + Math.floor(hash(u, v, 949) * 3);
      for (let y = 1; y <= th; y++) put(u, h + y, v, log, 2);
      for (let du = -2; du <= 2; du++) for (let dv = -2; dv <= 2; dv++) for (let dy = th - 1; dy <= th + 1; dy++) {
        const d = Math.abs(du) + Math.abs(dv) + Math.max(0, dy - th) * 2;
        if (d <= (dy === th + 1 ? 1 : 3) && !(du === 0 && dv === 0 && dy <= th) && hash(du + u, dv + v + dy, 951) < 0.9) put(u + du, h + dy, v + dv, leaf, 2);
      }
      continue;
    }
    let roll = hash(u, v, 953);
    for (const [plant, p] of grow.plants) { if (roll < p) { put(u, h + 1, v, plant, 2); break; } roll -= p; }
  }

  // 11. Fennick's camp
  // the camp finds the levellest open ground near the mouth (Mateo 2026-11-12: in the gorge it stood propped
  // up on a pillar); its pad sits at the middle height, filled below and cut back above
  const pad = (cu, cv) => { const hs = []; for (let u = cu - 3; u <= cu + 4; u++) for (let v = cv - 4; v <= cv + 3; v++) { if (hillAt(u, v) > ground(u, v) || carved.has(key(u, 1, v))) return null; hs.push(ground(u, v)); } hs.sort((a, b) => a - b); return { range: hs[hs.length - 1] - hs[0], mid: hs[hs.length >> 1] }; };
  let best = null;
  for (let cu0 = -18; cu0 <= 18; cu0++) for (let cv0 = MOUTH_V + 4; cv0 <= MOUTH_V + 18; cv0++) {
    if (cu0 > -8 && cu0 < 12) continue; // clear of the way out and the pool the stream makes
    const r = pad(cu0, cv0); if (!r) continue;
    const score = r.range * 4 + Math.hypot(cu0 - 10, cv0 - 13) * 0.3 + Math.abs(r.mid - 1) * 0.5;
    if (!best || score < best.score) best = { score, cu: cu0, cv: cv0, mid: r.mid };
  }
  const cu = best ? best.cu : SHAPE.camp.u, cv = best ? best.cv : SHAPE.camp.v;
  const cg = best ? best.mid : ground(cu, cv);
  for (let u = cu - 3; u <= cu + 4; u++) for (let v = cv - 4; v <= cv + 3; v++) {
    for (let y = ground(u, v) + 1; y <= cg; y++) put(u, y, v, y === cg ? look.top : raw(u, y, v));
    for (let y = cg + 1; y <= Math.max(cg + 3, ground(u, v) + 1); y++) put(u, y, v, "air");
    if (ground(u, v) > cg) put(u, cg, v, look.top);
  }
  const c1 = cg + 1;
  for (let v = cv - 2; v <= cv + 2; v++) { put(cu - 1, c1, v, "white_wool"); put(cu + 1, c1, v, "white_wool"); put(cu, c1 + 1, v, "white_wool"); }
  put(cu, c1, cv - 4, "campfire", 2, { extinguished: true });
  put(cu + 3, c1, cv - 3, "spruce_fence"); put(cu + 3, c1 + 1, cv - 3, "spruce_fence"); put(cu + 3, c1 + 2, cv - 3, "lantern", 2);

  const W = (u, y, v) => { const [dx, dz] = toWorld(u, v, facing); return { x: cx + dx, y: G + y, z: cz + dz }; };
  const ops = [...cells.values()]
    .sort((a, b) => a.layer - b.layer)
    .map((c) => ({ ...W(c.u, c.y, c.v), block: c.block.includes(":") ? c.block : `minecraft:${c.block}`, ...(c.states ? { states: c.states } : {}) }));
  return {
    ops,
    facing,
    seam: { ...W(CH.uc, F, CH.wallV), facing },
    tome: { ...W(cu, c1, cv), id: CAMP_TOME[id] },
    mouth: W(0, 1, MOUTH_V),
    camp: W(cu, c1, cv - 3),
    edges: (() => { const e = {}; for (const k of geo.air) { const [u, , v] = k.split(",").map(Number); e[v] = Math.max(e[v] ?? -99, u); } return e; })(),
    route: geo.route, chamber: { kind: CH.kind, uc: CH.uc, vc: CH.vc, rx: CH.rx, rz: CH.rz, F, wallV: CH.wallV }, crackH: geo.crackH,
  };
}

// ---------- in the world ----------

const SOFT = /leaves|grass(?!_block)|fern|flower|tulip|poppy|dandelion|bush|snow_layer|log|vine|sapling|mushroom|azalea|dead_bush|torch|reeds|sugar_cane|kelp|seagrass|lily/;
function groundY(dim, x, z) {
  let b;
  try { b = dim.getTopmostBlock({ x, z }); } catch { return undefined; }
  let y = b?.location?.y;
  if (y === undefined) return undefined;
  for (let i = 0; i < 40; i++) {
    const here = dim.getBlock({ x, y, z });
    if (!here) return undefined;
    if (!here.isAir && !here.isLiquid && !SOFT.test(here.typeId)) return y;
    y--;
  }
  return y;
}

function loaded(dim, site) {
  for (const [du, dv] of [[-REACH, -REACH], [REACH, -REACH], [-REACH, REACH], [REACH, REACH], [0, 0]]) {
    try { if (!dim.getBlock({ x: site.x + du, y: 64, z: site.z + dv })) return false; } catch { return false; }
  }
  return true;
}

const permCache = new Map();
function perm(op) {
  const k = op.block + JSON.stringify(op.states ?? {});
  if (!permCache.has(k)) {
    let p;
    try { p = BlockPermutation.resolve(op.block, op.states); } catch { try { p = BlockPermutation.resolve(op.block); } catch { p = undefined; } }
    permCache.set(k, p);
  }
  return permCache.get(k);
}

let busy = false;
const builtMap = () => load(K_BUILT, {});

export const REACH = 80; // how far from the build centre a thin place can reach, any facing

export function buildSite(site, by) {
  if (busy) return { ok: false, why: "another thin place is still being built" };
  const dim = world.getDimension(OVERWORLD);
  if (!loaded(dim, site)) return { ok: false, why: "not loaded yet (stand closer)" };
  const G = groundY(dim, site.x, site.z);
  if (G === undefined) return { ok: false, why: "could not find the ground" };
  busy = true;
  let failed = 0;
  system.runJob((function* () {
    // 1. read the real ground around it, a row at a time
    const heights = new Map();
    for (let dx = -REACH; dx <= REACH; dx++) {
      for (let dz = -REACH; dz <= REACH; dz++) {
        const y = groundY(dim, site.x + dx, site.z + dz);
        if (y !== undefined) heights.set(dx * 1000 + dz, y - G);
      }
      yield;
    }
    // 2. plan against it (falls back to the centre's height where a column could not be read)
    const plan = planThinPlace(site.id, site.x, site.z, G, { facing: site.facing, ground: (dx, dz) => heights.get(dx * 1000 + dz) ?? 0 });
    yield;
    // 3. place it
    let n = 0;
    for (const op of plan.ops) {
      try {
        const p = perm(op);
        if (p) dim.setBlockPermutation({ x: op.x, y: op.y, z: op.z }, p);
        else dim.setBlockType({ x: op.x, y: op.y, z: op.z }, op.block);
      } catch { failed++; }
      if (++n % PER_STEP === 0) yield;
    }
    try {
      if (failed > plan.ops.length * 0.02) throw new Error("too much unloaded");
      placeCache(dim.getBlock(plan.tome), plan.tome.id);
      recordSite(site.id, { ...plan.seam, h: plan.crackH });
      markPlace(site.id, plan.mouth);
      const built = builtMap();
      built[site.id] = true;
      save(K_BUILT, built);
      if (by) say(by, `§d${site.name} built (${plan.ops.length} blocks), mouth facing ${plan.facing}. Seam at ${plan.seam.x} ${plan.seam.y} ${plan.seam.z}.`);
    } catch {
      if (by) say(by, `§c${site.name}: part of it was not loaded (${failed} blocks missed). It will try again when someone comes near.`);
    }
    busy = false;
  })());
  return { ok: true };
}

// Every few seconds: when someone is near an unbuilt site, hold its ground loaded with a ticking area, then build.
const AREA = "hc_thin_site";
let holding; // site id with a ticking area up
export function thinTick() {
  if (busy) return;
  const dim = world.getDimension(OVERWORLD);
  if (holding && builtMap()[holding]) { runCmd(dim, `tickingarea remove ${AREA}`); holding = undefined; }
  const players = world.getAllPlayers().filter((p) => p.dimension.id === OVERWORLD);
  if (!players.length) return;
  const built = builtMap();
  const marked = getSites();
  for (const site of THIN_PLACES) {
    if (built[site.id] || marked[site.id]) continue;
    if (!players.some((p) => Math.hypot(p.location.x - site.x, p.location.z - site.z) < BUILD_NEAR)) continue;
    if (holding !== site.id) {
      runCmd(dim, `tickingarea remove ${AREA}`);
      runCmd(dim, `tickingarea add ${site.x - REACH} 0 ${site.z - REACH} ${site.x + REACH} 0 ${site.z + REACH} ${AREA} true`);
      holding = site.id;
    }
    buildSite(site); // waits quietly until the area has loaded
    return;
  }
}

export function thinCommand(id, player, message) {
  const arg = (message ?? "").trim();
  const site = THIN_PLACES.find((s) => s.id === arg);
  if (id === "hc:thin_status") {
    const built = builtMap(), marked = getSites();
    say(player, THIN_PLACES.map((s) => `§f${s.name}§7 (${s.id}) at ${s.x} ${s.z}: ${built[s.id] ? "§abuilt" : marked[s.id] ? "§emarked by hand" : "§cnot yet"}`).join("\n"));
    return;
  }
  if (!site) return say(player, `§cUse one of: ${THIN_PLACES.map((s) => s.id).join(", ")}`);
  if (id === "hc:thin_tp") {
    const dim = world.getDimension(OVERWORLD);
    const [dx, dz] = toWorld(0, MOUTH_V + 14, site.facing);
    const G = groundY(dim, site.x + dx, site.z + dz) ?? 100;
    player.teleport({ x: site.x + dx + 0.5, y: G + 2, z: site.z + dz + 0.5 }, { dimension: dim, facingLocation: { x: site.x, y: G + 4, z: site.z } });
    return say(player, `§d${site.name}. ${builtMap()[site.id] ? "" : "It builds itself in a moment."}`);
  }
  if (id === "hc:thin_build") {
    const r = buildSite(site, player);
    if (!r.ok) say(player, `§c${site.name}: ${r.why}`);
  }
}
