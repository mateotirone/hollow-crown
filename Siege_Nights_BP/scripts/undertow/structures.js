// What stands at each hand-designed place in the Hollow's centre: simple first versions, built by
// script once the ground under them exists. Pure plans (lists of fills) keyed by site id; the
// builder places them. Layout and one-line briefs: design/hollow-centre-layout.json.
// Nothing here is final art: each plan is short on purpose so it is cheap to change or move.

import { SITES } from "./roads.js";
import { hash } from "./noise.js";

const STONE = "siege:veinstone_bricks", CRACKED = "siege:cracked_veinstone_bricks", COBBLE = "minecraft:cobbled_deepslate";
const POST = "minecraft:cobbled_deepslate_wall", LAMP = "minecraft:soul_lantern";
const PLANK = "minecraft:dark_oak_planks", LOG = "minecraft:dark_oak_log", FENCE = "minecraft:dark_oak_fence";

function maker(s) {
  const ops = [];
  // Coordinates are relative to the site's middle, y = 0 is the ground's top block.
  const box = (x1, y1, z1, x2, y2, z2, block) => ops.push({ a: [s.x + x1, s.y + y1, s.z + z1], b: [s.x + x2, s.y + y2, s.z + z2], block });
  const put = (x, y, z, block) => box(x, y, z, x, y, z, block);
  const lamp = (x, z, tall = 3) => { box(x, 1, z, x, tall, z, POST); put(x, tall + 1, z, LAMP); };
  const signpost = (x, z) => { box(x, 1, z, x, 4, z, POST); box(x - 1, 4, z, x + 1, 4, z, FENCE); box(x, 3, z - 1, x, 3, z + 1, FENCE); put(x, 5, z, LAMP); };
  return { ops, box, put, lamp, signpost };
}

