import { addTests, assert, assertEqual } from "../siege/api.js";
import { ARENA, ringLayout, ROOM_COLORS } from "./layout.js";
import { ARENA_MOBS, DIFFICULTIES, KIT } from "./config.js";
import { spreadRooms, assignRooms, verdict, mobReward, hasLeft, gateRows, inBox, flat } from "./rules.js";
import { pickSeats } from "./crowd.js";
import { MONSTERS, shouldClear } from "../core/nomonsters.js";

addTests("arena", {
  "twelve rooms, one per colour, none sharing a spot": () => {
    for (const a of [ARENA, ringLayout({ x: 10, y: 64, z: -20 })]) {
      assertEqual(a.rooms.length, 12);
      assertEqual(new Set(a.rooms.map((r) => r.color)).size, 12);
      for (const r of a.rooms) assert(ROOM_COLORS.includes(r.color), r.color);
      assertEqual(new Set(a.rooms.map((r) => `${r.spawn.x},${r.spawn.z}`)).size, 12);
    }
  },
  "each test-arena gate is 3x3, between its room and the floor": () => {
    const a = ringLayout({ x: 0, y: 64, z: 0 });
    for (const r of a.rooms) {
      const rows = gateRows(r.gate);
      assertEqual(rows.length, 3);
      for (const row of rows) assertEqual(row.length, 3);
      const g = rows[1][1];
      assert(flat(g, a.center) < flat(r.spawn, a.center), `${r.color} gate faces the middle`);
      assert(flat(r.out, a.center) < flat(g, a.center), `${r.color} way out is on the floor side`);
      assert(!hasLeft(r.out, a, r, 6), `${r.color} way out counts as on the floor`);
      assert(!hasLeft(r.spawn, a, r, 6), `${r.color} own room is fine`);
      assert(inBox(g, r.gate.from, r.gate.to), "gate centre is in its box");
    }
  },
  "rooms spread round the ring": () => {
    assertEqual(spreadRooms(2), [0, 6]);
    assertEqual(spreadRooms(3), [0, 4, 8]);
    assertEqual(spreadRooms(4), [0, 3, 6, 9]);
    assertEqual(new Set(spreadRooms(12)).size, 12);
    const rooms = assignRooms([["a", "b"], [], ["c"]]);
    assertEqual(rooms, { a: 0, b: 0, c: 6 });
  },
  "who wins": () => {
    const f = (o) => Object.fromEntries(Object.entries(o).map(([id, [side, out]]) => [id, { side, out }]));
    assertEqual(verdict({ kind: "pvp", fighters: f({ a: [0, false], b: [1, false] }) }).result, "on");
    assertEqual(verdict({ kind: "pvp", fighters: f({ a: [0, false], b: [1, true] }) }), { result: "won", winner: 0 });
    assertEqual(verdict({ kind: "pvp", fighters: f({ a: [0, false], b: [0, false], c: [1, true] }) }).winner, 0);
    assertEqual(verdict({ kind: "pvp", fighters: f({ a: [0, true], b: [1, true] }) }).result, "draw");
    assertEqual(verdict({ kind: "pvp", fighters: f({ a: [0, false], b: [1, false] }), timeUp: true }).result, "draw");
    assertEqual(verdict({ kind: "mob", fighters: f({ a: [0, false] }), mobsLeft: 2 }).result, "on");
    assertEqual(verdict({ kind: "mob", fighters: f({ a: [0, false] }), mobsLeft: 0 }).result, "won");
    assertEqual(verdict({ kind: "mob", fighters: f({ a: [0, true] }), mobsLeft: 1 }).result, "lost");
    assertEqual(verdict({ kind: "mob", fighters: f({ a: [0, false] }), mobsLeft: 1, timeUp: true }).result, "lost");
  },
  "mob pay rises with difficulty and drops for repeats": () => {
    for (const m of ARENA_MOBS) {
      let last = 0;
      for (const d of DIFFICULTIES) { const r = mobReward(m.type, d.id); assert(r > last, `${m.name} ${d.name}`); last = r; }
      assert(mobReward(m.type, "legend", 1) < mobReward(m.type, "legend", 0), "second win pays less");
      assert(mobReward(m.type, "legend", 9) >= 1, "never nothing");
    }
    assertEqual(mobReward("minecraft:pig", "squire"), 0);
  },
  "arena mobs are tagged, so the no-monsters rule leaves them": () => {
    for (const m of ARENA_MOBS.filter((x) => MONSTERS.has(x.type))) {
      assert(!shouldClear({ typeId: m.type, cause: "Spawned", tags: ["hc_arena_mob"], nearestPlayer: 99 }), m.type);
    }
  },
  "the kit is vanilla iron only": () => {
    for (const id of [...Object.values(KIT.armor), ...KIT.items.map((i) => i[0])]) {
      assert(!/diamond|netherite|elytra|gold_(helmet|chestplate|leggings|boots|sword)/.test(id), id);
    }
  },
  "crowd seats spread out": () => {
    const seats = Array.from({ length: 300 }, (_, i) => ({ x: i, y: 0, z: 0 }));
    const picked = pickSeats(seats, 60);
    assertEqual(picked.length, 60);
    assert(picked[59].x > 280, "reaches the far end");
    assertEqual(pickSeats(seats.slice(0, 10), 60).length, 10);
  },
  "leaving the floor": () => {
    const a = ringLayout({ x: 0, y: 64, z: 0 });
    assert(!hasLeft({ x: 0, y: 64, z: 0 }, a, a.rooms[0], 6));
    assert(hasLeft({ x: 0, y: 64, z: 60 }, a, a.rooms[0], 6), "far off");
    assert(hasLeft({ x: 0, y: 100, z: 0 }, a, a.rooms[0], 6), "way up");
    assert(hasLeft(a.rooms[6].spawn, a, a.rooms[0], 6), "someone else's room");
  },
});
