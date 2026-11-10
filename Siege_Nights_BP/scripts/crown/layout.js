// The Citadel's shape, worked out as plain numbers (no Minecraft in here).
//
// citadelPlan({ banner, keep, gate }) returns a list of small jobs, bottom layer first, that
// citadel.js carries out a few per tick so the fortress visibly rises:
//   { k: "found", x, z, base }                   fill the ground under a wall down to solid rock
//   { k: "fill", x, z, y1, y2, block, base }     one column piece. y is counted up from the Keep Banner's
//                                                level (base "banner": the walls) or the Cornerstone's (base "keep")
// `block` is a name from the palette in citadel.js ("stone", "air", "wool" ...).
//
// banner: { x, z } the Keep Banner.  keep: { x, z } the Citadel Cornerstone (middle of the Great Keep).
// gate: 0..3 = which way the gatehouse faces (+x, +z, -x, -z).

import { CROWN } from "./config.js";

export const GATE_DIRS = [{ x: 1, z: 0 }, { x: 0, z: 1 }, { x: -1, z: 0 }, { x: 0, z: -1 }];
export const GATE_NAMES = ["east", "south", "west", "north"];

const Y_MIN = -1; // one below the banner's level: floors replace the ground
const Y_MAX = 80;
const RISE = 4; // walls go up this many blocks at a time
const SOLID = new Set(["stone", "tile", "floor", "quartz", "gold"]);

export const KEEP_HALF = 12; // the Great Keep is 25 x 25
export const KEEP_TOP = 43;

// Which way the gate should face so it looks toward a spot (world spawn)
export function gateToward(banner, spot) {
  const dx = spot.x - banner.x, dz = spot.z - banner.z;
  if (Math.abs(dx) >= Math.abs(dz)) return dx >= 0 ? 0 : 2;
  return dz >= 0 ? 1 : 3;
}

// Where the throne and the Throne Seal stand (y counted up from the banner's level)
export function thronePlace(keep, gate) {
  const g = GATE_DIRS[gate];
  return {
    throne: { x: keep.x - g.x * 9, y: 1, z: keep.z - g.z * 9 },
    seal: { x: keep.x - g.x * 6, y: 1, z: keep.z - g.z * 6 },
    door: { x: keep.x + g.x * 15, y: 0, z: keep.z + g.z * 15 },
  };
}

// A spot on the road just outside the gate (where the banished are thrown)
export function outsideGate(banner, gate, extra = 8) {
  const g = GATE_DIRS[gate];
  const d = CROWN.citadelRadius + extra;
  return { x: banner.x + g.x * d, z: banner.z + g.z * d };
}

