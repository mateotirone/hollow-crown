// Train track: shapes, how pieces connect, and walking a train along them.
// Plain data and maths (no Minecraft imports), so it loads in Node tests.
//
// A Track block has two states: siege:kind (straight, bend, corner, slope) and siege:dir. Together
// they give the piece's two "links": the directions it connects to. Directions go round the compass:
//   0 N, 1 NE, 2 E, 3 SE, 4 S, 5 SW, 6 W, 7 NW        (Minecraft: north is -z, east is +x)
// Track can run north-south, east-west and diagonally. A bend turns 45 degrees, a corner 90 degrees
// (tight, trains slow down for it), and a slope climbs one block towards its "up" direction.

export const DX = [0, 1, 1, 1, 0, -1, -1, -1];
export const DZ = [-1, -1, 0, 1, 1, 1, 0, -1];
export const DIR_NAMES = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
export const opp = (d) => (d + 4) % 8;
export const isDiag = (d) => d % 2 === 1;
export const half = (d) => (isDiag(d) ? Math.SQRT1_2 : 0.5); // centre of a block to the edge (or corner) it leaves by

export const RAIL_TOP = 0.25; // height of the rail tops above the block's floor (wheels sit here)

export const KINDS = ["straight", "bend", "corner", "slope"];

// Every piece: { kind, dir, links: [a, b], up? } (a slope's links are [low end, high end])
export const SHAPES = [];
for (let d = 0; d < 4; d++) SHAPES.push({ kind: 0, dir: d, links: [d, d + 4] });
[0, 2, 4, 6].forEach((d, i) => {
  SHAPES.push({ kind: 1, dir: i * 2, links: [d, (d + 3) % 8] }); // straight on, then turn one way...
  SHAPES.push({ kind: 1, dir: i * 2 + 1, links: [d, (d + 5) % 8] }); // ...or the other
});
[0, 2, 4, 6].forEach((d, i) => SHAPES.push({ kind: 2, dir: i, links: [d, (d + 2) % 8] }));
[0, 2, 4, 6].forEach((d, i) => SHAPES.push({ kind: 3, dir: i, links: [opp(d), d], up: d }));

export const shapeOf = (kind, dir) => SHAPES.find((s) => s.kind === kind && s.dir === dir);
export const hasLink = (shape, d) => shape.links[0] === d || shape.links[1] === d;
export const otherLink = (shape, d) => (shape.links[0] === d ? shape.links[1] : shape.links[0]);

// The flat piece joining two directions, if there is one
export function flatShapeFor(a, b) {
  return SHAPES.find((s) => s.kind !== 3 && hasLink(s, a) && hasLink(s, b) && a !== b);
}
export const slopeShapeFor = (up) => SHAPES.find((s) => s.kind === 3 && s.up === up);

// How sharp a piece is: trains must slow down for corners
export const SPEED_LIMIT = { 0: Infinity, 1: Infinity, 2: 0.28, 3: Infinity };

const key = (p) => `${p.x},${p.y},${p.z}`;

// get(x, y, z) returns the shape of the Track at that spot, or undefined.
// Leaving `pos` (whose piece is `shape`) by link `d`, where is the next piece, and does it link back?
export function follow(pos, shape, d, get) {
  const x = pos.x + DX[d], z = pos.z + DZ[d];
  const y = pos.y + (shape.up === d ? 1 : 0);
  const there = get(x, y, z);
  if (there && hasLink(there, opp(d)) && !(there.kind === 3 && there.up === opp(d))) return { x, y, z, shape: there };
  if (!isDiag(d)) {
    const below = get(x, y - 1, z); // a slope going down away from us: its high end meets our edge
    if (below && below.kind === 3 && below.up === opp(d)) return { x, y: y - 1, z, shape: below };
  }
  return undefined;
}

// ---------- A cursor is a spot on the track: a block, which way we're going through it, and how far in ----------
// { x, y, z, from, to, t }: entered by link `from`, leaving by link `to`, t blocks from the entry edge

export const blockLength = (c) => half(c.from) + half(c.to);
export const flip = (c) => ({ ...c, from: c.to, to: c.from, t: blockLength(c) - c.t });

