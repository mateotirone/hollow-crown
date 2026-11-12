// Land shaping for the seven thin places (Mateo 2026-11-12: "it's designing the actual map itself").
// Run by map/genworld.py through land.py and shape_cli.mjs, so the map is made with the land Mateo approved in 3D.
// Everything is in the site's LOCAL frame: u to the right of the mouth, v out of the mouth (the cave runs to -v).
// shapeSite(id, real, keep) (keep(u, v): 0..1, how much of the real land must stay, for roads, trails and rivers) returns:
//   h(u, v)       the shaped ground height (top solid block)
//   water(u, v)   the water surface y over that column, or undefined
//   top(u, y, v, h, slope)  the block for a solid cell at height y in a column whose top is h
//   floor         the ground height outside the cave mouth (the planner's G). Any water beside the mouth lies at
//                 or under it, so the cave never floods: no dry ground may sit lower than the water next to it.
//   extras        [[u, y, v, block], ...] natural set pieces (stones, trees, spires, roots, spoil, ice)
import { hash, fbm } from "../../Siege_Nights_BP/scripts/undertow/noise.js";

const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const lerp = (a, b, t) => a + (b - a) * t;
const R0 = 62, R1 = 96; // fully shaped inside R0, blended back to the real map by R1
export const blend = (u, v) => 1 - smooth((Math.hypot(u, v * 0.9) - R0) / (R1 - R0));
const pick = (list, a, b, s) => list[Math.floor(hash(a, b, s) * list.length) % list.length];

// a curved cliff line across the front of the cave: v of the face at u
const cliffAt = (u, bend = 0.03, at = 2) => at + bend * u * u;

export function shapeSite(id, real, keep = () => 0) {
  const extras = [];
  const add = (u, y, v, b) => extras.push([u, y, v, b]);
  const base = real(0, 12);
  let S;
  if (id === "sunken_quarry") S = quarry(real, add);
  else if (id === "drowned_chapel") S = chapel(real, add);
  else if (id === "bellfounders_mine") S = mine(real, add);
  else if (id === "frostvein_hollow") S = gap(real, add);
  else if (id === "witchroot_caves") S = witchroot(real, add);
  else if (id === "saltglass_grotto") S = saltglass(real, add);
  else S = barrow(real, add);
  const mix = (u, v) => blend(u, v) * (1 - keep(u, v));
  const hFinal = (u, v) => Math.round(lerp(real(u, v), S.h(u, v), mix(u, v)));
  return { ...S, h: hFinal, mix, extras };
}

