// Bakes every boss unlock site into the base map (Mateo, 2026-11-13: the boss locations are physical places in the
// world from the start; only the keepers, signs, triggers and fights wait for a player to come near).
//
// Runs the game's own plans (Siege_Nights_BP/scripts/unlocks/plans.js, well_plan.js, the area stamps in
// landmark_stamps.js) against the generated ground, exactly as the game would on approach, so a baked site and one
// built in-game are the same blocks. genworld.py calls it:
//
//   node map/bake_sites.mjs probe.json > sites.json
//
// probe.json: { seed, sites: { <id>: { x0, z0, n, ground: [...], water: [...] } }, reeve_y }
//   per site a square of columns (n by n, x-major) round the anchor: ground = y of the first solid block (the game's
//   column() rules), water = y of the water or ice surface or null. reeve_y: the Millbrook square's floor (groundAt).
// sites.json: { <id>: { anchor, center, seed, info, clear, ops: [[dx, dy, dz, block, states|null], ...] } }
//   ops in placing order (area stamp first, the plan on top, air last within each). The game reads baked_sites.js
//   (written by genworld from this) to adopt each site instead of building it again.
import { readFileSync } from "node:fs";
import { huntPlan, chapelPlan, vaultPlan, cradlePlan, mirelightPlan } from "../Siege_Nights_BP/scripts/unlocks/plans.js";
import { makeHunt, makePews, VILLAGERS } from "../Siege_Nights_BP/scripts/unlocks/puzzles.js";
import { wellOps, chamberOps, postOps } from "../Siege_Nights_BP/scripts/unlocks/well_plan.js";
import { CLOCKS, KEEPERS, makePuzzle, TOWER_POST } from "../Siege_Nights_BP/scripts/unlocks/keepers.js";
import { LANDMARKS, stampOps } from "../Siege_Nights_BP/scripts/unlocks/landmarks.js";
import { WARDS } from "../Siege_Nights_BP/scripts/plots/config.js";

// The anchors each site file passes to defineSite (unlocks/<site>.js). The game refuses a baked site whose anchor
// no longer matches its own, and builds it the old way instead.
const mill = WARDS.find((w) => w.name === "Millbrook");
export const ANCHORS = {
  reeve: { x: mill.x, z: mill.z },
  huntsman: { x: 60, z: -1130 },
  bride: { x: -690, z: 130 },
  seneschal: { x: 850, z: 590 },
  mother: { x: -120, z: 1060 },
  mirelight: { x: -60, z: 900 },
};
export const PROBE_R = 120; // how far round each anchor genworld reads the ground (Hallowmere's shore rays reach ~115)

const run = (gen) => { let r; do { r = gen.next(); } while (!r.done); return r.value; };
const seedOf = (base, id) => {
  let x = base | 0;
  for (const ch of id) x = Math.imul(x ^ ch.charCodeAt(0), 2654435761) >>> 0;
  return x % 2 ** 31;
};

// Mateo 2026-11-14: every story build has to be perfect, so nothing of a baked site may float. A plan lays its area
// stamp and its build over ground it only reads, and here and there a piece ends up over a hollow the stamp cut, a
// step lower than it was drawn for, or on water: a lamp post one block up, plants and moss carpets over a pool.
// settle() replays the ops over the probed ground and finds every placed block not joined (by a face or an edge) to
// the ground. A small loose piece that lands on ground within 3 blocks straight down is moved down; the rest is
// dropped. Returns { ops, moved, dropped }.
const N18 = [];
for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) { const s = Math.abs(a) + Math.abs(b) + Math.abs(c); if (s > 0 && s < 3) N18.push([a, b, c]); }
const LIQUID = /water|lava/;
export function settle(ops, center, groundOf) {
  const key = (x, y, z) => `${x},${y},${z}`;
  const last = new Map();
  for (const o of ops) last.set(key(center.x + o.dx, center.y + o.dy, center.z + o.dz), o);
  const placed = (k) => { const o = last.get(k); return o && o.block !== "minecraft:air" && !LIQUID.test(o.block); };
  const natural = (x, y, z) => { if (last.has(key(x, y, z))) return false; const g = groundOf(x, z); return g !== undefined && y <= g; };
  const cells = [...last.keys()].filter(placed).map((k) => k.split(",").map(Number));
  const grounded = new Set(), todo = [];
  for (const [x, y, z] of cells) if (N18.some(([a, b, c]) => natural(x + a, y + b, z + c))) { grounded.add(key(x, y, z)); todo.push([x, y, z]); }
  while (todo.length) {
    const [x, y, z] = todo.pop();
    for (const [a, b, c] of N18) { const k = key(x + a, y + b, z + c); if (!grounded.has(k) && placed(k)) { grounded.add(k); todo.push([x + a, y + b, z + c]); } }
  }
  const loose = new Set(cells.map(([x, y, z]) => key(x, y, z)).filter((k) => !grounded.has(k)));
  if (!loose.size) return { ops, moved: 0, dropped: 0 };
  const drop = new Set(), shifted = [];
  const seen = new Set();
  for (const k0 of loose) {
    if (seen.has(k0)) continue;
    const comp = [k0]; seen.add(k0);
    for (let i = 0; i < comp.length; i++) {
      const [x, y, z] = comp[i].split(",").map(Number);
      for (const [a, b, c] of N18) { const k = key(x + a, y + b, z + c); if (loose.has(k) && !seen.has(k)) { seen.add(k); comp.push(k); } }
    }
    let by = 0;
    if (comp.length <= 16) {
      for (let s = 1; s <= 3 && !by; s++) {
        const pts = comp.map((k) => k.split(",").map(Number)).map(([x, y, z]) => [x, y - s, z]);
        const mine = new Set(pts.map((p) => key(...p)));
        if (pts.some(([x, y, z]) => (placed(key(x, y, z)) && !comp.includes(key(x, y, z))) || natural(x, y, z))) break;
        if (pts.some(([x, y, z]) => !mine.has(key(x, y - 1, z)) && (natural(x, y - 1, z) || grounded.has(key(x, y - 1, z))))) by = s;
      }
    }
    if (process.env.SETTLE_DEBUG) process.stderr.write(`  ${by ? "move " + by : "drop"}: ${comp.slice(0, 6).map((k) => k + " " + last.get(k).block.replace("minecraft:", "")).join(", ")}${comp.length > 6 ? ` (+${comp.length - 6})` : ""}\n`);
    for (const k of comp) { drop.add(k); if (by) { const [x, y, z] = k.split(",").map(Number); shifted.push({ ...last.get(k), dy: y - by - center.y }); } }
  }
  const out = ops.filter((o) => o.block === "minecraft:air" || !drop.has(key(center.x + o.dx, center.y + o.dy, center.z + o.dz)));
  return { ops: [...out, ...shifted], moved: shifted.length, dropped: drop.size - shifted.length };
}

