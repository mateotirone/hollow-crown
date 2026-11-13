// The seep: once the Rift is open, the Hollow grows out of it into our world.
//
// It spreads as VEINS, not patches (Mateo 2026-11-12: "like they're scars ... all connected and they're reaching
// out"): a handful of trunks leave the cave mouth, wander, and branch, each branch thinner and shorter than the
// one it left. Inside the cave a smaller set runs from the crack across the chamber floor. A vein turns the ground
// under it to Veilmoss (Deep Veilmoss near the mouth).
//
// It never stops while the Rift is open (Mateo 2026-11-12: "if the rift is open, it should keep spreading"):
// nothing for the first week, about 16 blocks by day 14, 30 by day 21, 48 by day 28, then two blocks a day, out to
// MAX_REACH blocks from the mouth.
//
// Where a vein reaches a building out in the wild, the building turns to the Hollow's own blocks
// (regions/hollow.md): stone to Veinstone brick, plaster and plank to Pale Ash, timber to dark oak, lanterns to
// soul lanterns, glass gone. It stops at town walls and claimed plots: wards and held plots are never touched.
//
// planVeins() and the rules below are pure. The runtime only works where chunks are loaded (near players), a few
// blocks at a time, and is safe to repeat: a cell already turned is skipped.
//
// Commands (creative/op):
//   /scriptevent hc:seep_status         days open, reach, cells in the plan
//   /scriptevent hc:seep_days <n>       pretend the Rift has been open n days (0 clears it)

import { world } from "@minecraft/server";
import { WARDS, MAP } from "../plots/config.js";
import { allPlots, holderOf } from "../plots/claims.js";
import { markedPlaces } from "../lore/ledger.js";
import { hash } from "./noise.js";
import { load, save, say, FACING } from "./data.js";
import { getRift } from "./source.js";

const OVERWORLD = "minecraft:overworld";
export const MOSS = "siege:undertow_moss";
export const MOSS_DEEP = "siege:undertow_moss_deep";
const K_SEEP = "hc:seep"; // { fakeDays } (builders only)

// How far along the veins the seep has reached after `days` open. Never stops growing.
export function reachOn(days) {
  if (days < 7) return 0;
  if (days <= 14) return Math.round(((days - 7) * 16) / 7);
  if (days <= 21) return 16 + (days - 14) * 2;
  if (days <= 28) return 30 + Math.round(((days - 21) * 18) / 7);
  return 48 + (days - 28) * 2;
}
export const MAX_REACH = 640; // a quarter of the map: past this it has nowhere wild left worth taking
const BRANCH = [0, 26, 14, 8]; // how long a branch runs, by how many times the vein has forked

// Pure: the vein plan out to `reach`, as a Map "dx,dz" -> distance along the vein from its source.
// seeds: [[x, z, angle]]; ok(x, z) lets the caller keep veins off places (the way in). A longer plan only adds to a
// shorter one: the cells within the shorter reach are the same, so the veins never move as they grow.
export function planVeins(seeds, reach, salt, ok = () => true) {
  const got = new Map();
  const grow = (x, z, ang, n, d0, depth) => {
    let fx = x, fz = z, turns = 0;
    for (let i = 0; i < n; i++) {
      ang += (hash(Math.round(fx * 7) + i, Math.round(fz * 7) + depth, salt) - 0.5) * 0.7;
      const nx = fx + Math.cos(ang), nz = fz + Math.sin(ang), cx = Math.round(nx), cz = Math.round(nz);
      if (!ok(cx, cz)) { ang += (hash(cx, cz, salt + 1) < 0.5 ? 1 : -1) * 1.2; if (++turns > 8) return; continue; }
      fx = nx; fz = nz;
      const d = d0 + i, k = `${cx},${cz}`;
      if (!got.has(k) || got.get(k) > d) got.set(k, d);
      if (d < 12 && hash(cx, cz, salt + 2) < 0.5) { // the trunks are two wide near the source
        const sx = cx + (hash(cx, cz, salt + 3) < 0.5 ? 1 : 0), sz = cz + (hash(cx, cz, salt + 3) < 0.5 ? 0 : 1);
        if (ok(sx, sz) && !(got.get(`${sx},${sz}`) <= d)) got.set(`${sx},${sz}`, d);
      }
      if (depth < 3 && hash(cx, cz + i, salt + 4) < 0.07) {
        grow(fx, fz, ang + (hash(i, depth, salt + 5) < 0.5 ? 1 : -1) * (0.5 + hash(cx, i, salt + 6) * 0.7), BRANCH[depth + 1], d, depth + 1);
      }
    }
  };
  for (const [x, z, ang] of seeds) grow(x, z, ang, reach, 0, 0);
  return got;
}

// The trunks that leave a mouth facing `facing`: nine fanned out in front, two curling back over the hill.
export function mouthSeeds(facing) {
  const [fx, fz] = FACING[facing] ?? FACING.south;
  const out = Math.atan2(fz, fx);
  const seeds = [];
  for (let i = 0; i < 9; i++) seeds.push([fx, fz, out + (i - 4) * 0.42 + (hash(i, 3, 600) - 0.5) * 0.3]);
  seeds.push([-fx * 2, -fz * 2, out + Math.PI * 0.75], [-fx * 2, -fz * 2, out - Math.PI * 0.75]);
  return seeds;
}

