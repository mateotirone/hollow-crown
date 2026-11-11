// Pre-designed buildings. Each is drawn once in "local" blocks and style roles (the same way the
// town hall is), so one design comes out in all five regional styles. Pure code, runs in Node.
//
// Local frame: the Foundation Stone sits at (0, 1, 0), just outside the front. +z runs away from
// the player into the building, +x is to their right, y = 0 is the floor layer.

import { Plan } from "../townhall/halls.js";
import { STYLES } from "../townhall/styles.js";
import { drawData } from "../townhall/designs.js";
import { BUILDING_DESIGNS } from "./designs_data.js";

const W = (...ids) => ids.map((id) => `minecraft:${id}`);

// Roles the town hall styles don't have: furniture and yard pieces, the same in every region
const EXTRA = {
  chest: W("chest"), barrel: W("barrel"), craft: W("crafting_table"), furnace: W("furnace"), blast: W("blast_furnace"),
  smoker: W("smoker"), anvil: W("anvil"), grind: W("grindstone"), cauldron: W("cauldron"), hay: W("hay_block"),
  water: W("water"), farmland: W("farmland"), composter: W("composter"), cobble: W("cobblestone"),
  awning: W("white_wool", "wool"), awningTrim: W("red_wool", "wool"), ladder: W("ladder"), bell: W("bell"),
  path: W("grass_path", "dirt_path", "gravel"),
  archive: ["siege:archive_shelf", "minecraft:bookshelf"], // the lore feature's Archive Shelf: it holds Lore Tomes
};

const cache = {};
export function styleFor(id) {
  const base = STYLES[id] ?? STYLES.vale;
  cache[id] ??= { ...base, id, roles: { ...EXTRA, ...base.roles } };
  return cache[id];
}

// ---------- pieces ----------

const stair = (dir, half) => ({ dir, half });

function floor(p, x0, x1, z0, z1, role = "floor") {
  p.fill(x0, 0, z0, x1, 0, z1, role);
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) p.column(x, z, "foundation");
}

function walls(p, x0, x1, z0, z1, y0, y1, course) {
  for (let y = y0; y <= y1; y++) {
    const role = course(y);
    for (let x = x0; x <= x1; x++) { p.set(x, y, z0, role); p.set(x, y, z1, role); }
    for (let z = z0; z <= z1; z++) { p.set(x0, y, z, role); p.set(x1, y, z, role); }
  }
  for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) p.fill(x, y0, z, x, y1, z, "pillar", { axis: "y" });
}

const hollow = (p, x0, x1, z0, z1, y0, y1) => p.fill(x0 + 1, y0, z0 + 1, x1 - 1, y1, z1 - 1, "air");
const door = (p, x, z) => p.fill(x, 1, z, x, 2, z, "air");

// Gable roof (ridge along z), or a flat one with a parapet where the style builds flat
function roof(p, x0, x1, z0, z1, y, { open = false } = {}) {
  if (p.style.roof === "flat") {
    p.fill(x0, y, z0, x1, y, z1, "roofBlock");
    if (!open) for (let x = x0; x <= x1; x += 2) { p.set(x, y + 1, z0, "crenel"); p.set(x, y + 1, z1, "crenel"); }
    return;
  }
  for (let i = 0; ; i++) {
    const xl = x0 - 1 + i, xr = x1 + 1 - i, yy = y + i;
    if (xl > xr) break;
    for (let z = z0 - 1; z <= z1 + 1; z++) {
      if (xl === xr) {
        p.set(xl, yy, z, p.style.snow ? "roofBlock" : "roofSlab");
        if (p.style.snow) p.set(xl, yy + 1, z, "snow");
      } else {
        p.set(xl, yy, z, "roofStair", stair("+x"));
        p.set(xr, yy, z, "roofStair", stair("-x"));
      }
    }
    if (xl === xr) break;
    // close the gable ends, keep the loft open
    for (let x = Math.max(xl + 1, x0); x <= Math.min(xr - 1, x1); x++) {
      if (!open) { p.set(x, yy, z0, "wallUpper"); p.set(x, yy, z1, "wallUpper"); }
      for (let z = z0 + 1; z < z1; z++) if (!p.get(x, yy, z)) p.set(x, yy, z, "air");
    }
  }
}

const hang = (p, x, y, z) => p.set(x, y, z, "light", { hanging: true });

