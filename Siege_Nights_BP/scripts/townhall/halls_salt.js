// Saltreach halls: Byzantine and Venetian harbor architecture. White walls, an arcaded loggia across
// the front, flat roofs carrying domes on drums, and a round lighthouse that grows with the town.
// Think St Mark's in Venice, Hagia Sophia, and Dol Amroth.

import { shell, walls, windowsAlong, ringWall, clearDisk, disk, dome, roundRoom, arcade, furnish, shifted } from "./hallparts.js";

const course = (H) => (y) => (y <= 2 ? "wallLow" : y >= H - 1 ? "wallUpper" : "wall");

// A dome on a windowed drum, open to the room below
function drumDome(p, cx, cz, r, y, role) {
  ringWall(p, cx, cz, r, y, y + 1, "wallUpper");
  for (const k of r >= 4 ? [-1, 1] : [0]) for (const [dx, dz] of [[r, k], [-r, k], [k, r], [k, -r]]) p.set(cx + dx, y + 1, cz + dz, "window");
  clearDisk(p, cx, cz, r, y - 1, y + 1);
  dome(p, cx, cz, r, y + 2, role);
  p.set(cx, y + 1 + r, cz, "light", { hanging: true });
}

// A small solid-looking dome sitting on the roof (corner cupola)
function cupola(p, cx, cz, r, y, role) {
  ringWall(p, cx, cz, r, y, y, "wallUpper");
  dome(p, cx, cz, r, y + 1, role);
}

// The lighthouse: a round tower with a fire room under a dome
function lighthouse(p, cx, cz, h, door, role) {
  roundRoom(p, cx, cz, 2, h, { course: (y) => (y <= 3 ? "wallLow" : y % 6 === 0 ? "wallUpper" : "wall"), windowYs: [h - 1, h], doors: [door], cap: "dome", capRole: role });
  p.fill(cx, 1, cz + 1, cx, h - 2, cz + 1, "scaffold");
  disk(p, cx, cz, 1, h - 2, "floor");
  p.set(cx, h - 2, cz + 1, "scaffold");
  p.set(cx, h - 1, cz, "brazier");
  ringWall(p, cx, cz, 3, h - 2, h - 2, "dais"); // gallery ring
  ringWall(p, cx, cz, 3, h - 1, h - 1, "rail");
}

function basilica(p, level, hw, z1, H, o = {}) {
  const x0 = -hw, x1 = hw, z0 = 1, inner = 4;
  shell(p, x0, x1, z0, z1, H, course(H));
  // loggia: an open arcade across the front, the real front wall set back behind it
  walls(p, x0, x1, inner, inner, 1, H, course(H));
  p.fill(x0 + 1, 1, z0, x1 - 1, H, inner - 1, "air");
  arcade(p, x0, x1, z0, Math.min(H, 5), 3);
  if (H > 5) { p.fill(x0, 6, z0, x1, H, z0, "wallUpper"); for (let x = x0 + 2; x <= x1 - 2; x += 3) p.fill(x, 7, z0, x, H - 1, z0, "window"); }
  p.fill(-1, 1, inner, 1, 3, inner, "air");
  p.fill(x0 + 1, 0, z0, x1 - 1, 0, inner - 1, "dais");
  // tall paired windows down the sides
  const win = [];
  for (let z = inner + 3; z < z1 - 1; z += 4) win.push(z);
  const ys = []; for (let y = 3; y <= H - 2; y++) ys.push(y);
  windowsAlong(p, "west", x0, x1, z0, z1, ys, win);
  windowsAlong(p, "east", x0, x1, z0, z1, ys, win);
  // flat roof with a low parapet
  p.fill(x0, H + 1, z0, x1, H + 1, z1, "roofBlock");
  walls(p, x0, x1, z0, z1, H + 2, H + 2, () => "wallUpper");
  furnish(p, level, { x0, x1, z0: inner, z1 }, H);
  // the great dome over the Tree
  const cz = o.domeZ ?? Math.round((inner + z1) / 2);
  drumDome(p, 0, cz, o.dome, H + 1, o.gilt ? "gilt" : "roofBlock");
  return { x0, x1, z0, z1, cz };
}

function chapel(p) {
  return basilica(p, 1, 4, 15, 4, { dome: 2 });
}

function harborHall(p) {
  const b = basilica(p, 2, 7, 23, 6, { dome: 3 });
  lighthouse(p, 9, 20, 15, [7, 20]);
  return { ...b, x1: 12 };
}

function domedHall(p) {
  const H = 8, hw = 8, z1 = 27;
  const b = basilica(p, 3, hw, z1, H, { dome: 4 });
  for (const [x, z] of [[-5, 4], [5, 4], [-5, z1 - 3], [5, z1 - 3]]) cupola(p, x, z, 2, H + 2);
  lighthouse(p, 10, 23, 21, [8, 23]);
  return { ...b, x1: 13 };
}

function palace(p, sovereign) {
  const H = 10, hw = 10, z1 = 33, role = sovereign ? "gilt" : "roofBlock";
  if (sovereign) {
    // the vault: a domed rotunda behind the throne, built first so the hall wall closes it
    roundRoom(p, 0, z1 + 3, 4, 6, { course: (y) => (y <= 2 ? "wallLow" : y === 6 ? "gilt" : "wall"), windowYs: [4], cap: "dome", capRole: "gilt" });
    disk(p, 0, z1 + 3, 2, 0, "gilt");
  }
  const b = basilica(p, sovereign ? 5 : 4, hw, z1, H, { dome: 5, gilt: sovereign });
  // upper loggia on the facade
  shifted(p, 0, 5, 0, () => { p.fill(-hw + 1, 0, 1, hw - 1, 0, 3, "floor"); arcade(p, -hw, hw, 1, 5, 3); });
  for (let x = -hw + 1; x < hw; x++) if (!p.get(x, 6, 1) || p.get(x, 6, 1).role === "air") p.set(x, 6, 1, "rail");
  for (const [x, z] of [[-6, 8], [6, 8], [-6, z1 - 5], [6, z1 - 5]]) cupola(p, x, z, 3, H + 2, role);
  // round corner turrets
  for (const [x, z] of [[-hw, 1], [hw, 1], [-hw, z1], [hw, z1]]) {
    ringWall(p, x, z, 2, H + 1, H + 5, (y) => (y === H + 5 ? "wallUpper" : "wall"));
    for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) p.set(x + dx, H + 4, z + dz, "window");
    dome(p, x, z, 2, H + 6, role);
  }
  lighthouse(p, 12, 26, sovereign ? 30 : 26, [10, 26], role);
  if (sovereign) {
    p.fill(3, 1, z1, 3, 3, z1, "air");
    for (const [x, z] of [[-2, z1 + 3], [2, z1 + 3], [0, z1 + 6]]) p.set(x, 1, z, "brazier");
    p.mark("vault", 0, 1, z1 + 4);
    return { ...b, x1: 15, z1: z1 + 7 };
  }
  return { ...b, x1: 15 };
}

export const SALT_HALLS = [null, chapel, harborHall, domedHall, (p) => palace(p, false), (p) => palace(p, true)];
