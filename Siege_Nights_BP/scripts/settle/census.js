// What a plot holds: counts of block groups from a scan, and what that makes the building. Plain functions,
// tested in Node. The rules and numbers are in config.js (CONTENTS, BLOCK_GROUPS, FLOOR_PER_BED).
//
//   tally(cells) -> { groups: { group: n }, floor (floor with headroom), roofed (of that, covered), height, beds: [{x,y,z}] }
//       cells: [{ x, y, z, id, head }] for every non-air block in the plot from the floor up (y relative to
//       the floor: 0 is the floor layer). head marks the head half of a bed.
//   matches(t) -> [{ id, ok, missing }]   every CONTENTS rule, checked
//   bedCap(t) -> how many beds may count

import { CONTENTS, BLOCK_GROUPS, FLOOR_PER_BED, SETTLERS } from "./config.js";

export function tally(cells) {
  const groups = Object.fromEntries(Object.keys(BLOCK_GROUPS).map((g) => [g, 0]));
  const floorCols = new Set(), coverCols = new Set(), lowCount = new Map();
  const beds = [];
  let height = 0;
  for (const c of cells) {
    const col = `${c.x},${c.z}`;
    if (c.y === 0) floorCols.add(col);
    if (c.y >= 3) coverCols.add(col);
    if (c.y === 1 || c.y === 2) lowCount.set(col, (lowCount.get(col) ?? 0) + 1);
    if (c.y > height) height = c.y;
    for (const [g, re] of Object.entries(BLOCK_GROUPS)) {
      if (!re.test(c.id)) continue;
      if (g === "bed") { if (c.head) { groups.bed++; beds.push({ x: c.x, y: c.y, z: c.z }); } continue; }
      if (g === "door" && c.upper) continue; // a door is two blocks
      groups[g]++;
    }
  }
  let roofed = 0, inside = 0;
  // covered floor: something overhead with room to stand under it (a solid wall column is not floor)
  for (const col of floorCols) {
    if ((lowCount.get(col) ?? 0) >= 2) continue;
    inside++;
    if (coverCols.has(col)) roofed++;
  }
  return { groups, floor: inside, roofed, height, beds };
}

export function matches(t) {
  return CONTENTS.map((rule) => {
    const missing = [];
    for (const [g, n] of Object.entries(rule.need ?? {})) if ((t.groups[g] ?? 0) < n) missing.push(`${n - (t.groups[g] ?? 0)} more ${g}`);
    if (rule.roofed && (t.floor === 0 || t.roofed / t.floor < rule.roofed)) missing.push("more roof");
    if (rule.tall && t.height < rule.tall) missing.push(`${rule.tall - t.height} more height`);
    return { id: rule.id, ok: missing.length === 0, missing, says: rule.says };
  });
}

export const bedCap = (t) => Math.floor(t.roofed / FLOOR_PER_BED);
export const bedsCounted = (t) => Math.min(t.groups.bed ?? 0, bedCap(t));

// Where a Rival Lord's crew puts beds in a home they finished (players furnish their own). Pure, Node-tested.
// cells: scan cells as for tally(). Returns up to `cap` beds as [{ foot, head, dir }] relative to the box corner
// and floor (y 1 = standing on the floor). A bed needs both halves on floor, two blocks of headroom, a roof
// overhead, at least two blocks from a door, and never touches another bed. Spots against a wall go first.
// dir is the bed block's "direction" state: the head lies that way from the foot (0 +z, 1 -x, 2 -z, 3 +x).
const BED_STEP = [[0, 1], [-1, 0], [0, -1], [1, 0]];
export function bedPlaces(cells, cap) {
  if (!(cap > 0)) return [];
  const at = new Set(cells.map((c) => `${c.x},${c.y},${c.z}`));
  const covered = new Set(cells.filter((c) => c.y >= 3).map((c) => `${c.x},${c.z}`));
  const doors = cells.filter((c) => c.y === 1 && BLOCK_GROUPS.door.test(c.id));
  const has = (x, y, z) => at.has(`${x},${y},${z}`);
  const free = (x, z) => has(x, 0, z) && !has(x, 1, z) && !has(x, 2, z) && covered.has(`${x},${z}`) && !doors.some((d) => Math.abs(d.x - x) <= 2 && Math.abs(d.z - z) <= 2);
  const wallBy = (x, z) => BED_STEP.filter(([dx, dz]) => has(x + dx, 1, z + dz)).length;
  const spots = [];
  for (const c of cells) {
    if (c.y !== 0 || !free(c.x, c.z)) continue;
    for (let dir = 0; dir < 4; dir++) {
      const [dx, dz] = BED_STEP[dir];
      const hx = c.x + dx, hz = c.z + dz;
      if (!free(hx, hz)) continue;
      // head against a wall reads as a bed; foot sides against walls are fine too
      const score = (has(hx + dx, 1, hz + dz) ? 4 : 0) + wallBy(c.x, c.z) + wallBy(hx, hz);
      spots.push({ foot: { x: c.x, y: 1, z: c.z }, head: { x: hx, y: 1, z: hz }, dir, score });
    }
  }
  spots.sort((a, b) => b.score - a.score || a.foot.x - b.foot.x || a.foot.z - b.foot.z || a.dir - b.dir);
  const taken = [];
  const near = (p) => taken.some((q) => Math.abs(q.x - p.x) + Math.abs(q.z - p.z) <= 1);
  const out = [];
  for (const s of spots) {
    if (out.length >= cap) break;
    if (near(s.foot) || near(s.head)) continue;
    out.push({ foot: s.foot, head: s.head, dir: s.dir });
    taken.push(s.foot, s.head);
  }
  return out;
}

// How many newcomers a Rival Lord's town takes when a player comes near: one a dawn since it was last counted,
// at most SETTLERS.lordCatchUp (a town first seen today takes one)
export const lordArrivals = (lastDawn, day) => Math.max(1, Math.min(SETTLERS.lordCatchUp, Number.isFinite(lastDawn) ? day - lastDawn : 1));
