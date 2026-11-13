import { addTests, assert, assertEqual } from "../siege/api.js";
import { CLOCKS, KEEPERS, POSTS, makePuzzle, TOWER_POST, solutions, statementText, clockAnswer, fallbackPuzzle, WRONG_COOLDOWN_TICKS } from "./keepers.js";
import { CLOCKTOWER, WELL, RING, wellOps, chamberOps, stairSteps, spindleOps, drainLayers, plugOps, postOps, postSpot, faceToCenter } from "./well_plan.js";
import { fullPlan, crankAnswer, inChamber, keeperBody, MILLBROOK_SQUARE } from "./reeve.js";
import { CHAPEL } from "../opening/millbrook.js";

const SECRETS = ["Hollow", "Morvane", "Oswin", "truce", "Choir"];
const key = (o) => `${o.dx},${o.dy},${o.dz}`;

addTests("unlocks", {
  "the keepers' puzzle always has exactly one answer, and it is the planted one": () => {
    for (let seed = 1; seed <= 60; seed++) {
      const p = makePuzzle(seed * 2654435761);
      const found = solutions(p.statements, p.layout);
      assertEqual(found.length, 1, `seed ${seed}`);
      assertEqual(found[0], { first: p.first, liar: p.liar }, `seed ${seed}`);
      assertEqual([...p.layout].sort(), [0, 1, 2, 3, 4, 5], "one clock per post");
    }
    assertEqual(solutions(fallbackPuzzle().statements, fallbackPuzzle().layout).length, 1, "the fallback puzzle");
  },
  "with the clocktower pinned, the Tower clock stays in it and the answer is still unique": () => {
    for (let seed = 1; seed <= 40; seed++) {
      const p = makePuzzle(seed * 2654435761, { towerPost: TOWER_POST });
      assertEqual(p.layout[0], TOWER_POST, `seed ${seed}`);
      assertEqual(solutions(p.statements, p.layout).length, 1, `seed ${seed}`);
    }
  },
  "the same world always gets the same puzzle, and different worlds differ": () => {
    assertEqual(makePuzzle(1234), makePuzzle(1234));
    const firsts = new Set();
    for (let s = 1; s <= 40; s++) firsts.add(makePuzzle(s * 7919).first);
    assert(firsts.size >= 4, "the first clock moves between worlds");
  },
  "no keeper names the answer outright when telling the truth, and nobody says a secret": () => {
    for (let seed = 1; seed <= 40; seed++) {
      const p = makePuzzle(seed * 31337);
      p.statements.forEach((s, k) => {
        if (k !== p.liar) assert(s.kind !== "was" && s.kind !== "mine", "an honest keeper hands over the answer");
        const text = statementText(s);
        assert(text.length > 10);
        for (const w of SECRETS) assert(!text.includes(w), w);
      });
    }
    for (const k of KEEPERS) for (const w of SECRETS) assert(!k.hello.includes(w), w);
    assertEqual(CLOCKS.length, 6);
    assertEqual(POSTS.length, 6);
  },
  "the keeper's page repeats what the others said": () => {
    const p = makePuzzle(99);
    const body = keeperBody(2, [0, 2, 4], p.statements);
    assert(body.includes(KEEPERS[0].name) && body.includes(KEEPERS[4].name) && body.includes(statementText(p.statements[2])));
  },
  "clicking clocks: the first gives the key once, wrong ones rest you": () => {
    assertEqual(clockAnswer({ clock: 2, first: 2, wound: false, now: 100 }), "key");
    assertEqual(clockAnswer({ clock: 2, first: 2, wound: true, now: 100 }), "empty");
    assertEqual(clockAnswer({ clock: 1, first: 2, wound: false, now: 100 }), "wrong");
    assertEqual(clockAnswer({ clock: 2, first: 2, wound: false, now: 100, lastWrong: 50 }), "rest");
    assertEqual(clockAnswer({ clock: 2, first: 2, wound: false, now: 100 + WRONG_COOLDOWN_TICKS, lastWrong: 100 }), "key");
  },
  "the crank: summon with the key, rematch only after a siege night": () => {
    const base = { wound: false, holdingKey: false, hasKey: false, scene: false, fighting: false, pending: false, siegesSinceWin: 0, wins: 0 };
    assertEqual(crankAnswer(base), "keyhole");
    assertEqual(crankAnswer({ ...base, hasKey: true }), "hold");
    assertEqual(crankAnswer({ ...base, holdingKey: true, hasKey: true }), "summon");
    assertEqual(crankAnswer({ ...base, wound: true, pending: true }), "waiting");
    assertEqual(crankAnswer({ ...base, wound: true, wins: 1, siegesSinceWin: 0 }), "stiff");
    assertEqual(crankAnswer({ ...base, wound: true, wins: 1, siegesSinceWin: 1 }), "rematch");
    assertEqual(crankAnswer({ ...base, wound: true, fighting: true }), "fighting");
    assertEqual(crankAnswer({ ...base, wound: true }), "rematch", "a fight lost before any win can be tried again");
  },
  "the stair walks from the square to the chamber floor in half steps with headroom": () => {
    const steps = stairSteps();
    const surface = (o) => o.dy + (o.states["minecraft:vertical_half"] === "top" ? 1 : 0.5);
    assertEqual(surface(steps[0]), 0.5, "the first step is half a block under the square");
    for (let i = 1; i < steps.length; i++) assertEqual(surface(steps[i - 1]) - surface(steps[i]), 0.5, `step ${i}`);
    assertEqual(surface(steps[steps.length - 1]) - 0.5, WELL.floorY + 1, "the last step is half a block over the floor");
    for (const s of steps) assert(RING.some(([x, z]) => x === s.dx && z === s.dz), "steps stay round the spindle");
    for (let i = 8; i < steps.length; i++) assert(surface(steps[i - 8]) - surface(steps[i]) >= 3.5, "room to stand under the step above");
    const spindle = spindleOps();
    assert(spindle.every((o) => o.dx === 0 && o.dz === 0) && spindle.length === -WELL.floorY, "the spindle runs floor to square");
  },
  "the well drains top first, and the plug opens only the ring round the spindle": () => {
    const layers = drainLayers();
    assertEqual(layers.length, 1 - WELL.shaftBottom);
    assertEqual(layers[0][0].dy, 0);
    assert(layers.every((l) => l.length === 9));
    assertEqual(plugOps().length, 8);
    const water = wellOps().filter((o) => o.block === "minecraft:water").length;
    assertEqual(water, 9 * layers.length, "every water block gets drained");
  },
  "the chamber is a closed room, 8 high, wider than the fight needs": () => {
    const ops = chamberOps();
    const air = ops.filter((o) => o.block === "minecraft:air");
    const heights = new Set(air.map((o) => o.dy));
    assertEqual(heights.size, 8);
    assert(air.every((o) => Math.hypot(o.dx, o.dz) <= WELL.roomR));
    const solid = new Set(ops.filter((o) => o.block !== "minecraft:air").map(key));
    for (const o of air) {
      if (Math.hypot(o.dx, o.dz) + 1.5 <= WELL.roomR) continue;
      for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = { dx: o.dx + x, dy: o.dy, dz: o.dz + z };
        if (Math.hypot(n.dx, n.dz) > WELL.roomR) assert(solid.has(key(n)), `a hole in the wall at ${key(n)}`);
      }
    }
    assert(inChamber({ x: MILLBROOK_SQUARE.x + 3, y: 100 + WELL.floorY + 1, z: MILLBROOK_SQUARE.z }, { ...MILLBROOK_SQUARE, y: 100 }));
    assert(!inChamber({ x: MILLBROOK_SQUARE.x + 3, y: 101, z: MILLBROOK_SQUARE.z }, { ...MILLBROOK_SQUARE, y: 100 }), "standing in the square is not below");
  },
  "the set piece keeps clear of Wren's chapel, stays in Millbrook, and is an odd size": () => {
    const plan = fullPlan(makePuzzle(7));
    const inChapel = (o) => {
      const x = MILLBROOK_SQUARE.x + o.dx, z = MILLBROOK_SQUARE.z + o.dz;
      return x >= CHAPEL.x0 && x <= CHAPEL.x1 && z >= CHAPEL.z0 && z <= CHAPEL.z1;
    };
    for (const o of plan.ops) {
      if (o.dy < 0) continue;
      assert(!inChapel(o), `touches Wren's chapel at ${key(o)}`);
      assert(Math.hypot(o.dx, o.dz) < 60, "inside Millbrook");
    }
    for (const post of plan.posts) {
      assert(!inChapel(post.keeper), "a keeper stands in the chapel");
      assertEqual(faceToCenter(post.clock.dx, post.clock.dz), post.face);
    }
    const xs = wellOps().map((o) => o.dx);
    assertEqual((Math.max(...xs) - Math.min(...xs) + 1) % 2, 1);
    assertEqual(new Set(POSTS.map((_, i) => key({ ...postSpot(i), dy: 0 }))).size, 6, "six separate posts");
    assert(!plan.ops.some((o) => o.dy >= 0 && /bell/.test(o.block)), "Millbrook rings no bells");
    const high = postOps(CLOCKTOWER.post, true, "x", { clocktower: true });
    assertEqual(high.ops.length, 1, "in the clocktower the Tower clock is just its clock");
    assertEqual(high.clock, CLOCKTOWER.clock);
    assertEqual(key({ ...postSpot(CLOCKTOWER.post), dy: 0 }), "10,0,0", "the clocktower stands over the east street");
    assertEqual(TOWER_POST, CLOCKTOWER.post);
    const tower = postOps(0, true, "x");
    assert(tower.ops.some((o) => o.dy === 7), "the Tower clock stands taller");
  },
});
