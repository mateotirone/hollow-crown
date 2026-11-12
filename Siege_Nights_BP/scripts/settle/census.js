// What a plot holds: counts of block groups from a scan, and what that makes the building. Plain functions,
// tested in Node. The rules and numbers are in config.js (CONTENTS, BLOCK_GROUPS, FLOOR_PER_BED).
//
//   tally(cells) -> { groups: { group: n }, floor (floor with headroom), roofed (of that, covered), height, beds: [{x,y,z}] }
//       cells: [{ x, y, z, id, head }] for every non-air block in the plot from the floor up (y relative to
//       the floor: 0 is the floor layer). head marks the head half of a bed.
//   matches(t) -> [{ id, ok, missing }]   every CONTENTS rule, checked
//   bedCap(t) -> how many beds may count

import { CONTENTS, BLOCK_GROUPS, FLOOR_PER_BED } from "./config.js";

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
