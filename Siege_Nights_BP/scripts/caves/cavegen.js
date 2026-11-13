// The one cave generator, game side (Mateo 2026-11-13: one cave system for the world caves, the plot caves and the
// Rift). The base map's caves are made by map/caves.py; this is the same noise and the same rules in JS, for caves
// the game builds itself: the twelve plot caves (rebuilt each night, ore re-rolled) and later the Rift's rock.
// node tools/cave_parity.mjs checks the noise here against map/caves.py.
//
// Pure maths, no Minecraft imports, so Node, the self-tests and the 3D preview (tools/plotcave_preview.mjs) can run it.
//
//   plotCave(plotName, { region, groundY })  -> { air:Set, skin:Map, dress:Map, marks, box }   (one call, for Node)
//   plotCaveJob(plotName, opts)               -> generator: yields while it works, returns the same (for runJob)
//   rollOre(cave, oreSeed, budget, groundY)   -> Map("x,y,z" -> ore block): ore for one night, in the rock skin
//
// Coordinates are local: (0, 0, 0) is the top of the shaft at ground level, +y up, the cave lies below it.
// air: every block the cave keeps open (shaft included). skin: rock round the air, 3 blocks thick, block per cell
// (stone or deepslate by world height, the region's own rock for the walls of lush and dripstone rooms). dress: the
// cave's plants and stones (moss, glow berries, dripstone, glow lichen), written after the skin. The game adds its
// own fittings (shaft timbers and ladder, the miners' camp, the old king's sealed door) at the marks.

// ---------------------------------------------------------------- noise (matches map/caves.py)
const G = [[1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0], [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1], [1, 1, 0], [-1, 1, 0], [0, -1, 1], [0, -1, -1]];
const TWO32 = 4294967296;

function ghash(ix, iy, iz, seed) {
  let h = ix * 374761393 + iy * 668265263 + iz * 1440662683 + seed * 2654435761;
  h = ((h % TWO32) + TWO32) % TWO32;
  h = Math.imul((h ^ (h >>> 13)) >>> 0, 1274126177) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h & 15;
}
const q = (t) => t * t * t * (t * (t * 6 - 15) + 10);

/** Gradient (Perlin) noise at lattice-unit coordinates, about -1..1. Same as caves.py vnoise3. */
export function noise3(x, y, z, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = x - xi, fy = y - yi, fz = z - zi;
  const ux = q(fx), uy = q(fy), uz = q(fz);
  let out = 0;
  for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) for (let dz = 0; dz < 2; dz++) {
    const g = G[ghash(xi + dx, yi + dy, zi + dz, seed)];
    const dot = g[0] * (fx - dx) + g[1] * (fy - dy) + g[2] * (fz - dz);
    out += dot * (dx ? ux : 1 - ux) * (dy ? uy : 1 - uy) * (dz ? uz : 1 - uz);
  }
  return out;
}

export function fbm3(x, y, z, seed, octaves = 2) {
  let v = 0, amp = 1, tot = 0;
  for (let o = 0; o < octaves; o++) {
    v += noise3(x, y, z, seed + 101 * o) * amp; tot += amp; amp *= 0.5; x *= 2.03; y *= 2.03; z *= 2.03;
  }
  return v / tot;
}

export const seedOf = (text) => [...String(text)].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0, 2166136261) % 1000003;

function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / TWO32; };
}

// ---------------------------------------------------------------- the plot caves
// Mateo 2026-11-13: "i want the cave big, explorable. part of the story". A shaft 27 deep from the plot, then a run of
// cheese-cave halls with stone pillars (the same caverns as the world's), joined by spaghetti tunnels, over two or
// three levels, about 70 blocks across. Every pocket is joined to the shaft, so all of it can be walked.
export const SHAFT_DEPTH = 27;
export const PLOT_CAVE = { reach: 34, top: -14, bottom: -58, step: 4 };
const REGION_STYLE = {
  vale: "lush", blackfen: "lush", emberwaste: "dripstone", saltreach: "dripstone", frostmarch: "dripstone",
};

const key = (x, y, z) => `${x},${y},${z}`;
const unkey = (k) => k.split(",").map(Number);
const N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

