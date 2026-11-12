// Railway routes: the lines are planned in advance on the map (map/rail-segments.json, made into routes_data.js),
// and the track on each stretch between two stops is laid only when a settlement buys it. You can only buy a
// stretch that starts at a stop you can already reach from home by laid track, so there's no A to C without B.
// Pure code (no Minecraft imports), so it loads in Node tests.
//
// data: { stops: [{ id, name, x, y, z, kind: "plot"|"village"|"junction", plot? }],
//         segments: [{ id, line, from, to (stop ids), blocks: [[x, y, z, kind, dir], ...], length }] }
// built: { [segmentId]: { by (owner id), at (tick or time) } }

export const ROUTE = {
  basePrice: 160, // Regals for any stretch
  perBlock: 1, // and this much per block of it
  homeRange: 140, // a settlement's home stop is the nearest stop this close to its banner
  layPerTick: 12, // track pieces (each grading its own bed) laid every other tick while a stretch goes down
  missedLooks: 2000, // pieces checked every two seconds for ground that has loaded since
  clearUp: 6, // air cleared above the track, 3 wide (6 so tree trunks and low leaves don't hang over it)
  fillDepth: 6, // ground further down than this (or water) gets a bridge deck instead of an embankment
  pierEvery: 4, // a bridge pier under every 4th piece
  pierDepth: 48,
  worksPerTick: 40, // earthwork columns (from the map's works list) set every other tick
};

export const priceOf = (seg) => ROUTE.basePrice + Math.ceil(ROUTE.perBlock * (seg.length ?? seg.blocks.length));

// The other end of a stretch from `stopId`, or undefined if it doesn't touch it
export const otherEnd = (seg, stopId) => (seg.from === stopId ? seg.to : seg.to === stopId ? seg.from : undefined);

// The stop nearest (x, z), if it's within `range`
export function nearestStop(data, x, z, range = ROUTE.homeRange) {
  let best, bestDist = range;
  for (const s of data.stops) {
    const d = Math.hypot(s.x - x, s.z - z);
    if (d < bestDist) { best = s; bestDist = d; }
  }
  return best;
}

// Where a settlement's station goes on its home stop: the stop's own track block, the line through it (from the
// stretch that starts or ends there) and the building toward the banner at `c` (x, z). { stop, origin, forward } or
// undefined when no stop is near or the stop has no straight track under it.
export function stopSite(data, c, range = ROUTE.homeRange) {
  const stop = nearestStop(data, c.x, c.z, range);
  if (!stop) return undefined;
  let dir;
  for (const seg of data.segments) {
    const b = seg.blocks.find(([x, y, z]) => x === stop.x && y === stop.y && z === stop.z);
    if (b && b[3] === 0 && b[4] % 2 === 0) { dir = b[4]; break; }
  }
  if (dir === undefined) return undefined;
  const along_x = dir === 2 || dir === 6;
  const side = (v) => (v < 0 ? -1 : 1);
  const forward = along_x ? { x: 0, z: side(c.z - stop.z) } : { x: side(c.x - stop.x), z: 0 };
  return { stop, origin: { x: stop.x, y: stop.y, z: stop.z }, forward };
}

// Ground and growing things the rail bed may dig through or fill over. Anything else (planks, bricks, glass,
// cobblestone, our own blocks...) is somebody's building: the bed leaves it standing and the buyer is warned.
const NATURAL = new RegExp("^(?!.*stripped_)(minecraft:(stone|granite|diorite|andesite|deepslate|tuff|calcite|dripstone_block|pointed_dripstone|dirt|coarse_dirt|rooted_dirt|dirt_with_roots|grass_block|grass|podzol|mycelium|mud|clay|sand|red_sand|sandstone|red_sandstone|gravel|snow|snow_layer|powder_snow|ice|packed_ice|blue_ice|water|flowing_water|lava|flowing_lava|bedrock|moss_block|moss_carpet|cactus|sugar_cane|reeds|pumpkin|melon_block|bamboo|sculk|(\\w+_)?terracotta|hardened_clay|stained_hardened_clay|\\w+_ore|amethyst_block|smooth_basalt|basalt|magma|netherrack|glow_lichen|hanging_roots|mangrove_roots|muddy_mangrove_roots|brown_mushroom_block|red_mushroom_block|mushroom_stem|large_fern|tall_grass|short_grass|fern|vine|deadbush|dead_bush|waterlily|lily_pad|kelp|seagrass|sweet_berry_bush|sapling|\\w+_sapling|\\w+_flower|dandelion|poppy|\\w+_tulip|blue_orchid|allium|azure_bluet|oxeye_daisy|cornflower|lily_of_the_valley|sunflower|lilac|rose_bush|peony|torchflower|pitcher_plant|spore_blossom|azalea|flowering_azalea|big_dripleaf|small_dripleaf_block|cave_vines\\w*)|[a-z_]+:\\w*(_log|_wood|_leaves|_leaves_flowered|_stem|_hyphae|_roots))$");
export const isNatural = (typeId) => NATURAL.test(typeId);

