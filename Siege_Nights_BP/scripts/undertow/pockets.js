// Pocket places for the last fight: small, self-contained arenas in the Hollow's dimension, far
// outside the generated world (which stops at x = 700), so being thrown into one is a clean cut.
// They are built once, by script, the first time they are asked for.
//
//   night    "The Night It Ended": a bright stone great hall, a memory of the old kingdom.
//            Warm light, no Hollow blocks at all.
//   river    A stretch of light river with rock rafts to stand on, walled in by dark.
//   room     A small warm stone room for the reveal scene: a desk spot (face) with clear floor
//            around it, and a corner behind a partition (entry) where the watchers are parked.
//   fall0-9  "The Fall": one deep shaft per player, with broken ledges on the way down.
//
// For the boss code (see finale.js for the single import):
//   POCKETS                     the list: id, name, entry point, bounds
//   requestPockets(ids?)        start building (all of them when no list is given)
//   pocketReady(id)             true once built
//   enterPocket(player, id)     teleport there; false if it is not built yet
// Testing: /scriptevent hc:room_look warm|king|hollow (while standing in the room), /scriptevent hc:pocket night|river|room|fall0..fall9   (builds it if needed, then takes you there)

import { world, system, BlockVolume } from "@minecraft/server";
import { UNDERTOW_ID } from "./layout.js";
import { hash } from "./noise.js";
import { load, save, say, runCmd } from "./data.js";

const K = "hc:undertow_pockets"; // list of built pocket ids
const X = 1200; // every pocket sits on this line, well clear of the world
export const FALL_SHAFTS = 10;

const NIGHT = { x: X, y: 100, z: 300, halfW: 20, len: 60, high: 14 };
const RIVER = { x: X, y: 100, z0: 740, len: 120, halfW: 8 };
const ROOM = { x: X, y: 100, z: 100, halfW: 4, len: 15, high: 5 }; // inside: 9 wide, 15 long, 5 high
const FALL = { z: 1400, top: 190, bottom: 70, gap: 80 };

export const POCKETS = [
  { id: "night", name: "The Night It Ended", entry: { x: NIGHT.x + 0.5, y: NIGHT.y + 1, z: NIGHT.z + 4.5 }, face: { x: NIGHT.x + 0.5, y: NIGHT.y + 2, z: NIGHT.z + NIGHT.len },
    min: { x: NIGHT.x - NIGHT.halfW - 1, y: NIGHT.y - 1, z: NIGHT.z - 1 }, max: { x: NIGHT.x + NIGHT.halfW + 1, y: NIGHT.y + NIGHT.high + 1, z: NIGHT.z + NIGHT.len + 1 } },
  { id: "river", name: "The River", entry: { x: RIVER.x + 0.5, y: RIVER.y + 2, z: RIVER.z0 + 3.5 }, face: { x: RIVER.x + 0.5, y: RIVER.y + 2, z: RIVER.z0 + RIVER.len },
    min: { x: RIVER.x - RIVER.halfW - 2, y: RIVER.y - 3, z: RIVER.z0 - 1 }, max: { x: RIVER.x + RIVER.halfW + 2, y: RIVER.y + 14, z: RIVER.z0 + RIVER.len + 1 } },
  // The figure at the desk faces +z, away from entry. 9 clear blocks behind the desk, 5 in front.
  { id: "room", name: "The Room", entry: { x: ROOM.x + 4.5, y: ROOM.y + 1, z: ROOM.z + 1.5 }, face: { x: ROOM.x + 0.5, y: ROOM.y + 1, z: ROOM.z + 9.5 },
    min: { x: ROOM.x - ROOM.halfW - 1, y: ROOM.y - 1, z: ROOM.z - 1 }, max: { x: ROOM.x + ROOM.halfW + 1, y: ROOM.y + ROOM.high + 1, z: ROOM.z + ROOM.len } },
];
for (let i = 0; i < FALL_SHAFTS; i++) {
  const x = X + i * FALL.gap;
  POCKETS.push({ id: `fall${i}`, name: "The Fall", entry: { x: x + 0.5, y: FALL.top, z: FALL.z - 2.5 }, face: { x: x + 0.5, y: FALL.top - 6, z: FALL.z + 3 },
    min: { x: x - 5, y: FALL.bottom - 1, z: FALL.z - 5 }, max: { x: x + 5, y: FALL.top + 4, z: FALL.z + 5 } });
}
export const pocket = (id) => POCKETS.find((p) => p.id === id);

