// The minimap down in the Hollow (Mateo, 2026-11-13). Its own grid, since the Hollow is a separate world
// (x -700..700, z -48..2460) that the overworld grid doesn't cover. Tiles are painted by tools/hollow_minimap.py
// as textures/ui/hc/minimap/mhXXzZZ.png, so the HUD (tools/minimap_ui.py) needs nothing new: the tile code is
// "hXXzZZ" in place of "xXXzZZ". Tiles with nothing but void in their view say "none__".
// Pure maths, no Minecraft calls.

import { SITES } from "../undertow/roads.js";
import { UNDERTOW_LAYOUT as L, stageAt } from "../undertow/layout.js";
import { HOLLOW_TILES } from "./hollow_tiles.js";
import { KEY, SPOTS, arrowDir, cleanLabel, pinCode, NO_PIN } from "./data.js";

export const HOLLOW_MAP = { x0: -704, z0: -64, tile: 64, cols: 22, rows: 40 };

const lit = new Set(HOLLOW_TILES);

// The 6-character tile code for a spot, or null when the map has no picture there.
export function hollowTile(x, z, M = HOLLOW_MAP) {
  const tx = Math.floor((x - M.x0) / M.tile), tz = Math.floor((z - M.z0) / M.tile);
  if (tx < 0 || tz < 0 || tx >= M.cols || tz >= M.rows) return null;
  const code = `h${String(tx).padStart(2, "0")}z${String(tz).padStart(2, "0")}`;
  return lit.has(code) ? { code, tx, tz } : null;
}

// What the label says down here: a hand-designed place when you are at it, the stretch of the story path when
// you are in the valley, and the far country beyond.
export function hollowPlace(x, z) {
  let best = null, bestD = Infinity;
  for (const s of SITES) {
    if (!s.name || s.id === "vault_stair") continue;
    const d = Math.hypot(x - s.x, z - s.z);
    if (d <= s.r + 30 && d < bestD) { best = s; bestD = d; }
  }
  if (best) return best.name;
  if (Math.abs(x) <= L.halfWidth) return stageAt(Math.floor(z))?.name ?? "The far country";
  return "The far country";
}

// The HUD title for a player in the Hollow, in the same shape data.js hudString makes for the overworld
// (readHud reads both): direction letter, spot letter, tile code, quest pin (data.js pinCode, on this grid), "|", label.
const LETTERS = "abcdefghijklmnop", DIRS = "qrstuvwy"; // as in data.js
export function hollowHud({ x, z, yaw, hidden = false, pin }, M = HOLLOW_MAP) {
  const t = hidden ? null : hollowTile(x, z, M);
  if (!t) return `${KEY}qznone__${NO_PIN}|${hidden ? "Uncharted" : "Beyond the map"}`;
  const step = M.tile / SPOTS;
  const sx = Math.floor((x - M.x0 - t.tx * M.tile) / step), sz = Math.floor((z - M.z0 - t.tz * M.tile) / step);
  return `${KEY}${DIRS[arrowDir(yaw)]}${LETTERS[sz * SPOTS + sx]}${t.code}${pinCode(x, z, t.tx, t.tz, pin, { x: M.x0, z: M.z0 })}|${cleanLabel(hollowPlace(x, z))}`;
}
