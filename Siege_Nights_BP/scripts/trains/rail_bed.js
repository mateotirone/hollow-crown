// The plain rail bed a bought stretch grades for itself, piece by piece (Mateo 2026-11-12: no rail beds in the
// world until a stretch is bought). Pure code: it reads and writes blocks through `w`, so the game (route_game.js)
// and the Node world test (tools/rail_lay_test.mjs, run on the real map) lay exactly the same bed.
//
//   w.get(x, y, z) -> block id ("minecraft:dirt"), or undefined where the ground isn't loaded
//   w.set(x, y, z, id)
//
// What a piece does (Mateo 2026-11-12, after the playtest: "the track didn't correctly spawn"):
// - Trees on the line come down whole: every log, branch, root, leaf and the snow on it, so nothing floats and no
//   root or branch is left in the track's way. A "tree" that touches a building block is left standing (blocked).
// - The bed is ballast three wide at the track's bed level, cleared 6 high, filled with earth under it.
// - Past the bed the land is graded 1 in 2 (the town grading rule): the first block beside the ballast is level
//   with it, then one block up or down per two out, to meet the natural ground: a cutting's sides step back, an
//   embankment's sides step down, never a sheer trench or wall. Graded ground is turfed with the block that topped
//   it before (a road keeps its road surface), so no bare dirt shows.
// - The bed is open to the sky: ground higher over it is cut away (tunnels are the map's works, not the plain bed).
// - Tree roots sunk into the ground leave no pits: they are filled level with the ground round them.
// - Roads and paths crossing the line are level crossings: their surface blocks give way to the bed.
// - Buildings are never touched; the buyer hears where they stand in the way.
// - Where the ground under the middle is more than 6 down or under water, the bed is a stone brick deck on piers.
//
// Each column round the line is graded by the piece nearest to it (its owner), against every piece close by, so the
// result doesn't depend on the order pieces go down, and pieces of other lines already laid are left alone.

import { isNatural } from "./routes.js";

export const BED = {
  clearUp: 6, // air above the track, 3 wide (so tree trunks and low leaves don't hang over it)
  openUp: 24, // and any ground higher over the bed, up to this far, is cut away too: open to the sky
  fillDepth: 6, // ground further down than this (or water) under the middle gets a deck instead of an embankment
  side: 7, // how far from the track the land is graded (the map's works do deeper cuttings and banks)
  window: 8, // pieces either side considered when grading a column
  pierEvery: 4,
  pierDepth: 48,
  treeSpan: 41, // a tree is felled whole when it spans no more than this many blocks across (big crowns touch)
  treeMax: 8000, // and has no more blocks than this
};

export const TRACK = "siege:track";
const AIR = "minecraft:air", BALLAST = "minecraft:gravel", FILL = "minecraft:dirt", DECK = "minecraft:stone_bricks";
const isAir = (t) => t === AIR || t === "minecraft:cave_air" || t === "minecraft:void_air";
const isLiquid = (t) => !!t && /(^|:)(flowing_)?(water|lava)$/.test(t);
// soft natural things: plants, leaves, snow cover. The bed clears them but never stands on them.
const SOFT = /leaves|grass$|tall_grass|fern|flower|sapling|bush|vine|snow_layer|dandelion|poppy|tulip|orchid|allium|bluet|daisy|cornflower|lily|azure|kelp|seagrass|mushroom|torch|moss_carpet|leaf_litter|glow_lichen|hanging_roots|deadbush|dead_bush|reeds|sugar_cane|waterlily|lily_pad|dripleaf|azalea$|peony|lilac|sunflower|rose_bush|pitcher|spore_blossom/;
export const firm = (t) => !!t && !isAir(t) && !isLiquid(t) && !SOFT.test(t) && t !== TRACK;
// a town's rail gate: it opens for trains (gates.js), so the bed leaves it shut
const GATED = /iron_bars|portcullis/;
// road and path surfaces: the line crosses them on the level
const PATHY = /^minecraft:(grass_path|dirt_path|cobblestone|mossy_cobblestone|packed_mud)$/;
// the blocks the map's trees are built from (map/trees: logs, bark blocks, walls, fences, stairs, slabs, trapdoors,
// leaves; locked trees use siege:old_<vanilla name>)
const TREEISH = /^siege:old_|hollowwood|(_log|_wood|_leaves|leaves_flowered|_fence|_wall|_stairs|_slab|_trapdoor|bark_wall\w*)$/;
const TREECORE = /^siege:old_|hollowwood|(_log|_wood|_leaves|leaves_flowered)$/; // (snags use stripped logs)
// what hangs on or lies on a tree and comes down with it
const ON_TREE = /snow_layer|vine|glow_lichen|moss_carpet|leaf_litter|hanging_roots|cocoa|bee_nest|spore_blossom/;
const treeish = (t) => !!t && TREEISH.test(t);
// what hangs under a block and falls with it (roots under mud, vines under leaves)
const HANGS = /hanging_roots|^minecraft:vine$|cave_vines|weeping_vines|spore_blossom|pale_hanging_moss/;
// Clear (x, y, z) and anything hanging under it
function dig(w, x, y, z) {
  w.set(x, y, z, AIR);
  for (let k = 1; k <= 24 && HANGS.test(w.get(x, y - k, z) ?? ""); k++) w.set(x, y - k, z, AIR);
}
// a surface block that turfs graded ground (else plain grass)
const TURF = /^minecraft:(grass_block|podzol|mycelium|moss_block|coarse_dirt|sand|red_sand|snow|gravel|mud|muddy_mangrove_roots|clay|dirt_with_roots|rooted_dirt|calcite|sandstone|red_sandstone|terracotta|\w+_terracotta|hardened_clay|stained_hardened_clay|stone|andesite|diorite|granite|tuff|deepslate|packed_ice|ice|blue_ice)$/;

