// Trains self-tests (the pure ones run offline too).

import { BlockTypes, EntityTypes, ItemTypes } from "@minecraft/server";
import { addTests, assert, assertEqual } from "../siege/api.js";
import { SHAPES, layTrack, cursorOn, advance, back, pointAt, follow, KINDS, curvePoints, switchSetting, shapeOf } from "./track.js";
import { stageFor, stationPlan, siteFor, lineBlocks, rightOf, STAGES, STATION } from "./stations.js";
import { ROUTE, reachable, buyable, cannotBuy, priceOf, nearestStop, checkRoutes, stopSite } from "./routes.js";
import { ROUTES } from "./routes_data.js";
import { TRACK, CARS, TRAIN, carPoses, trainLength, stepSpeed, moveTrain, limitAhead, shapesForLoop, showcaseLoop } from "./data.js";

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
    assertEqual(checkRoutes(ROUTES).length, 0, "the planned railway has no mistakes");
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
    assertEqual(JSON.stringify([none.origin, none.forward]), JSON.stringify([{ x: 0, y: 64, z: 40 + STATION.noTrackBack }, { x: 0, z: -1 }]));
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
  "the pack has the track, the trains and their parts": () => {
    assert(BlockTypes.get(TRACK), TRACK);
    for (const c of Object.values(CARS)) assert(EntityTypes.get(c.entity) && ItemTypes.get(c.item), c.entity);
    for (const id of ["siege:train_bogie", "siege:train_boiler"]) assert(ItemTypes.get(id), id);
  },
});