export function bake(probeData) {
  const out = {};
  const probeFor = (id) => {
    const s = probeData.sites[id];
    return (x, z) => {
      const i = x - s.x0, k = z - s.z0;
      if (i < 0 || k < 0 || i >= s.n || k >= s.n) return undefined;
      const g = s.ground[i * s.n + k], w = s.water[i * s.n + k];
      if (g === null || g === undefined) return undefined;
      return { top: Math.max(g, w ?? g), water: w ?? undefined, ground: g };
    };
  };
  const pack = (id, center, ops, info, seed, extra = {}) => {
    let all = [...stampOps(LANDMARKS[id]), ...ops];
    const s = probeData.sites[id];
    if (s) {   // the reeve's square has no probe square: its well and posts stand on the street the town laid
      const r = settle(all, center, (x, z) => { const i = x - s.x0, k = z - s.z0; return i < 0 || k < 0 || i >= s.n || k >= s.n ? undefined : s.ground[i * s.n + k] ?? undefined; });
      all = r.ops;
      if (r.moved || r.dropped) process.stderr.write(`bake_sites: ${id}: ${r.moved} loose blocks moved down onto the ground, ${r.dropped} dropped\n`);
    }
    out[id] = { anchor: ANCHORS[id], center, seed, info: info ?? {}, clear: LANDMARKS[id]?.clear !== false, ...extra,
      ops: all.map((o) => [o.dx, o.dy, o.dz, o.block, o.states ?? null]) };
  };
  for (const [id, a] of Object.entries(ANCHORS)) {
    const seed = seedOf(probeData.seed, id);
    if (id === "reeve") {
      if (probeData.reeve_y === null || probeData.reeve_y === undefined) continue;
      const c = { x: Math.floor(a.x), y: probeData.reeve_y, z: Math.floor(a.z) };
      const p = makePuzzle(seed, { towerPost: TOWER_POST });
      const ops = [...chamberOps(), ...wellOps()];
      CLOCKS.forEach((clock, i) => ops.push(...postOps(p.layout[i], i === 0, `${clock.short} Clock\n§7kept by\n${KEEPERS[i].name}`, { clocktower: !!LANDMARKS.reeve }).ops));
      pack(id, c, ops, {}, seed, { towerPost: TOWER_POST });
      continue;
    }
    const probe = probeFor(id);
    const plan = id === "huntsman" ? run(huntPlan(probe, a, makeHunt(seed)))
      : id === "bride" ? run(chapelPlan(probe, a, makePews(seed)))
      : id === "seneschal" ? run(vaultPlan(probe, a))
      : id === "mother" ? run(cradlePlan(probe, a))
      : run(mirelightPlan(probe, a, VILLAGERS));
    if (!plan) continue;
    pack(id, plan.center, plan.ops, plan.info, seed);
  }
  return out;
}

if (process.argv[1] && process.argv[1].endsWith("bake_sites.mjs")) {
  if (process.argv[2] === "--anchors") {
    // reach: how far each site's area stamp runs from its anchor, so the rail planner keeps its lines out of it
    const reach = Object.fromEntries(Object.keys(ANCHORS).map((id) => {
      const L = LANDMARKS[id], o = L?.origin ?? [0, 0, 0], sz = L?.size ?? [0, 0, 0];
      return [id, Math.ceil(Math.max(-o[0], o[0] + sz[0], -o[2], o[2] + sz[2])) + 4];
    }));
    process.stdout.write(JSON.stringify({ anchors: ANCHORS, r: PROBE_R, reach }));
  }
  else process.stdout.write(JSON.stringify(bake(JSON.parse(readFileSync(process.argv[2], "utf8")))));
}
