// Guard posts: where a guard can be stationed. Pure geometry, runs in Node too.
//
// Every building has a few fixed posts round it (by the door, at the back corners, along the sides of the big
// ones), and the settlement wall has posts spaced evenly all the way round plus one either side of the gate.
// A post here is { key, label, x, z, from } where from = a height to start looking down for the ground (the game
// finds the real standing spot in the world, so a post works on any ground, wall level or foundation).
//
// Wall posts are keyed by their place round the ring (wall:3), not by blocks, so a guard on wall post 3 stays on
// post 3 when the town grows and the wall moves out.

import { WALL_LEVELS, radiusAt, groundAt, WATCH, hasWatch, watchSpots, inWatch } from "../settle/walldata.js";

export const POSTS = {
  wallPosts: 22, // evenly spaced round the ring, besides the two at the gate
  gateGap: 3, // blocks either side of the gate's middle to the gate posts
  doorSide: 3, // blocks from the middle of a building's front to each door post
  manAtArmsLeash: 10, // a stationed Man-at-Arms chases this far from the post in a fight, then goes back
  markerTicks: 10, // how often markers are redrawn while someone is looking at them
  skyHeight: 96, // how high the sky view camera sits over the settlement
  buildingHeight: 30, // and over one building
  // When stationed guards are at their posts (Mateo picked "dusk", 2026-11-12): "dusk" = dusk till dawn, resting by the
  // Barracks by day; "always" = day and night; "shifts" = half by day, half by night. A siege or a Wanted player on your
  // land sends everyone to their post whatever the watch. A guard you just stationed holds the post until the watch changes.
  watch: "dusk",
  dusk: 12500, dawn: 23500, // world time of day
};

const TAU = Math.PI * 2;
const turn = (a) => ((a % TAU) + TAU) % TAU;
const COMPASS = ["east", "south-east", "south", "south-west", "west", "north-west", "north", "north-east"];
export const compassOf = (a) => COMPASS[Math.round(turn(a) / (TAU / 8)) % 8];

// Where on (or behind) the wall a guard stands: how far in from the outer face, and how high to start looking
// down. Wood palisades have nothing to stand on, so their guards stand on the ground just inside; walls with a
// plank walk use the walk; stone walls use the top of the inner face.
export function wallStand(L) {
  if (!L) return undefined;
  if (L.walk) return { d: L.thick, up: L.walk + 3 };
  if (L.body === "log" || L.body === "fence") return { d: L.thick, up: 3 };
  return { d: Math.max(0, L.thick - 1), up: L.h + 3 };
}

// Posts round a wall record (settle/walls.js wallOf): { x, z, radius, level, gate, ground, shape }
export function wallPosts(w) {
  const L = WALL_LEVELS[w?.level];
  const stand = wallStand(L);
  if (!stand || !w.ground?.length) return [];
  const at = (a, d, up, extra) => {
    const r = radiusAt(w, w.radius, a);
    return {
      x: Math.round(w.x + Math.cos(a) * (r - d)), z: Math.round(w.z + Math.sin(a) * (r - d)),
      from: groundAt(w.ground, a) + up, a, out: { x: Math.cos(a), z: Math.sin(a) }, ...extra,
    };
  };
  const out = [];
  // the watchtowers' lookouts first (the levels before the Watch Wall: walldata.js WATCH), so a new Archer climbs a
  // tower before it walks the wall; a wall post that would land in a tower's shaft is left out
  const watch = hasWatch(w.level) ? watchSpots(w, w.radius, w.gate, w.ground) : [];
  for (const s of watch) {
    out.push({ key: `watch:${s.k}`, label: `Watchtower, ${compassOf(s.a)}`, x: s.x + s.forward.x * WATCH.guardOut, z: s.z + s.forward.z * WATCH.guardOut,
      from: s.ground + WATCH.guardUp, a: s.a, out: { x: Math.cos(s.a), z: Math.sin(s.a) }, watch: true });
  }
  // the gate pair stand on the ground just inside the gateway, one either side
  const inside = (L.thick ?? 1) + (L.walk ? 1 : 0) + 1;
  for (const [side, name] of [[-1, "left"], [1, "right"]]) {
    const a = w.gate + (side * POSTS.gateGap) / w.radius;
    out.push(at(a, inside, 3, { key: `gate:${side < 0 ? "l" : "r"}`, label: `Gate, ${name}` }));
  }
  for (let k = 0; k < POSTS.wallPosts; k++) {
    const a = w.gate + ((k + 1) / (POSTS.wallPosts + 1)) * TAU;
    const p = at(a, stand.d, stand.up, { key: `wall:${k}`, label: `Wall, ${compassOf(a)}` });
    if (watch.length && inWatch(watch, p.x, p.z, 1)) continue;
    out.push(p);
  }
  return out;
}