// ---------- the Sunken Quarry: a stepped pit 61 x 45, 22 deep, flooded at the far end ----------
function quarry(real, add) {
  const rim = real(0, 24), depth = 22, floor = rim - depth;
  const U = 30, V0 = 2, V1 = 46;
  const inside = (u, v) => Math.min(u + U, U - u, v - V0, V1 - v); // distance in from the pit edge
  const ramp = (u, v) => u >= -U + 1 && u <= -U + 4 && v >= 8 && v <= V1 - 1; // a road down the west wall
  const h = (u, v) => {
    const d = inside(u, v), r = real(u, v);
    if (d < 0) return Math.max(r, rim + Math.round((fbm(u * 0.05, v * 0.05, 71) - 0.5) * 3)); // the rim country, a touch raised
    if (v < V0 + 3 && Math.abs(u) <= 9) return floor; // the cave face: one sheer wall at the bottom of the north side
    if (ramp(u, v)) return Math.round(lerp(floor, rim - 1, (v - 8) / (V1 - 9)));
    if (v >= 8 && v <= 11 && u > -U + 4 && u <= 3) return floor; // the haul road: a level cut across the benches from the foot of the ramp to the way into the cave
    if (v > 24 && d >= 6) return floor - 3 - (hash(u, v, 72) < 0.3 ? 1 : 0); // the far end was cut deeper, and that is what flooded
    const step = Math.min(depth, Math.floor(d / 3) * 4 + (hash(Math.floor(u / 5), Math.floor(v / 5), 73) < 0.25 ? 1 : 0));
    return rim - step;
  };
  const water = (u, v) => (inside(u, v) >= 0 && h(u, v) < floor - 1 ? floor - 1 : undefined); // a block under the dry floor, so it stays put
  const beds = ["red_sandstone", "terracotta", "orange_terracotta", "white_terracotta", "red_sandstone", "brown_terracotta"];
  const top = (u, y, v, hh, slope) => {
    if (inside(u, v) < 0) return y === hh ? (hash(u, v, 75) < 0.85 ? "red_sand" : "coarse_dirt") : beds[Math.abs(Math.floor(y / 2)) % beds.length];
    if (ramp(u, v) && y === hh) return "coarse_dirt";
    if (y === hh && slope <= 1) return hash(u, v, 77) < 0.5 ? "smooth_red_sandstone" : "cut_red_sandstone";
    return beds[Math.abs(Math.floor(y / 2)) % beds.length];
  };
  // cut blocks stacked on the benches and the floor, a broken crane frame on the rim, chains down to the water
  for (let i = 0; i < 26; i++) {
    const u = Math.round((hash(i, 1, 79) - 0.5) * 50), v = 6 + Math.round(hash(i, 2, 79) * 38);
    if (inside(u, v) < 2 || ramp(u, v) || (Math.abs(u) <= 4 && v < 16)) continue;
    const y = h(u, v), w = water(u, v);
    if (w !== undefined) continue;
    const n = 1 + Math.floor(hash(i, 3, 79) * 3);
    for (let k = 0; k < n; k++) add(u, y + 1 + k, v, k % 2 ? "smooth_red_sandstone" : "cut_red_sandstone");
    if (hash(i, 4, 79) < 0.5) add(u + 1, y + 1, v, "cut_red_sandstone");
  }
  const cu = 18, cv = V1 + 3, cy = real(cu, cv);
  for (let y = 1; y <= 12; y++) add(cu, cy + y, cv, "dark_oak_log");
  for (let k = 1; k <= 9; k++) add(cu, cy + 12, cv - k, "dark_oak_log"); // the jib reaching out over the pit
  for (let y = cy + 11; y >= floor + 3; y--) add(cu, y, cv - 9, "dark_oak_fence");
  for (let y = 1; y <= 4; y++) add(cu - 1, cy + y + 7, cv - y, "dark_oak_fence");
  return { h, water, top, floor };
}

