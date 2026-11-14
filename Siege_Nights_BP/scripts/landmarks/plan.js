// Pure planning for the world's landmarks (no Minecraft calls, so Node tests and the preview tool use it too).
//
// A design (map/structures/landmarks.py, exported by export_landmarks.py into designs_data.js) is a palette of
// [Bedrock id, states] and run-length rows [y, z, x0, count, palette index], offsets from its centre, with y = 0
// the ground layer (the block you stand on). Two ways to sit on the land:
//   rigid  the design keeps its shape: it stands at one ground height G (the median of the ground under it,
//          or the highest when it asks for "max"). Columns under it are filled up or cut down to G, the air
//          over it is cleared, and a ring of `ease` blocks round it is graded back into the real ground.
//   drape  every column follows the land: a block at y sits y above that column's own ground. For things
//          strewn about (fields, rows of posts, a road). With `rise`, a column standing in water is carried
//          up to the surface (posts walking out into the sea).
// A rigid design with `sea` stands on the sea bed: it never clears the water round it, only the air above.
// Ops come out in a safe order: clearing first, then fill, then solid blocks bottom-up, then the "late"
// blocks that hang on others (lanterns, signs, trapdoors, torches, chains). A `dry` design (a room under water)
// sets its solid blocks first and clears after, so its walls stand before the water inside them is taken out.

export const AIR = -1;
export const KEEP_TOP = -2; // "the ground's own top block here" (grass, snow, sand...), read from the world

// every cell of a design: [x, y, z, palette index]
export function cellsOf(d) {
  const out = [];
  for (const [y, z, x0, n, i] of d.rows) for (let x = x0; x < x0 + n; x++) out.push([x, y, z, i]);
  return out;
}

function median(a) {
  if (!a.length) return undefined;
  const s = [...a].sort((p, q) => p - q);
  return s[Math.floor(s.length / 2)];
}

