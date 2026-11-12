// The hand-designed centre of the Hollow: village sites and the roads between them (layout from
// the Hollow world thread, after Mateo: "custom paths, custom bridges, custom everything" in the
// main area, generated wild land beyond). The generator bends the land to fit these.
// Pure maths, no Minecraft calls.

import { pathX } from "./layout.js";
import { value } from "./noise.js";
import { RIVER_NODES, riverDistance } from "./rivers.js";

// Ground flattened to y inside the radius, with trees, spires and plants kept out.
// A site with no y only keeps features out (the ground stays as generated).
export const SITES = [
  { id: "glimwade", name: "Glimwade", x: -349, z: 343, y: 77, r: 22 },
  { id: "lowseam", name: "Lowseam", x: 414, z: 516, y: 67, r: 22 },
  { id: "tollrest", name: "Tollrest", x: -376, z: 1204, y: 77, r: 22 },
  { id: "highcut", name: "Highcut", x: 406, z: 1250, y: 75, r: 22 },
  // The Standing Ranks: a silent plain of armour stands in uneven rows. A landmark you can walk to,
  // and one of the places the last fight takes you.
  { id: "standing_ranks", name: "The Standing Ranks", x: 280, z: 990, y: 66, r: 40 },
  // The rest of the hand-designed centre (Hollow world thread's layout, design/hollow-centre-layout.json).
  // Working names, not yet confirmed by Mateo. What stands at each is in structures.js.
  { id: "pilgrims_cross", name: "Pilgrim's Cross", x: -342, z: 760, y: 72, r: 10 },
  { id: "cartmeet", name: "Cartmeet", x: 338, z: 792, y: 64, r: 10 },
  { id: "truce_hall", name: "The Truce Hall", x: -276, z: 916, y: 70, r: 24 },
  { id: "far_door", name: "The Far Door", x: -646, z: 774, y: 85, r: 26 },
  { id: "lattice_gate", name: "The Lattice Wood", x: 330, z: 250, y: 84, r: 8 },
  { id: "drift_foot", name: "The Drift", x: 100, z: 836, y: 85, r: 10 },
  { id: "the_seams", name: "The Seams", x: 528, z: 904, y: 65, r: 16 },
  { id: "wound_dock", name: "The Wound landing", x: -58, z: 153, y: 66, r: 8 },
  // The Cold Forge: where Morvane's smiths sang the Choir's armour. High on the eastern terraces past
  // the Seams, with no road up. The only place a Choirsteel Upgrade template can be found (forge.js).
  { id: "cold_forge", name: "The Cold Forge", x: 592, z: 1080, y: 119, r: 14 },
  { id: "vault_stair", name: "Vault Stair", x: pathX(2312) + 5, z: 2312, r: 4 },
];
export const SITE_SKIRT = 14; // blocks over which a flattened site eases back into the land

export function siteAt(x, z) {
  for (const s of SITES) {
    const d = Math.hypot(x - s.x, z - s.z);
    if (d <= s.r + SITE_SKIRT) return { site: s, d };
  }
  return undefined;
}

