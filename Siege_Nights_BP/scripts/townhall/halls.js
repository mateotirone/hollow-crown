// Town hall templates. Each region has its own architecture (not one build in five paint jobs):
//   Vale        Norman keep and Tudor hall-house        (this file)
//   Frostmarch  Norse mead hall and stave church        (halls_frost.js)
//   Saltreach   Byzantine domes, arcades, a lighthouse  (halls_salt.js)
//   Emberwaste  stepped kasbah and ziggurat             (halls_ember.js)
//   Blackfen    stilt village of round huts             (halls_fen.js)
// Halls are drawn in "local" coordinates and style roles, then rotated and dressed when built.

import { Plan, STAIR, lift, floor, walls, clearInside, posts, gableRoof, crenels, roof, tower, windowsAlong, entranceSteps, hangLights, mossAndSnow } from "./hallparts.js";
import { FROST_HALLS } from "./halls_frost.js";
import { SALT_HALLS } from "./halls_salt.js";
import { EMBER_HALLS } from "./halls_ember.js";
import { FEN_HALLS } from "./halls_fen.js";
import { hasDesign, drawDesign } from "./designs.js";

export { Plan } from "./hallparts.js";

export const HALL_TIERS = [
  null,
  { level: 1, name: "Longhouse", settlement: "Hamlet" },
  { level: 2, name: "Stone Hall", settlement: "Town" },
  { level: 3, name: "Keep", settlement: "City" },
  { level: 4, name: "Fortress", settlement: "Castle" },
  { level: 5, name: "Sovereign's Throne", settlement: "Sovereign" },
];


// ---------- the five halls ----------

function longhouse(p) {
  const x0 = -4, x1 = 4, z0 = 1, z1 = 13, H = 4;
  floor(p, x0, x1, z0, z1);
  walls(p, x0, x1, z0, z1, 1, H, (y) => (y === 1 ? "wallLow" : "wallUpper"));
  clearInside(p, x0, x1, z0, z1, 1, H + 6);
  windowsAlong(p, "west", x0, x1, z0, z1, [2, 3], [3, 7, 11]);
  windowsAlong(p, "east", x0, x1, z0, z1, [2, 3], [3, 7, 11]);
  windowsAlong(p, "south", x0, x1, z0, z1, [2, 3], [-2, 2]);
  posts(p, [[x0, z0], [x1, z0], [x0, z1], [x1, z1], [x0, 5], [x1, 5], [x0, 9], [x1, 9], [-2, z0], [2, z0]], 1, H);
  p.fill(0, 1, z0, 0, 3, z0, "air"); // door
  p.fill(-1, 1, z0, -1, 3, z0, "pillar", { axis: "y" });
  p.fill(1, 1, z0, 1, 3, z0, "pillar", { axis: "y" });
  roof(p, x0, x1, z0, z1, H + 1);
  for (const z of [5, 9]) p.fill(x0 + 1, H + 1, z, x1 - 1, H + 1, z, "beam", { axis: "x" });
  // hearth in the middle, benches along the walls
  p.fill(-1, 0, 6, 1, 0, 8, "foundation");
  p.set(0, 1, 7, "hearth");
  p.mark("hearth", 0, 1, 7);
  for (const z of [3, 4, 10]) { p.set(-3, 1, z, "seat", STAIR("-x")); p.set(3, 1, z, "seat", STAIR("+x")); }
  // the Tree of Oaths at the back
  p.fill(-1, 0, 10, 1, 0, 12, "dais");
  p.set(0, 1, 11, "tree");
  p.mark("tree", 0, 1, 11);
  p.set(-3, 1, 12, "bookshelf");
  p.set(3, 1, 12, "lectern");
  p.mark("ledger", 3, 1, 12);
  hangLights(p, [[-2, H, 5], [2, H, 5], [-2, H, 9], [2, H, 9]]);
  return { x0, x1, z0, z1 };
}

