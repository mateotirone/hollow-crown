// Lamp posts along a settlement's lanes (Mateo 2026-11-13, every build lit; town audit 2026-11-14: every Hamlet had
// lanes darker than 4 at night between the square's lamps and the wall). Pure code (no Minecraft imports), so it
// loads in Node tests.
//
// planLaneLamps(layout, tier, radius, avoid) -> [{ x, z }] in town coordinates (from the Plot Stone): a post beside the lane
// wherever a lane cell inside the wall is more than REACH steps from every lamp. A lantern on a two
// fence post gives light 15 at the post, so 9 steps along the ground still leaves the lane at 4 or more. Posts go on
// a verge cell next to the lane (never on a plot, the hall ground, a fixture or a door walk), the nearest one to the
// dark cell; only where the verge is all taken does a post stand on the edge of a lane three or more wide. radius = the wall's radius at this tier (towns.js wallRadius); avoid = extra boxes [{ x0, z0, x1, z1 }] the posts must stay out of (the town's own slots).

import { groundwork, slotsOf, fixturesOf, hallBox } from "./towns.js";

export const LANE_REACH = 9;
export const DOOR_REACH = 6;
// what a laid lane is made of (the groundwork's top block of a column)
const LANE = /(grass_path|dirt_path|gravel|cobblestone|stone_brick|_bricks$|andesite|tuff|_slab$|_stairs$|packed_mud|coarse_dirt|sandstone|_tiles$|deepslate|castle_)/;

export function planLaneLamps(layout, tier, radius, avoid = [], within) {
  const glow = [];
  const top = new Map(); // "x,z" -> palette id of the column's highest groundwork block (tiers up to this one)
  const topY = new Map();
  for (let t = 0; t <= tier; t++) {
    for (const [dx, dy, dz, p] of groundwork(layout, t)) {
      const id = layout.pal[p]?.[0] ?? "minecraft:air";
      if (id === "minecraft:air") continue;
      const k = `${dx},${dz}`;
      if (/lantern$/.test(id)) glow.push({ x: dx, z: dz, y: dy }); // the layout's own lamp posts (the square, the lanes)
      if ((topY.get(k) ?? -999) <= dy) { topY.set(k, dy); top.set(k, id); }
    }
  }
  const r = radius - 2;
  // inside the wall: the circle, or the wall's own line when the caller has it (a Hamlet's wall is drawn tight round
  // the village, walldata.js radiusAt), two blocks in from it
  const inWall = within ?? ((x, z) => x * x + z * z <= r * r);
  const lane = new Set();
  for (const [k, id] of top) {
    const [x, z] = k.split(",").map(Number);
    if (LANE.test(id) && inWall(x, z)) lane.add(k);
  }
  const boxes = [...avoid];
  for (const s of slotsOf(layout)) boxes.push(s.box);
  // the hall's ground at level 1 is kept clear; the bigger levels' ground only where there is another spot (a hall
  // upgrade takes down everything in its box first, so a post there just goes when the hall grows over the lane)
  const later = [];
  for (let lv = 1; lv <= (layout.hall?.length ?? 0); lv++) { const b = hallBox(layout, lv); if (b) (lv === 1 ? boxes : later).push(b); }
  const blocked = new Set();
  const lamps = [];
  for (let t = 0; t <= tier; t++) {
    for (const f of fixturesOf(layout, t)) {
      if (f.kind === "lamp") lamps.push({ x: f.x, z: f.z });
      for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) blocked.add(`${f.x + a},${f.z + b}`);
    }
  }
  for (const s of slotsOf(layout)) for (const w of s.walk) blocked.add(`${w.x},${w.z}`);
  const inBox = (x, z, list = boxes) => list.some((b) => x >= b.x0 - 1 && x <= b.x1 + 1 && z >= b.z0 - 1 && z <= b.z1 + 1);
  // light spreads through the air whatever the ground is made of (a rutted lane has grass down its middle), so a lane
  // cell counts as lit when a lamp is within REACH steps of it on the map
  // and up or down counts too: a post's lantern is 3 over the ground it stands on, 2 over a lane at its foot, so a
  // lamp up a bank from the lane (or down in a yard) reaches fewer steps along it (town audit 2026-11-14: a woodyard
  // edge in Oakmere at light 3 from a post on the verge above it)
  const lanternY = (l) => l.y ?? (topY.has(`${l.x},${l.z}`) ? topY.get(`${l.x},${l.z}`) + 3 : undefined);
  const lit = (x, z) => lamps.some((l) => {
    const ly = lanternY(l), cy = topY.get(`${x},${z}`);
    const up = ly === undefined || cy === undefined ? 2 : Math.abs(ly - (cy + 1));
    return Math.abs(l.x - x) + Math.abs(l.z - z) + up <= LANE_REACH + 2;
  });
  for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) blocked.add(`${a},${b}`); // the Plot Stone
  for (const g of glow) { lamps.push(g); for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) blocked.add(`${g.x + a},${g.z + b}`); }
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const free = (x, z, soft) => { const k = `${x},${z}`; return !blocked.has(k) && !inBox(x, z) && (soft || !inBox(x, z, later)) && inWall(x, z); };
  // the nearest place for a post within R of (x, z), at least minD away: a verge cell (not lane, a lane cell beside it);
  // where the verge is all taken (a lane squeezed between plots and the hall ground), the edge cell of a lane at
  // least three wide, so two cells of lane still run past the post
  const spot = (x, z, R, minD) => {
    let best;
    for (const [soft, edge] of [[false, false], [false, true], [true, false], [true, true]]) {
      for (let a = -R; a <= R; a++) for (let b = -R; b <= R; b++) {
        const vx = x + a, vz = z + b, d = Math.abs(a) + Math.abs(b);
        if (d < minD || !free(vx, vz, soft) || (best && d >= best.d)) continue;
        const onLane = lane.has(`${vx},${vz}`);
        const ok = edge
          ? onLane && N4.some(([dx, dz]) => !lane.has(`${vx + dx},${vz + dz}`) && lane.has(`${vx - dx},${vz - dz}`) && lane.has(`${vx - 2 * dx},${vz - 2 * dz}`))
          : !onLane && N4.some(([dx, dz]) => lane.has(`${vx + dx},${vz + dz}`));
        if (ok) best = { x: vx, z: vz, d };
      }
      if (best) return best;
    }
    return undefined;
  };
  const out = [];
  // a door step wants light 8 (house rules): a lamp within DOOR_REACH of every plot's front step
  for (const st of slotsOf(layout).filter((q) => q.tier <= tier).map((q) => q.step).sort((a, b) => a.x - b.x || a.z - b.z)) {
    if (lamps.some((l) => Math.abs(l.x - st.x) + Math.abs(l.z - st.z) <= DOOR_REACH)) continue;
    const best = spot(st.x, st.z, 3, 2);
    if (!best) continue;
    out.push({ x: best.x, z: best.z }); lamps.push(best);
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) blocked.add(`${best.x + a},${best.z + b}`);
  }
  // walk the lane cells in a fixed order (outwards from the square), so the same town always gets the same posts
  const cells = [...lane].map((k) => k.split(",").map(Number)).sort((a, b) => (a[0] ** 2 + a[1] ** 2) - (b[0] ** 2 + b[1] ** 2) || a[0] - b[0] || a[1] - b[1]);
  for (const [x, z] of cells) {
    if (lit(x, z)) continue;
    const best = spot(x, z, 4, 0);
    if (!best) continue;
    out.push({ x: best.x, z: best.z });
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) blocked.add(`${best.x + a},${best.z + b}`);
    lamps.push(best);
  }
  return out;
}