// ---------- the Drowned Chapel: a chalk headland over the sea, a flooded sinkhole, a cliff stair ----------
function chapel(real, add) {
  const sea = 62, topY = Math.max(real(0, -20), 97), floor = 64;
  const sink = { u: -17, v: -6, r: 8 };
  const cliff = (u) => cliffAt(u, 0.012, 4) + (fbm(u * 0.12, 3, 81) - 0.5) * 5 + (Math.abs(u) > 10 ? (fbm(u * 0.35, 5, 82) - 0.5) * 6 : 0);
  const inSink = (u, v) => Math.hypot(u - sink.u, (v - sink.v) * 1.1) < sink.r + (fbm(u * 0.3, v * 0.3, 83) - 0.5) * 2;
  const inlet = (u, v) => Math.abs(u - sink.u) <= 3 && v > sink.v;
  // the shore at the cliff foot: a ragged shelf of chalk rock and shingle, its edge wandering in and out, with
  // gaps where the sea runs right up to the cliff, rock pools on it and fallen blocks off its edge
  const edge = (u) => 13 + (fbm(u * 0.09, 11, 84) - 0.5) * 12 + (fbm(u * 0.3, 12, 85) - 0.5) * 4;
  // sea stacks, each its own: a tall needle, a broad stack with a grass cap, a broken stump, a leaning pair
  const STACKS = [[-30, 27, 3.2, 27, 0.25], [25, 31, 4.6, 19, 0.6], [-9, 41, 2.6, 6, 0.1], [38, 22, 2.2, 14, 0.2], [41, 25, 1.8, 10, 0.2]];
  const stackH = (u, v) => {
    let best = -1;
    for (const [su, sv, r, st, cap] of STACKS) {
      const rr = r * (1 + (fbm(u * 0.4 + su, v * 0.4, 86) - 0.5) * 0.7), d = Math.hypot(u - su, v - sv);
      if (d >= rr + 1.5) continue;
      const t = Math.max(0, Math.min(1, (rr + 1.5 - d) / (rr * 0.9))); // shoulders step down to the sea: a taper
      best = Math.max(best, Math.round(sea - 2 + (st + 2) * Math.pow(t, 0.55) + (fbm(u * 0.5, v * 0.5, 87) - 0.5) * 3));
    }
    return best;
  };
  const h = (u, v) => {
    const c = cliff(u), sh = stackH(u, v);
    if (sh >= sea - 1) return sh;
    if (inSink(u, v) || (inlet(u, v) && v <= 17)) return sea - 3;
    const e = edge(u);
    if (v > c) {
      if (v > e) { // the sea floor, with fallen blocks breaking the surface near the shelf
        if (v < e + 6 && hash(Math.floor(u / 2), Math.floor(v / 2), 88) < 0.18) return sea + (hash(u, v, 89) < 0.5 ? 0 : 1);
        return sea - 3 - Math.min(6, Math.floor((v - e) / 4));
      }
      if (hash(Math.floor(u / 3), Math.floor(v / 3), 90) < 0.12 && v > c + 2) return sea - 1; // rock pools
      return floor - 1 + Math.round(fbm(u * 0.2, v * 0.2, 91) * 3) + (v < c + 2 ? 1 : 0) + (hash(u, v, 92) < 0.08 ? 1 : 0);
    }
    const lip = Math.max(0, 1 - (c - v) / 3);
    return Math.round(topY + (fbm(u * 0.04, v * 0.04, 87) - 0.5) * 6 - lip * hash(u, v, 89) * 4);
  };
  const water = (u, v) => (h(u, v) < sea ? sea : undefined);
  // chalk faces: white chalk in thick beds, thin flint seams with dark nodules, pale streaks running down where
  // rain washes the face, and a dark wave-washed foot (stone, andesite, mossy cobble) up to five above the sea
  const top = (u, y, v, hh, slope) => {
    if (y === hh && slope <= 1 && hh > floor + 4) return "grass_block";
    if (y === hh && hh <= floor + 2 && hh >= sea) return hash(u, v, 93) < 0.55 ? "gravel" : hash(u, v, 94) < 0.5 ? "calcite" : "andesite";
    const wob = Math.round(fbm(u * 0.07, v * 0.07, 95) * 5);
    const yy = y + wob;
    if (y <= sea + 3 + Math.round(fbm(u * 0.15, v * 0.15, 96) * 3)) { const r = hash(u, y, v + 97); return r < 0.35 ? "stone" : r < 0.6 ? "andesite" : r < 0.8 ? "mossy_cobblestone" : "tuff"; }
    if (yy % 7 === 0) return hash(u, y, v) < 0.45 ? "cobbled_deepslate" : "tuff"; // a flint seam
    if (yy % 7 === 1 && hash(u, v, y) < 0.25) return "gravel";
    if (hash(Math.floor(u / 2) + Math.floor(v / 2) * 7, 0, 98) < 0.12) return hash(u, y, v) < 0.7 ? "white_concrete_powder" : "calcite"; // rain streaks
    const band = Math.floor(yy / 3) % 5;
    const r = hash(Math.floor(u / 2), y, Math.floor(v / 2) + 99);
    if (band === 2) return r < 0.6 ? "diorite" : "calcite";
    if (band === 4) return r < 0.5 ? "smooth_quartz" : "calcite";
    return r < 0.82 ? "calcite" : r < 0.92 ? "diorite" : "smooth_quartz";
  };
  // grass and moss tufts hang on the ledges of the face
  for (let u = -60; u <= 60; u++) {
    const c = Math.floor(cliff(u));
    for (let y = sea + 8; y < topY - 2; y += 1) if (hash(u, y, 100) < 0.035) add(u, y, c + 1, "moss_block");
  }
  // the cliff path: a two-wide stair cut into the face east of the mouth, from the clifftop down to the shore.
  // Each flight is cut three blocks further back than the one below it, so no flight runs under another: the
  // whole stair is open to the sky, with a low wall on the sea side of every flight and a landing at each turn.
  let fc0 = Infinity;
  for (let u = 8; u <= 24; u++) fc0 = Math.min(fc0, Math.floor(cliff(u)));
  const flights = [];
  { let y = topY, u = 22, dir = -1, steps = [];
    while (y > floor + 1) {
      steps.push([u, y]); u += dir; y -= 1;
      if (u <= 9 || u >= 23) { flights.push({ steps, dir, turn: [u, y] }); steps = []; dir = -dir; u += dir * 2; }
    }
    flights.push({ steps, dir, foot: [u, y] }); }
  const open = (u, y, v) => { for (let yy = y; yy <= topY + 3; yy++) add(u, yy, v, "air"); };
  flights.forEach((f, i) => {
    const b = 3 * (flights.length - 1 - i), v0 = fc0 - 2 - b; // this flight's two stair columns are v0 and v0 + 1, its wall v0 + 2
    for (const [u, y] of f.steps) {
      for (const v of [v0, v0 + 1]) { open(u, y, v); add(u, y - 1, v, f.dir < 0 ? "stone_brick_stairs>u+" : "stone_brick_stairs>u-"); }
      open(u, y + 1, v0 + 2); add(u, y - 1, v0 + 2, "stone_bricks"); add(u, y, v0 + 2, hash(u, y, 102) < 0.85 ? "cobblestone_wall" : "air");
    }
    if (f.turn) { // the landing: level, three long, reaching forward to the next flight down
      const [u, y] = f.turn;
      // (k = -1 is the column of this flight's last step: there the landing is only the lower flight's lane)
      for (let k = -1; k <= 1; k++) for (let v = k < 0 ? v0 + 3 : v0; v <= v0 + 4; v++) { open(u + k * f.dir, y, v); add(u + k * f.dir, y - 1, v, "stone_bricks"); }
      for (let k = -1; k <= 1; k++) { open(u + k * f.dir, y + 1, v0 + 5); add(u + k * f.dir, y - 1, v0 + 5, "stone_bricks"); add(u + k * f.dir, y, v0 + 5, "cobblestone_wall"); }
      for (let v = v0; v <= v0 + 5; v++) { const ue = u - f.dir * -2; open(ue, y + 1, v); add(ue, y, v, "cobblestone_wall"); add(ue, y - 1, v, "stone_bricks"); } // the end wall of the landing
    } else { // the foot: flagged, and open through the face out onto the shore
      const [u, y] = f.foot;
      for (let k = 0; k < 3; k++) for (let v = v0; v <= Math.floor(cliff(u + f.dir * k)) + 3; v++) { open(u + f.dir * k, y, v); add(u + f.dir * k, y - 1, v, "stone_bricks"); }
    }
  });
  // gravestones on the headland by the chapel plot
  for (let i = 0; i < 9; i++) { const u = -32 + (i % 3) * 3, v = -26 + Math.floor(i / 3) * 3; add(u, topY + 1, v, hash(i, 1, 95) < 0.5 ? "cobblestone_wall" : "mossy_cobblestone_wall"); }
  // boulders fallen from the cliff along the shore
  for (let i = 0; i < 30; i++) {
    const bu = Math.round((hash(i, 1, 103) - 0.5) * 110), c = cliff(bu), bv = Math.round(c + 1 + hash(i, 2, 103) * (edge(bu) - c + 4));
    if (Math.abs(bu) <= 4 && bv < 10) continue;
    const g = h(bu, bv), r = hash(i, 3, 103) < 0.4 ? 2 : 1;
    for (let a = 0; a < r; a++) for (let b = 0; b < r; b++) { add(bu + a, Math.max(g, sea) + 1, bv + b, hash(a, b, i) < 0.6 ? "calcite" : "andesite"); if (r === 2 && hash(a, b, i + 1) < 0.4) add(bu + a, Math.max(g, sea) + 2, bv + b, "diorite"); }
  }
  // the broad stack keeps a grass cap and a gull's nest of sticks
  { const [su, sv] = STACKS[1]; const g = stackH(su, sv); add(su, g + 1, sv, "hay_block"); add(su + 1, g + 1, sv, "dead_bush"); }
  return { h, water, top, floor, sink };
}

