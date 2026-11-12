// Block plans for the four set pieces after the Reeve. Pure: each plan is a generator that reads the ground through
// probe(x, z) -> { top, water, ground } (yielding between rows so the game never stalls) and returns
// { center, ops, info }, ops as offsets from center (dx, dy, dz). anchor.y set means "build here" (a flat test world:
// no lake or sea, the ground at anchor.y). Every footprint is an odd size.

const op = (dx, dy, dz, block, states) => (states ? { dx, dy, dz, block, states } : { dx, dy, dz, block });
const h = (a, b, c = 0) => {
  let x = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
};

// ===================================================================== Hallowmere (the Pale Huntsman)
export const HUNT = {
  disc: 22, // the lake is frozen hard out to here round the Hunter's Cairn
  crack: 17, // the ring that breaks when he comes
  arena: 16,
  cairnAngles: [45, 135, 225, 315], // the four beast cairns, on the shore
};
export const crackCells = () => {
  const out = [];
  const R = HUNT.crack;
  for (let dx = -R - 1; dx <= R + 1; dx++) for (let dz = -R - 1; dz <= R + 1; dz++) {
    const d = Math.hypot(dx, dz);
    if (d >= R - 0.5 && d < R + 0.5) out.push([dx, dz]);
  }
  return out;
};

/** Walk out along a ray from the centre until dry ground; returns { dx, dz, y } a few blocks past the water. */
function* shorePoint(probe, ax, az, angle, from, past, waterY) {
  const a = (angle * Math.PI) / 180;
  for (let r = from; r < 110; r++) {
    const x = Math.round(Math.sin(a) * r), z = Math.round(-Math.cos(a) * r);
    const p = probe(ax + x, az + z);
    if (!p) return undefined;
    if (p.water === undefined && p.ground >= waterY) {
      const x2 = Math.round(Math.sin(a) * (r + past)), z2 = Math.round(-Math.cos(a) * (r + past));
      const q = probe(ax + x2, az + z2);
      return q ? { dx: x2, dz: z2, y: q.ground } : undefined;
    }
    if (r % 8 === 0) yield;
  }
  return undefined;
}

