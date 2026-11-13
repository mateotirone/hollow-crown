// Trains self-tests (the pure ones run offline too).

import { BlockTypes, EntityTypes, ItemTypes } from "@minecraft/server";
import { addTests, assert, assertEqual } from "../siege/api.js";
import { SHAPES, layTrack, cursorOn, advance, back, pointAt, follow, KINDS, curvePoints, switchSetting, shapeOf, DX, DZ } from "./track.js";
import { stageFor, stationPlan, siteFor, lineBlocks, loopBlocks, rightOf, STAGES, STATION, LOOP_Z, BUFFER } from "./stations.js";
import { ROUTE, reachable, buyable, cannotBuy, priceOf, nearestStop, checkRoutes, stopSite, pieces, isNatural, deadEndAt } from "./routes.js";
import { ROUTES } from "./routes_data.js";
import { layBed, trackFits, fellTree, rise, BED, layCrossing } from "./rail_bed.js";
import { railRefused } from "./no_hollow.js";
import { STATION_DESIGNS, TRADE_HOUSE_DESIGNS, ENGINE_SHED_DESIGNS } from "../settle/station_data.js";
import { LINE, chainsOf, nextStop, newService, stepUnseen, indexNear, pilot } from "./line_service.js";
import { TRACK, CARS, TRAIN, carPoses, trainLength, stepSpeed, moveTrain, limitAhead, blocksUnder, clearAhead, speedForGap, shapesForLoop, showcaseLoop } from "./data.js";

// A little fake world of track: lay(x, y, z, yaw) places a piece the way a player would
function yard() {
  const blocks = new Map();
  const get = (x, y, z) => blocks.get(`${x},${y},${z}`);
  const lay = (x, y, z, yaw = 0) => {
    const r = layTrack({ x, y, z }, yaw, get);
    blocks.set(`${x},${y},${z}`, r.shape);
    for (const u of r.updates) blocks.set(`${u.x},${u.y},${u.z}`, u.shape);
    return r.shape;
  };
  return { get, lay, blocks };
}
const links = (s) => [...s.links].sort((a, b) => a - b).join(",");

// A little planned railway: A - B - C in a line, and a branch B - D
function routeMap() {
  const stop = (id, x) => ({ id, name: id, x, y: 64, z: 0, kind: "plot" });
  const seg = (id, from, to, x0, x1) => ({ id, line: "main", from, to, blocks: Array.from({ length: x1 - x0 + 1 }, (_, i) => [x0 + i, 64, 0, 0, 2]), length: x1 - x0 + 1 });
  return {
    stops: [stop("A", 0), stop("B", 300), stop("C", 600), { ...stop("D", 300), z: 300 }],
    segments: [seg("AB", "A", "B", 0, 300), seg("BC", "B", "C", 300, 600), { ...seg("BD", "B", "D", 0, 0), blocks: [[300, 64, 1, 0, 0]] }],
  };
}

// Blocks of a design that touch nothing (not even corner to corner) on a path down to the ground layer (y <= 0)
function floatingBlocks(d) {
  const solid = new Set();
  for (const [y, z, x0, n, i] of d.rows) if (d.palette[i][0] !== "minecraft:air") for (let x = x0; x < x0 + n; x++) solid.add(`${x},${y},${z}`);
  const seen = new Set(), q = [];
  for (const k of solid) if (+k.split(",")[1] <= 0) { seen.add(k); q.push(k); }
  while (q.length) {
    const [x, y, z] = q.pop().split(",").map(Number);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
      const k = `${x + a},${y + b},${z + c}`;
      if (solid.has(k) && !seen.has(k)) { seen.add(k); q.push(k); }
    }
  }
  return [...solid].filter((k) => !seen.has(k));
}