// ---------- the Bellfounders' Mine: a snow-capped escarpment, spoil heaps, the casting pit, a cart track ----------
function mine(real, add) {
  const floor = real(0, 10), lift = 26;
  const face = (u) => cliffAt(u, 0.018, 3) + (fbm(u * 0.1, 7, 101) - 0.5) * 4;
  const h = (u, v) => {
    const r = real(u, v), f = face(u);
    if (v > f) return Math.round(lerp(floor, r, smooth((v - f - 6) / 30))) ;
    const up = smooth((f - v) / 3); // near-vertical face, then the escarpment top rises gently back
    return Math.max(r, Math.round(floor + up * (lift + (f - v) * 0.15 + (fbm(u * 0.05, v * 0.05, 103) - 0.5) * 8)));
  };
  const top = (u, y, v, hh, slope) => {
    if (y === hh && slope <= 1) return hh > floor + 18 ? "snow" : "grass_block";
    return pick(["stone", "andesite", "stone", "cobblestone", "tuff"], Math.floor(u / 2), Math.floor(y / 2), 105);
  };
  // spoil heaps: cones of gravel and slag either side of the way out
  for (const [cu, cv, r] of [[-14, 12, 6], [15, 16, 5], [-22, 22, 4]]) {
    for (let du = -r; du <= r; du++) for (let dv = -r; dv <= r; dv++) {
      const d = Math.hypot(du, dv); if (d > r) continue;
      const base = h(cu + du, cv + dv), hh = Math.round((r - d) * 0.9);
      for (let y = 1; y <= hh; y++) add(cu + du, base + y, cv + dv, hash(du, dv + y, 107) < 0.75 ? "gravel" : "blackstone");
    }
  }
  // the bell-casting pit: a round pit lined in brick with green bronze slag at the bottom
  // (on the level ground out in front, clear of the face, the spoil heaps and the cart track; one rim height all round)
  const pu = -9, pv = 27, g = h(pu, pv);
  for (let du = -5; du <= 5; du++) for (let dv = -5; dv <= 5; dv++) {
    const d = Math.hypot(du, dv); if (d > 5.4) continue;
    for (let y = g - 3; y <= g; y++) add(pu + du, y, pv + dv, d > 4.4 ? "bricks" : y === g - 3 ? (hash(du, dv, 109) < 0.6 ? "oxidized_copper" : "weathered_copper") : "air");
  }
  // the cart track: a rail line from the mouth out along the foot of the face (it ends where the face swings round,
  // never up the cliff)
  for (let u = 0, v = 7; u <= 44; u++) { const vv = v + Math.round(u * 0.25); if (vv < face(u) + 3) break; const g = h(u, vv); add(u, g + 1, vv, hash(u, 1, 111) < 0.85 ? "rail" : "air"); }
  return { h, top, floor };
}