function stoneHall(p) {
  const x0 = -6, x1 = 6, z0 = 1, z1 = 21, H = 6;
  floor(p, x0, x1, z0, z1);
  walls(p, x0, x1, z0, z1, 1, H, (y) => (y <= 2 ? "wallLow" : "wall"));
  clearInside(p, x0, x1, z0, z1, 1, H + 8);
  windowsAlong(p, "west", x0, x1, z0, z1, [3, 4], [3, 4, 8, 9, 13, 14, 18, 19]);
  windowsAlong(p, "east", x0, x1, z0, z1, [3, 4], [3, 4, 8, 9, 13, 14, 18, 19]);
  windowsAlong(p, "north", x0, x1, z0, z1, [4, 5], [-4, 4]);
  windowsAlong(p, "south", x0, x1, z0, z1, [4, 5], [-1, 0, 1]);
  posts(p, [[x0, z0], [x1, z0], [x0, z1], [x1, z1], ...[6, 11, 16].flatMap((z) => [[x0, z], [x1, z]])], 1, H);
  p.fill(-1, 1, z0, 1, 3, z0, "air");
  p.fill(-2, 1, z0, -2, 4, z0, "pillar", { axis: "y" });
  p.fill(2, 1, z0, 2, 4, z0, "pillar", { axis: "y" });
  roof(p, x0, x1, z0, z1, H + 1);
  // dais and the Tree of Oaths
  p.fill(-5, 1, 17, 5, 1, 20, "dais");
  for (let x = -5; x <= 5; x++) p.set(x, 1, 16, "daisStair", STAIR("+z"));
  p.set(0, 2, 19, "tree");
  p.mark("tree", 0, 2, 19);
  p.set(-2, 2, 17, "brazier"); p.set(2, 2, 17, "brazier");
  // great hall: two rows of pillars, beams, a long table
  posts(p, [6, 11, 16].flatMap((z) => [[-3, z], [3, z]]), 1, H);
  for (const z of [6, 11, 16]) p.fill(x0 + 1, H, z, x1 - 1, H, z, "beam", { axis: "x" });
  for (const x of [-3, 3]) p.fill(x, H, z0 + 1, x, H, z1 - 1, "beam", { axis: "z" });
  p.fill(0, 1, 5, 0, 1, 12, "table", { half: "top" });
  for (let z = 5; z <= 12; z++) { p.set(-1, 1, z, "seat", STAIR("-x")); p.set(1, 1, z, "seat", STAIR("+x")); }
  p.fill(0, 1, 2, 0, 1, 4, "carpet");
  p.fill(0, 1, 13, 0, 1, 15, "carpet");
  // the Sage's corner and the Cartographer's Table
  p.fill(5, 1, 12, 5, 2, 15, "bookshelf");
  p.set(5, 1, 9, "cartography");
  p.mark("cartography", 5, 1, 9);
  p.mark("sage", 4, 1, 13);
  p.set(-5, 1, 9, "lectern");
  p.mark("ledger", -5, 1, 9);
  hangLights(p, [[0, H - 1, 6], [0, H - 1, 11], [0, H - 1, 16], [-4, H - 1, 3], [4, H - 1, 3]]);
  return { x0, x1, z0, z1 };
}

