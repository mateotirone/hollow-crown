// What the boss fights need from the Drowned Court and the Seat (map/structures/hollow_arenas.py).
import { addTests, assert } from "../core/tests.js";
import { COURT_DESIGN, SEAT_DESIGN, APPROACH_DESIGN } from "./arenas_data.js";
import { heightAt, heartEdge, HEART_EDGE_Z } from "./terrain.js";
import { edgeCarveOps, SEAT_BOX, seatChunksLeft, nearSeatEnd, RANKS_BOX, RANKS_SITE, boxChunksLeft } from "./builder.js";
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
  "the end of the Long Climb: the Seat and the way across are built from one loadable box (Mateo 2026-11-12)": () => {
    // Both designs fit inside SEAT_BOX, so holding it loaded is enough to stamp them.
    for (const [name, D] of [["Seat", SEAT_DESIGN], ["approach", APPROACH_DESIGN]]) {
      for (const [, z, x0, n] of [...D.rows, ...(D.clear ?? [])]) {
        const wx0 = HEART.center.x + x0, wx1 = wx0 + n - 1, wz = HEART.center.z + z;
        assert(wx0 >= SEAT_BOX.x1 && wx1 <= SEAT_BOX.x2 && wz >= SEAT_BOX.z1 && wz <= SEAT_BOX.z2, `${name} row at x ${wx0}..${wx1}, z ${wz} is outside SEAT_BOX`);
      }
    }
    // Box the Seat waits for (chunksBuilt(-40, 2300, 40, 2440)) is inside it too.
    assert(SEAT_BOX.x1 <= -40 && SEAT_BOX.x2 >= 40 && SEAT_BOX.z1 <= 2300 && SEAT_BOX.z2 >= 2440, "the Seat's own wait box is not inside SEAT_BOX");
    const chunks = (Math.floor(SEAT_BOX.x2 / 16) - Math.floor(SEAT_BOX.x1 / 16) + 1) * (Math.floor(SEAT_BOX.z2 / 16) - Math.floor(SEAT_BOX.z1 / 16) + 1);
    assert(chunks <= 100, `a ticking area holds at most 100 chunks; SEAT_BOX is ${chunks}`);
    assert(seatChunksLeft(() => true).length === 0, "nothing left when all is built");
    const left = seatChunksLeft(() => false);
    assert(left.length === chunks && left[0][1] === Math.floor(SEAT_BOX.z1 / 16), "chunks nearest the cliff first");
    assert(nearSeatEnd([{ x: 0, z: HEART_EDGE_Z - 2 }]) && nearSeatEnd([{ x: 30, z: 2200 }]), "someone at the cliff end or coming up the climb");
    assert(!nearSeatEnd([{ x: 0, z: 1600 }]) && !nearSeatEnd([{ x: 600, z: 2320 }]), "not from the Court, nor far out in the open country");
  },
  "the Standing Ranks (Morvane's stage 2) are built from one loadable box (Mateo 2026-11-12)": () => {
    const r = RANKS_SITE;
    assert(RANKS_BOX.x1 <= r.x - r.r && RANKS_BOX.x2 >= r.x + r.r && RANKS_BOX.z1 <= r.z - r.r && RANKS_BOX.z2 >= r.z + r.r, "the box covers the whole site");
    const n = boxChunksLeft(RANKS_BOX, () => false).length;
    assert(n > 0 && n <= 100, `a ticking area holds at most 100 chunks; the Ranks box is ${n}`);
  },
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
      if (Math.hypot(x, z) >= HEART.innerRadius) assert(y >= -8 && y <= 34, `${k} would not fall with its ring`);
    }
  },
  "the cliff before the Seat is ragged, and the story path still reaches its edge": () => {
    const zs = []; for (let x = -150; x <= 150; x++) zs.push(heartEdge(x));
    assert(Math.max(...zs) === HEART_EDGE_Z && Math.min(...zs) <= HEART_EDGE_Z - 20, "no bays");
    let turns = 0; for (let i = 2; i < zs.length; i++) if ((zs[i] - zs[i - 1]) * (zs[i - 1] - zs[i - 2]) < 0) turns++;
    assert(turns > 40, `only ${turns} jags`);
    for (let x = -3; x <= 3; x++) assert(heightAt(x, HEART_EDGE_Z - 1) !== null && heightAt(x, HEART_EDGE_Z) === null, `path spur at ${x}`);
    const ops = edgeCarveOps(40);
    assert(ops.length && ops.every((o) => o.a[2] >= heartEdge(40) && o.b[2] < HEART_EDGE_Z && (o.b[1] - o.a[1] + 1) * (o.b[2] - o.a[2] + 1) < 32768), "carving an old world's edge");
    assert(edgeCarveOps(0).length === 0, "the spur is never dug");
  },
  "the way to the Seat can be walked from the cliff to the ring without a jump, and none of it falls or sits in the land": () => {
    const s = solidAt(APPROACH_DESIGN), seat = solidAt(SEAT_DESIGN), way = APPROACH_DESIGN.way;
    const cy = HEART.center.y, cz = HEART.center.z;
    const floor = (x, y, z) => {
      const n = s.get(`${x},${y},${z}`) ?? seat.get(`${x},${y},${z}`);
      return !!n && !/strands|glimbulb|cluster|lantern|chain|_wall$/.test(n);
    };
    // where feet stand on a column of the way: on its half step if it has one, else on the block
    const feet = ([x, y, z]) => (/_slab$/.test(s.get(`${x},${y + 1},${z}`) ?? "") ? y + 1.5 : y + 1);
    assert(way[0][2] === HEART_EDGE_Z - cz && heightAt(way[0][0], HEART_EDGE_Z - 1) === way[0][1] + cy, "the way starts level with the cliff's edge");
    way.forEach((c, i) => {
      const [x, y, z] = c;
      assert(floor(x, y, z), `no floor at step ${i} (${c})`);
      for (let h = 2; h <= 3; h++) assert(!blocks(s, `${x},${y + h},${z}`), `no headroom at step ${i}`);
      if (i) {
        const [px, , pz] = way[i - 1];
        assert(Math.abs(x - px) + Math.abs(z - pz) === 1, `step ${i} is not beside the last`);
        assert(Math.abs(feet(c) - feet(way[i - 1])) <= 0.5, `a full block's step at ${i}`);
      }
    });
    const [lx, ly, lz] = way[way.length - 1];
    assert(floor(lx, ly, lz + 1) && seat.has(`${lx},${ly},${lz + 1}`) && ly === -1, "the way ends on the Seat's landing");
    for (const [k] of s) {
      const [x, , z] = k.split(",").map(Number);
      assert(Math.hypot(x, z) >= HEART.outerRadius + 2, `${k} is inside the ring that falls`);
      assert(heightAt(x, z + cz) === null, `${k} is inside the land`);
    }
  },
});