// ---- plans (pure: lists of fills) ----------------------------------------------------------
// One fill, cut into slices along z so no single fill is over Minecraft's 32,768 block limit.
const op = (ops, a, b, block) => {
  const slab = (Math.abs(b[0] - a[0]) + 1) * (Math.abs(b[1] - a[1]) + 1);
  const deep = Math.max(1, Math.floor(30000 / slab));
  for (let z = a[2]; z <= b[2]; z += deep) ops.push({ a: [a[0], a[1], z], b: [b[0], b[1], Math.min(b[2], z + deep - 1)], block });
};

function planNight() {
  const { x, y, z, halfW: w, len, high } = NIGHT, ops = [];
  op(ops, [x - w - 1, y - 1, z - 1], [x + w + 1, y + high + 1, z + len + 1], "minecraft:stone_bricks"); // shell
  op(ops, [x - w, y + 1, z], [x + w, y + high, z + len], "minecraft:air");
  op(ops, [x - w, y, z], [x + w, y, z + len], "minecraft:polished_andesite"); // floor
  op(ops, [x - w - 1, y + high + 1, z - 1], [x + w + 1, y + high + 1, z + len + 1], "minecraft:dark_oak_planks"); // roof
  op(ops, [x - 1, y + 1, z + 2], [x + 1, y + 1, z + len - 9], "minecraft:red_carpet"); // the aisle
  // Pillars down both sides, each with a lantern; glowing stone set into the roof above the aisle.
  for (let k = 5; k < len - 12; k += 9) {
    for (const side of [-1, 1]) {
      const px = x + side * (w - 5);
      op(ops, [px, y + 1, z + k], [px, y + high, z + k], "minecraft:chiseled_stone_bricks");
      op(ops, [px - side, y + 1, z + k], [px - side, y + 3, z + k], "minecraft:stone_brick_wall");
      op(ops, [px - side, y + 4, z + k], [px - side, y + 4, z + k], "minecraft:lantern");
      // Long feasting tables between the pillars and the aisle
      op(ops, [x + side * 7, y + 1, z + k - 3], [x + side * 9, y + 1, z + k + 3], "minecraft:spruce_planks");
    }
    op(ops, [x, y + high + 1, z + k], [x, y + high + 1, z + k], "minecraft:glowstone");
    op(ops, [x - 8, y + high + 1, z + k], [x - 8, y + high + 1, z + k], "minecraft:glowstone");
    op(ops, [x + 8, y + high + 1, z + k], [x + 8, y + high + 1, z + k], "minecraft:glowstone");
  }
  // The dais and the high seat at the far end
  op(ops, [x - 9, y + 1, z + len - 8], [x + 9, y + 1, z + len], "minecraft:smooth_stone");
  op(ops, [x - 6, y + 2, z + len - 5], [x + 6, y + 2, z + len], "minecraft:smooth_stone");
  op(ops, [x - 1, y + 3, z + len - 2], [x + 1, y + 3, z + len - 1], "minecraft:polished_andesite");
  op(ops, [x - 1, y + 4, z + len - 1], [x + 1, y + 7, z + len - 1], "minecraft:polished_andesite");
  op(ops, [x, y + 8, z + len - 1], [x, y + 8, z + len - 1], "minecraft:gold_block");
  for (const side of [-1, 1]) { // banners of light either side of the seat
    op(ops, [x + side * 5, y + 3, z + len - 1], [x + side * 5, y + 5, z + len - 1], "minecraft:stone_brick_wall");
    op(ops, [x + side * 5, y + 6, z + len - 1], [x + side * 5, y + 6, z + len - 1], "minecraft:lantern");
  }
  return ops;
}

