// Buildings raised by a placed block (Mateo 2026-11-11: the blocks should spawn a building). Pure, runs in Node.
// Same local frame as every settlement building: the block at (0, 1, 0) just outside the front, +z runs inside.
//   guardhouse   the Barracks: a stone guardhouse with arrow-slit windows, bunks, a weapons corner and a roof walk
//   armoury      the Quartermaster's Desk: an open shop front, the desk as its counter, stores behind
// The Stables barn and the Breeder's yard live with the horses (horses/barndesign.js).

import { Plan } from "../townhall/halls.js";
import { styleFor, pieces } from "./buildings.js";

const { floor, walls, hollow, roof, hang, stair } = pieces;

export function drawGuardhouse(styleId) {
  const p = new Plan(styleFor(styleId));
  const x0 = -4, x1 = 4, z0 = 1, z1 = 9, H = 4;
  floor(p, x0, x1, z0, z1);
  walls(p, x0, x1, z0, z1, 1, H, (y) => (y <= 2 ? "wall" : "wallUpper"));
  hollow(p, x0, x1, z0, z1, 1, H);
  p.fill(-1, 1, z0, 1, 2, z0, "air"); // a wide door: the Barracks block stands in the middle of it, like a post
  for (const z of [3, 5, 7]) { p.set(x0, 2, z, "window"); p.set(x1, 2, z, "window"); } // arrow slits
  // bunks down the left: a bed-sized hay pallet with a chest at its foot
  for (const z of [3, 5, 7]) { p.set(-3, 1, z, "hay"); p.set(-2, 1, z, "chest"); }
  // weapons corner on the right: grindstone, anvil, barrels of arrows
  p.set(3, 1, 3, "grind"); p.set(3, 1, 4, "anvil"); p.set(3, 1, 7, "barrel"); p.set(3, 1, 8, "barrel"); p.set(2, 1, 8, "barrel");
  p.set(0, 1, 8, "table", { half: "top" }); p.set(-1, 1, 8, "seat", stair("-x")); p.set(1, 1, 8, "seat", stair("+x"));
  roof(p, x0, x1, z0, z1, H + 1);
  hang(p, 0, H, 3); hang(p, 0, H, 6);
  return p;
}

export function drawArmoury(styleId) {
  const p = new Plan(styleFor(styleId));
  const x0 = -3, x1 = 3, z0 = 1, z1 = 7, H = 3;
  floor(p, x0, x1, z0, z1);
  walls(p, x0, x1, z0, z1, 1, H, (y) => (y === 1 ? "wallLow" : "wallUpper"));
  hollow(p, x0, x1, z0, z1, 1, H);
  p.fill(-2, 1, z0, 2, 2, z0, "air"); // the open shop front: the desk outside is its counter
  p.fill(x0 + 1, 0, z0 - 1, x1 - 1, 0, z0 - 1, "dais"); // a step of paving in front of the counter
  for (const x of [-2, 2]) p.set(x, 1, z0, "rail");
  p.set(-2, 1, 6, "chest"); p.set(-1, 1, 6, "chest"); p.set(1, 1, 6, "barrel"); p.set(2, 1, 6, "barrel");
  p.set(2, 1, 4, "anvil"); p.set(-2, 1, 4, "grind"); p.set(2, 2, 6, "barrel");
  p.set(0, 2, z1, "window");
  roof(p, x0, x1, z0, z1, H + 1);
  hang(p, 0, H, 3); hang(p, 0, H, 5);
  return p;
}

export const BLOCK_BUILDS = {
  "siege:barracks": { name: "guardhouse", draw: drawGuardhouse },
  "siege:quartermaster_desk": { name: "armoury", draw: drawArmoury },
};