// The middle of the track through a bend or corner, from link a's edge to link b's edge, in blocks from the block
// centre: a circular arc (plus a short straight into a diagonal corner). Same maths as centreline() in
// studio/build_trains.py, which draws the rails, so the wheels stay on them.
const curves = new Map();
export function curvePoints(a, b, n = 12) {
  const k = `${a},${b}`;
  if (curves.has(k)) return curves.get(k);
  const na = Math.hypot(DX[a], DZ[a]), nb = Math.hypot(DX[b], DZ[b]);
  const ua = [DX[a] / na, DZ[a] / na], ub = [DX[b] / nb, DZ[b] / nb];
  const A = [DX[a] * 0.5, DZ[a] * 0.5], B = [DX[b] * 0.5, DZ[b] * 0.5];
  const turn = Math.PI - Math.acos(Math.max(-1, Math.min(1, ua[0] * ub[0] + ua[1] * ub[1])));
  const L = 0.5, r = L / Math.tan(turn / 2);
  const bl = Math.hypot(ua[0] + ub[0], ua[1] + ub[1]), dist = Math.hypot(L, r);
  const C = [((ua[0] + ub[0]) / bl) * dist, ((ua[1] + ub[1]) / bl) * dist];
  const a0 = Math.atan2(ua[1] * L - C[1], ua[0] * L - C[0]), a1 = Math.atan2(ub[1] * L - C[1], ub[0] * L - C[0]);
  const da = ((a1 - a0 + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
  const pts = isDiag(a) ? [A] : [];
  for (let i = 0; i <= n; i++) pts.push([C[0] + r * Math.cos(a0 + (da * i) / n), C[1] + r * Math.sin(a0 + (da * i) / n)]);
  if (isDiag(b)) pts.push(B);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const out = { pts, cum, total: cum[cum.length - 1] };
  curves.set(k, out);
  return out;
}

// The world position of a cursor (wheels on the rail tops)
export function pointAt(c, shape) {
  const cx = c.x + 0.5, cz = c.z + 0.5;
  const hf = half(c.from), ht = half(c.to);
  let x, z; // s = 0 at the entry edge, 1 at the exit edge
  const s = Math.max(0, Math.min(1, c.t / (hf + ht)));
  if (shape && (shape.kind === 1 || shape.kind === 2)) {
    const curve = curvePoints(c.from, c.to);
    const want = s * curve.total;
    let i = 1;
    while (i < curve.pts.length - 1 && curve.cum[i] < want) i++;
    const seg = curve.cum[i] - curve.cum[i - 1] || 1, k = (want - curve.cum[i - 1]) / seg;
    const p0 = curve.pts[i - 1], p1 = curve.pts[i];
    x = cx + p0[0] + (p1[0] - p0[0]) * k;
    z = cz + p0[1] + (p1[1] - p0[1]) * k;
  } else if (c.t <= hf) {
    const k = 1 - c.t / hf; // 1 at the entry edge, 0 at the centre
    x = cx + DX[c.from] * 0.5 * k;
    z = cz + DZ[c.from] * 0.5 * k;
  } else {
    const k = (c.t - hf) / ht;
    x = cx + DX[c.to] * 0.5 * k;
    z = cz + DZ[c.to] * 0.5 * k;
  }
  let y = c.y + RAIL_TOP;
  if (shape?.kind === 3) y += shape.up === c.to ? s : 1 - s;
  return { x, y, z };
}

// Move a cursor `dist` blocks forward along the track. Stops at the end of the line.
// Returns { cursor, moved, blocked }.
export function advance(c, dist, get) {
  let cur = { ...c };
  let left = dist, moved = 0;
  let shape = get(cur.x, cur.y, cur.z);
  if (!shape) return { cursor: cur, moved: 0, blocked: true };
  for (let guard = 0; guard < 4096; guard++) {
    const len = blockLength(cur);
    if (cur.t + left <= len) {
      cur.t += left;
      return { cursor: cur, moved: moved + left, blocked: false };
    }
    const next = follow(cur, shape, cur.to, get);
    if (!next) {
      moved += len - cur.t;
      cur.t = len;
      return { cursor: cur, moved, blocked: true };
    }
    left -= len - cur.t;
    moved += len - cur.t;
    const from = opp(cur.to);
    cur = { x: next.x, y: next.y, z: next.z, from, to: otherLink(next.shape, from), t: 0 };
    shape = next.shape;
  }
  return { cursor: cur, moved, blocked: true };
}

export function back(c, dist, get) {
  const r = advance(flip(c), dist, get);
  return { ...r, cursor: flip(r.cursor) };
}

// A cursor on a piece, pointing whichever way is closest to `yaw` (degrees, Minecraft: 0 = south, 90 = west)
export function cursorOn(pos, shape, yaw) {
  const fx = -Math.sin((yaw * Math.PI) / 180), fz = Math.cos((yaw * Math.PI) / 180);
  const [a, b] = shape.links;
  const toward = (d) => DX[d] * fx + DZ[d] * fz;
  const to = toward(b) >= toward(a) ? b : a;
  const c = { x: pos.x, y: pos.y, z: pos.z, from: otherLink(shape, to), to, t: 0 };
  c.t = blockLength(c) / 2;
  return c;
}

// Minecraft yaw (degrees) of something pointing from `a` to `b`
export const yawOf = (a, b) => (Math.atan2(-(b.x - a.x), b.z - a.z) * 180) / Math.PI;

// ---------- Laying track: which way does a new piece point, and which neighbours turn to meet it? ----------

// Is link d of the piece at pos joined to anything?
export const joined = (pos, shape, d, get) => !!follow(pos, shape, d, get);

// Placing a Track at pos. Returns { shape, updates: [{ x, y, z, shape }] }.
export function layTrack(pos, yaw, get) {
  const candidates = [];
  for (let d = 0; d < 8; d++) {
    const levels = isDiag(d) ? [0] : [0, 1, -1];
    for (const dy of levels) {
      const n = { x: pos.x + DX[d], y: pos.y + dy, z: pos.z + DZ[d] };
      const ns = get(n.x, n.y, n.z);
      if (!ns) continue;
      const back = opp(d);
      let newShape;
      if (dy === -1) {
        // it's lower: it becomes a slope climbing to us, if it can keep running straight away from us
        if (ns.kind === 3 && ns.up === back) newShape = ns;
        else if (ns.kind !== 3 && (!hasLink(ns, d) || hasLink(ns, d)) && freeFor(n, ns, d, get)) newShape = slopeShapeFor(back);
      } else if (hasLink(ns, back) && !(ns.kind === 3 && ns.up === back && dy === 0) && !(ns.kind === 3 && dy === 1)) {
        newShape = ns; // already points at us
      } else if (ns.kind !== 3) {
        const keep = ns.links.find((l) => joined(n, ns, l, get));
        const other = ns.links.filter((l) => joined(n, ns, l, get));
        if (other.length < 2) newShape = keep === undefined ? flatShapeFor(back, d) : flatShapeFor(back, keep);
      }
      if (newShape) candidates.push({ d, dy, n, newShape, already: newShape === ns });
    }
  }
  // Pick the best pair: both already pointing at us, then straight, then a bend, then a corner
  const turn = (a, b) => Math.min((a - b + 8) % 8, (b - a + 8) % 8); // 4 = straight, 3 = bend, 2 = corner
  let best, bestScore = -Infinity;
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const p = candidates[i], q = candidates[j];
      if (p.d === q.d) continue;
      const tn = turn(p.d, q.d);
      if (tn < 2 || (tn === 2 && (isDiag(p.d) || isDiag(q.d)))) continue;
      if ((p.dy === 1 || q.dy === 1) && tn !== 4) continue;
      if (p.dy === 1 && q.dy === 1) continue;
      const score = (p.already ? 10 : 0) + (q.already ? 10 : 0) + tn * 3 - (p.dy !== 0 || q.dy !== 0 ? 1 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = [p, q];
      }
    }
  }
  if (!best && candidates.length) {
    best = [candidates.sort((a, b) => (b.already ? 1 : 0) - (a.already ? 1 : 0))[0]];
  }
  const chosen = best ?? [];
  let shape;
  const up = chosen.find((c) => c.dy === 1);
  if (up) shape = slopeShapeFor(up.d);
  else if (chosen.length === 2) shape = flatShapeFor(chosen[0].d, chosen[1].d);
  else if (chosen.length === 1) shape = flatShapeFor(chosen[0].d, opp(chosen[0].d));
  else {
    const d8 = ((Math.round(((yaw + 180) % 360) / 45) % 8) + 8) % 8; // yaw 180 = facing north = 0
    shape = flatShapeFor(d8, opp(d8));
  }
  const updates = chosen.filter((c) => !c.already).map((c) => ({ ...c.n, shape: c.newShape }));
  return { shape, updates };
}

// Can the piece at n (lower than us) turn into a slope up to us? Only if nothing else joins it, or it
// already continues straight away from us.
function freeFor(n, ns, d, get) {
  const linked = ns.links.filter((l) => joined(n, ns, l, get));
  return linked.length === 0 || (linked.length === 1 && linked[0] === d);
}

export const trackKey = key;

// A switch: one block where two lines part, holding one of its shapes at a time. Which shape a train entering by
// link `entry` needs: the current one if it leads on from there, else the first other shape that does (a train
// coming off a branch sets the switch for itself; at a crossing of two straights each train picks its own), else -1.
export function switchSetting(shapes, current, entry) {
  if (shapes[current] && hasLink(shapes[current], entry)) return current;
  return shapes.findIndex((s) => hasLink(s, entry));
}