addTests("trains", {
  "routes: you buy one stop at a time, outward from home": () => {
    const data = routeMap();
    const built = {};
    assertEqual(checkRoutes(data).length, 0);
    assertEqual(buyable(data, built, "A").map((o) => o.seg.id).join(), "AB", "only the stretch from home at first");
    assert(cannotBuy(data, built, "A", "BC"), "no A to C without B");
    built.AB = { by: "p1" };
    assertEqual([...reachable(data, built, "A")].sort().join(), "A,B");
    assertEqual(buyable(data, built, "A").map((o) => o.seg.id).sort().join(), "BC,BD");
    assertEqual(cannotBuy(data, built, "A", "BC"), undefined);
    assertEqual(buyable(data, built, "C").length, 1, "someone at C can build toward B");
    assertEqual(buyable(data, built, "C")[0].from, "C");
    assert(cannotBuy(data, built, undefined, "AB"), "no home, no buying");
    assert(cannotBuy(data, built, "A", "AB"), "already laid");
  },
  "switches: a train off a branch sets the switch, one heading in keeps it": () => {
    const straight = shapeOf(0, 2), bend = SHAPES.find((sh) => sh.kind === 1 && sh.links.includes(2) && !sh.links.includes(6));
    const shapes = [straight, bend];
    assertEqual(switchSetting(shapes, 0, 2), 0, "from the shared side: as set");
    assertEqual(switchSetting(shapes, 1, 2), 1, "from the shared side: as set, the other way");
    assertEqual(switchSetting(shapes, 0, bend.links.find((l) => l !== 2)), 1, "off the branch: set for it");
    assertEqual(switchSetting(shapes, 1, 6), 0, "off the straight: set for it");
    assertEqual(switchSetting(shapes, 0, 0), -1, "not through the switch");
  },
  "routes: every overlap between two stretches parts at a switch the track can hold": () => {
    // where two planned stretches share a block with different shapes, both shapes share a link (the shared side)
    const at = new Map();
    for (const seg of ROUTES.segments) for (const [x, y, z, kind, dir] of seg.blocks) {
      const k = `${x},${y},${z}`;
      const here = shapeOf(kind, dir);
      for (const other of at.get(k) ?? []) {
        if (other.kind === kind && other.dir === dir) continue;
        const o = shapeOf(other.kind, other.dir);
        const crossing = kind === 0 && other.kind === 0 && dir % 2 === 0 && other.dir % 2 === 0; // a diamond: the train sets it too
        assert(crossing || here.links.some((l) => o.links.includes(l)), `${seg.id} at ${k}: two shapes with no shared side`);
      }
      at.set(k, [...(at.get(k) ?? []), { kind, dir }]);
    }
  },
  "routes: the bed digs through ground and trees, never through buildings": () => {
    for (const id of ["minecraft:stone", "minecraft:grass_block", "minecraft:oak_log", "minecraft:spruce_leaves", "siege:old_acacia_log", "minecraft:white_terracotta", "minecraft:iron_ore", "minecraft:short_grass"]) assert(isNatural(id), id);
    for (const id of ["minecraft:oak_planks", "minecraft:stone_bricks", "minecraft:cobblestone", "minecraft:glass", "minecraft:stripped_oak_log", "siege:castle_stone", "minecraft:stone_brick_stairs", "minecraft:oak_fence", "minecraft:torch"]) assert(!isNatural(id), id);
  },
  "routes: the bed is graded, never a trench, and trees on the line come down whole": () => {
    // grass at y 64 (track sits at 65), with a rise to 65 on the north side and a tree, a road and a house on the line
    const blocks = new Map();
    const w = {
      get: (x, y, z) => (Math.abs(x) > 40 || Math.abs(z) > 40 ? undefined : blocks.get(`${x},${y},${z}`) ?? (y <= 60 ? "minecraft:stone" : y > (z < -3 ? 65 : 64) ? "minecraft:air" : y === (z < -3 ? 65 : 64) ? "minecraft:grass_block" : "minecraft:dirt")),
      set: (x, y, z, id) => blocks.set(`${x},${y},${z}`, id),
    };
    // the ground is a block above the track's bed all along (track y 64: the bed is 63)
    const all = Array.from({ length: 31 }, (_, i) => ({ x: i - 15, y: 64, z: 0, kind: 0, dir: 2 }));
    // a tree on the line at x 0: trunk, branch of fences, leaves, a root of stairs sunk into the ground
    for (let y = 65; y <= 69; y++) w.set(0, y, 0, "minecraft:oak_log");
    w.set(1, 68, 0, "minecraft:oak_fence"); w.set(2, 68, 1, "minecraft:oak_fence");
    for (let dx = -1; dx <= 3; dx++) for (let dz = -1; dz <= 2; dz++) w.set(dx, 70, dz, "minecraft:oak_leaves");
    w.set(0, 64, 0, "minecraft:dark_oak_stairs");
    // a road crossing at x 8 (path surface), a house wall at x -10, 2 north of the line
    for (let dz = -6; dz <= 6; dz++) w.set(8, 64, dz, "minecraft:grass_path");
    w.set(-10, 65, -2, "minecraft:oak_planks"); w.set(-10, 66, -2, "minecraft:oak_planks");
    const hits = [];
    all.forEach((p, i) => { assert(layBed(w, all, i, (...a) => hits.push(a)), `piece ${i} laid`); assert(trackFits(w, all[i]), `track fits at ${i}`); w.set(p.x, p.y, p.z, "siege:track"); });
    for (const p of all) {
      assertEqual(w.get(p.x, 63, p.z), "minecraft:gravel", `ballast under ${p.x}`);
      for (let dz = -1; dz <= 1; dz++) for (let y = 64 + (dz ? 0 : 1); y < 68; y++) assertEqual(w.get(p.x, y, dz), "minecraft:air", `clear over the bed at ${p.x} ${y} ${dz}`);
      // beside the ballast the ground is level with it, then rises one per two out: no trench wall
      for (const s of [1, -1]) for (let d = 2; d <= 5; d++) {
        let top = 70; while (top > 55 && !/grass|dirt|stone|path/.test(w.get(p.x, top, s * d) ?? "")) top--;
        assert(top <= 63 + rise(d), `no trench wall at ${p.x}, ${s * d}: ground ${top}`);
      }
    }
    // the tree is gone, every bit of it, and its root left no pit
    for (const [k, v] of blocks) assert(!/oak_(log|fence|leaves)|stairs/.test(v), `tree block left at ${k}: ${v}`);
    // the road crossing kept its surface beside the bed, the house is untouched and reported
    assertEqual(w.get(8, 64, 4), "minecraft:grass_path", "road surface beside the bed");
    assertEqual(w.get(-10, 65, -2), "minecraft:oak_planks", "house left standing");
    assert(BED.side >= 5 && rise(2) === 0 && rise(3) === 1, "banks: level beside the ballast, then 1 in 2");
    // a tree touching a building is not a tree to fell
    const yard2 = new Map([["0,65,0", "minecraft:oak_log"], ["0,66,0", "minecraft:oak_leaves"], ["1,66,0", "minecraft:oak_planks"]]);
    const w2 = { get: (x, y, z) => yard2.get(`${x},${y},${z}`) ?? (y <= 64 ? "minecraft:dirt" : "minecraft:air"), set: (x, y, z, id) => yard2.set(`${x},${y},${z}`, id) };
    assertEqual(fellTree(w2, 0, 65, 0), false, "a tree against a building stays");
    assertEqual(w2.get(0, 65, 0), "minecraft:oak_log", "and is untouched");
  },
  "routes: a level crossing lays its boards, setts, lamp posts and keeper's hut on the graded ground": () => {
    const blocks = new Map();
    const w = {
      get: (x, y, z) => (Math.abs(x) > 30 || Math.abs(z) > 30 ? undefined : blocks.get(`${x},${y},${z}`) ?? (y < 64 ? "minecraft:dirt" : y === 64 ? (Math.abs(x) <= 2 ? "minecraft:grass_path" : "minecraft:grass_block") : y === 65 && x === 7 && z === 7 ? "minecraft:short_grass" : "minecraft:air")),
      set: (x, y, z, id) => blocks.set(`${x},${y},${z}`, id),
    };
    const all = Array.from({ length: 21 }, (_, i) => ({ x: i - 10, y: 65, z: 0, kind: 0, dir: 2 }));
    all.forEach((p, i) => { layBed(w, all, i, () => {}); w.set(p.x, p.y, p.z, "siege:track"); });
    const c = {
      deck_block: "spruce_planks", deck: [[0, 0, 64], [0, 1, 64], [0, -1, 64]], road: [[0, 3, 64, "cobblestone"]],
      posts: [[3, 3, 64, ["stone_brick_wall", "birch_fence", "lantern"]]],
      hut: { x: 7, z: 7, y: 65, half: 1, plinth: "minecraft:cobblestone", blocks: [[0, 0, 0, "minecraft:cobblestone"], [0, 1, 0, "minecraft:oak_planks"]] },
    };
    assert(layCrossing(w, c, () => {}), "laid");
    assertEqual(w.get(0, 64, 0), "minecraft:spruce_planks", "boards under the track");
    assertEqual(w.get(0, 64, 3), "minecraft:cobblestone", "setts on the road");
    assertEqual(w.get(3, 65, 3), "minecraft:stone_brick_wall", "post base on the ground");
    assertEqual(w.get(3, 67, 3), "minecraft:lantern", "lamp on top");
    assertEqual(w.get(7, 66, 7), "minecraft:oak_planks", "hut on the highest block, grass under it cleared");
    const n = blocks.size;
    assert(layCrossing(w, c, () => {}), "laid again");
    assertEqual(blocks.size, n, "laying it twice changes nothing");
    assertEqual(w.get(3, 68, 3), "minecraft:air", "no second post on the first");
  },
  "routes: a settlement's station sits on its stop, building toward the banner": () => {
    const data = routeMap();
    const s = stopSite(data, { x: 10, z: 40 });
    assertEqual(s.stop.id, "A");
    assertEqual(JSON.stringify(s.origin), JSON.stringify({ x: 0, y: 64, z: 0 }));
    assertEqual(JSON.stringify(s.forward), JSON.stringify({ x: 0, z: 1 }), "east-west line, banner to the south");
    assertEqual(stopSite(data, { x: 10, z: -40 }).forward.z, -1);
    assertEqual(stopSite(data, { x: 5000, z: 0 }), undefined, "no stop near");
    for (const stop of ROUTES.stops.filter((st) => st.kind === "plot")) assert(stopSite(ROUTES, { x: stop.x + 30, z: stop.z + 30 }), `${stop.id} has straight track under it`);
  },
  "routes: prices, home stops and map checks": () => {
    const data = routeMap();
    assertEqual(priceOf(data.segments[0]), ROUTE.basePrice + 301 * ROUTE.perBlock);
    assertEqual(nearestStop(data, 20, 30).id, "A");
    assertEqual(nearestStop(data, 2000, 0), undefined);
    const bad = { stops: data.stops, segments: [...data.segments, { id: "AB", from: "A", to: "Z", blocks: [] }] };
    assert(checkRoutes(bad).length >= 3, "a doubled id, an unknown stop and no track are caught");
    const custom = { ...data.segments[0], works: [[0, 0, 60, 63, 1]], works_palette: [{ name: "minecraft:air" }, { name: "minecraft:stone" }], custom: [[10, 20]] };
    assertEqual(checkRoutes({ stops: data.stops, segments: [custom] }).length, 0);
    const p = pieces(custom);
    assert(p[15].works && !p[9].works && !p[21].works, "only the custom range skips the plain bed");
    assert(pieces({ ...custom, custom: undefined })[0].works, "works without ranges cover the whole stretch");
    assert(checkRoutes({ stops: data.stops, segments: [{ ...custom, custom: [[5, 9999]] }] }).length, "a range past the end is caught");
    const [bx, by, bz] = custom.blocks[0];
    assert(checkRoutes({ stops: data.stops, segments: [{ ...custom, works: [[bx, bz, by - 3, by, 1]] }] }).length, "a solid work in a track cell is caught");
    assertEqual(checkRoutes({ stops: data.stops, segments: [{ ...custom, works: [[bx, bz, by - 3, by - 1, 1], [bx, bz, by, by + 5, 0]] }] }).length, 0, "works under and clear air over the track are fine");
  },

  "stations: nothing floats (roofs sit on their beams, lanterns hang from something)": () => {
    const all = [
      ...Object.entries(STATION_DESIGNS).flatMap(([r, st]) => Object.entries(st).map(([s, d]) => [`${r} ${s}`, d])),
      ...Object.entries(TRADE_HOUSE_DESIGNS).flatMap(([r, st]) => Object.entries(st).map(([s, d]) => [`${r} trade house ${s}`, d])),
      ...Object.entries(ENGINE_SHED_DESIGNS).map(([r, d]) => [`${r} engine shed`, d]),
    ];
    for (const [name, d] of all) {
      const f = floatingBlocks(d);
      assert(!f.length, `${name}: ${f.length} block(s) float, first at ${f[0]}`);
    }
  },

  "trains keep apart: one sees another on its track ahead and may only go as fast as lets it stop short": () => {
    const { get, lay } = yard();
    for (let x = 0; x <= 60; x++) lay(x, 0, 0, -90); // an east-west line
    const cars = [{ kind: "engine" }, { kind: "coach" }];
    const front = cursorOn({ x: 40, y: 0, z: 0 }, get(40, 0, 0), -90); // heading east
    const taken = blocksUnder(front, cars, get);
    assert(taken.has("40,0,0") && taken.has("30,0,0") && !taken.has("41,0,0") && !taken.has("24,0,0"), "it holds the blocks under its length");
    const behind = cursorOn({ x: 10, y: 0, z: 0 }, get(10, 0, 0), -90);
    const gap = clearAhead(behind, 40, get, taken);
    assert(gap > 13 && gap < 17, `the train behind sees it about 15 ahead (got ${gap})`);
    assertEqual(clearAhead(behind, 8, get, taken), Infinity, "too far to matter yet");
    assertEqual(clearAhead(front, 30, get, taken), Infinity, "its own blocks are passed in separately, and nothing is ahead of it");
    assertEqual(speedForGap(Infinity), Infinity);
    assertEqual(speedForGap(TRAIN.keepApart), 0, "stopped once it is this close");
    const v = speedForGap(gap);
    assert(v > 0 && (v * v) / (2 * TRAIN.brake) <= gap - TRAIN.keepApart, "from that speed it can stop in time");
  },

  "routes: the planned railway has no mistakes, and no works stand in a train's way": () => {
    const problems = checkRoutes(ROUTES);
    assert(!problems.length, problems[0]);
    const seg = { id: "t", from: "A", to: "B", blocks: [[0, 64, 0, 0, 0], [0, 64, 1, 0, 0]], works: [[1, 0, 64, 65, 1]], works_palette: [{ name: "minecraft:air" }, { name: "minecraft:stone" }] };
    const stops = [{ id: "A", x: 0, y: 64, z: 0 }, { id: "B", x: 0, y: 64, z: 1 }];
    assert(checkRoutes({ stops, segments: [seg] }).some((p) => p.includes("train's body")), "a parapet right beside the track is caught");
    assertEqual(checkRoutes({ stops, segments: [{ ...seg, works: [[2, 0, 64, 65, 1], [0, 0, 68, 70, 1]] }] }).length, 0, "two out and four up is fine");
    assertEqual(checkRoutes({ stops, segments: [{ ...seg, works: [[1, 0, 64, 65, 1], [1, 0, 64, 67, 0]] }] }).length, 0, "cleared again by a later work is fine");
  },

  "stations: the passing loop leaves the line at one end, runs beside the platform and rejoins at the other": () => {
    assertEqual(loopBlocks(stationPlan("vale", "halt"), { x: 0, y: 64, z: 0 }, { x: 0, z: 1 }).length, 0, "a Halt is single track");
    for (const forward of [{ x: 0, z: 1 }, { x: 0, z: -1 }, { x: 1, z: 0 }, { x: -1, z: 0 }]) {
      for (const stage of ["station", "junction", "grand"]) {
        const plan = stationPlan("vale", stage), origin = { x: 100, y: 64, z: -40 };
        const blocks = new Map(), get = (x, y, z) => blocks.get(`${x},${y},${z}`);
        const line = lineBlocks(plan, origin, forward), loop = loopBlocks(plan, origin, forward);
        for (const b of line) blocks.set(`${b.x},${b.y},${b.z}`, shapeOf(0, b.dir));
        assert(loop.length > 20 && loop[0].end && loop.at(-1).end && loop.filter((b) => b.end).length === 2, "two ends");
        for (const b of loop) {
          assert(shapeOf(b.kind, b.dir), "a real track shape");
          if (b.end) assert(blocks.has(`${b.x},${b.y},${b.z}`), "each end sits on the line");
          else assert(!blocks.has(`${b.x},${b.y},${b.z}`), "the rest is off the line");
          blocks.set(`${b.x},${b.y},${b.z}`, shapeOf(b.kind, b.dir)); // both switches set for the loop
        }
        const far = Math.max(...loop.map((b) => Math.abs((b.x - origin.x) * forward.x + (b.z - origin.z) * forward.z)));
        assertEqual(far, -LOOP_Z, "it runs this far from the line, on the side away from the building");
        assert(loop.every((b) => (b.x - origin.x) * forward.x + (b.z - origin.z) * forward.z <= 0), "never on the building's side");
        // ride it: from the line's first block, through the loop, out onto the line's last block
        const end = loop[0], last = loop.at(-1), s0 = get(end.x, end.y, end.z);
        const inward = DX.findIndex((dx, d) => end.x + dx === line[1].x - (line[0].x - end.x) && end.z + DZ[d] === line[1].z - (line[0].z - end.z));
        const from = (inward + 4) % 8; // it comes in from outside the station
        let c = { x: end.x, y: end.y, z: end.z, from, to: s0.links[0] === from ? s0.links[1] : s0.links[0], t: 0 };
        const seen = new Set();
        for (let i = 0; i < 200 && !(c.x === last.x && c.z === last.z); i++) {
          const r = advance(c, 0.5, get);
          assert(!r.blocked, `the loop is joined all the way (${stage}, stuck at ${c.x},${c.z})`);
          c = r.cursor;
          seen.add(`${c.x},${c.y},${c.z}`);
        }
        assert(c.x === last.x && c.z === last.z, "it comes out at the far end");
        assert(loop.every((b) => seen.has(`${b.x},${b.y},${b.z}`)), "by way of every loop block");
      }
    }
  },

  "no rail goes down in the Hollow": () => {
    for (const id of [TRACK, "hc:station_post", "siege:rail_depot", "minecraft:rail", "minecraft:golden_rail"]) {
      assert(railRefused("siege:undertow", id), `${id} is refused in the Hollow`);
      assert(!railRefused("minecraft:overworld", id), `${id} is fine in the overworld`);
    }
    assert(!railRefused("siege:undertow", "minecraft:cobblestone"), "other blocks are fine");
  },

  "there are 20 track shapes and none repeats": () => {
    assertEqual(SHAPES.length, 20);
    assertEqual(new Set(SHAPES.map((s) => `${s.kind}:${s.dir}`)).size, 20);
    assertEqual(new Set(SHAPES.map((s) => `${links(s)}:${s.up}`)).size, 20);
  },
  "a straight line joins up, and turns through a bend onto a diagonal": () => {
    const { get, lay } = yard();
    for (let x = 0; x < 4; x++) lay(x, 0, 0, -90);
    lay(4, 0, 1);
    lay(5, 0, 2);
    assertEqual(links(get(1, 0, 0)), "2,6");
    assertEqual(KINDS[get(3, 0, 0).kind], "bend");
    assertEqual(KINDS[get(4, 0, 1).kind], "straight");
    assert(follow({ x: 3, y: 0, z: 0 }, get(3, 0, 0), 3, get), "the bend leads onto the diagonal");
  },
  "track climbs a slope": () => {
    const { get, lay } = yard();
    lay(0, 0, 0, -90);
    lay(1, 0, 0, -90);
    lay(2, 1, 0, -90);
    lay(3, 1, 0, -90);
    assertEqual(KINDS[get(1, 0, 0).kind], "slope");
    const c = cursorOn({ x: 0, y: 0, z: 0 }, get(0, 0, 0), -90);
    const r = advance(c, 50, get);
    assert(r.blocked && r.cursor.x === 3 && r.cursor.y === 1, "rode up to the top end");
    const top = pointAt(r.cursor, get(3, 1, 0));
    assert(Math.abs(top.y - 1.25) < 1e-9, `wheels on the upper rails, got ${top.y}`);
  },
  "a cursor walks forward and back the same way": () => {
    const { get, lay } = yard();
    for (let x = 0; x < 10; x++) lay(x, 0, 0, -90);
    const c = cursorOn({ x: 5, y: 0, z: 0 }, get(5, 0, 0), -90);
    const f = advance(c, 2.3, get).cursor;
    const b = back(f, 2.3, get).cursor;
    assertEqual([b.x, b.to], [c.x, c.to]);
    assert(Math.abs(b.t - c.t) < 1e-9, "same spot");
  },
  "the showcase loop is closed and every piece is a real shape": () => {
    const pts = showcaseLoop();
    const shapes = shapesForLoop(pts);
    assert(shapes.every(Boolean), "every piece has a shape");
    const map = new Map(pts.map((p, i) => [`${p.x},${p.y},${p.z}`, shapes[i]]));
    const get = (x, y, z) => map.get(`${x},${y},${z}`);
    const c = cursorOn(pts[0], shapes[0], -90);
    const r = advance(c, 500, get);
    assert(!r.blocked, "a train can go round and round");
  },
  "a train fits on the loop, faces along the track, and moves": () => {
    const pts = showcaseLoop();
    const shapes = shapesForLoop(pts);
    const map = new Map(pts.map((p, i) => [`${p.x},${p.y},${p.z}`, shapes[i]]));
    const get = (x, y, z) => map.get(`${x},${y},${z}`);
    const cars = [{ kind: "engine" }, { kind: "coach" }];
    const head = cursorOn(pts[14], shapes[14], -90);
    const poses = carPoses(head, cars, get);
    assertEqual(Math.round(poses[0].yaw), -90); // facing east
    assert(poses[0].x > poses[1].x, "the coach is behind the engine");
    assert(Math.abs(trainLength(cars) - (CARS.engine.length + CARS.coach.length + 0.6)) < 1e-9, "length");
    const m = moveTrain(head, cars, 0.5, get);
    assert(m.v === 0.5 && m.head.x === head.x, "moved half a block");
  },
  "speed: throttle, brakes, corners and the end of the line": () => {
    let v = 0;
    for (let i = 0; i < 400; i++) v = stepSpeed(v, 1);
    assertEqual(v, TRAIN.maxSpeed);
    v = stepSpeed(v, 0, { limit: 0.28 });
    assert(v < TRAIN.maxSpeed, "brakes for a corner");
    for (let i = 0; i < 100; i++) v = stepSpeed(v, -1);
    assert(v < 0 && v >= -TRAIN.reverseSpeed, "stops, then backs up slowly");
    const { get, lay } = yard();
    for (let x = 0; x < 3; x++) lay(x, 0, 0, -90);
    lay(2, 0, 1, 0);
    lay(2, 0, 2, 0);
    assertEqual(KINDS[get(2, 0, 0).kind], "corner");
    const corner = { x: 0, y: 0, z: 0, from: 6, to: 2, t: 0.5 };
    assert(limitAhead(corner, 10, get) <= 1, "sees the turn ahead");
    const end = moveTrain(cursorOn({ x: 1, y: 0, z: 0 }, get(1, 0, 0), -90), [{ kind: "engine" }], 20, get);
    assertEqual(end.v, 0);
  },
  "stations: one per settlement size, the line through the platform, nothing built on the track side": () => {
    assertEqual(["Hamlet", "Town", "City", "Castle", "?"].map(stageFor).join(), "halt,station,junction,grand,halt");
    for (const stage of ["halt", "station"]) {
      const p = stationPlan("frostmarch", stage);
      assert(p.line.x1 - p.line.x0 + 1 >= 15 + 2 * STATION.runOn, `${stage} line covers the platform`);
      assert(!p.get(0, 1, 0), "the track's own block is left for the track");
      for (const c of p.cells.values()) if (c.z < 2 && c.y > 0) assertEqual(c.role, "air", `${stage}: only air beside the line, at ${c.x},${c.y},${c.z}`);
      assert(p.marks.post && p.marks.post.z >= 2, "the post stands on the platform");
    }
    assert(stationPlan("nowhere", "grand") === stationPlan("vale", "grand"), "unknown regions build the Vale station");
    assertEqual(STAGES.length, 4);
  },
  "stations: at the end of a line the track stops at a buffer and an end wall, on the side away from the line": () => {
    const ends = ["oakmere", "wolfcairn", "frosthelm"];
    for (const stop of ROUTES.stops) {
      const at = stopSite(ROUTES, stop, 1);
      if (!at) continue;
      const end = deadEndAt(ROUTES, at.origin, at.forward);
      if (!ends.includes(stop.id)) { assertEqual(end, 0, `${stop.name} is a through station`); continue; }
      assert(end === 1 || end === -1, `${stop.name} is the end of its line`);
      // the one stretch there leaves from the other side of the platform
      const seg = ROUTES.segments.find((s) => s.from === stop.id || s.to === stop.id);
      const r = rightOf(at.forward), side = (b) => Math.sign((b[0] - at.origin.x) * r.x + (b[2] - at.origin.z) * r.z);
      const far = seg.blocks.filter((b) => Math.hypot(b[0] - stop.x, b[2] - stop.z) > 30);
      assert(far.length && far.every((b) => side(b) === -end), `${stop.name}: the line runs out the open end`);
    }
    for (const stage of STAGES) {
      for (const end of [1, -1]) {
        const open = stationPlan("vale", stage), plan = stationPlan("vale", stage, end);
        assert(plan !== open && stationPlan("vale", stage, end) === plan, "its own plan, made once");
        const xe = end > 0 ? plan.line.x1 : plan.line.x0;
        const beam = plan.get(xe + end * BUFFER.beamAt, 1, 0), wall = plan.get(xe + end * BUFFER.wallAt, 1, 0);
        assert(beam && beam.role === "sd:buffer:beam", `${stage}: a buffer beam just past the last rail`);
        assert(wall && wall.role === "wallLow", `${stage}: an end wall behind it`);
        // nothing of the station itself is moved or covered
        for (const [k, c] of open.cells) assert(plan.cells.get(k)?.role === c.role, `${stage}: the station is unchanged at ${k}`);
      }
    }
  },

  "stations: line up with straight track near the post, or put the line behind it": () => {
    const { get, lay } = yard();
    for (let x = -12; x <= 12; x++) lay(x, 64, 0, -90); // an east-west line
    const s = siteFor({ x: 2, y: 64, z: 4 }, get, { x: 1, z: 0 });
    assert(s.onTrack, "found the line");
    assertEqual(JSON.stringify([s.origin, s.forward]), JSON.stringify([{ x: 2, y: 64, z: 0 }, { x: 0, z: 1 }]));
    const along = lineBlocks(stationPlan("vale", "halt"), s.origin, s.forward);
    assert(along.every((b) => b.z === 0 && b.y === 64 && b.dir === 2), "the new line runs along the old one");
    const none = siteFor({ x: 0, y: 64, z: 40 }, get, { x: 0.2, z: -0.9 });
    assert(!none.onTrack, "no track near");
    assertEqual(JSON.stringify([none.origin, none.forward]), JSON.stringify([{ x: 0, y: 64 + STATION.noTrackLift, z: 40 + STATION.noTrackBack }, { x: 0, z: -1 }]));
    assertEqual(JSON.stringify(rightOf({ x: 0, z: 1 })), JSON.stringify({ x: -1, z: 0 }));
  },
  "corners and bends are curves: the wheels follow an arc from edge to edge": () => {
    const near = (a, b) => Math.abs(a - b) < 1e-6;
    const c = curvePoints(0, 2); // north edge round to east edge
    assert(near(c.pts[0][0], 0) && near(c.pts[0][1], -0.5) && near(c.pts.at(-1)[0], 0.5), "starts and ends on the edges");
    for (const [x, z] of c.pts) assert(Math.abs(Math.hypot(x - 0.5, z + 0.5) - 0.5) < 1e-6, "round the inside corner");
    const corner = SHAPES.find((s) => s.kind === 2 && s.links.includes(0) && s.links.includes(2));
    const mid = pointAt({ x: 0, y: 0, z: 0, from: 0, to: 2, t: 0.5 }, corner);
    assert(Math.hypot(mid.x - 0.5, mid.z - 0.5) > 0.1, "cuts the corner instead of passing the block centre");
    const bend = curvePoints(0, 3);
    assert(near(bend.pts.at(-1)[0], 0.5) && near(bend.pts.at(-1)[1], 0.5), "a bend ends in the diagonal corner");
  },
  "line trains: a line's laid stretches join into one run, stop to stop": () => {
    const line = ROUTES.segments.find((s) => s.line)?.line;
    const segs = ROUTES.segments.filter((s) => s.line === line);
    assertEqual(chainsOf(ROUTES, {}).length, 0, "no track, no trains");
    const all = chainsOf(ROUTES, Object.fromEntries(segs.map((s) => [s.id, {}])));
    assertEqual(all.length, 1);
    const c = all[0];
    assertEqual(c.stops.length, segs.length + 1, "every stop of the line, in order");
    assertEqual(c.at[0], 0);
    assertEqual(c.at.at(-1), c.path.length - 1);
    for (let i = 1; i < c.path.length; i++) {
      const a = c.path[i - 1], b = c.path[i];
      assert(Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z)) === 1 && Math.abs(a.y - b.y) <= 1, `the run is unbroken at ${b.x},${b.z}`);
    }
    for (let k = 0; k < c.stops.length; k++) {
      const stop = ROUTES.stops.find((s) => s.id === c.stops[k]), p = c.path[c.at[k]];
      assert(stop && indexNear(c, c.at[k], p.x, p.z) === c.at[k], c.stops[k]);
    }
    // only one stretch laid: the train shuttles between its two stops
    const one = chainsOf(ROUTES, { [segs[0].id]: {} })[0];
    assertEqual(one.stops.length, 2);
  },
  "line trains: unseen, the train calls at every stop, waits, and turns back at each end": () => {
    const chain = { line: "t", stops: ["a", "b", "c"], path: Array.from({ length: 201 }, (_, x) => ({ x, y: 64, z: 0 })), at: [0, 120, 200] };
    assertEqual(nextStop(chain, 0, 1), 1);
    assertEqual(nextStop(chain, 120, 1), 2);
    assertEqual(nextStop(chain, 200, 1), -1);
    assertEqual(nextStop(chain, 200, -1), 1);
    const svc = newService(), calls = [];
    let standing = true;
    for (let t = 0; t < 20 * 60 * 6; t += 20) {
      stepUnseen(svc, chain, 20);
      assert(svc.pos >= 0 && svc.pos <= 200, "stays on the line");
      if (svc.dwell > 0 && !standing) calls.push(chain.stops[chain.at.indexOf(svc.pos)]);
      standing = svc.dwell > 0;
    }
    assertEqual(calls.slice(0, 6).join(""), "bcbabc");
  },
  "line trains: the real train slows into each stop, stands 20 seconds, and never overruns": () => {
    const chain = { line: "t", stops: ["a", "b", "c"], path: Array.from({ length: 201 }, (_, x) => ({ x, y: 64, z: 0 })), at: [0, 120, 200] };
    const svc = newService(), calls = [];
    let pos = 5, v = 0, top = 0, stood = 0;
    for (let t = 0; t < 20 * 60 * 4; t++) {
      const out = pilot(svc, chain, pos, v);
      if (out.arrived !== undefined) calls.push(chain.stops[out.arrived]);
      if (svc.dwell > 0) stood++;
      // the runner: speed up by TRAIN.accel toward the limit, brake by TRAIN.brake when over it
      const want = out.throttle ? out.limit : 0, s = Math.abs(v);
      const next = s > want ? Math.max(want, s - TRAIN.brake) : Math.min(want, s + TRAIN.accel);
      v = next * out.dir;
      pos += v;
      top = Math.max(top, Math.abs(v));
      assert(pos > -2 && pos < 202, `never off the end (${pos})`);
      if (out.arrived !== undefined) assert(Math.abs(pos - chain.at[out.arrived]) <= 2, "stops at the platform, not past it");
    }
    assert(top > LINE.cruise - 0.05 && top <= LINE.cruise + 1e-9, `runs at line speed (${top})`);
    assertEqual(calls.slice(0, 4).join(""), "bcba");
    assert(stood >= LINE.dwell * 3, "it stands at each stop");
    // the track ends short of the next stop: after standing still a while it turns back instead of waiting for ever
    const cut = newService();
    cut.dwell = 0;
    let dir = 1;
    for (let t = 0; t < 400 && dir === 1; t++) dir = pilot(cut, chain, 60, 0).dir;
    assertEqual(dir, -1);
  },
  "the pack has the track, the trains and their parts": () => {
    assert(BlockTypes.get(TRACK), TRACK);
    for (const c of Object.values(CARS)) assert(EntityTypes.get(c.entity) && ItemTypes.get(c.item), c.entity);
    for (const id of ["siege:train_bogie", "siege:train_boiler"]) assert(ItemTypes.get(id), id);
  },
});
