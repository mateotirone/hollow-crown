// The miniature map: the welcome hall is the real world map, scaled down, built in blocks in the sky over Gull Bay.
//
// One block of the miniature is MINI.scale x MINI.scale blocks of the real map (heights squeezed further), so the
// whole 2,500-block map is MINI.cells blocks across, centred on the hall's origin. The columns come from
// miniature_data.js, which tools/miniature.py makes from the world map (re-run it when the map is regenerated).
//
// Newcomers arrive on a stone quay out in the miniature's sea, where the Waystone stands. Every plot has a Map Stone
// on its real spot (scaled), on a pedestal of its region's stone; welcome.js turns the stones green / yellow / dark
// as plots are free / run by a lord / taken, and opens the plot's page when one is clicked.
//
// Heights, relative to the hall's origin y (the floor): the underside is at -1, the floor at 0, land rises from 1,
// and every pool of water (sea, rivers, lakes, fen pools) is at 1, so no water block ever has an open side and
// nothing flows off the edge. The rim wall and an unseen barrier fence go up to RIM_TOP.

import { MINIATURE as M } from "./miniature_data.js";
import { addTests, assert, assertEqual } from "../core/tests.js";

const ALPHA = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_";
export const MINI = { half: M.half, cells: M.cells, scale: M.scale, quay: M.quay };
export const RIM_TOP = 26; // the barrier fence round the rim reaches this far above the floor
export const MAP_MARKER = "siege:map_marker";
export const HALL_WAYSTONE = "siege:hall_waystone";
export const MARKER_STATE = "siege:status"; // 0 free, 1 run by a lord, 2 taken

// Block ids: the tool writes short names; most are "minecraft:" + name
const ID = {
  grass: "minecraft:grass_block",
  snow: "minecraft:snow",
};
// Under each surface, what the rest of the column is made of
const UNDER = {
  grass: "dirt", grass_path: "dirt", podzol: "dirt", moss_block: "dirt", mud: "dirt",
  sand: "sandstone", red_sand: "sandstone",
};
// Older or renamed ids: what to try if a block can't be placed
const FALLBACK = {
  "minecraft:red_sand": "minecraft:sand",
  "minecraft:grass_path": "minecraft:dirt",
  "minecraft:mossy_cobblestone_wall": "minecraft:cobblestone_wall",
  "minecraft:deepslate_brick_wall": "minecraft:cobblestone_wall",
  "minecraft:dark_oak_slab": "minecraft:stone_brick_slab",
  "minecraft:deepslate_tile_slab": "minecraft:stone_brick_slab",
  "minecraft:prismarine_brick_slab": "minecraft:stone_brick_slab",
  "minecraft:red_sandstone_slab": "minecraft:stone_brick_slab",
  "minecraft:mangrove_slab": "minecraft:stone_brick_slab",
  "minecraft:waxed_oxidized_copper": "minecraft:oxidized_copper",
};
export const blockId = (name) => ID[name] ?? `minecraft:${name}`;
export const fallbackOf = (id) => FALLBACK[id];
// Leaves would rot away in the sky without a trunk: they are set as placed by hand
export const statesOf = (id) => (/_leaves$/.test(id) ? { persistent_bit: true } : undefined);

const inside = (dx, dz) => Math.abs(dx) <= M.half && Math.abs(dz) <= M.half;

/** One column of the miniature, dx/dz from the middle: { h, surface, water, deco: [names, bottom up] } */
export function column(dx, dz) {
  if (!inside(dx, dz)) return undefined;
  const a = dx + M.half;
  const b = dz + M.half;
  const d = ALPHA.indexOf(M.d[b][a]);
  return {
    h: ALPHA.indexOf(M.h[b][a]),
    surface: M.surfaces[ALPHA.indexOf(M.s[b][a])],
    water: M.w[b][a] === "1",
    deco: d > 0 ? M.decos[d - 1].split("|") : [],
  };
}

/** Where a planned plot's Map Stone stands on the miniature: { dx, dz, h } (h = the ground under its pedestal). */
export function miniSpot(plan) {
  const known = M.plots.find((p) => p.name === plan.name);
  if (known) return { dx: known.dx, dz: known.dz, h: known.h };
  const dx = Math.round(plan.x / M.scale);
  const dz = Math.round(plan.z / M.scale);
  return { dx, dz, h: Math.max(1, column(dx, dz)?.h ?? 1) };
}

/** The real-map spot a miniature column stands for (its middle). */
export const realSpot = (dx, dz) => ({ x: dx * M.scale, z: dz * M.scale });

const inQuay = (dx, dz) => Math.abs(dx - M.quay.dx) <= M.quay.half && Math.abs(dz - M.quay.dz) <= M.quay.half;
/** The Waystone's column and height above the floor (it sits on a chiselled step on the quay). */
export const waystoneSpot = () => ({ dx: M.quay.dx, dz: M.quay.dz, dy: M.quay.h + 2 });
/** Where a newcomer is set down: on the quay, west of the Waystone, looking east over the map. */
export const arrivalOffset = () => ({ dx: M.quay.dx - 2, dz: M.quay.dz, dy: M.quay.h + 1 });

