// Emberwaste halls: mud-brick kasbahs and stepped ziggurats. Thick battered walls, flat roofs with
// roof beams poking out, tapering corner towers with stepped merlons, storeys set back like steps.
// Think Ait Benhaddou, the ziggurat of Ur, and Dorne.

import { shell, walls, floor, clearInside, dome, furnish, STAIR } from "./hallparts.js";

const course = (H) => (y) => (y <= 2 ? "wallLow" : y >= H - 1 ? "wallUpper" : "wall");

// Stepped merlons: tall at the corners, low between
function merlons(p, x0, x1, z0, z1, y) {
  for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) p.fill(x, y, z, x, y + 1, z, "wallUpper");
  for (let x = x0 + 1; x < x1; x++) for (const z of [z0, z1]) if ((x - x0) % 2 === 0) p.set(x, y, z, "crenel");
  for (let z = z0 + 1; z < z1; z++) for (const x of [x0, x1]) if ((z - z0) % 2 === 0) p.set(x, y, z, "crenel");
}

// Roof beams (vigas) sticking out of the side walls
function vigas(p, x0, x1, z0, z1, y) {
  for (let z = z0 + 2; z < z1; z += 3) { p.set(x0 - 1, y, z, "beam", { axis: "x" }); p.set(x1 + 1, y, z, "beam", { axis: "x" }); }
}

// Narrow slit windows, kasbah style
function slits(p, x0, x1, z0, z1, ys, from = z0 + 3) {
  for (let z = from; z < z1 - 1; z += 3) for (const y of ys) { p.set(x0, y, z, "window"); p.set(x1, y, z, "window"); }
}

function flat(p, x0, x1, z0, z1, y) {
  p.fill(x0, y, z0, x1, y, z1, "roofBlock");
  merlons(p, x0, x1, z0, z1, y + 1);
}

// The wide sloping foot of a kasbah tower. Drawn before the hall so the hall's inside stays clear.
function skirt(p, cx, cz, r, h) {
  walls(p, cx - r - 1, cx + r + 1, cz - r - 1, cz + r + 1, 1, h, () => "wallLow");
  for (let x = cx - r - 1; x <= cx + r + 1; x++) for (let z = cz - r - 1; z <= cz + r + 1; z++) if (Math.abs(x - cx) === r + 1 || Math.abs(z - cz) === r + 1) p.column(x, z, "foundation");
}

// A tapering mud-brick tower with a patterned terracotta crown
function kasbahTower(p, cx, cz, r, h, door) {
  floor(p, cx - r, cx + r, cz - r, cz + r);
  walls(p, cx - r, cx + r, cz - r, cz + r, 1, h, (y) => (y <= 3 ? "wallLow" : y >= h - 3 ? "wallUpper" : "wall"));
  clearInside(p, cx - r, cx + r, cz - r, cz + r, 1, h - 1);
  p.fill(cx - r + 1, h, cz - r + 1, cx + r - 1, h, cz + r - 1, "floor");
  // the pattern: a chequer of small openings under the crown
  for (let k = -r + 1; k <= r - 1; k++) for (const y of [h - 2, h - 4]) if ((k + y) % 2 === 0) {
    p.set(cx + k, y, cz - r, "window"); p.set(cx + k, y, cz + r, "window");
    p.set(cx - r, y, cz + k, "window"); p.set(cx + r, y, cz + k, "window");
  }
  const sx = cx + (cx < 0 ? r - 1 : -(r - 1)), sz = cz + (cz < 8 ? r - 1 : -(r - 1));
  p.fill(sx, 1, sz, sx, h, sz, "scaffold");
  p.set(cx, h - 1, cz, "light", { hanging: true });
  if (door) p.fill(door[0], 1, door[1], door[0], 2, door[1], "air");
  merlons(p, cx - r, cx + r, cz - r, cz + r, h + 1);
  for (const [x, z] of [[cx - r, cz - r], [cx + r, cz - r], [cx - r, cz + r], [cx + r, cz + r]]) p.set(x, h + 3, z, "crenel");
}

// A set-back upper storey, open to the hall below so the middle of the hall is tall
function storey(p, x0, x1, z0, z1, y, h, gilt) {
  walls(p, x0, x1, z0, z1, y, y + h, (yy) => (yy === y + h ? (gilt ? "gilt" : "wallUpper") : yy >= y + h - 2 ? "wallUpper" : "wall"));
  p.fill(x0 + 1, y - 1, z0 + 1, x1 - 1, y + h, z1 - 1, "air");
  slits(p, x0, x1, z0, z1, [y + 1, y + 2], z0 + 2);
  for (let x = x0 + 2; x < x1 - 1; x += 3) for (const z of [z0, z1]) p.fill(x, y + 1, z, x, y + 2, z, "window");
  vigas(p, x0, x1, z0, z1, y + h);
  flat(p, x0, x1, z0, z1, y + h + 1);
  return y + h + 1;
}

function obelisks(p, x, h, gilt) {
  for (const s of [-1, 1]) {
    p.fill(s * x, 0, -1, s * x, 0, -1, "foundation"); p.column(s * x, -1, "foundation");
    p.fill(s * x, 1, -1, s * x, h, -1, "pillar", { axis: "y" });
    p.set(s * x, h + 1, -1, gilt ? "gilt" : "crenel");
  }
}