// ---------- the buildings ----------

function cottage(p) {
  const x0 = -3, x1 = 3, z0 = 1, z1 = 7, H = 3;
  floor(p, x0, x1, z0, z1);
  walls(p, x0, x1, z0, z1, 1, H, (y) => (y === 1 ? "wallLow" : "wallUpper"));
  hollow(p, x0, x1, z0, z1, 1, H);
  door(p, 0, z0);
  for (const z of [3, 5]) { p.set(x0, 2, z, "window"); p.set(x1, 2, z, "window"); }
  p.set(0, 2, z1, "window");
  roof(p, x0, x1, z0, z1, H + 1);
  p.set(-2, 1, 6, "chest"); p.set(2, 1, 6, "craft"); p.set(2, 1, 5, "furnace");
  p.set(-2, 1, 2, "table", { half: "top" }); p.set(-2, 1, 3, "seat", stair("-z"));
  p.set(0, 0, 4, "royalBlock");
  hang(p, 0, H, 4);
}

function smithy(p) {
  const x0 = -3, x1 = 3, z0 = 4, z1 = 9, H = 3;
  // open forge porch at the front, stone workshop behind
  floor(p, x0, x1, 1, z1, "dais");
  for (const x of [x0, x1]) p.fill(x, 1, 1, x, H, 1, "pillar", { axis: "y" });
  p.fill(x0, H, 1, x1, H, 3, "roofSlab", { half: "top" });
  walls(p, x0, x1, z0, z1, 1, H, () => "wall");
  hollow(p, x0, x1, z0, z1, 1, H);
  door(p, 0, z0);
  p.set(-2, 2, z0, "window"); p.set(2, 2, z0, "window");
  roof(p, x0, x1, z0, z1, H + 1);
  p.set(-2, 1, 2, "anvil"); p.set(2, 1, 2, "grind"); p.set(2, 1, 3, "cauldron");
  p.set(-2, 1, 8, "blast"); p.set(-1, 1, 8, "furnace"); p.set(2, 1, 8, "chest"); p.set(2, 1, 7, "barrel");
  p.fill(-2, 1, 3, -2, H - 1, 3, "wallLow"); // the chimney breast by the anvil
  hang(p, 0, H, 6); hang(p, 0, H - 1, 2);
}

function stable(p) {
  const x0 = -4, x1 = 4, z0 = 1, z1 = 6, H = 3;
  floor(p, x0, x1, z0, z1, "path");
  for (const x of [x0, -1, 2, x1]) for (const z of [z0, z1]) p.fill(x, 1, z, x, H, z, "pillar", { axis: "y" });
  p.fill(x0, 1, z1, x1, H, z1, "wallUpper"); // back wall
  for (const x of [x0, -1, 2, x1]) p.fill(x, 1, z1, x, H, z1, "pillar", { axis: "y" });
  for (const x of [x0, -1, 2, x1]) p.fill(x, 1, z0 + 1, x, 1, z1 - 1, "rail"); // stall sides
  for (const x of [-3, 0, 3]) p.set(x, 1, z1 - 1, "hay");
  p.set(x0 + 1, 1, z0 + 1, "cauldron");
  roof(p, x0, x1, z0, z1, H + 1, { open: true });
  hang(p, 0, H, 3);
}

function storehouse(p) {
  const x0 = -4, x1 = 4, z0 = 1, z1 = 10, H = 5;
  floor(p, x0, x1, z0, z1);
  walls(p, x0, x1, z0, z1, 1, H, (y) => (y <= 2 ? "wallLow" : "wallUpper"));
  hollow(p, x0, x1, z0, z1, 1, H);
  p.fill(-1, 1, z0, 1, 3, z0, "air"); // wide cart door
  for (const z of [3, 6, 8]) { p.set(x0, 4, z, "window"); p.set(x1, 4, z, "window"); }
  roof(p, x0, x1, z0, z1, H + 1);
  // loft over the back half, with a ladder
  p.fill(x0 + 1, 3, 6, x1 - 1, 3, z1 - 1, "floor");
  p.fill(x1 - 1, 1, 5, x1 - 1, 3, 5, "scaffold");
  for (const x of [-3, -2, 2, 3]) { p.set(x, 1, 9, "barrel"); p.set(x, 4, 9, "hay"); }
  p.set(-3, 1, 7, "chest"); p.set(-3, 1, 8, "chest"); p.set(3, 1, 7, "barrel"); p.set(-3, 2, 9, "barrel");
  hang(p, 0, H, 4); hang(p, 0, 2, 8);
}

