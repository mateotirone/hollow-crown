// The Wound: where you arrive in the Hollow, and the way back.
//
// Mateo 2026-11-12, of a screenshot of the first one: "This definitely needs a lot of work." It was the short
// crack pasted on a flat slab of one block, with the void round it. Now the way back is a real place, the same
// kind as the seven caves on land: a cave cut into the back cliff (terrain.js backWall), a ragged mouth onto the
// arrival ledge between two buttresses of fallen rock, a short throat, a domed chamber, and at the back of it
// the tear, running from the floor to the roof and opening on the same black void as the one you came through.
// Nothing here is a flat face: the mouth, the walls and the roof are all cut on noise, and the rock is laid in
// the cliff's own beds (backRock).
//
// planWound() is pure and returns fill ops for builder.js, so it is tested in Node.

import { hash, fbm } from "./noise.js";
import { UNDERTOW_LAYOUT as L } from "./layout.js";
import { B, backRock, backFace, heightAt, firstHeightAt, roofAt } from "./terrain.js";
import { ARRIVAL, arrivalAt, walkCells, kerbCells, walkAt, kerbAt, onLedge } from "./arrival.js";
import { planCrack } from "./rift.js";

// v: raise it when the design changes, and every world rebuilds the Wound (builder.js piecesTick).
export const WOUND = { v: 3, mouthZ: -10, cz: -21, rx: 8, rz: 7, h: 15, wallZ: -29, box: [-48, -48, 47, 66] };

const key = (x, y, z) => `${x},${y},${z}`;

// Pure: is this cell open air inside the cave? F = the first air row (one above the ledge).
export function woundAir(x, y, z) {
  const F = L.woundLedgeY + 1, W = WOUND;
  if (y < F) return false;
  // the throat: from the mouth in to the chamber, an arch that wanders and is never the same two rows running
  if (z <= W.mouthZ && z >= W.cz + W.rz - 2) {
    const t = (W.mouthZ - z) / 5, mid = Math.round((fbm(z / 5, 0.3, 181) - 0.5) * 3);
    const hw = 4.6 - t * 0.9 + (fbm(z / 3, 1.7, 182) - 0.5) * 1.6, top = 7.5 - t * 1.2 + (fbm(z / 4, 2.9, 183) - 0.5) * 2;
    const du = (x - mid) / hw;
    if (Math.abs(du) <= 1 && y - F < top * Math.sqrt(1 - du * du * 0.85) + (hash(x, z, 184) < 0.3 ? 1 : 0)) return true;
  }
  // the chamber: an oval room under a dome, its outline pushed in and out by noise
  const wob = 1 + (fbm(x / 6, z / 6, 185) - 0.5) * 0.3;
  const du = x / ((W.rx + 0.5) * wob), dv = (z - W.cz) / ((W.rz + 0.5) * wob), d2 = du * du + dv * dv;
  if (d2 <= 1 && z > W.wallZ) {
    const top = Math.max(2, Math.round((W.h - 1) * Math.sqrt(1 - d2) + (fbm(x / 4, z / 4, 186) - 0.5) * 3));
    if (y - F <= top) return true;
  }
  // the back of it: a tall slot the full height round the tear, so the tear runs from the floor to the roof
  const ax = Math.abs(x), back = z - W.wallZ;
  if (back >= 1 && back <= 4 && ax <= 3) return y - F <= W.h - 1 - (ax === 3 ? 1 : 0) - Math.max(0, back - 2);
  return false;
}

