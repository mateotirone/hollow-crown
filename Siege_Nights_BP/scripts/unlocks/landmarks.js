// Each boss unlock site's whole area (drawn by the world builds thread: map/structures/boss_areas.py, the ground
// shaped against the real map round the landmark). Each entry is a stamp in the "hollow-crown-stamp/1" format (Blueprint.save_json): offsets from the site's
// centre, which is the same centre the site's plan uses (plans.js; see spots.json from map/structures/boss_unlock_sites.py).
// The landmark is placed first and the site's own plan on top, so it can never cover a cell the boss code relies on.
// Keep a landmark within about 60 blocks of the centre: that is what the build's ticking area holds loaded.
//
//   e.g. a module landmarks/mother.js exporting the stamp, then LANDMARKS = { mother: thatStamp }

import { STAMPS } from "./landmark_stamps.js";

export const LANDMARKS = STAMPS;

// Big stamps (a whole boss area runs to 100k+ cells) carry their cells as columns instead of `blocks`:
// cols = { w, data: "x,z,y0:<symbols going up>;..." }, one symbol per cell (w = 2: two), "!" for a skipped cell
// (map/structures/boss_landmarks.py encode_cols).
const HEAD = /^-?\d+,-?\d+,-?\d+:/;
const ALPHA = Array.from({ length: 92 }, (_, k) => String.fromCharCode(35 + k)).filter((c) => c !== "\\").join("");
export function stampCells(stamp) {
  if (stamp?.blocks) return stamp.blocks;
  const c = stamp?.cols;
  if (!c?.data) return [];
  const out = [], w = c.w ?? 1, at = (ch) => ALPHA.indexOf(ch);
  // ";" is also one of the cell symbols (palette index 24), so a split on it can cut a column in two: glue any piece
  // that does not start with a column head back onto the one before it.
  const cols = [];
  for (const piece of c.data.split(";")) {
    if (cols.length && !HEAD.test(piece)) cols[cols.length - 1] += ";" + piece;
    else cols.push(piece);
  }
  for (const col of cols) {
    const k = col.indexOf(":");
    const [x, z, y0] = col.slice(0, k).split(",").map(Number);
    const run = col.slice(k + 1);
    for (let j = 0, y = y0; j < run.length; j += w, y++) {
      if (run[j] === "!") continue;
      out.push([x, y, z, w === 1 ? at(run[j]) : at(run[j]) * ALPHA.length + at(run[j + 1])]);
    }
  }
  return out;
}

/** A stamp as plan ops ({ dx, dy, dz, block, states }), with air last so it carves after it builds. */
export function stampOps(stamp) {
  const cells = stampCells(stamp);
  if (!cells.length) return [];
  const o = stamp.origin ?? [0, 0, 0];
  const ops = cells.map(([x, y, z, i]) => {
    const p = stamp.palette[i];
    return { dx: x + o[0], dy: y + o[1], dz: z + o[2], block: p.name, states: p.states && Object.keys(p.states).length ? p.states : undefined };
  }).filter((op) => op.block !== "minecraft:structure_void");
  return [...ops.filter((op) => op.block !== "minecraft:air"), ...ops.filter((op) => op.block === "minecraft:air")];
}
