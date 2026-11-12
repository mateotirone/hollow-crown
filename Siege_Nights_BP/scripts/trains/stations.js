// Railway stations: which building a settlement's station is, the plan the build engine raises, and where it
// stands against the track. Pure code (no Minecraft imports), so it loads in Node tests.
//
// The designs (settle/station_data.js, from map/structures/stations.py) share one frame: the line runs along
// local x at z = 0, x = 0 is mid-platform, the building is behind the platform at +z and y = 0 is the platform
// layer. In the build engine's terms the origin (local 0, 1, 0) is the track block in the middle of the platform
// and "forward" points from the track to the building.

import { Plan } from "../townhall/halls.js";
import { drawData } from "../townhall/designs.js";
import { styleFor } from "../settle/buildings.js";
import { STATION_DESIGNS } from "../settle/station_data.js";

export const STAGES = ["halt", "station", "junction", "grand"];
export const STAGE_NAMES = { halt: "Halt", station: "Station", junction: "Junction", grand: "Grand Station" };
export const TIER_STAGE = { Hamlet: "halt", Town: "station", City: "junction", Castle: "grand" };
export const stageFor = (tierName) => TIER_STAGE[tierName] ?? "halt";

export const STATION = {
  runOn: 2, // track laid this far past each end of the platform, so it meets the line
  clearUp: 4, // the line and the strip beside it are cleared this high
  findTrack: 8, // a new station lines up with straight track this close to its post (blocks across)
  findTrackUp: 3,
  noTrackBack: 3, // with no track near, the line goes this far behind the post (the building in front)
  noTrackLift: 1, // and this much higher than the post, so the platform stands on the ground and the track on a bed
  perTick: 48, // blocks placed per tick while it rises
};

export const regionOf = (style) => (STATION_DESIGNS[style] ? style : "vale");

const plans = new Map();

// The plan for one region's station at one stage: the design, a bed under the line and clear air above it.
// plan.line = { x0, x1 }: where the track goes (local x, at y 1, z 0).
export function stationPlan(style, stage) {
  const region = regionOf(style);
  if (!STATION_DESIGNS[region][stage]) stage = "halt";
  const key = `${region}|${stage}`;
  if (plans.has(key)) return plans.get(key);
  const st = styleFor(region);
  const d = STATION_DESIGNS[region][stage];
  const prefix = `sd:${region}:${stage}`;
  d.palette.forEach(([id], i) => { st.roles[`${prefix}:${i}`] = [id]; });
  const p = new Plan(st);
  drawData(p, d, prefix);
  const x0 = d.box.x0 - STATION.runOn, x1 = d.box.x1 + STATION.runOn;
  for (let x = x0; x <= x1; x++) {
    if (!p.get(x, 0, 0)) p.set(x, 0, 0, "foundation");
    p.column(x, 0, "foundation");
    for (let z = -1; z <= 1; z++) {
      for (let y = 1; y <= STATION.clearUp; y++) {
        if (z === 0 && y === 1) continue; // the track's own block: laid after, and kept if track is already there
        if (!p.get(x, y, z)) p.set(x, y, z, "air");
      }
    }
  }
  p.line = { x0, x1 };
  p.design = d;
  plans.set(key, p);
  return p;
}

// World offset of a local (x, z) for a forward direction (same maths as the build engine's frame)
export function rightOf(forward) {
  return { x: -Math.sign(forward.z), z: Math.sign(forward.x) };
}

// The track's own direction index along the line for a forward direction: 0 (north-south) or 2 (east-west)
export const lineDir = (forward) => (rightOf(forward).x !== 0 ? 2 : 0);

// Where a station goes for a post at `post`: lined up with straight north-south or east-west track nearby
// (get(x, y, z) -> track shape or undefined), else with the line `noTrackBack` behind the post and the building
// in front, facing `facing` (a unit x/z vector, the way the player looked or toward the settlement).
// Returns { origin, forward, onTrack }.
export function siteFor(post, get, facing) {
  let best, bestDist = Infinity;
  const R = STATION.findTrack, U = STATION.findTrackUp;
  for (let dy = -U; dy <= U; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      for (let dz = -R; dz <= R; dz++) {
        if (!dx && !dz) continue;
        const s = get(post.x + dx, post.y + dy, post.z + dz);
        if (!s || s.kind !== 0 || s.dir % 2 === 1) continue;
        // the post must stand beside the line, not along it
        const across = s.dir === 2 ? Math.abs(dz) : Math.abs(dx);
        if (across < 2) continue;
        const dist = dx * dx + dz * dz + dy * dy * 4;
        if (dist < bestDist) { bestDist = dist; best = { x: post.x + dx, y: post.y + dy, z: post.z + dz, dir: s.dir }; }
      }
    }
  }
  if (best) {
    const forward = best.dir === 2 ? { x: 0, z: Math.sign(post.z - best.z) } : { x: Math.sign(post.x - best.x), z: 0 };
    return { origin: { x: best.x, y: best.y, z: best.z }, forward, onTrack: true };
  }
  const f = cardinal(facing);
  return { origin: { x: post.x - f.x * STATION.noTrackBack, y: post.y + STATION.noTrackLift, z: post.z - f.z * STATION.noTrackBack }, forward: f, onTrack: false };
}

// Nearest of north/east/south/west to a direction vector
export function cardinal(v) {
  const x = v?.x ?? 0, z = v?.z ?? 1;
  if (Math.abs(x) > Math.abs(z)) return { x: Math.sign(x), z: 0 };
  return { x: 0, z: z < 0 ? -1 : 1 };
}

// Track pieces for the line through a station: [{ x, y, z, dir }] in world coordinates
export function lineBlocks(plan, origin, forward) {
  const r = rightOf(forward), dir = lineDir(forward);
  const out = [];
  for (let x = plan.line.x0; x <= plan.line.x1; x++) out.push({ x: origin.x + x * r.x, y: origin.y, z: origin.z + x * r.z, dir });
  return out;
}
