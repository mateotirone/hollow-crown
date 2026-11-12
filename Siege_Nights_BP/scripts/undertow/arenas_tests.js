// What the boss fights need from the Drowned Court and the Seat (map/structures/hollow_arenas.py).
import { addTests, assert } from "../core/tests.js";
import { COURT_DESIGN, SEAT_DESIGN } from "./arenas_data.js";
import { stampCells } from "./stamp.js";
import { COURT, HEART } from "./layout.js";
import { singerSpot, CHOIR } from "./choir.js";

const solidAt = (d) => {
  const s = new Map();
  for (const [x, y, z, i] of stampCells(d)) s.set(`${x},${y},${z}`, d.palette[i][0]);
  return s;
};
const blocks = (s, k) => { const n = s.get(k); return n && n !== "minecraft:air" && n !== "minecraft:water"; };

addTests("hollow arenas", {
  "the Court's floor is whole and open to the fight's outer ring, with the Singers' spots clear": () => {
    const s = solidAt(COURT_DESIGN);
    for (let x = -26; x <= 26; x++) for (let z = -26; z <= 26; z++) {
      if (Math.hypot(x, z) > CHOIR.fallBands[0] - 1) continue;
      assert(s.has(`${x},-1,${z}`), `floor missing at ${x},${z}`);
      for (let y = 0; y <= 3; y++) assert(!blocks(s, `${x},${y},${z}`) || (Math.hypot(x, z) > 20 && Math.abs(z - 24) < 5), `something stands at ${x},${y},${z}`);
    }
    for (let i = 0; i < 7; i++) {
      const p = singerSpot(i), x = Math.floor(p.x) - COURT.center.x, z = Math.floor(p.z) - COURT.center.z;
      for (const y of [0, 1]) assert(!blocks(s, `${x},${y},${z}`), `singer ${i} spot blocked`);
    }
  },
  "the Court never writes the gate's cells (the seal and openCourtGate own them)": () => {
    const s = solidAt(COURT_DESIGN), gz = COURT.gateZ - COURT.center.z;
    for (let x = -3; x <= 3; x++) for (let y = 0; y <= 8; y++) for (const z of [gz - 1, gz]) assert(!s.has(`${x},${y},${z}`), `gate cell ${x},${y},${z}`);
    assert(COURT_DESIGN.clear.every(([y, z, x0, n]) => !(z >= gz - 1 && y >= 0 && y <= 8 && x0 <= 3 && x0 + n - 1 >= -3)), "clearing opens the gate");
  },
  "the Seat: disc and ring floors, Morvane's spot clear, everything that falls inside the dropped band": () => {
    const s = solidAt(SEAT_DESIGN);
    for (let x = -6; x <= 6; x++) for (let z = -6; z <= 3; z++) if (Math.hypot(x, z) <= 6) assert(s.has(`${x},-1,${z}`), `disc ${x},${z}`);
    for (const y of [0, 1]) assert(!blocks(s, `0,${y},3`), "Morvane's spot");
    for (const [k] of s) {
      const [x, y, z] = k.split(",").map(Number);
      if (Math.hypot(x, z) >= HEART.innerRadius) assert(y >= -8 && y <= 16, `${k} would not fall with its ring`);
    }
  },
});
