// Stamps a building designed in map/structures (hollow_kit.py, exported as palette + rows) into the
// Hollow, a few blocks a tick through system.runJob so the Realm never stalls on a big site.
// The designs never turn: offsets are world offsets from the centre, y = 0 is the ground layer.
// stampCells() is pure (Node tests use it); stamp() touches the world.

import { system, BlockPermutation } from "@minecraft/server";
import { optionsFor } from "../townhall/designs.js";
import { frameFor, statesFor } from "../townhall/halls.js";

// a frame facing north makes the design's own compass the world's (design "n" is north, "e" is east)
const NORTH = frameFor({ x: 0, z: -1 });

// Every block of a design, bottom layer first: [x, y, z, palette index] as offsets.
export function stampCells(d) {
  const out = [];
  for (const [y, z, x0, n, i] of d.rows) for (let x = x0; x < x0 + n; x++) out.push([x, y, z, i]);
  return out.sort((a, b) => a[1] - b[1]);
}

// Bedrock state spellings to try for each palette entry, in order (the last is always {}).
export function stateTries(d) {
  return d.palette.map(([id, props]) => statesFor(NORTH, id, optionsFor(id, props) ?? {}));
}

function resolve(id, tries) {
  for (const s of tries) {
    try { return BlockPermutation.resolve(id, s); } catch { /* next spelling */ }
  }
  return undefined;
}

// Place design d with its (0, 0, 0) at origin. done(true) once every block is down; done(false) if the
// area stayed unloaded for about a minute (the caller tries the whole site again later).
export function stamp(dim, d, origin, done = () => {}) {
  const tries = stateTries(d);
  const perms = d.palette.map(([id], i) => resolve(id, tries[i]));
  const cells = stampCells(d);
  system.runJob((function* () {
    let misses = 0;
    for (let k = 0; k < cells.length; ) {
      const [x, y, z, i] = cells[k];
      try {
        if (perms[i]) dim.setBlockPermutation({ x: origin.x + x, y: origin.y + y, z: origin.z + z }, perms[i]);
        k++;
        misses = 0;
      } catch {
        if (++misses > 1200) { done(false); return; } // ~1 min of trying: give up for now
        const until = system.currentTick + 1;
        while (system.currentTick < until) yield; // wait a tick, then try the same block again
        continue;
      }
      yield;
    }
    done(true);
  })());
}
