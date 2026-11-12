// Self-tests for the four set pieces after the Reeve: the puzzles, the plans and the rematch rule. All pure and fast.
import { addTests, assert, assertEqual } from "../siege/api.js";
import { makeHunt, huntStep, makePews, pewAnswer, makeStatues, statueStep, makeChangeling, villagerLines, accuse, resting, gladeWave, GLADE_REST_TICKS, BEASTS, AGES, TELLS, VILLAGERS, PEW_ROWS, COOLDOWN_TICKS } from "./puzzles.js";
import { huntPlan, crackCells, HUNT, chapelPlan, chapelInterior, pewStone, inChapel, CHAPEL, vaultPlan, statueAt, doorCells, inVault, VAULT, cradlePlan, rootCells, inCradle, inGlade, GLADE, CRADLE, mirelightPlan } from "./plans.js";
import { socketAnswer } from "./site.js";
import { stampOps } from "./landmarks.js";

const SECRETS = ["Hollow", "Morvane", "Oswin", "truce", "Choir"];
const run = (gen) => { let r; do { r = gen.next(); } while (!r.done); return r.value; };
const flat = () => ({ top: 64, water: undefined, ground: 64 });
const lake = (x, z) => (Math.hypot(x, z) < 40 ? { top: 62, water: 62, ground: 55 } : { top: 66, water: undefined, ground: 66 });
const key = (o) => `${o.dx},${o.dy},${o.dz}`;
const span = (ops, k) => { const v = ops.map((o) => o[k]); return Math.max(...v) - Math.min(...v) + 1; };

