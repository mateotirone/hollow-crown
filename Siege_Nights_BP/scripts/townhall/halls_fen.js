// Blackfen halls: a stilt village over the water. Round huts under tall mossy cone roofs, joined at
// the walls, with a crooked witch's tower whose top room hangs out over the fen.
// Think Lake-town, the stilt village of Ganvie, crannogs, and a witch's hut.

import { roundRoom, roundFloor, ringWall, clearDisk, disk, cone, inDisk, furnish } from "./hallparts.js";

const course = (H) => (y) => (y <= 1 ? "wallLow" : y === H ? "pillar" : "wall");

// Open a doorway between two huts that touch: walk the line between their centres and clear what is in the way
function link(p, ax, az, bx, bz) {
  const n = Math.max(Math.abs(bx - ax), Math.abs(bz - az)) * 2;
  for (let i = 0; i <= n; i++) {
    const x = Math.round(ax + ((bx - ax) * i) / n), z = Math.round(az + ((bz - az) * i) / n);
    if (!p.get(x, 0, z)) { p.set(x, 0, z, "floor"); p.column(x, z, "pillar", { axis: "y" }); }
    for (const y of [1, 2]) { const c = p.get(x, y, z); if (!c || c.role !== "air") p.set(x, y, z, "air"); }
  }
}

// Lanterns hanging from the eaves of a cone roof
function eaveLights(p, cx, cz, r, H) {
  for (const [dx, dz] of [[r + 1, 0], [-r - 1, 0], [0, r + 1]]) p.set(cx + dx, H, cz + dz, "light", { hanging: true });
}

function hut(p, cx, cz, r, H, o = {}) {
  const top = roundRoom(p, cx, cz, r, H, { course: course(H), windowYs: o.windowYs ?? [2], steep: o.steep ?? 1 });
  eaveLights(p, cx, cz, r, H);
  return top;
}

// A side hut with something useful in it
function sideHut(p, cx, cz, r, H, kind) {
  hut(p, cx, cz, r, H);
  const out = cx < 0 ? -1 : 1;
  if (kind === "store") { p.set(cx + out * (r - 1), 1, cz, "bookshelf"); p.set(cx, 1, cz + r - 1, "table", { half: "top" }); p.set(cx, 1, cz - r + 1, "seat", { dir: "+z" }); }
  else { p.set(cx, 0, cz, "foundation"); p.set(cx, 1, cz, "hearth"); p.set(cx + out * (r - 1), 1, cz, "seat", { dir: out < 0 ? "-x" : "+x" }); }
  p.set(cx, H, cz + 1, "light", { hanging: true });
  p.set(cx, H + 1, cz + 1, "beam", { axis: "x" });
}

// The witch's tower: thin, tall, with a fat top room that overhangs
function witchTower(p, cx, cz, h) {
  roundFloor(p, cx, cz, 3);
  ringWall(p, cx, cz, 3, 1, h - 5, (y) => (y <= 1 ? "wallLow" : y % 5 === 0 ? "pillar" : "wall"));
  clearDisk(p, cx, cz, 3, 1, h - 5);
  for (let y = 4; y < h - 6; y += 5) { p.set(cx + 3, y, cz, "window"); p.set(cx - 3, y, cz, "window"); }
  disk(p, cx, cz, 4, h - 4, "floor");
  ringWall(p, cx, cz, 4, h - 3, h, (y) => (y === h ? "pillar" : "wallUpper"));
  clearDisk(p, cx, cz, 4, h - 3, h);
  for (const [dx, dz] of [[4, 0], [-4, 0], [0, 4], [0, -4]]) p.fill(cx + dx, h - 2, cz + dz, cx + dx, h - 1, cz + dz, "window");
  p.fill(cx, 1, cz + 2, cx, h - 3, cz + 2, "scaffold");
  cone(p, cx, cz, 5, h + 1, "roofBlock", 2);
  p.set(cx, h - 3, cz, "cartography"); p.set(cx + 2, h - 3, cz, "bookshelf"); p.set(cx - 2, h - 3, cz, "lectern");
  p.set(cx, h, cz - 2, "light", { hanging: true }); p.set(cx, h + 1, cz - 2, "beam", { axis: "x" });
  for (const [dx, dz] of [[5, 0], [-5, 0], [0, 5], [0, -5]]) { p.set(cx + dx, h, cz + dz, "chain"); p.set(cx + dx, h - 1, cz + dz, "light", { hanging: true }); }
}