export function* plotCaveJob(plotName, { region = "vale", groundY = 70 } = {}) {
  const seed = seedOf(plotName);
  const r = rng(seed * 7 + 1);
  const { reach, top, bottom, step } = PLOT_CAVE;
  const turn = r() * Math.PI * 2;                                     // which way the cave runs from the shaft
  const cx = Math.cos(turn) * 16, cz = Math.sin(turn) * 16, cy = (top + bottom) / 2 - 2;   // the cave's middle
  const rx = reach, ry = (top - bottom) / 2;
  const foot = { x: 0, y: -SHAFT_DEPTH, z: 0 };
  // noise on a coarse grid (every 4 blocks), blended to every block: the same fields as the world's caves
  const x0 = Math.floor((cx - rx - 8) / step) * step, x1 = Math.ceil((cx + rx + 8) / step) * step;
  const z0 = Math.floor((cz - rx - 8) / step) * step, z1 = Math.ceil((cz + rx + 8) / step) * step;
  const y0 = Math.floor((bottom - 4) / step) * step, y1 = Math.ceil((top + 4) / step) * step;
  const nx = (x1 - x0) / step + 1, ny = (y1 - y0) / step + 1, nz = (z1 - z0) / step + 1;
  const ch = new Float32Array(nx * ny * nz), sa = new Float32Array(nx * ny * nz), sb = new Float32Array(nx * ny * nz);
  const ox = seed % 9973, oz = (seed >> 7) % 9973;                    // each plot reads its own stretch of the noise
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) {
      const X = x0 + i * step + ox * 64, Y = y0 + j * step, Z = z0 + k * step + oz * 64, n = (i * ny + j) * nz + k;
      ch[n] = fbm3(X / 40, Y / 26, Z / 40, 4243, 3);
      sa[n] = fbm3(X / 36, Y / 27, Z / 36, 4244, 2); sb[n] = fbm3(X / 36, Y / 27, Z / 36, 4245, 2);
    }
    yield;
  }
  const lerp3 = (A, x, y, z) => {
    const fx = (x - x0) / step, fy = (y - y0) / step, fz = (z - z0) / step;
    const i = Math.min(nx - 2, Math.floor(fx)), j = Math.min(ny - 2, Math.floor(fy)), k = Math.min(nz - 2, Math.floor(fz));
    const tx = fx - i, ty = fy - j, tz = fz - k;
    let v = 0;
    for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 2; c++)
      v += A[((i + a) * ny + j + b) * nz + k + c] * (a ? tx : 1 - tx) * (b ? ty : 1 - ty) * (c ? tz : 1 - tz);
    return v;
  };
  // air: caverns where the cheese noise beats a threshold that rises towards the edge of an egg round the middle,
  // and tunnels where both spaghetti noises are near zero
  const air = new Set();
  for (let x = x0; x <= x1; x++) {
    for (let z = z0; z <= z1; z++) {
      for (let y = bottom; y <= top; y++) {
        const e = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rx) ** 2;
        if (e > 1.7) continue;
        const shell = Math.max(0, e - 0.25);
        const hall = lerp3(ch, x, y, z) > -0.02 + shell * 0.55 + (y > top - 4 ? 0.2 : 0);
        const tube = e < 1.5 && Math.max(Math.abs(lerp3(sa, x, y, z)), Math.abs(lerp3(sb, x, y, z))) < 0.06 * (1 - e / 1.6);
        if (hall || tube) air.add(key(x, y, z));
      }
    }
    if (x % 4 === 0) yield;
  }
  // the shaft (3 x 3, ground block kept as the collar) and a landing room at its foot
  for (let y = -1; y >= -SHAFT_DEPTH; y--) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) air.add(key(dx, y, dz));
  ball(air, foot.x, foot.y - 1, foot.z, 4.5, 3);
  yield;
  // join every pocket to the shaft: tunnels from each big pocket to the nearest reached cell; specks are filled in
  for (let pass = 0; pass < 12; pass++) {
    const reached = flood(air, key(foot.x, foot.y, foot.z));
    const rest = [...air].filter((k) => !reached.has(k));
    if (!rest.length) break;
    const seen = new Set();
    let joined = 0;
    for (const k0 of rest) {
      if (seen.has(k0)) continue;
      const comp = flood(air, k0, seen);
      if (comp.size < 40) { for (const k of comp) air.delete(k); continue; }
      const [ax, ay, az] = unkey([...comp][Math.floor(comp.size / 2)]);
      let best = null, bd = 1e9;
      for (const k of reached) {
        const [bx, by, bz] = unkey(k); const d = (ax - bx) ** 2 + (ay - by) ** 2 * 2 + (az - bz) ** 2;
        if (d < bd) { bd = d; best = [bx, by, bz]; }
      }
      tunnel(air, [ax, ay, az], best, r);
      joined++;
    }
    yield;
    if (!joined) break;
  }
  // marks: the miners' camp a few blocks off the shaft foot, the deep spot (sealed door) at the far end
  const dist = bfs(air, key(foot.x, foot.y, foot.z));
  const floorOf = (k) => { const [x, y, z] = unkey(k); return !air.has(key(x, y - 1, z)) && air.has(key(x, y + 1, z)) && air.has(key(x, y + 2, z)); };
  let camp = null, deep = null, far = -1;
  for (const [k, d] of dist) {
    if (!floorOf(k)) continue;
    const [x, y, z] = unkey(k);
    if (!camp && d >= 7 && d <= 12 && Math.abs(x) > 2 && Math.abs(z) > 2) camp = { x, y, z };
    if (d > far && y < cy) { far = d; deep = { x, y, z }; }
  }
  camp ??= { x: foot.x + 3, y: foot.y - 3, z: foot.z };
  // rock skin and dressing
  const deepslateAt = (y) => groundY + y < 0;
  const style = REGION_STYLE[region] ?? "plain";
  const skin = new Map();
  let frontier = [...air];
  for (let layer = 1; layer <= 3; layer++) {
    const next = [];
    for (const k of frontier) {
      const [x, y, z] = unkey(k);
      for (const [dx, dy, dz] of N6) {
        const kk = key(x + dx, y + dy, z + dz);
        if (air.has(kk) || skin.has(kk)) continue;
        if (y + dy >= -3 && !(Math.abs(x + dx) <= 2 && Math.abs(z + dz) <= 2)) continue;  // leave the plot's top soil alone
        skin.set(kk, deepslateAt(y + dy) ? "minecraft:deepslate" : "minecraft:stone"); next.push(kk);
      }
    }
    frontier = next;
    if (layer === 1) yield;
  }
  const dress = new Map();
  const dr = rng(seed * 13 + 5);
  const zone = (x, z) => noise3((x + ox * 64) / 30, 0.5, (z + oz * 64) / 30, 4260) > -0.15;     // most of the cave
  for (const k of air) {
    const [x, y, z] = unkey(k);
    if (y > -SHAFT_DEPTH + 1 && Math.abs(x) <= 1 && Math.abs(z) <= 1) continue;    // the shaft stays clear
    const below = key(x, y - 1, z), above = key(x, y + 1, z);
    const isFloor = skin.has(below), isCeil = skin.has(above);
    if (!isFloor && !isCeil) continue;
    const z_ = zone(x, z), p = dr();
    if (style === "lush" && z_) {
      if (isFloor) { skin.set(below, "minecraft:moss_block"); if (p < 0.3) dress.set(k, "minecraft:moss_carpet"); else if (p < 0.34) dress.set(k, "minecraft:azalea"); else if (p < 0.37) dress.set(k, "minecraft:flowering_azalea"); }
      if (isCeil) {
        if (dr() < 0.55) skin.set(above, "minecraft:moss_block");
        if (p < 0.14) hang(air, dress, x, y, z, 1 + Math.floor(dr() * 4), (i, n) => i === n - 1 ? (dr() < 0.4 ? "minecraft:cave_vines_head_with_berries" : "minecraft:cave_vines") : (dr() < 0.25 ? "minecraft:cave_vines_body_with_berries" : "minecraft:cave_vines"), -1);
        else if (p > 0.993) dress.set(k, "minecraft:spore_blossom");
      }
    } else if (style === "dripstone" && z_) {
      if (isFloor && dr() < 0.7) skin.set(below, "minecraft:dripstone_block");
      if (isCeil && dr() < 0.7) skin.set(above, "minecraft:dripstone_block");
      if (isCeil && p < 0.09) hang(air, dress, x, y, z, 1 + Math.floor(dr() * 4), dripName(true), -1);
      else if (isFloor && p > 0.94) hang(air, dress, x, y, z, 1 + Math.floor(dr() * 3), dripName(false), 1);
    } else if (p < 0.012) dress.set(k, isFloor ? "minecraft:glow_lichen:down" : "minecraft:glow_lichen:up");
  }
  for (const k of [key(camp.x, camp.y, camp.z), deep && key(deep.x, deep.y, deep.z)]) if (k) dress.delete(k);
  let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (const k of skin.keys()) { const p = unkey(k); mn = mn.map((v, i) => Math.min(v, p[i])); mx = mx.map((v, i) => Math.max(v, p[i])); }
  return {
    air, skin, dress, style,
    marks: { shaft: { x: 0, y: 0, z: 0 }, foot, camp, story: camp, deep, seal: deep, turn },
    box: { min: { x: mn[0], y: mn[1], z: mn[2] }, max: { x: mx[0], y: mx[1], z: mx[2] } },
  };
}