// May the bed dig this block out? Natural ground and plants, and road surfaces lying open to the sky.
function diggable(t, above) {
  if (!t || isAir(t) || t === TRACK || GATED.test(t)) return false;
  if (isNatural(t) || isLiquid(t)) return true;
  return PATHY.test(t) && (isAir(above) || (!!above && SOFT.test(above)));
}


// Blocks of trees found standing (part of a building, or too big): not searched again
const standing = new Set();
const remember = (keys) => { if (standing.size > 50000) standing.clear(); for (const k of keys) standing.add(k); };

// Fell the tree that (x, y, z) belongs to. true when it came down (or there was none), false when it touches a
// building or is too big to be a tree (then it's left standing), undefined when it reaches ground that isn't loaded.
export function fellTree(w, x, y, z, blocked, built) {
  const start = w.get(x, y, z);
  if (!treeish(start) || standing.has(`${x},${y},${z}`)) return !treeish(start);
  const seen = new Map(), queue = [[x, y, z]];
  seen.set(`${x},${y},${z}`, [x, y, z]);
  let core = false, building = false, big = false, x0 = x, x1 = x, z0 = z, z1 = z;
  while (queue.length && !big) {
    const [cx, cy, cz] = queue.pop();
    if (TREECORE.test(w.get(cx, cy, cz) ?? "")) core = true;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      if (!dx && !dy && !dz) continue;
      const nx = cx + dx, ny = cy + dy, nz = cz + dz, k = `${nx},${ny},${nz}`;
      if (seen.has(k)) continue;
      const t = w.get(nx, ny, nz);
      if (t === undefined) return undefined; // runs into ground that isn't loaded: try again later
      if (treeish(t)) {
        if (built?.has(`${nx},${nz}`)) building = true; // part of the map's works (a timber trestle is logs and fences too)
        x0 = Math.min(x0, nx); x1 = Math.max(x1, nx); z0 = Math.min(z0, nz); z1 = Math.max(z1, nz);
        if (x1 - x0 >= BED.treeSpan || z1 - z0 >= BED.treeSpan || seen.size >= BED.treeMax) { big = true; break; }
        seen.set(k, [nx, ny, nz]); queue.push([nx, ny, nz]);
        continue;
      }
      // a face-touching building block makes it part of a building
      const face = Math.abs(dx) + Math.abs(dy) + Math.abs(dz) === 1;
      if (face && t !== TRACK && !isAir(t) && !isLiquid(t) && !isNatural(t) && !PATHY.test(t) && !GATED.test(t)) building = true;
    }
  }
  if (big || !core || building) { remember(seen.keys()); blocked?.(x, y, z, start); return false; }
  // what lies on it or hangs from it comes down too
  for (const [cx, cy, cz] of [...seen.values()]) {
    for (const [dx, dy, dz] of [[0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, -1, 0]]) {
      const k = `${cx + dx},${cy + dy},${cz + dz}`;
      if (!seen.has(k) && ON_TREE.test(w.get(cx + dx, cy + dy, cz + dz) ?? "")) seen.set(k, [cx + dx, cy + dy, cz + dz]);
    }
  }
  for (const [cx, cy, cz] of seen.values()) dig(w, cx, cy, cz);
  // roots and trunk bases sunk into the ground leave pits: fill them level with the ground round them
  for (const [cx, cy, cz] of [...seen.values()].sort((a, b) => a[1] - b[1])) {
    if (!firm(w.get(cx, cy - 1, cz)) || treeish(w.get(cx, cy - 1, cz))) continue;
    const side = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => w.get(cx + a, cy, cz + b)).filter((t) => firm(t) && !treeish(t));
    if (side.length < 2) continue;
    const top = !firm(w.get(cx, cy + 1, cz));
    const turf = side.find((t) => TURF.test(t)) ?? "minecraft:grass_block";
    w.set(cx, cy, cz, top ? turf : FILL);
  }
  return true;
}

