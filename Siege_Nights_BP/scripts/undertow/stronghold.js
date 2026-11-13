// The Needlehold (working name): the crooked city's stronghold, west of the Long Climb in the wood country
// beside a light river. Designed in map/structures/hollow_stronghold.py (the Citadel's way of building, the
// Hollow's own character: round, stupid tall, leaning needles, nothing matching; Mateo 2026-11-12) and exported
// by map/structures/export_stronghold.py into stronghold_data.js.
//
// It is about 200 blocks across and 300,000 blocks, far too big to stamp in one go (one layer alone spans
// thirteen chunks, more than a Realm keeps loaded), so builder.js stamps it in TILE x TILE columns, each one
// once its land is built and loaded, and remembers which are done. The terrain flattens its pad (roads.js
// SITES "stronghold") and lifts the roof over it (terrain.js tallThings).
// Pure maths, no Minecraft calls.

import { STRONGHOLD_DESIGN as D } from "./stronghold_data.js";

export const STRONGHOLD = {
  id: "stronghold",
  name: "The Needlehold",
  x: D.site.x, z: D.site.z, y: D.site.y,
  r: 104, // the ring road outside its moat reaches r 102
  top: D.site.y + D.box.y1, // the tallest needle's tip
  tile: 32,
  v: D.v,
  maxStamping: 2, // tiles going down at once
};

// The design cut into tile columns: [{ key, x0, z0, x1, z1 (world offsets, inclusive), design }]. Runs along x
// are split where they cross a tile edge. Empty tiles are left out. Worked out once, on first use.
let tiles;
export function strongholdTiles(d = D, size = STRONGHOLD.tile) {
  if (d === D && tiles) return tiles;
  const by = new Map();
  const tileOf = (tx, tz) => {
    const key = `${tx},${tz}`;
    let t = by.get(key);
    if (!t) by.set(key, (t = { key, x0: tx * size, z0: tz * size, x1: tx * size + size - 1, z1: tz * size + size - 1, design: { palette: d.palette, rows: [] } }));
    return t;
  };
  for (const [y, z, x0, n, pi] of d.rows) {
    const tz = Math.floor(z / size);
    let x = x0, left = n;
    while (left > 0) {
      const tx = Math.floor(x / size), edge = tx * size + size, take = Math.min(left, edge - x);
      tileOf(tx, tz).design.rows.push([y, z, x, take, pi]);
      x += take; left -= take;
    }
  }
  // Ground first: tiles nearest the gate (south, +z) and the middle go down first, so the way in is there soonest.
  const out = [...by.values()].sort((a, b) => (Math.hypot(a.x0 + size / 2, a.z0 + size / 2 - 90) - Math.hypot(b.x0 + size / 2, b.z0 + size / 2 - 90)));
  if (d === D) tiles = out;
  return out;
}

// The world box of a tile.
export function tileBox(t, s = STRONGHOLD) {
  return { x0: s.x + t.x0, z0: s.z + t.z0, x1: s.x + t.x1, z1: s.z + t.z1 };
}

// True once every tile of the current version is down in this world (saved pieces p).
export function strongholdDone(p) {
  return (p.strongholdV ?? 0) >= STRONGHOLD.v && (p.strongholdTiles ?? []).length >= strongholdTiles().length;
}

// ---- self-tests (the first one cuts the whole design, so it runs offline only: core/tests.js OFFLINE_ONLY) ----
import { addTests, assert } from "../core/tests.js";
addTests("undertow", {
  "the Needlehold: its tiles hold every block once, each inside its own tile, all inside its site": () => {
    const all = strongholdTiles();
    let n = 0, total = 0;
    for (const [, , , c] of D.rows) total += c;
    const keys = new Set();
    for (const t of all) {
      assert(!keys.has(t.key), `tile ${t.key} twice`); keys.add(t.key);
      for (const [, z, x0, c] of t.design.rows) {
        n += c;
        assert(x0 >= t.x0 && x0 + c - 1 <= t.x1 && z >= t.z0 && z <= t.z1, `a row leaves tile ${t.key}`);
        for (const x of [x0, x0 + c - 1]) assert(Math.hypot(x, z) <= STRONGHOLD.r + 2, `the Needlehold builds outside its site at ${x},${z}`);
      }
    }
    assert(n === total, `${n} of ${total} blocks in the tiles`);
    assert(STRONGHOLD.top < 190, "the tallest needle stays under the roof's lowest dip (196 less 6)");
  },
  "the Needlehold: a small design cuts into tiles at the edges, and a world knows when it is done": () => {
    const d = { palette: [["minecraft:stone", {}]], rows: [[0, 0, -3, 7, 0], [1, 5, 2, 1, 0]] };
    const t = strongholdTiles(d, 4);
    const cells = t.flatMap((x) => x.design.rows.map((r) => `${x.key}:${r[2]}+${r[3]}`)).sort();
    assert(JSON.stringify(cells) === JSON.stringify(["-1,0:-3+3", "0,0:0+4", "0,1:2+1"]), cells.join(" "));
    assert(!strongholdDone({}) && !strongholdDone({ strongholdV: STRONGHOLD.v, strongholdTiles: [] }));
  },
});