// The main roundhouse. R = radius, its front wall touches the door.
function roundhouse(p, level, R, H) {
  const cz = 1 + R;
  roundRoom(p, 0, cz, R, H, { course: course(H), windowYs: [], steep: 1 });
  // windows round the wall, clear of the door
  for (let a = 0; a < 16; a++) {
    if (a === 12) continue;
    const dx = Math.round(Math.cos((a * Math.PI) / 8) * R), dz = Math.round(Math.sin((a * Math.PI) / 8) * R);
    const c = p.get(dx, 2, cz + dz);
    if (c && c.role !== "air" && inDisk(dx, dz, R) && Math.abs(dx) > 1) for (let y = 2; y <= Math.min(3, H - 2); y++) p.set(dx, y, cz + dz, "window");
  }
  p.fill(0, 1, 1, 0, 3, 1, "air");
  if (R >= 7) { p.fill(-1, 1, 1, 1, 3, 1, "air"); }
  // a ring of posts holding the roof
  if (R >= 9) for (let a = 0; a < 8; a++) {
    const dx = Math.round(Math.cos((a * Math.PI) / 4 + Math.PI / 8) * (R - 3)), dz = Math.round(Math.sin((a * Math.PI) / 4 + Math.PI / 8) * (R - 3));
    p.fill(dx, 1, cz + dz, dx, H + Math.min(3, R - 6), cz + dz, "pillar", { axis: "y" });
  }
  // furniture fits a square inside the circle
  const hx = Math.floor(R * 0.72), back = cz + Math.floor(R * 0.86);
  const fz = R >= 9 ? 3 : 1;
  const z1 = level >= 4 ? back + 1 : Math.min(back, cz + hx);
  furnish(p, level, { x0: -hx - 1, x1: hx + 1, z0: fz, z1 }, H);
  if (fz > 1) p.fill(0, 1, 2, 0, 1, fz, level >= 5 ? "royal" : "carpet");
  // rafters where the lanterns hang
  for (let z = fz + 3; z < z1 - 1; z += 5) for (let x = -R; x <= R; x++) if (inDisk(x, z - cz, R - 1)) p.set(x, H + 1, z, "beam", { axis: "x" });
  eaveLights(p, 0, cz, R, H);
  return cz;
}

function village(p, level) {
  const R = [0, 5, 6, 7, 10, 11][level], H = [0, 4, 5, 5, 6, 7][level];
  const cz = 1 + R, huts = [], towers = [];
  if (level >= 2) huts.push([-(R + 3), cz, 3, "store"], [R + 3, cz, 3, "hearth"]);
  if (level >= 4) huts.push([-(R - 2), cz + R - 1, 3, "hearth"], [R - 2, cz + R - 1, 3, "store"]);
  if (level === 3 || level === 4) towers.push([0, cz + R + 3, level === 3 ? 17 : 22]);
  if (level === 5) towers.push([-(R + 3), cz - 6, 26], [R + 3, cz - 6, 26]);
  if (level === 5) { huts[0][1] += 3; huts[1][1] += 3; }
  // outbuildings first, so the roundhouse wall closes over where they touch
  for (const [x, z, r, kind] of huts) sideHut(p, x, z, r, 4, kind);
  for (const [x, z, h] of towers) witchTower(p, x, z, h);
  let vz = 0;
  if (level === 5) {
    // the vault: a sealed hut out the back, gilded inside
    vz = cz + R + 4;
    roundRoom(p, 0, vz, 4, 5, { course: (y) => (y <= 2 ? "wallLow" : y === 5 ? "gilt" : "wall"), windowYs: [], steep: 2 });
    disk(p, 0, vz, 2, 0, "gilt");
  }
  roundhouse(p, level, R, H);
  for (const [x, z] of huts) link(p, x, z, x < 0 ? x + 5 : x - 5, z > cz ? z - 3 : z);
  for (const [x, z] of towers) link(p, x, z, x === 0 ? 0 : x < 0 ? x + 5 : x - 5, x === 0 ? z - 5 : z + 2);
  if (level === 5) {
    link(p, 3, vz - 2, 4, cz + R - 4);
    for (const [x, z] of [[-2, vz], [2, vz], [0, vz + 2]]) p.set(x, 1, z, "brazier");
    p.mark("vault", 0, 1, vz);
    p.set(0, 5, vz, "light", { hanging: true }); p.fill(-2, 6, vz, 2, 6, vz, "beam", { axis: "x" });
  }
  const far = Math.max(cz + R, ...towers.map((t) => t[1] + 5), vz ? vz + 5 : 0);
  return { x0: -R - (level >= 2 ? 7 : 0), x1: R + (level >= 2 ? 7 : 0), z0: 1, z1: far };
}

export const FEN_HALLS = [null, ...[1, 2, 3, 4, 5].map((level) => (p) => village(p, level))];