export function citadelPlan({ banner, keep, gate }) {
  const g = GATE_DIRS[gate];
  const p = { x: -g.z, z: g.x }; // sideways along the gate wall
  const cells = new Map(); // "x,z" -> { x, z, base, ys: [block names by height] }
  const founded = new Map(); // "x,z" -> base
  let base = "banner"; // which level heights are counted from: the banner's (walls) or the cornerstone's (keep)

  const put = (x, z, y1, y2, block) => {
    if (x === banner.x && z === banner.z) return; // never build over the Keep Banner
    const key = `${x},${z}`;
    let cell = cells.get(key);
    if (!cell) cells.set(key, (cell = { x, z, base, ys: [] }));
    for (let y = Math.max(y1, Y_MIN); y <= Math.min(y2, Y_MAX); y++) cell.ys[y - Y_MIN] = block;
  };
  const found = (x, z) => founded.set(`${x},${z}`, base);
  const merlon = (x, z) => ((x + z) & 1) === 0;

  // ---- Curtain wall: a ring 3 thick, 16 high with its battlements ----
  const R = CROWN.wallRadius;
  for (let dx = -R - 2; dx <= R + 2; dx++) {
    for (let dz = -R - 2; dz <= R + 2; dz++) {
      const d = Math.hypot(dx, dz);
      if (d < R - 1.5 || d >= R + 1.5) continue;
      const x = banner.x + dx, z = banner.z + dz;
      found(x, z);
      if (d >= R + 0.5) { // outer face carries the parapet
        put(x, z, 0, 14, "stone");
        if (merlon(x, z)) put(x, z, 15, 15, "battlement");
      } else {
        put(x, z, 0, 12, "stone"); // the wall walk
      }
    }
  }

  // ---- 8 round towers on the ring ----
  for (let k = 0; k < 8; k++) {
    const angle = (k + 0.5) * (Math.PI / 4);
    const tx = banner.x + Math.round(Math.cos(angle) * R), tz = banner.z + Math.round(Math.sin(angle) * R);
    for (let ox = -8; ox <= 8; ox++) {
      for (let oz = -8; oz <= 8; oz++) {
        const r = Math.hypot(ox, oz);
        const x = tx + ox, z = tz + oz;
        const d = Math.hypot(x - banner.x, z - banner.z);
        if (r <= 6.5) {
          found(x, z);
          if (r > 4.5) {
            put(x, z, 0, 25, "stone");
            if (d >= R - 1.5 && d < R + 0.5) put(x, z, 13, 15, "air"); // doorways where the wall walk passes through
            else if (r > 5.5 && d >= R + 1.5 && (x + z) % 3 === 0) put(x, z, 17, 17, "slit");
          } else {
            put(x, z, 0, 25, "air");
            put(x, z, 12, 12, "tile");
            put(x, z, 25, 25, "tile");
            if (ox === 0 && oz === 0) put(x, z, 13, 13, "brazier");
          }
        }
        // cone roof with a little overhang
        for (let i = 0; i <= 7; i++) if (r <= 7.5 - i) put(x, z, 26 + i, 26 + i, "tile");
        if (ox === 0 && oz === 0) put(x, z, 34, 34, "spire");
      }
    }
  }

  // ---- Gatehouse: a 7 wide, 9 high gate between two square towers ----
  const at = (origin, a, s) => ({ x: origin.x + g.x * a + p.x * s, z: origin.z + g.z * a + p.z * s });
  for (let s = -3; s <= 3; s++) {
    for (let a = R - 2; a <= R + 2; a++) {
      const { x, z } = at(banner, a, s);
      cells.delete(`${x},${z}`); // replaces whatever the ring put here
      founded.delete(`${x},${z}`);
      put(x, z, 0, 8, a === R ? "port" : "air");
      put(x, z, 9, 15, "stone");
      if ((a === R - 2 || a === R + 2) && merlon(x, z)) put(x, z, 16, 16, "battlement");
    }
  }
  for (const side of [-1, 1]) {
    for (let s = 4; s <= 12; s++) {
      for (let a = R - 4; a <= R + 4; a++) {
        const { x, z } = at(banner, a, s * side);
        cells.delete(`${x},${z}`);
        found(x, z);
        const edge = s === 4 || s === 12 || a === R - 4 || a === R + 4;
        if (edge) {
          put(x, z, 0, 21, "stone");
          if (merlon(x, z)) put(x, z, 22, 22, "battlement");
          if (a === R + 4 && s % 4 === 0 && s !== 4 && s !== 12) put(x, z, 14, 14, "slit");
        } else {
          put(x, z, 0, 21, "air");
          put(x, z, 12, 12, "tile");
          put(x, z, 21, 21, "tile");
          if (s === 8 && a === R) put(x, z, 22, 22, "brazier");
        }
      }
    }
    // long hangings in the ruler's color on the front of each gate tower
    for (let s = 7; s <= 9; s++) {
      const { x, z } = at(banner, R + 5, s * side);
      put(x, z, 8, 18, "wool");
    }
  }

  // ---- The Great Keep: 25 x 25, walls 44 high, corner turrets, a central spire ----
  base = "keep";
  const H = KEEP_HALF, TOP = KEEP_TOP;
  const FLOORS = [9, 18, 27, 36];
  for (let a = -H; a <= H; a++) {
    for (let s = -H; s <= H; s++) {
      const { x, z } = at(keep, a, s);
      const ring = Math.max(Math.abs(a), Math.abs(s));
      cells.delete(`${x},${z}`);
      if (ring >= H - 1) {
        found(x, z);
        put(x, z, 0, TOP, "stone");
        if (ring === H) {
          put(x, z, TOP + 1, TOP + 1, "stone");
          if (merlon(x, z)) put(x, z, TOP + 2, TOP + 2, "battlement");
        }
        // arrow slits on the upper floors: a slit in the outer skin, open behind it
        const along = Math.abs(a) >= H - 1 ? s : a;
        const corner = Math.abs(a) >= H - 1 && Math.abs(s) >= H - 1;
        if (!corner && Math.abs(along) <= 8 && along % 4 === 0) {
          for (const f of FLOORS) put(x, z, f + 3, f + 3, ring === H ? "slit" : "air");
        }
        // the door, facing the gate
        if (a >= H - 1 && Math.abs(s) <= 1) put(x, z, 0, 4, "air");
      } else {
        put(x, z, -1, -1, "floor");
        put(x, z, 0, TOP, "air");
        for (const f of FLOORS) put(x, z, f, f, "tile");
        put(x, z, TOP, TOP, "tile");
        if (Math.abs(a) === 9 && Math.abs(s) === 9) {
          put(x, z, 0, 0, "brazier");
          for (const f of FLOORS) put(x, z, f + 1, f + 1, "brazier");
        }
      }
    }
  }
  // throne room: carpet from the door to the dais, the dais and the throne
  for (let a = -6; a <= H - 2; a++) { const c = at(keep, a, 0); put(c.x, c.z, 0, 0, "carpet"); }
  for (let a = -10; a <= -7; a++) {
    for (let s = -3; s <= 3; s++) { const c = at(keep, a, s); put(c.x, c.z, 0, 0, Math.abs(s) === 3 || a === -7 ? "gold" : "quartz"); }
  }
  { const c = at(keep, -9, 0); put(c.x, c.z, 1, 1, "throne"); }
  // a ladder up through every floor to the roof
  { const c = at(keep, -10, 9); put(c.x, c.z, 0, TOP, "ladder"); }
  // hangings down every face of the keep
  for (const [da, ds] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    for (const t of [-7, -6, -5, 5, 6, 7]) {
      const c = da ? at(keep, da * (H + 1), t) : at(keep, t, ds * (H + 1));
      put(c.x, c.z, 14, 40, "wool");
    }
  }
  // corner turrets
  for (const ca of [-H, H]) {
    for (const cs of [-H, H]) {
      for (let oa = -5; oa <= 5; oa++) {
        for (let os = -5; os <= 5; os++) {
          const r = Math.hypot(oa, os);
          const { x, z } = at(keep, ca + oa, cs + os);
          if (r <= 3.5) { found(x, z); put(x, z, 0, 55, "stone"); }
          for (let i = 0; i <= 4; i++) if (r <= 4.5 - i) put(x, z, 56 + i, 56 + i, "tile");
          if (oa === 0 && os === 0) put(x, z, 61, 61, "spire");
        }
      }
    }
  }
  // the central spire, rising out of the roof
  for (let a = -7; a <= 7; a++) {
    for (let s = -7; s <= 7; s++) {
      const { x, z } = at(keep, a, s);
      const ring = Math.max(Math.abs(a), Math.abs(s));
      const r = Math.hypot(a, s);
      if (ring === 4) put(x, z, TOP + 1, 59, "stone");
      else if (ring < 4) put(x, z, TOP + 1, 59, "air");
      if (ring === 4 && (a === 0 || s === 0)) put(x, z, 52, 53, "slit");
      for (let i = 0; i <= 8; i++) if (r <= 6.5 - i * 0.7) put(x, z, 60 + i, 60 + i, "tile");
      if (a === 0 && s === 0) { put(x, z, 69, 74, "stone"); put(x, z, 75, 75, "spire"); }
    }
  }

  // ---- Turn the columns into jobs, lowest first ----
  const jobs = [];
  for (const [key, level] of founded) {
    if (!cells.has(key)) continue;
    const [x, z] = key.split(",").map(Number);
    jobs.push({ k: "found", x, z, y1: Y_MIN - 1, base: level });
  }
  for (const cell of cells.values()) {
    let start = 0;
    for (let i = 1; i <= cell.ys.length; i++) {
      const block = cell.ys[start];
      if (i < cell.ys.length && cell.ys[i] === block) continue;
      if (block !== undefined) {
        const y1 = start + Y_MIN, y2 = i - 1 + Y_MIN;
        if (SOLID.has(block)) {
          for (let y = y1; y <= y2; y = Math.floor(y / RISE) * RISE + RISE) {
            jobs.push({ k: "fill", x: cell.x, z: cell.z, y1: y, y2: Math.min(y2, Math.floor(y / RISE) * RISE + RISE - 1), block, base: cell.base });
          }
        } else {
          jobs.push({ k: "fill", x: cell.x, z: cell.z, y1, y2, block, base: cell.base });
        }
      }
      start = i;
    }
  }
  // lowest first; air before solid on the same level so cleared space never eats a fresh wall
  const order = (j) => j.y1 * 4 + (j.k === "found" ? 0 : j.block === "air" ? 1 : SOLID.has(j.block) ? 2 : 3);
  return jobs.map((j, i) => [order(j), i, j]).sort((A, B) => A[0] - B[0] || A[1] - B[1]).map((t) => t[2]);
}

// The jobs that carry the ruler's color (redone when the Crown changes hands)
export const colorJobs = (jobs) => jobs.filter((j) => j.block === "wool" || j.block === "carpet");

export function planSummary(jobs) {
  let blocks = 0, top = 0;
  for (const j of jobs) {
    if (j.k !== "fill" || j.block === "air") continue;
    blocks += j.y2 - j.y1 + 1;
    top = Math.max(top, j.y2);
  }
  return { jobs: jobs.length, blocks, top };
}
