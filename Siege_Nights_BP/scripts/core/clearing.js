// Clearing the map's trees out of a build's ground before it goes down.
//
// Mateo 2026-11-12, after a playtest: "in dead space there are trees spawning, so for builds include air blocks that
// remove trees, and add air blocks above so any floating blocks are removed". The map's trees are baked into the
// world (unbreakable siege:old_ logs and leaves, map/trees). A build stamped over them kept every tree cell it did not
// overwrite: trunks in courtyards, crowns hanging over roofs. So before a build places a block, every tree block in its
// whole area, a margin round it and well above it becomes air. Whole crowns go, so nothing is left floating.
//
// Only tree blocks are touched (logs, wood, leaves, vines, hanging roots), never the ground or another build's walls.
// Builds inside a town (whose own trees are part of the town) opt out.
import { BlockVolume, BlockTypes } from "@minecraft/server";

const WOODS = ["oak", "spruce", "birch", "jungle", "acacia", "dark_oak", "mangrove", "cherry", "pale_oak"];
export const TREE_TYPES = [
  ...WOODS.flatMap((w) => [`minecraft:${w}_log`, `minecraft:${w}_wood`, `minecraft:stripped_${w}_log`, `minecraft:stripped_${w}_wood`, `minecraft:${w}_leaves`]),
  "minecraft:azalea_leaves", "minecraft:azalea_leaves_flowered", "minecraft:vine", "minecraft:hanging_roots", "minecraft:pale_hanging_moss",
  "minecraft:mangrove_roots", "minecraft:mangrove_propagule", "minecraft:bee_nest", "minecraft:cocoa",
  ...WOODS.flatMap((w) => [`siege:old_${w}_log`, `siege:old_${w}_wood`, `siege:old_stripped_${w}_log`, `siege:old_stripped_${w}_wood`, `siege:old_${w}_leaves`]),
  "siege:old_azalea_leaves", "siege:old_azalea_leaves_flowered", "siege:old_hollowwood_core", "siege:old_hollowwood_lattice", "siege:pale_ash",
  // a locked tree's branches (blocks/trees: they look like fences, walls, stairs, slabs and trapdoors, but only trees use them)
  ...["oak", "spruce", "dark_oak", "mangrove"].map((w) => `siege:old_${w}_fence`),
  ...["oak", "dark_oak", "mangrove"].flatMap((w) => [`siege:old_${w}_slab`, `siege:old_${w}_trapdoor`]),
  ...["oak", "spruce", "dark_oak", "mangrove", "tuff", "diorite", "polished_diorite", "mud_brick", "polished_blackstone"].map((m) => `siege:old_${m}_stairs`),
  ...["tuff", "cobbled_deepslate", "diorite", "mud_brick", "polished_blackstone"].map((m) => `siege:old_${m}_wall`),
];
export const CLEAR_MARGIN = 8;   // a crown reaching in from a trunk just outside goes too
export const CLEAR_ABOVE = 32;   // the tallest map trees stand about 30 over their roots
export const CLEAR_BELOW = 4;
const MAX_FILL = 32768;          // the game's limit for one fill

// box: {x0, y0, z0, x1, y1, z1} in world blocks, inclusive (the build's own extent).
// -> the fills that clear it: [{from, to}], each within the game's fill limit.
export function treeClearBoxes(box, margin = CLEAR_MARGIN, above = CLEAR_ABOVE, below = CLEAR_BELOW) {
  const x0 = box.x0 - margin, x1 = box.x1 + margin, z0 = box.z0 - margin, z1 = box.z1 + margin;
  const y0 = box.y0 - below, y1 = box.y1 + above;
  const h = y1 - y0 + 1, step = Math.max(1, Math.min(16, Math.floor(Math.sqrt(MAX_FILL / h))));
  const out = [];
  for (let x = x0; x <= x1; x += step) {
    for (let z = z0; z <= z1; z += step) {
      out.push({ from: { x, y: y0, z }, to: { x: Math.min(x1, x + step - 1), y: y1, z: Math.min(z1, z + step - 1) } });
    }
  }
  return out;
}

// A job step (yield* clearTrees(...) inside system.runJob): one fill a tick.
let known;   // only the types this game knows (a filter naming an unknown block throws)
function treeTypes() {
  known ??= TREE_TYPES.filter((t) => { try { return !!BlockTypes.get(t); } catch { return false; } });
  return known;
}

export function* clearTrees(dim, box) {
  let missed = 0;
  const includeTypes = treeTypes();
  if (!includeTypes.length) return 0;
  const boxes = treeClearBoxes(box);
  for (const { from, to } of boxes) {
    try { dim.fillBlocks(new BlockVolume(from, to), "minecraft:air", { blockFilter: { includeTypes } }); } catch { missed++; }
    yield;
  }
  missed += yield* clearLooseBranches(dim, boxes);
  return missed;
}

