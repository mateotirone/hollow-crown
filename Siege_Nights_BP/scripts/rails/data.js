// Rails: plain data and maths (no Minecraft imports, so it loads in Node tests).

export const RAIL_SETTINGS = {
  discoverRange: 12, // walk or ride this close to a Station Post to discover it
  arriveRange: 14,
  railSearch: 5, // "Call a minecart" looks this far from the post for a rail
  cartIdleTicks: 1200, // empty station carts are tidied away after a minute
  express: true, // push carts on straight, flat track (set false if carts misbehave)
  expressSpeed: 0.6, // blocks per tick (vanilla tops out at 0.4)
  expressPush: 0.08,
  maxStations: 120,
};

export const REGIONS = ["Aldmere Vale", "Frostmarch", "Saltreach", "Emberwaste", "Blackfen", "Kingsrest"];
export const CARRIAGE = "siege:carriage"; // the four-seat Train Carriage (pack files: studio/build_carriage.py)
export const CARRIAGE_ITEM = "siege:train_carriage";
export const CARRIAGE_SPEED = 0.6; // its top speed on rails, set in the entity file (a minecart's is 0.4)
export const RIDES = ["minecraft:minecart", CARRIAGE]; // what counts as riding the line
export const RAILS = ["minecraft:rail", "minecraft:golden_rail", "minecraft:detector_rail", "minecraft:activator_rail"];

const POINTS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
// Minecraft: north is -z, east is +x
export function heading(from, to) {
  const angle = Math.atan2(to.x - from.x, -(to.z - from.z)); // 0 = north, clockwise
  return POINTS[((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8];
}
export const distance = (a, b) => Math.round(Math.hypot(a.x - b.x, a.z - b.z));
export const wayTo = (from, station) => `${distance(from, station)} m ${heading(from, station)}`;

export const nextId = (stations) => stations.reduce((max, s) => Math.max(max, s.id), 0) + 1;

export function nearestStation(stations, loc, dim, range = Infinity) {
  let best, bestDist = range;
  for (const s of stations) {
    if (s.dim !== dim) continue;
    const d = Math.hypot(s.x - loc.x, s.z - loc.z);
    if (d <= bestDist && Math.abs(s.y - loc.y) <= 24) {
      best = s;
      bestDist = d;
    }
  }
  return best;
}

// The network map: every station by region, names only for the ones this player has found
export function networkLines(stations, found, from) {
  const lines = [];
  const groups = new Map();
  for (const s of stations) {
    const key = s.owner ? "Depots" : s.region;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  for (const [region, list] of groups) {
    lines.push(`§6${region}`);
    for (const s of list) lines.push(found.includes(s.id) ? `  §f${s.name}§7, ${wayTo(from, s)}` : "  §8???");
  }
  return lines;
}

// Straight, flat track along x or z? rail_direction 0 = north-south, 1 = east-west
export function expressAxis(velocity) {
  const ax = Math.abs(velocity.x), az = Math.abs(velocity.z);
  if (Math.abs(velocity.y) > 0.01) return undefined;
  if (ax > 0.2 && az < 0.01) return { x: Math.sign(velocity.x), z: 0, railDirection: 1, speed: ax };
  if (az > 0.2 && ax < 0.01) return { x: 0, z: Math.sign(velocity.z), railDirection: 0, speed: az };
  return undefined;
}
