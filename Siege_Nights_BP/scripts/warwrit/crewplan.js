// Siege crews' plans (pure, no Minecraft): where the trebuchet stands, how to aim it, which block comes next.
// crews.js runs them in the game. Mateo, 2026-11-12 (the five steps, shown in 3D before building):
//   march: the trebuchet travels folded with the crew;
//   set up: out of bow range, about 40 blocks from the wall, with a clear line; 15 seconds to unfold, no shots before;
//   pick a target: the wall between them and the vault, the stretch nearest the vault, never the gate (the ram's job);
//   fire: one shot about every 45 seconds, every shot at the same block, damage as walls take it today;
//   move on: when that block breaks, the one beside it or above it: one hole, widened.
// Every crew's cooldown is much longer than a player's (Mateo).

import { TREBUCHET as THROW, stepFlight } from "../siege/structure.js";

export const CREW = {
  trebuchet: {
    standOff: 40,        // blocks from the wall
    setupTicks: 300,     // 15 s to unfold
    shotTicks: 900,      // 45 s between shots (a player's trebuchet: 10 s)
    maxShots: 12,        // then the crew has thrown all it brought
    gateClear: 4,        // never aim within this many blocks of the gate
    friendlyClear: 4,    // hold fire while their own soldiers stand this close to the target
  },
  ram: { swingTicks: 120, reach: 3 },            // a player's ram swings every 2 s; a crew every 6 s
  sapper: { cooldown: 1200, charges: 3, run: 14 }, // a charge a minute, three in all, then run 14 blocks
  // the hole: first block at the foot of the wall, then beside, the other side, then above each (3 wide, 2 high:
  // soldiers can walk through). [along the wall, up]
  breach: [[0, 0], [1, 0], [-1, 0], [0, 1], [1, 1], [-1, 1]],
};

// The next block of the breach still standing, given a test standing(i) for each step; undefined = the hole is done
export function nextBreach(standing) {
  for (let i = 0; i < CREW.breach.length; i++) if (standing(i)) return i;
  return undefined;
}

// World position of breach step i: base = the first block, along = unit vector along the wall (x, z)
export function breachBlock(base, along, i) {
  const [s, up] = CREW.breach[i];
  return { x: Math.round(base.x + along.x * s), y: base.y + up, z: Math.round(base.z + along.z * s) };
}

// Where to set up: on the line from the settlement's centre through `from` (where the army stopped), standOff
// blocks outside the wall (radius r). Tries turning a little left and right (steps of `turn` radians) when
// clear(spot) says the line is blocked. Returns { x, z, angle } or undefined.
export function setupSpot(center, r, from, clear = () => true, turn = 0.12, tries = 5) {
  const base = Math.atan2(from.x - center.x, from.z - center.z);
  for (let k = 0; k <= tries * 2; k++) {
    const a = base + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * turn;
    const spot = { x: center.x + Math.sin(a) * (r + CREW.trebuchet.standOff), z: center.z + Math.cos(a) * (r + CREW.trebuchet.standOff), angle: a };
    if (clear(spot)) return spot;
  }
  return undefined;
}

// Is this wall block too close to the gate to aim at?
export const nearGate = (block, gate) => !!gate && Math.hypot(block.x + 0.5 - gate.x, block.z + 0.5 - gate.z) < CREW.trebuchet.gateClear;

// Aim: the counterweight and release angle that land a boulder on `target` from `start` (with the game's own
// flight). Returns { weight, angle, yaw, miss } (yaw in Minecraft degrees, miss = blocks off) or undefined.
export function aimFor(start, target) {
  const dx = target.x - start.x, dz = target.z - start.z, dist = Math.hypot(dx, dz);
  if (dist < 1) return undefined;
  const yaw = (Math.atan2(-dx, dz) * 180) / Math.PI;
  let best;
  for (let weight = 0; weight < THROW.speeds.length; weight++) {
    for (let angle = THROW.minAngle; angle <= THROW.maxAngle; angle += 0.5) {
      const h = heightAt(start, dist, weight, angle);
      if (h === undefined) continue;
      const miss = Math.abs(h - target.y);
      // prefer the lower, faster throw when two are as good (it hits harder and is less likely to clip a roof)
      if (!best || miss < best.miss - 0.05) best = { weight, angle, yaw, miss };
    }
  }
  return best && best.miss < 1.5 ? best : undefined;
}

// The boulder's height when it has flown `dist` blocks level, or undefined if it comes down first
function heightAt(start, dist, weight, angle) {
  const v = THROW.speeds[weight], a = (angle * Math.PI) / 180;
  const pos = { x: 0, y: start.y, z: 0 }, vel = { x: v * Math.cos(a), y: v * Math.sin(a), z: 0 };
  const dt = 1 / 20 / THROW.substeps;
  for (let n = 0; n < 4000; n++) {
    const before = { ...pos };
    stepFlight(pos, vel, dt);
    if (pos.x >= dist) { const t = (dist - before.x) / (pos.x - before.x || 1); return before.y + (pos.y - before.y) * t; }
    if (pos.y < start.y - 60) return undefined;
  }
  return undefined;
}

// The velocity for an aim (blocks per second), as siege/structure.js launchVelocity
export function velocityOf({ weight, angle, yaw }) {
  const s = THROW.speeds[weight], y = (yaw * Math.PI) / 180, a = (angle * Math.PI) / 180;
  return { x: -Math.sin(y) * Math.cos(a) * s, y: Math.sin(a) * s, z: Math.cos(y) * Math.cos(a) * s };
}