// ---------- Frostvein Gap: a gorge between two peaks, ice veins in the walls, a frozen fall ----------
function gap(real, add) {
  const floor = real(0, 8) - 4, V0 = 2, V1 = 14;
  const walls = (u, v) => {
    const wob = (fbm(u * 0.07, 1, 121) - 0.5) * 4;
    const a = V0 + wob, b = V1 + wob + (fbm(u * 0.05, 9, 123) - 0.5) * 4;
    if (v >= a && v <= b) return floor + (hash(u, v, 125) < 0.2 ? 1 : 0); // the pass floor
    const d = v < a ? a - v : v - b;
    const tall = v < a ? 34 : 28;
    return Math.round(floor + tall * smooth(d / 2.5) + d * 0.35 + (fbm(u * 0.06, v * 0.06, 127) - 0.5) * 10);
  };
  const h = (u, v) => { const w = walls(u, v); return Math.abs(v - 8) < 14 ? w : Math.max(real(u, v), w); };
  const vein = (u, y, v) => Math.abs(fbm(u * 0.09 + y * 0.05, v * 0.09 - y * 0.07, 129) - 0.5) < 0.03;
  const top = (u, y, v, hh, slope) => {
    if (y === hh && slope <= 1) return "snow";
    if (vein(u, y, v)) return hash(u, y + v, 131) < 0.5 ? "blue_ice" : "packed_ice";
    return pick(["stone", "andesite", "stone", "diorite"], Math.floor(u / 3), Math.floor(y / 2), 133);
  };
  // a frozen waterfall down the south wall, cairns at each end of the pass, snow drifts on the floor
  for (let y = floor + 1; y <= floor + 26; y++) for (let du = -1; du <= 1; du++) add(12 + du, y, Math.round(V1 + 1 + (y - floor) * 0.12), du ? "packed_ice" : "ice");
  for (const cu of [-44, 44]) { const g = walls(cu, 8); for (let y = 1; y <= 3; y++) add(cu, g + y, 8, y === 3 ? "cobblestone_wall" : "cobblestone"); add(cu + 1, g + 1, 8, "cobblestone"); }
  for (let u = -60; u <= 60; u++) for (let v = V0; v <= V1; v++) if (hash(u, v, 135) < 0.35 && Math.abs(u) > 4) add(u, walls(u, v) + 1, v, "snow_layer");
  return { h, top, floor };
}