// height(x, z): world y of the top solid ground block there, or undefined if unknown.
// water(x, z): world y of the top water block over that ground, or undefined if dry.
// built(x, z): true where the ground's top block there is something built (another place's wall, a road's
// kerb): the eased ring round a rigid design never grades those (2026-11-14: the Cinder Roost's ring cut the top
// off Sunscar's wall and left its coping hanging over the wall walk).
export const BUILT_TOP = /(^|:)castle_|bricks|planks|_slab|_stairs|_wall$|fence|glass|wool|concrete|polished|smooth_|cut_|chiseled|tiles|lantern|door|_log$|_wood$/;
export function planPiece(d, ox, oz, height, water = () => undefined, built = () => false) {
  const cells = cellsOf(d);
  const late = new Set(d.late ?? []);
  const cols = new Map(); // "x,z" -> [cells]
  for (const c of cells) {
    const k = `${c[0]},${c[2]}`;
    if (!cols.has(k)) cols.set(k, []);
    cols.get(k).push(c);
  }
  const clear = [], fill = [], solid = [], hang = [];
  const put = (list, x, y, z, i) => list.push([ox + x, y, oz + z, i]);
  let G;
  if (d.mode === "carve") {
    G = height(ox, oz);
    if (G === undefined) return { ops: [], G: undefined };
    for (const [x, y, z, i] of cells) {
      const name = d.palette[i][0];
      put(name === "minecraft:air" ? clear : late.has(i) ? hang : solid, x, G + y, z, name === "minecraft:air" ? AIR : i);
    }
  } else if ((d.mode ?? "rigid") === "rigid") {
    const hs = [];
    for (const k of cols.keys()) {
      const [x, z] = k.split(",").map(Number);
      const h = height(ox + x, oz + z);
      if (h !== undefined) hs.push(h);
    }
    G = d.ground === "max" ? Math.max(...hs) : median(hs);
    if (G === undefined || !Number.isFinite(G)) return { ops: [], G: undefined };
    const b = d.box, ease = d.ease ?? 3;
    const top = (d.clearTo ?? b.y1) + 2;
    for (let x = b.x0 - ease; x <= b.x1 + ease; x++) {
      for (let z = b.z0 - ease; z <= b.z1 + ease; z++) {
        const r = height(ox + x, oz + z) ?? G;
        const out = Math.max(b.x0 - x, x - b.x1, b.z0 - z, z - b.z1, 0); // 0 inside the box
        if (out > 0 && built(ox + x, oz + z)) continue;
        const t = out === 0 ? G : Math.round(G + (r - G) * (out / (ease + 1)));
        const col = cols.get(`${x},${z}`) ?? [];
        const wet = d.sea ? water(ox + x, oz + z) : undefined; // a design standing in the sea never clears its water
        const dry = (y) => wet === undefined || y > wet;
        const ownsTop = col.some((c) => c[1] <= 0);
        const lowest = col.length ? Math.min(...col.map((c) => c[1])) : 1;
        // fill up from the real ground to the target (stopping under the design's own lowest block)
        const fills = d.fill != null && (!d.fillRects || d.fillRects.some(([x0, z0, x1, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1));
        for (let y = r + 1; y <= t; y++) {
          if (y - G >= lowest || !fills) break;
          put(fill, x, y, z, y === t && !ownsTop ? d.top : d.fill);
        }
        // cut down to the target: air above it, its top block becomes the ground top
        if (r > t) {
          if (!ownsTop) put(fill, x, t, z, d.top);
          for (let y = t + 1; y <= r; y++) if (!col.some((c) => c[1] === y - G) && dry(y)) put(clear, x, y, z, AIR);
        }
        // air over the design (inside the box only), so trees and grass do not grow through it
        if (out === 0) {
          const have = new Set(col.map((c) => c[1]));
          for (let y = Math.max(t, r) + 1; y <= G + top; y++) if (!have.has(y - G) && dry(y)) put(clear, x, y, z, AIR);
        }
      }
    }
    for (const [x, y, z, i] of cells) put(late.has(i) ? hang : solid, x, G + y, z, i);
  } else {
    const fallback = height(ox, oz);
    for (const [k, col] of cols) {
      const [x, z] = k.split(",").map(Number);
      let g = height(ox + x, oz + z) ?? fallback;
      if (g === undefined) continue;
      const w = water(ox + x, oz + z);
      const up = col.filter((c) => c[1] >= 1);
      if (d.rise && w !== undefined && w >= g) {
        // stand it on the water: the surface is this column's ground, and posts are carried down to the bed
        const base = col.reduce((a, c) => (c[1] < a[1] ? c : a));
        const g2 = w; // the surface layer counts as this column's ground
        if ((d.piles ?? []).includes(base[3])) for (let y = g + 1; y <= g2; y++) put(fill, x, y, z, base[3]);
        g = g2;
      }
      if (!up.length && col.some((c) => c[1] === 0)) put(clear, x, g + 1, z, AIR); // nothing grows on a bare pad
      for (const [cx, y, cz, i] of col) put(late.has(i) ? hang : solid, cx, g + y, cz, i);
    }
    G = fallback;
  }
  clear.sort((a, b) => b[1] - a[1]);
  solid.sort((a, b) => a[1] - b[1]);
  hang.sort((a, b) => a[1] - b[1]);
  if (d.dry) return { ops: [...solid, ...fill, ...clear, ...hang], G };
  return { ops: [...clear, ...fill, ...solid, ...hang], G };
}

// Nothing of a landmark may float (Mateo 2026-11-14: every story build has to be perfect). A drape design follows
// each column's own ground and a rigid one is eased into the land round it, so on real ground a fence post, a leaf or
// a wall stub can end up joined to nothing. settleOps replays the planned ops over the ground (height) and drops every
// placed block not joined by a face or an edge to the ground or to something that is. It is a generator so the game
// can spread it over ticks (yield* in a runJob); run it to the end with settleNow. Returns the kept ops.
const N18 = [];
for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) { const s = Math.abs(a) + Math.abs(b) + Math.abs(c); if (s > 0 && s < 3) N18.push([a, b, c]); }
export function* settleOps(ops, d, height, step = 4000) {
  const key = (x, y, z) => `${x},${y},${z}`;
  const last = new Map(); // cell -> op index (AIR included)
  ops.forEach((o, i) => last.set(key(o[0], o[1], o[2]), i));
  const holds = (i) => i !== undefined && ops[i][3] !== AIR && !/water|lava/.test(d.palette[ops[i][3]]?.[0] ?? "");
  const natural = (x, y, z) => { if (last.has(key(x, y, z))) return false; const g = height(x, z); return g !== undefined && y <= g; };
  const grounded = new Set(), todo = [];
  let n = 0;
  for (const [k, i] of last) {
    if (!holds(i)) continue;
    const [x, y, z] = ops[i];
    if (N18.some(([a, b, c]) => natural(x + a, y + b, z + c))) { grounded.add(k); todo.push(i); }
    if (++n % step === 0) yield;
  }
  while (todo.length) {
    const [x, y, z] = ops[todo.pop()];
    for (const [a, b, c] of N18) {
      const k = key(x + a, y + b, z + c), i = last.get(k);
      if (!grounded.has(k) && holds(i)) { grounded.add(k); todo.push(i); }
    }
    if (++n % step === 0) yield;
  }
  return ops.filter((o) => { const k = key(o[0], o[1], o[2]); return o[3] === AIR || !holds(last.get(k)) || grounded.has(k); });
}
export function settleNow(ops, d, height) {
  const g = settleOps(ops, d, height);
  let r;
  do { r = g.next(); } while (!r.done);
  return r.value;
}

// Where a seeking piece goes. Walks out from the anchor along bearings (0 north, 90 east) round `bearing`,
// `spread` either side, and takes the nearest spot of the wanted kind:
//   water  the last dry column before open water (the piece's front, its -z side, faces the water)
//   edge   the top of a drop of 8 or more within 3 blocks (a cliff edge; the front faces out over it)
// Returns { x, z, face } with face the compass letter the piece's front looks towards, or undefined.
export function seekSpot(anchor, seek, height, water = () => undefined) {
  const { kind, bearing = 0, spread = 60, max = 240, min = 4 } = seek;
  const faceOf = (b) => ["n", "e", "s", "w"][Math.round((((b % 360) + 360) % 360) / 90) % 4];
  if (kind === "uphill") {
    let top;
    for (let b = 0; b < 360; b += 15) {
      const r = (b * Math.PI) / 180;
      const h = height(Math.round(anchor.x + Math.sin(r) * 24), Math.round(anchor.z - Math.cos(r) * 24));
      if (h !== undefined && (!top || h > top.h)) top = { h, b };
    }
    return top ? { x: anchor.x, z: anchor.z, face: faceOf(top.b) } : undefined;
  }
  let best;
  for (let b = bearing - spread; b <= bearing + spread; b += 5) {
    const r = (b * Math.PI) / 180, dx = Math.sin(r), dz = -Math.cos(r);
    let prev;
    for (let s = min; s <= max; s += 1) {
      const x = Math.round(anchor.x + dx * s), z = Math.round(anchor.z + dz * s);
      const h = height(x, z);
      if (h === undefined) break;
      let hit = false;
      if (kind === "water") {
        const w = water(x, z);
        if (w !== undefined && w - h >= 1 && prev) hit = true;
      } else if (kind === "edge" && prev) {
        const ahead = [1, 2, 3].map((k) => height(Math.round(anchor.x + dx * (s + k)), Math.round(anchor.z + dz * (s + k))));
        if (ahead.every((a) => a !== undefined) && Math.min(...ahead) <= h - 8 && water(x, z) === undefined) hit = true;
      }
      if (hit) {
        const spot = kind === "water" ? prev : { x, z };
        if (!best || s < best.s) best = { ...spot, s, b };
        break;
      }
      if (water(x, z) === undefined) prev = { x, z };
      if (best && s >= best.s) break;
    }
  }
  if (!best) return undefined;
  return { x: best.x, z: best.z, face: faceOf(best.b) };
}

// How far round a piece's spot the ground is held loaded while it builds (index.js tickingarea): its whole box and
// the eased edge, never under 44 and never over 72 (a ticking area holds at most 100 chunks: 2 x 72 = 144 blocks a
// side is 10 chunks at worst). Crownhold's castle and the Cinder Roost's school are the big ones.
export const REACH_MAX = 72;
export function reachOf(d) {
  const b = d.box ?? { x0: 0, x1: 0, z0: 0, z1: 0 };
  return Math.min(REACH_MAX, Math.max(44, Math.max(-b.x0, b.x1, -b.z0, b.z1) + (d.ease ?? 3) + 3));
}

// The design to use for a piece: a plain id, or one id per facing ({ n, e, s, w }) for pieces that turn.
export function designFor(piece, face) {
  return typeof piece.d === "string" ? piece.d : piece.d[face ?? "n"];
}

