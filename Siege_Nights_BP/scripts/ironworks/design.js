// The Ironworks buildings, one per level, each drawn over the last (pure, runs in Node). Placing them: index.js.
// Local frame as for every settlement building: the Ironworks block at (0, 1, 0) in front, +z runs in.
// Odd sizes (Mateo's rule): the yard is 9 wide, the Forge adds the wheel on the left (11 wide in all).

import { Plan } from "../townhall/halls.js";
import { styleFor, pieces } from "../settle/buildings.js";

const { floor, hang, stair } = pieces;

export function drawIronworks(level, styleId) {
  const p = new Plan(styleFor(styleId));
  const x0 = -4, x1 = 4, z0 = 1, z1 = 9;
  floor(p, x0, x1, z0, z1, "path");
  // a low rail round the yard, open at the front
  for (let x = x0; x <= x1; x++) { if (x !== 0) p.set(x, 1, z0, "rail"); p.set(x, 1, z1, "rail"); }
  for (let z = z0; z <= z1; z++) { p.set(x0, 1, z, "rail"); p.set(x1, 1, z, "rail"); }
  for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) p.fill(x, 1, z, x, 2, z, "pillar", { axis: "y" });
  p.set(0, 1, z0, "air");

  // the ore pit: 3 x 3, three deep, stone-lined, a ladder down its front
  p.fill(-2, -3, 3, 2, 0, 7, "cobble");
  p.fill(-1, -2, 4, 1, 0, 6, "air");
  p.set(0, -3, 4, "cobble");
  for (let y = -2; y <= 0; y++) p.set(0, y, 3, "scaffold"); // climbable either way
  p.set(0, 0, 3, "air"); p.set(0, 1, 3, "air");

  // the storeroom: a lean-to across the back with a chest and barrels
  p.fill(-3, 1, 8, 3, 3, 8, "air");
  for (const x of [-3, 3]) p.fill(x, 1, 8, x, 3, 8, "pillar", { axis: "y" });
  p.fill(-4, 4, 7, 4, 4, 9, "roofSlab");
  p.set(-2, 1, 8, "chest"); p.set(-1, 1, 8, "barrel"); p.set(1, 1, 8, "barrel"); p.set(2, 1, 8, "craft");
  hang(p, 0, 3, 8);

  if (level >= 2) {
    // the bloomery: a squat stone furnace with its mouth to the pit and a chimney, charcoal bins beside it
    p.fill(2, 1, 3, 3, 3, 5, "wallLow");
    p.fill(2, 4, 4, 2, 6, 4, "cobble");
    p.set(2, 1, 4, "blast", { dir: "-x" });
    p.set(3, 4, 3, "roofSlab"); p.set(3, 4, 5, "roofSlab");
    p.set(-3, 1, 3, "barrel"); p.set(-3, 1, 4, "barrel"); p.set(-3, 2, 3, "barrel");
  }
  if (level >= 3) {
    // the trip-hammer: a waterwheel on the left drives a beam over an anvil
    const wx = -6, cy = 3, cz = 5, r = 3;
    p.fill(wx, 0, cz - 3, wx, 0, cz + 3, "water");
    for (let a = 0; a < 360; a += 15) {
      const y = Math.round(cy + Math.sin((a * Math.PI) / 180) * r), z = Math.round(cz + Math.cos((a * Math.PI) / 180) * r);
      p.set(wx, y, z, "beam", { axis: "x" });
    }
    p.fill(wx, cy - r + 1, cz, wx, cy + r - 1, cz, "pillar", { axis: "y" });
    p.fill(wx, cy, cz - r + 1, wx, cy, cz + r - 1, "pillar", { axis: "z" });
    p.fill(wx + 1, cy, cz, -3, cy, cz, "pillar", { axis: "x" }); // the axle through the rail
    p.set(-2, 1, cz, "anvil");
    p.set(-2, 3, cz, "cobble"); // the hammer head over it
    p.set(-3, 2, cz + 1, "grind");
    p.set(-5, 1, cz - 2, "pillar", { axis: "y" }); p.set(-5, 1, cz + 2, "pillar", { axis: "y" });
  }
  return p;
}
export { stair };
