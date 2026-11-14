// Plan the world's landmarks (landmarks/sites.js) on a real world's ground, offline, with the game's own planner
// (landmarks/plan.js and the same piece placing as landmarks/index.js), so a story build can be checked in 3D before
// a player ever walks up to it. tools/sim_landmarks.py reads the ground out of a world and stamps the result.
//
//   node tools/sim_landmarks.mjs need [site ...]          -> JSON: the ground boxes to read, per site and piece
//   node tools/sim_landmarks.mjs plan PROBE.json [site ...] -> JSON: { site: [{ k, d, x, z, G, ops: [[x,y,z,name,states]] }] }
// PROBE.json: { "<site>#<k>": { x0, z0, nx, nz, ground: [...], water: [...], top: [[name, states]|null ...] } } (x-major)
import { readFileSync } from "node:fs";
import { DESIGNS } from "../Siege_Nights_BP/scripts/landmarks/designs_data.js";
import { SPOTS } from "../Siege_Nights_BP/scripts/landmarks/spots_data.js";
import { LANDMARKS } from "../Siege_Nights_BP/scripts/landmarks/sites.js";
import { planPiece, seekSpot, settleNow, AIR, KEEP_TOP, BUILT_TOP } from "../Siege_Nights_BP/scripts/landmarks/plan.js";

const designId = (piece, face) => (piece.turns ? `${piece.d}@${face ?? "n"}` : piece.d);
const [mode, ...rest] = process.argv.slice(2);
const probePath = mode === "plan" ? rest.shift() : undefined;
const sites = LANDMARKS.filter((s) => !rest.length || rest.includes(s.id));
const SEEK_R = 40; // index.js caps a seek at 40 blocks when the site has no saved spot

if (mode === "need") {
  const out = [];
  for (const s of sites) s.pieces.forEach((piece, k) => {
    const sp = SPOTS[s.id]?.[k];
    const x = sp?.x ?? s.x + (piece.dx ?? 0), z = sp?.z ?? s.z + (piece.dz ?? 0);
    const ds = piece.turns ? ["n", "e", "s", "w"].map((f) => DESIGNS[designId(piece, f)]).filter(Boolean) : [DESIGNS[piece.d]].filter(Boolean);
    let r = 0;
    for (const d of ds) r = Math.max(r, -d.box.x0, d.box.x1, -d.box.z0, d.box.z1, 0) + (d.ease ?? 3) + 1;
    if (piece.seek && !sp) r += SEEK_R;
    out.push({ key: `${s.id}#${k}`, x0: x - r, z0: z - r, nx: 2 * r + 1, nz: 2 * r + 1 });
  });
  process.stdout.write(JSON.stringify(out));
} else if (mode === "plan") {
  const probe = JSON.parse(readFileSync(probePath, "utf8"));
  const out = {};
  for (const s of sites) {
    out[s.id] = [];
    s.pieces.forEach((piece, k) => {
      const P = probe[`${s.id}#${k}`];
      if (!P) return;
      const idx = (x, z) => { const i = x - P.x0, j = z - P.z0; return i < 0 || j < 0 || i >= P.nx || j >= P.nz ? -1 : i * P.nz + j; };
      const height = (x, z) => { const i = idx(x, z); return i < 0 ? undefined : P.ground[i] ?? undefined; };
      const water = (x, z) => { const i = idx(x, z); return i < 0 ? undefined : P.water[i] ?? undefined; };
      let x = s.x + (piece.dx ?? 0), z = s.z + (piece.dz ?? 0), face = piece.face;
      if (piece.seek) {
        const sp = SPOTS[s.id]?.[k] ?? seekSpot({ x, z }, { ...piece.seek, max: Math.min(piece.seek.max ?? 40, 40) }, height, water);
        if (!sp) { out[s.id].push({ k, missing: true }); return; }
        ({ x, z, face } = sp);
      }
      const did = designId(piece, face), d = DESIGNS[did];
      if (!d) { out[s.id].push({ k, missing: true, d: did }); return; }
      const built = (ox, oz) => { const i = idx(ox, oz); return i >= 0 && !!P.top[i] && BUILT_TOP.test(P.top[i][0]); };
      const planned = planPiece(d, x, z, height, water, built), G = planned.G;
      const ops = settleNow(planned.ops, d, height);   // as landmarks/index.js does
      const top = (ox, oz) => { const i = idx(ox, oz); return (i >= 0 && P.top[i]) || P.top[idx(x, z)] || ["minecraft:grass_block", {}]; };
      out[s.id].push({ k, d: did, x, z, G, ops: ops.map(([ox, oy, oz, i]) => i === AIR ? [ox, oy, oz, "minecraft:air", {}]
        : i === KEEP_TOP ? [ox, oy, oz, ...top(ox, oz)] : [ox, oy, oz, ...d.palette[i]]) });
    });
  }
  process.stdout.write(JSON.stringify(out));
}