// How far graded ground may stand above (or below) the bed at `d` blocks from the track: level beside the ballast,
// then one block per two out
export const rise = (d) => Math.max(0, Math.floor((d - 1) / 2));

// The pieces near piece i that grade the columns round it
function near(all, i) {
  const out = [];
  for (let j = Math.max(0, i - BED.window); j <= Math.min(all.length - 1, i + BED.window); j++) out.push(j);
  return out;
}

// Which piece owns column (x, z): the nearest, ties to the lower index. -1 when none is within BED.side.
function owner(all, js, x, z) {
  let best = -1, bd = Infinity;
  for (const j of js) {
    const d = Math.max(Math.abs(all[j].x - x), Math.abs(all[j].z - z));
    if (d < bd) { bd = d; best = j; }
  }
  return bd <= BED.side ? best : -1;
}

// The highest block that holds ground at (x, z) from `top` down to `bottom`: { y, id }, or y = bottom - 1
function groundAt(w, x, z, top, bottom) {
  for (let y = top; y >= bottom; y--) {
    const t = w.get(x, y, z);
    if (firm(t) && !treeish(t)) return { y, id: t };
  }
  return { y: bottom - 1, id: undefined };
}

// The columns the map's works build in (bridges, viaducts, portals, banks): "x,z" for every non-air works block of
// every stretch. The plain bed never grades them, so it can't dig out a bridge's earth or stone abutment.
export function builtColumns(routes) {
  const out = new Set();
  for (const seg of routes.segments) for (const [x, z, , , i] of seg.works ?? []) if (i !== 0) out.add(`${x},${z}`);
  return out;
}

