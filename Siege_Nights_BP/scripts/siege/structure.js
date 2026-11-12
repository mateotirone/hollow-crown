// How walls stand up, and how a trebuchet throws. Pure: no Minecraft here, so the Siege Wall Lab
// (lab/wall-lab.html) runs the very same settle() and the numbers can be tuned there first.
// Mateo tuned them in the lab, 2026-11-12. The game side is collapse.js (walls) and machines.js (trebuchet).

// ---------- Masonry ----------
// Per wall tier: Stone, Iron, Diamond, Netherite (siege:armor 0-3)
export const MASONRY = {
  reach: [1, 1, 2, 2],         // blocks a course can stick out sideways past its last support
  strength: [48, 64, 80, 104], // weight (in blocks) one undamaged block can carry
  crackedShare: 0.15,          // a block on its last hit keeps only this share of its strength
  hang: 0.15,                  // a block held only from the side tears away above this share of its strength
};

// Strength of one block, given its tier and how much of its HP is gone (0..1)
export function blockStrength(tier, damageShare) {
  return MASONRY.strength[tier] * (1 - (1 - MASONRY.crackedShare) * Math.min(1, Math.max(0, damageShare)));
}

// Which blocks are held up, how much weight each carries, and which ones crush.
// cells: Map "x,y,z" -> { x, y, z, gate, weight? }. restsOnGround(x, y, z): is there solid ground under this spot?
// rules: { reach(cell), strength(cell), hang }
export function settle(cells, rules, restsOnGround) {
  const job = settleJob(cells, rules, restsOnGround);
  for (;;) { const step = job.next(); if (step.done) return step.value; }
}

// The same, a few rows at a time: the game runs it inside system.runJob so a big wall never stalls a tick
export function* settleJob(cells, rules, restsOnGround) {
  const at = (x, y, z) => cells.get(`${x},${y},${z}`);
  const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const rows = new Map();
  for (const c of cells.values()) {
    if (!rows.has(c.y)) rows.set(c.y, []);
    rows.get(c.y).push(c);
  }
  const ys = [...rows.keys()].sort((a, b) => a - b);
  const torn = new Set(); // blocks that hung from the side with too much on them
  let held, load;
  const rests = (c) => { const h = held.get(c); return !!h && (h.by === "ground" || h.by === "below"); };

  for (let pass = 0; pass < 12; pass++) {
    held = new Map(); // cell -> { by, to: cells it leans on, d: how far out it reaches }
    for (const y of ys) {
      if (y % 4 === 0) yield;
      const row = rows.get(y);
      // 1. Resting on the ground, or on a block that is itself held
      for (const c of row) {
        if (torn.has(c)) continue;
        const below = at(c.x, y - 1, c.z);
        if (!below) { if (restsOnGround(c.x, y, c.z)) held.set(c, { by: "ground", to: [], d: 0 }); }
        else if (held.has(below)) held.set(c, { by: "below", to: [below], d: 0 });
      }
      // 2. Shoulder: next to a resting block. Each course over a hole closes in by one,
      //    so the stone over a breach falls away in a stepped triangle and the rest arches over.
      for (const c of row) {
        if (held.has(c) || torn.has(c) || c.gate) continue;
        const to = [];
        for (const [dx, dz] of SIDES) { const n = at(c.x + dx, y, c.z + dz); if (n && rests(n)) to.push(n); }
        if (to.length) held.set(c, { by: "shoulder", to, d: 0 });
      }
      // 3. Reach: mortar holds a block or two further out
      const queue = row.filter((c) => held.has(c));
      for (let i = 0; i < queue.length; i++) {
        const c = queue[i], d = held.get(c).d;
        for (const [dx, dz] of SIDES) {
          const n = at(c.x + dx, y, c.z + dz);
          if (!n || n.gate || held.has(n) || torn.has(n) || d + 1 > rules.reach(n)) continue;
          held.set(n, { by: "reach", to: [c], d: d + 1 });
          queue.push(n);
        }
      }
    }

    // Weight: from the top down, each block passes its load to whatever holds it
    load = new Map();
    for (const c of held.keys()) load.set(c, c.weight ?? 1);
    const order = (h) => (h.by === "reach" ? 2 + h.d : h.by === "shoulder" ? 1 : 0);
    for (let i = ys.length - 1; i >= 0; i--) {
      if (i % 4 === 0) yield;
      const row = rows.get(ys[i]).filter((c) => held.has(c)).sort((a, b) => order(held.get(b)) - order(held.get(a)));
      for (const c of row) {
        const h = held.get(c);
        const share = load.get(c) / (h.to.length || 1);
        for (const t of h.to) load.set(t, load.get(t) + share);
      }
    }
    // Mortar is weak in tension: a block held out by mortar alone (not sitting on a shoulder) tears away
    // when too much hangs on it, and everything it was holding has to find another way down
    let tore = false;
    for (const [c, h] of held) {
      if (h.by === "reach" && load.get(c) > rules.strength(c) * rules.hang) { torn.add(c); tore = true; }
    }
    if (!tore) break;
  }

  const loose = [], crushed = [];
  for (const row of rows.values()) for (const c of row) {
    if (c.gate) continue; // a gate hangs in its frame: it can hold the stone above it, but never falls or crushes
    if (!held.has(c)) loose.push(c);
    else if (load.get(c) > rules.strength(c)) crushed.push(c);
  }
  return { loose, crushed, load, held };
}

