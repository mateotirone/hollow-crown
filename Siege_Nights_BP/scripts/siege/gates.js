// Gates and portcullises: how they move when opened (Mateo's playtest rules, 2026-11-11).
//
//  - A Castle Gate swings like a door. Every touching gate block of the same kind is one leaf (the way slime
//    blocks move together) and the whole leaf turns on a hinge at one end, ending up flat against the side of
//    the gateway, at a right angle to the wall. It swings away from whoever opens it, or the other way if
//    something is in the way. Closing swings it back to where it hung.
//  - A Portcullis rises: when open only its top piece shows; the pieces below vanish, and nothing of an open
//    portcullis stops you walking through.
//
// Opened leaves are saved (moduleStore), so a gate opened before the world closed still shuts properly.
// planSwing / portcullisLayout are pure and tested below; everything else needs the world.

import { BlockPermutation } from "@minecraft/server";
import { CASTLE_GATES, PORTCULLISES } from "./constants.js";
import { SETTINGS } from "./settings.js";
import { damageMap, saveDamage } from "./walls.js";
import { moduleStore } from "../core/store.js";
import { addTests, assert, assertEqual } from "../core/tests.js";

const NEIGHBOURS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
// a gate leaf also holds together across a corner on the same level (one end set a block deeper in a curved wall)
const LEAF_NEIGHBOURS = [...NEIGHBOURS, [1, 0, 1], [1, 0, -1], [-1, 0, 1], [-1, 0, -1]];
const key = (p) => `${p.x},${p.y},${p.z}`;

// Things a swinging leaf may brush aside (they are gone when it shuts again)
export const SWEPT = new Set([
  "minecraft:air", "minecraft:short_grass", "minecraft:tall_grass", "minecraft:fern", "minecraft:large_fern",
  "minecraft:snow_layer", "minecraft:deadbush", "minecraft:dead_bush", "minecraft:vine", "minecraft:fire",
]);

// ---------- pure geometry ----------

// cells: the closed leaf [{x,y,z}]; facing: the clicked block's minecraft:cardinal_direction;
// at: the clicked block; opener: where the opener stands (or undefined); isFree(pos) -> true if the leaf may go there.
// Returns { face, closed, moves: [{ from, to }] } or undefined when the leaf has nowhere to go. closed is the facing
// the leaf should have when it shuts again (one that matches the way the gateway really runs).
//
// The way the wall runs is read from the leaf itself, not only from its facing: a gate that is wider one way than the
// other runs that way. Settlement walls that follow the village's outline set their gate a block deeper at one end
// than the other, and a gate placed by hand can face the wrong way; going by facing alone, those gates moved one
// column at a time, sideways along the wall, or said something was in the way until the right column was clicked
// (Mateo's playtest 2026-11-14: "takes multiple clicks, and then moves ... not on the correct axis").
export function planSwing(cells, facing, at, opener, isFree) {
  if (!cells.length) return undefined;
  const span = (k) => Math.max(...cells.map((c) => c[k])) - Math.min(...cells.map((c) => c[k]));
  const byFacing = facing === "north" || facing === "south" ? "x" : "z";
  const u = span("x") > span("z") ? "x" : span("z") > span("x") ? "z" : byFacing; // the wall runs along u
  const w = u === "x" ? "z" : "x"; // and the leaf swings out along w
  const closed = u === byFacing ? facing : u === "x" ? "north" : "east";
  // One block per column and height: a gate two blocks thick swings only the layer that was clicked (the one nearest)
  const pick = new Map();
  for (const c of cells) {
    const k = `${c[u]},${c.y}`, old = pick.get(k);
    if (!old || Math.abs(c[w] - at[w]) < Math.abs(old[w] - at[w])) pick.set(k, c);
  }
  const leaf = [...pick.values()];
  const lo = Math.min(...leaf.map((c) => c[u])), hi = Math.max(...leaf.map((c) => c[u]));
  const away = opener ? Math.sign(at[w] + 0.5 - opener[w]) : 0;
  const first = away === 0 ? 1 : away;
  for (const s of [first, -first]) {
    for (const hinge of [lo, hi]) {
      // it opens out from its hinge post; where the far end sits deeper, isFree turns it from a spot still taken
      const post = leaf.filter((c) => c[u] === hinge).map((c) => c[w]);
      const line = s > 0 ? Math.max(...post) : Math.min(...post);
      const face = u === "x" ? (hinge === lo ? "west" : "east") : (hinge === lo ? "north" : "south");
      const moves = leaf.map((c) => {
        const to = { x: 0, y: c.y, z: 0 };
        to[u] = hinge;
        to[w] = line + s * (Math.abs(c[u] - hinge) + 1);
        return { from: { x: c.x, y: c.y, z: c.z }, to };
      });
      if (moves.every((m) => isFree(m.to))) return { face, closed, moves };
    }
  }
  return undefined;
}

