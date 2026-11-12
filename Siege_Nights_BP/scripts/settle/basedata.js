// What every new base gets besides its plots, as plain functions (Node-tested; basebuilds.js uses them).
//   pickBaseSlot(slots, taken, near, size) -> the tier-0 slot of that size closest to `near` that isn't taken
//   bedSpot(plan) -> { x, y, z } local foot of a bed (head toward +z) on a free spot of the ground floor, or undefined

export function pickBaseSlot(slots, taken, near, size = "S") {
  const free = slots.filter((s) => s.tier === 0 && s.size === size && !taken.has(s.id) && !(s.tags ?? []).includes("library"));
  const mid = (s) => ({ x: (s.box.x0 + s.box.x1) / 2, z: (s.box.z0 + s.box.z1) / 2 });
  const d = (s) => Math.hypot(mid(s).x - near.x, mid(s).z - near.z) - ((s.tags ?? []).includes("square") ? 6 : 0);
  return free.sort((a, b) => d(a) - d(b))[0];
}

// A bed needs floor under both halves, two clear blocks over each, and walls round it (it is indoors); the spot
// furthest from the door wins, so the walk in stays clear.
export function bedSpot(plan) {
  const solid = new Set();
  for (const c of plan.cells.values()) if (c.role !== "air") solid.add(`${c.x},${c.y},${c.z}`);
  const has = (x, y, z) => solid.has(`${x},${y},${z}`);
  const b = plan.bounds();
  // the ground floor: the lowest level with room (a building on stilts or a plinth stands its floor higher)
  for (let f = 0; f <= 5; f++) {
    const walled = (x, z) => [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dz]) => {
      for (let k = 1; k <= 8; k++) if (has(x + dx * k, f + 1, z + dz * k) || has(x + dx * k, f + 2, z + dz * k)) return true;
      return false;
    });
    const ok = (x, z) => has(x, f, z) && !has(x, f + 1, z) && !has(x, f + 2, z) && walled(x, z);
    let best;
    for (let z = b.z1; z >= Math.max(b.z0, 2); z--) for (let x = b.x0; x <= b.x1; x++) {
      if (!ok(x, z) || !ok(x, z + 1)) continue;
      if (!ok(x - 1, z) && !ok(x + 1, z)) continue; // keep a block free beside it so it can be walked to
      const score = z * 10 - Math.abs(x);
      if (!best || score > best.score) best = { x, y: f + 1, z, score };
    }
    if (best) return { x: best.x, y: best.y, z: best.z };
  }
  return undefined;
}