export function* huntPlan(probe, anchor, hunt) {
  const ax = anchor.x, az = anchor.z;
  const here = anchor.y !== undefined;
  const mid = probe(ax, az);
  if (!mid) return undefined;
  const iceY = here ? anchor.y : mid.water ?? mid.ground;
  const center = { x: ax, y: iceY, z: az };
  const ops = [];
  // On the map the area stamp (landmark_stamps.js) lays the lake floor: snow with ice patches, drifts and ridges. The
  // plan only freezes the ring that cracks when he comes. A flat test build (`here`) still gets a plain ice disc.
  if (here) {
    for (let dx = -HUNT.disc; dx <= HUNT.disc; dx++) {
      for (let dz = -HUNT.disc; dz <= HUNT.disc; dz++) {
        if (Math.hypot(dx, dz) > HUNT.disc) continue;
        ops.push(op(dx, 0, dz, "minecraft:packed_ice"));
        for (let y = 1; y <= 4; y++) ops.push(op(dx, y, dz, "minecraft:air"));
      }
      yield;
    }
  } else {
    for (const [dx, dz] of crackCells()) ops.push(op(dx, 0, dz, "minecraft:packed_ice"));
  }
  // the Hunter's Cairn in the middle
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) ops.push(op(dx, 1, dz, (dx + dz) % 2 ? "minecraft:cobblestone" : "minecraft:mossy_cobblestone"));
  ops.push(op(0, 2, 0, "minecraft:mossy_cobblestone"));
  ops.push(op(0, 3, 0, "siege:hunters_cairn", { "siege:horned": 0 }));
  for (const [dx, dz] of [[-1, 0], [1, 0]]) ops.push(op(dx, 2, dz, "minecraft:cobblestone_wall"));
  // four beast cairns on the shore
  const cairns = [];
  for (let i = 0; i < 4; i++) {
    const s = here ? { dx: Math.round(Math.sin((HUNT.cairnAngles[i] * Math.PI) / 180) * 26), dz: Math.round(-Math.cos((HUNT.cairnAngles[i] * Math.PI) / 180) * 26), y: iceY }
      : yield* shorePoint(probe, ax, az, HUNT.cairnAngles[i], HUNT.disc - 4, 3, iceY);
    if (!s) return undefined;
    const dy = s.y - iceY;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) ops.push(op(s.dx + dx, dy + 1, s.dz + dz, "minecraft:mossy_cobblestone"));
    ops.push(op(s.dx, dy + 2, s.dz, "minecraft:cobblestone"));
    const beast = hunt.layout.indexOf(i);
    ops.push(op(s.dx, dy + 3, s.dz, "siege:hunt_cairn", { "siege:beast": beast, "siege:lit": 0 }));
    cairns.push({ dx: s.dx, dy: dy + 3, dz: s.dz, beast });
  }
  // the lodge on the south shore, door facing the lake, the warden outside it
  const l = here ? { dx: 0, dz: 30, y: iceY } : yield* shorePoint(probe, ax, az, 180, HUNT.disc - 4, 7, iceY);
  if (!l) return undefined;
  const ly = l.y - iceY;
  for (let dx = -3; dx <= 3; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      const edge = Math.abs(dx) === 3 || Math.abs(dz) === 2;
      const corner = Math.abs(dx) === 3 && Math.abs(dz) === 2;
      ops.push(op(l.dx + dx, ly, l.dz + dz, "minecraft:spruce_planks"));
      for (let y = 1; y <= 3; y++) {
        const door = dz === -2 && dx === 0 && y <= 2;
        ops.push(op(l.dx + dx, ly + y, l.dz + dz, door || !edge ? "minecraft:air" : corner ? "minecraft:spruce_log" : y === 2 && dx % 2 === 0 ? "minecraft:spruce_trapdoor" : "minecraft:spruce_planks"));
      }
      ops.push(op(l.dx + dx, ly + 4, l.dz + dz, "minecraft:spruce_slab"));
    }
  }
  ops.push(op(l.dx, ly + 3, l.dz, "minecraft:lantern", { hanging: true }));
  ops.push(op(l.dx, ly + 4, l.dz - 3, "minecraft:spruce_slab"));
  const warden = { dx: l.dx + 1.5, dy: ly + 1, dz: l.dz - 3.5 };
  return { center, ops, info: { cairns, warden } };
}

// ===================================================================== Gull Bay (the Drowned Bride)
export const CHAPEL = {
  nave: { x0: -9, x1: 9, z0: -4, z1: 4, h: 7 }, // interior; walls one block outside, floor y 0, roof y 8
  tower: { x0: -14, x1: -10, z0: -2, z1: 2 }, // outside the west wall; its 3x3 middle is open
  altar: { dx: 8, dy: 1, dz: 0 },
  pewX: (row) => 7 - 2 * row, // row 1 nearest the altar
};
/** Every open cell inside the chapel up to `surfaceDy` (the sea's level, relative to the floor): the water that drains. */
export function chapelInterior(surfaceDy) {
  const out = [];
  const n = CHAPEL.nave;
  for (let x = n.x0; x <= n.x1; x++) for (let z = n.z0; z <= n.z1; z++) for (let y = 1; y <= n.h; y++) {
    if (pewAt(x, z) && y === 1) continue;
    if (x === CHAPEL.altar.dx && z === CHAPEL.altar.dz && y === CHAPEL.altar.dy) continue;
    out.push([x, y, z]);
  }
  const t = CHAPEL.tower;
  for (let x = t.x0 + 1; x <= t.x1 - 1; x++) for (let z = t.z0 + 1; z <= t.z1 - 1; z++) for (let y = 1; y <= Math.min(surfaceDy, 40); y++) {
    if (x === t.x0 + 1 && z === 0) continue; // the ladder's cell keeps its ladder
    out.push([x, y, z]);
  }
  for (let y = 1; y <= 3; y++) out.push([n.x0 - 1, y, 0]); // the doorway from the tower
  return out;
}
function pewAt(x, z) {
  for (let row = 1; row <= 6; row++) if (x === CHAPEL.pewX(row) && Math.abs(z) >= 2) return true;
  return false;
}
export const pewStone = (row, side) => ({ dx: CHAPEL.pewX(row) + 1, dy: 0, dz: side === 0 ? -1 : 1 });