// Loose blocks fall as connected chunks (touching faces)
export function groupChunks(loose) {
  const byKey = new Map(loose.map((c) => [`${c.x},${c.y},${c.z}`, c]));
  const seen = new Set();
  const groups = [];
  for (const start of loose) {
    if (seen.has(start)) continue;
    const group = [start];
    seen.add(start);
    for (let i = 0; i < group.length; i++) {
      const c = group[i];
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
        const n = byKey.get(`${c.x + dx},${c.y + dy},${c.z + dz}`);
        if (n && !seen.has(n)) { seen.add(n); group.push(n); }
      }
    }
    groups.push(group);
  }
  return groups;
}

// Which way a falling chunk tips: toward the side with least underneath its bottom course.
// isEmpty(x, y, z) -> true where nothing stands. Returns [dx, dz].
export function tipDirection(group, isEmpty) {
  const minY = Math.min(...group.map((c) => c.y));
  let best = [0, 0], bestScore = 0;
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    let s = 0;
    for (const c of group) if (c.y === minY && isEmpty(c.x + dx, c.y - 1, c.z + dz)) s++;
    if (s > bestScore) { bestScore = s; best = [dx, dz]; }
  }
  return best;
}

// Rubble slides downhill: no step in a pile is more than one block.
// height(x, z): top of the ground/rubble there (the y a new block would go in). blocked(x, y, z): can't go there.
// Returns where the block comes to rest { x, y, z }.
export function slideRubble(x, z, height, blocked, pick = (n) => Math.floor(Math.random() * n)) {
  for (let step = 0; step < 16; step++) {
    const h = height(x, z);
    const lower = [];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nh = height(x + dx, z + dz);
      if (nh <= h - 1 && !blocked(x + dx, nh, z + dz)) lower.push([x + dx, z + dz, nh]);
    }
    if (!lower.length) break;
    const lowest = Math.min(...lower.map((l) => l[2]));
    const options = lower.filter((l) => l[2] === lowest);
    [x, z] = options[pick(options.length)];
  }
  return { x, y: height(x, z), z };
}

// ---------- Trebuchet ----------
// Blocks per second. The boulder flies with real gravity and lands harder the faster it comes down.
export const TREBUCHET = {
  gravity: 20,
  speeds: [22, 27, 31],               // Light, Medium, Heavy counterweight
  weightNames: ["Light", "Medium", "Heavy"],
  refSpeed: 27,                        // landing at this speed does the boulder's listed damage
  minAngle: 15, maxAngle: 75,          // release angle limits (degrees above level)
  maxTurn: 360,                        // the whole machine swings round to face where you look
  releaseHeight: 6,                    // the sling lets go this high above the machine's feet
  substeps: 4,                         // checks per tick, so a boulder can't skip through a thin wall
};

// Look up to throw higher: the release angle follows how far up the player looks (Minecraft pitch is negative upward)
export function releaseAngle(pitch) {
  return Math.min(TREBUCHET.maxAngle, Math.max(TREBUCHET.minAngle, -pitch));
}

// Launch velocity in blocks per second. yaw: Minecraft yaw in degrees (0 = south, 90 = west).
export function launchVelocity(yaw, angle, weight) {
  const speed = TREBUCHET.speeds[weight];
  const y = (yaw * Math.PI) / 180, a = (angle * Math.PI) / 180;
  return { x: -Math.sin(y) * Math.cos(a) * speed, y: Math.sin(a) * speed, z: Math.cos(y) * Math.cos(a) * speed };
}

// One small step of flight (dt seconds). Changes pos and vel in place.
export function stepFlight(pos, vel, dt) {
  vel.y -= TREBUCHET.gravity * dt;
  pos.x += vel.x * dt; pos.y += vel.y * dt; pos.z += vel.z * dt;
}

// How far a throw lands on level ground below the release point (drop = release height above the target)
export function throwDistance(angle, weight, drop = TREBUCHET.releaseHeight) {
  const v = TREBUCHET.speeds[weight], g = TREBUCHET.gravity, a = (angle * Math.PI) / 180;
  const vx = v * Math.cos(a), vy = v * Math.sin(a);
  const t = (vy + Math.sqrt(vy * vy + 2 * g * drop)) / g;
  return vx * t;
}

// Faster landing, harder hit: damage grows with the boulder's energy (35% to 180% of its listed power)
export function impactPower(basePower, speed) {
  const f = (speed / TREBUCHET.refSpeed) ** 2;
  return basePower * Math.min(1.8, Math.max(0.35, f));
}