// Every stop reachable from `home` along laid stretches (a Set of stop ids; empty without a home)
export function reachable(data, built, home) {
  const seen = new Set();
  if (!home) return seen;
  const queue = [home];
  seen.add(home);
  while (queue.length) {
    const at = queue.shift();
    for (const seg of data.segments) {
      if (!built[seg.id]) continue;
      const next = otherEnd(seg, at);
      if (next !== undefined && !seen.has(next)) { seen.add(next); queue.push(next); }
    }
  }
  return seen;
}

// The stretches you may buy: not laid yet, with at least one end you can reach. [{ seg, from, to, price }],
// `from` being the end you reach it from, nearest `near` (x, z) first when given.
export function buyable(data, built, home, near) {
  const reach = reachable(data, built, home);
  const stopById = new Map(data.stops.map((s) => [s.id, s]));
  const out = [];
  for (const seg of data.segments) {
    if (built[seg.id]) continue;
    const from = reach.has(seg.from) ? seg.from : reach.has(seg.to) ? seg.to : undefined;
    if (from === undefined) continue;
    out.push({ seg, from, to: otherEnd(seg, from), price: priceOf(seg) });
  }
  if (near) {
    const d = (o) => { const s = stopById.get(o.from); return s ? Math.hypot(s.x - near.x, s.z - near.z) : Infinity; };
    out.sort((a, b) => d(a) - d(b) || a.price - b.price);
  }
  return out;
}

// Why a stretch can't be bought, or undefined if it can
export function cannotBuy(data, built, home, segId) {
  const seg = data.segments.find((s) => s.id === segId);
  if (!seg) return "There's no such stretch of line.";
  if (built[seg.id]) return "That stretch is already laid.";
  if (!home) return "Your settlement needs a station on the line first.";
  const reach = reachable(data, built, home);
  if (!reach.has(seg.from) && !reach.has(seg.to)) return "You can only extend the line from a stop you can already reach.";
  return undefined;
}

// The track pieces of a stretch as { x, y, z, kind, dir }, in laying order
// works: true where the map's own earthworks stand in for the plain bed: inside the segment's "custom" ranges
// ([[i0, i1], ...] block indexes, inclusive), or everywhere when it has works but no ranges
export const pieces = (seg) => {
  const custom = (i) => (seg.custom ? seg.custom.some(([a, b]) => i >= a && i <= b) : !!seg.works);
  return seg.blocks.map(([x, y, z, kind, dir], i) => ({ x, y, z, kind, dir, works: custom(i) }));
};

// Check a route map for mistakes: returns a list of problems (empty when it's fine)
export function checkRoutes(data) {
  const problems = [];
  const ids = new Set();
  for (const s of data.stops) {
    if (ids.has(s.id)) problems.push(`stop ${s.id} twice`);
    ids.add(s.id);
  }
  const segIds = new Set();
  for (const seg of data.segments) {
    if (segIds.has(seg.id)) problems.push(`segment ${seg.id} twice`);
    segIds.add(seg.id);
    if (!ids.has(seg.from)) problems.push(`segment ${seg.id} starts at unknown stop ${seg.from}`);
    if (!ids.has(seg.to)) problems.push(`segment ${seg.id} ends at unknown stop ${seg.to}`);
    if (seg.from === seg.to) problems.push(`segment ${seg.id} goes nowhere`);
    if (!seg.blocks?.length) problems.push(`segment ${seg.id} has no track`);
    for (const r of seg.custom ?? []) {
      if (r.length !== 2 || r[0] > r[1] || r[0] < 0 || r[1] >= (seg.blocks?.length ?? 0)) { problems.push(`segment ${seg.id} has a bad custom range ${JSON.stringify(r)}`); break; }
    }
    for (const w of seg.works ?? []) {
      if (w.length !== 5 || w[2] > w[3] || !seg.works_palette?.[w[4]]) { problems.push(`segment ${seg.id} has a bad work ${JSON.stringify(w)}`); break; }
    }
    for (const b of seg.blocks ?? []) {
      if (b.length !== 5 || b[3] < 0 || b[3] > 3 || b[4] < 0 || b[4] > 7) { problems.push(`segment ${seg.id} has a bad block ${JSON.stringify(b)}`); break; }
    }
    // a solid work in a track block's own cell would leave a gap: the bed never builds over a solid block
    if (seg.works?.length && seg.blocks?.length) {
      const cols = new Map();
      for (const w of seg.works) if (w[4] !== 0) (cols.get(`${w[0]},${w[1]}`) ?? cols.set(`${w[0]},${w[1]}`, []).get(`${w[0]},${w[1]}`)).push(w);
      const hits = seg.blocks.filter(([x, y, z]) => (cols.get(`${x},${z}`) ?? []).some((w) => y >= w[2] && y <= w[3]));
      if (hits.length) problems.push(`segment ${seg.id}: works fill ${hits.length} track cell(s), first at ${hits[0].slice(0, 3).join(" ")}`);
    }
  }
  return problems;
}