// Ground the seep may take: natural blocks only.
const NATURAL = /^minecraft:(grass_block|dirt|coarse_dirt|podzol|mycelium|moss_block|mud|packed_mud|sand|red_sand|gravel|snow|snow_block|stone|andesite|diorite|granite|tuff|calcite|sandstone|red_sandstone|terracotta|\w+_terracotta|clay|rooted_dirt|dirt_path|farmland|mossy_cobblestone|deepslate|cobbled_deepslate|ice|packed_ice)$/;
export const takesMoss = (id) => NATURAL.test(id);
const SKIP_UP = /leaves|_log$|short_grass|tall_grass|fern|flower|snow_layer|vine|bush|sapling|mushroom|water|air$|siege:(veilcap|rift_|glimmerflow)/;
export const seeThrough = (id) => SKIP_UP.test(id);

// What a building block turns into when a vein reaches it; undefined = left alone. "minecraft:air" = it goes.
export function hollowOf(id, x = 0, y = 0, z = 0) {
  if (!id || id.startsWith("siege:")) return undefined;
  const n = id.replace("minecraft:", "");
  if (/chest|barrel|bed$|door|trapdoor|sign|banner|bell|anvil|furnace|table|shulker|hopper|rail/.test(n)) return undefined; // things people use stay
  if (/glass/.test(n)) return "minecraft:air";
  if (/^(lantern|torch|wall_torch)$/.test(n)) return "minecraft:soul_lantern";
  const wood = /oak|spruce|birch|acacia|mangrove|jungle|cherry|bamboo|warped|crimson|pale_oak/.test(n) && !/dark_oak/.test(n);
  if (/(_log|_wood|_stem|_hyphae)$/.test(n)) return /dark_oak/.test(n) ? undefined : "minecraft:dark_oak_log";
  if (/_fence$/.test(n)) return wood ? "minecraft:dark_oak_fence" : undefined;
  if (/_stairs$/.test(n)) return wood ? "minecraft:dark_oak_stairs" : /dark_oak|blackstone/.test(n) ? undefined : "minecraft:polished_blackstone_brick_stairs";
  if (/_slab$/.test(n)) return wood ? "minecraft:dark_oak_slab" : /dark_oak|blackstone/.test(n) ? undefined : "minecraft:polished_blackstone_brick_slab";
  if (/_wall$/.test(n)) return /blackstone/.test(n) ? undefined : "minecraft:polished_blackstone_brick_wall";
  if (/planks$|_wool$|_concrete$|^mud_bricks$|^white_terracotta$|^smooth_quartz$|^quartz_block$/.test(n)) return "siege:pale_ash";
  if (/^(cobblestone|mossy_cobblestone|cobbled_deepslate)$/.test(n)) return undefined; // foundations stay rough stone
  if (/bricks?$|^smooth_sandstone$|^cut_sandstone$|^chiseled_/.test(n)) return hash(x + y * 3, z - y, 7) < 0.85 ? "siege:veinstone_bricks" : "siege:cracked_veinstone_bricks";
  return undefined;
}

// Town walls and claimed plots hold the seep (wards other than the thin places themselves; plots somebody holds).
export function heldGround(x, z, plots = heldPlots()) {
  for (const w of WARDS) if (!w.thin && Math.hypot(x - w.x, z - w.z) <= w.r) return true;
  for (const p of plots) if (Math.hypot(x - (p.x + 0.5), z - (p.z + 0.5)) <= MAP.plotRadius) return true;
  return false;
}
function heldPlots() {
  try { return allPlots().filter((p) => holderOf(p)); } catch { return []; }
}

// ---- runtime --------------------------------------------------------------------------------
let plan; // { key, outer: Map, inner: Map, mouth, seam, facing }
function currentPlan(rift, reach) {
  const far = Math.min(MAX_REACH, Math.max(64, Math.ceil((reach + 1) / 64) * 64)); // worked out a stretch at a time
  const key = `${rift.site}:${rift.x},${rift.y},${rift.z}:${far}`;
  if (plan?.key === key) return plan;
  const [fx, fz] = FACING[rift.facing] ?? FACING.south;
  const m = markedPlaces()[rift.site];
  const mouth = m ? { x: m.x, z: m.z } : { x: rift.x + fx * 26, z: rift.z + fz * 26 };
  const salt = Math.abs((rift.x * 31 + rift.z * 17) % 9973);
  // keep off the way in: a strip three wide from the seam out past the mouth
  const onWay = (dx, dz) => { const along = dx * fx + dz * fz, side = Math.abs(dx * -fz + dz * fx); return side <= 3 && along <= 1 && along >= -40; };
  const outer = planVeins(mouthSeeds(rift.facing), far, 601 + salt, (dx, dz) => !onWay(dx, dz));
  const out = Math.atan2(fz, fx);
  const inner = planVeins([0, 1, 2, 3, 4].map((i) => [fx, fz, out + (i - 2) * 0.55]), 24, 501 + salt, (dx, dz) => !(dx * -fz + dz * fx === 0));
  plan = { key, outer, inner, mouth, seam: { x: rift.x, y: rift.y, z: rift.z }, facing: rift.facing, byCell: undefined };
  return plan;
}