export function* chapelPlan(probe, anchor, pews) {
  const here = anchor.y !== undefined;
  const p = probe(anchor.x, anchor.z);
  if (!p) return undefined;
  const surface = here ? anchor.y : p.water ?? p.ground + 10;
  const bed = here ? anchor.y - 12 : p.ground;
  const floor = Math.min(bed, surface - 10);
  const center = { x: anchor.x, y: floor, z: anchor.z };
  const surfaceDy = surface - floor;
  const top = surfaceDy + 4;
  const ops = [];
  const n = CHAPEL.nave, t = CHAPEL.tower;
  const wall = (x, y, z) => (h(x, y, z) < 0.25 ? "minecraft:mossy_stone_bricks" : h(x, y, z) < 0.4 ? "minecraft:prismarine_bricks" : h(x, y, z) < 0.5 ? "minecraft:cracked_stone_bricks" : "minecraft:stone_bricks");
  // shell: floor, walls, roof; dig out anything inside
  for (let x = n.x0 - 1; x <= n.x1 + 1; x++) {
    for (let z = n.z0 - 1; z <= n.z1 + 1; z++) {
      const edge = x === n.x0 - 1 || x === n.x1 + 1 || z === n.z0 - 1 || z === n.z1 + 1;
      ops.push(op(x, 0, z, edge ? wall(x, 0, z) : (x + z) % 2 ? "minecraft:dark_prismarine" : "minecraft:polished_andesite"));
      for (let y = 1; y <= n.h; y++) ops.push(op(x, y, z, edge ? (y === 4 && !(Math.abs(z) === n.z1 + 1 && x % 4 === 0) ? wall(x, y, z) : y === 4 ? "minecraft:sea_lantern" : wall(x, y, z)) : "minecraft:water"));
      ops.push(op(x, n.h + 1, z, edge ? wall(x, n.h + 1, z) : "minecraft:prismarine_bricks"));
    }
    yield;
  }
  // pews (spruce stairs facing the altar), the carved stones by each pew, the altar and its step
  for (let row = 1; row <= 6; row++) {
    const x = CHAPEL.pewX(row);
    for (const z of [-4, -3, -2, 2, 3, 4]) ops.push(op(x, 1, z, "minecraft:spruce_stairs", { weirdo_direction: 1 }));
    for (const side of [0, 1]) {
      const s = pewStone(row, side);
      ops.push(op(s.dx, 0, s.dz, "siege:carved_floor", { "siege:carving": pews.stones[row - 1][side], "siege:lifted": 0 }));
    }
  }
  for (let z = -2; z <= 2; z++) ops.push(op(9, 0, z, "minecraft:dark_prismarine"));
  ops.push(op(CHAPEL.altar.dx, CHAPEL.altar.dy, CHAPEL.altar.dz, "siege:drowned_altar", { "siege:ringed": 0 }));
  // the tower, rising out of the sea, open at the top, with a ladder down the inside
  for (let x = t.x0; x <= t.x1; x++) {
    for (let z = t.z0; z <= t.z1; z++) {
      const edge = x === t.x0 || x === t.x1 || z === t.z0 || z === t.z1;
      ops.push(op(x, 0, z, wall(x, 0, z)));
      for (let y = 1; y <= top; y++) {
        if (edge) ops.push(op(x, y, z, y === top && (x + z) % 2 === 0 ? "minecraft:air" : wall(x, y, z)));
        else if (x === t.x0 + 1 && z === 0) ops.push(op(x, y, z, "minecraft:ladder", { facing_direction: 5 }));
        else ops.push(op(x, y, z, y <= surfaceDy ? "minecraft:water" : "minecraft:air"));
      }
    }
  }
  for (let y = 1; y <= 3; y++) ops.push(op(n.x0 - 1, y, 0, "minecraft:water")); // the doorway from the tower into the nave
  return { center, ops, info: { surfaceDy } };
}
export const inChapel = (c, l) => l.x >= c.x + CHAPEL.nave.x0 && l.x < c.x + CHAPEL.nave.x1 + 1 && l.z >= c.z + CHAPEL.nave.z0 && l.z < c.z + CHAPEL.nave.z1 + 1 && l.y > c.y && l.y < c.y + CHAPEL.nave.h + 1;

