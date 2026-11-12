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
export const CRACK_HEIGHT = 14; // the Wound's crack, and any seam marked by hand
export const CRACK_DEPTH = 13; // how far the void runs back behind a deep crack (the seven thin places)
export const LINING = "minecraft:black_concrete"; // the void's walls: unlit black, so the pocket reads as no wall at all

// bottom = the wall block at floor level where the seam is; facing = which way the wall's face points.
// Returns [{ x, y, z, block, row }] (row lets the opening animate from the middle outward).
// opts.height: rows of open crack (a thin place passes its chamber's height, so the crack runs floor to ceiling).
// opts.deep: instead of two veil blocks and a rim, the crack opens on a void (Mateo 2026-11-12: "more of the
// transparent blocks backwards so it looks more like a void"): sheets of veil every other block for CRACK_DEPTH
// blocks back, air between them, the pocket narrowing and its roof dropping as it goes, lined in black.
export function planCrack(bottom, facing, opts = {}) {
  const H = opts.height ?? CRACK_HEIGHT;
  if (opts.deep) return planDeepCrack(bottom, facing, H);
  const [fx, fz] = FACING[facing] ?? FACING.south;
  const ux = -fz, uz = fx; // sideways along the wall
  const cells = [];
  const at = (u, row, depth, block, side = 0) => {
    const x = bottom.x + ux * u - fx * depth;
    const z = bottom.z + uz * u - fz * depth;
    cells.push({ x, y: bottom.y + row, z, block, row, side });
  };
  const salt = bottom.x * 31 + bottom.z * 17;
  for (let row = -1; row <= H; row++) {
    if (row < 0 || row === H) {
      for (let depth = 0; depth <= 3; depth++) at(0, row, depth, EDGE);
      continue;
    }
    const swell = Math.sin((Math.PI * (row + 0.5)) / H); // widest in the middle
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

function planDeepCrack(bottom, facing, H) {
  const [fx, fz] = FACING[facing] ?? FACING.south;
  const ux = -fz, uz = fx;
  const salt = bottom.x * 31 + bottom.z * 17;
  const open = new Map(); // "u,row,depth" -> { block, side }
  for (let row = 0; row < H; row++) {
    const swell = Math.sin((Math.PI * (row + 0.5)) / H);
    const jag = hash(row, salt, 201) < 0.5 ? 0 : 1;
    const half = Math.max(0, Math.round(swell * 2.4) - (row % 3 === 0 ? 0 : jag));
    const shift = Math.round(Math.sin(row * 0.9 + salt) * 1.2);
    for (let u = shift - half; u <= shift + half; u++) {
      const side = Math.abs(u - shift);
      for (let d = 0; d <= CRACK_DEPTH; d++) {
        const top = H - 1 - Math.floor(d * 0.75), low = Math.floor(d * 0.15), w = Math.max(0, half - Math.floor(d / 5));
        if (row > top || row < low || side > w) continue;
        open.set(`${u},${row},${d}`, { block: d % 2 === 1 ? VEIL : "minecraft:air", side });
      }
    }
  }
  const cells = [];
  const at = (u, row, depth, block, side) => cells.push({ x: bottom.x + ux * u - fx * depth, y: bottom.y + row, z: bottom.z + uz * u - fz * depth, block, row, side, depth });
  const lined = new Set();
  for (const [k, c] of open) {
    const [u, row, d] = k.split(",").map(Number);
    for (const [a, b, e] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const n = `${u + a},${row + b},${d + e}`;
      if (open.has(n) || lined.has(n) || d + e < 0) continue;
      lined.add(n);
      at(u + a, row + b, d + e, d + e <= 1 ? EDGE : LINING, c.side + 1); // the rim at the face, black behind it
    }
  }
  for (const [k, c] of open) { const [u, row, d] = k.split(",").map(Number); at(u, row, d, c.block, c.side); }
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
export function tearBand(c, height = CRACK_HEIGHT) {
  if (!c.side) return Math.min(TEAR_CLIMB - 1, Math.max(0, Math.floor((c.row * TEAR_CLIMB) / height)));
  return Math.min(TEAR_STEPS, TEAR_CLIMB - 1 + c.side);
}

// The opening, staged over 40 seconds (Mateo 2026-11-12: "Yeah, it looks great"). Seconds from the strike:
//   0  the strike      the fork's note (played by the caller)
//   2  the answer      a low bell from inside the stone, motes drawn into the seam
//   7  the stir        the chamber trembles, harder each time; dust falls; the amethyst rings
//  18  the hush        everything stops
//  20  the tear        the split climbs from the floor to the ceiling (7 s), then pulls apart sideways (3 s)
//  30  the breath      air pours out of the crack
//  34  the first look  quiet; the veil hangs there. onDone runs at 40.
// Nobody's camera is taken: players can walk about while it happens.
export const OPENING = { answer: 2, stir: 7, hush: 18, tear: 20, widen: 27, breath: 30, look: 34, done: 40 };
export function tearOpen(dim, bottom, facing, onDone, opts = {}) {
  const H = opts.height ?? CRACK_HEIGHT;
  const cells = planCrack(bottom, facing, opts);
  const [fx, fz] = FACING[facing] ?? FACING.south;
  const center = { x: bottom.x + 0.5, y: bottom.y + H / 2, z: bottom.z + 0.5 };
  const front = (out, y) => ({ x: bottom.x + 0.5 + fx * out, y: bottom.y + y, z: bottom.z + 0.5 + fz * out });
  const at = (sec, fn) => system.runTimeout(() => { try { fn(); } catch {} }, Math.round(sec * 20));
  const shake = (amount, secs) => { try { dim.runCommand(`camerashake add @a[x=${center.x},y=${center.y},z=${center.z},r=48] ${amount} ${secs} positional`); } catch {} };
  const puff = (id, where) => { try { dim.spawnParticle(id, where); } catch {} };
  if (opts.quick) { // the old six-second tear, for tests and builders
    for (let s = 0; s <= TEAR_STEPS; s++) at(0.5 + s * 0.6, () => { placeCells(dim, cells.filter((c) => tearBand(c, H) === s)); if (s === TEAR_STEPS && onDone) onDone(); });
    return;
  }
  at(OPENING.answer, () => { sfx(dim, "block.bell.resonate", center, { volume: 2, pitch: 0.35 }); puff("minecraft:portal_reverse_particle", front(1, 1.5)); });
  for (let t = OPENING.stir, i = 0; t < OPENING.hush; t += 2, i++) {
    at(t, () => {
      shake(0.06 + i * 0.03, 1.2);
      sfx(dim, "block.amethyst_block.chime", center, { volume: 1 + i * 0.2, pitch: 0.5 + i * 0.05 });
      if (i >= 2) sfx(dim, "block.bell.hit", center, { volume: 1, pitch: 0.3 });
      for (let k = 0; k < 3; k++) puff("minecraft:falling_dust_gravel_particle", front(1 + Math.random() * 6, H - 0.5));
    });
  }
  let recorded = false;
  at(OPENING.tear, () => { recorded = sfx(dim, "sig.rift_open", center, { volume: 4 }); });
  for (let s = 0; s <= TEAR_STEPS; s++) {
    const climbing = s < TEAR_CLIMB;
    const when = climbing ? OPENING.tear + (s * (OPENING.widen - OPENING.tear)) / TEAR_CLIMB : OPENING.widen + ((s - TEAR_CLIMB) * (OPENING.breath - OPENING.widen)) / (TEAR_STEPS - TEAR_CLIMB + 1);
    at(when, () => {
      placeCells(dim, cells.filter((c) => tearBand(c, H) === s));
      const where = climbing ? { x: center.x, y: bottom.y + ((s + 0.5) * (H + 1)) / TEAR_CLIMB, z: center.z } : center;
      if (!recorded) sfx(dim, climbing ? "block.bell.hit" : "random.explode", where, { volume: 1.5, pitch: climbing ? 0.4 + s * 0.06 : 0.5 });
      puff(climbing ? "minecraft:critical_hit_emitter" : "minecraft:huge_explosion_emitter", where);
      shake(climbing ? 0.25 : 0.5, 1.0);
    });
  }
  for (let t = OPENING.breath; t < OPENING.look; t += 0.5) {
    at(t, () => { for (let k = 0; k < 4; k++) puff("minecraft:portal_reverse_particle", front(1 + k, 1 + Math.random() * (H - 2))); if (t === OPENING.breath) sfx(dim, "ambient.cave", center, { volume: 2, pitch: 0.6 }); });
  }
  at(OPENING.done, () => { if (onDone) onDone(); });
}

// Where a player steps out in front of a crack.
export function standPoint(bottom, facing) {
  const [fx, fz] = FACING[facing] ?? FACING.south;
  return { x: bottom.x + fx * 3 + 0.5, y: bottom.y, z: bottom.z + fz * 3 + 0.5 };
}
