// The seven thin places, built by script so the road to the Rift works on a freshly generated map.
//
// Each thin place (plots/config.js WARDS with thin: true and a lore `site` id) gets a low, wide hill of its own
// shape with a cave mouth facing south; the way in steps down into the ground to a tall chamber below ground
// level, with a Rift seam in the chamber's back wall. The cave is built to match
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
import { load, save, say } from "./data.js";
import { getSites, recordSite } from "./source.js";
import { SEAM, CRACK_HEIGHT } from "./rift.js";

const OVERWORLD = "minecraft:overworld";
const K_BUILT = "hc:thin_built"; // { siteId: true }
const BUILD_NEAR = 40;
const PER_STEP = 48; // blocks placed per runJob step

export const THIN_PLACES = WARDS.filter((w) => w.thin && w.site).map((w) => ({ id: w.site, name: w.name, x: w.x, z: w.z, r: w.r }));

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

// Fixed layout, in local coordinates: u = east, v = south (the mouth faces south), y above the ground block G.
// The cave goes DOWN into the ground under a low, wide hill: a sloping cut leads in from the south, steps drop
// DEPTH blocks, and the chamber sits below ground level so the hill only has to cover its roof.
export const SHAPE = {
  depth: 6, // chamber floor (first air layer) is at y = 1 - depth
  tunnel: { u: 2, v0: -7, v1: 6, h: 5, stepFrom: 3 }, // floor y 1 at v >= stepFrom, one lower per block north
  chamber: { u: 6, v0: -18, v1: -8, h: 17 },
  wallV: -19, // the back wall's face: the seam stands here and the crack eats 4 deeper (v -19 .. -23)
  camp: { u: 10, v: 13 },
};
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
export function hillHeight(id, u, v) {
  const H = HILL[id], { tunnel: T, chamber: C, depth } = SHAPE;
  const F = 1 - depth;
  const salt = id.length * 37;
  const rz = v > H.cv ? H.rzS : H.rzN;
  const wob = 1 + H.wobble * (fbm(u * 0.09, v * 0.09, salt) - 0.5) * 2;
  const d2 = ((u / H.rx) ** 2 + ((v - H.cv) / rz) ** 2) / wob;
  let h = d2 >= 1 ? 0 : H.peak * Math.pow(1 - d2, H.round);
  if (h > 0) h *= 1 + H.rough * (fbm(u * 0.21, v * 0.21, salt + 5) - 0.5) * 2;
  if (H.terrace && h > 0) h = Math.max(1, Math.round(h / H.terrace) * H.terrace);
  // enough rock over the cave: the chamber roof, the wall the crack eats into, the covered part of the way in
  if (Math.abs(u) <= C.u + 1 && v >= C.v0 - 1 && v <= C.v1 + 1) h = Math.max(h, F + C.h + 2);
  if (Math.abs(u) <= 5 && v >= SHAPE.wallV - 5 && v < C.v0) h = Math.max(h, F + CRACK_HEIGHT + 2);
  if (Math.abs(u) <= T.u + 1 && v >= T.v0 && v <= 0) h = Math.max(h, floorAt(v) + T.h + 1);
  return Math.round(h);
}
// First air layer of the way in at v (a step of one block per block north, down to the chamber floor).
export const floorAt = (v) => Math.max(1 - SHAPE.depth, Math.min(1, 1 - (SHAPE.tunnel.stepFrom - v)));

