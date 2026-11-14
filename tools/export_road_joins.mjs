#!/usr/bin/env node
// The road from each map plot's gate to the map's own roads -> Siege_Nights_BP/scripts/settle/roadjoin_data.js
//
//   node tools/export_road_joins.mjs [MAP_DIR] [--png OUT_DIR]
//     MAP_DIR (default /mnt/project-files/siege-nights/map) holds what map/draw_map.py and map/genworld.py leave there:
//       lines.json (the rail lines the roads run beside, and the trails), hollow-crown-full-map-heights.npy and
//       hollow-crown-full-map-water.npy (int16 [x, z], origin -1264; water -999 = none; may be older than the heights)
//     --png also writes a top view of every route over the map preview (route-<plot>.png), for checking by eye
//
// Why (Mateo's playtest 2026-11-13, "My path just ends"): a founded settlement's gate road stopped dead in the grass.
// The game looked for a map road only 48 blocks straight out from the gate (settle/founding.js joinRoad), and at four
// of the twelve plots the nearest road is 55 to 77 blocks away, round a bend. The map never changes once players
// move in, so the route is worked out here, on the map itself, once: from the end of the Hamlet's gate road straight
// out along the gate line to the edge of the settlement land (the later tiers' gate road runs there), then the cheapest
// way over the land to the nearest road (a trail if no road is near), round water and steep ground.
//
// Roads are drawn the way genworld.py draws them: the rail line moved 8 blocks to its right, 5 wide, on land and not
// in a river; trails 3 wide. Output per plot (keys = plot name in lower case, coordinates from the Plot Stone):
//   { from: [dx, dz] the Hamlet gate road's end, path: [[dx, dz], ...] corners of the route (from first, to last),
//     to: [dx, dz] the road cell it meets, kind: "road" | "trail", length: blocks along it, wet: water cells crossed }

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { TOWNS } from "../Siege_Nights_BP/scripts/settle/towns_data.js";
import { groundwork, wallRadius } from "../Siege_Nights_BP/scripts/settle/towns.js";
import { gateDir, roadEnd, roadLine, ROAD_JOIN_PATHY } from "../Siege_Nights_BP/scripts/settle/basedata.js";
import { PLOT_PLAN, SETTLEMENT } from "../Siege_Nights_BP/scripts/plots/config.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const pngAt = args.indexOf("--png");
const pngDir = pngAt >= 0 ? args.splice(pngAt, 2)[1] : undefined;
const MAP = args[0] ?? "/mnt/project-files/siege-nights/map";
const OUT = path.join(here, "..", "Siege_Nights_BP", "scripts", "settle", "roadjoin_data.js");
const ORIGIN = -1264;
const WIN = 230; // blocks searched each way from the Plot Stone
const ROADOFF = 8; // genworld.py: the road runs this far right of the rail line

function npy(file) {
  const buf = fs.readFileSync(file);
  const hlen = buf.readUInt16LE(8);
  const header = buf.toString("latin1", 10, 10 + hlen);
  const shape = header.match(/\((\d+),\s*(\d+)\)/).slice(1).map(Number);
  if (!/<i2/.test(header) || /True/.test(header.match(/fortran_order':\s*(\w+)/)[0])) throw new Error(`${file}: want int16, C order`);
  const data = new Int16Array(buf.buffer.slice(buf.byteOffset + 10 + hlen, buf.byteOffset + buf.length));
  return { n: shape[1], at: (x, z) => data[(x - ORIGIN) * shape[1] + (z - ORIGIN)] };
}

const L = JSON.parse(fs.readFileSync(path.join(MAP, "lines.json"), "utf8"));
const H = npy(path.join(MAP, "hollow-crown-full-map-heights.npy"));
const W = npy(path.join(MAP, "hollow-crown-full-map-water.npy"));

// genworld.py offset_line (numpy gradient: one-sided at the ends, central inside)
function offsetLine(P, d) {
  return P.map((p, i) => {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)];
    let tx = b[0] - a[0], tz = b[1] - a[1];
    const l = Math.hypot(tx, tz) || 1;
    tx /= l; tz /= l;
    return [p[0] - tz * d, p[1] + tx * d];
  });
}
const lines = [
  ...Object.values(L.roads).map((P) => ({ P: offsetLine(P, ROADOFF), half: 2.5, kind: "road" })),
  ...Object.values(L.trails).map((P) => ({ P, half: 1.5, kind: "trail" })),
];
function segDist(px, pz, a, b) {
  const vx = b[0] - a[0], vz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((px - a[0]) * vx + (pz - a[1]) * vz) / (vx * vx + vz * vz || 1)));
  return Math.hypot(px - a[0] - t * vx, pz - a[1] - t * vz);
}
// water: ground below the sea (rivers, lakes, fen pools: genworld sinks their beds under SEA = 62), or a water surface
// the saved water grid marks above the ground
const SEA = 62;
const wet = (x, z) => H.at(x, z) < SEA || (W.at(x, z) !== -999 && W.at(x, z) > H.at(x, z));