// Roads start on the story path (the Spine) at leaveZ, or at another site (from), and wander to their end.
//   stop    how far short of the end's middle the road finishes (default: just inside a site's edge)
//   narrow  a 2-wide track with no lamp posts
// Where a road meets a light river it goes over on an arched bridge (BRIDGE_DECK_Y or higher).
const land = (id) => RIVER_NODES.find((n) => n.id === id);
const site = (id) => SITES.find((s) => s.id === id);
export const ROADS = [
  { id: "glimwade", leaveZ: 380, to: site("glimwade"), stop: 16, wander: 12 },
  { id: "lowseam", leaveZ: 470, to: site("lowseam"), stop: 16, wander: 12 },
  { id: "tollrest", leaveZ: 1150, to: site("tollrest"), stop: 16, wander: 12 },
  { id: "highcut", leaveZ: 1290, to: site("highcut"), stop: 16, wander: 12 },
  { id: "wound_landing", leaveZ: 118, to: site("wound_dock"), wander: 3 },
  { id: "court_landing", leaveZ: 1440, to: land("court"), stop: 8, wander: 5 },
  { id: "seat_landing", leaveZ: 2200, to: land("seat"), stop: 8, wander: 5 },
  { id: "west_road_south", from: site("glimwade"), to: site("pilgrims_cross"), wander: 14 },
  { id: "west_road_mid", from: site("pilgrims_cross"), to: site("truce_hall"), wander: 6 },
  { id: "west_road_north", from: site("truce_hall"), to: site("tollrest"), wander: 14 },
  { id: "door_track", from: site("pilgrims_cross"), to: site("far_door"), wander: 10, narrow: true },
  { id: "cross_west", leaveZ: 760, to: site("pilgrims_cross"), wander: 10 },
  { id: "cross_east", leaveZ: 760, to: site("cartmeet"), wander: 10 },
  { id: "east_road_south", from: site("lowseam"), to: site("cartmeet"), wander: 12 },
  { id: "east_road_mid", from: site("cartmeet"), to: site("standing_ranks"), wander: 8 },
  { id: "east_road_north", from: site("standing_ranks"), to: site("highcut"), wander: 12 },
  { id: "lattice_lane", leaveZ: 250, to: site("lattice_gate"), wander: 12 },
  { id: "wood_road", from: site("lattice_gate"), to: site("lowseam"), wander: 14 },
  { id: "drift_path", leaveZ: 820, to: site("drift_foot"), wander: 4, narrow: true },
  { id: "seam_rail", from: site("cartmeet"), to: site("the_seams"), wander: 4 },
];
export const ROAD_HALF_WIDTH = 2; // about 4 wide (narrow tracks: 1)
export const ROAD_SHOULDER = 8; // the land eases to the road over this distance
export const BRIDGE_DECK_Y = 67; // lowest bridge deck: the water is at 62, so a boat passes under
const BRIDGE_REACH = 11; // a road within this distance of a river's middle is on its bridge
const STEP = 3; // blocks between points along a road
const MAX_RISE = 2; // per STEP: never steeper than about 2 in 3
export const roadHalfWidth = (id) => (ROADS.find((r) => r.id === id)?.narrow ? 1 : ROAD_HALF_WIDTH);

// Each road as a list of points [x, z] about STEP apart, with gentle bends.
const LINES = ROADS.map((r, k) => {
  const inside = (s) => (s?.r ? Math.max(2, s.r - 3) : 0);
  const ax0 = r.from ? r.from.x : pathX(r.leaveZ), az0 = r.from ? r.from.z : r.leaveZ;
  const full = Math.hypot(r.to.x - ax0, r.to.z - az0), ux = (r.to.x - ax0) / full, uz = (r.to.z - az0) / full;
  const head = inside(r.from), stop = r.stop ?? inside(r.to);
  const ax = ax0 + ux * head, az = az0 + uz * head, len = full - head - stop;
  const n = Math.max(2, Math.round(len / STEP)), pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const off = r.wander * Math.sin(Math.PI * t) * (value(i / 9, k * 5.7, 600) - 0.5) * 2;
    pts.push([ax + ux * len * t - uz * off, az + uz * len * t + ux * off]);
  }
  return pts;
});
export const roadLines = () => LINES;

// Heights along each road, worked out once from the land (ground(x, z) = height before roads):
// never under water, over rivers on a bridge deck, and smoothed so the road is never too steep
// (it cuts through rises and ramps up to bridges).
let profiles;
function buildProfiles(ground, floorY) {
  profiles = LINES.map((pts) => {
    const floor = pts.map(([x, z]) => (riverDistance(Math.round(x), Math.round(z)) <= BRIDGE_REACH ? BRIDGE_DECK_Y : floorY));
    const h = pts.map(([x, z], i) => Math.max(floor[i], ground(Math.round(x), Math.round(z)) ?? floorY));
    for (let i = 1; i < h.length; i++) h[i] = Math.min(h[i], h[i - 1] + MAX_RISE);
    for (let i = h.length - 2; i >= 0; i--) h[i] = Math.min(h[i], h[i + 1] + MAX_RISE);
    // Meet the start at its own height, stay above water and on the bridge decks, then ramp between.
    const start = Math.max(floorY, ground(Math.round(pts[0][0]), Math.round(pts[0][1])) ?? floorY);
    for (let i = 0; i < h.length; i++) h[i] = Math.max(h[i], floor[i], start - Math.max(0, i - 2) * MAX_RISE);
    for (let i = 1; i < h.length; i++) h[i] = Math.max(h[i], h[i - 1] - MAX_RISE);
    for (let i = h.length - 2; i >= 0; i--) h[i] = Math.max(h[i], h[i + 1] - MAX_RISE);
    return h;
  });
}

