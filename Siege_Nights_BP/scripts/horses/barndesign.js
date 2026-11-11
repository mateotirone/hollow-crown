// The stable and breeder's yard designs (pure, runs in Node). Placing and upgrading them: barn.js.

import { Plan } from "../townhall/halls.js";
import { styleFor, pieces, drawDesigned } from "../settle/buildings.js";
import { BARN_DESIGNS } from "../settle/barn_data.js";

export const BARN_STALLS = [0, 3, 5, 8];

const { floor, walls, hollow, roof, hang } = pieces;

// ---------- the design ----------
// Local frame as for every settlement building: the Stables block at (0, 1, 0) just outside the front door,
// +z runs into the barn. A 3-wide aisle down the middle, 3 x 3 stalls either side between posts every 4 blocks.

// Each region's own design (map/structures/settle_buildings.py, exported to settle/barn_data.js) when there is one,
// the plain shared design below when not.
export function drawBarn(level, styleId) {
  const lv = Math.max(1, Math.min(3, level));
  const style = styleFor(styleId), d = BARN_DESIGNS[style.id]?.[`stables_${lv}`];
  return d ? drawDesigned(new Plan(style), d, `bn:${style.id}:stables_${lv}`) : plainBarn(lv, styleId);
}

export function plainBarn(level, styleId) {
  const p = new Plan(styleFor(styleId));
  const lv = Math.max(1, Math.min(3, level));
  const rows = [0, 2, 3, 4][lv]; // stall slots down each side
  const stalls = BARN_STALLS[lv];
  const x0 = -5, x1 = 5, z0 = 1, zs = z0 + 4 * rows, z1 = lv === 3 ? zs + 4 : zs, H = 4;
  floor(p, x0, x1, z0, z1);
  p.fill(-1, 0, z0, 1, 0, zs - 1, "path"); // the aisle
  walls(p, x0, x1, z0, z1, 1, H, (y) => (y === 1 ? "wallLow" : "wallUpper"));
  hollow(p, x0, x1, z0, z1, 1, H);
  p.fill(-1, 1, z0, 1, 3, z0, "air"); // wide barn door

  // slots in order: left side front to back, then right side; the leftover slot is the tack corner
  const slots = [];
  for (const side of [-1, 1]) for (let i = 0; i < rows; i++) slots.push({ side, za: z0 + 4 * i });
  slots.forEach(({ side, za }, n) => {
    const zb = za + 4, inner = 2 * side, outer = 4 * side, mid = za + 2;
    p.fill(inner, 1, za, inner, H, za, "pillar", { axis: "y" });
    if (zb < zs || lv === 3) p.fill(inner, 1, zb, inner, H, zb, "pillar", { axis: "y" });
    p.fill(Math.min(inner, outer) + (side < 0 ? 0 : 1), 1, zb, Math.max(inner, outer) + (side < 0 ? -1 : 0), 1, zb, "rail"); // divider
    if (n < stalls) {
      p.set(inner, 1, za + 1, "rail"); p.set(inner, 1, za + 3, "rail"); // stall front, open in the middle
      p.set(outer, 1, mid, "hay"); p.set(outer, 1, mid - 1, "cauldron");
    } else {
      p.set(outer, 1, mid, "chest"); p.set(outer, 1, mid - 1, "barrel"); p.set(outer, 1, mid + 1, "barrel");
    }
    p.set(5 * side, 3, mid, "window");
    hang(p, 0, H, mid);
  });

  if (lv === 3) { // tack room across the back, through a door in its wall
    p.fill(x0 + 1, 1, zs, x1 - 1, H, zs, "wallUpper");
    p.fill(0, 1, zs, 0, 2, zs, "air");
    for (const x of [-4, -3, 3, 4]) p.set(x, 1, z1 - 1, x < 0 ? "chest" : "barrel");
    p.set(-4, 1, zs + 1, "craft"); p.set(4, 1, zs + 1, "anvil"); p.set(4, 1, zs + 2, "hay"); p.set(4, 2, zs + 2, "hay");
    p.set(0, 3, z1, "window");
    hang(p, 0, H, zs + 2);
  }
  roof(p, x0, x1, z0, z1, H + 1);
  return p;
}

// The breeder's yard: 11 x 11 paddock, the post at (0, 1, 0) in the gateway, a three-bay shelter at the back
export function drawBreederYard(styleId) {
  const style = styleFor(styleId), d = BARN_DESIGNS[style.id]?.breeder_yard;
  return d ? drawDesigned(new Plan(style), d, `bn:${style.id}:breeder_yard`) : plainBreederYard(styleId);
}

export function plainBreederYard(styleId) {
  const p = new Plan(styleFor(styleId));
  const x0 = -5, x1 = 5, z0 = 1, z1 = 11, zs = 7, H = 3;
  p.fill(x0, 0, z0, x1, 0, zs - 1, "path");
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) p.column(x, z, "foundation");
  for (let x = x0; x <= x1; x++) if (Math.abs(x) > 1) p.set(x, 1, z0, "rail"); // front fence, a 3-wide gateway
  for (let z = z0; z < zs; z++) { p.set(x0, 1, z, "rail"); p.set(x1, 1, z, "rail"); }
  // shelter: posts, a back wall, a lean-to roof, hay and a trough in each bay
  floor(p, x0, x1, zs, z1);
  p.fill(x0, 1, z1, x1, H, z1, "wallUpper");
  for (const z of [zs + 2, z1 - 1]) { p.fill(x0, 1, z, x0, H, z, "wallUpper"); p.fill(x1, 1, z, x1, H, z, "wallUpper"); }
  for (const x of [x0, -2, 2, x1]) p.fill(x, 1, zs, x, H, zs, "pillar", { axis: "y" });
  p.fill(x0, H + 1, zs, x1, H + 1, z1, "roofSlab");
  for (const x of [-4, 0, 4]) { p.set(x, 1, z1 - 1, "hay"); p.set(x + (x < 0 ? 1 : -1), 1, z1 - 1, "cauldron"); }
  p.set(-4, 2, z1 - 1, "hay");
  hang(p, -3, H, zs + 1); hang(p, 3, H, zs + 1);
  return p;
}