function keep(p) {
  const x0 = -8, x1 = 8, z0 = 1, z1 = 23, H = 9;
  floor(p, x0, x1, z0, z1);
  walls(p, x0, x1, z0, z1, 1, H, (y) => (y <= 3 ? "wallLow" : "wall"));
  clearInside(p, x0, x1, z0, z1, 1, H + 10);
  windowsAlong(p, "west", x0, x1, z0, z1, [5, 6, 7], [6, 7, 10, 11]);
  windowsAlong(p, "east", x0, x1, z0, z1, [5, 6, 7], [6, 7, 10, 11]);
  windowsAlong(p, "west", x0, x1, z0, z1, [7, 8], [18, 19, 20]);
  windowsAlong(p, "east", x0, x1, z0, z1, [7, 8], [18, 19, 20]);
  windowsAlong(p, "north", x0, x1, z0, z1, [6, 7], [-3, 3]);
  p.fill(-1, 1, z0, 1, 3, z0, "air");
  roof(p, x0, x1, z0, z1, H + 1);
  const T = H + 10;
  tower(p, x0, z0, 2, T, "crenel", [[x0 + 1, z0 + 2]]);
  tower(p, x1, z0, 2, T, "crenel", [[x1 - 1, z0 + 2]]);
  tower(p, x0, z1, 2, T, "crenel", [[x0 + 1, z1 - 2]]);
  tower(p, x1, z1, 2, T, "crenel", [[x1 - 1, z1 - 2]]);
  // great hall
  posts(p, [4, 8, 12].flatMap((z) => [[-4, z], [4, z]]), 1, H);
  for (const z of [4, 8, 12]) p.fill(x0 + 1, H, z, x1 - 1, H, z, "beam", { axis: "x" });
  p.fill(-2, 0, 9, 2, 0, 13, "dais");
  p.set(0, 1, 11, "tree");
  p.mark("tree", 0, 1, 11);
  p.set(-3, 1, 11, "brazier"); p.set(3, 1, 11, "brazier");
  p.fill(0, 1, 2, 0, 1, 8, "carpet");
  hangLights(p, [[-2, H - 1, 4], [2, H - 1, 4], [-2, H - 1, 8], [2, H - 1, 8], [0, H - 1, 12]]);
  // war room on a gallery over the back of the hall, stairs up the east wall
  p.fill(x0 + 1, 5, 15, x1 - 1, 5, z1 - 1, "floor");
  for (let x = x0 + 1; x <= x1 - 2; x++) p.set(x, 6, 15, "rail");
  for (let k = 1; k <= 5; k++) {
    p.set(7, k, 9 + k, "seat", STAIR("+z"));
    for (let y = k + 1; y <= k + 3; y++) p.set(7, y, 9 + k, "air");
  }
  p.set(7, 5, 15, "floor"); p.fill(7, 6, 15, 7, 8, 15, "air");
  p.set(0, 6, 19, "cartography");
  p.set(-2, 6, 19, "lectern"); p.set(2, 6, 19, "lectern");
  p.mark("warroom", 0, 6, 18);
  p.mark("cartography", 0, 6, 19);
  p.fill(-6, 6, z1 - 1, -2, 7, z1 - 1, "bookshelf");
  p.fill(2, 6, z1 - 1, 6, 7, z1 - 1, "bookshelf");
  hangLights(p, [[0, H - 1, 19]]);
  // under the gallery: the Sage's study and a hearth
  p.fill(x0 + 1, 1, 17, x0 + 1, 2, 21, "bookshelf");
  p.mark("sage", -5, 1, 19);
  p.set(5, 1, 20, "hearth");
  p.mark("hearth", 5, 1, 20);
  p.set(4, 1, 18, "seat", STAIR("-z")); p.set(6, 1, 18, "seat", STAIR("-z"));
  hangLights(p, [[-4, 4, 19], [4, 4, 17]]);
  return { x0, x1, z0, z1 };
}

