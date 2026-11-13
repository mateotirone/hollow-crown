// Lays every planned stretch of railway on the REAL map, with the game's own code (trains/rail_bed.js and the
// map's works), and checks the result: the track is all there and joined up, the bed is graded (ballast under the
// track, a clear 3 x 4 space over it, banks no steeper than 1 in 1, no sheer trench), and nothing is left floating.
//
//   python3 tools/export_rail_corridor.py <world dir> map/rail-segments.json corridor.json   (needs amulet-core 1.9)
//   node tools/rail_lay_test.mjs corridor.json [--json report.json] [--dump laid.json]
//
// The world dir is an unzipped .mcworld (the base map, or a playtest world before any stretch is bought).
// Exit code 1 when any check fails. --dump writes the laid blocks round each line for a 3D view.
import fs from "fs";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--")) ?? "/mnt/project-files/siege-nights/map/rail-corridor.json";
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const { ROUTES } = await import("../Siege_Nights_BP/scripts/trains/routes_data.js");
const { pieces, isNatural } = await import("../Siege_Nights_BP/scripts/trains/routes.js");
const { layBed, trackFits, seatTrack, clearBody, applyWorkColumn, clearTreesInColumn, builtColumns, firm, rise, TRACK } = await import(process.env.RAIL_BED ?? "../Siege_Nights_BP/scripts/trains/rail_bed.js"); // RAIL_BED: compare another bed layer

const C = JSON.parse(fs.readFileSync(file, "utf8"));
const edits = new Map();
const orig = (x, y, z) => {
  const c = C.cols[`${x},${z}`];
  if (!c) return undefined; // outside the export: like ground that isn't loaded
  const i = y - c[0];
  return i < 0 ? "minecraft:stone" : i >= c[1].length ? "minecraft:air" : C.palette[c[1][i]];
};
const w = {
  get: (x, y, z) => { const k = `${x},${y},${z}`; return edits.has(k) ? edits.get(k) : orig(x, y, z); },
  set: (x, y, z, id) => edits.set(`${x},${y},${z}`, id),
};
const AIR = "minecraft:air";
const isAir = (t) => t === AIR;

// lay every stretch, in the order the routes list them, the way route_game.js does: works first, then each piece
const blockedAt = {};
const built = builtColumns(ROUTES);
const missing = {};
for (const seg of ROUTES.segments) {
  const pal = (seg.works_palette ?? []).map((e) => e.name);
  const blocked = (x, y, z, id) => (blockedAt[seg.id] ??= []).push([x, y, z, id]);
  for (const [x, z, y0, y1] of seg.works ?? []) if (!clearTreesInColumn(w, x, z, y0, y1, blocked)) (missing[seg.id] ??= []).push(["trees", x, z]);
  for (const [x, z, y0, y1, i] of seg.works ?? []) if (!applyWorkColumn(w, x, z, y0, y1, pal[i], blocked, built)) (missing[seg.id] ??= []).push(["works", x, z]);
  const all = pieces(seg);
  all.forEach((p, i) => {
    if (w.get(p.x, p.y, p.z) !== TRACK && !p.works && !layBed(w, all, i, blocked, built)) { (missing[seg.id] ??= []).push([i, "not loaded"]); return; }
    if (p.works) { clearBody(w, p, blocked, built); seatTrack(w, p); layBed(w, all, i, blocked, built, true); }
    if (!trackFits(w, p)) { (missing[seg.id] ??= []).push([i, w.get(p.x, p.y, p.z)]); return; }
    w.set(p.x, p.y, p.z, TRACK);
  });
}

// RAIL_PEEK="x,y,z;..." prints an east-west and a north-south slice round each point, before and after
for (const at of (process.env.RAIL_PEEK ?? "").split(";").filter(Boolean)) {
  const [x, y, z] = at.split(",").map(Number);
  const sh = (t) => (t ?? "?").replace(/^minecraft:/, "").replace("siege:track", "TRACK").slice(0, 9).padEnd(10);
  for (const [ax, az, name] of [[1, 0, "x"], [0, 1, "z"]]) {
    console.log(`-- ${at} along ${name}: before | after`);
    for (let dy = 5; dy >= -3; dy--) {
      let a = "", b = "";
      for (let d = -5; d <= 5; d++) { a += sh(orig(x + ax * d, y + dy, z + az * d)); b += sh(w.get(x + ax * d, y + dy, z + az * d)); }
      console.log(String(y + dy).padStart(4), a, "|", b);
    }
  }
}

