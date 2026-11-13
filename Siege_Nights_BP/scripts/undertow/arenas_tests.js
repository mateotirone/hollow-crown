// What the boss fights need from the Drowned Court and the Seat (map/structures/hollow_arenas.py).
import { addTests, assert } from "../core/tests.js";
import { COURT_DESIGN, SEAT_DESIGN, APPROACH_DESIGN } from "./arenas_data.js";
import { heightAt, heartEdge, roofAt, ROOF, HEART_EDGE_Z } from "./terrain.js";
import { edgeCarveOps, SEAT_BOX, seatChunksLeft, nearSeatEnd, RANKS_BOX, RANKS_SITE, boxChunksLeft } from "./builder.js";
import { CHASM, VAULT_REACH, inChasm, inWall, vaultFrom, vaultFall, rimDepth, floorAt, spireOf, chasmColumn, chasmOps, fallAt } from "./chasm.js";
import { stampCells } from "./stamp.js";
import { COURT, HEART, UNDERTOW_LAYOUT as L } from "./layout.js";
import { singerSpot, CHOIR, waveSize, waveCaptain } from "./choir.js";

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
  "the Court's water stays in its channels: every water block is closed on four sides and below (it once ran over the floor)": () => {
    const all = new Map();
    for (const [x, y, z, i] of stampCells(COURT_DESIGN)) all.set(`${x},${y},${z}`, COURT_DESIGN.palette[i][0]);
    let n = 0;
    for (const [k, b] of all) {
      if (b !== "minecraft:water") continue;
      n++;
      const [x, y, z] = k.split(",").map(Number);
      assert(y < 0, `water at the walking row, ${k}`);
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, -1, 0]]) {
        const o = all.get(`${x + dx},${y + dy},${z + dz}`);
        assert(o && o !== "minecraft:air", `water at ${k} is open toward ${dx},${dy},${dz}`);
      }
    }
    assert(n > 0, "the channels are gone");
  },
  "the Choir's Echo waves grow, never pass the cap, and bring something worse every few waves": () => {
    for (let w = 1; w < 30; w++) {
      assert(waveSize(w + 1, 1) >= waveSize(w, 1), `wave ${w + 1} is smaller than wave ${w}`);
      assert(waveSize(w, 10) <= CHOIR.waveMax, `wave ${w} passes the cap`);
      assert(waveSize(w, 1, true) <= waveSize(w, 1), "a wrecked cart makes waves bigger");
    }
    assert(waveSize(1, 1) === CHOIR.waveBase, "the first wave");
    assert(!waveCaptain(1) && waveCaptain(3) && waveCaptain(10), "captains on waves 3 and 10");
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
  "the chasm under the Seat: a floor everywhere, the pool held in, spires clear of everything above": () => {
    const cz = HEART.center.z;
    assert(inChasm(0, cz) && inChasm(0, HEART_EDGE_Z) && !inChasm(0, HEART_EDGE_Z - 1) && heightAt(0, cz) === null, "where it is");
    let wet = 0, dry = 0;
    const south = [];
    for (let x = CHASM.x0; x <= CHASM.x1; x++) { let z = CHASM.z1; while (z > CHASM.z0 && rimDepth(x, z) <= 0) z--; if (z > CHASM.z0) south.push(z); }
    assert(Math.max(...south) - Math.min(...south) >= 12, "the pit's outer edge is a straight line");
    for (let x = CHASM.x0; x <= CHASM.x1; x += 3) for (let z = CHASM.z0; z <= CHASM.z1; z += 3) {
      if (!inChasm(x, z)) continue;
      const f = floorAt(x, z), col = chasmColumn(x, z);
      assert(f >= CHASM.floorMin && f < CHASM.killY - 4, `floor ${f} at ${x},${z}`);
      assert(col[0][0] === L.floorY && col[0][1] === f - 1, "solid from the world's floor up");
      for (const [y0, y1] of col) assert(y0 <= y1 && y1 < ROOF.shell, `column piece ${y0}..${y1} at ${x},${z}`);
      if (f < CHASM.water) wet++; else dry++;
      // water never stands at the outer edge, where it would pour out into the void
      if (f < CHASM.water) for (const [a, b] of [[1, 0], [-1, 0], [0, 1]]) assert(rimDepth(x + a, z + b) > 0, `the pool reaches the edge at ${x},${z}`);
    }
    assert(wet > dry * 0.5 && dry > wet * 0.1, `pool ${wet}, shoals ${dry}`);
    let spires = 0, tall = 0;
    for (let i = -12; i <= 12; i++) for (let j = 176; j <= 190; j++) {
      const s = spireOf(i, j);
      if (!s) continue;
      spires++;
      assert(s.top <= CHASM.spireTop && s.top - s.base >= 8, `spire ${i},${j} from ${s.base} to ${s.top}`);
      if (Math.hypot(s.x, s.z - cz) < 52 && s.top - s.base > 24) tall++;
    }
    assert(spires > 40 && tall >= 3, `${spires} spires, ${tall} tall ones under the Seat`);
    const lowest = Math.min(...stampCells(APPROACH_DESIGN).map((c) => c[1]), ...stampCells(SEAT_DESIGN).map((c) => c[1])) + HEART.center.y;
    assert(lowest > CHASM.spireTop + 2, `the Seat's rock hangs as low as ${lowest}`);
  },
  "the chasm's falls spring from the cliff and its chunk plans stay inside their chunk": () => {
    let falls = 0;
    for (let x = CHASM.x0; x <= CHASM.x1; x++) {
      const f = fallAt(x);
      if (!f) continue;
      falls++;
      assert(heightAt(x, f.z - 1) > f.mouth + 4 && f.mouth > CHASM.killY + 10, `fall at ${x} from ${f.mouth}`);
    }
    assert(falls >= 8 && fallAt(0) === null, `${falls} columns of falling light`);
    const ops = chasmOps(0, 150);
    assert(ops.length > 256 && ops.every((o) => o.a[0] >= 0 && o.b[0] <= 15 && o.a[2] >= 2400 && o.b[2] <= 2415 && o.a[1] <= o.b[1]), "chunk 0,150");
    assert(chasmOps(0, 100).length === 0, "nothing far from the Seat");
    assert(ops.every((o) => o.a[1] >= L.floorY), "the chasm never reaches down into the Deep, under the world's floor");
  },
  "the cavern: the pit is walled in up to the roof all round, and the wall keeps clear of the Seat": () => {
    const cz = HEART.center.z;
    // walk out from the Seat east, west and south: pool, then the leaning wall, then solid rock up to the roof
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [1, 1], [-1, 1]]) {
      let x = 0, z = cz, met = false;
      for (let n = 0; n < 220 && !met; n++, x += dx, z += dz) {
        if (!inWall(x, z)) { assert(inChasm(x, z), `open void at ${x},${z} before any wall`); continue; }
        const col = chasmColumn(x, z);
        assert(col.length === 1 && col[0][0] === L.floorY && col[0][1] === roofAt(x, z).bottom - 1, `the wall at ${x},${z} stops short of the roof`);
        for (let k = 1; k <= 2; k++) assert(inWall(x + dx * k, z + dz * k) || x + dx * k > CHASM.x1 || x + dx * k < CHASM.x0 || z + dz * k > CHASM.z1, `the wall at ${x},${z} is under three thick`);
        met = true;
      }
      assert(met, `no wall ${dx},${dz} of the Seat`);
    }
    assert(vaultFrom(0, 0, 1) < vaultFrom(0, 0, VAULT_REACH) - 80, "the wall leans in as it climbs");
    for (const d of [SEAT_DESIGN, APPROACH_DESIGN]) for (const [x, , z] of stampCells(d)) assert(rimDepth(x, z + cz) > VAULT_REACH + 3, `the Seat's rock at ${x},${z + cz} is under the leaning wall`);
    let falls = 0;
    for (let x = -46; x <= 46; x++) for (let z = cz + 38; z <= CHASM.z1; z++) if (vaultFall(x, z)) falls++;
    assert(falls >= 3 && falls <= 12, `${falls} falls behind the throne`);
  },
});
