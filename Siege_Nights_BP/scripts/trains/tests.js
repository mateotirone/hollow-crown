// Trains self-tests (the pure ones run offline too).

import { BlockTypes, EntityTypes, ItemTypes } from "@minecraft/server";
import { addTests, assert, assertEqual } from "../siege/api.js";
import { SHAPES, layTrack, cursorOn, advance, back, pointAt, follow, KINDS } from "./track.js";
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

addTests("trains", {
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
  "the pack has the track, the trains and their parts": () => {
    assert(BlockTypes.get(TRACK), TRACK);
    for (const c of Object.values(CARS)) assert(EntityTypes.get(c.entity) && ItemTypes.get(c.item), c.entity);
    for (const id of ["siege:train_bogie", "siege:train_boiler"]) assert(ItemTypes.get(id), id);
  },
});