addTests("unlocks: sites", {
  "the hunt: same world same rhyme, every beast once, only the rhyme's order wins": () => {
    assertEqual(makeHunt(99), makeHunt(99));
    const firsts = new Set();
    for (let s = 1; s <= 30; s++) {
      const h = makeHunt(s * 7919);
      assertEqual([...h.order].sort(), [0, 1, 2, 3]);
      assertEqual(h.rhyme.length, 4);
      h.order.forEach((b, i) => {
        assertEqual(huntStep(h, i, b), i === 3 ? "horn" : "lit");
        assert(BEASTS[b].says.some((w) => h.rhyme[i].includes(w)), "the line names its beast");
        for (const other of [0, 1, 2, 3]) if (other !== b) assertEqual(huntStep(h, i, other), "wrong");
      });
      firsts.add(h.order[0]);
    }
    assert(firsts.size >= 3, "the first beast moves between worlds");
  },
  "the pews: exactly one gull at the third pew, a decoy gull elsewhere, the ring under the right one": () => {
    for (let s = 1; s <= 40; s++) {
      const p = makePews(s * 31337);
      assertEqual(p.stones.length, PEW_ROWS);
      assertEqual(p.stones[2].filter((c) => c === 0).length, 1, "one gull at the third pew");
      assertEqual(p.stones[2][p.ring.side], 0);
      assert(p.stones.flat().filter((c) => c === 0).length >= 2, "a decoy gull");
      assertEqual(pewAnswer(p, 3, p.ring.side), "ring");
      assertEqual(pewAnswer(p, 3, 1 - p.ring.side), "wrong");
    }
  },
  "the statues: one of each age, inscriptions match, only youngest-first wins": () => {
    for (let s = 1; s <= 30; s++) {
      const st = makeStatues(s * 104729);
      assertEqual([...st.spots].sort(), [0, 1, 2, 3, 4]);
      st.words.forEach((w, spot) => assert(AGES[st.spots[spot]].includes(w)));
      for (let age = 0; age < 5; age++) {
        const spot = st.spots.indexOf(age);
        assertEqual(statueStep(st, age, spot), age === 4 ? "seal" : "turn");
        assertEqual(statueStep(st, age, (spot + 1) % 5), "wrong");
      }
    }
  },
  "the changeling: only the shape shows all three tells, and one other shows two": () => {
    for (let s = 1; s <= 60; s++) {
      const c = makeChangeling(s * 15485863);
      const counts = c.tells.map((t) => ["hand", "wall", "bell"].filter((k) => t[k]).length);
      assertEqual(counts.filter((n) => n === 3).length, 1);
      assertEqual(counts[c.shape], 3);
      assert(counts.some((n, v) => v !== c.shape && n === 2), "a near miss");
      assert(counts.every((n) => n >= 1), "everyone shows something");
      assertEqual(accuse(c, c.shape), "shape");
      assertEqual(accuse(c, (c.shape + 1) % 5), "wrong");
      assertEqual(villagerLines(c, c.shape), [TELLS.hand[0], TELLS.wall[0], TELLS.bell[0]]);
    }
    assertEqual(VILLAGERS.length, 5);
  },
  "nobody in these puzzles says a secret": () => {
    const text = [...BEASTS.flatMap((b) => b.says), ...AGES.flat(), ...Object.values(TELLS).flat(), ...VILLAGERS.map((v) => v.name + v.house)];
    for (let s = 1; s <= 10; s++) text.push(...makeHunt(s).rhyme);
    for (const t of text) for (const w of SECRETS) assert(!t.includes(w), `${w} in "${t}"`);
  },
  "a wrong try rests for five minutes": () => {
    assert(!resting(100, undefined));
    assert(resting(100 + COOLDOWN_TICKS - 1, 100));
    assert(!resting(100 + COOLDOWN_TICKS, 100));
  },
  "the rematch rule": () => {
    const base = { armed: false, holdingKey: true, hasKey: true, scene: false, fighting: false, pending: false, wins: 0, siegesSinceWin: 0, whenOk: true };
    assertEqual(socketAnswer(base), "summon");
    assertEqual(socketAnswer({ ...base, whenOk: false }), "notnow");
    assertEqual(socketAnswer({ ...base, holdingKey: false }), "hold");
    assertEqual(socketAnswer({ ...base, holdingKey: false, hasKey: false }), "empty");
    assertEqual(socketAnswer({ ...base, scene: true }), "busy");
    assertEqual(socketAnswer({ ...base, pending: true }), "waiting");
    assertEqual(socketAnswer({ ...base, fighting: true }), "fighting");
    assertEqual(socketAnswer({ ...base, armed: true, holdingKey: false, wins: 1, siegesSinceWin: 0 }), "stiff");
    assertEqual(socketAnswer({ ...base, armed: true, holdingKey: false, wins: 1, siegesSinceWin: 1 }), "rematch");
    assertEqual(socketAnswer({ ...base, armed: true, holdingKey: false, wins: 1, siegesSinceWin: 1, whenOk: false }), "notnow");
  },
  "Hallowmere: a frozen disc, four cairns on the shore, a closed ring that cracks": () => {
    const h = makeHunt(5);
    for (const [probe, anchor] of [[flat, { x: 0, z: 0, y: 64 }], [lake, { x: 0, z: 0 }]]) {
      const plan = run(huntPlan(probe, anchor, h));
      assert(plan, "a plan");
      assertEqual(plan.info.cairns.length, 4);
      assertEqual(new Set(plan.info.cairns.map((c) => c.beast)).size, 4, "one cairn per beast");
      assert(plan.ops.some((o) => o.block === "siege:hunters_cairn" && o.dx === 0 && o.dz === 0));
      assert(plan.info.warden, "the warden has a spot");
    }
    const cells = crackCells();
    assert(cells.every(([x, z]) => Math.hypot(x, z) > HUNT.arena - 0.5), "the crack is outside the arena");
    const set = new Set(cells.map(([x, z]) => `${x},${z}`));
    for (const [x, z] of cells) assert([[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].some(([a, b]) => set.has(`${x + a},${z + b}`)), "the ring is unbroken");
  },
  "the chapel: closed walls, six rows of stones, an altar, and a dry nave is inside": () => {
    const pews = makePews(11);
    const plan = run(chapelPlan(flat, { x: 0, z: 0, y: 64 }, pews));
    assert(plan, "a plan");
    for (let row = 1; row <= PEW_ROWS; row++) for (const side of [0, 1]) {
      const s = pewStone(row, side);
      assert(plan.ops.some((o) => o.block === "siege:carved_floor" && key(o) === key(s) && o.states["siege:carving"] === pews.stones[row - 1][side]), `stone ${row}/${side}`);
    }
    assert(plan.ops.some((o) => o.block === "siege:drowned_altar" && key(o) === key(CHAPEL.altar)));
    const inside = chapelInterior(plan.info.surfaceDy);
    const cells = new Set(inside.map(([x, y, z]) => `${x},${y},${z}`));
    const last = new Map();
    for (const o of plan.ops) last.set(key(o), o.block);
    const n = CHAPEL.nave;
    for (let y = 1; y <= n.h; y++) for (let z = n.z0; z <= n.z1; z++) {
      assert(!/air|water/.test(last.get(`${n.x1 + 1},${y},${z}`) ?? "air"), `the east wall has a hole at ${y},${z}`);
    }
    for (let x = n.x0; x <= n.x1; x++) assert(!/air|water/.test(last.get(`${x},${n.h + 1},0`) ?? "air"), "the roof");
    assert(cells.size > 500);
    const c = { x: 0, y: 64, z: 0 };
    assert(inChapel(c, { x: 0.5, y: 65, z: 0.5 }));
    assert(!inChapel(c, { x: 0.5, y: 80, z: 0.5 }));
  },
  "the vault: five busts, a seal and a niche in the door wall, a door that opens": () => {
    const plan = run(vaultPlan(flat, { x: 0, z: 0, y: 64 }));
    assert(plan, "a plan");
    const last = new Map();
    for (const o of plan.ops) last.set(key(o), o);
    VAULT.spots.forEach((_, i) => assertEqual(last.get(key(statueAt(i)))?.block, "siege:faceless_bust", `bust ${i}`));
    assertEqual(last.get(key({ dx: VAULT.seal.dx, dy: VAULT.floor + 2, dz: VAULT.seal.dz }))?.block, "siege:vault_seal");
    for (const [x, y, z] of doorCells()) assert(!/air/.test(last.get(`${x},${y},${z}`)?.block ?? "air"), "the door starts shut");
    // the stair reaches the surface from the antechamber
    assert(plan.ops.some((o) => o.dy === 0 && /air/.test(o.block)), "the stair opens at the top");
    const c = { x: 0, y: 64, z: 0 };
    assert(inVault(c, { x: 0.5, y: 64 + VAULT.floor + 1, z: -40 }));
    assert(!inVault(c, { x: 0.5, y: 65, z: -40 }));
    assertEqual(span(plan.ops.filter((o) => o.dy === VAULT.floor), "dx") % 2, 1, "an odd width");
  },
  "the Cradle Tree: a cradle under roots, a ramp down, an odd-sized cave": () => {
    const plan = run(cradlePlan(flat, { x: 0, z: 0, y: 64 }));
    assert(plan, "a plan");
    assert(plan.ops.some((o) => o.block === "siege:root_cradle" && o.dx === 0 && o.dz === 0));
    const ceil = CRADLE.floor + CRADLE.h + 1;
    const roots = new Set(plan.ops.filter((o) => o.block === "minecraft:hanging_roots" && o.dy === ceil - 2).map((o) => `${o.dx},${o.dz}`));
    for (const [x, z] of rootCells()) assert(roots.has(`${x},${z}`), `a root at ${x},${z}`);
    assert(inCradle({ x: 0, y: 64, z: 0 }, { x: 3, y: 64 + CRADLE.floor + 2, z: 3 }));
    assert(!inCradle({ x: 0, y: 64, z: 0 }, { x: 3, y: 66, z: 3 }));
    assertEqual(span(plan.ops.filter((o) => o.dy === CRADLE.floor), "dx") % 2, 1, "an odd width");
  },
  "a landmark stamp becomes ops from the site's centre, air carved last, voids skipped": () => {
    const stamp = { origin: [-2, 0, -1], palette: [{ name: "minecraft:air", states: {} }, { name: "minecraft:stone", states: {} }, { name: "minecraft:structure_void", states: {} }, { name: "minecraft:oak_log", states: { pillar_axis: "y" } }],
      blocks: [[0, 0, 0, 0], [1, 0, 0, 1], [2, 0, 0, 2], [3, 1, 2, 3]] };
    const ops = stampOps(stamp);
    assertEqual(ops.length, 3);
    assertEqual(ops[ops.length - 1], { dx: -2, dy: 0, dz: -1, block: "minecraft:air", states: undefined });
    assertEqual(ops[0], { dx: -1, dy: 0, dz: -1, block: "minecraft:stone", states: undefined });
    assertEqual(ops[1].states, { pillar_axis: "y" });
    assertEqual(stampOps(undefined), []);
  },
  "a big stamp's columns decode to the same cells, gaps skipped": () => {
    const palette = [{ name: "minecraft:air", states: {} }, { name: "minecraft:stone", states: {} }, { name: "minecraft:dirt", states: {} }];
    const ops = stampOps({ origin: [0, 0, 0], palette, cols: { w: 1, data: "0,0,-1:$#!%;2,-3,4:$" } });
    assertEqual(ops.length, 4);
    assertEqual(ops[0], { dx: 0, dy: -1, dz: 0, block: "minecraft:stone", states: undefined });
    assertEqual(ops[1], { dx: 0, dy: 2, dz: 0, block: "minecraft:dirt", states: undefined });
    assertEqual(ops[3], { dx: 0, dy: 0, dz: 0, block: "minecraft:air", states: undefined });
    assertEqual(stampOps({ palette, cols: { w: 2, data: "1,1,0:#$" } })[0].block, "minecraft:stone");
  },
  "the Changeling Glade: a wave when someone walks in, never in a fight, then it rests": () => {
    assert(gladeWave({ players: 1, fighting: false, now: 10, last: undefined }));
    assert(!gladeWave({ players: 0, fighting: false, now: 10, last: undefined }));
    assert(!gladeWave({ players: 2, fighting: true, now: 10, last: undefined }));
    assert(!gladeWave({ players: 1, fighting: false, now: 100 + GLADE_REST_TICKS - 1, last: 100 }));
    assert(gladeWave({ players: 1, fighting: false, now: 100 + GLADE_REST_TICKS, last: 100 }));
    const c = { x: 0, y: 70, z: 0 };
    assert(inGlade(c, { x: 0.5, y: 70, z: GLADE.dz + 0.5 }));
    assert(!inGlade(c, { x: 0.5, y: 70, z: 0.5 }), "the cave is not the glade");
    assert(!inCradle(c, { x: 0.5, y: 70 + CRADLE.floor + 2, z: GLADE.dz + 0.5 }));
    assert(GLADE.dz - GLADE.r > CRADLE.r, "the glade stays clear of the cave");
  },
  "Mirelight: five lantern spots, one per villager": () => {
    const plan = run(mirelightPlan(flat, { x: 0, z: 0, y: 64 }, VILLAGERS));
    assertEqual(plan.info.spots.length, 5);
    assertEqual(new Set(plan.info.spots.map((s) => key(s.npc))).size, 5);
  },
});