// Posts round a building. box = its world footprint { x0, z0, x1, z1 }; front = the way its door faces out
// ({ x, z }, one of the four winds); floor = the height of its floor.
// Small buildings get the two door posts; anything longer than 11 gets the back corners too, and anything
// wider than 15 a post halfway along each side.
export function buildingPosts(id, box, front, floor) {
  const R = { x: -front.z, z: front.x }; // to the right, looking out of the door
  const cx = (box.x0 + box.x1) / 2, cz = (box.z0 + box.z1) / 2;
  const half = front.x ? (box.x1 - box.x0) / 2 : (box.z1 - box.z0) / 2; // front to back, halved
  const side = front.x ? (box.z1 - box.z0) / 2 : (box.x1 - box.x0) / 2; // left to right, halved
  const spot = (out, right, key, label) => ({
    key: `${id}:${key}`, label,
    x: Math.round(cx + front.x * out + R.x * right), z: Math.round(cz + front.z * out + R.z * right), from: floor + 4,
    out: Math.abs(out) > 0.01 ? { x: front.x * Math.sign(out), z: front.z * Math.sign(out) } : { x: R.x * Math.sign(right), z: R.z * Math.sign(right) },
  });
  const posts = [
    spot(half + 2, -POSTS.doorSide, "dl", "By the door, left"),
    spot(half + 2, POSTS.doorSide, "dr", "By the door, right"),
  ];
  if (half * 2 + 1 > 11) {
    posts.push(spot(-half - 2, -side - 2, "bl", "Back corner, left"), spot(-half - 2, side + 2, "br", "Back corner, right"));
  }
  if (side * 2 + 1 > 15) posts.push(spot(0, -side - 2, "sl", "Left side"), spot(0, side + 2, "sr", "Right side"));
  return posts;
}

// The way out of the door for a building whose design faces in along `forward` (settle/towns.js seatOnSlot)
export const frontOf = (forward) => ({ x: -forward.x || 0, z: -forward.z || 0 });

// Numbers posts 1..n in the order the player sees them listed: the wall first (gate, then round), then each
// building in turn. Returns a new list with .n on every post.
export function numberPosts(sites) {
  let n = 0;
  return sites.map((s) => ({ ...s, posts: s.posts.map((p) => ({ ...p, n: ++n })) }));
}

// The way a guard on this post faces (out from the building or the wall), as a yaw in degrees
export const yawOf = (out) => (out ? (Math.atan2(-out.x, out.z) * 180) / Math.PI : 0);

// The sky view: one camera spot looking straight down with north at the top of the screen.
// radius = how far out the view must reach. Bedrock's camera sees about 35 degrees either side of straight down.
export function skyCamera(center, ground, radius, low = false) {
  const height = low ? POSTS.buildingHeight : Math.max(40, Math.min(POSTS.skyHeight, Math.round(radius * 1.45)));
  return { location: { x: center.x + 0.5, y: ground + height, z: center.z + 0.5 }, rotation: { x: 90, y: 180 } };
}