// ===================================================================== Sunscar (the Ash Seneschal)
export const VAULT = {
  stairLen: 12,
  floor: -13, // antechamber and vault floor, below the entrance
  ante: { x0: -7, x1: 7, z0: -24, z1: -14, h: 5 },
  vault: { x0: -10, x1: 10, z0: -46, z1: -26, h: 8 },
  doorZ: -25,
  spots: [[-6, -15], [-6, -19], [-6, -23], [6, -17], [6, -21]], // the five statues
  seal: { dx: 3, dz: -25 },
  niche: { dx: -3, dz: -25 },
};
export const statueAt = (i) => ({ dx: VAULT.spots[i][0], dy: VAULT.floor + 3, dz: VAULT.spots[i][1] });
export const doorCells = () => {
  const out = [];
  for (let y = VAULT.floor + 4; y >= VAULT.floor + 1; y--) for (let x = -1; x <= 1; x++) out.push([x, y, VAULT.doorZ]);
  return out; // top row first, so it grinds open from the top
};

export function* vaultPlan(probe, anchor) {
  const here = anchor.y !== undefined;
  const p = probe(anchor.x, anchor.z);
  if (!p) return undefined;
  const center = { x: anchor.x, y: here ? anchor.y : p.ground, z: anchor.z };
  const ops = [];
  const F = VAULT.floor;
  const stone = (x, y, z) => (h(x, y, z) < 0.3 ? "minecraft:cut_sandstone" : h(x, y, z) < 0.38 ? "minecraft:chiseled_sandstone" : "minecraft:smooth_sandstone");
  const room = (r, floorBlock) => {
    for (let x = r.x0 - 1; x <= r.x1 + 1; x++) for (let z = r.z0 - 1; z <= r.z1 + 1; z++) {
      const edge = x === r.x0 - 1 || x === r.x1 + 1 || z === r.z0 - 1 || z === r.z1 + 1;
      ops.push(op(x, F, z, edge ? stone(x, F, z) : floorBlock(x, z)));
      for (let y = F + 1; y <= F + r.h; y++) ops.push(op(x, y, z, edge ? stone(x, y, z) : "minecraft:air"));
      ops.push(op(x, F + r.h + 1, z, stone(x, F + r.h + 1, z)));
    }
  };
  // the stair down, walking north, with an arch over the top
  for (let k = 0; k < VAULT.stairLen; k++) {
    const z = -k;
    for (let x = -2; x <= 2; x++) {
      const side = Math.abs(x) === 2;
      ops.push(op(x, -k - 1, z, side ? stone(x, -k - 1, z) : "minecraft:sandstone_stairs", side ? undefined : { weirdo_direction: 2 }));
      for (let y = -k; y <= -k + 4; y++) ops.push(op(x, y, z, side && y <= 0 ? stone(x, y, z) : "minecraft:air"));
      if (-k + 5 <= 0) ops.push(op(x, -k + 5, z, stone(x, -k + 5, z))); // a roof once it is underground
    }
  }
  for (let x = -2; x <= 2; x++) ops.push(op(x, 4, 1, "minecraft:cut_sandstone"));
  for (const x of [-2, 2]) for (let y = 1; y <= 3; y++) ops.push(op(x, y, 1, "minecraft:chiseled_sandstone"));
  yield;
  room(VAULT.ante, (x, z) => ((x + z) % 2 ? "minecraft:smooth_sandstone" : "minecraft:cut_sandstone"));
  yield;
  room(VAULT.vault, (x, z) => (h(x, z, 9) < 0.18 ? "minecraft:gray_concrete_powder" : (x + z) % 2 ? "minecraft:light_gray_terracotta" : "minecraft:smooth_sandstone"));
  yield;
  // the stair opens into the antechamber
  for (let z = -VAULT.stairLen; z >= VAULT.ante.z1 + 1; z--) for (let x = -1; x <= 1; x++) for (let y = F + 1; y <= F + 4; y++) ops.push(op(x, y, z, "minecraft:air"));
  for (let x = -1; x <= 1; x++) ops.push(op(x, F, -VAULT.stairLen, "minecraft:cut_sandstone"));
  // the door (shut), the blank seal beside it and the niche on the other side
  for (const [x, y, z] of doorCells()) ops.push(op(x, y, z, y === F + 4 ? "minecraft:chiseled_sandstone" : "minecraft:cut_sandstone"));
  ops.push(op(VAULT.seal.dx, F + 2, VAULT.seal.dz, "siege:vault_seal", { "siege:sealed": 0, "minecraft:cardinal_direction": "south" }));
  ops.push(op(VAULT.niche.dx, F + 2, VAULT.niche.dz, "minecraft:chiseled_sandstone"));
  // the five statues: a plinth, a body, and a faceless head looking into the room
  for (const [x, z] of VAULT.spots) {
    ops.push(op(x, F + 1, z, "minecraft:smooth_sandstone"));
    ops.push(op(x, F + 2, z, "minecraft:chiseled_sandstone"));
    ops.push(op(x, F + 3, z, "siege:faceless_bust", { "minecraft:cardinal_direction": x < 0 ? "east" : "west" }));
  }
  // lights, and the steward's desk at the far end of the vault
  for (const [x, z] of [[-6, -14], [6, -14], [-6, -24], [6, -24]]) ops.push(op(x, F + VAULT.ante.h, z, "minecraft:soul_lantern", { hanging: true }));
  for (const [x, z] of [[-8, -28], [8, -28], [-8, -44], [8, -44], [0, -36]]) ops.push(op(x, F + VAULT.vault.h, z, "minecraft:soul_lantern", { hanging: true }));
  for (let x = -2; x <= 2; x++) ops.push(op(x, F + 1, -43, "minecraft:dark_oak_stairs", { weirdo_direction: 3, upside_down_bit: true }));
  ops.push(op(0, F + 1, -45, "minecraft:dark_oak_stairs", { weirdo_direction: 2 }));
  ops.push(op(-2, F + 2, -43, "minecraft:candle", { lit: false, candles: 2 }));
  return { center, ops, info: {} };
}
export const signSpot = (i) => ({ dx: VAULT.spots[i][0] + (VAULT.spots[i][0] < 0 ? 1 : -1), dy: VAULT.floor + 1, dz: VAULT.spots[i][1] });
export const inVault = (c, l) => {
  const v = VAULT.vault;
  return l.x >= c.x + v.x0 && l.x < c.x + v.x1 + 1 && l.z >= c.z + v.z0 && l.z < c.z + v.z1 + 1 && l.y > c.y + VAULT.floor && l.y < c.y + VAULT.floor + v.h + 1;
};

