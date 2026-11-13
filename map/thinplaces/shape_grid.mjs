// Shape the land at one thin place, as grids (used by shape_cli.mjs for genworld.py, and by test_shapes.mjs).
// inp: { id, facing, rad, heights, water, keep, path }   square grids (2 * rad + 1) on a side, row-major [dx][dz],
//      centred on the site: the real ground (top solid block), the real water surface (-999 = none), how much
//      of the real land must stay (0..1: roads, rivers). path (optional): 1 on a road or trail, which keeps its own
//      surface wherever it stays dry.
// out: { floor, heights, water, mix, palette, blocks: [[dx, y, dz, palette index]], probes: [[dx, dz, y]], leaks, causeway, drowned }
//      heights / water are the new grids. blocks are the surface and face blocks and the set pieces, to be placed
//      after the terrain ("minecraft:air" digs). probes are up to five columns the game reads to tell that the land
//      was shaped. causeway counts path columns raised to cross water, drowned those still under it (must be 0). leaks counts dry columns that lay under the water next to them and were flooded (should be few).
import { shapeSite } from "./shape.mjs";
import { hash } from "../../Siege_Nights_BP/scripts/undertow/noise.js";

export function shapeGrid(inp) {
  const { id, facing, rad } = inp, N = 2 * rad + 1;
  const [ox, oz] = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] }[facing];
  const toW = (u, v) => [u * oz + v * ox, -u * ox + v * oz]; // local -> world offset (same as thinplaces.js toWorld)
  const toL = (dx, dz) => [dx * oz - dz * ox, dx * ox + dz * oz];
  const cl = (a) => Math.max(-rad, Math.min(rad, a));
  const at = (grid, dx, dz) => grid[(cl(dx) + rad) * N + cl(dz) + rad];
  const real = (u, v) => at(inp.heights, ...toW(u, v));
  const keep = (u, v) => at(inp.keep, ...toW(u, v));
  const S = shapeSite(id, real, keep);

  const H = new Int32Array(N * N), W = new Int32Array(N * N).fill(-999), MIX = new Float32Array(N * N);
  const idx = (dx, dz) => (dx + rad) * N + dz + rad;
  for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
    const [u, v] = toL(dx, dz), i = idx(dx, dz), m = S.mix(u, v);
    MIX[i] = m;
    const h = m > 0 ? S.h(u, v) : inp.heights[i];
    H[i] = h;
    const rw = inp.water[i], sw = m >= 0.5 ? S.water?.(u, v) : undefined;
    if (m >= 0.5) W[i] = sw !== undefined && sw > h ? sw : -999; // inside, the place decides where water lies
    else W[i] = rw > h ? rw : -999; // outside, the map's own water stays wherever the ground is still under it
  }
  // a road or trail that was dry before never ends up under a place's water: it crosses on a causeway, its top
  // level with the water (found by the trial map run 2026-11-12: trails drowned in the barrow ditch and the hollow)
  let causeway = 0;
  if (inp.path) for (let i = 0; i < N * N; i++) if (inp.path[i] && MIX[i] > 0 && W[i] > H[i] && !(inp.water[i] > inp.heights[i])) { H[i] = W[i]; W[i] = -999; causeway++; }
  // water never stands above dry ground beside it: flood any dry column lying under a neighbour's water
  let leaks = 0;
  for (let pass = 0; pass < 2 * N; pass++) {
    let changed = 0;
    for (let dx = -rad + 1; dx < rad; dx++) for (let dz = -rad + 1; dz < rad; dz++) {
      const i = idx(dx, dz);
      for (const j of [i + 1, i - 1, i + N, i - N]) if (MIX[i] > 0 && W[i] === -999 && W[j] > H[i]) { W[i] = W[j]; changed++; leaks++; break; }
    }
    if (!changed) break;
  }

  const palette = [], pidx = new Map();
  const DIRS = { "u+": toW(1, 0), "u-": toW(-1, 0), "v+": toW(0, 1), "v-": toW(0, -1) };
  const WEIRDO = { "1,0": 0, "-1,0": 1, "0,1": 2, "0,-1": 3 }; // the way a Bedrock stair climbs: east, west, south, north
  const RENAME = { terracotta: "hardened_clay", dead_bush: "deadbush", bricks: "brick_block" }; // Bedrock's own names
  function pal(name) {
    if (pidx.has(name)) return pidx.get(name);
    const [bare0, climb] = name.split(">"), bare = bare0.replace("^", "");
    const states = {};
    if (climb) { states.weirdo_direction = WEIRDO[DIRS[climb].join(",")]; states.upside_down_bit = false; }
    if (bare.endsWith("_leaves")) { states.persistent_bit = true; states.update_bit = false; }
    if (bare === "snow_layer") { states.height = 0; states.covered_bit = false; }
    if (bare.endsWith("_slab")) states["minecraft:vertical_half"] = bare0.endsWith("^") ? "top" : "bottom";
    palette.push({ name: "minecraft:" + (RENAME[bare] ?? bare), states });
    pidx.set(name, palette.length - 1);
    return palette.length - 1;
  }
  const blocks = [];
  for (let dx = -rad + 1; dx < rad; dx++) for (let dz = -rad + 1; dz < rad; dz++) {
    const i = idx(dx, dz), m = MIX[i];
    if (m <= 0 || m < hash(dx, dz, 7) * 0.999 || (inp.path?.[i] && W[i] === -999)) continue; // the place's own ground thins out into the map's, speckled
    const [u, v] = toL(dx, dz), h = H[i];
    const around = [H[i + 1], H[i - 1], H[i + N], H[i - N]];
    const lo = Math.min(h - 3, ...around), slope = Math.max(...around.map((a) => h - a));
    for (let y = lo; y <= h; y++) blocks.push([dx, y, dz, pal(S.top(u, y, v, h, slope))]);
  }
  for (const [u, y, v, b] of S.extras) {
    const [dx, dz] = toW(u, v);
    if (Math.abs(dx) >= rad || Math.abs(dz) >= rad || at(inp.keep, dx, dz) > 0.5) continue;
    blocks.push([dx, y, dz, pal(b)]);
  }

  // probes: where the shaped land stands furthest from the old land, spread round the place, away from kept ground
  const probes = [], cand = [], busy = new Set();
  for (const [u, , v] of S.extras) { const [dx, dz] = toW(u, v); if (Math.abs(dx) < rad && Math.abs(dz) < rad) busy.add(idx(dx, dz)); }
  for (let dx = -60; dx <= 60; dx += 2) for (let dz = -60; dz <= 60; dz += 2) {
    const i = idx(dx, dz), [u, v] = toL(dx, dz);
    if (MIX[i] < 0.999 || W[i] > -999 || busy.has(i) || (Math.abs(u) < 12 && v > 0 && v < 30)) continue; // bare ground, off the way in
    const flat = [H[i + 1], H[i - 1], H[i + N], H[i - N]].every((a) => Math.abs(a - H[i]) <= 1);
    if (flat) cand.push([Math.abs(H[i] - inp.heights[i]), dx, dz, H[i]]);
  }
  cand.sort((a, b) => b[0] - a[0]);
  // at least 4 blocks off the old land if five such columns can be found, else at least 2 (the game matches within 1)
  for (const least of [4, 2]) for (const [d, dx, dz, y] of cand) { if (d < least || probes.length >= 5) break; if (probes.every(([a, b]) => Math.hypot(a - dx, b - dz) >= 10)) probes.push([dx, dz, y]); }
  let drowned = 0;
  if (inp.path) for (let i = 0; i < N * N; i++) if (inp.path[i] && MIX[i] > 0 && W[i] > H[i] && !(inp.water[i] > inp.heights[i])) drowned++;
  return ({ causeway, drowned, floor: S.floor, heights: [...H], water: [...W], mix: [...MIX].map((m) => +m.toFixed(3)), palette, blocks, probes, leaks });
}