// Which pieces of a portcullis stay in sight when it is raised: the top piece of each column.
// Returns a Set of "x,y,z" keys of the pieces that hide.
export function portcullisLayout(cells) {
  const cols = new Map();
  for (const c of cells) {
    const k = `${c.x},${c.z}`;
    cols.set(k, Math.max(cols.get(k) ?? -Infinity, c.y));
  }
  const hidden = new Set();
  for (const c of cells) if (c.y !== cols.get(`${c.x},${c.z}`)) hidden.add(key(c));
  return hidden;
}

// ---------- saved open leaves ----------

const store = moduleStore("siege:gate_leaves", () => ({ open: {} }));
let index; // "dim|x,y,z" (closed or open spot) -> leaf id
const spot = (dim, p) => `${dim}|${key(p)}`;

function leaves() {
  if (!index) {
    index = new Map();
    for (const [id, leaf] of Object.entries(store.data.open)) indexLeaf(id, leaf);
  }
  return store.data.open;
}
function indexLeaf(id, leaf) {
  for (const [fx, fy, fz, tx, ty, tz] of leaf.cells) {
    index.set(spot(leaf.dim, { x: fx, y: fy, z: fz }), id);
    index.set(spot(leaf.dim, { x: tx, y: ty, z: tz }), id);
  }
}
function dropLeaf(id) {
  const leaf = leaves()[id];
  if (!leaf) return;
  for (const [k, v] of [...index]) if (v === id) index.delete(k);
  delete store.data.open[id];
  store.save();
}

// Is this spot part of a gate that swung open (where it hangs now, or the gateway it left)?
export function openLeafAt(dim, location) {
  const id = leaves() && index.get(spot(dim.id, location));
  return id ? store.data.open[id] && id : undefined;
}

// ---------- moving blocks ----------

// Every touching block of the same kind (and, if given, the same open state), up to the gate size limit
function joined(block, sameOpen, around = NEIGHBOURS) {
  const dim = block.dimension, type = block.typeId, seen = new Set(), out = [];
  const queue = [block.location];
  while (queue.length && out.length < SETTINGS.gateMaxSize) {
    const loc = queue.shift();
    const k = key(loc);
    if (seen.has(k)) continue;
    seen.add(k);
    const b = dim.getBlock(loc);
    if (!b || b.typeId !== type) continue;
    if (sameOpen !== undefined && b.permutation.getState("siege:open") !== sameOpen) continue;
    out.push(b);
    for (const [dx, dy, dz] of around) queue.push({ x: loc.x + dx, y: loc.y + dy, z: loc.z + dz });
  }
  return out;
}

const freeAt = (dim, p) => {
  try {
    const b = dim.getBlock(p);
    return !!b && (b.isAir || SWEPT.has(b.typeId));
  } catch {
    return false;
  }
};

function moveDamage(pairs) {
  const map = damageMap();
  let changed = false;
  const carried = pairs.map(([from, to]) => [to, map[key(from)]]);
  for (const [from] of pairs) if (map[key(from)] !== undefined) { delete map[key(from)]; changed = true; }
  for (const [to, dmg] of carried) if (dmg !== undefined) { map[key(to)] = dmg; changed = true; }
  if (changed) saveDamage();
}

const AIR = () => BlockPermutation.resolve("minecraft:air");