// ===================================================================== the Cradle Tree (the Mother of Changelings)
export const CRADLE = { floor: -12, r: 13.5, h: 9, ramp: 11 };
export const rootCells = () => {
  const out = [];
  const R = Math.floor(CRADLE.r);
  for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) {
    const d = Math.hypot(dx, dz);
    if (d <= CRADLE.r - 1 && d > 1.5 && h(dx, dz, 3) < 0.45) out.push([dx, dz, d]);
  }
  return out.sort((a, b) => a[2] - b[2]); // nearest the cradle first: they unwind from the middle out
};

export function* cradlePlan(probe, anchor) {
  const here = anchor.y !== undefined;
  const p = probe(anchor.x, anchor.z);
  if (!p) return undefined;
  const center = { x: anchor.x, y: here ? anchor.y : p.ground, z: anchor.z };
  const ops = [];
  const F = CRADLE.floor, ceil = F + CRADLE.h + 1;
  const R = Math.ceil(CRADLE.r) + 1;
  for (let dx = -R; dx <= R; dx++) {
    for (let dz = -R; dz <= R; dz++) {
      const d = Math.hypot(dx, dz);
      if (d > CRADLE.r + 1) continue;
      const inside = d <= CRADLE.r;
      ops.push(op(dx, F, dz, h(dx, dz) < 0.3 ? "minecraft:moss_block" : h(dx, dz) < 0.5 ? "minecraft:muddy_mangrove_roots" : "minecraft:mud"));
      for (let y = F + 1; y < ceil; y++) ops.push(op(dx, y, dz, inside ? "minecraft:air" : h(dx, y, dz) < 0.5 ? "minecraft:packed_mud" : "minecraft:mud_bricks"));
      ops.push(op(dx, ceil, dz, inside ? "minecraft:mangrove_roots" : "minecraft:packed_mud"));
    }
    yield;
  }
  for (const [dx, dz] of rootCells()) {
    ops.push(op(dx, ceil - 1, dz, "minecraft:mangrove_roots"));
    ops.push(op(dx, ceil - 2, dz, "minecraft:hanging_roots"));
  }
  ops.push(op(0, F + 1, 0, "siege:root_cradle", { "siege:laid": 0 }));
  for (const [dx, dz] of [[-6, 6], [6, -6], [-7, -5], [7, 5]]) ops.push(op(dx, F + 1, dz, "minecraft:ochre_froglight"));
  // the ramp down from the south, an open cut lined with mud bricks
  for (let k = 0; k <= CRADLE.ramp; k++) {
    const z = Math.ceil(CRADLE.r) + CRADLE.ramp - k;
    for (let x = -2; x <= 2; x++) {
      const side = Math.abs(x) === 2;
      ops.push(op(x, -k - 1, z, side ? "minecraft:mud_bricks" : "minecraft:mud_brick_stairs", side ? undefined : { weirdo_direction: 2 }));
      for (let y = -k; y <= 2; y++) ops.push(op(x, y, z, side && y <= 0 ? "minecraft:mud_bricks" : "minecraft:air"));
    }
  }
  // the Cradle Tree itself stands over the cave as the site's landmark (landmark_stamps.js, map/structures/boss_landmarks.py)
  return { center, ops, info: {} };
}
// The Changeling Glade on the way in (drawn by the world builds thread as part of the area stamp): a sunken clearing
// south of the cave where the Mother's changelings come for whoever walks through.
export const GLADE = { dz: 47, r: 13, floor: -1, clear: 8 };
export const inGlade = (c, l) => Math.hypot(l.x - (c.x + 0.5), l.z - (c.z + GLADE.dz + 0.5)) <= GLADE.r && l.y >= c.y + GLADE.floor && l.y <= c.y + GLADE.clear;
export const inCradle = (c, l) => Math.hypot(l.x - (c.x + 0.5), l.z - (c.z + 0.5)) <= CRADLE.r && l.y > c.y + CRADLE.floor && l.y < c.y + CRADLE.floor + CRADLE.h + 1;