// ---------- the Witchroot Caves: a sunken flooded hollow under one huge root tree ----------
function witchroot(real, add) {
  // the water lies a block under the lowest ground round the hollow, so it stays in on a slope (the fen here falls west)
  let low = Infinity;
  for (let a = 0; a < 24; a++) low = Math.min(low, real(Math.round(36 * Math.cos(a * 0.2618)), Math.round(16 + 36 * Math.sin(a * 0.2618))));
  const wl = low - 1, floor = wl - 1, fen = wl + 4;
  const bowl = (u, v) => Math.hypot(u, (v - 16) * 0.95) + (fbm(u * 0.1, v * 0.1, 141) - 0.5) * 8;
  const h = (u, v) => {
    const r = real(u, v), d = bowl(u, v);
    const bank = Math.hypot(u / 24, (v + 10) / 16) + (fbm(u * 0.12, v * 0.12, 140) - 0.5) * 0.35;
    if (bank < 1 && v < 3) return Math.max(r, wl + 1, Math.round(fen + 10 * smooth((1 - bank) / 0.45) * smooth((3 - v) / 3) + (fbm(u * 0.2, v * 0.2, 139) - 0.5) * 3)); // the root bank over the cave
    if (d < 30) return Math.round(lerp(floor - 1 - (hash(u, v, 143) < 0.4 ? 1 : 0), Math.max(r, wl + 1), smooth((d - 22) / 8)));
    return r;
  };
  const water = (u, v) => (bowl(u, v) < 30 && h(u, v) < wl ? wl : undefined); // only the hollow itself
  const top = (u, y, v, hh) => (y === hh ? (hh < wl ? "mud" : hash(u, v, 145) < 0.5 ? "mud" : hash(u, v, 147) < 0.5 ? "moss_block" : "grass_block") : y > hh - 3 ? "packed_mud" : "stone");
  // the great tree is a Cradle Tree built in gen_places.py (roots that rest on the bank and run into the water)
  // a rotting boardwalk from the hollow's edge to the mouth, with gaps: top slabs set in the water's top block, so
  // you walk level with the cave floor
  for (let v = 44; v >= 7; v--) { if (hash(v, 1, 153) < 0.12) continue; add(3, wl, v, "spruce_slab^"); add(4, wl, v, hash(v, 2, 153) < 0.7 ? "spruce_slab^" : "water"); if (v % 4 === 0) add(2, wl + 1, v, "spruce_fence"); }
  for (let u = -2; u <= 4; u++) for (let v = 7; v <= 9; v++) add(u, wl, v, "spruce_slab^"); // the landing stage at the mouth, level with the cave floor
  return { h, water, top, floor: wl }; // the cave floor starts one above the water, level with the boardwalk
}