// Lay the bed of piece i of a stretch (all: its pieces [{ x, y, z }], y = the block the track sits in).
// blocked(x, y, z, id): a building in the way. built: builtColumns() (left to the works).
// cutOnly: a piece the map's works built (a bridge end, a cutting): only cut back the low ground beside it so it
// meets the graded sides of its neighbours (never a tunnel's hill, never a bank against a bridge).
// Returns false when its ground isn't loaded (try again later).
export function layBed(w, all, i, blocked, built, cutOnly = false) {
  const p = all[i], bed = p.y - 1;
  if (w.get(p.x, p.y, p.z) === undefined) return false;
  if (cutOnly && firm(w.get(p.x, p.y + 5, p.z))) return true; // in a tunnel
  const js = near(all, i);
  // the columns this piece grades
  const cols = [];
  for (let dx = -BED.side; dx <= BED.side; dx++) {
    for (let dz = -BED.side; dz <= BED.side; dz++) {
      const x = p.x + dx, z = p.z + dz;
      const d = Math.max(Math.abs(dx), Math.abs(dz));
      if (owner(all, js, x, z) !== i || (d > 1 && built?.has(`${x},${z}`)) || (cutOnly && d <= 1)) continue;
      if (w.get(x, p.y, z) === undefined) return false; // not loaded yet: the whole piece waits
      cols.push({ x, z, d });
    }
  }
  // each column's ceiling (cut down to) and floor (fill up to), against every piece close by
  for (const c of cols) {
    const { x, z, d } = c;
    c.other = false; // another line's track in this column: left to that line
    for (let y = bed - 1; y <= p.y + 2 && !c.other; y++) if (w.get(x, y, z) === TRACK && !(x === p.x && z === p.z && y === p.y)) c.other = true;
    if (d <= 1) { c.ceil = c.floor = bed; } else {
      let ceil = Infinity, floor = -Infinity;
      for (const j of js) {
        const q = all[j], dj = Math.max(Math.abs(q.x - x), Math.abs(q.z - z)), bj = q.y - 1;
        ceil = Math.min(ceil, bj + rise(dj));
        floor = Math.max(floor, bj - rise(dj));
      }
      if (floor > ceil) floor = ceil; // beside a slope two pieces ask for different levels: the lower one wins (a cut, never a bank over the bed)
      c.ceil = ceil; c.floor = floor;
    }
    c.g = groundAt(w, x, z, d <= 1 ? p.y + BED.openUp : c.ceil + BED.side + 8, bed - BED.fillDepth - 2);
  }
  // 1. trees in the way come down whole before anything is dug, so nothing is left hanging: any tree reaching
  //    into the bed's clear space, and any standing on ground a cutting's side takes away
  for (const c of cols) {
    if (c.other) continue;
    const lo = c.d <= 1 ? bed - BED.fillDepth : c.ceil + 1, hi = c.d <= 1 ? p.y + BED.clearUp : (c.g.y > c.ceil ? c.g.y + 2 : lo - 1);
    for (let y = lo; y <= hi; y++) {
      if (treeish(w.get(c.x, y, c.z)) && fellTree(w, c.x, y, c.z, c.d <= 1 && y >= p.y && y <= p.y + 3 ? blocked : undefined, built) === undefined) return false;
    }
  }
  // 2. deck or embankment, decided by the ground under the middle
  let drop = Infinity;
  for (let d = 0; d <= BED.fillDepth; d++) {
    const t = w.get(p.x, bed - d, p.z);
    if (isLiquid(t)) break;
    if (firm(t)) { drop = d; break; }
  }
  const deck = drop === Infinity;
  // 3. each column, nearest the track first: cut down to its ceiling, fill up to its floor, turf or ballast the top
  cols.sort((a, b) => a.d - b.d);
  for (const c of cols) {
    const { x, z, d, ceil, floor, g } = c;
    if (c.other) continue;
    const turf = g.id && (TURF.test(g.id) || PATHY.test(g.id)) ? g.id : "minecraft:grass_block";
    // cut: clear what stands above the ceiling (beside the bed only up to the old ground and what grows on it)
    // the bed is open to the sky (a cutting, never a slot under rock that would be left hanging); tunnels are works
    const clearTo = d <= 1 ? Math.max(p.y + BED.clearUp, g.y + 1) : Math.max(g.y + 1, ceil + 1);
    for (let y = clearTo; y > ceil; y--) { // top down, so a road surface knows when it lies open to the sky
      const t = w.get(x, y, z);
      if (!t || isAir(t) || t === TRACK || GATED.test(t)) continue;
      if (isLiquid(t) && d > 1) continue; // water beside the line stays
      if (treeish(t)) { // a tree that couldn't be felled: never cut part of one (it would hang in the air)
        if (d <= 1 && y <= p.y + 3) blocked?.(x, y, z, t);
        continue;
      }
      if (!diggable(t, w.get(x, y + 1, z))) {
        if (d <= 1 && y <= p.y + 3) blocked?.(x, y, z, t);
        continue;
      }
      dig(w, x, y, z);
    }
    if (d <= 1) {
      // the bed: ballast (or deck) at bed level over earth down to the ground
      const t = w.get(x, bed, z);
      if (t && !isAir(t) && !isLiquid(t) && !diggable(t, w.get(x, bed + 1, z))) { if (!d) blocked?.(x, bed, z, t); continue; }
      if (deck) { w.set(x, bed, z, DECK); continue; }
      for (let y = bed - 1; y > bed - 1 - BED.fillDepth; y--) {
        const u = w.get(x, y, z);
        if (treeish(u)) { w.set(x, y, z, FILL); continue; } // what's left of a root under the bed
        if (firm(u) || (u && !isAir(u) && !isLiquid(u) && !SOFT.test(u))) break;
        w.set(x, y, z, FILL);
      }
      w.set(x, bed, z, BALLAST);
      continue;
    }
    if (deck) continue; // beside a deck the land is left as it is
    if (cutOnly && g.y > ceil + 2) continue; // deeper cuttings beside the works are the works' own
    if (g.y > ceil) {
      // a cutting's side: turf the new top
      const t = w.get(x, ceil, z);
      if (firm(t) && diggable(t, w.get(x, ceil + 1, z))) w.set(x, ceil, z, turf);
    } else if (g.y < floor && !cutOnly) {
      // an embankment's side: earth up to the floor, turfed (never into water beside the line)
      let wet = false;
      for (let y = g.y + 1; y <= floor; y++) if (isLiquid(w.get(x, y, z))) wet = true;
      if (wet || !g.id || floor - g.y > BED.fillDepth) continue; // (no ground found: a drop, left as it is)
      // never higher than the column next to it toward the track (so a bank too tall to finish leaves no pillar)
      const nx = x - Math.sign(x - p.x), nz = z - Math.sign(z - p.z);
      const top = Math.min(floor, groundAt(w, nx, nz, floor + 1, g.y).y);
      for (let y = g.y + 1; y <= top; y++) {
        const u = w.get(x, y, z);
        if (isAir(u) || (u && SOFT.test(u))) w.set(x, y, z, y === top ? turf : FILL);
      }
    }
  }
  // 4. piers under a deck
  if (deck && i % BED.pierEvery === 0) {
    for (let y = bed - 1, n = 0; n < BED.pierDepth; y--, n++) {
      const t = w.get(p.x, y, p.z);
      if (!t || firm(t)) break;
      w.set(p.x, y, p.z, DECK);
    }
  }
  return true;
}

