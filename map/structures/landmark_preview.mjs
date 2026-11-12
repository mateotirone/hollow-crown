// Set every landmark on the real map ground (offline) with the game's own planner, and write:
//   Siege_Nights_BP/scripts/landmarks/spots_data.js  where each seeking piece lands (the game uses these)
//   OUT/<site>.scene.json                              terrain + landmark, for render/render.py previews
//
//   node landmark_preview.mjs HEIGHTS.npy WATER.npy OUT [site id ...]
// HEIGHTS: genworld's hollow-crown-full-map-heights-pretown.npy (int16 [x, z], origin -1264).
// WATER: the same grid, the water surface y where a column is under water, else -999 (genworld water_level).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const LM = join(HERE, "..", "..", "Siege_Nights_BP", "scripts", "landmarks");
const { DESIGNS } = await import(join(LM, "designs_data.js"));
const { LANDMARKS } = await import(join(LM, "sites.js"));
const { planPiece, seekSpot, designFor, AIR } = await import(join(LM, "plan.js"));
const { PLOT_PLAN } = await import(join(LM, "..", "plots", "config.js"));

function npy(path) {
  const b = readFileSync(path);
  const hl = b.readUInt16LE(8);
  const header = b.toString("latin1", 10, 10 + hl);
  const shape = header.match(/\((\d+), (\d+)\)/).slice(1).map(Number);
  const data = new Int16Array(b.buffer.slice(b.byteOffset + 10 + hl, b.byteOffset + b.length));
  return { shape, at: (x, z) => data[(x + 1264) * shape[1] + (z + 1264)] };
}

const [hp, wp, out, ...only] = process.argv.slice(2);
const H = npy(hp), W = npy(wp);
const height = (x, z) => H.at(x, z);
const water = (x, z) => { const w = W.at(x, z); return w > -999 ? w : undefined; };
mkdirSync(out, { recursive: true });

const REGION_TOP = { "Aldmere Vale": "grass_block", Frostmarch: "snow", Saltreach: "grass_block", Blackfen: "mud", Emberwaste: "sand" };
const spots = {};
for (const site of LANDMARKS) {
  if (only.length && !only.includes(site.id)) continue;
  const region = site.region ?? PLOT_PLAN.find((p) => p.name === site.plot)?.region;
  const placed = [];
  spots[site.id] = [];
  for (const piece of site.pieces) {
    let x = site.x + (piece.dx ?? 0), z = site.z + (piece.dz ?? 0), face = piece.face;
    if (piece.seek) {
      const s = seekSpot({ x, z }, piece.seek, height, water);
      if (!s) { console.log(`${site.id}: ${designFor(piece, "n")} found no ${piece.seek.kind}`); spots[site.id].push(null); continue; }
      ({ x, z, face } = s);
    }
    spots[site.id].push(piece.seek ? { x, z, face } : null);
    const id = piece.turns ? `${piece.d}@${face ?? "n"}` : piece.d;
    const d = DESIGNS[id];
    const { ops, G } = planPiece(d, x, z, height, water);
    placed.push({ d, ops, x, z });
    console.log(`${site.id}: ${id} at ${x} ${G} ${z}, ${ops.length} ops`);
  }
  // one scene per group of pieces that stand together (a piece far from the rest gets its own)
  const groups = [];
  for (const p of placed) {
    const g = groups.find((q) => Math.hypot(q[0].x - p.x, q[0].z - p.z) < 60);
    if (g) g.push(p); else groups.push([p]);
  }
  groups.forEach((group, gi) => scene(site, region, group, gi ? `${site.id}_${gi}` : site.id));
}