// ===================================================================== Mirelight's five villagers
export const MIRE = { r: 8 };
export function* mirelightPlan(probe, anchor, villagers) {
  const here = anchor.y !== undefined;
  const p = probe(anchor.x, anchor.z);
  if (!p) return undefined;
  const center = { x: anchor.x, y: here ? anchor.y : p.ground, z: anchor.z };
  const ops = [];
  const spots = [];
  for (let i = 0; i < villagers.length; i++) {
    const a = ((i * 72 + 36) * Math.PI) / 180;
    const dx = Math.round(Math.sin(a) * MIRE.r), dz = Math.round(-Math.cos(a) * MIRE.r);
    const q = here ? { ground: center.y } : probe(anchor.x + dx, anchor.z + dz);
    if (!q) return undefined;
    const dy = q.ground - center.y;
    ops.push(op(dx, dy + 1, dz, "minecraft:mangrove_fence"));
    ops.push(op(dx, dy + 2, dz, "minecraft:mangrove_fence"));
    ops.push(op(dx, dy + 3, dz, "minecraft:lantern"));
    const sx = Math.round(Math.sin(a) * (MIRE.r - 1)), sz = Math.round(-Math.cos(a) * (MIRE.r - 1));
    spots.push({ post: { dx, dy, dz }, sign: { dx: sx, dy: dy + 1, dz: sz }, npc: { dx: sx + 0.5 + (Math.abs(sz) > Math.abs(sx) ? 1 : 0), dy: dy + 1, dz: sz + 0.5 + (Math.abs(sz) > Math.abs(sx) ? 0 : 1) } });
    yield;
  }
  return { center, ops, info: { spots } };
}