// Pure: every block for one site, given ground height G (the top solid block at the centre).
// Returns { ops: [{ x, y, z, block, states? }], seam: { x, y, z, facing }, tome: { x, y, z, id }, mouth: { x, y, z } }.
export function planThinPlace(id, cx, cz, G) {
  const f = SITE_FEATURES[id];
  const look = LOOK[id];
  if (!f || !look || !HILL[id]) throw new Error(`planThinPlace: unknown site ${id}`);
  const [water, bell, worked, cold, salt, roots] = f;
  const cells = new Map(); // "u,y,v" -> { block, states, layer }
  const key = (u, y, v) => `${u},${y},${v}`;
  const put = (u, y, v, block, layer = 0, states) => { cells.delete(key(u, y, v)); cells.set(key(u, y, v), { u, y, v, block, layer, states }); };
  const at = (u, y, v) => cells.get(key(u, y, v));
  const raw = (u, y, v) => pick(look.raw, u + y * 3, v - y, 1);
  const cut = (u, y, v) => pick(look.cut, u + y, v + y * 5, 2);
  const { tunnel: T, chamber: C, depth } = SHAPE;
  const F = 1 - depth;
  const H = HILL[id];

  // 1. the hill
  const heightOf = new Map();
  for (let u = -H.rx - 6; u <= H.rx + 6; u++) {
    for (let v = H.cv - H.rzN - 6; v <= H.cv + H.rzS + 6; v++) {
      const h = hillHeight(id, u, v);
      if (h < 1) continue;
      heightOf.set(`${u},${v}`, h);
      for (let y = 1; y <= h; y++) put(u, y, v, y === h ? look.top : raw(u, y, v));
    }
  }
  const hillAt = (u, v) => heightOf.get(`${u},${v}`) ?? 0;

  // 2. carve the way in (a cut, then steps down) and the chamber
  const carved = new Set();
  const carve = (u, y, v) => { put(u, y, v, "air"); carved.add(key(u, y, v)); };
  for (let v = T.v0; v <= T.v1; v++) for (let u = -T.u; u <= T.u; u++) for (let y = floorAt(v); y < floorAt(v) + T.h; y++) carve(u, y, v);
  const chamberTop = (u, v) => F + C.h - 1 - Math.round(3 * (u / C.u) ** 2) - Math.round(2 * ((v - (C.v0 + C.v1) / 2) / 5) ** 2);
  for (let u = -C.u; u <= C.u; u++) {
    for (let v = C.v0; v <= C.v1; v++) {
      if (Math.abs(u) === C.u && (v === C.v0 || v === C.v1)) continue; // round the corners
      for (let y = F; y <= chamberTop(u, v); y++) carve(u, y, v);
    }
  }

  // 3. water: at the foot of the steps the way dips into a sump you swim through
  const sump = { a: -4, b: -7 }; // open shafts; between them a fully drowned passage
  if (water) {
    for (let u = -T.u; u <= T.u; u++) {
      for (const v of [sump.a, sump.b]) for (let y = F - 5; y <= F - 1; y++) { put(u, y, v, "water", 1); carved.add(key(u, y, v)); }
      for (let v = sump.b + 1; v < sump.a; v++) {
        for (let y = F - 5; y <= F - 2; y++) { put(u, y, v, "water", 1); carved.add(key(u, y, v)); }
        for (let y = F - 1; y < F + T.h; y++) { put(u, y, v, raw(u, y, v)); carved.delete(key(u, y, v)); }
      }
    }
  }

  // 4. lining: every block touching the cave (underground, or inside the hill) is set, so the cave is sealed
  const inRock = (u, y, v) => y <= 0 || y <= hillAt(u, v);
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
    if (roots && !isFloor && carved.has(key(u, y - 1, v)) && hash(u + y, v, 919) < 0.35 && at(u, y - 1, v)?.block === "air") block = "rooted_dirt";
    if (!salt && block === "calcite") block = "stone"; // raw rock never looks like salt unless the site has salt
    if (y > 0 && y === hillAt(u, v)) block = look.top; // the hill's skin stays its skin
    put(u, y, v, block);
  }

  // 5. worked: a framed mouth where the way in meets the hill, and four pillars in the chamber
  if (worked) {
    const mv = 1, fy = floorAt(mv);
    for (let y = fy - 1; y <= fy + T.h; y++) for (const u of [-T.u - 1, T.u + 1]) put(u, y, mv, look.pillar);
    for (let u = -T.u - 1; u <= T.u + 1; u++) put(u, fy + T.h, mv, look.pillar);
    for (const u of [-C.u + 1, C.u - 1]) for (const v of [C.v0 + 1, C.v1 - 1]) for (let y = F; y <= F + 8; y++) put(u, y, v, look.pillar);
  }

  // 6. cold: ice where the way in starts, snow outside and on the hill
  if (cold) {
    for (let u = -T.u; u <= T.u; u++) for (let v = 0; v <= T.v1; v++) put(u, floorAt(v) - 1, v, "packed_ice");
    for (const u of [-T.u - 1, T.u + 1]) for (let v = 1; v <= 3; v++) if (inRock(u, floorAt(v), v)) put(u, floorAt(v), v, "ice");
    for (let u = -14; u <= 14; u++) {
      for (let v = 0; v <= T.v1 + 14; v++) if (!at(u, 1, v) && !hillAt(u, v) && hash(u, v, 921) < 0.85) put(u, 1, v, "snow_layer", 2);
    }
    for (const [k, h] of heightOf) {
      const [u, v] = k.split(",").map(Number);
      if (!carved.has(key(u, h + 1, v)) && !carved.has(key(u, h, v))) put(u, h + 1, v, "snow_layer", 2);
    }
  }

  // 7. roots hang from every rooted ceiling block
  if (roots) {
    for (const c of [...cells.values()]) if (c.block === "rooted_dirt" && at(c.u, c.y - 1, c.v)?.block === "air") put(c.u, c.y - 1, c.v, "hanging_roots", 2);
  }

  // 8. bell: green, cracked, fallen just inside the mouth
  if (bell) {
    const bv = 2;
    put(T.u, floorAt(bv), bv, "bell", 2, { attachment: "standing" });
    put(T.u - 1, floorAt(bv), bv, "oxidized_cut_copper_slab", 2);
    put(T.u, floorAt(bv + 1), bv + 1, "oxidized_cut_copper_slab", 2);
  }

  // 9. every thin place hums: a few amethyst clusters on the chamber floor
  for (let i = 0; i < 5; i++) {
    const u = Math.round((hash(i, 3, 923) - 0.5) * (C.u * 2 - 2));
    const v = C.v0 + 2 + Math.floor(hash(i, 7, 925) * (C.v1 - C.v0 - 3));
    if (Math.abs(u) <= 1 && v <= C.v0 + 3) continue; // keep the seam clear
    if (at(u, F, v)?.block === "air") put(u, F, v, "amethyst_cluster", 2);
  }

  // 10. the seam (4 tall) in the back wall, with solid rock behind and around for the crack
  for (let u = -4; u <= 4; u++) for (let v = SHAPE.wallV - 4; v <= SHAPE.wallV; v++) for (let y = F - 1; y <= F + CRACK_HEIGHT + 1; y++) {
    if (!carved.has(key(u, y, v))) put(u, y, v, y > 0 && y === hillAt(u, v) ? look.top : worked ? cut(u, y, v) : raw(u, y, v));
  }
  for (let y = F; y < F + 4; y++) put(0, y, SHAPE.wallV, SEAM);

  // 11. Fennick's camp
  const { u: cu, v: cv } = SHAPE.camp;
  for (let u = cu - 3; u <= cu + 4; u++) for (let v = cv - 4; v <= cv + 3; v++) for (let y = 1; y <= 3; y++) put(u, y, v, "air");
  for (let v = cv - 2; v <= cv + 2; v++) { put(cu - 1, 1, v, "white_wool"); put(cu + 1, 1, v, "white_wool"); put(cu, 2, v, "white_wool"); }
  put(cu, 1, cv - 4, "campfire", 2, { extinguished: true });
  put(cu + 3, 1, cv - 3, "spruce_fence"); put(cu + 3, 2, cv - 3, "spruce_fence"); put(cu + 3, 3, cv - 3, "lantern", 2);

  const ops = [...cells.values()]
    .sort((a, b) => a.layer - b.layer)
    .map((c) => ({ x: cx + c.u, y: G + c.y, z: cz + c.v, block: c.block.includes(":") ? c.block : `minecraft:${c.block}`, ...(c.states ? { states: c.states } : {}) }));
  return {
    ops,
    seam: { x: cx, y: G + F, z: cz + SHAPE.wallV, facing: "south" },
    tome: { x: cx + cu, y: G + 1, z: cz + cv, id: CAMP_TOME[id] },
    mouth: { x: cx, y: G + 1, z: cz + T.v1 },
    camp: { x: cx + cu, y: G + 1, z: cz + cv - 3 },
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
  for (const [du, dv] of [[-31, -40], [31, -40], [-31, 20], [31, 20], [0, 0]]) {
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

export function buildSite(site, by) {
  if (busy) return { ok: false, why: "another thin place is still being built" };
  const dim = world.getDimension(OVERWORLD);
  if (!loaded(dim, site)) return { ok: false, why: "not loaded yet (stand closer)" };
  const G = groundY(dim, site.x, site.z);
  if (G === undefined) return { ok: false, why: "could not find the ground" };
  const plan = planThinPlace(site.id, site.x, site.z, G);
  busy = true;
  let failed = 0;
  system.runJob((function* () {
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
      recordSite(site.id, plan.seam);
      markPlace(site.id, plan.mouth);
      const built = builtMap();
      built[site.id] = true;
      save(K_BUILT, built);
      if (by) say(by, `§d${site.name} built (${plan.ops.length} blocks). Seam at ${plan.seam.x} ${plan.seam.y} ${plan.seam.z}.`);
    } catch {
      if (by) say(by, `§c${site.name}: part of it was not loaded (${failed} blocks missed). It will try again when someone comes near.`);
    }
    busy = false;
  })());
  return { ok: true, plan };
}

// Every few seconds: build the first unbuilt site someone is standing near.
export function thinTick() {
  if (busy) return;
  const players = world.getAllPlayers().filter((p) => p.dimension.id === OVERWORLD);
  if (!players.length) return;
  const built = builtMap();
  const marked = getSites();
  for (const site of THIN_PLACES) {
    if (built[site.id] || marked[site.id]) continue;
    if (!players.some((p) => Math.hypot(p.location.x - site.x, p.location.z - site.z) < BUILD_NEAR)) continue;
    buildSite(site);
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
    const G = groundY(dim, site.x, site.z + SHAPE.camp.v) ?? 100;
    player.teleport({ x: site.x + 0.5, y: G + 2, z: site.z + SHAPE.camp.v + 6.5 }, { dimension: dim, facingLocation: { x: site.x, y: G + 4, z: site.z } });
    return say(player, `§d${site.name}. ${builtMap()[site.id] ? "" : "It builds itself in a moment."}`);
  }
  if (id === "hc:thin_build") {
    const r = buildSite(site, player);
    if (!r.ok) say(player, `§c${site.name}: ${r.why}`);
  }
}