const near = new Map();
function segsNear(x, z) {
  const gx = x >> 5, gz = z >> 5, key = gx * 4096 + gz;
  let list = near.get(key);
  if (list) return list;
  list = [];
  const mx = gx * 32 + 16, mz = gz * 32 + 16, r = ROAD_SHOULDER + 28;
  LINES.forEach((pts, k) => {
    for (let i = 0; i + 1 < pts.length; i++) {
      const [x1, z1] = pts[i];
      if (Math.abs(x1 - mx) <= r && Math.abs(z1 - mz) <= r) list.push([k, i]);
    }
  });
  if (near.size > 400) near.clear();
  near.set(key, list);
  return list;
}

// The road beside or under a column: { d: distance to its middle, y: road height, s: blocks along it },
// or undefined when no road is within its shoulder.
export function roadAt(x, z, ground, floorY) {
  const list = segsNear(x, z);
  if (!list.length) return undefined;
  if (!profiles) buildProfiles(ground, floorY);
  let best;
  for (const [k, i] of list) {
    const [x1, z1] = LINES[k][i], [x2, z2] = LINES[k][i + 1];
    const dx = x2 - x1, dz = z2 - z1;
    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / (dx * dx + dz * dz)));
    const d = Math.hypot(x - (x1 + dx * t), z - (z1 + dz * t));
    if (d <= ROAD_SHOULDER && (!best || d < best.d)) {
      const h = profiles[k];
      best = { d, y: Math.round(h[i] + (h[i + 1] - h[i]) * t), s: (i + t) * STEP, road: ROADS[k].id, half: ROADS[k].narrow ? 1 : ROAD_HALF_WIDTH, lamps: !ROADS[k].narrow };
    }
  }
  return best;
}

// ---- signposts ---------------------------------------------------------------------------
// Mateo, 2026-11-12: signposts with place names at the junctions. A post at each end of every road,
// a few steps in from where it leaves the valley road or a site, standing on the road's right-hand
// verge and turned to face back toward the junction, so you read it before you take the road.
// { x, z, rot (standing sign ground_sign_direction 0-15, 0 faces south), text, road }. Pure.
const placeName = (p) => (p?.name ? p.name.replace(/^The /, "the ") : "the valley road");
// The sign rotation whose face looks along (vx, vz): 0 south, 4 west, 8 north, 12 east.
export const signRot = (vx, vz) => ((Math.round(Math.atan2(-vx, vz) / (Math.PI / 8)) % 16) + 16) % 16;
let posts;
export function signposts() {
  if (posts) return posts;
  posts = [];
  ROADS.forEach((r, k) => {
    const pts = LINES[k], half = r.narrow ? 1 : ROAD_HALF_WIDTH;
    const end = (i, toward, dest) => {
      const j = Math.max(0, Math.min(pts.length - 1, i));
      const [x, z] = pts[j], [tx, tz] = pts[toward];
      const nx = pts[Math.min(pts.length - 1, j + 1)], px = pts[Math.max(0, j - 1)];
      const dx = nx[0] - px[0], dz = nx[1] - px[1], len = Math.hypot(dx, dz) || 1;
      const side = toward === 0 ? 1 : -1; // the verge on your right as you walk in from the junction
      const sx = Math.round(x + (-dz / len) * (half + 2) * side), sz = Math.round(z + (dx / len) * (half + 2) * side);
      posts.push({ x: sx, z: sz, rot: signRot(tx - sx, tz - sz), road: r.id, text: dest ? `§7The road to\n§5${placeName(dest)}` : "§7Back to\n§5the valley road" });
    };
    end(r.from ? 4 : 2, 0, r.to); // where it starts: names where it goes
    end(pts.length - 1 - 4, pts.length - 1, r.from); // where it ends: names where it came from
  });
  return posts;
}