// Swing a closed Castle Gate open. Returns "" when it moved, or why it could not.
function swingOpen(block, opener) {
  const dim = block.dimension;
  // Read the kind now: a Block is only a spot, so once the leaf has moved block.typeId is "minecraft:air". The first
  // build saved that as the leaf's kind, so shutting found nothing to move, forgot the leaf and claimed it had
  // shut; the next click then shut it where it hung, turned a quarter, and every open after that walked it further
  // from its gateway (Mateo's playtest 2026-11-13: "now it's like 5 blocks away").
  const type = block.typeId;
  const facing = block.permutation.getState("minecraft:cardinal_direction") ?? "north";
  const cells = joined(block, false, LEAF_NEIGHBOURS);
  const plan = planSwing(cells.map((b) => b.location), facing, block.location, opener, (p) => freeAt(dim, p));
  if (!plan) return "Something is in the way of the gate.";
  // a stale record over these spots (a wall rebuilt round an open gate) is forgotten
  for (const m of plan.moves) { const old = openLeafAt(dim, m.from); if (old) dropLeaf(old); }
  const perms = plan.moves.map((m) => dim.getBlock(m.from).permutation);
  for (const m of plan.moves) dim.getBlock(m.from).setPermutation(AIR());
  plan.moves.forEach((m, i) => {
    dim.getBlock(m.to).setPermutation(perms[i].withState("siege:open", true).withState("minecraft:cardinal_direction", plan.face));
  });
  moveDamage(plan.moves.map((m) => [m.from, m.to]));
  const leaf = { dim: dim.id, type, facing: plan.closed, cells: plan.moves.map((m) => [m.from.x, m.from.y, m.from.z, m.to.x, m.to.y, m.to.z]) };
  const id = spot(dim.id, plan.moves[0].from);
  leaves()[id] = leaf;
  indexLeaf(id, leaf);
  store.save();
  return "";
}

// Swing an open leaf back into its gateway. Returns "" when it moved, or why it could not.
function swingShut(dim, id) {
  const leaf = leaves()[id];
  const cells = leaf.cells.map(([fx, fy, fz, tx, ty, tz]) => ({ from: { x: fx, y: fy, z: fz }, to: { x: tx, y: ty, z: tz } }));
  // leaves saved by the first build have "minecraft:air" for their kind: any Castle Gate where they hang will do
  const isLeaf = CASTLE_GATES.includes(leaf.type) ? (t) => t === leaf.type : (t) => CASTLE_GATES.includes(t);
  const present = cells.filter((c) => isLeaf(dim.getBlock(c.to)?.typeId));
  if (!present.length) { dropLeaf(id); return "The gate is no longer where it swung to."; }
  if (present.some((c) => !freeAt(dim, c.from))) return "Something is standing in the gateway.";
  const perms = present.map((c) => dim.getBlock(c.to).permutation);
  for (const c of present) dim.getBlock(c.to).setPermutation(AIR());
  present.forEach((c, i) => {
    dim.getBlock(c.from).setPermutation(perms[i].withState("siege:open", false).withState("minecraft:cardinal_direction", leaf.facing));
  });
  moveDamage(present.map((c) => [c.to, c.from]));
  dropLeaf(id);
  return "";
}

// Raise or drop a portcullis in place
function setPortcullis(block, open) {
  const cells = joined(block);
  const hidden = open ? portcullisLayout(cells.map((b) => b.location)) : new Set();
  for (const b of cells) {
    b.setPermutation(b.permutation.withState("siege:open", open).withState("siege:hidden", hidden.has(key(b.location))));
  }
}

// Opens or shuts a gate or portcullis. block may also be an empty gateway an open gate swung out of.
// opts.awayFrom: where the opener stands (the leaf swings away from it). opts.player: told if it is stuck.
// Returns true if it moved.
export function moveGate(block, open, { awayFrom, player } = {}) {
  if (!block) return false;
  const dim = block.dimension;
  const type = block.typeId;
  const tell = (why) => { if (why) player?.onScreenDisplay.setActionBar(`§7${why}`); return !why; };
  if (PORTCULLISES.includes(type)) {
    if (block.permutation.getState("siege:open") === open) return false;
    setPortcullis(block, open);
    return true;
  }
  const id = openLeafAt(dim, block.location);
  if (!CASTLE_GATES.includes(type)) {
    // the gateway an open gate left: shut it from here
    return !open && !!id ? tell(swingShut(dim, id)) : false;
  }
  const isOpen = block.permutation.getState("siege:open") === true;
  if (isOpen === open) return false;
  if (!open) {
    if (id) return tell(swingShut(dim, id));
    // a gate opened by an older build of the pack, still hanging in its gateway: just shut it there
    for (const b of joined(block, true)) b.setPermutation(b.permutation.withState("siege:open", false));
    return true;
  }
  return tell(swingOpen(block, awayFrom));
}

