// Where an attacking army gathers: just outside the defender's gate (settle/walls.js wallRing), or, with no walls
// yet, a little way out from their Keep on the side facing the attacker's approach.
import { wallRing } from "../settle/walls.js";
import { keepOf } from "../siege/api.js";

export function gateOutside(defender, from) {
  try {
    const ring = wallRing(defender);
    if (ring?.gate?.outside) return { ...ring.gate.outside, y: ring.gate.outside.y + 1 };
  } catch { /* no walls */ }
  const k = keepOf(defender);
  if (!k) return undefined;
  const dx = (from?.x ?? k.x + 1) - k.x, dz = (from?.z ?? k.z) - k.z, d = Math.hypot(dx, dz) || 1;
  return { x: Math.round(k.x + (dx / d) * 24), y: k.y, z: Math.round(k.z + (dz / d) * 24) };
}

// The gate itself (inside the wall line), for pushing in once it is open
export function gateInside(defender) {
  try {
    const g = wallRing(defender)?.gate;
    if (g) return { x: g.x, y: g.y + 1, z: g.z };
  } catch { /* no walls */ }
  return undefined;
}
