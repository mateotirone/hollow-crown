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
  const at = (u, row, depth, block) => {
    const x = bottom.x + ux * u - fx * depth;
    const z = bottom.z + uz * u - fz * depth;
    cells.push({ x, y: bottom.y + row, z, block, row });
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
      at(u, row, 0, "minecraft:air");
      at(u, row, 1, VEIL);
      at(u, row, 2, VEIL);
      at(u, row, 3, EDGE);
    }
    for (const u of [shift - half - 1, shift + half + 1]) for (let depth = 0; depth <= 3; depth++) at(u, row, depth, EDGE);
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

// Tear the crack open over about 5 seconds, from the middle rows outward, with sound and shake.
export function tearOpen(dim, bottom, facing, onDone) {
  const cells = planCrack(bottom, facing);
  const mid = CRACK_HEIGHT / 2;
  const steps = 8;
  const center = { x: bottom.x + 0.5, y: bottom.y + mid, z: bottom.z + 0.5 };
  // one recording for the whole tear once it is installed; until then each band cracks on its own
  const recorded = sfx(dim, "sig.rift_open", center, { volume: 4 });
  for (let s = 0; s <= steps; s++) {
    system.runTimeout(() => {
      const band = cells.filter((c) => Math.min(steps, Math.floor(Math.abs(c.row - mid) * (steps / (mid + 1)))) === s);
      placeCells(dim, band);
      try {
        if (!recorded) sfx(dim, s % 2 ? "random.explode" : "block.bell.hit", center, { volume: 1.5, pitch: 0.4 + s * 0.05 });
        dim.spawnParticle("minecraft:huge_explosion_emitter", center);
      } catch {}
      try {
        dim.runCommand(`camerashake add @a[x=${center.x},y=${center.y},z=${center.z},r=48] 0.4 1.2 positional`);
      } catch {}
      if (s === steps && onDone) onDone();
    }, 10 + s * 12);
  }
}

// Where a player steps out in front of a crack.
export function standPoint(bottom, facing) {
  const [fx, fz] = FACING[facing] ?? FACING.south;
  return { x: bottom.x + fx * 3 + 0.5, y: bottom.y, z: bottom.z + fz * 3 + 0.5 };
}