// The room has three looks, swapped in step with the reveal scene (same walls, different blocks):
// a child's warm study, a king's chamber, and the dark, cracked, purple of the Seat.
export const ROOM_LOOKS = {
  warm: { wall: "minecraft:stone_bricks", floor: "minecraft:spruce_planks", roof: "minecraft:dark_oak_planks", shelf: "minecraft:bookshelf", light: "minecraft:glowstone", glass: "minecraft:glass_pane" },
  king: { wall: "minecraft:polished_andesite", floor: "minecraft:dark_oak_planks", roof: "minecraft:dark_oak_planks", shelf: "minecraft:chiseled_stone_bricks", light: "minecraft:glowstone", glass: "minecraft:glass_pane", trim: "minecraft:gold_block" },
  hollow: { wall: "minecraft:cracked_deepslate_bricks", floor: "minecraft:blackstone", roof: "siege:veil_rock", shelf: "siege:hollowwood_lattice", light: "siege:hollowwood_core", glass: "minecraft:tinted_glass", trim: "siege:veinstone" },
};
// fresh = also clear the inside (first build only: re-skinning must not touch what stands in the room).
function planRoom(look = "warm", fresh = true) {
  const { x, y, z, halfW: w, len, high } = ROOM, ops = [], L = ROOM_LOOKS[look];
  const z1 = z + len - 1;
  op(ops, [x - w - 1, y, z - 1], [x + w + 1, y + high, z - 1], L.wall); // back wall
  op(ops, [x - w - 1, y, z1 + 1], [x + w + 1, y + high, z1 + 1], L.wall); // far wall
  for (const side of [-1, 1]) op(ops, [x + side * (w + 1), y, z], [x + side * (w + 1), y + high, z1], L.wall);
  op(ops, [x - w - 1, y - 1, z - 1], [x + w + 1, y - 1, z1 + 1], L.wall); // under the floor
  if (fresh) op(ops, [x - w, y + 1, z], [x + w, y + high, z1], "minecraft:air");
  op(ops, [x - w, y, z], [x + w, y, z1], L.floor);
  op(ops, [x - w - 1, y + high + 1, z - 1], [x + w + 1, y + high + 1, z1 + 1], L.roof);
  // Shelves along both side walls beside and beyond the desk; light from the corners.
  for (const side of [-1, 1]) {
    op(ops, [x + side * w, y + 1, z + 7], [x + side * w, y + 3, z1 - 1], L.shelf);
    op(ops, [x + side * (w - 1), y + high + 1, z1 - 1], [x + side * (w - 1), y + high + 1, z1 - 1], L.light);
    op(ops, [x + side * (w - 1), y + high + 1, z + 5], [x + side * (w - 1), y + high + 1, z + 5], L.light);
    if (L.trim) op(ops, [x + side * w, y + 4, z + 7], [x + side * w, y + 4, z1 - 1], L.trim);
  }
  op(ops, [x - 1, y + 2, z1 + 1], [x + 1, y + 3, z1 + 1], L.glass); // a window ahead of the desk
  // A partition in the back corner: the watchers stand behind it, out of the cameras' sight.
  op(ops, [x + 2, y + 1, z + 3], [x + w, y + high, z + 3], L.wall);
  return ops;
}

// Change the room's look on the spot (the room is loaded: the watchers are standing in it).
export function dressRoom(look) {
  if (!ROOM_LOOKS[look] || !pocketReady("room")) return false;
  const d = dim();
  for (const { a, b, block } of planRoom(look, false)) {
    try { d.fillBlocks(new BlockVolume({ x: a[0], y: a[1], z: a[2] }, { x: b[0], y: b[1], z: b[2] }), block); } catch { return false; }
  }
  return true;
}
// Which look each beat of the reveal scene (bestiary/reveal.js) puts the room in.
export const REVEAL_LOOKS = { black: "warm", room: "warm", age_king: "king", age_morvane: "hollow", end: "warm" };

function planRiver() {
  const { x, y, z0, len, halfW: w } = RIVER, ops = [], z1 = z0 + len;
  const dark = "minecraft:black_concrete";
  op(ops, [x - w - 2, y - 3, z0 - 1], [x + w + 2, y - 3, z1 + 1], dark); // under the bed
  for (const side of [-1, 1]) op(ops, [x + side * (w + 1), y - 2, z0 - 1], [x + side * (w + 2), y + 14, z1 + 1], dark); // walls
  op(ops, [x - w, y - 2, z0 - 1], [x + w, y + 14, z0 - 1], dark);
  op(ops, [x - w, y - 2, z1 + 1], [x + w, y + 14, z1 + 1], dark);
  op(ops, [x - w - 2, y + 14, z0 - 1], [x + w + 2, y + 14, z1 + 1], dark); // lid
  op(ops, [x - w, y - 2, z0], [x + w, y - 2, z1], "siege:glimmerflow"); // the glowing bed
  op(ops, [x - w, y - 1, z0], [x + w, y, z1], "minecraft:water");
  op(ops, [x - w, y + 1, z0], [x + w, y + 13, z1], "minecraft:air");
  // A landing at each end, and rock rafts between: some big, some barely a foothold.
  op(ops, [x - w, y - 1, z0], [x + w, y + 1, z0 + 6], "minecraft:blackstone");
  op(ops, [x - w, y - 1, z1 - 6], [x + w, y + 1, z1], "minecraft:blackstone");
  for (let k = 0, z = z0 + 11; z < z1 - 9; k++, z += 6 + Math.floor(hash(k, 0, 811) * 3)) {
    const rx = x + Math.round((hash(k, 0, 812) - 0.5) * 2 * (w - 3)), r = hash(k, 0, 813) < 0.3 ? 2 : 1;
    op(ops, [rx - r, y - 1, z - r], [rx + r, y + 1, z + r], "minecraft:basalt");
  }
  return ops;
}

