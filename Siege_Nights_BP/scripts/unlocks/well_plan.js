// The Millbrook well, the clockwork chamber under it, and the six clock posts round the square. Pure, no Minecraft
// imports: every function returns block ops as offsets from the middle of the square (dx, dz; dy 0 = the square's
// floor block). North is -z.
//
//            the square (y 0 = floor)                          side view, through the well
//      NW post         .         NE post                   roof ── ▔▔▔▔▔        y +5
//                  Wren's porch                             posts ─ ┃   ┃  crank  y +2..+4
//   W post          [ well ]          E post                rim ─── ▆ ~~~ ▆       y +1
//                                                           shaft   ▆ ~~~ ▆       y 0 .. -12 (water until the summon)
//      SW post                       SE post                plug    ▆▆▆▆▆▆▆       y -13 (the chamber's ceiling)
//                                                           chamber ( 8 high )    y -21 .. -14, floor y -22
//
// The summon turns the shaft's water to air from the top down, takes the plug out, and lays a spiral of slabs round
// a centre spindle from the square down to the chamber floor (stairSteps). Everything is an odd size.

import { POSTS } from "./keepers.js";

export const WELL = {
  shaftBottom: -12, // last water layer
  plugY: -13, // the chamber's ceiling, and the plug under the shaft
  floorY: -22, // chamber floor
  roomR: 14.5, // air inside this (flat distance)
  wallR: 16.5, // shell out to this
  postR: 10, // clock posts round the square
  crank: { dx: 2, dy: 2, dz: 1, face: "east" }, // on the rim, keyhole facing east
};
export const CHAMBER_CENTER = { dx: 0, dy: WELL.floorY + 1, dz: 0 };

// The 8 cells round the shaft's middle, clockwise from north-west
export const RING = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];

const op = (dx, dy, dz, block, states) => (states ? { dx, dy, dz, block, states } : { dx, dy, dz, block });
const mossy = (dx, dy, dz) => (((dx * 7 + dy * 3 + dz * 5) % 4 + 4) % 4 === 0 ? "minecraft:mossy_stone_bricks" : (dx + dy + dz) % 5 === 0 ? "minecraft:cracked_stone_bricks" : "minecraft:stone_bricks");

/** The well head and its water-filled shaft, as it stands before the summon. */
export function wellOps() {
  const out = [];
  for (let dy = WELL.shaftBottom; dy <= 1; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        const edge = Math.abs(dx) === 2 || Math.abs(dz) === 2;
        if (edge) out.push(op(dx, dy, dz, dy === 1 ? "minecraft:cobblestone" : mossy(dx, dy, dz)));
        else out.push(op(dx, dy, dz, dy === 1 ? "minecraft:air" : "minecraft:water"));
      }
    }
  }
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) out.push(op(dx, WELL.plugY, dz, "minecraft:polished_deepslate"));
  // posts, beam, roof, the hanging chain and the crank
  for (const dx of [-2, 2]) for (let dy = 2; dy <= 4; dy++) out.push(op(dx, dy, 0, "minecraft:spruce_fence"));
  for (let dx = -2; dx <= 2; dx++) {
    out.push(op(dx, 4, 0, dx === -2 || dx === 2 ? "minecraft:spruce_fence" : "minecraft:stripped_spruce_log", dx === -2 || dx === 2 ? undefined : { pillar_axis: "x" }));
    for (let dz = -1; dz <= 1; dz++) out.push(op(dx, 5, dz, "minecraft:spruce_slab"));
  }
  out.push(op(0, 3, 0, "minecraft:chain"));
  out.push(op(WELL.crank.dx, WELL.crank.dy, WELL.crank.dz, "siege:well_crank", { "minecraft:cardinal_direction": WELL.crank.face, "siege:wound": 0 }));
  return out;
}

/** The chamber under the well: a round room, 8 high, with a tiled floor, lanterns and copper bands. */
export function chamberOps() {
  const out = [];
  const R = Math.ceil(WELL.wallR);
  const top = WELL.plugY;
  for (let dx = -R; dx <= R; dx++) {
    for (let dz = -R; dz <= R; dz++) {
      const d = Math.hypot(dx, dz);
      if (d > WELL.wallR) continue;
      const inside = d <= WELL.roomR;
      const inShaft = Math.abs(dx) <= 1 && Math.abs(dz) <= 1;
      // floor: rings of tile, a copper band at 6 and 11
      const band = Math.abs(d - 6) < 0.5 || Math.abs(d - 11) < 0.5;
      out.push(op(dx, WELL.floorY, dz, band ? "minecraft:waxed_cut_copper" : (dx + dz) % 2 === 0 ? "minecraft:polished_deepslate" : "minecraft:deepslate_tiles"));
      for (let dy = WELL.floorY + 1; dy < top; dy++) out.push(op(dx, dy, dz, inside ? "minecraft:air" : mossy(dx, dy, dz)));
      if (!inShaft) out.push(op(dx, top, dz, inside && d > 3 && d < 12 && (dx * dx + dz * dz) % 7 === 0 ? "minecraft:waxed_cut_copper" : "minecraft:deepslate_bricks"));
    }
  }
  // eight lanterns round the wall, and eight great cogs (copper blocks) set into it
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const lx = Math.round(Math.sin(a) * (WELL.roomR - 0.5)), lz = Math.round(-Math.cos(a) * (WELL.roomR - 0.5));
    out.push(op(lx, WELL.floorY + 4, lz, "minecraft:lantern"));
    const b = a + Math.PI / 8;
    const gx = Math.round(Math.sin(b) * (WELL.roomR + 1)), gz = Math.round(-Math.cos(b) * (WELL.roomR + 1));
    for (const [ox, oy] of [[0, 0], [0, 1], [0, -1], [1, 0], [-1, 0]]) {
      // a plus shape in the wall plane, so it reads as a cog's hub and teeth
      const px = Math.abs(Math.sin(b)) > 0.7 ? gx : gx + ox, pz = Math.abs(Math.sin(b)) > 0.7 ? gz + ox : gz;
      out.push(op(px, WELL.floorY + 4 + oy, pz, "minecraft:waxed_exposed_copper"));
    }
  }
  return out;
}