export function daysOpen(rift, today) {
  const fake = load(K_SEEP, {}).fakeDays;
  if (fake) return fake;
  return Math.max(0, (today ?? 0) - (rift?.day ?? today ?? 0));
}

const PER_TICK = 20; // cells tried per pass
const NEAR = 56; // only round players, where the world is loaded
let turnAt = 0;

export function seepTick() {
  const rift = getRift();
  if (!rift?.open) return;
  const days = daysOpen(rift, world.getDay?.() ?? 0);
  const dim = world.getDimension(OVERWORLD);
  const players = world.getAllPlayers().filter((p) => p.dimension.id === OVERWORLD);
  if (!players.length) return;
  const reach = Math.min(MAX_REACH, reachOn(days));
  const P = currentPlan(rift, reach);
  // inside the cave: across the chamber floor from the crack, from the first day
  if (days >= 1 && players.some((p) => Math.hypot(p.location.x - P.seam.x, p.location.z - P.seam.z) < 40)) {
    const cells = [...P.inner].filter(([, d]) => d <= (days >= 3 ? 24 : 5));
    for (let i = 0; i < 6 && cells.length; i++) {
      const [k, d] = cells[(turnAt + i * 7) % cells.length], [dx, dz] = k.split(",").map(Number);
      try {
        const floor = dim.getBlock({ x: P.seam.x + dx, y: P.seam.y - 1, z: P.seam.z + dz }), over = dim.getBlock({ x: P.seam.x + dx, y: P.seam.y, z: P.seam.z + dz });
        if (floor && over?.isAir && !floor.isAir && !floor.isLiquid && !floor.typeId.startsWith("siege:")) floor.setType(d < 4 ? MOSS_DEEP : MOSS);
      } catch {}
    }
  }
  if (reach <= 0) { turnAt++; return; }
  const plots = heldPlots();
  for (const p of players) {
    const px = Math.floor(p.location.x) - P.mouth.x, pz = Math.floor(p.location.z) - P.mouth.z;
    if (Math.hypot(px, pz) > reach + NEAR) continue;
    for (let i = 0; i < PER_TICK; i++) {
      // look at a cell near the player; most are not on a vein, which is cheap to find out
      const dx = px + Math.round((hash(turnAt, i, 811) - 0.5) * 2 * NEAR), dz = pz + Math.round((hash(i, turnAt, 813) - 0.5) * 2 * NEAR);
      const d = nearestVein(P.outer, dx, dz);
      if (d === undefined || d.d > reach) continue;
      turnCell(dim, P.mouth.x + d.x, P.mouth.z + d.z, d.d, plots);
    }
  }
  turnAt++;
}

// The vein cell at or beside (dx, dz), so a random look lands on a vein about one time in three.
function nearestVein(veins, dx, dz) {
  for (const [a, b] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
    const d = veins.get(`${dx + a},${dz + b}`);
    if (d !== undefined) return { x: dx + a, z: dz + b, d };
  }
  return undefined;
}

function turnCell(dim, x, z, d, plots) {
  if (heldGround(x, z, plots)) return;
  try {
    let b = dim.getTopmostBlock({ x, z });
    for (let i = 0; b && i < 24 && seeThrough(b.typeId); i++) b = b.below();
    if (!b) return;
    if (takesMoss(b.typeId)) { b.setType(d < 10 ? MOSS_DEEP : MOSS); return; }
    // a building in the wild: turn what stands here, this column and the ones beside it, a few blocks at a time
    if (hollowOf(b.typeId) === undefined) return;
    for (const [a, c] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      let t = dim.getTopmostBlock({ x: x + a, z: z + c });
      for (let i = 0; t && i < 14; i++, t = t.below()) {
        const to = hollowOf(t.typeId, t.location.x, t.location.y, t.location.z);
        if (to) t.setType(to);
        else if (takesMoss(t.typeId)) break;
      }
    }
  } catch {}
}

export function seepCommand(id, player, message) {
  const rift = getRift();
  if (id === "hc:seep_days") {
    const n = Math.max(0, Math.floor(Number(message) || 0));
    const s = load(K_SEEP, {});
    if (n) s.fakeDays = n; else delete s.fakeDays;
    save(K_SEEP, s);
    return say(player, n ? `§dThe seep now behaves as if the Rift had been open ${n} days (reach ${reachOn(n)} blocks).` : "§dThe seep is back on the real count of days.");
  }
  if (!rift?.open) return say(player, "§7The Rift is not open, so nothing seeps.");
  const days = daysOpen(rift, world.getDay?.() ?? 0), P = currentPlan(rift, reachOn(days));
  say(player, `§dOpen ${days} days. Reach ${reachOn(days)} blocks along the veins from ${P.mouth.x} ${P.mouth.z}. ${[...P.outer.values()].filter((d) => d <= reachOn(days)).length} vein cells in reach.`);
}