// ---------- checks ----------
const report = {};
const fail = [];
const note = (seg, k, v) => { const r = (report[seg] ??= {}); (r[k] ??= []).push(v); };
const SOFTISH = /leaves|grass$|tall_grass|fern|flower|sapling|bush|vine|snow_layer|moss_carpet|leaf_litter|dandelion|poppy|tulip|orchid|allium|bluet|daisy|cornflower|deadbush|lily/;
const ground = (t) => firm(t) && !/(_fence|_wall|_stairs|_slab|_trapdoor|_log|_wood|_leaves)$/.test(t);
// every line's track columns, to tell where another line's own bed lies beside this one (a junction throat)
const trackCols = new Map();
for (const s of ROUTES.segments) for (const [x, , z] of s.blocks) (trackCols.get(`${x},${z}`) ?? trackCols.set(`${x},${z}`, new Set()).get(`${x},${z}`)).add(s.id);
const otherBed = (segId, x, z) => {
  for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) { const s = trackCols.get(`${x + a},${z + b}`); if (s && !s.has(segId)) return true; }
  return false;
};
for (const seg of ROUTES.segments) {
  const all = pieces(seg);
  const own = new Set(all.map((p) => `${p.x},${p.y},${p.z}`));
  // 1. all there and joined up
  all.forEach((p, i) => {
    if (w.get(p.x, p.y, p.z) !== TRACK) note(seg.id, "gap", [p.x, p.y, p.z, w.get(p.x, p.y, p.z)]);
    if (i && (Math.max(Math.abs(p.x - all[i - 1].x), Math.abs(p.z - all[i - 1].z)) !== 1 || Math.abs(p.y - all[i - 1].y) > 1)) note(seg.id, "break", [p.x, p.y, p.z]);
  });
  // 2. graded: something firm under the track, 3 x 4 clear over it
  // a column beside the track belongs to the piece nearest it (ties to the earlier piece), as in rail_bed.js
  const mine = (i, x, z) => {
    let best = -1, bd = Infinity;
    for (let j = Math.max(0, i - 8); j <= Math.min(all.length - 1, i + 8); j++) { const d = Math.max(Math.abs(all[j].x - x), Math.abs(all[j].z - z)); if (d < bd) { bd = d; best = j; } }
    return best === i;
  };
  for (const [i, p] of all.entries()) {
    if (!firm(w.get(p.x, p.y - 1, p.z)) && w.get(p.x, p.y - 1, p.z) !== TRACK) note(seg.id, "no bed", [p.x, p.y - 1, p.z, w.get(p.x, p.y - 1, p.z)]);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (let dy = dx || dz ? 0 : 1; dy < 4; dy++) {
      if ((dx || dz) && (!mine(i, p.x + dx, p.z + dz) || otherBed(seg.id, p.x + dx, p.z + dz))) continue;
      const t = w.get(p.x + dx, p.y + dy, p.z + dz);
      if (t && !isAir(t) && t !== TRACK && !SOFTISH.test(t) && !/iron_bars|portcullis/.test(t) && !own.has(`${p.x + dx},${p.y + dy},${p.z + dz}`)) {
        if (isNatural(t)) note(seg.id, "in the way", [p.x + dx, p.y + dy, p.z + dz, t]);
        else note(seg.id, "building in the way", [p.x + dx, p.y + dy, p.z + dz, t]);
      }
    }
  }
  // 3. no trench, no wall: natural ground beside the bed is level with the ballast, then rises at most 1 per 2 out
  const topOf = (x, z, from, to) => { for (let y = from; y >= to; y--) { const t = w.get(x, y, z); if (t === undefined) return undefined; if (ground(t)) return { y, t }; } return undefined; };
  const nearWorks = (i) => all.slice(Math.max(0, i - 4), i + 5).some((q) => q.works);
  for (const [i, p] of all.entries()) {
    if (p.works || nearWorks(i)) continue;
    const bed = p.y - 1;
    for (const [ax, az] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
      // across the line only: skip the direction the line runs in
      for (const s of [1, -1]) {
        for (let d = 2; d <= 4; d++) {
          const x = p.x + ax * s * d, z = p.z + az * s * d;
          if (all.some((q) => Math.max(Math.abs(q.x - x), Math.abs(q.z - z)) < d)) continue; // nearer another piece
          if (otherBed(seg.id, x, z) || built.has(`${x},${z}`)) continue; // another line's bed, or the map's works
          const top = topOf(x, z, bed + 12, bed - 12);
          if (!top || !isNatural(top.t)) continue;
          if (top.y > bed + rise(d)) note(seg.id, "trench wall", [x, top.y, z, top.y - bed, d]);
        }
      }
    }
  }
  // 4. exposed dirt the bed made: dirt with air beside it, within 3 of the track, that wasn't open before
  const seen = new Set();
  for (const p of all) for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) for (let y = p.y - 4; y <= p.y + 4; y++) {
    const x = p.x + dx, z = p.z + dz, k = `${x},${y},${z}`;
    if (seen.has(k)) continue; seen.add(k);
    if (w.get(x, y, z) !== "minecraft:dirt" || built.has(`${x},${z}`)) continue; // (works columns: the works' own design)
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = w.get(x + a, y, z + b), n0 = orig(x + a, y, z + b);
      // dirt under ground (something firm over it) laid open where the bed dug beside it: a trench wall
      const over = w.get(x, y + 1, z);
      // (only the soil under the turf: a dirt pocket deep in a rock face is just the rock)
      const soil = !firm(orig(x, y + 3, z));
      if (isAir(n) && !isAir(n0) && soil && firm(over) && !/(_log|_wood)$/.test(over) && edits.has(`${x + a},${y},${z + b}`)) { note(seg.id, "bare dirt", [x, y, z]); break; }
    }
  }
}
// 5. nothing floating: every solid block the laying changed or left beside a change must still reach the ground
//    through solid blocks (searched up to 40 blocks away)
const changed = [...edits.keys()].map((k) => k.split(",").map(Number));
const solid = (t) => !!t && !isAir(t) && !/water|lava|snow_layer|vine|moss_carpet|short_grass|tall_grass|fern|flower/.test(t) && t !== TRACK;
function anchoredIn(get) {
  const memo = new Map();
  return (x, y, z) => {
    const k0 = `${x},${y},${z}`;
    if (memo.has(k0)) return memo.get(k0);
    const seen = new Set([k0]), q = [[x, y, z]];
    let ok = false;
    while (q.length && !ok && seen.size < 6000) {
      const [a, b, c] = q.shift();
      if (b <= y - 3 || Math.abs(a - x) > 40 || Math.abs(c - z) > 40) { ok = true; break; } // well into the ground
      for (const [dx, dy, dz] of [[0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0]]) {
        const k = `${a + dx},${b + dy},${c + dz}`;
        if (seen.has(k)) continue;
        const t = get(a + dx, b + dy, c + dz);
        if (t === undefined) { ok = true; break; } // off the export: assume held
        if (solid(t) || t === TRACK) { seen.add(k); q.push([a + dx, b + dy, c + dz]); }
      }
    }
    if (seen.size >= 6000) ok = true;
    for (const k of seen) memo.set(k, ok);
    return ok;
  };
}
const nowHeld = anchoredIn(w.get), wasHeld = anchoredIn(orig);
const reaches = (x, y, z) => nowHeld(x, y, z) || !wasHeld(x, y, z) && !edits.has(`${x},${y},${z}`); // floating before we came is not ours
const worksBlocks = new Set();
for (const s of ROUTES.segments) for (const [x, z, y0, y1, i] of s.works ?? []) if (i) for (let y = y0; y <= y1; y++) worksBlocks.add(`${x},${y},${z}`);
const floatSeen = new Set();
for (const [x, y, z] of changed) {
  for (const [dx, dy, dz] of [[0, 0, 0], [0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, -1, 0]]) {
    const a = x + dx, b = y + dy, c = z + dz, k = `${a},${b},${c}`;
    if (floatSeen.has(k)) continue; floatSeen.add(k);
    const t = w.get(a, b, c);
    if (!solid(t) || SOFTISH.test(t) && !/leaves/.test(t)) continue;
    if (!reaches(a, b, c)) {
      const seg = ROUTES.segments.find((s) => s.blocks.some(([px, , pz]) => Math.abs(px - a) <= 12 && Math.abs(pz - c) <= 12))?.id ?? "?";
      // the map's own works (a bridge's braces) are the bridge engine's design, checked by its own tests
      note(seg, worksBlocks.has(`${a},${b},${c}`) ? "works block held only at an edge" : "floating", [a, b, c, t]);
    }
  }
}