// Pure: every block of the Wound, as fill ops ({ a, b, block, optional? }) in the order they must be placed.
export function planWound() {
  const W = WOUND, F = L.woundLedgeY + 1;
  const cells = new Map(), late = [];
  const put = (x, y, z, block) => cells.set(key(x, y, z), { x, y, z, block });

  // 1. outside: two buttresses of rock standing out from the cliff either side of the mouth, a broken brow over
  // it, and fallen blocks on the ledge, so the face the mouth opens in is never a plane
  for (let x = -22; x <= 22; x++) for (let z = W.mouthZ + 1; z <= W.mouthZ + 6; z++) {
    const out = z - W.mouthZ, ax = Math.abs(x);
    if (ax <= 4 + (out > 2 ? 1 : 0)) continue; // the way in stays clear
    const lump = Math.max(0, 1 - Math.abs(ax - 9) / 6) * (0.6 + 0.8 * fbm(x / 5, z / 5, x < 0 ? 187 : 188));
    const far = Math.max(0, 1 - Math.abs(ax - 18) / 5) * 0.5 * fbm(x / 4, z / 4, 189);
    const h = Math.round((lump * 16 + far * 12) * Math.max(0, 1 - (out - 1) / 5.5) - (hash(x, z, 190) < 0.25 ? 1 : 0));
    for (let y = F; y < F + h; y++) put(x, y, z, backRock(x, y, z));
  }
  // the cliff's face either side of and above the mouth: up to three blocks of rock standing out from it in
  // ribs and ledges, so it is never one flat wall (the first one was)
  for (let x = -44; x <= 44; x++) {
    const zf = backFace(x), top = heightAt(x, zf - 1), foot = heightAt(x, zf);
    if (top === null || foot === null) continue;
    const fade = Math.min(1, (44 - Math.abs(x)) / 8);
    for (let y = foot + 1; y < top; y++) {
      if (Math.abs(x) <= 6 && y <= F + 9) continue; // the mouth
      const t = Math.round((fbm(x / 7, y / 9, 176) * 3.2 + fbm(x / 2.5, y / 2.5, 177) * 1.6 - 1.5) * fade);
      for (let k = 0; k < t; k++) put(x, y, zf + k, backRock(x, y, zf + k));
    }
  }
  for (let x = -6; x <= 6; x++) { // the brow: teeth of rock hanging over the mouth
    const n = Math.round(fbm(x / 2.5, 0.9, 191) * 4 - 0.6 - Math.abs(x) * 0.15);
    for (let k = 0; k < n; k++) put(x, F + 10 - k + Math.round(Math.abs(x) * 0.3), W.mouthZ + 1, backRock(x, F + 10 - k, W.mouthZ + 1));
  }
  for (const [bx, bz, r] of [[-12, -3, 1.6], [11, -5, 2.1], [13, -2, 1.2], [-9, -6, 1.3]]) { // fallen blocks, clear of the path and of where a Slip lands
    for (let x = bx - 2; x <= bx + 2; x++) for (let z = bz - 2; z <= bz + 2; z++) for (let y = 0; y <= 2; y++) {
      if (Math.hypot(x - bx, y * 1.3, z - bz) <= r + (hash(x, y * 5 + z, 192) - 0.5) * 0.8) put(x, F + y, z, backRock(x, F + y, z));
    }
  }

  // 2. the cave
  const air = [];
  for (let x = -W.rx - 3; x <= W.rx + 3; x++) for (let z = W.wallZ; z <= W.mouthZ; z++) for (let y = F; y <= F + W.h + 3; y++) if (woundAir(x, y, z)) air.push([x, y, z]);
  const open = new Set(air.map(([x, y, z]) => key(x, y, z)));
  for (const [x, y, z] of air) put(x, y, z, "minecraft:air");
  // its skin: every block touching the air. The floor is worn dark stone with moss in the hollows and a trodden
  // line down the middle; the walls and roof are the cliff's beds; round the tear the Hollow's own stone shows
  for (const [x, y, z] of air) for (const [a, b, c] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
    const nx = x + a, ny = y + b, nz = z + c, k = key(nx, ny, nz);
    if (open.has(k) || nz > W.mouthZ) continue; // in front of the mouth is the ledge and the open air
    let block;
    const nearTear = Math.abs(nx) <= 5 && nz <= W.wallZ + 2;
    if (b === -1 && ny === F - 1) {
      const m = fbm(nx / 5, nz / 5, 193);
      block = Math.abs(nx - Math.round((fbm(nz / 5, 0.3, 181) - 0.5) * 3)) <= 1 && nz > W.cz ? (hash(nx, nz, 194) < 0.6 ? B.cobble : "minecraft:deepslate")
        : m > 0.62 ? B.mossDeep : m > 0.55 ? B.moss : hash(nx, nz, 195) < 0.5 ? "minecraft:deepslate" : "minecraft:blackstone";
    } else if (nearTear) block = hash(nx + ny * 3, nz, 196) < 0.16 ? B.budding : hash(nx, ny + nz, 197) < 0.6 ? B.rock : "minecraft:blackstone";
    else block = backRock(nx, ny, nz);
    put(nx, ny, nz, block);
    if (b === -1 && ny === F - 1 && !nearTear && Math.abs(nx) >= 3 && hash(nx, nz, 198) < 0.045) late.push({ x: nx, y: F, z: nz, block: B.glint }); // a few blue crystals on the floor: the only light but the veil
  }
  // veilmoss hanging in the mouth
  for (let x = -5; x <= 5; x++) {
    if (hash(x, 3, 199) > 0.45) continue;
    let y = F + 12; while (y > F + 3 && !open.has(key(x, y, W.mouthZ))) y--;
    for (let k = 0, n = 1 + Math.floor(hash(x, 5, 199) * 3); k < n && y - k > F + 2; k++) late.push({ x, y: y - k, z: W.mouthZ, block: B.strands });
  }

  // 3. the tear: the deep one, floor to roof, opening on the void (rift.js)
  for (const c of planCrack({ x: 0, y: F, z: W.wallZ }, "south", { deep: true, height: W.h })) put(c.x, c.y, c.z, c.block);

  // as fills: runs of one block up a column
  const cols = new Map();
  for (const c of cells.values()) { const k = `${c.x},${c.z}`; if (!cols.has(k)) cols.set(k, []); cols.get(k).push(c); }
  const ops = [];
  for (const list of cols.values()) {
    list.sort((p, q) => p.y - q.y);
    for (let i = 0; i < list.length;) {
      let j = i;
      while (j + 1 < list.length && list[j + 1].y === list[j].y + 1 && list[j + 1].block === list[i].block) j++;
      ops.push({ a: [list[i].x, list[i].y, list[i].z], b: [list[i].x, list[j].y, list[i].z], block: list[i].block });
      i = j + 1;
    }
  }
  for (const c of late) if (!cells.has(key(c.x, c.y, c.z)) || cells.get(key(c.x, c.y, c.z)).block === "minecraft:air") ops.push({ a: [c.x, c.y, c.z], b: [c.x, c.y, c.z], block: c.block, optional: true });
  return [...ops, ...planArrival()];
}