function planFall(i) {
  const x = X + i * FALL.gap, z = FALL.z, ops = [];
  op(ops, [x - 5, FALL.bottom - 1, z - 5], [x + 5, FALL.top + 4, z + 5], "minecraft:blackstone"); // shell (14,000 blocks)
  op(ops, [x - 4, FALL.bottom, z - 4], [x + 4, FALL.top + 3, z + 4], "minecraft:air");
  op(ops, [x - 4, FALL.bottom, z - 4], [x + 4, FALL.bottom + 2, z + 4], "minecraft:water"); // something to land in
  op(ops, [x - 4, FALL.top - 1, z - 4], [x + 4, FALL.top - 1, z - 2], "minecraft:polished_blackstone"); // where you start
  // Broken ledges, a different side each time, with gaps knocked out of them.
  for (let k = 1, y = FALL.top - 8; y > FALL.bottom + 8; k++, y -= 6 + Math.floor(hash(i, k, 821) * 4)) {
    const side = Math.floor(hash(i, k, 822) * 4);
    for (let t = -4; t <= 4; t++) for (let depth = 0; depth < 3; depth++) {
      if (hash(i * 100 + k, t * 4 + depth, 823) < 0.3) continue;
      const lx = side === 0 ? x - 4 + depth : side === 1 ? x + 4 - depth : x + t;
      const lz = side === 2 ? z - 4 + depth : side === 3 ? z + 4 - depth : z + t;
      op(ops, [lx, y, lz], [lx, y, lz], t === 0 && depth === 0 ? "siege:hollowwood_core" : "minecraft:basalt"); // one glowing block marks each ledge
    }
  }
  return ops;
}
export const planPocket = (id) => (id === "night" ? planNight() : id === "room" ? planRoom() : id === "river" ? planRiver() : planFall(Number(id.slice(4))));

// ---- building ----------------------------------------------------------------------------
const built = () => load(K, []);
export const pocketReady = (id) => built().includes(id);

const queue = [];
let job, waitUntil = 0, tries = 0;
const AREA = "hc_undertow_pocket";
const dim = () => world.getDimension(UNDERTOW_ID);

export function requestPockets(ids = POCKETS.map((p) => p.id)) {
  const done = built();
  for (const id of ids) if (pocket(id) && !done.includes(id) && !queue.includes(id) && job?.id !== id) queue.push(id);
}

// Called every few ticks from index.js. Keeps one pocket's chunks loaded while it is built.
export function pocketTick() {
  if (system.currentTick < waitUntil) return;
  const d = dim();
  if (!job) {
    const id = queue.shift();
    if (!id) return;
    const p = pocket(id);
    runCmd(d, `tickingarea remove ${AREA}`);
    runCmd(d, `tickingarea add ${p.min.x} 0 ${p.min.z} ${p.max.x} 0 ${p.max.z} ${AREA} true`);
    job = { id, ops: planPocket(id), i: 0 };
    tries = 0;
    waitUntil = system.currentTick + 40;
    return;
  }
  for (let budget = 120; budget > 0 && job.i < job.ops.length; budget--) {
    const { a, b, block } = job.ops[job.i];
    try {
      d.fillBlocks(new BlockVolume({ x: a[0], y: a[1], z: a[2] }, { x: b[0], y: b[1], z: b[2] }), block);
    } catch {
      // Not loaded yet. Give it a minute, then set this pocket aside (it is asked for again next time).
      waitUntil = system.currentTick + 40;
      if (++tries > 30) { job = undefined; runCmd(d, `tickingarea remove ${AREA}`); }
      return;
    }
    job.i++;
  }
  if (job.i >= job.ops.length) {
    save(K, [...built(), job.id]);
    job = undefined;
    if (!queue.length) runCmd(d, `tickingarea remove ${AREA}`);
  }
}

export function enterPocket(player, id) {
  const p = pocket(id);
  if (!p || !pocketReady(id)) return false;
  try {
    player.teleport(p.entry, { dimension: dim(), facingLocation: p.face });
    return true;
  } catch {
    return false;
  }
}

system.afterEvents.scriptEventReceive.subscribe((e) => {
  if (e.id === "siege:morvane_reveal") {
    let beat;
    try { beat = JSON.parse(e.message).beat; } catch { return; }
    if (REVEAL_LOOKS[beat]) dressRoom(REVEAL_LOOKS[beat]);
    return;
  }
  if (e.id === "siege:morvane_stage") return void dressRoom("warm"); // any stage start or restart: ready to play again
  if (e.id === "hc:room_look") return void dressRoom(e.message.trim());
  if (e.id !== "hc:pocket") return;
  const player = e.sourceEntity, id = e.message.trim();
  if (!pocket(id)) return say(player, `§7Pockets: ${POCKETS.map((p) => p.id).join(", ")}`);
  if (enterPocket(player, id)) return;
  requestPockets([id]);
  say(player, `§7Building ${pocket(id).name}. Run this again in about half a minute.`);
});
