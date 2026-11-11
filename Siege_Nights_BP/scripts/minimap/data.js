// The minimap's arithmetic, kept free of Minecraft so the self-tests can run it anywhere.
// The textures come from tools/minimap_tiles.py and the HUD layout from tools/minimap_ui.py;
// the numbers below must match both.

import { PLOT_PLAN, WARDS } from "../plots/config.js";
import { REGION_CELL, REGION_ROWS } from "./regions.js";

export const KEY = "hcm:";        // hidden titles that start with this feed the HUD map
export const ORIGIN = -1280;      // world x/z where tile 0 starts
export const TILE = 64;           // blocks per tile; a view shows 3 x 3 tiles around the player
export const TILES = 40;          // tiles per side
export const SPOTS = 4;           // the arrow moves in a 4 x 4 grid inside the middle tile
export const NEAR = 110;          // name a settlement when this close, otherwise the region
const LETTERS = "abcdefghijklmnop";
const REGION_NAMES = ["Aldmere Vale", "Frostmarch", "Saltreach", "Blackfen", "Emberwaste"];

// Places worth a name on the map: the twelve plots and the towns. Caves and sinks stay unnamed (they
// are for finding), and so does the sealed pass.
export const PLACES = [
  ...PLOT_PLAN.map((p) => ({ name: p.name, x: p.x, z: p.z, r: NEAR })),
  ...WARDS.filter((w) => !w.thin && w.name !== "the Shut Pass").map((w) => ({ name: w.name, x: w.x, z: w.z, r: Math.max(NEAR, w.r + 30) })),
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

// What the HUD should show for one player. charted: false for other dimensions.
export function hudString({ x, z, yaw, charted = true, off = false }) {
  if (off) return `${KEY}0zoff_|`;
  const tx = Math.floor((x - ORIGIN) / TILE), tz = Math.floor((z - ORIGIN) / TILE);
  if (!charted || tx < 0 || tz < 0 || tx >= TILES || tz >= TILES) return `${KEY}0znone|${charted ? "Beyond the map" : "Uncharted"}`;
  const step = TILE / SPOTS;
  const sx = Math.floor((x - ORIGIN - tx * TILE) / step), sz = Math.floor((z - ORIGIN - tz * TILE) / step);
  return `${KEY}${arrowDir(yaw)}${LETTERS[sz * SPOTS + sx]}${pad2(tx)}${pad2(tz)}|${cleanLabel(placeName(x, z))}`;
}

// The same cutting the HUD does (tools/minimap_ui.py), so the tests can check the two agree.
export function readHud(title) {
  const s = title.split(KEY).join("");
  const dp = s.slice(0, 2), d = dp.slice(0, 1), p = dp.split(d).join("");
  const r = s.split(dp).join("");
  const t = r.slice(0, 4);
  return { dir: d, spot: p, tile: t, label: r.split(r.slice(0, 5)).join("") };
}
