import { addTests, assert, assertEqual } from "../core/tests.js";
import { VAULT_ROOMS } from "./rooms_data.js";
import { windowsOn, awayState, WINDOW, SAFE, safeBlow, safeCells } from "./data.js";
import { TIERS, LAYOUT, COSTS, worldOf, groundBox, LOCK_HP, BREAKER_POWER, MEND, REBUILD, breakSeconds } from "./data.js";

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
  "the 3x3 door sits two to four blocks left of the lock, centred on its height": () => {
    for (const tier of TIERS) for (const layout of ["treasury", "hall", "crypt"]) {
      const d = VAULT_ROOMS[tier][layout];
      const [lx, ly, lz] = d.marks.lock;
      const at = new Map();
      for (const [y, z, x0, n, i] of d.rows) for (let x = x0; x < x0 + n; x++) at.set(`${x},${y},${z}`, d.palette[i][0]);
      assert(/^siege:vault_lock_/.test(at.get(`${lx},${ly},${lz}`)), `${tier} ${layout} lock block`);
      for (let dx = -4; dx <= -2; dx++) for (let dy = -1; dy <= 1; dy++) {
        const id = at.get(`${lx + dx},${ly + dy},${lz}`);
        assert(/^siege:vault_door_/.test(id ?? ""), `${tier} ${layout} door at ${dx},${dy}: ${id}`);
      }
    }
  },
  "a better lock takes longer to break, a better breaker less; every tier can be mended and rebuilt": () => {
    for (let i = 1; i < TIERS.length; i++) assert(LOCK_HP[TIERS[i]] > LOCK_HP[TIERS[i - 1]], TIERS[i]);
    assertEqual(breakSeconds("wood", "siege:vault_breaker_iron"), 30);
    assertEqual(breakSeconds("choirsteel", "siege:vault_breaker_iron"), 240);
    assert(breakSeconds("choirsteel", "siege:vault_breaker_netherite") < breakSeconds("choirsteel", "siege:vault_breaker_diamond"), "netherite is fastest");
    for (const t of TIERS) assert(Object.keys(MEND[t]).length && REBUILD[t].length, `${t} repair`);
    assert(Object.keys(BREAKER_POWER).length === 3, "three breakers");
  },
  "an away keeper's vault opens in two short random windows a real day, the same on every check": () => {
    const day = 20400;
    const w = windowsOn("p1", day);
    assertEqual(w.length, WINDOW.perDay);
    for (const x of w) assert(x.end - x.start === WINDOW.minutes * 60000 && x.start >= day * 86400000 && x.end <= (day + 1) * 86400000, "inside the day");
    assert(w[0].end <= w[1].start, "not overlapping");
    assertEqual(windowsOn("p1", day), w, "same answer each time");
    assert(JSON.stringify(windowsOn("p2", day)) !== JSON.stringify(w), "other keepers, other times");
    const left = day * 86400000 - 30 * 3600000; // left 30 h before the day began
    assertEqual(awayState("p1", left, w[0].start + 60000).window?.start, w[0].start, "open inside a window");
    assert(!awayState("p1", left, w[0].end + 60000).window, "shut after it");
    assert(!awayState("p1", w[0].start - 3600000, w[0].start + 60000).away, "an hour away is not away");
    assert(!awayState("p1", undefined, w[0].start).away, "online is not away");
  },
  "every room has its 2x2 Regal Safe, and a better vault's safe takes more blows and pays less each": () => {
    for (const tier of TIERS) for (const layout of ["treasury", "hall", "crypt"]) {
      const d = VAULT_ROOMS[tier][layout];
      const at = new Map();
      for (const [y, z, x0, n, i] of d.rows) for (let x = x0; x < x0 + n; x++) at.set(`${x},${y},${z}`, d.palette[i]);
      safeCells(d.marks.safe).forEach(([x, y, z], part) => {
        const [id, p] = at.get(`${x},${y},${z}`) ?? [];
        assert(id === "siege:regal_safe" && p.raw?.["siege:part"] === part, `${tier} ${layout} safe part ${part}: ${id}`);
      });
    }
    for (let i = 1; i < TIERS.length; i++) {
      assert(SAFE[TIERS[i]].hits > SAFE[TIERS[i - 1]].hits && SAFE[TIERS[i]].share < SAFE[TIERS[i - 1]].share, TIERS[i]);
    }
    assertEqual(safeBlow("wood", 1000, 0), { take: 80, broken: false });
    assertEqual(safeBlow("wood", 1000, SAFE.wood.hits - 1), { take: 1000, broken: true }, "the last blow takes the rest");
    assertEqual(safeBlow("iron", 0, 0).take, 0, "nothing from an empty safe");
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
