// Where the Strongroom's stairs go down inside a town hall (Mateo, 2026-11-12: "the other vault [is] an add-on to
// the Townhall so when you buy it, it automatically builds it, you don't place where it goes"). Pure code, loads
// in Node too.
//
// A hall plan (townhall/halls.js drawHall) is searched for a run of floor inside the walls and under the roof
// where the top of the stairs fits: the hole for the steps, the walls round it at floor height and the headroom
// above them, with nothing of the hall in the way (furniture, the Tree, the Town Board, the hearth, the door).
// A hall design can name the spot itself with a "strongroom" mark (where the player stands at the top of the
// stairs) and a "strongroom_down" mark one block further, the way the stairs go down.
//
// Spots are local to the hall: x to the right of the way in, z into the hall, y the hall's own heights. The vault
// frame (vault/data.js worldOf) puts (0, 1, 0) on the spot, +z down the stairs, y = 0 the floor under it.

import { VAULT_ROOMS } from "./rooms_data.js";

// Every block any tier's room sets at or above the hall floor (vault y >= 0): { x, y, z, air }. Floor-height
// blocks first, so a spot that is not over the floor is turned down quickly.
export const STAIR_TOP = (() => {
  const out = new Map();
  for (const layouts of Object.values(VAULT_ROOMS))
    for (const d of Object.values(layouts))
      for (const [y, z, x0, n, i] of d.rows) {
        if (y < 0) continue;
        const air = d.palette[i][0] === "minecraft:air";
        for (let x = x0; x < x0 + n; x++) {
          const k = `${x},${y},${z}`;
          out.set(k, { x, y, z, air: (out.get(k)?.air ?? true) && air });
        }
      }
  return [...out.values()].sort((u, v) => u.y - v.y);
})();
// The stairs' hole: the air at floor height
const HOLE = STAIR_TOP.filter((c) => c.y === 0 && c.air);

// The biggest room any tier digs (the Choirsteel one), so the spot still works after every reinforcing
export const BIGGEST = (() => {
  const b = { x0: 0, x1: 0, z0: 0, z1: 0 };
  for (const layouts of Object.values(VAULT_ROOMS))
    for (const d of Object.values(layouts)) {
      b.x0 = Math.min(b.x0, d.box.x0); b.x1 = Math.max(b.x1, d.box.x1);
      b.z0 = Math.min(b.z0, d.box.z0); b.z1 = Math.max(b.z1, d.box.z1);
    }
  return b;
})();

export const DIRS = [{ x: 0, z: 1 }, { x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: -1 }]; // down toward the back first
const right = (d) => ({ x: -d.z, z: d.x }); // the same turn as townhall/halls.js frameFor

// A vault-frame block (x, y, z) in hall coordinates, for a spot { x, y, z, d }
export function toHall(spot, x, y, z) {
  const R = right(spot.d);
  return { x: spot.x + x * R.x + z * spot.d.x, y: spot.y - 1 + y, z: spot.z + x * R.z + z * spot.d.z };
}

// Marks the stairs' hole and headroom keep clear of, and how far (blocks, sideways): the way in stays open, the
// Town Board keeps room in front to be read, and nothing a feature finds by its mark is dug away
const KEEP_CLEAR = { door: 2, board: 1, tree: 0, hearth: 0, ledger: 0, sage: 0, cartography: 0, throne: 0, warroom: 0, vault: 0 };

function lookup(p) {
  const free = (x, y, z) => { const c = p.cells.get(`${x},${y},${z}`); return !c || c.role === "air"; };
  const top = new Map(); // "x,z" -> highest solid y (for "under the roof")
  for (const c of p.cells.values()) {
    if (c.role === "air") continue;
    const k = `${c.x},${c.z}`;
    if (!(top.get(k) >= c.y)) top.set(k, c.y);
  }
  const roofed = (x, y, z) => (top.get(`${x},${z}`) ?? -Infinity) > y + 3;
  const marks = Object.entries(p.marks).filter(([name]) => KEEP_CLEAR[name] !== undefined).map(([name, m]) => ({ name, m, r: KEEP_CLEAR[name] }));
  return { free, roofed, marks };
}

const lookups = new WeakMap();
const lookupOf = (p) => { if (!lookups.has(p)) lookups.set(p, lookup(p)); return lookups.get(p); };