function fortress(p, sovereign = false) {
  const x0 = -12, x1 = 12, z0 = 1, z1 = 31, H = 11;
  floor(p, x0, x1, z0, z1);
  walls(p, x0, x1, z0, z1, 1, H, (y) => (y <= 3 ? "wallLow" : sovereign && y === H ? "gilt" : "wall"));
  clearInside(p, x0, x1, z0, z1, 1, H + 14);
  const sideWindows = [3, 7, 11, 15, 19];
  windowsAlong(p, "west", x0, x1, z0, z1, [4, 5, 6, 7, 8], sideWindows);
  windowsAlong(p, "east", x0, x1, z0, z1, [4, 5, 6, 7, 8], sideWindows);
  windowsAlong(p, "west", x0, x1, z0, z1, [3, 4, 5], [24, 28]);
  windowsAlong(p, "east", x0, x1, z0, z1, [3, 4, 5], [24, 28]);
  // parapet walk and the roof inside it
  crenels(p, x0, x1, z0, z1, H + 1);
  if (p.style.roof === "flat") p.fill(x0 + 1, H, z0 + 1, x1 - 1, H, z1 - 1, "roofBlock");
  else gableRoof(p, x0 + 1, x1 - 1, z0 + 1, z1 - 1, H + 1, 0);
  // corner towers with spires, and a gatehouse
  const T = H + 12 + (sovereign ? 4 : 0);
  tower(p, x0, z0, 3, T, "spire", [[x0 + 3, z0 + 2]]);
  tower(p, x1, z0, 3, T, "spire", [[x1 - 3, z0 + 2]]);
  tower(p, x0, z1, 3, T, "spire", [[x0 + 3, z1 - 2]]);
  tower(p, x1, z1, 3, T, "spire", [[x1 - 3, z1 - 2]]);
  tower(p, -4, z0, 2, H + 4, "crenel", [[-2, z0]]);
  tower(p, 4, z0, 2, H + 4, "crenel", [[2, z0]]);
  p.fill(-2, 1, z0 - 2, 2, 4, z0 + 1, "air"); // the great door
  p.fill(-2, 0, z0 - 2, 2, 0, z0, "floor");
  p.fill(-2, 5, z0 - 2, 2, 5, z0, "wall");
  // great hall
  posts(p, [5, 9, 13, 17].flatMap((z) => [[-6, z], [6, z]]), 1, H - 1);
  for (const z of [5, 9, 13, 17]) p.fill(x0 + 1, H - 1, z, x1 - 1, H - 1, z, "beam", { axis: "x" });
  p.fill(-3, 0, 8, 3, 0, 14, "dais");
  p.set(0, 1, 11, "tree");
  p.mark("tree", 0, 1, 11);
  for (const [x, z] of [[-3, 8], [3, 8], [-3, 14], [3, 14]]) p.set(x, 1, z, "brazier");
  p.fill(0, 1, 2, 0, 1, 7, sovereign ? "royal" : "carpet");
  p.fill(0, 1, 15, 0, 1, 21, sovereign ? "royal" : "carpet");
  for (const [za, zb] of [[3, 6], [16, 19]]) for (const x of [-9, 9]) {
    p.fill(x, 1, za, x, 1, zb, "table", { half: "top" });
    for (let z = za; z <= zb; z++) { p.set(x - 1, 1, z, "seat", STAIR("-x")); p.set(x + 1, 1, z, "seat", STAIR("+x")); }
  }
  if (sovereign) for (const z of [3, 7, 15, 19]) { p.fill(x0 + 1, 5, z, x0 + 1, 8, z, "royalBlock"); p.fill(x1 - 1, 5, z, x1 - 1, 8, z, "royalBlock"); }
  hangLights(p, [5, 9, 13, 17].flatMap((z) => [[-3, H - 2, z], [3, H - 2, z]]));
  // the Sage's library along the west wall
  p.fill(x0 + 1, 1, 8, x0 + 1, 3, 14, "bookshelf");
  p.mark("sage", -10, 1, 11);
  p.set(x1 - 1, 1, 11, "hearth");
  p.mark("hearth", x1 - 1, 1, 11);
  // inner wall and the throne room
  walls(p, x0, x1, 21, 21, 1, H - 1, () => "wall");
  p.fill(-2, 1, 21, 2, 5, 21, "air");
  p.fill(-3, 1, 26, 3, 1, 29, "dais");
  for (let x = -3; x <= 3; x++) p.set(x, 1, 25, "daisStair", STAIR("+z"));
  p.set(0, 2, 28, "seat", STAIR("+z"));
  p.set(-1, 2, 28, "table", { half: "bottom" }); p.set(1, 2, 28, "table", { half: "bottom" });
  p.mark("throne", 0, 2, 28);
  p.fill(0, 1, 22, 0, 1, 24, "royal");
  p.fill(0, 2, 26, 0, 2, 27, "royal");
  p.fill(-2, 2, 30, -2, 5, 30, "royalBlock"); p.fill(2, 2, 30, 2, 5, 30, "royalBlock");
  p.set(-3, 2, 26, "brazier"); p.set(3, 2, 26, "brazier");
  // war room gallery above the throne room
  p.fill(x0 + 1, 7, 22, x1 - 1, 7, z1 - 1, "floor");
  p.fill(-1, 7, 22, 1, 7, 24, "air"); // lets light down onto the throne
  for (let k = 1; k <= 7; k++) {
    p.set(11, k, 13 + k, "seat", STAIR("+z"));
    for (let y = k + 1; y <= k + 3; y++) p.set(11, y, 13 + k, "air");
  }
  p.set(11, 7, 21, "floor"); p.fill(11, 8, 21, 11, 10, 21, "air");
  p.set(0, 8, 27, "cartography"); p.set(-2, 8, 27, "lectern"); p.set(2, 8, 27, "lectern");
  p.mark("warroom", 0, 8, 26);
  p.mark("cartography", 0, 8, 27);
  p.fill(-8, 8, z1 - 1, 8, 9, z1 - 1, "bookshelf");
  hangLights(p, [[-6, H - 1, 26], [6, H - 1, 26], [-6, 6, 24], [6, 6, 24]]);
  if (sovereign) crownVault(p, z1);
  return { x0, x1, z0, z1: sovereign ? z1 + 8 : z1 };
}