/** Where each of the 43 half-steps goes, top first: a slab on one of the RING cells round the spindle. */
export function stairSteps() {
  const steps = [];
  const topSurface = 1; // first step's top is level with the square's ground (y 0 floor block's top)
  const bottomSurface = WELL.floorY + 1;
  const count = (topSurface - bottomSurface) * 2 - 1; // the last step down is the chamber floor itself
  for (let i = 0; i < count; i++) {
    const surface = topSurface - 0.5 * (i + 1); // walking down, each step half a block lower
    const [dx, dz] = RING[i % RING.length];
    const whole = Number.isInteger(surface);
    // a top slab at y = surface - 1 when the surface is whole, a bottom slab at floor(surface) when it is a half
    const dy = whole ? surface - 1 : Math.floor(surface);
    steps.push(op(dx, dy, dz, "minecraft:stone_brick_slab", { "minecraft:vertical_half": whole ? "top" : "bottom" }));
  }
  return steps;
}

/** The spindle up the middle of the stair. */
export function spindleOps() {
  const out = [];
  for (let dy = WELL.floorY + 1; dy <= 0; dy++) out.push(op(0, dy, 0, dy % 4 === 0 ? "minecraft:waxed_cut_copper" : "minecraft:polished_deepslate"));
  return out;
}

/** The shaft's water layers, top first, each as the 9 cells to empty (the spindle cell included). */
export function drainLayers() {
  const layers = [];
  for (let dy = 0; dy >= WELL.shaftBottom; dy--) {
    const layer = [];
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) layer.push(op(dx, dy, dz, "minecraft:air"));
    layers.push(layer);
  }
  return layers;
}
export const plugOps = () => RING.map(([dx, dz]) => op(dx, WELL.plugY, dz, "minecraft:air"));

// ---------- the clock posts ----------
const FACES = ["north", "east", "south", "west"];
export const SIGN_TURN = { south: 0, west: 4, north: 8, east: 12 }; // ground_sign_direction that faces that way
/** Which way a face at (dx, dz) must point to look at the middle of the square. */
export function faceToCenter(dx, dz) {
  if (Math.abs(dx) > Math.abs(dz)) return dx > 0 ? "west" : "east";
  return dz > 0 ? "north" : "south";
}
const STEP = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };

export function postSpot(post) {
  const a = (POSTS[post].angle * Math.PI) / 180;
  return { dx: Math.round(Math.sin(a) * WELL.postR), dz: Math.round(-Math.cos(a) * WELL.postR) };
}

/**
 * One clock post: a stone-brick column with the clock on top (its face glows a little) and a slab cap, its name on a sign in
 * front. The Tower clock gets a squat 3 by 3 tower instead. Returns { ops, clock, sign, keeper, face }.
 */
export function postOps(post, tower, signText) {
  const { dx, dz } = postSpot(post);
  const face = faceToCenter(dx, dz);
  const [fx, fz] = STEP[face];
  const ops = [];
  let clock;
  if (tower) {
    for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) {
      for (let dy = 1; dy <= 7; dy++) ops.push(op(dx + ox, dy, dz + oz, mossy(dx + ox, dy, dz + oz)));
      ops.push(op(dx + ox, 8, dz + oz, "minecraft:stone_brick_slab"));
    }
    clock = { dx: dx + fx, dy: 6, dz: dz + fz };
  } else {
    for (let dy = 1; dy <= 3; dy++) ops.push(op(dx, dy, dz, "minecraft:stone_brick_wall"));
    ops.push(op(dx, 5, dz, "minecraft:spruce_slab"));
    clock = { dx, dy: 4, dz };
  }
  ops.push(op(clock.dx, clock.dy, clock.dz, "siege:stopped_clock", { "minecraft:cardinal_direction": face, "siege:struck": 0 }));
  const out = tower ? 2 : 1;
  const sign = { dx: dx + fx * out + fx, dy: 1, dz: dz + fz * out + fz, text: signText };
  // the keeper stands beside the sign, a step to the right as you face the clock
  const keeper = { dx: sign.dx + (fz !== 0 ? -fz : 0), dy: 1, dz: sign.dz + (fx !== 0 ? fx : 0) };
  return { ops, clock, sign, keeper, face, faceIndex: FACES.indexOf(face) };
}
