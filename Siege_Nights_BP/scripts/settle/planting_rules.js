// Planting the plots (Mateo 2026-11-16, looking at a grown Castle in the Town Builder: "if buildings dont take up the
// entire plot it should fill the rest with grass or trees etc. same with empty space around buildings").
//
// The last stage of the town's build order: plots, paths, wall, blending, then planting. Pure code, runs in Node
// (planting.js does the world part). Coordinates are blocks from the Plot Stone, like a layout's slots (towns.js).
//
//   plantPlan({ slot, region, building?, seed?, nearWall?(dx, dz), inBand?(dx, dz), noTrees? }) -> { surface, plants, trees }
//     slot      a slot from towns.js slotsOf
//     building  { box: {x0, z0, x1, z1}, origin: {dx, dz}, forward: {x, z} } where the building stands (seatOnSlot +
//               seatedBox), or undefined for an empty plot: then the plot only gets its ground back, nothing planted
//     nearWall  true where nothing climbable may stand (walldata.js onWallLine, WALLS.reserve)
//     inBand    true where nothing is planted at all: the wall band (Town to Castle walls still overlap some plots)
//     noTrees   no trees on this plot (ground the hall takes later: a tree half cut by its clear box would hang in the air)
//   -> surface: [[dx, dz]]                      every open plot cell, given the region's ground block
//      plants:  [[dx, dz, id, tall]]            one block standing on the ground (tall: a raider could stand on it)
//      trees:   [{ dx, dz, sid, v, stage }]     a grove tree (forestry/grove_data.js, young or sapling) with its trunk at dx, dz
//
// What stays clear: the building and one block round it, the walk to the door (3 wide, from the door to the plot's
// edge), and the plot's outer ring (no bushes or trees there, so a neighbour's path or wall is never crowded).
// Plots by the wall or a gate get flat cover only.

import { GROVE, GROVE_DESIGNS, GROVE_VARIANTS } from "../forestry/grove_data.js";

// Ground and planting per region. top: the ground block; patch: [block, 1 in n] laid in patches like the terraform
// pass (terraform.js REGION) so a plot looks like the land round it. cover: [block, weight] for the low plants;
// bush: one-block shrubs a raider could stand on. coverEvery: 1 in n cells gets a low plant; bushEvery likewise.
export const PLANTING = {
  vale: {
    top: "minecraft:grass_block", patch: ["minecraft:coarse_dirt", 13],
    cover: [["minecraft:short_grass", 40], ["minecraft:fern", 4], ["minecraft:dandelion", 2], ["minecraft:poppy", 1], ["minecraft:oxeye_daisy", 1], ["minecraft:cornflower", 1], ["minecraft:azure_bluet", 1]],
    bush: ["minecraft:azalea", "minecraft:flowering_azalea", "minecraft:oak_leaves"], coverEvery: 1.5, bushEvery: 6,
  },
  frostmarch: {
    top: "minecraft:grass_block", patch: ["minecraft:podzol", 5],
    cover: [["minecraft:short_grass", 14], ["minecraft:fern", 14], ["minecraft:lily_of_the_valley", 2]],
    bush: ["minecraft:spruce_leaves"], coverEvery: 2, bushEvery: 6,
  },
  saltreach: {
    top: "minecraft:grass_block", patch: ["minecraft:gravel", 9],
    cover: [["minecraft:short_grass", 36], ["minecraft:oxeye_daisy", 2], ["minecraft:allium", 1], ["minecraft:azure_bluet", 2]],
    bush: ["minecraft:azalea", "minecraft:oak_leaves"], coverEvery: 1.5, bushEvery: 7,
  },
  emberwaste: {
    top: "minecraft:red_sand", patch: ["minecraft:coarse_dirt", 6],
    cover: [["minecraft:deadbush", 5], ["minecraft:short_dry_grass", 4]],
    bush: [], coverEvery: 3, bushEvery: 0,
  },
  blackfen: {
    top: "minecraft:grass_block", patch: ["minecraft:moss_block", 4],
    cover: [["minecraft:short_grass", 16], ["minecraft:fern", 8], ["minecraft:blue_orchid", 3], ["minecraft:moss_carpet", 5], ["minecraft:brown_mushroom", 1]],
    bush: ["minecraft:azalea", "minecraft:mangrove_leaves"], coverEvery: 1.5, bushEvery: 6,
  },
};
// Blocks that stand on the ground and that a raider can stand on (leaves, azaleas). The rest are walked through.
export const TALL = /leaves|azalea$/;
// The ground under a plant: these are dug out when the plot is dressed and laid again. What's there must be bare ground
// (the cut groundwork leaves dirt), never a path, a log border or something the player built.
export const BARE = /^minecraft:(dirt|coarse_dirt|grass_block|podzol|gravel|stone|red_sand|sand|red_sandstone|sandstone|mud|moss_block|rooted_dirt|andesite|diorite|granite|tuff)$/;

