// Sample the Hollow's generated land for tools/hollow_minimap.py: one byte of kind and one of height every
// STEP blocks over the Hollow's map grid (scripts/minimap/hollow.js) plus a tile of margin round it.
//   node tools/hollow_minimap_dump.mjs OUT.bin
// Kinds: 0 void, 1 light river or pool, 2 road, 3 site pad, 4 wood, 5 high, 6 fen, 7 waste, 8 chasm/arena.
import { writeFileSync } from "fs";
import { columnAt } from "../Siege_Nights_BP/scripts/undertow/terrain.js";
import { UNDERTOW_LAYOUT as L } from "../Siege_Nights_BP/scripts/undertow/layout.js";
import { HOLLOW_MAP } from "../Siege_Nights_BP/scripts/minimap/hollow.js";

const STEP = 2;
const M = HOLLOW_MAP, x0 = M.x0 - M.tile, z0 = M.z0 - M.tile;
const W = ((M.cols + 2) * M.tile) / STEP, H = ((M.rows + 2) * M.tile) / STEP;
const REG = { wood: 4, high: 5, fen: 6, waste: 7 };
const out = Buffer.alloc(8 + W * H * 2);
out.writeInt32LE(W, 0); out.writeInt32LE(H, 4);
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
  const x = x0 + i * STEP, z = z0 + j * STEP;
  let kind = 0, h = 0;
  const c = columnAt(x, z);
  if (c) {
    h = Math.max(0, Math.min(255, c.h));
    if (c.h <= L.seaY || c.river <= 3.5) kind = 1;
    else if (c.paved) kind = 2;
    else if (c.site) kind = 3;
    else kind = REG[c.region] ?? 4;
  }
  const k = 8 + (j * W + i) * 2;
  out[k] = kind; out[k + 1] = h;
}
writeFileSync(process.argv[2], out);
console.log(`sampled ${W} x ${H} every ${STEP} blocks`);
