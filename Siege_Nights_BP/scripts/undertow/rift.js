// The Rift: a huge jagged crack torn into a cave wall. Used twice: at the Source site on land
// (the way in) and at the Wound in the Undertow (the way back).
//
// planCrack() is pure and returns the blocks to place, so it can be tested in Node.

import { system } from "@minecraft/server";
import { FACING } from "./data.js";
import { hash } from "./terrain.js";
import { sfx } from "../core/sfx.js";

export const SEAM = "siege:rift_seam";
export const EDGE = "siege:rift_edge";
export const VEIL = "siege:rift_veil";
export const CRACK_HEIGHT = 14;

// bottom = the wall block at floor level where the seam is; facing = which way the wall's face points.
// Returns [{ x, y, z, block, row }] (row lets the opening animate from the middle outward).
export function planCrack(bottom, facing) {
  const [fx, fz] = FACING[facing] ?? FACING.south;
  const ux = -fz, uz = fx; // sideways along the wall
  const cells = [];
  const at = (u, row, depth, block, side = 0) => {
    const x = bottom.x + ux * u - fx * depth;
    const z = bottom.z + uz * u - fz * depth;
    cells.push({ x, y: bottom.y + row, z, block, row, side });
  };
  const salt = bottom.x * 31 + bottom.z * 17;
  for (let row = -1; row <= CRACK_HEIGHT; row++) {
    if (row < 0 || row === CRACK_HEIGHT) {
      for (let depth = 0; depth <= 3; depth++) at(0, row, depth, EDGE);
      continue;
    }
    const swell = Math.sin((Math.PI * (row + 0.5)) / CRACK_HEIGHT); // widest in the middle
    const jag = hash(row, salt, 201) < 0.5 ? 0 : 1;
    const half = Math.max(0, Math.round(swell * 2.4) - (row % 3 === 0 ? 0 : jag));
    const shift = Math.round(Math.sin(row * 0.9 + salt) * 1.2);
    for (let u = shift - half; u <= shift + half; u++) {
      const side = Math.abs(u - shift);
      at(u, row, 0, "minecraft:air", side);
      at(u, row, 1, VEIL, side);
      at(u, row, 2, VEIL, side);
      at(u, row, 3, EDGE, side);
    }
    for (const u of [shift - half - 1, shift + half + 1]) for (let depth = 0; depth <= 3; depth++) at(u, row, depth, EDGE, half + 1);
  }
  return cells;
}

export function planSeam(bottom) {
  const cells = [];
  for (let row = 0; row < 4; row++) cells.push({ x: bottom.x, y: bottom.y + row, z: bottom.z, block: SEAM, row });
  return cells;
}

function place(dim, c) {
  try {
    dim.setBlockType({ x: c.x, y: c.y, z: c.z }, c.block);
    return true;
  } catch {
    return false;
  }
}

// Place cells now. Returns false if any part of it was in an unloaded chunk.
export function placeCells(dim, cells) {
  let ok = true;
  for (const c of cells) ok = place(dim, c) && ok;
  return ok;
}

// The order the crack opens in (Mateo, 2026-11-11): a thin split runs UP from the seam at the floor to the top,
// then it pulls apart sideways. Returns the burst (0 .. TEAR_STEPS) a cell from planCrack appears in.
export const TEAR_CLIMB = 6; // bursts for the split to climb
export const TEAR_STEPS = TEAR_CLIMB + 2; // last burst index (at most 2 open blocks either side of the line, then the rim)
export function tearBand(c) {
  if (!c.side) return Math.min(TEAR_CLIMB - 1, Math.floor(((c.row + 1) * TEAR_CLIMB) / (CRACK_HEIGHT + 2)));
  return Math.min(TEAR_STEPS, TEAR_CLIMB - 1 + c.side);
}

// Tear the crack open over about 6 seconds, bottom to top and then outward, with sound and shake.
export function tearOpen(dim, bottom, facing, onDone) {
  const cells = planCrack(bottom, facing);
  const mid = CRACK_HEIGHT / 2;
  const center = { x: bottom.x + 0.5, y: bottom.y + mid, z: bottom.z + 0.5 };
  // one recording for the whole tear once it is installed; until then each burst cracks on its own
  const recorded = sfx(dim, "sig.rift_open", center, { volume: 4 });
  for (let s = 0; s <= TEAR_STEPS; s++) {
    const climbing = s < TEAR_CLIMB;
    system.runTimeout(() => {
      const band = cells.filter((c) => tearBand(c) === s);
      placeCells(dim, band);
      const where = climbing ? { x: center.x, y: bottom.y + ((s + 0.5) * (CRACK_HEIGHT + 1)) / TEAR_CLIMB, z: center.z } : center;
      try {
        if (!recorded) sfx(dim, climbing ? "block.bell.hit" : "random.explode", where, { volume: 1.5, pitch: climbing ? 0.4 + s * 0.06 : 0.5 });
        dim.spawnParticle(climbing ? "minecraft:critical_hit_emitter" : "minecraft:huge_explosion_emitter", where);
      } catch {}
      try {
        dim.runCommand(`camerashake add @a[x=${center.x},y=${center.y},z=${center.z},r=48] ${climbing ? 0.25 : 0.5} 1.0 positional`);
      } catch {}
      if (s === TEAR_STEPS && onDone) onDone();
    }, 10 + s * (climbing ? 10 : 16));
  }
}

// Where a player steps out in front of a crack.
export function standPoint(bottom, facing) {
  const [fx, fz] = FACING[facing] ?? FACING.south;
  return { x: bottom.x + fx * 3 + 0.5, y: bottom.y, z: bottom.z + fz * 3 + 0.5 };
}