// Does the top of the stairs fit at this spot in this hall? Returns why not, or undefined when it fits.
export function spotProblem(p, spot) {
  const { free, roofed, marks } = lookupOf(p);
  const floorY = spot.y - 1;
  if (free(spot.x, floorY, spot.z) || !free(spot.x, spot.y, spot.z) || !free(spot.x, spot.y + 1, spot.z)) return "no floor to stand on";
  if (!roofed(spot.x, floorY, spot.z)) return "not under the roof";
  const R = right(spot.d), F = spot.d;
  const cells = [spot];
  for (const c of STAIR_TOP) {
    const hx = spot.x + c.x * R.x + c.z * F.x, hy = floorY + c.y, hz = spot.z + c.x * R.z + c.z * F.z;
    if (c.y === 0) {
      if (free(hx, hy, hz)) return "the stairs would reach past the floor";
      if (!roofed(hx, hy, hz)) return "the stairs would reach out from under the roof";
    } else if (c.air && !free(hx, hy, hz)) return "something of the hall stands in the way";
    if (c.air) cells.push({ x: hx, z: hz });
  }
  for (const { name, m, r } of marks) {
    if (m.y < floorY - 1 || m.y > floorY + 5) continue;
    for (const h of cells) if (Math.abs(m.x - h.x) <= r && Math.abs(m.z - h.z) <= r) return `too close to the ${name}`;
  }
  return undefined;
}

const named = (p) => {
  const s = p.marks.strongroom, down = p.marks.strongroom_down;
  return s && down ? { x: s.x, y: s.y, z: s.z, d: { x: Math.sign(down.x - s.x), z: Math.sign(down.z - s.z) } } : undefined;
};

// Every spot where the stairs fit, best first: one that still fits the hall's bigger tiers (later: their plans),
// so the vault need not move when the hall grows; then off the centre aisle, going down toward the back of the
// hall, with as much of the room as can be under the hall itself, near the door. A design's own mark comes first.
// A generator, so the search can run a little each tick (system.runJob); strongroomSpots runs it straight through.
export function* spotSearch(p, later = []) {
  const own = named(p);
  if (own && !spotProblem(p, own)) return [own];
  const b = p.bounds();
  const found = [];
  for (const c of p.cells.values()) {
    if (c.role === "air") continue;
    for (let di = 0; di < DIRS.length; di++) {
      const spot = { x: c.x, y: c.y + 1, z: c.z, d: DIRS[di] };
      if (spotProblem(p, spot)) continue;
      const aisle = HOLE.some((h) => Math.abs(toHall(spot, h.x, h.y, h.z).x) <= 1) ? 1 : 0;
      const a = toHall(spot, BIGGEST.x0, 0, BIGGEST.z0), e = toHall(spot, BIGGEST.x1, 0, BIGGEST.z1);
      const [xa, xb, za, zb] = [Math.min(a.x, e.x), Math.max(a.x, e.x), Math.min(a.z, e.z), Math.max(a.z, e.z)];
      const ix = Math.max(0, Math.min(b.x1, xb) - Math.max(b.x0, xa) + 1), iz = Math.max(0, Math.min(b.z1, zb) - Math.max(b.z0, za) + 1);
      const outside = (xb - xa + 1) * (zb - za + 1) - ix * iz;
      const stays = later.filter((q) => !spotProblem(q, spot)).length;
      found.push({ spot, rank: [-stays, aisle, di, outside, c.z, Math.abs(c.x)] });
    }
    yield;
  }
  found.sort((u, v) => { for (let i = 0; i < u.rank.length; i++) if (u.rank[i] !== v.rank[i]) return u.rank[i] - v.rank[i]; return 0; });
  return found.map((f) => f.spot);
}

export function strongroomSpots(p, later = []) {
  const run = spotSearch(p, later);
  for (;;) { const r = run.next(); if (r.done) return r.value; }
}

// ---------- between the hall's frame and the world ----------

// hall: { x, y, z, fx, fz } (the hall's origin and the way in). A spot in the hall -> the vault's frame in the world
export function vaultFrameAt(hall, spot) {
  const F = { x: Math.sign(hall.fx), z: Math.sign(hall.fz) }, R = right(F);
  const fx = spot.d.x * R.x + spot.d.z * F.x, fz = spot.d.x * R.z + spot.d.z * F.z;
  return { x: hall.x + spot.x * R.x + spot.z * F.x, y: hall.y - 1 + spot.y, z: hall.z + spot.x * R.z + spot.z * F.z, fx, fz };
}

// A vault already in the world -> the spot it stands on in this hall's frame
export function spotOfVault(hall, v) {
  const F = { x: Math.sign(hall.fx), z: Math.sign(hall.fz) }, R = right(F);
  const dx = v.x - hall.x, dz = v.z - hall.z;
  return {
    x: dx * R.x + dz * R.z, y: v.y - hall.y + 1, z: dx * F.x + dz * F.z,
    d: { x: v.fx * R.x + v.fz * R.z, z: v.fx * F.x + v.fz * F.z },
  };
}