export function plotCave(plotName, opts) {
  const it = plotCaveJob(plotName, opts);
  for (;;) { const s = it.next(); if (s.done) return s.value; }
}

// ore for one night: veins in the rock skin, mostly where a face shows. budget: { "iron": 12, "coal": 20, ... }
export const ORE_BLOCK = { coal: "coal_ore", iron: "iron_ore", copper: "copper_ore", gold: "gold_ore", redstone: "redstone_ore",
  lapis: "lapis_ore", diamond: "diamond_ore", emerald: "emerald_ore" };
export function rollOre(cave, oreSeed, budget, groundY = 70) {
  const r = rng(seedOf(String(oreSeed)) * 31 + 7);
  const faces = [], hidden = [];
  for (const [k, b] of cave.skin) {
    if (b !== "minecraft:stone" && b !== "minecraft:deepslate") continue;
    const [x, y, z] = unkey(k);
    if (Math.abs(x) <= 2 && Math.abs(z) <= 2 && y > -SHAFT_DEPTH) continue;      // never in the shaft walls
    (N6.some(([dx, dy, dz]) => cave.air.has(key(x + dx, y + dy, z + dz))) ? faces : hidden).push(k);
  }
  const out = new Map();
  for (const [kind, count] of Object.entries(budget)) {
    let left = count;
    for (let tries = 0; left > 0 && tries < count * 8; tries++) {
      const pool = r() < 0.75 ? faces : hidden;
      if (!pool.length) break;
      const [x, y, z] = unkey(pool[Math.floor(r() * pool.length)]);
      const size = Math.min(left, 1 + Math.floor(r() * (kind === "diamond" ? 3 : 6)));
      let cells = [[x, y, z]];
      for (let s = 1; s < size; s++) { const [a, b, c] = cells[Math.floor(r() * cells.length)]; const [dx, dy, dz] = N6[Math.floor(r() * 6)]; cells.push([a + dx, b + dy, c + dz]); }
      for (const [a, b, c] of cells) {
        const kk = key(a, b, c);
        if (!cave.skin.has(kk) || out.has(kk) || left <= 0) continue;
        out.set(kk, "minecraft:" + (groundY + b < 0 ? "deepslate_" : "") + ORE_BLOCK[kind]); left--;
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------- helpers
function ball(air, x, y, z, r, ry = r) {
  for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++)
    for (let dz = -Math.ceil(r); dz <= Math.ceil(r); dz++)
      if ((dx * dx + dz * dz) / (r * r) + (dy * dy) / (ry * ry) <= 1) air.add(key(Math.round(x) + dx, Math.round(y) + dy, Math.round(z) + dz));
}
function tunnel(air, a, b, r) {
  const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])));
  const wob = r() * 6.283;
  for (let s = 0; s <= n; s++) {
    const t = s / n, w = Math.sin(t * Math.PI) * 3;
    ball(air, a[0] + (b[0] - a[0]) * t + Math.cos(wob) * w, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t + Math.sin(wob) * w, 1.9, 1.6);
  }
}
function flood(air, start, seen = new Set()) {
  const out = new Set([start]); seen.add(start);
  const todo = [start];
  while (todo.length) {
    const [x, y, z] = unkey(todo.pop());
    for (const [dx, dy, dz] of N6) {
      const k = key(x + dx, y + dy, z + dz);
      if (air.has(k) && !out.has(k)) { out.add(k); seen.add(k); todo.push(k); }
    }
  }
  return out;
}
function bfs(air, start) {
  const d = new Map([[start, 0]]); let todo = [start];
  while (todo.length) {
    const next = [];
    for (const k of todo) {
      const [x, y, z] = unkey(k), dk = d.get(k);
      for (const [dx, dy, dz] of N6) { const kk = key(x + dx, y + dy, z + dz); if (air.has(kk) && !d.has(kk)) { d.set(kk, dk + 1); next.push(kk); } }
    }
    todo = next;
  }
  return d;
}
function hang(air, dress, x, y, z, want, nameFn, dir) {
  let n = 0;
  while (n < want && air.has(key(x, y + dir * n, z)) && !dress.has(key(x, y + dir * n, z))) n++;
  for (let i = 0; i < n; i++) dress.set(key(x, y + dir * i, z), nameFn(i, n));
}
function dripName(hanging) {
  return (i, n) => {
    const left = n - 1 - i;
    const t = left === 0 ? "tip" : left === 1 ? "frustum" : i === 0 ? "base" : "middle";
    return `minecraft:pointed_dripstone:${t}:${hanging ? "h" : "u"}`;
  };
}