// road / trail cells in the window round a plot: Map "x,z" -> kind (a road wins over a trail)
function roadCells(cx, cz) {
  const out = new Map();
  for (const { P, half, kind } of lines) for (let i = 0; i + 1 < P.length; i++) {
    const a = P[i], b = P[i + 1];
    const x0 = Math.floor(Math.min(a[0], b[0]) - half), x1 = Math.ceil(Math.max(a[0], b[0]) + half);
    const z0 = Math.floor(Math.min(a[1], b[1]) - half), z1 = Math.ceil(Math.max(a[1], b[1]) + half);
    if (x1 < cx - WIN || x0 > cx + WIN || z1 < cz - WIN || z0 > cz + WIN) continue;
    for (let x = Math.max(x0, cx - WIN); x <= Math.min(x1, cx + WIN); x++) for (let z = Math.max(z0, cz - WIN); z <= Math.min(z1, cz + WIN); z++) {
      if (segDist(x + 0.5, z + 0.5, a, b) > half || wet(x, z)) continue;
      const k = `${x},${z}`;
      if (out.get(k) !== "road") out.set(k, kind);
    }
  }
  return out;
}

// a small binary heap of [cost, index]
class Heap {
  constructor() { this.a = []; }
  push(c, i) { const a = this.a; a.push([c, i]); let k = a.length - 1; while (k) { const p = (k - 1) >> 1; if (a[p][0] <= a[k][0]) break; [a[p], a[k]] = [a[k], a[p]]; k = p; } }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) { a[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === k) break; [a[m], a[k]] = [a[k], a[m]]; k = m; } }
    return top;
  }
  get size() { return this.a.length; }
}

const N = 2 * WIN + 1;
function route(plot, tw, layout) {
  const dir = gateDir(tw.gate), side = { x: -dir.z, z: dir.x };
  const tops = new Map();
  for (const [dx, dy, dz, p] of groundwork(layout, 0)) {
    const id = layout.pal[p]?.[0] ?? "", k = `${dx},${dz}`;
    if (id !== "minecraft:air" && (!tops.has(k) || tops.get(k).dy < dy)) tops.set(k, { x: dx, z: dz, dy, id });
  }
  const end = roadEnd([...tops.values()].filter((c) => ROAD_JOIN_PATHY.test(c.id)), dir);
  const land = Math.max(SETTLEMENT.landRadius, wallRadius(tw, 3) + 6);
  // the straight run out along the gate line, to the edge of the settlement land
  const straight = [];
  for (let k = 0; ; k++) {
    const x = end.x + dir.x * k, z = end.z + dir.z * k;
    straight.push([x, z]);
    if (Math.hypot(x, z) >= land) break;
  }
  const cx = plot.x, cz = plot.z;
  const roads = roadCells(cx, cz);
  const idx = (dx, dz) => (dx + WIN) * N + (dz + WIN);
  const g = new Float64Array(N * N).fill(Infinity), from = new Int32Array(N * N).fill(-1);
  const heap = new Heap();
  straight.forEach(([x, z], k) => { const i = idx(x, z); g[i] = k; heap.push(k, i); });
  const onAxis = (dx, dz) => Math.abs(dx * side.x + dz * side.z) <= 2 && (dx - end.x) * dir.x + (dz - end.z) * dir.z >= 0;
  let goal = -1, goalKind;
  const STEPS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
  while (heap.size) {
    const [c, i] = heap.pop();
    if (c > g[i]) continue;
    const dx = Math.floor(i / N) - WIN, dz = (i % N) - WIN, x = cx + dx, z = cz + dz;
    const kind = roads.get(`${x},${z}`);
    if (kind && Math.hypot(dx, dz) > land - 4) { goal = i; goalKind = kind; break; }
    const h = H.at(x, z);
    for (const [ux, uz, len] of STEPS) {
      const nx = dx + ux, nz = dz + uz;
      if (Math.abs(nx) > WIN || Math.abs(nz) > WIN) continue;
      const wx = cx + nx, wz = cz + nz;
      let cost = len;
      const rise = Math.abs(H.at(wx, wz) - h);
      if (rise > 1) cost += 12 * (rise - 1) * len; // steep: the road would cut or fill a lot
      else cost += 0.6 * rise * len;
      if (wet(wx, wz)) cost += 40 * len; // water: go round it if at all possible
      if (Math.hypot(nx, nz) < land && !onAxis(nx, nz)) cost += 30 * len; // future town land: keep to the gate line
      const j = idx(nx, nz);
      if (g[i] + cost < g[j]) { g[j] = g[i] + cost; from[j] = i; heap.push(g[j], j); }
    }
  }
  if (goal < 0) throw new Error(`${plot.name}: no road within ${WIN} blocks`);
  const cells = [];
  for (let i = goal; i >= 0; i = from[i]) cells.push([Math.floor(i / N) - WIN, (i % N) - WIN]);
  cells.reverse();
  // the A* starts anywhere on the straight run; the route keeps the run up to that point
  const startAt = straight.findIndex(([x, z]) => x === cells[0][0] && z === cells[0][1]);
  const full = [...straight.slice(0, startAt), ...cells];
  // corners only (a corner wherever the step changes), then check the 4-connected line the game lays between them
  const corners = [full[0]];
  for (let k = 1; k + 1 < full.length; k++) {
    const a = full[k - 1], b = full[k], c = full[k + 1];
    if (b[0] - a[0] !== c[0] - b[0] || b[1] - a[1] !== c[1] - b[1]) corners.push(b);
  }
  corners.push(full[full.length - 1]);
  const laid = [];
  for (let k = 0; k + 1 < corners.length; k++) {
    const seg = roadLine({ x: corners[k][0], z: corners[k][1] }, { x: corners[k + 1][0], z: corners[k + 1][1] });
    laid.push(...(k ? seg.slice(1) : seg));
  }
  const wetCells = laid.filter((p) => wet(cx + p.x, cz + p.z)).length;
  return { from: [end.x, end.z], path: corners, to: full[full.length - 1], kind: goalKind, length: laid.length, wet: wetCells, laid };
}