// Pure: for a world that built the first arrival (a box of rock and a ramp), what must go from one chunk before
// the land is planned again over it (builder.js): the old rock that stood higher than the land does now, and the
// trees and plants that stood where the crag, the stair and the court are.
export function planArrivalClear(cx, cz) {
  const ops = [], A = ARRIVAL;
  for (let x = Math.max(cx * 16, A.x0 - 6); x <= Math.min(cx * 16 + 15, A.x1 + 6); x++) for (let z = Math.max(cz * 16, A.z0); z <= Math.min(cz * 16 + 15, A.z1 + 6); z++) {
    const now = heightAt(x, z), was = firstHeightAt(x, z);
    if (now === null || was === null) continue;
    let near = false;
    if (was === now) { if (z <= 14) continue; for (let dx = -6; dx <= 6 && !near; dx += 3) for (let dz = -6; dz <= 6; dz += 3) if (arrivalAt(x + dx, z + dz)) { near = true; break; } }
    if (was !== now || near) ops.push({ a: [x, now + 1, z], b: [x, Math.min(Math.max(now, was) + 16, roofAt(x, z).bottom - 1), z], block: "minecraft:air" });
  }
  return ops;
}

// ---- the arrival: the stair down from the ledge (arrival.js has its shape) ------------------------------
const STAIR = { n: 3, s: 2, e: 0, w: 1 }; // Bedrock weirdo_direction for a stair you face this way going up
const mix = (list, r) => { let t = 0; for (const [w, b] of list) { t += w; if (r < t) return b; } return list[list.length - 1][1]; };
const TREAD = [[0.62, "minecraft:cobbled_deepslate_stairs"], [0.26, "minecraft:polished_blackstone_brick_stairs"], [0.12, "minecraft:deepslate_brick_stairs"]];
const STONE = [[0.7, B.deck], [0.16, B.deckCracked], [0.14, "minecraft:polished_blackstone_bricks"]]; // regions/hollow.md "stone"
const WAY = [[0.55, "minecraft:cobbled_deepslate"], [0.25, "minecraft:polished_blackstone_bricks"], [0.2, "minecraft:tuff"]]; // the road mix, as full blocks
const POSTS = [[3, 15], [3, 22], [10, 29], [4, 29], [10, 22], [25, 25], [25, 33], [20, 33], [25, 45], [20, 45], [13, 41], [13, 45], [20, 25]]; // lanterns: both sides (x and -x)