function watchtower(p) {
  const r = 2, cz = 3, H = 10;
  floor(p, -r, r, cz - r, cz + r);
  walls(p, -r, r, cz - r, cz + r, 1, H, (y) => (y <= 3 ? "wallLow" : "wall"));
  hollow(p, -r, r, cz - r, cz + r, 1, H - 1);
  door(p, 0, cz - r);
  p.fill(-r - 1, H, cz - r - 1, r + 1, H, cz + r + 1, "floor"); // the lookout, one block wider
  p.fill(r - 1, 1, cz + r - 1, r - 1, H, cz + r - 1, "scaffold");
  for (let x = -r - 1; x <= r + 1; x++) for (let z = cz - r - 1; z <= cz + r + 1; z++) {
    const edge = Math.abs(x) === r + 1 || Math.abs(z - cz) === r + 1;
    if (edge && (x + z) % 2 === 0) p.set(x, H + 1, z, "crenel");
  }
  for (const y of [5, 8]) { p.set(0, y, cz - r, "window"); p.set(-r, y, cz, "window"); p.set(r, y, cz, "window"); }
  p.set(0, H + 1, cz, "brazier");
  hang(p, 0, H - 1, cz);
}

function marketStall(p) {
  const x0 = -2, x1 = 2, z0 = 1, z1 = 3, H = 3;
  floor(p, x0, x1, z0, z1, "path");
  for (const x of [x0, x1]) for (const z of [z0, z1]) p.fill(x, 1, z, x, H - 1, z, "rail");
  for (let x = x0; x <= x1; x++) for (let z = z0 - 1; z <= z1; z++) p.set(x, H, z, (x - x0) % 2 ? "awningTrim" : "awning");
  p.fill(x0 + 1, 1, z0, x1 - 1, 1, z0, "table", { half: "top" }); // the counter
  p.set(x0 + 1, 1, z1, "barrel"); p.set(x1 - 1, 1, z1, "chest"); p.set(0, 1, z1, "hay");
  hang(p, 0, H - 1, 2);
}

function well(p) {
  const r = 2, cz = 3;
  floor(p, -r, r, cz - r, cz + r, "cobble");
  for (let x = -1; x <= 1; x++) for (let z = cz - 1; z <= cz + 1; z++) {
    const middle = x === 0 && z === cz;
    p.set(x, 0, z, middle ? "water" : "cobble");
    p.set(x, 1, z, middle ? "air" : "wallLow");
  }
  p.set(0, -1, cz, "water"); p.set(0, -2, cz, "cobble");
  for (const [x, z] of [[-1, cz - 1], [1, cz - 1], [-1, cz + 1], [1, cz + 1]]) p.fill(x, 2, z, x, 3, z, "rail");
  p.fill(-1, 4, cz - 1, 1, 4, cz + 1, "roofSlab");
  p.set(0, 3, cz, "chain"); p.set(0, 2, cz, "light", { hanging: true });
}

function garden(p) {
  const x0 = -4, x1 = 4, z0 = 1, z1 = 9;
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
    const edge = x === x0 || x === x1 || z === z0 || z === z1;
    p.set(x, 0, z, edge ? "path" : x === 0 ? "water" : "farmland");
    p.column(x, z, "foundation");
    if (edge && !(x === 0 && z === z0)) p.set(x, 1, z, "rail"); // gap at the front is the way in
  }
  p.set(0, 0, z0 + 1, "path"); // step over the channel
  p.set(x0 + 1, 1, z1 - 1, "composter"); p.set(x1 - 1, 1, z1 - 1, "barrel");
  for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) { p.set(x, 1, z, "pillar", { axis: "y" }); p.set(x, 2, z, "light"); }
}

