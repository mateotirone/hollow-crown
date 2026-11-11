// Build zones, as pure math (no Minecraft calls, so it runs in Node too).
//
// Every claim has three kinds of ground:
//   reserve   the ground your hall will grow into. Nothing may be built there.
//   free      the rest of your land. Build whatever you want.
//   wilds     everything outside a claim. No building, only making camp.
// Someone else's land is "foreign"; Siege Nights' own protection already handles that.

import { drawHall } from "../townhall/halls.js";
import { STYLES } from "../townhall/styles.js";
import { SETTLE, CAMP_KIT, RESERVE_ALLOWED, MATERIAL_RATE } from "./config.js";

export const matches = (list, typeId) => list.some((re) => re.test(typeId));
export const isCampKit = (typeId) => matches(CAMP_KIT, typeId);

// A box on the ground: { x0, z0, x1, z1 } (inclusive)
export const inBox = (box, loc) => loc.x >= box.x0 && loc.x <= box.x1 && loc.z >= box.z0 && loc.z <= box.z1;
export const boxesTouch = (a, b) => a.x0 <= b.x1 && b.x0 <= a.x1 && a.z0 <= b.z1 && b.z0 <= a.z1;
export const grow = (box, by) => ({ ...box, x0: box.x0 - by, z0: box.z0 - by, x1: box.x1 + by, z1: box.z1 + by });
export const corners = (box) => [{ x: box.x0, z: box.z0 }, { x: box.x1, z: box.z0 }, { x: box.x0, z: box.z1 }, { x: box.x1, z: box.z1 }];

// The ground a template covers: local x runs to the right of `forward`, local z along it
// (the same frame the town hall uses, so its build engine can raise our plans).
export function footprint(origin, forward, bounds) {
  const F = { x: Math.sign(forward.x), z: Math.sign(forward.z) };
  const R = { x: -F.z, z: F.x };
  const pts = [[bounds.x0, bounds.z0], [bounds.x1, bounds.z1]].map(([x, z]) => ({
    x: origin.x + x * R.x + z * F.x,
    z: origin.z + x * R.z + z * F.z,
  }));
  return {
    x0: Math.min(pts[0].x, pts[1].x), z0: Math.min(pts[0].z, pts[1].z),
    x1: Math.max(pts[0].x, pts[1].x), z1: Math.max(pts[0].z, pts[1].z),
  };
}

// How far a style's halls reach from the cornerstone, over all five tiers, in the hall's own
// directions: `side` blocks left and right, `back` behind the door line, `deep` ahead. Measured
// from the real templates (once per style), so it follows the town hall designs as they change.
const reaches = {};
export function hallReach(styleId) {
  const id = STYLES[styleId] ? styleId : "vale";
  if (!reaches[id]) {
    const r = { side: 0, back: 0, deep: 0 };
    for (let level = 1; level <= 5; level++) {
      const b = drawHall(level, STYLES[id]).bounds();
      r.side = Math.max(r.side, -b.x0, b.x1); r.back = Math.max(r.back, -b.z0); r.deep = Math.max(r.deep, b.z1);
    }
    reaches[id] = r;
  }
  return reaches[id];
}

// The reserve for a hall: the biggest hall its cornerstone can grow into, plus a margin
export function hallReserve(hall, margin = SETTLE.reserveMargin) {
  const reach = hallReach(hall.style);
  const box = footprint(hall, { x: hall.fx, z: hall.fz }, { x0: -reach.side, x1: reach.side, z0: -reach.back, z1: reach.deep });
  return { ...grow(box, margin), label: "your hall" };
}

// May this block go here? Returns undefined (yes) or { zone, message }.
//   s: { creative, overworld, typeId, land (owner id or undefined), mine (own or allied land),
//        reserve (label of the reserve this spot is in, or undefined), wildsClosed, hasKeep }
export function placeVerdict(s) {
  if (s.creative || !s.overworld) return undefined;
  if (!s.land) {
    if (!s.wildsClosed || s.typeId.startsWith("siege:") || isCampKit(s.typeId)) return undefined; // Siege Nights rules its own blocks
    return {
      zone: "wilds",
      message: s.hasKeep
        ? "§cYou can only build on your own land. Out here you can make camp: torches, a bed, a chest, a fire."
        : "§cYou need land to build on. Raise a Keep Banner on a Plot Stone. Until then you can only make camp.",
    };
  }
  if (!s.mine) return undefined; // foreign land: Siege Nights already refuses it
  if (s.reserve && !matches(RESERVE_ALLOWED, s.typeId)) {
    return { zone: "reserve", message: `§cThis ground is kept clear for ${s.reserve} to grow into. Build anywhere else on your land.` };
  }
  return undefined;
}

// ---------- paying for a pre-designed building ----------

const any = (...parts) => (id) => parts.some((p) => id.endsWith(p)) || /^siege:castle_(stone|tiles|bricks|cobbled|smooth)(_|$)/.test(id);
export const MATERIALS = {
  timber: { label: "planks", match: (id) => id.endsWith("_planks") || id.endsWith(":planks") },
  stone: {
    label: "building stone",
    match: any("cobblestone", "cobbled_deepslate", ":stone", "stone_bricks", "stonebrick", "deepslate_bricks", "sandstone", "mud_bricks", "calcite", "andesite"),
  },
};

// need: { timber, stone }, have: { timber, stone } -> { use: {..}, short: {..}, emeralds }
export function bill(need, have) {
  const out = { use: {}, short: {}, emeralds: 0 };
  for (const kind of Object.keys(MATERIALS)) {
    const want = need[kind] ?? 0;
    out.use[kind] = Math.min(want, have[kind] ?? 0);
    out.short[kind] = want - out.use[kind];
    out.emeralds += Math.ceil(out.short[kind] / MATERIAL_RATE[kind]);
  }
  return out;
}

// Roles that are counted as timber or stone when a plan is priced
const TIMBER_ROLES = new Set(["floor", "wallUpper", "pillar", "beam", "seat", "table", "rail", "gate", "roofStair", "roofSlab", "roofBlock"]);
const STONE_ROLES = new Set(["foundation", "wall", "wallLow", "crenel", "dais", "daisStair", "cobble"]);

export function priceOf(plan) {
  if (plan.priceAs) plan = plan.priceAs;
  let timber = 0, stone = plan.columns.size;
  for (const c of plan.cells.values()) {
    if (TIMBER_ROLES.has(c.role)) timber++;
    else if (STONE_ROLES.has(c.role)) stone++;
  }
  // about half of what it would take by hand, rounded to a tidy number
  const tidy = (n) => Math.max(8, Math.ceil(n / 2 / 8) * 8);
  return { timber: tidy(timber), stone: tidy(stone) };
}