// ---------- the Saltglass Grotto: a cracked white salt pan, a dome of fused salt, glassy spires ----------
function saltglass(real, add) {
  const plat = real(0, 30), pan = plat - 3;
  const inPan = (u, v) => Math.hypot(u, (v - 6) * 1.1) + (fbm(u * 0.06, v * 0.06, 161) - 0.5) * 14 < 58;
  // a mass of salt crystal columns, tallest in the middle, broken and uneven (no dome)
  const cols = [];
  for (let i = 0; i < 40; i++) {
    const a = hash(i, 1, 160) * 6.283, r = Math.sqrt(hash(i, 2, 160)) * 22;
    const cu = Math.cos(a) * r, cv = -11 + Math.sin(a) * r * 0.8;
    cols.push([cu, cv, 2.5 + hash(i, 3, 160) * 3.5, Math.round(4 + (1 - r / 22) * 13 + hash(i, 4, 160) * 5)]);
  }
  const dome = (u, v) => { let best = 0; for (const [cu, cv, rr, hh] of cols) { const d = Math.max(Math.abs(u - cu), Math.abs(v - cv), Math.abs(u - cu + v - cv) * 0.7); if (d < rr) best = Math.max(best, hh); } return best; };
  const h = (u, v) => {
    let dm = dome(u, v); const cl = cliffAt(u, 0.06, 2);
    if (dm > 0 && v > cl) dm = Math.round(dm * Math.max(0, 1 - (v - cl) / 2));
    if (dm > 0) return pan + dm;
    return inPan(u, v) ? pan : Math.max(real(u, v), plat);
  };
  // hexagonal cracks in the crust
  const crack = (u, v) => { const q = (u * 0.577 - v * 0.333) / 4, r = (v * 0.667) / 4; const a = q - Math.floor(q), b = r - Math.floor(r), c = (q + r) - Math.floor(q + r); return Math.min(a, 1 - a, b, 1 - b, c, 1 - c) < 0.06; };
  const top = (u, y, v, hh) => {
    if (dome(u, v) > 0) return hash(u, y + v, 165) < 0.25 ? "white_stained_glass" : hash(u, y, 167) < 0.5 ? "calcite" : "quartz_block";
    if (y === hh && inPan(u, v)) return crack(u, v) ? "smooth_sandstone" : "calcite";
    return y === hh ? "sand" : "sandstone";
  };
  // spires of salt and glass round the dome, leaning, 4 to 13 tall; an old salt-cutters' cart half sunk
  for (let i = 0; i < 22; i++) {
    const a = hash(i, 1, 169) * 6.283, r = 18 + hash(i, 2, 169) * 26, u0 = Math.round(Math.cos(a) * r), v0 = Math.round(Math.sin(a) * r * 0.9) - 4;
    if (Math.abs(u0) < 6 && v0 > -2) continue;
    const tall = 4 + Math.floor(hash(i, 3, 169) * 10), lean = (hash(i, 4, 169) - 0.5) * 0.25, g = h(u0, v0);
    for (let y = 1; y <= tall; y++) {
      const u = u0 + Math.round(lean * y), w = y < tall * 0.4 ? 1 : 0;
      for (let du = -w; du <= w; du++) for (let dv = -w; dv <= w; dv++) add(u + du, g + y, v0 + dv, y > tall - 2 ? "glass" : hash(y, i, 171) < 0.5 ? "white_stained_glass" : "calcite");
    }
  }
  const g = pan; for (const [du, dv] of [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]]) add(26 + du, g, 22 + dv, "spruce_planks");
  add(25, g + 1, 22, "spruce_fence"); add(28, g + 1, 23, "spruce_fence");
  return { h, top, floor: pan };
}