function block(p, level, hw, z1, H, towers = []) {
  const x0 = -hw, x1 = hw, z0 = 1;
  for (const [cx, cz, r, h] of towers) skirt(p, cx, cz, r, Math.ceil(h / 3));
  shell(p, x0, x1, z0, z1, H, course(H));
  slits(p, x0, x1, z0, z1, H >= 6 ? [3, 4] : [2, 3]);
  // deep doorway with a heavy lintel
  const dw = hw >= 6 ? 1 : 0;
  p.fill(-dw, 1, z0, dw, 3, z0, "air");
  p.fill(-dw - 1, 1, z0, -dw - 1, 4, z0, "wallLow"); p.fill(dw + 1, 1, z0, dw + 1, 4, z0, "wallLow");
  p.fill(-dw, 4, z0, dw, 4, z0, "beam", { axis: "x" });
  vigas(p, x0, x1, z0, z1, H);
  flat(p, x0, x1, z0, z1, H + 1);
  // the front towers reach into the hall, so the furniture starts behind them
  const fz = towers.length ? towers[0][2] + 2 : z0;
  furnish(p, level, { x0, x1, z0: fz, z1 }, H);
  if (fz > z0) p.fill(0, 1, z0 + 1, 0, 1, fz, level >= 5 ? "royal" : "carpet");
  for (const [cx, cz, r, h] of towers) kasbahTower(p, cx, cz, r, h, [cx + (cx < 0 ? r : -r), cz + (cz < 8 ? 1 : -1)]);
  return { x0, x1, z0, z1 };
}

const adobe = (p) => {
  const b = block(p, 1, 4, 13, 4);
  // a shaded roof terrace at the back
  for (const [x, z] of [[-3, 9], [3, 9], [-3, 12], [3, 12]]) p.fill(x, 6, z, x, 7, z, "rail");
  p.fill(-3, 8, 9, 3, 8, 12, "table", { half: "bottom" });
  return b;
};

const kasbah = (p) => {
  const H = 6, b = block(p, 2, 6, 21, H, [[-6, 1, 2, 12], [6, 1, 2, 12]]);
  storey(p, -4, 4, 13, 20, H + 2, 3);
  p.fill(-3, H + 1, 14, 3, H + 1, 19, "roofBlock"); // this one is a closed roof room, not a lightwell
  return { ...b, x0: -9, x1: 9 };
};

const citadel = (p) => {
  const H = 7, z1 = 25;
  const b = block(p, 3, 8, z1, H, [[-8, 1, 2, 15], [8, 1, 2, 15], [-8, z1, 2, 15], [8, z1, 2, 15]]);
  storey(p, -5, 5, 6, 20, H + 2, 5);
  return { ...b, x0: -11, x1: 11 };
};

function ziggurat(p, sovereign) {
  const H = 8, hw = 11, z1 = 31;
  if (sovereign) {
    // the vault: a low sealed treasury behind the throne, stepped like the rest
    shell(p, -5, 5, z1, z1 + 9, 5, (y) => (y <= 2 ? "wallLow" : y === 5 ? "gilt" : "wall"));
    flat(p, -5, 5, z1, z1 + 9, 6);
    walls(p, -3, 3, z1 + 2, z1 + 7, 7, 8, (y) => (y === 8 ? "gilt" : "wallUpper"));
    p.fill(-3, 9, z1 + 2, 3, 9, z1 + 7, "roofBlock");
    p.fill(-2, 0, z1 + 2, 2, 0, z1 + 7, "gilt");
    for (const [x, z] of [[-4, z1 + 1], [4, z1 + 3], [-4, z1 + 8], [4, z1 + 8]]) p.set(x, 1, z, "brazier");
    p.mark("vault", 0, 1, z1 + 5);
    p.set(0, 5, z1 + 5, "light", { hanging: true });
  }
  const b = block(p, sovereign ? 5 : 4, hw, z1, H, [[-hw, 1, 3, 18], [hw, 1, 3, 18], [-hw, z1, 3, 18], [hw, z1, 3, 18]]);
  if (sovereign) p.fill(4, 1, z1, 4, 3, z1, "air");
  const y2 = storey(p, -8, 8, 5, 27, H + 2, 4, false);
  const y3 = storey(p, -5, 5, 9, 23, y2 + 1, 4, sovereign);
  // the pavilion on top: four posts and a dome
  for (const [x, z] of [[-3, 13], [3, 13], [-3, 19], [3, 19]]) p.fill(x, y3 + 1, z, x, y3 + 3, z, "pillar", { axis: "y" });
  p.fill(-3, y3 + 4, 13, 3, y3 + 4, 19, "roofBlock");
  p.fill(-2, y3, 14, 2, y3 + 4, 18, "air");
  dome(p, 0, 16, 3, y3 + 5, sovereign ? "gilt" : "spire");
  p.set(0, y3 + 4, 16, "light", { hanging: true });
  // processional stair and obelisks at the door
  obelisks(p, 3, sovereign ? 8 : 6, sovereign);
  for (const s of [-1, 1]) p.set(s * 2, 1, 0, "daisStair", STAIR(s < 0 ? "+x" : "-x"));
  return { ...b, x0: -15, x1: 15, z1: sovereign ? z1 + 9 : z1 };
}

export const EMBER_HALLS = [null, adobe, kasbah, citadel, (p) => ziggurat(p, false), (p) => ziggurat(p, true)];