const out = {};
const report = [];
for (const plot of PLOT_PLAN) {
  const key = plot.name.toLowerCase();
  const tw = TOWNS[key];
  if (!tw) continue;
  const routes = tw.variants.map((v) => route(plot, tw, v));
  // every layout of a plot shares its Hamlet (the starter village), so one route serves them all; if a re-export ever
  // gives one layout another gate road end, the game lays a short line from that end to `from` first
  const r = routes[0];
  for (const o of routes.slice(1)) if (o.from.join() !== r.from.join()) report.push(`  note: ${plot.name} layouts end their gate roads at ${r.from} and ${o.from}`);
  out[key] = { from: r.from, path: r.path, to: r.to, kind: r.kind, length: r.length, wet: r.wet };
  report.push(`${plot.name.padEnd(12)} gate ${String(tw.gate).padStart(3)}  from ${r.from}  to ${r.to} (${r.kind})  ${r.length} blocks, ${r.path.length} corners, ${r.wet} wet`);
  if (pngDir) out[key]._laid = r.laid;
}

const pngs = pngDir ? Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v._laid])) : null;
for (const v of Object.values(out)) delete v._laid;
const text = `// Generated by tools/export_road_joins.mjs from the world map (lines.json, heights, water). Do not edit by hand.
// The road from each plot's Hamlet gate road out to the nearest map road (settle/founding.js joinRoad lays it).
// Coordinates are blocks from the Plot Stone; path = the route's corners, laid corner to corner with roadLine.
export const ROAD_JOINS = ${JSON.stringify(out)};
`;
fs.writeFileSync(OUT, text);
console.log(report.join("\n"));
console.log(`wrote ${path.relative(process.cwd(), OUT)}`);

if (pngDir) {
  // a top view per plot over the map preview, drawn by Python (PIL is there wherever the map tools run)
  fs.mkdirSync(pngDir, { recursive: true });
  const job = path.join(pngDir, "routes.json");
  fs.writeFileSync(job, JSON.stringify(PLOT_PLAN.filter((p) => pngs[p.name.toLowerCase()]).map((p) => ({ name: p.name, x: p.x, z: p.z, laid: pngs[p.name.toLowerCase()].map((c) => [c.x, c.z]) }))));
  console.log(`routes for the preview: ${job}`);
}