// What is left of a tree the fill cut through. The map's trees also branch in fences, walls, stairs, slabs and
// trapdoors (map/trees/species.py), which the fill must not touch (a build's own fences never go), and a tree whose
// trunk stood inside the margin can reach past it. So once the fill is done, every tree or branch block in and round
// the cleared box is grouped (by a face or an edge, the way a stair roof holds), and a group joined to nothing firm
// goes: no branch or crown is left hanging in the air (Mateo 2026-11-14: nothing floats at a story build). A tree
// still standing on its roots, a fence on the ground and a build's trapdoor on its wall all hold.
const BRANCH_WOODS = ["oak", "spruce", "birch", "jungle", "acacia", "dark_oak", "mangrove", "cherry", "pale_oak"];
export const BRANCH_TYPES = [
  ...BRANCH_WOODS.flatMap((w) => [`minecraft:${w}_fence`, `minecraft:${w}_stairs`, `minecraft:${w}_slab`, `minecraft:${w}_trapdoor`]),
  ...["tuff", "cobbled_deepslate", "diorite", "mud_brick", "polished_blackstone"].map((m) => `minecraft:${m}_wall`),
  ...["tuff", "diorite", "polished_diorite", "mud_brick", "polished_blackstone"].map((m) => `minecraft:${m}_stairs`),
  "minecraft:trapdoor", "minecraft:moss_carpet", "minecraft:pale_moss_carpet",
];
export const REMNANT_MARGIN = 8;
// lying on things, holding nothing up: snow, grass, flowers
const LIGHT = /snow_layer|short_grass|tall_grass|fern|flower|tulip|poppy|dandelion|bluet|allium|daisy|cornflower|lily_of_the_valley|leaf_litter|sweet_berry/; // looked at this far past the cleared box (the widest crowns)
const N18 = [];
for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) { const m = Math.abs(a) + Math.abs(b) + Math.abs(c); if (m > 0 && m < 3) N18.push([a, b, c]); }

// Groups of tree blocks joined to nothing firm. seeds: "x,y,z" cells to start from; part(x, y, z): a tree or branch
// block there; firm(x, y, z): any other block that holds (not air, not water). Or pass one function as `part` that
// says which: kind(x, y, z) -> 1 a tree block, 2 firm, 0 nothing (one look at the block instead of two). A group grows past the seeds as far as
// the tree goes, so a crown reaching out of the looked-at box is judged whole; one bigger than `cap` is left be.
// A job step: yields now and then, returns the cells to clear.
export const GROUP_CAP = 20000;
export function* looseGroups(seeds, part, firm, cap = GROUP_CAP) {
  const kind = firm ? (x, y, z) => (part(x, y, z) ? 1 : firm(x, y, z) ? 2 : 0) : part;
  const seen = new Set(), keep = new Set(), out = [];
  let steps = 0;
  for (const start of seeds) {
    if (seen.has(start)) continue;
    const group = [start]; seen.add(start);
    let held = false;
    for (let i = 0; i < group.length && group.length <= cap && !held; i++) {   // held: the rest of it need not be walked
      const [x, y, z] = group[i].split(",").map(Number);
      for (const [a, b, c] of N18) {
        const X = x + a, Y = y + b, Z = z + c, k = `${X},${Y},${Z}`;
        if (seen.has(k)) { if (keep.has(k)) held = true; continue; }
        const t = kind(X, Y, Z);
        if (t === 1) { seen.add(k); group.push(k); } else if (t === 2) held = true;
      }
      if (++steps % 100 === 0) yield;
    }
    if (group.length > cap) held = true;
    if (held) for (const k of group) keep.add(k);
    else out.push(...group);
  }
  return out;
}
export function looseBranches(cells, firm) {
  const g = looseGroups(cells, (x, y, z) => cells.has(`${x},${y},${z}`), firm);
  let r;
  do { r = g.next(); } while (!r.done);
  return r.value;
}

let knownRemnant;
export function* clearLooseBranches(dim, boxes) {
  knownRemnant ??= [...treeTypes(), ...BRANCH_TYPES.filter((t) => { try { return !!BlockTypes.get(t); } catch { return false; } })];
  const cells = new Set();
  let missed = 0;
  // the cleared boxes, and the same again round them
  const xs = boxes.flatMap((b) => [b.from.x, b.to.x]), zs = boxes.flatMap((b) => [b.from.z, b.to.z]);
  const all = { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), y0: boxes[0].from.y, y1: boxes[0].to.y };
  for (const { from, to } of treeClearBoxes(all, REMNANT_MARGIN, 0, 0)) {
    try {
      for (const at of dim.getBlocks(new BlockVolume(from, to), { includeTypes: knownRemnant }, true).getBlockLocationIterator()) cells.add(`${at.x},${at.y},${at.z}`);
    } catch { missed++; }
    yield;
  }
  if (!cells.size) return missed;
  const remnant = new Set(knownRemnant);
  const kind = (x, y, z) => {
    let b;
    try { b = dim.getBlock({ x, y, z }); } catch { return 2; }   // unloaded: leave it be
    if (!b) return 2;
    if (remnant.has(b.typeId)) return 1;
    return b.isAir || b.isLiquid || LIGHT.test(b.typeId) ? 0 : 2;   // snow lying on a crown does not hold it up
  };
  const loose = yield* looseGroups(cells, kind);
  let n = 0;
  for (const k of loose) {
    const [x, y, z] = k.split(",").map(Number);
    try {
      dim.getBlock({ x, y, z })?.setType("minecraft:air");
      const up = dim.getBlock({ x, y: y + 1, z });
      if (up && LIGHT.test(up.typeId)) up.setType("minecraft:air");   // and the snow or plant that sat on it
    } catch { missed++; }
    if (++n % 64 === 0) yield;
  }
  return missed;
}
