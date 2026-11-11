// Settlement layouts from the town generator (towns_data.js, written by tools/export_towns.py): which layout a
// settlement got, its slots, and where a building stands on a slot. Pure code, runs in Node.
//
// Coordinates are blocks from the Plot Stone on world axes (dx east, dz south). Heights (dy) are from the town
// square; the game adds the gap between the square and the real ground at the Plot Stone.
//
//   townFor(plotName) -> the plot's entry, or undefined (the twelve map plots have one)
//   pickLayout(town, seed) -> layout index
//   slotsOf(layout) -> [{ id, size, box: {x0, z0, x1, z1}, dy, side, door: {x, z}, step, walk, tier, tags, long }]
//   groundwork(layout, tier) -> [[dx, dy, dz, paletteIndex], ...] for that tier only
//   seatOnSlot(slot, bounds) -> { origin: {dx, dy, dz}, forward } | undefined   where a design fits on a slot

import { TOWNS, TOWN_CHARS } from "./towns_data.js";

export const TIER_NAMES = ["Hamlet", "Town", "City", "Castle"];
export const SIZE_NAMES = { S: "Small", M: "Medium", L: "Large", G: "Great" };
const DOOR = { n: { x: 0, z: -1 }, s: { x: 0, z: 1 }, e: { x: 1, z: 0 }, w: { x: -1, z: 0 } };

export const townFor = (plotName) => (plotName ? TOWNS[String(plotName).toLowerCase()] : undefined);
export const townNames = () => Object.keys(TOWNS);

// A settlement keeps the layout it was given, so the pick only has to be spread out, not secret. Only layouts that
// pass the tier charters are picked (any layout when none do).
export function pickLayout(town, seed) {
  const all = (town?.variants ?? []).map((v, i) => i);
  if (!all.length) return -1;
  const ok = all.filter((i) => town.variants[i].charter !== false);
  const from = ok.length ? ok : all;
  let h = 2166136261;
  for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return from[(h >>> 0) % from.length];
}

export const wallRadius = (town, tier) => town?.walls?.[Math.max(0, Math.min(3, tier))] ?? 56;

export function slotsOf(layout) {
  return (layout?.slots ?? []).map(([id, size, x0, z0, x1, z1, dy, side, step, walk, tier, tags, long]) => ({
    id, size, box: { x0, z0, x1, z1 }, dy, side, door: DOOR[side], step: { x: step[0], z: step[1] },
    walk: walk.map(([x, z, wy]) => ({ x, z, dy: wy })), tier, tags, long: !!long,
  }));
}

const idx = (c) => TOWN_CHARS.indexOf(c);
const num2 = (s, i) => ((idx(s[i]) << 6) | idx(s[i + 1])) - 64;

// The groundwork rows of one tier, decoded (see tools/export_towns.py pack_groundwork)
export function groundwork(layout, tier) {
  const text = (layout?.gw ?? "").split("|")[tier] ?? "";
  const out = [];
  let dx = 0, dz = 0, i = 0;
  while (i < text.length) {
    const head = text[i++];
    if (head === "!") { dx = num2(text, i); dz = num2(text, i + 2); i += 4; }
    else if (head === "-") dz += 1;
    else if (head !== "~") throw new Error(`bad groundwork at ${i - 1}`);
    const dy0 = idx(text[i++]) - 32;
    const n = idx(text[i++]);
    for (let k = 0; k < n; k++) out.push([dx, dy0 + k, dz, idx(text[i++])]);
  }
  return out;
}

export const fixturesOf = (layout, tier) => (layout?.fix ?? []).filter((f) => f[3] === tier)
  .map(([kind, x, z, t, dy, a, b, c]) => ({ kind, x, z, tier: t, dy, ...(kind === "tree" ? { species: a, size: b, rotation: c } : { stamp: a, rotation: b }) }));

// The hall's reserved box at a hall level (1..5)
export const hallBox = (layout, level) => {
  const b = layout?.hall?.[Math.max(1, Math.min(layout.hall.length, level)) - 1];
  return b ? { x0: b[0], z0: b[1], x1: b[2], z1: b[3] } : undefined;
};

// Where a building design stands on a slot. Designs are drawn with the front row at z = 0 and x running to the
// right as you face in (the Foundation Stone convention), so the front goes on the slot's door side, centred,
// facing into the slot. Returns undefined when the design is too big for the slot.
export function seatOnSlot(slot, bounds) {
  const forward = { x: -slot.door.x, z: -slot.door.z }; // facing in
  const box = seatedBox({ origin: { dx: 0, dz: 0 }, forward }, bounds);
  const { x0, z0, x1, z1 } = slot.box;
  if (box.x1 - box.x0 > x1 - x0 || box.z1 - box.z0 > z1 - z0) return undefined;
  const centre = (a0, a1, b0, b1) => Math.floor((a0 + a1) / 2 - (b0 + b1) / 2);
  let dx, dz;
  if (forward.z) {
    dz = forward.z > 0 ? z0 - box.z0 : z1 - box.z1;
    dx = centre(x0, x1, box.x0, box.x1);
  } else {
    dx = forward.x > 0 ? x0 - box.x0 : x1 - box.x1;
    dz = centre(z0, z1, box.z0, box.z1);
  }
  return { origin: { dx, dy: slot.dy + 1, dz }, forward };
}

// The world box a seated design covers (for checks and tests)
export function seatedBox(seat, bounds) {
  const F = seat.forward, R = { x: -F.z, z: F.x };
  const pts = [[bounds.x0, bounds.z0], [bounds.x1, bounds.z1]].map(([x, z]) => ({
    x: seat.origin.dx + x * R.x + z * F.x, z: seat.origin.dz + x * R.z + z * F.z,
  }));
  return { x0: Math.min(pts[0].x, pts[1].x), z0: Math.min(pts[0].z, pts[1].z), x1: Math.max(pts[0].x, pts[1].x), z1: Math.max(pts[0].z, pts[1].z) };
}
