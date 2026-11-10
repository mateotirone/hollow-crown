// Frostmarch halls: Norse mead halls and stave churches. Steep roofs stacked in tiers, a raised
// clerestory, crossed gable finials, stave turrets. Think Borgund stave church and Meduseld.

import { shell, walls, posts, spire, tower, windowsAlong, gableTo, furnish, tieBeams } from "./hallparts.js";

const course = (H) => (y) => (y <= 1 ? "wallLow" : y === H ? "wall" : "wallUpper");

// Crossed finials on both gable ends of a ridge at height y
function finials(p, z0, z1, y, gilt) {
  for (const z of [z0 - 1, z1 + 1]) {
    p.set(0, y, z, gilt ? "gilt" : "beam", gilt ? undefined : { axis: "z" });
    p.set(-1, y + 1, z, "rail"); p.set(1, y + 1, z, "rail");
    p.set(-1, y + 2, z, "rail"); p.set(1, y + 2, z, "rail");
  }
}

// Stacked steep roofs over a hall. tiers = how many clerestory lifts before the last roof.
function staveRoof(p, x0, x1, z0, z1, y, tiers, o = {}) {
  let a = x0, b = x1, yy = y, over = 1;
  for (let t = 0; t < tiers; t++) {
    const half = Math.max(2, Math.floor((b - a) / 2) - (o.step ?? 3));
    const r = gableTo(p, a, b, z0, z1, yy, { pitch: 1, overhang: over, stopHalf: half });
    a = r.x0 + 1; b = r.x1 - 1;
    walls(p, a, b, z0, z1, r.y, r.y + 2, () => "wallUpper");
    p.fill(a + 1, r.y, z0 + 1, b - 1, r.y + 2, z1 - 1, "air");
    for (let z = z0 + 2; z < z1 - 1; z += 3) { p.set(a, r.y + 1, z, "window"); p.set(b, r.y + 1, z, "window"); }
    for (let z = z0 + 3; z < z1 - 1; z += 5) p.fill(a + 1, r.y, z, b - 1, r.y, z, "beam", { axis: "x" });
    yy = r.y + 3; over = 1;
  }
  const top = gableTo(p, a, b, z0, z1, yy, { pitch: 2, overhang: over });
  if (o.gilt) for (let z = z0 - 1; z <= z1 + 1; z++) p.set(0, top.y, z, "gilt");
  finials(p, z0, z1, top.y, o.gilt);
  return top.y;
}

// A stave turret riding the ridge
function turret(p, cz, y, h) {
  walls(p, -1, 1, cz - 1, cz + 1, y, y + h, () => "wallUpper");
  for (const [x, z] of [[-1, cz], [1, cz], [0, cz - 1], [0, cz + 1]]) p.set(x, y + h - 1, z, "window");
  spire(p, 0, cz, 1, y + h + 1);
  p.set(0, y + h + 5, cz, "rail");
}

function porch(p, hw, H) {
  // posts and a lintel either side of the door, with carved door posts
  posts(p, [[-2, 1], [2, 1], [-hw, 1], [hw, 1]], 1, H);
  p.fill(-1, 1, 1, 1, 3, 1, "air");
  p.fill(-1, 4, 1, 1, 4, 1, "beam", { axis: "x" });
}

function hall(p, level, hw, z1, H, tiers, o = {}) {
  const x0 = -hw, x1 = hw, z0 = 1;
  shell(p, x0, x1, z0, z1, H, course(H));
  const side = [];
  for (let z = z0 + 4; z < z1; z += 4) side.push(z);
  posts(p, [[x0, z0], [x1, z0], [x0, z1], [x1, z1], ...side.flatMap((z) => [[x0, z], [x1, z]])], 1, H);
  const win = side.flatMap((z) => [z - 2]);
  windowsAlong(p, "west", x0, x1, z0, z1, H >= 6 ? [3, 4] : [2], win);
  windowsAlong(p, "east", x0, x1, z0, z1, H >= 6 ? [3, 4] : [2], win);
  porch(p, hw, H);
  tieBeams(p, x0, x1, z0, z1, H + 1);
  const top = staveRoof(p, x0, x1, z0, z1, H + 1, tiers, o);
  const fz = o.furnishFrom ?? z0;
  furnish(p, level, { x0, x1, z0: fz, z1 }, H);
  if (fz > z0) p.fill(0, 1, z0 + 1, 0, 1, fz, level >= 5 ? "royal" : "carpet");
  // inner rows of staves holding the roof
  if (hw >= 6) posts(p, side.filter((z) => z > 2).flatMap((z) => [[-(hw - 3), z], [hw - 3, z]]).filter(([x, z]) => !p.get(x, 1, z) || p.get(x, 1, z).role === "air"), 1, H);
  return { x0, x1, z0, z1, top };
}

const meadHut = (p) => hall(p, 1, 4, 13, 3, 0);
const meadHall = (p) => hall(p, 2, 6, 21, 5, 1);

function staveHall(p) {
  const b = hall(p, 3, 7, 25, 6, 1);
  turret(p, 13, b.top, 3);
  return b;
}

function greatHall(p, sovereign) {
  const z1 = 33;
  const b = hall(p, sovereign ? 5 : 4, 10, z1, 7, 2, { gilt: sovereign, step: 4, furnishFrom: 4 });
  turret(p, 9, b.top, 3);
  turret(p, 25, b.top, 3);
  // stave towers flanking the door
  for (const s of [-1, 1]) {
    tower(p, s * 10, 1, 2, 16, "spire", [[s * 8, 2]]);
    p.set(s * 10, 24, 1, "rail");
  }
  if (!sovereign) return b;
  // the vault: a tall stave chapel behind the throne
  const v0 = z1, v1 = z1 + 8;
  shell(p, -4, 4, v0, v1, 9, (y) => (y <= 2 ? "wallLow" : y === 9 ? "gilt" : "wallUpper"));
  posts(p, [[-4, v1], [4, v1], [-4, v0], [4, v0]], 1, 9);
  p.fill(3, 1, v0, 3, 3, v0, "air");
  const top = staveRoof(p, -4, 4, v0, v1, 10, 1, { gilt: true, step: 2 });
  turret(p, v0 + 4, top, 2);
  p.fill(-2, 0, v0 + 2, 2, 0, v1 - 2, "gilt");
  for (const [x, z] of [[-3, v0 + 1], [3, v0 + 3], [-3, v1 - 1], [3, v1 - 1]]) p.set(x, 1, z, "brazier");
  p.mark("vault", 0, 1, v0 + 4);
  p.set(0, 9, v0 + 4, "light", { hanging: true });
  p.fill(-3, 10, v0 + 4, 3, 10, v0 + 4, "beam", { axis: "x" });
  return { ...b, z1: v1 };
}

export const FROST_HALLS = [null, meadHut, meadHall, staveHall, (p) => greatHall(p, false), (p) => greatHall(p, true)];
