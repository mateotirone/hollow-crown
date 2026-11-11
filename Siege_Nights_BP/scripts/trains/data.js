// Trains: numbers to tweak, and the pure maths of a moving train (no Minecraft imports, so it loads in Node tests).

import { advance, back, pointAt, yawOf, flatShapeFor, slopeShapeFor, DX, DZ, SPEED_LIMIT, blockLength, follow } from "./track.js";

export const TRACK = "siege:track";
export const TRAIN_STYLES = ["vale", "frostmarch", "saltreach", "emberwaste", "blackfen"]; // must match STYLES in studio/build_trains.py

// Speeds are in blocks per tick (20 ticks a second). A vanilla minecart tops out at 0.4.
export const TRAIN = {
  maxSpeed: 0.8, // 16 blocks a second flat out
  reverseSpeed: 0.15,
  accel: 0.006, // per tick while the driver holds forward
  brake: 0.02, // per tick while the driver holds back
  coast: 0.0008, // rolling drag with nobody on the throttle
  slope: 0.004, // gravity on a slope
  autoSpeed: 0.4, // cruising speed if the game can't read the driver's keys
  drive: "velocity", // how cars are moved: "velocity" (smooth) or "teleport" (exact). /scriptevent siege:trains mode <name>
  snapDistance: 2, // a car further than this from where it should be is teleported back
  maxCars: 6,
  saveEvery: 100, // ticks
};

// Each car: length in blocks and where its two bogies (wheel sets) sit, from each end
export const CARS = {
  engine: { entity: "siege:train_engine", item: "siege:train_engine", length: 7, inset: 1.5 },
  coach: { entity: "siege:train_coach", item: "siege:train_coach", length: 7, inset: 1.5 },
};
export const GAP = 0.6; // couplings between cars

export const carOffsets = (cars) => {
  let s = 0;
  return cars.map((c) => {
    const at = s;
    s += CARS[c.kind].length + GAP;
    return at;
  });
};
export const trainLength = (cars) => cars.reduce((sum, c) => sum + CARS[c.kind].length, 0) + GAP * Math.max(0, cars.length - 1);

// Where each car stands and which way it faces, given the cursor at the very front of the train
export function carPoses(head, cars, get) {
  const offsets = carOffsets(cars);
  return cars.map((c, i) => {
    const spec = CARS[c.kind];
    const f = back(head, offsets[i] + spec.inset, get).cursor;
    const r = back(head, offsets[i] + spec.length - spec.inset, get).cursor;
    const pf = pointAt(f, get(f.x, f.y, f.z)), pr = pointAt(r, get(r.x, r.y, r.z));
    return { x: (pf.x + pr.x) / 2, y: (pf.y + pr.y) / 2, z: (pf.z + pr.z) / 2, yaw: yawOf(pr, pf) };
  });
}

// The slowest any track ahead allows (corners), looking `dist` blocks ahead
export function limitAhead(head, dist, get) {
  let limit = Infinity, c = { ...head }, walked = -c.t;
  for (let guard = 0; guard < 64 && walked <= dist; guard++) {
    const shape = get(c.x, c.y, c.z);
    if (!shape) break;
    limit = Math.min(limit, SPEED_LIMIT[shape.kind] ?? Infinity);
    walked += blockLength(c);
    const next = follow(c, shape, c.to, get);
    if (!next) break;
    const from = (c.to + 4) % 8;
    c = { x: next.x, y: next.y, z: next.z, from, to: next.shape.links[0] === from ? next.shape.links[1] : next.shape.links[0], t: 0 };
  }
  return limit;
}

// One tick of speed. throttle: 1 forward, -1 back/brake, 0 coast. Returns the new speed.
export function stepSpeed(v, throttle, { downhill = 0, limit = Infinity } = {}) {
  const T = TRAIN;
  if (throttle > 0) v = v < 0 ? Math.min(0, v + T.brake) : v + T.accel;
  else if (throttle < 0) v = v > 0 ? Math.max(0, v - T.brake) : Math.max(-T.reverseSpeed, v - T.accel / 2);
  else v = Math.sign(v) * Math.max(0, Math.abs(v) - T.coast);
  v += downhill * T.slope;
  if (Math.abs(v) > limit) v = Math.sign(v) * Math.max(limit, Math.abs(v) - T.brake); // brake for the corner
  return Math.max(-T.reverseSpeed, Math.min(T.maxSpeed, v));
}

// Move the train v blocks (negative = backwards). Returns { head, v } (v drops to 0 at the end of the line).
export function moveTrain(head, cars, v, get) {
  if (v > 0) {
    const r = advance(head, v, get);
    return { head: r.cursor, v: r.blocked ? 0 : v };
  }
  if (v < 0) {
    const r = back(head, -v, get);
    const tail = back(r.cursor, trainLength(cars), get);
    if (r.blocked || tail.blocked) return { head, v: 0 };
    return { head: r.cursor, v };
  }
  return { head, v };
}

// A closed loop through these points (each next to the one before, diagonals allowed) as Track shapes
export function shapesForLoop(points) {
  const dirTo = (a, b) => DX.findIndex((dx, d) => dx === Math.sign(b.x - a.x) && DZ[d] === Math.sign(b.z - a.z));
  return points.map((p, i) => {
    const prev = points[(i - 1 + points.length) % points.length], next = points[(i + 1) % points.length];
    if (next.y > p.y) return slopeShapeFor(dirTo(p, next));
    if (prev.y > p.y) return slopeShapeFor(dirTo(p, prev));
    return flatShapeFor(dirTo(p, prev), dirTo(p, next));
  });
}

// The showcase loop: 15 east, a bend, 3 diagonal, 4 south... back to the start. About 21 x 11 blocks.
export function showcaseLoop() {
  const legs = [[2, 15], [3, 3], [4, 4], [5, 3], [6, 15], [7, 3], [0, 4], [1, 3]];
  const pts = [];
  let x = 0, z = 0;
  for (const [d, n] of legs) {
    for (let k = 0; k < n; k++) {
      pts.push({ x, y: 0, z });
      x += DX[d];
      z += DZ[d];
    }
  }
  return pts;
}