// ---------- King's Barrow: a long barrow with birches, a kerb, a wet ring ditch, a causeway, standing stones ----------
function barrow(real, add) {
  const fen = real(0, 20), floor = fen;
  const mound = (u, v) => { const d = Math.hypot(u / 14, (v + 14) / 26); return d < 1 ? Math.cos(d * Math.PI / 2) ** 0.7 : 0; };
  const front = (u) => cliffAt(u, 0.08, 3);
  const h = (u, v) => {
    const m = mound(u, v), r = real(u, v);
    let hh = fen + 13 * m + (fbm(u * 0.15, v * 0.15, 181) - 0.5) * 1.5 * m;
    if (v > front(u)) hh = lerp(hh, fen, smooth((v - front(u)) / 1.5)); // the flat forecourt cut into the east end
    const ring = Math.hypot(u / 19, (v + 14) / 31);
    if (ring > 1 && ring < 1.2 && !(Math.abs(u) <= 2 && v > 0)) return fen - 2; // the ditch, with the causeway across it
    if (ring < 1.45 && m <= 0) return Math.max(r, fen); // the berm inside the ditch and a low bank outside it hold the water in
    return Math.round(Math.max(m > 0 ? hh : r, m > 0 ? fen : -999));
  };
  const inDitch = (u, v) => { const ring = Math.hypot(u / 19, (v + 14) / 31); return ring > 1 && ring < 1.2; };
  const water = (u, v) => (inDitch(u, v) && h(u, v) <= fen - 2 ? fen - 1 : undefined);
  const top = (u, y, v, hh) => {
    const m = mound(u, v);
    if (m > 0 && m < 0.12 && y <= fen + 1) return "mossy_stone_bricks"; // the kerb at the mound's foot
    if (v > front(u) - 1 && v < 10 && Math.abs(u) <= 5 && y === hh) return hash(u, v, 183) < 0.6 ? "polished_tuff" : "tuff_bricks"; // forecourt flags
    if (y === hh) return hash(u, v, 185) < 0.15 ? "coarse_dirt" : "grass_block";
    return y > hh - 3 ? "dirt" : "stone";
  };
  // birches over the mound
  for (let i = 0; i < 14; i++) {
    const u = Math.round((hash(i, 1, 187) - 0.5) * 22), v = -14 + Math.round((hash(i, 2, 187) - 0.5) * 40);
    if (mound(u, v) < 0.2 || (Math.abs(u) < 5 && v > -24)) continue;
    const g = h(u, v), th = 5 + Math.floor(hash(i, 3, 187) * 3);
    for (let y = 1; y <= th; y++) add(u, g + y, v, "birch_log");
    for (let du = -2; du <= 2; du++) for (let dv = -2; dv <= 2; dv++) for (let dy = th - 2; dy <= th + 1; dy++) if (Math.abs(du) + Math.abs(dv) + Math.max(0, dy - th) * 2 <= 3 && !(du === 0 && dv === 0 && dy <= th)) add(u + du, g + dy, v + dv, "birch_leaves");
  }
  // nine standing stones in a ring round it, leaning, one fallen
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * 6.283 + 0.2, u0 = Math.round(Math.cos(a) * 26), v0 = Math.round(Math.sin(a) * 36) - 14;
    if (Math.abs(u0) <= 4 && v0 > 0) continue;
    const g = real(u0, v0), tall = 3 + Math.floor(hash(i, 1, 189) * 3), lean = hash(i, 2, 189) < 0.4 ? 1 : 0;
    if (i === 6) { for (let k = 0; k < 4; k++) add(u0 + k, g + 1, v0, "andesite"); continue; }
    for (let y = 1; y <= tall; y++) { add(u0 + (y > 2 ? lean : 0), g + y, v0, hash(i, y, 191) < 0.6 ? "andesite" : "tuff"); if (y <= 2) add(u0, g + y, v0 + 1, "andesite"); }
  }
  return { h, water, top, floor };
}