const PLANS = {
  // West crossroads: a four-armed signpost, a lamp, a bench, a marker stone.
  pilgrims_cross: (m) => {
    m.signpost(0, 0); m.lamp(4, -3);
    m.box(-4, 1, 2, -2, 1, 2, "minecraft:polished_blackstone_brick_slab"); // bench
    m.box(3, 1, 4, 3, 2, 4, "minecraft:chiseled_polished_blackstone");
  },
  // East crossroads where the ore carts turn: signpost, lamp, a short stub of rail.
  cartmeet: (m) => {
    m.signpost(0, 0); m.lamp(-4, 3);
    m.box(3, 0, -3, 3, 0, 3, COBBLE); m.box(3, 1, -3, 3, 1, 3, "minecraft:rail");
  },
  // A long stone hall with a broken roof. One table, two seats, one of them knocked over.
  truce_hall: (m, s) => {
    m.box(-7, 0, -15, 7, 0, 15, STONE);
    for (let x = -7; x <= 7; x++) for (let z = -15; z <= 15; z++) {
      if (Math.abs(x) !== 7 && Math.abs(z) !== 15) continue;
      if (z === -15 && Math.abs(x) <= 1) continue; // the door
      const tall = 2 + Math.floor(hash(s.x + x, s.z + z, 901) * 6); // walls broken to different heights
      m.box(x, 1, z, x, tall, z, hash(s.x + x, s.z + z, 902) < 0.3 ? CRACKED : STONE);
    }
    for (let z = -12; z <= 12; z += 6) if (hash(s.x, s.z + z, 903) < 0.6) m.box(-7, 7, z, 7, 7, z, LOG); // what is left of the roof beams
    m.box(-1, 1, 4, 1, 1, 4, PLANK); // the table
    m.put(0, 1, 6, "minecraft:dark_oak_stairs"); // one seat still standing
    m.put(2, 1, 2, "minecraft:dark_oak_slab"); // the other lies where it fell
    m.put(0, 1, 12, "minecraft:lectern"); // for the lore thread's tome
    m.lamp(-5, -13); m.lamp(5, 13);
  },
  // The Hollow's side of the Gate: a tall sealed arch in a rock face, with diggers' works before it.
  far_door: (m) => {
    m.box(-22, 1, -12, -17, 20, 12, "minecraft:basalt"); // the rock face, to the west
    m.box(-17, 1, -5, -16, 15, 5, STONE); // the frame
    m.box(-17, 1, -3, -16, 12, 3, "siege:court_seal"); // sealed
    m.box(-17, 13, -2, -16, 13, 2, "siege:court_seal");
    for (const z of [-8, 8]) { // scaffold towers either side
      for (const [dx, dz] of [[0, 0], [3, 0], [0, 3], [3, 3]]) m.box(-14 + dx, 1, z + dz - 1, -14 + dx, 9, z + dz - 1, FENCE);
      m.box(-14, 5, z - 1, -11, 5, z + 2, PLANK); m.box(-14, 10, z - 1, -11, 10, z + 2, PLANK);
    }
    m.box(-6, -3, -6, -2, 0, -2, "minecraft:air"); m.box(2, -2, 3, 5, 0, 7, "minecraft:air"); // dig pits
    m.lamp(-9, 0);
  },
  // Where the lane ends at the thick forest: a woodcutter's lean-to and a stack of cut lattice.
  lattice_gate: (m) => {
    for (const x of [-3, 0]) m.box(x, 1, -3, x, 3, -3, FENCE);
    m.box(-3, 1, -5, 0, 2, -5, PLANK); m.box(-4, 4, -5, 1, 4, -2, "minecraft:dark_oak_slab");
    m.box(3, 1, 1, 5, 2, 2, "siege:hollowwood_lattice");
    m.lamp(2, -4);
  },
  // The foot of the floating rocks: the first three hang low enough to jump up.
  drift_foot: (m) => {
    [[3, 2, 2], [7, 4, -1], [10, 7, 3]].forEach(([x, y, z], i) => {
      m.box(x - 2, y, z - 2, x + 2, y, z + 2, "siege:undertow_moss");
      m.box(x - 1, y - 2, z - 1, x + 1, y - 1, z + 1, "minecraft:basalt");
      if (i === 2) m.put(x, y + 1, z, "siege:glimbulb");
    });
    m.box(-3, 1, -3, -3, 2, -3, "minecraft:chiseled_polished_blackstone");
  },
  // An open ore face in a cliff, with a timbered mouth.
  the_seams: (m, s) => {
    m.box(9, 1, -9, 15, 11, 9, "minecraft:basalt");
    for (let z = -8; z <= 8; z++) for (let y = 1; y <= 10; y++) if (hash(s.z + z, y, 911) < 0.4) m.put(9, y, z, "siege:choir_ore");
    m.box(9, 1, -1, 12, 3, 1, "minecraft:air"); // the mouth
    for (const z of [-2, 2]) m.box(8, 1, z, 8, 4, z, LOG);
    m.box(8, 4, -2, 8, 4, 2, LOG);
    m.box(-8, 0, 0, 8, 0, 0, COBBLE); m.box(-8, 1, 0, 8, 1, 0, "minecraft:rail"); // the cart rail toward Cartmeet
    m.lamp(6, -4);
  },
  // The first dock a new arrival sees: a plank landing, a lamp, a signpost, a boat frame on the bank.
  wound_dock: (m) => {
    m.box(-3, 0, -5, 3, 0, 1, PLANK);
    m.signpost(4, 2); m.lamp(-4, -5);
    m.box(-1, 1, 3, 1, 1, 5, "siege:hollowwood_lattice"); m.put(0, 1, 4, "minecraft:air"); // a boat being built
  },
};

export const STRUCTURE_IDS = Object.keys(PLANS);
export function planStructure(id) {
  const s = SITES.find((x) => x.id === id);
  if (!s || !PLANS[id]) return [];
  const m = maker(s);
  PLANS[id](m, s);
  return m.ops;
}
