// A rough test arena (/scriptevent siege:arena_test), so the fights can be tried before the real build lands.
// It is NOT the arena: plain blocks in the shape layout.js's ringLayout() describes (a sand floor, twelve
// concrete rooms in the settlement colours with iron-bar gates and a lectern each, a ring of standing room for the
// crowd, and the "Start a battle" lectern north of it all). Built a few dozen blocks a tick (system.runJob).

import { system, BlockPermutation } from "@minecraft/server";
import { RING, GATE_BLOCK } from "./layout.js";

const AIR = "minecraft:air";

export function buildTestArena(dim, a) {
  const { x: cx, y: cy, z: cz } = a.center;
  const outer = RING.seatRing + 4, wallR = RING.roomRing + RING.roomHalf + 2;
  const set = (x, y, z, id) => { try { dim.getBlock({ x, y, z })?.setType(id); } catch { /* unloaded */ } };
  system.runJob((function* () {
    let n = 0;
    const tick = () => (++n % 48 === 0);
    // ground, air, the ring wall and the stands
    for (let dx = -outer; dx <= outer; dx++) {
      for (let dz = -outer; dz <= outer; dz++) {
        const r = Math.hypot(dx, dz);
        if (r > outer + 0.5) continue;
        const x = cx + dx, z = cz + dz;
        set(x, cy - 1, z, r <= wallR ? "minecraft:sand" : "minecraft:stone_bricks");
        const stand = r >= RING.seatRing - 3 && r <= RING.seatRing + 3;
        const wall = r >= wallR && r < wallR + 1.5;
        for (let y = 0; y < 8; y++) set(x, cy + y, z, (stand && y < RING.seatRise) || (wall && y < 4) ? "minecraft:stone_bricks" : AIR);
        if (tick()) yield;
      }
    }
    // the rooms
    for (const room of a.rooms) {
      const { x: rx, z: rz } = room.spawn, h = RING.roomHalf + 1, top = RING.wallHeight;
      const concrete = `minecraft:${room.color}_concrete`;
      for (let dx = -h; dx <= h; dx++) {
        for (let dz = -h; dz <= h; dz++) {
          const edge = Math.abs(dx) === h || Math.abs(dz) === h;
          set(rx + dx, cy - 1, rz + dz, concrete);
          for (let y = 0; y < top; y++) set(rx + dx, cy + y, rz + dz, edge ? concrete : AIR);
          set(rx + dx, cy + top, rz + dz, concrete);
          if (tick()) yield;
        }
      }
      set(rx, cy + top - 1, rz, "minecraft:lantern");
      const g = room.gate;
      for (let x = Math.min(g.from.x, g.to.x); x <= Math.max(g.from.x, g.to.x); x++)
        for (let y = g.from.y; y <= g.to.y; y++)
          for (let z = Math.min(g.from.z, g.to.z); z <= Math.max(g.from.z, g.to.z); z++) set(x, y, z, GATE_BLOCK);
      set(room.board.x, room.board.y, room.board.z, "minecraft:lectern");
      yield;
    }
    // the "Start a battle" board, on a little stone pad
    const s = a.sign;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) set(s.x + dx, s.y - 1, s.z + dz, "minecraft:polished_andesite");
    try {
      dim.getBlock(s)?.setPermutation(BlockPermutation.resolve("minecraft:lectern", { "minecraft:cardinal_direction": "south" }));
    } catch {
      set(s.x, s.y, s.z, "minecraft:lectern");
    }
    // lights round the floor
    for (let k = 0; k < 16; k++) {
      const ang = (k / 16) * Math.PI * 2;
      set(cx + Math.round(Math.sin(ang) * (wallR + 1)), cy + 4, cz + Math.round(-Math.cos(ang) * (wallR + 1)), "minecraft:lantern");
    }
  })());
}