// May the track go in at its own cell? (after layBed)
export function trackFits(w, p) {
  const t = w.get(p.x, p.y, p.z);
  return t === TRACK || isAir(t) || isLiquid(t) || diggable(t, w.get(p.x, p.y + 1, p.z));
}

// Where the map's works stand in for the plain bed (bridges, tunnels), make sure the track has a block under it:
// a deck stone where the works left the cell under it open (a bridge end meeting a track a block higher)
export function seatTrack(w, p) {
  const u = w.get(p.x, p.y - 1, p.z);
  if (u === undefined || firm(u) || u === TRACK) return;
  if (isAir(u) || isLiquid(u) || SOFT.test(u)) w.set(p.x, p.y - 1, p.z, DECK);
}

// One column of the map's works for a stretch (route_game applies them before the track): blocks y0..y1 at (x, z)
// become `id`. Trees in the way come down whole first; buildings are never touched. false when the ground isn't
// loaded (try again later).
export function applyWorkColumn(w, x, z, y0, y1, id, blocked, built) {
  if (w.get(x, y0, z) === undefined) return false;
  const air = id === AIR;
  // clearing goes top down, so a road surface (or the map's cobble) knows when it lies open to the sky
  for (let k = 0; k <= y1 - y0; k++) {
    const y = air ? y1 - k : y0 + k;
    const t = w.get(x, y, z);
    if (!t || t === TRACK) continue;
    if (treeish(t)) {
      const felled = fellTree(w, x, y, z, blocked, built);
      if (felled === undefined) return false;
      if (!felled) continue;
    } else if (!isAir(t) && !isLiquid(t) && !diggable(t, w.get(x, y + 1, z))) { blocked?.(x, y, z, t); continue; } // never over a building
    if (air && w.get(x, y + 1, z) === TRACK) continue; // never dig out the bed of a line already laid
    if (air) dig(w, x, y, z);
    else w.set(x, y, z, id);
  }
  return true;
}

// Before a stretch's works go in: fell every tree standing in a works column (blocks y0..y1 at (x, z)), so a bridge
// or portal never builds against a tree (it would then count as a building and stay, half cut). false when the
// ground isn't loaded (try again later).
export function clearTreesInColumn(w, x, z, y0, y1, blocked) {
  if (w.get(x, y0, z) === undefined) return false;
  for (let y = y0; y <= y1; y++) if (treeish(w.get(x, y, z)) && fellTree(w, x, y, z, blocked) === undefined) return false;
  return true;
}

// Where the map's works stand in for the plain bed, still keep the train's body clear: natural ground and trees in
// the track cell and the cells round it, 4 high (works never build there). false when not loaded.
export function clearBody(w, p, blocked, built) {
  if (w.get(p.x, p.y, p.z) === undefined) return false;
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (let y = p.y; y < p.y + 4; y++) {
    const x = p.x + dx, z = p.z + dz, t = w.get(x, y, z);
    if (!t || isAir(t) || t === TRACK || GATED.test(t) || isLiquid(t)) continue;
    if (treeish(t)) { if (fellTree(w, x, y, z, blocked, built) === undefined) return false; continue; }
    if (!isNatural(t)) continue; // the works' own blocks and buildings stay
    dig(w, x, y, z);
  }
  return true;
}