export const PLANT_VERSION = 2; // raise to dress every plot again (planting.js). 2: fuller planting, ground matched to the land
const TREE_EVERY = { S: 1, M: 2, L: 2, G: 3 }; // trees a plot of this size may take, at most
// What each plot size gets round its building. The big plots grow or work their own ground: the Stables barn is
// rebuilt bigger by its upgrades (flat cover only, so nothing is cut in half), the Works dig their pit and race, the
// Forester's Lodge plants its grove and the Dragon Stable its nursery (their ground only, nothing planted)
const DRESS = { S: "all", M: "all", L: "all", G: "all", B: "flat", W: "ground", O: "ground", D: "ground" };

// A well-mixed hash of a cell (a plain multiply-and-xor leaves stripes along the rows)
function hash(x, z, s) {
  let h = Math.imul(x, 73856093) ^ Math.imul(z, 19349663) ^ Math.imul(s, 83492791);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const seedOf = (text) => { let h = 2166136261; for (const c of String(text)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const pick = (list, r) => {
  const total = list.reduce((n, [, w]) => n + w, 0);
  let t = r * total;
  for (const [id, w] of list) { if (w <= 0) continue; if ((t -= w) < 0) return id; }
  return list.find(([, w]) => w > 0)?.[0];
};

// The cells of the walk to the door inside the plot: 3 wide, from the building's front to the plot's edge
export function doorLane(slot, building) {
  const out = new Set();
  if (!building) return out;
  const D = slot.door, R = { x: -D.z, z: D.x };
  const { box } = slot, o = building.origin, b = building.box;
  // start at the building's front edge and walk out along the door's direction until we leave the plot
  let x = o.dx, z = o.dz;
  if (D.z) z = D.z < 0 ? b.z0 - 1 : b.z1 + 1; else x = D.x < 0 ? b.x0 - 1 : b.x1 + 1;
  for (let n = 0; n < 64; n++, x += D.x, z += D.z) {
    if (x < box.x0 || x > box.x1 || z < box.z0 || z > box.z1) break;
    for (let k = -1; k <= 1; k++) out.add(`${x + k * R.x},${z + k * R.z}`);
  }
  return out;
}

export function plantPlan({ slot, region = "vale", building, seed = "", nearWall = () => false, inBand = () => false, noTrees = false }) {
  const P = PLANTING[region] ?? PLANTING.vale;
  const s = seedOf(`${seed}|${slot.id}`);
  const { box } = slot;
  const under = building?.box;
  const inBuilding = (x, z, pad = 0) => under && x >= under.x0 - pad && x <= under.x1 + pad && z >= under.z0 - pad && z <= under.z1 + pad;
  const edge = (x, z) => x === box.x0 || x === box.x1 || z === box.z0 || z === box.z1;
  const lane = doorLane(slot, building);
  const surface = [], plants = [], trees = [];
  for (let x = box.x0; x <= box.x1; x++) for (let z = box.z0; z <= box.z1; z++) if (!inBuilding(x, z)) surface.push([x, z]);
  const dressing = DRESS[slot.size] ?? "ground";
  if (!building || dressing === "ground") return { surface, plants, trees };

  const inPlot = (x, z) => x >= box.x0 && x <= box.x1 && z >= box.z0 && z <= box.z1;
  // low cover may grow right up to the walls (it is walked through); nothing on the walk to the door
  const coverOk = (x, z) => inPlot(x, z) && !inBuilding(x, z) && !lane.has(`${x},${z}`) && !inBand(x, z);
  // anything you could stand on keeps a block off the building and the walk, and off the plot's front edge (the street
  // side, where the door and the plot marker are); the other three edges may hold a bush or a tree's crown
  const D = slot.door;
  const front = (x, z) => (D.z ? z === (D.z < 0 ? box.z0 : box.z1) : x === (D.x < 0 ? box.x0 : box.x1));
  const besideLane = (x, z) => lane.has(`${x + 1},${z}`) || lane.has(`${x - 1},${z}`) || lane.has(`${x},${z + 1}`) || lane.has(`${x},${z - 1}`);
  const flatOnly = dressing === "flat" || (slot.tags ?? []).some((t) => t === "wall" || t === "gate");
  const tallOk = (x, z) => coverOk(x, z) && !inBuilding(x, z, 1) && !besideLane(x, z) && !front(x, z) && !flatOnly && !nearWall(x, z);
  const taken = new Set();

  // trees first: the biggest of the region's grove trees (young, then sapling, every species and shape) whose whole
  // crown fits on ground that may hold tall things. The trunk stands 2 off the building, so the crown never presses on it.
  const species = GROVE[region] ?? [];
  let room = noTrees || flatOnly ? 0 : TREE_EVERY[slot.size] ?? 0;
  if (room && species.length) {
    const spots = [];
    for (let x = box.x0; x <= box.x1; x++) for (let z = box.z0; z <= box.z1; z++) if (tallOk(x, z) && !inBuilding(x, z, 2)) spots.push([x, z, hash(x, z, s)]);
    spots.sort((a, b) => a[2] - b[2]);
    const fits = (x, z, d) => {
      for (let a = d.lo[0]; a <= d.hi[0]; a++) for (let b = d.lo[2]; b <= d.hi[2]; b++) if (!tallOk(x + a, z + b) || taken.has(`${x + a},${z + b}`)) return false;
      return true;
    };
    for (const stage of ["young", "sapling"]) {
      for (const [x, z, r] of spots) {
        if (!room) break;
        const first = Math.floor(r * 997) % species.length;
        let got;
        for (let k = 0; k < species.length * GROVE_VARIANTS && !got; k++) {
          const sid = species[(first + Math.floor(k / GROVE_VARIANTS)) % species.length], v = (Math.floor(r * 7919) + k) % GROVE_VARIANTS;
          const d = GROVE_DESIGNS[`${sid}_${stage}_${v}`];
          if (d && fits(x, z, d)) got = { sid, v, d };
        }
        if (!got) continue;
        trees.push({ dx: x, dz: z, sid: got.sid, v: got.v, stage });
        // its crown and a block round it are taken, so trees and bushes don't grow into each other
        for (let a = got.d.lo[0] - 1; a <= got.d.hi[0] + 1; a++) for (let b = got.d.lo[2] - 1; b <= got.d.hi[2] + 1; b++) taken.add(`${x + a},${z + b}`);
        room--;
      }
    }
  }

  // then bushes and low plants on what's left
  for (let x = box.x0; x <= box.x1; x++) for (let z = box.z0; z <= box.z1; z++) {
    if (!coverOk(x, z) || taken.has(`${x},${z}`)) continue;
    if (P.bushEvery && P.bush.length && hash(x, z, s + 1) * P.bushEvery < 1 && tallOk(x, z)) {
      plants.push([x, z, P.bush[Math.floor(hash(x, z, s + 2) * P.bush.length)], true]);
      continue;
    }
    if (hash(x, z, s + 3) * P.coverEvery < 1) {
      const id = pick(P.cover, hash(x, z, s + 4));
      if (id) plants.push([x, z, id, TALL.test(id)]);
    }
  }
  return { surface, plants, trees };
}

// The ground block for one plot cell: the ground of the land round the plot (top, from localGround), with the
// region's patches only where that ground is the region's own top
export function groundFor(region, x, z, top) {
  const P = PLANTING[region] ?? PLANTING.vale;
  const base = top ?? P.top;
  return base === P.top && hash(x >> 1, z >> 1, 3) * P.patch[1] < 1 ? P.patch[0] : base;
}

// Which ground block the land round a plot is: counts { id: how many of the cells just outside it have it on top }.
// Only plain ground counts (not paths, fields or walls); the commonest wins, the region's top on a tie or when none
// was seen. Redmesa's town ground is pale sand, not the Emberwaste's red sand (Town Builder, 2026-11-16).
export const GROUND = /^minecraft:(grass_block|podzol|sand|red_sand|moss_block|mud|snow|mycelium|coarse_dirt|dirt|gravel|rooted_dirt)$/;
export function localGround(counts, region) {
  const P = PLANTING[region] ?? PLANTING.vale;
  let best = P.top, most = 0;
  for (const [id, n] of Object.entries(counts ?? {})) {
    if (!GROUND.test(id) || /dirt$|gravel/.test(id) && id !== P.top) continue; // bare dirt is what we are covering up
    if (n > most || (n === most && id === P.top)) { best = id; most = n; }
  }
  return best;
}

// ---------- the open ground between plots ----------
// Mateo: "same with empty space around buildings". The town's open ground inside the wall (verges, the middles of its
// blocks) gets low cover and a rare bush. Only ground no tier of the layout ever claims: no plot (of any tier), no path,
// field, fence or anything else its groundwork lays, no fixture and no hall reserve, so a later tier never paves over
// a plant or leaves one standing on a path. Small grove trees too (openGroundTrees), besides the town generator's own.
//   openGroundPlan({ layout, region, seed, inside(dx, dz), nearWall(dx, dz) }) -> [[dx, dz, id, tall]]
//     layout   a towns_data layout (slots, gw groundwork, fix fixtures, hall boxes)
//     inside   true inside the town's wall line now (planting.js: radiusAt, the wall standing)
//     nearWall true where nothing at all is planted (the wall, its steps and lookouts: every ring)
const FIXTURE_REACH = { mason_yard: 9, storehouse: 9, windmill: 9, well: 3 }; // how far round a fixture stays clear
const OPEN_COVER = 3; // low cover on 1 in this many open cells (thinner than a plot's)
const OPEN_BUSH = 45; // a bush on 1 in this many cells well clear of everything
export const OPEN_REACH = 78; // blocks from the Plot Stone looked at (land reaches 74)

export function openGroundPlan(args) {
  return openGround(args).plants;
}
// Small grove trees on the open ground (young where the crown fits, else sapling-sized), spaced out: the trunk 2 from any
// path, plot or fixture, the crown and a block round it never over one (paths stay open to the sky): [{ dx, dz, sid, v, stage }]
export function openGroundTrees(args) {
  return openGround(args).trees;
}
const OPEN_TREE = 20; // a tree tried on 1 in this many open cells
export function openGround({ layout, region = "vale", seed = "", inside = () => true, nearWall = () => false, groundworkOf, slots, fixtures }) {
  const P = PLANTING[region] ?? PLANTING.vale;
  const s = seedOf(`${seed}|open`);
  const claimed = new Set(); // cells something else owns
  const claim = (x0, z0, x1, z1) => { for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) claimed.add(`${x},${z}`); };
  for (const sl of slots) claim(sl.box.x0 - 1, sl.box.z0 - 1, sl.box.x1 + 1, sl.box.z1 + 1);
  for (const b of layout?.hall ?? []) claim(b[0] - 1, b[1] - 1, b[2] + 1, b[3] + 1);
  for (const f of fixtures) { const r = FIXTURE_REACH[f.kind] ?? 2; claim(f.x - r, f.z - r, f.x + r, f.z + r); }
  const built = new Set(); // groundwork that isn't plain ground (a path, a field, a fence, water, a lamp)
  for (let t = 0; t <= 3; t++) for (const [dx, , dz, p] of groundworkOf(t)) {
    const id = layout.pal[p]?.[0] ?? "minecraft:air";
    if (id === "minecraft:air" || id === "minecraft:grass_block" || id === "minecraft:dirt" || id === "minecraft:stone") continue;
    built.add(`${dx},${dz}`);
  }
  const near = (x, z, r) => { for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) if (built.has(`${x + a},${z + b}`) || claimed.has(`${x + a},${z + b}`)) return true; return false; };
  const out = [], trees = [], under = new Set();
  const free = (x, z, r) => !claimed.has(`${x},${z}`) && !built.has(`${x},${z}`) && inside(x, z) && !nearWall(x, z) && !near(x, z, r);
  const species = GROVE[region] ?? [];
  for (let x = -OPEN_REACH; x <= OPEN_REACH && species.length; x++) for (let z = -OPEN_REACH; z <= OPEN_REACH; z++) {
    const r = hash(x, z, s + 9);
    if (r * OPEN_TREE >= 1 || !free(x, z, 2)) continue;
    let got;
    for (const stage of ["young", "sapling"]) for (let k = 0; k < species.length * GROVE_VARIANTS && !got; k++) {
      const sid = species[(Math.floor(r * 99991) + Math.floor(k / GROVE_VARIANTS)) % species.length], v = k % GROVE_VARIANTS;
      const d = GROVE_DESIGNS[`${sid}_${stage}_${v}`];
      if (!d) continue;
      let ok = true;
      for (let a = d.lo[0] - 1; a <= d.hi[0] + 1 && ok; a++) for (let b = d.lo[2] - 1; b <= d.hi[2] + 1; b++) {
        if (under.has(`${x + a},${z + b}`) || !free(x + a, z + b, 0)) { ok = false; break; }
      }
      if (ok) got = { sid, v, stage, d };
    }
    if (!got) continue;
    trees.push({ dx: x, dz: z, sid: got.sid, v: got.v, stage: got.stage });
    for (let a = got.d.lo[0] - 2; a <= got.d.hi[0] + 2; a++) for (let b = got.d.lo[2] - 2; b <= got.d.hi[2] + 2; b++) under.add(`${x + a},${z + b}`);
  }
  for (let x = -OPEN_REACH; x <= OPEN_REACH; x++) for (let z = -OPEN_REACH; z <= OPEN_REACH; z++) {
    const k = `${x},${z}`;
    if (claimed.has(k) || built.has(k) || under.has(k) || !inside(x, z) || nearWall(x, z)) continue;
    if (near(x, z, 1)) continue; // a block of verge stays plain beside every path and plot
    if (P.bushEvery && P.bush.length && hash(x, z, s + 5) * OPEN_BUSH < 1 && !near(x, z, 3)) {
      out.push([x, z, P.bush[Math.floor(hash(x, z, s + 6) * P.bush.length)], true]);
      continue;
    }
    if (hash(x, z, s + 7) * OPEN_COVER * P.coverEvery < 1) {
      const id = pick(P.cover, hash(x, z, s + 8));
      if (id) out.push([x, z, id, TALL.test(id)]);
    }
  }
  return { plants: out, trees };
}

// Whether a plant takes on a ground block. Grass, ferns, flowers and bushes want soil; dry plants (dead bush, dry grass)
// take sand as well; a tree wants soil or sand (the grove's desert trees stand on sand)
const SOIL = /^minecraft:(grass_block|podzol|moss_block|mud|dirt|coarse_dirt|rooted_dirt|mycelium)$/;
const SANDY = /^minecraft:(sand|red_sand|.*terracotta)$/;
export function canGrow(id, ground) {
  if (id === "tree" || /deadbush|dry_grass/.test(id)) return SOIL.test(ground) || SANDY.test(ground);
  return SOIL.test(ground);
}