function scene(site, region, placed, name) {
  const xs = placed.flatMap((p) => p.ops.map((o) => o[0])), zs = placed.flatMap((p) => p.ops.map((o) => o[2]));
  if (!xs.length) return;
  const lo = (a) => a.reduce((m, v) => (v < m ? v : m), Infinity), hi = (a) => a.reduce((m, v) => (v > m ? v : m), -Infinity);
  const x0 = lo(xs) - 6, x1 = hi(xs) + 6, z0 = lo(zs) - 6, z1 = hi(zs) + 6;
  const pal = [], key = new Map(), cells = new Map();
  const ix = (n, p = {}) => { const k = JSON.stringify([n, p]); if (!key.has(k)) { key.set(k, pal.length); pal.push([n, p]); } return key.get(k); };
  const T = ix(REGION_TOP[region] ?? "grass_block"), DIRT = ix(region === "Emberwaste" ? "sandstone" : "dirt"), STONE = ix("stone"), WATER = ix("water");
  let gmin = Infinity;
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) gmin = Math.min(gmin, height(x, z));
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
    const g = height(x, z);
    for (let y = gmin - 3; y <= g; y++) cells.set(`${x},${y},${z}`, y === g ? T : y > g - 3 ? DIRT : STONE);
    const w = water(x, z);
    if (w !== undefined) for (let y = g + 1; y <= w; y++) cells.set(`${x},${y},${z}`, WATER);
  }
  for (const { d, ops } of placed) {
    // the game resolves Bedrock states; the renderer reads logical props, so turn the common ones back
    const logical = d.palette.map(([id, st]) => {
      const n = id.replace("minecraft:", "");
      const p = {};
      if ("weirdo_direction" in st) p.facing = ["e", "w", "s", "n"][st.weirdo_direction];
      if ("upside_down_bit" in st && st.upside_down_bit) p.half = "top";
      if ("minecraft:vertical_half" in st) p.half = st["minecraft:vertical_half"];
      if ("pillar_axis" in st) p.axis = st.pillar_axis;
      if ("direction" in st && n.endsWith("trapdoor")) p.facing = ["e", "w", "s", "n"][st.direction];
      if ("open_bit" in st) p.open = st.open_bit;
      if ("hanging" in st) p.hanging = st.hanging;
      if ("facing_direction" in st) p.facing = { 2: "n", 3: "s", 4: "w", 5: "e" }[st.facing_direction] ?? "n";
      if ("minecraft:cardinal_direction" in st) p.facing = st["minecraft:cardinal_direction"][0];
      const conn = {};
      for (const [d, k] of [["n", "north"], ["s", "south"], ["e", "east"], ["w", "west"]]) {
        if (st[`minecraft:connection_${k}`]) conn[d] = true;
        if (st[`wall_connection_type_${k}`] && st[`wall_connection_type_${k}`] !== "none") conn[d] = true;
      }
      if (Object.keys(conn).length) p.conn = conn;
      return ix(n, p);
    });
    for (const [x, y, z, i] of ops) {
      const k = `${x},${y},${z}`;
      if (i === AIR) cells.delete(k); else cells.set(k, i === -2 ? T : logical[i]);
    }
  }
  const blocks = [...cells].map(([k, i]) => [...k.split(",").map(Number), i]);
  const ys = blocks.map((b) => b[1]);
  const ymin = lo(ys);
  const cx = Math.round((x0 + x1) / 2), cz = Math.round((z0 + z1) / 2);
  const local = blocks.map(([x, y, z, i]) => [x - cx, y - ymin, z - cz, i]);
  const w = Math.max(x1 - x0, z1 - z0);
  const dist = 1.15;
  writeFileSync(join(out, `${name}.scene.json`), JSON.stringify({ palette: pal, blocks: local, camera: { views: { "front-left": [-35, 30, dist], "front-right": [35, 30, dist], high: [20, 60, dist * 1.1], back: [145, 30, dist] } } }));
}
if (!only.length) {
  writeFileSync(join(LM, "spots_data.js"), "// Generated by map/structures/landmark_preview.mjs from the map's ground and water. Do not edit by hand.\n" +
    "// Where each seeking piece of each landmark stands: { site id: [ { x, z, face } | null per piece ] }\n" +
    `export const SPOTS = ${JSON.stringify(spots)};\n`);
  console.log("wrote spots_data.js");
}