// The town's library: two storeys of books round a reading table, with eight Archive Shelves on the
// back wall (marks shelf0..shelf7, lower row first) and a lectern (mark "lectern") in front of them.
// The lore feature fills the shelves with this town's own books when the library is built.
function library(p) {
  const x0 = -4, x1 = 4, z0 = 1, z1 = 9, H = 5;
  floor(p, x0, x1, z0, z1);
  walls(p, x0, x1, z0, z1, 1, H, (y) => (y <= 2 ? "wall" : "wallUpper"));
  hollow(p, x0, x1, z0, z1, 1, H);
  door(p, 0, z0);
  for (const z of [3, 5, 7]) for (const y of [2, 4]) { p.set(x0, y, z, "window"); p.set(x1, y, z, "window"); }
  p.set(-2, 2, z0, "window"); p.set(2, 2, z0, "window"); // the upper front and back walls stay blank for pictures
  roof(p, x0, x1, z0, z1, H + 1);
  // ordinary bookshelves between the side windows, floor to ceiling
  for (const x of [x0 + 1, x1 - 1]) for (const z of [2, 4, 6, 8]) p.fill(x, 1, z, x, H - 1, z, "bookshelf");
  // the Archive Shelves, two rows of four, either side of the middle of the back wall
  let n = 0;
  for (const y of [1, 2]) for (const x of [-2, -1, 1, 2]) { p.set(x, y, z1 - 1, "archive"); p.mark(`shelf${n++}`, x, y, z1 - 1); }
  p.fill(0, 1, z1 - 1, 0, 2, z1 - 1, "bookshelf");
  for (const x of [-2, -1, 0, 1, 2]) p.set(x, 3, z1 - 1, "bookshelf");
  p.set(0, 1, z1 - 3, "lectern"); p.mark("lectern", 0, 1, z1 - 3);
  // picture spots (the lore feature hangs them): three portraits above the shelves on the back wall, facing the
  // door, and one 3 wide by 2 tall painting over the door, facing the shelves. Each mark is the air block in
  // front of the wall at the bottom of its patch (the painting's is the bottom middle).
  [-2, 0, 2].forEach((x, i) => p.mark(`portrait${i}`, x, 4, z1 - 1));
  p.mark("painting0", 0, 4, z0 + 1);
  // reading table, a runner from the door
  p.set(0, 1, 4, "table", { half: "top" }); p.set(-1, 1, 4, "seat", stair("-x")); p.set(1, 1, 4, "seat", stair("+x"));
  p.fill(0, 0, 2, 0, 0, 3, "royalBlock");
  hang(p, 0, H, 3); hang(p, 0, H, 6);
}

export const BUILDINGS = [
  { id: "cottage", name: "Cottage", blurb: "A small house with a hearth corner, a chest and a workbench.", draw: cottage },
  { id: "smithy", name: "Smithy", blurb: "Stone workshop with a forge porch: anvil, grindstone, furnaces.", draw: smithy },
  { id: "stable", name: "Stable", blurb: "Three open stalls under one roof, with hay and a trough.", draw: stable },
  { id: "storehouse", name: "Storehouse", blurb: "A tall barn with a cart door, a loft, barrels and chests.", draw: storehouse },
  { id: "watchtower", name: "Watchtower", blurb: "A lookout over your land with a brazier on top.", draw: watchtower },
  { id: "market", name: "Market Stall", blurb: "A striped awning over a counter. Put one by your gate.", draw: marketStall },
  { id: "well", name: "Well", blurb: "A roofed well for the middle of the settlement.", draw: well },
  { id: "library", name: "Library", blurb: "Two storeys of books, a reading table and eight Archive Shelves for the town's own lore.", draw: library, faces: { portraitYaw: -1, paintingYaw: 1 } },
  { id: "garden", name: "Kitchen Garden", blurb: "Fenced beds with a water channel, ready to plant.", draw: garden },
];
export const BUILDING = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));

const plans = new Map();
export function drawBuilding(id, styleId) {
  const key = `${id}|${styleId}`;
  if (!plans.has(key)) {
    const style = styleFor(styleId);
    const p = new Plan(style);
    const d = BUILDING_DESIGNS[style.id]?.[id];
    if (d) {
      // the region's own design (map/structures/settle_buildings.py); its blocks become roles on this style
      const prefix = `bd:${style.id}:${id}`;
      d.palette.forEach(([bid], i) => { style.roles[`${prefix}:${i}`] = [bid]; });
      drawData(p, d, prefix);
      // priced as the plain design it replaces, so the new look doesn't change what a building costs
      p.priceAs = new Plan(style);
      BUILDING[id].draw(p.priceAs);
    } else BUILDING[id].draw(p);
    plans.set(key, p);
  }
  return plans.get(key);
}
