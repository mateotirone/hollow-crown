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
  for (const { from, to } of treeClearBoxes(box)) {
    try { dim.fillBlocks(new BlockVolume(from, to), "minecraft:air", { blockFilter: { includeTypes } }); } catch { missed++; }
    yield;
  }
  return missed;
}
