// The minimap's arithmetic, kept free of Minecraft so the self-tests can run it anywhere.
// The textures come from tools/minimap_tiles.py and the HUD layout from tools/minimap_ui.py;
// the numbers below must match both.

import { PLOT_PLAN, WARDS } from "../plots/config.js";
import { REGION_CELL, REGION_ROWS } from "./regions.js";
import { WONDERS } from "../wonders/data.js";

export const KEY = "hcm:";        // hidden titles that start with this feed the HUD map
export const ORIGIN = -1280;      // world x/z where tile 0 starts
export const TILE = 64;           // blocks per tile; a view shows 3 x 3 tiles around the player
export const TILES = 40;          // tiles per side
export const SPOTS = 4;           // the arrow moves in a 4 x 4 grid inside the middle tile
export const NEAR = 110;          // name a settlement when this close, otherwise the region
const LETTERS = "abcdefghijklmnop";   // arrow spot
const DIRS = "qrstuvwy";               // arrow direction, north then clockwise
export const PIN_CELLS = 3;       // pin cells per tile side, so 9 x 9 over the 3 x 3 tile view (8 px, about 21 blocks each)
export const PIN_COLS = "abcdefghi";   // pin column, west to east
export const PIN_ROWS = "jklmnopqr";   // pin row, north to south (its own letters, so the HUD can cut column from row)
// pin kinds: the quest's target on the map, held at the map's edge when it is further, or the person to talk to
export const PIN = { goal: "g", edge: "e", talk: "t", none: "_" };
const NO_PIN = "aj" + PIN.none;
const REGION_NAMES = ["Aldmere Vale", "Frostmarch", "Saltreach", "Blackfen", "Emberwaste"];

// Places worth a name on the map: the twelve plots, the towns and the six wonders. Caves and sinks stay unnamed (they
// are for finding), and so does the sealed pass.
export const PLACES = [
  ...PLOT_PLAN.map((p) => ({ name: p.name, x: p.x, z: p.z, r: NEAR })),
  ...WARDS.filter((w) => !w.thin && w.name !== "the Shut Pass").map((w) => ({ name: w.name, x: w.x, z: w.z, r: Math.max(NEAR, w.r + 30) })),
  ...WONDERS.map((w) => ({ name: w.name, x: w.site.x, z: w.site.z, r: 90 })),
];

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// The label is cut out of the title with JSON UI string tricks that assume it has no digits and no "|".
export const cleanLabel = (s) => cap(String(s).replace(/[0-9|§]/g, "").trim()).slice(0, 32);

export function regionAt(x, z) {
  const row = REGION_ROWS[Math.floor((z - ORIGIN) / REGION_CELL)];
  const c = row?.[Math.floor((x - ORIGIN) / REGION_CELL)];
  if (c === undefined || c === " ") return "";
  if (c === ".") return "The Western Sea";
  return REGION_NAMES[Number(c)] ?? "";
}

export function placeName(x, z) {
  let best = null, bestD = Infinity;
  for (const p of PLACES) {
    const d = Math.hypot(p.x - x, p.z - z);
    if (d <= p.r && d < bestD) { best = p; bestD = d; }
  }
  return best ? best.name : regionAt(x, z);
}

// Facing on the map (north up), 0..7 clockwise from north. Bedrock yaw: 0 south, 90 west, 180 north, -90 east.
export function arrowDir(yaw) {
  const dx = -Math.sin((yaw * Math.PI) / 180), dz = Math.cos((yaw * Math.PI) / 180);
  const screen = (Math.atan2(dx, -dz) * 180) / Math.PI;           // clockwise from up
  return ((Math.round(screen / 45) % 8) + 8) % 8;
}

const pad2 = (n) => String(n).padStart(2, "0");

// The pin: three letters, column, row and kind. The view is the 3 x 3 tiles round the player's tile (tx, tz).
// A target inside the view gets its own cell. One further away is held on the view's rim, where the line from the
// player to it leaves the map, and drawn as an edge pin. pin = { x, z, kind: "goal" | "talk" } or undefined.
export function pinCode(x, z, tx, tz, pin) {
  if (!pin || !Number.isFinite(pin.x) || !Number.isFinite(pin.z)) return NO_PIN;
  const cell = TILE / PIN_CELLS, n = PIN_COLS.length;
  const x0 = ORIGIN + (tx - 1) * TILE, z0 = ORIGIN + (tz - 1) * TILE, size = 3 * TILE;
  let px = pin.x, pz = pin.z, kind = pin.kind === "talk" ? PIN.talk : PIN.goal;
  const inside = px >= x0 && px < x0 + size && pz >= z0 && pz < z0 + size;
  if (!inside) {
    // walk from the player toward the target until the line meets the rim (half a cell in, so it sits on the edge cells)
    const lo = x0 + cell / 2, hi = x0 + size - cell / 2, loz = z0 + cell / 2, hiz = z0 + size - cell / 2;
    const dx = px - x, dz = pz - z;
    let t = 1;
    if (dx > 0) t = Math.min(t, (hi - x) / dx); else if (dx < 0) t = Math.min(t, (lo - x) / dx);
    if (dz > 0) t = Math.min(t, (hiz - z) / dz); else if (dz < 0) t = Math.min(t, (loz - z) / dz);
    px = x + dx * Math.max(0, t); pz = z + dz * Math.max(0, t);
    kind = PIN.edge;
  }
  const c = Math.min(n - 1, Math.max(0, Math.floor((px - x0) / cell)));
  const r = Math.min(n - 1, Math.max(0, Math.floor((pz - z0) / cell)));
  return PIN_COLS[c] + PIN_ROWS[r] + kind;
}

// What the HUD should show for one player. charted: false for other dimensions. pin: see pinCode.
export function hudString({ x, z, yaw, charted = true, off = false, pin }) {
  if (off) return `${KEY}qzoff___${NO_PIN}|`;
  const tx = Math.floor((x - ORIGIN) / TILE), tz = Math.floor((z - ORIGIN) / TILE);
  if (!charted || tx < 0 || tz < 0 || tx >= TILES || tz >= TILES) return `${KEY}qznone__${NO_PIN}|${charted ? "Beyond the map" : "Uncharted"}`;
  const step = TILE / SPOTS;
  const sx = Math.floor((x - ORIGIN - tx * TILE) / step), sz = Math.floor((z - ORIGIN - tz * TILE) / step);
  return `${KEY}${DIRS[arrowDir(yaw)]}${LETTERS[sz * SPOTS + sx]}x${pad2(tx)}z${pad2(tz)}${pinCode(x, z, tx, tz, pin)}|${cleanLabel(placeName(x, z))}`;
}

// The same cutting the HUD does (tools/minimap_ui.py), so the tests can check the two agree.
export function readHud(title) {
  const s = title.split(KEY).join("");
  const dp = s.slice(0, 2), d = dp.slice(0, 1), p = dp.split(d).join("");
  const t = s.split(dp).join("").slice(0, 6);
  const crk = s.split(s.slice(0, 8)).join("").slice(0, 3), c = crk.slice(0, 1), cr = crk.slice(0, 2);
  return { dir: d, spot: p, tile: t, col: c, row: cr.split(c).join(""), kind: crk.split(cr).join(""), label: s.split(s.slice(0, 12)).join("") };
}