// ---------- level crossings (Mateo 2026-11-13) ----------
// Where a road crosses the line, the stretch lays a crossing after its track (map/railcross.py plans it, in the
// region's style): boards in the ballast under the road, setts out to 5 each side, a gate post with a lamp at each
// corner, a short line fence, and on roads a keeper's hut from the building skill on the highest block of its
// footprint, stone plinth down to the ground. It sits on the ground the bed graded, so it goes down after the bed.
// Laying it twice changes nothing. false when the ground isn't loaded (try again later).
const ns = (id) => (id.includes(":") ? id : "minecraft:" + id);
const building = (t) => !!t && !isAir(t) && !isLiquid(t) && !SOFT.test(t) && !treeish(t) && !isNatural(t) && !PATHY.test(t) && t !== TRACK;
export function layCrossing(w, c, blocked) {
  for (const [x, z, y] of [...c.deck, ...c.road]) if (w.get(x, y, z) === undefined) return false;
  for (const [x, z, y] of c.deck) {
    const t = w.get(x, y, z);
    if (t === BALLAST || t === FILL || TURF.test(t) || PATHY.test(t)) w.set(x, y, z, ns(c.deck_block));
  }
  for (const [x, z, y, id] of c.road) {
    const g = groundAt(w, x, z, y + 3, y - 4);
    if (!g.id || !(TURF.test(g.id) || PATHY.test(g.id) || g.id === FILL)) continue;
    const up = w.get(x, g.y + 1, z);
    if (!isAir(up) && !SOFT.test(up ?? "")) continue;
    if (SOFT.test(up ?? "")) w.set(x, g.y + 1, z, AIR);
    w.set(x, g.y, z, ns(id));
  }
  for (const [x, z, y, ids] of c.posts) {
    let there = false;
    for (let k = y - 4; k <= y + 8 && !there; k++) if (w.get(x, k, z) === ns(ids[0])) there = true;
    if (there) continue; // this post stands already
    const g = groundAt(w, x, z, y + 4, y - 4);
    if (!g.id || isLiquid(g.id)) continue;
    let open = true;
    for (let k = 1; k <= ids.length; k++) { const t = w.get(x, g.y + k, z); if (!isAir(t) && !SOFT.test(t ?? "")) open = false; }
    if (!open) continue; // already stands, or something else does
    ids.forEach((id, k) => w.set(x, g.y + 1 + k, z, ns(id)));
  }
  if (c.hut) return layHut(w, c.hut, blocked);
  return true;
}

function layHut(w, h, blocked) {
  const cols = [];
  for (let dx = -h.half - 1; dx <= h.half + 1; dx++) for (let dz = -h.half - 1; dz <= h.half + 1; dz++) cols.push([h.x + dx, h.z + dz, Math.abs(dx) <= h.half && Math.abs(dz) <= h.half]);
  const y0 = h.y ?? 64;
  for (const [x, z] of cols) if (w.get(x, y0, z) === undefined) return false;
  // the trees on and round its footprint come down first
  for (const [x, z] of cols) for (let y = y0 - 6; y <= y0 + 20; y++) {
    if (treeish(w.get(x, y, z))) { const f = fellTree(w, x, y, z, blocked); if (f === undefined) return false; }
  }
  const tops = [];
  for (const [x, z, foot] of cols) {
    for (let y = y0 + 20; y >= y0 - 8; y--) {
      const t = w.get(x, y, z);
      if (building(t) || treeish(t)) return true; // built already, or a building (or a standing tree) is here: no hut
      if (foot && firm(t)) { tops.push(y); break; }
    }
  }
  if (tops.length < (2 * h.half + 1) ** 2) return true;
  const top = Math.max(...tops), low = Math.min(...tops);
  if (top - low > 4) return true; // too steep for a hut
  const floor = top + 1;
  // clear its space, then a stone plinth under every footprint column down to the ground, then the hut
  for (const [x, z] of cols) for (let y = floor; y <= floor + 12; y++) { const t = w.get(x, y, z); if (t && !isAir(t)) dig(w, x, y, z); }
  for (const [x, z, foot] of cols) {
    if (!foot) continue;
    let y = floor - 1;
    while (y > floor - 8 && !firm(w.get(x, y, z))) { w.set(x, y, z, h.plinth); y--; }
  }
  for (const [dx, dy, dz, id, st] of h.blocks) w.set(h.x + dx, floor + dy, h.z + dz, id, st);
  return true;
}
