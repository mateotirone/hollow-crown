// The seven thin places, built by script so the road to the Rift works on a freshly generated map.
//
// Each thin place (plots/config.js WARDS with thin: true and a lore `site` id) gets a rock outcrop with a cave
// mouth facing south, a tall chamber, and a Rift seam in the chamber's back wall. The cave is built to match
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
import { hash } from "./noise.js";
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

// Fixed shape, in local coordinates: u = east, v = south (the mouth faces south), y above the ground block G.
export const SHAPE = {
  mound: { cv: -12, rx: 15, rz: 16, peak: 28 },
  tunnel: { u: 2, v0: -7, v1: 4, h: 5 },
  chamber: { u: 6, v0: -18, v1: -8, h: 17 },
  wallV: -19, // the back wall's face: the seam stands here and the crack eats 4 deeper (v -19 .. -22)
  camp: { u: 10, v: 13 },
};

const pick = (list, a, b, c) => list[Math.floor(hash(a * 7 + c, b * 13 - c, 911) * list.length) % list.length];

// Pure: every block for one site, given ground height G (the top solid block at the centre).
// Returns { ops: [{ x, y, z, block, states? }], seam: { x, y, z, facing }, tome: { x, y, z, id }, mouth: { x, y, z } }.
export function planThinPlace(id, cx, cz, G) {
  const f = SITE_FEATURES[id];
  const look = LOOK[id];
  if (!f || !look) throw new Error(`planThinPlace: unknown site ${id}`);
  const [water, bell, worked, cold, salt, roots] = f;
  const cells = new Map(); // "u,y,v" -> { block, states, layer }
  const key = (u, y, v) => `${u},${y},${v}`;
  const put = (u, y, v, block, layer = 0, states) => { cells.delete(key(u, y, v)); cells.set(key(u, y, v), { u, y, v, block, layer, states }); };
  const at = (u, y, v) => cells.get(key(u, y, v));
  const raw = (u, y, v) => pick(look.raw, u + y * 3, v - y, 1);
  const cut = (u, y, v) => pick(look.cut, u + y, v + y * 5, 2);

  const { mound: M, tunnel: T, chamber: C } = SHAPE;
  const heightOf = new Map();
  // 1. the outcrop
  for (let u = -M.rx; u <= M.rx; u++) {
    for (let v = M.cv - M.rz; v <= M.cv + M.rz; v++) {
      const d2 = (u / M.rx) ** 2 + ((v - M.cv) / M.rz) ** 2;
      if (d2 >= 1) continue;
      const h = Math.round(M.peak * Math.sqrt(1 - d2) * (0.88 + 0.24 * hash(u, v, 913)));
      if (h < 1) continue;
      heightOf.set(`${u},${v}`, h);
      for (let y = -2; y <= h; y++) put(u, y, v, y === h ? look.top : raw(u, y, v));
    }
  }
  // a solid footing under the tunnel, so a flooded passage has walls and a bed
  if (water) for (let u = -T.u - 2; u <= T.u + 2; u++) for (let v = T.v0 - 2; v <= T.v1 - 1; v++) for (let y = -6; y <= 0; y++) put(u, y, v, raw(u, y, v));

  // 2. carve the tunnel and the chamber
  const carved = new Set();
  const carve = (u, y, v) => { put(u, y, v, "air"); carved.add(key(u, y, v)); };
  for (let u = -T.u; u <= T.u; u++) for (let v = T.v0; v <= T.v1; v++) for (let y = 1; y <= T.h; y++) carve(u, y, v);
  const chamberTop = (u, v) => C.h - Math.round(3 * (u / C.u) ** 2) - Math.round(2 * ((v - (C.v0 + C.v1) / 2) / 5) ** 2);
  for (let u = -C.u; u <= C.u; u++) {
    for (let v = C.v0; v <= C.v1; v++) {
      if (Math.abs(u) === C.u && (v === C.v0 || v === C.v1)) continue; // round the corners
      for (let y = 1; y <= chamberTop(u, v); y++) carve(u, y, v);
    }
  }

  // 3. water: a pool to dive into, a drowned passage, a shaft up into the chamber
  if (water) {
    for (let u = -T.u; u <= T.u; u++) {
      for (const v of [0, 1, -6, -7]) for (let y = -4; y <= 0; y++) { put(u, y, v, "water", 1); carved.add(key(u, y, v)); }
      for (let v = -5; v <= -1; v++) {
        for (let y = -4; y <= -1; y++) { put(u, y, v, "water", 1); carved.add(key(u, y, v)); }
        for (let y = 0; y <= T.h; y++) { put(u, y, v, raw(u, y, v)); carved.delete(key(u, y, v)); }
      }
    }
  }

  // 4. lining: the rock touching the cave
  const lining = [];
  for (const k of carved) {
    const [u, y, v] = k.split(",").map(Number);
    for (const [du, dy, dv] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const n = key(u + du, y + dy, v + dv);
      const c = cells.get(n);
      if (c && !carved.has(n) && c.layer === 0 && c.block !== "air") lining.push([u + du, y + dy, v + dv, dy === -1]);
    }
  }
  for (const [u, y, v, isFloor] of lining) {
    let block = worked ? (isFloor ? look.floor : cut(u, y, v)) : raw(u, y, v);
    if (salt && hash(u * 3 + y, v * 5 - y, 917) < (isFloor ? 0.6 : 0.45)) block = "calcite";
    if (roots && !isFloor && hash(u + y, v, 919) < 0.35 && !at(u, y - 1, v)?.layer && carved.has(key(u, y - 1, v))) block = "rooted_dirt";
    if (!worked && !salt && block === "calcite") block = "stone"; // raw rock never looks like salt unless the site has salt
    put(u, y, v, block);
  }
  // the floor of the dry way in and the chamber
  for (let u = -C.u; u <= C.u; u++) for (let v = C.v0; v <= C.v1; v++) if (carved.has(key(u, 1, v))) put(u, 0, v, worked ? look.floor : salt ? "calcite" : raw(u, 0, v));

  // 5. worked: a framed mouth and four pillars
  if (worked) {
    const mv = T.v1 - 1;
    for (let y = 0; y <= T.h + 1; y++) for (const u of [-T.u - 1, T.u + 1]) put(u, y, mv, look.pillar);
    for (let u = -T.u - 1; u <= T.u + 1; u++) put(u, T.h + 1, mv, look.pillar);
    for (const u of [-C.u + 1, C.u - 1]) for (const v of [C.v0 + 1, C.v1 - 1]) for (let y = 1; y <= 8; y++) put(u, y, v, look.pillar);
  }

  // 6. cold: ice at the mouth, snow outside
  if (cold) {
    for (let u = -T.u; u <= T.u; u++) for (let v = 0; v <= T.v1; v++) put(u, 0, v, "packed_ice");
    for (const u of [-T.u - 1, T.u + 1]) for (let y = 1; y <= 3; y++) put(u, y, T.v1 - 1, "ice");
    for (let u = -12; u <= 12; u++) {
      for (let v = T.v1 + 1; v <= T.v1 + 14; v++) if (!at(u, 1, v) && hash(u, v, 921) < 0.85) put(u, 1, v, "snow_layer", 2);
    }
    for (const [k, h] of heightOf) {
      const [u, v] = k.split(",").map(Number);
      if (!carved.has(key(u, h + 1, v)) && !carved.has(key(u, h, v))) put(u, h + 1, v, "snow_layer", 2);
    }
  }

  // 7. roots hang from every rooted ceiling block
  if (roots) {
    for (const c of [...cells.values()]) if (c.block === "rooted_dirt" && carved.has(key(c.u, c.y - 1, c.v)) && at(c.u, c.y - 1, c.v)?.block === "air") put(c.u, c.y - 1, c.v, "hanging_roots", 2);
  }

  // 8. bell: green, cracked, fallen near the mouth
  if (bell) {
    put(T.u, 1, T.v1 - 1, "bell", 2, { attachment: "standing" });
    put(T.u - 1, 1, T.v1 - 1, "oxidized_cut_copper_slab", 2);
    put(T.u, 1, T.v1 - 2, "oxidized_cut_copper_slab", 2);
  }

  // 9. every thin place hums: a few amethyst clusters on the chamber floor
  for (let i = 0; i < 5; i++) {
    const u = Math.round((hash(i, 3, 923) - 0.5) * (C.u * 2 - 2));
    const v = C.v0 + 2 + Math.floor(hash(i, 7, 925) * (C.v1 - C.v0 - 3));
    if (Math.abs(u) <= 1 && v <= C.v0 + 3) continue; // keep the seam clear
    if (at(u, 1, v)?.block === "air") put(u, 1, v, "amethyst_cluster", 2);
  }

  // 10. the seam (4 tall) in the back wall, with solid rock behind and around for the crack
  for (let u = -4; u <= 4; u++) for (let v = SHAPE.wallV - 4; v <= SHAPE.wallV; v++) for (let y = 0; y <= CRACK_HEIGHT + 1; y++) {
    if (!carved.has(key(u, y, v))) put(u, y, v, worked ? cut(u, y, v) : raw(u, y, v));
  }
  for (let y = 1; y <= 4; y++) put(0, y, SHAPE.wallV, SEAM);

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
    seam: { x: cx, y: G + 1, z: cz + SHAPE.wallV, facing: "south" },
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
  for (const [du, dv] of [[-17, -30], [17, -30], [-17, 18], [17, 18], [0, 0]]) {
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