function crownVault(p, back) {
  const x0 = -4, x1 = 4, z0 = back, z1 = back + 8, H = 7;
  floor(p, x0, x1, z0 + 1, z1);
  walls(p, x0, x1, z0, z1, 1, H, (y) => (y <= 2 ? "wallLow" : y === H ? "gilt" : "wall"));
  clearInside(p, x0, x1, z0, z1, 1, H + 6);
  roof(p, x0, x1, z0, z1, H + 1);
  p.fill(3, 1, back, 3, 3, back, "air"); // door behind the throne room, off to the side
  p.fill(-2, 0, z0 + 2, 2, 0, z1 - 2, "gilt");
  for (const [x, z] of [[-3, z0 + 1], [3, z0 + 3], [-3, z1 - 1], [3, z1 - 1]]) p.set(x, 1, z, "brazier");
  p.mark("vault", 0, 1, z0 + 4);
  hangLights(p, [[0, H - 1, z0 + 4]]);
}

const BUILDERS = [null, longhouse, stoneHall, keep, (p) => fortress(p, false), (p) => fortress(p, true)];

const ARCH = { vale: BUILDERS, frost: FROST_HALLS, salt: SALT_HALLS, ember: EMBER_HALLS, fen: FEN_HALLS };

// Draw the hall for a tier (1-5) in a style. Returns the Plan (cells, columns, marks).
export function drawHall(level, style) {
  if (hasDesign(style.arch, level)) {
    // the halls rebuilt in the map kit's style (designs.js); the hand-coded builders below stay as the fallback
    const p = new Plan(style);
    drawDesign(p, style.arch, level);
    placeBoard(p);
    return p;
  }
  const p = new Plan(style);
  const L = lift(p);
  p.off = { x: 0, y: L, z: L };
  const box = (ARCH[style.arch] ?? BUILDERS)[level](p);
  p.off = { x: 0, y: 0, z: 0 };
  entranceSteps(p);
  mossAndSnow(p, box);
  placeBoard(p);
  return p;
}

// The Town Board: a big notice board inside every hall that opens the Town Hall menu (Mateo, 2026-11-12:
// "a big bulletin board-style thing that's inside the Town Hall"). It stands on the floor just inside the
// front door, off the centre aisle, under the roof, facing the way in. Its wide frame may tuck into a wall.
export function boardSpot(p) {
  const tree = p.marks.tree;
  if (!tree) return undefined;
  const at = (x, y, z) => p.cells.get(`${x},${y},${z}`);
  const free = (x, y, z) => !at(x, y, z) || at(x, y, z).role === "air";
  const isDoor = (c) => c && /_door$|^door$/.test(c.role === "door" ? "door" : p.style?.roles?.[c.role]?.[0] ?? "");
  // the front door: the furthest-in door block on the aisle (halls with a porch have more than one)
  let doorZ = 1;
  for (const c of p.cells.values()) if (Math.abs(c.x) <= 1 && c.z < tree.z && isDoor(c)) doorZ = Math.max(doorZ, c.z);
  const top = Math.max(...[...p.cells.values()].map((c) => c.y));
  // the floor may sit lower than the Tree, which stands on a dais
  const standAt = (x, z) => {
    for (let y = tree.y - 2; y <= tree.y + 1; y++) if (!free(x, y - 1, z) && free(x, y, z) && free(x, y + 1, z)) return y;
    return undefined;
  };
  for (let z = doorZ + 1; z <= tree.z + 2; z++)
    for (const side of [2, 3, 4, 5, 6])
      for (const x of [side, -side]) {
        const y = standAt(x, z);
        if (y === undefined || !free(x, y, z - 1)) continue; // its face needs room to be read
        let roofed = false;
        for (let ry = y + 2; ry <= top && !roofed; ry++) roofed = !free(x, ry, z);
        if (roofed) return { x, y, z };
      }
  return undefined;
}

function placeBoard(p) {
  const s = boardSpot(p);
  if (!s) return;
  p.set(s.x, s.y, s.z, "board", { dir: "-z" });
  p.mark("board", s.x, s.y, s.z);
}

// ---------- placing a plan in the world (still pure math) ----------

const CARDINAL = { "1,0": "east", "-1,0": "west", "0,1": "south", "0,-1": "north" };
const WEIRDO = { east: 0, west: 1, south: 2, north: 3 };