addTests("siege", {
  "a gate leaf swings round its hinge, away from the opener": () => {
    // a 3 wide, 2 high gate on an east-west wall (facing north), opener standing to the north (smaller z)
    const cells = [];
    for (let x = 10; x <= 12; x++) for (let y = 64; y <= 65; y++) cells.push({ x, y, z: 5 });
    const plan = planSwing(cells, "north", { x: 11, y: 64, z: 5 }, { x: 11.5, y: 64, z: 1 }, () => true);
    assert(plan, "it has room");
    assertEqual(plan.face, "west", "hinged on the west end");
    const tos = plan.moves.map((m) => m.to);
    assert(tos.every((t) => t.x === 10), "the leaf lies along the hinge column");
    assertEqual(Math.min(...tos.map((t) => t.z)), 6, "starts just past the wall line");
    assertEqual(Math.max(...tos.map((t) => t.z)), 8, "and reaches as far as the gate was wide");
    assertEqual(new Set(tos.map(key)).size, cells.length, "no two blocks land in one spot");
    const far = plan.moves.find((m) => m.from.x === 12 && m.from.y === 65);
    assertEqual(key(far.to), "10,65,8", "the far edge ends up farthest out");
  },
  "a blocked gate swings the other way, or not at all": () => {
    const cells = [{ x: 0, y: 1, z: 0 }, { x: 0, y: 1, z: 1 }]; // on a north-south wall (facing east)
    const south = planSwing(cells, "east", { x: 0, y: 1, z: 0 }, { x: -5, y: 1, z: 0 }, (p) => p.x < 0);
    assert(south && south.moves.every((m) => m.to.x < 0), "pushed east but east is blocked, so it opens west");
    assert(["north", "south"].includes(south.face), "lies flat against the north or south side");
    assertEqual(planSwing(cells, "east", cells[0], undefined, () => false), undefined, "nowhere to go");
  },
  "a gate swings the way its gateway runs, even facing the wrong way": () => {
    // a 3 wide gate on an east-west wall whose blocks face east (placed by hand from the side)
    const cells = [];
    for (let x = 10; x <= 12; x++) for (let y = 64; y <= 65; y++) cells.push({ x, y, z: 5 });
    const plan = planSwing(cells, "east", { x: 11, y: 64, z: 5 }, { x: 11.5, y: 64, z: 1 }, () => true);
    assert(plan, "it opens");
    assertEqual(plan.moves.length, cells.length, "the whole leaf moves, not one column");
    assert(plan.moves.every((m) => m.to.z > 5), "out of the wall line, away from the opener");
    assertEqual(new Set(plan.moves.map((m) => m.to.x)).size, 1, "flat along the hinge column");
    assertEqual(plan.closed, "north", "and shuts facing along its wall");
  },
  "a gate set a block deeper at one end still swings as one leaf": () => {
    // a curved wall: the east column of the gate sits one block further out (z 6 instead of 5)
    const cells = [];
    for (let y = 64; y <= 66; y++) cells.push({ x: 10, y, z: 5 }, { x: 11, y, z: 5 }, { x: 12, y, z: 6 });
    const plan = planSwing(cells, "south", { x: 11, y: 64, z: 5 }, { x: 11.5, y: 64, z: 1 }, () => true);
    assertEqual(plan.moves.length, cells.length, "every block moves");
    assertEqual(Math.min(...plan.moves.map((m) => m.to.z)), 6, "it lies flat out from its hinge post");
    assertEqual(new Set(plan.moves.map((m) => key(m.to))).size, cells.length, "no two blocks land in one spot");
  },
  "a raised portcullis shows only its top piece": () => {
    const cells = [];
    for (let x = 0; x < 3; x++) for (let y = 0; y < 4; y++) cells.push({ x, y, z: 0 });
    cells.push({ x: 5, y: 2, z: 0 }); // a lone block is its own top piece
    const hidden = portcullisLayout(cells);
    for (let x = 0; x < 3; x++) {
      assert(!hidden.has(`${x},3,0`), "top piece shows");
      for (let y = 0; y < 3; y++) assert(hidden.has(`${x},${y},0`), "lower pieces hide");
    }
    assert(!hidden.has("5,2,0"), "a one-high column still shows");
    assertEqual(hidden.size, 9, "nine pieces hide");
  },
});