// Pure: the blocks of the stair, its walls, lanterns, the terrace wall and the court, as ops in placing order.
export function planArrival() {
  const ops = [], A = ARRIVAL;
  const one = (x, y, z, block, states) => ops.push(states ? { a: [x, y, z], b: [x, y, z], block, states } : { a: [x, y, z], b: [x, y, z], block });
  const fill = (x, y1, y2, z, block) => { if (y2 >= y1) ops.push({ a: [x, y1, z], b: [x, y2, z], block }); };
  // 1. the worn way across the ledge, from the cave mouth to the head of the stair
  for (let z = WOUND.mouthZ + 1; z <= 14; z++) {
    const mid = Math.round((fbm(z / 6, 0.4, 211) - 0.5) * 2), half = 2 + (hash(z, 1, 212) < 0.3 ? 1 : 0);
    for (let x = -5; x <= 5; x++) {
      if (!onLedge(x, z)) continue;
      if (x >= mid - half && x <= mid + half) one(x, A.top, z, mix(WAY, hash(x, z, 214)));
      else if (z > 10) one(x, A.top, z, hash(x, z, 213) < 0.5 ? "minecraft:deepslate" : B.rock); // no loose road surface left beside the paving
    }
  }
  // 2. kerbs and their low walls; the wall is left off where the rock beside it already stands higher
  for (const [k, h] of kerbCells()) {
    const [x, z] = k.split(",").map(Number);
    one(x, h, z, hash(x, z, 215) < 0.75 ? "minecraft:polished_blackstone_bricks" : B.deck);
    const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => !walkAt(x + dx, z + dz) && kerbAt(x + dx, z + dz) === null && (heightAt(x + dx, z + dz) ?? -999) <= h);
    if (open) one(x, h + 1, z, B.parapet);
  }
  // 3. what you walk on: stair blocks on every step, brick on the landings, worn paving in the court
  for (const [k, c] of walkCells()) {
    const [x, z] = k.split(",").map(Number);
    if (c.kind === "stair") { one(x, c.h - 1, z, B.deck); one(x, c.h, z, mix(TREAD, hash(x, z, 216)), { weirdo_direction: STAIR[c.climb], upside_down_bit: false }); }
    else if (c.kind === "landing") one(x, c.h, z, mix(STONE, hash(x, z, 217)));
    else { const m = fbm(x / 5, z / 5, 218); one(x, c.h, z, m > 0.66 ? B.mossDeep : m > 0.6 ? B.moss : hash(x, z, 219) < 0.5 ? mix(WAY, hash(x, z, 220)) : mix(STONE, hash(x, z, 221))); }
  }
  // 4. the terrace wall: never one flat face (Mateo's rule for every wall here). Three tall arched bays set two
  // blocks back between four pilasters; the pilasters are two deep at the foot with a sloped offset and a sloped
  // base; a course of upside-down stairs carries the kerb; a lantern hangs in each side bay and a small shrine
  // light stands in the middle one, where the path meets the wall.
  const T = A.top - 8, C = A.court, zf = 29;
  const face = (x, y, z) => { const r = hash(x * 3 + y, y * 5 - x + z, 222); return r < 0.05 ? B.deckCracked : r < 0.3 ? "minecraft:polished_blackstone_bricks" : y % 7 === 3 ? "minecraft:polished_blackstone_bricks" : B.deck; };
  for (let x = -10; x <= 10; x++) {
    for (let y = C + 1; y <= T - 1; y++) one(x, y, zf, face(x, y, zf));
    one(x, T - 1, zf + 1, mix(TREAD, hash(x, 7, 223)), { weirdo_direction: STAIR.n, upside_down_bit: true });
  }
  for (const [a, b, top, rise] of [[-9, -5, T - 8, 1], [-3, 3, T - 5, 2], [5, 9, T - 8, 1]]) {
    for (let x = a; x <= b; x++) for (const z of [zf - 1, zf]) {
      one(x, C, z, mix(WAY, hash(x, z, 224)));
      for (let y = C + 1; y <= top; y++) {
        const i = y - (top - rise + 1); // which row of the arch head this is (negative: the open bay below it)
        if (i < 0 || (x > a + i && x < b - i)) one(x, y, z, "minecraft:air");
        else if (x === a + i || x === b - i) one(x, y, z, "minecraft:polished_blackstone_brick_stairs", { weirdo_direction: x === a + i ? STAIR.w : STAIR.e, upside_down_bit: true });
      }
    }
    for (let x = a; x <= b; x++) for (let y = C + 1; y <= top; y++) one(x, y, zf - 2, hash(x + y * 3, y - x, 225) < 0.7 ? "minecraft:polished_blackstone_bricks" : "minecraft:deepslate_bricks");
    const mid = (a + b) / 2;
    if (mid !== 0) one(mid, top, zf - 1, B.lantern, { hanging: true });
  }
  one(0, C + 1, zf - 1, "minecraft:chiseled_polished_blackstone"); one(0, C + 2, zf - 1, B.lantern);
  one(-1, C + 1, zf - 1, B.glint); one(1, C + 1, zf - 1, B.glint);
  for (const x of [-10, -4, 4, 10]) {
    for (let y = C + 1; y <= T - 1; y++) one(x, y, zf + 1, y === C + 14 ? "minecraft:chiseled_polished_blackstone" : "minecraft:polished_blackstone_bricks");
    for (let y = C + 1; y <= C + 7; y++) one(x, y, zf + 2, "minecraft:polished_blackstone_bricks");
    one(x, C + 8, zf + 2, "minecraft:polished_blackstone_brick_stairs", { weirdo_direction: STAIR.n, upside_down_bit: false });
    one(x, C + 1, zf + 3, "minecraft:polished_blackstone_brick_stairs", { weirdo_direction: STAIR.n, upside_down_bit: false });
  }
  // 5. soul lanterns on the wall at every turn, both sides
  for (const [ax, z] of POSTS) for (const x of [ax, -ax]) {
    const h = kerbAt(x, z);
    if (h === null) continue;
    one(x, h + 1, z, B.parapet); one(x, h + 2, z, B.lantern);
  }
  return ops;
}
