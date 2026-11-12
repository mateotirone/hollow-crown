import { addTests, assert, assertEqual } from "../core/tests.js";
import { VAULT_ROOMS } from "./rooms_data.js";
import { TIERS, LAYOUT, COSTS, worldOf, groundBox } from "./data.js";

addTests("vault", {
  "every tier has every layout, with the lock, the three stands and the entrance": () => {
    for (const tier of TIERS) for (const layout of ["treasury", "hall", "crypt"]) {
      const d = VAULT_ROOMS[tier][layout];
      for (const m of ["lock", "stand_crown", "stand_heart", "stand_template", "entrance"]) assert(d.marks[m], `${tier} ${layout} ${m}`);
      assert(d.box.z0 >= 1 && d.box.y1 < 4, `${tier} ${layout} stays ahead of and below the player`);
      assert(!d.rows.some(([y, z, x0, n]) => y === 1 && z === 0 && x0 <= 0 && x0 + n > 0), `${tier} ${layout} never sets the origin`);
    }
  },
  "each tier is a bigger room than the last, and the lock is beside the door on the right": () => {
    for (let i = 1; i < TIERS.length; i++) assert(VAULT_ROOMS[TIERS[i]].treasury.size > VAULT_ROOMS[TIERS[i - 1]].treasury.size, TIERS[i]);
    for (const tier of TIERS) assert(VAULT_ROOMS[tier].treasury.marks.lock[0] > 0, `${tier} lock on the right`);
  },
  "a layout and a cost for every tier": () => {
    for (const tier of TIERS) { assert(VAULT_ROOMS[tier][LAYOUT[tier]], `${tier} layout`); assert(COSTS[tier]?.length, `${tier} cost`); }
  },
  "the room turns with the way the player faces": () => {
    const north = { x: 0, y: 64, z: 0, fx: 0, fz: -1 };
    assertEqual(worldOf(north, 0, 1, 5), { x: 0, y: 64, z: -5 });
    assertEqual(worldOf(north, 2, 1, 0), { x: 2, y: 64, z: 0 }); // facing north, right is east
    const b = groundBox(north, VAULT_ROOMS.wood.treasury.box);
    assert(b.z1 <= -1 && b.x0 < 0 && b.x1 > 0, "ahead of the player, both sides");
  },
});