// forward = unit vector {x, z} pointing from the cornerstone into the hall
export function frameFor(forward) {
  const F = { x: Math.sign(forward.x), z: Math.sign(forward.z) };
  const R = { x: -F.z, z: F.x };
  return { F, R };
}

export function toWorld(frame, origin, x, y, z) {
  return {
    x: origin.x + x * frame.R.x + z * frame.F.x,
    y: origin.y - 1 + y,
    z: origin.z + x * frame.R.z + z * frame.F.z,
  };
}

function worldDir(frame, dir) {
  const sign = dir[0] === "-" ? -1 : 1;
  const v = dir[1] === "x" ? frame.R : frame.F;
  return CARDINAL[`${v.x * sign},${v.z * sign}`];
}

// Block states for a role's options, in world terms. Several spellings are given because
// block states were renamed across game versions; the builder tries them in order.
export function statesFor(frame, role, o = {}) {
  const out = [];
  if (o.dir) {
    const d = worldDir(frame, o.dir);
    const upside = o.half === "top";
    out.push({ weirdo_direction: WEIRDO[d], upside_down_bit: upside });
    out.push({ "minecraft:cardinal_direction": d, upside_down_bit: upside });
    out.push({ "minecraft:cardinal_direction": d }); // add-on blocks that only turn (vault doors and locks)
  } else if (o.axis) {
    const axis = o.axis === "y" ? "y" : (o.axis === "x" ? frame.R : frame.F).x !== 0 ? "x" : "z";
    out.push({ pillar_axis: axis });
  } else if (o.half) {
    out.push({ "minecraft:vertical_half": o.half });
  } else if (o.hanging) {
    out.push({ hanging: true });
  }
  if (o.trap && o.dir) {
    // trapdoors spell their facing as a number (0 east, 1 west, 2 south, 3 north)
    out.unshift({ direction: WEIRDO[worldDir(frame, o.dir)], upside_down_bit: o.half === "top" });
  }
  if (o.st) for (const s of out) Object.assign(s, o.st);
  out.push({});
  return out;
}

// Blocks that hang from, stand on or stick to another block and pop off (dropping as items) if it isn't there yet
// (Mateo's playtest 2026-11-12: doors and hanging lanterns broke as buildings rose)
export const ATTACHED = /(_door|^door|lantern|chain|torch|_sign|^sign|banner|_button|ladder|carpet|bell|lever|candle|flower_pot|vine|_bed|^bed|pressure_plate|rail|hanging_roots|snow_layer|pointed_dripstone|amethyst_cluster|_bud|item_frame|tripwire_hook|sapling|propagule|azalea$)/;
const HANGS = /chain|hanging_roots|vine/;
const blockOf = (plan, c) => (c.role === "door" ? "door" : plan.style?.roles?.[c.role]?.[0] ?? c.role);
const centreOut = (a, b) => Math.abs(a.x) + Math.abs(a.z) - (Math.abs(b.x) + Math.abs(b.z));

// Order cells for a nice rising build: bottom layer first, then up, centre outwards. Everything that needs a block to
// hold it comes last, once all its supports stand: hanging things (chains, hanging lanterns) from the top down, then
// the rest from the bottom up, and each door's two halves one right after the other (pair: placed in the same tick).
export function buildOrder(plan) {
  const solid = [], hang = [], doors = [], rest = [];
  for (const c of plan.cells.values()) {
    const id = blockOf(plan, c);
    if (!ATTACHED.test(id)) solid.push(c);
    else if (c.o?.hanging || c.o?.st?.hanging || HANGS.test(id)) hang.push(c);
    else if (/_door$|^door$/.test(id)) doors.push(c);
    else rest.push(c);
  }
  solid.sort((a, b) => a.y - b.y || centreOut(a, b));
  hang.sort((a, b) => b.y - a.y || centreOut(a, b));
  rest.sort((a, b) => a.y - b.y || centreOut(a, b));
  doors.sort((a, b) => a.x - b.x || a.z - b.z || a.y - b.y);
  const paired = doors.map((c, i) => {
    const n = doors[i + 1];
    return n && n.x === c.x && n.z === c.z && n.y === c.y + 1 ? { ...c, pair: true } : c;
  });
  return [...solid, ...hang, ...rest, ...paired];
}