/**
 * Every block of the miniature (about 70,000), a few columns per step, for system.runJob. put(x, y, z, id, states) places a block.
 * All the solid blocks go down first and the water last, so no water is ever placed beside an unbuilt column.
 * markers: [{ dx, dz, h, pedestal }] for the Map Stones.
 */
export function* miniatureBlocks(put, o, markers = []) {
  const R = M.half + 1;
  const markerAt = new Map(markers.map((m) => [`${m.dx},${m.dz}`, m]));
  for (let dx = -R; dx <= R; dx++) {
    for (let dz = -R; dz <= R; dz++) {
      if (dz % 4 === 0) yield; // a handful of columns per step (each up to ~30 blocks), so no tick runs long
      const x = o.x + dx;
      const z = o.z + dz;
      put(x, o.y - 1, z, "minecraft:stone_bricks");
      if (!inside(dx, dz)) {
        // The rim: a stone wall a step above the land beside it, a low wall on top, an unseen fence above that
        const near = column(Math.max(-M.half, Math.min(M.half, dx)), Math.max(-M.half, Math.min(M.half, dz)));
        const top = Math.max(2, (near?.h ?? 1) + 1);
        for (let y = 0; y < top; y++) put(x, o.y + y, z, "minecraft:stone_bricks");
        put(x, o.y + top, z, "minecraft:stone_brick_wall");
        for (let y = top + 1; y <= RIM_TOP; y++) put(x, o.y + y, z, "minecraft:barrier");
        continue;
      }
      if (inQuay(dx, dz)) {
        for (let y = 0; y <= M.quay.h; y++) put(x, o.y + y, z, y === M.quay.h ? "minecraft:polished_andesite" : "minecraft:stone_bricks");
        const corner = Math.abs(dx - M.quay.dx) === M.quay.half && Math.abs(dz - M.quay.dz) === M.quay.half;
        if (corner) {
          put(x, o.y + M.quay.h + 1, z, "minecraft:stone_brick_wall");
          put(x, o.y + M.quay.h + 2, z, "minecraft:lantern");
        }
        continue;
      }
      const c = column(dx, dz);
      const surface = blockId(c.surface);
      const under = blockId(UNDER[c.surface] ?? "stone");
      put(x, o.y, z, c.h > 0 ? under : surface);
      for (let y = 1; y <= c.h; y++) put(x, o.y + y, z, y === c.h ? surface : under);
      const m = markerAt.get(`${dx},${dz}`);
      if (m) {
        put(x, o.y + c.h + 1, z, m.pedestal);
        put(x, o.y + c.h + 2, z, MAP_MARKER);
        continue;
      }
      c.deco.forEach((name, i) => put(x, o.y + c.h + 1 + i, z, blockId(name), statesOf(blockId(name))));
    }
  }
  // The Waystone on its step
  const w = waystoneSpot();
  put(o.x + w.dx, o.y + w.dy - 1, o.z + w.dz, "minecraft:chiseled_stone_bricks");
  put(o.x + w.dx, o.y + w.dy, o.z + w.dz, HALL_WAYSTONE);
  // Water last
  for (let dx = -M.half; dx <= M.half; dx++) {
    yield;
    for (let dz = -M.half; dz <= M.half; dz++) {
      if (!inQuay(dx, dz) && column(dx, dz).water) put(o.x + dx, o.y + 1, o.z + dz, "minecraft:water");
    }
  }
}

addTests("miniature", {
  "the miniature is odd-sized, square and every row is whole": () => {
    assertEqual(M.cells % 2, 1);
    assertEqual(M.cells, M.half * 2 + 1);
    for (const key of ["h", "s", "w", "d"]) {
      assertEqual(M[key].length, M.cells, `${key} rows`);
      for (const row of M[key]) assertEqual(row.length, M.cells, `${key} row length`);
    }
  },
  "no water block has an open side": () => {
    for (let dx = -M.half; dx <= M.half; dx++) {
      for (let dz = -M.half; dz <= M.half; dz++) {
        if (!column(dx, dz).water || inQuay(dx, dz)) continue;
        for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const n = column(dx + ax, dz + az);
          if (n && !n.water) assert(n.h >= 1, `water at ${dx},${dz} runs out sideways`);
        }
      }
    }
  },
  "the quay is out at sea and the arrival spot stands on it": () => {
    for (let dx = M.quay.dx - M.quay.half; dx <= M.quay.dx + M.quay.half; dx++) {
      for (let dz = M.quay.dz - M.quay.half; dz <= M.quay.dz + M.quay.half; dz++) assert(column(dx, dz).water, `quay over land at ${dx},${dz}`);
    }
    const a = arrivalOffset();
    assert(inQuay(a.dx, a.dz), "arrival is off the quay");
  },
  "everything fits under the build limit from y 280": () => {
    let top = RIM_TOP;
    for (let dx = -M.half; dx <= M.half; dx++) for (let dz = -M.half; dz <= M.half; dz++) {
      const c = column(dx, dz);
      top = Math.max(top, c.h + 2 + c.deco.length);
    }
    assert(280 + top < 320, `the miniature reaches y ${280 + top}`);
  },
});