let total = 0;
const hard = ["gap", "break", "no bed", "in the way", "trench wall", "bare dirt", "floating"];
for (const seg of ROUTES.segments) {
  const r = report[seg.id] ?? {};
  const parts = Object.entries(r).map(([k, v]) => `${k} ${v.length} (e.g. ${v[0].join(" ")})`);
  const bad = Object.entries(r).filter(([k]) => hard.includes(k)).reduce((n, [, v]) => n + v.length, 0);
  total += bad;
  console.log(`${bad ? "FAIL" : "ok  "} ${seg.id.padEnd(24)} ${String(seg.blocks.length).padStart(4)} pieces${parts.length ? "  " + parts.join("; ") : ""}`);
  if (blockedAt[seg.id]?.length) console.log(`       buildings left standing in its way: ${blockedAt[seg.id].length} (e.g. ${blockedAt[seg.id][0].join(" ")})`);
}
console.log(total ? `rail lay test: ${total} problem(s)` : `rail lay test: ALL OK (${ROUTES.segments.length} stretches, ${ROUTES.segments.reduce((n, s) => n + s.blocks.length, 0)} pieces)`);
if (opt("--json")) fs.writeFileSync(opt("--json"), JSON.stringify({ report, blocked: blockedAt, missing }, null, 1));
if (opt("--dump")) {
  // the laid world round each line (columns within 10 of the track), for the 3D view
  const out = { palette: [], cols: {} }, idx = new Map();
  const id = (t) => idx.get(t) ?? (idx.set(t, out.palette.length), out.palette.push(t), out.palette.length - 1);
  for (const [k, [y0, ids]] of Object.entries(C.cols)) {
    const [x, z] = k.split(",").map(Number);
    out.cols[k] = [y0, ids.map((_, i) => id(w.get(x, y0 + i, z)))];
  }
  fs.writeFileSync(opt("--dump"), JSON.stringify(out));
}
process.exit(total ? 1 : 0);
